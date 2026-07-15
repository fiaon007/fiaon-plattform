# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

---

## 15.07.2026 — Fix: KI läuft überall nur über OpenAI

**Was:** Jede KI-Funktion in FIAON (Arbeitsberichte/Leistung, System-Diagnose, Stripe-Umsatzanalyse) nutzt jetzt **ausschließlich `OPENAI_API_KEY`** — kein Gemini, kein anderer Anbieter.
**Warum:** Die KI-Zusammenfassung schlug fehl, weil zuerst ein Gemini-Aufruf versucht wurde; schlug dieser fehl (ungültiger/fehlender Gemini-Schlüssel, Timeout), kam es zum Fehler statt zur Antwort.
**Wo:** `aiComplete` (zentrale Stelle für Leistung + Diagnose) und die Stripe-KI-Insights. Modell über `OPENAI_MODEL` einstellbar (Default `gpt-4o-mini`). Bei Problemen zeigt die Seite die Klartext-Ursache (Schlüssel ungültig 401, Kontingent 429, Modell nicht verfügbar 404, Zeitüberschreitung).

## 15.07.2026 — Phase 5: System-Diagnose („Was klemmt gerade?")

**Was:** Eine neue Seite `/admin/diagnose` zeigt in Echtzeit, was im System hakt — technisch, bei Kunden, bei Agenten — bevor jemand ein Ticket schreibt.
**Warum:** Beim Make-Ausfall gab es keinen Ort, an dem man „seit X Stunden kein Lead-Eingang" oder „E-Mail an Kunde fehlgeschlagen" auf einen Blick gesehen hätte.
**Wo:** Menü „System & Recht → System-Diagnose".
- **Ereignis-Konsole (Hauptansicht):** jedes Problem mit Schweregrad (kritisch/warnung/info), Kategorie, Zeit, Klartext-Bedeutung, Lösungshinweis und — wo möglich — Direktlink oder Aktion (z. B. „Akte freigeben", „Event erneut senden"). Standardfilter: kritisch + Warnung der letzten 24 h. Gleiche Fehler werden gebündelt („23× Make-Webhook 502").
- **Kategorien:** E-Mail/Make (fehlgeschlagene Events), Lead-Eingang (abgelehnt/ungültig/Ausbleiben), Zahlungen (nicht zugeordnet, Betragsabweichung, Provision offen, Dubletten), Agenten (blockierte Akte), Kunden, System (unbehandelte Fehler).
- **Rohdaten-Tab:** Roh-Log-Auszug für die Tiefenanalyse — im Speicher hart begrenzt (1.000 Zeilen / 2 MB Ring-Puffer, 512-MB-tauglich), maskiert, durchsuchbar, als Datei ladbar.
- **KI-Auswertung:** „Probleme zusammenfassen" → Klartext: was ist kaputt, was wiederholt sich, wahrscheinliche Ursache, Reihenfolge der Behebung. Nur maskierte/aggregierte Daten (ausschließlich OpenAI, `OPENAI_API_KEY`).
- **Sicherheit/DSGVO:** Maskierung passiert SERVERSEITIG vor jeder Speicherung — API-Keys, Tokens, Passwörter, Secrets, IBANs, vollständige E-Mails und Telefonnummern werden redigiert (`ma***@gmail.com`, `+49 *** *** **52`, `ghp_***REDIGIERT***`). Aufbewahrung 7 Tage + Löschfunktion. Nur Admin (Agenten: 403).
- **Verknüpfung:** kritische Ereignisse erscheinen zusätzlich als Warn-Kachel auf dem Dashboard und als Nav-Badge — eine Wahrheit, zwei Ansichten.
- **Historie & Export:** Ereignisse werden persistiert (Zeitraum-Auswahl, Datei-Export), damit man rückwirkend analysieren kann.

## 15.07.2026 — Phase 4: Admin-UX, Hinweise & Arbeitsberichte

**Was:** Die Verwaltung erklärt sich selbst — Hinweis-Badges, Aufgaben-Dashboard, Arbeitsberichte mit KI-Analyse, Hilfe auf jeder Seite, aufgeräumte Navigation, diese Changelog-Seite.
**Warum:** „Ich kenne mich gar nicht aus, ich weiß nie wo ich bin oder was zu tun ist“ — der Betreiber musste bisher jede Seite öffnen, um zu sehen, ob dort Arbeit liegt.
**Wo:**
- **Zähler-Badges in der Navigation:** dezente Pills an Zahlungszentrale, Kontoabgleich, Auszahlungen, Dubletten, Provisionen nachbuchen und Agent-Feedback — verschwinden bei 0. Ein einziger, 60 s gecachter Server-Endpoint liefert alle Zähler.
- **Dashboard zum Arbeiten** (`/admin`): „Was ist zu tun?“ mit direkter Aktion pro Aufgabe, Warn-Kacheln bei echten Problemen (kein Lead-Eingang seit X Stunden, Automatik pausiert, blockierte Akte) mit Erklärung + Lösung, prominente Kundensuche, klickbare Kennzahlen mit ⓘ-Definition.
- **Arbeitsberichte** (`/admin/leistung`): Ergebnisse pro Agent (Akten, Kontakte, Links, Konversionen, Abschlüsse, Umsatz, Provision, Reaktionszeit, Rückgabe- und Direktzahler-Quote) + Team-Zeitverlauf + Quellen-Konversion. **Keine Arbeitszeit-/Pausen-/Anwesenheits-Erfassung** (Scheinselbstständigkeit/DSGVO); jeder Agent sieht seine eigenen Zahlen im Portal („Mehr → Meine Leistung“). KI-Zusammenfassung auf Knopfdruck — nur anonymisierte Summen gehen an die KI, Ergebnis kopier- und speicherbar.
- **Jede Seite erklärt sich selbst:** Titel + Untertitel in Du-Form und einklappbares „Wie funktioniert diese Seite?“ auf allen Admin-Seiten (beim ersten Besuch offen).
- **Navigation aufgeräumt:** Dubletten und Leistung neu im Menü, „Agent-Updates“/„Agent-Feedback“ zusammengelegt (zeigten dieselbe Seite), Agent-Portal-Pflegeseite aufs Standard-CI gebracht, Routen-Audit: jede Seite ist über das Menü erreichbar.
- **Diese Seite** (`/admin/changelog`): jede System-Änderung in Klartext, gespeist aus dem im Code gepflegten Protokoll.

## 15.07.2026 — Phase 2B: Verifikation & Scharfstellung der Geldlogik

**Was:** Stichtag-Regel für die neue Provisionslogik, Deadlock-Schutz für Lead-Akten, Grenzfall-Fixes, Test-Skripte.
**Warum:** Phase 2 hätte ohne Stichtag rückwirkend gewirkt — 35 offene Bestellungen mit Agent, aber ohne dokumentiertes Ergebnis (Stripling 22, Lombardi 12, Schwarzott 1) hätten bei Zahlung keinen Anspruch mehr gehabt. Außerdem konnte sich ein Agent mit einer offenen Akte aussperren.
**Wo:**
- **Stichtag (kein rückwirkender Regelwechsel):** Bestellungen, die vor dem Stichtag erstellt wurden, laufen nach dem alten Modell (Zuweisung genügt). Erst ab Stichtag gilt „Betreuung dokumentiert". Stichtag ist im Admin sichtbar (Leads → Einstellungen) und wird einmalig per Skript gesetzt (`scripts/phase2b-scharfstellen.ts`) — bereits gebuchte Provisionen bleiben unter allen Umständen unangetastet.
- **Akte-Deadlock verhindert:** Offene Akten ohne Ergebnis werden nach 30 Min. automatisch freigegeben (einstellbar); Agent kann selbst „ohne Ergebnis schließen" (mit Begründung); Admin kann jede Akte freigeben (Leads → Lead öffnen → „Akte freigeben"). Leads ohne Telefon UND E-Mail kommen gar nicht erst in die Warteschlange.
- **Grenzfall-Fix Dubletten:** Dokumentierte Betreuung zählt jetzt über die ganze Bestell-Familie (gleiche E-Mail) — zahlt der Kunde die Schwester-Bestellung, greift die Attribution trotzdem.
- **Klarstellung Link-Versand:** „Antrag/Zahlungslink senden" durch einen Agenten ist Verkaufsarbeit und zählt als dokumentierte Betreuung (war bereits so implementiert).
- **Skripte:** `scripts/phase2b-rematch.ts` (Bank-Altbestand zuordnen, Dry-Run/Write), `scripts/phase2b-e2e.ts` (Ende-zu-Ende-Test der Geldlogik mit markierten Testdaten), `scripts/diagnose-phase2b.ts` (nur lesend).

## 15.07.2026 — Phase 2: Geld & Vertrauen

**Was:** Kontoabgleich repariert, Provisionslogik neu geregelt, Lead-Arbeitswarteschlange, einheitliche Finanz-Kennzahlen.
**Warum:** 0 % der Bankeingänge wurden automatisch erkannt (falsches Vergleichsfeld); Provisionen wurden per Zufalls-Verteilung „verlost" statt verdient; 826 offene Leads mit sichtbaren Kontaktdaten waren keine Arbeitsliste; „bezahlt" bedeutete in jeder Ansicht etwas anderes.
**Wo:**
- **Kontoabgleich** (`/admin/kontoabgleich`): erkennt jetzt die kurze Zahlungsreferenz von QR-Code/Zahlungsseite (tolerant gegen Schreibweisen). Button „Offene neu abgleichen" für den Altbestand (ordnet nur zu, verbucht nichts). Vorschläge nach Name+Betrag mit Konfidenz — nie automatische Buchung. Verbuchen wirkt exakt wie der „bezahlt"-Button (Freischaltung, Dubletten-Stopp, Bestätigungs-Mail 1×, Provisionsprüfung).
- **Provision** : wird verdient, nicht verlost. Anspruch nur bei dokumentierter Betreuung (Kontakt-Ergebnis oder Kundenmail vor Zahlung); letzter dokumentierter Kontakt gewinnt; ohne Betreuung → „Direktzahler, keine Provision". Der Grund steht sichtbar am Kunden. Zufalls-Verteilung von Bestellungen abgeschaltet. Altfälle im Nachbuchungs-Center (`/admin/nachbuchung`) mit Vorschlag — Buchung nur nach Admin-Bestätigung.
- **Lead-Warteschlange** (Agent-Portal → Leads): Kontaktdaten verdeckt bis „Akte öffnen" (protokollierte Übernahme); nur eine offene Akte, nächste erst nach dokumentiertem Ergebnis; Reihenfolge vom Server (Gewichte im Admin einstellbar, Fairness-Anteil für alte Leads); Wiedervorlage statt Löschen.
- **Eine Wahrheit für Zahlen** (`server/lib/fiaon-truth.ts`): „bezahlt" = Status bezahlt + keine Dublette + Zahlungsreferenz vorhanden — überall identisch (Zahlungszentrale, Finanzen, Leads, Dashboard, Agent-Portal). Alt-Import separat ausgewiesen; „Kontaktiert" heißt ehrlich „Angeschrieben (Mail)"; LTV/CAC als Annahme gekennzeichnet; Selbstcheck unter `/api/fiaon/admin/truth-check`.

---

# Rückwirkendes Protokoll (vor Einführung dieser Changelog-Pflicht)

Zusammengetragen aus Git-Historie, `MIGRATION_INVENTORY.md`, `AGENT_REVAMP_AUDIT.md` und `SYSTEM_DIAGNOSE.md`.

## 14.07.2026 — Kein Kunde verschwindet (Lifecycle-Vereinheitlichung)

**Was:** Abgelaufene Kunden bleiben für ihren Agenten sichtbar (read-only) und können reaktiviert werden; eine zentrale Kundensicht.
**Warum:** Kunden „verschwanden“ nach Ablauf aus dem Agent-Portal — Chancen gingen verloren.
**Wo:** Agent-Portal → Kunden.

## 13.07.2026 — Nachbuchungs-Center (Pakete EA–EF)

**Was:** Automatische Erkennung bezahlter Bestellungen ohne Provision + Sammel-/Einzelbuchung; Zuordnungs-Reparatur über Dubletten; bezahlte Bestellungen überall auffindbar.
**Warum:** Ein Dubletten-Bug hatte Fälle hinterlassen, in denen die Zahlung auf einer anderen ref einging als die Betreuung dokumentiert war.
**Wo:** `/admin/nachbuchung`.

## 12.07.2026 — Verschwundene Kunden behoben (Pakete DA–DF)

**Was:** Eigene Kunden bleiben nach Bezahlung/Ablauf sichtbar; Agent-Suche, Provisions-Anzeige und Adressfelder im Kundendetail; Verlaufs-Korrektur (Soft-Delete statt Löschen); Zwei-Schritt-Bestätigung bei Kontakt-Ergebnissen.
**Wo:** Agent-Portal → Kunden.

## 10.–11.07.2026 — Lead-Nachfass-Zeitplan + Bulk-Versand (Pakete CB–CF)

**Was:** Feste Sendezeiten/Wochentage für die Nachfass-Automatik, zwei klare Bulk-Buttons (fällige/alle offenen) mit Fortschritt, Lead-Detail-Drawer, Intake-Diagnose mit Test-Lead.
**Wo:** `/admin/leads`.

## 09.07.2026 — Kontoabgleich eingeführt + Funnel-Fix (Paket CA)

**Was:** Kontoauszug (CSV) importieren, Eingänge Kunden zuordnen, verbuchen; Funnel-Raten korrigiert.
**Wo:** `/admin/kontoabgleich`, `/admin/finanzen`.

## 08.07.2026 — Lead-Management + Finanz-Analytics (Pakete BA–BE)

**Was:** Lead-Intake per Make-Webhook, Auto-Konversion Lead→Kunde, Nachfass-Automatik, Lead-Verteilung ans Team, Alt-Lead-Import; Finanzen & Sales mit Funnel, CAC und Kampagnen-Attribution.
**Wo:** `/admin/leads`, `/admin/finanzen`, Agent-Portal → Leads.

## 06.07.2026 — Agent-Portal Motivations-Update (Pakete AG–AO)

**Was:** Dashboard „Mein Tag“, Live-Feed, Wunschgehalt-Rechner, Update-Center mit Banner, Feedback mit Belohnung.
**Wo:** Agent-Portal; Pflege unter `/admin/agent-portal`.

## 04.–05.07.2026 — Kundendaten-Korrektur, Dubletten-System, Partner-Programm (Pakete AC–AF)

**Was:** Agenten können Stammdaten korrigieren (mit Audit + Dubletten-Warnung); bezahlte Bestellung ersetzt offene Schwester-Bestellungen (Erinnerungs-Stopp); automatische Kundenverteilung; Partner-Programm mit Meilensteinen und Team-Beteiligung (exakt eine Ebene); Rechnungs-PDF-Fix.
**Wo:** Agent-Portal → Kunden; `/admin/team`.

## Juni 2026 — Fundament

- **E-Mail-Engine (Pakete T–X):** Event-Test-Konsole, tägliche Zahlungs-Erinnerungen (Obergrenze, Not-Aus, 08–20 Uhr Berlin), Bulk-Versand mit Fortschritt — `/admin/events`.
- **Login/Aktivierung (Paket Y/Z):** Konto wird erst mit Zahlung aktiv; Voll-IBAN nur für Admins mit Audit je Abruf.
- **Navigation (Pakete L–O):** AdminShell mit Sidebar/Breadcrumb/⌘K-Suche, Kommandozentrale `/admin`, neue Seiten Rechnungen/Einstellungen/Audit/Recht.
- **Mitarbeiter-System (Pakete E–K):** Einladungs-Onboarding, verschlüsselte Bankdaten, Provisions-Engine (eingefrorene Sätze, Integer-Cents), Auszahlungen mit Admin-Freigabe, Skripte, Kalender — `/admin/team`.
- **Entity-Migration FIAON LTD:** Rechtstexte DE/EN, Rechnungssystem mit lückenlosem Nummernkreis, Agent-Portal-Grundgerüst, Zahlungszentrale saniert.
- **Make.com-Anbindung:** welcome/payment_details/followup-Mails über Webhooks (genau 1× via atomare Flags); Dubletten-Fix im Antragsprozess.
