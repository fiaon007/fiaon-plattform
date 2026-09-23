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
  const land = l.land === "AT" || l.land === "CH" ? l.land : "DE";
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
