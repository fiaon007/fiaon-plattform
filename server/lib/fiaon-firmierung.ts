// ═══════════════════════════════════════════════════════════════════════════
// DIE FIRMIERUNG — an einer Stelle, pflegbar ohne Programmierer
//
// ── WARUM DAS AUS DEM CODE HERAUS MUSS ─────────────────────────────────────
// Firmenname, Anschrift, Company No. und der Steuerhinweis standen hart in
// `fiaon-html-pdf.ts`. Beim Umzug in ein anderes Büro müsste jemand eine
// TypeScript-Datei ändern, den Server neu bauen und ausrollen — für eine
// Hausnummer.
//
// Schlimmer ist der Steuerhinweis: Er gehört auf jede Provisionsabrechnung,
// sein Wortlaut kommt vom Steuerberater, und er ändert sich, wenn sich die
// Rechtslage ändert. Ein Text, den nur ein Entwickler ändern kann, wird nicht
// geändert — er bleibt falsch stehen.
//
// ── DIE VORGABEN BLEIBEN IM CODE ───────────────────────────────────────────
// Nicht als Bequemlichkeit, sondern als Sicherung: Wäre die Anschrift nur in
// der Datenbank, hätte ein leeres Feld eine Abrechnung ohne Absender zur
// Folge. Die Vorgabe ist die letzte Verteidigungslinie.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

export interface Firmierung {
  name: string;
  companyNo: string;
  strasse: string;
  ort: string;
  land: string;
  vatId: string | null;
  /** Der Steuerhinweis für Provisionsabrechnungen. Wortlaut vom Steuerberater. */
  steuerhinweis: string;
  /** Der Hinweis auf das Gutschriftverfahren und den Selbstständigen-Status. */
  gutschriftHinweis: string;
}

/** Die Vorgaben — Stand 11.08.2026. */
export const FIRMIERUNG_VORGABE: Firmierung = {
  name: "FIAON LTD",
  companyNo: "17318250",
  strasse: "128 City Road",
  ort: "London, EC1V 2NX",
  land: "United Kingdom",
  vatId: null,
  steuerhinweis:
    "Diese Abrechnung ist eine Gutschrift im Sinne des § 14 Abs. 2 Satz 2 UStG. "
    + "Die Umsatzsteuer ist vom Empfänger selbst zu erklären, soweit er umsatzsteuerpflichtig "
    + "ist. Bei Leistungen aus dem EU-Ausland gilt das Reverse-Charge-Verfahren "
    + "(Art. 196 MwStSystRL). Der Empfänger ist für die zutreffende steuerliche Behandlung "
    + "seiner Einkünfte selbst verantwortlich.",
  gutschriftHinweis:
    "Der Empfänger ist selbstständig tätig und kein Arbeitnehmer der FIAON LTD. Es besteht "
    + "kein Anspruch auf Urlaub, Lohnfortzahlung oder Sozialleistungen. Die Abrechnung erfolgt "
    + "im Gutschriftverfahren: Die FIAON LTD stellt die Abrechnung im Namen des Empfängers aus; "
    + "der Empfänger kann ihr binnen 14 Tagen widersprechen.",
};

const SCHLUESSEL = "firmierung";

/**
 * Die Firmierung lesen.
 *
 * Fällt einzeln auf die Vorgabe zurück, nicht als Ganzes: Wer nur die
 * Anschrift gepflegt hat, soll nicht auch den Steuerhinweis verlieren.
 */
export async function firmierung(): Promise<Firmierung> {
  const [r] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = ${SCHLUESSEL}
  `.catch(() => [] as any[])) as any[];
  if (!r?.value) return FIRMIERUNG_VORGABE;
  try {
    const g = JSON.parse(String(r.value)) as Partial<Firmierung>;
    const sauber = (v: unknown, vorgabe: string) => {
      const s = String(v ?? "").trim();
      return s.length > 0 ? s : vorgabe;
    };
    return {
      name: sauber(g.name, FIRMIERUNG_VORGABE.name),
      companyNo: sauber(g.companyNo, FIRMIERUNG_VORGABE.companyNo),
      strasse: sauber(g.strasse, FIRMIERUNG_VORGABE.strasse),
      ort: sauber(g.ort, FIRMIERUNG_VORGABE.ort),
      land: sauber(g.land, FIRMIERUNG_VORGABE.land),
      vatId: String(g.vatId ?? "").trim() || null,
      steuerhinweis: sauber(g.steuerhinweis, FIRMIERUNG_VORGABE.steuerhinweis),
      gutschriftHinweis: sauber(g.gutschriftHinweis, FIRMIERUNG_VORGABE.gutschriftHinweis),
    };
  } catch {
    return FIRMIERUNG_VORGABE;
  }
}

/** Die Firmierung setzen. */
export async function firmierungSetzen(g: Partial<Firmierung>): Promise<Firmierung> {
  const jetzt = await firmierung();
  const neu: Firmierung = { ...jetzt, ...g };
  await sqlPool`
    INSERT INTO fiaon_settings (key, value) VALUES (${SCHLUESSEL}, ${JSON.stringify(neu)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  return neu;
}

/** Eine Zeile für die Fußzeile. */
export function fussZeile(f: Firmierung): string {
  return [f.name, `Company No. ${f.companyNo}`, `${f.strasse}, ${f.ort}, ${f.land}`]
    .filter(Boolean).join(" · ");
}

/** Der Absenderblock für den Kopf eines Dokuments. */
export function absenderBlock(f: Firmierung): string {
  return [f.name, `Company No. ${f.companyNo}`, f.strasse, f.ort, f.land,
    f.vatId ? `VAT-ID: ${f.vatId}` : ""].filter(Boolean).join("<br/>");
}
