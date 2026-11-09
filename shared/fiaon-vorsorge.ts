// ═══════════════════════════════════════════════════════════════════════════
// FIAON — „IHR VORSORGE-ÜBERBLICK“ UND DIE SELBSTBUCHUNG BEIM PARTNER (E-487 (09.11.2026))
//
// Justin (09.11.2026): „für alle Privatkunden eine Mail, ob wer seine Finanzierungschancen mit der passenden Absicherung
// absichern will, und direkt einen Termin beim Partner buchen“. Daraus wurde der saubere Weg (Plan p2):
//   1. „Ihr Vorsorge-Überblick“ — FIAONs EIGENE Leistung: Der Kunde hält fest, welche Vorsorge-Themen ihm wichtig sind.
//      FIAON fragt nur das Thema und empfiehlt nichts (nur Tippgeber, § 34d GewO). Nie mit Finanzierung verknüpft.
//   2. Auf Wunsch ein kostenloses Gespräch beim Partner (Lieferstrecke E-386) — selbst gebucht, mit eigener Einwilligung im
//      Wortlaut (Ich-Form, Kästchen NIE vorangekreuzt), Kanal „kundenbereich“, IP und Browser-Kennung.
//   3. Maras Mail „Ihr Vorsorge-Überblick“ (server/mail/vorlagen/vorsorge.ts) — geht erst, wenn Justin im Chefbüro ›
//      Mailwerk freigibt; je Mensch genau eine, höchstens 60 am Tag, 09–19 Uhr Berlin.
// Diese Datei hält die Texte und die REINEN Regeln, die Seite, Kundenbereich, Server und Prüfstand gleich lesen
// (scripts/pruef-vorsorge.ts). Der Wortlaut der Einwilligung steht genau hier und nur hier.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partner- oder Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import { koopPartnerImSatz } from "./fiaon-koop-lieferung";

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINWILLIGUNG DER SELBSTBUCHUNG
// ═══════════════════════════════════════════════════════════════════════════
/** Fassung des Wortlauts unten — steht an jeder gespeicherten Einwilligung. Neuer Text = neue Fassung. */
export const VORSORGE_FASSUNG = "KOOP-EW-SELBST-2026-11-09";

export type VorsorgePartnerText = { anrede?: string; vorname?: string; nachname?: string; firma?: string };

/**
 * DER WORTLAUT, den der Kunde selbst liest und mit einem eigenen, nicht vorangekreuzten Kästchen bestätigt — die Ich-Form
 * von koopEinwilligungText (shared/fiaon-koop-lieferung.ts) für Vorsorge (Art. 6 Abs. 1 Buchst. a, Art. 7 DSGVO; § 7 Abs. 2
 * Nr. 1 UWG). Er nennt den Empfänger mit Namen, die Daten, den Zweck, die Kontaktwege und den Widerruf. Eine Notiz gibt es
 * bei der Selbstbuchung nicht — es geht nur, was hier steht.
 */
export function vorsorgeEinwilligungText(partner: VorsorgePartnerText, thema: string): string {
  const frau = partner.anrede === "Frau";
  const wer = frau ? "einer selbstständigen Beraterin und Partnerin von FIAON" : "einem selbstständigen Berater und Partner von FIAON";
  const an = frau ? "an die Beraterin" : "an den Berater";
  const dass = frau ? "die Beraterin" : "der Berater";
  return [
    `Ich möchte ein kostenloses Gespräch zum Thema „${thema}“ mit ${koopPartnerImSatz(partner)}, ${wer}.`,
    `Dafür übermittelt FIAON meinen Vor- und Nachnamen, meine Telefonnummer, meine E-Mail-Adresse, mein Wunschthema und den gebuchten Termin ${an}.`,
    `Ich willige ein, dass ${dass} mich zu diesem Gespräch telefonisch und per E-Mail kontaktiert.`,
    "FIAON berät nicht zu Versicherungen oder Geldanlagen und erhält keine Provision. Meine FIAON-Leistungen hängen nicht davon ab.",
    "Ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen — formlos, z. B. an support@fiaon.com oder telefonisch bei FIAON.",
  ].join(" ");
}

/** Was der Kunde für fehlende Akten-Angaben selbst bestätigt — eigene Kästchen, nie vorangekreuzt. */
export const VORSORGE_BESTAETIGEN: Record<"wohnsitz_de" | "volljaehrig", string> = {
  wohnsitz_de: "Ich wohne in Deutschland.",
  volljaehrig: "Ich bin volljährig.",
};

/**
 * Was zur Einwilligung gespeichert wird: der Wortlaut, WIE er gegeben wurde (selbst, mit Kästchen und Knopf) und welche
 * Angaben der Kunde dazu bestätigt hat. Der Partnerbrief sagt „im FIAON-Kundenbereich selbst erteilt“.
 */
export function vorsorgeWortlaut(text: string, bestaetigt: readonly string[]): string {
  const dazu = (["wohnsitz_de", "volljaehrig"] as const).filter((k) => bestaetigt.includes(k)).map((k) => VORSORGE_BESTAETIGEN[k]);
  return `${text} — Vom Kunden selbst erteilt: eigenes Kästchen angehakt (nicht vorangekreuzt) und „Termin buchen“ gedrückt.${dazu.length ? ` Selbst bestätigt: ${dazu.join(" ")}` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PARTNER AUF DER SEITE: Name und Rolle
// ═══════════════════════════════════════════════════════════════════════════
/** „Herr Max Muster“ — wie der Name über der Rolle steht (Nominativ; im Satz heißt es „mit Herrn …“). */
export function vorsorgePartnerName(p: VorsorgePartnerText): string {
  const name = `${String(p.vorname ?? "").trim()} ${String(p.nachname ?? "").trim()}`.trim();
  return p.anrede === "Herr" || p.anrede === "Frau" ? `${p.anrede} ${name}` : name;
}

/**
 * Die Rolle unter dem Namen. Was nur für EINEN Partner gilt („selbstständiger Vermögensberater“), steht nicht im Code,
 * sondern am Vertrag (schalter.rolle, Chefbüro › Geschäftspartner). Ohne Eintrag gilt die Rolle aus der Einwilligung.
 */
export function vorsorgeRolle(roh: unknown, anrede: string | undefined): string {
  const eigene = String(roh ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (eigene) return eigene;
  return anrede === "Frau" ? "selbstständige Beraterin" : "selbstständiger Berater";
}
/** „selbstständiger Berater, Partner von FIAON“ (bei Frau „…, Partnerin von FIAON“). */
export function vorsorgeRollenZeile(roh: unknown, anrede: string | undefined): string {
  return `${vorsorgeRolle(roh, anrede)}, ${anrede === "Frau" ? "Partnerin" : "Partner"} von FIAON`;
}
/** Erlaubte Zeichen für die Rolle (Chefbüro): Buchstaben, Leerzeichen, Bindestrich, Punkt, „&“ — höchstens 60 Zeichen. */
export function vorsorgeRolleGueltig(roh: unknown): boolean {
  const s = String(roh ?? "").trim();
  return s === "" || (s.length <= 60 && /^[A-Za-zÄÖÜäöüß .&-]+$/.test(s));
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ÜBERBLICK: nur Themen aus der Liste
// ═══════════════════════════════════════════════════════════════════════════
/** Nur Themen aus `erlaubt`, jedes einmal, in der Reihenfolge der Liste. Alles andere fällt still weg. */
export function vorsorgeThemenAus(roh: unknown, erlaubt: readonly string[]): string[] {
  const gewaehlt = new Set((Array.isArray(roh) ? roh : []).map((t) => String(t ?? "")));
  return erlaubt.filter((t) => gewaehlt.has(t));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TEXTE (Sie-Form; kein „bis zu“, kein Bank-Satz, keine Verknüpfung mit Finanzierung, FIAON empfiehlt nichts)
// ═══════════════════════════════════════════════════════════════════════════
export const VORSORGE_TEXTE = {
  titel: "Ihr Vorsorge-Überblick",
  lead: "Halten Sie in wenigen Minuten fest, welche Vorsorge-Themen Ihnen wichtig sind. Wenn Sie möchten, buchen Sie danach direkt ein kostenloses Gespräch.",
  karteTitel: "Ihr Vorsorge-Überblick",
  karteText: "Halten Sie fest, welche Vorsorge-Themen Ihnen wichtig sind — und buchen Sie auf Wunsch direkt ein kostenloses Gespräch. Ihre FIAON-Leistungen hängen davon nicht ab.",
  schritt1: "Was ist Ihnen wichtig?",
  /** In der Karte steht „Ihr Vorsorge-Überblick“ schon als Titel — dort heißt Schritt 1 schlicht so. */
  schritt1Marke: "Ihre Themen",
  schritt1Hinweis: "Mehrfachauswahl möglich. FIAON fragt nur das Thema und empfiehlt keine Produkte.",
  speichern: "Überblick speichern",
  gespeichert: "Gespeichert — Ihr Vorsorge-Überblick liegt in Ihrem Kundenbereich.",
  ueberblickLeer: "Noch nichts ausgewählt.",
  schritt2: "Kostenloses Gespräch dazu?",
  schritt2Text: "Sprechen Sie mit einem Partner von FIAON — kostenlos und unverbindlich. Sie entscheiden danach in Ruhe.",
  gewuenscht: "Sie hatten ein Gespräch gewünscht — hier wählen Sie direkt Thema und Termin.",
  oeffnen: "Ja, Termin wählen",
  themaFrage: "Zu welchem Thema?",
  artFrage: "Wie möchten Sie sprechen?",
  zeitFrage: "Wählen Sie Ihren Termin",
  keineZeiten: "In den nächsten drei Wochen ist gerade kein Termin frei. Bitte schauen Sie in ein paar Tagen wieder vorbei.",
  einwilligungTitel: "Ihre Einwilligung",
  einwilligungKaestchen: "Ja, damit bin ich einverstanden.",
  gehtAn: "Geht an",
  knopf: "Termin buchen",
  bucht: "Wird gebucht …",
  gebuchtTitel: "Ihr Termin ist gebucht",
  gebuchtText: "Sie bekommen gleich eine Bestätigung per E-Mail.",
  absagen: "Termin nicht mehr gewünscht",
  abgesagt: "Erledigt — der Termin ist abgesagt, und der Partner weiß Bescheid.",
  keinInteresse: "Kein Gespräch gewünscht",
  keinInteresseDanke: "In Ordnung — wir fragen nicht mehr danach. Ihr Vorsorge-Überblick bleibt gespeichert.",
  voll: "Gerade sind alle Gesprächsplätze vergeben. Bitte schauen Sie in ein paar Tagen wieder vorbei — Ihr Überblick bleibt gespeichert.",
  keinPartner: "Gerade ist kein Gespräch buchbar. Ihr Überblick bleibt gespeichert.",
  nichtMoeglich: "Ein Gespräch über FIAON ist für Ihr Konto gerade nicht möglich. Bei Fragen erreichen Sie uns unter support@fiaon.com.",
  nurDeutschland: "Gespräche mit unseren Partnern gibt es derzeit nur bei Wohnsitz in Deutschland.",
  kontaktFehlt: "Für ein Gespräch brauchen wir Ihre Telefonnummer und Ihre E-Mail-Adresse. Schreiben Sie uns kurz an support@fiaon.com — dann ergänzen wir sie.",
  fiaonSatz: "FIAON berät nicht zu Versicherungen oder Geldanlagen und empfiehlt keine Produkte. Das Gespräch führt der Partner. Ihre FIAON-Leistungen hängen davon nicht ab.",
  vorschau: "Vorschau — so sieht der Kunde seine Seite. Gespeichert oder gebucht wird hier nichts.",
  linkAbgelaufen: "Dieser Link ist abgelaufen. Ihren Vorsorge-Überblick finden Sie jederzeit in Ihrem Kundenbereich.",
  linkUngueltig: "Dieser Link funktioniert nicht. Bitte nutzen Sie den Knopf aus unserer E-Mail oder Ihren Kundenbereich.",
  fehler: "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einer Minute noch einmal.",
} as const;

/** Kundentexte zu den Fehler-Kennungen des Kerns (koopKontaktAnlegen) — nie ein interner Satz an Kunden. */
export function vorsorgeFehlerText(code: string | undefined, bestaetigen: readonly string[] = []): string {
  switch (code) {
    case "einwilligung": return "Bitte setzen Sie zuerst das Häkchen bei Ihrer Einwilligung.";
    case "thema": return "Bitte wählen Sie ein Thema aus der Liste.";
    case "art": return "Bitte wählen Sie, wie Sie sprechen möchten.";
    case "termin": case "nicht_frei": return "Dieser Termin ist gerade vergeben worden. Bitte wählen Sie einen anderen.";
    case "sperre": return VORSORGE_TEXTE.voll;
    case "exklusiv": return "Zu diesem Thema haben Sie schon ein Gespräch gebucht.";
    case "bestaetigen": return bestaetigen.includes("wohnsitz_de") ? "Bitte bestätigen Sie noch, dass Sie in Deutschland wohnen." : "Bitte bestätigen Sie noch, dass Sie volljährig sind.";
    case "partner": return "Dieses Gespräch ist gerade nicht buchbar. Bitte laden Sie die Seite neu.";
    case "kandidat": return VORSORGE_TEXTE.nichtMoeglich;
    default: return VORSORGE_TEXTE.fehler;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS SEITE, KUNDENBEREICH UND SERVER AUSTAUSCHEN
// ═══════════════════════════════════════════════════════════════════════════
export interface VorsorgeSlot { iso: string; tag: string; zeit: string; text: string }
export interface VorsorgePartner {
  angebotId: number;
  /** „Herr Max Muster“ */
  name: string;
  /** „selbstständiger Berater, Partner von FIAON“ */
  rolle: string;
  /** Für den Wortlaut der Einwilligung (dieselbe Funktion im Browser und im Server). */
  partnerFuerText: VorsorgePartnerText;
  arten: { key: string; text: string }[];
  dauerMin: number;
  termine: VorsorgeSlot[];
  /** Gerade keine neuen Gespräche (Wunschmenge der Woche, Ruhen …) — der Kunde liest VORSORGE_TEXTE.voll. */
  voll: boolean;
  themen: string[];
}
export type VorsorgeStand = "frage" | "gewuenscht" | "termin" | "abgelehnt";
export interface VorsorgeLage {
  ok: true;
  /** Etwas zeigen? (Karte im Kundenbereich: nur mit aktivem Partner, ohne Sperre, ohne „kein Interesse“.) */
  zeigen: boolean;
  /** Ein Gespräch ist buchbar (Partner aktiv, Kontaktdaten da, keine Sperre). */
  buchbar: boolean;
  /** Kundentext, wenn etwas nicht geht — sonst null. */
  hinweis: string | null;
  /** Vorschau aus dem Chefbüro: nichts wird gespeichert. */
  vorschau: boolean;
  name: string;
  themen: string[];
  ueberblick: { themen: string[]; am: string | null };
  partner: VorsorgePartner[];
  /** partner steht im Satz („Herrn …“/„Frau …“) — die Seite zeigt „Mit Herrn …“. */
  termin: { text: string; art: string; thema: string; partner: string } | null;
  stand: VorsorgeStand;
  bestaetigen: ("wohnsitz_de" | "volljaehrig")[];
  /** Thema → Kundentext, wenn es schon gebucht ist (Exklusivität). */
  belegt: Record<string, string>;
  fassung: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE MAIL: KREIS, MERKMALE, SPERRGRÜNDE — die Entscheidung über jeden Menschen (rein, ohne Datenbank)
//
// Die Datenbank liefert je Mensch mit bezahltem Stufenpaket nur FAKTEN (server/lib/fiaon-vorsorge-einladung.ts,
// merkmaleSql). WER angeschrieben wird, entscheidet allein diese Funktion — für Zählung, Vorschau, Takt und Tür gleich.
// ═══════════════════════════════════════════════════════════════════════════
export type VorsorgeKreis = "gruen" | "gruen_gelb";
export const VORSORGE_KREISE: readonly VorsorgeKreis[] = ["gruen", "gruen_gelb"];
/** Unbekannt oder leer heißt der ENGERE Kreis. */
export function vorsorgeKreisAus(roh: unknown): VorsorgeKreis {
  return String(roh ?? "").trim().toLowerCase() === "gruen_gelb" ? "gruen_gelb" : "gruen";
}

/** Die Einstellungen in fiaon_settings — EXAKT diese Namen. Geschrieben nur über „Freigeben“/„Anhalten“ im Mailwerk. */
export const VORSORGE_SCHALTER = { an: "vorsorge_mail_an", kreis: "vorsorge_mail_kreis", freigabe: "vorsorge_mail_freigabe" } as const;
export interface VorsorgeFreigabe { am: string; von: string; kreis: VorsorgeKreis; angehaltenAm: string | null; angehaltenVon: string | null }
export interface VorsorgeEinstellungen { an: boolean; kreis: VorsorgeKreis; freigabe: VorsorgeFreigabe | null }
/**
 * Die Einstellungen aus rohen Werten — rein (Prüfstand). VORGABE AUS: Nur der Wert „1“ schaltet ein; fehlt die Zeile,
 * ist sie leer oder unlesbar, geht nichts raus. Der Kreis fällt im Zweifel auf den engeren („gruen“).
 */
export function vorsorgeEinstellungenAus(roh: Record<string, unknown>): VorsorgeEinstellungen {
  let freigabe: VorsorgeFreigabe | null = null;
  try {
    const f = JSON.parse(String(roh[VORSORGE_SCHALTER.freigabe] ?? "")) as Record<string, unknown>;
    if (f && typeof f === "object" && typeof f.am === "string") {
      freigabe = {
        am: f.am, von: String(f.von ?? ""), kreis: vorsorgeKreisAus(f.kreis),
        angehaltenAm: typeof f.angehaltenAm === "string" ? f.angehaltenAm : null, angehaltenVon: typeof f.angehaltenVon === "string" ? f.angehaltenVon : null,
      };
    }
  } catch { /* keine Freigabe gespeichert */ }
  return { an: String(roh[VORSORGE_SCHALTER.an] ?? "").trim() === "1", kreis: vorsorgeKreisAus(roh[VORSORGE_SCHALTER.kreis]), freigabe };
}
export const VORSORGE_KREIS_TEXT: Record<VorsorgeKreis, { titel: string; text: string }> = {
  gruen: {
    titel: "Grün",
    text: "Bezahlt, Deutschland, ungekündigt — und der Hinweis nach § 7 Abs. 3 UWG stand schon bei der Erhebung der Adresse (erster Antrag ab 02.09.2026, 12:35 Uhr).",
  },
  gruen_gelb: {
    titel: "Grün + Gelb",
    text: "Bezahlt, Deutschland, ungekündigt — auch Kunden, deren erster Antrag vor dem Widerspruchs-Hinweis lag.",
  },
};

export interface VorsorgeMerkmale {
  /** Ein bezahltes Stufenpaket (Grundmenge). A (Zahlung gemeldet), B (Antrag offen) und C (nur Lead) haben keins. */
  bezahlt: boolean;
  /** Bezahltes, ungekündigtes, laufendes Stufenpaket — und keine wirksame Kündigung (die EINE Regel). */
  ungekuendigt: boolean;
  /** Land aus Antrag, Person oder Hinweis (Vorwahl, Adresse); leer = kein Hinweis. */
  land: string;
  mailOk: boolean;
  telefonOk: boolean;
  test: boolean;
  vertriebssperre: boolean;
  /** priority_tier −1 („ausgeschlossen“) */
  ausgeschlossen: boolean;
  minderjaehrig: boolean;
  werbesperre: boolean;
  abgemeldet: boolean;
  /** „STOPP“ auf WhatsApp oder im Postfach */
  stopp: boolean;
  /** Rückläufer, Spam-Meldung oder von Brevo blockiert (jemals) */
  unzustellbar: boolean;
  dsgvo: boolean;
  /** FIAON Global: Angebot, Auftrag oder selbst Partner */
  global: boolean;
  /** Zuletzt „kein Interesse“ an einem Partner-Gespräch */
  keinInteresse: boolean;
  /** Eine Partner-Einwilligung in den letzten sechs Monaten widerrufen */
  widerrufen: boolean;
  /** Schon ein Partner-Kontakt in den letzten sechs Monaten */
  kontaktKuerzlich: boolean;
  rateUeberfaellig: boolean;
  /** In der Telefonkartei storniert */
  storniert: boolean;
  /** Erster Antrag nach dem Widerspruchs-Hinweis (§ 7 Abs. 3 Nr. 4 UWG) */
  nachStichtag: boolean;
  /** Hat die Mail schon bekommen (Person oder Adresse) — je Mensch genau eine. */
  versandt: boolean;
}

export type VorsorgeSperrgrund =
  | "nicht_bezahlt" | "gekuendigt" | "ausland" | "ohne_mail" | "ohne_telefon" | "test" | "vertriebssperre" | "ausgeschlossen"
  | "minderjaehrig" | "werbesperre" | "abgemeldet" | "stopp" | "unzustellbar" | "dsgvo" | "global" | "kein_interesse"
  | "widerrufen" | "kontakt" | "rate_ueberfaellig" | "storniert";

export const VORSORGE_SPERRGRUND_TEXT: Record<VorsorgeSperrgrund, string> = {
  nicht_bezahlt: "kein bezahltes Stufenpaket (A, B, C)",
  gekuendigt: "gekündigt oder Vertrag beendet",
  ausland: "Wohnsitz nicht in Deutschland",
  ohne_mail: "ohne gültige E-Mail-Adresse",
  ohne_telefon: "ohne Telefonnummer",
  test: "Testkonto",
  vertriebssperre: "Vertriebssperre",
  ausgeschlossen: "ausgeschlossen",
  minderjaehrig: "minderjährig",
  werbesperre: "Werbesperre",
  abgemeldet: "abgemeldet",
  stopp: "„Stopp“ (WhatsApp oder Postfach)",
  unzustellbar: "Adresse unzustellbar oder blockiert",
  dsgvo: "DSGVO-Löschung",
  global: "FIAON Global",
  kein_interesse: "„kein Interesse“ an einem Partner-Gespräch",
  widerrufen: "Partner-Einwilligung widerrufen (6 Monate)",
  kontakt: "schon ein Partner-Gespräch (6 Monate)",
  rate_ueberfaellig: "Rate überfällig",
  storniert: "in der Telefonkartei storniert",
};

/** Deutschland — oder gar kein Hinweis auf ein anderes Land (dann bestätigt der Kunde den Wohnsitz auf der Seite). */
export function vorsorgeLandOk(land: unknown): boolean {
  const l = String(land ?? "").trim().toUpperCase();
  return l === "" || ["DE", "DEU", "DEUTSCHLAND", "GERMANY"].includes(l);
}

/** Der erste Grund, warum dieser Mensch die Mail NIE bekommt — null = keiner. Reihenfolge = Wichtigkeit in der Zählung. */
export function vorsorgeSperrgrund(m: VorsorgeMerkmale): VorsorgeSperrgrund | null {
  if (!m.bezahlt) return "nicht_bezahlt";
  if (m.test) return "test";
  if (m.dsgvo) return "dsgvo";
  if (m.werbesperre) return "werbesperre";
  if (m.abgemeldet) return "abgemeldet";
  if (m.stopp) return "stopp";
  if (m.vertriebssperre) return "vertriebssperre";
  if (m.ausgeschlossen) return "ausgeschlossen";
  if (!m.ungekuendigt) return "gekuendigt";
  if (m.global) return "global";
  if (!vorsorgeLandOk(m.land)) return "ausland";
  if (m.minderjaehrig) return "minderjaehrig";
  if (!m.mailOk) return "ohne_mail";
  if (m.unzustellbar) return "unzustellbar";
  if (!m.telefonOk) return "ohne_telefon";
  if (m.keinInteresse) return "kein_interesse";
  if (m.widerrufen) return "widerrufen";
  if (m.kontaktKuerzlich) return "kontakt";
  if (m.rateUeberfaellig) return "rate_ueberfaellig";
  if (m.storniert) return "storniert";
  return null;
}

/** Der Kreis: „gruen“ nur mit Hinweis bei der Erhebung, „gruen_gelb“ alle ohne Sperrgrund. */
export function imVorsorgeKreis(kreis: VorsorgeKreis, m: Pick<VorsorgeMerkmale, "nachStichtag">): boolean {
  return kreis === "gruen_gelb" || m.nachStichtag === true;
}

/** Darf diese Mail (noch) an diesen Menschen — ohne Sperrgrund, im Kreis, noch nie bekommen? */
export function vorsorgeEmpfaenger(m: VorsorgeMerkmale, kreis: VorsorgeKreis): boolean {
  return vorsorgeSperrgrund(m) === null && imVorsorgeKreis(kreis, m) && !m.versandt;
}

/** Rücksicht des Tages — nur für den Versand, nie für die Zählung. null = heute ja. */
export interface VorsorgeRuecksicht {
  /** Irgendeine Mail in den letzten 6 Stunden */
  mail6h: boolean;
  /** Eine WERBLICHE Mail (Auskunft-Angebot, Lead-Strecke, Rückholung …) in den letzten 20 Stunden */
  werbung20h: boolean;
  /** Ein Fehlversuch dieser Mail in den letzten 24 Stunden */
  fehlversuch24h: boolean;
  /** Fehlversuche dieser Mail insgesamt */
  fehlversuche: number;
}
export const VORSORGE_HOECHSTENS_VERSUCHE = 3;
export function vorsorgeHeuteNicht(r: VorsorgeRuecksicht): string | null {
  if (r.fehlversuche >= VORSORGE_HOECHSTENS_VERSUCHE) return `schon ${r.fehlversuche} Fehlversuche — kein weiterer`;
  if (r.fehlversuch24h) return "Fehlversuch in den letzten 24 Stunden";
  if (r.werbung20h) return "andere werbliche Mail in den letzten 20 Stunden";
  if (r.mail6h) return "andere Mail in den letzten 6 Stunden";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAKT: Fenster 09–19 Uhr Berlin, alle 30 Minuten, Tagesdeckel 60, gleichmäßig über den Tag
// ═══════════════════════════════════════════════════════════════════════════
export const VORSORGE_TAGESDECKEL = 60;
export const VORSORGE_SENDE_AB_MIN = 9 * 60;
/** Bis 19:00 Uhr — der letzte Lauf darf um 18:59 senden, um 19:00 ist Schluss. */
export const VORSORGE_SENDE_BIS_MIN = 19 * 60;
export const VORSORGE_TAKT_MINUTEN = 30;
/** Läufe an einem Sendetag, wenn der Takt zur vollen und halben Stunde läuft: 09:00 … 18:30 = 20. */
export const VORSORGE_LAEUFE_JE_TAG = Math.floor((VORSORGE_SENDE_BIS_MIN - VORSORGE_SENDE_AB_MIN) / VORSORGE_TAKT_MINUTEN);

/** Minuten seit Mitternacht in Berlin — über formatToParts. −1, wenn nicht lesbar (im Zweifel gilt Nachtruhe). */
export function vorsorgeBerlinMinuten(jetzt: Date = new Date()): number {
  let teile: Intl.DateTimeFormatPart[];
  try {
    teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(jetzt);
  } catch { return -1; }
  const h = Number(teile.find((p) => p.type === "hour")?.value);
  const m = Number(teile.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return (h % 24) * 60 + m;
}

/** Senden erlaubt? 09:00 bis 18:59 Berlin. */
export function vorsorgeSendezeit(jetzt: Date = new Date()): boolean {
  const m = vorsorgeBerlinMinuten(jetzt);
  return m >= VORSORGE_SENDE_AB_MIN && m < VORSORGE_SENDE_BIS_MIN;
}

/**
 * Wie viele in DIESEM Lauf — gleichmäßig über den Tag (Muster laufDeckel, fiaon-auskunft-verkauf.ts): Soll bis jetzt =
 * Deckel × (Läufe bis einschließlich diesem) ÷ (Läufe des Tages), aufgerundet; dieser Lauf nimmt Soll minus schon Gesendetes,
 * nie mehr als das Doppelte des gleichmäßigen Anteils plus 2 (wird um 18 Uhr freigegeben: nicht 57 auf einmal).
 * Außerhalb des Fensters immer 0. `rest` = Deckel minus heute schon gesendet.
 */
export function vorsorgeLaufDeckel(rest: number, jetzt: Date = new Date(), tagesDeckel: number = VORSORGE_TAGESDECKEL): number {
  if (!Number.isFinite(rest) || rest <= 0 || !Number.isFinite(tagesDeckel) || tagesDeckel <= 0) return 0;
  const m = vorsorgeBerlinMinuten(jetzt);
  if (m < VORSORGE_SENDE_AB_MIN || m >= VORSORGE_SENDE_BIS_MIN) return 0;
  const bisher = Math.min(VORSORGE_LAEUFE_JE_TAG, Math.floor((m - VORSORGE_SENDE_AB_MIN) / VORSORGE_TAKT_MINUTEN) + 1);
  const gesendet = Math.max(0, tagesDeckel - rest);
  const soll = Math.ceil((tagesDeckel * bisher) / VORSORGE_LAEUFE_JE_TAG);
  const obergrenze = 2 * Math.ceil(tagesDeckel / VORSORGE_LAEUFE_JE_TAG) + 2;
  return Math.max(0, Math.min(Math.floor(rest), soll - gesendet, obergrenze));
}
