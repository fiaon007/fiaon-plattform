// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ZWEI SPÄTEREN RECHNUNGEN DES KAPITAL-ANGEBOTS (Register E-401, 19.10.2026)
//
// ── TEIL 1 — OHNE DATENBANK (immer) ───────────────────────────────────────
//   kapitalMitGebuehren (Fassung A nein, B ja), kapitalGebuehrPruefen (nicht angenommen, Fassung A, Betrag 0, Bürgschaft vor
//   Zahlung von Teil 1, Datum in der Zukunft / vor der Annahme, schon berechnet, gut), kapitalRechnungsText je Teil.
//
// ── TEIL 2 — MIT --lokal (Prüfstand-DB auf 127.0.0.1 + laufender lokaler Server mit demselben SESSION_SECRET) ──
//   Musterfirma anlegen → Annahme über die echte Route → Teil 1 mit Rechnung → „Bürgschaft zugesagt“ vor Zahlung 409 →
//   Teil 1 bezahlt (nur in der Prüfstand-Kopie) → „Bürgschaft zugesagt“ → Teil 2 mit Rechnungsnummer über 499 €, Reverse
//   Charge → zweiter Klick legt nichts an → „Finanzierung ausgezahlt“ → Teil 3 über 1.099 € (Prüfregel der Teile alt → getauscht)
//   → Rechnungstext, Zahlungsseite, Verlauf, Aufgaben, Mail an Justin (protokolliert, ohne Schlüssel nicht versandt), KEINE
//   Mail an die Kundin → Liste der Leitung (art „kapital“, drei Teile, Knöpfe) → Meilenstein-Route des Individualangebots 409.
//   E-407: „Mein Auftrag“ (angebotSichtZurAkte + echte Kunden-Route) nach der Annahme, nach „Bürgschaft zugesagt“ und nach
//   „Finanzierung ausgezahlt“ — drei Teile mit Titel, Betrag, Stand, Rechnung, ruhigem Satz und der Garantie aus Ziffer 4.
//   E-411: ZAHLUNG über die echte Route POST /api/fiaon/admin/payments/<Zweck>/mark-paid (nur in der Prüfstand-Kopie) —
//   Teil 1 bezahlt → frist_beginn/frist_ende nach Ziffer 4, Aufgabe an Justin mit Ziffer 2/7 und „Garantie läuft bis …“, Akte
//   „gestartet“, kein Individual-Text; zweiter Lauf legt nichts doppelt an. Teil 2/3 bezahlt → nur Vermerk, Frist unverändert.
//   Stundenlauf des Individualangebots warnt Kapital nicht (auch bei abgelaufener Frist), „Mein Auftrag“ liest eine verlängerte
//   Frist aus der Datenbank.
//   E-412: KEIN automatisches Startgespräch für Kapital (Annahme, Buchen direkt, Stundenlauf). Eigener Kapital-Fristlauf aus
//   globalAngebotLauf: 14/3 Tage vor frist_ende und am Tag nach dem Fristende je EINE Aufgabe an Justin (Marken, zweiter Lauf
//   legt nichts an), nichts bei erfüllter Garantie oder eingetragenem Teil 3; kein Geld, keine Kundenmail.
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require' \
//     SESSION_SECRET=<wie der Server> PRUEF_BASIS=http://127.0.0.1:5401 npx tsx scripts/pruef-kapital-rechnungen.ts --lokal
// ═══════════════════════════════════════════════════════════════════════════
import type { KapitalAuftragTeilEin } from "../shared/fiaon-global-angebot-kapital";
const LOKAL = process.argv.includes("--lokal");
if (!LOKAL) process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
else {
  let host = "";
  try { host = new URL(String(process.env.DATABASE_URL)).hostname; } catch { /* unten */ }
  if (!["127.0.0.1", "localhost"].includes(host)) { console.error("ABBRUCH: --lokal läuft nur gegen eine Datenbank auf 127.0.0.1/localhost."); process.exit(2); }
  if (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt — bitte mit env -i starten."); process.exit(2); }
}

let gut = 0; const fehler: string[] = [];
const ok = (b: unknown, was: string, zeige?: unknown) => { if (b) { gut++; console.log(`  ok    ${was}`); } else { fehler.push(was); console.log(`  FEHLT ${was}${zeige !== undefined ? ` — ${JSON.stringify(zeige).slice(0, 400)}` : ""}`); } };
const titel = (t: string) => console.log(`\n${t}`);

const S = await import("../shared/fiaon-global-angebot-kapital");

// ═══ TEIL 1 ════════════════════════════════════════════════════════════════
titel("1. Regeln ohne Datenbank");
ok(!S.kapitalMitGebuehren("IA-KAPITAL-2026-10-19-A") && S.kapitalMitGebuehren("IA-KAPITAL-2026-10-19-B") && !S.kapitalMitGebuehren("IA-FIRMA-2026-10-07-D"), "Gebühren nur ab Fassung B, nur Kapital-Angebote");
const PAR = { buergschaftCents: 49_900, auszahlungCents: 109_900 };
const lage = { status: "angenommen", fassung: S.KAPITAL_FASSUNG, parameter: PAR, angenommenAm: "2026-10-10", heute: "2026-10-19", teil1Bezahlt: true, vorhanden: null };
const pr = (l: Partial<typeof lage> & Record<string, unknown>, art: "buergschaft" | "auszahlung", ein: unknown) => S.kapitalGebuehrPruefen({ ...lage, ...l } as any, art, ein);
ok(!pr({ status: "offen" }, "buergschaft", { datum: "2026-10-19" }).ok, "nicht angenommen → nein");
ok(/vereinbart keine/.test(String((pr({ fassung: "IA-KAPITAL-2026-10-19-A" }, "buergschaft", { datum: "2026-10-19" }) as any).error)), "Fassung A → keine Bürgschaftsgebühr");
ok(/kein Betrag/.test(String((pr({ parameter: { ...PAR, auszahlungCents: 0 } }, "auszahlung", { datum: "2026-10-19" }) as any).error)), "Betrag 0 → nein");
ok(/Ziffer 5/.test(String((pr({ teil1Bezahlt: false }, "buergschaft", { datum: "2026-10-19" }) as any).error)), "Bürgschaft vor Zahlung von Teil 1 → nein (Ziffer 5)");
ok(pr({ teil1Bezahlt: false }, "auszahlung", { datum: "2026-10-19" }).ok, "Auszahlung hängt nicht an Teil 1 (Ziffer 6 Absatz 3)");
ok(/Zukunft/.test(String((pr({}, "auszahlung", { datum: "2026-10-20" }) as any).error)), "Datum in der Zukunft → nein");
ok(/vor der Annahme/.test(String((pr({}, "auszahlung", { datum: "2026-10-09" }) as any).error)), "Datum vor der Annahme → nein");
ok(/Datum fehlt/.test(String((pr({}, "auszahlung", { datum: "19.10.2026" }) as any).error)), "Datum nicht ISO → nein");
const schon = pr({ vorhanden: { rechnungSteht: true } } as any, "buergschaft", { datum: "2026-10-19" }) as any;
ok(!schon.ok && schon.schon === true, "Rechnung steht schon → schon (nichts Neues)");
const gutB = pr({}, "buergschaft", { datum: "2026-10-19", beleg: "  Institut   X  " }) as any;
ok(gutB.ok && gutB.daten.betragCents === 49_900 && gutB.daten.beleg === "Institut X", "gut: Betrag aus dem Vertrag, Beleg geglättet", gutB);
const tx2 = S.kapitalRechnungsText({ angebotRef: "FIAON-IA-CTEST", nr: 2, auftragRef: "FIAON-X", ereignisAm: "2026-10-19" });
const tx3 = S.kapitalRechnungsText({ angebotRef: "FIAON-IA-CTEST", nr: 3, auftragRef: "FIAON-X", ereignisAm: "2026-10-19" });
const tx1 = S.kapitalRechnungsText({ angebotRef: "FIAON-IA-CTEST", nr: 1, auftragRef: "FIAON-X" });
ok(/Bürgschaftsgebühr \(Ziffer 6 Absatz 2\).*19\.10\.2026/.test(tx2.beschreibung) && /Auszahlung der Finanzierung \(Ziffer 6 Absatz 3\).*19\.10\.2026/.test(tx3.beschreibung) && /Ziffer 6 Absatz 1/.test(tx1.beschreibung) && !/von 2/.test(tx1.beschreibung), "Rechnungstexte je Teil (kein „Teil 1 von 2“ mehr)", [tx1, tx2, tx3]);

// E-407: „Mein Auftrag“ — rein. Kein „bis zu“, kein Bank-Vorbehalt, kein Individual-Satz (Kreditrahmen/Karten, Eintragung).
titel("1b. „Mein Auftrag“ ohne Datenbank (E-407)");
const VERBOTEN = /bis zu\b|entscheidet|Vorbehalt|Kreditrahmen|ersten Karte|Eintragung der Gesellschaft|Teil 2 wird erst/i;
const sauber = (m: unknown) => !VERBOTEN.test(JSON.stringify(m));
const P = { preisCents: 279_900, jahresCents: 69_900, buergschaftCents: 49_900, auszahlungCents: 109_900, garantieWochen: 8, kapitalChf: 50_000 };
const T1 = (x: Partial<KapitalAuftragTeilEin> = {}): KapitalAuftragTeilEin => ({ nr: 1, titel: S.KAPITAL_TEIL_TITEL, betragCents: 279_900, stand: "offen", rechnungsnummer: "R-1", bestellRef: "FIAON-1", ereignisAm: null, bezahltAm: null, ...x });
const mA = (teile: KapitalAuftragTeilEin[], x: Record<string, unknown> = {}) => S.kapitalMeinAuftrag({ fassung: S.KAPITAL_FASSUNG, parameter: P, angenommenAm: "2026-10-19", teile, garantieErfuelltAm: null, erstattungAusgeloest: false, ...x } as any);
const m0 = mA([T1()]);
ok(m0.teile.length === 3 && m0.teile.map((t) => t.nr).join() === "1,2,3" && m0.teile[0].titel === "Gründungskosten" && m0.teile[1].titel === "Bürgschaftsgebühr" && m0.teile[2].titel === "Vergütung bei Auszahlung der Finanzierung",
  "nach der Annahme: drei Teile — Gründungskosten, Bürgschaftsgebühr, Vergütung bei Auszahlung", m0.teile.map((t) => t.titel));
ok(m0.teile[1].betragCents === 49_900 && m0.teile[2].betragCents === 109_900 && m0.teile[1].stand === "noch nicht fällig" && m0.teile[2].stand === "noch nicht fällig" && !m0.teile[1].rechnungsnummer,
  "Teil 2/3: Betrag aus dem Vertrag, „noch nicht fällig“, keine Rechnung", m0.teile.slice(1));
ok(/sobald die Bürgschaft .*zugesagt ist/.test(String(m0.teile[1].hinweis)) && /mit der Auszahlung/.test(String(m0.teile[2].hinweis)) && m0.teil2Bedingung === m0.teile[1].hinweis,
  "ruhige Sätze: „sobald die Bürgschaft zugesagt ist“ / „mit der Auszahlung“", [m0.teile[1].hinweis, m0.teile[2].hinweis]);
ok(/binnen acht Wochen/.test(m0.garantieSatz) && /alles zurück/.test(m0.garantieSatz) && /Ziffer 4/.test(m0.garantieSatz) && /ab Ihrer Zahlung der Gründungskosten/.test(m0.garantieSatz) && !m0.fristEnde,
  "Garantie vor der Zahlung: acht Wochen, alles zurück, Ziffer 4, Lauf ab Zahlung", m0.garantieSatz);
ok(m0.summeCents === 279_900 && /Ziffer 4/.test(m0.garantieZiel) && /699 € je Jahr/.test(m0.jahresZeile) && /Ziffer 4/.test(m0.seiteHinweis), "Summe = nur Gründungskosten; Garantieziel, Jahresbetreuung und Hinweis", { summe: m0.summeCents, ziel: m0.garantieZiel });
const m1 = mA([T1({ stand: "bezahlt", bezahltAm: "2026-10-21" })]);
ok(m1.fristBeginn === "2026-10-21" && m1.fristEnde === "2026-12-16" && /bis zum 16\.12\.2026/.test(m1.garantieSatz) && /seit dem 21\.10\.2026/.test(m1.garantieSatz) && /ruht/.test(m1.garantieSatz),
  "Teil 1 bezahlt: acht Wochen ab Zahlung (21.10. → 16.12.2026), Ruhen bei Unterlagen genannt", m1.garantieSatz);
const mFrueh = mA([T1({ stand: "bezahlt", bezahltAm: "2026-10-18" })]);
ok(mFrueh.fristBeginn === "2026-10-19", "Zahlung vor der Annahme (Vorkasse): Frist ab Auftragserteilung", mFrueh.fristBeginn);
const m2 = mA([T1({ stand: "bezahlt", bezahltAm: "2026-10-21" }), { nr: 2, titel: "Bürgschaftsgebühr", betragCents: 49_900, stand: "offen", rechnungsnummer: "R-2", bestellRef: "FIAON-2", ereignisAm: "2026-11-02", bezahltAm: null }]);
ok(m2.teile[1].stand === "offen" && m2.teile[1].rechnungsnummer === "R-2" && /Bürgschaft zugesagt am 02\.11\.2026/.test(String(m2.teile[1].hinweis)) && m2.teile[2].stand === "noch nicht fällig" && m2.summeCents === 329_800,
  "Teil 2 entstanden: Rechnung offen, „Bürgschaft zugesagt am …“, Summe 3.298 €; Teil 3 wartet", m2.teile);
const m3 = mA([...[T1({ stand: "bezahlt", bezahltAm: "2026-10-21" })], { nr: 3, titel: "Vergütung bei Auszahlung der Finanzierung", betragCents: 109_900, stand: "offen", rechnungsnummer: "R-3", bestellRef: "FIAON-3", ereignisAm: "2026-12-01", bezahltAm: null }]);
ok(/ausgezahlt/.test(m3.garantieSatz) && /01\.12\.2026/.test(m3.garantieSatz) && /Finanzierung ausgezahlt am 01\.12\.2026/.test(String(m3.teile[2].hinweis)), "Teil 3 entstanden: „Ihre Finanzierung ist am … ausgezahlt“", m3.garantieSatz);
const mE = mA([T1({ stand: "erstattet", bezahltAm: "2026-10-21" })], { erstattungAusgeloest: true });
ok(mE.teile[2].stand === "entfallen" && /erstatten Ihnen alles/.test(mE.garantieSatz), "Garantiefall: Teil 3 entfällt, Satz „wir erstatten“", mE.garantieSatz);
const mAlt = S.kapitalMeinAuftrag({ fassung: "IA-KAPITAL-2026-10-19-A", parameter: { ...P, garantieWochen: 0 }, angenommenAm: "2026-10-19", teile: [T1()], garantieErfuelltAm: null, erstattungAusgeloest: false });
ok(mAlt.teile.length === 1 && !/acht Wochen/.test(mAlt.garantieSatz), "Fassung A: nur Teil 1, keine Garantie-Behauptung", mAlt);
ok([m0, m1, m2, m3, mE, mAlt].every(sauber), "kein „bis zu“, kein Bank-Vorbehalt, kein Individual-Satz in allen Fällen");

// E-411: die Frist nach Ziffer 4 als EINE Rechnung — Zahlungsweg und „Mein Auftrag“; die gespeicherte Frist gilt nur vom Kapital-Weg.
titel("1c. Frist nach Ziffer 4 und Texte nach der Zahlung ohne Datenbank (E-411)");
ok(S.kapitalGarantieWochen("IA-KAPITAL-2026-10-19-A", { garantieWochen: 8 }) === 0 && S.kapitalGarantieWochen(S.KAPITAL_FASSUNG, { garantieWochen: 8 }) === 8 && S.kapitalGarantieWochen(S.KAPITAL_FASSUNG, { garantieWochen: 0 }) === 0,
  "Garantie-Wochen: Fassung A immer 0 (auch mit Vorgabe 8), Fassung B aus dem Vertrag");
const gf = S.kapitalGarantieFrist;
ok(gf({ angenommenAm: "2026-10-19", bezahltAm: "2026-10-21", wochen: 8 })?.beginn === "2026-10-21" && gf({ angenommenAm: "2026-10-19", bezahltAm: "2026-10-21", wochen: 8 })?.ende === "2026-12-16"
  && gf({ angenommenAm: "2026-10-19", bezahltAm: "2026-10-18", wochen: 8 })?.beginn === "2026-10-19" && gf({ angenommenAm: "2026-10-19", bezahltAm: null, wochen: 8 }) === null && gf({ angenommenAm: "2026-10-19", bezahltAm: "2026-10-21", wochen: 0 }) === null,
  "Frist: späterer Tag von Annahme und Zahlung + 8 × 7 Tage; ohne Zahlung oder ohne Garantie keine Frist");
const mAltB = S.kapitalMeinAuftrag({ fassung: "IA-KAPITAL-2026-10-19-A", parameter: P, angenommenAm: "2026-10-19", teile: [T1({ stand: "bezahlt", bezahltAm: "2026-10-21" })], garantieErfuelltAm: null, erstattungAusgeloest: false });
ok(!mAltB.fristEnde && !/acht Wochen/.test(mAltB.garantieSatz), "Fassung A mit Vorgabe 8 Wochen: keine Frist, keine Garantie-Behauptung", mAltB.garantieSatz);
const bez = [T1({ stand: "bezahlt", bezahltAm: "2026-10-21" })];
const mDbLang = mA(bez, { gespeichert: { beginn: "2026-10-21", ende: "2026-12-23" } });
const mDbAlt = mA(bez, { gespeichert: { beginn: "2026-10-19", ende: "2027-01-11" } });
const mDbKurz = mA(bez, { gespeichert: { beginn: "2026-10-21", ende: "2026-12-01" } });
ok(mDbLang.fristEnde === "2026-12-23" && /bis zum 23\.12\.2026/.test(mDbLang.garantieSatz), "gespeichertes Fristende vom Kapital-Weg (gleicher Beginn, später = Ruhezeit) gilt", mDbLang.garantieSatz);
ok(mDbAlt.fristEnde === "2026-12-16" && mDbKurz.fristEnde === "2026-12-16", "Werte des alten Individualwegs (anderer Beginn) und ein kürzeres Ende gelten nie", [mDbAlt.fristEnde, mDbKurz.fristEnde]);
const aufOhne = S.kapitalStartAufgabe({ angebotRef: "FIAON-IA-CTEST", firma: "Musterfirma Beispiel GmbH", vertretung: "Frau Martina Muster", fassung: S.KAPITAL_FASSUNG, parameter: P, bezahltAm: "2026-10-21", zweck: "FIAON-ZWECK", frist: { beginn: "2026-10-21", ende: "2026-12-16" }, reisepassAm: null });
const aufMit = S.kapitalStartAufgabe({ angebotRef: "FIAON-IA-CTEST", firma: "Musterfirma Beispiel GmbH", vertretung: "Frau Martina Muster", fassung: S.KAPITAL_FASSUNG, parameter: P, bezahltAm: "2026-10-21", zweck: null, frist: { beginn: "2026-10-21", ende: "2026-12-16" }, reisepassAm: "2026-10-22" });
const aufA = S.kapitalStartAufgabe({ angebotRef: "FIAON-IA-CTEST", firma: "Musterfirma Beispiel GmbH", vertretung: "Frau Martina Muster", fassung: "IA-KAPITAL-2026-10-19-A", parameter: P, bezahltAm: "2026-10-21", zweck: null, frist: null, reisepassAm: null });
const INDIVIDUAL = /Individualangebot|Kreditrahmen|Widerruf|Meilenstein|Ziffer 6 Absatz 2\)|zwölf Wochen/;
ok(/Gründungskosten bezahlt/.test(aufOhne.titel) && /Teil 1/.test(aufOhne.text) && /fünf Werktagen/.test(aufOhne.text) && /Ziffer 2/.test(aufOhne.text) && /Ziffer 7/.test(aufOhne.text) && /Ausweis \(Reisepass oder Identitätskarte\) fehlt noch/.test(aufOhne.text) && /Betreibungsauszug/.test(aufOhne.text)
  && /Garantie läuft bis 16\.12\.2026/.test(aufOhne.text) && /seit dem 21\.10\.2026/.test(aufOhne.text) && /FIAON-ZWECK/.test(aufOhne.text) && !INDIVIDUAL.test(aufOhne.titel + aufOhne.text),
  "Aufgabe Teil 1 (ohne Reisepass): Ziffer 2 fünf Werktage, Ziffer 7, „Garantie läuft bis 16.12.2026“, kein Individual-Text", aufOhne);
ok(/seit dem 22\.10\.2026/.test(aufMit.text) && /einreichen bis 29\.10\.2026/.test(aufMit.text) && /Bürgschaft zugesagt/.test(aufMit.text) && /Finanzierung ausgezahlt/.test(aufMit.text),
  "Aufgabe mit Reisepass: Anmeldung bis zum fünften Werktag nach Pass-Eingang (Do 22.10. → Do 29.10.), Knöpfe für Teil 2/3", aufMit.text);
ok(/keine Garantie/.test(aufA.text) && !/Garantie läuft bis/.test(aufA.text) && !/Bürgschaft zugesagt/.test(aufA.text), "Fassung A: keine Frist, keine Knöpfe für 499/1.099", aufA.text);
const verm = S.kapitalTeilBezahltVermerk({ angebotRef: "FIAON-IA-CTEST", titel: "Bürgschaftsgebühr", betragCents: 49_900, zweck: "Z2", fristEnde: "2026-12-16", nachGarantiefall: false });
const vermG = S.kapitalTeilBezahltVermerk({ angebotRef: "FIAON-IA-CTEST", titel: "Bürgschaftsgebühr", betragCents: 49_900, zweck: "Z2", fristEnde: "2026-12-16", nachGarantiefall: true });
ok(/Bürgschaftsgebühr .* bezahlt \(499 €, Z2\)/.test(verm) && /bleibt beim 16\.12\.2026/.test(verm) && /zu erstatten/.test(vermG), "Vermerk Teil 2/3: bezahlt, Frist bleibt; nach Garantiefall „zu erstatten“", [verm, vermG]);
// E-417: Kundenfragen — Konditionen, Ausweis, Betreibungsauszug nach abgeschlossener Due Diligence
const parK = S.kapitalParameterAus({ zinsBasisBp: 180, zinsAufschlagBp: 50, zinsBasisJahre: 5, laufzeitMaxJahre: 15, kartenMax: 12, ddAbgeschlossen: true });
ok(S.kapitalMitKonditionen(parK) && S.kapitalKonditionenSatz(parK) === "Laufzeit nach Wahl der Auftraggeberin, längstens fünfzehn Jahre; effektiver Jahreszins 1,8 % bei einer Laufzeit bis fünf Jahre, für jedes weitere Laufzeitjahr 0,5 Prozentpunkte mehr",
  "E-417: Konditionen-Satz (1,8 %, +0,5 je Jahr, bis fünfzehn Jahre)", S.kapitalKonditionenSatz(parK));
ok(!S.kapitalMitKonditionen(S.kapitalParameterAus({})) && S.kapitalParameterAus({}).ddAbgeschlossen === false, "E-417: ohne Angaben keine Konditionen, Betreibungsauszug bleibt verlangt");
ok(!S.kapitalUnterlagen(parK).join(" ").includes("Betreibung") && S.kapitalUnterlagen(S.kapitalParameterAus({})).join(" ").includes("Betreibung") && /Identitätskarte/.test(S.kapitalUnterlagen(parK)[0]),
  "E-417: Ziffer 7 — Ausweis (Pass oder ID), Betreibungsauszug nur ohne abgeschlossene Due Diligence");
const aufDd = S.kapitalStartAufgabe({ angebotRef: "FIAON-IA-CTEST", firma: "Musterfirma", vertretung: "Frau Muster", fassung: S.KAPITAL_FASSUNG, parameter: { ...S.KAPITAL_VORGABEN, ddAbgeschlossen: true }, bezahltAm: "2026-10-21", zweck: null, frist: null, reisepassAm: null });
ok(/Betreibungsauszug entfällt/.test(aufDd.text), "E-417: Start-Aufgabe nennt den Verzicht auf den Betreibungsauszug", aufDd.text);

// E-412: die eigene Fristwarnung des Kapital-Angebots — welcher Schritt wann, und die Texte an Justin.
titel("1d. Fristwarnung nach Ziffer 4 ohne Datenbank (E-412)");
const sch = (fristEnde: string | null, x: Record<string, unknown> = {}) => S.kapitalFristSchritt({ fristEnde, heute: "2026-12-02", warnung14Am: null, warnung3Am: null, abgelaufenAm: null, garantieErfuelltAm: null, erstattungAusgeloestAm: null, teil3Eingetragen: false, ...x });
ok(sch("2026-12-31") === null && sch("2026-12-17") === null && sch("2026-12-16")?.schritt === "warnung14" && sch("2026-12-16")?.tageBis === 14 && sch("2026-12-10", { warnung14Am: "x" }) === null,
  "15 Tage vorher nichts, 14 Tage vorher „warnung14“, danach mit Marke nichts", [sch("2026-12-17"), sch("2026-12-16")]);
ok(sch("2026-12-05")?.schritt === "warnung3" && sch("2026-12-05", { warnung14Am: "x" })?.schritt === "warnung3" && sch("2026-12-04", { warnung3Am: "x" }) === null && sch("2026-12-02")?.schritt === "warnung3" && sch("2026-12-12", { warnung3Am: "x" }) === null,
  "3 Tage vorher „warnung3“ (auch ohne 14er), letzter Fristtag zählt noch, mit Marke nichts — auch kein 14er nach dem 3er");
ok(sch("2026-12-01")?.schritt === "abgelaufen" && sch("2026-12-01")?.tageBis === -1 && sch("2026-12-01", { abgelaufenAm: "x" }) === null, "am Tag nach dem Fristende „abgelaufen“, mit Marke nichts");
ok([sch("2026-12-01", { garantieErfuelltAm: "2026-11-20" }), sch("2026-12-05", { erstattungAusgeloestAm: "x" }), sch("2026-12-01", { teil3Eingetragen: true }), sch(null)].every((x) => x === null),
  "nichts bei erfüllter Garantie, vorgemerkter Erstattung, eingetragenem Teil 3 oder ohne Frist");
const FA = { angebotRef: "FIAON-IA-CTEST", firma: "Musterfirma Beispiel GmbH", fristBeginn: "2026-10-21", fristEnde: "2026-12-16", parameter: P };
const fa14 = S.kapitalFristAufgabe({ ...FA, schritt: "warnung14", tageBis: 14 });
const fa3 = S.kapitalFristAufgabe({ ...FA, schritt: "warnung3", tageBis: 1 });
const faE = S.kapitalFristAufgabe({ ...FA, schritt: "abgelaufen", tageBis: -1 });
ok(/Garantiefrist endet am 16\.12\.2026 \(noch 14 Tage\)/.test(fa14.titel) && /Ziffer 4/.test(fa14.text) && /binnen acht Wochen \(seit dem 21\.10\.2026\)/.test(fa14.text) && /Finanzierung ausgezahlt/.test(fa14.text) && /vierzehn Tagen nach Fristende \(bis 30\.12\.2026\)/.test(fa14.text) && !fa14.dringend,
  "Warnung 14 Tage: Fristende, acht Wochen seit Beginn, Knopf „Finanzierung ausgezahlt“, Erstattung bis 30.12.2026, nicht dringend", fa14);
ok(/\(noch 1 Tag\)/.test(fa3.titel) && fa3.dringend, "Warnung 3 Tage: dringend, Einzahl „1 Tag“", fa3.titel);
ok(faE.titel.startsWith("Frist abgelaufen — Garantie Ziffer 4 prüfen") && /endete am 16\.12\.2026/.test(faE.text) && /binnen vierzehn Tagen nach Fristende, also bis 30\.12\.2026/.test(faE.text) && /KEIN Geld/.test(faE.text) && /keine Mail an den Kunden/.test(faE.text) && faE.dringend,
  "Fristende: „Frist abgelaufen — Garantie Ziffer 4 prüfen“, Erstattung bis 30.12.2026, kein Geld, keine Kundenmail", faE);
ok([fa14, fa3, faE].every((a) => !INDIVIDUAL.test(a.titel + a.text) && !/Garantiefall: Erstattung vormerken|Garantie erfüllt“/.test(a.text)), "kein Individual-Text, keine Knöpfe, die für Kapital gesperrt sind");

// ═══ TEIL 2 ════════════════════════════════════════════════════════════════
if (LOKAL) {
  const BASIS = String(process.env.PRUEF_BASIS || "http://127.0.0.1:5401");
  process.env.PORT = process.env.PORT || new URL(BASIS).port;
  const { sqlPool } = await import("../server/lib/db-pool");
  const C = await import("../server/lib/fiaon-global-angebot-kapital");
  const A = await import("../server/lib/fiaon-global-angebot");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const { createHmac } = await import("node:crypto");
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
  const IP = `84.115.${10 + Math.floor(Math.random() * 200)}.${10 + Math.floor(Math.random() * 200)}`;
  const heute = berlinToday();
  const lauf = Date.now().toString(36);
  const chef = (stufe = "leitung") => { const agentId = 999_001; const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret").update(`chefzugang:${agentId}:${stufe}:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=${agentId}.${stufe}.${exp}.${sig}`; };
  const post = async (pfad: string, body: unknown, kopf: Record<string, string> = {}) => {
    const r = await fetch(`${BASIS}${pfad}`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, ...kopf }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) as any };
  };

  const warte = async (f: () => Promise<boolean>, ms = 20_000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; };
  const tagDe = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "—");
  const plus = (iso: string, n: number) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const fristDb = async (aid: number) => ((await sqlPool`SELECT frist_beginn::text AS beginn, frist_ende::text AS ende, frist_hemmung_tage AS ruht FROM fiaon_global_angebote WHERE id = ${aid}`) as any[])[0] as { beginn: string | null; ende: string | null; ruht: number };
  // Buchungen sind der Geschäftsführung vorbehalten (NUR_GESCHAEFTSFUEHRUNG: /admin/payments).
  const bezahlen = (zweck: string) => post(`/api/fiaon/admin/payments/${encodeURIComponent(zweck)}/mark-paid`, {}, { cookie: chef("inhaber") });

  titel("2. Kapital-Angebot anlegen (Musterfirma, keine Kundendaten) und annehmen");
  const email = `pruef+${lauf}@musterfirma-beispiel.example`;
  const befund = (id: string) => ({ id, aussage: `Prüfaussage ${id}.`, quelle_name: "Prüfquelle", quelle_url: "https://example.org/quelle", stand: "19.10.2026", art: "primär", pruefung: "bestätigt" });
  const compliance = {
    absender: "FIAON LTD",
    meta: { firma: "Musterfirma Beispiel GmbH", kurz: "Musterfirma", anlass: "Prüfung vor einem Mandat", pruefdatum: "19.10.2026", datenstand: "Abrufe am 19.10.2026", kopf: [["Firmenwortlaut", "Musterfirma Beispiel GmbH"]] },
    gesamt: { ampel: "GELB", titel: "Zusammenarbeit möglich.", text: ["Ein echter Betrieb."], zusatz: [], kernzahlen: [], auflagen: [] },
    bereiche: [1, 2, 3, 4, 5, 6, 7].map((nr) => ({ nr, titel: `Bereich ${nr}`, ampel: "GELB", kurz: `Kurz ${nr}.`, urteil: [`Urteil ${nr}.`], befunde: [befund(`B${nr}`)], nicht_geprueft: [], chancen: [], risiken: [] })),
    chancen: [], schwaechen: [], methodik: ["Öffentliche Quellen."], fuss: "FIAON LTD · Prüfbericht",
  };
  const an = await C.kapitalAnlegen({
    kunde: { art: "firma", firma: { name: "Musterfirma Beispiel GmbH", marke: "BEISPIEL", rechtsform: "GmbH", registergericht: "Landesgericht Musterstadt", registernummer: "FN 999999z", uid: "ATU12345675", strasse: "Musterweg 7", plz: "1010", ort: "Musterstadt", land: "AT" },
      vertretung: { anrede: "Frau", vorname: "Martina", nachname: "Muster", funktion: "Geschäftsführerin" }, email, telefon: "" },
    buergin: { name: "Prüfstand Bürgin LLC", bundesstaat: "Florida", anschrift: "1 Test Street, Miami, FL", registernummer: "L00000000", vertreter: "Test Vertreter", funktion: "Manager" },
    parameter: {}, compliance,
  }, "Prüfstand");
  ok(an.ok, "angelegt (Fassung B, Gebühren aus den Vorgaben)", an);
  if (!an.ok) throw new Error("Anlegen gescheitert");
  const id = an.id; const token = decodeURIComponent(an.link.split("/").pop()!);
  const sicht = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}`, { headers: { "user-agent": UA, "x-forwarded-for": IP } }).then((r) => r.json()) as any;
  ok(sicht.art === "kapital" && sicht.annahmeBereit === true, "Kundensicht: Kapital-Angebot, annahmebereit", { art: sicht.art, bereit: sicht.annahmeBereit, grund: sicht.gesperrtGrund });
  const ann = await post(`/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, { llc: { wunsch: `Pruefstand Atlas ${lauf}` }, vertretung: true, gelesen: true, unterschrift: { art: "getippt", name: "Martina Muster" }, textHash: sicht.textHash }, { "x-forwarded-for": IP });
  ok(ann.status === 200 && ann.body.ok, "Annahme über die echte Route", ann);
  const z1 = (await A.angebotLesen({ id }))!;
  const t1 = (z1.teile as any[]).find((t) => Number(t.nr) === 1);
  const [b1] = (await sqlPool`SELECT ref, amount_due, invoice_number, payment_status, payment_reference, rechnung_ust_modus, pack_key FROM fiaon_applications WHERE ref = ${String(t1?.bestell_ref)}`) as any[];
  ok(z1.status === "angenommen" && z1.fassung === S.KAPITAL_FASSUNG && b1 && Number(b1.amount_due) === 2799 && b1.invoice_number && b1.rechnung_ust_modus === "reverse_charge" && b1.pack_key === "global_individuell",
    "Teil 1: Rechnung über 2.799 € mit Nummer, Reverse Charge, global_individuell", b1);
  // Gezählt wird, was rausginge — „uebersprungen“ heißt: die Firmen-Sperre (E-301) hat die Mail abgefangen.
  const [mailsVorher] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE lower(empfaenger) = ${email.toLowerCase()} AND status <> 'uebersprungen'`) as any[];

  // E-407: „Mein Auftrag“ über die echte Kunden-Route (signierter Zugang wie im Link der Annahme-Antwort).
  const { globalTokenErzeugen } = await import("../server/lib/fiaon-global-auftrag");
  const auftragRef = String(z1.auftrag_ref);
  const meinAuftrag = async () => {
    const r = await fetch(`${BASIS}/api/fiaon/global/mein-auftrag/${encodeURIComponent(auftragRef)}?t=${encodeURIComponent(globalTokenErzeugen(auftragRef))}`, { headers: { "user-agent": UA } });
    return { status: r.status, body: await r.json().catch(() => ({})) as any };
  };
  titel("2b. „Mein Auftrag“ nach der Annahme (E-407)");
  const ma0 = await meinAuftrag();
  const ag0 = ma0.body?.auftrag?.angebot;
  ok(ma0.status === 200 && ag0?.art === "kapital" && ag0.teile.length === 3 && ag0.teile[0].titel === "Gründungskosten" && ag0.teile[0].betragCents === 279_900 && ag0.teile[0].stand === "offen" && ag0.teile[0].rechnungUrl,
    "Kunden-Route: Kapital-Block, Teil 1 Gründungskosten 2.799 € mit Rechnung", ag0 ?? ma0);
  ok(ag0?.teile[1].stand === "noch nicht fällig" && /sobald die Bürgschaft/.test(String(ag0?.teile[1].hinweis)) && ag0?.teile[2].stand === "noch nicht fällig" && /mit der Auszahlung/.test(String(ag0?.teile[2].hinweis)) && !ag0?.teile[1].rechnungUrl,
    "Teil 2/3: noch nicht fällig, ruhiger Satz, keine Rechnung", ag0?.teile?.slice(1));
  ok(/binnen acht Wochen/.test(String(ag0?.garantieSatz)) && ag0?.summeCents === 279_900 && sauber(ag0) && ma0.body.auftrag.paketName === S.KAPITAL_MARKE && !("bestellRef" in (ag0?.teile[0] ?? {})),
    "Garantie Ziffer 4, Summe 2.799 €, Name „Kapital für Ihr Unternehmen“, keine Bestell-Kennung beim Kunden, keine verbotenen Sätze", { satz: ag0?.garantieSatz, name: ma0.body?.auftrag?.paketName });
  const weg = (ma0.body?.auftrag?.etappen ?? []) as { nr: number; titel: string; text: string }[];
  ok(weg.find((e) => e.nr === 4)?.titel === "Ihre Finanzierung" && /Ziffer 4 und 5/.test(String(weg.find((e) => e.nr === 4)?.text)) && sauber(weg) && !/Ziffer 3 Ihres Vertrags/.test(JSON.stringify(weg)),
    "„Ihr Weg“ erzählt den Kapital-Vertrag (Etappe 4 „Ihre Finanzierung“, kein Kreditrahmen, keine falsche Ziffer 3)", weg.map((e) => e.titel));

  // E-412: Kapital hat kein automatisches Startgespräch — weder bei der Annahme noch direkt noch im Stundenlauf.
  titel("2d. Kein automatisches Startgespräch (E-412)");
  const sgStand = async () => ((await sqlPool`SELECT startgespraech_termin_id, startgespraech_versuch_am, startgespraech_fehler FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0];
  const sgAufgabe = async () => ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${auftragRef}:startgespraech`}`) as any[])[0].n as number;
  const sg0 = await sgStand();
  ok(!sg0.startgespraech_termin_id && !sg0.startgespraech_versuch_am, "nach der Annahme: kein Termin, kein Buchungsversuch", sg0);
  const SG = await import("../server/lib/fiaon-global-angebot-startgespraech");
  const sgDirekt = await SG.angebotStartgespraechBuchen(id);
  ok(sgDirekt.status === "nicht_bereit" && /Kapital/.test(String((sgDirekt as any).grund)), "Buchen direkt: „nicht_bereit — Kapital-Angebot“", sgDirekt);
  await A.globalAngebotLauf();
  const sg1 = await sgStand();
  ok(!sg1.startgespraech_termin_id && !sg1.startgespraech_versuch_am && (await sgAufgabe()) === 0, "Stundenlauf (Annahme < drei Tage): kein Termin, kein Versuch, keine Aufgabe „Startgespräch“", sg1);

  titel("3. „Bürgschaft zugesagt“");
  const rVor = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/buergschaft`, { datum: heute }, { cookie: chef() });
  ok(rVor.status === 409 && /Ziffer 5/.test(String(rVor.body.error)), "vor der Zahlung von Teil 1 → 409 (Bedingung der Bürgschaft)", rVor);
  const rOhne = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/buergschaft`, { datum: heute });
  ok(rOhne.status === 401 || rOhne.status === 403, "ohne Chef-Ausweis → gesperrt", rOhne.status);
  const rArt = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/irgendwas`, { datum: heute }, { cookie: chef() });
  ok(rArt.status === 404, "unbekannte Rechnung → 404", rArt);
  // E-411: Teil 1 über die echte Buchungsroute bezahlen (nur in der Prüfstand-Kopie; in der Produktion bucht die Zahlungsstelle).
  titel("2c. Teil 1 bezahlt (mark-paid) → Kapital-Zahlungsweg (E-411)");
  const fVor = await fristDb(id);
  ok(!fVor.beginn && !fVor.ende, "vor der Zahlung: keine Frist in der Datenbank", fVor);
  const pay1 = await bezahlen(String(b1.payment_reference));
  ok(pay1.status === 200 && pay1.body.ok, "mark-paid Teil 1 → 200", pay1);
  const gestartet = await warte(async () => ((await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${auftragRef}`) as any[])[0]?.status === "gestartet");
  const f1 = await fristDb(id);
  const ende1 = plus(heute, 56);
  ok(gestartet, "Akte „gestartet“ (Unternehmen: keine Widerrufsfrist)");
  ok(f1.beginn === heute && f1.ende === ende1 && Number(f1.ruht) === 0, `Frist nach Ziffer 4: ${tagDe(heute)} bis ${tagDe(ende1)} (8 × 7 Tage ab Zahlung = Annahme)`, f1);
  const start = (await sqlPool`SELECT titel, text, link FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${auftragRef}:start`}`) as any[];
  ok(start.length === 1 && /Gründungskosten bezahlt/.test(start[0].titel) && /fünf Werktagen/.test(start[0].text) && /Ziffer 2/.test(start[0].text) && /Ziffer 7/.test(start[0].text)
    && start[0].text.includes(`Garantie läuft bis ${tagDe(ende1)}`) && !INDIVIDUAL.test(start[0].titel + start[0].text),
    "Aufgabe an Justin: Kapital-Text (Ziffer 2, fünf Werktage, Ziffer 7, „Garantie läuft bis …“), kein Individual-Text", start[0]);
  const ze1 = (await A.angebotLesen({ id }))!;
  ok(/Gründungskosten bezahlt .* Garantie \(Ziffer 4\) bis/.test(JSON.stringify(ze1.verlauf)) && !/gestartet — Frist bis/.test(JSON.stringify(ze1.verlauf)), "Verlauf am Angebot: Kapital-Vermerk statt „gestartet — Frist bis“ des Individualwegs");
  // Wiederholbar: ein zweiter Lauf (Kontoabgleich, Nachbuchung) setzt nichts neu und legt keine zweite Aufgabe an.
  const nochmal = await A.angebotNachZahlung(String(b1.ref));
  const f1b = await fristDb(id);
  const start2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${auftragRef}:start%`}`) as any[];
  ok(!nochmal.gestartet && /schon gestartet/.test(String(nochmal.grund)) && f1b.beginn === f1.beginn && f1b.ende === f1.ende && start2[0].n === 1, "zweiter Lauf: „schon gestartet“, Frist unverändert, eine Aufgabe", { nochmal, f1b });

  // E-412: der eigene Kapital-Fristlauf über den echten Stundenlauf (Fristende nur in der Prüfstand-Kopie verschoben).
  titel("2e. Kapital-Fristlauf: 14/3 Tage vorher, Tag nach dem Fristende (E-412)");
  const kapAuf = async () => (await sqlPool`SELECT schluessel, titel, text, prioritaet, faellig_am::text AS faellig FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${auftragRef}:kapital-frist%`} ORDER BY id`) as any[];
  const marken = async () => ((await sqlPool`SELECT frist_warnung_14_am AS w14, frist_warnung_3_am AS w3, frist_abgelaufen_am AS ab, erstattung_ausgeloest_am AS erst FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0];
  const fristAuf = async (ende: string) => { await sqlPool`UPDATE fiaon_global_angebote SET frist_ende = ${ende}::date WHERE id = ${id}`; return A.globalAngebotLauf(); };
  await fristAuf(ende1);
  ok((await kapAuf()).length === 0, "acht Wochen vor dem Ende: keine Aufgabe");
  const l14 = await fristAuf(plus(heute, 14));
  const a14 = await kapAuf(); const m14 = await marken();
  ok(a14.length === 1 && a14[0].schluessel === `global:${auftragRef}:kapital-frist-14` && /noch 14 Tage/.test(a14[0].titel) && /Ziffer 4/.test(a14[0].text) && a14[0].text.includes(`bis ${tagDe(plus(plus(heute, 14), 14))}`) && m14.w14 && !m14.w3 && l14.warnungen >= 1,
    "14 Tage vorher: EINE Aufgabe an Justin, Marke frist_warnung_14_am", { a14, m14 });
  await fristAuf(plus(heute, 14));
  ok((await kapAuf()).length === 1, "zweiter Lauf: keine zweite Aufgabe");
  await fristAuf(plus(heute, 3));
  const a3 = await kapAuf(); const m3 = await marken();
  ok(a3.length === 2 && a3[1].schluessel === `global:${auftragRef}:kapital-frist-3` && /noch 3 Tage/.test(a3[1].titel) && Number(a3[1].prioritaet) === 1 && m3.w3, "3 Tage vorher: dringende Aufgabe, Marke frist_warnung_3_am", a3[1]);
  const lE = await fristAuf(plus(heute, -1));
  const aE = await kapAuf(); const mE2 = await marken();
  const endeE = plus(heute, -1);
  ok(aE.length === 3 && aE[2].schluessel === `global:${auftragRef}:kapital-fristende` && aE[2].titel.startsWith("Frist abgelaufen — Garantie Ziffer 4 prüfen") && aE[2].text.includes(`also bis ${tagDe(plus(endeE, 14))}`)
    && /KEIN Geld/.test(aE[2].text) && Number(aE[2].prioritaet) === 1 && aE[2].faellig === heute && mE2.ab && !mE2.erst && lE.fristende >= 1,
    "Tag nach dem Fristende: „Frist abgelaufen — Garantie Ziffer 4 prüfen“, Erstattung bis Fristende + 14, fällig heute; keine Erstattung ausgelöst", aE[2]);
  await fristAuf(plus(heute, -2));
  const [t1nach] = (await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${String(b1.ref)}`) as any[];
  const indiv = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel IN (${`global:${auftragRef}:fristende`}, ${`global:${auftragRef}:frist-14`}, ${`global:${auftragRef}:frist-3`}, ${`global:${auftragRef}:frist-14-justin`}, ${`global:${auftragRef}:frist-3-justin`})`) as any[];
  ok((await kapAuf()).length === 3 && t1nach.payment_status === "paid" && indiv[0].n === 0, "danach nichts mehr; Teil 1 bleibt bezahlt (kein Geld bewegt); keine Individual-Aufgabe", { teil1: t1nach.payment_status, indiv: indiv[0].n });
  const vk = JSON.stringify((await A.angebotLesen({ id }))!.verlauf);
  ok((vk.match(/Erinnerung an Justin/g) ?? []).length === 2 && (vk.match(/Aufgabe „Garantie prüfen“/g) ?? []).length === 1, "Verlauf am Angebot: je Schritt ein Eintrag");
  // Erfüllte Garantie → nichts (Marken zurück, nur Prüfstand).
  await sqlPool`UPDATE fiaon_global_angebote SET frist_warnung_14_am = NULL, frist_warnung_3_am = NULL, frist_abgelaufen_am = NULL, garantie_erfuellt_am = ${heute}::date WHERE id = ${id}`;
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${auftragRef}:kapital-frist%`}`;
  await fristAuf(plus(heute, -1));
  const mG = await marken();
  ok((await kapAuf()).length === 0 && !mG.ab && !mG.w14 && !mG.w3, "Garantie erfüllt: keine Aufgabe, keine Marke", mG);
  await sqlPool`UPDATE fiaon_global_angebote SET garantie_erfuellt_am = NULL, frist_ende = ${ende1}::date WHERE id = ${id}`;

  const rZuk = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/buergschaft`, { datum: "2099-01-01" }, { cookie: chef() });
  ok(rZuk.status === 409 && /Zukunft/.test(String(rZuk.body.error)), "Datum in der Zukunft → 409", rZuk);
  const vorCheck = (await sqlPool`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'fiaon_global_angebot_teile_nr_check'`) as any[];
  console.log(`        (Prüfregel der Teile vorher: ${vorCheck[0]?.d ?? "—"})`);
  const rB = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/buergschaft`, { datum: heute, beleg: "Prüfbank AG, Zusage per Mail an die Bürgin" }, { cookie: chef() });
  ok(rB.status === 200 && rB.body.ok && rB.body.betragCents === 49_900 && /^FIAON-/.test(String(rB.body.ref)) && rB.body.rechnungsnummer, "Bürgschaft zugesagt → 200, Rechnung mit Nummer über 499 €", rB.body);
  const [b2] = (await sqlPool`SELECT amount_due, invoice_number, payment_status, payment_reference, rechnung_ust_modus, tax_id, pack_key, pack_name, person_id FROM fiaon_applications WHERE ref = ${String(rB.body.ref)}`) as any[];
  ok(b2 && Number(b2.amount_due) === 499 && b2.payment_status === "pending_payment" && b2.invoice_number === rB.body.rechnungsnummer && b2.rechnung_ust_modus === "reverse_charge" && b2.tax_id === "ATU12345675" && b2.pack_key === "global_individuell",
    "Teil 2 in fiaon_applications: 499 €, offen, Reverse Charge mit UID", b2);
  const nApps = async () => ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE lower(email) = ${email.toLowerCase()}`) as any[])[0].n as number;
  const vorDoppel = await nApps();
  const rB2 = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/buergschaft`, { datum: heute }, { cookie: chef() });
  ok(rB2.status === 200 && rB2.body.schon === true && rB2.body.ref === rB.body.ref && (await nApps()) === vorDoppel, "zweiter Klick: „schon berechnet“, keine neue Bestellzeile", rB2.body);

  titel("3b. „Mein Auftrag“ mit Teil 2 (E-407)");
  const ma1 = await meinAuftrag(); const ag1 = ma1.body?.auftrag?.angebot;
  ok(ag1?.teile.length === 3 && ag1.teile[0].stand === "bezahlt" && ag1.teile[1].titel === "Bürgschaftsgebühr" && ag1.teile[1].betragCents === 49_900 && ag1.teile[1].stand === "offen"
    && ag1.teile[1].rechnungsnummer === rB.body.rechnungsnummer && ag1.teile[1].rechnungUrl && new RegExp(`Bürgschaft zugesagt am ${heute.split("-").reverse().join("\\.")}`).test(String(ag1.teile[1].hinweis)),
    "Teil 1 bezahlt, Teil 2 Bürgschaftsgebühr 499 € — Rechnung offen, Nummer, PDF-Link, „Bürgschaft zugesagt am …“", ag1?.teile);
  ok(ag1?.teile[2].stand === "noch nicht fällig" && /mit der Auszahlung/.test(String(ag1?.teile[2].hinweis)) && ag1?.summeCents === 329_800 && ag1?.fristBeginn === heute && /bis zum/.test(String(ag1?.garantieSatz)) && sauber(ag1),
    "Teil 3 wartet; Summe 3.298 €; Garantie mit Fristende ab Zahlung", { satz: ag1?.garantieSatz, summe: ag1?.summeCents });
  const pdf2 = await fetch(`${BASIS}${ag1?.teile[1].rechnungUrl}`, { headers: { "user-agent": UA } });
  ok(pdf2.status === 200 && Buffer.from(await pdf2.arrayBuffer()).subarray(0, 4).toString() === "%PDF", "Kunde öffnet die Rechnung über Teil 2", pdf2.status);
  const akteSicht = await A.angebotSichtZurAkte(auftragRef) as any;
  ok(akteSicht?.art === "kapital" && /Ziffer 4/.test(String(akteSicht?.garantieZiel)) && akteSicht?.teile.length === 3, "Office/Chefbüro (angebotSichtZurAkte): Kapital-Zweig, Garantieziel Ziffer 4", akteSicht?.garantieZiel);

  titel("3c. Teil 2 bezahlt (mark-paid) → nur Vermerk, keine neue Frist (E-411)");
  const pay2 = await bezahlen(String(b2.payment_reference));
  ok(pay2.status === 200 && pay2.body.ok, "mark-paid Teil 2 → 200", pay2);
  const t2bez = await warte(async () => !!((await sqlPool`SELECT bezahlt_am FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = 2`) as any[])[0]?.bezahlt_am);
  await new Promise((r) => setTimeout(r, 800));
  const f2 = await fristDb(id);
  ok(t2bez && f2.beginn === f1.beginn && f2.ende === f1.ende && Number(f2.ruht) === 0, "Teil 2 bezahlt: Frist unverändert, keine Ruhezeit", f2);
  const ze2 = JSON.stringify((await A.angebotLesen({ id }))!.verlauf);
  ok(/Bürgschaftsgebühr des Kapital-Angebots .* bezahlt \(499 €/.test(ze2) && ze2.includes(`bleibt beim ${tagDe(ende1)}`) && !/Teil 2 bezahlt \(/.test(ze2), "Verlauf: Kapital-Vermerk „Bürgschaftsgebühr … bezahlt, Frist bleibt“ statt Individual-Satz", ze2.slice(-400));
  const ind2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel IN (${`global:${auftragRef}:teil2-bezahlt`}, ${`global:${auftragRef}:teil2-nach-garantiefall`})`) as any[];
  ok(ind2[0].n === 0, "keine Individual-Aufgabe „Teil 2 bezahlt“", ind2[0]);
  const maB = await meinAuftrag(); const agB = maB.body?.auftrag?.angebot;
  ok(agB?.teile[1].stand === "bezahlt" && agB?.fristEnde === ende1 && agB?.summeCents === 329_800, "„Mein Auftrag“: Bürgschaftsgebühr bezahlt, Fristende unverändert", { teil2: agB?.teile?.[1], ende: agB?.fristEnde });

  titel("4. „Finanzierung ausgezahlt“");
  const rA = await post(`/api/fiaon/admin/global/angebote/${id}/kapital/auszahlung`, { datum: heute }, { cookie: chef() });
  ok(rA.status === 200 && rA.body.ok && rA.body.betragCents === 109_900 && rA.body.rechnungsnummer && rA.body.rechnungsnummer !== rB.body.rechnungsnummer, "Finanzierung ausgezahlt → 200, eigene Rechnung über 1.099 €", rA.body);
  const [b3] = (await sqlPool`SELECT amount_due, invoice_number, payment_status, rechnung_ust_modus FROM fiaon_applications WHERE ref = ${String(rA.body.ref)}`) as any[];
  ok(b3 && Number(b3.amount_due) === 1099 && b3.payment_status === "pending_payment" && b3.rechnung_ust_modus === "reverse_charge", "Teil 3 in fiaon_applications: 1.099 €, offen, Reverse Charge", b3);
  const teile = (await sqlPool`SELECT nr, titel, betrag_cents, faelligkeit, bestell_ref, meilenstein_am::text AS am, meilenstein_art, meilenstein_beleg, rechnung_am FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} ORDER BY nr`) as any[];
  ok(teile.length === 3 && teile[1].nr === 2 && Number(teile[1].betrag_cents) === 49_900 && teile[1].meilenstein_art === "buergschaft" && teile[1].am === heute && /Prüfbank/.test(teile[1].meilenstein_beleg)
    && teile[2].nr === 3 && Number(teile[2].betrag_cents) === 109_900 && teile[2].meilenstein_art === "auszahlung" && teile.every((t) => t.bestell_ref && t.rechnung_am), "drei Teile mit Datum, Art, Beleg, Bestellzeile", teile);
  const nachCheck = (await sqlPool`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = 'fiaon_global_angebot_teile_nr_check'`) as any[];
  ok(/500/.test(String(nachCheck[0]?.d)), "Prüfregel der Teile erlaubt Teil 3 (bis 500)", nachCheck);

  const ma2 = await meinAuftrag(); const ag2 = ma2.body?.auftrag?.angebot;
  ok(ag2?.teile[2].stand === "offen" && ag2.teile[2].rechnungsnummer === rA.body.rechnungsnummer && /Finanzierung ausgezahlt am/.test(String(ag2.teile[2].hinweis)) && /ausgezahlt/.test(String(ag2.garantieSatz)) && ag2.summeCents === 439_700 && sauber(ag2),
    "„Mein Auftrag“ mit Teil 3: Rechnung offen, „Finanzierung ausgezahlt am …“, Summe 4.397 €", { teil3: ag2?.teile?.[2], satz: ag2?.garantieSatz });

  titel("4b. Teil 3 bezahlt (mark-paid) → nur Vermerk, keine neue Frist (E-411)");
  const [b3z] = (await sqlPool`SELECT payment_reference FROM fiaon_applications WHERE ref = ${String(rA.body.ref)}`) as any[];
  const pay3 = await bezahlen(String(b3z.payment_reference));
  ok(pay3.status === 200 && pay3.body.ok, "mark-paid Teil 3 → 200", pay3);
  const t3bez = await warte(async () => !!((await sqlPool`SELECT bezahlt_am FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = 3`) as any[])[0]?.bezahlt_am);
  await new Promise((r) => setTimeout(r, 800));
  const f3 = await fristDb(id);
  const ze3 = JSON.stringify((await A.angebotLesen({ id }))!.verlauf);
  const [akte3] = (await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${auftragRef}`) as any[];
  ok(t3bez && f3.beginn === f1.beginn && f3.ende === f1.ende && /Vergütung bei Auszahlung der Finanzierung des Kapital-Angebots .* bezahlt \(1\.099 €/.test(ze3) && akte3?.status === "gestartet",
    "Teil 3 bezahlt: Vermerk, Frist unverändert, Akte bleibt „gestartet“ (nicht als „Teil 1“ behandelt)", { f3, akte: akte3?.status });

  titel("4c. Stundenlauf des Individualangebots und gespeicherte Frist (E-411)");
  // Frist künstlich abgelaufen (nur Prüfstand) — der Individual-Lauf darf Kapital weder warnen noch den Garantiefall melden.
  await sqlPool`UPDATE fiaon_global_angebote SET frist_ende = ${plus(heute, -1)}::date WHERE id = ${id}`;
  const laufErg = await A.globalAngebotLauf();
  const warn = (await sqlPool`SELECT schluessel FROM fiaon_betreiber_todos WHERE schluessel IN (${`global:${auftragRef}:fristende`}, ${`global:${auftragRef}:frist-14`}, ${`global:${auftragRef}:frist-3`}, ${`global:${auftragRef}:frist-14-justin`}, ${`global:${auftragRef}:frist-3-justin`})`) as any[];
  const [abg] = (await sqlPool`SELECT frist_abgelaufen_am FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  ok(warn.length === 0 && !abg.frist_abgelaufen_am, "Individual-Stundenlauf: keine Fristwarnung, kein „Frist abgelaufen“ für Kapital", { warn, lauf: laufErg });
  ok((await kapAuf()).length === 0, "E-412: „Finanzierung ausgezahlt“ eingetragen → auch der Kapital-Fristlauf meldet kein Fristende");
  // Ruhezeit nach Ziffer 4 (gleicher Beginn, späteres Ende) → „Mein Auftrag“ liest die Datenbank.
  await sqlPool`UPDATE fiaon_global_angebote SET frist_ende = ${plus(ende1, 7)}::date WHERE id = ${id}`;
  const maR = await meinAuftrag();
  ok(maR.body?.auftrag?.angebot?.fristEnde === plus(ende1, 7), "„Mein Auftrag“: verlängertes Fristende aus der Datenbank (Ruhezeit)", maR.body?.auftrag?.angebot?.fristEnde);
  await sqlPool`UPDATE fiaon_global_angebote SET frist_ende = ${ende1}::date WHERE id = ${id}`;

  titel("5. Rechnung, Zahlungsseite, Verlauf, Aufgaben, Mails");
  const zeile2 = await A.angebotRechnungsZeile(String(rB.body.ref)); const zeile3 = await A.angebotRechnungsZeile(String(rA.body.ref));
  ok(/Bürgschaftsgebühr \(Ziffer 6 Absatz 2\)/.test(String(zeile2?.beschreibung)) && /Ziffer 6 Absatz 3/.test(String(zeile3?.beschreibung)), "Rechnungszeilen nennen Ziffer und Anlass", [zeile2, zeile3]);
  const pdf = await fetch(`${BASIS}/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(rB.body.ref))}/rechnung.pdf`, { headers: { "user-agent": UA, cookie: chef() } });
  const pdfBuf = Buffer.from(await pdf.arrayBuffer());
  ok(pdf.status === 200 && pdfBuf.subarray(0, 4).toString() === "%PDF", "Rechnungs-PDF Teil 2 abrufbar", { status: pdf.status, art: pdf.headers.get("content-type") });
  const { angebotTeilZahlungsKontext } = await import("../server/lib/fiaon-global-angebot-begleit");
  const kx = await angebotTeilZahlungsKontext({ ref: rB.body.ref, payment_reference: b2.payment_reference, invoice_number: b2.invoice_number, payment_status: "pending_payment" });
  ok(/Bürgschaft für Ihre Finanzierung steht/.test(String(kx?.satz)) && !/Anmeldung/.test(JSON.stringify(kx?.pruefungen)), "Zahlungsseite Teil 2 spricht von der Bürgschaft, nicht von der Anmeldung", kx?.satz);
  const z2 = (await A.angebotLesen({ id }))!;
  const verlauf = JSON.stringify(z2.verlauf);
  ok(/Bürgschaft gegenüber dem Institut zugesagt am/.test(verlauf) && /Finanzierung ausgezahlt am/.test(verlauf) && (verlauf.match(/Rechnung Bürgschaftsgebühr/g) ?? []).length === 1, "Verlauf am Angebot: je ein Eintrag (kein doppelter beim zweiten Klick)");
  const auf = (await sqlPool`SELECT schluessel, titel, text FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`global:${an.ref}:kapital-teil%`} ORDER BY schluessel`) as any[];
  ok(auf.length === 2 && auf.every((a) => /\/zahlung\/FIAON|Zahlungsseite http/.test(a.text) && /Keine automatische Kundenmail/.test(a.text)), "Aufgaben an Justin für Teil 2 und Teil 3 mit Zahlungslink", auf.map((a) => [a.schluessel, a.titel]));
  const justin = (await sqlPool`SELECT betreff, status FROM fiaon_mail_log WHERE empfaenger = 'js@fiaon.com' AND betreff LIKE ${`%(${an.ref})%`} ORDER BY id`.catch(() => [])) as any[];
  const [mailsNach] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE lower(empfaenger) = ${email.toLowerCase()} AND status <> 'uebersprungen'`) as any[];
  const gesperrt = (await sqlPool`SELECT event FROM fiaon_mail_log WHERE lower(empfaenger) = ${email.toLowerCase()} AND status = 'uebersprungen' ORDER BY id`) as any[];
  ok(mailsNach.n === mailsVorher.n, "keine Mail an die Kundin durch die zwei Knöpfe und die drei Zahlungen (Firmenangebot)", { vorher: mailsVorher.n, nachher: mailsNach.n });
  console.log(`        (von der Firmen-Sperre abgefangen: ${gesperrt.length ? gesperrt.map((g) => g.event).join(", ") : "nichts"})`);
  console.log(`        (Mail an Justin im Protokoll: ${justin.length ? justin.map((j) => `${j.status} · ${j.betreff}`).join(" | ") : "keine Zeile — eigeneMailSenden ohne Schlüssel protokolliert ggf. nicht"}; Meldung: ${rA.body.meldung})`);
  ok(/Mail an Justin/.test(String(rA.body.meldung)), "Meldung nennt den Stand der Mail an Justin", rA.body.meldung);

  titel("6. Liste der Leitung und Sperre des Individualwegs");
  const liste = await fetch(`${BASIS}/api/fiaon/admin/global/angebote`, { headers: { "user-agent": UA, cookie: chef() } }).then((r) => r.json()) as any;
  const e = (liste.angebote as any[]).find((x) => x.id === id);
  ok(e?.art === "kapital" && e.teile.length === 3 && e.teile.every((t: any) => t.rechnungUrl && t.rechnungsnummer) && /schon berechnet/.test(String(e.knoepfe.buergschaft)) && /schon berechnet/.test(String(e.knoepfe.auszahlung)),
    "Liste: art „kapital“, drei Teile mit Rechnung, beide Knöpfe „schon berechnet“", e ? { teile: e.teile.map((t: any) => [t.nr, t.betragCents, t.rechnungsnummer]), knoepfe: e.knoepfe } : null);
  const mst = await post(`/api/fiaon/admin/global/angebote/${id}/meilenstein`, { art: "kapital", datum: heute, eingetragenAm: heute, beleg: "x".repeat(20) }, { cookie: chef() });
  ok(mst.status === 409 && mst.body.error === S.KAPITAL_SPERRGRUND, "Meilenstein des Individualangebots bleibt für Kapital gesperrt (zeigt auf die neuen Knöpfe)", mst);
  await sqlPool.end({ timeout: 5 });
}

console.log(`\n${fehler.length ? `${fehler.length} FEHLER, ` : ""}${gut} Prüfungen bestanden.`);
process.exit(fehler.length ? 1 : 0);
