// ═══════════════════════════════════════════════════════════════════════════
// MARA BEANTWORTET ANLIEGEN AUS DEM KUNDENBEREICH — DIE REGELN (19.10.2026, E-406 C1)
//
// Justin (19.10.2026, Vorschlag 3 „Mara führt den Betrieb“): „los, starte Etappe A und alle anderen gleichzeitig,
// damit alles fertig wird … mach einfach mal.“ Teil davon (Etappe C): Kunden schreiben im Kundenbereich unter
// „Hilfe & Anliegen“ (Tabelle fiaon_tickets). Bis heute antwortet nur ein Mensch über /agent/anliegen.
//
// Gemessen (Produktion, nur lesend, 19.10.2026): 12 Anliegen offen, alle ohne Antwort, das älteste vom 22.09.;
// erledigte Anliegen bekamen ihre Antwort im Schnitt nach 85 Stunden. Unter den offenen: zwei Kündigungen, zwei
// Beschwerden — und mehrere einfache Fragen (Karte, Link der Partnerbank, „Haben Sie mich vergessen?“).
//
// Hier stehen NUR die Regeln — rein, ohne Datenbank, ohne Netz (Prüfstand scripts/pruef-mara-anliegen.ts). Der
// Server handelt in server/lib/fiaon-mara-anliegen.ts mit derselben Maschine wie der Mail-Postmeister (Agent,
// Werkzeuge, Antwortprüfung, Wortwand, E-393-Sperre, genannte Termine, zahlung_suchen, angaben_aendern), Kanal
// „anliegen“.
//
// DIE GRENZEN (Justin, Hausregeln):
//   · Heikles beantwortet Mara NICHT: Kündigung, Widerruf, Beschwerde, Anwalt/Gericht, Erstattung, Bestreiten,
//     Löschwunsch — dazu Werbewiderspruch (dieselbe Heikel-Regel wie der Auftrags-Katalog, heikelArt) und „Post mit
//     Frist“ (das Dringend-Kästchen: Gericht, Gerichtsvollzieher, Inkasso). Das bleibt beim Menschen wie heute;
//     auf /agent/anliegen steht dazu ein kurzer Hinweis.
//   · FIAON Global: nie. Testpersonen: nie. Ohne Akte: nie (ein Mensch ordnet zu).
//   · Schalter in den Mara-Einstellungen (Standard AN), KI-Pause und Kostendeckel: Anliegen warten und werden
//     danach nachgeholt — sie bleiben einfach offen.
//   · Antworten nur 08:00–20:00 Uhr Berlin (die Antwort löst eine Benachrichtigung aus).
//   · Höchstens ANLIEGEN_JE_PERSON_TAG Antworten je Mensch und Tag — kein Hin und Her ohne Ende.
// ═══════════════════════════════════════════════════════════════════════════
import { heikelArt } from "./fiaon-auftrag-arten";
import { istLoeschwunsch, abstreitenArt } from "./fiaon-mara-ton";
import { imVersandfenster } from "./fiaon-nicht-erreicht-nachfass";
import { wandPruefen, kuendigungSendeUrteil } from "./fiaon-wortverbote";

/** fiaon_settings — fehlt der Eintrag, ist Mara AN (Standard). „aus“ schaltet ab. */
export const ANLIEGEN_SCHALTER = "mara_anliegen";
/** Der KI-Dienst (fiaon_ki_nutzung.dienst) — eigener Name, eigener Deckel, eigene Zahl in Maras Bilanz. */
export const ANLIEGEN_DIENST = "mara-anliegen";
/** Kostendeckel am Tag in Euro (wie beim Postmeister: POSTMEISTER_TAG_EURO) — überschreibbar mit ANLIEGEN_TAG_EURO. */
export const ANLIEGEN_TAG_EURO_VORGABE = 10;
/** Älter als so viele Tage beantwortet Mara nicht mehr selbst — das bleibt beim Team. */
export const ANLIEGEN_MAX_TAGE = 14;
/** So viele Anliegen je Takt (5 Minuten) — bewusst wenig. */
export const ANLIEGEN_JE_TAKT = 4;
/** So viele Mara-Antworten je Mensch und Tag. */
export const ANLIEGEN_JE_PERSON_TAG = 3;
/** So viele Anläufe je Anliegen (Modell nicht erreichbar, Werkzeugrunden) — danach bleibt es beim Menschen. */
export const ANLIEGEN_VERSUCHE = 3;

/** Alter eines Anliegens in ganzen Tagen. Rein. */
export function anliegenAlterTage(am: Date, jetzt: Date): number {
  return Math.max(0, Math.floor((jetzt.getTime() - am.getTime()) / 86_400_000));
}
/** Zu alt für Mara? (älter als ANLIEGEN_MAX_TAGE) — die EINE Grenze für Urteil und Bündel. Rein. */
export function anliegenZuAlt(alterTage: number): boolean {
  return alterTage > ANLIEGEN_MAX_TAGE;
}

/**
 * Das Bündel (E-406 Nachbesserung, Prüfer 19.10.): Mara antwortet unter dem jüngsten Anliegen nur für die offenen
 * Anliegen, die NICHT zu alt sind. Ältere bleiben beim Menschen und bekommen keinen Verweis „mit beantwortet“ —
 * vorher verschwand so ein 27 Tage altes Anliegen aus Zähler und Liste des Teams, obwohl die Regel sagt: älter als
 * 14 Tage → Mensch. Sind alle zu alt, bleibt nur das jüngste im Bündel (das Urteil sagt dann „zu alt“).
 * `offen` aufsteigend nach Zeit. Rein.
 */
export function anliegenBuendelTeilen<T extends { created_at: Date | string }>(offen: readonly T[], jetzt: Date): { buendel: T[]; zuAlt: T[] } {
  const alt = (b: T) => anliegenZuAlt(anliegenAlterTage(new Date(b.created_at), jetzt));
  const jung = offen.filter((b) => !alt(b));
  const buendel = jung.length ? jung : offen.slice(-1);
  return { buendel, zuAlt: offen.filter((b) => !buendel.includes(b)) };
}

/** Ist der Schalter an? Leer oder fehlend = an (Standard AN). Rein. */
export function anliegenSchalterAn(wert: unknown): boolean {
  const w = String(wert ?? "").trim().toLowerCase();
  return !/^(aus|0|nein|false|off)$/.test(w);
}

// ── HEIKEL ──────────────────────────────────────────────────────────────────
export type AnliegenHeikel =
  | "kuendigung" | "widerruf" | "beschwerde" | "recht" | "erstattung" | "bestreitet" | "loeschen" | "werbewiderspruch" | "frist";

/** Kurz, für die Liste auf /agent/anliegen und die Akte. */
export const HEIKEL_NAME: Record<AnliegenHeikel, string> = {
  kuendigung: "Kündigung",
  widerruf: "Widerruf",
  beschwerde: "Beschwerde",
  recht: "Anwalt oder Gericht",
  erstattung: "Erstattung",
  bestreitet: "bestreitet",
  loeschen: "Löschwunsch",
  werbewiderspruch: "will keine Werbung",
  frist: "Post mit Frist",
};

const WIDERRUF = /widerruf/i;
/**
 * Erstattung — Wörter, die heikelArt NICHT kennt, gelten deshalb auch OHNE den Beschwerde-Zweig (E-406 Nachbesserung,
 * Prüfer 19.10.: „Rückzahlung“, „überweisen Sie mir … zurück“, „refund“ liefen vorher als harmlos durch — die Regel
 * stand nur im Zweig für „beschwerde“, den diese Wörter nie öffnen; die Einordnung hat keine Lampe für Erstattung).
 */
const ERSTATTUNG = /(erstatt|r(?:ü|ue)ckzahlung|zur(?:ü|ue)ck(?:ge)?zahl|zur(?:ü|ue)ck(?:ge)?(?:ü|ue)berw|r(?:ü|ue)ck(?:ü|ue)berw|geld\s+(?:\S+\s+){0,3}?zur(?:ü|ue)ck\b|\brefund|\breimburs|\bmoney\s+back\b|\bpay\s+(?:me|us)\s+back\b|\bcharge-?\s?back)/i;
/**
 * Erstattung mit getrenntem Verb („Bitte überweisen Sie mir die 49 € zurück“, „Zahlen Sie mir den Betrag bitte
 * zurück“) oder ein Geldwort vor „zurück“ („die Gebühr zurück“). „zurück“ mit Wortgrenze: „zurückrufen“ zählt nicht.
 */
const ERSTATTUNG_GETRENNT = /\b(?:(?:ü|ue)berweis|zahl|erstatt|buch)\w*\s+(?:sie\s+)?(?:mir|uns)\s+(?:\S+\s+){0,6}?zur(?:ü|ue)ck\b|(?:€|\beur\b|\beuro\b|\bbetrag\b|\bgeb(?:ü|ue)hr\w*|\bbeitrag\b|\bsumme\b)\s*(?:\S+\s+){0,3}?zur(?:ü|ue)ck\b/i;
const istErstattung = (s: string) => ERSTATTUNG.test(s) || ERSTATTUNG_GETRENNT.test(s);
const LOESCHEN = /(l(?:ö|oe)sch|dsgvo|datenschutz)/i;
const RECHT = /(anwalt|anwält|klage|\bgericht|polizei|strafanzeige|verbraucherzentrale|mahnbescheid|abmahn|schlichtung|bafin|rechtlich)/i;
const BESTREITET = /(bestreit|betrug|betrüg|abzock|\bfake\b|widerspruch|widersprech)/i;
/**
 * Was heikelArt nicht sieht: Gerichte als Wortteil („Amtsgericht“, „Landgericht“ — dort fehlt die Wortgrenze vor
 * „gericht“), Gerichtsvollzieher, Aktenzeichen, Staatsanwaltschaft (steckt schon in „anwalt“), Vollstreckung — und
 * Inkasso („Ich habe einen Brief vom Inkasso bekommen“: Post mit Frist, auch ohne das Dringend-Kästchen, das der
 * alte Bereich /mein-bereich nicht hat).
 */
const GERICHT_TEIL = /(gericht\w*|gerichtsvollzieh\w*|aktenzeichen|vollstreckung\w*|staatsanwalt\w*|inkasso\w*)/i;
/**
 * Englisch (E-248: Mara antwortet in der Sprache des Kunden) — heikelArt und istLoeschwunsch kennen nur Deutsch.
 * Die Lampen der Einordnung sehen Kündigung, Beschwerde und Anwalt auch auf Englisch, Löschwunsch und Erstattung
 * NICHT (es gibt keine Lampe dafür) — darum hier am Text, für alle Arten. Lieber ein Mensch zu viel.
 */
const ENGLISCH_HEIKEL: readonly [RegExp, AnliegenHeikel, string][] = [
  [/\bright\s+of\s+withdrawal\b|\bwithdraw\w*\s+from\s+(?:\S+\s+){0,2}?(?:contract|agreement|purchase|order)\b/i, "widerruf", "Widerruf — ein Mensch antwortet."],
  [/\b(?:cancel\w*|terminat\w*)\s+(?:\S+\s+){0,3}?(?:contract|subscription|membership|package|plan|agreement)\b|\bcancell?ation\b/i, "kuendigung", "Kündigung oder Storno — ein Mensch antwortet."],
  [/\b(?:delete|erase)\b|\bremove\s+(?:\S+\s+){0,2}?(?:data|account|details|information|profile)\b|\b(?:data|account|details)\s+(?:\S+\s+){0,3}?(?:deleted|erased|removed)\b|\bgdpr\b|\bright\s+to\s+(?:be\s+forgotten|erasure)\b/i, "loeschen", "Löschwunsch — ein Mensch antwortet."],
  [/\b(?:lawyer|solicitor|attorney|court|bailiff|debt\s+collect\w*|collection\s+agency|legal\s+action|police|ombudsman)\b|\bsue\b/i, "recht", "Anwalt, Gericht, Inkasso oder Behörde — ein Mensch antwortet."],
  [/\b(?:complain\w*|fraud\w*|scam\w*|rip-?off)\b/i, "beschwerde", "Beschwerde — ein Mensch antwortet."],
];
/**
 * Kontakt-Widerspruch, den heikelArt nicht sieht, weil das Verb getrennt steht: „Rufen Sie mich nicht mehr an“,
 * „Schreiben Sie mir nicht mehr“, „Lassen Sie mich in Ruhe“.
 */
const KONTAKT_STOPP = /\b(?:rufen|ruft|schreiben|schreibt|kontaktieren|melden)\s+sie\s+(?:mich|mir)\s+(?:bitte\s+)?(?:nie\s+wieder|nicht\s+mehr)\b|\blassen\s+sie\s+mich\s+(?:bitte\s+|endlich\s+)*in\s+ruhe\b/i;

/**
 * Ist das Anliegen heikel — schon am TEXT, vor jeder KI? Rein. null = nichts Heikles gefunden (die Einordnung
 * kann es danach noch finden: heikelAusEinordnung).
 */
export function anliegenHeikel(a: { betreff?: string | null; text?: string | null; dringend?: boolean | null }): { art: AnliegenHeikel; grund: string } | null {
  const betreff = String(a.betreff ?? "");
  const text = String(a.text ?? "");
  const alles = `${betreff}\n${text}`;
  // Das Dringend-Kästchen (Post mit Frist: Gericht, Gerichtsvollzieher, Inkasso) — der Server schreibt „DRINGEND:“ vor den Betreff.
  if (a.dringend || /^\s*DRINGEND:/.test(betreff)) return { art: "frist", grund: "Als dringend markiert (Post mit Frist) — ein Mensch antwortet." };
  const h = heikelArt(alles);
  if (h === "kuendigung") {
    return WIDERRUF.test(alles)
      ? { art: "widerruf", grund: "Widerruf — ein Mensch antwortet." }
      : { art: "kuendigung", grund: "Kündigung oder Storno — ein Mensch antwortet." };
  }
  if (istLoeschwunsch(text) || istLoeschwunsch(betreff)) return { art: "loeschen", grund: "Löschwunsch — ein Mensch antwortet." };
  if (h === "beschwerde") {
    if (istErstattung(alles)) return { art: "erstattung", grund: "Erstattung oder Geld zurück — ein Mensch entscheidet." };
    if (LOESCHEN.test(alles)) return { art: "loeschen", grund: "Löschwunsch oder Datenschutz — ein Mensch antwortet." };
    if (RECHT.test(alles)) return { art: "recht", grund: "Anwalt, Gericht oder Behörde — ein Mensch antwortet." };
    if (BESTREITET.test(alles)) return { art: "bestreitet", grund: "Bestreitet eine Forderung — ein Mensch antwortet." };
    if (/beschwer/i.test(alles)) return { art: "beschwerde", grund: "Beschwerde — ein Mensch antwortet." };
    return { art: "werbewiderspruch", grund: "Will keine Werbung oder keinen Kontakt mehr — ein Mensch antwortet." };
  }
  // Ab hier: was heikelArt nicht sieht (E-406 Nachbesserung) — Erstattung, Gericht/Inkasso als Wortteil, Englisch.
  if (istErstattung(alles)) return { art: "erstattung", grund: "Erstattung oder Geld zurück — ein Mensch entscheidet." };
  if (GERICHT_TEIL.test(alles)) return { art: "recht", grund: "Gericht, Inkasso oder Behörde — ein Mensch antwortet." };
  for (const [muster, art, grund] of ENGLISCH_HEIKEL) if (muster.test(alles)) return { art, grund };
  if (KONTAKT_STOPP.test(alles)) return { art: "werbewiderspruch", grund: "Will keine Werbung oder keinen Kontakt mehr — ein Mensch antwortet." };
  const ab = abstreitenArt(text);
  if (ab?.art === "bestreitet") return { art: "bestreitet", grund: "Bestreitet eine Forderung — ein Mensch antwortet." };
  return null;
}

/**
 * Heikel nach der Einordnung (KI + Riegel im Agenten): dieselben Lampen, die beim Postmeister einen Menschen
 * brauchten, dazu Beschwerde und „Stopp“. Rein.
 */
export function heikelAusEinordnung(e: { kategorien?: readonly string[] | null; flags?: object | null }): { art: AnliegenHeikel; grund: string } | null {
  const f = (e.flags ?? {}) as Record<string, unknown>;
  const k = new Set((e.kategorien ?? []).map(String));
  if (f.widerruf) return { art: "widerruf", grund: "Widerruf — ein Mensch antwortet." };
  if (f.kuendigung || k.has("kuendigung")) return { art: "kuendigung", grund: "Kündigung oder Storno — ein Mensch antwortet." };
  if (f.droht_anwalt || f.rechtlich || k.has("rechtlich")) return { art: "recht", grund: "Anwalt, Gericht oder Behörde — ein Mensch antwortet." };
  if (f.bestreitet) return { art: "bestreitet", grund: "Bestreitet eine Forderung — ein Mensch antwortet." };
  if (f.beschwerde || k.has("beschwerde")) return { art: "beschwerde", grund: "Beschwerde — ein Mensch antwortet." };
  if (f.stopp || k.has("abmeldung")) return { art: "werbewiderspruch", grund: "Will keine Werbung oder keinen Kontakt mehr — ein Mensch antwortet." };
  return null;
}

// ── DIE VORPRÜFUNG JE ANLIEGEN ─────────────────────────────────────────────
export interface AnliegenFakten {
  schalterAn: boolean;
  kiPause: boolean;
  /** Ist der Kostendeckel des Tages erreicht? */
  deckelErreicht: boolean;
  jetzt: Date;
  /** Hat das Anliegen eine Person (Akte)? */
  mitPerson: boolean;
  global: boolean;
  test: boolean;
  /** Alter des Anliegens in Tagen (das jüngste des Bündels). */
  alterTage: number;
  /** Mara-Antworten an diesen Menschen heute. */
  heuteBeantwortet: number;
  heikel: { art: AnliegenHeikel; grund: string } | null;
}

/**
 * warten  — nichts tun, das Anliegen bleibt offen und kommt im nächsten Takt wieder (Schalter, KI-Pause, Deckel,
 *           Nacht, Tagesgrenze je Mensch).
 * nie     — Mara fasst es nie an (Global, Testperson). Der Server schreibt nichts.
 * mensch  — Mara antwortet nicht; ein Hinweis steht beim Anliegen (heikel, zu alt, ohne Akte).
 * mara    — Mara antwortet (Einordnung, Agent, Prüfung).
 */
export type AnliegenUrteil =
  | { art: "warten"; grund: string }
  | { art: "nie"; grund: string }
  | { art: "mensch"; grund: string; heikel: AnliegenHeikel | null }
  | { art: "mara" };

/** Die Reihenfolge ist Absicht: erst die Bremsen (nichts anfassen), dann die Wände, dann heikel. Rein. */
export function anliegenUrteil(f: AnliegenFakten): AnliegenUrteil {
  if (!f.schalterAn) return { art: "warten", grund: "Schalter aus" };
  if (f.kiPause) return { art: "warten", grund: "KI pausiert — wird danach nachgeholt" };
  if (f.deckelErreicht) return { art: "warten", grund: "Kostendeckel des Tages erreicht — morgen weiter" };
  if (!imVersandfenster(f.jetzt)) return { art: "warten", grund: "außerhalb 08:00–20:00 — ab 8 Uhr" };
  if (f.global) return { art: "nie", grund: "Kunde von FIAON Global — Mara antwortet nie" };
  if (f.test) return { art: "nie", grund: "Testperson — Mara antwortet nie" };
  if (!f.mitPerson) return { art: "mensch", grund: "Ohne Akte — ein Mensch ordnet zu und antwortet.", heikel: null };
  if (f.heikel) return { art: "mensch", grund: f.heikel.grund, heikel: f.heikel.art };
  if (anliegenZuAlt(f.alterTage)) return { art: "mensch", grund: `Älter als ${ANLIEGEN_MAX_TAGE} Tage — ein Mensch antwortet.`, heikel: null };
  if (f.heuteBeantwortet >= ANLIEGEN_JE_PERSON_TAG) return { art: "warten", grund: `heute schon ${ANLIEGEN_JE_PERSON_TAG} Antworten an diesen Menschen — morgen weiter` };
  return { art: "mara" };
}

// ── NACH DEM AGENTEN: SENDEN ODER BEIM MENSCHEN LASSEN ─────────────────────
/**
 * Die Antwort erscheint nur im Kundenbereich, wenn ALLES stimmt: die Prüfung des Agenten erlaubt sie
 * (automatischErlaubt — Wortwand, Belege, Ton, Links, E-248/E-369), kein Mensch ist nötig (menschNoetig im Lauf:
 * Anwalt/Behörde, Widerruf, Global, ausdrücklicher Rückrufwunsch ohne Plan), die E-393-Sperre hält sie nicht und
 * die Einordnung fand nichts Heikles. Sonst bleibt Maras Text ein Vorschlag für den Menschen. Rein.
 */
export function anliegenSendeUrteil(e: {
  text: string | null | undefined;
  automatischErlaubt: boolean;
  mensch: string | null;
  e393Gesperrt: boolean;
  e393Grund?: string | null;
  heikel: { art: AnliegenHeikel; grund: string } | null;
  grund?: string | null;
}): { senden: true } | { senden: false; grund: string } {
  if (!String(e.text ?? "").trim()) return { senden: false, grund: e.grund || "keine Antwort erzeugt" };
  if (e.heikel) return { senden: false, grund: e.heikel.grund };
  if (e.e393Gesperrt) return { senden: false, grund: e.e393Grund || "E-393: Kündigung an eine Zahlung geknüpft oder Drohung — gesperrt" };
  if (e.mensch) return { senden: false, grund: `Braucht einen Menschen: ${e.mensch}` };
  if (!e.automatischErlaubt) return { senden: false, grund: e.grund || "Prüfung nicht sauber" };
  return { senden: true };
}

// ── WENN EIN MENSCH ANTWORTET (POST /agent/tickets/:id/antwort) ────────────
const saetzeVon = (t: string) => String(t ?? "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 12);
const glatt = (t: string) => String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Die Prüfung einer Antwort, die ein MITARBEITER im Anliegen speichert (E-406 Nachbesserung, Prüfer 19.10.): Vorher
 * speicherte die Route jeden Text ungeprüft — auch Maras gesperrten Vorschlag nach einem Klick auf „Vorschlag
 * übernehmen“ (E-393-Kopplung, Wortwand). Jetzt gilt dasselbe wie in der Zentrale und bei der Freitext-Mail:
 *   · E-393 (kuendigungSendeUrteil) — immer, „gleich, wer den Text geschrieben hat“.
 *   · Wortwand, harte Verbote („garantiere“, gesperrte Bankverbindung …) — immer.
 *   · Zusagen („… ist geändert“, „ruft Sie an“) — nur für Sätze, die aus Maras Vorschlag stammen, gedeckt durch die
 *     Werkzeuge, die in ihrem Lauf wirklich liefen. Was der Mitarbeiter selbst zusagt, tut er selbst.
 *   · Floskeln nie.
 * Rein. `grund` sagt dem Mitarbeiter in einem Satz, was er umschreiben soll.
 */
export function anliegenHandPruefung(e: {
  antwort: string;
  eingang?: string | null;
  betreff?: string | null;
  flags?: Record<string, unknown> | null;
  kategorien?: readonly string[] | null;
  kuendigungInAkte?: boolean;
  maraEntwurf?: string | null;
  maraWerkzeuge?: readonly string[] | null;
}): { ok: true } | { ok: false; grund: string } {
  const antwort = String(e.antwort ?? "");
  const e393 = kuendigungSendeUrteil({
    antwort, eingang: e.eingang ?? null, betreff: e.betreff ?? null, flags: e.flags ?? null,
    kategorien: e.kategorien ?? null, kuendigungInAkte: !!e.kuendigungInAkte,
  });
  if (e393.gesperrt) {
    return { ok: false, grund: `${e393.grund} — bitte umschreiben: Die Kündigung gilt unabhängig von der Zahlung; offene Raten bis zum Vertragsende nur sachlich nennen, ohne Drohung.` };
  }
  const verboten = wandPruefen(antwort).filter((t) => t.art === "verboten");
  if (verboten.length) {
    return { ok: false, grund: `Bitte umschreiben — ${verboten.map((t) => `„${t.treffer}“: ${t.hinweis}`).join(" · ")}` };
  }
  const entwurf = glatt(e.maraEntwurf ?? "");
  if (entwurf) {
    const vonMara = saetzeVon(antwort).filter((s) => entwurf.includes(glatt(s)));
    const zusagen = vonMara.length ? wandPruefen(vonMara.join("\n"), [...(e.maraWerkzeuge ?? [])]).filter((t) => t.art === "zusage") : [];
    if (zusagen.length) {
      return { ok: false, grund: `Aus Maras Vorschlag, aber nicht erledigt — ${zusagen.map((t) => `„${t.treffer}“: ${t.hinweis}`).join(" · ")} Bitte erst erledigen oder den Satz streichen.` };
    }
  }
  return { ok: true };
}

// ── DER KNOPF UNTER DER ANTWORT ─────────────────────────────────────────────
/**
 * Nur ein persönlicher Link von fiaon.com (Zahlungsseite, Terminlink, Bereich) oder ein Pfad im Haus — nie eine
 * fremde Adresse im Kundenbereich. Rein.
 */
export function anliegenKnopfErlaubt(url: unknown): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  if (u.startsWith("/") && !u.startsWith("//")) return true;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && (x.hostname === "fiaon.com" || x.hostname.endsWith(".fiaon.com") || x.hostname === "fiaon-plattform.onrender.com");
  } catch { return false; }
}

// ── WAS DIE LISTE AUF /agent/anliegen ZEIGT ────────────────────────────────
// In einer eigenen, schlanken Datei (shared/fiaon-mara-anliegen-satz.ts) — die Seite lädt sonst Maras ganze Regeln mit.
export { maraStandSatz, type MaraStand } from "./fiaon-mara-anliegen-satz";
