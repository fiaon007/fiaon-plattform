// Prüfstand E-395 (19.10.2026), Datenbank-Teil: Mara trägt einen genannten, mit uns vereinbarten Termin ein —
// mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank. Kein Netz, keine Mail (keine Schlüssel).
// Bricht ab, wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e395?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-genannter-termin-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); } }

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const G = await import("../server/lib/fiaon-mara-genannter-termin");
  const T = await import("../server/lib/fiaon-termine");
  const { berlinWand } = await import("../shared/fiaon-genannter-termin");

  const person = async (vn: string, nn: string, test = false) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am)
                           VALUES (${`PR-E395-${nn}`}, ${vn}, ${nn}, ${`${nn.toLowerCase()}@test.invalid`}, 8, ${test ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, agb_stand, first_name, last_name, email, payment_reference)
              VALUES (${`FIAON-E395-${nn.toUpperCase()}`}, ${pid}, 'private', 'high_end', 'FIAON High-End', 'pending', NOW() - INTERVAL '5 days', '2026-10-05', ${vn}, ${nn}, ${`${nn.toLowerCase()}@test.invalid`}, ${`E395-${nn}`})`;
    return pid;
  };
  const notiz = async (pid: number, text: string, agentId = 8, name = "Daniel Stripling", vor = "1 hour") => {
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
              VALUES ((SELECT ref FROM fiaon_applications WHERE person_id = ${pid} LIMIT 1), ${pid}, ${agentId}, ${name}, 'result', 'erreicht_sonstiges', ${text}, NOW() - ${vor}::interval)`;
  };

  // Eine Uhrzeit HEUTE (Berlin), die in 50–65 Minuten liegt, auf die Viertelstunde + 5 Minuten (sicher außerhalb jedes Rasters).
  const ziel = new Date(Date.now() + 55 * 60_000);
  const zw = berlinWand(ziel);
  const heute = berlinWand(new Date());
  const tagWort = zw.t === heute.t ? "heute" : "morgen";
  const [hh, mm] = zw.hhmm.split(":").map(Number);
  const min = Math.min(55, Math.floor(mm / 15) * 15 + 5);
  const uhr = `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const uhrText = `${hh}.${String(min).padStart(2, "0")} uhr`;

  console.log(`── 1 · Fall #7131 (${tagWort} ${uhr}): Notiz von Daniel + „Gespräch für einen Firmenkredit“ → eingetragen bei Justin`);
  const pW = await person("Sam", "Firmenprobe");
  await notiz(pW, `Hat Interesse an unserem Global Konzept telefoniert ${tagWort} ${uhr} Uhr mit Justin.`);
  const lage = await G.genannterTerminBehandeln({ personId: pW, ref: null, kundeText: `ja bitte stornieren, wir haben ${tagWort} um ${uhrText} ein neues gespräch für einen firmenkredit.`, postmeisterId: 7131 });
  ok(lage?.erkennung.art === "mit_uns", "erkannt: mit_uns", lage?.erkennung);
  ok(lage?.eingetragen === true, "eingetragen (trotz < 2 h Vorlauf und außerhalb des Rasters)", lage?.fehler ?? "");
  ok(lage?.teilnehmer?.id === 928, "Teilnehmer Justin (928)", lage?.teilnehmer);
  const [t1] = (await sql`SELECT * FROM fiaon_termine WHERE person_id = ${pW}`) as any[];
  ok(t1 && Number(t1.agent_id) === 928 && t1.status === "gebucht", "Termin steht bei 928", t1);
  ok(t1?.herkunft === "mara_mail_genannt", "herkunft mara_mail_genannt", t1?.herkunft);
  ok(t1?.quelle === "agent_manuell", "quelle agent_manuell (kein Startgespräch, keine Ableitung)", t1?.quelle);
  ok(t1 && berlinWand(new Date(t1.beginn)).hhmm === uhr, `Beginn ${uhr} Berlin`, t1 ? berlinWand(new Date(t1.beginn)) : null);
  ok(/Daniel Stripling/.test(String(t1?.notiz ?? "")) && /\[Mail #7131\]/.test(String(t1?.notiz ?? "")), "Notiz am Termin mit Beleg (Daniel) und Mail-Nummer", t1?.notiz);
  const [log1] = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${pW} AND agent_name = 'Postmeister' ORDER BY id DESC LIMIT 1`) as any[];
  ok(/Termin .* eingetragen/.test(String(log1?.note ?? "")), "Akte: Vermerk „Termin … eingetragen“", log1?.note);
  const [prot] = (await sql`SELECT art, kanal, termin_id FROM fiaon_mara_protokoll WHERE person_id = ${pW} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
  ok(prot?.art === "termin_eingetragen" && prot?.kanal === "mail" && Number(prot?.termin_id) === Number(t1?.id), "Mara-Protokoll: termin_eingetragen (nicht termin_gebucht → keine Arbeitszeit-Nachprüfung)", prot);
  ok(/ist bei uns eingetragen/.test(String(lage?.hinweis ?? "")) && /nichts verkaufen|NICHTS verkaufen/i.test(String(lage?.hinweis ?? "")), "Hinweis an Mara: eingetragen + zurücknehmen", lage?.hinweis);
  ok(!!lage?.ruhe, "Antwort ist keine Zahlungsaufforderung (ruhe)");

  console.log("── 2 · Dieselbe Mail noch einmal → steht_schon, kein zweiter Termin");
  const lage2 = await G.genannterTerminBehandeln({ personId: pW, ref: null, kundeText: `wir haben ${tagWort} um ${uhrText} das gespräch`, postmeisterId: 7132 });
  const [{ n: anz }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${pW}`) as any[];
  ok(lage2?.erkennung.art === "steht_schon" && anz === 1, "steht_schon, weiter genau ein Termin", { art: lage2?.erkennung.art, anz });

  console.log("── 3 · Zweiter Kunde nennt dieselbe Zeit mit Justin → Überschneidung: nicht eingetragen, ehrlicher Hinweis");
  const pU = await person("Uwe", "Ueberschneidung");
  const lage3 = await G.genannterTerminBehandeln({ personId: pU, ref: null, kundeText: `Wir telefonieren ${tagWort} um ${uhrText} mit Herrn Schwarzott.` });
  ok(lage3?.erkennung.art === "mit_uns" && lage3?.eingetragen === false && !!lage3?.fehler, "mit_uns, aber nicht eingetragen (belegt)", lage3);
  ok(/NICHT EINGETRAGEN/.test(String(lage3?.hinweis ?? "")) && /NICHT, dass es eingetragen ist/.test(String(lage3?.hinweis ?? "")), "Hinweis: nicht „eingetragen“ schreiben", lage3?.hinweis);
  const [log3] = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${pU} AND agent_name = 'Postmeister' ORDER BY id DESC LIMIT 1`) as any[];
  ok(/eintragen ging nicht/.test(String(log3?.note ?? "")), "Akte: Vermerk „eintragen ging nicht … selbst in den Kalender“", log3?.note);

  console.log("── 4 · Termin bei der Hausbank → nichts eintragen");
  const pB = await person("Berta", "Bankprobe");
  const lage4 = await G.genannterTerminBehandeln({ personId: pB, ref: null, kundeText: `Ich habe ${tagWort} um ${uhrText} einen Termin bei meiner Hausbank.` });
  const [{ n: anzB }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${pB}`) as any[];
  ok(lage4?.erkennung.art === "dritte" && anzB === 0, "dritte, kein Termin", { art: lage4?.erkennung.art, anzB });
  ok(/viel Erfolg/.test(String(lage4?.hinweis ?? "")) && /NICHT, dass etwas eingetragen ist/.test(String(lage4?.hinweis ?? "")), "Hinweis: Erfolg wünschen, nichts „eingetragen“", lage4?.hinweis);

  console.log("── 5 · Unklar → nichts eintragen, Vermerk für den Betreuer");
  const pK = await person("Klara", "Unklarprobe");
  const lage5 = await G.genannterTerminBehandeln({ personId: pK, ref: null, kundeText: `Um ${uhrText} habe ich einen Termin, danach melde ich mich.` });
  const [log5] = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${pK} AND agent_name = 'Postmeister' ORDER BY id DESC LIMIT 1`) as any[];
  ok(lage5?.erkennung.art === "unklar" && /ohne dass klar ist, mit wem/.test(String(log5?.note ?? "")), "unklar + Vermerk", { art: lage5?.erkennung.art, note: log5?.note });

  console.log("── 6 · Testperson → nichts");
  const pT = await person("Tess", "Testperson", true);
  const lage6 = await G.genannterTerminBehandeln({ personId: pT, ref: null, kundeText: `Wir telefonieren ${tagWort} um ${uhrText} mit Herrn Schwarzott.` });
  ok(lage6 === null, "Testperson wird nicht angefasst", lage6);

  console.log("── 7 · Kein Termin genannt → null, nichts geschrieben");
  const pN = await person("Nora", "Nichts");
  const lage7 = await G.genannterTerminBehandeln({ personId: pN, ref: null, kundeText: "Danke, ich überweise morgen." });
  ok(lage7 === null, "null");

  console.log("── 8 · terminBuchen: ohne `vereinbart` bleibt das Raster Pflicht");
  const pR = await person("Rita", "Raster");
  let fehlerCode = "";
  try { await T.terminBuchen({ personId: pR, agentId: 8, beginn: new Date(ziel.getTime() + 24 * 3600_000).toISOString(), quelle: "agent_manuell", herkunft: "agent" }); }
  catch (e: any) { fehlerCode = String(e?.code ?? e?.message ?? e); }
  ok(/kein_slot/.test(fehlerCode), "ohne vereinbart: kein_slot außerhalb des Rasters", fehlerCode);

  console.log("── 9 · Notizen-Block für Maras Auftrag");
  const notizen = await G.teamNotizenLesen(pW);
  const block = G.teamNotizenText(notizen) ?? "";
  ok(/Daniel Stripling: „Hat Interesse an unserem Global Konzept/.test(block), "Block zeigt Daniels Notiz", block);
  ok(!/Postmeister/.test(block), "Automatik-Vermerke stehen nicht im Block", block);

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
