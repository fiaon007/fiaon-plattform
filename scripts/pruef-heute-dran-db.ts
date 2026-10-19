// Prüfstand E-406 A (19.10.2026), Datenbank-Teil: „Heute dran“ — Testdaten aus JEDER Quelle, die Liste stimmt,
// die Klickziele stimmen. Mit erfundenen Testkunden (.invalid) gegen eine LOKALE Prüfdatenbank. Kein Netz, keine Mail.
// Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   createdb -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e406a
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406a?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-heute-dran-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); } }

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const H = await import("../server/lib/fiaon-heute-dran");
  const S = await import("../shared/fiaon-heute-dran");

  // Berliner Kalendertag heute und Hilfen für feste Uhrzeiten HEUTE (Berlin), egal wann der Prüfstand läuft.
  const heute = S.berlinTag(new Date())!;
  const morgen = S.berlinTag(new Date(Date.now() + 24 * 3600_000))!;
  const versatz = (() => {
    const t: Record<string, string> = {};
    for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "shortOffset" }).formatToParts(new Date())) t[p.type] = p.value;
    const m = /GMT([+-]\d+)/.exec(t.timeZoneName ?? "GMT+2");
    return `${m && Number(m[1]) < 0 ? "-" : "+"}${String(Math.abs(Number(m?.[1] ?? 2))).padStart(2, "0")}:00`;
  })();
  const heuteUm = (hhmm: string) => `${heute}T${hhmm}:00${versatz}`;
  const isodow = Number((await sql`SELECT EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int AS d`)[0].d);

  console.log("── Aufbau: Team und Arbeitszeiten heute");
  await sql`UPDATE fiaon_agents SET rolle = 'vertriebsleiter' WHERE id IN (8, 10, 13)`;
  await sql`UPDATE fiaon_agents SET rolle = 'agent' WHERE id IN (505, 531)`;
  await sql`UPDATE fiaon_agents SET active = TRUE, zugang_gesperrt_am = NULL, schulung_offen = FALSE, is_test_account = FALSE, pruefkonto = FALSE WHERE id IN (8, 10, 13, 505, 531)`;
  await sql`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id IN (8, 10, 13, 505, 531)`;
  // 8: 9 Std (25 Plätze) · 10: 4 Std (13 Plätze) · 505: 8 Std · 13 und 531: heute keine Zeit.
  await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv) VALUES
              (8, ${isodow}, '09:00', '18:00', TRUE), (10, ${isodow}, '09:00', '13:00', TRUE), (505, ${isodow}, '09:00', '17:00', TRUE)`;
  // Die Team-Abwesenheit ist aus.
  await sql`DELETE FROM fiaon_settings WHERE key = 'team_abwesenheit'`;

  let n = 0;
  const person = async (vn: string, nn: string, agent: number | null, extra: { tier?: number; test?: boolean; blocked?: boolean } = {}) => {
    n++;
    // Angelegt vor 60 Tagen — sonst wäre die Anlage selbst das jüngste „Ereignis“ der Pipeline (EREIGNIS_SQL).
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, priority_tier, ist_test_am, is_blocked, created_at)
                           VALUES (${`PR-E406-${n}`}, ${vn}, ${nn}, ${`${nn.toLowerCase()}${n}@test.invalid`}, ${agent}, ${extra.tier ?? 0},
                                   ${extra.test ? new Date() : null}, ${extra.blocked === true}, NOW() - INTERVAL '60 days') RETURNING id`) as any[];
    return Number(p.id);
  };
  const antrag = async (pid: number, teil: Record<string, unknown> = {}) => {
    n++;
    const ref = String(teil.ref ?? `FIAON-E406-${n}`);
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, agb_stand, first_name, last_name, email, payment_reference)
              VALUES (${ref}, ${pid}, ${String(teil.type ?? "private")}, ${String(teil.pack_key ?? "high_end")}, ${String(teil.pack_name ?? "FIAON High-End")},
                      ${String(teil.payment_status ?? "paid")}, NOW() - INTERVAL '40 days', '2026-10-05', 'Test', 'Kunde', ${`k${n}@test.invalid`}, ${`E406-${n}`})`;
    const rest = Object.entries(teil).filter(([k]) => !["ref", "type", "pack_key", "pack_name", "payment_status"].includes(k));
    for (const [k, v] of rest) await sql.unsafe(`UPDATE fiaon_applications SET ${k} = $1 WHERE ref = $2`, [v as any, ref]);
    return ref;
  };
  const rate = async (ref: string, nr: number, faelligTageZurueck: number, teil: Record<string, unknown> = {}) => {
    const [r] = (await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status)
                           VALUES (${ref}, ${nr}, ${`${ref}-R${nr}`}, 5999, (NOW() AT TIME ZONE 'Europe/Berlin')::date - ${faelligTageZurueck}::int, 'offen') RETURNING id`) as any[];
    for (const [k, v] of Object.entries(teil)) await sql.unsafe(`UPDATE fiaon_abo_raten SET ${k} = $1 WHERE id = $2`, [v as any, r.id]);
    return Number(r.id);
  };

  console.log("── Testdaten aus jeder Quelle");
  // 1 · Termine
  const pTermin = await person("Tara", "Terminprobe", 8);
  await antrag(pTermin);
  const [tOffen] = (await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${pTermin}, 8, ${heuteUm("12:00")}, 'gebucht', 'agent_manuell') RETURNING id`) as any[];
  const pTerminFertig = await person("Fritz", "Gefuehrt", 8);
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, erledigt_am) VALUES (${pTerminFertig}, 8, ${heuteUm("09:30")}, 'erledigt', 'onboarding_call', NOW())`;
  const pAbgesagt = await person("Anna", "Abgesagt", 8);
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, abgesagt_am) VALUES (${pAbgesagt}, 8, ${heuteUm("13:00")}, 'abgesagt', 'agent_manuell', NOW())`;
  const pMorgen = await person("Mona", "Morgen", 8);
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${pMorgen}, 8, ${`${morgen}T12:00:00${versatz}`}, 'gebucht', 'agent_manuell')`;
  const pJustin = await person("Jakob", "Gruendertermin", 928);
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${pJustin}, 928, ${heuteUm("14:00")}, 'gebucht', 'gruender')`;
  const pTest = await person("Tom", "Testperson", 8, { test: true });
  await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle) VALUES (${pTest}, 8, ${heuteUm("11:00")}, 'gebucht', 'agent_manuell')`;

  // 2 · Rückrufe: vereinbart heute 15:00 (offen) + einer heute geführt; Rückruf-Wunsch mit gerissener Frist.
  const pRr = await person("Rita", "Rueckruf", 8);
  const refRr = await antrag(pRr, { payment_status: "pending" });
  await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, scheduled_at, created_at)
            VALUES (${refRr}, ${pRr}, 8, 'Test', 'result', 'rueckruf_termin', ${heuteUm("15:00")}, NOW() - INTERVAL '2 days')`;
  const pRrFertig = await person("Ralf", "Zurueckgerufen", 8);
  const refRrF = await antrag(pRrFertig, { payment_status: "pending" });
  await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, scheduled_at, created_at, done_at)
            VALUES (${refRrF}, ${pRrFertig}, 8, 'Test', 'result', 'rueckruf_termin', ${heuteUm("08:15")}, NOW() - INTERVAL '3 days', NOW())`;
  const pWunsch = await person("Wilma", "Wunsch", 10);
  const [rw] = (await sql`INSERT INTO fiaon_rueckrufe (person_id, quelle, anliegen, zustaendig_agent_id, frist_bis, status, created_at)
                          VALUES (${pWunsch}, 'manuell', 'Kundin möchte zur Rate sprechen', 10, NOW() - INTERVAL '1 day', 'offen', NOW() - INTERVAL '2 days') RETURNING id`) as any[];
  void rw;

  // 3 · Aufträge
  const pKuend = await person("Karl", "Kuendigung", 8);
  const [aKuend] = (await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, zustaendig_agent_id, status, faellig_am, eingang_am)
                              VALUES ('Kündigung: bitte bearbeiten', 'kuendigung', ${pKuend}, 'agent', 8, 'offen', (NOW() AT TIME ZONE 'Europe/Berlin')::date + 2, NOW() - INTERVAL '3 days') RETURNING id`) as any[];
  const pMail = await person("Maja", "Mailprobe", 8);
  const [aMail] = (await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, zustaendig_agent_id, status, faellig_am, eingang_am)
                             VALUES ('Kunde hat geschrieben', 'mara_mail', ${pMail}, 'agent', 8, 'offen', (NOW() AT TIME ZONE 'Europe/Berlin')::date - 1, NOW() - INTERVAL '1 day') RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, zustaendig_agent_id, status, erledigt_am)
            VALUES ('Hinweis von Mara', 'mara_hinweis', ${await person("Erik", "Erledigt", 8)}, 'agent', 8, 'erledigt', NOW())`;
  const pWartet = await person("Walter", "Wartet", 8);
  await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, zustaendig_agent_id, status)
            VALUES ('Frage an die Leitung', 'mara_aufgabe', ${pWartet}, 'agent', 8, 'wartet')`;
  const pBoard = await person("Bruno", "Board", 8);
  await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, status) VALUES ('Nur für Justin', 'verwaltung', ${pBoard}, 'betreiber', 'offen')`;
  const pSpaeter = await person("Sina", "Spaeter", 8);
  await sql`INSERT INTO fiaon_betreiber_todos (titel, art, person_id, zustaendig_art, zustaendig_agent_id, status, faellig_am)
            VALUES ('Unterlage anfordern', 'unterlage', ${pSpaeter}, 'agent', 8, 'offen', (NOW() AT TIME ZONE 'Europe/Berlin')::date + 3)`;
  const [aOhne] = (await sql`INSERT INTO fiaon_betreiber_todos (titel, art, zustaendig_art, zustaendig_agent_id, status, eingang_am)
                             VALUES ('Allgemeine Aufgabe ohne Kunden', 'sonstiges', 'agent', 10, 'offen', NOW() - INTERVAL '6 days') RETURNING id`) as any[];

  // 4 · Inkasso
  const pRate = await person("Ines", "Ratefrisch", 8);
  const refRate = await antrag(pRate);
  await rate(refRate, 2, 1);
  const pAlt = await person("Otto", "Altbestand", 10);
  const refAlt = await antrag(pAlt);
  await rate(refAlt, 2, 45);
  const pOhneBetreuer = await person("Olga", "Ohnebetreuer", null);
  const refOhne = await antrag(pOhneBetreuer);
  await rate(refOhne, 2, 2);
  const pBezahlt = await person("Benno", "Bezahlt", 8);
  const refBez = await antrag(pBezahlt);
  await rate(refBez, 2, 1, { status: "bezahlt", bezahlt_am: new Date() });
  const pWv = await person("Vera", "Wiedervorlage", 8);
  const refWv = await antrag(pWv);
  await rate(refWv, 2, 5, { inkasso_wiedervorlage: morgen });
  const pGesperrtBetreuer = await person("Gerd", "Gesperrtbetreut", 802);
  const refG = await antrag(pGesperrtBetreuer);
  await rate(refG, 2, 10);

  // 5 · Zahlung gemeldet
  const pA = await person("Alma", "Gemeldet", 8, { tier: 1 });
  await antrag(pA, { payment_status: "claimed_paid", claimed_paid_at: new Date(Date.now() - 5 * 3600_000), amount_due: 79.99 });
  const pA5 = await person("Arno", "Fuenftage", 8, { tier: 1 });
  await antrag(pA5, { payment_status: "claimed_paid", claimed_paid_at: new Date(Date.now() - 5 * 86_400_000), amount_due: 59.99 });
  const pA20 = await person("Adam", "Zwanzigtage", 8, { tier: 1 });
  await antrag(pA20, { payment_status: "claimed_paid", claimed_paid_at: new Date(Date.now() - 20 * 86_400_000) });
  const pGesperrt = await person("Gina", "Vertriebssperre", 8, { tier: 1, blocked: true });
  await antrag(pGesperrt, { payment_status: "claimed_paid", claimed_paid_at: new Date(Date.now() - 2 * 3600_000) });
  const pAbezahlt = await person("Arne", "Eingegangen", 8);
  await antrag(pAbezahlt, { payment_status: "paid", claimed_paid_at: new Date(Date.now() - 30 * 3600_000), paid_at: new Date() });

  // 6 · KYC
  const doku = async (pid: number, geprueft: Date | null) => {
    n++;
    await sql`INSERT INTO fiaon_dokumente (doc_hash, person_id, art, dateiname, mime, bytes, inhalt, quelle, kategorie, geprueft_am, geprueft_von_agent_id)
              VALUES (${`hash-e406-${n}`}, ${pid}, 'unterlage', 'ausweis.pdf', 'application/pdf', 3, '\\x010203'::bytea, 'kunde', 'ausweis', ${geprueft}, ${geprueft ? 10 : null})`;
  };
  const pKyc = await person("Kira", "Kycoffen", 10);
  await antrag(pKyc, { documents_uploaded_at: new Date(Date.now() - 2 * 86_400_000), kyc_status: "pending" });
  await doku(pKyc, null);
  const pKycGek = await person("Kurt", "Gekuendigt", 10);
  await antrag(pKycGek, { documents_uploaded_at: new Date(Date.now() - 2 * 86_400_000), kyc_status: "pending", gekuendigt_am: new Date(Date.now() - 86_400_000) });
  await doku(pKycGek, null);
  const pKycFertig = await person("Klaus", "Geprueft", 10);
  await antrag(pKycFertig, { documents_uploaded_at: new Date(Date.now() - 3 * 86_400_000), kyc_status: "pending" });
  await doku(pKycFertig, new Date());

  // 7 · Anliegen
  const pTicket = await person("Tina", "Ticket", 10);
  const refT = await antrag(pTicket);
  const [tk] = (await sql`INSERT INTO fiaon_tickets (ref, person_id, agent_id, betreff, text, status) VALUES (${refT}, ${pTicket}, 10, 'Frage zur Karte', 'Wann kommt meine Karte?', 'offen') RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_tickets (ref, person_id, agent_id, betreff, text, status, beantwortet_am, beantwortet_von) VALUES (${refT}, ${pTicket}, 10, 'Adresse', 'Neue Adresse', 'erledigt', NOW(), 10)`;

  // 8 · Hitze: ein frischer B-Antrag (vor 2 Std. abgeschickt, noch nie angerufen) bei 505.
  const pHitze = await person("Hanna", "Hitzeprobe", 505, { tier: 2 });
  await antrag(pHitze, { payment_status: "pending", status: "submitted", current_step: 8, submitted_at: new Date(Date.now() - 2 * 3600_000) });
  await sql`UPDATE fiaon_applications SET created_at = NOW() - INTERVAL '3 hours' WHERE person_id = ${pHitze}`;

  // 9 · Bonität: Auskunft bezahlt, Unterlagen da → „Auswertung starten“.
  const pBoni = await person("Berta", "Bonitaet", 505);
  await antrag(pBoni, { type: "schufa", pack_key: "schufa", pack_name: "Bonitätsauskunft", ref: `FIAON-SCHUFA-E406${n}`, paid_at: new Date(Date.now() - 4 * 86_400_000) });
  await sql`UPDATE fiaon_applications SET id_card_pdf = '\\x01'::bytea, bank_statement_pdf = '\\x01'::bytea WHERE person_id = ${pBoni}`;

  console.log("── Plan rechnen");
  H.heuteDranVergessen();
  const stand = await H.planRechnen(sql);
  ok(stand.fehlend.length === 0, "alle Quellen lesbar", stand.fehlend);
  const p = (id: number) => stand.plan.personen.find((x) => x.agentId === id)!;
  const alle = stand.plan.personen.flatMap((x) => [...x.offen, ...x.erledigt, ...x.rueckstau]);
  const von = (pid: number) => alle.filter((z) => z.personId === pid);
  const offenBei = (agent: number, pid: number) => p(agent).offen.find((z) => z.personId === pid);
  ok(!!p(8) && !!p(10) && !!p(505) && !!p(13) && !!p(531), "Team: 8, 10, 13, 505, 531");
  ok(!stand.plan.personen.some((x) => x.agentId === 928 || x.agentId === 929 || x.agentId === 802), "Justin, Testkonten und Gesperrte haben keine Liste");
  ok(p(8).kapazitaet === 25 && p(10).kapazitaet === 13 && p(505).kapazitaet === 25 && p(13).kapazitaet === 0, "Tagesmenge nach Arbeitszeit (25 / 13 / 25 / 0)",
    stand.plan.personen.map((x) => [x.agentId, x.minuten, x.kapazitaet]));

  console.log("── 1 · Termine");
  const t = offenBei(8, pTermin);
  ok(t?.stufe === 1 && t.quelle === "termin", "Termin heute 12:00 → Stufe 1 bei 8", t);
  ok(t?.ziel === `/agent/kunden?person=${pTermin}`, "Klickziel: Akte", t?.ziel);
  ok(p(8).erledigt.some((z) => z.personId === pTerminFertig && z.quelle === "termin"), "geführter Termin zählt als erledigt");
  ok(von(pAbgesagt).length === 0 && von(pMorgen).length === 0, "abgesagt und morgen: nicht dabei");
  ok(von(pJustin).length === 0 && stand.plan.beiGeschaeftsfuehrung >= 1, "Justins Termin: auf keiner Liste, bei der Geschäftsführung gezählt", stand.plan.beiGeschaeftsfuehrung);
  ok(von(pTest).length === 0, "Testperson: nicht dabei");
  void tOffen;

  console.log("── 2 · Rückrufe");
  const r = offenBei(8, pRr);
  ok(r?.stufe === 1 && /15:00/.test(r.grund), "vereinbarter Rückruf heute 15:00 → Stufe 1", r);
  const reihe1 = p(8).offen.filter((z) => z.stufe === 1).map((z) => z.personId);
  ok(reihe1.indexOf(pTermin) >= 0 && reihe1.indexOf(pTermin) < reihe1.indexOf(pRr), "Zeitfolge: 12:00 vor 15:00", reihe1);
  ok(p(8).erledigt.some((z) => z.personId === pRrFertig), "geführter Rückruf zählt als erledigt");
  const w = [...p(10).offen, ...p(10).rueckstau].find((z) => z.personId === pWunsch);
  ok(w?.quelle === "rueckruf" && /Frist vorbei/.test(w.grund) && w.stufe === 6, "Rückruf-Wunsch mit gerissener Frist → bei 10, „Frist vorbei“", w);

  console.log("── 3 · Aufträge");
  const k = offenBei(8, pKuend);
  ok(k?.stufe === 3 && k.ziel === `/agent/kunden?person=${pKuend}&auftrag=${aKuend.id}`, "Kündigung → Stufe 3 (auch vor der Fälligkeit), Ziel Akte mit Auftrag", k);
  const m = offenBei(8, pMail);
  ok(m?.stufe === 6 && m.ziel.endsWith(`&auftrag=${aMail.id}`), "Kunde hat geschrieben → Rest, Ziel mit Auftrag", m);
  ok(p(8).erledigt.some((z) => z.quelle === "auftrag"), "heute geschlossener Auftrag zählt als erledigt");
  ok(von(pWartet).length === 0 && von(pBoard).length === 0 && von(pSpaeter).length === 0, "„wartet“, Justins Board und noch nicht fällig: nicht dabei");
  const ohneKunde = [...p(10).offen, ...p(10).rueckstau].find((z) => z.schluessel === `auftrag:${aOhne.id}`);
  ok(ohneKunde?.ziel === `/agent/aufgaben?reiter=auftraege&auftrag=${aOhne.id}`, "Auftrag ohne Kunden → Tasks mit Auftrag", ohneKunde);

  console.log("── 4 · Inkasso");
  const i = offenBei(8, pRate);
  ok(i?.stufe === 2 && i.quelle === "inkasso" && i.betragCents === 5999, "Rate seit gestern → Stufe 2 (Geld frisch), 59,99 €", i);
  ok(i?.ziel === `/agent/inkasso?person=${pRate}`, "Klickziel: Inkasso mit Kunde", i?.ziel);
  const alt = [...p(10).offen, ...p(10).rueckstau].find((z) => z.personId === pAlt);
  ok(alt?.stufe === 7, "Rate seit 45 Tagen → Altbestand (Stufe 7)", alt);
  const liste10 = [...p(10).offen, ...p(10).rueckstau];
  ok(liste10.findIndex((z) => z.stufe === 7) === liste10.length - 1 || liste10.slice(liste10.findIndex((z) => z.stufe === 7)).every((z) => z.stufe === 7),
    "Altbestand steht unten", liste10.map((z) => z.stufe));
  const ob = alle.find((z) => z.personId === pOhneBetreuer);
  ok(!!ob && ob.verteilt && [8, 10].some((id) => [...p(id).offen, ...p(id).rueckstau].includes(ob)), "Rate ohne Betreuer → an die Leitung verteilt (nie an 505/531)", ob);
  const og = alle.find((z) => z.personId === pGesperrtBetreuer);
  ok(!!og && og.verteilt, "Rate beim gesperrten Konto (802) → verteilt, nicht verloren", og);
  ok(p(8).erledigt.some((z) => z.personId === pBezahlt && /bezahlt/.test(z.grund)), "heute bezahlte Rate zählt als erledigt");
  ok(von(pWv).length === 0, "Wiedervorlage morgen: heute nicht dran");

  console.log("── 5 · Zahlung gemeldet");
  const za = offenBei(8, pA);
  ok(za?.stufe === 2 && za.quelle === "zahlung" && za.betragCents === 7999, "gemeldet vor 5 Std. → Stufe 2, 79,99 €", za);
  const z5 = [...p(8).offen, ...p(8).rueckstau].find((z) => z.personId === pA5);
  ok(!!z5 && z5.stufe === 6, "gemeldet vor 5 Tagen → Rest", z5);
  ok(!alle.some((z) => z.personId === pA20 && z.quelle === "zahlung"), "älter als 14 Tage → nicht hier (14-Tage-Regel)");
  ok(!alle.some((z) => z.personId === pGesperrt && z.quelle === "zahlung"), "Vertriebssperre → nicht hier");
  ok(p(8).erledigt.some((z) => z.personId === pAbezahlt && z.quelle === "zahlung"), "heute eingegangen → erledigt");

  console.log("── 6 · KYC");
  const ky = [...p(10).offen, ...p(10).rueckstau].find((z) => z.personId === pKyc);
  ok(ky?.quelle === "kyc" && ky.ziel === `/agent/kunden?person=${pKyc}`, "KYC offen bei laufendem Vertrag → bei 10, Akte", ky);
  ok(!alle.some((z) => z.personId === pKycGek), "gekündigter Vertrag → kein KYC");
  ok(p(10).erledigt.some((z) => z.personId === pKycFertig && z.quelle === "kyc"), "heute geprüft → erledigt");

  console.log("── 7 · Anliegen");
  const an = [...p(10).offen, ...p(10).rueckstau].find((z) => z.schluessel === `anliegen:${tk.id}`)
    ?? [...p(10).offen, ...p(10).rueckstau].find((z) => z.personId === pTicket);
  ok(an?.ziel === `/agent/anliegen?ticket=${tk.id}` || an?.weitere.some((g) => /Anliegen/.test(g)), "offenes Anliegen → Ziel Anliegen mit Nummer", an);
  ok(p(10).erledigt.some((z) => z.quelle === "anliegen"), "heute beantwortet → erledigt");

  console.log("── 8 · Hitze (Pipeline)");
  const hz = offenBei(505, pHitze);
  ok(hz?.quelle === "hitze" && hz.stufe === 4, "frischer B-Antrag → Stufe 4 bei 505", hz ?? p(505).offen);

  console.log("── 9 · Bonität");
  const bo = offenBei(505, pBoni);
  ok(bo?.quelle === "bonitaet" && bo.stufe === 5 && /starten/.test(bo.grund), "bezahlte Auskunft, Unterlagen da → Stufe 5 „Auswertung starten“", bo ?? p(505).offen);

  console.log("── Liste, Reihenfolge, Ziele");
  ok(alle.every((z) => S.zielErlaubt(z.ziel) && !z.ziel.includes("/chef/")), "jedes Klickziel ist eine Stelle im Office, nie /chef/");
  const stufen8 = p(8).offen.map((z) => z.stufe);
  ok(stufen8.every((s, idx) => idx === 0 || stufen8[idx - 1] <= s), "8: nach Wirkung sortiert", stufen8);
  ok(p(8).zahlen.heuteDran === p(8).offen.length + p(8).erledigt.length && p(8).zahlen.erledigt === p(8).erledigt.length, "8: „N von M erledigt“ stimmt", p(8).zahlen);
  ok(p(13).offen.length === 0 && /keine Arbeitszeit/.test(p(13).hinweis ?? ""), "13 (keine Zeit heute): leere Liste mit Hinweis", p(13));
  ok([...p(505).offen, ...p(505).rueckstau, ...p(531).rueckstau].every((z) => !z.verteilt), "Bonitätsmanager bekommen nichts Fremdes");
  ok(p(10).offen.length <= p(10).kapazitaet, "10: nie mehr als die Tagesmenge (13)", p(10).zahlen);

  console.log("── Rot-Probe");
  {
    // Ohne die Konten der Geschäftsführung stünde Justins Termin auf einer Liste — genau das prüft „nie Justin“.
    const { team } = await H.teamLesen(sql);
    const { eintraege } = await H.eintraegeLesen(sql, { team: [...team, { id: 928, name: "J", rolle: "vertriebsleiter", minuten: 480 }], betreiberIds: [] });
    const falsch = S.planen(eintraege, [...team, { id: 928, name: "J", rolle: "vertriebsleiter", minuten: 480 }], { betreiberIds: [] });
    ok(falsch.personen.some((x) => [...x.offen, ...x.rueckstau].some((z) => z.personId === pJustin)), "ohne betreiberIds fiele Justins Termin auf eine Liste — die Prüfung oben würde rot");
    // Wird die Rate bezahlt, ist sie erledigt — derselbe Stand liest es aus der Quelle, ohne Abhak-Speicher.
    await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE ref = ${refRate}`;
    const neu = await H.planRechnen(sql);
    const p8 = neu.plan.personen.find((x) => x.agentId === 8)!;
    ok(!p8.offen.some((z) => z.personId === pRate) && p8.erledigt.some((z) => z.personId === pRate), "Rate bezahlt → wandert von offen nach erledigt");
  }

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
