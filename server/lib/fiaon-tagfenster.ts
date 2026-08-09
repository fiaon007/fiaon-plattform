// ═══════════════════════════════════════════════════════════════════════════
// DER TAG IN BERLINER ZEIT — ein Fenster, das auch nachts stimmt
//
// ── DER FEHLER, DER DIESE DATEI AUSGELÖST HAT ──────────────────────────────
// Am 10.08.2026 um 00:31 Berliner Zeit meldete der Prüfstand:
//     „Beitrag ist der Auftragswert → ist 0, soll 20000"
// Eine Provision, die eine Sekunde vorher gebucht worden war, zählte nicht.
//
// Die Abfragen lauteten:
//     c.created_at >= date_trunc('day', ${datum}::date)
//
// `datum` kam aus `berlinToday()` und war korrekt „2026-08-10". Aber
// `date_trunc('day', '2026-08-10'::date)` ergibt einen Zeitstempel OHNE
// Zonenbezug, und Postgres vergleicht ihn gegen ein `timestamptz` so, als
// wäre er UTC. Das Fenster lag also von 02:00 bis 02:00 Berliner Zeit.
//
// Folge: Jede Nacht zwischen 00:00 und 02:00 Berliner Zeit (im Winter 01:00)
// zeigte die Wirtschaftlichkeit für JEDEN Mitarbeiter null Umsatz, null
// Abschlüsse und kein „gedeckt ab" — zwei Stunden lang, jeden Tag. Kein
// Absturz, keine Meldung, nur falsche Zahlen. Genau die Art Fehler, die man
// nicht bemerkt, weil um Mitternacht niemand hinsieht.
//
// ── WAS DIESE DATEI TUT ────────────────────────────────────────────────────
// Sie spannt das Fenster in BERLINER Zeit auf und übergibt es als echte
// Zeitpunkte. `AT TIME ZONE 'Europe/Berlin'` auf einem zonenlosen Zeitstempel
// heißt: „lies das als Berliner Wandzeit und gib mir den Zeitpunkt dazu" —
// und rechnet Sommer- wie Winterzeit richtig, weil Postgres die
// Zeitzonendatenbank kennt.
//
// AGENTS.md sagt: Zeitzone ist Europe/Berlin, über `fiaon-time.ts`, nie über
// rohe Datumsarithmetik. Die Regel stand da. Die Abfrage hielt sich nicht
// daran, weil sie auf der SQL-Seite passierte und nicht auf der JS-Seite.
// ═══════════════════════════════════════════════════════════════════════════

import { berlinToday } from "./fiaon-time";

export interface Tagfenster {
  /** Mitternacht Berliner Zeit, als echter Zeitpunkt. */
  von: Date;
  /** Mitternacht des Folgetages, Berliner Zeit. */
  bis: Date;
  /** Der Tag als „JJJJ-MM-TT", Berliner Zeit. */
  tag: string;
}

/**
 * Das Fenster eines Kalendertages in Berliner Zeit.
 *
 * `tag` darf fehlen — dann ist heute gemeint, gemessen in Berlin und nicht in
 * UTC. Das ist der Unterschied zwischen „was heute passiert ist" und „was seit
 * zwei Uhr morgens passiert ist".
 */
export function tagfenster(tag?: string): Tagfenster {
  const t = tag ?? berlinToday();
  // Der Umweg über Intl ist Absicht: Er kennt Sommer- und Winterzeit. Ein
  // festes „+02:00" wäre die Hälfte des Jahres falsch — und zwar genau in der
  // Hälfte, in der niemand daran denkt.
  const versatz = berlinVersatz(t);
  const von = new Date(`${t}T00:00:00${versatz}`);
  const bis = new Date(von.getTime() + 24 * 60 * 60 * 1000);
  return { von, bis, tag: t };
}

/** Das Fenster eines Monats in Berliner Zeit. */
export function monatsfenster(tag?: string): Tagfenster {
  const t = tag ?? berlinToday();
  const ersterTag = `${t.slice(0, 7)}-01`;
  const von = new Date(`${ersterTag}T00:00:00${berlinVersatz(ersterTag)}`);
  // Über den Monatswechsel rechnen, nicht über 30 Tage: Februar hat 28.
  const [j, m] = ersterTag.split("-").map(Number);
  const naechster = m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, "0")}-01`;
  const bis = new Date(`${naechster}T00:00:00${berlinVersatz(naechster)}`);
  return { von, bis, tag: ersterTag };
}

/**
 * Der UTC-Versatz Berlins an einem bestimmten Tag, als „+02:00" oder „+01:00".
 *
 * Nicht geraten: Die Zeitzonendatenbank des Browsers/Node antwortet.
 */
function berlinVersatz(tag: string): string {
  const probe = new Date(`${tag}T12:00:00Z`);
  const teile = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin", timeZoneName: "longOffset",
  }).formatToParts(probe);
  const name = teile.find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  // „GMT+02:00" → „+02:00"; „GMT" (theoretisch) → „+00:00"
  const m = /GMT([+-]\d{2}:\d{2})/.exec(name);
  return m ? m[1] : "+00:00";
}
