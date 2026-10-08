// ═══════════════════════════════════════════════════════════════════════════
// DIE PRODUKTKATEGORIE — Weiterleitung (E-IT-B, 08.10.2026)
//
// Die Regel (auskunft · global · konto) steht seit dem 08.10.2026 in
// shared/fiaon-produktkategorie.ts, weil auch die Kündigungsregel in shared/
// sie braucht (shared/fiaon-kuendigung-regel.ts). Diese Datei bleibt als
// Adresse für die bestehenden Aufrufer im Server — eine Quelle, zwei Wege
// dorthin, kein zweiter Inhalt.
// ═══════════════════════════════════════════════════════════════════════════
export { produktkategorie, produktkategorieSql, KATEGORIE_TEXT, type Produktkategorie } from "@shared/fiaon-produktkategorie";
