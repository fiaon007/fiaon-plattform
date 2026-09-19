// ═══════════════════════════════════════════════════════════════════════════
// NACHRICHTENLAGE FÜR FIAON GLOBAL (19.09.2026, E-196)
//
// Justin: „Eine Sektion wie ein Banner mit den Schlagzeilen von aktuellen
// POSITIVEN Meldungen — damit stärken wir die Fakten." Entscheidung vom selben
// Tag: nur ECHTE Meldungen, recherchiert, mit Datum und Quelle. Eine erfundene
// oder zugespitzte Schlagzeile wäre irreführende Werbung (§ 5 UWG) — und das
// Gegenteil von „Fakten stärken".
//
// ── PFLEGE ──────────────────────────────────────────────────────────────────
// · Jede Meldung braucht einen Beleg auf der verlinkten Seite (Zahl oder Satz)
//   und eine Quelle, die man ohne Anmeldung öffnen kann — amtliche Stellen
//   zuerst (Federal Reserve, Census Bureau, IRS, FinCEN, SBA, Florida).
// · Überschriften sachlich, höchstens 70 Zeichen, ohne „bis zu", ohne Banknamen,
//   ohne Versprechen an den Leser. Die Wortwand prüft sie mit.
// · `stand` hochsetzen, wenn die Liste neu durchgesehen wurde. Ältere Meldungen
//   als zwölf Monate raus — die Seite blendet sie ohnehin aus (globalSchlagzeilen).
// ═══════════════════════════════════════════════════════════════════════════

export interface GlobalSchlagzeile {
  /** Tag der Meldung, YYYY-MM-DD. */
  datum: string;
  de: string;
  en: string;
  kurzDe: string;
  kurzEn: string;
  /** Wie die Quelle genannt wird, z. B. „Federal Reserve". */
  quelle: string;
  /** Nur wenn die Quelle auf Englisch anders heißt (Europäische Kommission). */
  quelleEn?: string;
  url: string;
}

// Stand 19.09.2026: jede Zahl an der verlinkten Seite nachgeprüft; die Summen
// Januar–August aus den amtlichen Monatswerten (Census, bfs_monthly.csv, Reihe
// BA_BA, nicht saisonbereinigt) selbst nachgerechnet. Bewusst NICHT aufgenommen:
// „Fed senkt Zinsen" (falsch — sie hob am 16.09. an), SBA-Kredite (seit 01.03.2026
// nur für US-Eigentümer), Floridas Steuer auf Gewerbemieten (klingt nach
// „Steuern sparen"), die Zollentscheidung des Supreme Court (überholt).
export const GLOBAL_SCHLAGZEILEN: { stand: string; meldungen: GlobalSchlagzeile[] } = {
  stand: "2026-09-19",
  meldungen: [
  {
    datum: "2026-09-16", quelle: "Federal Reserve",
    de: "Fed: US-Wirtschaft wächst in solidem Tempo, Investitionen robust",
    en: "Fed: US economy expanding at a solid pace, investment robust",
    kurzDe: "In ihrer Erklärung vom 16. September nennt die US-Notenbank das Produktivitätswachstum „stark“ und die Investitionen „robust“. Zugleich hob sie den Leitzins um 0,25 Prozentpunkte auf 3,75 bis 4 Prozent an.",
    kurzEn: "In its statement of 16 September the Federal Reserve called productivity growth strong and capital investment robust. It also raised its policy rate by 0.25 percentage points to 3.75–4%.",
    url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
  },
  {
    datum: "2026-09-11", quelle: "U.S. Census Bureau",
    de: "USA: 13,5 Prozent mehr Gründungsanträge in den ersten acht Monaten",
    en: "US business applications up 13.5% in the first eight months",
    kurzDe: "Von Januar bis August 2026 gingen in den USA 4.345.310 Anträge für neue Unternehmen ein, 13,5 Prozent mehr als im Vorjahreszeitraum. Schon 2025 war mit 5.671.836 Anträgen das stärkste Jahr seit Beginn der Statistik (Summe der amtlichen Monatswerte).",
    kurzEn: "From January to August 2026, 4,345,310 applications for new businesses were filed in the US, 13.5% more than a year earlier. 2025 was already the strongest year on record, with 5,671,836 (sum of the official monthly figures).",
    url: "https://www.census.gov/econ/bfs/current/index.html",
  },
  {
    datum: "2026-09-11", quelle: "U.S. Census Bureau",
    de: "Florida bleibt Spitzenreiter bei US-Gründungsanträgen",
    en: "Florida leads all US states in new business applications",
    kurzDe: "Mit 514.279 Anträgen von Januar bis August 2026, 14,4 Prozent mehr als im Vorjahreszeitraum, liegt Florida vor Kalifornien und Texas. Auch im Gesamtjahr 2025 lag der Bundesstaat mit 647.734 Anträgen vorn.",
    kurzEn: "With 514,279 applications from January to August 2026, up 14.4% on the year before, Florida is ahead of California and Texas. It also ranked first for 2025 as a whole, with 647,734.",
    url: "https://www.census.gov/econ/bfs/current/index.html",
  },
  {
    datum: "2026-09-04", quelle: "U.S. Bureau of Labor Statistics",
    de: "US-Arbeitsmarkt: 162.000 neue Stellen im August",
    en: "US economy adds 162,000 jobs in August",
    kurzDe: "Die Beschäftigung außerhalb der Landwirtschaft stieg im August um 162.000 Stellen, mehr als im Monatsschnitt der vorangegangenen zwölf Monate (31.000). Die Arbeitslosenquote blieb bei 4,1 Prozent.",
    kurzEn: "Non-farm payrolls rose by 162,000 in August, more than the average monthly gain of 31,000 over the prior twelve months. The unemployment rate held at 4.1%.",
    url: "https://www.bls.gov/news.release/archives/empsit_09042026.htm",
  },
  {
    datum: "2026-09-03", quelle: "U.S. Bureau of Labor Statistics",
    de: "US-Produktivität liegt 2,2 Prozent über dem Vorjahr",
    en: "US labour productivity up 2.2% on a year earlier",
    kurzDe: "Die Arbeitsproduktivität der Unternehmen außerhalb der Landwirtschaft lag im zweiten Quartal 2026 um 2,2 Prozent über dem Vorjahresquartal (revidierte Daten).",
    kurzEn: "Labour productivity in the non-farm business sector was 2.2% higher in the second quarter of 2026 than a year earlier (revised data).",
    url: "https://www.bls.gov/news.release/archives/prod2_09032026.htm",
  },
  {
    datum: "2026-08-26", quelle: "U.S. Bureau of Economic Analysis",
    de: "US-Firmengewinne steigen im zweiten Quartal um 400,9 Mrd. Dollar",
    en: "US corporate profits rise by $400.9bn in the second quarter",
    kurzDe: "Die Gewinne aus laufender Produktion stiegen im zweiten Quartal 2026 um 400,9 Mrd. Dollar, nach einem Plus von 74,4 Mrd. Dollar im ersten Quartal (zweite Schätzung).",
    kurzEn: "Profits from current production rose by $400.9bn in the second quarter of 2026, after a $74.4bn increase in the first quarter (second estimate).",
    url: "https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-2nd-quarter-2026",
  },
  {
    datum: "2026-08-11", quelle: "FinCEN",
    de: "FinCEN: US-Firmen dauerhaft von Eigentümer-Meldepflicht befreit",
    en: "FinCEN permanently ends ownership reporting for US companies",
    kurzDe: "Eine endgültige Regel der Behörde des US-Finanzministeriums hebt die Meldung der wirtschaftlich Berechtigten für in den USA gegründete Unternehmen dauerhaft auf. Sie gilt seit dem 14. August 2026.",
    kurzEn: "A final rule from FinCEN, a bureau of the US Treasury, permanently removes beneficial ownership reporting for companies formed in the US. It has applied since 14 August 2026.",
    url: "https://www.fincen.gov/news/news-releases/fincen-permanently-ends-beneficial-ownership-reporting-requirements-millions",
  },
  {
    datum: "2026-07-21", quelle: "U.S. Bureau of Economic Analysis",
    de: "Deutsche Konzerne mit größtem Plus bei US-Direktinvestitionen 2025",
    en: "German firms post largest rise in US direct investment in 2025",
    kurzDe: "Der Bestand ausländischer Direktinvestitionen in den USA wuchs 2025 um 266,0 Mrd. auf 5,86 Billionen Dollar. Den größten Zuwachs verbuchten deutsche Unternehmen mit 49,0 Mrd. Dollar.",
    kurzEn: "The stock of foreign direct investment in the US grew by $266.0bn to $5.86tn in 2025. German multinationals recorded the largest increase, at $49.0bn.",
    url: "https://www.bea.gov/news/2026/direct-investment-country-and-industry-2025",
  },
  {
    datum: "2026-07-01", quelle: "Europäische Kommission", quelleEn: "European Commission",
    de: "EU-US-Handelsrahmen in Kraft: EU streicht Zölle auf US-Industriegüter",
    en: "EU-US framework in force: EU scraps tariffs on US industrial goods",
    kurzDe: "Seit dem 1. Juli 2026 gilt der Handelsrahmen zwischen EU und USA: Die EU erhebt keine Zölle mehr auf US-Industriegüter, die US-Zölle auf die meisten EU-Ausfuhren sind bei 15 Prozent gedeckelt.",
    kurzEn: "The EU-US framework has applied since 1 July 2026: the EU no longer levies tariffs on US industrial goods, and US tariffs on most EU exports are capped at 15%.",
    url: "https://commission.europa.eu/topics/trade/eu-us-trade-deal_en",
  },
  {
    datum: "2026-06-10", quelle: "U.S. Bureau of Economic Analysis",
    de: "Neue Auslandsinvestitionen in den USA 2025 um 49,5 Prozent gestiegen",
    en: "New foreign direct investment in the US up 49.5% in 2025",
    kurzDe: "Ausländische Investoren gaben 2025 laut vorläufigen Daten 232,2 Mrd. Dollar für Kauf, Gründung oder Ausbau von US-Unternehmen aus. Deutschland lag mit 26,7 Mrd. Dollar auf Platz zwei hinter Japan.",
    kurzEn: "Foreign direct investors spent $232.2bn in 2025 to acquire, establish or expand US businesses, according to preliminary data. Germany ranked second at $26.7bn, behind Japan.",
    url: "https://www.bea.gov/news/2026/new-foreign-direct-investment-united-states-2025",
  },
  {
    datum: "2026-04-09", quelle: "U.S. Bureau of Economic Analysis",
    de: "Florida und South Carolina 2025 wachstumsstärkste US-Bundesstaaten",
    en: "Florida and South Carolina lead US state growth in 2025",
    kurzDe: "Die reale Wirtschaftsleistung wuchs 2025 in allen 50 Bundesstaaten, am stärksten in South Carolina und Florida mit jeweils 3,1 Prozent.",
    kurzEn: "Real GDP grew in all 50 states in 2025, fastest in South Carolina and Florida at 3.1% each.",
    url: "https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-4th",
  },
  ],
};

/** Die Meldungen der letzten zwölf Monate, neueste zuerst. */
export function globalSchlagzeilen(heute: Date = new Date()): GlobalSchlagzeile[] {
  const grenze = new Date(heute.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  return GLOBAL_SCHLAGZEILEN.meldungen
    .filter((m) => m.datum >= grenze)
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}

/** „18. September 2026" bzw. „18 September 2026". */
export function schlagzeileDatum(iso: string, sprache: "de" | "en"): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(sprache === "en" ? "en-GB" : "de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
