// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG DER ANTRAGSWEGE (05.10.2026, E-282)
//
// Justin: „führe Statistik darüber, ich will später wissen, wie der Weg
// performt und wie das alte". Beide Wege (neu = /antrag-neu, alt = /antrag)
// schreiben dieselben Ereignisse in fiaon_antrag_ereignisse — nur so lassen
// sich die Trichter Schritt für Schritt vergleichen.
//
// Was gemessen wird: welcher Bildschirm gezeigt wurde, wo ein Feld abgelehnt
// wurde (nur der Feldname, NIE der Inhalt), wann jemand die Seite verließ.
// Keine IP, keine Eingaben. Die Sitzung ist eine Zufallskennung je Tab.
//
// Gesendet wird gebündelt (alle 2 s oder beim Verlassen per sendBeacon), damit
// die Messung den Antrag nie bremst. Fehler werden still verworfen.
// ═══════════════════════════════════════════════════════════════════════════

export type AntragWeg = "neu" | "alt";

interface Ereignis {
  ereignis: string;
  schritt?: string;
  detail?: string;
  ref?: string;
}

const ZIEL = "/api/fiaon/antrag-neu/ereignis";
const SITZUNG_SCHLUESSEL = "fiaon_antrag_sitzung";

let warteschlange: { weg: AntragWeg; e: Ereignis }[] = [];
let zeitgeber: ReturnType<typeof setTimeout> | null = null;
let abmeldungAngemeldet = false;
let fluechtigeSitzung = "";

function neueKennung(): string {
  try {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Zufallskennung je Browser-Tab (sessionStorage). Ohne Speicher: je Seitenaufruf. */
export function antragSitzung(): string {
  try {
    let s = sessionStorage.getItem(SITZUNG_SCHLUESSEL);
    if (!s) {
      s = neueKennung();
      sessionStorage.setItem(SITZUNG_SCHLUESSEL, s);
    }
    return s;
  } catch {
    if (!fluechtigeSitzung) fluechtigeSitzung = neueKennung();
    return fluechtigeSitzung;
  }
}

function senden(beimVerlassen: boolean) {
  if (zeitgeber) { clearTimeout(zeitgeber); zeitgeber = null; }
  if (!warteschlange.length) return;
  const sitzung = antragSitzung();
  // Je Weg ein Paket (in der Praxis immer nur einer).
  const jeWeg = new Map<AntragWeg, Ereignis[]>();
  for (const { weg, e } of warteschlange.splice(0, 60)) {
    const l = jeWeg.get(weg) ?? [];
    l.push(e);
    jeWeg.set(weg, l);
  }
  for (const [weg, liste] of Array.from(jeWeg.entries())) {
    const body = JSON.stringify({ weg, sitzung, liste });
    try {
      if (beimVerlassen && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(ZIEL, new Blob([body], { type: "application/json" }));
      } else {
        void fetch(ZIEL, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {});
      }
    } catch { /* Messung darf nie stören */ }
  }
  if (warteschlange.length) zeitgeber = setTimeout(() => senden(false), 2000);
}

function abmeldenAnmelden() {
  if (abmeldungAngemeldet || typeof window === "undefined") return;
  abmeldungAngemeldet = true;
  window.addEventListener("pagehide", () => senden(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") senden(true); });
}

/**
 * Ein Ereignis vormerken. Vokabular (beide Wege):
 *   geoeffnet · schritt (schritt = Bildschirm) · fehler (detail = Feldname) ·
 *   angelegt (ref) · geprueft · pin_gesetzt · paket (detail = Paket) ·
 *   limit (detail = Euro) · vertrag_gelesen · angenommen · zahlung_gemeldet ·
 *   termin_gebucht · auskunft_gewaehlt · konto_betreten · verlassen
 */
export function antragEreignis(weg: AntragWeg, ereignis: string, o: { schritt?: string; detail?: string | number; ref?: string } = {}): void {
  if (typeof window === "undefined") return;
  abmeldenAnmelden();
  warteschlange.push({
    weg,
    e: {
      ereignis: String(ereignis).slice(0, 40),
      schritt: o.schritt ? String(o.schritt).slice(0, 40) : undefined,
      detail: o.detail != null ? String(o.detail).slice(0, 80) : undefined,
      ref: o.ref ? String(o.ref).slice(0, 40) : undefined,
    },
  });
  if (ereignis === "verlassen") { senden(true); return; }
  if (!zeitgeber) zeitgeber = setTimeout(() => senden(false), 2000);
}

/** Sofort senden (z. B. vor einem Seitenwechsel innerhalb der App). */
export function antragEreignisseSenden(): void {
  senden(false);
}
