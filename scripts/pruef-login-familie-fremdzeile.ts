// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-G (08.10.2026): Verdacht 1 — fremdes Passwort in der Familie
//
// Reine Logik, keine Datenbank. Belegt und widerlegt die Gegenprüfung:
//   decideLogin nahm ein Passwort aus JEDER Zeile der E-Mail-Familie (Kommentar
//   „Es darf in JEDER Zeile der Familie liegen"), während pickAccountRow die
//   BEZAHLTE Zeile des echten Kunden als Konto wählte. Wer über POST /application
//   eine eigene Zeile mit der E-Mail des Opfers und eigenem Passwort anlegt,
//   meldet sich damit an — und landet im Konto des Opfers.
//
// Der Prüfstand fährt denselben Fall VOR und NACH dem Fix:
//   VOR  → granted:true, account = Opfer-Zeile  (Übernahme)
//   NACH → granted:false (fremde Zeile zählt nicht) ODER account = eigene Zeile
//
// Aufruf: npx tsx scripts/pruef-login-familie-fremdzeile.ts   (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import { decideLogin, pickAccountRow } from "../server/fiaon-login-logic";
import { passwortHashen } from "../server/lib/fiaon-kunde-session";

let fehler = 0;
const ok = (b: boolean, text: string) => { console.log(`${b ? "  OK  " : " FEHL "} ${text}`); if (!b) fehler++; };

// ── Die Familie einer E-Mail, so wie loadLoginFamily sie lädt: absteigend nach
//    Alter (neueste zuerst). Das Opfer hat eine bezahlte Zeile mit Passwort und
//    Person; der Angreifer hängt seine frische Zeile oben an.
const opferKonto = {
  ref: "FIAON-OPFER", email: "opfer@example.com", person_id: 4242,
  password: passwortHashen("Opfer-Geheim-2026"),
  payment_status: "paid", account_status: "active", status: "completed",
  merged_into: null, type: "private", pack_key: "fiaon_classic",
  first_name: "Olga", last_name: "Beispiel",
};
const angreiferZeile = {
  ref: "FIAON-ANGRIFF", email: "opfer@example.com", person_id: null,
  password: passwortHashen("angreifer-pw"),
  payment_status: "pending", account_status: "pending", status: "started",
  merged_into: null, type: "private", pack_key: "fiaon_classic",
  first_name: "Olga", last_name: "Beispiel",
};
// loadLoginFamily: ORDER BY created_at DESC → die frische Angreiferzeile steht oben.
const familie = [angreiferZeile, opferKonto];

console.log("── Verdacht 1: fremdes Passwort in der Familie ──────────────────");

// 1) Der Angreifer meldet sich mit SEINEM Passwort an.
const urteil = decideLogin(familie, "angreifer-pw");

if (urteil.granted) {
  const kontoRef = (urteil as any).account?.ref;
  const matchedRef = (urteil as any).matched?.ref;
  console.log(`   granted=true · Konto=${kontoRef} · Treffer=${matchedRef}`);
  // Der Angriff ist belegt, wenn der Zugang gewährt wird UND das Konto NICHT die
  // eigene Angreiferzeile ist (sondern die des Opfers).
  const uebernahme = kontoRef === opferKonto.ref;
  ok(!uebernahme, uebernahme
    ? `ÜBERNAHME: fremdes Passwort öffnet das Opfer-Konto ${kontoRef} (Verdacht 1 offen)`
    : `kein Fremdzugriff: Zugang nur auf eigene Zeile ${kontoRef}`);
} else {
  console.log(`   granted=false · code=${(urteil as any).code}`);
  ok(true, "fremdes Passwort wird nicht als Familientreffer akzeptiert (Verdacht 1 geschlossen)");
}

// 2) Gegenprobe: Das ECHTE Passwort des Opfers muss weiterhin ins Opfer-Konto führen.
const echt = decideLogin(familie, "Opfer-Geheim-2026");
ok(echt.granted && (echt as any).account?.ref === opferKonto.ref,
  `echtes Opfer-Passwort führt ins Opfer-Konto (${(echt as any).account?.ref})`);

// 3) Gegenprobe: Der SCHUFA-Fall (Grund, aus dem die Familie-Regel existiert) muss
//    weiter funktionieren — Passwort an der Kontozeile, Zusatzbestellung ohne Passwort.
const schufaZeile = {
  ref: "FIAON-SCHUFA-123", email: "opfer@example.com", person_id: 4242,
  password: null, payment_status: "paid", account_status: "active",
  status: "completed", merged_into: null, type: "schufa", pack_key: null,
  first_name: "Olga", last_name: "Beispiel",
};
const mitSchufa = [schufaZeile, opferKonto]; // SCHUFA-Zeile ist die neueste
const schufaUrteil = decideLogin(mitSchufa, "Opfer-Geheim-2026");
ok(schufaUrteil.granted && (schufaUrteil as any).account?.ref === opferKonto.ref,
  `SCHUFA-Fall unverändert: Login findet das Konto trotz neuerer SCHUFA-Zeile (${(schufaUrteil as any).account?.ref})`);

// 4) Gegenprobe: zusammengeführte Dublette derselben Person, Passwort an der Dublette.
const dublette = {
  ref: "FIAON-DUBLETTE", email: "opfer@example.com", person_id: 4242,
  password: passwortHashen("Opfer-Geheim-2026"),
  payment_status: "pending", account_status: "pending", status: "started",
  merged_into: "FIAON-OPFER", type: "private", pack_key: "fiaon_classic",
  first_name: "Olga", last_name: "Beispiel",
};
const opferOhnePw = { ...opferKonto, password: null };
const mitDublette = [dublette, opferOhnePw];
const dubletteUrteil = decideLogin(mitDublette, "Opfer-Geheim-2026");
ok(dubletteUrteil.granted && (dubletteUrteil as any).account?.ref === opferKonto.ref,
  `Dublette derselben Person: Passwort an der Dublette öffnet das Konto (${(dubletteUrteil as any).account?.ref})`);

// ── E-302 Scheibe 2 (27.10.2026): die Fremdzeile hängt über den E-Mail-Alias an der PERSON ──
// bindePersonAnAntrag gibt einer untergeschobenen Zeile die person_id des Menschen, dessen Adresse sie trägt —
// angelegt, BEVOR dieser zahlt, behält sie ihr Passwort. Dann zählt sie für selberKunde zum selben Kunden.
console.log("\n── Scheibe 2: Fremdzeile an derselben Person ────────────────────");
const kunde = {
  ref: "FIAON-KUNDE", email: "kunde@example.com", person_id: 777, password: passwortHashen("Kunde-Geheim-1"),
  payment_status: "paid", account_status: "active", status: "completed", merged_into: null, type: "private",
  pack_key: "fiaon_classic", first_name: "Karla", last_name: "Kunde", birthdate: "1985-04-12",
};
const vorher = {
  ref: "FIAON-VORHER", email: "kunde@example.com", person_id: 777, password: passwortHashen("vorher-pw"),
  payment_status: "pending", account_status: "pending", status: "started", merged_into: null, type: "private",
  pack_key: "fiaon_classic", first_name: "Max", last_name: "Angreifer", birthdate: "1990-01-01",
};
const s2a = decideLogin([vorher, kunde], "vorher-pw");
ok(s2a.granted && (s2a as any).account?.ref === vorher.ref, `vorher angelegte Fremdzeile, Konto MIT Passwort → nur eigene Zeile (${(s2a as any).account?.ref})`);
const s2b = decideLogin([vorher, { ...kunde, password: null }], "vorher-pw");
ok(s2b.granted && (s2b as any).account?.ref === vorher.ref, `vorher angelegte Fremdzeile, Konto OHNE Passwort → nur eigene Zeile (${(s2b as any).account?.ref})`);
const nurPerson = { ...vorher, last_name: "Kunde", birthdate: null };
const s2c = decideLogin([nurPerson, { ...kunde, password: null }], "vorher-pw");
ok(s2c.granted && (s2c as any).account?.ref === vorher.ref, `gleicher Nachname, aber kein Geburtsdatum an der Zeile → nur eigene Zeile (${(s2c as any).account?.ref})`);
const s2d = decideLogin([vorher, kunde], "Kunde-Geheim-1");
ok(s2d.granted && (s2d as any).account?.ref === kunde.ref, `echtes Kunden-Passwort → sein Konto (${(s2d as any).account?.ref})`);
// Echte Familien, die weiter ins bezahlte Konto führen müssen (so im Bestand gemessen):
const antrag = { ...vorher, ref: "FIAON-ANTRAG", first_name: "Karla", last_name: "Kunde", birthdate: "1985-04-12", password: passwortHashen("antrag-pw") };
const s2e = decideLogin([antrag, { ...kunde, password: null }], "antrag-pw");
ok(s2e.granted && (s2e as any).account?.ref === kunde.ref, `Passwort am Antrag, bezahltes Konto ohne Passwort, gleicher Mensch → Konto (${(s2e as any).account?.ref})`);
const tippfehler = { ...antrag, first_name: "Karl a" };
const s2f = decideLogin([tippfehler, kunde], "antrag-pw");
ok(s2f.granted && (s2f as any).account?.ref === kunde.ref, `Vorname anders geschrieben, Nachname + Geburtsdatum gleich → Konto (${(s2f as any).account?.ref})`);
const kette = { ...vorher, ref: "FIAON-KETTE", merged_into: kunde.ref, first_name: "Firma", last_name: "GmbH", birthdate: null, password: passwortHashen("kette-pw") };
const s2g = decideLogin([kette, { ...kunde, password: null }], "kette-pw");
ok(s2g.granted && (s2g as any).account?.ref === kunde.ref, `zusammengeführte Kette mit anderem Namen → Konto wie bisher (${(s2g as any).account?.ref})`);

console.log(fehler === 0 ? "\n✓ Alle Prüfungen bestanden." : `\n✗ ${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
