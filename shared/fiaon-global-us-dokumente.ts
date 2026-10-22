// ═══════════════════════════════════════════════════════════════════════════
// DIE DOKUMENTE ZUR UNTERSCHRIFT — INHALT, VOLLSTÄNDIGKEIT, SATZ-BLÖCKE (22.10.2026)
//
// Justin: „Mach alles komplett fertig, sodass jeder Vertrag, jedes Formular —
//          alles für den Kunden bereit ist.“ Und (22.10. abends): „Formulare
//          müssen KOMPLETT ausgefüllt sein — der Kunde unterschreibt nur.“
//
// Diese Datei ist REIN (kein Netz, keine Datenbank). Sie beschreibt je Dokument
//   · welche Angaben es braucht und welche davon fehlen (der Stationen-Editor
//     zeigt die Liste, „zur Unterschrift bereitstellen“ bleibt bis dahin zu),
//   · den Inhalt als Satz-Blöcke, die server/lib/fiaon-global-pdf-satz.ts setzt:
//       fiaon_befugnisse     Ergänzung für Bestandskunden — FIAON-CI (A4, intern)
//       us_organizer         Statement of Organizer — US-Format (Letter, Times)
//       us_operating_agreement Operating Agreement (ein oder mehrere Mitglieder)
//   · wer unterschreibt (FIAON als Organizer, die Mitglieder).
// Die IRS-Formulare (SS-4, 8821) stehen in shared/fiaon-global-irs.ts.
//
// US-FORMAT (Regel des Hauses für Dokumente gegenüber US-Stellen): US Letter,
// Ränder ≥ 1 Zoll, Seite 1 oben rechts 2,5 Zoll frei (Eingangsstempel), Times
// 12 pt, schwarz-weiß, keine Logos, leerer Kopf, Fuß „Page X of Y“ mit Doc-ID und
// Name des Unterzeichners, Titel fett in GROSSBUCHSTABEN mittig, wichtige Klauseln
// in GROSSBUCHSTABEN, Unterschriftszeile mit Name, Funktion und Datum.
//
// Der Operating-Agreement-Text für EIN Mitglied ist die Vorlage aus „Recht &
// Verträge“ (FACH_VORLAGEN, shared/fiaon-global-fach-recht.ts) — eine Quelle für
// das Portal und das Mandat. Für mehrere Mitglieder steht der Text daneben
// (OA_MEHRERE in derselben Datei).
// Nie der Name des Registered-Agent-Anbieters (Wortregel E-422).
// ═══════════════════════════════════════════════════════════════════════════
import { FACH_VORLAGEN, OA_MEHRERE_TEXT, OA_MANAGER_ERSATZ } from "./fiaon-global-fach-recht";
import { US_BUNDESSTAATEN } from "./fiaon-global-bereich";
import { ergaenzungInhalt, BEFUGNISSE_FASSUNG } from "./fiaon-global-befugnisse";
import { FIAON_FIRMA } from "./fiaon-firma";
import { stationAnbieterImText } from "./fiaon-global-stationen";

// ── DIE DOKUMENTARTEN ────────────────────────────────────────────────────────
export type FormularArt = "fiaon_befugnisse" | "us_organizer" | "us_operating_agreement" | "irs_ss4" | "irs_8821";
export const FORMULAR_ARTEN: FormularArt[] = ["fiaon_befugnisse", "us_organizer", "us_operating_agreement", "irs_ss4", "irs_8821"];
/** Fassung der Vorlagen — steht im Nachweis jeder Unterschrift und im Fuß. */
export const US_DOKUMENTE_FASSUNG = "USD-2026-10-23";

// ── DIE ANGABEN ──────────────────────────────────────────────────────────────
export interface Mitglied {
  name: string;
  /** Wohnanschrift (Person) bzw. Sitz (Firma), eine Zeile. */
  anschrift: string;
  /** Anteil in Prozent (ganze Zahl oder mit Komma). */
  anteil: number;
  /** Für den Code beim digitalen Unterschreiben — Pflicht ab dem zweiten Mitglied. */
  email?: string | null;
  telefon?: string | null;
}
/** Was das Team je Mandat ergänzt oder abweichend festlegt (fiaon_global_auftraege.formular_angaben). */
export interface FormularAngaben {
  mitglieder?: Mitglied[] | null;
  /** „member“ (Vorgabe) oder „manager“ (geführt von einem Manager). */
  verwaltung?: "member" | "manager" | null;
  manager?: string | null;
  /** Wer die Articles als Organizer unterschrieben hat. Vorgabe: FIAON LTD durch den Director. */
  organizer?: { name?: string | null; beschreibung?: string | null; vertreter?: string | null; titel?: string | null; istFiaon?: boolean | null } | null;
  /** County der Geschäftsanschrift, z. B. „Laramie County“ (SS-4 Zeile 6). */
  county?: string | null;
  /** Operating Agreement: Gegenstand, Einlage, Vertrauensperson (englisch). */
  zweck?: string | null;
  einlage?: string | null;
  nachfolger?: string | null;
  ss4?: {
    /** Art des Geschäfts für Zeile 10 („Started new business — type“), z. B. „Online retail“. */
    geschaeftsart?: string | null;
    /** Zeile 16: Schlüssel aus SS4_TAETIGKEITEN. */
    taetigkeit?: string | null;
    /** Zeile 16 „Other (specify)“. */
    taetigkeitText?: string | null;
    /** Zeile 17: Waren oder Leistungen. */
    leistungen?: string | null;
    designeeName?: string | null; designeeAdresse?: string | null; designeeTelefon?: string | null; designeeFax?: string | null;
  } | null;
  irs8821?: {
    /** false = das Mandat braucht kein 8821. Vorgabe: an. */
    aktiv?: boolean | null;
    name?: string | null; adresse?: string | null; caf?: string | null; ptin?: string | null; telefon?: string | null; fax?: string | null;
    steuerart?: string | null; formular?: string | null; jahre?: string | null; sachverhalt?: string | null;
  } | null;
}

/** Alles, was die Dokumente aus der Akte lesen — der Server füllt es (formularKontext), der Prüfstand mit Musterdaten. */
export interface FormularKontext {
  ref: string;
  sprache: "de" | "en";
  /** Name des Kunden (natürliche Person, Ansprechpartner). */
  kundeName: string;
  /** Wohnanschrift des Kunden in einer Zeile (englische Ländernamen). */
  kundeAnschrift: string;
  kundeEmail: string;
  kundeTelefon: string;
  /** Firma des Auftraggebers, wenn eine Firma beauftragt hat (sonst leer). */
  firmaName: string;
  /** Vertrag: „Auftraggeberin“ (Firmen-/Kapitalangebot) statt „Auftraggeber“. */
  weiblich: boolean;
  vertragFassung: string;
  vertragAm: string | null;
  llc: {
    name: string; bundesstaat: string; gegruendetAm: string | null; aktenzeichen: string; ein: string;
    usAdresse: string; agentAdresse: string; usTelefon: string; kontaktperson: string;
  };
  /** Die ITIN des Mitglieds im Klartext — nur am Server, nur für das SS-4. */
  itin?: string | null;
  angaben: FormularAngaben;
}

const leer = (v: unknown) => !String(v ?? "").trim();
const knapp = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Die Mitglieder: vom Team gepflegt — sonst der Kunde selbst mit 100 %. */
export function mitgliederVon(k: FormularKontext): Mitglied[] {
  const m = (k.angaben.mitglieder ?? []).filter((x) => x && knapp(x.name));
  if (m.length) return m.map((x) => ({ ...x, name: knapp(x.name), anschrift: knapp(x.anschrift), anteil: Number(x.anteil) || 0, email: knapp(x.email) || null }));
  return [{ name: knapp(k.kundeName), anschrift: knapp(k.kundeAnschrift), anteil: 100, email: knapp(k.kundeEmail) || null, telefon: knapp(k.kundeTelefon) || null }];
}
export function bundesstaatName(code: string): string { return US_BUNDESSTAATEN[String(code || "").toUpperCase()] ?? ""; }
export function organizerVon(k: FormularKontext): { name: string; beschreibung: string; vertreter: string; titel: string; istFiaon: boolean } {
  const o = k.angaben.organizer ?? {};
  const istFiaon = o.istFiaon !== false;
  return {
    name: knapp(o.name) || FIAON_FIRMA.name,
    beschreibung: knapp(o.beschreibung) || (istFiaon ? `a private limited company registered in England and Wales (Company No. ${FIAON_FIRMA.companyNo})` : ""),
    vertreter: knapp(o.vertreter) || (istFiaon ? FIAON_FIRMA.director : ""),
    titel: knapp(o.titel) || (istFiaon ? "Director" : ""),
    istFiaon,
  };
}
/** „412 W 17th Street, Suite 210\nCheyenne, WY 82001“ → [Straße, „Ort, Staat ZIP“] — oder null, wenn nicht zweizeilig. */
export function adresseZweizeilig(roh: unknown): [string, string] | null {
  const zeilen = String(roh ?? "").split(/\r?\n/).map(knapp).filter(Boolean);
  if (zeilen.length >= 2) return [zeilen.slice(0, -1).join(", "), zeilen[zeilen.length - 1]];
  const teile = knapp(roh).split(/,\s*/);
  if (teile.length >= 3) return [teile.slice(0, -2).join(", "), teile.slice(-2).join(", ")];
  return null;
}
export const PROZENT = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
const ZAHLWORT_EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const prozentWort = (n: number) => (n === 100 ? "one hundred percent (100%)" : n === 50 ? "fifty percent (50%)" : PROZENT(n));
const tagUs = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)
  ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "");

// ── VOLLSTÄNDIGKEIT ──────────────────────────────────────────────────────────
export interface Fehlend { feld: string; text: string }
/** Was für die Gesellschaft immer da sein muss (Gründung). */
function gruendungFehlt(k: FormularKontext): Fehlend[] {
  const f: Fehlend[] = [];
  if (leer(k.llc.name)) f.push({ feld: "llc.name", text: "Name der Gesellschaft (Station „Gesellschaft eingetragen“)" });
  if (!bundesstaatName(k.llc.bundesstaat)) f.push({ feld: "llc.bundesstaat", text: "Bundesstaat der Gesellschaft" });
  if (!k.llc.gegruendetAm) f.push({ feld: "llc.gegruendetAm", text: "Gründungstag (Tag der Einreichung der Articles)" });
  if (leer(k.llc.aktenzeichen)) f.push({ feld: "llc.aktenzeichen", text: "State File Number / Dokumentnummer" });
  // Wortregel E-422: der Name des Registered-Agent-Anbieters steht nie in einem Kundendokument.
  if (stationAnbieterImText(`${k.llc.agentAdresse} ${k.llc.usAdresse}`)) f.push({ feld: "llc.agentAdresse", text: "Anschrift enthält den Namen des Registered-Agent-Anbieters — bitte nur die Adresse" });
  return f;
}
function mitgliederFehlen(k: FormularKontext, mitEmail: boolean): Fehlend[] {
  const f: Fehlend[] = [];
  const m = mitgliederVon(k);
  if (!m.length || leer(m[0].name)) f.push({ feld: "mitglieder", text: "Mitglied (Member) der Gesellschaft — Name" });
  m.forEach((x, i) => {
    if (leer(x.anschrift)) f.push({ feld: `mitglieder.${i}.anschrift`, text: `Wohnanschrift von Mitglied ${i + 1} (${x.name || "ohne Namen"})` });
    if (!(x.anteil > 0)) f.push({ feld: `mitglieder.${i}.anteil`, text: `Anteil von Mitglied ${i + 1} in Prozent` });
    if (mitEmail && i > 0 && leer(x.email)) f.push({ feld: `mitglieder.${i}.email`, text: `E-Mail von Mitglied ${i + 1} (für den Code beim Unterschreiben)` });
  });
  const summe = m.reduce((s, x) => s + (Number(x.anteil) || 0), 0);
  if (m.length && Math.abs(summe - 100) > 0.001) f.push({ feld: "mitglieder.anteil", text: `Anteile ergeben ${PROZENT(summe)} statt 100 %` });
  if ((k.angaben.verwaltung ?? "member") === "manager" && leer(k.angaben.manager)) f.push({ feld: "manager", text: "Name des Managers (manager-managed)" });
  return f;
}
/** Welche Angaben fehlen, damit dieses Dokument VOLLSTÄNDIG ausgefüllt ist? Leere Liste = bereit. Texte fürs Team (deutsch). */
export function formularFehlend(art: FormularArt, k: FormularKontext): Fehlend[] {
  switch (art) {
    case "fiaon_befugnisse": {
      const f: Fehlend[] = [];
      if (leer(k.kundeName)) f.push({ feld: "kunde.name", text: "Name des Kunden (Ansprechpartner im Auftrag)" });
      if (leer(k.vertragFassung)) f.push({ feld: "vertrag", text: "Angenommener Vertrag (Fassung)" });
      return f;
    }
    case "us_organizer": {
      const f = [...gruendungFehlt(k), ...mitgliederFehlen(k, true)];
      if (String(k.llc.bundesstaat).toUpperCase() === "WY" && leer(k.llc.kontaktperson)) f.push({ feld: "llc.kontaktperson", text: "Kontaktperson der Gesellschaft (Wyoming, Station „Registered Agent“)" });
      const o = organizerVon(k);
      if (leer(o.name) || leer(o.vertreter) || leer(o.titel)) f.push({ feld: "organizer", text: "Organizer: Name, Vertreter und Funktion" });
      return f;
    }
    case "us_operating_agreement": {
      const f = [...gruendungFehlt(k), ...mitgliederFehlen(k, true)];
      if (leer(k.llc.usAdresse) && leer(k.llc.agentAdresse)) f.push({ feld: "llc.usAdresse", text: "Geschäftsanschrift der Gesellschaft (Station „US-Adresse“)" });
      return f;
    }
    default:
      return [];
  }
}

// ── DIE UNTERZEICHNER ────────────────────────────────────────────────────────
export interface Unterzeichner { nr: number; art: "fiaon" | "kunde"; name: string; rolle: string; email?: string | null }
export function unterzeichnerVon(art: FormularArt, k: FormularKontext): Unterzeichner[] {
  const m = mitgliederVon(k);
  const titel = m.length > 1 ? "Member" : "Sole Member";
  switch (art) {
    case "fiaon_befugnisse":
      return [{ nr: 1, art: "kunde", name: knapp(k.kundeName), rolle: k.sprache === "en" ? "Client" : (k.weiblich ? "für die Auftraggeberin" : "Auftraggeber"), email: k.kundeEmail || null }];
    case "us_organizer": {
      const o = organizerVon(k);
      return [
        { nr: 1, art: "fiaon", name: o.vertreter, rolle: `${o.titel}, ${o.name}` },
        ...m.map((x, i) => ({ nr: i + 2, art: "kunde" as const, name: x.name, rolle: titel, email: i === 0 ? (x.email || k.kundeEmail || null) : x.email ?? null })),
      ];
    }
    case "us_operating_agreement":
      return m.map((x, i) => ({ nr: i + 1, art: "kunde" as const, name: x.name, rolle: titel, email: i === 0 ? (x.email || k.kundeEmail || null) : x.email ?? null }));
    default:
      return [];
  }
}

// ── SATZ-BLÖCKE ──────────────────────────────────────────────────────────────
/** Ein Absatz; `**…**` am Anfang setzt einen fetten Einstieg („Initial Member.“). */
export type SatzBlock =
  | { art: "titel"; text: string }
  | { art: "untertitel"; text: string }
  | { art: "kopf"; text: string }
  | { art: "absatz"; text: string; gross?: boolean; zentriert?: boolean; klein?: boolean }
  | { art: "liste"; zeilen: string[]; nummern?: boolean }
  | { art: "tabelle"; zeilen: [string, string][]; klein?: boolean }
  | { art: "abstand"; pt: number }
  | { art: "unterschrift"; nr: number; ueber?: string; zeilen: string[] };

export interface SatzDokument {
  stil: "us" | "ci";
  titel: string;
  /** Fuß links: „Doc-ID: … · Principal: …“ (US) bzw. „FIAON LTD · … · Auftrag …“ (CI). */
  fuss: string;
  /** Seitenzahl-Wort: „Page“/„of“ oder „Seite“/„von“. */
  sprache: "de" | "en";
  bloecke: SatzBlock[];
}

/** Platzhalter {{key}} → Wert. Fehlt ein Wert, bleibt der Platzhalter sichtbar (der Prüfstand fängt das). */
function fuellen(t: string, w: Record<string, string>): string {
  return t.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, key: string) => (w[key] != null && w[key] !== "" ? w[key] : m));
}
function textZuBloecken(text: readonly string[], w: Record<string, string>): SatzBlock[] {
  // „1.1 Formation.“ am Anfang einer Ziffer steht fett (wie in US-Verträgen üblich).
  return text.map((t) => (t.startsWith("## ") ? { art: "kopf" as const, text: fuellen(t.slice(3), w).toUpperCase() }
    : { art: "absatz" as const, text: fuellen(t, w).replace(/^(\d+\.\d+ [A-Z][^.]{1,60}\.)(?= )/, "**$1**") }));
}

/** Die Ergänzung für Bestandskunden (FIAON-CI). */
export function ergaenzungDokument(k: FormularKontext, docId: string): SatzDokument {
  const s = k.sprache;
  // Die Anschrift steht für US-Dokumente mit englischem Ländernamen — in der deutschen Ergänzung deutsch.
  const LAND_DE: Record<string, string> = { Germany: "Deutschland", Austria: "Österreich", Switzerland: "Schweiz", Liechtenstein: "Liechtenstein", "United Kingdom": "Vereinigtes Königreich" };
  const anschrift = s === "de" ? k.kundeAnschrift.replace(/(Germany|Austria|Switzerland|Liechtenstein|United Kingdom)$/, (m) => LAND_DE[m] ?? m) : k.kundeAnschrift;
  const e = ergaenzungInhalt({
    sprache: s, ref: k.ref, kunde: k.firmaName || k.kundeName, unterzeichner: k.kundeName, anschrift: k.firmaName ? "" : anschrift,
    vertragFassung: k.vertragFassung, vertragAm: k.vertragAm, weiblich: k.weiblich,
  });
  const bloecke: SatzBlock[] = [
    { art: "untertitel", text: e.unterzeile },
    { art: "abstand", pt: 6 },
    { art: "tabelle", zeilen: e.parteien.map((p, i) => [i === 0 ? (s === "en" ? "Between" : "Zwischen") : (s === "en" ? "and" : "und"), p] as [string, string]) },
    { art: "absatz", text: e.praeambel },
  ];
  for (const a of e.abschnitte) {
    bloecke.push({ art: "kopf", text: a.titel });
    a.absaetze.forEach((x, i) => {
      const nr = a.absaetze.length > 1 ? `(${i + 1}) ` : "";
      if (x.art === "p") bloecke.push({ art: "absatz", text: `${nr}${x.text}` });
      else { if (x.einleitung) bloecke.push({ art: "absatz", text: `${nr}${x.einleitung}` }); bloecke.push({ art: "liste", zeilen: x.zeilen, nummern: true }); }
    });
  }
  bloecke.push({ art: "abstand", pt: 10 });
  bloecke.push({ art: "unterschrift", nr: 1, ueber: k.firmaName ? (s === "en" ? `For ${k.firmaName}` : `Für ${k.firmaName}`) : undefined, zeilen: [k.kundeName, e.unterschriftRolle] });
  bloecke.push({ art: "absatz", klein: true, text: s === "en"
    ? `Issued by FIAON LTD, represented by its Director ${FIAON_FIRMA.director}. Wording ${BEFUGNISSE_FASSUNG}.`
    : `Ausgestellt von der FIAON LTD, vertreten durch den Director ${FIAON_FIRMA.director}. Fassung ${BEFUGNISSE_FASSUNG}.` });
  return {
    stil: "ci", sprache: s, titel: e.titel, bloecke,
    fuss: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${s === "en" ? "Engagement" : "Auftrag"} ${k.ref} · Doc-ID ${docId}`,
  };
}

/** Statement of Organizer in Lieu of Organizational Meeting (US-Format) — nach der Gründung. */
export function organizerDokument(k: FormularKontext, docId: string): SatzDokument {
  const m = mitgliederVon(k);
  const staat = bundesstaatName(k.llc.bundesstaat);
  const o = organizerVon(k);
  const llc = knapp(k.llc.name);
  const wy = String(k.llc.bundesstaat).toUpperCase() === "WY";
  const manager = (k.angaben.verwaltung ?? "member") === "manager" ? knapp(k.angaben.manager) : "";
  const einzig = m.length === 1;
  const kontakt = knapp(k.llc.kontaktperson) || m[0]?.name || "";
  const bloecke: SatzBlock[] = [
    { art: "titel", text: "STATEMENT OF ORGANIZER\nIN LIEU OF ORGANIZATIONAL MEETING" },
    { art: "untertitel", text: `of ${llc}, a ${staat} limited liability company` },
    { art: "absatz", text: `The undersigned, being the sole organizer of ${llc} (the “Company”), a limited liability company formed under the limited liability company act of the State of ${staat}, the Articles of Organization of which were filed with the ${staat} Secretary of State on ${tagUs(k.llc.gegruendetAm)} under filing number ${knapp(k.llc.aktenzeichen)}, hereby adopts the following statements and actions in lieu of an organizational meeting:` },
    { art: "liste", nummern: true, zeilen: [
      einzig
        ? `**Initial Member.** ${m[0].name}, residing at ${m[0].anschrift}, is hereby designated as the sole initial member of the Company, holding ${prozentWort(m[0].anteil)} of the membership interests in the Company.`
        : `**Initial Members.** The following persons are hereby designated as the initial members of the Company, holding the membership interests set out next to their names: ${m.map((x) => `${x.name}, residing at ${x.anschrift} (${PROZENT(x.anteil)})`).join("; ")}.`,
      manager
        ? `**Management.** The Company shall be managed by ${manager} as manager in accordance with its Operating Agreement.`
        : `**Management.** The Company shall be managed by its ${einzig ? "member" : "members"} in accordance with its Operating Agreement.`,
      wy
        ? `**Registered Agent and Communications Contact.** The registered agent named in the Articles of Organization is confirmed. ${kontakt} is designated as the Company’s communications contact pursuant to Wyo. Stat. § 17-28-107.`
        : "**Registered Agent.** The registered agent named in the Articles of Organization is confirmed.",
      `**Authority.** The ${einzig ? "member is" : "members are"} authorized to adopt an Operating Agreement, to apply for an Employer Identification Number, to open accounts in the name of the Company and to take all further actions necessary or appropriate to carry on the business of the Company.`,
      "**Resignation of Organizer.** Upon execution of this statement, the undersigned’s duties as organizer are complete, and the undersigned hereby resigns as organizer of the Company, effective immediately.",
    ] },
    { art: "absatz", gross: true, text: "THE UNDERSIGNED ORGANIZER HOLDS NO MEMBERSHIP INTEREST IN THE COMPANY AND ASSUMES NO LIABILITY FOR THE OBLIGATIONS OF THE COMPANY." },
    { art: "absatz", text: "IN WITNESS WHEREOF, the undersigned has executed this Statement of Organizer as of the date set out below its signature." },
    { art: "unterschrift", nr: 1, ueber: `ORGANIZER:\n${o.name}${o.beschreibung ? `, ${o.beschreibung}` : ""}`, zeilen: [`By: ${o.vertreter}`, `Title: ${o.titel}`] },
    ...m.map((x, i) => ({ art: "unterschrift" as const, nr: i + 2, ueber: i === 0 ? "ACKNOWLEDGED AND ACCEPTED:" : undefined, zeilen: [x.name, einzig ? "Sole Member" : "Member"] })),
  ];
  return { stil: "us", sprache: "en", titel: "Statement of Organizer", bloecke, fuss: `Doc-ID: ${docId} · Principal: ${m.map((x) => x.name).join(", ")}` };
}

/** Die Werte der Operating-Agreement-Vorlage aus der Akte. */
export function oaWerte(k: FormularKontext): Record<string, string> {
  const m = mitgliederVon(k);
  const staat = bundesstaatName(k.llc.bundesstaat);
  const adresse = (roh: string) => String(roh || "").split(/\r?\n/).map(knapp).filter(Boolean).join(", ");
  const agent = adresse(k.llc.agentAdresse);
  return {
    llcName: knapp(k.llc.name), bundesstaatName: staat, aktenzeichen: knapp(k.llc.aktenzeichen),
    gegruendetAm: tagUs(k.llc.gegruendetAm), heute: tagUs(k.llc.gegruendetAm),
    ein: knapp(k.llc.ein) || "to be issued by the Internal Revenue Service",
    inhaberName: m[0]?.name ?? "", inhaberAnschrift: m[0]?.anschrift ?? "",
    usAdresse: adresse(k.llc.usAdresse) || agent,
    // Nie der Name des Anbieters (E-422): der Agent, wie er in den Articles steht, mit seiner Anschrift.
    registeredAgent: agent ? `the registered agent named in the articles of organization, at ${agent}` : "the registered agent named in the articles of organization",
    zweck: knapp(k.angaben.zweck) || "any lawful business",
    einlage: knapp(k.angaben.einlage) || "the cash and other property reflected as capital contributions in the books and records of the Company",
    nachfolger: knapp(k.angaben.nachfolger) || "the Member's personal representative",
    managerName: knapp(k.angaben.manager),
  };
}

/** Operating Agreement — ein Mitglied (Vorlage aus „Recht & Verträge“) oder mehrere (OA_MEHRERE_TEXT). US-Format. */
export function oaDokument(k: FormularKontext, docId: string): SatzDokument {
  const m = mitgliederVon(k);
  const w = oaWerte(k);
  const manager = (k.angaben.verwaltung ?? "member") === "manager" && !!w.managerName;
  const einzig = m.length === 1;
  const vorlage = FACH_VORLAGEN.find((v) => v.id === "operating-agreement-smllc");
  if (!vorlage) throw new Error("Vorlage operating-agreement-smllc fehlt");
  let text: string[] = einzig ? [...vorlage.text] : [...OA_MEHRERE_TEXT];
  // Ohne EIN: die Ziffer sagt, dass sie beantragt wird (die Gesellschaft unterschreibt das Agreement vor der EIN).
  if (!knapp(k.llc.ein)) text = text.map((t) => t.startsWith("1.4 ") ? "1.4 Employer Identification Number. The Company will apply for a federal Employer Identification Number, which shall be recorded with the records of the Company once issued." : t);
  if (manager) text = text.map((t) => OA_MANAGER_ERSATZ[t.slice(0, 4)] ?? t).map((t) => t === "## 5. Management" ? "## 5. Management by a Manager" : t);
  // Die Unterschrift steht im Block darunter — der IN-WITNESS-Satz der Vorlage bleibt der letzte Absatz.
  const werte = {
    ...w,
    mitgliederListe: m.map((x) => `${x.name}, residing at ${x.anschrift}`).join("; "),
    anzahlWort: ZAHLWORT_EN[m.length] ?? String(m.length),
  };
  const bloecke: SatzBlock[] = [
    { art: "titel", text: einzig ? "OPERATING AGREEMENT\nOF A SINGLE-MEMBER LIMITED LIABILITY COMPANY" : "OPERATING AGREEMENT\nOF A MULTI-MEMBER LIMITED LIABILITY COMPANY" },
    { art: "untertitel", text: `${w.llcName}, a ${w.bundesstaatName} limited liability company` },
    // Schedule A für mehrere Mitglieder: die Marke [[SCHEDULE]] wird zur Tabelle (je Mitglied eine Zeile).
    ...textZuBloecken(text, werte).map((b): SatzBlock => (b.art === "absatz" && b.text === "[[SCHEDULE]]"
      ? { art: "tabelle", zeilen: m.map((x) => [x.name, `${x.anschrift} — Percentage Interest ${PROZENT(x.anteil)}`] as [string, string]) }
      : b)),
  ];
  bloecke.push({ art: "absatz", gross: true, text: "LIMITED LIABILITY: EXCEPT AS OTHERWISE REQUIRED BY LAW, NO MEMBER IS PERSONALLY LIABLE FOR THE DEBTS, OBLIGATIONS OR LIABILITIES OF THE COMPANY SOLELY BY REASON OF BEING A MEMBER." });
  m.forEach((x, i) => bloecke.push({ art: "unterschrift", nr: i + 1, ueber: i === 0 ? (einzig ? "SOLE MEMBER:" : "MEMBERS:") : undefined, zeilen: [x.name, einzig ? "Sole Member" : `Member (${PROZENT(x.anteil)})`] }));
  return { stil: "us", sprache: "en", titel: "Operating Agreement", bloecke, fuss: `Doc-ID: ${docId} · Principal: ${m.map((x) => x.name).join(", ")}` };
}

/** Das passende Dokument zu einer Art (nur die gesetzten — die IRS-Formulare füllt server/lib/fiaon-global-irs.ts). */
export function satzDokument(art: FormularArt, k: FormularKontext, docId: string): SatzDokument | null {
  if (art === "fiaon_befugnisse") return ergaenzungDokument(k, docId);
  if (art === "us_organizer") return organizerDokument(k, docId);
  if (art === "us_operating_agreement") return oaDokument(k, docId);
  return null;
}

/** Eine Doc-ID, die man vorlesen kann: „FG-8F92-B4A1“ aus einem Hex-Wert (der Server nimmt Zufall). */
export function docIdAus(hex: string): string {
  const h = String(hex || "").replace(/[^0-9a-f]/gi, "").toUpperCase().padEnd(8, "0");
  return `FG-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

/** Englische Ländernamen für Anschriften in US-Dokumenten. */
const LAND_EN: Record<string, string> = {
  DE: "Germany", AT: "Austria", CH: "Switzerland", LI: "Liechtenstein", LU: "Luxembourg", NL: "Netherlands", BE: "Belgium", FR: "France", IT: "Italy",
  ES: "Spain", PL: "Poland", GB: "United Kingdom", UK: "United Kingdom", US: "United States", AE: "United Arab Emirates", DK: "Denmark", SE: "Sweden", CZ: "Czech Republic",
};
export function landEn(roh: unknown): string {
  const s = knapp(roh);
  const k = s.toUpperCase();
  if (LAND_EN[k]) return LAND_EN[k];
  const de: Record<string, string> = { DEUTSCHLAND: "Germany", "ÖSTERREICH": "Austria", OESTERREICH: "Austria", SCHWEIZ: "Switzerland" };
  return de[k] ?? s;
}
