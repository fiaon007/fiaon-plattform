/**
 * ============================================================================
 * ARAS TEAM FEED - Demo Seed Generator
 * ============================================================================
 * High-fidelity demo dataset for Team Feed (7 months)
 * Deterministic, realistic, clearly labeled as demo data
 * ============================================================================
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DemoAttachment {
  id: string;
  kind: 'image' | 'file';
  fileName: string;
  fileSizeLabel: string;
}

export interface DemoFeedItem {
  id: number;
  createdAt: string;
  authorUserId: string;
  authorUsername: string;
  authorRole: string;
  department: string;
  message: string;
  body?: string;
  type: 'message' | 'system' | 'status';
  attachments?: DemoAttachment[];
  meta?: {
    tone?: 'strict' | 'casual' | 'neutral';
    hasTypos?: boolean;
    tags?: string[];
  };
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  style: 'formal' | 'casual' | 'strict' | 'neutral';
  activityLevel: 'very_active' | 'regular' | 'occasional' | 'sporadic';
  phrases: string[];
  typoRate: number; // 0-1
  usesEmoji: boolean;
}

// ============================================================================
// TEAM ROSTER (53 Members)
// ============================================================================

export const TEAM_ROSTER: TeamMember[] = [
  // Leadership / VR
  { id: 'usr_001', name: 'Justin Schwarzott', role: 'Verwaltungsrat Präsident', department: 'Executive', style: 'casual', activityLevel: 'very_active', phrases: ['Kurzes Update:', 'Bitte heute noch.', 'Das ist mir wichtig.', 'Danke 👍', 'Top!', 'Läuft.'], typoRate: 0.02, usesEmoji: true },
  { id: 'usr_002', name: 'Herbert Schöttl', role: 'COO, Verwaltungsrat', department: 'Operations', style: 'strict', activityLevel: 'very_active', phrases: ['Bitte beachten,', 'Ich erwarte,', 'Das ist so nicht ausreichend.', 'Zur Kenntnis.', 'Bitte umgehend erledigen.'], typoRate: 0.01, usesEmoji: false },
  { id: 'usr_003', name: 'Dr. Lena Hartmann', role: 'General Counsel', department: 'Legal', style: 'formal', activityLevel: 'occasional', phrases: ['Bitte zur Prüfung.', 'Rechtlich unbedenklich.', 'Freigabe erteilt.', 'Vor Versand prüfen.'], typoRate: 0.01, usesEmoji: false },
  { id: 'usr_004', name: 'Markus Eibl', role: 'CFO', department: 'Finance', style: 'neutral', activityLevel: 'regular', phrases: ['Bitte zuordnen.', 'Abgleich erledigt.', 'Im Budget.', 'Bitte Belege nachreichen.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_005', name: 'Isabella König', role: 'Head of Investor Relations', department: 'IR', style: 'formal', activityLevel: 'regular', phrases: ['Call-Protokoll hinterlegt.', 'Follow-up eingeplant.', 'Investor-Feedback positiv.', 'Unterlagen im CRM.'], typoRate: 0.01, usesEmoji: false },

  // Finance / Buchhaltung
  { id: 'usr_006', name: 'Sarah Anderst', role: 'Buchhaltung', department: 'Finance', style: 'neutral', activityLevel: 'regular', phrases: ['Ich habe erledigt.', 'Kurzer Hinweis:', 'Wurde gebucht.', 'Beleg liegt vor.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_007', name: 'Patrick Wieser', role: 'Accounting', department: 'Finance', style: 'casual', activityLevel: 'regular', phrases: ['Erledigt.', 'Ist drin.', 'Check.', 'Passt.'], typoRate: 0.08, usesEmoji: false },
  { id: 'usr_008', name: 'Nina Feldmann', role: 'Payroll', department: 'Finance', style: 'neutral', activityLevel: 'regular', phrases: ['Abrechnungen fertig.', 'Bitte prüfen:', 'Status aktualisiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_009', name: 'Emre Yilmaz', role: 'Controlling', department: 'Finance', style: 'neutral', activityLevel: 'regular', phrases: ['Abweichung festgestellt.', 'Bitte klären.', 'Report angehängt.'], typoRate: 0.03, usesEmoji: false },

  // Operations / COO Office
  { id: 'usr_010', name: 'Tobias Kern', role: 'Ops Manager', department: 'Operations', style: 'casual', activityLevel: 'very_active', phrases: ['Ist erledigt.', 'Kümmere mich drum.', 'Läuft.', 'Done.'], typoRate: 0.04, usesEmoji: true },
  { id: 'usr_011', name: 'Maja Lorenz', role: 'Executive Assistant', department: 'Operations', style: 'neutral', activityLevel: 'very_active', phrases: ['Termin eingetragen.', 'Reminder gesetzt.', 'Raum gebucht.', 'Agenda verschickt.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_012', name: 'Stefan Jäger', role: 'Process Lead', department: 'Operations', style: 'neutral', activityLevel: 'regular', phrases: ['Checkliste abgehakt.', 'Prozess angepasst.', 'Dokumentation aktualisiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_013', name: 'Viktor Neumann', role: 'Facility & Vendors', department: 'Operations', style: 'casual', activityLevel: 'occasional', phrases: ['Lieferant kontaktiert.', 'Angebot eingeholt.', 'Wartung geplant.', 'lg'], typoRate: 0.05, usesEmoji: false },

  // Sales / Partnerships
  { id: 'usr_014', name: 'Alessandro Vitale', role: 'Marketing/Partner', department: 'Growth', style: 'casual', activityLevel: 'regular', phrases: ['Kampagne live 🚀', 'Gute Zahlen!', 'Meeting war produktiv 👍', 'Feedback positiv.'], typoRate: 0.04, usesEmoji: true },
  { id: 'usr_015', name: 'Sophie Leitner', role: 'Partnerships', department: 'Growth', style: 'neutral', activityLevel: 'regular', phrases: ['Termin bestätigt.', 'Vertrag in Prüfung.', 'Partner meldet sich zurück.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_016', name: 'Jan Brüning', role: 'Sales Ops', department: 'Growth', style: 'casual', activityLevel: 'regular', phrases: ['Pipeline aktualisiert.', 'Deal-Status geändert.', 'CRM sauber.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_017', name: 'Rafael Stein', role: 'Enterprise Sales', department: 'Growth', style: 'casual', activityLevel: 'regular', phrases: ['Call war gut.', 'Nächste Schritte klar.', 'Proposal verschickt.'], typoRate: 0.03, usesEmoji: false },

  // Product / Engineering
  { id: 'usr_018', name: 'Miriam Koch', role: 'Product Lead', department: 'Product', style: 'neutral', activityLevel: 'very_active', phrases: ['Feature released.', 'User-Feedback eingearbeitet.', 'Roadmap aktualisiert.', 'Sprint-Review morgen.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_019', name: 'Noah Baumann', role: 'Frontend', department: 'Engineering', style: 'casual', activityLevel: 'regular', phrases: ['Fix deployed.', 'PR merged.', 'UI angepasst.', 'Build grün.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_020', name: 'David Schuster', role: 'Backend', department: 'Engineering', style: 'casual', activityLevel: 'very_active', phrases: ['API deployed.', 'Performance optimiert.', 'Bug gefixt.', 'Migration erfolgreich.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_021', name: 'Elif Demir', role: 'QA', department: 'Engineering', style: 'neutral', activityLevel: 'regular', phrases: ['Tests grün.', 'Regression gefunden.', 'QA abgeschlossen.', 'Bitte nochmal prüfen.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_022', name: 'Jonas Frei', role: 'DevOps', department: 'Engineering', style: 'casual', activityLevel: 'occasional', phrases: ['Deployment erfolgreich.', 'Server stabil.', 'Monitoring aktiv.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_023', name: 'Carla Weiss', role: 'UX/UI', department: 'Design', style: 'neutral', activityLevel: 'very_active', phrases: ['Designs fertig.', 'Prototyp verlinkt.', 'Feedback eingearbeitet.', 'Farben angepasst.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_024', name: 'Sven Hartl', role: 'Security', department: 'Engineering', style: 'strict', activityLevel: 'occasional', phrases: ['Sicherheitscheck bestanden.', 'Bitte Passwort ändern.', 'Risiko bewertet.', 'Audit abgeschlossen.'], typoRate: 0.01, usesEmoji: false },

  // Support / Client Success
  { id: 'usr_025', name: 'Yvonne Maier', role: 'Client Success', department: 'CS', style: 'neutral', activityLevel: 'regular', phrases: ['Kunde zufrieden.', 'Onboarding abgeschlossen.', 'Follow-up geplant.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_026', name: 'Hannah Berger', role: 'Support', department: 'CS', style: 'casual', activityLevel: 'regular', phrases: ['Ticket gelöst.', 'Rückmeldung erfolgt.', 'Anfrage weitergeleitet.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_027', name: 'Philipp Rauch', role: 'Support Lead', department: 'CS', style: 'neutral', activityLevel: 'very_active', phrases: ['Queue aufgearbeitet.', 'Eskalation geklärt.', 'SLA eingehalten.', 'Team-Update:'], typoRate: 0.02, usesEmoji: false },

  // Compliance / Risk
  { id: 'usr_028', name: 'Daniela Wolf', role: 'Compliance', department: 'Risk', style: 'formal', activityLevel: 'regular', phrases: ['Bitte beachten:', 'Freigabe erteilt.', 'Dokumentation erforderlich.', 'Compliance-Check bestanden.'], typoRate: 0.01, usesEmoji: false },
  { id: 'usr_029', name: 'Nils Kramer', role: 'AML Analyst', department: 'Risk', style: 'neutral', activityLevel: 'occasional', phrases: ['Prüfung abgeschlossen.', 'Keine Auffälligkeiten.', 'Bitte Unterlagen nachreichen.'], typoRate: 0.02, usesEmoji: false },

  // Research / Analysts
  { id: 'usr_030', name: 'Felix Brandt', role: 'Analyst', department: 'Research', style: 'neutral', activityLevel: 'regular', phrases: ['Analyse fertig.', 'Daten ausgewertet.', 'Report angehängt.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_031', name: 'Lea Winter', role: 'Analystin', department: 'Research', style: 'neutral', activityLevel: 'regular', phrases: ['Zahlen aktualisiert.', 'Trend erkennbar.', 'Bericht erstellt.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_032', name: 'Sami Kostic', role: 'Market Research', department: 'Research', style: 'casual', activityLevel: 'regular', phrases: ['Marktdaten aktualisiert.', 'Konkurrenzanalyse fertig.', 'Interessante Entwicklung.'], typoRate: 0.04, usesEmoji: false },
  { id: 'usr_033', name: 'Clara Mertens', role: 'Reporting', department: 'Research', style: 'neutral', activityLevel: 'regular', phrases: ['Update:', 'Report versendet.', 'Dashboard aktualisiert.', 'KPIs angepasst.'], typoRate: 0.02, usesEmoji: false },

  // Additional team members (sporadic)
  { id: 'usr_034', name: 'Kevin Schramm', role: 'Junior Analyst', department: 'Research', style: 'casual', activityLevel: 'sporadic', phrases: ['Frage:', 'Kann jemand helfen?', 'Wo finde ich...?'], typoRate: 0.06, usesEmoji: false },
  { id: 'usr_035', name: 'Vanessa Krug', role: 'Office', department: 'Operations', style: 'casual', activityLevel: 'sporadic', phrases: ['Erledigt.', 'Weitergeleitet.', 'Post ist da.'], typoRate: 0.04, usesEmoji: false },
  { id: 'usr_036', name: 'Tim Seidel', role: 'Data', department: 'Engineering', style: 'casual', activityLevel: 'sporadic', phrases: ['Query optimiert.', 'Daten exportiert.', 'Schema angepasst.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_037', name: 'Marlene Beck', role: 'HR', department: 'People', style: 'neutral', activityLevel: 'sporadic', phrases: ['Onboarding geplant.', 'Vertrag verschickt.', 'Gespräch terminiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_038', name: 'Oliver Hahn', role: 'Recruiting', department: 'People', style: 'neutral', activityLevel: 'sporadic', phrases: ['Kandidat kontaktiert.', 'Interview geplant.', 'Profil passt.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_039', name: 'Eren Kaya', role: 'SDR', department: 'Growth', style: 'casual', activityLevel: 'sporadic', phrases: ['Lead qualifiziert.', 'Termin gebucht 👍', 'Gutes Gespräch.'], typoRate: 0.05, usesEmoji: true },
  { id: 'usr_040', name: 'Klara Sommer', role: 'PR', department: 'Growth', style: 'neutral', activityLevel: 'sporadic', phrases: ['Pressemitteilung raus.', 'Artikel erschienen.', 'Interview bestätigt.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_041', name: 'Robert Fink', role: 'Legal Assistant', department: 'Legal', style: 'neutral', activityLevel: 'sporadic', phrases: ['Dokumente vorbereitet.', 'Zur Unterschrift bereit.', 'Frist notiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_042', name: 'Sabrina Vogt', role: 'Finance Assistant', department: 'Finance', style: 'casual', activityLevel: 'sporadic', phrases: ['Ok.', 'Passt.', 'Ist drin.', 'Erledigt.'], typoRate: 0.05, usesEmoji: false },
  { id: 'usr_043', name: 'Matthias Koller', role: 'IT Support', department: 'Engineering', style: 'casual', activityLevel: 'sporadic', phrases: ['Ticket geschlossen.', 'Zugang eingerichtet.', 'Problem gelöst.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_044', name: 'Julia Eckert', role: 'Executive Office', department: 'Operations', style: 'neutral', activityLevel: 'sporadic', phrases: ['Notiert.', 'Weitergeleitet.', 'Termin eingetragen.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_045', name: 'Hendrik Albers', role: 'Partnerships', department: 'Growth', style: 'neutral', activityLevel: 'sporadic', phrases: ['Partner bestätigt.', 'Vertrag unterzeichnet.', 'Kooperation startet.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_046', name: 'Anja Pohl', role: 'Reporting', department: 'Research', style: 'neutral', activityLevel: 'sporadic', phrases: ['Report erstellt.', 'Daten geprüft.', 'Tabelle aktualisiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_047', name: 'Murat Arslan', role: 'Operations', department: 'Operations', style: 'casual', activityLevel: 'sporadic', phrases: ['Erledigt.', 'Ist gemacht.', 'Check.'], typoRate: 0.07, usesEmoji: false },
  { id: 'usr_048', name: 'Luca Hein', role: 'QA Junior', department: 'Engineering', style: 'casual', activityLevel: 'sporadic', phrases: ['Getestet.', 'Funktioniert.', 'Bug gefunden.'], typoRate: 0.04, usesEmoji: false },
  { id: 'usr_049', name: 'Katharina Schmid', role: 'Finance', department: 'Finance', style: 'neutral', activityLevel: 'sporadic', phrases: ['Buchung erfolgt.', 'Abgestimmt.', 'Beleg archiviert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_050', name: 'Benedikt Seifert', role: 'Product', department: 'Product', style: 'neutral', activityLevel: 'sporadic', phrases: ['Feature spezifiziert.', 'Ticket erstellt.', 'Priorisiert.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_051', name: 'Saskia Brandl', role: 'CS', department: 'CS', style: 'neutral', activityLevel: 'sporadic', phrases: ['Kunde kontaktiert.', 'Feedback eingeholt.', 'Zufrieden.'], typoRate: 0.02, usesEmoji: false },
  { id: 'usr_052', name: 'Florian Reiter', role: 'Engineering', department: 'Engineering', style: 'casual', activityLevel: 'sporadic', phrases: ['Gefixt.', 'Deployed.', 'Läuft.'], typoRate: 0.03, usesEmoji: false },
  { id: 'usr_053', name: 'Theresa Auer', role: 'People Ops', department: 'People', style: 'neutral', activityLevel: 'sporadic', phrases: ['Team-Event geplant.', 'Feedback gesammelt.', 'Umfrage verschickt.'], typoRate: 0.02, usesEmoji: false },
];

// ============================================================================
// MESSAGE TEMPLATES BY THEME
// ============================================================================

const MESSAGE_TEMPLATES = {
  crm_hygiene: [
    'Bitte Kontakt sauber nachtragen.',
    'Status im CRM aktualisiert.',
    'Kontaktdaten ergänzt.',
    'Deal-Status geändert.',
    'Notizen hinzugefügt.',
    'Bitte Aktivität dokumentieren.',
    'CRM-Eintrag korrigiert.',
    'Duplikat zusammengeführt.',
  ],
  weekly_ops: [
    'Stand heute: alles im Plan.',
    'Nächste Schritte definiert.',
    'Weekly abgeschlossen.',
    'Offene Punkte geklärt.',
    'Action Items verteilt.',
    'Fortschritt wie besprochen.',
    'Statusupdate: auf Kurs.',
  ],
  investor_relations: [
    'Call-Protokoll im CRM hinterlegt.',
    'Follow-up offen.',
    'Investorengespräch positiv verlaufen.',
    'Unterlagen wurden angefordert.',
    'Präsentation verschickt.',
    'Nächster Termin vereinbart.',
  ],
  legal_compliance: [
    'Bitte Wording prüfen.',
    'Freigabe nur nach Prüfung.',
    'Dokumentation erforderlich.',
    'Vertrag zur Unterschrift bereit.',
    'Compliance-Check bestanden.',
    'Rechtliche Prüfung abgeschlossen.',
  ],
  finance: [
    'Abgleich erledigt.',
    'Bitte Rechnung zuordnen.',
    'Buchung erfolgt.',
    'Beleg nachgereicht.',
    'Zahlung veranlasst.',
    'Konto abgestimmt.',
  ],
  team_people: [
    'Bin morgen im Home Office.',
    'Urlaub eingetragen.',
    'Bin ab 14 Uhr erreichbar.',
    'Vertretung organisiert.',
    'Team-Meeting verschoben.',
    'Kurze Info: bin heute früher weg.',
  ],
  product_engineering: [
    'Fix deployed.',
    'QA ok.',
    'Feature live.',
    'Tests grün.',
    'Build erfolgreich.',
    'Performance optimiert.',
    'Bug behoben.',
    'PR gemerged.',
  ],
  client_success: [
    'Kunde wartet auf Rückmeldung.',
    'Ticket gelöst.',
    'Feedback eingeholt.',
    'Onboarding abgeschlossen.',
    'Zufriedenheit hoch.',
    'Eskalation geklärt.',
  ],
  partnerships: [
    'Termin bestätigt.',
    'Unterlagen im CRM.',
    'Partner meldet sich zurück.',
    'Vertrag in Prüfung.',
    'Kooperation gestartet.',
  ],
  reporting: [
    'Report aktualisiert.',
    'KPIs im Dashboard.',
    'Zahlen geprüft.',
    'Analyse fertig.',
    'Bericht versendet.',
  ],
  board_exec: [
    'Kurzes Update:',
    'Bitte heute noch erledigen.',
    'Das ist mir wichtig.',
    'Zur Kenntnis.',
    'Bitte beachten.',
    'Priorität hoch.',
  ],
  system_events: [
    'Neuer Kontakt angelegt',
    'Deal-Status geändert',
    'Notiz hinzugefügt',
    'Aufgabe abgeschlossen',
    'Dokument hochgeladen',
    'Termin erstellt',
    'Status aktualisiert',
  ],
};

const MEDIUM_MESSAGES = [
  'Habe gerade mit dem Kunden telefoniert. Sie brauchen bis Ende der Woche eine Rückmeldung. Bitte jemand aus dem Team übernehmen.',
  'Das Meeting heute war sehr produktiv. Die wichtigsten Punkte sind dokumentiert, bitte im CRM nachschauen.',
  'Reminder: Morgen ist Deadline für die Quartalsberichte. Bitte alle offenen Punkte bis heute Abend abschließen.',
  'Kurze Info an alle: Der neue Prozess startet ab nächster Woche. Dokumentation ist im Intranet verfügbar.',
  'Feedback vom Kunden eingetroffen. Insgesamt positiv, aber ein paar Punkte sollten wir besprechen.',
  'Die Analyse ist fertig. Ergebnisse sind vielversprechend. Details im angehängten Dokument.',
  'Team-Update: Wir haben das Quartalsziel erreicht. Danke an alle für den Einsatz!',
];

const LONG_MESSAGES = [
  'Zusammenfassung des heutigen Strategie-Meetings:\n\n1. Q3-Ergebnisse wurden besprochen - wir liegen über Plan\n2. Neue Partnerschaften werden priorisiert\n3. Tech-Roadmap für Q4 steht\n4. Recruiting wird verstärkt\n\nBitte die jeweiligen Verantwortlichen um Umsetzung der besprochenen Maßnahmen.',
  'An alle Abteilungsleiter:\n\nBitte beachten Sie die neuen Richtlinien für die Dokumentation im CRM. Ab sofort müssen alle Kundenkontakte innerhalb von 24 Stunden erfasst werden. Die Qualität unserer Daten ist entscheidend für unsere Analyse und Planung.\n\nBei Fragen stehe ich zur Verfügung.',
  'Wichtige Information bezüglich des kommenden Audits:\n\nAlle relevanten Unterlagen müssen bis Freitag vollständig und aktuell sein. Bitte prüft eure Bereiche und meldet eventuelle Lücken sofort. Die Compliance-Abteilung steht für Rückfragen bereit.\n\nVielen Dank für die Zusammenarbeit.',
];

const ATTACHMENTS_POOL: DemoAttachment[] = [
  { id: 'att_001', kind: 'file', fileName: 'Reporting_Q3_Status.pdf', fileSizeLabel: '2.4 MB' },
  { id: 'att_002', kind: 'file', fileName: 'CRM_Audit_Checklist.xlsx', fileSizeLabel: '156 KB' },
  { id: 'att_003', kind: 'file', fileName: 'Investor_Call_Notes.docx', fileSizeLabel: '89 KB' },
  { id: 'att_004', kind: 'file', fileName: 'Onboarding_Overview.pdf', fileSizeLabel: '1.2 MB' },
  { id: 'att_005', kind: 'file', fileName: 'Prozessdokumentation.pdf', fileSizeLabel: '3.1 MB' },
  { id: 'att_006', kind: 'file', fileName: 'Quartalsanalyse.xlsx', fileSizeLabel: '445 KB' },
  { id: 'att_007', kind: 'image', fileName: 'whiteboard.jpg', fileSizeLabel: '1.8 MB' },
  { id: 'att_008', kind: 'image', fileName: 'screenshot-dashboard.png', fileSizeLabel: '892 KB' },
  { id: 'att_009', kind: 'file', fileName: 'Meeting_Protokoll.docx', fileSizeLabel: '67 KB' },
  { id: 'att_010', kind: 'file', fileName: 'Budgetplanung_2024.xlsx', fileSizeLabel: '234 KB' },
];

// ============================================================================
// SEEDED RANDOM (Deterministic)
// ============================================================================

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ============================================================================
// DEMO FEED GENERATOR
// ============================================================================

export function generateDemoFeed(seed: number = 42): DemoFeedItem[] {
  const random = seededRandom(seed);
  const messages: DemoFeedItem[] = [];
  
  const now = new Date();
  const sevenMonthsAgo = new Date(now);
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  
  let messageId = 1;
  let currentDate = new Date(sevenMonthsAgo);
  
  // Activity weights by level
  const activityWeights = {
    very_active: 8,
    regular: 4,
    occasional: 2,
    sporadic: 1,
  };
  
  // Theme keys for random selection
  const themeKeys = Object.keys(MESSAGE_TEMPLATES).filter(k => k !== 'system_events') as (keyof typeof MESSAGE_TEMPLATES)[];
  
  // Generate messages day by day
  while (currentDate <= now) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip Sundays
    if (dayOfWeek === 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Saturday: only 1-2 times per month, 1-3 messages
    if (dayOfWeek === 6) {
      const weekOfMonth = Math.floor(currentDate.getDate() / 7);
      if (random() > 0.25 || weekOfMonth > 1) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
    }
    
    // Determine message count for this day (1-6 for weekdays, 1-3 for Saturday)
    const maxMessages = dayOfWeek === 6 ? 3 : 6;
    const minMessages = dayOfWeek === 6 ? 1 : 1;
    
    // Some days have no messages (15% chance on weekdays)
    if (dayOfWeek !== 6 && random() < 0.15) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Peak weeks (10% chance) have more messages
    const isPeakDay = random() < 0.1;
    const messageCount = isPeakDay 
      ? Math.floor(random() * 8) + 5 
      : Math.floor(random() * (maxMessages - minMessages + 1)) + minMessages;
    
    // Generate messages for this day
    const dailyMessages: { time: Date; member: TeamMember; content: string; type: 'message' | 'system'; attachments?: DemoAttachment[] }[] = [];
    
    for (let i = 0; i < messageCount; i++) {
      // Select member based on activity level
      const weightedMembers = TEAM_ROSTER.flatMap(m => 
        Array(activityWeights[m.activityLevel]).fill(m)
      );
      const member = weightedMembers[Math.floor(random() * weightedMembers.length)];
      
      // Sarah Anderst special case (Mutterschutz months 1-3)
      if (member.id === 'usr_006') {
        const monthsFromStart = (currentDate.getTime() - sevenMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000);
        if (monthsFromStart < 3 && random() > 0.1) continue;
      }
      
      // Generate timestamp (09:05-20:55)
      const timeSlot = random();
      let hour: number, minute: number;
      
      if (timeSlot < 0.35) {
        // Morning: 09:05-11:55
        hour = 9 + Math.floor(random() * 3);
        minute = 5 + Math.floor(random() * 50);
      } else if (timeSlot < 0.55) {
        // Midday: 12:05-14:20
        hour = 12 + Math.floor(random() * 2);
        minute = 5 + Math.floor(random() * 55);
      } else if (timeSlot < 0.85) {
        // Afternoon: 15:10-18:40
        hour = 15 + Math.floor(random() * 3);
        minute = 10 + Math.floor(random() * 50);
      } else {
        // Evening: 18:40-20:55
        hour = 18 + Math.floor(random() * 2);
        minute = 40 + Math.floor(random() * 15);
      }
      
      const msgTime = new Date(currentDate);
      msgTime.setHours(hour, minute, Math.floor(random() * 60), 0);
      
      // Determine message type (10-15% system events)
      const isSystemEvent = random() < 0.12;
      
      // Generate content
      let content: string;
      
      if (isSystemEvent) {
        content = MESSAGE_TEMPLATES.system_events[Math.floor(random() * MESSAGE_TEMPLATES.system_events.length)];
      } else {
        // Determine length: 55% short, 35% medium, 10% long
        const lengthRoll = random();
        
        if (lengthRoll < 0.55) {
          // Short message (use member phrases or short templates)
          if (random() < 0.6 && member.phrases.length > 0) {
            content = member.phrases[Math.floor(random() * member.phrases.length)];
          } else {
            const theme = themeKeys[Math.floor(random() * themeKeys.length)];
            const templates = MESSAGE_TEMPLATES[theme];
            content = templates[Math.floor(random() * templates.length)];
          }
        } else if (lengthRoll < 0.9) {
          // Medium message
          content = MEDIUM_MESSAGES[Math.floor(random() * MEDIUM_MESSAGES.length)];
        } else {
          // Long message (mainly from leadership)
          if (member.style === 'strict' || member.role.includes('Präsident') || member.role.includes('COO')) {
            content = LONG_MESSAGES[Math.floor(random() * LONG_MESSAGES.length)];
          } else {
            content = MEDIUM_MESSAGES[Math.floor(random() * MEDIUM_MESSAGES.length)];
          }
        }
        
        // Apply typos based on member's typo rate
        if (random() < member.typoRate) {
          content = applyTypo(content, random);
        }
        
        // Justin: 30% strict tone
        if (member.id === 'usr_001' && random() < 0.3) {
          content = content.replace(/\.$/, '') + ' Bitte heute noch.';
        }
      }
      
      // Attachments (8-12% of messages)
      let attachments: DemoAttachment[] | undefined;
      if (!isSystemEvent && random() < 0.10) {
        attachments = [ATTACHMENTS_POOL[Math.floor(random() * ATTACHMENTS_POOL.length)]];
      }
      
      dailyMessages.push({
        time: msgTime,
        member,
        content,
        type: isSystemEvent ? 'system' : 'message',
        attachments,
      });
    }
    
    // Sort by time and add to messages
    dailyMessages.sort((a, b) => a.time.getTime() - b.time.getTime());
    
    for (const msg of dailyMessages) {
      messages.push({
        id: messageId++,
        createdAt: msg.time.toISOString(),
        authorUserId: msg.member.id,
        authorUsername: msg.member.name,
        authorRole: msg.member.role,
        department: msg.member.department,
        message: msg.content,
        body: msg.content,
        type: msg.type,
        attachments: msg.attachments,
        meta: {
          tone: msg.member.style === 'strict' ? 'strict' : msg.member.style === 'casual' ? 'casual' : 'neutral',
          hasTypos: msg.content.includes('das ') && msg.content.includes(' das'),
        },
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Sort newest first
  messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return messages;
}

// ============================================================================
// TYPO HELPER
// ============================================================================

function applyTypo(text: string, random: () => number): string {
  const typoTypes = [
    (t: string) => t.replace(/\.$/, ''),  // Missing period
    (t: string) => t.replace(/, /, ' '),   // Missing comma
    (t: string) => t.replace(/dass/, 'das'), // dass/das confusion
    (t: string) => t.toLowerCase().replace(/^./, c => c.toUpperCase()), // Keep first letter
  ];
  
  const typoFn = typoTypes[Math.floor(random() * typoTypes.length)];
  return typoFn(text);
}

// ============================================================================
// DEMO MODE CHECK
// ============================================================================

export function isDemoModeActive(): boolean {
  // Check query param
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      return true;
    }
  }
  
  // Check env variable (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TEAM_FEED_DEMO === '1') {
    return true;
  }
  
  return false;
}

// ============================================================================
// CACHED DEMO DATA
// ============================================================================

let cachedDemoFeed: DemoFeedItem[] | null = null;

export function getDemoFeedItems(): DemoFeedItem[] {
  if (!cachedDemoFeed) {
    cachedDemoFeed = generateDemoFeed(42);
  }
  return cachedDemoFeed;
}
