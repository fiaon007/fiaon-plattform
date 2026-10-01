// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNGEN — ein Ort für alle Quellen (02.09.2026, E-092)
//
// Bis heute liefen Kündigungen in drei Töpfen, die nichts voneinander wussten:
// das Formular (`cancellation_requests`, 127 unbearbeitete Anträge seit Mai),
// die Mails an support@/welcome@ (der Postmeister legte nur einen Vermerk an)
// und das Telefon (gar nichts). Keiner der drei wirkte auf das Abo.
//
// Hier laufen sie zusammen: eine Liste, ein Knopf, eine Regel.
// Die Regel steht in server/lib/fiaon-kuendigung.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { sqlPool } from "../lib/db-pool";
import { kuendigungSetzen, kuendigungZuruecknehmen, kuendigungSpalten, vertragsendeLesen, type KuendigungQuelle } from "../lib/fiaon-kuendigung";
import { absoluteUrl } from "../fiaon-base-url";
// E-265 Nachbesserung 2 (01.10.2026): Vertragsart und Vertragsende aus denselben Regeln wie WhatsApp und Postfach.
// E-265 (01.10.2026, Paket Recht): Altvertrag — Ende des Abrechnungsmonats (vertragsendeLesen), nicht Kalendermonat.
import { istJahresvertrag, abrechnungsmonatEnde, tagDeutsch, giltZumSatz } from "@shared/fiaon-antrag-stand";
// E-213: Die Urkunde zur Kündigung — Papier, Unterschrift, Prüfsumme.
import { urkundeAusfertigen, urkundeVerwerfen, urkundeStand, rolleInWorten } from "../lib/fiaon-kuendigung-urkunde";

const router = Router();
const QUELLEN: KuendigungQuelle[] = ["mail", "formular", "telefon", "admin", "altbestand"];

/**
 * Bestätigungsmail — einmalig je Bestellung (Vertragspost, keine Werbung).
 * Exportiert (21.09.2026, E-201): Der Storno der Telefonkartei schickt sie genauso.
 */
export async function bestaetigungSenden(ref: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.email, a.first_name, a.last_name, a.payment_reference, a.pack_name,
           a.letzte_rate_nr, a.kuendigung_bestaetigt_mail_am, a.payment_status, a.agb_stand, a.gekuendigt_am,
           -- E-265 Nachbesserung 2 (01.10.2026): ALLE noch zu zahlenden Raten (bis zur letzten), älteste zuerst — dieselbe
           -- Liste wie Urkunde, WhatsApp und Postfach (vorher nur die Rate letzte_rate_nr).
           (SELECT COALESCE(json_agg(json_build_object('rate_nr', y.rate_nr, 'betrag_cents', y.betrag_cents, 'faellig_am', y.faellig_am,
                     'zahlungsreferenz', y.zahlungsreferenz) ORDER BY y.rate_nr), '[]'::json)
              FROM fiaon_abo_raten y
             WHERE y.ref = a.ref AND y.status = 'offen' AND y.storniert_am IS NULL AND y.zahlungsreferenz IS NOT NULL
               AND (a.letzte_rate_nr IS NULL OR y.rate_nr <= a.letzte_rate_nr)) AS offene_raten
    FROM fiaon_applications a
    WHERE a.ref = ${ref} LIMIT 1
  `) as any[];
  if (!a || a.kuendigung_bestaetigt_mail_am) return false;
  // E-265 (01.10.2026, Recht): das Vertragsende beim Altvertrag aus der einen Rechnung (Abrechnungsmonat).
  a.ende_tag = istJahresvertrag(a.agb_stand) ? null : (await vertragsendeLesen(ref)).ende;
  const inhalt = bestaetigungInhalt(a);
  // Ohne offene Rate gibt es nichts zu bezahlen — dann ist der Vertrag schon beendet und die Abschlussmail hat der
  // Buchungsweg geschickt (bzw. beim Altvertrag endet er zum Ende des Abrechnungsmonats, ohne Forderung).
  if (!inhalt) return false;
  const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
  const erg: any = await sendMakeWebhookMitGrund("kuendigung_bestaetigt", {
    ...makePayloadFromRow(a),
    paket: a.pack_name ? String(a.pack_name).split("\n")[0] : null,
    ...inhalt,
    // Der Knopf zur Zahlungsseite (pruef-mail-knoepfe liest die Schlüssel am Aufruf): die erste noch zu zahlende Rate.
    verwendungszweck: inhalt.verwendungszweck,
    portal_url: absoluteUrl("/login"),
  } as any);
  // E-265 Schluss-Nachbesserung (01.10.2026, Probe-3-Befund K): sendMakeWebhookMitGrund liefert { ok: false, grund } —
  // nie `false`. Die alte Prüfung `erg === false` griff deshalb nie: Eine gescheiterte Bestätigung galt als gesendet
  // (Protokoll „Bestätigung per E-Mail raus", Antwort „bekommen Sie per E-Mail", kuendigung_bestaetigt_mail_am gesetzt
  // — und damit nie ein Nachholen). Jetzt bleibt die Spalte leer, und Mara sagt dem Kunden nichts von einer Mail.
  if (!erg?.ok) return false;
  await sqlPool`UPDATE fiaon_applications SET kuendigung_bestaetigt_mail_am = NOW() WHERE ref = ${ref}`.catch(() => {});
  return true;
}

/**
 * Der Inhalt der Bestätigungsmail aus EINER Ratenliste (E-265 Nachbesserung 2, 01.10.2026) — rein, im Prüfstand geprüft.
 * Gegenprobe 29.09. (g3-raten): Die Mail nannte nur die Rate letzte_rate_nr und sagte allen „Ihr Vertrag ist auf zwölf
 * Monatsraten angelegt. Wir entlassen Sie vorzeitig daraus … auch wenn wir es nicht müssten" — beim Vertrag vor dem
 * 03.09.2026 (monatlich kündbar) eine Irreführung über ein bestehendes Recht (§ 5 UWG), und bei zwei offenen Raten
 * fehlte die ältere. Jetzt: Altvertrag „gilt zum Ende Ihres laufenden Abrechnungsmonats, dem …", nur Raten bis dahin;
 * Jahresvertrag Justins Kulanz; jede Rate mit Datum, die Summe. Die alten Felder (rate_nr, betrag, faellig_am_text,
 * verwendungszweck) bleiben für Make. null = nichts zu zahlen (dann keine Mail).
 * E-265 (01.10.2026, Recht): `ende_tag` (YYYY-MM-DD) ist das Vertragsende aus vertragsendeLesen (Abrechnungsmonat);
 * fehlt es, rechnet die Funktion es rein aus gekuendigt_am und den Fälligkeiten der übergebenen Raten.
 */
export function bestaetigungInhalt(a: { agb_stand?: unknown; gekuendigt_am?: unknown; offene_raten?: any; ende_tag?: string | null }): Record<string, string> | null {
  const alt = !istJahresvertrag(a.agb_stand);
  const tag = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null);
  const de = (iso: string | null) => tagDeutsch(iso) ?? "";
  const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const roh: any[] = Array.isArray(a.offene_raten) ? a.offene_raten : typeof a.offene_raten === "string" ? JSON.parse(a.offene_raten) : [];
  const ende = alt ? (a.ende_tag ?? abrechnungsmonatEnde((a.gekuendigt_am as any) ?? new Date(), roh.map((r) => r.faellig_am))) : null;
  const raten = roh.map((r) => ({ nr: Number(r.rate_nr), cents: Number(r.betrag_cents) || 0, faellig: tag(r.faellig_am), ref: String(r.zahlungsreferenz ?? "") }))
    .filter((r) => r.cents > 0 && r.ref && (!ende || !r.faellig || r.faellig <= ende));
  if (!raten.length) return null;
  const summe = raten.reduce((x, r) => x + r.cents, 0);
  const eine = raten.length === 1;
  const liste = raten.map((r) => `Rate ${r.nr} über ${eur(r.cents)}${eine ? "" : ` (fällig ${de(r.faellig)})`}`).join(" und ");
  const vertragSatz = alt
    ? `Ihre Kündigung ist bei uns eingegangen. Ihr Vertrag ist mit einer Frist von 24 Stunden zum Ende des jeweiligen Abrechnungsmonats kündbar — Ihre Kündigung ${giltZumSatz(ende)}.`
    : "Ihr Vertrag ist auf zwölf Monatsraten angelegt. Wir entlassen Sie vorzeitig daraus — das machen wir gern, auch wenn wir es nicht müssten.";
  const offenSatz = alt
    ? `Raten für die Zeit nach dem Ende Ihres Abrechnungsmonats stellen wir nicht. Offen ${eine ? "bleibt die bis dahin fällige Rechnung" : "bleiben die bis dahin fälligen Rechnungen"} — ${liste}${eine ? `, fällig am ${de(raten[0].faellig)}` : `, zusammen ${eur(summe)}`}. Danach kommt nichts mehr.`
    : `Ab sofort stellen wir keine weiteren Raten und legen keine neuen Rechnungen an. Offen ${eine ? "bleibt die bereits gestellte Rechnung" : "bleiben die bereits gestellten Rechnungen"} — ${liste}${eine ? `, fällig am ${de(raten[0].faellig)}` : `, zusammen ${eur(summe)}`}. Sobald ${eine ? "diese Zahlung" : "diese Zahlungen"} bei uns verbucht ${eine ? "ist" : "sind"}, ist der Vertrag beendet und wir bestätigen Ihnen das schriftlich.`;
  return {
    vertrag_satz: vertragSatz,
    offen_satz: offenSatz,
    preheader_text: alt ? `Ihre Kündigung gilt zum Ende Ihres Abrechnungsmonats${ende ? ` (${de(ende)})` : ""} — offen ${eine ? "ist" : "sind"} nur noch ${liste.replace(/ \(fällig [^)]*\)/g, "")}.` : "Wir entlassen Sie vorzeitig aus dem Vertrag, sobald die offene Rechnung beglichen ist.",
    raten_text: eine ? `Rate ${raten[0].nr}` : `Raten ${raten.map((r) => r.nr).join(" und ")}`,
    rate_nr: raten.map((r) => r.nr).join(" und "),
    betrag: (summe / 100).toFixed(2),
    faellig_am_text: de(raten[raten.length - 1].faellig),
    verwendungszweck: raten[0].ref,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER GANZE VORGANG — EINE FUNKTION, VIER TÜREN (23.09.2026, E-213)
//
// Justin: „Wenn Florentine oder ich auf ‚kündigen‘ klicken, dann muss die
// Kündigung auch WIRKLICH durchgeführt werden … der gesamte Prozess eben."
//
// ── WARUM DAS NÖTIG WURDE ─────────────────────────────────────────────────
// Eine Kündigung kann heute an VIER Stellen ausgesprochen werden: in der Akte
// durch den Betreuer, im Postfach durch die Leitung, in der Telefonkartei als
// Storno und über die Admin-Route. Jede Stelle hat sich ihren Ablauf selbst
// zusammengesetzt — die eine schickte die Mail, die andere nicht, die dritte
// schrieb ins Protokoll, die vierte (PATCH /admin/cancellations/:id) setzte
// nur den Antragsstatus und ließ den Vertrag unberührt. Genau der Fehler, gegen
// den E-092 gebaut wurde, hat an dieser einen Tür überlebt.
//
// Ab jetzt gibt es EINEN Vorgang. Wer kündigt, ruft ihn auf; was er tut, steht
// hier und nirgends sonst:
//   1. Wirkung setzen (kuendigungSetzen — letzte Rate bleibt, Rest entfällt)
//   2. Urkunde ausfertigen, gezeichnet von dem, der gekündigt hat
//   3. Bestätigung an den Kunden
//   4. Den Kündigungsantrag im Formular-Topf schließen
//   5. Alles in den Verlauf des Kunden
//
// Scheitert Schritt 2 oder 3, scheitert NICHT die Kündigung: Die Wirkung steht
// schon in der Datenbank, und ein fehlendes Blatt Papier darf sie nicht
// rückgängig machen. Was nicht klappte, steht in der Antwort — nicht im Log.
// ═══════════════════════════════════════════════════════════════════════════
export interface DurchfuehrenOptionen {
  quelle: KuendigungQuelle;
  grund?: string | null;
  sofort?: boolean;
  am?: string | null;
  postmeisterId?: number | null;
  /** Wer zeichnet. Ohne Angabe die Gesellschaft selbst. */
  unterzeichner?: { name: string; rolle: string; agentId?: number | null };
  /** Für den Verlauf des Kunden. */
  personId?: number | null;
  /** false = keine Bestätigungsmail (nur für Proben und Altbestand-Läufe). */
  mail?: boolean;
}

export async function kuendigungDurchfuehren(ref: string, opts: DurchfuehrenOptionen): Promise<any> {
  const zeichner = opts.unterzeichner ?? { name: "FIAON LTD", rolle: "Geschäftsführung" };
  const erg = await kuendigungSetzen(ref, {
    quelle: opts.quelle, grund: opts.grund ?? null, am: opts.am ?? null,
    postmeisterId: opts.postmeisterId ?? null, sofort: opts.sofort === true,
  });
  if (!erg.ok) return { ...erg, urkunde: false, mailGesendet: false };

  let urkunde = false; let urkundeFehler: string | null = null;
  let mailGesendet = false;
  if (erg.weg !== "bereits") {
    const u = await urkundeAusfertigen(ref, zeichner).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    urkunde = u.ok === true;
    urkundeFehler = u.ok ? null : ((u as any).error ?? "unbekannt");
    if (opts.mail !== false) mailGesendet = await bestaetigungSenden(ref).catch(() => false);
  }

  // Der Antrag im Formular-Topf ist damit erledigt — sonst liegt er weiter
  // als „offen" in der Liste, obwohl der Vertrag längst gekündigt ist.
  await sqlPool`
    UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(),
           admin_note = COALESCE(admin_note, '') || ${` [durch ${zeichner.name} bestätigt]`}
     WHERE ref = ${ref} AND status = 'pending'`.catch(() => {});

  if (opts.personId) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${opts.personId}, ${opts.unterzeichner?.agentId ?? null}, ${zeichner.name}, 'system',
              ${`Kündigung durchgeführt (${erg.weg}${opts.sofort ? ", Kulanz sofort" : ""}). Grund: ${String(opts.grund ?? "").slice(0, 200)}. Urkunde: ${urkunde ? "ausgefertigt" : "FEHLT"}. Bestätigungsmail: ${mailGesendet ? "gesendet" : "nicht gesendet"}.`}, NOW())`.catch(() => {});
  }
  return { ...erg, urkunde, urkundeFehler, mailGesendet };
}

// WICHTIG: Diese Route steht VOR `/admin/kuendigung/:ref` — sonst fängt der
// Platzhalter das Wort „altbestand" ab und sucht eine Bestellung mit diesem
// Namen (Fund im Praxistest, 02.09.2026).
/**
 * POST /admin/kuendigung/altbestand {schreiben:false, mail:false}
 * Die offenen Anträge nach der neuen Regel abarbeiten. Vorschau zeigt BEIDE
 * Summen: was fällig bleibt und was entfällt — Justin entscheidet mit Zahlen.
 */
router.post("/admin/kuendigung/altbestand", async (req: Request, res: Response) => {
  try {
    await kuendigungSpalten();
    const schreiben = req.body?.schreiben === true;
    const mailSenden = req.body?.mail === true;
    const deckel = Math.min(300, Math.max(1, Number(req.body?.deckel) || 300));
    const kandidaten = (await sqlPool`
      SELECT DISTINCT ON (c.ref) c.ref, c.created_at, c.reason
        FROM cancellation_requests c
        JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
       WHERE c.status = 'pending' AND a.gekuendigt_am IS NULL
       ORDER BY c.ref, c.created_at ASC
    `) as any[];
    const ergebnisse: any[] = [];
    let bleibtCents = 0, entfaelltCents = 0, mails = 0;
    for (const k of kandidaten.slice(0, deckel)) {
      const erg = await kuendigungSetzen(k.ref, {
        quelle: "altbestand", grund: k.reason ?? null, am: k.created_at, probe: !schreiben,
      }).catch((e) => ({ ok: false, ref: k.ref, weg: "unbekannt", grund: String(e).slice(0, 120) } as any));
      if (erg.letzteRateBetragCents) bleibtCents += Number(erg.letzteRateBetragCents);
      if (erg.stornierteRaten) {
        const [s] = (await sqlPool`
          SELECT COALESCE(SUM(betrag_cents), 0)::int AS c FROM fiaon_abo_raten
           WHERE ref = ${k.ref} AND rate_nr > ${erg.letzteRateNr ?? 0} AND status IN ('offen', 'storniert')
        `) as any[];
        entfaelltCents += Number(s?.c || 0);
      }
      if (schreiben && erg.ok) {
        // Den Formular-Topf mitziehen — sonst zeigt die alte Liste weiter „offen".
        await sqlPool`
          UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(),
                 admin_note = COALESCE(admin_note, '') || ' [E-092 nach neuer Regel bearbeitet]'
           WHERE ref = ${k.ref} AND status = 'pending'
        `.catch(() => {});
      }
      if (schreiben && mailSenden && erg.ok) { if (await bestaetigungSenden(k.ref).catch(() => false)) mails += 1; }
      ergebnisse.push({ ref: k.ref, weg: erg.weg, letzteRate: erg.letzteRateNr, storniert: erg.stornierteRaten, grund: erg.grund });
    }
    const jeWeg: Record<string, number> = {};
    for (const e of ergebnisse) jeWeg[e.weg] = (jeWeg[e.weg] || 0) + 1;
    res.json({
      ok: true, schreiben, mailSenden, kandidaten: kandidaten.length, bearbeitet: ergebnisse.length, jeWeg,
      forderungBleibtEuro: Math.round(bleibtCents) / 100,
      forderungEntfaelltEuro: Math.round(entfaelltCents) / 100,
      mails, beispiele: ergebnisse.slice(0, 10),
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] altbestand:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** POST /admin/kuendigung/:ref — Kündigung setzen (idempotent). */
router.post("/admin/kuendigung/:ref", async (req: Request, res: Response) => {
  try {
    const quelle = QUELLEN.includes(req.body?.quelle) ? req.body.quelle as KuendigungQuelle : "admin";
    // Die Probe bleibt die Probe: kuendigungSetzen selbst, nichts weiter.
    if (req.body?.probe === true) {
      res.json(await kuendigungSetzen(String(req.params.ref), {
        quelle, grund: req.body?.grund ?? null, am: req.body?.am ?? null,
        postmeisterId: req.body?.postmeisterId ?? null, probe: true,
      }));
      return;
    }
    res.json(await kuendigungDurchfuehren(String(req.params.ref), {
      quelle, grund: req.body?.grund ?? null, am: req.body?.am ?? null,
      postmeisterId: req.body?.postmeisterId ?? null, mail: req.body?.mail !== false,
    }));
  } catch (e: any) {
    console.error("[KÜNDIGUNG] setzen:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** POST /admin/kuendigung/:ref/zuruecknehmen */
router.post("/admin/kuendigung/:ref/zuruecknehmen", async (req: Request, res: Response) => {
  try {
    // E-213: Ohne Kündigung keine Urkunde — ein Dokument über einen Zustand,
    // den es nicht mehr gibt, ist schlimmer als gar keines.
    await urkundeVerwerfen(String(req.params.ref));
    res.json(await kuendigungZuruecknehmen(String(req.params.ref), req.body?.grund ?? null));
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG FÜR JEDEN MITARBEITER (07.09.2026, Justin: „für jeden Mitarbeiter
// freischalten, dass man Kündigungen durchsetzen kann … aber auch im Gespräch
// eine Kündigung reaktivieren kann — zentral und überall")
//
// Dieselbe Regel wie im Chefbüro und bei Mara: kuendigungSetzen /
// kuendigungZuruecknehmen aus server/lib/fiaon-kuendigung.ts. Der Betreuer
// entscheidet nichts Neues — er löst dieselbe Kette aus (Zahlungsmails enden,
// Bestätigungsmail geht raus, Raten nach der letzten entfallen) und kann sie
// im Gespräch genauso wieder zurücknehmen (Raten kommen zurück, Konto läuft).
// Tür: requireAgent + darfAnKunde. Quelle „telefon".
// ═══════════════════════════════════════════════════════════════════════════
async function bestellungFuerAgent(req: AgentRequest, res: Response): Promise<{ ref: string; personId: number } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isFinite(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Ungültige Kundenkennung." }); return null; }
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." }); return null; }
  const [a] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL
      AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
  if (!a) { res.status(404).json({ ok: false, error: "Keine Paketbestellung zu diesem Kunden." }); return null; }
  return { ref: String(a.ref), personId };
}

/** GET /agent/kunden/:personId/kuendigung — Stand des Vertrags für die Akte. */
router.get("/agent/kunden/:personId/kuendigung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const [a] = (await sqlPool`
      SELECT ref, payment_status, pack_name, gekuendigt_am, kuendigung_quelle, kuendigung_grund, letzte_rate_nr,
             vertrag_ende_am, kuendigung_zurueckgenommen_am, kuendigung_bestaetigt_mail_am, kuendigung_rueckhol_bis,
             (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = fiaon_applications.ref AND r.status = 'offen') AS offene_raten
      FROM fiaon_applications WHERE ref = ${b.ref} LIMIT 1`) as any[];
    const gekuendigt = !!a.gekuendigt_am;
    res.json({
      ok: true, ref: a.ref, bezahlt: String(a.payment_status) === "paid", paket: a.pack_name ? String(a.pack_name).split("\n")[0] : null,
      gekuendigt, gekuendigtAm: a.gekuendigt_am, quelle: a.kuendigung_quelle, grund: a.kuendigung_grund,
      letzteRateNr: a.letzte_rate_nr, vertragEndeAm: a.vertrag_ende_am, zurueckgenommenAm: a.kuendigung_zurueckgenommen_am,
      bestaetigungsmailAm: a.kuendigung_bestaetigt_mail_am, rueckholBis: a.kuendigung_rueckhol_bis, offeneRaten: Number(a.offene_raten || 0),
      beendet: !!a.vertrag_ende_am && new Date(a.vertrag_ende_am).getTime() <= Date.now(),
      // E-213: Liegt die Urkunde vor, und wer hat sie gezeichnet?
      urkunde: gekuendigt ? await urkundeStand(b.ref) : { da: false, von: null, rolle: null, am: null, hash: null },
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent stand:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/kunden/:personId/kuendigung { grund, sofort? } — Kündigung durchsetzen. */
router.post("/agent/kunden/:personId/kuendigung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte den Grund in einem Satz — er steht dauerhaft am Kunden." });
    const sofort = req.body?.sofort === true;
    // E-213: EIN Vorgang für alle vier Türen — siehe kuendigungDurchfuehren.
    const erg = await kuendigungDurchfuehren(b.ref, {
      quelle: "telefon",
      grund: `${grund} (${req.agent!.name})`,
      sofort,
      personId: b.personId,
      unterzeichner: { name: req.agent!.name, rolle: rolleInWorten((req.agent as any)?.rolle), agentId: req.agent!.id },
    });
    res.json(erg);
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent setzen:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/kunden/:personId/kuendigung/zuruecknehmen { grund } — im Gespräch reaktiviert. */
router.post("/agent/kunden/:personId/kuendigung/zuruecknehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz festhalten, was der Kunde gesagt hat." });
    const [a] = (await sqlPool`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${b.ref}`) as any[];
    if (!a?.gekuendigt_am) return res.status(409).json({ ok: false, error: "Es liegt keine Kündigung vor." });
    if (String(a.payment_status) === "cancelled") {
      // Unbezahlte Bestellung war storniert — zurück auf „Zahlung offen", damit der Weg wieder läuft.
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'pending_payment', cancelled_at = NULL, mahnstopp_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`;
    }
    await urkundeVerwerfen(b.ref); // E-213
    const erg = await kuendigungZuruecknehmen(b.ref, `${grund} (${req.agent!.name}, Gespräch)`);
    await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = NULL, kuendigung_bestaetigt_mail_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`.catch(() => {});
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${b.ref}, ${b.personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Kündigung im Gespräch zurückgenommen durch ${req.agent!.name} — Konto läuft weiter, ${erg.ratenZurueck} Rate(n) wieder offen. ${grund.slice(0, 200)}`}, NOW())`.catch(() => {});
    res.json({ ok: true, ratenZurueck: erg.ratenZurueck, meldung: `Kündigung zurückgenommen — das Konto läuft weiter${erg.ratenZurueck ? `, ${erg.ratenZurueck} Rate(n) wieder offen` : ""}.` });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent zurücknehmen:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/kuendigungen — alle Quellen an einem Ort. */
router.get("/admin/kuendigungen", async (req: Request, res: Response) => {
  try {
    await kuendigungSpalten();
    const offen = String(req.query.status || "offen") !== "alle";
    const zeilen = (await sqlPool`
      WITH quellen AS (
        SELECT c.ref, 'formular' AS quelle, c.created_at AS am, c.reason AS grund, c.status AS antrag_status
          FROM cancellation_requests c WHERE c.ref IS NOT NULL
        UNION ALL
        SELECT pm.ref, 'mail' AS quelle, pm.empfangen_am AS am, LEFT(COALESCE(pm.begruendung, pm.betreff), 200), NULL
          FROM fiaon_postmeister pm WHERE pm.kategorie = 'kuendigung' AND pm.ref IS NOT NULL
      ), gebuendelt AS (
        SELECT ref, MIN(am) AS erste_meldung, string_agg(DISTINCT quelle, '+') AS quellen,
               (array_agg(grund ORDER BY am DESC))[1] AS grund,
               bool_or(antrag_status = 'pending') AS antrag_offen
          FROM quellen GROUP BY ref
      )
      SELECT g.ref, g.erste_meldung, g.quellen, g.grund, g.antrag_offen,
             a.first_name, a.last_name, a.email, a.payment_status, a.pack_name, a.person_id,
             a.gekuendigt_am, a.letzte_rate_nr, a.vertrag_ende_am, a.kuendigung_bestaetigt_mail_am,
             (SELECT COUNT(*) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS raten_offen,
             (SELECT COALESCE(SUM(r.betrag_cents), 0) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS offen_cents,
             (SELECT MAX(r.mahnstufe) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS mahnstufe
        FROM gebuendelt g
        JOIN fiaon_applications a ON a.ref = g.ref AND a.merged_into IS NULL
       WHERE ${offen ? sqlPool`a.gekuendigt_am IS NULL` : sqlPool`TRUE`}
       ORDER BY g.erste_meldung DESC LIMIT 300
    `) as any[];
    res.json({
      ok: true, offen,
      anzahl: zeilen.length,
      summeOffenEuro: Math.round(zeilen.reduce((s, z) => s + Number(z.offen_cents || 0), 0)) / 100,
      zeilen: zeilen.map((z) => ({
        ref: z.ref, quellen: z.quellen, erste_meldung: z.erste_meldung, grund: z.grund,
        name: [z.first_name, z.last_name].filter(Boolean).join(" "), email: z.email,
        payment_status: z.payment_status, paket: z.pack_name ? String(z.pack_name).split("\n")[0] : null,
        person_id: z.person_id, gekuendigt_am: z.gekuendigt_am, letzte_rate_nr: z.letzte_rate_nr,
        vertrag_ende_am: z.vertrag_ende_am, bestaetigt_am: z.kuendigung_bestaetigt_mail_am,
        raten_offen: z.raten_offen, offen_euro: Number(z.offen_cents || 0) / 100, mahnstufe: z.mahnstufe,
      })),
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] liste:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE URKUNDE HERUNTERLADEN (23.09.2026, E-213)
//
// Drei Türen auf dasselbe Dokument: Mitarbeiter (nur eigene Kunden), Leitung
// und Geschäftsführung. Ausgeliefert wird immer die GESPEICHERTE Ausfertigung —
// nie eine frisch gerechnete, sonst stimmte die Prüfsumme nicht mehr.
//
// Fehlt die Urkunde, weil die Kündigung vor dem 23.09.2026 ausgesprochen wurde
// oder das Rendern damals scheiterte, wird sie beim ersten Abruf nachgeholt und
// auf den Abrufenden gezeichnet. Eine Kündigung ohne Papier bleibt sonst für
// immer ohne Papier.
// ═══════════════════════════════════════════════════════════════════════════
function pdfAusliefern(res: Response, pdf: Buffer, dateiname: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${dateiname}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.end(pdf);
}

router.get("/agent/kunden/:personId/kuendigung.pdf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const erg = await urkundeAusfertigen(b.ref, {
      name: req.agent!.name, rolle: rolleInWorten((req.agent as any)?.rolle), agentId: req.agent!.id,
    });
    if (!erg.ok || !erg.pdf) return res.status(409).json({ ok: false, error: erg.error ?? "Keine Urkunde." });
    pdfAusliefern(res, erg.pdf, erg.dateiname!);
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent pdf:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/kuendigung/:ref.pdf", async (req: Request, res: Response) => {
  try {
    const erg = await urkundeAusfertigen(String(req.params.ref), { name: "FIAON LTD", rolle: "Geschäftsführung" });
    if (!erg.ok || !erg.pdf) return res.status(409).json({ ok: false, error: erg.error ?? "Keine Urkunde." });
    pdfAusliefern(res, erg.pdf, erg.dateiname!);
  } catch (e: any) {
    console.error("[KÜNDIGUNG] admin pdf:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
