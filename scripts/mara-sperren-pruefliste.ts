// ═══════════════════════════════════════════════════════════════════════════
// PRÜFLISTE: VERTRIEBSSPERREN OHNE DOKUMENTIERTE ABLEHNUNG (Mara-Topsales 08.10.2026, Justin)
//
// NUR LESEN. Das Skript schreibt NICHTS — es läuft in einer READ-ONLY-Transaktion und hebt keine Sperre auf.
//
// Wofür: Stufe A („bezahlt geklickt“, Geld fehlt) und Stufe B (Antrag abgeschickt, erste Rate offen) mit
// Vertriebssperre (is_blocked am Kopf), bei denen KEINE Ablehnung dokumentiert ist (ABLEHNUNG_DOKUMENTIERT_SQL in
// server/lib/fiaon-mail-frequenz.ts: kein „abgelehnt/kein Interesse/DSGVO“ im Kontaktprotokoll, kein „Sperren“-Klick
// im Vertrieb, keine Werbesperre, kein „Stopp“ — an der Person ODER an einer ihrer Bestellungen). Die Diagnose vom 08.10.
// nannte 102 A / 99 B, las aber nur Vermerke an der Person; nachgezählt (nur lesend, 08.10.) bleiben 8 A und 3 B
// (rund 930 €). Nach der Prüfung (08.10.) zählen auch die Sperre der Verwaltung („Vertriebssperre GESETZT“) und jede
// Sperre im Sperr-Protokoll, die nicht aus einem Zusammenführen stammt, als dokumentiert. Beim Zusammenführen geht die
// Sperre IMMER mit; ohne Vermerk entsteht dort zusätzlich eine Betreiber-Aufgabe (fiaon-person-merge.ts).
//
// Was das Team damit tut: JEDEN Fall einzeln prüfen (Verlauf, Gespräche). Liegt kein Nein vor, hebt der Betreuer
// oder die Leitung die Sperre über den Knopf „Sperre aufheben“ auf (POST /agent/vertrieb/person/:id/sperre).
// NIE pauschal per SQL: Wer am Telefon widersprochen hat, ohne dass es vermerkt wurde, darf keine Werbung bekommen
// (DSGVO Art. 21, UWG § 7).
//
// Ausgabe: CSV (person_id;stufe;offen_euro;aus_zusammenfuehrung;gesperrt_seit) auf stdout, eine Zusammenfassung auf
// stderr. Keine Namen, keine Adressen.
//
//   DATABASE_URL=… npx tsx scripts/mara-sperren-pruefliste.ts > pruefliste.csv
// ═══════════════════════════════════════════════════════════════════════════
const { sqlPool } = await import("../server/lib/db-pool");
const { ABLEHNUNG_DOKUMENTIERT_SQL } = await import("../server/lib/fiaon-mail-frequenz");
const { abgeschicktSql } = await import("../shared/fiaon-antrag-stand");
const { paketPreisCents } = await import("../shared/fiaon-pakete");

/** Die Abfrage (der Prüfstand pruef-mara-topsales.ts ruft dieses Skript gegen die lokale Test-DB auf). */
const prueflisteSql = (mitProtokoll: boolean) => `
  WITH app AS (
    SELECT DISTINCT ON (fa.person_id) fa.person_id, fa.payment_status, fa.pack_key, fa.amount_due
      FROM fiaon_applications fa
     WHERE fa.payment_status IN ('claimed_paid', 'pending_payment')
       AND fa.merged_into IS NULL AND fa.archived_at IS NULL AND fa.gdpr_deleted_at IS NULL AND fa.cancelled_at IS NULL
       AND fa.person_id IS NOT NULL
       AND (fa.payment_status = 'claimed_paid' OR ${abgeschicktSql("fa")})
       AND COALESCE(fa.type, '') <> 'schufa' AND COALESCE(fa.ref, '') NOT LIKE 'FIAON-SCHUFA-%'
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications pz WHERE pz.person_id = fa.person_id AND pz.payment_status = 'paid'
                         AND pz.merged_into IS NULL AND COALESCE(pz.type, '') <> 'schufa')
     ORDER BY fa.person_id, (fa.payment_status = 'claimed_paid') DESC, fa.created_at DESC
  )
  SELECT app.person_id, CASE WHEN app.payment_status = 'claimed_paid' THEN 'A' ELSE 'B' END AS stufe,
         app.pack_key, app.amount_due,
         (p.merge_batch_id IS NOT NULL OR EXISTS (SELECT 1 FROM fiaon_persons d WHERE d.merged_into_person_id = p.id)) AS aus_zusammenfuehrung,
         (SELECT MIN(sp.geaendert_am) FROM fiaon_sperr_protokoll sp WHERE sp.person_id = p.id AND sp.neu IS TRUE) AS gesperrt_seit
    FROM app
    JOIN fiaon_persons p ON p.id = app.person_id
   WHERE p.merged_into_person_id IS NULL
     AND COALESCE(p.is_blocked, FALSE)
     AND p.ist_test_am IS NULL
     AND NOT ${ABLEHNUNG_DOKUMENTIERT_SQL("p.id", { sperrProtokoll: mitProtokoll })}
   ORDER BY stufe, app.person_id`;

const zeilen = (await sqlPool.begin("READ ONLY", async (tx: any) => {
  // fiaon_sperr_protokoll kann auf einem frischen Stand fehlen — dann ohne „gesperrt_seit“.
  const [t] = (await tx`SELECT to_regclass('fiaon_sperr_protokoll') IS NOT NULL AS da`) as any[];
  const sql = t?.da ? prueflisteSql(true) : prueflisteSql(false).replace(/\(SELECT MIN\(sp\.geaendert_am\)[\s\S]*?\) AS gesperrt_seit/, "NULL AS gesperrt_seit");
  return tx.unsafe(sql);
})) as any[];

const euro = (z: any) => {
  const c = z.pack_key ? paketPreisCents(String(z.pack_key)) : 0;
  return c > 0 ? c / 100 : z.amount_due == null ? 0 : Number(z.amount_due);
};
console.log("person_id;stufe;offen_euro;aus_zusammenfuehrung;gesperrt_seit");
const summe: Record<string, { n: number; euro: number }> = { A: { n: 0, euro: 0 }, B: { n: 0, euro: 0 } };
for (const z of zeilen) {
  const e = euro(z);
  summe[z.stufe].n++; summe[z.stufe].euro += e;
  console.log([z.person_id, z.stufe, e.toFixed(2).replace(".", ","), z.aus_zusammenfuehrung ? "ja" : "nein",
    z.gesperrt_seit ? new Date(z.gesperrt_seit).toISOString().slice(0, 10) : ""].join(";"));
}
console.error(`Prüfliste (nur gelesen): A ${summe.A.n} Menschen, ${summe.A.euro.toFixed(2)} € · B ${summe.B.n} Menschen, ${summe.B.euro.toFixed(2)} € — `
  + "jede Sperre einzeln prüfen, aufheben nur über den Knopf „Sperre aufheben“.");
await sqlPool.end({ timeout: 2 }).catch(() => {});
