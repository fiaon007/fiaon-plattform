// Testplan P5 (Punkt 3): Maskierung. KEIN DB-Zugriff nötig.
// Prüft, dass Secrets, IBANs, E-Mails und Telefonnummern serverseitig
// redigiert werden, BEVOR etwas gespeichert/ausgeliefert wird.
// Aufruf: npx tsx scripts/test-diagnose-masking.ts
import { maskSensitive, maskContext } from "../server/lib/fiaon-diagnostics";

let pass = 0, fail = 0;
function check(name: string, input: string, mustNotContain: string[], mustContain: string[] = []) {
  const out = maskSensitive(input);
  const leaked = mustNotContain.filter((s) => out.includes(s));
  const missing = mustContain.filter((s) => !out.includes(s));
  if (leaked.length === 0 && missing.length === 0) {
    pass++; console.log(`  PASS  ${name}\n        → ${out}`);
  } else {
    fail++; console.log(`  FAIL  ${name}\n        → ${out}`);
    if (leaked.length) console.log(`        LEAK: ${leaked.join(", ")}`);
    if (missing.length) console.log(`        FEHLT: ${missing.join(", ")}`);
  }
}

console.log("── P5 Maskierungs-Test ──────────────────────────────────────");

// Testplan-Kern: Test-Key + Test-IBAN müssen maskiert sein.
check("OpenAI-Key", "Fehler mit key sk-test123456789ABCDEF beim Aufruf", ["sk-test123456789ABCDEF"]);
check("Test-IBAN", "Überweisung an DE89370400440532013000 fehlgeschlagen", ["DE89370400440532013000"]);

// Der reale Vorfall: GitHub-PAT im Klartext in einer Git-Remote-URL.
check("GitHub-PAT in URL", "remote: https://ghp_ABCdef1234567890ABCdef1234567890ABCD@github.com/x/y.git", ["ghp_ABCdef1234567890ABCdef1234567890ABCD"]);

check("Bearer-Token", "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payloadpart.signature", ["payloadpart", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"]);
check("DB-URL mit Passwort", "DATABASE_URL=postgres://user:supersecret@db.host:5432/app", ["supersecret"]);
check("Verbindungs-String inline", "connect postgres://admin:Pa55w0rd@10.0.0.1/db", ["Pa55w0rd"]);
check("Google-Key", "GEMINI: AIzaSyD-1234567890abcdefghijKLMNOPQRSTUV", ["AIzaSyD-1234567890abcdefghijKLMNOPQRSTUV"]);
check("E-Mail", "Mail an max.mustermann@gmail.com fehlgeschlagen", ["max.mustermann@gmail.com"], ["@gmail.com"]);
check("Telefon", "Kunde +49 176 12345652 nicht erreichbar", ["12345652"]);
check("Env-Secret", "SESSION_SECRET: abcXYZ123verysecret", ["abcXYZ123verysecret"]);

// Kontext-Maskierung (verschachtelt)
const ctx = maskContext({ email: "jane.doe@web.de", iban: "DE89 3704 0044 0532 0130 00", note: "ok" });
if (String(ctx.email).includes("jane.doe") || String(ctx.iban).includes("0532")) {
  fail++; console.log("  FAIL  maskContext verschachtelt", ctx);
} else { pass++; console.log("  PASS  maskContext verschachtelt →", JSON.stringify(ctx)); }

// Nicht-sensibles bleibt lesbar
check("Klartext bleibt", "Make-Webhook fuer Event welcome abgelehnt (HTTP 502)", [], ["welcome", "502"]);

console.log("─────────────────────────────────────────────────────────────");
console.log(`Ergebnis: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
