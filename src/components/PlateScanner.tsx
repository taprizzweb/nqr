"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

const DOMAIN = process.env.NEXT_PUBLIC_SHORT_DOMAIN || "r.taprizz.in";

/** Reads the plate number from a Taprizz QR. Anything else is rejected. */
export function plateFromUrl(text: string): number | null {
  try {
    const u = new URL(text.trim());
    if (u.protocol !== "https:" || (u.host !== DOMAIN && u.host !== window.location.host)) return null;
    const m = u.pathname.match(/^\/qr\/(\d{1,6})\/?$/);
    return m ? Number.parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

export default function PlateScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);

  function stop() {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const tick = () => {
          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code) {
              const n = plateFromUrl(code.data);
              if (n) {
                stop();
                setOpen(false);
                router.push(`/rep/activate/${n}`);
                return;
              }
              setMsg("That QR is not a Taprizz plate. Scan the plate QR.");
            }
          }
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMsg("Camera is blocked. Allow camera access in your browser, or type the plate number instead.");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [open, router]);

  return (
    <div>
      {!open ? (
        <button onClick={() => { setMsg(""); setOpen(true); }}>Scan plate QR</button>
      ) : (
        <div>
          <video ref={video} playsInline muted style={{ width: "100%", maxHeight: 360, borderRadius: 12, background: "#000", objectFit: "cover" }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="ghost" onClick={() => setOpen(false)}>Close camera</button>
          </div>
        </div>
      )}
      {msg && <div className="msg warn" role="alert">{msg}</div>}
    </div>
  );
}
