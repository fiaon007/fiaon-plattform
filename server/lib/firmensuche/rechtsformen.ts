// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — RECHTSFORMEN (17.09.2026, E-188)
//
// Schweiz: Die Register liefern die Rechtsform als vierstelligen Code nach
// eCH-0097 („0106"). Die Tabelle unten ist am 17.09.2026 aus dem amtlichen
// Verzeichnis gelesen (https://ld.admin.ch/ech/97/legalforms — dort nur
// Deutsch und Französisch); die englische Spalte folgt den Bezeichnungen der
// Zefix-Oberfläche. Ein unbekannter Code ergibt KEINE Rechtsform — lieber ein
// leeres Feld als ein geratenes.
//
// Deutschland/Österreich: Die Schlüssel-Anbieter liefern Kürzel („gmbh",
// „GES"). Auch dafür steht hier die eine Übersetzung.
// ═══════════════════════════════════════════════════════════════════════════

export interface RechtsformText { de: string; en: string; kurz?: string }

export const RECHTSFORMEN_CH: Record<string, RechtsformText> = {
  "0101": { de: "Einzelunternehmen", en: "Sole proprietorship" },
  "0103": { de: "Kollektivgesellschaft", en: "General partnership", kurz: "KlG" },
  "0104": { de: "Kommanditgesellschaft", en: "Limited partnership", kurz: "KmG" },
  "0105": { de: "Kommanditaktiengesellschaft", en: "Partnership limited by shares", kurz: "KmAG" },
  "0106": { de: "Aktiengesellschaft", en: "Company limited by shares", kurz: "AG" },
  "0107": { de: "Gesellschaft mit beschränkter Haftung", en: "Limited liability company", kurz: "GmbH" },
  "0108": { de: "Genossenschaft", en: "Cooperative" },
  "0109": { de: "Verein", en: "Association" },
  "0110": { de: "Stiftung", en: "Foundation" },
  "0111": { de: "Ausländische Niederlassung im Handelsregister eingetragen", en: "Foreign branch entered in the commercial register" },
  "0113": { de: "Besondere Rechtsform", en: "Special legal form" },
  "0114": { de: "Kommanditgesellschaft für kollektive Kapitalanlagen", en: "Limited partnership for collective investment schemes", kurz: "KmGK" },
  "0115": { de: "Investmentgesellschaft mit variablem Kapital (SICAV)", en: "Investment company with variable capital (SICAV)", kurz: "SICAV" },
  "0116": { de: "Investmentgesellschaft mit festem Kapital (SICAF)", en: "Investment company with fixed capital (SICAF)", kurz: "SICAF" },
  "0117": { de: "Institut des öffentlichen Rechts", en: "Public-law institution" },
  "0118": { de: "Nichtkaufmännische Prokuren", en: "Non-commercial power of attorney" },
  "0119": { de: "Haupt von Gemeinderschaften", en: "Head of joint ownership" },
  "0151": { de: "Schweizerische Zweigniederlassung im Handelsregister eingetragen", en: "Swiss branch entered in the commercial register" },
  "0220": { de: "Verwaltung des Bundes", en: "Federal administration" },
  "0221": { de: "Verwaltung des Kantons", en: "Cantonal administration" },
  "0222": { de: "Verwaltung des Bezirks", en: "District administration" },
  "0223": { de: "Verwaltung der Gemeinde", en: "Municipal administration" },
  "0224": { de: "Öffentlich-rechtliche Körperschaft (Verwaltung)", en: "Public-law corporation (administration)" },
  "0230": { de: "Unternehmen des Bundes", en: "Federal enterprise" },
  "0231": { de: "Unternehmen des Kantons", en: "Cantonal enterprise" },
  "0232": { de: "Unternehmen des Bezirks", en: "District enterprise" },
  "0233": { de: "Unternehmen der Gemeinde", en: "Municipal enterprise" },
  "0234": { de: "Öffentlich-rechtliche Körperschaft (Unternehmen)", en: "Public-law corporation (enterprise)" },
  "0302": { de: "Einfache Gesellschaft", en: "Simple partnership" },
  "0312": { de: "Ausländische Niederlassung nicht im Handelsregister eingetragen", en: "Foreign branch not entered in the commercial register" },
  "0327": { de: "Ausländisches öffentliches Unternehmen", en: "Foreign public enterprise" },
  "0328": { de: "Ausländische öffentliche Verwaltung", en: "Foreign public administration" },
  "0329": { de: "Internationale Organisation", en: "International organisation" },
  "0355": { de: "Übrige Genossenschaften", en: "Other cooperatives" },
  "0361": { de: "Trust", en: "Trust" },
  "0362": { de: "Fonds", en: "Fund" },
  "0441": { de: "Ausländisches Unternehmen", en: "Foreign enterprise" },
};

/** „0106", „106" oder die LINDAS-Adresse „…/legalforms/0106" → Klartext; unbekannt → undefined. */
export function rechtsformCH(code: unknown, sprache: "de" | "en" = "de"): string | undefined {
  const roh = String(code ?? "").trim();
  const m = roh.match(/(\d{3,4})\/?$/);
  if (!m) return undefined;
  const e = RECHTSFORMEN_CH[m[1].padStart(4, "0")];
  return e ? e[sprache] : undefined;
}

// ── Deutschland: die Kürzel von openregister.de ─────────────────────────────
const RECHTSFORMEN_DE: Record<string, RechtsformText> = {
  ag: { de: "Aktiengesellschaft (AG)", en: "Stock corporation (AG)" },
  eg: { de: "Eingetragene Genossenschaft (eG)", en: "Registered cooperative (eG)" },
  ek: { de: "Eingetragener Kaufmann (e.K.)", en: "Registered sole trader (e.K.)" },
  ev: { de: "Eingetragener Verein (e.V.)", en: "Registered association (e.V.)" },
  ewiv: { de: "Europäische wirtschaftliche Interessenvereinigung (EWIV)", en: "European economic interest grouping (EEIG)" },
  gbr: { de: "Gesellschaft bürgerlichen Rechts (GbR)", en: "Civil-law partnership (GbR)" },
  ggmbh: { de: "Gemeinnützige GmbH (gGmbH)", en: "Non-profit limited liability company (gGmbH)" },
  gmbh: { de: "Gesellschaft mit beschränkter Haftung (GmbH)", en: "Limited liability company (GmbH)" },
  kg: { de: "Kommanditgesellschaft (KG)", en: "Limited partnership (KG)" },
  kgaa: { de: "Kommanditgesellschaft auf Aktien (KGaA)", en: "Partnership limited by shares (KGaA)" },
  llp: { de: "Limited Liability Partnership (LLP)", en: "Limited liability partnership (LLP)" },
  ohg: { de: "Offene Handelsgesellschaft (OHG)", en: "General partnership (OHG)" },
  se: { de: "Europäische Gesellschaft (SE)", en: "European company (SE)" },
  ug: { de: "Unternehmergesellschaft (haftungsbeschränkt)", en: "Entrepreneurial company (UG, limited liability)" },
};

/** Kürzel („gmbh") → Klartext. Ein schon ausgeschriebener Wert („GmbH & Co. KG") bleibt, wie er ist. */
export function rechtsformDE(roh: unknown, sprache: "de" | "en" = "de"): string | undefined {
  const s = String(roh ?? "").trim();
  if (!s || /^(unknown|foreign|municipal)$/i.test(s)) return undefined;
  const e = RECHTSFORMEN_DE[s.toLowerCase()];
  return e ? e[sprache] : s.slice(0, 120);
}
