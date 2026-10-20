// ═══════════════════════════════════════════════════════════════════════════
// ARAS HÄLT IHR WORT (E-408, Rauchtest 20.10.2026 nachts — vor dem Go-live mit echten Kunden)
//
// Befund im echten GPT-Live-Gespräch (Juni, Wien ultra): ARAS sagte „Der Link ist gleich per WhatsApp bei Ihnen“ und „dann
// notier i mir heute“ — ohne dass ein Werkzeug lief; auf „keine Karte bekommen“ legte sie keine Aufgabe für Justin an.
// Koordination: ARAS darf eine Handlung (Link/Rechnung geschickt, Aufgabe angelegt, Zahltag notiert) NUR bestätigen, wenn das
// Werkzeug ok gemeldet hat. Die Brücke hält das Wort: nach einer klaren Aussage (der Kunde will den Link, ARAS kündigt die
// Rechnung an, „keine Karte bekommen“, „heute noch“) führt sie das Werkzeug SELBST aus, wenn das Modell es nicht tut —
// dasselbe Muster wie der Start der Aufnahme nach dem Ja. Behauptet ARAS „ist raus“, ohne dass es raus ist, folgt still eine
// Korrektur. Hier nur die reinen Erkenner und Sätze (Prüfstand); die Brücke (fiaon-aras-bruecke.ts) handelt.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Kunde will den Link/die Rechnung („Ja, schicken Sie's mir“, „Schicken Sie mir die Rechnung“, „Ja bitte, per WhatsApp“). */
export function kundeWillZusendung(text: string): boolean {
  const t = String(text ?? "").toLowerCase();
  if (/\b(?:nein|nicht|ned|kein|keine)\b.{0,20}\bschick/.test(t)) return false;
  return /\bschick(?:en|ens)?\s+(?:sie\s+)?(?:(?:es|'?s|das|des|ihn|den link|die rechnung)\s+)?(?:mir|ma|rüber|ruhig|gern|bitte|zu)\b/.test(t)
    || /\b(?:ja|jo|gern|gerne|bitte|passt|okay)\b[^.?!]{0,30}\b(?:per\s+)?(?:whatsapp|mail|e-mail|link|rechnung)\b/.test(t)
    || /\bschicken\s+sie(?:'s|s)?\b/.test(t);
}

/**
 * ARAS kündigt das Schicken an (Zukunft): „i schick Ihnen glei die Rechnung zu“, „ich schicke Ihnen den Link“. Eine FRAGE
 * („Ich schick Ihnen den Link gleich aufs Handy … — passt das?“) ist ein Angebot, keine Zusage — dann zählt erst sein Ja.
 */
export function arasKuendigtZusendungAn(text: string): boolean {
  if (/\?["“”»]?\s*$/.test(String(text ?? "").trim())) return false;
  return /\b(?:i|ich)\s+schick(?:e)?\s+(?:Ihnen|ihnen|Eana|eana)\b[^.?!]{0,40}\b(?:Link|Rechnung|Zahlungslink|Zahlungsseite|Mail|Nachricht|WhatsApp)\b/i.test(String(text ?? ""))
    || /\b(?:Link|Rechnung)\b[^.?!]{0,30}\b(?:schick(?:e)?\s+(?:i|ich)|kommt\s+glei(?:ch)?)\b/i.test(String(text ?? ""));
}

/** ARAS behauptet, es sei schon geschickt: „Der Link ist raus“, „… ist gleich per WhatsApp bei Ihnen“, „hab Ihnen die Rechnung geschickt“. */
export function arasBehauptetZusendung(text: string): boolean {
  const t = String(text ?? "");
  return /\b(?:Link|Rechnung|Mail|E-Mail|Nachricht|Zahlungslink)\b[^.?!]{0,30}\b(?:ist|is)\s+(?:schon\s+|grad\s+|gerade\s+|jetzt\s+|gleich\s+|glei\s+)?(?:raus|unterwegs|verschickt|geschickt|versendet|(?:per\s+\w+\s+)?bei\s+Ihnen|da)\b/i.test(t)
    || /\b(?:hab|habe)\s+(?:i\s+|ich\s+)?(?:Ihnen\s+)?(?:den\s+Link|die\s+Rechnung|die\s+Mail|des|das)\s+(?:grad\s+|gerade\s+|schon\s+|jetzt\s+)?(?:geschickt|gesendet|verschickt|rausgeschickt)\b/i.test(t);
}

/** ARAS bietet an, den Link zu schicken (eine Frage): „Ich schick Ihnen den Link gleich aufs Handy … — passt das?“, „Soll ich Ihnen die Rechnung schicken?“ */
export function arasBietetZusendungAn(text: string): boolean {
  const t = String(text ?? "").trim();
  return /\?["“”»]?\s*$/.test(t) && /\b(?:Link|Rechnung|Zahlungslink|Zahlungsseite)\b/i.test(t) && /\bschick/i.test(t);
}
/** Ein klares Ja auf ein Angebot („Ja, passt.“, „Gern.“, „Ja bitte.“) — ohne „nein“/„nicht“. */
export function kurzesJa(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return /^(?:ja|jo|jawohl|gern|gerne|bitte|passt|okay|ok|freilich|sicher|klar|genau)\b/.test(t) && !/\b(?:nein|nicht|ned|kein|keine)\b/.test(t);
}
/** Ein klares Nein („Nein, brauch ich nicht“, „Bitte nichts schicken“). */
export function kurzesNein(text: string): boolean {
  const t = String(text ?? "").trim().toLowerCase();
  return /^(?:nein|nö|na|ne)\b/.test(t) || /\b(?:nicht|nichts|ned)\s+(?:schicken|senden)\b/.test(t) || /\bbrauch(?:e)?\s+(?:i|ich)\s+(?:nicht|ned)\b/.test(t);
}

/** Der Kunde sagt, er habe keine Karte bekommen („Ich hab nie eine Karte bekommen“, „Die Karte ist noch nicht da“). */
export function karteNichtBekommen(text: string): boolean {
  const t = String(text ?? "").toLowerCase();
  return /\b(?:keine|nie\s+eine|noch\s+keine|nie\s+a|ka|kane)\s+kart(?:e|n)\b[^.?!]{0,30}\b(?:bekommen|erhalten|gekriegt|kriegt|kriegt|bekommen|angekommen|gesehen)\b/.test(t)
    || /\bkart(?:e|n)\b[^.?!]{0,30}\b(?:nie|nicht|ned|noch\s+nicht|noch\s+ned)\s+(?:\w+\s+)?(?:bekommen|erhalten|gekriegt|angekommen|da|gekommen)\b/.test(t)
    || /\b(?:wo\s+bleibt|wann\s+kommt\s+endlich)\s+(?:meine\s+)?kart(?:e|n)\b/.test(t);
}

/** ARAS bestätigt einen Zahltag als eingetragen: „dann notier i mir heute“, „ist eingetragen“, „hab ich notiert“. */
export function arasBehauptetNotiert(text: string): boolean {
  return /\b(?:notier(?:e|t)?\s+(?:i|ich)\s+mir|(?:i|ich)\s+notier(?:e)?\s+mir|(?:ist|is)\s+(?:schon\s+)?(?:notiert|eingetragen|vermerkt)|hab(?:e)?\s+(?:i\s+|ich\s+)?(?:des|das|es)\s+(?:notiert|eingetragen|vermerkt)|(?:des|das|es)\s+hab(?:e)?\s+(?:i|ich)\s+(?:mir\s+)?(?:notiert|eingetragen|vermerkt))\b/i.test(String(text ?? ""));
}

/** Ein Zahltag aus der Antwort des Kunden — nur die eindeutigen: „heute (noch)“ und „morgen“. JJJJ-MM-TT oder null. Rein. */
export function zahltagAusKunde(text: string, heuteIso: string): string | null {
  const t = String(text ?? "").toLowerCase();
  if (/\b(?:nein|nicht|ned|kein|keine|nimmer)\b/.test(t)) return null;
  const d = new Date(`${heuteIso}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  if (/\bübermorgen\b/.test(t)) return null;
  if (/\bmorgen\b/.test(t)) { d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  if (/\bheute\b/.test(t)) return d.toISOString().slice(0, 10);
  return null;
}

/** Still an die Stimme, wenn sie „ist raus“ sagte, es aber (noch) nicht raus ist. */
export const KORREKTUR_LINK_UNTERWEGS = "Kleine Korrektur, gleich im nächsten Satz und ruhig: Der Link ist noch NICHT bei ihm — er wird gerade geschickt. Sag ehrlich „der kommt in der nächsten Minute“, nie „ist schon da“.";
export const KORREKTUR_LINK_FEHLER = "Korrektur, gleich im nächsten Satz, ehrlich und ruhig: Der Link ist gerade NICHT rausgegangen. Sag z. B. „Der Link is grad ned rausgangen — jemand aus unserem Team schickt ihn Ihnen heute noch.“ Behaupte nichts anderes.";
export const KORREKTUR_ZUSAGE = "Korrektur, gleich im nächsten Satz: Eingetragen ist noch NICHTS. Frag kurz nach dem genauen Tag („Also heute noch, passt des?“) und gib ihn dann an den Hintergrund (zahlungszusage_merken). Sag „notiert“ erst danach.";
/** Wie lange die Brücke dem Modell Zeit lässt, bevor sie selbst handelt (Hintergrund-Modell ~2 s, manchmal bis ~8 s). */
export const WORT_WARTEN_MS = { link: 8000, aufgabe: 6000, zusage: 9000 } as const;
