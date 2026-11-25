// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-531 (25.11.2026): WHATSAPP PRIVAT OHNE KI — DER SCHALTER mara_wa_privat
//
// Justin (Mara-Neubau, Stufe 1): Privatkunden auf WhatsApp lassen sich ohne KI bedienen. Steht „WhatsApp Privat mit KI“
// auf „aus“: kein KI-Aufruf — höchstens einmal je 24 Stunden je Nummer ein fester Hinweis und EINE offene Aufgabe je Nummer
// für einen Menschen (Kündigung, Widerruf, Erstattung, Anwalt, Klage, Beschwerde, Löschwunsch → hoch, Wort im Titel).
// Mara Business und Global-Kunden bleiben unberührt.
//
// OHNE Datenbank, ohne Modell, ohne Netz — nur die reinen Regeln und der Quelltext:
//   A Register (Schalter setzbar über POST /chef/ki/einstellung), B Lesart des Schalters, C die Entscheidung,
//   D Titel, E Text der Aufgabe, F der feste Hinweis gegen die Wände, G Einordnung der Aufgabe (fremde Regeln, nur gelesen),
//   H Quelltext (Reihenfolge in maraAntwortet, kein Modell im neuen Weg, Aufgabe vor Hinweis),
//   I Abnahme 25.11.2026: offene Karte bei Justin (wa#3), Mensch im Gespräch (wa#5), Nachhol-Takt in der KI-Pause (wa#7).
// Abnahme wa#0 (C, F, H): Kontakt-Stopp und Werbe-Widerspruch getrennt; „nicht mehr anrufen“ und Fragen wie „Ist das keine
// Werbung?“ bekommen nie die STOPP-Bestätigung; E-408 (ANRUF_SPERRE_WA) läuft auch ohne KI.
// Prüfung 25.11.2026 (letzte Runde vor dem Livegang):
//   J E-408 ohne KI endet nur früh, wenn außer dem Anruf-Stopp nichts Heikles dasteht — sonst Aufgabe/Karte + Anruf-Satz;
//   I Karte bei Justin: Warn-Beleg „Folge-Nachricht — darin: …“, steht sie auf „später“, zusätzlich die Aufgabe (wa#3);
//   C „keine Nachrichten/E-Mails mehr“ je Teilsatz (Frage, Feststellung, Zeilenumbruch, „nicht mehr anrufen oder schreiben“);
//   I Vorlagen von Menschen zählen beim „Mensch im Gespräch“ mit (wa#5).
//
//   cd <Arbeitskopie> && env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DATABASE_URL="postgresql://vorschau:vorschau@127.0.0.1:1/vorschau" \
//     ./node_modules/.bin/tsx scripts/pruef-mara-wa-privat.ts
// Repo öffentlich: nur erfundene Sätze, keine Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_SA_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
// Nie eine echte Datenbank: Ein Port, auf dem nichts läuft — jede versehentliche Abfrage scheitert sofort.
if (!/@127\.0\.0\.1:(1|9)\//.test(String(process.env.DATABASE_URL ?? ""))) process.env.DATABASE_URL = "postgresql://vorschau:vorschau@127.0.0.1:1/vorschau";
process.env.CRONS = "aus";

const wa = await import("../server/lib/fiaon-whatsapp-mara");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const reg = await import("../shared/fiaon-ki-schalter");
const ton = await import("../shared/fiaon-mara-ton");
const arten = await import("../shared/fiaon-auftrag-arten");
const { readFileSync } = await import("node:fs");

let gut = 0, fehler = 0;
const ok = (b: unknown, was: string) => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { fehler++; console.log(`  ✗ ${was}`); } };
const gleich = (ist: unknown, soll: unknown, was: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${was} — ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t}`);

// ── A. Register ─────────────────────────────────────────────────────────────
abschnitt("A. Register: der Schalter ist da und über den vorhandenen Weg setzbar");
const e = reg.registerEintrag("mara_wa_privat");
ok(!!e, "mara_wa_privat steht im Register");
if (!e) { console.log("\nOhne Register-Eintrag geht nichts weiter."); process.exit(1); }
ok(e.gruppe === "mara_whatsapp" && e.typ === "an_aus" && e.vorgabe === "an" && e.dienst === "mara", "Gruppe WhatsApp, an/aus, Vorgabe „an“ (der Deploy ändert nichts)");
ok(e.label === "WhatsApp Privat mit KI" && e.label.length <= 40 && e.satz.length <= 80, `Label „${e.label}“, Satz ${e.satz.length} Zeichen (≤ 80)`);
ok(/Privatkunden/.test(e.satz) && /fester Hinweis/.test(e.satz) && /Aufgabe/.test(e.satz), "Satz nennt Privatkunden, festen Hinweis und Aufgabe");
ok(e.setzer.route === "/chef/ki/einstellung" && reg.KI_SCHLUESSEL.includes("mara_wa_privat") && !reg.ARAS_SCHLUESSEL.includes("mara_wa_privat"), "Setzer: POST /chef/ki/einstellung (steht in KI_SCHLUESSEL)");
{
  const aus = reg.wertPruefen(e, "aus"), an = reg.wertPruefen(e, "1"), quatsch = reg.wertPruefen(e, "vielleicht");
  ok(aus.ok && aus.wert === "aus" && an.ok && an.wert === "an" && !quatsch.ok, "wertPruefen: aus → aus, 1 → an, Unsinn → Fehler");
}
ok(!!reg.rueckfrageFuer(e, "aus") && reg.rueckfrageFuer(e, "an") === null, "Rückfrage nur beim Ausschalten");
ok(/Schutz-Antworten ohne KI laufen weiter/.test(String(e.rueckfrage?.text ?? "")) && /Werbesperre/.test(String(e.rueckfrage?.text ?? "")),
  "Nachbesserung: Die Rückfrage sagt, dass die festen Schutz-Antworten (Stopp, Werbesperre, Löschwunsch, Anwalt …) weiterlaufen");
gleich(reg.setzerKoerper(e, "aus"), { schluessel: "mara_wa_privat", wert: "aus" }, "Setzer-Körper für die Route");
ok(e.leser === "fiaon-whatsapp-mara.ts:waPrivatSchalter", "Leser: fiaon-whatsapp-mara.ts:waPrivatSchalter");

// ── B. Lesart ───────────────────────────────────────────────────────────────
abschnitt("B. Lesart des Schalters = was die Einstellungen-Seite zeigt");
ok(wa.waPrivatSchalterAn(null) && wa.waPrivatSchalterAn(undefined) && wa.waPrivatSchalterAn(""), "fehlt/leer → an (Vorgabe)");
ok(wa.waPrivatSchalterAn("an") && wa.waPrivatSchalterAn("1") && wa.waPrivatSchalterAn("ja") && wa.waPrivatSchalterAn("TRUE"), "an/1/ja/true → an");
ok(!wa.waPrivatSchalterAn("aus") && !wa.waPrivatSchalterAn("0") && !wa.waPrivatSchalterAn("nein") && !wa.waPrivatSchalterAn(" AUS ") && !wa.waPrivatSchalterAn("false"), "aus/0/nein/false → aus");
{
  const roh = ["an", "aus", "1", "0", "ja", "nein", "true", "false", "irgendwas", "", null];
  ok(roh.every((r) => wa.waPrivatSchalterAn(r) === (reg.wertAnzeige(e, r) === "an")), "für jeden Wert gleich wie wertAnzeige im Register (Anzeige = Wirkung)");
}

// ── C. Entscheidung ─────────────────────────────────────────────────────────
abschnitt("C. Die Entscheidung (rein)");
type Ein = Parameters<typeof wa.waPrivatEntscheidung>[0];
const ent = (o: Partial<Ein>) => wa.waPrivatEntscheidung({ privat: true, schalter: "aus", festVorStunden: null, text: "Wo ist meine Karte?", ...o });
gleich(ent({ privat: false }).aktion, "ki", "nicht privat (Business/Global) → ki");
gleich(ent({ schalter: "an" }).aktion, "ki", "Schalter an → ki");
gleich(ent({ schalter: null }).aktion, "ki", "Schalter fehlt → ki (Vorgabe an)");
gleich([ent({}).aktion, ent({}).prioritaet], ["fest_und_aufgabe", "normal"], "aus, nie ein Hinweis → fester Hinweis + Aufgabe, normal");
gleich(ent({ festVorStunden: 3 }).aktion, "nur_aufgabe", "aus, Hinweis vor 3 h → nur die Aufgabe");
gleich(ent({ festVorStunden: 23.99 }).aktion, "nur_aufgabe", "aus, Hinweis vor 23,99 h → nur die Aufgabe");
gleich(ent({ festVorStunden: 24 }).aktion, "fest_und_aufgabe", "aus, Hinweis vor genau 24 h → wieder ein Hinweis");
gleich(ent({ festVorStunden: 30 }).aktion, "fest_und_aufgabe", "aus, Hinweis vor 30 h → wieder ein Hinweis");
gleich([ent({ festVorStunden: Number.NaN }).aktion, ent({ festVorStunden: -1 }).aktion], ["nur_aufgabe", "nur_aufgabe"], "unklare Stunden (NaN, negativ) → kein zweiter Hinweis");
gleich(ent({ abschluss: true, text: "Ok danke" }).aktion, "still", "„Ok danke“ auf erledigte Sache → still (kein Hinweis, keine Aufgabe)");
gleich([ent({ abschluss: true, text: "Ok, ich kündige trotzdem" }).aktion, ent({ abschluss: true, text: "Ok, ich kündige trotzdem" }).prioritaet], ["fest_und_aufgabe", "hoch"], "Abschluss mit Kündigung → nie still, hoch");
const w = (t: string) => wa.waPrivatWoerter(t);
gleich(w("Hiermit kündige ich meinen Vertrag."), ["Kündigung"], "Kündigung");
gleich([w("Mein Vertrag ist gekündigt?"), w("Bitte stornieren Sie das"), w("Ich will den Vertrag beenden")], [["Kündigung"], ["Kündigung"], ["Kündigung"]], "gekündigt, stornieren, Vertrag beenden → Kündigung");
gleich(w("Danke für die Ankündigung der Rate"), [], "„Ankündigung“ ist keine Kündigung");
gleich([w("Ich widerrufe den Vertrag."), w("Ich trete vom Vertrag zurück")], [["Widerruf"], ["Widerruf"]], "Widerruf und Rücktritt");
gleich([w("Ich will mein Geld zurück"), w("Bitte erstatten Sie mir die 99 Euro")], [["Erstattung"], ["Erstattung"]], "Erstattung");
gleich([w("Ich erstatte Anzeige gegen Sie"), w("Ich erstatte Anzeige."), w("Ich habe Strafanzeige gestellt"), w("Ich werde Anzeige erstatten")], [["Beschwerde"], ["Beschwerde"], ["Beschwerde"], ["Beschwerde"]],
  "„Anzeige erstatten“ (beide Wortfolgen) ist keine Erstattung, sondern eine Beschwerde");
gleich([w("Mein Anwalt ist informiert"), w("Meine Rechtsanwältin schreibt Ihnen")], [["Anwalt"], ["Anwalt"]], "Anwalt, Rechtsanwältin");
gleich([w("Ich werde Sie verklagen"), w("Wir sehen uns vor Gericht")], [["Klage"], ["Klage"]], "verklagen, Gericht → Klage");
gleich([w("An wen ist das gerichtet?"), w("Ich will mich nicht beklagen")], [[], []], "„gerichtet“, „beklagen“ → nichts");
gleich([w("Ich beschwere mich bei der Verbraucherzentrale"), w("Das ist Betrug, ich gehe zur Polizei")], [["Beschwerde"], ["Beschwerde"]], "Beschwerde, Verbraucherzentrale, Betrug, Polizei");
gleich(w("Löschen Sie bitte meine Daten"), ["Löschwunsch"], "Löschwunsch (Datenschutz-Frist)");
gleich(w("Ich kündige und gehe zum Anwalt"), ["Kündigung", "Anwalt"], "mehrere Wörter in fester Reihenfolge");
gleich([ent({ text: "Hiermit kündige ich." }).prioritaet, ent({ text: "Hiermit kündige ich." }).woerter], ["hoch", ["Kündigung"]], "Kündigung → Priorität hoch, Wort dabei");
gleich([ent({ text: "Wo ist meine Karte?" }).prioritaet, ent({ text: "" }).woerter], ["normal", []], "Kartenfrage und leerer Text → normal");
// Übergang beim Umschalten: Mara (noch mit KI) fragte verbindlich nach der Kündigung, er antwortet nur „Ja bitte“.
const RUECKFRAGE = `Das nehme ich gern auf. ${ton.KUENDIGUNG_RUECKFRAGE}`;
gleich(wa.waPrivatWoerterMitFrage("Ja bitte", RUECKFRAGE), ["Kündigung"], "„Ja bitte“ auf Maras verbindliche Kündigungs-Rückfrage → Kündigung");
gleich([ent({ text: "Ja bitte", frageVorher: RUECKFRAGE }).aktion, ent({ text: "Ja bitte", frageVorher: RUECKFRAGE }).prioritaet], ["fest_und_aufgabe", "hoch"], "… dann hoch, mit Hinweis und Aufgabe");
gleich(wa.waPrivatWoerterMitFrage("Ja", "Ihre Kündigung ist aufgenommen. Kann ich sonst noch helfen?"), [], "nur Fragesätze zählen — „Kündigung ist aufgenommen. Kann ich helfen?“ vererbt nichts");
gleich(wa.waPrivatWoerterMitFrage("Ja", "Ihre Kündigung ist aufgenommen."), [], "ohne Frage vererbt nichts");
gleich(wa.waPrivatWoerterMitFrage("Ich wollte eigentlich nur wissen, wann die Karte endlich bei mir ankommen wird", RUECKFRAGE), [], "lange eigene Nachricht erbt nichts aus Maras Frage");
gleich(wa.waPrivatWoerterMitFrage("Ja, und ich will mein Geld zurück", RUECKFRAGE), ["Kündigung", "Erstattung"], "eigene Wörter und die aus der Frage zusammen");
gleich(ent({ abschluss: true, text: "Danke", frageVorher: "Ihre Kündigung ist aufgenommen." }).aktion, "still", "„Danke“ nach erledigter Kündigung (ohne Frage) → still");
// Nachbesserung (Gutachten Kundensicherheit): Stopp-Wünsche und Bestreiten sind „hoch“ und stehen im Titel.
gleich([w("Schreiben Sie mir nicht mehr."), w("Ich will keine Werbung mehr"), w("Lassen Sie mich in Ruhe!"), w("Keine Werbung bitte")],
  [["Stopp"], ["Stopp"], ["Stopp"], ["Stopp"]], "„nicht mehr schreiben“, „keine Werbung (mehr)“, „in Ruhe lassen“ → Stopp");
gleich(w("Ich habe nie etwas beantragt"), ["Bestreitet"], "„nie etwas beantragt“ → Bestreitet");
gleich([w("Werbung für Ihre Karte habe ich gesehen"), w("Ich habe die Karte beantragt")], [[], []], "„Werbung gesehen“, „beantragt“ allein → nichts");
ok(wa.waKontaktStopp("Bitte keine Nachrichten mehr") && wa.waKontaktStopp("Stopp") && !wa.waKontaktStopp("Wo ist meine Karte?") && !wa.waKontaktStopp(""),
  "waKontaktStopp: Stopp-Wunsch ja, Frage nein");
gleich([ent({ text: "Schreiben Sie mir nicht mehr." }).prioritaet, ent({ abschluss: true, text: "Ok, keine Werbung mehr bitte" }).aktion], ["hoch", "fest_und_aufgabe"],
  "Stopp → hoch und nie still (auch als „Ok …“)");
// Abnahme wa#0: zwei Stufen. [echt (STOPP-Bestätigung), Werbe-Widerspruch, waKontaktStopp (Werbesperre + Wort „Stopp“), rein]
const stufen = (t: string) => [wa.waKontaktStoppEcht(t), wa.waWerbeWiderspruch(t), wa.waKontaktStopp(t), wa.waWerbeWiderspruchRein(t)];
gleich(stufen("Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp."), [false, false, false, false],
  "wa#0 (1): „Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp.“ → kein WhatsApp-Stopp, keine Werbesperre (Telefonsperre: Eingang + E-408)");
gleich(stufen("Ist das keine Werbung?"), [false, false, false, false], "wa#0 (2): „Ist das keine Werbung?“ (reine Frage) → nichts");
gleich(stufen("Ich möchte keine Werbung, nur meine Karte aktivieren. Wie geht das?"), [false, true, true, false],
  "wa#0 (3): „Ich möchte keine Werbung, nur meine Karte aktivieren. Wie geht das?“ → Werbesperre ja, Kontakt-Stopp nein, nicht rein (fester Hinweis)");
gleich([stufen("Bitte rufen Sie mich nicht mehr an."), stufen("Keine Anrufe mehr bitte.")], [[false, false, false, false], [false, false, false, false]],
  "reiner Anruf-Stopp („Bitte rufen Sie mich nicht mehr an.“, „Keine Anrufe mehr bitte.“) → kein WhatsApp-Stopp (dafür E-408)");
gleich([w("Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp."), w("Bitte rufen Sie mich nicht mehr an."), w("Ist das keine Werbung?")], [["Anrufstopp"], ["Anrufstopp"], []],
  "… kein „Stopp“ im Titel, dafür „Anrufstopp“ — der Mensch, der die Aufgabe liest, ruft ihn nicht an");
gleich([ent({ text: "Bitte nicht mehr anrufen. Wann kommt meine Karte?" }).prioritaet, w("Warum rufen Sie mich nicht an?"), w("Sie haben mich nicht angerufen.")], ["hoch", [], []],
  "Anrufstopp → hoch; „Warum rufen Sie mich nicht an?“ und die Klage über die Vergangenheit sind keiner (derselbe Erkenner wie der Eingang)");
gleich(w("Bitte nicht mehr anrufen und nicht mehr schreiben."), ["Stopp", "Anrufstopp"], "beides gewünscht → beide Wörter");
for (const t of ["Schreiben Sie mir nicht mehr.", "Bitte keine Nachrichten mehr. Danke", "Lassen Sie mich in Ruhe!", "Stopp", "Stopp\nDanke",
  "Bitte nicht mehr anrufen und nicht mehr schreiben.", "schick mir keine E-Mails mehr, wann kommt die Karte?"]) {
  gleich(stufen(t).slice(0, 3), [true, false, true], `Gegenprobe echter Kontakt-Stopp: „${t.replace("\n", " ⏎ ")}“ → STOPP-Bestätigung + Werbesperre`);
}
gleich([stufen("Keine Werbung bitte"), stufen("Ich will keine Werbung mehr"), stufen("Hallo, ich möchte keine Werbung mehr bekommen. Danke!")],
  [[false, true, true, true], [false, true, true, true], [false, true, true, true]], "reiner Werbe-Widerspruch → Werbesperre, kurze Werbe-Bestätigung (rein), nie STOPP");
gleich([stufen("Keine Werbung. Wann kommt meine Karte?"), stufen("Keine Werbung\nWann kommt meine Karte?"), stufen("Keine Werbung, aber meine Karte geht nicht")],
  [[false, true, true, false], [false, true, true, false], [false, true, true, false]], "Werbe-Widerspruch mit Anliegen (auch in einer zweiten Nachricht) → Werbesperre, fester Hinweis");
gleich([stufen("Das ist keine Werbung."), stufen("Ich habe keine Werbung bekommen."), stufen("Ich möchte wissen, ob das keine Werbung ist")],
  [[false, false, false, false], [false, false, false, false], [false, false, false, false]], "Feststellung oder versteckte Frage („ist keine Werbung“, „habe keine Werbung bekommen“) → nichts");
// wa#0: Was ohne KI hinausgeht — nachgerechnet wie der Weg (Werbesperre in dieser Runde neu gesetzt).
{
  const raus = (t: string, festVorStunden: number | null = null) => {
    const e0 = ent({ text: t, festVorStunden });
    const echt = wa.waKontaktStoppEcht(t), werbe = !echt && wa.waWerbeWiderspruch(t);
    return wa.waPrivatAntwortText({ aktion: e0.aktion, stopp: echt, werbung: werbe && wa.waWerbeWiderspruchRein(t), letzteMara: null });
  };
  const STOPP = wa.waPrivatAntwortText({ aktion: "nur_aufgabe", stopp: true });
  gleich([raus("Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp."), raus("Ist das keine Werbung?"), raus("Ich möchte keine Werbung, nur meine Karte aktivieren. Wie geht das?")],
    [wa.WA_PRIVAT_AUS_TEXT, wa.WA_PRIVAT_AUS_TEXT, wa.WA_PRIVAT_AUS_TEXT], "wa#0: die drei Sätze bekommen den festen Hinweis — nie „hier auf WhatsApp schreiben wir Ihnen nicht mehr“");
  gleich([raus("Ist das keine Werbung?", 3), raus("Ich möchte keine Werbung, nur meine Karte aktivieren. Wie geht das?", 3)], [null, null], "… innerhalb der 24 Stunden gar kein Satz (nur die Aufgabe)");
  gleich([raus("Schreiben Sie mir nicht mehr.", 3), raus("Keine Werbung bitte", 3)], [STOPP, wa.WA_PRIVAT_WERBUNG_TEXT], "echter Stopp → STOPP-Bestätigung, reiner Werbe-Widerspruch → Werbe-Bestätigung (beide auch innerhalb der 24 Stunden)");
}
// Prüfung 25.11.2026 (3): „keine Nachrichten/E-Mails mehr“ je Teilsatz — Fragen und Feststellungen sind kein Kontakt-Stopp.
for (const t of ["Warum bekomme ich keine Nachrichten mehr?", "Ich bekomme keine E-Mails mehr", "Kriege ich keine Nachrichten mehr von euch?",
  // Abnahme Runde 3 (stufe2, vorgezogen): „angekommen“ ist eine Feststellung, kein Stopp.
  "Keine Mails mehr angekommen", "Bei mir sind keine Nachrichten mehr angekommen"]) {
  gleich([...stufen(t), w(t).includes("Stopp")], [false, false, false, false, false], `Prüfung (3a): „${t}“ → kein Kontakt-Stopp, keine Werbesperre, kein „Stopp“ in der Aufgabe`);
}
// Gegenprüfung Runde 4: „(an)gekommen“ VOR der Stopp-Wendung gehört zu etwas anderem — echte Stopps ohne Satzzeichen bleiben Stopps.
for (const t of ["Es ist nie Geld gekommen schreiben Sie mir nicht mehr", "Mir ist nie eine Karte gekommen keine Nachrichten mehr",
  "Bitte keine Nachrichten mehr, ist alles angekommen", "Keine Nachrichten mehr! Ist angekommen."]) {
  ok(wa.waKontaktStoppEcht(t) === true, `Runde 4: „${t}“ bleibt ein Kontakt-Stopp`);
}
gleich([stufen("Ich erhalte keine Mails mehr von Ihnen, was ist los?")[0], stufen("Es kommen keine Nachrichten mehr an")[0], stufen("Seit gestern keine E-Mails mehr")[0],
  stufen("Ich verstehe nicht, dass ich keine E-Mails mehr bekomme")[0], stufen("Warum keine Nachrichten mehr")[0]], [false, false, false, false, false],
  "… ebenso „erhalte … mehr, was ist los?“, „es kommen keine … mehr an“, „seit gestern …“, „verstehe nicht, dass ich … bekomme“, „warum …“ ohne Fragezeichen");
gleich([stufen("Bitte keine\nNachrichten mehr")[0], stufen("Ich will keine\nE-Mails mehr!")[0]], [true, true],
  "Prüfung (3b): ein Stopp-Satz über einen Zeilenumbruch („Bitte keine⏎Nachrichten mehr“) ist wieder ein Kontakt-Stopp (wie vor der Teilung je Zeile)");
gleich([stufen("Bitte nicht mehr anrufen oder schreiben").slice(0, 3), stufen("Nicht mehr anrufen und schreiben!").slice(0, 3), w("Bitte nicht mehr anrufen oder schreiben")],
  [[true, false, true], [true, false, true], ["Stopp", "Anrufstopp"]],
  "Prüfung (3c): „Bitte nicht mehr anrufen oder schreiben“, „Nicht mehr anrufen und schreiben!“ → Kontakt-Stopp (das gemeinsame „nicht mehr“ bleibt), Stopp + Anrufstopp");
gleich([stufen("Bitte nicht mehr anrufen, und schreiben Sie mir lieber per WhatsApp")[0], stufen("Nicht mehr anrufen, schreiben Sie mir bitte hier")[0]], [false, false],
  "… aber „nicht mehr anrufen, und schreiben Sie mir lieber per WhatsApp“ bleibt ein reiner Anruf-Stopp");
for (const t of ["Ich möchte keine Nachrichten mehr bekommen", "Ich möchte, dass ich keine Nachrichten mehr bekomme", "Können Sie mir bitte keine E-Mails mehr schicken?",
  "Schick mir keine E-Mails mehr.", "Bitte keine Nachrichten mehr, ich bekomme zu viele", "Ich bekomme ständig Nachrichten, ich will keine Nachrichten mehr"]) {
  gleich(stufen(t)[0], true, `Gegenprobe (3): „${t}“ bleibt ein Kontakt-Stopp (Wunschwort, höfliche Bitte oder eigener Teilsatz ohne Frage)`);
}
gleich([stufen("Hören Sie auf, mich anzurufen!")[0], w("Hören Sie auf, mich anzurufen!"), stufen("Hören Sie auf mich anzurufen und zu nerven!")[0]], [false, ["Anrufstopp"], true],
  "„Hören Sie auf, mich anzurufen!“ ist nur ein Anruf-Stopp (abstreitenArt nennt es „in_ruhe“); „… und zu nerven“ ist ein Kontakt-Stopp");
ok(ton.stoppWunsch("Ich bekomme keine E-Mails mehr") && wa.waStoppWunschEcht("Ich bekomme keine E-Mails mehr") === false
  && /const STOPP_WUNSCH_ALLE = STOPP_WUNSCH\.map\(/.test(readFileSync(new URL("../server/lib/fiaon-whatsapp-mara.ts", import.meta.url), "utf8")),
  "STOPP_WUNSCH (shared) unverändert — die Teilsatz-Regel ist lokal in fiaon-whatsapp-mara.ts (waStoppWunschEcht, aus denselben Mustern)");
gleich([w("Wer sind Sie? Woher haben Sie meine Nummer?"), w("Wer sind Sie?"), w("Woher haben Sie meine Nummer?")], [["Datenauskunft"], ["Datenauskunft"], ["Datenauskunft"]],
  "wa#6: „Wer sind Sie?“, „Woher haben Sie meine Nummer?“ → Datenauskunft (hoch, Frist Art. 15 DSGVO)");
gleich([ent({ text: "Wer sind Sie? Woher haben Sie meine Nummer?" }).prioritaet, w("Ich brauche eine Auskunft zu meiner Karte")], ["hoch", []], "… Priorität hoch; „Auskunft“ allein (Bonitätsauskunft) ist keine Datenauskunft");

// ── D. Titel ────────────────────────────────────────────────────────────────
abschnitt("D. Titel: das Wort steht drin, nie zurückgestuft");
const NORMAL = "WhatsApp Privat: Anliegen ohne KI — bitte übernehmen";
gleich(wa.waPrivatTitel(null, []), NORMAL, "normal");
gleich(wa.waPrivatTitel(null, ["Kündigung"]), "WhatsApp Privat: Kündigung — bitte jetzt übernehmen", "Kündigung im Titel");
gleich(wa.waPrivatTitel(NORMAL, ["Anwalt"]), "WhatsApp Privat: Anwalt — bitte jetzt übernehmen", "offene normale Aufgabe wird hoch, wenn „Anwalt“ kommt");
gleich(wa.waPrivatTitel("WhatsApp Privat: Kündigung — bitte jetzt übernehmen", []), "WhatsApp Privat: Kündigung — bitte jetzt übernehmen", "eine normale Folgenachricht stuft nicht zurück");
gleich(wa.waPrivatTitel("WhatsApp Privat: Anwalt — bitte jetzt übernehmen", ["Kündigung"]), "WhatsApp Privat: Kündigung, Anwalt — bitte jetzt übernehmen", "alte und neue Wörter zusammen, feste Reihenfolge");
ok(wa.waPrivatTitel(null, [...wa.WA_PRIVAT_WOERTER]).length <= 160, "alle Wörter zusammen ≤ 160 Zeichen (Grenze der Aufgabe)");

// ── E. Text der Aufgabe ─────────────────────────────────────────────────────
abschnitt("E. Text der Aufgabe: seine Nachricht, was zu tun ist");
{
  const t = wa.waPrivatAufgabeText({ zitate: [{ text: "Ich kündige zum nächsten Termin.", am: new Date("2026-11-25T13:03:00Z") }], woerter: ["Kündigung"], hinweisGeschickt: true });
  ok(t.includes("25.11. 14:03") && t.includes("„Ich kündige zum nächsten Termin.“"), "seine Nachricht mit Berliner Uhrzeit");
  ok(/Darin: Kündigung/.test(t) && /in der Akte aufnehmen und schriftlich bestätigen/.test(t), "Kündigung: was zu tun ist (die Aufgabe ersetzt das Werkzeug)");
  ok(/per E-Mail antworten/.test(t) && /WhatsApp-Raum/.test(t), "in der Hinweis-Runde: wie geantwortet wird");
  const t2 = wa.waPrivatAufgabeText({ zitate: [{ text: "Hallo?", am: "2026-11-25T15:00:00Z" }], woerter: [], hinweisGeschickt: false });
  ok(!/Darin:/.test(t2) && !/per E-Mail antworten/.test(t2) && t2.includes("„Hallo?“"), "Folgenachricht ohne Hinweis-Runde: nur die Nachricht (kurz)");
  const lang = wa.waPrivatAufgabeText({ zitate: Array.from({ length: 20 }, (_, i) => ({ text: `Nachricht ${i} `.repeat(80), am: null })), woerter: [...wa.WA_PRIVAT_WOERTER], hinweisGeschickt: true });
  ok(lang.length <= 3000, `lange Nachrichten bleiben unter 3000 Zeichen (${lang.length})`);
  ok(!/@/.test(t) && !/\+49/.test(t), "keine Adresse, keine Nummer im Text selbst");
  const t3 = wa.waPrivatAufgabeText({ zitate: [{ text: "Ja bitte", am: null }], woerter: ["Kündigung"], hinweisGeschickt: true, frage: "Soll ich Ihre Kündigung jetzt verbindlich aufnehmen? Dann antworten Sie bitte mit Ja." });
  ok(/Antwort auf Maras Frage: „Soll ich Ihre Kündigung/.test(t3) && /Darin: Kündigung/.test(t3), "kam das Wort aus Maras Frage, steht die Frage dabei (sonst versteht niemand das „Ja“)");
  // Abnahme: wa#5 (Mensch im Gespräch), wa#6 (belegte Herkunft), wa#3 (offene Sache bei Justin).
  const t4 = wa.waPrivatAufgabeText({ zitate: [{ text: "Und wie geht es weiter?", am: null }], woerter: [], hinweisGeschickt: false, menschImGespraech: true });
  ok(/in den letzten 48 Stunden auf WhatsApp geschrieben/.test(t4) && /kein fester Hinweis/.test(t4) && /WhatsApp-Raum weiterführen/.test(t4) && !/per E-Mail antworten/.test(t4),
    "wa#5: schreibt gerade ein Mensch mit ihm → die Aufgabe sagt es (kein Hinweis, im WhatsApp-Raum weiterführen)");
  const H = { satz: "Ihre Nummer wurde am 12. Oktober bei einem Antrag auf unserer Internetseite eingetragen", belegt: true };
  const t5 = wa.waPrivatAufgabeText({ zitate: [{ text: "Wer sind Sie?", am: null }], woerter: ["Datenauskunft"], hinweisGeschickt: true, herkunft: H });
  ok(/Darin: Datenauskunft/.test(t5) && /Art\. 15 DSGVO/.test(t5) && t5.includes(`Belegte Herkunft für die Antwort: „${H.satz}.“`), "wa#6: „Wer sind Sie?“ → Datenauskunft, Frist, belegte Herkunft für die Antwort");
  const t6 = wa.waPrivatAufgabeText({ zitate: [{ text: "Wer sind Sie?", am: null }], woerter: ["Datenauskunft"], hinweisGeschickt: true, herkunft: { satz: "Ihre Nummer ist bei uns gespeichert", belegt: false } });
  ok(/nicht sicher belegt/.test(t6) && !/Belegte Herkunft/.test(t6), "… ist die Herkunft nicht belegt, steht das da (nichts vermuten)");
  ok(!/Herkunft/.test(wa.waPrivatAufgabeText({ zitate: [{ text: "Wo ist meine Karte?", am: null }], woerter: [], hinweisGeschickt: true, herkunft: H })), "… ohne Datenauskunft keine Herkunftszeile");
  const t7 = wa.waPrivatAufgabeText({ zitate: [{ text: "Und?", am: null }], woerter: [], hinweisGeschickt: true, offeneSachen: ["Kartenlink", "Kartenlink"] });
  ok(/Offen bei Justin \(Kartenlink\): dazu nichts zusagen und nicht selbst entscheiden\./.test(t7), "wa#3: liegt bei Justin eine andere Sache offen, warnt die Aufgabe (einmal genannt)");
  // Prüfung 25.11.2026: Anruf-Satz statt Hinweis (E-408 lief weiter) und die Karte auf „später“ (wa#3).
  const t8 = wa.waPrivatAufgabeText({ zitate: [{ text: "Ich kündige meinen Vertrag. Bitte rufen Sie mich nicht mehr an.", am: null }], woerter: ["Kündigung", "Anrufstopp"],
    hinweisGeschickt: false, anrufSatz: true });
  ok(t8.includes("Er bekommt „Verstanden – wir rufen Sie nicht mehr an.“") && /schriftlich beantworten: per E-Mail/.test(t8) && /Darin: Kündigung, Anrufstopp\./.test(t8)
    && /in der Akte aufnehmen und schriftlich bestätigen/.test(t8) && /bitte nicht anrufen, nur schriftlich antworten/.test(t8) && !/Er bekommt den festen Hinweis/.test(t8),
    "Prüfung (1): Kündigung + Anruf-Stopp → die Aufgabe nennt den Anruf-Satz, die Kündigung (aufnehmen, schriftlich bestätigen) und „nicht anrufen“");
  const t9 = wa.waPrivatAufgabeText({ zitate: [{ text: "Und? Was ist jetzt?", am: null }], woerter: [], hinweisGeschickt: false, karteSpaeter: "Widerruf", offeneSachen: ["Widerruf", "Kartenlink"] });
  ok(/Seine Sache liegt als Karte bei Justin \(Widerruf\), steht dort aber auf „später“ — darum auch diese Aufgabe: nichts zusagen, keine Zahlungsbitte, nicht selbst entscheiden\./.test(t9)
    && /Offen bei Justin \(Kartenlink\): /.test(t9) && !/Offen bei Justin \([^)]*Widerruf/.test(t9),
    "Prüfung (2): Karte auf „später“ → die Aufgabe sagt es (nichts zusagen, nicht selbst entscheiden); andere offene Sachen weiter, der Widerruf nicht doppelt");
}

// ── F. Der feste Hinweis ────────────────────────────────────────────────────
abschnitt("F. Der feste Hinweis gegen die Wände");
const FEST = wa.WA_PRIVAT_AUS_TEXT;
gleich(FEST, "Vielen Dank für Ihre Nachricht. Wir beantworten Ihr Anliegen schriftlich per E-Mail. Bei Fragen zu Ihrem Vertrag schreiben Sie uns bitte an support@fiaon.com.", "Wortlaut wie beauftragt");
gleich(sendePruefung(FEST), [], "sendePruefung leer — waSenden schickt ihn (Inkasso, Wortwand, Du-Form, Länge)");
ok(!ton.tonPruefung(FEST, { kanal: "whatsapp", land: "DE", kunde: "" }).some((b) => b.schwere === "hart")
  && !ton.tonPruefung(FEST, { kanal: "whatsapp", land: "AT", kunde: "" }).some((b) => b.schwere === "hart"), "Tonprüfung DE und AT ohne harten Treffer");
ok(!/(?<![\p{L}])(?:heute|morgen|gleich|sofort|umgehend|innerhalb|stunden?|tag(?:en)?|woche|meldet|melden\s+uns|ruf\w*\s+(?:\S+\s+)?an|zurückruf\w*)(?![\p{L}])/iu.test(FEST), "keine Zeit-Zusage (heute, morgen, meldet sich, ruft an …)");
ok(!/bis\s+zu|garantiert|festpreis|bank|institut/i.test(FEST), "kein „bis zu“, „garantiert“, „Festpreis“, kein Bank-Satz");
ok(/\bIhre?\b/.test(FEST) && /\bSie\b/.test(FEST), "Sie-Form");
ok(wa.zusageTreffer(FEST) === null, "keine Zusage im Sinne der Zusage-Wand");
ok(wa.istWaPrivatHinweis(FEST) && wa.istWaPrivatHinweis(` ${FEST} `) && !wa.istWaPrivatHinweis("Vielen Dank für Ihre Nachricht."), "istWaPrivatHinweis erkennt genau den festen Hinweis");
ok(!wa.istRueckfall(FEST), "kein Rückfallsatz (die Rückfall-Regeln greifen nicht)");
ok(wa.WA_PRIVAT_HINWEIS_STUNDEN === 24, "höchstens 1× je 24 Stunden");
// Nachbesserung: Wer keinen Kontakt will, bekommt die STOPP-Bestätigung — nie den E-Mail-Hinweis; nie zweimal hintereinander.
{
  const stopp = wa.waPrivatAntwortText({ aktion: "nur_aufgabe", stopp: true, letzteMara: null });
  ok(!!stopp && /^Verstanden, hier auf WhatsApp schreiben wir Ihnen nicht mehr\./.test(stopp) && stopp !== FEST, "Stopp-Wunsch → STOPP-Bestätigung (auch innerhalb der 24 Stunden), nicht der E-Mail-Hinweis");
  ok(wa.waPrivatAntwortText({ aktion: "fest_und_aufgabe", stopp: true, letzteMara: stopp }) === null, "STOPP-Bestätigung steht schon als letzte Nachricht → keine zweite");
  ok(wa.waPrivatAntwortText({ aktion: "fest_und_aufgabe", stopp: false }) === FEST && wa.waPrivatAntwortText({ aktion: "nur_aufgabe", stopp: false }) === null
    && wa.waPrivatAntwortText({ aktion: "still", stopp: true }) === null, "sonst: fester Hinweis nach der 24-Stunden-Regel, still bleibt still");
  gleich(sendePruefung(String(stopp)), [], "die STOPP-Bestätigung besteht sendePruefung");
  ok(wa.zusageTreffer(String(stopp)) === null && !/(?<![\p{L}])(?:heute|morgen|meldet|ruf\w*\s+(?:\S+\s+)?an)(?![\p{L}])/iu.test(String(stopp)), "… ohne Zusage und ohne Zeit");
}
// Abnahme wa#0: die kurze Werbe-Bestätigung (wie E-264 bei Stufe B) — nur für den reinen Werbe-Widerspruch.
{
  const W = wa.WA_PRIVAT_WERBUNG_TEXT;
  gleich(W, "Verstanden – Sie bekommen von uns keine Werbung mehr.", "Wortlaut der Werbe-Bestätigung");
  ok(/keine Werbung mehr\.$/.test(W) && !/schreiben wir Ihnen nicht mehr/i.test(W), "… wie E-264 bei Stufe B nur „keine Werbung mehr“, nie „wir schreiben Ihnen nicht mehr“");
  ok(!ton.nachAbstreiten(W) && ton.nachAbstreiten("Entschuldigen Sie bitte die Störung. Sie bekommen von uns ab jetzt keine Werbung mehr."),
    "… und NICHT die Marke von nachAbstreiten (sonst liefe seine nächste Nachricht als „nach der Entschuldigung“: still, Karte „bestreitet“)");
  gleich(sendePruefung(W), [], "Werbe-Bestätigung besteht sendePruefung");
  ok(!ton.tonPruefung(W, { kanal: "whatsapp", land: "DE", kunde: "" }).some((b) => b.schwere === "hart")
    && !ton.tonPruefung(W, { kanal: "whatsapp", land: "AT", kunde: "" }).some((b) => b.schwere === "hart"), "Werbe-Bestätigung: Tonprüfung DE und AT ohne harten Treffer");
  ok(wa.zusageTreffer(W) === null && !/(?<![\p{L}])(?:heute|morgen|gleich|meldet|melden\s+uns|ruf\w*\s+(?:\S+\s+)?an|schreiben\s+wir\s+ihnen\s+nicht)(?![\p{L}])/iu.test(W), "… ohne Zusage, ohne Zeit, ohne „schreiben wir Ihnen nicht mehr“");
  ok(wa.waPrivatAntwortText({ aktion: "nur_aufgabe", stopp: false, werbung: true }) === W && wa.waPrivatAntwortText({ aktion: "fest_und_aufgabe", stopp: false, werbung: true, letzteMara: W }) === null,
    "Werbe-Bestätigung auch innerhalb der 24 Stunden, aber nie zweimal hintereinander");
  ok(wa.waPrivatAntwortText({ aktion: "nur_aufgabe", stopp: true, werbung: true })?.startsWith("Verstanden, hier auf WhatsApp") === true && wa.waPrivatAntwortText({ aktion: "still", stopp: false, werbung: true }) === null,
    "echter Kontakt-Stopp geht vor; still bleibt still");
}
// Prüfung 25.11.2026 (1): der Anruf-Satz, wenn E-408 ohne KI weiterlief (Anruf-Stopp + etwas Heikles).
{
  const { ANRUF_SPERRE_WA: A } = await import("../shared/fiaon-ja-zum-anruf");
  const at = (o: { aktion: "fest_und_aufgabe" | "nur_aufgabe" | "still"; stopp?: boolean; letzteMara?: string | null }) =>
    wa.waPrivatAntwortText({ aktion: o.aktion, stopp: !!o.stopp, anruf: true, letzteMara: o.letzteMara ?? null });
  gleich([at({ aktion: "fest_und_aufgabe" }), at({ aktion: "nur_aufgabe" })], [A, A], "Anruf-Satz statt des festen Hinweises — auch innerhalb der 24 Stunden (wie E-408)");
  gleich([at({ aktion: "fest_und_aufgabe", letzteMara: A }), at({ aktion: "nur_aufgabe", letzteMara: A })], [FEST, null], "… nie zweimal hintereinander (dann wieder die 24-Stunden-Regel des Hinweises)");
  ok(at({ aktion: "nur_aufgabe", stopp: true })?.startsWith("Verstanden, hier auf WhatsApp") === true && at({ aktion: "still" }) === null,
    "… der echte Kontakt-Stopp geht vor (er will auch keine WhatsApp mehr); still bleibt still");
  gleich(sendePruefung(A), [], "der Anruf-Satz besteht sendePruefung (derselbe Satz wie E-408 mit KI)");
}

// ── G. Einordnung der Aufgabe (fremde Regeln, nur gelesen) ──────────────────
abschnitt("G. Die Aufgabe „privat“ schließt nur ein Mensch");
{
  const z = { schluessel: "wa-12345-privat-2026-11-25", quelle: "mara-whatsapp", titel: "WhatsApp Privat: Kündigung — bitte jetzt übernehmen", text: "WhatsApp Privat ohne KI — er schreibt: „Ich kündige.“" };
  gleich(arten.auftragArtVon(z), "mara_aufgabe", "Schlüssel wa-…-privat-… → „Aufgabe von Mara“ (kein Kontakt schließt sie)");
  ok(arten.maraWaAntwortSchliesst({ ...z, art: "mara_aufgabe" }) === false, "Maras fester Hinweis schließt sie nie (maraWaAntwortSchliesst)");
  const n = { ...z, schluessel: "wa-n4915500000000-privat-2026-11-25" };
  gleich(arten.auftragArtVon(n), "mara_aufgabe", "auch ohne Person (Schlüssel mit Nummer)");
}

// ── H. Quelltext ────────────────────────────────────────────────────────────
abschnitt("H. Quelltext: Reihenfolge, kein Modell, Aufgabe vor Hinweis");
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const q = ohneKommentare(readFileSync(new URL("../server/lib/fiaon-whatsapp-mara.ts", import.meta.url), "utf8"));
const rumpf = (name: string) => { const i = q.indexOf(name); return i < 0 ? "" : q.slice(i, q.indexOf("\n}\n", i)); };
const antwort = rumpf("export async function maraAntwortet(");
const pos = (s: string) => antwort.indexOf(s);
// Nachbesserung (Gutachten Kundensicherheit): Der Schalter wird früh gelesen, der Weg ohne KI läuft aber erst NACH den festen
// Schutzwegen ohne KI (E-264 Abstreiten/Löschwunsch/Werbesperre, E-372 Recht/Widerruf/Erstattung → Karte für Justin).
const s = pos("const waPrivatRoh = await waPrivatSchalter()");
const p = pos("waPrivatOhneKi(");
ok(s > 0 && p > 0, "maraAntwortet liest den Schalter einmal und ruft waPrivatOhneKi");
ok(s > pos("globalKundeWa(Number(personId))") && s > pos("mb.businessKontakt(") && s > pos("mb.maraBusinessAntwortet(") && s > pos("istStopp(neuesteRein.text") && s > pos("fensterOffen(nummer)"),
  "… NACH Global-Kunde, Mara Business, STOPP und Fenster (Business bleibt unverändert)");
ok(p > pos("abstreitenArt(") && p > pos("abstreitenBeantworten(") && p > pos("werbesperreSetzen(") && p > pos("waEntscheidungVorab(") && p > pos("weg: { weg: \"karte\", fall,"),
  "der Weg ohne KI läuft NACH den festen Schutzwegen: Abstreiten, Löschwunsch, Werbesperre, Recht/Widerruf/Erstattung mit Karte für Justin");
ok(p < pos("await kiPausiert()") && p < pos("lageFuer(") && p < pos("entwerfen("), "… und VOR der KI-Pause, der Lage und dem Modell");
ok(/if \(privatOhneKi\) \{\s*const ohneKi = await waPrivatOhneKi\(/.test(antwort), "nur bei „aus“");
// Abnahme wa#0: E-408 läuft auch ohne KI — nur der Dank entfällt, die Telefonsperre bestätigt weiter ANRUF_SPERRE_WA.
ok(!/if \(!privatOhneKi\) \{\s*const autoIds = new Set\(urteil\.autoIds\);\s*const echteOffeneJa/.test(antwort), "wa#0: keine Wache mehr um den ganzen E-408-Block");
ok(/if \(!privatOhneKi && ja && echteIds\.length > 0 && echteIds\.every\(\(id\) => ja\.gespeichertIds\.includes\(id\)\)\) \{\s*await vorbereiten\(nummer, JA_DANKE_WA,/.test(antwort),
  "ohne KI kein Dank-Satz auf das Ja zum Anruf (E-408 — gespeichert hat es der Eingang)");
{
  // Prüfung 25.11.2026 (1): Der Sperrzweig endet ohne KI nur bei reinem Anruf-Stopp (waAnrufSperreFrueh, Abschnitt J).
  ok(/const sperreAlle = !!\(ja && echteIds\.length > 0 && echteIds\.every\(\(id\) => ja\.sperreIds\.includes\(id\)\) && !seineWorte\.includes\("\?"\)\);/.test(antwort)
    && /const nurSperre = waAnrufSperreFrueh\(\{ privatOhneKi, text: seineWorte, frageVorher: letzteMaraText \?\? null \}\);/.test(antwort),
    "Prüfung (1): Sperrzweig = alle offenen Nachrichten verlangen die Sperre (ohne „?“) UND waAnrufSperreFrueh (ohne KI: nichts Heikles daneben)");
  const sperre = antwort.search(/if \(sperreAlle && nurSperre\) \{\s*await vorbereiten\(nummer, ANRUF_SPERRE_WA,/);
  ok(sperre > 0 && sperre < p && sperre > s, "wa#0: der Sperrzweig (ANRUF_SPERRE_WA, „Bitte rufen Sie mich nicht mehr an.“) steht OHNE KI-Wache nach dem Schalter und vor waPrivatOhneKi");
  ok(sperre < antwort.indexOf("istLoeschwunsch(seinText") && sperre < pos("waEntscheidungVorab(") && sperre < pos("abstreitenBeantworten("),
    "… und VOR E-264 (Löschwunsch, Abstreiten) und E-372 (Recht, Widerruf, Geld zurück) — läuft er ohne KI weiter, übernehmen die");
  ok(/anrufSatzOhneKi = privatOhneKi && sperreAlle;/.test(antwort) && /herkunft: herkunftBeleg, anrufSperre: anrufSatzOhneKi \}\)/.test(antwort),
    "… lief er weiter, bekommt der Weg ohne KI anrufSperre (dann der Anruf-Satz statt des festen Hinweises)");
  const jz = await import("../shared/fiaon-ja-zum-anruf");
  ok(["Bitte rufen Sie mich nicht mehr an.", "Keine Anrufe mehr bitte.", "Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp."].every((t) => jz.istAnrufSperreWunsch(t))
    && jz.ANRUF_SPERRE_WA === "Verstanden – wir rufen Sie nicht mehr an.",
    "… diese Sätze sperrt der Eingang (istAnrufSperreWunsch) — mit Schalter aus kommt jetzt wieder „Verstanden – wir rufen Sie nicht mehr an.“ statt der STOPP-Bestätigung");
  ok(/if \(!privatOhneKi\) \{\s*jaFrageZuletzt = /.test(antwort), "… nur der Hinweis fürs Modell (jaHinweis, jaFrageZuletzt) braucht die KI");
}
ok(/if \(urteil\.art === "abschluss" && !privatOhneKi\)/.test(antwort), "ohne KI kein warmer Abschluss-Satz (waPrivatOhneKi schweigt auf ein reines „Ok danke“)");
const neuWeg = rumpf("async function waPrivatOhneKi(");
ok(!!neuWeg && !/kiAufruf\(|denken\(|entwerfen\(|werkzeugAusfuehren\(|lageFuer\(/.test(neuWeg), "der neue Weg ruft kein Modell und kein Werkzeug");
ok(/aufgabeFuerMenschen\([^;]*"privat"/.test(neuWeg) && neuWeg.indexOf("aufgabeFuerMenschen(") < neuWeg.indexOf("vorbereiten("), "erst die Aufgabe (Klasse „privat“), dann der Hinweis — nie ein Hinweis ohne Aufgabe");
ok(/vorbereiten\(ein\.nummer, satz,/.test(neuWeg) && /const satz = waPrivatAntwortText\(/.test(neuWeg) && /stillSetzen\(ein\.nummer, aufId\)/.test(neuWeg),
  "fester Satz (Hinweis oder STOPP-Bestätigung) über den vorhandenen Sendeweg (vorbereiten → Versandtakt mit Fenster-Prüfung), sonst still");
ok(/werbesperreSetzen\(Number\(ein\.personId\)\)/.test(neuWeg) && neuWeg.indexOf("werbesperreSetzen(") < neuWeg.indexOf("vorbereiten("),
  "Stopp-Wunsch: die Werbesperre steht, bevor die Bestätigung bereitliegt");
ok(/const kontaktStopp = waKontaktStoppEcht\(seinText\);/.test(neuWeg) && /const stopp = kontaktStopp \|\| werbeStopp;/.test(neuWeg)
  && /waPrivatAntwortText\(\{ aktion: e\.aktion, stopp: kontaktStopp, werbung,/.test(neuWeg) && /const werbung = werbeStopp && sperreNeu && waWerbeWiderspruchRein\(seinText\);/.test(neuWeg),
  "wa#0: Werbesperre bei Kontakt-Stopp ODER Werbe-Widerspruch, STOPP-Bestätigung nur beim echten Kontakt-Stopp, Werbe-Bestätigung nur rein und mit frisch gesetzter Sperre");
ok(/const karteFall = ein\.entscheidungsFall \?\? waPrivatOffeneKarte\(ein\.offeneKarten \?\? \[\]\);/.test(neuWeg)
  && /if \(karteFall\) \{[\s\S]*?uebergeben\(\{[\s\S]*?weg: \{ weg: "karte", fall,/.test(neuWeg),
  "schreibt er zu einer offenen Karte für Justin weiter (mit Schlüsselwort ODER ohne, wa#3): die Karte bekommt die Nachricht (keine Betreuer-Aufgabe)");
ok(/Nichts zusagen, keine Zahlungsbitte, nicht selbst entscheiden\./.test(neuWeg), "… geht die Karte nicht, steht die Warnung in der Rückfall-Aufgabe");
ok(/const satz = waPrivatAntwortText\(\{ aktion: e\.aktion, stopp: kontaktStopp, werbung, anruf: !!ein\.anrufSperre, letzteMara: ein\.frageVorher \}\);/.test(neuWeg)
  && /anrufSatz: hinweis && satz === ANRUF_SPERRE_WA/.test(neuWeg),
  "Prüfung (1): der Weg ohne KI schickt bei anrufSperre den Anruf-Satz und sagt es in der Aufgabe");
ok(/karte: \{ kunde: seinText, mara: hinweis \? satz : null, grund: waPrivatKarteGrund\(e\.woerter\) \}/.test(neuWeg),
  "Prüfung (2): beim Auffrischen der Karte der Warn-Beleg „Folge-Nachricht — darin: …“ (karte.grund)");
ok(/karteSpaeter = await waKarteVerborgen\(\(ein\.offeneKarten \?\? \[\]\)\.find\(\(x\) => x\.fall === fall\)\?\.id\);/.test(neuWeg)
  && /if \(\(!karteFall \|\| karteSpaeter\) && neu\.length\) \{/.test(neuWeg) && /if \(!karteSpaeter\) for \(const v of neu\) waPrivatGemeldet\.add/.test(neuWeg)
  && neuWeg.indexOf("waKarteVerborgen(") < neuWeg.indexOf("aufgabeFuerMenschen(") && neuWeg.indexOf("aufgabeFuerMenschen(") < neuWeg.indexOf("vorbereiten("),
  "Prüfung (2): steht die Karte auf „später“, bekommt zusätzlich die Privat-Aufgabe die Nachricht — vor dem festen Satz");
ok(/offeneSachen/.test(neuWeg) && /menschImGespraech: lageH\.mensch/.test(neuWeg) && /herkunft: ein\.herkunft \?\? null/.test(neuWeg),
  "die Aufgabe bekommt offene Sachen (wa#3), Mensch im Gespräch (wa#5) und die belegte Herkunft (wa#6)");
ok(/offeneKarten, herkunft: herkunftBeleg, anrufSperre: anrufSatzOhneKi \}\)/.test(antwort) && /herkunftBeleg = herkunftSatz\(al\?\.herkunft \?\? null, "whatsapp"\);/.test(antwort),
  "maraAntwortet gibt alle offenen Karten und die belegte Herkunft weiter");
ok(/if \(!steht\) return/.test(neuWeg), "steht die Aufgabe nicht: zurück ohne Hinweis (der Nachhol-Takt versucht es wieder)");
ok(/waPrivatSchalter\(\)/.test(antwort) && /SELECT value FROM fiaon_settings WHERE key = \$\{WA_PRIVAT_SCHALTER\}/.test(q) && q.includes('"mara_wa_privat"'), "liest den Register-Schlüssel mara_wa_privat");
ok(/rueckfall: istRueckfall\(g\.antwort_text\) \|\| istWaPrivatHinweis\(g\.antwort_text\)/.test(rumpf("export async function versandLauf(")), "Versandtakt: der Hinweis zählt nicht als Antwort in der Sache (schließt keine Aufgabe)");
const auf = rumpf("export async function aufgabeFuerMenschen(");
ok(/klasse === "global" \|\| klasse === "privat"/.test(auf) && /opt\.kopie/.test(auf) && /opt\.titel/.test(auf), "aufgabeFuerMenschen: eigener Schlüssel für „privat“, Titel zieht nach, Board-Kopie bei hoch");

// ── I. Abnahme 25.11.2026: offene Karte, Mensch im Gespräch, Nachhol-Takt ────
abschnitt("I. Abnahme: offene Karte bei Justin (wa#3), Mensch im Gespräch (wa#5), KI-Pause (wa#7)");
gleich(wa.waPrivatOffeneKarte([{ fall: "widerruf" }]), "widerruf", "wa#3: offene Widerrufs-Karte → „Und? Was ist jetzt?“ geht an diese Karte (auch ohne Schlüsselwort)");
gleich(["rechtlich", "erstattung", "loeschen", "bestreitet", "kuendigung_zurueck", "ratenpause"].map((f) => wa.waPrivatOffeneKarte([{ fall: f as any }])),
  ["rechtlich", "erstattung", "loeschen", "bestreitet", "kuendigung_zurueck", "ratenpause"], "… ebenso jede Karte, über die Justin entscheidet (karteRuhe)");
gleich(wa.waPrivatOffeneKarte([{ fall: "karte" }, { fall: "frage" }, { fall: "erstattung" }, { fall: "widerruf" }]), "erstattung", "… die neueste davon (Liste absteigend), andere Karten davor zählen nicht");
gleich([wa.waPrivatOffeneKarte([{ fall: "karte" }, { fall: "frage" }, { fall: "unsicher" }]), wa.waPrivatOffeneKarte([])], [null, null],
  "Kartenlink, offene Frage, keine Karte → Aufgabe beim Betreuer (mit Warnzeile, siehe E)");
ok(wa.karteRuhe([{ fall: "widerruf" }]) && !wa.karteRuhe([{ fall: "karte" }]), "dieselbe Regel wie die Zahlungsruhe des Modells (karteRuhe)");
// Prüfung 25.11.2026 (2): Warn-Beleg beim Auffrischen und die Karte auf „später“.
gleich([wa.waPrivatKarteGrund([]), wa.waPrivatKarteGrund(["Kündigung", "Anrufstopp"])], ["Folge-Nachricht", "Folge-Nachricht — darin: Kündigung, Anrufstopp"],
  "Prüfung (2): karte.grund „Folge-Nachricht — darin: …“ (erscheint auf der Karte als Warn-Beleg — z. B. „Kündigung“ auf einer Ratenpause-Karte)");
{
  const verborgen = rumpf("async function waKarteVerborgen(");
  const sicht = readFileSync(new URL("../server/lib/fiaon-mara-entscheidungen.ts", import.meta.url), "utf8");
  ok(/if \(!id\) return true;/.test(verborgen) && /SELECT \(status = 'offen' OR \(status = 'spaeter' AND spaeter_bis <= NOW\(\)\)\) IS TRUE AS sichtbar/.test(verborgen)
    && /return z\?\.sichtbar !== true;/.test(verborgen) && /catch \(e\) \{[\s\S]*?return true;/.test(verborgen),
    "Prüfung (2): „steht auf später“ = nicht sichtbar (offen, oder später mit abgelaufenem spaeter_bis); keine Karte oder Lesefehler → zusätzlich die Aufgabe (fail-closed)");
  ok(sicht.includes("WHERE e.status = 'offen' OR (e.status = 'spaeter' AND e.spaeter_bis <= NOW())"),
    "… dieselbe Sichtbarkeit wie die Liste „Mara › Entscheidungen“ (SICHT_SQL, fiaon-mara-entscheidungen.ts, nur gelesen)");
}
const lageQ = rumpf("async function waPrivatHinweisLage(");
// Prüfung 25.11.2026 (4): „keine Vorlage“ nur noch im FILTER des Hinweises — Vorlagen von Menschen zählen beim Menschen mit.
ok(/von !~\* '\^\(mara\|aras\|system\)'/.test(lageQ) && /INTERVAL '48 hours'/.test(lageQ) && /text IS DISTINCT FROM \$\{WA_PRIVAT_AUS_TEXT\}/.test(lageQ)
  && /MAX\(COALESCE\(gesendet_am, created_at\)\) FILTER \(WHERE vorlage IS NULL AND text = \$\{WA_PRIVAT_AUS_TEXT\}\) AS am/.test(lageQ)
  && /WHERE nummer = \$\{nummer\} AND richtung = 'raus' AND status <> 'fehler'`/.test(lageQ) && (lageQ.match(/vorlage IS NULL/g) ?? []).length === 1
  && /return \{ vorStunden: 0, mensch: true \}/.test(lageQ) && wa.WA_PRIVAT_MENSCH_STUNDEN === 48,
  "wa#5: Antwort eines Menschen (nicht Mara/ARAS/System) in den letzten 48 Stunden — frei ODER mit Vorlage aus dem WhatsApp-Raum — zählt wie ein Hinweis von eben; „keine Vorlage“ gilt nur für den Hinweis");
{
  // Die Automatik schickt Vorlagen als „Mara …“ oder „aras“ — sie zählt also nie als Mensch (nur gelesen).
  const lies = (d: string) => readFileSync(new URL(`../server/lib/${d}`, import.meta.url), "utf8");
  ok(/\$\{zusatz\.von \?\? "Mara"\}/.test(lies("fiaon-whatsapp.ts")) && /vorlage, werte: w\.werte, knopfWert: w\.knopfWert \}, \{ personId: k\.personId, leadId: k\.leadId, von: "Mara" \}/.test(lies("fiaon-wa-zentrale.ts"))
    && /von: "Mara", frischerLead \}/.test(lies("fiaon-lead-whatsapp.ts")) && /von: "aras", absender: "Aras"/.test(lies("fiaon-aras-werkzeuge.ts"))
    && ["Mara", "Mara (Leitung)", "aras", "System"].every((v) => /^(mara|aras|system)/i.test(v)) && !/^(mara|aras|system)/i.test("Erika Muster"),
    "… Vorlagen der Automatik (Zentrale, Lead-Begrüßung, ARAS, Vorgabe „Mara“) passen auf ^(mara|aras|system) — zählen nie als Mensch");
}
ok(/const lageH = await waPrivatHinweisLage\(ein\.nummer\);/.test(neuWeg) && /festVorStunden: lageH\.vorStunden/.test(neuWeg), "… und entscheidet über den festen Hinweis (dann nur die Aufgabe)");
gleich(ent({ festVorStunden: 0 }).aktion, "nur_aufgabe", "… vorStunden 0 → nur die Aufgabe, kein Hinweis mitten ins Gespräch");
const nachhol = rumpf("export async function nachholLauf(");
ok(/if \(await kiPausiert\(\) && waPrivatSchalterAn\(await waPrivatSchalter\(\)\)\) return \{ angestossen: 0 \};/.test(nachhol),
  "wa#7: in der KI-Pause stößt der Nachhol-Takt nur an, wenn „WhatsApp Privat ohne KI“ gilt (der Weg braucht keine KI)");
ok(antwort.indexOf("waPrivatOhneKi(") < antwort.indexOf("await kiPausiert()") && /if \(pausiert\) return/.test(readFileSync(new URL("../server/lib/fiaon-mara-business.ts", import.meta.url), "utf8")),
  "… maraAntwortet hält die KI-Wege selbst an (Privat: kiPausiert nach dem Weg ohne KI; Mara Business: kiAufruf meldet die Pause)");

// ── J. Prüfung 25.11.2026 (1): E-408 ohne KI — der Sperrzweig endet nur bei reinem Anruf-Stopp ─────────────────────
abschnitt("J. Prüfung: E-408 ohne KI endet nur früh, wenn außer dem Anruf-Stopp nichts Heikles dasteht");
{
  const jz = await import("../shared/fiaon-ja-zum-anruf");
  type Wort = (typeof wa.WA_PRIVAT_WOERTER)[number];
  const frueh = (t: string, privatOhneKi = true, frageVorher: string | null = null) => wa.waAnrufSperreFrueh({ privatOhneKi, text: t, frageVorher });
  // Die vier Sätze der Prüfung (der Pflichtfall zuerst) — der Eingang setzt die Telefonsperre (istAnrufSperreWunsch, kein „?“).
  const vier: [string, Wort][] = [
    ["Ich kündige meinen Vertrag. Bitte rufen Sie mich nicht mehr an.", "Kündigung"],
    ["Löschen Sie meine Daten und rufen Sie mich nicht mehr an.", "Löschwunsch"],
    ["Ich widerrufe den Vertrag. Nicht mehr anrufen!", "Widerruf"],
    ["Mein Anwalt meldet sich. Keine Anrufe mehr!", "Anwalt"],
  ];
  for (const [t, wort] of vier) {
    ok(jz.istAnrufSperreWunsch(t) && !t.includes("?") && w(t).includes(wort) && w(t).includes("Anrufstopp") && !frueh(t) && frueh(t, false),
      `„${t}“ → Sperre verlangt, darin „${wort}“ + „Anrufstopp“ → ohne KI NICHT früh beendet (mit KI wie seit E-408)`);
  }
  ok(ton.istLoeschwunsch(vier[1][0]) && wa.waEntscheidungVorab(vier[2][0], { bezahlt: true }) === "widerruf" && wa.waEntscheidungVorab(vier[2][0], { bezahlt: false }) === null
    && wa.waEntscheidungVorab(vier[3][0], { bezahlt: false }) === "rechtlich" && wa.waEntscheidungVorab(vier[0][0], { bezahlt: true }) === null && ton.abstreitenArt(vier[0][0]) === null,
    "… dann übernehmen E-264 (Löschwunsch → Karte) und E-372 (Widerruf nach Zahlung, Anwalt → sicherer Satz + Karte); Kündigung und Widerruf ohne Zahlung nimmt der Weg ohne KI");
  // Pflichtfall: Kündigung + Anruf-Stopp → Aufgabe (hoch, Kündigung + Anrufstopp im Titel) + Anruf-Satz.
  {
    const PF = vier[0][0];
    const e0 = ent({ text: PF }), e3 = ent({ text: PF, festVorStunden: 3 });
    const A = jz.ANRUF_SPERRE_WA;
    gleich([e0.aktion, e0.prioritaet, e0.woerter], ["fest_und_aufgabe", "hoch", ["Kündigung", "Anrufstopp"]], "Pflichtfall „Ich kündige meinen Vertrag. Bitte rufen Sie mich nicht mehr an.“: die Aufgabe — hoch, Kündigung + Anrufstopp");
    gleich(wa.waPrivatTitel(null, e0.woerter), "WhatsApp Privat: Kündigung, Anrufstopp — bitte jetzt übernehmen", "… Titel der Aufgabe");
    gleich([wa.waPrivatAntwortText({ aktion: e0.aktion, stopp: wa.waKontaktStoppEcht(PF), anruf: true }), wa.waPrivatAntwortText({ aktion: e3.aktion, stopp: wa.waKontaktStoppEcht(PF), anruf: true })], [A, A],
      "… und der Anruf-Satz „Verstanden – wir rufen Sie nicht mehr an.“ (auch innerhalb der 24 Stunden) — kein E-Mail-Hinweis, keine STOPP-Bestätigung");
  }
  for (const t of ["Bitte rufen Sie mich nicht mehr an.", "Keine Anrufe mehr bitte.", "Bitte nicht mehr anrufen, schreiben Sie mir lieber hier auf WhatsApp.",
    "Hören Sie auf, mich anzurufen!", "Rufen Sie mich nie wieder an!", "Nicht mehr anrufen 😡"]) {
    ok(jz.istAnrufSperreWunsch(t) && frueh(t), `reiner Anruf-Stopp „${t}“ → früh beendet wie bisher (nur der Anruf-Satz, keine Aufgabe)`);
  }
  ok(!frueh("Ich gehe zur Datenschutzbehörde. Nicht mehr anrufen!") && !frueh("Ich habe nichts beantragt. Rufen Sie mich nicht mehr an!")
    && !frueh("Ja. Und rufen Sie mich nicht mehr an.", true, RUECKFRAGE) && frueh("Ja. Und rufen Sie mich nicht mehr an.", true, null)
    && !frueh("Bitte nicht mehr anrufen oder schreiben") && !frueh("Hören Sie auf mich anzurufen und zu nerven!"),
    "… nicht früh auch bei Behörde (E-372), „nichts beantragt“ (E-264), „Ja“ auf Maras Kündigungs-Rückfrage, „anrufen oder schreiben“ (Stopp), „anzurufen und zu nerven“ (in Ruhe)");
  ok(["Ich kündige.", "Löschen Sie meine Daten.", "Wo ist meine Karte?"].every((t) => frueh(t, false)), "mit KI („an“) unverändert — der Sperrzweig endet wie seit E-408");
}

console.log(`\n${fehler ? "✗" : "✓"} ${gut} grün, ${fehler} rot (pruef-mara-wa-privat, offline)`);
process.exit(fehler ? 1 : 0);
