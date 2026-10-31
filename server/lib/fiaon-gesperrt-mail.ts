// ═══════════════════════════════════════════════════════════════════════════
// GESPERRTE MITARBEITER BEKOMMEN KEINE KUNDENDATEN MEHR PER MAIL (31.10.2026)
//
// Anlass: Ein Mitarbeiter, der seit Wochen nicht mehr für FIAON arbeitete, bekam weiter Aufgaben, Rückruf-
// Erinnerungen und Finanzauswertungen zu „seinen“ Kunden an seine private Adresse (107 Mails in drei Wochen). Diese
// Mails fragen nur nach der Zuständigkeit, nicht nach dem Zugang — die Sperre (fiaon_agents.zugang_gesperrt_am)
// schloss die Plattform, aber nicht das Postfach.
// Jetzt gilt an beiden Türen (sendMakeWebhookMitGrund in make-webhook.ts und mailDirektSenden im Motor): Diese Mails
// gehen an kein gesperrtes Mitarbeiterkonto. Mails über das eigene Konto (Kündigung, Abrechnung, Auszahlung,
// Passwort, Vertrag) bleiben erlaubt — sie tragen keine Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════

/** Mails an Mitarbeiter, die Kundendaten tragen (Name, Rufnummer, Zahlung, Auswertung). */
export const KUNDENDATEN_AN_MITARBEITER: ReadonlySet<string> = new Set([
  "aufgabe_zugewiesen",
  "agent_callback_reminder",
  "agent_payment_reminder",
  "finanzauswertung_mitarbeiter",
]);

/**
 * Der Grund, warum diese Mail NICHT rausgehen darf (Empfänger ist ein gesperrtes Mitarbeiterkonto) — sonst null.
 * Kann die Prüfung nicht laufen, hält sie die Mail zurück: Eine fehlende Erinnerung ist harmloser als Kundendaten
 * bei jemandem, der nicht mehr dazugehört.
 */
export async function gesperrtMailGrund(event: string, email: unknown): Promise<string | null> {
  if (!KUNDENDATEN_AN_MITARBEITER.has(String(event))) return null;
  const an = String(email ?? "").trim().toLowerCase();
  if (!an) return null;
  try {
    const { sqlPool } = await import("./db-pool");
    const [r] = (await sqlPool`
      SELECT id FROM fiaon_agents WHERE lower(email) = ${an} AND zugang_gesperrt_am IS NOT NULL LIMIT 1`) as any[];
    return r ? `Empfänger ist ein gesperrtes Mitarbeiterkonto (#${r.id}) — keine Kundendaten per Mail.` : null;
  } catch {
    return "Prüfung „gesperrtes Mitarbeiterkonto“ nicht möglich — Mail mit Kundendaten zurückgehalten.";
  }
}
