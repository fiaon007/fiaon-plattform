// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Einführungs-Rundgang: Gesehen-Merker (23.08.2026, Plan §4/§11)
//
// Der geführte Rundgang (client/src/components/agent/Einfuehrung.tsx) öffnet
// sich beim ERSTEN Login automatisch. Ob jemand ihn schon gesehen hat, ist
// eine Eigenschaft des KONTOS, nicht des Browsers — deshalb liegt der Merker
// hier und nicht (nur) im localStorage. localStorage ist nur der schnelle
// Cache, damit nicht jeder Seitenwechsel den Server fragt.
//
//   GET  /agent/einfuehrung   → { ok, gesehen, zeit }
//   POST /agent/einfuehrung   → merkt „gesehen“ (beim Abschluss ODER beim
//                               Überspringen — beides heißt: nicht mehr
//                               automatisch zeigen; neu starten geht immer
//                               über More bzw. die Raumliste)
//
// Tabelle fiaon_agent_flags ist bewusst allgemein (agent_id, flag, wert,
// zeit): weitere Einmal-Hinweise können denselben Ort nutzen, ohne dass je
// Hinweis eine neue Tabelle entsteht. Datenbank ist Produktion — nur
// CREATE TABLE IF NOT EXISTS, nichts Bestehendes wird angefasst.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();
const FLAG = "einfuehrung_gesehen";

let geprueft = false;
async function ensureFlagsTabelle(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_flags (
      agent_id INTEGER NOT NULL,
      flag VARCHAR NOT NULL,
      wert VARCHAR NOT NULL DEFAULT 'ja',
      zeit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (agent_id, flag)
    )`;
  geprueft = true;
}

/** GET /agent/einfuehrung — hat dieses Konto den Rundgang schon gesehen? */
router.get("/agent/einfuehrung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    const rows = (await sqlPool`
      SELECT wert, zeit FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag = ${FLAG}
    `) as any[];
    res.json({ ok: true, gesehen: rows.length > 0, zeit: rows[0]?.zeit ?? null });
  } catch (err) {
    console.error("[OFFICE-EINFUEHRUNG]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/einfuehrung — „gesehen“ merken (idempotent). */
router.post("/agent/einfuehrung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    await sqlPool`
      INSERT INTO fiaon_agent_flags (agent_id, flag, wert)
      VALUES (${req.agent!.id}, ${FLAG}, 'ja')
      ON CONFLICT (agent_id, flag) DO UPDATE SET wert = 'ja', zeit = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-EINFUEHRUNG] merken:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE RUNDGÄNGE JE RAUM — 24.08.2026
//
// Justin: „JEDE Seite, die man öffnet, soll eine Einführung geben und
// genauestens beschreiben, wofür was ist, wie was geht — und mach es
// realitätsnah. Jede Seite braucht einen dezenten Button, dass man das immer
// wieder abspielen kann."
//
// VORHER gab es EINEN Rundgang fürs ganze Office, einmalig beim ersten Login.
// Wer drei Wochen später zum ersten Mal in den Bestand-Raum kam, bekam nichts.
// NACHHER hat jeder Raum seinen eigenen Rundgang; gemerkt wird je Raum.
//
// Der Merker gehört zum KONTO, nicht zum Browser — wer das Gerät wechselt,
// soll den Rundgang nicht noch einmal vorgesetzt bekommen. Genutzt wird
// dieselbe allgemeine Tabelle wie oben (fiaon_agent_flags), mit dem Präfix
// „rundgang_". Eine eigene Tabelle je Hinweis wäre Verschwendung.
//
//   GET  /agent/rundgaenge        → { ok, gesehen: ["bestand", "pipeline"] }
//   POST /agent/rundgaenge/:raum  → merkt diesen Raum als gesehen
//   DELETE /agent/rundgaenge      → alle wieder auf ungesehen (für „nochmal
//                                   von vorn", z. B. beim Einlernen)
// ═══════════════════════════════════════════════════════════════════════════
const RUNDGANG_PRAEFIX = "rundgang_";
/** Nur Kleinbuchstaben, Ziffern und Bindestrich — kein Raumname aus dem Netz
 *  darf zu einem beliebigen Flag werden. */
const RAUM_MUSTER = /^[a-z0-9-]{1,40}$/;

router.get("/agent/rundgaenge", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    const rows = (await sqlPool`
      SELECT flag FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag LIKE ${RUNDGANG_PRAEFIX + "%"}
    `) as any[];
    res.json({ ok: true, gesehen: rows.map((r) => String(r.flag).slice(RUNDGANG_PRAEFIX.length)) });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] lesen:", err);
    // Ein Fehler hier darf keine Seite blockieren: Im Zweifel gilt „noch
    // nicht gesehen" nicht — sonst poppt bei einer Störung überall der
    // Rundgang auf. Lieber einmal zu wenig zeigen als überall stören.
    res.json({ ok: true, gesehen: [] as string[], fehler: true });
  }
});

router.post("/agent/rundgaenge/:raum", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const raum = String(req.params.raum || "").trim().toLowerCase();
    if (!RAUM_MUSTER.test(raum)) return res.status(400).json({ ok: false, error: "Unbekannter Raum." });
    await ensureFlagsTabelle();
    await sqlPool`
      INSERT INTO fiaon_agent_flags (agent_id, flag, wert)
      VALUES (${req.agent!.id}, ${RUNDGANG_PRAEFIX + raum}, 'ja')
      ON CONFLICT (agent_id, flag) DO UPDATE SET wert = 'ja', zeit = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] merken:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.delete("/agent/rundgaenge", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    await sqlPool`
      DELETE FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag LIKE ${RUNDGANG_PRAEFIX + "%"}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] zuruecksetzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DAS WETTER IN DER BEGRÜSSUNG
//
// Justin, 24.08.2026: „Mach daraus ‚Guten Tag, Justin. Es ist 00:00 Uhr, das
// Wetter an deinem heutigen Standort ist stürmisch. Wir wünschen dir einen
// erfolgreichen Tag!'"
//
// ── WOHER DER STANDORT KOMMT ───────────────────────────────────────────────
// NICHT über eine Standortabfrage im Browser: Die fragt bei jedem Anmelden
// nach Erlaubnis, und für einen Halbsatz in der Kopfzeile ist das zu viel.
// NICHT über einen IP-Dienst: Dann liefen die IP-Adressen der Mitarbeiter
// täglich an einen Dritten, für eine Nettigkeit.
// SONDERN über die ZEITZONE, die der Browser ohnehin kennt
// (Intl.DateTimeFormat().resolvedOptions().timeZone). Sie ist grob — sie
// unterscheidet Hamburg nicht von München — aber sie unterscheidet Berlin von
// Wien und Zürich, und mehr braucht es hier nicht. Keine Erlaubnis, kein
// Zugriff, keine personenbezogene Übertragung.
//
// Das Wetter kommt von Open-Meteo: kostenlos, ohne Schlüssel, ohne Konto. Wir
// schicken dorthin NUR zwei Koordinaten aus der Tabelle unten — nie eine IP,
// nie einen Namen.
// ═══════════════════════════════════════════════════════════════════════════
const ZEITZONEN: Record<string, { ort: string; lat: number; lon: number }> = {
  "Europe/Berlin":    { ort: "Deutschland",  lat: 52.52, lon: 13.40 },
  "Europe/Vienna":    { ort: "Österreich",   lat: 48.21, lon: 16.37 },
  "Europe/Zurich":    { ort: "Schweiz",      lat: 47.37, lon: 8.54 },
  "Europe/London":    { ort: "London",       lat: 51.51, lon: -0.13 },
  "Europe/Madrid":    { ort: "Spanien",      lat: 40.42, lon: -3.70 },
  "Europe/Lisbon":    { ort: "Portugal",     lat: 38.72, lon: -9.14 },
  "Europe/Warsaw":    { ort: "Polen",        lat: 52.23, lon: 21.01 },
  "Europe/Prague":    { ort: "Tschechien",   lat: 50.08, lon: 14.44 },
  "Europe/Budapest":  { ort: "Ungarn",       lat: 47.50, lon: 19.04 },
  "Europe/Bucharest": { ort: "Rumänien",     lat: 44.43, lon: 26.10 },
  "Europe/Sofia":     { ort: "Bulgarien",    lat: 42.70, lon: 23.32 },
  "Europe/Athens":    { ort: "Griechenland", lat: 37.98, lon: 23.73 },
  "Europe/Istanbul":  { ort: "Türkei",       lat: 41.01, lon: 28.98 },
  "Asia/Dubai":       { ort: "Dubai",        lat: 25.20, lon: 55.27 },
};
const STANDARD_ORT = ZEITZONEN["Europe/Berlin"];

/**
 * WMO-Wettercodes in einen Satzteil, der sich lesen lässt.
 *
 * Bewusst als Eigenschaftswort formuliert, damit Justins Satz aufgeht:
 * „das Wetter an deinem heutigen Standort ist …".
 */
function wetterWort(code: number): { wort: string; zeichen: string } {
  if (code === 0) return { wort: "klar und sonnig", zeichen: "☀️" };
  if (code <= 2) return { wort: "leicht bewölkt", zeichen: "🌤️" };
  if (code === 3) return { wort: "bedeckt", zeichen: "☁️" };
  if (code <= 48) return { wort: "neblig", zeichen: "🌫️" };
  if (code <= 55) return { wort: "nieselig", zeichen: "🌦️" };
  if (code <= 57) return { wort: "eisig-nieselig", zeichen: "🌧️" };
  if (code <= 65) return { wort: "regnerisch", zeichen: "🌧️" };
  if (code <= 67) return { wort: "eisregnerisch", zeichen: "🌧️" };
  if (code <= 77) return { wort: "verschneit", zeichen: "🌨️" };
  if (code <= 82) return { wort: "von Schauern durchzogen", zeichen: "🌧️" };
  if (code <= 86) return { wort: "von Schneeschauern durchzogen", zeichen: "🌨️" };
  if (code <= 99) return { wort: "stürmisch mit Gewittern", zeichen: "⛈️" };
  return { wort: "wechselhaft", zeichen: "🌥️" };
}

/**
 * Zwischenspeicher je Ort, eine halbe Stunde.
 *
 * Ohne ihn ginge bei jedem Seitenaufruf jedes Mitarbeiters ein Aufruf nach
 * draußen — für eine Zahl, die sich stündlich ändert.
 */
const wetterSpeicher = new Map<string, { bis: number; daten: any }>();

router.get("/agent/wetter", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const tz = String(req.query.tz || "");
    const ort = ZEITZONEN[tz] ?? STANDARD_ORT;
    const schluessel = ort.lat + "," + ort.lon;
    const jetzt = Date.now();

    const gemerkt = wetterSpeicher.get(schluessel);
    if (gemerkt && gemerkt.bis > jetzt) return res.json({ ok: true, ...gemerkt.daten });

    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + ort.lat
      + "&longitude=" + ort.lon + "&current=temperature_2m,weather_code&timezone=auto";
    const steuerung = new AbortController();
    const frist = setTimeout(() => steuerung.abort(), 4000);
    const antwort = await fetch(url, { signal: steuerung.signal }).catch(() => null);
    clearTimeout(frist);

    // Kein Wetter ist kein Fehler: Die Kopfzeile lässt den Halbsatz dann weg
    // und grüßt trotzdem. Eine Fehlermeldung wegen des Wetters wäre absurd.
    if (!antwort || !antwort.ok) return res.json({ ok: true, ort: ort.ort, wetter: null });

    const j: any = await antwort.json().catch(() => null);
    const code = Number(j?.current?.weather_code);
    const grad = Number(j?.current?.temperature_2m);
    if (!Number.isFinite(code)) return res.json({ ok: true, ort: ort.ort, wetter: null });

    const { wort, zeichen } = wetterWort(code);
    const daten = {
      ort: ort.ort,
      wetter: { wort, zeichen, grad: Number.isFinite(grad) ? Math.round(grad) : null },
    };
    wetterSpeicher.set(schluessel, { bis: jetzt + 30 * 60_000, daten });
    res.json({ ok: true, ...daten });
  } catch (err) {
    console.error("[WETTER]:", err);
    res.json({ ok: true, ort: STANDARD_ORT.ort, wetter: null });
  }
});

export default router;
