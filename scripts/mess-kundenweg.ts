// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — Lead-Strecke, Slots, SCHUFA, Selbstzahler
//
// NUR LESEN. Dieses Skript schreibt nichts.
//
//   npx tsx scripts/mess-kundenweg.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(8)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}
const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", {
  minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const befund: Record<string, unknown> = {};

function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE LEAD-STRECKE — wie weit kommt sie heute?");
  // ═════════════════════════════════════════════════════════════════════════
  const [l] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE in_sequence)::int AS in_strecke,
           COUNT(*) FILTER (WHERE status = 'konvertiert')::int AS konvertiert,
           COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL)::int AS weggelegt,
           COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(email, '')), '') IS NULL)::int AS ohne_mail,
           COUNT(*) FILTER (WHERE person_id IS NOT NULL)::int AS mit_person
    FROM fiaon_leads
  `) as any[];
  zahl("Leads insgesamt", l.gesamt);
  zahl("… in der Strecke", l.in_strecke);
  zahl("… konvertiert", l.konvertiert);
  zahl("… weggelegt", l.weggelegt);
  zahl("… ohne E-Mail-Adresse", l.ohne_mail, "die kann keine Strecke erreichen");

  // Wie viele Mails hat ein Lead heute bekommen?
  const stufen = (await sqlPool`
    SELECT COALESCE(lead_reminder_count, 0) AS mails, COUNT(*)::int AS n
    FROM fiaon_leads GROUP BY 1 ORDER BY 1
  `) as any[];
  log("\n  MAILS JE LEAD (heutiger Stand):");
  for (const s of stufen) {
    log(`    ${String(s.mails).padStart(3)} Mail(s) → ${String(s.n).padStart(5)} Leads`);
  }
  const maxMails = Math.max(...stufen.map((s: any) => Number(s.mails)));
  zahl("\n  Höchste erreichte Mail-Nummer", maxMails,
    maxMails <= 3 ? "die Strecke endet also früh" : "");

  // DIE ZAHL, die zeigt, ob „manche erst bei Mail 20" real ist.
  const konvNach = (await sqlPool`
    SELECT COALESCE(lead_reminder_count, 0) AS bei_mail, COUNT(*)::int AS n
    FROM fiaon_leads WHERE status = 'konvertiert' GROUP BY 1 ORDER BY 1
  `) as any[];
  log("\n  KONVERTIERT NACH MAIL-NUMMER:");
  for (const k of konvNach) {
    log(`    nach ${String(k.bei_mail).padStart(3)} Mail(s) → ${String(k.n).padStart(4)} Kunden`);
  }
  log("    (Diese Verteilung ist heute wertlos, weil die Strecke früh endet —");
  log("     die Zahl wird erst aussagekräftig, wenn sie nicht mehr abbricht.)");

  // Wer wäre EINZUREIHEN? Lebende Leads ohne Antrag.
  const [einreihen] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE erstellt_am > NOW() - INTERVAL '30 days')::int AS jung,
           COUNT(*) FILTER (WHERE erstellt_am <= NOW() - INTERVAL '90 days')::int AS alt
    FROM fiaon_leads le
    WHERE le.status NOT IN ('konvertiert', 'kein_interesse', 'tot')
      AND NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL
      AND le.dismissed_at IS NULL
      -- Kein Antrag: weder über person_id noch über die Adresse.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.merged_into IS NULL
          AND (a.person_id = le.person_id
            OR LOWER(TRIM(COALESCE(a.email, ''))) = LOWER(TRIM(le.email))))
  `) as any[];
  log("");
  zahl("EINZUREIHEN: lebende Leads ohne Antrag", einreihen.n);
  zahl("… davon jünger als 30 Tage", einreihen.jung);
  zahl("… davon älter als 90 Tage", einreihen.alt);
  befund.leads = { ...l, einreihen: Number(einreihen.n), maxMails };

  // Gibt es eine Abmeldung? Einen Bounce-Merker?
  const spalten = (await sqlPool`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_leads'
  `) as any[];
  const hat = (n: string) => spalten.some((s) => s.column_name === n);
  log("");
  zahl("Spalte für Abmeldung vorhanden", hat("abgemeldet_am") ? "ja" : "NEIN",
    "eine Strecke ohne Abmelde-Weg ist rechtlich heikel");
  zahl("Spalte für harte Unzustellbarkeit", hat("bounce_am") ? "ja" : "NEIN");
  zahl("Spalte für die Strecken-Stufe", hat("strecke_stufe") ? "ja" : "nein (lead_reminder_count)");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE SLOTS — wie viele sieht ein Kunde heute?");
  // ═════════════════════════════════════════════════════════════════════════
  try {
    const { freieSlots } = await import("../server/lib/fiaon-termine");
    // Einen echten Kunden nehmen, der auf sein Startgespräch wartet.
    const [wartend] = (await sqlPool`
      SELECT a.person_id FROM fiaon_applications a
      WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
      ORDER BY a.paid_at DESC NULLS LAST LIMIT 1
    `) as any[];
    if (wartend?.person_id) {
      // ── BEIDE QUELLEN MESSEN ──────────────────────────────────────────
      // `freieSlots` filtert die Mitarbeiter nach ROLLE: „onboarding_call"
      // verlangt einen Onboarding-Menschen. Davon gibt es aktuell keinen
      // (gemessen unten) — deshalb kämen null Slots heraus, und das sähe aus
      // wie ein Fehler in der Slot-Rechnung. Es ist keiner.
      let auskunft = await freieSlots(Number(wartend.person_id), sqlPool, "onboarding_call");
      let quelle = "onboarding_call";
      if (((auskunft as any)?.slots ?? []).length === 0) {
        auskunft = await freieSlots(Number(wartend.person_id), sqlPool, "nichterreicht_mail");
        quelle = "nichterreicht_mail (kein Onboarding-Mensch vorhanden)";
      }
      log(`  Gemessen über die Quelle: ${quelle}`);
      const slots = (auskunft as any)?.slots ?? auskunft ?? [];
      const jeTag = new Map<string, number>();
      for (const s of slots as any[]) {
        const t = String(s.datum ?? String(s.beginn).slice(0, 10));
        jeTag.set(t, (jeTag.get(t) ?? 0) + 1);
      }
      zahl("Angebotene Slots insgesamt", (slots as any[]).length);
      log("\n  JE TAG:");
      for (const [t, n] of Array.from(jeTag.entries()).sort()) {
        log(`    ${t} → ${String(n).padStart(3)} Slots${n > 5 ? "   ← mehr als fünf" : ""}`);
      }
      const ueber = Array.from(jeTag.values()).filter((n) => n > 5).length;
      log("");
      zahl("Tage mit MEHR als 5 Slots", ueber,
        ueber > 0 ? "vierzig freie Zeiten sagen „hier ist nichts los“" : "");
      befund.slots = { gesamt: (slots as any[]).length, tage: jeTag.size, ueberFuenf: ueber };
    } else {
      log("  Kein wartender Kunde gefunden.");
    }
  } catch (e) {
    log(`  Slots nicht messbar: ${(e as Error).message}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE BONITÄTSAUSKUNFT — wer hat sie, wer nicht?");
  // ═════════════════════════════════════════════════════════════════════════
  const [sch] = (await sqlPool`
    SELECT COUNT(*)::int AS bestellungen,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
           COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')::int AS gemeldet,
           COUNT(*) FILTER (WHERE payment_status NOT IN ('paid', 'claimed_paid'))::int AS offen,
           COUNT(DISTINCT person_id)::int AS personen
    FROM fiaon_applications
    WHERE (type = 'schufa' OR pack_key = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      AND merged_into IS NULL
  `) as any[];
  zahl("SCHUFA-Bestellungen", sch.bestellungen);
  zahl("… bezahlt", sch.bezahlt);
  zahl("… als bezahlt gemeldet", sch.gemeldet);
  zahl("… offen", sch.offen);
  zahl("… verschiedene Personen", sch.personen);

  // Doppelte SCHUFA-Bestellungen je Person? (Produkt-Hygiene)
  const [doppelt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM (
      SELECT person_id FROM fiaon_applications
      WHERE (type = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') AND merged_into IS NULL
        AND person_id IS NOT NULL
      GROUP BY person_id HAVING COUNT(*) > 1) x
  `) as any[];
  zahl("Personen mit MEHREREN SCHUFA-Bestellungen", doppelt.n,
    Number(doppelt.n) > 0 ? "Produkt-Hygiene: es soll eine geben" : "");

  // Wie viele bezahlte Paketkunden haben KEINE Auskunft?
  const [ohne] = (await sqlPool`
    SELECT COUNT(DISTINCT a.person_id)::int AS n
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications s
        WHERE s.person_id = a.person_id AND s.merged_into IS NULL
          AND (s.type = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%'))
  `) as any[];
  zahl("Bezahlte Paketkunden OHNE Auskunft", ohne.n, "das ist der Markt für Teil 2");
  befund.schufa = { ...sch, doppelt: Number(doppelt.n), ohneAuskunft: Number(ohne.n) };

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE PROVISIONS-WAND — Selbstzahler ohne Vertriebskontakt");
  // Die Regel: Zahlt der Kunde, BEVOR der zugewiesene Agent ihn je kontaktiert
  // hat, gibt es keine Provision. Frage: Wie viele Provisionen im Bestand
  // betreffen genau diesen Fall?
  // ═════════════════════════════════════════════════════════════════════════
  const [pr] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COALESCE(SUM(amount_cents), 0)::bigint AS summe,
           COUNT(*) FILTER (WHERE status = 'bestaetigt')::int AS bestaetigt,
           COUNT(*) FILTER (WHERE payout_id IS NOT NULL)::int AS ausgezahlt
    FROM fiaon_commissions WHERE status <> 'storniert'
  `) as any[];
  zahl("Provisionen insgesamt", pr.gesamt);
  zahl("… Summe", eur(Number(pr.summe)));
  zahl("… bestätigt", pr.bestaetigt);
  zahl("… schon ausgezahlt", pr.ausgezahlt, "diese sind Geld, das den Menschen gehört");

  // ── DER KERN: dokumentierter Kontakt VOR dem Zahlungseingang ────────────
  // „Kontakt" = ein Verlaufseintrag des ZUGEWIESENEN Agenten, der keine
  // System-Zeile ist, ODER ein Anruf dieses Agenten. Vor `paid_at`
  // (bzw. dem besten verfügbaren Zahlungszeitpunkt).
  const selbstzahler = (await sqlPool`
    SELECT c.id, c.agent_id, c.ref, c.amount_cents, c.status, c.payout_id,
           c.created_at::date AS gebucht_am, c.kind, c.note,
           ag.name AS agent,
           a.person_id,
           COALESCE(a.paid_at, a.claimed_paid_at, a.completed_at) AS bezahlt_am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.email) AS kunde,
           (SELECT COUNT(*)::int FROM fiaon_contact_log l
             WHERE l.ref = c.ref AND l.agent_id = c.agent_id
               AND l.type <> 'system'
               AND l.created_at < COALESCE(a.paid_at, a.claimed_paid_at, a.completed_at, NOW())
           ) AS verlauf_vorher,
           (SELECT COUNT(*)::int FROM fiaon_calls k
             WHERE k.person_id = a.person_id AND k.agent_id = c.agent_id
               AND k.beginn < COALESCE(a.paid_at, a.claimed_paid_at, a.completed_at, NOW())
           ) AS anrufe_vorher
    FROM fiaon_commissions c
    JOIN fiaon_applications a ON a.ref = c.ref
    LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
    WHERE c.status <> 'storniert' AND c.agent_id IS NOT NULL
      AND COALESCE(c.kind, 'vertrieb') NOT IN ('inkasso', 'onboarding', 'manuell')
    ORDER BY c.created_at DESC
  `) as any[];

  const ohneKontakt = selbstzahler.filter((p) =>
    Number(p.verlauf_vorher) === 0 && Number(p.anrufe_vorher) === 0);
  const mitKontakt = selbstzahler.length - ohneKontakt.length;
  const summeOhne = ohneKontakt.reduce((s, p) => s + Number(p.amount_cents ?? 0), 0);
  const ausgezahltOhne = ohneKontakt.filter((p) => p.payout_id != null);
  const summeAusgezahlt = ausgezahltOhne.reduce((s, p) => s + Number(p.amount_cents ?? 0), 0);

  log("");
  zahl("Vertriebsprovisionen mit Kundenbezug", selbstzahler.length);
  zahl("… MIT dokumentiertem Kontakt vor der Zahlung", mitKontakt);
  zahl("… OHNE — also Selbstzahler", ohneKontakt.length,
    "nach der Regel des Betreibers ohne Anspruch");
  zahl("… deren Summe", eur(summeOhne));
  zahl("… davon SCHON AUSGEZAHLT", ausgezahltOhne.length,
    "ausgezahltes Geld zurückzuholen ist eine andere Entscheidung");
  zahl("… deren Summe", eur(summeAusgezahlt));

  const jeAgent = new Map<string, { n: number; cents: number }>();
  for (const p of ohneKontakt) {
    const k = String(p.agent ?? `Konto ${p.agent_id}`);
    const v = jeAgent.get(k) ?? { n: 0, cents: 0 };
    v.n++; v.cents += Number(p.amount_cents ?? 0);
    jeAgent.set(k, v);
  }
  if (jeAgent.size > 0) {
    log("\n  JE MITARBEITER:");
    for (const [n, v] of Array.from(jeAgent.entries()).sort((a, b) => b[1].cents - a[1].cents)) {
      log(`    ${n.padEnd(24)} ${String(v.n).padStart(4)} Provisionen · ${eur(v.cents)}`);
    }
  }
  log(`\n  CSV: ${csv("mess-selbstzahler-provisionen.csv", ohneKontakt.map((p) => ({
    id: p.id, agent: p.agent, kunde: p.kunde, ref: p.ref,
    betrag: (Number(p.amount_cents) / 100).toFixed(2), status: p.status,
    ausgezahlt: p.payout_id != null ? "ja" : "nein",
    gebucht_am: p.gebucht_am, bezahlt_am: p.bezahlt_am,
  })))}`);
  log("\n  KEINE rückwirkende Stornierung. Diese Zahlen sind zur ENTSCHEIDUNG");
  log("  des Betreibers da — die Wand gilt ab dem Einbau für neue Buchungen.");
  befund.provisionen = {
    gesamt: Number(pr.gesamt), summe: Number(pr.summe),
    mitKontakt, ohneKontakt: ohneKontakt.length, summeOhneCents: summeOhne,
    ausgezahltOhne: ausgezahltOhne.length, summeAusgezahltCents: summeAusgezahlt,
  };

  // Gibt es die Wand heute schon irgendwo?
  const [dz] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE commission_basis = 'direktzahler'
  `) as any[];
  log("");
  zahl("Bestellungen mit Marke „direktzahler“", dz.n,
    "die Marke existiert — greift sie auch?");

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. ONBOARDING-VERGÜTUNG — die Grundlage");
  // ═════════════════════════════════════════════════════════════════════════
  const [ob] = (await sqlPool`
    SELECT COUNT(*)::int AS termine,
           COUNT(*) FILTER (WHERE status = 'erledigt')::int AS erledigt,
           COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst
    FROM fiaon_termine WHERE quelle = 'onboarding_call'
  `) as any[];
  zahl("Startgespräch-Termine", ob.termine);
  zahl("… erledigt", ob.erledigt, "so viele Gutschriften wären bisher entstanden");
  zahl("… nicht erschienen", ob.verpasst, "dafür gibt es nichts");
  const [gs] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions WHERE kind = 'onboarding'
  `) as any[];
  zahl("Bestehende Onboarding-Gutschriften", gs.n);
  const [obl] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents a
    WHERE a.active AND COALESCE(a.rolle, 'agent') = 'onboarding'
      AND NOT COALESCE(a.is_test_account, FALSE)
  `) as any[];
  zahl("Aktive Onboarding-Mitarbeiter", obl.n,
    Number(obl.n) === 0 ? "noch keiner — die Vergütung wartet auf den ersten" : "");
  befund.onboarding = { ...ob, gutschriften: Number(gs.n), mitarbeiter: Number(obl.n) };

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-kundenweg.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-kundenweg.json\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
