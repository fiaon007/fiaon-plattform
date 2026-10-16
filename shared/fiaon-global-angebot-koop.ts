// ═══════════════════════════════════════════════════════════════════════════
// FIAON — DER KOOPERATIONSVERTRAG „TERMINE FÜR IHRE BERATUNG“ (Register E-384, 16.10.2026)
//
// Justin (16.10.2026): Ein Bestandskunde ist selbstständiger Vermögensberater. Viele FIAON-Kunden wollen sich finanziell
// neu aufstellen — „wir liefern ihm Kunden … ein Mitarbeiter ruft den Kunden an, fragt welche Art von Versicherung er haben
// möchte bzw. braucht … und geben ihm im Anschluss einen fertigen Kunden mit Termin, den er nur abschließen muss. Für jeden
// übermittelten Kunden … am Ende des Kalendermonats eine Rechnung … mit einer Frist von 14 Tagen.“
//
// ── DIE ENTSCHEIDUNGEN DARIN ───────────────────────────────────────────────
//   · Preis je Kontakt (Vorgabe 59 € netto): ein exklusiver Kontakt mit erfragtem Thema UND festem Termin. Marktüblich
//     für Termin-Kontakte zu Vorsorge und Krankenzusatz sind grob 50–150 €; unsere Interessenten haben oft kleinere
//     Budgets — deshalb die Mitte, nicht die Spitze. Fest je Kontakt, NIE ein Anteil an einer Provision: So bleibt
//     FIAON reiner Tippgeber und braucht keine Erlaubnis als Versicherungsvermittler (§ 34d GewO).
//   · Einwilligung ist Pflicht (Art. 6 Abs. 1 Buchst. a DSGVO, § 7 Abs. 2 Nr. 1 UWG): Nur wer ausdrücklich zugestimmt
//     hat, dass der Partner ihn anruft, wird übermittelt — dokumentiert mit Datum, Uhrzeit und Wortlaut.
//   · Kein Produkt, keine Empfehlung von FIAON: Der Mitarbeiter fragt nur, zu welchem Thema ein Gespräch gewünscht ist.
//   · Rücksicht: Viele Interessenten haben eine angespannte Finanzlage. Der Partner empfiehlt nichts, dessen Beitrag der
//     Interessent erkennbar nicht dauerhaft tragen kann — das schützt die Menschen und den Namen FIAON.
//   · Start-Rahmen: Bis die erste Monatsrechnung bezahlt ist, höchstens eine feste Zahl Kontakte (Vorgabe 40) — danach
//     so viele, wie der Partner je Woche wünscht. Offene Rechnung → Übermittlung ruht, bis sie bezahlt ist.
//   · Reklamation binnen sieben Tagen (falsche Daten, keine Einwilligung, nicht erschienen ohne Ersatztermin, Dublette)
//     → Ersatz oder Gutschrift. „Kein Abschluss“ ist nie ein Reklamationsgrund.
//   · Unternehmergeschäft (§ 14 BGB): kein Widerrufsrecht für Verbraucher. Nettopreise; die Umsatzsteuer schuldet der
//     Partner (Reverse Charge, § 13b UStG — FIAON LTD sitzt in London). Deutsches Recht, gesetzliche Gerichtsstände
//     (eine Klage auf eine Monatsrechnung soll am Sitz des Partners möglich bleiben).
//
// Eigener Pfad wie der Begleitvertrag (E-312): Fassungen mit dem Präfix IA-KOOP- verzweigen in
// server/lib/fiaon-global-angebot-koop.ts. Vertrag in Vertragssprache („der Partner“, „FIAON“), die Seite spricht an.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partnerdaten.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { ANGEBOT_ANSPRECHPARTNER, type AngebotAbsatz, type AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort } from "./fiaon-global-angebot-firma";
import type { FirmaPhase, FirmaLeistung, FirmaFrage, FirmaAnnahmeTexte, FirmaUnterschriftEingabe } from "./fiaon-global-angebot-firma-typen";
import { escHtml } from "./fiaon-global-angebot-begleit";

// ═══════════════════════════════════════════════════════════════════════════
// FASSUNG
// ═══════════════════════════════════════════════════════════════════════════
export const KOOP_FASSUNG_PRAEFIX = "IA-KOOP-";
export const KOOP_FASSUNG = "IA-KOOP-2026-10-16-A";
export const KOOP_FASSUNGEN = [KOOP_FASSUNG] as const;
export function istKoopFassung(fassung: unknown): boolean {
  return String(fassung ?? "").startsWith(KOOP_FASSUNG_PRAEFIX);
}
export const KOOP_GUELTIG_TAGE = 14;
/** Der Knopf: Die Vergütung je Kontakt ist eine Zahlungspflicht — sie steht im Knopf. */
export const KOOP_KNOPF = "Kooperation zahlungspflichtig vereinbaren";
export const KOOP_MARKE = "FIAON Partner-Kooperation";

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export type KoopLand = "DE" | "AT" | "CH";
export interface KoopPartner {
  art: "unternehmer";
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  /** Geschäftsbezeichnung, z. B. „Finanz- und Vermögensberatung“ (freiwillig) */
  firma: string;
  strasse: string;
  plz: string;
  ort: string;
  land: KoopLand;
  email: string;
  telefon: string;
}
export interface KoopParameter {
  /** Vergütung je qualifiziertem Kontakt, netto */
  preisCents: number;
  /** Höchstzahl Kontakte, bis die erste Monatsrechnung bezahlt ist */
  startDeckel: number;
  /** Reklamationsfrist nach dem Termin (Tage) */
  reklamationTage: number;
  /** Zahlungsziel der Monatsrechnung (Tage) */
  zahlungszielTage: number;
  /** Übermittlung ruht, wenn eine Rechnung so viele Tage nach Fälligkeit offen ist */
  ruhenNachTagen: number;
  /** Kündigungsfrist (Tage) */
  kuendigungTage: number;
  /** Exklusivität je Interessent und Thema (Monate) */
  exklusivMonate: number;
  /** Themen, zu denen FIAON nach dem Gesprächswunsch fragt */
  themen: string[];
  /** Ansprechpartner (kuerzel aus ANGEBOT_ANSPRECHPARTNER) */
  ansprechpartner: string[];
}
export const KOOP_VORGABEN: KoopParameter = {
  preisCents: 5_900,
  startDeckel: 40,
  reklamationTage: 7,
  zahlungszielTage: 14,
  ruhenNachTagen: 7,
  kuendigungTage: 14,
  exklusivMonate: 6,
  themen: [
    "Altersvorsorge und Sparen (zum Beispiel Lebens- oder Rentenversicherung)",
    "Krankenzusatzversicherung",
    "Absicherung der Kinder",
    "Vermögensaufbau",
    "Absicherung von Einkommen und Familie",
  ],
  ansprechpartner: ["justin", "daniel"],
};
export interface KoopDaten {
  ref: string;
  fassung: string;
  partner: KoopPartner;
  parameter: KoopParameter;
  gueltigBis: string;
}
/** Was der Partner bei der Annahme wählt — steht im Annahmevermerk, NICHT in der Prüfsumme. */
export interface KoopWahl { wunschWoche: number }
export interface KoopUnterschriftVermerk { art: "gezeichnet" | "getippt"; name?: string | null; png?: string | null; am?: string; ip?: string }
export interface KoopAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; wahl: KoopWahl; unterschrift: KoopUnterschriftVermerk }
export interface KoopAnnahmeEingabe {
  textHash: string;
  wunschWoche: number;
  gelesen: boolean;
  unternehmer: boolean;
  unterschrift: FirmaUnterschriftEingabe;
}
export const KOOP_WUNSCH = { min: 1, max: 500, vorschlag: 10, stufen: [5, 10, 20, 50, 100] } as const;
export function koopWunschAus(roh: unknown): number | null {
  const n = Math.round(Number(roh));
  return Number.isFinite(n) && n >= KOOP_WUNSCH.min && n <= KOOP_WUNSCH.max ? n : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN UND NAMEN
// ═══════════════════════════════════════════════════════════════════════════
export function koopEur(cents: number): string {
  const e = Math.round(cents) / 100;
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}
export function koopTag(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
export function koopPartnerName(k: Pick<KoopPartner, "vorname" | "nachname">): string {
  return `${String(k.vorname ?? "").trim()} ${String(k.nachname ?? "").trim()}`.trim();
}
export function koopPartnerGruss(k: Pick<KoopPartner, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  return k.anrede && nach ? `${k.anrede} ${nach}` : koopPartnerName(k);
}
export function koopPartnerAnrede(k: Pick<KoopPartner, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  if (k.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  return `Guten Tag ${koopPartnerName(k)}`;
}
const LAND_NAME: Record<KoopLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
function anschrift(k: KoopPartner): string {
  return `${k.strasse}, ${k.plz} ${k.ort}, ${LAND_NAME[k.land] ?? k.land}`;
}
function partnerZeile(k: KoopPartner): string {
  return `${koopPartnerName(k)}${k.firma ? ` (${k.firma})` : ""}, ${anschrift(k)}`;
}
/** Monatsbetrag zu einer Wochenmenge (4,33 Wochen je Monat, gerundet auf ganze Euro) — nur für die Seite. */
export function koopMonatCents(wunschWoche: number, preisCents: number): number {
  return Math.round((wunschWoche * 52 / 12) * preisCents / 100) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function koopVertragTitel(): string {
  return "FIAON — Kooperationsvertrag: Termine für Ihre Beratung";
}
export function koopVertragUnterzeile(d: Pick<KoopDaten, "ref" | "fassung" | "gueltigBis">): string {
  return `${KOOP_MARKE} · Vertragsfassung ${d.fassung} · Angebot ${d.ref} · gültig bis ${koopTag(d.gueltigBis)}`;
}
export function koopPraeambel(_d: KoopDaten): string[] {
  return [
    "FIAON begleitet Menschen dabei, ihre Finanzen zu ordnen und neu aufzubauen. Viele von ihnen möchten in diesem Zuge auch ihre Vorsorge und Absicherung angehen und wünschen dafür ein persönliches Gespräch mit einer Fachperson.",
    "Der Partner ist selbstständig in der Finanz- und Vorsorgeberatung tätig. Die Parteien vereinbaren, dass FIAON dem Partner Interessenten, die ein solches Gespräch ausdrücklich wünschen, mit festem Termin übermittelt — gegen eine feste Vergütung je Kontakt und ohne jede Beteiligung von FIAON an Abschlüssen.",
  ];
}
export function koopZiffern(d: KoopDaten): AngebotZiffer[] {
  const par = d.parameter;
  const preis = koopEur(par.preisCents);
  const rek = zahlwort(par.reklamationTage);
  const exkl = zahlwort(par.exklusivMonate);
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} (nachfolgend „FIAON“), und ${partnerZeile(d.partner)} (nachfolgend „Partner“). Der Partner schließt diesen Vertrag in Ausübung seiner selbstständigen beruflichen Tätigkeit (§ 14 BGB).`),
      p("Gegenstand ist die Übermittlung qualifizierter Kontakte (Ziffer 3) von Interessenten, die ein Gespräch mit dem Partner zu Vorsorge- und Absicherungsthemen wünschen, jeweils mit vereinbartem Termin."),
    ] },
    { nr: 2, titel: "Rolle von FIAON", absaetze: [
      p("FIAON stellt den Kontakt her und vereinbart den Termin. FIAON berät nicht zu Versicherungen oder Geldanlagen, empfiehlt keine Produkte und keine Gesellschaften und wirkt an der Anbahnung und am Abschluss von Verträgen zwischen dem Interessenten und dem Partner oder Dritten nicht mit. Gegenüber dem Interessenten fragt FIAON nur, ob und zu welchem Thema er ein Gespräch wünscht."),
      p("Die Vergütung nach Ziffer 6 steht FIAON unabhängig davon zu, ob und welcher Vertrag zustande kommt. FIAON erhält weder eine Abschlussprovision noch einen Anteil an einer Vergütung des Partners. Gespräch, Beratung und jeder Abschluss liegen allein beim Partner, in eigener Verantwortung und auf Grundlage seiner eigenen Erlaubnis bzw. Registrierung."),
    ] },
    { nr: 3, titel: "Der qualifizierte Kontakt", absaetze: [
      liste([
        "der Interessent ist volljährig und wohnt in Deutschland",
        "er hat FIAON ausdrücklich erlaubt, seine Kontaktdaten an den Partner zu übermitteln, und eingewilligt, dass der Partner ihn zu dem vereinbarten Gespräch telefonisch und per E-Mail kontaktiert; FIAON dokumentiert die Einwilligung mit Datum, Uhrzeit und Wortlaut",
        "er hat in einem Telefongespräch mit FIAON den Wunsch geäußert, mit dem Partner über mindestens eines der folgenden Themen zu sprechen: " + par.themen.join("; "),
        "für das Gespräch ist ein Termin (Tag, Uhrzeit, Telefon, Video oder vor Ort) in einer Zeit vereinbart, die der Partner freigegeben hat",
      ], "Ein Kontakt ist qualifiziert, wenn bei seiner Übermittlung alles Folgende vorliegt:"),
      p("FIAON übermittelt Vor- und Nachname, Telefonnummer, E-Mail-Adresse, das gewünschte Thema, den Termin und eine kurze Notiz aus dem Gespräch. Weitere Daten, insbesondere zu Einkommen, Gesundheit oder Bonität, übermittelt FIAON nur, wenn der Interessent dem ausdrücklich zugestimmt hat."),
      p(`Jeder Kontakt ist exklusiv: FIAON übermittelt denselben Interessenten zum selben Thema für ${exkl} Monate keinem anderen Partner.`),
    ] },
    { nr: 4, titel: "Menge, Termine und Übermittlung", absaetze: [
      p("Der Partner nennt bei der Annahme, wie viele Kontakte er je Woche wünscht (Annahmevermerk), und gibt FIAON die Zeiten frei, in denen Termine vereinbart werden dürfen. Beides kann er jederzeit in Textform ändern; die Änderung gilt ab dem folgenden Werktag."),
      p("FIAON übermittelt Kontakte im Rahmen der Wunschmenge, soweit qualifizierte Kontakte vorhanden sind. Eine Mindestmenge schuldet FIAON nicht; Kontakte über die Wunschmenge hinaus muss der Partner nicht abnehmen."),
      p(`Bis die erste Monatsrechnung bezahlt ist, übermittelt FIAON höchstens ${zahlwort(par.startDeckel)} Kontakte. Danach gilt allein die Wunschmenge.`),
      p("FIAON übermittelt jeden Kontakt spätestens am Werktag vor dem Termin per E-Mail an die Adresse des Partners aus Ziffer 1 oder über einen Partnerbereich, den FIAON dafür bereitstellt."),
    ] },
    { nr: 5, titel: "Pflichten des Partners", absaetze: [
      liste([
        "den Termin pünktlich wahrzunehmen oder ihn mit dem Interessenten rechtzeitig zu verlegen",
        "den Interessenten nach seinem Bedarf zu beraten und dabei die für ihn geltenden gesetzlichen Pflichten zu erfüllen, insbesondere die Beratungs- und Dokumentationspflichten nach dem Versicherungsvertragsgesetz",
        "auf die finanzielle Lage des Interessenten Rücksicht zu nehmen: Viele Interessenten befinden sich in einer angespannten Lage. Der Partner empfiehlt nichts, dessen Beiträge der Interessent erkennbar nicht dauerhaft tragen kann, und übt keinen Druck aus",
        "einen Interessenten nicht weiter zu kontaktieren, sobald dieser das nicht mehr wünscht, und FIAON davon binnen drei Werktagen in Textform zu unterrichten",
        "die Kontaktdaten allein für das vereinbarte Gespräch und eine daraus entstehende Kundenbeziehung zu nutzen und sie nicht an Dritte weiterzugeben oder zu verkaufen",
        "nicht im Namen von FIAON aufzutreten und nicht darauf hinzuwirken, dass ein Interessent einen Vertrag mit FIAON beendet",
      ], "Der Partner verpflichtet sich,"),
      p("Der Partner sichert zu, dass er für seine Tätigkeit die nötige Erlaubnis bzw. Registrierung und eine Berufshaftpflichtversicherung besitzt und dass seine Verträge mit Vertriebs- oder Produktgesellschaften es ihm erlauben, Kontakte von Dritten gegen Entgelt entgegenzunehmen. Ändert sich daran etwas, teilt er es FIAON unverzüglich in Textform mit."),
    ] },
    { nr: 6, titel: "Vergütung und Abrechnung", absaetze: [
      p(`Für jeden qualifizierten Kontakt zahlt der Partner FIAON ${preis}. Der Betrag ist ein Nettobetrag. FIAON sitzt im Vereinigten Königreich; für die Umsatzsteuer gilt das Reverse-Charge-Verfahren — Steuerschuldner ist der Partner (§ 13b UStG). Die Rechnungen weisen deshalb keine Umsatzsteuer aus.`),
      p(`FIAON rechnet zum Ende jedes Kalendermonats über alle in diesem Monat übermittelten Kontakte ab, mit einer Aufstellung (Tag der Übermittlung, Kürzel des Interessenten, Thema, Termin). Die Rechnung ist binnen ${zahlwort(par.zahlungszielTage)} Tagen nach Zugang per Überweisung zu zahlen; eine Lastschrift erfolgt nicht. Für einen berechtigt reklamierten Kontakt (Ziffer 7) entfällt die Vergütung.`),
      p(`Ist eine Rechnung ${zahlwort(par.ruhenNachTagen)} Tage nach Fälligkeit nicht bezahlt, ruht die Übermittlung neuer Kontakte bis zum Zahlungseingang; bereits vereinbarte Termine bleiben bestehen. Die gesetzlichen Regeln zum Zahlungsverzug bleiben unberührt.`),
    ] },
    { nr: 7, titel: "Qualität und Reklamation", absaetze: [
      liste([
        "die übermittelten Kontaktdaten sind falsch oder der Interessent ist darüber nicht erreichbar",
        "der Interessent bestreitet, eingewilligt oder ein Gespräch gewünscht zu haben, und FIAON kann die Einwilligung nicht binnen drei Werktagen nachweisen",
        "der Interessent erscheint nicht zum Termin und ist binnen sieben Tagen für keinen Ersatztermin erreichbar",
        `derselbe Interessent wurde dem Partner zum selben Thema innerhalb der letzten ${exkl} Monate schon einmal übermittelt`,
        "der Interessent ist minderjährig oder wohnt nicht in Deutschland",
      ], `Der Partner kann einen Kontakt binnen ${rek} Tagen nach dem vereinbarten Termin in Textform reklamieren, wenn`),
      p("Bei einer berechtigten Reklamation übermittelt FIAON nach Wahl des Partners einen Ersatzkontakt oder schreibt die Vergütung gut. Dass kein Vertrag zustande kommt, ist kein Reklamationsgrund."),
    ] },
    { nr: 8, titel: "Datenschutz", absaetze: [
      p("Jede Partei ist für ihre Verarbeitung personenbezogener Daten selbst verantwortlich. FIAON übermittelt Kontaktdaten auf Grundlage der Einwilligung des Interessenten (Art. 6 Abs. 1 Buchst. a DSGVO) und weist sie dem Partner auf Anfrage binnen drei Werktagen nach."),
      p("Der Partner informiert den Interessenten bei der ersten Kontaktaufnahme nach Art. 14 DSGVO, verarbeitet die Daten nur für das vereinbarte Gespräch und eine daraus entstehende Kundenbeziehung und löscht sie, wenn keine Kundenbeziehung entsteht, spätestens sechs Monate nach dem Termin, soweit keine gesetzliche Aufbewahrungspflicht besteht. Er kontaktiert den Interessenten telefonisch nur im Rahmen der Einwilligung (§ 7 Abs. 2 Nr. 1 UWG)."),
      p("Widerruft ein Interessent seine Einwilligung gegenüber einer Partei, unterrichtet sie die andere binnen drei Werktagen in Textform. Beide Parteien schützen die Daten nach dem Stand der Technik."),
    ] },
    { nr: 9, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme und läuft auf unbestimmte Zeit. Jede Partei kann ihn mit einer Frist von ${zahlwort(par.kuendigungTage)} Tagen in Textform kündigen. Kontakte, die bis zum Ende übermittelt wurden, werden nach Ziffer 6 abgerechnet.`),
      p("Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund für FIAON liegt insbesondere vor, wenn der Partner gegen Ziffer 5 Absatz 1 oder Ziffer 8 verstößt, seine Erlaubnis bzw. Registrierung verliert oder mit einer Rechnung länger als dreißig Tage in Verzug ist."),
    ] },
    { nr: 10, titel: "Haftung", absaetze: [
      p("Die Parteien haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen."),
      p("Für Gespräch, Beratung und Abschlüsse haftet allein der Partner; er stellt FIAON von Ansprüchen Dritter daraus frei. FIAON stellt den Partner von Ansprüchen frei, die darauf beruhen, dass für einen übermittelten Kontakt keine wirksame Einwilligung vorlag. Ob ein Interessent einen Vertrag schließt, liegt außerhalb der Verantwortung von FIAON."),
    ] },
    { nr: 11, titel: "Vertraulichkeit", absaetze: [
      p("Beide Parteien behandeln die Bedingungen dieses Vertrags und alle nicht öffentlichen Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags."),
    ] },
    { nr: 12, titel: "Schlussbestimmungen", absaetze: [
      p("Dieser Vertrag ist ein Geschäft unter Unternehmern; ein Widerrufsrecht für Verbraucher besteht nicht. Allgemeine Geschäftsbedingungen einer Partei gelten nicht."),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; es gelten die gesetzlichen Gerichtsstände. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

// ── HTML des Vertrags ───────────────────────────────────────────────────────
function ziffernHtml(ziffern: AngebotZiffer[]): string {
  return ziffern.map((z) => {
    const mehrere = z.absaetze.length > 1;
    const bloecke = z.absaetze.map((a, i) => {
      const nr = mehrere ? `<span class="gv-abs">(${i + 1})</span> ` : "";
      if (a.art === "p") return `<p>${nr}${escHtml(a.text)}</p>`;
      const kopf = a.einleitung ? `<p>${nr}${escHtml(a.einleitung)}</p>` : "";
      return `${kopf}<ul>${a.zeilen.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>`;
    });
    const [erster, ...rest] = bloecke.join("").match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [];
    return `<section class="gv-ziffer" id="ziffer-${z.nr}"><div class="gv-anfang"><h2><span class="gv-nr">${z.nr}</span>${escHtml(z.titel)}</h2>${erster ?? ""}</div>${rest.join("")}</section>`;
  }).join("\n");
}
function zeitText(am: Date): string {
  const tag = am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const zeit = am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${zeit} Uhr (Europe/Berlin)`;
}
function unterschriftHtml(u: KoopUnterschriftVermerk): string {
  const m = String(u.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]{100,})$/);
  const art = u.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt: ${escHtml(u.name ?? "")}`;
  const zeichen = m
    ? `<img class="gv-unterschrift-bild" src="data:image/png;base64,${m[1]}" alt="Unterschrift" style="display:block;max-width:240px;max-height:80px;margin:4px 0 2px" />`
    : `<span class="gv-unterschrift-getippt" style="display:block;font-family:'Mrs Saint Delafield','Snell Roundhand','Apple Chancery','Dancing Script',cursive;font-size:30px;line-height:1.1;color:#1b3866;margin:4px 0 2px">${escHtml(u.name ?? "")}</span>`;
  return `${zeichen}<span class="gv-leise" style="font-size:8pt">Unterschrift (${art})</span>`;
}
function annahmeBlock(d: KoopDaten, a: KoopAnnahmeVermerk | null): string {
  const name = koopPartnerName(d.partner);
  const fiaon = `<div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>`;
  if (!a) {
    return `
  <div class="gv-unterschriften">
    ${fiaon}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Partner</div><div class="gv-sig-feld"><span class="gv-leise">Annahme mit dem Knopf „${escHtml(KOOP_KNOPF)}“ — die gewünschte Menge je Woche steht dann hier im Annahmevermerk.</span></div><div class="sig-line">${escHtml(name)}</div></div>
  </div>`;
  }
  return `
  <div class="gv-unterschriften">
    ${fiaon}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Partner</div><div class="gv-sig-feld">${unterschriftHtml(a.unterschrift)}</div><div class="sig-line">${escHtml(name)}, ${escHtml(d.partner.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}</div></div>
  </div>
  <div class="gv-annahme">
    <h3>Annahmevermerk</h3>
    <p>Angenommen am ${escHtml(zeitText(a.am))} mit dem Knopf „${escHtml(KOOP_KNOPF)}“. Der Partner hat bestätigt, als Unternehmer zu handeln (Ziffer 1).</p>
    <ul>
      <li>Gewünschte Menge (Ziffer 4): <strong>${escHtml(String(a.wahl.wunschWoche))} Kontakte je Woche</strong> — bis zur Zahlung der ersten Monatsrechnung höchstens ${escHtml(String(d.parameter.startDeckel))} Kontakte</li>
      <li>Vergütung (Ziffer 6): ${escHtml(koopEur(d.parameter.preisCents))} netto je qualifiziertem Kontakt, Abrechnung zum Monatsende, zahlbar binnen ${escHtml(zahlwort(d.parameter.zahlungszielTage))} Tagen</li>
    </ul>
    <p class="gv-leise">IP-Adresse ${escHtml(a.ip)} · Prüfsumme des Vertragstextes (SHA-256): <span class="hash">${escHtml(a.hash)}</span></p>
  </div>`;
}
/** Der Rumpf: Präambel, zwölf Ziffern, Annahmeblock. Die Prüfsumme läuft über den Rumpf OHNE Vermerk. */
export function koopRumpfHtml(d: KoopDaten, annahme: KoopAnnahmeVermerk | null = null): string {
  const ziffern = ziffernHtml(koopZiffern(d)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${koopPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div></div>`;
}
export function koopHashEingabe(d: Pick<KoopDaten, "ref" | "fassung">, rumpfOhneAnnahme: string): string {
  return `global-angebot-koop|${d.ref}|${d.fassung}|${rumpfOhneAnnahme}`;
}
export function koopVertragInhalt(d: KoopDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...koopZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; lead: string; nutzen: string[]; preis: string; preisZeile: string; preisFein: string };
  rechner: { titel: string; sub: string; preisCents: number; stufen: number[]; vorschlag: number; woche: string; monat: string; fein: string };
  ablauf: { titel: string; sub: string; liste: FirmaPhase[] };
  kontakt: { titel: string; sub: string; felder: { titel: string; text: string }[]; themenTitel: string; themen: string[] };
  leistungen: { titel: string; sub: string; karten: FirmaLeistung[] };
  sauber: { titel: string; sub: string; punkte: { titel: string; text: string }[] };
  fragen: { titel: string; sub: string; liste: FirmaFrage[]; sichtbar: number };
  ansprechpartner: { titel: string; sub: string };
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  pflicht: string[];
}
export function koopSeite(d: KoopDaten): KoopSeite {
  const par = d.parameter; const k = d.partner;
  const preis = koopEur(par.preisCents);
  return {
    auftakt: {
      auge: `${KOOP_MARKE} · Persönlich für Sie`,
      gruss: `Willkommen als Partner, ${koopPartnerGruss(k)}.`,
      zeile: "Sie beraten — wir füllen Ihren Kalender.",
      weiter: "Weiter",
    },
    hero: {
      auge: KOOP_MARKE,
      titel: "Fertige Termine mit Menschen, die ein Gespräch wirklich wollen.",
      lead: "Wir rufen Interessenten aus unserem Kundenkreis an, fragen nach ihrem Wunschthema und tragen den Termin direkt in Ihre freien Zeiten ein. Sie führen das Gespräch und schließen ab — wir rechnen einmal im Monat ab.",
      nutzen: ["Termin, Thema und Kontaktdaten — fertig vorbereitet", "Exklusiv für Sie, mit dokumentierter Einwilligung", "Sie bestimmen die Menge je Woche"],
      preis,
      preisZeile: "je Kontakt mit Termin, netto",
      preisFein: `Abrechnung zum Monatsende · zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen · Reklamation binnen ${zahlwort(par.reklamationTage)} Tagen`,
    },
    rechner: {
      titel: "Ihre Menge, Ihr Kalender",
      sub: "Wählen Sie, wie viele Termine Sie je Woche wahrnehmen möchten — Sie können die Menge jederzeit ändern.",
      preisCents: par.preisCents, stufen: [...KOOP_WUNSCH.stufen], vorschlag: KOOP_WUNSCH.vorschlag,
      woche: "Termine je Woche", monat: "Etwa im Monat (netto)",
      fein: `Rechenbeispiel mit ${preis} je Kontakt. Berechnet wird nur, was wir tatsächlich übermitteln — eine Mindestmenge gibt es nicht.`,
    },
    ablauf: {
      titel: "So läuft es",
      sub: "Vom Anruf bei uns bis zum Termin in Ihrem Kalender.",
      liste: [
        { nr: 1, titel: "Einwilligung", dauer: "zuerst", text: "Der Interessent stimmt ausdrücklich zu, dass wir ihn an Sie übermitteln und Sie ihn anrufen dürfen — dokumentiert mit Datum, Uhrzeit und Wortlaut." },
        { nr: 2, titel: "Wunschthema", dauer: "im Gespräch", text: "Unser Team fragt, worüber er mit Ihnen sprechen möchte — Altersvorsorge, Krankenzusatz, die Kinder, Vermögensaufbau. Wir empfehlen nichts." },
        { nr: 3, titel: "Termin", dauer: "in Ihren Zeiten", text: "Wir vereinbaren den Termin in den Zeiten, die Sie freigegeben haben — am Telefon, per Video oder vor Ort." },
        { nr: 4, titel: "Übermittlung", dauer: "spätestens am Vortag", text: "Sie erhalten Name, Telefon, E-Mail, Thema, Termin und eine kurze Notiz aus unserem Gespräch." },
        { nr: 5, titel: "Ihr Gespräch", dauer: "zum Termin", text: "Sie beraten nach Bedarf und schließen ab. Am Monatsende kommt eine Rechnung mit Aufstellung.", abzeichen: preis },
      ],
    },
    kontakt: {
      titel: "Was Sie zu jedem Kontakt bekommen",
      sub: "Ein Kontakt zählt nur, wenn alles davon vorliegt.",
      felder: [
        { titel: "Einwilligung", text: "ausdrücklich, dokumentiert und auf Anfrage binnen drei Werktagen nachgewiesen" },
        { titel: "Wunschthema", text: "aus dem Telefongespräch mit unserem Team" },
        { titel: "Fester Termin", text: "Tag, Uhrzeit und Art — in Ihren freigegebenen Zeiten" },
        { titel: "Kontaktdaten", text: "Vor- und Nachname, Telefon, E-Mail und eine kurze Notiz" },
      ],
      themenTitel: "Themen, nach denen wir fragen",
      themen: par.themen,
    },
    leistungen: {
      titel: "Fair für beide Seiten",
      sub: "Klare Regeln statt Kleingedrucktem.",
      karten: [
        { schluessel: "vertrieb", titel: "Exklusiv", text: `Jeder Kontakt geht nur an Sie — zum selben Thema ${zahlwort(par.exklusivMonate)} Monate lang an niemanden sonst.`, punkte: ["Keine Mehrfachverkäufe", "Keine Listen, nur Termine", "Dubletten sind reklamierbar"] },
        { schluessel: "strategie", titel: "Reklamation", text: `Stimmt etwas nicht, melden Sie es binnen ${zahlwort(par.reklamationTage)} Tagen nach dem Termin.`, punkte: ["Falsche Daten oder nicht erreichbar", "Keine Einwilligung nachweisbar", "Nicht erschienen ohne Ersatztermin"], mehr: ["Sie wählen: Ersatzkontakt oder Gutschrift", "„Kein Abschluss“ ist kein Reklamationsgrund"] },
        { schluessel: "plattform", titel: "Einfache Abrechnung", text: `${preis} netto je Kontakt, eine Rechnung zum Monatsende.`, punkte: [`Zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen per Überweisung`, "Aufstellung mit jedem Kontakt", "Keine Grundgebühr, keine Mindestmenge"] },
      ],
    },
    sauber: {
      titel: "Sauber aufgestellt",
      sub: "Damit die Zusammenarbeit lange trägt.",
      punkte: [
        { titel: "Klare Rollen", text: "Wir stellen den Kontakt her und vereinbaren den Termin. Gespräch, Beratung und Abschluss liegen allein bei Ihnen — wir erhalten keine Provision und keinen Anteil daran." },
        { titel: "Datenschutz", text: "Nur mit ausdrücklicher Einwilligung des Interessenten. Sie nutzen die Daten nur für das Gespräch und informieren beim ersten Kontakt nach Art. 14 DSGVO." },
        { titel: "Mit Rücksicht", text: "Viele unserer Kunden ordnen gerade ihre Finanzen. Bitte empfehlen Sie nur, was zur Lage passt und dauerhaft tragbar ist — so bleiben Termine und Empfehlungen langfristig gut." },
      ],
    },
    fragen: {
      titel: "Fragen & Antworten",
      sub: "Kurz und ehrlich.",
      sichtbar: 6,
      liste: [
        { frage: "Wie viele Termine kann ich bekommen?", antwort: [`So viele, wie Sie je Woche wünschen und wir qualifizierte Kontakte haben. Zum Start gilt ein Rahmen von ${zahlwort(par.startDeckel)} Kontakten bis zur ersten bezahlten Monatsrechnung — danach allein Ihre Wunschmenge.`] },
        { frage: "Was genau kostet ein Kontakt?", antwort: [`${preis} netto je qualifiziertem Kontakt mit Termin. Keine Grundgebühr, keine Mindestmenge.`] },
        { frage: "Und die Umsatzsteuer?", antwort: ["Unsere Rechnungen kommen aus London und weisen keine Umsatzsteuer aus; die Steuer schuldet Ihr Unternehmen selbst (Reverse Charge). Als Versicherungs- oder Finanzberater können Sie sie oft nicht als Vorsteuer abziehen — Ihr Steuerberater sagt Ihnen, was für Sie gilt."] },
        { frage: "Was, wenn der Interessent nicht erscheint?", antwort: [`Ist er binnen sieben Tagen für keinen Ersatztermin erreichbar, reklamieren Sie den Kontakt — Sie erhalten einen Ersatzkontakt oder eine Gutschrift.`] },
        { frage: "Verdient FIAON an meinen Abschlüssen mit?", antwort: ["Nein. Wir erhalten nur den festen Betrag je Kontakt — unabhängig davon, ob und was abgeschlossen wird."] },
        { frage: "Darf ich die Kontakte anrufen?", antwort: ["Ja — jeder Interessent hat ausdrücklich eingewilligt, dass Sie ihn zum vereinbarten Gespräch anrufen und anschreiben. Wünscht er keinen Kontakt mehr, hören Sie auf und sagen uns kurz Bescheid."] },
        { frage: "Was muss ich mitbringen?", antwort: ["Ihre Erlaubnis bzw. Registrierung, eine Berufshaftpflicht und die Freigabe Ihrer Vertriebsgesellschaft, Kontakte von Dritten anzunehmen. Dazu freie Zeiten für Termine."] },
        { frage: "Wie komme ich wieder raus?", antwort: [`Mit ${zahlwort(par.kuendigungTage)} Tagen Frist in Textform. Abgerechnet wird nur, was bis dahin übermittelt wurde.`] },
      ],
    },
    ansprechpartner: { titel: "Ihre Ansprechpartner", sub: "Für Fragen zum Vertrag, zu Ihren Zeiten und zu jedem Termin." },
    vertrag: {
      titel: "Ihr Vertrag",
      sub: "Zwölf kurze Ziffern — derselbe Text wie im PDF.",
      dokument: koopVertragTitel(),
      unterzeile: koopVertragUnterzeile(d),
      inhalt: koopVertragInhalt(d),
    },
    pflicht: [
      "FIAON stellt Kontakte her und vereinbart Termine; FIAON berät nicht zu Versicherungen oder Geldanlagen und wirkt an Abschlüssen nicht mit.",
      "Übermittelt werden nur Interessenten mit ausdrücklicher, dokumentierter Einwilligung.",
      "Geschäft unter Unternehmern — Preise netto, Reverse Charge.",
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERSICHT UND ANNAHME (unmittelbar über dem Knopf)
// ═══════════════════════════════════════════════════════════════════════════
export function koopBestellUebersicht(d: KoopDaten): { titel: string; zeilen: { label: string; wert: string }[] } {
  const par = d.parameter;
  return {
    titel: "Ihre Kooperation im Überblick",
    zeilen: [
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}` },
      { label: "Partner", wert: partnerZeile(d.partner) },
      { label: "Leistung", wert: "Übermittlung qualifizierter Kontakte mit dokumentierter Einwilligung, Wunschthema und festem Termin — exklusiv für Sie" },
      { label: "Vergütung", wert: `${koopEur(par.preisCents)} netto je qualifiziertem Kontakt (Reverse Charge) — keine Grundgebühr, keine Mindestmenge` },
      { label: "Abrechnung", wert: `zum Ende jedes Kalendermonats mit Aufstellung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen per Überweisung` },
      { label: "Start-Rahmen", wert: `bis zur ersten bezahlten Monatsrechnung höchstens ${zahlwort(par.startDeckel)} Kontakte, danach Ihre Wunschmenge` },
      { label: "Reklamation", wert: `binnen ${zahlwort(par.reklamationTage)} Tagen nach dem Termin — Ersatzkontakt oder Gutschrift` },
      { label: "Laufzeit", wert: `unbefristet, kündbar mit ${zahlwort(par.kuendigungTage)} Tagen Frist in Textform` },
      { label: "Widerruf", wert: "Geschäft unter Unternehmern — kein Widerrufsrecht für Verbraucher" },
    ],
  };
}
export interface KoopAnnahmeTexte {
  titel: string; sub: string;
  wunsch: string; wunschUnter: string; wunschEinheit: string;
  unternehmer: string;
  gelesen: string;
  unterschrift: FirmaAnnahmeTexte["unterschrift"];
  knopf: string; unterKnopf: string; gesperrt: string;
}
export function koopAnnahmeTexte(d: KoopDaten): KoopAnnahmeTexte {
  const par = d.parameter; const name = koopPartnerName(d.partner);
  return {
    titel: "Kooperation vereinbaren",
    sub: "Menge wählen, zwei Häkchen, unterschreiben — fertig.",
    wunsch: "Wie viele Termine möchten Sie je Woche?",
    wunschUnter: `Jederzeit änderbar. Zum Start höchstens ${zahlwort(par.startDeckel)} Kontakte bis zur ersten bezahlten Monatsrechnung.`,
    wunschEinheit: "je Woche",
    unternehmer: "Ich schließe diesen Vertrag im Rahmen meiner selbstständigen beruflichen Tätigkeit (als Unternehmer).",
    gelesen: "Ich habe den Vertrag gelesen.",
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: "Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen.",
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${name}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.partner.nachname ?? "").trim()}).`,
    },
    knopf: KOOP_KNOPF,
    unterKnopf: `Mit dem Klick vereinbaren Sie die Kooperation. Heute wird nichts fällig: Sie zahlen ${koopEur(par.preisCents)} netto je übermitteltem Kontakt, abgerechnet zum Monatsende.`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
  };
}
export const KOOP_ANNAHME = {
  fehltWunsch: `Bitte wählen Sie, wie viele Termine Sie je Woche möchten (${KOOP_WUNSCH.min} bis ${KOOP_WUNSCH.max}).`,
  fehltUnternehmer: "Bitte bestätigen Sie, dass Sie als Unternehmer handeln.",
  fehltGelesen: "Bitte bestätigen Sie, dass Sie den Vertrag gelesen haben.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: "Willkommen an Bord — die Kooperation steht.",
  fertigText: (email: string, menge: number) => `Wir planen ab sofort ${menge} Termine je Woche für Sie ein. Ihren Vertrag schicken wir Ihnen an ${email}; Ihr Ansprechpartner stimmt in Kürze Ihre freien Zeiten mit Ihnen ab.`,
  fertigZahlung: "Heute ist nichts zu zahlen. Die erste Rechnung kommt zum Monatsende — mit Aufstellung jedes übermittelten Kontakts.",
  fertigFuss: "Für den Start brauchen wir nur Ihre freien Zeiten für Termine. Fragen? Schreiben Sie uns an support@fiaon.com.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ANSPRECHPARTNER, PARAMETER, PFLICHTFELDER
// ═══════════════════════════════════════════════════════════════════════════
export function koopAnsprechpartner(par: KoopParameter): { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] {
  const aus = par.ansprechpartner.map((kz) => ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz)).filter(Boolean) as { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[];
  return aus.length ? aus : ANGEBOT_ANSPRECHPARTNER.filter((x) => x.kuerzel === "justin");
}
export function koopParameterAus(roh: Partial<KoopParameter> | null | undefined, basis: KoopParameter = KOOP_VORGABEN): KoopParameter {
  const r = (roh ?? {}) as Record<string, unknown>;
  const zahl = (k: keyof KoopParameter, min: number, max: number): number => {
    const v = Number(r[k]); return Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : (basis[k] as number);
  };
  const themen = Array.isArray(r.themen)
    ? (r.themen as unknown[]).map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean).slice(0, 8)
    : basis.themen;
  const ap = Array.isArray(r.ansprechpartner) ? (r.ansprechpartner as unknown[]).map(String).filter((kz) => ANGEBOT_ANSPRECHPARTNER.some((x) => x.kuerzel === kz)).slice(0, 3) : basis.ansprechpartner;
  return {
    preisCents: zahl("preisCents", 1_000, 50_000),
    startDeckel: zahl("startDeckel", 5, 1_000),
    reklamationTage: zahl("reklamationTage", 3, 30),
    zahlungszielTage: zahl("zahlungszielTage", 7, 30),
    ruhenNachTagen: zahl("ruhenNachTagen", 0, 30),
    kuendigungTage: zahl("kuendigungTage", 7, 90),
    exklusivMonate: zahl("exklusivMonate", 1, 24),
    themen: themen.length ? themen : basis.themen,
    ansprechpartner: ap.length ? ap : basis.ansprechpartner,
  };
}
export function koopParameterFehler(p: KoopParameter): string | null {
  if (!p.preisCents) return "Preis je Kontakt fehlt.";
  if (!p.themen.length) return "Themen fehlen.";
  return null;
}
export function koopPflichtFehlen(d: Pick<KoopDaten, "partner" | "parameter">): string[] {
  const k = d.partner; const fehlt: string[] = [];
  if (!k.vorname || !k.nachname) fehlt.push("Name des Partners");
  if (!k.strasse || !k.plz || !k.ort) fehlt.push("Anschrift des Partners");
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(k.email ?? ""))) fehlt.push("E-Mail-Adresse des Partners");
  const pf = koopParameterFehler(d.parameter);
  if (pf) fehlt.push(pf);
  return fehlt;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSICHT (GET /api/fiaon/global/angebot/:token für ein offenes Kooperationsangebot)
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopKundenSicht {
  ok: true; status: "offen"; art: "koop";
  ref: string; fassung: string; gueltigBis: string;
  partner: { anrede: string; vorname: string; nachname: string; email: string };
  partnerAnrede: string;
  seite: KoopSeite;
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string }[];
  uebersicht: { titel: string; zeilen: { label: string; wert: string }[] };
  annahme: KoopAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  html: string;
  textHash: string;
  vertragPdf: string;
}
