// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG „GRÜNDUNG BESTELLEN“ (E-520, 17.11.2026)
//
// Justin, 17.11.2026: „Northwest-Bestellung am Zahlungstag automatisch als Aufgabe —
// obwohl keine Aufgaben bearbeitet werden … überlege dir dafür was, sodass es ein
// Mitarbeiter auch wirklich umsetzen kann.“
//
// GEMESSEN am 16.11.2026: Die Aufgabe „Gründung bezahlt — LLC anmelden“ gab es schon —
// sie lag beim Betreiber zwischen 1.688 offenen Aufträgen, die Anleitung (jedes Feld des
// Registered Agent mit Wert, E-462) nur im Chefbüro. Eine bezahlte Gründung blieb so
// vier Tage ohne Bestellung.
//
// NACHHER — vier Dinge, die zusammen erst „umsetzbar“ ergeben:
//   1 EIN Mensch   Der Auftrag geht am Tag des Zahlungseingangs an die eine Person, die
//                  Gründungen bestellt (Einstellung), mit Mail „Neuer Auftrag für dich“.
//   2 ALLES DABEI  Der Link öffnet im Office die Akte des Auftrags, Reiter „Gründung
//                  bestellen“: jedes Feld mit Wert und Kopieren-Knopf — dieselbe Quelle
//                  wie der Arbeitsablauf im Chefbüro (shared/fiaon-global-arbeitsablauf.ts).
//   3 BELEG        Erledigt ist der Auftrag nur mit der Bestellnummer des Registered
//                  Agent. Damit steht die Station „Gründung eingereicht“, der Kunde sieht
//                  es im Portal, der Auftrag geht von selbst zu.
//   4 NACHHALTEN   Am nächsten Werktag um 10 Uhr noch offen → rote Zeile in der Ampel und
//                  eine Mail an die Leitung. Nichts versinkt mehr still in einer Liste.
//
// Diese Datei ist REIN (keine Datenbank, kein Netz; „jetzt“ kommt als Parameter).
// Texte intern: du-Form, ganz einfache Sätze. Kundentexte entstehen hier keine.
// ═══════════════════════════════════════════════════════════════════════════
import { ablaufBloecke, ablaufEinsetzen, ablaufWerte, type AblaufBlock, type AblaufFeld, type AblaufHinweis, type AblaufWerteEin } from "./fiaon-global-arbeitsablauf";

/** Einstellung (fiaon_settings) bzw. Umgebungsvariable: Wer bestellt Gründungen? */
export const GRUENDUNG_SETTING = "global_gruendung_agent_id";
export const GRUENDUNG_ENV = "GLOBAL_GRUENDUNG_AGENT_ID";
/** Fahrplan-Station, die mit der Bestellung erledigt ist („Gründung eingereicht“). */
export const GRUENDUNG_STATION = "articles";
/** Die Schritte des Arbeitsablaufs, die zur Bestellung gehören (Block 2). Nie umbenennen — es sind die Haken-Schlüssel. */
export const GRUENDUNG_SCHRITTE = ["s04_bestellen", "s05_paket", "s06_cart", "s08_formation"] as const;
/** Davon hakt „Bestellt“ diese von Hand zu führenden ab (s08 trägt die Station selbst). */
export const GRUENDUNG_HAKEN = ["s04_bestellen", "s05_paket", "s06_cart"] as const;
export const GRUENDUNG_QUELLE = "global";
export const GRUENDUNG_ALARM_QUELLE = "gruendung";

/** Idempotenz-Schlüssel des Auftrags — beginnt mit „global:“ (Art „global“, shared/fiaon-auftrag-arten.ts). */
export function gruendungSchluessel(ref: string): string {
  return `global:${String(ref).toUpperCase()}:gruendung-bestellen`;
}
export function gruendungAlarmSchluessel(ref: string): string {
  return `gruendung-ueberfaellig:${String(ref).toUpperCase()}`;
}
/** Der Link im Auftrag: die Akte im Office, gleich auf dem richtigen Reiter. */
export function gruendungLink(ref: string): string {
  return `/agent/global/${encodeURIComponent(String(ref).toUpperCase())}?reiter=gruendung`;
}

export interface GruendungLage {
  status: string | null;
  bezahltAm: Date | string | null;
  storniertAm: Date | string | null;
  abgeschlossenAm: Date | string | null;
  istTest: boolean;
  /** E-506: bestehende Gesellschaft wird übernommen — es gibt nichts zu gründen. */
  bestand: boolean;
  /** Status der Station „Gründung eingereicht“ (leer = noch nie angefasst). */
  stationStatus: string | null;
}

/** Steht für diesen Auftrag eine Bestellung an? Bezahlt, läuft, nicht Test, keine Übernahme, Station noch nicht erledigt. */
export function gruendungFaellig(l: GruendungLage): boolean {
  if (!l.bezahltAm || l.storniertAm || l.abgeschlossenAm || l.istTest || l.bestand) return false;
  const s = String(l.status ?? "").toLowerCase();
  if (s === "storniert" || s === "abgeschlossen") return false;
  const st = String(l.stationStatus ?? "").toLowerCase();
  return st !== "erledigt" && st !== "entfaellt";
}

/**
 * Bestellnummer des Registered Agent: Buchstaben und Ziffern, 5 bis 14 Zeichen — so, wie sie in der
 * Bestellbestätigung steht. Leerzeichen, „#“ und Bindestriche fallen weg. null = so sieht keine Nummer aus.
 */
export function gruendungBestellnummer(roh: unknown): string | null {
  const s = String(roh ?? "").toUpperCase().replace(/[\s#\-]/g, "");
  return /^[A-Z0-9]{5,14}$/.test(s) && /\d/.test(s) ? s : null;
}

function berlinTeile(d: Date): { j: number; m: number; t: number; h: number; wt: number } {
  const teile = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(d);
  const n = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? 0);
  const wt = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(teile.find((p) => p.type === "weekday")?.value ?? ""));
  return { j: n("year"), m: n("month"), t: n("day"), h: n("hour"), wt };
}
const tagZahl = (x: { j: number; m: number; t: number }) => x.j * 10_000 + x.m * 100 + x.t;

/**
 * Ist der Auftrag überfällig? Er entsteht am Zahlungstag; überfällig ist er ab dem NÄCHSTEN Werktag
 * (Mo–Fr, Berliner Zeit) um 10 Uhr. Ein Auftrag vom Freitag ist also Montag 10 Uhr überfällig.
 */
export function gruendungUeberfaellig(angelegtAm: Date, jetzt: Date): boolean {
  if (!(angelegtAm instanceof Date) || Number.isNaN(angelegtAm.getTime())) return false;
  const a = berlinTeile(angelegtAm);
  const n = berlinTeile(jetzt);
  if (tagZahl(n) <= tagZahl(a)) return false;
  // Der erste Werktag nach dem Anlage-Tag (in Tagen ab dem Anlage-Tag).
  let wt = a.wt; let schritte = 0;
  do { wt = (wt + 1) % 7; schritte += 1; } while (wt === 0 || wt === 6);
  const mitte = new Date(Date.UTC(a.j, a.m - 1, a.t, 12));
  mitte.setUTCDate(mitte.getUTCDate() + schritte);
  const stichtag = mitte.getUTCFullYear() * 10_000 + (mitte.getUTCMonth() + 1) * 100 + mitte.getUTCDate();
  if (tagZahl(n) > stichtag) return true;
  return tagZahl(n) === stichtag && n.h >= 10;
}

/**
 * Neue Aufträge entstehen nur zwischen 7 und 20 Uhr (Berlin): Die Mail „Neuer Auftrag für dich“ soll niemanden nachts
 * erreichen. Was nachts fällig wird (Buchung spät am Abend, Neustart der Plattform), legt der nächste Takt ab 7 Uhr an.
 */
export function gruendungAnlegenJetzt(jetzt: Date): boolean {
  const h = berlinTeile(jetzt).h;
  return h >= 7 && h < 20;
}

export interface GruendungAuftragEin { gesellschaft: string; bundesstaat: string; fastTrack: boolean; bezahltAmText: string }

/** Titel und Text des Auftrags (intern, du-Form). Kein Kundenname — der steht in der Akte hinter dem Link. */
export function gruendungAuftragText(e: GruendungAuftragEin): { titel: string; text: string } {
  const name = e.gesellschaft.trim() || "neue Gesellschaft";
  const staat = e.bundesstaat.trim() || "Bundesstaat laut Akte";
  return {
    titel: `Heute: Gründung bestellen — ${name} (${staat})`.slice(0, 160),
    text: [
      `Die Gründung ist bezahlt (Eingang ${e.bezahltAmText}). Bitte heute beim Registered Agent bestellen.`,
      e.fastTrack ? "Fast-Track ist gebucht: Diese Bestellung hat Vorrang vor allem anderen." : "",
      "So geht es: Auftrag öffnen → Reiter „Gründung bestellen“. Dort steht jedes Feld mit dem Wert zum Kopieren. Dauer: etwa 10 Minuten.",
      "Fertig bist du, wenn du die Bestellnummer eingetragen hast. Dann schließt sich dieser Auftrag von selbst, und der Kunde sieht „Gründung eingereicht“ in seinem Portal.",
      "Fehlt dir etwas (Zugang, ein Wert, der Name ist vergeben)? Schreib es als Frage in diesen Auftrag — nicht liegen lassen.",
    ].filter(Boolean).join("\n\n"),
  };
}

export interface GruendungFeldSicht { feld: string; wert: string; kopieren: boolean; fehlt: boolean; hinweis?: string }
export interface GruendungSchrittSicht { nr: number; key: string; titel: string; text: string; felder: GruendungFeldSicht[]; hinweise: AblaufHinweis[]; links: { titel: string; url: string }[] }

/**
 * Die Bestell-Anleitung für EINEN Auftrag: Block 2 des Arbeitsablaufs (Registered Agent) mit eingesetzten Werten.
 * Nur externe Links (Chefbüro-Reiter und -Räume gibt es im Office nicht). `fehlend` = Leerstellen, die vor der
 * Bestellung jemand füllen muss.
 */
export function gruendungAnleitung(ein: AblaufWerteEin): { werte: Record<string, string>; schritte: GruendungSchrittSicht[]; fehlend: string[] } {
  const werte = ablaufWerte(ein);
  const bloecke: AblaufBlock[] = ablaufBloecke(werte.bundesstaat);
  const alle = bloecke.flatMap((b) => b.schritte);
  const fehlend = new Set<string>();
  const schritte = (GRUENDUNG_SCHRITTE as readonly string[]).map((key) => alle.find((s) => s.key === key)).filter(Boolean).map((s) => {
    const felder = ((s!.felder ?? []) as AblaufFeld[]).map((f) => {
      const w = ablaufEinsetzen(f.wert, werte);
      if (w.fehlt) (f.wert.match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1)).forEach((k) => { if (!werte[k]) fehlend.add(k); });
      return { feld: f.feld, wert: w.text, kopieren: f.kopieren !== false && !w.fehlt, fehlt: w.fehlt, ...(f.hinweis ? { hinweis: f.hinweis } : {}) };
    });
    const links = (s!.links ?? []).filter((l): l is { titel: string; url: string } => "url" in l).map((l) => ({ titel: l.titel, url: ablaufEinsetzen(l.url, werte, { url: true }).text }));
    // Im Office setzt nicht der Mitarbeiter die Station — die Bestellnummer unten setzt sie. Der Satz dazu wird ausgetauscht.
    const text = ablaufEinsetzen(s!.text, werte).text.replace(/\s*Danach setzt du die Station „Gründung eingereicht“ auf erledigt\./, " Danach trägst du unten die Bestellnummer ein.");
    return { nr: s!.nr, key: s!.key, titel: s!.titel, text, felder, hinweise: s!.hinweise ?? [], links };
  });
  return { werte, schritte, fehlend: Array.from(fehlend) };
}

/** Der Satz für Ampel und Mail an die Leitung, wenn die Bestellung liegen bleibt. */
export function gruendungEskalation(e: { gesellschaft: string; wer: string | null; bezahltAmText: string; angelegtAmText: string }): { titel: string; text: string } {
  const name = e.gesellschaft.trim() || "eine neue Gesellschaft";
  return {
    titel: `Gründung nicht bestellt: ${name}`.slice(0, 200),
    text: `Bezahlt am ${e.bezahltAmText}. Der Auftrag „Gründung bestellen“ liegt seit ${e.angelegtAmText} bei ${e.wer || "niemandem"} und ist nicht erledigt. `
      + "Bitte heute klären: selbst bestellen oder den Auftrag neu vergeben (Office › Global › Auftrag › Reiter „Gründung bestellen“).",
  };
}
