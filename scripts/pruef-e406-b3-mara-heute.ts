// Prüfstand E-406 B3 (19.10.2026), ohne Datenbank: „Mara heute“, die Ampel je Mara-Werkzeug, die Stichprobe und
// Maras Aufräum-Vorschläge — die reinen Regeln (shared/fiaon-mara-ampel.ts), die reinen Kartenbauer und der Einbau
// in die Wege (Quelltext). Alle Personen und Referenzen sind erfunden.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin DATABASE_URL=postgresql://nobody@127.0.0.1:1/none \
//     node_modules/.bin/tsx scripts/pruef-e406-b3-mara-heute.ts
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
let netz = 0;
globalThis.fetch = (async () => { netz++; return new Response("kein Netz im Prüfstand", { status: 599 }); }) as any;

import { readFileSync } from "node:fs";
import {
  MARA_AMPEL, FEST_ROT, AMPEL_STUFEN, ampelVorgabe, ampelLesen, ampelSetzen, ampelSetzenPruefen, ampelVerlaufLesen, ampelWerkzeug,
  mailDarfAuto, mailAmpelGrund, istAmpelGelbEntwurf, istAmpelRotEntwurf, rueckgaengigOffen, editZeileLesen,
  mailAmpelGelbKarteGrund, istAmpelGelbKarte, gelbKarteGrund, gelbEntwurfSatz,
  HANDLUNG_ARTEN, ERLEDIGT_ARTEN, heuteZeilen, heuteErledigt,
  STICHPROBE_ZAHL, AUFSTIEG_WOCHEN, AUFSTIEG_MIN_FAELLE, wocheBerlin, wochePlus, stichprobeZiehen, urteilPruefen, fehlerquoten, aufstiegVorschlag,
  MELDUNG_AB_TAGE, MELDUNG_BIS_TAGE, AUFRAEUM_ART_ZAHLUNG, meldungImFenster, meldungSuchTage, tageSeit,
  type AmpelKey, type WochenQuote,
} from "../shared/fiaon-mara-ampel";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n1. Die Ampel: Werkzeuge und Startwerte (= heutiges Verhalten)");
  const v = ampelVorgabe();
  const gruenHeute: AmpelKey[] = ["mail_antworten", "termin_eintragen", "angaben_aendern", "ratenpause", "karte_link", "nachfassen", "whatsapp_antworten", "aktion_mails", "zahlung_suchen", "werbesperre", "kuendigung"];
  ok(gruenHeute.every((k) => v[k] === "gruen"), "alles, was Mara heute selbst tut, startet grün", v);
  ok(v.geld_buchen === "rot" && v.erstattung === "rot" && v.raten_storno === "rot", "Geld buchen, Erstattung, Raten-Storno starten rot");
  ok(FEST_ROT.includes("geld_buchen") && FEST_ROT.includes("erstattung"), "Geld buchen und Erstattung sind fest rot");
  ok(MARA_AMPEL.every((w) => w.stufen.includes(w.start)), "jeder Startwert ist eine erlaubte Stufe");
  ok(MARA_AMPEL.every((w) => w.stufen.length > 1 || !!w.fest), "jedes Werkzeug mit nur einer Stufe sagt, warum (fest)");
  ok(MARA_AMPEL.filter((w) => w.stufen.includes("gelb")).every((w) => w.rueckgaengig !== undefined && (w.rueckgaengig !== null || !!w.ohneRueckgaengig)),
    "jedes gelbe Werkzeug sagt, was rückgängig geht — oder ehrlich, warum nicht");
  ok(MARA_AMPEL.filter((w) => !w.stufen.includes("rot") && w.stufen.length > 1).every((w) => !!w.fehlt), "wo Rot fehlt, steht ehrlich, warum");
  ok(MARA_AMPEL.every((w) => w.label.length <= 40 && w.satz.length <= 80), "kurze Texte (Label ≤ 40, Satz ≤ 80 Zeichen)");
  ok(new Set(MARA_AMPEL.map((w) => w.key)).size === MARA_AMPEL.length, "kein Werkzeug doppelt");
  ok(ampelWerkzeug("erstattung")?.fest?.includes("nie automatisch"), "Erstattung: „nie automatisch“ steht dabei");

  console.log("\n2. Gespeicherter Wert → Stufen (Lesefehler und Unsinn = Startwerte)");
  ok(JSON.stringify(ampelLesen(null)) === JSON.stringify(v), "nichts gespeichert → Startwerte");
  ok(JSON.stringify(ampelLesen("{kaputt")) === JSON.stringify(v), "kaputtes JSON → Startwerte");
  ok(JSON.stringify(ampelLesen(42)) === JSON.stringify(v), "Zahl statt JSON → Startwerte");
  const roh = JSON.stringify({ stufen: { termin_eintragen: "gelb", mail_antworten: "rot", karte_link: "rot", geld_buchen: "gruen", erstattung: "gelb", erfunden: "rot", ratenpause: "lila" } });
  const l = ampelLesen(roh);
  ok(l.termin_eintragen === "gelb" && l.mail_antworten === "rot", "erlaubte Stufen gelten");
  ok(l.karte_link === "gruen", "eine Stufe, die das Werkzeug nicht kennt (Kartenlink rot), gilt nicht");
  ok(l.geld_buchen === "rot" && l.erstattung === "rot", "fest rot bleibt rot — auch gegen einen gespeicherten Wert");
  ok(l.ratenpause === "gruen" && !("erfunden" in l), "Unsinn und unbekannte Werkzeuge fallen heraus");
  ok(JSON.stringify(ampelLesen({ stufen: { nachfassen: "gelb" } })) === JSON.stringify({ ...v, nachfassen: "gelb" }), "auch als Objekt (JSONB)");

  console.log("\n3. Setzen (nur erlaubte Stufen, Verlauf, nur Abweichungen gespeichert)");
  ok(ampelSetzenPruefen("gibtsnicht", "rot")?.includes("gibt es nicht"), "unbekanntes Werkzeug abgelehnt");
  ok(ampelSetzenPruefen("termin_eintragen", "blau")?.includes("Stufe"), "unbekannte Stufe abgelehnt");
  ok(!!ampelSetzenPruefen("geld_buchen", "gelb"), "Geld buchen lässt sich nicht lockern");
  ok(!!ampelSetzenPruefen("erstattung", "gruen"), "Erstattung lässt sich nicht lockern");
  ok(ampelSetzenPruefen("geld_buchen", "rot") === null, "fest rot auf rot: erlaubt (ändert nichts)");
  ok(!!ampelSetzenPruefen("karte_link", "rot"), "Kartenlink rot: gibt es nicht (Vertragsleistung)");
  ok(!!ampelSetzenPruefen("whatsapp_antworten", "gelb"), "WhatsApp beantworten: fest grün");
  ok(!!ampelSetzenPruefen("kuendigung", "rot"), "Kündigung: fest (Umbau E-396)");
  ok(ampelSetzenPruefen("mail_antworten", "rot") === null && ampelSetzenPruefen("termin_eintragen", "gelb") === null, "Mails rot, Termine gelb: erlaubt");
  const t0 = new Date("2026-10-19T18:00:00Z");
  const s1 = ampelSetzen(null, "termin_eintragen", "gelb", "Justin Schwarzott", t0);
  ok(JSON.stringify(s1.stufen) === JSON.stringify({ termin_eintragen: "gelb" }), "gespeichert wird nur, was vom Start abweicht", s1.stufen);
  ok(s1.verlauf.length === 1 && s1.verlauf[0].von === "gruen" && s1.verlauf[0].nach === "gelb" && s1.verlauf[0].wer === "Justin Schwarzott", "Verlauf: wer, von, nach");
  const s2 = ampelSetzen(JSON.stringify(s1), "termin_eintragen", "gelb", "Justin", t0);
  ok(s2.verlauf.length === 1, "dieselbe Stufe noch einmal → kein neuer Verlaufseintrag");
  const s3 = ampelSetzen(JSON.stringify(s2), "termin_eintragen", "gruen", "Justin", t0);
  ok(Object.keys(s3.stufen).length === 0 && s3.verlauf.length === 2 && s3.verlauf[0].nach === "gruen", "zurück auf Start → nichts mehr gespeichert, Verlauf bleibt");
  let warf = false;
  try { ampelSetzen(null, "erstattung", "gruen", "x"); } catch { warf = true; }
  ok(warf, "ampelSetzen wirft bei einer verbotenen Stufe");
  let gross: unknown = null;
  for (let i = 0; i < 60; i++) gross = ampelSetzen(gross, "nachfassen", i % 2 ? "gelb" : "gruen", "x", t0);
  ok(ampelVerlaufLesen(gross).length === 50, "Verlauf höchstens 50 Einträge");

  console.log("\n4. Mails beantworten: die Weiche vor dem Senden");
  ok(mailDarfAuto("gruen") && mailDarfAuto("gruen", { fristNeu: true }), "grün: sendet wie bisher");
  ok(!mailDarfAuto("gelb") && mailDarfAuto("gelb", { fristNeu: true }), "gelb: erst im zweiten Anlauf der 24-Stunden-Regel");
  ok(!mailDarfAuto("rot") && !mailDarfAuto("rot", { fristNeu: true }), "rot: nie von selbst");
  ok(mailAmpelGrund("gruen", "x") === null, "grün: keine Ampel-Begründung");
  const gg = mailAmpelGrund("gelb", "sauber, Automat erlaubt")!;
  ok(istAmpelGelbEntwurf(gg) && !istAmpelRotEntwurf(gg) && gg.includes("Nicht senden") && gg.includes("sauber"), "gelb: Begründung mit Kopf und altem Grund", gg);
  const gr = mailAmpelGrund("rot", "sauber")!;
  ok(istAmpelRotEntwurf(gr) && !istAmpelGelbEntwurf(gr), "rot: eigener Kopf");
  ok(!/widerruf|anwalt|beh(ö|oe)rde|rechtlich|FIAON Global/i.test(gg + gr), "die Ampel-Begründungen lösen keine Heikel-/Global-Regel der 24-Stunden-Regel aus");
  ok(!istAmpelGelbEntwurf("Übergabe an den Betreuer: Ampel gelb:") && !istAmpelGelbEntwurf(null), "nur der Anfang zählt");

  console.log("\n5. Rückgängig: 24 Stunden");
  const jetzt = new Date("2026-10-19T18:00:00Z");
  ok(rueckgaengigOffen(new Date(jetzt.getTime() - 23 * 3_600_000), jetzt), "vor 23 Stunden: noch offen");
  ok(!rueckgaengigOffen(new Date(jetzt.getTime() - 25 * 3_600_000), jetzt), "vor 25 Stunden: zu");
  ok(!rueckgaengigOffen(null, jetzt) && !rueckgaengigOffen("unsinn", jetzt), "ohne Zeitpunkt: zu");
  ok(!rueckgaengigOffen(new Date(jetzt.getTime() + 3_600_000), jetzt), "in der Zukunft: zu");
  const e1 = editZeileLesen("Straße korrigiert durch Mara (Mail): Alte Gasse 1 → Neue Straße 7");
  ok(e1?.feld === "Straße" && e1.vorher === "Alte Gasse 1" && e1.nachher === "Neue Straße 7", "Verlaufszeile Straße gelesen", e1);
  const e2 = editZeileLesen("Telefon korrigiert durch Mara (WhatsApp): — → +491701234567");
  ok(e2?.feld === "Telefon" && e2.vorher === "—" && e2.nachher === "+491701234567", "Telefon mit leerem Vorher", e2);
  ok(editZeileLesen("Vorname korrigiert durch Mara (Mail): A → B") === null, "Name ist kein Feld zum Zurücknehmen");
  ok(editZeileLesen("irgendwas") === null, "fremde Zeile: null");
  ok(editZeileLesen("Land korrigiert durch Mara (Mail): DE → AT")?.nachher === "AT", "Land gelesen");

  console.log("\n6. „Mara heute“: Zeilen und Kopfzahl");
  const zeilen = heuteZeilen({ wa_antwort: 12, mail_beantwortet: 1, termin: 3, karte_vorgelegt: 2, uebergabe: 1, angaben: 0, gibtsnicht: 5 } as any);
  ok(zeilen.length === 5 && zeilen[0].art === "wa_antwort" && zeilen[0].text === "WhatsApp-Antworten", "die meisten zuerst, Mehrzahl", zeilen.map((z) => z.art));
  ok(zeilen.find((z) => z.art === "mail_beantwortet")?.text === "Mail beantwortet", "Einzahl bei 1");
  ok(!zeilen.some((z) => z.art === "angaben" || (z.art as string) === "gibtsnicht"), "0 und Unbekanntes fallen heraus");
  ok(heuteErledigt({ wa_antwort: 12, mail_beantwortet: 1, termin: 3, karte_vorgelegt: 2, uebergabe: 1 }) === 16, "Kopfzahl ohne Karten und Übergaben");
  ok(!ERLEDIGT_ARTEN.includes("karte_vorgelegt") && !ERLEDIGT_ARTEN.includes("uebergabe"), "Karten und Übergaben sind keine Erledigung");
  ok(Object.values(HANDLUNG_ARTEN).every((a) => a.link.startsWith("/chef/")), "jede Zeile führt in einen Chefbüro-Raum");
  ok(Object.values(HANDLUNG_ARTEN).every((a) => a.werkzeug === null || !!ampelWerkzeug(a.werkzeug)), "jede Art gehört zu einem Werkzeug der Ampel (oder keinem)");
  ok(HANDLUNG_ARTEN.karte_vorgelegt.stichprobe === false && HANDLUNG_ARTEN.uebergabe.stichprobe === false, "Karten und Übergaben kommen nicht in die Stichprobe");

  console.log("\n7. Die Woche (Berlin, Montag) — auch über die Zeitumstellung");
  ok(wocheBerlin(new Date("2026-10-18T22:30:00Z")) === "2026-10-19", "Mo 19.10. 00:30 Berlin → 19.10.");
  ok(wocheBerlin(new Date("2026-10-18T21:30:00Z")) === "2026-10-12", "So 18.10. 23:30 Berlin → 12.10.");
  ok(wocheBerlin(new Date("2026-10-25T22:59:00Z")) === "2026-10-19", "So 25.10. 23:59 Berlin (Winterzeit) → 19.10.");
  ok(wocheBerlin(new Date("2026-10-25T23:00:00Z")) === "2026-10-26", "Mo 26.10. 00:00 Berlin (Winterzeit) → 26.10.");
  ok(wocheBerlin(new Date("2026-03-29T12:00:00Z")) === "2026-03-23", "Sommerzeit-Sonntag → Montag davor");
  ok(wochePlus("2026-10-19", -1) === "2026-10-12" && wochePlus("2026-12-28", 1) === "2027-01-04", "Wochen plus/minus über den Jahreswechsel");

  console.log("\n8. Die Stichprobe: 20, gleichmäßig über die Werkzeuge, zufällig");
  let saat = 7;
  const zufall = () => { saat = (saat * 16807) % 2147483647; return (saat - 1) / 2147483646; };
  const kand = [
    ...Array.from({ length: 700 }, (_, i) => ({ werkzeug: "aktion_mails", id: `a${i}` })),
    ...Array.from({ length: 300 }, (_, i) => ({ werkzeug: "whatsapp_antworten", id: `w${i}` })),
    ...Array.from({ length: 3 }, (_, i) => ({ werkzeug: "termin_eintragen", id: `t${i}` })),
    ...Array.from({ length: 1 }, (_, i) => ({ werkzeug: "ratenpause", id: `r${i}` })),
    ...Array.from({ length: 60 }, (_, i) => ({ werkzeug: "mail_antworten", id: `m${i}` })),
  ];
  const zug = stichprobeZiehen(kand, STICHPROBE_ZAHL, zufall);
  const je = (w: string) => zug.filter((x) => x.werkzeug === w).length;
  ok(zug.length === 20 && new Set(zug.map((x) => x.id)).size === 20, "genau 20, keine doppelt");
  ok(je("termin_eintragen") === 3 && je("ratenpause") === 1, "seltene Werkzeuge kommen ganz mit", { t: je("termin_eintragen"), r: je("ratenpause") });
  ok(je("aktion_mails") <= 6 && je("aktion_mails") >= 5, "700 Verkaufsmails verdrängen nichts (5–6 von 20)", je("aktion_mails"));
  saat = 7;
  const zug2 = stichprobeZiehen(kand, STICHPROBE_ZAHL, zufall);
  ok(JSON.stringify(zug2.map((x) => x.id)) === JSON.stringify(zug.map((x) => x.id)), "derselbe Zufall → dieselbe Stichprobe (Prüfstand)");
  saat = 99;
  ok(JSON.stringify(stichprobeZiehen(kand, STICHPROBE_ZAHL, zufall).map((x) => x.id)) !== JSON.stringify(zug.map((x) => x.id)), "anderer Zufall → andere Fälle");
  ok(stichprobeZiehen(kand.slice(700, 705), 20).length === 5, "weniger als 20 da → alle");
  ok(stichprobeZiehen([], 20).length === 0, "nichts da → nichts");

  console.log("\n9. Urteil, Fehlerquote, Vorschlag Gelb → Grün (nie automatisch)");
  ok(urteilPruefen("ok", "") === null, "ok ohne Grund: geht");
  ok(!!urteilPruefen("nicht_ok", "") && !!urteilPruefen("nicht_ok", "zu"), "nicht ok ohne (kurzen) Grund: abgelehnt");
  ok(urteilPruefen("nicht_ok", "Falscher Name genannt") === null, "nicht ok mit Grund: geht");
  ok(!!urteilPruefen("vielleicht", "x") && !!urteilPruefen("ok", "x".repeat(601)), "Unsinn und zu lang: abgelehnt");
  const wo = ["2026-10-12", "2026-10-05", "2026-09-28", "2026-09-21"];
  const bew = [
    ...Array.from({ length: 3 }, () => ({ werkzeug: "termin_eintragen", woche: "2026-10-12", urteil: "ok" })),
    { werkzeug: "termin_eintragen", woche: "2026-10-05", urteil: "nicht_ok" },
    { werkzeug: "termin_eintragen", woche: "2026-10-05", urteil: "ok" },
    { werkzeug: "termin_eintragen", woche: "2026-10-12", urteil: null },
    { werkzeug: "termin_eintragen", woche: "2026-08-03", urteil: "nicht_ok" },
  ];
  const q = fehlerquoten(bew, wo);
  const qt = q.find((x) => x.werkzeug === "termin_eintragen")!;
  ok(qt.n === 5 && qt.nichtOk === 1 && qt.quote === 0.2, "Quote aus bewerteten Fällen der gezeigten Wochen", qt);
  ok(qt.wochen[0].n === 3 && qt.wochen[1].quote === 0.5 && qt.wochen[2].quote === null, "je Woche, ohne Fälle: keine Quote");
  const w4 = (n: number[], f: number[] = [0, 0, 0, 0]): WochenQuote[] => n.map((x, i) => ({ woche: wo[i], n: x, nichtOk: f[i], quote: x ? f[i] / x : null }));
  ok(aufstiegVorschlag("gelb", w4([3, 3, 2, 2])).vorschlag, "4 Wochen, je bewertet, 0 Fehler, 10 Fälle → Vorschlag Grün");
  ok(!aufstiegVorschlag("gelb", w4([3, 0, 3, 3])).vorschlag, "eine Woche ohne Bewertung → kein Vorschlag");
  ok(!aufstiegVorschlag("gelb", w4([3, 3, 3, 3], [0, 1, 0, 0])).vorschlag, "ein Fehler in einer Woche (≥ 2 %) → kein Vorschlag");
  ok(!aufstiegVorschlag("gelb", w4([1, 2, 2, 2])).vorschlag && aufstiegVorschlag("gelb", w4([1, 2, 2, 2])).grund.includes(String(AUFSTIEG_MIN_FAELLE)), "zu wenig Fälle (7 < 8) → kein Vorschlag");
  ok(!aufstiegVorschlag("gelb", w4([3, 3, 3])).vorschlag, "erst 3 Wochen → kein Vorschlag");
  ok(!aufstiegVorschlag("gruen", w4([3, 3, 3, 3])).vorschlag && !aufstiegVorschlag("rot", w4([3, 3, 3, 3])).vorschlag, "nur von Gelb aus");
  ok(aufstiegVorschlag("gelb", [...w4([3, 3, 3, 3]), { woche: "x", n: 5, nichtOk: 5, quote: 1 }]).vorschlag, "nur die letzten 4 Wochen zählen");
  ok(AUFSTIEG_WOCHEN === 4, "4 Wochen");

  console.log("\n10. Aufräumen: alte Zahlungsmeldungen");
  const h = new Date("2026-10-19T12:00:00Z");
  const vor = (tage: number) => new Date(h.getTime() - tage * 86_400_000);
  ok(!meldungImFenster(vor(10), h) && meldungImFenster(vor(15), h) && meldungImFenster(vor(75), h) && !meldungImFenster(vor(76), h), "Fenster 14–75 Tage");
  ok(meldungSuchTage(vor(20), h) === 27 && meldungSuchTage(vor(100), h) === 90 && meldungSuchTage(vor(5), h) === 21, "Bankbuch-Fenster: seit Meldung + 7, 21 bis 90 Tage");
  ok(tageSeit(vor(20), h) === 20, "Tage seit der Meldung");
  ok(MELDUNG_AB_TAGE === 14 && MELDUNG_BIS_TAGE === 75 && AUFRAEUM_ART_ZAHLUNG === "mara_aufraeumen_zahlung", "Grenzen und Art");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n11. Die Kartenbauer (rein, ohne Datenbank)");
  const auf = await import("../server/lib/fiaon-mara-aufraeumen");
  const ent = await import("../server/lib/fiaon-mara-entscheidungen");
  const pmE = await import("../server/lib/fiaon-postmeister-entscheidungen");
  const k = auf.meldungKarte({ ref: "FIAON-Q406-1", person_id: 4061, claimed_paid_at: vor(20), soll: 9999, pack_name: "PRO\nmehr" }, h);
  ok(k.art === AUFRAEUM_ART_ZAHLUNG && k.schluessel === `${AUFRAEUM_ART_ZAHLUNG}:FIAON-Q406-1:${Math.floor(vor(20).getTime() / 1000)}`, "Schlüssel: Bestellung + Zeitpunkt der Meldung");
  ok(k.empfehlung === "nachsehen" && k.optionen.map((o) => o.werkzeug).join(",") === "mara_zahlung_nachsehen,nichts", "Ja = im Bankbuch nachsehen, Nein = nichts");
  ok(!k.optionen.some((o) => /buchen|erstatt|kuendig|storn/i.test(o.werkzeug)), "nie Geld buchen, Erstattung, Kündigung oder Storno");
  ok(/27 Tage zurück/.test(k.text) && /20 Tagen/.test(k.text) && /99,99/.test(k.text), "Text: Tage, Fenster, Betrag", k.text);
  ok(ent.SAMMEL_ARTEN.includes(AUFRAEUM_ART_ZAHLUNG), "als E-397-Sammelkarte zugelassen");
  // Die Sammelkarte mit „Ja“ und „Nein“ für alle.
  const sicht = (id: number) => ({
    id, art: AUFRAEUM_ART_ZAHLUNG, artText: "Alte Zahlungsmeldung", gewicht: 35, personId: id, name: null, ref: null, titel: "t", text: "x",
    empfehlung: "nachsehen", optionen: [{ key: "nachsehen", label: "Ja, im Bankbuch nachsehen", ton: "gut" as const, link: null, titel: null, harmlos: false },
      { key: "lassen", label: "Nein, so lassen", ton: "neutral" as const, link: null, titel: null, harmlos: true }],
    belege: [], status: "offen" as const, spaeterBis: null, entschiedenAm: null, entschiedenVon: null, gewaehlt: null, gewaehltLabel: null, ergebnis: null, fehler: null, createdAt: h.toISOString(),
  });
  const gruppen = ent.sammelGruppen([sicht(1), sicht(2), sicht(3)]);
  ok(gruppen.length === 1 && gruppen[0].anzahl === 3 && gruppen[0].empfehlungLabel === "Ja, im Bankbuch nachsehen", "drei gleiche Fälle → eine Sammelkarte");
  ok(gruppen[0].nein?.key === "lassen" && gruppen[0].nein?.label === "Nein, so lassen", "die Sammelkarte trägt „Nein, so lassen“");
  const ohneNein = ent.sammelGruppen([sicht(1), { ...sicht(2), optionen: [sicht(2).optionen[0]] }]);
  ok(ohneNein[0]?.nein === null, "fehlt einer Karte die harmlose Option → kein „Nein“ für alle");
  const kuend = ent.sammelGruppen([{ ...sicht(1), art: "kuendigung_ungebucht", empfehlung: "buchen", optionen: [{ ...sicht(1).optionen[0], key: "buchen" }, { ...sicht(1).optionen[1], key: "keine", harmlos: false }] },
    { ...sicht(2), art: "kuendigung_ungebucht", empfehlung: "buchen", optionen: [{ ...sicht(1).optionen[0], key: "buchen" }, { ...sicht(1).optionen[1], key: "keine", harmlos: false }] }]);
  ok(kuend[0]?.nein === null, "„Ist keine Kündigung“ ist kein harmloses Nein (schließt den Antrag) — kein Sammel-Nein");
  // Die Karte „Termin eintragen?“ (Ampel rot)
  const tk = auf.terminRotKarte({ personId: 4062, ref: "FIAON-Q406-2", agentId: 8, agentName: "Daniel Muster", wandzeit: "2026-10-21 11:00",
    beginn: new Date("2026-10-21T09:00:00Z"), herkunft: "mara_mail_genannt", vereinbart: true, kanal: "mail", kundeText: "morgen um 11 Gespräch mit Herrn Muster", quelle: "Mail #1", beleg: "laut Kunde" });
  ok(tk.empfehlung === "eintragen" && tk.optionen[0].werkzeug === "mara_termin_eintragen" && tk.optionen[1].werkzeug === "nichts", "Termin-Karte: Eintragen / Nicht eintragen");
  ok(tk.schluessel.startsWith("mara_termin_rot:4062:") && /Mi\.?, 21\.10\..*11:00/.test(tk.titel), "Termin-Karte: Schlüssel und Titel mit Zeit", tk.titel);
  // Die Postfach-Karte bei Ampel rot
  ok(pmE.entwurfFall(mailAmpelGrund("rot", "sauber, Automat erlaubt")) === "ampel", "Postfach: „Ampel rot“ ist ein eigener Fall");
  ok(pmE.entwurfFall("Widerruf nach Zahlung") === "widerruf", "Widerruf bleibt Widerruf");
  const pk = pmE.karteAusZeile({ id: 9001, person_id: 4063, betreff: "Frage", begruendung: mailAmpelGrund("rot", "sauber"), text: "Hallo", antwort: "Antwort" });
  ok(/Ampel rot/.test(pk.titel) && pk.empfehlung === "senden", "Karte „Ampel rot — Maras Antwort senden?“, Empfehlung senden", pk.titel);

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n11b. Gelb nur, wenn die 24-Stunden-Regel ihn WIRKLICH sendet (Nachbesserung, Prüfer-Fund)");
  {
    const FR = await import("../shared/fiaon-entwurf-frist");
    const j0 = new Date("2026-10-19T10:00:00Z"); // Mo. 12:00 Berlin
    const tage = (n: number) => new Date(j0.getTime() - n * 86_400_000);
    const gelbB = mailAmpelGrund("gelb", "sauber, Automat erlaubt");
    const basis = { neu: true, entwurfAm: j0, mailAm: new Date(j0.getTime() - 10 * 60_000), neuGeschriebenAm: null, begruendung: gelbB };
    ok(FR.fristLaesstLiegen(basis, null, j0) === null, "neue Zeile, frisch, frei: die Regel schreibt nach 24 h neu und sendet — Gelb darf warten");
    const a = FR.fristLaesstLiegen({ ...basis, neu: false }, null, j0);
    ok(/Altbestand/.test(a ?? ""), "(A) ohne Merker frist_ab (alter Entwurf, „Neu schreiben lassen“): die Regel ließe ihn liegen", a);
    const b = FR.fristLaesstLiegen({ ...basis, neuGeschriebenAm: new Date(j0.getTime() - 3_600_000) }, null, j0);
    ok(/schon einmal neu geschrieben/.test(b ?? ""), "(B) schon einmal von der Regel neu geschrieben: liegt", b);
    const c = FR.fristLaesstLiegen(basis, "Vertriebssperre", j0);
    ok(/Vertriebssperre/.test(c ?? "") && /Testkonto/.test(FR.fristLaesstLiegen(basis, "Testkonto", j0) ?? ""), "(C) Vertriebssperre oder Testkonto: liegt", c);
    ok(/nicht möglich/.test(FR.fristLaesstLiegen(basis, "Sperrprüfung nicht möglich", j0) ?? ""), "(C) Sperre nicht lesbar: liegt (lieber eine Karte)");
    const d = FR.fristLaesstLiegen({ ...basis, mailAm: tage(6.5) }, null, j0);
    ok(/älter als 7 Tage/.test(d ?? ""), "(D) Kundenmail 6,5 Tage alt: zur Fälligkeit (+24 h) über 7 Tage → liegt", d);
    ok(FR.fristLaesstLiegen({ ...basis, mailAm: tage(5) }, null, j0) === null, "Kundenmail 5 Tage alt: wird noch gesendet");
    const nacht = new Date("2026-10-19T19:30:00Z"); // 21:30 Berlin
    ok(FR.fristFaellig(nacht, nacht).toISOString() === "2026-10-21T06:00:00.000Z", "Fälligkeit im Versandfenster: Entwurf 21:30 → übermorgen 08:00", FR.fristFaellig(nacht, nacht).toISOString());
    const dn = FR.fristLaesstLiegen({ ...basis, entwurfAm: nacht, mailAm: new Date(nacht.getTime() - 5.6 * 86_400_000) }, null, nacht);
    ok(/älter als 7 Tage/.test(dn ?? ""), "(D) mit Versandfenster: Mail 5,6 Tage, Entwurf 21:30 → am Morgen der Fälligkeit über 7 Tage → liegt", dn);
    const w = FR.fristLaesstLiegen({ ...basis, begruendung: mailAmpelGrund("gelb", "Widerruf als Storno gebucht") }, null, j0);
    ok(/Widerruf/.test(w ?? ""), "Widerruf in der Begründung: die Regel schreibt ihn nicht neu → liegt", w);
    ok(/Global/.test(FR.fristLaesstLiegen({ ...basis, global: true }, null, j0) ?? ""), "Global-Kunde: liegt (die Regel fasst ihn nie an)");
    ok(FR.fristLaesstLiegen({ ...basis, entwurfAm: new Date(j0.getTime() - 30 * 3_600_000), mailAm: tage(1.3) }, null, j0) === null,
      "schon über 24 h, noch nicht dran (Takt, Fenster): kein „liegt“");
    // Dieselbe Regel wie der Lauf: wo fristLaesstLiegen „liegt“ sagt, sagt fristUrteil zur Fälligkeit „bleibt“/„auslassen“.
    const faellig = FR.fristFaellig(j0, j0);
    const fakten = { id: 1, neu: false, entwurfAm: j0, mailAm: basis.mailAm, neuGeschriebenAm: null, begruendung: gelbB, kategorien: [], flags: null,
      global: false, spaetereMail: null, stornoAm: null, kuendigungAm: null, gespraechAm: null, zahlungAm: null };
    ok(FR.fristUrteil(fakten, { modus: "auto", kiPausiert: false, altbestandAblegen: false, sperre: null }, faellig).art === "bleibt",
      "Gegenprobe: der Lauf selbst sagt zur Fälligkeit „bleibt“ (Altbestand) — genau der Fall, der vorher für immer lag");

    const gk = mailAmpelGelbKarteGrund("Testkonto — Mara schreibt nicht von selbst neu", "sauber");
    ok(istAmpelGelbKarte(gk) && !istAmpelGelbEntwurf(gk) && !istAmpelRotEntwurf(gk), "„Ampel gelb, als Karte“: eigener Kopf — kein gelber Entwurf (keine Ausnahme von der Karte)", gk);
    ok(!gk.startsWith("Ampel gelb:") && gelbKarteGrund(gk).startsWith("Testkonto") && gelbKarteGrund("Ampel gelb: x") === "", "der Grund lässt sich wieder lesen", gelbKarteGrund(gk));
    ok(pmE.entwurfFall(gk) === "ampel_gelb", "Postfach: „Ampel gelb, als Karte“ ist ein eigener Fall", pmE.entwurfFall(gk));
    ok(pmE.entwurfFall(mailAmpelGelbKarteGrund("Widerruf — entscheidest du (Entscheidungskarte)")) === "widerruf", "… mit Widerruf-Grund: die Widerruf-Karte (Vorsicht)");
    const gkarte = pmE.karteAusZeile({ id: 9002, person_id: 4064, betreff: "Frage", begruendung: gk, text: "Hallo", antwort: "Antwort" });
    ok(/Ampel gelb/.test(gkarte.titel) && /nie raus/.test(gkarte.text) && /Testkonto/.test(gkarte.text) && gkarte.empfehlung === "senden",
      "Karte „Ampel gelb — Maras Antwort senden?“ nennt den Grund", gkarte.text);
    const sOk = gelbEntwurfSatz("Frage zum Stand", FR.fristFaellig(j0, j0), null);
    ok(/frühestens Di\.?, 20\.10\., 12:00/.test(sOk) && /Karte/.test(sOk) && !/wenn sie darf/.test(sOk), "„Mara heute“: Satz mit Fälligkeit, ehrlich (sonst Karte)", sOk);
    const sLiegt = gelbEntwurfSatz("Frage zum Stand", FR.fristFaellig(j0, j0), "Vertriebssperre — Mara schreibt nicht von selbst neu");
    ok(/NICHT von selbst/.test(sLiegt) && /Vertriebssperre/.test(sLiegt) && /Karte/.test(sLiegt) && !/frühestens/.test(sLiegt), "„Mara heute“: liegt → „geht NICHT von selbst raus“ mit Grund", sLiegt);
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n12. Die Liste der Handlungen (SQL-Bau)");
  const heute = await import("../server/lib/fiaon-mara-heute");
  const alle = Object.fromEntries(heute.HANDLUNG_TABELLEN.map((t) => [t, true])) as any;
  const sql = heute.handlungenSql(alle, { mitText: true });
  ok((sql.match(/UNION ALL/g) ?? []).length === 10, "elf Teile, wenn alle Tabellen da sind", (sql.match(/UNION ALL/g) ?? []).length);
  ok(/w\.von LIKE 'Mara%' AND w\.von NOT LIKE '%\(Nachfass\)%'/.test(sql) && /w\.vorlage IS NULL/.test(sql), "WhatsApp: nur Maras eigene Antworten (keine Vorlagen der Strecken)");
  ok(/pm\.aktion = 'auto_beantwortet'/.test(sql), "Mails: nur, was Mara selbst gesendet hat");
  ok(/g\.kanal = 'mail'/.test(sql), "Angaben per WhatsApp nicht doppelt (stehen schon im Protokoll)");
  ok(/n\.status = 'versandt'/.test(sql), "Nachfass-Mail: nur versandt");
  const ohne = heute.handlungenSql({ ...alle, fiaon_mara_angaben: false, fiaon_mara_zahlung_funde: false }, { mitText: false });
  ok(!/fiaon_mara_angaben|fiaon_mara_zahlung_funde/.test(ohne) && !/LEFT\(COALESCE\(w\.text/.test(ohne), "fehlende Tabellen fallen heraus; ohne Text kein Text");
  const leer = heute.handlungenSql(Object.fromEntries(heute.HANDLUNG_TABELLEN.map((t) => [t, false])) as any, { mitText: false });
  ok(/WHERE FALSE/.test(leer) && /\$1/.test(leer) && /\$2/.test(leer), "ganz ohne Tabellen: leere Abfrage mit denselben Parametern");
  ok(heute.MARA_TERMIN_HERKUENFTE.includes("mara_whatsapp") && !(heute.MARA_TERMIN_HERKUENFTE as readonly string[]).includes("mara_whatsapp_link"), "„Termin absagen“ nur für Termine, die Mara eingetragen hat — nicht die, die der Kunde selbst gebucht hat");

  // ═════════════════════════════════════════════════════════════════════════
  console.log("\n13. Der Einbau in die Wege (Quelltext)");
  const lauf = quelle("server/lib/fiaon-postmeister-lauf.ts");
  ok(/const darfAuto = darfAutoOhneAmpel && !ampelGrund;/.test(lauf) && /mailDarfAuto\(stufe, \{ fristNeu: !!ein\.ampelFrist \}\)/.test(lauf), "Postfach: die Ampel hält nur an, was sonst rausginge");
  ok(/if \(darfAutoOhneAmpel\) \{/.test(lauf), "Postfach: die Ampel liest nur, wenn sonst gesendet würde (kein Lockern)");
  ok(/\} else if \(!ampelGelb\) \{/.test(lauf), "Postfach: ein gelber Entwurf ist keine Karte");
  ok(/if \(ampelGelb\) \{[\s\S]{0,400}gelbLiegenLesen[\s\S]{0,900}ampelGrund = mailAmpelGelbKarteGrund\(liegen, erg\.grund\);\s*ampelGelb = false;/.test(lauf),
    "Postfach: Gelb nur, wenn die 24-Stunden-Regel ihn später sendet — sonst Karte (Nachbesserung)");
  ok(/ampelFrist: true/.test(quelle("server/lib/fiaon-postmeister-frist.ts")), "24-Stunden-Regel: zweiter Anlauf darf bei Gelb senden");
  const pmEq = quelle("server/lib/fiaon-postmeister-entscheidungen.ts");
  ok(/NOT LIKE \$3/.test(pmEq) && /istAmpelGelbEntwurf\(z\.begruendung\)/.test(pmEq), "Karten: gelbe Entwürfe ausgenommen (Detektor und Sofort-Karte)");
  ok(/gelbeAlsKarten\(\(await lauf\.unsafe\(`\$\{GELB_SQL\}/.test(pmEq) && /for \(const k of await gelbeAlsKarten\(g \? \[g\] : \[\]\)\)/.test(pmEq),
    "Karten: … außer die 24-Stunden-Regel ließe sie liegen — dann doch eine Karte (Detektor und Sofort-Karte)");
  const heuteQ = quelle("server/lib/fiaon-mara-heute.ts");
  ok(!/wenn sie darf/.test(heuteQ) && /gelbEntwurfSatz\(x\.betreff, fristFaellig\(x\.am, jetzt\), liegen\.get/.test(heuteQ) && !/ORDER BY pm\.id DESC LIMIT 40/.test(heuteQ) && /mail_weitere/.test(heuteQ),
    "„Mara heute“: Satz aus demselben Urteil; kein stilles LIMIT 40 (Deckel mit „und N weitere“)");
  const wa = quelle("server/lib/fiaon-whatsapp-mara.ts");
  ok(/ampelRot\("termin_eintragen"\)/.test(wa) && /vorlegen: `Ampel rot \(Termine eintragen\)/.test(wa), "WhatsApp: Rückruf bei Rot nicht eingetragen, Karte vorgelegt");
  ok(/ampelRot\("ratenpause"\)/.test(wa) && /ohneSperreMoeglich: true, intern: "Ampel rot/.test(wa), "WhatsApp: Ratenpause bei Rot als Karte „Pause setzen“");
  ok(/ampelRot\("termin_eintragen"\)/.test(quelle("server/lib/fiaon-postmeister-werkzeuge.ts")), "Mail: Rückruf-Termin aus der Aufgabe bei Rot nicht eingetragen");
  const gen = quelle("server/lib/fiaon-mara-genannter-termin.ts");
  ok(/ampelRot\("termin_eintragen"/.test(gen) && /terminRotKarteAnlegen/.test(gen), "Genannter Termin: bei Rot die Karte „Termin eintragen?“");
  ok(/import\("\.\/fiaon-mara-aufraeumen"\)/.test(quelle("server/lib/fiaon-mara-entscheidungen.ts")), "Aufräumen wird mit den Karten geladen");
  ok(/kanal: "meldung"/.test(quelle("server/lib/fiaon-mara-aufraeumen.ts")) && /"mail" \| "whatsapp" \| "meldung"/.test(quelle("server/lib/fiaon-mara-zahlung-suchen.ts")), "Aufräumen: zahlung_suchen mit Kanal „Meldung“");
  const auf2 = quelle("server/lib/fiaon-mara-aufraeumen.ts");
  ok(!/bankeingangBuchen|ratenStornieren|erstattung|kuendigung_buchen|antragBuchen/.test(auf2.replace(/\/\/.*$/gm, "")), "Aufräumen ruft nie Buchen, Storno, Erstattung oder Kündigung");
  const routen = quelle("server/routes/fiaon-mara-heute.ts");
  ok(/router\.post\("\/chef\/mara-heute\/rueckgaengig", inhaber/.test(routen) && /router\.post\("\/chef\/mara\/ampel", inhaber/.test(routen), "Rückgängig und Ampel nur Stufe Inhaber");
  ok(/AUFSTIEG_FEHLT/.test(routen) && /trotzdem !== true/.test(routen), "Gelb → Grün ohne Vorschlag fragt nach (kein Automatismus, Justin entscheidet)");
  ok(/requireChef\("leitung"\)/.test(routen), "„Mara heute“ lesen ab Stufe Leitung");
  ok(netz === 0, "kein Netz benutzt");

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
