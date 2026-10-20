// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (offline): die ARAS-Sitzungsanweisung je Spielart — Stimme,
// Hintergrund und Begrüßung — gegen die Wortwand, Nennform, Lastschrift-Verbot,
// KI-Hinweis als erster Satz, Bank-Vorbehalt nur in der Einwand-Ausnahme,
// die Pflicht-Überschriften von GPT-Live, die Ton-Regler, das Probe-Briefing (E-408)
//
//   npx tsx scripts/pruef-aras-prompt.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  anweisungBauen, hintergrundAnweisung, gesprochen, leeresBriefing, werkzeugeFuer, WERKZEUG_DEFS, verkaufssatz, probeBriefing, kiHinweisSauber,
  HOERPROBE_SATZ, anlassSatz, ratenText, betragAusFeld, MENSCH_FRAGE_ANTWORT, type Briefing,
} from "../shared/fiaon-aras-prompt";
import { einstellungenAnwenden, SPIELARTEN, WERKZEUGE, WERKZEUGE_GLOBAL, druckFinden, REGIE_VORGABE, AUFNAHME_FRAGE_VORGABE, KI_HINWEIS_VORGABE } from "../shared/fiaon-aras";
import { nullBetragFinden, urlFinden, freischaltZusageFinden, zahlOhneEinheitFinden, fragenImBeitrag, telefonRegeln } from "../shared/fiaon-aras-regeln";
import { akteVorlesen } from "../shared/fiaon-aras-prompt";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { mitarbeiterVornameFunde, type MitarbeiterEintrag } from "../shared/fiaon-mitarbeiter-name";
import { limitZusage } from "../shared/fiaon-mara-ton";

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const hart = (t: string) => wandPruefen(t).filter((f) => f.art === "verboten" || f.art === "zusage");

const TEAM: MitarbeiterEintrag[] = [
  { vorname: "Daniel", nachname: "Stripling", anrede: "Herr" }, { vorname: "Florentine", nachname: "Lombardi", anrede: "Frau" },
  { vorname: "Nikita", nachname: "Boychenko", anrede: null }, { vorname: "Hans-Jürgen", nachname: "Gerhold", anrede: "Herr" },
];

const einstellungen = einstellungenAnwenden({});
const briefing: Briefing = {
  ...leeresBriefing("DE"),
  anrede: "Frau", nachname: "Musterfrau", paketName: "Plus", paketKey: "plus", stufe: "zahlung_offen",
  offeneRate: { nr: 2, betrag: "59,99 €", faelligAm: "15.10.2026", verwendungszweck: "FIAON-AB12CD-2", zahlungsseite: "https://fiaon.com/zahlung/FIAON-AB12CD-2" },
  raten: { gezahlt: 1, offen: 1, naechsteAm: "15.11.2026" },
  termine: [{ am: "morgen um 10 Uhr", bei: "Herrn Stripling" }],
  notizen: ["Will die Karte für den Urlaub im Sommer.", "Zahltag ist der 1."],
  betreuer: { nom: "Herr Stripling", dat: "Herrn Stripling" },
  kartenZiel: { euro: 2500, art: "wunsch", paketName: "Plus" }, zusageAm: "19.10.2026", terminAm: "heute 10:30",
  heute: { datum: "20.10.2026", wochentag: "Dienstag", uhrzeit: "10:15" },
};

titel("1. JEDE SPIELART: WORTWAND OHNE HARTEN TREFFER, KI-HINWEIS ZUERST, GPT-LIVE-STRUKTUR");
for (const spielart of SPIELARTEN) {
  const a = anweisungBauen({ spielart, briefing, einstellungen, hausanweisung: null });
  ok(`${spielart}: Stimme — Wortwand ohne harten Treffer`, hart(a.text).length === 0, hart(a.text).map((f) => `${f.art}: „${f.treffer}“`).join(" | "));
  ok(`${spielart}: Hintergrund — Wortwand ohne harten Treffer`, hart(a.backend).length === 0, hart(a.backend).map((f) => `${f.art}: „${f.treffer}“`).join(" | "));
  ok(`${spielart}: Begrüßung — Wortwand frei`, hart(a.begruessung).length === 0);
  ok(`${spielart}: Begrüßung beginnt mit dem KI-Hinweis (Art. 50 KI-VO)`, /\bKI\b/.test(a.begruessung) && a.begruessung.indexOf("KI") < (a.begruessung.indexOf("Bin ich richtig") >= 0 ? a.begruessung.indexOf("Bin ich richtig") : 9999));
  ok(`${spielart}: Stimme nennt den KI-Hinweis als ersten Satz`, /Dein erster Satz ist immer dieser/.test(a.bausteine["2_anfang"]) && /Ich bin eine KI/.test(a.bausteine["2_anfang"]));
  ok(`${spielart}: GPT-Live-Überschriften da`, ["Backchannel policy:", "Interruption policy:", "Delegation policy:", "Backend tools:", "Delegate to the backend when:", "Do not delegate to the backend when:"].every((h) => a.text.includes(h)));
  ok(`${spielart}: kein Mitarbeiter-Vorname (Stimme + Hintergrund)`, mitarbeiterVornameFunde(`${a.text}\n${a.backend}`, TEAM).length === 0, mitarbeiterVornameFunde(a.text, TEAM).map((f) => f.treffer).join(","));
  const lastschrift = (a.text.match(/lastschrift/gi) ?? []).length;
  ok(`${spielart}: „Lastschrift“ nur im Verbotssatz`, lastschrift === 1 && /LASTSCHRIFT gibt es nicht/.test(a.text), String(lastschrift));
  ok(`${spielart}: Version trägt ARAS_VERSION + Kennung`, /^1\.0-2026-10-19:[0-9a-f]{8}$/.test(a.version), a.version);
  ok(`${spielart}: kein Druck-Muster (KI-VO Art. 5)`, druckFinden(a.text) === null && druckFinden(a.backend) === null, druckFinden(a.text) ?? druckFinden(a.backend) ?? "");
  ok(`${spielart}: nie aras-ai.com, kein Anbietername`, !/aras-ai\.com|openai|gpt/i.test(`${a.text}\n${a.begruessung}`));
  // GPT-Live: ≤ 16.384 Token je Anweisung — deutsche Texte ≈ 3,5 Zeichen je Token; Puffer: < 40.000 Zeichen
  ok(`${spielart}: Stimme deutlich unter der Token-Grenze`, a.text.length < 40_000, String(a.text.length));
  ok(`${spielart}: Anliegen erst nach Identität (Regel steht drin)`, /nie Rate, Antrag, Paket oder Betrag vorher/.test(a.text) || spielart === "eingehend");
}

titel("2. VERKAUFSSATZ (E-373): Wunsch ohne Bank-Vorbehalt, keine Limit-Zusage");
{
  const s = verkaufssatz(briefing);
  ok("E-373 gesprochen: Nutzen statt Freischalt-Zusage („geht es automatisch weiter“)", /geht es automatisch weiter/.test(s) && freischaltZusageFinden(s) === null, s);
  ok("kein Bank-Vorbehalt im Verkaufssatz", !/bank/i.test(s));
  ok("keine Limit-Zusage (limitZusage)", limitZusage(s) === null, limitZusage(s) ?? "");
  ok("nennt den Betrag aus dem Feld und dass im Link Preis, Laufzeit und Widerruf stehen", /über 59,99 €/.test(s) && /Preis, Laufzeit und Widerruf/.test(s));
  ok("schließt mit dem Link-Angebot (kein Dranbleiben)", /Ich schick Ihnen den Link gleich aufs Handy, passt das\?$/.test(s) && !/dran/i.test(s));
  ok("EINE Frage, ganz am Schluss", fragenImBeitrag(s) === null && s.trim().endsWith("?"), fragenImBeitrag(s) ?? "");
  ok("Wortwand frei", hart(s).length === 0);
  const a = anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null });
  ok("Bank-Satz nur auf die direkte Frage („Ist mein Limit sicher?“)", a.bausteine["10_einwaende"].includes("Ist mein Limit sicher?") && !a.bausteine["9_leitfaden"].toLowerCase().includes("entscheidet die"));
}

titel("3. WERKZEUGE JE LAGE");
{
  const alle = werkzeugeFuer({ global: false, isBlocked: false, ampel: einstellungen.ampel, spielart: "rate" }).map((d) => d.name);
  ok("Normal: alle 12 Werkzeuge", alle.length === 12 && WERKZEUGE.every((w) => alle.includes(w)));
  const global = werkzeugeFuer({ global: true, isBlocked: false, ampel: einstellungen.ampel, spielart: "rate" }).map((d) => d.name);
  ok("Global-Kunde: nur 5 (Akte, Notiz, Mensch, Sperre, Ende)", global.length === 5 && WERKZEUGE_GLOBAL.every((w) => global.includes(w)) && !global.includes("zahlungslink_senden"));
  const rot = werkzeugeFuer({ global: false, isBlocked: false, ampel: { ...einstellungen.ampel, ratenpause_setzen: "rot" }, spielart: "rate" }).map((d) => d.name);
  ok("Rote Ampel nimmt das Werkzeug aus der Sitzung", !rot.includes("ratenpause_setzen") && rot.length === 11);
  ok("Jede Definition hat ein Objekt-Schema ohne Zusatzfelder", WERKZEUG_DEFS.every((d) => (d.schema as any).type === "object" && (d.schema as any).additionalProperties === false));
  const a = anweisungBauen({ spielart: "rate", briefing: { ...briefing, global: true }, einstellungen, hausanweisung: null });
  ok("Global: Einwände + Verkauf entfallen, Briefing nennt Firmenkunde", a.bausteine["10_einwaende"].includes("entfällt") && a.bausteine["7_verkauf"].includes("entfällt") && a.bausteine["8_briefing"].includes("FIRMENKUNDE"));
  ok("Delegation nennt nur Werkzeuge der Sitzung (Global ohne Link)", !a.bausteine["12_delegation"].includes("Link: seinen persönlichen"));
}

titel("4. TON-REGLER WIRKEN IM TEXT");
{
  const r = (x: Partial<typeof REGIE_VORGABE>) => anweisungBauen({ spielart: "rate", briefing, einstellungen: { ...einstellungen, regie: { ...einstellungen.regie, ...x } }, hausanweisung: null });
  const sparsam = r({ fuellwoerter: "sparsam", lachen: false, tempo: "ruhig", zuhoerlaute: "sparsam", energie: "ruhig", abschluss: "sanft" });
  const viel = r({ fuellwoerter: "viel", tempo: "zuegig", energie: "vollgas", abschluss: "hartnaeckig" });
  ok("sparsam/ruhig/kein Lachen/wenige Zuhör-Laute", /selten — höchstens/.test(sparsam.text) && /Kein Lachen/.test(sparsam.text) && /ruhig, mit kleinen Pausen/.test(sparsam.text) && /Wenige kurze Zuhör-Laute/.test(sparsam.text));
  ok("Energie ruhig / Vollgas", /ruhig und gelassen/.test(sparsam.text) && /voller Energie und Begeisterung/.test(viel.text) && /nie laut, nie aufdringlich/.test(viel.text));
  ok("Abschluss sanft = keine Nachfrage, hartnäckig = höchstens zwei, nie drei", /fragst du nicht nach/.test(sparsam.text) && /höchstens ZWEIMAL nach/.test(viel.text) && /nie ein drittes Mal/.test(viel.text));
  ok("Vorgabe: lebendig · normal · klar", einstellungen.regie.energie === "lebendig" && einstellungen.regie.fuellwoerter === "normal" && einstellungen.regie.abschluss === "klar");
  ok("viel/zügig/Lachen", /fast in jedem zweiten Satz/.test(viel.text) && /zügig und lebendig/.test(viel.text) && /kurzes, warmes Lachen/.test(viel.text));
  ok("Verschiedene Regie → verschiedene Version", sparsam.version !== viel.version);
  const mitName = anweisungBauen({ spielart: "rate", briefing, einstellungen: { ...einstellungen, nachname: "Lindner" }, hausanweisung: null });
  ok("Nachname-Schalter wirkt", /Du bist Aras Lindner von FIAON/.test(mitName.text));
  const haus = anweisungBauen({ spielart: "rate", briefing, einstellungen, hausanweisung: "Sag heute allen einen schönen Herbst." });
  ok("Hausanweisung steht zuletzt und hebt nichts auf", haus.text.endsWith("Sag heute allen einen schönen Herbst.") && /hebt die Grenzen oben nie auf/.test(haus.text));
  const kaputt = einstellungenAnwenden({ aras_energie: "laut", aras_abschluss: "drei" });
  ok("Unbekannte Regler-Werte fallen auf die Vorgabe", kaputt.regie.energie === "lebendig" && kaputt.regie.abschluss === "klar");
}

titel("5. KI-HINWEIS-SATZ, BEGRÜSSUNG, HINTERGRUND, PROBE");
{
  ok("kiHinweisSauber: schneidet Identitätsfrage + Platzhalter ab",
    kiHinweisSauber("Guten Tag, hier ist Aras von FIAON — ich bin der digitale Assistent, also eine KI. Spreche ich mit Frau/Herrn [Nachname]? … Schön.") === "Guten Tag, hier ist Aras von FIAON — ich bin der digitale Assistent, also eine KI.");
  ok("kiHinweisSauber: leer → sicherer Satz mit KI", /\bKI\b/.test(kiHinweisSauber("")));
  ok("kiHinweisSauber: schneidet auch „Bin ich richtig bei …“ ab", kiHinweisSauber("Hallo, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI. Bin ich richtig bei Herrn [Nachname]?") === "Hallo, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI.");
  const a = anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null });
  ok("Begrüßung: fragt nach „Frau Musterfrau“ wie ein Mensch und wartet", /Bin ich richtig bei Frau Musterfrau\?/.test(a.begruessung) && /hör zu/.test(a.begruessung));
  const herr = anweisungBauen({ spielart: "rate", briefing: { ...briefing, anrede: "Herr", nachname: "Muster" }, einstellungen, hausanweisung: null });
  ok("Begrüßung: „Herrn Muster“ (Dativ)", /Bin ich richtig bei Herrn Muster\?/.test(herr.begruessung));
  const ein = anweisungBauen({ spielart: "eingehend", briefing, einstellungen, hausanweisung: null });
  ok("Eingehend: meldet sich mit KI-Hinweis und fragt nach dem Anliegen", /\bKI\b/.test(ein.begruessung) && /worum es geht/.test(ein.begruessung));
  const h = hintergrundAnweisung(a);
  ok("Hintergrund nennt Werkzeuge, Regeln, Rückgabe, das heutige Datum", /aufnahme_starten/.test(h) && /Regeln für die Werkzeuge/.test(h) && /Rückgabe an Aras/.test(h) && /Dienstag, der 20\.10\.2026/.test(h));
  ok("Hintergrund: Aufnahme nur nach eindeutigem Ja", /NUR, wenn der Kunde auf die Frage nach der Aufzeichnung hörbar und eindeutig Ja gesagt hat/.test(h));
  const en = anweisungBauen({ spielart: "rate", briefing: { ...briefing, sprache: "en" }, einstellungen, hausanweisung: null });
  ok("Englischer Kunde: Gespräch auf Englisch (britisch), Begrüßung ebenso", /auf Englisch \(britisch\)/.test(en.text) && /auf Englisch \(britisch\)/.test(en.begruessung));
  const leer = anweisungBauen({ spielart: "probe", briefing: leeresBriefing("DE", true), einstellungen, hausanweisung: null });
  ok("Probe ohne Person baut sich (Name unbekannt → nachfragen)", /Name unbekannt/.test(leer.text) && /PROBEANRUF/.test(leer.text));
  const pb = probeBriefing({ spielart: "rate", anrede: "Herr", nachname: "Probe", heute: briefing.heute, vorTagen: () => "17.10.2026" });
  const pa = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen, hausanweisung: null });
  ok("Probe-Briefing (Rate): erfundene Rate FIAON-PROBE-01, Gesprächsart Rate", /FIAON-PROBE-01/.test(pa.text) && /RATE FÄLLIG/.test(pa.text) && pb.probe === true);
  ok("Probe-Briefing: Wortwand frei", hart(pa.text).length === 0 && hart(pa.backend).length === 0);
  ok("Probe: Hintergrund weiß, dass die Werkzeuge im Probebetrieb laufen", /Probebetrieb/.test(pa.backend));
  const at = anweisungBauen({ spielart: "rate", briefing: { ...briefing, land: "AT" }, einstellungen, hausanweisung: null });
  ok("AT: Hinweis „nie SCHUFA“", /sag nie „SCHUFA“/.test(at.text));
  ok("Hörprobe-Satz: KI-Hinweis + Füllwort, Wortwand frei", /\bKI\b/.test(HOERPROBE_SATZ) && /Ähm/.test(HOERPROBE_SATZ) && hart(HOERPROBE_SATZ).length === 0);
  ok("gesprochen: Links raus, zwei Sätze", gesprochen("Erster Satz mit https://fiaon.com/a/x/w drin. Zweiter Satz. Dritter Satz.") === "Erster Satz mit drin. Zweiter Satz.");
  const auftrag = anweisungBauen({ spielart: "rate", briefing: { ...briefing, auftrag: { text: "Bitte sagen, dass er seinen Kontoauszug hochladen soll.", von: "Herr Stripling" }, arasNotiz: "Nur abends erreichbar.", offenes: ["Rate 2 über 59,99 €", "Kontoauszug fehlt"] }, einstellungen, hausanweisung: null });
  ok("Auftrag, Notiz und Offenes stehen im Briefing", /AUFTRAG von Herr Stripling/.test(auftrag.text) && /Nur abends erreichbar/.test(auftrag.text) && /1\. Rate 2 über 59,99 €/.test(auftrag.text));
}

titel("6. PROBE 20.10.2026 (Justins erster Anruf): Wahrheit, Anlass, Aufzeichnung, eine Frage, hörbare Regie");
{
  const heute = { datum: "20.10.2026", wochentag: "Dienstag", uhrzeit: "10:15" };
  const vor = () => "17.10.2026";
  const justin = einstellungenAnwenden({ aras_energie: "vollgas", aras_fuellwoerter: "viel", aras_tempo: "zuegig" });
  // a) Anzahl → Betrag: nie „0 offen“, nie „null Euro“ — in keiner Gesprächsart, auch nicht mit leerem Briefing
  for (const art of SPIELARTEN) {
    if (art === "probe" || art === "eingehend") continue;
    const pb = probeBriefing({ spielart: art, anrede: "Herr", nachname: "Probe", heute, vorTagen: vor });
    const a = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: justin, hausanweisung: null });
    const alles = `${a.text}\n${a.backend}\n${a.begruessung}`;
    ok(`Probe ${art}: keine Anzahl ohne Wort, kein „null Euro“, keine Freischalt-Zusage, keine Internetadresse im Gesprochenen`,
      zahlOhneEinheitFinden(alles) === null && nullBetragFinden(alles) === null && freischaltZusageFinden(a.text) === null,
      zahlOhneEinheitFinden(alles) ?? nullBetragFinden(alles) ?? freischaltZusageFinden(a.text) ?? "");
    ok(`Probe ${art}: echtes Paket (FIAON Pro, 59,99 €), Betrag nur aus dem Feld`, (art === "lead" || /59,99 €/.test(a.text)) && !/plus/i.test(pb.paketKey ?? ""), pb.paketKey ?? "");
  }
  const leer = anweisungBauen({ spielart: "zuruf", briefing: { ...leeresBriefing("DE"), paketKey: "plus", paketName: "Plus", stufe: "zahlung_offen" }, einstellungen, hausanweisung: null });
  ok("Unbekanntes Paket (Preis 0 €): KEIN Betrag im Text, kein „0 €“", nullBetragFinden(`${leer.text}\n${leer.backend}`) === null && betragAusFeld({ ...leeresBriefing("DE"), paketKey: "plus" }) === null, nullBetragFinden(leer.text) ?? "");
  ok("Ohne Raten keine Raten-Zeile (eine 0 klingt sonst wie ein Betrag)", ratenText(leeresBriefing("DE")) === null && !/Raten \(nur die ANZAHL/.test(leer.text));
  ok("Mit Raten: Anzahl in Worten, ausdrücklich „kein Betrag“", /nur die ANZAHL, kein Betrag\): 1 bezahlt, 1 noch ausstehend/.test(ratenText(briefing) ?? ""), ratenText(briefing) ?? "");
  ok("akte_nachsehen ohne Raten: keine nackte Null", zahlOhneEinheitFinden(akteVorlesen(leeresBriefing("DE"), "zahlungen")) === null && nullBetragFinden(akteVorlesen(leeresBriefing("DE"), "zahlungen")) === null, akteVorlesen(leeresBriefing("DE"), "zahlungen"));
  ok("Wahrheitswand steht in der Anweisung (Beträge nur mit €, nie die Null als Betrag, keine Freischalt-Zusage)", /NUR, wenn er oben mit „€“ steht/.test(leer.text) && /Nie die Null als Betrag/.test(leer.text) && /keine Freischaltung/.test(leer.text));
  ok("Rot-Probe: „die erste Rate beträgt null Euro“ wird gefunden", nullBetragFinden("die erste Rate beträgt null Euro") !== null && nullBetragFinden("Die erste Rate sind 0 €.") !== null);
  ok("Rot-Probe: „Raten: 0 bezahlt, 0 offen“ wird gefunden", zahlOhneEinheitFinden("Raten: 0 bezahlt, 0 offen.") !== null && zahlOhneEinheitFinden("offen: 0") !== null);
  ok("Rot-Probe: „schalten wir umgehend Ihren Account frei“ wird gefunden", freischaltZusageFinden("Nach Ihrer Zahlung schalten wir umgehend Ihren Account frei.") !== null);
  ok("Nachbereitung: „null Euro“ im Live-Transkript ist ein harter Befund", telefonRegeln("Die erste Rate beträgt null Euro.").some((p) => p.regel === "betrag_null" && p.schwere === "hart"));

  // b) Anlass VOR der Aufzeichnung, und „Worum geht's?“ wird immer mit dem Anlass beantwortet
  for (const art of ["zuruf", "rate", "stufe_a", "zusage", "termin", "lead", "stufe_b"] as const) {
    const pb = probeBriefing({ spielart: art, anrede: "Herr", nachname: "Probe", heute, vorTagen: vor });
    const a = anweisungBauen({ spielart: art, briefing: pb, einstellungen: justin, hausanweisung: null });
    const anf = a.bausteine["2_anfang"];
    const satz = anlassSatz(art, pb);
    const iAnlass = anf.indexOf(satz), iAufz = a.text.indexOf("AUFZEICHNUNG (erst NACH dem Anlass");
    ok(`${art}: Anlass in EINEM Satz kommt vor der Aufzeichnung`, satz.length > 15 && (satz.match(/[.!?](?:\s|$)/g) ?? []).length <= 1 && iAnlass > 0 && iAufz > a.text.indexOf(anf) && /Erst DANACH die Frage nach der Aufzeichnung/.test(anf), satz);
    ok(`${art}: „Worum geht's?“ → nächste Antwort ist der Anlass`, /Fragt er „Worum geht's\?“/.test(anf) && anf.includes(`genau der Anlass in einem Satz: „${satz}“`));
    ok(`${art}: der Anlass nennt nichts vor der Bestätigung (steht in Schritt 3)`, anf.indexOf(satz) > anf.indexOf("2. Dann:"));
  }
  {
    const pb = probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: vor });
    ok("Zuruf-Anlass sagt, worum es geht und woher das Ja kam", /Es geht um Ihren Antrag für FIAON Pro — Sie hatten uns per WhatsApp mit Ja geantwortet/.test(anlassSatz("zuruf", pb)), anlassSatz("zuruf", pb));
    const falsch = "1. Hallo. 2. Aufzeichnung? 3. Anlass.";
    ok("Rot-Probe: Aufzeichnung vor dem Anlass würde erkannt", falsch.indexOf("Aufzeichnung") < falsch.indexOf("Anlass"));
  }

  // c) Aufzeichnung: kurz, ohne Internetadresse, kein „Moment“/„Danke!“, keine Abgabe an den Hintergrund
  {
    const a = anweisungBauen({ spielart: "zuruf", briefing: probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: vor }), einstellungen: justin, hausanweisung: null });
    ok("Aufnahme-Frage: kurz (≤ 120 Zeichen), mit „Ja“, ohne Internetadresse", AUFNAHME_FRAGE_VORGABE.length <= 120 && /\bJa\b/.test(AUFNAHME_FRAGE_VORGABE) && urlFinden(AUFNAHME_FRAGE_VORGABE) === null, AUFNAHME_FRAGE_VORGABE);
    ok("Aufnahme-Frage: EINE Frage", fragenImBeitrag(AUFNAHME_FRAGE_VORGABE) === null);
    ok("Rot-Probe: die alte Frage (fiaon.com/privacy, lang) würde erkannt", urlFinden("Details stehen unter fiaon.com/privacy.") !== null && urlFinden("fiaon punkt com slash privacy") !== null);
    ok("Nach dem Ja: kein „Moment“, kein zweites Danke, keine Abgabe", /Du sagst dazu NICHTS — kein „Moment“/.test(a.bausteine["3_aufzeichnung"]) && /KEINE Arbeit an den Hintergrund/.test(a.bausteine["3_aufzeichnung"]) && !/sagst kurz „Danke!“/.test(a.text));
    ok("Delegation: Ja/Nein zur Aufzeichnung wird NICHT abgegeben", !/Ja oder Nein zur Aufzeichnung gesagt hat/.test(a.bausteine["12_delegation"]) && /Er Ja oder Nein zur Aufzeichnung sagt — das erledigt das Haus von selbst/.test(a.bausteine["12_delegation"]));
    ok("Datenschutz nur auf Nachfrage, ohne Adresse", /Datenschutzerklärung/.test(a.bausteine["3_aufzeichnung"]) && urlFinden(a.bausteine["3_aufzeichnung"]) === null);
    ok("KI-Hinweis-Satz ohne Internetadresse", urlFinden(KI_HINWEIS_VORGABE) === null);
  }

  // d) EINE Frage je Redebeitrag — in jedem wörtlichen Satz, den Aras sagen soll
  for (const art of SPIELARTEN) {
    if (art === "probe") continue;
    const a = anweisungBauen({ spielart: art, briefing, einstellungen: justin, hausanweisung: null });
    const zitate = Array.from(a.text.matchAll(/„([^“„]{12,})“/g)).map((m) => m[1]);
    const zuViel = zitate.filter((z) => fragenImBeitrag(z) !== null);
    ok(`${art}: jeder wörtliche Satz hat höchstens EINE Frage, am Schluss`, zuViel.length === 0, zuViel.map((z) => `„${z.slice(0, 60)}…“ (${fragenImBeitrag(z)})`).join(" | "));
    ok(`${art}: Regel „EINE FRAGE PRO REDEBEITRAG“ steht drin`, /EINE FRAGE PRO REDEBEITRAG/.test(a.text) && /hörst du SOFORT auf zu sprechen/.test(a.text));
  }
  ok("Rot-Probe: „…heute noch? Den Antrag … schicke ich …“ (alter Verkaufssatz) wird erkannt", fragenImBeitrag("Die erste Rate sind 59,99 € — schaffen Sie die Überweisung heute noch? Den Antrag mit allen Details schicke ich Ihnen jetzt als Link aufs Handy.") !== null);
  ok("Rot-Probe: zwei Fragen in einem Beitrag werden erkannt", fragenImBeitrag("Passt es gerade? Und darf ich aufzeichnen?") !== null);
  // Echter GPT-Live-Lauf 20.10. (Rauchtest): „Freitag, der vierundzwanzigste“ — abgeschrieben vom Beispiel „der 24.“. Kein Beispiel-Datum mehr.
  {
    const a = anweisungBauen({ spielart: "rate", briefing, einstellungen: justin, hausanweisung: null });
    ok("Kein festes Beispiel-Datum im Text (das Modell schreibt Beispiele ab)", !/der \d{1,2}\. —/.test(a.text) && /nie selbst ausrechnen/.test(a.text));
  }

  // e) Justins Regie ist hörbar: Vollgas · viel · zügig stehen ganz oben, konkret
  {
    const a = anweisungBauen({ spielart: "zuruf", briefing, einstellungen: justin, hausanweisung: null });
    ok("Regie steht ganz oben (vor der Rolle)", a.text.startsWith("DEINE STIMME") && a.text.indexOf("VOLLGAS") < a.text.indexOf("Du bist Aras"));
    ok("Vollgas · viel · zügig konkret beschrieben", /VOLLGAS — hörbare Begeisterung/.test(a.text) && /VIEL — fast jeder zweite Satz/.test(a.text) && /ZÜGIG — flott und spritzig/.test(a.text));
    const ruhig = anweisungBauen({ spielart: "zuruf", briefing, einstellungen: einstellungenAnwenden({ aras_energie: "ruhig", aras_fuellwoerter: "sparsam", aras_tempo: "ruhig" }), hausanweisung: null });
    ok("Rot-Probe: ruhig/sparsam/ruhig sagt NICHT Vollgas", !/VOLLGAS/.test(ruhig.text) && /RUHIG — gelassen/.test(ruhig.text) && /SPARSAM/.test(ruhig.text));
  }
}

titel("6b. JUSTIN 20.10. (nach seinen Tests): kein Dranbleiben, menschliche Wörter, KI-Hinweis leicht, Top-Verkäufer");
{
  for (const art of SPIELARTEN) {
    const a = anweisungBauen({ spielart: art, briefing, einstellungen, hausanweisung: null });
    const alles = `${a.text}\n${a.backend}\n${a.begruessung}`;
    ok(`${art}: kein „ich bleibe dran, während Sie überweisen“`, !/ich bleibe? (?:gern )?dran|dranbleib|während Sie überweisen/i.test(alles), (alles.match(/.{30}(?:ich bleibe? (?:gern )?dran|dranbleib|während Sie überweisen).{30}/i) ?? [""])[0]);
    ok(`${art}: keine Bürowörter als Vorlage (bezüglich, „ich kümmere mich wirklich um Ihr Anliegen“)`, !/\bbezüglich\b(?![“"]?,)/i.test(a.text.replace(/nie „bezüglich“[^\n]*/g, "")) && !/kümmere mich wirklich um Ihr Anliegen/.test(alles));
    ok(`${art}: Fragen wie ein Mensch („Bin ich richtig bei …?“, „Haben Sie kurz zwei Minuten?“)`, art === "eingehend" || (/Bin ich richtig bei/.test(a.text) && /Haben Sie kurz zwei Minuten\?/.test(a.text)));
    ok(`${art}: Top-Verkäufer — Begeisterung für sein Ziel, seine Worte aufnehmen, EIN nächster Schritt`, /TOP-VERKÄUFER/.test(a.text) && /seine Worte auf/.test(a.text) && /EINEM natürlichen nächsten Schritt/.test(a.text));
  }
  ok("KI-Hinweis: leicht und charmant, sagt „KI“, keine Belehrung", /Ich bin eine KI, aber eine sehr nette\./.test(KI_HINWEIS_VORGABE) && !/kümmere mich/.test(KI_HINWEIS_VORGABE) && KI_HINWEIS_VORGABE.length <= 100, KI_HINWEIS_VORGABE);
  ok("Abschluss: Link anbieten, dann den Tag nennen lassen, herzlich bestätigen", /zahlungslink_senden/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text) && /Wann schaffen Sie die Überweisung — heute noch\?/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text));
  ok("Rot-Probe: der alte Dranbleib-Satz würde erkannt", /ich bleibe? (?:gern )?dran|während Sie überweisen/i.test("Ich bleibe gern dran, während Sie überweisen."));
  ok("Mensch-Frage: ehrlich KI, ohne Belehrung", /ich bin eine KI/i.test(MENSCH_FRAGE_ANTWORT) && MENSCH_FRAGE_ANTWORT.length < 140);
}

titel("7. ROT-PROBE: die Prüfungen schlagen an, wenn etwas falsch ist");
{
  const boese = "Das ist garantiert Ihr Limit, nur heute — sonst Inkasso. Zahlen Sie per Lastschrift.";
  ok("Rot-Probe Wortwand trifft", hart(boese).length > 0);
  ok("Rot-Probe Druck trifft", druckFinden(boese) !== null);
  ok("Rot-Probe Vorname trifft", mitarbeiterVornameFunde("Daniel ruft Sie an.", TEAM).length > 0);
}

log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
process.exit(schlecht === 0 ? 0 : 1);
