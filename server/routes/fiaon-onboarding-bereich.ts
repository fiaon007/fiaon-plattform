// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — der Bereich für die Startgespräche
//
// Jeder Mensch, der bei uns bezahlt hat, bekommt ein persönliches Gespräch von
// fünfzehn Minuten. Nicht um etwas zu verkaufen — das ist längst passiert —,
// sondern damit ihm einmal jemand das System erklärt. Wer das führt, braucht
// genau zwei Dinge: seine Termine und die Lage des Kunden davor.
//
// WAS DIESER BEREICH NICHT KANN
// Keine Zahlungsbuchung, keine Provisionen, keine Vertriebslisten, keine
// Stammdatenänderung. Das ist keine Höflichkeit gegenüber der Rolle, sondern
// die Grenze aus der Verpflichtungserklärung — und sie steht im Server, nicht
// in der Oberfläche. Es gibt in dieser Datei bewusst KEINEN Import aus
// fiaon-verbuchung, fiaon-finance oder der Provisionsrechnung.
//
// ZWEI TORWÄCHTER, wie beim Vertrieb:
//   404 für alle ohne die Rolle — wer sie nicht hat, soll nicht einmal
//       erfahren, dass es diesen Bereich gibt.
//   403 mit Code für alle mit Rolle, aber ohne angenommene Erklärung — sie
//       DÜRFEN wissen, dass es ihn gibt, ihnen fehlt nur ein Schritt.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import { ONBOARDING_ZUSAGE_TEXT, ONBOARDING_ZUSAGE_VERSION } from "../lib/fiaon-onboarding-zusage";
import { berlinDatumText, berlinUhrzeit, berlinDatum, terminLink } from "../lib/fiaon-termine";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { absoluteUrl } from "../fiaon-base-url";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import { sorgeFuerAkte } from "../lib/fiaon-akte-anker";

const router = Router();

/** Führt dieser Mitarbeiter Startgespräche? */
export async function istOnboarding(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active`;
  return String(a?.rolle || "agent") === "onboarding";
}

// ═══════════════════════════════════════════════════════════════════════════
// „LEIDER NICHT ERSCHIENEN — HIER NEUEN TERMIN BUCHEN" (NEU AM 24.08.2026)
//
// VORHER: Es gab diese Mail nicht. Wer im Onboarding „Nicht erschienen"
//   klickte, löste beim Kunden nichts aus (Begründung an der Aufrufstelle in
//   `startgespraechErgebnis`).
// NACHHER: Diese beiden Funktionen. Die erste legt die Merkspalte an, die
//   zweite verschickt — genau EINMAL je Termin.
// GRUND: Auftrag des Inhabers vom 24.08.2026.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Merkspalten am Termin — additiv und lazy.
 *
 *   `verpasst_mail_am`  Wann die Mail „Termin nicht zustande gekommen“ rausging.
 *   `verpasst_grund`    WARUM das Gespräch nicht stattgefunden hat (24.08.2026).
 *
 * VORHER (bis 24.08.2026): nur `verpasst_mail_am`. Ein No-Show hatte damit
 * keinen Grund — jeder ausgebliebene Kunde sah aus wie jeder andere, und
 * niemand konnte hinterher sagen, ob die Nummer falsch war oder der Mensch
 * einfach nicht wollte.
 * NACHHER: Der gewählte Grund steht am Termin. Er STEUERT nichts (die Folge
 * entscheidet die Route unten, im selben Augenblick); er ist Buchführung.
 * GRUND: Auftrag des Inhabers vom 24.08.2026 — „dann wählt man aus WARUM“.
 *
 * Vorbild: `ensureVertriebSpalten` in fiaon-office-vertrieb.ts. `lock_timeout`,
 * weil ein ALTER, das hinter einer langen Transaktion wartet, ALLE folgenden
 * Abfragen auf fiaon_termine in die Warteschlange zwingen würde — der Kalender
 * stünde. Lieber nach drei Sekunden aufgeben und beim nächsten Mal erneut.
 *
 * Die Wanderfassung liegt zusätzlich als db/migrations/075_termin_verpasst_mail.sql
 * und db/migrations/077_termin_verpasst_grund.sql.
 */
let verpasstSpalteBereit: Promise<void> | null = null;
function ensureVerpasstSpalten(): Promise<void> {
  if (!verpasstSpalteBereit) {
    verpasstSpalteBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS verpasst_mail_am TIMESTAMPTZ`;
        await tx`ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS verpasst_grund TEXT`;
        // P10 (01.09.2026): „Termin stattgefunden" ≠ „Onboarding abgeschlossen".
        // Dieser Stempel trennt beides; Wanderfassung: 078_onboarding_abschluss.sql
        // (dort auch der Backfill für Alt-Termine).
        await tx`ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS onboarding_abgeschlossen_am TIMESTAMPTZ`;
      });
    })().catch((e) => { verpasstSpalteBereit = null; throw e; });
  }
  return verpasstSpalteBereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE GRÜNDE — UND WAS JEDER AUSLÖST (NEU AM 24.08.2026)
//
// VORHER: Es gab genau einen Knopf, „Nicht erschienen“, und genau eine Folge.
//   Ein Kunde mit falscher Rufnummer, einer der abgesagt hatte und einer, der
//   gar nicht mehr wollte, bekamen alle dieselbe Mail — beim letzten war das
//   eine Aufforderung an jemanden, der gerade abgesagt hatte.
// NACHHER: Der Grund entscheidet, was passiert. Diese Liste ist die EINZIGE
//   Fassung davon im Server; die Oberfläche schickt nur den Schlüssel.
// GRUND: Auftrag des Inhabers vom 24.08.2026 — „dann wählt man aus WARUM, und
//   basierend darauf löst sich was aus“.
// ═══════════════════════════════════════════════════════════════════════════
export const NICHT_ERSCHIENEN_GRUENDE = {
  /** Niemand am Apparat, niemand im Gespräch — der Regelfall. */
  nicht_erschienen: { folge: "termin_verpasst", notizPflicht: false },
  /** Die hinterlegte Nummer stimmt nicht — der Kunde berichtigt sie selbst. */
  nummer_falsch: { folge: "number_update_request", notizPflicht: false },
  /** Der Kunde hat abgesagt oder es passt gerade nicht — neuer Termin. */
  kunde_abgesagt: { folge: "onboarding_einladung", notizPflicht: false },
  /** Der Kunde will kein Startgespräch mehr — KEINE Mail, nur die Akte. */
  kein_interesse: { folge: null, notizPflicht: true },
} as const;

export type NichtErschienenGrund = keyof typeof NICHT_ERSCHIENEN_GRUENDE;

/** Mindestlänge der Pflicht-Notiz. Zehn Zeichen wie im Cockpit — ein Wort ist
 *  keine Begründung, drei Wörter sind eine. */
const NOTIZ_MINDEST = 10;

/**
 * Den gewählten Grund am Termin vermerken.
 *
 * ABSICHTLICH EIN EIGENER, SCHWEIGENDER SCHRITT: Die Spalte entsteht lazy.
 * Stünde sie im großen UPDATE von `startgespraechErgebnis`, würde ein
 * hängendes ALTER (Sperre auf fiaon_termine) das Abschließen eines Gesprächs
 * verhindern — für eine Angabe, die nichts steuert. Dieselbe Begründung wie
 * bei der Herkunft in fiaon-termine.ts: Buchführung darf die Arbeit nicht
 * anhalten. WIRFT NIE.
 */
async function verpasstGrundVermerken(terminId: number, grund: string): Promise<void> {
  try {
    await ensureVerpasstSpalten();
    await sqlPool`UPDATE fiaon_termine SET verpasst_grund = ${grund} WHERE id = ${terminId}`;
  } catch (e) {
    console.error("[ONBOARDING] Grund nicht vermerkt:", e);
  }
}

/**
 * Schickt dem Kunden die „Wir haben Sie nicht erreicht"-Mail — einmal je Termin.
 *
 * WARUM DIE MARKE AM TERMIN HÄNGT UND NICHT AM MENSCHEN: Wer im Herbst ein
 * zweites Startgespräch verpasst, soll wieder eine Mail bekommen. Wer denselben
 * Termin zweimal als verpasst meldet (nachgetragen, Doppelklick, Kalender und
 * Cockpit nacheinander), nicht.
 *
 * Gibt einen Satz für den Mitarbeiter zurück UND ob die Mail wirklich rausging.
 *
 * VORHER (bis 24.08.2026) kam nur der Satz zurück. Die Oberfläche musste ihn
 * nach Wörtern durchsuchen, um zu wissen, ob sie grün oder bernstein melden
 * soll — eine Regel, die beim ersten umformulierten Satz stillschweigend
 * kippt. NACHHER steht die Auskunft als eigenes Feld daneben.
 * WIRFT NIE.
 */
async function verpasstMailSenden(
  terminId: number, personId: number, beginn: Date | string | null, ref: string | null,
): Promise<{ satz: string | null; geglueckt: boolean }> {
  try {
    await ensureVerpasstSpalten();

    // Die Marke ZUERST setzen, und nur wenn sie noch frei war. Zwei Klicks
    // nebeneinander (Cockpit und Kalender) laufen sonst beide durch — das
    // UPDATE ... WHERE verpasst_mail_am IS NULL entscheidet, wer sendet.
    const gesetzt = (await sqlPool`
      UPDATE fiaon_termine SET verpasst_mail_am = NOW()
      WHERE id = ${terminId} AND verpasst_mail_am IS NULL
      RETURNING id
    `) as any[];
    if (gesetzt.length === 0) {
      return { satz: "Die E-Mail mit dem neuen Buchungslink ist für diesen Termin bereits raus — es geht keine zweite.", geglueckt: true };
    }

    const [k] = (await sqlPool`
      SELECT COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS email,
             COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', NULLIF(ag.first_name, ''), NULLIF(ag.last_name, '')))) AS agent_vorname
      FROM fiaon_persons p
      LEFT JOIN fiaon_termine t ON t.id = ${terminId}
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      WHERE p.id = ${personId}
    `) as any[];

    const erg = await versendenUndProtokollieren(
      "termin_verpasst",
      {
        email: String(k?.email || ""),
        vorname: k?.vorname || null,
        agent_vorname: k?.agent_vorname || "Ihr Ansprechpartner",
        termin_datum: beginn ? berlinDatumText(beginn as any) : null,
        termin_uhrzeit: beginn ? berlinUhrzeit(beginn as any) : null,
        // Zweiter Parameter = HERKUNFT (seit 24.08.2026, siehe fiaon-termine.ts).
        // Sie landet als `?von=` im Link und macht im Bestand unterscheidbar,
        // wer nach einem verpassten Termin neu gebucht hat.
        termin_link: terminLink(personId, "termin_verpasst_mail"),
      },
      {
        personId, verlaufRef: ref,
        verlaufText: "Termin nicht zustande gekommen — E-Mail mit neuem Buchungslink versandt.",
      },
    );

    if (erg.status === "versandt") return { satz: "Die E-Mail mit dem neuen Buchungslink ist raus.", geglueckt: true };
    // Kein Erfolg: Die Marke wieder freigeben, sonst blockiert ein einmaliger
    // Fehlschlag den nächsten Versuch für immer. Der Fehlschlag steht mit Grund
    // im Zustellprotokoll.
    await sqlPool`UPDATE fiaon_termine SET verpasst_mail_am = NULL WHERE id = ${terminId}`;
    return {
      satz: `Die E-Mail ging NICHT raus (${erg.grund || erg.status}) — sie steht mit Grund im Protokoll und lässt sich aus der Akte nachsenden.`,
      geglueckt: false,
    };
  } catch (e) {
    console.error("[ONBOARDING] termin_verpasst:", e);
    return {
      satz: "Die E-Mail an den Kunden konnte nicht verschickt werden — bitte aus der Akte nachsenden.",
      geglueckt: false,
    };
  }
}

/** 404 statt 403 — die Rolle liest bei JEDEM Aufruf aus der Datenbank.
 *
 * ── E-045 (Justin 23.08., Plan §17): DIE ROLLEN-WAND IST OFFEN ────────────
 * VORHER: nur die Rolle „onboarding" kam in diesen Bereich (404 für alle
 * anderen) — Startgespräche waren ein eigener Pool.
 * NACHHER: EINE Rolle Bonitätsmanager führt ihre Startgespräche selbst.
 * Jeder außer der Rolle „inkasso" (Diana, Back-Office Forderungen &
 * Zahlungen) kommt hinein; die Termin-Routen sind ohnehin auf
 * `t.agent_id = ich` gescopt, und die Wartenden-Routen beschränken
 * Nicht-Onboarding-Rollen unten auf die eigenen Kunden.
 * Der Name bleibt, damit jede Route ihre Wand behält. */
async function nurOnboarding(req: AgentRequest, res: Response, next: any) {
  const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
  if ((await rolleVon(req.agent!.id)) === "inkasso") {
    return res.status(404).json({ ok: false, error: "Nicht gefunden" });
  }
  return next();
}

/** E-045: Sieht dieser Mitarbeiter ALLE Wartenden (Onboarding-Pool, Leitung)
 *  oder nur die eigenen Kunden (Bonitätsmanager)? */
async function siehtAlleWartenden(agentId: number): Promise<boolean> {
  const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
  const rolle = await rolleVon(agentId);
  return rolle === "onboarding" || rolle === "vertriebsleiter" || rolle === "admin";
}

async function nurMitZusage(req: AgentRequest, res: Response, next: any) {
  const { zusageStand } = await import("../lib/fiaon-vertrieb-zusage");
  const stand = await zusageStand(req.agent!.id, "onboarding", ONBOARDING_ZUSAGE_VERSION);
  if (stand.offen) {
    return res.status(403).json({
      ok: false,
      code: "zusage_erforderlich",
      version: stand.version,
      neufassung: stand.neufassung,
      error: stand.neufassung
        ? "Die Verpflichtungserklärung für das Onboarding wurde geändert. Bitte die neue Fassung lesen und annehmen."
        : "Bitte die Verpflichtungserklärung für das Onboarding lesen und annehmen.",
    });
  }
  return next();
}

// ───────────────────────────────────────────────────────────────────────────
// Verpflichtungserklärung — vor dem Zusage-Wächter, hinter dem Rollen-Wächter
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/onboarding/zusage", requireAgent, nurOnboarding, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageStand, zusageHash } = await import("../lib/fiaon-vertrieb-zusage");
    const stand = await zusageStand(req.agent!.id, "onboarding", ONBOARDING_ZUSAGE_VERSION);
    res.json({
      ok: true,
      offen: stand.offen,
      neufassung: stand.neufassung,
      akzeptiertAm: stand.akzeptiertAm,
      name: req.agent!.name,
      vorname: req.agent!.first_name || req.agent!.name,
      pruefwert: zusageHash(ONBOARDING_ZUSAGE_TEXT).slice(0, 16),
      text: ONBOARDING_ZUSAGE_TEXT,
    });
  } catch (err) {
    console.error("[ONBOARDING] zusage lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/onboarding/zusage", requireAgent, nurOnboarding, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageSpeichern } = await import("../lib/fiaon-vertrieb-zusage");
    const weiter = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ergebnis = await zusageSpeichern({
      agentId: req.agent!.id,
      agentName: req.agent!.name,
      version: String(req.body?.version || ""),
      nameGetippt: String(req.body?.name || ""),
      gelesen: req.body?.gelesen === true,
      ip: weiter || req.ip || null,
      userAgent: String(req.headers["user-agent"] || "") || null,
      bereich: "onboarding",
      sollVersion: ONBOARDING_ZUSAGE_VERSION,
      text: ONBOARDING_ZUSAGE_TEXT,
    });
    if (!ergebnis.ok) return res.status(400).json({ ok: false, error: ergebnis.grund });
    res.json({ ok: true, akzeptiertAm: ergebnis.akzeptiertAm });
  } catch (err) {
    console.error("[ONBOARDING] zusage speichern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Startgespräche
// ───────────────────────────────────────────────────────────────────────────

/** GET /agent/onboarding/termine — heute und die kommenden Tage. */
router.get("/agent/onboarding/termine", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const rows = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.dauer_min, t.status, t.notiz, t.quelle,
             t.onboarding_abgeschlossen_am, t.agenda_stand,
             -- Wann wurde er abgeschlossen? Ohne dieses Feld konnte die Liste
             -- „erledigt" nicht von „offen" trennen, und alles Heutige stand
             -- gemischt in einer Spalte (Teil 9 des Feedbacks, 19.08.2026).
             t.erledigt_am,
             -- Abgesagte Termine standen unter „Offen" — ohne Marke, ohne
             -- Knopf, als Geister (22.08.2026). Sie bleiben sieben Tage
             -- sichtbar, aber als das, was sie sind.
             t.abgesagt_am,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.primary_phone, p.primary_email
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.agent_id = ${req.agent!.id} AND t.quelle = 'onboarding_call'
        AND p.merged_into_person_id IS NULL
        AND t.beginn > NOW() - INTERVAL '30 days'
        AND (t.abgesagt_am IS NULL OR t.abgesagt_am > NOW() - INTERVAL '7 days')
      ORDER BY t.beginn ASC
      LIMIT 300
    `) as any[];
    const heute = berlinDatum(new Date());
    res.json({
      ok: true,
      termine: rows.map((t) => ({
        id: Number(t.id),
        personId: Number(t.person_id),
        name: t.name,
        vorname: t.vorname,
        telefon: t.primary_phone,
        email: t.primary_email,
        beginn: t.beginn,
        datum: berlinDatum(new Date(t.beginn)),
        datumText: berlinDatumText(t.beginn),
        uhrzeit: berlinUhrzeit(t.beginn),
        dauerMin: Number(t.dauer_min),
        status: t.status,
        notiz: t.notiz,
        erledigtAm: t.erledigt_am ?? null,
        abgesagtAm: t.abgesagt_am ?? null,
        onboardingAbgeschlossenAm: t.onboarding_abgeschlossen_am ?? null,
        // 04.09.2026 (E-120): Das Cockpit startet mit dem gespeicherten Stand — nicht leer.
        agendaStand: agendaEntpacken(t.agenda_stand),
        quelle: t.quelle,
        // Die Art wird auch hier mitgeliefert. Diese Liste zeigt fast immer
        // Onboarding-Gespräche — aber „fast immer" ist der Grund, warum die
        // Marke dasteht: Eine Ausnahme ohne Kennzeichen sieht wie die Regel aus.
        terminArt: terminArtAusQuelle(t.quelle).art,
        terminArtText: terminArtAusQuelle(t.quelle).text,
        terminArtTon: terminArtAusQuelle(t.quelle).ton,
        heute: berlinDatum(new Date(t.beginn)) === heute,
        vorbei: new Date(t.beginn).getTime() < Date.now(),
      })),
    });
  } catch (err) {
    console.error("[ONBOARDING] termine:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE NOTIZ AN DER PERSON — EINE QUELLE, SOFORT SICHTBAR
//
// ── DIE MELDUNG (Onboarding, 19.08.2026) ───────────────────────────────────
// „Wenn ich nach dem Gespräch bzw. außerhalb der Gesprächsführung eine
// Information als Notiz beim Kunden hinterlege, wird diese nach dem Speichern
// nicht übernommen. Dadurch gehen wichtige Informationen verloren."
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Es gab überhaupt keinen Weg, NUR eine Notiz zu speichern. Das Textfeld auf
// der Terminkarte ging ausschließlich mit „Nachtragen: geführt" oder „Nicht
// erschienen" mit — also nur zusammen mit einem ERGEBNIS. Und dieses Ergebnis
// schrieb die Notiz an den TERMIN (`fiaon_termine.notiz`), wo der nächste
// Aufruf sie auf NULL setzte (siehe die Route weiter unten).
//
// Eine Notiz am Termin ist ohnehin die falsche Ablage: Sie gehört zum MENSCHEN.
// Der nächste Kollege sucht sie in der Akte, nicht an einem Kalendereintrag von
// vorletzter Woche.
//
// ── DIE ANTWORT ────────────────────────────────────────────────────────────
// Diese Route schreibt einen Verlaufseintrag an die Person — in dieselbe
// Tabelle (`fiaon_contact_log`), die Kundenkarte, Vertriebsakte und
// Forderungsmanagement lesen. Eine Quelle, alle Leser. Und sie GIBT DEN
// VERLAUF ZURÜCK, damit die Oberfläche ihn ohne Neuladen zeigen kann: Ein
// gespeicherter Satz, der erst nach F5 erscheint, gilt als verloren.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Verlauf einer Person, wie die Onboarding-Karte ihn zeigt. */
async function verlaufLesen(personId: number): Promise<any[]> {
  return (await sqlPool`
    SELECT cl.created_at AS am, cl.agent_name, cl.type, cl.outcome, cl.note AS notiz
    FROM fiaon_contact_log cl
    JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${personId} AND cl.voided_at IS NULL
    ORDER BY cl.created_at DESC LIMIT 40
  `) as any[];
}

router.get("/agent/onboarding/person/:id/verlauf", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [erlaubt] = (await sqlPool`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${id} AND agent_id = ${req.agent!.id} AND quelle = 'onboarding_call'
      LIMIT 1
    `) as any[];
    if (!erlaubt) {
      return res.status(404).json({ ok: false, error: "Zu diesem Kunden hast du kein Startgespräch." });
    }
    res.json({ ok: true, verlauf: await verlaufLesen(id) });
  } catch (err) {
    console.error("[ONBOARDING] verlauf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/onboarding/notiz-analyse — { notiz }
 *
 * P1 (Team-Feedback 28.08.2026): Die frei getippte Gesprächsnotiz wird gegen
 * die Agenda geprüft. Zurück kommen die belegten Schritte (werden im Cockpit
 * abgehakt), je Schritt der Beleg-Satz (füllt die Pflichtnotiz), die noch
 * fehlenden Punkte als klare Hinweise — und optional eine sauberere Fassung
 * der Notiz, die der Mitarbeiter übernehmen kann.
 *
 * Reine Textanalyse: keine personId nötig, keine Kundendaten ans Modell.
 */
router.post("/agent/onboarding/notiz-analyse", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { notizAnalysieren } = await import("../lib/fiaon-notiz-analyse");
    const erg = await notizAnalysieren(String(req.body?.notiz || ""));
    res.json(erg);
  } catch (err) {
    console.error("[ONBOARDING] notiz-analyse:", err);
    res.status(500).json({ ok: false, herkunft: "keine", grund: "Serverfehler" });
  }
});

router.post("/agent/onboarding/person/:id/notiz", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const text = String(req.body?.notiz ?? "").trim();
    // Zwei Zeichen sind die Grenze zwischen „Vertipper" und „Vermerk". Mehr zu
    // verlangen wäre eine Hürde ohne Zweck — hier ist die Notiz freiwillig.
    if (text.length < 2) {
      return res.status(400).json({ ok: false, error: "Die Notiz ist leer." });
    }
    const [erlaubt] = (await sqlPool`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${id} AND agent_id = ${req.agent!.id} AND quelle = 'onboarding_call'
      LIMIT 1
    `) as any[];
    if (!erlaubt) {
      return res.status(404).json({ ok: false, error: "Zu diesem Kunden hast du kein Startgespräch." });
    }
    // Der Verlauf hängt an einer Bestellung (`ref`) — so liest ihn jede andere
    // Ansicht auch. Ohne Bestellung gibt es keine Akte, an der die Notiz hängt;
    // das wird GESAGT und nicht stillschweigend verschluckt.
    const [ref] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${id} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    // 25.08.2026: Eine Notiz ueber einen Menschen darf nicht daran scheitern,
    // dass er noch nichts bestellt hat. Siehe server/lib/fiaon-akte-anker.ts.
    const notizRef = ref?.ref || (await sorgeFuerAkte(id, req.agent!.id));
    if (!notizRef) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${notizRef}, ${id}, ${req.agent!.id}, ${req.agent!.name}, 'note', ${text.slice(0, 4000)}, NOW())
    `;
    // Der frische Verlauf geht direkt zurück — die Karte zeigt die Notiz damit
    // sofort, ohne einen zweiten Aufruf und ohne Neuladen.
    res.json({ ok: true, meldung: "Notiz gespeichert.", verlauf: await verlaufLesen(id) });
  } catch (err) {
    console.error("[ONBOARDING] notiz:", err);
    res.status(500).json({ ok: false, error: "Die Notiz konnte nicht gespeichert werden." });
  }
});

/**
 * GET /agent/onboarding/person/:id/lage — die Lage LESEND.
 *
 * Dieselben drei Bausteine wie im Vertriebsbereich (fiaon-kundenlage.ts). Es
 * gibt hier keinen Schreibweg: keine Buchung, keine Stammdatenänderung, keine
 * Zuweisung. Wer diese Route aufruft, bekommt ein Bild und keinen Hebel.
 *
 * Zusätzlich eingeschränkt: nur Kunden, mit denen diese Person auch wirklich
 * ein Startgespräch hat. Sonst wäre der Bereich eine Volltextsuche über den
 * gesamten Bestand mit einer schwächeren Erklärung als der des Vertriebs.
 */
router.get("/agent/onboarding/person/:id/lage", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [erlaubt] = (await sqlPool`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${id} AND agent_id = ${req.agent!.id} AND quelle = 'onboarding_call'
      LIMIT 1
    `) as any[];
    if (!erlaubt) {
      return res.status(404).json({ ok: false, error: "Zu diesem Kunden hast du kein Startgespräch." });
    }
    const [p] = (await sqlPool`
      SELECT id, primary_email,
             (SELECT COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,''))
                FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                ORDER BY a.created_at DESC LIMIT 1) AS app_email
      FROM fiaon_persons p WHERE p.id = ${id} AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const { zahlungsLage, dokumentLage, zugangsLage } = await import("../lib/fiaon-kundenlage");
    const { kartenLage } = await import("../lib/fiaon-kartenstatus");
    const [zahlung, dokumente, zugang, karte] = await Promise.all([
      zahlungsLage(id),
      dokumentLage(id),
      zugangsLage(p.primary_email || p.app_email || ""),
      kartenLage(id),
    ]);
    // Kopfzeile des Cockpits: Paket, Zahlungsstand, Bonitätsauskunft — das
    // Cockpit las diese Felder seit dem ersten Tag, bekam sie aber nie.
    const { zahlungsstatusText } = await import("@shared/fiaon-kundenstatus");
    const paketZeile = zahlung.find((z) => z.paket && !/bonit|schufa|auskunft/i.test(String(z.paket))) ?? zahlung[0] ?? null;
    let bonitaet: string | null = null;
    try {
      const { bonitaetFuer } = await import("../lib/fiaon-bonitaet-status");
      const refFuerBonitaet = paketZeile?.ref ?? zahlung[0]?.ref ?? null;
      const stand = refFuerBonitaet ? await bonitaetFuer(String(refFuerBonitaet)) : null;
      bonitaet = stand?.grund ?? null;
    } catch { /* Bonität ist Beiwerk — die Lage darf nicht daran scheitern. */ }
    // ── P7 (28.08.2026): Die Kundendaten GEHÖREN ins Cockpit ──────────────
    // „Sobald ich auf Gespräch führen klicke, sehe ich die Kundendaten nicht
    // mehr." Stammdaten und Ratenstand kommen jetzt mit — das Cockpit zeigt
    // sie neben der Agenda, ohne dass jemand die Bühne verlassen muss.
    const [stamm] = (await sqlPool`
      SELECT COALESCE(NULLIF(p.first_name,''), p.contact_name) AS vorname, p.last_name AS nachname,
             COALESCE(p.birthdate, (SELECT a0.birthdate FROM fiaon_applications a0
               WHERE a0.person_id = p.id AND a0.merged_into IS NULL AND a0.birthdate IS NOT NULL
               ORDER BY a0.created_at DESC LIMIT 1)) AS birth_date,
             p.primary_phone,
             (SELECT NULLIF(TRIM(CONCAT_WS(', ',
                NULLIF(TRIM(a.street), ''),
                NULLIF(TRIM(CONCAT_WS(' ', a.zip, a.city)), ''))), '')
              FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
              ORDER BY (a.payment_status='paid') DESC, a.created_at DESC LIMIT 1) AS adresse,
             (SELECT a2.phone FROM fiaon_applications a2
              WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND NULLIF(a2.phone,'') IS NOT NULL
              ORDER BY a2.created_at DESC LIMIT 1) AS app_phone
      FROM fiaon_persons p WHERE p.id = ${id}
    `) as any[];
    const [raten] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE r.status = 'bezahlt')::int AS bezahlt,
             COUNT(*) FILTER (WHERE r.status <> 'bezahlt' AND r.faellig_am >= CURRENT_DATE)::int AS offen,
             COUNT(*) FILTER (WHERE r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE)::int AS ueberfaellig,
             MIN(r.faellig_am) FILTER (WHERE r.status <> 'bezahlt') AS naechste_am,
             MAX(r.betrag_cents) AS rate_cents
      FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
      WHERE ar.person_id = ${id} AND ar.merged_into IS NULL AND r.storniert_am IS NULL
    `) as any[];
    res.json({
      ok: true, zahlung, dokumente, zugang, karte,
      paket: paketZeile?.paket ?? null,
      zahlungsstand: paketZeile ? zahlungsstatusText(paketZeile.status) : null,
      bonitaet,
      stammdaten: stamm ? {
        name: [stamm.vorname, stamm.nachname].filter(Boolean).join(" "),
        geburtsdatum: stamm.birth_date ?? null,
        adresse: stamm.adresse ?? null,
        telefon: stamm.primary_phone || stamm.app_phone || null,
        email: p.primary_email || p.app_email || null,
      } : null,
      raten: raten ? {
        bezahlt: Number(raten.bezahlt || 0), offen: Number(raten.offen || 0),
        ueberfaellig: Number(raten.ueberfaellig || 0),
        naechsteAm: raten.naechste_am ?? null,
        rateCents: raten.rate_cents != null ? Number(raten.rate_cents) : null,
      } : null,
    });
  } catch (err) {
    console.error("[ONBOARDING] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/onboarding/termine/:id/ergebnis — erledigt oder nicht erschienen.
 *
 * „Nicht erschienen" nimmt denselben Weg wie ein erfolgloser Anruf
 * (fiaon-nicht-erreicht.ts) und stößt eine neue Einladung an. Ein Kunde, der
 * einmal nicht am Telefon war, soll nicht durchs Raster fallen — und einer,
 * der dreimal nicht erscheint, soll nicht ewig neu eingeladen werden. Beides
 * regelt die vorhandene Automatik, deshalb wird sie hier benutzt und nicht
 * nachgebaut.
 */
/**
 * DER EINE WEG, EIN STARTGESPRÄCH ABZUSCHLIESSEN (22.08.2026, E-022 / K2)
 *
 * Vorher gab es zwei: diese Route (schaltet frei, bucht die Gutschrift, sagt
 * dem Kunden Bescheid) und der Haken im Kalender (`/agent/termine/:id/
 * ergebnis`), der nur `status = 'erledigt'` setzte. Wer morgens seinen
 * Kalender öffnete — die Gewohnheit aus jedem anderen Portal —, arbeitete den
 * ganzen Tag in der folgenlosen Fassung: Kunde „erledigt", Konto gesperrt,
 * Onboarder unbezahlt. Jetzt ruft der Kalender diese Funktion.
 *
 * `jederZustaendige`: Der Kalender prüft die Zuständigkeit bereits über
 * `darfAnKunde` (Vertretung, Übergabe). Die Onboarding-Route bleibt bei
 * „nur der Agent, dem der Termin gehört".
 */
export async function startgespraechErgebnis(opts: {
  terminId: number;
  agent: { id: number; name: string };
  ergebnis: unknown;
  notiz?: unknown;
  agenda?: unknown;
  dauerSek?: unknown;
  jederZustaendige?: boolean;
  // ── ZWEI ZUSÄTZE VOM 24.08.2026 ─────────────────────────────────────────
  // VORHER: „verpasst“ hatte genau eine Bedeutung und genau eine Folge.
  // NACHHER: Die Grund-Wahl (Route weiter unten) benutzt DIESELBE Funktion —
  // sie reicht nur den Grund durch und schaltet, wo nötig, die eine Mail ab,
  // die zu einem anderen Grund nicht passt.
  // GRUND: Auftrag des Inhabers vom 24.08.2026. Ein zweiter Abschlussweg wäre
  // genau der Fehler, den der Kommentar über dieser Funktion beschreibt.
  /** Warum das Gespräch nicht stattgefunden hat — reine Buchführung. */
  grund?: NichtErschienenGrund | null;
  /**
   * Die Mail „Termin nicht zustande gekommen“ NICHT schicken.
   * Nur für Gründe, die eine eigene, passendere Mail auslösen (falsche
   * Rufnummer). Ohne das bekäme derselbe Mensch zwei Mails auf einmal.
   */
  ohneVerpasstMail?: boolean;
}): Promise<{ status: number; body: any }> {
    const id = Number(opts.terminId);
    const ergebnis = opts.ergebnis;
    const notiz = opts.notiz;
    const req = { agent: opts.agent } as { agent: { id: number; name: string } };
    if (!["erledigt", "verpasst"].includes(String(ergebnis))) {
      return { status: 400, body: { ok: false, error: "Ergebnis muss 'erledigt' oder 'verpasst' sein." } };
    }
    // Der Stand der Agenda und die Gesprächsdauer kommen aus dem Cockpit.
    // Beides ist freiwillig: Ein Gespräch, das ohne das Cockpit geführt wurde
    // (Telefon klingelte einfach), muss trotzdem abschließbar sein.
    const agendaStand = opts.agenda && typeof opts.agenda === "object"
      ? opts.agenda : null;
    const dauerSek = Number.isFinite(Number(opts.dauerSek))
      ? Math.max(0, Math.min(4 * 3600, Number(opts.dauerSek))) : null;

    // ── AUCH EIN VERPASSTER TERMIN LÄSST SICH NACHTRAGEN ─────────────────
    // Hier stand `status = 'gebucht'`. Ein Tageslauf setzt Termine nach zwölf
    // Stunden auf „verpasst" — danach war der Termin nicht mehr abschließbar,
    // auch wenn der Kunde sich abends doch gemeldet hatte.
    // P10: Auch ein bereits ERLEDIGTER Termin bleibt ansprechbar, solange das
    // Onboarding nicht abgeschlossen ist — so trägt das Cockpit die Doku nach
    // und schließt ab. Ein Rückfall erledigt → verpasst bleibt ausgeschlossen.
    const [termin] = (await sqlPool`
      SELECT id, person_id, beginn, status AS status_vorher FROM fiaon_termine
      WHERE id = ${id} AND quelle = 'onboarding_call'
        AND (${opts.jederZustaendige === true} OR agent_id = ${req.agent!.id})
        AND (status IN ('gebucht', 'verpasst')
             OR (status = 'erledigt' AND ${String(ergebnis) === "erledigt"}
                 AND onboarding_abgeschlossen_am IS NULL))
    `) as any[];
    if (!termin) return { status: 404, body: { ok: false, error: "Termin nicht gefunden." } };
    // P10-Nachdoku (Abnahme-Fund 02.09.): War der Termin schon erledigt, ist
    // dieser Aufruf nur die NACHDOKUMENTATION — Zeitstempel und Verlauf des
    // ursprünglichen Gesprächs bleiben unangetastet.
    const warErledigt = String(termin.status_vorher) === "erledigt";
    // 04.09.2026 (E-120): Ob die Pflicht-Agenda erfüllt war — der Verlaufstext
    // darf „abgeschlossen" nur sagen, wenn es stimmt (Nikita, 17:12 und 17:16:
    // zweimal „abgeschlossen" im Verlauf, der Termin blieb „zu dokumentieren").
    let dokuOk: boolean | null = null;
    let dokuFehlt: string[] = [];

    // ══════════════════════════════════════════════════════════════════════
    // EINE LEERE ANGABE LÖSCHT NICHTS MEHR (19.08.2026)
    //
    // ── DIE MELDUNG (Onboarding) ─────────────────────────────────────────
    // „Wenn ich nach dem Gespräch eine Information als Notiz beim Kunden
    // hinterlege, wird diese nach dem Speichern nicht übernommen. Ich trage die
    // Notiz ein, klicke auf Speichern, anschließend ist die Notiz jedoch nicht
    // mehr vorhanden."
    //
    // ── WAS HIER STAND ───────────────────────────────────────────────────
    //     notiz = ${notiz ? … : null}
    //     agenda_stand = ${agendaStand ? … : null}
    //     dauer_sek = ${dauerSek}
    //
    // Drei Felder, die bei JEDEM Aufruf ohne Angabe auf NULL gingen. Wer erst
    // eine Notiz nachtrug und danach etwas anderes festhielt (oder das Cockpit
    // ohne Notizen abschloss), löschte damit die eigene Notiz — und den ganzen
    // Agenda-Stand dazu. Das Speichern war nicht das Problem; das ZWEITE
    // Speichern war es.
    //
    // `COALESCE` schreibt nur, was mitkommt. Eine Angabe, die fehlt, ist keine
    // Anweisung zum Löschen.
    // ══════════════════════════════════════════════════════════════════════
    await sqlPool`
      UPDATE fiaon_termine SET status = ${String(ergebnis)},
             erledigt_am = COALESCE(erledigt_am, NOW()),
             notiz = COALESCE(${notiz ? String(notiz).slice(0, 4000) : null}, notiz),
             -- 04.09.2026 (E-121): sqlPool.json statt JSON.stringify()::jsonb — der
             -- String landete als JSON-STRING in der Spalte, die Prüfung las „leer",
             -- und jeder Abschluss scheiterte still (17 Termine, 5 hängend).
             agenda_stand = COALESCE(${agendaStand ? sqlPool.json(agendaStand as any) : null}, agenda_stand),
             dauer_sek = COALESCE(${dauerSek}, dauer_sek),
             updated_at = NOW()
      WHERE id = ${id}
    `;

    const [ref] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${termin.person_id} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];

    let hinweis = "Startgespräch als erledigt vermerkt.";
    // 24.08.2026: Ging die Mail an den Kunden wirklich raus? Die Oberfläche
    // meldet danach grün oder bernstein — ohne das Feld müsste sie den Satz
    // nach Wörtern absuchen.
    let versandOk = true;
    if (ergebnis === "verpasst") {
      await sqlPool`
        UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1, updated_at = NOW()
        WHERE id = ${termin.person_id}
      `;
      const { automatikNachFehlversuch } = await import("../lib/fiaon-nicht-erreicht");
      const wirkung = await automatikNachFehlversuch(Number(termin.person_id));
      // Neue Einladung: Das Gate im Portal erscheint wieder, weil kein
      // gebuchter oder erledigter Termin mehr existiert. Zusätzlich wird die
      // 48-Stunden-Uhr neu gestellt, damit die Erinnerungsmail erneut greifen
      // kann — sonst wäre ein einmal verpasster Termin das Ende der Kette.
      await sqlPool`
        UPDATE fiaon_persons
        SET startgespraech_mail_am = NULL, startgespraech_spaeter_am = NOW(), updated_at = NOW()
        WHERE id = ${termin.person_id}
      `;

      // ══════════════════════════════════════════════════════════════════
      // DIE MAIL, DIE HIER GEFEHLT HAT (24.08.2026)
      //
      // VORHER: Nach diesem Punkt war der Vorgang zu Ende. Der Kunde bekam
      //   NICHTS. Die drei Dinge, die aussahen, als würden sie greifen,
      //   greifen alle nicht:
      //     · `automatikNachFehlversuch` schreibt erst ab dem SECHSTEN
      //       erfolglosen Versuch (SCHWELLE_MAIL = 6) — und ist zusätzlich
      //       gesperrt, solange ein Termin existiert; beim No-Show existiert
      //       er ja gerade.
      //     · Die 48-Stunden-Uhr oben lässt den Lauf
      //       `runStartgespraechEinladungen` frühestens ZWEI TAGE später die
      //       generische Einladung schicken.
      //     · Deren Text klingt, als hätte es nie einen Termin gegeben.
      //   Der Hinweis in der Oberfläche („der Kunde wird erneut eingeladen")
      //   war damit nur halb wahr.
      // NACHHER: Sofort eine eigene Mail mit ruhigem Ton und dem Link auf
      //   einen neuen Termin. Die Kette oben bleibt unangetastet — sie ist
      //   das Netz darunter, nicht die Antwort.
      // GRUND: Auftrag des Inhabers vom 24.08.2026 — „wenn man ‚Kunde nicht
      //   erreicht' klickt muss der Kunde eine Email bekommen mit ‚Leider
      //   nicht erschienen.. hier neuen Termin buchen'".
      //
      // WIRFT NIE: Ein Versandfehler darf einen dokumentierten No-Show nicht
      // ungültig machen. Was schiefging, steht im Zustellprotokoll und lässt
      // sich aus der Akte von Hand nachsenden.
      // ══════════════════════════════════════════════════════════════════
      //
      // 24.08.2026, Zusatz: `ohneVerpasstMail` überspringt genau diesen einen
      // Schritt — für den Grund „Telefonnummer stimmt nicht“, der stattdessen
      // die Bitte um eine neue Rufnummer schickt. Alles andere (Zähler,
      // Automatik, 48-Stunden-Uhr, Verlaufseintrag) bleibt gleich.
      const verpasstMail = opts.ohneVerpasstMail === true
        ? { satz: null, geglueckt: true }
        : await verpasstMailSenden(id, Number(termin.person_id), termin.beginn, ref?.ref || null);
      versandOk = verpasstMail.geglueckt;

      hinweis = opts.ohneVerpasstMail === true
        ? `Nicht erschienen — zählt als erfolgloser Versuch.${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`
        : `Nicht erschienen — zählt als erfolgloser Versuch, und der Kunde bekommt sofort eine E-Mail mit dem Link für einen neuen Termin.${verpasstMail.satz ? ` ${verpasstMail.satz}` : ""}${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`;
    } else {
      const { erreichtZuruecksetzen } = await import("../lib/fiaon-nicht-erreicht");
      await erreichtZuruecksetzen(Number(termin.person_id));

      // ══════════════════════════════════════════════════════════════════
      // HIER UND NUR HIER WIRD FREIGESCHALTET
      //
      // Die Geschäftsregel: „Erst nach ERLEDIGTEM Startgespräch wird der
      // Account voll freigeschaltet." Das ist der eine Weg. Ein zweiter —
      // etwa „bei der Zahlung gleich mit" — würde die Pflicht zu einer Bitte
      // machen, und niemand hätte je ein Startgespräch geführt.
      //
      // Der ausdrückliche Admin-Übergang bleibt als Ausnahme, mit Grund und
      // protokolliert (siehe POST /admin/kunden/:ref/freischalten).
      // ══════════════════════════════════════════════════════════════════
      const { vollFreischalten } = await import("../lib/fiaon-kontostufe");
      const frei = await vollFreischalten(Number(termin.person_id), {
        name: req.agent!.name,
        grund: `Startgespräch geführt am ${berlinDatumText(termin.beginn)}`,
      });
      if (frei.freigeschaltet > 0) {
        hinweis = "Startgespräch erledigt — das Konto ist jetzt VOLL freigeschaltet. "
          + "Der Kunde sieht ab sofort seinen Fahrplan und alle Inhalte.";
        // Der Kunde erfährt es: Der Zweig `account_activated` steht in der
        // Ereignisliste. Fehlt er bei Make, scheitert der Versand SICHTBAR im
        // Zustellprotokoll — besser als ein Kunde, der nicht weiß, dass er
        // jetzt darf.
        try {
          const { sendMakeWebhookMitGrund } = await import("../make-webhook");
          const [k] = (await sqlPool`
            SELECT a.ref, a.person_id, a.email, a.first_name, a.last_name,
                   a.payment_reference, a.amount_due, a.pack_name
            FROM fiaon_applications a WHERE a.ref = ${frei.refs[0]}
          `) as any[];
          if (k) {
            const { makePayloadFromRow } = await import("../make-webhook");
            await sendMakeWebhookMitGrund("account_activated", {
              ...makePayloadFromRow(k),
              portal_url: absoluteUrl("/dashboard"),
              freigeschaltet_am_text: berlinDatumText(new Date()),
            } as any);
          }
        } catch (e) {
          console.error("[ONBOARDING] account_activated:", e);
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // DIE VERGÜTUNG — nach der Freischaltung, nicht davor
      //
      // Reihenfolge mit Absicht: Erst ist das Konto frei (das schuldet man dem
      // Kunden), dann entsteht die Gutschrift. Und sie WIRFT NICHT — ein
      // Fehler in der Vergütung darf ein geführtes Gespräch nicht ungültig
      // machen. Der Mitarbeiter erfährt im Hinweis, was passiert ist.
      //
      // Genau eine je Kunde: Ein zweites Gespräch mit demselben Menschen
      // erzeugt keine zweite Gutschrift (Teilindex in Migration 057).
      // ══════════════════════════════════════════════════════════════════
      // ── P10 (01.09.2026): ABSCHLUSS ≠ TERMIN-HAKEN ─────────────────────
      // Ein Ereignis trug vier Bedeutungen: Gespräch war, Kunde raus aus dem
      // Bereich, Konto frei, 15 € gebucht. Die Freischaltung bleibt beim
      // Gespräch (die schuldet man dem Kunden). Der ABSCHLUSS — und mit ihm
      // die Vergütung — verlangt jetzt die dokumentierte Pflicht-Agenda,
      // serverseitig mit DERSELBEN Regel, die das Cockpit nutzt.
      const { darfAbschliessen } = await import("../../shared/fiaon-onboarding-agenda");
      const [standRow] = (await sqlPool`
        SELECT agenda_stand, onboarding_abgeschlossen_am FROM fiaon_termine WHERE id = ${id}
      `) as any[];
      const roh: any = agendaEntpacken(standRow?.agenda_stand);
      // Ältere agenda_stand-Formate tolerant lesen — ein krummes JSON darf den
      // Cockpit-Weg nicht zum Scheitern bringen.
      const stand = {
        erledigt: Array.isArray(roh?.erledigt) ? roh.erledigt.map(String) : [],
        notizen: roh?.notizen && typeof roh.notizen === "object" ? roh.notizen : {},
      };
      const doku = darfAbschliessen(stand as any);
      dokuOk = doku.ok; dokuFehlt = doku.fehlt;
      if (doku.ok) {
        if (!standRow?.onboarding_abgeschlossen_am) {
          await sqlPool`
            UPDATE fiaon_termine SET onboarding_abgeschlossen_am = NOW(), updated_at = NOW()
            WHERE id = ${id} AND onboarding_abgeschlossen_am IS NULL
          `;
        }
        const { onboardingGutschrift } = await import("../lib/fiaon-onboarding-verguetung");
        const geld = await onboardingGutschrift({
          personId: Number(termin.person_id),
          agentId: req.agent!.id,
          agentName: req.agent!.name,
          terminId: id,
          ref: ref?.ref ?? null,
        });
        if (geld.gutgeschrieben) hinweis += ` ${geld.grund}`;
        else if (geld.cents > 0) hinweis += ` (${geld.grund})`;
      } else {
        hinweis += ` Onboarding noch NICHT abgeschlossen — es fehlt: ${doku.fehlt.join(", ")}. `
          + "Der Kunde bleibt im Onboarding-Bereich unter „Zu dokumentieren“; "
          + "die Vergütung kommt mit dem dokumentierten Abschluss im Cockpit.";
      }
    }

    // 24.08.2026: Der Grund wandert an den Termin. Schweigend und nach der
    // eigentlichen Arbeit — siehe `verpasstGrundVermerken`.
    if (opts.grund) await verpasstGrundVermerken(id, String(opts.grund));

    if (ref) {
      // VORHER (bis 24.08.2026) stand hier für JEDEN verpassten Termin
      // „Kunde nicht erschienen“ — auch wenn die Nummer falsch war. Wer die
      // Akte später las, sah einen Menschen, der dreimal nicht erschienen ist,
      // und nicht drei falsche Ziffern. NACHHER steht der Grund im Klartext.
      const grundText = opts.grund === "nummer_falsch"
        ? "Kunde nicht erreicht — die hinterlegte Rufnummer stimmt nicht"
        : "Kunde nicht erschienen";
      const dokuSatz = dokuOk === true ? " Onboarding abgeschlossen." : dokuOk === false ? ` Onboarding noch NICHT abgeschlossen — es fehlt: ${dokuFehlt.join(", ")}.` : "";
      const text = ergebnis === "erledigt"
        ? warErledigt
          ? `Onboarding nachdokumentiert (Gespräch vom ${berlinDatumText(termin.beginn)}).${dokuSatz}${notiz ? ` ${String(notiz).slice(0, 2000)}` : ""}`
          : `Startgespräch geführt (${berlinDatumText(termin.beginn)}, ${berlinUhrzeit(termin.beginn)} Uhr).${dokuSatz}${notiz ? ` ${String(notiz).slice(0, 2000)}` : ""}`
        : `Startgespräch verpasst — ${grundText} (${berlinDatumText(termin.beginn)}, ${berlinUhrzeit(termin.beginn)} Uhr).${notiz ? ` ${String(notiz).slice(0, 2000)}` : ""}`;
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, ${req.agent!.id}, ${req.agent!.name}, 'result', ${text}, NOW())
      `.catch(() => {});
    }
    return { status: 200, body: { ok: true, hinweis, versandOk } };
}

/** Alte Zeilen tragen die Agenda als JSON-String (doppelt verpackt) — beides lesen. */
function agendaEntpacken(v: any): any {
  if (v == null) return null;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return v;
}

/**
 * 04.09.2026 (E-121): Hängende Onboarding-Termine nachziehen — Gespräch geführt,
 * Agenda vollständig, aber `onboarding_abgeschlossen_am` blieb leer, weil die
 * Agenda als String gespeichert war. Idempotent; schreibt je Termin einen
 * Verlaufseintrag. Nur Admin.
 */
router.post("/admin/onboarding/doku-nachziehen", async (_req: Request, res: Response) => {
  try {
    const { darfAbschliessen } = await import("../../shared/fiaon-onboarding-agenda");
    const zeilen = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.agenda_stand, t.agent_id, a.name AS agent_name
        FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
       WHERE t.status = 'erledigt' AND t.onboarding_abgeschlossen_am IS NULL AND t.abgesagt_am IS NULL
         AND t.quelle IN ('onboarding', 'onboarding_call') AND t.agenda_stand IS NOT NULL
       ORDER BY t.beginn DESC LIMIT 200
    `) as any[];
    const erg: { id: number; ok: boolean; fehlt?: string[] }[] = [];
    for (const t of zeilen) {
      const roh = agendaEntpacken(t.agenda_stand);
      const stand = { erledigt: Array.isArray(roh?.erledigt) ? roh.erledigt.map(String) : [], notizen: roh?.notizen && typeof roh.notizen === "object" ? roh.notizen : {} };
      const doku = darfAbschliessen(stand as any);
      if (!doku.ok) { erg.push({ id: Number(t.id), ok: false, fehlt: doku.fehlt }); continue; }
      await sqlPool`
        UPDATE fiaon_termine SET onboarding_abgeschlossen_am = NOW(), agenda_stand = ${sqlPool.json(stand as any)}, updated_at = NOW()
         WHERE id = ${Number(t.id)} AND onboarding_abgeschlossen_am IS NULL
      `;
      const [ref] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE person_id = ${Number(t.person_id)} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`) as any[];
      if (ref?.ref) await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, ${Number(t.person_id)}, NULL, 'System', 'system',
                ${`Onboarding abgeschlossen (nachgezogen): Die Agenda von ${t.agent_name || "dem Mitarbeiter"} war vollständig, nur der Abschluss fehlte durch einen Speicherfehler.`}, NOW())
      `.catch(() => {});
      erg.push({ id: Number(t.id), ok: true });
    }
    res.json({ ok: true, geprueft: zeilen.length, abgeschlossen: erg.filter((e) => e.ok).length, offen: erg.filter((e) => !e.ok) });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

router.post("/agent/onboarding/termine/:id/ergebnis", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await startgespraechErgebnis({
      terminId: Number(req.params.id),
      agent: { id: req.agent!.id, name: req.agent!.name },
      ergebnis: req.body?.ergebnis, notiz: req.body?.notiz,
      agenda: req.body?.agenda, dauerSek: req.body?.dauerSek,
    });
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[ONBOARDING] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// „KUNDE NICHT ERSCHIENEN“ — DER GRUND ENTSCHEIDET, WAS PASSIERT
// (NEU AM 24.08.2026)
//
// ── DER AUFTRAG (Justin, wörtlich) ─────────────────────────────────────────
// „man braucht aber auch so was wie ‚Kunde nicht erschienen‘, dann wählt man
// aus WARUM, und basierend darauf löst sich was aus: ‚Telefonnummer nicht
// korrekt‘ → Mail für neue Nummer, ‚nicht erschienen‘ → Mail mit neuem Termin“
//
// ── VORHER ─────────────────────────────────────────────────────────────────
// Ein Knopf, eine Folge. Vier verschiedene Menschen — der Ausgebliebene, der
// mit der falschen Nummer, der Absager und der, der nicht mehr will — bekamen
// alle dieselbe Behandlung. Beim letzten war das eine Aufforderung an
// jemanden, der gerade abgesagt hatte.
//
// ── NACHHER ────────────────────────────────────────────────────────────────
//   nicht_erschienen  → Mail „termin_verpasst“ mit Link auf einen neuen Termin
//   nummer_falsch     → Mail „number_update_request“ (Kunde berichtigt selbst,
//                       der Terminlink fährt mit)
//   kunde_abgesagt    → Termin absagen + Mail „onboarding_einladung“
//   kein_interesse    → KEINE Mail. Nur die Akte, mit Pflicht-Notiz — und die
//                       48-Stunden-Automatik wird angehalten. Ein Mensch, der
//                       abgesagt hat, bekommt keine Aufforderung mehr.
//
// ── KEIN DOPPELVERSAND ─────────────────────────────────────────────────────
// Für jeden Grund gibt es eine Marke, und sie wird ATOMAR gesetzt — nicht
// „vorher nachschauen, dann senden“ (zwei Klicks nebeneinander kämen beide
// durch):
//   nicht_erschienen  `fiaon_termine.verpasst_mail_am` (UPDATE … WHERE IS NULL)
//   nummer_falsch     `fiaon_number_update_requests` — höchstens eine Bitte je
//                     Person und 24 Stunden (server/fiaon-number-update.ts)
//   kunde_abgesagt    der Termin selbst: das Absagen greift nur, solange er
//                     „gebucht“ oder „verpasst“ ist. Der zweite Klick findet
//                     nichts mehr und sagt das auch.
//   kein_interesse    dieselbe Marke — und es geht ohnehin keine Mail raus.
// Eine neue Spalte je Grund wäre vier Spalten für eine Frage, die drei
// vorhandene Marken schon beantworten.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Meldet einen Termin als nicht zustande gekommen — MIT Grund und Folge.
 *
 * Gibt einen Satz zurück, der sagt, WAS geschehen ist (nicht „gespeichert“),
 * und `versandOk: false`, wenn die Mail nicht rausging. Der Vorgang bleibt
 * dann trotzdem korrekt dokumentiert: Ein Versandfehler darf einen
 * dokumentierten No-Show nicht ungültig machen.
 */
export async function nichtErschienenMelden(opts: {
  terminId: number;
  agent: { id: number; name: string };
  grund: unknown;
  notiz?: unknown;
}): Promise<{ status: number; body: any }> {
  const id = Number(opts.terminId);
  const grund = String(opts.grund ?? "") as NichtErschienenGrund;
  // `hasOwnProperty` und NICHT `in`: Der Wert kommt von aussen, und `in` sucht
  // auch die Prototypenkette ab — „toString“ und „constructor“ kämen damit
  // als gültige Gründe durch und fielen unten in den letzten Zweig.
  if (!Object.prototype.hasOwnProperty.call(NICHT_ERSCHIENEN_GRUENDE, grund)) {
    return { status: 400, body: { ok: false, error: "Unbekannter Grund." } };
  }
  const notiz = String(opts.notiz ?? "").trim();
  if (NICHT_ERSCHIENEN_GRUENDE[grund].notizPflicht && notiz.length < NOTIZ_MINDEST) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Bitte halte in einem Satz fest, was der Kunde gesagt hat — "
          + "ohne Mail ist deine Notiz das Einzige, was davon bleibt.",
      },
    };
  }

  const [termin] = (await sqlPool`
    SELECT t.id, t.person_id, t.agent_id, t.beginn, t.status, t.abgesagt_am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email) AS name,
           COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS email
    FROM fiaon_termine t
    JOIN fiaon_persons p ON p.id = t.person_id
    WHERE t.id = ${id} AND t.quelle = 'onboarding_call'
      AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!termin) return { status: 404, body: { ok: false, error: "Termin nicht gefunden." } };

  // ── DIE RECHTE, SERVERSEITIG ─────────────────────────────────────────────
  // Der eigene Termin immer. Sonst entscheidet `darfAnKunde` — dieselbe
  // Fassung, die Telefon, Mail und Kalender benutzen (Vertretung und Übergabe
  // sind dort schon eingebaut). Eine eigene Regel an dieser Stelle wäre die
  // fünfte Fassung derselben Frage.
  const personId = Number(termin.person_id);
  if (Number(termin.agent_id) !== opts.agent.id) {
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(opts.agent.id);
    if (!(await darfAnKunde(opts.agent.id, rolle, personId))) {
      return { status: 404, body: { ok: false, error: "Dieser Termin gehört nicht zu deinem Bestand." } };
    }
  }

  const name = String(termin.name || "Der Kunde");
  const [ref] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `) as any[];

  // ══════════════════════════════════════════════════════════════════════
  // ZWEI GRÜNDE GEHEN DEN VORHANDENEN WEG: „verpasst“
  //
  // Beides ist ein erfolgloser Versuch — Zähler, Automatik, 48-Stunden-Uhr
  // und Verlaufseintrag sind identisch. Nur die Mail unterscheidet sich.
  // Deshalb wird `startgespraechErgebnis` benutzt und nicht nachgebaut; ein
  // zweiter Abschlussweg war schon einmal die Ursache dafür, dass Konten
  // gesperrt blieben (siehe den Kommentar über jener Funktion).
  //
  // `jederZustaendige: true`, weil die Rechte oben bereits geprüft sind —
  // strenger als dort (nur der eigene Termin) und milder als gar nicht.
  // ══════════════════════════════════════════════════════════════════════
  if (grund === "nicht_erschienen" || grund === "nummer_falsch") {
    const erg = await startgespraechErgebnis({
      terminId: id,
      agent: opts.agent,
      ergebnis: "verpasst",
      notiz: notiz || undefined,
      jederZustaendige: true,
      grund,
      ohneVerpasstMail: grund === "nummer_falsch",
    });
    if (erg.status !== 200) return erg;

    if (grund === "nicht_erschienen") {
      // Was mit der Mail war, sagt `verpasstMailSenden` im Hinweis — wörtlich
      // und mit Grund, wenn sie nicht rausging. Hier kommt nur der Name davor.
      return {
        status: 200,
        body: {
          ok: true,
          versandOk: erg.body?.versandOk !== false,
          hinweis: `${name}: ${erg.body?.hinweis || "Als nicht erschienen vermerkt."}`,
        },
      };
    }

    // ── FALSCHE NUMMER: DER KUNDE BERICHTIGT SIE SELBST ──────────────────
    // Dieselbe Mail wie im Vertrieb (Kontakt-Ergebnis „Falsche Nummer“) —
    // signierter Link auf ein schlankes Formular, die neue Nummer landet
    // direkt im Datensatz. Der Terminlink fährt mit.
    // BETREIBER-TODO (bekannt, nicht Teil dieses Auftrags): Die Brevo-Vorlage
    // T23 zeigt `params.termin_link` noch nicht an.
    let satz: string;
    let versandOk = false;
    if (!ref?.ref) {
      satz = "Ohne Bestellung gibt es keinen Korrektur-Link — bitte die neue Nummer selbst erfragen und in der Akte nachtragen.";
    } else if (!termin.email) {
      satz = "Ohne E-Mail-Adresse konnte die Bitte um eine neue Rufnummer nicht rausgehen — hier hilft nur ein anderer Weg.";
    } else {
      const { maybeSendNumberUpdateMail } = await import("../fiaon-number-update");
      const versand = await maybeSendNumberUpdateMail("app", String(ref.ref), {
        email: String(termin.email), firstName: termin.vorname || null,
      });
      versandOk = versand.sent;
      satz = versand.sent
        ? `${name} hat die Bitte um eine neue Rufnummer bekommen — mit Formular und Terminlink.`
        : versand.reason === "rate_limit"
          ? "Die Bitte um eine neue Rufnummer ging heute schon raus — eine zweite geht nicht."
          : versand.reason === "keine_email"
            ? "Ohne E-Mail-Adresse konnte die Bitte um eine neue Rufnummer nicht rausgehen."
            : "Die Bitte um eine neue Rufnummer ging NICHT raus — sie steht mit Grund im Protokoll und lässt sich aus der Akte nachsenden.";
    }
    return {
      status: 200,
      body: {
        ok: true,
        versandOk,
        hinweis: `${name}: falsche Rufnummer festgehalten, zählt als erfolgloser Versuch. ${satz}`,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // DIE BEIDEN ANDEREN GRÜNDE SAGEN DEN TERMIN AB
  //
  // Nicht „verpasst“: Der Kunde HAT sich gemeldet. Ihn als unerreichbar zu
  // zählen, würde die Statistik verfälschen und im Zweifel eine Sperre
  // auslösen, die niemand gemeint hat.
  //
  // WARUM NICHT `terminAbsagen` aus fiaon-termine.ts: Die Funktion braucht
  // einen Storno-Token (den hat nur der Kunde in seiner Mail) und meldet die
  // Absage per Mail an den zuständigen Mitarbeiter — an genau den, der hier
  // gerade klickt. Der Slot wird trotzdem frei, das macht der Status.
  //
  // Das UPDATE ist zugleich die Doppelklick-Sperre: Es greift nur, solange
  // der Termin noch offen ist.
  // ══════════════════════════════════════════════════════════════════════
  const [abgesagt] = (await sqlPool`
    UPDATE fiaon_termine
    SET status = 'abgesagt', abgesagt_am = NOW(), abgesagt_von = 'kunde', updated_at = NOW(),
        notiz = COALESCE(${notiz ? notiz.slice(0, 4000) : null}, notiz)
    WHERE id = ${id} AND status IN ('gebucht', 'verpasst') AND abgesagt_am IS NULL
    RETURNING id
  `) as any[];
  if (!abgesagt) {
    return {
      status: 409,
      body: { ok: false, error: `Der Termin von ${name} ist bereits abgesagt — es geht nichts ein zweites Mal raus.` },
    };
  }
  await verpasstGrundVermerken(id, grund);

  if (grund === "kein_interesse") {
    // ── KEINE MAIL. UND AUCH SPÄTER KEINE ────────────────────────────────
    // Die 48-Stunden-Automatik (runStartgespraechEinladungen in
    // fiaon-startgespraech.ts) verschickt eine generische Einladung, solange
    // `startgespraech_spaeter_am` gesetzt und `startgespraech_mail_am` leer
    // ist. Ohne diese Zeile bekäme ein Mensch, der eben abgesagt hat,
    // übermorgen doch noch eine Aufforderung — von einer Automatik, die von
    // dem Gespräch nichts weiß.
    //
    // Bewusst NICHT gesetzt wird eine Kontaktsperre (`is_blocked`): Der Kunde
    // hat bezahlt und will keinen TERMIN — das ist etwas anderes als „nie
    // wieder anrufen“. Meldet er sich, läuft alles normal weiter.
    await sqlPool`
      UPDATE fiaon_persons SET startgespraech_spaeter_am = NULL, updated_at = NOW()
      WHERE id = ${personId}
    `.catch(() => {});
    await verlaufSchreiben(ref?.ref, opts.agent, termin.beginn,
      `Startgespräch abgesagt — der Kunde möchte keines mehr. ${notiz.slice(0, 2000)}`);
    return {
      status: 200,
      body: {
        ok: true,
        versandOk: true,
        hinweis: `${name} will kein Startgespräch mehr. Nur festgehalten — es geht KEINE E-Mail raus, `
          + "und die automatischen Erinnerungen sind für ihn aus. Deine Notiz steht in der Akte.",
      },
    };
  }

  // ── ABGESAGT: EINLADUNG FÜR EINEN NEUEN TERMIN ───────────────────────────
  // Dieselbe Vorlage wie in der Wartenden-Liste — der Kunde wählt seine Zeit
  // selbst. `versandErlaubt` prüft vorher DSGVO, Kontaktsperre, Adresse und
  // Zustand; die Termin-Sperre darin greift nicht mehr, weil der alte Termin
  // eine Zeile weiter oben abgesagt wurde.
  const { versandErlaubt } = await import("../lib/fiaon-versand");
  const pruefung = await versandErlaubt(personId, "onboarding_einladung");
  let satz: string;
  let versandOk = false;
  if (!pruefung.erlaubt) {
    satz = `Die Einladung ging NICHT raus: ${pruefung.grund}`;
  } else {
    const erg = await versendenUndProtokollieren(
      "onboarding_einladung",
      {
        email: String(termin.email || ""),
        vorname: termin.vorname || null,
        termin_link: terminLink(personId, "onboarding_einladung"),
      },
      {
        personId, verlaufRef: ref?.ref || null,
        verlaufText: `Termin abgesagt (Kunde) — Einladung für einen neuen Termin versandt von ${opts.agent.name}.`,
        ausgeloestVon: opts.agent.name, ausgeloestAgentId: opts.agent.id,
      },
    );
    versandOk = erg.status === "versandt";
    if (versandOk) {
      // Wie in der Wartenden-Liste: Die Einladung IST raus, die Automatik
      // braucht nicht nachzulegen.
      await sqlPool`UPDATE fiaon_persons SET startgespraech_mail_am = NOW(), updated_at = NOW() WHERE id = ${personId}`.catch(() => {});
      satz = `${name} hat die Einladung für einen neuen Termin bekommen.`;
    } else {
      // Der Versand hat nicht geklappt — dann soll wenigstens das Netz
      // darunter greifen: die 48-Stunden-Automatik neu stellen.
      await sqlPool`
        UPDATE fiaon_persons
        SET startgespraech_mail_am = NULL,
            startgespraech_spaeter_am = COALESCE(startgespraech_spaeter_am, NOW()),
            updated_at = NOW()
        WHERE id = ${personId}
      `.catch(() => {});
      satz = `Die Einladung ging NICHT raus (${erg.grund || erg.status}) — sie steht mit Grund im Protokoll `
        + "und lässt sich aus der Akte nachsenden.";
    }
  }
  await verlaufSchreiben(ref?.ref, opts.agent, termin.beginn,
    `Startgespräch abgesagt — der Kunde konnte nicht. ${notiz.slice(0, 2000)}`);
  return {
    status: 200,
    body: { ok: true, versandOk, hinweis: `Der Termin von ${name} ist abgesagt. ${satz}` },
  };
}

/** Ein Ergebnis in den Kundenverlauf — dieselbe Ablage wie oben, WIRFT NIE. */
async function verlaufSchreiben(
  ref: string | null | undefined, agent: { id: number; name: string },
  beginn: Date | string | null, text: string,
): Promise<void> {
  if (!ref) return;
  const wann = beginn ? ` (${berlinDatumText(beginn as any)}, ${berlinUhrzeit(beginn as any)} Uhr)` : "";
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
    VALUES (${ref}, ${agent.id}, ${agent.name}, 'result', ${`${text.trim()}${wann}`.slice(0, 4000)}, NOW())
  `.catch(() => {});
}

router.post("/agent/onboarding/termine/:id/nicht-erschienen", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await nichtErschienenMelden({
      terminId: Number(req.params.id),
      agent: { id: req.agent!.id, name: req.agent!.name },
      grund: req.body?.grund,
      notiz: req.body?.notiz,
    });
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[ONBOARDING] nicht-erschienen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE WARTENDEN — bezahlt, kein Startgespräch (22.08.2026, E-022 / K10)
//
// `wartendeZaehlen` rechnete „wartend" und „ohne Termin" seit Tagen aus; die
// Seite warf beide Zahlen weg. Und ein Onboarder konnte einen wartenden
// Kunden ohne Termin nicht einmal SEHEN — die Einladung brauchte eine
// personId aus einem bestehenden Termin. 213 Menschen lagen damit außerhalb
// der Reichweite genau der Abteilung, die sie erreichen soll.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/onboarding/wartende", requireAgent, nurOnboarding, nurMitZusage, async (_req: AgentRequest, res: Response) => {
  try {
    // E-045: VORHER sahen hier alle (Onboarding-Pool) die komplette Warteliste.
    // NACHHER: Onboarding/Leitung weiter alles; ein Bonitätsmanager nur die
    // Wartenden aus dem EIGENEN Bestand (assigned_agent_id = ich).
    const alle = await siehtAlleWartenden(_req.agent!.id);
    const zeilen = (await sqlPool`
      SELECT p.id AS person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, p.primary_email) AS name,
             COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.primary_phone, p.primary_email, p.startgespraech_mail_am, p.startgespraech_spaeter_am,
             (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
                AND a.payment_status = 'paid' AND a.onboarding_stufe = 'wartet_auf_onboarding'
                ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC LIMIT 1) AS ref,
             (SELECT SPLIT_PART(a.pack_name, E'\\n', 1) FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                AND a.payment_status = 'paid' AND a.onboarding_stufe = 'wartet_auf_onboarding'
                ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC LIMIT 1) AS paket,
             (SELECT MIN(a.paid_at) FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                AND a.payment_status = 'paid' AND a.onboarding_stufe = 'wartet_auf_onboarding') AS bezahlt_am,
             (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.quelle = 'onboarding_call'
                AND t.status = 'gebucht' AND t.abgesagt_am IS NULL ORDER BY t.beginn LIMIT 1) AS termin_am,
             (SELECT COUNT(*)::int FROM fiaon_termine t WHERE t.person_id = p.id AND t.quelle = 'onboarding_call'
                AND t.status = 'verpasst') AS verpasst
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
        AND (${alle} OR p.assigned_agent_id = ${_req.agent!.id})
        AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND a.archived_at IS NULL AND a.payment_status = 'paid' AND a.onboarding_stufe = 'wartet_auf_onboarding')
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
      ORDER BY termin_am NULLS FIRST, bezahlt_am ASC NULLS LAST
      LIMIT 300
    `) as any[];
    const jetzt = Date.now();
    res.json({
      ok: true,
      wartende: zeilen.map((z) => ({
        personId: Number(z.person_id), name: z.name, vorname: z.vorname, telefon: z.primary_phone, email: z.primary_email,
        ref: z.ref, paket: z.paket, bezahltAm: z.bezahlt_am ?? null,
        tage: z.bezahlt_am ? Math.floor((jetzt - new Date(z.bezahlt_am).getTime()) / 86_400_000) : null,
        terminAm: z.termin_am ?? null, eingeladenAm: z.startgespraech_mail_am ?? null,
        spaeterAm: z.startgespraech_spaeter_am ?? null, verpasst: Number(z.verpasst || 0),
      })),
      ohneTermin: zeilen.filter((z) => !z.termin_am).length,
      mitTermin: zeilen.filter((z) => !!z.termin_am).length,
    });
  } catch (err) {
    console.error("[ONBOARDING] wartende:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/onboarding/wartende/:id/einladung — Einladung an einen Wartenden.
 * Anders als `/person/:id/einladung` braucht das keinen bestehenden Termin —
 * nur: bezahlt, wartet, noch kein geführtes Gespräch. Schreibend genau diese
 * eine Sache, sonst nichts.
 */
router.post("/agent/onboarding/wartende/:id/einladung", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    // E-045: Ein Bonitätsmanager lädt nur EIGENE Kunden ein (Onboarding/Leitung: alle).
    if (!(await siehtAlleWartenden(req.agent!.id))) {
      const [meiner] = (await sqlPool`
        SELECT 1 AS ok FROM fiaon_persons
        WHERE id = ${id} AND assigned_agent_id = ${req.agent!.id} AND merged_into_person_id IS NULL
      `) as any[];
      if (!meiner) return res.status(404).json({ ok: false, error: "Dieser Kunde gehört nicht zu deinem Bestand." });
    }
    const [p] = (await sqlPool`
      SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS email,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p
      WHERE p.id = ${id} AND p.merged_into_person_id IS NULL
        AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND a.payment_status = 'paid' AND a.onboarding_stufe = 'wartet_auf_onboarding')
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Dieser Kunde wartet nicht (mehr) auf ein Startgespräch." });
    if (!p.email) return res.status(409).json({ ok: false, error: "Keine E-Mail-Adresse — bitte anrufen und den Terminlink durchgeben." });

    const { versandErlaubt } = await import("../lib/fiaon-versand");
    const pruefung = await versandErlaubt(id, "onboarding_einladung");
    if (!pruefung.erlaubt) return res.status(409).json({ ok: false, error: pruefung.grund });

    const erg = await versendenUndProtokollieren(
      "onboarding_einladung",
      // ── HERKUNFT STATT FOLGENLOSER QUELLE (24.08.2026) ──────────────────
      // VORHER „onboarding_call" — eine QUELLE, die `terminLink` verworfen hat.
      // NACHHER der WEG; er landet als `fiaon_termine.herkunft` am Termin.
      { email: String(p.email), vorname: p.vorname || null, termin_link: terminLink(id, "onboarding_einladung") },
      {
        personId: id, verlaufRef: p.ref || null,
        verlaufText: `Einladung zum Startgespräch versandt von ${req.agent!.name} (aus der Liste der Wartenden).`,
        ausgeloestVon: req.agent!.name, ausgeloestAgentId: req.agent!.id,
      },
    );
    if (erg.status === "versandt") {
      await sqlPool`UPDATE fiaon_persons SET startgespraech_mail_am = NOW(), updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    }
    res.json({ ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      terminLink: terminLink(id, "onboarding_einladung") });
  } catch (err) {
    console.error("[ONBOARDING] wartende/einladung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/onboarding/person/:id/einladung — Terminlink erneut schicken. */
router.post("/agent/onboarding/person/:id/einladung", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    // E-045: Ein Bonitätsmanager lädt nur EIGENE Kunden ein (Onboarding/Leitung: alle).
    if (!(await siehtAlleWartenden(req.agent!.id))) {
      const [meiner] = (await sqlPool`
        SELECT 1 AS ok FROM fiaon_persons
        WHERE id = ${id} AND assigned_agent_id = ${req.agent!.id} AND merged_into_person_id IS NULL
      `) as any[];
      if (!meiner) return res.status(404).json({ ok: false, error: "Dieser Kunde gehört nicht zu deinem Bestand." });
    }
    const [p] = (await sqlPool`
      SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS email,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p WHERE p.id = ${id} AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const { versandErlaubt } = await import("../lib/fiaon-versand");
    const pruefung = await versandErlaubt(id, "onboarding_einladung");
    if (!pruefung.erlaubt) return res.status(409).json({ ok: false, error: pruefung.grund });

    const erg = await versendenUndProtokollieren(
      "onboarding_einladung",
      // Herkunft statt folgenloser Quelle (24.08.2026) — wie oben.
      { email: String(p.email || ""), vorname: p.vorname || null, termin_link: terminLink(id, "onboarding_einladung") },
      {
        personId: id, verlaufRef: p.ref || null,
        verlaufText: `Einladung zum Startgespräch erneut versandt von ${req.agent!.name}.`,
        ausgeloestVon: req.agent!.name, ausgeloestAgentId: req.agent!.id,
      },
    );
    res.json({ ok: erg.status === "versandt", status: erg.status, grund: erg.grund });
  } catch (err) {
    console.error("[ONBOARDING] einladung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/onboarding/kennzahlen — Woche, Erledigungsquote, No-Show-Quote. */
router.get("/agent/onboarding/kennzahlen", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    // ── DER KENNZAHLEN-KOPF DES BEREICHS (Teil 2.4) ──────────────────────
    // Sechs Zahlen, mit denen ein Onboarding-Mensch seinen Tag anfängt und
    // beendet. „Heute" ist die Berliner Tagesgrenze, nicht UTC — sonst zählt
    // ein Gespräch um 01:30 zum Vortag.
    const [z] = (await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE beginn >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Berlin'))::int AS diese_woche,
        COUNT(*) FILTER (WHERE status = 'gebucht' AND beginn > NOW())::int AS offen,
        COUNT(*) FILTER (WHERE status = 'erledigt')::int AS erledigt,
        COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst,
        -- Heute
        COUNT(*) FILTER (WHERE (beginn AT TIME ZONE 'Europe/Berlin')::date
                             = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute_geplant,
        COUNT(*) FILTER (WHERE status = 'erledigt'
                           AND (erledigt_am AT TIME ZONE 'Europe/Berlin')::date
                             = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute_erledigt,
        COUNT(*) FILTER (WHERE status = 'verpasst'
                           AND (erledigt_am AT TIME ZONE 'Europe/Berlin')::date
                             = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute_noshow,
        -- Die Ø-Dauer nur über Gespräche, bei denen sie GEMESSEN wurde (Cockpit).
        -- Ein Mittelwert über Nullen wäre keine Auskunft, sondern eine Zahl.
        AVG(dauer_sek) FILTER (WHERE status = 'erledigt' AND dauer_sek > 0) AS dauer_schnitt
      FROM fiaon_termine
      WHERE agent_id = ${req.agent!.id} AND quelle = 'onboarding_call'
    `) as any[];
    const erledigt = Number(z?.erledigt || 0);
    const verpasst = Number(z?.verpasst || 0);
    const gefuehrt = erledigt + verpasst;
    // Wie viele Konten wurden diese Woche freigeschaltet? Das ist die Zahl, die
    // den Zweck des Bereichs misst — nicht die Zahl der Gespräche.
    //
    // ── E-051 (Justin 24.08., Plan §20): DIE WARTENDEN-ZAHL WAR GLOBAL ─────
    // VORHER: `wartendeZaehlen()` zählte hausweit — ein Bonitätsmanager sah
    // „Wartet auf Gespräch 374", obwohl seine Wartenden-LISTE (Route oben,
    // E-045) längst auf den eigenen Bestand gefiltert war. Kachel und Liste
    // widersprachen sich.
    // NACHHER: Onboarding-Pool/Leitung (siehtAlleWartenden) bekommen weiter
    // die Hauszahl; Rolle „agent" bekommt wartend/ohneTermin/freigeschaltet
    // über die EIGENEN Kunden (assigned_agent_id = ich) — dieselbe Zählweise
    // wie in `wartendeZaehlen`, nur mit der Bestandsgrenze.
    const alle = await siehtAlleWartenden(req.agent!.id);
    let stufen: { wartend: number; mitTermin: number; ohneTermin: number; freigeschaltetWoche: number };
    if (alle) {
      const { wartendeZaehlen } = await import("../lib/fiaon-kontostufe");
      stufen = await wartendeZaehlen();
    } else {
      const [w] = (await sqlPool`
        SELECT
          COUNT(DISTINCT a.person_id) FILTER (WHERE a.onboarding_stufe = 'wartet_auf_onboarding')::int AS wartend,
          COUNT(DISTINCT a.person_id) FILTER (WHERE a.onboarding_stufe = 'wartet_auf_onboarding'
            AND EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id
                          AND t.quelle = 'onboarding_call' AND t.status = 'gebucht'))::int AS mit_termin,
          COUNT(DISTINCT a.person_id) FILTER (WHERE a.freigeschaltet_am IS NOT NULL
            AND a.freigeschaltet_am >= ((NOW() AT TIME ZONE 'Europe/Berlin')::date - 7))::int AS frei_woche
        FROM fiaon_applications a
        JOIN fiaon_persons p ON p.id = a.person_id
        WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
          AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
          AND p.assigned_agent_id = ${req.agent!.id}
      `) as any[];
      const wartend = Number(w?.wartend || 0);
      const mitTermin = Number(w?.mit_termin || 0);
      stufen = { wartend, mitTermin, ohneTermin: Math.max(0, wartend - mitTermin), freigeschaltetWoche: Number(w?.frei_woche || 0) };
    }
    res.json({
      ok: true,
      dieseWoche: Number(z?.diese_woche || 0),
      offen: Number(z?.offen || 0),
      erledigt,
      verpasst,
      heuteGeplant: Number(z?.heute_geplant || 0),
      heuteErledigt: Number(z?.heute_erledigt || 0),
      heuteNoShow: Number(z?.heute_noshow || 0),
      dauerSchnittMin: z?.dauer_schnitt != null
        ? Math.round(Number(z.dauer_schnitt) / 60) : null,
      freigeschaltetWoche: stufen.freigeschaltetWoche,
      // Wer wartet noch auf sein Gespräch? Für Onboarding/Leitung hausweit,
      // für einen Bonitätsmanager nur der eigene Bestand (E-051, siehe oben).
      wartend: stufen.wartend,
      wartendOhneTermin: stufen.ohneTermin,
      nurEigene: !alle,
      // Ohne ein einziges abgeschlossenes Gespräch gibt es keine Quote. Eine
      // „0 %" wäre an dieser Stelle eine Behauptung über nichts.
      erledigungsquote: gefuehrt > 0 ? Math.round((erledigt / gefuehrt) * 1000) / 10 : null,
      noShowQuote: gefuehrt > 0 ? Math.round((verpasst / gefuehrt) * 1000) / 10 : null,
    });
  } catch (err) {
    console.error("[ONBOARDING] kennzahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;

// ═══════════════════════════════════════════════════════════════════════════
// „ICH HABE DAS GESPRAECH GERADE GEFUEHRT" — OHNE GEBUCHTEN TERMIN
// (27.08.2026, Team-Punkte 8 und 17: der Endlos-Kreislauf)
//
// GEMESSEN: 373 bezahlte Kunden stehen auf „wartet_auf_onboarding", und KEIN
// EINZIGER hat einen erledigten Onboarding-Termin. Die Gespraeche finden
// statt — am Telefon, aus der Pipeline heraus, ohne gebuchten Slot. Das
// System erfaehrt es nie: Die Stufe leitet sich aus dem ERLEDIGTEN TERMIN ab,
// und den gibt es nicht. Der Kunde landet nach dem Gespraech wieder vor
// derselben Tafel „Bitte Startgespraech buchen" — der gemeldete Kreislauf.
//
// Dieser Weg schliesst die Luecke: Der Mitarbeiter, der das Gespraech
// gefuehrt hat, haelt das mit EINEM Klick fest. Was dann passiert:
//   1. Ein gebuchter Termin des Kunden wird erledigt — oder, wenn es nie
//      einen gab, ein erledigter Termin nachgetragen (der Beweis, aus dem
//      die Stufen-Ableitung ueberall ihre Wahrheit zieht).
//   2. `vollFreischalten` oeffnet das Konto (die EINE Funktion, mit Name und
//      Grund im Protokoll).
//   3. Ein Verlaufseintrag vom Typ `startgespraech` — damit auch der
//      Kundenbereich das Gespraech kennt.
// Danach sieht der Kunde beim naechsten Login keine Tafel mehr, und
// Mitarbeiter- wie Kundenansicht sagen dasselbe.
//
// BEWUSST requireAgent + darfAnKunde statt nurOnboarding: Das Gespraech
// fuehrt, wer den Kunden gerade am Ohr hat — auch Vertrieb und Leitung.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/onboarding/person/:id/gefuehrt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.id);
    if (!Number.isFinite(personId) || personId <= 0) {
      return res.status(400).json({ ok: false, error: "Kunden-Kennung fehlt." });
    }
    const { darfAnKunde, rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von einem Kollegen betreut." });
    }

    // 1) Termin erledigen — oder den Beweis nachtragen.
    const [gebucht] = (await sqlPool`
      SELECT id FROM fiaon_termine
      WHERE person_id = ${personId} AND quelle = 'onboarding_call'
        AND status IN ('gebucht', 'verpasst')
      ORDER BY beginn DESC LIMIT 1
    `) as any[];
    if (gebucht) {
      await sqlPool`
        UPDATE fiaon_termine SET status = 'erledigt', erledigt_am = NOW(),
               notiz = CONCAT_WS(chr(10), NULLIF(notiz, ''),
                 ${`Als geführt festgehalten von ${req.agent!.name} (ohne Cockpit-Abschluss).`}),
               updated_at = NOW()
        WHERE id = ${gebucht.id}
      `;
    } else {
      // Nachtrag: 20 Minuten in der Vergangenheit, damit er mit keinem echten
      // Slot kollidiert (die Datenbank verbietet Ueberschneidungen je Agent).
      const beginn = new Date(Date.now() - 20 * 60 * 1000);
      await sqlPool`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, erledigt_am, notiz)
        VALUES (${personId}, ${req.agent!.id}, ${beginn}, 15, 'erledigt', 'onboarding_call', NOW(),
                ${`Telefonisch geführt, ohne gebuchten Slot — nachgetragen von ${req.agent!.name}.`})
      `;
    }

    // 2) Freischalten — die eine Funktion, mit Protokoll.
    const { vollFreischalten } = await import("../lib/fiaon-kontostufe");
    const frei = await vollFreischalten(personId, {
      name: req.agent!.name,
      grund: gebucht
        ? "Startgespräch geführt — vom Mitarbeiter festgehalten"
        : "Startgespräch telefonisch geführt, ohne gebuchten Slot",
    });

    // 3) Der Verlaufseintrag, den auch der Kundenbereich liest.
    const schreibRef = await sorgeFuerAkte(personId, req.agent!.id).catch(() => null);
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${schreibRef}, ${personId}, ${req.agent!.id}, ${req.agent!.name}, 'startgespraech',
              'Startgespräch geführt und festgehalten. Das Konto ist voll freigeschaltet; die Tafel im Portal erscheint nicht mehr.')
    `.catch(() => {});

    res.json({
      ok: true,
      freigeschaltet: frei.freigeschaltet,
      hinweis: (frei.freigeschaltet > 0
        ? "Festgehalten — das Konto ist jetzt voll freigeschaltet."
        : "Festgehalten — das Konto war bereits freigeschaltet.")
        // P10: Auch dieser Weg endet im Zwischenzustand „Zu dokumentieren" —
        // die 15 € kommen erst mit dem dokumentierten Abschluss im Cockpit.
        + " Das Onboarding steht jetzt unter „Zu dokumentieren“ — mit dem Cockpit-Abschluss kommt die Vergütung.",
    });
  } catch (err) {
    console.error("[ONBOARDING] gefuehrt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

