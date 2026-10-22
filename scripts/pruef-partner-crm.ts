// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND GESCHÄFTSPARTNER-CRM — REINE REGELN (E-425, 22.10.2026)
//
// Ohne Datenbank, ohne Netz, ohne KI:
//   env -i HOME=$HOME PATH=$PATH npx tsx scripts/pruef-partner-crm.ts
//   … --rot-probe   schreibt die erfundene Mail und Telefonnummer der KI-Antwort in den Quelltext — dann MÜSSEN die
//                   Prüfungen „erfunden … verworfen“ rot werden (sie hängen wirklich am Abgleich mit dem Text).
//
// Die Beispielmail ist ERFUNDEN (Repo öffentlich, E-242), hat aber genau die Form einer echten
// Partner-Signatur: Name, Rolle, Firma mit LLC, Durchwahl „ext.“, Geschäftszeiten in PT, US-Adresse.
// ═══════════════════════════════════════════════════════════════════════════
import {
  firmaPruefen, kontaktPruefen, verlaufPruefen, aufgabePruefen, dokumentMetaPruefen, suchNormal, suchWoerter, suchtextAus, likeMuster,
  domainAus, firmenNameKern, firmenTreffer, kiVorschlagBereinigen, regelVorschlag, vorschlagErgaenzen, telefonUndDurchwahl, photonZuVorschlaegen,
  adressAnfrageSinnvoll, partnerHinweise, isoTag, landCodeAus, websiteSauber, konditionenSauber, tagsSauber, artAus, jsonAusText, lageText,
  type BestandFirma,
} from "../shared/fiaon-partner-crm";

const ROT = process.argv.includes("--rot-probe");
let gut = 0; let schlecht = 0;
function ok(name: string, bedingung: boolean, info = "") {
  if (bedingung) { gut++; console.log(`  ok   ${name}`); } else { schlecht++; console.log(`  ROT  ${name}${info ? ` — ${info}` : ""}`); }
}
function abschnitt(t: string) { console.log(`\n${t}`); }

// ── Beispieltext (erfunden) ────────────────────────────────────────────────
const MAIL = `Hi Justin,

Thanks again for signing! I'm your new account manager and will help you get the wholesale account set up.
You should receive a password reset email shortly so you can log into your partner portal.
Please set your password and let me know once your first test order is in.

Best,

Jane Example
Account Manager
Example Registered Agent LLC
208-555-0140 ext. 2040
Monday - Friday 8:30 AM - 5:00 PM PT
partners@example-agent.com
www.example-agent.com
100 W. Example Ave. Suite N, Boise, ID 83702

On Thu, Oct 22, 2026 Justin Schwarzott <js@fiaon.com> wrote:
> Looking forward to meeting our account manager.
> Justin Schwarzott · Founder · FIAON Global · +41 44 244 93 01`;

// Eine KI-Antwort, wie sie kommen könnte — mit zwei erfundenen Angaben, die fallen müssen.
const KI_ANTWORT = "```json\n" + JSON.stringify({
  firma: { name: "Example Registered Agent LLC", art: "Dienstleister", website: "https://www.example-agent.com", email: "partners@example-agent.com", telefon: "208-555-0199",
    strasse: "W. Example Ave.", hausnummer: "100", adresszusatz: "Suite N", plz: "99201", ort: "Boise", region: "ID", landCode: "USA", leistung: "Registered Agent und Gründungen" },
  kontakte: [
    { name: "Jane Example", rolle: "Account Manager", email: "jane@example-agent.com", telefon: "208-555-0140 ext. 2040", durchwahl: "", erreichbarkeit: "Mo–Fr 8:30–17:00 PT", sprache: "en" },
    { name: "Justin Schwarzott", rolle: "Founder", email: "js@fiaon.com", telefon: "+41 44 244 93 01" },
  ],
  fakten: [{ label: "Portal", value: "Passwort-Reset per Mail" }],
  verlauf: { typ: "email", am: "2026-10-22", titel: "Account Manager stellt sich vor", text: "Jane Example ist unsere Account Managerin; Passwort-Reset kommt per Mail." },
  aufgabe: { titel: "Portal-Passwort setzen", faelligAm: "2026-10-23", notiz: "" },
}) + "\n```";

// ── 1. Eingaben ────────────────────────────────────────────────────────────
abschnitt("1 · Eingaben prüfen");
{
  const f = firmaPruefen({ name: "Example Registered Agent LLC", art: "lieferant", status: "aktiv", website: "example-agent.com", email: "Partners@Example-Agent.com", telefon: "208-555-0140", land: "USA", konditionen: [{ label: "Agent", value: "65 $/Jahr" }, { label: "", value: "" }], tags: "registered agent, usa, Registered Agent" });
  ok("Firma: gültig", f.ok);
  if (f.ok) {
    ok("Firma: Website bekommt https://", f.wert.website === "https://example-agent.com", f.wert.website);
    ok("Firma: E-Mail klein", f.wert.email === "partners@example-agent.com");
    ok("Firma: Land USA → US", f.wert.landCode === "US", f.wert.landCode);
    ok("Firma: leere Kondition fällt weg", f.wert.konditionen.length === 1);
    ok("Firma: doppeltes Tag (Groß/klein) fällt weg", f.wert.tags.length === 2, f.wert.tags.join("|"));
  }
  ok("Firma: ohne Namen abgelehnt", !firmaPruefen({ name: " " }).ok);
  ok("Firma: kaputte Mail abgelehnt (nicht still verworfen)", !firmaPruefen({ name: "Test GmbH", email: "kein-at-zeichen" }).ok);
  ok("Firma: unbekannte Art → sonstige, Status → gespraech", (() => { const p = firmaPruefen({ name: "Test GmbH", art: "quatsch", status: "x" }); return p.ok && p.wert.art === "sonstige" && p.wert.status === "gespraech"; })());
  ok("Art-Synonym: Steuerberater → kanzlei", artAus("Steuerberater") === "kanzlei");
  ok("Art-Synonym: Dienstleister → lieferant", artAus("Dienstleister") === "lieferant");
  const k = kontaktPruefen({ name: "Jane Example", telefon: "208-555-0140", durchwahl: "ext. 2040", email: "jane@example-agent.com", haupt: "1" });
  ok("Kontakt: Durchwahl nur Ziffern", k.ok && k.wert.durchwahl === "2040");
  ok("Kontakt: haupt aus Formular „1“", k.ok && k.wert.haupt === true);
  ok("Kontakt: ohne Firma erlaubt (Einzelkontakt)", k.ok && k.wert.firmaId === null);
  ok("Kontakt: Telefon aus Buchstaben abgelehnt", !kontaktPruefen({ name: "Jane", telefon: "abc" }).ok);
  ok("Verlauf: ohne Partner abgelehnt", !verlaufPruefen({ titel: "x" }, "2026-10-22").ok);
  ok("Verlauf: deutsches Datum → ISO", (() => { const v = verlaufPruefen({ firmaId: 1, titel: "Call", am: "22.10.2026" }, "2026-10-22"); return v.ok && v.wert.am === "2026-10-22"; })());
  ok("Verlauf: 31.02. abgelehnt", !verlaufPruefen({ firmaId: 1, titel: "Call", am: "31.02.2026" }, "2026-10-22").ok);
  ok("Verlauf: ohne Datum = heute", (() => { const v = verlaufPruefen({ firmaId: 1, text: "Nur Text\nZeile 2" }, "2026-10-22"); return v.ok && v.wert.am === "2026-10-22" && v.wert.titel === "Nur Text"; })());
  ok("Aufgabe: zu kurz abgelehnt", !aufgabePruefen({ firmaId: 1, titel: "ab" }).ok);
  ok("Dokument: bis vor ab abgelehnt", !dokumentMetaPruefen({ firmaId: 1, gueltigAb: "2026-10-22", gueltigBis: "2026-10-01" }).ok);
  ok("isoTag: 2026-02-29 gibt es nicht", isoTag("2026-02-29") === "");
  ok("landCode: Österreich → AT", landCodeAus("Österreich") === "AT");
  ok("Website: javascript: abgelehnt", websiteSauber("javascript:alert(1)") === "");
  ok("Konditionen: höchstens 40", konditionenSauber(Array.from({ length: 50 }, (_, i) => ({ label: `L${i}`, value: "v" }))).length === 40);
  ok("Tags: höchstens 20", tagsSauber(Array.from({ length: 30 }, (_, i) => `t${i}`)).length === 20);
}

// ── 2. Suche ───────────────────────────────────────────────────────────────
abschnitt("2 · Suche normalisieren");
{
  ok("Umlaute/Akzente: „Müller Café“ → „muller cafe“", suchNormal("Müller Café") === "muller cafe", suchNormal("Müller Café"));
  ok("ß → ss", suchNormal("Straße") === "strasse");
  ok("Suchwörter: doppelt raus, höchstens 6", (() => { const w = suchWoerter("a b a c d e f g h"); return w.length === 6 && w.filter((x) => x === "a").length === 1; })());
  const st = suchtextAus(["Jane Example", "Account Manager"], ["208-555-0140"]);
  ok("Suchtext enthält Telefon als Ziffern", st.includes("2085550140"));
  ok("Suchtext: Suche „jane“ trifft", suchWoerter("Jane").every((w) => st.includes(w)));
  ok("Suchtext: Telefon getippt mit Strichen trifft", suchWoerter("208-555").every((w) => st.includes(w)) || st.includes("208555"));
  ok("LIKE-Muster maskiert % und _", likeMuster("50%_x") === "%50\\%\\_x%");
  ok("Suchwort-Ränder: Punkt am Ende fällt weg", suchWoerter("example.")[0] === "example");
}

// ── 3. Wiedererkennen ──────────────────────────────────────────────────────
abschnitt("3 · Bestehenden Partner wiedererkennen");
{
  ok("Domain aus Mail", domainAus("Jane@Example-Agent.com") === "example-agent.com");
  ok("Domain aus Website ohne www", domainAus("https://www.example-agent.com/partner") === "example-agent.com");
  ok("Freemail zählt nicht", domainAus("someone@gmail.com") === "");
  ok("Namenskern ohne Rechtsform", firmenNameKern("Example Registered Agent, LLC") === "example registered agent", firmenNameKern("Example Registered Agent, LLC"));
  const bestand: BestandFirma[] = [
    { id: 1, name: "Example Registered Agent LLC", website: "https://www.example-agent.com", email: "partners@example-agent.com", kontaktEmails: ["jane@example-agent.com"] },
    { id: 2, name: "Muster Steuer GmbH", website: null, email: "info@muster-steuer.de", kontaktEmails: [] },
    { id: 3, name: "Gmail Nutzer", website: null, email: "irgendwer@gmail.com", kontaktEmails: [] },
  ];
  const t1 = firmenTreffer({ name: "", kontaktEmails: ["kim@example-agent.com"] }, bestand);
  ok("Treffer über Domain der Kontakt-Mail", t1[0]?.id === 1 && /Domain/.test(t1[0].grund), JSON.stringify(t1));
  const t2 = firmenTreffer({ name: "Muster Steuer", email: "" }, bestand);
  ok("Treffer über gleichen Namenskern", t2[0]?.id === 2 && t2[0].grund === "gleicher Name", JSON.stringify(t2));
  const t3 = firmenTreffer({ name: "Ganz Anders AG", email: "neu@gmail.com", kontaktEmails: [] }, bestand);
  ok("Freemail-Domain allein ist kein Treffer", t3.length === 0, JSON.stringify(t3));
  const t4 = firmenTreffer({ email: "jane@example-agent.com" }, bestand);
  ok("Gleiche E-Mail schlägt Domain (100 Punkte)", t4[0]?.punkte === 100);
}

// ── 4. KI-Antwort bereinigen ───────────────────────────────────────────────
abschnitt("4 · „Aus E-Mail übernehmen“ — KI-Antwort bereinigen");
{
  ok("JSON aus ```json-Block gelesen", !!jsonAusText(KI_ANTWORT)?.firma);
  const v = kiVorschlagBereinigen(KI_ANTWORT, ROT ? `${MAIL}\njane@example-agent.com 208-555-0199` : MAIL);
  ok("Firmenname übernommen", v.firma.name === "Example Registered Agent LLC");
  ok("Art „Dienstleister“ → lieferant", v.firma.art === "lieferant");
  ok("Land „USA“ → US", v.firma.landCode === "US");
  ok("Erfundenes Firmentelefon (steht nicht im Text) verworfen", v.firma.telefon === "", v.firma.telefon);
  ok("Website steht im Text → bleibt", v.firma.website === "https://www.example-agent.com");
  const jane = v.kontakte.find((k) => k.name === "Jane Example");
  ok("Kontakt Jane übernommen", !!jane);
  ok("Erfundene Mail jane@… (steht nicht im Text) verworfen", jane?.email === "", jane?.email);
  ok("Telefon mit „ext. 2040“ → Durchwahl getrennt", jane?.telefon === "208-555-0140" && jane?.durchwahl === "2040", `${jane?.telefon} / ${jane?.durchwahl}`);
  ok("Erreichbarkeit übernommen", /8:30/.test(jane?.erreichbarkeit ?? ""));
  ok("FIAON selbst ist nie Kontakt (Justin fällt weg)", !v.kontakte.some((k) => /schwarzott/i.test(k.name)));
  ok("Verworfenes wird benannt (nichts verschwindet still)", v.verworfen.length >= 2, v.verworfen.join(" | "));
  ok("Verlauf mit Datum", v.verlauf?.am === "2026-10-22" && v.verlauf.typ === "email");
  ok("Aufgabe übernommen", v.aufgabe?.titel === "Portal-Passwort setzen" && v.aufgabe.faelligAm === "2026-10-23");
  const leer = kiVorschlagBereinigen("kein json", MAIL);
  ok("Kaputte KI-Antwort → leerer Vorschlag, kein Absturz", leer.kontakte.length === 0 && leer.firma.name === "");
  const fiaon = kiVorschlagBereinigen({ firma: { name: "FIAON LTD" } }, MAIL);
  ok("FIAON als Firma wird verworfen", fiaon.firma.name === "" && fiaon.verworfen.some((x) => /FIAON/.test(x)));
}

// ── 5. Regeln ohne KI ──────────────────────────────────────────────────────
abschnitt("5 · Auswertung ohne KI (Rückweg)");
{
  const r = regelVorschlag(MAIL);
  ok("Regeln: Firmenname mit LLC", r.firma.name === "Example Registered Agent LLC", r.firma.name);
  ok("Regeln: Website", r.firma.website === "https://www.example-agent.com", r.firma.website);
  ok("Regeln: Firmen-Mail partners@", r.firma.email === "partners@example-agent.com", r.firma.email);
  ok("Regeln: US-Adresse Boise ID 83702", r.firma.ort === "Boise" && r.firma.region === "ID" && r.firma.plz === "83702" && r.firma.landCode === "US", JSON.stringify(r.firma));
  ok("Regeln: Hausnummer 100, Suite N", r.firma.hausnummer === "100" && /Suite N/.test(r.firma.adresszusatz), `${r.firma.hausnummer} / ${r.firma.adresszusatz}`);
  const jane = r.kontakte.find((k) => k.name === "Jane Example");
  ok("Regeln: Kontakt aus Signatur", !!jane, JSON.stringify(r.kontakte));
  ok("Regeln: Rolle Account Manager", jane?.rolle === "Account Manager", jane?.rolle);
  ok("Regeln: Telefon + Durchwahl", jane?.telefon === "208-555-0140" && jane?.durchwahl === "2040", `${jane?.telefon} / ${jane?.durchwahl}`);
  ok("Regeln: FIAON-Nummer nicht übernommen", !JSON.stringify(r).includes("244 93 01"));
  ok("Regeln: js@fiaon.com nicht übernommen", !JSON.stringify(r).includes("js@fiaon.com"));
  const dach = regelVorschlag("Mit freundlichen Grüßen\nAnna Muster\nGeschäftsführerin\nMuster Steuer GmbH\nHauptstraße 12\n10115 Berlin\nTel. +49 30 1234567\nanna@muster-steuer.de");
  ok("Regeln: DACH-Adresse", dach.firma.strasse === "Hauptstraße" && dach.firma.hausnummer === "12" && dach.firma.plz === "10115" && dach.firma.ort === "Berlin" && dach.firma.landCode === "DE", JSON.stringify(dach.firma));
  ok("Regeln: Art aus Rolle (Geschäftsführerin einer Steuer GmbH → kanzlei)", dach.firma.art === "kanzlei", dach.firma.art);
  const bitte = regelVorschlag("Hallo,\nbitte senden Sie uns die Vollmacht bis Freitag zurück. Danke!\n\nAnna Muster\nSteuerberaterin\nMuster Steuer GmbH");
  ok("Regeln: „Bitte …“-Satz wird Aufgabenvorschlag", bitte.aufgabe?.titel === "bitte senden Sie uns die Vollmacht bis Freitag zurück", JSON.stringify(bitte.aufgabe));
  ok("Regeln: Verlaufstitel nennt den Absender", bitte.verlauf?.titel === "E-Mail von Anna Muster", bitte.verlauf?.titel);
  ok("Regeln: Kontakt Anna Muster mit Mail", dach.kontakte[0]?.name === "Anna Muster" && dach.kontakte[0]?.email === "anna@muster-steuer.de", JSON.stringify(dach.kontakte));
  ok("Telefon+Durchwahl „(509) 555-0140 x12“", (() => { const t = telefonUndDurchwahl("(509) 555-0140 x12"); return t.telefon === "(509) 555-0140" && t.durchwahl === "12"; })());
  const e = vorschlagErgaenzen(kiVorschlagBereinigen({ firma: { name: "Example Registered Agent LLC" }, kontakte: [{ name: "Jane Example" }] }, MAIL), r);
  ok("Ergänzen: KI ohne Adresse bekommt sie aus den Regeln", e.firma.ort === "Boise" && e.kontakte[0].durchwahl === "2040");
}

// ── 6. Adressvorschläge ────────────────────────────────────────────────────
abschnitt("6 · Adressvorschläge (Photon-Antwort lesen)");
{
  const FIXTURE = { type: "FeatureCollection", features: [
    { type: "Feature", properties: { osm_key: "building", name: "Example Tower", street: "West Main Street", housenumber: "100", postcode: "83702", city: "Boise", state: "Idaho", country: "United States", countrycode: "US" } },
    { type: "Feature", properties: { osm_key: "highway", osm_value: "residential", name: "Hauptstraße", postcode: "10115", city: "Berlin", state: "Berlin", country: "Deutschland", countrycode: "DE", type: "street" } },
    { type: "Feature", properties: { osm_key: "place", name: "Nirgendwo", country: "Deutschland", countrycode: "DE" } },
    { type: "Feature", properties: { osm_key: "highway", name: "Hauptstraße", postcode: "10115", city: "Berlin", state: "Berlin", country: "Deutschland", countrycode: "DE", type: "street" } },
  ] };
  const v = photonZuVorschlaegen(FIXTURE);
  ok("Ohne Ort fällt weg, Doppeltes auch → 2 Vorschläge", v.length === 2, JSON.stringify(v.map((x) => x.zeile)));
  ok("Gebäude: Straße + Nummer + PLZ + Ort + Land", v[0]?.strasse === "West Main Street" && v[0]?.hausnummer === "100" && v[0]?.plz === "83702" && v[0]?.ort === "Boise" && v[0]?.landCode === "US");
  ok("Anzeigezeile nennt den Namen des Gebäudes", /^Example Tower, West Main Street 100, 83702 Boise/.test(v[0]?.zeile ?? ""), v[0]?.zeile);
  ok("Straße ohne Nummer: Name als Straße", v[1]?.strasse === "Hauptstraße" && v[1]?.hausnummer === "");
  ok("Kaputte Antwort → leere Liste", photonZuVorschlaegen({ quatsch: 1 }).length === 0 && photonZuVorschlaegen(null).length === 0);
  ok("Anfrage erst ab 4 Zeichen mit Buchstaben", !adressAnfrageSinnvoll("12") && !adressAnfrageSinnvoll("1234") && adressAnfrageSinnvoll("522 W Riv"));
}

// ── 7. „Was steht an?“ ohne KI ─────────────────────────────────────────────
abschnitt("7 · Hinweise ohne KI");
{
  const h = partnerHinweise({
    heute: "2026-10-22", status: "aktiv", art: "lieferant", konditionen: [],
    kontakte: [{ name: "Jane Example", email: "", telefon: "", haupt: false }],
    aufgaben: [{ titel: "Portal-Passwort setzen", faelligAm: "2026-10-20", erledigt: false }, { titel: "Testauftrag", faelligAm: "2026-10-22", erledigt: false }, { titel: "alt", faelligAm: "2026-01-01", erledigt: true }],
    verlauf: [{ am: "2026-09-01", typ: "anruf", titel: "Call" }],
    dokumente: [{ titel: "Rahmenvertrag", art: "vertrag", gueltigBis: "2026-11-01" }],
  });
  const t = h.map((x) => x.text).join(" | ");
  ok("Überfällige Aufgabe rot, mit Tagen", h.some((x) => x.art === "rot" && /überfällig/.test(x.text) && /2 Tagen/.test(x.text)), t);
  ok("Erledigte Aufgabe zählt nicht", !/„alt“/.test(t));
  ok("Heute fällig genannt", /Heute fällig: „Testauftrag“/.test(t));
  const n = partnerHinweise({ heute: "2026-10-22", status: "aktiv", art: "sonstige", konditionen: [], kontakte: [], aufgaben: [{ titel: "Später", faelligAm: "2026-10-30", erledigt: false }, { titel: "Bald", faelligAm: "2026-10-23", erledigt: false }], verlauf: [], dokumente: [] });
  ok("Als Nächstes: die früheste künftige Aufgabe", n.some((x) => x.text === "Als Nächstes: „Bald“ — morgen fällig."), JSON.stringify(n));
  ok("Vertrag läuft in 10 Tagen aus → rot", h.some((x) => x.art === "rot" && /in 10 Tagen aus/.test(x.text)), t);
  ok("Letzter Kontakt vor 51 Tagen", /vor 51 Tagen/.test(t), t);
  ok("Kein Hauptkontakt", /Kein Hauptkontakt/.test(t));
  ok("Kontakt ohne Mail und Telefon", /weder E-Mail noch Telefon/.test(t));
  ok("Lieferant ohne Konditionen", /Keine Konditionen/.test(t));
  const ruhig = partnerHinweise({ heute: "2026-10-22", status: "beendet", art: "sonstige", konditionen: [], kontakte: [{ name: "A", email: "a@b.de", telefon: "", haupt: true }], aufgaben: [], verlauf: [], dokumente: [] });
  ok("Beendeter Partner: keine Aufforderung zum nächsten Schritt", !ruhig.some((x) => /nächsten Schritt|Letzter Kontakt|Noch kein Eintrag/.test(x.text)), JSON.stringify(ruhig));
  const lt = lageText({ heute: "2026-10-22", name: "Example LLC", status: "aktiv", art: "lieferant", konditionen: [], kontakte: [], aufgaben: [{ titel: "A", faelligAm: null, erledigt: false }], verlauf: [], dokumente: [] });
  ok("KI-Lagetext enthält Partner und Aufgabe", /Example LLC/.test(lt) && /Offene Aufgaben: A/.test(lt));
}

console.log(`\n${gut} ok, ${schlecht} rot${ROT ? " (Rot-Probe: rot ist hier erwartet)" : ""}`);
if (ROT) {
  // Rot-Probe: Die eingebauten Schäden MÜSSEN Prüfungen rot machen.
  if (schlecht === 0) { console.log("ROT-PROBE GESCHEITERT: kein Schaden wurde erkannt."); process.exit(1); }
  console.log("ROT-PROBE bestanden: die Schäden wurden erkannt.");
  process.exit(0);
}
process.exit(schlecht ? 1 : 0);
