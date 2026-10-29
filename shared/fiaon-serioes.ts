// ═══════════════════════════════════════════════════════════════════════════
// „IST FIAON SERIÖS? DIE FAKTEN“ — Adresse, Stand und Kopf der Vertrauensseite (E-445, 28.10.2026; E-459, 29.10.2026)
//
// 28.10.2026 (E-445): Search Console zeigte Suchen wie „fiaon seriös“, „ist das abzocke“ — unter unserem Treffer
// standen fremde Warnlisten und Bewertungen einer ähnlich klingenden Firma. Die Seite legt die prüfbaren Fakten hin.
// 29.10.2026 (E-459): Justin: „Die ganze Seite muss auf das Business-Konzept umgebaut werden, komplett — auch in unserem
// Apple-Design und alles auf Business.“ Firmen und Partner (Steuerberater, Kanzleien, Finanzierer) prüfen FIAON Global,
// bevor sie antworten; die Seite ist ihr Vertrauensanker. Die Adressen bleiben (kein Verlust bei Google).
//
// Diese Datei ist bewusst klein: Sie steht in der SEO-Tabelle, die der Browser auf jeder Seite lädt (Titel, Sprachpaar,
// Sitemap). Den ganzen Seitentext trägt shared/fiaon-serioes-seite.ts — die sichtbare Seite und der Server
// (server/lib/fiaon-global-seo.ts, Vorab-HTML und FAQ) lesen ihn von dort.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";

export const SERIOES_PFAD = { de: "/ist-fiaon-serioes", en: "/en/is-fiaon-legit" } as const;
/** Stand der Fakten auf der Seite (Sitemap lastmod, Vermerk unter dem Text). */
export const SERIOES_STAND = "2026-10-29";
/** Der amtliche Registereintrag — jeder kann ihn ohne Anmeldung öffnen. */
export const COMPANIES_HOUSE_URL = `https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}`;

/** Titel, Beschreibung, Überschrift und Einleitung — eine Quelle für die Seite und die SEO-Tabelle. */
export const SERIOES_KOPF = {
  de: {
    titel: "Ist FIAON seriös? Die Fakten zu FIAON Global",
    beschreibung: "Ist FIAON Global seriös? Die prüfbaren Fakten: FIAON LTD London (Companies House 17318250), Festpreis per Rechnung, Mustervertrag, Kontakt.",
    krume: "Ist FIAON seriös?",
    h1: "Ist FIAON seriös?",
    h1b: "Die Fakten.",
    lead: "Bevor Sie uns Ihre US-Gesellschaft, Ihre Unterlagen und Ihren Weg zum Kapital anvertrauen, wollen Sie wissen, mit wem Sie es zu tun haben – zu Recht. Hier steht alles, was Sie selbst nachprüfen können: wer hinter FIAON Global steht, wohin Sie zahlen, was vor der Beauftragung feststeht, was FIAON ist und was nicht, was mit Ihren Unterlagen geschieht und wie Sie uns erreichen.",
  },
  en: {
    titel: "Is FIAON legit? The facts about FIAON Global",
    beschreibung: "Is FIAON Global legitimate? The verifiable facts: FIAON LTD London (Companies House 17318250), fixed price by invoice, model contract, contact.",
    krume: "Is FIAON legit?",
    h1: "Is FIAON legit?",
    h1b: "The facts.",
    lead: "Before you entrust us with your US company, your documents and your route to capital, you want to know who you are dealing with — rightly so. Here is everything you can check for yourself: who is behind FIAON Global, where you pay, what is fixed before you commission us, what FIAON is and what it is not, what happens to your documents and how to reach us.",
  },
} as const;
