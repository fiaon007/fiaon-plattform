// ═══════════════════════════════════════════════════════════════════════════
// DER PAKETNAME — eine Form für Daten, eine für die Karte
//
// ── DER BEFUND (19.08.2026) ────────────────────────────────────────────────
// GEMESSEN: 6.589 von 6.852 Bestellungen tragen einen ZEILENUMBRUCH im
// Paketnamen — „FIAON High End\n(Das Maximum)". Fünf verschiedene Formen, alle
// aus derselben Ursache: Die Paketliste im Antrag definierte den Namen samt
// Umbruch, weil die Verkaufskarte ihn zweizeilig zeigen soll.
//
// Der Umbruch ist in der KARTE richtig und in den DATEN falsch. Im Portal stand
// deshalb in der Paket-Kachel nur „Maximum)" — der Teil nach dem Umbruch.
//
// ── WARUM ES NICHT AUFFIEL ─────────────────────────────────────────────────
// An einer Stelle im Antrag stand schon `pack.name.replace(/\n/g, " ")`. Jemand
// hat das Problem gesehen und dort behoben, wo es weh tat. Genau so entstehen
// Fehler, die überall sonst bleiben: Die Reparatur an der Fundstelle nimmt den
// Druck weg, die Ursache zu beheben.
//
// ── DIE TRENNUNG ───────────────────────────────────────────────────────────
// `name` ist der Paketname. `sub` ist der Beisatz. Die Karte setzt sie
// untereinander (zwei Elemente, kein `\n`), die Daten bekommen
// `paketNameEinzeilig()`. Zwei Formen, ein Ursprung.
//
// So machen es `start.tsx` und `fiaon-home.tsx` schon lange — nur `antrag.tsx`
// und `fiaon-landing.tsx` nicht, und genau die schreiben in die Datenbank.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ein Paketname für DATEN: einzeilig, ohne doppelte Leerzeichen, getrimmt.
 *
 * Diese Funktion ist die eine Normalisierung im Haus. Sie steht in `shared/`,
 * weil beide Seiten sie brauchen: der Client, bevor er sendet, und der Server,
 * bevor er schreibt.
 *
 * ── WARUM DER SERVER SIE TROTZDEM AUFRUFEN MUSS ──────────────────────────
 * Weil man dem Client nie glauben darf. Es gibt vier Antragsstrecken und einen
 * Alt-Bestand; wer nur den Client säubert, hat den nächsten Weg schon
 * vergessen. Die Wand steht an der Schreibstelle.
 */
export function paketNameEinzeilig(name: string | null | undefined): string | null {
  if (name == null) return null;
  const sauber = String(name)
    // Zeilenumbrüche und Tabulatoren zu Leerzeichen — NICHT entfernen: Aus
    // „FIAON High End\n(Das Maximum)" würde sonst „FIAON High End(Das
    // Maximum)", und das liest sich wie ein Tippfehler.
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  // Ein Name, der nur aus Leerraum bestand, ist kein Name.
  return sauber === "" ? null : sauber;
}

/** Trägt dieser Name einen Umbruch? Für Prüfstände und Messungen. */
export function hatUmbruch(name: string | null | undefined): boolean {
  return name != null && /[\r\n\t]/.test(String(name));
}

export interface PaketAnzeige {
  /** Der Paketname: „FIAON High End". */
  name: string;
  /** Der Beisatz: „Das Maximum". Ohne Klammern — die setzt die Darstellung. */
  sub: string;
}

/**
 * Die vier Pakete mit getrenntem Namen und Beisatz.
 *
 * Der Schlüssel ist derselbe wie in `pack_key`. Diese Liste ist die Wahrheit
 * über die ANZEIGE; Preise und Leistungen bleiben dort, wo sie schon stehen
 * (die Verkaufsseiten haben je eigene Gestaltung und eigene Merkmalslisten).
 *
 * ── WARUM NICHT ALLES HIERHER ────────────────────────────────────────────
 * Verlockend, aber falsch für heute: Die vier Verkaufsseiten unterscheiden sich
 * in Farbverläufen, Merkmalslisten und Reihenfolge. Sie in einen Katalog zu
 * zwingen wäre ein Umbau der Verkaufsstrecke — und der gehört nicht in einen
 * Auftrag über Datenkosmetik. Was hierher gehört, ist die eine Sache, die in
 * die DATENBANK fließt: der Name.
 */
export const PAKET_ANZEIGE: Record<string, PaketAnzeige> = {
  start: { name: "FIAON Starter", sub: "Das Fundament" },
  pro: { name: "FIAON Pro", sub: "Standard" },
  ultra: { name: "FIAON Ultra", sub: "Elite Konto" },
  highend: { name: "FIAON High End", sub: "Das Maximum" },
};

/**
 * Der Name, der in die Datenbank geht: „FIAON High End (Das Maximum)".
 *
 * Die Klammern stehen HIER und nicht in der Definition: In der Karte sollen sie
 * nicht erscheinen (dort steht der Beisatz in eigener Zeile und eigener Farbe),
 * in den Daten schon — sonst liest sich „FIAON High End Das Maximum" wie ein
 * fehlendes Satzzeichen.
 */
export function paketNameFuerDaten(key: string): string | null {
  const a = PAKET_ANZEIGE[key];
  return a ? `${a.name} (${a.sub})` : null;
}

/**
 * Die KURZFORM für Kacheln und Abzeichen: „High End", „Pro", „Starter".
 *
 * ── WARUM ES DIESE FUNKTION BRAUCHT (19.08.2026) ─────────────────────────
 * Im Portal stand `user.packName?.split(" ").pop()`. Bei „FIAON Pro" ergibt
 * das „Pro" — richtig, und deshalb fiel es lange nicht auf. Bei „FIAON High
 * End (Das Maximum)" ergibt es **„Maximum)"**: das letzte Wort samt
 * schließender Klammer, ohne öffnende.
 *
 * Der Zeilenumbruch in den Daten war NICHT die Ursache dieser Kachel — er
 * verdeckte sie nur. Nach dem Bereinigen des Umbruchs stand dort weiter
 * „Maximum)", und erst der Screenshot zeigte es. 38 grüne Prüfungen hatten es
 * übersehen, weil alle die SPALTE prüften und keine das BILD.
 *
 * ── DIE REGEL ────────────────────────────────────────────────────────────
 * Der Beisatz in Klammern fliegt weg, das Wort „FIAON" auch — übrig bleibt,
 * was das Paket unterscheidet. Was nicht diesem Muster folgt, wird nur gekürzt
 * und NICHT geraten: Bei „Bonitätsauskunft inkl. Handlungsplan" ist jede
 * Kurzform eine Erfindung, also bleibt der Anfang stehen.
 */
export function paketKurz(name: string | null | undefined, hoechstens = 18): string | null {
  const voll = paketNameEinzeilig(name);
  if (!voll) return null;

  // Den Beisatz in Klammern entfernen: „FIAON High End (Das Maximum)".
  const ohneKlammer = voll.replace(/\s*\([^)]*\)\s*$/, "").trim();
  // Die Marke entfernen: „FIAON High End" → „High End".
  const ohneMarke = ohneKlammer.replace(/^FIAON\s+/i, "").trim();

  const kurz = ohneMarke || ohneKlammer || voll;
  // Nur kürzen, wenn es wirklich zu lang ist — und dann mit Auslassung, damit
  // erkennbar bleibt, dass etwas fehlt.
  if (kurz.length <= hoechstens) return kurz;
  return `${kurz.slice(0, hoechstens - 1).trimEnd()}…`;
}
