// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP-RAUM — Typen und Klartext (28.09.2026, E-248)
//
// Alles, was der Raum an Wörtern und Zeiten braucht, an EINER Stelle:
// Tagesstreifen („Heute", „Gestern", „Samstag, 26. September"), Zeit in der
// Liste, wer geschrieben hat, und Maras interne Schritte in Klartext statt
// „freie_zeiten oder rueckruf_eintragen".
//
// Zeiten immer in Berlin — und nie über Number(Intl.format()): das liefert
// NaN (Gedächtnis „Zeit-Falle Berlin-Stunde"). Deshalb formatToParts.
//
// 20.10.2026 (Neubau wie WhatsApp): dazu Initialen und Farbe der runden
// Bilder, Häkchen und Medien in der Vorschau, Reaktionen an der Blase, der
// Streifen „2 ungelesene Nachrichten". Alle neuen Felder sind optional — eine
// ältere Server-Antwort während eines Deploys bricht nichts.
// ═══════════════════════════════════════════════════════════════════════════

export type Absender = "kunde" | "mara" | "mensch";

export type MedienArt = "bild" | "sticker" | "audio" | "video" | "dokument" | "standort" | "kontakt" | "reaktion";

/** Was eine Nachricht an Datei, Ort, Kontakt oder Reaktion trug (server/lib/fiaon-wa-medien.ts, medienAnzeige). */
export interface MedienAnzeige {
  art: MedienArt; mime: string | null; name: string | null; titel: string | null;
  /** Die Datei liegt bei Meta und lässt sich über …/medien/<id> holen. */
  datei: boolean;
  sprache: boolean; lat: number | null; lng: number | null; ort: string | null;
  kontakte: { name: string; nummer: string | null }[] | null; emoji: string | null; auf: string | null;
}

/** Eine Vorlage, wie der Kunde sie sah — Kopf, Kopfbild, Fuß, Knöpfe (unverändert aus dem Register). */
export interface VorlageAnzeige {
  kopf: string | null; bild: string | null; fuss: string | null;
  knoepfe: { art: "link" | "antwort"; text: string }[];
}

export interface Gespraech {
  nummer: string; name: string | null; personId: number | null; leadId: number | null;
  stufe: string | null; betreuer: string | null;
  letzte: {
    text: string; richtung: string; am: string; status: string;
    von?: string | null; absender?: Absender; vorlage?: string | null; vorlageName?: string | null; typ?: string | null; auto?: boolean;
    /** 20.10.2026: Häkchen und Medien in der Vorschau. */
    zugestellt?: boolean; gelesen?: boolean;
    medien?: { art: string; titel: string | null; sprache?: boolean } | null;
  };
  ungelesen: number; maraAn: boolean; fensterBis: string | null;
  /** 20.10.2026: „schalter" (bewusst aus) oder „mensch" (pausiert, weil jemand schreibt). */
  maraAusGrund?: string | null;
  bearbeiter: { id: number; seit: string; name?: string | null } | null; notiz: string | null;
}

export interface Nachricht {
  id: number; richtung: string; text: string | null; vorlage: string | null; knopf: string | null;
  status: string; fehler: string | null; von: string | null; typ?: string | null;
  empfangen_am: string | null; gesendet_am: string | null; zugestellt_am: string | null; gelesen_am: string | null; created_at: string;
  /** Metas Kennung — Reaktionen zeigen darauf. */
  wa_id?: string | null;
  /** E-248, vom Server: wer schrieb, Autoantwort, Klartext der Vorlage. Ältere Antworten ohne die Felder brechen nichts. */
  absender?: Absender; auto?: boolean; vorlageName?: string | null; vorlageText?: string | null;
  /** 20.10.2026, vom Server: die Vorlage wie beim Kunden und die Medien der Nachricht. */
  vorlageAnzeige?: VorlageAnzeige | null; medien?: MedienAnzeige | null;
}

export interface Vorlage { name: string; status: string; text?: string; zweck?: string; klartext?: string | null; beispiele?: string[] }

export interface MaraEreignis {
  id: number; am: string;
  art: "zeiten_angeboten" | "termin_gebucht" | "termin_verschoben" | "termin_nicht_moeglich" | "terminlink" | "uebergabe" | "rueckfall" | string;
  ok: boolean; text: string; terminId: number | null;
  /** null = (noch) nicht geprüft; der Prüftakt prüft nur eingetragene Termine. */
  pruefungOk: boolean | null; pruefung: string | null;
}

export interface RaumLinks {
  antrag: string | null; zahlung: string | null; termin: string | null; bereich: string | null;
  empfohlen?: "antrag" | "zahlung" | "termin" | "bereich" | null;
  /** Seine Stufe (shared/fiaon-mara-ton.ts, LinkStufe) — der Server liefert sie mit. */
  stufe?: "lead" | "antrag_offen" | "zahlung_offen" | "zahlung_gemeldet" | "kunde" | "beendet" | string | null;
  terminHinweis?: string | null;
}

export interface ChatDaten {
  verlauf: Nachricht[]; lage: any; links: RaumLinks | null; fensterOffen: boolean; maraAn: boolean; maraAusGrund?: string | null;
  notiz: string | null; bearbeiter: number | null; ich: number | null;
  /** 20.10.2026: seit wann und wer — „Florentine liest mit" nur, solange es stimmt. */
  bearbeiterSeit?: string | null; bearbeiterName?: string | null;
  vorlagen: Vorlage[]; ergebnisse: { wert: string; text: string }[];
  ereignisse: MaraEreignis[];
}

// ── Das runde Bild: Initialen und eine Farbe aus dem Blau-Paar ──────────────
/** „Lena Sommer" → „LS", „Mara" → „M", nur Nummer → "" (dann zeigt das Bild eine Silhouette). */
export function initialen(name: string | null | undefined): string {
  // Nur Wörter, die mit einem Buchstaben beginnen (Groß ≠ klein — gilt für alle Alphabete mit Großbuchstaben).
  const istBuchstabe = (z: string) => z.toUpperCase() !== z.toLowerCase();
  const teile = String(name ?? "").trim().split(/\s+/).filter((t) => t && istBuchstabe(t.charAt(0)));
  if (!teile.length) return "";
  const a = teile[0].charAt(0);
  const b = teile.length > 1 ? teile[teile.length - 1].charAt(0) : "";
  return `${a}${b}`.toUpperCase();
}

/** Fünf Töne aus dem Blau-Paar (kein Gold, kein Grün) — derselbe Mensch hat immer dieselbe Farbe. */
export const AVATAR_TOENE = 5;
export function avatarTon(schluessel: string | null | undefined): number {
  const s = String(schluessel ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % AVATAR_TOENE;
}

/** Medien in Worten, wie WhatsApp sie in Liste und Blase nennt. */
export function medienText(art: string | null | undefined, sprache = false): string | null {
  switch (String(art ?? "")) {
    case "bild": return "Foto";
    case "sticker": return "Sticker";
    case "audio": return sprache ? "Sprachnachricht" : "Audio";
    case "video": return "Video";
    case "dokument": return "Dokument";
    case "standort": return "Standort";
    case "kontakt": return "Kontakt";
    case "reaktion": return "Reaktion";
    default: return null;
  }
}

/** Die Art aus dem WhatsApp-Typ der Zeile (für Nachrichten ohne gemerkte Medien). */
export function artAusTyp(typ: string | null | undefined): MedienArt | null {
  switch (String(typ ?? "")) {
    case "image": return "bild";
    case "sticker": return "sticker";
    case "audio": case "voice": return "audio";
    case "video": return "video";
    case "document": return "dokument";
    case "location": return "standort";
    case "contacts": return "kontakt";
    case "reaction": return "reaktion";
    default: return null;
  }
}

/** Häkchen-Stufe einer eigenen Nachricht: gesendet ✓, zugestellt ✓✓, gelesen ✓✓ (hell), Fehler. */
export type HakenStufe = "gesendet" | "zugestellt" | "gelesen" | "fehler";
export function hakenStufe(n: { status?: string | null; zugestellt_am?: string | null; gelesen_am?: string | null; zugestellt?: boolean; gelesen?: boolean }): HakenStufe {
  if (n.status === "fehler" || n.status === "failed") return "fehler";
  if (n.gelesen_am || n.gelesen || n.status === "read") return "gelesen";
  if (n.zugestellt_am || n.zugestellt || n.status === "delivered") return "zugestellt";
  return "gesendet";
}

// ── Zeit ────────────────────────────────────────────────────────────────────
const BERLIN = "Europe/Berlin";
const teileFmt = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function teile(d: Date): { j: number; m: number; t: number; h: string; min: string } | null {
  if (!Number.isFinite(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of teileFmt.formatToParts(d)) p[x.type] = x.value;
  return { j: Number.parseInt(p.year, 10), m: Number.parseInt(p.month, 10), t: Number.parseInt(p.day, 10), h: p.hour, min: p.minute };
}

/** Tagesnummer in Berlin (Tage seit 1970) — für Heute/Gestern ohne Zeitzonen-Rechnerei. */
function berlinTag(d: Date): number | null {
  const p = teile(d);
  return p ? Math.round(Date.UTC(p.j, p.m - 1, p.t) / 86_400_000) : null;
}

export const zuDatum = (s: string | null | undefined) => (s ? new Date(s) : new Date(Number.NaN));

/** „10:23" in Berlin. */
export function uhr(s: string | null | undefined): string {
  const p = teile(zuDatum(s));
  return p ? `${p.h}:${p.min}` : "";
}

/** Schlüssel für „gleicher Tag?" */
export function tagSchluessel(s: string | null | undefined): string {
  const t = berlinTag(zuDatum(s));
  return t == null ? "" : String(t);
}

const WOCHENTAG = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, weekday: "long" });
const TAG_MONAT = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, day: "numeric", month: "long" });
const TAG_MONAT_JAHR = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, day: "numeric", month: "long", year: "numeric" });

/** Tagesstreifen: „Heute", „Gestern", „Samstag, 26. September" (anderes Jahr mit Jahr). */
export function tagStreifen(s: string | null | undefined, jetzt: Date = new Date()): string {
  const d = zuDatum(s);
  const t = berlinTag(d); const h = berlinTag(jetzt);
  if (t == null || h == null) return "";
  if (t === h) return "Heute";
  if (t === h - 1) return "Gestern";
  const gleichesJahr = teile(d)?.j === teile(jetzt)?.j;
  return `${WOCHENTAG.format(d)}, ${(gleichesJahr ? TAG_MONAT : TAG_MONAT_JAHR).format(d)}`;
}

/** Zeit in der Liste: „10:23", „Gestern", „Samstag" (letzte Woche), sonst „21.09." */
export function listenZeit(s: string | null | undefined, jetzt: Date = new Date()): string {
  const d = zuDatum(s);
  const t = berlinTag(d); const h = berlinTag(jetzt);
  if (t == null || h == null) return "";
  if (t === h) return uhr(s);
  if (t === h - 1) return "Gestern";
  if (h - t < 7 && t < h) return WOCHENTAG.format(d);
  const p = teile(d)!; const q = teile(jetzt);
  return `${String(p.t).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.j !== q?.j ? String(p.j).slice(2) : ""}`;
}

/** „heute 20:00", „morgen 10:20", „Mi. 30.09. 19:40" — für den Termin-Chip. */
export function terminText(s: string | null | undefined, jetzt: Date = new Date()): string {
  const d = zuDatum(s);
  const t = berlinTag(d); const h = berlinTag(jetzt);
  if (t == null || h == null) return "";
  const u = uhr(s);
  if (t === h) return `heute ${u}`;
  if (t === h + 1) return `morgen ${u}`;
  const p = teile(d)!;
  const wt = new Intl.DateTimeFormat("de-DE", { timeZone: BERLIN, weekday: "short" }).format(d);
  return `${wt} ${String(p.t).padStart(2, "0")}.${String(p.m).padStart(2, "0")}. ${u}`;
}

/** „21.09.26" — für Tabellenwerte in der Fall-Spalte. */
export function datumKurz(s: string | null | undefined): string {
  const p = teile(zuDatum(s));
  return p ? `${String(p.t).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${String(p.j).slice(2)}` : "";
}

export function restZeit(bis: string | null | undefined, jetzt = Date.now()): string | null {
  if (!bis) return null;
  const ms = new Date(bis).getTime() - jetzt;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `noch ${h} h ${m} min` : `noch ${m} min`;
}

export const wann = (n: Nachricht) => n.empfangen_am ?? n.gesendet_am ?? n.created_at;

// ── Wer schreibt ────────────────────────────────────────────────────────────
export function absenderVon(n: { richtung: string; von?: string | null; absender?: Absender }): Absender {
  if (n.absender) return n.absender;
  if (n.richtung !== "raus") return "kunde";
  const v = String(n.von ?? "").trim();
  return !v || /^mara\b/i.test(v) ? "mara" : "mensch";
}

/** „Florentine Lombardi" → „Florentine"; „Leitung" bleibt „Leitung". */
export function vorname(von: string | null | undefined): string {
  const v = String(von ?? "").trim();
  return v ? v.split(/\s+/)[0] : "Team";
}

/**
 * Vorschau in der Liste: „Mara: …", „Florentine: …", „Automatische Antwort · …".
 * 20.10.2026: Medien wie bei WhatsApp — Zeichen + „Foto" bzw. die Bildunterschrift; Vorlage mit Klartextnamen.
 */
export function listenVorschau(g: Gespraech): { wer: string | null; text: string; medien: MedienArt | null; vorlage: boolean } {
  const l = g.letzte;
  const abs = absenderVon(l);
  const wer = abs === "mara" ? "Mara" : abs === "mensch" ? vorname(l.von) : l.auto ? "Automatische Antwort" : null;
  let text = l.text?.trim() || "";
  let medien: MedienArt | null = null;
  if (l.vorlage) {
    text = `Vorlage · ${l.vorlageName ?? vorlageNameRoh(l.vorlage)}`;
  } else {
    const art = (l.medien?.art as MedienArt | undefined) ?? artAusTyp(l.typ);
    if (art === "reaktion") text = "hat auf eine Nachricht reagiert";
    else if (art) { medien = art; text = l.medien?.titel?.trim() || text || medienText(art, !!l.medien?.sprache) || ""; }
    else if (!text) text = typText(l.typ) ?? "—";
  }
  return { wer, text: text.replace(/\s+/g, " "), medien, vorlage: !!l.vorlage };
}

export function vorlageNameRoh(name: string | null | undefined): string {
  const t = String(name ?? "").replace(/^fiaon_kkb?_/, "").replace(/^fiaon_/, "").replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Vorlage";
}

/** Was WhatsApp nicht als Text überträgt — in Worten. */
export function typText(typ: string | null | undefined): string | null {
  switch (String(typ ?? "")) {
    case "image": return "Bild";
    case "audio": case "voice": return "Sprachnachricht";
    case "video": return "Video";
    case "document": return "Dokument";
    case "sticker": return "Sticker";
    case "location": return "Standort";
    case "contacts": return "Kontakt";
    case "reaction": return "Reaktion";
    case "unsupported": return "Nachricht, die WhatsApp nicht überträgt";
    default: return null;
  }
}

// ── Stufe ───────────────────────────────────────────────────────────────────
/** EINE Palette für Liste und Fall (vorher: links A grün, rechts A rot). */
export function stufeKlasse(stufe: string | null | undefined): string {
  const s = String(stufe ?? "").toLowerCase();
  return s === "kunde" ? "kunde" : s === "a" ? "a" : s === "b" ? "b" : "c";
}
export function stufeText(stufe: string | null | undefined): string {
  const s = String(stufe ?? "");
  return s === "Kunde" ? "Kunde" : s ? `Stufe ${s}` : "";
}

/** Zahlstatus in Worten — dieselben Begriffe wie in der Akte. */
export const ZAHLTEXT: Record<string, string> = {
  paid: "bezahlt", claimed_paid: "Zahlung gemeldet", pending_payment: "Rechnung offen",
  expired: "Frist abgelaufen", pending: "Antrag offen", cancelled: "storniert", refunded: "erstattet",
};

/** „+49 151 0000059" — lesbar statt „491510000059". */
export function nummerLesbar(n: string | null | undefined): string {
  const z = String(n ?? "").replace(/\D/g, "");
  if (!z) return "";
  const cc = /^(49|43|41)/.exec(z)?.[1] ?? z.slice(0, 2);
  const rest = z.slice(cc.length);
  return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
}

// ── Maras interne Schritte in Klartext ──────────────────────────────────────
const WERKZEUGE: [RegExp, string][] = [
  [/\bfreie_zeiten\b/g, "„freie Zeiten“"],
  [/\brueckruf_eintragen\b/g, "„Rückruf eintragen“"],
  [/\bterminlink_schicken\b/g, "„Terminlink schicken“"],
  [/\bzahlungszusage_merken\b/g, "„Zahlungszusage merken“"],
  [/\bauskunft_anbieten\b/g, "„Auskunft anbieten“"],
];
export function ohneWerkzeugnamen(t: string): string {
  return WERKZEUGE.reduce((s, [r, w]) => s.replace(r, w), String(t ?? ""));
}

/** Der Grund in der ersten Klammer, ohne Anweisungen an Mara („nenne nur …", „sag nicht …"). */
function grundAus(text: string): string | null {
  const i = text.indexOf("(");
  if (i < 0) return null;
  let tiefe = 0; let ende = -1;
  for (let k = i; k < text.length; k++) {
    if (text[k] === "(") tiefe++;
    else if (text[k] === ")") { tiefe--; if (tiefe === 0) { ende = k; break; } }
  }
  let g = text.slice(i + 1, ende > i ? ende : undefined).trim();
  g = g.replace(/\s*\((nicht von dir gebucht|nicht anfassen)[^)]*\)/gi, "");
  // Anweisungen an Mara sind für Menschen Rauschen: ab dem Gedankenstrich weg.
  g = g.replace(/\s+—\s+(nenne|sag|trag|frag|bitte)\b.*$/i, "");
  g = g.replace(/^Du hast\s+/i, "").replace(/^Die Uhrzeit\s+/i, "Uhrzeit ");
  g = g.replace(/[.\s]+$/, "");
  return g ? ohneWerkzeugnamen(g) : null;
}

export type SchrittTon = "gut" | "warn" | "rot" | "leise" | "";

export interface SchrittKlartext { titel: string; ton: SchrittTon; roh: string }

/** Ein Ereignis → eine Zeile Klartext + Ton; der Rohtext bleibt klein darunter. */
export function schrittKlartext(e: MaraEreignis): SchrittKlartext {
  const roh = ohneWerkzeugnamen(e.text);
  const grund = grundAus(e.text);
  const vorDoppelpunkt = (t: string) => t.split(":")[0].trim();
  switch (e.art) {
    case "zeiten_angeboten":
      return { titel: vorDoppelpunkt(e.text).replace(/\.$/, "") || "Freie Zeiten geholt", ton: "leise", roh };
    case "termin_gebucht":
      return { titel: e.ok === false ? `Rückruf eingetragen, mit Abweichung${grund ? `: ${grund}` : ""}` : (vorDoppelpunkt(e.text) || "Rückruf eingetragen"), ton: e.ok === false ? "rot" : "gut", roh };
    case "termin_verschoben":
      return { titel: vorDoppelpunkt(e.text) || "Termin verschoben", ton: e.ok === false ? "rot" : "gut", roh };
    case "termin_nicht_moeglich":
      // Der Grund steht schon im Titel — der Rohtext wiederholte ihn nur.
      return { titel: `Rückruf nicht eingetragen${grund ? ` — ${grund}` : ""}`, ton: "warn", roh: grund ? "" : roh };
    case "terminlink":
      return { titel: e.text.replace(/\.$/, "") || "Persönlichen Terminlink geschickt", ton: "gut", roh };
    case "uebergabe":
      return { titel: vorDoppelpunkt(e.text) || "An das Team übergeben", ton: "", roh };
    case "rueckfall":
      return { titel: `Antwort verworfen${grund ? ` (${grund})` : ""} — Ersatzsatz geschickt`, ton: "rot", roh };
    // E-264 (29.09.2026): fester Satz ohne Modell — kein Link, kein Verkauf, Werbe-Stopp, Aufgabe an die Leitung.
    case "abstreiten":
      return { titel: "Bestreitet den Antrag — Entschuldigung und Herkunft, kein Link, Werbe-Stopp, Leitung informiert", ton: "warn", roh };
    case "loeschwunsch":
      return { titel: "Löschwunsch — bestätigt, Leitung löscht", ton: "warn", roh };
    // E-265 (29.09.2026): Mara hat eine klare Kündigung selbst gebucht (Urkunde, Bestätigungsmail).
    case "kuendigung":
      return { titel: vorDoppelpunkt(e.text) || "Kündigung per WhatsApp aufgenommen", ton: "warn", roh };
    default: {
      // Der erste Satz — ohne Lookbehind (Safari unter 16.4 kennt ihn nicht).
      const voll = ohneWerkzeugnamen(e.text);
      const t = voll.match(/^[\s\S]*?[.!?](?=\s)/)?.[0] ?? voll;
      return { titel: t || e.art, ton: e.ok === false ? "rot" : "", roh };
    }
  }
}

/**
 * „✗ außerhalb der Arbeitszeit · ✓ Termin steht" → einzelne Punkte mit Urteil.
 * Der Prüftakt schreibt die Probleme zuerst (server/lib/fiaon-mara-termin.ts).
 */
export function pruefTeile(text: string | null): { gut: boolean; text: string }[] {
  return (text ?? "").split(" · ").map((t) => t.trim()).filter(Boolean).map((t) => ({
    gut: !/^[✗✕✘]/.test(t),
    text: t.replace(/^[✓✔✗✕✘]\s*/, ""),
  }));
}

// ── Der Verlauf als Anzeige-Einträge ────────────────────────────────────────
export type Eintrag =
  | { art: "tag"; key: string; text: string }
  | { art: "nachricht"; key: string; n: Nachricht; absender: Absender; gruppeNeu: boolean; gruppeEnde: boolean; reaktionen: string[] }
  | { art: "schritte"; key: string; liste: MaraEreignis[] }
  /** 20.10.2026: „2 ungelesene Nachrichten" — wie bei WhatsApp beim Öffnen. */
  | { art: "ungelesen"; key: string; anzahl: number }
  /** 20.10.2026: leise Zeile in der Mitte (z. B. eine Reaktion auf eine ältere Nachricht). */
  | { art: "hinweis"; key: string; text: string };

const msVon = (s: string | null | undefined) => (s ? new Date(s).getTime() : Number.NaN);

/** Ist die Zeile eine Reaktion (👍 auf eine Nachricht) statt einer eigenen Nachricht? */
export function istReaktion(n: Nachricht): boolean {
  return n.medien?.art === "reaktion" || n.typ === "reaction";
}

/**
 * Nachrichten und Maras Handlungen nach Zeit mischen, Tagesstreifen setzen,
 * Handlungen zwischen zwei Nachrichten zu EINEM Bündel fassen und Blasen
 * desselben Absenders gruppieren (Name nur einmal, enger Abstand).
 * Die Reihenfolge der Nachrichten bleibt, wie der Server sie liefert; eine
 * Handlung steht vor der ersten Nachricht, die später kam (Gleichstand:
 * erst die Nachricht).
 *
 * 20.10.2026: Reaktionen hängen als kleines Zeichen an der Blase, auf die sie
 * zeigen (wie bei WhatsApp); fehlt diese im geladenen Verlauf, steht eine leise
 * Zeile da. `ungelesen` setzt den Streifen „N ungelesene Nachrichten" vor die
 * N-letzte Nachricht des Kunden.
 */
export function eintraegeBauen(verlauf: Nachricht[], ereignisse: MaraEreignis[], jetzt: Date = new Date(), opts: { ungelesen?: number } = {}): Eintrag[] {
  const spaet = (s: string) => { const t = msVon(s); return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY; };
  const ev = ereignisse
    .filter((e) => e && e.id != null && typeof e.text === "string")
    .slice()
    .sort((a, b) => (spaet(a.am) - spaet(b.am)) || Number(a.id) - Number(b.id));

  // Reaktionen an ihr Ziel hängen (wa_id), statt eine eigene Blase zu bauen.
  const nachWaId = new Map<string, Nachricht>();
  for (const n of verlauf) if (n.wa_id) nachWaId.set(String(n.wa_id), n);
  // Wie bei WhatsApp: eine Reaktion je Nachricht — die letzte gilt, eine leere nimmt sie zurück.
  const letzte = new Map<number, string | null>();
  const ohneZiel = new Set<number>();
  for (const n of verlauf) {
    if (!istReaktion(n)) continue;
    const ziel = n.medien?.auf ? nachWaId.get(String(n.medien.auf)) : undefined;
    if (ziel) { letzte.set(ziel.id, n.medien?.emoji || null); continue; }
    if (n.medien?.emoji || !n.medien) ohneZiel.add(n.id);
  }
  const reaktionen = new Map<number, string[]>();
  letzte.forEach((z, id) => { if (z) reaktionen.set(id, [z]); });

  // Der Streifen „N ungelesene Nachrichten" vor der N-letzten Kundennachricht (ohne Reaktionen).
  let streifenVor: number | null = null;
  const neu = Math.max(0, Math.floor(Number(opts.ungelesen) || 0));
  if (neu > 0) {
    const kunde = verlauf.filter((n) => n.richtung !== "raus" && !istReaktion(n));
    const ziel = kunde[Math.max(0, kunde.length - neu)];
    if (ziel) streifenVor = ziel.id;
  }

  type Roh = { art: "n"; n: Nachricht; am: string } | { art: "e"; e: MaraEreignis; am: string };
  const roh: Roh[] = [];
  let i = 0;
  for (const n of verlauf) {
    const t = msVon(wann(n));
    while (i < ev.length && msVon(ev[i].am) < t) { roh.push({ art: "e", e: ev[i], am: ev[i].am }); i++; }
    roh.push({ art: "n", n, am: wann(n) });
  }
  for (; i < ev.length; i++) roh.push({ art: "e", e: ev[i], am: ev[i].am });

  const aus: Eintrag[] = [];
  let tag = "";
  let buendel: MaraEreignis[] | null = null;
  const buendelZu = () => { if (buendel?.length) aus.push({ art: "schritte", key: `s-${buendel[0].id}`, liste: buendel }); buendel = null; };
  for (const r of roh) {
    const k = tagSchluessel(r.am);
    if (k && k !== tag) { buendelZu(); tag = k; aus.push({ art: "tag", key: `t-${k}`, text: tagStreifen(r.am, jetzt) }); }
    if (r.art === "e") { (buendel ??= []).push(r.e); continue; }
    buendelZu();
    if (istReaktion(r.n)) {
      if (ohneZiel.has(r.n.id)) {
        const z = r.n.medien?.emoji;
        aus.push({ art: "hinweis", key: `h-${r.n.id}`, text: z ? `Kunde hat mit ${z} auf eine ältere Nachricht reagiert` : "Kunde hat auf eine Nachricht reagiert" });
      }
      continue;
    }
    if (streifenVor === r.n.id) aus.push({ art: "ungelesen", key: `u-${r.n.id}`, anzahl: neu });
    aus.push({ art: "nachricht", key: `n-${r.n.id}`, n: r.n, absender: absenderVon(r.n), gruppeNeu: true, gruppeEnde: true, reaktionen: reaktionen.get(r.n.id) ?? [] });
  }
  buendelZu();

  // Gruppen: gleicher Absender (bei Menschen: gleicher Name), direkt hintereinander, höchstens 5 Minuten Abstand.
  for (let k = 1; k < aus.length; k++) {
    const a = aus[k - 1]; const b = aus[k];
    if (a.art !== "nachricht" || b.art !== "nachricht") continue;
    const gleich = a.absender === b.absender && (a.absender !== "mensch" || vorname(a.n.von) === vorname(b.n.von));
    const nah = Math.abs(msVon(wann(b.n)) - msVon(wann(a.n))) <= 5 * 60_000;
    if (gleich && nah) { b.gruppeNeu = false; a.gruppeEnde = false; }
  }
  return aus;
}
