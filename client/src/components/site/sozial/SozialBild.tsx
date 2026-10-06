// ═══════════════════════════════════════════════════════════════════════════
// EIN BILD DES SOCIAL-FEEDS (E-296, Prüfung 06.10.2026)
//
// Kacheln, Karten und der Ratgeber-Beitrag laden die Bilder über die öffentliche
// Bild-Route (Drossel, Regel bei jeder Anfrage). Antwortet sie nicht mit einem
// Bild (429, 404 nach dem Ausschalten, Netz weg), steht statt des Zeichens für
// ein kaputtes Bild eine ruhige Fläche in Markenfarbe — Maße bleiben (width/
// height bzw. das Seitenverhältnis des Rahmens), nichts springt.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";

export function SozialBild({ src, width, height, alt = "", lang, laden = "lazy" }: { src: string; width: number; height: number; alt?: string; lang?: string; laden?: "lazy" | "eager" }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) {
    return alt
      ? <span className="sz-bild-ersatz" role="img" aria-label={alt} lang={lang} />
      : <span className="sz-bild-ersatz" aria-hidden="true" />;
  }
  return <img src={src} alt={alt} lang={lang} width={width} height={height} loading={laden} decoding="async" draggable={false} onError={() => setKaputt(true)} />;
}

export default SozialBild;
