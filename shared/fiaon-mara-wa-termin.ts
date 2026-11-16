// ═══════════════════════════════════════════════════════════════════════════
// MARA AUF WHATSAPP — DIE ZEITWAHL FÜR DAS GESPRÄCH MIT JUSTIN (16.11.2026)
//
// ── DER BEFUND (10.11.2026, Produktion nur gelesen) ───────────────────────
// Ein Business-Lead schrieb Mara auf WhatsApp (Website-Knopf „auf WhatsApp führen“). Mara bot ihm Zeiten an, er wählte
// eine — und bekam fünfmal hintereinander wörtlich dieselbe Absage „Diese Zeit ist leider gerade vergeben …“, auch für die
// Zeit, die sie selbst angeboten hatte. Ursache: Seine Anfrage kam aus WhatsApp und trug keine E-Mail. `buchen` prüfte den
// Kontakt mit dem Formular-Leser (E-Mail Pflicht), bekam „E-Mail fehlt“ und meldete JEDES Scheitern als „vergeben“.
// fiaon_termin_versuche hatte keine einzige Zeile: Die Buchung erreichte den Kalender nie.
//
// ── DIE REGELN (hier, rein, ohne Datenbank — Prüfstand scripts/pruef-mara-wa-termin.ts) ───
//   · EINE Regel für „ist diese Zeit frei?“: `freieZeitFinden` — Maras Angebot, Maras Vorprüfung und die Annahme
//     (globalTerminBuchen) rufen genau diese Funktion auf derselben Liste (globalAngebotLaden → ergebnis.frei).
//   · Was der Kunde schreibt („Freitag 9 Uhr“, „9.30“, „Dann 9“) wird in Berliner Tag + Uhrzeit gelesen — die Tage aus
//     SEINEM Text, sonst aus Maras letzter Nachricht. Nur EINDEUTIG wird gebucht; passen zwei freie Zeiten, fragt Mara nach.
//   · „Nicht frei“ sagt Mara nur, wenn die Zeit wirklich nicht unter den freien steht — dann sofort mit zwei konkreten
//     freien Zeiten in der Nähe seines Wunsches. Nie zweimal hintereinander dieselbe Absage: nach einer Absage mit
//     Zeiten übernimmt beim nächsten Fehlgriff Herr Schwarzott persönlich (Übergabe).
//   · Ein technischer Fehler ist nie „vergeben“: Mara gibt den Wunsch an Herrn Schwarzott weiter.
//
// Berliner Zeit nur über formatToParts (berlinWand aus fiaon-genannter-termin). Repo öffentlich: keine Namen.
// ═══════════════════════════════════════════════════════════════════════════
import { uhrzeitenGenannt, berlinWand, TERMIN_AENDERN } from "./fiaon-genannter-termin";

/** Eine freie Zeit, wie globalZeitenRechnen sie liefert (Tag und Uhrzeit in Berlin, `beginn` als ISO). */
export interface WaFreieZeit { tag: string; zeit: string; beginn?: string }
/** Ein Wunsch: Berliner Tag (JJJJ-MM-TT) und Uhrzeit (HH:MM) — je null, wenn unbekannt. */
export interface WaWunsch { tag: string | null; zeit: string | null }

// ── Lesen und Normalisieren ────────────────────────────────────────────────
/** „9“, „9:00“, „09.00“, „9 Uhr“, „9h“, „09:30 Uhr“ → „09:00“/„09:30“. Unlesbares → null. Rein. */
export function waZeitNormal(z: unknown): string | null {
  const m = String(z ?? "").trim().toLowerCase().match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(?:uhr|h)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null ? 0 : Number(m[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Ein gültiger Kalendertag „JJJJ-MM-TT“ (kein 31.11.) — sonst null. Rein. */
export function waTagNormal(t: unknown): string | null {
  const m = String(t ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3])
    ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * DIE EINE REGEL: Steht (tag, zeit) unter den freien Zeiten? Die Uhrzeit wird normalisiert („9:00“ = „09:00“), der Tag
 * muss genau stimmen. Maras Angebot, Maras Vorprüfung und die Annahme (globalTerminBuchen) nutzen diese Funktion. Rein.
 */
export function freieZeitFinden<T extends WaFreieZeit>(frei: readonly T[], wunsch: { tag: unknown; zeit: unknown }): T | null {
  const tag = waTagNormal(wunsch?.tag);
  const zeit = waZeitNormal(wunsch?.zeit);
  if (!tag || !zeit) return null;
  return frei.find((f) => f.tag === tag && waZeitNormal(f.zeit) === zeit) ?? null;
}

/** Bis zu `n` Zeiten an verschiedenen Tagen, je die früheste — Maras Angebot (vorher in freieZeiten). Rein. */
export function waZeitAngebot<T extends WaFreieZeit>(frei: readonly T[], n = 3): T[] {
  const sortiert = [...frei].sort((a, b) => `${a.tag} ${a.zeit}`.localeCompare(`${b.tag} ${b.zeit}`));
  const aus: T[] = [];
  const tage = new Set<string>();
  for (const f of sortiert) { if (tage.has(f.tag)) continue; tage.add(f.tag); aus.push(f); if (aus.length >= n) break; }
  return aus;
}

const WOCHENTAG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
/** „Freitag, 13.11., 09:00 Uhr“ aus Tag (JJJJ-MM-TT, Berlin) und Zeit. Rein. */
export function waZeitText(tag: string, zeit: string): string {
  const [j, m, t] = tag.split("-").map(Number);
  const wt = WOCHENTAG[new Date(Date.UTC(j, (m || 1) - 1, t || 1, 12)).getUTCDay()];
  return `${wt}, ${String(t).padStart(2, "0")}.${String(m).padStart(2, "0")}., ${zeit} Uhr`;
}

/**
 * Die Uhrzeit in einer kurzen Antwort auf WhatsApp. Zuerst die Hausregel (uhrzeitenGenannt: „9 Uhr“, „um 9“, „9:30“, „2 pm“,
 * „14h“), dann was auf WhatsApp dazukommt: „9.30“ / „9.00“ ohne „Uhr“ (kein Datum: kein Punkt danach), „halb 10“, und in
 * einer sehr kurzen Antwort die bloße Stunde („9“, „Dann 9“). Mehr als eine Uhrzeit = unklar (null). Rein.
 */
export function waUhrzeitAusText(text: unknown): string | null {
  const t = String(text ?? "").replace(/https?:\/\/\S+/g, " ");
  const ohneDatum = t.replace(/(?<![\d.])\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/g, " ");
  const gefunden = new Set<string>(uhrzeitenGenannt(ohneDatum));
  for (const m of Array.from(ohneDatum.matchAll(/(?<![\d.:,])(\d{1,2})\.(\d{2})(?![\d.])/g))) {
    const z = waZeitNormal(`${m[1]}:${m[2]}`); if (z) gefunden.add(z);
  }
  for (const m of Array.from(ohneDatum.matchAll(/\bhalb\s+(\d{1,2})\b/gi))) {
    const h = Number(m[1]) - 1; if (h >= 0 && h <= 23) gefunden.add(`${String(h).padStart(2, "0")}:30`);
  }
  // Eine sehr kurze Antwort („9“, „Dann 9“, „Freitag 9“, „9 oder 10 Uhr“): bloße Stunden zählen mit — in einem langen Satz
  // ist eine Zahl selten eine Uhrzeit („12 Mitarbeiter“).
  const kurz = ohneDatum.trim();
  if (kurz.length <= 30) {
    const stunden = Array.from(kurz.replace(/\bhalb\s+\d{1,2}\b/gi, " ").matchAll(/(?<![\d.:,])(\d{1,2})(?![\d.:,%€])/g)).map((m) => Number(m[1])).filter((h) => h >= 6 && h <= 21);
    const schon = new Set(Array.from(gefunden).map((z) => Number(z.slice(0, 2))));
    for (const h of stunden) if (!schon.has(h)) gefunden.add(`${String(h).padStart(2, "0")}:00`);
  }
  return gefunden.size === 1 ? Array.from(gefunden)[0] : null;
}

const WT_NR: Record<string, number> = {
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
function tagPlus(isoTag: string, n: number): string {
  const [j, m, t] = isoTag.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * ALLE Tage, die ein Text nennt (Berlin, relativ zu `jetzt`), in der Reihenfolge des Textes und ohne Doppelte:
 * „13.11.“, Wochentage (der nächste solche Tag, heute eingeschlossen), „heute“, „morgen“, „übermorgen“. Für Maras
 * letzte Nachricht („Freitag, 13.11., 09:00 Uhr oder Montag, 16.11., 09:00 Uhr“ → zwei Tage). Rein.
 */
export function waTageAusText(text: unknown, jetzt: Date): string[] {
  const t = String(text ?? "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/\b(guten|schönen|good)\s+(morgen|morning)\b/g, " ");
  const n = berlinWand(jetzt);
  const heute = `${n.j}-${String(n.m).padStart(2, "0")}-${String(n.t).padStart(2, "0")}`;
  const treffer: { pos: number; tag: string }[] = [];
  for (const m of Array.from(t.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?!\d)/g))) {
    const tg = Number(m[1]); const mo = Number(m[2]);
    if (tg < 1 || tg > 31 || mo < 1 || mo > 12) continue;
    let jahr = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : n.j;
    if (!m[3] && Date.UTC(jahr, mo - 1, tg) < Date.UTC(n.j, n.m - 1, n.t) - 2 * 86_400_000) jahr += 1;
    const tag = waTagNormal(`${jahr}-${String(mo).padStart(2, "0")}-${String(tg).padStart(2, "0")}`);
    if (tag) treffer.push({ pos: m.index ?? 0, tag });
  }
  for (const [name, wt] of Object.entries(WT_NR)) {
    for (const m of Array.from(t.matchAll(new RegExp(`\\b${name}\\b`, "g")))) treffer.push({ pos: m.index ?? 0, tag: tagPlus(heute, (wt - n.wt + 7) % 7) });
  }
  for (const [re, plus] of [[/(?:^|[^a-zäöüß])(übermorgen|uebermorgen)\b/g, 2], [/\b(?<!über)(?<!ueber)(morgen|tomorrow)\b/g, 1], [/\b(heute|today)\b/g, 0]] as const) {
    for (const m of Array.from(t.matchAll(re))) treffer.push({ pos: m.index ?? 0, tag: tagPlus(heute, plus) });
  }
  const aus: string[] = [];
  for (const x of treffer.sort((a, b) => a.pos - b.pos)) if (!aus.includes(x.tag)) aus.push(x.tag);
  return aus;
}

/** Sein Wunsch aus seinem Text: Tag(e) und Uhrzeit (Berlin). „Freitag 9 Uhr“ am Dienstag → nächster Freitag, 09:00. Rein. */
export function waWunschAusText(text: unknown, jetzt: Date): { tage: string[]; zeit: string | null } {
  return { tage: waTageAusText(text, jetzt), zeit: waUhrzeitAusText(text) };
}

// ── Die Entscheidung ───────────────────────────────────────────────────────
export type WaTerminEntscheidung<T extends WaFreieZeit = WaFreieZeit> =
  /** Diese freie Zeit buchen. */
  | { art: "buchen"; slot: T; quelle: "modell" | "kunde" }
  /** Zwei freie Zeiten passen zu seinen Worten — nachfragen, nicht raten. */
  | { art: "rueckfrage"; kandidaten: T[] }
  /** Sein Wunsch steht fest, ist aber nicht frei. */
  | { art: "nicht_frei"; wunsch: WaWunsch; alternativen: T[] };

/**
 * Was tun, wenn das Modell sagt „er hat einer Zeit zugestimmt“? 1. Die Zeit des Modells (normalisiert) ist frei → buchen.
 * 2. Sonst seine eigenen Worte: Uhrzeit aus seinem Text, Tage aus seinem Text — sonst der Tag des Modells, sonst die Tage
 * aus Maras letzter Nachricht. Genau EINE freie Zeit passt → buchen; mehrere → nachfragen. Sagt er ab oder verschiebt
 * („kann Freitag nicht“), entscheidet nie dieser Leser. 3. Ein fester Wunsch, der nicht frei ist → „nicht frei“ mit zwei
 * Alternativen. 4. Gar nichts Lesbares → nachfragen mit den zwei frühesten Zeiten. Rein.
 */
export function waTerminEntscheiden<T extends WaFreieZeit>(ein: {
  modell: { tag?: unknown; zeit?: unknown } | null; kunde: string; kontext: string | null; jetzt: Date; frei: readonly T[];
}): WaTerminEntscheidung<T> {
  const m: WaWunsch = { tag: waTagNormal(ein.modell?.tag), zeit: waZeitNormal(ein.modell?.zeit) };
  const vomModell = freieZeitFinden(ein.frei, m);
  if (vomModell) return { art: "buchen", slot: vomModell, quelle: "modell" };

  const k = waWunschAusText(ein.kunde, ein.jetzt);
  const aendert = TERMIN_AENDERN.test(String(ein.kunde ?? ""));
  if (k.zeit && !aendert) {
    const tage = k.tage.length ? k.tage : m.tag ? [m.tag] : waTageAusText(ein.kontext ?? "", ein.jetzt);
    // „Freitag 9“ am Freitag nach 9 Uhr meint wohl den nächsten Freitag — nur für HEUTE auch eine Woche weiter prüfen.
    const n = berlinWand(ein.jetzt);
    const heute = `${n.j}-${String(n.m).padStart(2, "0")}-${String(n.t).padStart(2, "0")}`;
    const pruefTage = Array.from(new Set(tage.flatMap((t) => (t === heute ? [t, tagPlus(t, 7)] : [t]))));
    const passend = pruefTage.map((tag) => freieZeitFinden(ein.frei, { tag, zeit: k.zeit })).filter((x): x is T => !!x);
    const nahe = passend.filter((s) => tage.includes(s.tag));
    if (nahe.length === 1) return { art: "buchen", slot: nahe[0], quelle: "kunde" };
    if (nahe.length > 1) return { art: "rueckfrage", kandidaten: nahe.slice(0, 2) };
    // Nur eine Woche weiter frei („Freitag 9“ am Freitagmittag) → nie still eine Woche später buchen, sondern bestätigen lassen.
    if (passend.length) return { art: "rueckfrage", kandidaten: passend.slice(0, 1) };
    const wunsch: WaWunsch = m.tag && m.zeit ? m : { tag: tage.length === 1 ? tage[0] : null, zeit: k.zeit };
    if (wunsch.tag && wunsch.zeit) return { art: "nicht_frei", wunsch, alternativen: zweiAlternativen(ein.frei, wunsch) };
    // Nur eine Uhrzeit, kein Tag, und keine passt: die zwei Zeiten, die seiner Uhrzeit am nächsten liegen.
    return { art: "rueckfrage", kandidaten: zweiAlternativen(ein.frei, { tag: null, zeit: k.zeit }) };
  }
  if (m.tag && m.zeit) return { art: "nicht_frei", wunsch: m, alternativen: zweiAlternativen(ein.frei, m) };
  return { art: "rueckfrage", kandidaten: waZeitAngebot(ein.frei, 2) };
}

const tagNr = (isoTag: string) => { const [j, m, t] = isoTag.split("-").map(Number); return Math.round(Date.UTC(j, m - 1, t) / 86_400_000); };
const minNr = (z: string) => { const [h, mi] = z.split(":").map(Number); return h * 60 + mi; };

/**
 * Zwei freie Zeiten so nah wie möglich an seinem Wunsch: zuerst der gleiche Tag (die nächste Uhrzeit), dann die Nachbartage
 * (wieder die nächste Uhrzeit) — „Freitag 9 Uhr ist vergeben“ → „Freitag 09:30 oder 10:00“, nicht „Donnerstag 11:30“. Nie
 * der Wunsch selbst, chronologisch geordnet. Ohne Uhrzeit: die zwei frühesten an verschiedenen Tagen. Rein.
 */
export function zweiAlternativen<T extends WaFreieZeit>(frei: readonly T[], wunsch: WaWunsch, n = 2): T[] {
  const tag = waTagNormal(wunsch.tag);
  const zeit = waZeitNormal(wunsch.zeit);
  if (!zeit) return waZeitAngebot(frei, n);
  const kandidaten = frei.filter((f) => !(f.tag === tag && waZeitNormal(f.zeit) === zeit) && waTagNormal(f.tag) && waZeitNormal(f.zeit));
  const bezugTag = tag ?? (kandidaten.map((f) => f.tag).sort()[0] ?? null);
  if (!bezugTag) return [];
  const tageWeg = (f: T) => Math.abs(tagNr(f.tag) - tagNr(bezugTag));
  const minutenWeg = (f: T) => Math.abs(minNr(waZeitNormal(f.zeit)!) - minNr(zeit));
  return kandidaten
    .map((f) => ({ f, t: tageWeg(f), m: minutenWeg(f) }))
    .sort((x, y) => x.t - y.t || x.m - y.m || `${x.f.tag} ${x.f.zeit}`.localeCompare(`${y.f.tag} ${y.f.zeit}`))
    .slice(0, n).map((x) => x.f)
    .sort((x, y) => `${x.tag} ${x.zeit}`.localeCompare(`${y.tag} ${y.zeit}`));
}

// ── Die Sätze ──────────────────────────────────────────────────────────────
/** Erkennt eine Absage in Maras letzter Nachricht — auch den alten Satz vor diesem Fix. null = keine Absage. Rein. */
export function waAbsageForm(text: unknown): "alternativen" | "uebergabe" | null {
  const t = String(text ?? "");
  if (/ist ebenfalls nicht frei|is not free either/i.test(t)) return "uebergabe";
  if (/ist (?:bei Herrn Schwarzott )?leider nicht frei|leider gerade vergeben|is unfortunately not free|has just been taken/i.test(t)) return "alternativen";
  return null;
}

/**
 * Welche Absage jetzt? Die erste nennt zwei freie Zeiten. Kam direkt davor schon eine solche Absage (oder gibt es keine
 * freie Zeit mehr), übernimmt Herr Schwarzott persönlich — nie zweimal hintereinander dieselbe Absage. Rein.
 */
export function waAbsageArt(letzteMara: string | null | undefined, alternativen: number): "alternativen" | "uebergabe" {
  if (alternativen <= 0) return "uebergabe";
  return waAbsageForm(letzteMara) === "alternativen" ? "uebergabe" : "alternativen";
}

const oder = (z: readonly string[], wort: string) => (z.length > 1 ? `${z.slice(0, -1).join(", ")} ${wort} ${z[z.length - 1]}` : z[0] ?? "");

/** Die Absage — mit seinem Wunsch und zwei konkreten freien Zeiten, oder als Übergabe an Herrn Schwarzott. Rein. */
export function satzNichtFrei(ein: { wunsch: string | null; alternativen: readonly string[]; link: string | null; englisch?: boolean; art: "alternativen" | "uebergabe" }): string {
  const en = !!ein.englisch;
  const z = ein.alternativen.slice(0, 2);
  if (ein.art === "uebergabe") {
    if (en) return `I am sorry, ${ein.wunsch ?? "that time"} is not free either. I am passing your request straight to Mr Schwarzott; he will get in touch personally to agree a time with you.${ein.link ? ` You can also see all free times here: ${ein.link}` : ""}`;
    return `Das tut mir leid, ${ein.wunsch ?? "diese Zeit"} ist ebenfalls nicht frei. Ich gebe Ihren Wunsch direkt an Herrn Schwarzott weiter, er meldet sich persönlich und stimmt die Zeit mit Ihnen ab.${ein.link ? ` Alle freien Zeiten sehen Sie auch hier: ${ein.link}` : ""}`;
  }
  if (en) return `${ein.wunsch ? `${ein.wunsch} is unfortunately not free.` : "That time is unfortunately not free."} Mr Schwarzott is free on ${oder(z, "or")} (German time). Which suits you?${ein.link ? ` You can also choose yourself: ${ein.link}` : ""}`;
  return `${ein.wunsch ? `${ein.wunsch} ist bei Herrn Schwarzott leider nicht frei.` : "Diese Zeit ist bei Herrn Schwarzott leider nicht frei."} Frei ${z.length > 1 ? "sind" : "ist"} zum Beispiel ${oder(z, "oder")}. ${z.length > 1 ? "Welche Zeit passt Ihnen?" : "Passt Ihnen das?"}${ein.link ? ` Oder wählen Sie selbst: ${ein.link}` : ""}`;
}

/** Zwei freie Zeiten passen zu seinen Worten — nachfragen. Rein. */
export function satzRueckfrage(zeiten: readonly string[], link: string | null, englisch = false): string {
  const z = zeiten.slice(0, 2);
  if (!z.length) return englisch ? "Of course. Which day and time would suit you?" : "Sehr gern. Welcher Tag und welche Uhrzeit passen Ihnen?";
  if (englisch) return `Of course. Just so I enter the right one: do you mean ${oder(z, "or")} (German time)?${link ? ` You can also choose yourself: ${link}` : ""}`;
  return z.length > 1
    ? `Sehr gern. Damit ich die richtige Zeit eintrage: Meinen Sie ${oder(z, "oder")}?`
    : `Sehr gern. Damit ich die richtige Zeit eintrage: Meinen Sie ${z[0]}?`;
}

/** Ein technischer Fehler beim Eintragen — nie „vergeben“; der Wunsch geht an Herrn Schwarzott. Rein. */
export function satzWunschWeitergegeben(wunsch: string | null, englisch = false): string {
  if (englisch) return `Thank you. I am passing ${wunsch ? `your preferred time, ${wunsch},` : "your preferred time"} straight to Mr Schwarzott; he will confirm it to you personally.`;
  return `Danke. Ihre Wunschzeit${wunsch ? ` ${wunsch}` : ""} gebe ich direkt an Herrn Schwarzott weiter, er bestätigt sie Ihnen persönlich.`;
}

// ── Der Kontakt ────────────────────────────────────────────────────────────
export interface WaKontaktDaten { name: string; firma: string; email: string }
/**
 * Eine Anfrage aus WhatsApp trägt weder Name noch Firma noch E-Mail. Hat derselbe Anschluss eine zweite Global-Anfrage
 * (z. B. das Meta-Formular Sekunden später), füllt sie die LEEREN Felder — die neueste zuerst; was da ist, bleibt. Rein.
 */
export function kontaktErgaenzen(haupt: Partial<WaKontaktDaten> | null | undefined, weitere: readonly (Partial<WaKontaktDaten> | null | undefined)[]): WaKontaktDaten {
  const sauber = (v: unknown) => String(v ?? "").trim();
  const feld = (k: keyof WaKontaktDaten) => sauber(haupt?.[k]) || weitere.map((w) => sauber(w?.[k])).find(Boolean) || "";
  const email = feld("email");
  return { name: feld("name"), firma: feld("firma"), email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "" };
}
