// ═══════════════════════════════════════════════════════════════════════════
// BONI-AMPEL — die Daten dazu (21.09.2026, E-202)
//
// Die Rechnung steht in shared/fiaon-boni-ampel.ts. Hier steht nur, WOHER die
// Zahlen kommen — EINMAL, für die Telefonkartei (viele Karten in einer Abfrage)
// und für die Akte der Mitarbeiter (ein Mensch). Zwei Beschaffungen für
// dieselbe Ampel würden auseinanderlaufen (AGENTS.md: eine Definition, ein Ort).
//
//   bf  der Antrag mit den Finanzangaben (der jüngste, der ein Einkommen trägt;
//       nie die Auskunft-Bestellung)
//   bs  die jüngste fertig gelesene Bonitätsauskunft (fiaon_schufa_analysen)
//   bk  der jüngste fertig ausgewertete Kontoauszug (fiaon_kontoauszug_analysen)
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { boniAmpel, type BoniAmpel, type BoniEingang } from "@shared/fiaon-boni-ampel";

/** Die drei LATERAL-Verbindungen — `p` ist der Alias der Personenzeile. */
export function boniLateralSql(p: string): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(p)) throw new Error(`[BONI] Ungültiger Alias: ${p}`);
  return `
    LEFT JOIN LATERAL (
      SELECT a.income, a.additional_income_amount, a.rent, a.debts, a.housing, a.employment, a.employed_since,
             a.street, a.zip, a.city, a.country,
             COALESCE(a.expenses_food, 0) + COALESCE(a.expenses_transport, 0) + COALESCE(a.expenses_insurance, 0)
               + COALESCE(a.expenses_loans, 0) + COALESCE(a.expenses_subscriptions, 0) + COALESCE(a.expenses_other, 0) AS ausgaben_summe
      FROM fiaon_applications a
      WHERE a.person_id = ${p}.id AND a.merged_into IS NULL
        AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      ORDER BY (a.income IS NOT NULL) DESC, a.created_at DESC
      LIMIT 1) bf ON TRUE
    LEFT JOIN LATERAL (
      SELECT s.ampel, s.summe_offen_cents FROM fiaon_schufa_analysen s
      WHERE s.person_id = ${p}.id AND s.status = 'fertig'
      ORDER BY s.updated_at DESC NULLS LAST, s.id DESC LIMIT 1) bs ON TRUE
    LEFT JOIN LATERAL (
      SELECT k.gehalt_cents, k.einnahmen_cents, k.ausgaben_cents, (k.zeitraum_bis - k.zeitraum_von) AS tage,
             k.dispo_genutzt, k.ruecklastschriften
      FROM fiaon_kontoauszug_analysen k
      WHERE k.person_id = ${p}.id AND k.status = 'fertig'
      ORDER BY k.updated_at DESC NULLS LAST, k.id DESC LIMIT 1) bk ON TRUE`;
}

/** Die Spalten dazu — Präfix boni_, damit nichts mit der übrigen Zeile kollidiert. */
export const BONI_SPALTEN_SQL = `
  bf.income AS boni_einkommen, bf.additional_income_amount AS boni_zusatz, bf.rent AS boni_miete, bf.debts AS boni_schulden,
  bf.housing AS boni_wohnform, bf.employment AS boni_beschaeftigung, bf.employed_since AS boni_seit,
  bf.street AS boni_strasse, bf.zip AS boni_plz, bf.city AS boni_ort, bf.country AS boni_land, bf.ausgaben_summe AS boni_ausgaben,
  bs.ampel AS boni_schufa_ampel, bs.summe_offen_cents AS boni_schufa_offen,
  (bk.gehalt_cents IS NOT NULL OR bk.einnahmen_cents IS NOT NULL) AS boni_konto_da,
  bk.gehalt_cents AS boni_konto_gehalt, bk.einnahmen_cents AS boni_konto_ein, bk.ausgaben_cents AS boni_konto_aus,
  bk.tage AS boni_konto_tage, bk.dispo_genutzt AS boni_konto_dispo, bk.ruecklastschriften AS boni_konto_rl`;

const txt = (v: unknown) => String(v ?? "").trim();
const zahl = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Aus einer Zeile mit den boni_-Spalten (und den Personenfeldern street/zip/
 * city/country als Rückfall) wird die Eingabe der Rechnung.
 */
export function boniEingangAusZeile(z: any, person: { strasse?: unknown; plz?: unknown; ort?: unknown; land?: unknown } = {}): BoniEingang {
  return {
    strasse: !!(txt(z.boni_strasse) || txt(person.strasse)),
    plz: !!(txt(z.boni_plz) || txt(person.plz)),
    ort: !!(txt(z.boni_ort) || txt(person.ort)),
    land: txt(z.boni_land) || txt(person.land) || null,
    wohnform: txt(z.boni_wohnform) || null,
    beschaeftigung: txt(z.boni_beschaeftigung) || null,
    beschaeftigtSeit: txt(z.boni_seit) || null,
    einkommenEuro: zahl(z.boni_einkommen),
    zusatzEinkommenEuro: zahl(z.boni_zusatz),
    mieteEuro: zahl(z.boni_miete),
    ausgabenEuro: zahl(z.boni_ausgaben),
    schuldenEuro: zahl(z.boni_schulden),
    konto: z.boni_konto_da
      ? {
        gehaltCents: zahl(z.boni_konto_gehalt), einnahmenCents: zahl(z.boni_konto_ein), ausgabenCents: zahl(z.boni_konto_aus),
        tage: zahl(z.boni_konto_tage), dispoGenutzt: !!z.boni_konto_dispo, ruecklastschriften: Number(z.boni_konto_rl || 0),
      }
      : null,
    schufa: txt(z.boni_schufa_ampel) ? { ampel: txt(z.boni_schufa_ampel), summeOffenCents: zahl(z.boni_schufa_offen) } : null,
  };
}

/** Die Ampel eines Menschen — für die Akte der Mitarbeiter. */
export async function boniAmpelFuerPerson(personId: number): Promise<BoniAmpel | null> {
  const [z] = (await sqlPool.unsafe(
    `SELECT p.street, p.zip, p.city, p.country, ${BONI_SPALTEN_SQL}
       FROM fiaon_persons p ${boniLateralSql("p")}
      WHERE p.id = $1 AND p.merged_into_person_id IS NULL`,
    [personId],
  )) as any[];
  if (!z) return null;
  return boniAmpel(boniEingangAusZeile(z, { strasse: z.street, plz: z.zip, ort: z.city, land: z.country }));
}
