// ============================================================================
// FIAON — Zentraler Wartungsmodus
// ============================================================================
// MAINTENANCE_MODE = true  → Keine neuen Anträge & Zahlungen möglich.
//   - Globaler Banner auf jeder Seite (siehe MaintenanceBanner.tsx)
//   - Alle Stripe-Zahlungsschritte sind blockiert (antrag, business-antrag,
//     bonitaet-antrag, dashboard)
// Zum Reaktivieren: einfach auf false setzen.
// ============================================================================

export const MAINTENANCE_MODE = true;

export const MAINTENANCE_TITLE = "Geplante Wartungsarbeiten";

export const MAINTENANCE_MESSAGE =
  "Aktuell können keine neuen Anträge und Zahlungen angenommen werden. Es entstehen dir keine Kosten. Bestehende Konten sind nicht betroffen — wir sind in Kürze wieder für dich da.";
