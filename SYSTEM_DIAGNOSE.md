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
