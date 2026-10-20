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
  HOERPROBE_SATZ, anlassFakten, ratenText, betragAusFeld, MENSCH_FRAGE_ANTWORT, euroGesprochen, LINK_ANGEBOT, AUFNAHME_ZOEGERN_SATZ, ABSCHIED_EINFORDERN, type Briefing,
} from "../shared/fiaon-aras-prompt";
import {
  einstellungenAnwenden, SPIELARTEN, WERKZEUGE, WERKZEUGE_GLOBAL, druckFinden, REGIE_VORGABE, AUFNAHME_FRAGE_VORGABE, KI_HINWEIS_VORGABE,
  aufnahmeFrageSauber, aufnahmeFrageFehler, GEDULD_MS,
} from "../shared/fiaon-aras";
import {
  nullBetragFinden, urlFinden, zahlOhneEinheitFinden, fragenImBeitrag, telefonRegeln, wiederholtSich, wiederholungFinden, nurFuellwort, fuellwortQuote,
  satzAehnlichkeit, abschiedGesagt, WIEDERHOLUNG_HINWEIS,
} from "../shared/fiaon-aras-regeln";
import { nachDemEingang } from "../shared/fiaon-mara-ton";
import { kiHinweisFuer, dialektAnweisung } from "../shared/fiaon-aras-prompt";
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
  ok(`${spielart}: Stimme nennt den KI-Hinweis als ersten Satz (Pflicht 1)`, /1\. Dein erster Satz enthält den KI-Hinweis/.test(a.bausteine["2_anfang"]) && /Ich bin eine KI/.test(a.bausteine["2_anfang"]));
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
  // E-373 (Justin): „Nach Ihrer Zahlung mit dem Verwendungszweck … schalten wir umgehend Ihren Account frei, damit Sie schnellstmöglich …“
  // — EINE Quelle mit Mara (nachDemEingang), gesprochen nur um den Betrag aus dem Betragsfeld ergänzt.
  // Am Telefon ohne „mit Ihrem Verwendungszweck“ (Justins Test 20.10., Anruf 6) — sonst wortgleich mit Mara.
  const kern = nachDemEingang({ anfang: true, ziel: briefing.kartenZiel ?? null }).replace(" mit Ihrem Verwendungszweck", "");
  ok("E-373: eine Quelle mit Mara (nachDemEingang), nur um den Betrag ergänzt, ohne Verwendungszweck", s.replace(" über 59,99 €", "").startsWith(kern) && /schalten wir umgehend Ihren Account frei/.test(s) && !/Verwendungszweck/.test(s), s);
  ok("kein Bank-Vorbehalt im Verkaufssatz", !/bank/i.test(s));
  ok("keine Limit-Zusage (limitZusage)", limitZusage(s) === null, limitZusage(s) ?? "");
  ok("nennt den Betrag aus dem Feld und den Widerruf einmal, kurz und natürlich", /über 59,99 €/.test(s) && /mit allen Infos, auch zum Widerruf/.test(s) && (s.match(/Widerruf/g) ?? []).length === 1);
  ok("schließt mit dem Link-Angebot (kein Dranbleiben)", s.endsWith(LINK_ANGEBOT) && /Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos, auch zum Widerruf — passt das\?$/.test(s) && !/dran/i.test(s));
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
  ok("viel/zügig/Lachen — „viel“ heißt locker, höchstens jeder dritte Satz", /höchstens in jedem dritten Satz/.test(viel.text) && !/fast (?:jeder|in jedem) zweite/.test(viel.text) && /zügig und lebendig/.test(viel.text) && /kurzes, warmes Lachen/.test(viel.text));
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
      zahlOhneEinheitFinden(alles) === null && nullBetragFinden(alles) === null,
      zahlOhneEinheitFinden(alles) ?? nullBetragFinden(alles) ?? "");
    ok(`Probe ${art}: echtes Paket (FIAON Pro, 59,99 €), Betrag nur aus dem Feld`, (art === "lead" || /59,99 €/.test(a.text)) && !/plus/i.test(pb.paketKey ?? ""), pb.paketKey ?? "");
  }
  const leer = anweisungBauen({ spielart: "zuruf", briefing: { ...leeresBriefing("DE"), paketKey: "plus", paketName: "Plus", stufe: "zahlung_offen" }, einstellungen, hausanweisung: null });
  ok("Unbekanntes Paket (Preis 0 €): KEIN Betrag im Text, kein „0 €“", nullBetragFinden(`${leer.text}\n${leer.backend}`) === null && betragAusFeld({ ...leeresBriefing("DE"), paketKey: "plus" }) === null, nullBetragFinden(leer.text) ?? "");
  ok("Ohne Raten keine Raten-Zeile (eine 0 klingt sonst wie ein Betrag)", ratenText(leeresBriefing("DE")) === null && !/Raten \(nur die ANZAHL/.test(leer.text));
  ok("Mit Raten: Anzahl in Worten, ausdrücklich „kein Betrag“", /nur die ANZAHL, kein Betrag\): 1 bezahlt, 1 noch ausstehend/.test(ratenText(briefing) ?? ""), ratenText(briefing) ?? "");
  ok("akte_nachsehen ohne Raten: keine nackte Null", zahlOhneEinheitFinden(akteVorlesen(leeresBriefing("DE"), "zahlungen")) === null && nullBetragFinden(akteVorlesen(leeresBriefing("DE"), "zahlungen")) === null, akteVorlesen(leeresBriefing("DE"), "zahlungen"));
  ok("Wahrheitswand steht in der Anweisung (Beträge nur mit €, nie die Null als Betrag)", /NUR, wenn er oben mit „€“ steht/.test(leer.text) && /Nie die Null als Betrag/.test(leer.text));
  ok("Rot-Probe: Verkaufssatz mit unbekanntem Paket nennt keinen Betrag (statt „0 €“)", nullBetragFinden(verkaufssatz({ ...leeresBriefing("DE"), paketKey: "plus", stufe: "zahlung_offen" })) === null && /^Nach Ihrer Zahlung schalten wir umgehend/.test(verkaufssatz({ ...leeresBriefing("DE"), paketKey: "plus", stufe: "zahlung_offen" })));
  ok("Rot-Probe: „die erste Rate beträgt null Euro“ wird gefunden", nullBetragFinden("die erste Rate beträgt null Euro") !== null && nullBetragFinden("Die erste Rate sind 0 €.") !== null);
  ok("Rot-Probe: „Raten: 0 bezahlt, 0 offen“ wird gefunden", zahlOhneEinheitFinden("Raten: 0 bezahlt, 0 offen.") !== null && zahlOhneEinheitFinden("offen: 0") !== null);
  ok("Nachbereitung: „null Euro“ im Live-Transkript ist ein harter Befund", telefonRegeln("Die erste Rate beträgt null Euro.").some((p) => p.regel === "betrag_null" && p.schwere === "hart"));

  // b) Anlass als FAKTEN (Justins Test 20.10., Anruf 5: dreimal wortgleich derselbe Satz) — nach der Identität, Aufzeichnung früh
  for (const art of ["zuruf", "rate", "stufe_a", "zusage", "termin", "lead", "stufe_b"] as const) {
    const pb = probeBriefing({ spielart: art, anrede: "Herr", nachname: "Probe", heute, vorTagen: vor });
    const a = anweisungBauen({ spielart: art, briefing: pb, einstellungen: justin, hausanweisung: null });
    const anf = a.bausteine["2_anfang"];
    const f = anlassFakten(art, pb);
    ok(`${art}: Anlass als Fakten (offen · was du willst · was er davon hat), in eigenen Worten`, !!f && anf.includes(`· Offen: ${f.offen}`) && anf.includes("· Was du willst:") && anf.includes("· Was er davon hat:") && /nie vorgelesen/.test(anf), f?.offen ?? "");
    ok(`${art}: 1–3 Beispiele, untereinander verschieden (nie zum Vorlesen)`, !!f && f.beispiele.length >= 1 && f.beispiele.length <= 3 && f.beispiele.every((x, i) => f.beispiele.every((y, j) => i === j || satzAehnlichkeit(x, y) < 0.5)), f?.beispiele.join(" | ") ?? "");
    ok(`${art}: der Anlass kommt erst nach der Identität (Pflicht 2 steht davor)`, anf.indexOf("WORUM ES GEHT") > anf.indexOf("2. Einzelheiten erst"));
    ok(`${art}: kein Vorlese-Befehl mehr („deine NÄCHSTE Antwort ist genau der Anlass“)`, !/NÄCHSTE Antwort ist genau der Anlass/.test(a.text) && !/Pflicht, in dieser Reihenfolge/.test(a.text));
    ok(`${art}: Aufzeichnung früh — sobald er weiß, worum es geht`, /Die Frage nach der Aufzeichnung kommt früh/.test(anf) && /AUFZEICHNUNG \(früh, sobald er weiß, worum es geht\)/.test(a.text));
  }
  {
    const pb = probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: vor });
    const f = anlassFakten("zuruf", pb)!;
    const anf = anweisungBauen({ spielart: "zuruf", briefing: pb, einstellungen: justin, hausanweisung: null }).bausteine["2_anfang"];
    ok("Zuruf: sagt, WAS offen ist und was er davon hat (nicht nur, warum Aras anrufen darf)", /erste Zahlung/.test(f.offen) && /Visa-Kreditkarte/.test(f.nutzen) && !/WhatsApp/.test(f.offen), f.offen);
    ok("Zuruf: das WhatsApp-Ja höchstens einmal, nebenbei", (anf.match(/WhatsApp/g) ?? []).length === 1 && /höchstens EINMAL und nur nebenbei/.test(anf) && /grünes Licht/.test(anf));
    ok("Zuruf: Justins Beispiel ist dabei (Antrag fertig, erste Zahlung fehlt, Richtung eigene Visa-Karte)", f.beispiele.some((x) => /es fehlt nur noch die erste Zahlung, dann geht's los Richtung eigene Visa-Karte mit Ihrem Wunschlimit/.test(x)));
  }

  // c) Aufzeichnung: kurz, ohne Internetadresse, kein „Moment“/„Danke!“, keine Abgabe an den Hintergrund
  {
    const a = anweisungBauen({ spielart: "zuruf", briefing: probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: vor }), einstellungen: justin, hausanweisung: null });
    ok("Aufnahme-Frage: kurz (≤ 120 Zeichen), EIN Satz mit „?“ am Schluss, ohne Internetadresse", AUFNAHME_FRAGE_VORGABE.length <= 120 && AUFNAHME_FRAGE_VORGABE.trim().endsWith("?") && aufnahmeFrageFehler(AUFNAHME_FRAGE_VORGABE) === null && urlFinden(AUFNAHME_FRAGE_VORGABE) === null, AUFNAHME_FRAGE_VORGABE);
    ok("Aufnahme-Frage: EINE Frage, kein Nachsatz", fragenImBeitrag(AUFNAHME_FRAGE_VORGABE) === null && !/kurzes Ja reicht/i.test(AUFNAHME_FRAGE_VORGABE));
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
    ok("Vollgas · viel · zügig konkret beschrieben („viel“ = locker, nicht mehr Füllwörter)", /VOLLGAS — hörbare Begeisterung/.test(a.text) && /VIEL heißt LOCKER, nicht mehr Füllwörter/.test(a.text) && /ZÜGIG — flott und spritzig/.test(a.text));
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
    ok(`${art}: Fragen wie ein Mensch („Bin ich richtig bei …?“, „Passt's gerade kurz?“ — nicht hinter den Anlass gestapelt)`, art === "eingehend" || (/Bin ich richtig bei/.test(a.text) && /Passt's gerade kurz\?/.test(a.text) && !/Haben Sie kurz zwei Minuten/.test(a.text)));
    ok(`${art}: Top-Verkäufer — Begeisterung für sein Ziel, seine Worte aufnehmen, EIN nächster Schritt`, /TOP-VERKÄUFER/.test(a.text) && /seine Worte auf/.test(a.text) && /EINEM natürlichen nächsten Schritt/.test(a.text));
  }
  ok("KI-Hinweis: leicht und charmant, sagt „KI“, keine Belehrung", /Ich bin eine KI, aber eine sehr nette\./.test(KI_HINWEIS_VORGABE) && !/kümmere mich/.test(KI_HINWEIS_VORGABE) && KI_HINWEIS_VORGABE.length <= 100, KI_HINWEIS_VORGABE);
  ok("Abschluss: Link anbieten, dann den Tag nennen lassen, herzlich bestätigen", /zahlungslink_senden/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text) && /Wann schaffen Sie die Überweisung — heute noch\?/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text));
  ok("Rot-Probe: der alte Dranbleib-Satz würde erkannt", /ich bleibe? (?:gern )?dran|während Sie überweisen/i.test("Ich bleibe gern dran, während Sie überweisen."));
  ok("Mensch-Frage: ehrlich KI, ohne Belehrung", /ich bin eine KI/i.test(MENSCH_FRAGE_ANTWORT) && MENSCH_FRAGE_ANTWORT.length < 140);
}

titel("6c. DIALEKT (aras_dialekt, Justin 20.10.): Hochdeutsch als Vorgabe, Österreichisch leicht oder deutlich — nie tiefer Dialekt");
{
  const hd = einstellungenAnwenden({});
  ok("Vorgabe: Hochdeutsch, „Hallo“, kein „Grüß Gott“", hd.regie.dialekt === "hochdeutsch" && /^Hallo, hier ist Aras/.test(kiHinweisFuer(hd)) && dialektAnweisung("hochdeutsch") === "");
  const leicht = einstellungenAnwenden({ aras_dialekt: "oesterreichisch_leicht" });
  const a = anweisungBauen({ spielart: "rate", briefing, einstellungen: leicht, hausanweisung: null });
  ok("Leicht österreichisch: „Grüß Gott“ statt „Hallo“, KI-Hinweis bleibt (Art. 50)", /^Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI/.test(kiHinweisFuer(leicht)) && a.begruessung.includes("Grüß Gott") && /\bKI\b/.test(a.begruessung));
  ok("Leicht österreichisch: Akzent + Wörter, die jeder versteht („passt“, „a bissl“, „gell“), nie tiefer Dialekt", /LEICHT ÖSTERREICHISCH/.test(a.text) && /a bissl/.test(a.text) && /jeder muss dich mühelos verstehen/.test(a.text));
  ok("„Servus“ nur zum Abschied und nur für Kunden aus Österreich", /„Servus“ sagst du nur zum Abschied und nur zu Kunden aus Österreich/.test(a.text) && !/Servus/.test(anweisungBauen({ spielart: "rate", briefing, einstellungen: hd, hausanweisung: null }).text));
  const voll = einstellungenAnwenden({ aras_dialekt: "oesterreichisch" });
  ok("Österreichisch: deutlicher Akzent, trotzdem verständlich; Sprechprobe kennt den Akzent", /ÖSTERREICHISCH — deutlich/.test(anweisungBauen({ spielart: "rate", briefing, einstellungen: voll, hausanweisung: null }).text) && /Wiener Satzmelodie/.test(dialektAnweisung("oesterreichisch_leicht")));
  ok("Rot-Probe: unbekannter Dialekt fällt auf Hochdeutsch", einstellungenAnwenden({ aras_dialekt: "bairisch_tief" }).regie.dialekt === "hochdeutsch");
  ok("Wortwand frei mit Dialekt", hart(a.text).length === 0 && hart(a.begruessung).length === 0, hart(a.text).map((f) => f.treffer).join(","));
}

titel("8. JUSTINS TESTS 20.10. (Anrufe 5 und 6): keine Schleife, zuhören, Füllwörter, Bedarf, Zögern, Beträge, Abschied");
{
  const justin = einstellungenAnwenden({ aras_energie: "vollgas", aras_fuellwoerter: "viel", aras_tempo: "zuegig", aras_dialekt: "oesterreichisch" });
  const heute = { datum: "20.10.2026", wochentag: "Dienstag", uhrzeit: "10:15" };
  const pb = probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "17.10.2026" });
  const a = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: justin, hausanweisung: null });
  // 1. Schleife: nie wiederholen, anders und konkreter, zurückfragen
  ok("1 Schleife: Regel „NIE WIEDERHOLEN“ — anders und konkreter, zurückfragen", /NIE WIEDERHOLEN: Sag nie einen Satz zweimal gleich/.test(a.text) && /antworte ANDERS und konkreter/.test(a.text) && /„Was genau möchten Sie wissen\?“/.test(a.text));
  ok("1 Schleife: der Hintergrund gibt bei einer Nachfrage konkrete Fakten statt derselben Antwort", /nie dieselbe Antwort wie vorher/.test(a.backend));
  // 2. Wiederholungs-Wache (die Brücke nutzt genau diese Funktion)
  const s1 = "ähm es geht um Ihren Antrag für FIAON Pro — Sie hatten uns per WhatsApp mit Ja geantwortet, dass ich Sie anrufen darf. Haben Sie kurz zwei Minuten?";
  const s2 = "Es geht um Ihren Antrag für FIAON Pro — Sie hatten uns per WhatsApp mit Ja geantwortet, dass ich Sie anrufen darf. Haben Sie kurz zwei Minuten?";
  ok("2 Rot-Probe: Anruf 5 — derselbe Satz (mit/ohne „ähm“) ist eine Wiederholung", wiederholtSich(s2, [s1]) !== null && wiederholtSich(s2, [s1])! >= 0.8, String(wiederholtSich(s2, [s1])));
  ok("2 Rot-Probe: schon im laufenden Satz (ab acht Wörtern) erkannt", wiederholtSich("Es geht um Ihren Antrag für FIAON Pro — Sie hatten", [s1], true) !== null);
  ok("2 Ein anderer, konkreter Satz ist KEINE Wiederholung", wiederholtSich("Ihr Antrag ist fertig, es fehlt nur noch die erste Zahlung — danach geht's Richtung eigene Visa-Karte.", [s1]) === null);
  ok("2 Kurze Sätze („Super, passt.“) zählen nicht", wiederholtSich("Super, passt.", ["Super, passt."]) === null);
  ok("2 Hinweis-Wortlaut aus der Koordination", WIEDERHOLUNG_HINWEIS === "Du hast dich gerade wiederholt. Sag es anders, konkreter, und frag, was er genau wissen will.");
  // 3. Zuhören: Regler, Anweisung, Geduld-Tor
  ok("3 aras_zuhoeren: Vorgabe geduldig, Unbekanntes fällt auf geduldig", einstellungenAnwenden({}).regie.zuhoeren === "geduldig" && einstellungenAnwenden({ aras_zuhoeren: "hektisch" }).regie.zuhoeren === "geduldig" && einstellungenAnwenden({ aras_zuhoeren: "flott" }).regie.zuhoeren === "flott");
  ok("3 Geduld-Tor: geduldig ≥ 700 ms, normal kürzer, flott ohne Tor", GEDULD_MS.geduldig >= 700 && GEDULD_MS.normal < GEDULD_MS.geduldig && GEDULD_MS.flott === 0);
  ok("3 Anweisung: geduldig ausreden lassen, nie in die Denkpause", /Zuhören: GEDULDIG — du lässt ihn immer ausreden/.test(a.text) && /fängst nie in seine Denkpause hinein an/.test(a.text) && /eine kurze Pause ist kein Ende/.test(a.text));
  const flott = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_zuhoeren: "flott" }), hausanweisung: null });
  ok("3 Rot-Probe: flott sagt FLOTT, nicht GEDULDIG", /Zuhören: FLOTT/.test(flott.text) && !/Zuhören: GEDULDIG/.test(flott.text) && flott.version !== anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({}), hausanweisung: null }).version);
  ok("3 Füllwort nie als eigener Redebeitrag (Anweisung)", /nie als eigener Redebeitrag/.test(a.text) && /nie erst „Also …“ und dann Pause/.test(a.text));
  ok("3 Rot-Probe: „Also...“ allein ist ein abgebrochener Ansatz, „Mhm.“ beim Zuhören nicht", nurFuellwort("Also...") && nurFuellwort("Ähm") && !nurFuellwort("Mhm.") && !nurFuellwort("Hm.") && !nurFuellwort("Also, am besten direkt auf Ihre Nummer."));
  // 4. Weniger Skript: nur drei Pflichten
  ok("4 Nur drei Pflichten (KI-Hinweis, Identität vor Details, Aufnahme nur nach Ja), der Rest Orientierung", /DREI PFLICHTEN/.test(a.text) && /3\. Aufgezeichnet wird nur nach einem klaren Ja/.test(a.text) && /ALLES ANDERE IST ORIENTIERUNG/.test(a.text) && !/\n4\. /.test(a.bausteine["2_anfang"]));
  // 6. Füllwörter: höchstens jeder dritte Satz, nur wo ein Mensch denkt; „Ach so“ nur bei Neuem
  ok("6 Füllwörter nur, wo ein Mensch nachdenkt; „Ach so“ nur bei wirklich Neuem", /NUR da, wo ein Mensch nachdenkt/.test(a.text) && /NIE am Anfang jedes Satzes/.test(a.text) && /„Ach so“ nur, wenn du gerade wirklich etwas Neues erfährst/.test(a.text));
  // 7. Verkauf: erst Bedarf, spiegeln, dann Abschluss
  const vk = a.bausteine["7_verkauf"];
  ok("7 Bedarfsfrage → spiegeln → Abschluss (in dieser Reihenfolge)", vk.indexOf("Bedarfsfrage") >= 0 && vk.indexOf("Bedarfsfrage") < vk.indexOf("spiegeln") && vk.indexOf("spiegeln") < vk.indexOf(verkaufssatz(pb)) && /Wofür möchten Sie die Karte vor allem nutzen\?/.test(vk));
  ok("7 Spiegeln mit seinem Wunsch, gesprochen („fünftausend Euro“)", /gerade für Reisen ist Ihr Wunschlimit von fünftausend Euro ideal/.test(vk), vk.slice(0, 300));
  ok("7 Leitfaden: Bedarf vor dem Abschluss, Abschied am Ende", /eine Bedarfsfrage → spiegeln → Abschluss/.test(a.bausteine["9_leitfaden"]) && /→ Abschied/.test(a.bausteine["9_leitfaden"]));
  // 8. Zögern bei der Aufzeichnung
  ok("8 Zögern („hm“): ruhig, Wahl lassen, EINE klare Frage am Schluss — nie drängeln", /Zögert er \(„hm“/.test(a.text) && a.text.includes(AUFNAHME_ZOEGERN_SATZ) && fragenImBeitrag(AUFNAHME_ZOEGERN_SATZ) === null && /völlig okay/.test(AUFNAHME_ZOEGERN_SATZ) && /Darf ich aufzeichnen\?$/.test(AUFNAHME_ZOEGERN_SATZ) && !/kurzes Ja reicht/i.test(a.text));
  ok("8 „Ja, aber …?“ ist keine Zustimmung: erst seine Frage beantworten, dann noch einmal fragen (Rauchtest 20.10.)", /Ein „Ja, aber …\?“ oder ein Ja mit Gegenfrage ist KEINE Zustimmung/.test(a.bausteine["3_aufzeichnung"]) && fragenImBeitrag(AUFNAHME_ZOEGERN_SATZ) === null);
  ok("8 Hintergrund: Zögern ist noch keine Antwort (kein Werkzeug), erst danach ablehnen", /Zögern \(„hm“, „äh“, eine Rückfrage\) ist noch keine Antwort — dann KEIN Werkzeug/.test(a.backend));
  ok("8 Rot-Probe: die alte gespeicherte Frage mit Nachsatz wird gesäubert bzw. abgelehnt", aufnahmeFrageSauber("Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist? Ein kurzes Ja reicht.") === "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?" && aufnahmeFrageFehler("Darf ich aufzeichnen? Ein kurzes Ja reicht.") !== null && einstellungenAnwenden({ aras_aufnahme_frage: "Darf ich aufzeichnen? Ein kurzes Ja reicht." }).aufnahmeFrage === AUFNAHME_FRAGE_VORGABE);
  // 9. Beträge wie ein Mensch, Verwendungszweck nur mit Zusammenhang, Widerruf einmal
  ok("9 Beträge gesprochen: „neunundfünfzig Euro neunundneunzig“, „fünftausend Euro“, „sieben Euro neunundneunzig“", euroGesprochen("59,99 €") === "neunundfünfzig Euro neunundneunzig" && euroGesprochen(5000) === "fünftausend Euro" && euroGesprochen("7,99 €") === "sieben Euro neunundneunzig" && euroGesprochen("1.234,50 €") === "tausendzweihundertvierunddreißig Euro fünfzig" && euroGesprochen("0 €") === null && euroGesprochen(null) === null);
  ok("9 Anweisung: Beträge immer mit „Euro“, Briefing nennt die gesprochene Form", /„neunundfünfzig Euro neunundneunzig“ \(immer mit „Euro“\)/.test(a.text) && /59,99 € \(gesprochen: „neunundfünfzig Euro neunundneunzig“\)/.test(a.text) && !/„neunundfünfzig neunundneunzig“/.test(a.text));
  ok("9 Verkauf ohne „mit Ihrem Verwendungszweck“, Widerruf einmal im Link-Angebot", !/mit Ihrem Verwendungszweck/.test(a.bausteine["7_verkauf"]) && /auch zum Widerruf/.test(LINK_ANGEBOT) && /Preis, Laufzeit und Widerruf/.test(a.bausteine["7_verkauf"]));
  // 10. Abschied
  const ab = a.bausteine["13_abschluss"];
  ok("10 Abschluss: bestätigen → nächster Schritt → Abschied mit Namen; nie direkt nach „Moment“", /Erst warm bestätigen/.test(ab) && /nächste Schritt/.test(ab) && /Danke Ihnen, Herr Probe, und einen schönen Tag noch!/.test(ab) && /nie direkt nach „Moment“, nie ohne Abschied/.test(ab));
  ok("10 Hintergrund: anruf_beenden erst nach dem hörbaren Abschied; nach Link/Zusage nicht vorbei", /anruf_beenden immer zuletzt — ERST wenn Aras sich in der Abschrift hörbar verabschiedet hat/.test(a.backend) && /ist das Gespräch NICHT vorbei/.test(a.backend) && /nie direkt nach „Moment“/.test(WERKZEUG_DEFS.find((d) => d.name === "anruf_beenden")!.beschreibung));
  ok("10 Delegation: „Moment“ ist nie der letzte Satz", /Ein „Moment“ ist nie dein letzter Satz/.test(a.text));
  ok("10 Abschied-Einforderung (Brücke) verlangt Bestätigung, nächsten Schritt, Name, gute Wünsche", /Bestätige kurz und herzlich/.test(ABSCHIED_EINFORDERN) && /nächsten Schritt/.test(ABSCHIED_EINFORDERN) && /Namen und guten Wünschen/.test(ABSCHIED_EINFORDERN));
  ok("10 Abschied erkannt: „schönen Tag noch“, „Auf Wiederschauen“ — „Moment.“ nicht", abschiedGesagt("Danke Ihnen, Herr Probe, und einen schönen Tag noch!") && abschiedGesagt("Auf Wiederschauen!") && !abschiedGesagt("Sehr gut, ähm, Moment."));
  // Prüf-Befunde auf Justins Transkripten (Name erfunden): Anruf 5 und Anruf 6 sind ROT, ein gutes Gespräch ist grün
  const A = (text: string) => ({ wer: "aras" as const, text }), K = (text: string) => ({ wer: "kunde" as const, text });
  const anruf5 = [A("Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette."), A("Bin ich richtig bei Herrn Probe?"), A("Also..."), K("Ja, bitte, um was geht's"), A(s1), K("Ja, aber um was geht's dabei"), A(s2), A("Also..."), K("Ja, aber worum geht's dabei"), A(s2)];
  const p5 = telefonRegeln(anruf5.filter((z) => z.wer === "aras").map((z) => z.text).join("\n"), { transkript: anruf5 } as any).map((p) => p.regel);
  ok("Rot-Probe Anruf 5: Wiederholung + Füllwort allein werden Befund", p5.includes("wiederholung") && p5.includes("fuellwort_allein"), p5.join(","));
  ok("Rot-Probe Anruf 5: wiederholungFinden zeigt den wiederholten Satz", (wiederholungFinden(anruf5) ?? "").startsWith("Es geht um Ihren Antrag"));
  const anruf6 = [A("Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette."), A("Bin ich richtig bei Herrn Probe?"), K("Ja, worum geht's"),
    A("Ach so, ähm, ja, es geht um Ihren Antrag für FIAON Pro — Sie hatten uns per WhatsApp mit Ja geantwortet."), K("Ja, gern"), A("Also, darf ich unser Gespräch kurz aufzeichnen?"), K("hm"), A("Ein kurzes Ja reicht."), K("Ja"),
    A("Super. ähm, also nach Ihrer Zahlung über neunundfünfzig neunundneunzig schalten wir umgehend Ihren Account frei."), K("Ja, wohin schicken Sie das"), A("Also, am besten direkt auf Ihre Nummer."), K("Okay"),
    A("Okay, ähm, Moment, ich schick's Ihnen gleich rüber. Also, äh, wann schaffen Sie die Überweisung — heute noch?"), K("Ja, klar"), A("Sehr gut, ähm, Moment.")];
  const q6 = fuellwortQuote(anruf6);
  const p6 = telefonRegeln(anruf6.filter((z) => z.wer === "aras").map((z) => z.text).join("\n"), { transkript: anruf6, arasBeendet: true } as any).map((p) => p.regel);
  ok("Rot-Probe Anruf 6: Füllwörter am Satzanfang (> jeder dritte) + aufgelegt ohne Abschied werden Befund", p6.includes("fuellwort_satzanfang") && p6.includes("abschied_fehlt") && q6.quote > 0.34, `${p6.join(",")} · ${q6.mit}/${q6.von}`);
  const gut = [A("Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI, aber eine sehr nette."), A("Bin ich richtig bei Herrn Probe?"), K("Ja, worum geht's?"),
    A("Ihr Antrag für FIAON Pro ist fertig — es fehlt nur noch die erste Zahlung, dann geht's Richtung eigene Visa-Karte."), K("Ah, okay."), A("Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?"), K("Ja."),
    A("Super. Wofür möchten Sie die Karte vor allem nutzen?"), K("Für Reisen."), A("Hm, gerade für Reisen ist Ihr Wunschlimit ideal. Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos, auch zum Widerruf — passt das?"), K("Ja."),
    A("Wann schaffen Sie die Überweisung — heute noch?"), K("Ja, heute."), A("Super, dann notier ich mir heute — der Link ist gleich per WhatsApp bei Ihnen. Danke Ihnen, Herr Probe, und einen schönen Tag noch!")];
  const pg = telefonRegeln(gut.filter((z) => z.wer === "aras").map((z) => z.text).join("\n"), { transkript: gut, arasBeendet: true } as any).map((p) => p.regel);
  ok("Grün-Probe: ein menschliches Gespräch hat keinen dieser Befunde", !["wiederholung", "fuellwort_allein", "fuellwort_satzanfang", "abschied_fehlt"].some((r) => pg.includes(r)), pg.join(","));
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
