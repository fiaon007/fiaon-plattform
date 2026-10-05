// ═══════════════════════════════════════════════════════════════════════════
// DER NEUE PRIVATANTRAG /antrag-neu (05.10.2026, E-282)
//
// Justin (04./05.10.2026): „der GESAMTE Antragsweg muss neu gemacht werden …
// baue es wie unsere künftige eigene Bank" — Prototyp v2 freigegeben, danach
// „bau es jetzt unter /antrag-neu … achte auf JEDES Detail".
//
// EINE Quelle für alles, was Oberfläche UND Server gleich sehen müssen:
//   - die Paketdarstellung des neuen Wegs (Ziel-Limits, Leistungen),
//   - die Schritte und ihre Reihenfolge (Zähler „Schritt n von 13"),
//   - die Pflichtfragen (Einträge je Land, Staatsangehörigkeit, Beruf),
//   - die Regeln der persönlichen FIAON-PIN,
//   - die Prüfzeilen der Prüfung (nur, was wirklich geprüft wird).
// Preise stehen NICHT hier, sondern in shared/fiaon-pakete.ts.
// Der Vertragstext steht in shared/fiaon-antrag-neu-vertrag.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { KARTE_LINK_SATZ } from "./fiaon-karten-weg";

/** Fassung der Leistungsbeschreibung des neuen Wegs — steht mit jeder Vertragsannahme in der Datenbank. */
export const ANTRAG_NEU_LEISTUNG_FASSUNG = "AN-2026-10-05";
/** Fassung des Vertragstextes (Hash und PDF tragen sie). */
export const ANTRAG_NEU_VERTRAG_FASSUNG = "PV-2026-10-05";

export type AntragNeuPaketKey = "start" | "pro" | "ultra" | "highend";
export const ANTRAG_NEU_PAKET_KEYS: AntragNeuPaketKey[] = ["start", "pro", "ultra", "highend"];

export interface AntragNeuPaket {
  key: AntragNeuPaketKey;
  /** Name wie auf der Karte und im Vertrag. */
  name: string;
  /** Kleine Zeile über dem Namen. */
  beisatz: string;
  /** Kurzzeichen auf der Karte (oben rechts). */
  kartenLabel: string;
  /** Höchstes Ziel-Limit des Pakets in Euro. */
  bis: number;
  /** Die drei wählbaren Start-Limits in Euro (aufsteigend). */
  limits: [number, number, number];
  /** Ein Satz über das Paket (Leistungs-Sheet, Vertrag). */
  intro: string;
  /** Die Leistungen, nummeriert (Vertrag § 3, Leistungs-Sheet). */
  leistungen: string[];
  /** Die Leistung in einer Zeile für die Bestellübersicht. */
  zeile: string;
}

const KARTE_PUNKT = `Ihr Weg zur eigenen Visa-Kreditkarte: ${KARTE_LINK_SATZ}`;
const BONITAET_PUNKT = "An Ihrer Bonität arbeiten: Löschanträge und Widersprüche – vorbereitet, versendet, verfolgt.";
const LIMIT_GESPRAECH = "Alle drei Monate ein Limit-Gespräch: Gemeinsam steuern Sie das höchstmögliche Limit an.";

export const ANTRAG_NEU_PAKETE: AntragNeuPaket[] = [
  {
    key: "start", name: "FIAON Start", beisatz: "Der Einstieg", kartenLabel: "START", bis: 500, limits: [300, 400, 500],
    intro: "Ihr Einstieg bei FIAON: Wir werten Ihre Lage aus und zeigen Ihnen Schritt für Schritt Ihren Weg zur Karte.",
    leistungen: [
      KARTE_PUNKT,
      "Auswertung Ihrer Bonitätsauskunft – jeder Eintrag in klaren Worten erklärt (Ihre selbst angeforderte Datenkopie oder die Auskunft als Zusatz).",
      "Kontoauszug-Analyse mit Ihrem finanziellen Spielraum.",
      "Ihr Kundenbereich mit persönlichem Fahrplan.",
      "Unterstützung per E-Mail.",
    ],
    zeile: "Auswertung Ihrer Bonitätsauskunft, Kontoauszug-Analyse, Kundenbereich mit Fahrplan, Unterstützung per E-Mail.",
  },
  {
    key: "pro", name: "FIAON Pro", beisatz: "Am häufigsten gewählt", kartenLabel: "PRO", bis: 5000, limits: [1000, 2500, 5000],
    intro: "FIAON Pro begleitet Sie persönlich auf dem Weg zu Ihrer Karte: Ihre feste Ansprechpartnerin steuert mit Ihnen das höchstmögliche Limit an, spricht alle drei Monate mit Ihnen über den nächsten Schritt zu einem höheren Limit und arbeitet mit Ihnen an Ihrer Bonität.",
    leistungen: [
      KARTE_PUNKT,
      "Ihre feste Ansprechpartnerin – mit persönlichem Startgespräch.",
      LIMIT_GESPRAECH,
      BONITAET_PUNKT,
      "Ratenvereinbarungen mit Ihren Gläubigern – mit Antwort-Verfolgung.",
      "Auswertung Ihrer Bonitätsauskunft und Kontoauszug-Analyse.",
      "Ihr Kundenbereich mit persönlichem Fahrplan.",
    ],
    zeile: "Alles aus Start, dazu Löschanträge und Widersprüche, Ratenvereinbarungen mit Antwort-Verfolgung, Startgespräch und feste Ansprechpartnerin, Limit-Gespräch alle drei Monate.",
  },
  {
    key: "ultra", name: "FIAON Ultra", beisatz: "Mit telefonischer Betreuung", kartenLabel: "ULTRA", bis: 15000, limits: [7500, 10000, 15000],
    intro: "Mit FIAON Ultra begleiten wir Sie enger: telefonisch, bevorzugt und mit einem klaren Plan bis zum Kartenantrag. Alle drei Monate sprechen Sie mit Ihrer Ansprechpartnerin über den nächsten Schritt zu einem höheren Limit.",
    leistungen: [
      KARTE_PUNKT,
      "Begleitung auf dem Weg zu einer Kreditkarte: Readiness, Meilensteine, Antragsvorbereitung.",
      "Ihre feste Ansprechpartnerin – telefonisch erreichbar, mit persönlichem Startgespräch.",
      LIMIT_GESPRAECH,
      BONITAET_PUNKT,
      "Bevorzugte Bearbeitung Ihrer Schreiben.",
      "Ratenvereinbarungen mit Ihren Gläubigern – mit Antwort-Verfolgung.",
      "Auswertung Ihrer Bonitätsauskunft, Kontoauszug-Analyse und Kundenbereich mit Fahrplan.",
    ],
    zeile: "Alles aus Pro, dazu Begleitung auf dem Weg zu einer Kreditkarte, bevorzugte Bearbeitung, telefonische Betreuung.",
  },
  {
    key: "highend", name: "FIAON High‑End", beisatz: "Persönlicher Betreuer", kartenLabel: "HIGH END", bis: 25000, limits: [15000, 20000, 25000],
    intro: "FIAON High-End ist unsere persönlichste Betreuung: Ein Betreuer kümmert sich um Ihre gesamte Akte, ist auch außerhalb der Bürozeiten für Sie da und bereitet Sie auf größere Finanzierungen vor.",
    leistungen: [
      KARTE_PUNKT,
      "Ihr persönlicher Betreuer für Ihre gesamte Akte – auch außerhalb der Bürozeiten erreichbar.",
      "Begleitung auf dem Weg zu einer Kreditkarte: Readiness, Meilensteine, Antragsvorbereitung.",
      LIMIT_GESPRAECH,
      "Vorbereitung auf Finanzierungen.",
      BONITAET_PUNKT,
      "Bevorzugte Bearbeitung Ihrer Schreiben und telefonische Betreuung.",
      "Ratenvereinbarungen, Auswertung Ihrer Bonitätsauskunft, Kontoauszug-Analyse und Kundenbereich mit Fahrplan.",
    ],
    zeile: "Alles aus Ultra, dazu persönlicher Betreuer, Vorbereitung auf Finanzierungen, Erreichbarkeit auch außerhalb der Bürozeiten.",
  },
];

export function antragNeuPaket(key: unknown): AntragNeuPaket | null {
  const k = String(key ?? "").trim().toLowerCase().replace(/[-_\s]/g, "");
  return ANTRAG_NEU_PAKETE.find((p) => p.key === k) ?? null;
}

/** Ist das Ziel-Limit eines der drei wählbaren Limits des Pakets? */
export function limitErlaubt(key: unknown, limit: unknown): boolean {
  const p = antragNeuPaket(key);
  return !!p && p.limits.includes(Number(limit) as never);
}

// ── SCHRITTE ──────────────────────────────────────────────────────────────
export type AntragNeuSchritt =
  | "name" | "kontakt" | "geburt" | "adresse" | "beruf" | "einkommen" | "eintraege"
  | "pruefung" | "ergebnis" | "pin" | "paket" | "limit" | "vertrag" | "unterschrift" | "zahlung" | "danke";

export const ANTRAG_NEU_REIHE: AntragNeuSchritt[] = [
  "name", "kontakt", "geburt", "adresse", "beruf", "einkommen", "eintraege",
  "pruefung", "ergebnis", "pin", "paket", "limit", "vertrag", "unterschrift", "zahlung", "danke",
];

/** Gezählte Schritte („Schritt n von 13"). Prüfung, Ergebnis und Danke zählen nicht. */
export const ANTRAG_NEU_SCHRITT_NR: Partial<Record<AntragNeuSchritt, number>> = {
  name: 1, kontakt: 2, geburt: 3, adresse: 4, beruf: 5, einkommen: 6, eintraege: 7,
  pin: 8, paket: 9, limit: 10, vertrag: 11, unterschrift: 12, zahlung: 13,
};
export const ANTRAG_NEU_SCHRITTE = 13;

/** Abschnitte der Fortschrittsleiste. */
export const ANTRAG_NEU_ABSCHNITTE: [string, AntragNeuSchritt[]][] = [
  ["Sie", ["name", "kontakt", "geburt"]],
  ["Profil", ["adresse", "beruf", "einkommen", "eintraege"]],
  ["Ziel", ["pin", "paket", "limit"]],
  ["Vertrag", ["vertrag", "unterschrift", "zahlung"]],
];

// ── PFLICHTFRAGEN ─────────────────────────────────────────────────────────
export type Land = "DE" | "AT" | "CH";
export const LAENDER: Land[] = ["DE", "AT", "CH"];
export const LANDNAME: Record<Land, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
export const PLZ_STELLEN: Record<Land, number> = { DE: 5, AT: 4, CH: 4 };
export const VORWAHL: Record<Land, string> = { DE: "+49", AT: "+43", CH: "+41" };

/** Die Pflichtfrage nach negativen Einträgen — AT und CH lesen nie „SCHUFA". */
export const EINTRAEGE_FRAGE: Record<Land, { titel: string; lead: string }> = {
  DE: { titel: "Gibt es negative Einträge in Ihrer SCHUFA?", lead: "Oder bei einer anderen Auskunftei wie CRIF. Ihre ehrliche Antwort hilft uns, Ihren Weg richtig zu planen. Wir geben sie nicht an Banken oder Auskunfteien weiter." },
  AT: { titel: "Gibt es negative Einträge beim KSV1870?", lead: "Oder bei einer anderen Auskunftei wie CRIF. Ihre ehrliche Antwort hilft uns, Ihren Weg richtig zu planen. Wir geben sie nicht an Banken oder Auskunfteien weiter." },
  CH: { titel: "Gibt es Betreibungen oder negative Einträge bei CRIF?", lead: "Oder bei einer anderen Auskunftei. Ihre ehrliche Antwort hilft uns, Ihren Weg richtig zu planen. Wir geben sie nicht an Banken oder Auskunfteien weiter." },
};
export const OHNE_ABFRAGE: Record<Land, string> = { DE: "ohne SCHUFA-Abfrage", AT: "ohne KSV-Abfrage", CH: "ohne Abfrage bei einer Auskunftei" };

export type Eintraege = "ja" | "nein" | "weiss_nicht";
export const EINTRAG_TEXT: Record<Eintraege, string> = { ja: "Ja, es gibt Einträge", nein: "Nein, keine Einträge", weiss_nicht: "Weiß ich nicht genau" };

export type Beruf = "angestellt" | "beamt" | "selbst" | "rente" | "ausbildung" | "suchend" | "sonst";
export const BERUF_TEXT: Record<Beruf, string> = {
  angestellt: "Angestellt", beamt: "Beamtin oder Beamter", selbst: "Selbstständig", rente: "Rente oder Pension",
  ausbildung: "Ausbildung oder Studium", suchend: "Arbeitsuchend", sonst: "Sonstiges",
};
export const BERUF_MIT_ARBEITGEBER: Beruf[] = ["angestellt", "beamt"];
export type Seit = "<1" | "1-5" | ">5";
export const SEIT_TEXT: Record<Seit, string> = { "<1": "unter 1 Jahr", "1-5": "1–5 Jahre", ">5": "über 5 Jahre" };

export type Wohnen = "miete" | "eigentum" | "familie" | "sonstige";
export const WOHNEN_TEXT: Record<Wohnen, string> = { miete: "Zur Miete", eigentum: "Wohneigentum", familie: "Bei Eltern oder Familie", sonstige: "Sonstige" };

export type Zweck = "alltag" | "online" | "reisen" | "mobil" | "abos" | "reserve";
export const ZWECK_TEXT: Record<Zweck, string> = {
  alltag: "Alltag & Einkauf", online: "Online-Shopping", reisen: "Reisen & Hotels",
  mobil: "Tanken & Mobilität", abos: "Abos & Streaming", reserve: "Reserve für Notfälle",
};

export type Anrede = "Frau" | "Herr" | "keine";

export const STAAT_AUS_LAND: Record<Land, string> = { DE: "deutsch", AT: "österreichisch", CH: "schweizerisch" };
export const STAAT_LABEL: Record<Land, string> = { DE: "Deutsch", AT: "Österreichisch", CH: "Schweizerisch" };
export const STAATEN = [
  "deutsch", "österreichisch", "schweizerisch", "türkisch", "polnisch", "rumänisch", "italienisch", "kroatisch", "serbisch",
  "bosnisch-herzegowinisch", "griechisch", "bulgarisch", "ungarisch", "russisch", "ukrainisch", "syrisch", "afghanisch",
  "irakisch", "kosovarisch", "albanisch", "nordmazedonisch", "slowakisch", "tschechisch", "slowenisch", "spanisch",
  "portugiesisch", "französisch", "niederländisch", "andere",
];

/** Monatliches Nettoeinkommen: plausibel zwischen 100 € und 999.999 €. */
export function einkommenGueltig(euro: unknown): boolean {
  const n = Number(euro);
  return Number.isInteger(n) && n >= 100 && n <= 999999;
}

// ── DIE PERSÖNLICHE FIAON-PIN ─────────────────────────────────────────────
// Justin (05.10.2026): „Nach der Bonitätsprüfung soll der Kunde einen 4-stelligen
// persönlichen Code auswählen … mit der wir ihn verifizieren können … er kann
// den jederzeit auf der Plattform ändern."
// Die PIN dient FIAON: Erkennen am Telefon (Mitarbeiter prüft sie in der Akte). Sie ist
// KEINE Karten-PIN — die PIN einer Bankkarte vergibt allein die Bank. Gespeichert
// wird nur ein scrypt-Hash mit Geheimnis außerhalb der Datenbank
// (server/lib/fiaon-kunden-pin.ts); die Ziffern sieht niemand bei FIAON.

/** Häufige, leicht erratbare PINs. */
const PIN_SCHWACH = new Set([
  "1212", "1122", "1313", "2121", "1010", "2020", "6969", "1004", "2000", "2001", "1111", "0000",
  "1357", "2468", "1590", "7777", "4321", "1230", "0852", "2580", "1478", "9632", "1236", "6789",
]);

/**
 * Prüft eine neue PIN. Gibt null zurück, wenn sie zulässig ist, sonst einen
 * Satz, der dem Kunden sagt, was er ändern soll.
 * @param geburt Geburtsdatum als { tag, monat, jahr } — Geburtstag und -jahr sind tabu.
 */
export function pinPruefen(pin: string, geburt?: { tag?: number; monat?: number; jahr?: number } | null): string | null {
  if (!/^\d{4}$/.test(pin)) return "Bitte genau vier Ziffern eingeben.";
  const z = pin.split("").map(Number);
  if (z.every((d) => d === z[0])) return "Bitte nicht viermal dieselbe Ziffer.";
  const auf = z.every((d, i) => i === 0 || d === z[i - 1] + 1);
  const ab = z.every((d, i) => i === 0 || d === z[i - 1] - 1);
  if (auf || ab) return "Bitte keine Zahlenreihe wie 1234 oder 4321.";
  if (PIN_SCHWACH.has(pin)) return "Diese PIN ist zu leicht zu erraten. Bitte wählen Sie eine andere.";
  if (geburt) {
    const t = String(geburt.tag ?? "").padStart(2, "0"), m = String(geburt.monat ?? "").padStart(2, "0"), j = String(geburt.jahr ?? "");
    if (j.length === 4 && pin === j) return "Bitte nicht Ihr Geburtsjahr.";
    if (geburt.tag && geburt.monat && (pin === t + m || pin === m + t)) return "Bitte nicht Ihren Geburtstag.";
  }
  return null;
}

/** Fehlversuche, nach denen die PIN-Prüfung (Telefon, Bereich) für 15 Minuten gesperrt ist. */
export const PIN_MAX_FEHLVERSUCHE = 5;
export const PIN_SPERRE_MINUTEN = 15;

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANGABEN DES NEUEN WEGS — eine Form für Browser und Server
//
// Der Browser hält sie im Sitzungsspeicher, der Server in
// fiaon_applications.antrag_neu_daten. Die Spalten der Antragszeile (first_name,
// street, employment …) sind Abschriften daraus, damit Akte, Listen, Mails und
// Abläufe den neuen Antrag genauso lesen wie den alten.
// ═══════════════════════════════════════════════════════════════════════════
export interface AntragNeuDaten {
  anrede: Anrede | "";
  vorname: string;
  nachname: string;
  email: string;
  vorwahl: string;
  telefon: string;
  gt: string; gm: string; gj: string;
  land: Land;
  strasse: string; nr: string; plz: string; ort: string;
  /** „vorschlag" = aus dem Adressverzeichnis gewählt, „hand" = selbst getippt. */
  adresseQuelle: "vorschlag" | "hand" | "";
  /** Staatsangehörigkeit: die des Wohnlandes oder eine andere. */
  staatArt: "land" | "andere" | "";
  staat: string;
  staatText: string;
  beruf: Beruf | "";
  arbeitgeber: string;
  seit: Seit | "";
  branche: string;
  /** Netto im Monat, nur Ziffern. */
  einkommen: string;
  wohnen: Wohnen | "";
  eintraege: Eintraege | "";
  paket: AntragNeuPaketKey;
  limit: number;
  zweck: Zweck[];
}

export const ANTRAG_NEU_LEER: AntragNeuDaten = {
  anrede: "", vorname: "", nachname: "", email: "", vorwahl: "+49", telefon: "", gt: "", gm: "", gj: "",
  land: "DE", strasse: "", nr: "", plz: "", ort: "", adresseQuelle: "", staatArt: "", staat: "", staatText: "",
  beruf: "", arbeitgeber: "", seit: "", branche: "", einkommen: "", wohnen: "", eintraege: "",
  paket: "pro", limit: 5000, zweck: [],
};

const ZWECKE = Object.keys(ZWECK_TEXT) as Zweck[];
const text = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const wahl = <T extends string>(v: unknown, erlaubt: readonly T[]): T | "" => (erlaubt.includes(String(v ?? "") as T) ? (String(v) as T) : "");

/**
 * Nimmt nur bekannte Felder in erlaubter Form an (Server: alles aus dem Browser
 * ist fremd). Fehlende Felder bleiben, wie sie in `basis` stehen.
 */
export function antragNeuDatenSauber(roh: unknown, basis: AntragNeuDaten = ANTRAG_NEU_LEER): AntragNeuDaten {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const hat = (k: string) => Object.prototype.hasOwnProperty.call(r, k);
  const d: AntragNeuDaten = { ...basis, zweck: [...basis.zweck] };
  if (hat("anrede")) d.anrede = wahl(r.anrede, ["Frau", "Herr", "keine"] as const);
  if (hat("vorname")) d.vorname = text(r.vorname, 80);
  if (hat("nachname")) d.nachname = text(r.nachname, 80);
  if (hat("email")) d.email = text(r.email, 160).toLowerCase().replace(/\s/g, "");
  if (hat("vorwahl")) d.vorwahl = wahl(r.vorwahl, ["+49", "+43", "+41"] as const) || "+49";
  if (hat("telefon")) d.telefon = text(r.telefon, 24).replace(/[^\d ]/g, "");
  if (hat("gt")) d.gt = text(r.gt, 2).replace(/\D/g, "");
  if (hat("gm")) d.gm = text(r.gm, 2).replace(/\D/g, "");
  if (hat("gj")) d.gj = text(r.gj, 4).replace(/\D/g, "");
  if (hat("land")) d.land = wahl(r.land, LAENDER) || "DE";
  if (hat("strasse")) d.strasse = text(r.strasse, 120);
  if (hat("nr")) d.nr = text(r.nr, 16);
  if (hat("plz")) d.plz = text(r.plz, 5).replace(/\D/g, "");
  if (hat("ort")) d.ort = text(r.ort, 80);
  if (hat("adresseQuelle")) d.adresseQuelle = wahl(r.adresseQuelle, ["vorschlag", "hand"] as const);
  if (hat("staatArt")) d.staatArt = wahl(r.staatArt, ["land", "andere"] as const);
  if (hat("staat")) d.staat = wahl(r.staat, STAATEN);
  if (hat("staatText")) d.staatText = text(r.staatText, 60);
  if (hat("beruf")) d.beruf = wahl(r.beruf, Object.keys(BERUF_TEXT) as Beruf[]);
  if (hat("arbeitgeber")) d.arbeitgeber = text(r.arbeitgeber, 120);
  if (hat("seit")) d.seit = wahl(r.seit, Object.keys(SEIT_TEXT) as Seit[]);
  if (hat("branche")) d.branche = text(r.branche, 80);
  if (hat("einkommen")) d.einkommen = text(r.einkommen, 7).replace(/\D/g, "").replace(/^0+/, "").slice(0, 6);
  if (hat("wohnen")) d.wohnen = wahl(r.wohnen, Object.keys(WOHNEN_TEXT) as Wohnen[]);
  if (hat("eintraege")) d.eintraege = wahl(r.eintraege, Object.keys(EINTRAG_TEXT) as Eintraege[]);
  if (hat("paket")) d.paket = (wahl(r.paket, ANTRAG_NEU_PAKET_KEYS) || d.paket) as AntragNeuPaketKey;
  if (hat("limit")) { const n = Number(r.limit); if (Number.isInteger(n) && n > 0 && n <= 100000) d.limit = n; }
  if (hat("zweck") && Array.isArray(r.zweck)) d.zweck = Array.from(new Set(r.zweck.map((z) => wahl(z, ZWECKE)).filter(Boolean))) as Zweck[];
  // Das Limit gehört immer zum Paket: sonst das höchste des Pakets.
  const P = antragNeuPaket(d.paket);
  if (P && !P.limits.includes(d.limit as never)) d.limit = P.limits[P.limits.length - 1];
  return d;
}

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** „12. März 1968" oder "". */
export function geburtText(d: Pick<AntragNeuDaten, "gt" | "gm" | "gj">): string {
  return d.gt && d.gm && d.gj.length === 4 && Number(d.gm) >= 1 && Number(d.gm) <= 12 ? `${Number(d.gt)}. ${MONATE[Number(d.gm) - 1]} ${d.gj}` : "";
}

/** Gibt es den Tag, und ist der Mensch zwischen 18 und 110? */
export function geburtPruefen(d: Pick<AntragNeuDaten, "gt" | "gm" | "gj">, heute: Date = new Date()): "ok" | "fehlt" | "ungueltig" | "jung" | "alt" {
  const t = Number(d.gt), m = Number(d.gm), j = Number(d.gj);
  if (!d.gt || !d.gm || d.gj.length !== 4) return "fehlt";
  const dt = new Date(j, m - 1, t);
  if (m < 1 || m > 12 || dt.getFullYear() !== j || dt.getMonth() !== m - 1 || dt.getDate() !== t) return "ungueltig";
  const alter = heute.getFullYear() - j - (heute.getMonth() < m - 1 || (heute.getMonth() === m - 1 && heute.getDate() < t) ? 1 : 0);
  if (alter < 18) return "jung";
  if (alter > 110) return "alt";
  return "ok";
}

export function emailGueltig(e: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(e || "").trim());
}

/** Die Mobilnummer ohne Leerzeichen und ohne führende Null (Vorwahl steht getrennt). */
export function telefonZiffern(t: string): string {
  return String(t || "").replace(/\D/g, "").replace(/^0+/, "");
}

/** Eine Staatsangehörigkeit zum Lesen: „Deutsch", „Türkisch", freie Angabe. */
export function staatAnzeige(d: Pick<AntragNeuDaten, "staat" | "staatText">): string {
  const x = d.staat === "andere" ? d.staatText : d.staat;
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : "";
}

/**
 * Der erste Schritt, in dem noch etwas fehlt — oder null. Dieselbe Regel im
 * Browser (Zurückführen vor Vertrag und Annahme) und im Server (Wand vor der
 * Annahme).
 */
export function antragNeuLuecke(d: AntragNeuDaten, heute: Date = new Date()): AntragNeuSchritt | null {
  if (!d.anrede || !d.vorname.trim() || !d.nachname.trim()) return "name";
  if (!emailGueltig(d.email) || telefonZiffern(d.telefon).length < 8) return "kontakt";
  if (geburtPruefen(d, heute) !== "ok") return "geburt";
  if (!d.strasse.trim() || !d.nr.trim() || !new RegExp(`^\\d{${PLZ_STELLEN[d.land]}}$`).test(d.plz) || !d.ort.trim()
    || !d.staatArt || !d.staat || (d.staat === "andere" && !d.staatText.trim())) return "adresse";
  if (!d.beruf) return "beruf";
  if (BERUF_MIT_ARBEITGEBER.includes(d.beruf as Beruf) && (!d.arbeitgeber.trim() || !d.seit)) return "beruf";
  if (d.beruf === "selbst" && (!d.branche.trim() || !d.seit)) return "beruf";
  if (!einkommenGueltig(d.einkommen) || !d.wohnen) return "einkommen";
  if (!d.eintraege) return "eintraege";
  if (!limitErlaubt(d.paket, d.limit)) return "limit";
  if (!d.zweck.length) return "limit";
  return null;
}

// ── DIE ERKLÄRUNGEN BEI DER ANNAHME (Wortlaut, wie angezeigt und gespeichert) ──
/** Die AGB-Fassung, die der neue Weg annimmt — „26.09.2026". */
export function agbDatum(fassung: string): string {
  const m = String(fassung).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : fassung;
}
/** Dieselbe Fassung ausgeschrieben („26. September 2026") — für den Vertragstext. */
export function agbDatumLang(fassung: string): string {
  const m = String(fassung).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])}. ${MONATE[Number(m[2]) - 1]} ${m[1]}` : fassung;
}
export const ANTRAG_NEU_HAKEN_GEPRUEFT = "Ich habe Paket, Monatsrate, Laufzeit, Gesamtbetrag und Kündigungsregel in der Bestellübersicht geprüft.";
export const ANTRAG_NEU_SOFORT_TEXT = "Damit wir direkt nach Ihrer Zahlung starten können: Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit den Leistungen beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahle.";
/** Hinweis nach § 7 Abs. 3 UWG — bei der Erhebung der Adresse (Kontakt) und vor der Annahme. */
export const ANTRAG_NEU_WERBE_HINWEIS =
  "FIAON darf Sie per E-Mail über eigene ähnliche Leistungen informieren. Dem können Sie jederzeit widersprechen, etwa über den Abmeldelink in jeder E-Mail, ohne dass Ihnen dafür andere als die Übermittlungskosten nach den Basistarifen entstehen.";

export const ANTRAG_NEU_SOFORT_OHNE = "Freiwillig. Ohne diesen Haken beginnen wir mit den Leistungen nach Ablauf der Widerrufsfrist; Ihren Kundenbereich öffnen wir trotzdem gleich nach Zahlungseingang.";

/** Die Abschriften für die Spalten der Antragszeile (Akte, Listen, Mails lesen sie). */
export const ANTRAG_NEU_BERUF_SPALTE: Record<Beruf, string> = {
  angestellt: "Angestellt", beamt: "Beamter/in", selbst: "Selbstständig", rente: "Rentner/in",
  ausbildung: "Ausbildung/Studium", suchend: "Arbeitsuchend", sonst: "Sonstiges",
};
export const ANTRAG_NEU_WOHNEN_SPALTE: Record<Wohnen, string> = {
  miete: "Zur Miete", eigentum: "Eigentum", familie: "Bei Familie", sonstige: "Sonstiges",
};
