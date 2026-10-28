// ═══════════════════════════════════════════════════════════════════════════
// PRAXIS-PRÜFSTAND MIT DATENBANK: E-456 — „NEU FÜR SIE" (29.10.2026)
//
// Fährt die ECHTEN Server-Funktionen gegen eine LOKALE Kopie des Prüfstands — dieselben Wege, die Chefbüro/Office
// (Station speichern, Dokument ablegen) und die Portal-Route (lesen, gesehen) gehen:
//   1  frische Akte: keine Neuigkeiten (nichts bereitgestellt)
//   2  Team trägt die US-Nummer ein (Station „adresse“) → Neuigkeit „telefon“ mit der Nummer groß
//   3  Lesen schreibt nichts: zweimal lesen → neuigkeiten_gesehen_am bleibt NULL, Liste gleich
//   4  „Verstanden“ (gesehen bis stand) → Liste leer; ein „bis“ in der Zukunft wird auf jetzt gekappt, nie zurück
//   5  danach: EIN + Gründungsurkunde → genau diese zwei neu, die Nummer nicht mehr
//   6  erstes Öffnen nach Einführung: Akte mit Nummer von vor 20 Tagen → nicht im Fenster (14-Tage-Grenze)
// Legt zum Schluss zwei Bild-Akten an (eine Neuigkeit / drei Neuigkeiten), die NICHT als gesehen gelten — für die
// Screenshots über den lokalen Server. Die Vorschau („setzt nichts“) prüft der HTTP-Lauf gegen den Server.
//
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e456
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e456 node_modules/.bin/tsx scripts/pruef-portal-neuigkeiten-lokal.ts
//
// NIE GEGEN DIE PRODUKTION: weigert sich ohne 127.0.0.1/„fiaon_pruefstand_e456…“ und mit gesetzten Mail-/Zahl-Schlüsseln.
// ═══════════════════════════════════════════════════════════════════════════

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_e456/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen die lokale Kopie fiaon_pruefstand_e456 auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");
const N: any = await import("../server/lib/fiaon-global-neuigkeiten");

let gut = 0; const rot: string[] = [];
let aktuell = "";
const schritt = (nr: string, t: string) => { aktuell = nr; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: boolean, text: string, fund?: unknown): void {
  if (bed) { gut++; console.log(`  ok    ${text}`); return; }
  rot.push(`${aktuell}: ${text}`);
  console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 700)}` : ""}`);
}

const stempel = Date.now().toString(36).toUpperCase();
const CHEF = { id: 928, name: "Prüf-Leitung" };
const pdf = (x: string) => Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"), Buffer.from(`% ${x}\n`), Buffer.alloc(300, 0x20)]);

await A.ensureGlobalTabelle();
await L.ensureGlobalBereich();
await M.ensureGlobalMandat();

async function akte(ref: string, firma: string, alterTage = 8): Promise<void> {
  const mail = `${ref.toLowerCase()}@pruefmuster.example`;
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, amount_due, company_name, contact_name, contact_email, email)
    VALUES (${ref}, 'business', 'submitted', 'global_individuell', 'Begleitvertrag (Prüfstand)', ${"PAY-" + ref}, 'paid', NOW() - INTERVAL '7 days', 2900.00, ${firma}, 'Max Prüfmann', ${mail}, ${mail})`;
  await sqlPool`INSERT INTO fiaon_global_auftraege
      (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email,
       rechnung_ust_modus, zustaendig_agent_id, gestartet_am, created_at)
    VALUES (${ref}, 'global_individuell', 'DE',
      ${sqlPool.json({ name: firma, ort: "Musterstadt", land: "DE", strasse: "Prüfweg 1", plz: "12345" } as any)},
      ${sqlPool.json({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", funktion: "Geschäftsführer", email: mail, telefon: "+49301234567" } as any)},
      ${sqlPool.json({ annahme: "Auftrag zahlungspflichtig erteilen", begleitvertrag: true } as any)},
      'IA-BEGLEIT-PRUEF', 'de', NOW() - ${`${alterTage} days`}::interval, 'individualangebot', 'gestartet', ${firma}, ${mail}, 'none', 927, NOW() - ${`${alterTage} days`}::interval,
      NOW() - ${`${alterTage} days`}::interval)`;
  await M.globalMandatPortal(ref, true, CHEF);
}
const gesehenAm = async (ref: string) => ((await sqlPool`SELECT neuigkeiten_gesehen_am FROM fiaon_global_auftraege WHERE ref = ${ref}`) as any[])[0]?.neuigkeiten_gesehen_am ?? null;
const neu = (ref: string) => N.globalNeuigkeitenKunde(ref, "de");
const telefonSetzen = (ref: string) => M.globalStationSpeichern(ref, { schluessel: "adresse", status: "erledigt", werte: { usTelefon: "+1 307 555 0148" } }, CHEF);
const einSetzen = (ref: string) => M.globalStationSpeichern(ref, { schluessel: "ein", status: "erledigt", werte: { ein: "12-3456789" } }, CHEF);
const urkundeAblegen = (ref: string) => M.globalMandatDokument(ref, { art: "gruendungsurkunde", datei: { buffer: pdf(`Articles ${ref}`), originalname: "Articles_of_Organization.pdf" }, sichtbar: true, mitteilen: false, unterschrift: false }, CHEF);

const REF = `FIAON-E456-${stempel}-1`;
await akte(REF, "Prüfmuster Neu GmbH");
console.log(`Saat: ${REF}`);

schritt("1", "frische Akte → keine Neuigkeiten");
{
  const n = await neu(REF);
  ok(!!n && n.liste.length === 0, "Liste leer", n);
}

schritt("2", "Team trägt die US-Nummer ein → Neuigkeit mit der Nummer groß");
{
  const e = await telefonSetzen(REF);
  ok(!!e?.ok, "Station „adresse“ gespeichert (echter Weg des Chefbüros)", e);
  const n = await neu(REF);
  ok(n?.liste.length === 1 && n.liste[0].art === "telefon", "genau eine Neuigkeit: telefon", n?.liste);
  ok(n?.liste[0]?.gross?.wert === "+1 307 555 0148", "die Nummer groß", n?.liste[0]?.gross);
  ok(n?.liste[0]?.ziel === "adressen", "Ziel: Nummer & Adressen");
}

schritt("3", "Lesen schreibt nichts");
{
  const a = await neu(REF); const b = await neu(REF);
  ok((await gesehenAm(REF)) === null, "neuigkeiten_gesehen_am bleibt NULL nach zweimal Lesen");
  ok(JSON.stringify(a.liste) === JSON.stringify(b.liste), "gleiche Liste bei jedem Lesen");
}

schritt("4", "„Verstanden“ → gesehen bis zum Stand des Fensters → Liste leer");
{
  const n = await neu(REF);
  ok(await N.globalNeuigkeitenGesehen(REF, n.stand), "gesehen vermerkt");
  const g = await gesehenAm(REF);
  ok(!!g && new Date(g).toISOString() === n.stand, "Zeitpunkt = Stand des Fensters", { g, stand: n.stand });
  ok((await neu(REF)).liste.length === 0, "danach: keine Neuigkeit mehr");
  await N.globalNeuigkeitenGesehen(REF, "2020-01-01T00:00:00Z");
  ok(new Date(await gesehenAm(REF)).toISOString() === n.stand, "ein älteres „bis“ setzt nie zurück");
  await N.globalNeuigkeitenGesehen(REF, "2099-01-01T00:00:00Z");
  const zukunft = new Date(await gesehenAm(REF)).getTime();
  ok(zukunft <= Date.now() + 1000, "ein „bis“ in der Zukunft wird auf jetzt gekappt", new Date(zukunft).toISOString());
}

schritt("5", "danach: EIN + Gründungsurkunde → genau diese zwei");
{
  await new Promise((r) => setTimeout(r, 30));
  const e1 = await einSetzen(REF);
  const e2 = await urkundeAblegen(REF);
  ok(!!e1?.ok && !!e2?.ok, "EIN eingetragen, Urkunde abgelegt", { e1, e2 });
  const n = await neu(REF);
  const arten = n.liste.map((x: any) => x.art).sort();
  ok(arten.join(",") === "ein,urkunde", "neu: ein + urkunde (die Nummer nicht mehr)", n.liste.map((x: any) => [x.art, x.titel]));
  ok(n.liste.find((x: any) => x.art === "ein")?.gross?.wert === "12-3456789", "EIN groß");
}

schritt("6", "erstes Öffnen: Nummer von vor 20 Tagen flutet nicht");
{
  const R = `FIAON-E456-${stempel}-ALT`;
  await akte(R, "Prüfmuster Alt GmbH", 40);
  await telefonSetzen(R);
  await sqlPool`UPDATE fiaon_global_verlauf SET created_at = NOW() - INTERVAL '20 days' WHERE ref = ${R}`;
  ok((await neu(R)).liste.length === 0, "nichts im Fenster (Grenze: 14 Tage)");
  await sqlPool`UPDATE fiaon_global_verlauf SET created_at = NOW() - INTERVAL '10 days' WHERE ref = ${R}`;
  ok((await neu(R)).liste.length === 1, "vor 10 Tagen → noch im Fenster");
}

// ── Bild-Akten für die Screenshots (bleiben ungesehen) ──
const B1 = `FIAON-E456-${stempel}-BILD1`;
const B2 = `FIAON-E456-${stempel}-BILD2`;
await akte(B1, "Prüfmuster Nordlicht GmbH");
await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = ${sqlPool.json({ name: "NORDLICHT HOLDINGS LLC", form: "LLC", bundesstaat: "WY", gegruendetAm: "2026-10-14" } as any)} WHERE ref = ${B1}`;
await telefonSetzen(B1);
await akte(B2, "Prüfmuster Nordlicht GmbH");
await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = ${sqlPool.json({ name: "NORDLICHT HOLDINGS LLC", form: "LLC", bundesstaat: "WY", gegruendetAm: "2026-10-14" } as any)} WHERE ref = ${B2}`;
await telefonSetzen(B2); await einSetzen(B2); await urkundeAblegen(B2);
console.log(`\nBILD-AKTEN: ${B1} ${B2}`);
console.log(`TOKEN-HINWEIS: Tokens erzeugt der Bild-Lauf mit demselben SESSION_SECRET wie der Server.`);

console.log(`\nERGEBNIS: ${gut} grün, ${rot.length} rot`);
if (rot.length) console.log(rot.map((x) => `  - ${x}`).join("\n"));
await sqlPool.end?.({ timeout: 2 }).catch?.(() => {});
process.exit(rot.length ? 1 : 0);
