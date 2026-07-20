# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

---

## 20.07.2026 — Agent-UX: sichtbarer Bestätigungsdialog + Funktions-/Schulungsseite (Prompt 2/2)

**A — Doppel-Tap durch echtes Bestätigungs-Popup ersetzt:** Der frühere „Zwei-Schritt"-Klick (Paket DD — erst markieren, dann denselben Button erneut tippen) war auf dem Handy unsichtbar/unverständlich. Er ist jetzt überall durch **einen modalen Bestätigungsdialog** ersetzt (zentriert am Desktop, Bottom-Sheet am Handy): ein Tap → Popup mit Titel, Name und — bei Aktionen mit Folgen — Klartext-Hinweis (z. B. „Der Kunde erhält eine E-Mail zur Nummern-Korrektur."), dann Abbrechen/Bestätigen. **Eine** wiederverwendbare Komponente (`ConfirmDialog` in `client/src/pages/agent/shared.tsx`): Fokus-Falle (Tab bleibt im Dialog), ESC/Backdrop schließt, Touch-Ziele ≥ 44 px, im bestehenden CI. Ausgerollt auf: **Kontakt-Ergebnisse** (Kunde + Lead), **Reaktivieren**, **Akte schließen ohne Ergebnis** (Pflicht-Begründung im Dialog statt `window.prompt`), **Verlaufseintrag als irrtümlich markieren**. Der **Rückruf-Termin** ist direkt im Dialog eingebettet (Datum/Zeit, Hinweis „deutsche Zeit" bleibt). Der Schutz vor Versehen bleibt also erhalten — er wird nur sichtbar.

**B — Funktions-/Schulungsseite (`/admin/funktionen`):**
- **Katalog** aller Funktionen, gruppiert nach Bereich (Kundenakte · Zahlungen · Leads/Warteschlange · E-Mails/Events · Agent-Portal · Team/Provision) — je Eintrag Name, 1-Satz-Erklärung, Direktlink; Event-Buttons tragen den Verdrahtungs-Status (✅ läuft · ⚠️ Make-Zweig fehlt · 💀 veraltet) aus der bestehenden `makeBranchReady`-Logik.
- **Selbsttest**: kompakte Tabelle „Button → erwartetes Event → zuletzt gefeuert (Berlin-Zeit) → Status" aus Registry + Versand-Verlauf — zeigt auf einen Blick, ob ein Knopf das richtige Event auslöst, ohne an echte Kunden zu senden (Verweis auf den Test-Versand in `/admin/events`). Bewusst nicht verdrahtete Empfehlungs-Events erscheinen als ⚠️.
- **Schulungsmodus**: aufgeräumte, präsentierbare Darstellung (große Typo, ein Bereich pro Bildschirm, Weiter/Zurück, **druckbar**) — kein Video-Schnickschnack, keine Emojis.
- **Verdrahtungs-Audit (Phase 0):** jeder Event-auslösende Button wurde systematisch gegen die Registry geprüft (`sendMakeWebhook`-Aufrufe server-weit). **Ergebnis: kein toter oder falsch verlinkter Event-Button** — jeder gefeuerte Event ist registriert. „Make-Zweig fehlt" ist kein Code-Fehler, sondern ein Betreiber-TODO in Make (Live-Status im Selbsttest). Tabelle auf der Seite.

**Regeln:** keine Geschäftslogik geändert (nur UX + Verdrahtungs-Anzeige + Doku), mobil + Desktop, bestehendes CI, Changelog im selben Commit.
**Ehrliche Grenze:** Die **Admin**-Lead-/Kunden-Detailansichten lösen Kontakt-Ergebnisse per Einzel-Klick aus (Desktop, kein Doppel-Tap, keine unklare Bestätigung) — dort war die gemeldete Doppel-Tap-Problematik nicht vorhanden, deshalb bewusst unverändert.
**Wo:** `client/src/pages/agent/shared.tsx` (neu `ConfirmDialog`), `client/src/pages/agent/kunden.tsx` + `client/src/pages/agent/leads.tsx` (Doppel-Tap entfernt, Dialoge verdrahtet), neu `client/src/pages/admin-funktionen.tsx`, `client/src/App.tsx` (+Route `/admin/funktionen`), `client/src/components/admin/AdminShell.tsx` (Nav-Punkt „Funktionen & Schulung").

---

## 20.07.2026 — Die zentrale Kundenakte: „Eine Seite. Alles." (Prompt 1/2)

**Die Akte (`/admin/kunde/:id`) — eine Seite pro Person:** Kopf mit Name, Lifecycle-Badge (Lead/Offen/Angekündigt/Bezahlt/Abgelaufen/Storniert/Direktzahler), Agent, Kontakt, „seit wann" und Dubletten-Warnung. Darunter alles in Abschnitten: **Stammdaten** (Name, E-Mail, Telefon, Adresse, Geburtsdatum — jede Änderung mit Audit alt → neu; sensible Felder wie Limit/Betrag/E-Mail mit Bestätigungsdialog), **Konditionen** (Kreditlimit `approved_limit`, Betrag `amount_due` — bei BEZAHLTEN Bestellungen gesperrt, Zahlungsfrist, Paket), **Zahlungen** (alle Bestellungen der Person inkl. Dubletten-Historie, Bankeingänge aus dem Kontoabgleich, Rechnung; Aktionen „bezahlt markieren" — **identischer Endpoint wie bisher, inkl. Provisions-Hook** —, stornieren, reaktivieren, Frist ändern), **E-Mail-Center** (jedes kundengebundene Make-Event als Button mit Payload-Vorschau + Bestätigung; Events ohne Make-Zweig zeigen ⚠️ statt still zu versagen; Versand-Historie der Person darunter), **Agent & Betreuung** (Zuweisung per Dropdown über den bestehenden Reassign-Endpoint, Provisions-Lage inkl. „Direktzahler" und Link zur Nachbuchung, alle Leads der Person), **Dubletten** (Familie derselben Person mit Gewinner-Vorschlag und **1-Klick-Zusammenführen mit Undo** über die bestehende Merge-Engine; UI-Hinweis „Zusammenführen statt Löschen — Historie bleibt beweisbar"; unsichere Namens-Treffer nur zur Prüfung), **Verlauf** (Kontakt-Log + Lead-Log der ganzen Person, chronologisch, Berlin-Zeit, plus Admin-Notizen).

**Die eine Liste (`/admin/kunden`):** Alle Personen — Leads und Kunden vereint, jede Person genau einmal (konvertierte Leads und gemergte Datensätze erscheinen nie doppelt; Lead-only-Zeilen nur, wenn keine Antrags-Schwester per E-Mail/Telefon existiert). **Serverseitig paginiert** (50/Seite, 512-MB-tauglich) mit kombinierbaren Filtern: Lifecycle-Chips, Agent, Quelle/Kampagne, Paket, Zeitraum, „ohne Agent", „ohne Telefon", „Dubletten-Verdacht", „Zahlung > 7 Tage unbestätigt", optional „anonyme Abbrecher". Jeder Treffer öffnet die Akte.

**Der kaputte Suchtreffer ist Geschichte:** Der frühere Treffer-Block der Zahlungszentrale („Paket DC") war eine Sackgasse — Kunden-Treffer setzten nur den Suchtext, Lead-Treffer waren gar nicht klickbar, Zeilen-Aktionen führten nur zur Rechnung. Jetzt öffnet **jeder** Treffer die Akte: der Block in der Zahlungszentrale, die ⌘K-Suche (Server liefert jetzt auch Leads + Telefon-Ziffern-Suche und verlinkt in die Akte statt in die Zahlungszentrale), die Dashboard-Schnellsuche (gleicher Endpoint), jede Zeile der Zahlungszentrale („Akte"-Knopf), der Detail-Drawer („Akte öffnen →") und der Lead-Drawer der Leads-Seite.

**Strikte Regeln eingehalten:** Kein hartes Löschen (nur Soft-Merge mit Undo). Kein Eingriff in Provisions-/Stichtag-/Zahlungs-Hooks — die Akte **ruft** die bestehenden Endpoints (`mark-paid`, `cancel`, `reactivate`, `merge`/`undo`, `events/send-real`, `team/reassign`, `leads/*`), sie ersetzt sie nicht. Berlin-Zeit überall, mobil bedienbar (Karten-Layout bricht um). Zahlungszentrale, Leads und Anträge & KYC bleiben als Arbeits-Fokusse erhalten — ohne eigene, abweichende Detail-Wahrheit.

**Wo:** Neu: `server/routes/fiaon-kunden.ts` (Liste + Akte-Aggregat + Stammdaten/Konditionen mit Audit + Notiz), `client/src/pages/admin-kunde.tsx` (Akte), `client/src/pages/admin-antraege.tsx` (früherer /admin/database-Inhalt). Geändert: `client/src/pages/admin-kunden.tsx` (jetzt die eine Liste), `server/routes/fiaon-admin-hub.ts` (Suche → Akte, Leads), `client/src/pages/admin-zahlungen.tsx` (Treffer-Block ersetzt, Akte-Links), `client/src/pages/admin-leads.tsx` (Akte-Link im Drawer), `client/src/components/admin/AdminShell.tsx` (Nav + Breadcrumb), `client/src/App.tsx`, `server/routes.ts` (Mount). Phase-0-Bestandsaufnahme (Funktions-Inventar Aktion → Ort → Endpoint) in `SYSTEM_DIAGNOSE.md`.

---

## 19.07.2026 — E-Mail-Vollinventur (/admin/events) + „Nummer falsch"-Strecke kundenfertig

**Vollinventur aller E-Mail-Ereignisse:** Der Server wurde komplett durchsucht — FIAON verschickt **keine E-Mail selbst**, jeder Versand läuft über Make.com (`sendMakeWebhook`). **Kein Versand läuft an der Registry vorbei.** `/admin/events` zeigt jetzt **alle** Ereignisse mit Beschreibung, Payload-Beispiel und Test-Button; Ereignisse ohne fertigen Make-Zweig tragen das Badge **„Make-Zweig fehlt"** samt Erklärung („Test lernt Make die Payload an"), das veraltete `followup_48h` ist als **VERALTET** markiert. Vollständige Inventur-Tabelle in `SYSTEM_DIAGNOSE.md`.

**Fehlende, sinnvolle Ereignisse ergänzt (nur registriert — kein automatischer Versand):** Für Momente, in denen ein Kunde eine Mail erwarten würde, aber bisher keine kam, sind jetzt testbare Events in der Registry — **als Empfehlung markiert**, damit der Betreiber Make-Zweig + Template bauen kann: `payment_cancelled` (Storno — vom Betreiber ausdrücklich vermisst), `payment_reactivated`, `documents_change_request`, `schufa_approved/rejected/requested`, `account_activated/suspended`, `profile_query`, `gdpr_deleted`. **Es wurde bewusst kein neuer Auto-Versand verdrahtet** (nur auf ausdrücklichen Wunsch).

**„Nummer falsch"-Strecke kundenfertig (#23):**
- **Brevo-Template** `docs/brevo-templates/number_update_request.html` (FIAON-CI, Sie-Form, Button, Impressum) + Betreiber-Anleitung in `docs/BETREIBER_TODO_MAKE.md`.
- **Kundenseite `/nummer-aktualisieren` auf Premium-Niveau:** FIAON-Branding, große Schrift, mobil perfekt; zeigt die **maskierte** hinterlegte Nummer („+49 176 •••••• 52"); **Live-Validierung** (grüner Haken/Fehlertext, Speichern erst bei gültiger Nummer, Unsinn wie 00000 wird abgefangen); freundliche Erfolgs- und Ablauf-Seiten; **nur** die Telefonnummer ist änderbar (der signierte Link ist die Authentifizierung).
- **Antrags-Funnel:** dieselbe Live-Telefonvalidierung nachgerüstet (privat + business) — **keine SMS-Verifizierung** (Conversion-Schutz), nur sofortige Formatprüfung; kein neuer Pflicht-Schritt.
- **Sichtbarkeit für Agenten:** Korrigiert ein Kunde seine Nummer selbst, springt der Lead in der Warteschlange **nach oben** und Kunde/Lead tragen das Badge **„Nummer vom Kunden korrigiert — erneut anrufen"** (bis ein neuer Kontakt dokumentiert ist). So verpufft die Korrektur nicht.

**Regeln:** keine neuen automatischen Versände ohne Freigabe (fehlende Events nur registriert + empfohlen); Sie-Form, mobil; kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik.
**Wo:** `server/make-webhook.ts` + `make-events-registry.ts` (neue Event-Typen, `recommendationOnly`), `server/routes/fiaon-admin-hub.ts` (`makeBranchReady`, send-real-Guard), `server/routes/fiaon-antrag.ts` (maskierte Nummer, `number_corrected_at`), `server/routes/fiaon-leads.ts` + `fiaon-agent.ts` (Queue-/Worklist-Badge), `client/src/lib/phone.ts` (neu, gemeinsame Validierung), `pages/nummer-aktualisieren.tsx`, `pages/antrag.tsx`, `pages/business-antrag.tsx`, `pages/admin-events.tsx`, `pages/agent/kunden.tsx`, `pages/agent/leads.tsx`, `docs/brevo-templates/number_update_request.html`, `docs/BETREIBER_TODO_MAKE.md`.

---

## 19.07.2026 — Agenten-Workflow: Geld-Backlog, Portal-Limit, Löschen, Kalender, Nummer-Korrektur (#15–#23)

**#18 — „Lange bezahlt, nie bestätigt" sichtbar gemacht (Geld):** Das Dashboard warnt jetzt „**X Kunden warten seit > 7 Tagen auf Zahlungsbestätigung**" (angekündigt/`claimed_paid`, nie freigeschaltet — dort liegt unerkannter Umsatz). Klick führt in die Zahlungszentrale. Das Nur-Lese-Skript `scripts/prompt2-report.ts` listet alle Fälle (inkl. Alan Imsirovic) mit Bank-Abgleich-Status und Summe. Der Handgriff „bezahlt bestätigen" bleibt beim Betreiber.

**#20 — Falsches Kreditlimit im Kundenportal behoben (Geld):** Ultra-Kunden sahen teils „250 €" statt des Paket-Limits. Ursache: das pro-Antrag berechnete `approved_limit` wurde im Funnel auf den Mindestwert (250 €) geklemmt bzw. gar nicht gesetzt. Das Portal zeigt jetzt das **Paket-Limit** (Starter 500 € · Pro 5.000 € · Ultra 15.000 € · High End 25.000 €, Business analog), wenn kein sinnvolles persönliches Limit vorliegt. **Keine Änderung an Zahlung/Provision** — reine Anzeige. Bestehende Sessions aktualisieren sich beim nächsten Öffnen automatisch. `scripts/prompt2-report.ts` listet alle betroffenen bezahlten/aktiven Kunden.

**#15/#22 — „Aus meiner Liste entfernen" jetzt auch für KUNDEN (kein Löschen):** Agent und Admin können Kunden mit Grund (keine Nummer · ungültige Nummer · 100 % abgelehnt · kein Interesse · Dublette) aus der Arbeitsliste nehmen. Der Kunde **bleibt vollständig in der DB**, verschwindet nur aus Warteschlange/Arbeitsliste, ist im Admin unter dem neuen Filter **„Aussortiert"** sichtbar und **jederzeit zurückholbar**. UI-Hinweis überall: „Wird nie gelöscht — verschwindet nur aus deiner Liste." (Für Leads gab es das bereits.)

**#17 — Kalender-Termine anklickbar:** Ein Klick auf einen Termin öffnet ein **Detail-Popup** (auf dem Handy als Bottom-Sheet) mit Kunde, **Uhrzeit in deutscher Zeit**, Typ, Notiz und **Direktlink zur Kundenakte**. Lange Namen werden nicht mehr abgeschnitten.

**#23 — „Nummer falsch" → automatische Korrektur-Mail:** Wählt ein Agent das Kontakt-Ergebnis „Falsche Nummer" und ist eine E-Mail hinterlegt, geht (max. **1×/Tag/Person**) eine Mail mit Button **„Nummer aktualisieren"** raus. Der Kunde trägt in einem schlanken Formular (`/nummer-aktualisieren`, signierter Link) seine Nummer ein → sie landet direkt im Datensatz (Audit „vom Kunden selbst aktualisiert"), der Lead/Kunde wird **wieder anrufbar** und geht zurück in die Warteschlange. So werden gerade die „nur E-Mail, keine Nummer"-Leads reaktivierbar — echter Umsatz-Hebel. **Betreiber-TODO:** Make-Zweig `number_update_request` + Brevo-Template mit Button zu `update_url` anlegen (Struktur wie bestehende Events; Beispiel in der Event-Registry / `/admin/events`).

**#16 — Reaktivierung verifiziert:** Der Drawer bleibt nach „Kunde reaktivieren" offen und lädt in-place neu (kein `onClose`), alle Aktionen sofort nutzbar — im Code bestätigt.

**Regeln:** kein echtes Löschen (alles umkehrbar, im Audit), Berlin-Zeit überall, kein Eingriff in Provisions-/Stichtag-Logik, mobil + Desktop.
**Wo:** `server/routes/fiaon-antrag.ts` (`effectiveLimit`/`PACK_LIMITS`, `/admin/applications/:ref/dismiss|restore`, `/number-update/:token`), `server/routes/fiaon-agent.ts` (`/agent/customers/:ref/dismiss`, Kalender-Feld, Nummer-Mail), `server/routes/fiaon-leads.ts` (`/admin/leads/:id/attach-to-order` aus P1, Nummer-Mail), `server/routes/fiaon-admin-hub.ts` (Backlog-Signal), `server/fiaon-number-update.ts` (neu), `server/make-webhook.ts` + `make-events-registry.ts` (Event `number_update_request`), Client: `dashboard.tsx`, `admin-hub.tsx`, `agent/kunden.tsx`, `agent/leads.tsx`, `agent/kalender.tsx`, `components/admin/AdminApplicationsManager.tsx` + `AdminAppDetail.tsx`, `pages/nummer-aktualisieren.tsx` (neu), `App.tsx`; Report `scripts/prompt2-report.ts` (neu).

---

## 19.07.2026 — Dubletten & verschwundene Kunden: Prävention, die wirklich greift (P1–P4)

**Das Kernproblem (6 von 14 Tickets):** Bereits bezahlte Kunden tauchten doppelt auf, verschwanden oder wurden dem falschen Agenten zugeordnet (#19/#21/#24/#25/#26/#27). Die frühere Stufe „nur erkennen + flaggen" (P3-A) hat das nicht praktisch gelöst — dieselbe Person lief weiter mehrfach durch den Funnel. Diese Änderung behebt es real.

**P1 — Prävention beim Anlegen der Bestellung (der eigentliche Fix):** Beim Übergang zu „offen/zu zahlen" (`POST /payment-order`) prüft das System jetzt, ob **dieselbe Person** (gleiche E-Mail **oder** normalisiertes Telefon) bereits **bezahlt** hat oder **in aktiver Betreuung** ist. Wenn ja, wird der neue Doppel-Antrag **sofort mit dem bestehenden Datensatz verknüpft** (Soft-Merge) statt als zweiter Kunde in Umlauf zu gehen — **kein zweiter Agent, keine zweite Anrufliste, kein Doppelanruf.** Der betreuende Agent sieht eine Notiz im Verlauf.
**Geld-Sicherheit (unverhandelbar):** Der Merge berührt **niemals** eine bestehende Zahlung, Provision oder Rechnungsnummer — nur der neue, unbezahlte Antrag wird angehängt. Bei **Unsicherheit** (zwei bezahlte Datensätze) findet **kein** Automatik-Merge statt; der Fall wird als „prüfen" für `/admin/dubletten` geflaggt. **SCHUFA/Bonität** (eigenes Produkt) wird bewusst nie automatisch verknüpft.

**P2 — Bezahlte/gemergte Kunden sind aus der Arbeitsliste raus (aber nicht aus dem System):** Die Agenten-Warteschlange und Anrufliste zeigen `paid`- und `merged`-Datensätze nicht mehr an. Der betreuende Agent findet sie weiter über „Gesamtbestand → Bezahlt" und die Suche. Der **Doppelanruf** (#21, Daniel & Florentine) entstand durch Dubletten-Datensätze derselben Person, die je einem anderen Agenten zugewiesen waren — P1 verhindert das Nachwachsen, P3/P5 räumen den Bestand auf.

**P3 — `/admin/dubletten` erkennt jetzt auch Lead ↔ Kunde:** Neben E-Mail- und Telefon-Gruppen zeigt die Seite jetzt **offene Leads, die zu einem bereits bezahlten/aktiven Kunden gehören** (dieselbe Person als Lead **und** als Kunde — genau die Fälle, die der reine E-Mail-Merge übersah). Mit einem Klick lässt sich der Lead **verknüpfen** („Mit … verknüpfen") — er verlässt die Anruf-Warteschlange, bleibt aber vollständig in der DB. Zahlung/Provision bleiben unberührt.

**P4 — Zahler mit abweichendem Namen/Konto (#27):** Im Kontoabgleich gilt weiter: **die Referenz ist der Anker, nicht der Name.** Stimmt die Referenz, weicht aber der Einzahlername vom Kundennamen ab (z. B. Zahlung über das Konto der Mutter), erscheint jetzt ein dezenter Hinweis **„Name weicht ab (Zahlung evtl. durch Dritte)"**. Kein Automatismus — nur Sichtbarkeit; die manuelle Zuordnung bleibt möglich.

**Phase 0 — Forensik:** Das Nur-Lese-Skript `scripts/forensik-verschwundene-kunden.ts` prüft jetzt die konkret gemeldeten Namen (#18–#27) inkl. Referenz-Lookup, Doppelzahler-Report und „offene Anträge trotz bezahlter Schwester". Ausführen: `npx tsx scripts/forensik-verschwundene-kunden.ts`.

**Kunden-Flow gehärtet:** Wird der neue Antrag verknüpft, leitet der Funnel weiter auf die bestehende Bestellung (`/zahlung/…`, zeigt bei bezahltem Gewinner die „bereits bezahlt"-Ansicht); bei Alt-Kunden ohne Zahlungsreferenz zum Login — kein hängender Button. SCHUFA-Funnel unberührt.
**Getestet:** `scripts/p1-prevention-e2e.ts` (markierte Testdaten, `--cleanup`): Verknüpfung, Geld-Sicherheit, Telefon-Treffer, „zwei Bezahlte → kein Auto-Merge", SCHUFA-Ausschluss, Undo. `npx tsc --noEmit` fehlerfrei.

**Sicherheit/Regeln:** kein hartes Löschen, kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik, alles im Audit-Log, jeder Merge per `fiaon_merge_log` umkehrbar.
**Wo:** `server/routes/fiaon-antrag.ts` (`linkDuplicateToPaidOrActive`, `/payment-order`, `/admin/duplicates/groups` Lead-Cross), `server/routes/fiaon-leads.ts` (`/admin/leads/:id/attach-to-order`), `server/routes/fiaon-reconcile.ts` (`payerMatchesCustomer`), `client/src/pages/admin-dubletten.tsx`, `admin-kontoabgleich.tsx`, `antrag.tsx`, `business-antrag.tsx`, `scripts/forensik-verschwundene-kunden.ts`, `scripts/p1-prevention-e2e.ts`. Details in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — Kein Löschen mehr + Dubletten-Werkzeug + aufgeräumte Navigation (P0/P3)

**Dringend behoben — kein hartes Löschen mehr:** Das Zusammenführen von Dubletten hat Datensätze bisher **unwiderruflich gelöscht** (`DELETE`). Das widerspricht der Grundregel „kein Kunde/Lead wird je gelöscht". Ab sofort ist jeder Merge ein **Soft-Merge**: Der Verlierer bleibt in der Datenbank erhalten (nur ausgeblendet), Kontakthistorie und Lead-Verknüpfungen wandern zum Gewinner, und **jeder Merge ist per Klick rückgängig** zu machen. Provisionen bleiben unangetastet — kein Anspruch geht verloren, keiner entsteht doppelt.

**Neu: `/admin/dubletten` — Dubletten zusammenführen.** Eine eigene Seite zeigt alle mehrfach angelegten Personen (gleiche E-Mail **oder** Telefonnummer) nebeneinander — mit **Konfidenz** (Sicher/Wahrscheinlich/Prüfen), einem **Gewinner-Vorschlag** (bezahlt vor angekündigt vor offen; mit Agent vor ohne; vollständiger vor unvollständiger) und einer Vorschau, **welche fehlenden Felder** der Gewinner dazugewinnt (Telefon, E-Mail, Adresse, Geburtsdatum). Merge per Klick, **Rückgängig** direkt daneben. Doppelt-bezahlte Fälle und „wird dadurch anrufbar" stehen oben.
**Warum wichtig:** Viele nicht-anrufbare Leads werden durch das Ergänzen der Telefonnummer aus einem Schwester-Datensatz **anrufbar** — das ist direkter Umsatz und entlastet die Agenten.

**Navigation aufgeräumt (zweite Sidebar entfernt):** Die versteckte „Cockpit"-Sidebar unter `/admin/database` ist weg. `/admin/database` zeigt jetzt **nur noch die Kunden-/Antragsverwaltung** (Suche, Filter, KYC, Zusammenführen). Alles andere ist über die **Haupt-Navigation** erreichbar:
- **Kündigungen** → eigener Punkt `/admin/kuendigungen` (echter Workflow, war nur versteckt erreichbar).
- **Investoren** → eigener Punkt `/admin/investoren` (enthält echte Daten, daher behalten).
- **Buchhaltung/Ausbuchung** → eigener Punkt `/admin/buchhaltung` (Journal + Ledger enthalten echte Buchungen, daher behalten statt entfernt; offene Betreiber-Frage: mit `/admin/verbuchungen` zusammenlegen?).
- **Dubletten** → eigener Punkt `/admin/dubletten` (statt Sprungmarke).
- **Entfernt:** „Command OS", „Live Radar", die manuelle Aufgabenliste, die Wissens-DB und die **Stripe-Umsatzansicht** (Stripe ist bei FIAON stillgelegt — Zahlungen laufen über Wise/Vorkasse; einzige Umsatzquelle bleibt `/admin/finanzen`). Übersicht/Aufgaben liefert der Hub `/admin`.
- Alte Links auf `/admin/database` funktionieren weiter.

**Sicherheit/Regeln:** kein hartes Löschen, kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik, jede Aktion protokolliert und umkehrbar (`fiaon_merge_log`).
**Wo:** `client/src/pages/admin-dubletten.tsx`, `admin-kuendigungen.tsx`, `admin-investoren.tsx`, `admin-kunden.tsx`; Merge-Engine in `server/routes/fiaon-antrag.ts` (`mergeApplications`, `undoMergeApplications`); Diagnose `scripts/p3-report.ts`. Details in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — KI-Cockpit: Frag dein Geschäft in normaler Sprache (Prompt 3/3)

**Was:** Oben auf `/admin` gibt es jetzt einen **Chat**. Du fragst z. B. „Wie viele bezahlt diesen Monat?" oder „Zeig mir alle Zahlungen von Terzi" und bekommst **echte Zahlen aus der Datenbank** als Tabelle — plus eine kurze Einordnung und die **aufklappbare Abfrage** („woher kommt die Zahl"). Vorschlags-Chips für den Einstieg, Verlauf der letzten Fragen, Antwort kopierbar; auf dem Handy voll bedienbar.
**Warum:** Zahlen nachschlagen hieß bisher: die richtige Seite finden, Filter setzen, exportieren. Jetzt reicht eine Frage — und die Antwort ist belegt statt geraten.
**Datenschutz (Kern):** Die KI bekommt **nie Kundendaten**. Sie sieht nur die Frage + das Datenbank-Schema + die verbindlichen Definitionen und liefert eine **nur-lesende** Abfrage zurück. Unser Server prüft die Abfrage hart und führt sie aus; für die Erklärung gehen nur **anonyme Summen** an die KI (keine Namen, E-Mails, Telefonnummern, IBANs). So bleibt „Terzi" auf unserem Server, nicht bei OpenAI.
**Sicherheit:** Nur Lesen (mehrfach abgesichert: Schlüsselwort-Whitelist + Read-only-Transaktion in der DB), nur erlaubte Geschäftstabellen (keine Passwörter/Bankdaten), Timeout + Zeilenlimit, nur Admin, Rate-Limit, kein KI-Aufruf beim bloßen Öffnen. **Jede Frage wird protokolliert** (wer, wann, welche Abfrage). Bei KI-Ausfall bleibt das übrige Dashboard voll funktionsfähig.
**Wo:** Dashboard `/admin` (oben). Technik: `server/lib/fiaon-cockpit.ts` (Leitplanken), `server/routes/fiaon-cockpit.ts` (Endpunkte + Audit), `client/src/components/admin/Cockpit.tsx`. Details in `SYSTEM_DIAGNOSE.md`.

**Vorab behoben (aus den Screenshots):**
- **Leistungs-KI widersprach den Kacheln:** Die gespeicherte KI-Analyse wurde unabhängig vom gewählten Zeitraum angezeigt. Jetzt zeigt sie **ihren eigenen Analyse-Zeitraum** und warnt, wenn er von den Kacheln abweicht (mit „neu erstellen"). Kein Datenbug — ein Anzeige-Bug, jetzt ehrlich sichtbar.
- **Agentennamen in der KI-Analyse:** Die Anzeige ersetzt die anonymen „Agent A/B/…" wieder durch die echten Namen (an OpenAI ging nie ein Name).
- **„Übernommene Akten: 1" bei 465 Kontakten:** Zählung ist korrekt — sie misst nur die formale Warteschlangen-Übernahme; die Warteschlange wird kaum genutzt (Agenten arbeiten zugewiesene Leads/Kunden direkt). Tooltips erklären das jetzt.
- **Doppelter Agent „Justin Schwarzott":** Zusammenführ-Skript `scripts/merge-duplicate-agent.ts` (DRY-RUN Standard, `--apply` zum Ausführen) hängt alle Verweise auf den aktiven Stammsatz um und deaktiviert die Dublette — **nichts wird gelöscht**, alles im Audit.

**Regeln eingehalten:** keine Geschäftslogik geändert, alles im Audit, keine Heredocs, Doku in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — P3-A: Dubletten-Erkennung per E-Mail UND Telefon (nur erkennen + flaggen)

**Was:** Legt ein Kunde mehrfach denselben Antrag an (z. B. zwei Browser-Sitzungen), wird das jetzt beim Anlegen der Bestellung **automatisch erkannt** — nicht nur über die **E-Mail**, sondern auch über die **Telefonnummer** (formatunabhängig normalisiert: `0170…`, `+49170…`, `0049170…` gelten als gleich). Es wird **nichts automatisch zusammengeführt** und **nichts am Zahlungsfluss geändert** — die Dublette wird nur in der Kundenhistorie vermerkt und in der Dubletten-Verwaltung angezeigt.
**Warum:** Bisher fand die Dubletten-Erkennung ausschließlich über die E-Mail statt. Kunden, die zweimal mit derselben Handynummer, aber (vertippter/anderer) E-Mail auftauchten, blieben unentdeckt. Betreiber-Entscheidung: bewusst **kein** automatischer Merge im Geldfluss (Referenz, Rechnungsnummer, Provision bleiben unangetastet) — erst prüfen, dann manuell handeln.
**Wo & wie:**
- **Antrags-Intake (`POST /payment-order`):** Nach dem Anlegen der Bestellung läuft eine Erkennung (fire-and-forget, blockiert den Kunden nie). Findet sie eine aktive Schwester (gleiche E-Mail ODER Telefon, andere Referenz, Status offen/angekündigt/bezahlt), schreibt sie einen Vermerk in die Kundenhistorie: „Mögliche Dublette erkannt …". Siehe `detectAndFlagDuplicateApplication` in `server/routes/fiaon-antrag.ts`.
- **Dubletten-Verwaltung (`/admin/zahlungen`):** Gruppen werden jetzt nach **E-Mail UND Telefon** gebildet. Telefon-Gruppen erscheinen nur, wenn sie eine Verbindung aufdecken, die die E-Mail-Gruppierung nicht schon zeigt (z. B. gleiche Nummer bei abweichender E-Mail). Jede Gruppe trägt ein Badge (E-Mail/Telefon); „Alle offenen stornieren" funktioniert auch für Telefon-Gruppen (per Referenzliste). Zähler: „N E-Mail · M Telefon".
- **Doppelzahler:** Fälle, in denen dieselbe Person zweimal bezahlt hat, erscheinen jetzt als Gruppe mit mehreren „Bezahlt"-Einträgen und lassen sich dort prüfen.
- **Lead-Intake:** dedupt bereits per E-Mail **oder** normalisiertem Telefon (innerhalb 24 h) — unverändert, hier nur verifiziert (`processIntake` in `server/routes/fiaon-leads.ts`).
**Kein Merge, keine Löschung, keine Mails.** Alles bleibt rekonstruierbar; Zusammenführung/Stornierung bleibt manuelle Admin-Aktion.

---

## 16.07.2026 — Tickets sind jetzt Gespräche (Prompt 2/3)

**Was:** Aus jedem Feedback-Ticket wird ein **Thread**. Betreiber und Agent schreiben abwechselnd im selben Ticket — mit Autor und Uhrzeit (deutsche Zeit). Es entsteht **kein neues Ticket** mehr für eine Antwort.
**Warum:** Bisher musste der Agent für jede Antwort ein neues Ticket öffnen. So standen 16 Tickets in der Liste, teils dieselbe Sache mehrfach — unübersichtlich für beide Seiten.
**Wo & wie:**
- **Agent (`/agent/feedback`):** „Deine Tickets" zeigt jeden Verlauf; Antwortfeld direkt im Thread. Ungelesene Betreiber-Antworten sind mit einem Punkt markiert; ein **Badge auf „Mehr"** in der Navigation zeigt, wie viele Tickets auf den Agenten warten. Öffnen markiert als gelesen.
- **Betreiber (`/admin` → „Agent-Updates & Feedback"):** Antworten **direkt im Thread** statt im Kommentarfeld. Status (Offen/Geprüft/Umgesetzt/Abgelehnt) bleibt und erscheint im Verlauf als Ereignis („Status auf Umgesetzt gesetzt"). Das **Nav-Badge zählt jetzt nur Tickets, die auf deine Antwort warten** — nicht mehr alle offenen.
- **Benachrichtigung:** Antwortet der Betreiber, bekommt der Agent eine **Mail** (neues Make-Event `agent_feedback_reply`) — sonst merkt er die Antwort nicht. **Betreiber-TODO** (Make-Zweig + Brevo-Template) ist in `docs/BETREIBER_TODO_MAKE.md` und in der Event-Registry dokumentiert; testbar unter `/admin/events`.
- **Bestand migriert:** Die 16 bestehenden Tickets wurden automatisch zu Threads (bisherige Beschreibung = erster Eintrag, vorhandener Admin-Kommentar = erste Antwort). **Nichts geht verloren.** Migration ist idempotent (läuft nur, wo noch kein Verlauf existiert).
- **Duplikate:** Ein Ticket lässt sich als **Duplikat verknüpfen** („gehört zu #11") statt es zu schließen — die Verknüpfung bleibt als Ereignis im Verlauf, das Ticket bleibt erhalten.
- **Bonus-Logik unverändert:** Gutschrift pro Ticket wie bisher (erscheint zusätzlich als Ereignis im Verlauf).
**Regeln:** Nichts gelöscht, alles im Audit. Mobil + Desktop (Agenten antworten am Handy). Uhrzeiten in deutscher Geschäftszeit (Europe/Berlin, wie T13).
**Details:** `docs/AGENT_FEEDBACK_THREADS.md`.

---

## 16.07.2026 — Design-Qualität: Tooltips, KI-Optik & Mobile (Prompt 1/3)

**Was:** Die kleinen Info-„i" (Tooltips) funktionieren jetzt richtig, KI-Ausgaben werden sauber gerendert statt als Rohtext, und die Leistungs-Tabelle bricht auf dem Handy nicht mehr aus.
**Warum:** Die Tooltips waren als natives `title`-Attribut gebaut — auf dem Handy passiert beim Antippen nichts (kein Hover), auf dem Desktop erschien nur ein verzögerter, hässlicher Browser-Kasten. Die KI-Analyse stand als Markdown-Rohtext (`## Was lief gut`, `**Text**`) auf der Seite und lief über die volle Breite (unlesbar). Die Team-Tabelle mit 11 Spalten scrollte auf schmalen Displays horizontal weg („DIREKT…" abgeschnitten).
**Wo:**
- **Tooltips:** Neue gemeinsame Komponente `Tip` (`client/src/components/admin/PageHelp.tsx`) — klick-/tap-basiert (kein Hover mehr nötig), dezente Karte im CI, sanfte Einblendung, schließt bei Klick daneben oder ESC. Positioniert sich selbst im sichtbaren Bereich (per Portal an `<body>`), wird also **nie** von Tabellen/Karten abgeschnitten. Überall ersetzt: Kennzahlen und Tabellenköpfe in `/admin/leistung`, `/admin/hub`, `/admin/finanzen` (Kennzahlen + Funnel-Stufen).
- **KI-Optik:** Neue Bausteine `AiButton` + `Markdown` (`client/src/components/admin/AiKit.tsx`). KI-Buttons bekommen eine hochwertige, ruhige Optik (subtiler Verlauf, feine Tiefe statt Neon; ruhiger Ladezustand statt hartem Spinner). KI-Ausgaben werden mit Überschriften, Listen und Fettung gerendert und auf angenehme Lesebreite begrenzt (`/admin/leistung`, `/admin/diagnose`).
- **Mobile-Tabelle:** Die Team-Leistungstabelle stapelt auf schmalen Viewports als Karten (Agent oben, Kennzahlen als Paare, wichtige zuerst); Touch-Ziele ≥ 44 px. Auf Desktop bleibt die Tabelle.
- **CI:** feine Schatten-Hierarchie, konsistente Radien, ruhige Übergänge (150–200 ms); `prefers-reduced-motion` respektiert (`client/src/index.css`).
**Keine Geschäftslogik geändert.** Design-/Mobile-Audit: `docs/DESIGN_TOOLTIP_MOBILE_AUDIT.md`.

---

## 16.07.2026 — Phase 0: Messbericht Zeitzone + Lead-Filter

**Was:** Zwei offene Punkte aus dem letzten Update mit echten Zahlen aus der Produktion beantwortet (nur gemessen, nichts verändert).
**A — Zeitzonen-Altbestand:** 8 zukünftige Rückruf-Termine liegen 2 h zu spät, alle gleich (agent-eingegeben, Sommerzeit). Einheitlicher Versatz → eine Einmal-Korrektur ist vorbereitet (`scripts/fix-callback-timezone.ts`, Standard = Test-Lauf, ändert nichts). **Wird erst nach ausdrücklicher Freigabe scharf ausgeführt.** Zahlungs-Zusagen (tagesgenau) sind nicht betroffen.
**B — Lead-Filter:** Von 1.700 offenen Leads sind nur **147 anrufbar** (Daniel 71, Florentine 76). 1.553 haben nur E-Mail (kein Telefon) — sie bleiben **korrekt im Mail-Versand** (self-conversion als Direktzahler). Die telefonlosen Leads stammen aus dem **Import** (100 % ohne Telefon), nicht aus Facebook. **262** davon lassen sich per Merge anrufbar machen. Ob ~147 für zwei Agenten reichen, ist eine Betreiber-Entscheidung.
**Wo:** `scripts/phase0-report.ts` (read-only), Details in `SYSTEM_DIAGNOSE.md` → „Phase 3 — Phase 0".

---

## 16.07.2026 — Agent-Tickets #13–#16 (Florentine Lombardi)

**T13 — Rückruf-Uhrzeit war falsch.**
Was: Eingegebene Rückruf-/Zusage-Zeiten wurden verschoben gespeichert (z. B. 12:30 → 14:30). Jetzt gilt überall **eine** Geschäftszeitzone: **deutsche Zeit (Europe/Berlin)** — beim Speichern, in der Anzeige und in der Erinnerung, egal wo Server oder Betrachter stehen.
Warum: Zeitangaben ohne Zeitzone wurden auf dem UTC-Server falsch interpretiert.
Wo: Rückruf-Termin & Zahlungs-Zusage (Kunden + Leads, Agent + Admin), Kalender, Erinnerung. Neu: Hinweis „(Uhrzeit in deutscher Zeit)" am Feld und Sofort-Bestätigung nach dem Speichern. Alt-Termine werden **nicht** automatisch verändert (Korrektur separat, erst nach Freigabe — siehe Phase-0-Bericht: Versatz ist einheitlich, 8 Termine).

**T14 — Suche nach Telefonnummer.**
Was: In der Leads-Seite gibt es jetzt eine Suchleiste; man findet Kunden UND Leads über Nummer, Name, E-Mail oder Referenz — auch wenn die Akte noch nicht übernommen wurde. Ruft eine unbekannte Nummer zurück, tippt die Agentin die Nummer und öffnet die Akte direkt. Ist bereits eine Akte offen, fragt ein Dialog „Aktuelle Akte parken & Rückruf öffnen?" (kein Datenverlust).
Wo: `/agent/leads` (Suche) und `/agent/kunden` (Nummernsuche auch in der geladenen Liste).

**T16 — Reaktivierung bleibt im Fenster.**
Was: Nach „Kunde reaktivieren" bleibt das Fenster offen, zeigt den neuen Status und alle Aktionen sind sofort nutzbar; Klartext-Toast mit neuer Zahlungsfrist. Grundsatz: Ein Statuswechsel lässt einen geöffneten Datensatz nie verschwinden.

**T15 — „Aus meiner Liste entfernen" statt Löschen.**
Was: Neuer Button im Lead-Fenster mit Grund (keine Telefonnummer · Nummer ungültig · kein Interesse · Dublette). Der Lead verlässt die Arbeitsliste, **bleibt aber vollständig gespeichert** (Historie erhalten, Audit). Im Admin unter dem Filter **„Aussortiert"** sichtbar und jederzeit **zurückholbar**. Kein hartes Löschen — Leads werden nie gelöscht.
Zusätzlich (Vorgabe Betreiber): In der Agenten-Warteschlange erscheinen nur noch Leads mit **E-Mail + Name + Telefonnummer**; unvollständige Leads bleiben in der DB und im Admin sichtbar.

**Tests:** `scripts/test-berlin-time.ts` (10/10 PASS unter UTC und Asia/Bangkok). Diagnose & Details in `SYSTEM_DIAGNOSE.md` → „Agent-Tickets #13–#16".

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
