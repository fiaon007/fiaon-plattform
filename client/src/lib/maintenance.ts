// ============================================================================
// FIAON — Zentraler Wartungsmodus
// ============================================================================
// MAINTENANCE_MODE = true  → Globaler Banner auf jeder Seite (MaintenanceBanner.tsx)
// Seit der Umstellung auf Vorkasse per Banküberweisung (MIGRATION_INVENTORY.md)
// laufen Anträge & Zahlungen wieder normal — Banner ist deaktiviert.
// ============================================================================

export const MAINTENANCE_MODE = false;

export const MAINTENANCE_TITLE = "Geplante Wartungsarbeiten";

export const MAINTENANCE_MESSAGE =
  "Aktuell können keine neuen Anträge und Zahlungen angenommen werden. Es entstehen dir keine Kosten. Bestehende Konten sind nicht betroffen — wir sind in Kürze wieder für dich da.";
