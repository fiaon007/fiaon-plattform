// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WANN EIN ERSTGESPRÄCH MÖGLICH IST (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Justin: „… oder eben eine Beratung zuvor buchen." Auf /business steht dafür
// ein echter Kalender („Gespräch vereinbaren"). Welche Zeiten er zeigt, rechnet
// DIESE Datei — und nur sie. Die Route fragt die Datenbank (Arbeitszeiten der
// zuständigen Person, ihre Termine) und reicht beides hier herein; zurück
// kommen die freien Zeiten. Dieselbe Rechnung prüft die Buchung, bevor ein
// Termin entsteht: Was die Seite anbietet und was der Server annimmt, kann
// nicht auseinanderlaufen (die Falle vom 19.08.2026, 220 abgewiesene Klicks).
//
// ── REIN, MIT ABSICHT ──────────────────────────────────────────────────────
// Kein Datenbank-Import, kein Netz, keine Uhr: `jetzt` kommt als Parameter.
// Deshalb lässt sich jede Regel im Prüfskript nachrechnen
// (scripts/pruef-global-termin.ts) — auch die Tage, an denen die Uhr umgestellt
// wird, ohne dass man auf Ende Oktober warten muss.
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
//   · Grundlage sind die GEPFLEGTEN Zeiten der zuständigen Person
//     (fiaon_agent_verfuegbarkeit). Keine Zeiten = keine Termine (04.09.2026).
//   · Montag bis Freitag. Ein Samstagsfenster im Kalender des Mitarbeiters gilt
//     für Privatkunden, nicht für das Erstgespräch mit einem Unternehmen.
//   · 30 Minuten, im Raster ab Fensterbeginn — dasselbe Raster, das
//     `terminBuchen` bei der Annahme verlangt.
//   · Frühestens zwei Stunden voraus, höchstens 14 Tage.
//   · Abzüglich aller bestehenden Termine, mit ihrer ECHTEN Dauer: Ein
//     20-Minuten-Termin um 10:20 sperrt 10:00 und 10:30.
//   · Höchstens vier Global-Gespräche je Tag. Der Tag ist danach zu.
//   · Tage zählen als Kalendertage in Berlin, nicht als 24-Stunden-Schritte:
//     Am Tag der Zeitumstellung hat ein Tag 23 oder 25 Stunden, und
//     „jetzt + n × 24 h" überspringt oder verdoppelt dann ein Datum.
// ═══════════════════════════════════════════════════════════════════════════

import { berlinZeitpunkt, berlinDatum, berlinWochentag, zeitZuMinuten, minutenZuZeit } from "./fiaon-time";
import { icsKalender } from "./fiaon-ics";

/** Dauer des Erstgesprächs. `QUELLEN.global.minuten` in fiaon-termine.ts liest diese Zahl. */
export const GLOBAL_DAUER_MIN = 30;
/** Frühestens so viele Stunden voraus — dieselbe Grenze, die `terminBuchen` durchsetzt. */
export const GLOBAL_VORLAUF_STUNDEN = 2;
/** Längstens so viele Tage voraus — dieselbe Grenze, die `terminBuchen` durchsetzt. */
export const GLOBAL_HORIZONT_TAGE = 14;
/** Höchstens so viele Global-Gespräche je Tag. */
export const GLOBAL_PRO_TAG = 4;
/** Nur an diesen Wochentagen (ISO: 1 = Montag). */
export const GLOBAL_WOCHENTAGE = [1, 2, 3, 4, 5];

export interface GlobalFenster { wochentag: number; von: string; bis: string; aktiv?: boolean }

export interface GlobalBelegung {
  beginn: Date | string;
  /** Echte Dauer des Termins in Minuten. Fehlt sie, gelten 20 (Vorgabe der Tabelle). */
  dauerMin?: number | null;
  /**
   * Zählt dieser Termin auf den Tagesdeckel? Das tut nur ein Global-Gespräch,
   * das stattfindet oder stattfand (gebucht, erledigt, verpasst) — eine Absage
   * des Mitarbeiters sperrt die ZEIT, verbraucht aber keinen PLATZ.
   */
  zaehltAlsGlobal?: boolean;
}

export interface GlobalFreieZeit {
  /** „2026-09-18" in Berlin. */
  tag: string;
  /** „09:30" in Berlin. */
  zeit: string;
  /** Der Zeitpunkt als ISO-String — eindeutig, zonenfest. */
  beginn: string;
}

export interface GlobalTag { tag: string; zeiten: string[] }

export interface GlobalZeitenEingabe {
  jetzt: Date;
  fenster: GlobalFenster[];
  belegt: GlobalBelegung[];
  /** Wie viele Tage voraus (1–14). */
  tage?: number;
  dauerMin?: number;
  vorlaufStunden?: number;
  proTag?: number;
}

export interface GlobalZeitenErgebnis {
  /** ALLE buchbaren Zeiten — dagegen prüft die Annahme. */
  frei: GlobalFreieZeit[];
  /** Wie viele Global-Gespräche der Tag noch aufnimmt (nur Tage mit freien Zeiten). */
  restJeTag: Record<string, number>;
  /** Wurden überhaupt Zeiten gepflegt (aktive Fenster Mo–Fr)? Nein = Rückfall auf die Anfrage. */
  zeitenGepflegt: boolean;
}

/** Der Kalendertag `n` Tage nach `datumISO` — reine Datumsrechnung, ohne Uhr und ohne Zone. */
export function kalendertagPlus(datumISO: string, n: number): string {
  const [y, m, d] = datumISO.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Die freien Zeiten für das Erstgespräch.
 *
 * Deterministisch: dieselbe Eingabe, dasselbe Ergebnis. Das ist Pflicht, weil
 * Anzeige (GET /termine/frei) und Annahme (POST /termine) dieselbe Funktion
 * rufen.
 */
export function globalZeitenRechnen(ein: GlobalZeitenEingabe): GlobalZeitenErgebnis {
  const dauer = ein.dauerMin ?? GLOBAL_DAUER_MIN;
  const tage = Math.max(1, Math.min(GLOBAL_HORIZONT_TAGE, Math.round(ein.tage ?? GLOBAL_HORIZONT_TAGE)));
  const proTag = Math.max(1, Math.round(ein.proTag ?? GLOBAL_PRO_TAG));
  const jetztMs = ein.jetzt.getTime();
  const fruehestens = jetztMs + (ein.vorlaufStunden ?? GLOBAL_VORLAUF_STUNDEN) * 3_600_000;
  // `terminBuchen` lehnt alles jenseits von jetzt + 14 × 24 h ab. Ein kürzerer
  // Wunsch (?tage=7) zieht die Grenze enger, nie weiter.
  const spaetestens = jetztMs + tage * 86_400_000;

  const fenster = ein.fenster.filter((f) => {
    if (f.aktiv === false) return false;
    if (!GLOBAL_WOCHENTAGE.includes(Number(f.wochentag))) return false;
    const von = zeitZuMinuten(f.von);
    const bis = zeitZuMinuten(f.bis);
    return von != null && bis != null && bis - von >= dauer;
  });
  if (fenster.length === 0) return { frei: [], restJeTag: {}, zeitenGepflegt: false };

  // Belegung mit echter Dauer; ein kaputter Zeitstempel sperrt nichts.
  const belegt = ein.belegt
    .map((b) => {
      const von = (typeof b.beginn === "string" ? new Date(b.beginn) : b.beginn).getTime();
      const min = Math.max(5, Number(b.dauerMin ?? 20) || 20);
      return { von, bis: von + min * 60_000, global: b.zaehltAlsGlobal === true };
    })
    .filter((b) => Number.isFinite(b.von));

  const globalJeTag = new Map<string, number>();
  for (const b of belegt) {
    if (!b.global) continue;
    const tag = berlinDatum(new Date(b.von));
    globalJeTag.set(tag, (globalJeTag.get(tag) ?? 0) + 1);
  }

  const heute = berlinDatum(ein.jetzt);
  const gesehen = new Set<number>();
  const frei: GlobalFreieZeit[] = [];
  const restJeTag: Record<string, number> = {};

  for (let i = 0; i <= tage; i++) {
    const tag = kalendertagPlus(heute, i);
    const wochentag = berlinWochentag(tag);
    const rest = proTag - (globalJeTag.get(tag) ?? 0);
    if (rest <= 0) continue;
    let zeitenAmTag = 0;
    for (const f of fenster) {
      if (Number(f.wochentag) !== wochentag) continue;
      const von = zeitZuMinuten(f.von)!;
      const bis = zeitZuMinuten(f.bis)!;
      for (let min = von; min + dauer <= bis; min += dauer) {
        const beginn = berlinZeitpunkt(tag, min).getTime();
        if (beginn < fruehestens || beginn > spaetestens) continue;
        // Zwei Fenster, die sich berühren oder überlappen, dürfen dieselbe Zeit
        // nicht zweimal anbieten.
        if (gesehen.has(beginn)) continue;
        const ende = beginn + dauer * 60_000;
        if (belegt.some((b) => beginn < b.bis && ende > b.von)) continue;
        gesehen.add(beginn);
        frei.push({ tag, zeit: minutenZuZeit(min), beginn: new Date(beginn).toISOString() });
        zeitenAmTag++;
      }
    }
    if (zeitenAmTag > 0) restJeTag[tag] = rest;
  }

  frei.sort((a, b) => a.beginn.localeCompare(b.beginn));
  return { frei, restJeTag, zeitenGepflegt: true };
}

/**
 * Nimmt `n` Einträge gleichmäßig über die Liste — erste, letzte und die
 * dazwischen. Dieselbe Idee wie `slotsVerknappen` (fiaon-termine.ts, 18.08.):
 * Achtzehn freie Zeiten an einem Tag sagen „hier ist nichts los", vier sagen
 * „da ist Betrieb" — und gestreut trifft jede Tageshälfte.
 */
export function gleichmaessig<T>(liste: T[], n: number): T[] {
  if (n <= 0) return [];
  if (liste.length <= n) return liste.slice();
  if (n === 1) return [liste[0]];
  const gewaehlt = new Set<number>();
  const schritt = (liste.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) gewaehlt.add(Math.min(liste.length - 1, Math.round(i * schritt)));
  // Trifft die Rundung eine Stelle doppelt, von vorn auffüllen.
  for (let i = 0; gewaehlt.size < n && i < liste.length; i++) gewaehlt.add(i);
  return Array.from(gewaehlt).sort((a, b) => a - b).map((i) => liste[i]);
}

/**
 * Das ANGEBOT der Seite: je Tag so viele Zeiten, wie der Tag noch aufnimmt —
 * gleichmäßig gestreut. Die Annahme prüft bewusst gegen `frei` und nicht gegen
 * dieses Angebot: Bucht jemand, während ein Zweiter die Seite offen hat,
 * streut der Tag neu — die Zeit des Zweiten ist dann weiter frei, nur nicht
 * mehr unter den gezeigten. Ihn dafür abzuweisen kostete ein Gespräch über ein
 * Paket ab 2.499 €, und die Streuung ist Darstellung, keine Regel. Die Regeln
 * (Arbeitszeit, Überschneidung, Vorlauf, Tagesdeckel) stecken in `frei`.
 */
export function globalAngebot(erg: GlobalZeitenErgebnis): GlobalTag[] {
  const jeTag = new Map<string, string[]>();
  for (const f of erg.frei) {
    if (!jeTag.has(f.tag)) jeTag.set(f.tag, []);
    jeTag.get(f.tag)!.push(f.zeit);
  }
  return Array.from(jeTag.keys()).sort().map((tag) => ({
    tag,
    zeiten: gleichmaessig(jeTag.get(tag)!, erg.restJeTag[tag] ?? 0),
  })).filter((t) => t.zeiten.length > 0);
}

// ───────────────────────────────────────────────────────────────────────────
// Die Kalenderdatei (.ics)
//
// Die Mail-Schicht des Hauses hängt an Vorlagen-Mails keine Dateien an
// (mailDirektSenden kennt keinen Anhang; nur die Freitext-Mail kann es, und die
// trägt keine Vorlage). Die Bestätigung verlinkt die Datei deshalb — ein Klick,
// und der Termin steht im Kalender des Unternehmens.
//
// 29.09.2026 (E-263): Zeit, Maskierung und Faltung stehen jetzt in EINER Datei
// (server/lib/fiaon-ics.ts). Die eigene Faltung hier schnitt an UTF-16-
// Einheiten und konnte ein 4-Byte-Zeichen zerteilen.
//
// Gegenprüfung 29.09.2026: `sprache: "en"` — wer auf /en/business gebucht hat,
// bekommt Titel und Beschreibung auf Englisch (vorher immer deutsch). `abgesagt`
// liefert METHOD:CANCEL mit derselben UID und höherer SEQUENCE: So nimmt das
// Unternehmen das Gespräch aus seinem Kalender (vorher antwortete der Link 410).
// ───────────────────────────────────────────────────────────────────────────

/** Titel und Sätze der Global-Kalenderdatei (und des Google-Links) je Sprache — eine Stelle. */
export const GLOBAL_KALENDER_TEXT = {
  de: {
    titel: "FIAON Global – Erstgespräch",
    ruftAn: (wer: string, tel: string) => `${wer} ruft Sie zur vereinbarten Zeit an${tel ? ` (${tel})` : ""}.`,
    nichts: "Sie brauchen nichts vorzubereiten.",
    storno: "Verschieben oder absagen:",
    google: "FIAON ruft Sie zur vereinbarten Zeit an. Verschieben oder absagen: über den Link in Ihrer Bestätigungsmail.",
    abgesagt: "Abgesagt",
    abgesagtText: "Dieses Gespräch wurde abgesagt. Eine neue Zeit wählen Sie auf fiaon.com/business.",
  },
  en: {
    titel: "FIAON Global – first call",
    ruftAn: (wer: string, tel: string) => `${wer} will call you at the agreed time${tel ? ` (${tel})` : ""}.`,
    nichts: "There is nothing you need to prepare.",
    storno: "Reschedule or cancel:",
    google: "FIAON will call you at the agreed time. Reschedule or cancel: via the link in your confirmation email.",
    abgesagt: "Cancelled",
    abgesagtText: "This call has been cancelled. You can choose a new time at fiaon.com/en/business.",
  },
} as const;

export function globalKalenderDatei(ein: {
  terminId: number;
  beginn: Date | string;
  dauerMin?: number;
  ansprechpartner: string;
  telefon?: string | null;
  stornoLink?: string | null;
  erstelltAm?: Date;
  /** SEQUENCE (fiaon_termine.kal_sequenz) — ein verschobenes Gespräch ersetzt den alten Eintrag. */
  sequenz?: number | null;
  sprache?: "de" | "en";
  /** Das Gespräch ist abgesagt: METHOD:CANCEL, SEQUENCE + 1, Veranstalter, ohne Wecker. */
  abgesagt?: boolean;
  /**
   * E-273 (02.10.2026): Das Startgespräch eines Individualangebots (herkunft „individualangebot") heißt im Kalender
   * „Startgespräch", nicht „Erstgespräch" — Titel und Absagesatz aus dem Text des Startgesprächs. Ohne Angabe bleibt
   * jede Datei Byte für Byte, wie sie war.
   */
  start?: { titel: string; abgesagtText: string } | null;
}): string {
  const T0 = GLOBAL_KALENDER_TEXT[ein.sprache === "en" ? "en" : "de"];
  const T = ein.start ? { ...T0, titel: ein.start.titel, abgesagtText: ein.start.abgesagtText } : T0;
  const beginn = typeof ein.beginn === "string" ? new Date(ein.beginn) : ein.beginn;
  const ende = new Date(beginn.getTime() + (ein.dauerMin ?? GLOBAL_DAUER_MIN) * 60_000);
  const beschreibung = [
    T.ruftAn(ein.ansprechpartner, ein.telefon ?? ""),
    T.nichts,
    ein.stornoLink ? `${T.storno} ${ein.stornoLink}` : "",
  ].filter(Boolean).join("\n");
  const e = {
    uid: `global-termin-${ein.terminId}@fiaon.com`,
    stempel: ein.erstelltAm ?? new Date(),
    beginn, ende,
    sequenz: ein.sequenz ?? null,
    titel: T.titel,
    beschreibung,
    ort: ein.sprache === "en" ? "Phone" : "Telefon",
    status: "CONFIRMED" as const,
    alarme: [{ minutenVorher: 15, text: T.titel }],
  };
  if (ein.abgesagt) {
    return icsKalender({
      prodid: "-//FIAON//Global Erstgespraech//DE",
      methode: "CANCEL",
      ereignisse: [{
        ...e, status: "CANCELLED", sequenz: (Number(ein.sequenz) || 0) + 1, alarme: [],
        titel: `${T.abgesagt} – ${T.titel}`, beschreibung: T.abgesagtText,
        veranstalter: { name: "FIAON", mail: "welcome@fiaon.com" },
      }],
    });
  }
  return icsKalender({ prodid: "-//FIAON//Global Erstgespraech//DE", ereignisse: [e] });
}
