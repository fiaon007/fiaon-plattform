// ═══════════════════════════════════════════════════════════════════════════
// FILME UND KONZEPT AUF /business — EINE STELLE (E-313, 08.10.2026)
//
// Justin: „beide Videos auf der /business-Startseite … perfekt modern … und unsere Präsentation soll man ebenfalls cool
// herunterladen können.“ Der Vorführraum (GlobalVorfuehrraum.tsx) zeigt jeden Film hier in einem iPhone; ein zweiter
// Film ist EIN weiterer Eintrag (Dateien nach client/public/global/film/, Name mit Datum — die Dateien liegen 30 Tage im
// Browser-Speicher, ein neuer Stand braucht einen neuen Namen).
// Inhalte geprüft gegen die Global-Regeln (keine Bürgschaft, keine Kreditgarantie, keine Schwarzott-Firmen, KI-Hinweis):
// Trailer = E-304 „Der blaue Faden“ (08_Medien_Higgsfield/2026-10-08_Global_Trailer), Deck = E-304 „Das Konzept“
// (06_Marketing/2026-10_Global_Praesentation).
// ═══════════════════════════════════════════════════════════════════════════

export interface GlobalFilm {
  schluessel: string;
  /** Der ganze Film mit Ton (H.264/AAC, moov vorn — startet ohne vollständigen Download). */
  datei: string;
  /** Stumme Schleife fürs iPhone (≈ 10 s, 360 × 640, ohne Ton). */
  vorschau: string;
  /** Titelbild, solange nichts läuft (und bei „weniger Bewegung“). */
  titelbild: string;
  dauerSek: number;
  titel: { de: string; en: string };
  /** Kurzbeschreibung für Screenreader (wie ALT-TEXT.txt des Films). */
  beschreibung: { de: string; en: string };
}

export const GLOBAL_FILME: GlobalFilm[] = [
  {
    schluessel: "blauer-faden",
    datei: "/global/film/blauer-faden-2026-10-720.mp4",
    vorschau: "/global/film/blauer-faden-2026-10-vorschau.mp4",
    titelbild: "/global/film/blauer-faden-2026-10-titel.webp",
    dauerSek: 83,
    titel: { de: "Der blaue Faden", en: "The blue thread" },
    beschreibung: {
      de: "Kinotrailer von FIAON Global, 83 Sekunden: Ein Füller zieht eine blaue Tintenlinie. Sie wird zum Flugbogen von Europa nach Miami, verknotet sich zwischen acht Stempeln für die Anlaufstellen einer US-Gründung und zieht sich bei „ein Ansprechpartner“ gerade. Danach Boardroom in Miami, Siegelpresse, die vier Etappen bis zum Bankdarlehen, die Kapitalrahmen je Paket mit dem Hinweis, dass das jeweilige Institut entscheidet, Sonnenaufgang über Europa, der Festpreis ab 2.499 € und die Endkarte. Bilder mit KI erstellt.",
      en: "FIAON Global trailer, 83 seconds, in German: a fountain pen draws a blue ink line. It becomes a flight path from Europe to Miami, knots between eight stamps for the offices of a US formation and pulls straight at “one point of contact”. Then a boardroom in Miami, a seal press, the four stages up to the bank loan, the capital framework per package with the note that each institution decides, sunrise over Europe, the fixed price from €2,499 and the end card. Images created with AI.",
    },
  },
];

export const GLOBAL_KONZEPT = {
  datei: "/global/konzept/FIAON_Global_Konzept_2026-10.pdf",
  dateiname: "FIAON_Global_Konzept_2026-10.pdf",
  folien: 22,
  groesseMb: 3.3,
  /** Drei echte Folien für die Mappe: Titel, Pakete, Etappen (vorn → hinten). */
  bilder: ["/global/konzept/folie-01.webp", "/global/konzept/folie-09.webp", "/global/konzept/folie-06.webp"],
} as const;

/** 83 → „1:23“. */
export function filmDauer(sek: number): string {
  const s = Math.max(0, Math.round(sek));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
