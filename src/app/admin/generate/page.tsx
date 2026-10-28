import QrGenerator from "@/components/QrGenerator";

export default function GeneratePage() {
  return (
    <>
      <h1>QR generator</h1>
      <p className="muted">
        Puts the QR and the plate number into your fixed template and gives you print-ready PNGs.
        The same link also goes into the NFC tag (use Plates, then Export CSV).
      </p>
      <QrGenerator />
    </>
  );
}
