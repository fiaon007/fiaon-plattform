// ═══════════════════════════════════════════════════════════════════════════
// EIGENE BESUCHERMESSUNG IM BROWSER (15.10.2026, E-378)
//
// Je Seitenwechsel EINE kleine Meldung an /api/fiaon/besuch, und beim Verlassen
// einer Seite (Wechsel, Tab im Hintergrund, Schließen) die sichtbare Zeit.
//
// Was hier NIE passiert (§ 25 TDDDG — darum braucht es keine Einwilligung):
//   · kein Cookie, kein localStorage, kein sessionStorage, keine Kennung im Gerät;
//   · keine vollständige Herkunftsadresse — nur ihr Host („google.com");
//   · keine Klick-Kennung — nur, OB fbclid/gclid in der Adresse stand;
//   · weder Fensterbreite noch Sprache — Gerät, Sprache und Land liest der Server aus
//     den Kopfzeilen, die jeder Aufruf ohnehin trägt.
// Wer ein Besucher ist, rechnet allein der Server (server/lib/fiaon-besuch.ts).
// Interne Bereiche, der Kundenbereich und automatisierte Browser melden nichts
// (shared/fiaon-besuch.ts). Die Messung darf nie stören: jeder Fehler wird still
// verworfen.
// ═══════════════════════════════════════════════════════════════════════════
import { besuchGezaehlt, type Kampagne } from "@shared/fiaon-besuch";

const ZIEL = "/api/fiaon/besuch";
/** Weiterleitungen in der App (/global → /business) melden nur die Seite, auf der man ankommt. */
const WARTEN_MS = 400;

interface Ansicht { pfad: string; sichtbarMs: number; seit: number | null }
let aktuell: Ansicht | null = null;
let ersteAnsicht = true;
let wartend: { pfad: string; zeitgeber: ReturnType<typeof setTimeout> } | null = null;
let angemeldet = false;

function senden(daten: Record<string, unknown>): void {
  try {
    const text = JSON.stringify(daten);
    if (typeof navigator !== "undefined" && navigator.sendBeacon
        && navigator.sendBeacon(ZIEL, new Blob([text], { type: "application/json" }))) return;
    void fetch(ZIEL, { method: "POST", headers: { "Content-Type": "application/json" }, body: text, keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch { /* Messung darf nie stören */ }
}

function roboter(): boolean {
  try { return typeof navigator !== "undefined" && (navigator as any).webdriver === true; } catch { return false; }
}

/** Nur der Host der Herkunft, nie die ganze Adresse. Eigene Seiten → null (das sortiert der Server ohnehin aus). */
function herkunftsHost(): string | null {
  try {
    if (!document.referrer) return null;
    const h = new URL(document.referrer).hostname;
    return h && h !== window.location.hostname ? h : null;
  } catch { return null; }
}

function kampagneAusAdresse(): { kampagne: Kampagne; fbclid: boolean; gclid: boolean } {
  const leer = { kampagne: { source: null, medium: null, campaign: null, content: null, term: null }, fbclid: false, gclid: false };
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      kampagne: {
        source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign"),
        content: q.get("utm_content"), term: q.get("utm_term"),
      },
      fbclid: q.has("fbclid"),
      gclid: q.has("gclid") || q.has("gbraid") || q.has("wbraid"),
    };
  } catch { return leer; }
}

/** Die sichtbare Zeit der laufenden Seite melden (aufsummiert — eine doppelte Meldung schadet nicht). */
function endeMelden(): void {
  if (!aktuell) return;
  if (aktuell.seit != null) { aktuell.sichtbarMs += performance.now() - aktuell.seit; aktuell.seit = null; }
  if (aktuell.sichtbarMs >= 1000) senden({ art: "ende", pfad: aktuell.pfad, ms: Math.round(aktuell.sichtbarMs) });
}

function ansichtMelden(pfad: string): void {
  endeMelden();
  const ursprung = ersteAnsicht ? kampagneAusAdresse() : { kampagne: null, fbclid: false, gclid: false };
  senden({
    art: "ansicht",
    pfad,
    herkunft: ersteAnsicht ? herkunftsHost() : null,
    kampagne: ursprung.kampagne,
    fbclid: ursprung.fbclid,
    gclid: ursprung.gclid,
  });
  ersteAnsicht = false;
  aktuell = { pfad, sichtbarMs: 0, seit: document.visibilityState === "visible" ? performance.now() : null };
}

function wartendeJetzt(): void {
  if (!wartend) return;
  clearTimeout(wartend.zeitgeber);
  const p = wartend.pfad;
  wartend = null;
  ansichtMelden(p);
}

function anmelden(): void {
  if (angemeldet) return;
  angemeldet = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { wartendeJetzt(); endeMelden(); }
    else if (aktuell && aktuell.seit == null) aktuell.seit = performance.now();
  });
  window.addEventListener("pagehide", () => { wartendeJetzt(); endeMelden(); });
}

/** Aus dem App-Rahmen bei jedem Wechsel des Pfads (App.tsx, BesuchMesser). */
export function besuchSeitenwechsel(pfad: string): void {
  if (typeof window === "undefined" || roboter()) return;
  if (!pfad || !besuchGezaehlt(pfad)) {
    // In einen internen Bereich gewechselt: die letzte öffentliche Seite abschließen, dann still.
    if (wartend) { clearTimeout(wartend.zeitgeber); wartend = null; }
    endeMelden();
    aktuell = null;
    return;
  }
  if (aktuell?.pfad === pfad && !wartend) return;
  anmelden();
  if (wartend) clearTimeout(wartend.zeitgeber);
  wartend = { pfad, zeitgeber: setTimeout(wartendeJetzt, WARTEN_MS) };
}
