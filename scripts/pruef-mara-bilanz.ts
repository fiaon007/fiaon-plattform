// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARAS BILANZ (26.09.2026, E-244)
//
// Gegen die LOKALE Prüfstand-Datenbank (nie Produktion — die Adresse wird
// geprüft). Konstruierte Fälle mit Marke „E244B", Zählungen als Unterschied
// zu einem vorher gemessenen Stand (die Test-DB teilen sich mehrere):
//   · Mara-Mail → gebuchte Rate innerhalb von 14 Tagen zählt als „Geld danach"
//   · Mara-Mail → gebuchte Rate NACH 14 Tagen zählt nur im Rahmen
//   · Testperson zählt nirgends
//   · gemeldet ist nicht Geld
//   · WhatsApp mit Fehler löst kein „Geld danach" aus; zugestellte schon
//   · Auskunft bezahlt → Auskunft-Spalte und Rahmen
//   · „heute" nimmt nur Heutiges
//   · Raten tragen wie in der Produktion den Eingangstag mit 12:00Z
//     (rateBezahltBuchen): ein Eingang am SELBEN Tag wie Maras Mail zählt
//     nicht als „danach" (Nachbesserung E-244, Gegenprüfer)
//   · „vorher gemeldet": Zahlung derselben Bestellung schon vor Maras erstem
//     Kontakt gemeldet → getrennt ausgewiesen; gilt nie für Folgeraten
//   · zwei gleiche Folgeraten am selben Eingangstag zählen in Bilanz UND
//     Kachel doppelt (kein DISTINCT)
//   · Kündigungen: vorgemerkt = verschiedene Menschen (nicht Handgriffe),
//     Testpersonen nicht
//   · Kachel „Geld danach" (aktionWirkung14) und „Wirkung 7 Tage" (waWirkung7)
//   · E-244 Punkt 4: Auskunft-Bestellungen fallen aus Mara-Aktion (A/B) und
//     WA-Gruppe zahlung_offen heraus, ein Paket daneben bleibt drin
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-bilanz.ts
//
// Verschickt nichts: keine Mail, keine WhatsApp — nur Lesen und die eigenen
// Testzeilen schreiben und wieder löschen.
// ═══════════════════════════════════════════════════════════════════════════
export {};
const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand/.test(url)) {
  console.error("Nur gegen den lokalen Prüfstand (127.0.0.1:54329/fiaon_pruefstand). Abbruch.");
  process.exit(2);
}

const { sqlPool } = await import("../server/lib/db-pool");
const B = await import("../server/lib/fiaon-mara-bilanz");
const { kandidatenLaden, aktionTabellen } = await import("../server/lib/fiaon-mara-aktion");
const Z = await import("../server/lib/fiaon-wa-zentrale");

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string, info?: unknown) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`);
  else { fehler++; console.log(`  ✗ ${text}${info !== undefined ? ` — ${JSON.stringify(info)}` : ""}`); }
}

const MARKE = "E244B";
async function aufraeumen() {
  const ids = (await sqlPool`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}`).map((r: any) => Number(r.id));
  await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref LIKE ${"FIAON-" + MARKE + "-%"} OR ref LIKE ${"FIAON-SCHUFA-" + MARKE + "-%"}`;
  await sqlPool`DELETE FROM fiaon_applications WHERE ref LIKE ${"FIAON-" + MARKE + "-%"} OR ref LIKE ${"FIAON-SCHUFA-" + MARKE + "-%"}`;
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE '+4915199244%'`;
  await sqlPool`DELETE FROM fiaon_leads WHERE meta_lead_id LIKE 'E244B-%'`;
  await sqlPool`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'E244B-%'`;
  if (ids.length) {
    await sqlPool`DELETE FROM fiaon_mara_aktion WHERE person_id = ANY(${ids})`;
    await sqlPool`DELETE FROM fiaon_wa_aktion WHERE person_id = ANY(${ids})`;
    await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids})`.catch(() => {});
    for (const t of ["fiaon_person_kontakte", "fiaon_person_kontakt"]) {
      await sqlPool.unsafe(`DELETE FROM ${t} WHERE person_id = ANY($1)`, [ids]).catch(() => {});
    }
    await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`;
  }
}

await aktionTabellen();
await aufraeumen();

// ── Vorher messen ──────────────────────────────────────────────────────────
const vor = await B.bilanzRechnen();
const vorKachel = await B.aktionWirkung14();
const vorWa = await B.waWirkung7();

// Berliner Mitternacht und Jetzt aus der Datenbank (nie aus der Rechneruhr).
const [uhr] = (await sqlPool`
  SELECT NOW() AS jetzt, (((NOW() AT TIME ZONE 'Europe/Berlin')::date)::timestamp AT TIME ZONE 'Europe/Berlin') AS mitternacht`) as any[];
const jetzt = new Date(uhr.jetzt).getTime();
const mitternacht = new Date(uhr.mitternacht).getTime();
const TAG = 86_400_000;
const vorTagen = (t: number) => new Date(jetzt - t * TAG);
// Zwei Zeitpunkte sicher HEUTE (Berlin), in der richtigen Reihenfolge und vor „jetzt".
const heute1 = new Date(mitternacht + (jetzt - mitternacht) / 3);
const gestern = new Date(mitternacht - 2 * 3_600_000); // gestern 22:00 Uhr Berlin

let nr = 0;
async function person(opts: { test?: boolean; telefon?: string } = {}): Promise<number> {
  nr++;
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, primary_phone, ist_test_am, created_at)
    VALUES (${`${MARKE}-${nr}`}, 'Prüf', ${`Bilanz${nr}`}, ${`e244b-${nr}@pruef.invalid`}, ${opts.telefon ?? null},
            ${opts.test ? new Date() : null}, ${vorTagen(10)})
    RETURNING id`) as any[];
  return Number(p.id);
}
async function antrag(personId: number, ref: string, o: { status?: string; pack?: string | null; type?: string; betrag?: number | null; paidAt?: Date | null; claimedAt?: Date | null; erstellt?: Date; schritt?: number } = {}) {
  await sqlPool`
    INSERT INTO fiaon_applications (ref, person_id, email, first_name, last_name, type, pack_key, amount_due, payment_status, paid_at, claimed_paid_at,
                                    created_at, current_step, status, payment_reference)
    VALUES (${ref}, ${personId}, ${`e244b-p${personId}@pruef.invalid`}, 'Prüf', 'Bilanz', ${o.type ?? "private"}, ${o.pack ?? null}, ${o.betrag ?? null},
            ${o.status ?? "pending_payment"}, ${o.paidAt ?? null}, ${o.claimedAt ?? null},
            ${(o.erstellt ?? vorTagen(5)).toISOString().slice(0, 19).replace("T", " ")}, ${o.schritt ?? 8}, 'submitted', ${ref.replace(/-/g, "")})`;
}
/** Wie rateBezahltBuchen (server/routes/fiaon-abo.ts): bezahlt_am = Eingangstag (Berlin) um 12:00Z. */
async function rate(ref: string, cents: number, eingang: Date, rateNr = 1, faellig?: Date) {
  const [t] = (await sqlPool`SELECT ((${eingang}::timestamptz AT TIME ZONE 'Europe/Berlin')::date)::text AS tag,
                                    ((${faellig ?? eingang}::timestamptz AT TIME ZONE 'Europe/Berlin')::date)::text AS faellig`) as any[];
  // faellig_am ist je Bestellung eindeutig (fiaon_abo_raten_ref_faellig_uidx) — zwei Raten am selben Eingangstag brauchen eigene Fälligkeiten.
  await sqlPool`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
    VALUES (${ref}, ${rateNr}, ${ref.replace(/-/g, "") + "R" + rateNr}, ${cents}, ${t.faellig}, 'bezahlt', ${`${t.tag}T12:00:00Z`})`;
}
async function maraMail(personId: number, ref: string, am: Date, stufe = "B") {
  await sqlPool`
    INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, text, empfaenger, created_at, gesendet_am)
    VALUES (${personId}, ${ref}, ${stufe}, 1, 'gesendet', 'Prüfstand', 'Prüfstand', ${`e244b-${personId}@pruef.invalid`}, ${am}, ${am})`;
}
async function kuendigungVorgemerkt(personId: number, nr: number, am: Date) {
  await sqlPool`
    INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, aktion, empfangen_am, gesendet_am, created_at, handlungen)
    VALUES ('pruefstand', ${`E244B-${nr}`}, ${`E244B-${nr}`}, ${personId}, 'gesendet', ${am}, ${am}, ${am},
            ${sqlPool.json([{ werkzeug: "kuendigung_vormerken", ok: true }, { werkzeug: "vermerk_schreiben", ok: true }])})`;
}
async function maraWa(personId: number, nummer: string, am: Date, status: string) {
  await sqlPool`
    INSERT INTO fiaon_whatsapp (person_id, richtung, nummer, von, text, status, created_at)
    VALUES (${personId}, 'raus', ${nummer}, 'Mara Lindner', 'Prüfstand E244B', ${status}, ${am})`;
}

try {
  // P1: Mail vor 3 Tagen, Rate 1 (99,99 €) vor 1 Tag gebucht → Geld danach
  const p1 = await person(); await antrag(p1, `FIAON-${MARKE}-1`, { status: "paid" });
  await maraMail(p1, `FIAON-${MARKE}-1`, vorTagen(3)); await rate(`FIAON-${MARKE}-1`, 9999, vorTagen(1));
  // P2: Mail vor 20 Tagen, Rate vor 1 Tag → außerhalb der 14 Tage: nur Rahmen
  const p2 = await person(); await antrag(p2, `FIAON-${MARKE}-2`, { status: "paid" });
  await maraMail(p2, `FIAON-${MARKE}-2`, vorTagen(20)); await rate(`FIAON-${MARKE}-2`, 9999, vorTagen(1));
  // P3: Testperson — Mail + Rate, zählt nirgends
  const p3 = await person({ test: true }); await antrag(p3, `FIAON-${MARKE}-3`, { status: "paid" });
  await maraMail(p3, `FIAON-${MARKE}-3`, vorTagen(3)); await rate(`FIAON-${MARKE}-3`, 9999, vorTagen(1));
  // P4: Mail vor 3 Tagen, Zahlung GEMELDET vor 2 Tagen, kein Geld
  const p4 = await person(); await antrag(p4, `FIAON-${MARKE}-4`, { status: "claimed_paid", claimedAt: vorTagen(2) });
  await maraMail(p4, `FIAON-${MARKE}-4`, vorTagen(3));
  // P5: Mail gestern 22 Uhr, Rate 59,99 € mit Eingangstag heute → Geld danach, heute
  const p5 = await person(); await antrag(p5, `FIAON-${MARKE}-5`, { status: "paid" });
  await maraMail(p5, `FIAON-${MARKE}-5`, gestern); await rate(`FIAON-${MARKE}-5`, 5999, heute1);
  // P5b: Mail heute früh, Rate 49,99 € mit Eingangstag HEUTE (selber Tag) → NICHT danach,
  // die Überweisung kann vor der Mail angestoßen worden sein; bezahlt_am 12:00Z ist keine echte Uhrzeit
  const p5b = await person(); await antrag(p5b, `FIAON-${MARKE}-5b`, { status: "paid" });
  await maraMail(p5b, `FIAON-${MARKE}-5b`, heute1); await rate(`FIAON-${MARKE}-5b`, 4999, heute1);
  // P6: WhatsApp von Mara (zugestellt) vor 2 Tagen, Auskunft 74 € vor 1 Tag bezahlt
  const p6 = await person({ telefon: "+491519924406" });
  await antrag(p6, `FIAON-SCHUFA-${MARKE}-6`, { type: "schufa", status: "paid", betrag: 74, paidAt: vorTagen(1), erstellt: vorTagen(1.5) });
  await maraWa(p6, "+491519924406", vorTagen(2), "zugestellt");
  // P7: WhatsApp von Mara mit FEHLER vor 2 Tagen, Rate vor 1 Tag → nur Rahmen
  const p7 = await person({ telefon: "+491519924407" }); await antrag(p7, `FIAON-${MARKE}-7`, { status: "paid" });
  await maraWa(p7, "+491519924407", vorTagen(2), "fehler"); await rate(`FIAON-${MARKE}-7`, 9999, vorTagen(1));

  const nach = await B.bilanzRechnen();
  const d = (f: (b: typeof nach) => number) => f(nach) - f(vor as typeof nach);
  const S = (b: typeof nach) => b.zeitraeume.start, H = (b: typeof nach) => b.zeitraeume.heute, W = (b: typeof nach) => b.zeitraeume.woche;

  console.log("── Mail-Aktion ─────────────────────────────────────────────────────");
  ok(d((b) => S(b).mail.gesendet) === 4, "Seit Start: 4 Mails gezählt (P1, P4, P5, P5b — Testperson nicht, Mail vor dem Start nicht)", d((b) => S(b).mail.gesendet));
  ok(d((b) => S(b).mail.gemeldet) === 1, "Gemeldet: 1 (P4)", d((b) => S(b).mail.gemeldet));
  ok(d((b) => S(b).mail.geld.zahlungen) === 2, "Geld danach: 2 Zahlungen (P1 + P5; P2 nach 14 Tagen nicht, P3 Test nicht, P4 nur gemeldet, P5b selber Tag nicht)", d((b) => S(b).mail.geld.zahlungen));
  ok(d((b) => S(b).mail.geld.cents) === 9999 + 5999, "Geld danach: 159,98 €", d((b) => S(b).mail.geld.cents));
  ok(d((b) => H(b).mail.geld.cents) === 5999, "Heute: nur P5 (59,99 €, Eingangstag heute, Mail gestern)", d((b) => H(b).mail.geld.cents));
  ok(d((b) => H(b).mail.gesendet) === 1, "Heute: 1 Mail (P5b; P5 kam gestern)", d((b) => H(b).mail.gesendet));
  ok(d((b) => S(b).mail.geldVorherGemeldet.cents) === 0, "Vorher gemeldet: 0 (keiner hatte vor Maras Mail gemeldet)", d((b) => S(b).mail.geldVorherGemeldet.cents));
  ok(d((b) => W(b).mail.geld.cents) === 9999 + 5999, "7 Tage: P1 + P5", d((b) => W(b).mail.geld.cents));

  console.log("── WhatsApp ────────────────────────────────────────────────────────");
  ok(d((b) => S(b).whatsapp.antworten) === 1, "1 freie Antwort von Mara (P6), die mit Fehler nicht", d((b) => S(b).whatsapp.antworten));
  ok(d((b) => S(b).whatsapp.fehler) === 1, "1 Fehler (P7)", d((b) => S(b).whatsapp.fehler));
  ok(d((b) => S(b).whatsapp.geld.cents) === 7400, "Geld nach WhatsApp: 74 € (P6), P7 (Fehler) nicht", d((b) => S(b).whatsapp.geld.cents));

  console.log("── Auskunft ────────────────────────────────────────────────────────");
  ok(d((b) => S(b).auskunft.bezahlt) === 1 && d((b) => S(b).auskunft.bezahltCents) === 7400, "Auskunft bezahlt: 1 × 74 €", [d((b) => S(b).auskunft.bezahlt), d((b) => S(b).auskunft.bezahltCents)]);
  ok(d((b) => S(b).auskunft.bestellt) === 1, "Auskunft bestellt: 1", d((b) => S(b).auskunft.bestellt));

  console.log("── Rahmen ──────────────────────────────────────────────────────────");
  ok(d((b) => S(b).rahmen.geldCents) === 9999 * 3 + 5999 + 4999 + 7400, "Gesamteinnahmen: P1 + P2 + P5 + P5b + P6 + P7 = 483,95 € (Test nicht)", d((b) => S(b).rahmen.geldCents));
  ok(d((b) => S(b).rahmen.zahlungen) === 6, "Gesamteinnahmen: 6 Zahlungen", d((b) => S(b).rahmen.zahlungen));
  ok(d((b) => S(b).rahmen.nachMaraCents) === 9999 + 5999 + 7400, "Davon nach Mara: P1 + P5 + P6 = 233,98 € (P5b selber Tag nicht)", d((b) => S(b).rahmen.nachMaraCents));
  ok(d((b) => S(b).rahmen.nachMaraOhneMeldungCents) === 9999 + 5999 + 7400, "… davon ohne Meldung vorher: alle drei", d((b) => S(b).rahmen.nachMaraOhneMeldungCents));
  ok(d((b) => S(b).rahmen.rate1Cents) === 9999 * 3 + 5999 + 4999, "Rate 1 getrennt ausgewiesen", d((b) => S(b).rahmen.rate1Cents));
  ok(d((b) => H(b).rahmen.geldCents) === 5999 + 4999, "Heute im Rahmen: P5 + P5b (Eingangstag heute)", d((b) => H(b).rahmen.geldCents));

  console.log("── Definitionen, Laufzeit ─────────────────────────────────────────");
  const pflicht = ["mail.geld", "whatsapp.geld", "postfach.beantwortet", "auskunft.bezahlt", "leads.leads", "leads.werbung", "rahmen.geld", "rahmen.nachMara", "rahmen.ki", "rahmen.kuendigungen"];
  ok(pflicht.every((k) => nach.definitionen[k]?.quelle && nach.definitionen[k]?.definition), "Jede Kernzahl hat Quelle und Definition im JSON");
  ok(/kein Beweis/.test(nach.hinweis), "Hinweis „zeitliche Folge, kein Beweis“ im JSON");
  ok(nach.dauerMs < 300, `Laufzeit ${nach.dauerMs} ms (< 300 ms, lokale DB)`, nach.dauerMs);
  const t1 = await B.maraBilanz({ frisch: true }); const t2 = await B.maraBilanz();
  ok(t2.ausZwischenspeicher === true && t1.ausZwischenspeicher === false, "Zweiter Abruf kommt aus dem Zwischenspeicher (60 s)");

  console.log("── Kacheln auf Geld-Wahrheit ──────────────────────────────────────");
  const kachel = await B.aktionWirkung14();
  ok(kachel.bezahlt - vorKachel.bezahlt === 2, "„Geld danach“ im Steuerpult: 2 Menschen (P1, P5) — vorher prüfte sie paid_at", kachel.bezahlt - vorKachel.bezahlt);
  ok(kachel.bezahlt_cents - vorKachel.bezahlt_cents === 15998, "… mit 159,98 € gebucht", kachel.bezahlt_cents - vorKachel.bezahlt_cents);
  ok(kachel.menschen - vorKachel.menschen === 4, "… Menschen ohne Testperson und ohne Mail älter als 14 Tage: +4", kachel.menschen - vorKachel.menschen);
  // WA-Wirkung: P4 bekommt eine Vorlage aus der Zentrale (gemeldet, kein Geld), P1 ebenfalls vor der Rate
  await sqlPool`INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, ok, erstellt_am) VALUES (${p4}, 'zahlung_offen', 'fiaon_kk_rechnung', 'hand', TRUE, ${vorTagen(3)})`;
  await sqlPool`INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, ok, erstellt_am) VALUES (${p1}, 'zahlung_offen', 'fiaon_kk_rechnung', 'hand', TRUE, ${vorTagen(2)})`;
  await sqlPool`INSERT INTO fiaon_wa_aktion (person_id, gruppe, vorlage, quelle, ok, erstellt_am) VALUES (${p3}, 'zahlung_offen', 'fiaon_kk_rechnung', 'hand', TRUE, ${vorTagen(2)})`;
  const wa = await B.waWirkung7();
  ok(wa.menschen - vorWa.menschen === 2, "„Wirkung 7 Tage“: 2 Menschen (Testperson nicht)", wa.menschen - vorWa.menschen);
  ok(wa.gezahlt - vorWa.gezahlt === 1 && wa.gezahlt_cents - vorWa.gezahlt_cents === 9999, "… 1 mit gebuchtem Geld (P1, 99,99 €); P4 nur gemeldet zählt nicht", [wa.gezahlt - vorWa.gezahlt, wa.gezahlt_cents - vorWa.gezahlt_cents]);

  console.log("── Punkt 4: Auskunft raus aus Mara-Aktion und zahlung_offen ────────");
  // P8: nur eine offene Auskunft (Paketschlüssel highend wie in der Produktion), P9: offenes Paket „pro"
  const p8 = await person({ telefon: "+491519924408" });
  await antrag(p8, `FIAON-SCHUFA-${MARKE}-8`, { type: "schufa", pack: "highend", status: "pending_payment", erstellt: vorTagen(3) });
  const p9 = await person({ telefon: "+491519924409" });
  await antrag(p9, `FIAON-${MARKE}-9`, { pack: "pro", status: "pending_payment", erstellt: vorTagen(3) });
  // P10: Auskunft nur über ref erkannt (type privat, ref FIAON-SCHUFA-…)
  const p10 = await person({ telefon: "+491519924410" });
  await antrag(p10, `FIAON-SCHUFA-${MARKE}-10`, { pack: "highend", status: "claimed_paid", claimedAt: vorTagen(3), erstellt: vorTagen(4) });
  const schlange = await kandidatenLaden(500, ["A", "B"]);
  const ids = new Set(schlange.map((k) => k.personId));
  ok(!ids.has(p8), "Mara-Aktion: offene Auskunft (type schufa, highend) steht NICHT in der Schlange");
  ok(!ids.has(p10), "Mara-Aktion: gemeldete Auskunft (nur über FIAON-SCHUFA-…) steht NICHT in der Schlange (Stufe A)");
  ok(ids.has(p9), "Mara-Aktion: offenes Paket „pro“ daneben steht in der Schlange (Gegenprobe)");
  const gruppe = (await sqlPool.unsafe(`${Z.BASIS} SELECT b.person_id FROM basis b WHERE ${Z.gruppenBedingung("zahlung_offen")} AND b.person_id = ANY($1)`, [[p8, p9]])) as any[];
  const gIds = new Set(gruppe.map((r: any) => Number(r.person_id)));
  ok(!gIds.has(p8), "WA-Zentrale zahlung_offen: offene Auskunft NICHT in der Gruppe");
  ok(gIds.has(p9), "WA-Zentrale zahlung_offen: offenes Paket in der Gruppe (Gegenprobe)");

  console.log("── Vorher gemeldet (Stufe A) und Kündigungen ───────────────────────");
  const vorA = await B.bilanzRechnen();
  // P13: Zahlung schon vor 10 Tagen GEMELDET (dieselbe Bestellung), Mara-Mail Stufe A vor 3 Tagen,
  // Rate 79,99 € mit Eingangstag gestern → Geld danach, aber „vorher gemeldet"
  const p13 = await person(); await antrag(p13, `FIAON-${MARKE}-13`, { status: "paid", claimedAt: vorTagen(10), erstellt: vorTagen(12) });
  await maraMail(p13, `FIAON-${MARKE}-13`, vorTagen(3), "A"); await rate(`FIAON-${MARKE}-13`, 7999, vorTagen(1));
  // P14: zwei Postfach-Fälle mit Kündigung vorgemerkt (zwei Handgriffe, EIN Mensch); P15 Testperson ebenso
  const p14 = await person(); await kuendigungVorgemerkt(p14, 1, vorTagen(1)); await kuendigungVorgemerkt(p14, 2, vorTagen(0.5));
  const p15 = await person({ test: true }); await kuendigungVorgemerkt(p15, 3, vorTagen(1));
  const nachA = await B.bilanzRechnen();
  const da = (f: (b: typeof nachA) => number) => f(nachA) - f(vorA as typeof nachA);
  ok(da((b) => b.zeitraeume.start.mail.geld.cents) === 7999, "P13 zählt als Geld nach der Mail (79,99 €)", da((b) => b.zeitraeume.start.mail.geld.cents));
  ok(da((b) => b.zeitraeume.start.mail.geldVorherGemeldet.cents) === 7999 && da((b) => b.zeitraeume.start.mail.geldVorherGemeldet.zahlungen) === 1,
    "… und steht unter „vorher gemeldet“ (1 × 79,99 €)", [da((b) => b.zeitraeume.start.mail.geldVorherGemeldet.cents), da((b) => b.zeitraeume.start.mail.geldVorherGemeldet.zahlungen)]);
  ok(da((b) => b.zeitraeume.start.rahmen.nachMaraCents) === 7999 && da((b) => b.zeitraeume.start.rahmen.nachMaraOhneMeldungCents) === 0,
    "Rahmen: nach Mara +79,99 €, ohne Meldung vorher +0", [da((b) => b.zeitraeume.start.rahmen.nachMaraCents), da((b) => b.zeitraeume.start.rahmen.nachMaraOhneMeldungCents)]);
  ok(da((b) => b.zeitraeume.start.rahmen.kuendigungen) === 1, "Kündigung vorgemerkt: +1 Mensch (zwei Handgriffe, Testperson nicht)", da((b) => b.zeitraeume.start.rahmen.kuendigungen));
  ok(da((b) => b.zeitraeume.start.postfach.handgriffe) === 4, "Postfach-Handgriffe: +4 (P14 zwei Fälle × zwei; Testperson nicht)", da((b) => b.zeitraeume.start.postfach.handgriffe));

  console.log("── Folgeraten: zwei gleiche am selben Tag, Meldung gilt Rate 1 ─────");
  // Befund Gesamtdurchsicht E-244: (a) die Kachel fasste zwei gleiche Raten am selben
  // Eingangstag per DISTINCT zu EINER zusammen; (b) claimed_paid_at (Meldung zu Rate 1)
  // machte jede Folgerate zu „vorher gemeldet".
  const vorR = await B.bilanzRechnen();
  const vorRK = await B.aktionWirkung14();
  // P16: Rate 1 vor 10 Tagen gemeldet, vor 9 Tagen gebucht; Mara-Mail vor 3 Tagen;
  // Rate 2 und 3 je 29,99 € mit demselben Eingangstag gestern.
  const p16 = await person(); await antrag(p16, `FIAON-${MARKE}-16`, { status: "paid", claimedAt: vorTagen(10), erstellt: vorTagen(12) });
  await rate(`FIAON-${MARKE}-16`, 2999, vorTagen(9), 1);
  await maraMail(p16, `FIAON-${MARKE}-16`, vorTagen(3), "A");
  await rate(`FIAON-${MARKE}-16`, 2999, vorTagen(1), 2, vorTagen(20)); await rate(`FIAON-${MARKE}-16`, 2999, vorTagen(1), 3, vorTagen(2));
  const nachR = await B.bilanzRechnen();
  const nachRK = await B.aktionWirkung14();
  const dr = (f: (b: typeof nachR) => number) => f(nachR) - f(vorR as typeof nachR);
  ok(dr((b) => b.zeitraeume.start.mail.geld.cents) === 5998 && dr((b) => b.zeitraeume.start.mail.geld.zahlungen) === 2,
    "Bilanz: Rate 2 + 3 nach der Mail = 2 × 29,99 € (Rate 1 lag davor)", [dr((b) => b.zeitraeume.start.mail.geld.cents), dr((b) => b.zeitraeume.start.mail.geld.zahlungen)]);
  ok(dr((b) => b.zeitraeume.start.mail.geldVorherGemeldet.cents) === 0,
    "Folgeraten nie „vorher gemeldet“ (Meldung galt Rate 1)", dr((b) => b.zeitraeume.start.mail.geldVorherGemeldet.cents));
  ok(dr((b) => b.zeitraeume.start.rahmen.nachMaraOhneMeldungCents) === 5998,
    "Rahmen: ohne Meldung vorher +59,98 €", dr((b) => b.zeitraeume.start.rahmen.nachMaraOhneMeldungCents));
  ok(nachRK.bezahlt_cents - vorRK.bezahlt_cents === 5998 && nachRK.bezahlt - vorRK.bezahlt === 1,
    "Kachel „Geld danach“: 59,98 € (kein DISTINCT mehr), 1 Mensch", [nachRK.bezahlt_cents - vorRK.bezahlt_cents, nachRK.bezahlt - vorRK.bezahlt]);

  console.log("── Neue Leads (Rechnung des Lead-Motors) ──────────────────────────");
  const vorL = await B.bilanzRechnen();
  // P11: Meta-Lead vor 2 Tagen, Antrag danach abgeschickt, Rate 1 gebucht → Lead, begonnen, fertig, zahlend
  const p11 = await person({ telefon: "+491519924411" });
  await sqlPool`INSERT INTO fiaon_leads (person_id, quelle, meta_lead_id, meta_kampagne_id, kampagne, eingangsweg, erstellt_am)
                VALUES (${p11}, 'facebook_lead_ads', ${"E244B-L11"}, '999244', 'Prüfkampagne E244B', 'meta_nachhol', ${vorTagen(2)})`;
  await antrag(p11, `FIAON-${MARKE}-11`, { status: "paid", pack: "pro", erstellt: vorTagen(1.5) });
  await rate(`FIAON-${MARKE}-11`, 9999, vorTagen(1));
  // P12: Meta-Lead gestern, Antrag nur begonnen (Schritt 3, noch ohne Zahlungsstatus — pending_payment zählt der Lead-Motor schon als fertig)
  const p12 = await person({ telefon: "+491519924412" });
  await sqlPool`INSERT INTO fiaon_leads (person_id, quelle, meta_lead_id, meta_kampagne_id, kampagne, eingangsweg, erstellt_am)
                VALUES (${p12}, 'facebook_lead_ads', ${"E244B-L12"}, '999244', 'Prüfkampagne E244B', 'meta_nachhol', ${vorTagen(1)})`;
  await sqlPool`INSERT INTO fiaon_applications (ref, person_id, email, type, payment_status, created_at, current_step, status)
                VALUES (${`FIAON-${MARKE}-12`}, ${p12}, 'e244b-12@pruef.invalid', 'private', NULL,
                        ${vorTagen(0.5).toISOString().slice(0, 19).replace("T", " ")}, 3, 'finances')`;
  const nachL = await B.bilanzRechnen();
  const dl = (f: (b: typeof nachL) => number) => f(nachL) - f(vorL as typeof nachL);
  ok(dl((b) => b.zeitraeume.start.leads.leads) === 2, "Leads seit Start: +2", dl((b) => b.zeitraeume.start.leads.leads));
  ok(dl((b) => b.zeitraeume.start.leads.begonnen) === 2, "Antrag begonnen: +2", dl((b) => b.zeitraeume.start.leads.begonnen));
  ok(dl((b) => b.zeitraeume.start.leads.fertig) === 1, "Antrag fertig: +1 (P11; P12 steht in Schritt 3)", dl((b) => b.zeitraeume.start.leads.fertig));
  ok(dl((b) => b.zeitraeume.start.leads.zahlende) === 1 && dl((b) => b.zeitraeume.start.leads.umsatzCents) === 9999, "Zahlend: +1 mit 99,99 € (Rate 1 gebucht)", [dl((b) => b.zeitraeume.start.leads.zahlende), dl((b) => b.zeitraeume.start.leads.umsatzCents)]);
  ok(dl((b) => b.zeitraeume.heute.leads.leads) === 0, "Heute: kein neuer Lead (beide älter)", dl((b) => b.zeitraeume.heute.leads.leads));
} catch (e) {
  // Bis 26.09. schluckte finally → process.exit(0) jede Ausnahme: grün trotz Abbruch.
  ok(false, "Ausnahme im Prüfstand", String((e as any)?.message || e).slice(0, 400));
} finally {
  await aufraeumen();
  await sqlPool`DELETE FROM fiaon_leads WHERE meta_lead_id LIKE 'E244B-%'`.catch(() => {});
  const [rest] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE ${MARKE + "-%"}`) as any[];
  ok(Number(rest.n) === 0, "Aufgeräumt: keine E244B-Zeilen mehr");
  console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  await sqlPool.end({ timeout: 2 });
  process.exit(fehler === 0 ? 0 : 1);
}
