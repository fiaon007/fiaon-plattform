// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE VOLLSTÄNDIGE AKTE EINES GLOBAL-KUNDEN (22.10.2026)
//
// Ohne Argument rein — keine Datenbank, kein Netz. Prüft:
//   1  RECHNUNGEN  welche Bestellzeile dazugehört (Global ja, Einzelrechnungen ja, Privat-Linie und Kooperation nie),
//                  Status offen/bezahlt/storniert, Titel
//   2  UNTERSCHRIFT Formulare SS-4/8821 ab Gründung, weitere Dokumente, Stand (fehlt · vorbereitet · wartet ·
//                  unterschrieben), Vollständigkeit
//   3  ZIP         Dateinamen ASCII, ohne Pfad, eindeutig
//   4  VERDRAHTUNG Routen mit Zutritt (Token/Chef/Office), Bindung an das Mandat, Migration 122,
//                  Portal und Chefbüro zeigen alles
//   5  GEGENPROBE
//
// Mit `--lokal <REF>` zusätzlich NUR LESEND gegen eine lokale Datenbank (DATABASE_URL muss auf 127.0.0.1 zeigen):
// Rechnungen, Verträge und Pflichtstand eines Mandats, und das ZIP als Vorschau (kein Verlaufseintrag).
//
//   env -i HOME=$HOME PATH=$PATH npx tsx scripts/pruef-global-akte.ts
//   env -i HOME=$HOME PATH=$PATH PGSSLMODE=require DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<db> npx tsx scripts/pruef-global-akte.ts --lokal FIAON-…
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
const lokal = process.argv.indexOf("--lokal");
const LOKAL_REF = lokal > 0 ? String(process.argv[lokal + 1] ?? "") : "";
if (LOKAL_REF) {
  if (!/@127\.0\.0\.1:|@localhost:/.test(String(process.env.DATABASE_URL ?? ""))) { console.error("ABBRUCH: --lokal nur gegen eine lokale Datenbank."); process.exit(3); }
} else process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const A = await import("../shared/fiaon-global-akte");
const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

// ═══ 1 RECHNUNGEN ═════════════════════════════════════════════════════════════
abschnitt("1 Rechnungen");
for (const k of ["global_struktur", "global_vip", "global_individuell", "global_zusatz_domain", "llc_fasttrack", "llc_gruendung", "llc_gruendung_halb", "llc_paket"]) ok(A.globalAkteRechnungGehoertDazu(k), `gehört dazu: ${k}`);
for (const k of ["start", "pro", "ultra", "highend", "schufa", "auskunft_privat", "business_pro", "koop_kontakte", "", "gibtsnicht"]) ok(!A.globalAkteRechnungGehoertDazu(k), `nie in der Global-Akte: ${k || "(leer)"}`);
gleich(["global_kapital", "global_individuell", "global_zusatz_website", "llc_fasttrack"].map(A.globalAkteRechnungArt), ["paket", "angebot", "zusatz", "einzel"], "Art je Zeile");
gleich([A.globalAkteRechnungStatus("paid"), A.globalAkteRechnungStatus("pending_payment"), A.globalAkteRechnungStatus("claimed_paid"), A.globalAkteRechnungStatus("cancelled"), A.globalAkteRechnungStatus("paid", null, "2026-10-01"), A.globalAkteRechnungStatus("pending_payment", "2026-10-01")],
  ["bezahlt", "offen", "offen", "storniert", "storniert", "storniert"], "Status: gemeldet bleibt offen, erstattet/storniert = storniert");
gleich(A.globalAkteRechnungTitel("global_zusatz_domain", "x", "de"), "Ihre Domain & E-Mail", "Titel Zusatzdienst aus dem Katalog");
gleich(A.globalAkteRechnungTitel("llc_fasttrack", "x"), "Fast-Track Gründung US-Gesellschaft", "Titel Einzelrechnung aus dem Katalog");
gleich(A.globalAkteRechnungTitel("global_individuell", "FIAON Global – Firmenangebot"), "FIAON Global – Firmenangebot", "Angebot: Name an der Zeile");

// ═══ 2 DOKUMENTE ZUR UNTERSCHRIFT ═════════════════════════════════════════════
abschnitt("2 Dokumente zur Unterschrift");
gleich(A.GLOBAL_PFLICHT_UNTERLAGEN.map((p) => p.key), ["irs_ss4", "irs_8821"], "Formulare: IRS SS-4 und IRS 8821 — keine eigene Vollmacht (rechtliche Prüfung)");
ok(!JSON.stringify(A.GLOBAL_PFLICHT_UNTERLAGEN).toLowerCase().includes("umfassende vollmacht"), "keine „Umfassende Vollmacht“ mehr");
ok(A.GLOBAL_PFLICHT_UNTERLAGEN.every((p) => p.abGruendung), "beide Formulare erst nach der Gründung");
gleich(A.globalPflichtFuer(null, { gegruendet: false, bereit: [] }).length, 0, "vor der Gründung: nichts");
gleich(A.globalPflichtFuer(null, { gegruendet: true, bereit: [] }).map((p) => p.key), ["irs_ss4", "irs_8821"], "nach der Gründung: beide");
gleich(A.globalPflichtFuer(null, { gegruendet: false, bereit: ["irs_8821"] }).map((p) => p.key), ["irs_8821"], "vor der Gründung, aber vom Team abgelegt: dieses");
const L = A.GLOBAL_PFLICHT_UNTERLAGEN;
const st = (doks: Parameters<typeof A.globalPflichtStand>[1]) => A.globalPflichtStand(L, doks);
gleich(st([]).eintraege.map((e) => e.stand), ["fehlt", "fehlt"], "nichts da: alles fehlt");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: false, sichtbar: true }]).eintraege[1].stand, "wartet", "zur Unterschrift: wartet");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: false, unterschrieben: false, sichtbar: false }]).eintraege[1].stand, "vorbereitet", "intern abgelegt: vorbereitet");
gleich(st([{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: true, sichtbar: true }]).eintraege[1], { key: "irs_8821", stand: "unterschrieben", dokumentId: 1 }, "Original unterschrieben");
gleich(st([{ id: 9, pflichtKey: "irs_8821", unterschriftGefordert: false, unterschrieben: true, sichtbar: true, vonId: 1 }]).eintraege[1].stand, "fehlt", "die unterschriebene KOPIE zählt nicht als Original");
const weitere = st([{ id: 5, pflichtKey: null, unterschriftGefordert: true, unterschrieben: false, sichtbar: true, titel: "Bankformular" }]);
gleich(weitere.eintraege[2], { key: "dok-5", stand: "wartet", dokumentId: 5, titel: "Bankformular" }, "jedes andere Dokument „zur Unterschrift“ kommt dazu");
const alle = L.map((p, i) => ({ id: i + 1, pflichtKey: p.key, unterschriftGefordert: true, unterschrieben: true, sichtbar: true }));
gleich([st(alle).vollstaendig, st(alle).offen], [true, 0], "alles unterschrieben: vollständig (grün)");
gleich(A.globalPflichtStand([], []).vollstaendig, false, "nichts zu unterschreiben ist nie „vollständig“");

// ═══ 3 ZIP ═══════════════════════════════════════════════════════════════════
abschnitt("3 ZIP");
gleich(A.akteDateiname("FIAON Global – Gründung Ä/ö:x?.pdf"), "FIAON Global - Gruendung Ae_oe_x_.pdf", "Dateiname: ASCII, Umlaute ausgeschrieben, keine Pfadzeichen");
gleich(A.akteDateiname("../../etc/passwd"), "_.._etc_passwd", "kein Pfad aus dem ZIP heraus");
gleich(A.akteDateiname(""), "Dokument", "leer → Ersatzname");
ok(A.akteDateiname("x".repeat(500)).length <= 120, "höchstens 120 Zeichen");
{ const set = new Set<string>(); gleich([A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "a.pdf"), A.akteEindeutig(set, "b")], ["a.pdf", "a (2).pdf", "a (3).pdf", "b"], "gleiche Namen werden durchnummeriert"); }

// ═══ 4 VERDRAHTUNG ═══════════════════════════════════════════════════════════
abschnitt("4 Verdrahtung");
const lib = datei("server/lib/fiaon-global-akte-komplett.ts");
const bereich = datei("server/routes/fiaon-global-bereich.ts");
const chef = datei("server/routes/fiaon-chef-global.ts");
const chefQuelle = () => chef;
ok(/globalAkteRechnungGehoertDazu\(z\.pack_key\)/.test(lib) && /merged_into IS NULL AND archived_at IS NULL/.test(lib), "Rechnungen: Regel aus shared, keine zusammengeführten/archivierten Zeilen");
ok(/person_id = \$\{m\.personId\}::int/.test(lib) && /lower\(trim\(email\)\) = \$\{m\.email\}::text/.test(lib), "Rechnungen der Person: person_id, sonst E-Mail");
const pdf = lib.slice(lib.indexOf("export async function globalAkteRechnungPdf"), lib.indexOf("// ── 2 VERTRÄGE"));
ok(/\(await rechnungenRoh\(m\)\)\.find\(\(x\) => x\.bestellRef === bestellRef\)/.test(pdf), "Rechnungs-PDF nur, wenn sie zur Liste DIESES Mandats gehört");
ok(/!\/\^IA-KOOP\/i\.test/.test(lib), "Kooperationsverträge gehören nicht in die Kundenakte (E-423)");
ok(!/globalVollmacht|vollmacht-freigabe/.test(lib + chefQuelle()), "keine Vollmacht-Vorlage und kein Freigabe-Schalter mehr");
ok(/gegruendet: m\.gegruendet/.test(lib) && /fuer === "team" \|\| d\.sichtbar_fuer_kunde/.test(lib), "Formulare ab Gründung; Kunde sieht nur sichtbare Dokumente");
ok(/unterschrift_nachweis JSONB/.test(lib), "Datenmodell: leerer Nachweis für die spätere E-SIGN-Scheibe");
ok(/fuer === "kunde" && !d\.sichtbar_fuer_kunde && d\.von !== "kunde"/.test(lib), "Kunden-ZIP: nur, was der Kunde sieht");
ok(/new ZipArchive\(/.test(lib) && /zip\.pipe\(res\)/.test(lib) && /00 Inhaltsverzeichnis\.pdf/.test(lib), "ZIP gestreamt mit Inhaltsverzeichnis");
ok(/art: "akte_zip"/.test(lib) && /if \(!wer\.vorschau\)/.test(lib), "jeder ZIP-Abruf steht intern im Verlauf (Vorschau nicht)");
for (const r of ["/global/mein-auftrag/:ref/rechnung/:bestell", "/global/mein-auftrag/:ref/vertrag/:id", "/global/mein-auftrag/:ref/akte.zip"]) {
  const block = bereich.slice(bereich.indexOf(`router.get("${r}"`));
  ok(bereich.includes(`router.get("${r}"`) && block.indexOf("akteZutritt(req, res)") > 0 && block.indexOf("akteZutritt(req, res)") < 200, `Kunde ${r}: Token-Zutritt zuerst`);
}
ok(/zipJeRef\(ref\)/.test(bereich), "Kunden-ZIP gedrosselt");
ok(/"\/agent\/global\/auftraege\/:ref\/akte\.zip", requireAgent/.test(bereich) && /await office\(req, res, false\)/.test(bereich.slice(bereich.indexOf('"/agent/global/auftraege/:ref/akte.zip"'))), "Office-ZIP: Zuständigkeit wie die Akte");
for (const r of ["/akte\"", "/akte.zip\"", "/dokument/:id/pflicht\"", "/rechnung/:bestell\"", "/vertrag/:id\""]) ok(chef.includes(`"/chef/global/mandate/:ref${r}, requireChef("leitung")`), `Chef-Route ${r.replace(/"/g, "")}`);
ok(/if \(b\.pflichtKey && !pflicht\) return res\.status\(400\)/.test(chef), "unbekanntes Formular beim Hochladen abgelehnt");
const mig = datei("db/migrations/122_global_pflicht_unterlagen.sql");
ok(/ADD COLUMN IF NOT EXISTS pflicht_key TEXT/.test(mig) && /ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB/.test(mig) && /pflicht_key TEXT, ADD COLUMN IF NOT EXISTS unterschrift_nachweis JSONB/.test(lib), "Migration 122 = Laufzeit");
const portal = datei("client/src/pages/global-portal.tsx");
ok(/data-fiaon="portal-rechnungen"/.test(portal) && /data-fiaon="portal-vertraege"/.test(portal) && /data-fiaon="portal-pflicht"/.test(portal) && /data-fiaon="portal-zip"/.test(portal) && /data-fiaon="portal-einzelleistungen"/.test(portal), "Portal: Rechnungen, Verträge, Vollmachten, ZIP, weitere Leistungen");
ok(/w\.pflichtTun\(p\.titel\)/.test(portal) && /setDialog\(d\)/.test(portal), "Portal: Pflichtunterlage unter „Für Sie zu tun“ → Unterschrift im Dialog");
const cg = datei("client/src/components/admin/ChefGlobal.tsx");
ok(/key: "akte", titel: "Akte komplett"/.test(cg) && /reiter === "akte" && <AkteKomplett/.test(cg) && /data-fiaon="chef-akte-zip"/.test(cg), "Chefbüro: Reiter „Akte komplett“ mit ZIP");
ok(/data-fiaon="office-akte-zip"/.test(datei("client/src/pages/agent/global-akte.tsx")), "Office: „Akte als ZIP“");
ok(!/vollmacht-freigabe/.test(datei("client/src/components/admin/ChefGlobalEinstellungen.tsx")), "Chefbüro: kein Vollmacht-Schalter");

// ═══ 4b LOKAL (nur lesend) ═══════════════════════════════════════════════════
if (LOKAL_REF) {
  abschnitt(`4b Lokal: ${LOKAL_REF}`);
  const K = await import("../server/lib/fiaon-global-akte-komplett");
  const r = await K.globalAkteRechnungen(LOKAL_REF, (b) => `/x/${b}`);
  ok(r.length > 0, "Rechnungen gefunden", String(r.length));
  console.log(r.map((x: any) => `    ${x.nummer ?? x.bestellRef} · ${x.titel} · ${x.betragCents} · ${x.status}`).join("\n"));
  ok(!r.some((x: any) => /FIAON Pro|Kooperation/.test(String(x.titel))), "keine Privat-Linie, keine Kooperation");
  const pf = await K.globalPflichtSicht(LOKAL_REF, "kunde");
  ok(!!pf && Array.isArray(pf.eintraege), "Pflichtstand gelesen");
  let bytes = 0; const kopf: Record<string, string> = {};
  const fake = Object.assign(new Writable({ write(c, _e, cb) { bytes += c.length; cb(); } }), {
    setHeader: (k: string, v: string) => { kopf[k.toLowerCase()] = v; }, status: () => fake, json: () => fake, headersSent: false,
  }) as any;
  await K.globalAkteZip(LOKAL_REF, "kunde", fake, { name: "Prüfstand", agentId: null, vorschau: true });
  await new Promise((res) => setTimeout(res, 300));
  ok(kopf["content-type"] === "application/zip" && bytes > 1000, "ZIP gestreamt", `${bytes} Bytes`);
}

// ═══ 5 GEGENPROBE ════════════════════════════════════════════════════════════
abschnitt("5 Gegenprobe");
ok(!A.globalAkteRechnungGehoertDazu("pro"), "Gegenprobe: ein Privat-Abo kommt nie in die Global-Akte");
ok(A.globalPflichtStand(L, [{ id: 1, pflichtKey: "irs_8821", unterschriftGefordert: true, unterschrieben: false, sichtbar: true }]).vollstaendig === false, "Gegenprobe: eine wartende Unterschrift ist nicht vollständig");
ok(A.globalPflichtFuer(null).length === 0, "Gegenprobe: ohne Gründung erscheint kein Formular");
if (!LOKAL_REF) ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
if (LOKAL_REF) { const { sqlPool } = await import("../server/lib/db-pool"); await (sqlPool as any).end?.({ timeout: 2 }); }
