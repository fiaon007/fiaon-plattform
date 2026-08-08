// ═══════════════════════════════════════════════════════════════════════════
// FIAON Verbuchung — /admin/verbuchung
//
// Der Kontoabgleich zeigt alle Bankeingänge. Diese Seite zeigt nur die, bei
// denen etwas zu ENTSCHEIDEN ist, und sagt vor dem Klick, was passiert.
//
// GRUNDREGEL: Es entsteht KEIN zweiter Buchungspfad. Gebucht wird ausschliesslich
// über `applyTxn` aus fiaon-reconcile.ts, das seinerseits identisch zum
// Admin-Button „bezahlt" arbeitet (Status + Freischaltung, Dubletten superseden,
// payment_confirmed-Mail mit 1×-Claim, Provisionshook onCustomerPaid).
//
// VIER TABS, VIER SACHVERHALTE
//   1 verbuchen    Geld da, Bestellung offen → echte Buchung
//   2 zuordnung    Geld da, aber auf der falschen von mehreren gleichen
//                  Bestellungen; die richtige ist längst bezahlt → nur die
//                  Bank-Zuordnung korrigieren, NICHT buchen
//   3 stillgelegt  Bestellungen, die `supersedeSisterOrders` vor dem Produkt-Fix
//                  fälschlich totgelegt hat → Reaktivierung anbieten
//   4 ohne         Eingänge ohne Zuordnung → Person suchen, dann Tab 1
//
// Die Einteilung ist REGELBASIERT. Es stehen keine IDs im Code: sobald ein Fall
// gebucht ist, verschwindet er von selbst, und neue Fälle erscheinen von selbst.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { applyTxn, payerMatchesCustomer } from "./fiaon-reconcile";
import { ermittleProvisionsAnspruch, getSettings } from "./fiaon-agent";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// ABGESCHALTET (05.08.2026)
//
// Diese Seite war die Nacharbeit zum Kontoabgleich: Bankeingänge, bei denen noch
// etwas zu entscheiden war. Der Kontoabgleich ist seit dem 04.08. abgeschaltet
// (Zahlungen werden manuell in der Zahlungszentrale gebucht), und die offenen
// Altfälle sind abgearbeitet — geprüft am 05.08.: 262 Bankeingänge, 211 verbucht,
// 0 zugeordnet-aber-offen. Damit hat die Seite keine Arbeit mehr zu zeigen.
//
// Der Code bleibt vollständig stehen und `fiaon_bank_txns` bleibt unangetastet:
// Buchhaltungshistorie. Zurückschalten ist eine Einstellung —
// `verbuchung_enabled` auf 'true'. Dasselbe Muster wie `kartei_enabled` und
// `kontoabgleich_enabled`; 410 Gone und nicht 404, weil diese Endpunkte
// existiert haben und bewusst abgeschaltet sind.
// ═══════════════════════════════════════════════════════════════════════════
export async function verbuchungAktiv(): Promise<boolean> {
  try {
    const s = await getSettings();
    return String(s.verbuchung_enabled ?? "false").toLowerCase() === "true";
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] verbuchung_enabled nicht lesbar — bleibt abgeschaltet:", err);
    return false;
  }
}

router.use(async (req: Request, res: Response, next) => {
  if (!req.path.includes("/verbuchung")) return next();
  if (await verbuchungAktiv()) return next();
  return res.status(410).json({
    ok: false,
    error: "Die Verbuchungs-Seite ist abgeschaltet. Zahlungen werden in der Zahlungszentrale gebucht.",
    ersetztDurch: "/admin/zahlungen",
    einstellung: "verbuchung_enabled",
    hinweis: "Die Buchhaltungshistorie (fiaon_bank_txns) bleibt vollständig erhalten.",
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Hilfsabfragen
// ───────────────────────────────────────────────────────────────────────────

/**
 * Stufenpaket oder Zusatzprodukt?
 *
 * Dieselbe Marke, die `supersedeSisterOrders` und `isAddonOrderRow` benutzen:
 * `type='schufa'` bzw. das `FIAON-SCHUFA-`-Präfix. Bewusst NICHT `pack_name` —
 * derselbe Tarif existiert im Bestand unter zwei Schreibweisen („FIAON Pro“ und
 * „FIAON Pro | (Standard)“), ein Namensvergleich wäre unzuverlässig.
 */
function istZusatzprodukt(row: any): boolean {
  return (
    String(row?.type || "").toLowerCase() === "schufa" ||
    String(row?.ref || "").startsWith("FIAON-SCHUFA-")
  );
}

/**
 * Sucht die bezahlte Schwester-Bestellung DERSELBEN KATEGORIE.
 *
 * Das ist der Kern der Unterscheidung zwischen Tab 1 und Tab 2: Existiert sie,
 * hat der Kunde dieses Produkt schon — das Geld ist verbucht und nur falsch
 * verknüpft. Existiert sie nicht, ist das Geld echt unverbucht.
 *
 * Kategorie statt Produktname, weil ein Kunde nur EINE Kontostufe haben kann:
 * Wer Ultra bezahlt hat, braucht seine Pro-Bestellung nicht mehr.
 *
 * Familie über E-Mail ODER person_id — E-Mail, weil `supersedeSisterOrders`
 * danach arbeitet; person_id zusätzlich, weil sie stabiler ist und bei einigen
 * Fällen die E-Mail fehlt.
 */
async function bezahlterZwilling(app: any): Promise<any | null> {
  const zusatz = istZusatzprodukt(app);
  const rows = await sqlPool`
    SELECT ref, payment_reference, amount_due, created_at, pack_name
    FROM fiaon_applications
    WHERE merged_into IS NULL
      AND payment_status = 'paid'
      AND ref <> ${app.ref}
      AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') = ${zusatz}
      AND (
        (${app.email || null}::text IS NOT NULL AND ${app.email || null}::text <> ''
         AND LOWER(TRIM(email)) = LOWER(TRIM(${app.email || ""})))
        OR (${app.person_id || null}::int IS NOT NULL AND person_id = ${app.person_id || null}::int)
      )
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows.length ? rows[0] : null;
}

/** Geschwister, die eine Buchung NACH dem Kategorie-Fix stilllegen würde. */
async function wuerdeStilllegen(app: any): Promise<any[]> {
  if (!app?.email) return [];
  const zusatz = istZusatzprodukt(app);
  return await sqlPool`
    SELECT ref, payment_reference, pack_name, amount_due, payment_status
    FROM fiaon_applications
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(${app.email}))
      AND ref <> ${app.ref}
      AND merged_into IS NULL
      AND payment_status IN ('pending_payment', 'claimed_paid')
      AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') = ${zusatz}
  `;
}

// ───────────────────────────────────────────────────────────────────────────
// GET /admin/verbuchung/uebersicht — alle vier Tabs in einem Zug
// ───────────────────────────────────────────────────────────────────────────
router.get("/admin/verbuchung/uebersicht", async (_req: Request, res: Response) => {
  try {
    // ── Eingänge mit Zuordnung, noch nicht verbucht, Bestellung nicht bezahlt ──
    const offeneEingaenge = await sqlPool`
      SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.currency, t.payer_name,
             t.reference_raw, t.matched_ref, t.match_status, t.amount_ok,
             a.ref, a.payment_reference, a.payment_status, a.amount_due, a.pack_name,
             a.email, a.person_id, a.created_at, a.assigned_agent_id, a.superseded_by,
             a.confirmed_email_sent_at, a.type,
             -- Zahlungsbeleg (08.08.2026): Wer bucht, sieht Bankeingang UND
             -- Beleg nebeneinander. Die Bytes bleiben draußen — hier zählt nur,
             -- OB einer vorliegt und mit welchem Datum.
             (a.payment_proof IS NOT NULL) AS beleg_da, a.payment_proof_date,
             a.payment_proof_note, a.payment_proof_by, a.payment_proof_at,
             a.payment_proof_typ, a.payment_proof_bytes,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      a.contact_name, a.email) AS kundenname
      FROM fiaon_bank_txns t
      JOIN fiaon_applications a ON a.ref = t.matched_ref AND a.merged_into IS NULL
      WHERE t.applied = FALSE
        AND t.match_status IN ('matched', 'manual')
        AND a.payment_status <> 'paid'
      ORDER BY t.booked_at ASC, t.id ASC
    `;

    const verbuchen: any[] = [];
    const zuordnung: any[] = [];

    for (const e of offeneEingaenge as any[]) {
      const zwilling = e.payment_status === "superseded" ? await bezahlterZwilling(e) : null;
      const einzahlerWeichtAb =
        e.payer_name && e.kundenname ? !payerMatchesCustomer(e.payer_name, e.kundenname) : false;

      const basis = {
        id: e.id,
        txnId: e.txn_id,
        gebuchtAm: e.booked_at,
        eingangCents: Number(e.amount_cents),
        waehrung: e.currency,
        einzahler: e.payer_name,
        verwendungszweck: e.reference_raw,
        ref: e.ref,
        zahlungsreferenz: e.payment_reference,
        kundenname: e.kundenname,
        produkt: e.pack_name ? String(e.pack_name).split("\n")[0].trim() : null,
        sollCents: e.amount_due != null ? Math.round(Number(e.amount_due) * 100) : null,
        bestellstatus: e.payment_status,
        betragOk: e.amount_ok !== false,
        einzahlerWeichtAb,
        personId: e.person_id,
        beleg: e.beleg_da
          ? {
              vorhanden: true,
              datum: e.payment_proof_date ? new Date(e.payment_proof_date).toISOString().slice(0, 10) : null,
              notiz: e.payment_proof_note ?? null,
              von: e.payment_proof_by ?? null,
              am: e.payment_proof_at ?? null,
              typ: e.payment_proof_typ ?? null,
              bytes: e.payment_proof_bytes != null ? Number(e.payment_proof_bytes) : null,
              /** Anzeige-Adresse; die Datei liegt an der Bestellung. */
              url: `/api/fiaon/admin/antraege/${encodeURIComponent(String(e.ref))}/zahlungsbeleg`,
            }
          : { vorhanden: false },
      };

      if (zwilling) {
        // Tab 2: Der Kunde hat dieses Produkt bereits bezahlt. Buchen wäre
        // falsch — die Zuordnung ist das Problem.
        zuordnung.push({
          ...basis,
          zielRef: zwilling.ref,
          zielZahlungsreferenz: zwilling.payment_reference,
          zielProdukt: zwilling.pack_name ? String(zwilling.pack_name).split("\n")[0].trim() : null,
          begruendung:
            "Der Kunde hat dieses Produkt bereits bezahlt. " +
            "Es wird nur die Bank-Zuordnung korrigiert — keine Buchung, keine Mail, keine Provision.",
        });
      } else {
        // Tab 1: echte Buchung. Bei `superseded` ohne bezahlten Zwilling wird auf
        // die stillgelegte Bestellung selbst gebucht — sie ist das einzige Ziel.
        const phantom =
          e.payment_status === "superseded" && e.superseded_by
            ? !(
                await sqlPool`
                  SELECT 1 FROM fiaon_applications
                  WHERE payment_reference = ${e.superseded_by} OR ref = ${e.superseded_by} LIMIT 1
                `
              ).length
            : false;
        verbuchen.push({
          ...basis,
          zielRef: e.ref,
          nachFristablauf: e.payment_status === "expired",
          phantomSuperseded: phantom,
          phantomZeiger: phantom ? e.superseded_by : null,
        });
      }
    }

    // ── Tab 3: fälschlich stillgelegte Bestellungen ──────────────────────────
    //
    // Klassifikation über die KATEGORIE der auslösenden Bestellung:
    //   gleiche_kategorie  Dublette oder Stufen-Upgrade → Stilllegung war richtig
    //   andere_kategorie   Zusatzprodukt gegen Stufenpaket → war ein Fehler
    //   phantom            Zeiger führt ins Leere → nicht nachvollziehbar
    //
    // Zeilen mit noch offenem Bankeingang bleiben aussen vor: die stehen in
    // Tab 1 und wollen verbucht werden, nicht reaktiviert. Zwei widersprüchliche
    // Aktionen für eine Bestellung wären eine Falle.
    const stillgelegt = await sqlPool`
      SELECT a.ref, a.payment_reference, a.pack_name, a.amount_due, a.created_at,
             a.superseded_by, a.person_id, a.email, a.assigned_agent_id, a.type,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      a.contact_name, a.email) AS kundenname,
             s.ref AS ausloeser_ref, s.pack_name AS ausloeser_produkt,
             CASE
               WHEN s.ref IS NULL THEN 'phantom'
               WHEN (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
                  = (COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
                 THEN 'gleiche_kategorie'
               ELSE 'andere_kategorie'
             END AS klassifikation
      FROM fiaon_applications a
      LEFT JOIN fiaon_applications s
        ON (s.payment_reference = a.superseded_by OR s.ref = a.superseded_by)
      WHERE a.payment_status = 'superseded'
        AND a.merged_into IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied = FALSE
        )
      ORDER BY a.created_at ASC
    `;

    const stillgelegtAngereichert = [];
    for (const s of stillgelegt as any[]) {
      // Bezahlte Geschwister zeigen dem Admin, was der Kunde wirklich hat — und
      // entscheiden mit über die Reaktivierbarkeit.
      const geschwister = await sqlPool`
        SELECT ref, pack_name, amount_due,
               (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') AS ist_zusatz
        FROM fiaon_applications
        WHERE merged_into IS NULL AND ref <> ${s.ref} AND payment_status = 'paid'
          AND (
            (${s.email || null}::text IS NOT NULL AND ${s.email || null}::text <> ''
             AND LOWER(TRIM(email)) = LOWER(TRIM(${s.email || ""})))
            OR (${s.person_id || null}::int IS NOT NULL AND person_id = ${s.person_id || null}::int)
          )
        ORDER BY created_at ASC
      `;
      const selbstZusatz = istZusatzprodukt(s);
      const gleicheKategorieBezahlt = (geschwister as any[]).filter((g) => g.ist_zusatz === selbstZusatz);
      const falschStillgelegt = s.klassifikation === "andere_kategorie" || s.klassifikation === "phantom";

      // Zwei Bedingungen, beide nötig: Die Stilllegung muss falsch gewesen sein
      // UND dem Kunden muss dieses Produkt tatsächlich noch fehlen. Wer seine
      // Bonitätsauskunft inzwischen bezahlt hat, braucht die alte Zeile nicht
      // zurück — das wäre eine Doppelbestellung mit Mahnlauf.
      const reaktivierbar = falschStillgelegt && gleicheKategorieBezahlt.length === 0;
      const grund = !falschStillgelegt
        ? "Stilllegung war richtig: es wurde dieselbe Produktkategorie bezahlt (Dublette oder Stufen-Upgrade)."
        : gleicheKategorieBezahlt.length > 0
          ? `Der Kunde hat dieses Produkt inzwischen bezahlt (${gleicheKategorieBezahlt.map((g: any) => g.ref).join(", ")}) — es fehlt ihm nichts.`
          : "";

      stillgelegtAngereichert.push({
        ref: s.ref,
        zahlungsreferenz: s.payment_reference,
        kundenname: s.kundenname,
        personId: s.person_id,
        produkt: s.pack_name ? String(s.pack_name).split("\n")[0].trim() : null,
        kategorie: selbstZusatz ? "Zusatzprodukt" : "Stufenpaket",
        sollCents: s.amount_due != null ? Math.round(Number(s.amount_due) * 100) : null,
        angelegt: s.created_at,
        klassifikation: s.klassifikation,
        ausloeserRef: s.ausloeser_ref,
        ausloeserProdukt: s.ausloeser_produkt ? String(s.ausloeser_produkt).split("\n")[0].trim() : null,
        phantomZeiger: s.klassifikation === "phantom" ? s.superseded_by : null,
        reaktivierbar,
        grund,
        bezahlteGeschwister: (geschwister as any[]).map((g) => ({
          ref: g.ref,
          produkt: g.pack_name ? String(g.pack_name).split("\n")[0].trim() : null,
          sollCents: g.amount_due != null ? Math.round(Number(g.amount_due) * 100) : null,
        })),
      });
    }

    // ── Tab 4: Eingänge ohne Zuordnung ──────────────────────────────────────
    const ohneZuordnung = await sqlPool`
      SELECT id, txn_id, booked_at, amount_cents, currency, payer_name, reference_raw,
             extracted_ref, note
      FROM fiaon_bank_txns
      WHERE applied = FALSE AND match_status = 'unmatched'
      ORDER BY booked_at ASC, id ASC
    `;

    const summe = (rows: any[], feld = "eingangCents") =>
      rows.reduce((s, r) => s + Number(r[feld] || 0), 0);

    res.json({
      ok: true,
      tabs: {
        verbuchen: {
          zeilen: verbuchen,
          anzahl: verbuchen.length,
          summeCents: summe(verbuchen),
        },
        zuordnung: {
          zeilen: zuordnung,
          anzahl: zuordnung.length,
          summeCents: summe(zuordnung),
        },
        stillgelegt: {
          zeilen: stillgelegtAngereichert,
          anzahl: stillgelegtAngereichert.length,
          reaktivierbar: stillgelegtAngereichert.filter((s) => s.reaktivierbar).length,
        },
        ohneZuordnung: {
          zeilen: (ohneZuordnung as any[]).map((o) => ({
            id: o.id,
            txnId: o.txn_id,
            gebuchtAm: o.booked_at,
            eingangCents: Number(o.amount_cents),
            waehrung: o.currency,
            einzahler: o.payer_name,
            verwendungszweck: o.reference_raw,
            erkannteReferenz: o.extracted_ref,
            hinweis: o.note,
          })),
          anzahl: (ohneZuordnung as any[]).length,
          summeCents: (ohneZuordnung as any[]).reduce((s, o) => s + Number(o.amount_cents || 0), 0),
        },
      },
    });
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] uebersicht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /admin/verbuchung/vorschau/:id — was löst der Klick aus?
//
// Rein lesend. Die Provisionsfrage beantwortet `ermittleProvisionsAnspruch` —
// dieselbe Funktion, die `onCustomerPaid` benutzt. Damit kann die Vorschau nicht
// von der Wirklichkeit abweichen.
// ───────────────────────────────────────────────────────────────────────────
router.get("/admin/verbuchung/vorschau/:id", async (req: Request, res: Response) => {
  try {
    const [txn] = await sqlPool`
      SELECT id, txn_id, amount_cents, matched_ref, amount_ok, applied
      FROM fiaon_bank_txns WHERE id = ${Number(req.params.id)}
    `;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    if (!txn.matched_ref) return res.status(400).json({ ok: false, error: "Kein Kunde zugeordnet" });

    const [app] = await sqlPool`
      SELECT ref, payment_reference, pack_name, amount_due, payment_status, email,
             person_id, created_at, assigned_agent_id, confirmed_email_sent_at, type,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
                      contact_name, email) AS kundenname
      FROM fiaon_applications WHERE ref = ${txn.matched_ref} AND merged_into IS NULL
    `;
    if (!app) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });

    const zwilling = app.payment_status === "superseded" ? await bezahlterZwilling(app) : null;
    const geschwister = await wuerdeStilllegen(app);

    // Provision: bestehender positiver Eintrag verhindert jede weitere Buchung.
    const [vorhanden] = await sqlPool`
      SELECT id FROM fiaon_commissions
      WHERE ref = ${app.ref} AND amount_cents > 0 AND status != 'storniert' LIMIT 1
    `;
    let provision: any = { wirdGebucht: false, begruendung: "" };
    if (vorhanden) {
      provision = {
        wirdGebucht: false,
        begruendung: "Es existiert bereits eine bestätigte Provision — es wird keine zweite gebucht.",
      };
    } else {
      const anspruch = await ermittleProvisionsAnspruch(app as any);
      if (anspruch.agentId) {
        const [agent] = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${anspruch.agentId}`;
        provision = {
          wirdGebucht: true,
          agentId: anspruch.agentId,
          agentName: agent?.name || `#${anspruch.agentId}`,
          grundlage: anspruch.basisKind,
          begruendung: anspruch.basisNote,
        };
      } else {
        provision = {
          wirdGebucht: false,
          begruendung: "Kein dokumentierter Agenten-Kontakt vor der Zahlung → Direktzahler, keine Provision.",
        };
      }
    }

    // Mail: der 1×-Claim greift nur, wenn noch nie gesendet UND eine Adresse da ist.
    const mailMoeglich = !app.confirmed_email_sent_at && !!app.email;

    res.json({
      ok: true,
      vorschau: {
        art: zwilling ? "zuordnung_korrigieren" : "buchung",
        zielRef: zwilling ? zwilling.ref : app.ref,
        kundenname: app.kundenname,
        statuswechsel: zwilling
          ? "Keiner. Die Bestellung bleibt wie sie ist, nur der Bankeingang wird richtig verknüpft."
          : `${app.payment_status} → paid, Konto wird freigeschaltet`,
        betrag: {
          eingangCents: Number(txn.amount_cents),
          sollCents: app.amount_due != null ? Math.round(Number(app.amount_due) * 100) : null,
          weichtAb: txn.amount_ok === false,
        },
        geschwisterStillgelegt: zwilling
          ? []
          : (geschwister as any[]).map((g) => ({
              ref: g.ref,
              produkt: g.pack_name ? String(g.pack_name).split("\n")[0].trim() : null,
              sollCents: g.amount_due != null ? Math.round(Number(g.amount_due) * 100) : null,
              status: g.payment_status,
            })),
        mail: zwilling
          ? { wirdGesendet: false, begruendung: "Keine Buchung → keine Mail." }
          : {
              wirdGesendet: mailMoeglich,
              begruendung: mailMoeglich
                ? "Bestätigungsmail „payment_confirmed“ geht an den Kunden (einmalig)."
                : app.confirmed_email_sent_at
                  ? "Bestätigungsmail wurde bereits versendet — sie geht nicht erneut raus."
                  : "Keine E-Mail-Adresse hinterlegt — es kann keine Mail versendet werden.",
            },
        provision: zwilling
          ? { wirdGebucht: false, begruendung: "Keine Buchung → keine Provision." }
          : provision,
      },
    });
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /admin/verbuchung/:id/buchen — echte Buchung über den bestehenden Pfad
// ───────────────────────────────────────────────────────────────────────────
router.post("/admin/verbuchung/:id/buchen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const syncAmount = req.body?.syncAmount === true;

    const [txn] = await sqlPool`
      SELECT id, txn_id, matched_ref, applied FROM fiaon_bank_txns WHERE id = ${id}
    `;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    if (txn.applied) return res.status(400).json({ ok: false, error: "Eingang ist bereits verbucht" });
    if (!txn.matched_ref) return res.status(400).json({ ok: false, error: "Kein Kunde zugeordnet" });

    // Herkunft dokumentieren, BEVOR gebucht wird. Bricht die Buchung ab, ist
    // trotzdem nachvollziehbar, dass sie über den Batch angestossen wurde.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${txn.matched_ref}, NULL, 'Admin', 'system',
              ${`Verbuchung über die Verbuchungs-Seite angestossen (Quelle: kontoabgleich_batch, Wise-Transaktion ${txn.txn_id || "#" + id})`})
    `.catch(() => {});

    // Der bestehende Pfad. Kein Nachbau.
    const r = await applyTxn(id, syncAmount);
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, ref: r.ref });
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] buchen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /admin/verbuchung/:id/zuordnung-korrigieren
//
// Kein Statuswechsel, keine Mail, keine Provision. Der Bankeingang wird auf die
// bereits bezahlte Bestellung desselben Produkts umgehängt und als erledigt
// markiert — das Geld ist ja tatsächlich für sie eingegangen.
// ───────────────────────────────────────────────────────────────────────────
router.post("/admin/verbuchung/:id/zuordnung-korrigieren", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const zielRef = String(req.body?.zielRef || "").trim();
    if (!zielRef) return res.status(400).json({ ok: false, error: "Ziel-Referenz erforderlich" });

    const [txn] = await sqlPool`
      SELECT id, txn_id, matched_ref, amount_cents, applied FROM fiaon_bank_txns WHERE id = ${id}
    `;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    if (txn.applied) return res.status(400).json({ ok: false, error: "Eingang ist bereits verbucht" });

    const [ziel] = await sqlPool`
      SELECT ref, amount_due, payment_status FROM fiaon_applications
      WHERE ref = ${zielRef} AND merged_into IS NULL
    `;
    if (!ziel) return res.status(404).json({ ok: false, error: "Ziel-Bestellung nicht gefunden" });
    // Sicherung: Umhängen ist nur erlaubt, wenn das Ziel WIRKLICH bezahlt ist.
    // Sonst würde hier stillschweigend eine offene Bestellung als erledigt gelten.
    if (ziel.payment_status !== "paid") {
      return res.status(400).json({
        ok: false,
        error: "Ziel-Bestellung ist nicht bezahlt — eine Korrektur wäre hier falsch. Bitte regulär verbuchen.",
      });
    }

    const betragOk = Math.round(Number(ziel.amount_due || 0) * 100) === Number(txn.amount_cents);
    await sqlPool`
      UPDATE fiaon_bank_txns SET
        matched_ref = ${ziel.ref},
        match_status = 'manual',
        amount_ok = ${betragOk},
        applied = TRUE,
        applied_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
    `;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ziel.ref}, NULL, 'Admin', 'system',
              ${`Bank-Zuordnung korrigiert (Quelle: kontoabgleich_batch, Wise-Transaktion ${txn.txn_id || "#" + id}): Eingang lag auf der stillgelegten Bestellung ${txn.matched_ref} und gehört zu dieser bereits bezahlten Bestellung. Kein Statuswechsel, keine Mail, keine Provision.`})
    `.catch(() => {});
    console.log(`[FIAON-VERBUCHUNG] Zuordnung korrigiert: ${txn.matched_ref} → ${ziel.ref} (Bank ${txn.txn_id})`);
    res.json({ ok: true, zielRef: ziel.ref, betragOk });
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] zuordnung-korrigieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /admin/verbuchung/reaktivieren — fälschlich stillgelegte Bestellung
//
// Setzt auf `pending_payment` zurück. KEINE Mail: Die Ansprache übernehmen die
// Agenten. Die Person landet über das Tiering (`rechnung_offen`) regulär im Pool.
// ───────────────────────────────────────────────────────────────────────────
router.post("/admin/verbuchung/reaktivieren", async (req: Request, res: Response) => {
  try {
    const ref = String(req.body?.ref || "").trim();
    if (!ref) return res.status(400).json({ ok: false, error: "Referenz erforderlich" });

    const [app] = await sqlPool`
      SELECT a.ref, a.pack_name, a.payment_status, a.superseded_by, a.person_id,
             a.email, a.type,
             s.pack_name AS ausloeser_produkt, s.ref AS ausloeser_ref,
             (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%') AS ausloeser_ist_zusatz
      FROM fiaon_applications a
      LEFT JOIN fiaon_applications s
        ON (s.payment_reference = a.superseded_by OR s.ref = a.superseded_by)
      WHERE a.ref = ${ref} AND a.merged_into IS NULL
    `;
    if (!app) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    if (app.payment_status !== "superseded") {
      return res.status(400).json({ ok: false, error: "Bestellung ist nicht stillgelegt" });
    }

    // ── Zwei Sperren, die der Server selbst durchsetzt ──────────────────────
    // Die Oberfläche blendet solche Zeilen bereits aus. Trotzdem prüft der Server:
    // ein direkter Aufruf darf keine Doppelbestellung mit Mahnlauf erzeugen können.
    const selbstZusatz = istZusatzprodukt(app);

    // 1) Stilllegung war berechtigt — dieselbe Kategorie wurde bezahlt.
    //    Das ist eine Dublette oder ein Stufen-Upgrade.
    if (app.ausloeser_ref && app.ausloeser_ist_zusatz === selbstZusatz) {
      return res.status(400).json({
        ok: false,
        error: selbstZusatz
          ? "Der Kunde hat eine zweite Bonitätsauskunft bezahlt — diese Zeile ist eine echte Dublette und bleibt stillgelegt."
          : "Der Kunde hat ein anderes Stufenpaket bezahlt (Upgrade) — ein Konto hat genau eine Stufe. Die Zeile bleibt stillgelegt.",
      });
    }

    // 2) Dem Kunden fehlt nichts — er hat dieses Produkt inzwischen bezahlt.
    const bereitsBezahlt = await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE merged_into IS NULL AND payment_status = 'paid' AND ref <> ${ref}
        AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') = ${selbstZusatz}
        AND (
          (${app.email || null}::text IS NOT NULL AND ${app.email || null}::text <> ''
           AND LOWER(TRIM(email)) = LOWER(TRIM(${app.email || ""})))
          OR (${app.person_id || null}::int IS NOT NULL AND person_id = ${app.person_id || null}::int)
        )
      LIMIT 1
    `;
    if (bereitsBezahlt.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Der Kunde hat dieses Produkt inzwischen bezahlt (${bereitsBezahlt[0].ref}) — eine Reaktivierung würde eine Doppelbestellung samt Mahnlauf erzeugen.`,
      });
    }

    await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'pending_payment',
        superseded_by = NULL,
        updated_at = NOW()
      WHERE ref = ${ref}
    `;
    const grund = app.ausloeser_ref
      ? `wurde fälschlich durch die Bestellung ${app.ausloeser_ref} („${String(app.ausloeser_produkt || "").split("\n")[0].trim()}“) stillgelegt — eine andere Produktkategorie`
      : `wurde durch einen Zeiger auf „${app.superseded_by}“ stillgelegt, den es nicht gibt`;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'Admin', 'system',
              ${`Bestellung reaktiviert (Quelle: kontoabgleich_batch): Sie ${grund}. Der Kunde hat dieses Produkt bestellt und nie erhalten. Keine automatische Mail — Ansprache über den zuständigen Agenten.`})
    `.catch(() => {});
    console.log(`[FIAON-VERBUCHUNG] reaktiviert: ${ref} (${grund})`);
    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[FIAON-VERBUCHUNG] reaktivieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
