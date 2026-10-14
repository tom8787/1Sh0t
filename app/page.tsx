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
import { AlignCenterHorizontal, ArrowDown, ArrowUp, ArrowsClockwise, ArrowsOutSimple, Check, Copy, DownloadSimple, FolderSimple, Image as ImageIcon, MagnifyingGlass, Minus, Plus, SlidersHorizontal, TextT, Trash, UploadSimple, Wrench, X } from "@phosphor-icons/react";
import { BRAND_BACKGROUND_URL, BRAND_LOGO_URL, COLLECTION_FRAME_URL, arrangeCollectionItems, drawBrandBackground, drawCollectionFrame, readBrandSettings, type BrandSettings } from "./brand-canvas";

type AssetType = "rifle" | "sniper" | "sidearm" | "melee" | "bundle" | "card" | "charm" | "image" | "text";
type CatalogCategory = "all" | "weapons" | "bundle" | "card" | "charm";

type LibraryAsset = {
  id: string;
  name: string;
  type: AssetType;
  label: string;
  colors: [string, string, string];
  imageUrl?: string;
  weaponId?: string;
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
  layoutPage?: number;
};

type LayoutMode = "single" | "long" | "pages";

type SelectionRect = { x: number; y: number; w: number; h: number };

type LayoutResult = {
  items: SceneItem[];
  height: number;
  pages: number;
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
  uuid: string;
  displayName: string;
  category: string;
  skins: ValorantSkin[];
};

type UtilityTab = "overview" | "store" | "stats";

type WalletBalance = {
  vp: number;
  rp: number;
  kc: number;
};

type StoreOffer = {
  id: string;
  name: string;
  weapon: string;
  imageUrl?: string;
  price: number;
};

type RankSummary = {
  tier: string;
  tierNumber: number;
  rr: number;
  wins: number;
  games: number;
  imageUrl?: string;
};

type MatchSummary = {
  id: string;
  result: "勝利" | "敗北" | "平手";
  score: string;
  mode: string;
  agent: string;
  agentImageUrl?: string;
  kills: number;
  deaths: number;
  assists: number;
  playedAt: number;
};

const W = 1200;
const H = 760;
const DEFAULT_THEME_UUID = "5a629df4-4765-0214-bd40-fbb96542941f";
const CLIENT_PLATFORM = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQ1LjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
const RIOT_LOGIN_URL = "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";
const CURRENCY_IDS = {
  vp: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  rp: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kc: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
};

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
  } else {
    ctx.fillStyle = "#8f9aaa";
    ctx.font = '14px Arial, "Noto Sans TC", sans-serif';
    ctx.fillText("圖片載入中", 0, item.h / 2);
  }

  if (selected) {
    ctx.strokeStyle = "#3985ef";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    roundedRect(ctx, -7, -7, item.w + 14, item.h + 14, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#3985ef";
    ctx.fillRect(item.w - 3, item.h - 3, 12, 12);
  }
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  items: SceneItem[],
  selectedIds: string[],
  vp: string,
  rp: string,
  kc: string,
  height: number,
  bgImage?: HTMLImageElement,
  images?: Map<string, HTMLImageElement>,
  selectionRect?: SelectionRect | null,
  brandLogo?: HTMLImageElement,
  brandSettings?: BrandSettings,
  transparentBackground = false,
  framedBackground = false,
) {
  ctx.clearRect(0, 0, W, height);
  if (brandSettings) drawBrandBackground(ctx, W, height, H, brandLogo, brandSettings);
  if (bgImage) {
    if (!framedBackground) drawCoverImage(ctx, bgImage, W, height);
  } else {
    // A missing/transparent background must remain transparent in the exported PNG.
  }
  if (framedBackground && brandSettings) drawCollectionFrame(ctx, W, height, H, brandSettings);
  if (brandSettings?.showMetadata) {
    ctx.shadowColor = "rgba(0,0,0,.82)";
    ctx.shadowBlur = 10;
    ctx.textAlign = "right";
    ctx.fillStyle = transparentBackground ? "#53647a" : "#d7e8ef";
    ctx.font = "700 18px Arial, sans-serif";
    ctx.fillText(`VP  ${vp || "0"}     RP  ${rp || "0"}     KC  ${kc || "0"}`, W - 40, 52);
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;

    const weaponGroups = new Map<string, { y: number; count: number; minHeight: number }>();
    items.filter(isWeaponItem).forEach((item) => {
      const current = weaponGroups.get(item.label);
      weaponGroups.set(item.label, {
        y: Math.min(current?.y ?? item.y, item.y),
        count: (current?.count || 0) + 1,
        minHeight: Math.min(current?.minHeight ?? item.h, item.h),
      });
    });
    weaponGroups.forEach((group, label) => {
      const fontSize = Math.max(7, Math.min(12, group.minHeight * .22));
      const labelY = Math.max(22, group.y - Math.max(5, fontSize + 4));
      ctx.fillStyle = transparentBackground ? "#64748b" : "#c5cfdd";
      ctx.font = `800 ${fontSize}px Arial, "Noto Sans TC", sans-serif`;
      ctx.fillText(`${label} · ${group.count} 個造型`, 34, labelY);
    });
  }

  const selectedSet = new Set(selectedIds);
  items.forEach((item) => drawItem(ctx, item, selectedSet.has(item.uid), images?.get(item.uid)));
  if (selectionRect) {
    ctx.save();
    ctx.fillStyle = "rgba(57,133,239,.12)";
    ctx.strokeStyle = "#3985ef";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    ctx.restore();
  }
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

function queueLabel(queueId: string) {
  const labels: Record<string, string> = {
    competitive: "競技模式",
    unrated: "一般模式",
    swiftplay: "超速衝點",
    spikerush: "超激進戰",
    deathmatch: "死鬥模式",
    teamdeathmatch: "團隊死鬥",
    escalation: "戰慄模式",
    replication: "複製亂戰",
  };
  return labels[queueId] || queueId || "其他模式";
}

function remainingLabel(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours} 小時 ${minutes} 分`;
}

function isWeaponItem(item: SceneItem) {
  return ["rifle", "sniper", "sidearm", "melee"].includes(item.type);
}

function arrangeGroupedItems(sceneItems: SceneItem[], mode: LayoutMode): LayoutResult {
  return arrangeCollectionItems(sceneItems, mode);
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

function savedLayoutMode(): LayoutMode {
  if (typeof window === "undefined") return "single";
  const saved = localStorage.getItem("loadout-lab-layout-mode");
  return saved === "long" || saved === "pages" ? saved : "single";
}

function savedCanvasHeight() {
  if (typeof window === "undefined") return H;
  return Math.max(H, Number(localStorage.getItem("loadout-lab-canvas-height") || H));
}

function savedWallet() {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem("loadout-lab-wallet") || "null") as (WalletBalance & { updatedAt?: number }) | null;
    return saved && [saved.vp, saved.rp, saved.kc].every(Number.isFinite) ? saved : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const libraryScrollRef = useRef<HTMLDivElement>(null);
  const bgImageRef = useRef<HTMLImageElement | undefined>(undefined);
  const brandLogoRef = useRef<HTMLImageElement | undefined>(undefined);
  const [brandSettings, setBrandSettings] = useState(readBrandSettings);
  const [frameColorDraft, setFrameColorDraft] = useState(() => readBrandSettings().frameColor);
  const [brandError, setBrandError] = useState("");
  const [libraryTab, setLibraryTab] = useState<"assets" | "background">("assets");
  const imageRefs = useRef(new Map<string, HTMLImageElement>());
  const loadingImages = useRef(new Set<string>());
  const catalogRef = useRef<LibraryAsset[]>([]);
  const uidSequence = useRef(0);
  const dragRef = useRef<{
    mode: "move" | "resize" | "marquee";
    startX: number;
    startY: number;
    ids: string[];
    origins: { uid: string; x: number; y: number; w: number; h: number }[];
    baseSelection: string[];
  } | null>(null);

  const [items, setItems] = useState<SceneItem[]>(() => {
    const savedItems = savedScene();
    const needsLayoutMigration = typeof window !== "undefined" && localStorage.getItem("1shot-slot-layout-version") !== "1";
    return needsLayoutMigration ? arrangeGroupedItems(savedItems, savedLayoutMode()).items : savedItems;
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const setSelected = useCallback((uid: string | null) => setSelectedIds(uid ? [uid] : []), []);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(savedLayoutMode);
  const [canvasHeight, setCanvasHeight] = useState(() => {
    const savedItems = savedScene();
    const needsLayoutMigration = typeof window !== "undefined" && localStorage.getItem("1shot-slot-layout-version") !== "1";
    return needsLayoutMigration ? arrangeGroupedItems(savedItems, savedLayoutMode()).height : savedCanvasHeight();
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [catalog, setCatalog] = useState<LibraryAsset[]>([]);
  const [category, setCategory] = useState<CatalogCategory>("all");
  const [search, setSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [visibleCount, setVisibleCount] = useState(80);
  const [vp, setVp] = useState(() => String(savedWallet()?.vp ?? 475));
  const [rp, setRp] = useState(() => String(savedWallet()?.rp ?? 90));
  const [kc, setKc] = useState(() => String(savedWallet()?.kc ?? 0));
  const [bgUrl, setBgUrl] = useState(COLLECTION_FRAME_URL);
  const [newText, setNewText] = useState("");
  const [toast, setToast] = useState("");
  const [lastExport, setLastExport] = useState<{ url: string; filename: string; format: "PNG" | "ZIP"; items: SceneItem[]; settings: BrandSettings; background: string; mode: LayoutMode; page: number } | null>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const [onlyEffects, setOnlyEffects] = useState(true);
  const [region, setRegion] = useState("ap");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [activePage, setActivePage] = useState<"editor" | "tools">(() => typeof window !== "undefined" && window.location.hash === "#/tools" ? "tools" : "editor");
  const [toolsTab, setToolsTab] = useState<UtilityTab>("overview");
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [toolsStatus, setToolsStatus] = useState("");
  const [accountName, setAccountName] = useState("我的 Riot 帳號");
  const [wallet, setWallet] = useState<WalletBalance>(() => savedWallet() || { vp: 0, rp: 0, kc: 0 });
  const [lastUpdated, setLastUpdated] = useState(() => savedWallet()?.updatedAt || 0);
  const [storeOffers, setStoreOffers] = useState<StoreOffer[]>([]);
  const [storeRemaining, setStoreRemaining] = useState(0);
  const [storeError, setStoreError] = useState("");
  const [rankSummary, setRankSummary] = useState<RankSummary | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchSummary[]>([]);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const applyWalletBalance = useCallback((nextWallet: WalletBalance) => {
    const updatedAt = Date.now();
    setWallet(nextWallet);
    setVp(String(nextWallet.vp));
    setRp(String(nextWallet.rp));
    setKc(String(nextWallet.kc));
    setLastUpdated(updatedAt);
    localStorage.setItem("loadout-lab-wallet", JSON.stringify({ ...nextWallet, updatedAt }));
  }, []);

  const syncWalletFromStorage = useCallback(() => {
    const saved = savedWallet();
    if (!saved) return;
    setWallet({ vp: saved.vp, rp: saved.rp, kc: saved.kc });
    setVp(String(saved.vp));
    setRp(String(saved.rp));
    setKc(String(saved.kc));
    setLastUpdated(saved.updatedAt || 0);
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
            weaponId: weapon.uuid,
            colors: colorsFromId(skin.uuid),
            imageUrl: skin.chromas?.find((chroma) => chroma.fullRender)?.fullRender || skin.levels?.find((level) => level.displayIcon)?.displayIcon || skin.displayIcon || undefined,
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
      const currentImages = new Map(all.map((asset) => [asset.id, asset.imageUrl]));
      setItems((previous) => previous.map((item) => {
        const currentImage = currentImages.get(item.id);
        return currentImage && currentImage !== item.imageUrl ? { ...item, imageUrl: currentImage } : item;
      }));
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
    const timer = window.setTimeout(() => void loadCatalog().catch(() => undefined), 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  useEffect(() => {
    if (libraryScrollRef.current) libraryScrollRef.current.scrollTop = 0;
  }, [search, category]);

  useEffect(() => {
    const persistentItems = items.filter((item) => !item.imageUrl?.startsWith("blob:"));
    localStorage.setItem("loadout-lab-scene", JSON.stringify(persistentItems));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("loadout-lab-layout-mode", layoutMode);
    localStorage.setItem("loadout-lab-canvas-height", String(canvasHeight));
    localStorage.setItem("1shot-slot-layout-version", "1");
  }, [layoutMode, canvasHeight]);

  useEffect(() => {
    localStorage.setItem("1shot-brand-settings", JSON.stringify(brandSettings));
  }, [brandSettings]);

  useEffect(() => () => {
    if (lastExport?.url.startsWith("blob:")) URL.revokeObjectURL(lastExport.url);
  }, [lastExport]);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      brandLogoRef.current = image;
      setBrandError("");
      setImageRevision((value) => value + 1);
    };
    image.onerror = () => { if (active) setBrandError("Logo 載入失敗，請重新整理頁面。"); };
    image.src = BRAND_LOGO_URL;
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    bgImageRef.current = undefined;
    if (bgUrl === COLLECTION_FRAME_URL) return;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      bgImageRef.current = image;
      setImageRevision((value) => value + 1);
      if (bgUrl.startsWith("blob:")) flash("背景已更新");
    };
    image.onerror = () => { if (active) flash("背景圖片無法讀取，請換一張圖片或恢復透明背景。"); };
    image.src = bgUrl;
    return () => { active = false; if (bgUrl.startsWith("blob:")) URL.revokeObjectURL(bgUrl); };
  }, [bgUrl, flash]);

  useEffect(() => {
    const syncPage = () => {
      const nextPage = window.location.hash === "#/tools" ? "tools" : "editor";
      setActivePage(nextPage);
      if (nextPage === "editor") syncWalletFromStorage();
    };
    const syncStoredWallet = (event: StorageEvent) => {
      if (event.key === "loadout-lab-wallet") syncWalletFromStorage();
    };
    const syncVisibleWallet = () => {
      if (document.visibilityState === "visible") syncWalletFromStorage();
    };
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("storage", syncStoredWallet);
    window.addEventListener("focus", syncWalletFromStorage);
    document.addEventListener("visibilitychange", syncVisibleWallet);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("storage", syncStoredWallet);
      window.removeEventListener("focus", syncWalletFromStorage);
      document.removeEventListener("visibilitychange", syncVisibleWallet);
    };
  }, [syncWalletFromStorage]);

  useEffect(() => {
    if (!toolsLoaded || storeRemaining <= 0) return;
    const timer = window.setInterval(() => setStoreRemaining((value) => Math.max(0, value - 60)), 60_000);
    return () => window.clearInterval(timer);
  }, [toolsLoaded, storeRemaining]);

  useEffect(() => {
    const liveIds = new Set(items.map((item) => item.uid));
    for (const id of imageRefs.current.keys()) if (!liveIds.has(id)) imageRefs.current.delete(id);
    items.forEach((item) => {
      const cachedImage = imageRefs.current.get(item.uid);
      if (!item.imageUrl || cachedImage?.src === item.imageUrl || loadingImages.current.has(item.uid)) return;
      if (cachedImage) imageRefs.current.delete(item.uid);
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

  const recentInsights = useMemo(() => {
    const matches = recentMatches.length;
    const wins = recentMatches.filter((match) => match.result === "勝利").length;
    const kills = recentMatches.reduce((total, match) => total + match.kills, 0);
    const deaths = recentMatches.reduce((total, match) => total + match.deaths, 0);
    const assists = recentMatches.reduce((total, match) => total + match.assists, 0);
    const agentCounts = recentMatches.reduce<Record<string, number>>((counts, match) => {
      counts[match.agent] = (counts[match.agent] || 0) + 1;
      return counts;
    }, {});
    const favoriteAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "暫無資料";
    return {
      winRate: matches ? Math.round(wins / matches * 100) : 0,
      kd: deaths ? (kills / deaths).toFixed(2) : kills.toFixed(2),
      averageKda: matches ? `${(kills / matches).toFixed(1)} / ${(deaths / matches).toFixed(1)} / ${(assists / matches).toFixed(1)}` : "— / — / —",
      favoriteAgent,
    };
  }, [recentMatches]);

  const pageCount = useMemo(() => layoutMode === "pages"
    ? Math.max(1, ...items.map((item) => (item.layoutPage || 0) + 1))
    : 1, [items, layoutMode]);
  const visibleItems = useMemo(() => layoutMode === "pages"
    ? items.filter((item) => (item.layoutPage || 0) === currentPage)
    : items, [items, layoutMode, currentPage]);
  const selectedItems = items.filter((item) => selectedIds.includes(item.uid));
  const current = selectedItems[0];
  const canOutline = Boolean(selectedItems.length && selectedItems.every((item) => item.imageUrl && ["rifle", "sniper", "sidearm", "melee"].includes(item.type)));
  const selectionBounds = selectedItems.length ? {
    x: Math.min(...selectedItems.map((item) => item.x)),
    y: Math.min(...selectedItems.map((item) => item.y)),
    right: Math.max(...selectedItems.map((item) => item.x + item.w)),
    bottom: Math.max(...selectedItems.map((item) => item.y + item.h)),
  } : null;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, visibleItems, selectedIds, vp, rp, kc, canvasHeight, bgImageRef.current, imageRefs.current, selectionRect, brandLogoRef.current, brandSettings, bgUrl === BRAND_BACKGROUND_URL || bgUrl === COLLECTION_FRAME_URL, bgUrl === COLLECTION_FRAME_URL);
  }, [visibleItems, selectedIds, vp, rp, kc, bgUrl, imageRevision, canvasHeight, selectionRect, brandSettings, activePage]);

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
    const item: SceneItem = { ...asset, uid: `${asset.id}-${uidSequence.current}`, ...p, rotation: 0, layoutPage: currentPage };
    if (isWeaponItem(item)) {
      const arranged = arrangeGroupedItems([...items, item], layoutMode);
      setItems(arranged.items);
      setCanvasHeight(arranged.height);
      setCurrentPage(arranged.items.find((entry) => entry.uid === item.uid)?.layoutPage || 0);
    } else setItems((previous) => [...previous, item]);
    setSelected(item.uid);
    flash(`${asset.name} ${isWeaponItem(item) ? "已加入對應框格" : "已加入畫布"}`);
  };

  const addText = (preset?: string) => {
    const value = (preset || newText).trim();
    if (!value) return flash("請先輸入文字");
    uidSequence.current += 1;
    const item: SceneItem = {
      id: `text-${uidSequence.current}`, uid: `text-${uidSequence.current}`, name: value, text: value, type: "text", label: "自訂文字",
      colors: ["#ffffff", "#ffffff", "#ffffff"], textColor: "#243044", fontSize: 42,
      x: 430, y: 600, w: Math.min(520, Math.max(180, value.length * 48)), h: 64, rotation: 0, layoutPage: currentPage,
    };
    setItems((previous) => [...previous, item]);
    setSelected(item.uid);
    setNewText("");
    flash("文字已加入畫布");
  };

  const updateCurrent = (patch: Partial<SceneItem>) => setItems((previous) => previous.map((item) => selectedIds.includes(item.uid) ? { ...item, ...patch } : item));
  const deleteCurrent = () => {
    if (!selectedIds.length) return;
    setItems((previous) => previous.filter((item) => !selectedIds.includes(item.uid)));
    setSelected(null);
    flash(`已刪除 ${selectedIds.length} 個選取項目`);
  };
  const duplicateCurrent = () => {
    if (!selectedItems.length) return;
    const clones = selectedItems.map((item) => {
      uidSequence.current += 1;
      return { ...item, uid: `${item.id}-${uidSequence.current}`, x: item.x + 24, y: item.y + 24 };
    });
    setItems((previous) => [...previous, ...clones]);
    setSelectedIds(clones.map((item) => item.uid));
  };

  const arrangeCollection = () => {
    const arranged = arrangeGroupedItems(items, layoutMode);
    setItems(arranged.items);
    setCanvasHeight(arranged.height);
    setCurrentPage(0);
    setSelected(null);
    flash("已放入各武器的對應框格");
  };

  const changeLayoutMode = (mode: LayoutMode) => {
    const arranged = arrangeGroupedItems(items, mode);
    setLayoutMode(mode);
    setItems(arranged.items);
    setCanvasHeight(arranged.height);
    setCurrentPage(0);
    setSelected(null);
    flash(mode === "single" ? "已切換單張模式" : mode === "long" ? "已切換長圖模式" : `已切換多頁模式，共 ${arranged.pages} 頁`);
  };

  const scaleSelection = (factor: number) => {
    if (!selectionBounds) return;
    const centerX = (selectionBounds.x + selectionBounds.right) / 2;
    const centerY = (selectionBounds.y + selectionBounds.bottom) / 2;
    setItems((previous) => previous.map((item) => selectedIds.includes(item.uid) ? {
      ...item,
      x: centerX + (item.x - centerX) * factor,
      y: centerY + (item.y - centerY) * factor,
      w: Math.max(24, item.w * factor),
      h: Math.max(16, item.h * factor),
    } : item));
  };

  const alignSelection = () => {
    if (!selectedItems.length) return;
    const ordered = [...selectedItems].sort((a, b) => a.x - b.x);
    const startX = Math.max(12, Math.min(...ordered.map((item) => item.x)));
    const commonY = Math.max(88, Math.min(...ordered.map((item) => item.y)));
    let cursor = startX;
    const aligned = new Map<string, { x: number; y: number }>();
    ordered.forEach((item) => {
      if (cursor + item.w > W - 12) cursor = 12;
      aligned.set(item.uid, { x: cursor, y: commonY });
      cursor += item.w + 8;
    });
    setItems((previous) => previous.map((item) => aligned.has(item.uid) ? { ...item, ...aligned.get(item.uid)! } : item));
    flash("選取造型已水平對齊");
  };

  const bringSelectionToFront = () => setItems((previous) => [
    ...previous.filter((item) => !selectedIds.includes(item.uid)),
    ...previous.filter((item) => selectedIds.includes(item.uid)),
  ]);

  const toggleSelectionOutline = () => {
    if (!canOutline) return;
    const enable = !selectedItems.every((item) => item.outlineEnabled);
    updateCurrent({ outlineEnabled: enable, outlineColor: current?.outlineColor || "#f3a3b4", outlineWidth: current?.outlineWidth || 10 });
  };

  const openLibrary = () => {
    setLibraryTab("assets");
    if (window.innerWidth <= 800) setLibraryOpen(true);
    void loadCatalog().catch(() => undefined);
  };

  const openImport = () => {
    setImportStatus("");
    setImportOpen(true);
  };

  const coords = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * canvasHeight / rect.height };
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = coords(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const hit = [...visibleItems].reverse().find((item) => point.x >= item.x - 8 && point.x <= item.x + item.w + 8 && point.y >= item.y - 8 && point.y <= item.y + item.h + 8);
    if (!hit) {
      if (!event.shiftKey) setSelectedIds([]);
      setSelectionRect({ x: point.x, y: point.y, w: 0, h: 0 });
      dragRef.current = { mode: "marquee", startX: point.x, startY: point.y, ids: [], origins: [], baseSelection: event.shiftKey ? selectedIds : [] };
      return;
    }

    let nextSelected = selectedIds;
    if (event.shiftKey) {
      nextSelected = selectedIds.includes(hit.uid) ? selectedIds.filter((uid) => uid !== hit.uid) : [...selectedIds, hit.uid];
      setSelectedIds(nextSelected);
      if (!nextSelected.includes(hit.uid)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
    } else if (!selectedIds.includes(hit.uid)) {
      nextSelected = [hit.uid];
      setSelectedIds(nextSelected);
    }
    const resize = nextSelected.length === 1 && Math.abs(point.x - (hit.x + hit.w)) < 28 && Math.abs(point.y - (hit.y + hit.h)) < 28;
    const origins = items.filter((item) => nextSelected.includes(item.uid)).map((item) => ({ uid: item.uid, x: item.x, y: item.y, w: item.w, h: item.h }));
    dragRef.current = { mode: resize ? "resize" : "move", startX: point.x, startY: point.y, ids: nextSelected, origins, baseSelection: [] };
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const point = coords(event);
    const drag = dragRef.current;
    if (drag.mode === "marquee") {
      setSelectionRect({ x: Math.min(drag.startX, point.x), y: Math.min(drag.startY, point.y), w: Math.abs(point.x - drag.startX), h: Math.abs(point.y - drag.startY) });
      return;
    }
    const dxRaw = point.x - drag.startX;
    const dyRaw = point.y - drag.startY;
    if (drag.mode === "resize") {
      const origin = drag.origins[0];
      setItems((previous) => previous.map((item) => item.uid === origin.uid ? { ...item, w: Math.max(38, origin.w + dxRaw), h: Math.max(22, origin.h + dyRaw) } : item));
      return;
    }
    const minX = Math.min(...drag.origins.map((item) => item.x));
    const minY = Math.min(...drag.origins.map((item) => item.y));
    const maxRight = Math.max(...drag.origins.map((item) => item.x + item.w));
    const maxBottom = Math.max(...drag.origins.map((item) => item.y + item.h));
    const dx = Math.max(-minX, Math.min(W - maxRight, dxRaw));
    const dy = Math.max(-minY, Math.min(canvasHeight - maxBottom, dyRaw));
    const origins = new Map(drag.origins.map((item) => [item.uid, item]));
    setItems((previous) => previous.map((item) => {
      const origin = origins.get(item.uid);
      return origin ? { ...item, x: origin.x + dx, y: origin.y + dy } : item;
    }));
  };
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.mode === "marquee" && selectionRect) {
      const matches = visibleItems.filter((item) => item.x < selectionRect.x + selectionRect.w && item.x + item.w > selectionRect.x && item.y < selectionRect.y + selectionRect.h && item.y + item.h > selectionRect.y).map((item) => item.uid);
      setSelectedIds([...new Set([...drag.baseSelection, ...matches])]);
    }
    if (dragRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setSelectionRect(null);
  };

  const loadBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgUrl(url);
    event.target.value = "";
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
        x: 450, y: 220, w, h, rotation: 0, imageUrl: url, layoutPage: currentPage,
      };
      setItems((previous) => [...previous, item]);
      setSelected(uid);
      flash("自訂圖片已加入");
    };
    image.src = url;
  };

  const renderExportCanvas = (page = currentPage) => {
    if ((brandSettings.enabled && !brandLogoRef.current) || (bgUrl !== COLLECTION_FRAME_URL && !bgImageRef.current) || loadingImages.current.size) throw new Error("圖片仍在載入");
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = layoutMode === "long" ? canvasHeight : H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法建立匯出畫布");
    const exportItems = layoutMode === "pages" ? items.filter((item) => (item.layoutPage || 0) === page) : items;
    if (exportItems.some((item) => item.imageUrl && !imageRefs.current.has(item.uid))) throw new Error("素材圖片尚未載入完成");
    drawScene(ctx, exportItems, [], vp, rp, kc, canvas.height, bgImageRef.current, imageRefs.current, null, brandLogoRef.current, brandSettings, bgUrl === BRAND_BACKGROUND_URL || bgUrl === COLLECTION_FRAME_URL, bgUrl === COLLECTION_FRAME_URL);
    return canvas;
  };

  const exportPng = () => {
    try {
      const canvas = renderExportCanvas();
      const link = document.createElement("a");
      link.download = `1Sh0t-收藏-${layoutMode === "pages" ? `第${currentPage + 1}頁-` : ""}${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      setLastExport({ url: link.href, filename: link.download, format: "PNG", items, settings: brandSettings, background: bgUrl, mode: layoutMode, page: currentPage });
      link.click();
      flash(layoutMode === "pages" ? `第 ${currentPage + 1} 頁 PNG 已匯出` : "高畫質 PNG 已匯出");
    } catch {
      flash("圖片仍在載入，請稍後再匯出");
    }
  };

  const exportAllPages = async () => {
    if (layoutMode !== "pages") return exportPng();
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let page = 0; page < pageCount; page += 1) {
        const canvas = renderExportCanvas(page);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 建立失敗")), "image/png"));
        zip.file(`1Sh0t-收藏-第${page + 1}頁.png`, blob);
      }
      const archive = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `1Sh0t-收藏-全部頁面-${new Date().toISOString().slice(0, 10)}.zip`;
      link.href = URL.createObjectURL(archive);
      setLastExport({ url: link.href, filename: link.download, format: "ZIP", items, settings: brandSettings, background: bgUrl, mode: layoutMode, page: currentPage });
      link.click();
      flash(`已匯出 ${pageCount} 頁 ZIP`);
    } catch {
      flash("多頁匯出失敗，請稍後再試");
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
      const riotHeaders = {
        Authorization: `Bearer ${accessToken}`,
        "X-Riot-Entitlements-JWT": entitlementToken,
        "X-Riot-ClientVersion": versionJson.data.riotClientVersion,
        "X-Riot-ClientPlatform": CLIENT_PLATFORM,
      };
      const pdHost = `https://pd.${region}.a.pvp.net`;
      const [inventoryResponse, importWalletResponse] = await Promise.all([
        fetch(`${pdHost}/store/v1/entitlements/${encodeURIComponent(puuid)}`, { headers: riotHeaders }),
        fetch(`${pdHost}/store/v1/wallet/${encodeURIComponent(puuid)}`, { headers: riotHeaders }).catch(() => new Response(null, { status: 503 })),
      ]);
      if (!inventoryResponse.ok) {
        if ([401, 403].includes(inventoryResponse.status)) throw new Error("Riot 驗證失敗，網址可能已過期，請重新登入。");
        throw new Error("無法讀取收藏。請確認分區是否正確，再重新嘗試。");
      }
      const inventory = await inventoryResponse.json();
      if (importWalletResponse.ok) {
        const walletJson = await importWalletResponse.json() as { Balances?: Record<string, number> };
        const balances = walletJson.Balances || {};
        applyWalletBalance({
          vp: Number(balances[CURRENCY_IDS.vp] || 0),
          rp: Number(balances[CURRENCY_IDS.rp] || 0),
          kc: Number(balances[CURRENCY_IDS.kc] || 0),
        });
      }
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

      uidSequence.current += matches.length;
      const firstImportedSequence = uidSequence.current - matches.length + 1;
      const imported: SceneItem[] = matches.map((asset, index) => ({
        ...asset,
        uid: `riot-${asset.id}-${firstImportedSequence + index}`,
        x: 0,
        y: 0,
        w: 100,
        h: 60,
        rotation: 0,
      }));
      const arrangedImport = arrangeGroupedItems([...items, ...imported], layoutMode);
      setItems(arrangedImport.items);
      setCanvasHeight(arrangedImport.height);
      setCurrentPage(0);
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

  const loadUtilityData = async () => {
    if (!authUrl.trim()) return setToolsStatus("請先貼上 Riot 登入完成後的完整網址。");
    setToolsLoading(true);
    setToolsStatus("正在驗證 Riot 帳號…");
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
      const versionResponse = await fetch("https://valorant-api.com/v1/version");
      if (!versionResponse.ok) throw new Error("暫時無法確認遊戲版本，請稍後再試。");
      const versionJson = await versionResponse.json();
      const riotHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "X-Riot-Entitlements-JWT": entitlements.entitlements_token,
        "X-Riot-ClientVersion": versionJson.data.riotClientVersion,
        "X-Riot-ClientPlatform": CLIENT_PLATFORM,
      };

      setToolsStatus("正在讀取每日商城、段位與近期戰績…");
      const pdHost = `https://pd.${region}.a.pvp.net`;
      const storefrontPromise = (async () => {
        try {
          const currentResponse = await fetch(`${pdHost}/store/v3/storefront/${encodeURIComponent(puuid)}`, {
            method: "POST",
            headers: { ...riotHeaders, "Content-Type": "application/json" },
            body: "{}",
          });
          if (currentResponse.ok) return currentResponse;
        } catch {
          // Some Riot regions may still require the legacy storefront endpoint.
        }
        return fetch(`${pdHost}/store/v2/storefront/${encodeURIComponent(puuid)}`, { headers: riotHeaders });
      })();
      const [storefrontResponse, walletResponse, mmrResponse, historyResponse] = await Promise.all([
        storefrontPromise,
        fetch(`${pdHost}/store/v1/wallet/${encodeURIComponent(puuid)}`, { headers: riotHeaders }),
        fetch(`${pdHost}/mmr/v1/players/${encodeURIComponent(puuid)}`, { headers: riotHeaders }),
        fetch(`${pdHost}/match-history/v1/history/${encodeURIComponent(puuid)}?startIndex=0&endIndex=5`, { headers: riotHeaders }),
      ]);
      if ([storefrontResponse, walletResponse, mmrResponse, historyResponse].every((response) => !response.ok)) {
        throw new Error("無法讀取帳號資料。請確認帳號分區是否正確，再重新嘗試。");
      }

      const optionalJson = async (url: string) => {
        try {
          const response = await fetch(url);
          return response.ok ? response.json() : { data: [] };
        } catch {
          return { data: [] };
        }
      };
      const [allCatalog, seasonsJson, tiersJson, agentsJson] = await Promise.all([
        loadCatalog().catch(() => [] as LibraryAsset[]),
        optionalJson("https://valorant-api.com/v1/seasons?language=zh-TW"),
        optionalJson("https://valorant-api.com/v1/competitivetiers?language=zh-TW"),
        optionalJson("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=zh-TW"),
      ]);

      let storefrontLoaded = false;
      if (storefrontResponse.ok) {
        const storefront = await storefrontResponse.json() as {
          SkinsPanelLayout?: {
            SingleItemOffers?: string[];
            SingleItemStoreOffers?: { OfferID?: string; Cost?: Record<string, number> }[];
            SingleItemOffersRemainingDurationInSeconds?: number;
          };
          Offers?: { OfferID?: string; Cost?: Record<string, number> }[];
        };
        const panel = storefront.SkinsPanelLayout;
        const detailedOffers = [...(panel?.SingleItemStoreOffers || []), ...(storefront.Offers || [])];
        const offerIds = panel?.SingleItemOffers || detailedOffers.map((offer) => offer.OfferID || "").filter(Boolean);
        storefrontLoaded = offerIds.length > 0;
        setStoreOffers(offerIds.map((offerId) => {
          const id = offerId.toLowerCase();
          const asset = allCatalog.find((entry) => entry.levelIds?.includes(id));
          const details = detailedOffers.find((offer) => offer.OfferID?.toLowerCase() === id);
          return {
            id,
            name: asset?.name || "未知造型",
            weapon: asset?.label || "武器造型",
            imageUrl: asset?.imageUrl,
            price: Number(Object.values(details?.Cost || {})[0] || 0),
          };
        }));
        setStoreRemaining(Number(panel?.SingleItemOffersRemainingDurationInSeconds || 0));
        setStoreError(storefrontLoaded ? "" : "商城已連線，但沒有收到今天的造型資料；請稍後重新驗證更新。");
      } else {
        setStoreOffers([]);
        setStoreRemaining(0);
        setStoreError(`Riot 商城暫時無法讀取（狀態 ${storefrontResponse.status}），請重新登入後再試。`);
      }

      if (walletResponse.ok) {
        const walletJson = await walletResponse.json() as { Balances?: Record<string, number> };
        const balances = walletJson.Balances || {};
        const nextWallet = {
          vp: Number(balances[CURRENCY_IDS.vp] || 0),
          rp: Number(balances[CURRENCY_IDS.rp] || 0),
          kc: Number(balances[CURRENCY_IDS.kc] || 0),
        };
        applyWalletBalance(nextWallet);
      } else {
        setWallet({ vp: 0, rp: 0, kc: 0 });
      }

      if (mmrResponse.ok) {
        const mmr = await mmrResponse.json() as {
          QueueSkills?: { competitive?: { SeasonalInfoBySeasonID?: Record<string, {
            CompetitiveTier?: number;
            Rank?: number;
            RankedRating?: number;
            NumberOfWins?: number;
            NumberOfGames?: number;
          }> } };
        };
        const seasonal = mmr.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
        const acts = ((seasonsJson.data || []) as { uuid: string; type?: string; startTime?: string }[])
          .filter((season) => season.type?.includes("Act"))
          .sort((a, b) => Date.parse(b.startTime || "") - Date.parse(a.startTime || ""));
        const seasonalValues = Object.values(seasonal);
        const currentSeason = acts.map((act) => seasonal[act.uuid]).find(Boolean) || seasonalValues[seasonalValues.length - 1];
        const tierNumber = Number(currentSeason?.CompetitiveTier ?? currentSeason?.Rank ?? 0);
        const tierSets = (tiersJson.data || []) as { tiers?: { tier: number; tierName: string; largeIcon?: string }[] }[];
        const tierMeta = [...tierSets].reverse().flatMap((set) => set.tiers || []).find((tier) => tier.tier === tierNumber);
        setRankSummary({
          tier: tierMeta?.tierName || (tierNumber ? `階級 ${tierNumber}` : "尚未定級"),
          tierNumber,
          rr: Number(currentSeason?.RankedRating || 0),
          wins: Number(currentSeason?.NumberOfWins || 0),
          games: Number(currentSeason?.NumberOfGames || 0),
          imageUrl: tierMeta?.largeIcon,
        });
      } else {
        setRankSummary(null);
      }

      if (historyResponse.ok) {
        const historyJson = await historyResponse.json() as { History?: { MatchID: string; GameStartTime?: number; QueueID?: string }[] };
        const history = (historyJson.History || []).slice(0, 5);
        const details = await Promise.all(history.map(async (entry) => {
          const response = await fetch(`${pdHost}/match-details/v1/matches/${encodeURIComponent(entry.MatchID)}`, { headers: riotHeaders });
          return response.ok ? response.json() : null;
        }));
        const agentMap = new Map<string, { displayName: string; displayIcon?: string }>(
          ((agentsJson.data || []) as { uuid: string; displayName: string; displayIcon?: string }[])
            .map((agent) => [agent.uuid.toLowerCase(), { displayName: agent.displayName, displayIcon: agent.displayIcon }]),
        );
        const matches = details.flatMap((detail, index): MatchSummary[] => {
          if (!detail) return [];
          const players = (detail.players || []) as { subject: string; gameName?: string; tagLine?: string; teamId?: string; characterId?: string; stats?: { kills?: number; deaths?: number; assists?: number } }[];
          const player = players.find((entry) => entry.subject === puuid);
          if (!player) return [];
          const teams = (detail.teams || []) as { teamId?: string; won?: boolean; roundsWon?: number }[];
          const team = teams.find((entry) => entry.teamId === player.teamId);
          const opponent = teams.find((entry) => entry.teamId !== player.teamId);
          const teamRounds = Number(team?.roundsWon || 0);
          const opponentRounds = Number(opponent?.roundsWon || 0);
          const result: MatchSummary["result"] = team?.won ? "勝利" : teamRounds === opponentRounds ? "平手" : "敗北";
          const agent = agentMap.get((player.characterId || "").toLowerCase());
          if (player.gameName) setAccountName(`${player.gameName}${player.tagLine ? `#${player.tagLine}` : ""}`);
          return [{
            id: history[index].MatchID,
            result,
            score: `${teamRounds} : ${opponentRounds}`,
            mode: queueLabel(history[index].QueueID || detail.matchInfo?.queueID || ""),
            agent: agent?.displayName || "未知特務",
            agentImageUrl: agent?.displayIcon,
            kills: Number(player.stats?.kills || 0),
            deaths: Number(player.stats?.deaths || 0),
            assists: Number(player.stats?.assists || 0),
            playedAt: Number(history[index].GameStartTime || detail.matchInfo?.gameStartMillis || Date.now()),
          }];
        });
        setRecentMatches(matches);
      } else {
        setRecentMatches([]);
      }

      const missing: string[] = [];
      if (!storefrontLoaded) missing.push("每日商城");
      if (!walletResponse.ok) missing.push("點數餘額");
      if (!mmrResponse.ok) missing.push("段位");
      if (!historyResponse.ok) missing.push("近期戰績");
      setToolsLoaded(true);
      setToolsTab("overview");
      setAuthUrl("");
      setToolsStatus(missing.length ? `已完成，但目前無法讀取：${missing.join("、")}。` : "完成：帳號資料已更新。");
    } catch (error) {
      setToolsStatus(error instanceof Error ? error.message : "讀取失敗，請重新嘗試。");
    } finally {
      setToolsLoading(false);
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
          <span><strong>{asset.name}</strong><small>{asset.label}{asset.isEffect ? " · 特效" : ""}</small></span><Plus size={15} />
        </button>
      ))}
    </>
  );

  const backgroundControls = <div className="background-settings">
    <div className="settings-intro"><h2>畫布背景</h2><p>背景與 Logo 都會一起匯出。</p></div>
    <button className={`background-preset ${bgUrl === COLLECTION_FRAME_URL ? "active" : ""}`} onClick={() => { setBgUrl(COLLECTION_FRAME_URL); flash("已套用透明分類框"); }}>
      <span aria-hidden="true" style={{ width: 40, height: 32, flexShrink: 0, border: `1px solid ${brandSettings.frameColor}`, background: `${brandSettings.frameColor}2e` }} /><span><strong>透明分類框</strong><small>半透明框格 · 顏色自由調整</small></span>{bgUrl === COLLECTION_FRAME_URL && <Check size={18} />}
    </button>
    {bgUrl === COLLECTION_FRAME_URL && <div className="control-section">
      <h3>框格樣式</h3>
      <label className="range-label"><span>框格顏色</span><span style={{ display: "flex", gap: 8 }}><input aria-label="框格顏色" type="color" value={brandSettings.frameColor} style={{ width: 48, height: 36, cursor: "pointer" }} onChange={(event) => { setFrameColorDraft(event.target.value); setBrandSettings((settings) => ({ ...settings, frameColor: event.target.value })); }} /><input aria-label="框格色碼" type="text" maxLength={7} value={frameColorDraft} style={{ width: "100%", minWidth: 0, height: 36, color: "#53647a", background: "#fff", border: "1px solid #dce3ed", borderRadius: 5, padding: "0 10px" }} onChange={(event) => { const value = event.target.value; setFrameColorDraft(value); if (/^#[0-9a-f]{6}$/i.test(value)) setBrandSettings((settings) => ({ ...settings, frameColor: value })); }} onBlur={() => setFrameColorDraft(brandSettings.frameColor)} /></span></label>
      <label className="range-label"><span>框格不透明度 <b>{Math.round(brandSettings.frameOpacity * 100)}%</b></span><input aria-label="框格不透明度" type="range" min="0" max="100" value={Math.round(brandSettings.frameOpacity * 100)} onChange={(event) => setBrandSettings((settings) => ({ ...settings, frameOpacity: Number(event.target.value) / 100 }))} /></label>
      <p className="settings-note">純色半透明框格疊在 Logo 上方。匯入與自動排列會依武器名稱放入框內；收藏較多可切換多頁。</p>
    </div>}
    <button className={`background-preset ${bgUrl === BRAND_BACKGROUND_URL ? "active" : ""}`} onClick={() => { setBgUrl(BRAND_BACKGROUND_URL); flash("已套用透明背景"); }}>
      <img src={BRAND_BACKGROUND_URL} alt="透明背景" /><span><strong>透明背景</strong><small>只輸出素材與 Logo</small></span>{bgUrl === BRAND_BACKGROUND_URL && <Check size={18} />}
    </button>
    <label className="dropzone"><UploadSimple size={25} /><strong>上傳背景圖片</strong><small>JPG、PNG 或 WEBP</small><input aria-label="上傳背景圖片" type="file" accept="image/*" onChange={loadBackground} /></label>
    {bgUrl !== BRAND_BACKGROUND_URL && <button className="text-btn" onClick={() => setBgUrl(BRAND_BACKGROUND_URL)}>恢復透明背景</button>}
    <div className="control-section brand-settings"><div className="setting-heading"><h3>品牌 Logo</h3><label className="check-row"><input aria-label="Logo 水印" type="checkbox" checked={brandSettings.enabled} onChange={(event) => setBrandSettings((settings) => ({ ...settings, enabled: event.target.checked }))} /><span>Logo 水印</span></label></div>
      <div className="logo-preview"><img src={BRAND_LOGO_URL} alt="1Sh0t 紅色品牌 Logo" /></div>
      <label className="range-label"><span>透明度 <b>{Math.round(brandSettings.opacity * 100)}%</b></span><input aria-label="Logo 透明度" type="range" min="0" max="100" disabled={!brandSettings.enabled} value={Math.round(brandSettings.opacity * 100)} onChange={(event) => setBrandSettings((settings) => ({ ...settings, opacity: Number(event.target.value) / 100 }))} /></label>
      <label className="range-label"><span>大小 <b>{Math.round(brandSettings.scale * 100)}%</b></span><input aria-label="Logo 大小" type="range" min="30" max="100" disabled={!brandSettings.enabled} value={Math.round(brandSettings.scale * 100)} onChange={(event) => setBrandSettings((settings) => ({ ...settings, scale: Number(event.target.value) / 100 }))} /></label>
      <p className="settings-note">Logo 疊在素材後方，透明度與大小都可調整。</p>{brandError && <p className="settings-error">{brandError}</p>}
    </div>
    <div className="control-section"><label className="check-row"><input type="checkbox" aria-label="輸出帳號點數與分類標籤" checked={brandSettings.showMetadata} onChange={(event) => setBrandSettings((settings) => ({ ...settings, showMetadata: event.target.checked }))} /><span>輸出帳號點數與分類標籤</span></label>{brandSettings.showMetadata && <><h3 className="metadata-heading">帳號點數</h3><div className="three-fields"><label>VP<input value={vp} inputMode="numeric" onChange={(event) => setVp(event.target.value)} /></label><label>RP<input value={rp} inputMode="numeric" onChange={(event) => setRp(event.target.value)} /></label><label>KC<input value={kc} inputMode="numeric" onChange={(event) => setKc(event.target.value)} /></label></div><div className="account-sync-row"><span>{lastUpdated ? "已同步 Riot 帳號" : "尚未同步 Riot 帳號"}</span><a href="#/tools">同步點數</a></div></>}</div>
  </div>;

  const currentExport = lastExport && lastExport.items === items && lastExport.settings === brandSettings && lastExport.background === bgUrl && lastExport.mode === layoutMode && lastExport.page === currentPage ? lastExport : null;

  if (activePage === "tools") return (
    <main className="tools-page-shell">
      <header className="tools-page-topbar">
        <a className="tools-back" href="#">← 返回製圖工具</a>
        <div className="brand"><span className="brand-wordmark">1Sh0t</span><i>實用小工具</i></div>
        <span className="tools-private"><b />本機讀取 · 不儲存憑證</span>
      </header>

      <section className="tools-page-wrap">
        <div className="tools-page-hero">
          <div><span className="eyebrow">ACCOUNT COMMAND CENTER</span><h1>實用小工具</h1><p>每日商城、點數餘額、競技段位與近期戰績，一個頁面快速查看。</p></div>
          <div className="tools-hero-badge"><span>LIVE</span><strong>RIOT 帳號資料</strong><small>需要本人短效驗證</small></div>
        </div>

        {!toolsLoaded ? <section className="tools-auth-card">
          <div className="tools-auth-intro"><span className="eyebrow">CONNECT ACCOUNT</span><h2>連結你的 Riot 帳號</h2><p>驗證只在目前的瀏覽器分頁中使用，關閉或離開後不會保留登入網址。</p></div>
          <div className="utility-preview utility-preview-three">
            <div><span>01</span><strong>每日商城</strong><small>今日四個造型、售價與刷新倒數</small></div>
            <div><span>02</span><strong>帳號總覽</strong><small>VP、RP、王國幣與目前段位</small></div>
            <div><span>03</span><strong>近期分析</strong><small>勝率、K/D、平均 K/D/A 與常用特務</small></div>
          </div>
          <div className="experimental"><strong>帳號本人檢視</strong><p>每日商城使用實驗性遊戲資料來源，Riot 更新後可能需要重新調整；請勿把驗證網址傳給任何人。</p></div>
          <div className="tools-auth-layout">
            <ol className="auth-steps"><li><a href={RIOT_LOGIN_URL} target="_blank" rel="noopener noreferrer">開啟 Riot 官方登入頁 ↗</a>並完成登入。</li><li>登入後複製瀏覽器網址列中的<strong>完整網址</strong>。</li><li>貼到右側欄位，選擇帳號分區後讀取資料。</li></ol>
            <div className="tools-auth-form">
              <label className="auth-field">驗證網址<textarea value={authUrl} onChange={(event) => setAuthUrl(event.target.value)} placeholder="https://playvalorant.com/opt_in#access_token=…" autoComplete="off" spellCheck={false} /></label>
              <div className="import-options utility-region"><label>帳號分區<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="ap">亞太 AP（台灣）</option><option value="na">北美 NA</option><option value="eu">歐洲 EU</option><option value="kr">韓國 KR</option><option value="br">巴西 BR</option><option value="latam">拉丁美洲 LATAM</option></select></label></div>
              {toolsStatus && <div className="import-status">{toolsStatus}</div>}
              <button className="primary-wide" disabled={toolsLoading || !authUrl.trim()} onClick={() => void loadUtilityData()}>{toolsLoading ? <><span className="spinner" />正在同步帳號資料…</> : "讀取帳號小工具"}</button>
              <p className="token-note">安全提醒：驗證網址等同短效登入憑證，請勿貼給任何人。</p>
            </div>
          </div>
        </section> : <section className="tools-dashboard">
          <div className="tools-dashboard-head">
            <div className="utility-account"><div><span>已連結帳號</span><strong>{accountName}</strong></div><small>{lastUpdated ? `更新於 ${new Date(lastUpdated).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}` : "剛剛更新"}</small></div>
            <div className="tools-dashboard-actions">
              <button className="tools-apply-wallet" disabled={!lastUpdated} onClick={() => { applyWalletBalance(wallet); window.location.hash = ""; flash(`已套用 VP ${wallet.vp} / RP ${wallet.rp} / KC ${wallet.kc}`); }}>套用到製圖畫布</button>
              <button className="tools-refresh" onClick={() => { setToolsLoaded(false); setToolsStatus(""); setAuthUrl(""); }}>重新驗證更新</button>
            </div>
          </div>
          {toolsStatus && <div className={`import-status ${toolsStatus.startsWith("完成") ? "success" : ""}`}>{toolsStatus}</div>}
          <div className="utility-tabs utility-tabs-three"><button className={toolsTab === "overview" ? "active" : ""} onClick={() => setToolsTab("overview")}>帳號總覽</button><button className={toolsTab === "store" ? "active" : ""} onClick={() => setToolsTab("store")}>每日商城</button><button className={toolsTab === "stats" ? "active" : ""} onClick={() => setToolsTab("stats")}>段位與戰績</button></div>

          {toolsTab === "overview" ? <section className="utility-overview">
            <div className="balance-grid">
              <article><span>VALORANT POINTS</span><strong>{wallet.vp.toLocaleString()}</strong><small>VP 特務幣</small></article>
              <article><span>RADIANITE</span><strong>{wallet.rp.toLocaleString()}</strong><small>RP 輻能點數</small></article>
              <article><span>KINGDOM CREDITS</span><strong>{wallet.kc.toLocaleString()}</strong><small>KC 王國幣</small></article>
            </div>
            <div className="overview-grid">
              <article className="overview-rank"><div>{rankSummary?.imageUrl ? <img src={rankSummary.imageUrl} alt="" /> : <span>RANK</span>}</div><section><small>目前競技段位</small><strong>{rankSummary?.tier || "暫無段位資料"}</strong><p>{rankSummary ? `${rankSummary.rr} RR · ${rankSummary.wins} 勝 / ${rankSummary.games} 場` : "請重新驗證更新"}</p></section></article>
              <article className="overview-insights"><div><small>近期勝率</small><strong>{recentInsights.winRate}%</strong></div><div><small>近期 K/D</small><strong>{recentInsights.kd}</strong></div><div><small>平均 K / D / A</small><strong>{recentInsights.averageKda}</strong></div><div><small>近期常用特務</small><strong>{recentInsights.favoriteAgent}</strong></div></article>
              <article className="overview-store"><div><span className="eyebrow">DAILY STORE</span><h3>今日商城</h3><p>{storeOffers.length ? `已讀取 ${storeOffers.length} 個造型` : "目前沒有商城資料"}</p></div><strong>{storeRemaining ? remainingLabel(storeRemaining) : "—"}</strong><small>距離刷新</small><button onClick={() => setToolsTab("store")}>查看商城 →</button></article>
              <article className="overview-actions"><span className="eyebrow">QUICK ACTIONS</span><h3>快速查看</h3><button onClick={() => setToolsTab("stats")}>查看最近五場戰績 <span>→</span></button><a href="#">回到收藏製圖 <span>→</span></a></article>
            </div>
          </section> : toolsTab === "store" ? <section className="utility-view">
            <div className="utility-view-head"><div><span className="eyebrow">DAILY STORE</span><h3>今天的每日商城</h3></div><span className="refresh-time">{storeRemaining ? `距離刷新 ${remainingLabel(storeRemaining)}` : "刷新時間暫無資料"}</span></div>
            {storeOffers.length ? <div className="store-grid">{storeOffers.map((offer) => <article className="store-card" key={offer.id}><div className="store-art">{offer.imageUrl ? <img src={offer.imageUrl} alt="" crossOrigin="anonymous" /> : <span>NO IMAGE</span>}</div><div><small>{offer.weapon}</small><strong>{offer.name}</strong><b>{offer.price ? `${offer.price.toLocaleString()} VP` : "價格暫無資料"}</b></div></article>)}</div> : <div className="utility-empty"><strong>目前無法顯示每日商城</strong><p>{storeError || "請重新驗證更新；若仍無法讀取，請稍後再試。"}</p></div>}
          </section> : <section className="utility-view stats-view">
            <div className="rank-card">{rankSummary?.imageUrl ? <img src={rankSummary.imageUrl} alt="" /> : <div className="rank-placeholder">RANK</div>}<div><span>目前競技段位</span><strong>{rankSummary?.tier || "暫無段位資料"}</strong><small>{rankSummary ? `${rankSummary.rr} RR · ${rankSummary.wins} 勝 / ${rankSummary.games} 場` : "請重新驗證更新"}</small></div></div>
            <div className="match-heading"><div><span className="eyebrow">RECENT MATCHES</span><h3>最近五場戰績</h3></div><span>K / D / A</span></div>
            {recentMatches.length ? <div className="match-list">{recentMatches.map((match) => <article className={`match-row ${match.result === "勝利" ? "win" : match.result === "敗北" ? "loss" : "draw"}`} key={match.id}><div className="match-agent">{match.agentImageUrl ? <img src={match.agentImageUrl} alt="" /> : <span />}</div><div className="match-main"><strong>{match.result} <b>{match.score}</b></strong><small>{match.mode} · {match.agent}</small></div><div className="match-kda"><strong>{match.kills} / {match.deaths} / {match.assists}</strong><small>{new Date(match.playedAt).toLocaleDateString("zh-TW")}</small></div></article>)}</div> : <div className="utility-empty"><strong>目前沒有近期戰績</strong><p>請確認分區，或稍後重新驗證更新。</p></div>}
          </section>}
        </section>}
      </section>
    </main>
  );

  return (
    <main className="app-shell studio-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-wordmark">1Sh0t</span><i>收藏展示畫布</i></div>
        <div className="top-actions">
          <a className="tools-btn" href="#/tools" onClick={() => setToolsStatus("")}><Wrench size={18} /> <span>實用工具</span></a>
          <button className="ghost-btn" onClick={openLibrary}><FolderSimple size={18} /> <span>素材庫</span></button>
          <button className="import-btn" onClick={openImport}><UploadSimple size={18} /> <span>Riot 匯入</span></button>
          <button className="export-btn" onClick={exportPng}><DownloadSimple size={19} /> {layoutMode === "pages" ? "匯出本頁" : "匯出 PNG"}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="studio-library" aria-label="素材與背景">
          <div className="library-tabs" role="tablist" aria-label="素材與背景分頁"><button role="tab" aria-selected={libraryTab === "assets"} onClick={() => setLibraryTab("assets")}>素材庫</button><button role="tab" aria-selected={libraryTab === "background"} onClick={() => setLibraryTab("background")}>畫布背景</button></div>
          {libraryTab === "assets" ? <div className="library-content"><label className="search"><MagnifyingGlass size={19} /><input aria-label="搜尋素材" placeholder="搜尋造型或武器…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="category-select"><span className="sr-only">素材類型</span><select aria-label="素材類型" value={category} onChange={(event) => { setCategory(event.target.value as CatalogCategory); setVisibleCount(80); }}>{categoryTabs.map((tab) => <option key={tab.key} value={tab.key}>{tab.key === "all" ? "全部類型" : tab.label}</option>)}</select></label><div className="library-count">{filtered.length.toLocaleString()} 個素材 <span>點擊加入畫布</span></div><div className="asset-grid" ref={libraryScrollRef}>{assetList(visibleCount)}{visibleCount < filtered.length && <button className="load-more" onClick={() => setVisibleCount((value) => value + 80)}>顯示更多</button>}</div></div> : backgroundControls}
        </aside>
        <section className="stage-panel panel">
          <div className="editor-toolbar">
            <div className="layout-mode-switch"><span>排列模式</span><button className={layoutMode === "single" ? "active" : ""} onClick={() => changeLayoutMode("single")}>單張</button><button className={layoutMode === "long" ? "active" : ""} onClick={() => changeLayoutMode("long")}>長圖</button><button className={layoutMode === "pages" ? "active" : ""} onClick={() => changeLayoutMode("pages")}>多頁</button></div>
            <div className="compose-actions"><button onClick={() => addText("我的特戰收藏")}><TextT size={20} /><span>加入文字</span></button><label><ImageIcon size={20} /><span>自訂圖片</span><input aria-label="上傳自訂圖片" type="file" accept="image/*" onChange={loadCustom} /></label><button className="background-shortcut" onClick={() => setLibraryTab("background")}><SlidersHorizontal size={19} /><span>背景</span></button></div>
            <div className="canvas-tools"><button aria-label="自動排列" title="自動排列收藏" disabled={!items.some(isWeaponItem)} onClick={arrangeCollection}><ArrowsOutSimple size={19} /></button><button aria-label="重設畫布" title="清空畫布" disabled={!items.length} onClick={() => { setItems([]); setSelected(null); flash("畫布已清空"); }}><ArrowsClockwise size={19} /></button></div>
          </div>
          {layoutMode === "pages" && <div className="page-controls"><button aria-label="上一頁" disabled={currentPage === 0} onClick={() => { setCurrentPage((page) => Math.max(0, page - 1)); setSelected(null); }}><ArrowUp size={16} /></button><strong>第 {currentPage + 1} / {pageCount} 頁</strong><button aria-label="下一頁" disabled={currentPage >= pageCount - 1} onClick={() => { setCurrentPage((page) => Math.min(pageCount - 1, page + 1)); setSelected(null); }}><ArrowDown size={16} /></button><button className="export-pages" onClick={() => void exportAllPages()}><DownloadSimple size={16} />全部頁面 ZIP</button></div>}
          <div className="editor-stage">
            <div className={`canvas-wrap ${layoutMode === "long" ? "long-canvas" : ""}`}>
              <canvas ref={canvasRef} width={W} height={canvasHeight} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="可拖曳並可框選多個造型的特戰收藏畫布" />
              {!items.length && <div className="empty-hint"><span>開始製作</span><strong>把你的收藏放上畫布</strong><small>選擇造型或匯入收藏，開始自由排版。</small><div><button onClick={openLibrary}><FolderSimple size={17} />選擇造型</button><button onClick={openImport}><UploadSimple size={17} />Riot 匯入</button></div></div>}
            </div>
            {current && <aside className="inspector-panel panel" aria-label="編輯選取項目">
              <div className="panel-head"><h2>編輯設定 <small>{selectedIds.length > 1 ? `${selectedIds.length} 個項目` : ""}</small></h2><button className="close-btn" aria-label="關閉編輯設定" onClick={() => setSelected(null)}><X size={19} /></button></div>
          <div className="control-section selection-section">

            {current ? <>
              <div className="selected-name">{current.imageUrl && <img src={current.imageUrl} alt="" />}<div><strong>{current.name}</strong><small>{current.label}</small></div></div>
              {selectedIds.length === 1 && <div className="position-fields"><label>位置 X<input aria-label="物件位置 X" type="number" value={Math.round(current.x)} onChange={(event) => updateCurrent({ x: Math.max(0, Math.min(W - current.w, Number(event.target.value))) })} /></label><label>位置 Y<input aria-label="物件位置 Y" type="number" value={Math.round(current.y)} onChange={(event) => updateCurrent({ y: Math.max(0, Math.min(canvasHeight - current.h, Number(event.target.value))) })} /></label></div>}
              {current.type === "text" && <><label className="field-label">文字內容<input value={current.text || ""} onChange={(event) => updateCurrent({ text: event.target.value, name: event.target.value })} /></label><label className="color-row">文字顏色<input type="color" value={current.textColor || "#ffffff"} onChange={(event) => updateCurrent({ textColor: event.target.value })} /></label><label className="range-label"><span>字體大小 <b>{current.fontSize || 42}px</b></span><input type="range" min="18" max="120" value={current.fontSize || 42} onChange={(event) => updateCurrent({ fontSize: Number(event.target.value) })} /></label></>}
              {canOutline && <details className={`outline-editor ${current.outlineEnabled ? "active" : ""}`}>
                <summary>物件外框</summary>
                <div className="outline-heading"><div><strong>物件外框</strong><small>沿著武器輪廓加上實色邊框</small></div><label className="outline-switch"><input type="checkbox" checked={Boolean(current.outlineEnabled)} onChange={(event) => updateCurrent({ outlineEnabled: event.target.checked, outlineColor: current.outlineColor || "#f3a3b4", outlineWidth: current.outlineWidth || 10 })} /><span>{current.outlineEnabled ? "已開啟" : "開啟"}</span></label></div>
                {current.outlineEnabled && <>
                  <div className="outline-color-row"><label>外框顏色<input aria-label="選擇外框顏色" type="color" value={current.outlineColor || "#f3a3b4"} onChange={(event) => updateCurrent({ outlineColor: event.target.value })} /></label><code>{(current.outlineColor || "#f3a3b4").toUpperCase()}</code></div>
                  <div className="color-presets" aria-label="常用外框顏色">{["#f3a3b4", "#ffffff", "#ff4655", "#f4d35e", "#58e5d5", "#111111"].map((color) => <button key={color} type="button" className={(current.outlineColor || "#f3a3b4").toLowerCase() === color ? "selected" : ""} style={{ backgroundColor: color }} aria-label={`外框顏色 ${color}`} onClick={() => updateCurrent({ outlineColor: color })} />)}</div>
                  <label className="range-label outline-range"><span>外框粗度 <b>{current.outlineWidth || 10}px</b></span><input aria-label="外框粗度" type="range" min="1" max="30" value={current.outlineWidth || 10} onChange={(event) => updateCurrent({ outlineWidth: Number(event.target.value) })} /></label>
                </>}
              </details>}
              <label className="range-label"><span>旋轉角度 <b>{Math.round(current.rotation)}°</b></span><input type="range" min="-180" max="180" value={current.rotation} onChange={(event) => updateCurrent({ rotation: Number(event.target.value) })} /></label>
              <label className="field-label">寬度 px<input aria-label="物件寬度" type="number" min="54" max="1200" value={Math.round(current.w)} onChange={(event) => { const w = Math.max(54, Math.min(W, Number(event.target.value))); updateCurrent({ w, h: current.h * w / current.w }); }} /></label>
              <div className="object-actions"><button onClick={() => updateCurrent({ rotation: 0 })}>角度歸零</button><button onClick={bringSelectionToFront}>移到最上層</button></div>
            </> : <div className="no-selection"><span>◇</span><p><strong>尚未選取物件</strong><br />點擊單選、按住 Shift 加選，或在空白處拖曳框選多個造型。</p></div>}
          </div>

              <div className="inspector-actions"><button title="複製選取項目" onClick={duplicateCurrent}><Copy size={18} />複製</button><button title="刪除選取項目" onClick={deleteCurrent}><Trash size={18} />刪除</button></div>
              <div className="selection-shortcuts"><button aria-label="縮小選取項目" title="縮小" onClick={() => scaleSelection(.9)}><Minus size={17} /></button><button aria-label="放大選取項目" title="放大" onClick={() => scaleSelection(1.1)}><Plus size={17} /></button><button aria-label="水平對齊選取項目" title="水平對齊" onClick={alignSelection}><AlignCenterHorizontal size={17} /></button>{canOutline && <button title="切換外框" onClick={toggleSelectionOutline}>外框</button>}</div>
            </aside>}
          </div>
          <div className="stage-foot"><span><Check size={13} /> 自動儲存在這個裝置</span><span>1200 × {canvasHeight} PX{layoutMode === "pages" ? ` · 第 ${currentPage + 1}/${pageCount} 頁` : ""}{bgUrl === COLLECTION_FRAME_URL ? " · 透明分類框" : bgUrl === BRAND_BACKGROUND_URL ? " · 透明背景" : ""}</span><span>拖曳移動 · Shift 加選 · 右下角縮放</span></div>
          {currentExport && <div className="export-receipt" role="status"><Check size={15} /><span>{currentExport.format} 已產生</span><a href={currentExport.url} download={currentExport.filename}>重新下載 {currentExport.format}</a><button aria-label="關閉下載提示" onClick={() => setLastExport(null)}><X size={15} /></button></div>}
        </section>
      </section>

      {libraryOpen && <div className="modal-backdrop" onMouseDown={() => setLibraryOpen(false)}>
        <section className="modal catalog-modal" role="dialog" aria-modal="true" aria-label="造型清單" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow">VALORANT DATABASE</span><h2>造型清單</h2></div><button className="close-btn" onClick={() => setLibraryOpen(false)} aria-label="關閉視窗"><X size={20} /></button></div>
          <div className="catalog-toolbar"><label className="search"><MagnifyingGlass size={19} /><input placeholder="搜尋造型名稱或武器" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="tabs">{categoryTabs.map((tab) => <button key={tab.key} className={category === tab.key ? "active" : ""} onClick={() => setCategory(tab.key)}>{tab.label}</button>)}</div><span className="result-count">{filtered.length} 項</span></div>
          <div className="modal-grid">{assetList(visibleCount)}</div>
          {visibleCount < filtered.length && <button className="load-more" onClick={() => setVisibleCount((value) => value + 80)}>顯示更多</button>}
        </section>
      </div>}

      {importOpen && <div className="modal-backdrop" onMouseDown={() => { if (!importing) { setImportOpen(false); setAuthUrl(""); } }}>
        <section className="modal import-modal" role="dialog" aria-modal="true" aria-label="匯入 Riot 造型" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><span className="eyebrow">RIOT ACCOUNT IMPORT</span><h2>匯入功能</h2></div><button className="close-btn" disabled={importing} onClick={() => { setImportOpen(false); setAuthUrl(""); }} aria-label="關閉視窗"><X size={20} /></button></div>
          <div className="experimental"><strong>實驗性功能</strong><p>本站會在你的瀏覽器中直接向 Riot 讀取造型收藏；不會上傳、記錄或儲存驗證網址與登入資料。</p></div>
          <ol className="auth-steps"><li><a href={RIOT_LOGIN_URL} target="_blank" rel="noopener noreferrer">開啟 Riot 官方登入頁 ↗</a>，完成登入。</li><li>登入後畫面可能顯示錯誤頁，這是正常的。複製瀏覽器網址列中的<strong>完整網址</strong>。</li><li>貼到下方欄位，選擇帳號分區後按「開始匯入」。</li></ol>
          <label className="auth-field">驗證網址<textarea id="auth_token_input" value={authUrl} onChange={(event) => setAuthUrl(event.target.value)} placeholder="https://playvalorant.com/opt_in#access_token=…" autoComplete="off" spellCheck={false} /></label>
          <div className="import-options"><label>帳號分區<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="ap">亞太 AP（台灣）</option><option value="na">北美 NA</option><option value="eu">歐洲 EU</option><option value="kr">韓國 KR</option><option value="br">巴西 BR</option><option value="latam">拉丁美洲 LATAM</option></select></label><label className="check-row"><input id="only_skin_input" type="checkbox" checked={onlyEffects} onChange={(event) => setOnlyEffects(event.target.checked)} /><span>僅匯入特效槍皮</span></label></div>
          {importStatus && <div className={`import-status ${importStatus.startsWith("完成") ? "success" : ""}`}>{importStatus}</div>}
          <button id="verify_auth_button" className="primary-wide" disabled={importing || !authUrl.trim()} onClick={() => void importOwnedSkins()}>{importing ? <><span className="spinner" />匯入中，請勿關閉…</> : "開始匯入"}</button>
          <p className="token-note">安全提醒：驗證網址等同短效登入憑證，請勿貼給任何人。若離開此視窗，欄位內容會立即清除。</p>
        </section>
      </div>}

      {toast && <div className="toast" role="status"><Check size={18} /> {toast}</div>}
    </main>
  );
}
