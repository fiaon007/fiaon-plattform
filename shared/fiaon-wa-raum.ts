// ═══════════════════════════════════════════════════════════════════════════
// DER WHATSAPP-RAUM — REGELN AN EINER STELLE (E-IT-H, 08.10.2026, Punkt 15)
//
// Rückmeldung aus dem Team: „Der WhatsApp-Raum ist viel zu klein und
// unübersichtlich." GEMESSEN (it-feedback, Gruppe h):
// · Die Office-Hülle deckelte allen Inhalt auf 1440 px (bei 87,5 % Zoom also
//   1260 Bildschirm-px) — bei Full HD blieb ein Drittel der Breite leer, der
//   Chat bekam 450 px.
// · Die Höhe wurde per JS gemessen und ging an Köpfe, Telefon- und
//   Rundgangknopf verloren (am 1366er-Laptop rund 370 px Verlauf = zwei bis
//   drei Mara-Nachrichten).
// · Die Liste holte die 300 jüngsten Nummern des GANZEN Hauses und filterte
//   erst danach nach Betreuer, Filter und Suche. Nach Maras Vorlagenläufen
//   (06.10.: 367 Vorlagen) reichte sie 32 Stunden zurück — 135 von 245
//   Gesprächen, in denen ein Kunde geschrieben hatte, standen für niemanden
//   in der Liste und waren auch per Suche nicht zu finden.
//
// Justins Entscheidung (08.10.2026): Der Raum füllt den Bildschirm (Vollhöhe,
// flexible Spalten, Liste und Akte einklappbar, größere Schrift und Blasen,
// mehrzeiliges Feld, Breakpoints). Die Office-Verkleinerung auf 87,5 % bleibt,
// der Raum gleicht über größere Schrift aus. Die Liste startet mit „Mit
// Antwort" (Gespräche, in denen der Kunde geschrieben hat); „Alle" ist ein
// Klick.
//
// Hier stehen die Regeln, die Oberfläche UND Server brauchen — kein zweiter
// Satz Schwellen, Filter oder Grenzen an anderer Stelle.
// ═══════════════════════════════════════════════════════════════════════════

// ── Filter der Gesprächsliste ───────────────────────────────────────────────
export type ListenFilter = "antwort" | "alle" | "ungelesen" | "offen";

export const LISTEN_FILTER: readonly { wert: ListenFilter; text: string; titel: string }[] = [
  { wert: "antwort", text: "Mit Antwort", titel: "Gespräche, in denen der Kunde selbst geschrieben hat" },
  { wert: "alle", text: "Alle", titel: "Auch Gespräche, in denen bisher nur wir geschrieben haben (z. B. Maras Vorlagen)" },
  { wert: "ungelesen", text: "Ungelesen", titel: "Gespräche mit Nachrichten des Kunden, die noch niemand geöffnet hat" },
  { wert: "offen", text: "Fenster offen", titel: "Der Kunde hat in den letzten 24 Stunden geschrieben — frei schreiben ist möglich" },
];

/** Justin, 08.10.2026: Die Liste startet mit „Mit Antwort". */
export const STANDARD_FILTER: ListenFilter = "antwort";

/**
 * Was der Server aus `?filter=` liest. Leer oder unbekannt heißt „alle" — so
 * bekommt eine ältere Oberfläche (sie schickte für „Alle" ein leeres Feld)
 * während eines Deploys dieselbe Liste wie vorher.
 */
export function filterLesen(roh: unknown): ListenFilter {
  const f = String(roh ?? "").trim();
  return f === "antwort" || f === "ungelesen" || f === "offen" ? f : "alle";
}

/**
 * Der Filter, der WIRKLICH gilt — Oberfläche und Server fragen dieselbe Regel.
 *
 * E-IT-H (Gegenprüfung 08.10.2026): Eine Suche läuft über ALLE eigenen
 * Gespräche. „Mit Antwort" ist nur die Startansicht, kein Suchfilter. In der
 * Produktion hatten 749 von 997 Nummern keine Kundenantwort; im Standard fand
 * die Suche sie nicht („Nichts gefunden", kein Knopf), und wer den Kunden nicht
 * fand, begann über „+" ein neues Gespräch — mit einer weiteren, bezahlten
 * Vorlage an denselben Menschen. „Ungelesen" und „Fenster offen" wählt man
 * dagegen bewusst; sie gelten auch beim Suchen (die leere Liste bietet dann
 * „In allen Gesprächen suchen").
 */
export function wirksamerFilter(filter: unknown, suche: unknown): ListenFilter {
  const f = filterLesen(filter);
  return f === "antwort" && String(suche ?? "").trim() !== "" ? "alle" : f;
}

// ── Wie viele Gespräche die Liste lädt ──────────────────────────────────────
/** Start 200, „Ältere Gespräche laden" holt je 200 dazu, höchstens 1.000. */
export const LISTE_GRENZE = { start: 200, schritt: 200, min: 50, max: 1000 } as const;

export function listenGrenze(roh: unknown): number {
  const n = Math.floor(Number(roh));
  if (!Number.isFinite(n) || n <= 0) return LISTE_GRENZE.start;
  return Math.min(LISTE_GRENZE.max, Math.max(LISTE_GRENZE.min, n));
}

/**
 * Was am Ende der Liste steht. Gegenprüfung (08.10.2026): An der Höchstgrenze
 * meldet der Server weiter „mehr", ein Klick auf „Ältere Gespräche laden"
 * änderte aber nichts (min(1000, 1200) = 1000) — ein toter Knopf. Dort steht
 * jetzt der Weg über die Suche.
 */
export function listenEnde(mehr: unknown, grenze: number): "mehr" | "gekappt" | "ende" {
  if (!mehr) return "ende";
  return grenze < LISTE_GRENZE.max ? "mehr" : "gekappt";
}

/**
 * Die Vorschau in der Liste ist EINE Zeile. Der volle Text (Mara-Median 278
 * Zeichen, p90 521) wird deshalb serverseitig gekürzt — bei bis zu 1.000
 * Zeilen und dem 8-Sekunden-Takt spart das den größten Teil der Antwort.
 */
export const VORSCHAU_ZEICHEN = 240;

export function vorschauKuerzen(text: unknown, max = VORSCHAU_ZEICHEN): string {
  const t = String(text ?? "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

// ── Suche ───────────────────────────────────────────────────────────────────
/**
 * Volltext über ALLE Nachrichten erst ab vier Zeichen: Bei „sen" fanden sich
 * gemessen 286 statt 176 Gespräche, und Namenstreffer gingen unter. Name und
 * Nummer werden deshalb immer gesucht und stehen vorn; der Text kommt ab vier
 * Zeichen dazu.
 */
export const VOLLTEXT_AB = 4;
/** Nummernsuche ab vier Ziffern — „15" träfe fast jede deutsche Handynummer. */
export const ZIFFERN_AB = 4;
export const SUCHE_HOECHSTENS = 80;

/** LIKE-Sonderzeichen entschärfen: „100%" sucht nach „100%", nicht nach allem. */
export function likeMaskieren(s: string): string {
  return s.replace(/[\\%_]/g, (z) => `\\${z}`);
}

export interface RaumSuche {
  /** Getrimmter Suchtext (höchstens 80 Zeichen), leer = keine Suche. */
  text: string;
  /** ILIKE-Muster „%…%" mit entschärften Sonderzeichen, null ohne Suche. */
  muster: string | null;
  /** Ziffernmuster für die Nummer (leer unter vier Ziffern); „0151…" sucht auch „49151…". */
  ziffern: string[];
  /** Auch in den Nachrichtentexten suchen? */
  volltext: boolean;
}

export function sucheZerlegen(roh: unknown): RaumSuche {
  const text = String(roh ?? "").trim().slice(0, SUCHE_HOECHSTENS);
  if (!text) return { text: "", muster: null, ziffern: [], volltext: false };
  const nurZiffern = text.replace(/\D/g, "");
  const ziffern: string[] = [];
  // Nur wenn der Suchtext wirklich eine Nummer ist (Ziffern, Plus, Leer- und Trennzeichen) —
  // „Rate 2" ist keine Nummernsuche.
  if (nurZiffern.length >= ZIFFERN_AB && /^[\d\s+()\-/.]+$/.test(text)) {
    ziffern.push(nurZiffern);
    if (nurZiffern.startsWith("00")) ziffern.push(nurZiffern.slice(2));
    else if (nurZiffern.startsWith("0")) ziffern.push(`49${nurZiffern.slice(1)}`);
  }
  return {
    text,
    muster: `%${likeMaskieren(text)}%`,
    ziffern: Array.from(new Set(ziffern.filter((z) => z.length >= ZIFFERN_AB))),
    volltext: text.length >= VOLLTEXT_AB,
  };
}

// ── Direktsprung: /agent/whatsapp?nummer=… ──────────────────────────────────
/** Eine Nummer, wie der Raum sie führt: nur Ziffern, 8 bis 15 Stellen, ohne Plus. */
export function raumNummer(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/[\s\-()/.]/g, "").replace(/^\+/, "");
  return /^[1-9]\d{7,14}$/.test(s) ? s : null;
}

/** Die Nummer aus der Adresszeile (`?nummer=`), sonst null. */
export function nummerAusAdresse(search: string | null | undefined): string | null {
  try {
    return raumNummer(new URLSearchParams(String(search ?? "")).get("nummer"));
  } catch {
    return null;
  }
}

export type RaumTuer = "agent" | "chef";

/** Der Weg in den Raum — mit Nummer direkt ins Gespräch (Akte, Aufgaben, Maras Übergaben). */
export function raumPfad(tuer: RaumTuer, nummer?: unknown): string {
  const basis = tuer === "chef" ? "/chef/s/whatsapp" : "/agent/whatsapp";
  const n = raumNummer(nummer);
  return n ? `${basis}?nummer=${n}` : basis;
}

/** Eine Raum-Adresse (Office oder Chefbüro) → die Nummer darin, sonst null. */
export function nummerAusRaumPfad(pfad: unknown): string | null {
  const m = String(pfad ?? "").match(/^\/(?:agent|chef\/s)\/whatsapp\?(.*)$/);
  return m ? nummerAusAdresse(`?${m[1]}`) : null;
}

// ── Aufteilung des Raums ────────────────────────────────────────────────────
/**
 * Die Schwellen gelten für die Breite des RAUMS in CSS-px (Container Queries
 * in whatsapp-raum.css nutzen dieselben Zahlen):
 *   unter  760  Handy: die Liste; ein offenes Gespräch ist eine Vollfläche
 *   ab     760  Liste (voll oder als Schiene) · Chat; der Fall als Schublade
 *   ab    1100  dazu die Fall-Spalte rechts — von selbst an ab 1400, sonst aus;
 *               die Wahl des Mitarbeiters gilt (der Browser merkt sie sich)
 *   ab    1500  Schrift × 1,06 (nur CSS)
 */
export const RAUM_MASSE = { mittelAb: 760, breitAb: 1100, fallVonSelbstAb: 1400, grossAb: 1500 } as const;

export type RaumModus = "breit" | "mittel" | "schmal";

export function raumModus(breite: number): RaumModus {
  return breite >= RAUM_MASSE.breitAb ? "breit" : breite >= RAUM_MASSE.mittelAb ? "mittel" : "schmal";
}

/** Was der Mitarbeiter für sich eingestellt hat — je Browser, nie Personendaten. */
export interface RaumAnsicht {
  liste: "voll" | "schmal";
  /** null = nicht selbst gewählt, dann entscheidet die Breite (ab 1400 an). */
  fall: boolean | null;
  schrift: "normal" | "gross";
}

export const ANSICHT_SCHLUESSEL = "fiaon_wa_ansicht";
export const ANSICHT_STANDARD: RaumAnsicht = { liste: "voll", fall: null, schrift: "normal" };

/** Aus localStorage (oder Müll) eine gültige Ansicht machen. */
export function ansichtLesen(roh: unknown): RaumAnsicht {
  const o = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  return {
    liste: o.liste === "schmal" ? "schmal" : "voll",
    fall: o.fall === true ? true : o.fall === false ? false : null,
    schrift: o.schrift === "gross" ? "gross" : "normal",
  };
}

export interface RaumAufteilung {
  modus: RaumModus;
  /** Die Liste als schmale Schiene (Bild, Ungelesen-Zahl) — nie am Handy. */
  listeSchmal: boolean;
  /** Der Fall als eigene Spalte rechts; sonst als Schublade über dem Verlauf. */
  fallSpalte: boolean;
}

export function raumAufteilung(breite: number, ansicht: RaumAnsicht): RaumAufteilung {
  const modus = raumModus(breite);
  return {
    modus,
    listeSchmal: modus !== "schmal" && ansicht.liste === "schmal",
    fallSpalte: modus === "breit" && (ansicht.fall ?? breite >= RAUM_MASSE.fallVonSelbstAb),
  };
}

/**
 * Das Eingabefeld wächst mit — bis 36 % der Chathöhe, höchstens 320 CSS-px (am großen
 * Bildschirm rund zwölf Zeilen), dann rollt es. Eingabe.tsx rechnet damit; whatsapp-raum.css
 * trägt dieselben Zahlen als max-height: min(36cqh, 320px).
 */
export const FELD_ANTEIL_CHAT = 0.36;
export const FELD_HOECHSTENS_PX = 320;

/** Schrift „größer" je Mitarbeiter (× 1,15) — zusätzlich zur größeren Grundschrift. */
export const SCHRIFT_GROSS_FAKTOR = 1.15;
