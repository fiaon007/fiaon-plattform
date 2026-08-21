// ═══════════════════════════════════════════════════════════════════════════
// DIE PDF-WACHE — EINMAL BEIM START PRÜFEN, DANN SICHTBAR HALTEN
//
// ── DER AUSFALL (21.08.2026) ──────────────────────────────────────────────
// Der Betreiber wollte auszahlen. Chromium fehlte auf Render, das Drucken warf,
// die Auszahlung war gebucht — und der Beleg fehlte. „Neu erzeugen" lief in
// denselben Fehler.
//
// Der Fehler war seit dem letzten Deploy da. Aufgefallen ist er beim
// AUSZAHLEN, also am teuersten Moment. Genau das soll diese Wache verhindern.
//
// ── WAS SIE TUT ───────────────────────────────────────────────────────────
// Kurz nach dem Start einen leeren Browser hochfahren und wieder schließen.
// Das Ergebnis steht hier im Speicher und wird von `/admin/hub/knopfdurchgang`
// ausgeliefert — dieselbe Route, die auch die anderen Ampeln füttert.
//
// ── WAS SIE NICHT TUT ─────────────────────────────────────────────────────
// Sie sperrt nichts. Auszahlen bleibt möglich, und der pdfkit-Notbehelf
// (`fiaon-html-pdf.ts`) erzeugt weiter einen gültigen Beleg. Die Wache sagt
// nur, dass der gute Druck gerade nicht geht — vor dem Auszahlen, nicht danach.
//
// ── WARUM DIE PRÜFUNG NICHT BEI JEDEM AUFRUF LÄUFT ────────────────────────
// Ein Browserstart kostet je Versuch ein bis drei Sekunden. Bei jedem
// Dashboard-Aufruf wäre das eine spürbare Bremse für eine Auskunft, die sich
// nur bei einem Deploy ändert. Deshalb: einmal beim Start, danach auf Abruf
// (der Betreiber kann über den Knopf neu prüfen), und nach einem Fehlschlag
// alle 30 Minuten von selbst — ein Browser, der nach einem Neustart des
// Speichers wieder da ist, soll sich nicht erst am nächsten Deploy zeigen.
// ═══════════════════════════════════════════════════════════════════════════

import { pdfBrowserPruefen } from "./fiaon-html-pdf";

export interface PdfStand {
  ok: boolean;
  /** Warum nicht — der Klartext für die Karte. */
  grund: string | null;
  /** Wo Playwright gesucht hat. */
  ablage: string | null;
  geprueftAm: string;
  dauerMs: number;
}

let stand: PdfStand | null = null;
let laeuft: Promise<PdfStand> | null = null;

/** Nach einem Fehlschlag von selbst neu versuchen — halbstündlich. */
const NACHFASS_MS = 30 * 60 * 1000;

export function pdfStand(): PdfStand | null {
  return stand;
}

/**
 * Prüft und merkt sich das Ergebnis.
 *
 * `erneut = true` erzwingt eine neue Messung (für den Knopf im Dashboard).
 * Mehrfache gleichzeitige Aufrufe teilen sich EINEN Versuch — sonst starten
 * fünf Dashboard-Aufrufe fünf Browser.
 */
export async function pdfPruefen(erneut = false): Promise<PdfStand> {
  if (!erneut && stand) return stand;
  if (laeuft) return laeuft;
  laeuft = (async () => {
    const e = await pdfBrowserPruefen();
    stand = {
      ok: e.ok,
      grund: e.grund,
      ablage: e.ablage,
      geprueftAm: new Date().toISOString(),
      dauerMs: e.dauerMs,
    };
    if (e.ok) {
      console.log(`[PDF-WACHE] Chromium startet (${e.dauerMs} ms`
        + `${e.ablage ? `, Ablage ${e.ablage}` : ", Standard-Ablage"}).`);
    } else {
      // Laut und mit Handlungsanweisung: Diese Zeile ist das Erste, was jemand
      // im Render-Protokoll findet, wenn ein Beleg fehlt.
      console.error("[PDF-WACHE] Chromium startet NICHT — Belege können nur als "
        + "Notbehelf gedruckt werden.");
      console.error(`[PDF-WACHE] Grund: ${e.grund}`);
      console.error(`[PDF-WACHE] Gesucht in: ${e.ablage ?? "Standard (~/.cache/ms-playwright)"}`);
      console.error("[PDF-WACHE] Behebung: im Build muss `npm run pdf:browser` gelaufen sein, "
        + "und PLAYWRIGHT_BROWSERS_PATH muss in Build UND Laufzeit auf dasselbe "
        + "Verzeichnis zeigen (Vorgabe: $PWD/.playwright).");
    }
    laeuft = null;
    return stand;
  })();
  return laeuft;
}

/**
 * Beim Serverstart einmal prüfen — verzögert, damit der Start nicht wartet.
 *
 * 20 Sekunden: Der Prozess soll erst Anfragen annehmen können. Ein
 * Browserstart, der den Port blockiert, wäre schlimmer als der Befund.
 */
export function pdfWacheStarten(): void {
  setTimeout(() => {
    void pdfPruefen().then((s) => {
      if (s.ok) return;
      // Zusätzlich ins Protokoll der Anwendung: Eine Konsolenzeile ist nach
      // einem Neustart weg, ein Eintrag bleibt.
      void import("./db-pool").then(({ sqlPool }) => sqlPool`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (NULL, 'pdf_browser_fehlt',
                ${JSON.stringify({ grund: s.grund, ablage: s.ablage })},
                'System',
                ${"Chromium startet nicht — Belege werden nur als Notbehelf gedruckt. "
                  + String(s.grund ?? "")})
      `).catch((e) => console.error("[PDF-WACHE] Protokolleintrag nicht geschrieben:", e));
    });
  }, 20_000);

  // Nachfassen, solange es nicht geht.
  setInterval(() => {
    if (stand?.ok) return;
    void pdfPruefen(true);
  }, NACHFASS_MS);
}
