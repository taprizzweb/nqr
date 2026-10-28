"use client";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { DEFAULTS, Settings, qrSvg, renderPlate, withDpi } from "@/lib/plateRender";

const DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || "r.taprizz.in";
const KEY = "taprizz-template-settings-v1";
const PLATE_CM = 11;
const PER_ZIP = 100; // keeps browser memory safe at 600 DPI

export default function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [st, setSt] = useState<Settings>(DEFAULTS);
  const [outW, setOutW] = useState(2598); // 11 cm at 600 DPI
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("75");
  const [svg, setSvg] = useState(false);
  const [mark, setMark] = useState<"qr" | "txt">("qr");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setSt({ ...DEFAULTS, ...JSON.parse(s) });
    } catch { /* settings are a convenience only */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
  }, [st]);

  const aspect = img ? img.naturalHeight / img.naturalWidth : 1;
  const dpi = Math.round(outW / (PLATE_CM / 2.54));

  // live preview with the first number in the range
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const W = 900, H = Math.round(900 * aspect);
    c.width = W; c.height = H;
    renderPlate(c.getContext("2d")!, W, H, img, Math.max(1, Number(from) || 1), DOMAIN, st);
    const g = c.getContext("2d")!;
    g.strokeStyle = "#dc2626"; g.lineWidth = 2; g.setLineDash([6, 4]);
    g.strokeRect(st.qr.x * W, st.qr.y * W, st.qr.s * W, st.qr.s * W);
    g.strokeStyle = "#2563eb";
    g.strokeRect(st.txt.x * W, st.txt.y * H, st.txt.w * W, st.txt.h * H);
  }, [img, st, from, aspect]);

  function onFile(f: File | undefined) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { setImg(im); if (outW < im.naturalWidth && im.naturalWidth <= 6000) setOutW(im.naturalWidth); };
    im.src = url;
  }

  function pt(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function down(e: React.PointerEvent) { drag.current = pt(e); (e.target as Element).setPointerCapture(e.pointerId); }
  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const a = drag.current, b = pt(e);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    if (mark === "qr") {
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y) / aspect);
      setSt((o) => ({ ...o, qr: { x, y: y * aspect, s } }));
    } else {
      setSt((o) => ({ ...o, txt: { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) } }));
    }
  }
  function up() { drag.current = null; }

  async function generate() {
    if (!img) return;
    const a = Math.max(1, Number(from)), b = Number(to);
    if (!b || b < a || b - a > 5999) { setProgress("Enter a valid range (up to 6,000 at a time)."); return; }
    setBusy(true);
    const W = outW, H = Math.round(outW * aspect);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    let zip = new JSZip(), inZip = 0, part = 1, first = a;

    const flush = async (last: number) => {
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `taprizz-plates-${first}-${last}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      zip = new JSZip(); inZip = 0; part++;
      await new Promise((r) => setTimeout(r, 600));
    };

    for (let n = a; n <= b; n++) {
      if (inZip === 0) first = n;
      renderPlate(ctx, W, H, img, n, DOMAIN, st);
      const png = await new Promise<Blob>((res) => c.toBlob((x) => res(x!), "image/png"));
      const name = String(n).padStart(4, "0");
      zip.file(`qr-${name}.png`, await withDpi(png, dpi));
      if (svg) zip.file(`qr-${name}.svg`, qrSvg(n, DOMAIN, st.qrColor));
      inZip++;
      setProgress(`Making plate ${n} of ${b}...`);
      if (inZip >= PER_ZIP) await flush(n);
      else if (n % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    if (inZip > 0) await flush(b);
    setProgress(`Done. ${b - a + 1} plates made in ${part - 1} ZIP file(s). If your browser asked, allow multiple downloads.`);
    setBusy(false);
  }

  const num = (v: number, set: (n: number) => void, step = 0.01) => (
    <input type="number" step={step} value={Number(v.toFixed(3))} onChange={(e) => set(Number(e.target.value))} />
  );

  return (
    <>
      <div className="card">
        <h2>1. Upload your template</h2>
        <p className="muted">
          Your finished design with &quot;Scan QR Code&quot; already written and a blank spot for the QR.
          Use the highest resolution you have. Your design is never changed apart from the QR and the number.
        </p>
        <input type="file" accept="image/png,image/jpeg" aria-label="Template image"
          onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {img && (
        <>
          <div className="card">
            <h2>2. Mark the QR spot and the number spot</h2>
            <div className="row" style={{ marginBottom: 8 }}>
              <button className={mark === "qr" ? "" : "ghost"} onClick={() => setMark("qr")}>Mark QR spot (red)</button>
              <button className={mark === "txt" ? "" : "ghost"} onClick={() => setMark("txt")}>Mark number spot (blue)</button>
            </div>
            <p className="muted">Drag on the picture to draw the box. The preview shows the first number in your range.</p>
            <canvas ref={canvasRef} style={{ touchAction: "none", cursor: "crosshair", width: "100%" }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} aria-label="Template preview" />

            <div className="row" style={{ marginTop: 12 }}>
              <div><label>QR left</label>{num(st.qr.x, (v) => setSt({ ...st, qr: { ...st.qr, x: v } }))}</div>
              <div><label>QR top</label>{num(st.qr.y, (v) => setSt({ ...st, qr: { ...st.qr, y: v } }))}</div>
              <div><label>QR size</label>{num(st.qr.s, (v) => setSt({ ...st, qr: { ...st.qr, s: v } }))}</div>
            </div>
            <div className="row">
              <div><label>Text left</label>{num(st.txt.x, (v) => setSt({ ...st, txt: { ...st.txt, x: v } }))}</div>
              <div><label>Text top</label>{num(st.txt.y, (v) => setSt({ ...st, txt: { ...st.txt, y: v } }))}</div>
              <div><label>Text width</label>{num(st.txt.w, (v) => setSt({ ...st, txt: { ...st.txt, w: v } }))}</div>
              <div><label>Text height</label>{num(st.txt.h, (v) => setSt({ ...st, txt: { ...st.txt, h: v } }))}</div>
            </div>
            <div className="row">
              <div><label>Number text</label>
                <input value={st.format} onChange={(e) => setSt({ ...st, format: e.target.value })} /></div>
              <div><label>Font size (% of width)</label>{num(st.fontPct, (v) => setSt({ ...st, fontPct: v }), 0.1)}</div>
              <div><label>Text colour</label>
                <input type="color" value={st.color} onChange={(e) => setSt({ ...st, color: e.target.value })} /></div>
              <div><label>QR colour</label>
                <input type="color" value={st.qrColor} onChange={(e) => setSt({ ...st, qrColor: e.target.value })} /></div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={st.bold}
                  onChange={(e) => setSt({ ...st, bold: e.target.checked })} /> Bold number
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={st.quiet}
                  onChange={(e) => setSt({ ...st, quiet: e.target.checked })} /> White margin around QR (recommended)
              </label>
            </div>
          </div>

          <div className="card">
            <h2>3. Make the plates</h2>
            <div className="row">
              <div><label htmlFor="gf">From number</label>
                <input id="gf" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} /></div>
              <div><label htmlFor="gt">To number</label>
                <input id="gt" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} /></div>
              <div><label htmlFor="gw">Output width (px)</label>
                <input id="gw" type="number" value={outW} onChange={(e) => setOutW(Number(e.target.value))} /></div>
            </div>
            <p className="muted">
              {outW} px on an {PLATE_CM} cm plate = <b>{dpi} DPI</b>, saved inside each PNG.
              Short link: https://{DOMAIN}/qr/{from || 1}. ZIPs are split every {PER_ZIP} plates.
            </p>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={svg} onChange={(e) => setSvg(e.target.checked)} />
              Also include a plain vector QR (SVG) for each number
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={generate} disabled={busy}>{busy ? "Working..." : "Generate and download"}</button>
            </div>
            {progress && <div className="msg ok" role="status">{progress}</div>}
          </div>
        </>
      )}
    </>
  );
}
