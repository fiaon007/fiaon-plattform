// ═══════════════════════════════════════════════════════════════════════════
// INKASSO-BEREICH — Routen
//
// Muster wie beim Vertriebs- und Onboarding-Bereich:
//   Falsche Rolle  → 404. Nicht 403: Wer nicht dazugehört, soll nicht einmal
//                    erfahren, DASS es diesen Bereich gibt.
//   Ohne Zusage    → 403 mit dem Text der Erklärung.
//
// Die Sichtfeld-Grenze steht in fiaon-inkasso.ts als WHERE-Bedingung und wird
// hier nicht wiederholt — eine Grenze, die an zwei Stellen steht, steht bald
// an einer Stelle anders.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import { zusageHash, zusageSpeichern, zusageStand } from "../lib/fiaon-vertrieb-zusage";
import { INKASSO_ZUSAGE_TEXT, INKASSO_ZUSAGE_VERSION } from "../lib/fiaon-inkasso-zusage";
import {
  arbeitsliste, istRatenErgebnis, kennzahlen, RATEN_ERGEBNISSE,
  ratenErgebnisAnwenden, verdienst,
} from "../lib/fiaon-inkasso";
import { berlinToday } from "../lib/fiaon-time";

const router = Router();

/**
 * Traegt dieser Mensch die Rolle Inkasso?
 *
 * Exportiert, damit die Vertriebsrouten ihn aussperren koennen: Ein
 * Inkasso-Konto darf die Kundenliste des Vertriebs nicht sehen — dort stehen
 * Ablehnungen und Leads, und mit denen hat das Forderungsmanagement nichts zu
 * tun.
 */
export async function istInkasso(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = (await sqlPool`
    SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active
  `) as any[];
  return String(a?.rolle || "agent") === "inkasso";
}

/**
 * Die Wand. Jede Route dieses Bereichs geht hier durch.
 *
 * Reihenfolge ist Absicht: erst Rolle (404), dann Zusage (403). Umgekehrt
 * verriete die Zusage-Abfrage einem Fremden, dass es den Bereich gibt.
 */
async function wand(req: AgentRequest, res: Response): Promise<boolean> {
  if (!(await istInkasso(req.agent!.id))) {
    res.status(404).json({ ok: false, error: "Nicht gefunden." });
    return false;
  }
  const stand = await zusageStand(req.agent!.id, "inkasso", INKASSO_ZUSAGE_VERSION);
  if (stand.offen) {
    res.status(403).json({ ok: false, error: "Zusage offen", zusageOffen: true });
    return false;
  }
  return true;
}

// ── Zugang ─────────────────────────────────────────────────────────────────

/**
 * Ein Pfad für GET und POST.
 *
 * Die wiederverwendete `ZusageTafel` im Client (agent/vertrieb-zusage.tsx)
 * fragt denselben Pfad ab, den sie danach beschreibt. Zwei Pfade hätten
 * bedeutet, die Tafel für diesen einen Bereich zu kopieren — und damit zwei
 * Fassungen einer Rechtsstrecke zu pflegen.
 */
router.get("/inkasso/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await istInkasso(req.agent!.id))) {
      return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    }
    const stand = await zusageStand(req.agent!.id, "inkasso", INKASSO_ZUSAGE_VERSION);
    res.json({
      ok: true, ...stand,
      text: stand.offen ? INKASSO_ZUSAGE_TEXT : null,
      pruefwert: zusageHash(INKASSO_ZUSAGE_TEXT).slice(0, 16),
      name: req.agent!.name,
    });
  } catch (err) {
    console.error("[INKASSO] zugang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/zusage — annehmen. */
router.post("/inkasso/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await istInkasso(req.agent!.id))) {
      return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    }
    const erg = await zusageSpeichern({
      agentId: req.agent!.id,
      agentName: req.agent!.name,
      // ══════════════════════════════════════════════════════════════════
      // ZWEI NAMEN FÜR DASSELBE FELD
      //
      // ── DER BEFUND (11.08.2026) ───────────────────────────────────────
      // Der Vorgesetzte: „Auch wenn ich den Namen richtig eintrage, akzeptiert
      // er es nicht und meldet es als Fehler."
      //
      // Er hatte recht — und die Meldung log nicht, sie war nur blind: Diese
      // Route las `req.body.nameGetippt`, der Client schickte `name`. Das Feld
      // kam NIE an, der Vergleich lief also immer gegen einen leeren String,
      // und die Antwort lautete „Bitte den vollständigen Namen genau so
      // eingeben, wie er im Konto steht" — mit genau dem Namen, den er gerade
      // eingegeben hatte.
      //
      // Die Namen in der Datenbank und im Feld waren zeichengleich; gemessen
      // bis auf die Codepoints (0048 0061 006e 0073 002d 004a 00fc …).
      //
      // Die Vertriebs- und Onboarding-Routen lesen `name` — nur diese eine
      // wich ab. Sie nimmt jetzt BEIDE: Ein Feldname, den man umbenennt,
      // während irgendwo noch der alte gesendet wird, ist genau diese Falle.
      // ══════════════════════════════════════════════════════════════════
      nameGetippt: String(req.body?.name ?? req.body?.nameGetippt ?? ""),
      version: String(req.body?.version || ""),
      // Das Häkchen „gelesen" gehört zur Erklärung, nicht zur Rolle.
      gelesen: req.body?.gelesen === true,
      sollVersion: INKASSO_ZUSAGE_VERSION,
      bereich: "inkasso",
      text: INKASSO_ZUSAGE_TEXT,
      ip: String(req.ip || ""),
      userAgent: String(req.headers["user-agent"] || ""),
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json(erg);
  } catch (err) {
    console.error("[INKASSO] zusage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Arbeit ─────────────────────────────────────────────────────────────────

/** GET /inkasso/liste — Kennzahlen und die eine Reihenfolge. */
router.get("/inkasso/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    // ── NUR DIE EIGENEN, WENN ZUGETEILT ─────────────────────────────────
    // Ein Mitarbeiter mit zugeteilten Raten sieht seine. Wer noch keine hat,
    // sieht alle unzugeteilten — sonst stünde er vor einer leeren Liste und
    // könnte nicht arbeiten, obwohl Arbeit da ist.
    const { fristZaehler } = await import("../lib/fiaon-inkasso");
    const meine = await fristZaehler({ nurMeine: req.agent!.id });
    const nurMeine = meine.alle > 0 ? req.agent!.id : null;
    const frist = String(req.query.frist || "") || null;

    const [liste, zahlen, geld, fenster] = await Promise.all([
      arbeitsliste({ limit: Number(req.query.limit) || 60, nurMeine, frist }),
      kennzahlen(),
      verdienst(req.agent!.id),
      fristZaehler({ nurMeine }),
    ]);
    res.json({
      ok: true, liste, zahlen, verdienst: geld, ergebnisse: RATEN_ERGEBNISSE,
      heute: berlinToday(), fenster, frist,
      nurMeine: nurMeine !== null,
    });
  } catch (err) {
    console.error("[INKASSO] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /inkasso/rate/:id — Mahnhistorie und Kontakte einer Rate. */
router.get("/inkasso/rate/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const id = Number(req.params.id);
    // Über das SICHTFELD geprüft, nicht über die Kennung: Wer eine fremde
    // Ratennummer errät, bekommt trotzdem nichts.
    const [rate] = (await sqlPool`
      SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz, r.faellig_am,
             r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at, r.letzter_fehler,
             r.inkasso_wiedervorlage, r.inkasso_zusage_am, a.person_id
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.id = ${id} AND r.status = 'offen'
        AND a.payment_status = 'paid' AND a.merged_into IS NULL
        AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    `) as any[];
    if (!rate) return res.status(404).json({ ok: false, error: "Nicht gefunden." });

    // ══════════════════════════════════════════════════════════════════════
    // ALLE ABFRAGEN GLEICHZEITIG
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Der erste Entwurf schrieb die Abfragen als `await` INNERHALB des
    // Antwort-Objekts:
    //
    //     res.json({ mahnungen: await sqlPool`…`, kontakte: await sqlPool`…` })
    //
    // Das sieht kompakt aus und ist eine Falle: JavaScript wertet die Felder
    // der Reihe nach aus. Zehn Abfragen liefen nacheinander, jede mit ihrer
    // eigenen Runde nach Oregon — gemessen: 5.434 ms.
    //
    // Die Akte blieb deshalb bei „Wird geladen …" stehen, und ich habe eine
    // Stunde nach einem Fehler gesucht, der keiner war: Sie lud, nur zu
    // langsam für jeden, der zusieht.
    //
    // Ein Mensch, der zwanzig Akten am Tag öffnet, wartet so fast zwei
    // Minuten am Tag auf nichts.
    // ══════════════════════════════════════════════════════════════════════
    const [
      mahnungen, kontakte, arbeit, raten, kunde, gespraeche, mails, bank,
    ] = await Promise.all([
      // Nur MAHNUNGEN, nicht der ganze Mailverkehr.
      sqlPool`
        SELECT gesendet_am, event, ok, grund FROM fiaon_mail_log
        WHERE person_id = ${rate.person_id} AND event LIKE 'abo_payment%'
        ORDER BY gesendet_am DESC LIMIT 20
      `.catch(() => [] as any[]),

      sqlPool`
        SELECT created_at, type, outcome, note, agent_name FROM fiaon_contact_log
        WHERE ref = ${rate.ref} AND type <> 'system'
        ORDER BY created_at DESC LIMIT 15
      `.catch(() => [] as any[]),

      sqlPool`
        SELECT created_at, ergebnis, zusage_am, wiedervorlage, notiz, agent_name
        FROM fiaon_raten_arbeit WHERE rate_id = ${id} ORDER BY created_at DESC LIMIT 20
      `.catch(() => [] as any[]),

      sqlPool`
        SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am, mahnstufe
        FROM fiaon_abo_raten WHERE ref = ${rate.ref} ORDER BY rate_nr
      `.catch(() => [] as any[]),

      // ── ALLES, WAS AM TELEFON GEBRAUCHT WIRD ────────────────────────────
      // Der Vorgesetzte: „Sie öffnet die Akte, sieht alle Daten vom Kunden,
      // seit wann die Rate offen ist, und ruft an."
      //
      // Der Satz, den dieser Mensch sagt, lautet: „Ich rufe an, weil Ihre
      // Zahlung seit X Tagen fällig ist." Dafür braucht er X — und Name,
      // Paket, Betrag, Bankdaten, Verwendungszweck. In einem Blick.
      sqlPool`
        SELECT p.id AS person_id,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, 'Ohne Namen') AS name,
               p.primary_email, p.primary_phone,
               -- Die Spalten heißen street/zip/city. Die Route brach erst mit
               -- „column p.strasse does not exist" ab; deutsche Bezeichner
               -- gelten für NEUEN Code (AGENTS.md), diese Tabelle ist älter.
               COALESCE(NULLIF(p.street, ''), a.street) AS strasse,
               COALESCE(NULLIF(p.zip, ''), a.zip) AS plz,
               COALESCE(NULLIF(p.city, ''), a.city) AS ort,
               a.pack_name, a.pack_key, a.amount_due, a.payment_reference,
               a.created_at::date AS kunde_seit,
               a.account_status, a.schufa_status,
               COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                        NULLIF(a.billing_email, '')) AS bestell_email,
               COALESCE(NULLIF(a.phone, ''), NULLIF(a.contact_phone, '')) AS bestell_telefon,
               a.phone_country_code AS vorwahl,
               -- Seit wann offen? Der erste Satz am Telefon.
               (CURRENT_DATE - ${rate.faellig_am}::date) AS tage_offen,
               -- Wer elf von zwölf Raten gezahlt hat, wird anders angesprochen
               -- als jemand, der noch keine gezahlt hat.
               (SELECT COUNT(*)::int FROM fiaon_abo_raten x
                 WHERE x.ref = a.ref AND x.status = 'bezahlt') AS raten_bezahlt,
               (SELECT COUNT(*)::int FROM fiaon_abo_raten x WHERE x.ref = a.ref) AS raten_gesamt,
               (SELECT COALESCE(SUM(x.betrag_cents), 0)::bigint FROM fiaon_abo_raten x
                 WHERE x.ref = a.ref AND x.status <> 'bezahlt'
                   AND x.faellig_am < CURRENT_DATE) AS offen_gesamt_cents
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
        WHERE a.ref = ${rate.ref}
      `.then((r: any[]) => r[0] ?? null).catch(() => null),

      // ── JEDES GESPRÄCH IN DER AKTE ──────────────────────────────────────
      // „JEDES Gespräch, was auf der Plattform geführt wird, muss
      // protokolliert werden in der Akte!" — Sie werden es: `fiaon_calls` hält
      // Beginn, Dauer, Ergebnis, Aufnahme und Transkript. Sie waren nur hier
      // nicht sichtbar.
      //
      // Die Twilio-URL geht NICHT mit: Sie ist unbefristet gültig. Nach außen
      // nur, OB es eine Aufnahme gibt.
      rate.person_id ? sqlPool`
        SELECT k.id, k.beginn, k.dauer_sek, k.richtung, k.ergebnis, k.status,
               k.zusammenfassung, k.transkript_status, k.transkript_grund,
               (k.transkript IS NOT NULL) AS hat_transkript,
               (k.recording_url IS NOT NULL AND k.aufnahme_geloescht_am IS NULL) AS hat_aufnahme,
               k.aufnahme_geloescht_am, k.ohne_aufzeichnung_am,
               COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent
        FROM fiaon_calls k
        LEFT JOIN fiaon_agents ag ON ag.id = k.agent_id
        WHERE k.person_id = ${rate.person_id}
        ORDER BY k.beginn DESC LIMIT 40
      `.catch(() => [] as any[]) : Promise.resolve([] as any[]),

      // ── DER GANZE MAILVERKEHR, NICHT NUR MAHNUNGEN ──────────────────────
      // Wer anruft, muss wissen, was der Kunde schon bekommen hat. Eine
      // Zahlungserinnerung von gestern ändert den ersten Satz.
      rate.person_id ? sqlPool`
        SELECT gesendet_am, event, ok, grund, empfaenger
        FROM fiaon_mail_log WHERE person_id = ${rate.person_id}
        ORDER BY gesendet_am DESC LIMIT 25
      `.catch(() => [] as any[]) : Promise.resolve([] as any[]),

      // ── DIE BANKDATEN ZUM VORLESEN ──────────────────────────────────────
      (async () => {
        const { firmierung } = await import("../lib/fiaon-firmierung");
        const f = await firmierung().catch(() => ({ name: "Fiaon Ltd" } as any));
        return {
          empfaenger: f.name,
          iban: process.env.FIAON_IBAN || "BE09 9058 9276 3957",
          bic: process.env.FIAON_BIC || "TRWIBEB1XXX",
          verwendungszweck: rate.zahlungsreferenz,
        };
      })(),
    ]);

    res.json({
      ok: true, rate, mahnungen, kontakte, arbeit, raten,
      kunde, gespraeche, mails, bank,
    });
  } catch (err) {
    console.error("[INKASSO] rate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/rate/:id/ergebnis */
router.post("/inkasso/rate/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const ergebnis = String(req.body?.ergebnis || "");
    if (!istRatenErgebnis(ergebnis)) {
      return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis." });
    }
    const erg = await ratenErgebnisAnwenden({
      rateId: Number(req.params.id), ergebnis,
      agentId: req.agent!.id, agentName: req.agent!.name,
      zusageDatum: req.body?.zusageDatum ?? null,
      notiz: req.body?.notiz ?? null,
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    const { ok: _weg, ...rest } = erg;
    res.json({ ok: true, ...rest, zahlen: await kennzahlen() });
  } catch (err) {
    console.error("[INKASSO] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stunden ────────────────────────────────────────────────────────────────

/** GET /inkasso/stunden */
router.get("/inkasso/stunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    res.json({
      ok: true,
      stunden: await sqlPool`
        SELECT id, tag, von, bis, minuten, notiz, bestaetigt_am, bestaetigt_von
        FROM fiaon_stunden
        WHERE agent_id = ${req.agent!.id} AND entfernt_am IS NULL
        ORDER BY tag DESC, von DESC LIMIT 120
      `,
      verdienst: await verdienst(req.agent!.id),
    });
  } catch (err) {
    console.error("[INKASSO] stunden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/stunden — erfassen. */
router.post("/inkasso/stunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const tag = String(req.body?.tag || "").slice(0, 10);
    const von = String(req.body?.von || "");
    const bis = String(req.body?.bis || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return res.status(400).json({ ok: false, error: "Bitte ein Datum wählen." });
    if (!/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis)) {
      return res.status(400).json({ ok: false, error: "Bitte Uhrzeiten im Format 09:30 angeben." });
    }
    const min = (Number(bis.slice(0, 2)) * 60 + Number(bis.slice(3))) - (Number(von.slice(0, 2)) * 60 + Number(von.slice(3)));
    if (min <= 0) return res.status(400).json({ ok: false, error: "„Bis“ muss nach „von“ liegen." });
    if (min > 16 * 60) return res.status(400).json({ ok: false, error: "Mehr als 16 Stunden an einem Tag nehme ich dir nicht ab." });
    if (tag > berlinToday()) return res.status(400).json({ ok: false, error: "Zeiten in der Zukunft lassen sich nicht erfassen." });

    await sqlPool`
      INSERT INTO fiaon_stunden (agent_id, tag, von, bis, minuten, notiz)
      VALUES (${req.agent!.id}, ${tag}::date, ${von}::time, ${bis}::time, ${min},
              ${String(req.body?.notiz || "").trim() || null})
    `;
    res.json({ ok: true, meldung: `${Math.floor(min / 60)} Std ${min % 60} Min erfasst.`, verdienst: await verdienst(req.agent!.id) });
  } catch (err) {
    console.error("[INKASSO] stunden anlegen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /inkasso/stunden/:id/entfernen
 *
 * Nur UNBESTÄTIGTE Zeilen, und weich. Eine bestätigte Zeile zu entfernen hieße,
 * eine Abrechnung nachträglich zu ändern.
 */
router.post("/inkasso/stunden/:id/entfernen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const r = (await sqlPool`
      UPDATE fiaon_stunden SET entfernt_am = NOW()
      WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id}
        AND bestaetigt_am IS NULL AND entfernt_am IS NULL
      RETURNING id
    `) as any[];
    if (r.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Diese Zeile ist bereits bestätigt und lässt sich nicht mehr ändern — "
          + "sonst wäre die Abrechnung nachträglich verschiebbar.",
      });
    }
    res.json({ ok: true, verdienst: await verdienst(req.agent!.id) });
  } catch (err) {
    console.error("[INKASSO] stunden entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BETREIBERSICHT
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/inkasso/kennzahlen — auch für Leitung und Vorgesetzter. */
router.get("/admin/inkasso/kennzahlen", async (_req, res: Response) => {
  try {
    res.json({ ok: true, zahlen: await kennzahlen() });
  } catch (err) {
    console.error("[INKASSO] admin kennzahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/inkasso/stunden/:agentId */
router.get("/admin/inkasso/stunden/:agentId", async (req, res: Response) => {
  try {
    const id = Number(req.params.agentId);
    res.json({
      ok: true,
      stunden: await sqlPool`
        SELECT id, tag, von, bis, minuten, notiz, bestaetigt_am, bestaetigt_von
        FROM fiaon_stunden WHERE agent_id = ${id} AND entfernt_am IS NULL
        ORDER BY tag DESC LIMIT 200
      `,
      verdienst: await verdienst(id),
    });
  } catch (err) {
    console.error("[INKASSO] admin stunden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/inkasso/stunden/:agentId/bestaetigen — ein Monat, ein Klick.
 *
 * Bestätigen heißt: unveränderlich machen UND als Auszahlungsposition anlegen.
 * Beides in einer Transaktion — eine bestätigte Stunde ohne Position wäre
 * Arbeit, die niemand bezahlt.
 */
router.post("/admin/inkasso/stunden/:agentId/bestaetigen", async (req, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const monat = String(req.body?.monat || berlinToday().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(monat)) return res.status(400).json({ ok: false, error: "Monat im Format 2026-08 angeben." });

    const erg = await sqlPool.begin(async (tx) => {
      const [a] = (await tx`
        SELECT id, name, stundensatz_cents, verguetung_bestaetigt_am FROM fiaon_agents WHERE id = ${agentId}
      `) as any[];
      if (!a) return { ok: false, fehler: "Mitarbeiter nicht gefunden." };
      if (!a.verguetung_bestaetigt_am) {
        return {
          ok: false,
          fehler: "Bestätige zuerst Stundensatz und Prämie dieses Mitarbeiters — "
            + "ohne freigegebenen Satz gibt es keinen Betrag zum Auszahlen.",
        };
      }
      const satz = Number(a.stundensatz_cents ?? 0);
      if (satz <= 0) return { ok: false, fehler: "Der Stundensatz ist null." };

      const zeilen = (await tx`
        SELECT id, minuten FROM fiaon_stunden
        WHERE agent_id = ${agentId} AND entfernt_am IS NULL AND bestaetigt_am IS NULL
          AND to_char(tag, 'YYYY-MM') = ${monat}
      `) as any[];
      if (zeilen.length === 0) return { ok: false, fehler: `Für ${monat} sind keine offenen Zeiten erfasst.` };

      const minuten = zeilen.reduce((s, z) => s + Number(z.minuten), 0);
      const cents = Math.round((minuten / 60) * satz);

      // Auszahlungsposition über den BESTEHENDEN Weg: eine Provisionszeile mit
      // `kind = 'stunden'`. Der Auszahlungslauf liest ohnehin alles aus
      // fiaon_commissions — eine zweite Quelle wäre eine zweite Wahrheit.
      const [c] = (await tx`
        INSERT INTO fiaon_commissions
          (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note)
        VALUES (${agentId}, ${`STUNDEN-${monat}-${agentId}`}, 'Arbeitszeit',
                ${cents}, 0, ${cents}, 'bestaetigt', 'stunden',
                ${`${Math.floor(minuten / 60)} Std ${minuten % 60} Min im ${monat} `
                  + `zu ${(satz / 100).toFixed(2).replace(".", ",")} € — bestätigt vom Vorgesetzter.`})
        ON CONFLICT DO NOTHING
        RETURNING id
      `) as any[];

      await tx`
        UPDATE fiaon_stunden
        SET bestaetigt_am = NOW(), bestaetigt_von = 'Vorgesetzter', commission_id = ${c?.id ?? null}
        WHERE id = ANY(${zeilen.map((z) => Number(z.id))})
      `;
      return {
        ok: true, minuten, cents, zeilen: zeilen.length,
        meldung: `${Math.floor(minuten / 60)} Std ${minuten % 60} Min bestätigt — `
          + `${(cents / 100).toFixed(2).replace(".", ",")} € stehen zur Auszahlung.`,
      };
    });

    if (!erg.ok) return res.status(400).json({ ok: false, error: (erg as any).fehler });
    res.json(erg);
  } catch (err) {
    console.error("[INKASSO] bestaetigen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/inkasso/verguetung/:agentId — Satz und Prämie festlegen. */
router.post("/admin/inkasso/verguetung/:agentId", async (req, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const satz = Math.round(Number(req.body?.stundensatzEuro ?? 0) * 100);
    const art = String(req.body?.praemieArt || "euro");
    const wert = art === "prozent"
      ? Math.round(Number(req.body?.praemieWert ?? 0) * 100)   // Prozent → Basispunkte
      : Math.round(Number(req.body?.praemieWert ?? 0) * 100);  // Euro → Cent
    if (!["euro", "prozent"].includes(art)) return res.status(400).json({ ok: false, error: "Prämienart unbekannt." });
    if (satz < 0 || wert < 0) return res.status(400).json({ ok: false, error: "Negative Werte gibt es nicht." });

    await sqlPool`
      UPDATE fiaon_agents SET
        stundensatz_cents = ${satz || null},
        inkasso_praemie_art = ${art},
        inkasso_praemie_wert = ${wert || null},
        -- Der Zeitstempel IST die Bestätigung. Erst wenn er steht, wird eine
        -- Prämie gebucht und lassen sich Stunden abrechnen.
        verguetung_bestaetigt_am = NOW()
      WHERE id = ${agentId}
    `;
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${agentId}, 'verguetung_gesetzt',
              ${JSON.stringify({ stundensatzCents: satz, praemieArt: art, praemieWert: wert })},
              'Vorgesetzter', 'Vergütung bestätigt')
    `.catch(() => {});
    res.json({ ok: true, meldung: "Vergütung bestätigt. Ab jetzt werden Prämien gebucht und Stunden abrechenbar." });
  } catch (err) {
    console.error("[INKASSO] verguetung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /inkasso/rate/:id/erinnerung — die Rechnung jetzt rausschicken.
 *
 * ── DER AUFTRAG ────────────────────────────────────────────────────────────
 * Der Vorgesetzte: „Dieser sagt sowas wie ‚ich schicke Ihnen die Rechnung
 * gleich noch zu, bitte umgehend einbezahlen…' — drückt auf einen Knopf,
 * E-Mail geht raus."
 *
 * ── KEIN NEUES EVENT ───────────────────────────────────────────────────────
 * Auf die Frage „haben wir neue Events, die verbunden werden müssen?": NEIN.
 * `abo_payment_reminder` existiert seit Wochen und trägt alles, was gebraucht
 * wird — Betrag, Fälligkeitstag, Ratennummer, Tage überfällig, Mahnstufe,
 * Bankdaten und den Verwendungszweck (die Ratenreferenz).
 *
 * Ein zweites Event für „dieselbe Mail, nur von Hand ausgelöst" wäre ein
 * zweiter Brevo-Text, den man beim nächsten Wortwechsel an einer Stelle
 * ändert und an der anderen vergisst.
 *
 * Was der Vorgesetzte noch tun muss: den Make-Zweig `abo_payment_reminder`
 * und das Brevo-Template anlegen. Das steht als TODO in der Ereignisliste.
 *
 * ── WARUM DIE MAHNSTUFE NICHT STEIGT ───────────────────────────────────────
 * Der automatische Lauf zählt sie hoch: Stufe 1 am Fälligkeitstag, Stufe 2
 * nach sieben Tagen, Stufe 3 nach vierzehn. Ein Mensch, der im Gespräch sagt
 * „ich schicke sie Ihnen gleich", mahnt nicht — er hilft. Würde dieser Knopf
 * die Stufe hochzählen, käme der Kunde durch ein freundliches Telefonat
 * schneller in die Eskalation als durch Schweigen.
 */
router.post("/inkasso/rate/:id/erinnerung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const id = Number(req.params.id);
    const [r] = (await sqlPool`
      SELECT r.*, a.person_id, a.ref,
             COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                      NULLIF(a.billing_email, ''), p.primary_email) AS email
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      WHERE r.id = ${id} AND r.status = 'offen'
        AND a.payment_status = 'paid' AND a.merged_into IS NULL
        AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    `) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Diese Rate gibt es nicht mehr." });
    if (!r.email) {
      return res.status(400).json({
        ok: false,
        error: "Bei diesem Kunden ist keine E-Mail hinterlegt. Sag ihm die Bankdaten am Telefon — "
          + "sie stehen in der Akte.",
      });
    }

    const { aboErinnerungPayload } = await import("./fiaon-abo");
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const versand = await sendMakeWebhookMitGrund(
      "abo_payment_reminder", aboErinnerungPayload(r) as any,
    );

    // Der Versand steht in der Akte — auch wenn er scheitert. Ein Mitarbeiter,
    // der am Telefon „ist unterwegs" sagt, muss nachher sehen können, ob sie
    // wirklich raus ist.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${r.ref}, ${r.person_id}, ${req.agent!.id}, ${req.agent!.name}, 'note',
              ${`Zahlungserinnerung für Rate ${r.rate_nr} von Hand verschickt`
                + `${versand.ok ? ` an ${r.email}` : ` — FEHLGESCHLAGEN: ${versand.grund}`}.`},
              NOW())
    `.catch(() => {});

    // Auch die Rate merkt sich das: `letzte_erinnerung_at` steuert, wann der
    // automatische Lauf wieder darf. Zwei Mails an einem Tag wären
    // aufdringlich.
    if (versand.ok) {
      await sqlPool`
        UPDATE fiaon_abo_raten
        SET erinnerungen = COALESCE(erinnerungen, 0) + 1,
            letzte_erinnerung_at = NOW(), letzter_fehler = NULL, updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      await sqlPool`
        UPDATE fiaon_abo_raten SET letzter_fehler = ${String(versand.grund).slice(0, 300)},
            updated_at = NOW() WHERE id = ${id}
      `;
    }

    res.json({
      ok: versand.ok,
      meldung: versand.ok
        ? `Die Zahlungserinnerung ist an ${r.email} unterwegs. Sie enthält Betrag, `
          + `Bankdaten und den Verwendungszweck ${r.zahlungsreferenz}.`
        : null,
      error: versand.ok ? null : `Die Mail ging nicht raus: ${versand.grund}`,
    });
  } catch (err) {
    console.error("[INKASSO] erinnerung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ZUTEILUNG — nur der Vorgesetzte
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/inkasso/zuteilung — wer hat wie viel, was liegt herum?
 *
 * Die Antwort ist eine VORSCHAU: Sie zeigt, wer welche Rate bekäme, ohne
 * etwas zu ändern. Eine Verteilung greift in die Arbeit mehrerer Menschen
 * ein — wer sie zum ersten Mal ansieht, will sehen, was passieren würde.
 */
router.get("/admin/inkasso/zuteilung", async (req: Request, res: Response) => {
  try {
    const { inkassoVerteilen } = await import("../lib/fiaon-inkasso");
    const erg = await inkassoVerteilen({
      schreiben: false,
      nurAgentId: req.query.agent ? Number(req.query.agent) : null,
      anzahl: req.query.anzahl ? Number(req.query.anzahl) : 200,
    });
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[INKASSO] zuteilung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/inkasso/zuteilung — jetzt wirklich verteilen. */
router.post("/admin/inkasso/zuteilung", async (req: Request, res: Response) => {
  try {
    const { inkassoVerteilen } = await import("../lib/fiaon-inkasso");
    const erg = await inkassoVerteilen({
      // `schreiben` muss ausdrücklich true sein. Ein Massenlauf, der beim
      // ersten Klick zuschlägt, ist bei mehreren betroffenen Menschen die
      // falsche Voreinstellung.
      schreiben: req.body?.schreiben === true,
      nurAgentId: req.body?.agent ? Number(req.body.agent) : null,
      anzahl: req.body?.anzahl ? Number(req.body.anzahl) : 200,
    });
    if (erg.verteilt > 0) {
      const { aktivitaetSchreiben } = await import("../lib/fiaon-aktivitaet");
      await aktivitaetSchreiben({
        typ: "vertrieb_zuweisung", wer: "Vorgesetzter",
        grund: `${erg.verteilt} überfällige Raten auf ${erg.mannschaft.length} Inkasso-Mitarbeiter verteilt.`,
        meta: { bereich: "inkasso", anzahl: erg.verteilt },
      });
    }
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[INKASSO] verteilen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/inkasso/rate/:id/zuweisen — eine einzelne Rate. */
router.post("/admin/inkasso/rate/:id/zuweisen", async (req: Request, res: Response) => {
  try {
    const { inkassoRateZuweisen } = await import("../lib/fiaon-inkasso");
    const agentId = req.body?.agent === null || req.body?.agent === ""
      ? null : Number(req.body?.agent);
    const erg = await inkassoRateZuweisen(Number(req.params.id), agentId, "Vorgesetzter");
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({
      ok: true,
      meldung: agentId === null
        ? "Die Rate ist wieder frei und geht in die nächste Verteilung."
        : "Zugewiesen.",
    });
  } catch (err) {
    console.error("[INKASSO] rate zuweisen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEHLENDE ABOS NACHTRAGEN
//
// Der Vorgesetzte: „JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO, JEDER — ab
// Tag der Verbuchung, genau ab dem Tag bezahlt er JEDES Monat sein Paket.
// Jeder, der seine Rate nicht bezahlt hat, muss zum Inkasso kommen."
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/inkasso/abos-nachtragen — Vorschau. */
router.get("/admin/inkasso/abos-nachtragen", async (_req: Request, res: Response) => {
  try {
    const { abosNachtragen, schufaMitRaten, PAKET_PREIS_CENTS } =
      await import("../lib/fiaon-abo-pflicht");
    const [erg, schufa] = await Promise.all([
      abosNachtragen({ schreiben: false }),
      schufaMitRaten(),
    ]);
    res.json({
      ok: true, ...erg,
      // Die Gegenprobe wandert mit: Eine SCHUFA-Bestellung mit Raten wäre ein
      // Fehler in der anderen Richtung, und man sieht ihn nur, wenn man ihn
      // zeigt.
      schufaMitRaten: schufa,
      preise: PAKET_PREIS_CENTS,
    });
  } catch (err) {
    console.error("[INKASSO] abos-vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/inkasso/abos-nachtragen — jetzt wirklich anlegen. */
router.post("/admin/inkasso/abos-nachtragen", async (req: Request, res: Response) => {
  try {
    const { abosNachtragen } = await import("../lib/fiaon-abo-pflicht");
    const erg = await abosNachtragen({
      // Angelegte Raten lösen Mahnungen aus. Ein Massenlauf, der beim ersten
      // Klick zuschlägt, ist hier die falsche Voreinstellung.
      schreiben: req.body?.schreiben === true,
      nurRef: req.body?.ref ? String(req.body.ref) : null,
    });
    if (erg.angelegt > 0) {
      const { aktivitaetSchreiben } = await import("../lib/fiaon-aktivitaet");
      await aktivitaetSchreiben({
        typ: "commission_statement_issued", wer: "Vorgesetzter",
        grund: `${erg.angelegt} Kunden bekamen Abo-Raten nachgetragen (${erg.ratenGesamt} Raten).`,
        meta: { bereich: "abo_nachtrag", kunden: erg.angelegt, raten: erg.ratenGesamt },
      });
    }
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[INKASSO] abos-nachtragen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
