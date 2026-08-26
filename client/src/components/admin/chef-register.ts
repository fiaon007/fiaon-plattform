// ═══════════════════════════════════════════════════════════════════════════
// DAS REGISTER — jede Fähigkeit der Plattform, an einer Stelle (26.08.2026)
//
// Justin: „Stelle sicher, dass man als ADMIN wirklich ALLES machen kann, über
//          die gesamte Plattform verfügen — wirklich an JEDES DETAIL muss
//          gedacht werden."
//
// ── WARUM ES DIESE LISTE BRAUCHT ──────────────────────────────────────────
// Eine Durchsicht aller Admin-Endpunkte hat drei Sorten von Lücken gezeigt:
//
//   1. SEITEN OHNE TÜR — es gibt sie, aber keine Kachel führt hin
//      (/admin/kuendigungen, /admin/leistung, /admin/nachbuchung,
//       /admin/personen, /admin/database).
//   2. FUNKTIONEN NUR ALS ADRESSE — sie leben in einem Fragezeichen hinter
//      der Adresse (?kycOffen=1, ?dubletten=1, ?stufe=C). Wer die Adresse
//      nicht auswendig kennt, hat die Funktion nicht.
//   3. RÜCKWÄRTSGÄNGE — Zusammenführung aufheben, Akte wiederherstellen,
//      Abo fortsetzen. Sie werden am zuverlässigsten vergessen, und man
//      braucht sie genau dann, wenn etwas schiefging.
//
// ── DIE REGELN DIESER LISTE ───────────────────────────────────────────────
// · Jeder Eintrag hat einen Namen, den ein Mensch versteht, nicht den der
//   Datenbank. Nicht „KYC-Queue", sondern „Ausweisprüfungen, die offen sind".
// · Kein Eintrag ohne Ziel. Ein Verzeichnis mit toten Verweisen ist
//   schlimmer als keines.
// · Was gefährlich ist, sagt es. `gefahr: true` färbt den Eintrag und
//   erzwingt eine Rückfrage, bevor man dort landet.
// · Was nur die Geschäftsführung sehen darf, trägt `nurGf: true`.
// ═══════════════════════════════════════════════════════════════════════════

export interface Registereintrag {
  label: string;
  satz: string;
  href: string;
  /** Nur ab Stufe Geschäftsführung sichtbar (Geld und System). */
  nurGf?: boolean;
  /** Wirkt auf viele Datensätze zugleich oder ist schwer umkehrbar. */
  gefahr?: boolean;
  /** Suchworte, unter denen jemand diese Funktion suchen würde. */
  auch?: string;
}

export interface Registergruppe {
  titel: string;
  satz: string;
  eintraege: Registereintrag[];
}

export const REGISTER: Registergruppe[] = [
  {
    titel: "Menschen finden und bearbeiten",
    satz: "Jede Person genau einmal — suchen, öffnen, ändern, zusammenführen.",
    eintraege: [
      { label: "Alle Kunden", satz: "Der gesamte Bestand mit Filtern, Suche und Blättern.", href: "/chef/kundenliste", auch: "liste bestand personen" },
      { label: "Kunden-Zentrale", satz: "Leads, Kunden, Anträge — mit Massenaktionen.", href: "/admin/kunden" },
      { label: "Eine Akte öffnen", satz: "Über die Suche in der Werkstatt oder direkt aus jeder Liste.", href: "/chef/werkzeuge", auch: "akte einzelne person" },
      { label: "Ausweisprüfungen, die offen sind", satz: "Wer hat Unterlagen hochgeladen, die noch niemand angesehen hat?", href: "/admin/kunden?kycOffen=1", auch: "kyc ausweis legitimation" },
      { label: "Kündigungen", satz: "Wer hat gekündigt, und was ist daraus geworden?", href: "/admin/kuendigungen", auch: "storno beenden" },
      { label: "Bezahlt, aber ohne Startgespräch", satz: "Die Kunden, bei denen das Onboarding hängt.", href: "/admin/kunden?bezahltOhneOnboarding=1", auch: "onboarding startgespraech" },
      { label: "Kalte Leads (Stufe C)", satz: "Der Vorrat, aus dem nachgefasst wird.", href: "/admin/kunden?stufe=C", auch: "leads vorrat kalt" },
      { label: "Doppelt angelegte Personen", satz: "Erkennen und zusammenführen — der Vorgang ist umkehrbar.", href: "/admin/dubletten", auch: "dubletten doppelt merge" },
      { label: "Zusammenführung rückgängig", satz: "In der Dubletten-Seite bei der jeweiligen Person — der Vorgang ist umkehrbar.", href: "/admin/dubletten", auch: "undo merge trennen" },
      { label: "Personen-Rohdaten", satz: "Die Tabelle hinter allem — zum Nachsehen, wenn eine Zahl nicht stimmt.", href: "/admin/personen", nurGf: true, auch: "rohdaten tabelle" },
      { label: "Kundenkartei", satz: "Die alte Karteiansicht. Läuft noch, wird nicht mehr gepflegt.", href: "/admin/kartei", auch: "alt kartei" },
    ],
  },
  {
    titel: "Geld: Eingang, Verbuchung, Auszahlung",
    satz: "Von der Zahlung auf dem Konto bis zur Provision beim Mitarbeiter.",
    eintraege: [
      { label: "Zahlungszentrale", satz: "Jeder Eingang mit allen Angaben, gegengeprüft.", href: "/chef/zahlungen", nurGf: true, auch: "zahlungen eingang umsatz" },
      { label: "Zahlungsverwaltung", satz: "Offene Zahlungen prüfen, freischalten, Verlauf ansehen.", href: "/admin/zahlungen", nurGf: true },
      { label: "Kontoabgleich", satz: "Bank-Eingänge exakt mit Kunden abgleichen.", href: "/admin/kontoabgleich", nurGf: true, auch: "bank kontoauszug wise" },
      { label: "Zahlungen verbuchen", satz: "Vier Fälle, vier Reiter, jeweils mit Vorschau.", href: "/admin/verbuchung", nurGf: true },
      { label: "Verbuchungen ansehen", satz: "Bestätigte Zahlungen: Umsatz, Provision, Netto.", href: "/admin/verbuchungen", nurGf: true },
      { label: "Provision nachbuchen", satz: "Eine übersehene Provision nachträglich anlegen.", href: "/admin/nachbuchung", nurGf: true, auch: "provision nachtragen backfill" },
      { label: "Auszahlungen freigeben", satz: "Provisions-Anforderungen des Teams mit IBAN.", href: "/admin/auszahlungen", nurGf: true },
      { label: "Abrechnungen", satz: "Provisionsabrechnungen ansehen, als PDF öffnen, versenden.", href: "/admin/abrechnungen", nurGf: true },
      { label: "Rechnungen", satz: "Alle erzeugten Rechnungen durchsuchen und laden.", href: "/admin/rechnungen", nurGf: true },
      { label: "Buchhaltung", satz: "Buchungsjournal und Ausbuchung.", href: "/admin/buchhaltung", nurGf: true, auch: "ledger journal" },
      { label: "Finanzen & Sales", satz: "Funnel, Umsatz, Marge, Werbekosten, Kampagnen.", href: "/admin/finanzen", nurGf: true, auch: "cac marge funnel" },
      { label: "Freigabestapel Geld", satz: "Alles, was nur der Chef entscheidet — an einer Stelle.", href: "/chef/werkzeuge", nurGf: true },
      { label: "Investoren", satz: "Anfragen, Investments, Dokumente.", href: "/admin/investoren", nurGf: true },
    ],
  },
  {
    titel: "Forderungen und Mahnwesen",
    satz: "Was offen ist, was gemahnt wurde, und was übergeben werden muss.",
    eintraege: [
      { label: "Überfällige Raten", satz: "Alle Kunden mit mindestens einer überfälligen Rate.", href: "/chef/kundenliste?filter=ueberfaellig", auch: "mahnung offen ueberfaellig" },
      { label: "Mahnwege erschöpft", satz: "Alle Stufen durchlaufen, das Geld ist nicht da — Entscheidung nötig.", href: "/chef/werkzeuge", nurGf: true, auch: "eskalation entscheidung" },
      { label: "In der Forderungsbearbeitung", satz: "Wer ist bereits übergeben?", href: "/chef/kundenliste?filter=inkasso", auch: "inkasso forderung" },
      { label: "Abo-Maschinenraum", satz: "Ratenketten, Tageslauf, Sammelversand, einzelne Abos stoppen.", href: "/admin/zahlungen", nurGf: true, auch: "abo raten kette" },
    ],
  },
  {
    titel: "Team",
    satz: "Alles zu einem Menschen, der bei FIAON arbeitet.",
    eintraege: [
      { label: "Team-Zentrale", satz: "Kennzahlen, Provisionen, Protokolle, Nachrichten.", href: "/admin/team" },
      { label: "Wirtschaftlichkeit je Mitarbeiter", satz: "Was bringt und was kostet jeder Einzelne?", href: "/admin/leistung", nurGf: true, auch: "deckungsbeitrag leistung rentabel" },
      { label: "Teammitglied einladen", satz: "Neuen Mitarbeiter per E-Mail anlegen.", href: "/admin/team?einladen=1" },
      { label: "Onboarding & Verträge", satz: "Zustimmungen, Vertragsstand, Vorlagen, Nachweise.", href: "/admin/vertraege" },
      { label: "Provision nachbuchen (Team)", satz: "Der Reiter in der Team-Zentrale.", href: "/admin/team?tab=nachbuchung", nurGf: true },
      { label: "Rangliste", satz: "Wer steht wo — auch zum Teilen.", href: "/admin/team?rang=1", auch: "ranking wettbewerb" },
      { label: "Skripte & Leitfäden", satz: "Gesprächsvorlagen verwalten.", href: "/admin/team#skripte" },
      { label: "Team-Updates & Feedback", satz: "Portal-Updates posten, Feedback prüfen.", href: "/admin/agent-portal" },
      { label: "Academy", satz: "Einschulung als Kapitel-Reise je Abteilung.", href: "/admin/schulung" },
      { label: "Alte Team-Ansicht", satz: "Der Vorgänger. Nur noch zum Nachsehen.", href: "/admin/team-alt" },
    ],
  },
  {
    titel: "Termine, Leads und Nachfassen",
    satz: "Wer wird wann angerufen, und was ist daraus geworden?",
    eintraege: [
      { label: "Termin-Zentrale", satz: "Alle Termine aller Mitarbeiter — und wer keinen hat.", href: "/admin/termine" },
      { label: "Lead-Automatik", satz: "Nachfass-Maschine: Sendefenster, Bulk-Versand, Verteilung.", href: "/admin/lead-automatik" },
      { label: "Leads", satz: "Die Lead-Liste mit ihren eigenen Filtern.", href: "/admin/leads" },
      { label: "Nachfass-Lauf von Hand starten", satz: "Wenn die Automatik stillstand.", href: "/chef/werkzeuge", auch: "cron lauf followup" },
      { label: "Fahrplan / Kundenprodukt", satz: "Upload-Review, KI-Analyse freigeben, Ziel-Freischaltung.", href: "/admin/fahrplan" },
    ],
  },
  {
    titel: "Kommunikation",
    satz: "Was hinausgeht — Mails, Vorlagen, der Feed des Teams.",
    eintraege: [
      { label: "Mail-Zentrale", satz: "Freitext an Kunden und Gruppen, mit Vorschau.", href: "/admin/mail-zentrale" },
      { label: "E-Mail-Events", satz: "Make-Events testen, Diagnose, Verlauf.", href: "/admin/events", auch: "make brevo mail" },
      { label: "Posteingang von der Website", satz: "Investoren-, Presse- und Bewerbungsanfragen.", href: "/chef/werkzeuge", auch: "anfragen bewerbung presse" },
      { label: "Offene Kundenanfragen", satz: "Tickets aus dem Kundenbereich, die niemand beantwortet hat.", href: "/chef/werkzeuge", auch: "tickets support anfragen" },
      { label: "Space", satz: "Der Feed des Teams — mitlesen, anpinnen, moderieren.", href: "/admin/space" },
      { label: "Ratgeber-Redaktion", satz: "Entwürfe lesen, Vorschau, Prüfstand, veröffentlichen.", href: "/admin/ratgeber" },
    ],
  },
  {
    titel: "Nachsehen, was war",
    satz: "Wenn jemand fragt „wer hat das gemacht“ oder „warum ging das nicht“.",
    eintraege: [
      { label: "Audit-Log", satz: "Alle Aktionen durchsuchbar.", href: "/admin/audit", nurGf: true },
      { label: "System-Diagnose", satz: "Was klemmt gerade? Ereignisse, Rohdaten, KI-Auswertung.", href: "/admin/diagnose", nurGf: true },
      { label: "Wahrheits-Check", satz: "Stimmen meine Zahlen? Sieben Prüfungen.", href: "/chef/werkzeuge", nurGf: true },
      { label: "Maschinenraum", satz: "Läuft die Automatik — und kann ich sie neu anwerfen?", href: "/chef/werkzeuge" },
      { label: "Was ist neu?", satz: "Alle Änderungen am System in Klartext.", href: "/admin/changelog" },
      { label: "Frag die Zahlen", satz: "Eine Frage in ganzen Sätzen an die Datenbank.", href: "/chef/werkzeuge", nurGf: true },
    ],
  },
  {
    titel: "Einstellungen und Recht",
    satz: "Was einmal gesetzt wird und dann für alle gilt.",
    eintraege: [
      { label: "Einstellungen", satz: "Provisionssatz, Auszahlung, Erinnerungen, Diagnose.", href: "/admin/einstellungen", nurGf: true },
      { label: "Meine Liste", satz: "Was nur du tun kannst — Make, Brevo, Konten, Entscheidungen.", href: "/admin/todo" },
      { label: "Notizen & Aufgaben", satz: "An Personen festgehalten oder ans Team vergeben.", href: "/admin/aufgaben" },
      { label: "Rechtstexte-Status", satz: "Der Prüfstand der Rechtstexte.", href: "/admin/recht" },
      { label: "Funktionen & Schulung", satz: "Die Lernseite mit Selbsttest.", href: "/admin/funktionen" },
      { label: "Datenbank-Werkzeug", satz: "Direkter Blick in die Tabellen. Nur mit gutem Grund.", href: "/admin/database", nurGf: true, gefahr: true, auch: "sql datenbank tabellen" },
    ],
  },
];

/** Wie viele Einträge das Register kennt — für die Kopfzeile. */
export const REGISTER_ANZAHL = REGISTER.reduce((s, g) => s + g.eintraege.length, 0);
