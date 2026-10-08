// ═══════════════════════════════════════════════════════════════════════════
// LESEFEHLER — EINE LISTE, EIN SATZ JE KLASSE (E-IT-C, 08.10.2026, Punkt 13)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Jede gescheiterte Lesung endete mit demselben Satz: „auch mit Texterkennung
// nicht lesbar (unscharf, abgeschnitten oder leer)". Passwortschutz, eine
// beschädigte Datei, eine Zeitgrenze der KI, HTTP 400 „invalid_file" und eine
// zu große KI-Anfrage — alles hieß beim Kunden „zu unscharf". Gemessen: Eine
// passwortgeschützte Datei (48 KB, /Encrypt) wurde zweimal gelesen, und der
// Kunde bekam zweimal „zu unscharf". Ein Fehler der Technik wurde so zur Schuld
// des Kunden.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Jede Klasse hat einen Satz für den Kunden (Sie) und einen fürs Office (du).
// Technische Klassen (technisch, ki_pause, zu_gross_fuer_ki) gehen NIE an den
// Kunden: Er sieht „wird geprüft", das Office sieht die Klasse und den Versuch.
// Inhaltliche Klassen stehen beim Kunden an der Kategorie-Karte, direkt neben
// dem Knopf „Datei hinzufügen" (shared/fiaon-unterlagen.ts).
//
// Eine Quelle: Eingangsprüfung (server/lib/fiaon-datei-eingang.ts), Texterkennung
// (fiaon-ocr.ts), Prüfung und Analysen lesen ihre Sätze HIER.
// ═══════════════════════════════════════════════════════════════════════════

export type LeseKlasse =
  | "passwort"
  | "beschaedigt"
  | "leer"
  | "format"
  | "zu_gross"
  | "zu_viele"
  | "akte_zu_gross"
  | "doppelt"
  | "unscharf"
  | "falsche_art"
  | "unvollstaendig"
  | "beschafft"
  | "ausgewertet"
  | "von_hand"
  | "technisch"
  | "ki_pause"
  | "zu_gross_fuer_ki";

/** Gehen NIE an den Kunden — er sieht „wird geprüft", das Office die Klasse. */
export const TECHNISCHE_KLASSEN: readonly LeseKlasse[] = ["technisch", "ki_pause", "zu_gross_fuer_ki", "von_hand"];

export function istTechnisch(k: LeseKlasse | string | null | undefined): boolean {
  return !!k && (TECHNISCHE_KLASSEN as readonly string[]).includes(String(k));
}

export interface LeseKontext {
  /** Dateiname, wie der Mensch ihn gewählt hat. */
  name?: string | null;
  /** „Kontoauszug", „Ausweis" … — die Kategorie, in die hochgeladen wurde. */
  kategorie?: string | null;
  /** Was die Datei stattdessen zu sein scheint („ein Kontoauszug"). */
  erkannt?: string | null;
  /** Was fehlt („die Rückseite Ihres Personalausweises"). */
  fehlt?: string | null;
  /** Technischer Grund (nur Office). */
  detail?: string | null;
  /** Wiederholung n von 3 (nur Office). */
  versuch?: number | null;
  /** Grenzen — aus shared/fiaon-unterlagen.ts. */
  mb?: number | null;
  anzahl?: number | null;
  /**
   * Darf der Kunde DIESE Datei selbst entfernen? Nur dann verspricht der Satz das Entfernen —
   * sonst führt er zum Ansprechpartner (E-IT-C Nachbesserung). Fehlt die Angabe: wie bisher.
   */
  selbstEntfernen?: boolean | null;
}

const namens = (k: LeseKontext): string => (k.name ? `„${k.name}“` : "Die Datei");
const namensKlein = (k: LeseKontext): string => (k.name ? `„${k.name}“` : "die Datei");

const SAETZE: Record<LeseKlasse, { kunde: (k: LeseKontext) => string; office: (k: LeseKontext) => string }> = {
  passwort: {
    kunde: (k) => `${namens(k)} ist mit einem Passwort geschützt — so können wir sie nicht öffnen. Bitte laden Sie sie ohne Passwort hoch: Laden Sie die Umsätze in Ihrem Online-Banking noch einmal als PDF herunter, oder öffnen Sie die Datei mit Ihrem Passwort und speichern Sie sie über „Drucken → Als PDF sichern“ neu. Ihr Passwort brauchen wir nicht.`,
    office: (k) => `${namens(k)} ist mit einem Öffnungspasswort geschützt — nicht gespeichert. Der Kunde muss sie ohne Passwort neu speichern („Drucken → Als PDF sichern“). Nie nach dem Passwort fragen.`,
  },
  beschaedigt: {
    kunde: (k) => `${namens(k)} lässt sich nicht öffnen — sie ist beschädigt oder wurde nicht vollständig übertragen. Bitte speichern Sie sie noch einmal neu und laden Sie sie erneut hoch, oder fotografieren Sie die Seiten.`,
    office: (k) => `${namens(k)} ist beschädigt und lässt sich nicht öffnen — nicht gespeichert.`,
  },
  leer: {
    kunde: (k) => `${namens(k)} ist leer. Bitte prüfen Sie die Auswahl und laden Sie die richtige Datei hoch.`,
    office: (k) => `${namens(k)} ist leer (keine Seiten oder 0 Byte) — nicht gespeichert.`,
  },
  format: {
    kunde: () => "Dieses Dateiformat können wir nicht lesen. Bitte laden Sie eine PDF-Datei oder ein Foto hoch (JPG, PNG oder iPhone-Foto).",
    office: (k) => `Format nicht lesbar${k.detail ? ` (${k.detail})` : ""} — nur PDF und Fotos (JPG, PNG, HEIC, WEBP, TIFF).`,
  },
  zu_gross: {
    kunde: (k) => `${namens(k)} ist größer als ${k.mb ?? 50} MB. Bitte speichern Sie sie kleiner — zum Beispiel die Umsätze direkt als PDF aus dem Online-Banking statt eines Scans — oder laden Sie die Seiten einzeln hoch.`,
    office: (k) => `${namens(k)} ist größer als ${k.mb ?? 50} MB — bitte kleiner speichern oder seitenweise hochladen.`,
  },
  zu_viele: {
    kunde: (k) => `Für ${k.kategorie ?? "diese Unterlage"} liegen schon ${k.anzahl ?? 20} Dateien vor — mehr nehmen wir je Unterlage nicht an. Entfernen Sie bitte, was nicht mehr gebraucht wird, oder schreiben Sie Ihrem Ansprechpartner.`,
    office: (k) => `${k.kategorie ?? "Diese Unterlage"} hat schon ${k.anzahl ?? 20} Dateien — erst eine entfernen.`,
  },
  akte_zu_gross: {
    kunde: (k) => `Zusammen wären die Dateien für ${k.kategorie ?? "diese Unterlage"} größer als ${k.mb ?? 120} MB. Bitte laden Sie kleinere Dateien hoch — ein PDF aus dem Online-Banking ist meist viel kleiner als ein Scan.`,
    office: (k) => `${k.kategorie ?? "Diese Unterlage"} würde zusammen größer als ${k.mb ?? 120} MB — kleinere Dateien nehmen oder alte entfernen.`,
  },
  doppelt: {
    kunde: (k) => `${namens(k)} liegt uns schon vor — Sie müssen sie nicht noch einmal hochladen.`,
    office: (k) => `${namens(k)} liegt schon vor (gleiche Datei) — nicht doppelt abgelegt.`,
  },
  unscharf: {
    kunde: (k) => `Auf ${namensKlein(k)} konnten wir keinen Text erkennen — sie ist vermutlich unscharf, abgeschnitten oder zu dunkel. Bitte fotografieren Sie jede Seite gerade, scharf und vollständig, oder laden Sie das PDF aus dem Online-Banking hoch.`,
    office: (k) => `${namens(k)}: auch mit Texterkennung kein Text — unscharf, abgeschnitten oder leer. Bitte von Hand ansehen.`,
  },
  falsche_art: {
    kunde: (k) => `Diese Datei sieht aus wie ${k.erkannt ?? "eine andere Unterlage"} — hochgeladen wurde sie als ${k.kategorie ?? "diese Unterlage"}. Bitte prüfen Sie die Auswahl; ${k.selbstEntfernen === false ? "schreiben Sie kurz Ihrem Ansprechpartner, dann nehmen wir die falsche Datei heraus." : "die falsche Datei können Sie hier selbst entfernen."}`,
    office: (k) => `${namens(k)} sieht aus wie ${k.erkannt ?? "eine andere Unterlage"}, liegt aber unter ${k.kategorie ?? "dieser Unterlage"}.`,
  },
  unvollstaendig: {
    kunde: (k) => `Es fehlt noch ${k.fehlt ?? "ein Teil"}. Laden Sie es einfach dazu — Ihre bisherigen Dateien bleiben.`,
    office: (k) => `Unvollständig — es fehlt ${k.fehlt ?? "ein Teil"}.`,
  },
  beschafft: {
    kunde: () => "Ihre Bonitätsauskunft hat FIAON für Sie beschafft — sie liegt bereits in Ihrer Akte. Möchten Sie uns eine weitere Auskunft zeigen, laden Sie sie bitte unter „Weitere Unterlagen → Sonstiges“ hoch.",
    office: () => "Hier liegt eine von FIAON beschaffte Auskunft — der Kunde lädt eigene Auskünfte unter „Weitere Unterlagen“.",
  },
  // E-IT-C Nachbesserung: Eine schon geprüfte oder ausgewertete Auskunft bekommt vom Kunden keine Datei mehr
  // dazu — sonst würde die Auswertung auf eine Mischdatei neu gerechnet (und ein Löschantrag-Vermerk ginge verloren).
  ausgewertet: {
    kunde: () => "Ihre Bonitätsauskunft ist bereits geprüft bzw. ausgewertet. Möchten Sie uns eine neuere Auskunft zeigen, laden Sie sie bitte unter „Weitere Unterlagen → Sonstiges“ hoch.",
    office: () => "Die Auskunft ist schon geprüft bzw. ausgewertet — der Kunde lädt weitere Auskünfte unter „Weitere Unterlagen“. Hängst du an, wertet erst „Neu lesen“ die neue Fassung aus.",
  },
  von_hand: {
    kunde: () => "Liegt bei uns — wir sehen sie uns an.",
    office: (k) => `${namens(k)}: ${k.detail ?? "wird nicht automatisch gelesen"} — bitte von Hand ansehen.`,
  },
  technisch: {
    kunde: () => "Liegt bei uns — wir prüfen sie und melden uns.",
    office: (k) => `Technischer Fehler beim Lesen${k.detail ? ` (${k.detail})` : ""}${k.versuch ? ` — Versuch ${k.versuch}/3` : ""}${k.versuch && k.versuch >= 3 ? ", bitte von Hand ansehen" : " — wird automatisch wiederholt"}.`,
  },
  ki_pause: {
    kunde: () => "Liegt bei uns — wir prüfen sie und melden uns.",
    office: () => "Lesen wartet — die KI ist pausiert. Wird nach dem Aktivieren automatisch nachgeholt.",
  },
  zu_gross_fuer_ki: {
    kunde: () => "Liegt bei uns — wir prüfen sie und melden uns.",
    office: (k) => `${namens(k)}: eine Seite ist zu groß für die Texterkennung — bitte von Hand ansehen.`,
  },
};

/** Der Satz zu einer Klasse — „sie" für den Kunden, „du" fürs Office. */
export function lesefehlerSatz(klasse: LeseKlasse, anrede: "sie" | "du", k: LeseKontext = {}): string {
  const s = SAETZE[klasse] ?? SAETZE.technisch;
  return anrede === "sie" ? s.kunde(k) : s.office(k);
}

/** Alle Kundensätze mit Musterwerten — für den Prüfstand (Wortwand, Sie-Form). */
export function alleKundenSaetze(): string[] {
  const muster: LeseKontext = { name: "auszug.pdf", kategorie: "Kontoauszug", erkannt: "ein Kontoauszug", fehlt: "der Monat August", mb: 50, anzahl: 20 };
  return (Object.keys(SAETZE) as LeseKlasse[]).map((k) => SAETZE[k].kunde(muster));
}

/** Ein Lesefehler mit Klasse — wirft die Eingangsprüfung, die Texterkennung und die Bindung. */
export class LeseFehler extends Error {
  readonly klasse: LeseKlasse;
  readonly detail: string | null;
  constructor(klasse: LeseKlasse, detail?: string | null) {
    super(`Lesefehler ${klasse}${detail ? `: ${detail}` : ""}`);
    this.name = "LeseFehler";
    this.klasse = klasse;
    this.detail = detail ?? null;
  }
}

export function istLeseFehler(e: unknown): e is LeseFehler {
  return !!e && typeof e === "object" && (e as any).name === "LeseFehler" && typeof (e as any).klasse === "string";
}
