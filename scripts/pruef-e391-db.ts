// Prüfstand E-391 (16.10.2026), Datenbank-Teil: Kündigungsfolgen, Vertragsende, Inkasso-Sicht, WhatsApp-Gruppen,
// Kontoauszug-Zeitraum neu rechnen — mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank. Kein Netz, keine
// Mail (keine Schlüssel). Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e391k?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-e391-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

async function main() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const KU = await import("../server/lib/fiaon-kuendigung");
  const ABO = await import("../server/routes/fiaon-abo");
  await ABO.ensureAboTabellen();
  await KU.kuendigungSpalten();
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  await E.entscheidungTabellen();
  const sql = sqlPool;

  // ── Testkunden ─────────────────────────────────────────────────────────
  const person = async (vn: string, nn: string) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PR-E391-${nn}`}, ${vn}, ${nn}, ${`${nn.toLowerCase()}@test.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  };
  const bestellung = async (pid: number, ref: string, o: { gekuendigt?: string | null; letzte?: number | null; ende?: string | null; agb?: string | null; created?: string; bezahltAm?: string }) => {
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, paid_at, agb_stand, gekuendigt_am, letzte_rate_nr, vertrag_ende_am, first_name, last_name, email, payment_reference)
              VALUES (${ref}, ${pid}, 'private', 'pro', 'FIAON Pro', 'paid', ${o.created ?? "2026-07-01T10:00:00Z"}, ${o.bezahltAm ?? o.created ?? "2026-07-01T10:00:00Z"}, ${o.agb ?? null},
                      ${o.gekuendigt ?? null}, ${o.letzte ?? null}, ${o.ende ?? null}, 'Test', 'Person', ${`${ref.toLowerCase()}@test.invalid`}, ${`${ref}-RF`})`;
  };
  const rate = async (ref: string, nr: number, faellig: string, bezahlt: string | null) => {
    const [r] = (await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, bezahlt_am, zahlungsreferenz)
                           VALUES (${ref}, ${nr}, 5999, ${faellig}, ${bezahlt ? "bezahlt" : "offen"}, ${bezahlt}, ${`${ref}-${nr}`}) RETURNING id`) as any[];
    return Number(r.id);
  };

  console.log("── 1 · Raten nach dem Vertragsende werden automatisch storniert");
  // Lisa-Fall: Kündigung 19.09., Abrechnungsmonat 27.08.–26.09. → Rate 27.09. nicht geschuldet; alte Regel setzte letzte = 2.
  const pL = await person("Lea", "Kuehlmann");
  await bestellung(pL, "FIAON-E391-LISA", { gekuendigt: "2026-09-19T09:34:00Z", letzte: 2, created: "2026-08-27T10:00:00Z" });
  await rate("FIAON-E391-LISA", 1, "2026-08-27", "2026-08-27T12:00:00Z");
  const lisa2 = await rate("FIAON-E391-LISA", 2, "2026-09-27", null);
  // Virag-Fall: Kündigung 11.09., Ende 12.09.; Rate 2 (13.09.) offen, Rate 3 (13.10.) bezahlt, Vertrag beendet.
  const pV = await person("Mira", "Vargas");
  await bestellung(pV, "FIAON-E391-VIRAG", { gekuendigt: "2026-09-11T16:51:00Z", letzte: 3, ende: "2026-09-12T21:59:59Z", created: "2026-08-13T10:00:00Z" });
  await rate("FIAON-E391-VIRAG", 1, "2026-08-13", "2026-08-13T12:00:00Z");
  const virag2 = await rate("FIAON-E391-VIRAG", 2, "2026-09-13", null);
  await rate("FIAON-E391-VIRAG", 3, "2026-10-13", "2026-10-05T12:00:00Z");
  // Gegenprobe: ungekündigter Vertrag mit offener Rate — bleibt.
  const pN = await person("Nils", "Normal");
  await bestellung(pN, "FIAON-E391-NORMAL", { created: "2026-08-01T10:00:00Z" });
  await rate("FIAON-E391-NORMAL", 1, "2026-08-01", "2026-08-01T12:00:00Z");
  const normal2 = await rate("FIAON-E391-NORMAL", 2, "2026-09-01", null);
  // Gegenprobe: Jahresvertrag gekündigt — wird hier NICHT angefasst.
  const pJ = await person("Jana", "Jahr");
  await bestellung(pJ, "FIAON-E391-JAHR", { gekuendigt: "2026-10-01T10:00:00Z", letzte: 2, agb: "2026-09-10", created: "2026-09-10T10:00:00Z" });
  await rate("FIAON-E391-JAHR", 1, "2026-09-10", "2026-09-10T12:00:00Z");
  const jahr2 = await rate("FIAON-E391-JAHR", 2, "2026-10-10", null);
  // Die Sammelkarte, wie sie das Steuerpult angelegt hätte.
  await sql`INSERT INTO fiaon_mara_entscheidungen (schluessel, art, titel, text, empfehlung, optionen, belege) VALUES ('raten_nach_ende:test', 'raten_nach_ende', 'Raten nach Vertragsende stornieren', 'Test', 'stornieren', '[]'::jsonb, '[]'::jsonb)`;

  // Vorher: Inkasso-Sicht (SICHTFELD) sieht die Rate nach dem Ende nicht mehr, die geschuldete schon.
  const INK = await import("../server/lib/fiaon-inkasso");
  const sicht = async (id: number) => ((await sql.unsafe(`SELECT 1 FROM fiaon_abo_raten r WHERE r.id = $1 AND ${INK.SICHTFELD}`, [id])) as any[]).length === 1;
  ok(!(await sicht(lisa2)), "Inkasso-Liste zeigt die Rate nach dem Vertragsende nicht (vor dem Storno)");
  ok(await sicht(normal2), "Inkasso-Liste zeigt die geschuldete Rate eines laufenden Vertrags");

  const F = await import("../server/lib/fiaon-kuendigung-folgen");
  const erg = await F.kuendigungsFolgenNachziehen();
  const st = async (id: number) => ((await sql`SELECT status, storno_grund FROM fiaon_abo_raten WHERE id = ${id}`) as any[])[0];
  ok((await st(lisa2)).status === "storniert" && (await st(lisa2)).storno_grund === "nach_vertragsende", "Lisa: Rate 2 (27.09.) storniert, Grund nach_vertragsende", JSON.stringify(await st(lisa2)));
  ok((await st(virag2)).status === "storniert", "Virag: Rate 2 (13.09., nach Ende 12.09.) storniert", JSON.stringify(await st(virag2)));
  ok((await st(normal2)).status === "offen", "laufender Vertrag: Rate bleibt offen");
  ok((await st(jahr2)).status === "offen", "Jahresvertrag: hier unberührt");
  const [l] = (await sql`SELECT letzte_rate_nr FROM fiaon_applications WHERE ref = 'FIAON-E391-LISA'`) as any[];
  ok(Number(l.letzte_rate_nr) === 1, "Lisa: „letzte Rate“ auf die letzte geschuldete (1) korrigiert", String(l.letzte_rate_nr));
  const log = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = 'FIAON-E391-LISA' AND agent_name = ${F.AUTOMATIK_NAME}`) as any[];
  ok(log.length === 1 && /AGB § 6/.test(log[0].note), "Verlauf nennt Storno und Grund");
  const [karte] = (await sql`SELECT status FROM fiaon_mara_entscheidungen WHERE schluessel = 'raten_nach_ende:test'`) as any[];
  ok(karte.status === "erledigt_von_selbst", "Sammelkarte im Steuerpult schließt sich selbst", karte.status);
  ok(erg.ratenStorniert === 2 && erg.fehler === 0, "Ergebnis: 2 Raten, keine Fehler", JSON.stringify(erg));
  const erg2 = await F.kuendigungsFolgenNachziehen();
  ok(erg2.ratenStorniert === 0, "zweiter Lauf ändert nichts (idempotent)");

  console.log("── 2 · Vertragsende erst, wenn nichts Geschuldetes offen ist");
  const pE = await person("Emil", "Ende");
  await bestellung(pE, "FIAON-E391-ENDE", { gekuendigt: "2026-10-02T10:00:00Z", letzte: 3, created: "2026-08-05T10:00:00Z" });
  await rate("FIAON-E391-ENDE", 1, "2026-08-05", "2026-08-05T12:00:00Z");
  const ende2 = await rate("FIAON-E391-ENDE", 2, "2026-09-05", null);
  await rate("FIAON-E391-ENDE", 3, "2026-10-05", "2026-10-06T12:00:00Z");
  ok(!(await KU.vertragEndePruefen("FIAON-E391-ENDE", 3)).beendet, "Rate 3 bezahlt, Rate 2 offen → Vertrag NICHT beendet");
  await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = '2026-10-10T12:00:00Z' WHERE id = ${ende2}`;
  ok((await KU.vertragEndePruefen("FIAON-E391-ENDE", 2)).beendet, "danach Rate 2 bezahlt → Vertrag beendet (auch über die ältere Rate)");
  const pE2 = await person("Ella", "Erste");
  await bestellung(pE2, "FIAON-E391-ERSTE", { gekuendigt: "2026-10-02T10:00:00Z", letzte: 3, created: "2026-08-05T10:00:00Z" });
  await rate("FIAON-E391-ERSTE", 1, "2026-08-05", "2026-08-05T12:00:00Z");
  await rate("FIAON-E391-ERSTE", 2, "2026-09-05", "2026-09-06T12:00:00Z");
  ok(!(await KU.vertragEndePruefen("FIAON-E391-ERSTE", 2)).beendet, "letzte Rate (3) noch nicht erzeugt → Zahlung von Rate 2 beendet nichts");

  console.log("── 3 · Formular-Antrag: eindeutig wird gebucht, Identität offen bleibt Karte");
  const pK = await person("Karla", "Garbe");
  await bestellung(pK, "FIAON-E391-KARIN", { created: "2026-08-26T10:00:00Z" });
  await rate("FIAON-E391-KARIN", 1, "2026-08-26", "2026-08-26T12:00:00Z");
  const karin2 = await rate("FIAON-E391-KARIN", 2, "2026-09-26", null);
  const [a1] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at, identifiziert_ueber)
                          VALUES ('FIAON-E391-KARIN', 'Karla', 'Garbe', 'garbe@test.invalid', 'Bitte kündigen', 'pending', '2026-09-15 19:14:00', 'geburtsdatum') RETURNING id`) as any[];
  const pI = await person("Ida", "Identitaet");
  await bestellung(pI, "FIAON-E391-IDENT", { created: "2026-08-26T10:00:00Z" });
  const [a2] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at, identifiziert_ueber)
                          VALUES ('FIAON-E391-IDENT', 'Ida', 'Identitaet', 'identitaet@test.invalid', 'kündigen', 'pending', '2026-09-15 19:14:00', 'name_email') RETURNING id`) as any[];
  const r1 = await F.antragAutomatischBuchen(Number(a1.id));
  ok(r1.gebucht, "eindeutiger Antrag gebucht", r1.warum);
  const [k1] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = 'FIAON-E391-KARIN'`) as any[];
  ok(!!k1.gekuendigt_am, "Bestellung trägt die Kündigung");
  ok((await st(karin2)).status === "storniert", "Rate nach dem Vertragsende (26.09.) gleich mit storniert", JSON.stringify(await st(karin2)));
  const [s1] = (await sql`SELECT status FROM cancellation_requests WHERE id = ${a1.id}`) as any[];
  ok(s1.status !== "pending", "Antrag ist nicht mehr offen", s1.status);
  const r2 = await F.antragAutomatischBuchen(Number(a2.id));
  ok(!r2.gebucht && /Identität/.test(r2.warum), "Identität offen → nicht gebucht, bleibt Karte", r2.warum);

  console.log("── 4 · Längst gebuchte Anträge werden geschlossen");
  const pA = await person("Arne", "Alt");
  await bestellung(pA, "FIAON-E391-ALT", { gekuendigt: "2026-09-02T10:00:00Z", letzte: 1, created: "2026-08-01T10:00:00Z" });
  const [a3] = (await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at, identifiziert_ueber)
                          VALUES ('FIAON-E391-ALT', 'Arne', 'Alt', 'alt@test.invalid', 'kündigen', 'pending', '2026-09-01 08:00:00', 'geburtsdatum') RETURNING id`) as any[];
  await F.kuendigungsFolgenNachziehen();
  const [s3] = (await sql`SELECT status, admin_note FROM cancellation_requests WHERE id = ${a3.id}`) as any[];
  ok(s3.status === "confirmed" && /E-391/.test(String(s3.admin_note)), "alter „pending“-Antrag eines Gekündigten → confirmed mit Vermerk", JSON.stringify(s3));
  const [s2] = (await sql`SELECT status FROM cancellation_requests WHERE id = ${a2.id}`) as any[];
  ok(s2.status === "pending", "der offene Antrag mit offener Identität bleibt offen");

  console.log("── 5 · WhatsApp-Gruppen und Tageslauf laufen ohne Fehler");
  const WA = await import("../server/lib/fiaon-wa-zentrale");
  await WA.zentraleSchema().catch(() => {});
  let waFehler: string | null = null;
  try { await WA.gruppenZahlen(); } catch (e) { waFehler = String((e as Error).message).slice(0, 200); }
  ok(!waFehler, "Gruppenzahlen (mit Ausschluss ungebuchter Kündigungen) rechnen", waFehler ?? "");
  let tagFehler: string | null = null;
  try { await ABO.aboTageslauf({ lauf: sqlPool, force: true }); } catch (e) { tagFehler = String((e as Error).message).slice(0, 200); }
  ok(!tagFehler, "Tageslauf (überfällig stellen mit neuer Regel) läuft", tagFehler ?? "");
  const [ue] = (await sql`SELECT ueberfaellig_seit FROM fiaon_abo_raten WHERE id = ${normal2}`) as any[];
  ok(!!ue.ueberfaellig_seit, "geschuldete überfällige Rate kommt weiter ins Forderungsmanagement");

  console.log("── 6 · Kontoauszug: Neu rechnen setzt den Zeitraum aus den Buchungen");
  const K = await import("../server/lib/fiaon-kontoauszug-analyse");
  await K.ensureAnalyseTabelle();
  const buch = [] as any[];
  for (let t = Date.parse("2026-07-01T00:00:00Z"); t <= Date.parse("2026-09-30T00:00:00Z"); t += 2 * 86_400_000) {
    buch.push({ datum: new Date(t).toISOString().slice(0, 10), betragCents: -1234, empfaenger: "REWE", zweck: "", kategorie: "lebensmittel", wiederkehrend: false, saldoDanachCents: null });
  }
  const [an] = (await sql`INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status, zeitraum_von, zeitraum_bis, buchungen, auswertung_version)
                          VALUES ('FIAON-E391-NORMAL', ${pN}, 'fertig', '2026-07-01', '2026-07-31', ${JSON.stringify(buch)}::text::jsonb, 4) RETURNING id`) as any[];
  await K.analysenNeuRechnen(50);
  const [nach] = (await sql`SELECT to_char(zeitraum_von, 'YYYY-MM-DD') AS von, to_char(zeitraum_bis, 'YYYY-MM-DD') AS bis, auswertung_version FROM fiaon_kontoauszug_analysen WHERE id = ${an.id}`) as any[];
  ok(nach.von === "2026-07-01" && nach.bis >= "2026-09-28" && Number(nach.auswertung_version) === K.AUSWERTUNG_VERSION, "Kopf Juli, Buchungen bis September → Zeitraum 01.07.–Ende September, Fassung 5", JSON.stringify(nach));
  await sql`INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status, created_at) VALUES ('FIAON-E391-HAENGT', ${pN}, 'laeuft', NOW() - INTERVAL '2 hours')`;
  await K.auszuegeNachholen(0).catch(() => {});
  const [h] = (await sql`SELECT status FROM fiaon_kontoauszug_analysen WHERE ref = 'FIAON-E391-HAENGT'`) as any[];
  ok(h.status === "fehler", "hängender Lauf (2 h „läuft“) wird zum Fehler und damit nachgeholt", h.status);

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (lokale Datenbank)`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
