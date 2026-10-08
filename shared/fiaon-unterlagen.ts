// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN: EINE DATEI IST EIN DATENSATZ (E-IT-C, 08.10.2026, Punkt 3 + 13)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Jede Unterlage war EINE Spalte (bank_statement_pdf, id_card_pdf, schufa_pdf),
// jeder Upload ERSETZTE sie. Deshalb blendeten beide Kundenbereiche das Feld aus,
// sobald etwas vorlag — sonst hätte der Kunde seine eigene Unterlage
// überschrieben. Gleichzeitig bat die automatische Prüfung „laden Sie den
// vollständigen Zeitraum nach" (56 Fälle): eine Sackgasse. „Zu groß" war immer
// die Einzeldatei über 25 MB; „Weitere Unterlagen" gab es nicht.
//
// ── DIE REGEL (Entscheidung Justin, 08.10.2026) ───────────────────────────
// · Jede Datei ist eine Zeile in fiaon_dokumente (art 'unterlage', kategorie,
//   unterart). Die Spalte an der Bestellung bleibt — als GEBUNDENE Akte-Fassung
//   aller aktiven Dateien einer Kategorie. Alle Leser der Spalten (Karte-Tor,
//   Kundenstufe, Rahmenweg, Analysen, Prüfung, DSGVO) bleiben unverändert.
// · Hinzufügen statt Ersetzen. 50 MB je Datei, 20 Dateien je Kategorie.
// · „Weitere Unterlagen": Aufenthaltstitel · Einkommensnachweis ·
//   Bescheid/Bescheinigung · Sonstiges — wird nicht gebunden.
// · Der Kunde entfernt eigene Dateien selbst, solange die Verwaltung sie noch
//   nicht geprüft hat (darfKundeEntfernen).
// · Fotos werden auf der längsten Kante auf 2.400 px verkleinert, das Original
//   wird nicht zusätzlich gespeichert.
// · Je Kategorie EIN Stand für Kunde und Mitarbeiter: liegt vor / fehlt /
//   wird geprüft / bitte neu (kategorieStatus).
// · Ausweis (Punkt 13): Reisepass — die Datenseite genügt. Personalausweis —
//   Vorder- und Rückseite. Ein Aufenthaltstitel gilt NUR zusammen mit dem
//   Reisepass (ausweisBewerten). Ausweisbilder gehen an keine KI.
//
// Diese Datei ist die EINE Quelle für Regeln und Texte: Server (fiaon-unterlagen.ts),
// Kundenbereich (UnterlagenListe.tsx) und Akte (UnterlagenAkte.tsx) lesen hier.
// ═══════════════════════════════════════════════════════════════════════════

export type UnterlagenKategorie = "kontoauszug" | "ausweis" | "schufa" | "weitere";
/** Die drei Kategorien, die als gebundene Akte-Fassung in einer Spalte stehen. */
export type GebundeneKategorie = Exclude<UnterlagenKategorie, "weitere">;

export const UNTERLAGEN_GRENZEN = {
  /** Je Datei (Entscheidung Justin 08.10.). */
  mbJeDatei: 50,
  bytesJeDatei: 50 * 1024 * 1024,
  /** Aktive Dateien je Kategorie. */
  dateienJeKategorie: 20,
  /**
   * Die gebundene Akte-Fassung einer Kategorie (eine BYTEA-Spalte). Ohne Deckel
   * wüchse sie auf 20 × 50 MB — und mehrere Routen laden die Zeile ganz.
   */
  mbAkteFassung: 120,
  /** Längste Kante eines gespeicherten Fotos (Entscheidung Justin 08.10.). */
  bildKante: 2400,
  jpegQualitaet: 82,
  /** Fotos über dieser Größe verkleinert schon der Browser (spart Datenvolumen am Handy). */
  clientVerkleinernAbMb: 3,
  /** Eine Anfrage trägt GENAU eine Datei — Reserve für die multipart-Rahmen und Felder. */
  anfrageReserveBytes: 256 * 1024,
  /** Drossel Kundenweg: Dateien je zehn Minuten und Person. */
  uploadsJeZehnMinuten: 30,
  /** Wie lange der Kundenbereich nach einem Upload auf den Befund wartet (s). */
  befundWartenSekunden: 180,
} as const;

export interface KategorieInfo {
  kategorie: UnterlagenKategorie;
  /** Titel im Kundenbereich. */
  titel: string;
  /** Kurzname im Office („Kontoauszug"). */
  kurz: string;
  /** Pflicht für den Kunden? Die Auskunft beschafft FIAON — der eigene Upload ist der kleine zweite Weg. */
  pflicht: boolean;
  /** Was gebraucht wird — Sie-Form, unter dem Titel. */
  hinweisKunde: string;
  /** Wofür die Kategorie im Office steht. */
  hinweisOffice: string;
}

export const UNTERLAGEN_KATEGORIEN: readonly KategorieInfo[] = [
  {
    kategorie: "kontoauszug", titel: "Kontoauszug", kurz: "Kontoauszug", pflicht: true,
    hinweisKunde: "Die letzten drei Monate, alle Seiten — als PDF aus dem Online-Banking oder als Foto je Seite. Fehlt ein Monat, laden Sie ihn einfach dazu.",
    hinweisOffice: "Girokonto, letzte drei Monate. Mehrere Dateien werden zur Akte-Fassung gebunden.",
  },
  {
    kategorie: "ausweis", titel: "Ausweis oder Reisepass", kurz: "Ausweis", pflicht: true,
    hinweisKunde: "Personalausweis: Vorder- und Rückseite. Reisepass: die Seite mit Ihrem Foto und Ihren Daten. Alle vier Ecken im Bild.",
    hinweisOffice: "Personalausweis vorn + hinten oder Reisepass (Datenseite). Aufenthaltstitel nur zusammen mit Reisepass.",
  },
  {
    kategorie: "schufa", titel: "Eigene Bonitätsauskunft", kurz: "Bonitätsauskunft", pflicht: false,
    hinweisKunde: "Nur falls Sie schon eine haben: die vollständige Auskunft der Auskunftei, alle Seiten. Ein Foto der Score-Anzeige aus einer App können wir nicht verwenden.",
    hinweisOffice: "Auskunft einer Auskunftei (alle Seiten). Eine von FIAON beschaffte Auskunft steht hier mit Herkunft „beschafft“.",
  },
  {
    kategorie: "weitere", titel: "Weitere Unterlagen", kurz: "Weitere Unterlagen", pflicht: false,
    hinweisKunde: "Optional: Aufenthaltstitel, Einkommensnachweis, Bescheid oder Bescheinigung — was Ihr Ansprechpartner bei Ihnen angefragt hat. Bitte keine Gesundheitsunterlagen (z. B. Atteste, Befunde) — die brauchen wir nicht.",
    hinweisOffice: "Aufenthaltstitel, Einkommensnachweis, Bescheid/Bescheinigung, Sonstiges. Wird nicht gebunden und zählt nicht als Ausweis.",
  },
];

export const WEITERE_UNTERARTEN = [
  { wert: "aufenthaltstitel", label: "Aufenthaltstitel" },
  { wert: "einkommensnachweis", label: "Einkommensnachweis" },
  { wert: "bescheinigung", label: "Bescheid/Bescheinigung" },
  { wert: "sonstiges", label: "Sonstiges" },
] as const;
export type WeitereUnterart = (typeof WEITERE_UNTERARTEN)[number]["wert"];

/** Welches Ausweisdokument der Mensch hochlädt — er wählt es selbst (Fotos liest keine KI). */
export const AUSWEIS_ARTEN = [
  { wert: "personalausweis", label: "Personalausweis", hinweis: "Vorder- und Rückseite" },
  { wert: "reisepass", label: "Reisepass", hinweis: "die Seite mit Foto und Daten" },
] as const;
export type AusweisArt = (typeof AUSWEIS_ARTEN)[number]["wert"];

export function istUnterlagenKategorie(v: unknown): v is UnterlagenKategorie {
  return UNTERLAGEN_KATEGORIEN.some((k) => k.kategorie === v);
}
export function istGebunden(k: UnterlagenKategorie): k is GebundeneKategorie {
  return k !== "weitere";
}
export function kategorieInfo(k: UnterlagenKategorie): KategorieInfo {
  return UNTERLAGEN_KATEGORIEN.find((x) => x.kategorie === k) ?? UNTERLAGEN_KATEGORIEN[0];
}
/** Die erlaubte Unterart je Kategorie — alles andere wird NULL. */
export function unterartSauber(k: UnterlagenKategorie, v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (k === "weitere") return WEITERE_UNTERARTEN.some((u) => u.wert === s) ? s : "sonstiges";
  if (k === "ausweis") return AUSWEIS_ARTEN.some((u) => u.wert === s) ? s : null;
  return null;
}
export function unterartLabel(k: UnterlagenKategorie, v: string | null | undefined): string | null {
  if (!v) return null;
  if (k === "weitere") return WEITERE_UNTERARTEN.find((u) => u.wert === v)?.label ?? null;
  if (k === "ausweis") return AUSWEIS_ARTEN.find((u) => u.wert === v)?.label ?? null;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Der Befund je Datei (fiaon_dokumente.lese_befund) — Eingangsprüfung + Sofortblick
// ───────────────────────────────────────────────────────────────────────────
export interface DateiBefund {
  /** Gespeicherter Typ (nach der Wandlung). */
  typ: "pdf" | "jpg" | "png";
  /** Was hochgeladen wurde, wenn es gewandelt wurde (heic, webp, tiff, gif). */
  ausTyp?: string | null;
  seiten: number;
  /** Seiten mit Textschicht / ohne (Fotos, Scans). */
  textseiten: number;
  fotoseiten: number;
  /** Von der Bank verschlüsselt, ohne Öffnungspasswort (Rechteschutz). */
  geschuetzt: boolean;
  /** Bild verkleinert (vorher → nachher, KB). */
  verkleinert?: { vonKb: number; aufKb: number } | null;
  /** Sofortblick auf die Textschicht dieser einen Datei. */
  erkannt?: boolean | null;
  /** Sieht stattdessen aus wie … */
  aehnlich?: UnterlagenKategorie | null;
  zeitraumVon?: string | null;
  zeitraumBis?: string | null;
  ausweis?: AusweisTextBefund | null;
}

/** Was die Textschicht eines Ausweisdokuments verrät (Wortlisten, MRZ-Art). */
export interface AusweisTextBefund {
  pass: boolean;
  vorne: boolean;
  hinten: boolean;
  aufenthaltstitel: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Ausweis: die Regel (Punkt 13) — rein, ohne KI
// ───────────────────────────────────────────────────────────────────────────
export interface AusweisEingabe {
  /** Die vom Menschen gewählte Art je aktiver Datei (null = nicht gewählt, z. B. Altbestand). */
  erklaert: (string | null)[];
  /** Vereinigung der Textbefunde aller Dateien; null = keine Textschicht (Fotos). */
  text: AusweisTextBefund | null;
  /** Seiten insgesamt (alle aktiven Dateien). */
  seiten: number;
  /** Liegt unter „Weitere Unterlagen" ein Aufenthaltstitel? */
  aufenthaltstitelUnterWeitere?: boolean;
}

export interface AusweisUrteil {
  /** Ist es ein Ausweisdokument? null = nicht beurteilbar (Foto ohne Text, nichts gewählt). */
  erkannt: boolean | null;
  vollstaendig: boolean | null;
  fehlt: string[];
  /** Nur bei SICHEREM Befund — sonst null. */
  hinweisKunde: string | null;
  hinweisIntern: string;
  art: "personalausweis" | "reisepass" | "aufenthaltstitel" | null;
}

export const AUSWEIS_SAETZE = {
  rueckseite: "Es fehlt noch die Rückseite Ihres Personalausweises. Laden Sie sie einfach dazu — die Vorderseite bleibt.",
  vorderseite: "Es fehlt noch die Vorderseite Ihres Personalausweises (die Seite mit Ihrem Foto). Laden Sie sie einfach dazu.",
  einSeiteFoto: "Ihr Personalausweis ist angekommen. Sind Vorder- und Rückseite auf demselben Bild? Dann ist alles da — sonst laden Sie die Rückseite bitte dazu.",
  aufenthaltstitel: "Ein Aufenthaltstitel gilt bei uns nur zusammen mit Ihrem Reisepass. Bitte laden Sie zusätzlich die Datenseite Ihres Reisepasses hoch.",
} as const;

export function ausweisBewerten(e: AusweisEingabe): AusweisUrteil {
  const erklaert = e.erklaert.filter(Boolean) as string[];
  const t = e.text;
  // E-IT-C Nachbesserung (08.10.2026): Die WAHL des Menschen liefert höchstens die Art, nie
  // „erkannt" oder „vollständig" — sonst stand jedes Foto unter „Reisepass hinzufügen" (auch ein
  // Aufenthaltstitel, ein leeres Bild) sofort als „liegt vor" da. Bestätigt ist ein Reisepass nur
  // über die Textschicht (Wortliste oder MRZ „P<"). Und ein erkannter Aufenthaltstitel schlägt
  // eine gewählte Art: Ein eAT unter „Personalausweis" ist kein Personalausweis.
  const passText = !!t?.pass;
  const passErklaert = erklaert.includes("reisepass");
  const titelText = !!t?.aufenthaltstitel;
  const pa = (erklaert.includes("personalausweis") && !titelText) || !!(t && (t.vorne || t.hinten) && !t.pass && !t.aufenthaltstitel);
  const titel = titelText || erklaert.includes("aufenthaltstitel");
  const s = (n: number) => `${n} Seite${n === 1 ? "" : "n"}`;

  // 1. Reisepass (durch die Textschicht bestätigt): die Datenseite genügt (Entscheidung Justin 08.10.).
  if (passText) {
    return { erkannt: true, vollstaendig: true, fehlt: [], hinweisKunde: null, art: "reisepass",
      hinweisIntern: `Reisepass${titel || e.aufenthaltstitelUnterWeitere ? " (mit Aufenthaltstitel)" : ""} — Datenseite genügt (${s(e.seiten)}).` };
  }
  // 2. Aufenthaltstitel ohne bestätigten Reisepass: gilt nicht als Ausweis.
  if (titel && !pa) {
    if (passErklaert) {
      // Ein Reisepass ist nur gewählt (Foto): ob die Datenseite dabei ist, sieht nur ein Mensch.
      return { erkannt: null, vollstaendig: null, fehlt: [], hinweisKunde: null, art: "reisepass",
        hinweisIntern: `Aufenthaltstitel erkannt, Reisepass nur laut Angabe (${s(e.seiten)}) — die Datenseite des Reisepasses bitte von Hand ansehen.` };
    }
    return { erkannt: true, vollstaendig: false, fehlt: ["Reisepass (Datenseite)"], hinweisKunde: AUSWEIS_SAETZE.aufenthaltstitel, art: "aufenthaltstitel",
      hinweisIntern: "Aufenthaltstitel ohne Reisepass — gilt nur zusammen mit dem Reisepass." };
  }
  // 3. Personalausweis mit lesbarer Textschicht: die Seiten sind sicher zuzuordnen.
  if (t && (t.vorne || t.hinten)) {
    if (t.vorne && t.hinten) {
      return { erkannt: true, vollstaendig: true, fehlt: [], hinweisKunde: null, art: "personalausweis",
        hinweisIntern: `Personalausweis, Vorder- und Rückseite (${s(e.seiten)}).` };
    }
    if (t.vorne) {
      return { erkannt: true, vollstaendig: false, fehlt: ["Rückseite des Personalausweises"], hinweisKunde: AUSWEIS_SAETZE.rueckseite, art: "personalausweis",
        hinweisIntern: `Personalausweis: nur die Vorderseite erkannt (${s(e.seiten)}) — Rückseite fehlt.` };
    }
    return { erkannt: true, vollstaendig: false, fehlt: ["Vorderseite des Personalausweises"], hinweisKunde: AUSWEIS_SAETZE.vorderseite, art: "personalausweis",
      hinweisIntern: `Personalausweis: nur die Rückseite erkannt (${s(e.seiten)}) — Vorderseite fehlt.` };
  }
  // 4. Fotos ohne Text: Ausweisbilder liest keine KI — die Seitenzahl ist alles, was wir wissen.
  if (passErklaert) {
    return { erkannt: null, vollstaendig: null, fehlt: [], hinweisKunde: null, art: "reisepass",
      hinweisIntern: `Reisepass laut Angabe, als Foto (${s(e.seiten)}) — die Datenseite bitte von Hand ansehen.` };
  }
  if (pa) {
    if (e.seiten >= 2) {
      return { erkannt: null, vollstaendig: null, fehlt: [], hinweisKunde: null, art: "personalausweis",
        hinweisIntern: `Personalausweis als Foto (${s(e.seiten)}) — Vorder- und Rückseite bitte von Hand ansehen.` };
    }
    return { erkannt: null, vollstaendig: null, fehlt: ["Möglicherweise die Rückseite"], hinweisKunde: AUSWEIS_SAETZE.einSeiteFoto, art: "personalausweis",
      hinweisIntern: "Personalausweis als ein Foto — Rückseite bitte von Hand prüfen." };
  }
  return { erkannt: null, vollstaendig: null, fehlt: [], hinweisKunde: null, art: null,
    hinweisIntern: `Ausweisdokument als Foto (${s(e.seiten)}) — Art nicht gewählt, bitte von Hand ansehen.` };
}

// ───────────────────────────────────────────────────────────────────────────
// Kontoauszug: die Monatsleiste
// ───────────────────────────────────────────────────────────────────────────
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MS_TAG = 86_400_000;

/** „2026-07-31" → Tagesnummer (UTC), sonst null. */
function tagNr(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_TAG);
}

/**
 * Die letzten drei VOLLEN Monate vor dem Monat von `heute` (Berliner Kalender,
 * `heute` als „JJJJ-MM-TT"). Ein Monat ist „da", wenn die Zeiträume aller
 * Dateien mindestens 14 seiner Tage abdecken — ein Auszug beginnt mit der
 * ersten Buchung, nicht am Ersten.
 */
export function monateLeiste(zeitraeume: { von: string | null; bis: string | null }[], heute: string): { monat: string; label: string; da: boolean }[] {
  const [j, m] = heute.slice(0, 7).split("-").map(Number);
  const aus: { monat: string; label: string; da: boolean }[] = [];
  const spannen = zeitraeume
    .map((z) => ({ von: tagNr(z.von), bis: tagNr(z.bis) }))
    .filter((z): z is { von: number; bis: number } => z.von != null && z.bis != null && z.bis >= z.von);
  for (let k = 3; k >= 1; k--) {
    const d = new Date(Date.UTC(j, m - 1 - k, 1));
    const jahr = d.getUTCFullYear(); const mon = d.getUTCMonth();
    const anfang = Math.round(d.getTime() / MS_TAG);
    const ende = Math.round(Date.UTC(jahr, mon + 1, 0) / MS_TAG);
    let gedeckt = 0;
    for (let t = anfang; t <= ende; t++) if (spannen.some((s) => s.von <= t && t <= s.bis)) gedeckt++;
    aus.push({ monat: `${jahr}-${String(mon + 1).padStart(2, "0")}`, label: MONATE[mon], da: gedeckt >= 14 });
  }
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// Der Stand je Kategorie — EINE Regel für Kunde und Office
// ───────────────────────────────────────────────────────────────────────────
export type UnterlagenStatus = "fehlt" | "liegt_vor" | "wird_geprueft" | "bitte_neu";

export const STATUS_TEXT: Record<UnterlagenStatus, { kunde: string; office: string }> = {
  fehlt: { kunde: "Fehlt", office: "fehlt" },
  liegt_vor: { kunde: "Liegt vor", office: "liegt vor" },
  wird_geprueft: { kunde: "Wird geprüft", office: "wird geprüft" },
  bitte_neu: { kunde: "Bitte neu", office: "bitte neu" },
};

export interface StatusEingabe {
  kategorie: UnterlagenKategorie;
  /** Aktive Dateien (inkl. einer Bestandsfassung ohne eigene Zeile). */
  dateien: number;
  /** Die Verwaltung hat „erneut einreichen" verlangt und seither kam nichts Neues. */
  erneutAngefordert: boolean;
  /** Ein Lesen ist angestoßen und noch nicht fertig. */
  liestGerade: boolean;
  /** Die Verwaltung hat nach dem letzten Upload dieser Kategorie geprüft. */
  verwaltungGeprueft: boolean;
  /** Urteil der Dokumentprüfung (fiaon_dokument_pruefungen). */
  pruefung?: { erkannt: boolean | null; vollstaendig: boolean | null; hinweisKunde: string | null; hinweisIntern: string | null } | null;
  /**
   * Das Urteil kommt aus einer festen Regel, die schon beim Upload feststeht (Ausweis:
   * gewählte Art + Textschicht) — es steht sofort da, auch während noch gelesen wird.
   */
  pruefungSicher?: boolean;
  /** Kontoauszug-/SCHUFA-Analyse: ihr Urteil geht dem der Prüfung vor (zwei Leser, eine Antwort). */
  analyse?: { status: string; tage?: number | null; fehlerKunde?: string | null; fehlerIntern?: string | null } | null;
  /** Inhaltliche Sätze aus dem Sofortblick je Datei (z. B. „sieht aus wie ein Kontoauszug"). */
  dateiSaetze?: string[];
  /** Kontoauszug: fehlende Monate der Leiste (nur Beiwerk zum Satz). */
  fehlendeMonate?: string[];
  /** Ausweis: unter „Weitere Unterlagen" liegt ein Aufenthaltstitel, aber kein Ausweis. */
  nurAufenthaltstitel?: boolean;
  /**
   * Alle aktiven Dateien stammen aus der Zeit vor dem 08.10.2026 (herkunft 'bestand'). Ohne
   * sicheren Befund dagegen bleibt es für den Kunden „liegt vor" wie bisher — das Office liest,
   * dass einmal jemand hinsehen und „Geprüft" setzen soll (E-IT-C Nachbesserung).
   */
  nurBestand?: boolean;
}

/** Office-Satz für Bestand ohne Prüfung (eine Quelle für Stand und Prüfstand). */
export const BESTAND_OFFICE_SATZ = "Unterlage aus der Zeit vor dem 08.10.2026 — noch von niemandem geprüft: bitte einmal ansehen und „Geprüft“ setzen.";

export interface StatusAusgabe {
  status: UnterlagenStatus;
  satzKunde: string | null;
  satzOffice: string | null;
}

/** Ab so vielen Tagen deckt ein Auszug „die letzten drei Monate" (wie bisher in der Prüfung). */
export const AUSZUG_MINDEST_TAGE = 75;

export function kategorieStatus(e: StatusEingabe): StatusAusgabe {
  const info = kategorieInfo(e.kategorie);
  if (e.dateien <= 0) {
    if (e.kategorie === "ausweis" && e.nurAufenthaltstitel) {
      return { status: "fehlt", satzKunde: AUSWEIS_SAETZE.aufenthaltstitel, satzOffice: "Nur ein Aufenthaltstitel unter „Weitere Unterlagen“ — der Reisepass fehlt." };
    }
    return { status: "fehlt", satzKunde: info.pflicht ? info.hinweisKunde : null, satzOffice: null };
  }
  if (e.erneutAngefordert) {
    return { status: "bitte_neu", satzKunde: "Bitte reichen Sie diese Unterlage erneut ein — die bisherige Fassung reicht uns nicht.", satzOffice: "erneut angefordert" };
  }
  if (e.kategorie === "weitere") return { status: "liegt_vor", satzKunde: null, satzOffice: null };
  // Ein Mensch hat die jetzigen Dateien geprüft — das gilt vor jedem Automaten.
  if (e.verwaltungGeprueft) return { status: "liegt_vor", satzKunde: null, satzOffice: "von der Verwaltung geprüft" };

  // Inhaltliches aus dem Sofortblick (falsche Datei) und sichere Regel-Befunde stehen SOFORT da (P9).
  const datei = (e.dateiSaetze ?? []).filter(Boolean);
  if (datei.length) return { status: "bitte_neu", satzKunde: datei[0], satzOffice: datei[0] };
  if (e.pruefungSicher && e.pruefung && e.pruefung.vollstaendig === false && e.pruefung.hinweisKunde) {
    return { status: "bitte_neu", satzKunde: e.pruefung.hinweisKunde, satzOffice: e.pruefung.hinweisIntern ?? e.pruefung.hinweisKunde };
  }
  if (e.liestGerade) return { status: "wird_geprueft", satzKunde: "Wird gelesen — das dauert meist ein bis drei Minuten.", satzOffice: "wird gelesen" };

  // Kontoauszug und Auskunft: Die Analyse hat die Datei wirklich gelesen — ihr Urteil gilt.
  const a = e.analyse;
  if (a && (e.kategorie === "kontoauszug" || e.kategorie === "schufa")) {
    if (a.status === "fertig") {
      if (e.kategorie === "kontoauszug" && a.tage != null && a.tage < AUSZUG_MINDEST_TAGE) {
        const monate = (e.fehlendeMonate ?? []).length ? ` (${(e.fehlendeMonate ?? []).join(", ")})` : "";
        return {
          status: "bitte_neu",
          satzKunde: `Ihr Kontoauszug deckt nur etwa ${Math.max(1, Math.round(a.tage / 30))} Monat(e) ab. Für die Auswertung brauchen wir die letzten drei Monate${monate} — laden Sie die fehlenden einfach dazu, Ihre bisherigen Dateien bleiben.`,
          satzOffice: `gelesen, aber nur ~${a.tage} Tage — drei Monate verlangt`,
        };
      }
      return { status: "liegt_vor", satzKunde: null, satzOffice: "gelesen" };
    }
    if (a.status === "unlesbar") return { status: "bitte_neu", satzKunde: a.fehlerKunde ?? null, satzOffice: a.fehlerIntern ?? a.fehlerKunde ?? "nicht lesbar" };
    if (a.status === "laeuft") return { status: "wird_geprueft", satzKunde: "Wird gelesen — das dauert meist ein bis drei Minuten.", satzOffice: "Analyse läuft" };
    // „fehler" ist technisch — der Kunde sieht nie eine Schuld bei sich. Die Prüfung (ohne KI) gilt dann weiter.
  }
  const technisch = !!a && a.status === "fehler" && (e.kategorie === "kontoauszug" || e.kategorie === "schufa");

  const p = e.pruefung;
  if (p && (p.erkannt === false || p.vollstaendig === false)) {
    if (p.hinweisKunde) return { status: "bitte_neu", satzKunde: p.hinweisKunde, satzOffice: p.hinweisIntern ?? p.hinweisKunde };
    return { status: "wird_geprueft", satzKunde: "Liegt bei uns — wir sehen sie uns an.", satzOffice: p.hinweisIntern ?? "auffällig — bitte ansehen" };
  }
  if (technisch) return { status: "wird_geprueft", satzKunde: "Liegt bei uns — wir prüfen sie und melden uns.", satzOffice: a?.fehlerIntern ?? "technischer Fehler beim Lesen — wird wiederholt" };
  if (p && p.erkannt === true && p.vollstaendig === true) return { status: "liegt_vor", satzKunde: null, satzOffice: p.hinweisIntern ?? null };
  // Bestand ohne sicheren Befund: wie vor dem 08.10. „liegt vor" — das Office sieht den Auftrag zum Hinsehen.
  if (e.nurBestand) return { status: "liegt_vor", satzKunde: null, satzOffice: p?.hinweisIntern ? `${BESTAND_OFFICE_SATZ} (${p.hinweisIntern})` : BESTAND_OFFICE_SATZ };
  // Ein weicher Hinweis (z. B. „sind beide Seiten auf einem Bild?") — kein Fehler, aber gesagt.
  if (p?.hinweisKunde) return { status: "wird_geprueft", satzKunde: p.hinweisKunde, satzOffice: p.hinweisIntern ?? null };
  return { status: "wird_geprueft", satzKunde: "Liegt bei uns — wir sehen sie uns an.", satzOffice: p?.hinweisIntern ?? "noch nicht geprüft" };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Antwort an Kundenbereich und Akte (GET …/unterlagen) — eine Form für beide
// ───────────────────────────────────────────────────────────────────────────
export interface UnterlagenDatei {
  /** null = Bestandsfassung ohne eigene Zeile (vor dem 08.10.2026), Ansehen über den alten Weg. */
  id: number | null;
  kategorie: UnterlagenKategorie;
  unterart: string | null;
  unterartLabel: string | null;
  name: string;
  kb: number;
  groesse: string;
  seiten: number | null;
  am: string;
  von: "sie" | "fiaon";
  herkunft: string | null;
  notiz: string | null;
  zeitraumVon: string | null;
  zeitraumBis: string | null;
  /** Inhaltlicher Satz zur Datei (z. B. sieht aus wie ein Kontoauszug) — Kunde: Sie, Office: du. */
  satz: string | null;
  /** Office: Lese-Befund in einem Satz („gelesen – Text, 12 Seiten“). */
  befundText: string | null;
  geprueft: boolean;
  darfEntfernen: boolean;
  entferntAm?: string | null;
  entferntVon?: string | null;
  entferntGrund?: string | null;
  /** Office: Der Kunde hat die Datei selbst entfernt — ihr Inhalt ist gelöscht, nur der Vermerk bleibt. */
  inhaltGeloescht?: boolean;
}

export interface KategorieStand {
  kategorie: UnterlagenKategorie;
  titel: string;
  kurz: string;
  pflicht: boolean;
  hinweis: string;
  status: UnterlagenStatus;
  statusText: string;
  satz: string | null;
  dateien: UnterlagenDatei[];
  /** Office: entfernte Dateien (mit Grund) — der Kunde sieht sie nicht. */
  entfernte?: UnterlagenDatei[];
  monate?: { monat: string; label: string; da: boolean }[];
  darfHinzufuegen: boolean;
  sperrSatz: string | null;
  liestGerade: boolean;
  erneutAngefordert: boolean;
  /** Office: das Ausweis-Urteil nach der festen Regel. */
  ausweis?: AusweisUrteil | null;
  /** Office: Hinweis, dass die Akte-Fassung außerhalb geändert wurde oder sich nicht binden ließ. */
  akteHinweis?: string | null;
  geprueft: boolean;
}

export interface UnterlagenStand {
  personId: number;
  ref: string | null;
  kategorien: KategorieStand[];
  grenzen: { mbJeDatei: number; dateienJeKategorie: number };
  inhaltErlaubt?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Wer darf entfernen?
// ───────────────────────────────────────────────────────────────────────────
export interface EntfernenEingabe {
  quelle: string | null;
  herkunft: string | null;
  geprueftAm: string | Date | null;
  hochgeladenAm: string | Date | null;
  /** Prüfung durch die Verwaltung (admin_reviewed_at an der Bestellung). */
  verwaltungGeprueftAm?: string | Date | null;
  entferntAm?: string | Date | null;
}

const zeitVon = (v: string | Date | null | undefined): number | null => {
  if (v == null) return null;
  const t = new Date(v as any).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Der Kunde entfernt nur EIGENE Dateien, und nur solange die Verwaltung sie
 * noch nicht geprüft hat (Entscheidung Justin 08.10.). Eine von FIAON
 * beschaffte Auskunft und Dateien des Teams entfernt er nie.
 */
export function darfKundeEntfernen(d: EntfernenEingabe): boolean {
  if (d.entferntAm) return false;
  if (d.quelle !== "kunde") return false;
  // E-IT-C Nachbesserung: Eigene Dateien sind nur die ab dem 08.10.2026 hochgeladenen. Bestand
  // (vor dem 08.10. — auch vom Team abgelegt, mit dem längst gearbeitet wurde), außerhalb geänderte
  // Fassungen und die beschaffte Auskunft entfernt der Kunde nie.
  if (d.herkunft === "beschaffung" || d.herkunft === "bestand" || d.herkunft === "fremd") return false;
  if (zeitVon(d.geprueftAm) != null) return false;
  const hoch = zeitVon(d.hochgeladenAm);
  const verw = zeitVon(d.verwaltungGeprueftAm);
  if (verw != null && (hoch == null || verw >= hoch)) return false;
  return true;
}

/** „1,2 MB" / „840 KB". */
export function groesseText(bytes: number): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

// ───────────────────────────────────────────────────────────────────────────
// Texte der Oberfläche (Kunde: Sie) — hier, damit der Prüfstand sie durch die Wand schickt
// ───────────────────────────────────────────────────────────────────────────
export const UNTERLAGEN_TEXTE = {
  hinzufuegen: "Datei hinzufügen",
  hinzufuegenWeitere: "Weitere Datei hinzufügen",
  ansehen: "Ansehen",
  entfernen: "Entfernen",
  entfernenFrage: "Diese Datei entfernen? Sie wird gelöscht und verschwindet aus Ihrer Liste — bei uns bleibt nur vermerkt, dass es sie gab.",
  vonIhnen: "von Ihnen",
  vonFiaon: "von FIAON",
  bisherige: "Bisherige Unterlage",
  laedt: "Wird hochgeladen …",
  wiederholen: "Erneut versuchen",
  formate: "PDF oder Foto (JPG, PNG, iPhone-Foto), bis 50 MB je Datei. Mehrere Dateien gehen nacheinander — jede bekommt ihren eigenen Balken.",
  monateTitel: "Ihre letzten drei Monate",
  monateFehlt: "Fehlt ein Monat? Laden Sie ihn einfach dazu — Ihre bisherigen Dateien bleiben.",
  ausweisWahl: "Was laden Sie hoch?",
  aufenthaltstitelHinweis: "Mit Aufenthaltstitel? Laden Sie hier Ihren Reisepass hoch und den Aufenthaltstitel unter „Weitere Unterlagen“.",
  weitereArt: "Art der Unterlage",
  notiz: "Notiz (optional)",
  notizPlatzhalter: "z. B. „Bescheid vom Jobcenter, gültig bis 2027“ — bitte keine Gesundheitsangaben",
  artWaehlen: "Bitte wählen …",
  artZuerst: "Bitte wählen Sie zuerst die Art der Unterlage.",
  gelesen: "Eingegangen.",
  demo: "In der Demo-Ansicht wird nichts hochgeladen.",
  verbindung: "Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
  fehlerAllgemein: "Der Upload hat nicht geklappt. Bitte versuchen Sie es erneut.",
  befundWarten: "Wir lesen Ihre Datei — der Befund erscheint hier gleich. Sie können die Seite auch schließen; er bleibt stehen.",
  nurAnsicht: "In der Als-Kunde-Ansicht kann nichts hochgeladen oder entfernt werden.",
} as const;
