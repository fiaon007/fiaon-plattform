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

/** Die alte, gesperrte Verbindung — NUR zum Erkennen in Texten/Abgleichen, nie zum Anzeigen. */
export const BANK_ALT_GESPERRT = {
  iban: "BE09905892763957",
  ibanDisplay: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
  gesperrtAm: "2026-09-02",
} as const;
