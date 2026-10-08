// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN HOCHLADEN — EINE DATEI JE ANFRAGE, MIT BALKEN (E-IT-C, 08.10.2026)
//
// Für Kundenbereich (UnterlagenListe) und Akte (UnterlagenAkte) gleich:
//   · Fotos über 3 MB verkleinert schon der Browser (längste Kante 2.400 px,
//     nach EXIF gedreht) — spart Datenvolumen am Handy. Der Server verkleinert
//     ohnehin noch einmal und entfernt Metadaten; iPhone-HEIC wandelt er selbst.
//   · Jede Datei ist eine eigene Anfrage (XMLHttpRequest, damit es einen
//     Fortschritt gibt). Scheitert eine, bleibt sie mit „Erneut versuchen"
//     stehen — die anderen laufen weiter.
// Grenzen aus shared/fiaon-unterlagen.ts — keine eigene Zahl hier.
// ═══════════════════════════════════════════════════════════════════════════
import { UNTERLAGEN_GRENZEN } from "@shared/fiaon-unterlagen";

const VERKLEINERBAR = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/** Verkleinert ein großes Foto im Browser. Alles andere (PDF, HEIC) bleibt, wie es ist. */
export async function fuerUploadVorbereiten(datei: File): Promise<File> {
  try {
    if (!VERKLEINERBAR.includes(String(datei.type).toLowerCase())) return datei;
    if (datei.size <= UNTERLAGEN_GRENZEN.clientVerkleinernAbMb * 1024 * 1024) return datei;
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return datei;
    const bild = await createImageBitmap(datei, { imageOrientation: "from-image" } as any);
    const kante = UNTERLAGEN_GRENZEN.bildKante;
    const faktor = Math.min(1, kante / Math.max(bild.width, bild.height));
    const b = Math.max(1, Math.round(bild.width * faktor));
    const h = Math.max(1, Math.round(bild.height * faktor));
    const leinwand = document.createElement("canvas");
    leinwand.width = b; leinwand.height = h;
    const ctx = leinwand.getContext("2d");
    if (!ctx) return datei;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, b, h);
    ctx.drawImage(bild, 0, 0, b, h);
    bild.close?.();
    const blob: Blob | null = await new Promise((fertig) => leinwand.toBlob(fertig, "image/jpeg", 0.86));
    if (!blob || blob.size >= datei.size) return datei;
    const name = datei.name.replace(/\.[A-Za-z0-9]{1,5}$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: datei.lastModified });
  } catch {
    return datei;
  }
}

export interface UploadAntwort { ok: boolean; status: number; json: any }

/** Eine Datei, ein Fortschritt. `felder` gehen als Formularfelder mit (unterart, notiz, ersetzen, grund). */
export function dateiSenden(url: string, datei: File, felder: Record<string, string>, fortschritt?: (anteil: number) => void): Promise<UploadAntwort> {
  return new Promise((fertig) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(felder)) if (v != null && v !== "") fd.append(k, v);
    fd.append("datei", datei, datei.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && fortschritt) fortschritt(Math.min(1, e.loaded / Math.max(1, e.total))); };
    xhr.onload = () => {
      let json: any = null;
      try { json = JSON.parse(xhr.responseText); } catch { json = null; }
      fertig({ ok: xhr.status >= 200 && xhr.status < 300 && json?.ok !== false, status: xhr.status, json });
    };
    xhr.onerror = () => fertig({ ok: false, status: 0, json: null });
    xhr.ontimeout = () => fertig({ ok: false, status: 0, json: null });
    xhr.timeout = 10 * 60_000;
    xhr.send(fd);
  });
}

/** Zu groß schon vor dem Senden? (Der Server prüft es noch einmal.) */
export function zuGross(datei: File): boolean {
  return datei.size > UNTERLAGEN_GRENZEN.bytesJeDatei;
}

/** „vor 3 Min." ist nichts für eine Akte — Datum und Uhrzeit in Berlin. */
export function amText(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d);
}

export function tagText(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : "";
}
