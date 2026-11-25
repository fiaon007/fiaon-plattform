// ═════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE VERTRAUENS-SEITEN (25.11.2026, E-532)
// Justin: Wer „FIAON seriös“ oder ähnlich sucht, soll überall auf prüfbare Fakten treffen. Drei Seiten neben der
// Fakten-Seite /ist-fiaon-serioes: Erfahrungen (das Mandat von innen), Presse, Mandate und Referenzen.
// Je Seite eine Datei in e532/; die englischen Schwestern in en/e532/.
// ═════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "./typen";
import { SEITE as ERFAHRUNGEN } from "./e532/erfahrungen";
import { SEITE as PRESSE } from "./e532/presse";
import { SEITE as REFERENZEN } from "./e532/referenzen";

export const VERTRAUEN_E532: GlobalSeite[] = [ERFAHRUNGEN, REFERENZEN, PRESSE];
