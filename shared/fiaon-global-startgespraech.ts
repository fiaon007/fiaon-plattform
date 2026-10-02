// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WAS DER KUNDE ÜBER SEIN STARTGESPRÄCH LIEST (02.10.2026, E-273)
//
// Justin an Herrn Hildbrand (WhatsApp, 02.10.2026): „… sobald dieser angenommen
// wurde von Ihnen bucht das System automatisch den nächsten freien Termin …"
// Das bucht jetzt server/lib/fiaon-global-angebot-startgespraech.ts. Jeder Satz,
// den der Kunde darüber liest — auf der Seite nach der Annahme, unter dem
// Annahmeknopf, in „Mein Auftrag" und in den Mails — steht HIER, damit der
// Prüfstand (scripts/pruef-individualangebot.ts, Abschnitt 10) jeden durch die
// Wortwand schickt.
//
// ── NICHT IM VERTRAG ───────────────────────────────────────────────────────
// Diese Datei liest der Vertrags-Renderer (fiaon-global-angebot-vertrag.ts)
// NICHT: Kein Satz von hier geht in den Rumpf und damit in die Prüfsumme
// (text_hash). Ein offenes Angebot — Herr Hildbrand, FIAON-IA-9E10FD — behält
// seine Prüfsumme, auch wenn sich hier ein Wort ändert.
//
// ── WORTWAHL ───────────────────────────────────────────────────────────────
// Gesiezt, deutsch (das Individualangebot gibt es nur auf Deutsch). „ruft Sie an"
// ist für die Wortwand eine Zusage — gedeckt durch den Termin im Kalender und die
// Aufgabe an die Person, die anruft (aufgabe_an_betreuer). Die Dauer als
// Zahlwort, keine Frist mit Ziffer.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Wochentag eines Berliner Kalendertags „JJJJ-MM-TT" — „Montag". */
export function startgespraechWochentag(isoTag: string): string {
  const [y, m, d] = String(isoTag).slice(0, 10).split("-").map(Number);
  const wt = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
  return ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][wt] ?? "";
}

export const STARTGESPRAECH_TEXTE = {
  titel: "Ihr Startgespräch",
  /** „Montag, 05.10.2026, 10:00 Uhr mit Justin Schwarzott" */
  zeile: (tagText: string, uhrzeit: string, mit: string) => `${tagText}, ${uhrzeit} Uhr mit ${mit}`,
  /** Wie das Gespräch stattfindet — wie beim Erstgespräch von FIAON Global (global_termin): Anruf, Dauer, nichts vorbereiten. */
  wie: (mit: string, dauerWort: string) =>
    `${mit} ruft Sie zur vereinbarten Zeit an — rund ${dauerWort} Minuten, Sie brauchen nichts vorzubereiten. Darin legen wir den Bundesstaat Ihrer Gesellschaft fest.`,
  kalender: "In Ihren Kalender (Apple / Outlook)",
  google: "Google Kalender",
  verschieben: "Termin verschieben oder absagen",
  gefuehrt: (tag: string) => `Ihr Startgespräch fand am ${tag} statt.`,
  abgesagt: "Ihr Startgespräch ist abgesagt — den neuen Termin vereinbaren wir persönlich mit Ihnen.",
  /** Kein freier Platz oder niemand mit gepflegten Zeiten: Justin bucht von Hand (dringende Aufgabe). */
  persoenlich: "Den Termin für Ihr Startgespräch vereinbaren wir persönlich mit Ihnen — wir melden uns dafür bei Ihnen.",
  /** Die Buchung läuft noch oder wird nachgeholt (Stundenlauf) — die Mail mit Tag und Uhrzeit folgt. */
  folgt: "Ihr Startgespräch tragen wir gerade ein — Tag und Uhrzeit erhalten Sie per E-Mail.",
  /**
   * Unter dem Annahmeknopf, AUSSERHALB des Vertragstextes (wie ANGEBOT_AUFRUF_HINWEIS): Was nach dem Klick passiert.
   * „ab Ihrem Starttag": Bei „Starten ab" sucht das System ab diesem Tag (das Gespräch ist Leistung).
   * Gegenprüfung (recht-zeitpunkt, 02.10.2026): Der Satz steht unmittelbar unter dem zahlungspflichtigen Knopf und darf
   * nicht mehr zusagen, als passiert. Findet das System keinen Platz (kein_platz/keine_person) oder hakt es, bucht es
   * NICHT, und die Seite sagt dann „vereinbaren wir persönlich“ bzw. „tragen wir gerade ein“ — deshalb „danach“ statt
   * „gleich danach“ und der Halbsatz für den Fall ohne freien Termin.
   */
  hinweisAnnahme: "Mit dem Erteilen bucht das System Ihr Startgespräch automatisch beim nächsten freien Termin — bei „Starten ab“ ab Ihrem Starttag. Tag und Uhrzeit sehen Sie danach hier und in Ihrer E-Mail; ist kein Termin frei, vereinbaren wir ihn persönlich mit Ihnen.",

  // ── Mails (server/mail/vorlagen/global-angebot.ts) — der Server setzt die Werte ein und entschärft sie ──
  /** Der Absatz in global_angebot_angenommen und global_angebot_startgespraech. `link` ist der fertige Verschieben-Verweis (HTML). */
  mailAbsatz: (z: { tagText: string; uhrzeit: string; mit: string; telefon: string | null; dauerWort: string; link: string }) =>
    `Ihr Startgespräch ist eingetragen: <b>${z.tagText}, ${z.uhrzeit} Uhr</b> mit <b>${z.mit}</b>. ${z.mit} ruft Sie zur vereinbarten Zeit${z.telefon ? ` unter ${z.telefon}` : ""} an; das Gespräch dauert rund ${z.dauerWort} Minuten, Sie brauchen nichts vorzubereiten. Darin legen wir den Bundesstaat Ihrer Gesellschaft fest. Passt die Zeit nicht? ${z.link}.`,
  /** Der Verweis im Absatz (Text des Links). */
  mailVerschieben: "Termin verschieben oder absagen",
  /**
   * global_angebot_start (nach der Zahlung): der Rest des Satzes „Ihr Ansprechpartner ist <b>…</b>{…} Vor dem ersten Antrag …".
   * Ohne Termin der Wortlaut bis E-273 — die Startmail bleibt dann Byte für Byte, wie sie war.
   */
  mailStartOhne: " und meldet sich bei Ihnen, um das Startgespräch zu vereinbaren.",
  mailStartMit: (mit: string, tagText: string, uhrzeit: string) => `. Ihr Startgespräch mit <b>${mit}</b> ist am <b>${tagText}, um ${uhrzeit} Uhr</b> eingetragen.`,
  /** Das Gespräch liegt schon hinter uns (oder ist abgesagt und neu zu vereinbaren): nur der Name. */
  mailStartVorbei: ".",
  /** Titel der Kalenderdatei und des Google-Eintrags (statt „Erstgespräch"). */
  kalenderTitel: "FIAON Global – Startgespräch",
  kalenderAbgesagt: "Dieses Startgespräch wurde abgesagt — den neuen Termin vereinbaren wir persönlich mit Ihnen.",
} as const;
