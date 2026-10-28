import QRCode from "qrcode";

export type Settings = {
  qr: { x: number; y: number; s: number };           // fractions of output width
  txt: { x: number; y: number; w: number; h: number }; // fractions of output width/height
  fontPct: number;   // font size as % of output width
  color: string;
  bold: boolean;
  format: string;    // e.g. "No. {n}"
  quiet: boolean;    // white quiet zone behind the QR
  qrColor: string;
};

export const DEFAULTS: Settings = {
  qr: { x: 0.3, y: 0.3, s: 0.4 },
  txt: { x: 0.25, y: 0.75, w: 0.5, h: 0.08 },
  fontPct: 4,
  color: "#000000",
  bold: true,
  format: "No. {n}",
  quiet: true,
  qrColor: "#000000",
};

export const qrUrl = (domain: string, n: number) => `https://${domain}/qr/${n}`;

/** Level H error correction survives scratches and uneven UV printing. */
export function qrMatrix(text: string) {
  const q = QRCode.create(text, { errorCorrectionLevel: "H" });
  return { size: q.modules.size, get: (r: number, c: number) => q.modules.get(r, c) === 1 };
}

/** Draws one finished plate. Every module sits on whole-pixel boundaries so edges stay razor sharp. */
export function renderPlate(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  img: CanvasImageSource, n: number, domain: string, st: Settings
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);

  const m = qrMatrix(qrUrl(domain, n));
  const quiet = st.quiet ? 4 : 0;
  const total = m.size + quiet * 2;
  const box = Math.round(st.qr.s * W);
  const cell = Math.max(1, Math.floor(box / total));
  const real = cell * total;
  const ox = Math.round(st.qr.x * W) + Math.floor((box - real) / 2);
  const oy = Math.round(st.qr.y * W) + Math.floor((box - real) / 2);

  if (st.quiet) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ox, oy, real, real);
  }
  ctx.fillStyle = st.qrColor;
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++)
      if (m.get(r, c)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);

  const label = st.format.replace("{n}", String(n));
  if (label.trim()) {
    const fs = Math.round((st.fontPct / 100) * W);
    ctx.fillStyle = st.color;
    ctx.font = `${st.bold ? "700" : "400"} ${fs}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, Math.round((st.txt.x + st.txt.w / 2) * W), Math.round((st.txt.y + st.txt.h / 2) * H));
  }
}

/** Plain QR as a vector SVG, for print shops that prefer vector. */
export function qrSvg(n: number, domain: string, color: string) {
  const m = qrMatrix(qrUrl(domain, n));
  const q = 4, t = m.size + q * 2;
  let d = "";
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++)
      if (m.get(r, c)) d += `M${c + q},${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges">` +
    `<rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}

// ---- PNG print metadata: write the DPI so the print shop reads the true size ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function withDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const at = 8 + 25; // PNG signature (8) + IHDR chunk (25)
  const out = new Uint8Array(buf.length + chunk.length);
  out.set(buf.subarray(0, at), 0);
  out.set(chunk, at);
  out.set(buf.subarray(at), at + chunk.length);
  return new Blob([out], { type: "image/png" });
}
