import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Phone, Building, Shield, Briefcase, Heart, GraduationCap, Plane, Factory, Sun, Home, Car, Users, Landmark, Scale, Calculator, Wifi, HandHeart, Building2, Zap, Wrench, DoorOpen, Dumbbell, Hotel, Truck, BookOpen, Stethoscope, Smile } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface Industry {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  primaryUse: string;
  callFlow: string[];
  outcome: string;
  guardrails: string;
}

// ─── Filter categories ──────────────────────────────────────
const CATEGORIES = [
  { key: "all", label: "Alle" },
  { key: "energie", label: "Energie & Bau" },
  { key: "immobilien", label: "Immobilien" },
  { key: "finanzen", label: "Finanzen" },
  { key: "tech", label: "Tech & SaaS" },
  { key: "gesundheit", label: "Gesundheit" },
  { key: "gastgewerbe", label: "Gastgewerbe" },
  { key: "services", label: "Services" },
  { key: "bildung", label: "Bildung & Recht" },
  { key: "oeffentlich", label: "Öffentlich" },
];

// ─── 28 Industries ──────────────────────────────────────────
const INDUSTRIES: Industry[] = [
  {
    id: "solar",
    name: "Solar / PV Vertrieb",
    icon: <Sun className="w-5 h-5" />,
    category: "energie",
    primaryUse: "Outbound-Qualifizierung von Eigenheimbesitzern für PV-Anlagen.",
    callFlow: ["Begrüßung + Dachfläche erfragen", "Stromkosten & Interesse qualifizieren", "Beratungstermin vor Ort vereinbaren"],
    outcome: "Qualifizierte Termine, Rückruf-Vereinbarung, Dokumentation",
    guardrails: "Opt-in bei B2C erforderlich. ARAS protokolliert Einwilligung.",
  },
  {
    id: "energieberatung",
    name: "Energieberatung / Wärmepumpe",
    icon: <Zap className="w-5 h-5" />,
    category: "energie",
    primaryUse: "Bestandskunden kontaktieren für Heizungstausch-Beratung.",
    callFlow: ["Bestehende Heizung erfragen", "Fördermöglichkeiten ansprechen", "Vor-Ort-Termin für Energieberatung buchen"],
    outcome: "Terminbuchung, Bedarfsanalyse, Lead-Qualifizierung",
    guardrails: "Keine konkreten Förder-Zusagen. Verweis auf zertifizierte Beratung.",
  },
  {
    id: "immobilienmakler",
    name: "Immobilienmakler",
    icon: <Home className="w-5 h-5" />,
    category: "immobilien",
    primaryUse: "Akquise neuer Verkaufsmandate durch Eigentümer-Ansprache.",
    callFlow: ["Marktlage & Verkaufsinteresse erfragen", "Bewertungsangebot unterbreiten", "Besichtigungstermin vereinbaren"],
    outcome: "Mandatsanfrage, Bewertungstermin, Rückrufwunsch",
    guardrails: "B2B-Kontext oder Opt-in. Kein Druck auf Privatpersonen.",
  },
  {
    id: "hausverwaltung",
    name: "Immobilienverwaltung",
    icon: <Building2 className="w-5 h-5" />,
    category: "immobilien",
    primaryUse: "Mieter-Kommunikation und Nachfass bei Eigentümerversammlungen.",
    callFlow: ["Anliegen des Mieters aufnehmen", "Handwerker-Termin koordinieren", "Rückmeldung dokumentieren"],
    outcome: "Ticketerstellung, Terminfindung, Zufriedenheitsabfrage",
    guardrails: "Datenschutz bei Mieterdaten. Keine Mietrechtsentscheidungen.",
  },
  {
    id: "bau-handwerk",
    name: "Bau & Handwerk",
    icon: <Wrench className="w-5 h-5" />,
    category: "energie",
    primaryUse: "Nachfass bei Angebotsanfragen und Terminvereinbarung.",
    callFlow: ["Bezug auf Anfrage herstellen", "Umfang & Zeitfenster klären", "Vor-Ort-Termin abstimmen"],
    outcome: "Terminbestätigung, Auftragsqualifizierung",
    guardrails: "Nur bestehende Anfragen nachfassen. Kein Kalt-B2C.",
  },
  {
    id: "fenster-tueren",
    name: "Fenster / Türen / Renovierung",
    icon: <DoorOpen className="w-5 h-5" />,
    category: "energie",
    primaryUse: "Leads aus Konfiguratoren telefonisch qualifizieren.",
    callFlow: ["Konfiguration bestätigen", "Budget & Zeitrahmen erfragen", "Aufmaßtermin vereinbaren"],
    outcome: "Aufmaßtermin, Angebotsanforderung, Dokumentation",
    guardrails: "Lead-Quelle verifizieren. Opt-in dokumentieren.",
  },
  {
    id: "versicherungen",
    name: "Versicherungen / Broker",
    icon: <Shield className="w-5 h-5" />,
    category: "finanzen",
    primaryUse: "Bestandskunden-Nachfass zu auslaufenden Verträgen.",
    callFlow: ["Vertragsstatus ansprechen", "Wechselbereitschaft erfragen", "Beratungsgespräch vereinbaren"],
    outcome: "Beratungstermin, Vertragsverlängerung, Datenpflege",
    guardrails: "Keine Anlageberatung. Verweis auf lizenzierte Berater.",
  },
  {
    id: "banken",
    name: "Banken / Private Banking",
    icon: <Landmark className="w-5 h-5" />,
    category: "finanzen",
    primaryUse: "Terminvereinbarung für Anlage- oder Kreditberatung.",
    callFlow: ["Bestandskunde begrüßen", "Anliegen vorqualifizieren", "Beratertermin buchen"],
    outcome: "Qualifizierter Beratungstermin",
    guardrails: "Keine konkreten Anlageempfehlungen. Regulatorik beachten.",
  },
  {
    id: "private-equity",
    name: "Private Equity / Investment",
    icon: <Briefcase className="w-5 h-5" />,
    category: "finanzen",
    primaryUse: "Deal-Sourcing: Geschäftsführer für M&A-Gespräche kontaktieren.",
    callFlow: ["Unternehmenssituation einordnen", "Verkaufsbereitschaft sondieren", "Follow-up mit Partner vereinbaren"],
    outcome: "Erstgespräch-Termin, Absage-Dokumentation",
    guardrails: "Nur B2B. Keine Finanzprodukt-Versprechen.",
  },
  {
    id: "saas-b2b",
    name: "SaaS B2B",
    icon: <Building className="w-5 h-5" />,
    category: "tech",
    primaryUse: "Demo-Terminvereinbarung bei qualifizierten Leads.",
    callFlow: ["Pain Point ansprechen", "Relevanz der Lösung prüfen", "Demo-Termin mit AE buchen"],
    outcome: "Demo-Termin, Qualifizierung (Budget/Authority/Need)",
    guardrails: "Nur B2B-Kontakte. Lead-Scoring vorgeschaltet.",
  },
  {
    id: "ecommerce",
    name: "E-Commerce / D2C",
    icon: <Briefcase className="w-5 h-5" />,
    category: "tech",
    primaryUse: "Warenkorbabbrecher reaktivieren und Rückfragen klären.",
    callFlow: ["Bestellung referenzieren", "Hinderungsgrund erfragen", "Support oder Rabattcode anbieten"],
    outcome: "Kaufabschluss, Rückruf, Eskalation an Support",
    guardrails: "Opt-in für Telefonkontakt. DSGVO-Einwilligung.",
  },
  {
    id: "recruiting",
    name: "Recruiting / Staffing",
    icon: <Users className="w-5 h-5" />,
    category: "services",
    primaryUse: "Kandidaten für offene Stellen telefonisch vorab qualifizieren.",
    callFlow: ["Stelle vorstellen", "Verfügbarkeit & Gehaltsrahmen klären", "Interview-Termin vereinbaren"],
    outcome: "Interview-Termin, Absage-Dokumentation, Profil-Update",
    guardrails: "Kandidatendaten vertraulich. Keine Diskriminierung.",
  },
  {
    id: "autohaus",
    name: "Autohaus / Automotive",
    icon: <Car className="w-5 h-5" />,
    category: "services",
    primaryUse: "Probefahrt-Termine und Leasing-Anfragen nachfassen.",
    callFlow: ["Interesse am Modell bestätigen", "Finanzierung ansprechen", "Probefahrt-Termin buchen"],
    outcome: "Probefahrt-Termin, Finanzierungsanfrage",
    guardrails: "Kein Vertragsabschluss am Telefon. Nur Terminvermittlung.",
  },
  {
    id: "leasing",
    name: "Leasing / Fuhrpark",
    icon: <Car className="w-5 h-5" />,
    category: "services",
    primaryUse: "Fuhrparkverantwortliche für Leasing-Angebote kontaktieren.",
    callFlow: ["Fuhrparkgröße erfragen", "Laufende Verträge ansprechen", "Angebotsvergleich vereinbaren"],
    outcome: "Angebotsanforderung, Beratungstermin",
    guardrails: "Nur B2B. Keine Konditionen am Telefon zusagen.",
  },
  {
    id: "mediziner",
    name: "Mediziner / Kliniken",
    icon: <Stethoscope className="w-5 h-5" />,
    category: "gesundheit",
    primaryUse: "Patienten-Recall und Vorsorge-Erinnerungen.",
    callFlow: ["Termin-Erinnerung kommunizieren", "Verfügbarkeit prüfen", "Neuen Termin buchen"],
    outcome: "Terminbestätigung, Absage, Warteliste",
    guardrails: "Keine medizinischen Aussagen. Patientendaten geschützt.",
  },
  {
    id: "zahnaerzte",
    name: "Zahnärzte / Dental",
    icon: <Smile className="w-5 h-5" />,
    category: "gesundheit",
    primaryUse: "Prophylaxe-Recall und Behandlungsplanung.",
    callFlow: ["Letzten Termin referenzieren", "Prophylaxe-Empfehlung ansprechen", "Wunschtermin vereinbaren"],
    outcome: "Termin, Rückrufwunsch",
    guardrails: "Keine Diagnosen. Nur Terminverwaltung.",
  },
  {
    id: "physiotherapie",
    name: "Physiotherapie / Reha",
    icon: <Heart className="w-5 h-5" />,
    category: "gesundheit",
    primaryUse: "Folgetermine und Therapiepläne koordinieren.",
    callFlow: ["Therapiefortschritt erfragen", "Nächsten Block besprechen", "Terminreihe buchen"],
    outcome: "Terminreihe, Therapieplan-Update",
    guardrails: "Keine therapeutischen Empfehlungen am Telefon.",
  },
  {
    id: "fitness",
    name: "Fitness / Studios",
    icon: <Dumbbell className="w-5 h-5" />,
    category: "gesundheit",
    primaryUse: "Probetraining-Leads nachfassen und Mitgliedschaft aktivieren.",
    callFlow: ["Probetraining-Erlebnis erfragen", "Mitgliedschaftsoptionen vorstellen", "Starttermin vereinbaren"],
    outcome: "Mitgliedschaft, Probetraining-Termin, Rückruf",
    guardrails: "Kein Vertragsabschluss am Telefon. Nur Terminvermittlung.",
  },
  {
    id: "hotels",
    name: "Hotels / Hospitality",
    icon: <Hotel className="w-5 h-5" />,
    category: "gastgewerbe",
    primaryUse: "Gruppen- und Event-Anfragen qualifizieren.",
    callFlow: ["Anfrage bestätigen", "Teilnehmerzahl & Datum klären", "Angebot ankündigen"],
    outcome: "Qualifizierte Anfrage, Angebotsversand",
    guardrails: "Keine verbindlichen Preiszusagen am Telefon.",
  },
  {
    id: "reiseanbieter",
    name: "Reiseanbieter / Travel",
    icon: <Plane className="w-5 h-5" />,
    category: "gastgewerbe",
    primaryUse: "Reise-Interessenten telefonisch beraten und buchen.",
    callFlow: ["Reisewunsch erfassen", "Verfügbarkeit prüfen", "Buchungsbestätigung einleiten"],
    outcome: "Buchungsanfrage, Beratungstermin",
    guardrails: "Pauschalreiserecht beachten. Verweis auf AGB.",
  },
  {
    id: "logistik",
    name: "Logistik / Spedition",
    icon: <Truck className="w-5 h-5" />,
    category: "services",
    primaryUse: "Frachtanfragen qualifizieren und Disponenten entlasten.",
    callFlow: ["Sendungsdetails aufnehmen", "Route & Zeitfenster klären", "Angebot oder Rückruf zusagen"],
    outcome: "Angebotsanfrage, Dispositions-Update",
    guardrails: "Keine verbindlichen Frachtpreise. Nur Vorqualifizierung.",
  },
  {
    id: "manufacturing",
    name: "Manufacturing / Industrie",
    icon: <Factory className="w-5 h-5" />,
    category: "services",
    primaryUse: "Einkaufsleiter für Lieferanten-Gespräche kontaktieren.",
    callFlow: ["Bedarf & Spezifikation erfragen", "Lieferkapazität ansprechen", "Technisches Gespräch vereinbaren"],
    outcome: "Erstgespräch, Angebotsanforderung",
    guardrails: "Nur B2B. Technische Details an Fachteam weiterleiten.",
  },
  {
    id: "bildung",
    name: "Bildung / Weiterbildung",
    icon: <GraduationCap className="w-5 h-5" />,
    category: "bildung",
    primaryUse: "Kursinteressenten nachfassen und Anmeldungen abschließen.",
    callFlow: ["Kursinteresse bestätigen", "Termine & Format klären", "Anmeldung einleiten"],
    outcome: "Kursanmeldung, Infomaterial-Versand",
    guardrails: "Keine Zertifizierungszusagen. Verweis auf Kursdetails.",
  },
  {
    id: "recht",
    name: "Recht / Kanzleien",
    icon: <Scale className="w-5 h-5" />,
    category: "bildung",
    primaryUse: "Mandatsanfragen vorqualifizieren und Erstberatung buchen.",
    callFlow: ["Rechtsgebiet erfragen", "Dringlichkeit einschätzen", "Erstberatungstermin vereinbaren"],
    outcome: "Erstberatung, Mandatsanfrage, Weiterleitung",
    guardrails: "Keine Rechtsberatung am Telefon. Nur Terminvermittlung.",
  },
  {
    id: "steuerberatung",
    name: "Steuerberatung / Accounting",
    icon: <Calculator className="w-5 h-5" />,
    category: "bildung",
    primaryUse: "Neue Mandanten akquirieren und Jahresabschluss-Termine planen.",
    callFlow: ["Unternehmensform & Bedarf erfragen", "Leistungsspektrum vorstellen", "Erstgespräch vereinbaren"],
    outcome: "Erstberatungstermin, Mandatsanfrage",
    guardrails: "Keine steuerliche Beratung am Telefon. Nur Terminvermittlung.",
  },
  {
    id: "telekom",
    name: "Telekom / ISP",
    icon: <Wifi className="w-5 h-5" />,
    category: "oeffentlich",
    primaryUse: "Bestandskunden zu Tarifwechseln und Upgrades kontaktieren.",
    callFlow: ["Aktuellen Tarif referenzieren", "Upgrade-Optionen vorstellen", "Wechsel einleiten oder Rückruf buchen"],
    outcome: "Tarifwechsel, Rückruf, Eskalation",
    guardrails: "Kein Vertragsabschluss ohne Bestätigung. Widerrufsrecht nennen.",
  },
  {
    id: "ngo",
    name: "NGOs / Non-Profit",
    icon: <HandHeart className="w-5 h-5" />,
    category: "oeffentlich",
    primaryUse: "Spender-Reaktivierung und Dankes-Calls.",
    callFlow: ["Letzte Spende referenzieren", "Projekt-Update teilen", "Erneute Unterstützung erfragen"],
    outcome: "Spendenzusage, Event-Teilnahme, Kontaktpflege",
    guardrails: "Kein Druck. Transparenz über Mittelverwendung.",
  },
  {
    id: "public-sector",
    name: "Public Sector / Behörden",
    icon: <Building2 className="w-5 h-5" />,
    category: "oeffentlich",
    primaryUse: "Bürger-Information zu Terminen und Verfahrensständen.",
    callFlow: ["Anliegen identifizieren", "Verfahrensstand mitteilen", "Nächste Schritte erklären"],
    outcome: "Information, Terminerinnerung, Weiterleitung",
    guardrails: "Keine hoheitlichen Entscheidungen. Nur Information.",
  },
];

// ─── Component ──────────────────────────────────────────────
export function IndustryAtlas() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = activeFilter === "all"
    ? INDUSTRIES
    : INDUSTRIES.filter((i) => i.category === activeFilter);

  const handleCardHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mx", `${x}%`);
    e.currentTarget.style.setProperty("--my", `${y}%`);
  }, []);

  return (
    <section className="atlas-section" aria-label="ARAS Industry Atlas">
      <div className="atlas-horizon" aria-hidden="true" />
      <div className="atlas-inner">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="atlas-kicker">
            <span className="atlas-kicker-dot" />
            INDUSTRY ATLAS
          </div>
          <h2 className="atlas-headline">28+ Branchen. Ein System.</h2>
          <p className="atlas-subline">
            ARAS passt sich Prozesslogik und Tonalität pro Branche an — ohne Skript-Feeling.
            Jede Branche, jeder Call, jedes Ergebnis dokumentiert.
          </p>
        </motion.div>

        {/* Filter Chips */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="atlas-filters"
          role="tablist"
          aria-label="Branchen filtern"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              role="tab"
              aria-selected={activeFilter === cat.key}
              className={`atlas-chip${activeFilter === cat.key ? " atlas-chip--active" : ""}`}
              onClick={() => setActiveFilter(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Industry Grid */}
        <div className="atlas-grid" ref={gridRef} role="tabpanel">
          <AnimatePresence mode="popLayout">
            {filtered.map((industry, i) => (
              <motion.div
                key={industry.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.36, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="atlas-card"
                onClick={() => setSelectedIndustry(industry)}
                onMouseMove={handleCardHover}
                tabIndex={0}
                role="button"
                aria-label={`${industry.name} Details öffnen`}
                onKeyDown={(e) => { if (e.key === "Enter") setSelectedIndustry(industry); }}
              >
                <div className="atlas-card-icon">{industry.icon}</div>
                <h4>{industry.name}</h4>
                <p>{industry.primaryUse}</p>
                <span className="atlas-card-tag">{
                  CATEGORIES.find((c) => c.key === industry.category)?.label ?? industry.category
                }</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Stat counter */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="atlas-stat"
        >
          <div className="atlas-stat-number">28+</div>
          <div className="atlas-stat-label">Branchen — ein System, jede Prozesslogik</div>
        </motion.div>
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedIndustry && (
          <motion.div
            className="atlas-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedIndustry(null)}
          >
            <motion.div
              className="atlas-detail-panel"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={() => setSelectedIndustry(null)}
                className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
                aria-label="Schließen"
                style={{ position: "absolute", top: 20, right: 20 }}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="atlas-card-icon">{selectedIndustry.icon}</div>
                <h3>{selectedIndustry.name}</h3>
              </div>
              <p className="atlas-detail-use">{selectedIndustry.primaryUse}</p>

              {/* Call Flow */}
              <div className="atlas-detail-section">
                <div className="atlas-detail-section-title">Typischer Call Flow</div>
                <ul>
                  {selectedIndustry.callFlow.map((step, i) => (
                    <li key={i}>
                      <Phone className="w-4 h-4" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outcomes */}
              <div className="atlas-detail-section">
                <div className="atlas-detail-section-title">Ergebnisse</div>
                <div className="atlas-detail-chips">
                  {selectedIndustry.outcome.split(", ").map((chip, i) => (
                    <span key={i} className="atlas-detail-chip">{chip}</span>
                  ))}
                </div>
              </div>

              {/* Guardrails */}
              <div className="atlas-detail-section">
                <p className="atlas-detail-note">
                  <strong style={{ color: "rgba(233,215,196,.72)" }}>Hinweis: </strong>
                  {selectedIndustry.guardrails}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
