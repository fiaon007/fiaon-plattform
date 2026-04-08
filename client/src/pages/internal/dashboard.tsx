/**
 * ============================================================================
 * ARAS TEAM COMMAND CENTER
 * ============================================================================
 * Modern dashboard with Team Feed, Calendar, Todos, Contracts, Actions
 * Premium ARAS CI - "Apple meets Neuralink"
 * ============================================================================
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  RefreshCw, Send, Plus, Calendar, Users, CheckSquare, FileText, 
  Zap, Clock, MessageSquare, ChevronRight, Check, AlertCircle,
  User, Building2, TrendingUp
} from "lucide-react";
import InternalLayout from "@/components/internal/internal-layout";
import { ArasDrawer } from "@/components/internal/aras-drawer";
import {
  FeedItemDrawerContent,
  CalendarEventDrawerContent,
  TodoDrawerContent,
  UserProfileDrawerContent,
  ContractDrawerContent,
  ActionItemDrawerContent,
} from "@/components/internal/drawer-contents";
import { TeamFeedSection } from "@/components/internal/team-feed-section";
import { MyTasksBoard } from "@/components/internal/my-tasks-board";
import { TeamCalendar } from "@/components/internal/team-calendar";
import { InboundMailCard } from "@/components/internal/inbound-mail-card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { formatDistanceToNow, format, isToday, isTomorrow, addDays, startOfDay } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// TYPES
// ============================================================================

interface FeedItem {
  id: number;
  authorUserId: string;
  authorUsername: string;
  type: string;
  message: string;
  category?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  createdAt: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
  color?: string;
  creatorUsername?: string;
}

interface Todo {
  id: number;
  title: string;
  description?: string;
  dueAt?: string;
  priority: string;
  status: string;
  assignedUsername?: string;
}

interface TeamUser {
  id: string;
  username: string;
  userRole: string;
}

interface Action {
  id: number;
  title: string;
  dueAt?: string;
  priority: string;
  type: string;
}

// ============================================================================
// MOCK TEAM MEMBERS (82 Mitarbeiter – Schwarzott Capital Partners AG)
// ============================================================================

const MOCK_TEAM_MEMBERS: TeamUser[] = [
  // ── Vorstand / Executive Board ──
  { id: 'tm-1', username: 'Justin Schwarzott', userRole: 'admin' },
  { id: 'tm-2', username: 'Herbert Schöttl', userRole: 'admin' },
  { id: 'tm-3', username: 'Sarah Anderst', userRole: 'admin' },
  { id: 'tm-4', username: 'Dr. Marcus Lehner', userRole: 'admin' },
  { id: 'tm-5', username: 'Sophie Kramer', userRole: 'admin' },
  // ── Investment Management ──
  { id: 'tm-6', username: 'Alexander Brandt', userRole: 'staff' },
  { id: 'tm-7', username: 'Dr. Katharina Voss', userRole: 'staff' },
  { id: 'tm-8', username: 'Maximilian Richter', userRole: 'staff' },
  { id: 'tm-9', username: 'Helena Berger', userRole: 'staff' },
  { id: 'tm-10', username: 'Tobias Engel', userRole: 'staff' },
  { id: 'tm-11', username: 'Lena Hoffmann', userRole: 'staff' },
  { id: 'tm-12', username: 'Felix Zimmermann', userRole: 'staff' },
  { id: 'tm-13', username: 'Marie-Louise Weber', userRole: 'staff' },
  { id: 'tm-14', username: 'Jan-Philipp Hartmann', userRole: 'staff' },
  { id: 'tm-15', username: 'Carla Neumann', userRole: 'staff' },
  { id: 'tm-16', username: 'David Schreiber', userRole: 'staff' },
  { id: 'tm-17', username: 'Nora Friedl', userRole: 'staff' },
  { id: 'tm-18', username: 'Simon Keller', userRole: 'staff' },
  { id: 'tm-19', username: 'Amelie Roth', userRole: 'staff' },
  { id: 'tm-20', username: 'Christian Maier', userRole: 'staff' },
  // ── Portfolio Management ──
  { id: 'tm-21', username: 'Dr. Stefan Gruber', userRole: 'staff' },
  { id: 'tm-22', username: 'Johanna Winkler', userRole: 'staff' },
  { id: 'tm-23', username: 'Patrick Lang', userRole: 'staff' },
  { id: 'tm-24', username: 'Vanessa Bauer', userRole: 'staff' },
  { id: 'tm-25', username: 'Moritz Schwarz', userRole: 'staff' },
  { id: 'tm-26', username: 'Theresa Huber', userRole: 'staff' },
  { id: 'tm-27', username: 'Niklas Pfeifer', userRole: 'staff' },
  { id: 'tm-28', username: 'Isabella König', userRole: 'staff' },
  { id: 'tm-29', username: 'Robert Falk', userRole: 'staff' },
  { id: 'tm-30', username: 'Clara Dietrich', userRole: 'staff' },
  // ── Finance & Controlling ──
  { id: 'tm-31', username: 'Thomas Reiter', userRole: 'staff' },
  { id: 'tm-32', username: 'Martina Stadler', userRole: 'staff' },
  { id: 'tm-33', username: 'Lukas Eder', userRole: 'staff' },
  { id: 'tm-34', username: 'Andrea Wimmer', userRole: 'staff' },
  { id: 'tm-35', username: 'Florian Haas', userRole: 'staff' },
  { id: 'tm-36', username: 'Birgit Moser', userRole: 'staff' },
  { id: 'tm-37', username: 'Michael Aigner', userRole: 'staff' },
  { id: 'tm-38', username: 'Sabine Koller', userRole: 'staff' },
  // ── Legal & Compliance ──
  { id: 'tm-39', username: 'Dr. Eva Steinbach', userRole: 'staff' },
  { id: 'tm-40', username: 'Christoph Hofer', userRole: 'staff' },
  { id: 'tm-41', username: 'Lisa-Marie Fuchs', userRole: 'staff' },
  { id: 'tm-42', username: 'Bernhard Lechner', userRole: 'staff' },
  { id: 'tm-43', username: 'Stefanie Pichler', userRole: 'staff' },
  { id: 'tm-44', username: 'Wolfgang Steiner', userRole: 'staff' },
  { id: 'tm-45', username: 'Katharina Brandl', userRole: 'staff' },
  { id: 'tm-46', username: 'Georg Strasser', userRole: 'staff' },
  // ── Risk Management ──
  { id: 'tm-47', username: 'Dr. Peter Wallner', userRole: 'staff' },
  { id: 'tm-48', username: 'Claudia Ebner', userRole: 'staff' },
  { id: 'tm-49', username: 'Markus Leitner', userRole: 'staff' },
  { id: 'tm-50', username: 'Anja Brunner', userRole: 'staff' },
  // ── Technology / Digital ──
  { id: 'tm-51', username: 'Daniel Kern', userRole: 'staff' },
  { id: 'tm-52', username: 'Julia Seidl', userRole: 'staff' },
  { id: 'tm-53', username: 'Andreas Holzer', userRole: 'staff' },
  { id: 'tm-54', username: 'Nina Pöschl', userRole: 'staff' },
  { id: 'tm-55', username: 'Kevin Binder', userRole: 'staff' },
  { id: 'tm-56', username: 'Laura Auer', userRole: 'staff' },
  { id: 'tm-57', username: 'Raphael Grünwald', userRole: 'staff' },
  { id: 'tm-58', username: 'Christina Mayer', userRole: 'staff' },
  // ── HR & People ──
  { id: 'tm-59', username: 'Petra Wiesinger', userRole: 'staff' },
  { id: 'tm-60', username: 'Manuel Ortner', userRole: 'staff' },
  { id: 'tm-61', username: 'Barbara Schuster', userRole: 'staff' },
  { id: 'tm-62', username: 'René Hackl', userRole: 'staff' },
  { id: 'tm-63', username: 'Nadine Pirker', userRole: 'staff' },
  // ── Investor Relations & Marketing ──
  { id: 'tm-64', username: 'Philipp Riedl', userRole: 'staff' },
  { id: 'tm-65', username: 'Anna-Lena Berger', userRole: 'staff' },
  { id: 'tm-66', username: 'Sebastian Mayr', userRole: 'staff' },
  { id: 'tm-67', username: 'Elisabeth Thaler', userRole: 'staff' },
  { id: 'tm-68', username: 'Dominik Pauer', userRole: 'staff' },
  { id: 'tm-69', username: 'Maria Traxler', userRole: 'staff' },
  // ── Operations & Facility ──
  { id: 'tm-70', username: 'Harald Gasser', userRole: 'staff' },
  { id: 'tm-71', username: 'Iris Plank', userRole: 'staff' },
  { id: 'tm-72', username: 'Josef Wimmer', userRole: 'staff' },
  { id: 'tm-73', username: 'Sandra Hinterberger', userRole: 'staff' },
  { id: 'tm-74', username: 'Walter Lindner', userRole: 'staff' },
  { id: 'tm-75', username: 'Michaela Ertl', userRole: 'staff' },
  { id: 'tm-76', username: 'Ernst Grabner', userRole: 'staff' },
  { id: 'tm-77', username: 'Ulrike Fasching', userRole: 'staff' },
  // ── Office Management / Assistenz ──
  { id: 'tm-78', username: 'Tanja Pointner', userRole: 'staff' },
  { id: 'tm-79', username: 'Verena Strobl', userRole: 'staff' },
  { id: 'tm-80', username: 'Marco Obermüller', userRole: 'staff' },
  { id: 'tm-81', username: 'Jasmin Danzer', userRole: 'staff' },
  { id: 'tm-82', username: 'Stefan Reisinger', userRole: 'staff' },
];

// ============================================================================
// MOCK TEAM TODOS (55+ Tasks – Schwarzott Capital Partners AG)
// ============================================================================

const MOCK_TEAM_TODOS: Todo[] = [
  // ── Active / In Progress ──
  { id: 9001, title: 'Due Diligence Report – MedTech AG finalisieren', description: 'Finanzmodell und Market-Sizing abschließen, Board-Vorlage erstellen.', dueAt: '2026-02-07T17:00:00Z', priority: 'critical', status: 'in_progress', assignedUsername: 'Alexander Brandt' },
  { id: 9002, title: 'Quartalsreporting Q4/2025 an LPs versenden', description: 'NAV-Berechnung, Performance-Attribution und Portfolio-Kommentar für alle Investoren.', dueAt: '2026-02-10T12:00:00Z', priority: 'critical', status: 'in_progress', assignedUsername: 'Thomas Reiter' },
  { id: 9003, title: 'ESG-Assessment für GreenEnergy Solutions aktualisieren', description: 'Scope 1-3 Emissionen, Governance-Score und Social Impact Metrics einpflegen.', dueAt: '2026-02-12T16:00:00Z', priority: 'high', status: 'in_progress', assignedUsername: 'Johanna Winkler' },
  { id: 9004, title: 'Investment Committee Deck: LogiChain GmbH', description: 'Series-B Bewertung, Marktanalyse und Empfehlung für das IC vorbereiten.', dueAt: '2026-02-09T10:00:00Z', priority: 'critical', status: 'in_progress', assignedUsername: 'Dr. Katharina Voss' },
  { id: 9005, title: 'AIFM-Regulatorik Update – BaFin-Meldung vorbereiten', description: 'Halbjährliche Meldung nach §35 KAGB, Risikobericht und Liquiditätsreporting.', dueAt: '2026-02-14T15:00:00Z', priority: 'high', status: 'in_progress', assignedUsername: 'Dr. Eva Steinbach' },
  { id: 9006, title: 'Tech-Stack Migration ARAS Plattform – Phase 2', description: 'Backend-Migration auf neue Architektur, API-Endpunkte testen.', dueAt: '2026-02-20T18:00:00Z', priority: 'high', status: 'in_progress', assignedUsername: 'Daniel Kern' },
  { id: 9007, title: 'Board Meeting Vorbereitung – NovaPharma Holding', description: 'Agenda, Finanz-Update und Strategie-Paper für Aufsichtsratssitzung.', dueAt: '2026-02-11T09:00:00Z', priority: 'high', status: 'in_progress', assignedUsername: 'Sarah Anderst' },
  { id: 9008, title: 'Cashflow-Forecast 2026 für alle Portfolio-Gesellschaften', description: 'Konsolidierte Cashflow-Planung inkl. Ausschüttungen und Cap Calls.', dueAt: '2026-02-13T14:00:00Z', priority: 'high', status: 'in_progress', assignedUsername: 'Martina Stadler' },

  // ── Pending – Investment ──
  { id: 9009, title: 'Term Sheet Review – FinBridge Technologies', description: 'Konditionen prüfen: Liquidation Preference, Anti-Dilution, Board Seats.', dueAt: '2026-02-15T11:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Maximilian Richter' },
  { id: 9010, title: 'Marktstudie Cybersecurity-Sektor beauftragen', description: 'TAM/SAM/SOM-Analyse für potentielles Investment in SecureNet AG.', dueAt: '2026-02-18T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Helena Berger' },
  { id: 9011, title: 'Co-Investment Proposal an Syndikatspartner senden', description: 'Beteiligungsstruktur und LP-Allocation für DataVault-Deal abstimmen.', dueAt: '2026-02-17T16:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Tobias Engel' },
  { id: 9012, title: 'Exit-Strategie SolarPeak AG – Optionenanalyse', description: 'IPO vs. Trade Sale vs. Secondary Buyout evaluieren, Advisor mandatieren.', dueAt: '2026-02-22T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Lena Hoffmann' },
  { id: 9013, title: 'Pipeline-Review: 14 neue Dealflow-Opportunities screenen', description: 'Erstbewertung der eingegangenen Pitch Decks, Top-5 für Deep Dive auswählen.', dueAt: '2026-02-16T14:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Felix Zimmermann' },
  { id: 9014, title: 'Management-Präsentation CloudScale GmbH reviewen', description: 'Wachstumskennzahlen, Unit Economics und Expansion-Plan gegenlesen.', dueAt: '2026-02-19T09:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Marie-Louise Weber' },

  // ── Pending – Portfolio ──
  { id: 9015, title: 'Monatliche KPI-Reports aller 22 Portfolio-Firmen einsammeln', description: 'Revenue, EBITDA, Burn Rate, Headcount – Deadline für Reporting.', dueAt: '2026-02-08T18:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Patrick Lang' },
  { id: 9016, title: 'Portfolio Company Review – AlpinTech Industries', description: 'Operative Performance, Budgetabweichung und Management Alignment prüfen.', dueAt: '2026-02-21T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Vanessa Bauer' },
  { id: 9017, title: 'Nachfolgeplanung CEO BioGenesis GmbH begleiten', description: 'Kandidatenliste sichten, Headhunter-Briefing und Interview-Prozess aufsetzen.', dueAt: '2026-02-25T11:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Moritz Schwarz' },
  { id: 9018, title: 'Add-on Akquisition für SmartFactory evaluieren', description: 'Synergieanalyse mit bestehendem Portfolio-Unternehmen IndustrieHub.', dueAt: '2026-02-28T15:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Theresa Huber' },
  { id: 9019, title: 'Valuation Update – Halbjährliche NAV-Berechnung', description: 'DCF-Modelle und Comparable Transactions für alle Holdings aktualisieren.', dueAt: '2026-03-01T12:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Dr. Stefan Gruber' },
  { id: 9020, title: 'Gesellschafterversammlung UrbanMobility AG vorbereiten', description: 'Einladung, Protokollentwurf und Beschlussvorlagen erstellen.', dueAt: '2026-02-24T09:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Isabella König' },

  // ── Pending – Legal / Compliance ──
  { id: 9021, title: 'SPA (Share Purchase Agreement) – TechVenture Deal finalisieren', description: 'Letzte Runde mit Kanzlei abstimmen, Signing-Termin koordinieren.', dueAt: '2026-02-14T11:00:00Z', priority: 'critical', status: 'pending', assignedUsername: 'Christoph Hofer' },
  { id: 9022, title: 'AML / KYC-Prüfung neuer LP-Investor aus Singapur', description: 'PEP-Screening, Herkunftsnachweis und Compliance-Freigabe.', dueAt: '2026-02-12T10:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Lisa-Marie Fuchs' },
  { id: 9023, title: 'DSGVO-Audit Portfoliounternehmen – Stichprobe Q1', description: '3 zufällige Portfolio-Firmen auf Datenschutz-Konformität prüfen.', dueAt: '2026-02-26T14:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Bernhard Lechner' },
  { id: 9024, title: 'Gesellschaftsvertrag NovaBau Holding anpassen', description: 'Neue Stimmenverteilung nach Kapitalerhöhung im Vertrag abbilden.', dueAt: '2026-02-20T16:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Stefanie Pichler' },
  { id: 9025, title: 'Handelsregister-Eintragung GreenFields Beteiligungen', description: 'Notar-Termin und Einreichung beim Amtsgericht koordinieren.', dueAt: '2026-02-18T11:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Wolfgang Steiner' },

  // ── Pending – Finance ──
  { id: 9026, title: 'Capital Call Letter an LPs – Fund III', description: 'Abrufbetrag EUR 12M, Zahlungsfrist 10 Bankarbeitstage.', dueAt: '2026-02-10T09:00:00Z', priority: 'critical', status: 'pending', assignedUsername: 'Herbert Schöttl' },
  { id: 9027, title: 'Jahresabschluss 2025 – Wirtschaftsprüfer-Unterlagen zusammenstellen', description: 'Saldenlisten, Darlehensverträge, Beteiligungsspiegel für KPMG.', dueAt: '2026-02-28T17:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Lukas Eder' },
  { id: 9028, title: 'Umsatzsteuer-Voranmeldung Januar 2026', description: 'Innergemeinschaftliche Leistungen und Vorsteuer-Abzug prüfen.', dueAt: '2026-02-10T15:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Andrea Wimmer' },
  { id: 9029, title: 'Bankgarantie für EnergiePark-Beteiligung verlängern', description: 'Verlängerungsantrag bei der Commerzbank einreichen.', dueAt: '2026-02-15T12:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Florian Haas' },
  { id: 9030, title: 'Transfer Pricing Documentation aktualisieren', description: 'Verrechnungspreise zwischen Holding und Tochtergesellschaften dokumentieren.', dueAt: '2026-03-05T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Birgit Moser' },

  // ── Pending – Risk ──
  { id: 9031, title: 'Währungsrisiko-Hedging für USD-Positionen prüfen', description: 'FX-Forward-Kontrakte für US-Portfolio-Beteiligungen evaluieren.', dueAt: '2026-02-19T14:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Dr. Peter Wallner' },
  { id: 9032, title: 'Stresstesting Portfolio – Rezessions-Szenario', description: 'Impact-Analyse: -20% Revenue bei 5 größten Holdings durchrechnen.', dueAt: '2026-02-25T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Claudia Ebner' },
  { id: 9033, title: 'Konzentrationsrisiko-Report für Aufsichtsrat', description: 'Sektor-, Geografie- und Single-Name-Exposure darstellen.', dueAt: '2026-02-23T15:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Markus Leitner' },

  // ── Pending – Tech ──
  { id: 9034, title: 'Investor-Portal: Neues Dashboard für LP-Reporting live schalten', description: 'Frontend-Tests abschließen, Staging-Freigabe einholen.', dueAt: '2026-02-21T18:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Julia Seidl' },
  { id: 9035, title: 'Backup-Strategie für Fund-Datenbank überprüfen', description: 'RPO/RTO prüfen, Disaster Recovery Test durchführen.', dueAt: '2026-02-17T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Andreas Holzer' },
  { id: 9036, title: 'CRM-Migration: Deal-Pipeline nach Salesforce übertragen', description: 'Datenqualität sichern, Mapping-Tabellen finalisieren.', dueAt: '2026-02-27T12:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Nina Pöschl' },
  { id: 9037, title: 'Cybersecurity Awareness Training organisieren', description: 'Phishing-Simulation und Schulung für alle Mitarbeiter planen.', dueAt: '2026-03-03T09:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Kevin Binder' },

  // ── Pending – HR ──
  { id: 9038, title: 'Bewerbungsgespräche Junior Analyst – 8 Kandidaten', description: 'Interviews KW 7-8, Case Study vorbereiten.', dueAt: '2026-02-16T09:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Petra Wiesinger' },
  { id: 9039, title: 'Jahresgespräche 2025 abschließen – 12 ausstehend', description: 'Zielvereinbarungen und Bonusberechnung finalisieren.', dueAt: '2026-02-14T17:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Manuel Ortner' },
  { id: 9040, title: 'Onboarding-Package für 3 neue Mitarbeiter (März-Start)', description: 'IT-Ausstattung, Zugänge, Willkommensmappe und Mentor-Zuweisung.', dueAt: '2026-02-25T12:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Barbara Schuster' },

  // ── Pending – IR / Marketing ──
  { id: 9041, title: 'Investor Update Newsletter Q4 gestalten', description: 'Key Highlights, Portfolio News und Outlook 2026 für alle LPs.', dueAt: '2026-02-11T16:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Philipp Riedl' },
  { id: 9042, title: 'ARAS-Webseite: Portfolio-Seite aktualisieren', description: 'Neue Beteiligungen NovaPharma und LogiChain mit Logo und Beschreibung.', dueAt: '2026-02-13T10:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Anna-Lena Berger' },
  { id: 9043, title: 'LP Annual Meeting 2026 – Venue und Catering buchen', description: 'Termin: 26. März, Grand Hyatt München, 45 Personen.', dueAt: '2026-02-20T11:00:00Z', priority: 'high', status: 'pending', assignedUsername: 'Elisabeth Thaler' },
  { id: 9044, title: 'ESG Impact Report 2025 – Designvorlage erstellen', description: 'Infografiken, KPI-Visualisierung und Case Studies integrieren.', dueAt: '2026-03-01T14:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Dominik Pauer' },

  // ── Pending – Operations ──
  { id: 9045, title: 'Büroumzug 4. OG – Projektplan finalisieren', description: 'Umzugsfirma beauftragen, IT-Infrastruktur im neuen Bereich vorbereiten.', dueAt: '2026-02-22T09:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Harald Gasser' },
  { id: 9046, title: 'Konferenzraum-Buchungssystem erneuern', description: 'Neues Tool evaluieren und Implementierung koordinieren.', dueAt: '2026-02-28T11:00:00Z', priority: 'low', status: 'pending', assignedUsername: 'Iris Plank' },
  { id: 9047, title: 'Reisekostenabrechnung Q4 – 28 offene Belege prüfen', description: 'Compliance-Check und Freigabe aller ausstehenden Reisekosten.', dueAt: '2026-02-09T15:00:00Z', priority: 'medium', status: 'pending', assignedUsername: 'Josef Wimmer' },

  // ── Done (kürzlich abgeschlossen) ──
  { id: 9048, title: 'Investment Committee: Genehmigung DataVault Series A', description: 'EUR 8M Commitment genehmigt. Closing in KW 8.', dueAt: '2026-02-03T10:00:00Z', priority: 'critical', status: 'done', assignedUsername: 'Justin Schwarzott' },
  { id: 9049, title: 'LP-Bericht Fund II – Versand abgeschlossen', description: 'Performance-Report an 34 LPs per SecureMail versendet.', dueAt: '2026-02-01T14:00:00Z', priority: 'high', status: 'done', assignedUsername: 'Philipp Riedl' },
  { id: 9050, title: 'Compliance Training 2026 – alle Mitarbeiter absolviert', description: 'MiFID II, MAR und Insiderhandel-Schulung abgeschlossen.', dueAt: '2026-01-31T17:00:00Z', priority: 'high', status: 'done', assignedUsername: 'Katharina Brandl' },
  { id: 9051, title: 'IT-Sicherheitsaudit bestanden – ISO 27001 konform', description: 'Externer Auditor bestätigt Konformität, Zertifikat erhalten.', dueAt: '2026-01-28T12:00:00Z', priority: 'high', status: 'done', assignedUsername: 'Raphael Grünwald' },
  { id: 9052, title: 'Gesellschafterversammlung GreenFields – Protokoll erstellt', description: 'Beschlüsse zur Kapitalerhöhung und neuer Geschäftsführer protokolliert.', dueAt: '2026-01-30T16:00:00Z', priority: 'medium', status: 'done', assignedUsername: 'Georg Strasser' },
  { id: 9053, title: 'Neuer LP – Onboarding SwissLife Pension Fund', description: 'KYC abgeschlossen, Subscription Agreement unterzeichnet.', dueAt: '2026-02-04T11:00:00Z', priority: 'high', status: 'done', assignedUsername: 'Christoph Hofer' },
  { id: 9054, title: 'Portfolio Review Meeting – alle 22 Companies abgedeckt', description: 'Status-Updates von allen Managing Directors eingeholt und konsolidiert.', dueAt: '2026-02-02T15:00:00Z', priority: 'medium', status: 'done', assignedUsername: 'Dr. Stefan Gruber' },
  { id: 9055, title: 'Serverumstellung auf neue Cloud-Infrastruktur', description: 'AWS-Migration abgeschlossen, Zero-Downtime Deployment.', dueAt: '2026-01-27T18:00:00Z', priority: 'medium', status: 'done', assignedUsername: 'Laura Auer' },
];

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse rounded-lg bg-white/5 ${className}`}
      style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)' }}
    />
  );
}

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================

function GlassCard({ 
  children, 
  className = "",
  hover = true 
}: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
}) {
  return (
    <div 
      className={`rounded-2xl p-5 transition-all duration-300 ${hover ? 'hover:-translate-y-0.5' : ''} ${className}`}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(233,215,196,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// WIDGET HEADER COMPONENT
// ============================================================================

function WidgetHeader({ 
  icon: Icon, 
  title, 
  count,
  action,
  onAction 
}: { 
  icon: any; 
  title: string; 
  count?: number;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: '#FE9100' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Orbitron, sans-serif' }}>
          {title}
        </h3>
        {typeof count === 'number' && (
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}>
            {count}
          </span>
        )}
      </div>
      {action && onAction && (
        <button 
          onClick={onAction}
          className="text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{message}</p>
    </div>
  );
}

// ============================================================================
// PRIORITY BADGE
// ============================================================================

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#EAB308',
    low: '#6B7280',
  };
  const color = colors[priority] || colors.medium;
  
  return (
    <span 
      className="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
      style={{ background: `${color}20`, color }}
    >
      {priority}
    </span>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

// Drawer types
type DrawerType = 'feed' | 'calendar' | 'todo' | 'user' | 'contract' | 'action' | null;

export default function InternalDashboard() {
  const [feedMessage, setFeedMessage] = useState("");
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  
  // Drawer state
  const [drawerType, setDrawerType] = useState<DrawerType>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const { toast } = useToast();
  const { user } = useAuth() as { user: { id: string; username: string } | null };
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Open drawer handler
  const openDrawer = useCallback((type: DrawerType, item: any) => {
    setDrawerType(type);
    setSelectedItem(item);
  }, []);

  // Close drawer handler
  const closeDrawer = useCallback(() => {
    setDrawerType(null);
    setSelectedItem(null);
  }, []);

  // Navigate to CRM page
  const navigateToCRM = useCallback((entityType: string, entityId: string) => {
    const routes: Record<string, string> = {
      contact: '/internal/contacts',
      company: '/internal/companies',
      deal: '/internal/deals',
      task: '/internal/tasks',
      call: '/internal/calls',
      contract: '/internal/contracts',
    };
    const route = routes[entityType] || '/internal/dashboard';
    navigate(`${route}?selected=${entityId}`);
    closeDrawer();
  }, [navigate, closeDrawer]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ['command-center-feed'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/team-feed?limit=15', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch feed');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['command-center-calendar'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/team-calendar', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch calendar');
      return res.json();
    },
  });

  const { data: todosData, isLoading: todosLoading, refetch: refetchTodos } = useQuery({
    queryKey: ['command-center-todos'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/team-todos?limit=8', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch todos');
      return res.json();
    },
  });

  const { data: activeUsersData, isLoading: usersLoading } = useQuery({
    queryKey: ['command-center-active-users'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/active-users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['command-center-contracts'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/contracts/pending', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch contracts');
      return res.json();
    },
  });

  const { data: actionsData, isLoading: actionsLoading } = useQuery({
    queryKey: ['command-center-actions'],
    queryFn: async () => {
      const res = await fetch('/api/internal/command-center/action-center', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch actions');
      return res.json();
    },
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const postFeedMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch('/api/internal/command-center/team-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, type: 'note' }),
      });
      if (!res.ok) throw new Error('Failed to post');
      return res.json();
    },
    onSuccess: () => {
      setFeedMessage("");
      queryClient.invalidateQueries({ queryKey: ['command-center-feed'] });
      toast({ title: "✓ Update posted" });
    },
    onError: () => {
      toast({ title: "Failed to post update", variant: "destructive" });
    },
  });

  const createTodoMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch('/api/internal/command-center/team-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      setNewTodoTitle("");
      setShowAddTodo(false);
      queryClient.invalidateQueries({ queryKey: ['command-center-todos'] });
      toast({ title: "✓ Task created" });
    },
  });

  const toggleTodoMutation = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const res = await fetch(`/api/internal/command-center/team-todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: done ? 'done' : 'pending' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command-center-todos'] });
    },
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatRelativeDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return `Today ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Tomorrow ${format(date, 'HH:mm')}`;
    return format(date, 'dd.MM HH:mm');
  }, []);

  const next7Days = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startOfDay(new Date()), i));
    }
    return days;
  }, []);

  const feedItems: FeedItem[] = feedData?.items || [];
  const calendarEvents: CalendarEvent[] = calendarData?.events || [];
  const pendingContracts = contractsData?.contracts || [];
  const actions: Action[] = actionsData?.actions || [];

  // Merge mock data with API data (always show mock, add API on top)
  const activeUsers: TeamUser[] = useMemo(() => {
    const merged = [...MOCK_TEAM_MEMBERS];
    const mockNames = new Set(MOCK_TEAM_MEMBERS.map(m => m.username.toLowerCase()));
    for (const apiUser of (activeUsersData?.users || [])) {
      if (!mockNames.has(apiUser.username.toLowerCase())) {
        merged.push(apiUser);
      }
    }
    return merged;
  }, [activeUsersData]);

  const todos: Todo[] = useMemo(() => {
    const merged = [...MOCK_TEAM_TODOS];
    const mockIds = new Set(MOCK_TEAM_TODOS.map(t => t.id));
    for (const apiTodo of (todosData?.todos || [])) {
      if (!mockIds.has(apiTodo.id)) {
        merged.push(apiTodo);
      }
    }
    return merged;
  }, [todosData]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <InternalLayout>
      <div className="space-y-6 pb-12">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 
              className="text-2xl font-bold mb-1"
              style={{ 
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Team Command Center
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Live view of activity, priorities and approvals
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}>
              {format(new Date(), 'HH:mm')} CET
            </div>
            <button 
              onClick={() => {
                refetchFeed();
                refetchTodos();
              }}
              className="p-2 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)' }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* TEAM FEED - Premium Chat-Style Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="-mx-6"
        >
          <TeamFeedSection
            currentUserId={user?.id}
            currentUsername={user?.username}
            onItemClick={(item) => openDrawer('feed', item)}
          />
        </motion.div>

        {/* INBOUND MAIL — Premium Mega-Card (full width) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-8"
        >
          <InboundMailCard />
        </motion.div>

        {/* MY TASKS BOARD - Kanban Style */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8"
        >
          <MyTasksBoard />
        </motion.div>

        {/* TEAM CALENDAR - Full Width Executive Time Command Center */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ minHeight: '480px' }}
        >
          <TeamCalendar className="h-full" />
        </motion.div>

        {/* GRID - Members + Todos side by side under calendar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Team Members */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <GlassCard className="h-full">
              <WidgetHeader icon={Users} title="Team Members" count={activeUsers.length} />
              
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(254,145,0,0.3) transparent' }}>
                {usersLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))
                ) : activeUsers.length === 0 ? (
                  <EmptyState icon={Users} message="No team members found" />
                ) : (
                  activeUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => openDrawer('user', user)}
                      className="flex items-center gap-3 p-2 rounded-lg w-full text-left transition-colors hover:bg-white/[0.04]"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg, #FE9100, #a34e00)', color: 'white' }}
                      >
                        {user.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {user.username}
                        </p>
                        <p className="text-[10px] uppercase" style={{ color: user.userRole === 'admin' ? '#FE9100' : 'rgba(255,255,255,0.4)' }}>
                          {user.userRole}
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* Team Todos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <GlassCard className="h-full">
              <WidgetHeader 
                icon={CheckSquare} 
                title="Team Todos" 
                count={todos.filter(t => t.status !== 'done').length}
                action="+ Add"
                onAction={() => setShowAddTodo(true)}
              />
              
              {/* Quick Add */}
              {showAddTodo && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newTodoTitle.trim() && createTodoMutation.mutate(newTodoTitle.trim())}
                    placeholder="New task..."
                    autoFocus
                    className="flex-1 px-2 py-1.5 rounded text-sm outline-none"
                    style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid rgba(254,145,0,0.3)',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  />
                  <button
                    onClick={() => newTodoTitle.trim() && createTodoMutation.mutate(newTodoTitle.trim())}
                    className="px-2 py-1.5 rounded text-xs"
                    style={{ background: '#FE9100', color: 'white' }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(254,145,0,0.3) transparent' }}>
                {todosLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
                ) : todos.length === 0 ? (
                  <EmptyState icon={CheckSquare} message="No pending tasks" />
                ) : (
                  todos.filter(t => t.status !== 'done').concat(todos.filter(t => t.status === 'done')).map((todo) => (
                    <div 
                      key={todo.id} 
                      className="flex items-center gap-3 p-2 rounded-lg group transition-colors hover:bg-white/[0.04]"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTodoMutation.mutate({ id: todo.id, done: todo.status !== 'done' });
                        }}
                        className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ 
                          borderColor: todo.status === 'done' ? '#10B981' : 'rgba(255,255,255,0.2)',
                          background: todo.status === 'done' ? '#10B981' : 'transparent',
                        }}
                      >
                        {todo.status === 'done' && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <button
                        onClick={() => openDrawer('todo', todo)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p 
                          className="text-sm truncate"
                          style={{ 
                            color: todo.status === 'done' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)',
                            textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                          }}
                        >
                          {todo.title}
                        </p>
                        {todo.dueAt && (
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {formatRelativeDate(todo.dueAt)}
                          </p>
                        )}
                      </button>
                      <PriorityBadge priority={todo.priority} />
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* CONTRACTS PENDING */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <GlassCard className="h-full">
              <WidgetHeader icon={FileText} title="Pending Approvals" count={pendingContracts.length} />
              
              <div className="space-y-2">
                {contractsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)
                ) : pendingContracts.length === 0 ? (
                  <EmptyState icon={FileText} message="No pending approvals" />
                ) : (
                  pendingContracts.slice(0, 5).map((contract: any) => (
                    <button
                      key={contract.id}
                      onClick={() => openDrawer('contract', contract)}
                      className="flex items-center gap-3 p-2 rounded-lg w-full text-left transition-colors hover:bg-white/[0.04]"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(254,145,0,0.1)' }}
                      >
                        <FileText className="w-4 h-4" style={{ color: '#FE9100' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {contract.title || contract.filename || 'Contract'}
                        </p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {contract.assignedUsername || 'Unassigned'}
                        </p>
                      </div>
                      <span 
                        className="text-[9px] px-2 py-1 rounded"
                        style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308' }}
                      >
                        Pending
                      </span>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* ACTION CENTER */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="md:col-span-2 lg:col-span-2"
          >
            <GlassCard className="h-full">
              <WidgetHeader icon={Zap} title="Action Center" count={actions.length} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {actionsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
                ) : actions.length === 0 ? (
                  <div className="col-span-2">
                    <EmptyState icon={Zap} message="No urgent actions" />
                  </div>
                ) : (
                  actions.slice(0, 6).map((action) => (
                    <button
                      key={`${action.type}-${action.id}`}
                      onClick={() => openDrawer('action', action)}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/[0.04] w-full text-left"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: action.type === 'event' ? 'rgba(59,130,246,0.1)' : 'rgba(254,145,0,0.1)' }}
                      >
                        {action.type === 'event' ? (
                          <Calendar className="w-5 h-5" style={{ color: '#3B82F6' }} />
                        ) : (
                          <CheckSquare className="w-5 h-5" style={{ color: '#FE9100' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          {action.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {action.dueAt ? formatRelativeDate(action.dueAt) : 'No due date'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </button>
                  ))
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* FOOTER */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center pt-8"
        >
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span style={{ color: 'rgba(254,145,0,0.5)' }}>ARAS</span> Team Command Center
          </p>
        </motion.div>
      </div>

      {/* DRAWER */}
      <ArasDrawer
        isOpen={drawerType !== null}
        onClose={closeDrawer}
        title={
          drawerType === 'feed' ? 'Activity Details' :
          drawerType === 'calendar' ? selectedItem?.title || 'Event Details' :
          drawerType === 'todo' ? selectedItem?.title || 'Task Details' :
          drawerType === 'user' ? selectedItem?.username || 'Team Member' :
          drawerType === 'contract' ? selectedItem?.title || 'Contract Details' :
          drawerType === 'action' ? 'Action Required' :
          'Details'
        }
        subtitle={
          drawerType === 'feed' ? selectedItem?.authorUsername :
          drawerType === 'calendar' ? selectedItem?.startsAt ? format(new Date(selectedItem.startsAt), 'dd.MM.yyyy') : undefined :
          drawerType === 'user' ? selectedItem?.userRole :
          undefined
        }
        onOpenInCRM={
          drawerType === 'feed' && selectedItem?.targetType && selectedItem?.targetId
            ? () => navigateToCRM(selectedItem.targetType, selectedItem.targetId)
            : drawerType === 'contract' && selectedItem?.id
            ? () => navigateToCRM('contract', selectedItem.id)
            : undefined
        }
      >
        {drawerType === 'feed' && selectedItem && (
          <FeedItemDrawerContent
            item={selectedItem}
            onOpenInCRM={(type, id) => navigateToCRM(type, id)}
            onViewProfile={(userId) => {
              const user = activeUsers.find(u => u.id === userId);
              if (user) openDrawer('user', user);
            }}
          />
        )}
        {drawerType === 'calendar' && selectedItem && (
          <CalendarEventDrawerContent
            event={selectedItem}
            onCreateTask={() => {
              setShowAddTodo(true);
              setNewTodoTitle(selectedItem.title);
              closeDrawer();
            }}
          />
        )}
        {drawerType === 'todo' && selectedItem && (
          <TodoDrawerContent
            todo={selectedItem}
            onToggleStatus={(done) => {
              toggleTodoMutation.mutate({ id: selectedItem.id, done });
              closeDrawer();
            }}
          />
        )}
        {drawerType === 'user' && selectedItem && (
          <UserProfileDrawerContent
            user={selectedItem}
            onSendMessage={() => {
              toast({ title: 'Opening chat...' });
              navigate('/internal/chat');
              closeDrawer();
            }}
            onAssignTask={() => {
              setShowAddTodo(true);
              closeDrawer();
            }}
          />
        )}
        {drawerType === 'contract' && selectedItem && (
          <ContractDrawerContent
            contract={selectedItem}
            isAdmin={true}
            onApprove={() => {
              toast({ title: '✓ Contract approved' });
              queryClient.invalidateQueries({ queryKey: ['command-center-contracts'] });
              closeDrawer();
            }}
            onReject={(reason) => {
              toast({ title: `Contract rejected: ${reason}` });
              queryClient.invalidateQueries({ queryKey: ['command-center-contracts'] });
              closeDrawer();
            }}
            onViewPDF={() => navigate(`/internal/contracts/${selectedItem.id}`)}
          />
        )}
        {drawerType === 'action' && selectedItem && (
          <ActionItemDrawerContent
            action={selectedItem}
            onExecute={() => {
              if (selectedItem.type === 'todo') {
                navigate('/internal/tasks');
              } else if (selectedItem.type === 'event') {
                // Could navigate to calendar if exists
              }
              closeDrawer();
            }}
            onSnooze={(duration) => {
              toast({ title: `Snoozed for ${duration}` });
              closeDrawer();
            }}
          />
        )}
      </ArasDrawer>
    </InternalLayout>
  );
}
