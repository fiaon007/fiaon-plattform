// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-501 (12.11.2026) — Lücke in der Ratenkette nur mit ausdrücklicher Freigabe; der Lauf „Formular-Kündigungen
// abarbeiten“ (Trockenplan, Schalter, Stichtag, Karten, Bestätigung). Mit erfundenen Testkunden gegen eine LOKALE
// Prüfdatenbank; kein Netz, keine Mail (keine Schlüssel). Bricht ab, wenn DATABASE_URL nicht lokal auf fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e501?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-e501-luecke-db.ts
// (Die Datenbank vorher frisch aus fiaon_pruefstand_e372_vorlage anlegen und node scripts/run-migrations.mjs laufen lassen.)
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

let gut = 0, schlecht = 0;
const rot: string[] = [];
function ok(b: unknown, was: string, extra = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; rot.push(was); console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); }
}
const tagB = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : null);
function tagPlus(n: number): string {
  const d = new Date(`${tagB(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const KU = await import("../server/lib/fiaon-kuendigung");
  const ABO = await import("../server/routes/fiaon-abo");
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  const L = await import("../server/lib/fiaon-kuendigung-antraege-lauf");
  const N = await import("../server/lib/fiaon-kuendigung-nachholen");
  await ABO.ensureAboTabellen();
  await KU.kuendigungSpalten();
  await E.entscheidungTabellen();

  const person = async (nn: string) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PR-E501-${nn}`}, 'Test', ${nn}, ${`${nn.toLowerCase()}@test.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  };
  /** Eine bezahlte Bestellung. `agb` vor dem 03.09.2026 = Altvertrag (monatlich kündbar). */
  const bestellung = async (ref: string, o: { agb: string; knopf?: boolean; created: string }) => {
    const pid = await person(ref.replace(/[^A-Z0-9]/gi, "").slice(-8));
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, completed_at, agb_stand, consent_contract,
                                              first_name, last_name, email, payment_reference)
              VALUES (${ref}, ${pid}, 'private', 'pro', 'FIAON Pro', 'paid', ${`${o.created} 10:00:00`}, ${`${o.created} 12:00:00`},
                      ${o.agb}, ${o.knopf === true}, 'Test', 'Person', ${`${ref.toLowerCase()}@test.invalid`}, ${`${ref}-RF`})`;
    if (o.knopf) {
      await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                VALUES (${ref}, ${pid}, NULL, 'System', 'system', 'Erste Rechnung gestellt (automatisch beim Antragsabschluss): 59.99 €, Verwendungszweck X — verschickt an test.', ${`${o.created}T09:00:00Z`})`;
    }
    return pid;
  };
  const rate = async (ref: string, nr: number, faellig: string, bezahlt: string | null) => {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, bezahlt_am, zahlungsreferenz)
              VALUES (${ref}, ${nr}, 5999, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt ? `${bezahlt}T12:00:00Z` : null}, ${`${ref}-RF-${nr}`})`;
  };
  const zeile = async (ref: string) => ((await sql`SELECT * FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
  const raten = async (ref: string) => (await sql`SELECT rate_nr, status, storno_grund FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[];
  const antragAnlegen = async (ref: string, vorTagen: number, o: { identitaet?: boolean } = {}) => {
    const [c] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, identifiziert_ueber, created_at)
                           VALUES (${ref}, 'Test', 'Person', ${`${ref.toLowerCase()}@test.invalid`}, 'Ich möchte kündigen.', 'pending',
                                   ${o.identitaet === false ? "name_email_abweichend" : "geburtsdatum"}, NOW() - (${vorTagen} || ' days')::interval) RETURNING id`) as any[];
    return Number(c.id);
  };

  console.log("── 0 · Reine Teile ───────────────────────────────────────────────────────────");
  ok(KU.kettenLuecke([{ rate_nr: 1 }, { rate_nr: 3 }]) && !KU.kettenLuecke([{ rate_nr: 1 }, { rate_nr: 2 }]) && !KU.kettenLuecke([{ rate_nr: 4 }]), "kettenLuecke: 1,3 ja · 1,2 nein · eine Rate nein");
  ok(!KU.lueckeFreigabeGueltig(null) && !KU.lueckeFreigabeGueltig("") && !KU.lueckeFreigabeGueltig("ok") && !KU.lueckeFreigabeGueltig(true as any) && KU.lueckeFreigabeGueltig("vom Inhaber freigegeben (Test)"), "Freigabe gilt nur als ausgeschriebener Satz (wer, wann)");
  ok(L.antragNrAusSchluessel("kuendigung_ungebucht:142") === 142 && L.antragNrAusSchluessel("mahnstopp:1") === null, "Antragsnummer aus dem Karten-Schlüssel");
  const akt = (o: Partial<Parameters<typeof L.antragAktion>[0]>) => L.antragAktion({ empfehlung: "buchen", hatBuchen: true, hatKeine: true, eingang: "2026-10-01T10:00:00.000Z", nurVor: L.KA_NUR_VOR, probeOk: true, ...o });
  ok(akt({}) === "buchen" && akt({ empfehlung: "keine" }) === "schliessen", "Aktion folgt der Empfehlung der Karte");
  ok(akt({ probeOk: false }) === "nichts" && akt({ probeOk: null }) === "nichts", "ohne grüne Probe wird nie gebucht");
  ok(akt({ eingang: "2026-11-12T12:00:00.000Z" }) === "nichts" && akt({ empfehlung: "keine", eingang: "2026-11-13T08:00:00.000Z" }) === "nichts", "Stichtag: ein Antrag nach Justins Ja bleibt eine Karte");
  ok(akt({ hatBuchen: false }) === "nichts" && akt({ empfehlung: "spaeter" }) === "nichts", "ohne passende Option nichts");
  ok(new Date(L.KA_NUR_VOR).getTime() === Date.UTC(2026, 10, 12, 11, 30) && L.KA_VON === "Justin Schwarzott" && L.KA_JE_LAUF === 3, "Stichtag, Entscheider, höchstens drei je Lauf");

  const ra = (o: Partial<Parameters<typeof L.restAktion>[0]>) => L.restAktion({ bestellungGekuendigt: false, person: true, personGekuendigt: false, laufendePakete: 0, identBestaetigt: true, text: "Ich bin unzufrieden", ...o }).aktion;
  ok(ra({ laufendePakete: 1 }) === "abo_kuendigen", "Rest: Antrag am falschen Produkt, EIN laufendes Paket, Identität bestätigt → Paket kündigen");
  ok(ra({ laufendePakete: 1, identBestaetigt: false }) === "halten" && ra({ laufendePakete: 2 }) === "halten", "Rest: ohne bestätigte Identität oder bei mehreren Paketen → halten");
  ok(ra({ laufendePakete: 1, text: "Ich will mein Geld zurück" }) === "halten" && ra({ laufendePakete: 1, text: "Ich widerrufe" }) === "halten", "Rest: Geld zurück oder Widerruf im Text → halten (Leitung)");
  ok(ra({ bestellungGekuendigt: true }) === "status_nachziehen" && ra({ personGekuendigt: true }) === "status_nachziehen", "Rest: längst gekündigt → nur den Status nachziehen");
  ok(ra({ person: false }) === "schliessen" && ra({}) === "halten", "Rest: niemand zu finden → schließen; Kunde ohne Paket und ohne Kündigung → halten");

  console.log("── 1 · Lücke (1,3): ohne Freigabe nie, mit Freigabe bleibt die gestellte Rate fällig ───────");
  const A1 = "FIAON-E501-A1";
  await bestellung(A1, { agb: "2026-07-04", created: tagPlus(-70) });
  await rate(A1, 1, tagPlus(-70), tagPlus(-70));
  await rate(A1, 3, tagPlus(-8), null);            // fällig vor der Kündigung → bleibt als letzte Rate
  const ohne = await KU.kuendigungSetzen(A1, { quelle: "formular", am: new Date(Date.now() - 3 * 86_400_000).toISOString() });
  ok(!ohne.ok && ohne.weg === "prueffall" && /Lücke in der Ratenkette \(1,3\)/.test(String(ohne.grund)) && !(await zeile(A1)).gekuendigt_am, "ROT-PROBE: ohne Freigabe → Prüffall, nichts gebucht", JSON.stringify(ohne));
  const kurz = await KU.kuendigungSetzen(A1, { quelle: "formular", lueckeFreigabe: "ja" });
  ok(!kurz.ok && kurz.weg === "prueffall" && !(await zeile(A1)).gekuendigt_am, "ROT-PROBE: Freigabe ohne Satz („ja“) → Prüffall");
  const am1 = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const probe = await KU.kuendigungSetzen(A1, { quelle: "formular", am: am1, probe: true, lueckeFreigabe: "vom Inhaber freigegeben (Prüfstand)" });
  ok(probe.ok && probe.weg === "letzte_rate" && probe.letzteRateNr === 3 && !(await zeile(A1)).gekuendigt_am, "Probe mit Freigabe: Rate 3 bleibt fällig — und schreibt nichts", JSON.stringify(probe));
  const echt = await KU.kuendigungSetzen(A1, { quelle: "formular", am: am1, lueckeFreigabe: "vom Inhaber freigegeben (Prüfstand)", grund: "Test" });
  const a1 = await zeile(A1);
  ok(echt.ok && echt.weg === "letzte_rate" && !!a1.gekuendigt_am && Number(a1.letzte_rate_nr) === 3, "gebucht: Kündigung steht, letzte Rate 3", JSON.stringify(echt));
  const r1 = await raten(A1);
  ok(r1.length === 2 && r1[1].status === "offen" && !r1.some((r) => Number(r.rate_nr) === 2), "Rate 3 bleibt offen, die nie gestellte Rate 2 entsteht NICHT");
  const log1 = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${A1} AND note LIKE 'Kündigung (formular)%'`) as any[];
  ok(log1.some((x) => /Lücke in der Ratenkette \(1,3\) freigegeben/.test(x.note) && /nicht nachgefordert/.test(x.note) && /Prüfstand/.test(x.note)), "Verlauf nennt die Freigabe (wer) und die Regel");

  console.log("── 2 · Lücke, offene Rate liegt NACH dem Vertragsende → sie entfällt ──────────────────────");
  const A2 = "FIAON-E501-A2";
  await bestellung(A2, { agb: "2026-07-04", created: tagPlus(-100) });
  await rate(A2, 1, tagPlus(-100), tagPlus(-100));
  await rate(A2, 3, tagPlus(-38), null);
  const am2 = new Date(Date.now() - 80 * 86_400_000).toISOString();   // gekündigt, lange bevor Rate 3 fällig wurde
  const k2 = await KU.kuendigungSetzen(A2, { quelle: "formular", am: am2, lueckeFreigabe: "vom Inhaber freigegeben (Prüfstand)" });
  const r2 = await raten(A2);
  ok(k2.ok && k2.weg === "sofort_beendet" && r2.find((r) => Number(r.rate_nr) === 3)?.status === "storniert", "Vertrag beendet, Rate 3 (nach dem Ende fällig) entfällt", JSON.stringify(k2));
  ok(!!(await zeile(A2)).vertrag_ende_am && (await KU.kuendigungSetzen(A2, { quelle: "formular" })).weg === "bereits", "Vertragsende steht; eine zweite Kündigung → „bereits“");

  console.log("── 3 · Jahresvertrag zum Laufzeitende mit Lücke: auch mit Freigabe ein Prüffall ───────────");
  const J1 = "FIAON-E501-J1";
  await bestellung(J1, { agb: "2026-09-03", knopf: true, created: tagPlus(-60) });
  await rate(J1, 1, tagPlus(-59), tagPlus(-59));
  await rate(J1, 3, tagPlus(-1), null);
  const j1 = await KU.kuendigungSetzen(J1, { quelle: "formular", lueckeFreigabe: "vom Inhaber freigegeben (Prüfstand)" });
  ok(!j1.ok && j1.weg === "prueffall" && /Jahresvertrag zum Laufzeitende/.test(String(j1.grund)) && !(await zeile(J1)).gekuendigt_am, "ROT-PROBE: Jahresvertrag + Lücke → Prüffall trotz Freigabe", JSON.stringify(j1));

  console.log("── 4 · Karten: „Trotz Lücke buchen“ nur bei Lücke; der Lauf — trocken, Stichtag, an ───────");
  const B1 = "FIAON-E501-B1";   // Lücke, Rate 3 bleibt
  await bestellung(B1, { agb: "2026-07-04", created: tagPlus(-70) });
  await rate(B1, 1, tagPlus(-70), tagPlus(-70)); await rate(B1, 3, tagPlus(-8), null);
  const aB1 = await antragAnlegen(B1, 3);
  const B2 = "FIAON-E501-B2";   // ohne Lücke, Identität offen
  await bestellung(B2, { agb: "2026-07-04", created: tagPlus(-70) });
  await rate(B2, 1, tagPlus(-70), tagPlus(-70)); await rate(B2, 2, tagPlus(-39), null);
  const aB2 = await antragAnlegen(B2, 30, { identitaet: false });
  await E.entscheidungenSammeln({ nur: ["kuendigung_ungebucht"] });
  const karte = async (antrag: number) => ((await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE schluessel = ${`kuendigung_ungebucht:${antrag}`}`) as any[])[0];
  const opt = (k: any) => (typeof k.optionen === "string" ? JSON.parse(k.optionen) : k.optionen) as any[];
  const kB1 = await karte(aB1), kB2 = await karte(aB2);
  ok(!!kB1 && opt(kB1).find((o) => o.key === "buchen")?.label === "Trotz Lücke buchen" && opt(kB1).find((o) => o.key === "buchen")?.args?.lueckeFreigabe === true, "Karte mit Lücke: Option „Trotz Lücke buchen“ trägt die Freigabe", JSON.stringify(kB1 && opt(kB1)));
  ok(!!kB2 && opt(kB2).find((o) => o.key === "buchen")?.args?.lueckeFreigabe !== true && /buchen/i.test(String(opt(kB2).find((o) => o.key === "buchen")?.label)), "Karte ohne Lücke: normale Option, keine Freigabe");

  ok((await L.antraegeModus()) === "trocken", "Vorgabe des Schalters: trocken");
  const t1 = await L.antraegeLauf();
  const plan1 = JSON.parse(String(((await sql`SELECT value FROM fiaon_settings WHERE key = ${L.KA.plan}`) as any[])[0]?.value ?? "{}"));
  const pB1 = plan1.faelle?.find((f: any) => f.antrag === aB1), pB2 = plan1.faelle?.find((f: any) => f.antrag === aB2);
  ok(t1.modus === "trocken" && t1.erledigt === 0 && !(await zeile(B1)).gekuendigt_am && !(await zeile(B2)).gekuendigt_am, "trocken: nichts gebucht", JSON.stringify(t1));
  ok(pB1?.aktion === "buchen" && pB1.weg === "letzte_rate" && pB1.letzteRateNr === 3 && pB1.letzteRateCents === 5999 && pB1.luecke === true, "Plan: Lücken-Fall → buchen, Rate 3 über 59,99 € bleibt fällig", JSON.stringify(pB1));
  ok(pB2?.aktion === "buchen" && pB2.identitaetOffen === true && pB2.luecke === false, "Plan: Fall ohne Lücke → buchen, Identität offen vermerkt", JSON.stringify(pB2));
  ok(!JSON.stringify(plan1).includes("test.invalid") && !/Test|Person|möchte kündigen/.test(JSON.stringify(plan1)), "Plan ohne Namen, Adressen und Kundentext");

  await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${L.KA.schalter}, 'an', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'an', updated_at = NOW()`;
  const t2 = await L.antraegeLauf();
  const b1 = await zeile(B1), b2 = await zeile(B2);
  ok(t2.modus === "an" && t2.erledigt === 2 && t2.fehler === 0, "an: beide Karten ausgeführt", JSON.stringify(t2));
  ok(!!b1.gekuendigt_am && b1.kuendigung_quelle === "formular" && Number(b1.letzte_rate_nr) === 3 && tagB(b1.gekuendigt_am) === tagPlus(-3), "Lücken-Fall gebucht zum Eingangstag, letzte Rate 3", `${tagB(b1.gekuendigt_am)} / ${b1.letzte_rate_nr}`);
  ok(!!b2.gekuendigt_am && tagB(b2.gekuendigt_am) === tagPlus(-30), "Fall mit offener Identität gebucht zum Eingangstag (Vermerk des Inhabers)");
  ok(b1.kuendigung_gezeichnet_von === "Justin Schwarzott" && !!b1.kuendigung_doc_hash, "Urkunde ausgefertigt, gezeichnet wie beim Klick des Inhabers", String(b1.kuendigung_gezeichnet_von));
  const kB1n = await karte(aB1);
  ok(kB1n.status === "entschieden" && kB1n.entschieden_von === "Justin Schwarzott" && /Ja vom 12\.11\.2026 \(Lauf E-501\)/.test(String(kB1n.ergebnis)), "Karte entschieden: Justin Schwarzott, Ja vom 12.11.2026", String(kB1n.ergebnis));
  const cr = (await sql`SELECT id, status FROM cancellation_requests WHERE id IN (${aB1}, ${aB2}) ORDER BY id`) as any[];
  ok(cr.every((c) => c.status === "confirmed"), "cancellation_requests mitgezogen (confirmed)", JSON.stringify(cr));
  const verm = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${B1} AND note LIKE ${`${L.KA_VERMERK}%`}`) as any[];
  ok(verm.length === 1 && /Lücke in der Ratenkette freigegeben/.test(verm[0].note) && /Identität zum Kündigungsantrag/.test(JSON.stringify(await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${B2}`)), "Aktenvermerke: Lauf E-501 (mit Lücken-Freigabe) und Identitäts-Vermerk");
  const t3 = await L.antraegeLauf();
  ok(t3.erledigt === 0 && t3.karten === 0, "zweiter Lauf: nichts mehr zu tun (keine doppelte Buchung)", JSON.stringify(t3));

  console.log("── 5 · Die Bestätigung findet auch diese Buchungen (nur, wo nichts offen ist) ─────────────");
  const B3 = "FIAON-E501-B3";   // beendet ohne offene Rate → Maras Bestätigung
  await bestellung(B3, { agb: "2026-07-04", created: tagPlus(-100) });
  await rate(B3, 1, tagPlus(-100), tagPlus(-100)); await rate(B3, 3, tagPlus(-38), null);
  const aB3 = await antragAnlegen(B3, 80);
  await L.antraegeLauf();
  const b3 = await zeile(B3);
  const { faelle } = await N.nachholBestaetigungFaelle();
  ok(!!b3.gekuendigt_am && !!b3.vertrag_ende_am && (await raten(B3)).every((r) => r.status !== "offen"), "Fall 3 gebucht: Vertrag beendet, keine Rate mehr offen");
  ok(faelle.some((f) => f.ref === B3 && f.art === "beendet" && f.betreff === "Ihre Kündigung ist bestätigt") || !!b3.kuendigung_bestaetigt_mail_am, "Maras Bestätigung ist für Fall 3 vorgesehen (oder schon vermerkt)", JSON.stringify(faelle.map((f) => `${f.ref}:${f.art}`)));
  ok(!faelle.some((f) => f.ref === B1), "Fall 1 (Rate offen) bekommt hier nichts — dort gilt die Bestätigung des Hauses");
  void aB3;

  console.log("── 6 · Der Rest ohne Karte: trocken → status → an ────────────────────────────────────────");
  // (a) Antrag hängt an der Einmal-Auskunft, der Mensch hat EIN laufendes Paket.
  const R1 = "FIAON-E501-R1";
  const pR1 = await bestellung(R1, { agb: "2026-07-04", created: tagPlus(-70) });
  await rate(R1, 1, tagPlus(-70), tagPlus(-70)); await rate(R1, 2, tagPlus(-39), null);
  const R1S = "FIAON-SCHUFA-E501-R1";
  await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, first_name, last_name, email, payment_reference)
            VALUES (${R1S}, ${pR1}, 'schufa', 'schufa', 'Bonitätsauskunft', 'paid', NOW() - INTERVAL '20 days', 'Test', 'Person', ${`${R1.toLowerCase()}@test.invalid`}, ${`${R1S}-RF`})`;
  const [cR1] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, identifiziert_ueber, created_at)
                           VALUES (${R1S}, 'Test', 'Person', ${`${R1.toLowerCase()}@test.invalid`}, 'Ich bin mit dem Service unzufrieden', 'pending', 'geburtsdatum', NOW() - INTERVAL '5 days') RETURNING id`) as any[];
  // (b) Bestellung des Antrags ist längst gekündigt.
  const R2 = "FIAON-E501-R2";
  await bestellung(R2, { agb: "2026-07-04", created: tagPlus(-90) });
  await sql`UPDATE fiaon_applications SET gekuendigt_am = NOW() - INTERVAL '40 days', payment_status = 'cancelled' WHERE ref = ${R2}`;
  const [cR2] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at)
                           VALUES (${R2}, 'Test', 'Person', ${`${R2.toLowerCase()}@test.invalid`}, 'Die Kosten sind zu hoch', 'pending', NOW() - INTERVAL '50 days') RETURNING id`) as any[];
  // (c) Weder Bestellung noch Mensch.
  const [cR3] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at)
                           VALUES ('FIAON-GIBT-ES-NICHT', 'Niemand', 'Bekannt', 'niemand-e501@test.invalid', 'Persönliche Gründe', 'pending', NOW() - INTERVAL '30 days') RETURNING id`) as any[];
  const rp = await L.restPlanLesen();
  const akt6 = (id: number) => rp.find((x) => x.antrag === Number(id))?.aktion;
  ok(akt6(cR1.id) === "abo_kuendigen" && akt6(cR2.id) === "status_nachziehen" && akt6(cR3.id) === "schliessen", "Rest-Plan: Paket kündigen · Status nachziehen · schließen", JSON.stringify(rp.map((x) => `${x.antrag}:${x.aktion}`)));
  ok(rp.find((x) => x.antrag === Number(cR1.id))?.weg === "letzte_rate" && !JSON.stringify(rp).includes("test.invalid") && !JSON.stringify(rp).includes("unzufrieden"), "Rest-Plan trägt die Probe (letzte Rate bleibt) — ohne Kundentext");
  const crStand = async (id: number) => String(((await sql`SELECT status FROM cancellation_requests WHERE id = ${id}`) as any[])[0]?.status);
  const t6 = await L.restLauf();
  ok(t6.modus === "trocken" && t6.erledigt === 0 && (await crStand(cR2.id)) === "pending", "Rest trocken (Vorgabe): nichts geschieht");
  await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${L.KR.schalter}, 'status', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'status', updated_at = NOW()`;
  const s6 = await L.restLauf();
  ok(s6.modus === "status" && s6.erledigt === 2 && (await crStand(cR2.id)) === "confirmed" && (await crStand(cR3.id)) === "rejected", "Stufe „status“: nachgezogen und geschlossen", JSON.stringify(s6));
  ok((await crStand(cR1.id)) === "pending" && !(await zeile(R1)).gekuendigt_am, "ROT-PROBE: Stufe „status“ bucht KEINE Paket-Kündigung");
  await sql`UPDATE fiaon_settings SET value = 'an' WHERE key = ${L.KR.schalter}`;
  const a6 = await L.restLauf();
  const r1z = await zeile(R1);
  ok(a6.modus === "an" && a6.erledigt === 1 && !!r1z.gekuendigt_am && r1z.kuendigung_quelle === "formular" && tagB(r1z.gekuendigt_am) === tagPlus(-5), "Stufe „an“: das laufende Paket ist zum Eingangstag gekündigt", JSON.stringify(a6));
  ok((await crStand(cR1.id)) === "confirmed" && !(await zeile(R1S)).gekuendigt_am && r1z.kuendigung_gezeichnet_von === "Justin Schwarzott", "Antrag bestätigt; die Auskunft-Bestellung bleibt unberührt; Urkunde gezeichnet");
  ok((await L.restLauf()).erledigt === 0, "zweiter Rest-Lauf: nichts mehr zu tun");

  console.log(`\n${schlecht === 0 ? "✓" : "✗"} ${gut}/${gut + schlecht} Prüfungen bestanden (lokale Prüfdatenbank)`);
  if (rot.length) console.log(`ROT: ${rot.join(" · ")}`);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
