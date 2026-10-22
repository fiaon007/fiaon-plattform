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
import { lazy, useEffect, type ComponentType } from "react";
import { useLocation } from "wouter";
import type { ChefStufe } from "./ChefShell";

const Kunden = lazy(() => import("@/pages/admin-kunden"));
// E-315 (09.10.2026): DIE EINE Akte — Mitarbeiter-Akte als Seite + Reiter „Verwaltung“ (admin-kunde im Modus verwaltung).
const KundeAkte = lazy(() => import("@/components/admin/ZentraleAkte"));
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
// E-409 (19.10.2026): der KI-Raum „KI-Team“ — Heute, Aras, Werkzeuge (Ampel), Qualität (Prüf-Mara), Einstellungen & Kasse.
// Justin hat die Regel „keine neuen Chef-Seiten“ für diesen Bereich ausdrücklich aufgehoben (fiaon-aras-telefon).
const KiHeute = lazy(() => import("@/components/admin/ChefKiHeute"));
const KiAras = lazy(() => import("@/components/admin/ChefKiAras"));
const KiWerkzeuge = lazy(() => import("@/components/admin/ChefKiWerkzeuge"));
const KiQualitaet = lazy(() => import("@/components/admin/ChefKiQualitaet"));
const KiEinstellungen = lazy(() => import("@/components/admin/ChefKiEinstellungen"));
const Dubletten = lazy(() => import("@/pages/admin-dubletten"));
const GlobalAuftraege = lazy(() => import("@/components/admin/ChefGlobalAuftraege"));
const FirmenRadar = lazy(() => import("@/components/admin/ChefRadar"));
// 21.09.2026 (E-201): Justins eigene Anrufseite — nur Stufe Inhaber.
const Telefonkartei = lazy(() => import("@/components/admin/ChefTelefonkartei"));
// 21.09.2026: Maras Steuerpult — sehen, steuern, nachvollziehen. Nur Stufe Inhaber.
const Mara = lazy(() => import("@/components/admin/ChefMara"));
const LeadMotor = lazy(() => import("@/components/admin/ChefLeadMotor"));
// 24.09.2026 (E-240): Die Bonitätsauskunft verkaufen — seit 26.09.2026 (E-243) der Reiter „Bonitätsauskunft"
// im Mara-Steuerpult (Justin: „nicht schon wieder eine neue eigene Seite"). Die alte Adresse führt dorthin.
function Umzug({ nach, wohin }: { nach: string; wohin: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(nach, { replace: true }); }, [nach, navigate]);
  return <div className="cb-hinweis" role="status"><b>Umgezogen.</b><p>Das steht jetzt im <a href={nach}>{wohin}</a>.</p></div>;
}
const AuskunftUmzug = () => <Umzug nach="/chef/s/mara?reiter=auskunft" wohin="Mara-Steuerpult, Reiter „Bonitätsauskunft“" />;
// E-409 × E-408 (20.10.2026, Justin: EIN Ort für Aras): Die Probe-Seite aus Aras Teil 1 (Mich anrufen, Stimmen-Studio, Ton,
// Daumen) ist jetzt der Reiter „Probe“ in KI-Team › Aras. Die alte Adresse /chef/s/aras-probe (Lesezeichen, Alarm-Links)
// leitet dorthin weiter — keine Kachel mehr im Raum „Vertrieb“, nichts doppelt.
const ArasProbeUmzug = () => <Umzug nach="/chef/s/aras#probe" wohin="KI-Team › Aras, Reiter „Probe“" />;
// 25.09.2026 (E-241): „Bis zur API kaufen wir sie selbst" — der Arbeitsplatz der Beschaffung.
const AuskunftBeschaffung = lazy(() => import("@/components/admin/ChefAuskunftBeschaffung"));
const Provisionen = lazy(() => import("@/components/admin/ChefProvisionen"));
const WhatsAppRaumSeite = lazy(() => import("@/components/whatsapp/WhatsAppRaum").then((m) => ({ default: () => <m.default basis="/chef/whatsapp" /> })));
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
// 11.09.2026 (E-177): Bewerbungen von /karriere — zehn Eingänge lagen ohne
// Status und ohne Zuständigen in einer zugeklappten Werkstatt-Karte.
const Bewerbungen = lazy(() => import("@/components/admin/Bewerbungen"));

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
  /**
   * Die Seite ist fürs Chefbüro gebaut (dunkel von Haus aus) und braucht die
   * Hell→Dunkel-Übersetzung `.cbs` nicht. Die übermalt Knöpfe und Links mit
   * `!important` — gut für alte Admin-Seiten, falsch für eigene (E-201).
   */
  eigenesDesign?: boolean;
  /**
   * E-252 (28.09.2026): Die Hülle bleibt ruhig — Kopf und Raumleiste kleben
   * nicht und sind matt, der Grund steht still. Justin: Glas nur an EINER
   * Stelle je Ansicht, nichts klebt, höchstens zwei Scrollbereiche. Gilt nur
   * für Seiten, die es hier sagen; heute nur das Mara-Steuerpult.
   */
  ruhig?: boolean;
  /**
   * E-IT-H (08.10.2026, Punkt 15): Die Seite füllt das Fenster — Höhe bis zum
   * Rand, die Seite selbst rollt nicht, gerollt wird nur im Inhalt (Klasse
   * `cb-voll`, chefbuero.css). Heute nur der WhatsApp-Raum.
   */
  vollflaeche?: boolean;
  /**
   * Aras-Cockpit (20.10.2026): kein Bild hinter der Seite (kein Alpen-Foto/Film), nur ein ruhiger Navy-Verlauf
   * (ChefShell `stillerGrund`, Klasse `cb-still`). Justin: „UI VIEL übersichtlicher, cleaner“ — Daten vor einem großen
   * Foto lesen sich schlecht. Heute nur /chef/s/aras.
   */
  stillerGrund?: boolean;
  /** E-342: kurzer Name für Menü und Wegeleiste (ohne Raum-Vorsilbe). */
  kurz?: string;
  /** E-342: keine Kachel, kein Reiter — nur Ziel von Suche und Links (die Kundenakte). */
  ohneKachel?: boolean;
  /** E-342: Langer Text ist hier INHALT (Chats, Mails, Notizen) — der Kurzmodus kürzt auf dieser Seite nichts. */
  volltext?: boolean;
}

export const CHEF_SEITEN: ChefSeite[] = [
  // ── Lagezimmer ──────────────────────────────────────────────────────────
  { slug: "hub", label: "Tagesübersicht", satz: "Aufgaben, Warnungen, Tageszahlen.", Seite: Hub, raum: "lage", auch: "dashboard start" },
  { slug: "assistent", label: "Copilot", volltext: true, satz: "Die KI erledigt Aufträge — du bestätigst.", Seite: Assistent, raum: "lage", mindest: "geschaeftsfuehrung", auch: "ki assistent copilot chat" },
  { slug: "todo", label: "Meine Liste", volltext: true, satz: "Was nur du tun kannst.", Seite: Todo, raum: "lage" },
  { slug: "aufgaben", label: "Notizen & Aufgaben", volltext: true, satz: "Notizen und Aufgaben fürs Team.", Seite: Aufgaben, raum: "lage" },

  // ── Geld ────────────────────────────────────────────────────────────────
  // 02.09.2026, Justins Frage: „Airwallex ist jetzt verbunden — wo sehen wir
  // nun unser Konto?" Bis dahin nirgends. Steht bewusst VOR der
  // Zahlungsverwaltung: erst sehen, was hereinkam, dann damit arbeiten.
  { slug: "konto", label: "Geschäftskonto", satz: "Eingänge auf dem Konto — zugeordnet oder offen.", Seite: Konto, raum: "geld", mindest: "geschaeftsfuehrung", auch: "airwallex bank eingang iban kontostand geld" },
  { slug: "zahlungen-verwalten", label: "Zahlungsverwaltung", satz: "Offene Zahlungen prüfen und freischalten.", Seite: Zahlungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "verbuchung", label: "Zahlungen verbuchen", satz: "Zahlungen verbuchen — mit Vorschau.", Seite: Verbuchung, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "kontoabgleich", label: "Kontoabgleich", satz: "Bank-Eingänge mit Kunden abgleichen.", Seite: Kontoabgleich, raum: "geld", mindest: "geschaeftsfuehrung", auch: "bank kontoauszug wise" },
  { slug: "auszahlungen", label: "Auszahlungen", satz: "Provisions-Anforderungen freigeben.", Seite: Auszahlungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "abrechnungen", label: "Abrechnungen", satz: "Provisionsabrechnungen als PDF.", Seite: Abrechnungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "provisionen", label: "Provisionen", satz: "Automatik an/aus und Vorgemerktes buchen.", Seite: Provisionen, raum: "geld", mindest: "geschaeftsfuehrung", eigenesDesign: true, auch: "provision automatik vormerkung buchen mitarbeiter" },
  { slug: "verbuchungen", label: "Verbuchungen", satz: "Umsatz, Provision, Netto je Zahlung.", Seite: Verbuchungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "buchhaltung", label: "Buchhaltung", satz: "Buchungsjournal und Ausbuchung.", Seite: Buchhaltung, raum: "geld", mindest: "geschaeftsfuehrung", auch: "ledger journal" },
  { slug: "rechnungen", label: "Rechnungen", satz: "Alle Rechnungen suchen und laden.", Seite: Rechnungen, raum: "geld", mindest: "geschaeftsfuehrung" },
  { slug: "finanzen", label: "Finanzen & Sales", satz: "Funnel, Umsatz, Marge, Werbekosten.", Seite: Finanzen, raum: "geld", mindest: "geschaeftsfuehrung", auch: "cac marge funnel" },
  { slug: "investoren", label: "Investoren", satz: "Anfragen, Investments, Dokumente.", Seite: Investoren, raum: "geld", mindest: "geschaeftsfuehrung" },

  // ── Kunden — im Menü „Betreuung“ (Raum-Schlüssel bleibt „kunden“) ─────────────
  { slug: "telefonkartei", label: "Telefonkartei", satz: "Deine Anrufseite — alle Kunden als Karten.", Seite: Telefonkartei, raum: "kunden", mindest: "inhaber", eigenesDesign: true, auch: "anrufen telefon whatsapp kontakt vcard iphone rechnung storno stornieren rueckruf rückruf a b c kunden kartei" },
  { slug: "kunden", label: "Kunden-Zentrale", satz: "Leads, Kunden, Anträge.", Seite: Kunden, raum: "kunden" },
  { slug: "kyc", label: "Ausweisprüfungen", satz: "Eingereichte Ausweise, noch ungeprüft.", Seite: Kunden, raum: "kunden", suche: "kycOffen=1", auch: "kyc ausweis legitimation unterlagen" },
  { slug: "kuendigungen", label: "Kündigungen", satz: "Wer gekündigt hat — und was daraus wurde.", Seite: Kunden, raum: "kunden", suche: "kuendigungen=1", auch: "storno beenden" },
  { slug: "ohne-onboarding", label: "Bezahlt ohne Startgespräch", satz: "Bezahlt, aber ohne Startgespräch.", Seite: Kunden, raum: "kunden", suche: "bezahltOhneOnboarding=1" },
  // 24.09.2026 (E-240): Justin — die Auskunft soll „weggehen wie warme Semmeln" (Ziel 150 am Tag).
  // 25.09.2026 (E-241): Trichter (angeschrieben → geliefert) und Steuerung (Kreis, Mails/WhatsApp je Tag, Liefermodus, Protokoll).
  // E-243 (26.09.2026): umgezogen ins Mara-Steuerpult — keine Kachel mehr (raum ""), die Adresse leitet weiter.
  { slug: "auskunft", label: "Auskunft-Verkauf (jetzt im Mara-Steuerpult)", satz: "Umgezogen ins Mara-Steuerpult.", Seite: AuskunftUmzug, raum: "", mindest: "inhaber", eigenesDesign: true },
  // 25.09.2026 (E-241): Bis die API steht, beschaffen wir die bezahlten Auskünfte selbst — hier, je Auftrag.
  { slug: "auskunft-beschaffung", label: "Auskunft-Beschaffung", satz: "Bezahlte Auskünfte: Auswertung, Bestellung, Upload.", Seite: AuskunftBeschaffung, raum: "kunden", mindest: "geschaeftsfuehrung", eigenesDesign: true, auch: "bonitätsauswertung auswertung bericht ampel 74 auskunft beschaffung beschaffen einkauf kaufen bestellen schufa ksv crif intrum boniversum hochladen upload pdf vollmacht einwilligung widerrufsfrist rückstand rueckstand lieferung api" },
  { slug: "termine", label: "Termin-Zentrale", satz: "Alle Termine aller Mitarbeiter.", Seite: Termine, raum: "kunden" },
  { slug: "dubletten", label: "Dubletten", satz: "Doppelte Personen zusammenführen.", Seite: Dubletten, raum: "kunden", auch: "doppelt merge trennen" },
  { slug: "fahrplan", label: "Fahrplan / Kundenprodukt", satz: "Uploads prüfen, Analysen freigeben.", Seite: Fahrplan, raum: "kunden" },

  // ── Vertrieb (E-336, 12.10.2026) ──────────────────────────────────────
  // Justin: Firmen-Radar „unter Bereich Kunden im Menü — WTF". Alles, was NEUE Kunden bringt, steht jetzt in
  // einem Raum: Mara, die Meta-Leads, der Nachfass und die kalten Leads. Firmen-Radar und Global-Aufträge stehen seit E-338 im Raum „global“
  // (Wunsch der Vertriebs-Sitzung: das Radar ist die Global-Akquise; Slug /chef/s/firmen-radar bleibt, Aufgaben und Rundgang verlinken darauf).
  // Die Adressen /chef/s/<slug> bleiben, wie sie waren — nur der Raum (und damit Kachel und Menü) ist neu.
  // E-294 (06.10.2026): fünfter Reiter „Social" (Social-Studio, ?reiter=social) — Seite bleibt Inhaber, die Studio-API ist ab Geschäftsführung offen.
  // ── KI-Team (E-409, 19.10.2026) — Raum „ki“: Mara und Aras an einem Ort ──
  { slug: "ki-heute", label: "KI-Team · Heute", kurz: "Heute", satz: "Mara und Aras heute — Zahlen, Karten, Not-Aus.", Seite: KiHeute, raum: "ki", eigenesDesign: true, ruhig: true, auch: "ki team heute mara aras karten entscheidungen notaus not-aus kosten prüf-mara pruef-mara gelb" },
  { slug: "aras", label: "Aras", kurz: "Aras", volltext: true, satz: "Dein KI-Kollege am Telefon — Probe, Anrufe, Plan.", Seite: KiAras, raum: "ki", mindest: "inhaber", eigenesDesign: true, ruhig: true, stillerGrund: true, auch: "aras telefon anruf anrufe stimme stimmen hörprobe hoerprobe stimmen-studio studio flitz nuri juni ton tempo energie füllwörter fuellwoerter daumen deckel warteschlange live transkript probe probeanruf mich anrufen plan spielart rate zusage zuruf notaus not-aus leerlauf ki kollege als nächstes naechstes tagesplan ausbaustufe stufe ampel feedback cockpit auflegen übernehmen uebernehmen" },
  // E-409: Das Mara-Steuerpult zieht in den Raum „ki“ um (Adresse /chef/s/mara bleibt — alte Links gehen weiter).
  { slug: "mara", label: "Mara-Steuerpult", kurz: "Mara", volltext: true, satz: "WhatsApp, Mail-Aktion, Auskunft, Termine, Social.", Seite: Mara, raum: "ki", mindest: "inhaber", eigenesDesign: true, ruhig: true, auch: "mara lindner aktion email ki agent steuerpult gedaechtnis gedächtnis a b zahlung rechnung whatsapp zentrale starten versand automatik vorlage gruppe leads abbrecher auskunft bonitaetsauskunft bonitätsauskunft schufa ksv crif verkauf scharf angebot ziel 150 trichter kreis liefermodus einkauf beschaffung protokoll steuerung termine termin rückruf rueckruf kalender abwesenheit abwesend urlaub vertreter vertretung anrufen social studio instagram facebook linkedin tiktok youtube shorts reel reels karussell post posts beitrag content inhalte freigabe redaktion caption hashtag profil raster" },
  { slug: "ki-werkzeuge", label: "Werkzeuge", kurz: "Werkzeuge", satz: "Was Mara und Aras allein dürfen: grün, gelb, rot.", Seite: KiWerkzeuge, raum: "ki", eigenesDesign: true, ruhig: true, auch: "ki werkzeuge ampel grün gelb rot mara aras erlaubnis freigabe geld erstattung storno" },
  { slug: "ki-qualitaet", label: "Qualität", kurz: "Qualität", satz: "Prüf-Mara: Fehlerquote, Befunde, Karten.", Seite: KiQualitaet, raum: "ki", eigenesDesign: true, ruhig: true, auch: "ki qualität qualitaet prüf-mara pruef-mara prüfung fehlerquote befund wortwand ton druck stichprobe transkript" },
  { slug: "ki-einstellungen", label: "Einstellungen & Kasse", kurz: "Einstellungen", satz: "Jeder Schalter, der wirkt — und die Kosten je Dienst.", Seite: KiEinstellungen, raum: "ki", mindest: "inhaber", eigenesDesign: true, ruhig: true, auch: "ki einstellungen kasse kosten deckel schalter register anbieter openai ki-pause protokoll whatsapp postfach mail-aktion rückholung auskunft prüfquote" },
  { slug: "lead-motor", label: "Lead-Motor", satz: "Facebook-Leads direkt von Meta.", Seite: LeadMotor, raum: "vertrieb", mindest: "inhaber", eigenesDesign: true, auch: "lead leads meta facebook instagram webhook formular kampagne anzeige make superchat whatsapp begrüßung begruessung willkommen link werbekosten kosten ausgaben cac zahlender kunde" },
  { slug: "lead-automatik", label: "Lead-Automatik", satz: "Nachfass: Sendefenster, Versand, Verteilung.", Seite: LeadAutomatik, raum: "vertrieb" },
  { slug: "leads", label: "Kalte Leads (Stufe C)", satz: "Der Vorrat zum Nachfassen.", Seite: Kunden, raum: "vertrieb", suche: "stufe=C", auch: "vorrat kalt" },
  // E-408 (20.10.2026) → E-409 × E-408: Aras’ Probe wohnt jetzt in KI-Team › Aras (Reiter „Probe“). Die alte Adresse leitet
  // weiter (raum "" = keine Kachel, kein Reiter — wie „auskunft“ oben).
  { slug: "aras-probe", label: "Aras-Probe (jetzt in KI-Team › Aras)", satz: "Umgezogen in den Raum „KI-Team“.", Seite: ArasProbeUmzug, raum: "", mindest: "inhaber", eigenesDesign: true },
  // 19.09.2026: Firmen-Radar — täglich 50 passende Firmen, Scan der Website, persönliche erste Mail.
  // Justin: „aber nicht bei Nikita, Admin!" — deshalb hier und erst ab Geschäftsführung.
  { slug: "firmen-radar", label: "Firmen-Radar", satz: "50 passende Firmen am Tag — Scan und erste Mail.", Seite: FirmenRadar, raum: "global", mindest: "geschaeftsfuehrung", auch: "radar akquise neukunden firmen b2b global kaltakquise mail leads suche" },
  // 17.09.2026 (E-188): FIAON Global — Firmenaufträge über die US-Struktur. Eigene Liste, weil ein
  // Auftrag über 2.499 bis 35.999 € mit Vertrag, Stichtag und zuständiger Person keine Zeile der
  // Privatkunden-Zentrale ist.
  { slug: "global-auftraege", label: "Global: Angebote & Aufträge", kurz: "Angebote & Aufträge", satz: "Angebote anlegen, Aufträge steuern.", Seite: GlobalAuftraege, raum: "global", auch: "global business firma firmenkunde b2b us llc struktur auftrag vertrag stichtag" },
  { slug: "geschaeftspartner", label: "Geschäftspartner", satz: "Kooperationen, Empfehlungen, Provision und Gutschriften.", Seite: GlobalAuftraege, raum: "global", suche: "reiter=partner", auch: "partner kooperation koop tippgeber provision gutschrift empfehlung chehade" },

  // ── Team ────────────────────────────────────────────────────────────────
  { slug: "team", label: "Team-Zentrale", satz: "Kennzahlen, Provisionen, Nachrichten.", Seite: TeamZentrale, raum: "team" },
  { slug: "nachbuchung", label: "Provision nachbuchen", satz: "Übersehene Provision nachtragen.", Seite: TeamZentrale, raum: "team", mindest: "geschaeftsfuehrung", suche: "tab=nachbuchung", auch: "nachtragen backfill" },
  { slug: "rangliste", label: "Rangliste & Leistung", satz: "Wer steht wo.", Seite: TeamZentrale, raum: "team", suche: "rang=1", auch: "ranking wettbewerb deckungsbeitrag" },
  { slug: "einladen", label: "Teammitglied einladen", satz: "Neuen Mitarbeiter anlegen.", Seite: TeamZentrale, raum: "team", suche: "einladen=1" },
  // 08.10.2026: Keine neue Seite (Hausregel) — ein Reiter der Team-Zentrale, wie „Provision nachbuchen“.
  { slug: "zugang-uebergeben", label: "Zugang übergeben", satz: "Zugang per Einmal-Link übergeben.", Seite: TeamZentrale, raum: "team", suche: "tab=zugang", auch: "zugang passwort startpasswort start-passwort übergabe uebergabe übergeben postfach e-mail email google workspace onboarding praktikum neue mitarbeiterin neuer mitarbeiter qr code link einmal" },
  { slug: "bewerbungen", label: "Bewerbungen", volltext: true, satz: "Bewerbungen — Zusage, Absage, Einladung.", Seite: Bewerbungen, raum: "team", auch: "karriere bewerber bewerbung einstellen recruiting" },
  { slug: "vertraege", label: "Onboarding & Verträge", satz: "Zustimmungen, Verträge, Nachweise.", Seite: Vertraege, raum: "team" },
  { slug: "agent-portal", label: "Team-Updates & Feedback", volltext: true, satz: "Updates posten, Feedback lesen.", Seite: AgentPortal, raum: "team" },
  { slug: "space", label: "Space", volltext: true, satz: "Der Team-Feed.", Seite: Space, raum: "team" },

  // ── Kommunikation ───────────────────────────────────────────────────────
  { slug: "mail-zentrale", label: "Mail-Zentrale", volltext: true, satz: "Freitext-Mails an Kunden und Gruppen.", Seite: MailZentrale, raum: "kommunikation" },
  { slug: "events", label: "E-Mail-Events", volltext: true, satz: "Make-Events testen und prüfen.", Seite: Events, raum: "kommunikation", auch: "make brevo" },
  // 28.08.2026: die Steuerzentrale über dem neuen Mail-System — Versandweg,
  // Takte der Automatik, Vorschau und Prüfversand jeder Quelltext-Vorlage.
  { slug: "mailwerk", label: "Mailwerk", satz: "Alle Mails: Versandweg, Takte, Prüfversand.", Seite: Mailwerk, raum: "kommunikation", mindest: "geschaeftsfuehrung", auch: "mail email brevo make vorlage template versand automatik" },
  // Justins Zentrale (01.09.2026): „das soll nur meine Zentrale sein" — Stufe inhaber.
  { slug: "postmeister", label: "Postfach", volltext: true, satz: "Alle Kundenmails mit Akte und Antwort.", Seite: Postmeister, raum: "kommunikation", mindest: "inhaber", auch: "email agent gmail postfach support ki automatisch" },
  { slug: "whatsapp", label: "WhatsApp", volltext: true, satz: "Alle WhatsApp-Gespräche.", Seite: WhatsAppRaumSeite, raum: "kommunikation", eigenesDesign: true, vollflaeche: true, auch: "whatsapp chat nachricht wa mara postfach kunde schreiben" },

  // ── Academy und Redaktion ───────────────────────────────────────────────
  { slug: "academy", label: "FIAON Academy", volltext: true, satz: "Einschulung je Abteilung.", Seite: Schulung, raum: "academy" },
  { slug: "funktionen", label: "Funktionen & Schulung", volltext: true, satz: "Alle Funktionen mit Selbsttest.", Seite: Funktionen, raum: "academy" },
  { slug: "ratgeber", label: "Ratgeber-Redaktion", volltext: true, satz: "Täglich je ein Artikel für Privat und Business – automatisch.", Seite: Ratgeber, raum: "redaktion" },

  // ── System ──────────────────────────────────────────────────────────────
  { slug: "einstellungen", label: "Einstellungen", satz: "Provision, Auszahlung, Erinnerungen.", Seite: Einstellungen, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "diagnose", label: "System-Diagnose", volltext: true, satz: "Was gerade klemmt.", Seite: Diagnose, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "audit", label: "Audit-Log", volltext: true, satz: "Alle Aktionen, durchsuchbar.", Seite: Audit, raum: "system", mindest: "geschaeftsfuehrung" },
  { slug: "changelog", label: "Was ist neu?", volltext: true, satz: "Alle Änderungen in Klartext.", Seite: Changelog, raum: "system" },
  { slug: "recht", label: "Rechtstexte-Status", volltext: true, satz: "Prüfstand der Rechtstexte.", Seite: Recht, raum: "system" },

  // ── Einzelakte: Ziel jeder Suche, keine Kachel ──────────────────────────
  { slug: "akte", label: "Kundenakte", ohneKachel: true, volltext: true, satz: "Ein Mensch, alles an einer Stelle.", Seite: KundeAkte, raum: "kundenliste", auch: "akte kunde person kundenakte zentrale akte" },
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
