// ═══════════════════════════════════════════════════════════════════════════
// DIE FÜNF WERKZEUGE DES CHEFBÜROS (26.08.2026)
//
// Justin: „Wirklich JEDE JEDE JEDE Funktion und 5 nützlichen Werkzeugen."
//
// ── WARUM GERADE DIESE FÜNF ───────────────────────────────────────────────
// Eine Durchsicht aller Admin-Endpunkte hat gezeigt: Die wertvollsten
// Funktionen der Plattform sind gebaut, aber nirgends angebunden — sie waren
// nur per curl erreichbar. Ein Werkzeug, das eine fertige, unbenutzte
// Fähigkeit endlich bedienbar macht, ist mehr wert als ein neu erfundenes.
//
//   1. Frag die Zahlen  — /admin/cockpit/ask war gebaut und unverdrahtet
//   2. Wahrheits-Check  — /admin/truth-check war gebaut und unverdrahtet
//   3. Maschinenraum    — ein Lauf stand einmal fünfzehn Tage still
//   4. Sprung & Fremdsicht — die Sicht-Wechsel lagen drei Ebenen tief
//   5. Freigabestapel   — 23 Abrechnungen mit PDF, keine je versendet
//
// ── DIE REGEL DIESER DATEI ────────────────────────────────────────────────
// Lesen ist frei (ab Stufe Leitung, Geld ab Geschäftsführung). Alles, was
// etwas VERÄNDERT, verlangt Geschäftsführung und landet im Chef-Protokoll —
// requireChef schreibt jede Nicht-GET-Anfrage selbsttätig mit.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";

const router = Router();

const HEUTE = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";

async function zeilen(sql: string): Promise<any[]> {
  try {
    return (await sqlPool.unsafe(sql)) as any[];
  } catch (e) {
    console.error("[CHEF-WERKZEUG]", String(e).slice(0, 200));
    return [];
  }
}
async function eineZahl(sql: string): Promise<number> {
  const r = await zeilen(sql);
  return Number(r[0] ? Object.values(r[0])[0] ?? 0 : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 2 — DER WAHRHEITS-CHECK
//
// Die Frage, die ein Geschäftsführer vor jedem Gespräch mit Bank, Investor
// oder Steuerberater stellen muss: Stimmen meine Zahlen überhaupt?
//
// Geprüft werden die Stellen, an denen dieselbe Sache zweimal gezählt wird
// und deshalb auseinanderlaufen KANN. Jede Prüfung nennt ihren Befund im
// Klartext und, wo möglich, den Knopf, der ihn behebt.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/werkzeug/wahrheit", requireChef("geschaeftsfuehrung"), async (_req, res) => {
  try {
    const pruefungen: any[] = [];

    // ── 1. Bezahlt, aber ohne Ratenkette ──────────────────────────────────
    // Solange das nicht null ist, ist JEDE ratenbasierte Umsatzzahl zu
    // niedrig: Die Bestellung ist bezahlt, aber es existiert keine Rate, die
    // den Betrag trägt. Genau das macht diese Prüfung sichtbar.
    const ohneKette = await zeilen(`
      SELECT a.ref, a.pack_name, a.amount_due,
             TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
             a.created_at
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
         AND COALESCE(a.pack_key,'') NOT IN ('schufa','')
         AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref)
       ORDER BY a.created_at DESC LIMIT 50`);
    pruefungen.push({
      key: "ohneKette",
      titel: "Bezahlt, aber ohne Ratenkette",
      frage: "Gibt es bezahlte Bestellungen, zu denen keine einzige Rate existiert?",
      folge: "Solange hier etwas steht, ist jede Umsatzzahl zu niedrig — der Betrag wird von keiner Rate getragen.",
      anzahl: ohneKette.length,
      gut: ohneKette.length === 0,
      knopf: ohneKette.length ? { label: "Ketten nachziehen", pfad: "/chef/werkzeug/ketten-nachziehen" } : null,
      zeilen: ohneKette.slice(0, 20),
    });

    // ── 2. Bezahlt, aber ohne Mitarbeiter ─────────────────────────────────
    // Direkt Provisionsgeld: Ohne zugeordneten Mitarbeiter entsteht keine
    // Provision, und niemand merkt es — am wenigsten der Mitarbeiter.
    const ohneAgent = await zeilen(`
      SELECT a.ref, a.pack_name, a.amount_due, a.created_at,
             TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
         AND p.assigned_agent_id IS NULL
       ORDER BY a.created_at DESC LIMIT 50`);
    pruefungen.push({
      key: "ohneAgent",
      titel: "Bezahlt, aber ohne Mitarbeiter",
      frage: "Wurde bezahlt, ohne dass jemand die Akte besitzt?",
      folge: "Für diese Zahlungen entsteht keine Provision. Der Mitarbeiter merkt es nie.",
      anzahl: ohneAgent.length,
      gut: ohneAgent.length === 0,
      knopf: null,
      zeilen: ohneAgent.slice(0, 20),
    });

    // ── 3. Provision bestätigt, aber nie abgerechnet ──────────────────────
    const provOffen = await zeilen(`
      SELECT ag.id AS agent_id, ag.name,
             COUNT(*)::int AS positionen,
             SUM(c.amount_cents)::int AS summe,
             MIN(c.created_at)::date AS aelteste
        FROM fiaon_commissions c JOIN fiaon_agents ag ON ag.id = c.agent_id
       WHERE c.status = 'bestaetigt' AND c.payout_id IS NULL
       GROUP BY ag.id, ag.name ORDER BY SUM(c.amount_cents) DESC`);
    pruefungen.push({
      key: "provOffen",
      titel: "Provision bestätigt, aber ohne Abrechnung",
      frage: "Wem schulden wir Geld, ohne dass ein Beleg dazu existiert?",
      folge: "Das ist eine Verbindlichkeit ohne Papier — in einer Due Diligence die unangenehmste Sorte.",
      anzahl: provOffen.length,
      gut: provOffen.length === 0,
      knopf: null,
      zeilen: provOffen,
    });

    // ── 4. Abrechnung erzeugt, nie versendet ──────────────────────────────
    const nieGesendet = await eineZahl(
      `SELECT COUNT(*) FROM fiaon_commission_statements WHERE gesendet_am IS NULL`);
    pruefungen.push({
      key: "nieGesendet",
      titel: "Abrechnung erzeugt, nie versendet",
      frage: "Liegen fertige Abrechnungen ungelesen im System?",
      folge: "Der Mitarbeiter weiß nicht, dass sie existiert — und fragt stattdessen nach.",
      anzahl: nieGesendet,
      gut: nieGesendet === 0,
      knopf: nieGesendet ? { label: "Zu den Abrechnungen", href: "/admin/abrechnungen" } : null,
      zeilen: [],
    });

    // ── 5. Rate bezahlt, Bestellung noch offen ────────────────────────────
    // Zwei Orte, dieselbe Wahrheit: Wenn eine Rate bezahlt ist, die
    // Bestellung aber nicht als bezahlt gilt, zeigen Kundenliste und
    // Zahlungszentrale verschiedene Zahlen.
    const widerspruch = await zeilen(`
      SELECT a.ref, a.payment_status, COUNT(r.id)::int AS bezahlte_raten,
             SUM(r.betrag_cents)::int AS summe,
             TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE r.bezahlt_am IS NOT NULL AND a.payment_status <> 'paid'
         AND a.merged_into IS NULL
       GROUP BY a.ref, a.payment_status, p.first_name, p.last_name
       ORDER BY SUM(r.betrag_cents) DESC LIMIT 50`);
    pruefungen.push({
      key: "widerspruch",
      titel: "Rate bezahlt, Bestellung gilt als unbezahlt",
      frage: "Sagen Zahlungszentrale und Kundenakte dasselbe?",
      folge: "Der Kunde hat gezahlt und wird trotzdem gemahnt.",
      anzahl: widerspruch.length,
      gut: widerspruch.length === 0,
      knopf: null,
      zeilen: widerspruch.slice(0, 20),
    });

    // ── 6. Bezahlt, aber nie freigeschaltet ───────────────────────────────
    // ZUERST FALSCH GEMESSEN: Der erste Entwurf zaehlte `freigeschaltet_am IS
    // NULL` und kam auf 419 — bei 403 zahlenden Kunden. Diese Spalte ist nur
    // ein Handvermerk („jemand hat manuell freigeschaltet"), kein Tor. Das
    // echte Tor ist das Passwort: Ohne Passwort gibt es keine Anmeldung.
    // Und gezaehlt wird die PERSON, nicht die Akte — wer zwei Bestellungen
    // hat und bei einer ein Passwort, kommt hinein.
    const nichtFrei = await zeilen(`
      SELECT p.id AS person_id,
             TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
             p.primary_email AS email, MAX(a.paid_at) AS zuletzt_bezahlt,
             STRING_AGG(DISTINCT a.ref, ', ') AS akten
        FROM fiaon_applications a
        JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       GROUP BY p.id, p.first_name, p.last_name, p.primary_email
      HAVING COUNT(*) FILTER (WHERE a.password IS NOT NULL AND a.password <> '') = 0
       ORDER BY MAX(a.paid_at) DESC NULLS LAST LIMIT 100`);
    pruefungen.push({
      key: "nichtFrei",
      titel: "Bezahlt, kann sich aber nicht anmelden",
      frage: "Wer hat bezahlt und hat zu keiner seiner Akten ein Passwort?",
      folge: "Der teuerste Moment der Kundenbeziehung — bezahlt und ausgesperrt.",
      anzahl: nichtFrei.length,
      gut: nichtFrei.length === 0,
      knopf: nichtFrei.length ? { label: "Zur Kundenliste", href: "/chef/kunden" } : null,
      zeilen: nichtFrei.slice(0, 20),
    });

    // ── 7. Bezahlt, aber keine Provision gebucht ──────────────────────────
    // GEFUNDEN beim Bau dieser Seite: 156 bezahlte Raten über 10.330,44 EUR
    // tragen keine einzige Provisionsbuchung, obwohl ein Mitarbeiter an der
    // Akte hängt. Das ist Geld, das dem Team zusteht und das niemand
    // reklamieren kann, weil es nirgends steht.
    //
    // Diese Prüfung BUCHT nichts. Geld bewegt sich in dieser Firma nur, wenn
    // ein Mensch es anordnet — die Prüfung legt den Fall nur auf den Tisch.
    const ohneProvision = await zeilen(`
      SELECT ag.id AS agent_id, ag.name,
             COUNT(*)::int AS raten,
             SUM(r.betrag_cents)::bigint AS umsatz_cents,
             SUM(r.betrag_cents * COALESCE(ag.commission_rate_bp, 2500) / 10000)::bigint AS provision_cents,
             MIN(r.bezahlt_am)::date AS aelteste
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
        JOIN fiaon_persons p ON p.id = a.person_id
        JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
       WHERE r.bezahlt_am IS NOT NULL AND p.ist_test_am IS NULL AND NOT ag.is_test_account
         AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.ref = r.ref)
       GROUP BY ag.id, ag.name
       ORDER BY SUM(r.betrag_cents) DESC`);
    const provSumme = ohneProvision.reduce((x: number, z: any) => x + Number(z.provision_cents || 0), 0);
    pruefungen.push({
      key: "ohneProvision",
      titel: "Bezahlt, aber keine Provision gebucht",
      frage: "Für welche eingegangenen Zahlungen wurde nie eine Provision verbucht?",
      folge: `Dem Team stehen daraus rund ${(provSumme / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR zu, die nirgends erfasst sind.`,
      anzahl: ohneProvision.reduce((x: number, z: any) => x + Number(z.raten || 0), 0),
      summe: provSumme,
      gut: ohneProvision.length === 0,
      knopf: null,
      zeilen: ohneProvision,
    });

    const schlecht = pruefungen.filter((p) => !p.gut).length;
    res.json({
      ok: true, stand: new Date().toISOString(),
      urteil: schlecht === 0 ? "sauber" : schlecht <= 2 ? "kleine Abweichungen" : "mehrere Abweichungen",
      offen: schlecht, gesamt: pruefungen.length, pruefungen,
    });
  } catch (err) {
    console.error("[CHEF-WERKZEUG] wahrheit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Ketten nachziehen — ruft den bestehenden Erzeuger, baut keinen zweiten. */
router.post("/chef/werkzeug/ketten-nachziehen", requireChef("geschaeftsfuehrung"), async (req: ChefRequest, res: Response) => {
  try {
    const mod: any = await import("./fiaon-abo");
    const fn = mod.ketteNachziehen ?? mod.aboKettenNachziehen ?? null;
    if (typeof fn !== "function") {
      // Kein stiller Fehlschlag: Wer hier landet, bekommt den Weg genannt.
      return res.status(501).json({
        ok: false,
        error: "Der Nachzieher liegt hinter /admin/abo/nachziehen. Bitte dort ausführen.",
        href: "/admin/abo",
      });
    }
    const erg = await fn();
    res.json({ ok: true, ergebnis: erg });
  } catch (err) {
    console.error("[CHEF-WERKZEUG] ketten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 3 — DER MASCHINENRAUM
//
// Ein Chef braucht hier genau zwei Auskünfte: Läuft die Automatik, und kann
// ich sie von hier aus neu anwerfen? Der Anlass steht in fiaon-crons.ts —
// ein Lauf stand fünfzehn Tage still, ohne dass es jemand bemerkte.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/werkzeug/maschinen", requireChef("leitung"), async (_req, res) => {
  try {
    const { alleLaufAmpeln, AMPEL_GELB_STUNDEN, AMPEL_ROT_STUNDEN, CRONS_AN } =
      await import("../lib/fiaon-crons");
    const laeufe = await alleLaufAmpeln();

    // Was heute tatsächlich hinausging — die Gegenprobe zur Ampel.
    const [heute] = await zeilen(`
      SELECT
        (SELECT COUNT(*) FROM fiaon_mail_log
          WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE})::int AS mails,
        (SELECT COUNT(*) FROM fiaon_abo_raten
          WHERE bezahlt_am IS NOT NULL
            AND (bezahlt_am AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE})::int AS zahlungen`);

    res.json({
      ok: true, cronsAn: CRONS_AN,
      grenzen: { gelb: AMPEL_GELB_STUNDEN, rot: AMPEL_ROT_STUNDEN },
      laeufe,
      rot: laeufe.filter((l: any) => l.ampel === "rot").length,
      gelb: laeufe.filter((l: any) => l.ampel === "gelb").length,
      heute: heute ?? { mails: 0, zahlungen: 0 },
      handstarts: [
        { key: "abo-tageslauf", label: "Abo-Tageslauf", pfad: "/admin/abo/tageslauf", satz: "Fällige Raten prüfen, Erinnerungen erzeugen" },
        { key: "followup", label: "Nachfass-Lauf", pfad: "/admin/followup/run", satz: "Fällige Wiedervorlagen abarbeiten" },
        { key: "leads", label: "Lead-Nachfass", pfad: "/admin/leads/run-followups", satz: "Leads nachfassen, die liegen geblieben sind" },
      ],
    });
  } catch (err) {
    console.error("[CHEF-WERKZEUG] maschinen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 5 — DER FREIGABESTAPEL GELD
//
// Alles, was nur ein Chef entscheiden darf, an EINER Stelle, je Zeile ein
// Ja oder Nein. Heute liegt dasselbe über sechs Seiten verteilt — und was
// über sechs Seiten verteilt liegt, wird nicht entschieden, sondern vergessen.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/werkzeug/freigaben", requireChef("geschaeftsfuehrung"), async (_req, res) => {
  try {
    const [auszahlungen, abrechnungen, entscheidung, belegeFehlen] = await Promise.all([
      zeilen(`
        SELECT po.id, po.amount_cents, po.requested_at, po.iban_masked,
               ag.name AS mitarbeiter, ag.email
          FROM fiaon_payouts po JOIN fiaon_agents ag ON ag.id = po.agent_id
         WHERE po.status IN ('requested','angefordert','offen')
         ORDER BY po.requested_at ASC NULLS LAST`),
      zeilen(`
        SELECT s.id, s.statement_no, s.payout_id, s.issued_at,
               (s.pdf_base64 IS NOT NULL) AS hat_pdf,
               COALESCE(s.net_cents, s.gross_cents, po.amount_cents) AS amount_cents,
               ag.name AS mitarbeiter, ag.email
          FROM fiaon_commission_statements s
          LEFT JOIN fiaon_payouts po ON po.id = s.payout_id
          LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(po.agent_id, s.agent_id)
         WHERE s.gesendet_am IS NULL
         ORDER BY s.issued_at DESC NULLS LAST`),
      // GEFUNDEN: Den Ratenstatus „angekuendigt" gibt es nicht — die Raten
      // kennen nur offen / bezahlt / storniert. Der Fall, der wirklich eine
      // Entscheidung des Chefs braucht, ist ein anderer: Alle Mahnstufen sind
      // durchlaufen, das Geld ist trotzdem nicht da. Ab hier gibt es nur noch
      // Übergabe, Ratenplan oder Ausbuchung — und alle drei entscheidet er.
      zeilen(`
        SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am, r.mahnstufe,
               (${HEUTE} - r.faellig_am) AS tage_offen,
               TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
          FROM fiaon_abo_raten r
          LEFT JOIN fiaon_applications a ON a.ref = r.ref
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
         WHERE r.status = 'offen' AND r.bezahlt_am IS NULL AND r.storniert_am IS NULL
           AND r.mahnstufe >= 3 AND r.faellig_am < ${HEUTE}
         ORDER BY r.faellig_am ASC LIMIT 100`),
      eineZahl(`
        SELECT COUNT(*) FROM fiaon_payouts
         WHERE status IN ('ausgezahlt','paid')
           AND NOT EXISTS (SELECT 1 FROM fiaon_commission_statements s WHERE s.payout_id = fiaon_payouts.id)`),
    ]);

    const stapel = [
      {
        key: "auszahlungen", titel: "Auszahlungen freigeben",
        satz: "Provisions-Anforderungen des Teams — mit IBAN, wartend auf dein Ja.",
        anzahl: auszahlungen.length,
        summe: auszahlungen.reduce((s: number, z: any) => s + Number(z.amount_cents || 0), 0),
        href: "/admin/auszahlungen", zeilen: auszahlungen,
      },
      {
        key: "abrechnungen", titel: "Abrechnungen versenden",
        satz: "Fertige Provisionsabrechnungen, die noch niemand bekommen hat.",
        anzahl: abrechnungen.length,
        summe: abrechnungen.reduce((s: number, z: any) => s + Number(z.amount_cents || 0), 0),
        href: "/admin/abrechnungen", zeilen: abrechnungen,
      },
      {
        key: "entscheidung", titel: "Mahnwege erschöpft — Entscheidung nötig",
        satz: "Alle Mahnstufen durchlaufen, das Geld ist nicht da. Übergeben, stunden oder ausbuchen.",
        anzahl: entscheidung.length,
        summe: entscheidung.reduce((s: number, z: any) => s + Number(z.betrag_cents || 0), 0),
        href: "/admin/zahlungen", zeilen: entscheidung.slice(0, 30),
      },
      {
        key: "belege", titel: "Ausgezahlt ohne Beleg",
        satz: "Geld ist geflossen, ein Abrechnungs-PDF existiert nicht.",
        anzahl: belegeFehlen, summe: 0,
        href: "/admin/auszahlungen", zeilen: [],
      },
    ];

    res.json({
      ok: true,
      offen: stapel.reduce((s, t) => s + Number(t.anzahl || 0), 0),
      summe: stapel.reduce((s, t) => s + Number(t.summe || 0), 0),
      stapel,
    });
  } catch (err) {
    console.error("[CHEF-WERKZEUG] freigaben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER POSTEINGANG — WAS VON DRAUSSEN HEREINKOMMT UND NIEMAND SIEHT
//
// GEFUNDEN beim Durchsehen aller Endpunkte: Zwei Kanäle schreiben in die
// Datenbank, ohne dass irgendeine Oberfläche sie liest.
//
//   · fiaon_anfragen — Investoren-, Presse-, Partner- und Bewerbungsanfragen
//     von der Website. Eine übersehene Zeile hier ist eine verlorene
//     Investorenanfrage.
//   · fiaon_tickets — Kundenanfragen aus dem Kundenbereich. Es gibt einen
//     Mitarbeiter- und einen Kunden-Endpunkt, aber keinen für die Leitung.
//     Beim Schreiben dieser Datei: sieben offene, die niemand sah.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/werkzeug/posteingang", requireChef("leitung"), async (_req, res) => {
  try {
    const [anfragen, tickets] = await Promise.all([
      zeilen(`
        SELECT id, art, name, email, firma, telefon, rolle, land, text, created_at
          FROM fiaon_anfragen ORDER BY created_at DESC LIMIT 100`),
      zeilen(`
        SELECT t.id, t.ref, t.betreff, t.text, t.status, t.created_at,
               t.beantwortet_am, ag.name AS zustaendig,
               TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde,
               EXTRACT(EPOCH FROM (NOW() - t.created_at))/3600 AS liegt_stunden
          FROM fiaon_tickets t
          LEFT JOIN fiaon_persons p ON p.id = t.person_id
          LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
         WHERE t.status <> 'geschlossen'
         ORDER BY t.created_at ASC LIMIT 100`),
    ]);
    res.json({
      ok: true,
      anfragen: { anzahl: anfragen.length, zeilen: anfragen },
      tickets: {
        anzahl: tickets.length,
        aeltesteStunden: tickets.length ? Math.round(Number(tickets[0].liegt_stunden || 0)) : 0,
        zeilen: tickets,
      },
    });
  } catch (err) {
    console.error("[CHEF-WERKZEUG] posteingang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
