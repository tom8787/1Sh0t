import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./studio.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "1Sh0t｜特戰製圖與造型匯入工具";
  const description = "從 Riot 帳號匯入 VALORANT 造型，加入卡面、吊飾、文字與自訂圖片，自由排版並匯出高畫質 PNG。";
  return {
    metadataBase: base,
    title,
    description,
    icons: { icon: "/brand/logo-transparent.png", shortcut: "/brand/logo-transparent.png" },
    openGraph: { title, description, type: "website", images: [{ url: new URL("/brand/logo.jpg", base), width: 1280, height: 840, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/brand/logo.jpg", base)] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
