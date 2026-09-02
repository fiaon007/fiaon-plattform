// ═══════════════════════════════════════════════════════════════════════════
// JEDE SEITE LÄUFT IM CHEFBÜRO (27.08.2026)
//
// Justin: „Es verlinken noch SEHR viele Seiten auf /admin/kunden. Wir sagten
//          doch, der Chef-Bereich soll cinematisch, WOW sein — dieser sieht
//          echt kacke aus. Bitte optimiere jede Seite, JEDE Seite soll dort
//          laufen, nicht aufs alte Admin Dashboard verlinken!"
//
// Er hat recht, und der Grund war Bequemlichkeit: Die acht Räume waren
// Kachellisten, deren Kacheln nach `/admin/...` führten. Wer im Chefbüro auf
// „Kunden-Zentrale" klickte, landete in der alten hellen Oberfläche — der
// Raum war nur ein Vorzimmer.
//
// ── WIE DAS OHNE VIERZIG NEUBAUTEN GEHT ───────────────────────────────────
// Die Admin-Seiten sind hüllenlos gebaut: `App.tsx` legt die AdminShell erst
// von aussen darüber (`function admin(Component)`). Dieselbe Komponente
// lässt sich also genauso gut in die ChefShell setzen. Was fehlt, ist das
// Aussehen — die Seiten tragen Tailwind-Klassen mit hellen Farben
// (`bg-white`, `text-slate-900`). Die übersetzt `chefbuero-seiten.css` an
// EINER Stelle ins Dunkle.
//
// Vierzig Seiten einzeln nachzubauen wäre wochenlange Arbeit und hätte
// vierzig Gelegenheiten, etwas kaputt zu machen, das heute funktioniert.
//
// ── DIE UMLEITUNGEN, DIE JUSTIN AUFGEFALLEN SIND ──────────────────────────
// Sechs `/admin`-Adressen sind gar keine eigenen Seiten, sondern Sprünge auf
// `/admin/kunden` mit einem Fragezeichen dahinter:
//   database → ?kycOffen=1     personen → ?dubletten=1
//   leads    → ?stufe=C        kuendigungen → ?kuendigungen=1
//   kartei   → (ohne Filter)   nachbuchung/leistung → team
// Deshalb tragen die Einträge hier den Filter GLEICH MIT. Kein Sprung, kein
// Umweg — der Raum öffnet die Ansicht, die gemeint ist.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, type ComponentType } from "react";
import type { ChefStufe } from "./ChefShell";

const Kunden = lazy(() => import("@/pages/admin-kunden"));
const KundeAkte = lazy(() => import("@/pages/admin-kunde"));
const Zahlungen = lazy(() => import("@/pages/admin-zahlungen"));
const Konto = lazy(() => import("@/components/admin/ChefKonto"));
const Auszahlungen = lazy(() => import("@/pages/admin-auszahlungen"));
const Abrechnungen = lazy(() => import("@/pages/admin-abrechnungen"));
const Rechnungen = lazy(() => import("@/pages/admin-rechnungen"));
const Verbuchung = lazy(() => import("@/pages/admin-verbuchung"));
const Verbuchungen = lazy(() => import("@/pages/admin-verbuchungen"));
const Buchhaltung = lazy(() => import("@/pages/admin-buchhaltung"));
const Kontoabgleich = lazy(() => import("@/pages/admin-kontoabgleich"));
const Finanzen = lazy(() => import("@/pages/admin-finanzen"));
const Investoren = lazy(() => import("@/pages/admin-investoren"));
const Termine = lazy(() => import("@/pages/admin-termine"));
const LeadAutomatik = lazy(() => import("@/pages/admin-leads"));
const Mailwerk = lazy(() => import("@/components/admin/ChefMailwerk"));
const Postmeister = lazy(() => import("@/components/admin/ChefPostfach"));
const Dubletten = lazy(() => import("@/pages/admin-dubletten"));
const Fahrplan = lazy(() => import("@/pages/admin-fahrplan"));
const TeamZentrale = lazy(() => import("@/pages/admin-team-zentrale"));
const Vertraege = lazy(() => import("@/pages/admin-vertraege"));
const AgentPortal = lazy(() => import("@/pages/admin-agent-portal"));
const MailZentrale = lazy(() => import("@/pages/mail-zentrale"));
const Events = lazy(() => import("@/pages/admin-events"));
const Funktionen = lazy(() => import("@/pages/admin-funktionen"));
// Space verlangt die Eigenschaft `alsAdmin`, sonst spricht die Seite die
// Agent-Endpunkte an und verlangt eine Mitarbeiter-Anmeldung, die es im
// Chefbüro nicht gibt. Genau das war beim ersten Durchgang der Fall.
const SpaceRoh = lazy(() => import("@/pages/agent/space"));
const Space = () => <SpaceRoh alsAdmin />;
// Der FIAON Copilot (30.08.2026): dieselbe Bühne wie im Office, aber über die
// Chef-Endpunkte — sonst verlangte die Seite eine Mitarbeiter-Anmeldung, die
// es im Chefbüro nicht gibt (dieselbe Falle wie bei Space).
const AssistentRoh = lazy(() => import("@/pages/agent/assistent"));
const Assistent = () => <AssistentRoh alsAdmin />;
const Schulung = lazy(() => import("@/pages/admin-schulung"));
const Ratgeber = lazy(() => import("@/pages/admin-ratgeber"));
const Einstellungen = lazy(() => import("@/pages/admin-einstellungen"));
const Diagnose = lazy(() => import("@/pages/admin-diagnose"));
const Audit = lazy(() => import("@/pages/admin-audit"));
const Changelog = lazy(() => import("@/pages/admin-changelog"));
const Recht = lazy(() => import("@/pages/admin-recht"));
const Todo = lazy(() => import("@/pages/admin-todo"));
const Aufgaben = lazy(() => import("@/pages/admin-aufgaben"));
const Hub = lazy(() => import("@/pages/admin-hub"));

export interface ChefSeite {
  /** Adresse im Chefbüro: /chef/s/<slug> */
  slug: string;
  label: string;
  satz: string;
  Seite: ComponentType<any>;
  /** In welchen Raum die Kachel gehört. */
  raum: string;
  mindest?: ChefStufe;
  /**
   * Was beim Öffnen in der Adresszeile stehen muss, damit die Seite ihren
   * Filter findet — die Admin-Seiten lesen ihn aus der Suchzeichenkette.
   */
  suche?: string;
  /** Zusätzliche Suchworte für das Register. */
  auch?: string;
}

export const CHEF_SEITEN: ChefSeite[] = [
  // ── Lagezimmer ──────────────────────────────────────────────────────────
  { slug: "hub", label: "Tagesübersicht", satz: "Aufgaben, Warnungen, Tageszahlen des alten Dashboards.", Seite: Hub, raum: "lage", auch: "dashboard start" },
  { slug: "assistent", label: "Copilot", satz: "Der KI-Assistent des Hauses: erledigt Aufträge, alles mit Folgen bestätigst du.", Seite: Assistent, raum: "lage", mindest: "geschaeftsfuehrung", auch: "ki assistent copilot chat" },
  { slug: "todo", label: "Meine Liste", satz: "Was nur du tun kannst — Make, Brevo, Konten, Entscheidungen.", Seite: Todo, raum: "lage" },
  { slug: "aufgaben", label: "Notizen & Aufgaben", satz: "An Personen festgehalten oder ans Team vergeben.", Seite: Aufgaben, raum: "lage" },

  // ── Geld ────────────────────────────────────────────────────────────────
  // 02.09.2026, Justins Frage: „Airwallex ist jetzt verbunden — wo sehen wir
  // nun unser Konto?" Bis dahin nirgends. Steht bewusst VOR der
  // Zahlungsverwaltung: erst sehen, was hereinkam, dann damit arbeiten.
  { slug: "konto", label: "Geschäftskonto", satz: "Was auf dem Konto eingegangen ist, was davon zugeordnet ist und was nicht.", Seite: Konto, raum: "geld", mindest: "geschaeftsfuehrung", auch: "airwallex bank eingang iban kontostand geld" },
  { slug: "zahlungen-verwalten", label: "Zahlungsverwaltung", satz: "Offene Zahlungen prüfen, freischalten, Verlauf ansehen.", Seite: Zahlungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "verbuchung", label: "Zahlungen verbuchen", satz: "Vier Fälle, vier Reiter, jeweils mit Vorschau.", Seite: Verbuchung, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "kontoabgleich", label: "Kontoabgleich", satz: "Bank-Eingänge exakt mit Kunden abgleichen.", Seite: Kontoabgleich, raum: "geld", mindest: "geschaeftsfuehrung", auch: "bank kontoauszug wise" },
  { slug: "auszahlungen", label: "Auszahlungen", satz: "Provisions-Anforderungen des Teams freigeben.", Seite: Auszahlungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "abrechnungen", label: "Abrechnungen", satz: "Provisionsabrechnungen ansehen, als PDF öffnen, versenden.", Seite: Abrechnungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "verbuchungen", label: "Verbuchungen", satz: "Bestätigte Zahlungen: Umsatz, Provision, Netto.", Seite: Verbuchungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "buchhaltung", label: "Buchhaltung", satz: "Buchungsjournal und Ausbuchung.", Seite: Buchhaltung, raum: "geld", mindest: "geschaeftsfuehrung", auch: "ledger journal" },
  { slug: "rechnungen", label: "Rechnungen", satz: "Alle erzeugten Rechnungen durchsuchen und laden.", Seite: Rechnungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "finanzen", label: "Finanzen & Sales", satz: "Funnel, Umsatz, Marge, Werbekosten, Kampagnen.", Seite: Finanzen, raum: "geld", mindest: "geschaeftsfuehrung", auch: "cac marge funnel" },
  { slug: "investoren", label: "Investoren", satz: "Anfragen, Investments, Dokumente.", Seite: Investoren, raum: "geld", mindest: "geschaeftsfuehrung" },

  // ── Kunden ──────────────────────────────────────────────────────────────
  { slug: "kunden", label: "Kunden-Zentrale", satz: "Leads, Kunden, Anträge — mit Massenaktionen.", Seite: Kunden, raum: "kunden" },
  { slug: "kyc", label: "Ausweisprüfungen", satz: "Wer hat Unterlagen eingereicht, die noch niemand angesehen hat?", Seite: Kunden, raum: "kunden", suche: "kycOffen=1", auch: "kyc ausweis legitimation unterlagen" },
  { slug: "kuendigungen", label: "Kündigungen", satz: "Wer hat gekündigt, und was ist daraus geworden?", Seite: Kunden, raum: "kunden", suche: "kuendigungen=1", auch: "storno beenden" },
  { slug: "leads", label: "Kalte Leads (Stufe C)", satz: "Der Vorrat, aus dem nachgefasst wird.", Seite: Kunden, raum: "kunden", suche: "stufe=C", auch: "vorrat kalt" },
  { slug: "ohne-onboarding", label: "Bezahlt ohne Startgespräch", satz: "Die Kunden, bei denen das Onboarding hängt.", Seite: Kunden, raum: "kunden", suche: "bezahltOhneOnboarding=1" },
  { slug: "termine", label: "Termin-Zentrale", satz: "Alle Termine aller Mitarbeiter — und wer keinen hat.", Seite: Termine, raum: "kunden" },
  { slug: "lead-automatik", label: "Lead-Automatik", satz: "Nachfass-Maschine: Sendefenster, Bulk-Versand, Verteilung.", Seite: LeadAutomatik, raum: "kunden" },
  { slug: "dubletten", label: "Dubletten", satz: "Mehrfach angelegte Personen zusammenführen — umkehrbar.", Seite: Dubletten, raum: "kunden", auch: "doppelt merge trennen" },
  { slug: "fahrplan", label: "Fahrplan / Kundenprodukt", satz: "Upload-Review, KI-Analyse freigeben, Ziel-Freischaltung.", Seite: Fahrplan, raum: "kunden" },

  // ── Team ────────────────────────────────────────────────────────────────
  { slug: "team", label: "Team-Zentrale", satz: "Kennzahlen, Provisionen, Protokolle, Nachrichten.", Seite: TeamZentrale, raum: "team" },
  { slug: "nachbuchung", label: "Provision nachbuchen", satz: "Eine übersehene Provision nachträglich anlegen.", Seite: TeamZentrale, raum: "team", mindest: "geschaeftsfuehrung", suche: "tab=nachbuchung", auch: "nachtragen backfill" },
  { slug: "rangliste", label: "Rangliste & Leistung", satz: "Wer steht wo — auch zum Teilen.", Seite: TeamZentrale, raum: "team", suche: "rang=1", auch: "ranking wettbewerb deckungsbeitrag" },
  { slug: "einladen", label: "Teammitglied einladen", satz: "Neuen Mitarbeiter per E-Mail anlegen.", Seite: TeamZentrale, raum: "team", suche: "einladen=1" },
  { slug: "vertraege", label: "Onboarding & Verträge", satz: "Zustimmungen, Vertragsstand, Vorlagen, Nachweise.", Seite: Vertraege, raum: "team" },
  { slug: "agent-portal", label: "Team-Updates & Feedback", satz: "Portal-Updates posten, Feedback prüfen.", Seite: AgentPortal, raum: "team" },

  // ── Kommunikation ───────────────────────────────────────────────────────
  { slug: "mail-zentrale", label: "Mail-Zentrale", satz: "Freitext an Kunden und Gruppen, mit Vorschau.", Seite: MailZentrale, raum: "kommunikation" },
  { slug: "events", label: "E-Mail-Events", satz: "Make-Events testen, Diagnose, Verlauf.", Seite: Events, raum: "kommunikation", auch: "make brevo" },
  // 28.08.2026: die Steuerzentrale über dem neuen Mail-System — Versandweg,
  // Takte der Automatik, Vorschau und Prüfversand jeder Quelltext-Vorlage.
  { slug: "mailwerk", label: "Mailwerk", satz: "Alle 41 Mails sehen und steuern: Versandweg, Takte, Prüfversand.", Seite: Mailwerk, raum: "kommunikation", mindest: "geschaeftsfuehrung", auch: "mail email brevo make vorlage template versand automatik" },
  // Justins Zentrale (01.09.2026): „das soll nur meine Zentrale sein" — Stufe inhaber.
  { slug: "postmeister", label: "Postfach", satz: "Alle Kundenmails an einem Ort: was der Kunde schrieb, seine Akte daneben, die Antwort zum Prüfen", Seite: Postmeister, raum: "kommunikation", mindest: "inhaber", auch: "email agent gmail postfach support ki automatisch" },
  { slug: "funktionen", label: "Funktionen & Schulung", satz: "Alle Funktionen mit Klartext, Selbsttest, Schulungsmodus.", Seite: Funktionen, raum: "kommunikation" },
  { slug: "space", label: "Space", satz: "Der Feed des Teams — mitlesen, anpinnen, moderieren.", Seite: Space, raum: "kommunikation" },

  // ── Academy und Redaktion ───────────────────────────────────────────────
  { slug: "academy", label: "FIAON Academy", satz: "Einschulung als Kapitel-Reise je Abteilung.", Seite: Schulung, raum: "academy" },
  { slug: "ratgeber", label: "Ratgeber-Redaktion", satz: "Entwürfe lesen, Vorschau, Prüfstand, veröffentlichen.", Seite: Ratgeber, raum: "redaktion" },

  // ── System ──────────────────────────────────────────────────────────────
  { slug: "einstellungen", label: "Einstellungen", satz: "Provisionssatz, Auszahlung, Erinnerungen, Diagnose.", Seite: Einstellungen, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "diagnose", label: "System-Diagnose", satz: "Was klemmt gerade? Ereignisse, Rohdaten, KI-Auswertung.", Seite: Diagnose, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "audit", label: "Audit-Log", satz: "Alle Aktionen durchsuchbar.", Seite: Audit, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "changelog", label: "Was ist neu?", satz: "Alle Änderungen am System in Klartext.", Seite: Changelog, raum: "system" },
  { slug: "recht", label: "Rechtstexte-Status", satz: "Der Prüfstand der Rechtstexte.", Seite: Recht, raum: "system" },

  // ── Einzelakte: Ziel jeder Suche, keine Kachel ──────────────────────────
  { slug: "akte", label: "Kundenakte", satz: "Eine einzelne Person in ganzer Tiefe.", Seite: KundeAkte, raum: "" },
];

export const SEITE_NACH_SLUG = new Map(CHEF_SEITEN.map((s) => [s.slug, s]));

/** Die Kacheln eines Raums — in der Reihenfolge dieser Liste. */
export function seitenFuerRaum(raum: string): ChefSeite[] {
  return CHEF_SEITEN.filter((s) => s.raum === raum);
}

/** Die Chef-Adresse einer Seite, samt Filter. */
export function chefPfad(s: ChefSeite): string {
  return `/chef/s/${s.slug}${s.suche ? `?${s.suche}` : ""}`;
}
