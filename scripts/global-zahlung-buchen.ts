// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSEINGANG VON HAND BUCHEN — Kapital-Angebot, Geld außerhalb des Bankbuchs (E-460, 29.10.2026)
//
// Justin (29.10.2026): „Das Geld … ist da — verbuche es bei uns, aber dem Kunden noch keine Bestätigung schicken … Aber
// verbuche es bei uns in der Plattform korrekt bitte.“
//
// WARUM ES DAS SKRIPT GIBT: Der Airwallex-Einleser liest nur das EUR-Konto (fiaon-airwallex.ts, lesen()). Eine Zahlung auf das
// AED-Konto (shared/fiaon-bank.ts) steht nie im Bankbuch und wird nie automatisch gebucht. Gebucht wird sie hier über den EINEN
// Buchungsweg (alsBezahltBuchen → onCustomerPaid → globalNachZahlung) — dasselbe, was der Knopf „bezahlt“ tut —, mit dem
// echten Eingangstag und dem Bankbeleg im internen Verlauf. Ins Bankbuch kommt die Fremdwährung NICHT: amount_cents wird dort
// als Euro gelesen (13.447 AED wären 13.447 € Umsatz).
//
// KEINE KUNDENMAIL: Erlaubt sind nur Teile eines Kapital-Angebots — ihr Zahlungsweg (kapitalNachZahlung) verschickt nichts,
// solange die Vertragsbestätigung schon raus ist; fehlt sie (Fassung C, Teil 1), lehnt das Skript ab. Alle anderen Global-Wege
// schicken beim Start eine Mail und gehören an den Knopf im Chefbüro. Zusätzlich hat der Lauf kein Netz (fetch gesperrt) und
// keine Schlüssel für Brevo, Gmail, Make, WhatsApp oder Twilio.
//
// Vorgabe: NUR VORSCHAU — die Verbindung ist dann „nur lesen“. Geschrieben wird mit --schreiben (lokal, nur Prüf-DB) bzw.
// --schreiben --produktion. Wiederholbar: Ist die Bestellung schon bezahlt, schreibt ein zweiter Lauf nichts.
//
// Aufruf (Vorschau gegen die Produktion, ohne die Adresse auszugeben):
//   sh ~/Developer/it-rettung/werkzeuge/ro-env.sh node_modules/.bin/tsx scripts/global-zahlung-buchen.ts --produktion \
//     --zweck FIAON-XXXXXX --datum JJJJ-MM-TT --beleg "<Konto, Betrag, Eingangszeit, Kennung der Bank>"
// Schreiben: dieselben Schalter plus --schreiben, gestartet mit env -i (nur DATABASE_URL, SESSION_SECRET, APP_BASE_URL).
// Das Repo ist öffentlich: Hier steht kein Kundendatum — Zweck und Beleg kommen nur aus dem Aufruf.
// ═══════════════════════════════════════════════════════════════════════════

const MIT_WERT = ["--zweck", "--datum", "--beleg"];
const OHNE_WERT = ["--schreiben", "--produktion"];
const argv = process.argv.slice(2);
const werte = new Map<string, string>();
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (MIT_WERT.includes(a)) {
    const w = argv[i + 1];
    if (w == null || w.startsWith("--")) abbruch(`${a} braucht einen Wert.`);
    werte.set(a, w);
    i++;
    continue;
  }
  if (OHNE_WERT.includes(a)) { schalter.add(a); continue; }
  abbruch(`Unbekannter Schalter „${a}“.`);
}
const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = ""; let dbName = "";
try { const u = new URL(url); host = u.hostname; dbName = u.pathname.replace(/^\//, ""); } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch("DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion.");
if (lokal && produktion) abbruch("--produktion, aber DATABASE_URL zeigt auf 127.0.0.1/localhost — bitte prüfen.");
if (schreiben && lokal && !/^fiaon_pruefstand_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB (fiaon_pruefstand_…), nicht in „${dbName}“.`);
// Eine Buchung braucht kein Netz — die Wege nach draußen werden abgeklemmt, auch wenn der Aufruf sie mitbrächte.
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN", "GOOGLE_SA_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async () => { throw new Error("Buchungs-Skript: kein Netz"); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}
// Die ensure…-Wege der Plattform (ALTER TABLE … IF NOT EXISTS) brauchen kurz eine Tabellensperre — lieber nach fünf Sekunden
// abbrechen als hinter einer langen Abfrage anstehen und dabei die Seite aufhalten.
if (schreiben && !lokal && !/[?&]lock_timeout=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}lock_timeout=5000&statement_timeout=60000`;
  process.env.DATABASE_URL = url;
}

const zweck = String(werte.get("--zweck") ?? "").trim();
const datum = String(werte.get("--datum") ?? "").trim();
const beleg = String(werte.get("--beleg") ?? "").trim();
if (!zweck) abbruch("--zweck fehlt (Verwendungszweck der Rechnung, z. B. FIAON-XXXXXX).");
if (!datum) abbruch("--datum fehlt (Tag des Geldeingangs laut Bank, JJJJ-MM-TT).");
if (beleg.length < 20) abbruch("--beleg fehlt oder ist zu kurz (Konto, Betrag, Eingangszeit, Kennung der Bank — mindestens 20 Zeichen).");

const { sqlPool } = await import("../server/lib/db-pool");
const { istGlobalPaket } = await import("../shared/fiaon-pakete");
const { istKapitalFassung, istKapitalCFassung } = await import("../shared/fiaon-global-angebot-kapital");
const { pruefeZahlungsdatum } = await import("../server/routes/fiaon-abo");

const VON = "E-460 Hand-Buchung (Justin 29.10.2026, Skript global-zahlung-buchen)";
const eur = (v: unknown) => `${Number(v ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tagDe = (iso: string) => iso.split("-").reverse().join(".");
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const ende = async (code: number): Promise<never> => { await sqlPool.end?.().catch(() => {}); process.exit(code); };

console.log(`Zahlung von Hand buchen · Datenbank ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"}`);

const d = pruefeZahlungsdatum(datum);
if (d.fehler) abbruch(d.fehler);

const bestellungen = (await sqlPool`
  SELECT ref, pack_key, payment_reference, payment_status, amount_due, currency, invoice_number, merged_into, person_id
    FROM fiaon_applications WHERE payment_reference = ${zweck}`) as any[];
if (bestellungen.length !== 1) abbruch(`Zum Zweck ${zweck} gibt es ${bestellungen.length} Bestellungen — erwartet genau eine.`);
const b = bestellungen[0];
if (b.merged_into) abbruch(`Die Bestellung ${b.ref} ist in ${b.merged_into} aufgegangen — dort buchen.`);
if (!istGlobalPaket(b.pack_key)) abbruch(`${b.ref} ist kein Global-Auftrag (${b.pack_key}) — Privatpakete bekommen beim Buchen die Zugangsmail: Knopf in der Zahlungszentrale.`);

const [t] = (await sqlPool`
  SELECT t.id, t.nr, t.titel, t.betrag_cents, t.bezahlt_am, a.id AS angebot_id, a.angebot_ref, a.fassung, a.status AS angebot_status,
         a.auftrag_ref, a.angenommen_am, a.frist_beginn, a.frist_ende
    FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
   WHERE t.bestell_ref = ${b.ref} LIMIT 1`) as any[];
if (!t) abbruch(`${b.ref} gehört zu keinem Angebotsteil — Global-Pakete schicken beim Start die Startmail: Knopf im Chefbüro.`);
if (!istKapitalFassung(t.fassung)) abbruch(`${t.angebot_ref} ist kein Kapital-Angebot (${t.fassung}) — dieser Zahlungsweg schickt beim Start eine Mail: Knopf im Chefbüro.`);
if (String(t.angebot_status) !== "angenommen") abbruch(`${t.angebot_ref} ist „${t.angebot_status}“, nicht angenommen.`);
const akteRef = String(t.auftrag_ref || b.ref);
const [akte] = (await sqlPool`
  SELECT ref, status, etappe, auftrag_mail_am, auftrag_mail_fehler, bezahlt_am, gestartet_am
    FROM fiaon_global_auftraege WHERE ref = ${akteRef}`) as any[];
if (!akte) abbruch(`Zur Bestellung gibt es keine Akte (${akteRef}) — ohne Akte startet nichts.`);
const startTeil = Number(t.nr) === 1;
if (startTeil && istKapitalCFassung(t.fassung) && !akte.auftrag_mail_am) {
  abbruch(`Die Vertragsbestätigung zu ${t.angebot_ref} ist nicht als verschickt vermerkt${akte.auftrag_mail_fehler ? ` (${akte.auftrag_mail_fehler})` : ""} — der Start würde sie jetzt schicken. Erst klären.`);
}

console.log(`  Bestellung ${b.ref} · Rechnung ${b.invoice_number ?? "—"} · ${eur(b.amount_due)} · Status ${b.payment_status}`);
console.log(`  Angebot ${t.angebot_ref} (${t.fassung}) · Teil ${t.nr} „${t.titel}“ · ${eur(Number(t.betrag_cents) / 100)} · angenommen ${iso(t.angenommen_am)}`);
console.log(`  Akte ${akteRef} · Status ${akte.status} · Etappe ${akte.etappe ?? 0} · Vertragsbestätigung ${iso(akte.auftrag_mail_am) ?? "—"}`);
console.log(`  Buchung: bezahlt per ${tagDe(d.datum)} · Beleg: ${beleg}`);

if (String(b.payment_status) === "paid") {
  console.log(`  [schon da] ${zweck} ist bezahlt — nichts zu tun.`);
  console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: false, schon: true, ref: b.ref })}`);
  await ende(0);
}
if (!["pending_payment", "claimed_paid"].includes(String(b.payment_status))) {
  abbruch(`Die Bestellung steht auf „${b.payment_status}“ — nur offene oder gemeldete Rechnungen werden gebucht. Im Chefbüro klären.`);
}
console.log(startTeil
  ? "  Folgen: Teil bezahlt, Garantiefrist ab dem Eingang, Aufgabe „Gründung bezahlt“ an Justin, Akte gestartet (Etappe 1). KEINE Mail an den Kunden."
  : "  Folgen: Teil bezahlt (Vermerk im Angebot und in der Akte), keine neue Frist. KEINE Mail an den Kunden.");

if (!schreiben) {
  console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: false, ref: b.ref, datum: d.datum })}`);
  await ende(0);
}

const beginn = new Date();
const { alsBezahltBuchen } = await import("../server/routes/fiaon-antrag");
const r = await alsBezahltBuchen(zweck, { zahlungsdatum: d.datum, quelle: VON });
if (!r.ok) abbruch(`Buchung abgelehnt: ${r.error}`);
console.log(`  [gebucht] ${zweck} bezahlt per ${tagDe(r.zahlungsdatum)}.`);

// alsBezahltBuchen ruft onCustomerPaid ohne await (wie für den Knopf) — der Lauf wartet auf den Zahlungsweg des Angebots,
// bevor er endet; sonst bräche process.exit die Aufgabe und den Start mittendrin ab.
const lage = async () => {
  const [tt] = (await sqlPool`SELECT bezahlt_am FROM fiaon_global_angebot_teile WHERE id = ${t.id}`) as any[];
  const [aa] = (await sqlPool`SELECT status, etappe FROM fiaon_global_auftraege WHERE ref = ${akteRef}`) as any[];
  const [vv] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${akteRef} AND created_at >= ${beginn} AND note LIKE ${`%${t.angebot_ref}%bezahlt%`}`) as any[];
  return { teilBezahlt: !!tt?.bezahlt_am, status: String(aa?.status ?? ""), etappe: Number(aa?.etappe ?? 0), vermerk: Number(vv?.n ?? 0) > 0 };
};
let stand = await lage();
const bis = Date.now() + 120_000;
while (Date.now() < bis && !(stand.teilBezahlt && stand.vermerk && (!startTeil || (stand.status === "gestartet" && stand.etappe >= 1)))) {
  await new Promise((ok) => setTimeout(ok, 1000));
  stand = await lage();
}
await new Promise((ok) => setTimeout(ok, 3000));
stand = await lage();
const fertig = stand.teilBezahlt && (!startTeil || stand.status === "gestartet");
console.log(`  ${fertig ? "[erledigt]" : "[OFFEN]   "} Zahlungsweg des Angebots: Teil bezahlt ${stand.teilBezahlt ? "ja" : "NEIN"} · Akte ${stand.status} · Etappe ${stand.etappe}`);

// Der Beleg — intern in der Akte (Chefbüro) und im Verlauf der Bestellung. Der Kunde sieht keins von beiden.
const { globalVerlauf } = await import("../server/lib/fiaon-global-auftrag");
const { verlaufSchreiben } = await import("../server/lib/fiaon-global-bereich");
await globalVerlauf(akteRef, `FIAON Global: Zahlungseingang von Hand gebucht (${VON}) — ${beleg}. Bezahlt per ${tagDe(d.datum)}; nicht im Bankbuch (der Einleser liest nur das EUR-Konto).`);
await verlaufSchreiben(akteRef, { art: "zahlung", text: `Zahlungseingang von Hand gebucht: ${beleg}`, sichtbar: false, von: "fiaon" });

const [mails] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE created_at >= ${beginn} AND person_id = ${b.person_id}`) as any[];
const [aufgabe] = (await sqlPool`SELECT id, titel FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${akteRef}:start`}`) as any[];
console.log(`  Mails an den Kunden seit der Buchung: ${Number(mails?.n ?? 0)} · Aufgabe: ${aufgabe ? `#${aufgabe.id} „${aufgabe.titel}“` : "—"}`);
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: true, ref: b.ref, datum: d.datum, fertig, mails: Number(mails?.n ?? 0), aufgabe: aufgabe?.id ?? null })}`);
await ende(fertig ? 0 : 1);
