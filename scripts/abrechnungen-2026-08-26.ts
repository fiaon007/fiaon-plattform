// ═══════════════════════════════════════════════════════════════════════════
// PROVISIONSABRECHNUNGEN ERZEUGEN — Kontoauszug vom 26.08.2026
//
// Justin: „Und denk an die Provisionsabrechnung PDF in unseren CI die du
//          hinterlegen musst."
//
// ── WARUM DER BESTEHENDE WEG UND KEIN NEUER ──────────────────────────────
// `generateCommissionStatement(payoutId)` erzeugt die Abrechnung aus den
// gebuchten Positionen, rendert sie mit `abrechnungPdf` im FIAON-CI, vergibt
// eine fortlaufende Nummer und legt sie in `fiaon_commission_statements` ab.
// Eine zweite Erzeugung daneben hiesse: zwei Belege desselben Vorgangs mit
// unterschiedlichem Layout — und irgendwann streiten sich zwei Zahlen.
//
// ── WAS DIESER LAUF TUT ──────────────────────────────────────────────────
// 1. Sammelt je Mitarbeiter die offenen Positionen aus diesem Kontoauszug.
// 2. Legt je Mitarbeiter EINE Auszahlung an (fiaon_payouts, Status offen).
// 3. Ruft den bestehenden Erzeuger und legt das PDF ab.
// Er VERSENDET nichts. Das Versenden ist ein eigener Vorgang mit eigenem
// Knopf in der Abrechnungs-Zentrale — 16 alte Abrechnungen wurden nie
// verschickt, und das soll eine bewusste Entscheidung bleiben.
//
// Aufruf:  npx tsx scripts/abrechnungen-2026-08-26.ts [--erzeugen]
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "../server/lib/db-pool";
import { generateCommissionStatement } from "../server/routes/fiaon-onboarding";

const ECHT = process.argv.includes("--erzeugen");
const MARKE = "Kontoauszug 26.08.2026";
const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const gruppen = (await sqlPool`
    SELECT c.agent_id, ag.name, ag.email, ag.bank_iban_masked,
           COUNT(*)::int AS anz,
           SUM(c.amount_cents)::int AS summe,
           MIN(c.created_at) AS von, MAX(c.created_at) AS bis
      FROM fiaon_commissions c
      JOIN fiaon_agents ag ON ag.id = c.agent_id
     WHERE c.note LIKE ${"%" + MARKE + "%"} AND c.payout_id IS NULL
     GROUP BY c.agent_id, ag.name, ag.email, ag.bank_iban_masked
     ORDER BY SUM(c.amount_cents) DESC`) as any[];

  if (!gruppen.length) {
    console.log("Keine offenen Positionen aus diesem Kontoauszug — nichts zu tun.");
    await sqlPool.end();
    return;
  }

  console.log(`${gruppen.length} Mitarbeiter mit offenen Positionen\n`);
  for (const g of gruppen) {
    console.log(`   ${String(g.name).padEnd(22)} ${String(g.anz).padStart(2)} Positionen · ${eur(Number(g.summe)).padStart(8)} EUR · IBAN ${g.bank_iban_masked ?? "—"}`);
  }

  if (!ECHT) {
    console.log("\nProbelauf. Mit --erzeugen werden Auszahlungen und Abrechnungen angelegt.");
    await sqlPool.end();
    return;
  }

  console.log("\n── ERZEUGE ──");
  for (const g of gruppen) {
    try {
      // Eine Auszahlung je Mitarbeiter, Status offen: Das Geld ist noch nicht
      // geflossen — der Beleg dokumentiert den Anspruch, nicht die Zahlung.
      const [p] = (await sqlPool`
        INSERT INTO fiaon_payouts (agent_id, amount_cents, status, iban_masked)
        VALUES (${g.agent_id}, ${Number(g.summe)}, 'requested', ${g.bank_iban_masked ?? null})
        RETURNING id`) as any[];
      await sqlPool`
        UPDATE fiaon_commissions SET payout_id = ${p.id}, updated_at = NOW()
         WHERE note LIKE ${"%" + MARKE + "%"} AND agent_id = ${g.agent_id} AND payout_id IS NULL`;

      const erg = await generateCommissionStatement(Number(p.id));
      const [s] = (await sqlPool`
        SELECT statement_no, (pdf_base64 IS NOT NULL) AS hat_pdf, length(pdf_base64) AS groesse
          FROM fiaon_commission_statements WHERE payout_id = ${p.id}`) as any[];
      console.log(`   ok  ${String(g.name).padEnd(22)} ${s?.statement_no ?? "—"}  ${s?.hat_pdf ? `PDF ${Math.round(Number(s.groesse) * 0.75 / 1024)} KB` : "OHNE PDF"}`);
      if (!s?.hat_pdf) console.log(`       Grund: ${(erg as any)?.pdfGrund ?? "unbekannt"}`);
    } catch (e: any) {
      console.log(`   ✗   ${g.name}: ${String(e?.message).slice(0, 120)}`);
    }
  }
  await sqlPool.end();
})();
