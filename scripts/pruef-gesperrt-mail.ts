// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: GESPERRTE MITARBEITER BEKOMMEN KEINE KUNDENDATEN PER MAIL (31.10.2026)
//
// Prüft die Regel (welche Mails Kundendaten tragen), dass eigene Kontomails erlaubt bleiben, dass die Mail bei
// einer nicht erreichbaren Datenbank zurückgehalten wird, und dass beide Türen (make-webhook und Motor) prüfen.
//
//   npx tsx scripts/pruef-gesperrt-mail.ts      (ohne Datenbank, ohne Netz)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";

process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };

const G = await import("../server/lib/fiaon-gesperrt-mail");

// Welche Mails Kundendaten tragen — und welche über das eigene Konto erlaubt bleiben.
for (const e of ["aufgabe_zugewiesen", "agent_callback_reminder", "agent_payment_reminder", "finanzauswertung_mitarbeiter"]) {
  ok(G.KUNDENDATEN_AN_MITARBEITER.has(e), `${e} trägt Kundendaten und geht an kein gesperrtes Konto`);
}
for (const e of ["agent_payout_done", "agent_payout_rejected", "commission_statement_issued", "agent_password_reset", "kuendigung_zustellung", "kuendigung_ausfertigung", "contract_signed", "agent_invite"]) {
  ok(!G.KUNDENDATEN_AN_MITARBEITER.has(e), `${e} bleibt erlaubt (eigenes Konto, keine Kundendaten)`);
}
ok(await G.gesperrtMailGrund("agent_payout_done", "wer@example.com") === null, "Eigene Kontomail: keine Datenbankfrage, nie zurückgehalten");
ok(await G.gesperrtMailGrund("aufgabe_zugewiesen", "  ") === null, "Ohne Adresse: kein Grund (das fängt die Adress-Prüfung davor)");

// Datenbank nicht erreichbar (Port 9): Die Mail mit Kundendaten wird zurückgehalten, nicht blind verschickt.
const grund = await G.gesperrtMailGrund("aufgabe_zugewiesen", "wer@example.com");
ok(grund !== null && /zurückgehalten/.test(grund), `Datenbank weg: Mail mit Kundendaten zurückgehalten („${grund}“)`);

// Beide Türen prüfen — und zwar vor dem Versand.
const mw = fs.readFileSync("server/make-webhook.ts", "utf8");
const mo = fs.readFileSync("server/mail/motor.ts", "utf8");
const tuer1 = mw.indexOf("gesperrtMailGrund(eventType, aufgeloest.email)");
ok(tuer1 > mw.indexOf("const aufgeloest = await adresseBestimmen(payload);") && tuer1 > 0
  && /if \(gesperrt\) \{\s*const erg: MakeVersand = \{ ok: false, grund: gesperrt \};\s*protokollNebenbei\(eventType, payload, erg\);/.test(mw),
  "Tür 1: sendMakeWebhookMitGrund prüft nach der Adresse, gibt nicht ok zurück und protokolliert den Grund");
const direkt = mo.indexOf("export async function mailDirektSenden(");
const tuer2 = mo.indexOf("gesperrtMailGrund(event, an)", direkt);
ok(direkt > 0 && tuer2 > direkt && tuer2 < mo.indexOf("const mail = mailRendern(event, payload);", direkt)
  && /if \(gesperrt\) return \{ ok: false, messageId: null, grund: gesperrt \};/.test(mo),
  "Tür 2: mailDirektSenden prüft vor dem Rendern und Senden (auch die Finanzauswertung, die den Motor direkt ruft)");

console.log(`\n── Ergebnis ──\n  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
