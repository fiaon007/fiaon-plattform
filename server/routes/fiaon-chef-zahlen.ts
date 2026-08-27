// ═══════════════════════════════════════════════════════════════════════════
// VERDIENST & WERT — die eine Wahrheit über das Geld (27.08.2026)
//
// Justin: „Das Admin Dashboard stimmt nicht, die Zahlen passen auf keinen
// Fall. Schau dir an was wir verdient haben, was wir monatlich verdienen
// (JEDES PAKET IST EIN 12-MONATS-ABO, also Umsatz = ×12) — und baue eine
// Unternehmensbewertung ein."
//
// ── WARUM DIE ALTEN ZAHLEN FALSCH WAREN ────────────────────────────────────
// Das alte Dashboard rechnete den Umsatz aus STRIPE-Kartenzahlungen
// (GET /admin/stripe/revenue zieht jede Charge einzeln aus der Stripe-API).
// FIAON kassiert aber seit Wochen per Banküberweisung — Stripe ist ein
// Altbestand von ein paar frühen Zahlungen. Das Dashboard zählte also fast
// nichts vom echten Geschäft und brauchte dafür auch noch 14 Sekunden.
//
// ── DIE REGELN DIESER ZAHLEN ───────────────────────────────────────────────
// · VERDIENT ist nur, was bankbestätigt im System gebucht ist: bezahlte
//   Raten (Rate 1 = Startzahlung; die Ketten sind seit dem 27.08. konsistent)
//   plus bezahlte Bonitätsauskünfte. Kein amount_due, kein „angekündigt".
// · Testkonten (FIAON-TEST-% und fiaon_persons.ist_test_am) zählen NIE mit —
//   der Fehler vom 26.08. (495,92 € zu viel) passiert nicht noch einmal.
// · MRR = Summe der Monatsraten aller AKTIVEN Abos (bezahlt, nicht gestoppt,
//   nicht storniert, nicht erstattet, keine Auskunfts-Bestellung).
// · Der VERTRAGSBESTAND rechnet ×12: Jedes aktive Abo steht für zwölf
//   Monatsraten. Vereinnahmt = seine bezahlten Raten; der Rest ist
//   vertraglich ausstehend. Beides wird GETRENNT gezeigt — eingegangenes
//   Geld und Vertragswert in einen Topf zu werfen wäre die nächste falsche
//   Zahl.
// · Die BEWERTUNG ist ein interner Richtwert über ARR-Vielfache — mit
//   offener Methodik, keine Anlageberatung.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";

const router = Router();

/** Echte Kunden: keine Prüfstand-Referenzen, keine als Test markierten Personen. */
const ECHT = `a.ref NOT LIKE 'FIAON-TEST%' AND COALESCE(p.ist_test_am IS NOT NULL, FALSE) = FALSE`;

// ═══════════════════════════════════════════════════════════════════════════
// DER EINE UMSATZ-BAUSTEIN (27.08.2026, Justins Regel: „ALLE ZAHLEN MÜSSEN
// IMMER PASSEN")
//
// Das Lagezimmer rechnete nur Raten (ohne Bonitätsauskünfte) mit eigenem
// Filter — der Wert-Raum rechnete beides. Juli hieß auf der einen Seite
// 13.730 €, auf der anderen 15.506 €. Zwei Wahrheiten sind eine zu viel:
// JEDER Umsatzwert im Chefbüro kommt ab jetzt aus DIESER Funktion.
// Umsatz = bezahlte Raten + bezahlte Bonitätsauskünfte, Testkonten nie.
// ═══════════════════════════════════════════════════════════════════════════
export async function umsatzBausteine(): Promise<{
  heuteCents: number; wocheCents: number; monatCents: number;
  vormonatCents: number; jahrCents: number; gesamtCents: number;
  verlauf: { monat: string; ratenCents: number; auskunftCents: number; zahlungen: number }[];
}> {
  const QUELLE = `
    SELECT r.betrag_cents AS cents, r.bezahlt_am AS am, 'rate' AS art
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
       AND a.merged_into IS NULL AND ${ECHT}
    UNION ALL
    SELECT ROUND(a.amount_due * 100)::int, COALESCE(a.paid_at, a.completed_at), 'auskunft'
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND a.ref LIKE 'FIAON-SCHUFA-%' AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
       AND ${ECHT}`;

  const [summen] = (await sqlPool.unsafe(`
    WITH q AS (${QUELLE})
    SELECT
      COALESCE(SUM(cents) FILTER (WHERE (am AT TIME ZONE 'Europe/Berlin')::date
        = (NOW() AT TIME ZONE 'Europe/Berlin')::date), 0)::bigint AS heute,
      COALESCE(SUM(cents) FILTER (WHERE am > NOW() - INTERVAL '7 days'), 0)::bigint AS woche,
      COALESCE(SUM(cents) FILTER (WHERE date_trunc('month', am AT TIME ZONE 'Europe/Berlin')
        = date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin')), 0)::bigint AS monat,
      COALESCE(SUM(cents) FILTER (WHERE date_trunc('month', am AT TIME ZONE 'Europe/Berlin')
        = date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin') - INTERVAL '1 month'), 0)::bigint AS vormonat,
      COALESCE(SUM(cents) FILTER (WHERE date_trunc('year', am AT TIME ZONE 'Europe/Berlin')
        = date_trunc('year', NOW() AT TIME ZONE 'Europe/Berlin')), 0)::bigint AS jahr,
      COALESCE(SUM(cents), 0)::bigint AS gesamt
    FROM q`)) as any[];

  const verlauf = (await sqlPool.unsafe(`
    WITH q AS (${QUELLE})
    SELECT to_char(date_trunc('month', am AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM') AS monat,
           COALESCE(SUM(cents) FILTER (WHERE art = 'rate'), 0)::bigint AS raten_cents,
           COALESCE(SUM(cents) FILTER (WHERE art = 'auskunft'), 0)::bigint AS auskunft_cents,
           COUNT(*)::int AS zahlungen
      FROM q GROUP BY 1 ORDER BY 1`)) as any[];

  return {
    heuteCents: Number(summen.heute), wocheCents: Number(summen.woche),
    monatCents: Number(summen.monat), vormonatCents: Number(summen.vormonat),
    jahrCents: Number(summen.jahr), gesamtCents: Number(summen.gesamt),
    verlauf: verlauf.map((v: any) => ({
      monat: String(v.monat), ratenCents: Number(v.raten_cents),
      auskunftCents: Number(v.auskunft_cents), zahlungen: Number(v.zahlungen),
    })),
  };
}

router.get("/chef/zahlen", requireChef("geschaeftsfuehrung"), async (_req: Request, res: Response) => {
  try {
    const [verdient] = (await sqlPool.unsafe(`
      SELECT
        COALESCE((SELECT SUM(r.betrag_cents) FROM fiaon_abo_raten r
          JOIN fiaon_applications a ON a.ref = r.ref
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          WHERE r.status='bezahlt' AND a.merged_into IS NULL AND ${ECHT}), 0)::bigint AS raten_cents,
        COALESCE((SELECT COUNT(*) FROM fiaon_abo_raten r
          JOIN fiaon_applications a ON a.ref = r.ref
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          WHERE r.status='bezahlt' AND a.merged_into IS NULL AND ${ECHT}), 0)::int AS raten_anzahl,
        COALESCE((SELECT SUM(ROUND(a.amount_due * 100)) FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          WHERE a.payment_status='paid' AND a.merged_into IS NULL
            AND a.ref LIKE 'FIAON-SCHUFA-%' AND ${ECHT}), 0)::bigint AS auskunft_cents,
        COALESCE((SELECT COUNT(*) FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          WHERE a.payment_status='paid' AND a.merged_into IS NULL
            AND a.ref LIKE 'FIAON-SCHUFA-%' AND ${ECHT}), 0)::int AS auskunft_anzahl
    `)) as any[];

    // Aktive Abos + MRR — und der Vertragsbestand ×12 je Abo.
    const [abo] = (await sqlPool.unsafe(`
      WITH aktive AS (
        SELECT a.ref, ROUND(a.amount_due * 100)::bigint AS monat_cents, a.pack_name
          FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
         WHERE a.payment_status='paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
           AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
           AND a.abo_gestoppt_am IS NULL AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
           AND a.amount_due IS NOT NULL AND ${ECHT})
      SELECT COUNT(*)::int AS aktive,
             COALESCE(SUM(monat_cents), 0)::bigint AS mrr_cents,
             COALESCE(SUM(monat_cents) * 12, 0)::bigint AS vertrag12_cents,
             COALESCE((SELECT SUM(r.betrag_cents) FROM fiaon_abo_raten r
                WHERE r.status='bezahlt' AND r.ref IN (SELECT ref FROM aktive)), 0)::bigint AS vereinnahmt_cents
        FROM aktive
    `)) as any[];

    const jePaket = (await sqlPool.unsafe(`
      SELECT COALESCE(SPLIT_PART(a.pack_name, E'\\n', 1), 'Ohne Paketname') AS paket,
             COUNT(*)::int AS anzahl,
             COALESCE(SUM(ROUND(a.amount_due * 100)), 0)::bigint AS mrr_cents
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.payment_status='paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
         AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
         AND a.abo_gestoppt_am IS NULL AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
         AND a.amount_due IS NOT NULL AND ${ECHT}
       GROUP BY 1 ORDER BY 3 DESC
    `)) as any[];

    // Monatsreihe aus dem EINEN Umsatz-Baustein (siehe oben).
    const bausteine = await umsatzBausteine();
    const monate = bausteine.verlauf;

    // Real eingegangen in den letzten 30 Tagen — die ehrliche Gegenzahl zum MRR.
    const [dreissig] = (await sqlPool.unsafe(`
      SELECT COALESCE(SUM(r.betrag_cents), 0)::bigint AS cents
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE r.status='bezahlt' AND r.bezahlt_am > NOW() - INTERVAL '30 days'
         AND a.merged_into IS NULL AND ${ECHT}
    `)) as any[];

    const mrrCents = Number(abo.mrr_cents);
    const arrCents = mrrCents * 12;
    // Drei Vielfache auf den ARR — bewusst eine SPANNE, kein Versprechen.
    const szenarien = [
      { name: "Vorsichtig", faktor: 2.5, satz: "Junges Geschäft, Ausfallquote noch unbewiesen — so rechnet ein skeptischer Käufer." },
      { name: "Marktüblich", faktor: 4, satz: "Übliche Spanne für wiederkehrende Umsätze mit funktionierendem Vertrieb." },
      { name: "Wachstum", faktor: 6, satz: "Bei belegtem Wachstum und niedriger Kündigungsquote — so rechnet ein überzeugter Käufer." },
    ].map((s) => ({ ...s, wertCents: Math.round(arrCents * s.faktor) }));

    res.json({
      ok: true,
      stand: new Date().toISOString(),
      verdient: {
        ratenCents: Number(verdient.raten_cents),
        ratenAnzahl: Number(verdient.raten_anzahl),
        auskunftCents: Number(verdient.auskunft_cents),
        auskunftAnzahl: Number(verdient.auskunft_anzahl),
        gesamtCents: Number(verdient.raten_cents) + Number(verdient.auskunft_cents),
      },
      abo: {
        aktive: Number(abo.aktive),
        mrrCents,
        arrCents,
        vertrag12Cents: Number(abo.vertrag12_cents),
        vereinnahmtCents: Number(abo.vereinnahmt_cents),
        ausstehendCents: Math.max(0, Number(abo.vertrag12_cents) - Number(abo.vereinnahmt_cents)),
        letzte30TageCents: Number(dreissig.cents),
      },
      jePaket: jePaket.map((r: any) => ({
        paket: String(r.paket), anzahl: Number(r.anzahl), mrrCents: Number(r.mrr_cents),
      })),
      monate: monate.map((m) => ({
        monat: m.monat, ratenCents: m.ratenCents, auskunftCents: m.auskunftCents,
      })),
      bewertung: { arrCents, szenarien },
    });
  } catch (err) {
    console.error("[CHEF-ZAHLEN]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSZENTRALE 2.0 (27.08.2026, Justin: „passt gar nichts, komplett
// neu, geprüft")
//
// Die alte Fassung zeigte nur bezahlte RATEN — ohne Bonitätsauskünfte, ohne
// das Offene, ohne das Bankbuch. Wer die Zahlungslage prüfen wollte, musste
// vier Seiten addieren. Jetzt: EIN Endpunkt, drei Sichten, und der Kopf
// rechnet aus demselben umsatzBausteine() wie Lagezimmer und Wert-Raum —
// Justins Regel: ALLE Zahlen müssen IMMER passen.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/zahlungszentrale", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const sicht = ["eingegangen", "offen", "bankbuch"].includes(String(req.query.sicht))
      ? String(req.query.sicht) : "eingegangen";
    const q = String(req.query.q || "").trim();
    const seite = Math.max(1, Math.min(500, Number(req.query.seite) || 1));
    const proSeite = 50;

    const kopf = await umsatzBausteine();

    // Wort-für-Wort-Suche — dieselbe Regel wie in der Kundenliste.
    const werte: any[] = [];
    const suchTeile: string[] = [];
    for (const wort of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      werte.push(`%${wort}%`);
      const n = werte.length;
      suchTeile.push(`(
        p.first_name ILIKE $${n} OR p.last_name ILIKE $${n}
        OR CONCAT_WS(' ', p.first_name, p.last_name) ILIKE $${n}
        OR a.ref ILIKE $${n} OR a.payment_reference ILIKE $${n}
      )`);
    }
    const suche = suchTeile.length ? ` AND ${suchTeile.join(" AND ")}` : "";
    const offset = (seite - 1) * proSeite;

    let zeilen: any[] = [];
    let gesamt = 0;
    let summeCents = 0;

    if (sicht === "eingegangen") {
      const BASIS = `
        FROM (
          SELECT r.bezahlt_am AS am, r.betrag_cents AS cents,
                 ('Rate ' || r.rate_nr) AS art, r.ref, a.person_id, a.pack_name,
                 a.payment_reference
            FROM fiaon_abo_raten r
            JOIN fiaon_applications a ON a.ref = r.ref
            LEFT JOIN fiaon_persons p ON p.id = a.person_id
           WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
             AND a.merged_into IS NULL AND ${ECHT} ${suche}
          UNION ALL
          SELECT COALESCE(a.paid_at, a.completed_at), ROUND(a.amount_due * 100)::int,
                 'Bonitätsauskunft', a.ref, a.person_id, a.pack_name, a.payment_reference
            FROM fiaon_applications a
            LEFT JOIN fiaon_persons p ON p.id = a.person_id
           WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
             AND a.ref LIKE 'FIAON-SCHUFA-%'
             AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL AND ${ECHT} ${suche}
        ) e
        LEFT JOIN fiaon_persons p2 ON p2.id = e.person_id`;
      const [[s1], rows] = await Promise.all([
        sqlPool.unsafe(`SELECT COUNT(*)::int AS n, COALESCE(SUM(e.cents),0)::bigint AS summe ${BASIS}`, werte) as Promise<any[]>,
        sqlPool.unsafe(`
          SELECT e.*, TRIM(COALESCE(p2.first_name,'')||' '||COALESCE(p2.last_name,'')) AS kunde
          ${BASIS} ORDER BY e.am DESC LIMIT ${proSeite} OFFSET ${offset}`, werte) as Promise<any[]>,
      ]);
      gesamt = Number(s1.n); summeCents = Number(s1.summe);
      zeilen = rows.map((r: any) => ({
        am: r.am, cents: Number(r.cents), art: r.art, ref: r.ref,
        personId: r.person_id, kunde: r.kunde || "—", paket: r.pack_name,
        zweck: r.payment_reference,
      }));
    } else if (sicht === "offen") {
      const BASIS = `
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
         AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL AND ${ECHT} ${suche}`;
      const [[s1], rows] = await Promise.all([
        sqlPool.unsafe(`SELECT COUNT(*)::int AS n,
          COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am < CURRENT_DATE),0)::bigint AS summe ${BASIS}`, werte) as Promise<any[]>,
        sqlPool.unsafe(`
          SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am, r.mahnstufe,
                 (SELECT MAX(x.rate_nr) FROM fiaon_abo_raten x WHERE x.ref = r.ref) AS raten_gesamt,
                 a.person_id, a.pack_name, a.payment_reference,
                 TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')) AS kunde
          ${BASIS}
          ORDER BY (r.faellig_am < CURRENT_DATE) DESC, r.faellig_am ASC
          LIMIT ${proSeite} OFFSET ${offset}`, werte) as Promise<any[]>,
      ]);
      gesamt = Number(s1.n); summeCents = Number(s1.summe);
      zeilen = rows.map((r: any) => ({
        am: r.faellig_am, cents: Number(r.betrag_cents),
        art: `Rate ${r.rate_nr} von ${r.raten_gesamt ?? 12}`,
        ref: r.ref, personId: r.person_id, kunde: r.kunde || "—", paket: r.pack_name,
        zweck: r.payment_reference, mahnstufe: Number(r.mahnstufe || 0),
        ueberfaellig: r.faellig_am ? new Date(r.faellig_am) < new Date(new Date().toDateString()) : false,
      }));
    } else {
      const BASIS = `
        FROM fiaon_bank_txns t
        LEFT JOIN fiaon_applications a ON a.ref = t.matched_ref
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE TRUE ${suche.replace(/a\.ref ILIKE/g, "t.matched_ref ILIKE").replace(/a\.payment_reference ILIKE/g, "t.txn_id ILIKE")}`;
      const [[s1], rows] = await Promise.all([
        sqlPool.unsafe(`SELECT COUNT(*)::int AS n,
          COALESCE(SUM(t.amount_cents) FILTER (WHERE NOT t.applied),0)::bigint AS summe ${BASIS}`, werte) as Promise<any[]>,
        sqlPool.unsafe(`
          SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.payer_name,
                 t.matched_ref, t.match_status, t.applied, a.person_id,
                 TRIM(COALESCE(p.first_name,'')||' '||COALESCE(p.last_name,'')) AS kunde
          ${BASIS}
          ORDER BY t.applied ASC, t.booked_at DESC
          LIMIT ${proSeite} OFFSET ${offset}`, werte) as Promise<any[]>,
      ]);
      gesamt = Number(s1.n); summeCents = Number(s1.summe);
      zeilen = rows.map((r: any) => ({
        am: r.booked_at, cents: Number(r.amount_cents), art: r.applied ? "verbucht" : "UNVERBUCHT",
        ref: r.matched_ref, personId: r.person_id, kunde: r.kunde || r.payer_name || "—",
        paket: r.txn_id, zweck: r.match_status, unverbucht: !r.applied,
      }));
    }

    res.json({
      ok: true, stand: new Date().toISOString(), sicht, gesamt, summeCents,
      seiten: Math.max(1, Math.ceil(gesamt / proSeite)), seite,
      kopf: {
        heuteCents: kopf.heuteCents, wocheCents: kopf.wocheCents,
        monatCents: kopf.monatCents, jahrCents: kopf.jahrCents,
      },
      zeilen,
    });
  } catch (err) {
    console.error("[CHEF-ZAHLUNGSZENTRALE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
