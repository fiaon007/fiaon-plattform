// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE KATALOGPREIS-WAND
//
// Prüft drei Dinge, die zusammen die Wand ausmachen:
//
//   1. Die ABSCHRIFT in `fiaon_paketpreise` stimmt mit dem Katalog überein.
//      Sie ist die zweite Fassung derselben Wahrheit — zulässig nur, solange
//      etwas sie gegeneinander hält. Das ist diese Prüfung.
//   2. Der TRIGGER lehnt einen Betrag ab, der nicht dem Katalogpreis
//      entspricht — und lässt alles durch, was durchgehen muss (Entwürfe ohne
//      Betrag, bezahlte Altzeilen, Bestellungen ohne Katalogpaket).
//   3. Die AUFLÖSUNG in TypeScript (`katalogpreisCents`) und die im Trigger
//      entscheiden GLEICH — insbesondere bei einer Auskunft, die im pack_key
//      ein Stufenpaket trägt.
//
// ── WARUM DIE MIGRATION HIER SELBST EINGESPIELT WIRD ──────────────────────
// Damit dieser Lauf VOR dem echten Einspielen aussagekräftig ist. AGENTS.md:
// „Ein Prüfstand, der eine Sicherheitswand testet, MUSS damit rechnen, dass sie
// fällt." Hier fällt nichts: Alles läuft in EINER Transaktion, die am Ende
// zurückgerollt wird — Tabelle, Trigger und Testzeile verschwinden wieder.
//
// Die Transaktion ist bewusst KURZ: `CREATE TRIGGER` nimmt eine Sperre auf
// fiaon_applications, und die Produktion schreibt weiter.
//
//   npx tsx scripts/pruef-katalogpreis-wand.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { PAKETE, paketPreisCents } from "../shared/fiaon-pakete";
import { katalogpreisCents } from "../server/lib/fiaon-massgebliche-bestellung";
import { katalogpreiseSyncen } from "../server/lib/fiaon-katalogpreise";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

/** Läuft eine Anweisung und meldet, OB sie scheiterte — ohne die Transaktion zu töten. */
async function versuch(tx: any, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    // Ein Constraint-Verstoß tötet die ganze Transaktion (AGENTS.md). Deshalb
    // steht jeder Gegenversuch in einem eigenen Savepoint.
    await tx.savepoint(async () => { await fn(); });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function main(): Promise<void> {
  const migration = readFileSync("db/migrations/065_katalogpreis_wand.sql", "utf8");

  await sqlPool.begin(async (tx: any) => {
    // ═══════════════════════════════════════════════════════════════════════
    titel("1. DIE WAND EINSPIELEN (in der Transaktion, wird zurückgerollt)");
    // ═══════════════════════════════════════════════════════════════════════
    await tx.unsafe(migration);
    const [{ da }] = (await tx`
      SELECT COUNT(*)::int AS da FROM pg_trigger
      WHERE tgname = 'trg_fiaon_katalogpreis_wand'
    `) as any[];
    ok("Der Trigger steht an fiaon_applications", da === 1, `gefunden: ${da}`);

    // ═══════════════════════════════════════════════════════════════════════
    titel("2. DIE ABSCHRIFT STIMMT MIT DEM KATALOG");
    // ═══════════════════════════════════════════════════════════════════════
    const abgleich = await katalogpreiseSyncen(tx);
    ok("Der Abgleich meldet keine verwaisten Schlüssel",
      abgleich.verwaist.length === 0, abgleich.verwaist.join(", "));
    // Zweiter Aufruf: Ein Abgleich, der bei jedem Lauf schreibt, ist kein
    // Abgleich, sondern ein Schreiblauf (AGENTS.md: idempotent, zweimal rufen).
    const zweiter = await katalogpreiseSyncen(tx);
    ok("Zweiter Aufruf schreibt nichts mehr (idempotent)",
      zweiter.geschrieben === 0, `geschrieben: ${zweiter.geschrieben}`);

    const tabelle = new Map(((await tx`
      SELECT pack_key, preis_cents FROM fiaon_paketpreise
    `) as any[]).map((r) => [String(r.pack_key), Number(r.preis_cents)]));
    let alleGleich = true;
    const abweichungen: string[] = [];
    for (const p of PAKETE) {
      if (tabelle.get(p.key) !== p.preisCents) {
        alleGleich = false;
        abweichungen.push(`${p.key}: Tabelle ${tabelle.get(p.key)} ≠ Katalog ${p.preisCents}`);
      }
    }
    ok(`Alle ${PAKETE.length} Katalogpreise stehen gleich in der Tabelle`,
      alleGleich, abweichungen.join("; "));

    // ═══════════════════════════════════════════════════════════════════════
    titel("3. DER TRIGGER LEHNT AB, WAS ER ABLEHNEN MUSS");
    // ═══════════════════════════════════════════════════════════════════════
    // Merkmale je Lauf einmalig (AGENTS.md): Ein Prüfstand, der beim zweiten
    // Mal etwas anderes prüft als beim ersten, ist kein Prüfstand.
    const marke = `PRUEFSTAND-KATALOG-${Date.now().toString(36).toUpperCase()}`;
    const ref = (zusatz: string) => `FIAON-${marke}-${zusatz}`;

    const anlegen = (r: string, pack: string | null, betrag: string | null,
      typ = "private", status = "pending_payment") => tx`
      INSERT INTO fiaon_applications
        (ref, type, status, payment_status, pack_key, amount_due, created_at, updated_at)
      VALUES (${r}, ${typ}, 'submitted', ${status}, ${pack},
              ${betrag}::numeric, NOW(), NOW())
    `;

    const guterPreis = (paketPreisCents("pro") / 100).toFixed(2);
    const fehlerGut = await versuch(tx, () => anlegen(ref("A"), "pro", guterPreis));
    ok("Der Katalogpreis geht durch (Pro, 59,99 €)", fehlerGut === null, fehlerGut ?? "");

    const fehlerSchlecht = await versuch(tx, () => anlegen(ref("B"), "pro", "10.00"));
    ok("Ein freier Betrag wird ABGELEHNT (Pro, 10,00 €)",
      fehlerSchlecht !== null && /Katalogpreis/.test(fehlerSchlecht),
      fehlerSchlecht ?? "durchgelassen");

    // Der gemeldete Müll-Betrag selbst: Wer 79,99 als CENT versteht und
    // 0,80 € schreibt, muss abgelehnt werden.
    const fehlerMuell = await versuch(tx, () => anlegen(ref("C"), "ultra", "0.80"));
    ok("Der Müll-Betrag 0,80 € bei Ultra wird ABGELEHNT",
      fehlerMuell !== null, fehlerMuell ?? "durchgelassen");

    const fehlerEntwurf = await versuch(tx, () => anlegen(ref("D"), "pro", null));
    ok("Ein Entwurf OHNE Betrag geht durch (das ist der Trichter)",
      fehlerEntwurf === null, fehlerEntwurf ?? "");

    const fehlerOhnePaket = await versuch(tx, () => anlegen(ref("E"), null, "123.45"));
    ok("Ohne Katalogpaket wird nicht geprüft (Lücke sichtbar, nicht geraten)",
      fehlerOhnePaket === null, fehlerOhnePaket ?? "");

    const fehlerBezahlt = await versuch(tx,
      () => anlegen(ref("F"), "pro", "10.00", "private", "paid"));
    ok("Eine BEZAHLTE Zeile wird nicht blockiert (Buchhaltungs-Spur)",
      fehlerBezahlt === null, fehlerBezahlt ?? "");

    // ═══════════════════════════════════════════════════════════════════════
    titel("4. DIE AUSKUNFT WIRD AN IHREM EIGENEN PREIS GEMESSEN");
    // ═══════════════════════════════════════════════════════════════════════
    // Der Fall aus dem Bestand: type = schufa, pack_key = highend (vom
    // Dubletten-Merge). 74,00 € muss durchgehen, 99,99 € nicht.
    const auskunftGut = await versuch(tx,
      () => anlegen(`FIAON-SCHUFA-${marke}-G`, "highend", "74.00", "schufa"));
    ok("Auskunft mit pack_key highend zu 74,00 € geht durch",
      auskunftGut === null, auskunftGut ?? "");

    const auskunftSchlecht = await versuch(tx,
      () => anlegen(`FIAON-SCHUFA-${marke}-S`, "highend", "99.99", "schufa"));
    ok("Auskunft zu 99,99 € wird ABGELEHNT (genau der Bestandsfall)",
      auskunftSchlecht !== null, auskunftSchlecht ?? "durchgelassen");

    // Und dieselbe Entscheidung in TypeScript:
    ok("katalogpreisCents entscheidet gleich: Auskunft = 7400",
      katalogpreisCents({ ref: "FIAON-SCHUFA-X", type: "schufa", pack_key: "highend" }) === 7400,
      String(katalogpreisCents({ ref: "FIAON-SCHUFA-X", type: "schufa", pack_key: "highend" })));
    ok("katalogpreisCents erkennt die Auskunft auch nur am Präfix",
      katalogpreisCents({ ref: "FIAON-SCHUFA-Y", type: "private", pack_key: "pro" }) === 7400);
    ok("katalogpreisCents liefert null ohne Katalogpaket",
      katalogpreisCents({ ref: "FIAON-Z", type: "private", pack_key: null }) === null);
    ok("katalogpreisCents liefert den Stufenpreis (Ultra = 7999)",
      katalogpreisCents({ ref: "FIAON-Z", type: "private", pack_key: "ultra" }) === 7999);

    // ═══════════════════════════════════════════════════════════════════════
    titel("5. DAS PAKET WECHSELN NIMMT DEN BETRAG MIT");
    // ═══════════════════════════════════════════════════════════════════════
    // Die Akte darf das Paket nicht mehr ohne den Betrag ändern. Die Wand
    // erzwingt es: ein UPDATE nur auf pack_key muss scheitern.
    const nurPaket = await versuch(tx, () => tx`
      UPDATE fiaon_applications SET pack_key = 'highend', updated_at = NOW()
      WHERE ref = ${ref("A")}
    `);
    ok("Paket wechseln OHNE den Betrag wird ABGELEHNT",
      nurPaket !== null, nurPaket ?? "durchgelassen");

    const beides = await versuch(tx, () => tx`
      UPDATE fiaon_applications
      SET pack_key = 'highend', amount_due = 99.99, updated_at = NOW()
      WHERE ref = ${ref("A")}
    `);
    ok("Paket und Betrag gemeinsam wechseln geht durch", beides === null, beides ?? "");

    // Eine Änderung, die Betrag/Paket NICHT anfasst, darf nie scheitern —
    // sonst bricht der Tageslauf an einer Altzeile.
    const nebensache = await versuch(tx, () => tx`
      UPDATE fiaon_applications SET updated_at = NOW() WHERE ref = ${ref("F")}
    `);
    ok("Ein UPDATE ohne Betrag/Paket läuft auch an einer Altzeile durch",
      nebensache === null, nebensache ?? "");

    // ═══════════════════════════════════════════════════════════════════════
    titel("6. DER BESTAND VERTRÄGT DIE WAND");
    // ═══════════════════════════════════════════════════════════════════════
    // Die Frage, die vor dem Einspielen zählt: Wie viele UNBEZAHLTE Zeilen
    // würden die Wand heute verletzen? Jede davon bricht beim nächsten
    // Schreibzugriff — sie gehören VORHER korrigiert.
    const [rest] = (await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_applications a
      JOIN fiaon_paketpreise k ON k.pack_key = CASE
        WHEN COALESCE(a.type,'') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%' THEN 'schufa'
        ELSE LOWER(TRIM(COALESCE(a.pack_key,''))) END
      WHERE a.amount_due IS NOT NULL
        AND COALESCE(a.payment_status,'') <> 'paid'
        AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
        AND ROUND(a.amount_due * 100) <> k.preis_cents
        AND a.ref NOT LIKE ${`%${marke}%`}
    `) as any[];
    log("");
    log(`  ${rest.n} unbezahlte Bestellungen im Bestand widersprechen der Wand.`);
    ok("Keine unbezahlte Bestellung widerspricht der Wand", Number(rest.n) === 0,
      `${rest.n} — erst scripts/katalogpreis-lauf.ts --schreiben laufen lassen`);

    // ── ZURÜCK ────────────────────────────────────────────────────────────
    throw new Error("ROLLBACK-ABSICHT");
  }).catch((e: unknown) => {
    if (!(e instanceof Error) || e.message !== "ROLLBACK-ABSICHT") throw e;
  });

  log("");
  log(`${gut} ok, ${schlecht} rot. Die Transaktion wurde zurückgerollt —`);
  log("Tabelle, Trigger und Testzeilen sind wieder weg.");
  log("");
  await sqlPool.end();
  if (schlecht > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
