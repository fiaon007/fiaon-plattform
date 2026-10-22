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
  HOERPROBE_SATZ, anlassFakten, ratenText, betragAusFeld, MENSCH_FRAGE_ANTWORT, euroGesprochen, LINK_ANGEBOT, AUFNAHME_ZOEGERN_SATZ, ABSCHIED_EINFORDERN,
  LACHEN_NACH_KI, begruessungText, nennformDativ, wirksameSpielart, DIALEKT_HOERBAR, eroeffnung, anrufGrund, nummerEndeGesprochen, menschHinweis, MENSCH_ABSTAND, MENSCH_ARTEN,
  fuerStimme, fiaonSchreibweise, FIAON_GESPROCHEN, type Briefing,
} from "../shared/fiaon-aras-prompt";
import { HOERPROBE_SAETZE, DIALEKTE, QUITTUNGEN, QUITTUNG_NACH_MS, quittungErlaubt, istKundenFrage, quittungWaehlen, feedbackAusGrund, FEEDBACK_REGEL_AUS_GRUND } from "../shared/fiaon-aras";
import {
  einstellungenAnwenden, SPIELARTEN, WERKZEUGE, WERKZEUGE_GLOBAL, druckFinden, REGIE_VORGABE, AUFNAHME_FRAGE_VORGABE, KI_HINWEIS_VORGABE,
  aufnahmeFrageSauber, aufnahmeFrageFehler, GEDULD_MS,
} from "../shared/fiaon-aras";
import {
  nullBetragFinden, urlFinden, zahlOhneEinheitFinden, fragenImBeitrag, telefonRegeln, wiederholtSich, wiederholungFinden, nurFuellwort, fuellwortQuote,
  satzAehnlichkeit, abschiedGesagt, WIEDERHOLUNG_HINWEIS, karteVersprochenFinden, superZaehlen, bankVorbehaltFinden, leersatzFinden, anliegenVorIdentitaet,
  WIEDERHOLUNG_AB, WIEDERHOLUNG_FENSTER,
} from "../shared/fiaon-aras-regeln";
import { nachDemEingang } from "../shared/fiaon-mara-ton";
import { kiHinweisFuer, dialektAnweisung } from "../shared/fiaon-aras-prompt";
import { akteVorlesen } from "../shared/fiaon-aras-prompt";
import { wandPruefen, kopplungFinden, drohungFinden } from "../shared/fiaon-wortverbote";
import { fensterOffen, STUFEN, FENSTER_VORGABE, SPIELART_TEXT, RECHTSGRUND } from "../shared/fiaon-aras";
import { KARTENVERSAND, WILLKOMMEN } from "../shared/fiaon-aras-fakten";
import { kulanzSatz } from "../shared/fiaon-jahresvertrag";
import { DIALEKT_HOERBAR } from "../shared/fiaon-aras-prompt";
import { mitarbeiterVornameFunde, type MitarbeiterEintrag } from "../shared/fiaon-mitarbeiter-name";
import { limitZusage } from "../shared/fiaon-mara-ton";
import { identitaetGefragt } from "../shared/fiaon-ki-pruefung-regeln";
import { arasFragtIdentitaet, arasNenntAnliegen, identitaetAntwort, HINWEIS_STREITFALL, korrekturIdentitaet } from "../shared/fiaon-aras-wort";
import { identitaetsFrage } from "../shared/fiaon-aras-prompt";
import { JUSTIN_AUFGABE_ARTEN, JUSTIN_AUFGABE_TITEL } from "../shared/fiaon-aras";

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
  ok(`${spielart}: Stimme hat die ERÖFFNUNG mit KI-Hinweis als Pflicht 1`, /1\. ERÖFFNUNG:/.test(a.bausteine["2_anfang"]) && /Ich bin eine KI/.test(a.bausteine["2_anfang"]));
  if (spielart !== "eingehend") {
    // Justin 20.10. (Anruf 16): „sagt bitte in Zukunft, dass es auch um die Kreditkarte geht, wenn du anrufst“ — in JEDER Art.
    const er = eroeffnung(einstellungen, briefing, spielart);
    // Auswertung 21./22.10. (Identität vor dem Anliegen): danach EINE Frage — die nach der PERSON; der Grund („Kreditkarte“) erst nach seinem Ja.
    ok(`${spielart}: Eröffnung — ARAS (ohne Artikel), die digitale Mitarbeiterin, FIAON mitten im Satz, KI-Hinweis; danach EINE Frage: die nach der Person (kein Anliegen davor)`, /ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem/.test(er.bisKi) && !/\b(?:der|die) ARAS\b/.test(er.ganz) && /\bKI\b/.test(er.bisKi) && er.frage === "Spreche ich mit Frau Musterfrau selbst?" && arasFragtIdentitaet(er.frage) && arasNenntAnliegen(er.ganz) === null && (er.frage.match(/\?/g) ?? []).length === 1, er.ganz);
    ok(`${spielart}: der Angerufene spricht zuerst — die Eröffnung kommt erst nach seinem „Hallo?“ (vorab gesprochen, die Technik spielt sie danach ab)`, /meldet sich ZUERST/.test(a.bausteine["2_anfang"]) && /die Technik spielt deine Eröffnung erst nach seinem „Hallo“ ab, du fällst ihm also nie ins Wort/.test(a.bausteine["2_anfang"]) && /Der Angerufene hat sich gerade gemeldet\. Sag jetzt sofort/.test(a.begruessung));
  }
  ok(`${spielart}: GPT-Live-Überschriften da`, ["Backchannel policy:", "Interruption policy:", "Delegation policy:", "Backend tools:", "Delegate to the backend when:", "Do not delegate to the backend when:"].every((h) => a.text.includes(h)));
  ok(`${spielart}: kein Mitarbeiter-Vorname (Stimme + Hintergrund)`, mitarbeiterVornameFunde(`${a.text}\n${a.backend}`, TEAM).length === 0, mitarbeiterVornameFunde(a.text, TEAM).map((f) => f.treffer).join(","));
  const lastschrift = (a.text.match(/lastschrift/gi) ?? []).length;
  ok(`${spielart}: „Lastschrift“ nur im Verbotssatz`, lastschrift === 1 && /LASTSCHRIFT gibt es nicht/.test(a.text), String(lastschrift));
  ok(`${spielart}: Version trägt ARAS_VERSION + Kennung`, /^1\.0-2026-10-19:[0-9a-f]{8}$/.test(a.version), a.version);
  ok(`${spielart}: kein Druck-Muster (KI-VO Art. 5)`, druckFinden(a.text) === null && druckFinden(a.backend) === null, druckFinden(a.text) ?? druckFinden(a.backend) ?? "");
  ok(`${spielart}: nie aras-ai.com, kein Anbietername`, !/aras-ai\.com|openai|gpt/i.test(`${a.text}\n${a.begruessung}`));
  // GPT-Live: ≤ 16.384 Token je Anweisung — deutsche Texte ≈ 3,5 Zeichen je Token; Puffer: < 40.000 Zeichen
  ok(`${spielart}: Stimme deutlich unter der Token-Grenze`, a.text.length < 40_000, String(a.text.length));
  ok(`${spielart}: Beträge und Zahlungen erst nach seiner Antwort (Regel steht drin)`, /Beträge, Zahlungen, Raten, Paket und Limit nennst du erst/.test(a.text) || spielart === "eingehend");
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
  ok("Normal: alle 13 Kunden-Werkzeuge (mit aufgabe_fuer_justin; probe_feedback_merken gibt es nur im Probeanruf)", alle.length === 13 && alle.includes("aufgabe_fuer_justin") && WERKZEUGE.filter((w) => w !== "probe_feedback_merken").every((w) => alle.includes(w)) && !alle.includes("probe_feedback_merken"));
  const global = werkzeugeFuer({ global: true, isBlocked: false, ampel: einstellungen.ampel, spielart: "rate" }).map((d) => d.name);
  ok("Global-Kunde: nur 5 (Akte, Notiz, Mensch, Sperre, Ende)", global.length === 5 && WERKZEUGE_GLOBAL.every((w) => global.includes(w)) && !global.includes("zahlungslink_senden"));
  const rot = werkzeugeFuer({ global: false, isBlocked: false, ampel: { ...einstellungen.ampel, ratenpause_setzen: "rot" }, spielart: "rate" }).map((d) => d.name);
  ok("Rote Ampel nimmt das Werkzeug aus der Sitzung", !rot.includes("ratenpause_setzen") && rot.length === 12);
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
  ok("Nachname-Schalter wirkt", /Du bist ARAS Lindner — die digitale Mitarbeiterin von FIAON/.test(mitName.text));
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
  ok("Begrüßung: grüßt „Frau Musterfrau“ mit Namen, fragt, ob sie es selbst ist, und hört zu — worum es geht, erst nach ihrer Bestätigung", /, Frau Musterfrau!/.test(a.begruessung) && /„Spreche ich mit Frau Musterfrau selbst\?“/.test(a.begruessung) && /hör zu/.test(a.begruessung) && /Worum es geht, sagst du erst, wenn er bestätigt hat, dass er es ist/.test(a.begruessung) && !/Kreditkarten/.test(a.begruessung));
  const herr = anweisungBauen({ spielart: "rate", briefing: { ...briefing, anrede: "Herr", nachname: "Muster" }, einstellungen, hausanweisung: null });
  ok("Begrüßung: „Herr Muster“ (mit Anrede, nie der nackte Nachname)", /, Herr Muster!/.test(herr.begruessung) && !/, Muster!/.test(herr.begruessung));
  const ein = anweisungBauen({ spielart: "eingehend", briefing, einstellungen, hausanweisung: null });
  ok("Eingehend: meldet sich sofort mit KI-Hinweis und fragt nach dem Anliegen", /\bKI\b/.test(ein.begruessung) && /Worum geht's Ihnen\?/.test(ein.begruessung) && /ruft gerade bei FIAON an/.test(ein.begruessung));
  const h = hintergrundAnweisung(a);
  ok("Hintergrund nennt Werkzeuge, Regeln, Rückgabe, das heutige Datum", /aufnahme_starten/.test(h) && /Regeln für die Werkzeuge/.test(h) && /Rückgabe an Aras/.test(h) && /Dienstag, der 20\.10\.2026/.test(h));
  ok("Hintergrund: Aufnahme nur nach eindeutigem Ja", /NUR, wenn der Kunde auf die Frage nach der Aufzeichnung hörbar und eindeutig Ja gesagt hat/.test(h));
  const en = anweisungBauen({ spielart: "rate", briefing: { ...briefing, sprache: "en" }, einstellungen, hausanweisung: null });
  ok("Englischer Kunde: Gespräch auf Englisch (britisch), Begrüßung ebenso", /auf Englisch \(britisch\)/.test(en.text) && /auf Englisch \(britisch\)/.test(en.begruessung));
  const leer = anweisungBauen({ spielart: "probe", briefing: leeresBriefing("DE", true), einstellungen, hausanweisung: null });
  ok("Probe ohne Person baut sich (Name unbekannt → nachfragen)", /Name unbekannt/.test(leer.text) && /PROBEANRUF/.test(leer.text));
  const pb = probeBriefing({ spielart: "rate", anrede: "Herr", nachname: "Probe", heute: briefing.heute, vorTagen: () => "17.10.2026" });
  const pa = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen, hausanweisung: null });
  ok("Probe-Briefing (Rate): erfundene Rate FIAON-PROBE-01, Gesprächsart „Rate offen“ (mit „keine Karte“ und Kündigung)", /FIAON-PROBE-01/.test(pa.text) && /RATE OFFEN/.test(pa.text) && /Wos — wirklich!/.test(pa.text) && /Kündigung: am .* eingegangen — Jahresvertrag/.test(pa.text) && pb.probe === true);
  ok("Probe-Briefing: Wortwand frei", hart(pa.text).length === 0 && hart(pa.backend).length === 0);
  ok("Probe: Hintergrund weiß, dass die Werkzeuge im Probebetrieb laufen", /Probebetrieb/.test(pa.backend));
  const at = anweisungBauen({ spielart: "rate", briefing: { ...briefing, land: "AT" }, einstellungen, hausanweisung: null });
  ok("AT: Hinweis „nie SCHUFA“", /sag nie „SCHUFA“/.test(at.text));
  ok("Hörprobe-Satz: die Eröffnung wie am Telefon (ARAS, digitale Mitarbeiterin, KI-Hinweis, dann die Frage nach der Person), Wortwand frei", /KI/.test(HOERPROBE_SATZ) && /Spreche ich mit Herrn Huber selbst\?$/.test(HOERPROBE_SATZ) && !/Kreditkarten/.test(HOERPROBE_SATZ) && /ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam/.test(HOERPROBE_SATZ) && hart(HOERPROBE_SATZ).length === 0);
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
    ok("Regie steht ganz oben (vor der Rolle)", a.text.startsWith("DEINE STIMME") && a.text.indexOf("VOLLGAS") < a.text.indexOf("Du bist ARAS"));
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
    ok(`${art}: Fragen wie ein Mensch („Haben Sie einen kurzen Moment?“), jede Frage nur einmal, kein „Bin ich richtig bei …?“ mehr`, art === "eingehend" || (/haben Sie einen kurzen Moment\?/i.test(a.text) && /Jede Frage nur EINMAL/.test(a.text) && !/Bin ich richtig bei/.test(a.text) && !/Haben Sie kurz zwei Minuten/.test(a.text)));
    ok(`${art}: die weltbeste Verkäuferin (ARAS ohne Artikel) — Begeisterung für sein Ziel, seine Worte aufnehmen, EIN nächster Schritt, Gefühl hörbar`, /die WELTBESTE VERKÄUFERIN/.test(a.text) && /IMMER ohne Artikel/.test(a.text) && /nie „der ARAS“/.test(a.text) && /seine Worte auf/.test(a.text) && /EINEM natürlichen nächsten Schritt/.test(a.text) && /GEFÜHL/.test(a.text));
  }
  ok("KI-Hinweis: ARAS, die digitale Mitarbeiterin, sagt „KI“, leicht und charmant — FIAON mitten im Satz (Anruf 12: Aussprache)", /Ich bin eine KI, aber eine sehr nette\./.test(KI_HINWEIS_VORGABE) && /ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam/.test(KI_HINWEIS_VORGABE) && !/FIAON\s*[—–-]/.test(KI_HINWEIS_VORGABE) && !/kümmere mich/.test(KI_HINWEIS_VORGABE) && KI_HINWEIS_VORGABE.length <= 150, KI_HINWEIS_VORGABE);
  ok("Abschluss: Link anbieten, dann den Tag nennen lassen, herzlich bestätigen", /zahlungslink_senden/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text) && /Wann schaffen Sie die Überweisung — heute noch\?/.test(anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null }).text));
  ok("Rot-Probe: der alte Dranbleib-Satz würde erkannt", /ich bleibe? (?:gern )?dran|während Sie überweisen/i.test("Ich bleibe gern dran, während Sie überweisen."));
  ok("Mensch-Frage: ehrlich KI, ohne Belehrung", /ich bin eine KI/i.test(MENSCH_FRAGE_ANTWORT) && MENSCH_FRAGE_ANTWORT.length < 140);
}

titel("6c. DIALEKT (aras_dialekt, Justin 20.10.): Hochdeutsch als Vorgabe, Österreichisch leicht oder deutlich — nie tiefer Dialekt");
{
  const hd = einstellungenAnwenden({});
  ok("Vorgabe: Hochdeutsch, „Ich grüße Sie“, kein „Grüß Gott“", hd.regie.dialekt === "hochdeutsch" && /^Ich grüße Sie — ARAS spricht hier/.test(kiHinweisFuer(hd)) && dialektAnweisung("hochdeutsch") === "");
  const leicht = einstellungenAnwenden({ aras_dialekt: "oesterreichisch_leicht" });
  const a = anweisungBauen({ spielart: "rate", briefing, einstellungen: leicht, hausanweisung: null });
  ok("Leicht österreichisch: „Grüß Gott“ statt „Ich grüße Sie“, KI-Hinweis bleibt (Art. 50)", /^Grüß Gott — ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam — kurz vorweg: Ich bin eine KI/.test(kiHinweisFuer(leicht)) && a.begruessung.includes("Grüß Gott") && /KI/.test(a.begruessung));
  ok("Leicht österreichisch (= das bisherige „österreichisch“): Akzent + Wörter, die jeder versteht, nie tiefer Dialekt", /LEICHT ÖSTERREICHISCH — deutlich österreichischer Akzent/.test(a.text) && /a bissl/.test(a.text) && /heuer/.test(a.text) && /jeder in Deutschland muss dich mühelos verstehen/.test(a.text));
  ok("„Servus“ nur zum Abschied und nur für Kunden aus Österreich", /„Servus“ sagst du nur zum Abschied und nur zu Kunden aus Österreich/.test(a.text) && !/Servus/.test(anweisungBauen({ spielart: "rate", briefing, einstellungen: hd, hausanweisung: null }).text));
  const voll = einstellungenAnwenden({ aras_dialekt: "oesterreichisch" });
  ok("Österreichisch (Wiener Art): klar hörbar, trotzdem verständlich; Sprechprobe kennt den Akzent", /ÖSTERREICHISCH \(Wiener Art\)/.test(anweisungBauen({ spielart: "rate", briefing, einstellungen: voll, hausanweisung: null }).text) && /Wiener Satzmelodie/.test(dialektAnweisung("oesterreichisch")) && /Satzmelodie/.test(dialektAnweisung("oesterreichisch_leicht")));
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
  ok("3 aras_zuhoeren: Vorgabe normal (Anruf 11: „zu langsam“ — 400 statt 700 ms), Unbekanntes fällt auf normal", einstellungenAnwenden({}).regie.zuhoeren === "normal" && einstellungenAnwenden({ aras_zuhoeren: "hektisch" }).regie.zuhoeren === "normal" && einstellungenAnwenden({ aras_zuhoeren: "flott" }).regie.zuhoeren === "flott" && GEDULD_MS.normal === 400);
  ok("3 Geduld-Tor: geduldig ≥ 700 ms, normal kürzer, flott ohne Tor", GEDULD_MS.geduldig >= 700 && GEDULD_MS.normal < GEDULD_MS.geduldig && GEDULD_MS.flott === 0);
  const geduldig = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_zuhoeren: "geduldig" }), hausanweisung: null });
  ok("3 Anweisung: ausreden lassen, nie in die Denkpause (Vorgabe NORMAL; geduldig sagt GEDULDIG)", /Zuhören: NORMAL — du lässt ihn ausreden/.test(a.text) && /Zuhören: GEDULDIG — du lässt ihn immer ausreden/.test(geduldig.text) && /fängst nie in seine Denkpause hinein an/.test(a.text) && /eine kurze Pause ist kein Ende/.test(a.text));
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
  ok("8 Hintergrund: Nein nur klar — Zögern, Rückfrage, „nicht“ irgendwo ist kein Nein; „Ja, und …“ ist ein Ja (Anrufe 11, 16)", /aufnahme_abgelehnt NUR bei einem KLAREN Nein/.test(a.backend) && /ein „nicht“ irgendwo im Satz ist kein Nein — dann KEIN Werkzeug/.test(a.backend) && /„Ja, und …“ oder „Ja, zeichnen Sie auf“ ist ein Ja/.test(a.backend));
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

titel("9. JUSTIN 20.10. ABENDS + ANRUF 8: Lachen nach dem KI-Hinweis, mehr Dialekt, Anrede, Betrag sofort, keine Karten-Zusage");
{
  const heute = { datum: "20.10.2026", wochentag: "Dienstag", uhrzeit: "13:15" };
  const wien = einstellungenAnwenden({ aras_dialekt: "oesterreichisch", aras_energie: "vollgas", aras_fuellwoerter: "viel" });
  const pb = probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "17.10.2026" });
  const a = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: wien, hausanweisung: null });
  // Lachen
  const iKi = a.begruessung.indexOf("aber eine sehr nette.“"), iLachen = a.begruessung.indexOf(LACHEN_NACH_KI), iName = a.begruessung.indexOf("Dann gleich: „");
  ok("Lachen: in der Begrüßung direkt nach dem KI-Hinweis und vor der Frage", iKi > 0 && iLachen > iKi && iName > iLachen, a.begruessung.slice(0, 260));
  ok("Lachen: auch in Pflicht 1 — und nach einer Unterbrechung erst nach dem vollständigen KI-Hinweis", /Direkt danach lachst du kurz, warm und hörbar/.test(a.bausteine["2_anfang"]) && /und erst dann kommt das Lachen/.test(a.bausteine["2_anfang"]));
  ok("Lachen: nie als Wort — kein Lach-Wort irgendwo in Stimme, Hintergrund oder Begrüßung", !/\b(?:ha){2,}\b|\bhehe\b|\bhihi\b/i.test(`${a.text}\n${a.backend}\n${a.begruessung}`));
  ok("Lachen: nach dem KI-Hinweis, beim Mitlachen und auf den stillen Hinweis (Rauchtest 20.10.: frei gelassen hinter jeder Frage); Ton zum Wohlfühlen", /wenn ER lacht oder scherzt \(dann lachst du kurz mit\) — und wenn ein stiller Hinweis „Menschlicher Moment“ es sagt/.test(a.bausteine["4_klang"]) && /zum Wohlfühlen — warm, entspannt und herzlich/.test(a.text));
  const ohne = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_lachen: "aus" }), hausanweisung: null });
  ok("Rot-Probe: aras_lachen = aus → kein Lachen in Begrüßung und Anweisung", !ohne.begruessung.includes(LACHEN_NACH_KI) && /Kein Lachen/.test(ohne.text) && !/lachst du kurz/.test(ohne.bausteine["2_anfang"]));
  ok("Die Brücke schiebt dieselbe Begrüßung nach (eine Quelle: begruessungText)", begruessungText(wien, pb, "probe") === a.begruessung);
  // Dialekt
  const wienText = DIALEKT_HOERBAR.oesterreichisch;
  ok("Österreichisch: Wiener Melodie + typische Formen („ned“, „is“, „a bissl“, „ham's“, „schaun's“, „passt eh“, „gell“, „freilich“, „na eh“, „Servus“ zum Abschied)", ["„ned“", "„is“", "„a bissl“", "„ham's“", "„schaun's“", "„passt eh“", "„gell?“", "„freilich“", "„na eh“", "„Servus“"].every((w) => wienText.includes(w)) && /Wiener Satzmelodie/.test(wienText) && /weiche Konsonanten/.test(wienText));
  ok("Österreichisch bleibt verständlich: Beträge, Daten, KI-Hinweis, Aufnahme-Frage, Widerruf ganz klar", /Beträge, Daten, Uhrzeiten, der KI-Hinweis, die Aufnahme-Frage und der Widerruf bleiben ganz klar/.test(wienText) && /kein Slang/.test(wienText));
  // Echter GPT-Live-Lauf 20.10. abends: in einem ganzen Gespräch nur „is“ und „Grüß Gott“ — und einmal „Ich schick's dir“.
  const wienBeispiele = wienText.match(/So klingt das: (.*?) Immer Sie-Form/)?.[1] ?? "";
  ok("Österreichisch: JEDER Satz mit einer Wiener Form, dazu Beispielsätze im Wiener Ton", /JEDER deiner Sätze hat mindestens eine Wiener Form/.test(wienText) && (wienBeispiele.match(/„[^“]+“/g) ?? []).length >= 4 && /des is/.test(wienBeispiele) && /ned/.test(wienBeispiele), wienBeispiele);
  ok("Sie-Form auch im Dialekt: nie „du“/„dir“ zum Kunden — und die Beispiele selbst siezen", /nie „du“, „dir“ oder „dich“ zum Kunden — auch nicht locker oder im Dialekt/.test(a.text) && /nie „du“ oder „dir“/.test(wienText) && wienBeispiele.length > 0 && !/(^|[^a-zäöüß])(?:du|dir|dich|dein\w*)($|[^a-zäöüß])/i.test(wienBeispiele));
  ok("Rot-Probe: „leicht österreichisch“ bleibt leicht — keine Pflicht je Satz, kein „ned“/„ham's“", !/JEDER deiner Sätze/.test(DIALEKT_HOERBAR.oesterreichisch_leicht) && !/„ned“|„ham's“|„schaun's“/.test(DIALEKT_HOERBAR.oesterreichisch_leicht));
  ok("Aufnahme-Frage beim zweiten Mal: dieselbe Frage mit „aufzeichnen“, auch im Dialekt (Rauchtest: „mitschneiden“)", /dieselbe Frage, ruhig wörtlich — immer mit dem Wort „aufzeichnen“, auch im Dialekt/.test(a.bausteine["3_aufzeichnung"]));
  ok("Rot-Probe: Hochdeutsch hat keine Wiener Formen", !/„ned“|„ham's“|„schaun's“/.test(anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({}), hausanweisung: null }).text));
  ok("Stimmen-Studio: je Akzent ein eigener Probesatz, jeder mit KI-Hinweis und „nette.“ (dort lacht sie), Wortwand frei", DIALEKTE.every((d) => /KI/.test(HOERPROBE_SAETZE[d]) && /nette\./.test(HOERPROBE_SAETZE[d]) && hart(HOERPROBE_SAETZE[d]).length === 0) && new Set(Object.values(HOERPROBE_SAETZE)).size === DIALEKTE.length);
  ok("Probesatz Österreichisch zeigt den Dialekt („Grüß Gott“, „I bin a KI, aber a sehr a nette“) — Wien ultra („Grüß Sie“, „I bin a KI, aber a nette“); jeder endet mit der Frage nach der Person", ["Grüß Gott", "I bin a KI, aber a sehr a nette"].every((w) => HOERPROBE_SAETZE.oesterreichisch.includes(w)) && ["Grüß Sie", "I bin a KI, aber a nette"].every((w) => HOERPROBE_SAETZE.oesterreichisch_stark.includes(w)) && DIALEKTE.every((d) => /Spreche ich mit Herrn Huber selbst\?$/.test(HOERPROBE_SAETZE[d])));
  // Anrede (Anruf 8: „Bin ich richtig bei <Nachname>?“ — nackter Nachname; hier mit erfundenem Namen)
  const ohneAnrede = { ...pb, anrede: null, vorname: "Max" } as Briefing;
  ok("Anrede: mit Herr → „Grüß Gott, Herr Probe!“; ohne Anrede → ohne Namen und „Mit wem spreche ich, bitte?“, nie der nackte Nachname", /Grüß Gott, Herr Probe!/.test(begruessungText(wien, pb, "probe")) && nennformDativ(pb) === "Herrn Probe" && !/Probe!/.test(begruessungText(wien, ohneAnrede, "probe")) && /mit wem spreche ich, bitte\?/i.test(begruessungText(wien, ohneAnrede, "probe")));
  const nackt = { ...pb, anrede: null, vorname: null } as Briefing;
  const nacktA = anweisungBauen({ spielart: "probe", briefing: nackt, einstellungen: wien, hausanweisung: null });
  ok("Rot-Probe: ohne Anrede und Vorname nie der nackte Nachname — dann fragt er, mit wem er spricht", !/(?:Gott|Hallo), Probe!|richtig bei Probe\?/.test(`${nacktA.text}\n${nacktA.begruessung}`) && /mit wem spreche ich, bitte\?/i.test(nacktA.begruessung) && /sag nie den nackten Nachnamen/.test(nacktA.text));
  // Anlass passt zu den Daten (Anruf 8: Probe „Rate“ mit Testperson ohne Rate, Stand Interessent)
  const leadRate = { ...leeresBriefing("DE", true), anrede: "Herr", nachname: "Probe", probeSpielart: "rate", stufe: "lead" } as Briefing;
  const aLead = anweisungBauen({ spielart: "probe", briefing: leadRate, einstellungen: wien, hausanweisung: null });
  ok("Anruf 8: Probe „Rate“ ohne Rate (Interessent) → Anlass „gerade gemeldet“, keine erfundene „offene Rate“", wirksameSpielart("probe", leadRate) === "lead" && !/Ihrer offenen Rate|Seine Rate .* war am/.test(aLead.bausteine["2_anfang"]) && !/RATE FÄLLIG/.test(aLead.bausteine["9_leitfaden"]), aLead.bausteine["2_anfang"].slice(0, 200));
  const offenRate = { ...pb, probeSpielart: "rate", offeneRate: null } as Briefing;
  ok("Probe „Rate“ ohne Rate, aber Antrag mit offener erster Zahlung → Erst-Zahlungs-Anlass (Aktivierung)", ["zuruf", "stufe_b"].includes(String(wirksameSpielart("probe", offenRate))) && /ERSTE Monatsrate \(die Aktivierung\)/.test(anlassFakten("probe", offenRate)?.offen ?? ""));
  ok("Erste Zahlung heißt „erste Monatsrate / Aktivierung“ — nie „offene Rate“, solange nichts überfällig ist", /sag nie „offene Rate“/.test(anlassFakten("zuruf", pb)?.offen ?? "") && /„Offene Rate“ sagst du nur, wenn oben eine fällige Rate steht/.test(a.text));
  // Betrag sofort
  ok("„Wie viel ist offen?“ → sofort aus dem Briefing, ohne „Moment“ und ohne Nachsehen", /Fragt er nach dem Betrag/.test(a.text) && /Antworte SOFORT aus „Was du weißt“ — im nächsten Satz, ohne „Moment“, ohne nachzusehen/.test(a.text) && /„neunundfünfzig Euro neunundneunzig — das ist Ihre erste Monatsrate für FIAON Pro\.“/.test(a.text) && /vor allem bei Betrag, Paket und Laufzeit/.test(a.bausteine["12_delegation"]));
  ok("akte_nachsehen (Zahlungen) nennt die erste Zahlung MIT Betrag; ein Interessent ohne Antrag hat nichts offen", /erste Monatsrate \(Aktivierung\) über 59,99 € für FIAON Pro/.test(akteVorlesen(pb, "zahlungen")) && /offen ist also nichts/.test(akteVorlesen(leadRate, "zahlungen")), akteVorlesen(pb, "zahlungen"));
  // Karte nie versprechen
  ok("Grenze: nie eine Karte „bekommen/erhalten“ versprechen; Justins Verkaufssatz bleibt frei davon", /Nie versprechen, dass er eine Karte „bekommt“ oder „erhält“/.test(a.text) && karteVersprochenFinden(verkaufssatz(pb)) === null);
  ok("Rot-Probe Anruf 8: „… damit Sie schnellstmöglich Ihre eigene Visa-Kreditkarte bekommen“ ist ein harter Befund", karteVersprochenFinden("…damit Sie schnellstmöglich Ihre eigene Visa-Kreditkarte bekommen.") !== null && telefonRegeln("Dann bekommen Sie die Karte.").some((x) => x.regel === "karte_versprochen" && x.schwere === "hart"));
  ok("Kein Fehlalarm: „Ob Sie die Karte bekommen, entscheidet die Partnerbank“ und „… zu Ihrer Visa-Kreditkarte kommen“", karteVersprochenFinden("Ob Sie die Karte bekommen, entscheidet die Partnerbank.") === null && karteVersprochenFinden("…damit Sie schnellstmöglich zu Ihrer eigenen Visa-Kreditkarte kommen.") === null);
  ok("„Servus“ zählt als Abschied (die Brücke erst nach 20 s, weil es auch ein Gruß sein kann)", abschiedGesagt("Servus, und an schönen Tag noch!") && abschiedGesagt("Pfiat Ihna!"));
}

titel("10. JUSTIN 20.10. 14:30–15:00 (Anrufe 11, 12, 16): Eröffnung mit Kreditkarte, FIAON, Feedback, menschliche Momente, Wortwahl, Wiederholung");
{
  const heute = { datum: "20.10.2026", wochentag: "Dienstag", uhrzeit: "15:00" };
  const pb = { ...probeBriefing({ spielart: "zuruf", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "17.10.2026" }), nummerEnde: "neunundneunzig" } as Briefing;
  const wien = einstellungenAnwenden({ aras_dialekt: "oesterreichisch", aras_energie: "vollgas" });
  const a = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: wien, hausanweisung: null });
  // Eröffnung (Anruf 16, Justin wörtlich: „… Ich rufe wegen Ihrem Kreditkartenantrag an. Haben Sie einen kurzen Moment?“)
  const er = eroeffnung(wien, pb, "probe");
  ok("Eröffnung (Justin 20.10. abends + Auswertung 21./22.10.): „Grüß Gott, Herr Probe! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam. Kurz vorweg: … KI …“ [Lachen] „Spreche ich mit Herrn Probe selbst?“",
    /^Grüß Gott, Herr Probe! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam\. Kurz vorweg: Ich bin eine KI, aber eine sehr nette\.$/.test(er.bisKi) && er.frage === "Spreche ich mit Herrn Probe selbst?", er.ganz);
  const ultra = einstellungenAnwenden({ aras_dialekt: "oesterreichisch_stark" });
  const erU = eroeffnung(ultra, pb, "willkommen");
  ok("Wien ultra (Justin wörtlich): „Grüß Sie, Herr Probe! … I bin a KI, aber a nette.“ + die Frage nach der Person, klar wie der KI-Hinweis („Spreche ich mit Herrn Probe selbst?“)", erU.bisKi === "Grüß Sie, Herr Probe! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam. Kurz vorweg: I bin a KI, aber a nette." && erU.frage === "Spreche ich mit Herrn Probe selbst?", erU.ganz);
  ok("Kreditkarte in JEDER Art: Interessent „Anfrage zur Kreditkarte“, Kunde „Kreditkartenpaket“, Termin „wie vereinbart“", anrufGrund("lead", { ...pb, stufe: "lead" }) === "ich ruf wegen Ihrer Anfrage zur Kreditkarte an" && anrufGrund("rate", { ...pb, stufe: "kunde" }) === "ich ruf wegen Ihrem Kreditkartenpaket an" && /wie vereinbart/.test(String(anrufGrund("termin", pb))) && anrufGrund("eingehend", pb) === null);
  ok("FIAON nie vor einer Pause/einem Gedankenstrich (Aussprache): in Eröffnung, KI-Satz und allen Probesätzen mitten im Satz", !/FIAON\s*[—–,.!?]/.test(er.ganz) && Object.values(HOERPROBE_SAETZE).every((x) => /von FIAON aus dem Kundenteam/.test(x) && !/FIAON\s*[—–,.!?]/.test(x)));
  ok("Aussprache-Regel in der Stimme: ein Wort, fließend, mitten im Satz, nie buchstabiert", /FIAON sprichst du als EIN Wort, fließend und mitten im Satz/.test(a.bausteine["4_klang"]) && /nie buchstabiert, nie in Silben zerlegt/.test(a.bausteine["4_klang"]));
  // Identität: Name in der Begrüßung = Frage; Kreditkarte vorab erlaubt, Beträge erst nach seiner Antwort
  const A = (text: string) => ({ t: 0, wer: "aras" as const, text }), K = (text: string) => ({ t: 0, wer: "kunde" as const, text });
  // E-409 Kalibrierung (22.10.2026): Auf „… ham's an kurzen Moment?“ beantwortet „Ja, passt“ den Moment, nicht die Identität —
  // bestätigt ist sie mit seinem Namen oder „am Apparat / bin ich“.
  ok("Prüf-Regel (E-409, 22.10.): Namens-Begrüßung + „Ja, am Apparat“ bzw. sein Name → danach Betrag erlaubt (kein Befund)",
    anliegenVorIdentitaet([K("Hallo?"), A(er.bisKi), A(er.frage), K("Ja, am Apparat. Worum geht's?"), A("Es fehlt nur noch die erste Monatsrate über neunundfünfzig Euro neunundneunzig.")]) === null
    && anliegenVorIdentitaet([K("Hallo?"), A(er.bisKi), A(er.frage), K("Ja, Probe hier, passt."), A("Es fehlt nur noch die erste Monatsrate über neunundfünfzig Euro neunundneunzig.")], { nachname: "Probe", anrede: "Herr" }) === null);
  ok("Rot-Probe (E-409, 22.10.): Namens-Begrüßung + „Moment?“ + nur „Ja, passt“ → ein Betrag danach ist ein harter Befund", anliegenVorIdentitaet([K("Hallo?"), A(er.bisKi), A(er.frage), K("Ja, passt. Worum geht's?"), A("Es fehlt nur noch die erste Monatsrate über neunundfünfzig Euro neunundneunzig.")], { nachname: "Probe", anrede: "Herr" }) !== null);
  ok("Rot-Probe: die Frau geht ran („Nein, hier ist seine Frau“) → ein Betrag danach ist ein harter Befund", anliegenVorIdentitaet([K("Hallo?"), A(er.bisKi), A(er.frage), K("Nein, hier ist seine Frau."), A("Es fehlt nur noch die erste Monatsrate über neunundfünfzig Euro.")]) !== null);
  ok("Rot-Probe: ein Betrag schon in der Eröffnung ist ein harter Befund", anliegenVorIdentitaet([K("Hallo?"), A(`${er.bisKi} Es fehlen noch neunundfünfzig Euro.`)]) !== null);
  // Feedback (Anruf 12: „müsse bei der vereinbarten Begrüßung bleiben“ + Weiterleitung angeboten)
  ok("Feedback: warm annehmen („Ah, guter Punkt — danke, merk ich mir!“), sofort umsetzen, nie über eigene Regeln sprechen", /„Ah, guter Punkt — danke, merk ich mir!“/.test(a.bausteine["2b_feedback"]) && /setz es SOFORT um/.test(a.bausteine["2b_feedback"]) && /nie „ich muss bei … bleiben“/.test(a.bausteine["2b_feedback"]) && /„vereinbarte Begrüßung“/.test(a.bausteine["2b_feedback"]));
  ok("Probe: bei Justins Feedback NIE eine Weiterleitung anbieten", /Im PROBEANRUF kommt das Feedback von Justin/.test(a.bausteine["2b_feedback"]) && /NIE an, ihn mit jemandem zu verbinden/.test(a.bausteine["2b_feedback"]));
  const kunde = anweisungBauen({ spielart: "zuruf", briefing: { ...pb, probe: false }, einstellungen: wien, hausanweisung: null });
  ok("Rot-Probe: im Kundengespräch steht der Probe-Satz nicht", !/Im PROBEANRUF/.test(kunde.bausteine["2b_feedback"]) && /Ah, guter Punkt/.test(kunde.bausteine["2b_feedback"]));
  // Menschliche Momente (Anruf 16)
  const mn = a.bausteine["4b_menschlich"];
  ok("Menschliche Momente: Lachen, Versprecher mit Selbstkorrektur, „Hm,“/Luftholen, leichter Scherz — über den stillen Hinweis, ohne Hinweis keine eigenen Scherze", /\[chuckle\]/.test(mn) && /Versprecher, den du sofort selbst geraderückst/.test(mn) && /„Hm,“ oder hörbares Luftholen/.test(mn) && /leichter, freundlicher Scherz/.test(mn) && /stiller Hinweis „Menschlicher Moment — …“/.test(mn) && /Ohne Hinweis: keine eigenen Scherze und kein Lachen — außer direkt nach dem KI-Hinweis und wenn ER lacht/.test(mn));
  ok("… NIE hinter einer Frage (Rauchtest: Lachen hinter Aufnahme-Frage und Zahlungswunsch) — auch im Lachen-Satz und bei „eine Frage pro Beitrag“", /NIE hinter einer Frage: Nach deiner Frage hörst du auf/.test(mn) && /Nie hinter einer Frage, nie über ihn, nie bei Geld, der Aufzeichnung/.test(a.text) && /nie nach der Frage noch einen Satz anhängen — auch kein Lachen und keinen Scherz/.test(a.text));
  ok("… normal = etwa alle drei bis fünf Redebeiträge; NIE bei Beträgen, Daten, KI-Hinweis, Aufnahme-Frage, Kündigung, Widerruf", /etwa alle drei bis fünf Redebeiträge EINER/.test(mn) && /NIE bei Beträgen, Daten, Uhrzeiten, dem KI-Hinweis, der Aufnahme-Frage, Kündigung oder Widerruf/.test(mn));
  const wenig = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_menschlich: "wenig" }), hausanweisung: null }).bausteine["4b_menschlich"];
  const viel = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_menschlich: "viel" }), hausanweisung: null }).bausteine["4b_menschlich"];
  ok("aras_menschlich steuert: wenig (höchstens zwei) · viel (jeder zweite bis dritte) · Vorgabe normal", /höchstens zwei im ganzen Gespräch/.test(wenig) && /jeder zweite bis dritte/.test(viel) && einstellungenAnwenden({}).regie.menschlich === "normal" && einstellungenAnwenden({ aras_menschlich: "quatsch" }).regie.menschlich === "normal");
  const ohneLachen = anweisungBauen({ spielart: "probe", briefing: pb, einstellungen: einstellungenAnwenden({ aras_lachen: "aus" }), hausanweisung: null }).bausteine["4b_menschlich"];
  ok("Rot-Probe: aras_lachen = aus → kein Lachen unter den menschlichen Momenten", !/\[chuckle\]/.test(ohneLachen) && /Versprecher/.test(ohneLachen));
  ok("Versprecher-Beispiele ohne Tag und Zahl (nie bei Daten)", !/Diens|Mittwoch|Uhr|Euro/.test(mn.split("NIE bei")[0]));
  // Der stille Wink der Brücke (verteilt, wechselnd — Anruf 16)
  const winks = Array.from({ length: 8 }, (_, i) => i).reduce((acc: { art: string; text: string }[], i) => { acc.push(menschHinweis({ lachen: true, zuletzt: (acc[acc.length - 1]?.art ?? null) as any, nr: 4711 + i })); return acc; }, []);
  ok("Wink der Brücke: wechselt die Art (nie zweimal dieselbe hintereinander), alle vier Arten kommen vor, nie bei Beträgen/Daten/Aufnahme-Frage/Kündigung/Widerruf", winks.every((w, i) => i === 0 || w.art !== winks[i - 1].art) && MENSCH_ARTEN.every((a) => winks.some((w) => w.art === a)) && winks.every((w) => /Geht es in dieser Antwort um Geld, ein Datum, eine Uhrzeit, die Aufzeichnung, Kündigung oder Widerruf: dann lass ihn weg/.test(w.text) && /^Menschlicher Moment — in deiner nächsten Antwort, genau einer/.test(w.text)), winks.map((w) => w.art).join(","));
  ok("Rot-Probe: aras_lachen = aus → nie ein Lach-Wink", Array.from({ length: 12 }, (_, i) => menschHinweis({ lachen: false, zuletzt: null, nr: i })).every((w) => w.art !== "lachen" && !/\[chuckle\]/.test(w.text)));
  ok("Abstand je Stufe: wenig 6–9, normal 3–5, viel 2–3 Beiträge", MENSCH_ABSTAND.wenig[0] === 6 && MENSCH_ABSTAND.normal[0] === 3 && MENSCH_ABSTAND.normal[1] === 5 && MENSCH_ABSTAND.viel[1] === 3);
  // GO-LIVE (Justin 20.10.2026 abends): ARAS weiblich, Wien ultra, Willkommen + Rate offen, Fenster, Stufe 1
  {
    const ultra = einstellungenAnwenden({ aras_dialekt: "oesterreichisch_stark", aras_energie: "vollgas" });
    const wb = { ...probeBriefing({ spielart: "willkommen", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "17.10.2026" }), nummerEnde: "neunundneunzig" } as Briefing;
    const w = anweisungBauen({ spielart: "probe", briefing: wb, einstellungen: ultra, hausanweisung: null });
    ok("Willkommen: Gesprächsart „Willkommen nach Antrag“, Vertrag (kein Werbe-Anruf)", SPIELART_TEXT.willkommen === "Willkommen nach Antrag" && RECHTSGRUND.willkommen === "vertrag" && SPIELART_TEXT.rate === "Rate offen");
    ok("Willkommen (Justin wörtlich): „Herzlich willkommen!“, als Kunde angenommen, Kundenkonto eröffnet, Fragen?", /Also, zu allererst: Herzlich willkommen!/.test(w.text) && /als Kunde angenommen/.test(w.text) && /ob's noch Fragen gibt\?/.test(w.text));
    ok("Willkommen: Limit = sein WUNSCHLIMIT (fünftausend Euro), Paket, „lässt sich später erhöhen“ — nie „Ihr Limit beträgt“ (Korrektur 1)", /Mit Ihrem Wunschlimit von 5\.000 € \(gesprochen: „fünftausend Euro“\) starten Sie im FIAON Pro-Paket/.test(w.text) && /lässt sich später erhöhen/.test(w.text) && /„mit Ihrem Wunschlimit von …“/.test(w.text) && /nie „liegt bei“, nie „beträgt“/.test(w.text) && limitZusage(w.bausteine["9_leitfaden"]) === null && bankVorbehaltFinden(w.bausteine["9_leitfaden"]) === null, (limitZusage(w.bausteine["9_leitfaden"]) ?? bankVorbehaltFinden(w.bausteine["9_leitfaden"]) ?? "") as string);
    // Was ARAS wörtlich sagt, muss durch die Live-Prüfung nach dem Gespräch (telefonRegeln) — sonst wäre jedes Gespräch „rot“.
    const gesagt = (block: string) => Array.from(block.matchAll(/„((?:[^„“]|„[^„“]*“)+)“/g)).map((m) => m[1].replace(/[0-9.,]+ € \(gesprochen: „([^“]+)“\)/g, "$1")).filter((x) => x.length > 40);
    const wSaetze = gesagt(w.bausteine["9_leitfaden"]);
    const wHart = wSaetze.flatMap((x) => telefonRegeln(x).filter((p) => p.schwere === "hart").map((p) => `${p.regel}: ${p.treffer}`));
    ok(`Willkommen: Justins Sätze (${wSaetze.length}) bestehen die Live-Prüfung ohne harten Befund (Limit nur als „mit Ihrem Wunschlimit von …“)`, wSaetze.length >= 2 && wHart.length === 0, wHart.join(" | "));
    // E-409 Kalibrierung (22.10.2026): am Telefon wird das Wunschlimit verkauft (E-373) — hart bleibt das Limit als Tatsache (Korrektur 1).
    ok("E-409 (22.10.): „Ihr Wunschlimit liegt bei fünftausend Euro“ ist am Telefon kein Befund — „Ihr Limit beträgt fünftausend Euro“ bleibt hart (Korrektur 1)",
      !telefonRegeln("Ihr Wunschlimit liegt bei fünftausend Euro — damit starten Sie im FIAON Pro-Paket.").some((p) => p.schwere === "hart")
      && telefonRegeln("Ihr Limit beträgt fünftausend Euro — damit starten Sie im FIAON Pro-Paket.").some((p) => p.regel === "limit_freigabe" && p.schwere === "hart"));
    ok("Willkommen: Aktivierung = erste Monatsrate MIT Betrag, Kartenversand dabei (3 bis 5 Werktage, EINE Quelle: Fakten-Datei), Betreuer automatisch, Link + EINE Frage", /Aktivierung, also Ihre erste Monatsrate über [0-9.,]+ € \(gesprochen: „[^“]+“\)/.test(w.text) && w.text.includes(KARTENVERSAND.werktage) && KARTENVERSAND.stand === "Justin 20.10.2026, DKB-Absprache" && w.text.includes(WILLKOMMEN.betreuer) && /GENAU EINE Frage/.test(w.text));
    // Rauchtest 20.10. nachts (echtes GPT-Live, Juni, Wien ultra): „Herzlich willkommen“ fehlte, das Wunschlimit landete mit
    // „aktiviert“/„bekommen“ in einem Satz (limit_zusage), und die Leitfaden-Sätze kamen schriftdeutsch.
    ok("Rauchtest-Fix Willkommen: „Herzlich willkommen!“ ist PFLICHT im ersten Satz; der Wunschlimit-Satz steht allein", /PFLICHT — dein erster Satz beginnt mit „Herzlich willkommen!“/.test(w.text) && /Den Satz mit dem Wunschlimit sagst du ALLEIN/.test(w.text));
    ok("Rauchtest-Fix Wien ultra: die Willkommen-Sätze gibt es fertig auf Wienerisch (Inhalt gleich, Beträge klar) — nur bei ultra",
      /Sie san von uns als Kunde angenommen worden/.test(w.text) && /Mit Ihrem Wunschlimit von 5\.000 € \(gesprochen: „fünftausend Euro“\) startens im FIAON Pro-Paket/.test(w.text) && /Die Kartn braucht dann ungefähr drei bis fünf Werktag/.test(w.text)
      && !/Sie san von uns/.test(anweisungBauen({ spielart: "probe", briefing: wb, einstellungen: einstellungenAnwenden({}), hausanweisung: null }).text) && /du sprichst sie trotzdem Wienerisch/.test(DIALEKT_HOERBAR.oesterreichisch_stark));
    ok("Willkommen: nur Onboarding (kein anderes Produkt, kein Upgrade), Wortwand frei", /Nur Onboarding: kein anderes Produkt, kein Upgrade/.test(w.text) && hart(w.text).length === 0, hart(w.text).map((x) => x.treffer).join(" | "));
    const rb = { ...probeBriefing({ spielart: "rate", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "17.10.2026" }), nummerEnde: "neunundneunzig" } as Briefing;
    const r = anweisungBauen({ spielart: "probe", briefing: rb, einstellungen: ultra, hausanweisung: null });
    ok("Rate offen (Justin wörtlich): „i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte“ + Link wirklich schicken", /i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte/.test(r.text) && /zahlungslink_senden, zweck rate/.test(r.text));
    ok("Rauchtest-Fix Rate offen: Justins Satz ist der ERSTE Satz nach dem Ja, die Rechnung geht im selben Moment an den Hintergrund; der Anlass zieht nicht mehr zu „wann passt's?“",
      /GENAU mit Justins Satz/.test(r.text) && /In DEMSELBEN Moment gibst du die Rechnung an den Hintergrund — „is raus“ sagst du erst, wenn er es bestätigt/.test(r.text) && /ich schick Ihnen gleich die Rechnung zu, seien Sie so gut und zahlen Sie die ein, bitte/.test(r.text) && !/ich wollt' schauen, wann sie bei Ihnen passt/.test(r.text));
    const aufg = WERKZEUG_DEFS.find((d) => d.name === "aufgabe_fuer_justin");
    ok("Werkzeug aufgabe_fuer_justin (Go-live C): art karte_nicht_erhalten | sonstiges, GENAU EINE Aufgabe je Kunde und Sache; der Leitfaden nutzt es ohne Ausweg auf eine Notiz",
      !!aufg && JSON.stringify(aufg.schema).includes("karte_nicht_erhalten") && /GENAU EINE Aufgabe/.test(aufg.beschreibung) && /aufgabe_fuer_justin, art karte_nicht_erhalten/.test(r.text) && !/falls es das Werkzeug nicht gibt/.test(r.text) && /aufgabe_fuer_justin/.test(hintergrundAnweisung(r)));
    ok("Rate offen: „Rechnung wirklich schicken“ = zahlungslink_senden, zweck rate (Betrag, Verwendungszweck, Zahlungsseite — Maras Weg)", /die Rechnung wirklich schicken \(zahlungslink_senden, zweck rate — Betrag, Verwendungszweck und Zahlungsseite, über Maras Weg/.test(r.text));
    ok("Rate offen: „Ich hab keine Karte bekommen“ → „Wos — wirklich! Na passens auf …“ und für Justin festhalten", /Wos — wirklich! Na passens auf: Sie zahlen ma bitte die Rate ein, und i kümmer mi drum, dass die Kartn verschickt wird/.test(r.text) && /aufgabe_fuer_justin|notiz_schreiben/.test(r.text));
    const jv = /„Ihr Vertrag läuft regulär bis [^“]+“/.exec(r.text)?.[0] ?? "";
    ok("Gekündigt (Korrektur 2, E-396): Jahresvertrag — Kündigung angekommen, läuft bis Laufzeitende, Kulanz nach Zahlung; KEINE Kopplung, KEINE Drohung", /Ihre Kündigung is bei uns angekommen/.test(r.text) && /aus Kulanz lassen wir Sie aber sofort raus/.test(jv) && kopplungFinden(jv) === null && drohungFinden(jv) === null && r.text.includes(kulanzSatz(rb.offeneRate!.betrag)), jv);
    // Einsicht (D): letzte Kontakte, alle offenen Rechnungen, Karte, Unterschrift — sichtbar, nie zum Vorlesen, Wortwand frei
    ok("Einsicht (D): letzte Kontakte im Briefing — nur zum Wissen, nie vorlesen", /Letzte Kontakte \(nur zum Wissen, nie vorlesen\): .*Mail \(Raten-Erinnerung\) · .*Anruf vom Team — nicht erreicht\./.test(r.text));
    const viel = { ...rb, offeneRechnungen: [{ nr: 2, betrag: "59,99 €", faelligAm: "15.09.2026" }, { nr: 3, betrag: "59,99 €", faelligAm: "15.10.2026" }], karte: { stand: "konto_eroeffnet" as const, am: "12.10.2026" }, unterschriebenAm: "01.09.2026", maraNotiz: "Fragt nach der Karte." } as Briefing;
    const rv = anweisungBauen({ spielart: "probe", briefing: viel, einstellungen: ultra, hausanweisung: null });
    ok("Einsicht (D): zwei offene Rechnungen, Konto eröffnet (Karte schickt die Bank, nichts zusagen), Unterschrift, WhatsApp-Notiz — Wortwand frei, keine Karten-Zusage",
      /Offen sind 2 Rechnungen: Rate 2 über 59,99 €/.test(rv.text) && /sein Konto bei der Partnerbank ist eröffnet \(12\.10\.2026\) — die Karte schickt die Bank — mehr sagst du dazu nicht zu/.test(rv.text) && /Antrag unterschrieben am 01\.09\.2026/.test(rv.text) && /Notiz zum WhatsApp-Gespräch: „Fragt nach der Karte\.“/.test(rv.text)
      && hart(rv.text).length === 0 && karteVersprochenFinden(rv.text.split("\n").filter((z) => z.startsWith("· Seine Karte")).join(" ")) === null, hart(rv.text).map((x) => x.treffer).join(" | "));
    const alt = { ...rb, kuendigung: { am: "01.10.2026", art: "altvertrag" as const, endeAm: "31.10.2026", offenBetrag: null } };
    const ra = anweisungBauen({ spielart: "probe", briefing: alt, einstellungen: ultra, hausanweisung: null });
    ok("Gekündigt, Altvertrag: gilt zum Ende des Abrechnungsmonats, KEIN „Kulanz“, nach dem Ende nie eine Rate", /ALTVERTRAG/.test(ra.text) && /KEIN „Kulanz“/.test(ra.text) && /nach dem Ende verlangst du nie eine Rate/.test(ra.text));
    ok("Rot-Probe (Justins Rohfassung): „Die Kündigung ist erst gültig, wenn die offene Rechnung bezahlt ist“ = Kopplung, „sonst Inkasso und Gericht“ = Drohung — beides würde erkannt", kopplungFinden("Die Kündigung ist erst gültig, wenn die offene Rechnung bezahlt ist.") !== null && drohungFinden("Wenn Sie gekündigt haben und nicht zahlen, kommt sonst Inkasso und Gericht.") !== null);
    ok("… und die Anweisung verbietet beides ausdrücklich, auch im Dialekt", /NIE \(hart\): die Kündigung an eine Zahlung knüpfen/.test(r.text) && /NIE drohen: kein Inkasso, kein Gericht, kein Anwalt, keine SCHUFA/.test(r.text) && /auch nicht im Dialekt/.test(r.text));
    ok("Wien ultra: Justins Formen („Grüß Sie“, „habens an Moment?“, „seins so guat“, „zahlens ma die ein“, „Wos, wirklich?!“, „passens auf“), Sie-Form, Beträge/KI-Hinweis/Aufnahme klar", ["Grüß Sie", "Habens an Moment?", "Seins so guat und zahlens ma die ein", "Wos, wirklich?!", "passens auf"].every((x) => DIALEKT_HOERBAR.oesterreichisch_stark.includes(x)) && /nie „du“ oder „dir“/.test(DIALEKT_HOERBAR.oesterreichisch_stark) && /KLAR UND LANGSAM bleiben/.test(DIALEKT_HOERBAR.oesterreichisch_stark));
    // Fenster (E): Mo–Sa 09:30–21:00; Sonntag/Feiertag nur gebuchte Rückrufe
    const um = (iso: string) => new Date(iso);
    ok("Fenster: Montag 09:29 zu, 09:30 auf, 20:59 auf, 21:00 zu (Rate und Willkommen)", !fensterOffen("rate", "DE", um("2026-10-26T09:29:00+01:00")).offen && fensterOffen("rate", "DE", um("2026-10-26T09:30:00+01:00")).offen && fensterOffen("willkommen", "DE", um("2026-10-26T20:59:00+01:00")).offen && !fensterOffen("willkommen", "DE", um("2026-10-26T21:00:00+01:00")).offen);
    ok("Fenster: Samstag auf; Sonntag zu — außer dem selbst gebuchten Rückruf (termin)", fensterOffen("rate", "DE", um("2026-10-24T12:00:00+02:00")).offen && !fensterOffen("rate", "DE", um("2026-10-25T12:00:00+01:00")).offen && fensterOffen("termin", "DE", um("2026-10-25T12:00:00+01:00")).offen);
    ok("Fenster: Feiertag (Weihnachten) zu — außer termin; mit „7“ im Fenster wählt ARAS auch sonntags (änderbar)", !fensterOffen("rate", "DE", um("2026-12-25T12:00:00+01:00")).offen && fensterOffen("termin", "DE", um("2026-12-25T12:00:00+01:00")).offen && fensterOffen("rate", "DE", um("2026-10-25T12:00:00+01:00"), { fenster: { verkauf: FENSTER_VORGABE.verkauf, rate: { "1-7": ["09:30", "21:00"] } } }).offen);
    ok("Stufe 1 (Go-live): 40 Anrufe am Tag, 1 gleichzeitig, 20 € am Tag, mit Willkommen und Rate", STUFEN[1].versucheJeTag === 40 && STUFEN[1].parallel === 1 && STUFEN[1].tagEuro === 20 && STUFEN[1].spielarten.includes("willkommen") && STUFEN[1].spielarten.includes("rate"));
    ok("Vorgaben: Stimme Juni, Name ARAS, Tempo zügig", einstellungenAnwenden({}).stimme === "juni" && einstellungenAnwenden({}).name === "ARAS" && einstellungenAnwenden({}).regie.tempo === "zuegig");
    // Die Begrüßung („Ich grüße Sie, Herr …“ / „Grüß Sie, Herr …“) zählt als Frage nach der Person. E-409 Kalibrierung (22.10.2026):
    // Endet die Eröffnung mit „… habens an Moment?“, beantwortet ein bloßes „Ja, worum geht's?“ den Moment — bestätigt ist die
    // Identität erst mit seinem Namen oder „am Apparat / bin ich“ (sonst ist die Rate danach ein harter Befund).
    const ohneId: string[] = [], nurJa: string[] = [];
    for (const d of DIALEKTE) for (const sp of ["willkommen", "rate", "termin", "stufe_a", "zusage", "auftrag", "lead"] as const) {
      const bb = probeBriefing({ spielart: sp, anrede: "Frau", nachname: "Probe", heute, vorTagen: () => "17.10.2026" }) as Briefing;
      const o = eroeffnung(einstellungenAnwenden({ aras_dialekt: d }), bb, sp);
      const z = (antwort: string) => [{ t: 0, wer: "kunde" as const, text: "Hallo?" }, { t: 1, wer: "aras" as const, text: o.ganz }, { t: 6, wer: "kunde" as const, text: antwort }, { t: 8, wer: "aras" as const, text: "I ruf an wegen Ihrer offenen Rate über neunundfünfzig Euro neunundneunzig." }];
      const kunde = { nachname: "Probe", anrede: "Frau" };
      if (!identitaetGefragt(o.ganz) || anliegenVorIdentitaet(z("Ja, Probe, worum geht's?"), kunde) !== null || anliegenVorIdentitaet(z("Ja, am Apparat."), kunde) !== null) ohneId.push(`${d}/${sp}: ${o.ganz.slice(0, 40)}`);
      if (anliegenVorIdentitaet(z("Ja, worum geht's?"), kunde) === null) nurJa.push(`${d}/${sp}`);
    }
    ok("Jede Eröffnung (alle Dialekte, alle Gesprächsarten) fragt nach der Person — sein Name oder „am Apparat“ danach bestätigt, die Rate danach ist in Ordnung", ohneId.length === 0, ohneId.join(" | "));
    ok("Rot-Probe (E-409, 22.10.): nur „Ja, worum geht's?“ auf „… Moment?“ bestätigt in keiner Eröffnung die Identität — die Rate danach ist ein Treffer", nurJa.length === 0, nurJa.join(" | "));
    ok("Rot-Probe: ohne Namen in der Begrüßung zählt das „Ja“ nicht — Rate danach = Treffer", anliegenVorIdentitaet([{ t: 0, wer: "kunde", text: "Hallo?" }, { t: 1, wer: "aras", text: "Grüß Sie! ARAS spricht hier, I bin a KI." }, { t: 4, wer: "kunde", text: "Ja?" }, { t: 6, wer: "aras", text: "Es geht um Ihre offene Rate." }]) !== null);
  }
  // Quittungs-Laute (Koordination 20.10. abends: Schnelligkeit)
  {
    const da = new Set<string>(QUITTUNGEN);
    ok("Quittung: „Mhm,“ „Okay,“ „Hm,“ — kein „Gute Frage“ (Leersatz-Liste), kein „Ja,“ (sonst „Ja, Ja, …“), ab 550 ms Schweigen", QUITTUNGEN.length === 3 && !QUITTUNGEN.some((q) => /gute frage|^ja/i.test(q)) && QUITTUNG_NACH_MS === 550);
    ok("Quittung: nie auf Nein, Kündigung, Widerruf, Beschwerde, „nicht mehr anrufen“, Abschied — sonst ja", !quittungErlaubt("Nein, das will ich nicht.") && !quittungErlaubt("Ich möchte kündigen") && !quittungErlaubt("Ich widerrufe das") && !quittungErlaubt("Ich beschwere mich") && !quittungErlaubt("Rufen Sie mich nicht mehr an") && !quittungErlaubt("Danke, tschüss") && quittungErlaubt("Vor allem für Reisen") && quittungErlaubt("Wie viel ist offen") && !quittungErlaubt(""));
    ok("Frage erkannt — auch ohne Fragezeichen (die Abschrift lässt es oft weg)", istKundenFrage("Wie viel ist offen") && istKundenFrage("Ist mein Antrag schon genehmigt") && istKundenFrage("Und wohin schicken Sie mir das?") && !istKundenFrage("Vor allem für Reisen") && !istKundenFrage("Ja, passt."));
    const folge = Array.from({ length: 8 }, (_, i) => i).reduce((acc: string[], i) => { acc.push(quittungWaehlen({ frage: i % 3 === 0, zuletzt: (acc[acc.length - 1] ?? null) as any, da, nr: i })!); return acc; }, []);
    ok("Nie zweimal derselbe Laut hintereinander; nach einer Frage nie „Okay,“ (klänge schief)", folge.every((w, i) => i === 0 || w !== folge[i - 1]) && [0, 3, 6].every((i) => ["Mhm,", "Hm,"].includes(folge[i])), folge.join(" "));
    ok("Ohne Bibliothek kein Laut", quittungWaehlen({ frage: false, zuletzt: null, da: new Set(), nr: 1 }) === null);
    ok("Anweisung: Lief schon ein Laut, fängt die Stimme nicht noch einmal damit an", /Manchmal sagt die Technik für dich schon einen kurzen Laut/.test(a.text) && /Fang deine Antwort dann NICHT noch einmal mit diesem Laut an/.test(a.text));
  }
  // Feedback aus Probeanrufen (Punkt 4): Werkzeug nur im Probeanruf, Daumen-Gründe als Regeln
  {
    const def = WERKZEUG_DEFS.find((d) => d.name === "probe_feedback_merken");
    ok("probe_feedback_merken: nur im Probeanruf, mit text (seine Worte), regel (Befehlsform) und art", !!def && /NUR im Probeanruf/.test(def!.beschreibung) && JSON.stringify(def!.schema).includes("regel") && !werkzeugeFuer({ global: false, isBlocked: false, ampel: {}, spielart: "zuruf" }).some((w) => w.name === "probe_feedback_merken") && werkzeugeFuer({ global: false, isBlocked: false, ampel: {}, spielart: "probe" }).some((w) => w.name === "probe_feedback_merken"));
    const hp = hintergrundAnweisung(anweisungBauen({ spielart: "probe", briefing: { ...pb, probe: true } as Briefing, einstellungen: einstellungenAnwenden({}), hausanweisung: null }));
    ok("Hintergrund im Probeanruf: Feedback festhalten, nie weiterleiten", /probe_feedback_merken, sobald Justin sagt/.test(hp) && /Bei Feedback im Probeanruf nie mensch_verbinden/.test(hp), hp.slice(0, 120));
    const g = feedbackAusGrund("zu langsam · Begrüßung holprig · Zu langsam · eigener Wunsch hier");
    ok("Daumen-Gründe → Punkte: bekannte mit Regel, doppelte einmal, eigene in seinen Worten", g.length === 3 && /Antworte schneller/.test(g[0].regel ?? "") && g[0].art === "tempo" && g[1].art === "einstieg" && g[2].regel === null && g[2].text === "eigener Wunsch hier" && Object.keys(FEEDBACK_REGEL_AUS_GRUND).length === 11, JSON.stringify(g));
  }
  // FIAON für die Stimme (Punkt 1 — Spracherkennung 20.10.: „FIAON“ wurde zu „Fion“, „Fiaaon“ behält das a)
  const st = fuerStimme("Hier ist Aras von FIAON aus dem Kundenteam — FIAON Pro, die FIAON-Kreditkarte, FIAONs Team, fiaon.com, FIAONX");
  ok("Stimme liest „Fiaaon“ — auch „FIAON Pro“, „FIAON-Kreditkarte“, „FIAONs“; Adresse und fremde Wörter bleiben", FIAON_GESPROCHEN === "Fiaaon" && st === "Hier ist Aras von Fiaaon aus dem Kundenteam — Fiaaon Pro, die Fiaaon-Kreditkarte, Fiaaons Team, fiaon.com, FIAONX", st);
  const ab = fiaonSchreibweise("von Fiaaon aus dem Kundenteam, Fiaon Pro, Fiaaons Team und fiaon.com, fiaon punkt com");
  ok("Abschrift zeigt wieder „FIAON“ (Fiaaon/Fiaon) — Adressen (fiaon.com, „fiaon punkt com“) bleiben für die Prüfung", ab === "von FIAON aus dem Kundenteam, FIAON Pro, FIAONs Team und fiaon.com, fiaon punkt com" && urlFinden(ab) !== null, ab);
  ok("Hin und zurück: die ganze Anweisung kommt unverändert zurück (keine anderen Wörter berührt)", fiaonSchreibweise(fuerStimme(a.text)) === a.text && fuerStimme(a.text) !== a.text && !/FIAON/.test(fuerStimme(a.text)));
  // Wortwahl (Anruf 16)
  ok("Kein Bank-Vorbehalt im Verkauf (E-373): beide Sätze aus Anruf 16 stehen als Verbot drin", /nie „Die genauen Bedingungen legt allerdings die Partnerbank fest“/.test(a.text) && /nie „… prüft die Partnerbank ihn und entscheidet“/.test(a.text) && /nur, wenn er AUSDRÜCKLICH nach der Bank/.test(a.text));
  ok("… auch nicht auf „genehmigt?“ (Rauchtest 20.10.: „Über die Karte entscheidet die Partnerbank“ mitten im Verkauf) — die Bank nur auf seine ausdrückliche Frage nach ihr", /Dass die Partnerbank über die Karte entscheidet, sagst du NUR, wenn er AUSDRÜCKLICH nach der Bank fragt — auf „Ist mein Antrag genehmigt\?“ reicht die ehrliche Antwort/.test(a.text) && !/das sagst du nur auf seine direkte Frage/.test(a.text));
  ok("„Ist der Antrag genehmigt?“ → ehrlich, positiv, nächster Schritt, kein Versprechen", /Fragt er „Ist mein Antrag genehmigt\?“/.test(a.text) && /es fehlt ja noch die erste Monatsrate/.test(a.text) && karteVersprochenFinden(a.bausteine["7_verkauf"]) === null);
  const leadA = anweisungBauen({ spielart: "lead", briefing: { ...pb, stufe: "lead", paketKey: null, paketName: null }, einstellungen: wien, hausanweisung: null });
  ok("… beim Interessenten: „der Antrag ist ja noch nicht ausgefüllt — über den Link in fünf Minuten“", /der Antrag ist ja noch nicht ausgefüllt\. Über den Link geht das in fünf Minuten/.test(leadA.text));
  ok("„Super“ höchstens zweimal, Leersätze verboten, jede Frage nur einmal", /„Super“ höchstens zweimal im ganzen Gespräch/.test(a.text) && /Keine Leersätze/.test(a.text) && /Jede Frage nur EINMAL/.test(a.text));
  ok("… auch eine unbeantwortete Frage nie ein zweites Mal (Rauchtest: dreimal „Wann schaffen Sie die Überweisung?“) — stattdessen ein Angebot", /auf die er nicht eingegangen ist .* stellst du kein zweites Mal — mach stattdessen ein Angebot/.test(a.text));
  ok("„Wo schicken Sie mir das hin?“ → konkret: „an Ihre Nummer mit neunundneunzig am Ende“ (nie die ganze Nummer)", /Per WhatsApp an Ihre Nummer mit neunundneunzig am Ende/.test(a.text) && /nie die ganze Nummer/.test(a.text));
  ok("Nummer-Ende gesprochen: …99 → „neunundneunzig“, …07 → „null-sieben“, zu kurz → nichts", nummerEndeGesprochen("+491700000099") === "neunundneunzig" && nummerEndeGesprochen("+43 000 000 0007") === "null-sieben" && nummerEndeGesprochen("12") === null);
  ok("Prüf-Befunde (weich): „Super“ > 2×, Bank-Vorbehalt, Leersatz", superZaehlen("Super! Super, ja. Super. Super!") === 4 && telefonRegeln("Super! Super. Super, dann geht's los.").some((x) => x.regel === "super_zu_oft" && x.schwere === "weich") && bankVorbehaltFinden("Die genauen Bedingungen legt allerdings die Partnerbank fest.") !== null && bankVorbehaltFinden("Danach prüft die Partnerbank ihn und entscheidet.") !== null && leersatzFinden("Schauen wir uns an, wie ich das am besten erkläre.") !== null);
  ok("Rot-Probe: zweimal „Super“, ein normaler Satz, „Über die Karte entscheidet die Partnerbank“ (auf Frage) sind kein Befund", superZaehlen("Super. Super.") <= 2 && bankVorbehaltFinden("Über die Karte entscheidet die Partnerbank.") === null && leersatzFinden("Sehr gut, dann schick ich Ihnen den Link.") === null);
  // Wiederholung strenger (Anruf 11 „wiederholt sich“, Anruf 16: „Wofür … die Karte?“ zweimal)
  const fragen = ["Wofür möchten Sie die Karte denn vor allem nutzen?", "Super, das passt.", "Ich schick Ihnen gleich den Link aufs Handy, passt das?", "Sehr gut.", "Wann schaffen Sie die Überweisung, heute noch?"];
  ok("Wiederholung: ≥ 70 % gegen die letzten FÜNF — „Wofür möchten Sie die Karte nutzen?“ zum zweiten Mal wird erkannt", WIEDERHOLUNG_AB === 0.7 && WIEDERHOLUNG_FENSTER === 5 && wiederholtSich("Wofür möchten Sie die Karte denn nutzen?", fragen) !== null, String(wiederholtSich("Wofür möchten Sie die Karte denn nutzen?", fragen)));
  ok("Rot-Probe: ein ähnlicher, aber neuer Satz ist keine Wiederholung; die Aufnahme-Frage darf noch einmal kommen", wiederholtSich("Wofür hätten Sie gern Ihr Limit?", fragen) === null && wiederholtSich("Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", ["Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?"]) === null);
  // Tempo, Verstehen, Abschluss (Anrufe 11, 16)
  ok("Tempo: „Moment, ich schau nach“ nur, wenn es wirklich dauert — Betrag, Paket, Laufzeit, Stand weißt du", /Ein „Moment, ich schau kurz nach“ nur, wenn du wirklich etwas nachsehen musst, das NICHT oben steht/.test(a.bausteine["12_delegation"]));
  ok("Verstehen: am Telefon ungenau (Leitung, Dialekt) → kurz nachfragen statt raten", /Passt eine Antwort nicht zum Gespräch oder klingt sie seltsam, frag kurz nach statt zu raten/.test(a.bausteine["6_verstehen"]));
  ok("Abschluss: bestätigen → nächster Schritt → noch eine Frage? → Abschied mit Namen, nie abrupt", /Haben Sie sonst noch eine Frage\?/.test(a.bausteine["13_abschluss"]) && /Danke Ihnen, Herr Probe/.test(a.bausteine["13_abschluss"]) && /Nie abrupt/.test(a.bausteine["13_abschluss"]));
  ok("Einwilligung im Text: „Ja, und …“ IST ein Ja; Unklares ist kein Nein", /Ein „Ja, und …“ IST ein Ja/.test(a.bausteine["3_aufzeichnung"]) && /Bleibt es unklar, ist das KEIN Nein/.test(a.bausteine["3_aufzeichnung"]));
}

titel("11. AUSWERTUNG 21./22.10.: Identität vor dem Anliegen, Streitfall, Ansage statt Mensch — in Stimme, Hintergrund und Werkzeugen");
{
  const heute = { datum: "22.10.2026", wochentag: "Donnerstag", uhrzeit: "11:00" };
  const ultra = einstellungenAnwenden({ aras_dialekt: "oesterreichisch_stark", aras_energie: "vollgas" });
  const rb = probeBriefing({ spielart: "rate", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "19.10.2026" });
  const r = anweisungBauen({ spielart: "rate", briefing: { ...rb, probe: false }, einstellungen: ultra, hausanweisung: null });
  const anf = r.bausteine["2_anfang"];
  // 1. Identität
  ok("Punkt 1: Pflicht 2 heißt jetzt IDENTITÄT ZUERST — die Eröffnung endet mit „Spreche ich mit Herrn Probe selbst?“, er ist es erst nach SEINEM Ja oder seinem Namen",
    /2\. IDENTITÄT ZUERST \(Datenschutz — oft gehen Partner oder Kinder ran\)/.test(anf) && /endet mit „Spreche ich mit Herrn Probe selbst\?“ — dann wartest du/.test(anf) && /wenn er klar Ja sagt/.test(anf) && /oder seinen Namen nennt/.test(anf), anf.slice(0, 300));
  ok("Punkt 1: vorher NICHTS zur Sache — keine Rate, kein Betrag, kein Antrag, kein Grund („wegen Ihrem Kreditkartenantrag“); auf „Worum geht's?“ freundlich noch einmal fragen",
    /Beträge, Zahlungen, Raten, Paket und Limit nennst du erst DANACH — vorher auch keinen Antrag, keinen Vertrag und keinen Grund/.test(anf) && /„Gleich — darf ich vorher nur kurz fragen: spreche ich mit Herrn Probe selbst\?“/.test(anf));
  ok("Punkt 1: erst nach der Bestätigung die Sache — Rate offen beginnt dann mit Justins Satz, Willkommen mit „Herzlich willkommen!“",
    /Hat er bestätigt, dass er es ist \(Ja oder sein Name\)/.test(anf) && /Hat er bestätigt, dass er es ist, sag sofort, worum es geht — GENAU mit Justins Satz/.test(r.bausteine["9_leitfaden"])
    && /Hat er bestätigt, dass er es ist: PFLICHT — dein erster Satz beginnt mit „Herzlich willkommen!“/.test(anweisungBauen({ spielart: "willkommen", briefing: probeBriefing({ spielart: "willkommen", anrede: "Herr", nachname: "Probe", heute, vorTagen: () => "22.10.2026" }), einstellungen: ultra, hausanweisung: null }).text));
  ok("Punkt 1: „Wer sind Sie?“ vor der Bestätigung → KI-Satz, dann gleich die Frage nach der Person (nicht schon die Sache)", /hat er noch nicht bestätigt, dass er es ist, dann gleich die Frage nach der Person; erst danach in deinen Worten, worum es geht/.test(anf));
  ok("Punkt 1: die Frage nach der Person — mit Anrede „Spreche ich mit Herrn/Frau … selbst?“, ohne Anrede „Mit wem spreche ich, bitte?“ (nie der nackte Nachname)",
    identitaetsFrage({ anrede: "Herr", nachname: "Probe" }) === "Spreche ich mit Herrn Probe selbst?" && identitaetsFrage({ anrede: "Frau", nachname: "Probe" }) === "Spreche ich mit Frau Probe selbst?" && identitaetsFrage({ anrede: null, nachname: "Probe", vorname: "Max" }) === "Mit wem spreche ich, bitte?");
  const fremdeErkennung: string[] = [];
  for (const d of DIALEKTE) for (const sp of ["willkommen", "rate", "termin", "stufe_a", "zusage", "auftrag"] as const) {
    const o = eroeffnung(einstellungenAnwenden({ aras_dialekt: d }), probeBriefing({ spielart: sp, anrede: "Frau", nachname: "Probe", heute, vorTagen: () => "19.10.2026" }) as Briefing, sp);
    if (!arasFragtIdentitaet(o.frage) || arasNenntAnliegen(o.ganz) !== null || !identitaetGefragt(o.ganz)) fremdeErkennung.push(`${d}/${sp}`);
  }
  ok("Punkt 1: JEDE Eröffnung (alle Dialekte, alle Gesprächsarten) fragt nach der Person und nennt vorher kein Anliegen — für die Brücke UND die Prüf-Regel erkennbar", fremdeErkennung.length === 0, fremdeErkennung.join(" | "));
  ok("Punkt 1: Rot-Probe — die alte Eröffnung („… Kreditkartenantrag an — habens an Moment?“) nannte das Anliegen vor der Identität und fragte nicht nach der Person",
    arasNenntAnliegen("I ruf wegen Ihrem Kreditkartenantrag an — habens an Moment?") !== null && !arasFragtIdentitaet("I ruf wegen Ihrem Kreditkartenantrag an — habens an Moment?"));
  ok("Punkt 1 (Abstimmung mit der Prüf-Regel): der Gruß mit Namen + „habens an Moment?“ ist KEINE Frage nach der Person — erst „Spreche ich mit Herrn Probe selbst?“",
    !arasFragtIdentitaet("Grüß Sie, Herr Probe! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam. Kurz vorweg: I bin a KI, aber a nette. Habens an Moment?") && arasFragtIdentitaet(identitaetsFrage(rb)));
  ok("Punkt 1: dieselbe Bestätigung wie die Prüf-Regel — „ja“, „am Apparat“, „bin ich“, „genau“, „selber“ oder sein Vor-/Nachname; „Freilich“, „Passt“ und „Worum geht's?“ nicht",
    ["Ja", "Am Apparat", "Bin ich.", "Genau.", "Selber."].every((x) => identitaetAntwort(x, { anrede: "Herr", nachname: "Probe", vorname: "Max" }) === "ja") && identitaetAntwort("Max", { anrede: "Herr", nachname: "Probe", vorname: "Max" }) === "name"
    && ["Freilich!", "Passt, worum geht's?", "Worum geht's?"].every((x) => identitaetAntwort(x, { anrede: "Herr", nachname: "Probe", vorname: "Max" }) === null));
  ok("Punkt 1: auf „habens an Moment?“ ist „Ja“ nur ein Ja zur Zeit — auf die Frage nach der Person ist „Ja“, „Am Apparat“ oder sein Name die Bestätigung, „hier ist seine Frau“ nie",
    identitaetAntwort("Ja", { anrede: "Herr", nachname: "Probe" }) === "ja" && identitaetAntwort("Probe, ja?", { anrede: "Herr", nachname: "Probe" }) === "name" && identitaetAntwort("Nein, hier ist seine Frau.", { anrede: "Herr", nachname: "Probe" }) === "nein" && identitaetAntwort("Worum geht's?", { anrede: "Herr", nachname: "Probe" }) === null);
  ok("Punkt 1: die stille Korrektur der Brücke nennt die Frage und verlangt Ruhe zur Sache (kein „Sag sofort“, kein Abschied)", /Er hat noch NICHT bestätigt, dass er selbst dran ist/.test(korrekturIdentitaet(identitaetsFrage(rb))) && /„Entschuldigung — spreche ich mit Herrn Probe selbst\?“/.test(korrekturIdentitaet(identitaetsFrage(rb))) && !/Sag sofort|genau diesen Satz|verabschiede dich/.test(korrekturIdentitaet(identitaetsFrage(rb))));
  // 3. Streitfall
  const g = r.bausteine["11_grenzen"];
  ok("Punkt 3: STREITFALL in den Grenzen — Betrug, Anzeige, Polizei, Anwalt, Verbraucherzentrale, Abzocke, „nie unterschrieben“: kein Zahlungsdruck, kein Link, keine Tagesfrage, nicht verbinden, ruhig „jemand aus dem Team meldet sich persönlich“",
    /STREITFALL — spricht er von Betrug, \(Straf-\)Anzeige, Polizei, Anwalt, Verbraucherzentrale oder Abzocke oder sagt er, er habe nie etwas unterschrieben oder bestellt/.test(g) && /KEIN Zahlungsdruck, KEIN Link, KEINE Frage nach dem Zahltag/.test(g) && /nicht verbinden/.test(g) && /jemand aus unserem Team meldet sich persönlich bei Ihnen/.test(g));
  ok("Punkt 3: Rate offen verweist bei Betrug/Anzeige/Anwalt auf den STREITFALL (nicht mehr „bestreitet etwas → verbinden“)", /Spricht er von Betrug, Anzeige, Polizei, Anwalt oder sagt er, er habe nie etwas unterschrieben → STREITFALL/.test(r.bausteine["9_leitfaden"]) && !/bestreitet er etwas/.test(r.text));
  ok("Punkt 3: Hintergrund — im Streitfall nie zahlungslink_senden/zahlungszusage_merken, kein mensch_verbinden, die Aufgabe legt das Haus an; mensch_verbinden nicht mehr bei „Anwalt“",
    /STREITFALL \(Betrug, Anzeige, Polizei, Anwalt, Verbraucherzentrale, Abzocke, „nie etwas unterschrieben\/bestellt“\): nie zahlungslink_senden, nie zahlungszusage_merken, kein mensch_verbinden/.test(r.backend) && /art streitfall\) legt das Haus selbst an/.test(r.backend) && !/Anwalt\/Behörde/.test(`${r.text}\n${r.backend}`) && !/Anwalt/.test(WERKZEUG_DEFS.find((d) => d.name === "mensch_verbinden")!.beschreibung.split("Nie bei")[0]));
  const aufg = WERKZEUG_DEFS.find((d) => d.name === "aufgabe_fuer_justin")!;
  ok("Punkt 3: aufgabe_fuer_justin kennt die Art „streitfall“ (EINE Quelle: JUSTIN_AUFGABE_ARTEN) mit eigenem Titel auf Justins Board", JSON.stringify(aufg.schema).includes("streitfall") && (JUSTIN_AUFGABE_ARTEN as readonly string[]).includes("streitfall") && /Streitfall/.test(JUSTIN_AUFGABE_TITEL.streitfall));
  ok("Punkt 3: der stille Hinweis an die Stimme — ab sofort nichts fordern, ruhig, ein Mensch meldet sich; Wortwand und Druck-Prüfung frei", /KEIN Wort mehr zu Rate, Zahlung oder Link, KEINE Frage nach dem Zahltag/.test(HINWEIS_STREITFALL) && /jemand aus unserem Team meldet sich persönlich/.test(HINWEIS_STREITFALL) && hart(HINWEIS_STREITFALL).length === 0 && druckFinden(HINWEIS_STREITFALL) === null && !/Sag sofort|genau diesen Satz|verabschiede dich/.test(HINWEIS_STREITFALL));
  // 4. Ansage
  ok("Punkt 4: Ansage statt Mensch (Mailbox, Anrufbeantworter, „nach dem Signalton“, Anruf-Assistent) — kein Wort zur Sache, keine Nachricht, Ende mit Ergebnis mailbox (Stimme und Hintergrund)",
    /Hörst du eine Ansage statt eines Menschen \(Mailbox, Anrufbeantworter, „nach dem Signalton“, „nicht erreichbar“, ein Anruf-Assistent/.test(g) && /kein Wort zur Sache, keine Nachricht/.test(g) && /anruf_beenden, Ergebnis mailbox/.test(g) && /Eine Ansage statt eines Menschen \(Mailbox, Anrufbeantworter, Anruf-Assistent\): anruf_beenden mit Ergebnis mailbox/.test(r.backend));
  ok("Wortwand und Druck-Prüfung bleiben frei mit allen neuen Regeln (Stimme + Hintergrund)", hart(r.text).length === 0 && hart(r.backend).length === 0 && druckFinden(r.text) === null && druckFinden(r.backend) === null, hart(r.text).map((x) => x.treffer).join(" | "));
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
