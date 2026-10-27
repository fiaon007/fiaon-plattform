// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER PERSÖNLICHE ZUGANG: REGELN UND SÄTZE (E-423, 22.10.2026)
//
// Justin: „Der Kunde soll seinen eigenen Zugang bekommen, wo er sich anmeldet —
// mit E-Mail-Authentifizierung, also wir senden einen Code, das fühlt sich
// einfach besser an. Sobald ein Kunde einen Vertrag angenommen hat, soll er
// sein Passwort erstellen."
//
// Diese Datei ist REIN (kein Netz, keine Datenbank, kein node:crypto): Server,
// Seite und Prüfstand lesen dieselben Zahlen und dieselben Sätze. Die Kryptografie
// (Code, Links, Sitzung) steht in server/lib/fiaon-global-konto-regeln.ts, der
// Ablauf mit Datenbank in server/lib/fiaon-global-konto.ts.
//
// ── DIE ZAHLEN ────────────────────────────────────────────────────────────
//   Code: sechs Ziffern, zehn Minuten gültig, höchstens fünf Versuche,
//         „neu senden“ frühestens nach 60 Sekunden, höchstens dreimal.
//   Einladung („Zugang einrichten“): sieben Tage, einmal verwendbar.
//   „Passwort vergessen“: 60 Minuten, einmal verwendbar.
//   Sitzung: 30 Tage, gleitend („auf diesem Gerät angemeldet bleiben“) —
//            sonst bis der Browser schließt, höchstens zwölf Stunden ohne Aktivität.
//   Sperre: fünf falsche Passwörter in 15 Minuten → 15 Minuten Pause, für JEDE
//           Adresse gleich (auch für Adressen ohne Konto — sonst verriete die
//           Sperre, welche Adressen ein Konto haben).
//
// ── KEINE AUFZÄHLBARKEIT ──────────────────────────────────────────────────
// Falsche Adresse und falsches Passwort bekommen DENSELBEN Satz. „Passwort
// vergessen“ antwortet immer gleich. Die Prüfstände vergleichen die Sätze
// buchstabengetreu (scripts/pruef-global-login.ts).
// ═══════════════════════════════════════════════════════════════════════════

export type KontoSprache = "de" | "en";

export const KONTO_CODE_STELLEN = 6;
export const KONTO_CODE_MINUTEN = 10;
export const KONTO_CODE_VERSUCHE = 5;
export const KONTO_CODE_NEU_SEKUNDEN = 60;
export const KONTO_CODE_NEU_HOECHSTENS = 3;
export const KONTO_EINLADUNG_TAGE = 7;
export const KONTO_PASSWORT_LINK_MINUTEN = 60;
export const KONTO_SITZUNG_TAGE = 30;
export const KONTO_SITZUNG_KURZ_STUNDEN = 12;
export const KONTO_FEHLVERSUCHE = 5;
export const KONTO_SPERRE_MINUTEN = 15;
export const KONTO_PASSWORT_MIN = 10;
export const KONTO_PASSWORT_MAX = 200;

/** Die Adressen der Seiten (deutsch / englisch). Der Link der Mail trägt sein Geheimnis im Anker (#e=…), nie in der Abfrage. */
export const KONTO_PFADE = {
  de: { login: "/business/login", vergessen: "/business/passwort-vergessen", zugang: "/business/zugang", konto: "/business/konto", auftrag: "/business/auftrag" },
  en: { login: "/en/business/login", vergessen: "/en/business/forgot-password", zugang: "/en/business/access", konto: "/en/business/account", auftrag: "/en/business/auftrag" },
} as const;

/** Eine Adresse in Kleinbuchstaben — oder null, wenn sie nicht nach einer E-Mail-Adresse aussieht. */
export function kontoEmail(roh: unknown): string | null {
  const e = String(roh ?? "").trim().toLowerCase();
  return e.length >= 5 && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}

/**
 * Wohin es nach der Anmeldung geht — NUR ein Pfad innerhalb der Business-Welt, nie eine fremde Adresse
 * („//boese.example“, „https://…“, „/\\…“ sind kein Ziel). Ohne gültiges Ziel: null (dann entscheidet der Server).
 */
export function kontoWeiterSicher(roh: unknown): string | null {
  const p = String(roh ?? "").trim();
  if (!p || p.length > 300) return null;
  if (!/^\/(en\/)?business\/(auftrag\/[A-Za-z0-9-]{4,60}|konto|account)(\?[A-Za-z0-9=&_-]*)?$/.test(p)) return null;
  return p;
}

// ── PASSWORT ──────────────────────────────────────────────────────────────
export type PasswortFehler = "zu_kurz" | "zu_lang" | "zu_einfach" | "enthaelt_email" | "ungleich";
export interface PasswortUrteil { ok: boolean; fehler: PasswortFehler | null; staerke: 0 | 1 | 2 | 3 | 4 }

/** Die bekanntesten Passwörter — wer eines davon (ohne Ziffern am Ende) wählt, bekommt „zu einfach“. */
const ZU_BEKANNT = new Set([
  "passwort", "password", "qwertz", "qwerty", "asdfgh", "abcdef", "abc123", "123456", "1234567890", "letmein", "willkommen",
  "welcome", "fiaon", "fiaonglobal", "global", "business", "admin", "geheim", "sommer", "winter", "iloveyou", "monkey", "dragon",
]);

/**
 * Prüft ein neues Passwort. Regeln: mindestens zehn Zeichen, nicht nur ein Zeichen oder eine Ziffernfolge, kein bekanntes
 * Passwort, nicht der Name der eigenen Adresse. Die Stärke (0–4) ist nur ein Hinweis für die Anzeige — ab zehn Zeichen ist
 * jedes Passwort, das die Regeln erfüllt, erlaubt.
 */
export function passwortBewerten(pw: unknown, kontext: { email?: string | null; wiederholung?: unknown } = {}): PasswortUrteil {
  const p = String(pw ?? "");
  const klassen = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  let staerke: PasswortUrteil["staerke"] = 0;
  if (p.length >= KONTO_PASSWORT_MIN) staerke = 1;
  if (p.length >= 12 && klassen >= 2) staerke = 2;
  if (p.length >= 14 && klassen >= 3) staerke = 3;
  if ((p.length >= 16 && klassen >= 3) || p.length >= 22) staerke = 4;
  const nein = (fehler: PasswortFehler): PasswortUrteil => ({ ok: false, fehler, staerke: fehler === "ungleich" ? staerke : (Math.min(staerke, 1) as 0 | 1) });
  if (p.length < KONTO_PASSWORT_MIN) return { ok: false, fehler: "zu_kurz", staerke: 0 };
  if (p.length > KONTO_PASSWORT_MAX) return nein("zu_lang");
  const kern = p.toLowerCase().replace(/[\d\W_]+$/g, "").replace(/^[\d\W_]+/g, "");
  if (/^(.)\1+$/.test(p) || /^\d+$/.test(p) || ZU_BEKANNT.has(kern) || ZU_BEKANNT.has(p.toLowerCase())) return nein("zu_einfach");
  const lokal = String(kontext.email ?? "").toLowerCase().split("@")[0] ?? "";
  if (lokal.length >= 4 && p.toLowerCase().includes(lokal)) return nein("enthaelt_email");
  if (kontext.wiederholung !== undefined && String(kontext.wiederholung ?? "") !== p) return nein("ungleich");
  return { ok: true, fehler: null, staerke };
}

// ── DIE SÄTZE DES SERVERS (Sie-Form / britisches Englisch) ─────────────────
// Ein Satz je Ausgang. ANMELDUNG_FALSCH gilt für unbekannte Adresse UND falsches Passwort (keine Aufzählbarkeit).
export const KONTO_SAETZE = {
  de: {
    anmeldungFalsch: "E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie beides — oder legen Sie über „Passwort vergessen“ ein neues fest.",
    gesperrt: `Zu viele Versuche. Bitte warten Sie ${KONTO_SPERRE_MINUTEN} Minuten — oder legen Sie über „Passwort vergessen“ ein neues Passwort fest.`,
    zuViele: "Von Ihrem Anschluss kamen gerade viele Anfragen. Bitte versuchen Sie es in einigen Minuten noch einmal.",
    codeUnterwegs: (maske: string) => `Wir haben Ihnen einen Code an ${maske} geschickt. Er gilt ${KONTO_CODE_MINUTEN} Minuten.`,
    codeFalsch: (rest: number) => rest > 0 ? `Dieser Code stimmt nicht. Sie haben noch ${rest === 1 ? "einen Versuch" : `${rest} Versuche`}.` : "Dieser Code stimmt nicht. Bitte fordern Sie einen neuen an.",
    codeAbgelaufen: "Dieser Code ist abgelaufen. Bitte fordern Sie einen neuen an.",
    codeVerbraucht: "Diese Anmeldung ist nicht mehr gültig. Bitte melden Sie sich noch einmal an.",
    codeNeuWarten: (sek: number) => `Einen neuen Code gibt es in ${sek} Sekunden.`,
    codeNeuGenug: "Wir haben Ihnen schon mehrere Codes geschickt. Bitte melden Sie sich noch einmal an.",
    codeNeuOk: "Ein neuer Code ist unterwegs — diesmal auf einem zweiten Weg. Der vorige gilt nicht mehr. Bitte sehen Sie auch im Ordner „Werbung“ oder „Junk“ nach.",
    vergessenOk: `Wenn zu dieser Adresse ein Zugang gehört, ist ein Link zum Festlegen eines neuen Passworts unterwegs. Er gilt ${KONTO_PASSWORT_LINK_MINUTEN} Minuten. Bitte sehen Sie auch im Spam-Ordner nach.`,
    linkUngueltig: "Dieser Link ist nicht mehr gültig. Fordern Sie über „Passwort vergessen“ einen neuen an — oder melden Sie sich an, wenn Ihr Zugang schon eingerichtet ist.",
    linkAbgelaufen: "Dieser Link ist abgelaufen. Fordern Sie über „Passwort vergessen“ einen neuen an.",
    passwort: {
      zu_kurz: `Bitte wählen Sie mindestens ${KONTO_PASSWORT_MIN} Zeichen.`,
      zu_lang: `Bitte wählen Sie höchstens ${KONTO_PASSWORT_MAX} Zeichen.`,
      zu_einfach: "Dieses Passwort ist zu leicht zu erraten. Bitte wählen Sie ein anderes.",
      enthaelt_email: "Bitte verwenden Sie nicht Ihre E-Mail-Adresse im Passwort.",
      ungleich: "Die beiden Passwörter stimmen nicht überein.",
    } as Record<PasswortFehler, string>,
    sitzungFehlt: "Bitte melden Sie sich an.",
    fremd: "Dieser Bereich gehört zu einem anderen Zugang.",
    technik: "Das hat gerade nicht geklappt — nicht bei Ihnen, sondern bei uns. Bitte versuchen Sie es in einer Minute noch einmal.",
    abgemeldet: "Sie sind abgemeldet.",
  },
  en: {
    anmeldungFalsch: "Email address or password is incorrect. Please check both — or set a new one via “Forgotten password”.",
    gesperrt: `Too many attempts. Please wait ${KONTO_SPERRE_MINUTEN} minutes — or set a new password via “Forgotten password”.`,
    zuViele: "We received many requests from your connection. Please try again in a few minutes.",
    codeUnterwegs: (maske: string) => `We have sent a code to ${maske}. It is valid for ${KONTO_CODE_MINUTEN} minutes.`,
    codeFalsch: (rest: number) => rest > 0 ? `This code is incorrect. You have ${rest === 1 ? "one attempt" : `${rest} attempts`} left.` : "This code is incorrect. Please request a new one.",
    codeAbgelaufen: "This code has expired. Please request a new one.",
    codeVerbraucht: "This sign-in is no longer valid. Please sign in again.",
    codeNeuWarten: (sek: number) => `You can request a new code in ${sek} seconds.`,
    codeNeuGenug: "We have already sent you several codes. Please sign in again.",
    codeNeuOk: "A new code is on its way — this time by a second route. The previous one is no longer valid. Please also check your junk folder.",
    vergessenOk: `If this address belongs to an account, a link to set a new password is on its way. It is valid for ${KONTO_PASSWORT_LINK_MINUTEN} minutes. Please also check your spam folder.`,
    linkUngueltig: "This link is no longer valid. Request a new one via “Forgotten password” — or sign in if your access is already set up.",
    linkAbgelaufen: "This link has expired. Request a new one via “Forgotten password”.",
    passwort: {
      zu_kurz: `Please choose at least ${KONTO_PASSWORT_MIN} characters.`,
      zu_lang: `Please choose at most ${KONTO_PASSWORT_MAX} characters.`,
      zu_einfach: "This password is too easy to guess. Please choose another one.",
      enthaelt_email: "Please do not use your email address in the password.",
      ungleich: "The two passwords do not match.",
    } as Record<PasswortFehler, string>,
    sitzungFehlt: "Please sign in.",
    fremd: "This area belongs to a different account.",
    technik: "That did not work just now — the problem is on our side, not yours. Please try again in a minute.",
    abgemeldet: "You are signed out.",
  },
};

/** „m•••••@beispiel.de“ — die Adresse, wie sie die Code-Seite nennt (nie ganz, nie leer). */
export function emailMaske(email: string, sprache: KontoSprache = "de"): string {
  const [lokal, domain] = String(email || "").split("@");
  if (!lokal || !domain) return sprache === "en" ? "your email address" : "Ihre E-Mail-Adresse";
  return `${lokal.slice(0, 1)}${"•".repeat(Math.max(3, Math.min(8, lokal.length - 1)))}@${domain}`;
}

// ── DIE DREI MAILS DES ZUGANGS ─────────────────────────────────────────────
// Transaktional: Sie gehen IMMER raus — auch an die Kundin eines Firmenangebots hinter der Automatik-Wand
// (server/lib/fiaon-global-firma-post.ts, E-301/E-272), auch an eine Werbesperre und ohne Frequenzbremse
// (server/lib/fiaon-mail-frequenz.ts). Ein Code, der nicht ankommt, ist eine verschlossene Tür.
// 22.10.2026: + der Code zum digitalen Unterschreiben im Portal (fordert der Kunde selbst an — transaktional wie die Anmeldung).
export const KONTO_MAILS = ["global_zugang_einladung", "global_login_code", "global_passwort_neu", "global_unterschrift_code"] as const;
export type KontoMail = typeof KONTO_MAILS[number];
