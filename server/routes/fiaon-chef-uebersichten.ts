// ═══════════════════════════════════════════════════════════════════════════
// DIE ZWEI GROSSEN ÜBERSICHTEN DES CHEFBÜROS (26.08.2026)
//
// Justin: „Außerdem brauchen wir ja eine Seite mit der gesamten
//          Kundenauflistung. Unsere Zahlungszentrale (mit EXAKTEN DATEN! also
//          hier wirklich DOPPELT prüfen sodass ALLE Details eingetragen und
//          ersichtlich sind!)"
//
// ── WAS „EXAKT" HIER HEISST ───────────────────────────────────────────────
// Drei Regeln, die jede Zahl auf diesen beiden Seiten einhält:
//
//   1. Eine PERSON ist eine Zeile — nicht eine Bestellung. Wer drei Verträge
//      hat, taucht einmal auf. Sonst stimmt jede Summe, aber keine Anzahl.
//   2. Zusammengeführte Personen und Testeinträge sind draußen. Sie sind der
//      Grund, warum dieselbe Frage an zwei Orten zwei Antworten bekam.
//   3. Geld kommt aus `bezahlt_am`, nie aus `faellig_am`. Was fällig war, ist
//      keine Einnahme.
//
// ── WARUM DIE ZAHLUNGSZENTRALE JEDE ZEILE VOLLSTÄNDIG ZEIGT ───────────────
// Eine Zahlung ohne ihre Nebenangaben ist im Streitfall wertlos. Deshalb
// trägt jede Zeile: Datum, Kunde, Akte, Paket, welche Rate von wie vielen,
// Betrag, Zahlungsweg, Referenz, zuständiger Mitarbeiter, die daraus
// entstandene Provision samt Satz — und ob dafür schon ein Beleg existiert.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";

const router = Router();

const HEUTE = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";
/** Nur echte Menschen. Ohne diese Zeile zählt man Karteileichen mit. */
const ECHT = "p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL";

function ganzzahl(v: unknown, standard: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : standard;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENAUFLISTUNG
//
// Filter, Sortierung und Seitenzahl kommen vom Server, nicht aus dem Browser:
// Bei 5.196 Personen darf die Oberfläche nicht alles laden und dann selbst
// sieben. Jede Antwort nennt zusätzlich die Gesamtzahl, damit sichtbar ist,
// wovon man gerade einen Ausschnitt sieht.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/kunden", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const filter = String(req.query.filter || "alle");
    const sortWunsch = String(req.query.sort || "zuletzt");
    const seite = ganzzahl(req.query.seite, 1, 500);
    const proSeite = ganzzahl(req.query.proSeite, 50, 200);

    // Der Suchtext geht als PARAMETER in die Abfrage, nicht als Text hinein.
    // Anführungszeichen zu verdoppeln würde hier zwar reichen — aber eine
    // Regel, die nur meistens hält, ist in einer Abfrage über 5.196 Personen
    // die falsche Regel.
    const werte: any[] = [];
    const teile: string[] = [ECHT];
    if (q) {
      werte.push(`%${q}%`);
      const n = werte.length;
      teile.push(`(
        p.first_name ILIKE $${n} OR p.last_name ILIKE $${n}
        OR p.primary_email ILIKE $${n} OR p.primary_phone ILIKE $${n}
        OR p.company_name ILIKE $${n}
        OR EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = p.id
                    AND (a2.ref ILIKE $${n} OR a2.payment_reference ILIKE $${n}))
      )`);
    }
    const bezahltHat = `EXISTS (SELECT 1 FROM fiaon_applications a3
                                 WHERE a3.person_id = p.id AND a3.payment_status = 'paid'
                                   AND a3.merged_into IS NULL)`;
    if (filter === "zahlende") teile.push(bezahltHat);
    if (filter === "mandat") teile.push("p.mandat_seit IS NOT NULL");
    if (filter === "pool") teile.push("p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL");
    if (filter === "ueberfaellig") teile.push(`EXISTS (
      SELECT 1 FROM fiaon_applications a4 JOIN fiaon_abo_raten r4 ON r4.ref = a4.ref
       WHERE a4.person_id = p.id AND r4.status = 'offen' AND r4.bezahlt_am IS NULL
         AND r4.storniert_am IS NULL AND r4.faellig_am < ${HEUTE})`);
    if (filter === "ohneZugang") teile.push(`${bezahltHat} AND NOT EXISTS (
      SELECT 1 FROM fiaon_applications a5 WHERE a5.person_id = p.id
        AND a5.merged_into IS NULL AND a5.password IS NOT NULL AND a5.password <> '')`);
    if (filter === "gesperrt") teile.push("p.is_blocked = TRUE");
    if (filter === "inkasso") teile.push("p.inkasso_ab IS NOT NULL");

    const wo = teile.join(" AND ");
    const sortierung: Record<string, string> = {
      zuletzt: "letzte_zahlung DESC NULLS LAST, p.created_at DESC",
      name: "p.last_name ASC NULLS LAST, p.first_name ASC",
      umsatz: "bezahlt_cents DESC NULLS LAST",
      offen: "offen_cents DESC NULLS LAST",
      neu: "p.created_at DESC",
    };
    const sort = sortierung[sortWunsch] ?? sortierung.zuletzt;

    // Die Geldzahlen kommen aus einem Unterabfrage-Block je Person: ein JOIN
    // über Akten UND Raten zugleich würde die Beträge vervielfachen.
    const basis = `
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.bezahlt_am IS NOT NULL), 0)::bigint AS bezahlt_cents,
          COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL
                                                 AND r.status = 'offen'), 0)::bigint AS offen_cents,
          COUNT(*) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL
                             AND r.status = 'offen' AND r.faellig_am < ${HEUTE})::int AS ueberfaellig,
          MAX(r.bezahlt_am) AS letzte_zahlung,
          MIN(r.faellig_am) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL
                                      AND r.status = 'offen') AS naechste_faellig,
          MAX(r.mahnstufe) FILTER (WHERE r.bezahlt_am IS NULL AND r.storniert_am IS NULL
                                     AND r.status = 'offen') AS hoechste_mahnstufe
        FROM fiaon_applications a JOIN fiaon_abo_raten r ON r.ref = a.ref
        WHERE a.person_id = p.id AND a.merged_into IS NULL
      ) g ON TRUE
      WHERE ${wo}`;

    const [[zaehler], liste] = await Promise.all([
      sqlPool.unsafe(`SELECT COUNT(*)::int AS n FROM fiaon_persons p WHERE ${wo}`, werte) as Promise<any[]>,
      sqlPool.unsafe(`
        SELECT p.id, p.person_ref, p.first_name, p.last_name, p.company_name,
               p.primary_email, p.primary_phone, p.city, p.zip,
               p.priority_tier, p.mandat_seit, p.assigned_agent_id, p.assigned_at,
               p.is_blocked, p.inkasso_ab, p.created_at, p.follow_up_date,
               ag.name AS mitarbeiter,
               g.bezahlt_cents, g.offen_cents, g.ueberfaellig, g.letzte_zahlung,
               g.naechste_faellig, g.hoechste_mahnstufe,
               (SELECT STRING_AGG(DISTINCT a6.pack_name, ' · ')
                  FROM fiaon_applications a6
                 WHERE a6.person_id = p.id AND a6.merged_into IS NULL
                   AND a6.payment_status = 'paid' AND a6.pack_name IS NOT NULL) AS pakete,
               EXISTS (SELECT 1 FROM fiaon_applications a7
                        WHERE a7.person_id = p.id AND a7.merged_into IS NULL
                          AND a7.password IS NOT NULL AND a7.password <> '') AS hat_zugang,
               (SELECT a8.ref FROM fiaon_applications a8
                 WHERE a8.person_id = p.id AND a8.merged_into IS NULL
                 ORDER BY (a8.payment_status = 'paid') DESC, a8.created_at DESC LIMIT 1) AS ref
        ${basis}
        ORDER BY ${sort}
        LIMIT ${proSeite} OFFSET ${(seite - 1) * proSeite}`, werte) as Promise<any[]>,
    ]);

    // Die Kopfzahlen gelten für den GESAMTEN Bestand, nicht für die Seite —
    // sonst ändert sich die Gesamtzahl beim Blättern.
    const [kopf] = (await sqlPool.unsafe(`
      SELECT
        COUNT(*)::int AS menschen,
        COUNT(*) FILTER (WHERE ${bezahltHat})::int AS zahlende,
        COUNT(*) FILTER (WHERE p.mandat_seit IS NOT NULL)::int AS mandate,
        COUNT(*) FILTER (WHERE p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL)::int AS pool,
        COUNT(*) FILTER (WHERE p.is_blocked)::int AS gesperrt,
        COUNT(*) FILTER (WHERE p.inkasso_ab IS NOT NULL)::int AS inkasso
      FROM fiaon_persons p WHERE ${ECHT}`)) as any[];

    res.json({
      ok: true,
      gesamt: Number(zaehler?.n ?? 0),
      seite, proSeite,
      seiten: Math.max(1, Math.ceil(Number(zaehler?.n ?? 0) / proSeite)),
      kopf: kopf ?? {},
      zeilen: liste,
    });
  } catch (err) {
    console.error("[CHEF-KUNDEN]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSZENTRALE
//
// Jede bestätigte Zahlung als eine Zeile, mit allem, was dazugehört. Der
// Zeitraum ist frei wählbar; ohne Angabe zeigt sie den laufenden Monat, weil
// das die Frage ist, die man neunmal von zehn stellt.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/zahlungen", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const von = String(req.query.von || "").match(/^\d{4}-\d{2}-\d{2}$/) ? String(req.query.von) : null;
    const bis = String(req.query.bis || "").match(/^\d{4}-\d{2}-\d{2}$/) ? String(req.query.bis) : null;
    const q = String(req.query.q || "").trim();
    const seite = ganzzahl(req.query.seite, 1, 500);
    const proSeite = ganzzahl(req.query.proSeite, 50, 200);

    const zeitraum = von && bis
      ? `(r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date BETWEEN '${von}' AND '${bis}'`
      : `date_trunc('month', r.bezahlt_am AT TIME ZONE 'Europe/Berlin') = date_trunc('month', ${HEUTE})`;

    const werte: any[] = [];
    const teile = ["r.bezahlt_am IS NOT NULL", zeitraum];
    if (q) {
      werte.push(`%${q}%`);
      const n = werte.length;
      teile.push(`(
        p.first_name ILIKE $${n} OR p.last_name ILIKE $${n}
        OR a.ref ILIKE $${n} OR r.zahlungsreferenz ILIKE $${n}
        OR ag.name ILIKE $${n}
      )`);
    }
    const wo = teile.join(" AND ");

    const basis = `
      FROM fiaon_abo_raten r
      LEFT JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      LEFT JOIN LATERAL (
        SELECT c.amount_cents, c.rate_bp, (c.payout_id IS NOT NULL) AS abgerechnet,
               (c.base_amount_cents = r.betrag_cents) AS genau
          FROM fiaon_commissions c
         WHERE c.ref = r.ref
         ORDER BY (c.base_amount_cents = r.betrag_cents) DESC, c.created_at DESC
         LIMIT 1
      ) k ON TRUE
      WHERE ${wo}`;

    const [[z], zeilen, [summe]] = await Promise.all([
      sqlPool.unsafe(`SELECT COUNT(*)::int AS n ${basis}`, werte) as Promise<any[]>,
      sqlPool.unsafe(`
        SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.bezahlt_am, r.faellig_am,
               r.zahlungsreferenz, r.quelle, r.status, r.mahnstufe,
               r.lastschrift_status, r.rechnung_am, r.notiz,
               (SELECT COUNT(*)::int FROM fiaon_abo_raten r2 WHERE r2.ref = r.ref) AS raten_gesamt,
               a.pack_name, a.pack_key, a.amount_due, a.payment_status,
               p.id AS person_id, p.person_ref,
               TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
               p.primary_email, p.primary_phone, p.city,
               ag.id AS agent_id, ag.name AS mitarbeiter, ag.commission_rate_bp,
               -- ── DIE PROVISION WIRD NACHGESCHLAGEN, NICHT GERECHNET ──────
               -- Gerechnet wäre sie eine zweite Wahrheit neben der gebuchten,
               -- und bei jeder Satzänderung liefen beide auseinander.
               --
               -- ZUERST ZU ENG GEBAUT: Der erste Entwurf verlangte, dass der
               -- Grundbetrag der Buchung exakt dem Ratenbetrag entspricht. Bei
               -- 11 Zahlungen dieses Monats stand die Provision zwar auf der
               -- Akte, aber mit anderem Grundbetrag (Sammelbuchung, Teilzahlung)
               -- — sie erschienen fälschlich als „nicht gebucht".
               -- Deshalb zwei Stufen mit ehrlicher Kennzeichnung: die Spalte
               -- provision_genau sagt, ob die Buchung wirklich zu DIESER Rate gehört.
               k.amount_cents AS provision_cents,
               k.rate_bp AS provision_bp,
               k.abgerechnet,
               k.genau AS provision_genau
        ${basis}
        ORDER BY r.bezahlt_am DESC
        LIMIT ${proSeite} OFFSET ${(seite - 1) * proSeite}`, werte) as Promise<any[]>,
      sqlPool.unsafe(`
        SELECT COALESCE(SUM(r.betrag_cents),0)::bigint AS cents,
               COUNT(DISTINCT p.id)::int AS kunden,
               COUNT(*)::int AS zahlungen
        ${basis}`, werte) as Promise<any[]>,
    ]);

    // Monatsverlauf zum Vergleich — dieselbe Grundlage wie das Lagezimmer.
    const verlauf = (await sqlPool.unsafe(`
      SELECT to_char(date_trunc('month', bezahlt_am AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM') AS monat,
             SUM(betrag_cents)::bigint AS cents, COUNT(*)::int AS anzahl
        FROM fiaon_abo_raten
       WHERE bezahlt_am IS NOT NULL
         AND bezahlt_am >= (${HEUTE} - INTERVAL '11 months')
       GROUP BY 1 ORDER BY 1`)) as any[];

    res.json({
      ok: true,
      zeitraum: von && bis ? { von, bis } : { monat: true },
      gesamt: Number(z?.n ?? 0),
      seite, proSeite,
      seiten: Math.max(1, Math.ceil(Number(z?.n ?? 0) / proSeite)),
      summe: summe ?? { cents: 0, kunden: 0, zahlungen: 0 },
      verlauf, zeilen,
    });
  } catch (err) {
    console.error("[CHEF-ZAHLUNGEN]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Eine einzelne Person in ganzer Tiefe — für das Sprungfenster. */
router.get("/chef/kunde/:id", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Ungültige Kennung" });

    const [person] = (await sqlPool`
      SELECT p.*, ag.name AS mitarbeiter, ag.email AS mitarbeiter_email
        FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
       WHERE p.id = ${id}`) as any[];
    if (!person) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    delete (person as any).password;

    const [akten, raten, termine, vermerke] = await Promise.all([
      sqlPool`SELECT ref, pack_name, pack_key, amount_due, payment_status, paid_at,
                     created_at, onboarding_stufe, merged_into,
                     (password IS NOT NULL AND password <> '') AS hat_passwort
                FROM fiaon_applications WHERE person_id = ${id} ORDER BY created_at DESC`,
      sqlPool`SELECT r.* FROM fiaon_abo_raten r
                JOIN fiaon_applications a ON a.ref = r.ref
               WHERE a.person_id = ${id} ORDER BY r.faellig_am ASC`,
      sqlPool`SELECT id, beginn, status, quelle, herkunft FROM fiaon_termine
               WHERE person_id = ${id} ORDER BY beginn DESC LIMIT 20`,
      // Vermerke hängen an der AKTE (ref), nicht an der Person — deshalb der
      // Umweg über ihre Bestellungen. Entfernte Vermerke bleiben draußen.
      sqlPool`SELECT v.id, v.art, v.text, v.created_at, v.autor_name, v.autor_agent_id,
                     v.dringend, v.status, v.faellig_am, v.ref
                FROM fiaon_vermerke v
                JOIN fiaon_applications a ON a.ref = v.ref
               WHERE a.person_id = ${id} AND v.entfernt_am IS NULL
               ORDER BY v.created_at DESC LIMIT 30`,
    ]);

    res.json({ ok: true, person, akten, raten, termine, vermerke });
  } catch (err) {
    console.error("[CHEF-KUNDE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
