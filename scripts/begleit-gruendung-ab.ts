// ═══════════════════════════════════════════════════════════════════════════
// BEGLEITVERTRAG: GRÜNDUNGSSTART EINTRAGEN (Register E-384, 16.10.2026)
//
// Die Zahlungsseite eines angenommenen Begleitvertrags (begleitZahlungsKontext) zeigt nach dem Zahlungseingang, ab wann
// FIAON die Anmeldung beim Bundesstaat einreicht — aus schalter.gruendungAb (JJJJ-MM-TT). Dieses Skript trägt genau dieses
// eine Feld ein (Vertragstext und Prüfsumme bleiben unberührt) und schreibt es in den Verlauf.
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=… npx tsx scripts/begleit-gruendung-ab.ts --ref FIAON-IA-… --ab JJJJ-MM-TT
//   … --produktion   → gegen die Produktion, NUR mit Justins Go
// ═══════════════════════════════════════════════════════════════════════════
const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const ref = String(arg("--ref") ?? "").trim().toUpperCase();
const ab = String(arg("--ab") ?? "").trim();
const produktion = process.argv.includes("--produktion");
if (!/^FIAON-IA-[A-Z0-9]+$/.test(ref)) { console.error("ABBRUCH: --ref FIAON-IA-… fehlt."); process.exit(2); }
if (!/^\d{4}-\d{2}-\d{2}$/.test(ab)) { console.error("ABBRUCH: --ab JJJJ-MM-TT fehlt."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!["127.0.0.1", "localhost"].includes(host) && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — nur mit --produktion.`); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const { verlaufAngebot } = await import("../server/lib/fiaon-global-angebot");
const [z] = (await sqlPool`
  UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || jsonb_build_object('gruendungAb', ${ab}::text), updated_at = NOW()
   WHERE angebot_ref = ${ref} AND status = 'angenommen' AND fassung LIKE 'IA-BEGLEIT-%'
   RETURNING id`) as any[];
if (!z) { console.error(`ABBRUCH: kein angenommener Begleitvertrag ${ref}.`); await sqlPool.end(); process.exit(1); }
await verlaufAngebot(Number(z.id), "Skript begleit-gruendung-ab", `Gründungsstart eingetragen: ${ab}`);
console.log(`Eingetragen: ${ref} · Gründungsstart ${ab}`);
await sqlPool.end();
process.exit(0);
