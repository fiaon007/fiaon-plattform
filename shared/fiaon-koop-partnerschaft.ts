// ═══════════════════════════════════════════════════════════════════════════
// FIAON — DIE KARTE „IHRE PARTNERSCHAFT“ IM KUNDENPORTAL (Register E-507, 12.11.2026)
//
// Ein Kunde von FIAON Global, der zugleich Empfehlungspartner ist (Empfehlungs-Vereinbarung, Modell „empfehlung“ in
// shared/fiaon-global-angebot-koop-modelle.ts), sieht in „Mein Auftrag“ eine Karte: angenommen → Link auf seine Partnerseite,
// offen → Link zur Vereinbarung. Eigene kleine Datei, damit das Portal nicht die Vertragstexte der Kooperationen mitlädt.
// Rein — der Server füllt die Daten in server/lib/fiaon-koop-lieferung.ts (koopPartnerschaftFuerPortal).
// ═══════════════════════════════════════════════════════════════════════════
import { KOOP_PROVISION_MONATE } from "./fiaon-koop-empfehlung";

/** stand „aktiv“ = Vereinbarung angenommen (Link auf die Partnerseite), „offen“ = Vereinbarung liegt zur Annahme bereit. */
export interface KoopPartnerschaftPortal { stand: "aktiv" | "offen"; link: string; prozent: number; empfehlungen: number }
/** „30 %“ bzw. „27,5 %“ */
export const koopProzentText = (v: number): string => `${String(v).replace(".", ",")} %`;
export const KOOP_PARTNERSCHAFT_PORTAL = {
  de: {
    auge: "Ihre Partnerschaft",
    aktivTitel: (n: number) => (n === 0 ? "Ihre Partnerseite ist bereit" : n === 1 ? "1 Empfehlung auf Ihrer Partnerseite" : `${n} Empfehlungen auf Ihrer Partnerseite`),
    aktivText: (prozent: string) => `Empfehlungen eintragen, Stand sehen, Provision verfolgen — ${prozent} von allem, was Ihre Empfehlung in den ersten ${KOOP_PROVISION_MONATE} Monaten an uns zahlt.`,
    aktivKnopf: "Zur Partnerseite",
    offenTitel: "Ihre Empfehlungs-Vereinbarung liegt bereit",
    offenText: (prozent: string) => `Sie möchten uns jemanden empfehlen? Mit Ihrer Annahme öffnet sich Ihre persönliche Partnerseite — ${prozent} von allem, was Ihre Empfehlung in den ersten ${KOOP_PROVISION_MONATE} Monaten an uns zahlt.`,
    offenKnopf: "Vereinbarung ansehen",
  },
  en: {
    auge: "Your partnership",
    aktivTitel: (n: number) => (n === 0 ? "Your partner page is ready" : n === 1 ? "1 referral on your partner page" : `${n} referrals on your partner page`),
    aktivText: (prozent: string) => `Add referrals, see their status and follow your commission — ${prozent} of everything your referral pays us in the first ${KOOP_PROVISION_MONATE} months. The partner page is in German.`,
    aktivKnopf: "Open partner page",
    offenTitel: "Your referral agreement is ready",
    offenText: (prozent: string) => `Would you like to refer someone to us? Once you accept, your personal partner page opens — ${prozent} of everything your referral pays us in the first ${KOOP_PROVISION_MONATE} months. The agreement is in German.`,
    offenKnopf: "View agreement",
  },
} as const;
