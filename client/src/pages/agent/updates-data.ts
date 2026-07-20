// ============================================================================
// Agenten-Changelog — die agentengerechte Fassung unserer GitHub-Updates.
//
// Jeder echte GitHub-Push, der den Agenten betrifft, bekommt hier EINEN Eintrag
// in einfacher Sprache: „Was wurde gemacht" + „So bedienst du es" (Schritt für
// Schritt). Reine Commit-Texte sind zu technisch — das hier ist die Version,
// die der Agent versteht und bedienen kann. Neueste zuerst, max. 10.
// ============================================================================

export type UpdateCategory = "Neu" | "Verbessert" | "Behoben" | "Hintergrund";

export interface AgentUpdate {
  /** Stabile, eindeutige ID (Datum + Kürzel) — steuert den „gesehen"-Status. */
  id: string;
  /** ISO-Datum (YYYY-MM-DD). */
  date: string;
  category: UpdateCategory;
  title: string;
  /** Ein-Satz-Zusammenfassung (immer sichtbar). */
  summary: string;
  /** Was konkret geändert wurde. */
  changes: string[];
  /** So bedienst du es — konkrete Schritte (optional). */
  howto?: string[];
  /** Direktlink in den passenden Bereich (optional). */
  link?: { href: string; label: string };
}

// Neueste zuerst. Genau die letzten 10 relevanten GitHub-Updates.
export const AGENT_UPDATES: AgentUpdate[] = [
  {
    id: "2026-07-20-dokumente-pdf",
    date: "2026-07-20",
    category: "Behoben",
    title: "Deine Dokumente laden zuverlässig als PDF",
    summary: "Vertrag und Provisions-Abrechnungen öffnen jetzt stabil als PDF — auch wenn im Hintergrund etwas klemmt.",
    changes: [
      "Die PDF-Erzeugung wurde doppelt abgesichert: Es entsteht immer ein gültiges PDF.",
      "Betrifft deinen Vertrag und deine Provisions-Abrechnungen unter „Meine Dokumente“.",
    ],
    howto: [
      "Öffne Mehr → Meine Dokumente.",
      "Tippe bei einem Eintrag auf „PDF“ — das Dokument öffnet sich in einem neuen Tab.",
      "Von dort kannst du es speichern oder ausdrucken.",
    ],
    link: { href: "/agent/dokumente", label: "Meine Dokumente öffnen" },
  },
  {
    id: "2026-07-20-onboarding-vertrag",
    date: "2026-07-20",
    category: "Neu",
    title: "Start-Ablauf: Zustimmung + digitaler Vertrag",
    summary: "Beim ersten Login bestätigst du kurz drei Hinweise und unterschreibst deinen Vertrag digital — danach ist dein Portal freigeschaltet.",
    changes: [
      "Drei kurze Zustimmungen: Datenschutz, Verhalten/Seriosität und Nutzungsbedingungen.",
      "Danach liest und unterschreibst du deinen Handelsvertretervertrag direkt im Portal.",
      "Alle Dokumente sind danach jederzeit als PDF abrufbar.",
      "Bei jeder Auszahlung entsteht automatisch eine Provisions-Abrechnung für dich.",
    ],
    howto: [
      "Nach dem Login erscheint der Ablauf automatisch — er lässt sich nicht überspringen.",
      "Klappe jeden der drei Hinweise auf, lies ihn und setze das Häkchen.",
      "Lies den Vertrag bis zum Ende (nach unten scrollen).",
      "Unterschreibe mit dem Finger bzw. der Maus — oder tippe deinen vollständigen Namen.",
      "Bestätige zum Schluss. Dein Portal ist ab sofort frei.",
      "Deine Unterlagen findest du danach unter Mehr → Meine Dokumente.",
    ],
    link: { href: "/agent/dokumente", label: "Meine Dokumente" },
  },
  {
    id: "2026-07-20-bestaetigung",
    date: "2026-07-20",
    category: "Verbessert",
    title: "Klare Bestätigung statt doppeltem Tippen",
    summary: "Wichtige Aktionen fragen jetzt in einem deutlichen Popup nach — kein verstecktes zweites Tippen mehr.",
    changes: [
      "Neuer Bestätigungsdialog mit Titel, Name und Hinweis auf Folgen (z. B. „Der Kunde erhält eine E-Mail“).",
      "Den Rückruf-Termin wählst du direkt im Dialog (Datum + Uhrzeit).",
      "Optimiert fürs Handy: große Tippflächen, mit „Abbrechen“ jederzeit zurück.",
    ],
    howto: [
      "Tippe wie gewohnt auf ein Kontakt-Ergebnis (z. B. „Erreicht“ oder „Nicht erreicht“).",
      "Es öffnet sich ein Popup — prüfe kurz die Angaben.",
      "Bei „Rückruf“ wählst du Datum und Uhrzeit direkt im Popup (deutsche Zeit).",
      "Tippe „Bestätigen“ — oder „Abbrechen“, falls du dich vertippt hast.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-19-nummer-falsch",
    date: "2026-07-19",
    category: "Neu",
    title: "Falsche Telefonnummer schnell korrigieren",
    summary: "Stimmt die Nummer eines Kunden nicht, löst du eine Korrektur aus — der Kunde bekommt eine E-Mail und aktualisiert sie selbst.",
    changes: [
      "Neue Strecke „Nummer aktualisieren“: Der Kunde korrigiert seine Nummer über einen Link selbst.",
      "Der E-Mail-Versand dahinter wurde vollständig geprüft und kundenfertig gemacht.",
    ],
    howto: [
      "Öffne die Kundenakte des betroffenen Kunden.",
      "Wähle beim Kontakt-Ergebnis „Nummer falsch“.",
      "Bestätige im Popup — der Kunde erhält automatisch eine E-Mail mit Korrektur-Link.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-16-berlin-zeit",
    date: "2026-07-16",
    category: "Verbessert",
    title: "Alle Zeiten in deutscher Zeit (Berlin)",
    summary: "Termine, Rückrufe und Verlauf zeigen überall einheitlich die deutsche Uhrzeit.",
    changes: [
      "Die Zeitzone ist durchgängig auf Deutschland (Europe/Berlin) umgestellt.",
      "Betrifft Kalender, Rückruf-Termine und den Verlauf in der Kundenakte.",
    ],
    howto: [
      "Du musst nichts umstellen — deine Zeiten stimmen jetzt automatisch.",
      "Beim Anlegen eines Rückrufs steht der Hinweis „deutsche Zeit“ direkt am Feld.",
    ],
    link: { href: "/agent/kalender", label: "Zum Kalender" },
  },
  {
    id: "2026-07-16-tickets-13-16",
    date: "2026-07-16",
    category: "Verbessert",
    title: "Nummernsuche, Reaktivieren & Aussortieren",
    summary: "Mehrere Verbesserungen aus eurem Feedback: nach Telefonnummer suchen, Kunden reaktivieren und Akten sauber aussortieren.",
    changes: [
      "Die Suche findet Kunden jetzt auch über die Telefonnummer (auch einzelne Ziffernfolgen).",
      "Abgelaufene oder inaktive Kunden lassen sich reaktivieren.",
      "Eine Akte ohne Ergebnis kannst du mit kurzer Pflicht-Begründung schließen (aussortieren).",
    ],
    howto: [
      "Suche: Gib oben Ziffern der Rufnummer ein — passende Kunden erscheinen sofort.",
      "Reaktivieren: In der Akte auf „Reaktivieren“ tippen und im Popup bestätigen.",
      "Aussortieren: „Akte schließen“ wählen und im Popup kurz den Grund angeben.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-16-soft-merge",
    date: "2026-07-16",
    category: "Hintergrund",
    title: "Nichts wird gelöscht — nur zusammengeführt",
    summary: "Doppelte Datensätze werden zusammengeführt statt gelöscht. Deine Historie bleibt vollständig erhalten.",
    changes: [
      "„Soft-Merge“ statt Löschen: Verläufe und Zuordnungen bleiben nachweisbar bestehen.",
      "Das passiert in der Verwaltung — an deiner Bedienung ändert sich nichts.",
    ],
    howto: [
      "Du musst nichts tun. Ein früher doppelter Kunde erscheint künftig nur noch einmal — mit vollständiger Historie.",
    ],
  },
  {
    id: "2026-07-16-ki-cockpit",
    date: "2026-07-16",
    category: "Hintergrund",
    title: "Internes KI-Werkzeug modernisiert",
    summary: "Ein internes Werkzeug der Verwaltung wurde überarbeitet. Für dein Portal ändert sich nichts.",
    changes: [
      "Redesign des internen KI-Bereichs (nur Verwaltung).",
      "Keine Auswirkung auf deine tägliche Arbeit — hier nur zur Transparenz.",
    ],
  },
  {
    id: "2026-07-15-eine-wahrheit",
    date: "2026-07-15",
    category: "Verbessert",
    title: "Provision & Zahlen: eine verlässliche Quelle",
    summary: "Deine Provisionszahlen kommen aus einer einzigen, geprüften Berechnung — überall gleich.",
    changes: [
      "Provision entsteht nur bei aktiver Betreuung (mit fairem Stichtag).",
      "Der Abgleich bezahlter Bestellungen mit den Kontoeingängen wurde verbessert.",
      "Die Zahlen in „Verdienst“ und in deiner Abrechnung stimmen jetzt überein.",
    ],
    howto: [
      "Deine aktuellen Zahlen siehst du jederzeit unter „Verdienst“.",
      "Details zu Auszahlungen findest du als Abrechnungs-PDF unter Mehr → Meine Dokumente.",
    ],
    link: { href: "/agent/verdienst", label: "Zu meinem Verdienst" },
  },
  {
    id: "2026-07-15-lifecycle",
    date: "2026-07-15",
    category: "Verbessert",
    title: "Abgelaufene Kunden verschwinden nicht mehr",
    summary: "Kunden mit abgelaufener Frist bleiben sichtbar, statt aus deiner Liste zu fallen — du verlierst niemanden aus dem Blick.",
    changes: [
      "Einheitlicher Kunden-Lebenszyklus mit klaren Status.",
      "Abgelaufene Kunden bleiben in deiner Liste (mit eigenem Status).",
    ],
    howto: [
      "In deiner Kundenliste kannst du nach Status filtern und abgelaufene Kunden gezielt reaktivieren.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
];

// ── „Gesehen"-Status (rein lokal, kein Server nötig) ─────────────────────────
const SEEN_KEY = "fiaon-agent-updates-seen";

export function latestUpdateId(): string {
  return AGENT_UPDATES[0]?.id ?? "";
}

/** Anzahl Updates, die neuer sind als das zuletzt gesehene. */
export function getUnseenCount(): number {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return AGENT_UPDATES.length;
    const idx = AGENT_UPDATES.findIndex((u) => u.id === seen);
    return idx < 0 ? AGENT_UPDATES.length : idx; // alles vor dem gesehenen Eintrag ist neu
  } catch {
    return 0;
  }
}

/** Markiert alle aktuellen Updates als gesehen und benachrichtigt Banner/Badge. */
export function markUpdatesSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, latestUpdateId());
  } catch {
    /* localStorage evtl. gesperrt — kein Problem */
  }
  window.dispatchEvent(new CustomEvent("agent-updates-seen"));
}

export function fmtUpdateDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}
