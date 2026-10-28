// ═══════════════════════════════════════════════════════════════════════════
// DIE BANKVERBINDUNG DES HAUSES — eine Quelle für alles (02.09.2026, NOTFALL)
//
// Am 02.09.2026 morgens wurde das Wise-Konto (BE09 9058 9276 3957) gesperrt.
// Bis dahin stand die IBAN an neun Stellen im Quelltext — jede einzeln. Ab
// jetzt gibt es sie genau hier; wer sie braucht, importiert BANK.
// Bei einem erneuten Wechsel: NUR diese Datei ändern + Kunden informieren
// (POST /admin/bankwechsel/informieren).
// ═══════════════════════════════════════════════════════════════════════════
export const BANK = {
  empfaenger: "FIAON LTD",
  iban: "DE86202208000047719324",
  ibanDisplay: "DE86 2022 0800 0047 7193 24",
  bic: "SXPYDEHH",
  bank: "Banking Circle S.A.",
  land: "Deutschland",
  /** Seit wann diese Verbindung gilt — für Texte („seit dem 2. September 2026"). */
  gueltigSeit: "2026-09-02",
} as const;

/**
 * Zweite Verbindung NUR für Zahlungen aus den Vereinigten Arabischen Emiraten (28.10.2026, E-432): Airwallex Global Account in AED
 * bei der Standard Chartered Bank, Dubai Branch. Eingänge dort erkennt der Zahlungsabgleich (CSV → Bankbuch) noch nicht —
 * von Hand auf den Verwendungszweck buchen. Für alles andere gilt BANK.
 */
export const BANK_AED = {
  empfaenger: "FIAON LTD",
  iban: "AE210446498900000111911",
  ibanDisplay: "AE21 0446 4989 0000 0111 911",
  bank: "Standard Chartered Bank, Dubai Branch",
  land: "Vereinigte Arabische Emirate",
  waehrung: "AED",
  gueltigSeit: "2026-10-28",
} as const;

/** Die alte, gesperrte Verbindung — NUR zum Erkennen in Texten/Abgleichen, nie zum Anzeigen. */
export const BANK_ALT_GESPERRT = {
  iban: "BE09905892763957",
  ibanDisplay: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
  gesperrtAm: "2026-09-02",
} as const;
