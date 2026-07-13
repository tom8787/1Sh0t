"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type AssetType = "rifle" | "sniper" | "sidearm" | "melee" | "card" | "charm" | "image";
type LibraryAsset = { id: string; name: string; type: AssetType; label: string; colors: [string, string, string] };
type SceneItem = LibraryAsset & { uid: string; x: number; y: number; w: number; h: number; rotation: number; imageUrl?: string };

const W = 1200;
const H = 760;

const assets: LibraryAsset[] = [
  { id: "ion", name: "離子脈衝", type: "rifle", label: "步槍", colors: ["#f5f7ff", "#b9d8ff", "#6759ff"] },
  { id: "ember", name: "熾焰核心", type: "rifle", label: "步槍", colors: ["#ffdfad", "#ff7a39", "#b51e41"] },
  { id: "jade", name: "翡翠獵手", type: "rifle", label: "步槍", colors: ["#c5ffe4", "#28cc9e", "#0b5f62"] },
  { id: "void", name: "虛空訊號", type: "rifle", label: "步槍", colors: ["#ebd8ff", "#9d54ff", "#361d74"] },
  { id: "frost", name: "極霜視界", type: "sniper", label: "狙擊", colors: ["#e7fbff", "#65d4ff", "#17659f"] },
  { id: "nova", name: "新星軌跡", type: "sniper", label: "狙擊", colors: ["#fff0bf", "#ffbd4b", "#8556e7"] },
  { id: "ghost", name: "靜默幽影", type: "sidearm", label: "手槍", colors: ["#e4e9f2", "#8793ad", "#323a51"] },
  { id: "pulse", name: "電磁脈衝", type: "sidearm", label: "手槍", colors: ["#c8fffd", "#25d9dd", "#0a5969"] },
  { id: "arc", name: "相位刃", type: "melee", label: "近戰", colors: ["#f4e2ff", "#c262ff", "#5d24bf"] },
  { id: "sun", name: "日蝕短刃", type: "melee", label: "近戰", colors: ["#fff2a6", "#ff9f3e", "#9d2f48"] },
  { id: "card-a", name: "城市守望", type: "card", label: "卡面", colors: ["#79e8ff", "#2d65d6", "#131b42"] },
  { id: "card-b", name: "裂境行動", type: "card", label: "卡面", colors: ["#ffb67a", "#d5486c", "#381442"] },
  { id: "orb", name: "量子吊飾", type: "charm", label: "吊飾", colors: ["#e6fffd", "#42dfd0", "#1f6c7d"] },
  { id: "fox", name: "靈狐吊飾", type: "charm", label: "吊飾", colors: ["#ffe4fa", "#ff6fb3", "#7d348d"] },
];

const typeTabs: { key: "all" | AssetType; label: string }[] = [
  { key: "all", label: "全部" }, { key: "rifle", label: "步槍" }, { key: "sniper", label: "狙擊" },
  { key: "sidearm", label: "手槍" }, { key: "melee", label: "近戰" }, { key: "card", label: "卡面" }, { key: "charm", label: "吊飾" },
];

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.closePath();
}

function drawWeapon(ctx: CanvasRenderingContext2D, item: SceneItem, selected: boolean, image?: HTMLImageElement) {
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.translate(-item.w / 2, -item.h / 2);

  if (item.type === "image" && image) {
    ctx.drawImage(image, 0, 0, item.w, item.h);
  } else if (item.type === "card") {
    const g = ctx.createLinearGradient(0, 0, item.w, item.h);
    g.addColorStop(0, item.colors[0]); g.addColorStop(.48, item.colors[1]); g.addColorStop(1, item.colors[2]);
    ctx.fillStyle = g; roundedRect(ctx, 0, 0, item.w, item.h, 16); ctx.fill();
    ctx.globalAlpha = .5; ctx.strokeStyle = "white"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(item.w * .55, item.h * .34, item.w * .24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(item.w * .15, item.h * .75); ctx.lineTo(item.w * .78, item.h * .16); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (item.type === "charm") {
    const g = ctx.createRadialGradient(item.w / 2, item.h / 2, 2, item.w / 2, item.h / 2, item.w / 2);
    g.addColorStop(0, item.colors[0]); g.addColorStop(.5, item.colors[1]); g.addColorStop(1, item.colors[2]);
    ctx.strokeStyle = item.colors[0]; ctx.lineWidth = Math.max(3, item.w * .07);
    ctx.beginPath(); ctx.moveTo(item.w / 2, 0); ctx.lineTo(item.w / 2, item.h * .2); ctx.stroke();
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(item.w / 2, item.h * .55, item.w * .32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(item.w * .43, item.h * .45, item.w * .08, 0, Math.PI * 2); ctx.fill();
  } else if (item.type === "melee") {
    const g = ctx.createLinearGradient(0, 0, item.w, item.h);
    g.addColorStop(0, item.colors[0]); g.addColorStop(.5, item.colors[1]); g.addColorStop(1, item.colors[2]);
    ctx.fillStyle = g; ctx.shadowColor = item.colors[1]; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(item.w * .12, item.h * .85); ctx.lineTo(item.w * .46, item.h * .48); ctx.lineTo(item.w * .94, item.h * .05); ctx.lineTo(item.w * .64, item.h * .65); ctx.lineTo(item.w * .28, item.h * .94); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#1a2134"; roundedRect(ctx, item.w * .04, item.h * .74, item.w * .35, item.h * .18, 6); ctx.fill();
  } else {
    const g = ctx.createLinearGradient(0, 0, item.w, item.h);
    g.addColorStop(0, item.colors[0]); g.addColorStop(.45, item.colors[1]); g.addColorStop(1, item.colors[2]);
    ctx.shadowColor = item.colors[1]; ctx.shadowBlur = 15; ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(item.w * .04, item.h * .36); ctx.lineTo(item.w * .56, item.h * .25); ctx.lineTo(item.w * .73, item.h * .38);
    ctx.lineTo(item.w * .96, item.h * .35); ctx.lineTo(item.w * .98, item.h * .48); ctx.lineTo(item.w * .69, item.h * .54);
    ctx.lineTo(item.w * .58, item.h * .76); ctx.lineTo(item.w * .46, item.h * .76); ctx.lineTo(item.w * .43, item.h * .55);
    ctx.lineTo(item.w * .16, item.h * .58); ctx.lineTo(item.w * .04, item.h * .48); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(9,14,28,.58)"; roundedRect(ctx, item.w * .16, item.h * .38, item.w * .42, item.h * .1, 5); ctx.fill();
  }
  if (selected) {
    ctx.strokeStyle = "#62f1df"; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); roundedRect(ctx, -7, -7, item.w + 14, item.h + 14, 8); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#62f1df"; ctx.fillRect(item.w - 3, item.h - 3, 12, 12);
  }
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, items: SceneItem[], selected: string | null, vp: string, rp: string, bgImage?: HTMLImageElement, images?: Map<string, HTMLImageElement>) {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07131f"); bg.addColorStop(.52, "#0b3445"); bg.addColorStop(1, "#11182b");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (bgImage) { ctx.globalAlpha = .42; ctx.drawImage(bgImage, 0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.fillStyle = "rgba(76, 242, 218, .08)"; ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(1200, 160); ctx.lineTo(1200, 760); ctx.lineTo(0, 760); ctx.fill();
  ctx.strokeStyle = "rgba(126,236,225,.11)"; ctx.lineWidth = 1;
  for (let x = -200; x < W + 200; x += 90) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 460, 0); ctx.stroke(); }
  for (let y = 120; y < H; y += 84) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = "rgba(6,13,23,.82)"; ctx.fillRect(0, 0, W, 86);
  ctx.fillStyle = "#f4f8fb"; ctx.font = "700 30px Arial"; ctx.fillText("LOADOUT // 戰術收藏", 38, 46);
  ctx.fillStyle = "#63e9d8"; ctx.font = "700 13px Arial"; ctx.fillText("PERSONAL ARMORY  •  2026", 40, 69);
  ctx.textAlign = "right"; ctx.fillStyle = "#d7e8ef"; ctx.font = "700 18px Arial"; ctx.fillText(`◈ ${vp || "0"}     ◇ ${rp || "0"}`, W - 40, 52); ctx.textAlign = "left";
  const slots = [
    [42, 124, 330, 155, "PRIMARY 01"], [42, 306, 330, 155, "PRIMARY 02"], [42, 488, 330, 155, "SECONDARY"],
    [414, 124, 330, 155, "PRECISION"], [414, 306, 330, 155, "SIDEARM"], [414, 488, 330, 155, "MELEE"],
    [786, 124, 180, 300, "PLAYER CARD"], [992, 124, 164, 142, "BUDDY"], [992, 294, 164, 130, "EMBLEM"],
  ] as const;
  for (const [x, y, w, h, label] of slots) {
    ctx.fillStyle = "rgba(10,26,38,.48)"; roundedRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = "rgba(157,220,228,.22)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "rgba(197,233,238,.64)"; ctx.font = "700 12px Arial"; ctx.fillText(label, x + 14, y + 24);
    ctx.strokeStyle = "rgba(99,233,216,.32)"; ctx.beginPath(); ctx.moveTo(x + 14, y + h - 18); ctx.lineTo(x + Math.min(w - 14, 88), y + h - 18); ctx.stroke();
  }
  items.forEach((item) => drawWeapon(ctx, item, item.uid === selected, images?.get(item.uid)));
  ctx.fillStyle = "rgba(6,13,23,.8)"; ctx.fillRect(0, H - 58, W, 58);
  ctx.fillStyle = "#7ff4e4"; ctx.font = "700 13px Arial"; ctx.fillText("SW// LAB", 38, H - 24);
  ctx.textAlign = "right"; ctx.fillStyle = "rgba(228,245,247,.7)"; ctx.font = "500 12px Arial"; ctx.fillText("DRAG • SCALE • CREATE", W - 38, H - 24); ctx.textAlign = "left";
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement>();
  const imageRefs = useRef(new Map<string, HTMLImageElement>());
  const dragRef = useRef<{ uid: string; dx: number; dy: number; resize: boolean } | null>(null);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | AssetType>("all");
  const [search, setSearch] = useState("");
  const [vp, setVp] = useState("475");
  const [rp, setRp] = useState("90");
  const [bgUrl, setBgUrl] = useState("");
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => assets.filter(a => (tab === "all" || a.type === tab) && a.name.toLowerCase().includes(search.toLowerCase())), [tab, search]);
  const current = items.find(i => i.uid === selected);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, items, selected, vp, rp, bgImageRef.current, imageRefs.current);
  }, [items, selected, vp, rp, bgUrl]);

  useEffect(() => { redraw(); }, [redraw]);

  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };

  const addAsset = (asset: LibraryAsset) => {
    const same = items.filter(i => i.type === asset.type).length;
    const presets: Record<string, { x: number; y: number; w: number; h: number }> = {
      rifle: { x: 72, y: same % 2 ? 330 : 148, w: 270, h: 105 }, sniper: { x: 438, y: 150, w: 282, h: 105 },
      sidearm: { x: 458, y: 340, w: 250, h: 92 }, melee: { x: 480, y: 520, w: 220, h: 105 },
      card: { x: 812, y: 155, w: 128, h: 238 }, charm: { x: 1037, y: 168, w: 78, h: 90 },
    };
    const p = presets[asset.type] || { x: 450, y: 250, w: 260, h: 180 };
    const item: SceneItem = { ...asset, uid: `${asset.id}-${Date.now()}`, ...p, rotation: 0 };
    setItems(prev => [...prev, item]); setSelected(item.uid); flash(`${asset.name} 已加入畫布`);
  };

  const updateCurrent = (patch: Partial<SceneItem>) => setItems(prev => prev.map(i => i.uid === selected ? { ...i, ...patch } : i));
  const deleteCurrent = () => { if (!selected) return; setItems(prev => prev.filter(i => i.uid !== selected)); setSelected(null); flash("已刪除選取項目"); };
  const duplicateCurrent = () => { if (!current) return; const clone = { ...current, uid: `${current.id}-${Date.now()}`, x: current.x + 24, y: current.y + 24 }; setItems(prev => [...prev, clone]); setSelected(clone.uid); };

  const coords = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect(); return { x: (e.clientX - rect.left) * W / rect.width, y: (e.clientY - rect.top) * H / rect.height };
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = coords(e); const hit = [...items].reverse().find(i => p.x >= i.x - 8 && p.x <= i.x + i.w + 8 && p.y >= i.y - 8 && p.y <= i.y + i.h + 8);
    if (!hit) { setSelected(null); return; }
    e.currentTarget.setPointerCapture(e.pointerId); setSelected(hit.uid);
    const resize = Math.abs(p.x - (hit.x + hit.w)) < 28 && Math.abs(p.y - (hit.y + hit.h)) < 28;
    dragRef.current = { uid: hit.uid, dx: p.x - hit.x, dy: p.y - hit.y, resize };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return; const p = coords(e); const d = dragRef.current;
    setItems(prev => prev.map(i => i.uid !== d.uid ? i : d.resize
      ? { ...i, w: Math.max(54, p.x - i.x), h: Math.max(48, p.y - i.y) }
      : { ...i, x: Math.max(-i.w * .7, Math.min(W - i.w * .3, p.x - d.dx)), y: Math.max(86, Math.min(H - 60, p.y - d.dy)) }));
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => { if (dragRef.current) e.currentTarget.releasePointerCapture(e.pointerId); dragRef.current = null; };

  const loadBackground = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { bgImageRef.current = img; setBgUrl(url); flash("背景已更新"); }; img.src = url;
  };
  const loadCustom = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); const img = new Image(); const uid = `custom-${Date.now()}`;
    img.onload = () => { const w = Math.min(300, img.naturalWidth); const h = w * img.naturalHeight / img.naturalWidth; imageRefs.current.set(uid, img); const item: SceneItem = { id: uid, uid, name: file.name, type: "image", label: "自訂", colors: ["#fff", "#fff", "#fff"], x: 450, y: 220, w, h, rotation: 0, imageUrl: url }; setItems(prev => [...prev, item]); setSelected(uid); flash("自訂圖片已加入"); }; img.src = url;
  };
  const exportPng = () => {
    const canvas = canvasRef.current; if (!canvas) return; const prev = selected; setSelected(null);
    window.setTimeout(() => { const link = document.createElement("a"); link.download = `特戰收藏-${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL("image/png"); link.click(); setSelected(prev); flash("高清 PNG 已匯出"); }, 40);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">SW</span><span>LOADOUT LAB</span><i>製圖工具</i></div>
        <div className="top-actions"><span className="status-dot" />本機編輯・不會上傳資料<button className="export-btn" onClick={exportPng}>↓ 匯出 PNG</button></div>
      </header>

      <section className="workspace">
        <aside className="library-panel panel">
          <div className="panel-head"><div><span className="eyebrow">01 / ASSETS</span><h2>素材庫</h2></div><span className="count">{filtered.length}</span></div>
          <label className="search"><span>⌕</span><input aria-label="搜尋素材" placeholder="搜尋造型…" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <div className="tabs" aria-label="素材類型">
            {typeTabs.map(t => <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>)}
          </div>
          <div className="asset-grid">
            {filtered.map(asset => <button className="asset-card" key={asset.id} onClick={() => addAsset(asset)}>
              <span className={`mini-asset ${asset.type}`} style={{ "--c1": asset.colors[0], "--c2": asset.colors[1], "--c3": asset.colors[2] } as React.CSSProperties}><b /></span>
              <span><strong>{asset.name}</strong><small>{asset.label}</small></span><em>＋</em>
            </button>)}
          </div>
          <label className="upload-row">＋ 上傳自訂圖片<input type="file" accept="image/*" onChange={loadCustom} /></label>
        </aside>

        <section className="stage-panel panel">
          <div className="stage-head">
            <div><span className="eyebrow">02 / COMPOSE</span><h1>收藏展示畫布</h1></div>
            <div className="canvas-tools"><button onClick={() => { setItems([]); setSelected(null); flash("畫布已清空"); }}>↺ 重設</button><button disabled={!current} onClick={duplicateCurrent}>▣ 複製</button><button disabled={!current} onClick={deleteCurrent}>⌫ 刪除</button></div>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} width={W} height={H} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="可拖曳的特戰收藏畫布" />
            {!items.length && <div className="empty-hint"><span>＋</span><strong>從左側加入第一個造型</strong><small>加入後可拖曳、縮放與旋轉</small></div>}
          </div>
          <div className="stage-foot"><span><b /> 自動儲存在這個裝置</span><span>1200 × 760 PX</span><span>拖曳移動・右下角縮放</span></div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-head"><div><span className="eyebrow">03 / DETAILS</span><h2>版面設定</h2></div></div>
          <div className="control-section"><h3>帳號資訊</h3><div className="two-fields"><label>特務幣<input value={vp} inputMode="numeric" onChange={e => setVp(e.target.value)} /></label><label>輻能點<input value={rp} inputMode="numeric" onChange={e => setRp(e.target.value)} /></label></div></div>
          <div className="control-section"><h3>畫布背景</h3><label className="dropzone"><span>▧</span><strong>更換背景圖片</strong><small>JPG、PNG 或 WEBP</small><input type="file" accept="image/*" onChange={loadBackground} /></label>{bgUrl && <button className="text-btn" onClick={() => { bgImageRef.current = undefined; setBgUrl(""); }}>移除自訂背景</button>}</div>
          <div className="control-section selection-section">
            <h3>選取項目</h3>
            {current ? <>
              <div className="selected-name"><span style={{ background: current.colors[1] }} /><div><strong>{current.name}</strong><small>{current.label}</small></div></div>
              <label className="range-label"><span>旋轉角度 <b>{Math.round(current.rotation)}°</b></span><input type="range" min="-45" max="45" value={current.rotation} onChange={e => updateCurrent({ rotation: Number(e.target.value) })} /></label>
              <label className="range-label"><span>尺寸 <b>{Math.round(current.w)} px</b></span><input type="range" min="54" max="480" value={current.w} onChange={e => { const w = Number(e.target.value); updateCurrent({ w, h: current.h * w / current.w }); }} /></label>
              <div className="object-actions"><button onClick={() => setItems(prev => prev.map(i => i.uid === current.uid ? { ...i, rotation: 0 } : i))}>歸零</button><button onClick={() => { setItems(prev => [...prev.filter(i => i.uid !== current.uid), current]); }}>置頂</button></div>
            </> : <div className="no-selection"><span>◇</span><p>點選畫布中的素材<br />即可調整它的設定</p></div>}
          </div>
          <div className="tips"><span>TIP</span><p>選取素材後，拖曳右下角的青色方塊可以自由縮放。</p></div>
        </aside>
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
