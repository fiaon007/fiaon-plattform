// NUR LESEND — prüft die Kennzahlen des neuen /admin-Dashboards gegen die echte
// Datenbank und rechnet die Plausibilität nach (Provision darf nie über dem
// Umsatz liegen, Summen müssen zu den Einzelzeilen passen).
// Aufruf: npx tsx scripts/pruef-hub-lage.ts
import "dotenv/config";
import { computeLage } from "../server/routes/fiaon-admin-hub";
import { sqlPool } from "../server/lib/db-pool";

const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;

(async () => {
  const t0 = Date.now();
  const l = await computeLage();
  console.log(`Abfragedauer: ${Date.now() - t0} ms\n`);

  console.log("── Umsatz ───────────────────────────────");
  console.log(`  heute   ${l.umsatz.heute.anzahl} Zahlungen · ${eur(l.umsatz.heute.cents)}`);
  console.log(`  gestern ${l.umsatz.gestern.anzahl} Zahlungen · ${eur(l.umsatz.gestern.cents)}`);
  console.log(`  Monat   ${l.umsatz.monat.anzahl} Zahlungen · ${eur(l.umsatz.monat.cents)}`);
  console.log(`  gesamt  ${l.umsatz.gesamt.anzahl} Zahlungen · ${eur(l.umsatz.gesamt.cents)}`);

  console.log("\n── Verlauf 14 Tage ──────────────────────");
  console.log("  " + l.umsatz.verlauf.map((v: any) => `${v.tag.slice(8)}.: ${(v.cents / 100).toFixed(0)}€`).join(" · "));

  console.log("\n── Provision Team ───────────────────────");
  console.log(`  heute ${eur(l.provision.heuteCents)} · Monat ${eur(l.provision.monatCents)} · gesamt ${eur(l.provision.gesamtCents)}`);
  console.log(`  Netto heute: ${eur(l.umsatz.heute.cents - l.provision.heuteCents)}`);

  console.log("\n── Rangliste (Monat) ────────────────────");
  l.agenten.forEach((a: any, i: number) => {
    const z = a.zusagen;
    console.log(`  ${i + 1}. ${a.name}: ${eur(a.monatCents)} Monat · ${eur(a.heuteCents)} heute · ${a.abschluesseMonat} Abschlüsse` +
      (z ? ` · Zusagen ${z.gesamt} (heute ${z.heuteFaellig}, überfällig ${z.ueberfaellig})` : " · keine Zusagen"));
  });

  console.log("\n── Angekündigte Zahlungen (Kunde) ───────");
  console.log(`  heute  ${l.ankuendigungen.heute.anzahl} · ${eur(l.ankuendigungen.heute.cents)}`);
  console.log(`  gesamt ${l.ankuendigungen.gesamt.anzahl} · ${eur(l.ankuendigungen.gesamt.cents)}`);
  console.log(`  davon älter als 7 Tage: ${l.ankuendigungen.alt.anzahl} · ${eur(l.ankuendigungen.alt.cents)}`);

  console.log("\n── Zusagen der Agenten (Kunde zahlt am ...) ──");
  console.log(`  gesamt ${l.zusagen.gesamt} · heute fällig ${l.zusagen.heuteFaellig} · künftig ${l.zusagen.kuenftig} · überfällig ${l.zusagen.ueberfaellig} · Volumen ${eur(l.zusagen.summeCents)}`);
  l.zusagen.jeAgent.forEach((z: any) => console.log(`    ${z.name}: ${z.gesamt} (heute ${z.heuteFaellig}, künftig ${z.kuenftig}, überfällig ${z.ueberfaellig}) · ${eur(z.summeCents)}`));

  // ── Plausibilität ──────────────────────────────────────────────────────────
  console.log("\n── Prüfungen ────────────────────────────");
  let rot = 0;
  const pruefe = (name: string, gut: boolean, hinweis = "") => {
    if (!gut) rot++;
    console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  ${hinweis}`}`);
  };
  pruefe("Provision Monat ≤ Umsatz Monat", l.provision.monatCents <= l.umsatz.monat.cents,
    `(${eur(l.provision.monatCents)} vs. ${eur(l.umsatz.monat.cents)})`);
  pruefe("Umsatz heute ≤ Umsatz Monat", l.umsatz.heute.cents <= l.umsatz.monat.cents);
  pruefe("Umsatz Monat ≤ Umsatz gesamt", l.umsatz.monat.cents <= l.umsatz.gesamt.cents);
  pruefe("Ankündigung heute ≤ Ankündigung gesamt", l.ankuendigungen.heute.anzahl <= l.ankuendigungen.gesamt.anzahl);
  pruefe("Alt-Ankündigungen ≤ gesamt", l.ankuendigungen.alt.anzahl <= l.ankuendigungen.gesamt.anzahl);
  pruefe("Zusagen-Summe = Einzelzeilen",
    l.zusagen.gesamt === l.zusagen.jeAgent.reduce((s: number, z: any) => s + z.gesamt, 0));
  pruefe("Zusagen-Aufteilung vollständig",
    l.zusagen.gesamt === l.zusagen.heuteFaellig + l.zusagen.kuenftig + l.zusagen.ueberfaellig);
  pruefe("Rangliste absteigend sortiert",
    l.agenten.every((a: any, i: number) => i === 0 || l.agenten[i - 1].monatCents >= a.monatCents));
  pruefe("Provisionssumme = Rangliste",
    l.provision.monatCents === l.agenten.reduce((s: number, a: any) => s + a.monatCents, 0));
  pruefe("Verlauf hat 14 Tage ohne Lücke", l.umsatz.verlauf.length === 14,
    `(${l.umsatz.verlauf.length})`);
  pruefe("Letzter Verlaufstag = heute-Umsatz",
    l.umsatz.verlauf[l.umsatz.verlauf.length - 1].cents === l.umsatz.heute.cents);
  pruefe("Vorletzter Verlaufstag = gestern-Umsatz",
    l.umsatz.verlauf[l.umsatz.verlauf.length - 2].cents === l.umsatz.gestern.cents);

  // ── Kreuzprüfung gegen die Team-Übersicht ──────────────────────────────────
  // Die Team-Seite (fiaon-team.ts) rechnet die Provision als Summe der drei
  // Statusgruppen bestaetigt + in_auszahlung + ausgezahlt. Das Dashboard rechnet
  // „alles außer storniert". Beides muss dasselbe ergeben — sonst stehen im
  // System zwei verschiedene Provisionswahrheiten, und der Betreiber kann
  // keiner mehr trauen. Diese Prüfung schlägt an, sobald ein neuer Status
  // eingeführt wird, den nur eine der beiden Seiten kennt.
  const wieTeam = await sqlPool`
    SELECT c.agent_id,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE c.status IN ('bestaetigt','in_auszahlung','ausgezahlt')), 0)::bigint AS team_summe,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE c.status <> 'storniert'), 0)::bigint AS dashboard_summe
    FROM fiaon_commissions c GROUP BY c.agent_id
  `;
  const abweichungen = wieTeam.filter((r: any) => Number(r.team_summe) !== Number(r.dashboard_summe));
  pruefe("Provision = Team-Seiten-Logik (bestätigt + in Auszahlung + ausgezahlt)",
    abweichungen.length === 0,
    `Abweichungen bei Agent(en): ${abweichungen.map((a: any) => a.agent_id).join(", ")}`);

  for (const a of l.agenten) {
    const t = wieTeam.find((r: any) => Number(r.agent_id) === a.id);
    if (t) {
      pruefe(`  ${a.name}: Gesamtprovision stimmt mit Team-Seite`,
        Number(t.team_summe) === a.gesamtCents,
        `(Dashboard ${eur(a.gesamtCents)} vs. Team ${eur(Number(t.team_summe))})`);
    }
  }

  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  await sqlPool.end();
  process.exit(rot === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
