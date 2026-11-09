// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-487 (09.11.2026): FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN (Lauf firmen_trennen)
//
//   A  REIN (immer, ohne Datenbank, ohne Netz): Schalter (Vorgabe trocken, an nur ausdrücklich, Tippfehler = trocken),
//      Kandidat = Firmenname darf allein nicht verbinden (Platzhalter, „Selbständig / Freiberufler“, „Kleingewerbe“, Name ohne
//      Rechtsform; echte Namen mit Rechtsform nie), „dieselbe Person“ (Mail, 9 Ziffern, voller Name in jeder Reihenfolge, ä = ae,
//      person_id, ø/æ/ł, Anrede), fremd NUR wenn alles verschieden (Ketten, Firmen-Domain hält zusammen, Kopf ohne Kennzeichen
//      trennt nichts), Gruppierung, Schlüssel, Ziel (person_id vor Mail vor Nummer, nie die Quelle, nie nur der Name, nie eine
//      Fantasienummer, mehrere Karten mit derselben Nummer nur mit Namen), Verlaufszeilen (eindeutig; „Ich rufe selbst an“ bis
//      3 Minuten, Gesprächsweg, Maras WhatsApp-Zeilen; zweideutig bleibt), Notiz-Blöcke (wörtlich, ganze Zeilen, Mitternacht),
//      der ganze Planer (Termin-Auftrag und Buchungsmeldung ziehen mit, Stand der Quelle, Zuständige, „Privatkunde?“ nur aus
//      SEINEM Dossier, Paketwunsch mitten im Satz), der Schreibweg mit einer Attrappe (A12: Reihenfolge, Wände, Werte), der Lauf
//      mit einer Attrappe (A13: „aus“ fasst nichts an, „trocken“ ohne Tabellen-Änderung, Deckel je Lauf), Sätze, Meldung ohne
//      Kennungen, Quelltext-Wände.
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): Karte im alten Stil per
//      INSERT zusammengelegt; trocken schreibt nichts; echter Lauf trennt (zwei neue Karten, Stücke umgezogen, Eigentümer-Stücke
//      und Anruf-Notiz bleiben, Aufträge/Dossier-Faden/global_am neu, Protokoll); zweiter Lauf = 0; zwei gleichzeitige Läufe =
//      je Gruppe EINE Protokollzeile; vorhandene Karte der Person wird Ziel; dieselbe Person bleibt; veränderte Notiz = Vermerk;
//      Stand der Quelle („kein Interesse“ bleibt).
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-firmen-trennen.ts   (nur A)
//   createdb -T fiaon_pruefstand fiaon_pruefstand_ft …; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_ft?sslmode=require'   (A + B), danach dropdb.
//
// Verschickt nichts (der Lauf schreibt keine Mail, keine WhatsApp). Repo öffentlich: nur erfundene Menschen (*.example).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN", "OPENREGISTER_API_KEY", "GMAIL_SERVICE_ACCOUNT_JSON"]) {
  if (process.env[k] && process.env[k] !== "pruef") { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const P = await import("../shared/fiaon-firmen-trennen");
const { berlinZeitpunkt } = await import("../server/lib/fiaon-time");
const { berlinZeit } = await import("../shared/fiaon-global-lead");
// Berliner Wandzeit → Date (über die Server-Regel, nie „Date.UTC − 1 Stunde“ von Hand).
const um = (tag: string, hh: number, mm = 0, ss = 0, msek = 0) => new Date(berlinZeitpunkt(tag, hh * 60 + mm).getTime() + ss * 1000 + msek);
// Der Notiz-Block genau so, wie globalLeadAufnehmen ihn baut (die Wand A11 prüft, dass es dort so bleibt).
const blockWie = (tagIso: string, verlauf: string) => `FIAON Global (${tagIso.split("-").reverse().join(".")}): ${verlauf}`.slice(0, 600);
const eingangText = (anfrageId: number, rest: string) => `Bittet um einen Anruf (Anfrage #${anfrageId} über das Meta-Sofortformular). Paketwunsch: noch offen. Nachricht: ${rest}`;

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 Schalter „firmen_trennen“ (Vorgabe trocken)");
gleich(P.FIRMEN_TRENNEN_SCHALTER, "firmen_trennen", "Schlüssel in fiaon_settings");
gleich(P.trennModusLesen(undefined), "trocken", "fehlt → trocken (Teil B nicht gelaufen: erst nach Sicht der Historie „an“)");
gleich(P.trennModusLesen(""), "trocken", "leer → trocken");
gleich(P.trennModusLesen(" AN "), "an", "„AN“ → an (nur ausdrücklich)");
gleich(P.trennModusLesen("ja"), "an", "„ja“ → an");
gleich(P.trennModusLesen("trocken"), "trocken", "trocken → trocken");
gleich(P.trennModusLesen("aus"), "aus", "aus → aus");
gleich(P.trennModusLesen("0"), "aus", "0 → aus");
gleich(P.trennModusLesen("trockn"), "trocken", "Tippfehler → trocken (schreibt nie)");
ok(P.FIRMEN_TRENNEN_DECKEL >= 1 && P.FIRMEN_TRENNEN_DECKEL <= 10, `Deckel je Lauf klein (${P.FIRMEN_TRENNEN_DECKEL})`);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A2 Kandidat: der Firmenname darf allein nicht verbinden");
for (const [firma, person] of [
  ["Selbständig", "Erika Beispiel"], ["Selbstständig", "Erika Beispiel"], ["selbstaendig", "Erika Beispiel"], ["GmbH", "Erika Beispiel"],
  ["Siehe oben", "Erika Beispiel"], ["Mehrere", "Erika Beispiel"], ["noch offen", "Erika Beispiel"], ["privat", "Erika Beispiel"],
  ["Erika Beispiel (Firma noch offen)", "Erika Beispiel"], ["Privatperson · Erika Beispiel", "Erika Beispiel"], ["Erika Beispiel", "Erika Beispiel"],
  ["Beispiel", "Erika Beispiel"], ["-", "Erika Beispiel"], ["", "Erika Beispiel"],
  // Nachbesserung (Gutachten, Mangel 3): vor dem Fix legte der Eingang auch über diese Angaben zusammen.
  ["Selbständig / Freiberufler", "Erika Beispiel"], ["Kleingewerbe", "Erika Beispiel"], ["Freiberufler / Coach", "Erika Beispiel"],
  ["Selbständiger Berater", "Erika Beispiel"], ["Immobilien", "Erika Beispiel"], ["Alphaexample", "Erika Beispiel"],
] as const) ok(P.trennKandidat(firma, person), `„${firma}“ verbindet allein nicht → Kandidat`);
for (const firma of ["Muster Logistik GmbH", "Schmidt Immobilien GmbH", "Max Muster e.K.", "Alphaexample UG (haftungsbeschränkt)"]) {
  ok(!P.trennKandidat(firma, "Erika Beispiel"), `„${firma}“ ist ein echter Name mit Rechtsform → nie anfassen`);
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A3 Dieselbe Person?");
gleich(P.nummer9("+49 151 2345 6789"), "123456789", "Nummer: letzte 9 Ziffern");
gleich(P.nummer9("0151 23456789"), "123456789", "… gleich bei 0151");
gleich(P.nummer9("12345"), "", "zu kurz → keine Nummer");
ok(P.gleichePerson({ email: "Erika.Beispiel@Beispiel.example " }, { email: "erika.beispiel@beispiel.example" }), "gleiche Mail (Groß/Klein, Leerzeichen) → ja");
ok(P.gleichePerson({ telefon: "+49 151 2345 6789" }, { telefon: "0151/23456789" }), "„+49 151 …“ und „0151 …“ → ja");
ok(P.gleichePerson({ name: "Herr Max Muster" }, { name: "max  muster" }), "voller Name mit Anrede → ja");
ok(P.gleichePerson({ name: "Dr. Søren Nørby" }, { name: "Soren Norby" }), "ø → o → ja");
ok(P.gleichePerson({ name: "Max Muster" }, { name: "Muster Max" }), "Namensteile vertauscht → ja (Gutachten, Mangel 12)");
ok(P.gleichePerson({ name: "Jürgen Müller" }, { name: "Juergen Mueller" }), "ü = ue → ja");
ok(P.gleichePerson({ name: "Jürgen Müller" }, { name: "Juergen Mueller" }), "… auch mit zerlegtem Umlaut (NFD)");
ok(P.gleichePerson({ name: "Jürgen Müller" }, { name: "Jurgen Muller" }), "ü = u (ohne Punkte getippt) → weiter ja");
ok(!P.gleicherName("Jürgen Müller", "Jürgen Möller"), "verschiedene Namen bleiben verschieden");
ok(!P.gleichePerson({ name: "Max" }, { name: "Max" }), "nur Vorname → nein");
ok(!P.gleichePerson({ name: "Max Muster", email: "max@a-firma.example", telefon: "0151 11111111" }, { name: "Eva Muster", email: "eva@b-firma.example", telefon: "0151 22222222" }), "alles verschieden → nein");
ok(P.gleichePerson({ personIds: [null, 7001] }, { personIds: [7001] }), "gemeinsame person_id → ja");
ok(!P.gleichePerson({ email: "", telefon: "" , name: "" }, { email: "", telefon: "", name: "" }), "leere Felder sind nie gleich");
ok(P.zusammengehoerig({ email: "max@muster-bau.example" }, { email: "eva@muster-bau.example" }), "gleiche Firmen-Domain hält zusammen (im Zweifel nicht trennen)");
ok(!P.zusammengehoerig({ email: "max@gmail.com" }, { email: "eva@gmail.com" }), "Freemail-Domain hält nicht zusammen");
ok(!P.kontaktErkennbar({ name: "Max" }) && P.kontaktErkennbar({ telefon: "0151 23456789" }), "Kopf erkennbar: Vorname allein nein, Nummer ja");
ok(P.nummerTrivial("123456789") && P.nummerTrivial("000000000") && P.nummerTrivial("987654321") && P.nummerTrivial("121212121") && P.nummerTrivial("890123456"),
  "Fantasienummern: 123456789, 000000000, 987654321, 121212121, 890123456");
ok(!P.nummerTrivial("151234567") && !P.nummerTrivial("210000002"), "echte Nummern sind nicht trivial");
gleich([P.nummer9Echt("+49 123 456789"), P.nummer9Echt("+49 152 1000 0002")], ["", "210000002"], "nummer9Echt: Fantasienummer → leer");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A4 Fremd nur, wenn ALLES verschieden — Gruppierung nach Person");
{
  const kopf = { personIds: [7001], email: "erik@eigner.example", telefon: "+49 152 1000 0001", name: "Erik Eigner" };
  const e = (anfrageId: number, k: Partial<{ email: string; telefon: string; name: string; personIds: number[] }>) => ({ anfrageId, am: "2026-03-02T10:00:00Z", ...k });
  const mehrere = P.trennPlan(501, kopf, [
    e(901, { email: "erik@eigner.example", telefon: "+49 152 1000 0001", name: "Erik Eigner" }),
    e(902, { email: "frieda@fremd-eins.example", telefon: "+49 152 1000 0002", name: "Frieda Fremd" }),
    e(903, { email: "franz@fremd-zwei.example", telefon: "+49 152 1000 0003", name: "Franz Fremder" }),
  ]);
  gleich(mehrere.eigene, [901], "mehrere Menschen: der Eingang des Kopfs bleibt");
  gleich(mehrere.gruppen.map((g) => g.anfrageIds), [[902], [903]], "… zwei fremde Gruppen");
  gleich(mehrere.gruppen.map((g) => g.schluessel), ["trennung:501:902", "trennung:501:903"], "… Schlüssel je Gruppe");
  const nummer = P.trennPlan(501, kopf, [e(904, { email: "erik@neu-eigner.example", telefon: "0152 10000001", name: "Erik E." })]);
  gleich(nummer.gruppen.length, 0, "gleiche Nummer, andere Mail → keine Trennung");
  const vertauscht = P.trennPlan(501, kopf, [e(912, { email: "e.eigner@neu.example", telefon: "0152 77777777", name: "Eigner Erik" })]);
  gleich(vertauscht.gruppen.length, 0, "derselbe Name in anderer Reihenfolge, neue Mail und Nummer → bleibt (im Zweifel zusammen)");
  const kette = P.trennPlan(501, kopf, [
    e(905, { email: "zweite@kette.example", telefon: "0152 10000001", name: "x" }),
    e(906, { email: "zweite@kette.example", telefon: "0152 99999999", name: "y" }),
  ]);
  gleich(kette.gruppen.length, 0, "Kette (Kopf ↔ Nummer ↔ Mail) bleibt beim Eigentümer");
  const domain = P.trennPlan(501, { ...kopf, email: "erik@muster-bau.example" }, [e(907, { email: "eva@muster-bau.example", telefon: "0152 33333333", name: "Eva Anders" })]);
  gleich(domain.gruppen.length, 0, "gleiche Firmen-Domain → im Zweifel keine Trennung");
  const zwei = P.trennPlan(501, kopf, [
    e(902, { email: "frieda@fremd-eins.example", telefon: "", name: "Frieda Fremd" }),
    e(908, { email: "FRIEDA@fremd-eins.example", telefon: "0152 44444444", name: "F. Fremd" }),
    e(902, { email: "frieda@fremd-eins.example" }),
  ]);
  gleich(zwei.gruppen.map((g) => g.anfrageIds), [[902, 908]], "zwei Anfragen derselben fremden Person → EINE Gruppe (doppelte Kennung zählt einmal)");
  gleich(zwei.gruppen[0]?.schluessel, "trennung:501:902,908", "… Schlüssel mit allen Anfragen der Gruppe");
  const person = P.trennPlan(501, kopf, [e(909, { email: "xaver@anders.example", telefon: "0152 55555555", name: "Xaver Anders", personIds: [7001] })]);
  gleich(person.gruppen.length, 0, "gleiche person_id (z. B. über die Buchung) → bleibt");
  const blind = P.trennPlan(502, { name: "Erik" }, [e(910, { email: "a@a-firma.example" }), e(911, { email: "b@b-firma.example" })]);
  ok(blind.gruppen.length === 0 && !!blind.grund, "Kopf ohne Kennzeichen → nichts getrennt, mit Grund");
  gleich(P.trennSchluessel(501, [903, 902, 902]), "trennung:501:902,903", "Schlüssel sortiert und ohne Doppelte");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A5 Ziel: vorhandene Karte derselben Person, sonst neu");
{
  const mitglied = [{ personIds: [7002], email: "frieda@fremd-eins.example", telefon: "+49 152 1000 0002", name: "Frieda Fremd" }];
  const karten = [
    { id: 501, personId: null, email: "frieda@fremd-eins.example", telefon: null },
    { id: 512, personId: null, email: null, telefon: "0152 10000002" },
    { id: 511, personId: null, email: "frieda@fremd-eins.example", telefon: null },
    { id: 510, personId: 7002, email: null, telefon: null },
  ];
  gleich(P.zielKarteWaehlen(501, mitglied, karten), { id: 510, ueber: "person" }, "person_id vor Mail vor Nummer, nie die Quelle");
  gleich(P.zielKarteWaehlen(501, mitglied, karten.filter((k) => k.id !== 510)), { id: 511, ueber: "mail" }, "ohne person_id: über die Mail");
  gleich(P.zielKarteWaehlen(501, mitglied, [{ id: 512, telefon: "0152 10000002" }]), { id: 512, ueber: "nummer" }, "… sonst über die 9 Ziffern");
  gleich(P.zielKarteWaehlen(501, mitglied, [{ id: 513, email: "andere@anders.example" }]), null, "nur der Name zählt nie → neue Karte");
  gleich(P.zielKarteWaehlen(501, mitglied, [{ id: 501, email: "frieda@fremd-eins.example" }]), null, "die Quelle ist nie das Ziel");
  // Gutachten, Mangel 13: Fantasienummer und mehrere Karten mit derselben Nummer.
  const fantasie = [{ personIds: [], email: "neu@fremd.example", telefon: "123456789", name: "Frieda Fremd" }];
  gleich(P.zielKarteWaehlen(501, fantasie, [{ id: 514, telefon: "+49 123456789", name: "Otto Dritter" }]), null, "Fantasienummer wählt nie die Karte eines weiteren Fremden");
  const zweiKarten = [{ id: 515, telefon: "0152 10000002", name: "Otto Dritter" }, { id: 516, telefon: "0152 10000002", name: "Fremd Frieda" }];
  gleich(P.zielKarteWaehlen(501, mitglied, zweiKarten), { id: 516, ueber: "nummer" }, "mehrere Karten mit der Nummer → nur die mit demselben vollen Namen");
  gleich(P.zielKarteWaehlen(501, mitglied, [zweiKarten[0], { id: 517, telefon: "0152 10000002", name: "Ute Vierte" }]), null, "… ohne Namen → neue Karte");
  gleich(P.zielKarteWaehlen(501, mitglied, [{ id: 518, telefon: "0152 10000002", name: "Otto Dritter" }]), { id: 518, ueber: "nummer" }, "eine einzige Karte mit der Nummer gilt (wie im Eingang)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A6 Verlaufszeilen: nur mit eindeutigem Bezug");
{
  const t = um("2026-03-02", 16, 13);
  const plus = (msek: number) => new Date(t.getTime() + msek);
  const bekannt = new Set([901, 902]);
  const marken = [
    { traeger: "a:901", art: "dossier" as const, am: plus(0) },
    { traeger: "a:902", art: "dossier" as const, am: plus(8000) },
    { traeger: "a:902", art: "takt" as const, am: plus(60_000) },
    { traeger: "t:4401", art: "gespraech" as const, am: plus(120_000) },
    { traeger: "a:902", art: "selbst" as const, am: plus(600_000) },
    { traeger: "a:902", art: "wa" as const, am: plus(900_000) },
  ];
  const z = (id: number, art: string, ergebnis: string | null, am: Date, notiz = "", agentName = "System") => ({ id, art, ergebnis, notiz, am, agentName });
  gleich(P.logZeileZuordnen(z(8001, "global", "anfrage", t, eingangText(902, "…")), bekannt, marken).traeger, ["a:902"], "Eingangszeile über „(Anfrage #n über …)“");
  gleich(P.logZeileZuordnen(z(8002, "global", "anfrage", t, eingangText(999, "…")), bekannt, marken).traeger, [], "unbekannte Anfrage-Nummer → kein Bezug");
  gleich(P.logZeileZuordnen(z(8003, "global", "lead_meldung", plus(60_003), ""), bekannt, marken).traeger, ["a:902"], "Lead-Meldung 3 ms neben T1 → Bezug");
  gleich(P.logZeileZuordnen(z(8004, "global", "lead_meldung", plus(70_000), ""), bekannt, marken).traeger, [], "10 s daneben → kein Bezug");
  gleich(P.logZeileZuordnen(z(8005, "anruf", "erreicht_interesse", plus(60_003), "Notiz"), bekannt, marken).traeger, [], "Anrufe haben nie einen Bezug");
  gleich(P.logZeileZuordnen(z(8006, "global", "gespraech_mail", plus(120_001), ""), bekannt, marken).traeger, [], "Gesprächs-Mails bleiben (kein Bezug)");
  // Gutachten, Mangel 4: „Justin ruft selbst an“ folgt selbst_am erst nach leadStandSetzen.
  gleich(P.logZeileZuordnen(z(8007, "global", "selbst", plus(600_000 + 41_000), "", "Justin Schwarzott"), bekannt, marken).traeger, ["a:902"], "„selbst“ 41 s nach selbst_am → Bezug");
  gleich(P.logZeileZuordnen(z(8008, "global", "selbst", plus(600_000 + 170_000), "", "Justin Schwarzott"), bekannt, marken).traeger, ["a:902"], "… auch nach knapp 3 Minuten");
  gleich(P.logZeileZuordnen(z(8009, "global", "selbst", plus(600_000 - 30_000), "", "Justin Schwarzott"), bekannt, marken).traeger, [], "… nie deutlich VOR der Marke");
  gleich(P.logZeileZuordnen(z(8020, "global", "gespraechsweg", plus(900_004), "Gesprächsweg gewählt: WhatsApp", P.MARA_WHATSAPP), bekannt, marken).traeger, ["a:902"], "Gesprächsweg neben weg_am → Bezug");
  gleich(P.logZeileZuordnen(z(8021, "global", "erzaehlt", plus(3_600_000), "WhatsApp: möchte erst im Mai starten", P.MARA_WHATSAPP), bekannt, marken, ["a:902"]).traeger, ["a:902"],
    "Maras „WhatsApp: …“ ohne Marke → über die WhatsApp-Kontakte der Karte");
  gleich(P.logZeileZuordnen(z(8022, "global", "erzaehlt", plus(3_600_000), "Hat zwei Standorte", "Daniel Team"), bekannt, marken, ["a:902"]).traeger, [], "„erzählt“ aus dem Cockpit bleibt");
  const seite = new Map<string, number | "eigen">([["a:901", "eigen"], ["a:902", 0], ["t:4401", "eigen"]]);
  const v = P.logZeilenVerteilen([
    z(8010, "global", "dossier", plus(8003)),            // nur neben 902 → Gruppe 0
    z(8011, "global", "dossier", plus(4000)),            // neben 901 UND 902 → zweideutig
    z(8012, "global", "dossier", plus(3)),               // nur neben 901 → bleibt (eigen)
    z(8013, "global", "termin_steht", plus(120_003)),    // Gespräch des Eigentümers → bleibt
    z(8014, "global", "anfrage", t, eingangText(902, "x")),
    z(8015, "global", "erzaehlt", plus(3_600_000), "WhatsApp: Notiz", P.MARA_WHATSAPP), // WhatsApp beider Seiten → zweideutig
  ], bekannt, marken, seite, ["a:902", "w:unbekannt"]);
  gleich(v.jeGruppe.get(0), [8010, 8014], "eindeutig zur Gruppe: Dossier-Zeile und Eingangszeile");
  gleich(v.zweideutig, [{ id: 8011, gruppen: [0] }, { id: 8015, gruppen: [0] }], "neben zwei Seiten / WhatsApp beider Seiten → zweideutig (bleibt, Vermerk)");
  ok(P.hatNotizBlock({ art: "global", ergebnis: "anfrage", agentName: "Website" }) && P.hatNotizBlock({ art: "global", ergebnis: "termin_gebucht", agentName: "Website" })
    && !P.hatNotizBlock({ art: "global", ergebnis: "dossier", agentName: "System" }), "Notiz-Block nur zu Eingang und Buchung (Absender „Website“)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A7 Notiz-Blöcke: wörtlich, als ganze Zeilen");
{
  const v1 = eingangText(901, "Was planen Sie? — Weg zum Kapital\nAnzeige: Prüfanzeige · 13 s");
  const v2 = eingangText(902, "Was planen Sie? — Noch offen\nKampagne: Prüfkampagne");
  const anruf = "Ehemals Berater, möchte zuerst eine Struktur — Rückruf Donnerstag (Anruf-Notiz ohne Kopf)";
  const b1 = blockWie("2026-03-02", v1), b2 = blockWie("2026-03-08", v2);
  const notiz = [b1, b2, anruf].join("\n");
  // Eingang am 08.03. um 00:08 Uhr Berlin (UTC noch der 07.03.) — der Block trägt den BERLINER Tag.
  const z2 = { notiz: v2, am: um("2026-03-08", 0, 8, 38, 145) };
  const f2 = P.notizBlockFinden(notiz, z2);
  ok(!!f2 && f2.block === b2 && f2.index === b1.length + 1, "Eingang um 00:08 Uhr Berlin → Block mit dem Berliner Datum gefunden");
  const nach = P.notizOhneBlock(notiz, f2!.index, f2!.block.length);
  gleich(nach, [b1, anruf].join("\n"), "Block heraus — die Anruf-Notiz ohne Kopf bleibt (kein „bis zur nächsten Kopfzeile“)");
  // Eingang 23:59:59,9 Uhr, Verlaufszeile 00:00:00,1 Uhr — der Block trägt den Vortag.
  const vMitternacht = eingangText(903, "kurz vor Mitternacht");
  const bM = blockWie("2026-03-09", vMitternacht);
  ok(P.notizBlockFinden([b1, bM].join("\n"), { notiz: vMitternacht, am: um("2026-03-10", 0, 0, 0, 100) })?.block === bM, "Zeile kurz nach Mitternacht → Block des Vortags gefunden");
  ok(P.notizBlockFinden([b1, bM.replace("Mitternacht", "Mitternacht!")].join("\n"), { notiz: vMitternacht, am: um("2026-03-09", 23, 59) }) === null, "veränderter Block → nicht gefunden (Notiz bleibt unberührt)");
  ok(P.notizBlockFinden([b2, b2].join("\n"), z2) === null, "doppelt vorhanden → nicht angefasst");
  ok(P.notizBlockFinden(`Vorher ${b2}`, z2) === null, "nicht am Zeilenanfang → keine ganze Zeile → nicht angefasst");
  const lang = eingangText(904, "x".repeat(900));
  ok(blockWie("2026-03-02", lang).length === 600 && P.notizBlockText(lang, "2026-03-02") === blockWie("2026-03-02", lang), "Block höchstens 600 Zeichen — wie im Eingang");
  const t = P.notizTrennen(notiz, [{ notiz: v2, am: z2.am.toISOString() }, { notiz: "fehlt", am: z2.am.toISOString() }]);
  ok(t.bloecke.length === 1 && t.nicht === 1 && t.rest === [b1, anruf].join("\n"), "notizTrennen: ein Block umgezogen, einer nicht gefunden (Vermerk)");
  gleich(P.notizOhneBlock("A\nB\nC", 0, 1), "B\nC", "erste Zeile heraus");
  gleich(P.notizOhneBlock("A\nB\nC", 4, 1), "A\nB", "letzte Zeile heraus");
  gleich(P.notizOhneBlock("A", 0, 1), "", "einzige Zeile heraus");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A8 Der ganze Planer an einer nachgebauten Karte (mehrere Menschen mit „Selbständig“)");
{
  const K = 501, A1 = 901, A2 = 902, A3 = 903;
  const t1 = um("2026-03-02", 16, 13, 8), t2 = um("2026-03-03", 17, 18, 37), t3 = um("2026-03-08", 0, 8, 38);
  const p = (d: Date, msek: number) => new Date(d.getTime() + msek);
  const buchung = um("2026-03-02", 16, 14, 39);
  const v = (id: number, rest: string) => eingangText(id, rest);
  const vB = "Erstgespräch gebucht: 05.03.2026 um 09:00 Uhr mit Justin. Paketwunsch: Global Struktur (2.499 €).";
  const anruf = "Hat schon eine Struktur im Kopf — Justin führt selbst (Anruf-Notiz ohne Kopf)";
  const notiz = [blockWie("2026-03-02", v(A1, "Eigner")), blockWie("2026-03-02", vB), blockWie("2026-03-03", v(A2, "Fremd eins")), blockWie("2026-03-08", v(A3, "Fremd zwei")), anruf].join("\n");
  const stand = {
    karten: [
      { id: K, firma: "Selbständig", ansprechpartner: "Erik Eigner", email: "erik@eigner.example", telefon: "+49 152 1000 0001", person_id: 7001, notiz, paketwunsch: "Global Struktur (2.499 €)", zustaendig_agent_id: 42 },
      { id: 520, firma: "Muster Logistik GmbH", ansprechpartner: "Max Muster", email: "max@muster-logistik.example", telefon: null, person_id: null, notiz: null, paketwunsch: null, zustaendig_agent_id: 42 },
    ],
    anfragen: [
      { id: A1, name: "Erik Eigner", email: "erik@eigner.example", telefon: "+49 152 1000 0001", firma: "Selbständig", person_id: null, created_at: t1, land: null, ist_test: false, text: "Paketwunsch: noch offen", zustaendig_agent_id: 42 },
      { id: A2, name: "Frieda Fremd", email: "Frieda@Fremd-Eins.example", telefon: "+49 152 1000 0002", firma: "Selbständig", person_id: null, created_at: t2, land: "DE", ist_test: false, text: "Paketwunsch: noch offen", zustaendig_agent_id: 42 },
      { id: A3, name: "Franz Fremder", email: "franz@fremd-zwei.example", telefon: "+49 152 1000 0003", firma: "Selbständig", person_id: null, created_at: t3, land: null, ist_test: false, text: "Paketwunsch: noch offen", zustaendig_agent_id: 42 },
      { id: 921, name: "Max Muster", email: "max@muster-logistik.example", telefon: null, firma: "Muster Logistik GmbH", person_id: null, created_at: t1, land: null, ist_test: false, text: null, zustaendig_agent_id: null },
      { id: 922, name: "Eva Muster", email: "eva@muster-logistik.example", telefon: null, firma: "Muster Logistik GmbH", person_id: null, created_at: t2, land: null, ist_test: false, text: null, zustaendig_agent_id: null },
    ],
    dossiers: [
      { id: 701, anlass: "anfrage", anlass_id: A1, firma_id: K, mail_basis_am: p(t1, 437), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Erik Eigner · warm" },
      { id: 702, anlass: "anfrage", anlass_id: A2, firma_id: K, mail_basis_am: p(t2, 285), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Erik Eigner · warm" },
      { id: 703, anlass: "anfrage", anlass_id: A3, firma_id: K, mail_basis_am: p(t3, 229), mail_ki_am: null, temperatur: "heiss", faden_betreff: "Lead: Erik Eigner · warm" },
      { id: 704, anlass_id: 921, firma_id: 520, mail_basis_am: p(t1, 100), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Muster Logistik GmbH · warm" },
    ],
    wege: [
      { anfrage_id: A2, firma_id: null, willkommen_am: um("2026-03-09", 10, 38), nachfass_am: null },
      { anfrage_id: A3, firma_id: null, willkommen_am: um("2026-03-09", 10, 39), nachfass_am: null },
    ],
    takte: [
      { anfrage_id: A1, firma_id: K, t1_am: p(t1, 501), e15_am: null, e60_am: null, e120_am: null, vertretung_am: null },
      { anfrage_id: A2, firma_id: null, t1_am: p(t2, 414), e15_am: p(t2, 1_200_000), e60_am: null, e120_am: null, vertretung_am: null },
      { anfrage_id: A3, firma_id: null, t1_am: p(t3, 227), e15_am: null, e60_am: null, e120_am: null, vertretung_am: null },
    ],
    gespraeche: [{ termin_id: 4401, anfrage_id: A1, firma_id: K, person_id: 7001, created_at: p(buchung, -31), d2_am: p(buchung, 259) }],
    wa: [],
    auftraege: [
      { id: 6001, schluessel: `global-anfrage:${A1}`, link: `/agent/firmen?firma=${K}`, zustaendig_agent_id: 42 },
      { id: 6002, schluessel: `global-anfrage:${A2}`, link: `/agent/firmen?firma=${K}`, zustaendig_agent_id: 43 },
      { id: 6003, schluessel: `global-anfrage:${A3}`, link: `/agent/firmen?firma=${K}`, zustaendig_agent_id: 43 },
      { id: 6005, schluessel: "global-termin:4401", link: `/agent/firmen?firma=${K}`, zustaendig_agent_id: 42 },
    ],
    logs: [
      { id: 8101, firma_id: K, art: "global", ergebnis: "anfrage", notiz: v(A1, "Eigner"), created_at: p(t1, 10), agent_name: "Website" },
      { id: 8102, firma_id: K, art: "global", ergebnis: "dossier", notiz: "Lead-Dossier an Justin", created_at: p(t1, 440), agent_name: "System" },
      { id: 8103, firma_id: K, art: "global", ergebnis: "lead_meldung", notiz: "Lead-Meldung an das Team", created_at: p(t1, 504), agent_name: "System" },
      { id: 8104, firma_id: K, art: "global", ergebnis: "termin_gebucht", notiz: vB, created_at: buchung, agent_name: "Website" },
      { id: 8105, firma_id: K, art: "global", ergebnis: "termin_steht", notiz: "„Termin steht“ an Justin", created_at: p(buchung, 262), agent_name: "System" },
      { id: 8106, firma_id: K, art: "global", ergebnis: "anfrage", notiz: v(A2, "Fremd eins"), created_at: p(t2, 13), agent_name: "Website" },
      { id: 8107, firma_id: K, art: "global", ergebnis: "dossier", notiz: "Lead-Dossier an Justin", created_at: p(t2, 288), agent_name: "System" },
      { id: 8108, firma_id: K, art: "global", ergebnis: "anfrage", notiz: v(A3, "Fremd zwei"), created_at: p(t3, 12), agent_name: "Website" },
      { id: 8109, firma_id: K, art: "global", ergebnis: "dossier", notiz: "Lead-Dossier an Justin", created_at: p(t3, 233), agent_name: "System" },
      { id: 8110, firma_id: K, art: "global", ergebnis: "gespraech_mail", notiz: "Erinnerung am Vortag versandt", created_at: um("2026-03-04", 9, 3), agent_name: "System" },
      { id: 8111, firma_id: K, art: "global", ergebnis: "erzaehlt", notiz: anruf, created_at: um("2026-03-05", 9, 42), agent_name: "Justin" },
      { id: 8112, firma_id: K, art: "global", ergebnis: "gespraech_gefuehrt", notiz: "Erstgespräch geführt", created_at: um("2026-03-05", 9, 49), agent_name: "Justin" },
      { id: 8113, firma_id: 520, art: "global", ergebnis: "anfrage", notiz: v(921, "echte Firma"), created_at: t1, agent_name: "Website" },
      { id: 8114, firma_id: 520, art: "global", ergebnis: "anfrage", notiz: v(922, "echte Firma"), created_at: t2, agent_name: "Website" },
    ],
  };
  const pl = P.kartenPlanen(stand);
  gleich([pl.karten, pl.platzhalter, pl.uebersprungen], [2, 1, 0], "zwei Karten gelesen, ein Kandidat (die echte Firma mit Rechtsform nie)");
  const plan = pl.plaene.find((x) => x.quelleId === K)!;
  gleich(plan.eigene, [A1], "Eigentümer behält seine Anfrage");
  gleich(plan.gruppen.map((g) => g.anfrageIds), [[A2], [A3]], "zwei fremde Gruppen");
  ok(!pl.plaene.some((x) => x.quelleId === 520), "echte Firma mit zwei Menschen → kein Plan");
  const [g2, g3] = plan.gruppen;
  gleich(g2.logIds, [8106, 8107], "Gruppe 1: Eingangs- und Dossier-Zeile");
  gleich(g3.logIds, [8108, 8109], "Gruppe 2: Eingangs- und Dossier-Zeile");
  gleich([g2.dossierIds, g2.wegAnfragen, g2.taktAnfragen, g2.auftragIds, g2.gespraechTermine], [[702], [A2], [A2], [6002], []], "Gruppe 1: Dossier, Lead-Weg, Takt (leer → gefüllt), Auftrag — kein Gespräch");
  gleich([g3.dossierIds, g3.auftragIds], [[703], [6003]], "Gruppe 2: Dossier und Auftrag — der Termin-Auftrag des Eigentümers bleibt");
  gleich([g2.zweideutig, g3.zweideutig], [0, 0], "keine zweideutige Zeile");
  gleich([g2.zustaendigAgentId, g2.zustaendigKandidaten], [43, [43, 42]], "zuständig wie der Auftrag, danach die Anfrage (die Transaktion prüft, ob aktiv)");
  gleich([g2.kontakt.firma, g2.kontakt.name, g2.kontakt.email, g2.kontakt.land], ["Selbständig", "Frieda Fremd", "frieda@fremd-eins.example", "DE"], "Kopf der neuen Karte aus der Anfrage (Mail klein)");
  gleich(g2.kontakt.am, t2.toISOString(), "global_am = Eingang der Gruppe");
  gleich(g2.fadenStamm, "Lead: Frieda Fremd · warm", "eigener Faden-Stamm (Name statt Platzhalter)");
  gleich(g3.fadenStamm, "Lead: Franz Fremder · heiß", "… mit der Temperatur des Dossiers");
  // Der Stand: zuletzt setzte der Eingang von Gruppe 2 ihn (08.03.); das letzte eigene Ereignis war das geführte Gespräch (05.03.).
  gleich(g2.stand, null, "Gruppe 1 setzte den Stand nicht zuletzt");
  gleich(g3.stand, { zeileId: 8108, wiedervorlageBehalten: false, eigen: { status: "in_arbeit", wiedervorlage: "2026-03-06" }, eigenText: "Gespräch geführt am 05.03.2026" },
    "Gruppe 2 setzte ihn → danach gilt der Stand nach dem geführten Gespräch (in Arbeit, Wiedervorlage am Folgetag)");
  // Die Notiz, wie die beiden Transaktionen sie nacheinander sähen.
  const n2 = P.notizTrennen(notiz, g2.blockZeilen);
  const n3 = P.notizTrennen(n2.rest, g3.blockZeilen);
  gleich([n2.bloecke.length, n2.nicht, n3.bloecke.length, n3.nicht], [1, 0, 1, 0], "je Gruppe ein Notiz-Block umgezogen");
  gleich(n3.rest, [blockWie("2026-03-02", v(A1, "Eigner")), blockWie("2026-03-02", vB), anruf].join("\n"), "Eigentümer behält Eingang, Buchung und die Anruf-Notiz ohne Kopf");
  ok(!P.paketwunschVonGruppe("Global Struktur (2.499 €)", g2.texte, plan.eigeneBelege), "Paketwunsch des Eigentümers (aus seiner Buchung) bleibt");
  gleich(plan.eigenerWunsch, "Global Struktur (2.499 €)", "jüngster eigener Paketwunsch — auch mitten in der Buchungszeile (Gutachten, Mangel 8)");
  // Dieselbe Person mit zwei Anfragen, und dieselbe Nummer mit neuer Mail → keine Trennung.
  const gleichePersonStand = {
    ...stand,
    karten: [{ ...stand.karten[0], id: 530 }],
    anfragen: [stand.anfragen[0], { ...stand.anfragen[0], id: 931, email: "neu.erik@eigner.example" }],
    logs: [{ ...stand.logs[0], id: 8201, firma_id: 530 }, { ...stand.logs[0], id: 8202, firma_id: 530, notiz: v(931, "zweite") }],
    dossiers: [], wege: [], takte: [], gespraeche: [], auftraege: [],
  };
  gleich(P.kartenPlanen(gleichePersonStand).plaene[0]?.gruppen.length, 0, "zwei Anfragen derselben Person (gleiche Nummer, neue Mail) → keine Trennung");
  const testStand = { ...gleichePersonStand, anfragen: [stand.anfragen[0], { ...stand.anfragen[1], id: 931, ist_test: true }] };
  gleich(P.kartenPlanen(testStand).plaene[0]?.gruppen.length, 0, "eine Testanfrage wird nie getrennt");
  // Paketwunsch: stammte der Wunsch am Kopf nur vom fremden Eingang, gilt der jüngste eigene (mitten in der Buchungszeile).
  const wunschStand = {
    ...stand,
    karten: [{ ...stand.karten[0], paketwunsch: "Global Banking (4.999 €)" }, stand.karten[1]],
    anfragen: stand.anfragen.map((a) => (a.id === A3 ? { ...a, text: "Paketwunsch: Global Banking (4.999 €)" } : a)),
  };
  const wp = P.kartenPlanen(wunschStand).plaene.find((x) => x.quelleId === K)!;
  ok(P.paketwunschVonGruppe("Global Banking (4.999 €)", wp.gruppen[1].texte, wp.eigeneBelege) && wp.eigenerWunsch === "Global Struktur (2.499 €)",
    "Wunsch nur aus der Gruppe → zurück auf den jüngsten eigenen (statt NULL)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A8b Planer: Termin, „Ich rufe selbst an“, WhatsApp, Stand, „Kleingewerbe“");
const B = (() => {
  const K = 601, E1 = 951, F1 = 952, T = 4402;
  const t1 = um("2026-03-02", 10, 0), t2 = um("2026-03-04", 11, 30), tb = um("2026-03-04", 11, 40), tw = um("2026-03-04", 12, 0);
  const selbstAm = um("2026-03-04", 13, 0);
  const p = (d: Date, msek: number) => new Date(d.getTime() + msek);
  const link = `/agent/firmen?firma=${K}`;
  const vB2 = "Erstgespräch gebucht: 12.03.2026 um 10:00 Uhr mit Daniel. Paketwunsch: noch offen.";
  const notiz = [blockWie("2026-03-02", eingangText(E1, "Olga")), blockWie("2026-03-04", eingangText(F1, "Fritz")), blockWie("2026-03-04", vB2)].join("\n");
  const stand = {
    karten: [{ id: K, firma: "Kleingewerbe", ansprechpartner: "Olga Ohnefirma", email: "olga@ohne.example", telefon: "+49 160 2000 0001", person_id: 7101, notiz, paketwunsch: null, zustaendig_agent_id: 42 }],
    anfragen: [
      { id: E1, name: "Olga Ohnefirma", email: "olga@ohne.example", telefon: "+49 160 2000 0001", firma: "Kleingewerbe", person_id: null, created_at: t1, land: null, ist_test: false, text: "Paketwunsch: noch offen", zustaendig_agent_id: 42 },
      { id: F1, name: "Fritz Fremdling", email: "fritz@fremdling.example", telefon: "+49 160 2000 0002", firma: "Kleingewerbe", person_id: null, created_at: t2, land: "AT", ist_test: false, text: "Paketwunsch: noch offen", zustaendig_agent_id: 45 },
    ],
    dossiers: [
      { id: 800, anlass: "anfrage", anlass_id: E1, firma_id: K, mail_basis_am: p(t1, 300), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Kleingewerbe · warm", selbst_am: null, privat: false },
      { id: 801, anlass: "anfrage", anlass_id: F1, firma_id: K, mail_basis_am: p(t2, 300), mail_ki_am: null, temperatur: "kalt", faden_betreff: "Lead: Kleingewerbe · warm", selbst_am: selbstAm, privat: true },
      { id: 802, anlass: "termin", anlass_id: T, firma_id: K, mail_basis_am: p(tb, 500), mail_ki_am: null, temperatur: null, faden_betreff: "Lead: Kleingewerbe · warm", selbst_am: null, privat: false },
      // Eine Buchungsmeldung mit derselben Zahl wie eine Anfrage darf nie als Anfrage-Dossier zählen.
      { id: 803, anlass: "termin", anlass_id: E1, firma_id: 777, mail_basis_am: p(t1, 900), mail_ki_am: null, temperatur: null, faden_betreff: null, selbst_am: null, privat: false },
    ],
    wege: [], takte: [],
    gespraeche: [{ termin_id: T, anfrage_id: F1, firma_id: K, person_id: 7102, created_at: tb, d2_am: null }],
    wa: [{ anfrage_id: F1, firma_id: K, weg_am: tw }],
    auftraege: [
      { id: 6101, schluessel: `global-anfrage:${E1}`, link, zustaendig_agent_id: 42 },
      { id: 6102, schluessel: `global-anfrage:${F1}`, link, zustaendig_agent_id: 44 },
      { id: 6104, schluessel: `global-termin:${T}`, link, zustaendig_agent_id: 46 },
    ],
    logs: [
      { id: 8301, firma_id: K, art: "global", ergebnis: "anfrage", notiz: eingangText(E1, "Olga"), created_at: p(t1, 10), agent_name: "Website" },
      { id: 8302, firma_id: K, art: "anruf", ergebnis: "erreicht_kein_interesse", notiz: "Kein Bedarf mehr", created_at: um("2026-03-03", 9, 0), agent_name: "Daniel Team" },
      { id: 8303, firma_id: K, art: "global", ergebnis: "anfrage", notiz: eingangText(F1, "Fritz"), created_at: p(t2, 12), agent_name: "Website" },
      { id: 8304, firma_id: K, art: "global", ergebnis: "dossier", notiz: "Lead-Dossier an Justin", created_at: p(t2, 303), agent_name: "System" },
      { id: 8305, firma_id: K, art: "global", ergebnis: "termin_gebucht", notiz: vB2, created_at: p(tb, 25), agent_name: "Website" },
      { id: 8306, firma_id: K, art: "global", ergebnis: "dossier", notiz: "Lead-Dossier an Justin (Buchung)", created_at: p(tb, 503), agent_name: "System" },
      { id: 8307, firma_id: K, art: "global", ergebnis: "gespraechsweg", notiz: "Gesprächsweg gewählt: WhatsApp", created_at: p(tw, 4), agent_name: P.MARA_WHATSAPP },
      { id: 8308, firma_id: K, art: "global", ergebnis: "selbst", notiz: "Justin ruft selbst an — der Auftrag an Daniel ist geschlossen.", created_at: p(selbstAm, 41_000), agent_name: "Justin Schwarzott" },
      { id: 8309, firma_id: K, art: "global", ergebnis: "erzaehlt", notiz: "WhatsApp: möchte erst im Mai starten", created_at: um("2026-03-04", 15, 0), agent_name: P.MARA_WHATSAPP },
    ],
  };
  return { K, E1, F1, T, stand, notiz, vB2, t1, t2 };
})();
{
  const pl = P.kartenPlanen(B.stand);
  gleich(pl.platzhalter, 1, "„Kleingewerbe“ ist Kandidat (vor dem Fix legte der Eingang darüber zusammen)");
  const plan = pl.plaene[0];
  gleich([plan.eigene, plan.gruppen.map((g) => g.anfrageIds)], [[B.E1], [[B.F1]]], "Eigentümerin behält ihre Anfrage, Fritz wird getrennt");
  const g = plan.gruppen[0];
  gleich(g.logIds, [8303, 8304, 8305, 8306, 8307, 8308, 8309], "es ziehen: Eingang, Dossier, Buchung, Buchungsmeldung, Gesprächsweg, „selbst“, Maras WhatsApp-Notiz");
  gleich([g.gespraechTermine, g.terminDossierIds, g.auftragIds], [[B.T], [802], [6102, 6104]], "Gespräch, Buchungsmeldung und Termin-Auftrag ziehen mit (Gutachten, Mangel 2)");
  ok(g.selbst, "„Ich rufe selbst an“ an seinem Dossier erkannt");
  gleich(g.fadenStamm, "Lead: Fritz Fremdling (Kleingewerbe) · Privatkunde?", "Faden: eigener Name mit Feld (nie „Lead: Kleingewerbe“ wie die Eigentümerin), „Privatkunde?“ aus SEINEM Dossier");
  gleich(g.anzeige, "Fritz Fremdling (Kleingewerbe)", "Anzeigename für die Auftragstitel");
  gleich(g.zustaendigKandidaten, [44, 45], "Zuständige: Auftrag, dann Anfrage");
  gleich(g.stand && { zeileId: g.stand.zeileId, eigen: g.stand.eigen }, { zeileId: 8305, eigen: { status: "kein_interesse", wiedervorlage: null } },
    "zuletzt setzte seine Buchung den Stand → danach gilt „kein Interesse“ aus dem eigenen Anruf (wer abgesagt hat, wird nicht angerufen)");
  ok(String(g.stand?.eigenText).startsWith("Anruf: kein Interesse am 03.03.2026"), "… mit dem eigenen Ereignis im Vermerk");
  // Hat auch die Eigentümerin einen WhatsApp-Kontakt an der Karte, ist Maras Notiz zweideutig (der Gesprächsweg hat seine Marke).
  const beide = P.kartenPlanen({ ...B.stand, wa: [...B.stand.wa, { anfrage_id: B.E1, firma_id: B.K, weg_am: null }] }).plaene[0].gruppen[0];
  ok(!beide.logIds.includes(8309) && beide.logIds.includes(8307) && beide.zweideutig === 1, "WhatsApp beider Seiten: Maras Notiz bleibt (Vermerk), der Gesprächsweg zieht über seine Marke");
  // Danach rief Daniel die Nummer der Karte an (die Eigentümerin) — nicht erreicht: der Status kam trotzdem von seiner Buchung.
  const mitAnruf = P.kartenPlanen({ ...B.stand, logs: [...B.stand.logs, { id: 8310, firma_id: B.K, art: "anruf", ergebnis: "nicht_erreicht", notiz: null, created_at: um("2026-03-06", 9, 0), agent_name: "Daniel Team" }] });
  const gA = mitAnruf.plaene[0].gruppen[0];
  gleich(gA.stand && [gA.stand.zeileId, gA.stand.wiedervorlageBehalten, gA.stand.eigen?.status], [8310, true, "kein_interesse"],
    "Anruf ohne Ergebnis danach: Status kam weiter von seiner Buchung (geprüft wird die jüngste Zeile, der Anruf)");
  gleich(P.quellStandSoll({ eigen: gA.stand!.eigen, wiedervorlageBehalten: true, vorher: { status: "termin", wiedervorlage: "2026-03-08" }, heute: "2026-03-09" }),
    { status: "kein_interesse", wiedervorlage: null }, "… „kein Interesse“ ohne Wiedervorlage (ein Abschluss behält keine)");
  // Ohne privat-Kennzeichen an SEINEM Dossier kein „Privatkunde?“ — auch wenn der Faden der Eigentümerin es trüge.
  const ohnePrivat = P.kartenPlanen({ ...B.stand, dossiers: B.stand.dossiers.map((d) => (d.id === 801 ? { ...d, privat: false, faden_betreff: "Lead: Olga Ohnefirma · Privatkunde?" } : d)) });
  gleich(ohnePrivat.plaene[0].gruppen[0].fadenStamm, "Lead: Fritz Fremdling (Kleingewerbe) · kalt", "kein geerbtes „Privatkunde?“ (Gutachten, Mangel 7)");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A9 Kopf, Titel, Faden, Stand, Sätze");
ok(P.paketwunschVonGruppe("Global Struktur (2.499 €)", ["Paketwunsch: Global Struktur (2.499 €)"], []), "Paketwunsch nur aus der Gruppe → zurücksetzen");
ok(!P.paketwunschVonGruppe("Global Struktur (2.499 €)", ["Paketwunsch: Global Struktur (2.499 €)"], ["Erstgespräch gebucht … Paketwunsch: Global Struktur (2.499 €)."]), "… steht er auch beim Eigentümer → bleibt");
ok(!P.paketwunschVonGruppe(null, ["Paketwunsch: Global Struktur (2.499 €)"], []), "kein Wunsch am Kopf → nichts zu tun");
gleich(P.paketwunschImText("FIAON Global (02.03.2026): Erstgespräch gebucht: 05.03.2026 um 09:00 Uhr mit Justin. Paketwunsch: Global Struktur (2.499 €). Thema: Expansion."),
  "Global Struktur (2.499 €)", "Paketwunsch mitten im Satz (der Punkt in „2.499“ beendet ihn nicht)");
gleich(P.paketwunschImText("Paketwunsch: Global Banking (4.999 €)\nWunschzeit: morgen"), "Global Banking (4.999 €)", "… und am Zeilenanfang");
gleich(P.paketwunschImText(eingangText(901, "x")), null, "„noch offen“ → kein Wunsch");
gleich(P.auftragTitelNeu("FIAON Global: Selbständig bittet um einen Anruf", "Selbständig", "Frieda Fremd"), "FIAON Global: Frieda Fremd bittet um einen Anruf", "Auftragstitel: Name statt Platzhalter");
gleich(P.auftragTitelNeu("FIAON Global: Erstgespräch Kleingewerbe am 12.03.2026, 10:00 Uhr", "Kleingewerbe", "Fritz Fremdling (Kleingewerbe)"),
  "FIAON Global: Erstgespräch Fritz Fremdling (Kleingewerbe) am 12.03.2026, 10:00 Uhr", "Termin-Auftrag: Name statt Firmenfeld");
gleich(P.auftragTitelNeu("FIAON Global: Frieda Fremd — bitte neu vereinbaren", "Selbständig", "Frieda Fremd"), "FIAON Global: Frieda Fremd — bitte neu vereinbaren", "Titel ohne Firmenfeld bleibt");
gleich(P.neuerFadenStamm("Selbständig", "Frieda Fremd", "kalt", false), "Lead: Frieda Fremd · kalt", "„Privatkunde?“ wird nie vom Faden des Eigentümers geerbt");
gleich(P.neuerFadenStamm("Selbständig", "Frieda Fremd", "kalt", true), "Lead: Frieda Fremd · Privatkunde?", "… nur aus SEINEM Dossier");
gleich(P.neuerFadenStamm("Selbständig", "Frieda Fremd", "unbekannt", false), "Lead: Frieda Fremd", "unbekannte Temperatur → ohne Zusatz");
gleich([P.trennAnzeige("Selbständig", "Frieda Fremd"), P.trennAnzeige("Immobilien", "Frieda Fremd"), P.trennAnzeige("Selbständig", "")],
  ["Frieda Fremd", "Frieda Fremd (Immobilien)", "ohne Namen"], "Anzeigename: Name, bei Allerwelts-Feld mit Klammer, ohne Namen wie leadAnzeigeName");
gleich(P.trennAnzeige("Fremd Handel GmbH", "Frieda Fremd"), "Fremd Handel GmbH", "… eine echte Firma (Rechtsform) wie überall");
gleich(P.auftragTermin("global-termin:4402"), 4402, "Termin-Auftrag: Schlüssel global-termin:<Termin>");
{
  const tag = um("2026-03-05", 9, 49);
  gleich(P.standAusZeile({ art: "anruf", ergebnis: "erreicht_kein_interesse", notiz: null, am: tag }), { status: "kein_interesse", wiedervorlage: null }, "Stand: Anruf „kein Interesse“");
  gleich(P.standAusZeile({ art: "anruf", ergebnis: "nummer_falsch", notiz: null, am: tag }), { status: "ungueltig", wiedervorlage: null }, "… „Nummer falsch“ → ungültig");
  gleich(P.standAusZeile({ art: "anruf", ergebnis: "nicht_erreicht", notiz: null, am: tag }), null, "… „nicht erreicht“ hängt vom Stand davor ab → nicht eindeutig");
  gleich(P.standAusZeile({ art: "global", ergebnis: "gespraech_gefuehrt", notiz: "Erstgespräch geführt.", am: tag }), { status: "in_arbeit", wiedervorlage: "2026-03-06" }, "… Gespräch geführt → in Arbeit, Folgetag");
  gleich(P.standAusZeile({ art: "global", ergebnis: "gespraech_nicht_zustande", notiz: "Erstgespräch kam nicht zustande — kein Interesse mehr, vom Unternehmen erklärt (05.03.2026, 09:00 Uhr).", am: tag }),
    { status: "kein_interesse", wiedervorlage: null }, "… nicht zustande wegen „kein Interesse“");
  gleich(P.standAusZeile({ art: "global", ergebnis: "anfrage", notiz: eingangText(901, "x"), am: tag }), { status: "wiedervorlage", wiedervorlage: "2026-03-05" }, "… eigene Anfrage → Wiedervorlage am Eingangstag");
  gleich(P.standAusZeile({ art: "global", ergebnis: "abgesagt", notiz: "Nicht anrufen — schriftlich abgesagt", am: tag }), { status: "kein_interesse", wiedervorlage: null }, "… schriftlich abgesagt");
  ok(P.standSetzend({ art: "anruf", ergebnis: "mailbox" }) && P.standSetzend({ art: "global", ergebnis: "termin_gebucht" }) && !P.standSetzend({ art: "global", ergebnis: "dossier" }),
    "stand-setzend: Anrufe, Eingänge, Buchungen — nie Dossier-Zeilen");
  const rr = "Erreicht, ruft zurück — Rückruf vereinbart: Di., 10.03.2026, 14:00 Uhr";
  gleich(P.rueckrufTagAus(rr), "2026-03-10", "eigener Rückruf aus der Anruf-Notiz");
  gleich(P.standAusZeile({ art: "anruf", ergebnis: "nicht_erreicht", notiz: rr, am: tag }), { status: "wiedervorlage", wiedervorlage: "2026-03-10" }, "… „nicht erreicht“ MIT Rückruf → Wiedervorlage am Rückruftag");
  gleich(P.standAusZeile({ art: "anruf", ergebnis: "erreicht_interesse", notiz: "Interesse", am: tag }), { status: "in_arbeit", wiedervorlage: "2026-03-06" }, "… „Interesse“ → in Arbeit, Folgetag");
  ok(P.standNeutral({ art: "anruf", ergebnis: "mailbox", notiz: null }) && !P.standNeutral({ art: "anruf", ergebnis: "mailbox", notiz: rr }) && !P.standNeutral({ art: "anruf", ergebnis: "erreicht_interesse", notiz: null }),
    "durchsichtig nur „nicht erreicht“/„Mailbox“ ohne Rückruf (lassen den Status stehen)");
  const zz = (id: number, art: string, ergebnis: string, am: Date, notiz: string | null = null) => ({ id, art, ergebnis, notiz, am });
  const qs = P.quellStandPlanen([
    zz(1, "global", "anfrage", um("2026-03-01", 10, 0), eingangText(901, "x")), zz(2, "anruf", "erreicht_kein_interesse", um("2026-03-02", 10, 0)),
    zz(3, "global", "anfrage", um("2026-03-03", 10, 0), eingangText(902, "x")), zz(4, "anruf", "mailbox", um("2026-03-04", 10, 0)),
  ], new Set([3]));
  gleich([qs.letzteId, qs.setzerId, qs.wiedervorlageBehalten, qs.eigen], [4, 3, true, { status: "kein_interesse", wiedervorlage: null }],
    "Planung: jüngste Zeile = Mailbox, Status von der fremden Anfrage, eigener Stand „kein Interesse“");
  gleich(P.quellStandSoll({ eigen: { status: "wiedervorlage", wiedervorlage: "2026-03-01" }, wiedervorlageBehalten: true, vorher: { status: "termin", wiedervorlage: "2026-03-06" }, heute: "2026-03-09" }),
    { status: "wiedervorlage", wiedervorlage: "2026-03-06" }, "offener Status: die Wiedervorlage des späteren eigenen Anrufs bleibt");
  gleich(P.quellStandSoll({ eigen: null, wiedervorlageBehalten: false, vorher: { status: "termin", wiedervorlage: "2026-03-04" }, heute: "2026-03-09" }),
    { status: "wiedervorlage", wiedervorlage: "2026-03-09" }, "kein eindeutiger eigener Stand, aber „Termin“ der anderen Person → Wiedervorlage heute");
  gleich(P.quellStandSoll({ eigen: null, wiedervorlageBehalten: false, vorher: { status: "wiedervorlage", wiedervorlage: "2026-03-04" }, heute: "2026-03-09" }), null,
    "… sonst nichts ändern (nur ein Hinweis)");
}
{
  const q = P.getrenntSatzQuelle({ anfrageIds: [902], zielId: 540, zielNeu: true, firmaRoh: "Selbständig" });
  const z = P.getrenntSatzZiel({ anfrageIds: [902], quelleId: 501, firmaRoh: "Selbständig" });
  const zs = P.getrenntSatzZiel({ anfrageIds: [902], quelleId: 501, firmaRoh: "Selbständig", selbst: true });
  ok(/^Getrennt: Anfrage #902 /.test(q) && q.includes("auf eigene Karte #540") && q.includes("Platzhalter oder Name ohne Rechtsform"), "Zeile auf der Quelle: „Getrennt: … auf eigene Karte #…“");
  ok(/^Getrennt aus Karte #501: Anfrage #902 /.test(z) && z.includes("auf eigene Karte") && z.includes("bitte diesen Lead selbst anrufen"), "Zeile auf dem Ziel: woher, und dass die Notizen dort jemand anderen betrafen");
  ok(zs.includes("Justin ruft diesen Lead selbst an") && zs.includes("bitte nicht zusätzlich anrufen") && !zs.includes("bitte diesen Lead selbst anrufen"), "… hat Justin übernommen: „Justin ruft selbst an“ statt „bitte anrufen“");
  ok(P.auftragHinweis({ quelleId: 501, zielId: 540, firmaRoh: "Selbständig", tagIso: "2026-03-09" }).startsWith("Hinweis (09.03.2026): Dieser Auftrag lag auf einer fremden Firmen-Karte"), "Hinweis im Auftrag mit Datum");
  gleich(P.vermerkSatz({ anfrageIds: [902], notizNicht: 0, zweideutig: 0 }), null, "nichts ausgelassen → kein Vermerk");
  ok(/Notiz-Block.*von Hand prüfen.*nicht eindeutig/.test(String(P.vermerkSatz({ anfrageIds: [902, 908], notizNicht: 1, zweideutig: 2 }))), "Vermerk nennt Notiz und zweideutige Zeilen");
  ok(P.auftragAnfrage("global-rueckruf:902") === 902 && P.auftragAnfrage("global-termin:902") === null, "Auftrags-Schlüssel: Anfrage, Rückruf, Antwort — Termin getrennt (auftragTermin)");
  const sk = P.standKorrigiertSatz({ anfrageIds: [952], vorher: { status: "termin", wiedervorlage: "2026-03-04" }, nachher: { status: "kein_interesse", wiedervorlage: null }, eigenText: "Anruf: kein Interesse am 03.03.2026" });
  ok(sk.startsWith("Stand korrigiert (zu Anfrage #952): „Termin“ mit Wiedervorlage 04.03.2026 kam vom Eingang der anderen Person — jetzt „kein Interesse“ ohne Wiedervorlage"), "Satz „Stand korrigiert“");
  ok(/bitte prüfen/i.test(P.standHinweisSatz({ anfrageIds: [952], stand: { status: "wiedervorlage", wiedervorlage: "2026-03-04" }, eigenText: null })), "Hinweis, wenn kein eigener Stand folgt");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A10 Meldung für die Lauf-Historie (nur Zahlen, keine Kennungen)");
const L = await import("../server/lib/fiaon-firmen-trennen");
{
  ok(typeof L.firmenTrennenLauf === "function" && typeof L.firmenTrennenTakt === "function" && typeof L.firmenTrennungSchema === "function", "Lauf lädt (Takt, Lauf, Schema)");
  const m = String(L.trennMeldung({
    modus: "an", karten: 44, platzhalter: 15, gruppen: 2, getrennt: 2, neu: 2, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0, stand: 1, gedeckelt: 0,
    zeilen: { verlauf: 4, dossier: 2, auftraege: 2, lead: 4, notiz: 2 }, plan: [{ quelle: 501, anfragen: [902], ziel: 540 }], fehlerText: null,
  }));
  ok(m.includes('"getrennt":2') && m.includes('"zeilen.verlauf":4') && m.includes('"zeilen.notiz":2') && m.includes('"neu":2') && m.includes('"stand":1'), "Meldung trägt die Zahlen (alle Zeilen-Zahlen haben Platz)");
  ok(!/501|902|540|plan|quelle/.test(m), "… und keine Karten- oder Anfrage-Kennung");
  ok(!m.includes('"schon"') && !m.includes('"gedeckelt"'), "… seltene Zähler nur, wenn sie nicht 0 sind");
  const t = String(L.trennMeldung({ modus: "trocken", karten: 1, platzhalter: 1, gruppen: 1, getrennt: 0, neu: 1, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0, stand: 0, gedeckelt: 0, zeilen: { verlauf: 2, dossier: 1, auftraege: 1, lead: 2, notiz: 1 }, plan: [], fehlerText: null }));
  ok(t.startsWith('{"trocken":true'), "Trockenprobe steht als „trocken“ in der Meldung");
}

// ═══════════════════════════════════════════════════════════════════════════
// Die Attrappe einer Datenbank-Verbindung: nimmt jede Anweisung auf und antwortet nach Muster (keine echte Datenbank).
type Antwort = [RegExp, (werte: unknown[]) => unknown[]];
function attrappe(antworten: Antwort[]) {
  const log: { sql: string; werte: unknown[] }[] = [];
  const f: any = (strings: TemplateStringsArray, ...werte: unknown[]) => {
    const sql = Array.from(strings).join("$").replace(/\s+/g, " ").trim();
    log.push({ sql, werte });
    for (const [muster, antwort] of antworten) if (muster.test(sql)) return Promise.resolve(antwort(werte));
    return Promise.resolve([]);
  };
  f.json = (x: unknown) => ({ json: x });
  f.begin = async (fn: (tx: any) => Promise<unknown>) => fn(f);
  return { lauf: f, log, finde: (muster: RegExp) => log.filter((x) => muster.test(x.sql)) };
}
const DA_ALLES = { dossier: true, weg: true, takt: true, gespraech: true, wa: true, auftraege: true, anfragen: true, termine: true, agents: true };

abschnitt("A12 Der Schreibweg mit einer Attrappe (Reihenfolge, Wände, Werte)");
{
  const plan = P.kartenPlanen(B.stand).plaene[0];
  const g = plan.gruppen[0];
  const a = attrappe([
    [/^SELECT id, firma, ansprechpartner, .* FROM fiaon_firmen_leads WHERE id = \$ FOR UPDATE$/, () => [{
      id: B.K, firma: "Kleingewerbe", ansprechpartner: "Olga Ohnefirma", email: "olga@ohne.example", telefon: "+49 160 2000 0001", person_id: 7101,
      notiz: B.notiz, paketwunsch: null, global_am: new Date(B.t2.getTime() + 12), status: "termin", wv: "2026-03-04", zustaendig_agent_id: 42,
    }]],
    [/^INSERT INTO fiaon_firmen_trennung/, () => [{ id: 77 }]],
    [/^SELECT id FROM fiaon_firmen_log WHERE firma_id = \$ AND \(art = 'anruf'/, () => [{ id: 8305 }]],
    [/^SELECT id FROM fiaon_agents WHERE id = ANY\(\$\) AND active AND zugang_gesperrt_am IS NULL$/, () => [{ id: 45 }, { id: 42 }]],
    [/^INSERT INTO fiaon_firmen_leads/, () => [{ id: 990 }]],
    [/^UPDATE fiaon_firmen_log SET firma_id = \$ WHERE id = ANY\(\$\) AND firma_id = \$ RETURNING id$/, (w) => (w[1] as number[]).map((id) => ({ id }))],
    [/^SELECT id, faden_betreff, mail_basis_id, mail_ki_id, basis->>'cockpitUrl' AS cockpit, selbst_am FROM fiaon_lead_dossier WHERE anlass = 'anfrage'/, () => [{
      id: 801, faden_betreff: "Lead: Kleingewerbe · warm", mail_basis_id: "<pruef-801@example.com>", mail_ki_id: null, cockpit: `https://fiaon.example/agent/firmen?firma=${B.K}`, selbst_am: new Date(),
    }]],
    [/^SELECT termin_id, faden_betreff, d2_id, d3_id FROM fiaon_lead_gespraech/, () => [{ termin_id: B.T, faden_betreff: null, d2_id: null, d3_id: null }]],
    [/^SELECT id, faden_betreff, mail_basis_id, mail_ki_id, basis->>'cockpitUrl' AS cockpit FROM fiaon_lead_dossier WHERE anlass = 'termin'/, () => [{
      id: 802, faden_betreff: "Lead: Kleingewerbe · warm", mail_basis_id: "<pruef-802@example.com>", mail_ki_id: null, cockpit: `https://fiaon.example/agent/firmen?firma=${B.K}`,
    }]],
    [/^SELECT id, titel, link FROM fiaon_betreiber_todos/, () => [
      { id: 6102, titel: "FIAON Global: Kleingewerbe bittet um einen Anruf", link: `/agent/firmen?firma=${B.K}` },
      { id: 6104, titel: "FIAON Global: Erstgespräch Kleingewerbe am 12.03.2026, 10:00 Uhr", link: `/agent/firmen?firma=${B.K}` },
    ]],
    [/^SELECT 1 AS ja FROM fiaon_termine/, () => [{ ja: 1 }]],
    [/^SELECT MAX\(created_at\) AS am FROM fiaon_firmen_log/, () => [{ am: new Date(B.t1.getTime() + 10) }]],
  ]);
  const r = await L.gruppeTrennen(a.lauf, plan, g, DA_ALLES, "2026-03-09", 99);
  gleich([r.status, r.zielId, r.zielNeu, r.stand], ["getrennt", 990, true, true], "Gruppe getrennt: neue Karte, Stand korrigiert");
  const idx = (muster: RegExp) => a.log.findIndex((x) => muster.test(x.sql));
  ok(idx(/^SET LOCAL lock_timeout = '3s'$/) === 0, "zuerst lock_timeout");
  ok(idx(/^INSERT INTO fiaon_firmen_trennung/) < idx(/SET firma_id = /) && idx(/^INSERT INTO fiaon_firmen_trennung/) > 0, "Protokoll vor jedem Umzug");
  ok(idx(/^SELECT id FROM fiaon_firmen_log WHERE firma_id = \$ AND \(art = 'anruf'/) < idx(/^UPDATE fiaon_firmen_log SET firma_id/), "Stand der Quelle frisch geprüft, BEVOR Zeilen umziehen");
  const neu = a.finde(/^INSERT INTO fiaon_firmen_leads/)[0];
  gleich(neu?.werte[6], 45, "zuständig: das erste AKTIVE Konto (Auftrag 44 gesperrt/inaktiv → Anfrage 45; Gutachten, Mangel 6)");
  const setzer = a.log.filter((x) => /SET firma_id = \$/.test(x.sql));
  ok(setzer.length >= 5 && setzer.every((x) => /AND firma_id = \$|AND firma_id IS NULL/.test(x.sql)), `jede Umzieh-Anweisung mit der Wand „AND firma_id = Quelle“ (${setzer.length})`);
  const terminDossier = a.finde(/WHERE anlass = 'termin' AND anlass_id = ANY\(\$\) AND firma_id = \$ FOR UPDATE/)[0];
  gleich(terminDossier?.werte, [[B.T], B.K], "Buchungsmeldung: nur zum umgezogenen Gespräch und nur an der Quelle");
  const dossierUpdates = a.finde(/^UPDATE fiaon_lead_dossier SET firma_id = \$/);
  gleich(dossierUpdates.map((x) => x.werte[x.werte.length - 2]), [801, 802], "Anfrage-Dossier und Buchungsmeldung ziehen um");
  ok(dossierUpdates.every((x) => x.werte[1] === g.fadenStamm && x.werte.includes(`https://fiaon.example/agent/firmen?firma=990`)), "… mit eigenem Faden-Stamm und neuem Cockpit-Link");
  const todoSel = a.finde(/^SELECT id, titel, link FROM fiaon_betreiber_todos WHERE link = \$ AND schluessel = ANY\(\$\) FOR UPDATE$/)[0];
  ok(todoSel?.werte[0] === `/agent/firmen?firma=${B.K}` && (todoSel?.werte[1] as string[]).includes(`global-termin:${B.T}`) && (todoSel?.werte[1] as string[]).includes(`global-anfrage:${B.F1}`),
    "Aufträge: Anruf UND Termin-Auftrag, nur mit dem Link der Quelle");
  const titel = a.finde(/^UPDATE fiaon_betreiber_todos SET link = \$/).map((x) => x.werte[1]);
  gleich(titel, ["FIAON Global: Fritz Fremdling (Kleingewerbe) bittet um einen Anruf", "FIAON Global: Erstgespräch Fritz Fremdling (Kleingewerbe) am 12.03.2026, 10:00 Uhr"], "Titel mit dem Namen statt des Firmenfelds");
  const zielStand = a.finde(/^UPDATE fiaon_firmen_leads SET status = CASE WHEN \$ THEN 'termin'/)[0];
  gleich(zielStand?.werte, [true, true, 990], "neue Karte: „Termin“ (Gespräch kommt) und ohne Wiedervorlage („Ich rufe selbst an“)");
  const kopf = a.finde(/^UPDATE fiaon_firmen_leads SET notiz = CASE WHEN/)[0];
  gleich(kopf && [kopf.werte[5], kopf.werte[6], kopf.werte[7], kopf.werte[8], kopf.werte[9]], [true, "kein_interesse", true, null, B.K],
    "Quelle: Status zurück auf „kein Interesse“ ohne Wiedervorlage (Gutachten, Mangel 5)");
  ok(kopf && typeof kopf.werte[1] === "string" && !String(kopf.werte[1]).includes("Fritz") && String(kopf.werte[1]).includes("Olga"), "Quelle: Notiz ohne seine Blöcke, ihr Block bleibt");
  const saetze = a.finde(/^INSERT INTO fiaon_firmen_log/).flatMap((x) => x.werte.filter((w) => typeof w === "string" && /^(Getrennt|Stand)/.test(w as string))) as string[];
  ok(saetze.some((s) => s.startsWith("Getrennt aus Karte") && s.includes("Justin ruft diesen Lead selbst an")), "Zielkarte: „Justin ruft diesen Lead selbst an“");
  ok(saetze.some((s) => s.startsWith("Stand korrigiert") && s.includes("„kein Interesse“")), "Quelle: Vermerk „Stand korrigiert“");
  const prot = a.finde(/^UPDATE fiaon_firmen_trennung SET ziel_firma_id/)[0];
  const vorher = (prot?.werte[2] as { json: Record<string, unknown> } | undefined)?.json;
  gleich(vorher && [vorher.status, vorher.wiedervorlage], ["termin", "2026-03-04"], "Protokoll „vorher“ mit Status und Wiedervorlage (Rückweg)");
  // Kam seither ein eigenes Ereignis (die jüngste Zeile ist nicht mehr seine Buchung), bleibt der Stand.
  const b = attrappe([
    [/FROM fiaon_firmen_leads WHERE id = \$ FOR UPDATE$/, () => [{ id: B.K, firma: "Kleingewerbe", ansprechpartner: "Olga Ohnefirma", email: "olga@ohne.example", telefon: "+49 160 2000 0001", person_id: 7101, notiz: B.notiz, status: "wiedervorlage", wv: "2026-03-09" }]],
    [/^INSERT INTO fiaon_firmen_trennung/, () => [{ id: 78 }]],
    [/^SELECT id FROM fiaon_firmen_log WHERE firma_id = \$ AND \(art = 'anruf'/, () => [{ id: 9999 }]],
    [/^INSERT INTO fiaon_firmen_leads/, () => [{ id: 991 }]],
  ]);
  const rb = await L.gruppeTrennen(b.lauf, plan, g, DA_ALLES, "2026-03-09", null);
  const kopfB = b.finde(/^UPDATE fiaon_firmen_leads SET notiz = CASE WHEN/)[0];
  ok(rb.stand === false && kopfB?.werte[5] === false, "neues eigenes Ereignis seit dem Plan → Stand bleibt");
  gleich(b.finde(/^INSERT INTO fiaon_firmen_leads/)[0]?.werte[6], null, "kein aktives Konto unter den Zuständigen und keine Rückfall-Zuständige → niemand (statt eines gesperrten)");
  // Schon erledigt (Protokoll da) → nichts weiter.
  const c = attrappe([[/FROM fiaon_firmen_leads WHERE id = \$ FOR UPDATE$/, () => [{ id: B.K, firma: "Kleingewerbe", ansprechpartner: "Olga Ohnefirma", email: "olga@ohne.example", person_id: 7101 }]]]);
  const rc = await L.gruppeTrennen(c.lauf, plan, g, DA_ALLES, "2026-03-09", null);
  ok(rc.status === "schon" && !c.log.some((x) => /SET firma_id|INSERT INTO fiaon_firmen_leads/.test(x.sql)), "Protokoll schon da → keine weitere Anweisung");
  // Inzwischen echter Firmenname → nicht trennen.
  const d = attrappe([[/FROM fiaon_firmen_leads WHERE id = \$ FOR UPDATE$/, () => [{ id: B.K, firma: "Ohnefirma Handel GmbH", ansprechpartner: "Olga Ohnefirma" }]]]);
  ok((await L.gruppeTrennen(d.lauf, plan, g, DA_ALLES, "2026-03-09", null)).status === "uebersprungen" && !d.log.some((x) => /^INSERT/.test(x.sql)), "frisch geprüft: echter Firmenname → übersprungen, nichts geschrieben");
}

abschnitt("A13 Der Lauf mit einer Attrappe (Schalter vor Schema, Deckel)");
{
  // „aus“: keine einzige Anweisung.
  const aus = attrappe([]);
  gleich((await L.firmenTrennenLauf({ modus: "aus", lauf: aus.lauf })).modus, "aus", "Schalter aus → modus aus");
  gleich(aus.log.length, 0, "… und keine Anweisung (auch keine Tabellen-Änderung; Gutachten, Mangel 9)");
  // Schalter leer → trocken; ohne Protokoll-Tabelle nur der Katalog, nie CREATE/ALTER.
  const leer = attrappe([
    [/^SELECT value FROM fiaon_settings/, () => []],
    [/AS protokoll$/, () => [{ karten: true, verlauf: true, protokoll: false }]],
  ]);
  const tr = await L.firmenTrennenLauf({ lauf: leer.lauf });
  gleich(tr.modus, "trocken", "Schalter fehlt → trocken");
  ok(!leer.log.some((x) => /CREATE|ALTER|INSERT|UPDATE|DELETE/.test(x.sql)), "trocken: kein CREATE, ALTER, INSERT, UPDATE, DELETE");
  ok(!leer.log.some((x) => /fiaon_firmen_trennung WHERE schluessel/.test(x.sql)), "… und ohne Protokoll-Tabelle keine Abfrage darauf");
  // Deckel: sieben fremde Gruppen, „an“ → fünf getrennt, zwei nur gerechnet.
  const karten = Array.from({ length: 7 }, (_, i) => ({
    id: 700 + i, firma: "Selbständig", ansprechpartner: `Eigner Nummer${i}`, email: `eigner${i}@e${i}.example`, telefon: `+49 170 31${i}0 41${i}2`, person_id: null, notiz: null,
    paketwunsch: null, zustaendig_agent_id: null,
  }));
  const anfragen = karten.flatMap((k, i) => [
    { id: 9700 + i * 2, name: k.ansprechpartner, email: k.email, telefon: k.telefon, firma: "Selbständig", person_id: null, created_at: um("2026-03-01", 10, i), land: null, ist_test: false, text: null, zustaendig_agent_id: null },
    { id: 9701 + i * 2, name: `Fremd Nummer${i}`, email: `fremd${i}@f${i}.example`, telefon: `+49 171 52${i}0 63${i}4`, firma: "Selbständig", person_id: null, created_at: um("2026-03-02", 10, i), land: null, ist_test: false, text: null, zustaendig_agent_id: null },
  ]);
  const logs = anfragen.map((a, j) => ({ id: 9800 + j, firma_id: 700 + Math.floor(j / 2), art: "global", ergebnis: "anfrage", notiz: eingangText(a.id, "x"), created_at: a.created_at, agent_name: "Website" }));
  const dk = attrappe([
    [/AS protokoll$/, () => [{ karten: true, verlauf: true, protokoll: true }]],
    [/AS spalte$/, () => [{ karten: true, verlauf: true, protokoll: true, spalte: true }]],
    [/AS dossier,/, () => [{ anfragen: true }]],
    [/^SELECT id, firma, ansprechpartner, email, telefon, person_id, notiz, paketwunsch, zustaendig_agent_id FROM fiaon_firmen_leads WHERE global_am/, () => karten],
    [/^SELECT id, firma_id, art, ergebnis, notiz, created_at, agent_name FROM fiaon_firmen_log/, () => logs],
    [/^SELECT id, name, email, telefon, firma, person_id, created_at, land/, () => anfragen],
    [/FROM fiaon_firmen_leads WHERE id = \$ FOR UPDATE$/, (w) => karten.filter((k) => k.id === w[0])],
    [/^INSERT INTO fiaon_firmen_trennung/, () => [{ id: 1 }]],
    [/^INSERT INTO fiaon_firmen_leads/, () => [{ id: 5000 }]],
  ]);
  const deckel = await L.firmenTrennenLauf({ modus: "an", lauf: dk.lauf, rueckfall: null });
  gleich([deckel.gruppen, deckel.getrennt, deckel.gedeckelt, deckel.fehler], [7, 5, 2, 0], `Deckel ${P.FIRMEN_TRENNEN_DECKEL} je Lauf: fünf getrennt, zwei nur gerechnet`);
  gleich(dk.finde(/^INSERT INTO fiaon_firmen_trennung/).length, 5, "… genau fünf Protokollzeilen");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A11 Quelltext-Wände");
{
  const lauf = lies("server/lib/fiaon-firmen-trennen.ts");
  const regel = lies("shared/fiaon-firmen-trennen.ts");
  const routen = lies("server/routes.ts");
  const crons = lies("server/lib/fiaon-crons.ts");
  const firmen = lies("server/routes/fiaon-firmen.ts");
  ok(/tageslauf\('firmen_trennen', async \(\) => await \(await import\('\.\/lib\/fiaon-firmen-trennen'\)\)\.firmenTrennenTakt\(\), 60 \* 60 \* 1000, \{ beimStartNach: 240_000, nurMitErgebnis: true \}\)/.test(routen),
    "Lauf registriert: stündlich, 4 Minuten nach dem Start, nurMitErgebnis");
  const { LAUF_FOLGEN } = await import("../server/lib/fiaon-crons");
  ok((LAUF_FOLGEN.firmen_trennen?.zweck.length ?? 0) > 40 && (LAUF_FOLGEN.firmen_trennen?.folge.length ?? 0) > 40 && (LAUF_FOLGEN.firmen_trennen?.fenster ?? 0) >= 7, "Katalog: zweck, folge, fenster");
  ok(/\n  firmen_trennen: \{/.test(crons) && /Vorgabe trocken/.test(crons), "… als Eintrag in LAUF_FOLGEN, mit „Vorgabe trocken“");
  ok(/SELECT value FROM fiaon_settings WHERE key = \$\{FIRMEN_TRENNEN_SCHALTER\}/.test(lauf) && /trennModusLesen\(r\?\.value\)/.test(lauf), "Schalter wird aus fiaon_settings gelesen");
  const laufFn = lauf.slice(lauf.indexOf("export async function firmenTrennenLauf"));
  ok(laufFn.indexOf("await trennModus(lauf)") > 0 && laufFn.indexOf("await trennModus(lauf)") < laufFn.indexOf('if (modus === "aus") return')
    && laufFn.indexOf('if (modus === "aus") return') < laufFn.indexOf("firmenTrennungSchema(lauf)")
    && /modus === "an" && !\(await firmenTrennungSchema\(lauf\)\)/.test(laufFn), "erst der Schalter, dann (nur bei „an“) die Tabellen-Änderung");
  ok((lauf.match(/SET LOCAL lock_timeout = '3s'/g) ?? []).length >= 2, "lock_timeout 3 s in Schema UND Gruppen-Transaktion");
  ok(/CREATE TABLE IF NOT EXISTS fiaon_firmen_trennung \([\s\S]*schluessel TEXT NOT NULL UNIQUE[\s\S]*bewegt JSONB,[\s\S]*vorher JSONB/.test(lauf), "Protokoll-Tabelle: UNIQUE schluessel, bewegt/vorher als JSONB");
  ok(/ALTER TABLE fiaon_firmen_leads ADD COLUMN IF NOT EXISTS getrennt_aus INTEGER/.test(lauf), "Spalte getrennt_aus an fiaon_firmen_leads");
  ok(/ON CONFLICT \(schluessel\) DO NOTHING\s+RETURNING id`\) as any\[\];\s+if \(!prot\) return \{ \.\.\.nichts, status: "schon" \};/.test(lauf), "Protokoll zuerst: ON CONFLICT DO NOTHING — kommt nichts zurück, ist die Gruppe erledigt");
  ok(/FROM fiaon_firmen_leads WHERE id = \$\{quelle\} FOR UPDATE/.test(lauf), "Kartenkopf der Quelle FOR UPDATE (frisch geprüft)");
  // Jede Anweisung, die firma_id setzt, nur für Zeilen der Quelle (oder ohne Karte).
  const setzer = Array.from(lauf.matchAll(/UPDATE (fiaon_[a-z_]+) SET firma_id = \$\{zielId\}[^`]*`/g));
  ok(setzer.length >= 9, `Umzieh-Anweisungen gefunden (${setzer.length}: Verlauf, Dossier, Lead-Weg 2, Takt 2, Gespräch, WhatsApp 2)`);
  ok(setzer.every((m) => /AND firma_id = \$\{quelle\}|AND firma_id IS NULL/.test(m[0])), "jede Umzieh-Anweisung trägt „AND firma_id = ${quelle}“ (oder füllt nur leere Verweise)");
  for (const t of ["fiaon_firmen_log", "fiaon_lead_dossier", "fiaon_lead_weg", "fiaon_lead_takt", "fiaon_lead_gespraech", "fiaon_wa_global"]) {
    ok(setzer.some((m) => m[1] === t && /AND firma_id = \$\{quelle\}/.test(m[0])), `${t}: umziehen nur mit „AND firma_id = \${quelle}“`);
  }
  ok((lauf.match(/SET firma_id = /g) ?? []).length === setzer.length, "keine Anweisung setzt firma_id ohne diese Wand");
  ok(/UPDATE fiaon_betreiber_todos SET link = \$\{linkZiel\}[^`]*WHERE id = \$\{a\.id\} AND link = \$\{linkQuelle\}/.test(lauf), "Aufträge: nur mit dem Link der Quelle");
  ok(/\.\.\.termine\.map\(\(t\) => `global-termin:\$\{t\}`\)/.test(lauf) && /WHERE link = \$\{linkQuelle\} AND schluessel = ANY\(\$\{schluessel\}\) FOR UPDATE/.test(lauf), "Termin-Aufträge der umgezogenen Gespräche ziehen mit (gleiche Link-Wand)");
  ok(/WHERE anlass = 'termin' AND anlass_id = ANY\(\$\{termine\}\) AND firma_id = \$\{quelle\} FOR UPDATE/.test(lauf), "Buchungsmeldungen nur zu umgezogenen Gesprächen und nur an der Quelle");
  ok(/SELECT id FROM fiaon_agents WHERE id = ANY\(\$\{kandidaten\}\) AND active AND zugang_gesperrt_am IS NULL/.test(lauf), "Zuständige nur aktiv und nicht gesperrt (wie im Eingang)");
  ok(/kartenPlanen\(stand\)/.test(lauf) && !/from "\.\.\/server|db-pool/.test(regel), "Lauf plant mit dem reinen Planer; die Regel kennt keine Datenbank");
  const trocken = /if \(modus === "trocken" \|\| ueberDeckel\) \{([\s\S]*?)continue;\n      \}/.exec(lauf)?.[1] ?? "";
  ok(trocken.length > 100 && !/INSERT|UPDATE|DELETE|gruppeTrennen/.test(trocken), "Trockenprobe (und alles über dem Deckel) schreibt nichts");
  ok(/const ueberDeckel = modus === "an" && erg\.getrennt >= deckel;/.test(lauf), "Deckel je Lauf");
  ok(/if \(erg\.getrennt > 0 \|\| neuerPlan \|\| Date\.now\(\) - letzteZeile >= PULS_MS\)/.test(lauf), "Historienzeile nur bei Arbeit, neuem Plan oder Puls — Vermerke der Trockenprobe nie (Gutachten, Mangel 10)");
  ok(!/firma=\d|Anfrage #\d|#\d{2,}/.test(lauf + regel), "keine feste Karten- oder Anfragenummer im Lauf und in der Regel");
  ok(!/getHours\(|getDate\(|toLocale|Number\(new Intl/.test(lauf + regel), "Berliner Zeit nur über die Haus-Regeln (berlinZeit, berlinToday, isoPlus)");
  ok(/INSERT INTO fiaon_lauf_historie \(name, ergebnis, begonnen, beendet, dauer_ms, meldung\)/.test(lauf) && /trennMeldung\(erg\)/.test(lauf), "Lauf-Meldung mit Zahlen in der Historie");
  ok(/return !firmaNameVerbindet\(firma, ansprechpartner\);/.test(regel), "Kandidat = dieselbe Regel wie der Eingang (firmaNameVerbindet)");
  // Die Regel liest den Notiz-Block genau so, wie der Eingang ihn schreibt — ändert sich das dort, schlägt diese Wand an.
  ok(firmen.includes("const notizZeile = `FIAON Global (${heute.split(\"-\").reverse().join(\".\")}): ${ein.verlauf}`.slice(0, 600);"), "globalLeadAufnehmen schreibt den Notiz-Block im erwarteten Format");
  ok(firmen.includes("VALUES (${firmaId}, NULL, 'Website', 'global', ${ein.ereignis}, ${ein.verlauf.slice(0, 2000)})"), "… und die Eingangszeile mit demselben Verlauf");
  ok(/firmaNameVerbindet\(firma, ein\.ansprechpartner\)/.test(firmen), "Der Eingang verbindet über den Namen nur mit firmaNameVerbindet (Platzhalter-Fix bleibt)");
  // Die Marken, auf die sich der Planer verlässt — ändern sich die Absender oder Spalten dort, schlägt diese Wand an.
  const dossierLib = lies("server/lib/fiaon-lead-dossier.ts");
  const mara = lies("server/lib/fiaon-mara-business.ts");
  const weg = lies("server/lib/fiaon-lead-weg.ts");
  const termin = lies("server/lib/fiaon-global-termin.ts");
  ok(/UPDATE fiaon_lead_dossier SET selbst_am = NOW\(\)/.test(dossierLib) && /'global', 'selbst', \$\{`Justin ruft selbst an/.test(dossierLib), "„Ich rufe selbst an“: selbst_am am Dossier, danach die Zeile „selbst“");
  ok(/weg_am = NOW\(\)/.test(mara) && /'Mara \(WhatsApp\)', 'global', 'gespraechsweg'/.test(mara), "Gesprächsweg: weg_am, Zeile von „Mara (WhatsApp)“");
  ok(/erzaehltVermerken\(k\.firmaId, `WhatsApp: \$\{/.test(mara) && /'global', 'erzaehlt', \$\{text\.slice\(0, 2000\)\}/.test(weg) && /name: "Mara \(WhatsApp\)"/.test(mara), "Maras Notiz: „WhatsApp: …“ als „erzählt“");
  ok(/schluessel: `global-termin:\$\{buchung\.id\}`/.test(termin) && /anlass: "termin", anlassId: buchung\.id/.test(termin), "Buchung: Auftrag global-termin:<Termin>, Buchungsmeldung anlass „termin“");
  ok(/SELECT firma_id, faden_betreff FROM fiaon_lead_dossier WHERE anlass = 'termin' AND anlass_id = \$\{terminId\}/.test(dossierLib), "leadFadenZuTermin liest die Buchungsmeldung zuerst (darum zieht sie mit)");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — LOKALE WEGWERF-DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (erfundene Menschen, Karte im alten Stil zusammengelegt)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const F = await import("../server/routes/fiaon-firmen");
  await (await import("../server/routes/fiaon-bewerbungen")).ensureAnfragenSpalten();
  await (await import("../server/lib/fiaon-lead-dossier")).leadDossierSchema();
  await (await import("../server/lib/fiaon-lead-weg")).leadWegSchema();
  await (await import("../server/lib/fiaon-global-lead-post")).leadPostSchema();
  await (await import("../server/lib/fiaon-lead-takt")).leadTaktBereit();
  await (await import("../server/lib/fiaon-mara-business")).mbSchema();
  await (await import("../server/routes/fiaon-betreiber-todo")).ensureTodoTabelle();
  await sql`DELETE FROM fiaon_settings WHERE key = 'firmen_trennen'`;
  const LAUF = randomBytes(3).toString("hex");
  const DOM = `ft-${LAUF}.example`;
  const mail = (n: number) => `ft-${LAUF}-${n}@p${n}.${DOM}`; // je Person eine eigene Domain (gleiche Firmen-Domain hielte zusammen)
  const nummer = (n: number) => `+49152${String(parseInt(LAUF, 16) % 100000).padStart(5, "0")}${String(n).padStart(3, "0")}`;
  const heute = (await import("../server/lib/fiaon-time")).berlinToday();
  // Die Prüf-Kopie kann weitere Kandidaten enthalten — der Deckel darf hier nicht greifen.
  const AN = { modus: "an" as const, deckel: 1000, rueckfall: null };
  // Die Karten-Tabellen über den echten Eingang (ensureFirmen) — mit einem ECHTEN Firmennamen, also nie ein Kandidat.
  await F.globalLeadAufnehmen({
    firma: `Ft Pruef Logistik ${LAUF} GmbH`, ansprechpartner: "Ft Aufbau", telefon: "", email: `aufbau-${mail(0)}`, zustaendigAgentId: null,
    status: "wiedervorlage", ereignis: "anfrage", verlauf: "Prüfaufbau (Tabellen)",
  });

  /** Eine Karte im alten Stil: Eigentümer + fremde Eingänge mit „Selbständig“, alles per INSERT (so lag es in Produktion). */
  const zusammengelegt = async (eigner: number, fremde: number[], opt: { notizVeraendert?: boolean } = {}) => {
    const menschen = [eigner, ...fremde];
    const anfragen: number[] = [];
    let zeit = Date.now() - 3 * 24 * 3_600_000;
    for (const m of menschen) {
      const [a] = (await sql`
        INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, text, created_at)
        VALUES ('global', ${`Ft Person${m}`}, ${mail(m)}, 'Selbständig', ${nummer(m)}, 'Paketwunsch: noch offen', ${new Date(zeit)})
        RETURNING id`) as any[];
      anfragen.push(Number(a.id));
      zeit += 3_600_000;
    }
    const [k] = (await sql`
      INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, telefon, email, quelle, status, zustaendig_agent_id, wiedervorlage, global_am, notiz)
      VALUES ('Selbständig', ${`Ft Person${eigner}`}, ${nummer(eigner)}, ${mail(eigner)}, 'global', 'in_arbeit', NULL, ${heute}::date, NOW(), NULL)
      RETURNING id`) as any[];
    const karte = Number(k.id);
    const bloecke: string[] = [];
    for (let i = 0; i < menschen.length; i++) {
      const [a] = (await sql`SELECT created_at FROM fiaon_anfragen WHERE id = ${anfragen[i]}`) as any[];
      const t = new Date(a.created_at).getTime();
      const verlauf = eingangText(anfragen[i], `Prüfnachricht ${i}`);
      await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz, created_at) VALUES (${karte}, NULL, 'Website', 'global', 'anfrage', ${verlauf}, ${new Date(t + 10)})`;
      await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz, created_at) VALUES (${karte}, NULL, 'System', 'global', 'dossier', 'Lead-Dossier an Justin', ${new Date(t + 300)})`;
      await sql`
        INSERT INTO fiaon_lead_dossier (anlass, anlass_id, anfrage_id, firma_id, status, temperatur, faden_betreff, mail_basis_am, mail_basis_id, basis)
        VALUES ('anfrage', ${anfragen[i]}, ${anfragen[i]}, ${karte}, 'gesendet', 'warm', ${`Lead: Ft Person${eigner} · warm`}, ${new Date(t + 297)}, ${`<ft-${LAUF}-${i}@example.com>`},
                ${sql.json({ firmaId: karte, cockpitUrl: `https://fiaon.example/agent/firmen?firma=${karte}`, kontakt: { name: `Ft Person${menschen[i]}` } } as any)})`;
      await sql`INSERT INTO fiaon_lead_takt (anfrage_id, firma_id, eingang_am, t1_am) VALUES (${anfragen[i]}, ${i === 0 ? karte : null}, ${new Date(t)}, ${new Date(t + 400)})`;
      if (i === 0) await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz, created_at) VALUES (${karte}, NULL, 'System', 'global', 'lead_meldung', 'Lead-Meldung an das Team', ${new Date(t + 403)})`;
      else await sql`INSERT INTO fiaon_lead_weg (anfrage_id, code, code_bis, firma_id) VALUES (${anfragen[i]}, ${`ft${LAUF}${anfragen[i]}`.slice(0, 20)}, NOW() + INTERVAL '30 days', NULL)`;
      await sql`
        INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, link, status, quelle)
        VALUES (${`global-anfrage:${anfragen[i]}`}, 'FIAON Global: Selbständig bittet um einen Anruf', ${`Anfrage #${anfragen[i]} — Prüfauftrag`}, ${`/agent/firmen?firma=${karte}`}, 'offen', 'website')`;
      const b = blockWie(berlinZeit(new Date(t + 10)).iso, verlauf);
      bloecke.push(opt.notizVeraendert && i === 1 ? `${b} (von Hand ergänzt)` : b);
    }
    const anruf = "Prüf-Anruf-Notiz ohne Kopf — gehört dem Eigentümer";
    await sql`UPDATE fiaon_firmen_leads SET notiz = ${[...bloecke, anruf].join("\n")} WHERE id = ${karte}`;
    await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${karte}, NULL, 'Prüfer', 'anruf', 'erreicht_interesse', ${anruf})`;
    return { karte, anfragen, anruf, bloecke };
  };
  const neueKarten = async (quelle: number) => (await sql`SELECT * FROM fiaon_firmen_leads WHERE getrennt_aus = ${quelle} ORDER BY id`) as any[];
  const protokoll = async (quelle: number) => (await sql`SELECT * FROM fiaon_firmen_trennung WHERE quell_firma_id = ${quelle} ORDER BY id`) as any[];
  const logVon = async (karte: number) => (await sql`SELECT id, art, ergebnis, notiz FROM fiaon_firmen_log WHERE firma_id = ${karte} ORDER BY id`) as any[];

  const k1 = await zusammengelegt(1, [2, 3]);

  abschnitt("B1 Schalter aus und trocken — nichts wird geschrieben");
  await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('firmen_trennen', 'aus', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  gleich((await L.firmenTrennenLauf()).modus, "aus", "Schalter aus → modus aus");
  await sql`DELETE FROM fiaon_settings WHERE key = 'firmen_trennen'`;
  const vorherLog = await logVon(k1.karte);
  const tr = await L.firmenTrennenLauf({ rueckfall: null });
  gleich(tr.modus, "trocken", "Schalter fehlt → trocken");
  gleich(tr.plan.filter((x) => x.quelle === k1.karte).map((x) => [x.anfragen, x.ziel]), [[[k1.anfragen[1]], "neu"], [[k1.anfragen[2]], "neu"]], "Plan: zwei neue Karten");
  gleich((await neueKarten(k1.karte)).length, 0, "… keine Karte angelegt");
  gleich((await logVon(k1.karte)).length, vorherLog.length, "… Verlauf unverändert");

  abschnitt("B2 Echter Lauf — zwei neue Karten, fremde Stücke umgezogen, Eigentümer-Stücke bleiben");
  const an = await L.firmenTrennenLauf(AN);
  ok(an.fehler === 0, `kein Fehler (${an.fehlerText ?? "—"})`);
  const neu1 = await neueKarten(k1.karte);
  gleich(neu1.map((x) => x.email), [mail(2), mail(3)], "zwei neue Karten mit den Mails der fremden Menschen");
  ok(neu1.every((x) => x.status === "wiedervorlage" && x.quelle === "global" && x.firma === "Selbständig"), "neue Karten: Wiedervorlage, Quelle global, Firmenfeld roh");
  const [w] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_leads WHERE getrennt_aus = ${k1.karte} AND wiedervorlage = ${heute}::date`) as any[];
  gleich(Number(w?.n), 2, "… Wiedervorlage heute (Berlin) → ganz oben in „Jetzt dran“");
  const [quelleNach] = (await sql`SELECT * FROM fiaon_firmen_leads WHERE id = ${k1.karte}`) as any[];
  gleich(String(quelleNach.notiz), [k1.bloecke[0], k1.anruf].join("\n"), "Quelle: eigener Block und Anruf-Notiz ohne Kopf bleiben");
  gleich(quelleNach.status, "in_arbeit", "Quelle: der eigene Anruf war das letzte Ereignis → Stand bleibt");
  gleich(String(neu1[0].notiz), k1.bloecke[1], "Ziel 1: sein Notiz-Block");
  const logQuelle = await logVon(k1.karte);
  ok(logQuelle.filter((l) => l.ergebnis === "anfrage").length === 1 && logQuelle.some((l) => l.ergebnis === "lead_meldung") && logQuelle.some((l) => l.art === "anruf"), "Quelle behält Eingang, Lead-Meldung und Anruf des Eigentümers");
  gleich(logQuelle.filter((l) => l.ergebnis === "getrennt").length, 2, "Quelle: zwei Zeilen „Getrennt: …“");
  const logZiel = await logVon(Number(neu1[0].id));
  gleich(logZiel.map((l) => l.ergebnis).sort(), ["anfrage", "dossier", "getrennt"], "Ziel 1: Eingang, Dossier-Zeile, „Getrennt“");
  const [dz] = (await sql`SELECT firma_id, faden_betreff, mail_basis_id, basis->>'firmaId' AS fid, basis->>'cockpitUrl' AS url FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${k1.anfragen[1]}`) as any[];
  ok(Number(dz.firma_id) === Number(neu1[0].id) && dz.faden_betreff === "Lead: Ft Person2 · warm" && dz.mail_basis_id == null, "Dossier: eigene Karte, eigener Faden, ohne fremde Message-ID");
  ok(Number(dz.fid) === Number(neu1[0].id) && String(dz.url).endsWith(`firma=${neu1[0].id}`), "… firmaId und Cockpit-Link im gespeicherten Dossier");
  const [d0] = (await sql`SELECT firma_id, mail_basis_id FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${k1.anfragen[0]}`) as any[];
  ok(Number(d0.firma_id) === k1.karte && !!d0.mail_basis_id, "Dossier des Eigentümers bleibt unberührt");
  const [tk] = (await sql`SELECT firma_id FROM fiaon_lead_takt WHERE anfrage_id = ${k1.anfragen[1]}`) as any[];
  const [wg] = (await sql`SELECT firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${k1.anfragen[1]}`) as any[];
  ok(Number(tk.firma_id) === Number(neu1[0].id) && Number(wg.firma_id) === Number(neu1[0].id), "Takt und Lead-Weg (vorher leer) zeigen auf die eigene Karte");
  const [au] = (await sql`SELECT link, titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${k1.anfragen[1]}`}`) as any[];
  ok(au.link === `/agent/firmen?firma=${neu1[0].id}` && au.titel === "FIAON Global: Ft Person2 bittet um einen Anruf" && /Hinweis \(/.test(String(au.text)), "Auftrag: Link, Titel mit Namen, Hinweis");
  const [au0] = (await sql`SELECT link FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${k1.anfragen[0]}`}`) as any[];
  gleich(au0.link, `/agent/firmen?firma=${k1.karte}`, "Auftrag des Eigentümers bleibt");
  const prot = await protokoll(k1.karte);
  ok(prot.length === 2 && prot.every((x) => x.ziel_firma_id && x.bewegt && x.vorher && x.regel), "zwei Protokollzeilen mit Ziel, bewegt und vorher");
  ok(prot.every((x) => (typeof x.vorher === "string" ? JSON.parse(x.vorher) : x.vorher)?.status === "in_arbeit"), "… „vorher“ mit dem Status der Quelle");

  abschnitt("B3 Zweiter Lauf = 0 Änderungen");
  const zwei = await L.firmenTrennenLauf(AN);
  ok(!zwei.plan.some((x) => x.quelle === k1.karte), "nichts mehr zu trennen");
  gleich((await neueKarten(k1.karte)).length, 2, "keine dritte Karte");
  gleich((await protokoll(k1.karte)).length, 2, "keine weitere Protokollzeile");

  abschnitt("B4 Zwei gleichzeitige Läufe — je Gruppe genau eine Protokollzeile");
  const k2 = await zusammengelegt(11, [12]);
  const [x1, x2] = await Promise.all([L.firmenTrennenLauf(AN), L.firmenTrennenLauf(AN)]);
  ok(x1.fehler + x2.fehler <= 1, "höchstens einer wartet zu lange (lock_timeout) — nie doppelt");
  gleich((await protokoll(k2.karte)).length, 1, "eine Protokollzeile");
  gleich((await neueKarten(k2.karte)).length, 1, "eine neue Karte");

  abschnitt("B5 Hat der fremde Lead schon eine eigene Karte, wird sie das Ziel");
  const [eigene] = (await sql`
    INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, telefon, email, quelle, status) VALUES ('Selbständig', 'Ft Person22', ${nummer(22)}, ${mail(22)}, 'global', 'termin')
    RETURNING id`) as any[];
  const k3 = await zusammengelegt(21, [22]);
  await L.firmenTrennenLauf(AN);
  gleich((await neueKarten(k3.karte)).length, 0, "keine neue Karte");
  const [au3] = (await sql`SELECT link FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${k3.anfragen[1]}`}`) as any[];
  gleich(au3.link, `/agent/firmen?firma=${eigene.id}`, "Auftrag zeigt auf die vorhandene Karte der Person");
  const [st3] = (await sql`SELECT status, getrennt_aus FROM fiaon_firmen_leads WHERE id = ${eigene.id}`) as any[];
  ok(st3.status === "termin" && st3.getrennt_aus == null, "ihr Stand bleibt, sie ist nicht „getrennt aus“");

  abschnitt("B6 Dieselbe Person bleibt — veränderte Notiz bekommt einen Vermerk");
  const k4 = await zusammengelegt(31, []);
  // Dieselbe Person schreibt noch einmal — neue Mail, dieselbe Nummer — und hängt (Eingangszeile, Auftrag) an derselben Karte.
  const [zweite] = (await sql`
    INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, text) VALUES ('global', 'Ft P. 31', ${`zweite-${mail(31)}`}, 'Selbständig', ${nummer(31)}, 'Paketwunsch: noch offen')
    RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${k4.karte}, NULL, 'Website', 'global', 'anfrage', ${eingangText(Number(zweite.id), "zweite Anfrage")})`;
  await sql`INSERT INTO fiaon_betreiber_todos (schluessel, titel, link, status, quelle) VALUES (${`global-anfrage:${zweite.id}`}, 'FIAON Global: Selbständig bittet um einen Anruf', ${`/agent/firmen?firma=${k4.karte}`}, 'offen', 'website')`;
  await L.firmenTrennenLauf(AN);
  gleich((await protokoll(k4.karte)).length, 0, "zweite Anfrage derselben Person (gleiche Nummer, neue Mail) → keine Trennung");
  const [au4] = (await sql`SELECT link FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${zweite.id}`}`) as any[];
  gleich(au4.link, `/agent/firmen?firma=${k4.karte}`, "… ihr Auftrag bleibt an der Karte");
  const k5 = await zusammengelegt(41, [42], { notizVeraendert: true });
  await L.firmenTrennenLauf(AN);
  const [q5] = (await sql`SELECT notiz FROM fiaon_firmen_leads WHERE id = ${k5.karte}`) as any[];
  ok(String(q5.notiz).includes("(von Hand ergänzt)"), "veränderter Block bleibt in der Notiz");
  ok((await logVon(k5.karte)).some((l) => l.ergebnis === "getrennt_hinweis" && /von Hand prüfen/.test(String(l.notiz))), "… mit Vermerk „bitte von Hand prüfen“");
  gleich((await neueKarten(k5.karte)).length, 1, "… getrennt wird trotzdem (Auftrag, Dossier, Verlauf)");

  abschnitt("B7 Stand der Quelle: hatte der Eigentümer abgesagt, bleibt es dabei");
  const k6 = await zusammengelegt(51, [52]);
  const [e6] = (await sql`SELECT created_at FROM fiaon_anfragen WHERE id = ${k6.anfragen[0]}`) as any[];
  // Sein Anruf „kein Interesse“ lag VOR dem fremden Eingang; der fremde Eingang setzte danach „Wiedervorlage heute“.
  await sql`UPDATE fiaon_firmen_log SET ergebnis = 'erreicht_kein_interesse', created_at = ${new Date(new Date(e6.created_at).getTime() + 30 * 60_000)}
             WHERE firma_id = ${k6.karte} AND art = 'anruf'`;
  await sql`UPDATE fiaon_firmen_leads SET status = 'wiedervorlage', wiedervorlage = ${heute}::date WHERE id = ${k6.karte}`;
  await L.firmenTrennenLauf(AN);
  const [q6] = (await sql`SELECT status, wiedervorlage FROM fiaon_firmen_leads WHERE id = ${k6.karte}`) as any[];
  ok(q6.status === "kein_interesse" && q6.wiedervorlage == null, "Quelle wieder auf „kein Interesse“ ohne Wiedervorlage");
  ok((await logVon(k6.karte)).some((l) => l.ergebnis === "getrennt_hinweis" && /^Stand korrigiert/.test(String(l.notiz))), "… mit Vermerk „Stand korrigiert“");
  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
