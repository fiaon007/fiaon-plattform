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
//
// Auswertung der echten Gespräche 21./22.10. (Scheibe 3) — dazu, ebenso rein (Prüfstand scripts/pruef-aras-wort.ts):
//   1. Identität vor dem Anliegen: fragt ARAS nach der Person, hat der Kunde bestätigt (Ja / sein Name), nennt ARAS vorher
//      schon Rate, Betrag oder Antrag (→ stille Korrektur der Brücke).
//   2. Zahltag-Sätze: „am Ersten“, „Anfang nächsten Monats“, „am Fünfzehnten“, „nächsten Dienstag“, „übermorgen“, „Ende des
//      Monats“, „am 30.10.“ — mit Berliner Datum, nie Vergangenheit, höchstens 45 Tage voraus; Unklares bleibt null.
//   3. Streitfall: Betrug, (Straf-)Anzeige, Polizei, Anwalt, Verbraucherzentrale, Abzocke, „nie etwas unterschrieben/bestellt“.
//   4. Ansage statt Mensch: Mailbox, Anrufbeantworter, Anruf-Assistent — nie „erreicht“.
//   5. Wort halten bis zum Schluss: Zusage und Angebot je TEILSATZ (eine Anschlussfrage macht aus „Der Link kommt gleich“
//      kein Angebot), beide Wortstellungen („dann schick i Ihnen …“), Weg aus seiner Antwort („Ja, per E-Mail, bitte“).
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
 * Welcher Weg — aus seiner Antwort („Ja, per E-Mail, bitte“ → mail, „aufs Handy“/„WhatsApp“ → whatsapp). Ein verneinter Weg
 * zählt nicht („nicht per WhatsApp, lieber per Mail“ → mail); mehrere: der zuletzt genannte. Nichts genannt: null. Rein.
 */
export function kundeWunschWeg(text: string): "mail" | "whatsapp" | null {
  const t = String(text ?? "").toLowerCase();
  const treffer: { weg: "mail" | "whatsapp"; at: number }[] = [];
  const re = /\b(e-?mail|email|mail(?:adresse)?|whats\s?app|watsapp|wotsapp|handy|sms)\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const davor = t.slice(Math.max(0, m.index - 16), m.index);
    if (/\b(?:nicht|ned|kein|keine|keinen|lieber\s+nicht)\b[^.?!]*$/.test(davor)) continue;
    treffer.push({ weg: /mail/.test(m[1]) ? "mail" : "whatsapp", at: m.index });
  }
  return treffer.length ? treffer[treffer.length - 1].weg : null;
}

// ── Teilsätze (Koordination 22.10.: „Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?“ ist eine Zusage) ──
/**
 * Die Zeile in Teilsätze — an „.“, „!“, „?“, „…“ und an Gedankenstrichen („—“, „–“, „ - “). `frage`: der Teilsatz schließt
 * eine Frage ab (der letzte Teil eines Satzes mit „?“). Ein Bindestrich im Wort („E-Mail“) trennt nie. Rein.
 */
export function teilsaetze(text: string): { text: string; frage: boolean }[] {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const saetze = t.match(/[^.!?…]+(?:[.!?…]+["“”»]?|$)/g) ?? [t];
  const aus: { text: string; frage: boolean }[] = [];
  for (const s of saetze) {
    const frage = /\?["“”»]?\s*$/.test(s.trim());
    const teile = s.split(/\s+-\s+|\s*[—–]\s*/).map((x) => x.trim()).filter((x) => /[a-zäöüß0-9]/i.test(x));
    teile.forEach((x, i) => aus.push({ text: x, frage: frage && i === teile.length - 1 }));
  }
  return aus;
}

/** Was ARAS schickt (Link, Rechnung, Mail …) — und wohin („rüber“, „zu“, „aufs Handy“, „per WhatsApp“). */
const SENDE_ZIEL = /\b(?:Link|Links|Zahlungslink|Rechnung|Zahlungsseite|Zahlungsinfos?|Zahlungsdaten|Mail|E-?Mail|Email|WhatsApp|Nachricht)\b/i;
const SENDE_WEG = /\b(?:rüber|rueber|herüber|zu|raus)\b|\baufs\s+Handy\b|\bauf\s+(?:Ihr|Ihna|Eana)\s+Handy\b|(?<![a-zäöüß])(?:per|über|ueber|via|auf|bei)\s+(?:WhatsApp|Mail|E-?Mail|Email)\b|\ban\s+(?:Ihre|die)\s+(?:Nummer|Handynummer|Mailadresse|Adresse)\b/i;
/** ICH schicke — in beiden Wortstellungen: „i schick Ihnen …“, „dann schick i Ihnen …“, „den schick i Ihnen …“, „ich sende …“. */
const ICH_SCHICKE = /\b(?:(?:i|ich)\s+(?:schick|schicke|sende|send)(?:'?s)?|(?:schick|schicke|sende|send)(?:'?s)?\s+(?:i|ich))\b/i;
const ICH_WERDE_SCHICKEN = /\b(?:i|ich)\s+(?:werd|werde|wird|lass|lasse|tu|tue)\b[^.?!]{0,50}\b(?:schicken|senden|zukommen|zuschicken|rüberschicken|rueberschicken)\b/i;
/** „Der Link kommt gleich (per WhatsApp)“, „Die Rechnung geht glei raus“. */
const KOMMT_GLEICH = /\b(?:Link|Zahlungslink|Rechnung|Mail|E-?Mail|Nachricht)\b[^.?!]{0,40}\b(?:kommt|geht)\s+(?:(?:dann|jetzt|schon|grad|gerade)\s+)*(?:gleich|glei|sofort|jetzt|raus|in\s+(?:ein\s+paar|wenigen)\s+(?:Sekunden|Minuten))\b/i;
/** „Sie kriegen glei die Rechnung“, „den bekommt er gleich“ (zu einem Angehörigen). */
const SIE_KRIEGEN = /\b(?:Sie\s+(?:kriegen|bekommen|erhalten)|kriegens|bekommens|kriagens|er\s+(?:kriegt|bekommt|erhält)|sie\s+(?:kriegt|bekommt))\b[^.?!]{0,40}\b(?:Link|Zahlungslink|Rechnung|Mail|E-?Mail|Nachricht|WhatsApp)\b|\b(?:den|die)\s+(?:kriegen|bekommen|kriegens|bekommens|kriegt|bekommt)\s+(?:Sie\s+|er\s+|sie\s+)?(?:gleich|glei|sofort|jetzt)\b/i;
/** Kein Zahlungslink: der Link zum Hochladen (Unterlagen) schickt die Nachbereitung, nie zahlungslink_senden. */
const KEIN_ZAHLUNGSLINK = /\b(?:Unterlagen|hochlad\w*|Hochlade\w*|Upload|Kontoauszug\w*|Dokument\w*|Ausweis\w*)\b/i;
const SATZ_VERNEINT = /\b(?:nicht|ned|nix|nichts|kein|keine|keinen|nie)\b/i;
const PERFEKT_GESCHICKT = /\b(?:geschickt|gesendet|verschickt|rausgeschickt|rausgegangen|weggeschickt|zugeschickt|rübergeschickt)\b/i;
/** Ein Angebot im Satz selbst („Wenn Sie möchten, schick ich …“, „Soll ich …“, „Ich kann Ihnen … schicken“). */
const ANGEBOT_IM_SATZ = /\b(?:soll|sollt|darf|kann|könnt|koennt|könnte|koennte|würd|wuerd|würde|wuerde|möcht|moecht|möchte|moechte)\s+(?:i|ich)\b|\b(?:i|ich)\s+(?:kann|könnt|koennt|könnte|koennte|würd|wuerd|würde|wuerde|möcht|moecht|möchte|moechte)\b|\bwenn\s+(?:Sie|S'|Se)\s+(?:wollen|wolln|möchten|moechten|mögen|moegen|wünschen|wuenschen)\b|\b(?:möchten|moechten|wollen|wolln|mögen|moegen)\s+(?:Sie|S')\b/i;
/** Eine kurze Zustimmungs-Frage hinter der Ankündigung („— passt des?“, „Ist das so recht für Sie?“, „oder lieber per Mail?“). */
const ZUSTIMMUNG_FRAGE = /^(?:und\s+|also\s+|oder\s+)?(?:passt(?:\s+(?:das|des|es|'s|Ihnen|eana|ihna))?|passts|passt's|okay|ok|in\s+ordnung|einverstanden|recht\s+so|(?:is|ist)\s+(?:das|des|es)\s+(?:so\s+)?(?:recht|okay|ok|in\s+ordnung)|wär(?:e)?\s+(?:Ihnen\s+)?(?:das|des)\s+(?:so\s+)?(?:recht|okay|ok)|ja|gell|gö|net\s+wahr|darf\s+(?:i|ich)|soll\s+(?:i|ich)|geht\s+(?:das|des)(?:\s+so)?|(?:wollen|möchten|moechten)\s+Sie\s+(?:das|des)|(?:lieber\s+)?(?:per\s+)?(?:Mail|E-?Mail|WhatsApp))(?![a-zäöüß])/i;

/** Will ARAS in diesem Teilsatz schicken (Ankündigung ODER Angebot)? Ohne Hochlade-Link, ohne Verneinung, ohne Perfekt. */
function sendeAbsicht(t: string): boolean {
  if (KEIN_ZAHLUNGSLINK.test(t) || SATZ_VERNEINT.test(t) || PERFEKT_GESCHICKT.test(t)) return false;
  return (ICH_SCHICKE.test(t) && (SENDE_ZIEL.test(t) || SENDE_WEG.test(t) || /\b(?:Ihnen|Ihna|Eana|ihm|ihr)\b/i.test(t)))
    || ICH_WERDE_SCHICKEN.test(t) || KOMMT_GLEICH.test(t) || SIE_KRIEGEN.test(t)
    || /\b(?:(?:soll|darf|kann|könnte|koennte|würde|wuerde|möchte|moechte)\s+(?:i|ich)|(?:i|ich)\s+(?:kann|könnt|koennt|könnte|koennte|würd|wuerd|würde|wuerde|möcht|moecht|möchte|moechte))\s+(?:Ihnen\s+|Ihna\s+|Eana\s+|ihm\s+|ihr\s+)?[^.?!]{0,40}\b(?:schicken|senden|zuschicken|rüberschicken)\b/i.test(t);
}
/** Eine kurze Zustimmungs-Frage — am Anfang („passt des?“) oder als letzter Teil („über WhatsApp, passt?“), höchstens acht Wörter. */
function zustimmungsFrage(text: string): boolean {
  const t = String(text ?? "").trim();
  return t.split(/\s+/).length <= 8 && t.split(/,\s*/).some((x) => ZUSTIMMUNG_FRAGE.test(x.trim()));
}
function zustimmungDahinter(ts: { text: string; frage: boolean }[], i: number): boolean {
  const n = ts[i + 1];
  return !!n && n.frage && zustimmungsFrage(n.text);
}

/**
 * ARAS kündigt das Schicken an (Zukunft): „i schick Ihnen glei die Rechnung zu“, „Dann schick i Ihnen den Link gleich rüber“,
 * „Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?“. Je TEILSATZ: Ist der Teilsatz selbst eine Frage
 * („Soll ich Ihnen die Rechnung schicken?“), folgt ihm eine kurze Zustimmungs-Frage („I schick Ihnen glei den Link — passt des?“)
 * oder steht ein Angebot darin („Wenn Sie möchten, …“), ist es ein Angebot — dann zählt erst sein Ja. Eine ANDERE Frage danach
 * („habens sonst noch a Frage?“, „geht sich des heute noch aus?“) macht aus der Zusage kein Angebot. Rein.
 */
export function arasKuendigtZusendungAn(text: string): boolean {
  const ts = teilsaetze(text);
  return ts.some((x, i) => sendeAbsicht(x.text) && !x.frage && !zustimmungDahinter(ts, i) && !ANGEBOT_IM_SATZ.test(x.text));
}

/** ARAS behauptet, es sei schon geschickt: „Der Link ist raus“, „… ist gleich per WhatsApp bei Ihnen“, „hab Ihnen die Rechnung geschickt“. */
const LINK_WORT = /\b(?:Link|Zahlungslink|Rechnung|Mail|E-?Mail|Nachricht|Zahlungsinfos?)\b/i;
const IST_RAUS = /\b(?:ist|is)\s+(?:(?:schon|grad|gerade|jetzt|gleich|glei|bereits|auch)\s+)*(?:raus|rausgegangen|unterwegs|verschickt|geschickt|versendet|gesendet|angekommen|da|(?:(?:per|auf|über|ueber|via|bei)\s+\w+\s+)?bei\s+(?:Ihnen|Ihna|Eana|ihm|ihr))\b/i;
const HAB_GESCHICKT = /\b(?:hab|habe|hob|habs|hab's)\b[^.?!]{0,50}\b(?:geschickt|gesendet|verschickt|rausgeschickt|weggeschickt|zugeschickt|rübergeschickt)\b/i;
export function arasBehauptetZusendung(text: string): boolean {
  return teilsaetze(text).some((x) => !x.frage && !/\b(?:nicht|ned|noch\s+nicht)\b/i.test(x.text)
    && ((LINK_WORT.test(x.text) && IST_RAUS.test(x.text)) || (HAB_GESCHICKT.test(x.text) && (LINK_WORT.test(x.text) || /\b(?:des|das|es|ihn|WhatsApp)\b|'s\b/i.test(x.text)))));
}

/**
 * ARAS bietet an, den Link zu schicken (eine Frage): „Ich schick Ihnen den Link gleich aufs Handy … — passt das?“, „Soll ich
 * Ihnen die Rechnung schicken?“. Auch die Frage allein („Passt es, wenn i's Ihnen jetzt schick?“, „Ist das so recht für Sie?“),
 * wenn ARAS das Schicken in der Zeile davor (`vorher`) angekündigt hatte — Echtgespräch 22.10.: die Ankündigung und die Frage
 * kamen in zwei Zeilen. Rein.
 */
export function arasBietetZusendungAn(text: string, vorher?: string | null): boolean {
  const ts = teilsaetze(text);
  if (ts.some((x, i) => sendeAbsicht(x.text) && (x.frage || zustimmungDahinter(ts, i) || ANGEBOT_IM_SATZ.test(x.text)))) return true;
  if (ts.some((x) => x.frage && LINK_WORT.test(x.text) && /\bschick/i.test(x.text))) return true;
  const letzte = ts[ts.length - 1];
  if (!letzte?.frage || !vorher) return false;
  const frageZumSchicken = zustimmungsFrage(letzte.text) || /\bschick|\bsend/i.test(letzte.text);
  return frageZumSchicken && teilsaetze(vorher).some((x) => sendeAbsicht(x.text));
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

/**
 * ARAS bestätigt einen Zahltag als eingetragen: „dann notier i mir heute“, „ist eingetragen“, „hab ich notiert“ — Echtgespräche
 * 22.10. auch „des merk i mir“, „Ihre Überweisung für heute hab i notiert“, „I hab mir Ihre Zusage … vermerkt“. Nie eine Notiz
 * fürs Team („I habs fürs Team notiert“, „Ihre Frage … notiert“) und nie ein Rückruf-Termin — dort gibt es keinen Zahltag. Rein.
 */
const NOTIERT = /\b(?:notier(?:e|t)?\s+(?:i|ich)\s+mir|(?:i|ich)\s+notier(?:e)?\s+mir|merk(?:e)?\s+(?:i|ich)\s+mir|(?:i|ich)\s+merk(?:e)?\s+mir|(?:ist|is)\s+(?:schon\s+|jetzt\s+|bereits\s+)?(?:notiert|eingetragen|vermerkt|gespeichert|festgehalten)|(?:hab|habe|hob|habs|hab's)\s+(?:i\s+|ich\s+)?(?:mir\s+)?(?:[\wäöüß'-]+\s+){0,5}(?:notiert|eingetragen|vermerkt|gemerkt|aufgeschrieben)|(?:i|ich)\s+(?:hab|habe|hob)(?:'?s)?\s+(?:mir\s+)?(?:[\wäöüß'-]+\s+){0,5}(?:notiert|eingetragen|vermerkt|gemerkt|aufgeschrieben))\b/i;
const NOTIERT_ANDERES = /\b(?:Team|Kolleg\w*|Betreuer\w*|weiter(?:geb\w*|gegeben)?|Notiz|Rückmeldung|Rueckmeldung|Frage|Anliegen|Feedback|Wunsch|Rückruf\w*|Rueckruf\w*|Termin\w*|Uhr)\b/i;
export function arasBehauptetNotiert(text: string): boolean {
  return teilsaetze(text).some((x) => !x.frage && NOTIERT.test(x.text) && !NOTIERT_ANDERES.test(x.text) && !/\b(?:nicht|ned|noch\s+nichts?)\b/i.test(x.text));
}

/**
 * Hat ARAS gerade nach dem ZAHLTAG gefragt? („Wann schaffen Sie die Überweisung — heute noch?“, „Geht sich des heute noch aus?“,
 * „wann's bei Ihnen passt, damit …“) — nicht nach der Zeit für einen Rückruf („Wann passt es Ihnen für einen Anruf?“). Rein.
 */
export function arasFragtNachZahltag(text: string): boolean {
  const t = String(text ?? "");
  if (/\b(?:Rückruf\w*|Rueckruf\w*|zurückruf\w*|zurueckruf\w*|anrufen|Anruf|telefonier\w*|Termin\w*|sprechen|erreich\w*|Uhrzeit)\b/i.test(t)) return false;
  return /(?:heute\s+noch\s*\?|heut\s+no\s*\?|welchen\s+Tag|bis\s+wann|aus\s*\?|wann\s+(?:schaffen|zahlen|überweisen|ueberweisen|kriegen|klappt))/i.test(t)
    || /\bwann(?:'s|’s|s)?\b[^.?!]{0,30}(?<![a-zäöüß])(?:passt|geht|klappt|schaffen|zahlen|überweisen|ueberweisen)\b/i.test(t);
}

// ── Zahltag aus dem, was er sagt (Echtgespräch 22.10.: „es geht immer am Ersten bei mir“ — nichts eingetragen) ──────────
const WOCHENTAG: Record<string, number> = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6, sonntag: 7 };
const MONAT: Record<string, number> = {
  januar: 1, jänner: 1, jaenner: 1, februar: 2, feber: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8,
  september: 9, oktober: 10, november: 11, dezember: 12,
};
/** Ordnungszahlen als Wort („am Ersten“, „zum Fünfzehnten“, „am Einunddreißigsten“) — der Stamm, die Endung kommt dazu. */
const ORDINAL: Record<string, number> = (() => {
  const m: Record<string, number> = {
    erst: 1, zweit: 2, dritt: 3, viert: 4, fünft: 5, fuenft: 5, sechst: 6, siebt: 7, siebent: 7, acht: 8, neunt: 9, zehnt: 10, elft: 11,
    zwölft: 12, zwoelft: 12, dreizehnt: 13, vierzehnt: 14, fünfzehnt: 15, fuenfzehnt: 15, sechzehnt: 16, siebzehnt: 17, achtzehnt: 18,
    neunzehnt: 19, zwanzigst: 20, dreißigst: 30, dreissigst: 30, einunddreißigst: 31, einunddreissigst: 31,
  };
  ["ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"].forEach((e, i) => { m[`${e}undzwanzigst`] = 21 + i; });
  return m;
})();
const ZAHLWORT: Record<string, number> = { ein: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12, vierzehn: 14, zwanzig: 20, dreißig: 30 };
const ORD_RE = `(${Object.keys(ORDINAL).sort((a, b) => b.length - a.length).join("|")})(?:e|en|er|em|es)`;
const MON_RE = `(${Object.keys(MONAT).join("|")})`;
const WT_RE = `(${Object.keys(WOCHENTAG).join("|")})`;
const PRAEP = `(?:am|zum|bis\\s+zum|bis|den|der|ab\\s+dem|ab|vom)`;
/** Wörter, die einen Tag unklar machen (dann lieber nachfragen). */
const UNKLAR = /\b(?:mitte|wochenende|anfang\s+der\s+woche|ende\s+der\s+woche|vielleicht|eventuell|evtl|wahrscheinlich|ungefähr|ungefaehr|circa|ca|irgendwann|demnächst|demnaechst|bald|schauen|mal\s+sehen|gehalt|lohn|wenn\s+(?:das|mein)\s+geld)\b/i;
const NEGATION = /(?:^|[\s,])(?:nein|nee|nö|noe|nicht|ned|nimmer|kein|keine|keinen|nie|niemals)(?=$|[\s,.!?])|^\s*na\s*$/i;
/** Ein Teil, der keinen Zahltag zusagt: er kann an dem Tag nicht („heute bin ich unterwegs“) oder hat schon gezahlt („hab am Ersten überwiesen“). */
const KEIN_ZAHLTAG = /\b(?:unterwegs|beschäftigt|beschaeftigt|im\s+urlaub|verreist|krank|im\s+krankenhaus|arbeite|arbeiten|in\s+der\s+arbeit)\b|\b(?:hab|habe|hatte|habs|hab's|hob)\b[^.?!]{0,40}(?<![a-zäöüß])(?:überwiesen|ueberwiesen|bezahlt|gezahlt|eingezahlt|erledigt)(?![a-zäöüß])/i;

/** JJJJ-MM-TT ± Tage (in UTC-Mittag gerechnet — die Tage sind Berliner Kalendertage). Rein. */
function plusTage(iso: string, n: number): string { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function isoAus(j: number, m: number, t: number): string | null {
  const d = new Date(Date.UTC(j, m - 1, t, 12));
  return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t ? d.toISOString().slice(0, 10) : null;
}
function wochentagVon(iso: string): number { const w = new Date(`${iso}T12:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; }
function letzterTag(j: number, m: number): string { return new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10); }
/** Der nächste Tag mit dieser Tageszahl ab heute (heute zählt), sonst im Folgemonat. */
function naechsterTag(heute: string, tag: number): string | null {
  const [j, m] = heute.split("-").map(Number);
  for (let k = 0; k < 3; k++) {
    const mm = ((m - 1 + k) % 12) + 1, jj = j + Math.floor((m - 1 + k) / 12);
    const iso = isoAus(jj, mm, tag);
    if (iso && iso >= heute) return iso;
  }
  return null;
}
/** Tag eines Monats (Monat genannt): dieses Jahr, liegt es zurück, nächstes. */
function tagImMonat(heute: string, monat: number, tag: number | "letzter"): string | null {
  const j = Number(heute.slice(0, 4));
  for (const jj of [j, j + 1]) {
    const iso = tag === "letzter" ? letzterTag(jj, monat) : isoAus(jj, monat, tag);
    if (iso && iso >= heute) return iso;
  }
  return null;
}

/** Die Kandidaten EINES Teilsatzes (ohne Verneinung) — mehrere verschiedene heißen „unklar“. */
function tageImTeil(teil: string, heute: string): string[] {
  const t = ` ${teil.toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ")} `;
  const aus: string[] = [];
  const [hj, hm] = heute.split("-").map(Number);
  // Daten mit Zahl: „30.10.“, „30.10.2026“, „am 30.10“
  for (const m of Array.from(t.matchAll(/(?:^|[^\d.])(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2}))?(?!\d)/g))) {
    const tag = Number(m[1]), mon = Number(m[2]);
    const jahr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    const iso = jahr ? isoAus(jahr, mon, tag) : tagImMonat(heute, mon, tag);
    if (iso) aus.push(iso);
  }
  for (const m of Array.from(t.matchAll(new RegExp(`\\b${PRAEP}\\s+(\\d{1,2})\\.(\\d{1,2})(?![\\d.])`, "g")))) {
    const iso = tagImMonat(heute, Number(m[2]), Number(m[1]));
    if (iso) aus.push(iso);
  }
  // „am 15.“, „zum 15ten“, „bis zum 15.“, „am 3. November“
  for (const m of Array.from(t.matchAll(new RegExp(`\\b${PRAEP}\\s+(\\d{1,2})(?:\\s*\\.|ten|sten|ter|ste)?(?:\\s+${MON_RE})?(?!\\s*(?:\\d|[.,]\\d|euro|€|uhr|h\\b|cent|prozent|%|min|minuten|stunden|std|tag\\b|tage|tagen|wochen?|monate?n?|jahre?n?|mal|raten?))`, "g")))) {
    const tag = Number(m[1]);
    if (tag < 1 || tag > 31) continue;
    const iso = m[2] ? tagImMonat(heute, MONAT[m[2]], tag) : naechsterTag(heute, tag);
    if (iso) aus.push(iso);
  }
  // „am Ersten“, „zum Fünfzehnten“, „den dritten November“ (nie „zum ersten Mal“, „die erste Rate“)
  for (const m of Array.from(t.matchAll(new RegExp(`\\b${PRAEP}\\s+${ORD_RE}\\b(?:\\s+(?:des\\s+monats|im\\s+monat|${MON_RE}))?`, "g")))) {
    const nach = t.slice((m.index ?? 0) + m[0].length);
    if (/^\s*(?:mal|male|rate|raten|monatsrate|schritt|zahlung|überweisung|teil|woche)\b/.test(nach)) continue;
    const tag = ORDINAL[m[1]];
    const monName = m[0].match(new RegExp(`${MON_RE}$`))?.[1];
    const iso = monName ? tagImMonat(heute, MONAT[monName], tag) : naechsterTag(heute, tag);
    if (iso) aus.push(iso);
  }
  // „Monatsletzter“, „am Letzten“, „Ende des Monats“, „Ende nächsten Monats“, „Ende Oktober“
  if (/\bende\s+(?:des\s+|vom\s+)?(?:nächsten|naechsten|kommenden)\s+monats?\b|\b(?:nächsten|naechsten|kommenden)\s+monat\s+(?:am\s+)?ende\b/.test(t)) aus.push(letzterTag(hm === 12 ? hj + 1 : hj, hm === 12 ? 1 : hm + 1));
  else if (/\bende\s+(?:des\s+|vom\s+|diesen\s+|dieses\s+)?monats?\b|\bmonatsende\b|\bmonatsletzt\w*|\b(?:am|zum|bis\s+zum)\s+letzten\b(?!\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|woche|mal|monat|jahr))/.test(t)) aus.push(letzterTag(hj, hm));
  for (const m of Array.from(t.matchAll(new RegExp(`\\bende\\s+${MON_RE}\\b`, "g")))) { const iso = tagImMonat(heute, MONAT[m[1]], "letzter"); if (iso) aus.push(iso); }
  // „Anfang nächsten Monats“, „zum Monatswechsel“, „Monatsanfang“, „Anfang November“
  if (/\b(?:anfang|beginn)\s+(?:des\s+|vom\s+)?(?:nächsten|naechsten|kommenden|neuen)\s+monats?\b|\b(?:nächsten|naechsten|kommenden)\s+monat\s+(?:am\s+)?anfang\b|\bzum\s+(?:monatswechsel|neuen\s+monat)\b|\bmonatswechsel\b/.test(t)) aus.push(isoAus(hm === 12 ? hj + 1 : hj, hm === 12 ? 1 : hm + 1, 1)!);
  else if (/\b(?:anfang|beginn)\s+(?:des\s+|vom\s+)?monats?\b|\bmonatsanfang\b|\bmonatsbeginn\b|\bmonatserst\w*/.test(t)) { const iso = naechsterTag(heute, 1); if (iso) aus.push(iso); }
  for (const m of Array.from(t.matchAll(new RegExp(`\\b(?:anfang|beginn)\\s+${MON_RE}\\b`, "g")))) { const iso = tagImMonat(heute, MONAT[m[1]], 1); if (iso) aus.push(iso); }
  // Wochentage: „Freitag“, „am Freitag“, „nächsten Dienstag“ (Dienstag der NÄCHSTEN Kalenderwoche), „Dienstag nächste Woche“
  for (const m of Array.from(t.matchAll(new RegExp(`(?<![a-zäöüß])(?:(übernächste[nr]?|uebernaechste[nr]?|nächste[nr]?|naechste[nr]?|kommende[nr]?|diese[nr]?|am|letzte[nr]?|vorige[nr]?)\\s+)?(?:woche\\s+)?(?:am\\s+)?${WT_RE}\\b(?:\\s+(?:in\\s+der\\s+)?(übernächste[nr]?|uebernaechste[nr]?|nächste[nr]?|naechste[nr]?|kommende[nr]?)\\s+woche)?`, "g")))) {
    const vor = m[1] ?? "", wt = WOCHENTAG[m[2]], nachWoche = m[3] ?? "";
    if (/^(?:letzte|vorige)/.test(vor)) continue;
    const heuteWt = wochentagVon(heute);
    const woche = /^(?:übernächst|uebernaechst)/.test(vor) || /^(?:übernächst|uebernaechst)/.test(nachWoche) ? 2
      : /^(?:nächst|naechst)/.test(vor) || /^(?:nächst|naechst)/.test(nachWoche) ? 1 : 0;
    if (woche > 0) aus.push(plusTage(heute, 7 * woche - heuteWt + wt));
    else { const d = ((wt - heuteWt + 7) % 7) || 7; aus.push(plusTage(heute, d)); }
  }
  for (const m of Array.from(t.matchAll(new RegExp(`(?<![a-zäöüß])(übernächste|uebernaechste|nächste|naechste|kommende)\\s+woche\\s+(?:am\\s+)?${WT_RE}\\b`, "g")))) {
    const woche = /^(?:übernächst|uebernaechst)/.test(m[1]) ? 2 : 1;
    aus.push(plusTage(heute, 7 * woche - wochentagVon(heute) + WOCHENTAG[m[2]]));
  }
  // „in drei Tagen“, „in einer Woche“, „in zwei Wochen“
  for (const m of Array.from(t.matchAll(/\bin\s+(\d{1,2}|ein|einem|einer|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|zwölf|vierzehn)\s+(tag|tagen|woche|wochen)\b/g))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ZAHLWORT[m[1]];
    if (n) aus.push(plusTage(heute, /^woche/.test(m[2]) ? 7 * n : n));
  }
  // „übermorgen“, „morgen“ (nie „guten Morgen“, „heute Morgen“, „morgens“), „heute“/„heut“
  if (/(?<![a-zäöüß])(?:übermorgen|uebermorgen)(?![a-zäöüß])/.test(t)) aus.push(plusTage(heute, 2));
  else if (/\bmorgen\b/.test(t.replace(/\b(?:guten|heute|heut)\s+morgen\b/g, " "))) aus.push(plusTage(heute, 1));
  if (/\b(?:heute|heut)\b/.test(t) && !/\b(?:heute|heut)\s+in\s+(?:einer|1|zwei|2)\s+wochen?\b/.test(t)) aus.push(heute);
  // „gleich“, „sofort“, „nachher“ — nur, wenn er dabei vom Zahlen redet („Ich zahl's gleich“)
  if (/\b(?:gleich|glei|sofort|nachher|jetzt\s+gleich)\b/.test(t) && /(?<![a-zäöüß])(?:zahl\w*|überweis\w*|ueberweis\w*|einzahl\w*|mach(?:e)?\s+(?:i|ich|des|das|es))(?![a-zäöüß])|mach's|machs/.test(t)) aus.push(heute);
  return aus;
}

/**
 * Ein Zahltag aus der Antwort des Kunden — JJJJ-MM-TT oder null (heuteIso = heute in Berlin). Rein.
 * Erkennt (Echtgespräche 21./22.10.): „heute (noch)“, „morgen“, „übermorgen“, „am Ersten“, „Anfang (nächsten) Monats“, „am
 * Fünfzehnten“ / „am 15.“, „Freitag“, „nächsten Dienstag“ (Dienstag der nächsten Kalenderwoche), „Ende des Monats“, „am 30.10.“,
 * „in drei Tagen“. Verneinte Teile zählen nicht („Heute nicht, aber morgen“ → morgen; „Heute noch nicht“ → null). Nie
 * Vergangenheit, höchstens 45 Tage voraus; zwei verschiedene Tage oder Unklares („Mitte nächster Woche“, „wenn das Gehalt
 * kommt“) → null — dann greift die Rückfrage.
 */
export const ZAHLTAG_HOECHSTENS_TAGE = 45;
export function zahltagAusKunde(text: string, heuteIso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(heuteIso ?? "")) || !Number.isFinite(new Date(`${heuteIso}T12:00:00Z`).getTime())) return null;
  const grenze = plusTage(heuteIso, ZAHLTAG_HOECHSTENS_TAGE);
  // „am 15. November“: der Punkt der Ordnungszahl trennt nie vom Monat.
  const roh = String(text ?? "").toLowerCase().replace(/[’`´]/g, "'").replace(new RegExp(`(\\d{1,2})\\.\\s+${MON_RE}`, "g"), "$1 $2");
  const teile = roh.split(/[,;!?]|\.(?!\d)|\s+(?:aber|sondern|doch|dafür|dafuer|stattdessen)\s+/);
  const tage = new Set<string>();
  for (const teil of teile) {
    if (!teil.trim() || NEGATION.test(teil) || KEIN_ZAHLTAG.test(teil)) continue;
    if (UNKLAR.test(teil)) return null;
    for (const iso of tageImTeil(teil, heuteIso)) if (iso >= heuteIso && iso <= grenze) tage.add(iso);
  }
  return tage.size === 1 ? Array.from(tage)[0] : null;
}

/** Still an die Stimme, wenn sie „ist raus“ sagte, es aber (noch) nicht raus ist. */
export const KORREKTUR_LINK_UNTERWEGS = "Kleine Korrektur, gleich im nächsten Satz und ruhig: Der Link ist noch NICHT bei ihm — er wird gerade geschickt. Sag ehrlich „der kommt in der nächsten Minute“, nie „ist schon da“.";
export const KORREKTUR_LINK_FEHLER = "Korrektur, gleich im nächsten Satz, ehrlich und ruhig: Der Link ist gerade NICHT rausgegangen. Sag z. B. „Der Link is grad ned rausgangen — jemand aus unserem Team schickt ihn Ihnen heute noch.“ Behaupte nichts anderes.";
export const KORREKTUR_ZUSAGE = "Korrektur, gleich im nächsten Satz: Eingetragen ist noch NICHTS. Frag kurz nach dem genauen Tag („Also heute noch, passt des?“) und gib ihn dann an den Hintergrund (zahlungszusage_merken). Sag „notiert“ erst danach.";
/** Wie lange die Brücke dem Modell Zeit lässt, bevor sie selbst handelt (Hintergrund-Modell ~2 s, manchmal bis ~8 s). */
export const WORT_WARTEN_MS = { link: 8000, aufgabe: 6000, zusage: 9000 } as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1. IDENTITÄT VOR DEM ANLIEGEN (Auswertung 21./22.10.: „Grüß Sie, Herr X! … habens an Moment?“ — „Ja“ — „Ihre Rate über
//    99 Euro 99“. Die offene Schuld hört nur der Kunde selbst; oft gehen Partner oder Kinder ran.)
// ═══════════════════════════════════════════════════════════════════════════
export interface PersonName { anrede?: "Herr" | "Frau" | null; nachname?: string | null; vorname?: string | null }

/** Fragt ARAS, wer dran ist? („Spreche ich mit Herrn X selbst?“, „Mit wem spreche ich, bitte?“, Wienerisch „Sprech i mit …“). Rein. */
export function arasFragtIdentitaet(text: string): boolean {
  return /\b(?:spreche?|sprech)\s+(?:ich|i)\s+(?:da\s+|hier\s+|grad\s+|gerade\s+|jetzt\s+)?(?:mit|bei)\b|\bmit\s+wem\s+(?:spreche?|sprech|red(?:e)?)\s+(?:ich|i)\b|\bmit\s+wem\s+(?:hab(?:e)?|hob)\s+(?:ich|i)\b|\bwer\s+(?:ist|is)\s+(?:denn\s+|da\s+)?(?:dran|am\s+apparat|am\s+telefon)\b|\b(?:bin|wäre|waere)\s+(?:ich|i)\s+(?:da\s+|hier\s+|do\s+)?richtig\s+bei\b|\b(?:sind|san|sans)\s+(?:Sie|Sie's|des)\s+(?:selbst|persönlich|persoenlich|der\s+herr|die\s+frau|herr|frau)\b|\b(?:hab(?:e)?|hob)\s+(?:ich|i)\s+(?:da\s+)?(?:den\s+|die\s+)?(?:herrn?|frau)\s+[\wäöüß-]+\s+(?:dran|am\s+apparat|am\s+telefon)\b|\b(?:ist|is)\s+(?:herr|frau)\s+[\wäöüß-]+\s+(?:zu\s+sprechen|da|am\s+apparat|erreichbar)\b|\bam\s+I\s+(?:speaking|talking)\s+(?:to|with)\b|\bwho\s+am\s+I\s+(?:speaking|talking)\s+(?:to|with)\b/i.test(String(text ?? ""));
}

/** Kleinbuchstaben, ohne Akzente (ä → a, č → c), ß → ss. */
function schlicht(text: string): string { return String(text ?? "").toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
/** Kölner Phonetik (Postel 1969) — derselbe Klang, andere Schreibung („Meier“/„Mayer“, „Schmidt“/„Schmitt“). Rein. */
export function koelnerPhonetik(wort: string): string {
  const w = schlicht(wort).replace(/[^a-z]/g, "");
  let codes = "";
  for (let i = 0; i < w.length; i++) {
    const c = w[i], v = w[i - 1] ?? "", n = w[i + 1] ?? "";
    let k = "";
    if ("aeijouy".includes(c)) k = "0";
    else if (c === "b") k = "1";
    else if (c === "p") k = n === "h" ? "3" : "1";
    else if (c === "d" || c === "t") k = "csz".includes(n) && n ? "8" : "2";
    else if ("fvw".includes(c)) k = "3";
    else if ("gkq".includes(c)) k = "4";
    else if (c === "c") k = i === 0 ? ("ahkloqrux".includes(n) && n ? "4" : "8") : ("sz".includes(v) && v ? "8" : "ahkoqux".includes(n) && n ? "4" : "8");
    else if (c === "x") k = "ckq".includes(v) && v ? "8" : "48";
    else if (c === "l") k = "5";
    else if (c === "m" || c === "n") k = "6";
    else if (c === "r") k = "7";
    else if (c === "s" || c === "z") k = "8";
    codes += k;
  }
  let z = "";
  for (const ch of codes) if (ch !== z[z.length - 1]) z += ch;
  return z.charAt(0) + z.slice(1).replace(/0/g, "");
}
function abstand(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let vorher = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1)); vorher = tmp; }
  }
  return d[b.length];
}
/** Wörter, die nie ein Name sind („Hallo“, „über“, „mehr“ …) — sonst hielte die Unschärfe sie für den Nachnamen. */
const KEIN_NAME = new Set(("hallo hello ja jaja jawohl jo nein nee hier bitte danke dankeschon gott gruss guten tag morgen abend wer was wie wo warum wieso "
  + "ich mich mir sie ihnen er es das des der die den dem am an apparat telefon moment mal genau okay gut also herr herrn frau familie und oder aber "
  + "mit von bei fur uber mehr wieder noch schon jetzt gerade grad eben bin ist sind spreche sprechen selbst personlich richtig korrekt stimmt freilich "
  + "sicher klar naturlich worum geht gehts servus tschuss frage fragen anruf rufen kunde fiaon aras rate link whatsapp mail heute gleich glei passt "
  + "kein keine nicht ned nichts ahm hmm mhm wiederhoren bitteschon entschuldigung leitung horen hore verstehe verstanden dran sohn tochter mann").split(" "));
const NAMENSTEILCHEN = new Set(["von", "van", "de", "der", "den", "di", "da", "du", "zu", "la", "le", "del", "ten", "ter", "al", "el", "bin"]);
/**
 * Nennt er den Nachnamen aus dem Briefing? Unscharf (Erkennungsfehler, Dialekt): gleich, ≤ 1–2 Buchstaben anders, gleicher
 * Klang (Kölner Phonetik, gleicher Anfangsbuchstabe) oder der Anfang eines langen Namens („Holler“ für „Hollerbach“ — die Abschrift
 * zerreißt Namen). Doppelnamen: ein Teil genügt. Rein.
 */
export function nameGenannt(text: string, nachname: string | null | undefined): boolean {
  const teile = schlicht(nachname ?? "").split(/[\s-]+/).map((x) => x.replace(/[^a-z]/g, "")).filter((x) => x.length >= 3 && !NAMENSTEILCHEN.has(x));
  if (!teile.length) return false;
  const woerter = schlicht(text).split(/[^a-z]+/).filter((x) => x.length >= 3 && !KEIN_NAME.has(x));
  return woerter.some((w) => teile.some((n) => w === n
    || (n.length >= 4 && abstand(w, n) <= (n.length >= 7 ? 2 : 1))
    || (w.length >= 4 && n.length >= 4 && w[0] === n[0] && koelnerPhonetik(w).length >= (w.length >= 5 && n.length >= 5 ? 2 : 3) && koelnerPhonetik(w) === koelnerPhonetik(n))
    || (n.length >= 6 && w.length >= 4 && n.startsWith(w))));
}
/** „Nein“, „hier ist seine Frau“, „er ist grad ned da“, „ich hol ihn“ — dann ist NICHT er dran. */
const NICHT_ER = /(?:^|[^a-zäöüß])(?:nein|nee|nö|noe|falsch\s+verbunden|nicht\s+(?:da|hier|zu\s+sprechen|zu\s*hause|daheim|im\s+haus|erreichbar|am\s+telefon|persönlich|persoenlich)|ned\s+da|bin\s+(?:ich\s+|i\s+)?(?:nicht|ned)|(?:seine|ihre)\s+(?:frau|mann|tochter|sohn|mutter|vater|partnerin|partner|freundin|freund|schwester|bruder|oma|opa|enkel(?:in)?|nachbar(?:in)?|kollege|kollegin)|ich\s+bin\s+(?:die|der|seine|ihre)\s+(?:frau|mann|tochter|sohn|mutter|vater|partnerin|partner|freundin|freund|schwester|bruder|oma|opa|nachbar\w*|kolleg\w*)|(?:er|sie)\s+(?:ist|is)\s+(?:grad(?:e)?\s+|gerade\s+|leider\s+|momentan\s+|jetzt\s+|noch\s+)?(?:nicht|ned|unterwegs|weg|arbeiten|in\s+der\s+arbeit)|(?:ich\s+|i\s+)?(?:hol|geb)(?:e)?\s+(?:ihn|sie|ihm|ihr)\b)(?![a-zäöüß])/i;
const NA_JA = /^\s*na\s*[,.!]?\s*(?:eh|klar|freilich|sicher|ja|logo|selbstverständlich)\b/i;
/**
 * Ein klares Ja auf die Frage nach der Person — dieselbe Liste wie die Prüf-Regel (Abstimmung mit dem Prüf-Mara-Strang 22.10.):
 * „ja“, „am Apparat“, „bin ich“, „genau“, „selber“ (auch „selbst“, „persönlich“, „ich bin's“, „das bin ich“, Wienerisch „i bins“).
 * Füllwörter davor zählen nicht. „Freilich“, „Mhm“, „Passt“ oder „Worum geht's?“ allein bestätigen NICHT — dann fragt ARAS noch einmal.
 */
const JA_ICH = /^(?:(?:äh+m?|ähm|hm+|also|oh|ach|ah|hallo|ja\s+ja)\b[\s,.…]*)*(?:ja\b|jo\b|jap\b|jep\b|jawohl\b|jaja\b|genau\b|selber\b|selbst\b|persönlich\b|persoenlich\b|höchstpersönlich\b|hoechstpersoenlich\b|am\s+apparat\b|am\s+telefon\b|bin\s+(?:ich|i)\b|ich\s+bin(?:'s|s|\s+es|\s+das|\s+selber|\s+selbst)\b|i\s+bin(?:'s|s)\b|das\s+bin\s+ich\b|des\s+bin\s+i\b|der\s+bin\s+ich\b|die\s+bin\s+ich\b|yes\b|speaking\b|that'?s\s+me\b)/i;
const ANREDE_FALSCH: Record<"Herr" | "Frau", RegExp> = { Herr: /\bfrau\s+([a-zäöüß-]+)/i, Frau: /\bherrn?\s+([a-zäöüß-]+)/i };

/**
 * Seine Antwort auf die Identitätsfrage: „ja“ (klares Ja), „name“ (er nennt seinen Nach- oder Vornamen), „nein“ (nicht er:
 * „Nein, hier ist seine Frau“) oder null (keine Antwort darauf: „Worum geht's?“, „Wer ist da?“, „Hallo?“). Ein Name zählt
 * nicht, wenn die Anrede nicht passt („Frau Huber“ bei Herrn Huber — die Ehefrau) oder ein anderer Vorname davorsteht. Rein.
 */
export function identitaetAntwort(text: string, p: PersonName): "ja" | "name" | "nein" | null {
  const roh = String(text ?? "").trim();
  if (!roh) return null;
  const t = roh.toLowerCase().replace(/[’`´]/g, "'");
  if (NICHT_ER.test(t) && !NA_JA.test(t)) return "nein";
  if (/^\s*na\s*[,.!?]?\s*$/.test(t)) return "nein";
  // Sein Name — Nach- oder Vorname, unscharf (dieselbe Bestätigung wie die Prüf-Regel).
  const name = (!!p.nachname && nameGenannt(roh, p.nachname)) || (!!p.vorname && nameGenannt(roh, p.vorname));
  if (name) {
    const falsch = p.anrede ? ANREDE_FALSCH[p.anrede].exec(t) : null;
    if (falsch && nameGenannt(falsch[1], p.nachname)) return "nein";
    // Ein anderer Vorname direkt am Nachnamen („Hier ist Maria Huber“ bei Thomas Huber) — dann ist es jemand aus der Familie.
    if (p.vorname) {
      const woerter = roh.split(/[^A-Za-zÄÖÜäöüßÀ-ž'-]+/).filter(Boolean);
      const anderer = woerter.some((w, i) => nameGenannt(w, p.nachname) && [woerter[i - 1], woerter[i + 1]].some((x) => !!x && /^[A-ZÄÖÜÀ-Ž]/.test(x) && x.length >= 3
        && !KEIN_NAME.has(schlicht(x)) && !/^(?:herr|herrn|frau|hier|familie|doktor|dr|grüß|gruss|servus|hallo)$/i.test(x)
        && !nameGenannt(x, p.vorname) && !nameGenannt(x, p.nachname)));
      if (anderer) return "nein";
    }
    return "name";
  }
  return JA_ICH.test(t) ? "ja" : null;
}

// Wortgrenzen über Buchstaben inkl. Umlaute: \b greift vor „Ü“ nicht („Überweisung“, „überfällig“ fielen sonst durch).
// Namen wie „Ratenberger“ sind kein Anliegen (Raten nur allein oder mit -zahlung, -pause, -plan, -kauf).
const ANLIEGEN_WORT = /(?<![a-zäöüß])(?:(?:monats|erst|teil|folge)?raten?(?:zahlung[a-zäöüß]*|pausen?|plans?|kauf)?|rechnung[a-zäöüß]*|mahnung[a-zäöüß]*|betr(?:a|ä)g[a-zäöüß]*|euros?|cents?|schulden|forderung[a-zäöüß]*|rückst(?:a|ä)nd[a-zäöüß]*|rueckstand[a-zäöüß]*|überfällig[a-zäöüß]*|ueberfaellig[a-zäöüß]*|verwendungszweck[a-zäöüß]*|kundenkonto[a-zäöüß]*|aktivierung[a-zäöüß]*|kündigung[a-zäöüß]*|kuendigung[a-zäöüß]*|wunschlimit[a-zäöüß]*|limit[a-zäöüß]*|[a-zäöüß]*antr(?:a|ä)g[a-zäöüß]*|beantragt|[a-zäöüß]*zahlung[a-zäöüß]*|überweis[a-zäöüß]*|ueberweis[a-zäöüß]*|bezahl[a-zäöüß]*|einzahl[a-zäöüß]*|zahlens?|[a-zäöüß]*paket[a-zäöüß]*|[a-zäöüß]*vertr(?:a|ä)g[a-zäöüß]*|kreditkart[a-zäöüß]*|[a-zäöüß]*beitr(?:a|ä)g[a-zäöüß]*|[a-zäöüß]*entgelt[a-zäöüß]*|gebühr[a-zäöüß]*|gebuehr[a-zäöüß]*)(?![a-zäöüß])|€|(?<!\d)\d+[.,]\d{2}(?!\d|\s*uhr)/i;
/**
 * Nennt ARAS das Anliegen (Rate, Betrag, Antrag, Zahlung, Vertrag, Limit …)? Vor der bestätigten Identität ist das zu früh —
 * die Brücke korrigiert still. Gibt das Wort zurück (für das Protokoll), sonst null. Rein.
 */
export function arasNenntAnliegen(text: string): string | null {
  const m = ANLIEGEN_WORT.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Still an die Stimme, wenn sie das Anliegen nennt, bevor er bestätigt hat, dass er es ist (Muster wie die anderen Korrekturen). */
export function korrekturIdentitaet(frage: string): string {
  return `Korrektur, ruhig und gleich jetzt: Er hat noch NICHT bestätigt, dass er selbst dran ist — es kann auch jemand anderes sein (Partner, Kind). Nenn nichts weiter zu Rate, Betrag, Antrag, Vertrag oder Zahlung. Frag freundlich: „Entschuldigung — ${frage.charAt(0).toLowerCase()}${frage.slice(1)}“ Erst nach seinem klaren Ja (oder wenn er seinen Namen nennt) geht es weiter.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. STREITFALL (Echtgespräch 21.10.: „Betrugsanzeige erstattet“ — ARAS kündigte trotzdem die Rechnung per WhatsApp an)
// ═══════════════════════════════════════════════════════════════════════════
export type StreitArt = "anzeige" | "betrug" | "polizei" | "anwalt" | "verbraucherzentrale" | "abzocke" | "nie_unterschrieben";
export const STREIT_TEXT: Record<StreitArt, string> = {
  anzeige: "Anzeige erstattet/angedroht", betrug: "spricht von Betrug", polizei: "Polizei", anwalt: "Anwalt/rechtliche Schritte",
  verbraucherzentrale: "Verbraucherzentrale/Konsumentenschutz", abzocke: "spricht von Abzocke", nie_unterschrieben: "sagt, er habe nie etwas unterschrieben/bestellt",
};
const STREIT: { art: StreitArt; re: RegExp }[] = [
  { art: "anzeige", re: /\b(?:straf|betrugs)anzeige\w*|\banzeige\s+(?:erstattet|gemacht|gestellt|erstatten|machen|stellen|aufgegeben|aufgeben|eingereicht|einreichen|bei\s+der\s+polizei|gegen|wegen)\b|\bzur\s+anzeige\s+(?:bringen|gebracht)\b|\b(?:hab|habe|hob|haben|werd|werde|wird|werden)\b[^.?!]{0,30}\b(?:angezeigt|anzeigen)\b|\bzeig(?:e)?\s+(?:Sie|euch|die\s+firma|das|fiaon)\s+an\b/i },
  { art: "polizei", re: /\bpolizei\w*|\bpolice\b/i },
  { art: "anwalt", re: /\b(?:rechts)?anw(?:a|ä|ae)lt\w*|\brechtsbeistand\b|\blawyer\b|\bsolicitor\b|\bverklag\w*|\bvor(?:s|\s+das)?\s+gericht\b|\bklage\s+(?:einreichen|erheben|eingereicht)\b/i },
  { art: "verbraucherzentrale", re: /\bverbraucher(?:zentrale|schutz|schützer|schuetzer|beratung)\w*|\bkonsumentenschutz\w*|\barbeiterkammer\b|\bvki\b/i },
  { art: "abzocke", re: /\babzock\w*|\babgezockt\b|\bnepp\w*|\bscam\b|\bfraud\b/i },
  { art: "betrug", re: /\bbetr(?:u|ü|ue)g\w*|\bbetrog\w*|\bbetrüg\w*|\bbetrueg\w*|\bbetrügerisch\w*/i },
  { art: "nie_unterschrieben", re: /\b(?:nie|niemals|nichts|nix|nicht|keinen\s+vertrag|keinen\s+antrag|kein\s+vertrag)\b[^.?!]{0,40}\b(?:unterschrieben|unterzeichnet|bestellt|beantragt|abgeschlossen|zugestimmt)\b|\b(?:hab|habe)\s+(?:ich\s+|i\s+)?(?:mit\s+(?:Ihnen|euch|fiaon)\s+)?nichts\s+zu\s+tun\b/i },
];
/**
 * Spricht der Kunde von einem Streitfall? Betrug, (Straf-)Anzeige, Polizei, Anwalt, Verbraucherzentrale, Abzocke oder „ich hab
 * nie etwas unterschrieben/bestellt“. Nie: „Anzeige auf Instagram“ (Werbung), „ich bin doch kein Betrüger“ (er will zahlen),
 * „noch nicht unterschrieben“ (noch offen), „Hab ich das nicht schon unterschrieben?“ (er fragt), „nie eine Karte bekommen“ (das
 * ist die Karte, kein Streit). Rein.
 */
export function streitFall(text: string): { art: StreitArt; wort: string } | null {
  const t = String(text ?? "").replace(/[’`´]/g, "'");
  const ohne = t.replace(/\b(?:ich\s+bin|bin\s+ich|i\s+bin)\s+(?:doch\s+|ja\s+|eh\s+)?kein(?:e)?\s+betr(?:ü|ue|u)ger(?:in)?\b/gi, " ")
    .replace(/\bnoch\s+(?:nicht|nichts)\b[^.?!]{0,40}\b(?:unterschrieben|unterzeichnet|bestellt|beantragt|abgeschlossen)\b/gi, " ")
    // Er fragt, ob er schon unterschrieben hat („Hab ich das nicht schon unterschrieben?“) — kein Streit, er will es wissen.
    .replace(/\b(?:nicht|nichts)\s+(?:schon|bereits|eh\s+schon|doch\s+schon)\b[^.?!]{0,40}\b(?:unterschrieben|unterzeichnet|bestellt|beantragt|abgeschlossen|zugestimmt)\b/gi, " ")
    .replace(/(?:^|[.!?,…]\s*)(?:hab|habe|hob|hätte|hätt)\s+(?:ich|i)\b[^.?!]{0,50}\b(?:unterschrieben|unterzeichnet|bestellt|beantragt|abgeschlossen|zugestimmt)\b[^.!?]{0,20}\?/gi, " ");
  for (const s of STREIT) {
    const m = s.re.exec(ohne);
    if (m) return { art: s.art, wort: m[0].trim().slice(0, 60) };
  }
  return null;
}
/** Still an die Stimme: ab jetzt kein Zahlungsdruck, kein Link, keine Tagesfrage — ruhig, ein Mensch meldet sich. */
export const HINWEIS_STREITFALL = "Wichtig, ab sofort: Er spricht von Betrug, Anzeige, Polizei, Anwalt, Verbraucherzentrale oder sagt, er habe nie etwas unterschrieben. Ab jetzt KEIN Wort mehr zu Rate, Zahlung oder Link, KEINE Frage nach dem Zahltag, nichts bestreiten, nichts erklären, nicht verbinden. Sag ruhig und freundlich, dass sich jemand aus unserem Team persönlich bei ihm meldet — z. B. „Das nehm ich ernst — jemand aus unserem Team meldet sich persönlich bei Ihnen.“ Hör ihm zu, dann ein kurzer, freundlicher Abschied. Die Aufgabe für Justin legt das Haus selbst an.";
/** Der Kern für Justins Aufgabe: was er gesagt hat, in seinen Worten (≤ 400 Zeichen). */
export function streitAufgabeText(kundeText: string, art: StreitArt): string {
  return `Streitfall am Telefon (${STREIT_TEXT[art]}): „${String(kundeText ?? "").replace(/\s+/g, " ").trim().slice(0, 240)}“ — ARAS hat nichts mehr gefordert und ist für diese Person aus, bis ein Mensch es zurücknimmt.`.slice(0, 400);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ANSAGE STATT MENSCH (Echtgespräche 21./22.10.: 38–95 s gegen „hinterlassen Sie eine Nachricht nach dem Ton“, Anruf-
//    Assistenten, eine vorgelesene Rufnummer — gezählt als „erreicht“, oft mit Ende „stille“)
// ═══════════════════════════════════════════════════════════════════════════
const ANSAGE = new RegExp([
  // Mailbox & Co. mit Ansage-Umfeld („die Mailbox von …“, „Sie sind verbunden mit der Mobilbox“) — nie „Ihre Nachricht auf meiner Mailbox“
  "\\b(?:mailbox|mobilbox|sprachbox|combox|voicebox|dreibox|sprachspeicher|anrufbeantworter|telefonbeantworter|voicemail)\\s+(?:von|des|der|vom|für|fuer)\\b",
  "\\b(?:hier\\s+ist|dies\\s+ist|das\\s+ist|verbunden\\s+mit|willkommen\\s+(?:bei|auf|in))\\s+(?:der|die|dem|einer|einem|ihrer|meiner)?\\s*(?:persönliche[nr]?\\s+|persoenliche[nr]?\\s+)?(?:mailbox|mobilbox|sprachbox|combox|voicebox|dreibox|sprachspeicher|anrufbeantworter|telefonbeantworter|voicemail)\\b",
  "^\\s*(?:hallo[,.!]?\\s+)?(?:mailbox|mobilbox|sprachbox|combox|voicebox|anrufbeantworter|voicemail)\\b",
  "\\bverbunden\\s+mit\\s+(?:dem\\s+anschluss|der\\s+rufnummer|der\\s+nummer)\\b",
  // Ton/Signal
  "\\bnach\\s+dem\\s+(?:signal|signalton|piep|pieps|piepton|pfeifton|ton|tonsignal|beep)\\b",
  "\\b(?:hinterlassen|hinterlasst|hinterlass)\\s+(?:sie\\s+)?(?:mir\\s+|uns\\s+)?(?:bitte\\s+)?(?:eine|ihre|ihren|deine|ne|'ne|einfach\\s+eine)?\\s*(?:nachricht|sprachnachricht|botschaft|namen)\\b",
  "\\b(?:eine\\s+|ihre\\s+)?nachricht\\s+(?:zu\\s+)?hinterlassen\\b",
  "\\b(?:sprechen\\s+sie|sprich)\\s+(?:mir\\s+|uns\\s+)?(?:bitte\\s+|einfach\\s+|gerne?\\s+)*(?:nach\\s+dem|auf\\s+(?:das\\s+)?band|aufs\\s+band|drauf)\\b",
  // Teilnehmer/Rufnummer nicht erreichbar
  "\\b(?:gewünschte|gewuenschte|gewählte|gewaehlte|angerufene|angewählte|angewaehlte)\\s+(?:gesprächspartner|gespraechspartner|teilnehmer|rufnummer|nummer|person|mobilfunkteilnehmer|anschluss)\\b",
  "\\b(?:teilnehmer|anschluss|rufnummer|mobilfunkteilnehmer)\\s+(?:ist|is)\\s+(?:\\w+\\s+){0,3}(?:nicht\\s+(?:erreichbar|verfügbar|verfuegbar|vergeben)|besetzt)\\b",
  "\\b(?:zurzeit|zur\\s+zeit|derzeit|momentan|vorübergehend|voruebergehend|im\\s+moment|leider|gerade|grad)\\s+(?:leider\\s+)?nicht\\s+(?:erreichbar|verfügbar|verfuegbar|zu\\s+erreichen)\\b",
  "\\bkein\\s+anschluss\\s+unter\\s+dieser\\s+nummer\\b|\\b(?:rufnummer|nummer)\\s+ist\\s+nicht\\s+vergeben\\b",
  "\\b(?:kann|können|koennen)\\s+(?:ihren|deinen|den|euren)\\s+anruf\\s+(?:\\w+\\s+){0,3}nicht\\s+(?:entgegennehmen|annehmen|beantworten)\\b",
  // Anruf-Assistenten (Anruffilter, Call Screen)
  "\\b(?:nennen|sagen)\\s+sie\\s+(?:mir\\s+)?(?:bitte\\s+)?(?:ihren\\s+namen|den\\s+grund|wer\\s+sie\\s+sind)\\b",
  "\\bgrund\\s+(?:ihres|für\\s+ihren|fuer\\s+ihren|des)\\s+anruf",
  "\\b(?:anruffilter\\w*|filterdienst\\w*|anruf-?assistent\\w*|anrufassistenz|call\\s+screen\\w*|screening\\w*|anrufprüfung|anrufpruefung)\\b",
  "\\bkopie\\s+(?:dieses|dieser|des)\\s+(?:gesprächs|gespraechs|unterhaltung|anrufs)\\b",
  "\\bob\\s+(?:die\\s+person|er|sie)\\s+(?:gerade\\s+)?(?:verfügbar|verfuegbar|erreichbar|zu\\s+sprechen)\\s+ist\\b",
  "\\b(?:digitale[rn]?|persönliche[rn]?|persoenliche[rn]?|virtuelle[rn]?)\\s+(?:assistent|assistentin|sekretär\\w*|sekretaer\\w*)\\s+(?:von|des|der)\\b",
  // Englisch
  "\\bleave\\s+(?:a|your)\\s+(?:message|name)\\b|\\bafter\\s+the\\s+(?:tone|beep)\\b|\\b(?:is|are)\\s+not\\s+available\\b|\\bcan'?t\\s+(?:take|answer)\\s+(?:your|the)\\s+call\\b|\\bcannot\\s+take\\s+your\\s+call\\b|\\breason\\s+for\\s+(?:your\\s+)?call(?:ing)?\\b|\\bstate\\s+your\\s+name\\b|\\bthe\\s+(?:person|number|subscriber)\\s+you\\s+(?:are\\s+calling|have\\s+(?:dialed|called))\\b",
].join("|"), "i");
/** Eine vorgelesene Rufnummer (≥ 8 Ziffern in einer Zeile) — so beginnt manche Ansage („Die Mailbox von 0 1 7 …“). */
function rufnummerVorgelesen(text: string): boolean {
  const ziffern = (String(text ?? "").match(/\d/g) ?? []).length;
  const zahlwoerter = (String(text ?? "").toLowerCase().match(/\b(?:null|eins|zwei|zwo|drei|vier|fünf|fuenf|sechs|sieben|acht|neun)\b/g) ?? []).length;
  return ziffern >= 8 || zahlwoerter >= 7;
}
/** Klingt das wie eine Ansage (Mailbox, Anrufbeantworter, Anruf-Assistent, „nicht erreichbar“)? Deutsch und Englisch. Rein. */
export function istAnsage(text: string): boolean {
  const t = String(text ?? "").replace(/[’`´]/g, "'");
  return ANSAGE.test(t) || rufnummerVorgelesen(t);
}
/** Für Protokoll und Prüfstand: das Ansage-Stück, das erkannt wurde (oder null). Rein. */
export function ansageWort(text: string): string | null {
  const t = String(text ?? "").replace(/[’`´]/g, "'");
  const m = ANSAGE.exec(t);
  return m ? m[0].trim().slice(0, 80) : rufnummerVorgelesen(t) ? "vorgelesene Rufnummer" : null;
}
