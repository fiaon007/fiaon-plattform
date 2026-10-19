// ═══════════════════════════════════════════════════════════════════════════
// PRÜF-MARA — DIE REINEN REGELN (E-409, 19.10.2026)
//
// Justin (fiaon-mara-endziel): Qualitätskontrolle von Maras Arbeit macht eine
// zweite KI automatisch; nur Auffälliges kommt als Karte zu ihm. Keine
// Mitarbeiter-Pflicht. Hier stehen die HARTEN Regeln ohne KI — dieselbe
// Wortwand, derselbe Ton wie beim Schreiben (shared/fiaon-wortverbote.ts,
// shared/fiaon-mara-ton.ts) — plus die Telefon-Regeln des Vertrags (§ 11):
// KI-Hinweis in den ersten 20 s, Anliegen erst nach Identitätsbestätigung,
// Aufnahme erst nach dem Ja, kein „Lastschrift“, kein Druck (KI-VO Art. 5
// Abs. 1 lit. b — wirtschaftliche Lage), keine Vertrags-Zusage per Stimme.
//
// Alles hier ist rein (kein Netz, keine Datenbank) und in
// scripts/pruef-ki-pruefung.ts geprüft. Der Server (server/lib/fiaon-ki-pruefung.ts)
// ruft `harteRegeln`, fragt danach das Modell und bildet mit `urteilBilden` das Urteil.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen, kopplungFinden, drohungFinden } from "./fiaon-wortverbote";
import { tonPruefung, limitPruefen, type MaraKanal } from "./fiaon-mara-ton";
import type { MitarbeiterEintrag } from "./fiaon-mitarbeiter-name";
import type { PruefPunkt } from "./fiaon-ki-team";

export type PruefKanal = "telefon" | "mail" | "whatsapp";
export type PruefUrteil = "ok" | "auffaellig" | "fehler";

/** Eine Transkriptzeile (fiaon_aras_anruf.transkript bzw. Live-Zeilen). */
export interface TranskriptZeile { t?: number; wer: "kunde" | "aras"; text: string }

export interface PruefKontext {
  kanal: PruefKanal;
  land?: "DE" | "AT" | "CH" | null;
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  kundeNamen?: readonly (string | null | undefined)[];
  /** Telefon: Zeiten in Sekunden seit Abheben (null = unbekannt). */
  telefon?: {
    kiHinweisSek?: number | null;
    aufnahmeJaSek?: number | null;
    aufnahmeGestartetSek?: number | null;
    aufnahmeNeinSek?: number | null;
    /** Twilio meldete „Maschine“, obwohl der Kunde sprach. */
    amdWiderspruch?: boolean;
    /** Der Kunde sagte „nicht mehr anrufen“, und die Sperre fehlt. */
    sperrwunschOhneSperre?: boolean;
    transkript?: TranskriptZeile[] | null;
  } | null;
}

// ── Druck (KI-VO Art. 5 Abs. 1 lit. b): Zeitfallen, Drohkulisse, Ausnutzen der Lage ──
const DRUCK_MUSTER: { re: RegExp; hinweis: string }[] = [
  { re: /\b(?:nur|bloß|bloss)\s+(?:noch\s+)?heute\b|\bnur\s+(?:noch\s+)?bis\s+(?:heute|morgen|mitternacht)\b|\bheute\s+ist\s+(?:die|ihre)\s+letzte\b/i, hinweis: "Zeitfalle („nur heute“) — verboten (KI-VO Art. 5)." },
  { re: /\bletzte\s+(?:chance|gelegenheit|möglichkeit|moeglichkeit)\b/i, hinweis: "„Letzte Chance“ ist Druck — verboten." },
  { re: /\b(?:sonst|andernfalls|ansonsten)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)/i, hinweis: "Drohkulisse („sonst Gericht/SCHUFA/Inkasso“) — verboten." },
  { re: /\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs|teurer|verlieren)/i, hinweis: "Bedingte Drohung („wenn Sie nicht … dann …“) — verboten." },
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

/** Vertrag per Stimme/Text „geschlossen“ — verboten: der Kunde unterschreibt selbst (E-329, § 9 Abs. 2 FAGG). */
export function vertragZusageFinden(text: string): string | null {
  const m = /\b(?:dann\s+sind\s+wir\s+(?:uns\s+)?einig|(?:der\s+)?vertrag\s+(?:ist\s+)?(?:hiermit\s+)?(?:abgeschlossen|zustande\s+gekommen|geschlossen)|(?:das|es)\s+gilt\s+als\s+(?:abgeschlossen|vereinbart)|ich\s+(?:buche|schließe|schliesse)\s+(?:das|den\s+vertrag)\s+(?:jetzt\s+)?(?:für\s+sie\s+)?ab)\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Nennt die Zeile das Anliegen (Rate, Antrag, Paket, Betrag)? Vor der Identitätsbestätigung verboten (Dritte am Telefon). */
export function anliegenGenannt(text: string): boolean {
  return /\b(?:rate|raten|antrag|paket|limit|überweis|ueberweis|zahlung|€|euro|verwendungszweck)\b/i.test(String(text ?? ""));
}

/** Die erste Kundenzeile — davor darf ARAS nur Begrüßung, KI-Hinweis und Identitätsfrage sagen. Rein. */
export function anliegenVorIdentitaet(zeilen: readonly TranskriptZeile[] | null | undefined): string | null {
  if (!zeilen?.length) return null;
  for (const z of zeilen) {
    if (z.wer === "kunde") return null;
    if (anliegenGenannt(z.text)) return z.text.slice(0, 160);
  }
  return null;
}

/** Hat ARAS gesagt, dass er eine KI ist? (ENTWURF § 2: „digitale Assistent, also eine KI“) */
export function kiHinweisGesagt(zeilen: readonly TranskriptZeile[] | null | undefined): boolean {
  return (zeilen ?? []).some((z) => z.wer === "aras" && /\b(?:ki|künstliche intelligenz|kuenstliche intelligenz|digitale[rn]?\s+assistent)\b/i.test(z.text));
}

const KI_HINWEIS_SPAETESTENS_SEK = 20;
/** Ton-Regeln, die nur beim Schreiben gelten (Anrede setzt der Server, Herr/Frau kommt aus der gespeicherten Anrede). */
const TON_NUR_BEIM_SCHREIBEN = new Set(["mail_anrede", "herr_frau"]);

/**
 * Alle harten Regeln auf einen Text (Mail, WhatsApp) oder ein Transkript (Telefon).
 * Rein. Jeder Punkt: regel (fester Schlüssel), schwere, treffer, hinweis.
 */
export function harteRegeln(text: string, k: PruefKontext): PruefPunkt[] {
  const punkte: PruefPunkt[] = [];
  const t = String(text ?? "");
  const push = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) =>
    punkte.push({ regel, schwere, treffer: String(treffer ?? "").slice(0, 160), hinweis: String(hinweis ?? "").slice(0, 240) });

  for (const w of wandPruefen(t)) push(`wand_${w.art}`, w.art === "floskel" ? "weich" : "hart", w.treffer, w.hinweis);
  const kanal: MaraKanal = k.kanal === "mail" ? "mail" : "whatsapp";
  for (const b of tonPruefung(t, { kanal, land: k.land ?? null, mitarbeiter: k.mitarbeiter ?? null, kundeNamen: k.kundeNamen })) {
    // Zwei Ton-Regeln gelten dem MODELLTEXT vor dem Versand (der Server setzt die Anrede selbst) — eine gesendete
    // Mail trägt sie zu Recht. Für die Prüfung des Gesendeten sind sie kein Befund.
    if (TON_NUR_BEIM_SCHREIBEN.has(b.id)) continue;
    push(`ton_${b.id}`, b.schwere === "hart" ? "hart" : "weich", b.treffer, b.hinweis);
  }
  for (const l of limitPruefen(t)) push(`limit_${l.art}`, l.art === "ohne_bank" ? "weich" : "hart", l.satz, l.art === "zusage" ? "Limit zugesagt — nie ‚garantiert‘, nie ‚sicher‘." : l.art === "freigabe" ? "Freigabe versprochen — über den Rahmen entscheidet die Partnerbank." : "Limit ohne Bank-Satz genannt.");
  const kopp = kopplungFinden(t); if (kopp) push("kopplung", "hart", kopp, "Kündigung an Zahlung gekoppelt (§ 312k BGB).");
  const droh = drohungFinden(t); if (droh) push("drohung", "hart", droh, "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.");
  const druck = druckFinden(t); if (druck) push("druck", "hart", druck, druck);
  const ls = lastschriftFinden(t); if (ls) push("lastschrift", "hart", ls, "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.");
  if (k.kanal === "telefon") {
    const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
    const tel = k.telefon ?? null;
    const zeilen = tel?.transkript ?? null;
    if (tel) {
      if (tel.kiHinweisSek == null && zeilen && !kiHinweisGesagt(zeilen)) push("ki_hinweis_fehlt", "hart", "", "KI-Hinweis nicht gesagt (KI-VO Art. 50).");
      if (tel.kiHinweisSek != null && tel.kiHinweisSek > KI_HINWEIS_SPAETESTENS_SEK) push("ki_hinweis_spaet", "hart", `${Math.round(tel.kiHinweisSek)} s`, `KI-Hinweis erst nach ${Math.round(tel.kiHinweisSek)} s (erlaubt: ${KI_HINWEIS_SPAETESTENS_SEK} s).`);
      if (tel.aufnahmeGestartetSek != null && (tel.aufnahmeJaSek == null || tel.aufnahmeGestartetSek < tel.aufnahmeJaSek)) push("aufnahme_vor_ja", "hart", "", "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).");
      if (tel.aufnahmeNeinSek != null && tel.aufnahmeGestartetSek != null) push("aufnahme_trotz_nein", "hart", "", "Aufnahme trotz Nein gestartet.");
      if (tel.amdWiderspruch) push("amd_widerspruch", "weich", "", "Twilio meldete Maschine, obwohl der Kunde sprach — Gespräch lief weiter (Quote beobachten).");
      if (tel.sperrwunschOhneSperre) push("sperrwunsch_ohne_sperre", "hart", "", "Kunde will nicht mehr angerufen werden — Sperre fehlt.");
    }
    const vorab = anliegenVorIdentitaet(zeilen);
    if (vorab) push("anliegen_vor_identitaet", "hart", vorab, "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist.");
  }
  return punkte;
}

/** Das Modell-Urteil, wie es der Server (oder die Attrappe im Prüfstand) liefert. */
export interface ModellUrteil { urteil: PruefUrteil; punkte: PruefPunkt[]; begruendung: string }

/** Die rohe Modell-Antwort in eine sichere Form bringen — nichts Unbekanntes kommt durch. Rein. */
export function modellUrteilLesen(roh: unknown): ModellUrteil | null {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object") return null;
  const urteil: PruefUrteil = o.urteil === "fehler" ? "fehler" : o.urteil === "auffaellig" ? "auffaellig" : "ok";
  const punkte: PruefPunkt[] = (Array.isArray(o.punkte) ? o.punkte : []).slice(0, 8).map((p: any) => ({
    regel: `modell_${String(p?.regel ?? "hinweis").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40)}`,
    schwere: p?.schwere === "hart" ? "hart" : "weich",
    treffer: String(p?.treffer ?? "").slice(0, 160),
    hinweis: String(p?.hinweis ?? "").slice(0, 240),
  }));
  return { urteil, punkte, begruendung: String(o.begruendung ?? "").slice(0, 600) };
}

/**
 * Das Urteil: ein harter Treffer = fehler; sonst auffällig, wenn das Modell es sagt oder mindestens
 * zwei weiche Punkte zusammenkommen; ein einzelner weicher Punkt bleibt „ok“ (steht trotzdem in den Punkten).
 * Rein.
 */
export function urteilBilden(harte: PruefPunkt[], modell: ModellUrteil | null): { urteil: PruefUrteil; punkte: PruefPunkt[] } {
  const punkte = [...harte, ...(modell?.punkte ?? [])];
  if (punkte.some((p) => p.schwere === "hart") || modell?.urteil === "fehler") return { urteil: "fehler", punkte };
  const weich = punkte.filter((p) => p.schwere === "weich").length;
  if (modell?.urteil === "auffaellig" || weich >= 2) return { urteil: "auffaellig", punkte };
  return { urteil: "ok", punkte };
}

/** Karte nur bei Auffälligem — und die Empfehlung dazu (Vertrag § 11). */
export function karteNoetig(urteil: PruefUrteil): boolean { return urteil !== "ok"; }
export function empfehlungFuer(urteil: PruefUrteil): "in_ordnung" | "anweisen" { return urteil === "fehler" ? "anweisen" : "in_ordnung"; }

/**
 * Stichprobe: gehört diese Zeile (id) bei der Quote (0–100 %) in die Prüfung? Deterministisch —
 * dieselbe Zeile bekommt bei derselben Quote immer dieselbe Antwort (kein Zufall, der den Prüfstand wackeln lässt).
 */
export function inStichprobe(id: number, quote: number): boolean {
  const q = Math.max(0, Math.min(100, Math.round(Number(quote) || 0)));
  if (q >= 100) return true;
  if (q <= 0) return false;
  let h = 2166136261;
  for (const z of `pruef:${Math.trunc(id)}`) { h ^= z.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 100) < q;
}

/** Die Prüfquoten (fiaon_settings.pruef_mara_quote) lesen — Vorgabe telefon 100, mail 20, whatsapp 20. Rein. */
export const QUOTE_VORGABE = { telefon: 100, mail: 20, whatsapp: 20 } as const;
export function quotenLesen(roh: unknown): { telefon: number; mail: number; whatsapp: number } {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const z = (k: keyof typeof QUOTE_VORGABE) => {
    const n = Number(o?.[k]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : QUOTE_VORGABE[k];
  };
  return { telefon: z("telefon"), mail: z("mail"), whatsapp: z("whatsapp") };
}

/** Fehlerquote je Schlüssel (Werkzeug/Spielart/Kanal) aus Zählzeilen — und die Vorschläge „gelb → grün“. Rein. */
export function fehlerquoteRechnen(
  zeilen: { kanal: string; schluessel: string | null; n: number; auffaellig: number }[],
  opt: { tage: number; gelb?: readonly string[] } = { tage: 7 },
): { je: { kanal: string; schluessel: string; n: number; auffaellig: number; quote: number }[]; gesamt: { n: number; auffaellig: number; quote: number }; vorschlaege: string[] } {
  const je = zeilen.map((z) => {
    const n = Number(z.n) || 0, a = Number(z.auffaellig) || 0;
    return { kanal: z.kanal, schluessel: z.schluessel ?? "(ohne)", n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 };
  }).sort((x, y) => y.quote - x.quote || y.n - x.n);
  const n = je.reduce((s, z) => s + z.n, 0), a = je.reduce((s, z) => s + z.auffaellig, 0);
  const vorschlaege: string[] = [];
  if (opt.tage >= 28) {
    for (const g of opt.gelb ?? []) {
      const z = je.find((x) => x.schluessel === g);
      if (z && z.n >= 20 && z.quote < 2) vorschlaege.push(`„${g}“: ${z.n} Prüfungen in ${opt.tage} Tagen, ${z.quote} % auffällig — gelb → grün wäre vertretbar.`);
    }
  }
  return { je, gesamt: { n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 }, vorschlaege };
}

/** Transkript-Ausschnitt für die Karte: nur der betroffene Satz, ≤ 300 Zeichen, ohne Vornamen der Mitarbeiter. Rein. */
export function ausschnittFuerKarte(text: string, treffer: string, mitarbeiter?: readonly MitarbeiterEintrag[] | null): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  let s = t;
  const i = treffer ? t.toLowerCase().indexOf(String(treffer).toLowerCase()) : -1;
  if (i >= 0) {
    const a = Math.max(0, t.lastIndexOf(". ", i) + 1), e = t.indexOf(". ", i);
    s = t.slice(a, e === -1 ? t.length : e + 1).trim();
  }
  for (const m of mitarbeiter ?? []) {
    if (m.vorname) s = s.replace(new RegExp(`\\b${m.vorname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), m.anrede ? `${m.anrede} ${m.nachname}` : m.nachname);
  }
  return s.length > 300 ? `${s.slice(0, 297)}…` : s;
}
