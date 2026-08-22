// ═══════════════════════════════════════════════════════════════════════════
// DER KARTENSTATUS — „Wo ist meine Karte?" (22.08.2026, E-022 / K11)
//
// Die häufigste Kundenfrage überhaupt (Problemregister C16, A1) hatte im
// Datenmodell kein einziges Feld: kein `karten_status`, keine Route, keine
// Seite. Ein Agent am Telefon konnte buchstäblich nichts sagen.
//
// Das hier ist bewusst klein: drei Spalten an der Bestellung, eine feste
// Liste von Zuständen, ein Satz je Zustand für Mitarbeiter UND Kunden. Gepflegt
// wird er von Hand durch die Vertriebsleitung — bis eine Kartenschnittstelle
// (DKB) ihn automatisch setzt. Eine handgepflegte Spalte beantwortet ab Tag
// eins die Frage; eine fehlende beantwortet sie nie.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export const KARTEN_STATUS = [
  { key: "nicht_beantragt", text: "Noch nicht beantragt", fuerKunden: "Ihre Karte wurde noch nicht beantragt — das geschieht nach der vollständigen Aktivierung Ihres Kontos.", reihe: 0 },
  { key: "beantragt", text: "Beantragt", fuerKunden: "Ihre Karte ist beantragt. Die Prüfung durch die Bank dauert in der Regel einige Werktage.", reihe: 1 },
  { key: "in_produktion", text: "In Produktion", fuerKunden: "Ihre Karte wird gerade hergestellt.", reihe: 2 },
  { key: "versandt", text: "Versandt", fuerKunden: "Ihre Karte ist auf dem Postweg zu Ihnen.", reihe: 3 },
  { key: "zugestellt", text: "Zugestellt", fuerKunden: "Ihre Karte wurde zugestellt.", reihe: 4 },
  { key: "zurueck", text: "Zurückgekommen", fuerKunden: "Die Sendung kam zurück — bitte prüfen Sie Ihre Anschrift.", reihe: 5 },
  { key: "abgelehnt", text: "Abgelehnt", fuerKunden: "Die Bank hat den Kartenantrag abgelehnt. Wir besprechen mit Ihnen die nächsten Schritte.", reihe: 6 },
] as const;
export type KartenStatus = (typeof KARTEN_STATUS)[number]["key"];

export function kartenStatusText(key: unknown): string | null {
  const k = KARTEN_STATUS.find((s) => s.key === String(key ?? ""));
  return k ? k.text : null;
}
export function istKartenStatus(key: unknown): key is KartenStatus {
  return KARTEN_STATUS.some((s) => s.key === String(key ?? ""));
}

let geprueft = false;
/** Laufzeitnetz wie bei den Abo-Tabellen: Spalten entstehen beim ersten Gebrauch. */
export async function ensureKartenSpalten(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS karten_status VARCHAR,
    ADD COLUMN IF NOT EXISTS karten_status_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS karten_notiz TEXT
  `;
  geprueft = true;
}

export interface KartenLage {
  ref: string | null;
  status: KartenStatus | null;
  text: string;
  am: string | null;
  notiz: string | null;
}

/** Die Kartenlage eines Menschen — an der jüngsten Paket-Bestellung (nicht an der Bonitätsauskunft). */
export async function kartenLage(personId: number): Promise<KartenLage> {
  await ensureKartenSpalten();
  const [a] = (await sqlPool`
    SELECT a.ref, a.karten_status, a.karten_status_am, a.karten_notiz
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND NOT (COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC
    LIMIT 1
  `) as any[];
  if (!a) return { ref: null, status: null, text: "Keine Paketbestellung — keine Karte.", am: null, notiz: null };
  const status = istKartenStatus(a.karten_status) ? a.karten_status : null;
  return {
    ref: a.ref,
    status,
    text: status ? kartenStatusText(status)! : "Stand unbekannt — noch nie gepflegt.",
    am: a.karten_status_am ?? null,
    notiz: a.karten_notiz ?? null,
  };
}
