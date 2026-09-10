// ═══════════════════════════════════════════════════════════════════════════
// DIE STUFEN DER DEMO — der Kundenweg von Schritt 1 bis zum Ende (10.09.2026)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Justin: „Setze es mir so zurück /app/demo/weg, dass wir direkt sehen, wie es
// der Kunde sieht, also starten bei 1! Und bitte in HIGH END Demo Modus, dass
// wir es uns im Detail ansehen können."
//
// Die Demo zeigte bis heute EINEN festen Zustand: ein Kunde mitten im Weg,
// Startgespräch geführt, vier Raten bezahlt, zwei Schreiben unterwegs. Damit
// ließ sich der Anfang nie ansehen — und der Anfang ist die Stelle, an der ein
// echter Kunde zum ersten Mal auf den Bereich schaut.
//
// ── WAS EINE STUFE IST ─────────────────────────────────────────────────────
// Der Weg hat elf Schritte (shared/fiaon-rahmenweg.ts). Stufe n heißt: Die
// Schritte 1 bis n-1 sind erledigt, Schritt n ist der, der JETZT dran ist.
// Stufe 12 ist der Weg zu Ende gegangen. Die Zahl steht in der Adresse
// (`/app/demo/weg?stufe=1`), damit sie einen Neuladen überlebt und sich teilen
// lässt.
//
// ── WARUM DIESE DATEI GETEILT IST ──────────────────────────────────────────
// Zwei Seiten müssen sich über denselben Zustand einig sein: Der Server baut
// aus der Stufe die Antwort von `GET /kunde/FIAON-DEMO/bereich`, und der
// Kundenbereich leitet daraus zwei Dinge ab, die gar nicht von dort kommen —
// den Stand der Selbstauskunft und die versandten Schreiben. Stünden die
// Regeln zweimal da, zeigte die Demo irgendwann zwei verschiedene Kunden.
// ═══════════════════════════════════════════════════════════════════════════

/** Die höchste Stufe: alle elf Schritte erledigt. */
export const DEMO_STUFEN_MAX = 12;

export interface DemoStufe {
  /** 1 … 12 */
  nr: number;
  /** Schlüssel des Schritts aus fiaon-rahmenweg.ts (bei 12: "fertig"). */
  key: string;
  /** Der Schritt, wie er im Weg steht. */
  titel: string;
  /** Kurzform für die Stufenliste. */
  kurz: string;
  /** Wer ist am Zug? */
  wer: "kunde" | "fiaon" | "niemand";
  /** Ein Satz: Was sieht der Kunde auf dieser Stufe? */
  was: string;
}

export const DEMO_STUFEN: DemoStufe[] = [
  { nr: 1, key: "daten", titel: "Ihre Angaben sind vollständig", kurz: "Angaben", wer: "kunde",
    was: "Der erste Blick nach dem Antrag. Nichts ist erledigt, der Balken steht auf 0 von 11, und der Bereich sagt in einem Satz, was als Nächstes zu tun ist." },
  { nr: 2, key: "erstzahlung", titel: "Erste Zahlung eingegangen", kurz: "Erste Zahlung", wer: "kunde",
    was: "Die Angaben stimmen. Jetzt fehlt die erste Zahlung — es ist die einzige Stelle, an der der Bereich nach Geld fragt, bevor er arbeitet." },
  { nr: 3, key: "anspruchs_check", titel: "Selbstauskunft ausgefüllt", kurz: "Selbstauskunft", wer: "kunde",
    was: "Das Geld ist da, die Akte lebt. Der Kunde füllt seine Selbstauskunft in Ruhe selbst aus, statt sie am Telefon abgefragt zu bekommen." },
  { nr: 4, key: "startgespraech", titel: "Startgespräch geführt", kurz: "Startgespräch", wer: "kunde",
    was: "Die Selbstauskunft steht. Jetzt wählt der Kunde eine Zeit für das Startgespräch — der einzige Termin, den er selbst legt." },
  { nr: 5, key: "unterlagen", titel: "Ausweis und Kontoauszug geprüft", kurz: "Unterlagen", wer: "kunde",
    was: "Nach dem Gespräch: Ausweis und Kontoauszug. Ein Handyfoto genügt, und der Bereich sagt genau, was noch fehlt." },
  { nr: 6, key: "auskunft", titel: "Bonitätsauskunft liegt vor", kurz: "Auskunft", wer: "fiaon",
    was: "Der Kunde hat alles abgegeben. Ab hier arbeitet FIAON: Die Auskunft wird beschafft. Auf dem Heute-Schirm steht, dass er nichts tun muss." },
  { nr: 7, key: "analyse", titel: "Auskunft geprüft und erklärt", kurz: "Prüfung", wer: "fiaon",
    was: "Die Auskunft ist da. Ein Mensch geht jeden Eintrag durch und erklärt ihn in der Akte." },
  { nr: 8, key: "erster_vorgang", titel: "Erstes Schreiben versandt", kurz: "Erstes Schreiben", wer: "fiaon",
    was: "Aus der Prüfung wird der erste Antrag. Der Kunde unterschreibt mit dem Finger, ein Mensch versendet." },
  { nr: 9, key: "rate_2", titel: "Rate 2 gezahlt", kurz: "Rate 2", wer: "kunde",
    was: "Das erste Schreiben ist raus und wartet auf Antwort. Die zweite Rate ist fällig — sie ist zugleich der Zahlungsnachweis für die Bank." },
  { nr: 10, key: "konto_eroeffnet", titel: "Girokonto eröffnet", kurz: "Girokonto", wer: "fiaon",
    was: "Zwei Raten stehen. FIAON bereitet die Kontoeröffnung bei der Partnerbank vor." },
  { nr: 11, key: "karte_beantragt", titel: "Weg zu Konto und Karte erhalten", kurz: "Konto und Karte", wer: "fiaon",
    was: "Das Konto steht. Der letzte Schritt: der Weg zu Konto und Karte. Über Karte und Rahmen entscheidet die Bank." },
  { nr: 12, key: "fertig", titel: "Der Weg ist gegangen", kurz: "Alles erledigt", wer: "niemand",
    was: "Elf von elf Schritten. Der Bereich hat nichts mehr zu fordern und zeigt, was erreicht wurde." },
];

/** Was auf dieser Stufe erledigt ist. Ein Schritt gilt als erledigt, wenn seine Nummer KLEINER als die Stufe ist. */
export interface DemoStand {
  stufe: number;
  /** 1 · Angaben vollständig (Tor „Antrag vollständig“). */
  datenOk: boolean;
  /** 2 · Erste Zahlung eingegangen. */
  bezahlt: boolean;
  /** 3 · Selbstauskunft vollständig ausgefüllt. */
  checkFertig: boolean;
  /** 4 · Startgespräch geführt. */
  startgespraech: boolean;
  /** 5 · Ausweis und Kontoauszug geprüft. */
  unterlagen: boolean;
  /** 6 · Bonitätsauskunft liegt vor. */
  auskunft: boolean;
  /** 7 · Auskunft geprüft und erklärt. */
  analyse: boolean;
  /** 8 · Erstes Schreiben versandt. */
  schreiben: boolean;
  /** 9 · Rate 2 gezahlt. */
  rate2: boolean;
  /** 10 · Girokonto eröffnet. */
  konto: boolean;
  /** 11 · Weg zu Konto und Karte erhalten. */
  kartenweg: boolean;
}

/** Die Stufe aus einem beliebigen Wert (Adresszeile, Formular) — immer 1 … 12. */
export function demoStufeAus(wert: unknown): number {
  const n = Math.floor(Number(wert));
  if (!Number.isFinite(n)) return 1;
  return Math.min(DEMO_STUFEN_MAX, Math.max(1, n));
}

export function demoStand(wert: unknown): DemoStand {
  const stufe = demoStufeAus(wert);
  const bis = (n: number) => stufe > n;
  return {
    stufe,
    datenOk: bis(1),
    bezahlt: bis(2),
    checkFertig: bis(3),
    startgespraech: bis(4),
    unterlagen: bis(5),
    auskunft: bis(6),
    analyse: bis(7),
    schreiben: bis(8),
    rate2: bis(9),
    konto: bis(10),
    kartenweg: bis(11),
  };
}

/**
 * Wie alt ist die Akte auf dieser Stufe — in Tagen seit dem Antrag.
 *
 * Ein Kunde auf Stufe 1 hat gerade unterschrieben, einer auf Stufe 12 ist seit
 * Monaten dabei. Ohne diese Staffelung stünde auf Stufe 1 „Kunde seit vier
 * Monaten" neben einem leeren Weg — und die Demo verlöre genau die Glaub-
 * würdigkeit, für die sie da ist.
 */
export function demoAlterTage(stufe: number): number {
  const TAGE = [0, 0, 2, 4, 9, 12, 18, 26, 34, 62, 68, 74, 96];
  return TAGE[demoStufeAus(stufe)] ?? 0;
}

/**
 * Wie viele der siebzehn Fragen der Selbstauskunft sind beantwortet?
 * Vor Stufe 3 keine, auf Stufe 3 ein angefangener Bogen, danach alle.
 */
export function demoCheckAnteil(stufe: number, gesamt: number): number {
  const s = demoStufeAus(stufe);
  if (s < 3) return 0;
  if (s === 3) return Math.min(gesamt, 6);
  return gesamt;
}
