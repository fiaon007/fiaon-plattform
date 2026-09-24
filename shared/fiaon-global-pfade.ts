// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE DEUTSCH-ENGLISCHEN ADRESSPAARE (24.09.2026, E-234)
//
// Justin (24.09.2026): „Mach die englischen Fassungen der Business-Unterseiten."
// Jede deutsche Registerseite hat genau eine englische Schwester unter
// /en/business — mit englischem Pfad (wie /en/pricing neben /preise), damit
// die Adresse selbst ein Suchwort trägt. Diese Tabelle ist die EINE Quelle für
// das Paar: Register, Menü, Sprachumschalter, hreflang, Sitemap und Prüfstand
// lesen sie. Ein deutscher Pfad ohne Eintrag hier hat keine englische Seite.
// Bewusst eine kleine Datei außerhalb des Registers: GlobalNav lädt sie auf jeder
// Seite (der Sprachumschalter), der Inhalt der Seiten bleibt draußen. Die Tabelle
// der SEO-Seiten kennt die Unterseiten im Browser NICHT (der Server trägt sie erst
// ein) — schwesterPfad() taugt dort nicht, diese Paare schon.
// ═══════════════════════════════════════════════════════════════════════════

/** Deutscher Pfad → englischer Pfad. */
export const GLOBAL_EN_PFADE: Record<string, string> = {
  "/business": "/en/business",
  "/business/start": "/en/business/start",
  "/business/auftrag": "/en/business/auftrag",
  "/business/widerrufsbelehrung": "/en/business/widerrufsbelehrung",
  "/business/mustervertrag": "/en/business/mustervertrag",
  // Leistungen
  "/business/us-firmengruendung": "/en/business/us-company-formation",
  "/business/ein-itin": "/en/business/ein-itin",
  "/business/us-geschaeftskonto": "/en/business/us-business-bank-account",
  "/business/firmenkarten-kapital": "/en/business/us-business-credit-cards",
  "/business/us-pflichten": "/en/business/us-compliance",
  "/business/miami": "/en/business/miami",
  // Preise und Ablauf
  "/business/kosten": "/en/business/costs",
  "/business/ablauf": "/en/business/process",
  "/business/paket-finder": "/en/business/package-finder",
  "/business/vergleich": "/en/business/comparison",
  "/business/fragen": "/en/business/faq",
  // Für wen
  "/business/tochtergesellschaft-usa": "/en/business/us-subsidiary",
  "/business/onlinehandel": "/en/business/e-commerce",
  "/business/agenturen-software": "/en/business/agencies-software",
  "/business/bau-immobilien": "/en/business/construction-property",
  "/business/aus-deutschland": "/en/business/from-germany",
  "/business/aus-der-schweiz": "/en/business/from-switzerland",
  "/business/privatpersonen": "/en/business/private-individuals",
  // Bundesstaaten
  "/business/florida": "/en/business/florida",
  "/business/delaware": "/en/business/delaware",
  "/business/wyoming": "/en/business/wyoming",
  // Wissen → Knowledge (nicht „Guides“ — so heißt der Ratgeber der Privatkunden)
  "/business/wissen": "/en/business/knowledge",
  "/business/wissen/us-llc-steuern": "/en/business/knowledge/us-llc-tax",
  "/business/wissen/llc-oder-corporation": "/en/business/knowledge/llc-vs-corporation",
  "/business/wissen/llc-oder-gmbh": "/en/business/knowledge/llc-vs-gmbh",
  "/business/wissen/form-5472": "/en/business/knowledge/form-5472",
  "/business/wissen/bundesstaat-waehlen": "/en/business/knowledge/choosing-a-state",
  "/business/wissen/anbieter-pruefen": "/en/business/knowledge/checking-providers",
  "/business/wissen/llc-gruenden": "/en/business/knowledge/form-a-us-llc",
  "/business/wissen/ein-beantragen": "/en/business/knowledge/applying-for-an-ein",
  "/business/wissen/itin-beantragen": "/en/business/knowledge/applying-for-an-itin",
  "/business/wissen/registered-agent-adresse": "/en/business/knowledge/registered-agent-address",
  "/business/wissen/us-bankkonto-unterlagen": "/en/business/knowledge/us-bank-account-documents",
  "/business/wissen/us-bonitaet-aufbauen": "/en/business/knowledge/building-us-credit",
  "/business/wissen/business-credit-usa": "/en/business/knowledge/us-business-credit",
  "/business/wissen/us-firmenkarte-beantragen": "/en/business/knowledge/us-business-credit-card",
  "/business/wissen/llc-steuererklaerung": "/en/business/knowledge/llc-tax-returns",
  "/business/wissen/tochter-oder-zweigniederlassung": "/en/business/knowledge/subsidiary-or-branch",
  // Standorte
  "/business/partner": "/en/business/partners",
  // Impressum, Datenschutz und Cookie-Einstellungen gibt es nur deutsch — englische Seiten verlinken sie
  // unverändert (mit ?bereich=business, wie GlobalFuss). Sie stehen deshalb NICHT in dieser Tabelle.
};

/** Englischer Pfad → deutscher Pfad. */
export const GLOBAL_DE_PFADE: Record<string, string> = Object.fromEntries(Object.entries(GLOBAL_EN_PFADE).map(([de, en]) => [en, de]));

/**
 * Die englische Adresse zu einer deutschen — mit Anker und Abfrage (#pakete, ?art=privat).
 * Unbekannte Pfade bleiben, wie sie sind (der Prüfstand meldet sie).
 */
export function globalEnPfad(dePfad: string): string {
  const m = dePfad.match(/^([^?#]*)(.*)$/);
  const basis = m?.[1] || "/business";
  const rest = m?.[2] ?? "";
  const en = GLOBAL_EN_PFADE[basis];
  return en ? `${en}${rest}` : dePfad;
}

/** Die deutsche Adresse zu einer englischen — oder null. */
export function globalDePfad(enPfad: string): string | null {
  const basis = enPfad.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return GLOBAL_DE_PFADE[basis] ?? null;
}

/**
 * Die Schwester einer Business-Adresse in der Zielsprache — oder null.
 * Kennt auch „Mein Auftrag" mit Auftragsnummer (/business/auftrag/FIAON-…): die Nummer
 * behält ihre Schreibweise (nur der Schlüssel der Tabelle ist klein geschrieben).
 */
export function globalSchwester(pfad: string, ziel: "de" | "en"): string | null {
  const basis = (pfad.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/");
  const auftrag = basis.match(/^(\/(?:en\/)?business\/auftrag)(\/.+)$/i);
  const kopf = auftrag ? auftrag[1] : basis;
  const rest = auftrag ? auftrag[2] : "";
  const klein = kopf.toLowerCase();
  const istEn = klein.startsWith("/en/");
  if ((ziel === "en") === istEn) return basis;
  const treffer = ziel === "en" ? GLOBAL_EN_PFADE[klein] : GLOBAL_DE_PFADE[klein];
  return treffer ? `${treffer}${rest}` : null;
}
