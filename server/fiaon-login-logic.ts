import { passwortPasst } from "./lib/fiaon-kunde-session";
import { istGlobalPaket } from "@shared/fiaon-pakete";
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KUNDEN-LOGIN — DIE ENTSCHEIDUNG (reine Logik, keine Datenbank, keine Seiteneffekte)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Warum ein eigenes Modul: Am 29.07.2026 kamen zahlende Kunden nicht in ihr
 * Konto und sahen ausnahmslos „Ungültige Anmeldedaten". Die Entscheidung, WARUM
 * ein Login scheitert, war im Endpunkt vergraben und darum nicht prüfbar. Hier
 * liegt sie als reine Funktion — mit Tests (scripts/login-notfall-test.ts), die
 * ohne Datenbank und ohne echte Kundenpasswörter laufen.
 *
 * URSACHE, die dieses Modul behebt: Der Login suchte
 *   WHERE email = ? ORDER BY created_at DESC LIMIT 1
 * — also NUR die jüngste Antragszeile einer E-Mail. Eine Bonitäts-/SCHUFA-
 * Bestellung legt aber bewusst eine EIGENE Antragszeile an (`FIAON-SCHUFA-…`,
 * siehe POST /payment-order) — ohne Passwort, weil sie kein Konto ist. Ab der
 * Sekunde, in der ein Kunde den Bonitäts-Check bestellte, war seine jüngste
 * Zeile diese Bestellzeile: Der Login las sie, fand kein Passwort und antwortete
 * „Ungültige Anmeldedaten". Konto und Passwort waren unversehrt — sie wurden nur
 * nie angesehen. Dasselbe galt für zusammengeführte Dubletten.
 *
 * Jetzt entscheidet die gesamte „Familie" einer E-Mail: Das Passwort darf in
 * JEDER Zeile liegen; über Zugang und Status entscheidet die Zeile, die wirklich
 * das Konto ist.
 *
 * DAS ZUGANGS-GATE (neu am 27.08.2026, Entscheidung des Inhabers):
 * „Entsperre JEDEN Kunden — der Mitarbeiter soll wählen: SPERREN /
 * FREISCHALTEN." Wer ein gültiges Passwort hat, sieht sein eigenes Konto;
 * die EINZIGE Sperre ist account_status='suspended' — gesetzt und gelöst
 * von einem Menschen, mit Grund im Verlauf. Der Zahlungsstatus sperrt NICHT
 * mehr (GEMESSEN: 86 Abweisungen „Zahlung offen" in 30 Tagen, oft bei
 * Kunden, deren Überweisung nur noch nicht verbucht war). Was der Kunde
 * DRINNEN sieht, regelt weiterhin die Stufe — ein Unbezahlter sieht seinen
 * Zahlungsstand samt Verwendungszweck, keine Inhalte.
 */

// ── Die früheren Zugangs-Status ──────────────────────────────────────────────
// Seit dem 27.08.2026 sperrt das TOR nicht mehr nach diesen Status (siehe
// Kopfkommentar). Die Liste lebt weiter für das Scoring in pickAccountRow
// (welche Zeile einer Familie ist „das Konto") und für die Diagnose-Listen.
export const LOGIN_ACCESS_STATUSES = new Set(["completed", "documents_submitted", "payment_completed"]);

/** Fehlerkatalog des Logins — jeder Fall hat einen eigenen, nachverfolgbaren Code. */
export const LOGIN_CODES = {
  BAD_CREDENTIALS: "AUTH-01",
  NO_PASSWORD: "AUTH-02",
  PAYMENT_PENDING: "AUTH-03",
  SUSPENDED: "AUTH-04",
  TECHNICAL: "AUTH-05",
  /** E-188: Firmenkunde von FIAON Global — sein Zugang ist „Mein Auftrag", nicht der Privatkundenbereich. */
  GLOBAL: "AUTH-06",
} as const;

/** Neutrale Meldung für „falsches Passwort" UND „unbekannte E-Mail" — bewusst
 *  identisch, damit fremde E-Mail-Adressen nicht durchprobiert werden können. */
export const LOGIN_NEUTRAL_MESSAGE = "E-Mail-Adresse oder Passwort stimmt nicht.";

/** E-Mail für Protokolle maskieren: „ju•••@sch•••.com". Kein Klartext-PII im Log. */
export function maskEmailForLog(raw: string): string {
  const value = String(raw ?? "").trim();
  const at = value.indexOf("@");
  if (at < 1) return value ? `${value.slice(0, 2)}•••` : "(leer)";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 2)}•••@${domainName.slice(0, 3)}•••${tld}`;
}

/** Zusatzbestellung (Bonität/SCHUFA) — eigenes Produkt, KEIN Konto des Kunden. */
export function isAddonOrderRow(row: any): boolean {
  return String(row?.type ?? "").toLowerCase() === "schufa" || String(row?.ref ?? "").startsWith("FIAON-SCHUFA-");
}

/**
 * Auftrag über FIAON Global (E-188, 17.09.2026) — ein Firmenauftrag mit Einmalpreis,
 * KEIN Konto im Privatkundenbereich. Erkannt wird er, wie überall im Haus, allein am
 * Katalog (pack_key → art "global"); `type` ist bei Global "business" wie bei den
 * eingestellten Business-Abos und taugt deshalb nicht.
 */
export function isGlobalOrderRow(row: any): boolean {
  return istGlobalPaket(row?.pack_key);
}

/**
 * WAS FÜR EIN KUNDE STEHT VOR DER TÜR? (E-188, 17.09.2026)
 *
 * ── DIE LÜCKE ────────────────────────────────────────────────────────────
 * Die Zahlungsbuchung setzt auch für einen Global-Auftrag account_status =
 * 'active'. Der Auftrag vergibt kein Passwort — aber „Passwort vergessen", ein
 * Einmal-Passwort aus „Zugang retten" oder der Anmelde-Link von /app hätten den
 * Firmenkunden in den PRIVATKUNDENBEREICH geführt: Bonität, Raten, Karte,
 * Startgespräch. Nichts davon gehört zu seinem Auftrag. Sein Bereich ist „Mein
 * Auftrag" (signierter Link, kein Passwort).
 *
 * ── DIE REGEL ────────────────────────────────────────────────────────────
 * Gezählt werden die BEZAHLTEN, nicht zusammengeführten Bestellungen der Familie:
 *   nur_global         → alle bezahlten Bestellungen sind Global-Aufträge.
 *                        Kein Privatbereich; Hinweis + Mail mit dem Link.
 *   global_und_privat  → beides bezahlt. Der Privatbereich bleibt, wie er ist —
 *                        und die Kontozeile ist NIE der Global-Auftrag
 *                        (pickAccountRow).
 *   nur_privat         → der Normalfall. Nichts ändert sich.
 *   nichts             → nichts bezahlt. Nichts ändert sich.
 * Eine Familie OHNE Global-Zeile landet immer in „nur_privat" oder „nichts" —
 * für sie ist jede Entscheidung dieses Moduls dieselbe wie vor E-188. Das belegt
 * scripts/pruef-global-querschnitt.ts gegen die Fassung vor dem Umbau.
 */
export type GlobalKontoLage = "nur_global" | "global_und_privat" | "nur_privat" | "nichts";

export function globalKontoLage(family: any[]): GlobalKontoLage {
  const bezahlt = (family ?? []).filter((r) => r && !r.merged_into && r.payment_status === "paid");
  const global = bezahlt.some((r) => isGlobalOrderRow(r));
  const privat = bezahlt.some((r) => !isGlobalOrderRow(r));
  if (global && privat) return "global_und_privat";
  if (global) return "nur_global";
  return privat ? "nur_privat" : "nichts";
}

/** Der Hinweis für den Firmenkunden — dieselben Worte an Login, Passwort-Reset und Anmelde-Link. */
export const GLOBAL_LOGIN_HINWEIS = {
  error: "Für Ihren Firmenauftrag gibt es keine Anmeldung mit Passwort.",
  hint: "Ihr Bereich heißt „Mein Auftrag“ — dort stehen Stand, Vertrag, Rechnung und Ihre Unterlagen. "
    + "Den persönlichen Link dorthin senden wir Ihnen jetzt an die E-Mail-Adresse Ihres Auftrags. Bitte sehen Sie auch im Spam-Ordner nach.",
} as const;

/**
 * Das hinterlegte Passwort einer Antragszeile. Historisch an zwei Orten:
 * Spalte `password` (heute) und `utm->>'password'` (Altbestand). Leerstrings
 * gelten als „nicht gesetzt". Der Wert selbst wird NICHT verändert (kein trim),
 * damit der Vergleich exakt so bleibt wie bisher.
 */
export function storedPasswordOf(row: any): string | null {
  const direct = row?.password;
  if (typeof direct === "string" && direct.trim() !== "") return direct;
  const rawUtm = row?.utm_string ?? row?.utm;
  if (!rawUtm) return null;
  try {
    const obj = typeof rawUtm === "string" ? JSON.parse(rawUtm) : rawUtm;
    const fromUtm = obj?.password;
    if (typeof fromUtm === "string" && fromUtm.trim() !== "") return fromUtm;
  } catch {
    /* defektes utm-JSON ist kein Anmeldefehler — die Zeile hat einfach kein Passwort */
  }
  return null;
}

/**
 * Die Zeile, die das KONTO des Kunden ist — sie entscheidet über Zugang, Status
 * und die Daten im Portal. Rangfolge (höher = besser):
 *  +16 nicht als Dublette zusammengeführt
 *   +8 kein Auftrag über FIAON Global (E-188: ein Firmenauftrag ist nie das Privatkonto)
 *   +4 keine Zusatzbestellung (Bonität/SCHUFA ist ein Produkt, kein Konto)
 *   +2 freigeschaltet oder bezahlt
 *   +1 die Zeile, in der das eingegebene Passwort tatsächlich lag
 * Bei Gleichstand gewinnt die zuerst übergebene Zeile — die Familie wird
 * absteigend nach Alter geladen, also die neuere.
 *
 * E-188 (17.09.2026): Bis dahin hieß die Leiter 8/4/2/1. Wer ein Privat-Abo UND ein
 * Global-Paket bezahlt hatte, bekam als „Konto" die jüngere der beiden Zeilen — also
 * womöglich den Firmenauftrag, und der Privatbereich zeigte dann dessen Daten. Die
 * neue Stufe steht ZWISCHEN „zusammengeführt" und „Zusatzbestellung"; für jede
 * Familie ohne Global-Zeile bekommt jede Zeile dieselben acht Punkte dazu — die
 * Reihenfolge und damit die gewählte Zeile bleiben exakt dieselben.
 */
export function pickAccountRow(family: any[], matched?: any): any | null {
  if (!family || family.length === 0) return null;
  const score = (r: any) => {
    let s = 0;
    if (!r.merged_into) s += 16;
    if (!isGlobalOrderRow(r)) s += 8;
    if (!isAddonOrderRow(r)) s += 4;
    if (r.payment_status === "paid" || LOGIN_ACCESS_STATUSES.has(r.status)) s += 2;
    if (matched && r.ref === matched.ref) s += 1;
    return s;
  };
  return family.reduce((best, r) => (score(r) > score(best) ? r : best), family[0]);
}

/** Erfolgreiche Anmeldung. */
export interface LoginGranted {
  granted: true;
  account: any;
  matched: any;
}

/** Abgelehnte Anmeldung — mit Grund, Code und Handlungsweg für den Kunden. */
export interface LoginDenied {
  granted: false;
  status: number;
  code: string;
  /** Interner Klartext-Grund fürs Protokoll (nicht für den Kunden). */
  reason: string;
  ref: string | null;
  error: string;
  hint?: string;
  action?: string;
  actionHref?: string;
  reference?: string | null;
  /** E-188: true = Firmenkunde von FIAON Global — der Aufrufer schickt den Link zu „Mein Auftrag" (globalZugangSenden). */
  globalZugang?: boolean;
}

export type LoginVerdict = LoginGranted | LoginDenied;

/** Die Abweisung des Firmenkunden — kein Fehler des Kunden, sondern der Wegweiser zu seinem Bereich. */
function globalVerdict(rows: any[], reason: string): LoginDenied {
  const auftrag = rows.find((r) => !r.merged_into && r.payment_status === "paid" && isGlobalOrderRow(r));
  return {
    granted: false,
    status: 403,
    code: LOGIN_CODES.GLOBAL,
    reason,
    ref: auftrag?.ref ?? null,
    error: GLOBAL_LOGIN_HINWEIS.error,
    hint: GLOBAL_LOGIN_HINWEIS.hint,
    globalZugang: true,
  };
}

/**
 * Die Entscheidung. `family` sind alle Antragszeilen zur eingegebenen E-Mail
 * (inklusive der Gewinner von Merges), absteigend nach Alter.
 *
 * Reihenfolge ist bewusst: ZUERST das Passwort. Alles Konkrete (Zahlung offen,
 * Konto gesperrt) wird erst NACH korrektem Passwort verraten — dann ist es
 * sicher und maximal hilfreich.
 */
export function decideLogin(family: any[], password: string): LoginVerdict {
  const rows = family ?? [];

  // ── Schritt 1: Passwort prüfen. Es darf in JEDER Zeile der Familie liegen.
  // Seit 22.08.2026: Hash (scrypt$…) ODER Altbestand im Klartext — der Altbestand
  // wird beim nächsten erfolgreichen Login nachgehasht (fiaon-antrag.ts).
  const matched = rows.find((r) => {
    const stored = storedPasswordOf(r);
    return stored !== null && passwortPasst(stored, password);
  });

  if (!matched) {
    const familyHasPassword = rows.some((r) => storedPasswordOf(r) !== null);
    const familyIsPaid = rows.some((r) => r.payment_status === "paid");

    // Sonderfall, der bisher als „falsche Daten" getarnt war: Es gibt einen
    // Datensatz, aber NIRGENDS in der Familie ein Passwort — weil ein
    // Zwischenspeichern es geleert hat oder ein Merge es nicht übertrug. Der
    // Kunde kann sich unmöglich anmelden; er muss den Weg zum Setzen erfahren.
    //
    // ABWÄGUNG: Diese Auskunft verrät, dass ein bezahltes Konto existiert.
    // Ohne sie bleiben genau die Kunden dauerhaft ausgesperrt, deren Passwort
    // UNS verloren gegangen ist. Darum eng begrenzt: nur für BEZAHLTE Konten
    // ohne jedes Passwort. Für alle anderen bleibt die Meldung neutral.
    if (rows.length > 0 && !familyHasPassword && familyIsPaid) {
      // E-188: Der bezahlte Firmenkunde hat NIE ein Passwort — „Passwort jetzt setzen" führte ihn in den
      // Privatkunden-Reset, den er ohne Geburtsdatum nicht besteht. Dieselbe Abwägung wie unten (die Auskunft
      // verrät ein bezahltes Konto), derselbe enge Fall — nur mit dem Weg, der für ihn stimmt.
      if (globalKontoLage(rows) === "nur_global") return globalVerdict(rows, "FIAON Global: kein Passwort, Zugang ist „Mein Auftrag“");
      const account = pickAccountRow(rows);
      return {
        granted: false,
        status: 403,
        code: LOGIN_CODES.NO_PASSWORD,
        reason: "kein Passwort hinterlegt",
        ref: account?.ref ?? null,
        error: "Für dieses Konto ist noch kein Passwort gesetzt.",
        hint: "Das liegt an uns, nicht an Ihnen. Setzen Sie jetzt ein Passwort — Sie brauchen dafür nur Ihren Namen, Ihre E-Mail-Adresse und Ihr Geburtsdatum.",
        action: "Passwort jetzt setzen",
        actionHref: "/passwort-vergessen",
      };
    }

    return {
      granted: false,
      status: 401,
      code: LOGIN_CODES.BAD_CREDENTIALS,
      reason: rows.length === 0 ? "kein Datensatz zur E-Mail" : "Passwort stimmt nicht",
      ref: null,
      error: LOGIN_NEUTRAL_MESSAGE,
      hint: "Bitte prüfen Sie die Schreibweise. Wenn Sie Ihr Passwort nicht mehr wissen, können Sie es neu setzen.",
      action: "Passwort vergessen?",
      actionHref: "/passwort-vergessen",
    };
  }

  // ── Schritt 2: Ab hier ist der Kunde nachgewiesen. Jetzt darf die Meldung
  // konkret werden, ohne Sicherheitsrisiko.
  // E-188: Sind die EINZIGEN bezahlten Bestellungen Aufträge über FIAON Global, gibt es keinen
  // Privatbereich zu öffnen — auch nicht mit einem Passwort, das „Zugang retten" vergeben hat.
  if (globalKontoLage(rows) === "nur_global") return globalVerdict(rows, "FIAON Global: Passwort stimmt, Zugang ist „Mein Auftrag“");
  const account = pickAccountRow(rows, matched) ?? matched;

  // ── HIER STAND DAS ZAHLUNGS-TOR (entfernt am 27.08.2026) ────────────────
  // Es wies mit „Deine Zahlung ist noch nicht eingegangen" ab (AUTH-03) —
  // 86-mal in 30 Tagen, darunter Kunden, deren Überweisung nur noch nicht im
  // Bankbuch verbucht war. Entscheidung des Inhabers: Wer sein Passwort
  // kennt, sieht sein eigenes Konto — dort steht sein Zahlungsstand samt
  // Verwendungszweck. Gesperrt wird nur noch von Hand:

  // account_status='suspended' — die EINE Sperre, gesetzt vom Mitarbeiter.
  if (account.account_status === "suspended") {
    return {
      granted: false,
      status: 403,
      code: LOGIN_CODES.SUSPENDED,
      reason: "Konto gesperrt",
      ref: account.ref,
      error: "Ihr Konto ist gesperrt.",
      hint: "Bitte wenden Sie sich an den Support — wir klären das persönlich mit Ihnen.",
    };
  }

  return { granted: true, account, matched };
}

/** Geburtsdatum aus der DB (Date oder String) als YYYY-MM-DD. */
export function birthdateKey(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : null;
}
