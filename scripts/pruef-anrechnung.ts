// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-354 — Bezahltes anrechnen (Guthaben einer stornierten Bestellung → Abo)
//
//   Teil A (ohne Datenbank): die Rechnung (anrechnungPlanen).
//   Teil B (nur gegen eine LOKALE fiaon_-Datenbank): Lage, Vorschau, Anrechnen, kein doppelter Umsatz,
//          keine zweite Anrechnung, Rest mindert Rate 7 bzw. Rate 13 (Verlängerung).
//
//   env -i … DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_it_d npx tsx scripts/pruef-anrechnung.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://pruefstand@127.0.0.1:1/ins-leere";
const LOKAL = /@(127\.0\.0\.1|localhost):\d+\/fiaon_/.test(process.env.DATABASE_URL);

let geprueft = 0, fehler = 0;
function ok(b: unknown, text: string) { geprueft++; if (!b) fehler++; console.log(`${b ? "  ✓" : "  ✗"} ${text}`); }

const A = await import("../server/lib/fiaon-anrechnung");

console.log("── A · Rechnung ──");
{
  const p = A.anrechnungPlanen(9999, 799, "2026-10-14")!;
  ok(p.raten === 12 && p.ratenCents === 9588 && p.restCents === 411 && p.restAuf === "verlaengerung", `99,99 € auf 7,99 € → 12 Raten, Rest 4,11 € für Rate 13 (${p.raten}/${p.restCents}/${p.restAuf})`);
  ok(p.faelligkeiten[0] === "2026-10-14" && p.bisMonat === "2027-09-14", `Rate 1 heute, Rate 12 am 14.09.2027 (${p.bisMonat})`);
  const q = A.anrechnungPlanen(5000, 799, "2026-01-31")!;
  ok(q.raten === 6 && q.restCents === 206 && q.restAuf === "naechste_rate", `50 € → 6 Raten, Rest mindert Rate 7 (${q.raten}/${q.restCents})`);
  ok(q.faelligkeiten[1] === "2026-02-28", `Monatsende bleibt Monatsende (${q.faelligkeiten[1]})`);
  ok(A.anrechnungPlanen(500, 799, "2026-10-14") === null && A.anrechnungPlanen(0, 799, "2026-10-14") === null, "Zu wenig Guthaben → kein Plan");
  ok(A.anrechnungPlanen(9588, 799, "2026-10-14")!.restAuf === null, "Genau 12 Raten → kein Rest");
}

if (!LOKAL) {
  console.log("\n(Teil B übersprungen — DATABASE_URL zeigt nicht auf eine lokale fiaon_-Datenbank.)");
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  const { UMSATZ_QUELLE_SQL } = await import("../server/lib/fiaon-umsatz-quelle");
  const ABO = await import("../server/routes/fiaon-abo");
  await ABO.ensureAboTabellen();
  const marke = `ANR${Date.now().toString(36).toUpperCase()}`;
  const wer = { name: "Prüfstand", agentId: null };

  async function fall(n: string, guthabenCents: number) {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email)
      VALUES (${`${marke}-${n}`}, 'Dogan', ${`Prüf${n}`}, ${`anr-${marke.toLowerCase()}-${n}@example.invalid`}) RETURNING id`) as any[];
    const alt = `FIAON-${marke}-${n}-ALT`, neu = `FIAON-${marke}-${n}-NEU`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name, email, type, pack_key, pack_name, payment_status, amount_due, paid_at, completed_at, created_at, account_status)
      VALUES (${alt}, ${`${alt}-Z`}, ${p.id}, 'Dogan', ${`Prüf${n}`}, ${`anr-${marke.toLowerCase()}-${n}@example.invalid`}, 'privat', 'highend', 'FIAON High End', 'cancelled', 99.99, NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', 'suspended')`;
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle)
      VALUES (${alt}, 1, ${`${alt}-Z`}, ${guthabenCents}, (NOW() - INTERVAL '50 days')::date, 'bezahlt', NOW() - INTERVAL '50 days', 'bank')`;
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, storniert_am, quelle)
      VALUES (${alt}, 2, ${`${alt}-Z-2`}, 9999, (NOW() - INTERVAL '20 days')::date, 'storniert', NOW(), 'auto')`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name, email, type, pack_key, pack_name, payment_status, amount_due, created_at, account_status)
      VALUES (${neu}, ${`${neu}-Z`}, ${p.id}, 'Dogan', ${`Prüf${n}`}, ${`anr-${marke.toLowerCase()}-${n}@example.invalid`}, 'privat', 'start', 'FIAON Start', 'claimed_paid', 7.99, NOW() - INTERVAL '20 days', 'pending')`;
    return { personId: Number(p.id), alt, neu };
  }
  const umsatz = async (refs: string[]) => {
    const [u] = (await sqlPool.unsafe(`WITH q AS (${UMSATZ_QUELLE_SQL}) SELECT COALESCE(SUM(cents), 0)::int AS c, COUNT(*)::int AS n FROM q WHERE ref = ANY($1)`, [refs] as any)) as any[];
    return { c: Number(u.c), n: Number(u.n) };
  };

  console.log("── B · Anrechnen (Fall Dogan Cengiz: 99,99 € → FIAON Start) ──");
  {
    const k = await fall("A", 9999);
    const vorher = await umsatz([k.alt, k.neu]);
    const lage = await A.anrechnungLage(k.personId);
    ok(lage.quellen.length === 1 && lage.quellen[0].verfuegbarCents === 9999 && lage.ziele.length === 1 && lage.ziele[0].preisCents === 799,
      `Lage: Quelle 99,99 € frei, Ziel FIAON Start 7,99 € (${lage.quellen.length}/${lage.ziele.length})`);
    const v = await A.anrechnen({ personId: k.personId, quelleRef: k.alt, zielRef: k.neu, wer });
    const [unv] = (await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${k.neu}`) as any[];
    ok(v.ok && v.plan?.raten === 12 && unv.payment_status === "claimed_paid", "Vorschau (Vorgabe trocken) rechnet, ändert nichts");
    const r = await A.anrechnen({ personId: k.personId, quelleRef: k.alt, zielRef: k.neu, wer, trocken: false });
    ok(r.ok, `Anrechnen: ${r.text}`);
    const [z] = (await sqlPool`SELECT payment_status, account_status, onboarding_stufe, paid_at FROM fiaon_applications WHERE ref = ${k.neu}`) as any[];
    ok(z.payment_status === "paid" && z.account_status === "active" && z.onboarding_stufe === "voll_aktiv" && z.paid_at, "Ziel: bezahlt, aktiv, voll freigeschaltet");
    const raten = (await sqlPool`SELECT rate_nr, betrag_cents, status, quelle, faellig_am::text AS f FROM fiaon_abo_raten WHERE ref = ${k.neu} ORDER BY rate_nr`) as any[];
    ok(raten.length === 12 && raten.every((x: any) => x.status === "bezahlt" && x.quelle === "anrechnung" && Number(x.betrag_cents) === 799), `12 Raten à 7,99 € bezahlt, quelle „anrechnung“ (${raten.length})`);
    const nachher = await umsatz([k.alt, k.neu]);
    ok(nachher.c === vorher.c && nachher.c === 9999, `Kein doppelter Umsatz: vorher ${vorher.c}, nachher ${nachher.c} Cent`);
    const log = (await sqlPool`SELECT ref FROM fiaon_contact_log WHERE person_id = ${k.personId} AND note LIKE '%angerechnet%'`) as any[];
    ok(log.length === 2, "Verlauf an beiden Bestellungen");
    const nochmal = await A.anrechnen({ personId: k.personId, quelleRef: k.alt, zielRef: k.neu, wer, trocken: false });
    ok(!nochmal.ok, `Zweite Anrechnung abgelehnt (${nochmal.text})`);
    const lage2 = await A.anrechnungLage(k.personId);
    ok(lage2.quellen.length === 0 && lage2.ziele.length === 0 && lage2.bisher.length === 1 && lage2.bisher[0].restCents === 411, "Danach: nichts mehr anrechenbar, Vermerk mit Rest 4,11 €");
    // Verlängerung: Rate 13 entsteht mit dem Rest gemindert.
    await sqlPool`UPDATE fiaon_applications SET abo_verlaengert_raten = 12 WHERE ref = ${k.neu}`;
    const r12 = raten[11];
    await ABO.naechsteRateAnlegen(k.neu, { rate_nr: 12, faellig_am: r12.f, betrag_cents: 799, zahlungsreferenz: `${k.neu}-Z-12` });
    const [r13] = (await sqlPool`SELECT betrag_cents, status, notiz FROM fiaon_abo_raten WHERE ref = ${k.neu} AND rate_nr = 13`) as any[];
    ok(r13 && Number(r13.betrag_cents) === 388 && r13.status === "offen" && /4,11 € Guthaben/.test(String(r13.notiz)), `Rate 13 bei Verlängerung: 3,88 € (${r13?.betrag_cents}, ${r13?.notiz})`);
    const g = await A.guthabenVerbrauchen(k.neu, 799);
    ok(g.angerechnetCents === 0 && g.betragCents === 799, "Guthaben ist danach verbraucht");
  }
  {
    const k = await fall("B", 5000);
    const r = await A.anrechnen({ personId: k.personId, quelleRef: k.alt, zielRef: k.neu, wer, trocken: false });
    const raten = (await sqlPool`SELECT rate_nr, betrag_cents, status FROM fiaon_abo_raten WHERE ref = ${k.neu} ORDER BY rate_nr`) as any[];
    ok(r.ok && raten.length === 7 && raten.slice(0, 6).every((x: any) => x.status === "bezahlt") && raten[6].status === "offen" && Number(raten[6].betrag_cents) === 593,
      `50 €: 6 Raten bezahlt, Rate 7 offen mit 5,93 € (${raten.length}, ${raten[6]?.betrag_cents})`);
  }
  await sqlPool.end({ timeout: 2 }).catch(() => {});
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
