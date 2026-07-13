// ═══════════════════════════════════════════════════════════════════
// Make-Event-Registry (Paket T) — zentrale, im Code gepflegte Liste
// ALLER Make-Event-Typen mit Beschreibung, Payload-Schema und
// realistischen Beispielwerten.
//
// REGEL: Jedes neue Event, das über sendMakeWebhook() verschickt wird,
// MUSS hier eingetragen werden. Die Event-Test-Konsole /admin/events
// liest ausschließlich diese Registry — nur so kann Make.com die
// Payload-Struktur eines neuen Events lernen, BEVOR der echte
// Workflow existiert.
// ═══════════════════════════════════════════════════════════════════

import type { MakeEventType } from "./make-webhook";

export interface MakeEventDef {
  type: MakeEventType;
  label: string;
  /** 1 Satz: wann feuert dieses Event im echten Betrieb. */
  description: string;
  /** true = Payload lässt sich aus einer echten Bestellung (fiaon_applications) bauen → „Für echten Kunden senden" erlaubt. */
  customerBound: boolean;
  /** deprecated = wird nicht mehr automatisch gefeuert (nur noch Test/Migration). */
  deprecated?: boolean;
  /** Vollständiges Payload-Beispiel mit realistischen Werten (email wird beim Test durch die Test-Adresse ersetzt). */
  example: Record<string, unknown>;
}

const CUSTOMER_EXAMPLE = {
  email: "max.mustermann@example.com",
  vorname: "Max",
  nachname: "Mustermann",
  antrag_id: "FIAON-MB2XK4LQ-7T9A",
  payment_reference: "FIAON-A1B2C3",
  betrag: "59.99",
  paket: "FIAON Pro (Standard)",
};

const INVOICE_URL_EXAMPLE =
  "https://www.fiaon.com/api/fiaon/invoice/FIAON-A1B2C3.pdf?exp=1799999999&sig=0f3a9b7c2e4d";

export const MAKE_EVENT_REGISTRY: MakeEventDef[] = [
  {
    type: "welcome",
    label: "Willkommen (Antrag eingegangen)",
    description: "Feuert genau einmal, sobald ein Antrag mit gültiger E-Mail-Adresse abgeschlossen wurde.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE },
  },
  {
    type: "payment_details",
    label: "Zahlungsdaten (Bestellung angelegt)",
    description: "Feuert genau einmal beim Übergang zu pending_payment (Bestellung/Reaktivierung) — enthält Bankdaten-Kontext und Rechnungs-Link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "followup_48h",
    label: "Follow-up 48h (VERALTET)",
    description: "VERALTET: einmaliges 48h-Follow-up — ersetzt durch das tägliche Event payment_reminder (Make-Zweig bitte auf payment_reminder umstellen, Template kann bleiben).",
    customerBound: false,
    deprecated: true,
    example: { ...CUSTOMER_EXAMPLE },
  },
  {
    type: "payment_reminder",
    label: "Zahlungserinnerung (täglich)",
    description: "Feuert für jede unbezahlte Bestellung (pending_payment/claimed_paid) einmal pro Tag im Versandfenster, ab 24h nach Bestellung, bis MAX_REMINDERS erreicht ist — auch vom Bulk-Versand genutzt.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE, reminder_number: 1 },
  },
  {
    type: "claim_received",
    label: "Überweisung angekündigt (Danke)",
    description: "Feuert genau einmal, wenn der Kunde auf „Ich habe die Überweisung getätigt“ klickt — dankt und nennt das Freischalt-Zeitfenster (werktags bis 18:00 Uhr).",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "payment_confirmed",
    label: "Zahlung bestätigt (Konto aktiv + Login)",
    description: "Feuert genau einmal, wenn der Admin eine Zahlung als bezahlt markiert — ersetzt die frühere direkte Plattform-Freischaltmail und enthält den Login-Link.",
    customerBound: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "agent_payment_reminder",
    label: "Zahlungsdaten-Mail durch Mitarbeiter",
    description: "Feuert, wenn ein Mitarbeiter im Kundendetail die Ein-Klick-Mail „Wie soeben besprochen“ auslöst (10-Minuten-Sperre pro Kunde).",
    customerBound: false,
    example: { ...CUSTOMER_EXAMPLE, agent_name: "Anna Schmidt", invoice_url: INVOICE_URL_EXAMPLE },
  },
  {
    type: "agent_invite",
    label: "Mitarbeiter-Einladung",
    description: "Feuert, wenn der Admin einen neuen Mitarbeiter anlegt oder die Einladung erneut sendet (Setup-Link 48h gültig).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      nachname: "Schmidt",
      invite_url: "https://www.fiaon.com/agent/setup/4f8a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
      admin_name: "FIAON Admin",
    },
  },
  {
    type: "agent_password_reset",
    label: "Mitarbeiter Passwort-Reset",
    description: "Feuert bei „Passwort vergessen“ eines Mitarbeiters oder beim Force-Reset durch den Admin (Reset-Link 60 Min gültig).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      reset_url: "https://www.fiaon.com/agent/passwort?token=4f8a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
    },
  },
  {
    type: "agent_payout_done",
    label: "Auszahlung ausgeführt (Mitarbeiter)",
    description: "Feuert, wenn der Admin eine Provisions-Auszahlung als ausgezahlt markiert.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag: "125.50",
    },
  },
  {
    type: "agent_payout_rejected",
    label: "Auszahlung abgelehnt (Mitarbeiter)",
    description: "Feuert, wenn der Admin eine Provisions-Auszahlung ablehnt — mit Begründung.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag: "125.50",
      grund: "Bankdaten unvollständig — bitte IBAN im Profil prüfen",
    },
  },
  {
    type: "agent_callback_reminder",
    label: "Rückruf-Erinnerung (Mitarbeiter)",
    description: "Feuert 15 Minuten vor einem geplanten Rückruf-Termin an den zuständigen Mitarbeiter.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      agent_email: "anna.schmidt@example.com",
      vorname: "Anna",
      kunde_name: "Max Mustermann",
      referenz: "FIAON-MB2XK4LQ-7T9A",
      termin_zeit: "2026-07-06T14:30:00.000Z",
    },
  },
  {
    type: "lead_followup",
    label: "Lead-Nachfass (automatisiert)",
    description: "Feuert für nicht-konvertierte Leads (neu/kontaktiert) nach dem Nachfass-Plan im Versandfenster — auch vom Bulk-Versand genutzt. Betreiber-TODO: Make-Zweig lead_followup + Brevo-Template (+ optional WhatsApp/Superchat).",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      nachname: "Beispiel",
      telefon: "+491701234567",
      lead_id: 1234,
      followup_number: 1,
      quelle: "facebook_lead_ads",
      antrag_url: "https://www.fiaon.com/antrag?lead=1234",
    },
  },
  {
    type: "lead_application_link",
    label: "Antrags-Link an Lead (Ein-Klick durch Mitarbeiter)",
    description: "Feuert, wenn ein Mitarbeiter im Lead-Detail „Zum Antrag bewegen“ auslöst — schickt dem Interessenten den vorbereiteten Antrags-Link. Betreiber-TODO: Make-Zweig lead_application_link + Brevo-Template.",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      telefon: "+491701234567",
      lead_id: 1234,
      agent_name: "Anna Schmidt",
      antrag_url: "https://www.fiaon.com/antrag?lead=1234",
    },
  },
  {
    type: "agent_feedback_rewarded",
    label: "Feedback-Bonus gutgeschrieben (Mitarbeiter)",
    description: "Feuert, wenn der Admin ein Agent-Feedback mit einer einmaligen Provisions-Gutschrift honoriert. Betreiber-TODO: Make-Zweig + Brevo-Template anlegen.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      betrag_eur: "25.00",
      feedback_titel: "Kalender: Wochenansicht auf Mobile verbessern",
    },
  },
];

export function getEventDef(type: string): MakeEventDef | undefined {
  return MAKE_EVENT_REGISTRY.find((e) => e.type === type);
}
