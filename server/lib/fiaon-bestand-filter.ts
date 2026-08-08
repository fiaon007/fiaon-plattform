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
 * Eine echte Person: nicht in eine andere aufgegangen.
 *
 * Eine zusammengeführte Person bleibt als Wegweiser bestehen (nichts wird
 * gelöscht), darf aber in KEINER Liste, Verteilung oder Automatik mehr
 * auftauchen. Ein Verlierer, der noch angerufen wird, ist genau der Grund,
 * warum dem Zusammenführen niemand traut.
 */
export function echtePersonSql(p = "p"): string {
  return `${p}.merged_into_person_id IS NULL`;
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
