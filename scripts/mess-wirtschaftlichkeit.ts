// ═══════════════════════════════════════════════════════════════════════════
// DIE DECKUNGS-RECHNUNG NACHGERECHNET
//
// Der Auftrag verlangt, die Rechnung zu prüfen und im Report zu belegen: WAS
// fließt in „Personalkosten" ein? Diese Messung zerlegt sie in ihre Summanden
// und stellt sie neben das, was die Route ausgibt.
//
// NUR LESEND.   npx tsx scripts/mess-wirtschaftlichkeit.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { teamWirtschaftlichkeit } from "../server/lib/fiaon-wirtschaftlichkeit";

const eur = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
const log = (s = "") => console.log(s);

(async () => {
  const w = await teamWirtschaftlichkeit();
  log("");
  log("  WAS DIE ROUTE AUSGIBT");
  log(`    Personalkosten Monat  ${eur(w.personalkosten).padStart(14)}`);
  log(`    Umsatz Monat          ${eur(w.umsatz).padStart(14)}`);
  log(`    Deckung               ${String(w.deckung).padStart(12)} %`);
  log(`    Personen mit Gehalt   ${String(w.mitGehalt).padStart(14)}`);
  log(`    Satz: ${w.satz}`);

  const [g] = (await sqlPool`
    SELECT COALESCE(SUM(festgehalt_cents), 0)::bigint AS gehalt,
           COUNT(*) FILTER (WHERE festgehalt_cents > 0)::int AS mit_gehalt
    FROM fiaon_agents
    WHERE active AND NOT is_test_account
      AND (gehalt_ab IS NULL OR gehalt_ab <= CURRENT_DATE)
  `) as any[];
  const [k] = (await sqlPool`
    SELECT COALESCE(SUM(c.amount_cents), 0)::bigint AS provisionen_alle,
           COALESCE(SUM(c.amount_cents) FILTER (WHERE c.status = 'ausgezahlt'), 0)::bigint AS ausgezahlt,
           COALESCE(SUM(c.amount_cents) FILTER (WHERE COALESCE(c.kind,'') = 'stunden'), 0)::bigint AS stunden,
           COALESCE(SUM(c.base_amount_cents) FILTER (WHERE COALESCE(c.kind,'') <> 'stunden'), 0)::bigint AS umsatz,
           COUNT(*)::int AS zeilen
    FROM fiaon_commissions c
    JOIN fiaon_agents a ON a.id = c.agent_id AND NOT a.is_test_account
    WHERE c.status <> 'storniert' AND c.created_at >= date_trunc('month', NOW())
  `) as any[];
  const st = (await sqlPool`
    SELECT COALESCE(c.status,'—') AS status, COALESCE(c.kind,'—') AS art,
           COUNT(*)::int n, COALESCE(SUM(c.amount_cents),0)::bigint summe
    FROM fiaon_commissions c
    JOIN fiaon_agents a ON a.id = c.agent_id AND NOT a.is_test_account
    WHERE c.status <> 'storniert' AND c.created_at >= date_trunc('month', NOW())
    GROUP BY 1,2 ORDER BY 4 DESC
  `) as any[];

  log("");
  log("  DIE SUMMANDEN");
  log(`    Festgehälter (Monat, voll)         ${eur(g.gehalt).padStart(14)}   ${g.mit_gehalt} Personen`);
  log(`    davon anteilig gerechnet           ${eur(Number(w.personalkosten) - Number(k.provisionen_alle)).padStart(14)}`);
  log(`    Provisionen dieses Monats (alle)   ${eur(k.provisionen_alle).padStart(14)}   ${k.zeilen} Zeilen`);
  log(`    … davon Status „ausgezahlt“        ${eur(k.ausgezahlt).padStart(14)}`);
  log(`    … davon Art „stunden“              ${eur(k.stunden).padStart(14)}`);
  log(`    Summe                              ${eur(Number(w.personalkosten)).padStart(14)}`);
  log("");
  log(`    Umsatzbasis (base_amount, ohne Stunden) ${eur(k.umsatz).padStart(14)}`);
  log(`    Deckung = Umsatz / Personalkosten       ${(Number(k.umsatz) / Math.max(1, Number(w.personalkosten)) * 100).toFixed(1).padStart(12)} %`);
  log("");
  log("  Nach Status und Art:");
  for (const r of st) log(`    ${String(r.status).padEnd(16)} ${String(r.art).padEnd(14)} ${String(r.n).padStart(4)}  ${eur(r.summe).padStart(13)}`);
  log("");
  log("  BEFUND: In die Personalkosten fließen die Festgehälter ANTEILIG (nach");
  log("  verstrichenen Arbeitstagen) plus ALLE nicht stornierten Provisionen des");
  log("  Monats — also auch die noch nicht ausgezahlten. Das ist betriebswirtschaftlich");
  log("  richtig (die Verbindlichkeit entsteht mit dem Abschluss), aber es heißt");
  log("  NICHT „ausgezahlte Provisionen“. Die Erklärzeile muss das sagen.");
  log("  Stundenlöhne stecken als Provisionsart „stunden“ mit drin.");
  log("");
  await sqlPool.end();
})().catch((e) => { console.error(e); process.exit(1); });
