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

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import { ONBOARDING_ZUSAGE_TEXT, ONBOARDING_ZUSAGE_VERSION } from "../lib/fiaon-onboarding-zusage";
import { berlinDatumText, berlinUhrzeit, berlinDatum, terminLink } from "../lib/fiaon-termine";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { absoluteUrl } from "../fiaon-base-url";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";

const router = Router();

/** Führt dieser Mitarbeiter Startgespräche? */
export async function istOnboarding(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active`;
  return String(a?.rolle || "agent") === "onboarding";
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
    if (!ref?.ref) {
      return res.status(409).json({
        ok: false,
        error: "Zu diesem Kunden gibt es keine Bestellung — ohne sie hat die Notiz keine Akte.",
      });
    }
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref.ref}, ${id}, ${req.agent!.id}, ${req.agent!.name}, 'note', ${text.slice(0, 4000)}, NOW())
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
    res.json({
      ok: true, zahlung, dokumente, zugang, karte,
      paket: paketZeile?.paket ?? null,
      zahlungsstand: paketZeile ? zahlungsstatusText(paketZeile.status) : null,
      bonitaet,
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
    const [termin] = (await sqlPool`
      SELECT id, person_id, beginn FROM fiaon_termine
      WHERE id = ${id} AND quelle = 'onboarding_call'
        AND (${opts.jederZustaendige === true} OR agent_id = ${req.agent!.id})
        AND status IN ('gebucht', 'verpasst')
    `) as any[];
    if (!termin) return { status: 404, body: { ok: false, error: "Termin nicht gefunden." } };

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
      UPDATE fiaon_termine SET status = ${String(ergebnis)}, erledigt_am = NOW(),
             notiz = COALESCE(${notiz ? String(notiz).slice(0, 4000) : null}, notiz),
             agenda_stand = COALESCE(
               ${agendaStand ? JSON.stringify(agendaStand) : null}::jsonb, agenda_stand),
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
      hinweis = `Nicht erschienen — zählt als erfolgloser Versuch, und der Kunde wird erneut eingeladen.${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`;
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
    }

    if (ref) {
      const text = ergebnis === "erledigt"
        ? `Startgespräch geführt (${berlinDatumText(termin.beginn)}, ${berlinUhrzeit(termin.beginn)} Uhr).${notiz ? ` ${String(notiz).slice(0, 2000)}` : ""}`
        : `Startgespräch verpasst — Kunde nicht erschienen (${berlinDatumText(termin.beginn)}, ${berlinUhrzeit(termin.beginn)} Uhr).${notiz ? ` ${String(notiz).slice(0, 2000)}` : ""}`;
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, ${req.agent!.id}, ${req.agent!.name}, 'result', ${text}, NOW())
      `.catch(() => {});
    }
    return { status: 200, body: { ok: true, hinweis } };
}

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
      { email: String(p.email), vorname: p.vorname || null, termin_link: terminLink(id, "onboarding_call") },
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
      terminLink: terminLink(id, "onboarding_call") });
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
      { email: String(p.email || ""), vorname: p.vorname || null, termin_link: terminLink(id, "onboarding_call") },
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
