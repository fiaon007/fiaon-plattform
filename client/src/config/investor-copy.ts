export type Lang = "de" | "en";

export interface InvestorCopy {
  seo: { title: string; description: string };
  nav: {
    sections: { id: string; label: string }[];
  };
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    microfacts: string[];
    ctaPrimary: string;
    ctaSecondary: string;
    note: string;
  };
  problem: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    stats: { value: string; label: string }[];
  };
  whatArasIs: {
    eyebrow: string;
    title: string;
    intro: string;
    layers: { title: string; description: string }[];
  };
  whyWeWin: {
    eyebrow: string;
    title: string;
    cards: { title: string; description: string }[];
  };
  traction: {
    eyebrow: string;
    title: string;
    intro: string;
    bullets: string[];
    timelineTitle: string;
    timeline: { label: string; description: string }[];
  };
  gtm: {
    eyebrow: string;
    title: string;
    intro: string;
    phases: { time: string; title: string; description: string }[];
    beachhead: string;
  };
  businessModel: {
    eyebrow: string;
    title: string;
    intro: string;
    models: { title: string; description: string }[];
    note: string;
  };
  funding: {
    eyebrow: string;
    title: string;
    intro: string;
    areas: { label: string }[];
    milestoneTitle: string;
    milestones: { time: string; label: string }[];
    terms: string;
  };
  risks: {
    eyebrow: string;
    title: string;
    intro: string;
    items: { risk: string; mitigation: string }[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: { q: string; a: string }[];
  };
  form: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabs: { dataRoom: string; introCall: string };
    fields: {
      name: string;
      firm: string;
      email: string;
      ticketSize: string;
      ticketOptions: string[];
      website: string;
      thesis: string;
      thesisPlaceholder: string;
    };
    submit: { dataRoom: string; introCall: string };
    success: string;
    successSub: string;
    another: string;
    errors: { name: string; firm: string; email: string };
  };
  footer: string;
}

const de: InvestorCopy = {
  seo: {
    title: "ARAS AI · Investor Brief",
    description:
      "Investor Relations für ARAS — die proprietäre Voice-AI-Plattform für Enterprise-Outbound-Kommunikation. Alpha live, 500+ Accounts, Seed-Runde offen.",
  },
  nav: {
    sections: [
      { id: "hero", label: "Übersicht" },
      { id: "problem", label: "Problem" },
      { id: "platform", label: "Plattform" },
      { id: "moat", label: "Differenzierung" },
      { id: "traction", label: "Traction" },
      { id: "gtm", label: "Go-to-Market" },
      { id: "model", label: "Business Model" },
      { id: "funding", label: "Funding" },
      { id: "risks", label: "Risiken" },
      { id: "faq", label: "FAQ" },
      { id: "contact", label: "Kontakt" },
    ],
  },
  hero: {
    eyebrow: "INVESTOR BRIEF · ALPHA LIVE",
    headline:
      "Outbound Calls, die sich\nmenschlich anfühlen.\nSkalierbar wie Software.",
    subheadline:
      "ARAS ist eine europäisch ausgerichtete Voice-AI-Plattform für Outbound-Kommunikation. Über 500 Accounts testen die Alpha bereits live. Jetzt verschieben wir den Fokus von Proof auf Paid: Piloten, Conversion, Enterprise-Rollouts — und die Infrastruktur, um sauber zu skalieren.",
    microfacts: [
      "Europe-first",
      "Swiss-grade Governance",
      "Modularer AI Stack",
      "Data Residency Ready",
    ],
    ctaPrimary: "Data Room anfragen",
    ctaSecondary: "Intro-Call buchen",
    note: "Hinweis: Technische Details & KPIs teilen wir strukturiert im Data Room.",
  },
  problem: {
    eyebrow: "DAS PROBLEM",
    title: "Outbound ist gleichzeitig unverzichtbar — und kaputt.",
    paragraphs: [
      "Outbound ist in vielen Branchen gleichzeitig unverzichtbar und ineffizient: hohe Kosten pro qualifiziertem Lead, niedrige Connect-Rates, inkonsistente Gesprächsqualität und steigender Druck, mit weniger SDR-Kapazität mehr Pipeline zu erzeugen. Die meisten Teams verlieren mehr Leads als sie konvertieren — nicht aus Mangel an Leads, sondern an Kapazität und Konsistenz.",
      "Die aktuellen Lösungen lösen das meist nur oberflächlich: zu wenig Kontrolle über Gesprächslogik und Einwandbehandlung, fehlende Compliance-Durchsetzung im Gespräch, und zu wenig Stabilität, wenn Volumen wirklich hochgeht. Für regulierte Branchen in Europa kommt hinzu: Datenhoheit, DSGVO-konforme Verarbeitung und Audit-Fähigkeit sind nicht optional — sie sind Voraussetzung.",
    ],
    stats: [
      { value: "€1.200+", label: "Kosten pro qualifiziertem Lead (Durchschnitt B2B)" },
      { value: "<18%", label: "Connect-Rate bei klassischem Outbound" },
      { value: "36%", label: "der B2B-Unternehmen haben SDR-Teams reduziert" },
      { value: "85%", label: "planen automatisierte Calls bis Ende 2025" },
    ],
  },
  whatArasIs: {
    eyebrow: "DIE PLATTFORM",
    title: "Was ARAS ist",
    intro:
      "ARAS AI besteht aus einem proprietären ARAS Core, der Gesprächsstrategie, Einwandlogik, Qualitätskontrolle und Compliance-Policies steuert. Darunter liegt eine modulare Model-Layer-Architektur: Wir können Komponenten austauschen, Redundanz aufbauen und die Qualität iterativ verbessern — ohne dass Kundensysteme oder Workflows brechen. Das Ergebnis ist eine Plattform, die nicht nur Calls durchführt, sondern sie intelligent steuert.",
    layers: [
      {
        title: "ARAS Core",
        description:
          "Der proprietäre Kern: Gesprächsstrategie, Einwandlogik, Policy-Durchsetzung, Echtzeit-Scoring und Conversation Memory. Hier steckt unser geistiges Eigentum.",
      },
      {
        title: "Voice Runtime",
        description:
          "Sub-Sekunden-Streaming-Pipeline mit Rauschunterdrückung, Unterbrechungs-Management und natürlichem Turn-Taking für Gespräche, die sich menschlich anfühlen.",
      },
      {
        title: "Orchestration Layer",
        description:
          "Workflow-Automatisierung, CRM-Sync, Kampagnen-Management, Kalender-Integration und Tool-Anbindungen — alles aus einer Oberfläche.",
      },
      {
        title: "Compliance & Data Posture",
        description:
          "EU/Swiss Data Residency Design, DSGVO-Alignment, Audit-Logging, rollenbasierte Zugriffskontrollen und Enterprise-Governance von Tag eins.",
      },
    ],
  },
  whyWeWin: {
    eyebrow: "DIFFERENZIERUNG",
    title: "Warum ARAS gewinnt",
    cards: [
      {
        title: "Europe-first Compliance-by-Design",
        description:
          "Während US-Anbieter Compliance nachträglich anbauen, ist ARAS von Grund auf für EU/Swiss-Anforderungen konzipiert: Datenresidenz, DSGVO-Alignment, Audit-Fähigkeit. Der EU AI Act erhöht die Barriere für nicht-konforme Anbieter — das ist unser struktureller Vorteil in regulierten Märkten.",
      },
      {
        title: "Conversation Quality Control",
        description:
          "ARAS Core erzwingt Gesprächspolicies in Echtzeit: Einwandlogik, Eskalationsregeln, Tonfall-Guardrails und Scoring nach jedem Call. Keine unkontrollierten AI-Gespräche — jede Interaktion folgt definierten Qualitätsstandards.",
      },
      {
        title: "Enterprise Control Layer",
        description:
          "Rollenbasierte Zugriffe, Audit-Trails, Usage-Limits, White-Label-Readiness und mandantenfähige Architektur. Für Unternehmen, die AI nicht als Experiment, sondern als kritische Infrastruktur einsetzen.",
      },
      {
        title: "Modularer Stack & Redundanz",
        description:
          "Provider-agnostische Architektur: Wir benchmarken kontinuierlich, können Komponenten austauschen und Redundanz aufbauen — ohne Downtime für Kunden. Kein Single-Vendor-Lock-in, maximale Flexibilität.",
      },
    ],
  },
  traction: {
    eyebrow: "ALPHA TRACTION",
    title: "Wo wir stehen",
    intro:
      "ARAS ist live — nicht als Demo, sondern als funktionierende Plattform mit echten Nutzern. Wir haben die Alpha bewusst breit ausgerollt, um Feedback-Loops zu maximieren und die Conversation-Intelligence-Engine unter realen Bedingungen zu trainieren.",
    bullets: [
      "500+ Accounts in der Alpha (live, aktiv genutzt)",
      "Wöchentliche Produkt-Iterationen basierend auf direktem Nutzer-Feedback",
      "Fokus auf Gesprächsqualität, UX und Conversion-Optimierung",
      "Pipeline: Enterprise-Pilotgespräche in DACH laufen (Details im Data Room)",
      "Monetization Shift: Paid Pilots + klare Conversion-Roadmap aktiviert",
    ],
    timelineTitle: "Was sich zuletzt verändert hat",
    timeline: [
      {
        label: "Plattform-Launch",
        description: "Alpha live mit vollständigem Feature-Set: Voice, CRM, Campaigns, Analytics",
      },
      {
        label: "500+ Accounts",
        description:
          "Organisches Wachstum, starkes Engagement, qualitatives Feedback als Basis für Monetarisierung",
      },
      {
        label: "Paid Pilot Phase",
        description:
          "Transition von Free zu Paid: strukturierte Piloten mit qualifizierten Enterprise-Prospects",
      },
    ],
  },
  gtm: {
    eyebrow: "GO-TO-MARKET",
    title: "Die nächsten 90 Tage",
    intro:
      "Unser GTM-Fokus ist bewusst vertikal und sequentiell. Wir starten dort, wo der Pain am größten und die Compliance-Anforderungen am höchsten sind — das gibt uns den stärksten Beachhead und die beste Referenz-Story.",
    phases: [
      {
        time: "Tag 0–30",
        title: "Paid Pilots",
        description:
          "Strukturierte Piloten mit Financial Services und Compliance-intensiven Verticals. Ziel: Willingness-to-Pay validieren, Pricing testen, erste Revenue-Signale.",
      },
      {
        time: "Tag 30–60",
        title: "Repeatable Onboarding",
        description:
          "Templates, Playbooks und Self-Service-Onboarding aufbauen. Conversion-Funnel optimieren. Ziel: vom manuellen Pilot zum skalierbaren Prozess.",
      },
      {
        time: "Tag 60–90",
        title: "Partner & Enterprise",
        description:
          "Partner-Channel aktivieren (Systemintegratoren, BPO). Erste Enterprise-Rollouts. Ziel: wiederkehrende Revenue-Streams und Referenz-Kunden.",
      },
    ],
    beachhead:
      "Beachhead: Financial Services (Banken, Versicherungen, Fintech) in DACH/CH. Phase 2: B2B SaaS & BPO/Call Center.",
  },
  businessModel: {
    eyebrow: "BUSINESS MODEL",
    title: "Wie ARAS monetarisiert",
    intro:
      "Hybrid-Modell aus Subscription und nutzungsbasierter Abrechnung — skaliert mit dem Kundenerfolg. Für Enterprise zusätzlich Done-for-You-Pakete, wenn Geschwindigkeit wichtiger ist als internes Setup.",
    models: [
      {
        title: "Subscription (SaaS)",
        description:
          "Tiered Plans: Starter → Professional → Enterprise. Plattformzugang, Feature-Tiering, Seat-basiert. Steigt mit Teamgröße und Feature-Bedarf.",
      },
      {
        title: "Usage (Minuten)",
        description:
          "Pay-per-Minute Voice-Billing zusätzlich zum Basisplan. Revenue korreliert direkt mit Kundennutzen — natürliches Expansion-Revenue.",
      },
      {
        title: "Enterprise & Done-for-You",
        description:
          "Managed Onboarding, Custom Voice Agents, dedizierter Support. Für Unternehmen, die schnell live gehen wollen, ohne internes AI-Team aufzubauen.",
      },
    ],
    note: "Detaillierte Pricing-Pakete und Unit Economics auf Anfrage im Data Room.",
  },
  funding: {
    eyebrow: "SEED RUNDE",
    title: "Funding & Use of Proceeds",
    intro:
      "Wir raisen Seed-Kapital, um aus Alpha-Traction bezahlbares Wachstum zu machen: Produktstabilität, Enterprise-Sales, Compliance-Zertifizierung und Team-Skalierung.",
    areas: [
      { label: "Engineering & AI" },
      { label: "Sales & GTM" },
      { label: "Ops & Compliance" },
      { label: "Brand & Marketing" },
    ],
    milestoneTitle: "Milestone Roadmap",
    milestones: [
      { time: "M3", label: "Paid Pilots live, Billing-Infrastruktur komplett" },
      { time: "M6", label: "Erste Recurring-Revenue-Kohorte, Compliance-Zertifizierung gestartet" },
      { time: "M9", label: "GTM-Engine operativ, Channel-Partnerschaften unterzeichnet" },
      { time: "M12", label: "ARR-Milestone, Series-A-Readiness" },
      { time: "M18", label: "Marktexpansion, Enterprise-Tier-Launch" },
    ],
    terms: "Bewertung & Terms im Data Room. Wir priorisieren strategische Partner, die neben Kapital auch Netzwerk und Branchen-Expertise einbringen.",
  },
  risks: {
    eyebrow: "RISIKEN & MITIGATION",
    title: "Transparenz schafft Vertrauen",
    intro:
      "Wir sind eine Alpha-Stage Company mit ambitionierten Zielen. Hier sind die Risiken, die wir sehen — und wie wir ihnen begegnen.",
    items: [
      {
        risk: "Regulatorik & EU AI Act",
        mitigation:
          "Compliance-by-Design seit Tag eins. Swiss/EU Data Residency, DSGVO-Alignment, Audit-Readiness. Regulierung ist für uns kein Risiko — sie ist unser Moat.",
      },
      {
        risk: "Monetarisierung (Pre-Revenue)",
        mitigation:
          "500+ Alpha-Accounts validieren Product-Market-Fit. Paid Pilots und Conversion-Experimente laufen. Vertikaler Fokus auf Financial Services für schnellste Revenue-Signale.",
      },
      {
        risk: "Qualität bei Skalierung",
        mitigation:
          "Modularer Stack mit Redundanz, kontinuierliches Benchmarking, QA-Loop nach jedem Call. ARAS Core erzwingt Qualitätsstandards unabhängig vom Volumen.",
      },
      {
        risk: "Wettbewerb (US-Anbieter mit mehr Kapital)",
        mitigation:
          "Europe-first Positionierung in regulierten Märkten, wo US-Anbieter strukturelle Nachteile haben. Enterprise Control Layer als Differenzierung, nicht nur Preis.",
      },
    ],
  },
  faq: {
    eyebrow: "HÄUFIGE FRAGEN",
    title: "Investor FAQ",
    items: [
      {
        q: "Wie geht ihr mit Datenresidenz & Compliance um?",
        a: "Unsere Infrastruktur ist von Grund auf für EU/Swiss-Compliance konzipiert: Datenresidenz, DSGVO-konforme Verarbeitung, Audit-Logging und rollenbasierte Zugriffskontrolle. Das ist kein nachträgliches Feature — es ist architektonisch eingebaut. Details zur Zertifizierungsroadmap teilen wir im Data Room.",
      },
      {
        q: "Was genau ist proprietär, was ist modular?",
        a: "ARAS Core — die Gesprächsstrategie, Einwandlogik, Policy-Durchsetzung, Echtzeit-Scoring und Conversation Memory — ist vollständig proprietär und unser geistiges Eigentum. Die darunterliegende Model-Layer ist bewusst modular und provider-agnostisch: Wir benchmarken kontinuierlich und können Komponenten austauschen, ohne Kundenworkflows zu beeinträchtigen.",
      },
      {
        q: "Warum jetzt?",
        a: "Drei Gründe: Erstens, Enterprise Voice AI ist noch nascent — der Markt wächst von $2.4B (2024) auf $47.5B (2034). Zweitens, der EU AI Act schafft Hürden für nicht-konforme Anbieter — das begünstigt vorbereite Player wie ARAS. Drittens, Foundation Models commoditisieren schnell — der Wert verschiebt sich zu proprietären Application Layers, genau dort wo ARAS Core sitzt.",
      },
      {
        q: "Wie sieht der Weg zu Paid Traction aus?",
        a: "Unsere Monetarisierungsrampe ist bewusst: Wir haben Product-Market-Fit in der Alpha validiert und die Conversation-Intelligence-Engine verfeinert. Jetzt aktivieren wir Paid Pilots, Usage-basierte Abrechnung und Conversion-Experimente. Die 500+ Accounts geben uns direkte Feedback-Loops und eine eingebaute Kohorte für Paid Conversion.",
      },
      {
        q: "Wofür braucht ihr Kapital?",
        a: "Vier Hauptbereiche: (1) Engineering & AI — Plattformstabilität, Performance, neue Features. (2) Sales & GTM — Enterprise-Sales-Team, Paid Pilots, Partner-Channel. (3) Ops & Compliance — SOC 2, ISO 27001, Audit-Readiness. (4) Brand & Marketing — Positionierung als europäische Enterprise-Alternative.",
      },
      {
        q: "Welcher Investor-Typ passt ideal?",
        a: "Wir suchen strategische Partner, die neben Kapital auch Netzwerk und Branchenexpertise in Financial Services, Enterprise SaaS oder Regulated Industries einbringen. Ideal: DACH-VCs mit AI/Deep-Tech-Fokus, Angels aus Financial Services, oder Family Offices mit Zugang zu Enterprise-Kunden.",
      },
    ],
  },
  form: {
    eyebrow: "KONTAKT",
    title: "Zugang anfragen",
    subtitle:
      "Interesse? Fordern Sie den Data Room an oder buchen Sie ein Intro-Gespräch. Wir antworten innerhalb von 24–48 Stunden.",
    tabs: { dataRoom: "Data Room", introCall: "Intro-Call" },
    fields: {
      name: "Name *",
      firm: "Firma *",
      email: "E-Mail *",
      ticketSize: "Ticketgröße",
      ticketOptions: ["< €250K", "€250K – €500K", "€500K – €1M", "€1M+"],
      website: "Website",
      thesis: "Investment-These / Notizen",
      thesisPlaceholder: "Was weckt Ihr Interesse an ARAS?",
    },
    submit: { dataRoom: "Data Room anfragen", introCall: "Intro-Call buchen" },
    success: "Anfrage erhalten",
    successSub: "Wir melden uns innerhalb von 24–48 Stunden.",
    another: "Weitere Anfrage senden",
    errors: {
      name: "Name ist erforderlich",
      firm: "Firmenname ist erforderlich",
      email: "Gültige E-Mail erforderlich",
    },
  },
  footer:
    "Diese Seite dient ausschließlich Informationszwecken und stellt kein Angebot zum Verkauf, keine Aufforderung zum Kauf und keine Empfehlung eines Wertpapiers oder Anlageprodukts dar. Die dargestellten Informationen können zukunftsgerichtete Aussagen enthalten, die mit Risiken und Unsicherheiten verbunden sind. Vertrauliche Unterlagen sind auf Anfrage und unter NDA verfügbar. ARAS AI © " +
    new Date().getFullYear(),
};

const en: InvestorCopy = {
  seo: {
    title: "ARAS AI · Investor Brief",
    description:
      "Investor relations for ARAS — the proprietary voice AI platform for enterprise outbound communication. Alpha live, 500+ accounts, Seed round open.",
  },
  nav: {
    sections: [
      { id: "hero", label: "Overview" },
      { id: "problem", label: "Problem" },
      { id: "platform", label: "Platform" },
      { id: "moat", label: "Differentiation" },
      { id: "traction", label: "Traction" },
      { id: "gtm", label: "Go-to-Market" },
      { id: "model", label: "Business Model" },
      { id: "funding", label: "Funding" },
      { id: "risks", label: "Risks" },
      { id: "faq", label: "FAQ" },
      { id: "contact", label: "Contact" },
    ],
  },
  hero: {
    eyebrow: "INVESTOR BRIEF · ALPHA LIVE",
    headline:
      "Outbound calls that\nfeel human.\nScaling like software.",
    subheadline:
      "ARAS is a Europe-first voice AI platform for outbound communication. 500+ accounts are already testing the live alpha. Now we shift from proof to paid: pilots, conversion, enterprise rollouts — and the infrastructure to scale reliably.",
    microfacts: [
      "Europe-first",
      "Swiss-grade governance",
      "Modular AI stack",
      "Data residency ready",
    ],
    ctaPrimary: "Request data room",
    ctaSecondary: "Book intro call",
    note: "Note: We share technical details & KPIs in a structured data room.",
  },
  problem: {
    eyebrow: "THE PROBLEM",
    title: "Outbound is both essential — and broken.",
    paragraphs: [
      "Outbound remains essential across industries, yet deeply inefficient: high cost per qualified lead, low connect rates, inconsistent conversation quality, and mounting pressure to generate more pipeline with fewer SDRs. Most teams lose more leads than they convert — not for lack of leads, but of capacity and consistency.",
      "Current solutions mostly address symptoms: insufficient control over conversation logic and objection handling, missing in-call compliance enforcement, and insufficient stability when volume actually scales. For regulated industries in Europe, add data sovereignty, GDPR-compliant processing, and audit capability — these aren't optional, they're prerequisites.",
    ],
    stats: [
      { value: "€1,200+", label: "Cost per qualified lead (avg. B2B)" },
      { value: "<18%", label: "Connect rate in traditional outbound" },
      { value: "36%", label: "of B2B companies have reduced SDR teams" },
      { value: "85%", label: "plan automated calls by end of 2025" },
    ],
  },
  whatArasIs: {
    eyebrow: "THE PLATFORM",
    title: "What ARAS is",
    intro:
      "ARAS AI consists of a proprietary ARAS Core that controls conversation strategy, objection logic, quality control, and compliance policies. Beneath it sits a modular model-layer architecture: we can swap components, build redundancy, and iteratively improve quality — without breaking customer systems or workflows. The result is a platform that doesn't just make calls, but intelligently orchestrates them.",
    layers: [
      {
        title: "ARAS Core",
        description:
          "The proprietary brain: conversation strategy, objection logic, policy enforcement, real-time scoring, and conversation memory. This is where our intellectual property lives.",
      },
      {
        title: "Voice Runtime",
        description:
          "Sub-second streaming pipeline with noise suppression, interruption management, and natural turn-taking for conversations that feel human.",
      },
      {
        title: "Orchestration Layer",
        description:
          "Workflow automation, CRM sync, campaign management, calendar integration, and tool connections — all from a single interface.",
      },
      {
        title: "Compliance & Data Posture",
        description:
          "EU/Swiss data residency design, GDPR alignment, audit logging, role-based access controls, and enterprise governance from day one.",
      },
    ],
  },
  whyWeWin: {
    eyebrow: "DIFFERENTIATION",
    title: "Why ARAS wins",
    cards: [
      {
        title: "Europe-first compliance-by-design",
        description:
          "While US providers retrofit compliance, ARAS is architected for EU/Swiss requirements from the ground up: data residency, GDPR alignment, audit capability. The EU AI Act raises the bar for non-compliant providers — that's our structural advantage in regulated markets.",
      },
      {
        title: "Conversation quality control",
        description:
          "ARAS Core enforces conversation policies in real time: objection logic, escalation rules, tone guardrails, and post-call scoring. No uncontrolled AI conversations — every interaction follows defined quality standards.",
      },
      {
        title: "Enterprise control layer",
        description:
          "Role-based access, audit trails, usage limits, white-label readiness, and multi-tenant architecture. For companies that deploy AI not as an experiment, but as critical infrastructure.",
      },
      {
        title: "Modular stack & redundancy",
        description:
          "Provider-agnostic architecture: we continuously benchmark, can swap components, and build redundancy — without downtime for customers. No single-vendor lock-in, maximum flexibility.",
      },
    ],
  },
  traction: {
    eyebrow: "ALPHA TRACTION",
    title: "Where we stand",
    intro:
      "ARAS is live — not as a demo, but as a functioning platform with real users. We deliberately rolled out the alpha broadly to maximize feedback loops and train the conversation intelligence engine under real-world conditions.",
    bullets: [
      "500+ accounts in the alpha (live, actively used)",
      "Weekly product iterations based on direct user feedback",
      "Focus on conversation quality, UX, and conversion optimization",
      "Pipeline: enterprise pilot conversations in DACH underway (details in data room)",
      "Monetization shift: paid pilots + clear conversion roadmap activated",
    ],
    timelineTitle: "What changed recently",
    timeline: [
      {
        label: "Platform launch",
        description: "Alpha live with full feature set: Voice, CRM, Campaigns, Analytics",
      },
      {
        label: "500+ accounts",
        description:
          "Organic growth, strong engagement, qualitative feedback as the foundation for monetization",
      },
      {
        label: "Paid pilot phase",
        description:
          "Transition from free to paid: structured pilots with qualified enterprise prospects",
      },
    ],
  },
  gtm: {
    eyebrow: "GO-TO-MARKET",
    title: "The next 90 days",
    intro:
      "Our GTM focus is deliberately vertical and sequential. We start where the pain is greatest and compliance requirements are highest — that gives us the strongest beachhead and the best reference story.",
    phases: [
      {
        time: "Day 0–30",
        title: "Paid pilots",
        description:
          "Structured pilots with financial services and compliance-heavy verticals. Goal: validate willingness-to-pay, test pricing, first revenue signals.",
      },
      {
        time: "Day 30–60",
        title: "Repeatable onboarding",
        description:
          "Build templates, playbooks, and self-service onboarding. Optimize the conversion funnel. Goal: from manual pilot to scalable process.",
      },
      {
        time: "Day 60–90",
        title: "Partners & enterprise",
        description:
          "Activate partner channels (system integrators, BPO). First enterprise rollouts. Goal: recurring revenue streams and reference customers.",
      },
    ],
    beachhead:
      "Beachhead: Financial Services (banks, insurance, fintech) in DACH/CH. Phase 2: B2B SaaS & BPO/Call Centers.",
  },
  businessModel: {
    eyebrow: "BUSINESS MODEL",
    title: "How ARAS monetizes",
    intro:
      "Hybrid model combining subscription and usage-based billing — scales with customer success. For enterprise, additional done-for-you packages when speed matters more than internal setup.",
    models: [
      {
        title: "Subscription (SaaS)",
        description:
          "Tiered plans: Starter → Professional → Enterprise. Platform access, feature tiering, seat-based. Scales with team size and feature needs.",
      },
      {
        title: "Usage (minutes)",
        description:
          "Pay-per-minute voice billing on top of base plans. Revenue correlates directly with customer value — natural expansion revenue.",
      },
      {
        title: "Enterprise & done-for-you",
        description:
          "Managed onboarding, custom voice agents, dedicated support. For companies that want to go live fast without building an internal AI team.",
      },
    ],
    note: "Detailed pricing packages and unit economics available on request in the data room.",
  },
  funding: {
    eyebrow: "SEED ROUND",
    title: "Funding & use of proceeds",
    intro:
      "We're raising seed capital to turn alpha traction into scalable growth: product stability, enterprise sales, compliance certification, and team scaling.",
    areas: [
      { label: "Engineering & AI" },
      { label: "Sales & GTM" },
      { label: "Ops & Compliance" },
      { label: "Brand & Marketing" },
    ],
    milestoneTitle: "Milestone roadmap",
    milestones: [
      { time: "M3", label: "Paid pilots live, billing infrastructure complete" },
      { time: "M6", label: "First recurring revenue cohort, compliance certification initiated" },
      { time: "M9", label: "GTM engine operational, channel partnerships signed" },
      { time: "M12", label: "ARR milestone, Series A readiness" },
      { time: "M18", label: "Market expansion, enterprise tier launch" },
    ],
    terms: "Valuation & terms in the data room. We prioritize strategic partners who bring network and industry expertise alongside capital.",
  },
  risks: {
    eyebrow: "RISKS & MITIGATION",
    title: "Transparency builds trust",
    intro:
      "We're an alpha-stage company with ambitious goals. Here are the risks we see — and how we address them.",
    items: [
      {
        risk: "Regulation & EU AI Act",
        mitigation:
          "Compliance-by-design since day one. Swiss/EU data residency, GDPR alignment, audit readiness. Regulation isn't our risk — it's our moat.",
      },
      {
        risk: "Monetization (pre-revenue)",
        mitigation:
          "500+ alpha accounts validate product-market fit. Paid pilots and conversion experiments are running. Vertical focus on financial services for fastest revenue signals.",
      },
      {
        risk: "Quality at scale",
        mitigation:
          "Modular stack with redundancy, continuous benchmarking, QA loop after every call. ARAS Core enforces quality standards regardless of volume.",
      },
      {
        risk: "Competition (US providers with more capital)",
        mitigation:
          "Europe-first positioning in regulated markets where US providers have structural disadvantages. Enterprise control layer as differentiation, not just price.",
      },
    ],
  },
  faq: {
    eyebrow: "FREQUENTLY ASKED",
    title: "Investor FAQ",
    items: [
      {
        q: "How do you handle data residency & compliance?",
        a: "Our infrastructure is designed from the ground up for EU/Swiss compliance: data residency, GDPR-compliant processing, audit logging, and role-based access control. This isn't an afterthought — it's architecturally built in. Certification roadmap details are shared in the data room.",
      },
      {
        q: "What exactly is proprietary vs. modular?",
        a: "ARAS Core — conversation strategy, objection logic, policy enforcement, real-time scoring, and conversation memory — is fully proprietary and our intellectual property. The underlying model layer is deliberately modular and provider-agnostic: we continuously benchmark and can swap components without affecting customer workflows.",
      },
      {
        q: "Why now?",
        a: "Three reasons: First, enterprise voice AI is still nascent — the market grows from $2.4B (2024) to $47.5B (2034). Second, the EU AI Act creates barriers for non-compliant providers — favoring prepared players like ARAS. Third, foundation models commoditize fast — value shifts to proprietary application layers, exactly where ARAS Core sits.",
      },
      {
        q: "What's the path to paid traction?",
        a: "Our monetization ramp is deliberate: we validated product-market fit in the alpha and refined the conversation intelligence engine. Now we're activating paid pilots, usage-based billing, and conversion experiments. The 500+ accounts give us direct feedback loops and a built-in cohort for paid conversion.",
      },
      {
        q: "What do you need capital for?",
        a: "Four areas: (1) Engineering & AI — platform stability, performance, new features. (2) Sales & GTM — enterprise sales team, paid pilots, partner channel. (3) Ops & Compliance — SOC 2, ISO 27001, audit readiness. (4) Brand & Marketing — positioning as the European enterprise alternative.",
      },
      {
        q: "What's the ideal investor fit?",
        a: "We're looking for strategic partners who bring network and industry expertise in financial services, enterprise SaaS, or regulated industries alongside capital. Ideal: DACH-focused VCs with AI/deep-tech focus, angels from financial services, or family offices with access to enterprise customers.",
      },
    ],
  },
  form: {
    eyebrow: "CONTACT",
    title: "Request access",
    subtitle:
      "Interested in learning more? Request our data room or book an intro call. We respond within 24–48 hours.",
    tabs: { dataRoom: "Data Room", introCall: "Intro Call" },
    fields: {
      name: "Name *",
      firm: "Firm *",
      email: "Email *",
      ticketSize: "Ticket size",
      ticketOptions: ["< €250K", "€250K – €500K", "€500K – €1M", "€1M+"],
      website: "Website",
      thesis: "Investment thesis / notes",
      thesisPlaceholder: "What draws your interest in ARAS?",
    },
    submit: { dataRoom: "Request data room", introCall: "Book intro call" },
    success: "Request received",
    successSub: "We'll get back within 24–48 hours.",
    another: "Submit another request",
    errors: {
      name: "Name is required",
      firm: "Firm name is required",
      email: "Valid email required",
    },
  },
  footer:
    "This page is for informational purposes only and does not constitute an offer to sell, a solicitation of an offer to buy, or a recommendation of any security or investment product. Information presented may contain forward-looking statements involving risks and uncertainties. Confidential materials available upon request subject to NDA. ARAS AI © " +
    new Date().getFullYear(),
};

const copies: Record<Lang, InvestorCopy> = { de, en };

export function getInvestorCopy(lang: Lang): InvestorCopy {
  return copies[lang] || copies.de;
}
