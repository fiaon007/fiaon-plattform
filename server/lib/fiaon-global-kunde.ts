// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL-KUNDE — EIN MERKMAL AN DER PERSON (02.10.2026, E-272)
//
// Justin (02.10.2026, Fall Hildbrand): „nehme ihn bitte komplett aus den
// Workflows … Er soll Global bleiben, also keine unnötigen Mails.“
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Bis heute wusste jeder Privat-Ablauf nur JE BESTELLZEILE, ob etwas Global
// ist (produktkategorieSql, fiaon-produktkategorie.ts). Ein Merkmal „dieser
// MENSCH gehört zu FIAON Global“ gab es nicht. William Hildbrand (Person
// 13411) hatte ein offenes Individualangebot über FIAON Global (E-268) und
// daneben einen alten, nie bezahlten Privatantrag. Für Rückholung, WA-Zentrale,
// Mara und die Anrufliste war er damit ein Privat-Interessent, den man zum
// Privatantrag führt. Am Morgen des 02.10. wurde er von Hand herausgenommen
// (Sperre, Archiv, Mara aus). Diese Regel macht daraus Code.
//
// Dahinter steht die Trennung der zwei Welten (E-192): Wer mit FIAON Global
// spricht, bekommt die Business-Welt — Kanzlei-Ton, feste Ansprechperson,
// Einmalpreis — und NIE die Werbung, Mahnungen und Verkaufsgespräche der
// Privatlinie (Bonität, Raten, Kreditkarte).
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Global-Kunde ist eine Person, die
//   (1) ein Individualangebot hat (fiaon_global_angebote.person_id) — in
//       JEDEM Status, auch abgelaufen oder zurückgezogen, ODER
//   (2) eine lebende Bestellzeile der Kategorie „global“ hat,
// UND
//   (3) KEIN bezahltes Stufenpaket (Kategorie „konto“, payment_status paid).
// Wer (3) hat, ist „gemischt“: ein zahlender Privatkunde, der zusätzlich
// Global kauft. Für ihn bleibt alles wie bisher — Raten, Erinnerungen,
// Betreuer. Die Regel ist dann FALSCH, kein Privat-Ablauf ändert sich.
//
// ── DIE ENTSCHEIDUNGEN DARIN ───────────────────────────────────────────────
// · Jeder Angebotsstatus zählt. Ein Angebot wird nie gelöscht; Zurückziehen
//   und Ablauf sind Status (fiaon-global-angebot.ts). Wer „zurückgezogen“
//   ausnähme, holte den Kunden in der Minute zwischen Zurückziehen und neuem
//   Angebot zurück in die Privat-Abläufe (WA-Zentrale alle 5 Minuten) — genau
//   die Gefahr vom 02.10. Und ein Nein zum Angebot macht aus einem Global-
//   Gesprächspartner keinen Privat-Interessenten.
// · „Lebende“ Zeile heißt dasselbe wie in der Einstufung (antragBasisSql in
//   tier.ts): kein Entwurf, nicht zusammengeführt (merged_into), nicht
//   superseded, nicht DSGVO-gelöscht, nicht archiviert — außer bezahlt.
//   Stornierte und erstattete Global-Zeilen zählen: Auch wer storniert hat,
//   kam über FIAON Global. Hier ausgeschrieben statt importiert, weil tier.ts
//   diese Regel liest (ein Import im Kreis).
// · Nur ein bezahltes STUFENPAKET macht „gemischt“, keine bezahlte
//   Bonitätsauskunft. Die Auskunft ist ein Einzelkauf ohne Raten, ohne Abo,
//   ohne Betreuung; die Firmen-Auskunft gehört sogar zur Business-Welt. Zählte
//   sie, holte ein Global-Kunde, der für seinen Kapitalantrag eine Auskunft
//   kauft, sich damit alle Verkaufsabläufe der Privatlinie zurück (Mara zum
//   Privatantrag, WA-Zentrale, Rückholung). Ihre LEISTUNG (Bericht, Unterlagen)
//   ist kein Werbeweg und darf diese Regel nicht fragen.
// · „Bezahlt“ ist nur paid. claimed_paid ist eine Behauptung ohne Geld; kommt
//   das Geld, wird die Zeile paid und der Kunde von selbst „gemischt“.
// · Zusammengeführte Personen: Beim Zusammenführen wandern die Bestellzeilen
//   zum Gewinner (fiaon-person-merge.ts), das Angebot NICHT — seine person_id
//   bleibt am Verlierer stehen. Deshalb zählt ein Angebot für seine Person UND
//   für die, in der sie aufgegangen ist (Ketten bis zwei Stufen, wie in
//   fiaon-mail-frequenz.ts gemessen).
// · Die Auftragsakte (fiaon_global_auftraege) wird NICHT gelesen. Jeder
//   Auftrag über /business/start und jede Annahme eines Angebots legt ZUERST
//   die Bestellzeile an (Loopback, gleiche ref) — gemessen am 02.10.: alle vier
//   Akten haben ihre Zeile mit person_id. Und die Akte entsteht nur zur
//   Laufzeit (ensureGlobalTabelle), keine Migration legt sie an.
// · Ein Angebot OHNE person_id (im Chefbüro ohne Person angelegt) erfasst die
//   Regel erst mit der Annahme: Dann trägt die Annahme die Person der neuen
//   Bestellzeile nach (fiaon-global-angebot.ts) und die Zeile zählt nach (2).
//
// ── DIE TABELLE IST DA, BEVOR DIE REGEL LÄUFT ──────────────────────────────
// fiaon_global_angebote legt Migration 087 an (db/migrations/087_global_
// individualangebot.sql, auf der Produktion angewandt am 01.10.2026 14:04).
// Migrationen laufen bei JEDEM Start vor dem Server (package.json, Skript
// „start“: erst db:migrate:sql, dann node), der Läufer verweigert jedes DROP TABLE.
// Für eine frische Datenbank, in der 087 gescheitert wäre, gibt es
// globalKundeBereit(): eine Katalogabfrage einmal je Prozess, legt die
// Tabelle nur an, wenn sie fehlt — danach kostet sie nichts mehr.
//
// ── SO WIRD SIE BENUTZT ────────────────────────────────────────────────────
//   tagged template:  AND NOT ${sqlPool.unsafe(globalKundeSql("p.id"))}
//   unsafe-Text:      `… AND NOT ${globalKundeSql("a.person_id")} …`
//   einzeln:          if (await istGlobalKunde(personId)) return;
// Der Ausdruck ist NIE NULL (COALESCE am Ende) — „AND NOT …“ verliert keine
// Zeile durch eine NULL-Person. Er läuft je Zeile über den Index
// fiaon_apps_person_idx; die Angebote liest Postgres als Hash einmal je
// Abfrage. „Ist diese Bestellzeile Global?“ bleibt produktkategorieSql(alias)
// = 'global' — dafür gibt es hier bewusst keinen zweiten Ausdruck.
// ═══════════════════════════════════════════════════════════════════════════
import { produktkategorieSql } from "./fiaon-produktkategorie";

/** Ein Lauf: der Pool oder eine Transaktion. Nur als Typ — die Datei lädt die Datenbank erst beim Gebrauch. */
type Lauf = typeof import("./db-pool").sqlPool;

/**
 * Der Personen-Ausdruck wird in SQL eingesetzt. Er kommt aus dem Code, NIE aus
 * einer Eingabe: erlaubt sind Spalten („p.id“, „a.person_id“), Parameter
 * („$1“, „$1::int“), Zahlen und COALESCE(…)-Ketten daraus.
 */
function personAusdruck(ausdruck: string): string {
  const a = String(ausdruck ?? "").trim();
  if (!/^[A-Za-z0-9_.$:(), ]+$/.test(a) || /--|\/\*/.test(a)) {
    throw new Error(`[GLOBAL-KUNDE] Ungültiger Personen-Ausdruck: ${a}`);
  }
  // Eine Spalte OHNE Tabellen-Kürzel („id“, „person_id“) bände in der inneren
  // Abfrage an gk272_a statt an die äußere Person — die Regel liefe still falsch.
  // Deshalb nur „alias.spalte“, Parameter ($n) oder ein NULL-Wert.
  if (!/[.$]/.test(a) && !/^NULL(::int)?$/i.test(a)) {
    throw new Error(`[GLOBAL-KUNDE] Personen-Ausdruck braucht ein Tabellen-Kürzel (z. B. „p.id“): ${a}`);
  }
  return a;
}

/**
 * E-272 (02.10.2026): Ist die Person ein Global-Kunde? Als SQL-Wahrheitsausdruck,
 * geklammert, nie NULL. `personIdAusdruck` ist der Ausdruck für die Personen-ID
 * in der umgebenden Abfrage (z. B. `p.id`). Regel und Gründe: Kopf dieser Datei.
 *
 * Die Aliase tragen das Präfix gk272_, damit sie keinen Alias der umgebenden
 * Abfrage verdecken. Die Kategorie steht genau EINMAL im Ausdruck (eine
 * Zeilenabfrage, zwei BOOL_OR) — aus derselben Katalog-Liste wie überall.
 */
export function globalKundeSql(personIdAusdruck: string): string {
  const x = personAusdruck(personIdAusdruck);
  return `(COALESCE((
    SELECT (COALESCE(BOOL_OR(gk272_z.kat = 'global'), FALSE)
            OR (${x}) IN (
              SELECT gk272_k.person_id FROM (
                SELECT UNNEST(ARRAY[gk272_g.person_id, gk272_p1.merged_into_person_id, gk272_p2.merged_into_person_id]) AS person_id
                  FROM fiaon_global_angebote gk272_g
                  LEFT JOIN fiaon_persons gk272_p1 ON gk272_p1.id = gk272_g.person_id
                  LEFT JOIN fiaon_persons gk272_p2 ON gk272_p2.id = gk272_p1.merged_into_person_id
                 WHERE gk272_g.person_id IS NOT NULL) gk272_k
               WHERE gk272_k.person_id IS NOT NULL))
           AND NOT COALESCE(BOOL_OR(gk272_z.kat = 'konto' AND gk272_z.bezahlt), FALSE)
      FROM (
        SELECT ${produktkategorieSql("gk272_a")} AS kat,
               gk272_a.payment_status = 'paid' AS bezahlt
          FROM fiaon_applications gk272_a
         WHERE gk272_a.person_id = (${x})
           AND NOT gk272_a.ist_entwurf
           AND gk272_a.merged_into IS NULL
           AND gk272_a.payment_status <> 'superseded'
           AND gk272_a.gdpr_deleted_at IS NULL
           AND (gk272_a.archived_at IS NULL OR gk272_a.payment_status = 'paid')
      ) gk272_z
  ), FALSE))`;
}

/**
 * E-272 (02.10.2026): Sorgt dafür, dass fiaon_global_angebote existiert, bevor
 * globalKundeSql sie liest. Einmal je Prozess eine Katalogabfrage (to_regclass,
 * sperrt nichts); nur wenn die Tabelle fehlt, legt ensureAngebotTabellen sie an
 * — mit derselben DDL wie Migration 087. Wer globalKundeSql in eine eigene
 * Abfrage einbettet, ruft vorher `await globalKundeBereit()`.
 */
let bereit: Promise<void> | null = null;
export function globalKundeBereit(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const { sqlPool } = await import("./db-pool");
      const [z] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') IS NOT NULL AS da`) as any[];
      if (z?.da === true) return;
      console.warn("[GLOBAL-KUNDE] fiaon_global_angebote fehlt (Migration 087 nicht gelaufen?) — wird jetzt angelegt");
      const { ensureAngebotTabellen } = await import("./fiaon-global-angebot");
      await ensureAngebotTabellen();
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * E-272 (02.10.2026): Ist diese Person ein Global-Kunde? Dieselbe Regel wie
 * globalKundeSql, für Stellen, die eine einzelne Person prüfen. `lauf` = der
 * Pool oder die laufende Transaktion des Aufrufers.
 */
export async function istGlobalKunde(personId: number, lauf?: Lauf): Promise<boolean> {
  const id = Number(personId);
  if (!Number.isInteger(id) || id <= 0) return false;
  await globalKundeBereit();
  const l = lauf ?? (await import("./db-pool")).sqlPool;
  const [z] = (await l.unsafe(`SELECT ${globalKundeSql("$1::int")} AS ja`, [id])) as any[];
  return z?.ja === true;
}
