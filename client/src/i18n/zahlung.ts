// ═══════════════════════════════════════════════════════════════════════════
// /zahlung/<Verwendungszweck> — DAS KLEINE WÖRTERBUCH DER ZAHLUNGSSEITE
// (17.09.2026, E-188)
//
// Ein Unternehmen, das seinen Auftrag über FIAON Global auf /en/business/start
// unterschrieben hat, bekam Vertrag und Mail englisch — und landete dann auf einer
// deutschen Zahlungsseite. Die Sprache steht in der Auftragsakte und kommt mit
// GET /payment-order/:ref (Feld `sprache`, nur beim Firmenauftrag).
//
// „de" ist wörtlich der Bestand der Seite: Privatkunden und Monatsraten lesen sie
// unverändert — mit EINER Korrektur: Schritt 3 duzte mitten auf der gesiezten Seite
// („Wähle dort … und lade …"); er heißt jetzt „Wählen Sie dort … und laden Sie …".
// „en" ist britisches Englisch und gilt NUR für den Firmenauftrag;
// alles, was nur die Privatkundenlinie zeigt (Konto aktivieren, Terminkachel,
// Sofortzahlung), steht deshalb nicht hier, sondern weiter deutsch in der Seite.
//
// Die Datei folgt dem Hausmuster der Wörterbücher (const de / const en: typeof de):
// scripts/seo-wortverbote-en.ts liest die englische Hälfte damit von selbst mit,
// und scripts/pruef-global-querschnitt.ts prüft, dass beide Hälften dieselben
// Schlüssel tragen.
// ═══════════════════════════════════════════════════════════════════════════

const de = {
  zahlen: "de-DE",
  laden: "Zahlungsdaten werden geladen…",
  nichtGefunden: "Bestellung nicht gefunden",
  bezahltTitel: "Zahlung eingegangen ✓",
  bezahltFirma: (firma: string, paket: string) => `Die Zahlung${firma ? ` von ${firma}` : ""} ist bei uns eingegangen — Ihr Auftrag${paket ? ` ${paket}` : ""} hat begonnen. Ihren Ansprechpartner und die Liste der Unterlagen finden Sie in unserer E-Mail.`,
  titelFirma: "Ihr Auftrag: Zahlung per Überweisung",
  statusFirma: ["Einmalig ", ", zahlbar bis zum ", ". Mit dem Zahlungseingang beginnen wir."],
  einmalig: "einmalig",
  gemeldetFirma: "Danke — wir prüfen Ihren Zahlungseingang. Sobald er gebucht ist, erhalten Sie eine E-Mail, und Ihr Auftrag beginnt.",
  abgelaufen: "Die Zahlungsfrist ist abgelaufen. Bitte kontaktieren Sie unseren Support, um Ihren Antrag zu reaktivieren.",
  boxTitelFirma: "Rechnung überweisen – ganz einfach",
  // FIAON Global spricht keine Empfehlungen aus (Register E-188) — der Firmenauftrag nennt den Weg beim Namen.
  schnellFirma: "Der schnelle Weg (fehlerfrei)",
  schritt1: ["Tippen Sie unten auf ", "„QR-Code speichern\"", " – der Code wird in Ihrer Foto-Galerie gespeichert."],
  schritt2: "Öffnen Sie Ihre Banking-App und starten Sie eine neue Überweisung.",
  schritt3: ["Wählen Sie dort ", "„Rechnung fotografieren\"", " oder ", "„QR-Code aus Galerie\"", " und laden Sie den gespeicherten Code hoch. Alle Daten – auch Ihr persönlicher Code – werden automatisch ausgefüllt."],
  schritt3Breit: " Oder scannen Sie den Code unten einfach mit Ihrer Banking-App am Handy.",
  alternativ: "Alternativ (von Hand)",
  alternativText: ["Sie können die Daten auch einzeln unten kopieren und selbst eintragen. Wichtig: Tragen Sie dabei den Code", " als Verwendungszweck ein."],
  qrText: "GiroCode — enthält Empfänger, IBAN, Betrag und Ihren persönlichen Verwendungszweck.",
  qrSpeichern: "QR-Code speichern",
  qrGespeichert: "QR-Code gespeichert ✓",
  qrGeteilt: "QR-Code gespeichert – öffnen Sie jetzt Ihre Banking-App und laden Sie ihn dort hoch.",
  qrGeladen: "Das Bild wurde gespeichert – Sie finden es in Ihren Downloads/Fotos. Öffnen Sie jetzt Ihre Banking-App und laden Sie es dort hoch.",
  empfaenger: "Empfänger", betrag: "Betrag", zweck: "Verwendungszweck",
  zweckHinweis: "Ohne diesen Code können wir Ihre Zahlung nicht zuordnen.",
  kopieren: "Kopieren", kopiert: "Kopiert ✓", kopierenLabel: (feld: string) => `${feld} kopieren`,
  ibanHinweis: (bank: string, land: string) => `Ihre Überweisung geht an unser Geschäftskonto bei ${bank} (die IBAN beginnt mit ${land}). Das ist eine ganz normale SEPA-Überweisung – kostenlos und in der Regel innerhalb eines Bankarbeitstages, genau wie eine Inlandsüberweisung.`,
  warumTitel: "Warum Überweisung?",
  warumText: " Sie behalten die volle Kontrolle: keine automatischen Kartenabbuchungen, keine gespeicherten Zahlungsdaten. Sie entscheiden bei jeder Zahlung selbst.",
  claim: "Ich habe die Überweisung getätigt", moment: "Einen Moment…",
  claimHinweis: "Bitte erst tippen, wenn Sie die Überweisung in Ihrer Banking-App abgeschickt haben.",
  badges: ["SSL-verschlüsselt", "SEPA-Überweisung", "EU-Konto"],
};

const en: typeof de = {
  zahlen: "en-GB",
  laden: "Loading your payment details…",
  nichtGefunden: "Order not found",
  bezahltTitel: "Payment received ✓",
  bezahltFirma: (firma: string, paket: string) => `The payment${firma ? ` from ${firma}` : ""} has arrived — your order${paket ? ` ${paket}` : ""} has started. You will find your contact and the list of documents in our email.`,
  titelFirma: "Your order: payment by bank transfer",
  statusFirma: ["One-off ", ", payable by ", ". Work begins once your payment has arrived."],
  einmalig: "one-off",
  gemeldetFirma: "Thank you — we are checking for your payment. As soon as it has been recorded you will receive an email, and your order begins.",
  abgelaufen: "The payment period has ended. Please write to support@fiaon.com or reply to our email — we will reopen your order.",
  boxTitelFirma: "Paying the invoice – quite simple",
  schnellFirma: "The quick way (error-free)",
  schritt1: ["Tap ", "“Save QR code”", " below – the code is saved to your photo gallery."],
  schritt2: "Open your banking app and start a new transfer.",
  schritt3: ["Choose ", "“Scan an invoice”", " or ", "“QR code from gallery”", " there and upload the saved code. All details – including your personal reference – are filled in automatically."],
  schritt3Breit: " Or simply scan the code below with the banking app on your phone.",
  alternativ: "Alternatively (by hand)",
  alternativText: ["You can also copy the details below one by one and enter them yourself. Important: enter the code", " as the payment reference."],
  qrText: "GiroCode (EPC QR code) — contains the recipient, IBAN, amount and your personal payment reference.",
  qrSpeichern: "Save QR code",
  qrGespeichert: "QR code saved ✓",
  qrGeteilt: "QR code saved – now open your banking app and upload it there.",
  qrGeladen: "The image has been saved – you will find it in your downloads or photos. Now open your banking app and upload it there.",
  empfaenger: "Recipient", betrag: "Amount", zweck: "Payment reference",
  zweckHinweis: "Without this code we cannot match your payment.",
  kopieren: "Copy", kopiert: "Copied ✓", kopierenLabel: (feld: string) => `Copy ${feld}`,
  ibanHinweis: (bank: string, land: string) => `Your transfer goes to our business account with ${bank} (the IBAN starts with ${land}). It is an ordinary SEPA transfer – free of charge and usually completed within one banking day, just like a domestic transfer.`,
  warumTitel: "Why a bank transfer?",
  warumText: " You stay in full control: no automatic card charges, no stored payment details. You decide on every payment yourself.",
  claim: "I have made the transfer", moment: "One moment…",
  claimHinweis: "Please tap only once you have sent the transfer in your banking app.",
  badges: ["SSL encrypted", "SEPA transfer", "EU account"],
};

export const ZAHLUNG_WOERTER = { de, en };
export type ZahlungWorte = typeof de;
