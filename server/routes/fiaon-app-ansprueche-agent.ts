// ═══════════════════════════════════════════════════════════════════════════
// DER ANSPRUCHS-CHECK IM STARTGESPRÄCH — DIE GEGENSEITE (06.09.2026, Scheibe 7)
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Bis heute gab es den Anspruchs-Check nur im Kundenbereich. Der Betreuer am
// Telefon konnte ihn weder führen noch sehen — und so endete das Startgespräch
// ohne Ergebnis. Lücken-Audit 06.09.2026: 393 von 521 zahlenden Kunden hängen
// genau an diesem Schritt. Diese Datei ist die Gegenseite: dieselben zehn
// Fragen, dieselben Regeln, dieselben Zeilen in der Datenbank — nur mit dem
// Mitarbeiter am Hörer statt dem Kunden am Handy.
//
// ── EINE WAHRHEIT, KEINE ZWEITE ────────────────────────────────────────────
// Nichts wird hier nachgebaut. Die Fragen und die Regeln kommen aus
// shared/fiaon-ansprueche.ts, das Laden und das SPEICHERN der Befunde aus
// server/routes/fiaon-app.ts (`antwortenLaden`, `anspruecheStand`,
// `befundeSpeichern`, `checkAntwort`). Eine eigene Fassung von
// `befundeSpeichern` wäre eine zweite Wahrheit über dieselben Zeilen in
// fiaon_ansprueche — und die erste, die jemand vergisst mitzuändern.
//
// ── WAS NEU IST: DIE VORBELEGUNG AUS DEM ANTRAG ────────────────────────────
// Sechs der zehn Fragen tragen in shared/fiaon-ansprueche.ts das Merkmal
// `ausAntrag`. Der Detailplan will sie nicht doppelt erheben, sondern vorlesen
// und bestätigen lassen („Aus dem Antrag: 2.500 €. Stimmt das noch?“).
// GEPRÜFT am 06.09.2026 lesend gegen information_schema — von diesen sechs
// gibt es in fiaon_applications nur ZWEI Spalten, und eine davon meint etwas
// anderes:
//
//   unterhalt        → keine Spalte           → keine Vorbelegung
//   familienstand    → keine Spalte           → keine Vorbelegung
//   netto_cents      → `income` (Euro/Monat)  → VORBELEGUNG (× 100 = Cent)
//   warmmiete_cents  → `rent`  (KALTmiete!)   → KEINE Vorbelegung, nur Hinweis
//   haushalt         → keine Spalte           → keine Vorbelegung
//   sozialleistung   → keine Spalte           → keine Vorbelegung
//
// `rent` heißt in der Antragsstrecke und im Kundenkonto „Monatliche
// Kaltmiete“ (client/src/pages/dashboard.tsx). Die Frage will die WARMmiete.
// Wer die eine als die andere vorbelegt, schiebt eine falsche Zahl in die
// Wohngeld-Prüfung — deshalb steht sie hier als Hinweis für den Mitarbeiter
// und NICHT als Antwort. Geraten wird nichts.
//
// ── DIE TÜR ────────────────────────────────────────────────────────────────
// Alle drei Endpunkte hinter `requireAgent` UND der Zuständigkeitsprüfung aus
// server/lib/fiaon-kundenzugriff (`rolleVon` + `darfAnKunde`) — dasselbe
// Muster wie `vorgangFuerAgent` in fiaon-app-antraege.ts. Wer in der
// Nur-Ansicht sitzt, darf lesen und nichts schreiben.
//
// Tabellen: keine neuen. fiaon_anspruch_antworten und fiaon_ansprueche aus
// db/migrations/080_app_kundenbereich.sql (DDL in ensureAppTabellen).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import {
  ensureAppTabellen, antwortenLaden, anspruecheStand, befundeSpeichern, checkAntwort,
} from "./fiaon-app";
import { FRAGEN, REGELN, befunde, type Frage, type FrageSchluessel } from "@shared/fiaon-ansprueche";

const router = Router();

const fehler = (res: Response, code: number, satz: string) => res.status(code).json({ ok: false, error: satz });
const STOERUNG = "Der Anspruchs-Check lässt sich gerade nicht laden. Lade ihn gleich noch einmal.";

// ═══════════════════════════════════════════════════════════════════════════
// DIE TÜR — requireAgent hat schon geprüft, WER; hier steht, ZU WEM
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Die Person aus der URL — nur, wenn dieser Mitarbeiter an sie darf.
 *
 * Abgeschaut bei `vorgangFuerAgent` (fiaon-app-antraege.ts:986 ff.), nicht neu
 * erfunden: dieselbe Reihenfolge (gibt es sie? · darf er? · sieht er nur zu?)
 * und dieselben Sätze. `schreibend` trennt Lesen von Ändern — in der
 * Ansichts-Sitzung sieht der Vorgesetzte den Check, ändert ihn aber nicht.
 */
async function personFuerAgent(req: AgentRequest, res: Response, schreibend: boolean): Promise<number | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { fehler(res, 404, "Diesen Kunden gibt es nicht."); return null; }
  const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  if (!p) { fehler(res, 404, "Diesen Kunden gibt es nicht."); return null; }
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { fehler(res, 403, "Dieser Kunde wird von jemand anderem betreut."); return null; }
  if (schreibend && req.agent?.ansicht) { fehler(res, 403, "In der Ansicht lässt sich nichts ändern."); return null; }
  return personId;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VORBELEGUNG AUS DEM ANTRAG
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Welche Spalten fiaon_applications WIRKLICH hat — einmal gelesen, dann gemerkt.
 *
 * Ein fest verdrahtetes `SELECT income, rent` wäre ein 500er in dem Moment, in
 * dem jemand eine Spalte umbenennt. Die Frage an information_schema kostet
 * einmal je Prozessleben und macht aus „Serverfehler“ ein „Feld ausgelassen“.
 */
let spaltenBereit: Promise<Set<string>> | null = null;
function antragSpalten(): Promise<Set<string>> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const zeilen = (await sqlPool`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'fiaon_applications'`) as any[];
      const s = new Set<string>();
      for (let i = 0; i < zeilen.length; i++) s.add(String(zeilen[i].column_name));
      return s;
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

export interface Vorbelegung {
  /** Der Wert in derselben Form wie eine Antwort (Cent bei `betrag`, Zahl bei `zahl`). */
  wert: unknown;
  /** Woher er kommt — für den Satz „Aus dem Antrag: …“. */
  herkunft: "antrag";
  /** Die gelesene Spalte, damit im Zweifel nachvollziehbar ist, woher die Zahl stammt. */
  feld: string;
}

interface AusAntrag {
  werte: Partial<Record<FrageSchluessel, Vorbelegung>>;
  /** Sätze für den MITARBEITER (Du) zu Feldern, die der Antrag nur halb hergibt. */
  hinweise: Partial<Record<FrageSchluessel, string>>;
}

const euro = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

/**
 * Was der Antrag zu den zehn Fragen hergibt — und mehr nicht.
 *
 * Fehlt eine Spalte, fehlt das Feld: kein Ersatzwert, keine Ableitung aus einem
 * Nachbarfeld. Der Mitarbeiter fragt dann eben. Das ist eine Frage mehr; eine
 * geratene Zahl wäre ein falscher Antrag bei einer Behörde.
 */
async function ausAntrag(personId: number): Promise<AusAntrag> {
  const werte: Partial<Record<FrageSchluessel, Vorbelegung>> = {};
  const hinweise: Partial<Record<FrageSchluessel, string>> = {};
  let spalten: Set<string>;
  try { spalten = await antragSpalten(); } catch { return { werte, hinweise }; }

  // netto_cents ← income. Die Antragsstrecke fragt „Monatliches Nettoeinkommen“
  // in EURO (client/src/pages/antrag.tsx, Schritt 2 von 5); die Antwort liegt in
  // Cent. Deshalb × 100 — und nur, wenn wirklich etwas drinsteht.
  //
  // `archived_at IS NULL AND gdpr_deleted_at IS NULL` steht hier aus demselben
  // Grund wie in fiaon-app-uebersicht.ts: `merged_into IS NULL` allein lässt
  // archivierte und DSGVO-gelöschte Anträge durch. GEMESSEN am 06.09.: bei 20
  // von 2.142 Menschen mit income wäre die jüngste Zeile eine solche — der
  // Mitarbeiter läse dem Kunden eine Zahl aus einem Datensatz vor, der gelöscht
  // sein sollte (43 gelöschte Zeilen tragen noch ein income).
  if (spalten.has("income")) {
    const [a] = (await sqlPool`
      SELECT income FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
         AND archived_at IS NULL AND gdpr_deleted_at IS NULL
         AND income IS NOT NULL AND income > 0
       ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const euroWert = Number(a?.income ?? 0);
    if (Number.isFinite(euroWert) && euroWert > 0) {
      werte.netto_cents = { wert: Math.round(euroWert * 100), herkunft: "antrag", feld: "income" };
    }
  }

  // NEBENEINKÜNFTE WERDEN NICHT ADDIERT, SONDERN GESAGT.
  // Die Frage will „alle Einkünfte zusammen“; `income` ist nur das eine Feld,
  // daneben steht `additional_income_amount` (Euro/Monat, 46 Menschen mit
  // beidem). Eine stille Addition wäre dieselbe Sorte Fehler wie Kaltmiete als
  // Warmmiete: eine Zahl, die niemand bestätigt hat. Also derselbe Weg wie bei
  // der Miete — ein Satz für den Mitarbeiter, keine Vorbelegung.
  if (spalten.has("additional_income_amount")) {
    const [a] = (await sqlPool`
      SELECT additional_income_amount AS betrag FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
         AND archived_at IS NULL AND gdpr_deleted_at IS NULL
         AND additional_income_amount IS NOT NULL AND additional_income_amount > 0
       ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const zusatzEuro = Number(a?.betrag ?? 0);
    if (Number.isFinite(zusatzEuro) && zusatzEuro > 0) {
      hinweise.netto_cents = `Im Antrag stehen zusätzlich ${euro(Math.round(zusatzEuro * 100))} Nebeneinkünfte — frag, ob sie noch laufen, und zähl sie erst dann dazu.`;
    }
  }

  // warmmiete_cents ← NICHT aus `rent`. `rent` ist die KALTmiete (so beschriftet
  // in der Kundenansicht, client/src/pages/dashboard.tsx). Die Frage will die
  // Warmmiete. Der Betrag geht in die Wohngeld-Prüfung — eine um Nebenkosten zu
  // niedrige Zahl wäre dort schlicht falsch. Also: Hinweis statt Vorbelegung.
  if (spalten.has("rent")) {
    const [a] = (await sqlPool`
      SELECT rent FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
         AND archived_at IS NULL AND gdpr_deleted_at IS NULL
         AND rent IS NOT NULL AND rent > 0
       ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const euroWert = Number(a?.rent ?? 0);
    if (Number.isFinite(euroWert) && euroWert > 0) {
      hinweise.warmmiete_cents = `Im Antrag steht eine Kaltmiete von ${euro(Math.round(euroWert * 100))}. Die Warmmiete liegt darüber — frag nach, übernimm die Zahl nicht.`;
    }
  }

  // unterhalt · familienstand · haushalt · sozialleistung: In fiaon_applications
  // gibt es dafür keine Spalte (geprüft 06.09.2026 gegen information_schema über
  // alle Tabellen der Datenbank, 0 Treffer). Sie werden im Gespräch gefragt.
  return { werte, hinweise };
}

/** Woher die gespeicherte Antwort kam: 'kunde' · 'startgespraech' · 'antrag'. */
async function quellenLaden(personId: number): Promise<Record<string, string>> {
  const zeilen = (await sqlPool`
    SELECT frage_schluessel, quelle FROM fiaon_anspruch_antworten WHERE person_id = ${personId}`) as any[];
  const m: Record<string, string> = {};
  for (let i = 0; i < zeilen.length; i++) m[String(zeilen[i].frage_schluessel)] = String(zeilen[i].quelle);
  return m;
}

/** Die eine Antwortform aller drei Endpunkte — GET und POST liefern dasselbe. */
async function standSenden(personId: number, res: Response): Promise<void> {
  const [a, staende, quelle, antrag] = await Promise.all([
    antwortenLaden(personId), anspruecheStand(personId), quellenLaden(personId), ausAntrag(personId),
  ]);
  const basis = checkAntwort(a, staende);
  res.json({
    ...basis,
    // `gesamt` ist der Name, unter dem das Cockpit zählt; `fragenGesamt` bleibt
    // für den Kundenweg unverändert daneben stehen (dieselbe Zahl, zwei Leser).
    gesamt: basis.fragenGesamt,
    quelle,
    vorbelegung: antrag.werte,
    hinweise: antrag.hinweise,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANTWORT PRÜFEN — die Form kommt aus der Frage, nicht aus dem Körper
// ═══════════════════════════════════════════════════════════════════════════
/** Obergrenzen: großzügig genug für jede echte Angabe, eng genug gegen Unsinn. */
const MAX_PERSONEN = 20;
const MAX_CENTS = 10_000_000; // 100.000 € im Monat

type Geprueft = { ok: true; wert: unknown } | { ok: false; satz: string };

function wertPruefen(frage: Frage, roh: unknown): Geprueft {
  if (frage.art === "ja_nein") {
    if (roh === true || roh === false) return { ok: true, wert: roh };
    return { ok: false, satz: "Auf diese Frage gibt es Ja oder Nein." };
  }
  if (frage.art === "zahl" || frage.art === "betrag") {
    const z = Number(roh);
    if (!Number.isFinite(z) || z < 0) return { ok: false, satz: "Diese Frage braucht eine Zahl, nicht kleiner als null." };
    if (frage.art === "zahl") {
      if (z > MAX_PERSONEN) return { ok: false, satz: `Mehr als ${MAX_PERSONEN} Personen sind hier nicht vorgesehen — frag noch einmal nach.` };
      return { ok: true, wert: Math.floor(z) };
    }
    if (z > MAX_CENTS) return { ok: false, satz: "Der Betrag ist zu groß — trag ihn in Cent ein und frag noch einmal nach." };
    return { ok: true, wert: Math.round(z) };
  }
  if (frage.art === "wahl") {
    const w = String(roh ?? "");
    if ((frage.optionen ?? []).some((o) => o.wert === w)) return { ok: true, wert: w };
    return { ok: false, satz: "Diese Auswahl gibt es bei dieser Frage nicht." };
  }
  // mehrfach
  if (!Array.isArray(roh)) return { ok: false, satz: "Bei dieser Frage sind mehrere Antworten möglich — schick sie als Liste." };
  const erlaubt = (frage.optionen ?? []).map((o) => o.wert);
  const gewaehlt: string[] = [];
  for (let i = 0; i < roh.length; i++) {
    const w = String(roh[i]);
    if (erlaubt.indexOf(w) === -1) return { ok: false, satz: "Diese Auswahl gibt es bei dieser Frage nicht." };
    if (gewaehlt.indexOf(w) === -1) gewaehlt.push(w);
  }
  if (!gewaehlt.length) return { ok: false, satz: "Wähl mindestens eine Antwort aus." };
  return { ok: true, wert: gewaehlt };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/app/ansprueche/:personId — Fragen, Antworten, Befunde, Vorbelegung
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/app/ansprueche/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const personId = await personFuerAgent(req, res, false); if (!personId) return;
    await standSenden(personId, res);
  } catch (e: any) {
    console.error("[APP] agent ansprueche laden:", e?.message || e);
    fehler(res, 500, STOERUNG);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/app/ansprueche/:personId { frageSchluessel, wert, terminId? }
//
// EINE Antwort, sofort in der Datenbank. Der Detailplan ist an dieser Stelle
// eindeutig: nichts mehr nur im localStorage. Ein Gespräch, das in Minute
// zwölf abreißt, hat dann elf Antworten gespeichert und nicht null.
// `wert: null` löscht die Antwort wieder (der Weg zurück aus einem Vertipper).
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/app/ansprueche/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const personId = await personFuerAgent(req, res, true); if (!personId) return;

    const schluessel = String(req.body?.frageSchluessel ?? "");
    const frage = FRAGEN.find((f) => f.schluessel === schluessel);
    if (!frage) return fehler(res, 400, "Diese Frage gibt es nicht.");

    // Die Termin-Nummer wird gegen DIESEN Menschen geprüft, nicht nur auf
    // „ganze Zahl“. `fiaon_anspruch_antworten.termin_id` hat keinen
    // Fremdschlüssel; ohne diese Prüfung ließen sich die zehn Antworten an
    // einen beliebigen Termin hängen, auch an den eines Kollegen — und jede
    // spätere Auswertung „was kam in DIESEM Termin heraus“ rechnete falsch.
    // Ein fremder Termin wird still zu null: lieber keine Zuordnung als eine
    // falsche, und der Mitarbeiter soll deswegen nicht am Speichern gehindert
    // werden.
    const terminRoh = Number(req.body?.terminId);
    let terminId: number | null = null;
    if (Number.isInteger(terminRoh) && terminRoh > 0) {
      const [t] = (await sqlPool`
        SELECT 1 AS ok FROM fiaon_termine WHERE id = ${terminRoh} AND person_id = ${personId} LIMIT 1`) as any[];
      if (t) terminId = terminRoh;
    }

    if (req.body?.wert === null) {
      await sqlPool`DELETE FROM fiaon_anspruch_antworten WHERE person_id = ${personId} AND frage_schluessel = ${schluessel}`;
    } else {
      const g = wertPruefen(frage, req.body?.wert);
      if (!g.ok) return fehler(res, 400, g.satz);
      await sqlPool`
        INSERT INTO fiaon_anspruch_antworten (person_id, frage_schluessel, wert, termin_id, erhoben_von_agent_id, quelle)
        VALUES (${personId}, ${schluessel}, ${sqlPool.json(g.wert as any)}, ${terminId}, ${req.agent!.id}, 'startgespraech')
        ON CONFLICT (person_id, frage_schluessel) DO UPDATE SET
          wert = EXCLUDED.wert, termin_id = COALESCE(EXCLUDED.termin_id, fiaon_anspruch_antworten.termin_id),
          erhoben_von_agent_id = EXCLUDED.erhoben_von_agent_id, erhoben_am = NOW(), quelle = 'startgespraech'`;
    }

    // Dieselbe Rechnung und dieselbe Speicherung wie im Kundenweg — die Funktion
    // aus fiaon-app.ts, nicht eine zweite hier.
    const a = await antwortenLaden(personId);
    await befundeSpeichern(personId, befunde(a));
    await standSenden(personId, res);
  } catch (e: any) {
    console.error("[APP] agent ansprueche speichern:", e?.message || e);
    fehler(res, 500, "Die Antwort ließ sich gerade nicht speichern. Versuch es gleich noch einmal.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/app/ansprueche/:personId/verworfen { regelSchluessel, grund }
//
// Im Gespräch kommt heraus, dass ein Punkt der Liste nicht passt — das Auto ist
// verkauft, die Bank hat das P-Konto schon umgestellt. Dann steht er auf
// 'verworfen' und verschwindet aus der Arbeitsliste, statt als Karteileiche
// weiterzulaufen. `befundeSpeichern` bleibt davon unberührt: 'verworfen' ist in
// fiaon-app.ts ausdrücklich einer der Stände, die eine Neuberechnung NICHT
// wieder auf 'offen' zieht.
//
// Der Grund gehört in den Kontaktverlauf und NICHT in `begruendung` — das Feld
// trägt den Satz, den der Kunde liest.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/app/ansprueche/:personId/verworfen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const personId = await personFuerAgent(req, res, true); if (!personId) return;

    const regelSchluessel = String(req.body?.regelSchluessel ?? "");
    const regel = REGELN.find((r) => r.schluessel === regelSchluessel);
    if (!regel) return fehler(res, 400, "Diesen Punkt gibt es nicht.");
    const grund = String(req.body?.grund ?? "").trim().slice(0, 500);
    if (grund.length < 5) return fehler(res, 400, "Schreib in einem Satz, warum der Punkt nicht passt — sonst weiß der Nächste es nicht.");

    // Erst die Liste auf Stand bringen: Hat der Kunde den Check im Bereich
    // geführt und niemand seither gespeichert, gibt es die Zeile noch nicht.
    const a = await antwortenLaden(personId);
    await befundeSpeichern(personId, befunde(a));

    const zeilen = (await sqlPool`
      UPDATE fiaon_ansprueche SET stand = 'verworfen', aktualisiert_am = NOW()
       WHERE person_id = ${personId} AND regel_schluessel = ${regelSchluessel}
         AND stand IN ('offen', 'nicht_zutreffend')
       RETURNING id`) as any[];
    if (!zeilen.length) {
      return fehler(res, 409, "Dieser Punkt steht nicht mehr offen — er ist bereits beantragt, beschieden oder zurückgestellt.");
    }

    // Vermerk im Kontaktverlauf. `ref` ist dort Pflichtfeld; hat der Mensch
    // keinen Antrag mehr (Zusammenführung, Löschung), bleibt der Vermerk aus —
    // eine erfundene Referenz wäre schlimmer als ein fehlender Satz.
    const [antrag] = (await sqlPool`
      SELECT ref FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL
       ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    if (antrag?.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${String(antrag.ref)}, ${personId}, ${req.agent!.id}, ${req.agent!.name}, 'anspruch_verworfen',
                ${`Im Startgespräch zurückgestellt: ${regel.titel}. Grund: ${grund}`}, NOW())`
        .catch((e: any) => console.error("[APP] verworfen-Vermerk:", e?.message || e));
    }

    await standSenden(personId, res);
  } catch (e: any) {
    console.error("[APP] agent ansprueche verworfen:", e?.message || e);
    fehler(res, 500, "Der Punkt ließ sich nicht zurückstellen — versuch es gleich noch einmal.");
  }
});

export default router;
