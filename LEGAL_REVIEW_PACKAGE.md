# LEGAL REVIEW PACKAGE — Entity-Migration SCP Real Estate KG → FIAON LTD

**Status: ENTWURF — anwaltliche Freigabe ausstehend (Kanzlei: LEXR).**
Die folgenden Rechtstexte wurden im Code deployed, gelten aber bis zur Freigabe als Entwurf.
Alle Stellen mit offenem Prüfbedarf sind im Code mit `LEGAL REVIEW REQUIRED` bzw. `TAX REVIEW REQUIRED` markiert.

## Neue Entity-Daten (überall einheitlich)

| Feld | Alt (SCP Real Estate KG) | Neu (FIAON LTD) |
|---|---|---|
| Firma | SCP Real Estate KG | FIAON LTD |
| Anschrift | Pasinger Str. 1, 82166 Gräfelfing, Deutschland | 128 City Road, London, EC1V 2NX, United Kingdom |
| Register | Amtsgericht München, HRA 120072 | Companies House (England and Wales), No. 17318250, Companies Act 2006 |
| Vertretung | Komplementär: Hans-Jürgen Gerhold | Director: Justin Schwarzott |
| USt-ID | DE123456789 (Platzhalter) | **ersatzlos entfernt** — keine deutsche USt-ID, keine UK-VAT (existieren nicht) |
| Kontakt | support@fiaon.com, Tel. +49 89 12345678 (Platzhalter) | support@fiaon.com (Telefon entfernt) |
| Crefonummer | 8330597510 | entfernt |

## Geänderte Dateien / Fundstellen (vorher → nachher)

### 1. Impressum (`client/src/pages/impressum.tsx`)
- **Vorher:** Nur Deutsch; SCP Real Estate KG, Gräfelfing; Komplementär Gerhold; HRA 120072; USt-ID-Panel DE123456789; Verantwortlicher § 18 MStV: Gerhold, Gräfelfing.
- **Nachher:** Zweisprachig (DE zuerst, EN darunter, Anker-Navigation `#impressum-de` / `#impressum-en`). Anbieterkennzeichnung FIAON LTD (alle Daten oben); Director Justin Schwarzott; Registereintrag Companies House; **USt-ID-Panel komplett entfernt**; Verantwortlicher § 18 Abs. 2 MStV: Justin Schwarzott, c/o Registered Office. Regulatorischer Disclaimer (kein Kreditinstitut, kein § 34c GewO, keine Provisionen, Eigenverantwortung, keine Bewilligungsgarantie) **inhaltlich vollständig erhalten**, nur Entity-Bezug getauscht; zusätzlich vollständige EN-Übersetzung (inkl. Hinweis „not subject to BaFin or FCA supervision"). Streitbeilegung/OS-Plattform-Absatz beibehalten (DE + EN).
- **Prüfbedarf:** § 5 DDG/§ 18 MStV-Anwendbarkeit bei UK-Anbieter mit DE-Zielmarkt; ODR-Hinweis nach Brexit.

### 2. AGB (`client/src/pages/agb.tsx`)
- **Präambel vorher:** „Die SCP Real Estate KG, Pasinger Str. 1, 82166 Gräfelfing (nachfolgend Anbieterin) …"
- **Präambel nachher:** „Die FIAON LTD, 128 City Road, London, EC1V 2NX, Vereinigtes Königreich, eingetragen im Companies House (England and Wales) unter der Company Registration Number 17318250, vertreten durch den Director Justin Schwarzott (nachfolgend Anbieterin) …"
- **§ 5 Zahlungsbedingungen vorher:** „Die Zahlungsabwicklung erfolgt über den externen Zahlungsdienstleister Stripe. Der Nutzer ermächtigt die Anbieterin, den fälligen Betrag über das gewählte Zahlungsmittel (z. B. Kreditkarte, SEPA-Lastschrift) einzuziehen."
- **§ 5 nachher:** „Die Zahlung erfolgt per Vorkasse durch SEPA-Banküberweisung auf das in der Bestellbestätigung genannte Geschäftskonto der Anbieterin. Der Zugang wird nach Zahlungseingang freigeschaltet."
- **§ 7:** geistiges Eigentum der SCP Real Estate KG → der FIAON LTD.
- **§ 12 Schlussbestimmungen:** Text UNVERÄNDERT belassen (deutsches Recht, Gerichtsstand München für Kaufleute) — im Code markiert: `LEGAL REVIEW REQUIRED: Rechtswahl/Gerichtsstand UK Ltd vs. deutsches Verbraucherrecht`.
- **Widerrufsbelehrung in den AGB:** Adressdaten auf FIAON LTD umgestellt, Inhalt (Fristen, Folgen, Erlöschen, Muster-Formular) unverändert.

### 3. Widerrufsbelehrung (`client/src/pages/widerrufsbelehrung.tsx`)
- Beide Adressblöcke (Belehrung + Muster-Formular) auf FIAON LTD, London umgestellt. Telefonnummer (Platzhalter) entfernt. Inhalt unverändert.

### 4. Datenschutzerklärung (`client/src/pages/privacy.tsx`)
- **I. Verantwortlicher:** FIAON LTD, London; Director Justin Schwarzott; Company No. Neuer Hinweis: UK-Angemessenheitsbeschluss (Art. 45 DSGVO). Markiert: `LEGAL REVIEW REQUIRED: Art. 27 DSGVO (EU-Vertreter) + internationale Datentransfers`.
- **V. Zahlungsabwicklung vorher:** Stripe-Passus (Stripe Payments Europe, Datenübermittlung an Stripe, stripe.com/privacy).
- **V. nachher:** SEPA-Banküberweisung/Vorkasse: Verarbeitung der Überweisungsdaten (Kontoinhaber, IBAN, Verwendungszweck, Betrag, Buchungsdatum) zur Zahlungszuordnung; Rechtsgrundlagen Art. 6 Abs. 1 lit. b + c DSGVO; Hinweis kontoführendes EU-Zahlungsinstitut. Markiert: `LEGAL REVIEW REQUIRED`.

### 5. Cookie-Einstellungen (`client/src/pages/cookie-einstellungen.tsx`)
- Verantwortliche Stelle: FIAON LTD-Block (inkl. Company No., Director).

### 6. Website-Footer (`client/src/components/PremiumFooter.tsx`)
- Disclaimer-Absatz: „bereitgestellt von der FIAON LTD (128 City Road, London, EC1V 2NX, United Kingdom · Companies House No. 17318250)" — Rest inhaltlich unverändert.
- Copyright: „© 2026 FIAON – FIAON LTD, Registered in England and Wales, Companies House No. 17318250 · Director: Justin Schwarzott."

### 7. B2B-Vertragsvorlage (`client/src/utils/contractTemplate.ts`)
- Anbieter-Block, Signatur-Block und Fußzeile auf FIAON LTD umgestellt; Crefonummer entfernt.
- **§ 8 Schlussbestimmungen:** „Gerichtsstand Gräfelfing, Landgerichtsbezirk München" ersetzt durch „Sitz der Anbieterin (London, Vereinigtes Königreich), soweit gesetzlich zulässig" — **einzige inhaltlich angepasste Klausel** (alter Ortsbezug war Entity-gebunden). Markiert: `LEGAL REVIEW REQUIRED`. Rechtswahl (deutsches Recht) unverändert.

### 8. Server-Vertrags-PDFs (`server/routes/fiaon-antrag.ts`, beide Generatoren)
- Vorher: Platzhalter „FIAON Financial Services GmbH, Musterstraße 123, 10115 Berlin", „Ort: Berlin".
- Nachher: FIAON LTD-Block, „Ort: London", Fußzeile mit Companies House No. + Director.

### 9. E-Mail-Footer (`server/email/fiaon-payment-emails.ts`)
- Vorher: „Fiaon Ltd · Diese E-Mail wurde automatisch versendet."
- Nachher: vollständiger Legal-Footer (Anschrift, Registered in England and Wales, Company No., Director, support@fiaon.com, DE+EN-Zeile).

### 10. Rechnungen (NEU, `server/fiaon-invoice.ts`)
- Kopf/Fuß: FIAON LTD komplett. **USt-Zeile konfigurierbar** (`INVOICE_VAT_MODE`, Default: kein Steuerausweis + Hinweis „Hinweis zur Umsatzsteuer: folgt nach steuerlicher Registrierung."). Im Code markiert: `TAX REVIEW REQUIRED: Non-Union OSS Registrierung ausstehend`.

## Offene Punkte für die Kanzlei
1. Rechtswahl-/Gerichtsstandsklauseln (AGB § 12, B2B-Vertrag § 8) — UK Ltd vs. deutsches/EU-Verbraucherrecht (Art. 6 Rom I, Art. 17/18 Brüssel Ia bzw. Lugano/HCCH nach Brexit).
2. DSGVO: Pflicht zur Benennung eines EU-Vertreters nach Art. 27 DSGVO; Datentransfer UK (Adequacy Decision, Ablauf/Verlängerung beachten).
3. Impressumspflicht § 5 DDG für Nicht-EU-Anbieter mit DE-Ausrichtung; § 18 Abs. 2 MStV Verantwortlicher mit Wohnsitz außerhalb DE.
4. Umsatzsteuer: Non-Union-OSS-Registrierung für B2C-Digitalleistungen an EU-Kunden — vor Massenversand von Rechnungen klären (aktuell bewusst KEIN Steuerausweis).
5. Widerrufsbelehrung: Anpassungsbedarf bei Drittlands-Anbieter (Inhalt unverändert übernommen).
