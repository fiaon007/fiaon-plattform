// 🎯 ARAS POWER Call Templates
// Produktions-Ready Call-Vorlagen für häufige Anruf-Szenarien

export type PowerCallTemplateId =
  | "lead_qualification"
  | "appointment_confirmation"
  | "no_show_reactivation"
  | "customer_reactivation"
  | "post_demo_followup"
  | "appointment_reschedule";

export interface PowerCallTemplate {
  id: PowerCallTemplateId;
  label: string;
  description: string;
  scenario: string; // Für ARAS Core: Art des Anrufs
  icon: string; // Emoji für UI
  appliesTo: {
    newContact?: boolean;
    existingContact?: boolean;
  };
  basePrompt: string; // Mit Platzhaltern
}

/**
 * Platzhalter-System:
 * {{contact_name}} - Name des Kontakts
 * {{contact_company}} - Firma des Kontakts
 * {{contact_company_or_generic}} - Firma oder "deinem Kontakt"
 * {{company_name}} - Eigene Firma
 * {{company_name_or_generic}} - Eigene Firma oder "unserem Unternehmen"
 * {{company_tone}} - communicationTone aus aiProfile
 * {{target_audience}} - targetAudience aus aiProfile
 * {{usps_list}} - uniqueSellingPoints als Liste
 * {{products_services}} - products/services aus aiProfile
 * {{value_prop}} - valueProp aus aiProfile
 */

export const POWER_CALL_TEMPLATES: PowerCallTemplate[] = [
  {
    id: "lead_qualification",
    label: "Lead-Qualifizierung",
    description: "Erstkontakt: Bedarf herausfinden, nächste Schritte klären",
    scenario: "lead_qualification",
    icon: "🎯",
    appliesTo: { newContact: true, existingContact: true },
    basePrompt: `Führe ein strukturiertes Qualifikationsgespräch mit {{contact_name}} von {{contact_company_or_generic}}.

Ziele:
- Verstehe, ob {{company_name_or_generic}} mit unserem Angebot wirklich helfen kann
- Kläre Budget, Entscheidungszeitraum und Entscheiderrolle
- Vereinbare einen klaren nächsten Schritt (z.B. Termin)

Wichtig:
- Sprich im Stil: {{company_tone}}
- Zielgruppe: {{target_audience}}
- Nutze unsere USPs: {{usps_list}}
- Unser Angebot: {{products_services}}`
  },
  {
    id: "appointment_confirmation",
    label: "Terminbestätigung",
    description: "Bestehenden Termin bestätigen, Details klären",
    scenario: "appointment_confirmation",
    icon: "✓",
    appliesTo: { existingContact: true },
    basePrompt: `Rufe {{contact_name}} an und bestätige den bestehenden Termin von {{company_name_or_generic}}.

Ziele:
- Terminzeit und Ort bestätigen
- Kurz wiederholen, worum es im Termin gehen wird
- Fragen oder Bedenken des Kontakts klären
- Bei Unsicherheit höflich anbieten, den Termin zu verschieben

Sprich freundlich, klar und professionell im Stil: {{company_tone}}`
  },
  {
    id: "appointment_reschedule",
    label: "Terminverschiebung",
    description: "Termin verschieben, Alternativen anbieten",
    scenario: "appointment_reschedule",
    icon: "📅",
    appliesTo: { existingContact: true },
    basePrompt: `Rufe {{contact_name}} an und verschiebe den Termin von {{company_name_or_generic}}.

Wichtig:
- Nenne den Grund für die Verschiebung
- Biete 2-3 konkrete alternative Termine an
- Sei höflich und entschuldigend
- Bestätige den neuen Termin klar

Sprich im Stil: {{company_tone}}`
  },
  {
    id: "no_show_reactivation",
    label: "No-Show Reaktivierung",
    description: "Kontakt reaktivieren nach verpasstem Termin",
    scenario: "no_show_reactivation",
    icon: "🔄",
    appliesTo: { existingContact: true },
    basePrompt: `Reaktiviere {{contact_name}} nach einem verpassten Termin.

Ziele:
- Höflich nachfragen, warum der Termin verpasst wurde
- Interesse an {{value_prop}} erneut wecken
- Neuen Termin vereinbaren oder klare nächste Schritte definieren
- NICHT vorwurfsvoll sein – zeige Verständnis

Sprich empathisch und lösungsorientiert: {{company_tone}}
Unser Mehrwert: {{value_prop}}`
  },
  {
    id: "customer_reactivation",
    label: "Kundenreaktivierung",
    description: "Inaktive Bestandskunden zurückgewinnen",
    scenario: "customer_reactivation",
    icon: "⭐",
    appliesTo: { existingContact: true },
    basePrompt: `Reaktiviere {{contact_name}} – einen inaktiven Bestandskunden.

Ziele:
- Erkundige dich, warum es ruhiger geworden ist
- Stelle neue Angebote oder Entwicklungen vor: {{products_services}}
- Nutze unsere USPs: {{usps_list}}
- Biete konkreten Mehrwert: {{value_prop}}
- Vereinbare nächsten Schritt (Termin, Test, Angebot)

Sprich wertschätzend und vertrauensvoll: {{company_tone}}
Zielgruppe: {{target_audience}}`
  },
  {
    id: "post_demo_followup",
    label: "Follow-up nach Demo",
    description: "Nachfassen nach Produktdemo oder Präsentation",
    scenario: "post_demo_followup",
    icon: "💼",
    appliesTo: { existingContact: true },
    basePrompt: `Rufe {{contact_name}} an nach der Demo/Präsentation von {{company_name_or_generic}}.

Ziele:
- Feedback zur Demo einholen
- Offene Fragen klären
- Nächste Schritte definieren (Angebot, Testphase, weiterer Termin)
- Entscheidungszeitraum erfragen

Wichtig:
- Bezug nehmen auf konkrete Punkte der Demo
- Mehrwert betonen: {{value_prop}}
- Sprich im Stil: {{company_tone}}`
  }
];

/**
 * Template nach ID finden
 */
export function getTemplateById(id: PowerCallTemplateId): PowerCallTemplate | undefined {
  return POWER_CALL_TEMPLATES.find(t => t.id === id);
}

/**
 * Templates filtern nach Kontext
 */
export function getRecommendedTemplates(hasContact: boolean): PowerCallTemplate[] {
  if (hasContact) {
    return POWER_CALL_TEMPLATES.filter(t => t.appliesTo.existingContact);
  }
  return POWER_CALL_TEMPLATES.filter(t => t.appliesTo.newContact);
}
