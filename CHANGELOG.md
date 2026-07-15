# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

---

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
