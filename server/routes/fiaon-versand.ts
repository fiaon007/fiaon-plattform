// ═══════════════════════════════════════════════════════════════════════════
// VERSANDZENTRUM — Routen
//
// Zwei Wege: die Historie lesen und eine Sendung wiederholen. Die Regeln
// (Zustand, Tageslimit, Rollen) stehen in server/lib/fiaon-versand.ts — hier
// steht nur, wer welchen Kunden anfassen darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { rolleVon, darfAnKunde } from "../lib/fiaon-kundenzugriff";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  artenFuerRolle, versandErlaubt, versandHistorie, versandKnoepfe,
  type VersandArt,
} from "../lib/fiaon-versand";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
// VORHER 24.08.2026: nur `terminLink`. NACHHER: zusätzlich die beiden
// Berlin-Formatierer — die Mail „termin_verpasst" nennt Datum und Uhrzeit des
// Termins, der nicht zustande kam. GRUND: Auftrag des Inhabers vom 24.08.2026.
import { terminLink, berlinDatumText, berlinUhrzeit } from "../lib/fiaon-termine";
import { absoluteUrl } from "../fiaon-base-url";
// NEU 01.09.2026 (E-072): Der signierte Direktlink in die Mandatsstrecke.
import { sepaLink } from "./fiaon-lastschrift";
// ══════════════════════════════════════════════════════════════════════════
// NEU 02.09.2026 — DIE HANDMAIL MUSS DIESELBE MAIL SEIN WIE DIE AUTOMATIK
//
// Justin, wörtlich: „stelle sicher das in jeder Email die wir senden es eben
// so einfach wie möglich für den Kunden gemacht wird, es sollen natürlich auch
// die Zahlungsdetails (Höhe, Verwendungszweck und co.) über unsere Mails
// rausgehen (überall wo es um die Zahlung geht!)“.
//
// VORHER: `payment_details` ging von hier ohne `sofort_url` raus. Der Motor
//   lässt einen Knopf ohne Ziel weg (server/mail/motor.ts) — die von Hand
//   gesendete Zahlungsmail hatte also KEINEN „Sofort per Bank-App“-Knopf,
//   dieselbe Mail aus der Automatik schon. Ein Mitarbeiter, der einem Kunden
//   am Telefon „ich schicke Ihnen das gleich“ sagt, schickte die schwächere.
// NACHHER: Dieselben Felder wie in makePayloadFromRow (server/make-webhook.ts)
//   — Sofort-Link und Bankverbindung aus der einen Quelle.
// ══════════════════════════════════════════════════════════════════════════
import { sofortUrlFuer } from "../lib/fiaon-zahlungsauftrag";
import { BANK } from "@shared/fiaon-bank";
// Der Satz über die offene Rate — eine Quelle für Lauf und Handversand.
import { offeneRateHinweis, offeneRatenCents } from "../lib/fiaon-sepa-werbung";

const router = Router();

// ── DIE ROLLE KOMMT AUS fiaon-kundenzugriff.ts ───────────────────────────
// Hier stand eine eigene Fassung. Die in fiaon-mail.ts deutete „inkasso"
// stillschweigend zu „agent" um — eine Erlaubnisliste aus drei Namen, die
// niemand erweiterte. Der Inkasso-Mitarbeiter bekam beim Senden 403.

/**
 * Darf dieser Mitarbeiter an diesen Kunden senden?
 *
 * Ein Teammitglied nur an EIGENE Kunden — sonst wäre das Versandzentrum ein
 * Weg, jedem Menschen im Bestand eine Mail zu schicken, ohne je für ihn
 * zuständig gewesen zu sein.
 */
// P13 (01.09.2026): Die private darfAnKunde-Kopie ist weg — sie kannte weder
// 'admin' noch 'inkasso' noch die Pool-Regel und lief zwangsläufig auseinander.
// Es gilt die EINE Definition aus server/lib/fiaon-kundenzugriff.ts (Import oben).

/** GET /agent/versand/:personId — Historie und Knöpfe. */
router.get("/agent/versand/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const [historie, knoepfe] = await Promise.all([
      versandHistorie(personId),
      versandKnoepfe(personId, rolle),
    ]);
    res.json({ ok: true, historie, knoepfe, rolle });
  } catch (err) {
    console.error("[VERSAND] lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/versand/:personId/:art — erneut senden. */
router.post("/agent/versand/:personId/:art", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const art = String(req.params.art) as VersandArt;
    const rolle = await rolleVon(req.agent!.id);

    if (!artenFuerRolle(rolle).includes(art)) {
      return res.status(403).json({ ok: false, error: "Diese Art darfst du nicht senden." });
    }
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    // Zustand UND Tageslimit — serverseitig, nicht nur am ausgegrauten Knopf.
    const pruefung = await versandErlaubt(personId, art);
    if (!pruefung.erlaubt) return res.status(409).json({ ok: false, error: pruefung.grund });

    const [p] = (await sqlPool`
      SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS email,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref,
             (SELECT a3.payment_reference FROM fiaon_applications a3
               WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
               ORDER BY a3.created_at DESC LIMIT 1) AS zahlungsreferenz,
             (SELECT a4.amount_due FROM fiaon_applications a4
               WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
               ORDER BY a4.created_at DESC LIMIT 1) AS betrag,
             (SELECT a5.pack_name FROM fiaon_applications a5
               WHERE a5.person_id = p.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
               ORDER BY a5.created_at DESC LIMIT 1) AS paket,
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
      FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE p.id = ${personId}
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });

    const basis = {
      email: String(p.email || ""),
      vorname: p.vorname || null,
      nachname: p.nachname || null,
      antrag_id: p.ref || undefined,
      payment_reference: p.zahlungsreferenz || null,
      betrag: p.betrag != null ? String(p.betrag) : null,
      paket: p.paket ? String(p.paket).split("\n")[0].trim() : null,
    };
    // ══════════════════════════════════════════════════════════════════════
    // DIE ZAHLUNGSDATEN GEHÖREN ZUR OFFENEN BESTELLUNG (02.09.2026)
    //
    // `basis` oben nimmt die JÜNGSTE Bestellung. Bei fünf Personen im Bestand
    // (Zählung 02.09.) ist die jüngste bezahlt und eine ältere offen — für die
    // hätte die Zahlungsmail Referenz und Betrag der falschen Bestellung
    // getragen. Der Kunde überweist dann mit einem Verwendungszweck, zu dem
    // nichts mehr offen ist, und die Zahlung bleibt liegen.
    // `versandErlaubt` lässt `payment_details` ohnehin nur durch, wenn eine
    // offene Bestellung existiert — hier wird sie geholt. Bevorzugt wird die,
    // die einen Betrag hat: Eine Zahlungsaufforderung ohne Betrag ist keine.
    // ══════════════════════════════════════════════════════════════════════
    let offeneBestellung: { ref: string; payment_reference: string | null; amount_due: string | null; pack_name: string | null; payment_status: string } | null = null;
    if (art === "payment_details") {
      const [o] = (await sqlPool`
        SELECT ref, payment_reference, amount_due, pack_name, payment_status
          FROM fiaon_applications
         WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
           AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
         ORDER BY (COALESCE(amount_due, 0) > 0) DESC, created_at DESC
         LIMIT 1
      `) as any[];
      offeneBestellung = o
        ? {
            ref: String(o.ref),
            payment_reference: o.payment_reference || null,
            amount_due: o.amount_due != null ? String(o.amount_due) : null,
            pack_name: o.pack_name ? String(o.pack_name).split("\n")[0].trim() : null,
            // Wer uns gerade gemeldet hat, dass er ueberwiesen hat, bekommt
            // KEINEN Sofort-Knopf — sonst draengt die Handmail zur zweiten
            // Zahlung (Pruefung 02.09.2026). Der leise Weg (Zahlungsseite)
            // bleibt: dort sieht er erst den Stand seiner Bestellung.
            payment_status: String(o.payment_status || ""),
          }
        : null;
    }

    // Die überfällige Rate, die der Bankeinzug als Erstes holen wird — derselbe
    // Satz wie im Einladungslauf (fiaon-sepa-werbung.ts). Ohne ihn stünde in der
    // Handmail an dieser Stelle ein leerer Absatz, und der Kunde erführe erst
    // bei der Abbuchung davon; genau daran scheitern Mandate.
    const rateHinweis = art === "sepa_einrichten" && p.ref
      ? offeneRateHinweis(await offeneRatenCents(String(p.ref)))
      : "";

    // ══════════════════════════════════════════════════════════════════════
    // NEU 24.08.2026 — die Angaben für „termin_verpasst"
    //
    // VORHER: Diese Art gab es nicht.
    // NACHHER: Die Mail nennt den Termin, der nicht zustande kam. Dafür wird
    //   der ZULETZT verpasste Startgesprächstermin gelesen — steht keiner da
    //   (jemand sendet die Mail ohne No-Show), bleiben Datum und Uhrzeit leer
    //   und die Vorlage lässt den Satz weg. Kein erfundenes Datum.
    // GRUND: Auftrag des Inhabers vom 24.08.2026.
    // ══════════════════════════════════════════════════════════════════════
    let verpasst: { beginn: Date | null; agent_vorname: string | null } | null = null;
    if (art === "termin_verpasst") {
      const [t] = (await sqlPool`
        SELECT t.beginn, COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
        FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
        WHERE t.person_id = ${personId} AND t.status = 'verpasst'
        ORDER BY t.beginn DESC LIMIT 1
      `) as any[];
      verpasst = t ? { beginn: t.beginn, agent_vorname: t.agent_vorname } : null;
    }

    // ── HERKUNFT STATT FOLGENLOSER QUELLE (24.08.2026) ────────────────────
    // VORHER stand hier dreimal „onboarding_call" bzw. gar nichts — eine
    // QUELLE, die `terminLink` mit `void quelle;` weggeworfen hat. NACHHER
    // trägt der zweite Parameter den WEG; er landet als `fiaon_termine.herkunft`
    // am gebuchten Termin und ändert an Slots und Rolle nichts.
    const zusatz: Record<string, unknown> =
      art === "nicht_erreicht_termin"
        ? { agent_vorname: p.agent_vorname || "dein Ansprechpartner", termin_link: terminLink(personId, "nicht_erreicht_mail") }
        : art === "onboarding_einladung"
          ? { termin_link: terminLink(personId, "onboarding_einladung") }
          : art === "termin_verpasst"
            ? {
                agent_vorname: verpasst?.agent_vorname || p.agent_vorname || "Ihr Ansprechpartner",
                termin_datum: verpasst?.beginn ? berlinDatumText(verpasst.beginn) : null,
                termin_uhrzeit: verpasst?.beginn ? berlinUhrzeit(verpasst.beginn) : null,
                termin_link: terminLink(personId, "termin_verpasst_mail"),
              }
            : art === "sepa_einrichten"
              ? {
                  // NEU 24.08.2026: Der Weg in den Kundenbereich, wo die
                  // Lastschrift eingerichtet wird. Die ERSTE Zahlung bleibt
                  // immer eine Überweisung — die Vorlage darf das nicht
                  // vermischen, sonst kommen Rückfragen und Rückbuchungen.
                  // GEÄNDERT 01.09.2026 (E-072): Der Knopf führt jetzt über
                  // `sepa_link` direkt in die Mandatsstrecke. Fehlt die
                  // Referenz, bleibt der Kundenbereich als Rückfallweg.
                  agent_vorname: p.agent_vorname || "Ihr Ansprechpartner",
                  // 01.09.2026 (Fund der SEPA-Schwester-Sitzung): /kundenbereich
                  // existierte als Route NICHT — jeder Klick landete auf 404
                  // (Messung: 23 Mails, 5 Klicks, 0 Mandate). Jetzt führt der
                  // signierte Direktlink in die Mandatsstrecke; /dashboard#abo
                  // ist der Rückfallweg.
                  sepa_link: p.ref ? sepaLink(String(p.ref)) : absoluteUrl("/dashboard#abo"),
                  kundenbereich_link: absoluteUrl("/dashboard#abo"),
                  // NEU 02.09.2026: derselbe Satz wie im Einladungslauf.
                  // KEINE Zahlwege in dieser Mail — die Begründung steht im
                  // Kopf von server/lib/fiaon-sepa-werbung.ts (kurz: Doppel-
                  // zahlung, und die offene Rate hat eine eigene Referenz).
                  offene_rate_hinweis: rateHinweis,
                }
              : {};

    // ── DIE ZAHLWEGE STEHEN NEBEN DER KETTE, NICHT IN IHR ─────────────────
    // Die Kette oben ist schon fünf Ebenen tief; eine sechste hätte sie
    // unlesbar gemacht. Ein eigener Block sagt außerdem deutlicher, worum es
    // geht: Das hier sind die WEGE zur Zahlung, nicht Beiwerk einer Vorlage.
    // Reihenfolge beim Zusammenbauen: basis < zusatz < zahlwege — die
    // Zahlungsdaten der OFFENEN Bestellung schlagen die der jüngsten.
    const zahlwege: Record<string, unknown> = art === "payment_details"
      ? {
          // Fehlt die offene Bestellung wider Erwarten, bleibt es bei
          // `basis`, statt hier null zu schreiben und die Mail um ihre
          // Zahlen zu bringen.
          ...(offeneBestellung
            ? {
                antrag_id: offeneBestellung.ref,
                payment_reference: offeneBestellung.payment_reference,
                betrag: offeneBestellung.amount_due,
                ...(offeneBestellung.pack_name ? { paket: offeneBestellung.pack_name } : {}),
              }
            : {}),
          // Der Knopf, der bisher still wegfiel. `sofortUrlFuer` gibt null
          // zurück, solange die Sofortzahlung nicht eingesteckt ist oder die
          // Referenz nicht die Form eines Zahlungsauftrags hat — dann fällt
          // er weiterhin weg, statt ins Leere zu führen.
          sofort_url: offeneBestellung?.payment_status === "claimed_paid" ? null : sofortUrlFuer(offeneBestellung?.payment_reference ?? null),
          // Empfänger/IBAN/BIC aus der einen Quelle. Der Motor hätte einen
          // Rückfall auf dieselben Werte; mitgeschickt stehen sie AUCH im
          // Protokoll, und die Mail lässt sich später richtig nachdrucken.
          empfaenger: BANK.empfaenger,
          iban: BANK.ibanDisplay,
          bic: BANK.bic,
        }
      : {};

    const erg = await versendenUndProtokollieren(art as any, { ...basis, ...zusatz, ...zahlwege }, {
      personId,
      verlaufRef: p.ref || null,
      verlaufText: `Erneut gesendet von ${req.agent!.name}: ${art}.`,
      ausgeloestVon: req.agent!.name,
      ausgeloestAgentId: req.agent!.id,
    });

    res.json({
      ok: erg.status === "versandt",
      status: erg.status,
      grund: erg.grund,
      meldung: erg.status === "versandt"
        ? `Verschickt an ${basis.email}.`
        : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
      knoepfe: await versandKnoepfe(personId, rolle),
      historie: await versandHistorie(personId),
    });
  } catch (err) {
    console.error("[VERSAND] senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
