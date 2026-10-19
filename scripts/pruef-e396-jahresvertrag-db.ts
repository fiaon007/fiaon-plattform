// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-396 (19.10.2026), DATENBANK-TEIL — Jahresvertrag kündigen, Kulanz nach Zahlung, Altvertrag unverändert,
// Widerruf unverändert. Mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank; kein Netz, keine Mail (keine
// Schlüssel). Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e396?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-e396-jahresvertrag-db.ts
// (Die Datenbank vorher frisch aus fiaon_pruefstand_e372_vorlage anlegen und node scripts/run-migrations.mjs laufen lassen.)
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];

let gut = 0, schlecht = 0;
const rot: string[] = [];
function ok(b: unknown, was: string, extra = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; rot.push(was); console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); }
}

/** JJJJ-MM-TT (Berlin) eines Zeitpunkts. */
const tagB = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null);
/** Heute ± n Tage als JJJJ-MM-TT (Berlin). */
function tagPlus(n: number): string {
  const d = new Date(`${tagB(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const KU = await import("../server/lib/fiaon-kuendigung");
  const ABO = await import("../server/routes/fiaon-abo");
  const JV = await import("../shared/fiaon-jahresvertrag");
  await ABO.ensureAboTabellen();
  await KU.kuendigungSpalten();
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  await E.entscheidungTabellen();
  const sql = sqlPool;

  // ── Testkunden ─────────────────────────────────────────────────────────
  const person = async (nn: string) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PR-E396-${nn}`}, 'Test', ${nn}, ${`${nn.toLowerCase()}@test.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  };
  /** Eine bezahlte Bestellung. `knopf` = consent_contract; `annahme` = Vertragsannahme mit PDF am Tag. */
  const bestellung = async (ref: string, o: { agb: string; knopf?: boolean; annahme?: string | null; erstelltLog?: string | null; bezahlt?: boolean; created: string; completed?: string | null }) => {
    const pid = await person(ref.replace(/[^A-Z0-9]/gi, "").slice(-8));
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, completed_at, agb_stand, consent_contract,
                                              first_name, last_name, email, payment_reference)
              VALUES (${ref}, ${pid}, 'private', 'pro', 'FIAON Pro', ${o.bezahlt === false ? "pending_payment" : "paid"}, ${`${o.created} 10:00:00`}, ${o.completed ? `${o.completed} 12:00:00` : null},
                      ${o.agb}, ${o.knopf === true}, 'Test', 'Person', ${`${ref.toLowerCase()}@test.invalid`}, ${`${ref}-RF`})`;
    if (o.annahme) {
      await sql`INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, paket, rate_cents, gesamt_cents, vertrag_fassung, leistung_fassung,
                                                    agb_fassung, knopf_text, haken, sofort_beginn, vertrag_html, vertrag_sha256, vertrag_pdf)
                VALUES (${ref}, ${pid}, 'neu', ${`${o.annahme}T10:00:00Z`}, 'pro', 5999, 71988, 'PV-test', 'L-test', ${o.agb}, 'Zahlungspflichtig annehmen',
                        '{}'::jsonb, FALSE, '<p>Test</p>', 'test', ${Buffer.from("%PDF-test")})`;
    }
    if (o.erstelltLog) {
      await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                VALUES (${ref}, ${pid}, NULL, 'System', 'system', 'Erste Rechnung gestellt (automatisch beim Antragsabschluss): 59.99 €, Verwendungszweck X — verschickt an test.', ${`${o.erstelltLog}T09:00:00Z`})`;
    }
    return pid;
  };
  const rate = async (ref: string, nr: number, faellig: string, bezahlt: string | null) => {
    const [r] = (await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, bezahlt_am, zahlungsreferenz)
                           VALUES (${ref}, ${nr}, 5999, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt ? `${bezahlt}T12:00:00Z` : null}, ${`${ref}-RF-${nr}`}) RETURNING id`) as any[];
    return Number(r.id);
  };
  const zeile = async (ref: string) => ((await sql`SELECT * FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
  const raten = async (ref: string) => (await sql`SELECT id, rate_nr, status, storno_grund, faellig_am FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[];

  // Vertragsschluss 40 Tage zurück (Knopf-Beleg im Verlauf), Rate 1 einen Tag später bezahlt, Rate 2 offen in 10 Tagen.
  const beginn1 = tagPlus(-40);
  const J1 = "FIAON-E396-J1";
  await bestellung(J1, { agb: "2026-09-03", knopf: true, erstelltLog: beginn1, created: beginn1, completed: tagPlus(-39) });
  await rate(J1, 1, tagPlus(-39), tagPlus(-39));
  const j1r2 = await rate(J1, 2, tagPlus(-9), null);

  console.log("── 1 · Annahme, Vertragsschluss, Vorschau (jahresvertragLage) ─────────────────");
  const l1 = await KU.jahresvertragLage(J1);
  ok(l1?.belegt === true && l1.beginn === beginn1, "Knopf belegt, Vertragsschluss = Verlaufseintrag des Knopfs", JSON.stringify(l1));
  ok(l1?.erstEnde === JV.erstlaufzeitEnde(beginn1) && l1.endeBeiKuendigungHeute === l1.erstEnde && l1.fristgerechtHeute, "Ende der zwölf Monate und Ende bei Kündigung heute");
  ok(await KU.kulanzSatzErlaubt(J1) === true, "kulanzSatzErlaubt: Jahresvertrag → ja");

  console.log("── 2 · Jahresvertrag kündigen → läuft bis zum Laufzeitende ───────────────────");
  const probe = await KU.kuendigungSetzen(J1, { quelle: "telefon", grund: "Probe", probe: true });
  ok(probe.weg === "laufzeit_ende" && !(await zeile(J1)).gekuendigt_am, "Probe rechnet, schreibt nichts");
  const k1 = await KU.kuendigungSetzen(J1, { quelle: "telefon", grund: "Kunde will raus (Test)" });
  const a1 = await zeile(J1);
  const ende1 = JV.erstlaufzeitEnde(beginn1);
  ok(k1.ok && k1.weg === "laufzeit_ende", "Weg „laufzeit_ende“", JSON.stringify(k1));
  ok(!!a1.gekuendigt_am && tagB(a1.vertrag_ende_am) === ende1 && a1.kuendigung_art === "laufzeit", `gebucht: gekündigt, Vertragsende ${ende1}, Art „laufzeit“`, `${tagB(a1.vertrag_ende_am)} / ${a1.kuendigung_art}`);
  ok(Number(a1.kulanz_rate_nr) === 2 && Number(a1.letzte_rate_nr) === 12, "Kulanz-Rate 2, letzte geschuldete Rate 12", `${a1.kulanz_rate_nr}/${a1.letzte_rate_nr}`);
  ok(!a1.abo_gestoppt_am && !a1.mahnstopp_am, "kein Abo-Stopp, kein Mahnstopp — die Raten laufen weiter");
  ok((await raten(J1)).find((r) => r.id === j1r2)?.status === "offen", "Rate 2 bleibt offen (nichts storniert)");
  ok(k1.laufzeit?.kulanz?.summeCents === 5999 && k1.laufzeit.fristgerecht, "Ergebnis trägt das Kulanz-Angebot (59,99 €)");
  const log1 = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${J1} AND note LIKE 'Kündigung (telefon)%'`) as any[];
  ok(log1.some((x) => /Laufzeitende/.test(x.note) && /Kulanz-Angebot/.test(x.note)), "Verlauf: Laufzeitende + Kulanz-Angebot");
  ok((await KU.neueLeistungGesperrt(J1)) === false, "Bereich bleibt offen bis zum Laufzeitende (Portalsperre greift nicht)");
  const vl1 = await KU.vertragsendeLesen(J1);
  ok(vl1.jahresvertrag && vl1.ende === ende1, "vertragsendeLesen liefert das Laufzeitende");
  ok((await KU.kuendigungSetzen(J1, { quelle: "mail" })).weg === "bereits", "zweite Kündigung → „bereits“");
  const r13 = await rate(J1, 13, tagPlus(400), null);
  const nachEnde = await KU.rateNachVertragsende(`${J1}-RF-13`);
  ok(nachEnde?.nr === 13 && (await KU.rateNachVertragsende(`${J1}-RF-2`)) === null, "Rate 13 (über die zwölf hinaus) nie verlangt, Rate 2 schon");
  await sql`DELETE FROM fiaon_abo_raten WHERE id = ${r13}`;
  const lage1 = await KU.jahresvertragLage(J1);
  ok(lage1?.art === "laufzeit" && lage1.kulanz?.bisNr === 2 && lage1.ende === ende1, "jahresvertragLage: Art, Kulanz-Rechnung, Ende");

  console.log("── 3 · Kulanz nach Zahlung → Vertrag endet, keine Rate mehr ──────────────────");
  const b1 = await ABO.rateBezahltBuchen({ rateId: j1r2, zahlungsdatum: tagB(new Date())!, quelle: "admin" });
  const a1b = await zeile(J1);
  ok(b1.ok, "Rate 2 gebucht", JSON.stringify(b1));
  ok(a1b.kuendigung_art === "kulanz" && a1b.vertrag_ende_am && new Date(a1b.vertrag_ende_am).getTime() <= Date.now() + 1000, "Art „kulanz“, Vertragsende = jetzt", `${a1b.kuendigung_art} ${a1b.vertrag_ende_am}`);
  ok(!!a1b.abo_gestoppt_am && /Kulanz nach Zahlung/.test(String(a1b.abo_stopp_grund)) && Number(a1b.letzte_rate_nr) === 2, "Abo gestoppt (Kulanz nach Zahlung), letzte Rate 2");
  const rr = await raten(J1);
  ok(!rr.some((r) => r.status === "offen"), "keine offene Rate mehr (eine nachgezogene Rate 3 ist storniert)", JSON.stringify(rr.map((r) => `${r.rate_nr}:${r.status}`)));
  ok(((await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${J1} AND note LIKE 'Rate 2 bezahlt — Kulanz%'`) as any[]).length === 1, "Verlauf: „Rate 2 bezahlt — Kulanz …“");
  ok((await KU.kulanzNachZahlungPruefen(J1)).beendet === false, "Kulanz-Prüfung zweimal → nichts doppelt");
  ok((await KU.neueLeistungGesperrt(J1)) === true, "nach dem Ende schließt der Laden");

  console.log("── 4 · Keine offene Rate bei der Kündigung → die nächste wird angelegt ───────");
  const J2 = "FIAON-E396-J2";
  const ann2 = tagPlus(-30);
  await bestellung(J2, { agb: "2026-09-03", knopf: true, annahme: ann2, created: tagPlus(-31), completed: tagPlus(-28) });
  await rate(J2, 1, tagPlus(-28), tagPlus(-28));
  const k2 = await KU.kuendigungSetzen(J2, { quelle: "mail", grund: "Test" });
  const a2 = await zeile(J2);
  const r2 = await raten(J2);
  ok(k2.weg === "laufzeit_ende" && tagB(a2.vertrag_ende_am) === JV.erstlaufzeitEnde(ann2), "PDF-Annahme: Laufzeitende ab dem Tag der Annahme", `${tagB(a2.vertrag_ende_am)}`);
  ok(r2.some((r) => r.rate_nr === 2 && r.status === "offen") && Number(a2.kulanz_rate_nr) === 2, "Rate 2 angelegt und als Kulanz-Rechnung gesetzt", JSON.stringify(r2.map((r) => `${r.rate_nr}:${r.status}`)));

  // Untergrenze: Wer eine AGB-Fassung annahm, schloss nicht vor ihr ab (VERTRAGSBEGINN_SQL, GREATEST mit agb_stand).
  const J2b = "FIAON-E396-J2B";
  await bestellung(J2b, { agb: tagPlus(-20), knopf: true, erstelltLog: tagPlus(-45), created: tagPlus(-45), completed: tagPlus(-19) });
  await rate(J2b, 1, tagPlus(-19), tagPlus(-19));
  ok((await KU.jahresvertragLage(J2b))?.beginn === tagPlus(-20), "Vertragsschluss nie vor der angenommenen AGB-Fassung (Beleg älter → AGB-Tag)", JSON.stringify((await KU.jahresvertragLage(J2b))?.beginn));

  console.log("── 5 · Ohne belegte Annahme → bisheriges Verhalten (+ Karte) ─────────────────");
  const J3 = "FIAON-E396-J3";
  await bestellung(J3, { agb: "2026-09-03", knopf: false, created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(J3, 1, tagPlus(-39), tagPlus(-39));
  const j3r2 = await rate(J3, 2, tagPlus(5), null);
  const J3b = "FIAON-E396-J3B";
  await bestellung(J3b, { agb: "2026-10-05", knopf: false, created: tagPlus(-20), completed: tagPlus(-19) });
  await rate(J3b, 1, tagPlus(-19), tagPlus(-19));
  const EJ = await import("../server/lib/fiaon-jahresvertrag-entscheidung");
  const karte = await EJ.findeJahresvertraegeOhneAnnahme(sql);
  const belege = (karte[0]?.belege ?? []).map((b: any) => b.personId);
  ok(karte.length === 1 && karte[0].art === "jv_ohne_annahme" && karte[0].empfehlung === "zustimmung", "Karte „Jahresverträge ohne belegte Annahme“ entsteht", JSON.stringify(karte[0]?.titel));
  const argsRefs: string[] = (karte[0]?.optionen.find((o: any) => o.key === "zustimmung")?.args as any)?.refs ?? [];
  ok(argsRefs.includes(J3) && argsRefs.includes(J3b) && !argsRefs.includes(J1) && !argsRefs.includes(J2), "auf der Karte: nur die ohne Annahme (nicht Knopf/PDF)", JSON.stringify(argsRefs));
  ok(belege.length >= 2, "Belege nennen die Kunden");
  const k3 = await KU.kuendigungSetzen(J3, { quelle: "telefon", grund: "Test" });
  const a3 = await zeile(J3);
  ok(k3.weg === "sofort_beendet" && !a3.kuendigung_art && /ohne belegte Annahme/.test(String(k3.hinweis)), "bisheriger Weg (nichts fällig → endet), Art leer, Hinweis „ohne belegte Annahme“", JSON.stringify({ weg: k3.weg, art: a3.kuendigung_art }));
  ok((await raten(J3)).find((r) => r.id === j3r2)?.status === "storniert", "wie bisher: die noch nicht fällige Rate entfällt");

  console.log("── 6 · Widerruf erwähnt, erste 14 Tage → bisheriger Weg ──────────────────────");
  const J4 = "FIAON-E396-J4";
  await bestellung(J4, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(J4, 1, tagPlus(-39), tagPlus(-39));
  await rate(J4, 2, tagPlus(-9), null);
  const k4 = await KU.kuendigungSetzen(J4, { quelle: "mail", grund: "Ich widerrufe", widerrufErwaehnt: true });
  ok(k4.weg === "letzte_rate" && !(await zeile(J4)).kuendigung_art && /Widerruf/.test(String(k4.hinweis)), "Widerruf erwähnt → bisheriger Weg (letzte fällige Rate), Leitung entscheidet", JSON.stringify(k4.weg));
  const J5 = "FIAON-E396-J5";
  await bestellung(J5, { agb: "2026-10-05", knopf: true, erstelltLog: tagPlus(-5), created: tagPlus(-5), completed: tagPlus(-4) });
  await rate(J5, 1, tagPlus(-4), tagPlus(-4));
  await rate(J5, 2, tagPlus(26), null);
  const k5 = await KU.kuendigungSetzen(J5, { quelle: "telefon", grund: "Test" });
  ok(k5.weg === "sofort_beendet" && /14 Tagen/.test(String(k5.hinweis)), "in den ersten 14 Tagen → bisheriger Weg (der Widerruf bleibt unberührt)", JSON.stringify(k5));

  console.log("── 7 · „Sofort“ beim Jahresvertrag: ohne Grund Laufzeit, mit Grund sofort ─────");
  const J6 = "FIAON-E396-J6";
  await bestellung(J6, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(J6, 1, tagPlus(-39), tagPlus(-39));
  await rate(J6, 2, tagPlus(-9), null);
  const k6 = await KU.kuendigungSetzen(J6, { quelle: "telefon", grund: "Kulanz-Häkchen (Test)", sofort: true });
  ok(k6.weg === "laufzeit_ende" && /nur bei Widerruf oder wichtigem Grund/.test(String(k6.hinweis)) && (await zeile(J6)).kuendigung_art === "laufzeit", "„Kulanz sofort“ ohne Grund → Laufzeitende + Hinweis (keine Kulanz ohne Zahlung)");
  const J7 = "FIAON-E396-J7";
  await bestellung(J7, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(J7, 1, tagPlus(-39), tagPlus(-39));
  const j7r2 = await rate(J7, 2, tagPlus(-9), null);
  const k7 = await KU.kuendigungSetzen(J7, { quelle: "whatsapp", grund: "Widerruf angenommen (Test)", sofort: true, sofortGrund: "widerruf" });
  const a7 = await zeile(J7);
  ok(k7.weg === "kulanz_sofort" && a7.kuendigung_art === "sofort_recht" && /sofort: Widerruf/.test(String(a7.abo_stopp_grund)), "mit Grund „Widerruf“ → sofort beendet (Art sofort_recht)", JSON.stringify({ weg: k7.weg, art: a7.kuendigung_art, g: a7.abo_stopp_grund }));
  ok((await raten(J7)).find((r) => r.id === j7r2)?.status === "storniert", "offene Rate entfällt");
  const k6b = await KU.kuendigungSetzen(J6, { quelle: "telefon", grund: "später widerrufen (Test)", sofort: true, sofortGrund: "widerruf" });
  const a6b = await zeile(J6);
  ok(k6b.weg === "kulanz_sofort" && a6b.kuendigung_art === "sofort_recht" && new Date(a6b.vertrag_ende_am).getTime() <= Date.now() + 1000 && !(await raten(J6)).some((r) => r.status === "offen"), "laufender Laufzeit-Vertrag, später Widerruf → endet sofort, offene Raten entfallen");

  console.log("── 8 · Altvertrag unverändert ────────────────────────────────────────────────");
  const A1 = "FIAON-E396-A1";
  await bestellung(A1, { agb: "2026-08-15", knopf: true, created: "2026-08-20", completed: tagPlus(-21) });
  await rate(A1, 1, tagPlus(-21), tagPlus(-21));
  await rate(A1, 2, tagPlus(9), null);
  const kA = await KU.kuendigungSetzen(A1, { quelle: "telefon", grund: "Test" });
  const aA = await zeile(A1);
  ok(["sofort_beendet", "letzte_rate"].includes(kA.weg) && !aA.kuendigung_art && !kA.laufzeit, "Altvertrag: bisheriger Weg (Abrechnungsmonat), keine Laufzeit-Art", JSON.stringify(kA.weg));
  ok(aA.vertrag_ende_am && tagB(aA.vertrag_ende_am)! < tagPlus(40), "Altvertrag: Ende innerhalb des laufenden Abrechnungsmonats");
  ok(await KU.kulanzSatzErlaubt(A1) === false, "kulanzSatzErlaubt: Altvertrag → nein (die Sendesperre sperrt den Kulanz-Satz)");
  ok((await KU.jahresvertragLage(A1)) === null, "jahresvertragLage: Altvertrag → null");

  console.log("── 9 · Rücknahme setzt alles zurück ──────────────────────────────────────────");
  const J8 = "FIAON-E396-J8";
  await bestellung(J8, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(J8, 1, tagPlus(-39), tagPlus(-39));
  await rate(J8, 2, tagPlus(-9), null);
  await KU.kuendigungSetzen(J8, { quelle: "telefon", grund: "Test" });
  await KU.kuendigungZuruecknehmen(J8, "Test");
  const a8 = await zeile(J8);
  ok(!a8.gekuendigt_am && !a8.vertrag_ende_am && !a8.kuendigung_art && a8.kulanz_rate_nr == null && a8.letzte_rate_nr == null, "Rücknahme: Kündigung, Ende, Art, Kulanz-Rate weg");

  console.log("── 10 · Unbezahlt: Storno unverändert ────────────────────────────────────────");
  const U1 = "FIAON-E396-U1";
  await bestellung(U1, { agb: "2026-10-05", knopf: true, bezahlt: false, created: tagPlus(-3) });
  const kU = await KU.kuendigungSetzen(U1, { quelle: "mail", grund: "Test" });
  ok(kU.weg === "storno_unbezahlt" && (await zeile(U1)).payment_status === "cancelled", "unbezahlter Jahresvertrag → Storno wie bisher");

  console.log("── 11 · Teil 2: Rückfrage statt Auftrag — Formular, Ja vom eigenen Absender ───");
  const DO = await import("../server/lib/fiaon-postmeister-dossier");
  const FO = await import("../server/lib/fiaon-kuendigung-folgen");
  const PMW = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const F1 = "FIAON-E396-F1";
  const pF1 = await bestellung(F1, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(F1, 1, tagPlus(-39), tagPlus(-39));
  await rate(F1, 2, tagPlus(-9), null);
  const hauptF1 = String(((await sql`SELECT primary_email FROM fiaon_persons WHERE id = ${pF1}`) as any[])[0].primary_email);
  const bestellF1 = `${F1.toLowerCase()}@test.invalid`;
  ok(await DO.absenderGehoertZurPerson(`Test Person <${hauptF1.toUpperCase()}>`, pF1), "Absender: gespeicherte Hauptadresse (Name <…>, Groß/Klein egal) → gehört zu ihm");
  ok(await DO.absenderGehoertZurPerson(bestellF1, pF1), "Absender: Adresse der Bestellung → gehört zu ihm");
  ok(!(await DO.absenderGehoertZurPerson("fremd@test.invalid", pF1)) && !(await DO.absenderGehoertZurPerson(hauptF1, null)), "Absender: fremde Adresse oder ohne Person → nicht");
  const pG = await person("GMAILE396");
  await sql`UPDATE fiaon_persons SET primary_email = 'e396.pruef+fiaon@gmail.com' WHERE id = ${pG}`;
  ok(await DO.absenderGehoertZurPerson("E396Pruef@googlemail.com", pG), "Absender: Gmail-Grundform (Punkte, +Zusatz, googlemail) → gehört zu ihm");
  // Formular-Antrag ohne passendes Geburtsdatum — Mara fragt an der gespeicherten Adresse nach.
  const [cF1] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, identifiziert_ueber, created_at)
                           VALUES (${F1}, 'Test', 'Person', ${bestellF1}, 'Ich möchte kündigen.', 'pending', 'name_email_abweichend', NOW() - INTERVAL '2 days') RETURNING id`) as any[];
  const antragF1 = Number(cF1.id);
  const gesendet: any[] = [];
  const sender = async (postfach: string, m: any) => { gesendet.push({ postfach, ...m }); return { id: "g1", threadId: "t1" }; };
  const r1 = await FO.antragAutomatischBuchen(antragF1, { senden: sender });
  ok(!r1.gebucht && r1.rueckfrage === true && !(await zeile(F1)).gekuendigt_am, "Identität offen → nicht gebucht, Rückfrage gesendet", JSON.stringify(r1));
  ok(gesendet.length === 1 && gesendet[0].postfach === "welcome@fiaon.com" && gesendet[0].an === bestellF1, "Rückfrage aus welcome@ an die gespeicherte Adresse aus dem Formular", JSON.stringify(gesendet.map((g) => `${g.postfach}→${g.an}`)));
  ok(String(gesendet[0]?.text).includes("Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt.") && /Guten Tag|Hallo|Sehr geehrte/.test(String(gesendet[0]?.text)), "Rückfrage-Mail: Anrede und Justins Satz");
  ok((await FO.formularRueckfrageOffen(pF1)) === antragF1, "Vermerk im Verlauf: Rückfrage zu diesem Antrag offen");
  const r1b = await FO.antragAutomatischBuchen(antragF1, { senden: sender });
  ok(!r1b.gebucht && gesendet.length === 1 && /schon raus/.test(r1b.warum), "zweiter Lauf → keine zweite Rückfrage");
  // Das Ja — erst von einer fremden Adresse, dann vom eigenen Absender.
  const kontext = (absender: string) => ({ personId: pF1, ref: F1, postfach: "welcome@fiaon.com", postmeisterId: null, kundenlage: "aktiv" as any, kundeText: "Ja", absender });
  const jaFremd = await PMW.kuendigungVormerken.ausfuehren({ zitat: "Ja", grund: "" }, kontext("Jemand <fremd@test.invalid>"));
  ok(!jaFremd.ok && /nicht von einer E-Mail-Adresse, die bei ihm gespeichert ist/.test(String(jaFremd.fehler)) && !(await zeile(F1)).gekuendigt_am, "„Ja“ von fremder Adresse → NICHTS gebucht", JSON.stringify(jaFremd.fehler));
  // E-401-Prüfung: gespeicherte Adresse, aber Gmails Absender-Prüfung bestätigt sie nicht (gefälschte Absenderzeile) → nichts.
  const jaGefaelscht = await PMW.kuendigungVormerken.ausfuehren({ zitat: "Ja", grund: "" },
    { ...kontext(`Test Person <${bestellF1}>`), absenderPruefung: { authErgebnis: "mx.google.com; spf=fail smtp.mailfrom=boese.example; dkim=none; dmarc=fail header.from=test.invalid", antwortAn: null } });
  ok(!jaGefaelscht.ok && /Absender-Prüfung bestätigt sie aber nicht/.test(String(jaGefaelscht.fehler)) && !(await zeile(F1)).gekuendigt_am, "„Ja“ mit gespeicherter Adresse, aber Absender-Prüfung durchgefallen → NICHTS gebucht (E-401)", JSON.stringify(jaGefaelscht.fehler));
  const jaEigen = await PMW.kuendigungVormerken.ausfuehren({ zitat: "Ja", grund: "" },
    { ...kontext(`Test Person <${bestellF1}>`), absenderPruefung: { authErgebnis: "mx.google.com; dkim=pass header.i=@test.invalid; spf=pass smtp.mailfrom=fiaon-e396-f1@test.invalid; dmarc=pass (p=NONE) header.from=test.invalid", antwortAn: null } });
  const aF1 = await zeile(F1);
  const [antragNach] = (await sql`SELECT status, admin_note FROM cancellation_requests WHERE id = ${antragF1}`) as any[];
  ok(jaEigen.ok && !!aF1.gekuendigt_am && aF1.kuendigung_art === "laufzeit", "„Ja“ vom eigenen Absender → Mara bucht (Jahresvertrag: läuft bis zum Laufzeitende)", JSON.stringify({ ok: jaEigen.ok, f: jaEigen.fehler, art: aF1.kuendigung_art }));
  ok(antragNach?.status === "confirmed" && tagB(aF1.gekuendigt_am) === tagPlus(-2), "der Formular-Antrag ist gebucht — zum Tag seines Eingangs", `${antragNach?.status} ${tagB(aF1.gekuendigt_am)}`);
  ok(((await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${pF1} AND note LIKE 'Identität zum Kündigungsantrag Nr.%'`) as any[]).some((x) => /gespeicherte Adresse/.test(x.note)), "Verlauf: Identität per Ja von der gespeicherten Adresse bestätigt");
  // Ohne offene Rückfrage ist ein bloßes „Ja“ keine Kündigung.
  const F2 = "FIAON-E396-F2";
  const pF2 = await bestellung(F2, { agb: "2026-09-03", knopf: true, erstelltLog: tagPlus(-40), created: tagPlus(-40), completed: tagPlus(-39) });
  await rate(F2, 1, tagPlus(-39), tagPlus(-39));
  const jaOhne = await PMW.kuendigungVormerken.ausfuehren({ zitat: "Ja", grund: "" }, { ...kontext(`${F2.toLowerCase()}@test.invalid`), personId: pF2, ref: F2 });
  ok(!jaOhne.ok && !(await zeile(F2)).gekuendigt_am, "„Ja“ ohne offene Rückfrage → keine Kündigung");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (lokale Datenbank)`);
  if (schlecht) { console.log("Rot:"); for (const r of rot) console.log(`  · ${r}`); }
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
