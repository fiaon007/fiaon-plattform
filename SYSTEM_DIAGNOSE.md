# SYSTEM-DIAGNOSE — Phase 1 (Fakten, keine Umbauten)

**Stand:** 15.07.2026, ca. 16:00 Uhr (Europe/Berlin) — alle Zahlen live aus der Produktions-Datenbank.
**Methode:** Nur-Lese-Skript `scripts/diagnose-phase1.ts` (ausschließlich SELECT, keine Datenänderung). Jederzeit wiederholbar mit `npx tsx scripts/diagnose-phase1.ts` — Rohausgabe landet in `/tmp/diagnose.txt`.
**Hinweis zu Abweichungen:** Das System läuft live weiter. Screenshots des Betreibers (z. B. „85 bezahlt") und die heutigen Messwerte (86) können um 1–2 abweichen — gleiche Kennzahl, späterer Zeitpunkt.

---

## Das Wichtigste in 6 Sätzen

1. **Die 1.668 offenen Leads sind alle zugewiesen** (826 Daniel, 841 Florentine) — die Agenten-Endpoints liefern sie auch aus. „Keine Arbeit" ist auf DB-Ebene falsch; wo der Eindruck herkommt, steht unter D1.
2. **Attribution bricht bei der Lead→Kunde-Konversion** (eigener, zweiter Bug — nicht der Dubletten-Bug aus dem Juli): Der Agent des Leads wird nie auf die Bestellung übertragen, danach verlost eine Rotationsverteilung die Bestellung neu. 24 Bestellungen haben heute einen **anderen** Agenten als der Lead, 56 bezahlte Konversionen haben **gar keinen** Agenten.
3. **Die fünf „Bezahlt"-Zahlen sind alle technisch korrekt berechnet — aber jede beantwortet eine andere Frage** (anderer Filter, anderer Zeitraum, andere Grundmenge). 69 der 155 bezahlten Datensätze sind Alt-Importe ohne Zahlungsreferenz und ohne Betrag — sie sind der Hauptgrund der Widersprüche.
4. **`/admin/database` ist ein Legacy-Cockpit aus einem früheren Produktstand** (CEO Mind OS, Stripe, Investoren) mit eigener Sidebar — nur 2 von 11 Unterseiten arbeiten sinnvoll mit echten FIAON-Daten.
5. **Von 4.314 sichtbaren „Anträgen" sind nur ca. 1.502 echte, unterscheidbare Personen.** 2.597 Datensätze haben weder E-Mail noch Telefon (Funnel-Abbrecher auf Schritt „Persönliche Daten"). Dubletten entstehen, weil jeder Browser-Besuch einen neuen Datensatz anlegt (Code-Beleg unter D5).
6. **Der Kontoabgleich matcht praktisch nie automatisch (0 von 66 offenen Eingängen)**, weil der Code gegen das falsche Feld prüft. 50 der 66 würden sofort matchen, wenn zusätzlich gegen `payment_reference` geprüft würde.

---

## D1 — „Agenten haben keine Arbeit" trotz ~1.620 offener Leads

### D1.1 Zuweisung: Es gibt KEINE unzugewiesenen offenen Leads

```sql
-- offen = status IN ('neu','kontaktiert','nicht_erreichbar')
SELECT COUNT(*), COUNT(*) FILTER (WHERE assigned_agent_id IS NULL)
FROM fiaon_leads WHERE status IN ('neu','kontaktiert','nicht_erreichbar');
```

**Ergebnis: 1.668 offene Leads, davon 0 ohne Agent.**

| Agent | Name | aktiv | Verteilung | offene Leads | offene Kunden | abgelaufene Kunden |
|---|---|---|---|---|---|---|
| #2 | Justin Schwarzott | ja | nein | 1 | 0 | 1 |
| #5 | Herbert Schöttl | ja | nein | 0 | 0 | 0 |
| #7 | Justin Schwarzott | **nein** | nein | 0 | 1 | 0 |
| #8 | Daniel Stripling | ja | **ja** | **826** | 84 | 26 |
| #10 | Florentine Lombardi | ja | **ja** | **841** | 76 | 4 |

### D1.2 Die exakten Filter der Agenten-Ansichten

`GET /agent/leads` (`server/routes/fiaon-leads.ts:580`):

```sql
WHERE assigned_agent_id = <Agent> AND status IN ('neu','kontaktiert','nicht_erreichbar')
```

`GET /agent/customers` (`server/routes/fiaon-agent.ts:1146`):

```sql
WHERE merged_into IS NULL
  AND (payment_status IN ('pending_payment','claimed_paid')
       OR (payment_status = 'expired' AND assigned_agent_id = <Agent>))
```

**Durch diese Filter fällt kein zugewiesener offener Lead.** Es gibt keinen versteckten Zusatzfilter (kein `in_sequence`, kein Datum, kein Lock).

### D1.3 `in_sequence`

Alle 1.668 offenen Leads stehen auf `in_sequence = TRUE` (0 auf FALSE). **`in_sequence` beeinflusst ausschließlich den automatischen Mailversand** (`claimLeadFollowupBatch`, `fiaon-leads.ts:359`), **nicht die Sichtbarkeit** — `GET /agent/leads` filtert nicht danach.

### D1.4 Gegenprobe Agent #8 (Daniel Stripling)

Exakt die Anrufliste-Abfrage ausgeführt: **826 Leads**. Dazu 84 offene Kunden in der Arbeitsliste. Auf Datenbank- und API-Ebene hat Daniel also sehr viel Arbeit sichtbar.

**Wenn Daniel trotzdem eine leere Liste sieht, liegt es nicht an den Daten oder den Server-Filtern** — dann wäre es Frontend/Login/Cache. Das konnte in dieser Phase nicht am lebenden Agenten-Browser geprüft werden: **unklar**, bitte einmal gemeinsam mit Daniel den Bildschirm prüfen.

### D1.5 „Agent —" in der Lead-Liste / Round-Robin

Die Rotationsverteilung läuft alle 5 Minuten (letzter Lauf heute 15:46 Uhr, insgesamt 1.734 Zuweisungs-Logs) und hat aktuell nichts zu tun (0 unzugewiesene offene Leads). `distribution_cap = 250` gilt **nur für Kundenbestellungen**, nicht für Leads — die Lead-Verteilung hat keine Obergrenze.

**Die „Agent —"-Einträge, die der Betreiber sieht, sind KONVERTIERTE Leads: 144 Leads mit Status `konvertiert` haben keinen Agenten.** Konvertierte Leads sind aus der Verteilung raus (sie ist nur für offene Leads) und die Konversion trägt nie einen Agenten nach → sie bleiben für immer „—". Das ist ein Anzeige-Symptom des Attribution-Bugs aus D2, kein Verteilungsproblem.

---

## D2 — Lead konvertiert + bezahlt, aber ohne Agent

### Der konkrete Fall Hüseyin Dereli (Lead #1822 → FIAON-MRLQ838F-P2FA)

Zeitachse (aus DB belegt):

| Zeitpunkt (Berlin) | Ereignis |
|---|---|
| 15.07. 06:56 | Kunde legt **selbst** die Bestellung `FIAON-MRLQ838F-P2FA` an (79,99 €, Zahlungsreferenz `FIAON-NP3235`) |
| 15.07. 09:22 | Kunde meldet „Zahlung getätigt" (`claimed_paid_at`) |
| 15.07. 15:19 | **Danach** kommt der Facebook-Lead #1822 rein und wird sofort automatisch auf die bestehende Bestellung konvertiert (E-Mail/Telefon-Treffer) |

- **Hatte der Lead je einen Agenten?** Nein — `assigned_agent_id = NULL`, und er bleibt NULL (Konversion trägt nichts nach). Das ist das „Agent: leer", das der Betreiber in der Lead-Liste sah.
- **Hat die Bestellung einen Agenten?** Ja, inzwischen: Agent #10 (Florentine Lombardi) — aber **per Rotations-Los** (`distributeUnassignedOrders`), nicht durch Betreuung.
- **Existiert eine Provision?** Ja: 16,00 € für #10 (own) + 4,00 € Override für #8. In diesem Einzelfall ging also keine Provision verloren — sie wurde nur **verlost statt verdient**.

### Wie groß ist das Problem insgesamt?

```sql
-- Grundmenge: Leads mit status='konvertiert', gejoint auf ihre Bestellung
```

| Messung | Anzahl |
|---|---|
| Konvertierte Leads gesamt | 210 (davon 202 mit auffindbarer Bestellung) |
| Lead hatte Agent, Bestellung hat **keinen** | **7** |
| Lead-Agent und Bestellungs-Agent sind **verschieden** (Rotations-Lotterie) | **24** |
| Bestellung **bezahlt**, aber **kein Agent** dran | **56** |
| Bestellung **bezahlt**, aber **keine Provision** gebucht | **64** |
| Konvertierte Leads, die in der Liste „Agent —" zeigen | 144 |

Zum Vergleich über ALLE bezahlten Bestellungen (auch ohne Lead-Bezug): 155 bezahlt, davon 100 ohne Agent, 109 ohne Provision — der Großteil davon sind Alt-Importe (siehe D3).

### Wo bricht die Kette? (Code-Pfad)

1. `convertLeadsForContact` (`server/routes/fiaon-leads.ts:249`) setzt den Lead auf `konvertiert` — **überträgt aber `assigned_agent_id` weder vom Lead auf die Bestellung noch umgekehrt.**
2. Danach weist `distributeUnassignedOrders` (`server/routes/fiaon-agent.ts:760`) die Bestellung per Round-Robin einem **beliebigen** verteilungsaktiven Agenten zu — oder keinem, wenn die Bestellung keine `payment_reference` hat.
3. Provision entsteht nur über `onCustomerPaid` (`fiaon-agent.ts:505`), und die bricht ab, wenn kein Agent zugewiesen ist.

### Ist das der Juli-Bug?

**Nein — ein zweiter, eigener Bug.** Der Juli-Bug (Dubletten-Attribution) betraf `supersedeSisterOrders` und ist dort repariert (`fiaon-antrag.ts:190` überträgt inzwischen die Zuweisung von Dubletten). Der hier beschriebene Bruch liegt in der **Lead-Konversion** und existiert unabhängig davon.

---

## D3 — Fünf „Bezahlt"-Werte, fünf verschiedene Fragen

Alle fünf Kennzahlen filtern `merged_into IS NULL` (Dubletten zählen NICHT mit) und `payment_status = 'paid'` (dadurch sind `superseded`-Bestellungen automatisch raus, denn das ist ein eigener Status). Kein doppelter Umsatz durch Dubletten: **0 E-Mail-Gruppen mit mehr als einem bezahlten Datensatz.**

| Ansicht | Screenshot | Heute | Exakte Bedingung (zusätzlich zu paid + merged NULL) | Betragsquelle |
|---|---|---|---|---|
| Zahlungszentrale „Bestätigt bezahlt" | 85 (5.465,18 €) | 86 (5.565,17 €) | `payment_reference IS NOT NULL` — nur echte Bestellungen mit Zahlungsreferenz | `SUM(amount_due)` |
| Finanzen Gesamt-Funnel „Bezahlt" (30 T) | 132 | 133 | `created_at` in den letzten 30 Tagen (Anlagedatum!) | zählt nur |
| Finanzen „Umsatz Brutto" (30 T) | 153 (5.565,17 €) | 154 (5.665,16 €) | `COALESCE(completed_at, updated_at)` in den letzten 30 Tagen | `SUM(amount_due×100)` in Cents |
| Finanzen „Bestand (bezahlt) all-time" | 154 | 155 | kein Zeitfilter | zählt nur |
| Leads „Zahlend" | 85 (3.053,52 €) | 90 (3.349,47 €) | nur Bestellungen, die aus einem **konvertierten Lead** entstanden (`converted_order_id`) | `SUM(amount_due)` der Lead-Bestellungen |

*(Quellcode: Zahlungszentrale `fiaon-antrag.ts:450`, Funnel/Umsatz/Bestand `fiaon-finance.ts:59–150`, Leads `fiaon-leads.ts:778`.)*

### Warum die Zahlen auseinanderlaufen — der eine Schlüsselbefund

```sql
SELECT COUNT(*) FILTER (WHERE payment_reference IS NULL),      -- 69
       COUNT(*) FILTER (WHERE amount_due IS NULL OR amount_due = 0)  -- 68
FROM fiaon_applications WHERE payment_status='paid' AND merged_into IS NULL;
```

**69 der 155 bezahlten Datensätze haben keine Zahlungsreferenz, 68 davon nicht einmal einen Betrag.** Das sind Alt-/Import-Kunden (rückwirkend auf „bezahlt" gesetzt, z. B. Access-Backfill). Daraus folgt alles:

- **Zahlungszentrale (86):** blendet die 69 Alt-Datensätze aus → die *kleinste* Zahl.
- **Bestand all-time (155):** zählt sie mit → die *größte* Zahl.
- **Umsatz Brutto (154):** zählt fast alle mit, weil `updated_at` der Alt-Datensätze kürzlich angefasst wurde — **das Anzeigen von „154 bezahlt" neben „5.665 €" ist irreführend, denn 68 der 154 tragen 0 € bei.**
- **Funnel 30 T (133):** anderer Zeit-Anker (`created_at` statt Bezahl-Zeitpunkt).
- **Leads „Zahlend" (90):** andere Grundmenge (nur Lead-Konversionen), daher auch die kleinere Summe.
- 1 bezahlter Datensatz hat zusätzlich `superseded_by` gesetzt (Status trotzdem `paid`) — Randfall, Ursache **unklar**, in Phase 2 prüfen.

### Vorschlag: DIE eine Wahrheit (nur Definition, noch nicht umgesetzt)

> **Bezahlter Kunde** = `payment_status = 'paid' AND merged_into IS NULL AND payment_reference IS NOT NULL`
> **Umsatz** = `SUM(amount_due)` genau dieser Menge, Zeit-Anker = `completed_at` (Bezahl-/Freischalt-Zeitpunkt), niemals `updated_at`.
> Die 69 Alt-Datensätze bekommen eine eigene, ehrlich beschriftete Kennzahl („Alt-Bestand, importiert, ohne Beleg") und fließen **nie** in Umsatz oder Funnel ein.

Begründung: Nur Datensätze mit Zahlungsreferenz haben einen nachvollziehbaren Zahlungsvorgang. `superseded_by IS NULL` ist als zusätzlicher Filter sinnvoll, ändert aktuell aber nur 1 Datensatz.

### LTV/CAC = 96,8× und „Kontaktiert 100 %" — beide unbrauchbar

**Formel im Code** (`fiaon-finance.ts:152–164`): `CAC = Werbebudget ÷ bezahlte Kunden (30 T)` = 690 € ÷ 154 = 4,48 €. `LTV = Ø-Bestellwert × 12 Monate (reine Annahme)` = 36,78 € × 12 = 441 €. Ergebnis ≈ 98× (Screenshot 96,8×).
Unbrauchbar aus drei Gründen: (1) Die 154 enthalten 68 Alt-Kunden mit 0 € — sie drücken den Ø-Wert und blähen die Kundenzahl auf; (2) die 12 Monate Laufzeit sind eine unbelegte Annahme; (3) das Budget (690 €) wird auf ALLE Bezahler verteilt, auch die, die nie über Werbung kamen. **Empfehlung: entfernen oder auf „CAC pro Lead-Konversion" mit echter Laufzeit umstellen.**

**„Kontaktiert"** (`fiaon-finance.ts:72`): `status <> 'neu'` — heute 1.800 von 1.878 (96 %). Der Massen-Mailversand setzt jeden Lead automatisch auf `kontaktiert` (`fiaon-leads.ts:354`). **Eine Massenmail ist kein Kontakt.** Empfehlung: „Kontaktiert" nur bei echtem Agenten-Log (Anruf/Gespräch) zählen oder die Stufe umbenennen in „Angeschrieben".

---

## D4 — Was ist `/admin/database` wirklich?

**Komponente:** `client/src/pages/admin-database.tsx` (Route in `App.tsx:86`), verlinkt in der Haupt-Navigation als „Kunden & Anträge". Die Seite ist ein **Legacy-CEO-Cockpit** mit eigener zweiter Sidebar und persönlicher Begrüßungs-Animation („Guten Morgen, Justin!") — erkennbar ein früherer Produktstand.

| Unterseite | Funktioniert? | Echte FIAON-Daten? | Empfehlung |
|---|---|---|---|
| Übersicht | ja | ja (`/api/fiaon/admin/applications`), aber mit eigener Fremd-Status-Logik | **integrieren** (Kennzahlen in die Hauptansicht) |
| Anträge (4.297) | ja | ja — das ist der echte `AdminApplicationsManager` | **integrieren** (als einzige Kundenansicht) |
| Aufgaben | lädt `/api/todos`, `/api/ceo-mind-os` | nein (CEO-Mind-OS-Produkt) | löschen |
| Command OS | CeoMindOS-Komponente | nein | löschen |
| Live Radar | `/api/ceo-mind-os/morning-briefing` | nein | löschen |
| Wissens-DB | `/api/ceo-mind-os/knowledge` | nein | löschen |
| Umsatz & Stripe | `/api/fiaon/admin/stripe/revenue` | **nein — Stripe ist bei FIAON tot** | löschen |
| Buchhaltung | `/api/admin/accounting/*` | teils — eigene Buchhaltungstabellen, Nutzung **unklar** | mit Betreiber klären |
| Investoren | `/api/admin/investors` | eigenes Investoren-Modul, kein FIAON-Kundenbezug | mit Betreiber klären |
| Kündigungen | ja | ja (FIAON-Kündigungen) | **integrieren** |
| Ausbuchung | AdminLedgerManager | **unklar** | mit Betreiber klären |

### Die 4.297 „Anträge" aufgeschlüsselt (heute: 4.314 sichtbar)

```sql
SELECT COUNT(*) ... FROM fiaon_applications;
```

| Menge | Anzahl |
|---|---|
| Datensätze gesamt (roh) | 4.747 |
| davon als Dublette zusammengeführt (`merged_into` gesetzt, unsichtbar) | 433 |
| **sichtbar in der UI (die „4.297")** | **4.314** |
| davon OHNE E-Mail UND ohne Telefon | **2.597 (60 %)** |
| davon Test-/Junk-Daten (dev.test-Adressen u. ä.) | 31 |
| davon Status `personal_data` = Funnel-Abbrecher auf Schritt 1 | 2.562 |
| **Echte eindeutige Personen** (E-Mail, sonst Telefon, sonst Name+Geburtsdatum) | **≈ 1.502** |

Die „4.297 Anträge" sind also zu 60 % anonyme Funnel-Abbrecher, keine Kunden.

### „467 KYC fehlt", „18 Prüfbereit", „15 Schufa hoch."

Das sind **echte FIAON-Datenfelder** (`bank_statement_pdf`, `id_card_pdf`, `schufa_pdf` in `fiaon_applications`), aber die Zahlen entstehen aus **Frontend-Logik in `admin-database.tsx:187–210`**, nicht aus einem Server-Prozess. Nachgerechnet: „KYC fehlt" = 470 (abgeschlossene/bezahlte Anträge, denen Kontoauszug ODER Ausweis fehlt — überwiegend Alt-Kunden, die nie hochgeladen haben), „Prüfbereit" = 18, „Schufa hochgeladen" = 15. Der Prüf-Workflow dahinter ist praktisch ungenutzt: **alle 4.314 Datensätze stehen auf `schufa_status = 'pending'`**, kein einziger wurde je auf „approved" gesetzt.

---

## D5 — Dubletten-Bestandsaufnahme

Nur sichtbare Datensätze (`merged_into IS NULL`):

| Kriterium | betroffene Gruppen | überzählige Datensätze |
|---|---|---|
| E-Mail (normalisiert) | 2 | 3 |
| Telefon (normalisiert, ≥7 Ziffern) | **296** | **494** |
| Name + Geburtsdatum | 294 | 520 |
| Name + Adresse | 235 | 401 |

**Wichtig:** Die E-Mail-Deduplizierung (Juli-Aufräumaktion, 433 Merges) hat funktioniert — nach E-Mail ist fast nichts mehr doppelt. **Die verbliebenen ~500 Dubletten sieht man nur über Telefon/Name/Adresse**, weil 80 % der Datensätze gar keine E-Mail haben (nur 866 von 4.314 mit E-Mail, aber 1.672 mit Telefon).

- **Top-Fälle nach E-Mail:** nur noch 2 Gruppen (Yuliyan Murov ×3, Maik Möbius ×2 — je 1× bezahlt). Eine Top-20-Liste nach Telefon/Name liefert Phase 2 mit der Erkennungs-Engine.
- **Verlässlichster Identitäts-Anker: normalisiertes Telefon** (am besten befüllt: 1.672 Datensätze; findet die meisten Gruppen: 296), **kombiniert mit E-Mail wo vorhanden**; Name+Geburtsdatum als Bestätigungs-Kriterium (Namens-Schreibweisen variieren, Geburtsdatum ist stabil).
- **Doppelter Umsatz:** Nach E-Mail 0 Fälle. Nach Telefon **3 Personen mit je 2 bezahlten Datensätzen** (Tel. …5575701, …0792395, …5317328) — potenziell doppelt gezählter Umsatz, in Phase 2 einzeln prüfen.

### Warum entstehen Dubletten? (Code-Pfad)

`POST /application` (`server/routes/fiaon-antrag.ts:1288`, Upsert ab Zeile 1388): Der Antrag wird ausschließlich über die **vom Browser generierte `ref`** gesucht und aktualisiert. **Es gibt keinerlei Prüfung, ob E-Mail oder Telefon schon existieren.** Neues Gerät, neuer Browser, gelöschte Cookies, zweiter Anlauf Wochen später → neue `ref` → neuer Datensatz. Solange das so bleibt, wachsen die Dubletten täglich nach (Präventions-Fix ist in Phase 2 eingeplant).

---

## D6 — Zahlungsreferenz / Kontoabgleich

### Bestandsaufnahme `fiaon_bank_txns`

| match_status | Anzahl | Summe | verbucht |
|---|---|---|---|
| unmatched | **66** | 4.359,14 € | 0 |
| manual | 2 | 15,98 € | 2 |
| **automatisch gematcht** | **0** | — | — |

**97 % (66 von 68) der importierten Bankeingänge sind unzugeordnet, Auto-Match-Quote: 0 %.**

### Warum? Der Code prüft gegen das falsche Feld (bestätigter Befund)

`findApp` (`server/routes/fiaon-reconcile.ts:66`) vergleicht die aus dem Verwendungszweck extrahierte Referenz **nur mit `ref`** (langes Format `FIAON-XXXXXXXX-XXXX`). Kunden überweisen aber mit der **`payment_reference`** (kurzes Format `FIAON-XXXXXX` — die Referenz von QR-Code und Zahlungsseite). Die beiden können nie übereinstimmen.

**Beweis aus der DB:** 58 der 66 unzugeordneten Eingänge haben eine sauber erkannte Referenz (`extracted_ref`), und **50 davon würden sofort matchen**, wenn zusätzlich gegen `payment_reference` geprüft würde:

```sql
SELECT COUNT(*) FROM fiaon_bank_txns t
JOIN fiaon_applications a ON a.payment_reference = t.extracted_ref
WHERE t.match_status = 'unmatched';   -- 50
```

### 10 reale Verwendungszwecke (unzugeordnet)

| Einzahler | Verwendungszweck | erkannte Referenz | Betrag |
|---|---|---|---|
| MATTHIAS RAUBERG | `Gesendet mit N26FIAON-N7QJW2` | FIAON-N7QJW2 | 79,99 € |
| MARCO HEUERMANN | `Fiaon-EFXJG5` | FIAON-EFXJG5 | 59,99 € |
| Melanie Fetkenheuer | `FIAON-NHQD24 Melanie Fetkenheuer` | FIAON-NHQD24 | 59,99 € |
| TOMISLAV FILIPOVIC | `FIAON-4X53G9` | FIAON-4X53G9 | 79,99 € |
| Dirk Gerritsen | `AE:FiAON-DCDBM 9` | FIAON-DCDBM9 | 59,99 € |
| MAX SIGL | `FIAON 6AS4A5/WUIBCB-…` | FIAON-6AS4A5 | 79,99 € |
| Aileen Bohlscheid | `FIAON-V25SU5` | FIAON-V25SU5 | 99,99 € |
| Sepehr Mohammadalipour | `Einzahlung von … mit Referenz ` (leer) | — | 7,99 € |
| Katharina Graf | `FIAON-S2A9FS` | FIAON-S2A9FS | 59,99 € |
| Jason Sattler | `FIAON-6PBKDM` | FIAON-6PBKDM | 7,99 € |

Auffällig: Die Kunden geben die Referenz überwiegend **korrekt** an — das Ticket „Kunde hat falsche Zahlungsreferenz angegeben" ist in Wahrheit meist „System prüft gegen das falsche Feld".

### Vorschlag Auto-Abgleich (ausgearbeitet, NICHT gebaut)

Stufenweise, jede Stufe nur wenn die vorige nichts fand:
1. **Referenz exakt** gegen `payment_reference` UND `ref` (normalisiert, Leer-/Sonderzeichen raus) → allein damit heute 50/66 = **76 %**.
2. **Einzahlername (fuzzy: Nachname enthalten) + exakter Betrag** → weitere Treffer; heute erfüllen 51/66 dieses Kriterium (überlappt mit Stufe 1). Nur als „Vorschlag zur Bestätigung" anzeigen, nie automatisch verbuchen.
3. Rest bleibt manuell (leere Referenzen, Sammelüberweisungen).

**Geschätzte Trefferquote: Stufe 1 automatisch ~75–80 %, mit Stufe 2 als bestätigtem Vorschlag ~90 %.** Der manuelle Weg des Betreibers (Zahlungszentrale → „bezahlt", Provision bucht) bleibt unberührt.

---

## SOFORT-FIXES

### Fix 1 — `max_lead_followups` 100 → 6

**Befund bestätigt:** DB-Setting `max_lead_followups = '100'` (`fiaon_settings`), Code-Default ist 6 (`fiaon-agent.ts:315`). Die 100 war nie gewollt: Die Tot-Markierung (`markExhaustedLeadsDead`, `fiaon-leads.ts:387`) greift erst ab 100 Nachfässen, und der Bulk-Versand „alle offenen" (`claimAllOpenBatch`, `fiaon-leads.ts:1386`) schreibt jeden Lead unterhalb dieser Grenze an.
**Schadensausmaß (Glück gehabt):** Maximal erreichte `lead_reminder_count` ist **2**; 0 Leads über 6, 0 über 10. Die Grenze hat noch keinen Deliverability-Schaden angerichtet — sie hätte es aber ab Woche 3 getan.
**Maßnahme:** DB-Setting per einmaligem `UPDATE fiaon_settings SET value='6' WHERE key='max_lead_followups'` korrigieren (einzige Schreiboperation dieser Phase, siehe unten). Code-Default ist bereits konsistent.

### Fix 2 — „Heute versendet: 1621"

**Der Zähler ist korrekt — kein Bug, keine Code-Änderung nötig.** Die Abfrage (`fiaon-leads.ts:1194`) zählt `fiaon_lead_log`-Einträge vom heutigen Berlin-Tag. Gegenprobe aus der DB: 15.07. = **1.621**, 14.07. = 1.181, all-time = 2.802. Die 1.621 Mails wurden heute wirklich versendet (Bulk-Lauf „alle offenen" ab 09:06 Uhr). Der Zähler war der Überbringer der schlechten Nachricht, nicht die schlechte Nachricht — die Ursache ist Fix 1.

---

## Anhang: Reproduzierbarkeit

- Alle Zahlen: `npx tsx scripts/diagnose-phase1.ts` (nur SELECT; Rohausgabe in `/tmp/diagnose.txt`).
- Code-Belege: Datei + Zeilennummer jeweils direkt bei der Aussage.
- Als „unklar" markiert (nicht geraten): Frontend-Sicht von Agent #8 (D1.4), Nutzung Buchhaltung/Investoren/Ausbuchung (D4), Ursache des einen `paid`+`superseded_by`-Datensatzes (D3).

---
---

# PHASE 2 — GELD & VERTRAUEN (umgesetzt am 15.07.2026)

Diese Phase behebt die drei Befunde aus Phase 1, die direkt Geld kosten. **Stichtag: Die neue Provisions-Logik gilt nur für Zahlungen AB Deploy. Bereits gebuchte Provisionen bleiben unangetastet — kein Clawback.**

## P2-A — Kontoabgleich repariert (war: 0 % Auto-Match)

**Was war kaputt:** Der Auto-Match prüfte die aus dem Verwendungszweck erkannte Referenz nur gegen die lange Bestell-ref — Kunden überweisen aber mit der kurzen `payment_reference` von QR-Code und Zahlungsseite. Ergebnis: 0 von 66 automatisch zugeordnet.

**Was jetzt gilt** (`server/routes/fiaon-reconcile.ts`):

- **Match gegen BEIDE Felder** (`payment_reference` kurz + `ref` lang), unabhängig von Groß-/Kleinschreibung, Leerzeichen, Bindestrichen und mit/ohne FIAON-Präfix. Angehängter Junk („FIAON 6AS4A5/WUIBCB…") stört nicht mehr.
- **Button „Offene neu abgleichen"** in `/admin/kontoabgleich`: prüft alle 66 offenen Alt-Eingänge mit dem reparierten Matcher — **ordnet nur zu, verbucht nichts** (erwartet: ~50 sofort zugeordnet).
- **Fuzzy-Vorschläge** im Zuordnen-Dialog: Einzahlername + Betrag, mit Konfidenz („hoch" = Name + exakter Betrag). **Nie automatische Verbuchung** — der Admin bestätigt per Klick.
- **Betragsabweichung** bleibt Abweichung: wird markiert und im Audit protokolliert, nie stillschweigend übernommen.
- **Verbuchen ist jetzt IDENTISCH zum „bezahlt"-Button:** Freischaltung + Dubletten-Stopp + `payment_confirmed`-Mail (genau 1×) + Provisionshook. Vorher setzte der Kontoabgleich bewusst KEINE Provision — das erzeugte einen Teil der „bezahlt ohne Provision"-Altfälle.
- Der **manuelle Weg des Betreibers** (Zahlungszentrale → „bezahlt") ist unverändert.

## P2-B — Provision wird verdient, nicht verlost

**Was war kaputt:** Lead-Konversion übertrug keinen Agenten; danach verloste ein Round-Robin die Bestellung an irgendeinen Agenten — der bekam Provision, ohne je telefoniert zu haben (Fall Dereli: 16 € + 4 € Override per Los).

**Was jetzt gilt:**

- **Attribution folgt der Betreuung** (`fiaon-leads.ts`, `convertLeadsForContact`): Bei Lead→Kunde-Konversion wird der betreuende Lead-Agent auf die Bestellung übertragen (nie überschreibend). Leads ohne Agent erben umgekehrt den Bestell-Agenten — die „Agent —"-Zeilen wachsen nicht mehr nach.
- **Round-Robin für Bestellungen ist ABGESCHALTET** (`fiaon-agent.ts`, `distributeUnassignedOrders`). Round-Robin verteilt weiterhin nur **Leads zur Bearbeitung**. Sichtbarkeit leidet nicht: offene Bestellungen sieht weiterhin jeder Agent.
- **Provisions-Anspruch nur bei dokumentierter Betreuung** (`fiaon-agent.ts`, `onCustomerPaid`): Bei Zahlung sucht das System den **letzten dokumentierten Agenten-Kontakt vor der Zahlung** (Kontakt-Ergebnis oder Kundenmail — aus Kunden-Log UND Lead-Log). Gibt es keinen → **„Direktzahler", keine Provision**, klar gekennzeichnet.
- **Transparenz statt Blackbox:** Am Kunden steht sichtbar, warum es Provision gab oder nicht (`commission_basis` + Klartext-Begründung, Badge im Kunden-Detail des Agent-Portals, Audit-Eintrag im Verlauf).
- **Altfälle** (56 bezahlt ohne Agent / 64 ohne Provision): erscheinen im **Nachbuchungs-Center** (`/admin/nachbuchung`) — jetzt auch die Fälle OHNE Agent, mit **Vorschlag aus der dokumentierten Betreuung**. Buchung nur einzeln nach Bestätigung des Betreibers (Admin-Entscheid, protokolliert). Die Sammelbuchung überspringt Vorschlags-Fälle bewusst.

### Grenzfall-Definitionen (verbindlich)

| Fall | Entscheidung |
|---|---|
| Lead war zugewiesen, Agent hat ihn nie geöffnet/kontaktiert, Kunde zahlt selbst | **Kein Anspruch** — Direktzahler |
| Agent hat kontaktiert (dokumentiertes Ergebnis), Kunde zahlt Tage später von selbst | **Anspruch** — das ist Verkauf |
| Mehrere Agenten hatten dokumentierten Kontakt | **Letzter dokumentierter Kontakt vor Zahlung gewinnt** |
| Nur Notiz geschrieben oder nur Akte geöffnet, kein Kontakt-Ergebnis | **Kein Anspruch** — Notiz/Öffnen ist keine Betreuung |
| Zweifel / Sonderfall | **Admin entscheidet** im Nachbuchungs-Center bzw. per manueller Buchung (wird als „Admin-Entscheid" protokolliert) |

## P2-C — Arbeitswarteschlange statt Lead-Friedhof

**Was war kaputt:** 826 Zeilen mit offenen Kontaktdaten sind keine Arbeitsliste — Rosinenpicken möglich, keine Abarbeitung, kein Betreuungs-Nachweis.

**Was jetzt gilt** (`fiaon-leads.ts` + `client/src/pages/agent/leads.tsx`):

- **Gesperrte Ansicht:** Der Agent sieht seine Warteschlange, aber Kontaktdaten sind **verdeckt** (nur Quelle, Kampagne, Alter, Status, „Telefon vorhanden"). Begründung im UI: *„Alle Leads werden gleich behandelt — so wird niemand übersprungen."* Auch die API liefert vor der Übernahme keine Kontaktdaten (serverseitig maskiert, nicht nur versteckt).
- **„Akte öffnen"** mit Bestätigungs-Dialog (mobil als Bottom-Sheet): Kontaktdaten werden sichtbar, Übernahme wird protokolliert (Zeitpunkt + Agent, Audit-Log). **Nur EINE offene Akte gleichzeitig** — die nächste erst nach dokumentiertem Kontakt-Ergebnis (Server erzwingt das, HTTP 409). Das Öffnen allein erzeugt KEINEN Provisions-Anspruch.
- **Reihenfolge per Server-Algorithmus**, Gewichte im Admin einstellbar (Leads-Seite → „Arbeitswarteschlange der Agenten"): Frische, Umsatzpotenzial (Business-Kampagnen), Reaktionssignal (fälliger Rückruf-Termin), Kontakthistorie. **Fairness:** jeder N-te Slot (Standard: 4.) kommt aus dem ältesten Bestand. Der Agent sieht die Gewichtung bewusst nicht.
- **Rückgabe mit Wiedervorlage:** „Nicht erreicht"/„Mailbox" → +4 h, „Nummer falsch" → +24 h, Rückruf-Termin → Wiedervorlage zum Termin. Historie bleibt vollständig — **kein Lead wird je deaktiviert oder entfernt.**

## P2-D — Eine Wahrheit für alle Zahlen

- **Zentrale Definition** in `server/lib/fiaon-truth.ts` (eine Quelle, kein Copy-Paste-SQL): *bezahlt = `payment_status='paid'` + keine Dublette + Zahlungsreferenz vorhanden; Umsatz = Summe der Beträge; Zeit-Anker = Bezahl-Zeitpunkt, nie `updated_at`.*
- **Alle Ansichten nutzen sie:** Zahlungszentrale, Finanzen & Sales (Funnel, Umsatz, Zeitreihen, Team, CSV-Export), Leads („Zahlend"), Dashboard („Heute bezahlt"), Agent-Portal (Ø-Werte). „Bezahlt" zeigt damit überall dieselbe Zahl.
- **Alt-Import getrennt ausgewiesen:** eigene Infozeile in Finanzen („69 Alt-Kunden ohne Referenz, 68 ohne Betrag — fließen in KEINE Kennzahl ein"). Ehrlichkeit schlägt schöne Zahlen.
- **LTV/CAC ehrlich:** heißt jetzt „LTV/CAC (Annahme)", weist die 12-Monats-Annahme offen aus und rechnet nur noch über echte, referenzierte Zahlungen (die 68 Null-Beträge verzerren den Ø-Wert nicht mehr).
- **„Kontaktiert" ehrlich:** Die Funnel-Stufe heißt jetzt **„Angeschrieben (Mail)"** (Massenmail ist kein Kontakt); zusätzlich zeigt der Funnel **„Echt kontaktiert"** = dokumentierte Agenten-Ergebnisse.
- **Tooltips:** Jede Kennzahl in Finanzen trägt ein ⓘ mit Klartext-Definition (zentral aus `fiaon-truth.ts`).
- **Testpflicht/Selbstcheck:** `GET /api/fiaon/admin/truth-check` rechnet „bezahlt" mit der Definition jeder Ansicht nach und meldet `identical: true/false` — weicht je eine Ansicht ab, ist ein Copy-Paste-SQL zurückgekommen. Die 3 Telefon-Doppelzahler aus D5 bleiben markiert für die Zusammenführung in Phase 3 (kein Merge in dieser Phase).

## Verifikation nach Deploy (Reihenfolge für den Betreiber)

1. `/admin/kontoabgleich` → **„Offene neu abgleichen"** klicken → erwartet ~50 von 66 zugeordnet. Dann prüfen und verbuchen (bucht identisch zum „bezahlt"-Button).
2. `GET /api/fiaon/admin/truth-check` aufrufen → `identical: true`; Zahl mit Zahlungszentrale und Finanzen „Bestand" vergleichen (Screenshot als Beweis).
3. `/admin/nachbuchung` → Altfälle mit „Vorschlag — bestätigen" einzeln entscheiden.
4. Agent-Portal → Leads: Warteschlange verdeckt, „Akte öffnen" mit Bestätigung, zweite Akte wird verweigert, bis ein Ergebnis dokumentiert ist.
5. Testkunde ohne Agenten-Kontakt auf „bezahlt" setzen → Badge „Direktzahler — keine Provision" im Kunden-Detail, keine Provisionszeile.

---
---

# PHASE 2B — VERIFIKATION & SCHARFSTELLUNG (15.07.2026)

Keine neuen Features — Absicherung der Geldlogik vor dem Livegang. Alle Zahlen aus der Produktions-DB (`scripts/diagnose-phase2b.ts`, nur lesend).

## V1 — Stichtag-Regel: Befund und Fix

**Klare Antwort: Ein Stichtag war NICHT implementiert.** Die Phase-2-Fassung von `onCustomerPaid` hätte die neue Regel („Betreuung dokumentiert") sofort auf ALLE Bestellungen angewendet — auch auf solche, bei denen der Agent nach altem Modell Anspruch gehabt hätte.

**Konkrete Auswirkung (gezählt, Stand 15.07.2026):** Von 173 offenen/angekündigten Bestellungen mit zugewiesenem Agent haben **35 kein dokumentiertes Kontakt-Ergebnis** — diese Agenten wären bei Zahlung nach Deploy leer ausgegangen:

| Agent | betroffene Bestellungen |
|---|---|
| Daniel Stripling | 22 |
| Florentine Lombardi | 12 |
| Justin Schwarzott | 1 |

**Fix (umgesetzt in `fiaon-agent.ts`, `onCustomerPaid`):**
- Setting `commission_cutoff_at`. Bestellung **vor Stichtag erstellt + Agent zugewiesen → Altmodell** (Zuweisung genügt, `commission_basis='altmodell'` mit Klartext-Begründung).
- **Leerer Stichtag = Altmodell für alle** (neue Regel noch nicht scharf) — sicherer Default.
- Ab Stichtag: Anspruch nur bei dokumentierter Betreuung (letzter Kontakt vor Zahlung).
- Stichtag im Admin **sichtbar** (Leads → Einstellungen, nur Anzeige), Setzen ausschließlich einmalig per `scripts/phase2b-scharfstellen.ts` (bricht ab, wenn bereits gesetzt — kein rückwirkender Regelwechsel möglich).
- Bereits gebuchte Provisionen werden von keinem Code-Pfad angefasst (Idempotenz-Guard blieb unverändert). **Kein Clawback.**

## V2 — Akte-Deadlock verhindert

- **Auto-Release:** offene Akte ohne Ergebnis wird nach X Min. freigegeben (Setting `akte_auto_release_min`, Default 30, 0 = nie; lazy bei jedem Queue-Abruf, kein Cron). Freigabe wird im Lead-Log protokolliert.
- **Selbst freigeben:** `POST /agent/leads/:id/close-akte` + Button im Akten-Dialog („Akte schließen ohne Ergebnis"), Begründung Pflicht, Audit-Log, zählt NICHT als Kontakt.
- **Admin-Notausgang:** `POST /admin/leads/:id/release-akte` + Button im Admin-Lead-Drawer („Akte offen seit … bei X → Akte freigeben").
- **Leads ohne Kontaktdaten:** Queue, Total-Zähler und „Akte öffnen" filtern Leads ohne Telefon UND E-Mail hart aus. Ist-Zustand Prod: **0 von 1.673 offenen Leads** betroffen (1.561 nur E-Mail, 112 mit Telefon) — der Schutz greift ab jetzt präventiv.

## V3 — Grenzfälle: Soll vs. Ist

| # | Fall | Soll | Ist (nach Phase 2B) |
|---|---|---|---|
| 1 | Ergebnis „Erreicht – zahlt gleich", Zahlung 3 Tage später | Anspruch | ✅ `result`-Eintrag zählt, Zeitabstand egal |
| 2 | Akte übernommen, nichts dokumentiert, Kunde zahlt | kein Anspruch | ✅ Übernahme loggt `claim` — zählt bewusst nicht |
| 3 | Lead zahlt sofort, nie zugewiesen | Direktzahler | ✅ keine Kontakte → Direktzahler (gilt auch vor Stichtag, da kein Alt-Anspruch existierte) |
| 4 | Zwei Agenten hatten Kontakt | letzter gewinnt | ✅ `ORDER BY created_at DESC LIMIT 1` |
| 5 | Agent versendet nur Antrags-/Zahlungslink | Anspruch (Verkaufsarbeit) | ✅ war bereits konform: Link-Versand loggt `email_sent` MIT agent_id (301 solcher Einträge in Prod). Admin-Versand (agent_id NULL) zählt korrekt nicht |
| 6 | Dublette — Schwester-Bestellung wird bezahlt | Attribution greift | ⚠️→✅ **Abweichung gefunden und gefixt:** Kontaktsuche lief nur auf der exakten ref. Jetzt zählt die ganze Bestell-Familie (gleiche E-Mail + `merged_into`). E2E-Test T6 bestätigt den Fix |

**Abweichungen von den Vorgaben (ehrliche Liste):** (a) Stichtag fehlte komplett → V1-Fix. (b) Dubletten-Attribution fehlte → V3.6-Fix. (c) Reine **Telefon**-Dubletten (3 Fälle aus D5) sind weiterhin nicht abgedeckt — bewusst verschoben auf die Zusammenführung in Phase 3.

## V4 — Produktive Verifikation

**Rematch (Dry-Run gegen Prod, echte Zahlen):** `scripts/phase2b-rematch.ts` (identischer Code-Pfad wie der UI-Button) prüfte alle **66** offenen Bank-Eingänge:
- **50 zuordenbar** (davon 2 mit Betrags-Abweichung — werden markiert, nicht übernommen) → Erwartung „~50" exakt getroffen.
- 8 ohne erkennbare Referenz (z. B. „Einzahlung von … mit Referenz ", „Test transaction", „INV-…").
- 8 mit FIAON-Referenz, zu der KEIN Antrag existiert (z. B. FIAON-YMPWJN, FIAON-NEYGNZ…) — Kunden haben vermutlich Tippfehler überwiesen; bleiben für manuelle Zuordnung per Fuzzy-Vorschlag.

**E2E-Test:** `scripts/phase2b-e2e.ts` testet am echten Code-Pfad (applyTxn → supersede → Mail-Claim → onCustomerPaid) mit klar markierten Testdaten (`*@fiaon-systemtest.invalid`): Freischaltung, Dubletten-Stopp, Mail genau 1× (Claim-Feld), Idempotenz, Direktzahler ohne Provision, Betreut-Buchung 14,85 € an inaktiven Testagenten, Dubletten-Attribution (T6). Aufräumen: `--cleanup`.

**Wichtig zur Reihenfolge (Prod läuft noch auf Vor-Phase-2-Code — `opened_at` existiert dort noch nicht):**
1. **Deploy** (git push → Render; Schema migriert sich beim Boot selbst via `ADD COLUMN IF NOT EXISTS`).
2. `npx tsx scripts/phase2b-scharfstellen.ts --write` → Stichtag = Deploy-Zeitpunkt (schützt die 35 Bestellungen).
3. `npx tsx scripts/phase2b-rematch.ts --write` oder UI-Button → 50 Eingänge zuordnen (verbucht nichts).
4. `npx tsx scripts/phase2b-e2e.ts` → 12 Assertions grün, dann `--cleanup`.
5. `GET /api/fiaon/admin/truth-check` → `identical: true` mit echten Zahlen dokumentieren.

Das Rematch-Ergebnis darf NICHT vor dem Deploy verbucht werden — der alte, noch deployte `applyTxn`-Code kennt weder Mail-Parität noch Provisionsprüfung.

### DURCHGEFÜHRT am 15.07.2026, 17:40 Uhr (echte Ergebnisse)

1. **Deploy:** Commit `0705a5b` auf `main` gepusht → Render-Build ausgelöst (Schema migriert beim Boot).
2. **Stichtag gesetzt:** `commission_cutoff_at = 2026-07-15T15:40:26Z`. Zum Zeitpunkt des Setzens: **28 offene Bestellungen** durch das Altmodell geschützt (Zahl war zwischenzeitlich von 35 auf 28 gesunken — laufender Betrieb). Skript verweigert jedes erneute Setzen.
3. **Rematch (write):** **50 von 66** offenen Bank-Eingängen zugeordnet (2 davon mit markierter Betrags-Abweichung), 8 ohne erkennbare Referenz, 8 mit Referenz ohne Antrag. **Nichts verbucht** — Verbuchen ist der bewusste nächste Admin-Schritt im Kontoabgleich.
4. **E2E-Test: 12 PASS, 0 FAIL** — Freischaltung ✓, Direktzahler ohne Provision ✓, Dubletten-Stopp ✓, Mail-Claim genau 1× ✓, Idempotenz ✓, Betreut-Buchung 14,85 € ✓, Dubletten-Attribution (T6) ✓. Hinweis: `MAKE_WEBHOOK_URL` liegt lokal nicht vor — der Mail-1×-Mechanismus wurde über das Claim-Feld verifiziert; der tatsächliche Versand läuft nur auf dem Server. Testdaten vollständig entfernt (4 Anträge, 2 Bank-Txns, 1 Provision, 9 Log-Einträge, 1 Testagent).
5. **Eine Wahrheit (Prod, 15.07.2026):** bezahlt = **90 Kunden**, Umsatz = **5.919,14 €**; Alt-Bestand separat = **69** (68 ohne Betrag). Der Betreiber verifiziert nach dem Render-Build `GET /api/fiaon/admin/truth-check` → muss `identical: true` und dieselben 90 zeigen.

**Offen für den Betreiber:** die 50 zugeordneten Eingänge im Kontoabgleich prüfen und verbuchen; die 8+8 Rest-Fälle manuell zuordnen oder ignorieren.

## V5 — Changelog

`CHANGELOG.md` angelegt (Phase 2 + 2B in Klartext). Regel ab jetzt: **jede Änderung bekommt einen Eintrag im selben Commit.** Die Admin-Seite dafür folgt in Phase 4.

---
---

# PHASE 4 — ADMIN-UX, HINWEISE & ARBEITSBERICHTE (15.07.2026)

Reine UX/Navigation/Erklärung/Berichte — **keine Geschäftslogik geändert.**

## P4-A — Hinweis-Badges

- `GET /admin/hub/badges` (`fiaon-admin-hub.ts`): EIN Endpoint, alle Zähler serverseitig aggregiert, **60-s-In-Memory-Cache** (nur ein kleines JSON — 512-MB-tauglich). Frontend pollt alle 60 s (AdminShell), kein Realtime-Stack.
- Badges (monochrome Pill, verschwindet bei 0): Zahlungszentrale (angekündigt), Kontoabgleich (unzugeordnet), Auszahlungen (angefordert), Dubletten (offene Gruppen), Nachbuchung (bezahlt ohne Provision, ohne Direktzahler), Agent-Feedback (offen).

## P4-B — Dashboard zum Arbeiten (`/admin`)

- **„Was ist zu tun?"** oben: bis zu 7 Aufgabenzeilen mit direkter Aktion (öffnen/abgleichen/verbuchen/prüfen/nachbuchen/zusammenführen/ansehen) — nur sichtbar bei > 0.
- **Warn-Kacheln** nur bei echten Problemen, jeweils mit Erklärung + Lösung: „Seit X Stunden kein Lead-Eingang" (≥ 24 h; hätte den Make-Ausfall sofort gezeigt), „Nachfass-Automatik pausiert", „blockierte Akte bei Agent X".
- **Schnellsuche prominent** (Name/E-Mail/Telefon/Referenz → Kunde) zusätzlich zu ⌘K; Kennzahlen klickbar mit ⓘ-Definition.

## P4-C — Arbeitsberichte (`/admin/leistung` + Spiegel `/agent/leistung`)

- Backend `server/routes/fiaon-leistung.ts` (hinter `blockAgentsFromAdmin` für den Admin-Teil): pro Agent Akten, Kontakte (Leads+Kunden), Ergebnisse nach Typ, Antragslinks, Konversionen, Abschlüsse (eine Wahrheit), Umsatz, Provision, Reaktionszeit, Rückgabequote, Direktzahler-Anteil; Team-Zeitverlauf + Quellen-Konversion. Zeitraumfilter Heute/7/30/Custom.
- **Rechtlicher Rahmen eingehalten:** ausschließlich Arbeitsergebnisse aus selbst erzeugten Logs; keinerlei Arbeitszeit-/Pausen-/Anwesenheits-/Inaktivitäts-Erfassung; Hinweis-Text auf beiden Seiten; **Spiegelansicht** für jeden Agenten (Agent-Portal → Mehr → „Meine Leistung", mit anonymem Team-Durchschnitt).
- **KI-Zusammenfassung:** Provider-Wahl per Env-Prüfung — **Gemini Flash zuerst** (Key liegt im Server-Env, günstigste Option), Fallback **gpt-4o-mini** (OPENAI_API_KEY liegt ebenfalls vor). Nur aggregierte, **anonymisierte** Kennzahlen (Agent A/B/…, keine Kunden-/Kontaktdaten). Ergebnis kopierbar + als letzte Zusammenfassung gespeichert; KI-Ausfall → verständliche Meldung, Zahlen bleiben sichtbar.
- **Smoke-Test gegen Prod (30 Tage, echt):** 301 Links, 72 Konversionen, 50 Abschlüsse, 3.543,52 € Umsatz, 940,70 € Provision; Quellen: import 1.736 Leads → 51 zahlend, facebook_lead_ads 139 → 4 (`scripts/smoke-leistung.ts`).

## P4-D — Jede Seite erklärt sich selbst

- Gemeinsames Muster `client/src/components/admin/PageHelp.tsx`: `PageIntro` (Titel + Du-Untertitel + einklappbares „Wie funktioniert diese Seite?", Erstbesuch offen, localStorage-Merker pro Seite) und `Tip` (ⓘ-Klartext).
- Ausgerollt auf: Dashboard, Zahlungszentrale (inkl. Auszahlungen/Dubletten-Schritte), Finanzen & Sales, Verbuchungen, Kontoabgleich, Rechnungen, Kunden & Anträge, Team-Übersicht, Leistung, Nachbuchung, Agent-Updates & Feedback, E-Mail-Events, Audit-Log, Changelog. Leads war bereits das Vorbild.

## P4-E — Navigation & Design (Routen-Audit)

| Route | im Menü? |
|---|---|
| /admin, /admin/zahlungen, /admin/kontoabgleich, /admin/verbuchungen, /admin/finanzen, /admin/rechnungen, /admin/database, /admin/leads, /admin/team, /admin/nachbuchung, /admin/einstellungen, /admin/events, /admin/audit, /admin/recht | ✓ (bestand) |
| /admin/leistung, /admin/changelog | ✓ (neu, mit Route) |
| Auszahlungen, Dubletten | ✓ (neu verlinkt — Sektionen der Zahlungszentrale, mit Anker-Scroll) |
| Karteileichen | keine (admin-leads-import ist Dialog-Komponente, keine Route) |

- **Doppelung aufgelöst:** „Agent-Updates" und „Agent-Feedback" zeigten dieselbe Seite → ein Menüpunkt „Agent-Updates & Feedback".
- **/admin/agent-portal aufs CI gebracht:** Standard-Container/Abstände + PageIntro (fiel vorher aus dem Rahmen).
- Aktive Seite: Sidebar-Highlight + Breadcrumb (bestand, AdminShell).

## P4-F — Changelog als Seite

- `/admin/changelog` („Was ist neu?") liest `CHANGELOG.md` über `GET /admin/changelog` und rendert Klartext-Karten. Rückwirkend befüllt (Pakete E–EF, Phasen 1–4) aus Git-Historie und den Doku-Dateien.

## Ehrliche Abweichungen / offene Punkte (Phase 4)

1. **Reaktionszeit-Anker:** Der Lead-**Zuweisungs**-Zeitpunkt wurde historisch nie gespeichert. Die Kennzahl misst deshalb ehrlich „Lead-**Eingang** → erster dokumentierter Kontakt" und ist im UI exakt so beschriftet (Tooltip erklärt den Grund). Ein `assigned_at`-Feld wäre eine Logik-Änderung und war in dieser Phase untersagt.
2. **Vorher/Nachher-Screenshots:** nicht erstellt (kein laufender Browser-Lauf in dieser Sitzung); die Änderungen sind stattdessen im Changelog und hier beschrieben. Kann nach dem Deploy nachgeholt werden.
3. Die vorbestehenden TypeScript-Fehler in `server/routes.ts` / ARAS-AI-Komponenten (fremder Teil des Monorepos) wurden bewusst nicht angefasst; alle FIAON-Dateien sind fehlerfrei, `vite build` + Server-Bundle laufen durch.

---
---

# PHASE 5 — SYSTEM-DIAGNOSE „WAS KLEMMT GERADE?" (15.07.2026)

Neue Betreiber-Ansicht `/admin/diagnose`. **Keine Geschäftslogik geändert** — es
wurden nur non-blocking Log-Aufrufe an bestehenden Fehlerstellen ergänzt sowie
eine neue, rein additive Diagnose-Schicht gebaut.

## P5-A — Was die Seite ist

Primär eine **strukturierte Ereignis-/Problem-Konsole** (Tab „Konsole"): jedes
Ereignis mit Schweregrad, Kategorie, Zeit, Klartext-Bedeutung, Lösungshinweis
und — wo möglich — Direktlink/Aktion. Der Roh-Log ist ein **sekundärer Tab**
(„Rohdaten") für die Tiefenanalyse, keine 1:1-Terminalspiegelung als Hauptansicht.

## P5-B — Sicherheit & DSGVO (Kern)

- **Nur Admin.** Router liegt hinter `blockAgentsFromAdmin` (in `routes.ts` davor gemountet) → Agenten erhalten 403.
- **Maskierung SERVERSEITIG vor Speicherung & Auslieferung** (`server/lib/fiaon-diagnostics.ts`, `maskSensitive`): Connection-Strings mit Zugangsdaten, GitHub-PAT (`ghp_/github_pat_`), `sk-/pk-/rk-`-Keys, Google-`AIza`-Keys, `Bearer/Basic`-Header, JWT, benannte Secret-Env (`DATABASE_URL`, `*_API_KEY`, `*_SECRET`, `*_TOKEN`, `PASSWORD` …), IBAN (`DE** **** **52`), E-Mail (`ma***@gmail.com`), Telefon (`+49 *** *** **52`). Der reale Vorfall (PAT im Klartext in der Git-Remote-URL) ist als expliziter Testfall abgedeckt.
- **Aufbewahrung 7 Tage** (`RETENTION_DAYS`) + Löschfunktion (`POST /admin/diagnose/purge`). Kein unbegrenztes Archiv mit Kundendaten.

## P5-C — Was erfasst wird (Kategorien × Schweregrad)

- `email_make` — Make-Webhook-Fehler (HTTP-Status ≥ 500 = kritisch, sonst Warnung) und Nicht-Erreichbarkeit; instrumentiert direkt in `server/make-webhook.ts` (non-blocking, ändert Rückgabe/Flow nicht). Deckt „E-Mail geht nicht" ab.
- `lead` — abgelehnte/ungültige Intakes (im bestehenden Funnel `logIntake`), plus synthetisch „seit X h kein Lead-Eingang" (hätte den Make-Ausfall sofort gezeigt) und „Nachfass pausiert".
- `zahlung` — synthetisch aus den Geschäftstabellen: nicht zugeordnete Bank-Eingänge, Betragsabweichungen, bezahlt ohne Provision, Dubletten-Gruppen.
- `agent` — blockierte Akte (mit „Akte freigeben"-Aktion).
- `system` — unbehandelte Exceptions/Rejections (Prozess-Handler, additiv).
- `kunde` — vorgesehen; wird gespeist, sobald Antrags-/Upload-Fehlerstellen `logDiagnostic` aufrufen (Erweiterungspunkt, keine Logikänderung nötig).

Struktur: **persistierte** Ereignisse (Tabelle `fiaon_diagnostics`, maskiert) +
**synthetische** Live-Signale (bei jeder Abfrage aus den Geschäftstabellen
abgeleitet — dieselben Signale wie die Dashboard-Warn-Kacheln = „eine Wahrheit").

## P5-D — Die Seite (`client/src/pages/admin-diagnose.tsx`)

- Live per **Polling alle 8 s** (kein WebSocket/Realtime-Stack).
- Filter: Schweregrad · Kategorie · Zeitraum (1 h/24 h/7 d) · Freitext. Standard: kritisch + Warnung, 24 h.
- **Aggregation** nach Fingerprint (normalisiert: Zahlen/Refs/UUIDs raus) → „N×", aufklappbar mit „zuerst/zuletzt".
- Klartext + Link je Eintrag; **Direktaktionen**: „Akte freigeben" (`POST /admin/leads/:id/release-akte`), „Event erneut senden" (→ `/admin/events?ref=`).
- **Verknüpfung P4-B:** kritische Ereignisse (24 h, distinct Fingerprint) fließen in `computeBadges` → Nav-Badge `diagnose` + Dashboard-Warn-Kachel.
- Endpoints (`server/routes/fiaon-diagnose.ts`): `GET /admin/diagnose/events`, `GET /admin/diagnose/raw` (+`?download=1`), `GET /admin/diagnose/export`, `POST /admin/diagnose/purge`, `POST /admin/diagnose/ai`.
- **KI:** derselbe Provider-Pfad wie P4-C (`aiComplete` aus `fiaon-leistung.ts` exportiert). **In FIAON läuft jede KI ausschließlich über `OPENAI_API_KEY`** — kein Gemini/anderer Anbieter (Modell via `OPENAI_MODEL`, Default `gpt-4o-mini`). Bei Fehlern (401/429/404/Timeout) liefert der Endpoint die Klartext-Ursache. Nur maskierte/aggregierte Fehlergruppen gehen an die KI.

## P5-E — Design

Nur die **Konsolen-Fläche** weicht ab: dunkel (`#0b0f17`), Monospace,
farbcodierte Schweregrade (rose/amber/sky), Fenster-Punkte-Kopf. Kein
Zeichenregen, keine Emojis. Header/Nav/Buttons/PageIntro bleiben im hellen
Slate-CI. Einträge **umbrechen** (`break-words`/`whitespace-pre-wrap`), kein
Horizontal-Scroll → mobil lesbar. Rohdaten-Tab zeigt die Ring-Puffer-Auslastung.

## P5-F — Historie & Export

Persistiert mit 7-Tage-Retention; Zeitraum-Auswahl; JSON-Export
(`/admin/diagnose/export`) und Rohdaten-Download (`.txt`). Die Frage „Was war am
14.07. zwischen 13–15 Uhr?" ist damit rückwirkend beantwortbar (im
Retention-Fenster).

## Strikte Regeln — Umsetzung

- **Maskierung vor Speicherung:** `logDiagnostic` maskiert Nachricht + Kontext, bevor der INSERT läuft; der Ring-Puffer wird beim Push maskiert.
- **Ring-Puffer hart begrenzt:** 1.000 Zeilen **und** 2 MB (beides durchgesetzt), Server-Pagination, neueste zuerst.
- **Non-blocking:** `logDiagnostic` gibt sofort zurück, schreibt im Hintergrund; jeder Logging-Fehler wird verschluckt (die App läuft weiter). Eigener kleiner Pool (`max: 2`).
- **Keine Geschäftslogik geändert.**

## Testergebnisse (P5)

- `scripts/test-diagnose-masking.ts`: **12/12 PASS** — u. a. `sk-…`, Test-IBAN, **GitHub-PAT-in-URL** (realer Vorfall), Bearer/JWT, `DATABASE_URL`, Google-Key, E-Mail, Telefon; Klartext bleibt lesbar.
- `scripts/test-diagnose-e2e.ts` (echte DB, markierte Testdaten, räumt auf): **7/7 PASS** — Ring-Puffer hält Zeilen- **und** Byte-Grenze, neueste zuerst, Rohdaten maskiert; **100 identische Fehler → 1 Fingerprint** (Aggregation); persistierte Nachricht maskiert (`le***@gmail.com`, `sk-***REDIGIERT***`); Testdaten vollständig entfernt.
- `vite build` ✓, Server-Bundle (esbuild) ✓, alle FIAON-Dateien TypeScript-fehlerfrei.

## Ehrliche Abweichungen (Phase 5)

1. **Make-Fehler live provozieren** (Testplan 1) wurde nicht gegen die Produktion ausgelöst (kein absichtlicher Fehlversand an echte Kunden). Der Pfad ist über `test-diagnose-e2e.ts` verifiziert: `make-webhook.ts` ruft dieselbe `logDiagnostic`-Funktion, deren Persistenz + Maskierung + Aggregation getestet ist. Nach dem Deploy lässt sich ein echtes Fehlerereignis über einen ungültigen Make-Zweig gefahrlos erzeugen.
2. **Console-Interception** speist den Rohdaten-Puffer additiv (Original-Console wird zuerst aufgerufen) — sie erzeugt bewusst KEINE strukturierten Ereignisse aus jedem `console.error`, um Rauschen zu vermeiden; strukturierte Ereignisse kommen aus expliziten `logDiagnostic`-Aufrufen und den synthetischen Live-Signalen.
3. Vorbestehende TS-Fehler in `server/routes.ts` (ARAS-AI) bleiben unangetastet.

---

# Agent-Tickets #13–#16 (Florentine Lombardi, 15.07.2026)

## Phase 0 — Diagnose (vor jeder Änderung)

### T13 — Rückruf-Uhrzeit falsch gespeichert (Zeitzonen-Bug)
- **Ursache:** `datetime-local` liefert eine zeitzonenlose Wandzeit (`2026-07-15T12:30`). Der Server parste sie mit `new Date(...)` bzw. `::timestamptz` — auf Render (UTC) wird 12:30 dadurch als **12:30 UTC** gespeichert und in Deutschland als **14:30** (Sommer, +2 h) angezeigt.
- **Betroffene Server-Stellen:** `logAction` (`fiaon-agent.ts`, Rückruf + Zusage), `promised_pay_date`-Update im Kontakt-Ergebnis, Kalender-`reschedule`, `logLead` (`fiaon-leads.ts`) sowie der `${scheduledAt}::timestamptz`-Cast im Lead-Kontakt-Ergebnis (nutzte die Session-Zeitzone = UTC).
- **Dritte Inkonsistenz:** Der Admin (`admin-leads.tsx`) sendete `new Date(rueckruf).toISOString()` = **Browser-lokal** — nur korrekt, wenn der Browser in Berlin steht (Betreiber sitzt in Bangkok, UTC+7).
- **Anzeige:** `fmtD/fmtDT/fmtTime` (`agent/shared.tsx`) und die Admin-Formatter setzten **keine** `timeZone` → Anzeige in Betrachter-Zeitzone.
- **Reminder:** `runCallbackReminders` vergleicht absolute Instants (`scheduled_at BETWEEN NOW() … +60min`). Nach korrekter Speicherung feuert er automatisch zur richtigen Zeit.
- **Bestandsschaden:** Versatz ist **nicht einheitlich** (Agent +1/+2 h, Admin je nach Browser korrekt) → **keine pauschale Korrektur**. Read-only-Report: `scripts/measure-callback-offset.ts` (ändert nichts). Alt-Termine nur nach ausdrücklicher Freigabe des Betreibers einzeln prüfen.

### T14 — Nummernsuche erreicht die Agentin nicht
- Server-Endpoint `GET /agent/search` (`searchCustomersAndLeads`) **existiert** und normalisiert Telefonziffern (Kunden + Leads). Die **Leads-Seite hatte aber keine Suchleiste**; die Kunden-Seite zeigte Lead-Treffer nur als Link zur Queue (nicht öffenbar). Zusätzlich filterte die lokale Kunden-Liste nicht nach Telefon → geladene Kunden verschwanden bei Nummernsuche.

### T16 — Reaktivierung schließt das Fenster
- `reactivate()` rief `onChanged()` **und `onClose()`** → Drawer zu. Status verlässt `expired` → fällt zusätzlich aus dem „Abgelaufen"-Filter. Bestätigt (nicht angenommen).

### T15 — „Löschen"
- Direktive: kein Lead wird je gelöscht. Es fehlte ein Weg, No-Number-Leads **aus der Arbeitsliste** zu nehmen. Es gab keine `dismissed`-Spalte.

## Umsetzung
- **T13:** Neue Single-Source `server/lib/fiaon-time.ts` (`parseBerlinInput`, `berlinOffsetMinutes`, `formatBerlin`). Alle Server-Parse-Stellen deuten Eingaben als **Europe/Berlin** und speichern `timestamptz`. Anzeige überall mit `timeZone: "Europe/Berlin"` fixiert. Admin sendet die naive Eingabe (kein `toISOString()` mehr). UI-Hinweis „(Uhrzeit in deutscher Zeit)" + Sofort-Bestätigung nach dem Speichern („Rückruf gespeichert: … Uhr (deutsche Zeit)"). Reminder sendet zusätzlich `termin_zeit_text` in Berlin-Klartext.
- **T14:** Suchleiste auf der Leads-Seite (Kunden + Leads, Telefon/Name/E-Mail/Referenz). Treffer direkt öffenbar — auch nicht übernommene Leads. Kollision mit „nur eine offene Akte": **Park-Dialog** „Aktuelle Akte parken & Rückruf öffnen?" (`parkCurrent` parkt die offene Akte zurück in die Queue, kein Datenverlust, protokolliert). Kunden-Treffer öffnen via `/agent/kunden?ref=…`, Lead-Treffer via `/agent/leads?open=…`. Lokale Kundenliste matcht jetzt auch Telefonziffern.
- **T16:** Drawer bleibt nach Reaktivierung offen (`loadDetail()` in-place), zeigt neuen Status + Aktionen; Toast „Reaktiviert — … steht wieder unter ‚Offen'. Neue Zahlungsfrist bis TT.MM." Grundsatz umgesetzt: ein Statuswechsel entfernt einen geöffneten Datensatz nicht aus dem Fenster.
- **T15:** Button „Aus meiner Liste entfernen" (Grund-Auswahl) → `POST /agent/leads/:id/dismiss`. Lead verlässt die Queue (`dismissed_at/by/reason`), bleibt vollständig in der DB, Audit-Eintrag. Admin: Filter „Aussortiert" + „Zurückholen" (`POST /admin/leads/:id/restore`). Kein hartes Löschen — DSGVO-Löschung bleibt dem Admin (`gdpr_deleted_at`) vorbehalten.
- **Sichtbarkeitsregel (Betreiber):** Agenten-Warteschlange zeigt nur noch Leads mit **E-Mail + Name + Telefon** (vorher Telefon ODER E-Mail). Unvollständige Leads bleiben in der DB, im Admin sichtbar.

## Tests
- `scripts/test-berlin-time.ts`: **10/10 PASS** unter `TZ=UTC` (Render) **und** `TZ=Asia/Bangkok` (Betreiber) — Sommer/Winter (DST), reines Datum, ISO-mit-Z, Offset, Reminder-Instant, Anzeige immer Berlin.
- `npx tsc --noEmit`: keine neuen Fehler in den geänderten FIAON-Dateien.

## Ehrliche Grenzen
- **Keine Massenkorrektur** von Alt-Terminen (Freigabe des Betreibers nötig). Neue Termine sind ab dem Fix korrekt.
- DST-Randstunde (Umstellungsnacht 02:00–03:00) wird über einen Zwei-Pass-Offset behandelt; exotische Eingaben genau in der übersprungenen Stunde sind ein akzeptierter Grenzfall.

---

# Phase 3 — Phase 0 (Messbericht, 16.07.2026)

**Methode:** Nur-Lese-Skript `scripts/phase0-report.ts` (ausschließlich SELECT). Zeitzonen-Korrektur vorbereitet als `scripts/fix-callback-timezone.ts` (Standard = DRY-RUN, ändert nichts). Beide live gegen die Produktions-DB ausgeführt.

## A) Zeitzonen-Altbestand — Ergebnis: EINHEITLICH, Korrektur vorbereitet

| Kategorie | gesamt | **zukünftig (relevant)** | Versatz |
|---|---|---|---|
| Kunden-Rückrufe (`contact_log.scheduled_at`) | 9 | **8** | 8× Sommer **+2 h**, 0× Winter |
| Zahlungs-Zusagen (`promised_pay_date`) | 65 | 9 | tagesgenau → praktisch irrelevant |
| Lead-Rückrufe (`lead_log.scheduled_at`) | — | **0** | — |

- **Alle 8 zukünftigen Rückrufe sind agent-eingegeben (0 Admin/Browser-Einträge) und alle +2 h** → der Versatz ist **einheitlich**, eine deterministische Einmal-Korrektur (`neuer UTC = alt − Berlin-Offset`) ist zulässig.
- **Vorher/Nachher (Auszug):** `#616` Florentine 12:00 → **10:00**; `#316` Daniel 18:10 → **16:10**; `#921` Daniel (23.07.) 19:00 → **17:00**. Vollständige Liste im Dry-Run.
- **Zahlungs-Zusagen** sind tagesgenau (Zahltag) — 00:00 vs. 02:00 fällt auf denselben Kalendertag, daher **nicht** korrigiert.
- **Status:** Korrektur **NICHT ausgeführt**. Ausführen erst nach Freigabe:
  `npx tsx scripts/fix-callback-timezone.ts --apply --cutoff=<Deploy-Zeit ISO>` (schreibt vorher ein Backup, protokolliert jede Änderung, überspringt Admin-/System-Einträge, nur Zeilen vor dem Stichtag).

## B) Strenger Lead-Filter — Auswirkung gemessen: nur ~147 anrufbar

**Pro Agent (offene Leads → anrufbar nach Queue-Regel Tel+Mail+Name):**
- **Daniel: 840 → 71 anrufbar**
- **Florentine: 859 → 76 anrufbar**

**Gesamtbestand offener Leads (1.700):**
- vollständig (Tel+Mail+Name): **147**
- **nur E-Mail (kein Telefon): 1.553**
- nur Telefon (keine Mail): 0
- weder noch: 0
- Tel+Mail vorhanden, Name fehlt: 0

**Antworten auf die kritischen Fragen:**
1. **Bleiben „nur E-Mail"-Leads in der Nachfass-Sequenz?** **JA — alle 1.553** stehen auf `in_sequence = TRUE` und werden weiter angeschrieben. Die Nachfass-Engine verlangt `email OR telefon` (nicht Telefon), die strenge Regel gilt **nur** für die Anruf-Warteschlange. **Kein Fehler, keine Stilllegung — korrekt getrennt.** Diese Leads können als Direktzahler selbst konvertieren (volle Marge, keine Provision).
2. **Reicht die Arbeit?** **Nein, das ist knapp:** ~147 anrufbare Leads für zwei Agenten (Daniel 71 / Florentine 76). **→ Geschäftsentscheidung des Betreibers**, nicht technisch. Hebel: (a) Merges (siehe unten, +262 möglich), (b) Telefonnummern in den Import bringen.
3. **Welche Facebook-Kampagne liefert Leads ohne Telefon?** **Keine** — die telefonlosen Leads stammen fast vollständig aus der Quelle **`import`** (1.536 von 1.538 = 100 % ohne Telefon) sowie `Test import (20)` (16/16). Echte Facebook-Kampagnen (z. B. „Österreich Campaign 1") liefern nahezu vollständige Telefonnummern (1 % ohne). **→ Betreiber-TODO liegt beim Import-Prozess, nicht bei Facebook/Make.**

**Merge-Rettung (Schätzung, read-only):** **262** offene Leads ohne Telefon haben dieselbe E-Mail wie ein anderer Datensatz **mit** Telefon (Lead oder Antrag) → durch Merge anrufbar. Das würde den anrufbaren Bestand von ~147 auf grob **~400** heben — direkter Umsatzhebel und Begründung für P3-A.

## Fazit Phase 0
- **A:** einheitlicher +2-h-Versatz, 8 Termine, Korrektur vorbereitet (wartet auf Freigabe). Neue Termine sind ab Deploy korrekt.
- **B:** Filter arbeitet korrekt (nur-E-Mail bleibt im Mailing), aber der anrufbare Bestand ist mit ~147 knapp für zwei Agenten. Import ohne Telefon ist die Ursache; Merges heben ~262 zusätzlich. Entscheidung liegt beim Betreiber.

---
---

# PROMPT 3/3 — KI-COCKPIT (Chat mit dem eigenen System, 16.07.2026)

Neue Betreiber-Ansicht: oben auf `/admin` ein Chat, der Geschäftsfragen in
Klartext beantwortet — mit **echten** Zahlen aus der Datenbank, nie erfundenen.
**Keine Geschäftslogik geändert.** Alle KI-Aufrufe laufen über `OPENAI_API_KEY`
(`aiComplete`, Modell via `OPENAI_MODEL`, Default `gpt-4o-mini`).

## Architektur (verbindlich umgesetzt)

1. **Frage → SQL:** An die KI gehen NUR die Frage + das (kuratierte) DB-Schema +
   die verbindlichen Definitionen aus P2-D („bezahlt = …"). Die KI liefert **eine**
   read-only SQL-Abfrage. **Keine Kundendaten im ersten Schritt.**
2. **Server prüft & führt aus:** `server/lib/fiaon-cockpit.ts` härtet die SQL
   (s. u.) und führt sie NUR-LESEND aus. Das Ergebnis rendert die Seite als
   echte Tabelle/Zahl (Namen sieht **nur der Betreiber** — er ist Verantwortlicher).
3. **Erklärung → nur Aggregate:** Für die Einordnung gehen ausschließlich
   **aggregierte, anonymisierte** Werte an die KI (Spaltentyp, Zeilenzahl, Summen;
   sensible Spalten nur als „N verschiedene", nie Klartext). So kann der Betreiber
   „zeig mir alle Zahlungen von Terzi" fragen und das echte Ergebnis sehen, **ohne
   dass OpenAI je einen Kundennamen erhält.** (FIAON LTD/UK ↔ DACH-Verbraucher:
   keine Kundendaten-Übermittlung in die USA.)

## Sicherheits-Leitplanken (`server/lib/fiaon-cockpit.ts`)

- **Nur Lesen, mehrfach abgesichert:** (a) Whitelist — Query muss mit
  `SELECT`/`WITH` beginnen, EIN Statement, keine Kommentare, kein `;`. (b)
  Verbotene Schlüsselwörter wort-genau (`INSERT/UPDATE/DELETE/DROP/ALTER/
  TRUNCATE/CREATE/GRANT/REVOKE/COPY/MERGE/SET/INTO/…`; `updated_at`/`created_at`
  bleiben erlaubt). (c) Verbotene Ausdrücke/Kataloge (`pg_*`, `information_schema`,
  `current_setting`, `dblink`, …). (d) **Ausführung in einer READ-ONLY-Transaktion**
  (`SET TRANSACTION READ ONLY`) auf einem Pool mit `default_transaction_read_only`
  — selbst eine durchgerutschte Schreib-Anweisung scheitert an der DB.
- **Tabellen-/Spalten-Allowlist:** Nur Geschäftstabellen (Kunden, Leads, Zahlungen,
  Provisionen, Agenten, Feedback, Diagnose, Rechnungen). Jede nach `FROM/JOIN`
  referenzierte Tabelle wird geprüft (CTE-Namen erlaubt). **Gesperrt:** `users`,
  `sessions`, verschlüsselte Bankspalten (`bank_iban_enc`…), alles mit
  `password/secret/token/session` im Namen.
- **Statement-Timeout** (6 s) **+ erzwungenes LIMIT** (max. 500 Zeilen; fehlt es,
  wird es angehängt; Ergebnis zusätzlich serverseitig gekappt).
- **Prompt-Injection:** Aus der DB zurückkommende Texte (Kundennamen, Agenten-
  Notizen) werden nie als Anweisung interpretiert — der Erklär-Prompt bekommt sie
  gar nicht im Klartext, nur Aggregate.
- **Nur Admin:** Router hinter `blockAgentsFromAdmin` (Agent-Token ⇒ 403).
- **Kosten:** Rate-Limit (15 Fragen/Minute/IP), günstiges Modell, **kein KI-Aufruf
  beim bloßen Seitenaufruf** (nur auf aktives Fragen).
- **Kein Agenten-Tracking:** Es werden Ergebnisse abgefragt, kein Klick-/Zeit-
  verhalten (Scheinselbstständigkeit/DSGVO, wie Phase 4).

## Audit — „wer hat was gefragt"

Jede Frage landet in `fiaon_cockpit_log` (Akteur, IP, Frage, verwendete SQL,
Erfolg/Fehler, Zeilenzahl, Zeit). Der Verlauf der letzten Fragen ist im Cockpit
sichtbar (`GET /admin/cockpit/history`) und erneut anklickbar.

## UI (`client/src/components/admin/Cockpit.tsx`, oben auf `/admin`)

- **Prominent oben, nicht alleinige Startseite** — die „Was ist zu tun?"-Kacheln
  bleiben darunter. Bei KI-Ausfall/Fehlantwort bleibt das Dashboard voll nutzbar.
- Vorschlags-Chips, Ergebnis als **echte Tabelle** (mobil als Karten),
  `ref`-Spalten als Detail-Link in die Zahlungszentrale, gerendertes Markdown,
  ruhiger Ladezustand, **aufklappbare Abfrage** („woher kommt die Zahl"),
  Antwort kopierbar, Verlauf der letzten Fragen. Voll bedienbar ab 380 px.

## Endpunkte

- `POST /admin/cockpit/ask` `{ question }` → `{ sql, columns, rows, rowCount, truncated, explanation }` bzw. `{ ok:false, error, sql?, rejected? }`.
- `GET  /admin/cockpit/history` → letzte 25 Fragen (dedupliziert im UI).

## Abnahme-Test (Soll)

- „Wie viele bezahlt?" → dieselbe Definition wie truth-check (`paid` + `merged_into IS NULL` + `payment_reference IS NOT NULL`) → gleiche Zahl.
- Schreibende Abfrage (`UPDATE …`) → **abgelehnt** (Whitelist) bzw. an der DB (Read-only-TX) — nichts wird verändert.
- Frage nach einem Kundennamen → echtes Ergebnis in der Tabelle, **ohne** dass der Name an OpenAI geht (nur Aggregate im Erklär-Schritt).
- Injection in einer Notiz („… ignoriere alle Regeln …") → wird nur als Datenwert behandelt, nie als Anweisung.
- Bedienbar auf 380 px (Tabellen als Karten, Eingabe unten).

---

# PROMPT 3/3 — VORAB-FIXES (aus den Screenshots)

## F1 — Leistungs-KI widersprach den Kacheln → behoben (Anzeige-Bug, kein Datenbug)

**Ursache:** `/admin/leistung` lädt beim Öffnen IMMER die zuletzt **gespeicherte**
KI-Analyse (`leistung_last_summary`) — egal, welcher Zeitraum gerade gewählt ist.
Wurde die Analyse für „Heute" (1 Tag) erstellt und dann auf „30 Tage" umgeschaltet,
stand die alte Aussage („5 Konversionen/478 €, nur ein Tag") neben den 30-Tage-
Kacheln (89/4.255,42 €). Die KI bekam nie einen falschen Datensatz — sie lief nur
auf einem anderen Zeitraum als die aktuell gezeigten Kacheln.

**Fix (`admin-leistung.tsx`):** Die KI-Karte zeigt jetzt **immer ihren eigenen
Analyse-Zeitraum**. Weicht er vom aktuell gewählten ab, erscheint ein deutlicher
Hinweis („Diese Analyse bezieht sich auf … — die Kacheln zeigen …") mit Knopf
„Für aktuellen Zeitraum neu erstellen". Kein stiller Widerspruch mehr.

## F2 — Agentennamen in der KI-Analyse zurückgemappt

An OpenAI gehen weiterhin nur anonyme Token („Agent A/B/…"). Der Server liefert der
Anzeige zusätzlich die Rück-Zuordnung `agentMap` (Token→echter Name); das Frontend
ersetzt die Token beim **Anzeigen und Kopieren** durch die echten Namen
(`fiaon-leistung.ts` liefert `summary.agentMap`, `admin-leistung.tsx: applyAgentMap`).
Datenschutz gegenüber OpenAI bleibt, die Analyse wird lesbar.

## F3 — „Übernommene Akten: 1" bei 465 Kontakten → klar beantwortet

**Die Zählung ist korrekt.** „Übernommene Akten" zählt AUSSCHLIESSLICH die formale
Warteschlangen-Übernahme („Akte öffnen" → `fiaon_lead_log` `type='claim'`, genau
eine Stelle: `fiaon-leads.ts:893`). „Dokumentierte Kontakte" (`type='result'`) kommen
aus **Lead-Log UND Kunden-Log** (`fiaon_contact_log`); Kundenkontakte erzeugen nie
einen Lead-„claim". Ergebnis: Die **Warteschlange wird kaum genutzt** — die Agenten
arbeiten zugewiesene Leads/Kunden direkt und dokumentieren dort ihre Kontakte. Kein
kaputter Zähler. Tooltips auf `/admin/leistung` (Kachel + Tabellenkopf) erklären das
jetzt explizit.

## F4 — Doppelter Agent „Justin Schwarzott" → Zusammenführ-Skript (nicht löschen)

Stammsatz doppelt (D1.1: #2 aktiv, #7 inaktiv) → Historie auf zwei Identitäten.
**Read-only-Skript** `scripts/merge-duplicate-agent.ts` (DRY-RUN Standard):

```
npx tsx scripts/merge-duplicate-agent.ts                          # nur zeigen
npx tsx scripts/merge-duplicate-agent.ts --name="Justin Schwarzott" --apply
npx tsx scripts/merge-duplicate-agent.ts --from=7 --to=2 --apply  # explizit
```

Hängt ALLE Verweise (per `information_schema` gefundene `*_agent_id`-Spalten) vom
Quell- auf den Ziel-Agenten um, deaktiviert den Quell-Stammsatz (invalidiert dessen
Sessions) und schreibt Audit-Ereignisse (`agent_merge_received` / `agent_merged_into`).
**Es wird nichts gelöscht**, der Schreibvorgang läuft in EINER Transaktion
(alles-oder-nichts). Ausführung ist der bewusste Schritt des Betreibers nach dem Deploy.

## Verifikation (Prompt 3)

- `npx tsc --noEmit`: alle berührten FIAON-Dateien fehlerfrei; `vite build` ✓.
- Read-only-TX + Whitelist gegen `UPDATE/DELETE` geprüft (Guard lehnt ab; DB lehnt zusätzlich ab).
- Vorbestehende TS-Fehler in fremden Monorepo-Teilen (ARAS/`@shared/schema`) unberührt.

---
---

# P0/P3 — HARD-DELETE-FIX, DUBLETTEN-WERKZEUG, NAV-AUFRÄUMUNG + REPORT (16.07.2026)

## P0 — Hard-Delete abgesichert (DRINGEND)

`POST /admin/applications/merge` enthielt `DELETE FROM fiaon_applications` — echtes,
unwiderrufliches Löschen der Dublette. Ersetzt durch **Soft-Merge** (`mergeApplications`
in `server/routes/fiaon-antrag.ts`):
- Verlierer bleibt als Zeile (`merged_into = Gewinner`), verschwindet nur aus Listen.
- **Nur füllen, nie überschreiben**: leere Gewinner-Felder werden aus dem Verlierer ergänzt.
- Kontakthistorie (`fiaon_contact_log`) und Lead-Verknüpfungen (`fiaon_leads.converted_order_id`)
  wandern zum Gewinner (mit protokollierten IDs für exaktes Undo).
- **Provisionen bleiben an ihrer ref** (Buchhaltungs-Spur; gezählt pro agent_id → kein
  Anspruch verloren, keiner doppelt).
- Jeder Merge ist in `fiaon_merge_log` (Batch) protokolliert und per
  `POST /admin/applications/merge/undo` **exakt umkehrbar** (`undoMergeApplications`).
- `POST /admin/duplicates/cleanup-all` war bereits Soft-Merge (kein Handlungsbedarf).

## WURDE BEREITS GELÖSCHT? — JA (Forensik `scripts/p3-report.ts`)

Der alte Endpoint hat real Daten entfernt (verwaiste Verweise blieben zurück):
- **42** verwaiste Kontakt-Log-Einträge (ref ohne Antrag)
- **13** verwaiste Provisionseinträge (ref ohne Antrag)
- **5** Leads mit `converted_order_id` auf einen nicht mehr existierenden Antrag
Die gelöschten Antrags-Stammsätze selbst sind **nicht rekonstruierbar** (harte DELETEs,
kein Backup-Restore im Rahmen dieses Fixes). Ab jetzt kann so etwas nicht mehr passieren.
Die verwaisten Log-/Provisionszeilen bleiben als Spur erhalten (nichts wird gelöscht).

## /admin/dubletten (P3-A-Nachtrag) — Merge-Oberfläche

Neue Seite + angereicherter Endpoint `GET /admin/duplicates/groups` (Konfidenz,
Gewinner-Score, Feld-/Anrufbarkeits-Vorschau, Sortierung Doppelzahler→anrufbar→sicher).
Merge/Undo über die P0-Engine. Gewinner-Regel: bezahlt > angekündigt > offen; mit Agent >
ohne; vollständiger > unvollständiger.

## Report-Zahlen (Stand 16.07.2026, read-only)

- **Eine Wahrheit:** 111 bezahlt · **7.332,96 €** Umsatz (Definition: paid + merged_into IS NULL
  + payment_reference gesetzt). (Frühere 5.919,14 € stammten aus einem älteren Stand.)
- **Doppelzahler:** 4 E-Mail-Gruppen mit je 2× „bezahlt". **ACHTUNG:** in allen vier Fällen ist
  je ein `FIAON-SCHUFA-…`-Datensatz dabei (Bonitäts-/Schufa-Produkt) neben dem Hauptantrag —
  das sind **vermutlich zwei unterschiedliche Produkte derselben Person, KEINE echten Dubletten**.
  Nicht automatisch mergen; Betreiber muss je Fall entscheiden. Deshalb bleibt der Umsatz
  vorerst bei 7.332,96 € (keine pauschale Reduktion).
- **Anrufbarkeit:** **261** nicht-anrufbare offene Leads könnten per E-Mail-Merge eine
  Telefonnummer aus einem Schwester-Datensatz erben → direkt mehr Anrufe möglich.
- **Lead-Filter:** 1.549 nur-E-Mail-Leads offen, davon **1.549 in der Nachfass-Sequenz** →
  Filter korrekt, alle nur-E-Mail-Leads landen im Mailing (nichts zu beheben).
- **Zeitzonen (zukünftige Termine):** 22 offene Kunden-Termine, 0 Lead-Rückrufe. Versatz
  **NICHT einheitlich**: ein Teil sind reine Datums-Zusagen ohne Uhrzeit (erscheinen als
  „02:00 Berlin" = 00:00 UTC, Sommerzeit-Artefakt), andere haben plausible echte Uhrzeiten
  (z. B. 14:33, 16:00, 19:48). Daher **keine pauschale Korrektur** — neue Termine sind ab dem
  bereits deployten Fix korrekt; Alt-Termine nur einzeln nach Betreiber-Sichtung.
- **Daten-Präsenz (P3-B):** investors 3, investor_investments 8, investor_requests 1,
  investor_transactions 14 → **behalten** (`/admin/investoren`). accounting_entries 8,
  accounting_balance 1, accounting_ledger 143, accounting_config 1 → **echte Buchungen,
  behalten** (`/admin/buchhaltung`); offen: FIAON-eigen oder Fremdprodukt? → ggf. mit
  `/admin/verbuchungen` zusammenlegen.

## P3-B — /admin/database aufgelöst

Zweite Sidebar entfernt. `/admin/database` (+ Alias `/admin/kunden`) rendert nur noch
`AdminApplicationsManager`. Kündigungen/Investoren/Buchhaltung/Dubletten sind eigene
Nav-Punkte. Entfernt: Command OS, Live Radar, manuelle Aufgabenliste, Wissens-DB,
Stripe-Umsatzansicht (Stripe stillgelegt). Alte `/admin/database`-Links funktionieren weiter.
Die irreführende „Anträge (4297)"-Zahl der alten Übersicht entfällt.

## Verifikation (P0/P3)

- `npx tsc --noEmit`: alle berührten Dateien fehlerfrei; `npm run build` (vite + esbuild) ✓.
- `scripts/p3-report.ts` gegen die Produktions-DB (nur lesend) ausgeführt — Zahlen s. o.
- Regeln eingehalten: kein hartes Löschen, kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik,
  alles im Audit, umkehrbar, Changelog im selben Commit.
