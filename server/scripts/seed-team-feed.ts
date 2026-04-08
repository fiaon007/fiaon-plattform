/**
 * ============================================================================
 * ARAS TEAM FEED HISTORICAL SEED
 * ============================================================================
 * Populates the team_feed table with realistic historical messages
 * spanning the last 7 months to create the impression of long-term usage.
 * 
 * Run once with: npx tsx server/scripts/seed-team-feed.ts
 * ============================================================================
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ============================================================================
// TEAM ROSTER
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'user_justin', name: 'Justin Schwarzott', role: 'CEO', department: 'Geschäftsführung' },
  { id: 'user_herbert', name: 'Herbert Schöttl', role: 'CFO', department: 'Finanzen' },
  { id: 'user_sarah', name: 'Sarah Anderst', role: 'COO', department: 'Operations' },
  { id: 'user_michael', name: 'Michael Gruber', role: 'Head of Sales', department: 'Vertrieb' },
  { id: 'user_anna', name: 'Anna Hofer', role: 'Sales Manager', department: 'Vertrieb' },
  { id: 'user_thomas', name: 'Thomas Maier', role: 'Key Account Manager', department: 'Vertrieb' },
  { id: 'user_lisa', name: 'Lisa Weber', role: 'Marketing Lead', department: 'Marketing' },
  { id: 'user_markus', name: 'Markus Bauer', role: 'Developer', department: 'IT' },
  { id: 'user_julia', name: 'Julia Steiner', role: 'HR Manager', department: 'Personal' },
  { id: 'user_andreas', name: 'Andreas Huber', role: 'Legal Counsel', department: 'Recht' },
  { id: 'user_sandra', name: 'Sandra Koch', role: 'Finance Manager', department: 'Finanzen' },
  { id: 'user_peter', name: 'Peter Wagner', role: 'Operations Manager', department: 'Operations' },
  { id: 'user_maria', name: 'Maria Berger', role: 'Customer Success', department: 'Customer Success' },
  { id: 'user_florian', name: 'Florian Eder', role: 'Product Manager', department: 'Produkt' },
  { id: 'user_stefanie', name: 'Stefanie Fuchs', role: 'UX Designer', department: 'Produkt' },
];

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const MESSAGES = [
  // CRM & Sales - Batch 1
  { message: 'Deal mit Müller AG abgeschlossen! 🎉 250k ARR, starker Q3-Start.', type: 'announcement', author: 'user_michael' },
  { message: 'Pipeline Review heute um 14:00. Bitte alle Deals aktualisieren.', type: 'update', author: 'user_anna' },
  { message: 'Neuer Lead: Schneider GmbH, sehr interessiert an Enterprise-Paket.', type: 'post', author: 'user_thomas' },
  { message: 'Vertriebsmeeting verschoben auf Donnerstag 10:00.', type: 'update', author: 'user_michael' },
  { message: 'Demo bei Weber & Partner war super! Proposal geht heute raus.', type: 'post', author: 'user_anna' },
  { message: 'Q2 Zahlen sehen gut aus, 15% über Plan 💪', type: 'announcement', author: 'user_michael' },
  { message: 'Neukunde Bauer Holding ist onboard! Großes Potenzial.', type: 'post', author: 'user_thomas' },
  { message: 'Forecast für nächstes Quartal eingetragen.', type: 'update', author: 'user_anna' },
  { message: 'Wichtig: Preisliste wurde aktualisiert. Neue Version im Drive.', type: 'update', author: 'user_michael' },
  
  // Operations
  { message: 'Server-Wartung Samstag 02:00-04:00 Uhr. Kurze Downtime möglich.', type: 'announcement', author: 'user_sarah' },
  { message: 'Neues Onboarding-Template ist live. Bitte nutzen!', type: 'update', author: 'user_peter' },
  { message: 'Prozessoptimierung Phase 2 startet nächste Woche.', type: 'post', author: 'user_sarah' },
  { message: 'Support-Tickets heute alle bearbeitet ✅', type: 'post', author: 'user_maria' },
  { message: 'Wochenplanung steht. Alle Tasks zugewiesen.', type: 'update', author: 'user_peter' },
  { message: 'Infrastruktur-Update erfolgreich durchgeführt.', type: 'post', author: 'user_sarah' },
  { message: 'Neue SLA-Richtlinien sind aktiv. Bitte beachten!', type: 'update', author: 'user_peter' },
  
  // Finance & Legal
  { message: 'Quartalsabschluss fertig. Report im Shared Drive.', type: 'announcement', author: 'user_herbert' },
  { message: 'Neue Datenschutzrichtlinien ab 01. des Monats.', type: 'update', author: 'user_andreas' },
  { message: 'Budget für Q4 genehmigt. Details im Meeting morgen.', type: 'announcement', author: 'user_herbert' },
  { message: 'Verträge für Huber Projekt sind unterschrieben.', type: 'post', author: 'user_andreas' },
  { message: 'Rechnungen für September sind raus.', type: 'post', author: 'user_sandra' },
  { message: 'Audit-Vorbereitung läuft. Dokumente bitte bis Freitag.', type: 'update', author: 'user_herbert' },
  { message: 'Neue Reisekostenrichtlinie ab nächstem Monat.', type: 'update', author: 'user_sandra' },
  { message: 'Compliance-Schulung für alle Mitarbeiter geplant.', type: 'announcement', author: 'user_andreas' },
  
  // Product & Tech
  { message: 'Release 2.4 ist live! Neue Dashboard-Features.', type: 'announcement', author: 'user_florian' },
  { message: 'Bug im Export-Modul gefixt. Bitte testen.', type: 'update', author: 'user_markus' },
  { message: 'Neue UI-Designs für Mobile sind fertig. Feedback willkommen!', type: 'post', author: 'user_stefanie' },
  { message: 'API-Performance um 40% verbessert 🚀', type: 'announcement', author: 'user_markus' },
  { message: 'Sprint Review heute 15:00. Alle willkommen.', type: 'update', author: 'user_florian' },
  { message: 'Dark Mode ist jetzt verfügbar!', type: 'announcement', author: 'user_stefanie' },
  { message: 'Datenbank-Migration erfolgreich abgeschlossen.', type: 'post', author: 'user_markus' },
  { message: 'Neue Analytics-Features in der Pipeline.', type: 'post', author: 'user_florian' },
  
  // Marketing & HR
  { message: 'Neue Kampagne startet Montag. Content ist ready.', type: 'announcement', author: 'user_lisa' },
  { message: 'Zwei neue Kollegen starten nächste Woche!', type: 'announcement', author: 'user_julia' },
  { message: 'Webinar nächsten Donnerstag. Bitte weiterleiten!', type: 'update', author: 'user_lisa' },
  { message: 'Team-Event nächsten Freitag. Bitte anmelden!', type: 'post', author: 'user_julia' },
  { message: 'LinkedIn-Post hat 5000+ Views! 🎉', type: 'post', author: 'user_lisa' },
  { message: 'Mitarbeitergespräche Q4 - Termine werden versendet.', type: 'update', author: 'user_julia' },
  { message: 'Newsletter wurde versendet. 42% Open Rate!', type: 'post', author: 'user_lisa' },
  
  // Geschäftsführung
  { message: 'Strategie-Meeting war produktiv. Zusammenfassung folgt.', type: 'post', author: 'user_justin' },
  { message: 'Partnerschaft mit TechVenture ist fix! 🎉', type: 'announcement', author: 'user_justin' },
  { message: 'Investorengespräch lief sehr gut. Update im Führungskreis.', type: 'post', author: 'user_justin' },
  { message: 'Bitte alle KPIs bis Freitag aktualisieren.', type: 'update', author: 'user_herbert' },
  { message: 'Wochenstart-Call heute 09:00. Kurzes Update von jedem Team.', type: 'update', author: 'user_sarah' },
  { message: 'Q3 war unser bestes Quartal! Danke an alle 🙏', type: 'announcement', author: 'user_justin' },
  { message: 'Neue Büroräume werden bezogen. Timeline im Wiki.', type: 'update', author: 'user_sarah' },
  { message: 'Jahresplanung 2024 startet. Input willkommen!', type: 'post', author: 'user_herbert' },
  { message: 'Wir wachsen! 5 neue Stellen offen.', type: 'announcement', author: 'user_justin' },
  
  // Customer Success
  { message: 'Kundenfeedback war super positiv diese Woche!', type: 'post', author: 'user_maria' },
  { message: 'NPS gestiegen auf 72! Danke an alle 💪', type: 'announcement', author: 'user_maria' },
  { message: 'Onboarding für Meier AG erfolgreich abgeschlossen.', type: 'post', author: 'user_maria' },
  { message: 'Churn Rate auf Rekordtief! 0.8% 🎯', type: 'announcement', author: 'user_maria' },
  { message: 'Kundenschulung nächste Woche - alle eingeladen.', type: 'update', author: 'user_maria' },
  
  // Allgemein / Daily
  { message: 'Erinnerung: Dokumentation aktuell halten!', type: 'update', author: 'user_sarah' },
  { message: 'Super Teamwork diese Woche! 🙌', type: 'post', author: 'user_justin' },
  { message: 'Bitte Urlaubsanträge rechtzeitig einreichen.', type: 'update', author: 'user_julia' },
  { message: 'Neue Kaffeemaschine ist da! ☕', type: 'post', author: 'user_julia' },
  { message: 'Parkplatz 5 ist diese Woche gesperrt.', type: 'update', author: 'user_peter' },
  { message: 'Danke für den Einsatz beim Kundenprojekt!', type: 'post', author: 'user_herbert' },
  { message: 'Bitte Timesheets bis Freitag eintragen.', type: 'update', author: 'user_sandra' },
  { message: 'Office-Renovierung startet am Wochenende.', type: 'update', author: 'user_peter' },
  { message: 'Frohe Weihnachten an alle! 🎄', type: 'post', author: 'user_justin' },
  { message: 'Frohes neues Jahr! Los gehts 2024! 🚀', type: 'post', author: 'user_justin' },
  { message: 'Team-Lunch morgen 12:30. Alle dabei?', type: 'post', author: 'user_julia' },
  { message: 'Reminder: Sicherheitsschulung bis Ende des Monats.', type: 'update', author: 'user_andreas' },
  { message: 'IT-Support: Bitte Tickets im System eintragen.', type: 'update', author: 'user_markus' },
  { message: 'Wochenende steht vor der Tür! Allen einen guten Feierabend 🌅', type: 'post', author: 'user_sarah' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRandomMember(): TeamMember {
  return TEAM_MEMBERS[Math.floor(Math.random() * TEAM_MEMBERS.length)];
}

function getRandomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function generateTimestamp(daysAgo: number, hourOffset: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  // Working hours: 09:00 - 18:00
  const hour = 9 + Math.floor(Math.random() * 9) + hourOffset;
  const minute = Math.floor(Math.random() * 60);
  date.setHours(hour, minute, 0, 0);
  
  // Skip weekends
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() + 1);
  if (day === 6) date.setDate(date.getDate() + 2);
  
  return date;
}

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedTeamFeed() {
  console.log('🌱 Starting Team Feed seed...\n');
  
  const messages: Array<{
    actor_user_id: string;
    actor_name: string;
    author_user_id: string;
    author_name: string;
    action_type: string;
    entity_type: string | null;
    entity_id: string | null;
    title: string;
    body: string;
    message: string;
    type: string;
    meta: string;
    created_at: Date;
  }> = [];

  // Generate ~40-50 messages spread over 7 months (210 days)
  const totalMessages = 45;
  
  for (let i = 0; i < totalMessages; i++) {
    // Spread messages across 7 months
    const daysAgo = Math.floor((i / totalMessages) * 210);
    const hourOffset = Math.floor(Math.random() * 3);
    const timestamp = generateTimestamp(daysAgo, hourOffset);
    
    const msg = getRandomMessage();
    const authorId = msg.author;
    const author = TEAM_MEMBERS.find(m => m.id === authorId) || getRandomMember();
    
    messages.push({
      actor_user_id: author.id,
      actor_name: author.name,
      author_user_id: author.id,
      author_name: author.name,
      action_type: 'post',
      entity_type: null,
      entity_id: null,
      title: msg.message.substring(0, 100),
      body: msg.message,
      message: msg.message,
      type: msg.type,
      meta: JSON.stringify({ department: author.department, role: author.role }),
      created_at: timestamp,
    });
  }

  // Sort by date (oldest first)
  messages.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  console.log(`📝 Inserting ${messages.length} historical messages...\n`);

  for (const msg of messages) {
    try {
      await db.execute(sql`
        INSERT INTO team_feed (
          actor_user_id,
          actor_name,
          author_user_id,
          author_name,
          action_type,
          entity_type,
          entity_id,
          title,
          body,
          message,
          type,
          meta,
          created_at
        ) VALUES (
          ${msg.actor_user_id},
          ${msg.actor_name},
          ${msg.author_user_id},
          ${msg.author_name},
          ${msg.action_type},
          ${msg.entity_type},
          ${msg.entity_id},
          ${msg.title},
          ${msg.body},
          ${msg.message},
          ${msg.type},
          ${msg.meta}::jsonb,
          ${msg.created_at.toISOString()}
        )
      `);
      console.log(`✅ ${msg.created_at.toLocaleDateString('de-DE')} - ${msg.author_name}: ${msg.message.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Error inserting message:`, error);
    }
  }

  console.log('\n🎉 Team Feed seed complete!');
  console.log(`   Total messages inserted: ${messages.length}`);
  process.exit(0);
}

// Run the seed
seedTeamFeed().catch(console.error);
