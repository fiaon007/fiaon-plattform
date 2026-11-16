// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WELCHE FIRMEN-KARTE GEHÖRT ZU DIESEM EINGANG? DIE EINE ABFRAGE (E-487 Nachtrag, 16.11.2026)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────────
// Bis E-487 (09.11.) fand globalLeadAufnehmen eine bestehende Karte auch allein über den Firmennamen — drei Menschen mit
// „Selbständig“ im Formular landeten auf EINER Karte. Der Eingang ist seit E-487 repariert; die Regel stand aber weiter an
// vier Stellen: im Eingang (Person, Mail, 9 Ziffern ohne Fantasienummer-Schutz, Firmenname) und dreimal als „Karte zur
// Anfrage“ (Lead-Weg, Takt, Dossier — nur Person und Mail). Eine WhatsApp-Anfrage ohne Mail fand ihre Karte dort nie.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────────
//   · Die Merkmale rein in shared/fiaon-global-lead.ts (leadMerkmale, gleicherLead): Person, Mail, Mobilnummer (letzte
//     9 Ziffern, nie eine Fantasienummer), Firmenname NUR mit Rechtsform und ohne Rollenwort (firmaNameVerbindet).
//   · karteZuMerkmalen = DIE Abfrage dazu, in derselben Rangfolge (Person vor Mail vor Nummer vor Name, bei Gleichstand die
//     älteste Karte). Der Eingang (globalLeadAufnehmen) ruft sie MIT Firmenname.
//   · karteZurAnfrage = die Karte einer vorhandenen Global-Anfrage: erst die gespeicherten Verweise (Lead-Weg, Takt, Gespräch),
//     sonst karteZuMerkmalen OHNE Firmenname. Bewusst NICHT der Verweis im Dossier: der hält fest, was der Eingang damals
//     entschied — vor E-487 auch eine fremde Karte über „Selbständig“; Person, Mail und Nummer sind sicherer.
//
// Nur Lesen. Repo öffentlich: keine Kundendaten im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { leadMerkmale, type LeadMerkmale } from "@shared/fiaon-global-lead";

type Lauf = typeof sqlPool;

/**
 * Die Karte zu den Merkmalen eines Eingangs — null = keine (neue Karte). Leere Merkmale verbinden nie; ohne jedes Merkmal
 * keine Abfrage. Dieselbe Rangfolge wie gleicherLead (shared/fiaon-global-lead.ts).
 */
export async function karteZuMerkmalen(m: LeadMerkmale, lauf: Lauf = sqlPool): Promise<number | null> {
  if (m.personId == null && !m.email && !m.tel9 && !m.firmaName) return null;
  const [f] = (await lauf`
    SELECT id FROM fiaon_firmen_leads
     WHERE (${m.personId}::int IS NOT NULL AND person_id = ${m.personId}::int)
        OR (${m.email} <> '' AND LOWER(TRIM(COALESCE(email, ''))) = ${m.email})
        OR (${m.tel9} <> '' AND RIGHT(regexp_replace(COALESCE(telefon, ''), '[^0-9]', '', 'g'), 9) = ${m.tel9})
        OR (${m.firmaName} <> '' AND LOWER(TRIM(firma)) = ${m.firmaName})
     ORDER BY COALESCE(person_id = ${m.personId}::int, FALSE) DESC,
              (${m.email} <> '' AND LOWER(TRIM(COALESCE(email, ''))) = ${m.email}) DESC,
              (${m.tel9} <> '' AND RIGHT(regexp_replace(COALESCE(telefon, ''), '[^0-9]', '', 'g'), 9) = ${m.tel9}) DESC,
              id ASC
     LIMIT 1`) as any[];
  return f ? Number(f.id) : null;
}

/**
 * Die Karte einer Global-Anfrage: der gespeicherte Verweis (Lead-Weg, Takt, jüngstes Gespräch — nur auf eine Karte, die es noch
 * gibt), sonst über Person, Mail oder Nummer der Anfrage (nie über den Firmennamen). null = keine.
 * `personId` = eine bekannte Person dazu (z. B. aus dem gebuchten Gespräch), falls die Anfrage selbst keine trägt.
 */
export async function karteZurAnfrage(anfrageId: number, lauf: Lauf = sqlPool, opt: { personId?: number | null } = {}): Promise<number | null> {
  const id = Number(anfrageId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [bek] = (await lauf`
    SELECT f.id FROM fiaon_firmen_leads f
     WHERE f.id = COALESCE(
       (SELECT firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${id} AND firma_id IS NOT NULL),
       (SELECT firma_id FROM fiaon_lead_takt WHERE anfrage_id = ${id} AND firma_id IS NOT NULL),
       (SELECT firma_id FROM fiaon_lead_gespraech WHERE anfrage_id = ${id} AND firma_id IS NOT NULL ORDER BY created_at DESC LIMIT 1))`
    .catch(() => [])) as any[];
  if (bek?.id) return Number(bek.id);
  const [a] = (await lauf`SELECT email, telefon, person_id FROM fiaon_anfragen WHERE id = ${id}`.catch(() => [])) as any[];
  if (!a) return null;
  return karteZuMerkmalen(leadMerkmale({ personId: a.person_id ?? opt.personId ?? null, email: a.email, telefon: a.telefon }), lauf).catch(() => null);
}
