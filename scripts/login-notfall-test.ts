/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTPLAN — NOTFALL „KUNDEN KÖNNEN SICH NICHT EINLOGGEN" (29.07.2026)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Prüft die Login-Entscheidung OHNE Datenbank und OHNE echte Kundenpasswörter:
 * `decideLogin` ist eine reine Funktion, die Fälle werden als Datensatz-Attrappen
 * gestellt. Die Attrappen sind den echten Zeilen nachgebaut, die Phase 0 im
 * Bestand gefunden hat (u. a. der Fall des Vorgesetzten).
 *
 *   1. Falsches Passwort → neutrale Meldung
 *   2. Unbekannte E-Mail → WORTGLEICHE Meldung (keine Enumeration)
 *   3. Korrektes Passwort, Zahlung offen → klare, hilfreiche Meldung
 *   4. Datenbankfehler → „technisches Problem", nie „ungültige Anmeldedaten"
 *   5. Betroffene Kunden aus Teil B kommen nach dem Fix wieder rein
 *
 * Verwendung:  npx tsx scripts/login-notfall-test.ts
 * Läuft in unter einer Sekunde, verändert nichts.
 */

import { decideLogin, LOGIN_CODES, storedPasswordOf, pickAccountRow, maskEmailForLog } from "../server/fiaon-login-logic";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 64 - title.length))}`);
}

/** Antragszeile-Attrappe mit sinnvollen Standardwerten. */
function row(over: Partial<Record<string, any>> = {}): any {
  return {
    id: Math.floor(Math.random() * 100000),
    ref: "FIAON-TEST-0001",
    type: "private",
    status: "payment_completed",
    account_status: "active",
    payment_status: "paid",
    payment_reference: "FIAON-ABC123",
    merged_into: null,
    email: "kunde@example.com",
    first_name: "Max",
    last_name: "Mustermann",
    pack_key: "ultra",
    approved_limit: 15000,
    password: null,
    utm: null,
    utm_string: null,
    gdpr_deleted_at: null,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("TESTPLAN LOGIN-NOTFALL — reine Entscheidungslogik, keine Datenbank");

// ── 1 & 2: Neutrale Meldung, wortgleich ────────────────────────────────────
section("1+2 · Falsches Passwort und unbekannte E-Mail sind nicht zu unterscheiden");

const wrongPassword = decideLogin([row({ password: "RichtigesPW1" })], "FalschesPW");
const unknownEmail = decideLogin([], "IrgendeinPW");

check("falsches Passwort → abgelehnt", !wrongPassword.granted);
check("unbekannte E-Mail → abgelehnt", !unknownEmail.granted);
if (!wrongPassword.granted && !unknownEmail.granted) {
  check(`falsches Passwort → ${LOGIN_CODES.BAD_CREDENTIALS}`, wrongPassword.code === LOGIN_CODES.BAD_CREDENTIALS, wrongPassword.code);
  check(`unbekannte E-Mail → ${LOGIN_CODES.BAD_CREDENTIALS}`, unknownEmail.code === LOGIN_CODES.BAD_CREDENTIALS, unknownEmail.code);
  check("Meldung WORTGLEICH (keine Enumeration)", wrongPassword.error === unknownEmail.error, `"${wrongPassword.error}" vs "${unknownEmail.error}"`);
  check("Hinweis WORTGLEICH", wrongPassword.hint === unknownEmail.hint);
  check("HTTP-Status identisch (401)", wrongPassword.status === 401 && unknownEmail.status === 401);
  check("verrät NICHT, ob die E-Mail existiert", !/existiert|gefunden|unbekannt|kein Konto/i.test(wrongPassword.error + wrongPassword.hint));
  check("nennt nicht mehr „Ungültige Anmeldedaten\"", !/Ungültige Anmeldedaten/i.test(wrongPassword.error));
  check("nennt den Weg zum Zurücksetzen", wrongPassword.actionHref === "/passwort-vergessen");
}

// ── 3: Korrektes Passwort, Zahlung offen ───────────────────────────────────
section("3 · Korrektes Passwort, Zahlung noch nicht eingegangen");

const paymentOpen = decideLogin(
  [row({ status: "completed", payment_status: "pending_payment", password: "MeinPW123", payment_reference: "FIAON-XY7Q2M" })],
  "MeinPW123",
);
// „completed" ist im Zugangs-Gate — deshalb ein Fall, der wirklich hängt:
const reallyOpen = decideLogin(
  [row({ status: "submitted", payment_status: "pending_payment", password: "MeinPW123", payment_reference: "FIAON-XY7Q2M" })],
  "MeinPW123",
);
check("abgeschlossener Antrag bleibt drin (Gate unverändert)", paymentOpen.granted);
check("Zahlung offen + Antrag nicht abgeschlossen → abgelehnt", !reallyOpen.granted);
if (!reallyOpen.granted) {
  check(`Code ${LOGIN_CODES.PAYMENT_PENDING}`, reallyOpen.code === LOGIN_CODES.PAYMENT_PENDING, reallyOpen.code);
  check("HTTP 403 (nicht 401 — es ist kein Anmeldefehler)", reallyOpen.status === 403);
  check("sagt, dass die Zahlung fehlt", /Zahlung/i.test(reallyOpen.error));
  check("verspricht automatische Freischaltung", /automatisch frei/i.test(reallyOpen.error));
  check("sagt, was der Kunde tun kann, wenn er überwiesen hat", /überwiesen/i.test(reallyOpen.hint ?? ""));
  check("nennt die Zahlungsreferenz", reallyOpen.hint?.includes("FIAON-XY7Q2M") === true);
  check("führt zur Zahlungsseite", reallyOpen.actionHref === "/zahlung/FIAON-XY7Q2M");
  check("ist NICHT die neutrale Meldung", !/stimmt nicht/i.test(reallyOpen.error));
}
// Zahlungsprüfung darf nicht umgangen werden.
check(
  "unbezahlt + nicht abgeschlossen kommt NIE durch",
  !decideLogin([row({ status: "started", payment_status: "pending_payment", password: "PW" })], "PW").granted,
);

// ── 4: Technischer Fehler ──────────────────────────────────────────────────
section("4 · Datenbankfehler wird nicht zum Anmeldefehler");

// Der Endpunkt fängt Ausnahmen der Datenbank-Abfrage und antwortet AUTH-05/503.
// Hier wird geprüft, dass `decideLogin` selbst keine Ausnahme in eine Ablehnung
// verwandelt: kaputte Eingaben dürfen die Entscheidung nicht „umkippen".
let threw = false;
try {
  decideLogin([row({ utm_string: "{kein gültiges JSON" })], "PW");
} catch {
  threw = true;
}
check("defektes utm-JSON wirft nicht", !threw);
// Defektes utm heißt „hier ist kein lesbares Passwort" — nicht „Zugang frei".
// Beim BEZAHLTEN Konto ist das genau der AUTH-02-Fall (der Kunde kann sich
// unmöglich anmelden und braucht den Weg zum Setzen); beim unbezahlten bleibt
// es neutral, damit nichts über die Existenz der Adresse verraten wird.
const brokenUtmPaid = decideLogin([row({ password: null, utm_string: "{kaputt", payment_status: "paid" })], "PW");
check("defektes utm, bezahlt → AUTH-02 (kein Passwort), NIE Zugang", !brokenUtmPaid.granted && brokenUtmPaid.code === LOGIN_CODES.NO_PASSWORD, (brokenUtmPaid as any).code);
const brokenUtmUnpaid = decideLogin([row({ password: null, utm_string: "{kaputt", payment_status: "pending_payment", status: "started" })], "PW");
check("defektes utm, unbezahlt → neutrale Meldung", !brokenUtmUnpaid.granted && brokenUtmUnpaid.code === LOGIN_CODES.BAD_CREDENTIALS, (brokenUtmUnpaid as any).code);
check("AUTH-05 ist ein eigener Code, getrennt von AUTH-01", LOGIN_CODES.TECHNICAL !== LOGIN_CODES.BAD_CREDENTIALS);

// ── 5: Die echten Fälle aus dem Bestand ────────────────────────────────────
section("5 · Die gemessenen Fälle aus dem Bestand kommen wieder rein");

// 5a) DER FALL DES BETREIBERS (Phase 0, H4): Die neueste Zeile ist eine
// Bonitäts-Bestellung ohne Passwort; das Konto ist eine ältere Zeile.
const betreiberFamilie = [
  row({ ref: "FIAON-SCHUFA-MS4MQHUP-6V2G", type: "schufa", status: "submitted", account_status: "pending", payment_status: "pending_payment", password: null, utm_string: null, email: "office@schwarzott-global.com" }),
  row({ ref: "FIAON-SCHUFA-MS4MQHPM-KXWT", type: "schufa", status: "submitted", account_status: "pending", payment_status: "pending_payment", password: null, utm_string: null, email: "office@schwarzott-global.com" }),
  row({ ref: "FIAON-MNPTDV19-QYAJ", status: "completed", account_status: "pending", payment_status: "pending", password: "BetreiberPW1", utm_string: "{}", email: "office@schwarzott-global.com" }),
];
const betreiber = decideLogin(betreiberFamilie, "BetreiberPW1");
check("Vorgesetzter kommt rein", betreiber.granted, betreiber.granted ? "" : `${(betreiber as any).code}: ${(betreiber as any).error}`);
if (betreiber.granted) {
  check("Login liefert das KONTO, nicht die Bonitäts-Bestellung", betreiber.account.ref === "FIAON-MNPTDV19-QYAJ", betreiber.account.ref);
}
// Gegenprobe: Der ALTE Login hätte nur die neueste Zeile gelesen.
check("alter Login hätte genau hier versagt", storedPasswordOf(betreiberFamilie[0]) === null);

// 5b) Gemergte Dublette: Passwort liegt beim Verlierer, Konto ist der Gewinner.
const mergeFamilie = [
  row({ ref: "FIAON-NEU-0002", merged_into: "FIAON-GEWINNER-0001", password: null, payment_status: "pending" }),
  row({ ref: "FIAON-GEWINNER-0001", password: null, payment_status: "paid", status: "payment_completed" }),
  row({ ref: "FIAON-ALT-0003", merged_into: "FIAON-GEWINNER-0001", password: "AltesPW99", payment_status: "pending" }),
];
const merge = decideLogin(mergeFamilie, "AltesPW99");
check("Passwort aus der gemergten Zeile wird akzeptiert", merge.granted);
if (merge.granted) {
  check("Sitzung läuft auf dem Gewinner-Datensatz", merge.account.ref === "FIAON-GEWINNER-0001", merge.account.ref);
}

// 5c) Passwort nur im utm-Altbestand.
const utmOnly = decideLogin([row({ password: null, utm_string: JSON.stringify({ password: "UtmPW123" }) })], "UtmPW123");
check("Altbestand-Passwort aus utm wird akzeptiert", utmOnly.granted);

// 5d) Leerstring gilt nicht als Passwort (sonst käme man mit „" rein).
const emptyPw = decideLogin([row({ password: "" })], "");
check("Leerstring ist KEIN gültiges Passwort", !emptyPw.granted);
const emptyUtm = decideLogin([row({ password: null, utm_string: JSON.stringify({ password: "" }) })], "");
check("leeres utm-Passwort ist KEIN gültiges Passwort", !emptyUtm.granted);

// 5e) Bezahlter Kunde OHNE jedes Passwort (die gemessenen 70) → eigener Weg.
const noPw = decideLogin([row({ password: null, utm_string: null, payment_status: "paid" })], "Versuch123");
check("bezahlt + kein Passwort → abgelehnt", !noPw.granted);
if (!noPw.granted) {
  check(`Code ${LOGIN_CODES.NO_PASSWORD}`, noPw.code === LOGIN_CODES.NO_PASSWORD, noPw.code);
  check("wird NICHT als „falsche Daten\" getarnt", !/stimmt nicht/i.test(noPw.error));
  check("sagt, dass kein Passwort gesetzt ist", /kein Passwort/i.test(noPw.error));
  check("führt direkt zum Setzen", noPw.actionHref === "/passwort-vergessen");
}
// Gegenprobe Sicherheit: unbezahlt + kein Passwort verrät NICHTS.
const noPwUnpaid = decideLogin([row({ password: null, utm_string: null, payment_status: "pending_payment", status: "started" })], "Versuch123");
check("unbezahlt + kein Passwort → neutrale Meldung (keine Enumeration)", !noPwUnpaid.granted && noPwUnpaid.code === LOGIN_CODES.BAD_CREDENTIALS, (noPwUnpaid as any).code);

// 5f) Harte Sperre bleibt hart.
const suspended = decideLogin([row({ account_status: "suspended", password: "PW1234567" })], "PW1234567");
check("gesperrtes Konto bleibt gesperrt", !suspended.granted && suspended.code === LOGIN_CODES.SUSPENDED);

// ── Nebensachen, die im Notfall wichtig sind ───────────────────────────────
section("Protokoll · E-Mail wird maskiert (kein Klartext-PII im Log)");
const masked = maskEmailForLog("office@schwarzott-global.com");
check("maskiert die Adresse", !masked.includes("office@schwarzott-global.com"), masked);
check("bleibt wiedererkennbar", masked.startsWith("of") && masked.endsWith(".com"), masked);
check("leere Eingabe stürzt nicht ab", maskEmailForLog("") === "(leer)");

section("Kontoauflösung · Rangfolge");
check(
  "Konto schlägt Bonitäts-Bestellung",
  pickAccountRow([row({ ref: "FIAON-SCHUFA-X", type: "schufa" }), row({ ref: "FIAON-KONTO-X" })]).ref === "FIAON-KONTO-X",
);
check(
  "nicht-gemergte Zeile schlägt gemergte",
  pickAccountRow([row({ ref: "FIAON-A", merged_into: "FIAON-B" }), row({ ref: "FIAON-B" })]).ref === "FIAON-B",
);
check("leere Familie → null", pickAccountRow([]) === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(70)}`);
console.log(`ERGEBNIS: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) {
  console.log("TESTPLAN NICHT ERFÜLLT.");
  process.exit(1);
}
console.log("Testplan erfüllt.");
