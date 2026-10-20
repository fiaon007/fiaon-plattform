// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: ARAS-AUFTRAGS-CHAT IN DER AKTE (E-408, Akte-Steuerung, 20.10.2026)
//
//   Teil A (rein, ohne Datenbank, ohne Schlüssel):
//     npx tsx scripts/pruef-aras-briefing-chat.ts
//   Teil B (lokale DB — NIE gegen die Produktion; erfundene Testdaten, Attrappen für KI und Mara):
//     createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e408_basis fiaon_pruefstand_brief_bank
//     env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus PGSSLMODE=require \
//       DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_brief_bank?sslmode=require' \
//       DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_brief_bank?sslmode=require' \
//       npx tsx scripts/pruef-aras-briefing-chat.ts
//     dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_brief_bank
//
// Was geprüft wird: Eröffnung mit EINEM Vorschlag (Betrag + Tage), höchstens drei Rückfragen, die Karte (Ziel · Sagen ·
// Fragen · Nicht versprechen · Achten auf · Wann) = genau der Auftrag (≤ 500 Zeichen, durch die Wand), die Wand im Chat
// („Das darf ich so ned sagen — wie wär's mit …“), Verbote („kein Limit“) als feste Regel, „geht grad ned“ in EINER Zeile
// mit Mara, die KI-Antwort wird geprüft (fremde Beträge, Wand) — und mit DB: der Auftrag landet als EIN Plan-Eintrag mit
// dem Kartentext, verbotene Worte im Chat → KEIN Auftrag (Rot-Probe: auch eine an der Wand vorbei gespeicherte Karte
// wird beim Beauftragen abgewiesen), Mara statt Anruf, Zurücknehmen, Verlauf je Auftrag, fremder Mitarbeiter.
// Nur erfundene Namen und Nummern.
// ═══════════════════════════════════════════════════════════════════════════
process.env.NODE_ENV = process.env.NODE_ENV || "test";
delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.BREVO_API_KEY; delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.WHATSAPP_TOKEN; delete process.env.GOOGLE_SA_KEY;

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund: unknown = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund !== "" ? `  →  ${typeof fund === "string" ? fund : JSON.stringify(fund)?.slice(0, 400)}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

async function teilA(): Promise<void> {
  const C = await import("../shared/fiaon-aras-briefing-chat");
  const { auftragPruefen } = await import("../shared/fiaon-aras-regeln");
  const { AUFTRAG_MAX_ZEICHEN } = await import("../shared/fiaon-aras");
  type K = import("../shared/fiaon-aras-briefing-chat").BriefingKontext;
  // Dienstag, 20.10.2026, 14:05 Berlin (Sommerzeit: UTC+2)
  const JETZT = new Date("2026-10-20T12:05:00Z");
  const basis = (x: Partial<K> = {}): K => ({
    kunde: { anrede: "Herr", vorname: "Max", nachname: "Pruefmann" }, paket: "Gold", stand: "Kunde (bezahlt)",
    offen: [{ art: "rate", label: "Rate 2 über 59,99 €, fällig am 15.10.2026", satz: "Offene Rate 2 über 59,99 € …" }],
    rate: { nr: 2, betrag: "59,99 €", faelligAm: "15.10.2026", tageOffen: 5 },
    kontakte: [{ am: "18.10.", wer: "Team", was: "nicht erreicht" }], arasNotiz: "nur abends erreichbar", arasZuletzt: [],
    bleibtBeiDir: ["Kündigung", "Widerruf", "Beschwerde", "Erstattung", "Rechtliches (Anwalt, Behörde)"],
    geht: { ok: true, grund: null }, hinweis: null, sperre: { aus: false, telefonGesperrt: false }, geplant: null,
    mara: { weg: "whatsapp" }, heute: { datum: "20.10.2026", wochentag: "Dienstag", hhmm: "14:05" }, ...x,
  });
  const zug = (k: K, s: any, text: string, wert: string | null = null) => C.briefingWeiter(k, s, { text, wert }, JETZT);
  const wandOk = (t: string) => auftragPruefen(t).ok;

  titel("A1. Eröffnung: EIN Vorschlag mit Betrag und Tagen, zwei, drei Knöpfe");
  {
    const k = basis();
    const e = C.briefingEroeffnung(k, JETZT);
    ok("„Bei Herrn Pruefmann ist die Rate 2 über 59,99 € seit 5 Tagen offen. Soll ich ihn deswegen anrufen …“", /^Bei Herrn Pruefmann ist die Rate 2 über 59,99 € seit 5 Tagen offen\. Soll ich ihn deswegen anrufen, oder geht's um was anderes\?$/.test(e.zeilen[0]), e.zeilen[0]);
    ok("Knöpfe: „Ja, wegen der Rate“ · „Etwas anderes“ (2–3)", e.stand.chips.length >= 2 && e.stand.chips.length <= 3 && e.stand.chips[0].wert === "thema:rate" && e.stand.chips.some((c) => c.wert === "anders"), e.stand.chips);
    const k2 = basis({ offen: [...basis().offen, { art: "unterlagen", label: "Unterlagen fehlen: Kontoauszug", satz: "…" }] });
    const e2 = C.briefingEroeffnung(k2, JETZT);
    ok("Mehr als ein Punkt offen → Knopf „Alles Offene (2)“", e2.stand.chips.some((c) => c.wert === "alles" && /Alles Offene \(2\)/.test(c.text)), e2.stand.chips);
    const frau = C.briefingEroeffnung(basis({ kunde: { anrede: "Frau", vorname: "Erika", nachname: "Testfrau" }, rate: { ...basis().rate!, tageOffen: 1 } }), JETZT);
    ok("Kundin: „Bei Frau Testfrau … seit gestern offen. Soll ich sie …“", /Bei Frau Testfrau .* seit gestern offen\. Soll ich sie deswegen/.test(frau.zeilen[0]), frau.zeilen[0]);
    const neutral = C.briefingEroeffnung(basis({ kunde: { anrede: null, vorname: "Kim", nachname: "Probe" }, rate: { ...basis().rate!, tageOffen: 0 } }), JETZT);
    ok("Ohne Anrede: voller Name, kein Fürwort („Soll ich deswegen anrufen“), „heute fällig“", /Bei Kim Probe ist die Rate 2 über 59,99 € heute fällig\. Soll ich deswegen anrufen/.test(neutral.zeilen[0]), neutral.zeilen[0]);
    const nix = C.briefingEroeffnung(basis({ offen: [], rate: null }), JETZT);
    ok("Nichts offen → „… ist grad nix offen. Worum soll's …“ + „Kurz nachfragen“", /grad nix offen/.test(nix.zeilen[0]) && nix.stand.chips[0].wert === "thema:passt", nix);
    for (const [art, label, muster] of [
      ["zahlung_gemeldet", "Zahlung gemeldet am 12.10.2026, noch nicht zugeordnet", /Zahlung gemeldet \(am 12\.10\.2026\), aber noch ned zugeordnet/],
      ["zusage", "Zusage für den 14.10.2026 — noch nichts angekommen", /Überweisung für den 14\.10\.2026 zugesagt/],
      ["erste_rate", "Antrag abgeschickt, erste Rate offen", /Antrag abgeschickt, die erste Rate aber noch offen/],
      ["unterlagen", "Unterlagen fehlen: Kontoauszug, Ausweis", /fehlen noch Unterlagen: Kontoauszug, Ausweis\. Soll ich ihn anrufen und drum bitten\?/],
      ["rueckruf", "Bittet um einen Anruf: „Frage zur Karte“", /Herr Pruefmann hat um einen Anruf gebeten: „Frage zur Karte“/],
    ] as const) {
      const e3 = C.briefingEroeffnung(basis({ offen: [{ art, label, satz: "…" }], rate: null }), JETZT);
      ok(`Vorschlag „${art}“ mit den Angaben der Akte`, (muster as RegExp).test(e3.zeilen[0]), e3.zeilen[0]);
    }
    const h = C.briefingEroeffnung(basis({ hinweis: "Heute wurde er schon angerufen — Aras ruft frühestens morgen an." }), JETZT);
    ok("Hinweis der Lage als zweite Zeile („Gut zu wissen: …“)", h.zeilen.length === 2 && /^Gut zu wissen: Heute wurde/.test(h.zeilen[1]), h.zeilen);
  }

  titel("A2. Geht grad ned: der Grund in EINER Zeile, dann „Soll Mara stattdessen schreiben?“ — nie nur ein grauer Knopf");
  {
    const grund = "Noch kein Vertrag – ARAS ruft nur Kunden mit Vertrag an. Mara schreibt stattdessen.";
    const k = basis({ geht: { ok: false, grund }, offen: [{ art: "erste_rate", label: "Antrag abgeschickt, erste Rate offen", satz: "…" }], rate: null, mara: { weg: "zahlungsdaten" } });
    const e = C.briefingEroeffnung(k, JETZT);
    ok("Schritt „kann_nicht“, EINE Zeile: Grund (ohne doppeltes „Mara schreibt stattdessen“) + Angebot", e.stand.schritt === "kann_nicht" && e.zeilen.length === 1
      && /^Noch kein Vertrag – ARAS ruft nur Kunden mit Vertrag an\. Soll Mara stattdessen schreiben\? Sie schickt ihm die Zahlungsdaten per Mail\.$/.test(e.zeilen[0]), e.zeilen[0]);
    ok("Knöpfe: „Ja, Mara soll schreiben“ (aktion:mara) und „Nein, danke“", e.stand.chips[0].wert === "aktion:mara" && e.stand.chips.some((c) => c.wert === "aktion:schliessen"), e.stand.chips);
    ok("Kein Auftrag möglich: Freitext in diesem Schritt ändert nichts und plant nichts", zug(k, e.stand, "Ruf ihn trotzdem an").stand.schritt === "kann_nicht");
    const alt = C.grundOhneMaraSatz("Für diesen Kontakt braucht Aras ein Ja zum Anruf (Kästchen im Antrag, JA per Nachricht oder ein gebuchter Anruf) — bis dahin schreibt Mara.");
    ok("Alter Grund „… — bis dahin schreibt Mara.“ verliert nur den Mara-Satz", /gebuchter Anruf\)\.$/.test(alt), alt);
    const g = C.briefingEroeffnung(basis({ geht: { ok: false, grund: "Firmenkunde (FIAON Global) — hier ruft Aras nicht an." }, mara: null }), JETZT);
    ok("Firmenkunde/Test (kein Mara-Weg): „Das übernimmst am besten du selbst.“ + „Verstanden“", /du selbst\.$/.test(g.zeilen[0]) && g.stand.chips.length === 1 && g.stand.chips[0].text === "Verstanden", g);
    const aus = C.briefingEroeffnung(basis({ geht: { ok: false, grund: "Aras ist für diesen Kunden aus — unten wieder einschalten." }, sperre: { aus: true, telefonGesperrt: false } }), JETZT);
    ok("ARAS für ihn aus → Knopf „ARAS wieder einschalten“", aus.stand.chips.some((c) => c.wert === "aktion:wieder_an"), aus.stand.chips);
    const gepl = C.briefingEroeffnung(basis({ geht: { ok: false, grund: "Aras hat für diesen Kunden schon einen Anruf geplant." }, geplant: { id: 7, ab: new Date().toISOString(), zuruecknehmbar: true } }), JETZT);
    ok("Schon geplant (eigener Auftrag) → Knopf „Geplanten Anruf zurücknehmen“", gepl.stand.chips.some((c) => c.wert === "aktion:zuruecknehmen"), gepl.stand.chips);
    for (const weg of ["unterlagen", "zahlungsdaten", "whatsapp", "terminlink"] as const) ok(`Mara-Satz „${weg}“ nennt, was sie schickt`, /^Sie (?:schickt|schreibt) ihm /.test(C.maraSatz(weg, k)), C.maraSatz(weg, k));
  }

  titel("A3. Der Weg mit Knöpfen: Rate → das Übliche → passt so → Karte (höchstens drei Rückfragen)");
  {
    const k = basis();
    let s = C.briefingEroeffnung(k, JETZT).stand;
    let r = zug(k, s, "Ja, wegen der Rate", "thema:rate");
    ok("„Passt, wegen der Rate. Was genau soll ich sagen oder fragen?“ + zwei Knöpfe", r.stand.schritt === "was" && /^Passt, wegen der Rate\. Was genau soll ich sagen oder fragen\?$/.test(r.zeilen[0]) && r.stand.chips.length === 2, r);
    s = r.stand;
    r = zug(k, s, "Tag ausmachen + Link schicken", "was:ueblich");
    ok("→ „Und gibt's was, worauf ich achten soll …“ + Knöpfe (Nein / Zeit / behutsam)", r.stand.schritt === "achtung" && r.stand.chips.length === 3 && r.stand.chips.some((c) => c.wert === "achtung:abend"), r);
    s = r.stand;
    r = zug(k, s, "Nein, passt so", "achtung:nein");
    ok("→ Karte: „So würd ich's machen — passt das?“", r.stand.schritt === "karte" && /passt das\?$/.test(r.zeilen[0]), r);
    const kar = r.stand.karte;
    ok("Karte: Ziel mit Rate und Betrag, Sagen, eine Frage, „Keine Ratenpause …“, Punkt rate", /Rate 2 über 59,99 €/.test(kar.ziel) && !!kar.sagen && kar.fragen.length === 1 && kar.nichtVersprechen[0] === "Keine Ratenpause von sich aus anbieten" && kar.punkte.join() === "rate", kar);
    ok("Höchstens drei Rückfragen gezählt (hier 2)", r.stand.rueckfragen === 2, r.stand.rueckfragen);
    const text = C.auftragTextAusKarte(kar);
    ok("Auftragstext = Karte mit denselben Wörtern (Ziel/Sagen/Fragen/Nicht versprechen), ≤ 500, durch die Wand", /^Ziel: .+ Sagen: .+ Fragen: Bis wann schaffen Sie die Überweisung\? Nicht versprechen: Keine Ratenpause von sich aus anbieten\.$/.test(text) && text.length <= AUFTRAG_MAX_ZEICHEN && wandOk(text), text);
  }

  titel("A4. „Etwas anderes“ → worum → was → achten → Karte; nie mehr als drei Rückfragen");
  {
    const k = basis();
    let s = C.briefingEroeffnung(k, JETZT).stand;
    let r = zug(k, s, "Etwas anderes", "anders");
    ok("„Klar — worum soll's gehen? …“", r.stand.schritt === "worum" && r.stand.rueckfragen === 1, r);
    s = r.stand;
    r = zug(k, s, "Er hat eine neue Adresse in Graz.");
    ok("Freitext ohne Anweisung = Ziel → „was genau?“", r.stand.schritt === "was" && r.stand.karte.ziel === "Er hat eine neue Adresse in Graz." && r.modellErlaubt, r.stand);
    s = r.stand;
    r = zug(k, s, "Frag ihn nach der neuen Adresse. Sag ihm, dass wir sie für die Kartenpost brauchen.");
    ok("Fragen und Sagen getrennt („Frag ihn …“ → Fragen)", r.stand.karte.fragen[0] === "Frag ihn nach der neuen Adresse." && /Kartenpost/.test(r.stand.karte.sagen) && r.stand.schritt === "achtung", r.stand.karte);
    s = r.stand;
    r = zug(k, s, "Bitte erst ab 17 Uhr, er arbeitet.");
    ok("„erst ab 17 Uhr“ → Wann heute ab 17:00, Achten auf mit dem Satz → Karte", r.stand.schritt === "karte" && r.stand.karte.wann === "heute_ab" && r.stand.karte.ab === "17:00" && /er arbeitet/.test(r.stand.karte.achtung), r.stand.karte);
    ok("Drei Rückfragen, nicht mehr", r.stand.rueckfragen === 3, r.stand.rueckfragen);
    // Gleich alles in einem Satz: „Sag ihm …“ — dann ist das Ziel vom erkannten Punkt, und „was“ entfällt.
    const r2 = zug(k, C.briefingEroeffnung(k, JETZT).stand, "Sag ihm, er soll die Rate bis Freitag überweisen, und frag, ob der Link angekommen ist.");
    ok("Gleich mit Anweisung: Ziel vom Punkt „rate“, Sagen gesetzt, weiter zu „achten“", r2.stand.schritt === "achtung" && /Rate 2/.test(r2.stand.karte.ziel) && /bis Freitag/.test(r2.stand.karte.sagen) && r2.stand.karte.punkte.includes("rate"), r2.stand.karte);
    const r3 = zug(k, C.briefingEroeffnung(k, JETZT).stand, "Ja, und frag ihn, ob er bis Freitag zahlen kann.");
    ok("„Ja, und frag ihn, ob …“ → Thema Rate + genau diese Frage", r3.stand.thema === "rate" && r3.stand.karte.fragen[0] === "Frag ihn, ob er bis Freitag zahlen kann." && r3.stand.schritt === "achtung", r3.stand);
    const r4 = zug(k, C.briefingEroeffnung(k, JETZT).stand, "ja");
    ok("Getipptes „ja“ = Knopf „Ja, wegen der Rate“", r4.stand.thema === "rate" && r4.stand.schritt === "was", r4.stand);
    const r5 = zug(k, C.briefingEroeffnung(k, JETZT).stand, "wegen der Rate");
    ok("„wegen der Rate“ = Knopf (Thema Rate)", r5.stand.thema === "rate" && r5.stand.schritt === "was", r5.stand);
  }

  titel("A5. Die Wand im Chat: „Das darf ich so ned sagen — wie wär's mit …“, nichts davon erreicht die Karte");
  {
    const k = basis();
    let s = zug(k, C.briefingEroeffnung(k, JETZT).stand, "Ja", "thema:rate").stand;
    const boese = "Sag ihm, wenn er nicht zahlt, geht's ans Inkasso und die SCHUFA erfährt das.";
    const r = zug(k, s, boese);
    ok("Drohung → „Das darf ich so ned sagen — Druck und Drohungen sind tabu. Wie wär's mit: „…“?“", /^Das darf ich so ned sagen — Druck und Drohungen sind tabu\. Wie wär's mit: „.+“\?$/.test(r.zeilen[r.zeilen.length - 1]), r.zeilen);
    ok("Knöpfe „Ja, so“ / „Ich schreib's anders“, Hinweise der Wand dabei, KEINE KI für diesen Zug", r.stand.chips.map((c) => c.wert).join() === "wand:ja,wand:anders" && r.hinweise.length > 0 && !r.modellErlaubt, r.stand.chips);
    ok("Der Vorschlag selbst geht durch die Wand", !!r.stand.wand && wandOk(r.stand.wand.vorschlag), r.stand.wand);
    ok("Die Karte enthält nichts von Inkasso/SCHUFA", !/inkasso|schufa/i.test(JSON.stringify(r.stand.karte)), r.stand.karte);
    s = r.stand;
    const ja = zug(k, s, "Ja, so", "wand:ja");
    ok("„Ja, so“ → der Vorschlag gilt als Antwort, weiter zu „achten“", ja.stand.schritt === "achtung" && /freundlich/.test(ja.stand.karte.sagen + ja.stand.karte.fragen.join(" ")) && !ja.stand.wand, ja.stand.karte);
    const limit = zug(k, s, "Sag ihm, sein Limit von 5.000 € ist sicher.");
    ok("Limit-Zusage → „… ein Limit sag ich nie zu. Wie wär's mit …“", /ein Limit sag ich nie zu/.test(limit.zeilen.join(" ")) && !!limit.stand.wand, limit.zeilen);
    const mensch = zug(k, s, "Er will kündigen, kläre das mit ihm.");
    ok("Kündigung → „Das darf ich ned übernehmen — die Kündigung bleibt bei dir …“ (ohne Vorschlag)", /^Das darf ich ned übernehmen — die Kündigung bleibt bei dir/.test(mensch.zeilen[0]) && !mensch.stand.wand, mensch.zeilen);
    const last = zug(k, s, "Buch die Rate per Lastschrift ab.");
    ok("Lastschrift → „… er überweist selbst …“ + sicherer Vorschlag", /Lastschrift gibt's bei uns nicht/.test(last.zeilen.join(" ")) && !!last.stand.wand && wandOk(last.stand.wand.vorschlag), last.zeilen);
    const frau = zug(basis({ kunde: { anrede: "Frau", vorname: "Erika", nachname: "Testfrau" } }), s, "Sag ihr, sonst kommt das Inkasso.");
    ok("Bei einer Kundin spricht auch der Vorschlag von „ihr/sie“", /Frag sie freundlich/.test(frau.zeilen.join(" ")), frau.zeilen);
  }

  titel("A6. Verbote sind kein Versprechen: „kein Limit“ = feste Regel, „keine Ratenpause“ kommt auf die Karte");
  {
    const k = basis();
    const s = zug(k, C.briefingEroeffnung(k, JETZT).stand, "Ja", "thema:rate").stand;
    const r = zug(k, s, "Versprich ihm kein höheres Limit.");
    ok("„Versprich ihm kein höheres Limit“ → „Ein Limit sag ich eh nie zu — das ist bei mir fix.“, nicht auf der Karte", r.zeilen[0] === "Ein Limit sag ich eh nie zu — das ist bei mir fix." && !/limit/i.test(JSON.stringify(r.stand.karte)), r);
    const r2 = zug(k, s, "Biete ihm keine Stundung an. Frag ihn, ob er bis Freitag zahlen kann.");
    ok("„Biete ihm keine Stundung an“ → Nicht versprechen; die Frage → Fragen", r2.stand.karte.nichtVersprechen.some((x) => /^Keine Stundung/i.test(x)) && r2.stand.karte.fragen.some((x) => /bis Freitag/.test(x)), r2.stand.karte);
    const r3 = zug(k, s, "Erwähne das Inkasso nicht.");
    ok("„Erwähne das Inkasso nicht“ ist ein Verbot (kein Druck) — geht in „Achten auf“ bzw. als feste Regel", !r3.stand.wand && !/wie wär's/i.test(r3.zeilen.join(" ")), r3.zeilen);
  }

  titel("A7. Zeit aus Worten (Dienstag 14:05 Berlin)");
  {
    const z = (t: string) => C.zeitAusText(t, JETZT);
    ok("„ab 17 Uhr“ → heute ab 17:00", JSON.stringify(z("ab 17 Uhr")) === JSON.stringify({ wann: "heute_ab", ab: "17:00" }), z("ab 17 Uhr"));
    ok("„morgen ab 17 Uhr“ → morgen ab 17:00", JSON.stringify(z("morgen ab 17 Uhr")) === JSON.stringify({ wann: "morgen", ab: "17:00" }), z("morgen ab 17 Uhr"));
    ok("„abends“ → heute ab 17:00", z("nur abends erreichbar")?.ab === "17:00");
    ok("„vormittags“ (es ist nach 11) → morgen", z("lieber vormittags")?.wann === "morgen");
    ok("„ab 9“ (schon vorbei, > 4 h) → morgen ab 09:00", JSON.stringify(z("ab 9 Uhr")) === JSON.stringify({ wann: "morgen", ab: "09:00" }), z("ab 9 Uhr"));
    ok("Ohne Zeitangabe → null", z("ganz behutsam") === null);
    ok("Wann in Worten", C.wannText("morgen", "17:00") === "morgen ab 17:00 Uhr" && C.wannText("morgen", null) === "morgen ab 09:00 Uhr" && C.wannText("bald", null) === "so bald wie möglich");
  }

  titel("A8. Jeder eigene Satz (Vorlagen, Vorschläge, Standardkarten) geht durch die Wand");
  {
    const k = basis({ offen: [
      { art: "zahlung_gemeldet", label: "Zahlung gemeldet am 12.10.2026, noch nicht zugeordnet", satz: "…" },
      { art: "rate", label: "Rate 2 über 59,99 €, fällig am 15.10.2026", satz: "…" },
      { art: "zusage", label: "Zusage für den 14.10.2026 — noch nichts angekommen", satz: "…" },
      { art: "erste_rate", label: "Antrag abgeschickt, erste Rate offen", satz: "…" },
      { art: "unterlagen", label: "Unterlagen fehlen: Kontoauszug", satz: "…" },
      { art: "rueckruf", label: "Bittet um einen Anruf: „Frage zur Karte“", satz: "…" },
    ] });
    const durch: string[] = [];
    for (const t of ["rate", "zusage", "erste_rate", "zahlung_gemeldet", "unterlagen", "rueckruf", "alles", "passt"] as const) {
      const kar = C.standardKarte(t, k);
      const text = C.auftragTextAusKarte(kar);
      if (!wandOk(text) || text.length > AUFTRAG_MAX_ZEICHEN || !C.karteVollstaendig(kar)) durch.push(`${t}: ${text}`);
      let s = { ...C.leererStand(), thema: t, karte: kar, schritt: "was" as const };
      for (const c of C.chipsFuer("was", s, k, JETZT)) {
        const r = zug(k, s, c.text, c.wert);
        const t2 = C.auftragTextAusKarte(r.stand.karte);
        if (!wandOk(t2)) durch.push(`${t}/${c.wert}: ${t2}`);
      }
      s = { ...s };
    }
    ok("Standardkarten und „Was genau“-Knöpfe aller Anliegen: vollständig, ≤ 500, durch die Wand", durch.length === 0, durch);
    const vorschlaege = ["limit", "bank", "druck", "kopplung", "lastschrift", "vertrag"].map((a) => C.wandAntwort(
      a === "limit" ? "Sag ihm, sein Limit ist sicher." : a === "bank" ? "Sag ihm, wir sind keine Bank, die Partnerbank entscheidet." : a === "druck" ? "Sag ihm, sonst kommt das Inkasso."
        : a === "kopplung" ? "Sag ihm, ohne die Rate können wir den Vertrag nicht beenden." : a === "lastschrift" ? "Zieh die Rate per Lastschrift ein." : "Sag ihm: Dann sind wir uns einig, der Vertrag ist geschlossen.",
      "rate", { frau: false }));
    ok("Jede Wand-Antwort hat einen Vorschlag, der selbst durch die Wand geht", vorschlaege.every((v) => v && v.vorschlag && wandOk(v.vorschlag)), vorschlaege.map((v) => v && [v.art, v.vorschlag]));
    ok("Wand-Arten erkannt: limit · bank · druck · (kopplung|mensch) · lastschrift · vertrag", vorschlaege.map((v) => v?.art).join() .startsWith("limit,bank,druck,"), vorschlaege.map((v) => v?.art));
  }

  titel("A9. Die Karte passt in den Auftrag (≤ 500) — was die Karte zeigt, bekommt ARAS");
  {
    const lang = "x".repeat(10);
    const kar = C.karteEinpassen({
      ziel: `Ziel ${"sehr lang ".repeat(30)}`, sagen: `Sagen ${"noch länger ".repeat(40)}`,
      fragen: [`Frage eins ${"a ".repeat(60)}?`, `Frage zwei ${"b ".repeat(60)}?`, `Frage drei ${"c ".repeat(60)}?`],
      nichtVersprechen: [`Nicht eins ${lang}`, `Nicht zwei ${lang}`, `Nicht drei ${lang}`], achtung: `Achtung ${"d ".repeat(90)}`,
      wann: "bald", ab: null, punkte: [],
    });
    const t = C.auftragTextAusKarte(kar);
    ok("Überlange Karte wird eingepasst (≤ 500) und bleibt vollständig", t.length <= AUFTRAG_MAX_ZEICHEN && C.karteVollstaendig(kar), t.length);
    const w = C.karteWandPruefen({ ...kar, nichtVersprechen: ["Kein Limit zusagen", "Keine Ratenpause anbieten"] }, { frau: false });
    ok("Karte von Hand: „Kein Limit zusagen“ fliegt still heraus (feste Regel), „Keine Ratenpause …“ bleibt", w.ok && w.karte.nichtVersprechen.join() === "Keine Ratenpause anbieten" && w.fix.length === 1, w);
    const w2 = C.karteWandPruefen({ ...kar, sagen: "Sonst kommt das Inkasso." }, { frau: false });
    ok("Karte von Hand mit Drohung in „Sagen“ → nicht ok, Feld genannt, Vorschlag", !w2.ok && w2.feld === "sagen" && !!w2.antwort?.vorschlag, w2.feld);
  }

  titel("A10. Die KI-Antwort wird geprüft — sonst gilt der Leitfaden");
  {
    const k = basis();
    const entwurf = C.standardKarte("rate", k);
    const gutJson = JSON.stringify({ antwort: "Passt, dann frag ich nach dem Tag — und worauf soll ich achten?", chips: ["Nein, passt so", "Erst ab 17 Uhr"], karte: { ziel: "Rate 2 über 59,99 € klären.", sagen: "Die Rate ist offen, der Link kommt aufs Handy.", fragen: ["Bis wann schaffen Sie die Überweisung?"], nichtVersprechen: ["Keine Ratenpause von sich aus anbieten"], achtung: "", wann: "bald", ab: "" }, fertig: false });
    const z1 = C.modellAntwortLesen(gutJson, k, entwurf, ["Ja"], JETZT);
    ok("Gültige KI-Antwort → Karte, Antwort, Knöpfe übernommen", !!z1 && z1.antwort?.startsWith("Passt") === true && z1.chips.length === 2 && z1.karte.ziel === "Rate 2 über 59,99 € klären.", z1);
    ok("Kein JSON → null (Leitfaden)", C.modellAntwortLesen("Hallo!", k, entwurf, [], JETZT) === null);
    const erfunden = JSON.stringify({ antwort: "Gut.", chips: [], karte: { ...JSON.parse(gutJson).karte, sagen: "Die Rate über 79,99 € ist offen." }, fertig: true });
    ok("Erfundener Betrag (79,99 € steht nirgends) → null", C.modellAntwortLesen(erfunden, k, entwurf, ["ja"], JETZT) === null);
    const erfundenTag = JSON.stringify({ antwort: "Gut.", chips: [], karte: { ...JSON.parse(gutJson).karte, sagen: "Die Rate war am 03.10. fällig." }, fertig: true });
    ok("Erfundener Tag (03.10.) → null", C.modellAntwortLesen(erfundenTag, k, entwurf, ["ja"], JETZT) === null);
    const eigenerBetrag = C.modellAntwortLesen(JSON.stringify({ antwort: "Gut.", chips: [], karte: { ...JSON.parse(gutJson).karte, sagen: "Er hat 30 € Teilzahlung angekündigt." }, fertig: true }), k, entwurf, ["Er zahlt erstmal 30 €"], JETZT);
    ok("Betrag aus DEINER Nachricht ist erlaubt", !!eigenerBetrag);
    const boese = JSON.stringify({ antwort: "Mach ich.", chips: [], karte: { ...JSON.parse(gutJson).karte, sagen: "Sonst geht das ans Inkasso." }, fertig: true });
    ok("Karte der KI mit Drohung → null (Leitfaden)", C.modellAntwortLesen(boese, k, entwurf, [], JETZT) === null);
    const antwortBoese = C.modellAntwortLesen(JSON.stringify({ ...JSON.parse(gutJson), antwort: "Klar, ich sag ihm, sein Limit ist sicher.", chips: ["Limit ist sicher", "Passt"] }), k, entwurf, [], JETZT);
    ok("Antwort der KI mit Limit-Zusage → Antwort fällt weg (Leitfaden-Satz), Karte bleibt, böser Knopf fällt weg", !!antwortBoese && antwortBoese.antwort === null && antwortBoese.chips.join() === "Passt", antwortBoese);
    const zaun = C.modellAntwortLesen("```json\n" + gutJson + "\n```", k, entwurf, ["Ja"], JETZT);
    ok("JSON im Codezaun wird gelesen", !!zaun);
    const anw = C.modellAnweisung(k, { ...C.leererStand(), karte: entwurf });
    ok("Anweisung: du-Form, höchstens drei Rückfragen, feste Regeln, AKTE ohne Telefonnummer", /du-Form/.test(anw) && /höchstens 3 kurze Rückfragen/.test(anw) && /kein Limit/.test(anw) && /AKTE:/.test(anw) && !/\+49|0171/.test(anw), anw.slice(0, 200));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
async function teilB(): Promise<void> {
  const url = String(process.env.DATABASE_URL ?? "");
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    titel("B. DATENBANK — NICHT GELAUFEN (DATABASE_URL zeigt nicht auf die lokale Prüf-DB)");
    ok("Teil B braucht die lokale Prüf-DB (siehe Kopf)", false, url ? "DATABASE_URL ist nicht lokal" : "DATABASE_URL fehlt");
    return;
  }
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasSchemaZuruecksetzen } = await import("../server/lib/fiaon-aras-schema");
  const { einstellungSetzen, arasEinstellungenVergessen } = await import("../server/lib/fiaon-aras-plan");
  const { ensureAgentTables } = await import("../server/routes/fiaon-agent");
  const L = await import("../server/lib/fiaon-aras-briefing-chat");
  const { auftragPruefen } = await import("../shared/fiaon-aras-regeln");

  titel("B0. Testdaten (erfunden): Betreuerin, zweiter Mitarbeiter, Kunde mit offener Rate, ARAS darf Aufträge");
  await ensureAgentTables().catch(() => null);
  arasSchemaZuruecksetzen(); await arasSchema();
  await L.briefingTabelle();
  const stamp = Date.now().toString(36);
  const [ag] = (await sqlPool`INSERT INTO fiaon_agents (name, first_name, last_name, anrede, email, active, is_test_account)
    VALUES ('Paula Prüfer', 'Paula', 'Prüfer', 'Frau', ${`pruef-brief-${stamp}@fiaon.invalid`}, TRUE, TRUE) RETURNING id`) as any[];
  const [ag2] = (await sqlPool`INSERT INTO fiaon_agents (name, first_name, last_name, anrede, email, active, is_test_account)
    VALUES ('Otto Fremd', 'Otto', 'Fremd', 'Herr', ${`pruef-brief2-${stamp}@fiaon.invalid`}, TRUE, TRUE) RETURNING id`) as any[];
  const agentId = Number(ag.id), fremdId = Number(ag2.id);
  const neuePerson = async (nachname: string, nummer: string, mitRate = true): Promise<number> => {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (first_name, last_name, anrede, primary_phone, primary_email, country, assigned_agent_id, person_ref)
      VALUES ('Max', ${nachname}, 'Herr', ${nummer}, ${`${nachname.toLowerCase()}-${stamp}@fiaon.invalid`}, 'DE', ${agentId}, ${`PRUEF-BRIEF-${nachname}-${stamp}`}) RETURNING id`) as any[];
    const pid = Number(p.id);
    const ref = `FIAON-PRUEFBRIEF-${nachname.toUpperCase()}-${stamp}`;
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, status, payment_status, pack_key, pack_name, submitted_at, created_at, payment_reference)
      VALUES (${ref}, ${pid}, 'submitted', 'paid', 'gold', 'Gold', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', ${`${ref}-P`})`;
    if (mitRate) {
      await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, zahlungsreferenz)
        VALUES (${ref}, 2, 5999, (NOW() AT TIME ZONE 'Europe/Berlin')::date - 5, 'offen', ${`${ref}-2`})`;
    }
    return pid;
  };
  const p1 = await neuePerson("Pruefmann", "+491700000501");
  // ARAS darf: an, Stufe 1, Aufträge an, Fenster den ganzen Tag (lokale DB)
  await einstellungSetzen("aras_an", "an", "pruefstand");
  await einstellungSetzen("aras_stufe", "1", "pruefstand");
  await einstellungSetzen("aras_notaus", "aus", "pruefstand").catch(() => null);
  await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "an", rate: "an", auftrag: "an", probe: "an" }), "pruefstand");
  arasEinstellungenVergessen();
  const agent = await L.briefingAgent(agentId, "Paula Prüfer", "agent");
  const fremd = await L.briefingAgent(fremdId, "Otto Fremd", "agent");
  ok("Testdaten angelegt (erfunden, .invalid)", p1 > 0 && agentId > 0, { p1, agentId });

  // Keine KI: der Leitfaden. Mara-Versand: Attrappe (nie ein echter Weg).
  L.briefingModellSetzen(null);
  const maraLog: string[] = [];
  L.briefingMaraSetzen(async (weg) => { maraLog.push(weg); return { ok: true, meldung: "Attrappe: gesendet" }; });

  titel("B1. Öffnen → Vorschlag mit Betrag und Tagen → Knöpfe → Karte → „Passt“ → EIN Plan-Eintrag mit genau dem Kartentext");
  let planId = 0;
  {
    const s0 = await L.briefingStarten(p1, agent);
    ok("Eröffnung: „Bei Herrn Pruefmann ist die Rate 2 über 59,99 € seit 5 Tagen offen …“", /Bei Herrn Pruefmann ist die Rate 2 über 59,99 € seit 5 Tagen offen/.test(s0.zeilen[0]?.text ?? ""), s0.zeilen);
    const s0b = await L.briefingStarten(p1, agent);
    ok("Nochmal öffnen (Panel zu und auf) → derselbe Chat läuft weiter", s0b.id === s0.id, { a: s0.id, b: s0b.id });
    let s = await L.briefingAntworten(s0.id, p1, agent, { text: "Ja, wegen der Rate", wert: "thema:rate" });
    s = await L.briefingAntworten(s0.id, p1, agent, { text: "Tag ausmachen + Link schicken", wert: "was:ueblich" });
    s = await L.briefingAntworten(s0.id, p1, agent, { text: "Erst ab 17 Uhr", wert: "achtung:abend" });
    ok("Karte steht (Schritt karte), Auftragstext ≤ 500, durch die Wand", s.schritt === "karte" && !!s.karte && !!s.auftragText && s.zeichen <= 500 && auftragPruefen(s.auftragText).ok, s);
    const [vorher] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p1}`) as any[];
    const b = await L.briefingBeauftragen(s0.id, p1, agent, { wann: "bald", benachrichtigen: true });
    ok("„Passt – ARAS anrufen lassen“ → eingeplant", b.ok && b.sicht.status === "beauftragt" && /^Passt, ist eingeplant: Ich ruf ihn so bald wie möglich an\./.test(b.sicht.zeilen[b.sicht.zeilen.length - 1]?.text ?? ""), b);
    const pl = (await sqlPool`SELECT * FROM fiaon_aras_plan WHERE person_id = ${p1} ORDER BY id DESC`) as any[];
    planId = Number(pl[0]?.id ?? 0);
    ok("Genau EIN neuer Plan-Eintrag (Spielart auftrag, Auftraggeberin, Benachrichtigung)", pl.length === Number(vorher.n) + 1 && pl[0].spielart === "auftrag" && pl[0].auftrag_von === "Frau Prüfer" && Number(pl[0].benachrichtigen_agent_id) === agentId, pl[0]);
    ok("Plan-Text = Kartentext Wort für Wort; Punkt „rate“ mit seinen Zahlen", pl[0].auftrag_text === b.sicht.auftragText && Array.isArray(pl[0].auftrag_offenes) && pl[0].auftrag_offenes[0]?.art === "rate", { plan: pl[0].auftrag_text, karte: b.sicht.auftragText });
    const [br] = (await sqlPool`SELECT status, plan_id, auftrag_text, von FROM fiaon_aras_briefing WHERE id = ${s0.id}`) as any[];
    ok("Chat gespeichert: beauftragt, plan_id, Text, von „Frau Prüfer“", br.status === "beauftragt" && Number(br.plan_id) === planId && br.von === "Frau Prüfer", br);
    const v = await L.briefingVerlauf(p1);
    ok("Verlauf je Auftrag: Karte + Chat + Plan-Id (für „Geplant“ in der Karte)", v.length === 1 && v[0].planIds.includes(planId) && v[0].zeilen.length >= 6 && !!v[0].karte, v[0]);
    // „Was ARAS gemacht hat“: ein Anruf aus diesem Plan-Eintrag und ein zweiter Versuch (gleicher Text, gleiche Auftraggeberin,
    // so wie auftragNachbereiten ihn anlegt) gehören zum selben Chat.
    const [call] = (await sqlPool`INSERT INTO fiaon_calls (agent_id, person_id, nummer, status, gefuehrt_von) VALUES (${agentId}, ${p1}, '+491700000501', 'beendet', 'ki') RETURNING id`) as any[];
    const [aa] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, adapter, prompt_version, briefing, ergebnis)
      VALUES (${call.id}, ${planId}, 'auftrag', 'attrappe', 'pruef', '{}'::jsonb, 'nicht_erreicht') RETURNING id`) as any[];
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'fertig' WHERE id = ${planId}`;
    const [v2] = (await sqlPool`
      INSERT INTO fiaon_aras_plan (person_id, nummer, land, spielart, prioritaet, grund, rechtsgrund, frueh_ab, spaet_bis, status, versuch_nr, erzeugt_von,
                                   auftrag_von, auftrag_text, auftrag_offenes, auftrag_agent_id, benachrichtigen_agent_id)
      SELECT person_id, nummer, land, spielart, prioritaet, grund || ' (Versuch 2)', rechtsgrund, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 'wartet', 2, erzeugt_von,
             auftrag_von, auftrag_text, auftrag_offenes, auftrag_agent_id, benachrichtigen_agent_id
        FROM fiaon_aras_plan WHERE id = ${planId} RETURNING id`) as any[];
    const vv = await L.briefingVerlauf(p1);
    ok("Anruf und zweiter Versuch hängen am selben Chat (arasAnrufIds, planIds)", vv[0]?.arasAnrufIds.includes(Number(aa.id)) && vv[0]?.planIds.includes(Number(v2.id)) && vv[0]?.planIds.includes(planId), vv[0] && { a: vv[0].arasAnrufIds, p: vv[0].planIds });
    planId = Number(v2.id);
  }

  titel("B2. ROT-PROBE: verbotene Worte im Chat → KEIN Auftrag; auch eine an der Wand vorbei gespeicherte Karte wird abgewiesen");
  {
    // Den Auftrag aus B1 zurücknehmen — dann ist der Weg frei.
    const { arasAuftragZuruecknehmen } = await import("../server/lib/fiaon-aras-akte");
    const zr = await arasAuftragZuruecknehmen(p1, planId, agentId, false);
    ok("Vorbereitung: Auftrag aus B1 zurückgenommen", zr.ok, zr);
    const zaehlen = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p1} AND status = 'wartet'`) as any[])[0].n);
    const s0 = await L.briefingStarten(p1, agent, { neu: true });
    await L.briefingAntworten(s0.id, p1, agent, { text: "Ja, wegen der Rate", wert: "thema:rate" });
    const w = await L.briefingAntworten(s0.id, p1, agent, { text: "Sag ihm, wenn er nicht zahlt, kommt das Inkasso und die SCHUFA." });
    const letzte = w.zeilen[w.zeilen.length - 1]?.text ?? "";
    ok("ARAS antwortet im Chat: „Das darf ich so ned sagen — … Wie wär's mit: „…“?“", /^Das darf ich so ned sagen — .+ Wie wär's mit: „.+“\?$/.test(letzte), letzte);
    // Die Karte im Speicher (stand.karte) — die Sicht zeigt sie erst im Schritt „karte“, gespeichert ist sie schon jetzt.
    const [gespeichert] = (await sqlPool`SELECT stand -> 'karte' AS karte FROM fiaon_aras_briefing WHERE id = ${s0.id}`) as any[];
    ok("Kein Plan-Eintrag entstanden, die verbotenen Worte stehen nirgends in der (gespeicherten) Karte", (await zaehlen()) === 0 && !/inkasso|schufa/i.test(JSON.stringify(gespeichert?.karte ?? {})), gespeichert?.karte);
    // Bis zur Karte gehen (über „Ja, so“), dann die gespeicherte Karte an der Wand vorbei „vergiften“ — wie ein Fehler im Chat.
    await L.briefingAntworten(s0.id, p1, agent, { text: "Ja, so", wert: "wand:ja" });
    const k3 = await L.briefingAntworten(s0.id, p1, agent, { text: "Nein, passt so", wert: "achtung:nein" });
    ok("Mit dem Vorschlag steht eine saubere Karte", k3.schritt === "karte" && auftragPruefen(k3.auftragText ?? "").ok, k3.auftragText);
    const gift = { ...k3.karte!, sagen: "Wenn er heute nicht zahlt, geht das ans Inkasso." };
    await sqlPool`UPDATE fiaon_aras_briefing SET karte = ${sqlPool.json(gift as any)}, stand = jsonb_set(stand, '{karte}', ${sqlPool.json(gift as any)}) WHERE id = ${s0.id}`;
    const b = await L.briefingBeauftragen(s0.id, p1, agent, { wann: "bald" });
    ok("Beauftragen mit der vergifteten Karte → abgewiesen, mit Hinweisen", !b.ok && b.hinweise.length > 0, b.grund);
    ok("… und KEIN Plan-Eintrag", (await zaehlen()) === 0, await zaehlen());
    const [roh] = (await sqlPool`SELECT status FROM fiaon_aras_briefing WHERE id = ${s0.id}`) as any[];
    ok("Der Chat bleibt offen (nicht „beauftragt“)", roh.status === "offen", roh.status);
    // Gegenprobe der Gegenprobe: ohne die zweite Wand (direkt an arasAuftragGeben vorbei) hielte die Kern-Wand.
    const { arasAuftragGeben } = await import("../server/lib/fiaon-aras-akte");
    const kern = await arasAuftragGeben(p1, { auftrag: "Sagen: Wenn er heute nicht zahlt, geht das ans Inkasso.", wann: "bald" }, agentId);
    ok("Auch der Kern weist denselben Text ab (zwei Wände)", !kern.ok && (await zaehlen()) === 0, kern);
    // Karte von Hand ändern mit Drohung → abgewiesen; mit „Kein Limit zusagen“ → still heraus.
    const h = await L.briefingKarteSetzen(s0.id, p1, agent, { ...k3.karte!, sagen: "Sonst kommt das Inkasso." });
    ok("„Ändern“ mit Drohung → nicht übernommen, ARAS sagt warum", !h.ok && /Das darf ich so ned sagen/.test(h.sicht.zeilen[h.sicht.zeilen.length - 1]?.text ?? ""), h.sicht.zeilen.slice(-1));
    const h2 = await L.briefingKarteSetzen(s0.id, p1, agent, { ...k3.karte!, nichtVersprechen: ["Kein Limit zusagen", "Keine Ratenpause anbieten"] });
    ok("„Ändern“ mit „Kein Limit zusagen“ → übernommen ohne diesen Punkt (feste Regel)", h2.ok && h2.sicht.karte?.nichtVersprechen.join() === "Keine Ratenpause anbieten", h2.sicht.karte);
    const ok2 = await L.briefingBeauftragen(s0.id, p1, agent, { wann: "morgen", ab: "17:00" });
    const [pl] = (await sqlPool`SELECT frueh_ab FROM fiaon_aras_plan WHERE person_id = ${p1} AND status = 'wartet'`) as any[];
    const hh = pl ? new Date(pl.frueh_ab).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) : "";
    ok("Saubere Karte, „morgen ab 17:00“ → eingeplant, frühestens morgen 17:00 Berlin", ok2.ok && hh === "17:00" && /morgen ab 17:00 Uhr/.test(ok2.sicht.zeilen[ok2.sicht.zeilen.length - 1]?.text ?? ""), { hh, z: ok2.sicht.zeilen.slice(-1) });
  }

  titel("B3. Geht grad ned → EINE Zeile + Mara; „Ja, Mara soll schreiben“ (Attrappe) → kein Auftrag, Chat „mara“");
  {
    const p2 = await neuePerson("Ohnevertrag", "+491700000502", false);
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'pending_payment', status = 'submitted' WHERE person_id = ${p2}`;
    const s0 = await L.briefingStarten(p2, agent);
    ok("Eröffnung „kann_nicht“: EINE Zeile mit Grund + „Soll Mara stattdessen schreiben?“", s0.schritt === "kann_nicht" && s0.zeilen.length === 1 && /Soll Mara stattdessen schreiben\?/.test(s0.zeilen[0].text), s0.zeilen);
    ok("Knopf „Ja, Mara soll schreiben“", s0.chips.some((c) => c.wert === "aktion:mara"), s0.chips);
    const vorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p2}`) as any[])[0].n);
    const m = await L.briefingAntworten(s0.id, p2, agent, { text: "Ja, Mara soll schreiben", wert: "aktion:mara" });
    ok("Mara (Attrappe) gerufen, Chat „mara“, ARAS bestätigt", maraLog.length === 1 && m.status === "mara" && /^Erledigt — Mara hat ihm /.test(m.zeilen[m.zeilen.length - 1]?.text ?? ""), { maraLog, z: m.zeilen.slice(-1) });
    const nachher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p2}`) as any[])[0].n);
    ok("Kein Anruf eingeplant", nachher === vorher, { vorher, nachher });
  }

  titel("B4. Zurücknehmen aus dem Chat, fremder Mitarbeiter, KI-Attrappe (gültig und ungültig)");
  {
    const p3 = await neuePerson("Kimodell", "+491700000503");
    // Ein Auftrag wartet schon → der nächste Chat sagt es und bietet „zurücknehmen“ an.
    const a = await L.briefingStarten(p3, agent);
    await L.briefingAntworten(a.id, p3, agent, { text: "Ja", wert: "thema:rate" });
    await L.briefingAntworten(a.id, p3, agent, { text: "x", wert: "was:ueblich" });
    await L.briefingAntworten(a.id, p3, agent, { text: "x", wert: "achtung:nein" });
    const ba = await L.briefingBeauftragen(a.id, p3, agent, { wann: "bald" });
    ok("Vorbereitung: Auftrag eingeplant", ba.ok, ba.grund);
    const b = await L.briefingStarten(p3, agent);
    ok("Neuer Chat: geht grad ned (schon geplant) + Knopf „Geplanten Anruf zurücknehmen“", b.schritt === "kann_nicht" && b.chips.some((c) => c.wert === "aktion:zuruecknehmen"), { z: b.zeilen, c: b.chips });
    const zr = await L.briefingAntworten(b.id, p3, agent, { text: "Geplanten Anruf zurücknehmen", wert: "aktion:zuruecknehmen" });
    ok("Zurückgenommen → derselbe Chat beginnt mit einem frischen Vorschlag", zr.schritt === "anlass" && zr.zeilen.some((z) => /zurückgenommen/.test(z.text)) && /seit 5 Tagen offen/.test(zr.zeilen[zr.zeilen.length - 1]?.text ?? ""), zr.zeilen.slice(-3));
    let fremdFehler = "";
    try { await L.briefingAntworten(b.id, p3, fremd, { text: "Hallo" }); } catch (e) { fremdFehler = String((e as any)?.status ?? "") + " " + String((e as Error).message); }
    ok("Ein anderer Mitarbeiter führt den Chat nicht weiter (403)", /^403 Das ist der Auftrag von Frau Prüfer/.test(fremdFehler), fremdFehler);

    // KI-Attrappe: gültige Antwort → Karte von der KI, motor = ki, Kosten gezählt
    let aufrufe = 0;
    L.briefingModellSetzen(async ({ system, nachrichten }) => {
      aufrufe++;
      const letzte = nachrichten[nachrichten.length - 1]?.content ?? "";
      const ok1 = /AKTE:/.test(system) && /Rückfragen bisher/.test(system);
      return {
        text: JSON.stringify({ antwort: ok1 ? "Passt — und worauf soll ich achten?" : "?", chips: ["Nein, passt so"], fertig: false,
          karte: { ziel: "Rate 2 über 59,99 € klären.", sagen: "Die Rate ist offen; der Link zur Zahlung kommt aufs Handy.", fragen: [/Freitag/.test(letzte) ? "Schaffen Sie die Überweisung bis Freitag?" : "Bis wann schaffen Sie die Überweisung?"], nichtVersprechen: [], achtung: "", wann: "bald", ab: "" } }),
        modell: "attrappe", kostenCents: 0.4,
      };
    });
    const c = await L.briefingAntworten(b.id, p3, agent, { text: "Ja, und frag ihn, ob er bis Freitag überweisen kann." });
    const [row] = (await sqlPool`SELECT motor, ki_aufrufe, kosten_cents FROM fiaon_aras_briefing WHERE id = ${b.id}`) as any[];
    ok("KI-Attrappe: Antwort der KI im Chat, Karte von der KI, motor ki, Aufruf + Kosten gezählt",
      aufrufe === 1 && c.zeilen[c.zeilen.length - 1]?.text === "Passt — und worauf soll ich achten?" && row.motor === "ki" && Number(row.ki_aufrufe) === 1 && Number(row.kosten_cents) > 0, { aufrufe, row, z: c.zeilen.slice(-1) });
    // Ungültig: erfundener Betrag → Leitfaden übernimmt (kein „79,99 €“ irgendwo)
    L.briefingModellSetzen(async () => ({ text: JSON.stringify({ antwort: "Mach ich.", chips: [], fertig: true, karte: { ziel: "Rate über 79,99 € klären.", sagen: "Offen sind 79,99 €.", fragen: ["Wann zahlen Sie?"] } }), modell: "attrappe", kostenCents: 0.2 }));
    const d = await L.briefingAntworten(b.id, p3, agent, { text: "Er arbeitet Schicht, lieber nach 17 Uhr." });
    ok("KI mit erfundenem Betrag → verworfen, Leitfaden-Antwort, keine 79,99 € in Chat/Karte", !/79,99/.test(JSON.stringify(d)) && d.schritt === "karte", { s: d.schritt, z: d.zeilen.slice(-2) });
    L.briefingModellSetzen(null);
    // Ohne Schlüssel (lokal): kein KI-Aufruf, kein Kostenzähler
    const e = await L.briefingStarten(p3, agent, { neu: true });
    await L.briefingAntworten(e.id, p3, agent, { text: "Er hat eine neue Adresse." });
    const [row2] = (await sqlPool`SELECT motor, ki_aufrufe FROM fiaon_aras_briefing WHERE id = ${e.id}`) as any[];
    ok("Ohne Schlüssel: Leitfaden, kein KI-Aufruf gezählt", row2.motor === "leitfaden" && Number(row2.ki_aufrufe) === 0, row2);
  }

  // Aufräumen: Testkonten still (AGENTS.md) — Daten bleiben in der Wegwerf-DB.
  const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
  await testkontoStilllegen(agentId).catch(() => null);
  await testkontoStilllegen(fremdId).catch(() => null);
  L.briefingMaraSetzen(null);
  await sqlPool.end({ timeout: 2 }).catch(() => null);
}

async function main(): Promise<void> {
  await teilA();
  if (!process.argv.includes("--nur-rein")) await teilB();
  log(`\n${"═".repeat(74)}\n${schlecht === 0 ? "GRÜN" : "ROT"} — ${gut} ok, ${schlecht} rot\n${"═".repeat(74)}`);
  process.exit(schlecht === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
