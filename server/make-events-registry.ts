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
  /** true = Payload lässt sich aus einer echten Bestellung (fiaon_applications) bauen → „Für echten Kunden senden“ erlaubt. */
  customerBound: boolean;
  /** deprecated = wird nicht mehr automatisch gefeuert (nur noch Test/Migration). */
  deprecated?: boolean;
  /** true = im Code wird KEIN automatischer Versand ausgelöst — nur registriert,
   *  damit der Betreiber das Event testen und den Make-Zweig anlegen kann. */
  recommendationOnly?: boolean;
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
    type: "abo_payment_reminder",
    label: "Abo-Rate fällig (monatliche Paketrate)",
    description:
      "Feuert für eine offene Monatsrate des Pakets: Stufe 1 am Fälligkeitstag, Stufe 2 sieben Tage später, Stufe 3 nach vierzehn Tagen. Danach keine weitere Mail, sondern ein Punkt „Entscheidung nötig“ in der Zahlungszentrale. Enthält Bankdaten UND den Verwendungszweck (Ratenreferenz) — ohne ihn lässt sich die Überweisung nicht zuordnen. Der Bonitäts-Check (74 €) ist kein Abo und löst dieses Event nie aus. Betreiber-TODO: Make-Zweig 'abo_payment_reminder' + Brevo-Template anlegen (Variablen: betrag, faellig_am_text, rate_nr, mahnstufe_text, empfaenger, iban, bic, verwendungszweck, portal_url).",
    customerBound: true,
    example: {
      ...CUSTOMER_EXAMPLE,
      // Die Ratenreferenz steht bewusst in payment_reference: bestehende
      // Vorlagen drucken dieses Feld als Verwendungszweck.
      payment_reference: "FIAON-A1B2C3-2",
      betrag: "59.99",
      rate_nr: 2,
      faellig_am: "2026-09-03",
      faellig_am_text: "03.09.2026",
      tage_ueberfaellig: 0,
      mahnstufe: 1,
      mahnstufe_text: "Freundliche Erinnerung — heute ist Ihre Monatsrate fällig.",
      empfaenger: "Fiaon Ltd",
      iban: "BE09 9058 9276 3957",
      bic: "TRWIBEB1XXX",
      verwendungszweck: "FIAON-A1B2C3-2",
      portal_url: "https://www.fiaon.com/login",
    },
  },
  {
    type: "aufgabe_zugewiesen",
    label: "Aufgabe zugewiesen (Mitarbeiter)",
    description:
      "Feuert, wenn der Betreiber einem Mitarbeiter eine Aufgabe an einem Kunden zuweist. Ohne diese Mail fällt eine Aufgabe erst beim nächsten Portal-Besuch auf — bei einer Frist von morgen ist das zu spät. Der Mitarbeiter erledigt sie unter „Aufgaben“ in seinem Portal. Betreiber-TODO: Make-Zweig 'aufgabe_zugewiesen' + Brevo-Template anlegen (Variablen: vorname, aufgabe, kunde, faellig_am_text, dringend, portal_url).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      aufgabe: "Unterlagen prüfen und Kunden zurückrufen",
      kunde: "Max Mustermann",
      faellig_am: "2026-08-08",
      faellig_am_text: "08.08.2026",
      dringend: false,
      portal_url: "https://www.fiaon.com/agent/aufgaben",
    },
  },
  {
    type: "nicht_erreicht_termin",
    label: "Nicht erreicht — Terminlink an den Kunden",
    description:
      "Feuert automatisch nach dem ZWEITEN erfolglosen Anrufversuch (nicht erreicht oder Mailbox), genau einmal je Kunde in 30 Tagen. Der Kunde bekommt einen persönlichen Buchungslink auf die Slots SEINES Betreuers und wählt selbst eine Uhrzeit. Ohne diese Mail folgt der dritte, vierte und fünfte Anruf ins Leere. Betreiber-TODO: Make-Zweig 'nicht_erreicht_termin' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_link).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_link: "https://www.fiaon.com/termin/7f3a…",
    },
  },
  {
    type: "termin_bestaetigung",
    label: "Terminbestätigung (Kunde)",
    description:
      "Feuert sofort nach einer Buchung — egal ob im Antrag, über den Terminlink oder vom Agenten angelegt. Enthält den Storno-Link; Umbuchen ist Absagen plus neu buchen auf derselben Seite. Betreiber-TODO: Make-Zweig 'termin_bestaetigung' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_datum, termin_uhrzeit, storno_link).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_datum: "12.08.2026",
      termin_uhrzeit: "14:20",
      storno_link: "https://www.fiaon.com/termin/absagen/9b2c…",
    },
  },
  {
    type: "termin_erinnerung",
    label: "Terminerinnerung 24 h vorher (Kunde)",
    description:
      "Feuert im Tageslauf 24 Stunden vor dem Termin, einmalig je Termin (die Spalte erinnert_am verhindert Doppelversand bei einem Neustart). Betreiber-TODO: Make-Zweig 'termin_erinnerung' + Brevo-Template anlegen (Variablen: vorname, nachname, agent_vorname, termin_datum, termin_uhrzeit, storno_link).",
    customerBound: true,
    example: {
      email: "max.mustermann@example.com",
      vorname: "Max",
      nachname: "Mustermann",
      agent_vorname: "Daniel",
      termin_datum: "12.08.2026",
      termin_uhrzeit: "14:20",
      storno_link: "https://www.fiaon.com/termin/absagen/9b2c…",
    },
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
  {
    type: "agent_feedback_reply",
    label: "Antwort auf Feedback-Ticket (Mitarbeiter)",
    description: "Feuert, wenn der Betreiber im Feedback-Thread eines Mitarbeiters antwortet — der Agent wird per Mail informiert und antwortet im selben Ticket (kein neues Ticket). Betreiber-TODO: Make-Zweig 'agent_feedback_reply' + Brevo-Template mit Link zu portal_url anlegen.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      feedback_id: 11,
      feedback_titel: "Kalender: Wochenansicht auf Mobile verbessern",
      antwort: "Danke für den Hinweis — wir haben die Wochenansicht angepasst, schau sie dir gern an.",
      portal_url: "https://www.fiaon.com/agent/feedback",
    },
  },
  {
    type: "number_update_request",
    label: "Telefonnummer aktualisieren (Kunde/Lead)",
    description: "Feuert, wenn ein Mitarbeiter das Kontakt-Ergebnis „Falsche Nummer“ wählt UND eine E-Mail hinterlegt ist — schickt dem Kunden/Lead einen Button „Nummer aktualisieren“ zu einem schlanken Formular. Neue Nummer landet direkt im Datensatz (Audit „vom Kunden selbst aktualisiert“), der Lead/Kunde wird wieder anrufbar. Max. 1× pro Tag/Person. Betreiber-TODO: Make-Zweig 'number_update_request' + Brevo-Template mit Button zu update_url anlegen.",
    customerBound: false,
    example: {
      email: "interessent@example.com",
      vorname: "Lena",
      update_url: "https://www.fiaon.com/nummer-aktualisieren?token=YXBwOkZJQU9OLi4u.0f3a9b7c2e4d",
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // EMPFEHLUNGEN (Teil 1.3) — registriert, damit der Betreiber sie auf
  // /admin/events testen und den Make-Zweig bauen kann. Es ist bewusst NOCH
  // KEIN automatischer Versand im Code verdrahtet (recommendationOnly). Sobald
  // Template + Make-Zweig stehen, kann der Versand auf Wunsch aktiviert werden.
  // ════════════════════════════════════════════════════════════════════
  {
    type: "payment_cancelled",
    label: "Bestellung storniert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine Bestellung storniert wird (/admin/payments/:ref/cancel). Der Betreiber vermisst hier ausdrücklich ein testbares Event. Betreiber-TODO: Make-Zweig 'payment_cancelled' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Auf Kundenwunsch storniert" },
  },
  {
    type: "payment_reactivated",
    label: "Bestellung reaktiviert — neue Zahlungsfrist (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine abgelaufene Bestellung reaktiviert wird (neue 7-Tage-Frist). Hinweis: Beim Reaktivieren wird bereits 'payment_details' erneut versendet — ein eigenes Event ist optional. Betreiber-TODO: Make-Zweig 'payment_reactivated' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, invoice_url: INVOICE_URL_EXAMPLE, faellig_am: "2026-07-26" },
  },
  {
    type: "documents_change_request",
    label: "Dokumente-Änderung angefordert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn der Admin eine Dokumenten-Nachbesserung anfordert (changes_requested). Betreiber-TODO: Make-Zweig 'documents_change_request' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Bitte laden Sie einen aktuellen Kontoauszug (letzte 3 Monate) hoch." },
  },
  {
    type: "schufa_approved",
    label: "SCHUFA/Bonität genehmigt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine SCHUFA-/Bonitätsprüfung genehmigt wird. Betreiber-TODO: Make-Zweig 'schufa_approved' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "schufa_rejected",
    label: "SCHUFA/Bonität abgelehnt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn eine SCHUFA-/Bonitätsprüfung abgelehnt wird. Betreiber-TODO: Make-Zweig 'schufa_rejected' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Eingereichtes Dokument nicht lesbar" },
  },
  {
    type: "schufa_requested",
    label: "Neues SCHUFA-Dokument angefordert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein neues SCHUFA-/Bonitätsdokument angefordert wird. Betreiber-TODO: Make-Zweig 'schufa_requested' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Bitte laden Sie Ihre aktuelle SCHUFA-Auskunft hoch." },
  },
  {
    type: "account_activated",
    label: "Konto aktiviert (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Konto vom Admin aktiviert wird (account_status='active'). Hinweis: Bei Zahlung läuft bereits 'payment_confirmed' — dieses Event ist für manuelle Aktivierungen ohne Zahlungstrigger. Betreiber-TODO: Make-Zweig 'account_activated' + Brevo-Template.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login" },
  },
  {
    type: "account_suspended",
    label: "Konto gesperrt (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Konto vom Admin gesperrt wird (account_status='suspended'). Betreiber-TODO: Make-Zweig 'account_suspended' + Brevo-Template. Sensibel — Text sorgfältig wählen.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, grund: "Rückfrage zu den eingereichten Unterlagen" },
  },
  {
    type: "profile_query",
    label: "Profil-Rückfrage (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn der Admin eine Profil-Rückfrage stellt (profile_changes_requested). Betreiber-TODO: Make-Zweig 'profile_query' + Brevo-Template mit login_url.",
    customerBound: true,
    recommendationOnly: true,
    example: { ...CUSTOMER_EXAMPLE, login_url: "https://www.fiaon.com/login", hinweis: "Bitte ergänzen Sie Ihre monatlichen Ausgaben im Profil." },
  },
  {
    type: "gdpr_deleted",
    label: "Löschbestätigung DSGVO (Kunde)",
    description: "EMPFEHLUNG (noch kein Auto-Versand): Sollte feuern, wenn ein Kunde per DSGVO gelöscht/anonymisiert wird — Bestätigung der Löschung. Achtung: Nach der Anonymisierung ist die E-Mail-Adresse ggf. nicht mehr verfügbar; ggf. VOR der Anonymisierung senden. Betreiber-TODO: Make-Zweig 'gdpr_deleted' + Brevo-Template.",
    customerBound: false,
    recommendationOnly: true,
    example: { email: "max.mustermann@example.com", vorname: "Max", geloescht_am: "2026-07-19" },
  },
  {
    type: "contract_signed",
    label: "Vertrag signiert (Mitarbeiter)",
    description: "Feuert, wenn ein Agent den Handelsvertretervertrag digital signiert. Betreiber-TODO: Make-Zweig 'contract_signed' + Brevo-Template (Vertrags-PDF-Kopie an den Agenten).",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      agent_name: "Anna Schmidt",
      contract_version: 1,
      signed_at_text: "Mi, 15.07.2026 um 12:30 Uhr",
      doc_hash: "9f2c…",
      download_url: "/api/fiaon/agent/documents/contract/1.pdf",
    },
  },
  {
    type: "commission_statement_issued",
    label: "Provisions-Abrechnung erstellt (Mitarbeiter)",
    description: "Feuert bei jeder bestätigten Auszahlung, sobald die Provisions-Abrechnung/Gutschrift (PDF) erzeugt wurde. Betreiber-TODO: Make-Zweig 'commission_statement_issued' + Brevo-Template.",
    customerBound: false,
    example: {
      email: "anna.schmidt@example.com",
      vorname: "Anna",
      statement_no: "FIAON-COM-2026-0001",
      betrag: "125.50",
      doc_hash: "a1b2…",
    },
  },
];

export function getEventDef(type: string): MakeEventDef | undefined {
  return MAKE_EVENT_REGISTRY.find((e) => e.type === type);
}
