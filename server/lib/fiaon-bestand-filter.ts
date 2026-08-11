// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSFILTER — die Bedingungen, die überall gleich lauten müssen
//
// Jede Liste im Haus beantwortet dieselben vier Fragen: Ist diese Person echt?
// Ist diese Bestellung noch in Arbeit? Ist die Zahlungsfrist vorbei? Ist noch
// Geld offen? Bisher stand die Antwort an jeder Stelle neu im Text — und lief
// auseinander: „Frist abgelaufen" ergab in der einen Abfrage 0 und in der
// nächsten 186 Fälle (behoben am 06.08.2026, siehe CHANGELOG).
//
// Deshalb stehen die Bedingungen hier EINMAL. Wer eine Liste baut, holt sie
// hier — dann kann eine Definition nicht mehr an einer Stelle geändert werden
// und an neun anderen alt bleiben.
//
// Alle Funktionen liefern SQL-Text und nehmen den Tabellen-Alias entgegen. Sie
// enthalten NIE Werte aus einer Anfrage — nichts davon ist einsetzbar für
// SQL-Injektion, und nichts davon darf je einen Parameter bekommen.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eine echte Person: nicht in eine andere aufgegangen — und kein Testeintrag.
 *
 * Eine zusammengeführte Person bleibt als Wegweiser bestehen (nichts wird
 * gelöscht), darf aber in KEINER Liste, Verteilung oder Automatik mehr
 * auftauchen. Ein Verlierer, der noch angerufen wird, ist genau der Grund,
 * warum dem Zusammenführen niemand traut.
 *
 * Seit dem 09.08.2026 gilt dasselbe für Testeinträge: Zehn Zeilen, die wir
 * selbst beim Ausprobieren des Antragstrichters erzeugt haben, standen als
 * echte Kunden in der Arbeitsliste, in der Verteilung, in der Dublettensuche
 * und in jeder Kennzahl. Die Erkennung steht in
 * server/lib/fiaon-testerkennung.ts und ist über die Einstellungen pflegbar;
 * eine bezahlte Bestellung macht unantastbar.
 */
export function echtePersonSql(p = "p"): string {
  return `${p}.merged_into_person_id IS NULL AND ${p}.ist_test_am IS NULL`;
}

/**
 * Eine Bestellung, an der noch gearbeitet wird: nicht archiviert.
 *
 * Archiviert heißt „gibt es fachlich nicht" (doppelt angelegt, Testeintrag,
 * Widerruf) — nicht „gelöscht". Die Zeile bleibt in der Akte lesbar.
 */
export function nichtArchiviertSql(a = "a"): string {
  return `${a}.archived_at IS NULL`;
}

/**
 * „Zahlungsfrist abgelaufen" — ein ETIKETT, kein Zustand.
 *
 * Zwei Formen, weil beide vorkommen und dasselbe bedeuten:
 *   1. `payment_status = 'expired'` — der Altbestand. Bis zum 08.08.2026 hat ein
 *      stündlicher Lauf diesen Wert geschrieben; seither nicht mehr (Teil 0).
 *      Die vorhandenen Zeilen bleiben unangetastet, also muss die Abfrage sie
 *      weiterhin kennen.
 *   2. Offene Bestellung, deren Frist in der Vergangenheit liegt — die
 *      abgeleitete Form. Sie braucht keinen Schreibvorgang, kann nicht
 *      veralten und schaltet niemanden ab.
 *
 * Wichtig: Dieses Etikett darf Anzeigen färben und Filter speisen. Es darf
 * NIEMALS in einer WHERE-Klausel stehen, die einen Kunden aus einer Arbeits-
 * oder Zahlungsliste entfernt.
 */
export function fristAbgelaufenSql(a = "a"): string {
  return `(${a}.payment_status = 'expired'
      OR (${a}.payment_status IN ('pending_payment', 'claimed_paid')
          AND ${a}.payment_due_date IS NOT NULL
          AND ${a}.payment_due_date < NOW()))`;
}

/**
 * Offene Zahlung: Geld ist verlangt und nicht angekommen.
 *
 * `expired` gehört ausdrücklich dazu. Eine abgelaufene Frist macht aus einer
 * offenen Rechnung keine erledigte — sie macht daraus einen Anruf.
 */
export function offeneZahlungSql(a = "a"): string {
  return `${a}.payment_status IN ('pending_payment', 'claimed_paid', 'expired')`;
}

/**
 * Eine Bestellung, die nicht mehr angefasst werden darf, weil Geld daran hängt:
 * bezahlt oder mit gebuchter Provision. Grundlage der Archiv-Sperre.
 */
export function geldGebundenSql(a = "a"): string {
  return `(${a}.payment_status = 'paid'
      OR EXISTS (SELECT 1 FROM fiaon_commissions k
                  WHERE k.ref = ${a}.ref AND COALESCE(k.status, '') <> 'storniert'))`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER BESTAND EINES MITARBEITERS — EINE DEFINITION
//
// ── DER BEFUND (11.08.2026) ────────────────────────────────────────────────
// Der Vorgesetzte: „In meiner Ansicht steht, dass er so und so viele A-, B-
// und C-Kunden hat — in seiner Ansicht steht aber was ganz anderes!"
//
// Er hatte recht. Für Daniel Stripling, Stufe A, gemessen:
//
//     Team-Zentrale (Vorgesetzter):     58
//     Kundenliste (der Agent selbst):   30
//     Arbeitsliste (was heute ansteht):  4
//
// Drei Zahlen für eine Frage. Die Team-Zentrale zählte roh — mit Gesperrten
// und mit Menschen, die eine Verabredung in der Zukunft haben. Der Agent sah
// nur, was er anfassen darf.
//
// Keine der Zahlen war „falsch". Falsch war, dass sie dieselbe Überschrift
// trugen. Ein Vorgesetzter, der 58 sieht und einen Agenten fragt, warum er
// nur vier abgearbeitet hat, stellt die falsche Frage — und der Agent kann
// sich nicht wehren, weil er die 58 nie gesehen hat.
//
// AGENTS.md sagt es: „Zwei Definitionen für dasselbe Wort sind schlimmer als
// eine fehlende Zahl."
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zählt einen Bestand so, wie der Mitarbeiter ihn sieht.
 *
 * `stufe` ist 1, 2 oder 3. `p` ist das Tabellenkürzel.
 *
 * Ausgeschlossen: Gesperrte (kann man nicht anrufen), Testkunden (gibt es
 * nicht wirklich), Zusammengeführte (sind woanders).
 *
 * NICHT ausgeschlossen: Ruhende und Verabredete. Sie gehören zum Bestand —
 * sie stehen nur heute nicht auf der Arbeitsliste. Dafür gibt es
 * `bestandHeuteSql`.
 */
export function bestandSql(stufe: 1 | 2 | 3, p = "p"): string {
  return `(SELECT COUNT(*)::int FROM fiaon_persons ${p}
    WHERE ${p}.assigned_agent_id = a.id
      AND ${p}.merged_into_person_id IS NULL
      AND ${p}.ist_test_am IS NULL
      AND NOT ${p}.is_blocked
      AND ${p}.priority_tier = ${stufe})`;
}

/**
 * Was davon steht HEUTE an?
 *
 * Ohne Ruhende und ohne Verabredungen in der Zukunft — also genau die Zahl,
 * die der Agent in seiner Arbeitsliste vor sich hat.
 *
 * Beide Zahlen nebeneinander sind die ehrliche Auskunft: „58 im Bestand,
 * davon 4 heute dran." Eine allein ist immer irreführend.
 */
export function bestandHeuteSql(stufe: 1 | 2 | 3, p = "p"): string {
  return `(SELECT COUNT(*)::int FROM fiaon_persons ${p}
    WHERE ${p}.assigned_agent_id = a.id
      AND ${p}.merged_into_person_id IS NULL
      AND ${p}.ist_test_am IS NULL
      AND NOT ${p}.is_blocked
      AND ${p}.ruhe_seit IS NULL
      AND (${p}.follow_up_date IS NULL OR ${p}.follow_up_date <= CURRENT_DATE)
      AND ${p}.priority_tier = ${stufe})`;
}
