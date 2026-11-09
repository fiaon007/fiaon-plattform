// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DIE VEREINBARUNG UND IHRE REGELN (E-489, 09.11.2026)
//
// Justin: „Wenn er eintritt, muss er alle Infos für die NDA angeben, dann diese
// direkt unterzeichnen und dann soll er direkt Zugriff haben."
//
// Diese Datei rechnet ohne Datenbank und ohne Netz (Server, Seite und Prüfstand
// scripts/pruef-datenraum.ts lesen dieselbe Fassung):
//   · Die gegenseitige Vertraulichkeits- und Nichtumgehungsvereinbarung als
//     Blöcke — Wortlaut der freigegebenen Fassung vom 09.11.2026 (Schweizer
//     Recht, Gerichtsstand Zürich, Nichtumgehung 24 Monate, Konventionalstrafe
//     CHF 50’000 je Fall, Vertraulichkeit drei Jahre). Fest ist nur die FIAON-Seite
//     (Partei 1 und 2). Partei 3 (der Gast), die Themen (Projekte des Raums) und
//     fünf Zusätze des Raums kommen als Eingabe — aus der Datenbank, nie aus
//     dem Quelltext: Das Repo ist öffentlich.
//   · Die Prüfung der Angaben, die der Gast für die Vereinbarung macht.
//   · Die Schreibweise der Einladungscodes.
//
// ── WAS SICH GEGENÜBER DER PAPIERFASSUNG ÄNDERT ───────────────────────────
// Die Papierfassung wird von allen drei Parteien unterschrieben. Hier
// unterzeichnet Partei 3 elektronisch, die FIAON-Seite nimmt mit der
// Freischaltung des Datenraums an (§ 8 Abs. 1, § 10 Abs. 5). Die Fallangaben der
// Vorlage (wie vorgestellt, Zweck, Anlagen, Partei-2-Satz, Zusatz zu § 4, die
// Gesellschaften mit Projektkontakten) sind Zusätze des Raums oder der Projekte;
// fehlen sie, stehen allgemeine Sätze da. Schreibweise wie die Vorlage: Schweizer
// Rechtschreibung (ss statt ß).
// Nachbesserung (Gutachten 09.11.2026): Freitext des Gastes wird nie Vertragstext.
// Das Feld der Papierfassung in § 8 Abs. 1 („ausser an: …“) ist hier fest
// formuliert („… ausser an die in Anlage 1 genannten Empfänger“); die Angabe des
// Gastes steht als Liste von Namen in Anlage 1. Namen, Firma, Funktion und Anschrift
// lassen nur Zeichen zu, die in einen Namen gehören (kein §, kein *, kein ; oder :).
//
// ── FASSUNG ───────────────────────────────────────────────────────────────
// Wer einen Satz ändert, erhöht NDA_FASSUNG. Der Prüfstand rechnet die
// Prüfsumme eines festen Musters nach und wird rot, solange Wortlaut und
// Fassung nicht zusammenpassen — eine stille Änderung am Vertragstext gibt es nicht.
// ═══════════════════════════════════════════════════════════════════════════
import { emailSauber, telefonSauber, zeile } from "./fiaon-partner-crm";

/** Stand des Wortlauts. Jede Änderung am Text erhöht die Nummer hinter dem Punkt (oder das Datum). */
export const NDA_FASSUNG = "2026-11-09.2";
export const NDA_TITEL = "Vertraulichkeits- und Nichtumgehungsvereinbarung";
/** Der Satz am Häkchen vor der Unterschrift — Seite, Speicherung und PDF-Nachweis nutzen genau diesen Wortlaut. */
export const DR_ZUSTIMMUNG = "Ich habe die Vereinbarung gelesen und bin einverstanden.";

/** Die FIAON-Seite — fest. Ansprechpartner für Zustimmungen und Mitteilungen (§ 9) und für Fragen im Raum. */
export const NDA_FIAON = {
  partei1Name: "FIAON LTD",
  partei1Text: "128 City Road, London EC1V 2NX, Vereinigtes Königreich, eingetragen bei Companies House (England und Wales) unter Nr. 17318250, vertreten durch ihren Director Justin Schwarzott",
  partei2Name: "Herr Justin Schwarzott",
  partei2Sitz: "geschäftsansässig c/o FIAON LTD, Anschrift wie Partei 1",
  partei2Zusatz: "auch wegen einer möglichen persönlichen Beteiligung an einem der Themen",
  kontaktName: "Justin Schwarzott",
  kontaktEmail: "js@fiaon.com",
} as const;

export type DrAnrede = "herr" | "frau" | "";
export const DR_ANREDEN: { wert: DrAnrede; text: string }[] = [
  { wert: "herr", text: "Herr" }, { wert: "frau", text: "Frau" }, { wert: "", text: "Keine Angabe" },
];

/** Was der Gast für die Vereinbarung angibt (Partei 3). */
export interface DrGastAngaben {
  anrede: DrAnrede;
  vorname: string;
  nachname: string;
  firma: string;
  funktion: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email: string;
  telefon: string;
  /**
   * § 8 Abs. 1 / Anlage 1: an wen vor der Unterzeichnung schon Informationen gingen (ausser Personen nach § 3 Abs. 2) —
   * freiwillig, NUR eine Liste von Namen oder Firmen (getrennt mit „;“), nie Vertragstext.
   */
  weitergabe: string;
}
export const DR_GAST_LEER: DrGastAngaben = { anrede: "", vorname: "", nachname: "", firma: "", funktion: "", strasse: "", plz: "", ort: "", land: "", email: "", telefon: "", weitergabe: "" };
/** Pflicht für die Vereinbarung. Telefon steht nicht darin (§ 9 nennt nur die E-Mail) — darum freiwillig. */
export const DR_PFLICHT: (keyof DrGastAngaben)[] = ["vorname", "nachname", "strasse", "plz", "ort", "land", "email"];
export const DR_FELD_TEXT: Record<keyof DrGastAngaben, string> = {
  anrede: "Anrede", vorname: "Vorname", nachname: "Nachname", firma: "Firma mit Rechtsform", funktion: "Ihre Funktion",
  strasse: "Straße und Hausnummer", plz: "PLZ", ort: "Ort", land: "Land", email: "E-Mail", telefon: "Telefon",
  weitergabe: "Vor der Unterzeichnung schon weitergegeben an (Namen, mit ; getrennt)",
};
/** Vorschläge im Feld „Land“ — frei eintragbar bleibt es. */
export const DR_LAENDER = [
  "Deutschland", "Österreich", "Schweiz", "Liechtenstein", "Luxemburg", "Vereinigtes Königreich", "Vereinigte Staaten",
  "Vereinigte Arabische Emirate", "Niederlande", "Belgien", "Frankreich", "Italien", "Spanien", "Polen",
];

/**
 * Ein Projekt, wie es in § 1 steht. `text` ohne Schlusszeichen (Begriffe wie die „Zielgesellschaft“ definiert der Text selbst).
 * `geschuetzt` ist die Bezeichnung der Gesellschaft, deren Umfeld geschützt ist (§ 4 Abs. 1, z. B. „die Zielgesellschaft“) —
 * ein Thema mit `geschuetzt` hat „Projektkontakte“ (§§ 2, 4, 5, 8 nennen dann genau diese Themen).
 */
export interface DrNdaProjekt { buchstabe: string; titel: string; text: string; geschuetzt?: string | null }
/** Zusätze des Raums — jeder darf fehlen. */
export interface DrNdaRaum {
  /** Wie die Themen vorgestellt wurden, hinter „… vorgestellt,“ in § 1 Abs. 1 — z. B. „zuletzt mit E-Mail vom 9. November 2026“. */
  vorgestellt?: string | null;
  /** Der Zweck genauer, hinter „… zu den Themen genutzt werden, also“ in § 1 Abs. 2. */
  zweck?: string | null;
  /** Vorab überlassene Unterlagen, z. B. „die E-Mail vom … mit der Anlage …“ — § 2 Abs. 1 („insbesondere …“). */
  vorab?: string | null;
  /** Ersetzt den „auch wegen …“-Satz bei Partei 2. */
  partei2Zusatz?: string | null;
  /** Ein oder zwei Sätze, die § 4 Abs. 2 ergänzen (z. B. was als Geschäft mit einer Zielgesellschaft gilt). */
  zusatz4?: string | null;
}
export interface DrNdaEingabe { gast: DrGastAngaben; projekte: DrNdaProjekt[]; raum: DrNdaRaum }

/**
 * Die Vereinbarung als Folge von Blöcken — Seite und PDF setzen dieselben Blöcke.
 * In `text` ist **…** fett (Seite: <b>, PDF: fette Schrift); sonst ist alles reiner Text.
 */
export type DrNdaBlock =
  | { art: "auge"; text: string }
  | { art: "titel"; text: string }
  | { art: "unter"; text: string }
  | { art: "zwischen"; text: string }
  | { art: "partei"; nr: string; name: string; text: string }
  | { art: "text"; text: string }
  | { art: "paragraf"; nr: string; titel: string }
  | { art: "abs"; z: string; text: string }
  | { art: "punkt"; z: string; text: string }
  | { art: "thema"; bu: string; titel: string; text: string }
  | { art: "anlage"; nr: string; titel: string; zeilen: string[] };

// ── Kleine Sprachhelfer ────────────────────────────────────────────────────
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** „2026-11-09“ → „9. November 2026“; ungültig → "". */
export function drDatumLang(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return "";
  const mo = Number(m[2]); const t = Number(m[3]);
  if (mo < 1 || mo > 12 || t < 1 || t > 31) return "";
  return `${t}. ${MONATE[mo - 1]} ${m[1]}`;
}
const ZAHLWORT = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
/** Buchstabe des Projekts an Stelle i (0 → A). */
export function drBuchstabe(i: number): string {
  return i >= 0 && i < 26 ? String.fromCharCode(65 + i) : `Z${i - 25}`;
}
/** ["A","B","C"] → „A, B und C“. */
export function drAufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile.join("");
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}
/** Name der Seite des Gastes, wie die Papierfassung sie bildet („Muster-Seite“, Durchkopplung bei „von Muster“). */
export function drSeiteName(g: Pick<DrGastAngaben, "nachname">): string {
  const n = zeile(g.nachname, 80).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${n || "Gast"}-Seite`;
}
export function drVollName(g: Pick<DrGastAngaben, "vorname" | "nachname">): string {
  return `${zeile(g.vorname, 80)} ${zeile(g.nachname, 80)}`.trim();
}
/** „Herr Max Muster“ / „Frau …“ / ohne Anrede der volle Name. */
export function drAnredeName(g: Pick<DrGastAngaben, "anrede" | "vorname" | "nachname">): string {
  const v = drVollName(g);
  return g.anrede === "herr" ? `Herr ${v}` : g.anrede === "frau" ? `Frau ${v}` : v;
}
/** „Herr Muster“ / „Frau Muster“ / ohne Anrede der volle Name. */
export function drAnredeKurz(g: Pick<DrGastAngaben, "anrede" | "vorname" | "nachname">): string {
  const n = zeile(g.nachname, 80);
  return g.anrede === "herr" ? `Herr ${n}` : g.anrede === "frau" ? `Frau ${n}` : drVollName(g);
}
/** Im Akkusativ: „Herrn Muster“ / „Frau Muster“ / ohne Anrede der volle Name (§ 1 und § 9 der Papierfassung). */
export function drAnredeAkk(g: Pick<DrGastAngaben, "anrede" | "vorname" | "nachname">): string {
  const n = zeile(g.nachname, 80);
  return g.anrede === "herr" ? `Herrn ${n}` : g.anrede === "frau" ? `Frau ${n}` : drVollName(g);
}
/** Anrede einer Mail im Sie: „Sehr geehrter Herr Muster,“. */
export function drBriefAnrede(g: Pick<DrGastAngaben, "anrede" | "vorname" | "nachname">): string {
  const n = zeile(g.nachname, 80);
  return g.anrede === "herr" ? `Sehr geehrter Herr ${n},` : g.anrede === "frau" ? `Sehr geehrte Frau ${n},` : `Guten Tag ${drVollName(g)},`;
}
/**
 * „die Zielgesellschaft“, „die Beta-Gesellschaft“ → „Ziel- und Beta-Gesellschaft“ (Ergänzungsstrich wie in der Papierfassung);
 * enden nicht alle auf „Gesellschaft“, die Namen ohne Artikel, aufgezählt.
 */
function welcheSind(namen: string[]): string {
  const ohne = namen.map((x) => x.replace(/^(die|der|das|den)\s+/i, "").trim()).filter(Boolean);
  if (ohne.length > 1 && ohne.every((x) => /gesellschaft$/i.test(x))) {
    const vorne = ohne.slice(0, -1).map((x) => (/-gesellschaft$/i.test(x) ? x.replace(/gesellschaft$/i, "") : x.replace(/gesellschaft$/i, "-")));
    return `${drAufzaehlung([...vorne, ohne[ohne.length - 1]])}`;
  }
  return drAufzaehlung(ohne);
}
const pronomenDativ = (a: DrAnrede) => (a === "herr" ? "ihm" : a === "frau" ? "ihr" : null);
const pronomenNom = (a: DrAnrede) => (a === "herr" ? "er" : a === "frau" ? "sie" : null);
const ohneSchluss = (s: string) => zeile(s, 2000).replace(/[\s.;,]+$/g, "");

// ── Die Vereinbarung ───────────────────────────────────────────────────────
/**
 * Die Blöcke der Vereinbarung für einen Gast und die Projekte seines Raums.
 * Gleiche Eingabe → gleiche Blöcke (die Prüfsumme bildet der Server über genau diese Blöcke).
 */
export function drNdaBloecke(e: DrNdaEingabe): DrNdaBlock[] {
  const g = e.gast;
  const projekte = e.projekte.filter((p) => zeile(p.titel, 200));
  const buchstaben = projekte.map((p) => p.buchstabe);
  const seite = drSeiteName(g);
  const dat = pronomenDativ(g.anrede);
  const nom = pronomenNom(g.anrede);
  const firma = zeile(g.firma, 160);
  const funktion = zeile(g.funktion, 80);
  const vorgestellt = ohneSchluss(zeile(e.raum.vorgestellt ?? "", 200)).replace(/^,\s*/, "");
  const zweck = ohneSchluss(zeile(e.raum.zweck ?? "", 400)).replace(/^also\s+/i, "");
  const vorab = ohneSchluss(zeile(e.raum.vorab ?? "", 300));
  const zusatz2 = ohneSchluss(zeile(e.raum.partei2Zusatz ?? "", 300)) || NDA_FIAON.partei2Zusatz;
  const zusatz4 = zeile(e.raum.zusatz4 ?? "", 600);
  const n = projekte.length;
  const anzahl = n === 1 ? "folgendes Thema" : n <= 12 ? `${ZAHLWORT[n]} Themen` : `${n} Themen`;
  // Themen mit Projektkontakten (§ 4 Abs. 1). Ohne sie gelten die Sätze für alle Themen.
  const mitKontakten = projekte.filter((p) => zeile(p.geschuetzt ?? "", 200));
  const geschuetzt = mitKontakten.map((p) => zeile(p.geschuetzt ?? "", 200));
  const kb = mitKontakten.map((p) => p.buchstabe);
  const oder = (t: string[]) => (t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} oder ${t[t.length - 1]}`);
  const zuOder = kb.length ? `zu ${oder(kb)}` : "zu den Themen";
  const zuUnd = kb.length ? `zu ${drAufzaehlung(kb)}` : "zu den Themen";
  const einKontakt = kb.length === 0 ? "die Projektkontakte eines Themas gelten jeweils als ein Kontakt"
    : kb.length === 1 ? `die Projektkontakte zu ${kb[0]} gelten als ein Kontakt`
      : `die Projektkontakte zu ${kb[0]}${kb.slice(1, -1).map((b) => `, die zu ${b}`).join("")} und die zu ${kb[kb.length - 1]} gelten jeweils als ein Kontakt`;
  const benanntVon = dat ? `von ${dat}` : "von Partei 3";
  const weitergabe = drWeitergabeListe(g.weitergabe);

  const b: DrNdaBlock[] = [];
  b.push({ art: "auge", text: `Gegenseitige Vereinbarung (NDA) · ${n === 1 ? "Thema" : "Themen"} ${drAufzaehlung(buchstaben)}` });
  b.push({ art: "titel", text: NDA_TITEL });
  b.push({ art: "unter", text: `Stand ${drDatumLang(NDA_FASSUNG)}` });
  b.push({ art: "zwischen", text: "zwischen" });
  b.push({ art: "partei", nr: "Partei 1", name: NDA_FIAON.partei1Name, text: NDA_FIAON.partei1Text });
  b.push({ art: "partei", nr: "Partei 2", name: NDA_FIAON.partei2Name, text: `persönlich, ${zusatz2}; ${NDA_FIAON.partei2Sitz}` });
  const anschrift = [zeile(g.strasse, 120), `${zeile(g.plz, 12)} ${zeile(g.ort, 80)}`.trim(), zeile(g.land, 60)].filter(Boolean).join(", ");
  b.push({
    art: "partei", nr: "Partei 3", name: drAnredeName(g),
    text: `${anschrift}, handelnd im eigenen Namen sowie ${funktion ? `als ${funktion} ` : ""}für ${firma ? `${firma} und für ` : ""}die Gesellschaften, die ${nom ?? "Partei 3"} der FIAON-Seite per E-Mail benennt`,
  });
  b.push({ art: "text", text: `Partei 1 und 2 bilden die **FIAON-Seite**, Partei 3 mit ${firma ? `${firma} und ` : ""}den ${benanntVon} benannten Gesellschaften die **${seite}**. Was diese Vereinbarung einer Seite erlaubt oder auferlegt, gilt für jede ihrer Parteien, auch für später beitretende.` });

  b.push({ art: "paragraf", nr: "§ 1", titel: "Gegenstand und Zweck" });
  b.push({ art: "abs", z: "(1)", text: `Herr Schwarzott hat ${drAnredeAkk(g)} ${anzahl} vorgestellt${vorgestellt ? `, ${vorgestellt}` : ""} (die „Themen“):` });
  projekte.forEach((p, i) => {
    b.push({ art: "thema", bu: p.buchstabe, titel: zeile(p.titel, 200), text: `${ohneSchluss(p.text)}${i === n - 1 ? "." : ";"}` });
  });
  b.push({ art: "abs", z: "(2)", text: `Die Seiten tauschen dazu vertrauliche Informationen aus. Diese dürfen ausschliesslich zur Prüfung einer möglichen Zusammenarbeit der Seiten zu den Themen genutzt werden${zweck ? `, also ${zweck}` : ""} (der „Zweck“).` });

  b.push({ art: "paragraf", nr: "§ 2", titel: "Vertrauliche Informationen" });
  b.push({ art: "abs", z: "(1)", text: `Vertrauliche Informationen sind alle Informationen, die eine Seite (die „offenlegende Seite“) der anderen (der „empfangenden Seite“) im Zusammenhang mit den Themen zugänglich macht, gleich in welcher Form und ob gekennzeichnet oder nicht – insbesondere Unterlagen, Zahlen, Pläne, Verträge sowie Namen und Kontaktdaten von Gesellschaften, Gesellschaftern, Verkäufern, Gründern, Kunden, Investoren und Finanzierungspartnern. Als von der FIAON-Seite zugänglich gemacht gelten auch Informationen, die die ${seite} ${zuOder} von Projektkontakten (§ 4 Abs. 1) erhält, etwa aus deren Datenräumen oder bei Besichtigungen; Informationen von Investoren, die die ${seite} vorstellt, gelten als von ihr zugänglich gemacht. Vertraulich sind auch Analysen, Bewertungen und Notizen, soweit sie auf vertraulichen Informationen beruhen, und alle vor Unterzeichnung ausgetauschten Informationen, ${vorab ? `insbesondere ${vorab}, ` : ""}sowie Tatsache und Inhalt der Gespräche und dieser Vereinbarung.` });
  b.push({ art: "abs", z: "(2)", text: "Nicht vertraulich sind Informationen, bei denen die empfangende Seite nachweist, dass sie a) ohne Verstoss gegen diese Vereinbarung öffentlich bekannt sind oder werden, b) ihr schon vorher rechtmässig bekannt waren, ohne dass sie sie – auch vor Unterzeichnung – von der offenlegenden Seite erhalten hat, c) von ihr unabhängig und ohne Nutzung vertraulicher Informationen entwickelt wurden oder d) ihr ein Dritter, der kein geschützter Kontakt der offenlegenden Seite ist, rechtmässig und ohne Vertraulichkeitspflicht überlassen hat." });
  b.push({ art: "abs", z: "(3)", text: "Muss die empfangende Seite vertrauliche Informationen aufgrund Gesetzes oder einer behördlichen oder gerichtlichen Anordnung offenlegen, darf sie dies im erforderlichen Umfang tun; soweit zulässig, informiert sie die offenlegende Seite vorher per E-Mail." });

  b.push({ art: "paragraf", nr: "§ 3", titel: "Geheimhaltung und Weitergabe" });
  b.push({ art: "abs", z: "(1)", text: "Die empfangende Seite hält vertrauliche Informationen geheim, nutzt sie ausschliesslich für den Zweck und schützt sie mindestens so sorgfältig wie eigene vertrauliche Informationen, in jedem Fall aber mit angemessener Sorgfalt." });
  b.push({ art: "abs", z: "(2)", text: "Ohne Zustimmung darf sie vertrauliche Informationen nur an eigene Organe und Mitarbeitende (auch freie) weitergeben, die diese für den Zweck benötigen und zur Vertraulichkeit verpflichtet sind, sowie an eigene Rechtsanwälte, Steuerberater und Wirtschaftsprüfer, die gesetzlich oder vertraglich zur Verschwiegenheit verpflichtet sind. Keine Weitergabe ist die Nutzung üblicher IT-, Cloud- und KI-Dienste, die die Informationen sicher und vertraulich nur technisch verarbeiten und nicht zum Training allgemein verfügbarer Modelle verwenden." });
  b.push({ art: "abs", z: "(3)", text: "An alle anderen Empfänger, insbesondere Investoren, Co-Investoren, Finanzierungspartner und deren Berater, darf sie vertrauliche Informationen nur mit vorheriger Zustimmung der offenlegenden Seite (§ 9) weitergeben, einzeln erteilt für jeden namentlich benannten Empfänger. Der Empfänger muss vorher, soweit er nicht schon Partei ist, dieser Vereinbarung auf der Seite der weitergebenden Partei beigetreten sein (schriftliche Erklärung, Scan genügt); allen so freigegebenen Beitritten stimmen die Parteien schon jetzt zu. Investoren müssen professionell oder erfahren sein und einzeln angesprochen werden, nicht öffentlich. Investoren und Finanzierungspartner sind auch dann andere Empfänger, wenn sie mit einer Partei verbunden sind oder von ihr vertreten werden. Als Empfänger einer Seite gelten auch Personen, die sie zu Gesprächen mitbringt oder denen auf ihre Veranlassung Unterlagen zugänglich gemacht werden." });
  b.push({ art: "abs", z: "(4)", text: "Jede Partei haftet für die Personen, an die sie vertrauliche Informationen weitergibt, wie für eigenes Verhalten und nennt der offenlegenden Seite auf Verlangen alle Empfänger." });
  b.push({ art: "abs", z: "(5)", text: "Für Informationen von Projektkontakten gelten zusätzlich die Bedingungen, die die FIAON-Seite vor der Übergabe per E-Mail mitteilt." });

  b.push({ art: "paragraf", nr: "§ 4", titel: "Nichtumgehung" });
  b.push({
    art: "abs", z: "(1)",
    text: `Geschützte Kontakte einer Seite sind die Personen und Unternehmen, die sie der anderen Seite im Zusammenhang mit den Themen per E-Mail oder in übergebenen Unterlagen namentlich als Investor, Erwerber, Co-Investor, Kunde, Partner oder Finanzierungspartner bekannt macht oder gemacht hat. Geschützte Kontakte der FIAON-Seite sind ausserdem stets ${geschuetzt.length ? drAufzaehlung(geschuetzt) : "die in § 1 beschriebenen Gesellschaften"}, jeweils mit ihren Organen, Gesellschaftern, Investoren, Gründern, Verkäufern, Beratern und Vermittlern und den von diesen beherrschten Gesellschaften (die „Projektkontakte“); welche Gesellschaften ${geschuetzt.length ? `${welcheSind(geschuetzt)} sind` : "gemeint sind"}, bestimmt die Benennung durch die FIAON-Seite per E-Mail oder in übergebenen Unterlagen. Geschützte Kontakte bleiben geschützt, auch wenn sie öffentlich bekannt sind.`,
  });
  b.push({ art: "abs", z: "(2)", text: `Bis zum Ablauf von 24 Monaten nach der letzten Offenlegung vertraulicher Informationen zum jeweiligen Thema wird keine Seite ohne vorherige Zustimmung der anderen (§ 9) deren geschützte Kontakte direkt oder indirekt (etwa über Dritte) geschäftlich ansprechen, mit ihnen Geschäfte anbahnen oder abschliessen oder Dritte dabei beraten, finanzieren oder sonst unterstützen. Gegenüber Projektkontakten, die nur Organe, Berater, Vermittler oder Investoren sind, gilt dies nur für Geschäfte ${zuOder}.${zusatz4 ? ` ${zusatz4}` : ""} Wird eine Seite von einem geschützten Kontakt der anderen zu den Themen angesprochen, verweist sie ihn an diese und informiert sie unverzüglich per E-Mail; auf Verlangen bestätigt sie per E-Mail, ob sie oder ihre Empfänger mit geschützten Kontakten der anderen Seite in Verbindung stehen. Verletzt ein Empfänger, der nicht beigetreten ist, diesen § 4, gilt dies als Verletzung durch die Partei, die ihm die Informationen weitergegeben hat; sein Verschulden wird ihr zugerechnet.` });
  b.push({ art: "abs", z: "(3)", text: "Keine Umgehung sind" });
  b.push({ art: "punkt", z: "a)", text: "Gespräche, an denen die vorstellende Seite teilnimmt oder die mit ihrem Wissen für den Zweck geführt werden, und Geschäfte, an denen sie zu schriftlich vereinbarten Bedingungen beteiligt ist; die blosse Vorstellung genügt nicht;" });
  b.push({ art: "punkt", z: "b)", text: "Beziehungen, die nachweislich schon vor der Bekanntgabe bestanden und die die verpflichtete Seite innerhalb von 30 Tagen danach per E-Mail angezeigt hat;" });
  b.push({ art: "punkt", z: "c)", text: "allgemeine, nicht gezielte Werbung und Geschäfte, die allein daraus entstehen;" });
  b.push({ art: "punkt", z: "d)", text: "die Nutzung allgemein angebotener Standardleistungen zu üblichen Bedingungen (etwa Kontoführung, Zahlungsverkehr, Software)." });
  b.push({ art: "abs", z: "", text: `Die Ausnahmen b) und c) gelten nicht für Geschäfte ${zuOder} mit Projektkontakten. Die Voraussetzungen einer Ausnahme hat nachzuweisen, wer sich darauf beruft.` });

  b.push({ art: "paragraf", nr: "§ 5", titel: "Konventionalstrafe, Schadenersatz und Unterlassung" });
  b.push({ art: "abs", z: "(1)", text: `Verletzt eine Partei § 4 oder die Vertraulichkeit (§§ 2, 3 und 7) – selbst oder durch Personen, die in ihrem Auftrag oder mit ihrem Wissen handeln –, zahlt sie der anderen Seite je Fall eine Konventionalstrafe von **CHF 50’000** (fünfzigtausend Schweizer Franken), es sei denn, sie beweist, dass sie kein Verschulden trifft. Alle Handlungen gegenüber demselben geschützten Kontakt zum selben Vorhaben sind ein Fall; ${einKontakt}. Bei der Vertraulichkeit ist jede unbefugte Weitergabe oder Nutzung gegenüber demselben Empfänger zum selben Thema ein Fall. Die Strafe ist je Fall nur einmal geschuldet; mehrere verantwortliche Parteien einer Seite haften solidarisch, und jede Partei der anderen Seite kann sie fordern, wobei die Zahlung an eine gegenüber allen befreit (Art. 150 OR). Handeln beigetretene Empfänger, die eine Partei weder beherrscht noch vertritt, ohne ihren Auftrag und ohne ihr Wissen, haftet diese Partei für sie nur auf Schadenersatz (§ 3 Abs. 4); die Strafe schulden dann die Empfänger selbst.` });
  b.push({ art: "abs", z: "(2)", text: "Abweichend von Art. 160 Abs. 1 OR befreit die Zahlung nicht von der weiteren Einhaltung dieser Vereinbarung. Weitergehender Schadenersatz bleibt vorbehalten (Art. 161 Abs. 2 OR)." });
  b.push({ art: "abs", z: "(3)", text: "Bei jeder drohenden oder erfolgten Verletzung dieser Vereinbarung kann die andere Seite Unterlassung verlangen, auch durch vorsorgliche Massnahmen." });
  const p3Haftung = g.anrede === "herr"
    ? `die ${drAnredeKurz(g)} beherrscht oder für die er im Zusammenhang mit den Themen handelt, gelten als seine eigenen; er haftet`
    : g.anrede === "frau"
      ? `die ${drAnredeKurz(g)} beherrscht oder für die sie im Zusammenhang mit den Themen handelt, gelten als ihre eigenen; sie haftet`
      : "die Partei 3 beherrscht oder für die Partei 3 im Zusammenhang mit den Themen handelt, gelten als ihre eigenen; Partei 3 haftet";
  b.push({ art: "abs", z: "(4)", text: `Jeder Unterzeichner sichert zu, die Partei, für die er unterschreibt oder die er benennt, verpflichten zu dürfen. Handlungen und Verschulden der Unternehmen, ${p3Haftung} dafür wie für eigenes Verhalten, einschliesslich der Konventionalstrafe, und nennt sie auf Verlangen.` });

  b.push({ art: "paragraf", nr: "§ 6", titel: "Keine Bindung, kein Angebot, keine Gewähr" });
  b.push({ art: "abs", z: "(1)", text: "Diese Vereinbarung verpflichtet keine Seite, Informationen offenzulegen oder ein Geschäft abzuschliessen. Sie begründet keine Exklusivität (§ 4 bleibt unberührt), keine (einfache) Gesellschaft, keinen Auftrag und keine Vertretungsmacht. Jede Seite kann die Gespräche jederzeit ohne Angabe von Gründen beenden." });
  b.push({ art: "abs", z: "(2)", text: "Weder diese Vereinbarung noch die ausgetauschten Informationen sind ein Angebot oder eine Aufforderung zum Erwerb oder zur Zeichnung von Anteilen, zur Gewährung von Darlehen oder zu sonstigen Anlagen." });
  b.push({ art: "abs", z: "(3)", text: "Informationen werden ohne Gewähr für Richtigkeit und Vollständigkeit und ohne Pflicht zur Aktualisierung überlassen, Angaben Dritter (etwa von Verkäufern und Gründern) zudem ohne Prüfungspflicht; Pläne, Prognosen und Bewertungen sind keine Zusagen. Zusicherungen und Pflichten zu einem Geschäft entstehen allein durch einen später von den Beteiligten unterschriebenen Vertrag. Die Haftung für Vorsatz und grobe Fahrlässigkeit bleibt unberührt." });
  b.push({ art: "abs", z: "(4)", text: "Jede Seite trägt ihre eigenen Kosten. Ansprüche auf Vergütung, Provision oder Kostenersatz – auch für die Vorstellung oder den Nachweis von Kontakten oder Geschäften oder wegen des Abbruchs der Gespräche – bestehen nur aufgrund eines gesonderten, vorher von beiden Seiten unterschriebenen Vertrags." });

  b.push({ art: "paragraf", nr: "§ 7", titel: "Rückgabe, Löschung und Datenschutz" });
  b.push({ art: "abs", z: "(1)", text: "Auf Verlangen der offenlegenden Seite gibt die empfangende Seite vertrauliche Informationen samt Kopien und daraus erstellter Unterlagen binnen 10 Tagen zurück oder löscht sie, auch bei ihren Empfängern, und bestätigt dies per E-Mail. Ausgenommen sind Kopien, die gesetzlich aufbewahrt werden müssen, und automatische Sicherungskopien; sie bleiben vertraulich." });
  b.push({ art: "abs", z: "(2)", text: "Personenbezogene Daten verarbeitet jede Partei in eigener Verantwortung nur für den Zweck und nach dem jeweils anwendbaren Datenschutzrecht, insbesondere dem Schweizer Datenschutzgesetz (DSG) und der DSGVO." });

  b.push({ art: "paragraf", nr: "§ 8", titel: "Inkrafttreten und Dauer" });
  // Elektronisch statt drei Unterschriften: Partei 3 unterzeichnet im Datenraum, die FIAON-Seite nimmt mit der Freischaltung an.
  // Das Feld der Papierfassung („ausser an: …“) ist fest formuliert — die Namen stehen in Anlage 1, nie als Freitext im Satz.
  b.push({ art: "abs", z: "(1)", text: "Diese Vereinbarung tritt in Kraft, sobald Partei 3 sie im Online-Datenraum der FIAON-Seite elektronisch unterzeichnet und die FIAON-Seite sie durch die Freischaltung des Datenraums für Partei 3 angenommen hat; die Freischaltung gilt als Unterzeichnung durch die Parteien 1 und 2. Sie gilt auch für zuvor ausgetauschte Informationen (§ 2 Abs. 1). Jede Seite bestätigt, vor Unterzeichnung erhaltene Informationen nur an Personen nach § 3 Abs. 2 weitergegeben zu haben, ausser an die in Anlage 1 genannten Empfänger; diese gelten als ihre Empfänger nach § 3." });
  b.push({ art: "abs", z: "(2)", text: `Die Vertraulichkeit gilt drei Jahre ab der letzten Offenlegung vertraulicher Informationen zum jeweiligen Thema; für Geschäftsgeheimnisse, Analysen und Berichte ${zuUnd} gilt sie, solange diese nicht öffentlich bekannt sind; die Nichtumgehung gilt nach § 4 Abs. 2. Das Ende der Gespräche oder die Rückgabe von Informationen berührt diese Fristen nicht. Regelt ein später unterzeichneter Vertrag zu einem Thema die Vertraulichkeit, geht er insoweit vor.` });

  b.push({ art: "paragraf", nr: "§ 9", titel: "Mitteilungen und Zustimmungen" });
  b.push({ art: "abs", z: "", text: `Zustimmungen und Mitteilungen nach dieser Vereinbarung erfolgen per E-Mail: für die FIAON-Seite an und durch Herrn Schwarzott (${NDA_FIAON.kontaktEmail}), für die ${seite} an und durch ${drAnredeAkk(g)} (${emailSauber(g.email) || zeile(g.email, 160)}); andere Absender und Kanäle (etwa Messenger wie WhatsApp) genügen nicht. Sie wirken für alle Parteien der jeweiligen Seite. Zustimmungen nennen den Empfänger oder Kontakt namentlich, können an Bedingungen geknüpft und, soweit sie eine Weitergabe betreffen, für die Zukunft widerrufen werden.` });

  b.push({ art: "paragraf", nr: "§ 10", titel: "Schlussbestimmungen" });
  b.push({ art: "abs", z: "(1)", text: "Diese Vereinbarung untersteht schweizerischem Recht unter Ausschluss des Kollisionsrechts. Ausschliesslicher Gerichtsstand ist Zürich; vorsorgliche Massnahmen können auch bei jedem anderen zuständigen Gericht beantragt werden." });
  b.push({ art: "abs", z: "(2)", text: "Änderungen und Ergänzungen bedürfen der Schriftform; das gilt auch für den Verzicht auf diese Form. Für Zustimmungen und Mitteilungen genügt eine E-Mail (§ 9)." });
  b.push({ art: "abs", z: "(3)", text: "Ist eine Bestimmung unwirksam, bleibt der Rest wirksam; an ihre Stelle tritt eine wirksame Regelung, die dem Gewollten am nächsten kommt." });
  b.push({ art: "abs", z: "(4)", text: "Rechte und Pflichten aus dieser Vereinbarung dürfen nur mit vorheriger Zustimmung der anderen Seite (§ 9) abgetreten oder übertragen werden. Eine von einer Partei beherrschte Gesellschaft, über die ein Thema umgesetzt wird, kann der Vereinbarung auf deren Seite durch schriftliche Erklärung (Scan genügt) beitreten; die Parteien stimmen dem schon jetzt zu." });
  b.push({ art: "abs", z: "(5)", text: "Diese Vereinbarung und ihre Änderungen können in Gegenstücken unterzeichnet werden. Eingescannte, über eine gängige Signaturplattform oder im Online-Datenraum der FIAON-Seite elektronisch unterzeichnete Exemplare gelten als Original und wahren die Schriftform." });

  // Anlage 1 — nur eine Liste von Namen (geprüft in drGastAngabenPruefen), nie ein Satz des Gastes.
  b.push({
    art: "anlage", nr: "Anlage 1", titel: "Empfänger vor Unterzeichnung (§ 8 Abs. 1)",
    zeilen: [weitergabe.length ? `Die ${seite} nennt: ${weitergabe.join("; ")}.` : `Die ${seite} nennt keine.`],
  });
  return b;
}

/** „Muster AG; Erika Beispiel“ (oder mit Zeilenumbrüchen) → ["Muster AG", "Erika Beispiel"] — höchstens zehn Namen. */
export function drWeitergabeListe(roh: unknown): string[] {
  return String(roh ?? "").split(/[;\n\r]+/).map((x) => zeile(x, 120).replace(/[\s.,]+$/g, "")).filter(Boolean).slice(0, 10);
}

/** Der Teil eines Projekts, der in der Vereinbarung steht — der Server bildet daraus die Prüfsumme, die eine Vereinbarung deckt. */
export function drProjektKanon(p: DrNdaProjekt): string {
  return JSON.stringify([zeile(p.buchstabe, 4), zeile(p.titel, 200), ohneSchluss(p.text), zeile(p.geschuetzt ?? "", 400)]);
}

/** Wie Partei 3 unterschreibt (Zeile unter der Unterschrift): „persönlich, für <Firma> und die von ihm benannten Gesellschaften“. */
export function drPartei3Rolle(g: Pick<DrGastAngaben, "anrede" | "firma">): string {
  const von = pronomenDativ(g.anrede) ? `von ${pronomenDativ(g.anrede)}` : "von Partei 3";
  const firma = zeile(g.firma, 160);
  return firma ? `persönlich, für ${firma} und die ${von} benannten Gesellschaften` : `persönlich und für die ${von} benannten Gesellschaften`;
}

/** Der Text, über den der Server die Prüfsumme bildet — Fassung und Blöcke, in fester Reihenfolge. */
export function drNdaKanonisch(bloecke: DrNdaBlock[]): string {
  return JSON.stringify({ fassung: NDA_FASSUNG, bloecke });
}

/**
 * Für die Anzeige (Seite und PDF): „§ 4“, „Abs. 1“, „Art. 150“, „Nr. 17318250“, „CHF 50’000“ brechen nie um — geschütztes
 * Leerzeichen wie in der Papierfassung. Die Prüfsumme bildet der Server über den Text OHNE diese Zeichen.
 */
export function drFesteLeerzeichen(text: string): string {
  return String(text).replace(/(§§?|Abs\.|Art\.|Nr\.|CHF) (?=[\d(])/g, "$1\u00a0");
}
/** **fett** in Stücke zerlegen (für Seite und PDF). */
export function drFettStuecke(text: string): { text: string; fett: boolean }[] {
  return String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((t) => (t.startsWith("**") && t.endsWith("**") ? { text: t.slice(2, -2), fett: true } : { text: t, fett: false }));
}

// ── Die Angaben des Gastes prüfen ──────────────────────────────────────────
// Als RegExp-Objekt wie in fiaon-anrede.ts: TypeScript prüft Literale mit „u“ gegen das Sprachziel.
// Nachbesserung (Gutachten 09.11.2026): Was der Gast einträgt, steht wörtlich in der Vereinbarung, die ohne
// menschlichen Blick gilt. Darum lässt jedes Feld nur zu, was in einen Namen, eine Firma oder eine Anschrift
// gehört — kein „§“, kein „*“ (Fettschrift), kein „;“ oder „:“ (Satzbau), keine Anführungszeichen. Nur lateinische
// Schrift: Die PDF-Schrift kann anderes nicht darstellen (Buchstaben wie „Ł“ oder „č“ stehen dort ohne Akzent).
const BUCHSTABE = new RegExp("\\p{L}", "u");
const NICHT_BUCHSTABE = new RegExp("[^\\p{L}]", "gu");
const LATEIN = new RegExp("^[\\p{Script=Latin}\\p{Script=Common}\\p{Script=Inherited}]*$", "u");
/** Vor- und Nachname: Buchstaben, Leerzeichen, Bindestrich, Apostroph, Punkt (Dr.). */
const NAME = new RegExp("^\\p{L}(?:[\\p{L}\\p{M} .'’-]*[\\p{L}\\p{M}.])?$", "u");
/** Ort und Land: dazu Ziffern, Klammern und Schrägstrich („Frankfurt (Oder)“). */
const ORT = new RegExp("^\\p{L}[\\p{L}\\p{M}0-9 .'’()/-]*$", "u");
/** Straße: Buchstaben, Ziffern und was eine Anschrift braucht („Rue de l’Église 12/3“, „Am Hof 1–3“). */
const STRASSE = new RegExp("^[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 .,'’()/&+–-]*$", "u");
/** Firma, Funktion, Namen in Anlage 1: kein Zeichen, das Vertragstext bauen oder formatieren könnte. */
const FREMD = /[§*_~`<>{}[\]|\\^=;:#@$%"„“”]|https?:|www\./i;
const ZEICHEN_SATZ = "Bitte ohne Sonderzeichen wie § * ; : oder Anführungszeichen.";
/** Wörter, die in keinen Namen gehören, wohl aber in Vertragstext (Firma, Funktion, Anlage 1). */
const VERTRAGSWORT = /\b(partei|parteien|vereinbarung|konventionalstrafe|strafe|haftung|haftet|haften|schuldet|schulden|abweichend|ausgeschlossen|entf[aä]llt|verzicht\w*|gilt|gelten|paragraph|paragraf|absatz|vorbehalt\w*)\b/i;
/** Ein Name in Anlage 1: höchstens sieben Wörter mit Buchstaben — „Muster & Partner – Beratung & Bewertung“ hat vier. */
const zuVieleWoerter = (s: string) => s.split(/\s+/).filter((w) => BUCHSTABE.test(w)).length > 7;
/** Prüft und säubert die Angaben. Fehler je Feld im Klartext (Sie). */
export function drGastAngabenPruefen(roh: unknown): { ok: true; wert: DrGastAngaben } | { ok: false; fehler: Partial<Record<keyof DrGastAngaben, string>> } {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const anrede: DrAnrede = r.anrede === "herr" || r.anrede === "frau" ? r.anrede : "";
  const telRoh = zeile(r.telefon, 40);
  const liste = drWeitergabeListe(r.weitergabe);
  const w: DrGastAngaben = {
    anrede,
    vorname: zeile(r.vorname, 80), nachname: zeile(r.nachname, 80),
    firma: zeile(r.firma, 160), funktion: zeile(r.funktion, 80),
    strasse: zeile(r.strasse, 120), plz: zeile(r.plz, 12).toUpperCase(), ort: zeile(r.ort, 80), land: zeile(r.land, 60),
    email: emailSauber(r.email), telefon: telefonSauber(telRoh), weitergabe: liste.join("; "),
  };
  const f: Partial<Record<keyof DrGastAngaben, string>> = {};
  if (!w.vorname || !BUCHSTABE.test(w.vorname)) f.vorname = "Bitte Ihren Vornamen angeben.";
  else if (!NAME.test(w.vorname)) f.vorname = "Bitte nur Buchstaben, Leerzeichen, Bindestrich oder Punkt.";
  if (!w.nachname || w.nachname.replace(NICHT_BUCHSTABE, "").length < 2) f.nachname = "Bitte Ihren Nachnamen angeben.";
  else if (!NAME.test(w.nachname)) f.nachname = "Bitte nur Buchstaben, Leerzeichen, Bindestrich oder Punkt.";
  if (w.strasse.length < 3 || !BUCHSTABE.test(w.strasse)) f.strasse = "Bitte Straße und Hausnummer angeben.";
  else if (!STRASSE.test(w.strasse)) f.strasse = ZEICHEN_SATZ;
  if (!/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(w.plz)) f.plz = "Bitte eine gültige Postleitzahl angeben.";
  if (w.ort.length < 2 || !BUCHSTABE.test(w.ort)) f.ort = "Bitte den Ort angeben.";
  else if (!ORT.test(w.ort)) f.ort = ZEICHEN_SATZ;
  if (w.land.length < 2 || !BUCHSTABE.test(w.land)) f.land = "Bitte das Land angeben.";
  else if (!ORT.test(w.land)) f.land = ZEICHEN_SATZ;
  if (!w.email) f.email = "Bitte eine gültige E-Mail-Adresse angeben.";
  if (telRoh && (w.telefon.match(/\d/g)?.length ?? 0) < 7) f.telefon = "Bitte eine gültige Telefonnummer angeben — oder das Feld leer lassen.";
  if (r.firma != null && zeile(r.firma, 400).length > 160) f.firma = "Bitte höchstens 160 Zeichen.";
  else if (w.firma && (FREMD.test(w.firma) || !BUCHSTABE.test(w.firma))) f.firma = ZEICHEN_SATZ;
  else if (w.firma && VERTRAGSWORT.test(w.firma)) f.firma = "Bitte nur den Namen der Firma mit Rechtsform.";
  if (w.funktion && (FREMD.test(w.funktion) || !BUCHSTABE.test(w.funktion))) f.funktion = ZEICHEN_SATZ;
  else if (w.funktion && (VERTRAGSWORT.test(w.funktion) || zuVieleWoerter(w.funktion))) f.funktion = "Bitte nur Ihre Funktion, zum Beispiel „Geschäftsführer“.";
  const rohListe = String(r.weitergabe ?? "").split(/[;\n\r]+/).map((x) => zeile(x, 400)).filter(Boolean);
  if (rohListe.length > 10) f.weitergabe = "Bitte höchstens zehn Namen.";
  else if (rohListe.some((x) => x.length > 120)) f.weitergabe = "Bitte nur Namen oder Firmen, je höchstens 120 Zeichen, mit ; getrennt.";
  else if (liste.some((x) => FREMD.test(x) || !BUCHSTABE.test(x) || VERTRAGSWORT.test(x) || zuVieleWoerter(x))) f.weitergabe = "Bitte nur Namen oder Firmen, mit ; getrennt — ohne Sonderzeichen wie § * : oder Anführungszeichen und ohne Sätze.";
  for (const k of ["vorname", "nachname", "firma", "funktion", "strasse", "ort", "land", "weitergabe"] as const) {
    if (!f[k] && !LATEIN.test(w[k])) f[k] = "Bitte in lateinischer Schrift angeben.";
  }
  return Object.keys(f).length ? { ok: false, fehler: f } : { ok: true, wert: w };
}

/** Die Angaben, wie sie der Verwaltung zum Vorbefüllen reichen: nur Vorname, Nachname und E-Mail sind Pflicht. */
export function drVorbefuellungPruefen(roh: unknown): { ok: true; wert: DrGastAngaben } | { ok: false; error: string } {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const w: DrGastAngaben = {
    anrede: r.anrede === "herr" || r.anrede === "frau" ? r.anrede : "",
    vorname: zeile(r.vorname, 80), nachname: zeile(r.nachname, 80), firma: zeile(r.firma, 160), funktion: zeile(r.funktion, 80),
    strasse: zeile(r.strasse, 120), plz: zeile(r.plz, 12).toUpperCase(), ort: zeile(r.ort, 80), land: zeile(r.land, 60),
    email: emailSauber(r.email), telefon: telefonSauber(r.telefon), weitergabe: "",
  };
  if (!w.vorname || !w.nachname) return { ok: false, error: "Vor- und Nachname des Gastes fehlen." };
  if (!w.email) return { ok: false, error: "Die E-Mail-Adresse des Gastes fehlt oder ist ungültig." };
  return { ok: true, wert: w };
}

/**
 * Passt der getippte Name zur Partei 3? Er muss dem vollen Namen GLEICHEN — ohne Akzente, Groß/Klein und Satzzeichen
 * verglichen, sonst Wort für Wort. „Max Muster unter Vorbehalt …“ ist nicht „Max Muster“ (Gutachten 09.11.2026).
 */
export function drNamePasst(getippt: string, g: Pick<DrGastAngaben, "vorname" | "nachname">): boolean {
  const k = (t: string) => String(t ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss")
    .replace(/ł/g, "l").replace(/đ/g, "d").replace(/ø/g, "o").replace(/[^a-z0-9]+/g, " ").trim();
  const soll = k(`${g.vorname} ${g.nachname}`);
  if (!k(g.vorname) || !k(g.nachname)) return false;
  return k(getippt) === soll;
}

// ── Einladungscodes ────────────────────────────────────────────────────────
// Form „DR-XXXX-XXXX-XXXX“: zwölf Zeichen aus einem Alphabet ohne verwechselbare
// Zeichen (kein I, L, O, 0, 1) — rund 59 Bit Zufall; sie werden am Telefon
// durchgegeben und abgetippt. Verglichen wird auf Buchstaben und Ziffern
// reduziert (Gedankenstrich statt Bindestrich, Leerzeichen, fehlendes „DR“).
export const DR_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const DR_CODE_ZEICHEN = 12;
/** Die verglichene Form („DRXXXXXXXXXXXX“) — oder null, wenn es kein Code sein kann. */
export function drCodeNormal(roh: unknown): string | null {
  let s = String(roh ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === DR_CODE_ZEICHEN) s = `DR${s}`;
  if (s.length !== DR_CODE_ZEICHEN + 2 || !s.startsWith("DR")) return null;
  for (const c of s.slice(2)) if (!DR_CODE_ALPHABET.includes(c)) return null;
  return s;
}
/** „DRXXXXXXXXXXXX“ → „DR-XXXX-XXXX-XXXX“. */
export function drCodeAnzeige(normal: string): string {
  const k = normal.startsWith("DR") ? normal.slice(2) : normal;
  return `DR-${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8, 12)}`;
}
/** Grobe Form einer Eingabe fürs Protokoll — nie der Code selbst (ein Tippfehler verriete sonst fast den ganzen echten Code). */
export function drCodeForm(roh: unknown): string {
  const s = String(roh ?? "");
  const kern = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${kern.length} Zeichen${kern.startsWith("DR") ? ", mit DR" : ""}${/[^A-Za-z0-9-]/.test(s) ? ", mit Sonderzeichen" : ""}`;
}

// ── Dateien im Raum ────────────────────────────────────────────────────────
export const DR_DATEI_MAX_BYTES = 25 * 1024 * 1024;
export type DrDateiArt = "pdf" | "bild" | "office";
export const DR_DATEI_HINWEIS = "PDF, JPG, PNG oder Word, Excel, PowerPoint (ohne Makros) — bis 25 MB";
