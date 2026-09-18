// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG UND ANZEIGEN-ZUORDNUNG (19.09.2026, E-191)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// client/src/lib/analytics.ts kannte eine GA4-Kennung, aber das Google-Tag
// wurde nie geladen: fiaon.com maß nichts, und kein Auftrag wusste, ob er aus
// einer Anzeige kam. Ohne Messung ist jede Anzeige blind (Google kann weder
// Gebote noch Zielgruppen lernen).
//
// ── WAS HIER GILT ─────────────────────────────────────────────────────────
// · Die Kennungen kommen aus Render (Umgebungsvariablen) — Justin trägt sie
//   ein, ohne dass jemand Code ändert: GA4_MESSUNG_ID (G-…), GOOGLE_ADS_ID
//   (AW-…), GOOGLE_ADS_LABEL_GESPRAECH, GOOGLE_ADS_LABEL_AUFTRAG. Fehlt eine,
//   bleibt die Messung dafür aus. Die alte Kennung aus analytics.ts wird NICHT
//   benutzt — niemand wusste, wem das Konto gehört.
// · Geladen wird erst nach Einwilligung (Cookie-Hinweis, Consent Mode v2 in
//   der Grundform). Der Server speichert Klick-Kennungen (gclid, utm) nur,
//   wenn der Browser sie mitschickt — und der schickt sie nur mit, wenn die
//   Einwilligung für Marketing vorliegt oder die Handlung auf derselben Seite
//   geschieht, auf der der Klick ankam (dann liegt nichts auf dem Gerät).
// · Eine Tabelle für alle Zuordnungen: Termin, Anfrage, Auftrag. Damit lassen
//   sich später Offline-Conversions („Zahlung eingegangen") an Google Ads
//   zurückspielen — die stärkste Rückmeldung, die ein Auftrag geben kann.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export interface MessKonfig {
  ga4: string | null;
  ads: string | null;
  labels: { gespraech: string | null; auftrag: string | null };
  clarity: string | null;
}

const muster = (v: unknown, re: RegExp) => { const s = String(v ?? "").trim(); return re.test(s) ? s : null; };

export function messKonfig(): MessKonfig {
  return {
    ga4: muster(process.env.GA4_MESSUNG_ID, /^G-[A-Z0-9]{4,16}$/),
    ads: muster(process.env.GOOGLE_ADS_ID, /^AW-\d{6,14}$/),
    labels: {
      gespraech: muster(process.env.GOOGLE_ADS_LABEL_GESPRAECH, /^[A-Za-z0-9_-]{6,40}$/),
      auftrag: muster(process.env.GOOGLE_ADS_LABEL_AUFTRAG, /^[A-Za-z0-9_-]{6,40}$/),
    },
    // Microsoft Clarity lief bis hier ohne Einwilligung (main.tsx). Die Kennung
    // bleibt dieselbe; geladen wird ab jetzt erst nach Zustimmung zur Statistik.
    clarity: muster(process.env.CLARITY_ID ?? "wf58sx5vcm", /^[a-z0-9]{6,16}$/),
  };
}

export interface Kampagne {
  gclid: string | null; gbraid: string | null; wbraid: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null; utm_content: string | null;
  landing: string | null;
}

const feld = (v: unknown, max = 200) => {
  const s = String(v ?? "").replace(/[\u0000-\u001f<>"'`]/g, "").trim().slice(0, max);
  return s || null;
};

/** Was der Browser mitschickt, sauber und begrenzt — oder null, wenn nichts dabei ist. */
export function kampagneLesen(roh: unknown): Kampagne | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const k: Kampagne = {
    gclid: feld(r.gclid, 300), gbraid: feld(r.gbraid, 300), wbraid: feld(r.wbraid, 300),
    utm_source: feld(r.utm_source, 120), utm_medium: feld(r.utm_medium, 120), utm_campaign: feld(r.utm_campaign, 200),
    utm_term: feld(r.utm_term, 200), utm_content: feld(r.utm_content, 200),
    landing: feld(r.landing, 300),
  };
  return Object.entries(k).some(([s, v]) => s !== "landing" && v) ? k : null;
}

let tabelleDa: Promise<void> | null = null;
function tabelle(): Promise<void> {
  if (!tabelleDa) {
    tabelleDa = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_werbe_zuordnung (
          id SERIAL PRIMARY KEY,
          art VARCHAR(20) NOT NULL,
          bezug VARCHAR(80) NOT NULL,
          gclid VARCHAR(300), gbraid VARCHAR(300), wbraid VARCHAR(300),
          utm_source VARCHAR(120), utm_medium VARCHAR(120), utm_campaign VARCHAR(200),
          utm_term VARCHAR(200), utm_content VARCHAR(200), landing VARCHAR(300),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_werbe_zuordnung_bezug_idx ON fiaon_werbe_zuordnung (art, bezug)`;
    })().catch((e) => { tabelleDa = null; throw e; });
  }
  return tabelleDa;
}

/** Hält fest, dass ein Termin, eine Anfrage oder ein Auftrag aus einer Anzeige oder Kampagne kam. Fehler brechen nichts ab. */
export async function kampagneSpeichern(art: "termin" | "anfrage" | "auftrag", bezug: string | number | null | undefined, roh: unknown): Promise<void> {
  const k = kampagneLesen(roh);
  if (!k || bezug == null || bezug === "") return;
  try {
    await tabelle();
    await sqlPool`
      INSERT INTO fiaon_werbe_zuordnung (art, bezug, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing)
      VALUES (${art}, ${String(bezug)}, ${k.gclid}, ${k.gbraid}, ${k.wbraid}, ${k.utm_source}, ${k.utm_medium}, ${k.utm_campaign}, ${k.utm_term}, ${k.utm_content}, ${k.landing})`;
    // Speicherdauer (Datenschutzerklärung VI.4): höchstens 13 Monate — beim Schreiben gleich mit aufgeräumt.
    await sqlPool`DELETE FROM fiaon_werbe_zuordnung WHERE created_at < NOW() - INTERVAL '13 months'`.catch(() => {});
  } catch (e) {
    console.error(`[WERBUNG] Zuordnung ${art} ${bezug} nicht gespeichert:`, String(e).slice(0, 200));
  }
}
