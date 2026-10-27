// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: FIAON GLOBAL — DER PERSÖNLICHE ZUGANG (3, je deutsch und englisch)
// (E-423, 22.10.2026)
//
// Justin: „Der Kunde soll seinen eigenen Zugang bekommen, wo er sich anmeldet —
// mit E-Mail-Authentifizierung, also wir senden einen Code."
//
//   global_zugang_einladung  „Zugang einrichten“ — nach der Annahme eines Vertrags oder von Hand aus
//                            dem Chefbüro (Raum Global › Kundenzugänge). Link sieben Tage, einmal.
//   global_login_code        der sechsstellige Code — bei jeder Anmeldung, beim Einrichten und nach
//                            einem neuen Passwort. Zehn Minuten gültig.
//   global_passwort_neu      „Passwort vergessen“ — Link 60 Minuten, einmal.
//   global_unterschrift_code der Code zum digitalen Unterschreiben im Portal (22.10.2026), zehn Minuten.
//
// ── TRANSAKTIONAL ─────────────────────────────────────────────────────────
// Diese drei gehen IMMER raus: auch an die Kundin eines Firmenangebots (Automatik-Wand
// E-301/E-272, server/lib/fiaon-global-firma-post.ts — dort ausdrücklich ausgenommen), ohne
// Frequenzbremse (PFLICHTMAILS) und nie über Make. Versand und Protokoll:
// kontoMailSenden in server/lib/fiaon-global-konto.ts. Code und Links stehen NICHT im Klartext im
// Protokoll (fiaon_mail_log) — nur „[verborgen]“.
//
// ── SCHREIBREGELN ─────────────────────────────────────────────────────────
// Wie global-bereich.ts: gesiezt, ein Gedanke je Absatz, Kopf „FIAON Global“, im Fuß der Rollensatz.
// Kein Code im Betreff (er stünde sonst auf jedem Sperrbildschirm). Wer eine Vorlage ändert, ändert
// BEIDE Hälften; scripts/pruef-global-login.ts vergleicht Platzhalter, Knöpfe und Absätze der Paare.
//
// Nutzlast (kontoMailNutzlast): email, sprache, anrede_zeile, kunde, dazu je Ereignis:
//   global_zugang_einladung: einrichten_url, email_anzeige, gueltig_text
//   global_login_code:       login_code, code_anlass
//   global_passwort_neu:     passwort_url
//   global_unterschrift_code: login_code, dokument_titel
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

const KOPF = "FIAON Global";
const RAHMEN_EN = { sprache: "en" } as unknown as Partial<MailBaustein>;

const PAARE: Record<string, Record<"de" | "en", MailBaustein>> = {
  global_zugang_einladung: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr persönlicher Zugang zu FIAON Global",
      preheader: "Legen Sie einmal Ihr Passwort fest — danach melden Sie sich mit E-Mail, Passwort und Code an.",
      titel: "Ihr persönlicher Zugang",
      absaetze: [
        "{{params.anrede_zeile}}, für <b>{{params.kunde}}</b> richten wir Ihnen einen persönlichen Zugang zu FIAON Global ein. Dort sehen Sie jederzeit den Stand Ihres Auftrags, Ihre Verträge und Ihre Dokumente.",
        "So geht es: Sie legen einmal Ihr Passwort fest. Bei jeder Anmeldung schicken wir Ihnen zusätzlich einen Code per E-Mail — so bleibt Ihr Bereich auch dann geschützt, wenn jemand Ihr Passwort kennt.",
        "Der Link gilt sieben Tage und lässt sich einmal verwenden. Sie haben mit FIAON Global nichts vereinbart? Dann ist nichts zu tun.",
      ],
      daten: [
        { label: "Ihre Anmeldung", wert: "{{params.email_anzeige}}" },
        { label: "Link gültig bis", wert: "{{params.gueltig_text}}" },
      ],
      knopf: { text: "Zugang einrichten", url: "{{params.einrichten_url}}" },
    },
    en: {
      ...RAHMEN_EN, bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your personal access to FIAON Global",
      preheader: "Set your password once — after that you sign in with email, password and a code.",
      titel: "Your personal access",
      absaetze: [
        "{{params.anrede_zeile}}, we are setting up a personal access to FIAON Global for <b>{{params.kunde}}</b>. There you can see the status of your order, your contracts and your documents at any time.",
        "This is how it works: you set your password once. Each time you sign in, we also send you a code by email — so your area stays protected even if someone knows your password.",
        "The link is valid for seven days and can be used once. You have not agreed anything with FIAON Global? Then there is nothing to do.",
      ],
      daten: [
        { label: "Your sign-in", wert: "{{params.email_anzeige}}" },
        { label: "Link valid until", wert: "{{params.gueltig_text}}" },
      ],
      knopf: { text: "Set up access", url: "{{params.einrichten_url}}" },
    },
  },

  global_login_code: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr Code für FIAON Global",
      preheader: "Geben Sie den Code auf der Anmeldeseite ein. Er gilt zehn Minuten.",
      titel: "Ihr Code",
      absaetze: [
        "{{params.anrede_zeile}}, hier ist Ihr Code {{params.code_anlass}}. Geben Sie ihn auf der Seite ein, auf der Sie gerade sind.",
        "Der Code gilt zehn Minuten und nur für diese eine Anmeldung. Bitte geben Sie ihn niemandem weiter — auch nicht am Telefon. FIAON fragt nie nach diesem Code.",
        "Sie haben sich gerade nicht angemeldet? Dann kennt jemand Ihr Passwort. Legen Sie bitte über „Passwort vergessen“ ein neues fest.",
      ],
      daten: [
        { label: "Ihr Code", wert: "<b style=\"font-size:26px;letter-spacing:6px\">{{params.login_code}}</b>" },
      ],
    },
    en: {
      ...RAHMEN_EN, bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your code for FIAON Global",
      preheader: "Enter the code on the sign-in page. It is valid for ten minutes.",
      titel: "Your code",
      absaetze: [
        "{{params.anrede_zeile}}, here is your code {{params.code_anlass}}. Enter it on the page you are currently on.",
        "The code is valid for ten minutes and only for this one sign-in. Please do not pass it on to anyone — not on the phone either. FIAON never asks for this code.",
        "You have not just signed in? Then someone knows your password. Please set a new one via “Forgotten password”.",
      ],
      daten: [
        { label: "Your code", wert: "<b style=\"font-size:26px;letter-spacing:6px\">{{params.login_code}}</b>" },
      ],
    },
  },

  // 22.10.2026: der Code zum digitalen Unterschreiben im Portal (shared/fiaon-global-unterschrift.ts).
  global_unterschrift_code: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr Code zum Unterschreiben bei FIAON Global",
      preheader: "Geben Sie den Code im Portal ein, um das Dokument zu unterschreiben. Er gilt zehn Minuten.",
      titel: "Ihr Code zum Unterschreiben",
      absaetze: [
        "{{params.anrede_zeile}}, Sie unterschreiben gerade im Portal: <b>{{params.dokument_titel}}</b>. Mit diesem Code bestätigen Sie Ihre Unterschrift.",
        "Der Code gilt zehn Minuten und nur für dieses eine Dokument. Bitte geben Sie ihn niemandem weiter — auch nicht am Telefon. FIAON fragt nie nach diesem Code.",
        "Sie unterschreiben gerade nichts? Dann ist nichts zu tun — ohne den Code entsteht keine Unterschrift.",
      ],
      daten: [
        { label: "Ihr Code", wert: "<b style=\"font-size:26px;letter-spacing:6px\">{{params.login_code}}</b>" },
      ],
    },
    en: {
      ...RAHMEN_EN, bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your code to sign with FIAON Global",
      preheader: "Enter the code in the portal to sign the document. It is valid for ten minutes.",
      titel: "Your code to sign",
      absaetze: [
        "{{params.anrede_zeile}}, you are signing in the portal: <b>{{params.dokument_titel}}</b>. This code confirms your signature.",
        "The code is valid for ten minutes and only for this one document. Please do not pass it on to anyone — not on the phone either. FIAON never asks for this code.",
        "You are not signing anything right now? Then there is nothing to do — without the code no signature is made.",
      ],
      daten: [
        { label: "Your code", wert: "<b style=\"font-size:26px;letter-spacing:6px\">{{params.login_code}}</b>" },
      ],
    },
  },

  global_passwort_neu: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Neues Passwort für Ihren Zugang zu FIAON Global",
      preheader: "Über den Knopf legen Sie ein neues Passwort fest. Der Link gilt 60 Minuten.",
      titel: "Neues Passwort festlegen",
      absaetze: [
        "{{params.anrede_zeile}}, Sie möchten ein neues Passwort für Ihren Zugang zu FIAON Global festlegen ({{params.kunde}}).",
        "Der Link gilt 60 Minuten und lässt sich einmal verwenden. Nach dem neuen Passwort bestätigen Sie die Anmeldung mit einem Code, den wir Ihnen per E-Mail schicken.",
        "Sie haben das nicht angefordert? Dann ist nichts zu tun — Ihr bisheriges Passwort gilt weiter.",
      ],
      knopf: { text: "Neues Passwort festlegen", url: "{{params.passwort_url}}" },
    },
    en: {
      ...RAHMEN_EN, bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "New password for your access to FIAON Global",
      preheader: "Use the button to set a new password. The link is valid for 60 minutes.",
      titel: "Set a new password",
      absaetze: [
        "{{params.anrede_zeile}}, you would like to set a new password for your access to FIAON Global ({{params.kunde}}).",
        "The link is valid for 60 minutes and can be used once. After the new password you confirm the sign-in with a code that we send you by email.",
        "You did not request this? Then there is nothing to do — your current password remains valid.",
      ],
      knopf: { text: "Set a new password", url: "{{params.passwort_url}}" },
    },
  },
};

const haelfte = (s: "de" | "en"): Record<string, MailBaustein> =>
  Object.fromEntries(Object.entries(PAARE).map(([event, paar]) => [event, paar[s]]));

/** Die deutschen Fassungen — unter dem Ereignisnamen im Verzeichnis des Motors. */
export const GLOBAL_KONTO_VORLAGEN: Record<string, MailBaustein> = haelfte("de");
/** Die englischen Fassungen — der Motor nimmt sie, wenn die Nutzlast `sprache: "en"` trägt. */
export const GLOBAL_KONTO_VORLAGEN_EN: Record<string, MailBaustein> = haelfte("en");
/** Beide Hälften nebeneinander — für den Prüfstand. */
export const GLOBAL_KONTO_PAARE = PAARE;
