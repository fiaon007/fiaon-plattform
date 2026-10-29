// ═══════════════════════════════════════════════════════════════════════════
// EINE WAND FÜR ALLE KUNDENTEXTE (02.09.2026, E-094)
//
// Bis heute gab es drei Listen an drei Orten: `entschaerfen` in der Mail-KI
// (11 Muster), `verboteneKundenworte` im Copilot (7 Muster, ohne Wortgrenzen)
// und sechs Teilstrings im Postmeister. Die schwächste davon stand vor den
// automatischen Antworten — 'wir garantieren Ihnen die Karte' wäre
// durchgegangen. Ab hier prüft jeder Kundentext dieselbe Wand.
//
// DREI ARTEN VON TREFFERN:
//   verboten   → darf nie an einen Kunden gehen (Rechtsrisiko, Falschaussage)
//   floskel    → macht die Antwort unpersönlich; wird umformuliert
//   zusage     → verspricht eine Handlung; nur erlaubt, wenn ein Werkzeug sie
//                im selben Lauf wirklich ausgeführt hat
//
// WORTGRENZEN SIND PFLICHT: `/berat/` traf früher auch das Kundenzitat 'Sie
// hatten mir geraten…'. Jedes Muster hier steht auf \b oder auf einer Phrase.
// ═══════════════════════════════════════════════════════════════════════════

export type Verstossart = "verboten" | "floskel" | "zusage";

export interface Wortregel {
  muster: RegExp;
  art: Verstossart;
  /** Was stattdessen gesagt werden soll — geht als Hinweis zurück ans Modell. */
  hinweis: string;
  /** Nur bei art "zusage": Welches Werkzeug die Zusage decken muss. */
  gedecktDurch?: string[];
  /**
   * Nachbesserung E-248: Dieser Treffer ist KEINE Zusage (z. B. eine echte Frage oder
   * „keinen Rückruf"). Bekommt den Satz des Treffers und den Text direkt davor. Ohne
   * Lookbehind — der läuft auf Safari unter 16.4 nicht (die Datei ist auch im Browser).
   */
  keineZusage?: (satz: string, davor: string) => boolean;
  /**
   * E-393: Eine Regel, die ein Muster allein nicht fassen kann (mehrere Bedingungen im selben Satz). `muster` ist
   * dann nur der grobe Vorfilter; es zählt nur, wenn `pruefe` einen Satz zurückgibt — der wird zum Treffer.
   */
  pruefe?: (text: string) => string | null;
}

/**
 * Eine echte Frage BEGINNT als Frage („Soll Florentine Sie morgen anrufen?", „Welche Zeit
 * passt Ihnen für den Rückruf?") — ein angehängtes „…, passt Ihnen das?" macht aus einer
 * Zusage keine Frage (Gegenprobe wand.mts). Rein.
 */
export function istEchteFrage(satz: string): boolean {
  const s = String(satz || "").trim();
  return /\?\s*$/.test(s) && /^(?:[„"»(]\s*)?(?:soll|sollen|sollte|möchten|moechten|möchtest|wollen|willst|welche[rsnm]?|wann|wie|wo|darf|dürfen|duerfen|passt|kann|können|koennen|könnte|koennte|wäre|waere|hätten|haetten|haben|ist|sind|gibt|brauchen)\b/i.test(s);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KÜNDIGUNG HÄNGT NIE AN EINER ZAHLUNG — UND MARA DROHT NIE (16.10.2026, E-393)
//
// Anlass: Der Postmeister schrieb einem Kunden, der am 27.08. widerrufen hatte (Person 12314), am 08.09.
// „Ohne die offene Rate 2 über 59,99 € können wir den Vertrag nicht beenden“ und „Bleibt die Zahlung aus,
// übergeben wir die Forderung an das für Püttlingen zuständige Amtsgericht“. Die Nachprüfung aller seit dem
// 01.09. gesendeten Antworten fand 153 solche Kopplungssätze und 79 Gerichtsdrohungen an 68 Kunden (05.–29.09.),
// 43 davon an einen einzigen. Seit dem 29.09. kam keiner mehr — aber nur, weil der Prompt es inzwischen anders
// sagt; die Härte-Stufe verlangte die Drohung weiter, das Hauswissen beschrieb das Kündigungsschreiben „sobald
// die letzte Rate eingegangen ist“, und keine Wand kannte die Form.
//
// Recht: Eine Kündigung ist eine einseitige Erklärung und wirkt ohne unser Zutun (§ 312k BGB); ihre Wirkung
// und ihre Bestätigung dürfen nie von einer Zahlung abhängen. Offene Raten bis zum Vertragsende dürfen wir
// einfordern — aber nicht als Bedingung für das Ende und in einer Antwort auf Kündigung oder Widerruf ohne
// Drohung mit Gericht, Anwalt, Inkasso oder SCHUFA (Justins Regel 01.10., Memory offene-rechnung-vor-kuendigung).
// Frei bleibt der Kulanz-Ausstieg aus dem Jahresvertrag („Begleichen Sie die offene Rate, dann lasse ich Sie aus
// Kulanz aus dem Vertrag“) — außer beim Widerruf.
//
// Geeicht an den 565 gesendeten Antworten mit Vertrags- oder Drohwort seit 01.09.: Jeder Treffer ist ein echter
// Kopplungs- bzw. Drohsatz; „Ihre Kündigung bleibt davon unberührt“, „Ihr Anwalt kann uns schreiben“, „weil Sie
// rechtliche Schritte genannt haben“, „Eine bestrittene Forderung melden wir nicht an Auskunfteien“ bleiben frei.
// Ohne Lookbehind (die Datei läuft auch im Browser, Safari < 16.4).
// ═══════════════════════════════════════════════════════════════════════════

/** Was das Modell stattdessen sagt (Kopplung). */
export const KOPPLUNG_HINWEIS = "Das Vertragsende hängt nie an einer Zahlung (§ 312k BGB, E-393): Die Kündigung wirkt ohne unser Zutun, ihre Bestätigung auch. Nie „ohne die Rate können wir den Vertrag nicht beenden“, „erst nach Zahlung“, „sobald die Zahlung eingeht, kommt das Kündigungsschreiben / ist der Vertrag beendet“, „der Vertrag läuft bis zur Zahlung“. Sag: Die Kündigung gilt zum <Datum aus der Akte>, unabhängig von der Zahlung; die bis dahin fällige Rate bleibt zu zahlen.";
/** Was das Modell stattdessen sagt (Drohung). */
export const DROHUNG_HINWEIS = "In einer Antwort zu Kündigung oder Widerruf droht Mara nie (E-393): kein Gericht, kein Mahnbescheid, kein Inkasso, kein Anwalt, keine SCHUFA-Meldung, keine „rechtlichen Schritte“, keine Kosten, kein „bevor etwas eskaliert“. Nenne sachlich, was bis zum Vertragsende zu zahlen ist, mit Betrag und Zahlungsseite — über weitere Schritte entscheidet die Leitung (eskalation_vorbereiten, ohne es anzukündigen).";
/** Der Satz, den der Server für einen Kopplungssatz einsetzt, wenn auch der zweite Entwurf ihn hält. */
export const KOPPLUNG_ERSATZ = "Ihre Kündigung hängt nicht an einer Zahlung — sie gilt auch, solange noch eine Rate offen ist.";
/** Beim Widerruf: der Satz aus der Widerrufsregel des Postmeisters. */
export const WIDERRUF_ERSATZ = "Ihren Widerruf prüft unsere Geschäftsführung; Sie bekommen dazu eine schriftliche Nachricht.";
/**
 * E-396 (19.10.2026): Beim Vertrag vor dem 03.09.2026 gibt es keinen Kulanz-Ausstieg gegen Zahlung — die Kündigung ist
 * sein Recht und gilt zum Ende seines Abrechnungsmonats (§ 5 UWG: kein „Kulanz“ für ein bestehendes Recht).
 */
export const ALTVERTRAG_KULANZ_HINWEIS = "Sein Vertrag ist vor dem 03.09.2026 geschlossen (monatlich kündbar): KEIN Kulanz-Ausstieg gegen Zahlung — die Kündigung gilt zum Ende seines Abrechnungsmonats, unabhängig von der Zahlung; offene Raten bis dahin nennst du als eigenen Satz.";

/** Die Sätze eines Kundentexts. Datum („15.10.2026“) und Betrag trennen nicht. Rein. */
export function kundenSaetze(text: string): string[] {
  const t = String(text || "").replace(/\r/g, "");
  const aus: string[] = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "." && /\d/.test(t[i - 1] || "") && /\d/.test(t[i + 1] || "")) continue;
    if (c === "." || c === "!" || c === "?" || c === "\n") {
      const s = t.slice(start, i + 1).trim();
      if (s) aus.push(s);
      start = i + 1;
    }
  }
  const rest = t.slice(start).trim();
  if (rest) aus.push(rest);
  return aus;
}

// ── 1. KOPPLUNG: Zahlung als Bedingung + Ende als Folge, oder „können wir nicht beenden“ mit Zahlung ──────
/** „unabhängig von der Zahlung“, „davon unberührt“ — die richtige Aussage; wird vor der Prüfung herausgenommen. */
const UNABHAENGIG = /unabh(?:ä|ae)ngig\s+(?:davon|von\s+(?:\S+\s+){0,3}?(?:zahlung\w*|rate\w*|betr(?:a|ä)g\w*|begleichung|ausgleich))|auch\s+ohne\s+(?:\S+\s+){0,2}?(?:zahlung\w*|rate\w*)|h(?:ä|ae)ngt\s+(?:\S+\s+){0,3}?nicht\s+(?:\S+\s+){0,3}?(?:zahlung\w*|rate\w*)|nicht\s+von\s+(?:\S+\s+){0,3}?(?:zahlung\w*|rate\w*)\s+abh(?:ä|ae)ngig|(?:davon\s+)?unber(?:ü|ue)hrt|ungeachtet\s+(?:\S+\s+){0,3}?(?:zahlung\w*|rate\w*)|regardless\s+of\s+(?:\S+\s+){0,3}?payment|independent(?:ly)?\s+of\s+(?:\S+\s+){0,3}?payment/gi;
const ZAHLUNG = /\b(?:zahlung\w*|zahlen|zahlt|gezahlt|bezahl\w*|begleich\w*|beglichen|(?:ü|ue)berweis\w*|zahlungseingang\w*|geldeingang\w*|rate|raten|ratenzahlung|rechnung\w*|betrag|forderung\w*|ausgleich\w*|ausgeglichen|verbucht|r(?:ü|ue)ckstand\w*|offene\s+posten|payment|pay|paid|instal?ments?|invoice)\b|\beingang\s+(?:der|ihrer|ihres|des)\s+(?:zahlung|(?:ü|ue)berweisung|rate|betrag\w*|geld\w*)/i;
/**
 * Die Zahlung als Bedingung oder Zeitpunkt — das Zahlwort steht IM Bedingungsteil („sobald die Zahlung …“), nicht
 * irgendwo im Satz: „…, sobald wir die Kündigung gebucht haben“ ist keine Kopplung (Bestätigungsmail, Repo-Abgleich).
 * „Ohne offene Rate …“ heißt „es ist nichts offen“ und bleibt frei.
 */
const ZW = String.raw`(?:zahlung\w*|zahlen|zahlt|gezahlt|bezahl\w*|begleich\w*|beglichen|(?:ü|ue)berweis\w*|geldeingang\w*|rate\w*|rechnung\w*|betr(?:a|ä)g\w*|forderung\w*|ausgleich\w*|ausgeglichen|verbucht|r(?:ü|ue)ckstand\w*|payment|pay|paid|instal\w*|invoice\w*|settle\w*)`;
const BEDINGUNG = new RegExp([
  String.raw`\b(?:sobald|solange|bevor|erst\s+(?:wenn|nach|mit|sobald|dann|bei|ab)|nur\s+(?:wenn|nach|mit|bei|sofern|gegen))\s+(?:\S+\s+){0,6}?${ZW}\b`,
  String.raw`\bwenn\s+(?:\S+\s+){0,6}?(?:bezahlt|beglichen|gezahlt|eingegangen|eingeht|verbucht|gebucht|ausgeglichen|bezahlen|begleichen|(?:ü|ue)berweisen)\b`,
  String.raw`\bnach(?:dem)?\s+(?:\S+\s+){0,2}?(?:zahlung\w*|zahlungseingang|eingang|begleichung|ausgleich|(?:ü|ue)berweisung|bezahlung)\b`,
  String.raw`\bmit\s+(?:dieser|der|ihrer|diesen|den|ihren|vollst(?:ä|ae)ndiger)\s+(?:\S+\s+)?(?:zahlung\w*|begleichung|rate)\b`,
  String.raw`\bohne\s+(?!(?:offene|fällige|faellige|weitere|ausstehende)\b)(?:\S+\s+){0,4}?(?:zahlung\w*|rate\w*|betr(?:a|ä)g\w*|begleichung|ausgleich|rechnung\w*)\b`,
  String.raw`\bbis\s+(?:\S+\s+){0,5}?(?:bezahlt|beglichen|gezahlt|zahlung\w*|zahlungseingang|buchung|eingegangen|eingeht|ausgeglichen)\b`,
  String.raw`\bl(?:ä|ae)uft\s+(?:\S+\s+){0,2}?bis\s+dahin\b`,
  // „Bitte begleichen Sie Ihre offene Rate, dann lasse ich Sie aus dem Vertrag“ — die Bitte ist die Bedingung.
  String.raw`\b(?:zahlen|bezahlen|begleichen|(?:ü|ue)berweisen)\s+sie\b[^.!?;]{0,100}?\bdann\b`,
  String.raw`voraus(?:setzung|gesetzt|setzt|zusetzen)\b|\bsetz\w*\s+(?:\S+\s+){0,12}?voraus\b|\bbedingung\b|\babh(?:ä|ae)ngig\b`,
  String.raw`\b(?:once|until|unless|only\s+(?:after|when|once|if)|without|before|as\s+soon\s+as)\s+(?:\S+\s+){0,6}?${ZW}\b`,
].join("|"), "i");
/** Die Folge, die nie an einer Zahlung hängen darf: Ende, Kündigung, ihre Bestätigung, Weiterlaufen.
 * 22.10.2026 (Prüf-Mara-Kalibrierung, Nebenfund): auch „Die Kündigung gilt erst, wenn …“ (nur mit „erst“ — „sie gilt auch, solange …“ bleibt frei) und „Wir bestätigen die Kündigung, sobald …“. */
const ENDE_FOLGE = /\b(?:vertrag\w*|k(?:ü|ue)ndigung\w*|widerruf\w*|abo\w*|mitgliedschaft)\b(?:\s+\S+){0,8}?\s+(?:beendet|endet|enden|aufgel(?:ö|oe)st|aufgehoben|abgeschlossen|wirksam|best(?:ä|ae)tigt|erledigt|storniert|gek(?:ü|ue)ndigt|l(?:ä|ae)uft|laufen|weiterl(?:ä|ae)uft|bestehen\s+bleibt|bleibt\s+bestehen|bleibt\s+aktiv|g(?:ü|ue)ltig)\b|\b(?:k(?:ü|ue)ndigung\w*|vertrag\w*|vertragsende|beendigung)\b(?:\s+\S+){0,4}?\s+(?:gilt|gelten)\s+(?:\S+\s+){0,2}?erst\b|\bbest(?:ä|ae)tigen\s+(?:wir\s+|ich\s+)?(?:\S+\s+){0,3}?(?:k(?:ü|ue)ndigung|vertragsende|beendigung)\b|\b(?:endet|beendet|l(?:ä|ae)uft)\s+(?:\S+\s+){0,3}?(?:ihr|der|ihr\s+laufender)?\s*vertrag\b|\bk(?:ü|ue)ndigungs(?:schreiben|best(?:ä|ae)tigung\w*|urkunde)|\babschlussbest(?:ä|ae)tigung|\bbest(?:ä|ae)tigung\s+(?:\S+\s+){0,4}?(?:k(?:ü|ue)ndigung|beendigung|vertragsende|widerruf\w*)|\bbeendigung\b|\bvertragsende\b|\b(?:vertrag|k(?:ü|ue)ndigung)\s+(?:\S+\s+){0,3}?(?:beenden|aufl(?:ö|oe)sen|best(?:ä|ae)tigen|annehmen|abschlie(?:ß|ss)en|bearbeiten|vormerken|durchf(?:ü|ue)hren)\b|\baus\s+dem\s+vertrag\b|\bk(?:ü|ue)ndigen\s+wir\b|\bstornieren\s+wir\b|\bk(?:ü|ue)ndige\s+ich\b|\b(?:contract|subscription|cancell?ation|termination)\b(?:\s+\S+){0,6}?\s+(?:ends?|ended|terminat\w*|effective|confirm\w*|cancell?ed|closed|runs|continues)\b|\b(?:end|terminate|cancel|close)\s+(?:\S+\s+){0,2}?(?:contract|subscription)\b/i;
/** „können wir den Vertrag nicht beenden“ — die Gruppe ist das Verb. */
const VERNEINT_WIR = /\b(?:k(?:ö|oe)nnen|kann|d(?:ü|ue)rfen|darf|werden|wird|m(?:ö|oe)chten)\s+(?:wir|ich)\s+(?:\S+\s+){0,8}?nicht\s+(?:\S+\s+){0,4}?(beenden|k(?:ü|ue)ndigen|aufl(?:ö|oe)sen|aufheben|entlassen|stornieren|best(?:ä|ae)tigen|annehmen|bearbeiten|akzeptieren|vormerken|durchf(?:ü|ue)hren|abschlie(?:ß|ss)en|freigeben|tun)\b|\b(?:cannot|can't|can\s+not|won't|will\s+not|unable\s+to)\s+(?:\S+\s+){0,3}?(cancel|terminate|end|close|confirm|process)\b/i;
/** Verben, die schon selbst das Ende meinen; bei den übrigen („bestätigen“) muss Vertrag oder Kündigung im Satz stehen. */
const ENDE_VERB = /^(?:beenden|k(?:ü|ue)ndigen|aufl(?:ö|oe)sen|aufheben|entlassen|stornieren)$/i;
const ENDE_OBJEKT = /\b(?:vertrag\w*|k(?:ü|ue)ndigung\w*|widerruf\w*|storno\w*|abo\w*|mitgliedschaft|beendigung|contract|subscription|cancell?ation|termination)\b/i;
/** „Eine Kündigung ist erst nach Zahlung möglich“, „… bei offenen Rechnungen nicht möglich“. */
const ENDE_NICHT_MOEGLICH = /\b(?:k(?:ü|ue)ndigung|beendigung|vertragsende|storno|widerruf|aufl(?:ö|oe)sung)\w*\s+(?:\S+\s+){0,6}?(?:nicht|erst|nur)\s+(?:\S+\s+){0,6}?(?:m(?:ö|oe)glich|wirksam|g(?:ü|ue)ltig|best(?:ä|ae)tigt|angenommen|bearbeitet|akzeptiert|durchgef(?:ü|ue)hrt)\b/i;
/**
 * Beim verneinten Ende muss die Zahlung der GRUND sein („ohne die Rate“, „solange … offen“, „bei offenen Rechnungen“) —
 * „Eine Kündigung nach der ersten Zahlung ist nicht gebucht, deshalb kann ich sie nicht rückwirkend bestätigen“ ist keine Kopplung.
 */
const GRUND_ZAHLUNG = new RegExp([
  String.raw`\b(?:ohne|without|unless|until|before)\s+(?:\S+\s+){0,4}?${ZW}\b`,
  String.raw`\b(?:solange|bevor|erst\s+(?:wenn|nach|mit|sobald)|nur\s+(?:wenn|nach|mit|gegen|bei))\s+(?:\S+\s+){0,6}?(?:${ZW}|offen\w*|unbezahlt\w*)`,
  String.raw`\b(?:weil|da|denn)\s+(?:\S+\s+){0,6}?(?:offen\w*|unbezahlt\w*|aussteh\w*|nicht\s+(?:bezahlt|beglichen|gezahlt|eingegangen))`,
  String.raw`\b(?:bei|wegen)\s+(?:\S+\s+){0,2}?(?:offen\w*|unbezahlt\w*|aussteh\w*)`,
].join("|"), "i");
/** Der Kulanz-Ausstieg aus dem Jahresvertrag darf an die offene Rechnung gebunden sein (Justin 01.10.2026) — nie beim Widerruf. */
const KULANZ = /\bkulanz\w*|\bvorzeitig\w*|\bgoodwill\b|\bearly\s+(?:exit|release|termination)\b/i;
/** E-396: die Zahlung im Kulanz-Satz („bezahlen“, „begleichen“, „Zahlung“ …). */
const KULANZ_ZAHLT = /\b(?:bezahl\w*|begleich\w*|beglichen|(?:ü|ue)berweis\w*|zahlung\w*|zahlen|zahlt|pay|paid|payment)\b/i;

/** Kundenzitat „…“ / "…" gehört nicht uns — bleibt außen vor. */
function ohneZitate(s: string): string {
  return s.replace(/„[^“”"]{0,300}[“”"]/g, " ").replace(/"[^"]{0,300}"/g, " ").replace(/»[^«]{0,300}«/g, " ");
}

function endeVerneint(s: string): boolean {
  if (!GRUND_ZAHLUNG.test(s)) return false;
  const m = s.match(VERNEINT_WIR);
  if (m && (ENDE_VERB.test(String(m[1] || m[2] || "")) || ENDE_OBJEKT.test(s))) return true;
  return ENDE_NICHT_MOEGLICH.test(s);
}

/**
 * Der erste Satz, der das Vertragsende, die Kündigung oder ihre Bestätigung an eine Zahlung knüpft — sonst null.
 * `widerruf`: Antwort auf einen Widerruf — dann gilt auch die Kulanz-Ausnahme nicht.
 * `ohneKulanz` (E-396): Vertrag vor dem 03.09.2026 — dort gibt es keinen Kulanz-Ausstieg, die Ausnahme gilt nicht. Rein.
 */
export function kopplungFinden(text: string, opt: { widerruf?: boolean; ohneKulanz?: boolean } = {}): string | null {
  // Ein Semikolon trennt zwei Aussagen („Die Rate bleibt offen; Ihre Kündigung gilt zum …“) — jede wird für sich
  // geprüft, der Treffer ist der ganze Satz.
  const saetze: string[] = [];
  const ganz: string[] = [];
  for (const satz of kundenSaetze(text)) for (const teil of satz.split(/;\s*/)) if (teil.trim()) { saetze.push(teil.trim()); ganz.push(satz); }
  for (let i = 0; i < saetze.length; i++) {
    const roh = ganz[i];
    const s = ohneZitate(saetze[i]).replace(UNABHAENGIG, " ");
    // „…; der Vertrag läuft bis dahin weiter“ — das „dahin“ ist die Zahlung aus dem Teil davor.
    if (!ZAHLUNG.test(s) && !(/\bbis\s+dahin\b/i.test(s) && ZAHLUNG.test(ohneZitate(roh)))) continue;
    // E-396 (19.10.2026): Beim Altvertrag und beim Widerruf gibt es KEINEN Kulanz-Ausstieg gegen Zahlung. Ein Satz mit
    // „Kulanz“, einer Zahlung und dem Vertragsende ist dort immer eine Kopplung — auch wenn das Bedingungswort weiter weg
    // steht, als BEDINGUNG greift („Wenn Sie die offene Rechnung über 59,99 € bezahlen, entlassen wir Sie aus Kulanz
    // vorzeitig aus dem Vertrag …“ — sieben Wörter zwischen „wenn“ und „bezahlen“). Nur das Wort „Kulanz“ zählt hier
    // („vorzeitig“ allein steht auch in einer Widerrufsantwort).
    if ((opt.widerruf || opt.ohneKulanz) && /\bkulanz\w*/i.test(s) && KULANZ_ZAHLT.test(s) && ENDE_FOLGE.test(s)) return roh.slice(0, 160);
    const verneint = endeVerneint(s);
    // „Das geht erst nach der Zahlung.“ — das „das“ meint die Kündigung im Satz davor.
    const bezugDavor = i > 0 && /^(?:das|dies|diese|dieser|sie|es)\s+(?:\S+\s+){0,2}?(?:geht|klappt|funktioniert|machen|erledigen|passiert|gilt|ist\s+(?:\S+\s+)?m(?:ö|oe)glich|wird\s+(?:\S+\s+)?wirksam)\b/i.test(s.trim())
      && (ENDE_FOLGE.test(ohneZitate(saetze[i - 1])) || ENDE_OBJEKT.test(ohneZitate(saetze[i - 1])));
    if (!verneint && !(BEDINGUNG.test(s) && (ENDE_FOLGE.test(s) || bezugDavor))) continue;
    if (!verneint && !opt.widerruf && !opt.ohneKulanz && KULANZ.test(s)) continue;
    // Der Kunde stellt die Bedingung selbst („weil Sie schreiben, dass Sie erst nach der Überweisung kündigen möchten“).
    if (!verneint && /\b(?:sie|you)\s+(?:\S+\s+){0,3}?(?:schreiben|schrieben|m(?:ö|oe)chten|wollen|wrote|want)\b[^.!?]{0,80}\bk(?:ü|ue)ndigen\b/i.test(s)) continue;
    return roh.slice(0, 160);
  }
  return null;
}

// ── 2. DROHUNG: Gericht, Inkasso, Anwalt, SCHUFA-Meldung, „rechtliche Schritte“, Kosten, Eskalation ─────────
// Was der Kunde selbst tut („Ihr Anwalt kann uns schreiben“, „weil Sie rechtliche Schritte genannt haben“) und
// was verneint wird („kein Inkasso“, „melden wir nicht an Auskunfteien“) ist keine Drohung. „Insolvenzgericht“
// bleibt frei (kein Wortanfang vor „gericht“), „Pfändung“ auch (meist seine eigene Lage), ebenso die Sprache des
// Produkts: „Ihre negativen Einträge“, „Inkassokosten-Prüfer“, „titulierte Forderungen“, „Betreibungsregister“.
const DROH_IMMER = /\b(?:amts|bezirks|land|zivil|mahn)?gericht(?:e|en|es|s)?\b|\bgerichtlich\w*|\bmahnbescheid\w*|\bmahnverfahren\w*|\bgerichtsvollzieh\w*|\b(?:zwangs)?vollstreck\w*|\bbetreibungsamt\w*|\bbetreibung\s+(?:\S+\s+){0,2}?(?:einleiten|er(?:ö|oe)ffnen)|\bklage\b|\bverklag\w*|\beinklag\w*|\beintreibung\w*|\beintreiben\b|\bcourt\b|\bdebt\s+collect\w*|\bcollection\s+agenc\w*|\bbailiff\w*|\blegal\s+action\b|\bsue\b|\blawsuit\b/i;
/** Inkasso und Forderungsmanagement als Weitergabe — „Inkassokosten-Prüfer“ und „Ihre Inkasso-Einträge“ sind Produkt. */
const DROH_INKASSO = /\b(?:an|ans|zum|zur|einem?|ein)\s+(?:\S+\s+)?(?:inkasso\w*|forderungsmanagement)|\b(?:inkasso\w*|forderungsmanagement)\s+(?:\S+\s+){0,3}?(?:(?:ü|ue)bergeben|beauftragen|einschalten|weitergeben|abgeben|geben)\b|\b(?:(?:ü|ue)bergeben|weitergeben|abgeben|beauftragen|einschalten)\s+(?:\S+\s+){0,6}?(?:inkasso\w*|forderungsmanagement)/i;
/** Eskalation als Ankündigung — „bevor etwas eskaliert“, „eskalieren wir“. */
const DROH_ESKALATION = /\bbevor\s+(?:\S+\s+){0,2}?eskal\w*|\beskalieren\s+wir\b|\bwir\s+(?:\S+\s+){0,3}?eskalieren\b|\beskalation\w*\s+(?:\S+\s+){0,2}?(?:droht|drohen|vermeiden|einleiten)\b/i;
const DROH_ANWALT = /\bunser(?:e|en|em|er)?\s+(?:rechts)?anw(?:a|ä|ae)lt\w*|\b(?:an|einen|ein|den|die|zum)\s+(?:rechts)?anw(?:a|ä|ae)lt\w*\s+(?:\S+\s+){0,3}?(?:(?:ü|ue)bergeben|weitergeben|einschalten|beauftragen|geben|abgeben)\b|\b(?:(?:ü|ue)bergeben|weitergeben|geben|schalten|beauftragen|einschalten)\s+(?:\S+\s+){0,6}?(?:rechts)?anw(?:a|ä|ae)lt\w*|\banwaltlich\w*\s+(?:schritte|mahnung|vertretung|geltend|durchsetz\w*|vorgehen|beitreib\w*)|\bour\s+(?:lawyer|attorney|solicitor)s?\b/i;
/** Die SCHUFA als Folge: melden, eintragen, „droht ein Eintrag“ — „Ihre negativen Einträge“ ist Produkt. */
const DROH_SCHUFA = /\b(?:an|bei)\s+(?:die\s+)?(?:schufa|auskunftei\w*|creditreform|crif|boniversum|ksv)\s+(?:\S+\s+){0,2}?(?:melden|(?:ü|ue)bermitteln|weitergeben|eintragen)\b|\b(?:melden|(?:ü|ue)bermitteln|weitergeben|eintragen)\s+(?:\S+\s+){0,5}?(?:an|bei)\s+(?:die\s+)?(?:schufa|auskunftei\w*)|\b(?:schufa|auskunftei\w*)\s+(?:\S+\s+){0,3}?(?:gemeldet|eingetragen|(?:ü|ue)bermittelt)\b|\b(?:droht|drohen|riskieren|folgt|f(?:ü|ue)hrt\s+zu|bekommen\s+sie|erhalten\s+sie)\s+(?:\S+\s+){0,3}?(?:negativ\w*\s+)?(?:schufa\w*[-\s]*)?eintr(?:a|ä)g\w*|\bschufa\w*[-\s]*(?:eintrag|meldung)\w*\s+(?:\S+\s+){0,3}?(?:droht|drohen|folgt|riskieren)\b|\breport\w*\s+(?:\S+\s+){0,3}?(?:credit\s+(?:bureau|reference))/i;
const DROH_RECHTLICH = /\brechtlich\w*\s+(?:schritte|weg\w*|vorgehen|konsequenzen|ma(?:ß|ss)nahmen)|\brechtsweg\w*|\bjuristisch\w*\s+(?:schritte|vorgehen|konsequenzen)/i;
const DROH_KOSTEN = /\bkosten\s+(?:\S+\s+){0,4}?(?:tragen|(?:ü|ue)bernehmen|zahlen)\s+(?:dann\s+)?sie\b|\b(?:zus(?:ä|ae)tzlich\w*|weitere)\s+(?:kosten|geb(?:ü|ue)hren)\s+(?:\S+\s+){0,4}?(?:entstehen|kommen|anfallen)/i;

/** Verneint direkt davor („kein Inkasso“, „nicht an ein Gericht“) — keine Drohung. */
function verneintDavor(s: string, index: number): boolean {
  const davor = s.slice(Math.max(0, index - 30), index).toLowerCase();
  return /(?:\bkein(?:e|en|em|er)?|\bnichts\s+(?:an|ans|zum|zu|vor|ins)?\s*(?:ein(?:e|en|em)?|das|die|den|dem)?|\bnicht\s+(?:an|ans|zum|zu|vor|ins)?\s*(?:ein(?:e|en|em)?|das|die|den|dem)?|\bnie(?:mals)?\s+(?:an|ans|zum|zu|vor|ins)?\s*(?:ein(?:e|en|em)?|das|die|den)?|\bno|\bnot\s+(?:to\s+)?(?:a|the)?)\s*$/.test(davor);
}

/** Der Kunde ist der Handelnde („Ihr Anwalt“, „Sie … rechtliche Schritte“). */
function kundeHandelt(s: string): boolean {
  // „Der Hinweis auf rechtliche Schritte ist dabei“ — sein Hinweis, den Mara weitergibt.
  if (/\b(?:hinweis|ank(?:ü|ue)ndigung|erw(?:ä|ae)hnung|androhung|drohung)\w*\s+(?:auf|mit|von|zu)\s+(?:\S+\s+)?rechtlich/i.test(s)) return true;
  return /\b(?:ihr(?:e|en|em|er)?|ihrem)\s+(?:rechts)?anw(?:a|ä|ae)lt|\bsie\b\s+(?:\S+\s+){0,4}?(?:rechtlich\w*|anw(?:a|ä|ae)lt\w*|gericht\w*|klag\w*)|\byour\s+(?:lawyer|attorney|solicitor)\b|\byou\s+(?:\S+\s+){0,3}?(?:legal|court|lawyer)/i.test(s);
}

/** Der erste Drohsatz — sonst null. Gilt nur in Antworten zu Kündigung oder Widerruf (kuendigungsWand). Rein. */
export function drohungFinden(text: string): string | null {
  for (const roh of kundenSaetze(text)) {
    const s = ohneZitate(roh);
    const m = s.match(DROH_IMMER);
    if (m && !verneintDavor(s, m.index ?? 0)
      && !/\b(?:sie|you)\b\s+(?:\S+\s+){0,4}?(?:vor\s+gericht|gerichtlich|klagen|einklagen|court)/i.test(s)) return roh.slice(0, 160);
    if (DROH_ANWALT.test(s)) return roh.slice(0, 160);
    for (const re of [DROH_INKASSO, DROH_ESKALATION, DROH_KOSTEN]) {
      const x = s.match(re);
      if (x && !verneintDavor(s, x.index ?? 0) && !/\b(?:nicht|kein\w*|nie|niemals|not|never|no)\b/i.test(x[0])
        && !/\b(?:kein\w*|nichts?)\s+(?:\S+\s+){0,3}?(?:kosten|geb(?:ü|ue)hren|inkasso\w*)/i.test(s)) return roh.slice(0, 160);
    }
    const sm = s.match(DROH_SCHUFA);
    if (sm && !verneintDavor(s, sm.index ?? 0) && !/\b(?:nicht|kein\w*|nie|niemals|not|never)\b/i.test(sm[0])) return roh.slice(0, 160);
    const rm = s.match(DROH_RECHTLICH);
    if (rm && !kundeHandelt(s) && !verneintDavor(s, rm.index ?? 0)) return roh.slice(0, 160);
  }
  return null;
}

/** Geht es um Kündigung, Storno oder Widerruf (Kundentext, Betreff oder Antwort)? Breit — im Zweifel ja. Rein. */
export function kuendigungsBezug(...texte: (string | null | undefined)[]): boolean {
  const t = texte.filter(Boolean).join("\n");
  return /\bk(?:ü|ue)ndig\w*|\bgek(?:ü|ue)ndigt|\bwiderruf\w*|\bstorn\w*|\bvertragsende\b|\bbeendigung\b|\bvertrag\w*\s+(?:\S+\s+){0,6}?(?:beend\w*|endet|aufl(?:ö|oe)s\w*|aufheb\w*)|\baus\s+dem\s+vertrag\b|\bcancel\w*|\bterminat\w*|\bwithdraw\w*|\bopzeg\w*|\br(?:é|e)sili\w*/i.test(t);
}

/**
 * Die Wand für Antworten zu Kündigung oder Widerruf: Kopplung (beim Widerruf ohne Kulanz-Ausnahme) und — wenn
 * es um Kündigung oder Widerruf geht — jede Drohung. Treffer sind „verboten“: nie automatisch, nie von Hand. Rein.
 */
export function kuendigungsWand(text: string, opt: { bezug: boolean; widerruf?: boolean; kulanzErlaubt?: boolean | null }): Wandtreffer[] {
  const funde: Wandtreffer[] = [];
  // E-396: Der Kulanz-Satz („Wenn Sie die offene Rechnung … bezahlen, entlassen wir Sie aus Kulanz vorzeitig …“) bleibt
  // beim Jahresvertrag frei; beim Altvertrag (kulanzErlaubt === false) und beim Widerruf ist er eine Kopplung.
  const ohneKulanz = opt.kulanzErlaubt === false;
  const k = kopplungFinden(text, { widerruf: !!opt.widerruf, ohneKulanz });
  if (k) funde.push({ art: "verboten", treffer: k.slice(0, 60), hinweis: opt.widerruf ? `${KOPPLUNG_HINWEIS} Beim Widerruf gibt es keinen Ausstieg gegen Zahlung — sag: „${WIDERRUF_ERSATZ}“` : ohneKulanz ? `${KOPPLUNG_HINWEIS} ${ALTVERTRAG_KULANZ_HINWEIS}` : KOPPLUNG_HINWEIS });
  const d = opt.bezug || !!k ? drohungFinden(text) : null;
  if (d) funde.push({ art: "verboten", treffer: d.slice(0, 60), hinweis: DROHUNG_HINWEIS });
  return funde;
}

/** Kündigung/Widerruf aus der Zeile des Postmeisters (Lampen, Lage, Kategorien, Kundentext, Betreff, Antwort). Rein. */
export function kuendigungsLage(ein: {
  antwort?: string | null; eingang?: string | null; betreff?: string | null;
  flags?: Record<string, unknown> | null; kundenlage?: string | null; kategorie?: string | null; kategorien?: readonly string[] | null;
  kuendigungInAkte?: boolean;
  /** E-396: true = Jahresvertrag (Kulanz-Satz frei), false = Vertrag vor dem 03.09.2026 (Kulanz-Satz gesperrt), leer = unbekannt (frei wie bisher). */
  kulanzErlaubt?: boolean | null;
}): { bezug: boolean; widerruf: boolean; kulanzErlaubt?: boolean | null } {
  const f = (ein.flags && typeof ein.flags === "object" ? ein.flags : {}) as Record<string, unknown>;
  const kat = [ein.kategorie, ...(ein.kategorien ?? [])].filter(Boolean).join(" ");
  const widerruf = !!f.widerruf || /\bwiderruf\w*|\bwithdraw\w*/i.test(`${ein.eingang ?? ""}\n${ein.betreff ?? ""}`);
  const bezug = widerruf || !!f.kuendigung || !!ein.kuendigungInAkte || ein.kundenlage === "gekuendigt"
    || /k(?:ü|ue)ndig|widerruf|storn/i.test(kat) || kuendigungsBezug(ein.eingang, ein.betreff, ein.antwort);
  return { bezug, widerruf, kulanzErlaubt: ein.kulanzErlaubt ?? null };
}

/**
 * DIE SENDESPERRE (E-393) — vor jedem Versand einer Postmeister-Antwort, automatisch wie von Hand: Wortwand-Kopplung
 * plus kuendigungsWand. `gesperrt` heißt: nicht senden, Entwurf bleibt, `grund` sagt dem Menschen warum. Rein.
 */
export function kuendigungSendeUrteil(ein: Parameters<typeof kuendigungsLage>[0] & { antwort: string }): { gesperrt: boolean; treffer: Wandtreffer[]; grund: string } {
  const lage = kuendigungsLage(ein);
  const treffer = kuendigungsWand(ein.antwort, lage);
  return {
    gesperrt: treffer.length > 0, treffer,
    grund: treffer.length ? `E-393 gesperrt — ${treffer.map((t) => `${t.hinweis === DROHUNG_HINWEIS ? "Drohung" : "Kündigung an Zahlung geknüpft"}: „${t.treffer}“`).join("; ")}` : "",
  };
}

/**
 * Nimmt Kopplungs- und Drohsätze aus dem Text und setzt den einen richtigen Satz ein (Kündigung: KOPPLUNG_ERSATZ,
 * Widerruf: WIDERRUF_ERSATZ). Für den Entwurf, der beim Menschen landet — die Prüfung zeigt, was ersetzt wurde. Rein.
 */
export function kuendigungsSaetzeErsetzen(text: string, opt: { bezug: boolean; widerruf?: boolean; kulanzErlaubt?: boolean | null }): { text: string; entfernt: string[] } {
  const ohneKulanz = opt.kulanzErlaubt === false;
  const entfernt: string[] = [];
  const absaetze = String(text || "").split(/\n{2,}/);
  let ersatzGesetzt = /h(?:ä|ae)ngt\s+nicht\s+an\s+einer\s+zahlung|unabh(?:ä|ae)ngig\s+von\s+(?:der|einer|jeder)\s+zahlung/i.test(text)
    || (!!opt.widerruf && text.includes(WIDERRUF_ERSATZ));
  const neu = absaetze.map((abs) => {
    const saetze = kundenSaetze(abs.replace(/\n/g, " "));
    const behalten: string[] = [];
    for (let i = 0; i < saetze.length; i++) {
      const s = saetze[i];
      // „Das geht erst nach der Zahlung.“ trifft nur mit dem Satz davor — dann zählt der Treffer, wenn er DIESER Satz ist.
      const mitDavor = i > 0 ? kopplungFinden(`${saetze[i - 1]}\n${s}`, { widerruf: !!opt.widerruf, ohneKulanz }) : null;
      const k = kopplungFinden(s, { widerruf: !!opt.widerruf, ohneKulanz }) || (mitDavor === s.slice(0, 160) ? mitDavor : null);
      const d = opt.bezug || k ? drohungFinden(s) : null;
      if (!k && !d) { behalten.push(s); continue; }
      entfernt.push(s);
      if (k && !ersatzGesetzt) { behalten.push(opt.widerruf ? WIDERRUF_ERSATZ : KOPPLUNG_ERSATZ); ersatzGesetzt = true; }
    }
    return behalten.join(" ").trim();
  }).filter(Boolean);
  return { text: entfernt.length ? neu.join("\n\n") : String(text || ""), entfernt };
}

export const WORTREGELN: Wortregel[] = [
  // ── Rechtlich heikel oder schlicht falsch ────────────────────────────────
  { muster: /\bgarant(ie|ier\w*)\b/i, art: "verboten", hinweis: "Nichts garantieren. Sag, was FIAON tut, und dass die Bank oder die Auskunftei entscheidet." },
  { muster: /\b(zusicher\w+|wir versprechen|ich verspreche)\b/i, art: "verboten", hinweis: "Kein Versprechen. Nenne den nächsten Schritt und wer entscheidet." },
  { muster: /\bberat(ung|en|er|ung\w*)\b/i, art: "verboten", hinweis: "FIAON berät nicht. Sag 'wir erklären', 'wir bereiten vor', 'wir übernehmen'." },
  { muster: /\bempfehl\w+\b/i, art: "verboten", hinweis: "Keine Empfehlung aussprechen. Beschreibe die Möglichkeit und überlasse die Wahl." },
  { muster: /sicher\s+klappt|klappt\s+sicher|garantiert\s+gelöscht|garantierte\s+löschung/i, art: "verboten", hinweis: "Ergebnisse sind nie sicher. Beschreibe den Weg, nicht das Ergebnis." },
  { muster: /(verbessern|erhöhen|steigern)\s+(wir\s+)?(ihren|ihre)\s+(score|bonität)/i, art: "verboten", hinweis: "Der Score folgt den Daten. Sag, welche Daten sich ändern." },
  // ══════════════════════════════════════════════════════════════════════════
  // KEIN GELD ZUSAGEN (23.09.2026, E-225)
  //
  // Der Anlass ist eine echte Mail von heute Abend. Ferat Met fragte um 17:36,
  // ob er für 79,99 € „den Kredit in Höhe von 15.000 € gleich ausbezahlt"
  // bekommt. Um 18:41 antwortete Mara richtig: nein, FIAON vergibt keine
  // Kredite, über den Rahmen entscheidet die Bank. Um 18:58 schrieb dieselbe
  // Mara: „Der gewünschte Betrag ist sofort verfügbar. Bitte einzahlen und
  // Account aktivieren." Sechs Minuten später der Kunde: „Ich verstehe jetzt
  // nichts mehr."
  //
  // Die Anweisung verbot das längst — das Modell hat sie überschrieben. Ein
  // Prompt ist ein Rat; hier braucht es eine Wand. Diese drei Regeln fangen
  // die Klasse ab: verfügbares Geld, zugesagter Rahmen, zugesagte Karte.
  { muster: /\b(betrag|summe|geld|kredit\w*|darlehen)\b[\s\S]{0,40}?\b(ist|sind|steht|stehen|wird|werden)\b[\s\S]{0,25}?\b(sofort\s+)?(verfügbar|ausgezahlt|bereit|zur\s+verfügung)\b/i,
    art: "verboten", hinweis: "Kein Geld zusagen. FIAON zahlt nichts aus; über Konto, Karte und Rahmen entscheidet die Bank." },
  // E-265 Nachbesserung 2 (01.10.2026): „Ihr Wunschlimit von 25.000 € steht in Ihrem Antrag" ist eine Tatsache, keine
  // Zusage (Gegenprobe g1 OK6) — die Zusage-Prüfung für Limit-Sätze macht die weiße Liste (shared/fiaon-mara-ton.ts).
  { muster: /\b(ihr|das)\s+(wunsch)?(limit|rahmen|kreditrahmen)\b[\s\S]{0,30}?\b(passt|steht(?!\s+(?:so\s+)?in\s+ihrem\s+antrag\b)|ist\s+(genehmigt|bestätigt|sicher|freigegeben)|bekommen\s+sie)\b/i,
    art: "verboten", hinweis: "Über den Rahmen entscheidet die Bank — nie zusagen, dass er passt oder steht." },
  // E-265 Nachbesserung (29.09.2026, Gegenprobe wand.mts): Die Ausnahme galt, sobald danach irgendwo „Zusage",
  // „entscheidet" oder „Bank" stand — „Sie bekommen Ihre Kreditkarte, über den Rahmen entscheidet die Bank" ging
  // durch. „Über den Rahmen entscheidet …" nimmt nur das LIMIT zurück; über die KARTE entscheidet laut AGB § 4
  // ebenfalls allein die Bank. Ausgenommen ist nur der Weg: „nach der Zusage (der Bank)" (davor oder danach im
  // selben Satz) und „… entscheidet über Konto und Karte".
  { muster: /(?<!\bnach\s+(?:der\s+)?zusage\b[^.!?]{0,60})\b(sie\s+(bekommen|erhalten))\b[\s\S]{0,25}?\b(die\s+)?(karte|kreditkarte)\b(?![^.!?]{0,60}\bnach\s+(?:der\s+)?zusage\b|[^.!?]{0,60}\bentscheidet\b[^.!?]{0,40}\büber\s+(?:\S+\s+){0,2}?(?:konto\s+und\s+)?(?:visa-?)?(?:kredit)?karte\b)/i,
    art: "verboten", hinweis: "Die Karte ist nicht zugesagt. Formuliere den Weg: nach der Zusage der Bank." },
  // E-265 (29.09.2026): Justins Satz „Bei uns bekommen Sie Ihre Kreditkarte mit einem Limit …" — die
  // UMGESTELLTE Form („bekommen Sie Ihre Karte") übersah die Regel darüber. Dieselbe Ausnahme: steht
  // danach „Zusage"/„entscheidet", ist es der Weg, keine Zusage. „bekommen Sie direkt den Link unserer
  // Partnerbank für Ihre Karte" trifft nicht (der Link, nicht die Karte, ist das Objekt).
  // E-265 Nachbesserung: dieselbe enge Ausnahme wie oben — Justins Satz „Bei uns bekommen Sie Ihre Kreditkarte mit
  // Ihrem Wunschlimit … — über den Rahmen entscheidet unsere Partnerbank" ist eine Kartenzusage und fällt jetzt.
  { muster: /(?<!\bnach\s+(?:der\s+)?zusage\b[^.!?]{0,60})\b(bekommen|erhalten)\s+sie\s+(?:bei\s+uns\s+)?(?:auch\s+)?(?:ihre|eine|die)\s+(?:eigene\s+)?(?:visa-?)?(?:kredit)?karte\b(?![^.!?]{0,60}\bnach\s+(?:der\s+)?zusage\b|[^.!?]{0,60}\bentscheidet\b[^.!?]{0,40}\büber\s+(?:\S+\s+){0,2}?(?:konto\s+und\s+)?(?:visa-?)?(?:kredit)?karte\b)/i,
    art: "verboten", hinweis: "Die Karte ist nicht zugesagt. Sag: „Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte — über den Rahmen entscheidet unsere Partnerbank.“" },
  { muster: /\baffiliate\b/i, art: "verboten", hinweis: "Das Wort nie verwenden." },
  { muster: /\bkredit(vermittlung|e?\s+vermitteln)\b/i, art: "verboten", hinweis: "FIAON vermittelt keine Kredite." },
  { muster: /\b(dolmetscher|übersetzungsdienst|live-?chat|telefon-?konferenz)\b/i, art: "verboten", hinweis: "Diese Leistung gibt es bei FIAON nicht — biete stattdessen ein Telefongespräch an." },
  { muster: /\b(geldkarte|karte|pin)\b[\s\S]{0,40}?\b(versenden|zusenden|zuschicken|schicken|senden|zustellung|zustellen)\b/i, art: "verboten", hinweis: "FIAON verschickt keine Karten oder PINs. Die Bank entscheidet und versendet." },
  { muster: /\b(pending_payment|claimed_paid|karteileiche|kein_zugang|wartet_auf_onboarding)\b/i, art: "verboten", hinweis: "Kein internes Wort in einer Kundenmail. Beschreibe den Zustand in normalen Worten." },
  { muster: /innerhalb\s+von\s+\d+\s*(stunden|std|werktagen|tagen)\b/i, art: "verboten", hinweis: "Keine Frist zusagen, die niemand garantiert. Sag 'in der Regel' oder nenne einen Termin." },
  { muster: /\b(datenschutz|recht|legal|info)@fiaon\.com\b/i, art: "verboten", hinweis: "Nur support@fiaon.com und welcome@fiaon.com existieren." },
  { muster: /\bBE09\s?9058|TRWIBEB1/i, art: "verboten", hinweis: "Das ist die gesperrte Bankverbindung. Verlinke die Zahlungsseite." },
  { muster: /\bDE\d{2}[\s\d]{14,}/i, art: "verboten", hinweis: "Keine Bankdaten im Text — verlinke die Zahlungsseite, dort stehen sie immer aktuell." },
  // E-393 (16.10.2026): Das Vertragsende hängt nie an einer Zahlung — in JEDEM Kundentext (Mail, WhatsApp, Bericht).
  // Der Kulanz-Ausstieg aus dem Jahresvertrag bleibt frei; beim Widerruf prüft der Postmeister schärfer (kuendigungsWand).
  { muster: /zahl|rate|begleich|beglichen|(?:ü|ue)berweis|rechnung|betrag|forderung|ausgleich|verbucht|pay|invoice|instal/i, art: "verboten",
    hinweis: KOPPLUNG_HINWEIS, pruefe: (t) => kopplungFinden(t) },

  // ── Floskeln, an denen man den Automaten erkennt ─────────────────────────
  { muster: /(stehe?n?\s+(ich|wir)\s+ihnen\s+.{0,25}zur\s+verfügung)/i, art: "floskel", hinweis: "Weglassen. Ende mit dem konkreten nächsten Schritt." },
  { muster: /zögern\s+sie\s+nicht/i, art: "floskel", hinweis: "Weglassen." },
  { muster: /gerne?\s+helfen\s+wir\s+ihnen\s+weiter/i, art: "floskel", hinweis: "Weglassen und stattdessen konkret helfen." },
  { muster: /^(vielen dank für ihre nachricht|ich habe ihre nachricht erhalten|wir haben ihre nachricht (erhalten|zur kenntnis genommen))/im, art: "floskel", hinweis: "Nicht mit einer Eingangsbestätigung beginnen. Geh sofort auf das Anliegen ein." },
  { muster: /bei\s+(weiteren\s+)?(rück)?fragen\s+(stehen|melden)/i, art: "floskel", hinweis: "Weglassen." },

  // ── Zusagen, die ein Werkzeug decken muss ───────────────────────────────
  { muster: /\b(aus\s+(dem|unserem)\s+verteiler\s+(genommen|entfernt|nehmen)|keine\s+(weiteren\s+)?(werbe|angebots)?mails?\s+mehr)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Werbesperre wirklich gesetzt wurde.", gedecktDurch: ["werbesperre_setzen"] },
  // 04.09.2026: auch „Zahlungserinnerungen" — das Wort-Ende reichte nicht (\berinnerungen\b greift im Kompositum nicht).
  { muster: /\b\w*(erinnerungen|mahnungen)\b.{0,30}\b(gestoppt|eingestellt|angehalten|beendet|pausiert)\b/i, art: "zusage", hinweis: "Nur sagen, wenn der Mahnstopp gesetzt wurde.", gedecktDurch: ["mahnstopp_setzen"] },
  { muster: /\b(weitergeleitet|weiterleiten\s+werde|an\s+die\s+(zuständige\s+)?(abteilung|kollegin|kollegen))\b/i, art: "zusage", hinweis: "Nur sagen, wenn wirklich jemand informiert wurde.", gedecktDurch: ["notiz_an_betreuer", "aufgabe_an_betreuer", "eskalation_vorbereiten"] },
  // E-248 (28.09.2026, Befunde P5/P7): Eine FRAGE („Welche Zeit soll ich für den Rückruf
  // eintragen?") und ein „keinen Rückruf" sind keine Zusage — vorher machte jede solche
  // Nachricht von Mara eine dringende Aufgabe. Zusage bleibt der Satz, der etwas verspricht.
  // Nachbesserung 28.09.: Die Frage-Ausnahme gilt nur, wenn der Satz als Frage BEGINNT
  // („Florentine ruft Sie morgen an, passt Ihnen das?" bleibt eine Zusage), bis zu fünf
  // Wörter zwischen „Sie" und „an" („ruft Sie heute um 20 Uhr an"), ohne Lookbehind.
  // E-458 (29.10.2026): auch der Rückruf „bei ARAS“ per Mail (rueckruf_bei_aras) plant den Anruf wirklich ein.
  { muster: /\b(ruf(t|e|en)?\s+sie(\s+[^\s.!?]+){0,5}\s+an\b|meldet?\s+sich\s+(telefonisch|bei\s+ihnen)|rückruf)/i, art: "zusage", hinweis: "Nur sagen, wenn ein Rückruf eingeplant wurde.", gedecktDurch: ["notiz_an_betreuer", "aufgabe_an_betreuer", "rueckruf_bei_aras"],
    keineZusage: (satz, davor) => istEchteFrage(satz) || /\bkein(en)?\s+$/i.test(davor) },
  { muster: /\b(kündigung|vertrag)\b.{0,30}\b(vorgemerkt|vermerkt|aufgenommen|bestätigt|storniert)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Kündigung im System steht.", gedecktDurch: ["kuendigung_vormerken"] },
  { muster: /\b(zugang|bereich|konto)\b.{0,25}\b(freigeschaltet|freigegeben|aktiviert)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Freischaltung ausgeführt wurde.", gedecktDurch: ["konto_freischalten"] },
  { muster: /\b(notiert|vermerkt)\b.{0,20}\b(in\s+ihrer\s+akte|im\s+system)\b/i, art: "zusage", hinweis: "Nur sagen, wenn ein Vermerk geschrieben wurde.", gedecktDurch: ["vermerk_schreiben", "notiz_an_betreuer", "aufgabe_an_betreuer"] },
  { muster: /\b(rechnung)\b.{0,30}\b(angehängt|anbei|im\s+anhang|beigefügt|mitgeschickt)\b/i, art: "zusage", hinweis: "Nur sagen, wenn die Rechnung wirklich angehängt wird.", gedecktDurch: ["rechnung_anhaengen", "zahlungslink_bauen"] },
];

export interface Wandtreffer { art: Verstossart; treffer: string; hinweis: string; gedecktDurch?: string[] }

/**
 * Prüft einen Kundentext. `ausgefuehrt` sind die Werkzeuge, die im selben Lauf
 * erfolgreich liefen — nur sie decken eine Zusage.
 */
export function wandPruefen(text: string, ausgefuehrt: string[] = []): Wandtreffer[] {
  const t = String(text || "");
  const funde: Wandtreffer[] = [];
  for (const r of WORTREGELN) {
    let m = t.match(r.muster);
    if (!m) continue;
    if (r.pruefe) {
      const satz = r.pruefe(t);
      if (satz) funde.push({ art: r.art, treffer: satz.slice(0, 60), hinweis: r.hinweis, gedecktDurch: r.gedecktDurch });
      continue;
    }
    if (r.art === "zusage" && r.gedecktDurch?.some((w) => ausgefuehrt.includes(w))) continue;
    if (r.keineZusage) {
      // Jeden Treffer einzeln ansehen — zählt nur, wenn mindestens einer eine Zusage ist.
      const g = new RegExp(r.muster.source, r.muster.flags.includes("g") ? r.muster.flags : `${r.muster.flags}g`);
      m = null;
      for (const x of Array.from(t.matchAll(g))) {
        const i = x.index ?? 0;
        const anfang = Math.max(t.lastIndexOf(".", i - 1), t.lastIndexOf("!", i - 1), t.lastIndexOf("?", i - 1), t.lastIndexOf("\n", i - 1)) + 1;
        const ende = (() => { const rest = t.slice(i); const j = rest.search(/[.!?\n]/); return j < 0 ? t.length : i + j + (rest[j] === "\n" ? 0 : 1); })();
        if (!r.keineZusage(t.slice(anfang, ende), t.slice(Math.max(0, i - 8), i))) { m = x; break; }
      }
      if (!m) continue;
    }
    funde.push({ art: r.art, treffer: m[0].slice(0, 60), hinweis: r.hinweis, gedecktDurch: r.gedecktDurch });
  }
  return funde;
}

/** Harte Treffer verhindern jeden Versand; Floskeln nur den automatischen. */
export function wandUrteil(funde: Wandtreffer[]): { sendbar: boolean; automatisch: boolean } {
  const hart = funde.some((f) => f.art === "verboten" || f.art === "zusage");
  return { sendbar: !hart, automatisch: funde.length === 0 };
}
