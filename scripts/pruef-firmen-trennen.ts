// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-487 (09.11.2026): FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN (Lauf firmen_trennen)
//
//   A  REIN (immer, ohne Datenbank, ohne Netz): Schalter (an | trocken | aus, Tippfehler = trocken), Kandidat nur bei
//      Platzhalter im Firmenfeld (echte Firmennamen nie), „dieselbe Person“ (Mail, 9 Ziffern, voller Name, person_id, ø/æ/ł,
//      Anrede), fremd NUR wenn alles verschieden (auch über Ketten, gleiche Firmen-Domain hält zusammen, Kopf ohne Kennzeichen
//      trennt nichts), Gruppierung nach Person, Schlüssel, Ziel = vorhandene Karte (person_id vor Mail vor Nummer, nie die
//      Quelle, nie nur der Name), Verlaufszeilen nur mit eindeutigem Bezug (zweideutig bleibt), Notiz-Blöcke (wörtlich, ganze
//      Zeilen, 00:08 Uhr Berlin, kurz nach Mitternacht, verändert = unberührt, Anruf-Notiz ohne Kopf bleibt), der ganze Planer
//      an einer nachgebauten Karte (mehrere Menschen mit „Selbständig“), Sätze, Meldung ohne Kennungen, Quelltext-Wände.
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): Karte im alten Stil per
//      INSERT zusammengelegt; trocken schreibt nichts; echter Lauf trennt (zwei neue Karten, Stücke umgezogen, Eigentümer-Stücke
//      und Anruf-Notiz bleiben, Aufträge/Dossier-Faden/global_am neu, Protokoll); zweiter Lauf = 0; zwei gleichzeitige Läufe =
//      je Gruppe EINE Protokollzeile; vorhandene Karte der Person wird Ziel; dieselbe Person bleibt; veränderte Notiz = Vermerk.
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
// Berliner Wandzeit → Date (über die Server-Regel, nie „Date.UTC − 1 Stunde“ von Hand).
const um = (tag: string, hh: number, mm = 0, ss = 0, msek = 0) => new Date(berlinZeitpunkt(tag, hh * 60 + mm).getTime() + ss * 1000 + msek);
// Der Notiz-Block genau so, wie globalLeadAufnehmen ihn baut (die Wand A11 prüft, dass es dort so bleibt).
const blockWie = (tagIso: string, verlauf: string) => `FIAON Global (${tagIso.split("-").reverse().join(".")}): ${verlauf}`.slice(0, 600);
const eingangText = (anfrageId: number, rest: string) => `Bittet um einen Anruf (Anfrage #${anfrageId} über das Meta-Sofortformular). Paketwunsch: noch offen. Nachricht: ${rest}`;

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 Schalter „firmen_trennen“");
gleich(P.FIRMEN_TRENNEN_SCHALTER, "firmen_trennen", "Schlüssel in fiaon_settings");
gleich(P.trennModusLesen(undefined), "an", "fehlt → an (Justins Go)");
gleich(P.trennModusLesen(""), "an", "leer → an");
gleich(P.trennModusLesen(" AN "), "an", "„AN“ → an");
gleich(P.trennModusLesen("trocken"), "trocken", "trocken → trocken");
gleich(P.trennModusLesen("aus"), "aus", "aus → aus");
gleich(P.trennModusLesen("0"), "aus", "0 → aus");
gleich(P.trennModusLesen("trockn"), "trocken", "Tippfehler → trocken (schreibt nie)");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A2 Kandidat nur mit Platzhalter im Firmenfeld");
for (const [firma, person] of [
  ["Selbständig", "Erika Beispiel"], ["Selbstständig", "Erika Beispiel"], ["selbstaendig", "Erika Beispiel"], ["GmbH", "Erika Beispiel"],
  ["Siehe oben", "Erika Beispiel"], ["Mehrere", "Erika Beispiel"], ["noch offen", "Erika Beispiel"], ["privat", "Erika Beispiel"],
  ["Erika Beispiel (Firma noch offen)", "Erika Beispiel"], ["Privatperson · Erika Beispiel", "Erika Beispiel"], ["Erika Beispiel", "Erika Beispiel"],
  ["Beispiel", "Erika Beispiel"], ["-", "Erika Beispiel"], ["", "Erika Beispiel"],
] as const) ok(P.trennKandidat(firma, person), `„${firma}“ ist ein Platzhalter → Kandidat`);
for (const firma of ["Muster Logistik GmbH", "Alphaexample", "Schmidt Immobilien GmbH", "Max Muster e.K."]) {
  ok(!P.trennKandidat(firma, "Erika Beispiel"), `„${firma}“ ist ein echter Name → nie anfassen`);
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
ok(!P.gleichePerson({ name: "Max" }, { name: "Max" }), "nur Vorname → nein");
ok(!P.gleichePerson({ name: "Max Muster", email: "max@a-firma.example", telefon: "0151 11111111" }, { name: "Eva Muster", email: "eva@b-firma.example", telefon: "0151 22222222" }), "alles verschieden → nein");
ok(P.gleichePerson({ personIds: [null, 7001] }, { personIds: [7001] }), "gemeinsame person_id → ja");
ok(!P.gleichePerson({ email: "", telefon: "" , name: "" }, { email: "", telefon: "", name: "" }), "leere Felder sind nie gleich");
ok(P.zusammengehoerig({ email: "max@muster-bau.example" }, { email: "eva@muster-bau.example" }), "gleiche Firmen-Domain hält zusammen (im Zweifel nicht trennen)");
ok(!P.zusammengehoerig({ email: "max@gmail.com" }, { email: "eva@gmail.com" }), "Freemail-Domain hält nicht zusammen");
ok(!P.kontaktErkennbar({ name: "Max" }) && P.kontaktErkennbar({ telefon: "0151 23456789" }), "Kopf erkennbar: Vorname allein nein, Nummer ja");

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
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A6 Verlaufszeilen: nur mit eindeutigem Anfrage-Bezug");
{
  const t = um("2026-03-02", 16, 13);
  const plus = (msek: number) => new Date(t.getTime() + msek);
  const bekannt = new Set([901, 902]);
  const marken = [
    { traeger: "a:901", art: "dossier" as const, am: plus(0) },
    { traeger: "a:902", art: "dossier" as const, am: plus(8000) },
    { traeger: "a:902", art: "takt" as const, am: plus(60_000) },
    { traeger: "t:4401", art: "gespraech" as const, am: plus(120_000) },
  ];
  const z = (id: number, art: string, ergebnis: string | null, am: Date, notiz = "") => ({ id, art, ergebnis, notiz, am, agentName: "System" });
  gleich(P.logZeileZuordnen(z(8001, "global", "anfrage", t, eingangText(902, "…")), bekannt, marken).traeger, ["a:902"], "Eingangszeile über „(Anfrage #n über …)“");
  gleich(P.logZeileZuordnen(z(8002, "global", "anfrage", t, eingangText(999, "…")), bekannt, marken).traeger, [], "unbekannte Anfrage-Nummer → kein Bezug");
  gleich(P.logZeileZuordnen(z(8003, "global", "lead_meldung", plus(60_003), ""), bekannt, marken).traeger, ["a:902"], "Lead-Meldung 3 ms neben T1 → Bezug");
  gleich(P.logZeileZuordnen(z(8004, "global", "lead_meldung", plus(70_000), ""), bekannt, marken).traeger, [], "10 s daneben → kein Bezug");
  gleich(P.logZeileZuordnen(z(8005, "anruf", "erreicht_interesse", plus(60_003), "Notiz"), bekannt, marken).traeger, [], "Anrufe haben nie einen Anfrage-Bezug");
  gleich(P.logZeileZuordnen(z(8006, "global", "gespraech_mail", plus(120_001), ""), bekannt, marken).traeger, [], "Gesprächs-Mails bleiben (kein Bezug)");
  const seite = new Map<string, number | "eigen">([["a:901", "eigen"], ["a:902", 0], ["t:4401", "eigen"]]);
  const v = P.logZeilenVerteilen([
    z(8010, "global", "dossier", plus(8003)),            // nur neben 902 → Gruppe 0
    z(8011, "global", "dossier", plus(4000)),            // neben 901 UND 902 → zweideutig
    z(8012, "global", "dossier", plus(3)),               // nur neben 901 → bleibt (eigen)
    z(8013, "global", "termin_steht", plus(120_003)),    // Gespräch des Eigentümers → bleibt
    z(8014, "global", "anfrage", t, eingangText(902, "x")),
  ], bekannt, marken, seite);
  gleich(v.jeGruppe.get(0), [8010, 8014], "eindeutig zur Gruppe: Dossier-Zeile und Eingangszeile");
  gleich(v.zweideutig, [{ id: 8011, gruppen: [0] }], "neben zwei Seiten → zweideutig (bleibt, Vermerk)");
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
      { id: 701, anlass_id: A1, firma_id: K, mail_basis_am: p(t1, 437), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Erik Eigner · warm" },
      { id: 702, anlass_id: A2, firma_id: K, mail_basis_am: p(t2, 285), mail_ki_am: null, temperatur: "warm", faden_betreff: "Lead: Erik Eigner · warm" },
      { id: 703, anlass_id: A3, firma_id: K, mail_basis_am: p(t3, 229), mail_ki_am: null, temperatur: "heiss", faden_betreff: "Lead: Erik Eigner · warm" },
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
  gleich([pl.karten, pl.platzhalter, pl.uebersprungen], [2, 1, 0], "zwei Karten gelesen, eine mit Platzhalter (die echte Firma nie)");
  const plan = pl.plaene.find((x) => x.quelleId === K)!;
  gleich(plan.eigene, [A1], "Eigentümer behält seine Anfrage");
  gleich(plan.gruppen.map((g) => g.anfrageIds), [[A2], [A3]], "zwei fremde Gruppen");
  ok(!pl.plaene.some((x) => x.quelleId === 520), "echte Firma mit zwei Menschen → kein Plan");
  const [g2, g3] = plan.gruppen;
  gleich(g2.logIds, [8106, 8107], "Gruppe 1: Eingangs- und Dossier-Zeile");
  gleich(g3.logIds, [8108, 8109], "Gruppe 2: Eingangs- und Dossier-Zeile");
  gleich([g2.dossierIds, g2.wegAnfragen, g2.taktAnfragen, g2.auftragIds, g2.gespraechTermine], [[702], [A2], [A2], [6002], []], "Gruppe 1: Dossier, Lead-Weg, Takt (leer → gefüllt), Auftrag — kein Gespräch");
  gleich([g3.dossierIds, g3.auftragIds], [[703], [6003]], "Gruppe 2: Dossier und Auftrag");
  gleich([g2.zweideutig, g3.zweideutig], [0, 0], "keine zweideutige Zeile");
  gleich(g2.zustaendigAgentId, 43, "zuständig wie der Auftrag der Anfrage");
  gleich([g2.kontakt.firma, g2.kontakt.name, g2.kontakt.email, g2.kontakt.land], ["Selbständig", "Frieda Fremd", "frieda@fremd-eins.example", "DE"], "Kopf der neuen Karte aus der Anfrage (Mail klein)");
  gleich(g2.kontakt.am, t2.toISOString(), "global_am = Eingang der Gruppe");
  gleich(g2.fadenStamm, "Lead: Frieda Fremd · warm", "eigener Faden-Stamm (Name statt Platzhalter)");
  gleich(g3.fadenStamm, "Lead: Franz Fremder · heiß", "… mit der Temperatur des Dossiers");
  // Die Notiz, wie die beiden Transaktionen sie nacheinander sähen.
  const n2 = P.notizTrennen(notiz, g2.blockZeilen);
  const n3 = P.notizTrennen(n2.rest, g3.blockZeilen);
  gleich([n2.bloecke.length, n2.nicht, n3.bloecke.length, n3.nicht], [1, 0, 1, 0], "je Gruppe ein Notiz-Block umgezogen");
  gleich(n3.rest, [blockWie("2026-03-02", v(A1, "Eigner")), blockWie("2026-03-02", vB), anruf].join("\n"), "Eigentümer behält Eingang, Buchung und die Anruf-Notiz ohne Kopf");
  ok(!P.paketwunschVonGruppe("Global Struktur (2.499 €)", g2.texte, plan.eigeneBelege), "Paketwunsch des Eigentümers (aus seiner Buchung) bleibt");
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
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A9 Kopf, Titel, Faden, Sätze");
ok(P.paketwunschVonGruppe("Global Struktur (2.499 €)", ["Paketwunsch: Global Struktur (2.499 €)"], []), "Paketwunsch nur aus der Gruppe → zurücksetzen");
ok(!P.paketwunschVonGruppe("Global Struktur (2.499 €)", ["Paketwunsch: Global Struktur (2.499 €)"], ["Erstgespräch gebucht … Paketwunsch: Global Struktur (2.499 €)."]), "… steht er auch beim Eigentümer → bleibt");
ok(!P.paketwunschVonGruppe(null, ["Paketwunsch: Global Struktur (2.499 €)"], []), "kein Wunsch am Kopf → nichts zu tun");
gleich(P.auftragTitelNeu("FIAON Global: Selbständig bittet um einen Anruf", "Selbständig", "Frieda Fremd"), "FIAON Global: Frieda Fremd bittet um einen Anruf", "Auftragstitel: Name statt Platzhalter");
gleich(P.auftragTitelNeu("FIAON Global: Frieda Fremd — bitte neu vereinbaren", "Selbständig", "Frieda Fremd"), "FIAON Global: Frieda Fremd — bitte neu vereinbaren", "Titel ohne Platzhalter bleibt");
gleich(P.neuerFadenStamm("Selbständig", "Frieda Fremd", "kalt", "Lead: Erik Eigner · Privatkunde?"), "Lead: Frieda Fremd · Privatkunde?", "„Privatkunde?“-Faden bleibt einer");
gleich(P.neuerFadenStamm("Selbständig", "Frieda Fremd", "unbekannt"), "Lead: Frieda Fremd", "unbekannte Temperatur → ohne Zusatz");
{
  const q = P.getrenntSatzQuelle({ anfrageIds: [902], zielId: 540, zielNeu: true, firmaRoh: "Selbständig" });
  const z = P.getrenntSatzZiel({ anfrageIds: [902], quelleId: 501, firmaRoh: "Selbständig" });
  ok(/^Getrennt: Anfrage #902 /.test(q) && q.includes("auf eigene Karte #540") && q.includes("Platzhalter"), "Zeile auf der Quelle: „Getrennt: … auf eigene Karte #…“");
  ok(/^Getrennt aus Karte #501: Anfrage #902 /.test(z) && z.includes("auf eigene Karte") && z.includes("bitte diesen Lead selbst anrufen"), "Zeile auf dem Ziel: woher, und dass die Notizen dort jemand anderen betrafen");
  ok(P.auftragHinweis({ quelleId: 501, zielId: 540, firmaRoh: "Selbständig", tagIso: "2026-03-09" }).startsWith("Hinweis (09.03.2026): Dieser Auftrag lag auf einer fremden Firmen-Karte"), "Hinweis im Auftrag mit Datum");
  gleich(P.vermerkSatz({ anfrageIds: [902], notizNicht: 0, zweideutig: 0 }), null, "nichts ausgelassen → kein Vermerk");
  ok(/Notiz-Block.*von Hand prüfen.*nicht eindeutig/.test(String(P.vermerkSatz({ anfrageIds: [902, 908], notizNicht: 1, zweideutig: 2 }))), "Vermerk nennt Notiz und zweideutige Zeilen");
  ok(P.auftragAnfrage("global-rueckruf:902") === 902 && P.auftragAnfrage("global-termin:902") === null, "Auftrags-Schlüssel: Anfrage, Rückruf, Antwort — kein Termin");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A10 Meldung für die Lauf-Historie (nur Zahlen, keine Kennungen)");
{
  const L = await import("../server/lib/fiaon-firmen-trennen");
  ok(typeof L.firmenTrennenLauf === "function" && typeof L.firmenTrennenTakt === "function" && typeof L.firmenTrennungSchema === "function", "Lauf lädt (Takt, Lauf, Schema)");
  const m = String(L.trennMeldung({
    modus: "an", karten: 44, platzhalter: 15, gruppen: 2, getrennt: 2, neu: 2, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0,
    zeilen: { verlauf: 4, dossier: 2, auftraege: 2, lead: 4, notiz: 2 }, plan: [{ quelle: 501, anfragen: [902], ziel: 540 }], fehlerText: null,
  }));
  ok(m.includes('"getrennt":2') && m.includes('"zeilen.verlauf":4') && m.includes('"neu":2'), "Meldung trägt die Zahlen");
  ok(!/501|902|540|plan|quelle/.test(m), "… und keine Karten- oder Anfrage-Kennung");
  const t = String(L.trennMeldung({ modus: "trocken", karten: 1, platzhalter: 1, gruppen: 1, getrennt: 0, neu: 1, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0, zeilen: { verlauf: 2, dossier: 1, auftraege: 1, lead: 2, notiz: 1 }, plan: [], fehlerText: null }));
  ok(t.startsWith('{"trocken":true'), "Trockenprobe steht als „trocken“ in der Meldung");
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
  ok(/\n  firmen_trennen: \{/.test(crons), "… als Eintrag in LAUF_FOLGEN");
  ok(/SELECT value FROM fiaon_settings WHERE key = \$\{FIRMEN_TRENNEN_SCHALTER\}/.test(lauf) && /trennModusLesen\(r\?\.value\)/.test(lauf), "Schalter wird aus fiaon_settings gelesen");
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
  ok(/kartenPlanen\(stand\)/.test(lauf) && !/from "\.\.\/server|db-pool/.test(regel), "Lauf plant mit dem reinen Planer; die Regel kennt keine Datenbank");
  const trocken = /if \(modus === "trocken"\) \{([\s\S]*?)continue;\n      \}/.exec(lauf)?.[1] ?? "";
  ok(trocken.length > 100 && !/INSERT|UPDATE|DELETE|gruppeTrennen/.test(trocken), "Trockenprobe schreibt nichts");
  ok(!/firma=\d|Anfrage #\d|#\d{2,}/.test(lauf + regel), "keine feste Karten- oder Anfragenummer im Lauf und in der Regel");
  ok(!/getHours\(|getDate\(|toLocale|Number\(new Intl/.test(lauf + regel), "Berliner Zeit nur über die Haus-Regeln (berlinZeit, berlinToday, isoPlus)");
  ok(/INSERT INTO fiaon_lauf_historie \(name, ergebnis, begonnen, beendet, dauer_ms, meldung\)/.test(lauf) && /trennMeldung\(erg\)/.test(lauf), "Lauf-Meldung mit Zahlen in der Historie");
  // Die Regel liest den Notiz-Block genau so, wie der Eingang ihn schreibt — ändert sich das dort, schlägt diese Wand an.
  ok(firmen.includes("const notizZeile = `FIAON Global (${heute.split(\"-\").reverse().join(\".\")}): ${ein.verlauf}`.slice(0, 600);"), "globalLeadAufnehmen schreibt den Notiz-Block im erwarteten Format");
  ok(firmen.includes("VALUES (${firmaId}, NULL, 'Website', 'global', ${ein.ereignis}, ${ein.verlauf.slice(0, 2000)})"), "… und die Eingangszeile mit demselben Verlauf");
  ok(/firmaNameVerbindet\(firma, ein\.ansprechpartner\)/.test(firmen), "Der Eingang verbindet über den Namen nur mit firmaNameVerbindet (Platzhalter-Fix bleibt)");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — LOKALE WEGWERF-DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (erfundene Menschen, Karte im alten Stil zusammengelegt)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const L = await import("../server/lib/fiaon-firmen-trennen");
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
  const { berlinZeit } = await import("../shared/fiaon-global-lead");
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
  const tr = await L.firmenTrennenLauf({ modus: "trocken" });
  gleich(tr.plan.filter((x) => x.quelle === k1.karte).map((x) => [x.anfragen, x.ziel]), [[[k1.anfragen[1]], "neu"], [[k1.anfragen[2]], "neu"]], "Plan: zwei neue Karten");
  gleich((await protokoll(k1.karte)).length, 0, "… keine Protokollzeile");
  gleich((await neueKarten(k1.karte)).length, 0, "… keine Karte angelegt");
  gleich((await logVon(k1.karte)).length, vorherLog.length, "… Verlauf unverändert");

  abschnitt("B2 Echter Lauf — zwei neue Karten, fremde Stücke umgezogen, Eigentümer-Stücke bleiben");
  const an = await L.firmenTrennenLauf({ modus: "an" });
  ok(an.fehler === 0, `kein Fehler (${an.fehlerText ?? "—"})`);
  const neu1 = await neueKarten(k1.karte);
  gleich(neu1.map((x) => x.email), [mail(2), mail(3)], "zwei neue Karten mit den Mails der fremden Menschen");
  ok(neu1.every((x) => x.status === "wiedervorlage" && x.quelle === "global" && x.firma === "Selbständig"), "neue Karten: Wiedervorlage, Quelle global, Firmenfeld roh");
  const [w] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_leads WHERE getrennt_aus = ${k1.karte} AND wiedervorlage = ${heute}::date`) as any[];
  gleich(Number(w?.n), 2, "… Wiedervorlage heute (Berlin) → ganz oben in „Jetzt dran“");
  const [quelleNach] = (await sql`SELECT * FROM fiaon_firmen_leads WHERE id = ${k1.karte}`) as any[];
  gleich(String(quelleNach.notiz), [k1.bloecke[0], k1.anruf].join("\n"), "Quelle: eigener Block und Anruf-Notiz ohne Kopf bleiben");
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

  abschnitt("B3 Zweiter Lauf = 0 Änderungen");
  const zwei = await L.firmenTrennenLauf({ modus: "an" });
  ok(!zwei.plan.some((x) => x.quelle === k1.karte), "nichts mehr zu trennen");
  gleich((await neueKarten(k1.karte)).length, 2, "keine dritte Karte");
  gleich((await protokoll(k1.karte)).length, 2, "keine weitere Protokollzeile");

  abschnitt("B4 Zwei gleichzeitige Läufe — je Gruppe genau eine Protokollzeile");
  const k2 = await zusammengelegt(11, [12]);
  const [x1, x2] = await Promise.all([L.firmenTrennenLauf({ modus: "an" }), L.firmenTrennenLauf({ modus: "an" })]);
  ok(x1.fehler + x2.fehler <= 1, "höchstens einer wartet zu lange (lock_timeout) — nie doppelt");
  gleich((await protokoll(k2.karte)).length, 1, "eine Protokollzeile");
  gleich((await neueKarten(k2.karte)).length, 1, "eine neue Karte");

  abschnitt("B5 Hat der fremde Lead schon eine eigene Karte, wird sie das Ziel");
  const [eigene] = (await sql`
    INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, telefon, email, quelle, status) VALUES ('Selbständig', 'Ft Person22', ${nummer(22)}, ${mail(22)}, 'global', 'termin')
    RETURNING id`) as any[];
  const k3 = await zusammengelegt(21, [22]);
  await L.firmenTrennenLauf({ modus: "an" });
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
  await L.firmenTrennenLauf({ modus: "an" });
  gleich((await protokoll(k4.karte)).length, 0, "zweite Anfrage derselben Person (gleiche Nummer, neue Mail) → keine Trennung");
  const [au4] = (await sql`SELECT link FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${zweite.id}`}`) as any[];
  gleich(au4.link, `/agent/firmen?firma=${k4.karte}`, "… ihr Auftrag bleibt an der Karte");
  const k5 = await zusammengelegt(41, [42], { notizVeraendert: true });
  await L.firmenTrennenLauf({ modus: "an" });
  const [q5] = (await sql`SELECT notiz FROM fiaon_firmen_leads WHERE id = ${k5.karte}`) as any[];
  ok(String(q5.notiz).includes("(von Hand ergänzt)"), "veränderter Block bleibt in der Notiz");
  ok((await logVon(k5.karte)).some((l) => l.ergebnis === "getrennt_hinweis" && /von Hand prüfen/.test(String(l.notiz))), "… mit Vermerk „bitte von Hand prüfen“");
  gleich((await neueKarten(k5.karte)).length, 1, "… getrennt wird trotzdem (Auftrag, Dossier, Verlauf)");
  await sql.end?.();
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
