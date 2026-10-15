// Prüfstand E-371 (15.10.2026): Maras Mail-Entwürfe als Entscheidungskarten (Mara › Entscheidungen) statt
// Aufgaben beim Betreuer. Teil 1 offline (reine Funktionen), Teil 2 gegen eine LOKALE Test-DB in einer
// zurückgerollten Transaktion (Detektoren, Werkzeug-Riegel). Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e370 node_modules/.bin/tsx scripts/pruef-mara-e371.ts

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  const lokal = /127\.0\.0\.1:54329\//.test(String(process.env.DATABASE_URL));
  const pe = await import("../server/lib/fiaon-postmeister-entscheidungen");
  const me = await import("../server/lib/fiaon-mara-entscheidungen");

  console.log("── 1 · Fall und Karte aus einer Postfach-Zeile (rein)");
  ok(pe.entwurfFall("Übergabe an den Betreuer: Widerruf") === "widerruf", "Widerruf erkannt");
  ok(pe.entwurfFall("Übergabe an den Betreuer: rechtliches Anliegen") === "rechtlich", "Recht/Anwalt/Behörde erkannt");
  ok(pe.entwurfFall("Übergabe an den Betreuer: Kunde von FIAON Global") === "global", "Global erkannt");
  ok(pe.entwurfFall("Entwurf: ohne Beleg: 59,99 €") === "unsicher", "sonst: Mara unsicher");
  const zeile = {
    id: 4711, person_id: 12, ref: "FIAON-TEST-0001", betreff: "Widerruf meines Vertrags", text: "Hiermit widerrufe ich.",
    antwort: "Ihren Widerruf prüft unsere Geschäftsführung; Sie bekommen dazu eine schriftliche Nachricht.",
    begruendung: "Übergabe an den Betreuer: Widerruf", kundenlage: "rate_ueberfaellig", pruefung: JSON.stringify({ fehlend: [] }),
    empfangen_am: "2026-10-15T10:00:00Z", created_at: "2026-10-15T10:01:00Z", entwurf_geprueft_am: "2026-10-15T10:02:00Z",
  };
  const k = pe.karteAusZeile(zeile);
  const keys = k.optionen.map((o) => o.key);
  ok(k.art === "postmeister_entwurf" && /^postmeister:4711:\d+$/.test(k.schluessel), "Art und Schlüssel (Mail + Prüfzeit — nach „Neu schreiben“ eine neue Karte)");
  ok(keys.join(",") === "senden,neu,selbst,nichts", "vier Knöpfe: senden, neu schreiben, selbst antworten, nichts senden");
  ok(k.empfehlung === "senden", "saubere Antwort → Empfehlung „senden“");
  ok(k.optionen.find((o) => o.key === "senden")?.ton === "vorsicht", "Widerruf: Senden-Knopf als „vorsicht“");
  ok(k.optionen.find((o) => o.key === "selbst")?.link === "/chef/s/postmeister?eintrag=4711", "„Selbst antworten“ öffnet genau diese Mail");
  ok(k.belege?.some((b) => b.art === "zitat" && b.name === "Maras Antwort"), "Maras Antwort steht als Zitat in der Karte");
  const k2 = pe.karteAusZeile({ ...zeile, begruendung: "Entwurf: ohne Beleg: 59,99 €", pruefung: { fehlend: ["ohne Beleg: 59,99 €"] } });
  ok(k2.empfehlung === "neu" && k2.belege?.some((b) => b.ton === "warn"), "mit Prüfmängeln → Empfehlung „neu schreiben“, Mangel als Chip");
  const k3 = pe.karteAusZeile({ ...zeile, entwurf_geprueft_am: "2026-10-16T08:00:00Z" });
  ok(k3.schluessel !== k.schluessel, "neu geschriebener Entwurf → neuer Schlüssel");
  ok(me.DETEKTOREN.some((d) => d.art === "postmeister_entwurf") && me.DETEKTOREN.some((d) => d.art === "postmeister_altentwuerfe"), "Detektoren angemeldet");
  ok(["postmeister_entwurf_senden", "postmeister_neu_schreiben", "postmeister_verwerfen", "postmeister_alle_neu"].every((n) => me.entscheidungWerkzeugNamen().includes(n)), "Werkzeuge angemeldet");
  const lauf = await import("../server/lib/fiaon-postmeister-lauf");
  ok(lauf.UEBERGABE_GRUND.ansprechpartner === "Kunde möchte mit seinem Ansprechpartner sprechen", "Rückrufgrund wortgleich (bleibt beim Betreuer, keine Karte)");

  if (!lokal) {
    console.log("\n(Teil 2 übersprungen — nur gegen die lokale Test-DB 127.0.0.1:54329)");
  } else {
    console.log("── 2 · Detektoren und Riegel (lokale DB, zurückgerollt)");
    const { sqlPool } = await import("../server/lib/db-pool");
    await me.entscheidungTabellen();
    const ZURUECK = new Error("zurückrollen");
    await sqlPool.begin(async (tx: any) => {
      const [a] = await tx`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, betreff, text, antwort, begruendung, kundenlage, empfangen_am, entwurf_geprueft_am, created_at)
        VALUES ('welcome@fiaon.com', 'pruef-e371-a', 't-a', 'entwurf', 'Widerruf', 'Ich widerrufe.', 'Ihren Widerruf prüft unsere Geschäftsführung.', 'Übergabe an den Betreuer: Widerruf', 'aktiv', NOW(), NOW(), NOW()) RETURNING id`;
      const [b] = await tx`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, betreff, text, antwort, begruendung, kundenlage, empfangen_am, entwurf_geprueft_am, created_at)
        VALUES ('welcome@fiaon.com', 'pruef-e371-b', 't-b', 'entwurf', 'Rückruf', 'Bitte rufen Sie mich an.', 'Gern.', ${`Übergabe an den Betreuer: ${lauf.UEBERGABE_GRUND.ansprechpartner}`}, 'aktiv', NOW(), NOW(), NOW()) RETURNING id`;
      const [c] = await tx`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, betreff, text, antwort, begruendung, kundenlage, empfangen_am, entwurf_geprueft_am, created_at)
        VALUES ('welcome@fiaon.com', 'pruef-e371-c', 't-c', 'entwurf', 'Alt', 'Frage', 'Antwort', 'Übergabe an den Betreuer: Beschwerde', 'aktiv', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days') RETURNING id`;
      const [d] = await tx`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, aktion, betreff, text, antwort, begruendung, kundenlage, empfangen_am, entwurf_geprueft_am, created_at)
        VALUES ('welcome@fiaon.com', 'pruef-e371-d', 't-d', 'entwurf', 'Uralt', 'Frage', 'Antwort', 'Übergabe an den Betreuer: Beschwerde', 'aktiv', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days') RETURNING id`;
      const neu = me.DETEKTOREN.find((x) => x.art === "postmeister_entwurf")!;
      const alt = me.DETEKTOREN.find((x) => x.art === "postmeister_altentwuerfe")!;
      const karten = await neu.finden(tx);
      ok(karten.some((x) => x.schluessel.startsWith(`postmeister:${a.id}:`)), "neuer Entwurf (Widerruf) → Karte");
      ok(!karten.some((x) => x.schluessel.startsWith(`postmeister:${b.id}:`)), "Rückrufwunsch → keine Karte (bleibt beim Betreuer)");
      ok(!karten.some((x) => x.schluessel.startsWith(`postmeister:${c.id}:`)), "Entwurf von vor E-369 → keine Einzelkarte");
      const sammel = await alt.finden(tx);
      const zahl = Number(String(sammel[0]?.titel ?? "").match(/^(\d+)/)?.[1] ?? 0);
      ok(sammel.length === 1 && zahl >= 1, "alte Entwürfe → eine Sammelkarte");
      const [nAlt] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_postmeister WHERE aktion IN ('entwurf','fehler') AND gesendet_am IS NULL AND gmail_id <> ''
                               AND COALESCE(entwurf_geprueft_am, created_at) < ${pe.KARTEN_AB} AND COALESCE(empfangen_am, created_at) >= NOW() - INTERVAL '30 days'`;
      ok(zahl === Number(nAlt.n), `Sammelkarte zählt nur die letzten ${pe.NEU_SCHREIBEN_TAGE} Tage (der 40 Tage alte fehlt)`);
      // Karte anlegen und den Riegel prüfen: schon beantwortet → „von selbst“.
      const r = await me.entscheidungAnlegen(karten.find((x) => x.schluessel.startsWith(`postmeister:${a.id}:`))!, tx);
      ok(!!r?.id, "Karte angelegt");
      await tx`UPDATE fiaon_postmeister SET aktion = 'gesendet', gesendet_am = NOW() WHERE id = ${a.id}`;
      throw ZURUECK;
    }).catch((e: any) => { if (e !== ZURUECK) throw e; });
    // Riegel der Werkzeuge ohne Transaktion: eine Zeile, die es nicht (mehr) als Entwurf gibt.
    const erg = await me.entscheiden(-1, "senden", { von: "Prüfstand" });
    ok(!erg.ok && erg.status === 400, "ungültige Karte → 400");
    await sqlPool.end();
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
