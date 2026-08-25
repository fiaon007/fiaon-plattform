import { sqlPool } from "./db-pool";

// ═══════════════════════════════════════════════════════════════════════════
// DER ANKER: JEDER MENSCH BRAUCHT EINE AKTE, BEVOR MAN MIT IHM ARBEITEN KANN
//
// ── DER BEFUND (25.08.2026, aus einer laufenden Vorführung) ────────────────
// Justin, live vor Florentine und Daniel: „Ich kann den Kunden nicht
// bearbeiten, oder löschen oder irgendwas anderes machen — was hat es denn
// hier wieder?" Auf dem Bildschirm stand rot:
//   „Zu diesem Kunden gibt es keine Bestellung, an der der Verlauf hängen
//    könnte."
//
// Die Meldung war technisch korrekt und fachlich unsinnig. Der Kontaktverlauf
// (fiaon_contact_log) hängt an einer BESTELLUNG (Spalte `ref`, NOT NULL), nicht
// an einem MENSCHEN. Wer noch nie etwas bestellt hat, hat keine Bestellung —
// und an ihm ließ sich deshalb kein Anruf, keine Notiz, kein Ergebnis
// festhalten.
//
// GEMESSEN am 25.08.2026 in der Produktionsdatenbank:
//   2.863 zugewiesene Menschen haben KEINE Bestellung — ausnahmslos Stufe 3.
// Stufe 3 sind die Leads. Also genau die Menschen, die ein Vertriebler den
// ganzen Tag anruft. An keinem einzigen davon war ein Gespräch dokumentierbar.
// Justin dazu: „HÄ? Bei A-Leads muss ich ja genau das machen."
//
// ── WARUM NICHT `ref` NULLBAR MACHEN ──────────────────────────────────────
// Das wäre das saubere Modell — der Verlauf gehört zum Menschen. Aber rund
// dreißig Stellen im Server lesen den Verlauf ÜBER die ref (JOIN, `ref = ANY`,
// `ref IN (SELECT …)`). Ein nullbares Feld hieße: Diese Einträge existieren,
// aber die halbe Anwendung sieht sie nicht. Stiller Datenverlust statt einer
// Fehlermeldung ist die schlechtere Sorte Fehler. Der Umbau gehört gemacht,
// aber geplant und mit angefassten Lesern — nicht mitten in einer Vorführung.
//
// ── WAS STATTDESSEN PASSIERT ──────────────────────────────────────────────
// Der Mensch bekommt eine Akte OHNE Paket: status 'started', current_step 1,
// kein pack_key, kein Betrag. Das ist kein Kunstgriff, sondern ein Zustand,
// den es längst gibt: 70 Akten stehen bereits so in der Datenbank — jemand hat
// die Antragsstrecke geöffnet und nicht zu Ende ausgefüllt. Genau das ist die
// Wahrheit über einen Lead, den wir gerade zum ersten Mal anrufen.
//
// Weil kein Paket und kein Betrag drinsteht, entsteht keine Forderung, keine
// Rechnung und kein Abo. Der Mensch bleibt Lead — er hat jetzt nur einen Ort,
// an dem sein Gespräch stehen kann.
// ═══════════════════════════════════════════════════════════════════════════

function neueRef(): string {
  const zeit = Date.now().toString(36).toUpperCase();
  const zufall = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FIAON-${zeit}-${zufall}`;
}

function neueZahlungsreferenz(ref: string): string {
  const kern = ref.replace(/^FIAON-/, "").split("-")[0] ?? "";
  return `FIAON${kern.slice(0, 6)}`;
}

/**
 * Gibt die ref zurück, an der Schreibvorgänge für diesen Menschen hängen.
 * Existiert keine, wird eine leere Akte angelegt.
 *
 * Rückgabe `null` heißt: Den Menschen gibt es nicht (oder er ist
 * zusammengeführt). Nur dann darf der Aufrufer noch ablehnen.
 */
export async function sorgeFuerAkte(personId: number, agentId: number | null): Promise<string | null> {
  const [da] = (await sqlPool`
    SELECT a.ref FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
     ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  if (da?.ref) return da.ref;

  const [person] = (await sqlPool`
    SELECT id, first_name, last_name, primary_email, primary_phone,
           street, zip, city, birthdate, assigned_agent_id
      FROM fiaon_persons
     WHERE id = ${personId} AND merged_into_person_id IS NULL
  `) as any[];
  if (!person) return null;

  const ref = neueRef();

  // ── DAS WETTRENNEN ──────────────────────────────────────────────────────
  // Zwei Anfragen gleichzeitig (Telefon-Panel und Akte) legten sonst zwei
  // Akten an demselben Menschen an. Deshalb in EINER Anweisung: anlegen, aber
  // nur wenn immer noch keine da ist. Wer verliert, findet danach die des
  // anderen.
  await sqlPool`
    INSERT INTO fiaon_applications (
      ref, type, status, payment_status, current_step, payment_reference,
      first_name, last_name, email, phone, street, zip, city, birthdate,
      person_id, assigned_agent_id, created_at, updated_at
    )
    SELECT ${ref}, 'private', 'started', 'pending', 1, ${neueZahlungsreferenz(ref)},
           ${person.first_name ?? null}, ${person.last_name ?? null},
           ${person.primary_email ?? null}, ${person.primary_phone ?? null},
           ${person.street ?? null}, ${person.zip ?? null}, ${person.city ?? null},
           ${person.birthdate ?? null},
           ${personId}, ${person.assigned_agent_id ?? agentId}, NOW(), NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL)
  `;

  const [jetzt] = (await sqlPool`
    SELECT a.ref FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
     ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  return jetzt?.ref ?? null;
}
