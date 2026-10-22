// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — BESTANDSKUNDEN ZUM PERSÖNLICHEN ZUGANG EINLADEN (E-423, 22.10.2026)
//
// Justin: „Alle Kunden, die jetzt aktiv sind mit unterschriebenen Verträgen
// (die beiden Bestandskunden mit Begleit- bzw. Individualvertrag), sollen eine Mail mit ihrem eigenen Link bekommen, wo
// sie ihren Zugang festlegen."
//
// Dasselbe wie der Knopf „Zugang einladen“ im Chefbüro › Global › Kundenzugänge
// (globalKontoEinladen in server/lib/fiaon-global-konto.ts) — DER KNOPF IST DER
// BEVORZUGTE WEG: Er läuft auf dem Server, der die Links mit seinem eigenen
// SESSION_SECRET signiert. Dieses Skript signiert mit dem SESSION_SECRET seiner
// Umgebung — weicht es von Render ab, ist der Link in der Mail ungültig.
//
//   Trockenlauf (Vorgabe — schreibt nichts, schickt nichts):
//     npx tsx scripts/global-zugang-einladen.ts --email kunde@example.com
//     npx tsx scripts/global-zugang-einladen.ts --ref FIAON-IA-XXXXXX        (Angebot oder Akte)
//   Senden gegen die lokale Prüf-Datenbank (nur 127.0.0.1):
//     … --senden
//   Senden gegen die Produktion (ausdrücklich, beide Schalter):
//     … --produktion --senden
//   NUR DEN LINK ERZEUGEN — keine Systemmail (Justin: für die Bestandskunden schreibt die Assistenz eine persönliche
//   Mail als Entwurf; der Link kommt hinein). Vermerkt im Anmeldeprotokoll („einladung_link“) und im Verlauf jeder
//   verknüpften Akte und jedes Angebots:
//     … --nur-link                   (lokal)
//     … --produktion --nur-link      (Produktion — braucht das SESSION_SECRET von Render und APP_BASE_URL)
//
// Ohne --produktion verweigert das Skript jede Datenbank außer 127.0.0.1/localhost.
// ═══════════════════════════════════════════════════════════════════════════
const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i >= 0 ? String(process.argv[i + 1] ?? "") : null; };
const hat = (name: string) => process.argv.includes(name);

const emailArg = arg("--email"); const refArg = arg("--ref");
const nurLink = hat("--nur-link");
const senden = hat("--senden") || nurLink; const produktion = hat("--produktion");
if (!emailArg && !refArg) {
  console.error("Bitte --email <adresse> oder --ref <Angebots- oder Auftragsnummer> angeben. Trockenlauf ist Vorgabe; senden mit --senden.");
  process.exit(2);
}
let host = "";
try { host = new URL(String(process.env.DATABASE_URL || "")).hostname; } catch { /* unten */ }
if (!host) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!lokal && !produktion) {
  console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host} — gegen eine andere Datenbank als 127.0.0.1 nur mit --produktion.`);
  process.exit(2);
}
if (produktion && senden && !process.env.SESSION_SECRET) {
  console.error("ABBRUCH: SESSION_SECRET fehlt — ohne das Geheimnis von Render wäre der Link in der Mail ungültig. Bitte den Knopf im Chefbüro benutzen.");
  process.exit(2);
}
if (produktion && nurLink && !String(process.env.APP_BASE_URL || "").startsWith("https://")) {
  console.error("ABBRUCH: APP_BASE_URL fehlt (https://www.fiaon.com) — der Link zeigte sonst ins Leere.");
  process.exit(2);
}
if (produktion && senden && !nurLink && !process.env.BREVO_API_KEY) {
  console.error("ABBRUCH: BREVO_API_KEY fehlt — die Mail ginge nicht raus.");
  process.exit(2);
}

const K = await import("../server/lib/fiaon-global-konto");
const { KONTO_EINLADUNG_TAGE } = await import("../shared/fiaon-global-konto");
const { sqlPool } = await import("../server/lib/db-pool");

let email = emailArg ? emailArg.trim().toLowerCase() : "";
if (!email && refArg) {
  const kunde = (await K.kundeAusAngebot(refArg.trim())) ?? (await K.kundeAusAuftrag(refArg.trim()));
  if (!kunde) {
    console.error(`Zu „${refArg}“ gibt es kein angenommenes Angebot und keine Akte mit E-Mail-Adresse.`);
    await sqlPool.end({ timeout: 2 }); process.exit(1);
  }
  email = kunde.email;
}

const kand = await K.kandidatenFuerEmail(email);
const vorher = await K.kontoNachEmail(email);
console.log(`\nAdresse:        ${email}`);
console.log(`Datenbank:      ${host}${lokal ? " (lokal)" : " (PRODUKTION)"}`);
console.log(`Zugang bisher:  ${vorher ? `${vorher.status}${vorher.eingeladen_am ? `, eingeladen ${new Date(vorher.eingeladen_am).toISOString()}` : ""}` : "keiner"}`);
console.log(`Akten:          ${kand.auftraege.map((a) => `${a.ref} (${a.titel}, ${a.status})`).join(" · ") || "—"}`);
console.log(`Angebote:       ${kand.angebote.map((a) => `${a.ref} (${a.fassung}${a.auftragRef ? ` → ${a.auftragRef}` : ", ohne Akte"})`).join(" · ") || "—"}`);

const erg = await K.globalKontoEinladen(email, nurLink ? "Skript global-zugang-einladen (nur Link, persönliche Mail)" : "Skript global-zugang-einladen", { trocken: !senden, nurLink });
if (!erg.ok) {
  console.error(`\nNICHT eingeladen: ${erg.error}`);
  await sqlPool.end({ timeout: 2 }); process.exit(1);
}
console.log(`\n${erg.meldung}`);
console.log(`Verknüpft:      ${erg.refs.map((r) => `${r.art} ${r.ref}`).join(" · ")}`);
if (erg.link) console.log(`\nEINLADUNGSLINK (nur persönlich weitergeben, ${KONTO_EINLADUNG_TAGE} Tage, einmal):\n${erg.link}`);
if (!senden) console.log("\nTrockenlauf — nichts geschrieben, nichts verschickt. Senden mit --senden bzw. nur den Link mit --nur-link (Produktion zusätzlich --produktion).");
await sqlPool.end({ timeout: 2 });
