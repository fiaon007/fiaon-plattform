import { passwortPasst } from "./lib/fiaon-kunde-session";
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
 * DAS ZUGANGS-GATE IST UNVERÄNDERT (LOGIN_ACCESS_STATUSES bzw.
 * payment_status='paid'). Es wird keine Zahlungsprüfung umgangen.
 */

// ── Paket Y: Login-Freischaltung ─────────────────────────────────────────────
// Der Kunden-Login erlaubt Zugang, sobald der Antrag ABGESCHLOSSEN ist ODER die
// Bestellung bezahlt wurde. Die frühere EXAKT-Prüfung `status === 'completed'`
// war fehleranfällig: `mark-paid` setzt status='payment_completed' und der
// KYC-Upload setzt 'documents_submitted' — beide sperrten den Login aus.
// account_status='suspended' bleibt eine harte Sperre (Admin-Not-Aus).
export const LOGIN_ACCESS_STATUSES = new Set(["completed", "documents_submitted", "payment_completed"]);

/** Fehlerkatalog des Logins — jeder Fall hat einen eigenen, nachverfolgbaren Code. */
export const LOGIN_CODES = {
  BAD_CREDENTIALS: "AUTH-01",
  NO_PASSWORD: "AUTH-02",
  PAYMENT_PENDING: "AUTH-03",
  SUSPENDED: "AUTH-04",
  TECHNICAL: "AUTH-05",
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
 *   +8 nicht als Dublette zusammengeführt
 *   +4 keine Zusatzbestellung (Bonität/SCHUFA ist ein Produkt, kein Konto)
 *   +2 freigeschaltet oder bezahlt
 *   +1 die Zeile, in der das eingegebene Passwort tatsächlich lag
 * Bei Gleichstand gewinnt die zuerst übergebene Zeile — die Familie wird
 * absteigend nach Alter geladen, also die neuere.
 */
export function pickAccountRow(family: any[], matched?: any): any | null {
  if (!family || family.length === 0) return null;
  const score = (r: any) => {
    let s = 0;
    if (!r.merged_into) s += 8;
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
}

export type LoginVerdict = LoginGranted | LoginDenied;

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
      const account = pickAccountRow(rows);
      return {
        granted: false,
        status: 403,
        code: LOGIN_CODES.NO_PASSWORD,
        reason: "kein Passwort hinterlegt",
        ref: account?.ref ?? null,
        error: "Für dieses Konto ist noch kein Passwort gesetzt.",
        hint: "Das liegt an uns, nicht an dir. Setze jetzt ein Passwort — du brauchst dafür nur deinen Namen, deine E-Mail-Adresse und dein Geburtsdatum.",
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
      hint: "Bitte prüfe die Schreibweise. Wenn du dein Passwort nicht mehr weißt, kannst du es neu setzen.",
      action: "Passwort vergessen?",
      actionHref: "/passwort-vergessen",
    };
  }

  // ── Schritt 2: Ab hier ist der Kunde nachgewiesen. Jetzt darf die Meldung
  // konkret werden, ohne Sicherheitsrisiko.
  const account = pickAccountRow(rows, matched) ?? matched;

  // Zugangs-Gate (Paket Y) — UNVERÄNDERT, nur auf die richtige Zeile angewandt.
  const hasAccess = LOGIN_ACCESS_STATUSES.has(account.status) || account.payment_status === "paid";
  if (!hasAccess) {
    const reference = account.payment_reference || null;
    return {
      granted: false,
      status: 403,
      code: LOGIN_CODES.PAYMENT_PENDING,
      reason: `Zahlung offen (${account.payment_status ?? "-"})`,
      ref: account.ref,
      error: "Deine Zahlung ist bei uns noch nicht eingegangen. Sobald sie bestätigt ist, wird dein Zugang automatisch frei.",
      hint: reference
        ? `Schon überwiesen? Überweisungen brauchen 1–2 Bankarbeitstage. Schicke uns deinen Zahlungsbeleg mit der Referenz ${reference} — dann schalten wir dich sofort frei.`
        : "Schon überwiesen? Überweisungen brauchen 1–2 Bankarbeitstage. Schicke uns deinen Zahlungsbeleg — dann schalten wir dich sofort frei.",
      reference,
      action: reference ? "Zahlungsinformationen ansehen" : undefined,
      actionHref: reference ? `/zahlung/${reference}` : undefined,
    };
  }

  // account_status='suspended' bleibt eine harte Sperre (Admin-Not-Aus).
  if (account.account_status === "suspended") {
    return {
      granted: false,
      status: 403,
      code: LOGIN_CODES.SUSPENDED,
      reason: "Konto gesperrt",
      ref: account.ref,
      error: "Dein Konto ist gesperrt.",
      hint: "Bitte kontaktiere den Support — wir klären das mit dir persönlich.",
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
