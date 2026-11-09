// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: MARAS MAIL „IHR VORSORGE-ÜBERBLICK“ (E-487 (09.11.2026)) — Absender „FIAON Welcome“ (welcome@) mit Maras Karte
//
// Justin (09.11.2026): „für alle Privatkunden eine Mail, ob wer … mit der passenden Absicherung absichern will, und direkt
// einen Termin beim Partner buchen“. Die Mail wirbt für FIAONs EIGENE Leistung, den Vorsorge-Überblick im Kundenbereich
// (§ 7 Abs. 3 UWG: eigene ähnliche Leistung) — der Partner erscheint erst auf der persönlichen Seite, mit Namen, Rolle und
// der Einwilligung im Wortlaut (server/lib/fiaon-vorsorge.ts). Deshalb steht hier kein Partnername.
//
// ── DAS IST WERBUNG — MIT ALLEM, WAS DAZUGEHÖRT ───────────────────────────
// · Abmeldepflicht (ABMELDEPFLICHT im Motor): persönlicher Abmeldelink im Fuß und One-Click-Kopfzeilen (List-Unsubscribe,
//   List-Unsubscribe-Post) — die Tür in make-webhook.ts lehnt ohne abmelde_url ab.
// · Der Widerspruchs-Hinweis (§ 7 Abs. 3 Nr. 4 UWG: bei JEDER Verwendung) wörtlich als WIDERSPRUCH_SATZ in der Fußnote.
// · Wer die Mail bekommen darf, entscheiden Kreis, Takt und Tür (server/lib/fiaon-vorsorge-einladung.ts) — nie diese Vorlage.
//
// ── WAS SIE SAGEN DARF (vorsorgeMailWand in ./vorsorge-wand.ts, Prüfstand scripts/pruef-vorsorge.ts) ──
// Sie-Form, kurz. Kein „bis zu“, kein Bank-Satz, nichts zu Kredit, Finanzierung oder Chancen („Absicherung erhöht Ihre
// Chancen“ ist genau der Satz, den es nie geben darf — Versicherung nie mit Finanzierung verknüpfen, Plan p2 Risiko 3).
// FIAON empfiehlt nichts (nur Tippgeber, § 34d GewO); das Wort „Berater“ fällt nicht (Wortwand: FIAON berät nicht) — das
// Gespräch führt ein „selbstständiger Partner aus dem FIAON-Partnernetzwerk“. Mara nennt sich digitale Assistentin (KI-VO
// Art. 50). Kein Karten-Block (dessen Satz trägt den Bank-Vorbehalt).
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { signaturHtml, maraKundendienst } from "../../lib/fiaon-signatur";
import { WIDERSPRUCH_SATZ } from "./auskunft-verkauf";

/** Maras Karte im Kundendienst-Rahmen (welcome@, ohne „FIAON Global“) — mit Abstand zum Knopf darunter. */
const MARA_KARTE = maraKundendienst({ name: "Mara Lindner", rolle: "Digitale Assistentin", team: "FIAON Welcome-Team", email: "welcome@fiaon.com" });
const KARTE_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:0 0 14px;">
${signaturHtml(MARA_KARTE)}
</td></tr></table>`;

export const VORSORGE_VORLAGEN: Record<string, MailBaustein> = {
  vorsorge_ueberblick: {
    betreff: "Neu in Ihrem Kundenbereich: Ihr Vorsorge-Überblick",
    preheader: "In wenigen Minuten festhalten, was Ihnen wichtig ist — freiwillig und kostenlos.",
    titel: "Ihr Vorsorge-Überblick",
    marke: "Neu in Ihrem Kundenbereich",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, hier ist Mara, die digitale Assistentin von FIAON.",
      "Zu geordneten Finanzen gehört auch die Frage, was passiert, wenn etwas Unvorhergesehenes geschieht — im Beruf, bei der Gesundheit oder in der Familie.",
      "Dafür gibt es in Ihrem Kundenbereich jetzt Ihren <b>Vorsorge-Überblick</b>. In wenigen Minuten halten Sie fest, welche Themen Ihnen wichtig sind, etwa Altersvorsorge, die Absicherung Ihrer Familie oder eine Krankenzusatzversicherung.",
      "Wenn Sie möchten, buchen Sie dort direkt einen Termin für ein kostenloses Gespräch mit einem selbstständigen Partner aus dem FIAON-Partnernetzwerk. Wer das Gespräch führt, sehen Sie, bevor Sie etwas bestätigen.",
      "Alles ist freiwillig und unverbindlich. FIAON berät nicht zu Versicherungen oder Geldanlagen und empfiehlt keine Produkte — Sie entscheiden in Ruhe. Ihre FIAON-Leistungen hängen davon nicht ab.",
      "Freundliche Grüße",
    ],
    signatur: KARTE_HTML,
    signaturText: "Mara Lindner\nDigitale Assistentin · FIAON Welcome-Team\nwelcome@fiaon.com",
    knopf: { text: "Vorsorge-Überblick öffnen", url: "{{params.link}}" },
    fussnote: `Der Link ist persönlich und 30 Tage gültig — bitte geben Sie ihn nicht weiter. ${WIDERSPRUCH_SATZ} Den Abmeldelink finden Sie ganz unten in dieser E-Mail.`,
    abmeldeUrl: "{{params.abmelde_url}}",
  },
};
