// ═══════════════════════════════════════════════════════════════════════════
// NAMEN TRENNEN — weil Make den ganzen Namen ins Vornamensfeld schreibt
//
// DER SCHADEN
// Der Facebook-Lead-Fluss schickt an /api/leads/intake den VOLLEN Namen im Feld
// `vorname` (in Make ist `vollständiger_name` auf `vorname` gemappt). Ergebnis im
// Bestand: 3 155 Leads und 2 307 Personen mit leerem Nachnamen und „Axel Conrad"
// im Vornamensfeld.
//
// Das ist nicht nur unschön. Es macht die Dubletten-Erkennung halbblind: Wer
// „Conrad" sucht, findet nichts; und ein zweiter Datensatz mit ordentlich
// getrenntem Namen sieht für jeden Vergleich wie ein anderer Mensch aus.
//
// DIE REGEL
// Letztes Wort ist der Nachname, der Rest der Vorname. Einteilige Namen bleiben
// Vorname — „Ahmed" allein ist kein Nachname, und ihn zu einem zu machen wäre
// eine Behauptung.
//
// ZWEI AUSNAHMEN, die im Bestand wirklich vorkommen:
//   · TITEL („Dr.", „Prof.", „Dipl.-Ing.") gehören zum Vornamensteil. Sonst
//     hieße jemand mit Nachnamen „Dr." — bei einteiligen Eingaben wie „Dr.
//     Müller" wäre sonst „Müller" der Vorname.
//   · NAMENSZUSÄTZE („von", „van der", „de", „bin") gehören zum NACHNAMEN.
//     „Anna van der Berg" hat den Nachnamen „van der Berg", nicht „Berg".
//
// Diese Datei entscheidet nichts über Personen — sie trennt nur Text. Der
// ursprüngliche Vollname wird beim Backfill als Alias gesichert
// (`fiaon_person_aliases`, Art `name_original`), damit nichts verloren geht.
// ═══════════════════════════════════════════════════════════════════════════

/** Titel und Grade — sie bleiben beim Vornamen. */
const TITEL = new Set([
  "dr", "dr.", "prof", "prof.", "prof.dr", "dipl", "dipl.", "dipl.-ing", "dipl.-ing.",
  "ing", "ing.", "mag", "mag.", "mba", "msc", "bsc", "ma", "med", "med.", "phd",
  "dott", "dott.", "herr", "frau", "hr", "fr",
]);

/** Namenszusätze — sie gehören zum Nachnamen. */
const ZUSATZ = new Set([
  "von", "vom", "van", "de", "del", "della", "der", "den", "di", "da", "das", "dos",
  "du", "el", "la", "le", "lo", "mac", "mc", "ten", "ter", "zu", "zur", "zum",
  "af", "av", "bin", "ibn", "bint", "abu", "san", "santa", "st", "st.",
]);

export interface NameTeile {
  vorname: string | null;
  nachname: string | null;
  /** Wurde tatsächlich getrennt? Für Protokoll und Backfill-Bericht. */
  getrennt: boolean;
}

/**
 * Einen Namen in Vorname und Nachname trennen.
 *
 * @param voll  Der Name, wie er hereinkommt (darf der ganze Name sein)
 * @param nachnameVorhanden Ein bereits bekannter Nachname — dann wird NICHT
 *   getrennt, sondern nur aufgeräumt. Wer schon einen Nachnamen geschickt hat,
 *   weiß es besser als diese Funktion.
 */
export function nameTeilen(voll: unknown, nachnameVorhanden?: unknown): NameTeile {
  const roh = String(voll ?? "").replace(/\s+/g, " ").trim();
  const nachAlt = String(nachnameVorhanden ?? "").trim();

  if (nachAlt) return { vorname: roh || null, nachname: nachAlt, getrennt: false };
  if (!roh) return { vorname: null, nachname: null, getrennt: false };

  // Eine E-Mail-Adresse oder Rufnummer im Namensfeld ist kein Name. Sie bleibt
  // stehen, wie sie ist — falsch trennen macht es nicht besser.
  if (roh.includes("@") || /^[+\d][\d\s/()-]{5,}$/.test(roh)) {
    return { vorname: roh, nachname: null, getrennt: false };
  }

  // „Conrad, Axel" — die umgekehrte Schreibweise kommt aus Importen.
  if (roh.includes(",")) {
    const [hinten, vorne] = roh.split(",", 2).map((t) => t.trim());
    if (hinten && vorne) return { vorname: vorne, nachname: hinten, getrennt: true };
  }

  const woerter = roh.split(" ").filter(Boolean);
  if (woerter.length < 2) return { vorname: roh, nachname: null, getrennt: false };

  const istTitel = (w: string) => TITEL.has(w.toLowerCase().replace(/[.,]+$/, "") + (w.endsWith(".") ? "." : "")) || TITEL.has(w.toLowerCase());
  // Positionen der echten Namensteile (ohne Titel). Der Nachname ist IMMER ein
  // Endstück der Wortliste — deshalb genügt sein Startindex.
  const echtePos = woerter.map((w, i) => (istTitel(w) ? -1 : i)).filter((i) => i >= 0);
  if (echtePos.length === 0) return { vorname: roh, nachname: null, getrennt: false };

  // Nur ein echter Namensteil neben Titeln: „Dr. Müller". Dann ist dieses Wort
  // der Nachname — so ist der Mensch über seinen Nachnamen findbar, und der
  // Titel bleibt beim Vornamen.
  if (echtePos.length === 1) {
    const start = echtePos[0];
    return {
      vorname: woerter.slice(0, start).join(" ").trim() || null,
      nachname: woerter[start],
      getrennt: true,
    };
  }

  // Von hinten: letztes echtes Wort, plus davorstehende Namenszusätze.
  let nachnameStart = echtePos[echtePos.length - 1];
  for (let k = echtePos.length - 2; k >= 1; k--) {
    const kandidat = echtePos[k];
    if (ZUSATZ.has(woerter[kandidat].toLowerCase())) nachnameStart = kandidat;
    else break;
  }

  return {
    vorname: woerter.slice(0, nachnameStart).join(" ").trim() || null,
    nachname: woerter.slice(nachnameStart).join(" ").trim() || null,
    getrennt: true,
  };
}

/** Anzeigename aus Teilen — an EINER Stelle, damit die Reihenfolge überall gleich ist. */
export function nameZusammen(vorname: unknown, nachname: unknown): string | null {
  const v = String(vorname ?? "").trim();
  const n = String(nachname ?? "").trim();
  const zusammen = [v, n].filter(Boolean).join(" ").trim();
  return zusammen || null;
}
