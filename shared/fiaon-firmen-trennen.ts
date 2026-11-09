// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN: DIE REGEL (E-487, 09.11.2026)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────────
// Bis E-487 legte globalLeadAufnehmen (server/routes/fiaon-firmen.ts) einen neuen Lead auch allein über den Firmennamen auf
// eine bestehende Karte. Schrieben mehrere Menschen im Formular nur einen Platzhalter ins Firmenfeld („Selbständig“, „GmbH“,
// „Siehe oben“ …), landeten sie alle auf EINER Karte: mit Kopf, Nummer, Notizen und Anrufen des ersten — und Daniels Aufträge
// der anderen öffneten genau diese fremde Karte. Den Eingang repariert der Platzhalter-Fix (firmaNameVerbindet); die schon
// zusammengelegten Karten trennt der Lauf firmen_trennen (server/lib/fiaon-firmen-trennen.ts) mit DIESER Regel.
//
// ── DIE REGEL (rein, ohne Datenbank — Lauf und Prüfstand lesen dieselbe) ───────────────────────────────────────────
//   · Kandidat ist nur eine Karte mit Platzhalter-Namen: firmaBrauchbar(firma, ansprechpartner).brauchbar === false.
//     Echte Firmennamen werden nie angefasst (zwei Menschen derselben echten Firma gehören auf eine Karte).
//   · Eigentümer ist der Kartenkopf (person_id, Mail, Nummer, Name): globalLeadAufnehmen füllt nur leere Felder, der Kopf
//     gehört also dem Ersten. Ein Eingang (eine Global-Anfrage) ist FREMD nur, wenn Mail UND Mobilnummer (letzte 9 Ziffern)
//     UND voller Name UND person_id vom Kopf abweichen — und auch von jedem anderen Eingang, der zum Kopf gehört (dieselbe
//     Person mit neuer Mail und alter Nummer bleibt). Im Zweifel bleibt der Eingang: dieselbe Firmen-Domain (keine Freemail)
//     hält zusammen, ein Kopf ohne jedes Kennzeichen trennt gar nichts.
//   · Fremde Eingänge werden nach Person gruppiert (Mail, Nummer, Name, person_id, Firmen-Domain — auch über Ketten).
//   · Ziel je Gruppe: eine VORHANDENE Karte derselben Person (person_id, Mail oder 9 Ziffern — nie über den Namen allein,
//     nie die Quelle), sonst eine neue Karte.
//   · Verlaufszeilen ziehen nur mit eindeutigem Anfrage-Bezug um: „(Anfrage #n über …)“ im Eingangstext, oder höchstens
//     5 Sekunden neben genau EINER Marke (Dossier gesendet, Lead-Meldung/Erinnerung, Lead-Mail, Buchung/„Termin steht“).
//     Passt eine Zeile zu zwei Seiten, bleibt sie, und der Lauf schreibt einen Vermerk. Anrufe, Notizen und Gesprächs-Mails
//     bleiben beim Eigentümer.
//   · Notiz-Blöcke: globalLeadAufnehmen schreibt „FIAON Global (TT.MM.JJJJ): <Verlauf>“ (höchstens 600 Zeichen). Steht genau
//     dieser Block wörtlich und als ganze Zeile(n) in der Notiz, zieht er um; sonst bleibt die Notiz unberührt (Vermerk).
//     Bewusst KEIN „bis zur nächsten Kopfzeile“: Eine Anruf-Notiz ohne Kopf darf nie mit dem Block davor wandern.
//
// Repo ist öffentlich: keine Kundennamen, keine Karten- oder Anfragenummern — Beispiele nur mit erfundenen Menschen.
// ═══════════════════════════════════════════════════════════════════════════
import {
  firmaBrauchbar, namenForm, berlinZeit, firmenDomain, paketwunschAus, fadenBetreff, leadAnzeigeName, firmaOffenPlatzhalter, type LeadTemperatur,
} from "./fiaon-global-lead";
import { isoPlus } from "./fiaon-global-lead-texte";

/** Der Lauf (tageslauf in server/routes.ts, Katalog in server/lib/fiaon-crons.ts) und sein Schalter in fiaon_settings. */
export const FIRMEN_TRENNEN_LAUF = "firmen_trennen";
export const FIRMEN_TRENNEN_SCHALTER = "firmen_trennen";

export type TrennModus = "an" | "trocken" | "aus";

/**
 * Der Schalter „firmen_trennen“: leer = an (Justins Go vom 09.11.2026), „trocken“ = nur rechnen und in die Lauf-Historie
 * schreiben, „aus“ = nichts. Ein unbekannter Wert gilt als „trocken“ — ein Tippfehler darf nie schreiben. Rein.
 */
export function trennModusLesen(wert: unknown): TrennModus {
  const s = String(wert ?? "").trim().toLowerCase();
  if (!s || /^(1|an|ein|true|ja|on)$/.test(s)) return "an";
  if (/^(0|aus|false|nein|off)$/.test(s)) return "aus";
  return "trocken";
}

/** Kandidat = Karte mit Platzhalter im Firmenfeld (firmaBrauchbar … brauchbar === false). Echte Firmennamen nie. Rein. */
export function trennKandidat(firma: unknown, ansprechpartner: unknown): boolean {
  return firmaBrauchbar(firma, ansprechpartner).brauchbar === false;
}

// ── Dieselbe Person? ──────────────────────────────────────────────────────────
export interface TrennKontakt {
  /** Alle Personen-Kennungen dieses Eingangs (Anfrage, Gespräch) bzw. des Kartenkopfs. */
  personIds?: readonly (number | null | undefined)[];
  email?: string | null;
  telefon?: string | null;
  name?: string | null;
}

/** Die letzten neun Ziffern einer Nummer (wie globalLeadAufnehmen: erst ab neun Ziffern), sonst "". Rein. */
export function nummer9(tel: unknown): string {
  const d = String(tel ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
}

export function mailForm(m: unknown): string {
  return String(m ?? "").trim().toLowerCase();
}

const TITEL = new Set(["herr", "herrn", "frau", "dr", "prof", "mr", "mrs", "ms"]);

/** Der Name für den Personenvergleich: wie namenForm, dazu ø/æ/ł (zerfallen nicht in NFKD) und ohne Anrede/Titel. Rein. */
export function personForm(name: unknown): string {
  const roh = String(name ?? "").replace(/[øØ]/g, "o").replace(/[æÆ]/g, "ae").replace(/[łŁ]/g, "l");
  return namenForm(roh).split(" ").filter((t) => t && !TITEL.has(t)).join(" ");
}

function personIdsVon(k: TrennKontakt): number[] {
  return (k.personIds ?? []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
}

/**
 * Dieselbe Person? Gemeinsame person_id ODER dieselbe Mail ODER dieselben letzten 9 Ziffern ODER derselbe volle Name
 * (mindestens zwei Teile). Leere Felder zählen nie als gleich. Rein.
 */
export function gleichePerson(a: TrennKontakt, b: TrennKontakt): boolean {
  const pa = new Set(personIdsVon(a));
  if (personIdsVon(b).some((p) => pa.has(p))) return true;
  const ma = mailForm(a.email);
  if (ma && ma === mailForm(b.email)) return true;
  const ta = nummer9(a.telefon);
  if (ta && ta === nummer9(b.telefon)) return true;
  const na = personForm(a.name);
  return na.split(" ").length >= 2 && na === personForm(b.name);
}

/** Im Zweifel zusammen: dieselbe Person — oder dieselbe Firmen-Domain (Freemail zählt nie). Rein. */
export function zusammengehoerig(a: TrennKontakt, b: TrennKontakt): boolean {
  if (gleichePerson(a, b)) return true;
  const da = firmenDomain(a.email);
  return !!da && da === firmenDomain(b.email);
}

/** Hat der Kartenkopf überhaupt ein Kennzeichen (person_id, Mail, 9 Ziffern, voller Name)? Ohne eines wird nichts getrennt. Rein. */
export function kontaktErkennbar(k: TrennKontakt): boolean {
  return personIdsVon(k).length > 0 || !!mailForm(k.email) || !!nummer9(k.telefon) || personForm(k.name).split(" ").length >= 2;
}

// ── Der Plan je Karte ─────────────────────────────────────────────────────────
export interface TrennEingang extends TrennKontakt {
  anfrageId: number;
  am: Date | string;
}

export interface TrennGruppe {
  /** Die Anfragen dieser fremden Person, aufsteigend. */
  anfrageIds: number[];
  /** Protokoll-Schlüssel (UNIQUE in fiaon_firmen_trennung) — derselbe Plan ergibt denselben Schlüssel. */
  schluessel: string;
}

export interface TrennPlan {
  /** Anfragen, die beim Eigentümer (Kartenkopf) bleiben. */
  eigene: number[];
  gruppen: TrennGruppe[];
  /** Warum nichts getrennt wird (z. B. Kopf ohne Kennzeichen) — sonst null. */
  grund: string | null;
}

/**
 * Der Schlüssel einer Trennung: Quelle + ALLE Anfragen der Gruppe. Bewusst nicht nur die kleinste: Kommt von derselben fremden
 * Person später noch eine Anfrage auf die Quelle, ist das eine neue Gruppe (neuer Schlüssel) und wird ebenfalls getrennt;
 * dieselbe Gruppe dagegen nie zweimal — auch nicht nach einem Rückweg von Hand (das Protokoll bleibt stehen). Rein.
 */
export function trennSchluessel(quelleId: number, anfrageIds: readonly number[]): string {
  const ids = Array.from(new Set(anfrageIds.map(Number))).filter((n) => Number.isInteger(n) && n > 0).sort((x, y) => x - y);
  return `trennung:${quelleId}:${ids.join(",")}`;
}

/**
 * Wer auf der Karte ist fremd? Union über „zusammengehörig“ (auch über Ketten: Kopf ↔ Eingang 1 über die Nummer, Eingang 1 ↔
 * Eingang 2 über die Mail). Die Komponente des Kopfs ist der Eigentümer, jede andere Komponente eine fremde Gruppe. Rein.
 */
export function trennPlan(quelleId: number, kopf: TrennKontakt, eingaengeRoh: readonly TrennEingang[]): TrennPlan {
  // Jede Anfrage einmal (eine Anfrage kann über mehrere Verweise gefunden werden).
  const eingaenge: TrennEingang[] = [];
  const gesehen = new Set<number>();
  for (const e of eingaengeRoh) {
    if (!Number.isInteger(e.anfrageId) || e.anfrageId <= 0 || gesehen.has(e.anfrageId)) continue;
    gesehen.add(e.anfrageId);
    eingaenge.push(e);
  }
  const alleIds = eingaenge.map((e) => e.anfrageId).sort((x, y) => x - y);
  if (!kontaktErkennbar(kopf)) {
    return { eigene: alleIds, gruppen: [], grund: "Kartenkopf ohne Mail, Nummer, vollen Namen und Person — nichts getrennt" };
  }
  // Knoten 0 = Kopf, Knoten i + 1 = Eingang i.
  const knoten: TrennKontakt[] = [kopf, ...eingaenge];
  const eltern = knoten.map((_, i) => i);
  const wurzel = (i: number): number => { while (eltern[i] !== i) { eltern[i] = eltern[eltern[i]]; i = eltern[i]; } return i; };
  for (let i = 0; i < knoten.length; i++) {
    for (let j = i + 1; j < knoten.length; j++) {
      if (wurzel(i) !== wurzel(j) && zusammengehoerig(knoten[i], knoten[j])) eltern[wurzel(j)] = wurzel(i);
    }
  }
  const eigentuemer = wurzel(0);
  const eigene: number[] = [];
  const jeWurzel = new Map<number, number[]>();
  eingaenge.forEach((e, i) => {
    const w = wurzel(i + 1);
    if (w === eigentuemer) { eigene.push(e.anfrageId); return; }
    if (!jeWurzel.has(w)) jeWurzel.set(w, []);
    jeWurzel.get(w)!.push(e.anfrageId);
  });
  const gruppen = Array.from(jeWurzel.values())
    .map((ids) => ids.sort((x, y) => x - y))
    .sort((x, y) => x[0] - y[0])
    .map((anfrageIds) => ({ anfrageIds, schluessel: trennSchluessel(quelleId, anfrageIds) }));
  return { eigene: eigene.sort((x, y) => x - y), gruppen, grund: null };
}

// ── Das Ziel je Gruppe ────────────────────────────────────────────────────────
export interface KartenKopf {
  id: number;
  personId?: number | null;
  email?: string | null;
  telefon?: string | null;
}

/**
 * Eine VORHANDENE Karte derselben Person: zuerst über die person_id, dann die Mail, dann die letzten 9 Ziffern — nie über den
 * Namen allein, nie die Quelle. Bei Gleichstand die älteste Karte (kleinste Kennung, wie globalLeadAufnehmen). null = neue Karte. Rein.
 */
export function zielKarteWaehlen(quelleId: number, mitglieder: readonly TrennKontakt[], karten: readonly KartenKopf[]): { id: number; ueber: "person" | "mail" | "nummer" } | null {
  const pids = new Set(mitglieder.flatMap(personIdsVon));
  const mails = new Set(mitglieder.map((m) => mailForm(m.email)).filter(Boolean));
  const nummern = new Set(mitglieder.map((m) => nummer9(m.telefon)).filter(Boolean));
  let beste: { id: number; rang: number } | null = null;
  for (const k of karten) {
    const id = Number(k.id);
    if (!Number.isInteger(id) || id <= 0 || id === quelleId) continue;
    const pid = Number(k.personId);
    const rang = Number.isInteger(pid) && pid > 0 && pids.has(pid) ? 3
      : mails.has(mailForm(k.email)) && mailForm(k.email) ? 2
        : nummer9(k.telefon) && nummern.has(nummer9(k.telefon)) ? 1 : 0;
    if (!rang) continue;
    if (!beste || rang > beste.rang || (rang === beste.rang && id < beste.id)) beste = { id, rang };
  }
  if (!beste) return null;
  return { id: beste.id, ueber: beste.rang === 3 ? "person" : beste.rang === 2 ? "mail" : "nummer" };
}

// ── Verlaufszeilen: nur mit eindeutigem Anfrage-Bezug ─────────────────────────
/** Höchstens so weit (ms) darf eine Verlaufszeile neben ihrer Marke stehen (gemessen: 3–31 ms). */
export const LOG_FENSTER_MS = 5000;

/** Eine Marke, an der eine Verlaufszeile hängen kann. traeger: „a:<Anfrage>“ oder „t:<Termin>“ (Gespräch ohne Anfrage). */
export interface TrennMarke {
  traeger: string;
  art: "dossier" | "takt" | "weg" | "gespraech";
  am: Date | string | null | undefined;
}

export interface TrennLogZeile {
  id: number;
  art: string;
  ergebnis: string | null;
  notiz: string | null;
  am: Date | string;
  agentName?: string | null;
}

/** Welche Verlaufszeile an welcher Marke hängt (art „global“). Alles andere bleibt beim Eigentümer. */
const MARKE_JE_ERGEBNIS: Readonly<Record<string, TrennMarke["art"]>> = {
  dossier: "dossier",
  lead_meldung: "takt",
  erinnerung: "takt",
  lead_mail: "weg",
  termin_gebucht: "gespraech",
  termin_steht: "gespraech",
};

/** Die Eingangszeile von globalLeadAufnehmen: „Bittet um einen Anruf (Anfrage #<n> über …)“ bzw. „Anfrage (Anfrage #<n> über …)“. */
const ANFRAGE_IM_TEXT = /\(Anfrage #(\d+) über /g;

/**
 * Die Träger einer Verlaufszeile: über die Anfrage-Nummer im Eingangstext (nur bekannte Anfragen der Karte) oder über eine
 * Marke höchstens LOG_FENSTER_MS daneben. Leer = kein Bezug (die Zeile bleibt). Rein.
 */
export function logZeileZuordnen(z: TrennLogZeile, bekannteAnfragen: ReadonlySet<number>, marken: readonly TrennMarke[]): { traeger: string[]; regel: string | null } {
  if (z.art !== "global") return { traeger: [], regel: null };
  const ergebnis = String(z.ergebnis ?? "");
  if (ergebnis === "anfrage") {
    const nummern = Array.from(String(z.notiz ?? "").matchAll(ANFRAGE_IM_TEXT), (m) => Number(m[1])).filter((n) => bekannteAnfragen.has(n));
    return { traeger: Array.from(new Set(nummern)).map((n) => `a:${n}`), regel: "anfrage" };
  }
  const art = MARKE_JE_ERGEBNIS[ergebnis];
  if (!art) return { traeger: [], regel: null };
  const t = new Date(z.am).getTime();
  if (!Number.isFinite(t)) return { traeger: [], regel: art };
  const treffer = new Set<string>();
  for (const m of marken) {
    if (m.art !== art || !m.am) continue;
    const tm = new Date(m.am).getTime();
    if (Number.isFinite(tm) && Math.abs(t - tm) <= LOG_FENSTER_MS) treffer.add(m.traeger);
  }
  return { traeger: Array.from(treffer), regel: art };
}

/** Wohin eine Verlaufszeile gehört: zu genau einer Gruppe (Index), zum Eigentümer, oder zweideutig. */
export interface LogVerteilung {
  jeGruppe: Map<number, number[]>;
  /** Zeilen, die eine Gruppe berühren, aber nicht eindeutig sind — sie bleiben, der Lauf schreibt einen Vermerk. */
  zweideutig: { id: number; gruppen: number[] }[];
}

/**
 * Verteilt die Verlaufszeilen einer Karte. seite: Träger → Gruppen-Index oder "eigen" (unbekannte Träger zählen als „eigen“ —
 * im Zweifel bleibt die Zeile). Eine Zeile zieht nur um, wenn ALLE ihre Träger zu derselben Gruppe gehören. Rein.
 */
export function logZeilenVerteilen(
  zeilen: readonly TrennLogZeile[], bekannteAnfragen: ReadonlySet<number>, marken: readonly TrennMarke[], seite: ReadonlyMap<string, number | "eigen">,
): LogVerteilung {
  const jeGruppe = new Map<number, number[]>();
  const zweideutig: { id: number; gruppen: number[] }[] = [];
  for (const z of zeilen) {
    const { traeger } = logZeileZuordnen(z, bekannteAnfragen, marken);
    if (!traeger.length) continue;
    const seiten = new Set(traeger.map((t) => seite.get(t) ?? "eigen"));
    const gruppen = Array.from(seiten).filter((s): s is number => typeof s === "number");
    if (!gruppen.length) continue;
    if (seiten.size === 1) {
      if (!jeGruppe.has(gruppen[0])) jeGruppe.set(gruppen[0], []);
      jeGruppe.get(gruppen[0])!.push(z.id);
    } else {
      zweideutig.push({ id: z.id, gruppen: gruppen.sort((x, y) => x - y) });
    }
  }
  return { jeGruppe, zweideutig };
}

// ── Notiz-Blöcke ──────────────────────────────────────────────────────────────
/** Die Verlaufszeilen, zu denen globalLeadAufnehmen einen Notiz-Block schreibt (art „global“, Absender „Website“). */
export function hatNotizBlock(z: Pick<TrennLogZeile, "art" | "ergebnis" | "agentName">): boolean {
  return z.art === "global" && (z.ergebnis === "anfrage" || z.ergebnis === "termin_gebucht") && (z.agentName == null || z.agentName === "Website");
}

/** „TT.MM.JJJJ“ eines Berliner Kalendertags (JJJJ-MM-TT). Rein. */
export function datumPunkte(iso: string): string {
  return iso.split("-").reverse().join(".");
}

/** Der Notiz-Block genau so, wie globalLeadAufnehmen ihn schreibt (Berliner Tag des Eingangs, höchstens 600 Zeichen). Rein. */
export function notizBlockText(logNotiz: string, berlinTagIso: string): string {
  return `FIAON Global (${datumPunkte(berlinTagIso)}): ${logNotiz}`.slice(0, 600);
}

/** Fundstellen eines Blocks als GANZE Zeile(n): Anfang am Notiz- oder Zeilenanfang, Ende am Notiz- oder Zeilenende. Rein. */
export function blockFundstellen(notiz: string, block: string): number[] {
  const stellen: number[] = [];
  if (!block) return stellen;
  let ab = 0;
  for (;;) {
    const i = notiz.indexOf(block, ab);
    if (i < 0) break;
    const ende = i + block.length;
    if ((i === 0 || notiz[i - 1] === "\n") && (ende === notiz.length || notiz[ende] === "\n")) stellen.push(i);
    ab = i + 1;
  }
  return stellen;
}

/**
 * Den Block einer Verlaufszeile in der Notiz finden: erst mit dem Berliner Tag der Zeile, dann am Vortag und am Folgetag
 * (Eingang kurz vor Mitternacht, Zeile kurz danach). Gilt nur, wenn er GENAU einmal als ganze Zeile(n) dasteht —
 * sonst null (die Notiz bleibt unberührt). Rein.
 */
export function notizBlockFinden(notiz: string | null | undefined, zeile: Pick<TrennLogZeile, "notiz" | "am">): { block: string; index: number } | null {
  const text = String(notiz ?? "");
  const logNotiz = String(zeile.notiz ?? "");
  const t = new Date(zeile.am);
  if (!text || !logNotiz.trim() || !Number.isFinite(t.getTime())) return null;
  const tag = berlinZeit(t).iso;
  for (const versatz of [0, -1, 1]) {
    const block = notizBlockText(logNotiz, versatz ? isoPlus(tag, versatz) : tag);
    const stellen = blockFundstellen(text, block);
    if (stellen.length === 1) return { block, index: stellen[0] };
    if (stellen.length > 1) return null;
  }
  return null;
}

/** Die Notiz ohne den Block an `index` — samt EINEM Zeilenumbruch (davor, sonst danach). Rein. */
export function notizOhneBlock(notiz: string, index: number, laenge: number): string {
  const vor = notiz.slice(0, index);
  const nach = notiz.slice(index + laenge);
  if (vor.endsWith("\n")) return vor.slice(0, -1) + nach;
  if (nach.startsWith("\n")) return vor + nach.slice(1);
  return vor + nach;
}

// ── Kopf der Quelle: Paketwunsch nur, wenn er nachweislich aus der Gruppe stammt ──
/**
 * globalLeadAufnehmen setzt paketwunsch = COALESCE(neu, alt) — ein späterer fremder Eingang kann den Wunsch des Eigentümers
 * überschrieben haben. Nur dann (der Wunsch steht in einem Gruppen-Eingang und in keinem Beleg des Eigentümers) wird er
 * zurückgesetzt. Rein.
 */
export function paketwunschVonGruppe(kopfWunsch: string | null | undefined, gruppenTexte: readonly (string | null | undefined)[], eigeneBelege: readonly (string | null | undefined)[]): boolean {
  const w = String(kopfWunsch ?? "").trim();
  if (!w) return false;
  if (!gruppenTexte.some((t) => paketwunschAus(t) === w)) return false;
  return !eigeneBelege.some((t) => { const s = String(t ?? ""); return paketwunschAus(s) === w || s.includes(`Paketwunsch: ${w}`); });
}

// ── Der neue Faden-Stamm (Mails an Justin) ────────────────────────────────────
/**
 * Der Betreff-Stamm für die Dossiers und Gespräche einer getrennten Person — ihr eigener Name statt des Fadens des
 * Eigentümers. Ein „Privatkunde?“-Faden bleibt einer. Rein.
 */
export function neuerFadenStamm(firmaRoh: unknown, name: unknown, temperatur: unknown, alterStamm?: string | null): string {
  const t = ["heiss", "warm", "kalt", "offen"].includes(String(temperatur)) ? (String(temperatur) as LeadTemperatur) : "offen";
  return fadenBetreff(leadAnzeigeName(firmaRoh, name), t, { privat: /·\s*Privatkunde\?$/.test(String(alterStamm ?? "")) });
}

// ── Die Sätze im Verlauf und im Auftrag (Team-intern, ohne Personendaten) ─────
function anfragenText(ids: readonly number[]): string {
  return ids.length === 1 ? `Anfrage #${ids[0]}` : `Anfragen ${ids.map((n) => `#${n}`).join(", ")}`;
}

/** Die Zeile auf der Quellkarte. Rein. */
export function getrenntSatzQuelle(e: { anfrageIds: readonly number[]; zielId: number; zielNeu: boolean; firmaRoh: string }): string {
  return `Getrennt: ${anfragenText(e.anfrageIds)} gehörte einer anderen Person (das Firmenfeld „${e.firmaRoh.slice(0, 60)}“ ist nur ein Platzhalter) — `
    + `umgezogen auf eigene Karte #${e.zielId}${e.zielNeu ? " (neu angelegt)" : " (die vorhandene Karte dieser Person)"}. Was hier bleibt, betrifft nur diese Karte.`;
}

/** Die Zeile auf der Zielkarte. Rein. */
export function getrenntSatzZiel(e: { anfrageIds: readonly number[]; quelleId: number; firmaRoh: string }): string {
  return `Getrennt aus Karte #${e.quelleId}: ${anfragenText(e.anfrageIds)} lag dort auf der Karte einer anderen Person (Firmenfeld „${e.firmaRoh.slice(0, 60)}“) — `
    + "jetzt auf eigene Karte umgezogen. Notizen, Anrufe und Vermerke dort betrafen die andere Person: bitte diesen Lead selbst anrufen.";
}

/** Der Hinweis im umgezogenen Auftrag. Rein. */
export function auftragHinweis(e: { quelleId: number; zielId: number; firmaRoh: string; tagIso: string }): string {
  return `Hinweis (${datumPunkte(e.tagIso)}): Dieser Auftrag lag auf einer fremden Firmen-Karte (#${e.quelleId}, Firmenfeld „${e.firmaRoh.slice(0, 60)}“ war nur ein Platzhalter) — `
    + `Notizen, Anrufe und Vermerke dort betrafen eine andere Person. Der Link führt jetzt auf die eigene Karte #${e.zielId}.`;
}

/** Ein Auftragstitel mit dem rohen Platzhalter („FIAON Global: Selbständig bittet …“) bekommt den Anzeigenamen. Sonst unverändert. Rein. */
export function auftragTitelNeu(titel: string, firmaRoh: string, anzeige: string): string {
  const roh = String(firmaRoh ?? "").trim();
  const vorn = `FIAON Global: ${roh} `;
  if (!roh || !anzeige || roh === anzeige || !String(titel).startsWith(vorn)) return titel;
  return `FIAON Global: ${anzeige} ${String(titel).slice(vorn.length)}`.slice(0, 300);
}

/** Der Hinweis-Satz, wenn etwas bewusst NICHT umzog (Notiz verändert, Zeile zweideutig). Rein. */
export function vermerkSatz(e: { anfrageIds: readonly number[]; notizNicht: number; zweideutig: number }): string | null {
  const teile: string[] = [];
  if (e.notizNicht > 0) teile.push(`${e.notizNicht === 1 ? "ein Notiz-Block stand" : `${e.notizNicht} Notiz-Blöcke standen`} nicht mehr wörtlich in der Notiz und blieb${e.notizNicht === 1 ? "" : "en"} hier — bitte die Notiz von Hand prüfen`);
  if (e.zweideutig > 0) teile.push(`${e.zweideutig === 1 ? "eine Verlaufszeile ließ" : `${e.zweideutig} Verlaufszeilen ließen`} sich nicht eindeutig zuordnen und blieb${e.zweideutig === 1 ? "" : "en"} hier`);
  if (!teile.length) return null;
  return `Getrennt (Hinweis zu ${anfragenText(e.anfrageIds)}): ${teile.join("; ")}.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PLANER — aus einem Lese-Stand aller Verweise wird je Karte und fremder Person ein Plan (rein).
// Der Lauf liest den Stand, plant hier und führt jede Gruppe in EINER Transaktion aus — dort prüft jede Anweisung noch
// einmal „gehört die Zeile noch der Quelle?“. Der Prüfstand und die Trockenprobe rechnen mit demselben Planer.
// ═══════════════════════════════════════════════════════════════════════════
type Zeit = Date | string | null | undefined;

export interface SnapKarte {
  id: number; firma: string | null; ansprechpartner: string | null; email: string | null; telefon: string | null;
  person_id: number | null; notiz: string | null; paketwunsch: string | null; zustaendig_agent_id: number | null;
}
export interface SnapAnfrage {
  id: number; name: string | null; email: string | null; telefon: string | null; firma: string | null; person_id: number | null;
  created_at: Zeit; land: string | null; ist_test: boolean | null; text: string | null; zustaendig_agent_id: number | null;
}
export interface SnapDossier { id: number; anlass_id: number; firma_id: number | null; mail_basis_am: Zeit; mail_ki_am: Zeit; temperatur: string | null; faden_betreff: string | null }
export interface SnapWeg { anfrage_id: number; firma_id: number | null; willkommen_am: Zeit; nachfass_am: Zeit }
export interface SnapTakt { anfrage_id: number; firma_id: number | null; t1_am: Zeit; e15_am: Zeit; e60_am: Zeit; e120_am: Zeit; vertretung_am: Zeit }
export interface SnapGespraech { termin_id: number; anfrage_id: number | null; firma_id: number | null; person_id: number | null; created_at: Zeit; d2_am: Zeit }
export interface SnapWa { anfrage_id: number | null; firma_id: number | null }
export interface SnapAuftrag { id: number; schluessel: string | null; link: string | null; zustaendig_agent_id: number | null }
export interface SnapLog { id: number; firma_id: number; art: string; ergebnis: string | null; notiz: string | null; created_at: Zeit; agent_name: string | null }

/** Alles, was der Planer über die Kandidaten weiß — gelesen in EINEM Durchgang (dossiers/… nur zu Kandidaten und ihren Anfragen). */
export interface TrennStand {
  karten: SnapKarte[]; anfragen: SnapAnfrage[]; dossiers: SnapDossier[]; wege: SnapWeg[]; takte: SnapTakt[];
  gespraeche: SnapGespraech[]; wa: SnapWa[]; auftraege: SnapAuftrag[]; logs: SnapLog[];
}

export interface GruppenKontakt {
  firma: string; name: string; email: string; telefon: string; land: string | null; personId: number | null;
  paketwunsch: string | null; am: string | null; erstAm: string | null;
}

export interface KartenPlanGruppe {
  quelleId: number; schluessel: string; anfrageIds: number[];
  /** Für die Zielsuche (person_id, Mail, 9 Ziffern) und den Abgleich mit dem frischen Kopf in der Transaktion. */
  mitglieder: TrennKontakt[];
  personIds: number[];
  kontakt: GruppenKontakt;
  zustaendigAgentId: number | null;
  /** Neuer Faden-Stamm für Dossiers und Gespräche dieser Person. */
  fadenStamm: string;
  logIds: number[];
  /** Die umziehenden Eingangs-/Buchungszeilen mit Notiz-Block (Text und Zeit, um den Block in der frischen Notiz zu finden). */
  blockZeilen: { id: number; notiz: string; am: string }[];
  zweideutig: number;
  dossierIds: number[]; wegAnfragen: number[]; taktAnfragen: number[]; gespraechTermine: number[]; waAnfragen: number[]; auftragIds: number[];
  /** Texte der Gruppen-Anfragen (für die Paketwunsch-Regel). */
  texte: string[];
}

export interface KartenPlan {
  quelleId: number; firmaRoh: string; eigene: number[]; gruppen: KartenPlanGruppe[]; grund: string | null;
  /** Belege des Eigentümers (Anfrage-Texte, bleibende Eingangszeilen) — für die Paketwunsch-Regel. */
  eigeneBelege: string[];
}

export interface TrennPlanung { karten: number; platzhalter: number; uebersprungen: number; plaene: KartenPlan[] }

const ms = (z: Zeit): number => { const t = z ? new Date(z as any).getTime() : NaN; return Number.isFinite(t) ? t : NaN; };
const iso = (z: Zeit): string | null => { const t = ms(z); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const zahl = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/** Die Anfrage hinter einem Auftrags-Schlüssel („global-anfrage:<n>“, „global-rueckruf:<n>“, „global-antwort:<n>“) — sonst null. Rein. */
export function auftragAnfrage(schluessel: unknown): number | null {
  const m = /^global-(?:anfrage|rueckruf|antwort):(\d+)$/.exec(String(schluessel ?? ""));
  return m ? zahl(m[1]) : null;
}

/** Die Anfrage-Nummern einer Eingangszeile („(Anfrage #<n> über …)“). Rein. */
export function anfrageNummern(notiz: unknown): number[] {
  return Array.from(new Set(Array.from(String(notiz ?? "").matchAll(ANFRAGE_IM_TEXT), (m) => Number(m[1])).filter((n) => Number.isInteger(n) && n > 0)));
}

export const cockpitLink = (firmaId: number): string => `/agent/firmen?firma=${firmaId}`;

/**
 * Der Plan aller Kandidaten. Eingänge einer Karte = Global-Anfragen (ohne Test) aus den strukturierten Verweisen: Dossier
 * (Anlass „anfrage“), Lead-Weg, Takt, Gespräch, WhatsApp, Daniels Aufträge mit dem Link der Karte, Eingangszeilen im Verlauf.
 * Rein — dieselben Zahlen für den echten Lauf, die Trockenprobe und den Prüfstand.
 */
export function kartenPlanen(s: TrennStand): TrennPlanung {
  const kandidaten = s.karten.filter((k) => trennKandidat(k.firma, k.ansprechpartner));
  const anfragen = new Map<number, SnapAnfrage>();
  for (const a of s.anfragen) if (zahl(a.id) && !a.ist_test) anfragen.set(Number(a.id), a);
  const gespraechPersonen = new Map<number, number[]>();
  for (const g of s.gespraeche) {
    const a = zahl(g.anfrage_id), p = zahl(g.person_id);
    if (a && p) gespraechPersonen.set(a, [...(gespraechPersonen.get(a) ?? []), p]);
  }
  const plaene: KartenPlan[] = [];
  let uebersprungen = 0;
  for (const k of kandidaten) {
    const id = Number(k.id);
    const link = cockpitLink(id);
    const ids = new Set<number>();
    const merk = (v: unknown) => { const n = zahl(v); if (n) ids.add(n); };
    for (const d of s.dossiers) if (d.firma_id === id) merk(d.anlass_id);
    for (const w of s.wege) if (w.firma_id === id) merk(w.anfrage_id);
    for (const t of s.takte) if (t.firma_id === id) merk(t.anfrage_id);
    for (const g of s.gespraeche) if (g.firma_id === id) merk(g.anfrage_id);
    for (const x of s.wa) if (x.firma_id === id) merk(x.anfrage_id);
    for (const a of s.auftraege) if (a.link === link) merk(auftragAnfrage(a.schluessel));
    for (const l of s.logs) if (l.firma_id === id && l.art === "global" && l.ergebnis === "anfrage") anfrageNummern(l.notiz).forEach(merk);
    const eingaenge: (TrennEingang & { a: SnapAnfrage })[] = [];
    for (const n of Array.from(ids)) {
      const a = anfragen.get(n);
      if (!a) continue;
      eingaenge.push({ anfrageId: n, am: iso(a.created_at) ?? "", personIds: [a.person_id, ...(gespraechPersonen.get(n) ?? [])], email: a.email, telefon: a.telefon, name: a.name, a });
    }
    const kopf: TrennKontakt = { personIds: [k.person_id], email: k.email, telefon: k.telefon, name: k.ansprechpartner };
    const plan = trennPlan(id, kopf, eingaenge);
    if (plan.grund) uebersprungen++;
    const firmaRoh = String(k.firma ?? "").trim();
    if (!plan.gruppen.length) { plaene.push({ quelleId: id, firmaRoh, eigene: plan.eigene, gruppen: [], grund: plan.grund, eigeneBelege: [] }); continue; }

    // Seite je Träger: eigene Anfragen, Gruppen-Anfragen, Gespräche ohne Anfrage über die Person.
    const seite = new Map<string, number | "eigen">();
    for (const n of plan.eigene) seite.set(`a:${n}`, "eigen");
    plan.gruppen.forEach((g, i) => g.anfrageIds.forEach((n) => seite.set(`a:${n}`, i)));
    const mitgliederJe = plan.gruppen.map((g) => eingaenge.filter((e) => g.anfrageIds.includes(e.anfrageId)));
    const personenJe = mitgliederJe.map((m) => new Set(m.flatMap((e) => personIdsVon(e))));
    const kopfPerson = zahl(k.person_id);
    const kartenAnfragen = new Set<number>([...plan.eigene, ...plan.gruppen.flatMap((g) => g.anfrageIds)]);
    const marken: TrennMarke[] = [];
    for (const d of s.dossiers) if (kartenAnfragen.has(Number(d.anlass_id))) {
      marken.push({ traeger: `a:${d.anlass_id}`, art: "dossier", am: d.mail_basis_am }, { traeger: `a:${d.anlass_id}`, art: "dossier", am: d.mail_ki_am });
    }
    for (const t of s.takte) if (kartenAnfragen.has(Number(t.anfrage_id))) {
      for (const am of [t.t1_am, t.e15_am, t.e60_am, t.e120_am, t.vertretung_am]) marken.push({ traeger: `a:${t.anfrage_id}`, art: "takt", am });
    }
    for (const w of s.wege) if (kartenAnfragen.has(Number(w.anfrage_id))) {
      for (const am of [w.willkommen_am, w.nachfass_am]) marken.push({ traeger: `a:${w.anfrage_id}`, art: "weg", am });
    }
    for (const g of s.gespraeche) {
      const a = zahl(g.anfrage_id);
      if (!(g.firma_id === id || (a && kartenAnfragen.has(a)))) continue;
      const traeger = a ? `a:${a}` : `t:${g.termin_id}`;
      if (!a) {
        const p = zahl(g.person_id);
        const i = p && p !== kopfPerson ? personenJe.findIndex((set) => set.has(p)) : -1;
        seite.set(traeger, i >= 0 ? i : "eigen");
      }
      marken.push({ traeger, art: "gespraech", am: g.created_at }, { traeger, art: "gespraech", am: g.d2_am });
    }
    const logsDerKarte = s.logs.filter((l) => l.firma_id === id)
      .map((l): TrennLogZeile => ({ id: Number(l.id), art: l.art, ergebnis: l.ergebnis, notiz: l.notiz, am: iso(l.created_at) ?? "", agentName: l.agent_name }));
    const verteilung = logZeilenVerteilen(logsDerKarte, kartenAnfragen, marken, seite);
    const umziehend = new Set(Array.from(verteilung.jeGruppe.values()).flat());
    const eigeneBelege = [
      ...plan.eigene.map((n) => String(anfragen.get(n)?.text ?? "")),
      ...logsDerKarte.filter((l) => hatNotizBlock(l) && !umziehend.has(l.id)).map((l) => String(l.notiz ?? "")),
    ].filter(Boolean);

    const gruppen: KartenPlanGruppe[] = plan.gruppen.map((g, i) => {
      const imPlan = new Set(g.anfrageIds);
      const neueste = mitgliederJe[i].slice().sort((x, y) => ms(y.a.created_at) - ms(x.a.created_at));
      const erstes = (f: (a: SnapAnfrage) => unknown): string => {
        for (const e of neueste) { const v = String(f(e.a) ?? "").trim(); if (v) return v; }
        return "";
      };
      const name = erstes((a) => a.name);
      const zeiten = neueste.map((e) => ms(e.a.created_at)).filter(Number.isFinite);
      const personId = neueste.map((e) => zahl(e.a.person_id)).find((p) => p) ?? Array.from(personenJe[i])[0] ?? null;
      const paketwunsch = neueste.map((e) => paketwunschAus(e.a.text)).find((w) => !!w) ?? null;
      const auftragFuer = (n: number) => s.auftraege.find((a) => a.schluessel === `global-anfrage:${n}`);
      const zustaendig = neueste.map((e) => zahl(auftragFuer(e.anfrageId)?.zustaendig_agent_id)).find((z) => z)
        ?? neueste.map((e) => zahl(e.a.zustaendig_agent_id)).find((z) => z) ?? zahl(k.zustaendig_agent_id);
      const kontakt: GruppenKontakt = {
        firma: erstes((a) => a.firma) || firmaOffenPlatzhalter(name || "ohne Namen"),
        name, email: erstes((a) => a.email).toLowerCase(), telefon: erstes((a) => a.telefon), land: erstes((a) => a.land) || null,
        personId, paketwunsch,
        am: zeiten.length ? new Date(Math.max(...zeiten)).toISOString() : null,
        erstAm: zeiten.length ? new Date(Math.min(...zeiten)).toISOString() : null,
      };
      const dossiersDerGruppe = s.dossiers.filter((d) => d.firma_id === id && imPlan.has(Number(d.anlass_id)));
      const juengstesDossier = dossiersDerGruppe.slice().sort((x, y) => (ms(y.mail_basis_am) || 0) - (ms(x.mail_basis_am) || 0))[0];
      const logIds = (verteilung.jeGruppe.get(i) ?? []).slice().sort((x, y) => x - y);
      const logIdSet = new Set(logIds);
      return {
        quelleId: id, schluessel: g.schluessel, anfrageIds: g.anfrageIds,
        mitglieder: mitgliederJe[i].map((e) => ({ personIds: e.personIds, email: e.email, telefon: e.telefon, name: e.name })),
        personIds: Array.from(personenJe[i]), kontakt, zustaendigAgentId: zustaendig ?? null,
        fadenStamm: neuerFadenStamm(kontakt.firma, kontakt.name, juengstesDossier?.temperatur ?? null, juengstesDossier?.faden_betreff ?? null),
        logIds,
        blockZeilen: logsDerKarte.filter((l) => logIdSet.has(l.id) && hatNotizBlock(l))
          .sort((x, y) => ms(x.am) - ms(y.am)).map((l) => ({ id: l.id, notiz: String(l.notiz ?? ""), am: String(l.am) })),
        zweideutig: verteilung.zweideutig.filter((z) => z.gruppen.includes(i)).length,
        dossierIds: dossiersDerGruppe.map((d) => Number(d.id)).sort((x, y) => x - y),
        wegAnfragen: s.wege.filter((w) => imPlan.has(Number(w.anfrage_id)) && (w.firma_id === id || w.firma_id == null)).map((w) => Number(w.anfrage_id)),
        taktAnfragen: s.takte.filter((t) => imPlan.has(Number(t.anfrage_id)) && (t.firma_id === id || t.firma_id == null)).map((t) => Number(t.anfrage_id)),
        gespraechTermine: s.gespraeche.filter((x) => x.firma_id === id && !(kopfPerson && zahl(x.person_id) === kopfPerson)
          && ((zahl(x.anfrage_id) && imPlan.has(Number(x.anfrage_id))) || (!zahl(x.anfrage_id) && zahl(x.person_id) && personenJe[i].has(Number(x.person_id)))))
          .map((x) => Number(x.termin_id)),
        waAnfragen: s.wa.filter((x) => zahl(x.anfrage_id) && imPlan.has(Number(x.anfrage_id)) && (x.firma_id === id || x.firma_id == null)).map((x) => Number(x.anfrage_id)),
        auftragIds: s.auftraege.filter((a) => a.link === link && imPlan.has(auftragAnfrage(a.schluessel) ?? 0)).map((a) => Number(a.id)),
        texte: mitgliederJe[i].map((e) => String(e.a.text ?? "")),
      };
    });
    plaene.push({ quelleId: id, firmaRoh, eigene: plan.eigene, gruppen, grund: null, eigeneBelege });
  }
  return { karten: s.karten.length, platzhalter: kandidaten.length, uebersprungen, plaene };
}

/**
 * Die Notiz-Seite eines Gruppen-Plans auf einer gegebenen Notiz: welche Blöcke umziehen, wie die Notiz danach aussieht, und
 * wie viele Blöcke nicht wörtlich dastanden (Vermerk). Rein — in der Transaktion auf der FRISCHEN Notiz gerechnet.
 */
export function notizTrennen(notiz: string | null | undefined, blockZeilen: readonly { notiz: string; am: string | Date }[]): { rest: string; bloecke: string[]; nicht: number } {
  let rest = String(notiz ?? "");
  const bloecke: string[] = [];
  let nicht = 0;
  for (const z of blockZeilen) {
    const f = notizBlockFinden(rest, z);
    if (!f) { nicht++; continue; }
    bloecke.push(f.block);
    rest = notizOhneBlock(rest, f.index, f.block.length);
  }
  return { rest, bloecke, nicht };
}
