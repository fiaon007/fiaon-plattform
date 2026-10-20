// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (lokale DB): ARAS-Warteschlange aus Testdaten, Anruf-Lebenszyklus
// mit Twilio- und Anbieter-Attrappe, Ergebnis in der Akte, Sperren, Notaus,
// Deckel, Webhook-Signatur (E-408, Vertrag § 13 / § 15 Scheibe 1–3)
//
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e408
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e408?sslmode=require' \
//     DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e408?sslmode=require' \
//     npx tsx scripts/pruef-aras-bruecke.ts
//   dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_e408
//
// Keine Schlüssel in der Umgebung → kein Versand, kein Netz; der Anbieter ist
// die Attrappe, Twilio ist die Attrappe. Nur erfundene Nummern und Namen.
// ═══════════════════════════════════════════════════════════════════════════
import http from "node:http";
import express from "express";

// Prüfstand-Umgebung: Platzhalter, keine echten Werte (die Signatur-Rechnung braucht irgendein Geheimnis)
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "pruefstand-geheimnis-e408";
process.env.TWILIO_AUTH_TOKEN = "pruefstand-twilio-token";
delete process.env.OPENAI_API_KEY; delete process.env.BREVO_API_KEY; delete process.env.TWILIO_ACCOUNT_SID;

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const schlafen = (ms: number) => new Promise<void>((l) => setTimeout(l, ms));
async function warten(bis: () => Promise<boolean> | boolean, fristMs = 8000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < fristMs) { if (await bis()) return true; await schlafen(100); }
  return false;
}

async function main(): Promise<void> {
  if (!/127\.0\.0\.1|localhost/.test(String(process.env.DATABASE_URL))) throw new Error("Nur gegen die lokale Prüf-DB.");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasAusweisId, arasSchemaZuruecksetzen } = await import("../server/lib/fiaon-aras-schema");
  const { einstellungSetzen, planFuellen, planLage, planEinreihen, arasEinstellungenLesen, arasEinstellungenVergessen, versucheHeute } = await import("../server/lib/fiaon-aras-plan");
  const { waehlerTakt, waehlen, notaus, start } = await import("../server/lib/fiaon-aras-waehler");
  const { adapterSetzen } = await import("../server/lib/fiaon-aras-adapter");
  const { arasStreamAnbinden, laufendeSitzungen, sitzungFertig, mailboxErkannt, laufZahlen, STREAM_PFAD } = await import("../server/lib/fiaon-aras-bruecke");
  const { ereignisBus } = await import("../server/lib/fiaon-aras-ereignis");
  const { streamToken, signaturBauen } = await import("../server/lib/fiaon-aras-twilio-client");
  const { einwilligungMerken } = await import("../server/lib/fiaon-telefon-einwilligung");
  const { telefonGesperrt } = await import("../server/lib/fiaon-aras-sperre");
  const { anrufListe, anrufDetail, probeanruf, probeUrteil, letzterProbeanruf, tagesZahlen } = await import("../server/lib/fiaon-aras-nachbereitung");
  const { hoerprobeAblegen, hoerprobenListe, hoerprobeAudio, hoerprobeWaehlen } = await import("../server/lib/fiaon-aras-hoerprobe");
  const { attrappeMitSkript } = await import("./attrappen/anbieter-attrappe");
  const { TwilioAttrappe } = await import("./attrappen/twilio-attrappe");
  const { MENSCH_FRAGE_ANTWORT, KI_HINWEIS_VORGABE } = { ...(await import("../shared/fiaon-aras-prompt")), ...(await import("../shared/fiaon-aras")) };

  // ── Server mit Stream-Pfad und Webhooks ──────────────────────────────────
  const app = express();
  app.use(express.json()); app.use(express.urlencoded({ extended: true }));
  app.use("/api/fiaon", (await import("../server/routes/fiaon-aras-twilio")).default);
  const server = http.createServer(app);
  arasStreamAnbinden(server);
  await new Promise<void>((l) => server.listen(0, "127.0.0.1", () => l()));
  const port = (server.address() as any).port as number;
  process.env.APP_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.ARAS_STREAM_HOST = `127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}${STREAM_PFAD}`;

  const busZeilen: { callId: number; wer: string; text: string }[] = [];
  ereignisBus().on("aras", (e: any) => { if (e?.art === "aras_transkript") busZeilen.push({ callId: Number(e.callId), wer: String(e.wer), text: String(e.text) }); });

  titel("0. SCHEMA UND AUSWEIS");
  arasSchemaZuruecksetzen();
  await arasSchema();
  const ausweis = await arasAusweisId();
  const [ag] = (await sqlPool`SELECT art, is_test_account, distribution_active, active FROM fiaon_agents WHERE id = ${ausweis}`) as any[];
  ok("ARAS-Ausweis: art = ki, Testkonto, nicht in der Verteilung, aktiv", ag?.art === "ki" && ag.is_test_account === true && ag.distribution_active === false && ag.active === true, JSON.stringify(ag));
  ok("Ausweis zweimal holen = dieselbe Kennung", (await arasAusweisId()) === ausweis);
  const tabellen = (await sqlPool`SELECT table_name FROM information_schema.tables WHERE table_name IN ('fiaon_aras_plan','fiaon_aras_anruf','fiaon_aras_werkzeug','fiaon_aras_hoerprobe','fiaon_telefon_einwilligung','fiaon_telefon_sperre','fiaon_softphone_praesenz','fiaon_ki_pruefung')`) as any[];
  ok("Acht Tabellen angelegt", tabellen.length === 8, String(tabellen.length));
  const [sp] = (await sqlPool`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE (table_name='fiaon_calls' AND column_name='gefuehrt_von') OR (table_name='fiaon_agents' AND column_name='art') OR (table_name='fiaon_ki_nutzung' AND column_name='sekunden')`) as any[];
  ok("Spalten gefuehrt_von / art / sekunden da", Number(sp?.n) === 3);

  titel("1. EINSTELLUNGEN (Erlaubnisliste, Grenzen)");
  await einstellungSetzen("aras_adapter", "attrappe", "pruefstand");
  await einstellungSetzen("aras_an", "an", "pruefstand");
  await einstellungSetzen("aras_parallel", "3", "pruefstand");
  await einstellungSetzen("aras_probe_nummer", "+491700000099", "pruefstand");
  await einstellungSetzen("aras_fenster", JSON.stringify({ verkauf: { "1-6": ["08:00", "20:00"] }, rate: { "1-6": ["08:00", "20:00"] } }), "pruefstand");
  let wirft = false; try { await einstellungSetzen("mara_aktion_an", "an", "pruefstand"); } catch { wirft = true; }
  ok("Fremder Schlüssel wird abgelehnt", wirft);
  wirft = false; try { await einstellungSetzen("aras_tag_euro", "999", "pruefstand"); } catch { wirft = true; }
  ok("Deckel über 300 € wird abgelehnt", wirft);
  const e1 = await arasEinstellungenLesen(true);
  ok("gelesen: attrappe, an, parallel 3", e1.adapter === "attrappe" && e1.an && e1.parallel === 3);

  titel("2. TESTDATEN (erfunden) UND WARTESCHLANGE");
  const heute = new Date(); const yyyy = (d: Date) => d.toISOString().slice(0, 10);
  const vor = (tage: number) => { const d = new Date(); d.setDate(d.getDate() - tage); return yyyy(d); };
  async function person(n: number, extra: Record<string, unknown> = {}): Promise<number> {
    const nummer = `+4917000000${String(n).padStart(2, "0")}`;
    const [p] = (await sqlPool`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, country, is_blocked, anrede, werbung_gesperrt_am, ist_test_am)
      VALUES (${`PRUEF-E408-${n}`}, ${"Test"}, ${`Prüfkunde${n}`}, ${nummer}, ${nummer.replace(/\D/g, "").slice(-9)}, ${String(extra.country ?? "DE")},
              ${extra.is_blocked === true}, 'herr', ${extra.werbesperre ? new Date() : null}, ${extra.test ? new Date() : null})
      RETURNING id`) as any[];
    return Number(p.id);
  }
  async function antrag(personId: number, n: number, e: { payment_status: string; claimed?: boolean; submitted?: boolean }): Promise<string> {
    const ref = `PRUEF-E408-A${n}`;
    await sqlPool`
      INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, status, current_step, submitted_at, claimed_paid_at, pack_key, pack_name, type, ist_entwurf, created_at)
      VALUES (${ref}, ${`${ref}-Z`}, ${personId}, ${e.payment_status}, ${e.submitted === false ? "started" : "approved"}, ${e.submitted === false ? 3 : 9},
              ${e.submitted === false ? null : new Date()}, ${e.claimed ? new Date() : null}, 'plus', 'Plus', 'privat', FALSE, NOW() - INTERVAL '2 hours')`;
    return ref;
  }
  // P1: Kunde mit Rate (3 Tage überfällig) — Vertragssache
  const p1 = await person(1); const r1 = await antrag(p1, 1, { payment_status: "paid" });
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${r1}, 2, ${`${r1}-2`}, 5999, ${vor(3)}::date, 'offen')`;
  // P2: Zahlung gemeldet (Stufe A)
  const p2 = await person(2); await antrag(p2, 2, { payment_status: "claimed_paid", claimed: true });
  // P3: Antrag unbezahlt + Zuruf-JA (Einwilligung)
  const p3 = await person(3); const r3 = await antrag(p3, 3, { payment_status: "pending_payment" });
  await einwilligungMerken({ personId: p3, nummer: "+491700000003", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef" });
  // P4: Antrag unbezahlt, Zuruf-JA, aber WERBESPERRE → kein Eintrag
  const p4 = await person(4, { werbesperre: true }); await antrag(p4, 4, { payment_status: "pending_payment" });
  await einwilligungMerken({ personId: p4, nummer: "+491700000004", art: "zuruf_mail", wortlaut: "JA", quelleArt: "mail", quelleId: "pruef" });
  // P5: Zusage gestern, nichts gebucht
  const p5 = await person(5); const r5 = await antrag(p5, 5, { payment_status: "pending_payment" });
  await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, promised_date, created_at) VALUES (${r5}, ${p5}, ${ausweis}, 'Prüfstand', 'result', 'erreicht_zahlt_am', 'zahlt morgen', ${`${vor(1)}T12:00:00+02:00`}::timestamptz, NOW() - INTERVAL '1 day')`;
  // P6: Testperson mit Rate → nie
  const p6 = await person(6, { test: true }); const r6 = await antrag(p6, 6, { payment_status: "paid" });
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${r6}, 2, ${`${r6}-2`}, 5999, ${vor(3)}::date, 'offen')`;
  // P7: Schweizer Nummer, Zuruf-JA, keine CH-Nummer eingetragen → kein Werbeanruf
  const [p7r] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, country, is_blocked) VALUES ('PRUEF-E408-7', 'Test', 'Prüfkunde7', '+41790000007', '790000007', 'CH', FALSE) RETURNING id`) as any[];
  const p7 = Number(p7r.id); await antrag(p7, 7, { payment_status: "pending_payment" });
  await einwilligungMerken({ personId: p7, nummer: "+41790000007", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef7" });
  // P8: Rate überfällig, aber Vertrag gekündigt (Altvertrag) → nie
  const p8 = await person(8); const r8 = await antrag(p8, 8, { payment_status: "paid" });
  await sqlPool`UPDATE fiaon_applications SET gekuendigt_am = NOW() - INTERVAL '40 days', vertrag_ende_am = NOW() - INTERVAL '10 days', agb_stand = NULL WHERE ref = ${r8}`;
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${r8}, 3, ${`${r8}-3`}, 5999, ${vor(3)}::date, 'offen')`;

  const f = await planFuellen();
  log(`  Füller: ${JSON.stringify(f)}`);
  // Der Prüfstand läuft auch nachts: spaet_bis (Fensterende 20:00) liegt dann schon hinter uns, und der nächste Füller-Lauf
  // würde die frischen Einträge als „verfallen“ markieren. Für die Prüfung das Fenster der Einträge um zwei Stunden strecken.
  await sqlPool`UPDATE fiaon_aras_plan SET spaet_bis = GREATEST(spaet_bis, NOW() + INTERVAL '2 hours') WHERE status = 'wartet'`;
  const plan = (await sqlPool`SELECT person_id, spielart, status, rechtsgrund, einwilligung_id, betrag_cents FROM fiaon_aras_plan ORDER BY id`) as any[];
  const hat = (pid: number, s: string) => plan.some((z) => Number(z.person_id) === pid && z.spielart === s);
  ok("P1 Rate (Tag 3) eingereiht, mit Betrag, Rechtsgrund vertrag", hat(p1, "rate") && plan.find((z) => Number(z.person_id) === p1)?.rechtsgrund === "vertrag" && Number(plan.find((z) => Number(z.person_id) === p1)?.betrag_cents) === 5999);
  ok("P2 Stufe A eingereiht", hat(p2, "stufe_a"));
  ok("P3 Zuruf eingereiht mit Einwilligungs-Kennung", hat(p3, "zuruf") && plan.find((z) => Number(z.person_id) === p3)?.einwilligung_id != null);
  ok("P4 (Werbesperre) NICHT eingereiht", !hat(p4, "zuruf"));
  ok("P5 Zusage nachfassen eingereiht", hat(p5, "zusage"));
  ok("P6 (Testperson) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p6));
  ok("P7 (CH ohne eingetragene Nummer) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p7));
  ok("P8 (Rate nach Vertragsende) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p8));
  const f2 = await planFuellen();
  const [n1] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p1} AND status = 'wartet'`) as any[];
  ok("Zweiter Füller-Lauf reiht nichts doppelt ein", f2.eingereiht.rate == null && Number(n1?.n) === 1, `${JSON.stringify(f2.eingereiht)} / ${n1?.n}`);
  const lage = await planLage();
  ok("planLage: wartet ≥ 4, nächste 20 mit Namen", lage.wartet >= 4 && lage.naechste.length >= 4 && lage.naechste[0].name.length > 0, `${lage.wartet} / ${lage.naechste.length}`);
  const chefEinreihen = await planEinreihen({ personId: p4, nummer: "+491700000004", spielart: "rate", grund: "Chef", erzeugtVon: "chef" });
  ok("Chef reiht Vertragssache (rate) trotz Werbesperre ein", chefEinreihen.ok, chefEinreihen.grund);
  const sperreVersuch = await planEinreihen({ personId: p4, nummer: "+491700000004", spielart: "zuruf", grund: "Chef", erzeugtVon: "chef" });
  ok("Werbe-Spielart an Werbesperre wird abgelehnt", !sperreVersuch.ok && /Werbesperre/.test(sperreVersuch.grund ?? ""));

  titel("3. WÄNDE DES WÄHLERS");
  adapterSetzen("attrappe", attrappeMitSkript({ schritte: [] }));
  await einstellungSetzen("aras_an", "aus", "pruefstand");
  let t = await waehlerTakt();
  ok("aras_an = aus → nichts gewählt, Grund aras_aus", t.gewaehlt === 0 && t.ausgelassen.some((a) => a.grund === "aras_aus"));
  await einstellungSetzen("aras_an", "an", "pruefstand");
  await einstellungSetzen("aras_tag_euro", "0", "pruefstand");
  await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe', 0, 0, 0, 0, 1, TRUE)`;
  t = await waehlerTakt();
  ok("Deckel 0 € → Grund deckel", t.gewaehlt === 0 && t.ausgelassen.some((a) => a.grund === "deckel"), JSON.stringify(t.ausgelassen));
  await einstellungSetzen("aras_tag_euro", "60", "pruefstand");
  await einstellungSetzen("aras_notaus", "an", "pruefstand");
  t = await waehlerTakt();
  ok("Notaus → Grund notaus", t.ausgelassen.some((a) => a.grund === "notaus"));
  await einstellungSetzen("aras_notaus", "aus", "pruefstand");
  // Versuche je Person: P2 hatte heute schon einen Mitarbeiter-Anruf
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von) VALUES (${p2}, ${ausweis}, '+491700000002', 'raus', 'beendet', NOW() - INTERVAL '3 hours', 'CA-pruef-mensch', 'mensch')`;
  const v2 = await versucheHeute(p2);
  ok("versucheHeute zählt den Mitarbeiter-Anruf (Mensch + ARAS zusammen)", v2.heute === 1 && v2.woche === 1, JSON.stringify(v2));
  await einstellungSetzen("aras_parallel", "1", "pruefstand");
  t = await waehlerTakt();
  log(`  Takt: ${JSON.stringify(t)}`);
  const fensterZu = t.ausgelassen.some((a) => a.grund.startsWith("fenster:"));
  if (fensterZu) { ok("Außerhalb des Fensters (Nacht/Sonntag): nichts gewählt, Grund fenster", t.gewaehlt === 0); }
  else {
    ok("Parallel 1 → genau ein Anruf gewählt", t.gewaehlt === 1, String(t.gewaehlt));
    ok("P2 blieb wegen je_person_tag liegen", t.ausgelassen.some((a) => a.grund === "je_person_tag") || !((await sqlPool`SELECT 1 FROM fiaon_aras_plan WHERE person_id = ${p2} AND status = 'gewaehlt'`) as any[]).length);
  }
  // Was gewählt wurde, wieder zurücksetzen (Attrappe hat keine Twilio-Meldung): wir fahren den Lebenszyklus gezielt unten
  await sqlPool`UPDATE fiaon_aras_plan SET status = 'wartet', call_id = NULL WHERE status = 'gewaehlt'`;
  await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt')`;
  await sqlPool`DELETE FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt'`;
  await einstellungSetzen("aras_parallel", "3", "pruefstand");

  // ── Hilfe: einen Plan-Eintrag wählen und die Attrappen laufen lassen ─────
  async function gespraech(planId: number, skript: Parameters<typeof attrappeMitSkript>[0], opt: { probe?: boolean; nichtAuflegen?: boolean; vorStart?: (callId: number) => Promise<void> } = {}) {
    const att = attrappeMitSkript(skript);
    adapterSetzen("attrappe", att);
    const w = await waehlen(planId, { probe: opt.probe });
    if (!w.ok || !w.callId) throw new Error(`waehlen: ${w.grund}`);
    const callId = w.callId;
    if (opt.vorStart) await opt.vorStart(callId);
    const tw = new TwilioAttrappe({ url: wsUrl, anrufId: callId, t: streamToken(callId) });
    await tw.start();
    await warten(() => laufendeSitzungen().some((l) => l.callId === callId), 4000);
    return { att, tw, callId };
  }
  const anruf = async (callId: number) => ((await sqlPool`SELECT aa.*, c.status AS call_status, c.ergebnis AS call_ergebnis, c.ohne_aufzeichnung_am, c.dauer_sek FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id WHERE aa.call_id = ${callId}`) as any[])[0];
  const morgen = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return yyyy(d); })();

  titel("4. LEBENSZYKLUS: Ja zur Aufnahme, Zusage, „Sind Sie ein Mensch?“, Unterbrechung, nicht mehr anrufen");
  {
    const [pl] = (await sqlPool`SELECT id FROM fiaon_aras_plan WHERE person_id = ${p1} AND spielart = 'rate' AND status = 'wartet'`) as any[];
    const { att, tw, callId } = await gespraech(Number(pl.id), { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 400 },
      { kunde: "Ja, am Apparat." },
      { aras: "Schön. Eine Sache noch: Darf ich das Gespräch aufzeichnen? Dann sagen Sie bitte einfach Ja.", ms: 300 },
      { kunde: "Ja, gerne." },
      { werkzeug: "aufnahme_starten" },
      { kunde: "Sind Sie ein Mensch?" },
      { aras: MENSCH_FRAGE_ANTWORT, ms: 300 },
      { unterbrechen: true },
      { warteMs: 450 },
      { kunde: "Ich kann morgen überweisen." },
      { werkzeug: "zahlungszusage_merken", eingabe: { datum: morgen } },
      { werkzeug: "akte_nachsehen", eingabe: { bereich: "zahlungen" } },
      { kunde: "Und rufen Sie mich bitte nicht mehr an." },
      { werkzeug: "nicht_mehr_anrufen" },
      { aras: "Dann wünsche ich Ihnen einen schönen Tag.", ms: 200 },
      { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_zahlt_am", notiz: "Zahlt morgen, will keine Anrufe mehr." } },
    ] });
    ok("Sitzung läuft (laufendeSitzungen)", laufendeSitzungen().some((l) => l.callId === callId));
    const fertig = sitzungFertig(callId);
    await Promise.race([fertig ?? Promise.resolve(), schlafen(15000)]);
    await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 6000);
    const a = await anruf(callId);
    const tz = tw.gesendet();
    log(`  Twilio-Attrappe bekam: ${JSON.stringify(tz)} · Attrappe: ${att.spur.werkzeuge.map((w) => `${w.name}:${w.ergebnis.ok}`).join(",")}`);
    ok("Brücke schickte Ton (media) und marks", tz.media > 0 && tz.mark > 0, JSON.stringify(tz));
    ok("Unterbrechung → mindestens ein clear", tz.clear >= 1, String(tz.clear));
    ok("Kundenton kam beim Adapter an (audioRein)", att.spur.audioReinBytes > 0);
    ok("KI-Hinweis-Zeit gespeichert", !!a?.ki_hinweis_am);
    ok("Aufnahme-Ja: Zeit + Wortlaut („Ja, gerne.“) + Start", !!a?.aufnahme_ja_am && /Ja, gerne/.test(String(a?.aufnahme_ja_text)) && !!a?.aufnahme_gestartet_am, String(a?.aufnahme_ja_text));
    ok("Transkript gespeichert (nach Ja), mit Kunden- und Aras-Zeilen", Array.isArray(a?.transkript) && a.transkript.some((z: any) => z.wer === "kunde") && a.transkript.some((z: any) => z.wer === "aras"));
    ok("Abgebrochene Aras-Zeile markiert", Array.isArray(a?.transkript) && a.transkript.some((z: any) => z.abgebrochen === true));
    ok("Ende-Grund aras_beendet, Ergebnis erreicht_zahlt_am, nachbereitet", a?.ende_grund === "aras_beendet" && a?.ergebnis === "erreicht_zahlt_am" && !!a?.nachbereitet_am, `${a?.ende_grund}/${a?.ergebnis}`);
    ok("fiaon_calls: beendet, Ergebnis, Zusammenfassung", a?.call_status === "beendet" && a?.call_ergebnis === "erreicht_zahlt_am" && String(a?.zusammenfassung ?? "").length > 10);
    const wz = (await sqlPool`SELECT werkzeug, ok FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${a.id} ORDER BY id`) as any[];
    const wzAuf = (await sqlPool`SELECT aufruf_id FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${a.id} AND werkzeug = 'aufnahme_starten' ORDER BY id`) as any[];
    ok("Sechs Werkzeug-Zeilen, alle ok — die Aufnahme startete die Brücke selbst beim Ja (Werkzeug danach: „läuft schon“)",
      wz.length === 6 && wz.every((w) => w.ok === true) && String(wzAuf[0]?.aufruf_id).startsWith("bruecke_ja_"), wz.map((w) => `${w.werkzeug}:${w.ok}`).join(","));
    const [cl] = (await sqlPool`SELECT outcome, promised_date, agent_name FROM fiaon_contact_log WHERE ref = ${r1} AND type = 'result' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Akte: Ergebnis erreicht_zahlt_am mit Zusage-Datum, Akteur Aras", cl?.outcome === "erreicht_zahlt_am" && !!cl?.promised_date && cl?.agent_name === "Aras", JSON.stringify(cl));
    ok("Telefonsperre gesetzt + Werbesperre an der Person", (await telefonGesperrt("700000001", p1)) && !!((await sqlPool`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${p1}`) as any[])[0].werbung_gesperrt_am);
    const [zus] = (await sqlPool`SELECT status FROM fiaon_aras_plan WHERE person_id = ${p1} AND spielart = 'zusage'`) as any[];
    ok("Zusage-Nachfassen eingereiht — und durch die Sperre auf gesperrt", zus?.status === "gesperrt", zus?.status);
    const [plFertig] = (await sqlPool`SELECT status FROM fiaon_aras_plan WHERE id = ${Number(pl.id)}`) as any[];
    ok("Plan-Eintrag fertig", plFertig?.status === "fertig", plFertig?.status);
    const proto = (await sqlPool`SELECT art FROM fiaon_mara_protokoll WHERE kanal = 'telefon' AND (daten->>'callId')::int = ${callId} ORDER BY id`) as any[];
    const arten = proto.map((p) => p.art);
    ok("Protokoll: gewählt, angenommen, KI-Hinweis, Aufnahme-Ja, Zusage, Sperre, Ende", ["aras_gewaehlt", "aras_angenommen", "aras_ki_hinweis", "aras_aufnahme_ja", "aras_zusage", "aras_sperre", "aras_ende"].every((x) => arten.includes(x)), arten.join(","));
    ok("Prüfstatus „offen“ — Prüf-Mara (E-409) prüft das Gespräch mit Transkript", a?.pruefung_status === "offen", String(a?.pruefung_status));
    ok("Voraus-Takt: nie mehr als 5 Marken (500 ms) bei Twilio offen", tz.maxOffen <= 5, String(tz.maxOffen));
    const zeilenBus = busZeilen.filter((z) => z.callId === callId);
    ok("Live-Strom: ganze Sätze (keine Fetzen) — Kunde und Aras", zeilenBus.some((z) => z.wer === "kunde" && /Ja, am Apparat/.test(z.text)) && zeilenBus.some((z) => z.wer === "aras" && /also eine KI/.test(z.text)), zeilenBus.map((z) => `${z.wer}:${z.text.slice(0, 20)}`).join(" | "));
    const liste = await anrufListe({});
    const det = await anrufDetail(a.id);
    ok("anrufListe + anrufDetail liefern den Anruf mit Werkzeugen und Transkript", liste.some((z) => z.callId === callId) && det?.werkzeuge.length === 6 && Array.isArray(det?.transkript));
    ok("Sitzung aus dem Speicher entfernt", !laufendeSitzungen().some((l) => l.callId === callId));
    ok("Twilio-Attrappe wurde von der Brücke geschlossen", await tw.geschlossen(3000));
  }

  titel("5. NEIN ZUR AUFNAHME, KUNDE LEGT AUF");
  {
    const [pl] = (await sqlPool`SELECT id FROM fiaon_aras_plan WHERE person_id = ${p2} AND spielart = 'stufe_a' AND status = 'wartet'`) as any[];
    const { tw, callId } = await gespraech(Number(pl.id), { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja." }, { aras: "Darf ich aufzeichnen? Sagen Sie einfach Ja.", ms: 200 },
      { kunde: "Nein, lieber nicht." }, { werkzeug: "aufnahme_abgelehnt" }, { kunde: "Ich habe gestern überwiesen." }, { werkzeug: "zahlung_gemeldet", eingabe: { am: vor(1) } },
      { warteMs: 150 },
    ] });
    await schlafen(900);
    tw.aufhaengen();
    await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 8000);
    const a = await anruf(callId);
    ok("Aufnahme-Nein gespeichert, kein Transkript, fiaon_calls.ohne_aufzeichnung_am", !!a?.aufnahme_nein_am && a?.transkript == null && !!a?.ohne_aufzeichnung_am && !a?.aufnahme_ja_am);
    ok("Kunde legt auf → ende_grund kunde_aufgelegt, Ergebnis aus Werkzeug: erreicht_zahlt_gleich", a?.ende_grund === "kunde_aufgelegt" && a?.ergebnis === "erreicht_zahlt_gleich", `${a?.ende_grund}/${a?.ergebnis}`);
    ok("Zusammenfassung ohne KI-Schlüssel: beschreibender Rückfall", /Werkzeuge|Ohne Aufzeichnung/.test(String(a?.zusammenfassung)), String(a?.zusammenfassung).slice(0, 80));
    ok("Ohne Aufnahme-Ja: Befund der harten Regeln gespeichert (nur Regelnamen, kein Wortlaut)", a?.pruefung?.live === true && Array.isArray(a?.pruefung?.punkte) && !JSON.stringify(a?.pruefung ?? {}).includes("überwiesen"), JSON.stringify(a?.pruefung ?? null).slice(0, 120));
    const [ap] = (await sqlPool`SELECT claimed_paid_at, payment_status FROM fiaon_applications WHERE person_id = ${p2}`) as any[];
    ok("Stufe A bleibt gemeldet (claimed_paid)", !!ap?.claimed_paid_at && ap?.payment_status === "claimed_paid");
  }

  titel("6. MAILBOX (AMD) OHNE KUNDENSTIMME → AUFLEGEN; MIT KUNDENSTIMME → WEITER");
  {
    const [pl] = (await sqlPool`SELECT id FROM fiaon_aras_plan WHERE person_id = ${p5} AND spielart = 'zusage' AND status = 'wartet'`) as any[];
    const { callId } = await gespraech(Number(pl.id), { schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 4000 }] });
    const r = await mailboxErkannt(callId);
    await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 6000);
    const a = await anruf(callId);
    ok("AMD „Maschine“ ohne Kundenstimme → aufgelegt, Ergebnis mailbox, fiaon_calls niemand_erreicht", r === "aufgelegt" && a?.ergebnis === "mailbox" && a?.call_status === "niemand_erreicht", `${r}/${a?.ergebnis}/${a?.call_status}`);
    const neu = await planEinreihen({ personId: p3, nummer: "+491700000003", spielart: "zuruf", grund: "Prüfstand AMD", erzeugtVon: "chef" });
    const [pl3] = (await sqlPool`SELECT id FROM fiaon_aras_plan WHERE person_id = ${p3} AND spielart = 'zuruf' AND status = 'wartet'`) as any[];
    const g2 = await gespraech(Number(pl3?.id ?? neu.id), { schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 200 }, { kunde: "Hallo, ja?", nachMs: 1200 }, { warteMs: 3000 }] });
    await warten(() => laufendeSitzungen().some((l) => l.callId === g2.callId && l.letzteZeilen.some((z) => z.wer === "kunde")), 4000);
    const r2 = await mailboxErkannt(g2.callId);
    ok("AMD „Maschine“ trotz Kundenstimme → Gespräch läuft weiter (Widerspruch)", r2 === "weiter" && laufendeSitzungen().some((l) => l.callId === g2.callId), r2);
    g2.tw.aufhaengen();
    await warten(async () => !!(await anruf(g2.callId))?.nachbereitet_am, 6000);
    const proto = (await sqlPool`SELECT 1 FROM fiaon_mara_protokoll WHERE art = 'aras_amd_widerspruch' AND (daten->>'callId')::int = ${g2.callId}`) as any[];
    ok("Protokoll aras_amd_widerspruch", proto.length === 1);
  }

  titel("7. ANBIETER-FEHLER (429, fatal) → Sitzung endet mit fehler, Protokoll");
  {
    const neu = await planEinreihen({ personId: p2, nummer: "+491700000002", spielart: "rate", grund: "Prüfstand 429", erzeugtVon: "chef" });
    const { callId } = await gespraech(Number(neu.id), { schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 200 }, { fehler: { code: "rate_limit_exceeded", text: "429", fatal: true } }] });
    await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 6000);
    const a = await anruf(callId);
    ok("ende_grund fehler, Ergebnis abgebrochen/nicht_erreicht, nachbereitet", a?.ende_grund === "fehler" && ["abgebrochen", "nicht_erreicht"].includes(a?.ergebnis) && !!a?.nachbereitet_am, `${a?.ende_grund}/${a?.ergebnis}`);
    const proto = (await sqlPool`SELECT 1 FROM fiaon_mara_protokoll WHERE art = 'aras_fehler' AND (daten->>'callId')::int = ${callId}`) as any[];
    ok("Protokoll aras_fehler", proto.length >= 1);
  }

  titel("8. NOTAUS MITTEN IM GESPRÄCH, DANN START");
  {
    const neu = await planEinreihen({ personId: p3, nummer: "+491700000003", spielart: "stufe_a", grund: "Prüfstand Notaus", erzeugtVon: "chef" });
    const { att, callId } = await gespraech(Number(neu.id), { schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja?" }, { warteMs: 20000 }] });
    const t0 = Date.now();
    const r = await notaus("pruefstand", "Prüfung");
    ok("Notaus beendet das laufende Gespräch (Abschiedssatz als Anweisung, 2,5–7 s)", r.beendet === 1 && att.spur.eingeschoben.some((x) => x.art === "anweisung" && /beenden/.test(x.text)) && Date.now() - t0 >= 2400 && Date.now() - t0 < 7500, `${r.beendet} / ${Date.now() - t0} ms`);
    await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 6000);
    const a = await anruf(callId);
    ok("ende_grund notaus, Ergebnis abgebrochen", a?.ende_grund === "notaus" && a?.ergebnis === "abgebrochen", `${a?.ende_grund}/${a?.ergebnis}`);
    ok("aras_notaus = an, Takt lässt alles aus", (await arasEinstellungenLesen(true)).notaus && (await waehlerTakt()).ausgelassen.some((x) => x.grund === "notaus"));
    await start("pruefstand");
    ok("start() hebt Notaus auf", !(await arasEinstellungenLesen(true)).notaus);
    ok("Protokoll aras_notaus", ((await sqlPool`SELECT 1 FROM fiaon_mara_protokoll WHERE art = 'aras_notaus'`) as any[]).length >= 1);
  }

  titel("9. PROBEANRUF: nur an die hinterlegte Nummer, Werkzeuge trocken, Daumen");
  {
    const { berlinTeile } = await import("../shared/fiaon-aras");
    const nacht = (() => { const h = berlinTeile(new Date()).hhmm; return h < "07:00" || h >= "23:00"; })();
    const attP = attrappeMitSkript({ schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 200 }, { kunde: "Hier Justin." },
      { werkzeug: "zahlungslink_senden", eingabe: { weg: "whatsapp", zweck: "zahlung" } },
      { werkzeug: "zahlungszusage_merken", eingabe: { datum: morgen } },
      { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Probe" } },
    ] });
    adapterSetzen("attrappe", attP);
    const waVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp`.catch(() => [{ n: 0 }])) as any[])[0]?.n ?? 0);
    const clVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log`) as any[])[0]?.n ?? 0);
    const r = await probeanruf({ spielart: "rate", von: "pruefstand" });
    if (nacht) {
      ok("Nachts (vor 7 / ab 23 Uhr): Probeanruf abgelehnt mit Klartext", !r.ok && /7 bis 23/.test(r.grund ?? ""), r.grund);
    } else {
      ok("Probeanruf gewählt (ohne Person, gespielte Art Rate)", r.ok && !!r.callId, r.grund);
      if (r.callId) {
        const [c] = (await sqlPool`SELECT nummer, person_id FROM fiaon_calls WHERE id = ${r.callId}`) as any[];
        ok("Ziel ist die Probe-Nummer, keine Person", c?.nummer === "+491700000099" && c?.person_id == null, JSON.stringify(c));
        const tw = new TwilioAttrappe({ url: wsUrl, anrufId: r.callId, t: streamToken(r.callId) });
        await tw.start();
        await warten(async () => !!(await anruf(r.callId!))?.nachbereitet_am, 9000);
        const a = await anruf(r.callId);
        ok("Probe: Anruf-Spielart probe, Briefing probe=true + gespielte Art rate, Probe-Daten FIAON-PROBE-01", a?.spielart === "probe" && a?.briefing?.probe === true && a?.briefing?.probeSpielart === "rate" && a?.briefing?.offeneRate?.verwendungszweck === "FIAON-PROBE-01", `${a?.spielart}/${a?.briefing?.probeSpielart}`);
        const wz = (await sqlPool`SELECT werkzeug, ok, ergebnis FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${a.id} ORDER BY id`) as any[];
        ok("Probe: Werkzeuge melden ok, laufen aber trocken (still: „Probe: …“)", wz.length === 3 && wz.slice(0, 2).every((w) => w.ok === true && /Probe/.test(JSON.stringify(w.ergebnis))), wz.map((w) => w.werkzeug).join(","));
        const waNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp`.catch(() => [{ n: 0 }])) as any[])[0]?.n ?? 0);
        const clNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log`) as any[])[0]?.n ?? 0);
        const [zus] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE spielart = 'zusage' AND person_id IS NULL`) as any[];
        ok("Probe: keine WhatsApp, kein Akten-Eintrag, kein Zusage-Nachfassen", waNach === waVorher && clNach === clVorher && Number(zus?.n) === 0, `${waVorher}→${waNach} / ${clVorher}→${clNach}`);
        const lp = await letzterProbeanruf();
        ok("letzterProbeanruf liefert den Anruf (Stand der Probe-Bedienung)", lp?.callId === r.callId && lp?.spielart === "rate", JSON.stringify(lp).slice(0, 120));
        const u = await probeUrteil({ callId: r.callId, daumen: "runter", grund: "klingt nach KI · zu langsam", von: "pruefstand" });
        const [pu] = (await sqlPool`SELECT probe_urteil, probe_urteil_grund FROM fiaon_aras_anruf WHERE call_id = ${r.callId}`) as any[];
        ok("Daumen runter + Grund gespeichert", u.ok && pu?.probe_urteil === "runter" && /klingt nach KI/.test(String(pu?.probe_urteil_grund)), JSON.stringify(pu));
        const tz = await tagesZahlen(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }));
        ok("tagesZahlen zählt Proben getrennt (nicht als gewählt)", tz.proben >= 1, JSON.stringify(tz));
      }
    }
    // HART: ein Probe-Eintrag mit fremder Nummer wird nie gewählt — und ein Kunden-Weg wählt keinen Probe-Eintrag
    const fremd = await planEinreihen({ personId: null, nummer: "+491700000055", spielart: "probe", grund: "Prüfstand fremde Nummer", erzeugtVon: "probe", fruehAb: new Date(), spaetBis: new Date(Date.now() + 600_000) });
    const wf = fremd.id ? await waehlen(fremd.id, { probe: true }) : { ok: false, grund: "nicht eingereiht" };
    ok("Probe an eine andere Nummer → hart abgelehnt", !wf.ok && /nur an die hinterlegte Probe-Nummer/.test(wf.grund ?? ""), wf.grund);
    const [fz] = fremd.id ? ((await sqlPool`SELECT status FROM fiaon_aras_plan WHERE id = ${fremd.id}`) as any[]) : [null];
    ok("… und der Eintrag ist gesperrt", fz?.status === "gesperrt", fz?.status);
    const zweit = await planEinreihen({ personId: null, nummer: "+491700000099", spielart: "probe", grund: "Prüfstand Weg", erzeugtVon: "probe", fruehAb: new Date(), spaetBis: new Date(Date.now() + 600_000) });
    const wk = zweit.id ? await waehlen(zweit.id, {}) : { ok: false, grund: "" };
    ok("Probe-Eintrag über den Kunden-Weg (ohne probe) → abgelehnt", !wk.ok && /Probe-Einträge wählt nur der Probeanruf/.test(wk.grund ?? ""), wk.grund);
    if (zweit.id) await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE id = ${zweit.id}`;
    await einstellungSetzen("aras_leerlauf", "an", "pruefstand");
    const rl = await probeanruf({ spielart: "probe", von: "pruefstand" });
    ok("Leerlauf an → kein Probeanruf", !rl.ok && /Leerlauf/.test(rl.grund ?? ""), rl.grund);
    await einstellungSetzen("aras_leerlauf", "aus", "pruefstand");
    await einstellungSetzen("aras_tag_euro", "0", "pruefstand");
    const rd = await probeanruf({ spielart: "probe", von: "pruefstand" });
    ok("Tagesdeckel erreicht → kein Probeanruf", !rd.ok && /Tagesdeckel/.test(rd.grund ?? ""), rd.grund);
    await einstellungSetzen("aras_tag_euro", "60", "pruefstand");
    await einstellungSetzen("aras_probe_nummer", "", "pruefstand");
    const r2 = await probeanruf({ spielart: "probe", von: "pruefstand" });
    ok("Ohne Probe-Nummer (und ohne Nummer im Ausweis 928): abgelehnt mit Anleitung", !r2.ok && /Probe-Nummer|Handynummer/.test(r2.grund ?? ""), r2.grund);
    await einstellungSetzen("aras_probe_nummer", "+491700000099", "pruefstand");
  }

  titel("10. STREAM-TOKEN, SIGNATUR, HÖRPROBE");
  {
    const WebSocket = (await import("ws")).default;
    const falsch = new WebSocket(wsUrl);
    const code = await new Promise<number>((l) => { falsch.on("open", () => falsch.send(JSON.stringify({ event: "start", start: { streamSid: "MZx", callSid: "CAx", customParameters: { anruf: "1", t: "falsch" } } }))); falsch.on("close", (c) => l(c)); });
    ok("Falsches Token → Verbindung zu (4401)", code === 4401, String(code));
    const stumm = new WebSocket(wsUrl);
    const t0 = Date.now();
    const code2 = await new Promise<number>((l) => stumm.on("close", (c) => l(c)));
    ok("Kein start binnen 5 s → zu (4401)", code2 === 4401 && Date.now() - t0 >= 4500 && Date.now() - t0 < 8000, `${code2} nach ${Date.now() - t0} ms`);
    const url = `${process.env.APP_BASE_URL}/api/fiaon/aras/status?anruf=1`;
    const body = { CallSid: "CA1", CallStatus: "completed", CallDuration: "10" };
    const form = new URLSearchParams(body).toString();
    const r403 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": "falsch" }, body: form });
    ok("Webhook mit falscher Signatur → 403", r403.status === 403, String(r403.status));
    const sig = signaturBauen(process.env.TWILIO_AUTH_TOKEN!, url, body);
    const r200 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": sig }, body: form });
    ok("Webhook mit richtiger Signatur → 200", r200.status === 200, String(r200.status));
    const h = await hoerprobeAblegen({ adapter: "attrappe", stimme: "flitz", text: "Hallo, hier ist Aras von FIAON – ich bin eine KI.", bytes: Buffer.from("RIFFpruef"), dauerMs: 900 });
    const liste = await hoerprobenListe();
    const audio = await hoerprobeAudio(h.id);
    ok("Hörprobe abgelegt, gelistet, Audio abrufbar", liste.some((z) => z.id === h.id && z.hatAudio) && !!audio && audio.bytes.length === 9);
    await hoerprobeWaehlen(h.id, "pruefstand");
    arasEinstellungenVergessen();
    const e = await arasEinstellungenLesen(true);
    ok("„Diese nehmen“ setzt Adapter + Stimme", e.adapter === "attrappe" && e.stimme === "flitz" && (await hoerprobenListe()).find((z) => z.id === h.id)?.gewaehltAm != null);
  }

  titel("11. SPERRE: gesperrte Person wird nie wieder gewählt");
  {
    const r = await planEinreihen({ personId: p1, nummer: "+491700000001", spielart: "rate", grund: "nach Sperre", erzeugtVon: "chef" });
    ok("planEinreihen lehnt gesperrte Person ab", !r.ok && /Telefonsperre/.test(r.grund ?? ""), r.grund);
  }

  titel("12. VORWÄRMEN BEIM ABHEBEN, ABSCHIED, MAILBOX-ANSAGE, UNTERBRECHEN PER LAUTSTÄRKE");
  {
    // a) TwiML-Abruf (Abheben) baut die Sitzung schon auf — der Strom hängt sich an die vorbereitete Sitzung
    const pVorw = await person(21); await antrag(pVorw, 21, { payment_status: "paid" });
    const e1 = await planEinreihen({ personId: pVorw, nummer: "+491700000021", spielart: "rate", grund: "Prüfstand Vorwärmen", erzeugtVon: "chef" });
    const attV = attrappeMitSkript({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, bitte?", nachMs: 900 }, { aras: "Dann wünsche ich Ihnen einen schönen Tag.", ms: 300 }] });
    adapterSetzen("attrappe", attV);
    const w = await waehlen(Number(e1.id), {});
    ok("gewählt", w.ok && !!w.callId, w.grund);
    if (w.callId) {
      const tok = streamToken(w.callId);
      const url = `${process.env.APP_BASE_URL}/api/fiaon/aras/twiml?anruf=${w.callId}&t=${tok}`;
      const body = { CallSid: `ATTRAPPE-${w.callId}`, CallStatus: "in-progress" };
      const sig = signaturBauen(process.env.TWILIO_AUTH_TOKEN!, url, body);
      const twimlAntwort = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": sig }, body: new URLSearchParams(body).toString() });
      const xml = await twimlAntwort.text();
      ok("TwiML: <Connect><Stream> ohne Query in der Stream-URL, Token als <Parameter>", /<Connect><Stream url="wss?:\/\/[^"?]+">/.test(xml) && /<Parameter name="t" value="/.test(xml), xml.slice(0, 160));
      const vorbereitet = await warten(() => laufendeSitzungen().some((l) => l.callId === w.callId), 3000);
      ok("Sitzung steht schon VOR dem Ton-Strom (Vorwärmen, Prio 3)", vorbereitet);
      const tw = new TwilioAttrappe({ url: wsUrl, anrufId: w.callId, t: tok });
      await tw.start();
      // b) Abschied: Aras sagt „schönen Tag“, beide still → nach ~2,5 s legt Aras selbst auf
      await warten(async () => !!(await anruf(w.callId!))?.nachbereitet_am, 12_000);
      const a = await anruf(w.callId);
      ok("Abschied erkannt → aufgelegt ohne Werkzeug (aras_beendet)", a?.ende_grund === "aras_beendet", String(a?.ende_grund));
      ok("Vorbereiteter Ton kam nach dem Anhängen bei Twilio an", tw.gesendet().media > 0);
    }
    // c) Mailbox-Ansage ohne AMD → auflegen, keine Nachricht
    const e2 = await planEinreihen({ personId: pVorw, nummer: "+491700000021", spielart: "rate", grund: "Prüfstand Mailbox-Ansage", erzeugtVon: "chef" });
    const g3 = await gespraech(Number(e2.id), { schritte: [{ kunde: "Hallo, dies ist die Mailbox von 0170. Bitte hinterlassen Sie eine Nachricht nach dem Signalton.", nachMs: 100 }, { warteMs: 4000 }] });
    await warten(async () => !!(await anruf(g3.callId))?.nachbereitet_am, 8000);
    const a3 = await anruf(g3.callId);
    ok("Mailbox-Ansage erkannt → aufgelegt, Ergebnis mailbox", a3?.ende_grund === "mailbox" && a3?.ergebnis === "mailbox", `${a3?.ende_grund}/${a3?.ergebnis}`);
    // d) Unterbrechen NUR per Lautstärke (kein Transkript): Aras redet, Kunde wird laut, Aras hört auf → clear
    const e3 = await planEinreihen({ personId: pVorw, nummer: "+491700000021", spielart: "rate", grund: "Prüfstand Lautstärke", erzeugtVon: "chef" });
    const g4 = await gespraech(Number(e3.id), { schritte: [{ aras: "Ich erzähle Ihnen jetzt etwas Längeres über Ihren Vertrag und die nächsten Schritte.", ms: 1500 }, { warteMs: 4000 }] });
    await schlafen(500);
    g4.tw.laut(400);
    await schlafen(1800);
    const z4 = laufZahlen(g4.callId);
    ok("Lautstärke des Kunden + Aras still → clear (Unterbrechung ohne Transkript)", (z4?.clears ?? 0) >= 1 || g4.tw.gesendet().clear >= 1, JSON.stringify(z4));
    g4.tw.aufhaengen();
    await warten(async () => !!(await anruf(g4.callId))?.nachbereitet_am, 8000);
  }

  log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
  server.close();
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht === 0 ? 0 : 1);
}

main().catch(async (err) => { console.error("ABBRUCH:", err); process.exit(2); });
