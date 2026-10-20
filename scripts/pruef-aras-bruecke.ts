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
// Die Abschnitte 1–18 spielen Aras zuerst (wie vor dem 20.10.). Das Eröffnungs-Tor — der Angerufene spricht zuerst — prüft Abschnitt 19.
process.env.ARAS_EROEFFNUNG_SOFORT = "1";
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
  // Die Attrappe antwortet ohne menschliche Pausen (der „Kunde“ redet, bevor Aras' Ton gespielt ist). Für die Abschnitte 1–13
  // darum ohne Geduld-Tor; das Tor selbst prüft Abschnitt 14 mit echten Pausen (geduldig, Vorgabe).
  await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand");
  // Stufenplan: die Abschnitte 2–15 prüfen alles andere — dort in Stufe 3 („Voll“). Das Tor selbst prüft Abschnitt 16.
  await einstellungSetzen("aras_stufe", "3", "pruefstand");
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
      // Ein Mensch antwortet, NACHDEM er die Frage gehört hat (die Brücke zählt ein Ja erst ab dann — § 201 StGB).
      { kunde: "Ja, gerne.", nachMs: 450 },
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
    const wzAuf = (await sqlPool`SELECT aufruf_id, ergebnis FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${a.id} AND werkzeug = 'aufnahme_starten' ORDER BY id`) as any[];
    // Ja-Erkennung der Brücke und Werkzeug des Modells kommen fast gleichzeitig — welche Zeile zuerst steht, ist Zufall.
    // Fest ist: die Brücke hat selbst beim Ja gestartet, und es gab genau EINEN Start (der andere Aufruf: „läuft schon“).
    const starts = wzAuf.filter((w) => /zeichne ich jetzt auf/.test(String(w.ergebnis?.vorlesen ?? "")));
    ok("Sechs Werkzeug-Zeilen, alle ok — die Brücke startete selbst beim Ja, genau EIN Start (der andere Aufruf: „läuft schon“)",
      wz.length === 6 && wz.every((w) => w.ok === true) && wzAuf.some((w) => String(w.aufruf_id).startsWith("bruecke_ja_")) && starts.length === 1,
      `${wz.map((w) => `${w.werkzeug}:${w.ok}`).join(",")} · Starts: ${starts.length}`);
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
    ok("Genau EIN Protokoll „Aufnahme-Ja“ (kein Doppelstart)", arten.filter((x) => x === "aras_aufnahme_ja").length === 1, arten.join(","));
    ok("Prüfstatus „offen“ — Prüf-Mara (E-409) prüft das Gespräch mit Transkript", a?.pruefung_status === "offen", String(a?.pruefung_status));
    ok("Ton-Werk: Vorrat bei Twilio nie über 1,5 s (Justin 20.10.: früher höchstens 500 ms — und meist nur ~100 ms)", tw.maxVorratMs <= 1540 && tz.maxOffen <= 16, `${Math.round(tw.maxVorratMs)} ms · ${tz.maxOffen} Marken`);
    const zeilenBus = busZeilen.filter((z) => z.callId === callId);
    ok("Live-Strom: ganze Sätze (keine Fetzen) — Kunde und Aras", zeilenBus.some((z) => z.wer === "kunde" && /Ja, am Apparat/.test(z.text)) && zeilenBus.some((z) => z.wer === "aras" && /\bKI\b/.test(z.text)), zeilenBus.map((z) => `${z.wer}:${z.text.slice(0, 20)}`).join(" | "));
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
      { kunde: "Nein, lieber nicht.", nachMs: 700 }, { werkzeug: "aufnahme_abgelehnt" }, { kunde: "Ich habe gestern überwiesen." }, { werkzeug: "zahlung_gemeldet", eingabe: { am: vor(1) } },
      { warteMs: 150 },
    ] });
    // Der Kunde antwortet erst, wenn er die Frage gehört hat (Ton-Werk: 300 ms Vorrat) — darum etwas länger bis zum Auflegen.
    await warten(() => (sitzungFertig(callId) !== null && (laufZahlen(callId)?.aufnahmeNein ?? false)), 4000);
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
    // Justin 20.10.: Sprechprobe mit Akzent — „Diese nehmen“ übernimmt Stimme UND Akzent
    const hd = await hoerprobeAblegen({ adapter: "attrappe", stimme: "nuri", text: "Grüß Gott, hier ist Aras von FIAON — kurz vorweg: Ich bin eine KI.", bytes: Buffer.from("RIFFpruef"), dauerMs: 900 });
    await sqlPool`UPDATE fiaon_aras_hoerprobe SET dialekt = 'oesterreichisch_leicht' WHERE id = ${hd.id}`;
    ok("Hörprobe trägt den Akzent in der Liste", (await hoerprobenListe()).find((z) => z.id === hd.id)?.dialekt === "oesterreichisch_leicht");
    await hoerprobeWaehlen(hd.id, "pruefstand");
    arasEinstellungenVergessen();
    const e2 = await arasEinstellungenLesen(true);
    ok("„Diese nehmen“ mit Akzent: Stimme nuri + aras_dialekt leicht österreichisch", e2.stimme === "nuri" && e2.regie.dialekt === "oesterreichisch_leicht", `${e2.stimme}/${e2.regie.dialekt}`);
    await einstellungSetzen("aras_dialekt", "hochdeutsch", "pruefstand");
    await hoerprobeWaehlen(h.id, "pruefstand");
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

  titel("13. BÜRO-ATMOSPHÄRE (aras_hintergrund): gemischt, in Pausen in Echtzeit, nach clear ohne Lücke");
  {
    const { mulawZuPcm16, pcm16ZuMulaw, pegel, stille } = await import("../server/lib/fiaon-aras-adapter");
    const { atmoMischen, ATMO_PEGEL_DBFS } = await import("../server/lib/fiaon-aras-atmo");
    const { mitAtmo } = await import("../server/lib/fiaon-aras-hoerprobe");
    const rms = (x: Int16Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / Math.max(1, x.length));
    const dbfs = (x: Int16Array) => 20 * Math.log10(Math.max(1e-9, rms(x) / 32768));
    // a) Pegel nach µ-law: reine Atmo (8 s) liegt bei ihrer festen Lautheit (±3 dB), auch nach Kodieren/Dekodieren
    const atmoLeise = mulawZuPcm16(pcm16ZuMulaw(atmoMischen(null, 64000, "buero_leise", 0).pcm));
    ok("Atmo „Büro leise“ nach µ-law: Lautheit wie festgelegt (±3 dB)", Math.abs(dbfs(atmoLeise) - ATMO_PEGEL_DBFS.buero_leise) < 3, `${dbfs(atmoLeise).toFixed(1)} dBFS`);
    // Justin 20.10. (abends): „Büro leiser“ — der damals gehörte Abstand zur Rede (25 / 19 dB) bleibt, seit das Ton-Werk die Rede
    // auf −16 dBFS regelt (20.10. nachmittags): Atmo −41 / −35 dBFS. Auch „Büro“ hält seine Lautheit nach µ-law.
    const atmoBuero = mulawZuPcm16(pcm16ZuMulaw(atmoMischen(null, 64000, "buero", 0).pcm));
    ok("Atmo „Büro“ nach µ-law: Lautheit wie festgelegt (±3 dB) — Abstand zur geregelten Rede wie freigegeben (−41 / −35 dBFS)", Math.abs(dbfs(atmoBuero) - ATMO_PEGEL_DBFS.buero) < 3 && ATMO_PEGEL_DBFS.buero_leise === -41 && ATMO_PEGEL_DBFS.buero === -35, `${dbfs(atmoBuero).toFixed(1)} dBFS`);
    // b) Reine Atmo gilt NIE als „Aras redet“: das Ton-Werk erkennt Rede am Rahmen VOR der Atmo
    {
      const { Tonwerk } = await import("../server/lib/fiaon-aras-ton");
      let T = 0; const w = new Tonwerk({ senden: () => {}, marke: () => {}, atmo: "buero", jetzt: () => T });
      for (; T < 2000; T += 10) { if (T % 100 === 0) w.einspeisen(new Int16Array(800)); w.takt(); }
      ok("Reine Atmo zählt nie als Rede (Erkennung am Rahmen vor der Atmo) — auch nicht bei „Büro“", w.statistik().rede.rahmen === 0 && w.statistik().fuellRahmen > 0, JSON.stringify(w.statistik().rede));
      void pegel;
    }
    // c) Laute Rede + Atmo: kein Übersteuern (weiche Grenze), Rede bleibt erhalten
    const laut = new Int16Array(800).map((_, i) => Math.round(31000 * Math.sin(i / 3)));
    const gemischt = atmoMischen(laut, 800, "buero", 99).pcm;
    ok("Laute Rede + Atmo: kein Übersteuern, Rede bleibt (Korrelation hoch)", gemischt.every((v) => v <= 32767 && v >= -32767) && Math.abs(rms(gemischt) - rms(laut)) / rms(laut) < 0.05);
    // d) Sprechprobe mit Atmo: halbe Sekunde Raum davor/danach, Rede in der Mitte unverändert hörbar
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(40), Buffer.alloc(1600)]);
    wav.writeUInt16LE(1, 20); wav.writeUInt32LE(8000, 24); wav.writeUInt16LE(16, 34); wav.write("WAVE", 8); wav.write("data", 36);
    const mit = mitAtmo(wav, "buero_leise");
    ok("Sprechprobe mit Atmo: WAV, 0,5 s Raum davor und danach", mit.length === 44 + 1600 + 2 * 4000 * 2 && mit.toString("ascii", 0, 4) === "RIFF");

    // e) Im Gespräch: Atmo an → reine Atmo-Stücke in Pausen; nach clear sofort weiter (keine Lücke)
    await einstellungSetzen("aras_hintergrund", "buero_leise", "pruefstand");
    const pAtmo = await person(33); await antrag(pAtmo, 33, { payment_status: "paid" });
    const e = await planEinreihen({ personId: pAtmo, nummer: "+491700000033", spielart: "rate", grund: "Prüfstand Atmo", erzeugtVon: "chef" });
    const g = await gespraech(Number(e.id), { schritte: [{ aras: "Ich erzähle Ihnen jetzt etwas Längeres über Ihren Vertrag und die nächsten Schritte.", ms: 1500 }, { warteMs: 4000 }] });
    await schlafen(700);
    const z0 = laufZahlen(g.callId);
    ok("Atmo im Gespräch an (buero_leise)", z0?.atmo === "buero_leise", String(z0?.atmo));
    g.tw.laut(400);
    await warten(() => (laufZahlen(g.callId)?.clears ?? 0) >= 1 || g.tw.gesendet().clear >= 1, 3000);
    const vorClear = g.tw.gesendet();
    const mediaNachClear0 = vorClear.media;
    await schlafen(150);
    ok("Nach clear (Unterbrechen): binnen 150 ms wieder Ton bei Twilio — Atmo ohne Lücke", g.tw.gesendet().clear >= 1 && g.tw.gesendet().media > mediaNachClear0, `${mediaNachClear0} → ${g.tw.gesendet().media}`);
    await schlafen(1500);
    const z1 = laufZahlen(g.callId);
    ok("In der Pause: Atmo in Echtzeit, der Vorrat bei Twilio bleibt beim Vorlauf (~300 ms)", (z1?.atmoStuecke ?? 0) >= 3 && (z1?.vorratMs ?? 0) <= 360 && g.tw.maxVorratMs <= 1540, JSON.stringify({ fuell: z1?.atmoStuecke, vorratMs: z1?.vorratMs, max: Math.round(g.tw.maxVorratMs) }));
    g.tw.aufhaengen();
    await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 8000);
    ok("Nach dem Auflegen: kein Atmo-Takt mehr (Sitzung weg)", laufZahlen(g.callId) === null);
    await einstellungSetzen("aras_hintergrund", "aus", "pruefstand");
    // f) Rot-Probe: ohne Atmo ist der Vorrat in der Pause reine Stille (µ-law 0xFF) — nie ein Geräusch
    const e2 = await planEinreihen({ personId: pAtmo, nummer: "+491700000033", spielart: "zusage", grund: "Prüfstand ohne Atmo", erzeugtVon: "chef" });
    const g2 = await gespraech(Number(e2.id), { schritte: [{ warteMs: 2500 }] });
    await schlafen(1200);
    const stillRahmen = g2.tw.gespielt();
    ok("Rot-Probe: ohne Atmo ist der Vorrat in der Pause reine Stille", laufZahlen(g2.callId)?.atmo === null && stillRahmen.length > 0 && stillRahmen.every((r) => r.pcm.every((v) => v === 0)), `${stillRahmen.length} Rahmen`);
    g2.tw.aufhaengen();
    await warten(async () => !!(await anruf(g2.callId))?.nachbereitet_am, 8000);
    void stille;
  }

  titel("14. MENSCHLICH (Justins Tests 20.10.): Wiederholungs-Wache, Geduld-Tor, Abschied-Wache, Zögern bei der Aufnahme");
  {
    const { WIEDERHOLUNG_HINWEIS } = await import("../shared/fiaon-aras-regeln");
    const { ABSCHIED_EINFORDERN, AUFNAHME_ZOEGERN_SATZ } = await import("../shared/fiaon-aras-prompt");
    await einstellungSetzen("aras_hintergrund", "aus", "pruefstand");
    await einstellungSetzen("aras_zuhoeren", "geduldig", "pruefstand");
    let nr = 40;
    const neuerAnruf = async (skript: Parameters<typeof attrappeMitSkript>[0]) => {
      nr += 1;
      const pid = await person(nr); await antrag(pid, nr, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${nr}`, spielart: "zusage", grund: `Prüfstand menschlich ${nr}`, erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      return gespraech(Number(e.id), skript);
    };
    const fertig = async (g: { tw: InstanceType<typeof TwilioAttrappe>; callId: number }, aufhaengen = true) => {
      if (aufhaengen) g.tw.aufhaengen();
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 12_000);
    };

    // a) Wiederholungs-Wache: dreimal „Um was geht's?“ — beim zweiten wortgleichen Satz bekommt die Stimme sofort den Hinweis
    {
      const satz = "Es geht um Ihren Antrag für FIAON Pro — Sie hatten uns per WhatsApp mit Ja geantwortet, dass ich Sie anrufen darf. Haben Sie kurz zwei Minuten?";
      const g = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, bitte, um was geht's?", nachMs: 200 }, { warteMs: 900 },
        { aras: satz, ms: 300 }, { kunde: "Ja, aber um was geht's dabei?", nachMs: 200 }, { warteMs: 900 },
        { aras: `ähm ${satz}`, ms: 300 }, { warteMs: 1200 },
        { aras: "Anders gesagt: Ihnen fehlt nur noch die erste Zahlung, dann geht es Richtung eigene Karte. Was genau möchten Sie wissen?", ms: 300 }, { warteMs: 1500 },
      ] });
      await schlafen(5200);
      const hinweise = g.att.spur.eingeschoben.filter((x) => x.text === WIEDERHOLUNG_HINWEIS);
      ok("Wiederholung (Anruf 5): genau EIN versteckter Hinweis — still (Anruf 16: eine Anweisung bräche die laufende Rede ab)", hinweise.length === 1 && hinweise[0].art === "still" && laufZahlen(g.callId)?.wiederholungen === 1, JSON.stringify(g.att.spur.eingeschoben.map((x) => `${x.art}:${x.text.slice(0, 30)}`)));
      ok("Rot-Probe: der erste Satz und der neue, konkrete Satz lösen KEINEN Hinweis aus", hinweise.length === 1);
      await fertig(g);
    }

    // b) Geduld-Tor: Aras setzt in die Denkpause an („Also …“), der Kunde redet weiter → der Kunde hört den Ansatz NIE
    {
      const g = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { beiKundenStimme: "Ja, also ich wollte noch sagen" }, { nachKundeStillMs: 150 }, { aras: "Also …", ms: 300 }, { warteMs: 4000 }] });
      await schlafen(700);
      g.tw.laut(800);
      const zu = await warten(() => !!laufZahlen(g.callId)?.halten || (laufZahlen(g.callId)?.verworfen ?? 0) > 0, 4000);
      const n0 = g.tw.lautAngekommen().length;
      g.tw.laut(700); // der Kunde redet weiter
      await schlafen(1500);
      const z = laufZahlen(g.callId);
      ok("Geduld-Tor: Aras' Ansatz wartet, solange der Kunde gerade noch sprach", zu, JSON.stringify(z));
      ok("Kunde redet weiter → Ansatz verworfen, bei Twilio kam KEIN Rede-Rahmen davon an", (z?.verworfen ?? 0) >= 1 && g.tw.lautAngekommen().length === n0, `${JSON.stringify(z)} · ${n0} → ${g.tw.lautAngekommen().length}`);
      await fertig(g);
    }

    // c) Geduld-Tor: der Kunde ist fertig → Aras' Antwort kommt erst nach ~700 ms Ruhe (geduldig), dann vollständig
    {
      const g = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { beiKundenStimme: "Ja, ich höre." }, { nachKundeStillMs: 150 }, { aras: "Super, dann erzähl ich Ihnen kurz, worum es geht.", ms: 600 }, { warteMs: 3000 }] });
      await schlafen(700);
      const n0 = g.tw.lautAngekommen().length;
      g.tw.laut(800);
      await schlafen(2600);
      const ende = g.tw.lautEnde();
      const erste = g.tw.lautAngekommen().slice(n0).find((t) => t > ende) ?? 0;
      const z = laufZahlen(g.callId);
      ok("Geduldig: Aras' Antwort ist frühestens ~700 ms nach dem letzten Wort des Kunden zu hören", erste > 0 && erste - ende >= 600 && erste - ende <= 1500 && (z?.gehalten ?? 0) >= 1, `${erste ? erste - ende : "—"} ms · ${JSON.stringify(z)}`);
      ok("Freigegeben, nicht verworfen — und der Rückstand ist danach wieder aufgeholt", (z?.verworfen ?? 0) === 0 && (z?.pufferBytes ?? 1) < 800, JSON.stringify(z));
      await fertig(g);
    }

    // d) Rot-Probe flott: kein Tor — Aras' Antwort kommt sofort (≈ 150 ms nach dem Kunden)
    {
      await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand");
      const g = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { beiKundenStimme: "Ja, ich höre." }, { nachKundeStillMs: 150 }, { aras: "Super, dann erzähl ich Ihnen kurz, worum es geht.", ms: 600 }, { warteMs: 3000 }] });
      await schlafen(700);
      const n0 = g.tw.lautAngekommen().length;
      g.tw.laut(800);
      await schlafen(2000);
      const ende = g.tw.lautEnde();
      const erste = g.tw.lautAngekommen().slice(n0).find((t) => t > ende) ?? 0;
      ok("Rot-Probe flott: kein Zurückhalten — Antwort nach < 450 ms", erste > 0 && erste - ende < 450 && (laufZahlen(g.callId)?.gehalten ?? 1) === 0, `${erste ? erste - ende : "—"} ms`);
      await fertig(g);
      await einstellungSetzen("aras_zuhoeren", "geduldig", "pruefstand");
    }

    // d2) Rot-Probe Lärm: laut, aber ohne ein Wort (Straße, Fernseher) → kein Zurückhalten, Aras bleibt flott
    {
      const g = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { nachKundeStillMs: 150 }, { aras: "Super, dann erzähl ich Ihnen kurz, worum es geht.", ms: 600 }, { warteMs: 3000 }] });
      await schlafen(700);
      const n0 = g.tw.lautAngekommen().length;
      g.tw.laut(800);
      await schlafen(2000);
      const ende = g.tw.lautEnde();
      const erste = g.tw.lautAngekommen().slice(n0).find((t) => t > ende) ?? 0;
      ok("Rot-Probe Lärm ohne Worte: das Tor bleibt offen (nur Lautstärke ist keine Rede)", erste > 0 && erste - ende < 450 && (laufZahlen(g.callId)?.gehalten ?? 1) === 0, `${erste ? erste - ende : "—"} ms`);
      await fertig(g);
    }

    // e) Geduld-Tor nach Aras' eigener Frage: „Bin ich richtig …?“ — 600 ms später „Also …“ → wartet; antwortet der Kunde, fällt es weg
    {
      const g = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { aras: "Bin ich richtig bei Herrn Prüfkunde?", ms: 400 }, { warteMs: 600 }, { aras: "Also …", ms: 300 }, { warteMs: 4000 }] });
      const zu = await warten(() => !!laufZahlen(g.callId)?.halten, 4000);
      const n0 = g.tw.lautAngekommen().length;
      g.tw.laut(600); // er antwortet
      await schlafen(1400);
      const z = laufZahlen(g.callId);
      ok("Nach Aras' Frage: der Nachschub wartet auf die Antwort; antwortet er, hört er das „Also …“ nie", zu && (z?.verworfen ?? 0) >= 1 && g.tw.lautAngekommen().length === n0, `${JSON.stringify(z)} · ${n0} → ${g.tw.lautAngekommen().length}`);
      await fertig(g);
      // e2) Schweigt er nach der Frage, spielt Aras nach spätestens ~2 s weiter (nichts geht verloren)
      const g2 = await neuerAnruf({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { aras: "Bin ich richtig bei Herrn Prüfkunde?", ms: 400 }, { warteMs: 600 }, { aras: "Hallo, sind Sie noch dran?", ms: 400 }, { warteMs: 4000 }] });
      const zu2 = await warten(() => !!laufZahlen(g2.callId)?.halten, 4000);
      const m0 = g2.tw.lautAngekommen().length;
      await warten(() => g2.tw.lautAngekommen().length > m0, 3500);
      ok("Rot-Probe: schweigt er, kommt der Nachschub nach der Wartezeit doch (freigegeben, nicht verworfen)", zu2 && g2.tw.lautAngekommen().length > m0 && (laufZahlen(g2.callId)?.verworfen ?? 1) === 0, JSON.stringify(laufZahlen(g2.callId)));
      await fertig(g2);
    }

    // f) Abschied-Wache (Anruf 6: „Sehr gut, ähm, Moment.“ → aufgelegt): anruf_beenden ohne Abschied → erst Abschied, dann auflegen
    {
      const g = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, klar.", nachMs: 150 }, { warteMs: 900 }, { aras: "Sehr gut, Moment.", ms: 300 }, { warteMs: 300 },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Prüfstand Abschied" } }, { warteMs: 9000 },
      ] });
      await warten(() => g.att.spur.werkzeuge.some((w) => w.name === "anruf_beenden"), 6000);
      await schlafen(500);
      const noch = laufendeSitzungen().some((x) => x.callId === g.callId);
      const eing = g.att.spur.eingeschoben.find((x) => x.text === ABSCHIED_EINFORDERN);
      ok("anruf_beenden ohne Abschied: NICHT aufgelegt, die Stimme soll sich erst verabschieden (Anweisung)", noch && !!eing && eing.art === "anweisung", JSON.stringify(laufZahlen(g.callId)));
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 9000);
      const a = await anruf(g.callId);
      const punkte = ((a?.pruefung?.punkte ?? []) as { regel: string }[]).map((p) => p.regel);
      ok("Erst nach dem Abschied + kurzer Ruhe aufgelegt (aras_beendet), kein Befund „abschied_fehlt“", a?.ende_grund === "aras_beendet" && !punkte.includes("abschied_fehlt"), `${a?.ende_grund} · ${punkte.join(",")}`);
      // f2) Rot-Probe: die Stimme ignoriert die Einforderung → nach der Frist doch aufgelegt, Befund „abschied_fehlt“
      process.env.ARAS_ABSCHIED_FRIST_MS = "3000";
      const g2 = await neuerAnruf({ abschiedIgnorieren: true, schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, klar.", nachMs: 150 }, { warteMs: 900 }, { aras: "Sehr gut, Moment.", ms: 300 }, { warteMs: 300 },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Prüfstand ohne Abschied" } }, { warteMs: 9000 },
      ] });
      await warten(async () => !!(await anruf(g2.callId))?.nachbereitet_am, 12_000);
      const a2 = await anruf(g2.callId);
      const p2 = ((a2?.pruefung?.punkte ?? []) as { regel: string }[]).map((p) => p.regel);
      ok("Rot-Probe: ohne Abschied → nach der Frist aufgelegt, Prüf-Befund „abschied_fehlt“ (weich)", a2?.ende_grund === "aras_beendet" && p2.includes("abschied_fehlt"), `${a2?.ende_grund} · ${p2.join(",")}`);
      delete process.env.ARAS_ABSCHIED_FRIST_MS;
    }

    // f3) Begrüßung nachschieben (GPT-Live spricht nicht garantiert zuerst): derselbe Text wie am Anfang — mit dem kurzen
    //     Lachen nach dem KI-Hinweis (Justin 20.10. abends) und der Frage mit Anrede („Herrn …“, nie der nackte Nachname)
    {
      const { LACHEN_NACH_KI } = await import("../shared/fiaon-aras-prompt");
      const g = await neuerAnruf({ schritte: [{ warteMs: 6000 }] });
      await warten(() => g.att.spur.eingeschoben.some((x) => /hat sich gerade gemeldet/.test(x.text)), 6000);
      const gruss = g.att.spur.eingeschoben.find((x) => /hat sich gerade gemeldet/.test(x.text));
      ok("Begrüßung nachgeschoben (als „vorlesen“ — bringt eine stumme Sitzung sicher zum Sprechen): Name → Kreditkarte → KI-Hinweis → kurzes Lachen → „Haben Sie einen kurzen Moment?“",
        !!gruss && gruss.art === "vorlesen" && /, Herr Prüfkunde\d+!/.test(gruss.text) && /Kreditkarten/.test(gruss.text) && gruss.text.indexOf(LACHEN_NACH_KI) > gruss.text.indexOf("KI") && gruss.text.indexOf("Haben Sie einen kurzen Moment?") > gruss.text.indexOf(LACHEN_NACH_KI), gruss?.text.slice(0, 260) ?? "—");
      await fertig(g);
      await einstellungSetzen("aras_lachen", "aus", "pruefstand");
      const g2 = await neuerAnruf({ schritte: [{ warteMs: 6000 }] });
      await warten(() => g2.att.spur.eingeschoben.some((x) => /hat sich gerade gemeldet/.test(x.text)), 6000);
      const gruss2 = g2.att.spur.eingeschoben.find((x) => /hat sich gerade gemeldet/.test(x.text));
      ok("Rot-Probe: aras_lachen = aus → die nachgeschobene Begrüßung hat kein Lachen", !!gruss2 && !gruss2.text.includes(LACHEN_NACH_KI), gruss2?.text.slice(0, 160) ?? "—");
      await fertig(g2);
      await einstellungSetzen("aras_lachen", "an", "pruefstand");
    }

    // g) Zögern bei der Aufnahme (Anruf 6: „hm“): kein Nein, kein Drängeln; nach der ruhigen Nachfrage zählt sein Ja
    {
      const g = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 100 }, { warteMs: 500 },
        { aras: "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", ms: 400 }, { warteMs: 1200 },
        { kunde: "Hm.", nachMs: 100 }, { warteMs: 900 },
        { aras: AUFNAHME_ZOEGERN_SATZ, ms: 500 }, { warteMs: 1200 },
        { kunde: "Ja, passt.", nachMs: 100 }, { warteMs: 2500 },
      ] });
      await warten(async () => (await anruf(g.callId))?.aufnahme_nein_am != null || !!laufZahlen(g.callId)?.aufnahmeJa, 6500);
      const z = laufZahlen(g.callId);
      const a = await anruf(g.callId);
      ok("„Hm.“ ist kein Nein — nach der ruhigen Nachfrage startet die Aufnahme mit seinem Ja", !!z?.aufnahmeJa && !z?.aufnahmeNein && a?.aufnahme_nein_am == null, JSON.stringify({ z, nein: a?.aufnahme_nein_am }));
      await fertig(g);
      // g2) Rot-Probe (§ 201 StGB): sein „Ja“ fällt, BEVOR er die Frage hört (sie wartet noch im Geduld-Tor) → keine Aufnahme
      const g2 = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, worum geht's?", nachMs: 100 }, { warteMs: 400 },
        { aras: "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", ms: 400 },
        { kunde: "Ja, genau, und noch was:", nachMs: 40 }, { werkzeug: "aufnahme_starten" }, { warteMs: 2500 },
      ] });
      await warten(() => g2.att.spur.werkzeuge.some((w) => w.name === "aufnahme_starten"), 5000);
      await schlafen(1200);
      const w = g2.att.spur.werkzeuge.find((x) => x.name === "aufnahme_starten");
      ok("Rot-Probe: ein Ja, bevor die Frage zu hören war, startet KEINE Aufnahme", !laufZahlen(g2.callId)?.aufnahmeJa && w?.ergebnis.ok === false && w?.ergebnis.fehler === "kein_ja", JSON.stringify({ z: laufZahlen(g2.callId), w: w?.ergebnis }));
      await fertig(g2);
      // g3) Wienerisch umschrieben (echter GPT-Live-Lauf 20.10.: „Darf ich dafür kurz mitschneiden …?“) — auch das ist die Aufnahme-Frage
      const g3 = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 100 }, { warteMs: 500 },
        { aras: "Darf ich dafür kurz mitschneiden, damit es ordentlich festgehalten is?", ms: 400 }, { warteMs: 1200 },
        { kunde: "Ja, passt.", nachMs: 100 }, { warteMs: 2500 },
      ] });
      await warten(() => !!laufZahlen(g3.callId)?.aufnahmeJa, 6500);
      ok("Wienerisch umschrieben („mitschneiden“) ist auch die Aufnahme-Frage — sein Ja startet die Aufnahme", !!laufZahlen(g3.callId)?.aufnahmeJa, JSON.stringify(laufZahlen(g3.callId)));
      await fertig(g3);
      // g4) Rot-Probe: ein Ja auf eine ANDERE Frage („Ham's grad a bissl Zeit, gell?“) startet keine Aufnahme
      const g4 = await neuerAnruf({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 100 }, { warteMs: 500 },
        { aras: "Ham's grad a bissl Zeit, gell?", ms: 400 }, { warteMs: 1200 },
        { kunde: "Ja, passt.", nachMs: 100 }, { warteMs: 2500 },
      ] });
      await schlafen(4500);
      ok("Rot-Probe: ein Ja auf eine andere Frage startet KEINE Aufnahme", !laufZahlen(g4.callId)?.aufnahmeJa, JSON.stringify(laufZahlen(g4.callId)));
      await fertig(g4);
    }
  }

  titel("15. AKTE (Scheibe 2): Aras anrufen lassen, Offenes abgeben, Sperre je Kunde, Notiz, Nachricht, noch ein Versuch");
  {
    // Die Attrappe antwortet ohne menschliche Pausen — hier wieder ohne Geduld-Tor (das prüft Abschnitt 14).
    await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand");
    const { arasAkteLage, arasAuftragGeben, arasAuftragZuruecknehmen, arasFuerPersonSchalten, arasNotizSetzen, arasAnrufUrteil, auftragZeit } = await import("../server/lib/fiaon-aras-akte");
    const { briefingBauen } = await import("../server/lib/fiaon-aras-briefing");
    const { anweisungBauen } = await import("../shared/fiaon-aras-prompt");
    const { berlinTeile } = await import("../shared/fiaon-aras");
    const neuerAgent = async (n: number, anrede: string, vor: string, nach: string, rolle = "agent") => Number(((await sqlPool`
      INSERT INTO fiaon_agents (name, email, active, first_name, last_name, anrede, rolle, is_test_account)
      VALUES (${`${vor} ${nach}`}, ${`pruef-e408-agent${n}@example.invalid`}, TRUE, ${vor}, ${nach}, ${anrede}, ${rolle}, TRUE) RETURNING id`) as any[])[0].id);
    const betreuer = await neuerAgent(1, "frau", "Mia", "Prüfer");
    const kollege = await neuerAgent(2, "herr", "Tom", "Andere");
    // P20: Kunde (bezahlt) mit offener Rate — Vertragssache
    const p20 = await person(30); const r20 = await antrag(p20, 30, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${r20}, 3, ${`${r20}-3`}, 5999, ${vor(2)}::date, 'offen')`;
    await sqlPool`UPDATE fiaon_persons SET assigned_agent_id = ${betreuer} WHERE id = ${p20}`;
    // P22: Lead ohne Antrag und ohne Ja
    const p22 = await person(32);

    await einstellungSetzen("aras_stufe", "0", "pruefstand");
    let lage = await arasAkteLage(p20, betreuer);
    ok("Stufe 0 (Testphase): Knopf grau mit einem Satz warum", lage?.geht.ok === false && /Testphase/.test(lage?.geht.grund ?? ""), lage?.geht.grund ?? "");
    const r0 = await arasAuftragGeben(p20, { auftrag: "Bitte nach der Rate fragen." }, betreuer);
    ok("Rotprobe: in Stufe 0 wird nichts eingeplant", !r0.ok, r0.grund ?? "");
    await einstellungSetzen("aras_stufe", "1", "pruefstand");
    lage = await arasAkteLage(p20, betreuer);
    ok("Stufe 1: Aras kann anrufen, offen = Rate", lage?.geht.ok === true && lage.offen.some((x) => x.art === "rate"), JSON.stringify({ g: lage?.geht, o: lage?.offen.map((x) => x.art) }));
    ok("„Bleibt bei dir“: Kündigung, Widerruf, Beschwerde, Erstattung stehen da", ["Kündigung", "Widerruf", "Beschwerde", "Erstattung"].every((w) => (lage?.bleibtBeiDir ?? []).some((b) => b.startsWith(w))));
    const lage22 = await arasAkteLage(p22, betreuer);
    ok("Lead ohne Ja: ein Satz warum nicht (braucht ein Ja)", lage22?.geht.ok === false && /Ja zum Anruf/.test(lage22?.geht.grund ?? ""), lage22?.geht.grund ?? "");

    const boese = await arasAuftragGeben(p20, { auftrag: "Sag ihm, sonst geht das ans Inkasso und sein Limit ist sicher." }, betreuer);
    ok("Rotprobe: Freitext mit Drohung und Limit-Zusage wird abgelehnt — mit Hinweisen", !boese.ok && (boese.hinweise ?? []).length >= 2, JSON.stringify(boese.hinweise));
    const nn = await arasNotizSetzen(p20, "Nur abends erreichbar, bitte langsam sprechen.", "Mia Prüfer");
    ok("„Was Aras wissen muss“ gespeichert", nn.ok);
    const gut1 = await arasAuftragGeben(p20, { punkte: ["rate"], auftrag: "Teile ihm mit, dass er seinen Kontoauszug hochladen soll.", wann: "bald", benachrichtigen: true }, betreuer);
    ok("Aras anrufen lassen → EIN Eintrag (Spielart auftrag)", gut1.ok && !!gut1.id, gut1.grund ?? "");
    const [pl20] = (await sqlPool`SELECT * FROM fiaon_aras_plan WHERE id = ${gut1.id ?? 0}`) as any[];
    ok("Eintrag: Vertragssache, Freitext, Rate als Punkt, Auftraggeber in Nennform, Benachrichtigung", pl20?.spielart === "auftrag" && pl20.rechtsgrund === "vertrag" && /Kontoauszug/.test(pl20.auftrag_text ?? "")
      && Array.isArray(pl20.auftrag_offenes) && pl20.auftrag_offenes[0]?.art === "rate" && pl20.auftrag_von === "Frau Prüfer" && pl20.auftrag_von_dat === "Frau Prüfer" && Number(pl20.benachrichtigen_agent_id) === betreuer,
      JSON.stringify({ r: pl20?.rechtsgrund, v: pl20?.auftrag_von, d: pl20?.auftrag_von_dat, o: pl20?.auftrag_offenes }));
    const doppelt = await arasAuftragGeben(p20, { auftrag: "Noch etwas." }, betreuer);
    ok("Zweiter Auftrag, solange einer wartet: abgelehnt mit Satz", !doppelt.ok && /schon einen Anruf geplant/.test(doppelt.grund ?? ""), doppelt.grund ?? "");
    const fremd = await arasAuftragZuruecknehmen(p20, Number(gut1.id), kollege, false);
    ok("Rotprobe: ein Kollege (ohne Leitung) nimmt fremde Aufträge nicht zurück", !fremd.ok);
    const b = await briefingBauen({ personId: p20, nummer: "+491700000030", spielart: "auftrag", planId: Number(gut1.id) });
    ok("Briefing: Auftrag, Rate-Satz und Notiz sind drin", /Kontoauszug/.test(b.auftrag?.text ?? "") && (b.offenes ?? []).some((x) => /Rate 3/.test(x)) && /abends/.test(b.arasNotiz ?? ""), JSON.stringify({ a: b.auftrag, o: b.offenes, n: b.arasNotiz }));
    const anw = anweisungBauen({ spielart: "auftrag", briefing: b, einstellungen: await arasEinstellungenLesen(true), hausanweisung: null });
    ok("Anweisung: „im Auftrag von Frau Prüfer“, AUFTRAG und offene Punkte", /im Auftrag von Frau Prüfer/.test(anw.text) && /AUFTRAG von Frau Prüfer/.test(anw.text) && /Offen bei ihm/.test(anw.text), anw.text.slice(0, 120));

    // Gespräch: erreicht, Zusage → Nachricht an Mia im Office
    const g = await gespraech(Number(gut1.id), { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 },
      { kunde: "Ja, am Apparat." },
      { aras: "Ich rufe im Auftrag von Frau Prüfer an — es geht um Ihre dritte Rate.", ms: 300 },
      { kunde: "Ich überweise morgen." },
      { werkzeug: "zahlungszusage_merken", eingabe: { datum: morgen } },
      { aras: "Prima, dann einen schönen Tag!", ms: 200 },
      { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_zahlt_am", notiz: "Zahlt morgen." } },
    ] });
    await Promise.race([sitzungFertig(g.callId) ?? Promise.resolve(), schlafen(15000)]);
    await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 10_000);
    const nachricht = await warten(async () => ((await sqlPool`SELECT 1 FROM fiaon_team_nachrichten WHERE agent_id = ${betreuer} AND text LIKE 'Aras hat%'`) as any[]).length > 0, 6000);
    ok("Nach dem Gespräch: Nachricht an Frau Prüfer im Office („Aras hat … angerufen“)", nachricht);
    lage = await arasAkteLage(p20, betreuer);
    ok("Verlauf in der Akte: der Anruf mit Ergebnis", (lage?.verlauf ?? []).some((v) => v.callId === g.callId && v.ergebnis === "erreicht_zahlt_am"), JSON.stringify(lage?.verlauf.map((v) => [v.callId, v.ergebnis])));
    const az = (lage?.verlauf ?? []).find((v) => v.callId === g.callId);
    ok("Ohne Aufnahme-Ja: kein Transkript in der Akte", az?.transkript === null);
    const u = await arasAnrufUrteil(p20, Number(az?.arasAnrufId ?? 0), "hoch", null, "Mia Prüfer");
    const [uu] = (await sqlPool`SELECT team_urteil FROM fiaon_aras_anruf WHERE id = ${Number(az?.arasAnrufId ?? 0)}`) as any[];
    ok("Daumen des Betreuers gespeichert", u.ok && uu?.team_urteil === "hoch");

    // Nicht erreicht (Mailbox) → morgen noch ein Versuch, gleicher Auftrag
    const p21 = await person(31); const r21 = await antrag(p21, 31, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${r21}, 2, ${`${r21}-2`}, 5999, ${vor(1)}::date, 'offen')`;
    const gab = await arasAuftragGeben(p21, { punkte: ["rate"], abgeben: true }, betreuer);
    ok("Offenes an Aras abgeben → EIN Eintrag", gab.ok, gab.grund ?? "");
    const g2 = await gespraech(Number(gab.id), { schritte: [{ kunde: "Hallo, dies ist die Mailbox von 0170. Bitte hinterlassen Sie eine Nachricht nach dem Signalton.", nachMs: 100 }, { warteMs: 4000 }] });
    await warten(async () => !!(await anruf(g2.callId))?.nachbereitet_am, 10_000);
    const neu = await warten(async () => ((await sqlPool`SELECT 1 FROM fiaon_aras_plan WHERE person_id = ${p21} AND spielart = 'auftrag' AND status = 'wartet' AND versuch_nr = 2`) as any[]).length > 0, 6000);
    ok("Mailbox → morgen noch ein Versuch (Versuch 2, gleicher Auftrag)", neu);
    const [v2z] = (await sqlPool`SELECT frueh_ab, auftrag_offenes FROM fiaon_aras_plan WHERE person_id = ${p21} AND status = 'wartet' AND versuch_nr = 2`) as any[];
    ok("Versuch 2 frühestens morgen, Punkte übernommen", !!v2z && new Date(v2z.frueh_ab).getTime() > Date.now() + 6 * 3600_000 && v2z.auftrag_offenes?.[0]?.art === "rate");

    // Aras für diesen Kunden aus → Wartendes gesperrt, neue Aufträge abgelehnt, Takt wählt ihn nicht
    await arasFuerPersonSchalten(p21, true, "Kunde möchte lieber mit Frau Prüfer sprechen", betreuer, "Mia Prüfer");
    const [gesp] = (await sqlPool`SELECT COUNT(*) FILTER (WHERE status = 'wartet')::int AS w, COUNT(*) FILTER (WHERE status = 'gesperrt')::int AS g FROM fiaon_aras_plan WHERE person_id = ${p21}`) as any[];
    ok("Aras aus: Wartendes sofort gesperrt", Number(gesp?.w) === 0 && Number(gesp?.g) >= 1, JSON.stringify(gesp));
    const r21b = await planEinreihen({ personId: p21, nummer: "+491700000031", spielart: "rate", grund: "Prüfstand", erzeugtVon: "chef" });
    ok("Rotprobe: auch der Takt reiht ihn nicht mehr ein", !r21b.ok && /für diesen Kunden aus/.test(r21b.grund ?? ""), r21b.grund ?? "");
    const lage21 = await arasAkteLage(p21, betreuer);
    ok("Akte zeigt den Schalter und den Grund", lage21?.sperre.aus === true && /für diesen Kunden aus/.test(lage21?.geht.grund ?? ""));
    await arasFuerPersonSchalten(p21, false, null, betreuer, "Mia Prüfer");
    ok("Wieder an", (await arasAkteLage(p21, betreuer))?.sperre.aus === false);

    // Zeitpunkt
    const z1 = auftragZeit("morgen", null);
    ok("„Morgen“ = 9 Uhr Berlin am nächsten Tag", berlinTeile(z1.fruehAb).hhmm === "09:00" && z1.fruehAb.getTime() > Date.now(), berlinTeile(z1.fruehAb).hhmm);
    const z2 = auftragZeit("heute_ab", "23:59");
    ok("„Heute ab 23:59“ = heute 23:59 (oder jetzt, wenn schon vorbei)", berlinTeile(z2.fruehAb).hhmm === "23:59" || z2.fruehAb.getTime() <= Date.now() + 1000);
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("16. STUFENPLAN (hart) — das Tor, bevor Justin echte Kunden einschaltet");
  {
    const { stufenGrenzen, STUFEN, berlinTeile } = await import("../shared/fiaon-aras");
    adapterSetzen("attrappe", attrappeMitSkript({ schritte: [] }));
    await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand");
    await einstellungSetzen("aras_an", "an", "pruefstand");
    await einstellungSetzen("aras_parallel", "3", "pruefstand");
    await einstellungSetzen("aras_tag_euro", "60", "pruefstand");
    await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", zuruf: "an", stufe_a: "an", rate: "an", zusage: "an", auftrag: "an", probe: "an" }), "pruefstand");
    // Saubere Reihe: nur die Einträge dieses Abschnitts warten — und ein „neuer Tag“: die Kundenanrufe der Abschnitte 4–15
    // zählen sonst schon gegen die Tagesmenge der Stufe 1 (nur in der Prüf-DB zurückdatiert).
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', updated_at = NOW() WHERE status IN ('wartet', 'verschoben')`;
    await sqlPool`UPDATE fiaon_aras_anruf SET created_at = created_at - INTERVAL '3 days' WHERE spielart <> 'probe'`;
    await sqlPool`UPDATE fiaon_calls SET beginn = beginn - INTERVAL '3 days' WHERE gefuehrt_von = 'aras'`;
    const aufraeumen = async () => {
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', call_id = NULL WHERE status = 'gewaehlt'`;
      await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt')`;
      await sqlPool`DELETE FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt'`;
    };
    const kundenAnrufe = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_anruf WHERE spielart <> 'probe'`) as any[])[0]?.n ?? 0);
    // Kunden: Rate Tag 2 (Stufe 1 erlaubt), Rate Tag 5 (Stufe 1 nicht), Zuruf per WhatsApp-JA, Zuruf per Antrag-Kästchen
    const pR2 = await person(61); const rR2 = await antrag(pR2, 61, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rR2}, 2, ${`${rR2}-2`}, 5999, ${vor(2)}::date, 'offen')`;
    const pR5 = await person(62); const rR5 = await antrag(pR5, 62, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rR5}, 2, ${`${rR5}-2`}, 5999, ${vor(5)}::date, 'offen')`;
    const pZw = await person(63); await antrag(pZw, 63, { payment_status: "pending_payment" });
    await einwilligungMerken({ personId: pZw, nummer: "+491700000063", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef63" });
    const pZk = await person(64); await antrag(pZk, 64, { payment_status: "pending_payment" });
    await einwilligungMerken({ personId: pZk, nummer: "+491700000064", art: "antrag_kaestchen", wortlaut: "Kästchen", quelleArt: "antrag", quelleId: "pruef64" });

    // a) ROT-PROBE: Stufe 0 + aras_an = an → 0 Kundenanrufe, nichts eingereiht, auch kein Einzel-Wählen
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
    const vorher0 = await kundenAnrufe();
    const f0 = await planFuellen();
    ok("Stufe 0: der Füller reiht KEINEN Kunden ein (auch mit aras_an = an)", (f0.uebersprungen as any)?.stufe_0 === 1 && Object.values(f0.eingereiht ?? {}).every((n) => !n), JSON.stringify(f0));
    // Eine eigene Person für das Einzel-Wählen (die Rate-Kunden oben bleiben unberührt für Stufe 1)
    const pX = await person(66); const rX = await antrag(pX, 66, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rX}, 2, ${`${rX}-2`}, 5999, ${vor(2)}::date, 'offen')`;
    const e0 = await planEinreihen({ personId: pX, nummer: "+491700000066", spielart: "rate", grund: "Prüfstand Stufe 0", erzeugtVon: "chef" });
    const t0 = await waehlerTakt();
    ok("ROT-PROBE Stufe 0 + aras_an = an: der Takt wählt 0 Kunden (Grund stufe_0)", t0.gewaehlt === 0 && t0.ausgelassen.some((a) => a.grund === "stufe_0"), JSON.stringify(t0));
    const w0 = await waehlen(Number(e0.id), {});
    ok("ROT-PROBE Stufe 0: auch das Einzel-Wählen eines Kunden wird abgelehnt", !w0.ok && /Stufe 0/.test(w0.grund ?? ""), w0.grund ?? "");
    ok("ROT-PROBE Stufe 0: kein einziger neuer Kundenanruf", (await kundenAnrufe()) === vorher0);
    const nacht = (() => { const h = berlinTeile(new Date()).hhmm; return h < "07:00" || h >= "23:00"; })();
    if (!nacht) {
      const pr = await probeanruf({ spielart: "rate", von: "pruefstand" });
      ok("Stufe 0: der Probeanruf an die hinterlegte Nummer geht weiter", pr.ok && !!pr.callId, pr.grund ?? "");
      if (pr.callId) { await sqlPool`UPDATE fiaon_calls SET status = 'beendet' WHERE id = ${pr.callId}`; }
    }

    // b) Stufe 1 „Test“: Gleichzeitig 1, Deckel 15 €, 20 je Tag, nur Rückrufe/Auftrag/Stufe A/Rate an Tag 1–3
    await einstellungSetzen("aras_stufe", "1", "pruefstand");
    const g1 = stufenGrenzen(await arasEinstellungenLesen(true));
    ok("Stufe 1: das Engere gilt — Gleichzeitig 1 (Schalter 3), Deckel 15 € (Schalter 60), 20 Versuche je Tag", g1.parallel === 1 && g1.tagEuro === 15 && g1.versucheJeTag === 20, JSON.stringify({ p: g1.parallel, e: g1.tagEuro, v: g1.versucheJeTag }));
    ok("Stufe 1: Zuruf, Zusage, Lead nicht erlaubt; Termin, Auftrag, Stufe A, Rate erlaubt", !g1.spielartErlaubt("zuruf") && !g1.spielartErlaubt("zusage") && !g1.spielartErlaubt("lead") && ["termin", "auftrag", "stufe_a", "rate"].every((x) => g1.spielartErlaubt(x as any)));
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const f1 = await planFuellen();
    const plan1 = (await sqlPool`SELECT person_id, spielart FROM fiaon_aras_plan WHERE status = 'wartet'`) as any[];
    ok("Stufe 1 (Füller): Rate Tag 2 ja, Rate Tag 5 nein, kein Zuruf", plan1.some((z) => Number(z.person_id) === pR2 && z.spielart === "rate") && !plan1.some((z) => Number(z.person_id) === pR5) && !plan1.some((z) => z.spielart === "zuruf"), `Tag 2 = ${pR2}, Tag 5 = ${pR5} · ${JSON.stringify(f1)} · ${JSON.stringify(plan1.map((z) => `${z.person_id}:${z.spielart}`))}`);
    // Takt: Zuruf und Rate Tag 5 bleiben liegen — auch wenn ein Mensch sie von Hand eingereiht hat
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    await planEinreihen({ personId: pZw, nummer: "+491700000063", spielart: "zuruf", grund: "Prüfstand Stufe 1 Zuruf", erzeugtVon: "chef" });
    await planEinreihen({ personId: pR5, nummer: "+491700000062", spielart: "rate", grund: "Prüfstand Stufe 1 Tag 5", erzeugtVon: "chef", anlassAm: new Date(`${vor(5)}T10:00:00Z`) });
    const t1 = await waehlerTakt();
    ok("Stufe 1 (Takt): Zuruf und Rate Tag 5 bleiben liegen (stufe:zuruf, stufe:rate_tag) — 0 gewählt", t1.gewaehlt === 0 && t1.ausgelassen.some((a) => a.grund === "stufe:zuruf") && t1.ausgelassen.some((a) => a.grund === "stufe:rate_tag"), JSON.stringify(t1));
    // Gleichzeitig 1: zwei erlaubte Raten (Tag 2) warten — der Takt wählt höchstens EINE
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const pR1 = await person(65); const rR1 = await antrag(pR1, 65, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rR1}, 2, ${`${rR1}-2`}, 5999, ${vor(1)}::date, 'offen')`;
    await planEinreihen({ personId: pR2, nummer: "+491700000061", spielart: "rate", grund: "Prüfstand Stufe 1 Tag 2", erzeugtVon: "chef", anlassAm: new Date(`${vor(2)}T10:00:00Z`) });
    await planEinreihen({ personId: pR1, nummer: "+491700000065", spielart: "rate", grund: "Prüfstand Stufe 1 Tag 1", erzeugtVon: "chef", anlassAm: new Date(`${vor(1)}T10:00:00Z`) });
    const t1p = await waehlerTakt();
    const fenster1 = t1p.ausgelassen.some((a) => a.grund.startsWith("fenster:"));
    if (fenster1) ok("Außerhalb des Fensters: nichts gewählt", t1p.gewaehlt === 0);
    else ok("Stufe 1 (Takt): zwei erlaubte Raten warten — höchstens EIN Anruf gleichzeitig", t1p.gewaehlt === 1, JSON.stringify(t1p));
    await aufraeumen();
    // Tagesmenge 20 voll → kein Wählen
    await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von) SELECT ${pR2}, ${ausweis}, '+491700000061', 'raus', 'beendet', NOW(), 'aras' FROM generate_series(1, 20)`;
    await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version) SELECT c.id, 'rate', '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand' FROM fiaon_calls c WHERE c.gefuehrt_von = 'aras' AND c.status = 'beendet' AND c.person_id = ${pR2} AND NOT EXISTS (SELECT 1 FROM fiaon_aras_anruf x WHERE x.call_id = c.id)`;
    const t1m = await waehlerTakt();
    ok("Stufe 1: nach 20 Kundenanrufen heute ist Schluss (Grund stufe_tagesmenge:20)", t1m.gewaehlt === 0 && t1m.ausgelassen.some((a) => a.grund === "stufe_tagesmenge:20"), JSON.stringify(t1m));
    await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND person_id = ${pR2} AND status = 'beendet')`;
    await sqlPool`DELETE FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND person_id = ${pR2} AND status = 'beendet'`;
    // Deckel 15 € (auch wenn der Schalter 60 € sagt)
    await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe-stufe', 0, 0, 0, 0, 1600, TRUE)`;
    const t1d = await waehlerTakt();
    ok("Stufe 1: Deckel 15 € greift, obwohl der Schalter 60 € erlaubt (Grund deckel)", t1d.gewaehlt === 0 && t1d.ausgelassen.some((a) => a.grund === "deckel"), JSON.stringify(t1d));
    await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell = 'attrappe-stufe'`;

    // c) Stufe 2 „Leise“: Zuruf nur mit JA per Nachricht — das Antrag-Kästchen erst ab Stufe 3
    await einstellungSetzen("aras_stufe", "2", "pruefstand");
    const g2 = stufenGrenzen(await arasEinstellungenLesen(true));
    ok("Stufe 2: Gleichzeitig 2, Deckel 60 €, 150 je Tag, Zuruf erlaubt, Lead nicht", g2.parallel === 2 && g2.tagEuro === 60 && g2.versucheJeTag === 150 && g2.spielartErlaubt("zuruf") && !g2.spielartErlaubt("lead"));
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    // Ein frisches WhatsApp-JA (das von oben ist schon „verbraucht“: ein Ja = ein Anruf)
    const pZw2 = await person(67); await antrag(pZw2, 67, { payment_status: "pending_payment" });
    await einwilligungMerken({ personId: pZw2, nummer: "+491700000067", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef67" });
    await planFuellen();
    const plan2 = (await sqlPool`SELECT person_id, spielart FROM fiaon_aras_plan WHERE status = 'wartet' AND spielart = 'zuruf'`) as any[];
    ok("Stufe 2 (Füller): Zuruf mit WhatsApp-JA ja, mit Antrag-Kästchen nein", plan2.some((z) => Number(z.person_id) === pZw2) && !plan2.some((z) => Number(z.person_id) === pZk), JSON.stringify(plan2));

    // Takt: ein von Hand eingereihter Zuruf mit Antrag-Kästchen bleibt in Stufe 2 liegen
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const ek = await planEinreihen({ personId: pZk, nummer: "+491700000064", spielart: "zuruf", grund: "Prüfstand Stufe 2 Kästchen", erzeugtVon: "chef" });
    const t2 = await waehlerTakt();
    log(`  Stufe 2, Zuruf mit Kästchen: eingereiht=${ek.ok}${ek.grund ? ` (${ek.grund})` : ""} · Takt ${JSON.stringify(t2)}`);
    ok("Stufe 2 (Takt): Zuruf mit Antrag-Kästchen bleibt liegen (stufe:zuruf_kaestchen) — erst ab Stufe 3", !ek.ok || (t2.gewaehlt === 0 && t2.ausgelassen.some((a) => a.grund === "stufe:zuruf_kaestchen")), `${ek.ok ? "" : `eingereiht abgelehnt: ${ek.grund} · `}${JSON.stringify(t2)}`);
    await aufraeumen();

    // d) Stufe 3: Obergrenzen fest (430 je Tag, höchstens 5 gleichzeitig, 150 €) — nie mehr, auch wenn der Schalter mehr will
    ok("Stufe 3: 430 je Tag, Gleichzeitig ≤ 5, Deckel ≤ 150 €", STUFEN[3].versucheJeTag === 430 && STUFEN[3].parallel === 5 && STUFEN[3].tagEuro === 150);
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    await aufraeumen();
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("17. STUFEN-AMPEL (Teil 2): Rot → eine Stufe zurück + EINE Karte; 3 grüne Tage → hoch; nie aus 0, nie über 3");
  {
    const { stufeAutomatik, stufeLage } = await import("../server/lib/fiaon-aras-stufe");
    const { berlinTeile } = await import("../shared/fiaon-aras");
    const { tagMinus } = await import("../shared/fiaon-aras-stufe");
    const heute = berlinTeile(new Date()).datum;
    // Saubere Ausgangslage: keine Kundenanrufe in den letzten 10 Tagen, keine Ampel-Zeilen, keine Stufen-Karten
    await sqlPool`UPDATE fiaon_aras_anruf SET created_at = created_at - INTERVAL '30 days' WHERE spielart <> 'probe'`;
    await sqlPool`DELETE FROM fiaon_aras_stufe_tag`;
    await sqlPool`DELETE FROM fiaon_system_alarme WHERE schluessel LIKE 'aras:stufe:%'`.catch(() => null);
    const pAmp = await person(71); const rAmp = await antrag(pAmp, 71, { payment_status: "paid" });
    let lfd = 0;
    /** Ein erfundener Tag mit Kundenanrufen (n Tage zurück, 11 Uhr Berlin). */
    const tagAnlegen = async (n: number, e: { versuche: number; erreicht: number; zahlungen: number; sperr?: number; pruefHart?: number; spielart?: string }) => {
      const tag = tagMinus(heute, n);
      for (let i = 0; i < e.versuche; i++) {
        lfd += 1;
        const erreicht = i < e.erreicht;
        const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ref)
                      VALUES (${pAmp}, ${ausweis}, '+491700000071', 'raus', 'beendet', (${tag}::date + TIME '11:00') AT TIME ZONE 'Europe/Berlin', 'aras', ${rAmp}) RETURNING id`) as any[];
        const [aa] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, ende_grund, sekunden_sitzung, kosten_ki_cents, kosten_telefon_cents, pruefung_status, pruefung, created_at)
                      VALUES (${c.id}, ${e.spielart ?? "rate"}, '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand', ${erreicht ? "erreicht_zahlt_am" : "nicht_erreicht"}, 'aras_beendet', ${erreicht ? 180 : 20}, 20, 10,
                              ${erreicht && i < (e.pruefHart ?? 0) ? "fehler" : "ok"}, NULL, (${tag}::date + TIME '11:00') AT TIME ZONE 'Europe/Berlin') RETURNING id`) as any[];
        if (erreicht && i < (e.sperr ?? 0)) await sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok) VALUES (${aa.id}, 'nicht_mehr_anrufen', ${`pruef-${lfd}`}, '{}'::jsonb, '{}'::jsonb, TRUE)`;
      }
      // Zahlungen binnen 48 h: Raten des Antrags, bezahlt am Folgetag
      for (let i = 0; i < e.zahlungen; i++) {
        await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
                      VALUES (${rAmp}, ${100 + lfd + i}, ${`${rAmp}-${100 + lfd + i}`}, 5999, ${tag}::date, 'bezahlt', (${tag}::date + TIME '18:00') AT TIME ZONE 'Europe/Berlin' + INTERVAL '1 day')`;
      }
      // Die Ampel-Zeile des Tages (die Automatik lief an dem Tag in dieser Stufe)
      await sqlPool`INSERT INTO fiaon_aras_stufe_tag (tag, stufe, werte, farbe, punkte) VALUES (${tag}::date, ${1}, '{}'::jsonb, 'leer', '[]'::jsonb) ON CONFLICT (tag) DO UPDATE SET stufe = 1`;
    };
    // Die Stufe gilt seit zehn Tagen (sonst zählen die Tage davor nicht)
    const stufeSeit = async (stufe: string, tageZurueck: number) => {
      await einstellungSetzen("aras_stufe", stufe, "pruefstand");
      await sqlPool`UPDATE fiaon_settings SET updated_at = NOW() - make_interval(days => ${tageZurueck}) WHERE key = 'aras_stufe'`;
      arasEinstellungenVergessen();
    };
    await einstellungSetzen("aras_stufe_auto", "an", "pruefstand");

    // a) Drei grüne, abgeschlossene Tage in Stufe 1 → Stufe 2, genau EINE Karte
    await stufeSeit("1", 10);
    for (const n of [3, 4, 5]) await tagAnlegen(n, { versuche: 10, erreicht: 4, zahlungen: 1 });
    const a1 = await stufeAutomatik(sqlPool);
    ok("3 grüne Tage in Stufe 1 → automatisch Stufe 2, mit Karte an Justin", a1.geaendert && a1.neu === 2 && a1.richtung === "hoch" && a1.karte, JSON.stringify({ g: a1.geaendert, neu: a1.neu, grund: a1.grund }));
    ok("aras_stufe steht jetzt auf 2", (await arasEinstellungenLesen(true)).stufe === 2);
    const a2 = await stufeAutomatik(sqlPool);
    const karten = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_system_alarme WHERE schluessel LIKE 'aras:stufe:%'`) as any[])[0]?.n ?? 0);
    ok("Zweiter Lauf am selben Tag: keine zweite Änderung, keine zweite Karte", !a2.geaendert && !a2.karte && karten === 1, `${a2.grund} · Karten ${karten}`);
    const lage = await stufeLage();
    ok("Anzeige (GET /chef/aras/stufe): Stufe 2, die Tage mit Farbe, die Entscheidung „Stufe 1 → 2“ und was bis Stufe 3 fehlt", lage.stufe === 2 && lage.tage.length >= 4 && lage.tage.some((t) => /Stufe 1 → 2/.test(t.entscheidung ?? "")) && lage.tage.filter((t) => t.farbe === "gruen").length >= 3 && /von 5 grünen Tagen/.test(lage.naechste), JSON.stringify({ s: lage.stufe, n: lage.naechste, t: lage.tage.map((t) => `${t.tag}:${t.farbe}`) }));

    // b) ROT-PROBE: am nächsten Tag zwei „nicht mehr anrufen“ seit der neuen Stufe → eine Stufe zurück + EINE Karte
    const morgen0 = new Date(Date.now() + 24 * 3600_000);
    await sqlPool`UPDATE fiaon_settings SET updated_at = NOW() - INTERVAL '1 hour' WHERE key = 'aras_stufe'`;
    arasEinstellungenVergessen();
    for (let i = 0; i < 2; i++) {
      lfd += 1;
      const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ref) VALUES (${pAmp}, ${ausweis}, '+491700000071', 'raus', 'beendet', NOW(), 'aras', ${rAmp}) RETURNING id`) as any[];
      const [aa] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, ende_grund, sekunden_sitzung) VALUES (${c.id}, 'rate', '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand', 'erreicht_abgelehnt', 'aras_beendet', 60) RETURNING id`) as any[];
      await sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok) VALUES (${aa.id}, 'nicht_mehr_anrufen', ${`pruef-rot-${lfd}`}, '{}'::jsonb, '{}'::jsonb, TRUE)`;
    }
    const r1 = await stufeAutomatik(sqlPool, morgen0);
    ok("ROT-PROBE: zwei „nicht mehr anrufen“ seit der Stufe → eine Stufe zurück (2 → 1), Karte an Justin", r1.rotJetzt && r1.geaendert && r1.neu === 1 && r1.richtung === "runter" && r1.karte, JSON.stringify({ rot: r1.rotJetzt, neu: r1.neu, grund: r1.grund }));
    const r2 = await stufeAutomatik(sqlPool, morgen0);
    ok("Kein Kaskaden-Absturz, keine Kartenflut: der nächste Lauf ändert nichts mehr und schickt keine Karte", !r2.geaendert && !r2.karte && (await arasEinstellungenLesen(true)).stufe === 1, r2.grund);
    // Die alten roten Anrufe zählen für die neue Stufe nicht mehr (nur Anrufe SEIT der Änderung)
    const r3 = await stufeAutomatik(sqlPool, new Date(Date.now() + 2 * 24 * 3600_000));
    ok("Übermorgen: die alten Abbrüche zählen nicht für Stufe 1 — keine weitere Stufe zurück", !r3.geaendert && !r3.rotJetzt && (await arasEinstellungenLesen(true)).stufe === 1, JSON.stringify({ rot: r3.rotJetzt, grund: r3.grund }));

    // c) ROT-PROBE: nie aus Stufe 0 hoch — auch nach grünen Tagen (die roten Anrufe aus b liegen jetzt weit zurück)
    await sqlPool`UPDATE fiaon_aras_anruf SET created_at = created_at - INTERVAL '30 days' WHERE created_at > NOW() - INTERVAL '1 hour' AND spielart <> 'probe'`;
    await sqlPool`DELETE FROM fiaon_aras_stufe_tag`;
    await stufeSeit("0", 10);
    for (const n of [3, 4, 5, 6]) await sqlPool`INSERT INTO fiaon_aras_stufe_tag (tag, stufe, werte, farbe, punkte) VALUES (${tagMinus(heute, n)}::date, 0, '{}'::jsonb, 'leer', '[]'::jsonb) ON CONFLICT (tag) DO UPDATE SET stufe = 0`;
    const z0 = await stufeAutomatik(sqlPool);
    ok("ROT-PROBE: aus Stufe 0 geht es nie automatisch hoch", !z0.geaendert && (await arasEinstellungenLesen(true)).stufe === 0, z0.grund);

    // d) ROT-PROBE: nie über 3
    await sqlPool`UPDATE fiaon_aras_stufe_tag SET stufe = 3`;
    await stufeSeit("3", 10);
    const z3 = await stufeAutomatik(sqlPool);
    ok("ROT-PROBE: aus Stufe 3 geht es nie höher", !z3.geaendert && (await arasEinstellungenLesen(true)).stufe === 3, z3.grund);

    // e) Automatik aus + Rot: Stufe bleibt, aber Justin bekommt EINE Karte
    await sqlPool`DELETE FROM fiaon_aras_stufe_tag`;
    await sqlPool`DELETE FROM fiaon_system_alarme WHERE schluessel LIKE 'aras:stufe:%'`.catch(() => null);
    await einstellungSetzen("aras_stufe_auto", "aus", "pruefstand");
    await stufeSeit("2", 2);
    for (let i = 0; i < 2; i++) {
      const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ref) VALUES (${pAmp}, ${ausweis}, '+491700000071', 'raus', 'beendet', NOW(), 'aras', ${rAmp}) RETURNING id`) as any[];
      await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, ende_grund, sekunden_sitzung, pruefung_status) VALUES (${c.id}, 'rate', '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand', 'erreicht_sonstiges', 'aras_beendet', 120, 'fehler')`;
    }
    const x1 = await stufeAutomatik(sqlPool);
    const x2 = await stufeAutomatik(sqlPool);
    const kartenAus = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_system_alarme WHERE schluessel LIKE 'aras:stufe:%'`) as any[])[0]?.n ?? 0);
    ok("Automatik aus + Prüf-Fehler rot: Stufe bleibt 2, genau EINE Karte (auch beim zweiten Lauf keine weitere)", x1.rotJetzt && !x1.geaendert && x1.karte && !x2.karte && kartenAus === 1 && (await arasEinstellungenLesen(true)).stufe === 2, JSON.stringify({ x1: x1.karte, x2: x2.karte, kartenAus }));
    await einstellungSetzen("aras_stufe_auto", "an", "pruefstand");
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("18. TON (Justin 20.10. nachmittags, Anruf 16: „bricht ab wie Funkprobleme … zu leise“) + EINWILLIGUNG + ERGEBNIS");
  {
    await einstellungSetzen("aras_stufe", "3", "pruefstand");
    await einstellungSetzen("aras_hintergrund", "aus", "pruefstand");
    await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand");
    let nr = 80;
    const anruf18 = async (skript: Parameters<typeof attrappeMitSkript>[0]) => {
      nr += 1;
      const pid = await person(nr); await antrag(pid, nr, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${nr}`, spielart: "zusage", grund: `Prüfstand Ton ${nr}`, erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      return gespraech(Number(e.id), skript);
    };
    const ende18 = async (g: { tw: InstanceType<typeof TwilioAttrappe>; callId: number }) => {
      g.tw.aufhaengen();
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 12_000);
      return anruf(g.callId);
    };
    const satz = { dbfs: -24 };
    // a) Wie GPT-Live liefert (Echtzeit mit Schwankung, ohne Aufholen) und stoßweise (300 ms Stoß, 250 ms Pause): durch die echte Brücke
    for (const muster of ["echtzeit_schwankend", "stossweise"] as const) {
      const g = await anruf18({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 2600, ton: { ...satz, muster } }, { kunde: "Ja, hallo.", nachMs: 900 }, { warteMs: 400 },
        { aras: "Super, schön, dass ich Sie erreiche — ich erzähl Ihnen kurz, worum es geht und wie es jetzt weitergeht.", ms: 4500, ton: { ...satz, muster } }, { warteMs: 1500 },
      ] });
      await schlafen(10_500);
      const l = g.tw.luecken(5), pegel18 = g.tw.redePegel();
      ok(`${muster}: 0 Lücken mitten in der Rede beim Kunden (ab 5 ms)`, l.length === 0, `${l.length} Lücken${l.length ? ` (${l.slice(0, 6).join(", ")} ms)` : ""}`);
      ok(`${muster}: Rede beim Kunden ≈ −16 dBFS (±3) — GPT-Live liefert −24`, Math.abs(pegel18 + 16) <= 3, `${pegel18.toFixed(1)} dBFS`);
      ok(`${muster}: Vorrat bei Twilio ≤ 1,5 s`, g.tw.maxVorratMs <= 1540, `${Math.round(g.tw.maxVorratMs)} ms`);
      const a = await ende18(g);
      const ton = a?.ton ?? null;
      ok(`${muster}: Messung je Anruf gespeichert (Pegel, Lücken, Vorrat, Antwortzeit)`, !!ton && Math.abs(Number(ton.rede?.rmsDbfs) + 16) <= 3 && ton.luecken?.anzahl === 0 && ton.vorrat?.medianMs != null && a?.antwort_ms_median != null && Number(a.antwort_ms_median) > 0,
        JSON.stringify({ rede: ton?.rede?.rmsDbfs, luecken: ton?.luecken, vorrat: ton?.vorrat, antwort: a?.antwort_ms_median }));
    }
    // Rot-Probe: der alte Weg (sofort weiter, ≤ 500 ms, ohne Regelung) reißt mit derselben Lieferung Lücken und bleibt zu leise
    {
      process.env.ARAS_TON_ALT = "1";
      const g = await anruf18({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 2600, ton: { ...satz, muster: "echtzeit_schwankend" } }, { kunde: "Ja, hallo.", nachMs: 900 }, { warteMs: 400 },
        { aras: "Super, schön, dass ich Sie erreiche — ich erzähl Ihnen kurz, worum es geht und wie es jetzt weitergeht.", ms: 4500, ton: { ...satz, muster: "echtzeit_schwankend" } }, { warteMs: 1500 },
      ] });
      await schlafen(10_500);
      delete process.env.ARAS_TON_ALT;
      const l = g.tw.luecken(5), pegel18 = g.tw.redePegel();
      ok("Rot-Probe alter Weg: Lücken mitten in der Rede („Funkprobleme“) und zu leise (≈ −24 dBFS)", l.length > 0 && pegel18 < -21, `${l.length} Lücken, längste ${l.length ? Math.max(...l) : 0} ms · ${pegel18.toFixed(1)} dBFS`);
      await ende18(g);
    }

    // b) Einwilligung (Anruf 16): „Ja, und ein weiteres Feedback gleich …“ IST ein Ja — die Aufnahme startet, kein Nein
    const frage = "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?";
    {
      const g = await anruf18({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 600 }, { warteMs: 300 }, { aras: frage, ms: 400 }, { warteMs: 1200 },
        { kunde: "Ja, und ein weiteres Feedback gleich: Du sollst nicht so oft Super sagen.", nachMs: 100 }, { warteMs: 2000 },
      ] });
      await warten(() => !!laufZahlen(g.callId)?.aufnahmeJa, 6000);
      const z = laufZahlen(g.callId);
      const a = await ende18(g);
      ok("Anruf 16: „Ja, und ein weiteres Feedback gleich …“ → Aufnahme startet, kein Nein", !!z?.aufnahmeJa && !z?.aufnahmeNein && a?.aufnahme_nein_am == null && !!a?.aufnahme_gestartet_am, JSON.stringify({ z: { ja: z?.aufnahmeJa, nein: z?.aufnahmeNein }, nein: a?.aufnahme_nein_am }));
    }
    // c) Erst Nein, dann fragt Aras noch einmal und er sagt „Ja, zeichnen Sie auf“ → das neue Ja gilt (das Nein wird aufgehoben)
    {
      const g = await anruf18({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 600 }, { warteMs: 300 }, { aras: frage, ms: 400 }, { warteMs: 1200 },
        { kunde: "Nein, lieber nicht.", nachMs: 100 }, { warteMs: 1500 }, { aras: frage, ms: 400 }, { warteMs: 1200 },
        { kunde: "Ja, zeichnen Sie auf.", nachMs: 100 }, { warteMs: 2000 },
      ] });
      await warten(() => !!laufZahlen(g.callId)?.aufnahmeJa, 9000);
      const z = laufZahlen(g.callId);
      const a = await ende18(g);
      const wz = (await sqlPool`SELECT werkzeug, ok FROM fiaon_aras_werkzeug WHERE aras_anruf_id = ${a?.id ?? 0} ORDER BY id`) as any[];
      ok("Anruf 16: erst „Nein, lieber nicht“, auf die neue Frage „Ja, zeichnen Sie auf“ → Aufnahme läuft, Nein aufgehoben", !!z?.aufnahmeJa && a?.aufnahme_nein_am == null && !!a?.aufnahme_gestartet_am && wz.some((w) => w.werkzeug === "aufnahme_abgelehnt" && w.ok) && wz.some((w) => w.werkzeug === "aufnahme_starten" && w.ok),
        `${wz.map((w) => `${w.werkzeug}:${w.ok}`).join(",")} · nein ${a?.aufnahme_nein_am}`);
      ok("… und das Transkript ist gespeichert (seit dem Ja)", Array.isArray(a?.transkript) && a.transkript.length > 0, String(a?.transkript?.length ?? 0));
    }
    // d) Rot-Probe: „Ja, aber um was geht's dabei?“ ist weder Ja noch Nein — kein Start, und aufnahme_abgelehnt des Modells wird abgewiesen
    {
      const g = await anruf18({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 600 }, { warteMs: 300 }, { aras: frage, ms: 400 }, { warteMs: 1200 },
        { kunde: "Ja, aber um was geht's dabei?", nachMs: 100 }, { warteMs: 300 }, { werkzeug: "aufnahme_abgelehnt" }, { warteMs: 1200 },
      ] });
      await schlafen(3800);
      const z = laufZahlen(g.callId);
      const w = g.att.spur.werkzeuge.find((x) => x.name === "aufnahme_abgelehnt");
      const a = await ende18(g);
      ok("Rot-Probe Anruf 11: unsicher („Ja, aber …?“) ist KEIN Nein — kein Start, kein Nein, das Werkzeug wird abgewiesen (kein_nein)", !z?.aufnahmeJa && !z?.aufnahmeNein && w?.ergebnis.ok === false && w?.ergebnis.fehler === "kein_nein" && a?.aufnahme_nein_am == null,
        JSON.stringify({ ja: z?.aufnahmeJa, nein: z?.aufnahmeNein, w: w?.ergebnis.fehler }));
    }

    // e) Ergebnis (Anrufe 12, 15, 16): Chefbüro legt nach echtem Gespräch auf, Twilio meldet „completed“ sofort hinterher
    const status = async (callId: number) => {
      const url = `${process.env.APP_BASE_URL}/api/fiaon/aras/status?anruf=${callId}`;
      const body = { CallSid: `ATTRAPPE-${callId}`, CallStatus: "completed", CallDuration: "30" };
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signaturBauen(process.env.TWILIO_AUTH_TOKEN!, url, body) }, body: new URLSearchParams(body).toString() });
    };
    const { sitzungBeenden } = await import("../server/lib/fiaon-aras-bruecke");
    {
      const g = await anruf18({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, hallo, worum geht's?", nachMs: 700 }, { aras: "Es geht um Ihre geplante Überweisung.", ms: 400 }, { warteMs: 6000 }] });
      await schlafen(2000);
      const fertig = sitzungBeenden(g.callId, "Chefbüro");
      await schlafen(30);
      await status(g.callId);
      await fertig;
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 10_000);
      await schlafen(800);
      const a = await anruf(g.callId);
      ok("Anrufe 12/15/16: im Chefbüro aufgelegt + Twilio „completed“ gleich hinterher → erreicht_sonstiges (nie „nicht_erreicht · Niemand hat gesprochen“)", a?.ergebnis === "erreicht_sonstiges" && !/Niemand hat gesprochen/.test(String(a?.ergebnis_notiz)), `${a?.ergebnis} · ${a?.ergebnis_notiz}`);
      ok("Ende-Grund einheitlich: „Chefbüro“ wird „chef“", a?.ende_grund === "chef", String(a?.ende_grund));
    }
    {
      const g = await anruf18({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 6000 }] });
      await schlafen(1500);
      const fertig = sitzungBeenden(g.callId, "chef");
      await schlafen(30);
      await status(g.callId);
      await fertig;
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 10_000);
      const a = await anruf(g.callId);
      ok("Rot-Probe: ohne ein Wort des Kunden bleibt es „nicht_erreicht“", a?.ergebnis === "nicht_erreicht", `${a?.ergebnis} · ${a?.ergebnis_notiz}`);
    }
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("19. ERÖFFNUNG (Justin 20.10., Anruf 8: „Grüß Gott, hier ist der [abgebrochen]“) — der Angerufene spricht zuerst; LIVE-KARTE: EIN Ende, danach nichts mehr");
  {
    delete process.env.ARAS_EROEFFNUNG_SOFORT;
    await einstellungSetzen("aras_stufe", "3", "pruefstand");
    await einstellungSetzen("aras_zuhoeren", "normal", "pruefstand");
    let nr = 120;
    const anruf19 = async (skript: Parameters<typeof attrappeMitSkript>[0]) => {
      nr += 1;
      const pid = await person(nr); await antrag(pid, nr, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${nr}`, spielart: "zusage", grund: `Prüfstand Eröffnung ${nr}`, erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      return gespraech(Number(e.id), skript);
    };
    const ende19 = async (g: { tw: InstanceType<typeof TwilioAttrappe>; callId: number }) => {
      g.tw.aufhaengen();
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 12_000);
    };
    // a) GPT-Live spricht (gegen die Anweisung) sofort los — der Kunde sagt nach 1 s „Hallo?“: Aras' Ton wartet; redet der Kunde
    //    hinein, fällt der Ansatz weg (wie Anruf 8: „hier ist der [abgebrochen]“ — nur hört der Kunde ihn jetzt nie), und GPT-Live
    //    antwortet auf sein „Hallo?“.
    {
      // (Rückfall ohne „Eröffnung vorab“ — ARAS_EROEFFNUNG_VORAB=aus, nur im Prüfstand)
      process.env.ARAS_EROEFFNUNG_VORAB = "aus";
      const t0 = Date.now();
      const g = await anruf19({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 1500, ton: { dbfs: -24 } }, { beiKundenStimme: "Hallo?" }, { nachKundeStillMs: 400 }, { aras: KI_HINWEIS_VORGABE, ms: 1500, ton: { dbfs: -24 } }, { warteMs: 3000 }] });
      delete process.env.ARAS_EROEFFNUNG_VORAB;
      ok("Rückfall ohne Vorab: keine Begrüßung vorab, Eingang nicht stumm (der Angerufene spricht zuerst)", g.att.spur.begruessung === null && !g.att.spur.stumm, String(g.att.spur.begruessung).slice(0, 60));
      await schlafen(Math.max(0, 1000 - (Date.now() - t0)));
      g.tw.laut(600);
      const halloEnde = g.tw.lautEnde();
      await schlafen(3500);
      const ersteRede = g.tw.gespielt().filter((r) => TwilioAttrappe.dbfs(r.pcm) > -45).sort((x, y) => x.start - y.start)[0]?.start ?? 0;
      ok("Kein „Grüß Gott, hier ist der [abgebrochen]“: Aras ist erst NACH seinem „Hallo?“ zu hören", ersteRede > 0 && ersteRede >= halloEnde, `${ersteRede ? Math.round(ersteRede - halloEnde) : "—"} ms nach seinem Hallo`);
      const waehrend = g.tw.gespielt().filter((r) => TwilioAttrappe.dbfs(r.pcm) > -45 && r.start < halloEnde).length;
      ok("… während seines „Hallo?“ war nichts von Aras zu hören (der zu frühe Ansatz fiel weg)", waehrend === 0, `${waehrend} Rede-Rahmen · ${JSON.stringify({ v: laufZahlen(g.callId)?.verworfen, clear: g.tw.gesendet().clear })}`);
      await ende19(g);
    }
    // a2) Eröffnung VORAB (Koordination 20.10. abends, Ziel ≤ 0,8 s): GPT-Live spricht die Eröffnung gleich beim Abheben, der
    //     Eingang ist stumm, die Brücke hält den Ton — sein „Hallo?“ (nach 1 s, 600 ms lang) hört er ungestört, danach kommt
    //     die GANZE Eröffnung sofort; der Eingang geht danach wieder an, der KI-Hinweis zählt ab dann.
    {
      const t0 = Date.now();
      const g = await anruf19({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 1500, ton: { dbfs: -24 } }, { warteMs: 5000 }] });
      const vorab = g.att.spur.eingeschoben.find((x) => x.art === "vorlesen" && /hat sich gerade gemeldet/.test(x.text));
      ok("Vorab: die Eröffnung gleich beim Start als „vorlesen“ (Kreditkarte, KI-Hinweis) — keine developer-Nachricht, Eingang stumm", !!vorab && /Kreditkarten/.test(vorab.text) && /\bKI\b/.test(vorab.text) && (vorab.am ?? 0) - t0 < 900 && g.att.spur.begruessung === null && g.att.spur.stumm === true, `${vorab ? (vorab.am ?? 0) - t0 : "—"} ms nach Start · ${vorab?.text.slice(0, 60) ?? "—"}`);
      await schlafen(Math.max(0, 1000 - (Date.now() - t0)));
      g.tw.laut(600);
      const halloEnde = g.tw.lautEnde();
      await schlafen(3500);
      const rede = g.tw.gespielt().filter((r) => TwilioAttrappe.dbfs(r.pcm) > -45).sort((x, y) => x.start - y.start);
      const ersteRede = rede[0]?.start ?? 0;
      ok("Vorab: während seines „Hallo?“ nichts von Aras — danach die Eröffnung in ≤ 0,8 s", ersteRede >= halloEnde && ersteRede - halloEnde <= 800, `${ersteRede ? Math.round(ersteRede - halloEnde) : "—"} ms nach seinem Hallo`);
      const z = laufZahlen(g.callId);
      ok("Vorab: die ganze Eröffnung läuft (nichts verworfen, kein Abbruch), der Eingang ist danach wieder an", !!z && z.verworfen === 0 && z.clears === 0 && !z.eingangStumm && (g.att.spur.eingang ?? []).some((x) => x.an && x.am >= halloEnde), JSON.stringify({ v: z?.verworfen, clears: z?.clears, eingang: g.att.spur.eingang }));
      ok("Vorab: der KI-Hinweis zählt erst, wenn er ihn hört (nicht schon beim Sprechen vor seinem Hallo)", !!z?.kiHinweisAm && z.kiHinweisAm >= halloEnde, `${z?.kiHinweisAm ? z.kiHinweisAm - halloEnde : "—"} ms nach dem Hallo`);
      await ende19(g);
    }
    // a4) Vorbereitet schon beim KLINGELN (aras_vorbereiten = klingeln): die Sitzung startet vor dem Ton-Strom, die Eröffnung ist
    //     fertig gesprochen und gehalten, wenn er abnimmt — nach seinem „Hallo?“ ist sie in ≤ 0,5 s zu hören, ganz.
    {
      const { vorbereiten } = await import("../server/lib/fiaon-aras-bruecke");
      nr += 1;
      const pid = await person(nr); await antrag(pid, nr, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${nr}`, spielart: "zusage", grund: `Prüfstand Klingeln ${nr}`, erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      let beimKlingeln: any = null;
      const g = await gespraech(Number(e.id), { schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 1500, ton: { dbfs: -24 } }, { warteMs: 6000 }] },
        { vorStart: async (callId) => {
          vorbereiten(callId, undefined, 45_000); await schlafen(2500);
          [beimKlingeln] = (await sqlPool`SELECT c.status, aa.angenommen_am, aa.sitzung_id FROM fiaon_calls c JOIN fiaon_aras_anruf aa ON aa.call_id = c.id WHERE c.id = ${callId}`) as any[];
        } });
      const t0 = Date.now();
      await schlafen(1000);
      g.tw.laut(600);
      const halloEnde = g.tw.lautEnde();
      await schlafen(3000);
      const rede = g.tw.gespielt().filter((r) => TwilioAttrappe.dbfs(r.pcm) > -45).sort((x, y) => x.start - y.start);
      const ersteRede = rede[0]?.start ?? 0;
      const z = laufZahlen(g.callId);
      ok("Beim Klingeln vorbereitet: nach seinem „Hallo?“ in ≤ 0,5 s zu hören (vorher nichts), die ganze Eröffnung, Eingang danach an", ersteRede >= halloEnde && ersteRede - halloEnde <= 500 && !!z && z.verworfen === 0 && !z.eingangStumm, `${ersteRede ? Math.round(ersteRede - halloEnde) : "—"} ms nach dem Hallo · ${Math.round(halloEnde - t0)} ms Hallo-Ende`);
      const [nachher] = (await sqlPool`SELECT c.status, aa.angenommen_am FROM fiaon_calls c JOIN fiaon_aras_anruf aa ON aa.call_id = c.id WHERE c.id = ${g.callId}`) as any[];
      ok("… beim Klingeln läuft die Sitzung schon, gilt aber noch NICHT als angenommen (Anruf „gewählt“, kein angenommen_am) — erst mit dem Ton-Strom", beimKlingeln?.status === "gewaehlt" && !beimKlingeln?.angenommen_am && !!beimKlingeln?.sitzung_id && nachher?.status === "laeuft" && !!nachher?.angenommen_am, JSON.stringify({ klingeln: beimKlingeln, nachher }));
      await ende19(g);
    }
    // a3) Vorab, aber GPT-Live bleibt stumm: nach 2,5 s ein zweites Mal (Rückfall) — nie zwei Eröffnungen, solange Ton kommt
    {
      const g = await anruf19({ schritte: [{ warteMs: 6000 }] });
      const t0 = Date.now();
      g.tw.laut(500);
      await warten(() => g.att.spur.eingeschoben.filter((x) => /hat sich gerade gemeldet/.test(x.text)).length >= 2, 6000);
      const pushes = g.att.spur.eingeschoben.filter((x) => /hat sich gerade gemeldet/.test(x.text));
      ok("Vorab ohne Ton: der Rückfall schiebt nach ≥ 2,5 s ein zweites Mal nach (genau zweimal)", pushes.length === 2 && (pushes[1].am ?? 0) - (pushes[0].am ?? 0) >= 2400, JSON.stringify(pushes.map((x) => (x.am ?? 0) - t0)));
      await ende19(g);
    }
    // b) Rückfall ohne Vorab — er sagt nichts: nach 2 s Stille beginnt Aras (Eröffnung von der Brücke nachgeschoben)
    process.env.ARAS_EROEFFNUNG_VORAB = "aus";
    {
      const g = await anruf19({ schritte: [{ warteMs: 5000 }] });
      const t0 = Date.now();
      await warten(() => g.att.spur.eingeschoben.some((x) => /hat sich gerade gemeldet/.test(x.text)), 4000);
      const dauer = Date.now() - t0;
      const gruss = g.att.spur.eingeschoben.find((x) => /hat sich gerade gemeldet/.test(x.text));
      ok("Er schweigt: nach ~2 s kommt die Eröffnung (als „vorlesen“, mit Kreditkarte und KI-Hinweis)", !!gruss && gruss.art === "vorlesen" && dauer >= 1500 && dauer <= 3200 && /Kreditkarten/.test(gruss.text) && /\bKI\b/.test(gruss.text), `${dauer} ms · ${gruss?.text.slice(0, 80) ?? "—"}`);
      await ende19(g);
    }
    // c) Er sagt „Hallo?“, GPT-Live schweigt → die Brücke schiebt die Eröffnung ~0,6 s nach seinem Hallo nach (nicht schon währenddessen;
    //    Rauchtest 20.10. abends: GPT-Live spricht ausgehend nie von selbst — mit 1,2 s hörte er Aras erst 2,2–2,6 s nach dem Hallo)
    {
      const g = await anruf19({ schritte: [{ beiKundenStimme: "Hallo?" }, { warteMs: 5000 }] });
      await schlafen(500);
      g.tw.laut(500);
      const halloEnde = g.tw.lautEnde();
      await warten(() => g.att.spur.eingeschoben.some((x) => /hat sich gerade gemeldet/.test(x.text)), 4000);
      const am = Date.now();
      ok("Nach seinem „Hallo?“ und Schweigen von GPT-Live: Eröffnung ~0,6 s danach (nie in sein Hallo hinein, nie später als 1,3 s)", am - halloEnde >= 500 && am - halloEnde <= 1300, `${am - halloEnde} ms nach seinem Hallo`);
      await ende19(g);
    }
    delete process.env.ARAS_EROEFFNUNG_VORAB;
    // d) Rot-Probe eingehend: Aras meldet sich sofort (Begrüßung als developer-Nachricht, kein Warten)
    {
      const { sitzungStarten } = await import("../server/lib/fiaon-aras-bruecke");
      void sitzungStarten;
      const { eroeffnung } = await import("../shared/fiaon-aras-prompt");
      const er = eroeffnung({ kiHinweisSatz: KI_HINWEIS_VORGABE, regie: (await arasEinstellungenLesen(true)).regie }, { anrede: "Herr", nachname: "Probe" } as any, "eingehend");
      ok("Rot-Probe eingehend: Aras meldet sich selbst (KI-Hinweis, „Worum geht's Ihnen?“) — dort wartet er nicht", /\bKI\b/.test(er.bisKi) && er.frage === "Worum geht's Ihnen?" && !/Kreditkarte/.test(er.bisKi));
    }
    // e) Live-Karte (Justin: „wenn ich auflege, läuft der Kasten mit ‚übernehmen‘ dennoch weiter“)
    {
      const { liveStromZeigen } = await import("../server/lib/fiaon-aras-ereignis");
      const strom: any[] = [];
      const hoerer = (e: any) => strom.push(e);
      ereignisBus().on("aras", hoerer);
      const g = await anruf19({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 4000 }] });
      await schlafen(2500);
      g.tw.aufhaengen();
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 12_000);
      await probeUrteil({ callId: g.callId, daumen: "runter", grund: "klingt nach KI", von: "Prüfstand" }).catch(() => null);
      await schlafen(300);
      ereignisBus().off("aras", hoerer);
      const meine = strom.filter((e) => Number(e.callId) === g.callId);
      const iEnde = meine.findIndex((e) => e.art === "ende");
      const danach = meine.slice(iEnde + 1);
      ok("Beim Ende genau EIN „ende“ mit callId — vor „aras_ende“", meine.filter((e) => e.art === "ende").length === 1 && iEnde >= 0 && meine[iEnde + 1]?.art === "aras_ende", meine.map((e) => e.art).join(","));
      ok("Danach (Prüfung, Daumen) nur noch mit nachEnde — der Live-Strom des KI-Raums lässt sie weg (kein neuer Kasten)", danach.slice(1).length > 0 && danach.slice(1).every((e) => e.nachEnde === true && !liveStromZeigen(e)), danach.map((e) => `${e.art}:${e.nachEnde}`).join(","));
      ok("Rot-Probe: während des Gesprächs zeigt der Live-Strom alles (kein nachEnde vor dem Ende)", meine.slice(0, iEnde).every((e) => liveStromZeigen(e)) && meine.slice(0, iEnde).length > 0);
      ok("Laufende Gespräche: der beendete Anruf ist weg", !laufendeSitzungen().some((l) => l.callId === g.callId));
    }
    // f) Aufnahme-Frage über zwei Zeilen (Rauchtest 20.10., Juni: „… dokumentiert“ — Pause — „is?“): zählt trotzdem
    {
      process.env.ARAS_EROEFFNUNG_SOFORT = "1";
      const g = await anruf19({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 600 }, { warteMs: 300 },
        { aras: "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert", ms: 400 }, { warteMs: 1200 }, { aras: "is?", ms: 200 }, { warteMs: 1200 },
        { kunde: "Ja, passt.", nachMs: 100 }, { warteMs: 2000 },
      ] });
      await warten(() => !!laufZahlen(g.callId)?.aufnahmeJa, 7000);
      ok("Aufnahme-Frage über zwei Zeilen („… dokumentiert“ + „is?“) gilt — sein Ja startet die Aufnahme", !!laufZahlen(g.callId)?.aufnahmeJa, JSON.stringify({ ja: laufZahlen(g.callId)?.aufnahmeJa }));
      await ende19(g);
      const g2 = await anruf19({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja.", nachMs: 600 }, { warteMs: 300 },
        { aras: "Alles klar, dann ohne Aufzeichnung — kein Problem", ms: 400 }, { warteMs: 1200 }, { aras: "Wofür möchten Sie die Karte vor allem nutzen?", ms: 300 }, { warteMs: 1200 },
        { kunde: "Ja, für Reisen.", nachMs: 100 }, { warteMs: 2000 },
      ] });
      await schlafen(6000);
      ok("Rot-Probe: „… ohne Aufzeichnung“ + eine andere Frage ist keine Aufnahme-Frage — sein „Ja“ startet nichts", !laufZahlen(g2.callId)?.aufnahmeJa);
      await ende19(g2);
    }
    // g) Menschliche Momente (Anruf 16: „da mal ein Lachen, dort mal ein Versprecher“): still gewinkt, verteilt, wechselnd —
    //    und erst, wenn der KUNDE zu reden beginnt (Rauchtest 20.10. abends: mitten in Aras' Rede hängte GPT-Live das Lachen
    //    sofort hinter seine Frage). Rot-Probe: Geht es in Aras' letzter Zeile um Geld, kommt kein Wink.
    {
      process.env.ARAS_EROEFFNUNG_SOFORT = "1";
      const skript = (satz: (i: number) => string, mitAufnahme = true) => {
        const schritte: any[] = [{ aras: KI_HINWEIS_VORGABE, ms: 300 }];
        // Die Aufnahme-Frage kommt früh — erst danach winkt die Brücke (Rauchtest: Lachen direkt vor der Aufnahme-Frage).
        if (mitAufnahme) schritte.push({ aras: "Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", ms: 300 }, { warteMs: 400 }, { kunde: "Ja, gerne.", nachMs: 300 }, { warteMs: 500 });
        for (let i = 0; i < 11; i++) schritte.push({ kunde: `Antwort ${i + 1}.`, nachMs: 400 }, { warteMs: 300 }, { aras: satz(i + 1), ms: 300 }, { warteMs: 500 });
        return schritte;
      };
      const zaehle = async (menschlich: string, lachen: string, satz: (i: number) => string = (i) => `Das ist mein Beitrag Nummer ${i} — ganz normal weiter.`, mitAufnahme = true) => {
        await einstellungSetzen("aras_menschlich", menschlich, "pruefstand");
        await einstellungSetzen("aras_lachen", lachen, "pruefstand");
        const g = await anruf19({ schritte: [...skript(satz, mitAufnahme), { warteMs: 1500 }] });
        await warten(() => false, 19_000);
        const winks = g.att.spur.eingeschoben.filter((x) => /^Menschlicher Moment/.test(x.text));
        const kundeAm = g.att.spur.kundeAm ?? [];
        await ende19(g);
        return { winks, kundeAm };
      };
      const { winks: normal, kundeAm } = await zaehle("normal", "an");
      const arten = normal.map((w) => /Lachen/.test(w.text) ? "lachen" : /Versprecher/.test(w.text) ? "versprecher" : /„Hm,“/.test(w.text) ? "hm" : "scherz");
      ok("normal: in zwölf Beiträgen zwei bis vier stille Winks (etwa alle drei bis fünf), still statt Anweisung", normal.length >= 2 && normal.length <= 4 && normal.every((w) => w.art === "still"), `${normal.length} Winks: ${arten.join(", ")}`);
      ok("… nie zweimal dieselbe Art hintereinander", arten.every((a, i) => i === 0 || a !== arten[i - 1]), arten.join(", "));
      ok("… jeder Wink kommt, wenn der Kunde zu reden beginnt (≤ 50 ms danach) — nie mitten in Aras' Rede", normal.every((w) => kundeAm.some((k) => (w.am ?? 0) >= k && (w.am ?? 0) - k <= 50)), normal.map((w) => Math.min(...kundeAm.map((k) => Math.abs((w.am ?? 0) - k)))).join(", ") + " ms");
      const wenig = (await zaehle("wenig", "aus")).winks;
      ok("Rot-Probe wenig + Lachen aus: höchstens ein Wink, nie ein Lachen", wenig.length <= 1 && wenig.every((w) => !/Lachen/.test(w.text)), `${wenig.length} Winks`);
      const geld = (await zaehle("viel", "an", (i) => `Es sind neunundfünfzig Euro neunundneunzig — Nummer ${i}.`)).winks;
      ok("Rot-Probe: Geht es in Aras' letzter Zeile um Geld (Euro), kommt auch bei „viel“ kein Wink", geld.length === 0, `${geld.length} Winks`);
      const ohneFrage = (await zaehle("viel", "an", undefined, false)).winks;
      ok("Rot-Probe: Solange die Aufnahme-Frage noch aussteht (erste Minute), kommt kein Wink — auch bei „viel“", ohneFrage.length === 0, `${ohneFrage.length} Winks`);
      await einstellungSetzen("aras_menschlich", "normal", "pruefstand");
      await einstellungSetzen("aras_lachen", "an", "pruefstand");
    }
    // h) Quittungs-Laut (Koordination 20.10. abends: „wie ein Mensch — aus 1,8 s werden gefühlt 0,5 s“): GPT-Live schweigt nach
    //    seinem Satz → nach ~550 ms ein kurzer Laut in Aras' Stimme aus der Bibliothek, dann GPT-Lives Antwort; die Stimme erfährt
    //    still, welcher Laut lief; die Zeile in der Akte beginnt damit. Nie auf ein Nein, nie, wenn GPT-Live schnell ist.
    {
      process.env.ARAS_EROEFFNUNG_SOFORT = "1";
      const { silben } = await import("./attrappen/anbieter-attrappe");
      const { lauteVergessen } = await import("../server/lib/fiaon-aras-laute");
      const { QUITTUNGEN } = await import("../shared/fiaon-aras");
      const ein = await arasEinstellungenLesen(true);
      const stimme = ein.stimme, akzent = ein.regie?.dialekt ?? "hochdeutsch";
      for (const wort of QUITTUNGEN) {
        const pcm = silben(260, -24);
        await sqlPool`INSERT INTO fiaon_aras_laut (stimme, dialekt, wort, pcm, ms, gesagt) VALUES (${stimme}, ${akzent}, ${wort}, ${Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)}, 260, ${wort.replace(/,$/, "")})
                      ON CONFLICT (stimme, dialekt, wort) DO NOTHING`;
      }
      lauteVergessen();
      const lautRahmen = (g: { tw: InstanceType<typeof TwilioAttrappe> }, von: number, bis: number) => g.tw.gespielt().filter((r) => TwilioAttrappe.dbfs(r.pcm) > -45 && r.start >= von && r.start < bis).length;
      // 1. Er sagt etwas, GPT-Live braucht 1,6 s
      {
        const g = await anruf19({ schritte: [
          { aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 1500 },
          { kunde: "Vor allem für Reisen.", nachMs: 100 }, { warteMs: 1600 },
          { aras: "Genau dafür ist Ihr Wunschlimit ideal.", ms: 400 }, { warteMs: 1500 },
        ] });
        await warten(() => (laufZahlen(g.callId)?.antwortMs.length ?? 0) >= 1, 9000);
        const z = laufZahlen(g.callId);
        const kundeAm = g.att.spur.kundeAm?.[0] ?? 0;
        const hinweis = g.att.spur.eingeschoben.find((x) => /^Du hast eben schon „(Mhm|Okay|Ja|Hm)“ gesagt/.test(x.text));
        ok("Quittung: GPT-Live schweigt → nach ~550 ms ein Laut (1×), die echte Antwort danach", z?.quittungen === 1 && lautRahmen(g, kundeAm + 450, kundeAm + 1300) > 0, JSON.stringify({ q: z?.quittungen, wort: z?.quittungWort, rahmen: lautRahmen(g, kundeAm + 450, kundeAm + 1300) }));
        ok("… gefühlt deutlich schneller als echt (erster Laut < GPT-Lives Antwort)", !!z && z.gefuehltMs.length >= 1 && z.antwortMs.length >= 1 && z.gefuehltMs[0] < z.antwortMs[0] - 500, JSON.stringify({ gefuehlt: z?.gefuehltMs, echt: z?.antwortMs }));
        ok("… die Stimme erfährt still, welcher Laut lief (fängt nicht noch einmal damit an)", !!hinweis && hinweis.art === "still", hinweis?.text.slice(0, 80) ?? "—");
        const zeile = busZeilen.filter((x) => x.callId === g.callId && x.wer === "aras").map((x) => x.text).find((t) => /Wunschlimit/.test(t)) ?? "";
        ok("… in Akte und Live-Karte beginnt Aras' Antwort mit dem Laut („Mhm, Genau dafür …“)", /^(Mhm|Okay|Ja|Hm), Genau dafür/.test(zeile), zeile);
        await ende19(g);
      }
      // 2. Rot-Probe: auf ein Nein nie ein Laut
      {
        const g = await anruf19({ schritte: [
          { aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 1500 },
          { kunde: "Nein, das will ich nicht.", nachMs: 100 }, { warteMs: 1600 },
          { aras: "Alles klar, kein Problem.", ms: 400 }, { warteMs: 1200 },
        ] });
        await warten(() => (laufZahlen(g.callId)?.antwortMs.length ?? 0) >= 1, 9000);
        ok("Rot-Probe: auf „Nein, das will ich nicht.“ kommt kein Laut", laufZahlen(g.callId)?.quittungen === 0, String(laufZahlen(g.callId)?.quittungen));
        await ende19(g);
      }
      // 3. Rot-Probe: GPT-Live ist schnell (nach 200 ms) — kein Laut davor
      {
        const g = await anruf19({ schritte: [
          { aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 1500 },
          { kunde: "Wie viel ist offen?", nachMs: 100 }, { warteMs: 200 },
          { aras: "Neunundfünfzig Euro neunundneunzig.", ms: 400 }, { warteMs: 1500 },
        ] });
        await warten(() => (laufZahlen(g.callId)?.antwortMs.length ?? 0) >= 1, 9000);
        ok("Rot-Probe: antwortet GPT-Live schnell, kommt kein Laut", laufZahlen(g.callId)?.quittungen === 0, String(laufZahlen(g.callId)?.quittungen));
        await ende19(g);
      }
      // 4. Zwei langsame Antworten hintereinander: zwei verschiedene Laute; nach einer Frage nie „Ja,“/„Okay,“
      {
        const g = await anruf19({ schritte: [
          { aras: KI_HINWEIS_VORGABE, ms: 300 }, { warteMs: 1500 },
          { kunde: "Ist mein Antrag schon genehmigt?", nachMs: 100 }, { warteMs: 1600 },
          { aras: "Noch nicht, es fehlt die erste Monatsrate.", ms: 400 }, { warteMs: 1500 },
          { kunde: "Verstehe, dann mache ich das heute.", nachMs: 100 }, { warteMs: 1600 },
          { aras: "Sehr gut, der Link kommt gleich.", ms: 400 }, { warteMs: 1500 },
        ] });
        await warten(() => (laufZahlen(g.callId)?.antwortMs.length ?? 0) >= 2, 12_000);
        const woerter = busZeilen.filter((x) => x.callId === g.callId && x.wer === "aras").map((x) => /^(Mhm|Okay|Ja|Hm),/.exec(x.text)?.[1]).filter(Boolean) as string[];
        ok("Zwei langsame Antworten: zwei Laute, nie derselbe hintereinander; nach der Frage „Mhm“/„Hm“ (nie „Ja“)", laufZahlen(g.callId)?.quittungen === 2 && woerter.length === 2 && woerter[0] !== woerter[1] && ["Mhm", "Hm"].includes(woerter[0]), woerter.join(", "));
        await ende19(g);
      }
      await sqlPool`DELETE FROM fiaon_aras_laut WHERE stimme = ${stimme} AND dialekt = ${akzent}`;
      lauteVergessen();
    }
    process.env.ARAS_EROEFFNUNG_SOFORT = "1";
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("20. FEEDBACK AUS PROBEANRUFEN (Justin 20.10., Punkte 4 und 5) — Aras hält es fest, Daumen-Gründe kommen dazu, „übernehmen“ hängt die Regel an die Hausanweisung; Probe-Transkript immer");
  {
    const { berlinTeile } = await import("../shared/fiaon-aras");
    const { werkzeugeFuer } = await import("../shared/fiaon-aras-prompt");
    const { feedbackListe, feedbackEntscheiden } = await import("../server/lib/fiaon-aras-nachbereitung");
    const { anweisungLesen, anweisungSetzen } = await import("../server/lib/fiaon-mara-anweisung");
    const nacht = (() => { const h = berlinTeile(new Date()).hhmm; return h < "07:00" || h >= "23:00"; })();
    process.env.ARAS_EROEFFNUNG_SOFORT = "1";
    await einstellungSetzen("aras_stufe", "3", "pruefstand");
    const hausVorher = await anweisungLesen("telefon");
    const hat = (w: { name: string }[]) => w.some((x) => x.name === "probe_feedback_merken");
    ok("Werkzeug nur im Probeanruf: im Kundenanruf fehlt probe_feedback_merken, im Probeanruf ist es da",
      !hat(werkzeugeFuer({ global: false, isBlocked: false, ampel: {}, spielart: "zuruf" })) && hat(werkzeugeFuer({ global: false, isBlocked: false, ampel: {}, spielart: "probe" })) && hat(werkzeugeFuer({ global: false, isBlocked: false, ampel: {}, spielart: "zuruf", probe: true })));
    if (nacht) ok("Nachts (vor 7 / ab 23 Uhr): Probeanruf-Teil übersprungen (Probeanrufe nur 7–23 Uhr)", true);
    else {
      const att = attrappeMitSkript({ schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 200 }, { kunde: "Sprich FIAON bitte richtig aus und sei direkter." },
        { werkzeug: "probe_feedback_merken", eingabe: { text: "FIAON richtig aussprechen und direkter sein", regel: "Sprich FIAON als ein Wort, mitten im Satz — und komm gleich zur Sache.", art: "aussprache" } },
        { werkzeug: "probe_feedback_merken", eingabe: { text: "FIAON richtig aussprechen und direkter sein", regel: "doppelt", art: "aussprache" } },
        { aras: "Ah, guter Punkt — danke, merk ich mir!", ms: 200 },
        { kunde: "Und sag weniger oft Super." },
        { werkzeug: "probe_feedback_merken", eingabe: { text: "Weniger oft Super sagen", regel: "Sag „Super“ höchstens zweimal im Gespräch.", art: "ton" } },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Probe Feedback" } },
      ] });
      adapterSetzen("attrappe", att);
      const r = await probeanruf({ spielart: "zuruf", von: "pruefstand" });
      ok("Probeanruf gewählt", r.ok && !!r.callId, r.grund);
      if (r.callId) {
        const tw = new TwilioAttrappe({ url: wsUrl, anrufId: r.callId, t: streamToken(r.callId) });
        await tw.start();
        await warten(async () => !!(await anruf(r.callId!))?.nachbereitet_am, 12_000);
        tw.aufhaengen();
        const a = await anruf(r.callId);
        const fb = (await sqlPool`SELECT text, regel, art, quelle, status FROM fiaon_aras_feedback WHERE aras_anruf_id = ${a.id} ORDER BY id`) as any[];
        ok("probe_feedback_merken: zwei Punkte (derselbe doppelt → einmal), in Justins Worten, mit Regel und Art, offen",
          fb.length === 2 && fb[0].art === "aussprache" && /Sprich FIAON als ein Wort/.test(String(fb[0].regel)) && fb[1].art === "ton" && fb.every((f) => f.quelle === "telefon" && f.status === "offen"), JSON.stringify(fb).slice(0, 220));
        ok("Probe-Transkript gespeichert — ohne Aufzeichnung, gekennzeichnet „probe“ (Punkt 5)",
          Array.isArray(a.transkript) && a.transkript.length >= 3 && a.transkript_grund === "probe" && !a.aufnahme_gestartet_am, `${a.transkript?.length} Zeilen · ${a.transkript_grund}`);
        const u = await probeUrteil({ callId: r.callId, daumen: "runter", grund: "zu langsam · Begrüßung holprig · wiederholt sich", von: "pruefstand" });
        await probeUrteil({ callId: r.callId, daumen: "runter", grund: "zu langsam", von: "pruefstand" });
        const fd = (await sqlPool`SELECT text, regel, art, daumen FROM fiaon_aras_feedback WHERE aras_anruf_id = ${a.id} AND quelle = 'daumen' ORDER BY id`) as any[];
        ok("Daumen-Gründe → je ein Punkt mit Regel („zu langsam“ → „Antworte schneller …“); ein zweiter Klick legt nichts doppelt an",
          u.ok && fd.length === 3 && fd.every((f) => f.daumen === "runter") && /Antworte schneller/.test(String(fd.find((f) => f.text === "zu langsam")?.regel ?? "")) && /Sag nichts zweimal/.test(String(fd.find((f) => /wiederholt/i.test(f.text))?.regel ?? "")), JSON.stringify(fd).slice(0, 240));
        // Liste (GET /chef/aras/probe/feedback) — der Vertrag mit der Oberfläche (ArasFeedback)
        const l1 = await feedbackListe();
        const vertrag = l1.every((z) => Number.isInteger(z.id) && typeof z.text === "string" && !!z.text && ["offen", "uebernommen", "verworfen"].includes(z.status)
          && (z.vorschlag === null || typeof z.vorschlag === "string") && typeof z.anzahl === "number" && (z.daumen === null || z.daumen === "hoch" || z.daumen === "runter") && typeof z.am === "string");
        ok("Liste: Vertrag { id, text, vorschlag, am, status, daumen, anzahl } — fünf Punkte offen, „Daumen runter“ dabei",
          vertrag && l1.filter((z) => z.status === "offen").length >= 5 && l1.some((z) => z.daumen === "runter"), `${l1.length} Zeilen`);
        // … und so, wie die Oberfläche sie liest (ArasFeedback › feedbackLesen): alle Punkte, Text, Vorschlag, Status, Daumen, Anrufe
        const { feedbackLesen } = await import("../client/src/components/admin/aras/aras-texte");
        const ui = feedbackLesen({ ok: true, zeilen: l1 });
        const fiaonUi = ui.find((p) => /FIAON richtig/.test(p.text));
        ok("Die Oberfläche liest die Liste vollständig (feedbackLesen): Text + Vorschlag (Regel), offen, Daumen, Zahl der Probeanrufe",
          ui.length === l1.length && !!fiaonUi && /Sprich FIAON als ein Wort/.test(fiaonUi.vorschlag ?? "") && fiaonUi.status === "offen" && ui.some((p) => p.daumen === "runter" && (p.anrufe ?? 0) >= 1), JSON.stringify(fiaonUi));
        // Derselbe Punkt aus einem weiteren Probeanruf: EINE Zeile, anzahl + 1 (je Probeanruf einmal gezählt)
        const vorher = (await feedbackListe()).find((z) => z.text === "zu langsam" && z.status === "offen")?.anzahl ?? 0;
        await sqlPool`INSERT INTO fiaon_aras_feedback (aras_anruf_id, call_id, text, regel, art, quelle, daumen) VALUES (${Number(a.id) + 900_000}, ${r.callId}, 'zu langsam', 'Antworte schneller: ohne Anlauf, gleich mit der Sache.', 'tempo', 'daumen', 'runter')`;
        const l2 = await feedbackListe();
        const langsam = l2.filter((z) => z.text === "zu langsam" && z.status === "offen");
        ok("Derselbe Punkt aus einem weiteren Probeanruf: einmal in der Liste, anzahl eins mehr", vorher >= 1 && langsam.length === 1 && langsam[0].anzahl === vorher + 1, JSON.stringify({ vorher, langsam }));
        // Übernehmen → Regel an die Hausanweisung „telefon“; verwerfen → die Anweisung bleibt
        const fiaonZ = l2.find((z) => /FIAON richtig/.test(z.text));
        const ue = fiaonZ ? await feedbackEntscheiden({ id: fiaonZ.id, was: "uebernehmen", von: "pruefstand" }) : { ok: false as const, status: 0, fehler: "fehlt" };
        const haus1 = await anweisungLesen("telefon");
        ok("Übernehmen: die Regel steht als neue Zeile in der Hausanweisung „Aras am Telefon“ (was vorher drin stand, bleibt)",
          ue.ok && haus1.includes("· Sprich FIAON als ein Wort, mitten im Satz — und komm gleich zur Sache.") && haus1.includes(hausVorher.trim()), haus1.slice(-160));
        const nochmal = fiaonZ ? await feedbackEntscheiden({ id: fiaonZ.id, was: "uebernehmen", von: "pruefstand" }) : null;
        ok("… ein zweites Übernehmen: 409 „Schon übernommen“ — nichts doppelt in der Anweisung",
          !!nochmal && !nochmal.ok && nochmal.status === 409 && (await anweisungLesen("telefon")).split("Sprich FIAON als ein Wort").length === 2, JSON.stringify(nochmal));
        const vw = await feedbackEntscheiden({ id: langsam[0]?.id ?? 0, was: "verwerfen", von: "pruefstand" });
        const l3 = await feedbackListe();
        ok("Verwerfen: „zu langsam“ aus allen Probeanrufen verworfen (eine Zeile, dieselbe anzahl), die Hausanweisung unverändert",
          vw.ok && l3.some((z) => z.text === "zu langsam" && z.status === "verworfen" && z.anzahl === vorher + 1) && !l3.some((z) => z.text === "zu langsam" && z.status === "offen") && (await anweisungLesen("telefon")) === haus1, JSON.stringify(l3.filter((z) => z.text === "zu langsam")));
        const quatsch = await feedbackEntscheiden({ id: fiaonZ?.id ?? 1, was: "loeschen", von: "pruefstand" });
        const nix = await feedbackEntscheiden({ id: 99_999_999, was: "verwerfen", von: "pruefstand" });
        const krumm = await feedbackEntscheiden({ id: -1, was: "verwerfen", von: "pruefstand" });
        ok("Rot-Probe: anderes Wort → 404, unbekannte Nummer → 404, krumme Nummer → 400",
          !quatsch.ok && quatsch.status === 404 && !nix.ok && nix.status === 404 && !krumm.ok && krumm.status === 400);
      }
    }
    // Rot-Probe Kundenanruf: Ruft das Modell das Werkzeug trotzdem, wird es abgewiesen (nur_probe) — kein Punkt; ohne Ja kein Transkript
    {
      const pid = await person(140); await antrag(pid, 140, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: "+4917000000140", spielart: "zusage", grund: "Prüfstand Feedback Kunde", erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      const g = await gespraech(Number(e.id), { schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 200 }, { kunde: "Sprich bitte langsamer." },
        { werkzeug: "probe_feedback_merken", eingabe: { text: "Langsamer sprechen", regel: "Sprich langsamer.", art: "tempo" } },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Kunde" } },
      ] });
      await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 12_000);
      g.tw.aufhaengen();
      const a = await anruf(g.callId);
      const w = g.att.spur.werkzeuge.find((x) => x.name === "probe_feedback_merken");
      const n = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_feedback WHERE aras_anruf_id = ${a.id}`) as any[])[0]?.n ?? 0);
      ok("Rot-Probe Kundenanruf: probe_feedback_merken abgewiesen (nur_probe), kein Punkt — und ohne Ja kein Transkript",
        !!w && !w.ergebnis.ok && w.ergebnis.fehler === "nur_probe" && n === 0 && a.transkript == null && a.transkript_grund == null, `${JSON.stringify(w?.ergebnis)} · ${n} · ${a.transkript_grund}`);
    }
    if ((await anweisungLesen("telefon")) !== hausVorher) await anweisungSetzen("telefon", hausVorher, "pruefstand");
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
  server.close();
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht === 0 ? 0 : 1);
}

main().catch(async (err) => { console.error("ABBRUCH:", err); process.exit(2); });
