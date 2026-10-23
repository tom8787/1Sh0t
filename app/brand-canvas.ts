export const BRAND_BACKGROUND_URL = "./brand/background.png";
export const BRAND_LOGO_URL = "./brand/logo-transparent.png";
export const COLLECTION_FRAME_URL = "./brand/collection-frame.png";
export const CANVAS_WIDTH = 1200;
export const COLLECTION_HEIGHT = 760;
export const TITLE_HEIGHT = 120;
export const PAGE_HEIGHT = COLLECTION_HEIGHT + TITLE_HEIGHT;
export const PREVIEW_SCALE = 2;

export function exportDimensions(height: number, scale: number) {
  const width = CANVAS_WIDTH * scale;
  const outputHeight = Math.round(height * scale);
  if (width > 16384 || outputHeight > 16384 || width * outputHeight > 64_000_000) {
    throw new Error("長圖超出高畫質匯出上限，請切換多頁並匯出 ZIP。");
  }
  return { width, height: outputHeight };
}

export const COLLECTION_SECTIONS = [
  { title: "隨身武器", x: 40, top: 50, bottom: 730, weapons: [
    ["29a0cfab-485b-f5d5-779a-b59f85e204a8", "制式手槍"],
    ["42da8ccc-40d5-affc-beec-15aa47b42eda", "短管"],
    ["44d4e95c-4157-0037-81b2-17841bf2e8e3", "狂弒"],
    ["1baa85b4-4c70-1284-64bb-6481dfc3bb4e", "鬼魅"],
    ["e336c6b8-418d-9340-d77f-7a9e4cfe0702", "神射"],
    ["410b2e0b-4ceb-1321-1727-20858f7f3477", "盜賊"],
  ] },
  { title: "衝鋒槍", x: 328, top: 50, bottom: 376, weapons: [
    ["f7e1b454-4ad4-1063-ec0a-159e56b58941", "刺針"], ["462080d1-4035-2937-7c09-27aa2a5c27a7", "惡靈"],
  ] },
  { title: "霰彈槍", x: 328, top: 436, bottom: 730, weapons: [
    ["910be174-449b-c412-ab22-d0873436b21b", "重砲"], ["ec845bf4-4f79-ddda-a3da-0db3774b2794", "判官"],
  ] },
  { title: "步槍", x: 616, top: 50, bottom: 598, weapons: [
    ["ae3de142-4d85-2547-dd26-4e90bed35cf7", "鬥牛犬"], ["4ade7faa-4cf1-8376-95ef-39884480959b", "捍衛者"],
    ["ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", "幻象"], ["9c82e19d-4575-0200-1a81-3eacf00cf872", "暴徒"],
    ["8db0a1bf-4a50-832a-4566-faaaa6d250ca", "守望者"],
  ] },
  { title: "近戰武器", x: 616, top: 644, bottom: 730, weapons: [["2f59173c-4bed-b6c3-2191-dea9b58be9c7", "近戰武器"]] },
  { title: "狙擊槍", x: 904, top: 50, bottom: 456, weapons: [
    ["c4883e50-4494-202c-3ec3-6b8a9284f00b", "警長"], ["5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c", "逃犯"],
    ["a03b24d3-4319-996d-0f8c-94bbfba1dfc7", "間諜"],
  ] },
  { title: "機關槍", x: 904, top: 510, bottom: 730, weapons: [
    ["55d8a0f4-4274-ca67-fe2c-06ab45efdf58", "戰神"], ["63e6c2b6-4a8e-869c-3d4c-e38355226584", "奧丁"],
  ] },
] as const;

export const COLLECTION_SLOTS = COLLECTION_SECTIONS.flatMap((section) => {
  const h = (section.bottom - section.top - 12 * (section.weapons.length - 1)) / section.weapons.length;
  return section.weapons.map(([weaponId, label], index) => ({ weaponId, label, x: section.x, y: TITLE_HEIGHT + section.top + index * (h + 12), w: 256, h }));
});

type CollectionItem = { uid: string; type: string; label: string; weaponId?: string; name: string; x: number; y: number; w: number; h: number; rotation: number; layoutPage?: number };

/** Preserve manual placements while adding title space to existing 760px sheets. */
export function migrateTitleSpace<T extends CollectionItem>(items: T[], mode: "single" | "long" | "pages"): T[] {
  return items.map((item) => ({ ...item, y: item.y + TITLE_HEIGHT * (mode === "long" ? Math.floor(item.y / COLLECTION_HEIGHT) + 1 : 1) }));
}

/** Import, manual additions and auto-arrange use the exact same rectangles as rendering. */
export function arrangeCollectionItems<T extends CollectionItem>(items: T[], mode: "single" | "long" | "pages") {
  const groups = new Map<(typeof COLLECTION_SLOTS)[number], T[]>();
  items.forEach((item) => {
    const slot = COLLECTION_SLOTS.find((entry) => item.weaponId ? entry.weaponId === item.weaponId : entry.label === item.label);
    if (slot && ["rifle", "sniper", "sidearm", "melee"].includes(item.type)) groups.set(slot, [...(groups.get(slot) || []), item]);
  });
  const arranged = new Map<string, T>();
  let pages = 1;
  groups.forEach((group, slot) => {
    const ordered = [...group].sort((a, b) => a.name.localeCompare(b.name, "zh-TW"));
    const capacity = mode === "single" ? ordered.length : 6;
    const sheets = Math.ceil(ordered.length / capacity);
    pages = Math.max(pages, sheets);
    for (let sheet = 0; sheet < sheets; sheet += 1) {
      const chunk = ordered.slice(sheet * capacity, (sheet + 1) * capacity);
      const innerW = slot.w - 20;
      const innerH = slot.h - 32;
      const columns = Math.min(chunk.length, Math.max(1, Math.ceil(Math.sqrt(chunk.length * innerW / (innerH * 3)))));
      const rows = Math.ceil(chunk.length / columns);
      const w = innerW / columns;
      const h = innerH / rows;
      const gap = Math.min(3, w / 8, h / 8);
      chunk.forEach((item, index) => arranged.set(item.uid, {
        ...item, x: slot.x + 10 + index % columns * w + gap,
        y: slot.y + 24 + Math.floor(index / columns) * h + gap + (mode === "long" ? sheet * PAGE_HEIGHT : 0),
        w: w - gap * 2, h: h - gap * 2, rotation: 0, layoutPage: mode === "pages" ? sheet : 0,
      }));
    }
  });
  const nextItems = items.map((item) => arranged.get(item.uid) || item);
  if (mode === "pages") pages = Math.max(pages, ...nextItems.map((item) => (item.layoutPage || 0) + 1));
  return { items: nextItems, height: mode === "long" ? pages * PAGE_HEIGHT : PAGE_HEIGHT, pages: mode === "pages" ? pages : 1 };
}

/** Pure translucent rectangles, drawn over the Logo without baked-in texture. */
export function drawCollectionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pageHeight: number,
  settings: BrandSettings,
) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let top = 0; top < height; top += pageHeight) {
    const regionHeight = Math.min(pageHeight, height - top);
    ctx.save();
    ctx.translate(0, top);
    ctx.scale(width / CANVAS_WIDTH, regionHeight / PAGE_HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 18px Arial, "Microsoft JhengHei", sans-serif';
    ctx.fillStyle = "#53647a";
    COLLECTION_SECTIONS.forEach((section) => ctx.fillText(section.title, section.x + 128, TITLE_HEIGHT + section.top - 21));
    COLLECTION_SLOTS.forEach((slot) => {
      ctx.globalAlpha = settings.frameOpacity;
      ctx.fillStyle = settings.frameColor;
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.globalAlpha = Math.min(1, settings.frameOpacity + 0.3);
      ctx.strokeStyle = settings.frameColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
      ctx.globalAlpha = 1;
      ctx.font = '500 11px Arial, "Microsoft JhengHei", sans-serif';
      ctx.textAlign = "left";
      ctx.fillStyle = "#53647a";
      ctx.fillText(slot.label, slot.x + 10, slot.y + 13);
    });
    ctx.restore();
  }
  ctx.restore();
}

export type BrandSettings = { enabled: boolean; opacity: number; scale: number; showMetadata: boolean; frameColor: string; frameOpacity: number; title: string; titleColor: string; exportScale: number };
export const DEFAULT_BRAND_SETTINGS: BrandSettings = { enabled: true, opacity: 0.25, scale: 0.86, showMetadata: false, frameColor: "#8494a7", frameOpacity: 0.18, title: "", titleColor: "#243044", exportScale: 3 };

export function readBrandSettings(): BrandSettings {
  if (typeof window === "undefined") return DEFAULT_BRAND_SETTINGS;
  try {
    const saved = JSON.parse(localStorage.getItem("1shot-brand-settings") || "null");
    if (!saved) return DEFAULT_BRAND_SETTINGS;
    return {
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : true,
      opacity: Number.isFinite(saved.opacity) ? Math.max(0, Math.min(1, saved.opacity)) : 0.25,
      scale: Number.isFinite(saved.scale) ? Math.max(0.3, Math.min(1, saved.scale)) : 0.86,
      showMetadata: saved.showMetadata === true,
      frameColor: typeof saved.frameColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.frameColor) ? saved.frameColor : DEFAULT_BRAND_SETTINGS.frameColor,
      frameOpacity: Number.isFinite(saved.frameOpacity) ? Math.max(0, Math.min(1, saved.frameOpacity)) : DEFAULT_BRAND_SETTINGS.frameOpacity,
      title: typeof saved.title === "string" ? saved.title.slice(0, 80) : "",
      titleColor: typeof saved.titleColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.titleColor) ? saved.titleColor : DEFAULT_BRAND_SETTINGS.titleColor,
      exportScale: [2, 3, 4].includes(saved.exportScale) ? saved.exportScale : DEFAULT_BRAND_SETTINGS.exportScale,
    };
  } catch {
    return DEFAULT_BRAND_SETTINGS;
  }
}

export function drawPageTitle(ctx: CanvasRenderingContext2D, width: number, height: number, settings: BrandSettings) {
  if (!settings.title.trim()) return;
  ctx.save();
  ctx.fillStyle = settings.titleColor;
  ctx.font = '700 32px Arial, "Microsoft JhengHei", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines: string[] = [];
  let line = "";
  for (const character of settings.title.replace(/\r/g, "")) {
    if (character === "\n" || ctx.measureText(line + character).width > width - 80) {
      lines.push(line);
      line = character === "\n" ? "" : character;
    } else line += character;
  }
  if (line || !lines.length) lines.push(line);
  const visible = lines.slice(0, 2);
  if (lines.length > 2) visible[1] = visible[1].slice(0, -1) + "…";
  for (let top = 0; top < height; top += PAGE_HEIGHT) {
    visible.forEach((text, index) => ctx.fillText(text, width / 2, top + TITLE_HEIGHT / 2 + (index - (visible.length - 1) / 2) * 42, width - 80));
  }
  ctx.restore();
}

/** Shared by the editor and every PNG/ZIP page; artwork is drawn behind scene objects. */
export function drawBrandBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pageHeight: number,
  logo: HTMLImageElement | undefined,
  settings: BrandSettings,
) {
  if (!settings.enabled || !logo || !logo.naturalWidth || !logo.naturalHeight) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = settings.opacity;
  for (let top = 0; top < height; top += pageHeight) {
    const regionHeight = Math.max(0, Math.min(pageHeight, height - top) - TITLE_HEIGHT);
    const ratio = Math.min(width * settings.scale / logo.naturalWidth, regionHeight * 0.8 / logo.naturalHeight);
    const w = logo.naturalWidth * ratio;
    const h = logo.naturalHeight * ratio;
    ctx.drawImage(logo, (width - w) / 2, top + TITLE_HEIGHT + (regionHeight - h) / 2, w, h);
  }
  ctx.restore();
}
