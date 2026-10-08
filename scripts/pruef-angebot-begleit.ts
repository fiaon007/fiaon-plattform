// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER BEGLEITVERTRAG FÜR BESTANDSKUNDEN (Register E-312, 08.10.2026)
//
// Ohne Datenbank: Wortwand (Hauswand + Global-Regeln), kein „bis zu“/„vermitteln“/„garant…“, Fristen als Wort, Vertragssprache
// (Präambel und Ziffern ohne Ihr/wir), alles offen (Erfolgshonorar, Gründungskosten mit Höchstbetrag, Jahresbetreuung freiwillig
// stehen in Vertrag UND Übersicht), Prüfsumme stabil und unabhängig vom Annahmevermerk, Namensprüfung der LLC, Rechenbeispiel.
//   env -i PATH="$PATH" HOME="$HOME" npx tsx scripts/pruef-angebot-begleit.ts
// ═══════════════════════════════════════════════════════════════════════════
// Ohne Datenbank: Der Server-Teil wird nur für reine Funktionen geladen (wie im Prüfstand des Firmenangebots).
process.env.DATABASE_URL ||= "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const S = await import("../shared/fiaon-global-angebot-begleit");
const B = await import("../server/lib/fiaon-global-angebot-begleit");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER } = await import("../shared/fiaon-global-wortregeln");

let fehler = 0; let n = 0;
const ok = (b: unknown, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}${zusatz !== undefined ? `  → ${String(typeof zusatz === "string" ? zusatz : JSON.stringify(zusatz)).slice(0, 400)}` : ""}`); } };
const titel = (t: string) => console.log(`\n── ${t}`);
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<\/(p|li|h2|h3|section|div)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ").trim();
const texteAus = (v: unknown): string[] => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texteAus) : v && typeof v === "object" ? Object.values(v).flatMap(texteAus) : [];

// ── Erfundener Testkunde (KEINE Kundendaten — Hausregel E-242) ────────────────
const KUNDE = { art: "privat" as const, anrede: "Herr" as const, vorname: "Max", nachname: "Muster", geburtsdatum: "1990-01-01", strasse: "Musterweg 1", plz: "10115", ort: "Berlin", land: "DE" as const, email: "pruef@example.org", telefon: "" };
const PAR = S.begleitParameterAus({ bisher: [{ titel: "Zwei Monatsbeiträge", betrag: "2 × 249,99 €" }], entfaelltAb: "2026-10-14", entfaelltBetrag: "249,99 €" });
const D = { ref: "FIAON-IA-BPRUEF1", fassung: S.BEGLEIT_FASSUNG, kunde: KUNDE, parameter: PAR, gueltigBis: "2026-10-22" };

titel("1. Fassung und Verzweigung");
ok(S.istBegleitFassung(S.BEGLEIT_FASSUNG) && !S.istBegleitFassung("IA-2026-10-01-KG") && !S.istBegleitFassung("IA-FIRMA-2026-10-08-D"), "Präfix IA-BEGLEIT- trennt sauber von Individual- und Firmenangebot");
ok(B.istBegleitAngebot({ fassung: S.BEGLEIT_FASSUNG }) && !B.istBegleitAngebot({ fassung: "IA-FIRMA-2026-10-08-D" }), "Server erkennt dieselbe Fassung");
ok(S.begleitPflichtFehlen(D).length === 0, "Testkunde vollständig", S.begleitPflichtFehlen(D));

titel("2. Wortwand, Global-Regeln, Fristen als Wort");
const rumpf = text(S.begleitRumpfHtml(D, null));
const vertragOhneAnlage = rumpf.split("Anlage — Widerrufsbelehrung")[0];
const pruefe = (name: string, t: string) => {
  const w = wandPruefen(t);
  ok(w.length === 0, `${name}: Hauswand`, w.map((x) => `${x.treffer} (${x.hinweis.slice(0, 40)})`));
  for (const r of GLOBAL_SCHAERFER) { const m = t.match(new RegExp(r.muster.source, "gi")) ?? []; ok(m.length === 0, `${name}: ${r.grund.slice(0, 50)}`, m); }
  const ziffer = t.match(/\b\d+\s*(Wochen|Tage|Tagen|Werktage|Werktagen|Monate|Monaten)\b/g) ?? [];
  ok(ziffer.length === 0, `${name}: keine Frist mit Ziffer`, ziffer);
  ok(!(t.match(/\b(vermittel\w*|beschaff\w*|Zusicherung|garant\w*)\b/gi) ?? []).length, `${name}: kein „vermitteln/beschaffen/garant…“`, t.match(/\b(vermittel\w*|beschaff\w*|Zusicherung|garant\w*)\b/gi));
  ok(!/\bbis zu\b/i.test(t), `${name}: kein „bis zu“`);
  ok(!/\bBerat(er|ung)\b/i.test(t), `${name}: kein „Berater/Beratung“`);
  ok(!/\b0\s?%/.test(t), `${name}: kein „0 %“`);
};
pruefe("Vertrag", vertragOhneAnlage);
pruefe("Seite", texteAus(S.begleitSeite(D)).join("\n"));
pruefe("Bestellübersicht", texteAus(S.begleitBestellUebersicht(D)).join("\n"));
pruefe("Annahme", texteAus(S.begleitAnnahmeTexte(D)).join("\n"));
pruefe("Annahme-Antworten", texteAus(Object.values(S.BEGLEIT_ANNAHME).map((v) => (typeof v === "function" ? (v as (...a: string[]) => string)("pruef@example.org", "MUSTER LLC") : v))).join("\n"));

titel("3. Vertragssprache (Präambel und Ziffern ohne Ihr/wir)");
const ansprache = vertragOhneAnlage.match(/\b(Ihr|Ihre|Ihren|Ihrem|Ihrer|Sie|wir|uns|unser\w*)\b/g) ?? [];
ok(ansprache.length === 0, "Vertrag spricht über die Parteien", ansprache);
ok(S.begleitZiffern(D).length === 14 && S.begleitVertragInhalt(D).length === 16, "vierzehn Ziffern, Inhalt mit Präambel und Anlage");

titel("4. Alles offen: Honorar, Gründung, Jahresbetreuung, Altabo");
const U = texteAus(S.begleitBestellUebersicht(D)).join("\n");
ok(/5 %/.test(rumpf) && /5 %/.test(U), "Erfolgshonorar 5 % in Vertrag und Übersicht");
ok(rumpf.includes("12.500 USD"), "Rechenbeispiel im Vertrag: 250.000 USD → 12.500 USD");
ok(/500 € und 700 €/.test(rumpf) && /Höchstbetrag ist 700 €/.test(rumpf) && /höchstens 700 €/.test(U), "Gründungskosten Spanne + Höchstbetrag in Vertrag und Übersicht");
ok(/699 €/.test(rumpf) && /nur mit Ihrem Haken/.test(U), "Jahresbetreuung im Vertrag, freiwillig in der Übersicht");
ok(/14\.10\.2026/.test(rumpf) && /entfallen/.test(rumpf), "Altabo: Beitrag zum 14.10.2026 entfällt (Ziffer 2)");
ok(/entscheidet allein das jeweilige Institut/.test(rumpf) && /nicht einen bestimmten Finanzierungserfolg/.test(rumpf), "keine Erfolgszusage (Ziffer 6)");
ok(!/\bLastschrift\b/.test(rumpf.replace(/eine Lastschrift erfolgt nicht/g, "")), "keine Lastschrift");
ok(S.BEGLEIT_KNOPF === "Auftrag zahlungspflichtig erteilen", "Knopf nennt die Zahlungspflicht (§ 312j Abs. 3 BGB)");
const A = S.begleitAnnahmeTexte(D);
ok(/Freiwillig/.test(A.sofortBeginnUnter) && /Freiwillig/.test(A.jahresbetreuungUnter), "beide Haken als freiwillig beschriftet (nie vorangekreuzt — Seite)");

titel("5. Prüfsumme");
const h1 = B.begleitTextHash(D);
ok(h1 === B.begleitTextHash({ ...D }), "stabil");
ok(h1 !== B.begleitTextHash({ ...D, parameter: { ...PAR, honorarProzent: 6 } }), "ändert sich mit dem Honorar");
ok(h1 !== B.begleitTextHash({ ...D, ref: "FIAON-IA-BPRUEF2" }), "ändert sich mit der Referenz");
const vermerk = { am: new Date("2026-10-09T08:00:00Z"), ip: "203.0.113.7", userAgent: "Prüfstand", hash: h1, wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "MUSTER CAPITAL LLC", alternative2: "" }, sofortBeginn: true, jahresbetreuung: true }, unterschrift: { art: "getippt" as const, name: "Max Muster" } };
const mit = S.begleitRumpfHtml(D, vermerk);
ok(mit.includes("MUSTER VENTURES LLC") && mit.includes("MUSTER CAPITAL LLC") && /vor Ablauf der Widerrufsfrist beginnt/.test(text(mit)) && /gewählt —/.test(text(mit)), "Annahmevermerk: Namen, sofortiger Beginn, Jahresbetreuung");
ok(B.begleitTextHash(D) === h1, "Vermerk ändert die Prüfsumme nicht");
ok(text(S.begleitRumpfHtml(D, { ...vermerk, wahl: { ...vermerk.wahl, sofortBeginn: false, jahresbetreuung: false } })).includes("nicht gewählt"), "ohne Haken: „nicht gewählt“");

titel("6. Name der Gesellschaft");
ok(S.llcVollname("atlas ventures") === "ATLAS VENTURES LLC", "Großschreibung + LLC");
ok(S.llcVollname("Atlas Ventures LLC") === "ATLAS VENTURES LLC" && S.llcVollname("Atlas Ventures, L.L.C.") === "ATLAS VENTURES LLC" && S.llcVollname("Atlas GmbH") === "ATLAS LLC", "Endungen werden ersetzt, nicht verdoppelt");
ok(S.llcNameFehler("", true) === S.BEGLEIT_LLC_TEXTE.fehltWunsch && S.llcNameFehler("", false) === null, "Wunsch Pflicht, Ausweich frei");
ok(S.llcNameFehler("Müller Holding", true) === S.BEGLEIT_LLC_TEXTE.umlaut, "Umlaut abgewiesen");
ok(S.llcNameFehler("Atlas <script>", true) === S.BEGLEIT_LLC_TEXTE.zeichen, "fremde Zeichen abgewiesen");
ok(S.llcNameFehler("First Federal Trust", true) === S.BEGLEIT_LLC_TEXTE.geschuetzt, "geschützte Wörter abgewiesen");
ok(S.llcNameFehler("A", true) === S.BEGLEIT_LLC_TEXTE.kurz, "zu kurz");
const w1 = S.llcWahlPruefen({ wunsch: "Atlas", alternative1: "atlas llc" });
ok(!w1.ok && w1.feld === "alternative1", "doppelter Name abgewiesen");
const w2 = S.llcWahlPruefen({ wunsch: "Atlas Ventures", alternative1: "Atlas Capital", alternative2: "" });
ok(w2.ok && w2.wahl.wunsch === "ATLAS VENTURES LLC" && w2.wahl.alternative2 === "", "gültige Wahl bereinigt");

ok(B.begleitAnspracheFehler(S.begleitParameterAus({ bisher: [{ titel: "Paket für Ihre LLC", betrag: "1 €" }] })) !== null && B.begleitAnspracheFehler(PAR) === null, "Ansprache in Parametern wird abgewiesen (steht sonst in der Präambel)");
titel("7. Rechner");
ok(S.begleitHonorarUsd(250_000, 5) === 12_500 && S.begleitHonorarUsd(25_000, 5) === 1_250 && S.begleitHonorarUsd(-5, 5) === 0, "Honorar = 5 % (nie negativ)");
const r = S.begleitSeite(D).rechner;
ok(r.maxUsd === 250_000 && r.startUsd === 250_000 && r.prozent === 5, "Rechner startet beim Plan");

titel("8. Parameter");
ok(S.begleitParameterFehler(S.begleitParameterAus({ gruendungVonCents: 80_000, gruendungBisCents: 70_000 })) !== null, "Spanne der Gründung geprüft");
ok(S.begleitParameterAus({ honorarProzent: 99 }).honorarProzent === 5, "Honorar außerhalb 0–20 % fällt auf die Vorgabe");
ok(S.begleitParameterAus({ ansprechpartner: ["justin", "unbekannt"] }).ansprechpartner.join() === "justin", "nur bekannte Ansprechpartner");

console.log(`\n${n} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
