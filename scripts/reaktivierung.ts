// ═══════════════════════════════════════════════════════════════════════════
// REAKTIVIERUNG — Konten, die niemand zugemacht hat, gehen wieder auf
//
// Geschäftsregel (Teil 0, 08.08.2026): Ein Kundenkonto wird NUR durch eine
// menschliche Admin-Entscheidung gesperrt. Keine Automatik — kein Fristablauf,
// kein Cron, kein Import, kein Dubletten-Lauf — darf ein Konto abschalten.
//
// Dieser Lauf räumt die Vergangenheit auf: Jedes gesperrte oder inaktive Konto
// OHNE zugehörigen Admin-Protokolleintrag gilt als von einer Automatik
// abgeschaltet und wird wieder geöffnet.
//
// DREI AUSNAHMEN, die gesperrt bleiben — und warum:
//   1. DSGVO-Löschung (`gdpr_deleted_at`). Das IST die dokumentierte Entscheidung
//      eines Menschen. Sie zurückzudrehen wäre ein Rechtsverstoß, kein Aufräumen.
//   2. Ein Protokolleintrag in `fiaon_agent_events` benennt die Sperrung. Dann
//      hat ein Mensch entschieden, und diese Entscheidung gilt.
//   3. Testkonten (interne Dev-/Prüf-Datensätze). Sie zu öffnen würde einen
//      erfundenen Kunden in echte Arbeitslisten heben.
//
// KEINE MAILS. Der Lauf ruft keinen Webhook und setzt kein Versandflag. Ein
// Kunde, dessen Konto nie hätte zu sein dürfen, soll keine „Ihr Konto ist jetzt
// aktiv"-Mail für einen Zustand bekommen, von dem er nichts wusste.
//
// AUFRUF
//   npx tsx scripts/reaktivierung.ts              → nur Vorschau + CSV
//   npx tsx scripts/reaktivierung.ts --schreiben  → führt aus
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const AKTEUR = "Reaktivierungslauf (Teil 0)";

/** Zustände, die ein Konto zumachen. 'merged' gehört NICHT dazu — eine
 *  zusammengeführte Person ist kein gesperrtes Konto, sondern ein Wegweiser. */
const ZU = ["suspended", "inactive", "inaktiv", "gesperrt", "blocked"];

type Fall = {
  art: "bestellung" | "person";
  schluessel: string;
  ref: string;
  kunde: string;
  zustand: string;
  bezahlt: boolean;
  grund: string;
  entscheidung: "reaktivieren" | "bleibt gesperrt";
};

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ist das ein interner Test-/Entwicklungsdatensatz? */
function istTest(ref: string, email: string | null): boolean {
  const r = String(ref || "").toUpperCase();
  const e = String(email || "").toLowerCase();
  return r.startsWith("FIA-DEV-") || r.startsWith("FIAON-TEST-")
    || e.endsWith("@fiaon-internal.dev") || e.endsWith(".invalid")
    || e.includes("@example.com");
}

async function main(): Promise<void> {
  console.log("\n══ Reaktivierung — Konten ohne Sperr-Entscheidung ══\n");

  // ── 1. Gesperrte Bestellungen (hier hängt der Login des Kunden) ───────────
  // `account_status` an der Bestellung ist das, was decideLogin prüft
  // (fiaon-login-logic.ts). Eine Sperre hier heißt: Der Kunde kommt nicht in
  // sein Konto — auch wenn er bezahlt hat.
  const bestellungen = await sqlPool`
    SELECT a.ref, a.person_id, a.email, a.contact_email, a.payment_status,
           a.account_status, a.gdpr_deleted_at, a.updated_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    NULLIF(TRIM(a.company_name), ''), NULLIF(TRIM(a.contact_name), ''),
                    a.email, a.ref) AS kunde
    FROM fiaon_applications a
    WHERE LOWER(COALESCE(a.account_status, '')) = ANY(${ZU})
    ORDER BY (a.payment_status = 'paid') DESC, a.updated_at DESC
  `;

  // ── 2. Gesperrte Personen ────────────────────────────────────────────────
  const personen = await sqlPool`
    SELECT p.id, p.person_ref, p.primary_email, p.account_status, p.updated_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS kunde,
           EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlt,
           EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NOT NULL) AS dsgvo
    FROM fiaon_persons p
    WHERE LOWER(COALESCE(p.account_status, '')) = ANY(${ZU})
    ORDER BY p.updated_at DESC
  `;

  // ── 3. Admin-Protokoll: wer hat je eine Sperrung dokumentiert? ────────────
  // Alles, was die Frage „hat ein Mensch das entschieden?" mit ja beantwortet.
  const protokoll = await sqlPool`
    SELECT type, meta, reason, actor, created_at
    FROM fiaon_agent_events
    WHERE type IN ('konto_status_geaendert', 'konto_gesperrt', 'account_suspended',
                   'gdpr_delete', 'vertrieb_sperre')
  `;
  const dokumentiert = new Set<string>();
  for (const e of protokoll as any[]) {
    const text = `${e.meta ?? ""} ${e.reason ?? ""}`;
    for (const m of text.matchAll(/(FIA[A-Z0-9-]+)/gi)) dokumentiert.add(m[1].toUpperCase());
    for (const m of text.matchAll(/"person(?:_?id)?"\s*:\s*(\d+)/gi)) dokumentiert.add(`P${m[1]}`);
  }

  const faelle: Fall[] = [];

  for (const b of bestellungen as any[]) {
    const ref = String(b.ref);
    const email = b.email || b.contact_email;
    let grund: string;
    let entscheidung: Fall["entscheidung"] = "reaktivieren";
    if (b.gdpr_deleted_at) {
      grund = "DSGVO-Löschung — dokumentierte Entscheidung";
      entscheidung = "bleibt gesperrt";
    } else if (dokumentiert.has(ref.toUpperCase())) {
      grund = "Admin-Protokolleintrag vorhanden";
      entscheidung = "bleibt gesperrt";
    } else if (istTest(ref, email)) {
      grund = "Testkonto (interner Datensatz)";
      entscheidung = "bleibt gesperrt";
    } else {
      grund = "gesperrt OHNE Admin-Protokolleintrag";
    }
    faelle.push({
      art: "bestellung", schluessel: ref, ref, kunde: String(b.kunde ?? ref),
      zustand: `Bestellung ${b.account_status} / Zahlung ${b.payment_status}`,
      bezahlt: b.payment_status === "paid", grund, entscheidung,
    });
  }

  for (const p of personen as any[]) {
    const id = Number(p.id);
    let grund: string;
    let entscheidung: Fall["entscheidung"] = "reaktivieren";
    if (p.dsgvo) {
      grund = "DSGVO-Löschung an der Bestellung — dokumentierte Entscheidung";
      entscheidung = "bleibt gesperrt";
    } else if (dokumentiert.has(`P${id}`)) {
      grund = "Admin-Protokolleintrag vorhanden";
      entscheidung = "bleibt gesperrt";
    } else if (istTest(String(p.person_ref), p.primary_email)) {
      grund = "Testkonto (interner Datensatz)";
      entscheidung = "bleibt gesperrt";
    } else {
      grund = "gesperrt OHNE Admin-Protokolleintrag";
    }
    faelle.push({
      art: "person", schluessel: `P${id}`, ref: String(p.person_ref),
      kunde: String(p.kunde ?? p.person_ref),
      zustand: `Person ${p.account_status}`, bezahlt: !!p.bezahlt, grund, entscheidung,
    });
  }

  // ── 4. Vorschau-CSV — immer, auch beim Schreiben ──────────────────────────
  const kopf = ["art", "ref", "kunde", "zustand", "bezahlt", "grund_der_erkennung", "entscheidung"];
  const zeilen = faelle.map((f) => [
    f.art, f.ref, f.kunde, f.zustand, f.bezahlt ? "ja" : "nein", f.grund, f.entscheidung,
  ].map(feld).join(";"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/reaktivierung-vorschau.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  const zuOeffnen = faelle.filter((f) => f.entscheidung === "reaktivieren");
  const bleibt = faelle.filter((f) => f.entscheidung === "bleibt gesperrt");

  console.log(`  Gesperrte Bestellungen:        ${bestellungen.length}`);
  console.log(`  Gesperrte Personen:            ${personen.length}`);
  console.log(`  → zu reaktivieren:             ${zuOeffnen.length}`);
  console.log(`  → bleibt gesperrt (mit Grund): ${bleibt.length}`);
  console.log(`  Vorschau: reports/reaktivierung-vorschau.csv\n`);
  for (const f of faelle) {
    const zeichen = f.entscheidung === "reaktivieren" ? "→" : "·";
    console.log(`  ${zeichen} ${f.ref.padEnd(24)} ${String(f.kunde).slice(0, 28).padEnd(30)} ${f.zustand.padEnd(42)} ${f.grund}`);
  }

  if (!SCHREIBEN) {
    console.log(`\n  Nur Vorschau. Ausführen mit --schreiben.\n`);
    await sqlPool.end();
    return;
  }

  // ── 5. Ausführen — eine Transaktion, keine Mails ──────────────────────────
  let bestellungenGeoeffnet = 0;
  let personenGeoeffnet = 0;
  await sqlPool.begin(async (tx) => {
    for (const f of zuOeffnen) {
      if (f.art === "bestellung") {
        // 'active' nur, wenn bezahlt — sonst der reguläre Ausgangszustand
        // 'pending'. Ein unbezahltes Konto auf 'active' zu setzen wäre eine
        // Freischaltung ohne Zahlung, also das andere Extrem des Fehlers.
        const rows = await tx`
          UPDATE fiaon_applications SET
            account_status = CASE WHEN payment_status = 'paid' THEN 'active' ELSE 'pending' END,
            updated_at = NOW()
          WHERE ref = ${f.ref} AND LOWER(COALESCE(account_status, '')) = ANY(${ZU})
          RETURNING ref, account_status
        `;
        if (rows.length > 0) {
          bestellungenGeoeffnet++;
          await tx`
            INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
            VALUES (NULL, 'konto_reaktiviert',
                    ${JSON.stringify({ ref: f.ref, art: "bestellung", neu: rows[0].account_status, erkennung: f.grund })},
                    ${AKTEUR}, ${"Sperrung ohne Admin-Entscheidung — Konto wieder geöffnet (keine Mail versendet)"})
          `;
        }
      } else {
        const id = Number(f.schluessel.slice(1));
        const rows = await tx`
          UPDATE fiaon_persons SET
            account_status = CASE WHEN EXISTS (
              SELECT 1 FROM fiaon_applications a WHERE a.person_id = ${id} AND a.payment_status = 'paid'
            ) THEN 'active' ELSE 'pending' END,
            updated_at = NOW()
          WHERE id = ${id} AND LOWER(COALESCE(account_status, '')) = ANY(${ZU})
          RETURNING id, account_status
        `;
        if (rows.length > 0) {
          personenGeoeffnet++;
          await tx`
            INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
            VALUES (NULL, 'konto_reaktiviert',
                    ${JSON.stringify({ person_id: id, art: "person", neu: rows[0].account_status, erkennung: f.grund })},
                    ${AKTEUR}, ${"Sperrung ohne Admin-Entscheidung — Konto wieder geöffnet (keine Mail versendet)"})
          `;
        }
      }
    }
  });

  console.log(`\n  Reaktiviert: ${bestellungenGeoeffnet} Bestellung(en), ${personenGeoeffnet} Person(en).`);
  console.log(`  Keine Mail versendet. Jede Öffnung steht in fiaon_agent_events ('konto_reaktiviert').\n`);
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[REAKTIVIERUNG]", err);
  process.exit(1);
});
