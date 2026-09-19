// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER AUFTRAG ALS TEXT UND ALS PDF (17.09.2026, E-188)
//
// Justin: „Direktkauf: Vertrag, Rechnung, Zahlung aufs Bankkonto = Start."
//
// ── EINE QUELLE, ZWEI AUSGABEN ────────────────────────────────────────────
// Der Kunde liest den Auftrag auf /business/start, BEVOR er unterschreibt
// (POST /api/fiaon/global/vertrag/vorschau), und bekommt ihn danach als PDF.
// Beides entsteht aus `vertragsRumpf()` — derselbe Text, dieselben Ziffern.
// Ein Vertrag, der auf dem Bildschirm anders lautet als im PDF, wäre im
// Streitfall zwei Verträge.
//
// ── WOHER DIE SÄTZE KOMMEN ────────────────────────────────────────────────
//   · Leistungen, Planungsgröße, Dauer, Pflichthinweise, Rollen, Geld-zurück:
//     shared/fiaon-global.ts — wörtlich. Ändert sich dort ein Satz, ändert er
//     sich hier; GLOBAL_VERTRAG_VERSION wird dann hochgezählt.
//   · Preis: shared/fiaon-pakete.ts (Katalog) — nie eine Zahl im Text.
//   · Pflichtangaben der FIAON LTD: FIAON_ENTITY (server/fiaon-invoice.ts) —
//     dieselben wie auf jeder Rechnung und im Impressum.
//   · Rechtswahl und Gerichtsstand: § 12 der AGB des Hauses
//     (client/src/pages/agb.tsx) — deutsches Recht ohne UN-Kaufrecht,
//     Gerichtsstand München für Kaufleute. Dort steht „LEGAL REVIEW REQUIRED";
//     das gilt für diesen Text genauso (E-188: Anwalt prüft den Vertragstext).
//
// ── DIE WORTWAHL ──────────────────────────────────────────────────────────
// Jeder deutsche Satz passiert shared/fiaon-wortverbote.ts (Prüfstand:
// scripts/pruef-global-vertrag.ts). Über Konto, Karte, Rahmen und Darlehen
// entscheidet das Institut; der Dollar-Wert ist die Planungsgröße des
// AUFTRAGGEBERS. Zugesagt wird nur die eigene Leistung.
//
// ── AUFTRAGGEBER: UNTERNEHMEN ODER PRIVATPERSON (19.09.2026, E-191) ────────
// Justin: „Man muss nicht als Firma unser Paket kaufen, auch Privatpersonen
// können über uns kaufen/gründen … auch ein Unternehmer privat buchen/kaufen."
// Für den Auftrag eines Unternehmens bleibt jeder Satz, wie er war. Beauftragt
// eine Privatperson, ändern sich genau diese Stellen:
//   · Ziffer 1 und Unterschrift: Name und Wohnanschrift statt Firma/Funktion,
//   · Ziffer 5: Beginn nach der Widerrufsfrist, wenn der Auftraggeber den
//     sofortigen Beginn nicht verlangt hat; der Preis ist ein Endpreis,
//   · Ziffer 9: die übliche Haftungsgrenze „vertragstypischer, vorhersehbarer
//     Schaden" (§ 309 Nr. 7, § 307 BGB) statt der Grenze Paketpreis,
//   · Ziffer 11: „Widerrufsrecht" statt „Unternehmer-Bestätigung", mit dem
//     ausdrücklichen Verlangen nach § 356 Abs. 4, § 357a Abs. 2 BGB,
//   · Ziffer 12: der Verbraucherschutz-Satz zur Rechtswahl (Art. 6 Rom I),
//   · danach die ANLAGE: gesetzliche Muster-Widerrufsbelehrung und
//     Muster-Widerrufsformular (Anlagen 1 und 2 zu Art. 246a EGBGB; englisch
//     nach Anhang I der Richtlinie 2011/83/EU) — im PDF auf eigener Seite, im
//     Hash mitgerechnet: Was der Kunde unterschreibt, trägt die Belehrung.
// ANWALT: Belehrung, Haftung und Rechtswahl für Verbraucher prüfen lassen.
// Die Telefonnummer, die die Belehrung seit 2022 verlangt (Art. 246a § 1 Abs. 1
// Nr. 3 EGBGB), ist die Support-Nummer aus shared/fiaon-firma.ts (Fassung 2026-09-19b).
//
// ── JAHRESBETREUUNG AB DEM ZWEITEN JAHR (19.09.2026, E-196) ───────────────
// Justin: im Auftrag ankreuzbar, 699 € im Jahr, alle Gebühren inklusive — auch
// die Staatsgebühr. Kreuzt der Auftraggeber sie an (`jahresbetreuung: true`),
// ändern sich genau diese Stellen, sonst bleibt jeder Satz, wie er war:
//   · Ziffer 2: ein Absatz, dass der Auftrag die Jahresbetreuung umfasst,
//   · Ziffer 3: die Partner-Honorare der Jahresbetreuung stecken in DEREN Preis,
//   · Ziffer 5: Der Paketpreis deckt „die Leistungen des Pakets"; statt des Satzes
//     „die laufenden Kosten trägt der Auftraggeber" (GLOBAL_LAUFEND_VERTRAG) steht
//     die Jahresbetreuung wörtlich aus shared/fiaon-global.ts (vertrag +
//     vertragBedingungen) — beide Sätze nebeneinander widersprächen sich. Für die
//     Privatperson ist auch dieser Preis ein Endpreis.
// Die zwölf Ziffern und ihre Nummern bleiben. Der Preis steht nur in der Quelle.
//
// Diese Datei fasst keine Datenbank an — der Prüfstand lädt sie ohne Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml, wrapFiaonDocument, htmlZuPdfMitFusszeile } from "./fiaon-html-pdf";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import { FIAON_ENTITY } from "../fiaon-invoice";
import { paketPreisCents } from "@shared/fiaon-pakete";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK, GLOBAL_VERTRAG_VERSION, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND_VERTRAG, GLOBAL_VIP_REISE, inVertragssprache,
  GLOBAL_JAHRESBETREUUNG, globalPaket, globalKapital, type GlobalSchluessel,
} from "@shared/fiaon-global";

export type VertragSprache = "de" | "en";

export interface VertragFirma {
  name: string; rechtsform: string;
  registergericht?: string | null; registernummer?: string | null;
  strasse: string; plz: string; ort: string; land: string;
  ustId?: string | null;
}
export interface VertragPerson { anrede?: string | null; vorname: string; nachname: string; funktion: string }
export interface VertragUnterschrift { png: string; am: Date; ip: string; hash: string }

/** Wer beauftragt: ein Unternehmen (Vorgabe) oder eine Privatperson (19.09.2026, E-191). */
export type GlobalAuftraggeber = "unternehmen" | "privat";

export interface GlobalVertragDaten {
  paket: GlobalSchluessel;
  sprache: VertragSprache;
  firma: VertragFirma;
  ansprechpartner: VertragPerson;
  /** Fehlt es, beauftragt ein Unternehmen — so lauten alle Aufträge vor dem 19.09.2026. */
  auftraggeber?: GlobalAuftraggeber;
  /** Nur Privatperson: hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt. */
  sofortBeginn?: boolean;
  /** 19.09.2026 (E-196): im Auftrag angekreuzt — Jahresbetreuung ab dem zweiten Jahr (Ziffer 2, 3 und 5). Fehlt es, ist sie nicht gebucht. */
  jahresbetreuung?: boolean;
  /** Die Antragsnummer — steht in Unterzeile und Fußzeile. In der Vorschau gibt es sie noch nicht. */
  ref?: string | null;
  /** Fehlt sie, ist es die Fassung VOR der Unterschrift. */
  unterschrift?: VertragUnterschrift | null;
}

/** Die zwölf Ziffern, die kein Auftrag verlieren darf — der Prüfstand zählt sie nach. */
export const GLOBAL_VERTRAG_ZIFFERN: Record<VertragSprache, string[]> = {
  de: [
    "Parteien", "Gegenstand und Leistungen", "Partner und Abgrenzung", "Mitwirkung des Auftraggebers",
    "Vergütung", "Erstattungszusage", "Pflichthinweise", "Dauer und Beendigung", "Haftung",
    "Vertraulichkeit und Datenschutz", "Unternehmer-Bestätigung", "Schlussbestimmungen",
  ],
  en: [
    "Parties", "Subject matter and services", "Partners and scope", "Cooperation of the client",
    "Fee", "Refund commitment", "Mandatory notices", "Term and termination", "Liability",
    "Confidentiality and data protection", "Business confirmation", "Final provisions",
  ],
};

/** Dieselben zwölf Ziffern im Auftrag einer Privatperson — Ziffer 11 regelt den Widerruf. */
export const GLOBAL_VERTRAG_ZIFFERN_PRIVAT: Record<VertragSprache, string[]> = {
  de: GLOBAL_VERTRAG_ZIFFERN.de.map((z) => (z === "Unternehmer-Bestätigung" ? "Widerrufsrecht" : z)),
  en: GLOBAL_VERTRAG_ZIFFERN.en.map((z) => (z === "Business confirmation" ? "Right of withdrawal" : z)),
};
export function globalVertragZiffern(sprache: VertragSprache, auftraggeber: GlobalAuftraggeber = "unternehmen"): string[] {
  return (auftraggeber === "privat" ? GLOBAL_VERTRAG_ZIFFERN_PRIVAT : GLOBAL_VERTRAG_ZIFFERN)[sprache];
}

/** Die Widerrufsfrist in Tagen (§ 355 Abs. 2 BGB). */
export const GLOBAL_WIDERRUF_TAGE = 14;
/**
 * Tage nach dem Fristende, bevor ein Auftrag ohne den Wunsch nach sofortigem Beginn startet:
 * Ein Widerruf ist rechtzeitig, wenn er vor Fristende ABGESCHICKT wurde (§ 355 Abs. 1 S. 5 BGB) —
 * ein Brief vom letzten Tag muss noch ankommen können.
 */
export const GLOBAL_WIDERRUF_PUFFER_TAGE = 3;

const isoPlus = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const berlinIso = (am: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(am);

/**
 * Das Ende der Widerrufsfrist und der Tag, ab dem ein Privatauftrag OHNE den Wunsch nach
 * sofortigem Beginn startet — beides als JJJJ-MM-TT (Berlin).
 * Die Frist beginnt mit dem Vertragsschluss, also der Unterschrift (§ 355 Abs. 2 S. 2 BGB);
 * der Tag selbst zählt nicht mit (§ 187 Abs. 1 BGB). Endet sie an einem Samstag oder Sonntag,
 * läuft sie bis Montag (§ 193 BGB); Feiertage fängt der Puffer auf.
 */
export function globalWiderrufsfrist(unterschriebenAm: Date): { fristEnde: string; startAb: string } {
  let ende = isoPlus(berlinIso(unterschriebenAm), GLOBAL_WIDERRUF_TAGE);
  const wochentag = new Date(`${ende}T12:00:00Z`).getUTCDay();
  if (wochentag === 6) ende = isoPlus(ende, 2); else if (wochentag === 0) ende = isoPlus(ende, 1);
  return { fristEnde: ende, startAb: isoPlus(ende, GLOBAL_WIDERRUF_PUFFER_TAGE) };
}

const LAND_NAME: Record<VertragSprache, Record<string, string>> = {
  de: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" },
  en: { DE: "Germany", AT: "Austria", CH: "Switzerland" },
};

const VORGAENGER: Partial<Record<GlobalSchluessel, GlobalSchluessel>> = {
  global_banking: "global_struktur", global_kapital: "global_banking", global_vip: "global_kapital",
};

/**
 * Die Leistungen eines Pakets, vollständig ausgeschrieben.
 *
 * Auf der Seite steht „Alles aus Global Struktur" — als Tafel ist das richtig,
 * in einem Vertrag nicht: Dort muss stehen, WAS geschuldet ist, ohne dass der
 * Auftraggeber eine zweite Tafel danebenlegen muss.
 */
export function globalLeistungenVollstaendig(key: GlobalSchluessel, sprache: VertragSprache): string[] {
  const p = globalPaket(key);
  if (!p) return [];
  const eigene = p[sprache].leistungen.filter((l) => !/^(Alles aus|Everything in) /i.test(l));
  const vor = VORGAENGER[key];
  return vor ? [...globalLeistungenVollstaendig(vor, sprache), ...eigene] : eigene;
}

/** „2.499,00 €" bzw. „€2,499.00" — aus dem Katalog, mit Cent, wie auf der Rechnung. */
export function globalVertragPreis(key: GlobalSchluessel, sprache: VertragSprache): string {
  const euro = paketPreisCents(key) / 100;
  return sprache === "en"
    ? "€" + euro.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : euro.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function globalVertragTitel(key: GlobalSchluessel, sprache: VertragSprache): string {
  const p = globalPaket(key);
  const name = p ? p[sprache].name : String(key);
  return sprache === "en"
    ? `Engagement for setting up a US corporate structure — FIAON ${name}`
    : `Auftrag über den Aufbau einer US-Unternehmensstruktur — FIAON ${name}`;
}

export function globalVertragUnterzeile(d: Pick<GlobalVertragDaten, "sprache" | "ref">): string {
  const teile = d.sprache === "en"
    ? [`Contract version ${GLOBAL_VERTRAG_VERSION}`, d.ref ? `Order ${d.ref}` : null]
    : [`Vertragsversion ${GLOBAL_VERTRAG_VERSION}`, d.ref ? `Auftrag ${d.ref}` : null];
  return teile.filter(Boolean).join(" · ");
}

function tagText(am: Date, sprache: VertragSprache): string {
  return sprache === "en"
    ? am.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })
    : am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}
function zeitText(am: Date, sprache: VertragSprache): string {
  const zeit = am.toLocaleTimeString(sprache === "en" ? "en-GB" : "de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return sprache === "en" ? `${tagText(am, sprache)} at ${zeit} (Europe/Berlin)` : `${tagText(am, sprache)} um ${zeit} Uhr (Europe/Berlin)`;
}

const e = escapeHtml;

function parteien(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const f = d.firma; const a = d.ansprechpartner;
  const land = LAND_NAME[d.sprache][String(f.land || "").toUpperCase()] ?? String(f.land || "");
  const register = [f.registergericht, f.registernummer].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  // „vertreten durch Herrn …" — der Akkusativ; im Englischen Mr/Ms.
  const anrede = en
    ? ({ Herr: "Mr", Frau: "Ms" } as Record<string, string>)[String(a.anrede || "")] ?? ""
    : a.anrede === "Herr" ? "Herrn" : a.anrede;
  const vertreter = [anrede, a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const fiaon = en
    ? `<b>${e(FIAON_ENTITY.name)}</b>, ${e(FIAON_ENTITY.addressLine1)}, ${e(FIAON_ENTITY.addressLine2)}, ${e(FIAON_ENTITY.country)}, registered at Companies House (England and Wales) under Company No. ${e(FIAON_ENTITY.companyNo)}, represented by its Director ${e(FIAON_ENTITY.director)}, e-mail ${e(FIAON_ENTITY.email)} — hereinafter “FIAON”.`
    : `<b>${e(FIAON_ENTITY.name)}</b>, ${e(FIAON_ENTITY.addressLine1)}, ${e(FIAON_ENTITY.addressLine2)}, ${e(FIAON_ENTITY.country)}, eingetragen im Companies House (England and Wales) unter der Company No. ${e(FIAON_ENTITY.companyNo)}, vertreten durch den Director ${e(FIAON_ENTITY.director)}, E-Mail ${e(FIAON_ENTITY.email)} — nachfolgend „FIAON“.`;
  // Eine Privatperson beauftragt selbst: Name und Wohnanschrift, kein Register, keine Vertretung.
  const person = [a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const kunde = d.auftraggeber === "privat"
    ? (en
      ? `<b>${e(person)}</b>, residing at ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)} — hereinafter the “Client”.`
      : `<b>${e(person)}</b>, wohnhaft ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)} — nachfolgend „Auftraggeber“.`)
    : en
    ? `<b>${e(f.name)}</b>${f.rechtsform ? `, ${e(f.rechtsform)}` : ""}${register ? `, registered at ${e(register)}` : ""}, ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)}${f.ustId ? `, VAT ID ${e(f.ustId)}` : ""}, represented by ${e(vertreter)}, ${e(a.funktion)} — hereinafter the “Client”.`
    : `<b>${e(f.name)}</b>${f.rechtsform ? `, ${e(f.rechtsform)}` : ""}${register ? `, eingetragen: ${e(register)}` : ""}, ${e(f.strasse)}, ${e(f.plz)} ${e(f.ort)}, ${e(land)}${f.ustId ? `, USt-IdNr. ${e(f.ustId)}` : ""}, vertreten durch ${e(vertreter)}, ${e(a.funktion)} — nachfolgend „Auftraggeber“.`;
  return `<p>${fiaon}</p><p>${kunde}</p>`;
}

function unterschriftsBlock(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const a = d.ansprechpartner; const u = d.unterschrift ?? null;
  const name = [a.vorname, a.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const bild = u
    ? `<img class="sig-img" src="${e(u.png)}" alt="${en ? "Signature" : "Unterschrift"}" />`
    : `<span class="gv-leise">${en ? "To be signed electronically." : "Wird elektronisch unterschrieben."}</span>`;
  const ortDatum = u ? `${e(d.firma.ort)}, ${e(tagText(u.am, d.sprache))}` : "—";
  const meta = u
    ? (en
      ? `Signed electronically by ${e(name)} on ${e(zeitText(u.am, "en"))}<br/>IP address: ${e(u.ip || "—")}<br/>Document hash (SHA-256): <span class="hash">${e(u.hash)}</span>`
      : `Elektronisch unterschrieben von ${e(name)} am ${e(zeitText(u.am, "de"))}<br/>IP-Adresse: ${e(u.ip || "—")}<br/>Dokument-Hash (SHA-256): <span class="hash">${e(u.hash)}</span>`)
    : "";
  return `
  <div class="sig-grid gv-sig">
    <div class="sig-col">
      <div class="gv-sig-kopf">${en ? "For FIAON" : "Für FIAON"}</div>
      <div class="gv-sig-feld">${en ? "FIAON LTD — executed electronically" : "FIAON LTD — elektronisch ausgefertigt"}</div>
      <div class="sig-line">${e(FIAON_ENTITY.director)}, Director</div>
    </div>
    <div class="sig-col">
      <div class="gv-sig-kopf">${en ? "For the Client" : "Für den Auftraggeber"}</div>
      <div class="gv-sig-feld">${bild}</div>
      <div class="sig-line">${e(name)}${d.auftraggeber === "privat" ? "" : `, ${e(a.funktion)}`}<br/>${en ? "Place, date" : "Ort, Datum"}: ${ortDatum}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
    </div>
  </div>`;
}

/** Die zwölf Ziffern — der eine Text für Bildschirm und PDF. */
function vertragsRumpf(d: GlobalVertragDaten): string {
  const en = d.sprache === "en";
  const p = globalPaket(d.paket);
  if (!p) throw new Error(`Unbekanntes Global-Paket: ${d.paket}`);
  const t = p[d.sprache];
  const privat = d.auftraggeber === "privat";
  // Ohne den Wunsch nach sofortigem Beginn wartet ein Privatauftrag die Widerrufsfrist ab (§ 357a Abs. 2 BGB).
  const wartet = privat && !d.sofortBeginn;
  const titel = globalVertragZiffern(d.sprache, d.auftraggeber);
  // Die Nummer der Widerrufs-Ziffer — fällt Ziffer 6 weg (Schalter aus), rückt sie auf.
  const nrWiderruf = GLOBAL_GELD_ZURUECK.aktiv ? 11 : 10;
  const preis = globalVertragPreis(d.paket, d.sprache);
  // 18.09.2026: Die Seite nennt die Zahl „Kapitalrahmen"; beim VIP-Paket ist sie eine Obergrenze.
  const kapital = globalKapital(d.paket, d.sprache);
  const rollen = GLOBAL_ROLLEN[d.sprache];
  // Der Vertrag spricht über die Parteien, nicht zu ihnen — dieselben Leistungen in Vertragssprache.
  const leistungen = globalLeistungenVollstaendig(d.paket, d.sprache).map((z) => inVertragssprache(z, d.sprache));
  const inklusive = GLOBAL_INKLUSIVE[d.sprache].map((z) => inVertragssprache(z, d.sprache));
  const liste = (zeilen: readonly string[]) => `<ul>${zeilen.map((z) => `<li>${e(z)}</li>`).join("")}</ul>`;
  // 19.09.2026 (E-196): Jahresbetreuung angekreuzt — Ziffer 2, 3 und 5 (siehe Kopf). Nur ein echtes true zählt.
  const jahr = d.jahresbetreuung === true;
  const jb = GLOBAL_JAHRESBETREUUNG[d.sprache];
  // Mitten im englischen Satz klein: „the annual care plan" — so schreibt es auch jb.vertrag.
  const jbName = en ? jb.titel.charAt(0).toLowerCase() + jb.titel.slice(1) : jb.titel;

  const ziffern: (string | null)[] = [
    // 1 — Parteien
    parteien(d),

    // 2 — Gegenstand und Leistungen
    (en
      ? `<p>FIAON supports the Client in setting up a US corporate structure within the scope of the package <b>FIAON ${e(t.name)}</b>. The package comprises:</p>`
      : `<p>FIAON begleitet den Auftraggeber beim Aufbau einer US-Unternehmensstruktur im Umfang des Pakets <b>FIAON ${e(t.name)}</b>. Das Paket umfasst:</p>`)
      + liste(leistungen)
      // E-196: Die Jahresbetreuung gehört zum Auftrag — was sie umfasst und kostet, steht in Ziffer 5.
      + (jahr
        ? (en
          ? `<p>In addition, the engagement covers the <b>${e(jbName)}</b> from the second year after formation, which the Client adds; its scope, fee and term are set out in clause 5.</p>`
          : `<p>Zusätzlich umfasst der Auftrag die <b>${e(jbName)}</b> ab dem zweiten Jahr nach der Gründung, die der Auftraggeber dazubucht; Umfang, Vergütung und Laufzeit regelt Ziffer 5.</p>`)
        : "")
      + `<p>${e(rollen.fiaon)}</p>`
      + (en
        ? `<p class="gv-kasten">The Client is aiming for a capital range of ${kapital.bisZu ? "up to" : "around"} ${e(kapital.wert)}; the duration and depth of the support are based on this. The institution concerned alone decides on the account, the card, the limit and any loan; no particular result is owed.</p>`
        : `<p class="gv-kasten">Der Auftraggeber strebt einen Kapitalrahmen von ${kapital.bisZu ? "bis zu" : "rund"} ${e(kapital.wert)} an; danach richten sich Dauer und Tiefe der Begleitung. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut; ein bestimmtes Ergebnis ist nicht geschuldet.</p>`),

    // 3 — Was nicht Teil des Auftrags ist
    // E-196: Mit der Jahresbetreuung stecken die Partner-Honorare für ihre Leistungen (US-Meldung ab dem
    // zweiten Jahr) in IHREM Preis, nicht im Paketpreis — sonst sagte Ziffer 3 etwas anderes als Ziffer 5.
    (en
      ? `<p>Tax and legal services within the scope of clause 2 are provided by tax advisers, US CPAs and lawyers from the FIAON partner network under their own engagement with the Client. FIAON pays the partners’ fees for these services; they are included in the package price${jahr ? ` and, where they relate to the ${e(jbName)}, in its price` : ""}. FIAON receives no remuneration from the partners. Services beyond this scope are agreed by the Client directly with the partner.</p>`
        + `<p>FIAON is neither a bank nor a lender, does not accept client funds and has no authority over the Client’s accounts. The Client enters into contracts with institutions itself.</p>`
      : `<p>Steuerliche und rechtliche Leistungen im Umfang von Ziffer 2 erbringen Steuerberater, US-CPA und Anwälte aus dem Partnernetz von FIAON auf eigenes Mandat des Auftraggebers. Die Honorare der Partner für diese Leistungen trägt FIAON; sie sind im Paketpreis enthalten${jahr ? ` und, soweit sie die ${e(jbName)} betreffen, in deren Preis` : ""}. FIAON erhält von den Partnern keine Vergütung. Leistungen darüber hinaus vereinbart der Auftraggeber unmittelbar mit dem Partner.</p>`
        + `<p>FIAON ist keine Bank und kein Kreditgeber, nimmt keine Kundengelder entgegen und verfügt nicht über Konten des Auftraggebers. Verträge mit Instituten schließt der Auftraggeber selbst.</p>`),

    // 4 — Mitwirkung des Auftraggebers
    (en
      ? `<p>The Client provides complete and truthful information and supplies the documents required. Applications to authorities and institutions are made by the Client in its own name; FIAON prepares them. The Client does not give false address or residence details to institutions or authorities. If the Client’s cooperation is delayed, agreed dates move accordingly.</p>`
      : `<p>Der Auftraggeber macht vollständige und wahre Angaben und stellt die benötigten Unterlagen bereit. Anträge bei Behörden und Instituten stellt der Auftraggeber im eigenen Namen; FIAON bereitet sie vor. Gegenüber Instituten und Behörden macht der Auftraggeber keine falschen Adress- oder Wohnsitzangaben. Verzögert sich die Mitwirkung, verschieben sich vereinbarte Termine entsprechend.</p>`),

    // 5 — Vergütung
    // E-196: Mit der Jahresbetreuung deckt der Festpreis „die Leistungen des Pakets"; an die Stelle des Satzes
    // zu den laufenden Kosten (GLOBAL_LAUFEND_VERTRAG) tritt die Jahresbetreuung, wörtlich aus der Quelle.
    (en
      ? `<p>The package price is a one-off fee of <b>${e(preis)}</b>. It is payable in advance by bank transfer to the account stated on the invoice; the Client receives the invoice together with this engagement. ${wartet ? `FIAON starts work after the withdrawal period has expired (clause ${nrWiderruf}), and not before payment has been received.` : "FIAON starts work once payment has been received."}</p>`
        + (jahr
          ? `<p>The package price is a fixed price. It covers all fees and charges for the services of the package under clause 2, in particular: ${e(inklusive.join("; "))}.</p>`
          : `<p>The package price is a fixed price. It covers all fees and charges for the services under clause 2, in particular: ${e(inklusive.join("; "))}. ${e(GLOBAL_LAUFEND_VERTRAG.en)}</p>`)
        + (d.paket === "global_vip" ? `<p>${e(GLOBAL_VIP_REISE.en)}</p>` : "")
        + (jahr ? `<p>${e(jb.vertrag)}</p><p>${e(jb.vertragBedingungen)}</p>` : "")
        + (privat
          ? `<p>For the Client as a private individual, the package price is a final price; any VAT that may be due is included in it.${jahr ? ` The same applies to the price of the ${e(jbName)}.` : ""}</p>`
          : `<p>The VAT treatment is shown on the invoice; where the Client owes the VAT as the recipient of the service (reverse charge), the invoice says so.</p>`)
      : `<p>Der Paketpreis beträgt einmalig <b>${e(preis)}</b>. Er ist im Voraus per Überweisung auf das in der Rechnung genannte Konto zu zahlen; die Rechnung erhält der Auftraggeber zusammen mit diesem Auftrag. ${wartet ? `FIAON beginnt nach Ablauf der Widerrufsfrist (Ziffer ${nrWiderruf}), frühestens mit dem Zahlungseingang.` : "FIAON beginnt mit dem Zahlungseingang."}</p>`
        + (jahr
          ? `<p>Der Paketpreis ist ein Festpreis. Er umfasst alle Gebühren und Honorare für die Leistungen des Pakets nach Ziffer 2, insbesondere: ${e(inklusive.join("; "))}.</p>`
          : `<p>Der Paketpreis ist ein Festpreis. Er umfasst alle Gebühren und Honorare für die Leistungen nach Ziffer 2, insbesondere: ${e(inklusive.join("; "))}. ${e(GLOBAL_LAUFEND_VERTRAG.de)}</p>`)
        + (d.paket === "global_vip" ? `<p>${e(GLOBAL_VIP_REISE.de)}</p>` : "")
        + (jahr ? `<p>${e(jb.vertrag)}</p><p>${e(jb.vertragBedingungen)}</p>` : "")
        + (privat
          ? `<p>Für den Auftraggeber als Privatperson ist der Paketpreis ein Endpreis; eine etwa anfallende Umsatzsteuer ist darin enthalten.${jahr ? ` Dasselbe gilt für den Preis der ${e(jbName)}.` : ""}</p>`
          : `<p>Die umsatzsteuerliche Behandlung ergibt sich aus der Rechnung; schuldet der Auftraggeber die Umsatzsteuer als Leistungsempfänger (Reverse Charge), weist die Rechnung darauf hin.</p>`)),

    // 6 — Geld zurück (nur, solange der Schalter in shared/fiaon-global.ts an ist)
    GLOBAL_GELD_ZURUECK.aktiv
      ? `<p>${e(GLOBAL_GELD_ZURUECK[d.sprache].vertrag)}</p><p>${e(GLOBAL_GELD_ZURUECK[d.sprache].vertragBedingungen)}</p>`
        + (en
          ? `<p>FIAON and the Client set this date together at the start; FIAON records it in the order file and communicates it to the Client in text form. The refund covers the package price; this commitment gives rise to no further claims.</p>`
          : `<p>Den Stichtag legen FIAON und der Auftraggeber beim Start gemeinsam fest; FIAON hält ihn in der Auftragsakte fest und teilt ihn dem Auftraggeber in Textform mit. Die Erstattung umfasst den Paketpreis; weitergehende Ansprüche aus dieser Zusage bestehen nicht.</p>`)
      : null,

    // 7 — Pflichthinweise (wörtlich)
    liste(GLOBAL_PFLICHTHINWEIS[d.sprache]),

    // 8 — Dauer und Beendigung
    (en
      ? `<p>${e(t.dauer)}. This is an empirical value, not a deadline. The engagement ends once the services under clause 2 have been provided.</p>`
        + `<p>Either party may end the engagement at any time in text form. Services already provided are not refunded${GLOBAL_GELD_ZURUECK.aktiv ? "; clause 6 remains unaffected" : ""}.${privat ? ` The right of withdrawal under clause ${nrWiderruf} remains unaffected.` : ""} The right to terminate for good cause remains.</p>`
      : `<p>${e(t.dauer)}. Diese Angabe ist ein Erfahrungswert und keine Frist. Der Auftrag endet, wenn die Leistungen nach Ziffer 2 erbracht sind.</p>`
        + `<p>Jede Partei kann den Auftrag jederzeit in Textform beenden. Bereits erbrachte Leistungen werden nicht erstattet${GLOBAL_GELD_ZURUECK.aktiv ? "; Ziffer 6 bleibt unberührt" : ""}.${privat ? ` Das Widerrufsrecht nach Ziffer ${nrWiderruf} bleibt unberührt.` : ""} Das Recht zur Beendigung aus wichtigem Grund bleibt bestehen.</p>`),

    // 9 — Haftung (Privatperson: die übliche Grenze „vertragstypischer, vorhersehbarer Schaden")
    privat
      ? (en
        ? `<p>FIAON is liable without limitation for intent and gross negligence and for injury to life, body or health. In the event of a slightly negligent breach of essential contractual duties, FIAON’s liability is limited to the typical damage foreseeable at the time the contract was concluded; otherwise liability for slight negligence is excluded. FIAON is not liable for decisions of third parties — in particular authorities, banks, card issuers, tax advisers and lawyers.</p>`
        : `<p>FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen Dritter — insbesondere von Behörden, Banken, Kartenherausgebern, Steuerberatern und Anwälten — haftet FIAON nicht.</p>`)
      : (en
        ? `<p>FIAON is liable without limitation for intent and gross negligence and for injury to life, body or health. Otherwise FIAON is liable only for the breach of essential contractual duties, limited in amount to the package price. FIAON is not liable for decisions of third parties — in particular authorities, banks, card issuers, tax advisers and lawyers.</p>`
        : `<p>FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet FIAON nur bei der Verletzung wesentlicher Vertragspflichten und der Höhe nach begrenzt auf den Paketpreis. Für Entscheidungen Dritter — insbesondere von Behörden, Banken, Kartenherausgebern, Steuerberatern und Anwälten — haftet FIAON nicht.</p>`),

    // 10 — Vertraulichkeit und Datenschutz
    (en
      ? `<p>Both parties treat non-public information of the other party as confidential. FIAON processes personal data in accordance with its privacy policy at fiaon.com/datenschutz. Where the service requires it, FIAON passes documents to authorities, to the registered agent and to the tax advisers and lawyers engaged by the Client.</p>`
      : `<p>Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich. FIAON verarbeitet personenbezogene Daten nach der Datenschutzerklärung unter fiaon.com/datenschutz. Soweit es die Leistung erfordert, gibt FIAON Unterlagen an Behörden, an den Registered Agent und an die vom Auftraggeber mandatierten Steuerberater und Anwälte weiter.</p>`),

    // 11 — Unternehmer-Bestätigung bzw. beim Privatauftrag das Widerrufsrecht
    privat
      ? (en
        ? `<p>If the Client is acting as a consumer (section 13 of the German Civil Code), the Client may withdraw from this engagement within fourteen days in accordance with the withdrawal instructions in the annex; the annex also contains the model withdrawal form.</p>`
          + (d.sofortBeginn
            ? `<p>The Client has expressly requested that FIAON begin performance before the withdrawal period expires. The Client is aware that in the event of withdrawal the Client pays a reasonable amount for the services provided up to that point, and that the right of withdrawal lapses once FIAON has fully performed the services.</p>`
            : `<p>The Client has not requested that FIAON begin before the withdrawal period expires. FIAON therefore begins only after the withdrawal period has expired, and not before payment has been received.</p>`)
        : `<p>Handelt der Auftraggeber als Verbraucher (§ 13 BGB), kann er diesen Auftrag binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in der Anlage widerrufen; die Anlage enthält auch das Muster-Widerrufsformular.</p>`
          + (d.sofortBeginn
            ? `<p>Der Auftraggeber hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt. Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat.</p>`
            : `<p>Der Auftraggeber hat nicht verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt. FIAON beginnt deshalb erst nach Ablauf der Widerrufsfrist, frühestens mit dem Zahlungseingang.</p>`))
      : (en
        ? `<p>The Client confirms that it is acting in the course of its trade, business or profession when placing this order (entrepreneur within the meaning of section 14 of the German Civil Code). A consumer right of withdrawal therefore does not apply. The signatory confirms that he or she is authorised to represent the Client.</p>`
        : `<p>Der Auftraggeber erklärt, bei Abschluss dieses Auftrags in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit zu handeln (Unternehmer im Sinne von § 14 BGB). Ein Widerrufsrecht für Verbraucher besteht deshalb nicht. Der Unterzeichner erklärt, zur Vertretung des Auftraggebers berechtigt zu sein.</p>`),

    // 12 — Schlussbestimmungen (Rechtswahl und Gerichtsstand wie § 12 der AGB des Hauses)
    (en
      ? `<p>Amendments and additions must be made in text form. The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods.${privat ? " If the Client is a consumer, this choice of law applies only insofar as it does not deprive the Client of the protection afforded by the mandatory provisions of the law of the state of the Client’s habitual residence." : ""} If the Client is a merchant, a legal entity under public law or a special fund under public law, the exclusive place of jurisdiction for all disputes arising from this engagement is Munich. Should individual provisions be or become invalid, the validity of the remainder is not affected; the statutory provisions apply in place of the invalid provision.</p>`
      : `<p>Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.${privat ? " Ist der Auftraggeber Verbraucher, gilt diese Rechtswahl nur, soweit ihm dadurch nicht der Schutz entzogen wird, den ihm die zwingenden Bestimmungen des Rechts des Staates seines gewöhnlichen Aufenthalts gewähren." : ""} Ist der Auftraggeber Kaufmann, eine juristische Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Auftrag München. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>`),
  ];

  // Fällt Ziffer 6 weg (Schalter aus), rücken die folgenden auf — im Text UND in der Zählung.
  let nr = 0;
  const abschnitte = ziffern.map((inhalt, i) => {
    if (inhalt == null) return "";
    nr++;
    // Überschrift und erster Absatz bleiben im Druck beisammen (.gv-anfang) — keine Überschrift
    // allein am Seitenende. Der Rest darf umbrechen: Die Leistungsliste des VIP-Pakets ist
    // länger als der Platz, der auf Seite 1 bleibt.
    const bloecke = inhalt.match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [inhalt];
    return `<section class="gv-ziffer"><div class="gv-anfang"><h2><span class="gv-nr">${nr}</span>${e(titel[i])}</h2>${bloecke[0]}</div>${bloecke.slice(1).join("")}</section>`;
  }).filter(Boolean);
  // Die Unterschrift steht nie allein auf einer Seite: Die letzte Ziffer und der
  // Unterschriftsblock bleiben im Druck zusammen (.gv-schluss).
  const letzte = abschnitte.pop() ?? "";
  return `${abschnitte.join("\n")}\n<div class="gv-schluss">${letzte}${unterschriftsBlock(d)}</div>${privat ? anlageWiderruf(d) : ""}`;
}

/**
 * Die Anlage zum Auftrag einer Privatperson: gesetzliche Muster-Widerrufsbelehrung für Dienstleistungen
 * (Anlage 1 zu Art. 246a § 1 Abs. 2 S. 2 EGBGB, mit Gestaltungshinweis 6) und Muster-Widerrufsformular
 * (Anlage 2) — WÖRTLICH, damit die gesetzliche Musterwirkung greift; englisch nach Anhang I A und B der
 * Richtlinie 2011/83/EU. Die Sätze sprechen den Kunden an („Sie") — so lautet das gesetzliche Muster.
 */
function anlageWiderruf(d: GlobalVertragDaten): string {
  // Der Wortlaut steht in shared/fiaon-global-widerruf.ts — dieselbe Quelle wie /business/widerrufsbelehrung.
  const b = globalWiderrufsbelehrung(d.sprache);
  const zeile = (text: string) => `<li><span>${e(text)}</span><i aria-hidden="true"></i></li>`;
  return `
  <section class="gv-anlage" lang="${d.sprache}">
    <h2>${e(b.titel)}</h2>
    <p class="gv-leise">${e(b.gilt)}</p>
    ${b.abschnitte.map((a) => `<h3>${e(a.h)}</h3>\n    ${a.absaetze.map((t) => `<p>${e(t)}</p>`).join("\n    ")}`).join("\n    ")}
    <div class="gv-formular">
      <h3>${e(b.formular.titel)}</h3>
      <p class="gv-leise">${e(b.formular.hinweis)}</p>
      <ul>
        <li><span>${e(b.formular.an)}</span></li>
        ${b.formular.zeilen.map(zeile).join("\n        ")}
      </ul>
      <p class="gv-leise">${e(b.formular.fuss)}</p>
    </div>
  </section>`;
}

/** Regeln, die nur innerhalb von .gv greifen — gefahrlos auf jeder Seite einsetzbar. */
export const GLOBAL_VERTRAG_CSS = `
  .gv { font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 400; color: #0f2044; line-height: 1.6; }
  .gv .gv-titel { font-size: 1.35em; font-weight: 300; letter-spacing: -.01em; margin: 0 0 4px; color: #0f2044; line-height: 1.25; }
  .gv .gv-unterzeile { font-size: .85em; color: #64748b; margin: 0 0 18px; }
  .gv h2 { font-size: 1em; font-weight: 500; letter-spacing: .01em; color: #0f2044; margin: 20px 0 6px; break-after: avoid; }
  /* Überschrift und erster Absatz bleiben im Druck beisammen — keine Überschrift allein am Seitenende. */
  .gv .gv-anfang, .gv .gv-kasten, .gv .gv-schluss { break-inside: avoid; page-break-inside: avoid; }
  .gv p, .gv li { orphans: 2; widows: 2; }
  .gv .gv-nr { display: inline-block; min-width: 1.6em; color: #1d4ed8; font-weight: 400; }
  .gv p { margin: 0 0 8px; text-align: left; font-weight: 400; }
  .gv b { font-weight: 600; }
  .gv ul { margin: 4px 0 10px; padding-left: 1.2em; list-style: disc; }
  .gv li { margin: 2px 0; }
  .gv .gv-kasten { border: 1px solid #dbe4f0; border-radius: 6px; padding: 10px 12px; background: #f7f9fc; }
  .gv .gv-leise { color: #64748b; font-size: .9em; }
  .gv .gv-sig { display: flex; gap: 28px; margin-top: 28px; page-break-inside: avoid; }
  .gv .gv-sig .sig-col { flex: 1; }
  .gv .gv-sig-kopf { font-weight: 500; font-size: .9em; }
  .gv .gv-sig-feld { min-height: 74px; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .gv .gv-sig .sig-line { border-top: 1px solid #0f2044; padding-top: 4px; font-size: .82em; color: #475569; margin-top: 0; }
  .gv .gv-sig .sig-img { max-height: 70px; max-width: 240px; }
  .gv .gv-sig .meta { font-size: .75em; color: #64748b; margin-top: 4px; }
  .gv .gv-sig .hash { font-family: "Courier New", monospace; font-size: .9em; word-break: break-all; color: #94a3b8; }
  /* Die Anlage beim Privatauftrag: im PDF auf eigener Seite, am Bildschirm durch eine Linie getrennt. */
  .gv .gv-anlage { break-before: page; page-break-before: always; margin-top: 30px; padding-top: 18px; border-top: 1px solid #dbe4f0; }
  .gv .gv-anlage h2 { margin-top: 0; }
  .gv h3 { font-size: .95em; font-weight: 500; color: #0f2044; margin: 14px 0 4px; break-after: avoid; }
  .gv .gv-formular { break-inside: avoid; page-break-inside: avoid; border: 1px solid #dbe4f0; border-radius: 6px; padding: 4px 14px 10px; margin-top: 16px; }
  .gv .gv-formular ul { list-style: none; padding-left: 0; }
  .gv .gv-formular li { margin: 8px 0; }
  .gv .gv-formular li i { display: block; border-bottom: 1px dotted #94a3b8; height: 18px; }
`;

/** Was nur das PDF betrifft: Kopf und Titel des Hausdokuments beruhigen, feste Fußzeile weg (sie läuft über die Druckvorlage). */
const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 16pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; }
  footer.doc { display: none; }
  ${GLOBAL_VERTRAG_CSS}
`;

/**
 * Der Auftrag als HTML-Fragment für den Bildschirm — mit Titel, ohne Rahmen.
 * Exakt der Rumpf, der auch ins PDF geht.
 */
export function globalVertragVorschauHtml(d: GlobalVertragDaten): string {
  return `<style>${GLOBAL_VERTRAG_CSS}</style>
<div class="gv" lang="${d.sprache}">
  <h1 class="gv-titel">${e(globalVertragTitel(d.paket, d.sprache))}</h1>
  <p class="gv-unterzeile">${e(globalVertragUnterzeile(d))}</p>
  ${vertragsRumpf(d)}
</div>`;
}

/** Der Rumpf allein — für das PDF und für den Dokument-Hash (ohne Unterschrift gerechnet). */
export function globalVertragRumpfHtml(d: GlobalVertragDaten): string {
  return `<div class="gv" lang="${d.sprache}">${vertragsRumpf(d)}</div>`;
}

/** Reiner Text — für den Prüfstand und die Wortwand. */
export function globalVertragText(d: GlobalVertragDaten): string {
  return `${globalVertragTitel(d.paket, d.sprache)}\n${vertragsRumpf(d)}`
    .replace(/<\/(p|li|h2|h3|section|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** Das PDF im FIAON-CI: dünne Schrift, Navy, laufende Fußzeile mit Version, Auftragsnummer und Seitenzahl. */
export async function globalVertragPdf(d: GlobalVertragDaten): Promise<Buffer> {
  const titel = globalVertragTitel(d.paket, d.sprache);
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: globalVertragUnterzeile(d),
    bodyHtml: globalVertragRumpfHtml(d),
    markenzeile: `${FIAON_ENTITY.name} · Company No. ${FIAON_ENTITY.companyNo} · ${FIAON_ENTITY.addressLine1}, ${FIAON_ENTITY.addressLine2}, ${FIAON_ENTITY.country}`,
    zusatzCss: PDF_CSS,
  });
  const fuss = [
    `${FIAON_ENTITY.name} · Company No. ${FIAON_ENTITY.companyNo}`,
    d.sprache === "en" ? `Contract version ${GLOBAL_VERTRAG_VERSION}` : `Vertragsversion ${GLOBAL_VERTRAG_VERSION}`,
    d.ref ? (d.sprache === "en" ? `Order ${d.ref}` : `Auftrag ${d.ref}`) : null,
  ].filter(Boolean).join(" · ");
  return htmlZuPdfMitFusszeile({
    html, fusszeile: fuss, titel,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
    // Der englische Auftrag zählt seine Seiten englisch: „Page 1 of 3".
    sprache: d.sprache,
  });
}

/** Alle vier Schlüssel — für Prüfstand und Routen. */
export const GLOBAL_VERTRAG_PAKETE: GlobalSchluessel[] = GLOBAL_PAKETE.map((p) => p.key);
