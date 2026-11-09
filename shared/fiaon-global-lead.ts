// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER BUSINESS-LEAD IN KLARTEXT (E-476 Scheibe 1+2, 05.11.2026)
//
// Justin (04.11.2026): „Ich möchte für jeden Business-Kunden, der sich einträgt, eine E-Mail bekommen mit allen
// Details zu den Kunden und kurzen Backcheck — wer ist das? Seriös? Unternehmensgröße? Wichtige Infos —, damit ich
// bestens informiert bin, wenn ich den Lead anrufe.“
//
// ── DER BEFUND (Kartierung 04.11.) ────────────────────────────────────────────
// Die Antworten der Meta-Formulare standen überall nur als Codes („Vorhaben: vorhaben_3“) — in der Anfrage, im
// Firmen-Cockpit und in Daniels Auftrag. Der Klartext samt Fragetext lag die ganze Zeit in
// fiaon_meta_formulare.fragen[].options (formularSpeichern, fiaon-meta-leads.ts). Firmenfelder hießen „Siehe oben“,
// „Mehrere“ oder trugen den eigenen Namen; viele Anfragen kamen von Freemail-Adressen.
//
// ── WAS HIER STEHT (rein, ohne Datenbank — Server, Prüfstand und Vorschau lesen dieselben Regeln) ─────────────
//   · Klartext: Schlüssel → Fragetext (bis zum ersten „?“ — so fällt der Institut-Satz des Rahmen-Labels weg) und
//     Options-Schlüssel → Antworttext, aus der gespeicherten Formular-Definition; ohne Definition der lesbare
//     Schlüssel und der rohe Wert. Rückweg aus dem Anfrage-Text (alte Codes UND neuer Klartext).
//   · ZWEI FASSUNGEN AN EINER STELLE (Gutachten 1, Mangel 7): intern der Klartext fürs Dossier und das Team; für den
//     Kunden ein Satz in Sie-Form ohne Betrag (kundenSatz) — vorbereitet für die Lead-Mails (Scheibe 4), heute von
//     keiner Mail benutzt.
//   · Die hauseigenen Platzhalter für „keine Firma“ als EINE Konstante (Gutachten 0, Mangel 20) — die Eingänge
//     bauen sie damit, firmaBrauchbar erkennt sie daran.
//   · Freemail (nie eine Firmen-Website), Telefon-Land aus der Vorwahl, Temperatur aus SEINEN Antworten
//     (statt einer Farb-Ampel im Betreff, Gutachten 1, Mangel 12), Hinweis „Privatkunde/Beschwerde?“ aus
//     Signalwörtern, Betreff-Stamm des Mail-Fadens, Tagesdeckel und Register-Budget als reine Entscheidungen.
//   · NACHBESSERUNG nach drei Gutachten (05.11.2026): Füllwörter („Selbstständig“, „Mehrere Firmen“) sind keine Firma;
//     Freemail-Liste um die mail.com-Familie und Provider-Adressen ergänzt, Wegwerf-Adressen als eigene Liste; „+49 (0)“
//     und „+49 0151“ wählen richtig, eine doppelt eingetragene Ländervorwahl wird gemeldet; die Beschwerde-Erkennung
//     zählt Wörter nur im Zusammenhang („Anzeige erstatten“, nicht „Ihre Anzeige gesehen“) und schlägt erst bei zwei
//     starken Signalen oder einem Signal plus Privat-Bestand an; der Paketwunsch der Website zählt für die Temperatur.
//
// Repo ist öffentlich: keine Kundennamen, keine Mailadressen, keine Nummern — Beispiele nur mit example.com.
// ═══════════════════════════════════════════════════════════════════════════
import { RADAR_FREEMAIL } from "./fiaon-radar";

// ── Platzhalter für „keine Firma“ (die EINE Stelle) ─────────────────────────
/** Meta-Formular ohne Firmenfeld: „<Name> (Firma noch offen)“ (fiaon-meta-leads.ts). */
export const FIRMA_OFFEN_ZUSATZ = "(Firma noch offen)";
/** Website-Anfrage ohne Firma: „Privatperson · <Name>“ bzw. „Private individual · <Name>“ (fiaon-global-termin.ts). */
export const PRIVATPERSON_WORT = { de: "Privatperson", en: "Private individual" } as const;

export function firmaOffenPlatzhalter(name: string): string {
  return `${name} ${FIRMA_OFFEN_ZUSATZ}`;
}
export function privatpersonPlatzhalter(name: string, sprache: "de" | "en" = "de"): string {
  return `${PRIVATPERSON_WORT[sprache]} · ${name}`;
}

/** Was im Firmenfeld steht, aber keine Firma ist (gemessen 04.11.: „Siehe oben“, „Mehrere“, der eigene Name …). */
const KEINE_FIRMA = /^(?:siehe\s+oben|s\.\s*o\.?|so|mehrere|diverse|verschiedene|keine?|keine\s+firma|kein\s+unternehmen|ohne(?:\s+firma)?|privat|privatperson|private?|noch\s+(?:offen|keine)|offen|n\.?\s*\/?\s*a\.?|none|null|nix|nichts|test|tbd|folgt|später|in\s+gründung|gründung|-+|\.+|x+|\?+)$/i;
/**
 * Nachbesserung (Gutachten Technik + Justin-Sicht, 05.11.2026): Rollen und Füllwörter statt eines Firmennamens —
 * „Selbstständig“, „Einzelunternehmen“, „Freiberufler“, „Inhaber“, „Geschäftsführer“, „Ich“, „Holding“. Sie kosteten
 * eine Register-Suche und eine Websuche nach einem Allerweltswort.
 */
const FUELLWORT_FIRMA = /^(?:ich|wir|selbst(?:st)?(?:ä|ae)ndig\w*(?:\s+t(?:ä|ae)tig)?|einzelunternehm\w*|freiberufl\w*|freelanc\w*|inhaber(?:in)?|gesch(?:ä|ae)ftsf(?:ü|ue)hr\w*|gf|ceo|holding|unternehmer(?:in)?|start-?up|privatier|rentner(?:in)?|angestellte?r?)$/i;
/** „Mehrere Firmen“, „Diverse GmbHs“, „Verschiedene Unternehmen“ — mit Folgewort. */
const MEHRERE_FIRMEN = /^(?:mehrere|diverse|verschiedene|einige|viele)\b/i;

/** Rechtsformen im Firmennamen (DACH und die üblichen ausländischen) — nur ein Erkennungszeichen, kein Urteil. */
const RECHTSFORM = /(?:^|[\s,.(])(gmbh\s*&\s*co\.?\s*kg|gmbh|ggmbh|ug(?:\s*\(haftungsbeschränkt\))?|mbh|ag|kgaa|kg|ohg|og|gbr|e\.\s?k\.?|e\.\s?kfm\.?|e\.\s?kfr\.?|e\.\s?u\.?|eg|e\.\s?v\.?|se|partg(?:\s*mbb)?|keg|sàrl|sarl|sa|ltd\.?|limited|llc|inc\.?|corp\.?|plc|bv|b\.v\.|s\.r\.o\.|sp\.\s?z\s?o\.o\.|srl|s\.r\.l\.|spa|s\.p\.a\.)(?=$|[\s,.)])/i;

export function rechtsformIm(firma: string | null | undefined): string | null {
  const m = RECHTSFORM.exec(String(firma ?? ""));
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

/** Klein, ohne Akzente, nur Buchstaben/Ziffern und einzelne Leerzeichen — für Namensvergleiche. */
export function namenForm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Der Kern eines Firmennamens: ohne Rechtsform und Füllwörter — „Muster Logistik GmbH“ → „muster logistik“. */
export function firmenKern(firma: unknown): string {
  return namenForm(String(firma ?? "").replace(new RegExp(RECHTSFORM.source, "gi"), " "))
    .replace(/\b(und|and|co|the|die|der|das)\b/g, " ").replace(/\s+/g, " ").trim();
}

export interface FirmaUrteil { brauchbar: boolean; grund: string | null; rechtsform: string | null }

/**
 * Taugt das Firmenfeld für Register und Websuche? Nein bei leerem Feld, den hauseigenen Platzhaltern, Füllwörtern
 * („Siehe oben“, „Mehrere“) und dem eigenen Namen des Anfragenden (ohne Rechtsform). Rein.
 */
export function firmaBrauchbar(firmaRoh: unknown, personName?: unknown): FirmaUrteil {
  const firma = String(firmaRoh ?? "").replace(/\s+/g, " ").trim();
  const rechtsform = rechtsformIm(firma);
  if (firma.length < 2) return { brauchbar: false, grund: "kein Firmenname", rechtsform: null };
  if (firma.includes(FIRMA_OFFEN_ZUSATZ)) return { brauchbar: false, grund: "Firma im Formular nicht angegeben", rechtsform: null };
  if (/^(Privatperson|Private individual)\s·\s/.test(firma)) return { brauchbar: false, grund: "ohne Firma angefragt (Privatperson)", rechtsform: null };
  if (KEINE_FIRMA.test(firma) || FUELLWORT_FIRMA.test(firma) || MEHRERE_FIRMEN.test(firma)) {
    return { brauchbar: false, grund: `Firmenfeld „${firma.slice(0, 40)}“ ist kein Firmenname`, rechtsform: null };
  }
  const person = namenForm(personName);
  const f = namenForm(firma);
  if (!rechtsform && person && f) {
    const teile = person.split(" ").filter((t) => t.length >= 2);
    if (f === person || teile.includes(f) || (teile.length >= 2 && f === teile.slice().reverse().join(" "))) {
      return { brauchbar: false, grund: "im Firmenfeld steht der eigene Name", rechtsform: null };
    }
  }
  if (firmenKern(firma).length < 2) return { brauchbar: false, grund: "Firmenname zu kurz", rechtsform };
  return { brauchbar: true, grund: null, rechtsform };
}

/** Rollen- und Füllwörter, die auch in längeren Angaben nie eine Firma benennen („Selbständig / Freiberufler“, „Kleingewerbe“). */
const ROLLE_IM_FELD = /selbst(?:st)?(?:ä|ae|a)ndig|freiberuf|freelanc|einzelunternehm|kleingewerb|gewerbetreib|nebengewerb|privat|rentner|angestellt|inhaber|gesch(?:ä|ae)ftsf(?:ü|ue)hr|unternehmer|siehe oben|noch offen|keine angabe/i;

/**
 * E-487 (09.11.2026): Darf der Firmenname ALLEIN zwei Eingänge auf EINE Firmen-Karte legen? Nur, wenn er eindeutig eine
 * Firma benennt: firmaBrauchbar, mit Rechtsform (GmbH, UG, AG, KG, e. K., Ltd, LLC …) und ohne Rollen-/Füllwort.
 * Alles andere („Selbständig“, „Selbständig / Freiberufler“, „Kleingewerbe“, „Immobilien“, „GmbH“ allein, der eigene
 * Name) verbindet nur über Person, E-Mail oder Telefon — lieber zwei Karten derselben Person als fremde Menschen
 * auf einer Karte (vorher: drei Leads mit „Selbständig“ teilten Karte, Notizen und „bitte nicht anrufen“). Rein.
 */
export function firmaNameVerbindet(firmaRoh: unknown, personName?: unknown): boolean {
  const firma = String(firmaRoh ?? "").replace(/\s+/g, " ").trim();
  const u = firmaBrauchbar(firma, personName);
  if (!u.brauchbar || !u.rechtsform) return false;
  return !ROLLE_IM_FELD.test(firma);
}

// ── Freemail: nie eine Firmen-Website ───────────────────────────────────────
/** RADAR_FREEMAIL plus die Anbieter, die am 04.11. fehlten (aol.com, seznam.cz) und die üblichen in DACH/Europa. */
export const LEAD_FREEMAIL: ReadonlySet<string> = new Set([
  ...Array.from(RADAR_FREEMAIL),
  "aol.com", "aol.de", "aim.com", "gmx.com", "gmx.eu", "gmx.li", "gmx.fr", "gmx.org", "gmx.us", "gmx.info", "mail.de", "email.de",
  "online.de", "arcor.de", "vodafone.de", "kabelmail.de", "unitybox.de", "t-online.at", "msn.com", "msn.de", "live.de", "live.at",
  "live.ch", "hotmail.ch", "hotmail.at", "hotmail.co.uk", "hotmail.fr", "hotmail.it", "hotmail.es", "hotmail.com.tr",
  "outlook.at", "outlook.ch", "outlook.fr", "outlook.it", "outlook.es", "yahoo.co.uk", "yahoo.at", "yahoo.ch", "yahoo.fr",
  "yahoo.it", "yahoo.es", "yahoo.com.br", "ymail.com", "ymail.de", "rocketmail.com", "mac.com", "icloud.de", "icloud.ch",
  "seznam.cz", "email.cz", "centrum.cz", "wp.pl", "vp.pl", "o2.pl", "onet.pl", "interia.pl", "libero.it", "virgilio.it",
  "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr", "sunrise.ch", "hispeed.ch", "bluemail.ch", "gmx.it",
  "protonmail.ch", "proton.me", "pm.me", "tutanota.com", "tutanota.de", "tuta.io", "tuta.com", "mailbox.org", "posteo.net",
  "posteo.at", "posteo.ch", "fastmail.com", "fastmail.fm", "hey.com", "duck.com", "zoho.com", "zohomail.eu", "yandex.ru",
  "yandex.com", "mail.ru", "a1.net", "chello.at", "kabsi.at", "tele2.at", "utanet.at", "inode.at", "abv.bg", "inbox.lv",
  "googlemail.de", "gmail.de",
  // Die mail.com-Familie (ein Anbieter, viele Domains — Gutachten Technik 05.11.2026).
  "mail.com", "email.com", "usa.com", "myself.com", "consultant.com", "post.com", "europe.com", "engineer.com", "techie.com",
  "writeme.com", "iname.com", "cheerful.com", "dr.com", "accountant.com", "asia.com", "contractor.net", "workmail.com",
  "lawyer.com", "financier.com", "doctor.com", "musician.org", "photographer.net", "programmer.net", "solution4u.com",
  // Adressen der Internet-Anbieter (Kabel, DSL, Stadtnetze): eine private Postadresse, nie die Website einer Firma.
  "magenta.de", "ewe.net", "ewetel.net", "kabelbw.de", "netcologne.de", "versanet.de", "htp-tel.de", "1und1.de", "ish.de",
  "unitymedia.de", "osnanet.de", "mnet-online.de", "dokom.net", "wtnet.de", "gelsen-net.de", "teleos-web.de", "nexgo.de",
  "telenet.be", "skynet.be", "ziggo.nl", "kpnmail.nl", "home.nl", "planet.nl", "tiscali.it", "alice.it", "bigpond.com",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net", "btinternet.com",
  "sky.com", "virginmedia.com", "talktalk.net",
]);

/**
 * Wegwerf-Adressen (Gutachten Sicherheit 05.11.2026): eine Adresse für zehn Minuten. Im Check steht „Wegwerf-Adresse“,
 * und es gibt nie einen KI-Check — wer so anfragt, will nicht gefunden werden.
 */
export const LEAD_WEGWERF: ReadonlySet<string> = new Set([
  "yopmail.com", "yopmail.fr", "yopmail.net", "mailinator.com", "mailinator.net", "trashmail.de", "trashmail.com", "trashmail.net",
  "guerrillamail.com", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "10minutemail.de", "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net",
  "tempmailo.com", "tempail.com", "throwawaymail.com", "dispostable.com", "maildrop.cc", "getnada.com", "nada.email",
  "mailnesia.com", "wegwerfmail.de", "wegwerfmail.net", "wegwerfadresse.de", "einrot.com", "spambog.com", "spambog.de",
  "spam4.me", "mintemail.com", "emailondeck.com", "fakeinbox.com", "mohmal.com", "burnermail.io", "mytemp.email",
  "tmpmail.org", "tmail.ws", "mailcatch.com", "discard.email", "anonbox.net", "byom.de", "spamgourmet.com",
]);

/** Die Domäne einer Mailadresse, klein — sonst null. */
export function mailDomainAus(email: unknown): string | null {
  const m = /^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(email ?? "").trim());
  return m ? m[1].toLowerCase().replace(/\.+$/, "") : null;
}

/** Eine Wegwerf-Adresse (auch Unterdomänen)? Rein. */
export function istWegwerf(domain: unknown): boolean {
  const d = String(domain ?? "").trim().toLowerCase();
  if (!d) return false;
  if (LEAD_WEGWERF.has(d)) return true;
  for (const f of Array.from(LEAD_WEGWERF)) if (d.endsWith(`.${f}`)) return true;
  return false;
}

/** Freemail, Provider- oder Wegwerf-Adresse — nie die Website einer Firma. Rein. */
export function istFreemail(domain: unknown): boolean {
  const d = String(domain ?? "").trim().toLowerCase();
  if (!d) return false;
  if (LEAD_FREEMAIL.has(d) || istWegwerf(d)) return true;
  // Unterdomänen der Anbieter („mail.gmx.net“) und Ländervarianten mit „googlemail“/„hotmail“/„outlook“/„yahoo“.
  for (const f of Array.from(LEAD_FREEMAIL)) if (d.endsWith(`.${f}`)) return true;
  return /^(googlemail|hotmail|outlook|yahoo|ymail|live|msn|gmx|aol|icloud|posteo|proton|protonmail|tutanota|t-online)\.[a-z.]{2,6}$/.test(d);
}

/**
 * Passt die Domain zum Firmennamen? „muster-logistik.example“ ↔ „Muster Logistik GmbH“ ja; „info-shop.example“ ↔ „Muster GmbH“ nein.
 * Verglichen wird der Name vor der Endung (ohne Bindestriche) mit dem Namenskern (ohne Rechtsform, ohne Leerzeichen),
 * erst ab fünf Zeichen — ein kurzer Kern passt sonst zu allem. Rein.
 */
export function domainPasstZurFirma(domain: unknown, firma: unknown): boolean {
  const d = String(domain ?? "").toLowerCase().replace(/^www\./, "");
  const teile = d.split(".");
  if (teile.length < 2) return false;
  const name = teile.slice(0, -1).join("").replace(/[^a-z0-9]/g, "");
  const kern = firmenKern(firma).replace(/\s+/g, "");
  if (kern.length < 5 || name.length < 5) return false;
  return name === kern || name.includes(kern) || kern.includes(name);
}

/** Die Firmen-Domäne einer Mailadresse: null bei Freemail, ohne Adresse und bei FIAON selbst. Rein. */
export function firmenDomain(email: unknown): string | null {
  const d = mailDomainAus(email);
  if (!d || istFreemail(d)) return null;
  if (/(^|\.)fiaon\.(com|de|at|ch)$/.test(d)) return null;
  return d;
}

// ── Telefon-Land aus der Vorwahl ────────────────────────────────────────────
const VORWAHLEN: Record<string, [string, string]> = {
  "49": ["DE", "Deutschland"], "43": ["AT", "Österreich"], "41": ["CH", "Schweiz"], "423": ["LI", "Liechtenstein"],
  "352": ["LU", "Luxemburg"], "31": ["NL", "Niederlande"], "32": ["BE", "Belgien"], "33": ["FR", "Frankreich"],
  "34": ["ES", "Spanien"], "39": ["IT", "Italien"], "351": ["PT", "Portugal"], "353": ["IE", "Irland"],
  "44": ["GB", "Vereinigtes Königreich"], "45": ["DK", "Dänemark"], "46": ["SE", "Schweden"], "47": ["NO", "Norwegen"],
  "358": ["FI", "Finnland"], "48": ["PL", "Polen"], "420": ["CZ", "Tschechien"], "421": ["SK", "Slowakei"],
  "36": ["HU", "Ungarn"], "386": ["SI", "Slowenien"], "385": ["HR", "Kroatien"], "381": ["RS", "Serbien"],
  "387": ["BA", "Bosnien und Herzegowina"], "382": ["ME", "Montenegro"], "383": ["XK", "Kosovo"], "389": ["MK", "Nordmazedonien"],
  "355": ["AL", "Albanien"], "359": ["BG", "Bulgarien"], "40": ["RO", "Rumänien"], "30": ["GR", "Griechenland"],
  "357": ["CY", "Zypern"], "356": ["MT", "Malta"], "370": ["LT", "Litauen"], "371": ["LV", "Lettland"], "372": ["EE", "Estland"],
  "377": ["MC", "Monaco"], "90": ["TR", "Türkei"], "380": ["UA", "Ukraine"], "373": ["MD", "Moldau"], "7": ["RU", "Russland/Kasachstan"],
  "1": ["US", "USA/Kanada"], "20": ["EG", "Ägypten"], "212": ["MA", "Marokko"], "213": ["DZ", "Algerien"], "216": ["TN", "Tunesien"],
  "971": ["AE", "Vereinigte Arabische Emirate"], "966": ["SA", "Saudi-Arabien"], "974": ["QA", "Katar"], "965": ["KW", "Kuwait"],
  "968": ["OM", "Oman"], "973": ["BH", "Bahrain"], "972": ["IL", "Israel"], "962": ["JO", "Jordanien"], "961": ["LB", "Libanon"],
  "963": ["SY", "Syrien"], "964": ["IQ", "Irak"], "98": ["IR", "Iran"], "995": ["GE", "Georgien"], "374": ["AM", "Armenien"],
  "994": ["AZ", "Aserbaidschan"], "92": ["PK", "Pakistan"], "91": ["IN", "Indien"], "86": ["CN", "China"], "81": ["JP", "Japan"],
  "65": ["SG", "Singapur"], "66": ["TH", "Thailand"], "61": ["AU", "Australien"], "64": ["NZ", "Neuseeland"],
  "27": ["ZA", "Südafrika"], "234": ["NG", "Nigeria"], "254": ["KE", "Kenia"], "55": ["BR", "Brasilien"], "52": ["MX", "Mexiko"],
};

export interface TelefonLand {
  /** Internationale Schreibweise (+49151…) — null ohne erkennbare Vorwahl. Bei einer bereinigten Eingabe die bereinigte Form. */
  e164: string | null;
  land: string | null;
  landName: string | null;
  vorwahl: string | null;
  /** Nummer von außerhalb DE/AT/CH. */
  ausland: boolean;
  /** Ein Satz für das Dossier: „Deutschland (+49)“, „Ausland: Ägypten (+20)“, „ohne Ländervorwahl“. */
  text: string;
  /**
   * Nachbesserung (05.11.2026): Die Eingabe sah falsch aus — eine 0 nach der Ländervorwahl („+49 0151 …“), die
   * Ländervorwahl doppelt („+43 43 664 …“) oder „+0…“. Dann steht hier, was auffiel; gewählt wird die bereinigte Form
   * (e164), und das Dossier zeigt „?“ statt „✓“ und daneben, was eingetragen war. null = sieht richtig aus.
   */
  pruefen: string | null;
  /** Was der Lead eingetragen hat (nur, wenn `pruefen` gesetzt ist). */
  eingetragen: string | null;
}

/**
 * Handy-Vorwahlen je Land (nationale Nummer ohne 0) — nur für die Frage „Ländervorwahl doppelt?“: Folgt nach der
 * doppelten Vorwahl eine Handynummer, war es ein Tippfehler; eine echte Ortsvorwahl wie 4352 (Wolfsberg) bleibt.
 */
const HANDY_NACH_DOPPELT: Record<string, RegExp> = {
  DE: /^1[5-7]\d{8,9}$/, AT: /^6[5-9]\d{7,11}$/, CH: /^7[4-9]\d{7}$/,
};

/**
 * Land aus der Vorwahl (längster Treffer). „0049…“ zählt wie „+49…“; eine Nummer ohne Vorwahl hat kein Land.
 * „+49 (0) 151 …“: die (0) ist eine Schreibweise, keine Ziffer zum Wählen. „+49 0151 …“ und „+43 43 664 …“ werden
 * bereinigt und gemeldet (Gutachten Technik + Justin-Sicht 05.11.2026: der tel:-Knopf wählte sonst ins Leere). Rein.
 */
export function landAusTelefon(telefon: unknown): TelefonLand {
  const roh = String(telefon ?? "").trim();
  const ohneKlammerNull = roh.replace(/\(\s*0\s*\)/g, " ");
  const ziffern = ohneKlammerNull.replace(/\D/g, "");
  const leer: TelefonLand = { e164: null, land: null, landName: null, vorwahl: null, ausland: false, text: roh ? "ohne Ländervorwahl" : "keine Nummer", pruefen: null, eingetragen: null };
  if (ziffern.length < 6) return leer;
  let international: string | null = null;
  if (ohneKlammerNull.startsWith("+")) {
    if (ziffern.startsWith("00")) international = ziffern.slice(2);
    else if (ziffern.startsWith("0")) {
      // „+0151 …“: ein Plus vor einer deutschen Ortsform — keine Ländervorwahl, kein Auslandsanruf.
      return { ...leer, text: "ohne gültige Ländervorwahl (+0…)", pruefen: "nach dem + steht eine 0 — Ländervorwahl fehlt", eingetragen: roh };
    } else international = ziffern;
  } else if (ziffern.startsWith("00")) international = ziffern.slice(2);
  if (!international) return leer;
  for (const laenge of [3, 2, 1]) {
    const v = international.slice(0, laenge);
    const t = VORWAHLEN[v];
    if (!t) continue;
    let rest = international.slice(laenge);
    let pruefen: string | null = null;
    if (["DE", "AT", "CH"].includes(t[0]) && /^0+[1-9]/.test(rest)) {
      rest = rest.replace(/^0+/, "");
      pruefen = `0 nach +${v} eingetragen — gewählt wird ohne die 0`;
    } else if (HANDY_NACH_DOPPELT[t[0]] && rest.startsWith(v) && HANDY_NACH_DOPPELT[t[0]].test(rest.slice(v.length))) {
      rest = rest.slice(v.length);
      pruefen = `Ländervorwahl +${v} doppelt eingetragen — gewählt wird die Nummer mit einer Vorwahl`;
    }
    const ausland = !["DE", "AT", "CH"].includes(t[0]);
    return {
      e164: `+${v}${rest}`, land: t[0], landName: t[1], vorwahl: `+${v}`, ausland,
      text: ausland ? `Ausland: ${t[1]} (+${v})` : `${t[1]} (+${v})`,
      pruefen, eingetragen: pruefen ? roh : null,
    };
  }
  return { e164: `+${international}`, land: null, landName: null, vorwahl: null, ausland: true, text: `Ausland (+${international.slice(0, 3)}…)`, pruefen: null, eingetragen: null };
}

/** „+49 151 00000000“ — lesbar für die Mail, die Wählform bleibt e164. Rein. */
export function telefonLesbar(t: TelefonLand, roh: unknown): string {
  if (!t.e164 || !t.vorwahl) return String(roh ?? "").trim();
  const rest = t.e164.slice(t.vorwahl.length);
  return rest.length > 6 ? `${t.vorwahl} ${rest.slice(0, 3)} ${rest.slice(3)}` : `${t.vorwahl} ${rest}`;
}

// ── Klartext der Formular-Antworten ─────────────────────────────────────────
export interface MetaFrageDef { key?: string | null; label?: string | null; type?: string | null; options?: { key?: string | null; value?: string | null }[] | null }

export interface LeadAntwort {
  /** Schlüssel der Frage im Formular („wann_starten“) — null, wenn nur der Text bekannt ist. */
  schluessel: string | null;
  /** Fragetext bis zum ersten „?“ („Wann möchten Sie starten?“). */
  frage: string;
  /** Antwort im Klartext, wie der Lead sie gewählt hat. */
  antwort: string;
  /** Options-Schlüssel („wann_starten_1“) — null bei Freitext oder unbekannter Option. */
  code: string | null;
}

/** Felder, die keine Antwort auf eine Frage sind (Kontakt, Firma). */
export const META_KONTAKTFELDER: readonly string[] = [
  "first_name", "vorname", "last_name", "nachname", "familienname", "full_name", "name", "vollständiger_name", "vollstaendiger_name",
  "vor-_und_nachname", "vor_und_nachname", "email", "e-mail", "e_mail", "email_adresse", "e-mail-adresse", "phone_number", "phone",
  "telefon", "telefonnummer", "handynummer", "mobilnummer", "mobile", "country", "land",
  "company_name", "firma", "unternehmen", "firmenname", "name_des_unternehmens",
];

/** Meta liefert eigene Fragen als Schlüssel („wann_möchten_sie_gründen?“) — lesbar machen (wie fiaon-meta-leads.ts). */
export function schluesselLesbar(schluessel: string): string {
  const t = String(schluessel).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Der Fragetext bis zum ersten „?“ — „Welchen Kapitalrahmen planen Sie als Ziel? Über jeden Rahmen entscheidet …“ wird
 * „Welchen Kapitalrahmen planen Sie als Ziel?“. Ohne „?“ der ganze (gekürzte) Text. Rein.
 */
export function frageKurz(label: unknown): string {
  const t = String(label ?? "").replace(/\s+/g, " ").trim();
  const i = t.indexOf("?");
  return (i > 0 ? t.slice(0, i + 1) : t).slice(0, 140).trim();
}

/** Eine Antwort-Zeile für Anfrage, Cockpit und Auftrag: „Wann möchten Sie starten? — So bald wie möglich“. Rein. */
export function antwortZeile(a: Pick<LeadAntwort, "frage" | "antwort">): string {
  return /[?:]$/.test(a.frage) ? `${a.frage} — ${a.antwort}` : `${a.frage}: ${a.antwort}`;
}

/**
 * Antworten eines Meta-Leads in Klartext. `fragen` = Feld → Wert aus dem Lead (Werte sind bei Auswahlfragen die
 * Options-Schlüssel), `defs` = fiaon_meta_formulare.fragen. Kontakt- und Firmenfelder fallen weg. Ohne Definition:
 * lesbarer Schlüssel + roher Wert (wie bisher). Rein.
 */
export function metaAntworten(fragen: Record<string, string>, defs: readonly MetaFrageDef[] | null | undefined): LeadAntwort[] {
  const liste: LeadAntwort[] = [];
  // Nachbesserung (05.11.2026): Eine kaputte Definition (options kein Array) darf den Eingang nie werfen lassen.
  const alle = Array.isArray(defs) ? defs : [];
  for (const [k, wertRoh] of Object.entries(fragen ?? {})) {
    if (META_KONTAKTFELDER.includes(k)) continue;
    const wert = String(wertRoh ?? "").trim();
    if (!wert) continue;
    const def = alle.find((d) => String(d?.key ?? "").trim().toLowerCase() === k.toLowerCase());
    const optionen: { key?: string | null; value?: string | null }[] = Array.isArray(def?.options) ? def!.options! : [];
    const option = optionen.find((o) => String(o?.key ?? "").trim() === wert);
    const frage = def?.label ? frageKurz(def.label) : schluesselLesbar(k);
    if (option?.value) liste.push({ schluessel: k, frage, antwort: String(option.value).trim(), code: wert });
    else liste.push({ schluessel: k, frage, antwort: wert, code: /^[a-z0-9_]+_\d{1,2}$/i.test(wert) ? wert : null });
  }
  return antwortenSortieren(liste, alle);
}

/**
 * Die Antworten in der Reihenfolge des Formulars (Gutachten Justin-Sicht: je Lead stand mal der Rahmen, mal der Start
 * zuerst). Unbekannte Fragen kommen ans Ende, sonst bleibt die Reihenfolge. Rein.
 */
export function antwortenSortieren(antworten: readonly LeadAntwort[], defs: readonly MetaFrageDef[] | null | undefined): LeadAntwort[] {
  const alle = Array.isArray(defs) ? defs : [];
  const platz = (a: LeadAntwort): number => {
    const i = alle.findIndex((d) => (a.schluessel && String(d?.key ?? "").toLowerCase() === a.schluessel.toLowerCase())
      || (!!d?.label && frageKurz(d.label).toLowerCase() === a.frage.toLowerCase()));
    if (i >= 0) return i;
    // Ohne Definition: die drei bekannten Fragen der Global-Formulare in ihrer festen Reihenfolge.
    const c = String(a.code ?? a.schluessel ?? "");
    const fest = ["vorhaben", "kapitalrahmen", "wann_starten", "wann_gruenden", "wofuer", "rolle"].findIndex((p) => c.startsWith(p));
    return fest >= 0 ? 1000 + fest : 2000;
  };
  return antworten.map((a, i) => ({ a, i, p: platz(a) })).sort((x, y) => x.p - y.p || x.i - y.i).map((x) => x.a);
}

/** Zeilen im Anfrage-Text, die KEINE Antwort sind. */
const KEINE_ANTWORT_ZEILE = /^(Paketwunsch|Wunschzeit|Sprache|Anzeige|Kampagne|Über das Meta-Sofortformular|Land|Nachricht)\b/i;

/**
 * Der Rückweg: Antworten aus einem gespeicherten Anfrage-Text — die alten Codes („Vorhaben: vorhaben_3“) ebenso wie
 * der neue Klartext („Was planen Sie mit Ihrer US-Gesellschaft? — Beides“) und die alte Schreibweise mit Text
 * („Wann möchten sie gründen?: In den nächsten drei Monaten“). Mit Definition wird übersetzt, ohne bleibt der Wert. Rein.
 */
export function antwortenAusText(text: unknown, defsRoh: readonly MetaFrageDef[] | null | undefined): LeadAntwort[] {
  const liste: LeadAntwort[] = [];
  const defs = Array.isArray(defsRoh) ? defsRoh : [];
  const optionenVon = (d: MetaFrageDef | undefined): { key?: string | null; value?: string | null }[] => (Array.isArray(d?.options) ? d!.options! : []);
  const optionZuCode = (code: string) => {
    for (const d of defs) {
      const o = optionenVon(d).find((x) => String(x?.key ?? "").trim() === code);
      if (o) return { def: d, option: o };
    }
    return null;
  };
  const defZuFrage = (frage: string) => defs.find((d) => d?.label && frageKurz(d.label).toLowerCase() === frage.toLowerCase());
  for (const zeileRoh of String(text ?? "").split("\n")) {
    const zeile = zeileRoh.trim();
    if (!zeile || KEINE_ANTWORT_ZEILE.test(zeile)) continue;
    // 1. Neuer Klartext: „Frage? — Antwort“
    let m = /^(.{3,160}?[?:]) — (.{1,300})$/.exec(zeile);
    if (m) {
      const frage = m[1].trim(), antwort = m[2].trim();
      const def = defZuFrage(frage);
      const option = optionenVon(def).find((o) => String(o?.value ?? "").trim().toLowerCase() === antwort.toLowerCase());
      liste.push({ schluessel: def?.key ? String(def.key) : null, frage, antwort, code: option?.key ? String(option.key) : null });
      continue;
    }
    // 2. Alte Codes: „Kapitalrahmen ziel: kapitalrahmen_ziel_4“
    m = /^(.{2,120}?):\s+([a-z0-9]+(?:_[a-z0-9]+)*_\d{1,2})$/i.exec(zeile);
    if (m) {
      const code = m[2].trim();
      const treffer = optionZuCode(code);
      if (treffer) {
        liste.push({ schluessel: treffer.def.key ? String(treffer.def.key) : null, frage: frageKurz(treffer.def.label ?? m[1]), antwort: String(treffer.option.value ?? code).trim(), code });
      } else {
        liste.push({ schluessel: code.replace(/_\d{1,2}$/, ""), frage: m[1].trim(), antwort: code, code });
      }
      continue;
    }
    // 3. Alte Schreibweise mit Text: „Wann möchten sie gründen?: In den nächsten drei Monaten“
    m = /^(.{3,160}\?):\s+(.{1,300})$/.exec(zeile);
    if (m) liste.push({ schluessel: null, frage: m[1].trim(), antwort: m[2].trim(), code: null });
  }
  return antwortenSortieren(liste, defs);
}

/**
 * Nur der Meta-Block eines gespeicherten Anfrage-Texts — die Zeilen, die das Meta-Formular selbst geschrieben hat
 * (globalMetaText: „Über das Meta-Sofortformular …“, die Antworten, Anzeige, Kampagne). Gutachten Sicherheit 05.11.2026:
 * Freitext einer Website-Anfrage ist NIE eine Antwort — sonst machte „Frage? — Antwort“ in der Nachricht den Lead „heiß“
 * und landete als „seine Angaben“ im KI-Auftrag. Ohne Meta-Block: leer. Rein.
 */
export function metaBlockAusText(text: unknown): string {
  const t = String(text ?? "");
  const i = t.indexOf("Über das Meta-Sofortformular");
  if (i < 0) return "";
  const rest = t.slice(i);
  const ende = rest.search(/\n\s*\n/);
  return ende > 0 ? rest.slice(0, ende) : rest;
}

/** Der Paketwunsch aus einem Anfrage-Text oder einer Termin-Notiz („Paketwunsch: Global Struktur (2.499 €)“) — null bei „noch offen“. Rein. */
export function paketwunschAus(text: unknown): string | null {
  const m = /^Paketwunsch:\s*(.+)$/m.exec(String(text ?? ""));
  const w = m ? m[1].trim().slice(0, 120) : "";
  if (!w || /^(noch\s+offen|offen|-|keiner?|unbekannt|null)$/i.test(w)) return null;
  return w;
}

// ── Die Kundenfassung (Sie-Form, ohne Betrag) — vorbereitet für Scheibe 4, heute ungenutzt ──────────────────
/**
 * Je Option ein Satz in Sie-Form. Bewusst OHNE Dollar-Betrag (Gutachten 1, Mangel 8: die Zahl steht nur im Dossier)
 * und ohne „mein“/„ich“/„Noch offen“ aus den Optionstexten. Leerer Satz = die Antwort sagt dem Kunden nichts Neues.
 */
export const KUNDEN_SATZ: Readonly<Record<string, string>> = {
  vorhaben_1: "Sie möchten über eine eigene US-Gesellschaft den Weg zum Kapital gehen – auch für Ihr Unternehmen hier.",
  vorhaben_2: "Sie möchten ein Geschäft in den USA aufbauen.",
  vorhaben_3: "Sie möchten beides: den Weg zum Kapital und ein Geschäft in den USA.",
  vorhaben_4: "Was genau Sie vorhaben, klären wir gern gemeinsam im Gespräch.",
  kapitalrahmen_ziel_1: "Ihr Ziel für den Kapitalrahmen liegt mir vor.",
  kapitalrahmen_ziel_2: "Ihr Ziel für den Kapitalrahmen liegt mir vor.",
  kapitalrahmen_ziel_3: "Ihr Ziel für den Kapitalrahmen liegt mir vor.",
  kapitalrahmen_ziel_4: "",
  wann_starten_1: "Sie möchten so bald wie möglich starten.",
  wann_starten_2: "Sie möchten in den nächsten Monaten starten.",
  wann_starten_3: "Sie möchten zu einem späteren Zeitpunkt starten.",
  wann_starten_4: "Sie möchten sich zunächst in Ruhe informieren.",
  wann_gruenden_1: "Sie möchten Ihre US-Gesellschaft so bald wie möglich gründen.",
  wann_gruenden_2: "Sie möchten Ihre US-Gesellschaft in den nächsten drei Monaten gründen.",
  wann_gruenden_3: "Sie möchten Ihre US-Gesellschaft zu einem späteren Zeitpunkt gründen.",
  wann_gruenden_4: "Sie möchten sich zunächst in Ruhe informieren.",
  wofuer_1: "Sie haben Kunden oder Partner in den USA.",
  wofuer_2: "Sie planen eine Tochtergesellschaft für Ihr bestehendes Unternehmen.",
  wofuer_3: "Sie betreiben ein internationales Online-Geschäft.",
  wofuer_4: "Sie möchten ein neues Geschäft in den USA aufbauen.",
  wofuer_5: "",
  rolle_1: "Sie haben ein eigenes Unternehmen.",
  rolle_2: "Sie führen ein Unternehmen als Geschäftsführung.",
  rolle_3: "Sie sind selbstständig oder freiberuflich tätig.",
  rolle_4: "Sie planen gerade eine Gründung.",
  rolle_5: "",
};

/** Die Antworten als ein Absatz für den Kunden — leer, wenn keine Option bekannt ist. Rein. */
export function kundenSatz(antworten: readonly LeadAntwort[]): string {
  const saetze: string[] = [];
  for (const a of antworten) {
    const s = a.code ? KUNDEN_SATZ[a.code] : undefined;
    if (s && !saetze.includes(s)) saetze.push(s);
  }
  return saetze.join(" ");
}

// ── Temperatur aus SEINEN Antworten ─────────────────────────────────────────
export type LeadKanal = "meta" | "website" | "buchung" | "justin";
export type LeadTemperatur = "heiss" | "warm" | "kalt" | "offen";
export const TEMPERATUR_WORT: Readonly<Record<LeadTemperatur, string>> = { heiss: "heiß", warm: "warm", kalt: "kalt", offen: "offen" };

/** Die Stufe einer Startfrage: 1 so bald wie möglich · 2 nächste Monate · 3 später · 4 informiert sich erst. */
function startStufe(a: LeadAntwort): number | null {
  const c = /_(\d)$/.exec(String(a.code ?? ""));
  if (c && /^(wann_starten|wann_gruenden)/.test(String(a.code))) return Number(c[1]);
  const t = a.antwort.toLowerCase();
  if (!/wann|start|gründen|gruenden/i.test(a.frage)) return null;
  if (/so bald wie möglich|sofort|asap/.test(t)) return 1;
  if (/nächsten|naechsten|monaten/.test(t)) return 2;
  if (/^später|^spaeter/.test(t)) return 3;
  if (/informiere/.test(t)) return 4;
  return null;
}

/** Hat er einen Kapitalrahmen gewählt (nicht „Noch offen“)? null = die Frage gab es nicht. */
function rahmenGewaehlt(antworten: readonly LeadAntwort[]): boolean | null {
  const r = antworten.find((a) => /^kapitalrahmen/.test(String(a.code ?? a.schluessel ?? "")) || /kapitalrahmen/i.test(a.frage));
  if (!r) return null;
  return !/noch offen|^offen/i.test(r.antwort) && !/_4$/.test(String(r.code ?? ""));
}

/**
 * heiß = will so bald wie möglich starten (beim Kapital-Formular mit gewähltem Rahmen); warm = in den nächsten
 * Monaten, oder sofort mit offenem Rahmen, oder ein selbst erbetener Rückruf; kalt = später oder „informiere mich
 * erst“; offen = keine Antwort, die etwas sagt. Wer selbst einen Termin bucht, ist heiß. Nachbesserung (Gutachten
 * Justin-Sicht 05.11.2026): Wer auf der Website ein PAKET gewählt hat oder „heute/sofort“ sprechen will, ist heiß — das
 * stärkste Kaufsignal stand vorher nirgends. Rein.
 */
export function leadTemperatur(
  antworten: readonly LeadAntwort[], kanal: LeadKanal,
  extra: { paketwunsch?: string | null; wunschzeit?: string | null } = {},
): { wert: LeadTemperatur; grund: string } {
  if (kanal === "buchung" || kanal === "justin") {
    return { wert: "heiss", grund: extra.paketwunsch ? `hat selbst einen Termin gebucht und ein Paket gewählt (${extra.paketwunsch})` : "hat selbst einen Termin gebucht" };
  }
  if (extra.paketwunsch) return { wert: "heiss", grund: `hat ein Paket gewählt (${extra.paketwunsch})` };
  if (/\b(heute|sofort|asap|umgehend|so\s+schnell\s+wie\s+m(?:ö|oe)glich|dringend)\b/i.test(String(extra.wunschzeit ?? ""))) {
    return { wert: "heiss", grund: `will schnell sprechen (Wunschzeit „${String(extra.wunschzeit).slice(0, 40)}“)` };
  }
  const start = antworten.map(startStufe).find((s) => s != null) ?? null;
  const rahmen = rahmenGewaehlt(antworten);
  if (start === 1) {
    if (rahmen === false) return { wert: "warm", grund: "will so bald wie möglich starten, Rahmen noch offen" };
    return { wert: "heiss", grund: rahmen ? "will so bald wie möglich starten und hat einen Rahmen gewählt" : "will so bald wie möglich starten" };
  }
  if (start === 2) return { wert: "warm", grund: "will in den nächsten Monaten starten" };
  if (start === 3) return { wert: "kalt", grund: "will später starten" };
  if (start === 4) return { wert: "kalt", grund: "informiert sich erst" };
  if (kanal === "website") return { wert: "warm", grund: "bittet selbst um einen Rückruf (keine Auswahlfragen)" };
  return { wert: "offen", grund: "keine Antwort zum Start" };
}

// ── Hinweis „Privatkunde/Beschwerde?“ ───────────────────────────────────────
// Nachbesserung (Gutachten Technik + Justin-Sicht, 05.11.2026). VORHER: ein einziges Wort reichte, nur am Wortanfang
// verankert — „Ihre Anzeige gesehen“, „Rechtsanwaltskanzlei“, „vormittags nicht erreichbar“ (in der Wunschzeit!),
// „Betrugsprävention“ machten aus einer GmbH „Lead: … · Privatkunde?“ mit „Bitte nicht als Business-Lead führen“, und
// der Betreff galt für den ganzen Faden. NACHHER: Wörter zählen nur im Zusammenhang (STARK) oder als leises Signal
// (SCHWACH); der Hinweis braucht zwei starke Signale ODER ein starkes plus Privat-Bestand/zahlend/keine Firma. Sonst
// steht nur eine leise Zeile „Signalwörter: …“ — Betreff und Temperatur bleiben, was SEINE Antworten sagen.
const BESCHWERDE_STARK: readonly [string, RegExp][] = [
  ["versprochen", /(?<!wie\s)\bversprochen\b/i],
  ["ignoriert", /\bignorier(?:t|en|e|st)\b/i],
  ["unprofessionell", /\bunprofessionell\w*/i],
  ["Geld zurück", /\bgeld\s+zur(?:ü|ue)ck\b/i],
  ["Erstattung", /\b(?:r(?:ü|ue)ck)?erstattung\b|\bzur(?:ü|ue)ckerstatt\w*/i],
  ["Anzeige erstatten", /\b(?:straf)?anzeige\s+(?:erstatten|erstattet|gegen)\b|\bstrafanzeige\b/i],
  ["Anwalt einschalten", /\b(?:rechts)?anw(?:a|ä)lt\w*\s+(?:einschalten|eingeschaltet|beauftrag\w*|(?:ü|ue)bergeben)\b|\b(?:einschalten|beauftragen|(?:ü|ue)bergebe\w*)\b[^.!?\n]{0,25}\b(?:rechts)?anwalt\b|\brechtliche\s+schritte\b/i],
  ["Verbraucherzentrale", /\bverbraucherzentrale\b/i],
  ["Betrug", /\bbetrug\b|\bbetr(?:ü|ue)ger(?:in|innen|n)?\b|\babzocke\b|\babgezockt\b/i],
  ["Frechheit", /\bfrechheit\b|\bunversch(?:ä|ae)mt\w*/i],
  ["Beschwerde", /\bbeschwerde\b|\breklamation\b/i],
  ["Geduld am Ende", /\bgeduld\b[^.!?\n]{0,25}\bam\s+ende\b/i],
  ["niemand meldet sich", /\b(?:niemand|keiner)\b[^.!?\n]{0,25}\b(?:meldet|melden|ruft|rufen|antwortet|antworten|reagiert)\b|\bmeldet\s+sich\s+(?:niemand|keiner)\b/i],
  ["keine Antwort bekommen", /\b(?:keine|nie\s+eine)\s+antwort\s+(?:bekommen|erhalten)\b|\b(?:bis\s+heute|immer\s+noch)\s+keine\s+antwort\b/i],
  ["hingehalten", /\bhingehalten\b/i],
  ["Sie sind nicht erreichbar", /\b(?:sie|ihr\s+team|ihre\s+mitarbeiter\w*|ihr\s+kundendienst)\s+(?:sind|ist|waren|war|seid)\s+(?:nie|nicht|kaum)\s+(?:mehr\s+)?erreichbar\b|\bniemand(?:en)?\s+erreicht\b/i],
];
const BESCHWERDE_SCHWACH: readonly [string, RegExp][] = [
  ["seit Wochen", /\bseit\s+wochen\b/i],
  ["zugesagt", /\bzugesagt\b/i],
  ["Kündigung", /\bk(?:ü|ue)ndig(?:en|ung|e|t)\b/i],
  ["Widerruf", /\bwiderruf(?:en|e)?\b/i],
  ["enttäuscht", /\bentt(?:ä|ae)uscht\b/i],
  ["immer noch nicht", /\bimmer\s+noch\s+nicht\b/i],
  ["keine Antwort", /\bkeine\s+antwort\b/i],
];
const PRIVAT_SIGNALE: readonly [string, RegExp][] = [
  ["Kreditkarte", /\bkreditkarte\w*/i],
  ["Karte und Konto", /\bkarte\s+und\s+(?:das\s+)?konto\b/i],
  ["DKB", /\bdkb\b/i],
  ["SCHUFA", /\bschufa\b/i],
  ["Bonität", /\bbonit(?:ä|ae)t\b/i],
  ["Privatkunde", /\bprivatkund\w*/i],
  ["schon Kunde", /\b(?:bin|bereits|schon)\s+(?:seit\s+\w+\s+)?(?:ihre?\s+)?kund(?:e|in)\b/i],
  ["Einzahlung", /\beinzahlung\w*/i],
  ["meine Rate", /\bmeine\s+rate\w*|\bratenzahlung\w*/i],
  ["Kundennummer", /\b(?:kunden|vertrags|referenz)nummer\b/i],
  ["mein Vertrag/Antrag", /\bmein(?:en|em)?\s+(?:vertrag|antrag|konto|limit)\b/i],
  ["Limit", /\blimit\b/i],
];

export interface PrivatHinweis {
  /** Starke Beschwerde-Signale (nur im Zusammenhang). */
  beschwerde: string[];
  /** Schwache Signale — allein nie ein Hinweis. */
  schwach: string[];
  privat: string[];
}

/**
 * Signalwörter im Freitext — eine Lesehilfe, keine Entscheidung. Gibt die gefundenen Signale (je höchstens 5) zurück.
 * Nur die NACHRICHT, nie die Wunschzeit („vormittags nicht erreichbar“ ist keine Beschwerde). Rein.
 */
export function privatOderBeschwerde(text: unknown): PrivatHinweis {
  const t = String(text ?? "");
  const sammle = (liste: readonly [string, RegExp][]) => liste.filter(([, re]) => re.test(t)).map(([w]) => w).slice(0, 5);
  return { beschwerde: sammle(BESCHWERDE_STARK), schwach: sammle(BESCHWERDE_SCHWACH), privat: sammle(PRIVAT_SIGNALE) };
}

export interface PrivatUrteil {
  /** ACHTUNG im Dossier: klingt nach Privatkunde (mit Beschwerde). */
  hinweis: boolean;
  art: "beschwerde" | "privat" | null;
  /** „Privatkunde?“ in den Betreff — nur mit Privat-Bestand (Gutachten Technik: der Betreff gilt für den ganzen Faden). */
  imBetreff: boolean;
  /** Leise Zeile „Signalwörter: …“ — ändert weder Betreff noch Temperatur. */
  leise: string[];
}

/**
 * Die Entscheidung zum Hinweis (Gutachten Technik + Justin-Sicht, 05.11.2026): Beschwerde nur bei zwei verschiedenen
 * starken Signalen ODER einem starken Signal plus Privat-Bestand, zahlender Bestellung oder fehlender Firma. Privatkunde
 * ohne Beschwerde: ein Privat-Signal plus Privat-Bestand oder keine Firma — oder zahlend ohne Firma. Rein.
 */
export function privatUrteil(s: PrivatHinweis, ctx: { privatBestand: boolean; zahlend: boolean; firmaBrauchbar: boolean }): PrivatUrteil {
  const beschwerde = s.beschwerde.length >= 2 || (s.beschwerde.length >= 1 && (ctx.privatBestand || ctx.zahlend || !ctx.firmaBrauchbar));
  const privat = !beschwerde && ((s.privat.length >= 1 && (ctx.privatBestand || !ctx.firmaBrauchbar)) || (ctx.zahlend && !ctx.firmaBrauchbar));
  const hinweis = beschwerde || privat;
  const alle = [...s.beschwerde, ...s.schwach, ...s.privat];
  return {
    hinweis, art: beschwerde ? "beschwerde" : privat ? "privat" : null,
    imBetreff: hinweis && ctx.privatBestand,
    leise: hinweis ? [] : alle.slice(0, 6),
  };
}

// ── Der Mail-Faden je Lead ──────────────────────────────────────────────────
export const FADEN_PRAEFIX = "Lead:";

/** Der Name im Betreff: die brauchbare Firma, sonst der Mensch. Rein. */
export function leadAnzeigeName(firma: unknown, name: unknown): string {
  const u = firmaBrauchbar(firma, name);
  const wahl = u.brauchbar ? String(firma ?? "") : String(name ?? "");
  return wahl.replace(/\s+/g, " ").trim().slice(0, 70) || "ohne Namen";
}

/**
 * Der Betreff-Stamm des Fadens: „Lead: Muster Logistik GmbH · heiß“ — die Temperatur aus SEINEN Antworten statt einer
 * Farb-Ampel. Alle weiteren Meldungen zum Lead tragen denselben Stamm mit „Re: “ (Gmail fädelt nur bei gleichem
 * Betreff). Rein.
 */
export function fadenBetreff(anzeigeName: string, temperatur: LeadTemperatur, opt: { privat?: boolean } = {}): string {
  // Klingt es nach Privatkunde/Beschwerde, sagt der Betreff genau das — eine Temperatur wäre dort irreführend.
  const t = opt.privat ? " · Privatkunde?" : temperatur === "offen" ? "" : ` · ${TEMPERATUR_WORT[temperatur]}`;
  return `${FADEN_PRAEFIX} ${anzeigeName}${t}`.replace(/[\r\n]+/g, " ").slice(0, 120);
}
export function fadenAntwortBetreff(stamm: string): string {
  return /^re:\s/i.test(stamm) ? stamm : `Re: ${stamm}`;
}

// ── KI-Tagesdeckel und Register-Budget (reine Entscheidungen) ───────────────
export const LEAD_DOSSIER_SCHLUESSEL = {
  an: "lead_dossier_an",
  kiAn: "lead_dossier_ki_an",
  ab: "lead_dossier_ab",
  kiDeckelUsd: "lead_dossier_ki_deckel_usd",
  kiFristS: "lead_dossier_ki_frist_s",
  sammelAn: "lead_dossier_sammel_an",
  sammelAm: "lead_dossier_sammel_am",
  registerMonat: "openregister_credits_monat",
  registerReserve: "lead_dossier_register_reserve",
  registerZaehlerPraefix: "lead_dossier_register_credits:",
  an_adresse: "lead_dossier_an_adresse",
  /** Nachbesserung (Gutachten Sicherheit): höchstens so viele KI-Checks je Stunde (Vorgabe 6). */
  kiStundeMax: "lead_dossier_ki_stunde_max",
} as const;

/**
 * Vorgaben: Tagesdeckel 8 $ (Plan, Entscheidung 4), Frist 150 s, Register frei 500 Credits/Monat, Reserve 300 für den
 * Bestellweg. Nachbesserung (Gutachten Sicherheit 05.11.2026): Die Schätzung je Aufruf ist die OBERGRENZE eines schweren
 * Laufs (rund 1,10 $ plus Suchen) — die Checks laufen nacheinander, und jeder bucht vor dem nächsten; so überzieht auch der
 * letzte Aufruf des Tages den Deckel nicht. Dazu höchstens 6 Checks je Stunde.
 */
export const LEAD_DOSSIER_VORGABE = { kiDeckelUsd: 8, kiFristS: 150, registerMonat: 500, registerReserve: 300, schaetzungUsd: 1.2, kiStundeMax: 6 } as const;

/**
 * Darf der Hintergrund-Check JETZT die KI rufen? Vor JEDEM Aufruf: Not-Aus, dann der eigene Tagesdeckel mit einer
 * Schätzung für diesen Aufruf (sonst überzöge der letzte Aufruf den Deckel um bis zu einem Dollar). Rein.
 */
export function kiDeckelUrteil(ein: { an: boolean; heuteUsd: number; deckelUsd: number; schaetzungUsd?: number }): { erlaubt: boolean; grund: string | null } {
  if (!ein.an) return { erlaubt: false, grund: "KI-Hintergrund-Check ist ausgeschaltet (Not-Aus im Lead-Motor)." };
  const deckel = Number(ein.deckelUsd);
  if (!(deckel > 0)) return { erlaubt: false, grund: "Tagesdeckel steht auf 0 $." };
  const heute = Math.max(0, Number(ein.heuteUsd) || 0);
  const schaetzung = Math.max(0, Number(ein.schaetzungUsd ?? LEAD_DOSSIER_VORGABE.schaetzungUsd));
  if (heute + schaetzung > deckel) {
    return { erlaubt: false, grund: `Tagesdeckel erreicht (${heute.toFixed(2)} $ von ${deckel.toFixed(2)} $ heute) — morgen um 0 Uhr geht es weiter.` };
  }
  return { erlaubt: true, grund: null };
}

/** Register-Credits: Monatsbudget des Dossiers = Freikontingent − feste Reserve für den Bestellweg. Rein. */
export function registerBudget(ein: { monat: number; reserve: number }): number {
  return Math.max(0, Math.floor(Number(ein.monat) || 0) - Math.max(0, Math.floor(Number(ein.reserve) || 0)));
}
export function registerCreditsErlaubt(ein: { verbraucht: number; budget: number; kosten: number }): boolean {
  return Math.max(0, Number(ein.verbraucht) || 0) + Math.max(0, Number(ein.kosten) || 0) <= Math.max(0, Number(ein.budget) || 0);
}
/** Der Monatsschlüssel des Zählers (Berliner Monat, JJJJ-MM). Rein. */
export function registerMonatSchluessel(tag: string): string {
  return `${LEAD_DOSSIER_SCHLUESSEL.registerZaehlerPraefix}${String(tag).slice(0, 7)}`;
}

/**
 * KEINE FLUT ALTER LEADS (Gutachten 0, Mangel 10): Ein einzelnes Dossier gibt es nur für Eingänge ab dem Zählbeginn
 * (lead_dossier_ab = Einschaltzeit) und höchstens drei Tage alt. Ohne Zählbeginn: keins. Rein.
 */
export function einzelDossierFaellig(ein: {
  eingangAm: Date | string; ab: Date | string | null; jetzt?: Date;
  /**
   * Nachbesserung (Gutachten Technik 05.11.2026): der ECHTE Eingang, wenn er vom Anlegen abweicht — ein Meta-Lead aus
   * „Rückstand nachholen“ wird heute angelegt, ist aber Wochen alt. Älter als drei Tage: kein Einzel-Dossier.
   */
  echterEingang?: Date | string | null;
  /** Der Weg des Meta-Leads — „meta_rueckstand“ bekommt nie ein Einzel-Dossier. */
  weg?: string | null;
}): boolean {
  if (!ein.ab) return false;
  if (ein.weg === "meta_rueckstand") return false;
  const eingang = new Date(ein.eingangAm).getTime();
  const ab = new Date(ein.ab).getTime();
  const echt = ein.echterEingang ? new Date(ein.echterEingang).getTime() : eingang;
  const jetzt = (ein.jetzt ?? new Date()).getTime();
  if (!Number.isFinite(eingang) || !Number.isFinite(ab)) return false;
  return eingang >= ab && jetzt - (Number.isFinite(echt) ? echt : eingang) <= 3 * 24 * 3_600_000;
}

/** In die EINE Sammel-Mail kommen offene Alt-Leads: vor dem Zählbeginn, höchstens 14 Tage alt. Rein. */
export function sammelKandidat(ein: { eingangAm: Date | string; ab: Date | string; jetzt?: Date }): boolean {
  const eingang = new Date(ein.eingangAm).getTime();
  const ab = new Date(ein.ab).getTime();
  const jetzt = (ein.jetzt ?? new Date()).getTime();
  return Number.isFinite(eingang) && Number.isFinite(ab) && eingang < ab && jetzt - eingang <= 14 * 24 * 3_600_000;
}

// ── Berliner Zeit (nur formatToParts — Zeit-Falle 01.09.2026) ───────────────
const WOCHENTAG_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function berlinZeit(d: Date = new Date()): { tag: number; stunde: number; minute: number; datum: string; wochentag: string; iso: string } {
  const teile = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const v = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  const tag = Math.max(0, WT_EN.indexOf(v("weekday")));
  return {
    tag, stunde: Number(v("hour")) % 24, minute: Number(v("minute")),
    datum: `${v("day")}.${v("month")}.`, wochentag: WOCHENTAG_DE[tag], iso: `${v("year")}-${v("month")}-${v("day")}`,
  };
}

/**
 * Wann ruft der Zuständige frühestens an? Mo–Fr 9–18 Uhr: heute; sonst der nächste Werktag ab 9 Uhr (mit Wochentag —
 * nach Mitternacht ist „morgen“ falsch, Gutachten 1, Mangel 3). Feiertage kennt die Regel nicht. Rein.
 */
export function anrufFenster(jetzt: Date = new Date()): { imDienst: boolean; text: string; abTag: string } {
  const b = berlinZeit(jetzt);
  const werktag = b.tag >= 1 && b.tag <= 5;
  if (werktag && b.stunde >= 9 && b.stunde < 18) return { imDienst: true, text: "heute", abTag: b.iso };
  for (let i = 0; i < 8; i++) {
    const d = new Date(jetzt.getTime() + i * 24 * 3_600_000);
    const z = berlinZeit(d);
    const wt = z.tag >= 1 && z.tag <= 5;
    if (!wt) continue;
    if (i === 0 && z.stunde >= 9) continue;
    return { imDienst: false, text: `${z.wochentag}, ${z.datum} ab 9 Uhr`, abTag: z.iso };
  }
  return { imDienst: false, text: "am nächsten Werktag ab 9 Uhr", abTag: b.iso };
}

/** Liegt `jetzt` (Berlin) noch VOR dem Fenster, das an `abTag` um 9 Uhr beginnt? Rein. */
export function vorDemFenster(abTag: string, jetzt: Date = new Date()): boolean {
  const b = berlinZeit(jetzt);
  return b.iso < abTag || (b.iso === abTag && b.stunde < 9);
}

/** Die Ergebnisse eines Anrufs im Firmen-Cockpit in Worten (gleiche Wörter wie die Knöpfe in firmen.tsx). */
export const ANRUF_ERGEBNIS_TEXT: Readonly<Record<string, string>> = {
  erreicht_interesse: "erreicht, Interesse", erreicht_termin: "erreicht, Termin vereinbart", erreicht_antrag: "erreicht, macht den Antrag",
  erreicht_kein_interesse: "erreicht, kein Interesse", nicht_erreicht: "nicht erreicht", mailbox: "Mailbox", nummer_falsch: "Nummer falsch",
};

/**
 * Wartezeit vor dem nächsten Versandversuch (Gutachten Technik 05.11.2026): 2, 15, 60 Minuten — sonst war ein Dossier
 * nach sechs Minuten Brevo-Störung verloren. Rein.
 */
export function naechsterVersuchMinuten(versuche: number): number {
  return [2, 15, 60][Math.max(0, Math.min(2, Math.floor(Number(versuche) || 1) - 1))];
}

/**
 * Adressen in fremdem Text entschärfen (Gutachten Sicherheit 05.11.2026): Was ein Lead oder eine Webseite schreibt, wird
 * in der Mail an Justin nie ein klickbarer Link — „https://…“ wird „https[:]//…“, „www.“ wird „www[.]“. Rein.
 */
export function linksEntschaerfen(text: unknown): string {
  return String(text ?? "").replace(/\b(https?):\/\//gi, "$1[:]//").replace(/\bwww\./gi, "www[.]");
}
