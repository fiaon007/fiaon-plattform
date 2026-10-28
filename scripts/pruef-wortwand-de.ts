// ═══════════════════════════════════════════════════════════════════════════
// WORTWAND FÜR DEUTSCHE SEITENTEXTE (17.09.2026, E-188)
//
// ── WARUM ──────────────────────────────────────────────────────────────────
// shared/fiaon-wortverbote.ts prüfte bis heute nur Mails und KI-Antworten; für
// englische Seitentexte gibt es scripts/seo-wortverbote-en.ts. Deutsche
// Seitentexte prüfte niemand — so kam „Garantiert FIAON das Limit?" in den
// Entwurf von /global (Prüfung vom 17.09.2026). Dieser Prüfstand schließt die
// Lücke für FIAON Global: Seite, Auftrag, Leistungstexte, SEO-Einträge.
//
// Zusätzlich zur Wand gelten für FIAON Global schärfere Regeln, die das Regex
// der Wand nicht kennt (Register E-188): kein „bis zu", kein Bankname, keine
// Frist mit Ziffer in Wochen/Monaten, kein „Ziel-Limit", kein „empfohlen",
// kein „0 %" als Zahl, keine „Gruppe" als Selbstbezeichnung, kein „ohne
// Sicherheiten". „Unternehmensberatung" ist seit E-439 erlaubt — außer auf der
// Österreich-Seite (OESTERREICH_REGEL, E-454; das fertige HTML samt JSON-LD prüft
// scripts/pruef-global-seiten.ts).
//
//     npx tsx scripts/pruef-wortwand-de.ts        → Fehlercode 1 bei Treffern
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "../shared/fiaon-wortverbote";
// 28.10.2026 (E-454): die Österreich-Ausnahme aus E-439 — kein „Unternehmensberatung“ auf /business/aus-oesterreich.
import { OESTERREICH_SEITEN, OESTERREICH_REGEL } from "../shared/fiaon-global-wortregeln";
import { GLOBAL_WOERTER, GLOBAL_GESPRAECH_WOERTER, GLOBAL_FUSS_WOERTER, GLOBAL_FILM_WOERTER, GLOBAL_BUEHNE_WOERTER } from "../client/src/i18n/global";
import { GLOBAL_START_WOERTER } from "../client/src/i18n/global-start";
import { VISITENKARTEN } from "../shared/fiaon-visitenkarte";
import { GLOBAL_TEAM } from "../shared/fiaon-global-team";
import { GLOBAL_AUFTRAG_WOERTER } from "../client/src/i18n/global-auftrag";
import { GLOBAL_SEITE_WOERTER } from "../client/src/i18n/global-seite";
import { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_JAHRESBETREUUNG, GLOBAL_KAPITAL_FREI, GLOBAL_BUERGSCHAFT_SEITE, globalKapital } from "../shared/fiaon-global";
import { GLOBAL_SCHLAGZEILEN } from "../shared/fiaon-global-schlagzeilen";
import { SEO_SEITEN } from "../shared/fiaon-seo-seiten";
// 19.09.2026 (E-191): die Unterseiten, Landingpages, das Business-Menü und die Standorte.
import { GLOBAL_SEITEN, LANDINGPAGES } from "../shared/fiaon-global-seiten";
import { GLOBAL_MENUE } from "../shared/fiaon-global-menue";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN } from "../shared/fiaon-global-partner";
// E-273 (02.10.2026): was der Kunde über das Startgespräch liest, das das System nach der Annahme bucht.
import { STARTGESPRAECH_TEXTE } from "../shared/fiaon-global-startgespraech";
// E-296 (06.10.2026): der Social-Feed auf Startseite, /privatkunden, /business und im Ratgeber.
import { SOZIAL_WOERTER } from "../client/src/i18n/sozial";
// E-IT-G (08.10.2026): die Sätze des einen Geburtsdatum-Lesers (Kunden- und Office-Seiten).
import { GEBURT_TEXTE } from "../shared/fiaon-geburtsdatum";
// 08.10.2026: die Empfängerseite „Zugang übergeben“ (Willkommen, drei Schritte, Regeln, Zustände des Links).
import { ZUGANG_UEBERGABE_TEXTE } from "../shared/fiaon-zugang-uebergabe";
// E-339 (12.10.2026): die festen Sätze auf jedem Radar-Brief (QR-Karte, Widerspruch, Datenschutzhinweis).
import { RADAR_BRIEF_TEXTE, RADAR_KERNSATZ } from "../shared/fiaon-radar";
// 22.10.2026 (Scheibe 1 „Ihr US-Büro“): Katalog, Fenster und Verlauf der Zusatzdienste — nur die deutschen Kundentexte (nie `intern`).
import { GLOBAL_ZUSATZ, GLOBAL_ZUSATZ_GRUPPEN, ZUSATZ_WOERTER } from "../shared/fiaon-global-zusatz";
// E-423 (22.10.2026): der persönliche Zugang — Anmeldung, Code, Zugang einrichten, Übersicht, Banner; dazu die Sätze des Servers.
import { GLOBAL_KONTO_WOERTER } from "../client/src/i18n/global-konto";
import { KONTO_SAETZE } from "../shared/fiaon-global-konto";
// E-432 (Nachprüfung 27.10.2026): das Kapital-Angebot der Fassung C (Privatperson) — Seite, Annahme, Übersicht, Bestätigung, „Mein Auftrag“.
import * as KC from "../shared/fiaon-global-angebot-kapital-c";

const SCHAERFER: { muster: RegExp; grund: string }[] = [
  { muster: /\bnorthwest\b/i, grund: "Name unseres Registered-Agent-Partners nie öffentlich (Partnervertrag vertraulich, E-422)" },
  { muster: /\bbis zu\b/i, grund: "„bis zu“ ist ein Spitzenwert-Versprechen (OLG Frankfurt 6 U 25/26)" },
  { muster: /\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i, grund: "kein Bankname als Versprechen (BGH I ZR 170/08)" },
  { muster: /\b(innerhalb|binnen)\s+(von\s+)?\d+\s*(wochen|monaten|tagen|werktagen)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /\bin\s+\d+\s*(–|-|bis)\s*\d+\s*(wochen|monaten)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /ziel-?(limit|rahmen)/i, grund: "Kapitalrahmen statt Ziel-Limit" },
  { muster: /\bempfohlen\w*\b/i, grund: "keine Empfehlung" },
  { muster: /\b0\s?%/, grund: "kein Zinssatz als Zahl — „Einführungszeitraum ohne Sollzins“" },
  { muster: /\d+(?:[.,]\d+)?\s?%\s?(?:p\.\s?a\.|pro jahr|zins|sollzins|effektiv)|\bzins\w*\s+(?:von\s+)?(?:ca\.\s+|rund\s+|etwa\s+)?\d+(?:[.,]\d+)?\s?(?:%|prozent)|\d+\s+bis\s+\d+\s+prozent\s+zins/i, grund: "kein Zinssatz als Zahl — über den Zins entscheidet allein das Institut (verbotene Aussage 1)" },
  { muster: /\bberatungsgruppe\b|\bfiaon group\b/i, grund: "Selbstbezeichnung als Gruppe (§ 18 HGB) — FIAON ist eine Gesellschaft, keine Gruppe" },
  { muster: /ohne sicherheiten/i, grund: "die persönliche Haftung IST die Sicherheit — „ohne Bareinlage“" },
  { muster: /steuern sparen|steuerersparnis|steuervorteil/i, grund: "kein Steuerversprechen" },
  // E-432 (Nachprüfung 27.10.2026): Umschreibungen, die die Wand bis dahin übersah.
  { muster: /sicherheiten\s+verlang\w*[^.]*nicht/i, grund: "„Sicherheiten verlangen … nicht“ ist „ohne Sicherheiten“ in anderen Worten — „ohne Bareinlage“ und die persönliche Haftung nennen" },
  { muster: /\bist\b[^?]*\bsicher\?/i, grund: "„Ist … sicher? — Ja“ verspricht ein Ergebnis — die Frage umdrehen („Was, wenn …?“)" },
  { muster: /ohne pause/i, grund: "„läuft ohne Pause“ — eine Frist mit Ruhensgründen läuft nicht ohne Pause" },
];

function sammle(wert: unknown, pfad: string, aus: [string, string][]) {
  if (typeof wert === "string") { if (wert.trim()) aus.push([pfad, wert]); return; }
  if (typeof wert === "function") { try { sammle((wert as (...a: string[]) => unknown)("Muster", "Muster"), pfad + "()", aus); } catch { /* nicht aufrufbar */ } return; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => sammle(x, `${pfad}[${i}]`, aus)); return; }
  if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) sammle(v, `${pfad}.${k}`, aus);
}

const texte: [string, string][] = [];
sammle(GLOBAL_WOERTER.de, "i18n/global", texte);
// E-442 (27.10.2026): Die Rollenzeile des Ansprechpartners steht im Hero von /business — sie kommt aus den Visitenkarten.
sammle(Object.fromEntries(Object.entries(VISITENKARTEN).map(([k, v]) => [k, v.rolle.de])), "fiaon-visitenkarte/rolle", texte);
sammle(Object.fromEntries(GLOBAL_TEAM.map((p) => [p.kuerzel, p.rolle.de])), "fiaon-global-team/rolle", texte);
// 09.10.2026: Vorführraum (E-313) und die Bühne von /business (Hero „Ihr Auftrag“, Sektion „Der Bogen“).
sammle(GLOBAL_FILM_WOERTER.de, "i18n/global-film", texte);
sammle(GLOBAL_BUEHNE_WOERTER.de, "i18n/global-buehne", texte);
sammle(GLOBAL_GESPRAECH_WOERTER.de, "i18n/global#gespraech", texte);
sammle(GLOBAL_START_WOERTER.de, "i18n/global-start", texte);
sammle(GLOBAL_AUFTRAG_WOERTER.de, "i18n/global-auftrag", texte);
// 24.09.2026 (E-234): die festen Wörter der Unterseiten-Vorlage und die Fragen des Paket-Finders (bis heute ungeprüft im JSX).
sammle(GLOBAL_SEITE_WOERTER.de, "i18n/global-seite", texte);
for (const p of GLOBAL_PAKETE) sammle(p.de, `fiaon-global/${p.key}`, texte);
sammle(GLOBAL_PFLICHTHINWEIS.de, "fiaon-global/pflichthinweis", texte);
sammle(GLOBAL_ROLLEN.de, "fiaon-global/rollen", texte);
sammle(GLOBAL_GELD_ZURUECK.de, "fiaon-global/geld-zurueck", texte);
// E-432 (28.10.2026): der Satz zum Registered Agent je Bundesstaat (Portal › Fahrplan › „Registered Agent bestellt“).
// E-196 (19.09.2026): Jahresbetreuung ab dem zweiten Jahr und die Nachrichtenlage (nur die deutschen Felder).
sammle(GLOBAL_JAHRESBETREUUNG.de, "fiaon-global/jahresbetreuung", texte);
// 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — die eine Quelle für Seite, Fragen, Leitfaden, Wissen.
sammle(GLOBAL_KAPITAL_FREI.de, "fiaon-global/kapital-frei", texte);
// 06.10.2026 (E-293): das persönliche Angebot mit Bürgschaftszusage — geprüft, auch solange der Schalter aus ist —
// und der Fuß der Business-Welt (bis heute JSX in GlobalFuss.tsx, jetzt GLOBAL_FUSS_WOERTER).
sammle(GLOBAL_BUERGSCHAFT_SEITE.de, "fiaon-global/buergschaft-seite", texte);
sammle(GLOBAL_FUSS_WOERTER.de, "i18n/global#fuss", texte);
sammle(GLOBAL_SCHLAGZEILEN.meldungen.map((m) => ({ de: m.de, kurzDe: m.kurzDe, quelle: m.quelle })), "schlagzeilen", texte);
for (const pfad of ["/business", "/business/start", "/business/auftrag"]) {
  const e = (SEO_SEITEN as Record<string, any>)[pfad];
  if (!e) { console.log(`FEHLER: SEO-Eintrag ${pfad} fehlt`); process.exitCode = 1; continue; }
  const { en: _en, ...deutsch } = e;
  sammle(deutsch, `seo${pfad}`, texte);
}

for (const seite of [...GLOBAL_SEITEN, ...LANDINGPAGES]) sammle(seite, `seiten${seite.pfad}`, texte);
// 24.09.2026 (E-234): Menü und Standorte tragen ihre englischen Felder mit — die prüft scripts/pruef-global-en.ts, nicht die deutsche Wand.
sammle(GLOBAL_MENUE.map(({ en: _en, ...m }) => m), "menue", texte);
sammle(GLOBAL_STANDORTE.map(({ en: _en, ...o }) => o), "standorte", texte);
sammle(GLOBAL_VERBUNDEN, "verbunden", texte);
// E-273: Seite nach der Annahme, Hinweis unter dem Knopf, „Mein Auftrag", Mails (Funktionen mit Musterwerten).
sammle(STARTGESPRAECH_TEXTE, "startgespraech", texte);
// E-296: Handy, Karten, Profilband und Ratgeber-Beitrag (Funktionen mit Musterwerten).
sammle(SOZIAL_WOERTER.de, "i18n/sozial", texte);
sammle(GEBURT_TEXTE, "geburtsdatum", texte);
sammle(ZUGANG_UEBERGABE_TEXTE, "zugang-uebergabe", texte);
sammle(GLOBAL_KONTO_WOERTER.de, "global-konto", texte);
sammle(KONTO_SAETZE.de, "global-konto-server", texte);
sammle(RADAR_BRIEF_TEXTE, "radar-brief", texte);
sammle(RADAR_KERNSATZ, "radar-kernsatz", texte);
for (const z of GLOBAL_ZUSATZ) sammle({ ...z.de, angabe: z.angabe?.de ?? null }, `zusatz/${z.key}`, texte);
sammle(GLOBAL_ZUSATZ_GRUPPEN.map((g) => g.de), "zusatz/gruppen", texte);
sammle(ZUSATZ_WOERTER.de, "zusatz/woerter", texte);
// E-432 (Nachprüfung 27.10.2026): Fassung C mit Musterdaten (Repo öffentlich). „Garantie“ ist dort NUR als Hauptwort der
// vertraglichen Geld-zurück-Garantie erlaubt (Justin, E-432) — „garantiert/garantieren“ bleibt rot (siehe unten).
{
  const k = KC.kapitalCKundePruefen({ art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch",
    strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max@beispiel.example", telefon: "", ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }] });
  if (!k.ok) { console.log(`FEHLER: Musterkunde Fassung C: ${k.error}`); process.exitCode = 1; }
  else {
    const d = { ref: "FIAON-IA-CMUSTER", fassung: KC.KAPITAL_C_FASSUNG, kunde: k.kunde, parameter: KC.KAPITAL_C_VORGABEN, gueltigBis: "2026-11-10",
      buergin: { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way, Miami, FL 33100, USA", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" } };
    sammle(KC.kapitalCSeite(d), "kapital-c/seite", texte);
    sammle(KC.kapitalCAnnahmeTexte(d), "kapital-c/annahme", texte);
    sammle(KC.kapitalCBestellUebersicht(d, 10), "kapital-c/uebersicht", texte);
    sammle(KC.KAPITAL_C_ANNAHME, "kapital-c/annahme-fest", texte);
    sammle(KC.KAPITAL_C_ETAPPEN, "kapital-c/etappen", texte);
    sammle(KC.kapitalCMeinAuftrag({ parameter: KC.KAPITAL_C_VORGABEN, angenommenAm: "2026-10-28", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 }), "kapital-c/mein-auftrag", texte);
    sammle({ betreff: KC.KAPITAL_C_BESTAETIGUNG.betreff("FIAON-IA-CMUSTER"), preheader: KC.KAPITAL_C_BESTAETIGUNG.preheader, titel: KC.KAPITAL_C_BESTAETIGUNG.titel,
      absaetze: KC.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrter Herr Mustermann", angenommen: "28.10.2026 um 10:00 Uhr", llc: "MUSTER LLC" }), fussnote: KC.KAPITAL_C_BESTAETIGUNG.fussnote }, "kapital-c/bestaetigung", texte);
  }
}
/** Fassung C: ein Satz mit „Garantie“ ist erlaubt, wenn er die Geld-zurück-Garantie (oder ihre Frist) meint — nie ein „garantiert“. */
const kapitalCGarantie = (pfad: string, text: string, treffer: string) =>
  pfad.startsWith("kapital-c/") && /garant/i.test(treffer) && /Geld-zurück-Garantie|Garantiefrist|Garantiefall/.test(text) && !/\bgarantier/i.test(text);

// E-190 (18.09.2026, Justin): „Beim VIP Pakete bis zu 1 Mio US Dollar Kapital". Die EINE erlaubte Stelle
// für „bis zu" ist der Kapitalrahmen des Pakets Global VIP — wörtlich, wie globalKapital() ihn schreibt.
// Jedes andere „bis zu" bleibt ein Treffer. (Anwalt prüft die Formulierung, Register E-190/E-191.)
const VIP_ERLAUBT = `${globalKapital("global_vip", "de").bisZu} ${globalKapital("global_vip", "de").wert}`;

let fehler = 0;
for (const [pfad, text] of texte) {
  // Felder ohne Kundentext (Pfade, Schlüssel, Datumsangaben, Adressen von Quellen) überspringen
  if (/\.(pfad|art|stand|robots|key|kennung|url|paket|typ|id|zeitzone|schluessel|quelle|auftraggeber|gruppe)$/.test(pfad) || /\.(weiter|krumen)\b/.test(pfad)) continue;
  // Zusagen „wir melden uns / Rückruf" sind auf diesen Flächen GEDECKT: Jede Anfrage und
  // jeder Auftrag legt beim Absenden eine Aufgabe für die zuständige Person an
  // (POST /api/fiaon/global/anfrage, /termine, /auftrag) — das ist das Werkzeug zur Zusage.
  for (const t of wandPruefen(text, ["aufgabe_an_betreuer"])) {
    if (kapitalCGarantie(pfad, text, t.treffer)) continue;
    fehler++; console.log(`WAND  ${pfad}: „${text.slice(0, 90)}“ → ${t.hinweis ?? JSON.stringify(t)}`);
  }
  const ohneVip = text.split(VIP_ERLAUBT).join("");
  for (const r of SCHAERFER) if (r.muster.test(ohneVip)) { fehler++; console.log(`E-188 ${pfad}: „${text.slice(0, 90)}“ → ${r.grund}`); }
  if (OESTERREICH_SEITEN.some((p) => pfad === `seiten${p}` || pfad.startsWith(`seiten${p}.`)) && OESTERREICH_REGEL.muster.test(text)) {
    fehler++; console.log(`E-454 ${pfad}: „${text.slice(0, 90)}“ → ${OESTERREICH_REGEL.grund}`);
  }
}
console.log(`${texte.length} deutsche Texte geprüft — ${fehler} Treffer.`);
if (fehler) process.exitCode = 1;
