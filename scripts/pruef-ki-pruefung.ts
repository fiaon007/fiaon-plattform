// Prüfstand E-409 (19.10.2026): Prüf-Mara — die reinen Regeln auf erfundenen Texten (keine Kundendaten).
// Offline, ohne Datenbank:  npx tsx scripts/pruef-ki-pruefung.ts
import {
  harteRegeln, druckFinden, lastschriftFinden, vertragZusageFinden, anliegenVorIdentitaet, kiHinweisGesagt, urteilBilden,
  modellUrteilLesen, inStichprobe, quotenLesen, fehlerquoteRechnen, ausschnittFuerKarte, empfehlungFuer, karteNoetig, KARTEN_JE_TAG,
} from "../shared/fiaon-ki-pruefung-regeln";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
const regeln = (text: string, kanal: "mail" | "whatsapp" | "telefon" = "mail", telefon?: any) => harteRegeln(text, { kanal, telefon }).map((p) => p.regel);
const MA = [{ vorname: "Daniel", nachname: "Beispielmann", anrede: "Herr" as const }];

console.log("── 1 · Druck (KI-VO Art. 5)");
ok(!!druckFinden("Das gilt nur heute — danach ist das Angebot weg."), "„nur heute“ ist Druck");
ok(!!druckFinden("Das ist Ihre letzte Chance, bevor wir weitere Schritte einleiten."), "„letzte Chance“ ist Druck");
ok(!!druckFinden("Wenn Sie nicht bis Freitag zahlen, geht das an Inkasso."), "bedingte Drohung ist Druck");
ok(!!druckFinden("Sie haben ja sowieso keine andere Wahl."), "Ausnutzen der Lage ist Druck");
ok(!druckFinden("Wenn Sie heute überweisen, ist alles wieder im grünen Bereich — oder nennen Sie mir einen Tag."), "ruhiger Ratensatz ist kein Druck");
ok(!druckFinden("Heute ist Montag, ich melde mich morgen wieder."), "„heute“ allein ist kein Druck");

console.log("── 2 · Lastschrift, Vertrag per Stimme, Anliegen vor Identität");
ok(lastschriftFinden("Wir richten dann eine Lastschrift ein.") === "Lastschrift", "Lastschrift anbieten → Treffer");
ok(lastschriftFinden("Eine Lastschrift gibt es bei uns nicht — Sie überweisen selbst.") === null, "Verbotssatz → kein Treffer");
ok(!!vertragZusageFinden("Super, dann sind wir uns einig."), "„dann sind wir uns einig“ → Treffer");
ok(!!vertragZusageFinden("Der Vertrag ist hiermit abgeschlossen."), "„Vertrag abgeschlossen“ → Treffer");
ok(vertragZusageFinden("Den Antrag schicke ich Ihnen jetzt als Link aufs Handy.") === null, "Link schicken → kein Treffer");
const t1 = [{ wer: "aras" as const, text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Herrn Beispielmann?" }, { wer: "kunde" as const, text: "Ja." }, { wer: "aras" as const, text: "Ich rufe wegen Ihrer Rate 2 über 59,99 Euro an." }];
ok(anliegenVorIdentitaet(t1) === null, "Rate erst nach dem Ja des Kunden → in Ordnung");
const t2 = [{ wer: "aras" as const, text: "Hallo, hier ist Aras, es geht um Ihre offene Rate von 59,99 Euro." }, { wer: "kunde" as const, text: "Wer?" }];
ok(!!anliegenVorIdentitaet(t2), "Rate vor der Identitätsbestätigung → Treffer");
ok(kiHinweisGesagt(t1) && !kiHinweisGesagt(t2), "KI-Hinweis erkannt / nicht erkannt");

console.log("── 3 · harteRegeln: Wortwand, Ton, Limit, Kopplung, Drohung");
const r1 = regeln("Ihr Limit ist garantiert — das bekommen Sie sicher.");
ok(r1.some((r) => /^wand_|^limit_|^ton_/.test(r)), "„garantiert … sicher“ → harte Regel", r1.join(","));
const r2 = regeln("Ohne die Rate können wir den Vertrag nicht beenden — sonst geht das vor Gericht.");
ok(r2.includes("kopplung") || r2.includes("drohung") || r2.includes("druck"), "Kopplung/Drohung erkannt", r2.join(","));
const r3 = regeln("Guten Tag, vielen Dank für Ihre Nachricht. Ihre Zahlung ist eingegangen, alles ist im grünen Bereich. Freundliche Grüße, Mara Lindner");
ok(!r3.some((r) => harteRegeln("x", { kanal: "mail" }) && r !== "" && false) && !regelnHart(r3), "sauberer Text → kein harter Punkt", r3.join(","));
function regelnHart(liste: string[]) { return liste.some((r) => /^(wand_verboten|wand_zusage|limit_zusage|limit_freigabe|kopplung|drohung|druck|lastschrift|vertrag_zusage)$/.test(r)); }
const r4 = regeln("Wir buchen das dann bequem per Lastschrift ab.");
ok(r4.includes("lastschrift"), "Lastschrift → harte Regel");

console.log("── 4 · Telefon-Pflichten");
const tel = (o: any) => regeln("ARAS: Guten Tag.\nKUNDE: Ja.", "telefon", { transkript: t1, ...o });
ok(tel({ kiHinweisSek: 4 }).length === 0, "KI-Hinweis nach 4 s, alles sauber → keine Punkte");
ok(tel({ kiHinweisSek: 40 }).includes("ki_hinweis_spaet"), "KI-Hinweis nach 40 s → spät");
ok(tel({ kiHinweisSek: 2, aufnahmeGestartetSek: 10, aufnahmeJaSek: 30 }).includes("aufnahme_vor_ja"), "Aufnahme vor dem Ja → hart");
ok(tel({ kiHinweisSek: 2, aufnahmeGestartetSek: 40, aufnahmeJaSek: 30 }).every((r) => r !== "aufnahme_vor_ja"), "Aufnahme nach dem Ja → in Ordnung");
ok(tel({ kiHinweisSek: 2, aufnahmeNeinSek: 20, aufnahmeGestartetSek: 25 }).includes("aufnahme_trotz_nein"), "Aufnahme trotz Nein → hart");
ok(tel({ kiHinweisSek: 2, amdWiderspruch: true }).includes("amd_widerspruch"), "AMD-Widerspruch → weich");
ok(tel({ kiHinweisSek: 2, sperrwunschOhneSperre: true }).includes("sperrwunsch_ohne_sperre"), "Sperrwunsch ohne Sperre → hart");
ok(regeln("ARAS: Hallo.", "telefon", { kiHinweisSek: null, transkript: t2 }).includes("ki_hinweis_fehlt"), "ohne KI-Hinweis im Transkript → fehlt");
ok(regeln("ARAS: Dann sind wir uns einig.", "telefon", { kiHinweisSek: 2, transkript: t1 }).includes("vertrag_zusage"), "Vertrag per Stimme am Telefon → hart");

console.log("── 5 · Urteil, Karte, Empfehlung");
const hart = [{ regel: "druck", schwere: "hart" as const, treffer: "", hinweis: "" }];
const weich = { regel: "wand_floskel", schwere: "weich" as const, treffer: "leider", hinweis: "" };
ok(urteilBilden(hart, null).urteil === "fehler", "harter Punkt → fehler");
ok(urteilBilden([weich], null).urteil === "ok", "ein weicher Punkt allein → ok (steht in den Punkten)");
ok(urteilBilden([weich, { ...weich, regel: "ton_x" }], null).urteil === "auffaellig", "zwei weiche Punkte → auffällig");
ok(urteilBilden([], { urteil: "auffaellig", punkte: [], begruendung: "" }).urteil === "auffaellig", "Modell sagt auffällig → auffällig");
ok(urteilBilden([], { urteil: "fehler", punkte: [], begruendung: "" }).urteil === "fehler", "Modell sagt fehler → fehler");
ok(urteilBilden([], { urteil: "ok", punkte: [], begruendung: "" }).urteil === "ok", "alles sauber → ok");
ok(karteNoetig("ok") === false && karteNoetig("auffaellig") === false && karteNoetig("fehler") === true, "Karte nur bei Regelverstoß (auffällig zählt still)");
ok(KARTEN_JE_TAG >= 1 && KARTEN_JE_TAG <= 10, `Tagesdeckel für Karten (${KARTEN_JE_TAG})`);
ok(empfehlungFuer("fehler") === "anweisen" && empfehlungFuer("auffaellig") === "in_ordnung", "Empfehlung je Urteil");
const m = modellUrteilLesen('{"urteil":"fehler","punkte":[{"regel":"Druck!!","schwere":"hart","treffer":"nur heute","hinweis":"Zeitfalle"}],"begruendung":"x"}');
ok(m?.urteil === "fehler" && m.punkte[0].regel === "modell_druck__" && m.punkte[0].schwere === "hart", "Modell-Antwort sicher gelesen");
ok(modellUrteilLesen("kein json") === null && modellUrteilLesen('{"urteil":"irgendwas"}')?.urteil === "ok", "kaputt → null, unbekannt → ok");

console.log("── 6 · Stichprobe, Quoten, Fehlerquote, Ausschnitt");
ok(inStichprobe(7, 100) && !inStichprobe(7, 0), "Quote 100/0");
ok(inStichprobe(12345, 20) === inStichprobe(12345, 20), "deterministisch");
const anteil = Array.from({ length: 2000 }, (_, i) => inStichprobe(i + 1, 20)).filter(Boolean).length / 2000;
ok(anteil > 0.15 && anteil < 0.25, `Quote 20 % trifft ≈ 20 % (${(anteil * 100).toFixed(1)} %)`);
ok(JSON.stringify(quotenLesen(null)) === '{"telefon":100,"mail":20,"whatsapp":20}', "Quoten-Vorgabe");
ok(quotenLesen('{"mail":"55","telefon":500}').mail === 55 && quotenLesen('{"telefon":500}').telefon === 100, "Quoten gelesen und gedeckelt");
const fq = fehlerquoteRechnen([{ kanal: "mail", schluessel: "postfach:support", n: 40, auffaellig: 0 }, { kanal: "whatsapp", schluessel: "rueckruf_eintragen", n: 30, auffaellig: 0 }, { kanal: "mail", schluessel: null, n: 10, auffaellig: 3 }], { tage: 28, gelb: ["rueckruf_eintragen"] });
ok(fq.gesamt.n === 80 && fq.gesamt.quote === 3.8, `gesamt 80 / 3,8 % (${fq.gesamt.quote})`);
ok(fq.je[0].schluessel === "(ohne)" && fq.je[0].quote === 30, "höchste Quote zuerst");
ok(fq.vorschlaege.length === 1 && fq.vorschlaege[0].includes("rueckruf_eintragen"), "Vorschlag gelb → grün nach 4 Wochen unter 2 %");
ok(fehlerquoteRechnen([{ kanal: "whatsapp", schluessel: "rueckruf_eintragen", n: 30, auffaellig: 0 }], { tage: 7, gelb: ["rueckruf_eintragen"] }).vorschlaege.length === 0, "kein Vorschlag unter 28 Tagen");
const a = ausschnittFuerKarte("Hallo. Daniel ruft Sie morgen an. Das gilt nur heute, sonst wird es teuer. Gruß.", "nur heute", MA);
ok(a === "Das gilt nur heute, sonst wird es teuer." , `Ausschnitt = der eine Satz (${a})`);
ok(ausschnittFuerKarte("Daniel meldet sich.", "", MA) === "Herr Beispielmann meldet sich.", "Vorname → Nennform");
ok(ausschnittFuerKarte("x".repeat(400), "", null).length <= 300, "≤ 300 Zeichen");

console.log("── 20.10.2026 · Erste Live-Läufe: Telefon ohne Schreib-Regeln, Justins Verkaufssatz kein Befund");
{
  // Ein langes, sauberes Telefon-Transkript: gesprochen sind 1.000+ Zeichen normal — keine WhatsApp-Länge, keine Ausrufezeichen-Regel.
  const lang = "Aras: Guten Tag, hier ist Aras von FIAON, ich bin eine KI! Schön, dass Sie Zeit haben! Kunde: Ja, gerne. ".repeat(14);
  const r = regeln(lang, "telefon");
  ok(lang.length > 1100 && !r.some((x) => x.startsWith("ton_")), "Telefon-Transkript: keine Ton-Regeln für geschriebene Texte", r.join(","));
  const w = regeln("Hallo! Super!! ".repeat(120), "whatsapp");
  ok(w.some((x) => x.startsWith("ton_")), "WhatsApp: Länge/Ausrufezeichen werden weiter geprüft (Rot-Probe der Ausnahme)", w.join(","));
  // Justins Verkaufssatz (E-373) — keine feste Regel darf ihn treffen.
  // Der Satz kommt aus derselben Quelle wie Maras Mails (nachDemEingang, E-373) — nicht nachgetippt.
  const { nachDemEingang } = await import("../shared/fiaon-mara-ton");
  const verkauf = `Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate über 59,99 € — ${nachDemEingang({ ref: "FIAON-AB12CD", ziel: { euro: 5000, art: "wunsch", paketName: "FIAON Plus" } as any })}.`;
  const rv = harteRegeln(verkauf, { kanal: "mail" }).filter((p) => p.schwere === "hart").map((p) => p.regel);
  ok(rv.length === 0, "E-373-Verkaufssatz: kein harter Treffer einer festen Regel", rv.join(","));
}
{
  const { karteBleibtNachNeubewertung } = await import("../server/lib/fiaon-ki-pruefung");
  const start = new Date("2026-10-20T08:20:00Z");
  const vorher = "2026-10-20T08:00:00Z", nachher = "2026-10-20T08:25:00Z";
  const modellHart = [{ regel: "modell_wahrheit", schwere: "hart", treffer: "Wunschlimit", hinweis: "x" }];
  const festHart = [{ regel: "drohung", schwere: "hart", treffer: "Inkasso", hinweis: "x" }];
  const telLaenge = [{ regel: "ton_laenge", schwere: "hart", treffer: "1378 Zeichen", hinweis: "x" }];
  ok(!karteBleibtNachNeubewertung({ kanal: "mail", urteil: "auffaellig", punkte: [], created_at: nachher }, start), "Neubewertung: jede „auffällig“-Karte wird geschlossen");
  ok(!karteBleibtNachNeubewertung({ kanal: "mail", urteil: "fehler", punkte: modellHart, created_at: vorher }, start), "Neubewertung: alter Modell-Fehler (E-373) wird geschlossen");
  ok(!karteBleibtNachNeubewertung({ kanal: "telefon", urteil: "fehler", punkte: telLaenge, created_at: vorher }, start), "Neubewertung: Telefon mit WhatsApp-Länge wird geschlossen");
  ok(karteBleibtNachNeubewertung({ kanal: "mail", urteil: "fehler", punkte: festHart, created_at: vorher }, start), "Neubewertung: fester Regelverstoß (Drohung) bleibt offen");
  ok(karteBleibtNachNeubewertung({ kanal: "mail", urteil: "fehler", punkte: modellHart, created_at: nachher }, start), "Neubewertung: Fehler-Karte der neuen Fassung bleibt offen");
}
{
  const quelle = (await import("node:fs")).readFileSync(new URL("../server/lib/fiaon-ki-pruefung.ts", import.meta.url), "utf8");
  ok(/E-373/.test(quelle) && /NICHT verlangt/.test(quelle) && /Wunschlimit/.test(quelle), "Modell-Anweisung kennt Justins Verkaufsregel E-373 (kein Bank-Vorbehalt verlangt)");
  ok(/Länge, Absätze und Satzzeichen beurteilst du nicht/.test(quelle), "Modell beurteilt keine Länge/Satzzeichen");
}

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
process.exit(schlecht ? 1 : 0);
