// ═══════════════════════════════════════════════════════════════════════════
// DARF DIESER MENSCH EINE WHATSAPP BEKOMMEN? — EINE REGEL (22.09.2026, E-210)
//
// Justin am 22.09.2026: „jeder Lead der über Facebook kommt erlaubt die
// Kontaktaufnahme über WhatsApp — also ist es wichtig, dass JEDER Lead
// (insofern er WhatsApp hat) auch eine WhatsApp-Nachricht bekommt."
//
// Die Erlaubnis steht im HINWEISTEXT des Lead-Formulars, nicht in einem
// Kästchen. Wer absendet, hat ihn gelesen. Es gibt deshalb nur noch zwei
// Gründe, warum jemand KEINE WhatsApp bekommt:
//   1. Er hat ausdrücklich Nein gesagt (Kästchen nicht angehakt, „STOPP",
//      Werbesperre) → `erlaubt === false`.
//   2. Seine Nummer kann kein WhatsApp (Festnetz) oder fehlt ganz.
//
// Alles andere ist ein Ja. „Unbekannt" gibt es nicht mehr — das war die alte
// Kästchen-Welt und hat in der Praxis jeden Lead auf E-Mail zurückgeworfen.
// ═══════════════════════════════════════════════════════════════════════════

export type NummernArt = "handy" | "festnetz" | "unklar" | "keine";

/** Nur Ziffern, mit Landesvorwahl. Deutsche 0-Vorwahl wird zu +49. */
export function nummerFuerWhatsApp(roh: unknown, land: "DE" | "AT" | "CH" = "DE"): string | null {
  let z = String(roh ?? "").replace(/[^\d+]/g, "");
  if (!z) return null;
  if (z.startsWith("00")) z = `+${z.slice(2)}`;
  if (!z.startsWith("+")) {
    // FALLE (23.09.2026): WhatsApp liefert Nummern OHNE Plus, also „4915112345602".
    // Ohne diese Prüfung hängte die Umrechnung noch einmal 49 davor und der
    // Verlauf blieb leer. Wer nicht mit 0 beginnt und mit einer DACH-Vorwahl
    // anfängt, ist bereits international.
    if (/^(49|43|41)\d{7,13}$/.test(z)) {
      z = `+${z}`;
    } else {
      const vorwahl = land === "AT" ? "+43" : land === "CH" ? "+41" : "+49";
      z = z.startsWith("0") ? `${vorwahl}${z.slice(1)}` : `${vorwahl}${z}`;
    }
  }
  const ziffern = z.slice(1).replace(/\D/g, "");
  return ziffern.length >= 8 && ziffern.length <= 15 ? ziffern : null;
}

/**
 * DAS LAND FÜR DEN VERSAND (26.09.2026, E-244, Gesamtdurchsicht) — eine Liste
 * für JS und SQL. fiaon_persons.country trägt nicht nur Codes: in der Produktion
 * am 26.09. „DE", „AT", „CH", „Deutschland" (35) und andere ISO-Codes; Formulare
 * und Importe können auch „Österreich", „AUT", „Schweiz", „USA" liefern. Bis
 * heute erkannten nummerFuerVersand und NUMMER_FUER_VERSAND_SQL nur „AT/CH/US/CA"
 * — ein „Österreich" mit 0664 … ging als +49 664 … raus.
 *
 * Normalform: Umlaute ö/ä/ü → o/a/u, groß, nur A–Z (Leerzeichen, Punkte,
 * Bindestriche fallen weg; „U.S.A." → „USA"). Beide Seiten rechnen genau so —
 * translate() statt UPPER() allein, weil UPPER in SQL Umlaute je nach Locale
 * nicht anfasst. Alles, was hier nicht steht, rechnet wie Deutschland.
 */
export const VERSAND_LAENDER: Record<"AT" | "CH" | "US" | "CA", readonly string[]> = {
  AT: ["AT", "AUT", "AUSTRIA", "OSTERREICH", "OESTERREICH"],
  CH: ["CH", "CHE", "SCHWEIZ", "SWITZERLAND", "SUISSE", "SVIZZERA", "SCHWIIZ"],
  US: ["US", "USA", "UNITEDSTATES", "UNITEDSTATESOFAMERICA", "VEREINIGTESTAATEN", "VEREINIGTESTAATENVONAMERIKA", "AMERIKA"],
  CA: ["CA", "CAN", "CANADA", "KANADA"],
};

/** Das Land einer Person für die Versandrechnung: AT, CH, US, CA — sonst null (rechnet wie DE). Rein. */
export function versandLand(land: unknown): "AT" | "CH" | "US" | "CA" | null {
  const k = String(land ?? "").replace(/[öÖ]/g, (c) => (c === "ö" ? "o" : "O")).replace(/[äÄ]/g, (c) => (c === "ä" ? "a" : "A"))
    .replace(/[üÜ]/g, (c) => (c === "ü" ? "u" : "U")).toUpperCase().replace(/[^A-Z]/g, "");
  for (const [code, formen] of Object.entries(VERSAND_LAENDER) as ["AT" | "CH" | "US" | "CA", readonly string[]][]) {
    if (formen.includes(k)) return code;
  }
  return null;
}

/** Dieselbe Rechnung in SQL: 'AT', 'CH', 'US', 'CA' oder '' (rechnet wie DE). Der Ausdruck wird einmal ausgewertet. */
export const VERSAND_LAND_SQL = (land: string) => {
  const liste = (formen: readonly string[]) => formen.map((f) => `'${f}'`).join(", ");
  return `(SELECT CASE
      ${(Object.entries(VERSAND_LAENDER) as [string, readonly string[]][]).map(([code, formen]) => `WHEN k.k IN (${liste(formen)}) THEN '${code}'`).join("\n      ")}
      ELSE '' END
    FROM (SELECT regexp_replace(UPPER(translate(COALESCE((${land})::text, ''), 'öÖäÄüÜ', 'oOaAuU')), '[^A-Z]', '', 'g') AS k) k)`;
};

/**
 * DIE NUMMER FÜR DEN VERSAND (26.09.2026, E-244).
 *
 * Für den Versand gilt eine gespeicherte Nummer nur dann als international,
 * wenn sie mit „+", „00" oder 49/43/41 beginnt. Alles andere läuft durch
 * nummerFuerWhatsApp mit dem LAND DER PERSON (AT/CH, sonst DE) — nie als +1.
 *
 * Drei Formen sind eindeutig deutsche Handynummern, auch wenn das Land der
 * Person anders lautet (AT/CH vergeben keine Handynummern mit 1 vorn):
 *   · „015…/016…/017…" mit 0 und 10–11 Ziffern danach (Gegenlesen 26.09.:
 *     bei Land AT sonst +43 15… — in AT ist 01 Wien, und eine Wiener
 *     Festnetznummer hat ohnehin kein WhatsApp)
 *   · „15…/16…/17…" ohne 0 und ohne Vorwahl (10–11 Ziffern)
 *   · „+15…/+16…/+17…" mit genau 11 Ziffern — so liefert das Meta-Lead-Formular
 *     eine deutsche Handynummer, die ohne 0 eingetippt wurde („+15125398579").
 *     Bis 26.09.2026 gingen drei solche Nummern als US-Nummer (+1 512 …) raus
 *     und scheiterten mit „Message undeliverable". Personen mit Land US/CA
 *     behalten ihr +1.
 *
 * Nur für den Versand an Personen gedacht. nummerFuerWhatsApp und waKanonisch
 * bleiben unverändert (Anzeige, Suche, Absender-IDs von Meta).
 */
export function nummerFuerVersand(roh: unknown, land?: string | null): string | null {
  let z = String(roh ?? "").replace(/[^\d+]/g, "");
  if (!z) return null;
  if (z.startsWith("00")) z = `+${z.slice(2)}`;
  const l = versandLand(land) ?? "";
  if (z.startsWith("+")) {
    const ziffern = z.slice(1).replace(/\D/g, "");
    if (/^1[5-7]\d{9}$/.test(ziffern) && l !== "US" && l !== "CA") return `49${ziffern}`;
    return ziffern.length >= 8 && ziffern.length <= 15 ? ziffern : null;
  }
  if (/^(49|43|41)\d{7,13}$/.test(z)) return z;
  if (/^0?1[5-7]\d{8,9}$/.test(z)) return `49${z.replace(/^0/, "")}`;
  return nummerFuerWhatsApp(z, l === "AT" || l === "CH" ? l : "DE");
}

/**
 * DIESELBE RECHNUNG IN SQL (26.09.2026, E-244, Gegenlesen): nummerFuerVersand
 * für einen Telefon- und einen Land-Ausdruck. Ergebnis: Ziffern ohne Plus oder
 * NULL. Die Sperre „Nummer unzustellbar" (server/lib/fiaon-wa-unzustellbar.ts)
 * vergleicht hiermit die VOLLE Nummer, an die wir heute senden würden, mit der
 * vollen Nummer des Fehlversuchs — ein Fehlversuch an eine falsch gelesene
 * Nummer (Österreicher als +49, deutsche Handynummer als +1) sperrt die
 * richtige Nummer nicht. Jede Änderung oben gehört auch hierher; der Prüfstand
 * .pruef/e244-wa-unzustellbar.mts vergleicht beide Seiten Fall für Fall.
 * Beide Ausdrücke werden genau einmal ausgewertet.
 */
export const NUMMER_FUER_VERSAND_SQL = (telefon: string, land: string) => `(SELECT CASE
    WHEN v.z = '' THEN NULL
    WHEN v.z LIKE '+%' THEN CASE
      WHEN v.d ~ '^1[5-7][0-9]{9}$' AND v.l NOT IN ('US', 'CA') THEN '49' || v.d
      WHEN length(v.d) BETWEEN 8 AND 15 THEN v.d END
    WHEN v.z ~ '^(49|43|41)[0-9]{7,13}$' THEN v.z
    WHEN v.z ~ '^0?1[5-7][0-9]{8,9}$' THEN '49' || regexp_replace(v.z, '^0', '')
    ELSE (SELECT CASE WHEN length(w.x) BETWEEN 8 AND 15 THEN w.x END FROM (SELECT
            (CASE v.l WHEN 'AT' THEN '43' WHEN 'CH' THEN '41' ELSE '49' END)
            || regexp_replace(CASE WHEN v.z LIKE '0%' THEN substr(v.z, 2) ELSE v.z END, '[^0-9]', '', 'g') AS x) w)
  END
  FROM (SELECT u.z, regexp_replace(substr(u.z, 2), '[^0-9]', '', 'g') AS d, u.l
          FROM (SELECT CASE WHEN r.r LIKE '00%' THEN '+' || substr(r.r, 3) ELSE r.r END AS z, r.l
                  FROM (SELECT regexp_replace(COALESCE((${telefon})::text, ''), '[^0-9+]', '', 'g') AS r,
                               ${VERSAND_LAND_SQL(land)} AS l) r) u) v)`;

/**
 * EINE NUMMER, DIE SCHON IN WHATSAPP-FORM VORLIEGT (24.09.2026, E-230).
 *
 * nummerFuerWhatsApp ist für EINGABEN gemacht (0151 …, +49 …, 0043 …): Was
 * nicht mit 49/43/41 beginnt, bekommt dort ein +49 vorangestellt. Für Nummern,
 * die schon fertig sind — die Absender-ID von Meta (immer mit Landesvorwahl,
 * ohne Plus), `fiaon_whatsapp.nummer`, das Ergebnis von nummerFuerWhatsApp —
 * ist genau das falsch: Aus einer US-Nummer (Muster: 13055550123) wurde 4913055550123,
 * aus der türkischen 905321234567 die 49905321234567. Antworten gingen an eine
 * Nummer, die es nicht gibt („Message undeliverable"), und Mara blieb stumm.
 *
 * Deshalb: Eine fertige Nummer (8–15 Ziffern, beginnt nicht mit 0, höchstens
 * ein Plus davor) wird NIE mehr umgerechnet. Alles andere läuft wie bisher
 * durch nummerFuerWhatsApp. Nur für Werte verwenden, die schon WhatsApp-Form
 * haben — rohe Formularnummern gehen weiter durch nummerFuerWhatsApp.
 */
export function waKanonisch(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/[\s\-()/.]/g, "");
  if (/^\+?[1-9]\d{7,14}$/.test(s)) return s.replace(/^\+/, "");
  return nummerFuerWhatsApp(roh);
}

/**
 * NACHGEWIESENE EINWILLIGUNG FÜR NACHRICHTEN, DIE WIR BEGINNEN (24.09.2026, E-230).
 *
 * NUR ZUR ANZEIGE: Justin hat am 24.09. entschieden, alle anzuschreiben, deren
 * Nummer WhatsApp kann — nicht nur die mit Einwilligung. Die Zentrale zeigt
 * je Gruppe, wie viele nachweislich eingewilligt haben.
 *
 * Meta erlaubt Vorlagen an Menschen nur mit Opt-in. Nachgewiesen ist es bei
 * uns auf zwei Wegen: (1) ein Meta-Lead-Formular mit WhatsApp-Hinweis im Text
 * (kein ausdrückliches Nein), (2) der Mensch hat uns selbst auf WhatsApp
 * geschrieben. Der Antrag auf der Website erwähnt WhatsApp NICHT — wer nur
 * dort beantragt hat, hat nicht eingewilligt. Gemessen am 24.09.: bei „Erste
 * Zahlung offen" 42 von 84, bei „Monatsrate fällig" 66 von 202.
 * Beschwerden solcher Empfänger drücken die Qualitätsbewertung der einen
 * Nummer, über die auch Mara antwortet — bis zur Sperre.
 *
 * `personAlias` ist der Ausdruck für die Personen-ID (z. B. "p.id").
 * Antworten im offenen 24-Stunden-Fenster brauchen das nicht — dort hat der
 * Mensch selbst geschrieben.
 */
export const WHATSAPP_EINWILLIGUNG_SQL = (personAlias: string) => `(
  EXISTS (SELECT 1 FROM fiaon_leads ew WHERE ew.person_id = ${personAlias} AND ew.quelle = 'facebook_lead_ads'
            AND COALESCE(ew.whatsapp_erlaubt, TRUE) IS TRUE)
  OR EXISTS (SELECT 1 FROM fiaon_whatsapp ei WHERE ei.person_id = ${personAlias} AND ei.richtung = 'rein')
)`;

/**
 * Handy oder Festnetz? WhatsApp gibt es nur auf Mobilnummern — eine Nachricht
 * an ein Festnetz kostet nur Zustellversuche und drückt die Qualitätsbewertung.
 * Erkannt werden DACH sicher, der Rest gilt als „unklar" (wir versuchen es).
 */
export function nummernArt(roh: unknown, land: "DE" | "AT" | "CH" = "DE"): NummernArt {
  const n = nummerFuerWhatsApp(roh, land);
  if (!n) return "keine";
  if (n.startsWith("49")) {
    const rest = n.slice(2);
    return /^1(5|6|7)/.test(rest) ? "handy" : "festnetz";
  }
  if (n.startsWith("43")) {
    const rest = n.slice(2);
    return /^6(4|5|6|7|8|9)/.test(rest) ? "handy" : "festnetz";
  }
  if (n.startsWith("41")) {
    const rest = n.slice(2);
    return /^7(4|5|6|7|8|9)/.test(rest) ? "handy" : "festnetz";
  }
  return "unklar";
}

export interface WhatsappLage {
  /** Spalte `whatsapp_erlaubt`: null = nie gefragt (zählt als Ja), false = ausdrückliches Nein. */
  erlaubt?: boolean | null;
  telefon?: string | null;
  land?: string | null;
  /** Werbesperre oder „keine Nachrichten mehr" — wiegt schwerer als alles andere. */
  gesperrt?: boolean | null;
}

export interface WhatsappUrteil {
  moeglich: boolean;
  nummer: string | null;
  art: NummernArt;
  /** Ein Satz für die Anzeige — immer gefüllt. */
  grund: string;
}

/** Die eine Prüfung, die jeder Kanal, jede Anzeige und jeder Zähler benutzt. */
export function whatsappUrteil(l: WhatsappLage): WhatsappUrteil {
  // E-244: dieselbe Land-Normalform wie der Versand („Österreich", „AUT" … → AT).
  const vl = versandLand(l.land);
  const land = vl === "AT" || vl === "CH" ? vl : "DE";
  const art = nummernArt(l.telefon, land);
  const nummer = nummerFuerWhatsApp(l.telefon, land);
  if (l.gesperrt) return { moeglich: false, nummer, art, grund: "Gesperrt — keine Nachrichten" };
  if (l.erlaubt === false) return { moeglich: false, nummer, art, grund: "Ausdrücklich abgelehnt" };
  if (art === "keine") return { moeglich: false, nummer: null, art, grund: "Keine Nummer" };
  if (art === "festnetz") return { moeglich: false, nummer, art, grund: "Festnetz — kein WhatsApp" };
  return { moeglich: true, nummer, art, grund: art === "handy" ? "WhatsApp möglich" : "WhatsApp möglich (Nummer ungeprüft)" };
}

/**
 * Dieselbe Regel in SQL — für Zähler und Listen. `l` ist der Alias der
 * Lead-Zeile. Bewusst grob: Feinheiten entscheidet `whatsappUrteil`.
 */
export const WHATSAPP_MOEGLICH_SQL = (alias = "l") => `(
  COALESCE(${alias}.whatsapp_erlaubt, TRUE) IS TRUE
  AND ${alias}.telefon IS NOT NULL
  AND regexp_replace(${alias}.telefon, '[^0-9]', '', 'g') <> ''
  AND (
    regexp_replace(${alias}.telefon, '[^0-9]', '', 'g') ~ '^(49)?01?5|^(49)?1[5-7]|^0?1[5-7]'
    OR regexp_replace(${alias}.telefon, '[^0-9]', '', 'g') ~ '^(43)?06[4-9]|^(43)6[4-9]'
    OR regexp_replace(${alias}.telefon, '[^0-9]', '', 'g') ~ '^(41)?07[4-9]|^(41)7[4-9]'
  )
)`;

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER WHATSAPP-SATZ IM GESPRÄCHS-FORMULAR (E-481, 05.11.2026)
//
// Justin: „alles an … vollautomatisiert“ (Entscheidung 2 A): Mara darf einen neuen Business-Lead einmal zuerst auf WhatsApp
// anschreiben — dafür nennt das Formular FIAON und WhatsApp (Meta verlangt beides). Die Seite schickt genau diesen Satz mit;
// der Server merkt das Ja nur, wenn er wortgleich ist (websiteOptinMerken). Widerruf: „STOPP“ (istStopp).
// ═══════════════════════════════════════════════════════════════════════════
export const GLOBAL_WA_HINWEIS = {
  de: "Mit dem Absenden erlauben Sie der FIAON LTD, Sie zu Ihrer Anfrage auch per WhatsApp zu kontaktieren – jederzeit widerrufbar, z. B. mit „STOPP“.",
  en: "By sending, you allow FIAON LTD to contact you about your enquiry on WhatsApp as well – you can withdraw this at any time, e.g. by replying “STOP”.",
} as const;
/** Hat die Seite genau den Satz gezeigt und mitgeschickt? Rein. */
export function globalWaHinweisGezeigt(roh: unknown): boolean {
  const t = String(roh ?? "").trim();
  return t === GLOBAL_WA_HINWEIS.de || t === GLOBAL_WA_HINWEIS.en;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): DAS JA AM TELEFON UND DIE NUMMER AUS DEM FORMULAR
//
// Justin (09.11.2026): „ALLES, sodass jeder neue Lead auch ne Mail, WhatsApp und co bekommt — nichts darf still hängen“.
// Befund (Produktion nur gelesen): Die Ja-Zeile zu einer Buchung trug „15…“ (11 Ziffern, im Buchungsformular ohne 0 und
// ohne +49 getippt) — waKanonisch hielt sie für eine fertige +1-Nummer (USA). Das Ja passte nicht zur Anfrage, die
// Begrüßung wäre an eine fremde Nummer gegangen. Formularnummern laufen deshalb durch nummerFuerVersand MIT dem Land
// (DE/AT/CH-Handynummer ohne + oder 00 nie als +1; 15x/16x/17x mit 10–11 Ziffern → 49). Nur eine Nummer, die wir von
// WhatsApp selbst haben (Absender-ID, Anfrage aus WhatsApp), bleibt waKanonisch.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Der Satz, den die anrufende Person vorliest, bevor sie im Firmen-Cockpit „Möchte auch per WhatsApp“ hakt — er nennt
 * FIAON und WhatsApp (Meta verlangt beides) und den Widerruf. Er wird mit Wer und Wann an der Nummer gespeichert.
 */
export const GLOBAL_WA_TELEFON_SATZ = {
  de: "Dürfen wir, die FIAON LTD, Sie zu Ihrer Anfrage auch per WhatsApp kontaktieren? Das können Sie jederzeit widerrufen, z. B. mit „STOPP“.",
  en: "May we, FIAON LTD, also contact you about your enquiry on WhatsApp? You can withdraw this at any time, e.g. by replying “STOP”.",
} as const;

/**
 * Nach diesen Anruf-Ergebnissen zählt das Ja am Telefon — EINE Liste für das Cockpit (Häkchen, Satz danach) und den Server
 * (telefonJaMerken). Nur ein Gespräch, nach dem Mara ihm auch wirklich schreibt: „Interesse“ (die Begrüßung) und „Termin
 * vereinbart“ (die Terminbestätigung, am Vortag die Erinnerung).
 * E-487 Nachbesserung (Gutachten, 09.11.2026): NICHT „Erreicht — macht den Antrag“. Dann steht der Lead auf „Antrag läuft“ —
 * Begrüßung, Takt und Wächter lassen diesen Stand bewusst aus (die Begrüßung fragt „Wie möchten Sie das Gespräch führen?“,
 * das passt nach dem Antrag nicht; ihn führt die Info-Mail mit dem Link). Vorher sagte das Cockpit „Mara schreibt ihm“, und
 * es kam nie etwas.
 */
export const TELEFON_JA_ERGEBNISSE = ["erreicht_interesse", "erreicht_termin"] as const;

/** Eine Telefonnummer aus einem FORMULAR (Website, Meta, Cockpit) in WhatsApp-Form — mit dem Land der Anfrage. Rein. */
export function formularNummer(roh: unknown, land?: string | null): string | null {
  return nummerFuerVersand(roh, land);
}

/** Die letzten neun Ziffern (der Teilnehmer ohne Landesvorwahl) — leer bei weniger als sieben Ziffern. Rein. */
export function nummerKey9(roh: unknown): string {
  const d = String(roh ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
}

/**
 * Welche Nummer bekommt das Ja? `anfrage` = die WhatsApp-Nummer der Anfrage (Meta/Website), `eingabe` = die Nummer, die er
 * beim Ja angegeben hat (Buchungsformular, die angerufene Nummer). Derselbe Anschluss (gleiche letzte neun Ziffern) → die
 * Nummer der Anfrage (sie ist sauber erfasst); ein anderer Anschluss → seine Eingabe (für genau diese Nummer gab er das Ja).
 * Rein.
 */
export function waJaNummer(ein: { anfrage: string | null; eingabe: string | null }): string | null {
  const a = ein.anfrage || null;
  const e = ein.eingabe || null;
  if (a && e && nummerKey9(a) === nummerKey9(e)) return a;
  return e ?? a;
}

/**
 * Wurde eine Nummer falsch gelesen? Gleicher Anschluss (letzte neun Ziffern) wie die Nummer der Anfrage, aber eine andere
 * Landesvorwahl — z. B. „15…“ (als +1 gelesen) statt „4915…“. Rein.
 */
export function nummerFalschGelesen(schluessel: unknown, erwartet: unknown): boolean {
  const s = String(schluessel ?? "");
  const e = String(erwartet ?? "");
  if (!/^\d{8,15}$/.test(s) || !/^\d{8,15}$/.test(e) || s === e) return false;
  return nummerKey9(s) === nummerKey9(e);
}
