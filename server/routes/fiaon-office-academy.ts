// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — ACADEMY: Ausbildung zum Bonitätsmanager (23.08.2026)
//
// Plan: 01_Plattform/MITARBEITER_OFFICE_PLAN_2026-08-23.md §4 (Raum 7), §11.
// Der Lehrplan (Kapitel, Schritte, Mindestlesezeiten) liegt in
// shared/fiaon-academy-lehrplan.ts, der Prüfungspool in
// server/lib/fiaon-academy-pruefung.ts (Lösungen verlassen den Server nie).
//
//   GET  /agent/academy/fortschritt          → Stand je Schritt, Kapitel-Freigaben, Prozent, Prüfung, Urkunde
//   POST /agent/academy/fortschritt          { kapitel, schritt, aktion: "oeffnen"|"fertig", punkte?, gesamt?, ergebnis? }
//                                              Server misst die Lesezeit: „fertig“ erst nach minSekunden.
//   GET  /agent/academy/szenarien            → Szenarien des Anruf-Simulators
//   POST /agent/academy/simulator            { szenario, nachrichten[], beenden? } → Antwort des KI-Kunden oder Bewertung
//   POST /agent/academy/pruefung/start       → Sitzung + 25 Fragen ohne Lösungen
//   POST /agent/academy/pruefung/antwort     { sitzung, frageId, antwort, tabwechsel? }
//   POST /agent/academy/pruefung/abschluss   { sitzung, tabwechsel? } → Ergebnis, bei ≥ 85 % Urkunde
//   GET  /agent/academy/urkunde.pdf          → Urkunde (nur Bestandene)
//   GET  /agent/academy/uebersicht           → alle Mitarbeiter mit Prozent/Prüfung (Leitung; Admin hängt Justin ein)
//   export provisionsBonus(agentId)          → 0.05 für Zertifizierte, sonst 0
//
// Tabellen (nur neue, Produktion): fiaon_academy_lehrgang, fiaon_academy_pruefungen,
// fiaon_academy_zertifikate. Die ältere Tabelle fiaon_academy_fortschritt (Reisen
// der alten Academy) bleibt unangetastet.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { LEHRPLAN, UEBUNGS_ARTEN, TEST_SCHWELLE, PRUEFUNG_SCHWELLE, PRUEFUNG_FRAGEN, PRUEFUNG_SEKUNDEN_JE_FRAGE, PRUEFUNG_SEKUNDEN_GESAMT, PRUEFUNG_SPERRE_STUNDEN, PRUEFUNG_VERSUCHE_JE_WOCHE, ZERTIFIKAT_PROVISIONS_BONUS, ZERTIFIKAT_STUFE, lehrplanKapitel, lehrplanSchritt, SCHRITTE_GESAMT } from "@shared/fiaon-academy-lehrplan";
import { PRUEFUNGS_POOL, pruefungZiehen, mischen } from "../lib/fiaon-academy-pruefung";
import { wissenText, SUPPORT } from "@shared/fiaon-wissen";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const router = Router();

// ── Tabellen ──────────────────────────────────────────────────────────────
let geprueft = false;
export async function ensureAcademyLehrgang(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_academy_lehrgang (
      agent_id        INTEGER NOT NULL,
      kapitel         VARCHAR(32) NOT NULL,
      schritt         VARCHAR(40) NOT NULL,
      geoeffnet_am    TIMESTAMPTZ,
      bestanden       BOOLEAN NOT NULL DEFAULT FALSE,
      bestanden_am    TIMESTAMPTZ,
      punkte          INTEGER,
      gesamt          INTEGER,
      ergebnis        JSONB,
      zeit            INTEGER NOT NULL DEFAULT 0,
      aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (agent_id, kapitel, schritt)
    )`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_academy_pruefungen (
      id             SERIAL PRIMARY KEY,
      agent_id       INTEGER NOT NULL,
      gestartet_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      beendet_am     TIMESTAMPTZ,
      fragen         JSONB NOT NULL,
      antworten      JSONB NOT NULL DEFAULT '{}'::jsonb,
      gestellt_am    TIMESTAMPTZ,
      punkte         INTEGER,
      gesamt         INTEGER,
      bestanden      BOOLEAN,
      tabwechsel     INTEGER NOT NULL DEFAULT 0,
      status         VARCHAR(16) NOT NULL DEFAULT 'laeuft'
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_academy_pruefungen_agent_idx ON fiaon_academy_pruefungen (agent_id, gestartet_am)`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_academy_zertifikate (
      id            SERIAL PRIMARY KEY,
      agent_id      INTEGER NOT NULL,
      nummer        VARCHAR(40) NOT NULL UNIQUE,
      bestanden_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      punkte        INTEGER NOT NULL,
      gesamt        INTEGER NOT NULL,
      pdf_pfad      TEXT,
      pdf_daten     TEXT,
      pruef_code    VARCHAR(40) NOT NULL,
      pruefung_id   INTEGER
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_academy_zertifikate_agent_idx ON fiaon_academy_zertifikate (agent_id)`;
  geprueft = true;
}

// ── Hilfen ────────────────────────────────────────────────────────────────
const sekundenSeit = (t: unknown) => Math.floor((Date.now() - new Date(String(t)).getTime()) / 1000);

interface StandZeile { kapitel: string; schritt: string; geoeffnet_am: string | null; bestanden: boolean; punkte: number | null; gesamt: number | null; zeit: number; ergebnis: any }

async function standVon(agentId: number): Promise<StandZeile[]> {
  const rows = (await sqlPool`SELECT kapitel, schritt, geoeffnet_am, bestanden, punkte, gesamt, zeit, ergebnis FROM fiaon_academy_lehrgang WHERE agent_id = ${agentId}`) as any[];
  return rows.map((r) => ({ kapitel: String(r.kapitel), schritt: String(r.schritt), geoeffnet_am: r.geoeffnet_am ? new Date(r.geoeffnet_am).toISOString() : null, bestanden: !!r.bestanden, punkte: r.punkte == null ? null : Number(r.punkte), gesamt: r.gesamt == null ? null : Number(r.gesamt), zeit: Number(r.zeit || 0), ergebnis: r.ergebnis ?? null }));
}

/** Kapitel-Übersicht mit Freigaben — Kapitel n ist frei, wenn der Test von Kapitel n−1 bestanden ist. */
function kapitelUebersicht(stand: StandZeile[]) {
  const bestanden = (k: string, s: string) => stand.some((z) => z.kapitel === k && z.schritt === s && z.bestanden);
  let vorherigesBestanden = true;
  let fertigGesamt = 0;
  const kapitel = LEHRPLAN.map((k) => {
    const schritte = k.schritte.filter((s) => s.art !== "test");
    const fertig = schritte.filter((s) => bestanden(k.key, s.key)).length;
    const testZeile = stand.find((z) => z.kapitel === k.key && z.schritt === "test");
    const testBestanden = !!testZeile?.bestanden;
    const frei = vorherigesBestanden;
    vorherigesBestanden = testBestanden;
    fertigGesamt += fertig + (testBestanden ? 1 : 0);
    return { key: k.key, nr: k.nr, titel: k.titel, frei, fertigSchritte: fertig, gesamtSchritte: schritte.length, uebungenFertig: fertig === schritte.length, testBestanden, testPunkte: testZeile?.punkte ?? null, testGesamt: testZeile?.gesamt ?? null, prozent: Math.round(((fertig + (testBestanden ? 1 : 0)) / (schritte.length + 1)) * 100) };
  });
  const prozent = Math.round((fertigGesamt / SCHRITTE_GESAMT) * 100);
  return { kapitel, prozent, alleTestsBestanden: kapitel.every((k) => k.testBestanden) };
}

async function zertifikatVon(agentId: number) {
  const [z] = (await sqlPool`SELECT id, nummer, bestanden_am, punkte, gesamt, pruef_code FROM fiaon_academy_zertifikate WHERE agent_id = ${agentId} ORDER BY bestanden_am DESC LIMIT 1`) as any[];
  return z ? { nummer: String(z.nummer), bestandenAm: new Date(z.bestanden_am).toISOString(), punkte: Number(z.punkte), gesamt: Number(z.gesamt), pruefCode: String(z.pruef_code), stufe: ZERTIFIKAT_STUFE } : null;
}

/** Provisionsaufschlag für zertifizierte Bonitätsmanager (Plan §11, Nachtrag): 0,05 oder 0. Die Verrechnung hängt Justin ein. */
export async function provisionsBonus(agentId: number): Promise<number> {
  await ensureAcademyLehrgang();
  const [z] = (await sqlPool`SELECT 1 FROM fiaon_academy_zertifikate WHERE agent_id = ${agentId} LIMIT 1`) as any[];
  return z ? ZERTIFIKAT_PROVISIONS_BONUS : 0;
}

async function pruefungsLage(agentId: number) {
  const rows = (await sqlPool`SELECT id, gestartet_am, beendet_am, punkte, gesamt, bestanden, status, tabwechsel FROM fiaon_academy_pruefungen WHERE agent_id = ${agentId} ORDER BY gestartet_am DESC LIMIT 10`) as any[];
  const laufend = rows.find((r) => r.status === "laeuft" && sekundenSeit(r.gestartet_am) < PRUEFUNG_SEKUNDEN_GESAMT + 60) ?? null;
  const woche = rows.filter((r) => sekundenSeit(r.gestartet_am) < 7 * 86400).length;
  const letzte = rows.find((r) => r.status !== "laeuft") ?? null;
  const letzteSeit = rows[0] ? sekundenSeit(rows[0].gestartet_am) : Infinity;
  const sperreBis = rows[0] && letzteSeit < PRUEFUNG_SPERRE_STUNDEN * 3600 && !laufend ? new Date(new Date(rows[0].gestartet_am).getTime() + PRUEFUNG_SPERRE_STUNDEN * 3600 * 1000).toISOString() : null;
  return {
    laufend: laufend ? { id: Number(laufend.id), gestartetAm: new Date(laufend.gestartet_am).toISOString() } : null,
    versucheDieseWoche: woche, versucheFrei: Math.max(0, PRUEFUNG_VERSUCHE_JE_WOCHE - woche), sperreBis,
    letzte: letzte ? { punkte: Number(letzte.punkte ?? 0), gesamt: Number(letzte.gesamt ?? 0), bestanden: !!letzte.bestanden, am: new Date(letzte.beendet_am || letzte.gestartet_am).toISOString(), tabwechsel: Number(letzte.tabwechsel || 0) } : null,
    regeln: { fragen: PRUEFUNG_FRAGEN, sekundenJeFrage: PRUEFUNG_SEKUNDEN_JE_FRAGE, sekundenGesamt: PRUEFUNG_SEKUNDEN_GESAMT, schwelle: PRUEFUNG_SCHWELLE, sperreStunden: PRUEFUNG_SPERRE_STUNDEN, versucheJeWoche: PRUEFUNG_VERSUCHE_JE_WOCHE },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Fortschritt
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/academy/fortschritt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const me = req.agent!.id;
    const stand = await standVon(me);
    const u = kapitelUebersicht(stand);
    const [zertifikat, pruefung] = await Promise.all([zertifikatVon(me), pruefungsLage(me)]);
    res.json({ ok: true, schritte: stand, kapitel: u.kapitel, prozent: u.prozent, pruefung: { ...pruefung, frei: u.alleTestsBestanden }, zertifikat, testSchwelle: TEST_SCHWELLE });
  } catch (err) { console.error("[ACADEMY] fortschritt:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/academy/fortschritt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const me = req.agent!.id;
    const kapitelKey = String(req.body?.kapitel || ""), schrittKey = String(req.body?.schritt || ""), aktion = String(req.body?.aktion || "");
    const kap = lehrplanKapitel(kapitelKey); const schritt = lehrplanSchritt(kapitelKey, schrittKey);
    if (!kap || !schritt) return res.status(400).json({ ok: false, error: "Unbekannter Schritt." });
    const stand = await standVon(me);
    const u = kapitelUebersicht(stand);
    const kapU = u.kapitel.find((k) => k.key === kapitelKey)!;
    if (!kapU.frei) return res.status(403).json({ ok: false, error: "Dieses Kapitel ist noch gesperrt – zuerst den Test des vorigen Kapitels bestehen." });

    if (aktion === "oeffnen") {
      await sqlPool`
        INSERT INTO fiaon_academy_lehrgang (agent_id, kapitel, schritt, geoeffnet_am)
        VALUES (${me}, ${kapitelKey}, ${schrittKey}, NOW())
        ON CONFLICT (agent_id, kapitel, schritt) DO UPDATE SET geoeffnet_am = COALESCE(fiaon_academy_lehrgang.geoeffnet_am, NOW()), aktualisiert_am = NOW()`;
      const zeile = stand.find((z) => z.kapitel === kapitelKey && z.schritt === schrittKey);
      return res.json({ ok: true, geoeffnetAm: zeile?.geoeffnet_am ?? new Date().toISOString(), minSekunden: schritt.minSekunden });
    }
    if (aktion !== "fertig") return res.status(400).json({ ok: false, error: "Unbekannte Aktion." });

    const zeile = stand.find((z) => z.kapitel === kapitelKey && z.schritt === schrittKey);
    let punkte: number | null = null, gesamt: number | null = null, bestanden = true, ergebnis: any = null;

    if (schritt.art === "test") {
      if (!kapU.uebungenFertig) return res.status(403).json({ ok: false, error: "Der Kapiteltest öffnet sich erst, wenn alle Schritte und Übungen des Kapitels abgeschlossen sind." });
      punkte = Number(req.body?.punkte); gesamt = Number(req.body?.gesamt);
      if (!Number.isInteger(punkte) || !Number.isInteger(gesamt) || gesamt < 5 || punkte < 0 || punkte > gesamt) return res.status(400).json({ ok: false, error: "Testergebnis unvollständig." });
      bestanden = punkte / gesamt >= TEST_SCHWELLE;
    } else if (UEBUNGS_ARTEN.has(schritt.art)) {
      ergebnis = req.body?.ergebnis && typeof req.body.ergebnis === "object" ? req.body.ergebnis : null;
      if (!ergebnis) return res.status(400).json({ ok: false, error: "Die Übung braucht ein Ergebnis." });
      if (typeof ergebnis.punkte === "number" && typeof ergebnis.gesamt === "number") { punkte = Math.round(ergebnis.punkte); gesamt = Math.round(ergebnis.gesamt); }
    } else {
      // Text-Schritte: Mindestlesezeit, serverseitig gemessen
      if (!zeile?.geoeffnet_am) return res.status(409).json({ ok: false, error: "Der Schritt wurde noch nicht geöffnet.", restSekunden: schritt.minSekunden });
      const vergangen = sekundenSeit(zeile.geoeffnet_am);
      if (vergangen < schritt.minSekunden) return res.status(425).json({ ok: false, error: "Noch etwas Zeit – der Schritt gilt erst nach der Mindestlesezeit als gelesen.", restSekunden: schritt.minSekunden - vergangen });
    }
    const zeitPlus = zeile?.geoeffnet_am ? Math.min(3600, Math.max(0, sekundenSeit(zeile.geoeffnet_am))) : 0;
    const bereits = !!zeile?.bestanden;
    await sqlPool`
      INSERT INTO fiaon_academy_lehrgang (agent_id, kapitel, schritt, geoeffnet_am, bestanden, bestanden_am, punkte, gesamt, ergebnis, zeit)
      VALUES (${me}, ${kapitelKey}, ${schrittKey}, NOW(), ${bestanden}, ${bestanden ? new Date() : null}, ${punkte}, ${gesamt}, ${ergebnis ? JSON.stringify(ergebnis) : null}::jsonb, ${zeitPlus})
      ON CONFLICT (agent_id, kapitel, schritt) DO UPDATE SET
        bestanden = fiaon_academy_lehrgang.bestanden OR EXCLUDED.bestanden,
        bestanden_am = COALESCE(fiaon_academy_lehrgang.bestanden_am, EXCLUDED.bestanden_am),
        punkte = CASE WHEN EXCLUDED.punkte IS NULL THEN fiaon_academy_lehrgang.punkte ELSE GREATEST(COALESCE(fiaon_academy_lehrgang.punkte, 0), EXCLUDED.punkte) END,
        gesamt = COALESCE(EXCLUDED.gesamt, fiaon_academy_lehrgang.gesamt),
        ergebnis = COALESCE(EXCLUDED.ergebnis, fiaon_academy_lehrgang.ergebnis),
        zeit = fiaon_academy_lehrgang.zeit + ${bereits ? 0 : zeitPlus},
        geoeffnet_am = NOW(),
        aktualisiert_am = NOW()`;
    const neu = kapitelUebersicht(await standVon(me));
    res.json({ ok: true, bestanden, punkte, gesamt, kapitel: neu.kapitel, prozent: neu.prozent });
  } catch (err) { console.error("[ACADEMY] fortschritt speichern:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Anruf-Simulator — gpt-4.1-mini spielt einen Kunden aus einem realen Fall
// ═══════════════════════════════════════════════════════════════════════════
interface Szenario { key: string; titel: string; beschreibung: string; ziel: string; persona: string }
const preis = (key: string) => ((PAKETE.find((p) => p.key === key)?.preisCents ?? 0) / 100).toFixed(2).replace(".", ",") + " €";
const SZENARIEN: Szenario[] = [
  { key: "erstanruf-lead", titel: "Erstanruf: Facebook-Lead", beschreibung: "Frau Yilmaz hat vor 4 Minuten ein Facebook-Formular ausgefüllt. Sie weiß kaum, was FIAON ist, und ist skeptisch.", ziel: "Vertrauen aufbauen, das Ziel der Kundin verstehen, den Weg erklären (Auskunft, Einträge, Schreiben), ohne Garantie, und einen konkreten nächsten Schritt verabreden (Antrag oder Termin).",
    persona: `Du bist Ayşe Yilmaz, 34, Erzieherin aus Duisburg. Du hast auf Facebook auf eine FIAON-Anzeige geklickt, weil dir die Bank eine Kreditkarte abgelehnt hat und du „SCHUFA-Eintrag“ vermutest (eine alte Handyrechnung nach dem Umzug, ca. 180 €). Du bist skeptisch („Ist das Abzocke?“, „Was kostet das?“, „Kann ich das nicht selbst?“), hast wenig Zeit und willst kein Blabla. Du öffnest dich, wenn die Person ruhig erklärt, ehrlich bleibt (keine Garantie), die Kosten klar nennt und dich siezt. Wenn jemand „Garantie“ oder „wir verbessern Ihren Score“ verspricht, wirst du misstrauischer. Du antwortest kurz (1–3 Sätze), wie am Telefon. Wenn du überzeugt bist, sagst du, dass du den Antrag machst oder einen Termin willst.` },
  { key: "rate-offen", titel: "Rate seit 14 Tagen offen", beschreibung: "Herr Brandt (FIAON Pro) hat die dritte Rate nicht bezahlt; Erinnerungen Tag 0/3/7 blieben ohne Antwort. Du bist seine bekannte Stimme.", ziel: "Ohne Druck den Grund erfahren, die Lage einordnen, eine konkrete Zahlungsvereinbarung (Datum/Weg) treffen und festhalten; Sperre ab Tag 30 sachlich erklären, nicht drohen.",
    persona: `Du bist Michael Brandt, 46, Lagerist aus Hannover, FIAON-Kunde (Paket Pro, ${preis("pro")} im Monat) seit drei Monaten. Die dritte Rate ist seit 14 Tagen offen: Dein Konto war leer, weil eine Nachzahlung der Stadtwerke abgebucht wurde, und die Lastschrift ist zurückgegangen. Du schämst dich etwas und bist genervt von Erinnerungen. Du hast aber das Gefühl, dass bei FIAON was passiert (ein Schreiben ist raus). Wenn der Anrufer verständnisvoll und konkret ist, bietest du an, am 28. zu überweisen. Wenn er droht oder moralisiert, wirst du kurz angebunden und sagst, du überlegst zu kündigen. Antworte kurz, wie am Telefon.` },
  { key: "kuendigung", titel: "„Ich will kündigen.“", beschreibung: "Frau Sommer (FIAON Ultra, Monat 4) ruft an und will kündigen, weil „nichts passiert“. In der Akte stehen zwei Schreiben und eine laufende Frist.", ziel: "Zuhören, die Akte konkret erklären (was in vier Monaten passiert ist), Erwartungen klären, den Kündigungsweg ehrlich nennen – und, wenn sie bleibt, einen nächsten sichtbaren Schritt vereinbaren.",
    persona: `Du bist Claudia Sommer, 52, Bürokauffrau aus Augsburg, FIAON-Kundin (Ultra, ${preis("ultra")} im Monat) seit vier Monaten. Du willst kündigen, weil du das Gefühl hast, es passiere nichts. Tatsächlich sind ein Löschantrag an die Auskunftei (Antwort: abgelehnt, Gläubiger hat Mahnungen vorgelegt) und ein Widerspruch an das Inkasso mit laufender Frist bis Monatsende verschickt; du hast die Nachrichten im Bereich nicht gelesen. Du bist enttäuscht, nicht aggressiv. Wenn der Anrufer konkret erklärt, was passiert ist und was als Nächstes kommt, und dich nicht überredet, sondern dir die Entscheidung lässt, bleibst du vielleicht. Wenn er sagt „Sie können nicht kündigen“ oder Rabatte verspricht, willst du erst recht kündigen. Antworte kurz.` },
  { key: "inkassobrief", titel: "Der Inkassobrief", beschreibung: "Herr Koch ist Interessent und hat einen Inkassobrief über 210 € (Hauptforderung 89 €) bekommen. Er ist wütend und hat Angst vor dem Eintrag.", ziel: "Beruhigen, strukturieren (Forderung, Verjährung, Mahnungen, Kosten), die Kostenregeln nennen (0,5-Gebühr, Deckel, Auslagen), klar sagen, was FIAON übernimmt und was nicht (keine Rechtsberatung, keine Garantie), nächsten Schritt verabreden.",
    persona: `Du bist Daniel Koch, 29, Koch aus Leipzig. Du hast heute einen Inkassobrief bekommen: Hauptforderung 89 € von einem Versandhaus (eine Bestellung, die du zurückgeschickt hast, wie du glaubst), dazu 70,20 € Inkassogebühr, 20 € Auslagen, 18 € „Kontoführung“ – zusammen 210 €, Frist 7 Tage, Drohung mit SCHUFA-Eintrag. Du bist wütend und ängstlich, redest schnell, unterbrichst. Du willst wissen: Muss ich das zahlen? Kommt der Eintrag? Was kann FIAON tun, was kostet das? Du beruhigst dich, wenn der Anrufer sortiert und konkret ist. Wenn er dir sagt, er könne „das garantiert wegmachen“, glaubst du ihm nicht. Antworte kurz.` },
  { key: "oesterreich", titel: "Kunde aus Wien", beschreibung: "Frau Steiner aus Wien hat von KSV1870 noch nie gehört, wurde aber beim Handyvertrag abgelehnt.", ziel: "Das österreichische System erklären (KSV1870, CRIF, Warnliste der Banken), das Auskunftsrecht nach Art. 15 DSGVO, was FIAON in Österreich übernimmt – keine deutschen Regeln übertragen.",
    persona: `Du bist Martina Steiner, 41, Friseurin aus Wien. Beim Handyvertrag wurdest du abgelehnt, der Verkäufer murmelte etwas von „KSV“. Du weißt nicht, was das ist, und denkst, in Österreich gäbe es „die SCHUFA“. Vor zwei Jahren gab es eine Sache mit einer Versandhausrechnung, die du bezahlt hast. Du bist freundlich, neugierig, aber vorsichtig bei Kosten. Du fragst nach, wenn dir jemand deutsche Begriffe (SCHUFA, § 31 BDSG) nennt. Antworte kurz, wienerisch-freundlich, aber in Hochdeutsch.` },
];

router.get("/agent/academy/szenarien", requireAgent, (_req: AgentRequest, res: Response) => {
  res.json({ ok: true, szenarien: SZENARIEN.map(({ key, titel, beschreibung, ziel }) => ({ key, titel, beschreibung, ziel })) });
});

router.post("/agent/academy/simulator", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const szenario = SZENARIEN.find((s) => s.key === String(req.body?.szenario || ""));
    if (!szenario) return res.status(400).json({ ok: false, error: "Unbekanntes Szenario." });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(503).json({ ok: false, error: "Der Simulator ist gerade nicht verfügbar (kein KI-Schlüssel hinterlegt)." });
    const roh = Array.isArray(req.body?.nachrichten) ? req.body.nachrichten : [];
    const verlauf = roh.slice(-30).map((n: any) => ({ rolle: n.rolle === "kunde" ? "kunde" : "manager", text: String(n.text || "").slice(0, 1500) })).filter((n: any) => n.text.trim());
    const beenden = req.body?.beenden === true;
    const modell = process.env.FIAON_CHAT_MODELL || "gpt-4.1-mini";
    const faktenLage = `FAKTEN ÜBER FIAON (für deine Einordnung; du bist der Kunde und kennst davon nur, was ein Interessent wissen kann):\n${wissenText().slice(0, 6000)}`;

    if (!beenden) {
      const messages = [
        { role: "system", content: `${szenario.persona}\n\nDu spielst ausschließlich den Kunden in einem Telefon-Training für FIAON-Mitarbeiter („Bonitätsmanager“). Bleib in der Rolle, antworte auf Deutsch in 1–3 kurzen Sätzen, nie als Assistent. Stell realistische Rückfragen. Wenn das Gespräch natürlich zu Ende ist (Verabredung getroffen oder du legst auf), sag das in der Rolle.\n\n${faktenLage}` },
        ...verlauf.map((n: any) => ({ role: n.rolle === "kunde" ? "assistant" : "user", content: n.text })),
      ];
      if (!verlauf.length) messages.push({ role: "user", content: "(Das Telefon klingelt. Du nimmst ab und meldest dich mit deinem Namen.)" });
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: modell, temperature: 0.8, max_tokens: 220, messages }) });
      const j: any = await r.json().catch(() => null);
      if (!r.ok) { console.error("[ACADEMY-SIM] OpenAI", r.status, j?.error?.message); return res.status(502).json({ ok: false, error: "Der KI-Kunde antwortet gerade nicht." }); }
      return res.json({ ok: true, antwort: String(j?.choices?.[0]?.message?.content || "").trim() || "…" });
    }

    // Bewertung
    const transkript = verlauf.map((n: any) => `${n.rolle === "kunde" ? "KUNDE" : "MANAGER"}: ${n.text}`).join("\n");
    const messages = [
      { role: "system", content: `Du bewertest ein Trainingsgespräch eines FIAON-Bonitätsmanagers mit einem gespielten Kunden. Szenario: ${szenario.titel}. Ziel des Managers: ${szenario.ziel}\n\nRegeln von FIAON, gegen die du prüfst: Kunden werden gesiezt; FIAON berät nicht, garantiert nichts, verbessert keinen Score; Preise nur aus dem Katalog (${PAKETE.filter((p) => p.abo).map((p) => `${p.label} ${(p.preisCents / 100).toFixed(2).replace(".", ",")} €`).join(", ")}; Bonitätsauskunft ${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig); keine Rechtsberatung im Einzelfall; das Gespräch endet mit einer Verabredung. Fakten: ${wissenText().slice(0, 4000)}\n\nAntworte NUR als JSON: {"note": 1-5 (1 = sehr gut, 5 = ungenügend), "staerken": ["…", "…"], "schwaechen": ["…", "…"], "text": "3–5 Sätze Gesamteindruck mit konkreten Zitaten aus dem Gespräch", "wortregelVerstoesse": ["…"]}. Sei streng, fair und konkret. Duze den Manager.` },
      { role: "user", content: `TRANSKRIPT:\n${transkript || "(kein Gespräch)"}` },
    ];
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: modell, temperature: 0.2, max_tokens: 700, response_format: { type: "json_object" }, messages }) });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) { console.error("[ACADEMY-SIM] Bewertung", r.status, j?.error?.message); return res.status(502).json({ ok: false, error: "Die Bewertung ist gerade nicht möglich." }); }
    let b: any = null; try { b = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { b = null; }
    const note = Math.min(5, Math.max(1, Math.round(Number(b?.note) || 3)));
    res.json({ ok: true, bewertung: { note, staerken: Array.isArray(b?.staerken) ? b.staerken.map(String).slice(0, 5) : [], schwaechen: Array.isArray(b?.schwaechen) ? b.schwaechen.map(String).slice(0, 5) : [], text: String(b?.text || ""), wortregelVerstoesse: Array.isArray(b?.wortregelVerstoesse) ? b.wortregelVerstoesse.map(String).slice(0, 8) : [] } });
  } catch (err) { console.error("[ACADEMY-SIM]", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Abschlussprüfung — schummelsicher: Lösungen bleiben hier, Zeit wird hier gemessen
// ═══════════════════════════════════════════════════════════════════════════
interface SitzungsFrage { id: string; reihenfolge: number[] }

router.post("/agent/academy/pruefung/start", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const me = req.agent!.id;
    const u = kapitelUebersicht(await standVon(me));
    if (!u.alleTestsBestanden) return res.status(403).json({ ok: false, error: "Die Abschlussprüfung öffnet sich, wenn alle zehn Kapiteltests bestanden sind." });
    const lage = await pruefungsLage(me);
    if (lage.laufend) {
      // laufende Sitzung fortsetzen
      const [s] = (await sqlPool`SELECT id, fragen, antworten, gestartet_am FROM fiaon_academy_pruefungen WHERE id = ${lage.laufend.id}`) as any[];
      const fragen = (s.fragen as SitzungsFrage[]).map((f) => { const q = PRUEFUNGS_POOL.find((p) => p.id === f.id)!; return { id: q.id, frage: q.frage, antworten: f.reihenfolge.map((i) => q.antworten[i]) }; });
      const beantwortet = Object.keys(s.antworten || {});
      await sqlPool`UPDATE fiaon_academy_pruefungen SET gestellt_am = NOW() WHERE id = ${s.id}`;
      return res.json({ ok: true, sitzung: Number(s.id), fragen, beantwortet, gestartetAm: new Date(s.gestartet_am).toISOString(), regeln: lage.regeln, fortgesetzt: true });
    }
    if (lage.sperreBis) return res.status(429).json({ ok: false, error: `Eine Wiederholung ist frühestens nach ${PRUEFUNG_SPERRE_STUNDEN} Stunden möglich.`, sperreBis: lage.sperreBis });
    if (lage.versucheFrei <= 0) return res.status(429).json({ ok: false, error: `Höchstens ${PRUEFUNG_VERSUCHE_JE_WOCHE} Versuche je Woche.` });
    const gezogen = pruefungZiehen(PRUEFUNG_FRAGEN);
    const sitzung: SitzungsFrage[] = gezogen.map((q) => ({ id: q.id, reihenfolge: mischen(q.antworten.map((_, i) => i)) }));
    const [s] = (await sqlPool`INSERT INTO fiaon_academy_pruefungen (agent_id, fragen, gestellt_am) VALUES (${me}, ${JSON.stringify(sitzung)}::jsonb, NOW()) RETURNING id, gestartet_am`) as any[];
    const fragen = sitzung.map((f) => { const q = PRUEFUNGS_POOL.find((p) => p.id === f.id)!; return { id: q.id, frage: q.frage, antworten: f.reihenfolge.map((i) => q.antworten[i]) }; });
    res.json({ ok: true, sitzung: Number(s.id), fragen, beantwortet: [], gestartetAm: new Date(s.gestartet_am).toISOString(), regeln: lage.regeln, fortgesetzt: false });
  } catch (err) { console.error("[ACADEMY] pruefung start:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/academy/pruefung/antwort", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const me = req.agent!.id;
    const id = Number(req.body?.sitzung), frageId = String(req.body?.frageId || ""), antwort = Number(req.body?.antwort), tabwechsel = Math.max(0, Math.min(999, Number(req.body?.tabwechsel) || 0));
    const [s] = (await sqlPool`SELECT id, fragen, antworten, gestellt_am, gestartet_am, status FROM fiaon_academy_pruefungen WHERE id = ${id} AND agent_id = ${me}`) as any[];
    if (!s || s.status !== "laeuft") return res.status(404).json({ ok: false, error: "Keine laufende Prüfung." });
    if (sekundenSeit(s.gestartet_am) > PRUEFUNG_SEKUNDEN_GESAMT + 5) { await sqlPool`UPDATE fiaon_academy_pruefungen SET status = 'zeit' WHERE id = ${id}`; return res.status(410).json({ ok: false, error: "Die Gesamtzeit ist abgelaufen.", abgelaufen: true }); }
    const fragen = s.fragen as SitzungsFrage[]; const f = fragen.find((x) => x.id === frageId);
    if (!f) return res.status(400).json({ ok: false, error: "Unbekannte Frage." });
    const antworten = (s.antworten || {}) as Record<string, { a: number | null; t: number }>;
    if (antworten[frageId]) return res.json({ ok: true, bereits: true });
    const vergangen = s.gestellt_am ? sekundenSeit(s.gestellt_am) : 0;
    const zuSpaet = vergangen > PRUEFUNG_SEKUNDEN_JE_FRAGE + 5;
    antworten[frageId] = { a: zuSpaet || !Number.isInteger(antwort) ? null : antwort, t: vergangen };
    await sqlPool`UPDATE fiaon_academy_pruefungen SET antworten = ${JSON.stringify(antworten)}::jsonb, gestellt_am = NOW(), tabwechsel = GREATEST(tabwechsel, ${tabwechsel}) WHERE id = ${id}`;
    res.json({ ok: true, zuSpaet, beantwortet: Object.keys(antworten).length, gesamt: fragen.length });
  } catch (err) { console.error("[ACADEMY] pruefung antwort:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.post("/agent/academy/pruefung/abschluss", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const me = req.agent!.id;
    const id = Number(req.body?.sitzung), tabwechsel = Math.max(0, Math.min(999, Number(req.body?.tabwechsel) || 0));
    const [s] = (await sqlPool`SELECT id, fragen, antworten, gestartet_am, status, tabwechsel FROM fiaon_academy_pruefungen WHERE id = ${id} AND agent_id = ${me}`) as any[];
    if (!s) return res.status(404).json({ ok: false, error: "Prüfung nicht gefunden." });
    if (s.status !== "laeuft") return res.status(409).json({ ok: false, error: "Diese Prüfung ist bereits abgeschlossen." });
    const fragen = s.fragen as SitzungsFrage[]; const antworten = (s.antworten || {}) as Record<string, { a: number | null; t: number }>;
    let punkte = 0;
    const details = fragen.map((f) => { const q = PRUEFUNGS_POOL.find((p) => p.id === f.id)!; const a = antworten[f.id]?.a; const richtig = a != null && f.reihenfolge[a] === q.richtig; if (richtig) punkte++; return { id: f.id, kapitel: q.kapitel, richtig, beantwortet: a != null }; });
    const gesamt = fragen.length; const bestanden = punkte / gesamt >= PRUEFUNG_SCHWELLE;
    const tw = Math.max(Number(s.tabwechsel || 0), tabwechsel);
    await sqlPool`UPDATE fiaon_academy_pruefungen SET status = 'fertig', beendet_am = NOW(), punkte = ${punkte}, gesamt = ${gesamt}, bestanden = ${bestanden}, tabwechsel = ${tw} WHERE id = ${id}`;
    // Nach Kapitel zusammenfassen – ohne die Lösungen preiszugeben
    const jeKapitel: Record<string, { richtig: number; gesamt: number }> = {};
    for (const d of details) { jeKapitel[d.kapitel] = jeKapitel[d.kapitel] || { richtig: 0, gesamt: 0 }; jeKapitel[d.kapitel].gesamt++; if (d.richtig) jeKapitel[d.kapitel].richtig++; }
    let zertifikat = await zertifikatVon(me);
    if (bestanden && !zertifikat) {
      zertifikat = await urkundeAusstellen(me, req.agent!.name, punkte, gesamt, Number(s.id));
    }
    res.json({ ok: true, punkte, gesamt, prozent: Math.round((punkte / gesamt) * 100), bestanden, tabwechsel: tw, jeKapitel, zertifikat });
  } catch (err) { console.error("[ACADEMY] pruefung abschluss:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// ── Urkunde ───────────────────────────────────────────────────────────────
const NAVY = "#0a1628", BLAU = "#2563eb", BLAU_HELL = "#93c5fd", GRAU = "#64748b", TEXT = "#0f172a";
const datumLang = (d: Date) => d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

async function naechsteNummer(): Promise<string> {
  const jahr = new Date().getFullYear();
  const [r] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_academy_zertifikate WHERE EXTRACT(YEAR FROM bestanden_am) = ${jahr}`) as any[];
  return `FIAON-ZBM-${jahr}-${String(Number(r?.n || 0) + 1).padStart(4, "0")}`;
}

function urkundePdf(p: { name: string; nummer: string; datum: Date; punkte: number; gesamt: number; pruefCode: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 }, info: { Title: `Urkunde ${p.nummer}`, Author: SUPPORT.firma, Subject: ZERTIFIKAT_STUFE } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
      const W = doc.page.width, H = doc.page.height;
      // Hintergrund und Rahmen
      doc.rect(0, 0, W, H).fill("#ffffff");
      doc.rect(0, 0, W, 118).fill(NAVY);
      doc.rect(0, 118, W, 3).fill(BLAU);
      doc.lineWidth(1).strokeColor(BLAU).rect(36, 150, W - 72, H - 186).stroke();
      doc.lineWidth(0.5).strokeColor("#cbd5e1").rect(42, 156, W - 84, H - 198).stroke();
      // Kopf
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(26).text("FIAON", 60, 40, { characterSpacing: 4 });
      doc.fillColor(BLAU_HELL).font("Helvetica").fontSize(8.5).text("ACADEMY · AUSBILDUNG ZUM BONITÄTSMANAGER", 60, 74, { characterSpacing: 2 });
      doc.fillColor("#cbd5e1").font("Helvetica").fontSize(8.5).text(`${SUPPORT.firma} · ${SUPPORT.adresse}`, 60, 92);
      doc.fillColor("#cbd5e1").text(`${SUPPORT.register}`, 60, 104);
      doc.fillColor("#ffffff").font("Helvetica").fontSize(9).text(`Urkunde Nr. ${p.nummer}`, W - 260, 46, { width: 200, align: "right" });
      doc.fillColor(BLAU_HELL).fontSize(8.5).text(datumLang(p.datum), W - 260, 62, { width: 200, align: "right" });
      // Titel
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(40).text("Urkunde", 60, 196, { width: W - 120, align: "center", characterSpacing: 6 });
      doc.fillColor(GRAU).font("Helvetica").fontSize(10.5).text("über die bestandene Abschlussprüfung der FIAON Academy", 60, 248, { width: W - 120, align: "center" });
      doc.moveTo(W / 2 - 60, 272).lineTo(W / 2 + 60, 272).lineWidth(1.2).strokeColor(BLAU).stroke();
      // Text
      doc.fillColor(TEXT).font("Helvetica").fontSize(12).text("Hiermit wird beurkundet, dass", 60, 300, { width: W - 120, align: "center" });
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(26).text(p.name, 60, 326, { width: W - 120, align: "center" });
      doc.fillColor(TEXT).font("Helvetica").fontSize(12).text("die Ausbildung der FIAON Academy vollständig durchlaufen und die Abschlussprüfung bestanden hat.", 90, 372, { width: W - 180, align: "center", lineGap: 3 });
      doc.fillColor(TEXT).font("Helvetica").fontSize(12).text("Die Geschäftsführung der FIAON LTD verleiht die Stufe", 90, 416, { width: W - 180, align: "center" });
      doc.fillColor(BLAU).font("Helvetica-Bold").fontSize(20).text(ZERTIFIKAT_STUFE, 60, 440, { width: W - 120, align: "center", characterSpacing: 1 });
      doc.fillColor(GRAU).font("Helvetica").fontSize(10.5).text(`Prüfungsergebnis: ${p.punkte} von ${p.gesamt} Fragen richtig (${Math.round((p.punkte / p.gesamt) * 100)} %) · Bestehensgrenze ${Math.round(PRUEFUNG_SCHWELLE * 100)} %`, 60, 478, { width: W - 120, align: "center" });
      doc.fillColor(GRAU).fontSize(9.5).text("Geprüfte Inhalte: FIAON und seine Plattform · Ablauf von Lead bis Provision · Gesprächsführung · Rechtswissen (DSGVO, BDSG, BGB, RDG) · Auskunfteien in Deutschland, Österreich und der Schweiz · Werkzeuge des Office · reale Situationen", 90, 500, { width: W - 180, align: "center", lineGap: 2 });
      // Siegel
      const sx = W - 150, sy = 612;
      doc.save();
      doc.circle(sx, sy, 46).lineWidth(2).strokeColor(BLAU).stroke();
      doc.circle(sx, sy, 40).lineWidth(0.6).strokeColor(BLAU).stroke();
      doc.circle(sx, sy, 30).fill(NAVY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text("FIAON", sx - 30, sy - 7, { width: 60, align: "center", characterSpacing: 1.5 });
      doc.fillColor(BLAU).font("Helvetica").fontSize(5.5).text("GEPRÜFT · ACADEMY · LONDON · " + p.datum.getFullYear(), sx - 46, sy + 48, { width: 92, align: "center", characterSpacing: 1 });
      doc.restore();
      // Signatur
      doc.moveTo(80, 650).lineTo(300, 650).lineWidth(0.8).strokeColor(TEXT).stroke();
      doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(10.5).text("Justin Schwarzott", 80, 656);
      doc.fillColor(GRAU).font("Helvetica").fontSize(9).text("Geschäftsführung · FIAON LTD, London", 80, 670);
      doc.fillColor(GRAU).fontSize(9).text(`London, den ${datumLang(p.datum)}`, 80, 684);
      // Fuß
      doc.rect(0, H - 36, W, 36).fill("#f1f5f9");
      doc.fillColor(GRAU).font("Helvetica").fontSize(7.5).text(`Prüf-Code ${p.pruefCode} · Urkunde ${p.nummer} · Echtheit prüfbar über die FIAON-Geschäftsführung (${SUPPORT.email}) · Dieses Dokument bescheinigt eine interne Qualifikation der FIAON LTD; es ist keine staatliche Berufszulassung und keine Erlaubnis zur Rechts- oder Finanzberatung.`, 48, H - 28, { width: W - 96, align: "center", lineGap: 1 });
      doc.end();
    } catch (e) { reject(e); }
  });
}

async function urkundeAusstellen(agentId: number, name: string, punkte: number, gesamt: number, pruefungId: number) {
  const nummer = await naechsteNummer();
  const pruefCode = crypto.randomBytes(6).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-");
  const datum = new Date();
  const pdf = await urkundePdf({ name, nummer, datum, punkte, gesamt, pruefCode });
  // Ablage: Datei unter uploads/urkunden/ (best effort – Render-Platten sind flüchtig) UND als Base64 in der Tabelle (dauerhaft)
  let pfad: string | null = null;
  try {
    const ordner = path.resolve(process.cwd(), "uploads", "urkunden");
    fs.mkdirSync(ordner, { recursive: true });
    pfad = path.join("uploads", "urkunden", `${nummer}.pdf`);
    fs.writeFileSync(path.resolve(process.cwd(), pfad), pdf);
  } catch (e) { console.warn("[ACADEMY] Urkunde konnte nicht auf die Platte geschrieben werden:", (e as Error)?.message); pfad = null; }
  await sqlPool`INSERT INTO fiaon_academy_zertifikate (agent_id, nummer, bestanden_am, punkte, gesamt, pdf_pfad, pdf_daten, pruef_code, pruefung_id) VALUES (${agentId}, ${nummer}, ${datum}, ${punkte}, ${gesamt}, ${pfad}, ${pdf.toString("base64")}, ${pruefCode}, ${pruefungId})`;
  return { nummer, bestandenAm: datum.toISOString(), punkte, gesamt, pruefCode, stufe: ZERTIFIKAT_STUFE };
}

router.get("/agent/academy/urkunde.pdf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const [z] = (await sqlPool`SELECT nummer, pdf_daten, pdf_pfad, bestanden_am, punkte, gesamt, pruef_code FROM fiaon_academy_zertifikate WHERE agent_id = ${req.agent!.id} ORDER BY bestanden_am DESC LIMIT 1`) as any[];
    if (!z) return res.status(404).json({ ok: false, error: "Noch keine Urkunde – die Abschlussprüfung ist nicht bestanden." });
    let buf: Buffer | null = z.pdf_daten ? Buffer.from(String(z.pdf_daten), "base64") : null;
    if (!buf) buf = await urkundePdf({ name: req.agent!.name, nummer: String(z.nummer), datum: new Date(z.bestanden_am), punkte: Number(z.punkte), gesamt: Number(z.gesamt), pruefCode: String(z.pruef_code) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${z.nummer}.pdf"`);
    res.send(buf);
  } catch (err) { console.error("[ACADEMY] urkunde:", err); if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Übersicht für die Leitung / den Admin: alle Mitarbeiter mit Prozent und Prüfung
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/academy/uebersicht", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyLehrgang();
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!["vertriebsleiter", "admin"].includes(rolle)) return res.status(403).json({ ok: false, error: "Nur für die Leitung." });
    res.json({ ok: true, ...(await academyUebersicht()) });
  } catch (err) { console.error("[ACADEMY] uebersicht:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

/** Für den Admin (Justin hängt es ein): alle aktiven Mitarbeiter mit Academy-Stand. */
export async function academyUebersicht() {
  await ensureAcademyLehrgang();
  const agenten = (await sqlPool`SELECT id, name, rolle FROM fiaon_agents WHERE active AND COALESCE(is_test_account, FALSE) = FALSE ORDER BY name`) as any[];
  const stand = (await sqlPool`SELECT agent_id, kapitel, schritt, geoeffnet_am, bestanden, punkte, gesamt, zeit, ergebnis FROM fiaon_academy_lehrgang`) as any[];
  const pruefungen = (await sqlPool`SELECT DISTINCT ON (agent_id) agent_id, punkte, gesamt, bestanden, beendet_am, tabwechsel, status FROM fiaon_academy_pruefungen WHERE status <> 'laeuft' ORDER BY agent_id, gestartet_am DESC`) as any[];
  const zertifikate = (await sqlPool`SELECT agent_id, nummer, bestanden_am, punkte, gesamt FROM fiaon_academy_zertifikate`) as any[];
  const mitarbeiter = agenten.map((a) => {
    const meine: StandZeile[] = stand.filter((s) => Number(s.agent_id) === Number(a.id)).map((r) => ({ kapitel: String(r.kapitel), schritt: String(r.schritt), geoeffnet_am: r.geoeffnet_am, bestanden: !!r.bestanden, punkte: r.punkte, gesamt: r.gesamt, zeit: Number(r.zeit || 0), ergebnis: r.ergebnis }));
    const u = kapitelUebersicht(meine);
    const p = pruefungen.find((x) => Number(x.agent_id) === Number(a.id));
    const z = zertifikate.find((x) => Number(x.agent_id) === Number(a.id));
    const zeitMin = Math.round(meine.reduce((n, s) => n + s.zeit, 0) / 60);
    return { id: Number(a.id), name: a.name, rolle: a.rolle, prozent: u.prozent, kapitelBestanden: u.kapitel.filter((k) => k.testBestanden).length, kapitelGesamt: LEHRPLAN.length, zeitMinuten: zeitMin,
      pruefung: p ? { punkte: Number(p.punkte ?? 0), gesamt: Number(p.gesamt ?? 0), bestanden: !!p.bestanden, am: p.beendet_am, tabwechsel: Number(p.tabwechsel || 0) } : null,
      zertifikat: z ? { nummer: z.nummer, am: z.bestanden_am, punkte: Number(z.punkte), gesamt: Number(z.gesamt) } : null };
  });
  return { mitarbeiter, kapitel: LEHRPLAN.map((k) => ({ key: k.key, nr: k.nr, titel: k.titel })) };
}

export default router;
