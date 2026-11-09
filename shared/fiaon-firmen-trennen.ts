// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN: DIE REGEL (E-487, 09.11.2026)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────────
// Bis E-487 legte globalLeadAufnehmen (server/routes/fiaon-firmen.ts) einen neuen Lead auch allein über den Firmennamen auf
// eine bestehende Karte — über JEDEN gleichen Namen. Schrieben mehrere Menschen im Formular nur einen Platzhalter oder eine
// Allerwelts-Angabe ins Firmenfeld („Selbständig“, „Selbständig / Freiberufler“, „Kleingewerbe“, „Immobilien“, „GmbH“ …),
// landeten sie alle auf EINER Karte: mit Kopf, Nummer, Notizen und Anrufen des ersten — und Daniels Aufträge der anderen
// öffneten genau diese fremde Karte. Den Eingang repariert firmaNameVerbindet; die schon zusammengelegten Karten trennt der
// Lauf firmen_trennen (server/lib/fiaon-firmen-trennen.ts) mit DIESER Regel.
//
// ── DIE REGEL (rein, ohne Datenbank — Lauf und Prüfstand lesen dieselbe) ───────────────────────────────────────────
//   · Kandidat ist jede Karte, deren Firmenname allein heute NICHT verbinden dürfte: !firmaNameVerbindet(firma, ansprechpartner)
//     — dieselbe Regel wie der Eingang (Platzhalter, Rollen-/Füllwort, Name ohne Rechtsform). Nachbesserung (Gutachten): vorher
//     nur Platzhalter (firmaBrauchbar … false) — „Selbständig / Freiberufler“ oder „Kleingewerbe“ wären nie getrennt worden.
//     Zwei Kollegen derselben echten Firma schützt die strenge Fremd-Regel (alles verschieden, gleiche Firmen-Domain hält zusammen).
//   · Eigentümer ist der Kartenkopf (person_id, Mail, Nummer, Name): globalLeadAufnehmen füllt nur leere Felder, der Kopf
//     gehört also dem Ersten. Ein Eingang (eine Global-Anfrage) ist FREMD nur, wenn Mail UND Mobilnummer (letzte 9 Ziffern)
//     UND voller Name (Teile in beliebiger Reihenfolge, ä = ae) UND person_id vom Kopf abweichen — und auch von jedem anderen
//     Eingang, der zum Kopf gehört (dieselbe Person mit neuer Mail und alter Nummer bleibt). Im Zweifel bleibt der Eingang:
//     dieselbe Firmen-Domain (keine Freemail) hält zusammen, ein Kopf ohne jedes Kennzeichen trennt gar nichts.
//   · Fremde Eingänge werden nach Person gruppiert (Mail, Nummer, Name, person_id, Firmen-Domain — auch über Ketten).
//   · Ziel je Gruppe: eine VORHANDENE Karte derselben Person (person_id vor Mail vor Nummer — nie über den Namen allein, nie
//     über eine Fantasienummer, bei mehreren Karten mit derselben Nummer nur mit demselben vollen Namen, nie die Quelle),
//     sonst eine neue Karte.
//   · Verlaufszeilen ziehen nur mit eindeutigem Bezug um: „(Anfrage #n über …)“ im Eingangstext, oder neben genau EINER Marke
//     (Dossier gesendet, Lead-Meldung/Erinnerung, Lead-Mail, Buchung/„Termin steht“, „Ich rufe selbst an“, gewählter
//     Gesprächsweg), oder Maras WhatsApp-Zeilen, wenn alle WhatsApp-Kontakte der Karte EINER Person gehören. Passt eine Zeile
//     zu zwei Seiten, bleibt sie, und der Lauf schreibt einen Vermerk. Anrufe, Notizen und Gesprächs-Mails bleiben beim Eigentümer.
//   · Notiz-Blöcke: globalLeadAufnehmen schreibt „FIAON Global (TT.MM.JJJJ): <Verlauf>“ (höchstens 600 Zeichen). Steht genau
//     dieser Block wörtlich und als ganze Zeile(n) in der Notiz, zieht er um; sonst bleibt die Notiz unberührt (Vermerk).
//     Bewusst KEIN „bis zur nächsten Kopfzeile“: Eine Anruf-Notiz ohne Kopf darf nie mit dem Block davor wandern.
//   · Der Stand der Quelle (Status, Wiedervorlage): Jeder Eingang setzt ihn (globalLeadAufnehmen). Hat zuletzt ein Eingang
//     der fremden Person den Status gesetzt (Anrufe ohne Ergebnis danach lassen ihn stehen und zählen nicht), gilt danach der
//     Stand aus dem letzten eigenen Ereignis der Karte (nur, wo er aus der Zeile eindeutig folgt); ohne eindeutiges Ereignis
//     wird nur ein fremder „Termin“ zu „Wiedervorlage heute“, sonst ein Vermerk „bitte prüfen“. Wer abgesagt hat, wird nicht
//     wieder angerufen.
//
// Repo ist öffentlich: keine Kundennamen, keine Karten- oder Anfragenummern — Beispiele nur mit erfundenen Menschen.
// ═══════════════════════════════════════════════════════════════════════════
import {
  firmaBrauchbar, firmaNameVerbindet, namenForm, berlinZeit, firmenDomain, paketwunschAus, fadenBetreff, leadAnzeigeName,
  firmaOffenPlatzhalter, type LeadTemperatur,
} from "./fiaon-global-lead";
import { isoPlus } from "./fiaon-global-lead-texte";

/** Der Lauf (tageslauf in server/routes.ts, Katalog in server/lib/fiaon-crons.ts) und sein Schalter in fiaon_settings. */
export const FIRMEN_TRENNEN_LAUF = "firmen_trennen";
export const FIRMEN_TRENNEN_SCHALTER = "firmen_trennen";

/**
 * Höchstens so viele Trennungen je Lauf (Gutachten, Mangel 11). Darüber rechnet der Lauf nur noch trocken und meldet sich als
 * Fehler in der Lauf-Historie — eine Panne in Regel oder Daten trennt nie unbegrenzt viele Karten auf einmal.
 */
export const FIRMEN_TRENNEN_DECKEL = 5;

export type TrennModus = "an" | "trocken" | "aus";

/**
 * Der Schalter „firmen_trennen“: leer = TROCKEN (nur rechnen, Zahlen in die Lauf-Historie), „an“ = trennen, „aus“ = nichts.
 * Nachbesserung (Gutachten, Mangel 1): Der Schreibweg ist nie gegen eine Datenbank gelaufen (Teil B des Prüfstands nicht
 * gestartet) — darum schreibt der Lauf erst, wenn jemand nach Sicht der Historie ausdrücklich „an“ setzt. Ein unbekannter
 * Wert gilt als „trocken“ — ein Tippfehler darf nie schreiben. Rein.
 */
export function trennModusLesen(wert: unknown): TrennModus {
  const s = String(wert ?? "").trim().toLowerCase();
  if (/^(1|an|ein|true|ja|on)$/.test(s)) return "an";
  if (/^(0|aus|false|nein|off)$/.test(s)) return "aus";
  return "trocken";
}

/**
 * Kandidat = eine Karte, deren Firmenname allein heute nicht verbinden dürfte (!firmaNameVerbindet — Platzhalter, Rollen-
 * oder Füllwort, Name ohne Rechtsform). Echte Firmennamen mit Rechtsform nie. Rein.
 */
export function trennKandidat(firma: unknown, ansprechpartner: unknown): boolean {
  return !firmaNameVerbindet(firma, ansprechpartner);
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

/**
 * Eine Fantasienummer (weniger als drei verschiedene Ziffern, 123456789, 987654321 …) belegt keine Person (Gutachten,
 * Mangel 13). Rein.
 */
export function nummerTrivial(n9: string): boolean {
  if (!/^\d{9}$/.test(n9)) return true;
  if (new Set(n9.split("")).size < 3) return true;
  const d = n9.split("").map(Number);
  const auf = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const ab = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  return auf || ab;
}

/** Die letzten neun Ziffern, nur wenn sie eine echte Nummer sein können — für die Zielsuche (nie über eine Fantasienummer). Rein. */
export function nummer9Echt(tel: unknown): string {
  const n9 = nummer9(tel);
  return n9 && !nummerTrivial(n9) ? n9 : "";
}

export function mailForm(m: unknown): string {
  return String(m ?? "").trim().toLowerCase();
}

const TITEL = new Set(["herr", "herrn", "frau", "dr", "prof", "mr", "mrs", "ms"]);
const UMLAUT: Readonly<Record<string, string>> = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue" };

function personFormMit(name: unknown, umlautAlsE: boolean): string {
  let roh = String(name ?? "").normalize("NFC");
  if (umlautAlsE) roh = roh.replace(/[äöüÄÖÜ]/g, (c) => UMLAUT[c] ?? c);
  roh = roh.replace(/[øØ]/g, "o").replace(/[æÆ]/g, "ae").replace(/[łŁ]/g, "l");
  return namenForm(roh).split(" ").filter((t) => t && !TITEL.has(t)).join(" ");
}

/**
 * Der Name für den Personenvergleich: ä/ö/ü als ae/oe/ue (sonst wären „Jürgen Müller“ und „Juergen Mueller“ zwei Menschen),
 * dazu ø/æ/ł (zerfallen nicht in NFKD), wie namenForm, ohne Anrede/Titel. Rein.
 */
export function personForm(name: unknown): string {
  return personFormMit(name, true);
}

const teileSortiert = (form: string): string => form.split(" ").filter(Boolean).sort().join(" ");
const vollerName = (schluessel: string): boolean => schluessel.split(" ").filter(Boolean).length >= 2;

/** Der Name als Schlüssel: Teile sortiert („Muster Max“ = „Max Muster“). Rein. */
export function personSchluessel(name: unknown): string {
  return teileSortiert(personFormMit(name, true));
}

/**
 * Derselbe volle Name (mindestens zwei Teile, Reihenfolge egal)? ä gilt als ae UND als a — beide Schreibweisen kommen vor
 * („Juergen Mueller“, „Jurgen Muller“); im Zweifel dieselbe Person. Rein.
 */
export function gleicherName(a: unknown, b: unknown): boolean {
  for (const umlautAlsE of [true, false]) {
    const x = teileSortiert(personFormMit(a, umlautAlsE));
    if (vollerName(x) && x === teileSortiert(personFormMit(b, umlautAlsE))) return true;
  }
  return false;
}

function personIdsVon(k: TrennKontakt): number[] {
  return (k.personIds ?? []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
}

/**
 * Dieselbe Person? Gemeinsame person_id ODER dieselbe Mail ODER dieselben letzten 9 Ziffern ODER derselbe volle Name
 * (mindestens zwei Teile, Reihenfolge egal). Leere Felder zählen nie als gleich. Rein.
 */
export function gleichePerson(a: TrennKontakt, b: TrennKontakt): boolean {
  const pa = new Set(personIdsVon(a));
  if (personIdsVon(b).some((p) => pa.has(p))) return true;
  const ma = mailForm(a.email);
  if (ma && ma === mailForm(b.email)) return true;
  const ta = nummer9(a.telefon);
  if (ta && ta === nummer9(b.telefon)) return true;
  return gleicherName(a.name, b.name);
}

/** Im Zweifel zusammen: dieselbe Person — oder dieselbe Firmen-Domain (Freemail zählt nie). Rein. */
export function zusammengehoerig(a: TrennKontakt, b: TrennKontakt): boolean {
  if (gleichePerson(a, b)) return true;
  const da = firmenDomain(a.email);
  return !!da && da === firmenDomain(b.email);
}

/** Hat der Kartenkopf überhaupt ein Kennzeichen (person_id, Mail, 9 Ziffern, voller Name)? Ohne eines wird nichts getrennt. Rein. */
export function kontaktErkennbar(k: TrennKontakt): boolean {
  return personIdsVon(k).length > 0 || !!mailForm(k.email) || !!nummer9(k.telefon) || vollerName(personSchluessel(k.name));
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
  /** Der Ansprechpartner der Karte — zählt nur, wenn mehrere Karten dieselbe Nummer tragen. */
  name?: string | null;
}

/**
 * Eine VORHANDENE Karte derselben Person: zuerst über die person_id, dann die Mail, dann die letzten 9 Ziffern (nie eine
 * Fantasienummer) — nie über den Namen allein, nie die Quelle. Tragen MEHRERE Karten nur dieselbe Nummer, zählt nur eine mit
 * demselben vollen Namen (sonst neue Karte: im Zweifel nie auf die Karte eines weiteren Fremden). Bei Gleichstand die älteste
 * Karte (kleinste Kennung, wie globalLeadAufnehmen). null = neue Karte. Rein.
 */
export function zielKarteWaehlen(quelleId: number, mitglieder: readonly TrennKontakt[], karten: readonly KartenKopf[]): { id: number; ueber: "person" | "mail" | "nummer" } | null {
  const pids = new Set(mitglieder.flatMap(personIdsVon));
  const mails = new Set(mitglieder.map((m) => mailForm(m.email)).filter(Boolean));
  const nummern = new Set(mitglieder.map((m) => nummer9Echt(m.telefon)).filter(Boolean));
  const treffer: { id: number; rang: number; name: boolean }[] = [];
  for (const k of karten) {
    const id = Number(k.id);
    if (!Number.isInteger(id) || id <= 0 || id === quelleId) continue;
    const pid = Number(k.personId);
    const mail = mailForm(k.email);
    const nr = nummer9Echt(k.telefon);
    const rang = Number.isInteger(pid) && pid > 0 && pids.has(pid) ? 3 : mail && mails.has(mail) ? 2 : nr && nummern.has(nr) ? 1 : 0;
    if (rang) treffer.push({ id, rang, name: mitglieder.some((m) => gleicherName(m.name, k.name)) });
  }
  if (!treffer.length) return null;
  const rang = Math.max(...treffer.map((t) => t.rang));
  let auswahl = treffer.filter((t) => t.rang === rang);
  if (rang === 1 && auswahl.length > 1) auswahl = auswahl.filter((t) => t.name);
  if (!auswahl.length) return null;
  return { id: Math.min(...auswahl.map((t) => t.id)), ueber: rang === 3 ? "person" : rang === 2 ? "mail" : "nummer" };
}

// ── Verlaufszeilen: nur mit eindeutigem Bezug ─────────────────────────────────
/** Höchstens so weit (ms) darf eine Verlaufszeile neben ihrer Marke stehen (gemessen: 3–31 ms). */
export const LOG_FENSTER_MS = 5000;
/**
 * „Ich rufe selbst an“: selbstAnrufen setzt selbst_am, dann läuft leadStandSetzen (Stand, Auftrag, Nachtrag-Mail) — erst danach
 * folgt die Zeile „selbst“. Darum darf sie bis zu 3 Minuten NACH der Marke stehen (Gutachten, Mangel 4: mindestens 60 s).
 */
export const SELBST_FENSTER_MS = 180_000;

/** Eine Marke, an der eine Verlaufszeile hängen kann. traeger: „a:<Anfrage>“ oder „t:<Termin>“ (Gespräch ohne Anfrage). */
export interface TrennMarke {
  traeger: string;
  art: "dossier" | "takt" | "weg" | "gespraech" | "selbst" | "wa";
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
  // Nachbesserung (Gutachten, Mangel 4): „Justin ruft selbst an“ (selbst_am am Dossier) und der gewählte Gesprächsweg
  // (weg_am in fiaon_wa_global) — sonst stünde bei der falschen Person „Justin ruft selbst an“.
  selbst: "selbst",
  gespraechsweg: "wa",
};

/** Der Absender von Maras WhatsApp-Zeilen (wegSetzen, erzaehltVermerken in server/lib/fiaon-mara-business.ts). */
export const MARA_WHATSAPP = "Mara (WhatsApp)";

/** Maras WhatsApp-Zeilen: der gewählte Gesprächsweg und „WhatsApp: …“ (was er Mara erzählt hat). Rein. */
export function istMaraWhatsappZeile(z: Pick<TrennLogZeile, "art" | "ergebnis" | "notiz" | "agentName">): boolean {
  if (z.art !== "global" || z.agentName !== MARA_WHATSAPP) return false;
  return z.ergebnis === "gespraechsweg" || (z.ergebnis === "erzaehlt" && /^WhatsApp:/.test(String(z.notiz ?? "")));
}

/** Die Eingangszeile von globalLeadAufnehmen: „Bittet um einen Anruf (Anfrage #<n> über …)“ bzw. „Anfrage (Anfrage #<n> über …)“. */
const ANFRAGE_IM_TEXT = /\(Anfrage #(\d+) über /g;

function fensterPasst(art: TrennMarke["art"], zeileMs: number, markeMs: number): boolean {
  const d = zeileMs - markeMs;
  return art === "selbst" ? d >= -LOG_FENSTER_MS && d <= SELBST_FENSTER_MS : Math.abs(d) <= LOG_FENSTER_MS;
}

/**
 * Die Träger einer Verlaufszeile: über die Anfrage-Nummer im Eingangstext (nur bekannte Anfragen der Karte), über eine Marke
 * daneben, oder — nur Maras WhatsApp-Zeilen ohne Marke — über die WhatsApp-Kontakte der Karte (waTraeger). Leer = kein Bezug
 * (die Zeile bleibt). Rein.
 */
export function logZeileZuordnen(
  z: TrennLogZeile, bekannteAnfragen: ReadonlySet<number>, marken: readonly TrennMarke[], waTraeger: readonly string[] = [],
): { traeger: string[]; regel: string | null } {
  if (z.art !== "global") return { traeger: [], regel: null };
  const ergebnis = String(z.ergebnis ?? "");
  if (ergebnis === "anfrage") {
    const nummern = Array.from(String(z.notiz ?? "").matchAll(ANFRAGE_IM_TEXT), (m) => Number(m[1])).filter((n) => bekannteAnfragen.has(n));
    return { traeger: Array.from(new Set(nummern)).map((n) => `a:${n}`), regel: "anfrage" };
  }
  const art = MARKE_JE_ERGEBNIS[ergebnis];
  const t = new Date(z.am).getTime();
  const treffer = new Set<string>();
  if (art && Number.isFinite(t)) {
    for (const m of marken) {
      if (m.art !== art || !m.am) continue;
      const tm = new Date(m.am).getTime();
      if (Number.isFinite(tm) && fensterPasst(art, t, tm)) treffer.add(m.traeger);
    }
  }
  if (treffer.size) return { traeger: Array.from(treffer), regel: art };
  if (istMaraWhatsappZeile(z)) return { traeger: Array.from(new Set(waTraeger)), regel: "whatsapp" };
  return { traeger: [], regel: art ?? null };
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
  waTraeger: readonly string[] = [],
): LogVerteilung {
  const jeGruppe = new Map<number, number[]>();
  const zweideutig: { id: number; gruppen: number[] }[] = [];
  for (const z of zeilen) {
    const { traeger } = logZeileZuordnen(z, bekannteAnfragen, marken, waTraeger);
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
 * Der Paketwunsch auch mitten in einer Verlaufszeile („… Erstgespräch gebucht … Paketwunsch: Global Struktur (2.499 €). Thema: …“)
 * — paketwunschAus kennt nur den Zeilenanfang (Gutachten, Mangel 8). Der Punkt in „2.499“ beendet ihn nicht, nur ein Punkt
 * vor Leerraum oder Zeilenende. null bei „noch offen“. Rein.
 */
export function paketwunschImText(text: unknown): string | null {
  const m = /(?:^|[\s(])Paketwunsch:[ \t]*([^\n]+?)[ \t]*(?:\.(?=\s|$)|$)/m.exec(String(text ?? ""));
  const w = m ? m[1].trim().slice(0, 120) : "";
  if (!w || /^(noch\s+offen|offen|-|keiner?|unbekannt|null)$/i.test(w)) return null;
  return w;
}

/**
 * globalLeadAufnehmen setzt paketwunsch = COALESCE(neu, alt) — ein späterer fremder Eingang kann den Wunsch des Eigentümers
 * überschrieben haben. Nur dann (der Wunsch steht in einem Gruppen-Eingang und in keinem Beleg des Eigentümers) wird er
 * zurückgesetzt. Rein.
 */
export function paketwunschVonGruppe(kopfWunsch: string | null | undefined, gruppenTexte: readonly (string | null | undefined)[], eigeneBelege: readonly (string | null | undefined)[]): boolean {
  const w = String(kopfWunsch ?? "").trim();
  if (!w) return false;
  if (!gruppenTexte.some((t) => paketwunschAus(t) === w || paketwunschImText(t) === w)) return false;
  return !eigeneBelege.some((t) => { const s = String(t ?? ""); return paketwunschAus(s) === w || paketwunschImText(s) === w || s.includes(`Paketwunsch: ${w}`); });
}

// ── Der neue Faden-Stamm (Mails an Justin) ────────────────────────────────────
/**
 * Der Anzeigename einer getrennten Person: ihr Name — bei einem Firmennamen, der nur nicht verbinden darf („Kleingewerbe“,
 * „Immobilien“), mit dem Feld in Klammern („Frieda Fremd (Kleingewerbe)“). Sonst trügen Eigentümer und getrennte Person
 * denselben Faden-Betreff „Lead: Kleingewerbe“, und Gmail fädelte die beiden wieder zusammen. Rein.
 */
export function trennAnzeige(firmaRoh: unknown, name: unknown): string {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  const f = String(firmaRoh ?? "").replace(/\s+/g, " ").trim();
  // Ohne Namen oder mit einer echten Firma (Rechtsform) wie überall (leadAnzeigeName).
  if (!n || firmaNameVerbindet(f, n)) return leadAnzeigeName(firmaRoh, name);
  if (f && firmaBrauchbar(f, n).brauchbar && f.toLowerCase() !== n.toLowerCase()) return `${n} (${f})`.slice(0, 70);
  return n.slice(0, 70);
}

/**
 * Der Betreff-Stamm für die Dossiers und Gespräche einer getrennten Person — ihr eigener Name statt des Fadens des
 * Eigentümers. „Privatkunde?“ nur, wenn IHR Dossier es sagt (basis.hinweis.imBetreff) — nie geerbt vom Faden des Eigentümers
 * (Gutachten, Mangel 7). Rein.
 */
export function neuerFadenStamm(firmaRoh: unknown, name: unknown, temperatur: unknown, privat: boolean): string {
  const t = ["heiss", "warm", "kalt", "offen"].includes(String(temperatur)) ? (String(temperatur) as LeadTemperatur) : "offen";
  return fadenBetreff(trennAnzeige(firmaRoh, name), t, { privat });
}

// ── Der Stand der Quelle (Status, Wiedervorlage) ──────────────────────────────
/**
 * Die Verlaufszeilen, die Status und Wiedervorlage einer Karte setzen (art „global“): Eingang und Buchung
 * (globalLeadAufnehmen), Gesprächsergebnis, Absage, Verschieben (globalLeadFortschreiben), schriftliche Absage
 * (leadSchriftlichAbgesagt), Stand-Korrektur der Ableitung — dazu jedes Anruf-Ergebnis (art „anruf“).
 */
export const STAND_ERGEBNISSE_GLOBAL: readonly string[] = [
  "anfrage", "termin_gebucht", "termin_abgesagt", "gespraech_gefuehrt", "gespraech_nicht_zustande", "termin_verschoben", "abgesagt", "stand",
];

export function standSetzend(z: { art: string; ergebnis: string | null }): boolean {
  return z.art === "anruf" || (z.art === "global" && STAND_ERGEBNISSE_GLOBAL.includes(String(z.ergebnis ?? "")));
}

export interface KartenStand { status: string; wiedervorlage: string | null }

/** Der selbst eingetragene Rückruf in einer Anruf-Notiz („Rückruf vereinbart: Mo., 10.11.2026, 14:00 Uhr“, rueckrufSatz) → JJJJ-MM-TT. Rein. */
export function rueckrufTagAus(notiz: unknown): string | null {
  const m = /Rückruf vereinbart: [A-Za-z]{2}\., (\d{2})\.(\d{2})\.(\d{4})/.exec(String(notiz ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Ein Anruf ohne Ergebnis („nicht erreicht“, „Mailbox“) ohne eigenen Rückruf lässt den STATUS stehen (Route /agent/firmen/:id/anruf)
 * und setzt nur die Wiedervorlage — für die Frage „wer hat den Status gesetzt?“ ist er durchsichtig. Rein.
 */
export function standNeutral(z: { art: string; ergebnis: string | null; notiz: string | null }): boolean {
  return z.art === "anruf" && (z.ergebnis === "nicht_erreicht" || z.ergebnis === "mailbox") && !rueckrufTagAus(z.notiz);
}

/**
 * Was eine Verlaufszeile an Status und Wiedervorlage gesetzt hat — nur, wo es aus der Zeile allein folgt (dieselben Werte wie
 * die Route /agent/firmen/:id/anruf, globalLeadAufnehmen und globalLeadFortschreiben). null = hängt vom Stand davor ab
 * („nicht erreicht“, „Mailbox“ ohne Rückruf) oder ist unbekannt. Wiedervorlage als Berliner Tag. Rein.
 */
export function standAusZeile(z: { art: string; ergebnis: string | null; notiz: string | null; am: Date | string }): KartenStand | null {
  const t = new Date(z.am);
  if (!Number.isFinite(t.getTime())) return null;
  const tag = berlinZeit(t).iso;
  const e = String(z.ergebnis ?? "");
  if (z.art === "anruf") {
    if (e === "erreicht_antrag") return { status: "antrag", wiedervorlage: null };
    if (e === "erreicht_termin") return { status: "termin", wiedervorlage: null };
    if (e === "erreicht_kein_interesse") return { status: "kein_interesse", wiedervorlage: null };
    if (e === "nummer_falsch") return { status: "ungueltig", wiedervorlage: null };
    const rueckruf = rueckrufTagAus(z.notiz);
    if (rueckruf && (e === "erreicht_interesse" || e === "nicht_erreicht" || e === "mailbox")) return { status: "wiedervorlage", wiedervorlage: rueckruf };
    if (e === "erreicht_interesse") return { status: "in_arbeit", wiedervorlage: isoPlus(tag, 1) };
    return null;
  }
  if (z.art !== "global") return null;
  switch (e) {
    case "abgesagt": return { status: "kein_interesse", wiedervorlage: null };
    case "gespraech_nicht_zustande":
      return /kein Interesse mehr, vom Unternehmen erklärt/.test(String(z.notiz ?? "")) ? { status: "kein_interesse", wiedervorlage: null } : { status: "wiedervorlage", wiedervorlage: tag };
    case "gespraech_gefuehrt": return { status: "in_arbeit", wiedervorlage: isoPlus(tag, 1) };
    case "termin_abgesagt": return { status: "wiedervorlage", wiedervorlage: tag };
    case "termin_verschoben": return { status: "termin", wiedervorlage: null };
    case "termin_gebucht": return { status: "termin", wiedervorlage: tag };
    case "anfrage": return { status: /^Anfrage \(/.test(String(z.notiz ?? "")) ? "termin" : "wiedervorlage", wiedervorlage: tag };
    default: return null;
  }
}

const EREIGNIS_WORT: Readonly<Record<string, string>> = {
  erreicht_antrag: "Anruf: Abschluss", erreicht_termin: "Anruf: Termin vereinbart", erreicht_kein_interesse: "Anruf: kein Interesse",
  nummer_falsch: "Anruf: Nummer falsch", erreicht_interesse: "Anruf: Interesse", nicht_erreicht: "Anruf: nicht erreicht", mailbox: "Anruf: Mailbox",
  anfrage: "eigene Anfrage", termin_gebucht: "eigenes Gespräch gebucht", termin_abgesagt: "Gespräch abgesagt", gespraech_gefuehrt: "Gespräch geführt",
  gespraech_nicht_zustande: "Gespräch kam nicht zustande", termin_verschoben: "Gespräch verschoben", abgesagt: "schriftlich abgesagt", stand: "Stand korrigiert",
};

/** „Anruf: kein Interesse am 05.03.2026“ — für den Vermerk. Rein. */
export function standZeileText(z: { ergebnis: string | null; am: Date | string }): string {
  const t = new Date(z.am);
  const wort = EREIGNIS_WORT[String(z.ergebnis ?? "")] ?? String(z.ergebnis ?? "Eintrag");
  return Number.isFinite(t.getTime()) ? `${wort} am ${datumPunkte(berlinZeit(t).iso)}` : wort;
}

export interface QuellStand {
  /** Die jüngste stand-setzende Zeile der Karte (vor jedem Umzug) — die Transaktion prüft, dass seither nichts dazukam. */
  letzteId: number | null;
  /** Die Zeile, die den STATUS gesetzt hat: die jüngste, die nicht nur durchsichtig ist (standNeutral). */
  setzerId: number | null;
  /** Nach der Status-Zeile kamen nur Anrufe ohne Ergebnis — deren Wiedervorlage ist eine eigene Handlung und bleibt. */
  wiedervorlageBehalten: boolean;
  /** Der Stand nach dem letzten EIGENEN Ereignis (keine Zeile einer Gruppe, nicht durchsichtig) — null = nicht eindeutig. */
  eigen: KartenStand | null;
  eigenText: string | null;
}

/**
 * Die jüngste stand-setzende Zeile, die Zeile, die den Status gesetzt hat, und der Stand nach dem letzten eigenen Ereignis.
 * Ordnung wie im Lauf: Zeit, dann Kennung. Rein.
 */
export function quellStandPlanen(zeilen: readonly TrennLogZeile[], fremd: ReadonlySet<number>): QuellStand {
  const setzend = zeilen.filter(standSetzend)
    .map((z) => ({ z, t: new Date(z.am).getTime() }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t || b.z.id - a.z.id);
  const letzte = setzend.length ? setzend[0].z : null;
  const setzer = setzend.find((x) => !standNeutral(x.z))?.z ?? null;
  const eigene = setzend.find((x) => !fremd.has(x.z.id) && !standNeutral(x.z))?.z ?? null;
  return {
    letzteId: letzte ? letzte.id : null, setzerId: setzer ? setzer.id : null,
    wiedervorlageBehalten: !!letzte && !!setzer && letzte.id !== setzer.id,
    eigen: eigene ? standAusZeile(eigene) : null, eigenText: eigene ? standZeileText(eigene) : null,
  };
}

/** Status, bei denen die Karte weiter bearbeitet wird — nur dort bleibt die Wiedervorlage eines späteren eigenen Anrufs. */
export const STAND_OFFEN: readonly string[] = ["neu", "in_arbeit", "wiedervorlage", "termin"];

/**
 * Der Soll-Stand der Quelle, wenn der Status vom fremden Eingang kam: der Stand aus dem letzten eigenen Ereignis, sonst (nur bei
 * „Termin“ — der Termin gehörte der anderen Person) Wiedervorlage heute; null = nicht eindeutig (dann nur ein Hinweis). Folgten
 * der fremden Zeile nur Anrufe ohne Ergebnis, bleibt deren Wiedervorlage bei einem offenen Status. Rein.
 */
export function quellStandSoll(e: { eigen: KartenStand | null; wiedervorlageBehalten: boolean; vorher: KartenStand; heute: string }): KartenStand | null {
  const soll: KartenStand | null = e.eigen ?? (e.vorher.status === "termin" ? { status: "wiedervorlage", wiedervorlage: e.heute } : null);
  if (!soll) return null;
  return e.wiedervorlageBehalten && STAND_OFFEN.includes(soll.status) ? { status: soll.status, wiedervorlage: e.vorher.wiedervorlage } : soll;
}

// ── Die Sätze im Verlauf und im Auftrag (Team-intern, ohne Personendaten) ─────
function anfragenText(ids: readonly number[]): string {
  return ids.length === 1 ? `Anfrage #${ids[0]}` : `Anfragen ${ids.map((n) => `#${n}`).join(", ")}`;
}

const STATUS_WORT: Readonly<Record<string, string>> = {
  neu: "neu", in_arbeit: "in Arbeit", wiedervorlage: "Wiedervorlage", termin: "Termin", kein_interesse: "kein Interesse", ungueltig: "ungültig", antrag: "Antrag",
};
const standText = (s: KartenStand): string =>
  `„${STATUS_WORT[s.status] ?? s.status}“${s.wiedervorlage ? ` mit Wiedervorlage ${datumPunkte(s.wiedervorlage)}` : " ohne Wiedervorlage"}`;

/** Die Zeile auf der Quellkarte. Rein. */
export function getrenntSatzQuelle(e: { anfrageIds: readonly number[]; zielId: number; zielNeu: boolean; firmaRoh: string }): string {
  return `Getrennt: ${anfragenText(e.anfrageIds)} gehörte einer anderen Person (das Firmenfeld „${e.firmaRoh.slice(0, 60)}“ benennt keine eindeutige Firma — Platzhalter oder Name ohne Rechtsform) — `
    + `umgezogen auf eigene Karte #${e.zielId}${e.zielNeu ? " (neu angelegt)" : " (die vorhandene Karte dieser Person)"}. Was hier bleibt, betrifft nur diese Karte.`;
}

/** Die Zeile auf der Zielkarte. Hat Justin den Lead übernommen („Ich rufe selbst an“), sagt sie genau das statt „bitte anrufen“. Rein. */
export function getrenntSatzZiel(e: { anfrageIds: readonly number[]; quelleId: number; firmaRoh: string; selbst?: boolean }): string {
  return `Getrennt aus Karte #${e.quelleId}: ${anfragenText(e.anfrageIds)} lag dort auf der Karte einer anderen Person (Firmenfeld „${e.firmaRoh.slice(0, 60)}“) — `
    + "jetzt auf eigene Karte umgezogen. Notizen, Anrufe und Vermerke dort betrafen die andere Person"
    + (e.selbst ? ". Justin ruft diesen Lead selbst an (Knopf im Lead-Dossier) — bitte nicht zusätzlich anrufen." : ": bitte diesen Lead selbst anrufen.");
}

/** Der Hinweis im umgezogenen Auftrag. Rein. */
export function auftragHinweis(e: { quelleId: number; zielId: number; firmaRoh: string; tagIso: string }): string {
  return `Hinweis (${datumPunkte(e.tagIso)}): Dieser Auftrag lag auf einer fremden Firmen-Karte (#${e.quelleId}, Firmenfeld „${e.firmaRoh.slice(0, 60)}“ benennt keine eindeutige Firma) — `
    + `Notizen, Anrufe und Vermerke dort betrafen eine andere Person. Der Link führt jetzt auf die eigene Karte #${e.zielId}.`;
}

/**
 * Ein Auftragstitel mit dem rohen Firmenfeld bekommt den Anzeigenamen: „FIAON Global: Selbständig bittet …“ (Anruf) und
 * „FIAON Global: Erstgespräch Selbständig am …“ (Gespräch). Sonst unverändert. Rein.
 */
export function auftragTitelNeu(titel: string, firmaRoh: string, anzeige: string): string {
  const roh = String(firmaRoh ?? "").trim();
  const t = String(titel);
  if (!roh || !anzeige || roh === anzeige) return t;
  for (const [vor, nach] of [["FIAON Global: ", " "], ["FIAON Global: Erstgespräch ", " am "]] as const) {
    const vorn = `${vor}${roh}${nach}`;
    if (t.startsWith(vorn)) return `${vor}${anzeige}${nach}${t.slice(vorn.length)}`.slice(0, 300);
  }
  return t;
}

/** Der Hinweis-Satz, wenn etwas bewusst NICHT umzog (Notiz verändert, Zeile zweideutig). Rein. */
export function vermerkSatz(e: { anfrageIds: readonly number[]; notizNicht: number; zweideutig: number }): string | null {
  const teile: string[] = [];
  if (e.notizNicht > 0) teile.push(`${e.notizNicht === 1 ? "ein Notiz-Block stand" : `${e.notizNicht} Notiz-Blöcke standen`} nicht mehr wörtlich in der Notiz und blieb${e.notizNicht === 1 ? "" : "en"} hier — bitte die Notiz von Hand prüfen`);
  if (e.zweideutig > 0) teile.push(`${e.zweideutig === 1 ? "eine Verlaufszeile ließ" : `${e.zweideutig} Verlaufszeilen ließen`} sich nicht eindeutig zuordnen und blieb${e.zweideutig === 1 ? "" : "en"} hier`);
  if (!teile.length) return null;
  return `Getrennt (Hinweis zu ${anfragenText(e.anfrageIds)}): ${teile.join("; ")}.`;
}

/** Der Stand der Quelle kam vom fremden Eingang und ist jetzt korrigiert. eigenText null = Rückfall (Termin der anderen Person). Rein. */
export function standKorrigiertSatz(e: { anfrageIds: readonly number[]; vorher: KartenStand; nachher: KartenStand; eigenText: string | null }): string {
  return `Stand korrigiert (zu ${anfragenText(e.anfrageIds)}): ${standText(e.vorher)} kam vom Eingang der anderen Person — jetzt ${standText(e.nachher)}, `
    + (e.eigenText ? `wie nach dem letzten eigenen Ereignis dieser Karte (${e.eigenText}).` : "denn der Termin gehörte der anderen Person.");
}

/** Der Stand der Quelle kam vom fremden Eingang, aus den eigenen Einträgen folgt kein eindeutiger — nur ein Hinweis. Rein. */
export function standHinweisSatz(e: { anfrageIds: readonly number[]; stand: KartenStand; eigenText: string | null }): string {
  return `Hinweis (zu ${anfragenText(e.anfrageIds)}): Der Stand ${standText(e.stand)} kam vom Eingang der anderen Person — `
    + `${e.eigenText ? `das letzte eigene Ereignis dieser Karte (${e.eigenText}) sagt nichts Eindeutiges` : "eigene Einträge, die einen Stand setzen, gibt es nicht"}. `
    + "Bitte prüfen, wie es mit dieser Karte weitergeht.";
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
/** anlass „anfrage“ (anlass_id = Anfrage) oder „termin“ (anlass_id = Termin, die Buchungsmeldung); fehlt anlass, gilt „anfrage“. */
export interface SnapDossier {
  id: number; anlass?: string | null; anlass_id: number; firma_id: number | null; mail_basis_am: Zeit; mail_ki_am: Zeit; temperatur: string | null;
  faden_betreff: string | null; selbst_am?: Zeit;
  /** basis.hinweis.imBetreff — klingt SEIN Dossier nach Privatkunde? */
  privat?: boolean | null;
}
export interface SnapWeg { anfrage_id: number; firma_id: number | null; willkommen_am: Zeit; nachfass_am: Zeit }
export interface SnapTakt { anfrage_id: number; firma_id: number | null; t1_am: Zeit; e15_am: Zeit; e60_am: Zeit; e120_am: Zeit; vertretung_am: Zeit }
export interface SnapGespraech { termin_id: number; anfrage_id: number | null; firma_id: number | null; person_id: number | null; created_at: Zeit; d2_am: Zeit }
export interface SnapWa { anfrage_id: number | null; firma_id: number | null; weg_am?: Zeit }
export interface SnapAuftrag { id: number; schluessel: string | null; link: string | null; zustaendig_agent_id: number | null }
/** art „global“ und „anruf“ (die Anruf-Ergebnisse brauchen der Stand der Quelle). */
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
  /** Für die Zielsuche (person_id, Mail, 9 Ziffern, Name) und den Abgleich mit dem frischen Kopf in der Transaktion. */
  mitglieder: TrennKontakt[];
  personIds: number[];
  kontakt: GruppenKontakt;
  /** Erste Wahl der Planung (Auftrag, sonst Anfrage, sonst Quelle) — die Transaktion prüft gegen fiaon_agents (zustaendigKandidaten). */
  zustaendigAgentId: number | null;
  /** Wer die neue Karte bekommt, in dieser Reihenfolge: die Zuständigen der Aufträge, dann der Anfragen (ohne Quelle — die liest die Transaktion frisch). */
  zustaendigKandidaten: number[];
  /** Neuer Faden-Stamm für Dossiers und Gespräche dieser Person. */
  fadenStamm: string;
  /** Anzeigename für Auftragstitel („Frieda Fremd“, „Frieda Fremd (Kleingewerbe)“). */
  anzeige: string;
  logIds: number[];
  /** Die umziehenden Eingangs-/Buchungszeilen mit Notiz-Block (Text und Zeit, um den Block in der frischen Notiz zu finden). */
  blockZeilen: { id: number; notiz: string; am: string }[];
  zweideutig: number;
  dossierIds: number[]; wegAnfragen: number[]; taktAnfragen: number[]; gespraechTermine: number[]; waAnfragen: number[]; auftragIds: number[];
  /** Buchungsmeldungen (Dossier anlass „termin“) zu den Gesprächen dieser Gruppe. */
  terminDossierIds: number[];
  /** Hat Justin bei einem ihrer Dossiers „Ich rufe selbst an“ gedrückt? Dann keine Wiedervorlage heute und kein „bitte anrufen“. */
  selbst: boolean;
  /**
   * Hat zuletzt ein Eingang DIESER Gruppe den Status der Quelle gesetzt? Dann die jüngste stand-setzende Zeile (frisch zu prüfen:
   * kam seither nichts dazu?), ob die Wiedervorlage späterer eigener Anrufe bleibt, und der eigene Stand.
   */
  stand: { zeileId: number; wiedervorlageBehalten: boolean; eigen: KartenStand | null; eigenText: string | null } | null;
  /** Texte der Gruppen-Anfragen (für die Paketwunsch-Regel). */
  texte: string[];
}

export interface KartenPlan {
  quelleId: number; firmaRoh: string; eigene: number[]; gruppen: KartenPlanGruppe[]; grund: string | null;
  /** Belege des Eigentümers (Anfrage-Texte, bleibende Eingangszeilen), nach Zeit — für die Paketwunsch-Regel. */
  eigeneBelege: string[];
  /** Der jüngste Paketwunsch in diesen Belegen (auch mitten in einer Verlaufszeile) — null = keiner. */
  eigenerWunsch: string | null;
}

export interface TrennPlanung { karten: number; platzhalter: number; uebersprungen: number; plaene: KartenPlan[] }

const ms = (z: Zeit): number => { const t = z ? new Date(z as any).getTime() : NaN; return Number.isFinite(t) ? t : NaN; };
const iso = (z: Zeit): string | null => { const t = ms(z); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const zahl = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const eindeutig = (werte: readonly (number | null | undefined)[]): number[] =>
  Array.from(new Set(werte.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)));
const istAnfrageDossier = (d: SnapDossier): boolean => String(d.anlass ?? "anfrage") === "anfrage";

/** Die Anfrage hinter einem Auftrags-Schlüssel („global-anfrage:<n>“, „global-rueckruf:<n>“, „global-antwort:<n>“) — sonst null. Rein. */
export function auftragAnfrage(schluessel: unknown): number | null {
  const m = /^global-(?:anfrage|rueckruf|antwort):(\d+)$/.exec(String(schluessel ?? ""));
  return m ? zahl(m[1]) : null;
}

/** Der Termin hinter dem Gesprächs-Auftrag („global-termin:<Termin>“, fiaon-global-termin.ts) — sonst null. Rein. */
export function auftragTermin(schluessel: unknown): number | null {
  const m = /^global-termin:(\d+)$/.exec(String(schluessel ?? ""));
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
  const anfrageDossiers = s.dossiers.filter(istAnfrageDossier);
  const terminDossiers = s.dossiers.filter((d) => String(d.anlass ?? "") === "termin");
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
    for (const d of anfrageDossiers) if (d.firma_id === id) merk(d.anlass_id);
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
    if (!plan.gruppen.length) {
      plaene.push({ quelleId: id, firmaRoh, eigene: plan.eigene, gruppen: [], grund: plan.grund, eigeneBelege: [], eigenerWunsch: null });
      continue;
    }

    // Seite je Träger: eigene Anfragen, Gruppen-Anfragen, Gespräche ohne Anfrage über die Person.
    const seite = new Map<string, number | "eigen">();
    for (const n of plan.eigene) seite.set(`a:${n}`, "eigen");
    plan.gruppen.forEach((g, i) => g.anfrageIds.forEach((n) => seite.set(`a:${n}`, i)));
    const mitgliederJe = plan.gruppen.map((g) => eingaenge.filter((e) => g.anfrageIds.includes(e.anfrageId)));
    const personenJe = mitgliederJe.map((m) => new Set(m.flatMap((e) => personIdsVon(e))));
    const kopfPerson = zahl(k.person_id);
    const kartenAnfragen = new Set<number>([...plan.eigene, ...plan.gruppen.flatMap((g) => g.anfrageIds)]);
    const marken: TrennMarke[] = [];
    for (const d of anfrageDossiers) if (kartenAnfragen.has(Number(d.anlass_id))) {
      marken.push({ traeger: `a:${d.anlass_id}`, art: "dossier", am: d.mail_basis_am }, { traeger: `a:${d.anlass_id}`, art: "dossier", am: d.mail_ki_am });
      if (d.selbst_am) marken.push({ traeger: `a:${d.anlass_id}`, art: "selbst", am: d.selbst_am });
    }
    for (const t of s.takte) if (kartenAnfragen.has(Number(t.anfrage_id))) {
      for (const am of [t.t1_am, t.e15_am, t.e60_am, t.e120_am, t.vertretung_am]) marken.push({ traeger: `a:${t.anfrage_id}`, art: "takt", am });
    }
    for (const w of s.wege) if (kartenAnfragen.has(Number(w.anfrage_id))) {
      for (const am of [w.willkommen_am, w.nachfass_am]) marken.push({ traeger: `a:${w.anfrage_id}`, art: "weg", am });
    }
    const terminTraeger = new Map<number, string>();
    for (const g of s.gespraeche) {
      const a = zahl(g.anfrage_id);
      if (!(g.firma_id === id || (a && kartenAnfragen.has(a)))) continue;
      const traeger = a ? `a:${a}` : `t:${g.termin_id}`;
      if (!a) {
        const p = zahl(g.person_id);
        const i = p && p !== kopfPerson ? personenJe.findIndex((set) => set.has(p)) : -1;
        seite.set(traeger, i >= 0 ? i : "eigen");
      }
      terminTraeger.set(Number(g.termin_id), traeger);
      marken.push({ traeger, art: "gespraech", am: g.created_at }, { traeger, art: "gespraech", am: g.d2_am });
    }
    // Die Buchungsmeldung (Dossier anlass „termin“) trägt den Träger ihres Gesprächs — ihre Zeile „Lead-Dossier“ zieht mit ihm.
    for (const d of terminDossiers) if (d.firma_id === id) {
      const traeger = terminTraeger.get(Number(d.anlass_id)) ?? `t:${d.anlass_id}`;
      marken.push({ traeger, art: "dossier", am: d.mail_basis_am }, { traeger, art: "dossier", am: d.mail_ki_am });
    }
    // WhatsApp: der gewählte Weg ist eine Marke; Maras Zeilen ohne Marke hängen an allen WhatsApp-Kontakten der Karte.
    const waTraeger: string[] = [];
    for (const x of s.wa) {
      const a = zahl(x.anfrage_id);
      const bekannt = !!a && kartenAnfragen.has(a);
      if (!(x.firma_id === id || (x.firma_id == null && bekannt))) continue;
      const traeger = bekannt ? `a:${a}` : "w:unbekannt";
      waTraeger.push(traeger);
      if (bekannt && x.weg_am) marken.push({ traeger, art: "wa", am: x.weg_am });
    }
    const logsDerKarte = s.logs.filter((l) => l.firma_id === id)
      .map((l): TrennLogZeile => ({ id: Number(l.id), art: l.art, ergebnis: l.ergebnis, notiz: l.notiz, am: iso(l.created_at) ?? "", agentName: l.agent_name }));
    const verteilung = logZeilenVerteilen(logsDerKarte, kartenAnfragen, marken, seite, waTraeger);
    const umziehend = new Set(Array.from(verteilung.jeGruppe.values()).flat());
    const quellStand = quellStandPlanen(logsDerKarte, umziehend);
    const belege = [
      ...plan.eigene.map((n) => ({ text: String(anfragen.get(n)?.text ?? ""), t: ms(anfragen.get(n)?.created_at) })),
      ...logsDerKarte.filter((l) => hatNotizBlock(l) && !umziehend.has(l.id)).map((l) => ({ text: String(l.notiz ?? ""), t: ms(l.am) })),
    ].filter((b) => b.text).sort((x, y) => (Number.isFinite(x.t) ? x.t : 0) - (Number.isFinite(y.t) ? y.t : 0));
    const eigeneBelege = belege.map((b) => b.text);
    const eigenerWunsch = belege.map((b) => paketwunschImText(b.text)).filter((w): w is string => !!w).pop() ?? null;

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
      const zustaendigKandidaten = eindeutig([
        ...neueste.map((e) => zahl(auftragFuer(e.anfrageId)?.zustaendig_agent_id)),
        ...neueste.map((e) => zahl(e.a.zustaendig_agent_id)),
      ]);
      const kontakt: GruppenKontakt = {
        firma: erstes((a) => a.firma) || firmaOffenPlatzhalter(name || "ohne Namen"),
        name, email: erstes((a) => a.email).toLowerCase(), telefon: erstes((a) => a.telefon), land: erstes((a) => a.land) || null,
        personId, paketwunsch,
        am: zeiten.length ? new Date(Math.max(...zeiten)).toISOString() : null,
        erstAm: zeiten.length ? new Date(Math.min(...zeiten)).toISOString() : null,
      };
      const dossiersDerGruppe = anfrageDossiers.filter((d) => d.firma_id === id && imPlan.has(Number(d.anlass_id)));
      const juengstesDossier = dossiersDerGruppe.slice().sort((x, y) => (ms(y.mail_basis_am) || 0) - (ms(x.mail_basis_am) || 0))[0];
      const logIds = (verteilung.jeGruppe.get(i) ?? []).slice().sort((x, y) => x - y);
      const logIdSet = new Set(logIds);
      const gespraechTermine = s.gespraeche.filter((x) => x.firma_id === id && !(kopfPerson && zahl(x.person_id) === kopfPerson)
        && ((zahl(x.anfrage_id) && imPlan.has(Number(x.anfrage_id))) || (!zahl(x.anfrage_id) && zahl(x.person_id) && personenJe[i].has(Number(x.person_id)))))
        .map((x) => Number(x.termin_id));
      const termine = new Set(gespraechTermine);
      return {
        quelleId: id, schluessel: g.schluessel, anfrageIds: g.anfrageIds,
        mitglieder: mitgliederJe[i].map((e) => ({ personIds: e.personIds, email: e.email, telefon: e.telefon, name: e.name })),
        personIds: Array.from(personenJe[i]), kontakt,
        zustaendigAgentId: zustaendigKandidaten[0] ?? zahl(k.zustaendig_agent_id),
        zustaendigKandidaten,
        fadenStamm: neuerFadenStamm(kontakt.firma, kontakt.name, juengstesDossier?.temperatur ?? null, !!juengstesDossier?.privat),
        anzeige: trennAnzeige(kontakt.firma, kontakt.name),
        logIds,
        blockZeilen: logsDerKarte.filter((l) => logIdSet.has(l.id) && hatNotizBlock(l))
          .sort((x, y) => ms(x.am) - ms(y.am)).map((l) => ({ id: l.id, notiz: String(l.notiz ?? ""), am: String(l.am) })),
        zweideutig: verteilung.zweideutig.filter((z) => z.gruppen.includes(i)).length,
        dossierIds: dossiersDerGruppe.map((d) => Number(d.id)).sort((x, y) => x - y),
        wegAnfragen: s.wege.filter((w) => imPlan.has(Number(w.anfrage_id)) && (w.firma_id === id || w.firma_id == null)).map((w) => Number(w.anfrage_id)),
        taktAnfragen: s.takte.filter((t) => imPlan.has(Number(t.anfrage_id)) && (t.firma_id === id || t.firma_id == null)).map((t) => Number(t.anfrage_id)),
        gespraechTermine,
        waAnfragen: s.wa.filter((x) => zahl(x.anfrage_id) && imPlan.has(Number(x.anfrage_id)) && (x.firma_id === id || x.firma_id == null)).map((x) => Number(x.anfrage_id)),
        auftragIds: s.auftraege.filter((a) => a.link === link && (imPlan.has(auftragAnfrage(a.schluessel) ?? 0) || termine.has(auftragTermin(a.schluessel) ?? 0)))
          .map((a) => Number(a.id)),
        terminDossierIds: terminDossiers.filter((d) => d.firma_id === id && termine.has(Number(d.anlass_id))).map((d) => Number(d.id)).sort((x, y) => x - y),
        selbst: dossiersDerGruppe.some((d) => Number.isFinite(ms(d.selbst_am))),
        stand: quellStand.letzteId != null && quellStand.setzerId != null && logIdSet.has(quellStand.setzerId)
          ? { zeileId: quellStand.letzteId, wiedervorlageBehalten: quellStand.wiedervorlageBehalten, eigen: quellStand.eigen, eigenText: quellStand.eigenText } : null,
        texte: mitgliederJe[i].map((e) => String(e.a.text ?? "")),
      };
    });
    plaene.push({ quelleId: id, firmaRoh, eigene: plan.eigene, gruppen, grund: null, eigeneBelege, eigenerWunsch });
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
