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

/** 404 statt 403 — die Rolle liest bei JEDEM Aufruf aus der Datenbank. */
async function nurOnboarding(req: AgentRequest, res: Response, next: any) {
  if (!(await istOnboarding(req.agent!.id))) {
    return res.status(404).json({ ok: false, error: "Nicht gefunden" });
  }
  return next();
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
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.primary_phone, p.primary_email
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.agent_id = ${req.agent!.id} AND t.quelle = 'onboarding_call'
        AND p.merged_into_person_id IS NULL
        AND t.beginn > NOW() - INTERVAL '30 days'
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
    const [zahlung, dokumente, zugang] = await Promise.all([
      zahlungsLage(id),
      dokumentLage(id),
      zugangsLage(p.primary_email || p.app_email || ""),
    ]);
    res.json({ ok: true, zahlung, dokumente, zugang });
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
router.post("/agent/onboarding/termine/:id/ergebnis", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ergebnis, notiz } = req.body || {};
    if (!["erledigt", "verpasst"].includes(String(ergebnis))) {
      return res.status(400).json({ ok: false, error: "Ergebnis muss 'erledigt' oder 'verpasst' sein." });
    }
    // Der Stand der Agenda und die Gesprächsdauer kommen aus dem Cockpit.
    // Beides ist freiwillig: Ein Gespräch, das ohne das Cockpit geführt wurde
    // (Telefon klingelte einfach), muss trotzdem abschließbar sein.
    const agendaStand = req.body?.agenda && typeof req.body.agenda === "object"
      ? req.body.agenda : null;
    const dauerSek = Number.isFinite(Number(req.body?.dauerSek))
      ? Math.max(0, Math.min(4 * 3600, Number(req.body.dauerSek))) : null;

    // ── AUCH EIN VERPASSTER TERMIN LÄSST SICH NACHTRAGEN ─────────────────
    // Hier stand `status = 'gebucht'`. Ein Tageslauf setzt Termine nach zwölf
    // Stunden auf „verpasst" — danach war der Termin nicht mehr abschließbar,
    // auch wenn der Kunde sich abends doch gemeldet hatte.
    const [termin] = (await sqlPool`
      SELECT id, person_id, beginn FROM fiaon_termine
      WHERE id = ${id} AND agent_id = ${req.agent!.id} AND quelle = 'onboarding_call'
        AND status IN ('gebucht', 'verpasst')
    `) as any[];
    if (!termin) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });

    await sqlPool`
      UPDATE fiaon_termine SET status = ${String(ergebnis)}, erledigt_am = NOW(),
             notiz = ${notiz ? String(notiz).slice(0, 4000) : null},
             agenda_stand = ${agendaStand ? JSON.stringify(agendaStand) : null}::jsonb,
             dauer_sek = ${dauerSek},
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
    res.json({ ok: true, hinweis });
  } catch (err) {
    console.error("[ONBOARDING] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/onboarding/person/:id/einladung — Terminlink erneut schicken. */
router.post("/agent/onboarding/person/:id/einladung", requireAgent, nurOnboarding, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
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
    const { wartendeZaehlen } = await import("../lib/fiaon-kontostufe");
    const stufen = await wartendeZaehlen();
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
      // Wer wartet insgesamt noch auf sein Gespräch? Das ist die Arbeit, die
      // vor dem Bereich liegt.
      wartend: stufen.wartend,
      wartendOhneTermin: stufen.ohneTermin,
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
