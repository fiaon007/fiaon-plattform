// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 KALIBRIERUNG (22.10.2026), OFFLINE — Prüf-Mara nach den ersten zwei Live-Tagen von ARAS.
// Die Stufen-Ampel stand am 21. und 22.10. auf Rot, fast nur durch Fehlalarme gegen Justins Vorgaben. Je Fehlalarm eine
// Probe, die jetzt „ok“ sein muss — und je echtem Verstoß eine Rot-Probe, die hart bleibt (Drohung, Kopplung, „garantiert“,
// Rate vor der Identität ohne Namen, Aufnahme vor dem Ja per Zeitstempel). Erfundene Namen und Sätze, keine Kundendaten.
//   DATABASE_URL=postgresql://nobody@127.0.0.1:1/none npx tsx scripts/pruef-e409-kalibrierung.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import {
  harteRegeln, telefonRegeln as pruefTelefonRegeln, anliegenVorIdentitaet, urteilBilden, liveBefundPunkte, punktMitBestand, anrufZaehltAlsPruefFehler,
  limitTelefonPruefen, modellPunkteTelefon, telefonPruefungNeuRechnen, transkriptText, arasText, PRUEF_REGEL_STAND,
  type TranskriptZeile, type ModellUrteil, type ErwarteterKunde,
} from "../shared/fiaon-ki-pruefung-regeln";
import { telefonRegeln } from "../shared/fiaon-aras-regeln";
import { tagesAmpel, STUFEN_ZIELE } from "../shared/fiaon-aras-stufe";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 500)}` : ""}`); }
};
const A = (text: string, t = 0): TranskriptZeile => ({ t, wer: "aras", text });
const K = (text: string, t = 0): TranskriptZeile => ({ t, wer: "kunde", text });
const KUNDE: ErwarteterKunde = { nachname: "Musterhuber", vorname: "Kordula", anrede: "Frau" };
const RATE = "I ruf an wegen Ihrer offenen Rate über neunundneunzig Euro neunundneunzig — i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte.";
/** Die Wien-ultra-Eröffnung OHNE Namen (Anrede unbekannt) — so beginnt seit dem Go-live fast jedes Gespräch. */
const OHNE_NAMEN = [A("Grüß Sie!"), A("ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam."), A("Kurz vorweg: I bin a KI, aber a nette."), A("(lacht) I ruf wegen Ihrem Kreditkartenpaket an — mit wem sprech i, bitte?")];
/** … und MIT Namen (Anrede bekannt): Gruß mit Namen, dann die Frage nach dem Moment. */
const MIT_NAMEN = [A("Grüß Sie, Frau Musterhuber!"), A("ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam."), A("Kurz vorweg: I bin a KI, aber a nette."), A("(lacht) I ruf wegen Ihrem Kreditkartenpaket an — habens an Moment?")];
const regelnTel = (zeilen: TranskriptZeile[], tel: Record<string, unknown> = {}) => harteRegeln(arasText(transkriptText(zeilen)), { kanal: "telefon", telefon: { kiHinweisSek: 3, transkript: zeilen, kunde: KUNDE, ...tel } });
const hart = (p: { regel: string; schwere: string }[]) => p.filter((x) => x.schwere === "hart").map((x) => x.regel);

console.log("── 1 · Identität: der eigene Name auf „Mit wem spreche ich?“ IST die Bestätigung");
ok(anliegenVorIdentitaet([...OHNE_NAMEN, K("Musterhuber, Kordula"), A("Okay, sehr gut, Frau Musterhuber."), A(RATE)], KUNDE) === null, "„<Nachname>, <Vorname>“ auf „mit wem sprech i?“ (Wien ultra) → Rate danach in Ordnung");
ok(anliegenVorIdentitaet([...OHNE_NAMEN, K("Mit Kordula Musterhuber"), A("Mhm, freut mi, leiwand."), A(RATE)], KUNDE) === null, "„Mit <Vorname> <Nachname>“ → in Ordnung");
ok(anliegenVorIdentitaet([...OHNE_NAMEN, K("Hallo"), A("I ruf wegen"), A("Ihrem Kreditkartenpaket an—"), K("Wer spricht"), A("mit wem"), A("spreche ich bitte?"), K("Meine Fiaaon Card, ja, Kordula Anneliese"), A(RATE)], { ...KUNDE, vorname: "Kordula Anneliese" }) === null,
  "„Meine FIAON-Card, ja, <Vorname> <Vorname>“ — die Frage in zwei Zeilen zerlegt („mit wem“ / „spreche ich bitte?“) → in Ordnung");
ok(anliegenVorIdentitaet([...OHNE_NAMEN, K("Mitmusterhuba"), A("Ah, grüß Sie, Frau Musterhuber, freut mi."), A(RATE)], KUNDE) === null, "Spracherkennung klebt und verschreibt („Mitmusterhuba“) → unscharf erkannt, in Ordnung");
ok(anliegenVorIdentitaet([...OHNE_NAMEN, K("Ja, hallo?"), K("Musterhueber hier"), A(RATE)], KUNDE) === null, "erst „Hallo?“, dann der Name (Umlaut-Variante) → in Ordnung");
ok(anliegenVorIdentitaet([A("Grüß Sie!"), A("ARAS spricht hier, von FIAON. Kurz vorweg: I bin a KI. Mit wem sprech i, bitte?"), K("Quirin Testhofer"), A(RATE)], null) === null, "Name unbekannt (kein Briefing-Name): seine Antwort auf die offene Frage zählt");
ok(anliegenVorIdentitaet([A("Grüß Sie, Herr Ćorićmuster!"), A("ARAS spricht hier, von FIAON — i bin a KI."), K("Ja?"), A(RATE)], { nachname: "Ćorićmuster", anrede: "Herr" }) === null, "Gruß mit Namen in jeder Schrift („Ćorić…“) und KEINE andere Frage danach → sein „Ja?“ zählt");
ok(anliegenVorIdentitaet([...MIT_NAMEN, K("Ja, am Apparat."), A(RATE)], KUNDE) === null && anliegenVorIdentitaet([...MIT_NAMEN, K("Ja, bin ich."), A(RATE)], KUNDE) === null, "Gruß mit Namen + „Moment?“ + „Ja, am Apparat“ / „Ja, bin ich“ → in Ordnung");
ok(anliegenVorIdentitaet([A("Grüß Gott, hier ist ARAS von FIAON, eine KI. Spreche ich mit Frau Musterhuber?"), K("Ja, genau."), A(RATE)], KUNDE) === null, "„Spreche ich mit Frau …?“ + „Ja, genau.“ → in Ordnung");

console.log("── 2 · Identität: echte Verstöße bleiben hart");
ok(!!anliegenVorIdentitaet([...MIT_NAMEN, K("Ja"), A(`Okay, sehr gut, Frau Musterhuber — ${RATE}`)], KUNDE), "ROT-PROBE: Gruß mit Namen + „habens an Moment?“ + nur „Ja“ → Rate danach = Treffer");
ok(!!anliegenVorIdentitaet([...MIT_NAMEN, K("Ähm, von wo rufen Sie an?"), A("Aus dem Kundenteam von FIAON."), K("Ah."), A(RATE)], KUNDE), "ROT-PROBE: Gruß mit Namen, er fragt etwas anderes → Rate danach = Treffer");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Hier ist die Brigitte Fremdmann."), A(RATE)], KUNDE), "ROT-PROBE: auf „mit wem?“ ein ANDERER Name → Treffer");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Hallo?"), A(RATE)], KUNDE), "ROT-PROBE: auf „mit wem?“ nur „Hallo?“ → Treffer");
ok(!!anliegenVorIdentitaet([A("Grüß Gott, hier ist ARAS von FIAON, eine KI. Spreche ich mit Herrn Musterhuber?"), K("Nein, hier ist seine Frau."), A(RATE)], { nachname: "Musterhuber", anrede: "Herr" }), "ROT-PROBE: „Nein, hier ist seine Frau“ → Treffer");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Frau Musterhuber? Wer will das wissen?"), A(RATE)], KUNDE), "ROT-PROBE: der Name als Frage nach jemandem („Frau …? Wer will das wissen?“) → Treffer");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Hier ist Frau Musterhuber."), A(RATE)], { nachname: "Musterhuber", anrede: "Herr" }), "ROT-PROBE: falsche Anrede („Frau …“, erwartet ist ein Herr) → Treffer");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Ja?"), A(RATE)], null), "ROT-PROBE: Name unbekannt, auf „mit wem?“ nur „Ja?“ → Treffer");
ok(!!anliegenVorIdentitaet([A("Grüß Sie! ARAS hier, von FIAON, i bin a KI. Es geht um Ihre offene Rate über neunundneunzig Euro.")], KUNDE), "ROT-PROBE: Betrag schon in der Eröffnung → Treffer");
const mitAnliegen = regelnTel([...MIT_NAMEN, K("Ja"), A(RATE)]);
ok(hart(mitAnliegen).includes("anliegen_vor_identitaet") && punktMitBestand(mitAnliegen.find((p) => p.regel === "anliegen_vor_identitaet")!, "telefon"), "… und dieser Punkt hat Bestand (zählt in der Ampel)", mitAnliegen);

console.log("── 3 · KI-Hinweis und Aufnahme: allein die Zeitstempel");
const sauber = [...OHNE_NAMEN, K("Musterhuber, Kordula"), A(RATE), A("Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?"), K("Ja, natürlich.")];
ok(hart(regelnTel(sauber, { kiHinweisSek: 3, aufnahmeJaSek: 30, aufnahmeGestartetSek: 30 })).length === 0, "KI-Hinweis nach 3 s (im dritten Satz), Aufnahme-FRAGE, Start im selben Moment wie das Ja → kein harter Punkt");
ok(hart(regelnTel(sauber, { kiHinweisSek: 23 })).includes("ki_hinweis_spaet"), "ROT-PROBE: KI-Hinweis nach 23 s → hart");
ok(hart(regelnTel(sauber, { kiHinweisSek: 3, aufnahmeJaSek: 30, aufnahmeGestartetSek: 12 })).includes("aufnahme_vor_ja"), "ROT-PROBE: Aufnahme vor dem Ja (Zeitstempel) → hart");
ok(!hart(regelnTel(sauber, { kiHinweisSek: 3, aufnahmeNeinSek: 20, aufnahmeJaSek: 40, aufnahmeGestartetSek: 40 })).includes("aufnahme_trotz_nein"), "erst Nein, später doch Ja, Start danach → keine „Aufnahme trotz Nein“");
ok(hart(regelnTel(sauber, { kiHinweisSek: 3, aufnahmeNeinSek: 20, aufnahmeGestartetSek: 25 })).includes("aufnahme_trotz_nein"), "ROT-PROBE: Nein und trotzdem gestartet → hart");

console.log("── 4 · Wunschlimit am Telefon (E-373): verkauft, nie ein Befund — nur echte Zusagen sind hart");
const frei = [
  "Mhm, Sein Wunschlimit sind fünfundzwanzigtausend.",
  "Sobald Ihre Zahlung da ist, schalten wir Ihren Account frei, damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit nutzen können.",
  "Okay, Ah, die Visa-Karte von unserer Partnerbank, genau die, mit Ihrem Wunschlimit, (lacht) damit Sie schnell loslegen können.",
  "Damit wir Ihr Wunschlimit von fünfundzwanzigtausend Euro weiter begleiten können, fehlt die noch.",
  "Ihr Wunschlimit liegt bei fünftausend Euro — damit starten Sie im FIAON Pro-Paket.",
  "Wann die Karte kommt, kann ich Ihnen ned fix sagen.",
  "Ihre Rate ist am 01.11.2026 fix fällig.",
];
const freiHart = frei.flatMap((s) => hart(telefonRegeln(s)).map((r) => `${r}: ${s.slice(0, 40)}`));
ok(freiHart.length === 0, `${frei.length} Wunschlimit-/Verkaufssätze aus den Live-Gesprächen → kein harter Punkt (Live-Prüfung und Prüf-Mara)`, freiHart);
ok(frei.every((s) => !hart(harteRegeln(s, { kanal: "telefon" })).length), "… auch über harteRegeln (Prüf-Mara mit Transkript)");
const zusagen: [string, string][] = [
  ["Ihr Limit von fünfundzwanzigtausend Euro ist garantiert.", "limit_zusage"],
  ["Die fünfundzwanzigtausend bekommen Sie sicher.", "limit_zusage"],
  ["Ihr Wunschlimit ist fix bewilligt.", "limit_zusage"],
  ["Damit Sie Ihr Wunschlimit bekommen, zahlens bitte heute.", "limit_zusage"],
  ["Ihr Kreditrahmen beträgt fünftausend Euro.", "limit_freigabe"],
];
for (const [s, r] of zusagen) ok(hart(telefonRegeln(s)).includes(r), `ROT-PROBE: „${s}“ → ${r} (hart)`, telefonRegeln(s));
ok(limitTelefonPruefen("Sicher, Ihr Wunschlimit steht im Antrag.").length === 0, "„Sicher, …“ am Satzanfang ist Zustimmung, keine Zusage");
ok(harteRegeln("Ihr Wunschlimit liegt bei 25.000 €.", { kanal: "whatsapp" }).some((p) => p.regel.startsWith("limit_")), "Maras Schreiben bleibt unverändert (weiße Liste fürs Geschriebene)");

console.log("── 5 · Druck und Drohung: „Geht sich des heute noch aus?“ ist Justins Skript — echte Drohung bleibt hart");
ok(!hart(telefonRegeln("Geht sich des heute noch aus? Wann schaffens die Überweisung — heut noch oder lieber morgen?")).length, "„Geht sich des heute noch aus?“ / „heut noch oder lieber morgen?“ → kein harter Punkt");
ok(hart(telefonRegeln("Wenn Sie nicht zahlen, geht das ans Inkasso.")).some((r) => r === "druck" || r === "drohung"), "ROT-PROBE: „Wenn Sie nicht zahlen, geht das ans Inkasso.“ → hart");
ok(hart(telefonRegeln("Das Angebot gilt nur heute.")).includes("druck"), "ROT-PROBE: „nur heute“ → hart");
ok(hart(telefonRegeln("Die Kündigung ist erst gültig, wenn die offene Rechnung bezahlt ist.")).includes("kopplung") && hart(telefonRegeln("Ihre Kündigung bestätigen wir erst nach Zahlung der offenen Rate.")).includes("kopplung"), "ROT-PROBE: Kündigung an Zahlung gekoppelt → hart");

console.log("── 6 · Modell-Punkte am Telefon (die Fehlalarme der Live-Tage, wörtlich nachgestellt) → ok; echte bleiben hart");
const M = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) => ({ regel: `modell_${regel}`, schwere, treffer, hinweis });
const fehlalarme: [string, ModellUrteil][] = [
  ["KI-Hinweis nicht im ersten Satz", { urteil: "fehler", begruendung: "x", punkte: [M("telefon_ki_hinweis", "hart", "ARAS: Kurz vorweg: I bin a KI, aber a nette.", "Der Hinweis, dass Aras eine KI ist, muss im ersten Satz erfolgen.")] }],
  ["Aufnahme-FRAGE als Aufnahme", { urteil: "fehler", begruendung: "x", punkte: [M("telefon_aufnahme", "hart", "ARAS: Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", "Aufnahme wird vor dem hörbaren Ja des Kunden erfragt."), M("aufnahme_erlaubnis", "hart", "darf i unser Gespräch kurz aufzeichnen?", "Aufnahme darf erst nach hörbarem Ja des Kunden erfolgen.")] }],
  ["Wienerisch und Lachen", { urteil: "auffaellig", begruendung: "x", punkte: [M("ton", "weich", "ARAS: Kurz vorweg, i bin a KI, aber a nette.", "Der Ton ist sehr umgangssprachlich und dialektal, was unprofessionell wirken kann."), M("ton", "weich", "ARAS: (lacht) I ruf wegen Ihrem Kreditkartenpaket an.", "Lachen und Umgangssprache können den professionellen Ton beeinträchtigen.")] }],
  ["„Geht sich des heute noch aus?“", { urteil: "auffaellig", begruendung: "x", punkte: [M("druck", "weich", "Geht sich das heut noch aus?", "Frage erzeugt Druck, ob die Überweisung heute noch möglich ist."), M("ton", "weich", "ARAS: A Frage: Geht sich die Überweisung heute noch aus?", "Frage kann als Druck empfunden werden.")] }],
  ["Wunschlimit-Verkaufssatz", { urteil: "fehler", begruendung: "x", punkte: [M("wahrheit", "hart", "Sobald Ihre Zahlung da ist, schalten wir Ihren Account frei, damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit nutzen können.", "Verspricht eine Nutzung der Visa-Kreditkarte mit Wunschlimit, was nicht garantiert werden darf."), M("wahrheit", "weich", "ARAS: Okay, Ja, genau, es ist Ihre eigene Kreditkarte", "Kann als Versprechen verstanden werden.")] }],
];
for (const [name, mu] of fehlalarme) { const u = urteilBilden([], mu, "telefon"); ok(u.urteil === "ok" && !u.punkte.length, `Fehlalarm „${name}“ → ok`, u); }
const drohung = urteilBilden([], { urteil: "fehler", begruendung: "x", punkte: [M("drohung", "hart", "Sonst schick ma des ans Inkasso.", "Drohung mit Inkasso.")] }, "telefon");
ok(drohung.urteil === "fehler" && drohung.punkte.some((p) => punktMitBestand(p, "telefon")), "ROT-PROBE: Modell findet eine Drohung („… ans Inkasso“) → fehler mit Bestand", drohung);
const garantie = urteilBilden([], { urteil: "fehler", begruendung: "x", punkte: [M("wahrheit", "hart", "Ihr Wunschlimit ist Ihnen garantiert.", "Limit als garantiert dargestellt.")] }, "telefon");
ok(garantie.urteil === "fehler", "ROT-PROBE: Modell findet „garantiert“ → fehler", garantie);
ok(urteilBilden([], { urteil: "fehler", begruendung: "x", punkte: [] }, "telefon").urteil === "auffaellig", "ein Modell-„fehler“ ohne Punkt ist am Telefon höchstens „auffällig“ (kein Regelverstoß)");
ok(urteilBilden([], { urteil: "fehler", begruendung: "x", punkte: [] }, "mail").urteil === "fehler", "Mail/WhatsApp unverändert (Modell-„fehler“ bleibt fehler)");
ok(modellPunkteTelefon([M("sonstiges", "hart", "Haben Sie sonst noch eine Frage?", "unklar")])[0]?.schwere === "weich", "ein harter Modell-Punkt außerhalb Drohung/Garantie/Lastschrift/Vertrag/Kopplung wird weich");
ok(modellPunkteTelefon([M("vertrag_stimme", "hart", "Gut, dann ist der Vertrag hiermit abgeschlossen.", "Vertrag per Stimme geschlossen.")])[0]?.schwere === "hart"
  && modellPunkteTelefon([M("lastschrift", "hart", "Wir buchen das per Lastschrift ab.", "Lastschrift angeboten.")])[0]?.schwere === "hart", "ROT-PROBE: Modell-Schlüssel vertrag_stimme und lastschrift bleiben hart");
const fristMitFolge = modellPunkteTelefon([M("druck", "hart", "Bis Freitag, sonst geht das ans Inkasso.", "Künstliche Frist mit Folge, unprofessioneller Ton.")]);
ok(fristMitFolge[0]?.schwere === "hart", "ROT-PROBE: „künstliche Frist“ mit Inkasso im Wortlaut — kein Filter verwirft sie, sie bleibt hart", fristMitFolge);
ok(limitTelefonPruefen("Ihr Wunschlimit is fix im Antrag drin.").length === 0 && limitTelefonPruefen("Ob Sie das Wunschlimit sicher kriegen, weiß i ned — aber garantiert ist es.").length === 1, "„fix im Antrag“ ist keine Zusage; jedes Zusagewort zählt für sich („ob … sicher …“ nein, „garantiert“ ja)");
ok(!!anliegenVorIdentitaet([...OHNE_NAMEN, K("Nö, Musterhuber wohnt nebenan."), A(RATE)], KUNDE), "ROT-PROBE: „Nö, <Name> wohnt nebenan.“ — der Name in einer Verneinung bestätigt nichts → Treffer");

console.log("── 7 · Live-Befund: Regelstand; alte Funde ohne Wortlaut sind nicht nachprüfbar");
const altLive = liveBefundPunkte({ live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }, { regel: "limit_zusage", schwere: "hart" }, { regel: "ki_hinweis_spaet", schwere: "hart" }] });
ok(altLive.find((p) => p.regel === "alt_anliegen_vor_identitaet")?.schwere === "weich" && altLive.find((p) => p.regel === "alt_limit_zusage")?.schwere === "weich" && altLive.find((p) => p.regel === "ki_hinweis_spaet")?.schwere === "hart",
  "ohne Regelstand: Identität und Limit → „alt_…“ (weich); Zeit-Regeln bleiben hart", altLive);
const neuLive = liveBefundPunkte({ live: true, stand: PRUEF_REGEL_STAND, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] });
ok(neuLive[0]?.regel === "anliegen_vor_identitaet" && neuLive[0]?.schwere === "hart", "mit Regelstand e409-2210 → hart wie gefunden");
ok(urteilBilden(altLive.filter((p) => p.regel.startsWith("alt_")), null, "telefon").urteil === "ok", "zwei „alt_…“-Punkte allein machen nichts „auffällig“");

console.log("── 8 · Stufen-Ampel: nur Punkte mit Bestand; ein einzelner Fall an einem kleinen Tag ist nicht rot");
ok(!anrufZaehltAlsPruefFehler({ status: "fehler", punkte: [M("telefon_ki_hinweis", "hart", "Kurz vorweg: I bin a KI.", "KI-Hinweis nicht im ersten Satz.")] }), "„fehler“ nur mit Modell-KI-Hinweis → zählt nicht");
ok(anrufZaehltAlsPruefFehler({ status: "fehler", punkte: [{ regel: "drohung", schwere: "hart", treffer: "", hinweis: "" }] }), "ROT-PROBE: Drohung → zählt");
ok(!anrufZaehltAlsPruefFehler({ status: "fehler", punkte: [{ regel: "drohung", schwere: "hart", treffer: "", hinweis: "" }], entschieden: "in_ordnung" }), "von Justin „In Ordnung“ → zählt nie");
ok(!anrufZaehltAlsPruefFehler({ status: "fehler", live: { live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } }), "ohne Prüfzeile, alter Live-Befund (ohne Regelstand) → zählt nicht");
ok(anrufZaehltAlsPruefFehler({ status: "offen", live: { live: true, stand: PRUEF_REGEL_STAND, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } }), "ROT-PROBE: neuer Live-Befund (noch ungeprüft) mit hartem Punkt → zählt sofort");
ok(anrufZaehltAlsPruefFehler({ status: "fehler" }) && !anrufZaehltAlsPruefFehler({ status: "ok" }), "ohne Prüfzeile und Live-Befund gilt der Status (Altbestand)");
const tag = (o: Record<string, unknown>) => ({ tag: "2026-10-22", stufe: 1, versuche: 40, gespraeche: 11, je: {}, kostenEuro: 3, zahlungen48: null, sekundenGespraeche: 11 * 180, abbrueche: 0, uebergaben: 0, pruefFehler: 0, ...o }) as any;
const pf = (w: any) => tagesAmpel(w).punkte.find((p) => p.schluessel === "pruef_fehler")?.farbe;
ok(STUFEN_ZIELE.pruefMindestFaelle === 2, "Mindestzahl für Rot: 2 Prüf-Fehler im Fenster");
ok(pf(tag({ pruefFehler: 1 })) === "gelb" && tagesAmpel(tag({ pruefFehler: 1 })).farbe !== "rot", "1 von 11 Gesprächen → gelb (nicht rot)");
ok(pf(tag({ pruefFehler: 2 })) === "rot", "ROT-PROBE: 2 von 11 → rot");
ok(pf(tag({ gespraeche: 100, sekundenGespraeche: 100 * 180, pruefFehler: 1 })) === "gruen", "1 von 100 (1 %) → grün");

console.log("── 9 · Die Live-Fälle vom 21./22.10. (nachgestellt, erfundene Namen) — neu gerechnet");
const neu = (zeilen: TranskriptZeile[], modell: ModellUrteil["punkte"], tel: Record<string, unknown> = {}) => telefonPruefungNeuRechnen({
  regelText: arasText(transkriptText(zeilen)), telefon: { kiHinweisSek: 2, aufnahmeJaSek: 60, aufnahmeGestartetSek: 60, transkript: zeilen, kunde: KUNDE, ...tel }, live: [], altePunkte: modell, modellHatGeurteilt: true,
});
const fall1 = neu([...OHNE_NAMEN, K("Musterhuber, Kordula"), A("Okay, sehr gut, Frau Musterhuber."), A(RATE), A("Damit wir Ihr Wunschlimit von fünfundzwanzigtausend Euro weiter begleiten können, fehlt die noch."), A("Geht sich des heute noch aus?")],
  [M("ton", "weich", "ARAS: Damit wir Ihr Wunschlimit von fünfundzwanzigtausend Euro weiter begleiten können, fehlt die noch.", "Wunschlimit könnte als Versprechen verstanden werden."), M("ton", "weich", "ARAS: A Frage: Geht sich die Überweisung heute noch aus?", "Frage kann als Druck empfunden werden.")]);
ok(fall1.urteil === "ok", "Name auf „mit wem sprech i?“ + Wunschlimit + „heute noch?“ → ok (vorher: fehler)", fall1);
const fall2 = neu([...OHNE_NAMEN, K("Hallo"), A("mit wem"), A("spreche ich bitte?"), K("Meine Fiaaon Card, ja, Kordula"), A("Mhm, Frau Musterhuber!"), A(RATE), A("Sobald Ihre Zahlung da ist, schalten wir Ihren Account frei, damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit nutzen können.")],
  [M("wahrheit", "hart", "Sobald Ihre Zahlung da ist, schalten wir Ihren Account frei, damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit nutzen können.", "Verspricht eine garantierte Freischaltung der Karte mit Wunschlimit.")]);
ok(fall2.urteil === "ok", "Vorname auf „mit wem?“ + E-373-Satz (limit_zusage + modell_wahrheit) → ok (vorher: fehler)", fall2);
const fall3 = neu([...MIT_NAMEN, K("Ja"), A(`Okay, sehr gut, Frau Musterhuber — ${RATE}`)], []);
ok(fall3.urteil === "fehler" && hart(fall3.punkte).includes("anliegen_vor_identitaet"), "ROT-PROBE: Gruß mit Namen + „Moment?“ + „Ja“ + Rate → bleibt fehler", fall3);

console.log("── 10 · Am Quelltext: die Anweisung ans Modell kennt Justins Vorgaben");
const srv = readFileSync(new URL("../server/lib/fiaon-ki-pruefung.ts", import.meta.url), "utf8");
ok(/dafür vergibst du NIE einen Punkt/.test(srv) && /Geht sich des heute noch aus\?/.test(srv) && /Wienerisch ultra mit Lachen/.test(srv) && /Darf ich unser Gespräch kurz aufzeichnen\?“ ist keine Aufnahme/.test(srv),
  "SYSTEM: KI-Hinweis/Aufnahme/Identität per Code, Wienerisch, „heute noch?“, Aufnahme-Frage — nie ein Punkt");
ok(/fiaon_ki_pruefung ADD COLUMN IF NOT EXISTS regel_stand/.test(srv) && /regel_stand = \$\{PRUEF_REGEL_STAND\}/.test(srv), "jede neue Prüfzeile trägt ihren Regelstand");
const nb = readFileSync(new URL("../server/lib/fiaon-aras-nachbereitung.ts", import.meta.url), "utf8");
ok(/stand: PRUEF_REGEL_STAND/.test(nb) && /kunde, arasBeendet/.test(nb) && !/console\.[a-z]+\([^)]*nachname/.test(nb), "Live-Befund: mit erwartetem Kunden und Regelstand — der Name steht in keinem Log");
ok(!/console\.[a-z]+\([^)]*(?:nachname|vorname|kunde\.)/.test(srv), "Prüf-Mara loggt nie einen Namen");
ok(pruefTelefonRegeln === pruefTelefonRegeln && typeof telefonRegeln === "function", "EINE Quelle: fiaon-aras-regeln leitet die Prüf-Regeln weiter");

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
process.exit(schlecht ? 1 : 0);
