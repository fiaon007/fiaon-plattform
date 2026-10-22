// ═══════════════════════════════════════════════════════════════════════════
// KOOPERATION: PROVISION, „BERECHNUNG AUSGESETZT“ UND EMPFEHLUNGEN SETZEN (Register E-419, 22.10.2026)
// Derselbe Weg wie die Knöpfe im Chefbüro (server/lib/fiaon-koop-empfehlung.ts) — für den ersten Partner per Skript.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=… SESSION_SECRET=… APP_BASE_URL=… npx tsx scripts/koop-provision.ts \
//     --angebot <ref> [--prozent 30] [--aussetzen | --berechnen] [--empfehlung "Name|Notiz"]… [--schreiben] [--produktion]
// Ohne --schreiben nur Vorschau (Stand + Partnerbereich-Link). Gegen eine fremde Datenbank nur mit --produktion (Justins Go).
// ═══════════════════════════════════════════════════════════════════════════
const args = process.argv;
const arg = (n: string): string | null => { const i = args.indexOf(n); return i > 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; };
const alle = (n: string): string[] => args.flatMap((a, i) => (a === n && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
const schreiben = args.includes("--schreiben"); const produktion = args.includes("--produktion");
const ref = arg("--angebot"); const prozent = arg("--prozent");
if (!ref) { console.error("ABBRUCH: --angebot <ref> fehlt."); process.exit(2); }
let host = ""; try { host = new URL(String(process.env.DATABASE_URL ?? "")).hostname; } catch { /* unten */ }
if (!["127.0.0.1", "localhost"].includes(host) && !produktion) { console.error(`ABBRUCH: ${host || "?"} ist keine lokale Datenbank — nur mit --produktion.`); process.exit(2); }
const { sqlPool } = await import("../server/lib/db-pool");
const { angebotLesen } = await import("../server/lib/fiaon-global-angebot");
const E = await import("../server/lib/fiaon-koop-empfehlung");
const L = await import("../server/lib/fiaon-koop-lieferung");
const [a] = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE angebot_ref = ${ref} AND fassung LIKE 'IA-KOOP-%' LIMIT 1`) as any[];
if (!a) { console.error(`ABBRUCH: Kooperationsvertrag ${ref} nicht gefunden.`); await sqlPool.end(); process.exit(2); }
const wer = "Skript koop-provision (E-419)";
if (schreiben) {
  const body: Record<string, unknown> = {};
  if (prozent) body.prozent = prozent;
  if (args.includes("--aussetzen")) body.berechnungAusgesetzt = true;
  if (args.includes("--berechnen")) body.berechnungAusgesetzt = false;
  if (Object.keys(body).length) { const r = await E.koopProvisionSetzen({ id: a.id }, body, wer); console.log(r.ok ? `Gesetzt: ${JSON.stringify(body)}` : `FEHLER: ${r.error}`); }
  for (const e of alle("--empfehlung")) {
    const [name, notiz] = e.split("|");
    const z = (await angebotLesen({ id: Number(a.id) }))!;
    const r = await E.koopEmpfehlungEintragen(z, { name, notiz }, wer, "fiaon");
    console.log(r.ok ? `Empfehlung eingetragen: ${name} (#${r.id})` : `Empfehlung ${name}: ${r.error}`);
  }
}
const z = (await angebotLesen({ id: Number(a.id) }))!;
const s = await E.koopEmpfehlungSicht(z);
console.log(`Stand ${ref}: Provision ${s.prozent ?? "—"} % · Berechnung ${s.berechnungAusgesetzt ? "AUSGESETZT" : "aktiv"} · ${s.liste.length} Empfehlungen · Provision ${s.summe.provision} · offen ${s.summe.offen}`);
for (const x of s.liste) console.log(`  · ${x.name} — ${x.standText} · Umsatz ${x.umsatz} · Provision ${x.provision}`);
console.log(`Partnerbereich: ${L.koopPartnerLink(z)}`);
await new Promise((r) => setTimeout(r, 500));
await sqlPool.end().catch(() => {});
process.exit(0);
