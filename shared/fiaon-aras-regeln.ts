// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DIE HARTEN TELEFON-REGELN (E-408, 20.10.2026)
//
// EINE Quelle mit Prüf-Mara (E-409): Wortwand, Druck, Lastschrift, Vertrag per Stimme, KI-Hinweis, Aufnahme nur nach
// dem Ja und „Anliegen erst nach der Identität“ (über das ganze Gespräch) kommen aus shared/fiaon-ki-pruefung-regeln.ts
// — diese Datei leitet sie nur weiter. Damit prüft die Live-Nachbereitung (fiaon-aras-nachbereitung.ts) genauso wie
// Prüf-Mara. Hier stehen nur Arasʼ eigene Zusatzregeln aus Justins Probeanrufen (20.10.): nie „null Euro“, keine
// vorgelesene Internetadresse, keine Anzahl ohne ihr Wort, eine Frage je Redebeitrag.
// Geprüft in scripts/pruef-aras-plan.ts und scripts/pruef-aras-prompt.ts (mit Rot-Proben).
// ═══════════════════════════════════════════════════════════════════════════
import { telefonRegeln as pruefTelefonRegeln, punkteZusammen, type RegelPunkt, type TelefonLage } from "./fiaon-ki-pruefung-regeln";

export {
  druckFinden, lastschriftFinden, vertragZusageFinden, anliegenGenannt, anliegenVorIdentitaet, kiHinweisGesagt, KI_HINWEIS_SPAETESTENS_SEK,
  type RegelZeile, type RegelPunkt, type TelefonLage,
} from "./fiaon-ki-pruefung-regeln";

// ── Probe 20.10.2026 (Justins erster Anruf): Wahrheit und Ton am Telefon ─────────────────────────────────
/** „null Euro“ / „0 €“ — eine Anzahl wurde als Betrag gelesen („die erste Rate beträgt null Euro“). */
export function nullBetragFinden(text: string): string | null {
  const m = /\bnull\s+euro\b|(?<![\d.,])0(?:[.,]0+)?\s*(?:€|euro\b)|€\s*0(?:[.,]0+)?(?![\d.,])/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/** Eine vorgelesene Internetadresse („fiaon punkt com slash privacy“, fiaon.com/…, http …). */
export function urlFinden(text: string): string | null {
  const m = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|de|at|ch|net|org)\/\S*|\bpunkt\s+(?:com|de|at|ch)\b|\bslash\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/** Eine Anzahl ohne ihr Wort („0 offen“, „offen: 0“) — die Vorstufe zu „null Euro“. */
export function zahlOhneEinheitFinden(text: string): string | null {
  const m = /\b0\s+(?:offen|bezahlt|ausstehend)\b|\b(?:offen|bezahlt|ausstehend)\s*:\s*\d+\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}
/**
 * EIN Redebeitrag: höchstens eine Frage, und nach der Frage höchstens ein ganz kurzer Nachsatz („Ein kurzes Ja reicht.“).
 * Liefert den Grund oder null. Rein.
 */
export function fragenImBeitrag(text: string): string | null {
  const t = String(text ?? "").trim();
  const fragen = (t.match(/\?/g) ?? []).length;
  if (fragen > 1) return `${fragen} Fragen in einem Redebeitrag`;
  if (fragen === 1) {
    const nach = t.slice(t.indexOf("?") + 1).replace(/[„“”"»«]/g, "").trim();
    const woerter = nach ? nach.split(/\s+/).filter(Boolean).length : 0;
    if (woerter > 5) return `nach der Frage geht es weiter („${nach.slice(0, 60)}“)`;
  }
  return null;
}

/**
 * Alle harten Regeln auf das, was ARAS gesagt hat (+ Zeiten des Gesprächs). Rein.
 * Gespeichert wird nur der Befund (Schlüssel + Schwere), nie der Wortlaut ohne Aufnahme-Ja.
 */
/**
 * Alle harten Telefon-Regeln auf das, was ARAS gesagt hat (+ Zeiten des Gesprächs): die von Prüf-Mara (eine Quelle)
 * und Arasʼ Zusatzregeln. Rein. Gespeichert wird nur der Befund (Schlüssel + Schwere), nie der Wortlaut ohne Aufnahme-Ja.
 */
export function telefonRegeln(text: string, tel: TelefonLage | null = null): RegelPunkt[] {
  const zusatz: RegelPunkt[] = [];
  const t = String(text ?? "");
  const nb = nullBetragFinden(t); if (nb) zusatz.push({ regel: "betrag_null", schwere: "hart", treffer: nb.slice(0, 160), hinweis: "„Null Euro“ / „0 €“ gesagt — ein Betrag nur aus einem Betragsfeld, eine Anzahl ist nie ein Betrag." });
  const url = urlFinden(t); if (url) zusatz.push({ regel: "url_vorgelesen", schwere: "weich", treffer: url.slice(0, 160), hinweis: "Internetadresse vorgelesen — der Link kommt aufs Handy." });
  return punkteZusammen(pruefTelefonRegeln(t, tel), zusatz);
}
