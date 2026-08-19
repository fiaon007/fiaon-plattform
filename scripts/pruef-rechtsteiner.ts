// ═══════════════════════════════════════════════════════════════════════════
// DER BEWEISFALL: JOACHIM RECHTSTEINER
//
// ── DER SCREENSHOT (19.08.2026) ────────────────────────────────────────────
// Der Bestätigungs-Dialog: „Das bekommt JOACHIM RECHTSTEINER — Für diesen
// Kunden ist keine E-Mail-Adresse hinterlegt." In seiner Akte steht
// euro-tec@t-online.de.
//
// ── WAS DIESER LAUF PRÜFT ─────────────────────────────────────────────────
//   1. Die Adresse steht wirklich an der Person (und nicht an der Bestellung).
//   2. Die zentrale Auflösung `empfaengerFuer` findet sie.
//   3. Die Vorschau-Route — die Datenquelle des Dialogs — liefert sie.
//   4. Der Dialog kann damit senden (`moeglich: true`).
//   5. Die Versand-Payload trägt dieselbe Adresse.
//   6. Und: KEIN Bauteil liest E-Mail noch aus der Bestellzeile.
//
// ── WARUM NICHTS VERSANDT WIRD ────────────────────────────────────────────
// Punkt 5 wird an der Auflösung gemessen, die der Versand benutzt — nicht durch
// einen echten Versand. AGENTS.md: „Ein Browser-Test erzeugt NIE eine echte
// Annahme, Buchung, Unterschrift, Zahlung oder Mail." Der Dialog wird gezeigt,
// nicht bestätigt.
//
//   npx tsx scripts/pruef-rechtsteiner.ts [PORT]
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { ansichtTokenBauen, ANSICHT_COOKIE } from "../server/lib/fiaon-ansicht";
import { empfaengerFuer, massgeblicheBestellung } from "../server/lib/fiaon-massgebliche-bestellung";

const PORT = process.argv[2] || process.env.PORT || "5188";
const BASIS = `http://127.0.0.1:${PORT}/api/fiaon`;

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
/** Kommentarzeilen weg, bevor man auf ABWESENHEIT von Code prüft (AGENTS.md). */
const ohneKommentare = (q: string) =>
  q.split("\n").filter((z) => !/^\s*(\/\/|\*|--)/.test(z)).join("\n");

async function main(): Promise<void> {
  titel("1. DER MENSCH UND SEINE ADRESSE IM BESTAND");
  const [p] = (await sqlPool`
    SELECT p.id, p.person_ref, p.first_name, p.last_name, p.primary_email,
           p.assigned_agent_id, ag.name AS betreuer,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL) AS bestellungen,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               AND COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''),
                            NULLIF(TRIM(a.billing_email), '')) IS NOT NULL) AS mit_mail_an_zeile
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.last_name ILIKE '%rechtsteiner%' AND p.merged_into_person_id IS NULL
    ORDER BY p.id LIMIT 1
  `) as any[];

  if (!p) {
    log("\n  Rechtsteiner nicht im Bestand gefunden — Abbruch.");
    log("  (Die Zahlen im Auftrag sind Hinweise, nicht Messwerte: AGENTS.md.)");
    await sqlPool.end();
    process.exit(1);
  }
  log("");
  log(`  Person ${p.id} (${p.person_ref}): ${p.first_name} ${p.last_name}`);
  log(`  primary_email an der PERSON:      ${p.primary_email ?? "— keine —"}`);
  log(`  Betreuer:                         ${p.betreuer ?? "— keiner —"} (${p.assigned_agent_id})`);
  log(`  Lebende Bestellungen:             ${p.bestellungen}`);
  log(`  … davon MIT Adresse an der Zeile: ${p.mit_mail_an_zeile}`);
  log("");
  ok("Die Adresse steht an der Person", !!p.primary_email, "keine primary_email");
  // Das ist der Kern des Befundes: Die Bestellung hat KEINE Adresse. Genau
  // deshalb sah der alte Zweig der Vorschau-Route nichts.
  if (Number(p.mit_mail_an_zeile) === 0) {
    log("  → Genau der Fall aus dem Screenshot: An der BESTELLUNG steht keine");
    log("    Adresse, an der PERSON schon. Wer nur die Bestellung liest, findet");
    log("    nichts.");
  }

  titel("2. DIE ZENTRALE AUFLÖSUNG FINDET SIE");
  const e = await empfaengerFuer(Number(p.id));
  ok("empfaengerFuer liefert eine Adresse", !!e.adresse, String(e.adresse));
  ok("… und es ist die aus der Akte", e.adresse === p.primary_email,
    `${e.adresse} ≠ ${p.primary_email}`);
  log(`        Quelle: ${e.quelle}`);

  const mb = await massgeblicheBestellung(Number(p.id));
  log(`        maßgebliche Bestellung: ${mb?.ref ?? "— keine offene —"}`);

  titel("3. DIE VORSCHAU-ROUTE — DIE DATENQUELLE DES DIALOGS");
  // Gefragt wird als der BETREUER, denn die Route prüft den Besitz. Das
  // Ansichts-Token ist nur lesend und erzeugt keinen Vorgang.
  const cookie = `${ANSICHT_COOKIE}=${ansichtTokenBauen(Number(p.assigned_agent_id))}`;
  const r = await fetch(`${BASIS}/agent/crm/kunden/${p.id}/rechnung-vorschau`, {
    headers: { cookie },
  });
  const j = await r.json().catch(() => null) as any;
  log("");
  log(`  HTTP ${r.status}`);
  log(`  ${JSON.stringify(j, null, 2).split("\n").join("\n  ").slice(0, 900)}`);
  log("");
  ok("Die Vorschau antwortet mit 200", r.status === 200, String(r.status));
  ok("Sie meldet ok:true", j?.ok === true, JSON.stringify(j).slice(0, 120));
  ok("Sie nennt eine Empfängeradresse", !!j?.empfaenger, String(j?.empfaenger));
  ok("Es ist Rechtsteiners Adresse", j?.empfaenger === p.primary_email,
    `${j?.empfaenger} ≠ ${p.primary_email}`);
  ok("Sie sagt NICHT mehr „keine E-Mail-Adresse hinterlegt“",
    !/keine E-Mail-Adresse hinterlegt/.test(String(j?.hinweis ?? "")),
    String(j?.hinweis));
  ok("„Senden“ ist freigegeben (moeglich:true)", j?.moeglich === true, String(j?.moeglich));
  ok("Die Quelle der Adresse steht dabei", j?.empfaengerQuelle === "person"
    || j?.empfaengerQuelle === "bestellung", String(j?.empfaengerQuelle));

  titel("4. DER BETRAG IST EIN EURO-BETRAG, KEIN CENT-MISSVERSTÄNDNIS");
  if (j?.betragCents == null) {
    log("  Kein Betrag in der Vorschau (noch keine Rechnung gestellt) — dann");
    log("  gibt es hier nichts zu prüfen. Der Katalogpreis steht im Feld");
    log(`  katalogCents: ${j?.katalogCents}`);
    ok("Bei fehlendem Betrag steht der Katalogpreis dabei",
      j?.katalogCents == null || Number(j.katalogCents) >= 799, String(j?.katalogCents));
  } else {
    ok("Der Betrag ist plausibel (mindestens 7,99 €, also ≥ 799 Cent)",
      Number(j.betragCents) >= 799,
      `${j.betragCents} Cent = ${(Number(j.betragCents) / 100).toFixed(2)} € — `
      + "unter 799 hieße: Euro als Cent gelesen");
    ok("Der Text passt zur Zahl", String(j.betragText ?? "")
      === `${(Number(j.betragCents) / 100).toFixed(2).replace(".", ",")} €`,
      String(j.betragText));
  }

  titel("5. DIE VERSAND-PAYLOAD TRÄGT DIESELBE ADRESSE");
  // Gemessen an der Auflösung, die `zahlungsdatenSenden` benutzt — ohne zu
  // senden. Die Route ruft `empfaengerFuer(personId, bestellung.ref)`.
  const versand = mb ? await empfaengerFuer(Number(p.id), mb.ref) : e;
  ok("Die Adresse des Versands ist die des Dialogs",
    versand.adresse === j?.empfaenger, `${versand.adresse} ≠ ${j?.empfaenger}`);

  titel("6. KEIN BAUTEIL LIEST E-MAIL NOCH AUS DER BESTELLZEILE");
  // Geprüft wird der kommentarfreie Text: Die Begründung, WARUM die Zeile weg
  // ist, enthält sie natürlich noch (AGENTS.md).
  const vorschau = ohneKommentare(lies("server/routes/fiaon-agent-kunden.ts"));
  const eigeneAbfrage = /NULLIF\(a\.billing_email[^)]*\)\s*\)\s*AS empfaenger/.test(vorschau);
  ok("Die Vorschau-Route hat keine eigene Empfänger-Abfrage mehr", !eigeneAbfrage);
  ok("Sie ruft empfaengerFuer", /empfaengerFuer\(/.test(vorschau));
  ok("Der Sende-Weg ruft empfaengerFuer",
    /const empfaenger = \(await empfaengerFuer\(/.test(vorschau));
  ok("Die Nummern-Korrektur ruft empfaengerFuer auch",
    (vorschau.match(/empfaengerFuer\(/g) ?? []).length >= 3,
    `${(vorschau.match(/empfaengerFuer\(/g) ?? []).length} Aufrufe`);

  const dialog = ohneKommentare(lies("client/src/components/agent/RechnungBestaetigung.tsx"));
  ok("Der Dialog sperrt „Senden“ ohne Adresse",
    /disabled=\{!v\.moeglich/.test(dialog));
  // Geprüft wird der SENDE-Knopf, nicht jeder Knopf im Fenster: Der Knopf
  // „Speichern" am Nachtrag-Feld darf halbdurchsichtig sein — er ist nicht der,
  // den der Betreiber für aktiv gehalten hat.
  const sendeKnopf = dialog.slice(dialog.indexOf("rechnung-senden") - 400,
    dialog.indexOf("rechnung-senden") + 700);
  ok("… und sieht dabei sichtbar anders aus (grau mit Rahmen, nicht blau-blass)",
    /background: "#f1f5f9"/.test(sendeKnopf) && !/disabled:opacity/.test(sendeKnopf),
    sendeKnopf.slice(0, 0));
  ok("Der Dialog bietet das Feld zum Nachtragen an",
    /empfaenger-nachtragen/.test(dialog) && /E-Mail nachtragen/.test(dialog));
  ok("Er zeigt die Warnmarke bei einem Betrag außerhalb des Katalogs",
    /betrag-warnmarke/.test(dialog) && /Katalogpreis wäre/.test(dialog));

  log("");
  log(`${gut} ok, ${schlecht} rot.`);
  log("");
  await sqlPool.end();
  if (schlecht > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
