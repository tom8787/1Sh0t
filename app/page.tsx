"use client";

/* eslint-disable @next/next/no-img-element -- external catalog images are loaded dynamically and also used by canvas */

import {
  ChangeEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AssetType = "rifle" | "sniper" | "sidearm" | "melee" | "bundle" | "card" | "charm" | "image" | "text";
type CatalogCategory = "all" | "weapons" | "bundle" | "card" | "charm";

type LibraryAsset = {
  id: string;
  name: string;
  type: AssetType;
  label: string;
  colors: [string, string, string];
  imageUrl?: string;
  levelIds?: string[];
  isEffect?: boolean;
};

type SceneItem = LibraryAsset & {
  uid: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  text?: string;
  textColor?: string;
  fontSize?: number;
  outlineEnabled?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
};

type ValorantSkin = {
  uuid: string;
  displayName: string;
  displayIcon?: string | null;
  themeUuid?: string | null;
  chromas?: { fullRender?: string | null; displayIcon?: string | null }[];
  levels?: { uuid: string; displayIcon?: string | null }[];
};

type ValorantWeapon = {
  displayName: string;
  category: string;
  skins: ValorantSkin[];
};

const W = 1200;
const H = 760;
const DEFAULT_THEME_UUID = "5a629df4-4765-0214-bd40-fbb96542941f";
const CLIENT_PLATFORM = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
const RIOT_LOGIN_URL = "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

const categoryTabs: { key: CatalogCategory; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "weapons", label: "槍枝" },
  { key: "bundle", label: "同捆包" },
  { key: "card", label: "卡面" },
  { key: "charm", label: "吊飾" },
];

function colorsFromId(id: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue} 86% 88%)`, `hsl(${(hue + 32) % 360} 72% 58%)`, `hsl(${(hue + 78) % 360} 58% 28%)`];
}

function weaponType(category: string): AssetType {
  if (category.includes("Sidearm")) return "sidearm";
  if (category.includes("Melee")) return "melee";
  if (category.includes("Sniper")) return "sniper";
  return "rifle";
}

function catalogCategory(asset: LibraryAsset): CatalogCategory {
  if (["rifle", "sniper", "sidearm", "melee"].includes(asset.type)) return "weapons";
  if (asset.type === "bundle") return "bundle";
  if (asset.type === "card") return "card";
  if (asset.type === "charm") return "charm";
  return "all";
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function drawOutlinedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  w: number,
  h: number,
  color: string,
  width: number,
) {
  const outlineWidth = Math.max(1, width);
  const pad = Math.ceil(outlineWidth + 3);
  const mask = document.createElement("canvas");
  mask.width = Math.ceil(w + pad * 2);
  mask.height = Math.ceil(h + pad * 2);
  const maskContext = mask.getContext("2d");

  if (!maskContext) {
    drawContainedImage(ctx, image, w, h);
    return;
  }

  maskContext.save();
  maskContext.translate(pad, pad);
  drawContainedImage(maskContext, image, w, h);
  maskContext.restore();
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = color;
  maskContext.fillRect(0, 0, mask.width, mask.height);

  const rings = Math.max(2, Math.ceil(outlineWidth / 3));
  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = outlineWidth * ring / rings;
    const steps = Math.max(24, Math.ceil(radius * 5));
    for (let step = 0; step < steps; step += 1) {
      const angle = step * Math.PI * 2 / steps;
      ctx.drawImage(mask, -pad + Math.cos(angle) * radius, -pad + Math.sin(angle) * radius);
    }
  }

  drawContainedImage(ctx, image, w, h);
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sourceW = w / scale;
  const sourceH = h / scale;
  const sourceX = (image.naturalWidth - sourceW) / 2;
  const sourceY = (image.naturalHeight - sourceH) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, w, h);
}

function drawItem(ctx: CanvasRenderingContext2D, item: SceneItem, selected: boolean, image?: HTMLImageElement) {
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.translate(-item.w / 2, -item.h / 2);

  if (item.type === "text") {
    ctx.fillStyle = item.textColor || "#ffffff";
    ctx.font = `800 ${item.fontSize || 42}px Arial, \"Noto Sans TC\", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.65)";
    ctx.shadowBlur = 8;
    ctx.fillText(item.text || "自訂文字", 0, item.h / 2, item.w);
    ctx.shadowBlur = 0;
  } else if (image) {
    if (item.outlineEnabled) {
      drawOutlinedImage(ctx, image, item.w, item.h, item.outlineColor || "#f3a3b4", item.outlineWidth || 10);
    } else {
      drawContainedImage(ctx, image, item.w, item.h);
    }
  } else if (item.type === "card" || item.type === "bundle" || item.type === "image") {
    const gradient = ctx.createLinearGradient(0, 0, item.w, item.h);
    gradient.addColorStop(0, item.colors[0]);
    gradient.addColorStop(.5, item.colors[1]);
    gradient.addColorStop(1, item.colors[2]);
    ctx.fillStyle = gradient;
    roundedRect(ctx, 0, 0, item.w, item.h, 14);
    ctx.fill();
  } else if (item.type === "charm") {
    const gradient = ctx.createRadialGradient(item.w / 2, item.h / 2, 2, item.w / 2, item.h / 2, item.w / 2);
    gradient.addColorStop(0, item.colors[0]);
    gradient.addColorStop(.55, item.colors[1]);
    gradient.addColorStop(1, item.colors[2]);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(item.w / 2, item.h / 2, Math.min(item.w, item.h) * .35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gradient = ctx.createLinearGradient(0, 0, item.w, item.h);
    gradient.addColorStop(0, item.colors[0]);
    gradient.addColorStop(.5, item.colors[1]);
    gradient.addColorStop(1, item.colors[2]);
    ctx.fillStyle = gradient;
    ctx.shadowColor = item.colors[1];
    ctx.shadowBlur = 15;
    ctx.beginPath();
    if (item.type === "melee") {
      ctx.moveTo(item.w * .08, item.h * .88);
      ctx.lineTo(item.w * .42, item.h * .55);
      ctx.lineTo(item.w * .95, item.h * .05);
      ctx.lineTo(item.w * .68, item.h * .68);
      ctx.lineTo(item.w * .22, item.h * .96);
    } else {
      ctx.moveTo(item.w * .04, item.h * .36);
      ctx.lineTo(item.w * .56, item.h * .24);
      ctx.lineTo(item.w * .74, item.h * .38);
      ctx.lineTo(item.w * .98, item.h * .34);
      ctx.lineTo(item.w * .98, item.h * .5);
      ctx.lineTo(item.w * .68, item.h * .57);
      ctx.lineTo(item.w * .58, item.h * .78);
      ctx.lineTo(item.w * .46, item.h * .78);
      ctx.lineTo(item.w * .42, item.h * .56);
      ctx.lineTo(item.w * .15, item.h * .6);
      ctx.lineTo(item.w * .04, item.h * .48);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (selected) {
    ctx.strokeStyle = "#62f1df";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    roundedRect(ctx, -7, -7, item.w + 14, item.h + 14, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#62f1df";
    ctx.fillRect(item.w - 3, item.h - 3, 12, 12);
  }
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  items: SceneItem[],
  selected: string | null,
  vp: string,
  rp: string,
  bgImage?: HTMLImageElement,
  images?: Map<string, HTMLImageElement>,
) {
  ctx.clearRect(0, 0, W, H);
  if (bgImage) {
    drawCoverImage(ctx, bgImage, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07131f");
    bg.addColorStop(.52, "#0b3445");
    bg.addColorStop(1, "#11182b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(76,242,218,.08)";
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(W, 160);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.strokeStyle = "rgba(126,236,225,.11)";
    for (let x = -200; x < W + 200; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 460, 0);
      ctx.stroke();
    }
    for (let y = 120; y < H; y += 84) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
  if (!bgImage) {
    ctx.fillStyle = "rgba(6,13,23,.86)";
    ctx.fillRect(0, 0, W, 86);
  } else {
    ctx.shadowColor = "rgba(0,0,0,.82)";
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = "#f4f8fb";
  ctx.font = "800 30px Arial, sans-serif";
  ctx.fillText("LOADOUT // 特戰收藏", 38, 46);
  ctx.fillStyle = "#63e9d8";
  ctx.font = "700 13px Arial, sans-serif";
  ctx.fillText("PERSONAL ARMORY  •  LOADOUT LAB", 40, 69);
  ctx.textAlign = "right";
  ctx.fillStyle = "#d7e8ef";
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillText(`VP  ${vp || "0"}     RP  ${rp || "0"}`, W - 40, 52);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;

  items.forEach((item) => drawItem(ctx, item, item.uid === selected, images?.get(item.uid)));
  if (!bgImage) {
    ctx.fillStyle = "rgba(6,13,23,.82)";
    ctx.fillRect(0, H - 58, W, 58);
  } else {
    ctx.shadowColor = "rgba(0,0,0,.82)";
    ctx.shadowBlur = 8;
  }
  ctx.fillStyle = "#7ff4e4";
  ctx.font = "700 13px Arial, sans-serif";
  ctx.fillText("SW// LAB", 38, H - 24);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(228,245,247,.7)";
  ctx.font = "500 12px Arial, sans-serif";
  ctx.fillText("DRAG  •  SCALE  •  CREATE", W - 38, H - 24);
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;
}

function parseAccessToken(value: string) {
  const trimmed = value.trim();
  let params: URLSearchParams;
  try {
    const url = new URL(trimmed);
    params = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (!params.get("access_token")) params = url.searchParams;
  } catch {
    params = new URLSearchParams(trimmed.replace(/^[?#]/, ""));
  }
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");
  if (!accessToken) throw new Error("找不到 access_token，請貼上登入完成後瀏覽器顯示的完整網址。");
  return { accessToken, idToken };
}

function jwtSubject(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(escape(atob(padded)))).sub as string;
  } catch {
    throw new Error("驗證網址格式無法解析，請重新登入取得新的網址。");
  }
}

function savedScene(): SceneItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem("loadout-lab-scene") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | undefined>(undefined);
  const imageRefs = useRef(new Map<string, HTMLImageElement>());
  const loadingImages = useRef(new Set<string>());
  const catalogRef = useRef<LibraryAsset[]>([]);
  const uidSequence = useRef(0);
  const dragRef = useRef<{ uid: string; dx: number; dy: number; resize: boolean } | null>(null);

  const [items, setItems] = useState<SceneItem[]>(savedScene);
  const [selected, setSelected] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<LibraryAsset[]>([]);
  const [category, setCategory] = useState<CatalogCategory>("all");
  const [search, setSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [visibleCount, setVisibleCount] = useState(80);
  const [vp, setVp] = useState("475");
  const [rp, setRp] = useState("90");
  const [bgUrl, setBgUrl] = useState("");
  const [newText, setNewText] = useState("");
  const [toast, setToast] = useState("");
  const [imageRevision, setImageRevision] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const [onlyEffects, setOnlyEffects] = useState(true);
  const [region, setRegion] = useState("ap");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadCatalog = useCallback(async () => {
    if (catalogRef.current.length) return catalogRef.current;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const urls = [
        "https://valorant-api.com/v1/weapons?language=zh-TW",
        "https://valorant-api.com/v1/bundles?language=zh-TW",
        "https://valorant-api.com/v1/playercards?language=zh-TW",
        "https://valorant-api.com/v1/buddies?language=zh-TW",
      ];
      const responses = await Promise.all(urls.map((url) => fetch(url)));
      if (!responses[0].ok) throw new Error("造型資料暫時無法讀取");
      const [weaponsJson, bundlesJson, cardsJson, buddiesJson] = await Promise.all(responses.map((response) => response.json()));
      const weaponAssets: LibraryAsset[] = (weaponsJson.data as ValorantWeapon[]).flatMap((weapon) =>
        weapon.skins
          .filter((skin) => skin.themeUuid !== DEFAULT_THEME_UUID)
          .map((skin) => ({
            id: skin.uuid,
            name: skin.displayName,
            type: weaponType(weapon.category),
            label: weapon.displayName,
            colors: colorsFromId(skin.uuid),
            imageUrl: skin.displayIcon || skin.chromas?.find((chroma) => chroma.fullRender)?.fullRender || skin.levels?.find((level) => level.displayIcon)?.displayIcon || undefined,
            levelIds: skin.levels?.map((level) => level.uuid.toLowerCase()) || [],
            isEffect: (skin.levels?.length || 0) > 1,
          })),
      );
      const bundleAssets: LibraryAsset[] = (bundlesJson.data || []).map((bundle: { uuid: string; displayName: string; displayIcon?: string }) => ({
        id: bundle.uuid, name: bundle.displayName, type: "bundle", label: "同捆包", colors: colorsFromId(bundle.uuid), imageUrl: bundle.displayIcon,
      }));
      const cardAssets: LibraryAsset[] = (cardsJson.data || []).map((card: { uuid: string; displayName: string; largeArt?: string; displayIcon?: string }) => ({
        id: card.uuid, name: card.displayName, type: "card", label: "玩家卡面", colors: colorsFromId(card.uuid), imageUrl: card.largeArt || card.displayIcon,
      }));
      const buddyAssets: LibraryAsset[] = (buddiesJson.data || []).map((buddy: { uuid: string; displayName: string; displayIcon?: string; levels?: { displayIcon?: string }[] }) => ({
        id: buddy.uuid, name: buddy.displayName, type: "charm", label: "武器吊飾", colors: colorsFromId(buddy.uuid), imageUrl: buddy.displayIcon || buddy.levels?.[0]?.displayIcon,
      }));
      const all = [...weaponAssets, ...bundleAssets, ...cardAssets, ...buddyAssets].filter((asset) => asset.imageUrl);
      catalogRef.current = all;
      setCatalog(all);
      return all;
    } catch (error) {
      const message = error instanceof Error ? error.message : "造型資料暫時無法讀取";
      setCatalogError(message);
      throw error;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    const persistentItems = items.filter((item) => !item.imageUrl?.startsWith("blob:"));
    localStorage.setItem("loadout-lab-scene", JSON.stringify(persistentItems));
  }, [items]);

  useEffect(() => {
    const liveIds = new Set(items.map((item) => item.uid));
    for (const id of imageRefs.current.keys()) if (!liveIds.has(id)) imageRefs.current.delete(id);
    items.forEach((item) => {
      if (!item.imageUrl || imageRefs.current.has(item.uid) || loadingImages.current.has(item.uid)) return;
      loadingImages.current.add(item.uid);
      const image = new Image();
      if (/^https?:/i.test(item.imageUrl)) image.crossOrigin = "anonymous";
      image.onload = () => {
        imageRefs.current.set(item.uid, image);
        loadingImages.current.delete(item.uid);
        setImageRevision((value) => value + 1);
      };
      image.onerror = () => loadingImages.current.delete(item.uid);
      image.src = item.imageUrl;
    });
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("zh-TW");
    return catalog.filter((asset) =>
      (category === "all" || catalogCategory(asset) === category) &&
      (!query || `${asset.name} ${asset.label}`.toLocaleLowerCase("zh-TW").includes(query)),
    );
  }, [catalog, category, search]);

  const current = items.find((item) => item.uid === selected);
  const canOutline = Boolean(current?.imageUrl && ["rifle", "sniper", "sidearm", "melee"].includes(current.type));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, items, selected, vp, rp, bgImageRef.current, imageRefs.current);
  }, [items, selected, vp, rp, bgUrl, imageRevision]);

  const addAsset = (asset: LibraryAsset) => {
    const same = items.filter((item) => item.type === asset.type).length;
    const presets: Record<string, { x: number; y: number; w: number; h: number }> = {
      rifle: { x: 70, y: same % 2 ? 330 : 145, w: 274, h: 110 },
      sniper: { x: 438, y: 145, w: 282, h: 112 },
      sidearm: { x: 458, y: 335, w: 250, h: 100 },
      melee: { x: 480, y: 500, w: 220, h: 125 },
      bundle: { x: 800, y: 150, w: 320, h: 170 },
      card: { x: 812, y: 150, w: 128, h: 245 },
      charm: { x: 1034, y: 158, w: 82, h: 96 },
      image: { x: 450, y: 220, w: 300, h: 180 },
    };
    const p = presets[asset.type] || presets.image;
    uidSequence.current += 1;
    const item: SceneItem = { ...asset, uid: `${asset.id}-${uidSequence.current}`, ...p, rotation: 0 };
    setItems((previous) => [...previous, item]);
    setSelected(item.uid);
    flash(`${asset.name} 已加入畫布`);
  };

  const addText = (preset?: string) => {
    const value = (preset || newText).trim();
    if (!value) return flash("請先輸入文字");
    uidSequence.current += 1;
    const item: SceneItem = {
      id: `text-${uidSequence.current}`, uid: `text-${uidSequence.current}`, name: value, text: value, type: "text", label: "自訂文字",
      colors: ["#ffffff", "#ffffff", "#ffffff"], textColor: "#ffffff", fontSize: 42,
      x: 430, y: 600, w: Math.min(520, Math.max(180, value.length * 48)), h: 64, rotation: 0,
    };
    setItems((previous) => [...previous, item]);
    setSelected(item.uid);
    setNewText("");
    flash("文字已加入畫布");
  };

  const updateCurrent = (patch: Partial<SceneItem>) => setItems((previous) => previous.map((item) => item.uid === selected ? { ...item, ...patch } : item));
  const deleteCurrent = () => {
    if (!selected) return;
    setItems((previous) => previous.filter((item) => item.uid !== selected));
    setSelected(null);
    flash("已刪除選取項目");
  };
  const duplicateCurrent = () => {
    if (!current) return;
    uidSequence.current += 1;
    const clone = { ...current, uid: `${current.id}-${uidSequence.current}`, x: current.x + 24, y: current.y + 24 };
    setItems((previous) => [...previous, clone]);
    setSelected(clone.uid);
  };

  const openLibrary = () => {
    setLibraryOpen(true);
    void loadCatalog().catch(() => undefined);
  };

  const openImport = () => {
    setImportStatus("");
    setImportOpen(true);
  };

  const coords = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = coords(event);
    const hit = [...items].reverse().find((item) => point.x >= item.x - 8 && point.x <= item.x + item.w + 8 && point.y >= item.y - 8 && point.y <= item.y + item.h + 8);
    if (!hit) return setSelected(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(hit.uid);
    const resize = Math.abs(point.x - (hit.x + hit.w)) < 28 && Math.abs(point.y - (hit.y + hit.h)) < 28;
    dragRef.current = { uid: hit.uid, dx: point.x - hit.x, dy: point.y - hit.y, resize };
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const point = coords(event);
    const drag = dragRef.current;
    setItems((previous) => previous.map((item) => item.uid !== drag.uid ? item : drag.resize
      ? { ...item, w: Math.max(54, point.x - item.x), h: Math.max(48, point.y - item.y) }
      : { ...item, x: Math.max(-item.w * .7, Math.min(W - item.w * .3, point.x - drag.dx)), y: Math.max(86, Math.min(H - 60, point.y - drag.dy)) }));
  };
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const loadBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      bgImageRef.current = image;
      setBgUrl(url);
      flash("背景已更新");
    };
    image.src = url;
  };

  const loadCustom = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    uidSequence.current += 1;
    const uid = `custom-${uidSequence.current}`;
    image.onload = () => {
      const w = Math.min(320, image.naturalWidth);
      const h = Math.min(250, w * image.naturalHeight / image.naturalWidth);
      imageRefs.current.set(uid, image);
      const item: SceneItem = {
        id: uid, uid, name: file.name, type: "image", label: "自訂圖片", colors: ["#fff", "#fff", "#fff"],
        x: 450, y: 220, w, h, rotation: 0, imageUrl: url,
      };
      setItems((previous) => [...previous, item]);
      setSelected(uid);
      flash("自訂圖片已加入");
    };
    image.src = url;
  };

  const exportPng = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawScene(ctx, items, null, vp, rp, bgImageRef.current, imageRefs.current);
      const link = document.createElement("a");
      link.download = `特戰收藏-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      flash("高畫質 PNG 已匯出");
    } catch {
      flash("圖片仍在載入，請稍後再匯出");
    }
  };

  const importOwnedSkins = async () => {
    if (!authUrl.trim()) return setImportStatus("請先貼上 Riot 登入完成後的完整網址。");
    setImporting(true);
    setImportStatus("正在驗證 Riot 帳號…");
    try {
      const { accessToken, idToken } = parseAccessToken(authUrl);
      const puuid = jwtSubject(accessToken) || (idToken ? jwtSubject(idToken) : "");
      if (!puuid) throw new Error("無法讀取帳號識別碼，請重新取得驗證網址。");

      const entitlementsResponse = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (!entitlementsResponse.ok) throw new Error("驗證已過期或無效，請重新登入 Riot。");
      const entitlements = await entitlementsResponse.json();
      const entitlementToken = entitlements.entitlements_token;

      setImportStatus("正在讀取造型收藏…");
      const versionResponse = await fetch("https://valorant-api.com/v1/version");
      const versionJson = await versionResponse.json();
      const inventoryResponse = await fetch(`https://pd.${region}.a.pvp.net/store/v1/entitlements/${encodeURIComponent(puuid)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Riot-Entitlements-JWT": entitlementToken,
          "X-Riot-ClientVersion": versionJson.data.riotClientVersion,
          "X-Riot-ClientPlatform": CLIENT_PLATFORM,
        },
      });
      if (!inventoryResponse.ok) {
        if ([401, 403].includes(inventoryResponse.status)) throw new Error("Riot 驗證失敗，網址可能已過期，請重新登入。");
        throw new Error("無法讀取收藏。請確認分區是否正確，再重新嘗試。");
      }
      const inventory = await inventoryResponse.json();
      const groups = inventory.EntitlementsByTypes || inventory.entitlementsByTypes || [];
      const ownedIds = new Set<string>();
      groups.forEach((group: { Entitlements?: { ItemID?: string; itemId?: string }[]; entitlements?: { ItemID?: string; itemId?: string }[] }) => {
        (group.Entitlements || group.entitlements || []).forEach((entry) => {
          const id = entry.ItemID || entry.itemId;
          if (id) ownedIds.add(id.toLowerCase());
        });
      });

      const allCatalog = await loadCatalog();
      const existingIds = new Set(items.map((item) => item.id));
      const matches = allCatalog.filter((asset) =>
        asset.levelIds?.some((id) => ownedIds.has(id)) &&
        (!onlyEffects || asset.isEffect) &&
        !existingIds.has(asset.id),
      );
      if (!matches.length) throw new Error(onlyEffects ? "沒有找到尚未加入的特效槍皮，可取消「僅匯入特效槍皮」再試一次。" : "沒有找到尚未加入的造型。");

      const columns = matches.length <= 20 ? 4 : matches.length <= 42 ? 6 : 8;
      const rows = Math.ceil(matches.length / columns);
      const cellW = (W - 76) / columns;
      const cellH = Math.max(62, (H - 166) / Math.max(rows, 1));
      uidSequence.current += matches.length;
      const firstImportedSequence = uidSequence.current - matches.length + 1;
      const imported: SceneItem[] = matches.map((asset, index) => ({
        ...asset,
        uid: `riot-${asset.id}-${firstImportedSequence + index}`,
        x: 38 + (index % columns) * cellW,
        y: 104 + Math.floor(index / columns) * cellH,
        w: cellW - 16,
        h: Math.min(92, cellH - 8),
        rotation: 0,
      }));
      setItems((previous) => [...previous, ...imported]);
      setSelected(imported[0]?.uid || null);
      setAuthUrl("");
      setImportStatus(`完成：已匯入 ${imported.length} 個造型。`);
      flash(`已從 Riot 匯入 ${imported.length} 個造型`);
      window.setTimeout(() => setImportOpen(false), 1100);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "匯入失敗，請重新嘗試。");
    } finally {
      setImporting(false);
    }
  };

  const assetList = (limit: number) => (
    <>
      {catalogLoading && <div className="catalog-message"><span className="spinner" />正在同步 VALORANT 造型資料…</div>}
      {catalogError && <div className="catalog-message error">{catalogError}<button onClick={() => void loadCatalog()}>重新載入</button></div>}
      {!catalogLoading && !catalogError && !filtered.length && <div className="catalog-message">沒有符合條件的素材</div>}
      {filtered.slice(0, limit).map((asset) => (
        <button className="asset-card" key={asset.id} onClick={() => addAsset(asset)}>
          <span className={`mini-asset ${asset.type}`}>{asset.imageUrl ? <img src={asset.imageUrl} alt="" loading="lazy" crossOrigin="anonymous" /> : <b />}</span>
          <span><strong>{asset.name}</strong><small>{asset.label}{asset.isEffect ? " · 特效" : ""}</small></span><em>＋</em>
        </button>
      ))}
    </>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">SW</span><span>LOADOUT LAB</span><i>特戰製圖工具</i></div>
        <div className="top-actions">
          <span className="status-dot" /><span className="privacy-label">本機處理 · 不儲存 Riot 憑證</span>
          <button className="ghost-btn" onClick={openLibrary}>＋ 素材庫</button>
          <button className="import-btn" onClick={openImport}>⇄ Riot 匯入</button>
          <button className="export-btn" onClick={exportPng}>匯出 PNG</button>
        </div>
      </header>

      <section className="workspace">
        <section className="stage-panel panel">
          <div className="stage-head">
            <div><span className="eyebrow">COMPOSE</span><h1>收藏展示畫布 <small>{items.length} 個物件</small></h1></div>
            <div className="canvas-tools">
              <button title="清空整張畫布" onClick={() => { setItems([]); setSelected(null); flash("畫布已清空"); }}>重設</button>
              <button title="複製選取物件" disabled={!current} onClick={duplicateCurrent}>複製</button>
              <button title="刪除選取物件" disabled={!current} onClick={deleteCurrent}>刪除</button>
            </div>
          </div>
          <div className="quick-actions" aria-label="快速操作">
            <button className="quick-primary" onClick={openLibrary}><span>01</span> 選擇造型</button>
            <button onClick={openImport}><span>02</span> 匯入 Riot 收藏</button>
            <label><span>03</span> 上傳背景<input type="file" accept="image/*" onChange={loadBackground} /></label>
            <button onClick={() => addText("我的特戰收藏")}><span>＋</span> 加入文字</button>
            <label><span>＋</span> 自訂圖片<input type="file" accept="image/*" onChange={loadCustom} /></label>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} width={W} height={H} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="可拖曳的特戰收藏畫布" />
            {!items.length && !bgUrl && <div className="empty-hint"><span>開始製作</span><strong>先選一個造型，或匯入你的收藏</strong><small>接著上傳背景，再拖曳素材自由排版</small><div><button onClick={openLibrary}>開啟素材庫</button><button onClick={openImport}>匯入 Riot 收藏</button></div></div>}
          </div>
          <div className="stage-foot"><span><b /> 自動儲存在這個裝置</span><span>1200 × 760 PX</span><span>拖曳移動 · 右下角縮放 · 點擊選取</span></div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-head"><div><span className="eyebrow">DETAILS</span><h2>編輯設定</h2></div>{current && <span className="selection-badge">已選取</span>}</div>
          <div className="control-section"><h3>帳號資訊</h3><div className="two-fields"><label>特務幣 VP<input value={vp} inputMode="numeric" onChange={(event) => setVp(event.target.value)} /></label><label>輻能點 RP<input value={rp} inputMode="numeric" onChange={(event) => setRp(event.target.value)} /></label></div></div>
          <div className="control-section"><h3>加入文字</h3><div className="inline-add"><input value={newText} placeholder="輸入自訂文字" onChange={(event) => setNewText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addText(); }} /><button onClick={() => addText()}>加入</button></div></div>
          <div className="control-section"><h3>畫布背景</h3><label className="dropzone"><span>▧</span><strong>更換背景圖片</strong><small>JPG、PNG 或 WEBP</small><input type="file" accept="image/*" onChange={loadBackground} /></label>{bgUrl && <button className="text-btn" onClick={() => { bgImageRef.current = undefined; setBgUrl(""); }}>移除自訂背景</button>}</div>
          <div className="control-section selection-section">
            <h3>選取項目</h3>
            {current ? <>
              <div className="selected-name"><span style={{ background: current.colors[1] }} /><div><strong>{current.name}</strong><small>{current.label}</small></div></div>
              {current.type === "text" && <><label className="field-label">文字內容<input value={current.text || ""} onChange={(event) => updateCurrent({ text: event.target.value, name: event.target.value })} /></label><label className="color-row">文字顏色<input type="color" value={current.textColor || "#ffffff"} onChange={(event) => updateCurrent({ textColor: event.target.value })} /></label><label className="range-label"><span>字體大小 <b>{current.fontSize || 42}px</b></span><input type="range" min="18" max="120" value={current.fontSize || 42} onChange={(event) => updateCurrent({ fontSize: Number(event.target.value) })} /></label></>}
              {canOutline && <div className={`outline-editor ${current.outlineEnabled ? "active" : ""}`}>
                <div className="outline-heading"><div><strong>物件外框</strong><small>沿著武器輪廓加上實色邊框</small></div><label className="outline-switch"><input type="checkbox" checked={Boolean(current.outlineEnabled)} onChange={(event) => updateCurrent({ outlineEnabled: event.target.checked, outlineColor: current.outlineColor || "#f3a3b4", outlineWidth: current.outlineWidth || 10 })} /><span>{current.outlineEnabled ? "已開啟" : "開啟"}</span></label></div>
                {current.outlineEnabled && <>
                  <div className="outline-color-row"><label>外框顏色<input aria-label="選擇外框顏色" type="color" value={current.outlineColor || "#f3a3b4"} onChange={(event) => updateCurrent({ outlineColor: event.target.value })} /></label><code>{(current.outlineColor || "#f3a3b4").toUpperCase()}</code></div>
                  <div className="color-presets" aria-label="常用外框顏色">{["#f3a3b4", "#ffffff", "#ff4655", "#f4d35e", "#58e5d5", "#111111"].map((color) => <button key={color} type="button" className={(current.outlineColor || "#f3a3b4").toLowerCase() === color ? "selected" : ""} style={{ backgroundColor: color }} aria-label={`外框顏色 ${color}`} onClick={() => updateCurrent({ outlineColor: color })} />)}</div>
                  <label className="range-label outline-range"><span>外框粗度 <b>{current.outlineWidth || 10}px</b></span><input aria-label="外框粗度" type="range" min="1" max="30" value={current.outlineWidth || 10} onChange={(event) => updateCurrent({ outlineWidth: Number(event.target.value) })} /></label>
                </>}
              </div>}
              <label className="range-label"><span>旋轉角度 <b>{Math.round(current.rotation)}°</b></span><input type="range" min="-180" max="180" value={current.rotation} onChange={(event) => updateCurrent({ rotation: Number(event.target.value) })} /></label>
              <label className="range-label"><span>寬度 <b>{Math.round(current.w)} px</b></span><input type="range" min="54" max="600" value={current.w} onChange={(event) => { const w = Number(event.target.value); updateCurrent({ w, h: current.h * w / current.w }); }} /></label>
              <div className="object-actions"><button onClick={() => updateCurrent({ rotation: 0 })}>角度歸零</button><button onClick={() => setItems((previous) => [...previous.filter((item) => item.uid !== current.uid), current])}>移到最上層</button></div>
            </> : <div className="no-selection"><span>◇</span><p><strong>尚未選取物件</strong><br />點擊畫布中的造型或文字，即可調整大小、角度與圖層。</p></div>}
          </div>
          <div className="tips"><span>提示</span><p>右下角拖曳可縮放物件；匯入驗證網址只用於當次操作，不會儲存。</p></div>
        </aside>
      </section>

      {libraryOpen && <div className="modal-backdrop" onMouseDown={() => setLibraryOpen(false)}>
        <section className="modal catalog-modal" role="dialog" aria-modal="true" aria-label="造型清單" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow">VALORANT DATABASE</span><h2>造型清單</h2></div><button className="close-btn" onClick={() => setLibraryOpen(false)}>×</button></div>
          <div className="catalog-toolbar"><label className="search"><span>⌕</span><input placeholder="搜尋造型名稱或武器" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="tabs">{categoryTabs.map((tab) => <button key={tab.key} className={category === tab.key ? "active" : ""} onClick={() => setCategory(tab.key)}>{tab.label}</button>)}</div><span className="result-count">{filtered.length} 項</span></div>
          <div className="modal-grid">{assetList(visibleCount)}</div>
          {visibleCount < filtered.length && <button className="load-more" onClick={() => setVisibleCount((value) => value + 80)}>顯示更多</button>}
        </section>
      </div>}

      {importOpen && <div className="modal-backdrop" onMouseDown={() => { if (!importing) { setImportOpen(false); setAuthUrl(""); } }}>
        <section className="modal import-modal" role="dialog" aria-modal="true" aria-label="匯入 Riot 造型" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow">RIOT ACCOUNT IMPORT</span><h2>匯入功能</h2></div><button className="close-btn" disabled={importing} onClick={() => { setImportOpen(false); setAuthUrl(""); }}>×</button></div>
          <div className="experimental"><strong>實驗性功能</strong><p>本站會在你的瀏覽器中直接向 Riot 讀取造型收藏；不會上傳、記錄或儲存驗證網址與登入資料。</p></div>
          <ol className="auth-steps"><li><a href={RIOT_LOGIN_URL} target="_blank" rel="noopener noreferrer">開啟 Riot 官方登入頁 ↗</a>，完成登入。</li><li>登入後畫面可能顯示錯誤頁，這是正常的。複製瀏覽器網址列中的<strong>完整網址</strong>。</li><li>貼到下方欄位，選擇帳號分區後按「開始匯入」。</li></ol>
          <label className="auth-field">驗證網址<textarea id="auth_token_input" value={authUrl} onChange={(event) => setAuthUrl(event.target.value)} placeholder="https://playvalorant.com/opt_in#access_token=…" autoComplete="off" spellCheck={false} /></label>
          <div className="import-options"><label>帳號分區<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="ap">亞太 AP（台灣）</option><option value="na">北美 NA</option><option value="eu">歐洲 EU</option><option value="kr">韓國 KR</option><option value="br">巴西 BR</option><option value="latam">拉丁美洲 LATAM</option></select></label><label className="check-row"><input id="only_skin_input" type="checkbox" checked={onlyEffects} onChange={(event) => setOnlyEffects(event.target.checked)} /><span>僅匯入特效槍皮</span></label></div>
          {importStatus && <div className={`import-status ${importStatus.startsWith("完成") ? "success" : ""}`}>{importStatus}</div>}
          <button id="verify_auth_button" className="primary-wide" disabled={importing || !authUrl.trim()} onClick={() => void importOwnedSkins()}>{importing ? <><span className="spinner" />匯入中，請勿關閉…</> : "開始匯入"}</button>
          <p className="token-note">安全提醒：驗證網址等同短效登入憑證，請勿貼給任何人。若離開此視窗，欄位內容會立即清除。</p>
        </section>
      </div>}

      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
