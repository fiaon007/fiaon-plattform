// ═══════════════════════════════════════════════════════════════════════════
// „VON MARA" — DIE MARKE FÜR TERMINE, DIE MARA VEREINBART HAT (E-236)
//
// ── DER ANLASS (24.09.2026) ────────────────────────────────────────────────
// Mara (KI-Assistentin auf WhatsApp) trägt Rückrufe jetzt selbst beim
// Betreuer ein und schickt persönliche Terminlinks. Justin: „im jeweiligen
// Dashboard anzeigen, dass ein neuer Termin über Mara gebucht wurde".
//
// ── WARUM EINE EIGENE MARKE ────────────────────────────────────────────────
// Mara bucht mit `quelle = 'agent_manuell'` (die Quelle steuert Rolle, Slot
// und Dauer — ein Rückruf beim Betreuer). Ohne diese Marke stand ein von Mara
// vereinbarter Rückruf im Kalender als „selbst eingetragen" da: Der
// Mitarbeiter sah einen Termin, den er nie angelegt hat, und wusste nicht,
// woher er kommt und dass der Kunde auf seinen Anruf WARTET.
//
// Der WEG steht in `fiaon_termine.herkunft` (HERKUENFTE in
// server/lib/fiaon-termine.ts). Diese Datei übersetzt die drei Mara-Wege in
// EINE Aufschrift für alle Mitarbeiter-Ansichten: Kalender (Zeile, Popover,
// Dialog, Wochenraster), Erinnerungsleiste + Popup, Dashboard, Tagescheck.
// Wer die Marke woanders erfindet, erfindet die zweite Fassung.
//
//   mara_whatsapp       „von Mara"          Rückruf, von Mara per WhatsApp vereinbart
//   mara_mail           „von Mara"          Rückruf, von Mara aus einer E-Mail vereinbart
//   mara_whatsapp_link  „über Maras Link"   Kunde hat selbst über Maras Link gebucht
//   mara_mail_genannt   „von Mara"          Kunde nannte in einer Mail einen mit uns vereinbarten Termin (E-395)
//   mara_whatsapp_genannt „von Mara"        dasselbe auf WhatsApp (E-401 2/6)
// ═══════════════════════════════════════════════════════════════════════════

export type MaraWeg = "mara_whatsapp" | "mara_mail" | "mara_whatsapp_link" | "mara_mail_genannt" | "mara_whatsapp_genannt";

export interface MaraMarke {
  weg: MaraWeg;
  /** Die Aufschrift — kurz, sie steht als Marke neben der Terminart. */
  text: string;
  /** Der Satz für Tooltip/`title`. */
  titel: string;
  /** Ein ganzer Satz für Dialoge und das Erinnerungs-Popup. */
  satz: string;
  /**
   * true = Mara hat den Termin SELBST eingetragen (Rückruf). Dann ersetzt die
   * Marke das „selbst eingetragen" — der Mitarbeiter hat ihn nicht angelegt.
   * false = der Kunde hat selbst gebucht (über Maras Link); „Kunde hat
   * gebucht" bleibt stehen, die Marke sagt zusätzlich, woher der Link kam.
   */
  vonMaraEingetragen: boolean;
}

const MARKEN: Record<MaraWeg, MaraMarke> = {
  mara_whatsapp: {
    weg: "mara_whatsapp",
    text: "von Mara",
    titel: "Rückruf, den Mara per WhatsApp vereinbart hat",
    satz: "Diesen Rückruf hat Mara per WhatsApp mit dem Kunden vereinbart. "
      + "Er wartet zu dieser Zeit auf deinen Anruf — worum es geht, steht in der Notiz.",
    vonMaraEingetragen: true,
  },
  mara_mail: {
    weg: "mara_mail",
    text: "von Mara",
    titel: "Rückruf, den Mara per E-Mail vereinbart hat",
    satz: "Diesen Rückruf hat Mara per E-Mail mit dem Kunden vereinbart. "
      + "Er wartet zu dieser Zeit auf deinen Anruf — worum es geht, steht in der Notiz.",
    vonMaraEingetragen: true,
  },
  // E-395 (19.10.2026): Mara hat ihn nicht vereinbart, sondern eingetragen, was mit dem Team schon feststand.
  mara_mail_genannt: {
    weg: "mara_mail_genannt",
    text: "von Mara",
    titel: "Termin, den der Kunde per E-Mail genannt hat — von Mara eingetragen",
    satz: "Diesen Termin hat der Kunde in einer E-Mail genannt; er war mit dem Team vereinbart. "
      + "Mara hat ihn eingetragen — der Beleg steht in der Notiz.",
    vonMaraEingetragen: true,
  },
  // E-401 (2/6, 19.10.2026): derselbe Weg auf WhatsApp.
  mara_whatsapp_genannt: {
    weg: "mara_whatsapp_genannt",
    text: "von Mara",
    titel: "Termin, den der Kunde per WhatsApp genannt hat — von Mara eingetragen",
    satz: "Diesen Termin hat der Kunde per WhatsApp genannt; er war mit dem Team vereinbart. "
      + "Mara hat ihn eingetragen — der Beleg steht in der Notiz.",
    vonMaraEingetragen: true,
  },
  mara_whatsapp_link: {
    weg: "mara_whatsapp_link",
    text: "über Maras Link",
    titel: "Termin, den der Kunde über Maras persönlichen Terminlink (WhatsApp) selbst gebucht hat",
    satz: "Diese Zeit hat der Kunde selbst gewählt — über den persönlichen Terminlink, "
      + "den Mara ihm per WhatsApp geschickt hat.",
    vonMaraEingetragen: false,
  },
};

/** Die Mara-Marke zu einer Herkunft — `null`, wenn Mara nicht beteiligt war. */
export function maraMarke(herkunft: unknown): MaraMarke | null {
  const h = String(herkunft ?? "").trim().toLowerCase();
  return (MARKEN as Record<string, MaraMarke>)[h] ?? null;
}

/** Wie viele Stunden ein Mara-Termin im Dashboard als „neu" gilt. */
export const MARA_NEU_STUNDEN = 72;
