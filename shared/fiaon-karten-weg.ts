// ═══════════════════════════════════════════════════════════════════════════
// DER WEG ZUR KARTE IN WORTEN — eine Stelle für WhatsApp, Mail und Mara
// (21.09.2026, E-205/E-206)
//
// Justin am 21.09.2026 zu Maras Ton: „Die Karte kommt so schnell wie möglich,
// nach Aktivierung Ihres Accounts erhalten Sie direkt den fertigen Link für die
// unkomplizierte Fertigstellung, danach 2–5 Werktage, bis Sie die Karte in den
// Händen halten, vorher können Sie diese auch per Apple Pay über die App nutzen."
// Freigegeben in der rechtssicheren Fassung (keine Empfehlung, kein Versprechen,
// keine feste Frist): „in der Regel", „nach der Zusage der Bank", „meist".
//
// Vorher stand in der Telefonkartei „4–8 Werktage" und bei Mara nichts — wer
// von Justin eine WhatsApp und von Mara eine Mail bekommt, soll dieselbe Zeit
// lesen. Deshalb stehen die Sätze nur hier.
// ═══════════════════════════════════════════════════════════════════════════

// E-IT-B (08.10.2026): Kündigungsregel und Datumsform aus der einen Quelle (Abschnitt unten).
import type { KuendigungPhase } from "./fiaon-kuendigung-regel";
import { tagDe } from "./fiaon-kuendigung-regel";

/** Nach der Aktivierung (erste Zahlung gebucht) geht die Einladung der Partnerbank raus. */
export const KARTE_LINK_SATZ = "Sobald Ihr Account aktiviert ist, bekommen Sie direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag.";

/** Die Zeit bis zur Karte — nie ohne „in der Regel" und „nach der Zusage der Bank". */
export const KARTE_ZEIT_SATZ = "Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist können Sie sie schon vorher in der App der Bank mit Apple Pay nutzen.";

/** Kurzform für enge Texte. */
export const KARTE_ZEIT_KURZ = "in der Regel 2–5 Werktage nach der Zusage der Bank";

// ═══════════════════════════════════════════════════════════════════════════
// WER BEKOMMT DEN LINK DER PARTNERBANK — EINE REGEL (E-IT-B (08.10.2026))
//
// IT-Feedback Punkt 2 und 11. Bis heute standen die Ausschlüsse privat in der
// Automatik (einladungPruefen, server/lib/fiaon-konto-karte.ts); die Liste
// „Bereit für Konto & Karte“, die Akte und der Knopf kannten sie nicht. Die
// Liste bestand am 07.10. zu 97 % aus Gekündigten. Jetzt stehen Reihenfolge,
// Gründe und Sätze HIER — die Server-Abfrage baut ihr CASE in derselben
// Reihenfolge aus dieser Liste (karteAusschlussSql, fiaon-konto-karte.ts), der
// Prüfstand scripts/pruef-it-b.ts vergleicht beide Fassungen.
//
// Entscheidungen Justin, 08.10.2026:
//   · Gekündigt (Regel shared/fiaon-kuendigung-regel.ts) ist für Listen,
//     Automatik und Mara IMMER ein Ausschluss. Von Hand (Mitarbeiter in der
//     Akte) darf der Link bei gekündigtem Paket mit noch laufendem Vertrag
//     geschickt werden — nur auf Wunsch, nie automatisch.
//   · Erneut senden: jeder berechtigte Mitarbeiter, nur die bestehende
//     Einladung mit demselben Link, kein neuer Vorgang, protokolliert,
//     höchstens 3 je Kunde und Tag, mindestens 15 Minuten Abstand.
//   · Eine Sperre bei unserem Mailversand (Brevo) wird NIE automatisch
//     aufgehoben — der Grund steht in der Akte, der Mitarbeiter prüft die
//     Adresse mit dem Kunden und ändert sie.
// Die Werbesperre bleibt bewusst KEIN Ausschluss: Der Link ist Vertragsleistung (E-275).
//
// Nachbesserung nach der Gegenprüfung (08.10.2026) — von Hand wie in der Basis:
//   · Einstufung −1 und Storno (Telefonkartei) sperren Liste, Automatik und
//     Mara, NICHT den Menschen: So war es vor E-IT-B („Die Verwaltung kann
//     Ausgeschlossene weiter von Hand über die Akte senden“), und entschieden
//     ist nur die Kündigung. Neben dem Knopf steht der Grund (karteHandHinweis).
//   · Die Vertriebssperre sperrt auch den Menschen — nicht aus Prinzip, sondern
//     weil die Mail-Tür jede Mail außer der Zugangsmail an einen Menschen mit
//     Vertriebssperre ablehnt (bewerten in fiaon-versand.ts: „Kontaktsperre —
//     kein Versand“). Ein Knopf, der dort scheitert, wäre Fall 3809 von vorn.
//   · Kein Kundensatz verspricht „auf Wunsch“, wo ein Mensch nicht schicken kann
//     (Prüfstand: jeder „auf Wunsch“-Satz gehört zu einem Grund, der den Zweck
//     „mensch“ frei lässt).
// ═══════════════════════════════════════════════════════════════════════════

/** Wofür gefragt wird. „mensch“ = ein Mitarbeiter in der Akte (Knopf), alles andere läuft ohne Menschen. */
export type KarteZweck = "liste" | "automatik" | "mara" | "mensch";

export type KarteAusschlussCode =
  | "test" | "vertriebssperre" | "stufe_minus1" | "global" | "dsgvo" | "gekuendigt" | "vertrag_beendet" | "storniert" | "ohne_email";

/** Was die Regel über einen Menschen wissen muss — die Server-Abfrage liefert genau diese Felder. */
export interface KarteFlags {
  test: boolean;
  vertriebssperre: boolean;
  stufeMinus1: boolean;
  global: boolean;
  dsgvo: boolean;
  /** Wirksam gekündigt (shared/fiaon-kuendigung-regel.ts). */
  gekuendigt: boolean;
  /** Tag der Kündigung (ISO) — nur für den Satz. */
  gekuendigtAm?: string | null;
  /** Nur für den Zweck „mensch“ nötig (vertragsendeLesen) — ohne Angabe gilt „läuft bis zum Ende“. */
  phase?: KuendigungPhase;
  /** Vertragsende „JJJJ-MM-TT“ — nur für den Satz. */
  vertragEnde?: string | null;
  storniert: boolean;
  hatEmail: boolean;
}

/** Die Reihenfolge ist Bedeutung: Der ERSTE zutreffende Grund steht in der Akte. Eine Quelle für TS und SQL. */
export const KARTE_AUSSCHLUSS_REIHENFOLGE: readonly KarteAusschlussCode[] = [
  "test", "vertriebssperre", "stufe_minus1", "global", "dsgvo", "gekuendigt", "storniert", "ohne_email",
];

/** Gründe, die Liste, Automatik und Mara sperren, den MENSCHEN aber nicht (nur auf Wunsch, mit Hinweis). */
export const KARTE_NUR_VON_HAND: readonly KarteAusschlussCode[] = ["stufe_minus1", "storniert"];

/** Der Satz für das Team (Akte, Liste, Mara-Übergabe) — nie an den Kunden. */
export const KARTE_AUSSCHLUSS_TEXT: Record<KarteAusschlussCode, string> = {
  test: "Testkonto",
  vertriebssperre: "Vertriebssperre — der Kunde wollte keinen Kontakt",
  stufe_minus1: "Vom Vertrieb ausgeschlossen (Einstufung −1)",
  global: "Kunde von FIAON Global — keine Post der Privatlinie (E-272)",
  dsgvo: "Daten gelöscht (DSGVO)",
  gekuendigt: "Stufenpaket gekündigt — kein Link aus Liste, Automatik oder Mara",
  vertrag_beendet: "Vertrag beendet — kein Link mehr aus dem Vertrag",
  storniert: "Storniert (Telefonkartei)",
  ohne_email: "Keine E-Mail-Adresse hinterlegt — erst unter „Daten“ eintragen",
};

/**
 * Der Satz für den KUNDEN (Kundenbereich) — Sie-Form, ohne interne Gründe.
 * Gegenprüfung 08.10.: „schickt Ihnen Ihr Ansprechpartner auf Wunsch“ darf nur
 * stehen, wo ein Mensch den Link wirklich schicken darf (Zweck „mensch“ ohne
 * Ausschluss): gekündigt mit laufendem Vertrag, Einstufung −1, Storno. Die
 * Vertriebssperre sperrt auch von Hand (die Mail-Tür lehnt sie ab,
 * fiaon-versand.ts) — dort ein Satz ohne Zusage.
 */
export const KARTE_AUSSCHLUSS_KUNDE: Record<KarteAusschlussCode, string> = {
  test: "Für diesen Zugang gibt es keinen Link der Partnerbank.",
  vertriebssperre: "Zum Link unserer Partnerbank sprechen Sie uns bitte direkt an.",
  stufe_minus1: "Den Link unserer Partnerbank schickt Ihnen Ihr Ansprechpartner auf Wunsch.",
  global: "Der Link unserer Partnerbank gehört zu den Privatpaketen.",
  dsgvo: "Ihre Daten sind auf Ihren Wunsch gelöscht.",
  gekuendigt: "Ihr Vertrag ist gekündigt. Den Link unserer Partnerbank schickt Ihnen Ihr Ansprechpartner bis zum Vertragsende auf Wunsch.",
  vertrag_beendet: "Ihr Vertrag ist beendet — der Link unserer Partnerbank gehörte zu seinen Leistungen.",
  storniert: "Den Link unserer Partnerbank schickt Ihnen Ihr Ansprechpartner auf Wunsch.",
  ohne_email: "Für den Link unserer Partnerbank fehlt noch Ihre E-Mail-Adresse.",
};

export interface KarteAusschluss {
  code: KarteAusschlussCode;
  /** Für das Team. */
  text: string;
  /** Für den Kunden. */
  kundeText: string;
}

/**
 * Der erste Ausschlussgrund für einen Zweck — null, wenn der Link gehen darf.
 * Gekündigt: für Liste, Automatik und Mara immer gesperrt; für den Menschen
 * nur nach dem Vertragsende (Phase „beendet“). Einstufung −1 und Storno
 * sperren den Menschen nicht (KARTE_NUR_VON_HAND). Rein.
 */
export function karteAusschluss(f: KarteFlags, zweck: KarteZweck): KarteAusschluss | null {
  const tag = f.gekuendigtAm ? tagDe(String(f.gekuendigtAm).slice(0, 10)) : null;
  const ende = tagDe(f.vertragEnde ?? null);
  for (const code of KARTE_AUSSCHLUSS_REIHENFOLGE) {
    // Einstufung −1 und Storno: nur von Hand erlaubt (KARTE_NUR_VON_HAND) — für den Menschen kein Ausschluss.
    if (zweck === "mensch" && KARTE_NUR_VON_HAND.includes(code)) continue;
    const trifft = code === "test" ? f.test
      : code === "vertriebssperre" ? f.vertriebssperre
      : code === "stufe_minus1" ? f.stufeMinus1
      : code === "global" ? f.global
      : code === "dsgvo" ? f.dsgvo
      : code === "gekuendigt" ? f.gekuendigt && (zweck !== "mensch" || f.phase === "beendet")
      : code === "storniert" ? f.storniert
      : !f.hatEmail;
    if (!trifft) continue;
    if (code === "gekuendigt") {
      // Nach dem Vertragsende heißt es für jeden Zweck „Vertrag beendet“ — genauer als „gekündigt“.
      const c: KarteAusschlussCode = f.phase === "beendet" ? "vertrag_beendet" : "gekuendigt";
      const genau = c === "vertrag_beendet"
        ? `Vertrag beendet${ende ? ` am ${ende}` : ""}${tag ? ` (gekündigt am ${tag})` : ""} — kein Link mehr aus dem Vertrag`
        : `Stufenpaket gekündigt${tag ? ` am ${tag}` : ""}${ende ? `, Vertrag endet am ${ende}` : ""} — kein Link aus Liste, Automatik oder Mara; von Hand nur auf Wunsch des Kunden`;
      return { code: c, text: genau, kundeText: KARTE_AUSSCHLUSS_KUNDE[c] };
    }
    return { code, text: KARTE_AUSSCHLUSS_TEXT[code], kundeText: KARTE_AUSSCHLUSS_KUNDE[code] };
  }
  return null;
}

/**
 * Der Satz für den KUNDEN, wenn die Automatik ihm den Link nicht schickt — null,
 * wenn sie ihn schickt. Ist der Vertrag beendet, sagt es das zuerst (auch neben
 * einer Vertriebssperre — Gegenprüfung 08.10.: 12 Gekündigte mit Sperre lasen
 * nach dem Vertragsende ein Versprechen). Sonst gilt der Grund, der auch den
 * MENSCHEN sperrt; sperrt keiner den Menschen, der Grund der Automatik
 * (gekündigt, Vertrag läuft: „auf Wunsch“ — das darf der Mensch). Rein.
 */
export function karteKundeSatz(f: KarteFlags): string | null {
  const auto = karteAusschluss(f, "automatik");
  if (!auto) return null;
  if (f.gekuendigt && f.phase === "beendet") return KARTE_AUSSCHLUSS_KUNDE.vertrag_beendet;
  const mensch = karteAusschluss(f, "mensch");
  if (mensch) return mensch.kundeText;
  // Der Mensch darf: Bei einer Kündigung sagt der Satz das (mit „bis zum Vertragsende“), sonst der Grund der Automatik.
  return f.gekuendigt ? KARTE_AUSSCHLUSS_KUNDE.gekuendigt : auto.kundeText;
}

/**
 * Der Hinweis für den Menschen, wenn der Link nur VON HAND gehen darf (gekündigt
 * mit laufendem Vertrag, Einstufung −1, Storno) — er steht neben dem Knopf.
 * null, wenn die Automatik ohnehin schickt oder auch der Mensch nicht darf. Rein.
 */
export function karteHandHinweis(f: KarteFlags): string | null {
  if (karteAusschluss(f, "mensch") || !karteAusschluss(f, "automatik")) return null;
  const teile: string[] = [];
  if (f.gekuendigt && f.phase !== "beendet") {
    const tag = f.gekuendigtAm ? tagDe(String(f.gekuendigtAm).slice(0, 10)) : null;
    const ende = tagDe(f.vertragEnde ?? null);
    teile.push(`Stufenpaket gekündigt${tag ? ` am ${tag}` : ""} — der Vertrag läuft${ende ? ` bis ${ende}` : " bis zum Vertragsende"}.`);
  }
  if (f.stufeMinus1) teile.push("Vom Vertrieb ausgeschlossen (Einstufung −1).");
  if (f.storniert) teile.push("Über die Telefonkartei storniert.");
  if (!teile.length) return null;
  return `${teile.join(" ")} Den Link schickst du nur, wenn der Kunde ihn ausdrücklich möchte; Liste, Automatik und Mara schicken ihn nicht.`;
}

/** Drossel für JEDEN Versand der Einladung an einen Menschen (Akte, Mara, Verwaltung zusammen). */
export const KARTE_ERNEUT = { maxProTag: 3, mindestAbstandMin: 15 } as const;

/** Zustellung (fiaon_mail_log.zustellung, Brevo) in Worten für die Akte. */
export const KARTE_ZUSTELL_TEXT: Record<string, string> = {
  angenommen: "angenommen — Zustellung noch nicht bestätigt",
  zugestellt: "zugestellt",
  geoeffnet: "geöffnet",
  geklickt: "Link geklickt",
  gebounct: "abgewiesen (Rückläufer) — nicht angekommen",
  blockiert: "gesperrt bei unserem Mailversand — nicht angekommen",
  spam: "als Spam gemeldet — gesperrt, nicht angekommen",
  fehler: "Fehler beim Versand — nicht angekommen",
};

/** Zustände, bei denen die Mail NICHT ankam und ein erneuter Versand an dieselbe Adresse nichts bringt. */
export const KARTE_ZUSTELL_PROBLEM: readonly string[] = ["gebounct", "blockiert", "spam"];

// ── WEICHE RÜCKLÄUFER (Gegenprüfung 08.10.2026) ──────────────────────────────
// Brevo meldet softBounces ebenfalls als „gebounct“ (fiaon-brevo.ts). Postfach
// voll, Kontingent erschöpft, Zeitüberschreitung, Greylisting: Die Adresse
// stimmt, ein späterer Versand kommt meist an (gemessen 90 Tage: über 150 solche
// Rückläufer). Endgültig ist ein Rückläufer, wenn das Postfach nicht existiert
// oder die Domain keine Post annimmt — das HART-Muster schlägt das WEICH-Muster.
// Beide Muster sind gültige reguläre Ausdrücke in JavaScript UND PostgreSQL (~*).
export const RUECKLAEUFER_HART_MUSTER =
  "5\\.1\\.[0-9]|does not exist|user unknown|unknown in virtual|no longer on system|mailbox not found|must exist|unable to find mx|invalid mx";
export const RUECKLAEUFER_WEICH_MUSTER =
  "^\\s*4[0-9][0-9]|(^|[^0-9.])4\\.[0-9]+\\.[0-9]+|quota|storage|mailbox( is)? full|postfach voll|timeout|timed out|connection closed|grey ?defer|greylist|temporar|rate-?limit|try again later";

/** Ist dieser Rückläufer nur vorübergehend (Postfach voll, Zeitüberschreitung …)? Ohne Antwort des Postfachs: nein. Rein. */
export function ruecklaeuferWeich(grund: unknown): boolean {
  const g = String(grund ?? "").trim();
  if (!g) return false;
  if (new RegExp(RUECKLAEUFER_HART_MUSTER, "i").test(g)) return false;
  return new RegExp(RUECKLAEUFER_WEICH_MUSTER, "i").test(g);
}

/**
 * Kam die Mail nicht an, und hilft ein erneuter Versand an dieselbe Adresse
 * nichts? Mit `grund` (Antwort des Postfachs) zählt ein weicher Rückläufer
 * NICHT als Problem. Ohne `grund` die engere Lesart. Rein.
 */
export function zustellProblem(zustellung: unknown, grund?: unknown): boolean {
  const z = String(zustellung ?? "");
  if (!KARTE_ZUSTELL_PROBLEM.includes(z)) return false;
  if (z === "gebounct" && grund !== undefined && ruecklaeuferWeich(grund)) return false;
  return true;
}

/**
 * Dieselbe Prüfung in SQL (boolean) — `z` und `g` sind SQL-Ausdrücke für
 * zustellung und zustellung_grund. Ohne Grund die engere Lesart (wie oben).
 * SQL kennt Brevos Sperrliste nicht: Ein weicher Rückläufer gilt hier als
 * zustellbar; vor jedem Versand prüft TypeScript zusätzlich, dass Brevo die
 * Adresse nicht sperrt (zustellLage, fiaon-konto-karte.ts).
 */
export function ZUSTELL_PROBLEM_SQL(z: string, g: string): string {
  const hart = KARTE_ZUSTELL_PROBLEM.filter((x) => x !== "gebounct").map((x) => `'${x}'`).join(", ");
  return `(${z} IN (${hart}) OR (${z} = 'gebounct' AND NOT (COALESCE(${g}, '') ~* '${RUECKLAEUFER_WEICH_MUSTER}' AND COALESCE(${g}, '') !~* '${RUECKLAEUFER_HART_MUSTER}')))`;
}

/** Die Sperre stand im Protokoll, Brevo sperrt die Adresse aber nicht mehr (von der Leitung aufgehoben). */
export const KARTE_SPERRE_AUFGEHOBEN_TEXT = "zuletzt gesperrt — die Sperre bei unserem Mailversand ist inzwischen aufgehoben, erneut senden ist möglich";

/** Der Satz für einen weichen Rückläufer — erneut senden ist erlaubt. */
export const KARTE_ZUSTELL_WEICH_TEXT = "vorübergehend abgewiesen (Postfach voll oder kurz nicht erreichbar) — erneut senden ist möglich";

/** Brevos Sperrgrund (GET /smtp/blockedContacts, reason.code) in Worten. */
export const BREVO_SPERRGRUND_TEXT: Record<string, string> = {
  unsubscribedViaEmail: "Der Empfänger hat sich über den Abmeldelink einer früheren Mail abgemeldet.",
  unsubscribedViaMA: "Der Empfänger hat sich aus einer automatischen Mailstrecke abgemeldet.",
  unsubscribedViaApi: "Die Adresse wurde über die Schnittstelle abgemeldet.",
  adminBlocked: "Die Adresse wurde bei unserem Mailversand von Hand gesperrt.",
  hardBounce: "Die Adresse kam hart zurück — sie existiert nicht oder nimmt keine Mails an.",
  contactFlaggedAsSpam: "Der Empfänger hat eine frühere Mail als Spam gemeldet.",
};

/** Was der Mitarbeiter bei einem Zustellproblem tut — die Sperre heben wir nicht automatisch auf (Justin, 08.10.). */
export const KARTE_ADRESSE_HINWEIS =
  "An diese Adresse stellt unser Mailversand nichts zu. Prüfe die Adresse mit dem Kunden und ändere sie unter „Daten“ — "
  + "dann geht die Einladung an die neue Adresse. Eine Sperre heben wir nicht automatisch auf.";

// ── WENN DIE ADRESSE STIMMT: ABGEMELDET, VON HAND GESPERRT, SPAM (Gegenprüfung 08.10.) ──
// 43 von 46 „Mail kam nicht an“ waren am 08.10. „blockiert“ — überwiegend Abmelder
// (unsubscribedViaEmail), deren Adresse stimmt. Nach einer anderen Adresse zu
// fragen hilft dort nicht. Justin hat nur das AUTOMATISCHE Aufheben verboten:
// Auf ausdrücklichen Wunsch des Kunden prüft die Leitung die Sperre von Hand
// (Akte: „An die Leitung: Sperre prüfen“ → Aufgabe mit Person, Adresse, Grund
// und Kundenwunsch). Mara fragt dann nicht nach einer neuen Adresse, sie übergibt.

/** Brevos Sperrgrund heißt: Die Adresse stimmt vermutlich, der Empfänger will (wollte) keine Post. */
export function brevoAbmeldung(sperrCode: unknown): boolean {
  return /^unsubscribed/i.test(String(sperrCode ?? ""));
}

/** Darf ein Mitarbeiter die Leitung bitten, die Sperre von Hand zu prüfen? Nur bei Sperren, nicht bei Rückläufern. Rein. */
export function karteSperreLeitungMoeglich(zustellung: unknown, problem: boolean): boolean {
  return problem && ["blockiert", "spam"].includes(String(zustellung ?? ""));
}

/** Was der Mitarbeiter bei einem Zustellproblem tut — je nach Brevos Grund. Rein. */
export function karteAdresseHinweis(zustellung: unknown, sperrCode?: unknown): string {
  const c = String(sperrCode ?? "");
  if (brevoAbmeldung(c)) {
    return "Die Adresse stimmt vermutlich — der Kunde hat sich bei unserem Mailversand abgemeldet. Nennt er eine andere Adresse, "
      + "ändere sie unter „Daten“. Will er die Post an DIESE Adresse ausdrücklich wieder, prüft die Leitung die Sperre von Hand "
      + "(„An die Leitung: Sperre prüfen“) — automatisch heben wir sie nie auf.";
  }
  if (c === "contactFlaggedAsSpam" || String(zustellung ?? "") === "spam") {
    return "Der Kunde hat eine frühere Mail als Spam gemeldet. Will er die Post ausdrücklich wieder, prüft die Leitung die Sperre "
      + "von Hand („An die Leitung: Sperre prüfen“); sonst mit ihm eine andere Adresse unter „Daten“ eintragen.";
  }
  if (c === "adminBlocked" || (String(zustellung ?? "") === "blockiert" && !c)) {
    return "Die Adresse ist bei unserem Mailversand gesperrt. Prüfe sie mit dem Kunden: Stimmt sie nicht, ändere sie unter „Daten“; "
      + "stimmt sie und will er die Post dorthin, prüft die Leitung die Sperre von Hand („An die Leitung: Sperre prüfen“).";
  }
  return KARTE_ADRESSE_HINWEIS;
}

/**
 * Der Satz für den Kunden (Mara), wenn die Tagesgrenze der Einladung erreicht ist
 * (KARTE_ERNEUT.maxProTag) — E-IT-B Fertigstellung (08.10.2026, Befund 8b): Vorher
 * sagte Mara „gerade erst geschickt“, obwohl der letzte Versand Stunden zurückliegen
 * und von einem Mitarbeiter stammen konnte. `an` = „ an m***@…“ oder leer.
 */
export function karteHeuteSchonSatz(an: string): string {
  return `Den Link unserer Partnerbank für Ihren Kartenantrag haben wir Ihnen heute bereits per E-Mail${an} geschickt — `
    + "schauen Sie bitte auch im Spam-Ordner nach. Kommt er nicht an, schicke ich ihn Ihnen morgen gern noch einmal.";
}

/** Der Satz für den Kunden, wenn seine Adresse gesperrt ist (Mara) — fragt nach der richtigen Adresse, verspricht nichts. */
export const KARTE_ADRESSE_KUNDE =
  "An Ihre hinterlegte E-Mail-Adresse kommen unsere Mails derzeit leider nicht an. "
  + "Schreiben Sie mir bitte die E-Mail-Adresse, unter der Sie Post von uns bekommen möchten — "
  + "dann geht der Link unserer Partnerbank für Ihren Kartenantrag dorthin.";

// ── „KONTO & KARTE — NACHFASSEN“ STATT „BEREIT“ (E-IT-B, Punkt 11) ────────
// Seit E-206 lädt die Automatik binnen Minuten ein; „bereit, aber noch ohne
// Einladung“ ist deshalb fast immer leer. Die Liste zeigt jetzt, wo ein Mensch
// etwas tun kann — mit derselben Ausschlussregel (keine Gekündigten).

export type KarteNachfassZustand = "bereit" | "frist" | "nicht_angekommen" | "nicht_geklickt";

/** Nach so vielen Tagen ohne Klick auf den Link ist ein Anruf fällig. */
export const KARTE_NICHT_GEKLICKT_TAGE = 5;

export const KARTE_NACHFASSEN: Record<KarteNachfassZustand, { marke: string; satz: string }> = {
  nicht_angekommen: {
    marke: "Mail kam nicht an",
    satz: "Die Einladung ist nicht angekommen — Adresse mit dem Kunden prüfen, unter „Daten“ ändern, dann erneut senden. "
      + "Stimmt die Adresse (abgemeldet), entscheidet auf seinen Wunsch die Leitung (Akte: „An die Leitung: Sperre prüfen“).",
  },
  nicht_geklickt: {
    marke: "Eingeladen, nicht geklickt",
    satz: `Seit mindestens ${KARTE_NICHT_GEKLICKT_TAGE} Tagen eingeladen, der Link ist nicht geklickt und kein Konto gemeldet — anrufen und durch den Antrag begleiten.`,
  },
  bereit: {
    marke: "Bereit",
    satz: "Antrag vollständig, erste Zahlung gebucht — die Einladung geht mit dem nächsten Takt automatisch raus.",
  },
  frist: {
    marke: "Wartet auf Widerrufsfrist",
    satz: "Kein sofortiger Beginn verlangt — die Einladung geht nach Ablauf der Widerrufsfrist von selbst raus. Nur zur Information.",
  },
};

/** Reihenfolge in Listen: was ein Mensch tun muss, zuerst. */
export const KARTE_NACHFASSEN_REIHENFOLGE: readonly KarteNachfassZustand[] = ["nicht_angekommen", "nicht_geklickt", "bereit", "frist"];
