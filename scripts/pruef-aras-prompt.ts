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
  HOERPROBE_SATZ, type Briefing,
} from "../shared/fiaon-aras-prompt";
import { einstellungenAnwenden, SPIELARTEN, WERKZEUGE, WERKZEUGE_GLOBAL, druckFinden, REGIE_VORGABE } from "../shared/fiaon-aras";
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
  ok(`${spielart}: Begrüßung beginnt mit dem KI-Hinweis (Art. 50 KI-VO)`, /also eine KI/.test(a.begruessung) && a.begruessung.indexOf("also eine KI") < (a.begruessung.indexOf("Spreche ich") >= 0 ? a.begruessung.indexOf("Spreche ich") : 9999));
  ok(`${spielart}: Stimme nennt den KI-Hinweis als ersten Satz`, /Dein erster Satz ist immer dieser/.test(a.bausteine["2_anfang"]) && a.bausteine["2_anfang"].includes("also eine KI"));
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
  ok("enthält „umgehend Ihren Account frei“ (E-373, eine Quelle mit Mara)", /schalten wir umgehend Ihren Account frei/.test(s), s);
  ok("kein Bank-Vorbehalt im Verkaufssatz", !/bank/i.test(s));
  ok("keine Limit-Zusage (limitZusage)", limitZusage(s) === null, limitZusage(s) ?? "");
  ok("nennt Preis, zwölf Monatsraten, Jahreslaufzeit, 14 Tage Widerruf", /zwölf Monatsraten/.test(s) && /Jahreslaufzeit/.test(s) && /14 Tage Widerruf/.test(s));
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
  ok("kiHinweisSauber: leer → sicherer Satz mit KI", /also eine KI/.test(kiHinweisSauber("")));
  const a = anweisungBauen({ spielart: "zuruf", briefing, einstellungen, hausanweisung: null });
  ok("Begrüßung: fragt nach „Frau Musterfrau“ und wartet", /Spreche ich mit Frau Musterfrau\?/.test(a.begruessung) && /hör zu/.test(a.begruessung));
  const herr = anweisungBauen({ spielart: "rate", briefing: { ...briefing, anrede: "Herr", nachname: "Muster" }, einstellungen, hausanweisung: null });
  ok("Begrüßung: „Herrn Muster“ (Dativ)", /Spreche ich mit Herrn Muster\?/.test(herr.begruessung));
  const ein = anweisungBauen({ spielart: "eingehend", briefing, einstellungen, hausanweisung: null });
  ok("Eingehend: meldet sich mit KI-Hinweis und fragt nach dem Anliegen", /also eine KI/.test(ein.begruessung) && /worum es geht/.test(ein.begruessung));
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
  ok("Hörprobe-Satz: KI-Hinweis + Füllwort, Wortwand frei", /also eine KI/.test(HOERPROBE_SATZ) && /Ähm/.test(HOERPROBE_SATZ) && hart(HOERPROBE_SATZ).length === 0);
  ok("gesprochen: Links raus, zwei Sätze", gesprochen("Erster Satz mit https://fiaon.com/a/x/w drin. Zweiter Satz. Dritter Satz.") === "Erster Satz mit drin. Zweiter Satz.");
  const auftrag = anweisungBauen({ spielart: "rate", briefing: { ...briefing, auftrag: { text: "Bitte sagen, dass er seinen Kontoauszug hochladen soll.", von: "Herr Stripling" }, arasNotiz: "Nur abends erreichbar.", offenes: ["Rate 2 über 59,99 €", "Kontoauszug fehlt"] }, einstellungen, hausanweisung: null });
  ok("Auftrag, Notiz und Offenes stehen im Briefing", /AUFTRAG von Herr Stripling/.test(auftrag.text) && /Nur abends erreichbar/.test(auftrag.text) && /1\. Rate 2 über 59,99 €/.test(auftrag.text));
}

titel("6. ROT-PROBE: die Prüfungen schlagen an, wenn etwas falsch ist");
{
  const boese = "Das ist garantiert Ihr Limit, nur heute — sonst Inkasso. Zahlen Sie per Lastschrift.";
  ok("Rot-Probe Wortwand trifft", hart(boese).length > 0);
  ok("Rot-Probe Druck trifft", druckFinden(boese) !== null);
  ok("Rot-Probe Vorname trifft", mitarbeiterVornameFunde("Daniel ruft Sie an.", TEAM).length > 0);
}

log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
process.exit(schlecht === 0 ? 0 : 1);
