// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DIE HARTEN TELEFON-REGELN, rein (E-408, 20.10.2026)
//
// Was ARAS am Telefon nie sagen oder tun darf — ohne KI geprüft, auf dem Text
// (Anweisung, Regie-Satz) und auf dem Live-Transkript nach dem Gespräch:
//   · kein Druck (KI-VO Art. 5 Abs. 1 lit. b): keine Zeitfalle („nur heute“),
//     keine Drohkulisse („sonst Gericht/SCHUFA/Inkasso“), kein „keine andere Wahl“
//   · keine Lastschrift (Justin 19.10.: der Kunde überweist selbst)
//   · kein Vertrag per Stimme (E-329, § 9 Abs. 2 FAGG)
//   · KI-Hinweis in den ersten 20 s (KI-VO Art. 50), Aufnahme erst nach dem Ja
//     (§ 201 StGB), das Anliegen erst nach der Identitätsbestätigung
// Dazu dieselbe Wortwand wie beim Schreiben (shared/fiaon-wortverbote.ts) und die
// Limit-Prüfung (shared/fiaon-mara-ton.ts) — EINE Wand, kein zweiter Wortschatz.
//
// Wortgleich mit den Regeln von Prüf-Mara (E-409, shared/fiaon-ki-pruefung-regeln.ts,
// noch nicht auf main). Nach dem Zusammenführen wird diese Datei zur Weiterleitung:
//   export { druckFinden, lastschriftFinden, … } from "./fiaon-ki-pruefung-regeln";
// Geprüft in scripts/pruef-aras-plan.ts (mit Rot-Proben).
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen, kopplungFinden, drohungFinden } from "./fiaon-wortverbote";
import { limitPruefen } from "./fiaon-mara-ton";

/** Eine Transkriptzeile (fiaon_aras_anruf.transkript bzw. Live-Zeilen). */
export interface RegelZeile { t?: number; wer: "kunde" | "aras"; text: string }

/** Ein Befund: fester Schlüssel, Schwere, Fundstelle, Hinweis. */
export interface RegelPunkt { regel: string; schwere: "hart" | "weich"; treffer: string; hinweis: string }

/** Zeiten in Sekunden seit dem Abheben (null = unbekannt). */
export interface TelefonLage {
  kiHinweisSek?: number | null;
  aufnahmeJaSek?: number | null;
  aufnahmeGestartetSek?: number | null;
  aufnahmeNeinSek?: number | null;
  /** Der Kunde sagte „nicht mehr anrufen“, und die Sperre fehlt. */
  sperrwunschOhneSperre?: boolean;
  transkript?: RegelZeile[] | null;
}

// ── Druck (KI-VO Art. 5 Abs. 1 lit. b): Zeitfallen, Drohkulisse, Ausnutzen der Lage ──
const DRUCK_MUSTER: { re: RegExp; hinweis: string }[] = [
  { re: /\b(?:nur|bloß|bloss)\s+(?:noch\s+)?heute\b|\bnur\s+(?:noch\s+)?bis\s+(?:heute|morgen|mitternacht)\b|\bheute\s+ist\s+(?:die|ihre)\s+letzte\b/i, hinweis: "Zeitfalle („nur heute“) — verboten (KI-VO Art. 5)." },
  { re: /\bletzte\s+(?:chance|gelegenheit|möglichkeit|moeglichkeit)\b/i, hinweis: "„Letzte Chance“ ist Druck — verboten." },
  { re: /\b(?:sonst|andernfalls|ansonsten)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)/i, hinweis: "Drohkulisse („sonst Gericht/SCHUFA/Inkasso“) — verboten." },
  { re: /\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs|teurer|verlieren)/i, hinweis: "Bedingte Drohung („wenn Sie nicht … dann …“) — verboten." },
  // Umgekehrte Reihenfolge („… kommt das Gericht, wenn Sie nicht zahlen“) — dieselbe Drohung.
  { re: /\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)[^.!?\n]{0,80}\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b/i, hinweis: "Bedingte Drohung („… Gericht, wenn Sie nicht …“) — verboten." },
  { re: /\bsie\s+haben\b[^.!?\n]{0,24}\b(?:keine|kein)\s+(?:andere\s+)?(?:wahl|möglichkeit|moeglichkeit|alternative)\b/i, hinweis: "Ausnutzen der Lage („keine andere Wahl“) — verboten." },
  { re: /\bjetzt\s+oder\s+nie\b|\bsofort\s+entscheiden\b|\b(?:das\s+angebot|der\s+preis)\s+gilt\s+nur\s+(?:jetzt|heute|solange)\b/i, hinweis: "Entscheidungsdruck — verboten." },
];

/** Der erste Druck-Treffer (Hinweis) oder null. Rein. */
export function druckFinden(text: string): string | null {
  const t = String(text ?? "");
  for (const m of DRUCK_MUSTER) if (m.re.test(t)) return m.hinweis;
  return null;
}

/** „Lastschrift“ ist ausgeschlossen (Justin 19.10.: der Kunde überweist aktiv und selbst) — außer im Verbotssatz. */
export function lastschriftFinden(text: string): string | null {
  const t = String(text ?? "");
  const m = /\b(?:lastschrift|sepa-?mandat|einzugsermächtigung|einzugsermaechtigung|abbuchen|abbuchung|einziehen)\b/i.exec(t);
  if (!m) return null;
  const satz = t.slice(Math.max(0, t.lastIndexOf(".", m.index) + 1), t.indexOf(".", m.index) === -1 ? t.length : t.indexOf(".", m.index) + 1);
  if (/\b(?:kein|keine|nicht|nie|ausgeschlossen|gibt es nicht|bieten wir nicht)\b/i.test(satz)) return null;
  return m[0];
}

/** Vertrag per Stimme „geschlossen“ — verboten: der Kunde unterschreibt selbst (E-329, § 9 Abs. 2 FAGG). */
export function vertragZusageFinden(text: string): string | null {
  const m = /\b(?:dann\s+sind\s+wir\s+(?:uns\s+)?einig|(?:der\s+)?vertrag\s+(?:ist\s+)?(?:hiermit\s+)?(?:abgeschlossen|zustande\s+gekommen|geschlossen)|(?:das|es)\s+gilt\s+als\s+(?:abgeschlossen|vereinbart)|ich\s+(?:buche|schließe|schliesse)\s+(?:das|den\s+vertrag)\s+(?:jetzt\s+)?(?:für\s+sie\s+)?ab)\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Nennt die Zeile das Anliegen (Rate, Antrag, Paket, Betrag)? Vor der Identitätsbestätigung verboten (Dritte am Telefon). */
export function anliegenGenannt(text: string): boolean {
  return /\b(?:rate|raten|antrag|paket|limit|überweis|ueberweis|zahlung|euro|verwendungszweck)\b|€/i.test(String(text ?? ""));
}

/** Die erste Aras-Zeile mit Anliegen VOR der ersten Kundenzeile — davor nur Begrüßung, KI-Hinweis, Identitätsfrage. */
export function anliegenVorIdentitaet(zeilen: readonly RegelZeile[] | null | undefined): string | null {
  if (!zeilen?.length) return null;
  for (const z of zeilen) {
    if (z.wer === "kunde") return null;
    if (anliegenGenannt(z.text)) return z.text.slice(0, 160);
  }
  return null;
}

/** Hat ARAS gesagt, dass er eine KI ist? („digitale Assistent, also eine KI“) */
export function kiHinweisGesagt(zeilen: readonly RegelZeile[] | null | undefined): boolean {
  return (zeilen ?? []).some((z) => z.wer === "aras" && /\b(?:ki|künstliche intelligenz|kuenstliche intelligenz|digitale[rn]?\s+assistent)\b/i.test(z.text));
}

export const KI_HINWEIS_SPAETESTENS_SEK = 20;

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
export function telefonRegeln(text: string, tel: TelefonLage | null = null): RegelPunkt[] {
  const punkte: RegelPunkt[] = [];
  const t = String(text ?? "");
  const push = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) =>
    punkte.push({ regel, schwere, treffer: String(treffer ?? "").slice(0, 160), hinweis: String(hinweis ?? "").slice(0, 240) });

  for (const w of wandPruefen(t)) push(`wand_${w.art}`, w.art === "floskel" ? "weich" : "hart", w.treffer, w.hinweis);
  for (const l of limitPruefen(t)) push(`limit_${l.art}`, l.art === "ohne_bank" ? "weich" : "hart", l.satz, l.art === "zusage" ? "Limit zugesagt — nie ‚garantiert‘, nie ‚sicher‘." : l.art === "freigabe" ? "Freigabe versprochen — über den Rahmen entscheidet die Partnerbank." : "Limit ohne Bank-Satz genannt.");
  const kopp = kopplungFinden(t); if (kopp) push("kopplung", "hart", kopp, "Kündigung an Zahlung gekoppelt (§ 312k BGB).");
  const droh = drohungFinden(t); if (droh) push("drohung", "hart", droh, "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.");
  const druck = druckFinden(t); if (druck) push("druck", "hart", druck, druck);
  const ls = lastschriftFinden(t); if (ls) push("lastschrift", "hart", ls, "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.");
  const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
  const nb = nullBetragFinden(t); if (nb) push("betrag_null", "hart", nb, "„Null Euro“ / „0 €“ gesagt — ein Betrag nur aus einem Betragsfeld, eine Anzahl ist nie ein Betrag.");
  const url = urlFinden(t); if (url) push("url_vorgelesen", "weich", url, "Internetadresse vorgelesen — der Link kommt aufs Handy.");
  if (tel) {
    const zeilen = tel.transkript ?? null;
    if (tel.kiHinweisSek == null && zeilen && !kiHinweisGesagt(zeilen)) push("ki_hinweis_fehlt", "hart", "", "KI-Hinweis nicht gesagt (KI-VO Art. 50).");
    if (tel.kiHinweisSek != null && tel.kiHinweisSek > KI_HINWEIS_SPAETESTENS_SEK) push("ki_hinweis_spaet", "hart", `${Math.round(tel.kiHinweisSek)} s`, `KI-Hinweis erst nach ${Math.round(tel.kiHinweisSek)} s (erlaubt: ${KI_HINWEIS_SPAETESTENS_SEK} s).`);
    if (tel.aufnahmeGestartetSek != null && (tel.aufnahmeJaSek == null || tel.aufnahmeGestartetSek < tel.aufnahmeJaSek)) push("aufnahme_vor_ja", "hart", "", "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).");
    if (tel.aufnahmeNeinSek != null && tel.aufnahmeGestartetSek != null) push("aufnahme_trotz_nein", "hart", "", "Aufnahme trotz Nein gestartet.");
    if (tel.sperrwunschOhneSperre) push("sperrwunsch_ohne_sperre", "hart", "", "Kunde will nicht mehr angerufen werden — Sperre fehlt.");
    const vorab = anliegenVorIdentitaet(zeilen);
    if (vorab) push("anliegen_vor_identitaet", "hart", vorab, "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist.");
  }
  return punkte;
}
