export const BRAND_BACKGROUND_URL = "./brand/background.png";
export const BRAND_LOGO_URL = "./brand/logo-transparent.png";

export type BrandSettings = { enabled: boolean; opacity: number; scale: number; showMetadata: boolean };
export const DEFAULT_BRAND_SETTINGS: BrandSettings = { enabled: true, opacity: 0.25, scale: 0.86, showMetadata: false };

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
    };
  } catch {
    return DEFAULT_BRAND_SETTINGS;
  }
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
    const regionHeight = Math.min(pageHeight, height - top);
    const ratio = Math.min(width * settings.scale / logo.naturalWidth, regionHeight * 0.8 / logo.naturalHeight);
    const w = logo.naturalWidth * ratio;
    const h = logo.naturalHeight * ratio;
    ctx.drawImage(logo, (width - w) / 2, top + (regionHeight - h) / 2, w, h);
  }
  ctx.restore();
}
