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
                  agent_vorname: p.agent_vorname || "Ihr Ansprechpartner",
                  // 01.09.2026 (Fund der SEPA-Schwester-Sitzung): /kundenbereich
                  // existiert als Route NICHT — jeder Klick landete auf 404.
                  // Messung: 23 Mails, 5 Klicks, 0 Mandate. Ziel ist /dashboard#abo.
                  kundenbereich_link: absoluteUrl("/dashboard#abo"),
                }
              : {};

    const erg = await versendenUndProtokollieren(art as any, { ...basis, ...zusatz }, {
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
