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
  // So weit wie erlaubt (Go-live: bis 21:00, Sonntag als „7“), damit der Prüfstand zu möglichst jeder Tageszeit wählen kann.
  await einstellungSetzen("aras_fenster", JSON.stringify({ verkauf: { "1-7": ["08:00", "21:00"] }, rate: { "1-7": ["08:00", "21:00"] } }), "pruefstand");
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
  // Tage immer in BERLIN (Koordination 21.10.: der Prüfstand muss zu jeder Uhrzeit grün sein — zwischen 00:00 und 02:00 war
  // „gestern“ in UTC noch vorgestern in Berlin).
  const heute = new Date(); const yyyy = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const vor = (tage: number) => { const d = new Date(`${yyyy(new Date())}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - tage); return d.toISOString().slice(0, 10); };
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
  // Justin 20.10.2026 („nur Vertragskunden“, jede Stufe): ein Interessent mit Ja per WhatsApp wird trotzdem NIE eingereiht.
  ok("P3 (Interessent mit Ja per WhatsApp) NICHT eingereiht — Zuruf ist im Code gesperrt (nur Vertragskunden)", !plan.some((z) => Number(z.person_id) === p3));
  ok("P4 (Werbesperre) NICHT eingereiht", !hat(p4, "zuruf"));
  ok("P5 Zusage nachfassen eingereiht", hat(p5, "zusage"));
  ok("P6 (Testperson) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p6));
  ok("P7 (CH ohne eingetragene Nummer) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p7));
  ok("P8 (Rate nach Vertragsende) NICHT eingereiht", !plan.some((z) => Number(z.person_id) === p8));
  const f2 = await planFuellen();
  const [n1] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE person_id = ${p1} AND status = 'wartet'`) as any[];
  ok("Zweiter Füller-Lauf reiht nichts doppelt ein", f2.eingereiht.rate == null && Number(n1?.n) === 1, `${JSON.stringify(f2.eingereiht)} / ${n1?.n}`);
  const lage = await planLage();
  ok("planLage: wartet ≥ 3 (Rate, Stufe A, Zusage), nächste 20 mit Namen", lage.wartet >= 3 && lage.naechste.length >= 3 && lage.naechste[0].name.length > 0, `${lage.wartet} / ${lage.naechste.length}`);
  const chefEinreihen = await planEinreihen({ personId: p4, nummer: "+491700000004", spielart: "rate", grund: "Chef", erzeugtVon: "chef" });
  ok("Chef reiht Vertragssache (rate) trotz Werbesperre ein", chefEinreihen.ok, chefEinreihen.grund);
  const sperreVersuch = await planEinreihen({ personId: p4, nummer: "+491700000004", spielart: "zuruf", grund: "Chef", erzeugtVon: "chef" });
  ok("Werbe-Spielart wird abgelehnt (gesperrt – nur Vertragskunden)", !sperreVersuch.ok && /gesperrt – nur Vertragskunden/.test(sperreVersuch.grund ?? ""), sperreVersuch.grund ?? "");

  titel("3. WÄNDE DES WÄHLERS");
  adapterSetzen("attrappe", attrappeMitSkript({ schritte: [] }));
  await einstellungSetzen("aras_an", "aus", "pruefstand");
  let t = await waehlerTakt();
  ok("aras_an = aus → nichts gewählt, Grund aras_aus", t.gewaehlt === 0 && t.ausgelassen.some((a) => a.grund === "aras_aus"));
  await einstellungSetzen("aras_an", "an", "pruefstand");
  await einstellungSetzen("aras_tag_euro", "0", "pruefstand");
  await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe', 0, 0, 0, 0, 1, TRUE)`;
  // „Zusage nachfassen“ (P5) hat seit 22.10. Vorrang und ginge am Deckel vorbei — für diese Probe kurz geparkt (Abschnitt 28 prüft den Vorrang).
  await sqlPool`UPDATE fiaon_aras_plan SET frueh_ab = frueh_ab + INTERVAL '1 day' WHERE person_id = ${p5} AND spielart = 'zusage' AND status = 'wartet'`;
  t = await waehlerTakt();
  ok("Deckel 0 € → Grund deckel", t.gewaehlt === 0 && t.ausgelassen.some((a) => a.grund === "deckel"), JSON.stringify(t.ausgelassen));
  await sqlPool`UPDATE fiaon_aras_plan SET frueh_ab = frueh_ab - INTERVAL '1 day' WHERE person_id = ${p5} AND spielart = 'zusage' AND status = 'wartet'`;
  await einstellungSetzen("aras_tag_euro", "60", "pruefstand");
  await einstellungSetzen("aras_notaus", "an", "pruefstand");
  t = await waehlerTakt();
  ok("Notaus → Grund notaus", t.ausgelassen.some((a) => a.grund === "notaus"));
  await einstellungSetzen("aras_notaus", "aus", "pruefstand");
  // Versuche je Person: P2 hatte heute schon einen Mitarbeiter-Anruf
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von) VALUES (${p2}, ${ausweis}, '+491700000002', 'raus', 'beendet', GREATEST(NOW() - INTERVAL '3 hours', (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') + INTERVAL '1 minute') AT TIME ZONE 'Europe/Berlin'), 'CA-pruef-mensch', 'mensch')`;
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
    // Ein frischer Vertragskunde (Zuruf an Interessenten ist seit 20.10. gesperrt — nur Vertragskunden)
    const pAmd = await person(9); await antrag(pAmd, 9, { payment_status: "paid" });
    const neu = await planEinreihen({ personId: pAmd, nummer: "+491700000009", spielart: "zusage", grund: "Prüfstand AMD", erzeugtVon: "chef" });
    if (!neu.ok) throw new Error(`AMD-Eintrag: ${neu.grund}`);
    const [pl3] = (await sqlPool`SELECT id FROM fiaon_aras_plan WHERE person_id = ${pAmd} AND spielart = 'zusage' AND status = 'wartet'`) as any[];
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
    // Nach 23 Uhr greift zuerst die Nachtruhe der Probe (7 bis 23 Uhr) — dann zählt dieselbe Ablehnung.
    const nachtRuhe = (() => { const h = new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }); return h < "07:00" || h >= "23:00"; })();
    ok("Tagesdeckel erreicht → kein Probeanruf", !rd.ok && (/Tagesdeckel/.test(rd.grund ?? "") || (nachtRuhe && /7 bis 23/.test(rd.grund ?? ""))), rd.grund);
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
      // Go-live (Justin 20.10. abends): „Ich grüße Sie, Herr …, ARAS spricht hier, die digitale Mitarbeiterin von FIAON [KI-Hinweis + Lachen] …“ —
      // Auswertung 21./22.10.: danach die Frage nach der PERSON; der Grund (Kreditkarte) erst nach seinem Ja.
      const gt = gruss?.text ?? "";
      const iKi = gt.indexOf("KI"), iLachen = gt.indexOf(LACHEN_NACH_KI), iFrage = gt.search(/Spreche ich mit Herrn Prüfkunde\d+ selbst\?/);
      ok("Begrüßung nachgeschoben (als „vorlesen“ — bringt eine stumme Sitzung sicher zum Sprechen): Name → „die digitale Mitarbeiterin“ → KI-Hinweis → kurzes Lachen → „Spreche ich mit Herrn … selbst?“ (kein Anliegen davor)",
        !!gruss && gruss.art === "vorlesen" && /, Herr Prüfkunde\d+!/.test(gt) && /die digitale Mitarbeiterin von FIAON/.test(gt) && iKi > 0 && iLachen > iKi && iFrage > iLachen && !/Kreditkarten/.test(gt), gt.slice(0, 420) || "—");
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
    // Justin 20.10.2026, 21:55: „Nein, nur Vertragskunden“ — Interessenten schreibt Mara (auch mit Ja zum Anruf).
    const { KEIN_VERTRAG_SATZ, KEIN_VERTRAG_MEHR_SATZ } = await import("../shared/fiaon-aras");
    ok("Interessent ohne Vertrag: genau der eine Satz („Noch kein Vertrag – ARAS ruft nur Kunden mit Vertrag an. Mara schreibt stattdessen.“)", lage22?.geht.ok === false && lage22?.geht.grund === KEIN_VERTRAG_SATZ && !/Ja zum Anruf|bis dahin/.test(lage22?.geht.grund ?? ""), lage22?.geht.grund ?? "");
    await einwilligungMerken({ personId: p22, nummer: "+491700000032", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef-akte-ja" });
    const lage22ja = await arasAkteLage(p22, betreuer);
    const auftragLead = await arasAuftragGeben(p22, { auftrag: "Bitte zum Antrag anrufen." }, betreuer);
    const direktLead = await planEinreihen({ personId: p22, nummer: "+491700000032", spielart: "auftrag", grund: "Prüfstand", erzeugtVon: "akte" });
    ok("Rot-Probe: Interessent MIT Ja zum Anruf → trotzdem nicht (Akte UND Warteschlange sagen denselben Satz)", lage22ja?.geht.grund === KEIN_VERTRAG_SATZ && !auftragLead.ok && !direktLead.ok && direktLead.grund === KEIN_VERTRAG_SATZ, JSON.stringify({ a: lage22ja?.geht.grund, b: auftragLead.grund, c: direktLead.grund }));
    const p23 = await person(38); const r23 = await antrag(p23, 38, { payment_status: "paid" });
    await sqlPool`UPDATE fiaon_applications SET gekuendigt_am = NOW() - INTERVAL '60 days', vertrag_ende_am = NOW() - INTERVAL '20 days' WHERE ref = ${r23}`;
    ok("Ehemaliger Kunde (Vertrag beendet, nichts offen) → „Kein laufender Vertrag mehr – …“", (await arasAkteLage(p23, betreuer))?.geht.grund === KEIN_VERTRAG_MEHR_SATZ, (await arasAkteLage(p23, betreuer))?.geht.grund ?? "");
    const p24 = await person(39); const r24 = await antrag(p24, 39, { payment_status: "pending_payment" });
    await sqlPool`INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, paket, rate_cents, gesamt_cents, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn, vertrag_html, vertrag_sha256)
                  VALUES (${r24}, ${p24}, 'neu', NOW() - INTERVAL '2 hours', 'plus', 5999, 71988, 'PV-test', 'L-test', 'AGB-test', 'Zahlungspflichtig annehmen', '{}'::jsonb, FALSE, '<p>Test</p>', 'test')`;
    ok("Unterschrieben, noch nicht bezahlt = Kunde mit Vertrag → ARAS darf", (await arasAkteLage(p24, betreuer))?.geht.ok === true, (await arasAkteLage(p24, betreuer))?.geht.grund ?? "");

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
    await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", stufe_a: "an", rate: "an", zusage: "an", auftrag: "an", probe: "an" }), "pruefstand");
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
    // Go-live C (20.10.2026): Rate offen Tag 1–45 — Tag 20 wird eingereiht, Tag 50 nie (danach übernimmt das Team).
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rR5}, 2, ${`${rR5}-2`}, 5999, ${vor(50)}::date, 'offen')`;
    const pR20 = await person(468); const rR20 = await antrag(pR20, 468, { payment_status: "paid" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rR20}, 2, ${`${rR20}-2`}, 5999, ${vor(20)}::date, 'offen')`;
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

    // b) Stufe 1 „Test“ (Go-live): Gleichzeitig 1, Deckel 20 €, 40 je Tag, nur Rückrufe/Willkommen/Auftrag/Stufe A/Rate an Tag 1–3
    await einstellungSetzen("aras_stufe", "1", "pruefstand");
    const g1 = stufenGrenzen(await arasEinstellungenLesen(true));
    ok("Stufe 1 (Go-live): das Engere gilt — Gleichzeitig 1 (Schalter 3), Deckel 20 € (Schalter 60), 40 Versuche je Tag", g1.parallel === 1 && g1.tagEuro === 20 && g1.versucheJeTag === 40, JSON.stringify({ p: g1.parallel, e: g1.tagEuro, v: g1.versucheJeTag }));
    ok("Stufe 1: Zuruf, Zusage, Lead nicht erlaubt; Termin, Willkommen, Auftrag, Stufe A, Rate erlaubt", !g1.spielartErlaubt("zuruf") && !g1.spielartErlaubt("zusage") && !g1.spielartErlaubt("lead") && ["termin", "willkommen", "auftrag", "stufe_a", "rate"].every((x) => g1.spielartErlaubt(x as any)));
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const f1 = await planFuellen();
    const plan1 = (await sqlPool`SELECT person_id, spielart FROM fiaon_aras_plan WHERE status = 'wartet'`) as any[];
    ok("Stufe 1 (Füller): Rate Tag 2 ja, Tag 20 ja (Tag 1–45), Tag 50 nein, kein Zuruf", plan1.some((z) => Number(z.person_id) === pR2 && z.spielart === "rate") && plan1.some((z) => Number(z.person_id) === pR20 && z.spielart === "rate") && !plan1.some((z) => Number(z.person_id) === pR5) && !plan1.some((z) => z.spielart === "zuruf"), `Tag 2 = ${pR2}, Tag 20 = ${pR20}, Tag 50 = ${pR5} · ${JSON.stringify(f1)} · ${JSON.stringify(plan1.map((z) => `${z.person_id}:${z.spielart}`))}`);
    // Takt: Zuruf und Rate Tag 5 bleiben liegen — auch wenn ein Mensch sie von Hand eingereiht hat
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const zuVonHand = await planEinreihen({ personId: pZw, nummer: "+491700000063", spielart: "zuruf", grund: "Prüfstand Stufe 1 Zuruf", erzeugtVon: "chef" });
    ok("Rot-Probe: Zuruf von Hand eingereiht → abgelehnt (gesperrt – nur Vertragskunden)", !zuVonHand.ok && /gesperrt – nur Vertragskunden/.test(zuVonHand.grund ?? ""), zuVonHand.grund ?? "");
    // Ein alter Zuruf-Eintrag (von vor der Sperre) fällt beim Takt aus der Reihe — nie gewählt
    await sqlPool`INSERT INTO fiaon_aras_plan (person_id, nummer, land, spielart, prioritaet, grund, rechtsgrund, frueh_ab, spaet_bis, erzeugt_von)
                  VALUES (${pZw}, '+491700000063', 'DE', 'zuruf', 2, 'Altlast vor der Sperre', 'einwilligung', NOW() - INTERVAL '1 minute', NOW() + INTERVAL '4 hours', 'chef')`;
    await planEinreihen({ personId: pR5, nummer: "+491700000062", spielart: "rate", grund: "Prüfstand Stufe 1 Tag 50", erzeugtVon: "chef", anlassAm: new Date(`${vor(50)}T10:00:00Z`) });
    const t1 = await waehlerTakt();
    const [alt1] = (await sqlPool`SELECT status, verschoben_grund FROM fiaon_aras_plan WHERE person_id = ${pZw} AND spielart = 'zuruf' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Stufe 1 (Takt): alter Zuruf → „gesperrt“ (nie gewählt), Rate Tag 50 bleibt liegen (stufe:rate_tag) — 0 gewählt", t1.gewaehlt === 0 && t1.ausgelassen.some((a) => a.grund === "gesperrt:zuruf") && t1.ausgelassen.some((a) => a.grund === "stufe:rate_tag") && alt1?.status === "gesperrt" && /nur Vertragskunden/.test(String(alt1?.verschoben_grund)), JSON.stringify({ t1, alt1 }));
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
    // Tagesmenge 40 voll → kein Wählen (der Stunden-Deckel — Vorgabe 40 — darf hier nicht zuerst greifen)
    await einstellungSetzen("aras_je_stunde", "120", "pruefstand");
    await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von) SELECT ${pR2}, ${ausweis}, '+491700000061', 'raus', 'beendet', NOW(), 'aras' FROM generate_series(1, 40)`;
    await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version) SELECT c.id, 'rate', '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand' FROM fiaon_calls c WHERE c.gefuehrt_von = 'aras' AND c.status = 'beendet' AND c.person_id = ${pR2} AND NOT EXISTS (SELECT 1 FROM fiaon_aras_anruf x WHERE x.call_id = c.id)`;
    const t1m = await waehlerTakt();
    ok("Stufe 1: nach 40 Kundenanrufen heute ist Schluss (Grund stufe_tagesmenge:40)", t1m.gewaehlt === 0 && t1m.ausgelassen.some((a) => a.grund === "stufe_tagesmenge:40"), JSON.stringify(t1m));
    await einstellungSetzen("aras_je_stunde", "40", "pruefstand");
    await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND person_id = ${pR2} AND status = 'beendet')`;
    await sqlPool`DELETE FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND person_id = ${pR2} AND status = 'beendet'`;
    // Deckel 20 € (auch wenn der Schalter 60 € sagt)
    await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe-stufe', 0, 0, 0, 0, 2100, TRUE)`;
    const t1d = await waehlerTakt();
    ok("Stufe 1: Deckel 20 € greift, obwohl der Schalter 60 € erlaubt (Grund deckel)", t1d.gewaehlt === 0 && t1d.ausgelassen.some((a) => a.grund === "deckel"), JSON.stringify(t1d));
    await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell = 'attrappe-stufe'`;

    // c) Stufe 2 „Leise“: Zuruf nur mit JA per Nachricht — das Antrag-Kästchen erst ab Stufe 3
    await einstellungSetzen("aras_stufe", "2", "pruefstand");
    const g2 = stufenGrenzen(await arasEinstellungenLesen(true));
    ok("Stufe 2: Gleichzeitig 2, Deckel 60 €, 150 je Tag — nur mehr Menge: KEIN Zuruf, kein Lead (nur Vertragskunden)", g2.parallel === 2 && g2.tagEuro === 60 && g2.versucheJeTag === 150 && !g2.spielartErlaubt("zuruf") && !g2.spielartErlaubt("lead"));
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    // Ein frisches WhatsApp-JA (das von oben ist schon „verbraucht“: ein Ja = ein Anruf)
    const pZw2 = await person(67); await antrag(pZw2, 67, { payment_status: "pending_payment" });
    await einwilligungMerken({ personId: pZw2, nummer: "+491700000067", art: "zuruf_whatsapp", wortlaut: "JA", quelleArt: "whatsapp", quelleId: "pruef67" });
    await planFuellen();
    const plan2 = (await sqlPool`SELECT person_id, spielart FROM fiaon_aras_plan WHERE status = 'wartet' AND spielart = 'zuruf'`) as any[];
    ok("ROT-PROBE Stufe 2 (Füller): auch mit WhatsApp-JA und Antrag-Kästchen KEIN Zuruf — 0 Werbe-Gesprächsarten", plan2.length === 0, JSON.stringify(plan2));

    // Takt: ein von Hand eingereihter Zuruf mit Antrag-Kästchen bleibt in Stufe 2 liegen
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const ek = await planEinreihen({ personId: pZk, nummer: "+491700000064", spielart: "zuruf", grund: "Prüfstand Stufe 2 Kästchen", erzeugtVon: "chef" });
    const t2 = await waehlerTakt();
    log(`  Stufe 2, Zuruf mit Kästchen: eingereiht=${ek.ok}${ek.grund ? ` (${ek.grund})` : ""} · Takt ${JSON.stringify(t2)}`);
    ok("Rot-Probe Stufe 2: Zuruf mit Antrag-Kästchen von Hand → abgelehnt (gesperrt – nur Vertragskunden), 0 gewählt", !ek.ok && /gesperrt – nur Vertragskunden/.test(ek.grund ?? "") && t2.gewaehlt === 0, `${ek.grund ?? ""} · ${JSON.stringify(t2)}`);
    await aufraeumen();

    // d) Stufe 3: Obergrenzen fest (430 je Tag, höchstens 5 gleichzeitig, 150 €) — nie mehr, auch wenn der Schalter mehr will
    ok("Stufe 3: 430 je Tag, Gleichzeitig ≤ 5, Deckel ≤ 150 €", STUFEN[3].versucheJeTag === 430 && STUFEN[3].parallel === 5 && STUFEN[3].tagEuro === 150);
    // ROT-PROBE (Justin 20.10.2026, „nur Vertragskunden“ in jeder Stufe): Stufe 3 automatisch — Interessenten mit Ja, Kästchen,
    // frischem Antrag sind da — und trotzdem kein einziger Werbe-Eintrag.
    await einstellungSetzen("aras_stufe", "3", "pruefstand");
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    const f3 = await planFuellen();
    const werbe3 = (await sqlPool`SELECT spielart, COUNT(*)::int AS n FROM fiaon_aras_plan WHERE status = 'wartet' AND spielart IN ('zuruf', 'lead', 'stufe_b', 'rueckholung') GROUP BY 1`) as any[];
    ok("ROT-PROBE Stufe 3 (Füller): 0 Werbe-Gesprächsarten — Stufe 3 bringt nur mehr Menge", werbe3.length === 0 && !Object.keys(f3.eingereiht).some((k) => ["zuruf", "lead", "stufe_b", "rueckholung"].includes(k)), JSON.stringify({ werbe3, f3: f3.eingereiht }));
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
      ok("Vorab: die Eröffnung gleich beim Start als „vorlesen“ (KI-Hinweis, Frage nach der Person) — keine developer-Nachricht, Eingang stumm", !!vorab && /Spreche ich mit Herrn Prüfkunde\d+ selbst\?/.test(vorab.text) && /\bKI\b/.test(vorab.text) && (vorab.am ?? 0) - t0 < 900 && g.att.spur.begruessung === null && g.att.spur.stumm === true, `${vorab ? (vorab.am ?? 0) - t0 : "—"} ms nach Start · ${vorab?.text.slice(0, 60) ?? "—"}`);
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
      ok("Er schweigt: nach ~2 s kommt die Eröffnung (als „vorlesen“, mit KI-Hinweis und der Frage nach der Person)", !!gruss && gruss.art === "vorlesen" && dauer >= 1500 && dauer <= 3200 && /Spreche ich mit Herrn Prüfkunde\d+ selbst\?/.test(gruss.text) && /\bKI\b/.test(gruss.text), `${dauer} ms · ${gruss?.text.slice(0, 80) ?? "—"}`);
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

  let nr19b = 150;
  titel("21. AUFLEGEN, WÄHREND ES KLINGELT (Koordination 20.10.) — Twilio bricht ab („canceled“), statt weiterzuklingeln");
  {
    const { twilioClientSetzen } = await import("../server/lib/fiaon-aras-twilio-client");
    const { sitzungBeenden, vorbereiten } = await import("../server/lib/fiaon-aras-bruecke");
    const auftraege: { sid: string; status: string }[] = [];
    twilioClientSetzen({ calls: (sid: string) => ({ update: async (o: { status: string }) => { auftraege.push({ sid, status: o.status }); return {}; } }) });
    try {
      // a) Keine Sitzung (aras_vorbereiten = abheben): Justin drückt „Auflegen“ → canceled
      const [c1] = (await sqlPool`INSERT INTO fiaon_calls (agent_id, nummer, richtung, status, beginn, twilio_sid, gefuehrt_von) VALUES (${ausweis}, '+491700000141', 'raus', 'gewaehlt', NOW(), 'CA-pruef-klingelt-1', 'aras') RETURNING id`) as any[];
      if (c1?.id) {
        await sitzungBeenden(Number(c1.id), "Chefbüro");
        ok("Keine Sitzung, es klingelt: „Auflegen“ bricht den Anruf bei Twilio ab (canceled)", auftraege.some((a) => a.sid === "CA-pruef-klingelt-1" && a.status === "canceled"), JSON.stringify(auftraege));
        const vorher = auftraege.length;
        await sitzungBeenden(Number(c1.id), "kunde_aufgelegt");
        ok("Rot-Probe: ein anderer Grund (Twilio meldet selbst das Ende) bricht nichts ab", auftraege.length === vorher, JSON.stringify(auftraege));
        await sqlPool`UPDATE fiaon_calls SET ende = NOW() WHERE id = ${Number(c1.id)}`;
        await sitzungBeenden(Number(c1.id), "chef");
        ok("Rot-Probe: ein schon beendeter Anruf wird nie noch einmal abgebrochen", auftraege.length === vorher, JSON.stringify(auftraege));
      } else ok("(fiaon_calls-Zeile für den Abbruch-Test nicht anlegbar — übersprungen)", true);
      // b) Beim Klingeln vorbereitet, nie abgenommen: „Auflegen“ beendet die Sitzung UND bricht bei Twilio ab
      await einstellungSetzen("aras_stufe", "3", "pruefstand");
      nr19b += 1;
      const pid = await person(nr19b); await antrag(pid, nr19b, { payment_status: "paid" });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${nr19b}`, spielart: "zusage", grund: "Prüfstand Abbruch beim Klingeln", erzeugtVon: "chef" });
      if (!e.ok) throw new Error(`einreihen: ${e.grund}`);
      const att = attrappeMitSkript({ schritte: [{ aras: KI_HINWEIS_VORGABE, ms: 800, ton: { dbfs: -24 } }, { warteMs: 8000 }] });
      adapterSetzen("attrappe", att);
      const w = await waehlen(Number(e.id), {});
      if (!w.ok || !w.callId) throw new Error(`waehlen: ${w.grund}`);
      await sqlPool`UPDATE fiaon_calls SET twilio_sid = 'CA-pruef-klingelt-2' WHERE id = ${w.callId}`;
      vorbereiten(w.callId, undefined, 45_000);
      await schlafen(1500);
      await sitzungBeenden(w.callId, "chef");
      await warten(async () => !!(await anruf(w.callId!))?.nachbereitet_am, 6000);
      const a2 = await anruf(w.callId);
      ok("Beim Klingeln vorbereitet, nie abgenommen: „Auflegen“ beendet die Sitzung und bricht bei Twilio ab (canceled), Ergebnis „nicht erreicht“", auftraege.some((a) => a.sid === "CA-pruef-klingelt-2" && a.status === "canceled") && a2?.ergebnis === "nicht_erreicht" && !a2?.angenommen_am, JSON.stringify({ auftraege, e: a2?.ergebnis, ang: a2?.angenommen_am }));
    } finally { twilioClientSetzen(null); await einstellungSetzen("aras_stufe", "0", "pruefstand"); }
  }

  titel("22. GO-LIVE (Justin 20.10. abends: „stelle sie live … jeden Tag von 09:30 bis 21:00“) — EINMAL am 21.10. ab 09:30, Not-Aus bleibt unberührt");
  {
    const { golivePruefen, GOLIVE_MERKER, GOLIVE_AB } = await import("../server/lib/fiaon-aras-golive");
    const wert = async (k: string) => (((await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[])[0]?.value ?? null) as string | null;
    await sqlPool`DELETE FROM fiaon_settings WHERE key = ${GOLIVE_MERKER}`;
    await einstellungSetzen("aras_an", "aus", "pruefstand"); await einstellungSetzen("aras_stufe", "0", "pruefstand");
    await einstellungSetzen("aras_parallel", "3", "pruefstand");
    try {
      ok("Start ist morgen 21.10.2026 09:30 Berlin (Sommerzeit)", GOLIVE_AB === "2026-10-21T09:30:00+02:00");
      const vorher = await golivePruefen(sqlPool, new Date("2026-10-21T09:29:00+02:00"));
      ok("Rot-Probe: 09:29 — nichts passiert (kein Merker, ARAS wählt nicht)", !vorher && (await wert(GOLIVE_MERKER)) === null && (await wert("aras_an")) === "aus" && (await wert("aras_stufe")) === "0");
      // Not-Aus steht (Justin hat gestoppt) — der Go-live setzt ihn NIE zurück
      await notaus("pruefstand", "Probe vor dem Go-live");
      const jetzt = new Date("2026-10-21T09:30:30+02:00");
      const [a, b] = await Promise.all([golivePruefen(sqlPool, jetzt), golivePruefen(sqlPool, jetzt)]);
      ok("09:30 — genau EIN Lauf setzt (auch bei zwei gleichzeitigen Takten), Merker steht", [a, b].filter(Boolean).length === 1 && (await wert(GOLIVE_MERKER)) !== null, JSON.stringify([a, b]));
      arasEinstellungenVergessen();
      const e = await arasEinstellungenLesen(true);
      ok("Danach: Stufe 1, ARAS wählt an, eine gleichzeitig, 20 € am Tag", e.an && e.stufe === 1 && e.parallel === 1 && e.tagEuro === 20, JSON.stringify({ an: e.an, stufe: e.stufe, parallel: e.parallel, tagEuro: e.tagEuro }));
      ok("Nur „Willkommen nach Antrag“ und „Rate offen“ (+ die Rückrufe, die Kunden darin bei ARAS buchen; Probe bleibt) — Verkauf, Zusage, Stufe A, Auftrag aus", e.spielarten.willkommen && e.spielarten.rate && e.spielarten.termin && e.spielarten.probe && !e.spielarten.zuruf && !e.spielarten.zusage && !e.spielarten.stufe_a && !e.spielarten.lead && !e.spielarten.auftrag && !e.spielarten.stufe_b && !e.spielarten.rueckholung);
      ok("Juni, Wien ultra, zügig, viel menschlich, Lachen an, Fenster Mo–Sa 09:30–21:00", e.stimme === "juni" && e.regie.dialekt === "oesterreichisch_stark" && e.regie.tempo === "zuegig" && (await wert("aras_menschlich")) === "viel" && (await wert("aras_lachen")) === "an" && JSON.parse(String(await wert("aras_fenster"))).rate["1-6"][1] === "21:00");
      ok("Not-Aus bleibt AN (der Go-live hebt ihn nie auf) — ohne Justins „Wieder an“ wählt ARAS nicht", e.notaus && (await waehlerTakt()).ausgelassen.some((x) => x.grund === "notaus"));
      // Justin ändert danach etwas — der Go-live überschreibt es nie wieder
      await einstellungSetzen("aras_parallel", "2", "pruefstand");
      const nochmal = await golivePruefen(sqlPool, new Date("2026-10-21T10:15:00+02:00"));
      ok("Zweiter Lauf: nichts mehr (Merker) — Justins spätere Änderung bleibt", !nochmal && (await wert("aras_parallel")) === "2");
      ok("Protokoll: jede Einstellung „go-live 21.10.2026“", ((await sqlPool`SELECT 1 FROM fiaon_mara_protokoll WHERE text LIKE '%(go-live 21.10.2026)%'`) as any[]).length >= 10);
    } finally {
      await start("pruefstand");
      await einstellungSetzen("aras_an", "aus", "pruefstand"); await einstellungSetzen("aras_stufe", "0", "pruefstand");
      await sqlPool`DELETE FROM fiaon_settings WHERE key = ${GOLIVE_MERKER}`;
      arasEinstellungenVergessen();
    }
  }

  titel("23. WILLKOMMEN NACH ANTRAG (Go-live): 20 Minuten nach der Unterschrift, EINMAL je Vertrag, höchstens 24 h — nie bei Zahlung, Anruf in 24 h, Sperre, Test, Kündigung");
  {
    const { willkommenEntfaellt } = await import("../server/lib/fiaon-aras-plan");
    await einstellungSetzen("aras_stufe", "1", "pruefstand"); await einstellungSetzen("aras_an", "an", "pruefstand");
    await einstellungSetzen("aras_spielarten", JSON.stringify({ willkommen: "an", rate: "an", termin: "an", probe: "an" }), "pruefstand");
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    // Reste der Abschnitte davor (klingelnde Prüf-Anrufe) zählen sonst als „gleichzeitig“ (Stufe 1: einer)
    await sqlPool`UPDATE fiaon_calls SET status = 'beendet', ende = COALESCE(ende, NOW()) WHERE gefuehrt_von = 'aras' AND status IN ('gewaehlt', 'laeuft')`;
    // Ein „neuer Tag“ für die Verteilung über den Tag (22.10.: Freigabe je Uhrzeit, Mindestabstand) — die Kundenanrufe der
    // Abschnitte davor zählen sonst schon gegen die Freigabe der Stufe 1 (nur in der Prüf-DB zurückdatiert, wie in Abschnitt 16).
    await sqlPool`UPDATE fiaon_aras_anruf SET created_at = created_at - INTERVAL '3 days' WHERE spielart <> 'probe' AND created_at > NOW() - INTERVAL '3 days'`;
    try {
      const fall = async (n: number, o: { vorMin: number; bezahlt?: boolean; anruf?: boolean; werbesperre?: boolean; blocked?: boolean; test?: boolean; weg?: string; gekuendigt?: boolean; ohneAnnahme?: boolean }) => {
        const pid = await person(n, { werbesperre: o.werbesperre, is_blocked: o.blocked, test: o.test });
        const ref = await antrag(pid, n, { payment_status: o.bezahlt ? "paid" : "pending_payment" });
        if (o.gekuendigt) await sqlPool`UPDATE fiaon_applications SET gekuendigt_am = NOW() WHERE ref = ${ref}`;
        if (!o.ohneAnnahme) await sqlPool`
          INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, paket, rate_cents, gesamt_cents, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn, vertrag_html, vertrag_sha256)
          VALUES (${ref}, ${pid}, ${o.weg ?? "neu"}, NOW() - make_interval(mins => ${o.vorMin}), 'plus', 5999, 71988, 'PV-test', 'L-test', 'AGB-test', 'Zahlungspflichtig annehmen', '{}'::jsonb, FALSE, '<p>Test</p>', 'test')`;
        if (o.anruf) await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von) VALUES (${pid}, ${ausweis}, ${`+4917000000${n}`}, 'raus', 'beendet', NOW() - INTERVAL '2 hours', 'mensch')`;
        return { pid, ref };
      };
      const gut1 = await fall(201, { vorMin: 30 });
      const frisch = await fall(202, { vorMin: 10 });
      const bezahlt = await fall(203, { vorMin: 30, bezahlt: true });
      const angerufen = await fall(204, { vorMin: 30, anruf: true });
      const werbe = await fall(205, { vorMin: 30, werbesperre: true });
      const blockiert = await fall(206, { vorMin: 30, blocked: true });
      const test = await fall(207, { vorMin: 30, test: true });
      const pruef = await fall(208, { vorMin: 30, weg: "neu-pruefstand" });
      const alt = await fall(209, { vorMin: 25 * 60 });
      const gekuendigt = await fall(210, { vorMin: 30, gekuendigt: true });
      const lead = await fall(211, { vorMin: 30, ohneAnnahme: true });
      const f = await planFuellen();
      const plaene = (await sqlPool`SELECT person_id, ref, frueh_ab, spaet_bis, rechtsgrund, prioritaet FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND status = 'wartet'`) as any[];
      const p1 = plaene.find((z) => z.ref === gut1.ref);
      ok("Unterschrift vor 30 Minuten, Aktivierung offen → eingereiht (Vertrag, Vorrang 2)", !!p1 && p1.rechtsgrund === "vertrag" && Number(p1.prioritaet) === 2, JSON.stringify({ f, plaene: plaene.map((z) => z.ref) }));
      const annahmeAm = Date.now() - 30 * 60_000;
      ok("Zeit: ab sofort (20 Minuten sind um), spätestens 24 h nach der Unterschrift — danach nie", !!p1 && Math.abs(new Date(p1.frueh_ab).getTime() - Date.now()) < 120_000 && Math.abs(new Date(p1.spaet_bis).getTime() - (annahmeAm + 24 * 3600_000)) < 120_000, p1 ? `${new Date(p1.frueh_ab).toISOString()} → ${new Date(p1.spaet_bis).toISOString()}` : "—");
      const nicht = [frisch, bezahlt, angerufen, werbe, blockiert, test, pruef, alt, gekuendigt, lead].filter((x) => plaene.some((z) => z.ref === x.ref)).map((x) => x.ref);
      ok("Rot-Proben: unter 20 Minuten, bezahlt, Anruf in 24 h, Werbesperre, Vertriebssperre, Testperson, Prüfstand, älter als 24 h, gekündigt, ohne Unterschrift → NIE eingereiht", nicht.length === 0, nicht.join(", "));
      ok("Die Gründe in Worten (EINE Prüfung für Planer und Wähler)", (await willkommenEntfaellt(frisch.ref)) === "Unterschrift jünger als 20 Minuten" && (await willkommenEntfaellt(bezahlt.ref)) === "Aktivierung schon da" && (await willkommenEntfaellt(angerufen.ref)) === "Anruf in den letzten 24 h"
        && (await willkommenEntfaellt(werbe.ref)) === "Werbe- oder Vertriebssperre" && (await willkommenEntfaellt(test.ref)) === "Testperson" && (await willkommenEntfaellt(alt.ref)) === "Unterschrift älter als 24 h"
        && (await willkommenEntfaellt(gekuendigt.ref)) === "Vertrag beendet" && (await willkommenEntfaellt(lead.ref)) === "kein unterschriebener Antrag" && (await willkommenEntfaellt(gut1.ref)) === null);
      await planFuellen();
      const zweimal = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND ref = ${gut1.ref}`) as any[])[0]?.n;
      ok("EINMAL je Vertrag: der zweite Planer-Lauf reiht nichts mehr ein", Number(zweimal) === 1, String(zweimal));
      const vonHand = await planEinreihen({ personId: lead.pid, nummer: "+4917000000211", spielart: "willkommen", grund: "Prüfstand von Hand", erzeugtVon: "chef" });
      ok("Rot-Probe: von Hand ohne unterschriebenen Antrag → abgelehnt", !vonHand.ok && /unterschriebenen Antrag/.test(vonHand.grund ?? ""), vonHand.grund ?? "");
      // Vor dem Wählen: inzwischen bezahlt → fällt aus der Reihe (auch nachts), kein Anruf
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid' WHERE ref = ${gut1.ref}`;
      const vorher = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE person_id = ${gut1.pid}`) as any[])[0]?.n;
      const t = await waehlerTakt();
      const [pz] = (await sqlPool`SELECT status, verschoben_grund FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND ref = ${gut1.ref}`) as any[];
      const nachher = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE person_id = ${gut1.pid}`) as any[])[0]?.n;
      ok("Vor dem Wählen bezahlt → „Willkommen entfällt: Aktivierung schon da“, kein Anruf", pz?.status === "verfallen" && /Aktivierung schon da/.test(String(pz?.verschoben_grund)) && Number(nachher) === Number(vorher), JSON.stringify({ t, pz }));
      // Im Fenster wählt der Takt den gültigen Willkommens-Anruf (außerhalb: wartet)
      const gut2 = await fall(212, { vorMin: 40 });
      await planFuellen();
      const t2 = await waehlerTakt();
      const fenster = t2.ausgelassen.some((a) => a.grund.startsWith("fenster:"));
      if (fenster) ok("Außerhalb des Fensters: der Willkommens-Anruf wartet (wird nicht verworfen)", ((await sqlPool`SELECT status FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND ref = ${gut2.ref}`) as any[])[0]?.status === "wartet");
      else ok("Im Fenster: der Takt wählt den Willkommens-Anruf", t2.gewaehlt >= 1 && ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_anruf an JOIN fiaon_calls c ON c.id = an.call_id WHERE an.spielart = 'willkommen' AND c.person_id = ${gut2.pid}`) as any[])[0]?.n >= 1, JSON.stringify(t2));
    } finally {
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', call_id = NULL WHERE status IN ('gewaehlt', 'wartet', 'verschoben')`;
      await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt')`;
      await sqlPool`DELETE FROM fiaon_calls WHERE gefuehrt_von = 'aras' AND status = 'gewaehlt'`;
      await einstellungSetzen("aras_stufe", "0", "pruefstand");
    }
  }

  titel("24. RATE OFFEN (Go-live C): Tag 1–45, „Karte nicht erhalten“ → GENAU EINE Aufgabe für Justin (bei ihm, nicht beim Betreuer)");
  {
    await einstellungSetzen("aras_stufe", "3", "pruefstand"); await einstellungSetzen("aras_an", "an", "pruefstand");
    await sqlPool`UPDATE fiaon_calls SET status = 'beendet', ende = COALESCE(ende, NOW()) WHERE gefuehrt_von = 'aras' AND status IN ('gewaehlt', 'laeuft')`;
    try {
      const pK = await person(441); const rK = await antrag(pK, 441, { payment_status: "paid" });
      const [rate] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rK}, 2, ${`${rK}-2`}, 5999, ${vor(12)}::date, 'offen') RETURNING id`) as any[];
      const e = await planEinreihen({ personId: pK, nummer: "+4917000000441", spielart: "rate", grund: "Prüfstand Rate Tag 12", erzeugtVon: "chef", rateId: Number(rate.id), anlassAm: new Date(`${vor(12)}T10:00:00Z`) });
      if (!e.ok || !e.id) throw new Error(`einreihen: ${e.grund}`);
      const { callId } = await gespraech(Number(e.id), { schritte: [
        { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat." },
        { kunde: "Ich hab übrigens nie eine Karte bekommen." },
        { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "karte_nicht_erhalten", text: "Kunde sagt, er hat nie eine Karte bekommen." } },
        { kunde: "Wirklich, nie angekommen." },
        { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "karte_nicht_erhalten", text: "Kunde sagt es noch einmal: keine Karte angekommen." } },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Rate offen, Karte nicht erhalten" } },
      ] });
      await warten(async () => !!(await anruf(callId))?.nachbereitet_am, 12_000);
      const todos = (await sqlPool`SELECT id, titel, link, zustaendig_art, status, person_id FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:justin:karte_nicht_erhalten:${pK}`}`) as any[];
      ok("„Karte nicht erhalten“ zweimal im Gespräch → GENAU EINE Aufgabe, bei Justin (nicht beim Betreuer), mit Akte-Link", todos.length === 1 && /Karte nicht erhalten/.test(String(todos[0]?.titel)) && todos[0]?.zustaendig_art !== "agent" && String(todos[0]?.link ?? "").includes(rK) && Number(todos[0]?.person_id) === pK, JSON.stringify(todos));
      const wz = (await sqlPool`SELECT werkzeug, ok FROM fiaon_aras_werkzeug w JOIN fiaon_aras_anruf a ON a.id = w.aras_anruf_id WHERE a.call_id = ${callId} AND w.werkzeug = 'aufgabe_fuer_justin'`) as any[];
      // Seit „ARAS hält ihr Wort“ (21.10.): derselbe Aufruf im selben Gespräch läuft nur EINMAL (die Brücke fängt den zweiten ab).
      ok("Der zweite Aufruf im selben Gespräch läuft nicht noch einmal (genau EINE Zeile im Protokoll)", wz.length === 1 && wz.every((x) => x.ok), JSON.stringify(wz));
      // Ein neuer Anruf zur selben Sache: immer noch EINE Aufgabe
      const e2 = await planEinreihen({ personId: pK, nummer: "+4917000000441", spielart: "rate", grund: "Prüfstand Rate Tag 12 (2)", erzeugtVon: "chef", rateId: Number(rate.id), anlassAm: new Date(`${vor(12)}T10:00:00Z`) });
      if (e2.ok && e2.id) {
        const g2 = await gespraech(Number(e2.id), { schritte: [
          { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja?" },
          { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "karte_nicht_erhalten", text: "Wieder: keine Karte." } },
          { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Karte" } },
        ] });
        await warten(async () => !!(await anruf(g2.callId))?.nachbereitet_am, 12_000);
      }
      const n2 = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:justin:karte_nicht_erhalten:${pK}`}`) as any[])[0]?.n;
      ok("Zweiter Anruf, dieselbe Sache → weiter GENAU EINE Aufgabe je Kunde und Problem", Number(n2) === 1, String(n2));
    } finally {
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', call_id = NULL WHERE status IN ('gewaehlt', 'wartet', 'verschoben')`;
      await einstellungSetzen("aras_stufe", "0", "pruefstand");
    }
  }

  titel("25. EINSICHT IM BRIEFING (Go-live D): Unterschrift, alle offenen Rechnungen, Kündigung mit Vertragsart, Karte, letzte Kontakte, WhatsApp-Notiz");
  {
    const { briefingBauen } = await import("../server/lib/fiaon-aras-briefing");
    const pE = await person(442); const rE = await antrag(pE, 442, { payment_status: "paid" });
    // Jahresvertrag (AGB ab 03.09.2026), gekündigt, Vertrag bis 30.09.2027; zwei offene Rechnungen; Karten-Link geschickt
    await sqlPool`UPDATE fiaon_applications SET agb_stand = DATE '2026-09-20', gekuendigt_am = NOW() - INTERVAL '4 days', vertrag_ende_am = DATE '2027-09-30', wanted_limit = 3000 WHERE ref = ${rE}`;
    await sqlPool`INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, paket, rate_cents, gesamt_cents, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn, vertrag_html, vertrag_sha256)
                  VALUES (${rE}, ${pE}, 'neu', TIMESTAMPTZ '2026-09-22 10:00:00+02', 'plus', 5999, 71988, 'PV-test', 'L-test', 'AGB-test', 'Zahlungspflichtig annehmen', '{}'::jsonb, FALSE, '<p>Test</p>', 'test')`;
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${rE}, 2, ${`${rE}-2`}, 5999, ${vor(25)}::date, 'offen'), (${rE}, 3, ${`${rE}-3`}, 5999, ${vor(3)}::date, 'offen')`;
    await sqlPool`INSERT INTO fiaon_konto_karte (person_id, gesendet_am, kanal, status) VALUES (${pE}, NOW() - INTERVAL '10 days', 'mail', 'gesendet')`.catch(() => null);
    await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ergebnis) VALUES (${pE}, ${ausweis}, '+4917000000442', 'raus', 'beendet', NOW() - INTERVAL '2 days', 'mensch', 'nicht_erreicht')`;
    await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, status, created_at) VALUES ('abo_payment_reminder', ${pE}, 'versandt', NOW() - INTERVAL '3 days')`;
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status, created_at) VALUES ('rein', '+4917000000442', ${pE}, 'text', 'Wo bleibt meine Karte?', 'offen', NOW() - INTERVAL '1 day')`;
    await sqlPool`INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, notiz) VALUES ('+4917000000442', ${pE}, 'Fragt nach der Karte, freundlich.') ON CONFLICT DO NOTHING`.catch(() => null);
    const b = await briefingBauen({ personId: pE, nummer: "+4917000000442", spielart: "rate" });
    ok("Unterschrieben am 22.09.2026 (Vertragsannahme)", b.unterschriebenAm === "22.09.2026", String(b.unterschriebenAm));
    ok("ALLE offenen, fälligen Rechnungen (Rate 2 und 3, älteste zuerst)", b.offeneRechnungen?.length === 2 && b.offeneRechnungen[0].nr === 2 && b.offeneRechnungen[1].nr === 3 && /59,99/.test(b.offeneRechnungen[0].betrag), JSON.stringify(b.offeneRechnungen));
    ok("Kündigung: Jahresvertrag (AGB ab 03.09.), läuft bis 30.09.2027, Kulanz-Betrag = Summe ALLER offenen Rechnungen (119,98 €)", b.kuendigung?.art === "jahresvertrag" && b.kuendigung.endeAm === "30.09.2027" && /119,98/.test(String(b.kuendigung.offenBetrag)), JSON.stringify(b.kuendigung));
    ok("Karte: Link zu Konto und Karte geschickt (mit Datum)", b.karte?.stand === "link_gesendet" && !!b.karte.am, JSON.stringify(b.karte));
    ok("Letzte Kontakte in Worten (neueste zuerst): WhatsApp von ihm · Anruf vom Team — nicht erreicht · Mail (Raten-Erinnerung)", (b.kontakte ?? []).length === 3 && /WhatsApp von ihm/.test(b.kontakte![0]) && /Anruf vom Team — nicht erreicht/.test(b.kontakte![1]) && /Mail \(Raten-Erinnerung\)/.test(b.kontakte![2]), JSON.stringify(b.kontakte));
    ok("Notiz zum WhatsApp-Gespräch dabei", /Fragt nach der Karte/.test(String(b.maraNotiz ?? "")), String(b.maraNotiz));
    // Altvertrag: gilt zum Ende des Abrechnungsmonats, kein Kulanz-Weg
    await sqlPool`UPDATE fiaon_applications SET agb_stand = DATE '2026-08-20', vertrag_ende_am = DATE '2026-10-31' WHERE ref = ${rE}`;
    const b2 = await briefingBauen({ personId: pE, nummer: "+4917000000442", spielart: "rate" });
    ok("Altvertrag (AGB vor dem 03.09.): art altvertrag, Ende 31.10.2026", b2.kuendigung?.art === "altvertrag" && b2.kuendigung.endeAm === "31.10.2026", JSON.stringify(b2.kuendigung));
    // Konto eröffnet gemeldet → „konto_eroeffnet“
    await sqlPool`UPDATE fiaon_konto_karte SET bestaetigt_am = NOW() - INTERVAL '1 day' WHERE person_id = ${pE}`.catch(() => null);
    const b3 = await briefingBauen({ personId: pE, nummer: "+4917000000442", spielart: "rate" });
    ok("Konto bei der Partnerbank bestätigt → Karte „konto_eroeffnet“", b3.karte?.stand === "konto_eroeffnet", JSON.stringify(b3.karte));
  }

  titel("26. ERGEBNISSE (Go-live G): je Gesprächsart und Tag — Anrufe, erreicht, Zusagen, Zahlung ≤ 48 h, Aufgaben, Kündigung, Beschwerde; jede Zahl mit ihren Anrufen");
  {
    const { ergebnisseTag } = await import("../server/lib/fiaon-aras-ergebnisse");
    const TAG = "2026-01-15";
    const pG = await person(444); const rG = await antrag(pG, 444, { payment_status: "paid" });
    const anruf = async (o: { spielart: string; ergebnis: string | null; briefing?: object; um: string; person?: number | null }) => {
      const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von) VALUES (${o.person === undefined ? pG : o.person}, ${ausweis}, '+4917000000444', 'raus', 'beendet', ${o.um}::timestamptz, 'aras') RETURNING id`) as any[];
      const [a] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, angenommen_am, created_at)
                                 VALUES (${c.id}, ${o.spielart}, ${sqlPool.json((o.briefing ?? {}) as any)}, 'attrappe', 'juni', 'pruefstand', ${o.ergebnis}, ${o.ergebnis && o.ergebnis !== "nicht_erreicht" ? o.um : null}::timestamptz, ${o.um}::timestamptz) RETURNING id`) as any[];
      return Number(a.id);
    };
    const wz = async (arasAnrufId: number, werkzeug: string, eingabe: object = {}) => sqlPool`INSERT INTO fiaon_aras_werkzeug (aras_anruf_id, werkzeug, aufruf_id, eingabe, ergebnis, ok, dauer_ms) VALUES (${arasAnrufId}, ${werkzeug}, ${`pruef-${arasAnrufId}-${werkzeug}`}, ${sqlPool.json(eingabe as any)}, ${sqlPool.json({} as any)}, TRUE, 5)`;
    const a1 = await anruf({ spielart: "rate", ergebnis: "erreicht_zahlt_am", um: "2026-01-15T10:00:00+01:00" });
    await wz(a1, "zahlungszusage_merken", { datum: "2026-01-16" }); await wz(a1, "aufgabe_fuer_justin", { art: "karte_nicht_erhalten", text: "keine Karte" });
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${rG}, 2, ${`${rG}-2`}, 5999, DATE '2026-01-10', 'bezahlt', TIMESTAMPTZ '2026-01-16 09:00:00+01')`;
    const a2 = await anruf({ spielart: "rate", ergebnis: "nicht_erreicht", um: "2026-01-15T11:00:00+01:00" });
    const a3 = await anruf({ spielart: "willkommen", ergebnis: "erreicht_sonstiges", um: "2026-01-15T12:00:00+01:00", briefing: { kuendigung: { am: "10.01.2026", art: "jahresvertrag", endeAm: null, offenBetrag: null } } });
    await wz(a3, "nicht_mehr_anrufen");
    const a4 = await anruf({ spielart: "probe", ergebnis: "erreicht_sonstiges", um: "2026-01-15T13:00:00+01:00", briefing: { probe: true, probeSpielart: "rate" }, person: null });
    const e = await ergebnisseTag(TAG);
    const rate = e.zeilen.find((z) => z.spielart === "rate"), wk = e.zeilen.find((z) => z.spielart === "willkommen");
    ok("Rate offen: 2 Anrufe, 1 erreicht, 1 Zusage, 1 Zahlung ≤ 48 h (59,99 €), 1 Aufgabe für Justin", !!rate && rate.zellen.anrufe.n === 2 && rate.zellen.erreicht.n === 1 && rate.zellen.zusagen.n === 1 && rate.zellen.zahlungen.n === 1 && rate.euro48h === 59.99 && rate.zellen.aufgaben.n === 1, JSON.stringify(rate));
    ok("Willkommen: 1 Anruf, erreicht, Kündigung in der Akte, „nicht mehr anrufen“ → Beschwerde/Sperre", !!wk && wk.zellen.anrufe.n === 1 && wk.zellen.erreicht.n === 1 && wk.zellen.kuendigung.n === 1 && wk.zellen.beschwerde.n === 1, JSON.stringify(wk));
    ok("Jede Zahl trägt ihre Anrufe (für die Gespräche dazu) — Willkommen und Rate stehen zuerst", rate!.zellen.anrufe.ids.includes(a1) && rate!.zellen.anrufe.ids.includes(a2) && rate!.zellen.zahlungen.ids.join() === String(a1) && wk!.zellen.beschwerde.ids.join() === String(a3) && e.zeilen[0].spielart === "willkommen" && e.zeilen[1].spielart === "rate");
    ok("Probeanrufe zählen nur auf Wunsch — dann unter der gespielten Art (Rate: 3 Anrufe), zusammen 4", !e.zeilen.some((z) => z.zellen.anrufe.ids.includes(a4)) && e.summe.zellen.anrufe.n === 3 && (await ergebnisseTag(TAG, { mitProbe: true })).zeilen.find((z) => z.spielart === "rate")?.zellen.anrufe.n === 3 && (await ergebnisseTag(TAG, { mitProbe: true })).summe.zellen.anrufe.n === 4);
    ok("Ein anderer Tag: leer (nichts doppelt gezählt)", (await ergebnisseTag("2026-01-14")).zeilen.length === 0);
  }

  titel("27. ARAS HÄLT IHR WORT (Rauchtest 20.10. nachts): bestätigt nur, was wirklich passiert ist — sonst handelt die Brücke selbst oder korrigiert still");
  {
    const W = await import("../shared/fiaon-aras-wort");
    await einstellungSetzen("aras_stufe", "3", "pruefstand"); await einstellungSetzen("aras_an", "an", "pruefstand"); await start("pruefstand");
    await sqlPool`UPDATE fiaon_calls SET status = 'beendet', ende = COALESCE(ende, NOW()) WHERE gefuehrt_von = 'aras' AND status IN ('gewaehlt', 'laeuft')`;
    const wz = async (callId: number, name: string) => (await sqlPool`SELECT w.ok, w.aufruf_id FROM fiaon_aras_werkzeug w JOIN fiaon_aras_anruf a ON a.id = w.aras_anruf_id WHERE a.call_id = ${callId} AND w.werkzeug = ${name} ORDER BY w.id`) as any[];
    const kunde = async (n: number) => { const pid = await person(n); const ref = await antrag(pid, n, { payment_status: "paid" });
      const [r] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${ref}-2`}, 5999, ${vor(4)}::date, 'offen') RETURNING id`) as any[];
      const e = await planEinreihen({ personId: pid, ref, nummer: `+4917000000${n}`, spielart: "rate", grund: "Prüfstand Wort", erzeugtVon: "chef", rateId: Number(r.id), anlassAm: new Date(`${vor(4)}T10:00:00Z`) });
      if (!e.ok || !e.id) throw new Error(`einreihen: ${e.grund}`); return { pid, ref, planId: Number(e.id) }; };
    // Erkenner (rein)
    ok("Erkenner: „Schicken Sie's mir“ / „ja bitte per WhatsApp“ = will den Link; „Nein, nicht schicken“ nie", W.kundeWillZusendung("Ja, schicken Sie's mir bitte.") && W.kundeWillZusendung("Ja gerne, per WhatsApp.") && !W.kundeWillZusendung("Nein, bitte nichts schicken."));
    ok("Erkenner: „Der Link ist gleich per WhatsApp bei Ihnen“ / „Hab Ihnen die Rechnung geschickt“ = behauptet erledigt; „I schick Ihnen glei die Rechnung zu“ = kündigt an",
      W.arasBehauptetZusendung("Der Link ist gleich per WhatsApp bei Ihnen.") && W.arasBehauptetZusendung("Hab Ihnen die Rechnung grad geschickt.") && !W.arasBehauptetZusendung("I schick Ihnen glei die Rechnung zu.") && W.arasKuendigtZusendungAn("I schick Ihnen glei die Rechnung zu, seins so guat."));
    ok("Erkenner: ein ANGEBOT („Ich schick Ihnen den Link gleich aufs Handy … — passt das?“) ist keine Zusage — erst sein „Ja, passt.“ zählt; „Nein“ nie; „heute noch nicht“ ist kein Zahltag",
      !W.arasKuendigtZusendungAn("Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos — passt das?") && W.arasBietetZusendungAn("Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos — passt das?") && W.kurzesJa("Ja, passt.") && !W.kurzesJa("Ja, aber nicht heute.") && W.kurzesNein("Nein, brauch ich nicht.") && W.zahltagAusKunde("Heute noch nicht.", "2026-10-21") === null);
    ok("Erkenner: „Ich hab nie eine Karte bekommen“, „Die Karte ist noch nicht da“ = keine Karte; „Danke für die Karte“ nie", W.karteNichtBekommen("Ich hab übrigens nie eine Karte bekommen.") && W.karteNichtBekommen("Die Karte ist noch nicht da.") && !W.karteNichtBekommen("Danke, die Karte ist super."));
    ok("Erkenner: „dann notier i mir heute“ / „das hab ich notiert“ = behauptet notiert; Zahltag nur aus „heute“/„morgen“", W.arasBehauptetNotiert("Super, dann notier i mir heute.") && W.arasBehauptetNotiert("Alles klar, das hab ich notiert.") && W.zahltagAusKunde("Ja, heute noch.", "2026-10-21") === "2026-10-21" && W.zahltagAusKunde("Morgen", "2026-10-21") === "2026-10-22" && W.zahltagAusKunde("Weiß ich noch nicht", "2026-10-21") === null);

    // A) ARAS sagt „Der Link ist raus“, ohne Werkzeug → die Brücke schickt SOFORT selbst; scheitert es (hier ohne Versand-
    //    schlüssel), korrigiert sie still und das Team bekommt eine Notiz. Die Ankündigung davor löst nichts doppelt aus.
    const kA = await kunde(447);
    const gA = await gespraech(kA.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "I ruf an wegen Ihrer offenen Rate — i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte.", ms: 500 }, { warteMs: 600 },
      { aras: "Der Link ist schon raus.", ms: 300 }, { warteMs: 3000 },
    ] });
    await warten(async () => (await wz(gA.callId, "zahlungslink_senden")).length > 0, 6000);
    await warten(() => gA.att.spur.eingeschoben.some((x) => x.text === W.KORREKTUR_LINK_FEHLER), 4000);
    const linkA = await wz(gA.callId, "zahlungslink_senden");
    ok("„ist raus“ ohne Werkzeug → die Brücke schickt selbst (genau EIN Versuch, keine doppelte Rechnung)", linkA.length === 1 && String(linkA[0].aufruf_id).startsWith("bruecke_wort_zahlungslink_senden"), JSON.stringify(linkA));
    ok("Ging es nicht raus → stille Korrektur an die Stimme (nie „ist raus“ stehen lassen)", !linkA[0]?.ok && gA.att.spur.eingeschoben.some((x) => x.art === "anweisung" && x.text === W.KORREKTUR_LINK_FEHLER), JSON.stringify(gA.att.spur.eingeschoben.map((x) => x.text.slice(0, 40))));
    gA.tw.aufhaengen(); await warten(async () => !!(await anruf(gA.callId))?.nachbereitet_am, 10_000);
    ok("… und das Team bekommt eine Notiz zum Nachsenden (Akte)", ((await sqlPool`SELECT 1 FROM fiaon_contact_log WHERE person_id = ${kA.pid} AND note LIKE '%nicht raus%'`) as any[]).length >= 1 || (await wz(gA.callId, "notiz_schreiben")).length >= 1);

    // B) „Ich hab nie eine Karte bekommen“ — das Modell legt keine Aufgabe an → die Brücke legt GENAU EINE an (spätestens beim Auflegen)
    const kB = await kunde(448);
    const gB = await gespraech(kB.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { kunde: "Ich hab übrigens nie eine Karte bekommen.", nachMs: 200 }, { warteMs: 500 },
      { aras: "Wos — wirklich! Na passens auf: i kümmer mi drum.", ms: 400 }, { warteMs: 1500 },
    ] });
    await schlafen(1800);
    gB.tw.aufhaengen(); await warten(async () => !!(await anruf(gB.callId))?.nachbereitet_am, 12_000);
    const aufgB = await wz(gB.callId, "aufgabe_fuer_justin");
    const todoB = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:justin:karte_nicht_erhalten:${kB.pid}`}`) as any[])[0]?.n;
    ok("„keine Karte“ ohne Werkzeug des Modells → die Brücke legt die Aufgabe an (auch wenn er gleich auflegt) — GENAU EINE", aufgB.length === 1 && aufgB[0].ok && Number(todoB) === 1, `${JSON.stringify(aufgB)} · Aufgaben ${todoB}`);

    // C) Das Modell legt sie selbst an → die Brücke tut nichts doppelt
    const kC = await kunde(449);
    const gC = await gespraech(kC.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { kunde: "Die Karte ist noch nicht da.", nachMs: 200 },
      { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "karte_nicht_erhalten", text: "Kunde: Karte noch nicht da." } }, { warteMs: 9000 },
    ] });
    // Das Modell legt sie gleich an — die Brücke wartet 6 s und tut dann nichts mehr (erst danach auflegen).
    await warten(async () => (await wz(gC.callId, "aufgabe_fuer_justin")).length > 0, 8000); await schlafen(7000);
    gC.tw.aufhaengen(); await warten(async () => !!(await anruf(gC.callId))?.nachbereitet_am, 12_000);
    const aufgC = await wz(gC.callId, "aufgabe_fuer_justin");
    ok("Rot-Probe: legt das Modell die Aufgabe selbst an, macht die Brücke nichts doppelt (1 Aufruf, nicht von der Brücke)", aufgC.length === 1 && !String(aufgC[0].aufruf_id).startsWith("bruecke_"), JSON.stringify(aufgC));
    // C2) Umgekehrt (Rauchtest 21.10.): die Brücke war schneller, das Modell ruft danach noch einmal → kein zweiter Lauf
    const kC2 = await kunde(456);
    const gC2 = await gespraech(kC2.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { kunde: "Ich hab nie eine Karte bekommen.", nachMs: 200 }, { warteMs: 7500 },
      { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "karte_nicht_erhalten", text: "Kunde: nie eine Karte." } }, { warteMs: 1500 },
    ] });
    await warten(async () => gC2.att.spur.werkzeuge.some((x) => x.name === "aufgabe_fuer_justin"), 14_000);
    gC2.tw.aufhaengen(); await warten(async () => !!(await anruf(gC2.callId))?.nachbereitet_am, 10_000);
    const aufgC2 = await wz(gC2.callId, "aufgabe_fuer_justin");
    ok("Rot-Probe: die Brücke legte die Aufgabe an, das Modell ruft danach noch einmal → genau EIN echter Lauf", aufgC2.length === 1 && String(aufgC2[0].aufruf_id).startsWith("bruecke_wort_") && gC2.att.spur.werkzeuge.find((x) => x.name === "aufgabe_fuer_justin")?.ergebnis.ok === true, JSON.stringify(aufgC2));

    // D) „heute noch?“ → „Ja, heute noch.“ → „dann notier i mir heute“ ohne Werkzeug → die Brücke trägt den Tag ein
    const kD = await kunde(450);
    const gD = await gespraech(kD.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "Wann schaffen Sie die Überweisung — heute noch?", ms: 400 }, { warteMs: 700 },
      { kunde: "Ja, heute noch.", nachMs: 200 }, { warteMs: 400 },
      { aras: "Super, dann notier i mir heute.", ms: 300 }, { warteMs: 2500 },
    ] });
    await warten(async () => (await wz(gD.callId, "zahlungszusage_merken")).length > 0, 6000);
    const zuD = await wz(gD.callId, "zahlungszusage_merken");
    ok("„notier i mir heute“ ohne Werkzeug → die Brücke trägt den Zahltag ein (heute)", zuD.length === 1 && zuD[0].ok, JSON.stringify(zuD));
    gD.tw.aufhaengen(); await warten(async () => !!(await anruf(gD.callId))?.nachbereitet_am, 10_000);

    // E) „Hab ich notiert“ ohne einen Tag vom Kunden → stille Korrektur (nach dem Tag fragen)
    const kE = await kunde(451);
    const gE = await gespraech(kE.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "Alles klar, das hab ich notiert.", ms: 300 }, { warteMs: 2000 },
    ] });
    await warten(() => gE.att.spur.eingeschoben.some((x) => x.text === W.KORREKTUR_ZUSAGE), 4000);
    ok("Rot-Probe: „notiert“ ohne Tag → stille Korrektur (frag nach dem Tag), nichts eingetragen", gE.att.spur.eingeschoben.some((x) => x.art === "anweisung" && x.text === W.KORREKTUR_ZUSAGE) && (await wz(gE.callId, "zahlungszusage_merken")).length === 0);
    gE.tw.aufhaengen(); await warten(async () => !!(await anruf(gE.callId))?.nachbereitet_am, 10_000);
    // H) Rauchtest 21.10.: die Abschrift schnitt „heute noch“ ab („Okay, passt. Ich zahl das“) — ARAS bestätigte „dann notier ich
    //    mir heute“ → der Tag aus ihrer hörbaren Bestätigung; I) scheitert das Werkzeug des Modells, wiederholt die Brücke nicht blind
    const kH = await kunde(454);
    const gH = await gespraech(kH.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { kunde: "Okay, passt. Ich zahl das", nachMs: 200 }, { warteMs: 300 },
      { aras: "Sehr gut, dann notier ich mir heute.", ms: 300 }, { warteMs: 2500 },
    ] });
    await warten(async () => (await wz(gH.callId, "zahlungszusage_merken")).length > 0, 6000);
    ok("Abschrift ohne Tag, aber er will zahlen und ARAS bestätigt „heute“ → Zahltag heute eingetragen (keine Korrektur nötig)", (await wz(gH.callId, "zahlungszusage_merken")).length === 1 && !gH.att.spur.eingeschoben.some((x) => x.text === W.KORREKTUR_ZUSAGE));
    gH.tw.aufhaengen(); await warten(async () => !!(await anruf(gH.callId))?.nachbereitet_am, 10_000);
    const kI = await kunde(455);
    const gI = await gespraech(kI.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "I ruf an wegen Ihrer offenen Rate — i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte.", ms: 500 },
      { werkzeug: "zahlungslink_senden", eingabe: { weg: "whatsapp", zweck: "rate" } }, { warteMs: 10_000 },
    ] });
    await warten(async () => (await wz(gI.callId, "zahlungslink_senden")).length > 0, 6000); await schlafen(9000);
    gI.tw.aufhaengen(); await warten(async () => !!(await anruf(gI.callId))?.nachbereitet_am, 10_000);
    const linkI = await wz(gI.callId, "zahlungslink_senden"), notizI = await wz(gI.callId, "notiz_schreiben");
    ok("Rot-Probe: scheitert der Link des Modells, versucht die Brücke es nicht blind noch einmal — EINE Notiz fürs Team", linkI.length === 1 && !String(linkI[0].aufruf_id).startsWith("bruecke_") && notizI.length === 1, `${JSON.stringify(linkI)} · Notizen ${notizI.length}`);

    // F) Angebot „… passt das?“ + „Ja, passt.“ → die Brücke schickt; G) Angebot + „Nein, brauch ich nicht.“ → nichts
    const kF = await kunde(452);
    const gF = await gespraech(kF.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos — passt das?", ms: 400 }, { warteMs: 700 },
      { kunde: "Ja, passt.", nachMs: 200 }, { warteMs: 10_000 },
    ] });
    await warten(async () => (await wz(gF.callId, "zahlungslink_senden")).length > 0, 14_000);
    ok("Angebot + „Ja, passt.“ ohne Werkzeug des Modells → die Brücke schickt den Link (ein Versuch)", (await wz(gF.callId, "zahlungslink_senden")).length === 1);
    gF.tw.aufhaengen(); await warten(async () => !!(await anruf(gF.callId))?.nachbereitet_am, 10_000);
    const kG = await kunde(453);
    const gG = await gespraech(kG.planId, { schritte: [
      { aras: KI_HINWEIS_VORGABE, ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 200 }, { warteMs: 400 },
      { aras: "Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos — passt das?", ms: 400 }, { warteMs: 700 },
      { kunde: "Nein, brauch ich nicht.", nachMs: 200 }, { warteMs: 1500 },
    ] });
    await schlafen(3000); gG.tw.aufhaengen(); await warten(async () => !!(await anruf(gG.callId))?.nachbereitet_am, 10_000);
    ok("Rot-Probe: Angebot + „Nein“ → kein Link (auch nicht beim Auflegen)", (await wz(gG.callId, "zahlungslink_senden")).length === 0);
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  titel("28. DER PLANER HÄLT SEINE VERSPRECHEN (Koordination 22.10.): Rückruf mit Vorrang, Meldung bei verpasstem Rückruf, Verteilung über den Tag, anderer Tagesabschnitt, Zahlungszusage, Berliner Datum, Willkommen 2. Versuch");
  {
    const { tagesFreigabe, abschnittWahl, tagesabschnitt, zusagePause, fensterOffen, berlinTeile } = await import("../shared/fiaon-aras");
    const { zusagePauseFuer, willkommenEntfaellt, rateEntfaellt, planVerschieben } = await import("../server/lib/fiaon-aras-plan");
    const { berlinZeitpunkt } = await import("../server/lib/fiaon-time");
    await einstellungSetzen("aras_stufe", "1", "pruefstand"); await einstellungSetzen("aras_an", "an", "pruefstand"); await start("pruefstand");
    await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "an", rate: "an", probe: "an" }), "pruefstand");
    // Abschnitt 22 (Go-live) stellt das Fenster auf Mo–Sa 09:30–21:00 — hier wieder jeden Tag 08–21 Uhr (wie Abschnitt 1).
    await einstellungSetzen("aras_fenster", JSON.stringify({ verkauf: { "1-7": ["08:00", "21:00"] }, rate: { "1-7": ["08:00", "21:00"] } }), "pruefstand");
    await einstellungSetzen("aras_je_stunde", "120", "pruefstand");
    adapterSetzen("attrappe", attrappeMitSkript({ schritte: [] }));
    const fenster = (await arasEinstellungenLesen(true)).fenster;
    const heute = yyyy(new Date());
    const imFenster = () => fensterOffen("rate", "DE", new Date(), { fenster }).offen;
    const rueckrufZeit = () => fensterOffen("termin", "DE", new Date(), { fenster }).offen;
    /** Saubere Reihe und ein „neuer Tag“ (nur in der Prüf-DB zurückdatiert, wie Abschnitt 16). */
    const neuerTag = async () => {
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', call_id = NULL WHERE status IN ('wartet', 'verschoben', 'gewaehlt', 'laeuft')`;
      await sqlPool`UPDATE fiaon_calls SET status = 'beendet', ende = COALESCE(ende, NOW()) WHERE gefuehrt_von = 'aras' AND status IN ('gewaehlt', 'laeuft')`;
      await sqlPool`UPDATE fiaon_aras_anruf SET created_at = created_at - INTERVAL '3 days' WHERE spielart <> 'probe' AND created_at > NOW() - INTERVAL '3 days'`;
    };
    const anrufeVon = async (pid: number) => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE person_id = ${pid} AND gefuehrt_von = 'aras' AND beginn > NOW() - INTERVAL '10 minutes'`) as any[])[0]?.n ?? 0);
    const rateKunde = async (n: number, tage = 3) => {
      const pid = await person(n); const ref = await antrag(pid, n, { payment_status: "paid" });
      const [r] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${ref}-2`}, 5999, ${vor(tage)}::date, 'offen') RETURNING id`) as any[];
      return { pid, ref, rateId: Number(r.id), nummer: `+4917000000${n}`, tage };
    };
    const rateEinreihen = async (k: Awaited<ReturnType<typeof rateKunde>>, erzeugtVon: "chef" | "takt" = "chef", zeit: { fruehAb?: Date; spaetBis?: Date } = {}) => {
      const e = await planEinreihen({ personId: k.pid, ref: k.ref, nummer: k.nummer, spielart: "rate", grund: `Prüfstand Rate Tag ${k.tage}`, erzeugtVon, rateId: k.rateId, anlassAm: new Date(`${vor(k.tage)}T10:00:00Z`), betragCents: 5999, ...zeit });
      if (!e.ok || !e.id) throw new Error(`Rate einreihen: ${e.grund}`); return Number(e.id);
    };
    // Eine Zusage wie in der Produktion: an der Bestellung (fiaon_contact_log.ref), OHNE person_id; der zugesagte Tag als Berliner Mitternacht.
    const zusage = (ref: string, tag: string, o: { voided?: boolean; vorher?: string } = {}) => sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at, voided_at)
      VALUES (${ref}, ${ausweis}, 'Aras', 'result', 'erreicht_zahlt_am', 'Prüfstand: zahlt am', (${tag}::date)::timestamp AT TIME ZONE 'Europe/Berlin',
              NOW() - ${o.vorher ?? "1 hour"}::interval, ${o.voided ? new Date() : null})`;
    const rueckruf = async (n: number, fruehAb: Date, spaetBis: Date) => {
      const pid = await person(n); await antrag(pid, n, { payment_status: "paid" });
      await einwilligungMerken({ personId: pid, nummer: `+4917000000${n}`, art: "rueckruf_buchung", wortlaut: "Prüfstand: Rückruf bei Aras gebucht", quelleArt: "termin", quelleId: `pruef${n}` });
      const e = await planEinreihen({ personId: pid, nummer: `+4917000000${n}`, spielart: "termin", grund: "Prüfstand: Rückruf bei Aras", erzeugtVon: "chef", fruehAb, spaetBis, anlassAm: new Date(fruehAb.getTime() + 60_000) });
      if (!e.ok || !e.id) throw new Error(`Rückruf einreihen: ${e.grund}`); return { pid, planId: Number(e.id) };
    };
    /** n Kundenanrufe (ohne Vorrang) heute, vor `vorMin` Minuten (nie vor Mitternacht Berlin). */
    const anrufeHeute = async (pid: number, n: number, vorMin = 30) => {
      const um = sqlPool`GREATEST(NOW() - make_interval(mins => ${vorMin}), (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') + INTERVAL '1 minute') AT TIME ZONE 'Europe/Berlin')`;
      await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von) SELECT ${pid}, ${ausweis}, '+491700000099', 'raus', 'beendet', ${um}, 'aras' FROM generate_series(1, ${n})`;
      await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, spielart, briefing, adapter, stimme, prompt_version, created_at)
                    SELECT c.id, 'rate', '{}'::jsonb, 'attrappe', 'flitz', 'pruefstand', c.beginn FROM fiaon_calls c
                     WHERE c.person_id = ${pid} AND c.gefuehrt_von = 'aras' AND NOT EXISTS (SELECT 1 FROM fiaon_aras_anruf x WHERE x.call_id = c.id)`;
    };
    const anrufeWeg = async (pid: number) => {
      await sqlPool`DELETE FROM fiaon_aras_anruf WHERE call_id IN (SELECT id FROM fiaon_calls WHERE person_id = ${pid} AND gefuehrt_von = 'aras')`;
      await sqlPool`DELETE FROM fiaon_calls WHERE person_id = ${pid} AND gefuehrt_von = 'aras'`;
    };
    const status = async (planId: number) => ((await sqlPool`SELECT status, verschoben_grund, frueh_ab, spaet_bis FROM fiaon_aras_plan WHERE id = ${planId}`) as any[])[0];
    let fern: any = null;
    try {
      // ── 1. Rückruf mit Vorrang: Tagesmenge voll UND Euro-Deckel erreicht → er geht trotzdem; Not-Aus und Notbremse halten ihn ──
      await neuerTag();
      const kN = await rateKunde(500); await rateEinreihen(kN);
      const rA = await rueckruf(501, new Date(Date.now() - 60_000), new Date(Date.now() + 30 * 60_000));
      const pMenge = await person(502);
      await anrufeHeute(pMenge, 40, 40);
      await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe-vorrang', 0, 0, 0, 0, 2100, TRUE)`;
      await einstellungSetzen("aras_notaus", "an", "pruefstand");
      const tNot = await waehlerTakt();
      ok("ROT-PROBE: Not-Aus hält auch den vom Kunden gebuchten Rückruf (kein Anruf)", tNot.ausgelassen.some((a) => a.grund === "notaus") && (await anrufeVon(rA.pid)) === 0, JSON.stringify(tNot));
      await start("pruefstand");
      await sqlPool`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) VALUES ('aras-stimme', 'attrappe-notbremse', 0, 0, 0, 0, 30000, TRUE)`;
      const tBremse = await waehlerTakt();
      ok("ROT-PROBE: Notbremse (300 € — die höchste einstellbare Tagessumme) hält auch den Rückruf", tBremse.gewaehlt === 0 && tBremse.ausgelassen.some((a) => a.grund === "notbremse") && (await anrufeVon(rA.pid)) === 0, JSON.stringify(tBremse));
      await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell = 'attrappe-notbremse'`;
      const tV = await waehlerTakt();
      if (rueckrufZeit()) ok("22.10., 11:00: 40 Anrufe des Tages verbraucht UND 20-€-Deckel erreicht — der vom Kunden gebuchte Rückruf geht trotzdem raus, der Rate-Anruf nicht (Grund deckel)",
        tV.gewaehlt === 1 && (await anrufeVon(rA.pid)) === 1 && (await anrufeVon(kN.pid)) === 0 && tV.ausgelassen.some((a) => a.grund === "deckel"), JSON.stringify(tV));
      else ok("Außerhalb 08–21 Uhr: auch der Rückruf wartet (Nachtruhe)", tV.gewaehlt === 0 && tV.ausgelassen.some((a) => a.grund.startsWith("fenster:")), JSON.stringify(tV));
      await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell = 'attrappe-vorrang'`;
      await anrufeWeg(pMenge);

      // ── 2. Plätze freihalten: ein Rückruf wird in 5 Minuten fällig → die letzte freie Leitung bleibt für ihn ─────────────
      await neuerTag();
      const kB = await rateKunde(503); await rateEinreihen(kB);
      const rB = await rueckruf(504, new Date(Date.now() + 5 * 60_000), new Date(Date.now() + 35 * 60_000));
      const tB = await waehlerTakt();
      ok("Plätze freihalten: in 5 Minuten ist ein gebuchter Rückruf fällig — kein Rate-Anruf auf der letzten freien Leitung (Grund platz_fuer_rueckruf)", tB.gewaehlt === 0 && tB.ausgelassen.some((a) => a.grund === "platz_fuer_rueckruf") && (await anrufeVon(kB.pid)) === 0, JSON.stringify(tB));
      await sqlPool`UPDATE fiaon_aras_plan SET frueh_ab = NOW() + INTERVAL '15 minutes' WHERE id = ${rB.planId}`;
      const tB2 = await waehlerTakt();
      if (imFenster()) ok("Rot-Probe: der Rückruf erst in 15 Minuten → der Rate-Anruf geht jetzt", tB2.gewaehlt === 1 && (await anrufeVon(kB.pid)) === 1, JSON.stringify(tB2));

      // ── 3. Über den Tag verteilt: Freigabe = Deckel × verstrichener Anteil + 2, dazu der Mindestabstand ────────────────
      await neuerTag();
      const kC = await rateKunde(505); await rateEinreihen(kC);
      const freigabe = tagesFreigabe({ deckel: 40, jetzt: new Date(), fenster });
      const pMenge2 = await person(506);
      await anrufeHeute(pMenge2, freigabe, 30);
      const tC = await waehlerTakt();
      const erwartet = freigabe >= 40 ? "stufe_tagesmenge:40" : `verteilt:${freigabe}/40`;
      ok(`Verteilung (21./22.10.: alle 40 bis 10:07 weg): ${freigabe} von 40 sind bis jetzt frei und schon gewählt → kein weiterer Anruf (Grund ${erwartet})`, tC.gewaehlt === 0 && tC.ausgelassen.some((a) => a.grund === erwartet) && (await anrufeVon(kC.pid)) === 0, JSON.stringify(tC));
      await sqlPool`DELETE FROM fiaon_aras_anruf WHERE id = (SELECT MAX(a.id) FROM fiaon_aras_anruf a JOIN fiaon_calls c ON c.id = a.call_id WHERE c.person_id = ${pMenge2})`;
      const tC2 = await waehlerTakt();
      if (imFenster() && freigabe < 40) ok("… einer weniger (der letzte vor 30 Minuten) → der nächste Anruf ist frei", tC2.gewaehlt === 1 && (await anrufeVon(kC.pid)) === 1, JSON.stringify(tC2));
      await anrufeWeg(pMenge2); await neuerTag();
      const kC3 = await rateKunde(509); await rateEinreihen(kC3);
      await anrufeHeute(pMenge2, 1, 1);
      const tC3 = await waehlerTakt();
      ok("ROT-PROBE Mindestabstand: der letzte Anruf vor einer Minute → warten, auch wenn die Freigabe noch Platz hat (Grund abstand)", tC3.gewaehlt === 0 && tC3.ausgelassen.some((a) => a.grund === "abstand") && (await anrufeVon(kC3.pid)) === 0, JSON.stringify(tC3));
      await anrufeWeg(pMenge2);

      // ── 4. Anderer Tagesabschnitt: gestern zur selben Tageszeit nicht erreicht → heute erst in einem anderen Abschnitt ────
      await neuerTag();
      const minJetzt = (() => { const b = berlinTeile(new Date()); return Number(b.hhmm.slice(0, 2)) * 60 + Number(b.hhmm.slice(3)); })();
      const anderer = ({ vormittag: 18 * 60, mittag: 9 * 60 + 45, abend: 13 * 60 } as const)[tagesabschnitt(new Date())];
      const fehlversuch = (pid: number, nummer: string, am: Date) => sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ergebnis, twilio_sid)
        VALUES (${pid}, ${ausweis}, ${nummer}, 'raus', 'niemand_erreicht', ${am}, 'aras', 'nicht_erreicht', ${`CA-pruef-abschnitt-${pid}-${am.getTime()}`})`;
      const kD1 = await rateKunde(507); await fehlversuch(kD1.pid, kD1.nummer, berlinZeitpunkt(vor(1), minJetzt));
      const kD2 = await rateKunde(508); await fehlversuch(kD2.pid, kD2.nummer, berlinZeitpunkt(vor(1), anderer));
      const pl1 = await rateEinreihen(kD1); await rateEinreihen(kD2);
      const wahl = abschnittWahl({ spielart: "rate", fehlFolge: 1, letzterVersuchAm: berlinZeitpunkt(vor(1), minJetzt), jetzt: new Date(), fenster });
      const tD = await waehlerTakt();
      if (imFenster()) ok(`ROT-PROBE (dieselben Menschen zur fast gleichen Minute): gestern um diese Zeit nicht erreicht → bleibt liegen (${wahl}); wer gestern in einem ANDEREN Tagesabschnitt nicht erreicht wurde, ist jetzt dran`,
        tD.gewaehlt === 1 && (await anrufeVon(kD2.pid)) === 1 && (await anrufeVon(kD1.pid)) === 0 && tD.ausgelassen.some((a) => a.grund === `abschnitt:${wahl}`), JSON.stringify(tD));
      await neuerTag();
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'wartet' WHERE id = ${pl1}`;
      const tD2 = await waehlerTakt();
      if (imFenster() && wahl === "spaeter") ok("… allein in der Reihe: heute kommt noch ein anderer Abschnitt → er wartet darauf (Grund abschnitt:spaeter, kein Anruf)", tD2.gewaehlt === 0 && tD2.ausgelassen.some((a) => a.grund === "abschnitt:spaeter") && (await anrufeVon(kD1.pid)) === 0, JSON.stringify(tD2));
      else if (imFenster()) ok("… allein in der Reihe und heute kommt kein anderer Abschnitt mehr → notfalls doch (niemand sonst braucht den Platz)", tD2.gewaehlt === 1 && (await anrufeVon(kD1.pid)) === 1, JSON.stringify(tD2));

      // ── 5. Zahlungszusage: kein Rate-Anruf bis zum zugesagten Tag + 2 Bank-Werktage ─────────────────────────────────
      await neuerTag();
      const z1 = await rateKunde(510); await zusage(z1.ref, vor(1));
      const z2 = await rateKunde(511); await zusage(z2.ref, berlinTeile(new Date(Date.now() + 5 * 86_400_000)).datum);
      const z3 = await rateKunde(512); await zusage(z3.ref, vor(10), { vorher: "11 days" });
      const z4 = await rateKunde(513); await zusage(z4.ref, vor(1), { vorher: "2 days" });
      await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${z4.ref}, 1, ${`${z4.ref}-1`}, 5999, ${vor(40)}::date, 'bezahlt', NOW() - INTERVAL '1 day')`;
      const z5 = await rateKunde(514); await zusage(z5.ref, vor(1), { voided: true });
      const fZ = await planFuellen();
      const rateZeile = async (pid: number) => ((await sqlPool`SELECT id, status FROM fiaon_aras_plan WHERE person_id = ${pid} AND spielart = 'rate' AND status = 'wartet'`) as any[])[0] ?? null;
      ok("ROT-PROBE 21./22.10.: „zahle heute“ (gestern) und eine Zusage für nächste Woche → KEIN Rate-Eintrag (Pause bis zum Tag + 2 Bank-Werktage)",
        !(await rateZeile(z1.pid)) && !(await rateZeile(z2.pid)) && Object.keys(fZ.uebersprungen).some((k) => k.startsWith("rate:Zahlungszusage")), JSON.stringify(fZ.uebersprungen));
      ok("Alte Zusage (Pause vorbei), seit der Zusage eine Rate bezahlt, Zusage zurückgenommen → Rate-Eintrag wie immer",
        !!(await rateZeile(z3.pid)) && !!(await rateZeile(z4.pid)) && !!(await rateZeile(z5.pid)));
      ok("Die Zusage hängt an der Bestellung (Akte ohne person_id, wie in der Produktion) — gefunden über die Person; Pause = zugesagter Tag + 2 Bank-Werktage",
        (await zusagePauseFuer(z1.pid))?.bis === zusagePause(vor(1)).bis && (await zusagePauseFuer(z3.pid)) === null, JSON.stringify(await zusagePauseFuer(z1.pid)));
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status = 'wartet'`;
      // Schon eingereiht (der Füller lief um 00:04), dann „zahle heute“ → der nächste Füller-Lauf stellt ihn zurück
      const z6 = await rateKunde(515); const pl6 = await rateEinreihen(z6, "takt");
      await zusage(z6.ref, heute);
      await planFuellen();
      const s6 = await status(pl6);
      ok("Schon eingereiht, dann „zahle heute“ → zurückgestellt: „verschoben“ mit Grund, zurück erst am Tag nach der Pause",
        s6?.status === "verschoben" && /Zahlungszusage/.test(String(s6?.verschoben_grund)) && berlinTeile(new Date(s6.frueh_ab)).datum === zusagePause(heute).wiederAb, JSON.stringify(s6));
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status = 'wartet'`;
      // Vor dem Wählen: inzwischen „zahle heute“ (ohne Füller-Lauf dazwischen) → nicht wählen; Rate inzwischen bezahlt → aus der Reihe
      const z7 = await rateKunde(516); const pl7 = await rateEinreihen(z7, "takt");
      await zusage(z7.ref, heute);
      const z8 = await rateKunde(517); const pl8 = await rateEinreihen(z8);
      await sqlPool`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE id = ${z8.rateId}`;
      const t78 = await waehlerTakt();
      const s7 = await status(pl7), s8 = await status(pl8);
      ok("Vor dem Wählen: inzwischen „zahle heute“ gesagt → kein Anruf, der Eintrag wartet bis nach der Überweisungszeit", s7?.status === "verschoben" && (await anrufeVon(z7.pid)) === 0 && t78.ausgelassen.some((a) => a.grund === "rate:zahlungszusage"), JSON.stringify({ s7, t78 }));
      ok("Vor dem Wählen: die Rate ist inzwischen bezahlt → fällt aus der Reihe, kein Anruf", s8?.status === "verfallen" && /bezahlt/.test(String(s8?.verschoben_grund)) && (await anrufeVon(z8.pid)) === 0, JSON.stringify(s8));
      // „Wieder einreihen“ in der Warteschlange (ein Mensch entscheidet): weder Füller noch Wähler stellen den Eintrag erneut zurück
      await planVerschieben(pl7, new Date(), "Prüfstand: trotzdem anrufen", "Chef #1");
      await planFuellen();
      const s7a = await status(pl7);
      const t7b = await waehlerTakt();
      const s7b = await status(pl7);
      ok("Ein Mensch reiht den zurückgestellten Eintrag wieder ein → Füller und Wähler stellen ihn nicht erneut zurück (er entscheidet)",
        s7a?.status === "wartet" && s7b?.status !== "verschoben" && !t7b.ausgelassen.some((a) => a.grund === "rate:zahlungszusage") && (!imFenster() || (await anrufeVon(z7.pid)) === 1), JSON.stringify({ s7a: s7a?.status, s7b: s7b?.status, t7b }));
      await neuerTag();
      const z10 = await rateKunde(523); const pl10 = await rateEinreihen(z10, "chef");
      await zusage(z10.ref, heute);
      const weg10 = await rateEntfaellt({ id: pl10, person_id: z10.pid, rate_id: z10.rateId, erzeugt_von: "chef" }, await arasEinstellungenLesen(true));
      const weg10t = await rateEntfaellt({ id: pl10, person_id: z10.pid, rate_id: z10.rateId, erzeugt_von: "takt" }, await arasEinstellungenLesen(true));
      ok("Von Hand eingereiht (Chef) ruft ARAS trotz Zusage an — der Mensch hat es so gewollt; derselbe Eintrag vom Füller würde warten", weg10 === null && weg10t?.status === "verschoben", JSON.stringify({ weg10, weg10t }));
      // Ein neuer Eintrag des Füllers löst den alten, verschobenen derselben Person ab (nie zwei zur selben Sache)
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status = 'wartet'`;
      const z9 = await rateKunde(518);
      const [alt9] = (await sqlPool`INSERT INTO fiaon_aras_plan (person_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, frueh_ab, spaet_bis, erzeugt_von, status, rate_id, created_at)
                                    VALUES (${z9.pid}, ${z9.ref}, ${z9.nummer}, 'DE', 'rate', 3, 'Prüfstand alt', 'vertrag', NOW() + INTERVAL '5 hours', NOW() + INTERVAL '30 hours', 'takt', 'verschoben', ${z9.rateId}, NOW() - INTERVAL '1 day') RETURNING id`) as any[];
      await planFuellen();
      const s9 = await status(Number(alt9.id));
      ok("Ein neuer Eintrag des Füllers löst den alten, verschobenen derselben Person ab (nie zwei zur selben Sache)", !!(await rateZeile(z9.pid)) && s9?.status === "verfallen" && /abgelöst/.test(String(s9?.verschoben_grund)), JSON.stringify(s9));
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;

      // ── 6. Berliner Datum: der Füller läuft um 00:04 Berlin, die DB-Sitzung in UTC — CURRENT_DATE ist dann gestern ───────
      const postgres = (await import("postgres")).default;
      for (const zone of ["Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
        const s = postgres(String(process.env.DATABASE_URL), { ssl: "require", max: 1, onnotice: () => {}, connection: { TimeZone: zone } as any });
        const [d] = (await s`SELECT CURRENT_DATE::text AS d`) as any[];
        if (d?.d !== heute) { fern = Object.assign(s, { zone }); break; }
        await s.end({ timeout: 2 });
      }
      ok("Prüf-Sitzung in einer fernen Zeitzone: CURRENT_DATE ist dort ein anderer Tag als in Berlin (sonst könnte die Probe nicht rot werden)", !!fern, String(fern?.zone ?? ""));
      if (fern) {
        const kBd = await rateKunde(519, 1);
        await planFuellen(fern);
        const [rBd] = (await sqlPool`SELECT grund FROM fiaon_aras_plan WHERE person_id = ${kBd.pid} AND spielart = 'rate' ORDER BY id DESC LIMIT 1`) as any[];
        ok(`ROT-PROBE Berliner Datum: eine gestern (Berlin) fällige Rate ist „seit gestern überfällig“ — auch wenn die DB-Sitzung in ${fern.zone} rechnet (dort wäre sie „heute fällig“ oder „seit 2 Tagen“)`, rBd?.grund === "Rate 2 seit gestern überfällig", JSON.stringify(rBd ?? null));
        await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
      }

      // ── 7. Rückruf verpasst (z. B. Not-Aus): nie still verfallen — Aufgabe für das Team, Karte, Protokoll ─────────────────
      await neuerTag();
      await einstellungSetzen("aras_notaus", "an", "pruefstand");
      const g1 = await rueckruf(520, new Date(Date.now() - 45 * 60_000), new Date(Date.now() - 2 * 60_000));
      const g2 = await rueckruf(521, new Date(Date.now() - 45 * 60_000), new Date(Date.now() - 2 * 60_000));
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verschoben', verschoben_grund = 'Twilio: Prüfstand' WHERE id = ${g2.planId}`;
      const g3 = await rateKunde(522); const pl3 = await rateEinreihen(g3, "chef", { fruehAb: new Date(Date.now() - 45 * 60_000), spaetBis: new Date(Date.now() - 2 * 60_000) });
      await planFuellen();
      const aufgabe = async (planId: number) => (await sqlPool`SELECT id, titel, text, prioritaet, person_id, status FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:rueckruf_verpasst:${planId}`}`) as any[];
      const a1 = await aufgabe(g1.planId), a2 = await aufgabe(g2.planId);
      ok("22.10.: der Rückruf verfiel still — jetzt: Not-Aus, Zeit um → Aufgabe „Rückruf verpasst — bitte anrufen“ für das Team (dringend, am Kunden, Grund Not-Aus)",
        a1.length === 1 && /Rückruf verpasst — bitte anrufen/.test(String(a1[0].titel)) && Number(a1[0].prioritaet) === 1 && Number(a1[0].person_id) === g1.pid && /Not-Aus/.test(String(a1[0].text)) && (await status(g1.planId))?.status === "verfallen", JSON.stringify(a1));
      const s2 = await status(g2.planId);
      ok("Auch ein Rückruf, der nach einem Twilio-Fehler „verschoben“ hängen blieb, bekommt die Meldung — der alte Grund bleibt hinten stehen", a2.length === 1 && s2?.status === "verfallen" && /^Rückruf verpasst .*Twilio: Prüfstand/.test(String(s2?.verschoben_grund)), JSON.stringify({ a2, s2 }));
      const [karte] = (await sqlPool`SELECT text FROM fiaon_system_alarme WHERE schluessel = 'aras:rueckruf_verpasst' AND vorbei_am IS NULL`) as any[];
      const proto = (await sqlPool`SELECT 1 FROM fiaon_mara_protokoll WHERE kanal = 'telefon' AND art = 'aras_termin' AND ok = FALSE AND (daten->>'planId')::bigint IN (${g1.planId}, ${g2.planId})`) as any[];
      ok("Karte auf der Tafel (aras:rueckruf_verpasst) und je Fall ein Eintrag im ARAS-Protokoll", !!karte && /bitte anrufen|Rückruf/.test(String(karte.text)) && proto.length === 2, JSON.stringify({ karte, proto: proto.length }));
      ok("Rot-Probe: ein abgelaufener normaler Rate-Anruf verfällt ohne Meldung", (await aufgabe(pl3)).length === 0 && (await status(pl3))?.status === "verfallen");
      await planFuellen();
      ok("Zweiter Füller-Lauf: weiter genau EINE Aufgabe je verpasstem Rückruf", (await aufgabe(g1.planId)).length === 1 && (await aufgabe(g2.planId)).length === 1);
      await start("pruefstand");

      // ── 8. Willkommen: genau EIN zweiter Versuch nach Mailbox / nicht erreicht (frühestens 2,5 h danach, ≤ 24 h nach der Unterschrift) ─
      await neuerTag();
      const andererAbschnitt = (t: Date) => tagesabschnitt(t) !== tagesabschnitt(new Date());
      const ersterAm = [2.7, 6, 13, 20].map((h) => new Date(Date.now() - h * 3600_000)).find(andererAbschnitt) ?? new Date(Date.now() - 2.7 * 3600_000);
      const willkommenFall = async (n: number, o: { erster: Date; ergebnis: string; unterschriftVorStd?: number; teamAnruf?: boolean; wocheVoll?: boolean }) => {
        const pid = await person(n); const ref = await antrag(pid, n, { payment_status: "pending_payment" });
        const nummer = `+4917000000${n}`;
        const am = o.unterschriftVorStd ? new Date(Date.now() - o.unterschriftVorStd * 3600_000) : new Date(o.erster.getTime() - 30 * 60_000);
        await sqlPool`
          INSERT INTO fiaon_vertragsannahmen (ref, person_id, weg, angenommen_am, paket, rate_cents, gesamt_cents, vertrag_fassung, leistung_fassung, agb_fassung, knopf_text, haken, sofort_beginn, vertrag_html, vertrag_sha256)
          VALUES (${ref}, ${pid}, 'neu', ${am}, 'plus', 5999, 71988, 'PV-test', 'L-test', 'AGB-test', 'Zahlungspflichtig annehmen', '{}'::jsonb, FALSE, '<p>Test</p>', 'test')`;
        const [pl] = (await sqlPool`INSERT INTO fiaon_aras_plan (person_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, frueh_ab, spaet_bis, erzeugt_von, status, created_at)
                                    VALUES (${pid}, ${ref}, ${nummer}, 'DE', 'willkommen', 2, 'Antrag unterschrieben — Willkommen', 'vertrag', ${o.erster}, ${new Date(am.getTime() + 24 * 3600_000)}, 'takt', 'fertig', ${o.erster}) RETURNING id`) as any[];
        const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ergebnis, twilio_sid)
                                   VALUES (${pid}, ${ausweis}, ${nummer}, 'raus', ${o.ergebnis.startsWith("erreicht") ? "beendet" : "niemand_erreicht"}, ${o.erster}, 'aras', ${o.ergebnis}, ${`CA-pruef-willkommen-${n}`}) RETURNING id`) as any[];
        await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, briefing, adapter, stimme, prompt_version, ergebnis, created_at)
                      VALUES (${c.id}, ${pl.id}, 'willkommen', '{}'::jsonb, 'attrappe', 'juni', 'pruefstand', ${o.ergebnis}, ${o.erster})`;
        if (o.teamAnruf) await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ergebnis) VALUES (${pid}, ${ausweis}, ${nummer}, 'raus', 'beendet', NOW() - INTERVAL '1 hour', 'mensch', 'erreicht_sonstiges')`;
        if (o.wocheVoll) await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von, ergebnis) VALUES (${pid}, ${ausweis}, ${nummer}, 'raus', 'beendet', NOW() - INTERVAL '3 days', 'mensch', 'erreicht_sonstiges'), (${pid}, ${ausweis}, ${nummer}, 'raus', 'beendet', NOW() - INTERVAL '4 days', 'mensch', 'erreicht_sonstiges')`;
        return { pid, ref, am };
      };
      const w1 = await willkommenFall(530, { erster: ersterAm, ergebnis: "mailbox" });
      const w2 = await willkommenFall(531, { erster: ersterAm, ergebnis: "erreicht_sonstiges" });
      const w3 = await willkommenFall(532, { erster: ersterAm, ergebnis: "mailbox", teamAnruf: true });
      const w4erster = new Date(Date.now() - 60 * 60_000);
      const w4 = await willkommenFall(533, { erster: w4erster, ergebnis: "nicht_erreicht" });
      const w5 = await willkommenFall(534, { erster: new Date(Date.now() - 23 * 3600_000), ergebnis: "mailbox", unterschriftVorStd: 25 });
      const w6 = await willkommenFall(535, { erster: ersterAm, ergebnis: "mailbox", wocheVoll: true });
      await planFuellen();
      const zweiter = async (ref: string) => ((await sqlPool`SELECT id, versuch_nr, status, frueh_ab, spaet_bis FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND ref = ${ref} AND versuch_nr = 2`) as any[]);
      const zw1 = await zweiter(w1.ref), zw4 = await zweiter(w4.ref);
      ok("Willkommen (21.10.: alle fünf Mailbox oder nicht abgenommen, danach nichts): erster Versuch Mailbox → GENAU EIN zweiter Versuch, ab jetzt, spätestens 24 h nach der Unterschrift",
        zw1.length === 1 && zw1[0].status === "wartet" && Math.abs(new Date(zw1[0].frueh_ab).getTime() - Math.max(Date.now(), ersterAm.getTime() + 150 * 60_000)) < 120_000 && Math.abs(new Date(zw1[0].spaet_bis).getTime() - (w1.am.getTime() + 24 * 3600_000)) < 1000, JSON.stringify(zw1));
      ok("Nicht erreicht erst vor 1 h → der zweite Versuch steht, aber frühestens 2,5 h nach dem ersten", zw4.length === 1 && Math.abs(new Date(zw4[0].frueh_ab).getTime() - (w4erster.getTime() + 150 * 60_000)) < 1000, JSON.stringify(zw4));
      ok("ROT-PROBEN: beim ersten erreicht, ein Anruf vom Team in den letzten 24 h, Unterschrift älter als 24 h → KEIN zweiter Versuch",
        (await zweiter(w2.ref)).length === 0 && (await zweiter(w3.ref)).length === 0 && (await zweiter(w5.ref)).length === 0);
      ok("ARAS' eigener erster Versuch ohne Gespräch zählt nicht als „Anruf in 24 h“ — ein Anruf vom Team schon", (await willkommenEntfaellt(w1.ref)) === null && (await willkommenEntfaellt(w3.ref)) === "Anruf in den letzten 24 h");
      await planFuellen();
      const jeVertrag = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE spielart = 'willkommen' AND ref = ${w1.ref}`) as any[])[0]?.n ?? 0);
      ok("ROT-PROBE: nie ein dritter — der nächste Füller-Lauf legt nichts nach (genau zwei Einträge je Vertrag)", jeVertrag === 2, String(jeVertrag));
      // Wählen: der zweite Versuch zählt bei den Grenzen je Person mit (w6 hatte diese Woche schon zwei Anrufe + den ersten Versuch)
      await sqlPool`UPDATE fiaon_aras_plan SET frueh_ab = frueh_ab + INTERVAL '1 day' WHERE spielart = 'willkommen' AND ref = ${w1.ref} AND versuch_nr = 2`;
      const tW6 = await waehlerTakt();
      if (imFenster()) ok("ROT-PROBE: der zweite Versuch zählt bei den Grenzen je Person mit — drei Versuche diese Woche → kein Anruf (je_person_woche)", (await anrufeVon(w6.pid)) === 0 && tW6.ausgelassen.some((a) => a.grund === "je_person_woche"), JSON.stringify(tW6));
      await sqlPool`UPDATE fiaon_aras_plan SET frueh_ab = frueh_ab - INTERVAL '1 day' WHERE spielart = 'willkommen' AND ref = ${w1.ref} AND versuch_nr = 2`;
      await neuerTag();
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'wartet' WHERE id = ${Number(zw1[0]?.id ?? 0)}`;
      const tW1 = await waehlerTakt();
      const gleicherTag = berlinTeile(ersterAm).datum === heute;
      if (imFenster()) ok(`Der zweite Versuch wird gewählt (anderer Tagesabschnitt als der erste${gleicherTag ? "; derselbe Tag — der erste Versuch ohne Gespräch sperrt ihn nicht" : ""})`, tW1.gewaehlt === 1 && (await anrufeVon(w1.pid)) === 1, JSON.stringify(tW1));
    } finally {
      if (fern) await fern.end({ timeout: 2 }).catch(() => {});
      await sqlPool`DELETE FROM fiaon_ki_nutzung WHERE modell IN ('attrappe-vorrang', 'attrappe-notbremse')`;
      await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen', call_id = NULL WHERE status IN ('gewaehlt', 'wartet', 'verschoben')`;
      await start("pruefstand");
      await einstellungSetzen("aras_je_stunde", "40", "pruefstand");
      await einstellungSetzen("aras_stufe", "0", "pruefstand");
    }
  }

  titel("29. AUSWERTUNG 21./22.10. (Scheibe 3): Identität vor dem Anliegen · Zahltag-Sätze · Streitfall · Ansage statt Mensch · Wort halten bis zum Schluss");
  {
    await einstellungSetzen("aras_stufe", "3", "pruefstand"); await einstellungSetzen("aras_an", "an", "pruefstand"); await einstellungSetzen("aras_zuhoeren", "flott", "pruefstand"); await start("pruefstand");
    await sqlPool`UPDATE fiaon_calls SET status = 'beendet', ende = COALESCE(ende, NOW()) WHERE gefuehrt_von = 'aras' AND status IN ('gewaehlt', 'laeuft')`;
    const { HINWEIS_STREITFALL, KORREKTUR_ZUSAGE } = await import("../shared/fiaon-aras-wort");
    const { ergebnisseTag } = await import("../server/lib/fiaon-aras-ergebnisse");
    const wz = async (callId: number, name: string) => (await sqlPool`SELECT w.ok, w.aufruf_id, w.eingabe FROM fiaon_aras_werkzeug w JOIN fiaon_aras_anruf a ON a.id = w.aras_anruf_id WHERE a.call_id = ${callId} AND w.werkzeug = ${name} ORDER BY w.id`) as any[];
    const kunde = async (n: number) => { const pid = await person(n); const ref = await antrag(pid, n, { payment_status: "paid" });
      const [r] = (await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${ref}-2`}, 5999, ${vor(4)}::date, 'offen') RETURNING id`) as any[];
      const e = await planEinreihen({ personId: pid, ref, nummer: `+4917000000${n}`, spielart: "rate", grund: "Prüfstand Scheibe 3", erzeugtVon: "chef", rateId: Number(r.id), anlassAm: new Date(`${vor(4)}T10:00:00Z`) });
      if (!e.ok || !e.id) throw new Error(`einreihen: ${e.grund}`); return { pid, ref, planId: Number(e.id), n }; };
    type K = Awaited<ReturnType<typeof kunde>>;
    const anrufMit = async (k: K, schritte: Parameters<typeof attrappeMitSkript>[0]["schritte"]) => gespraech(k.planId, { schritte });
    const fertig = async (g: { tw: InstanceType<typeof TwilioAttrappe>; callId: number }) => { if (!g.tw.istZu()) g.tw.aufhaengen(); await warten(async () => !!(await anruf(g.callId))?.nachbereitet_am, 15_000); return anruf(g.callId); };
    /** Die neue Eröffnung: KI-Hinweis, dann die Frage nach der Person — und sein Ja, nachdem er sie gehört hat. */
    const frageNachPerson = (n: number) => `${KI_HINWEIS_VORGABE} Spreche ich mit Herrn Prüfkunde${n} selbst?`;
    const bestaetigt = (n: number): any[] => [{ aras: frageNachPerson(n), ms: 300 }, { kunde: "Ja, am Apparat.", nachMs: 600 }, { warteMs: 400 }];
    const korrekturen = (g: { att: { spur: { eingeschoben: { text: string; art: string }[] } } }) => g.att.spur.eingeschoben.filter((x) => /Er hat noch NICHT bestätigt, dass er selbst dran ist/.test(x.text));
    const rate = "I ruf an wegen Ihrer offenen Rate über neunundfünfzig Euro neunundneunzig.";
    const heute = yyyy(new Date());
    const plusTage = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const [hj, hm, ht] = heute.split("-").map(Number);
    const naechsterErster = ht === 1 ? heute : `${hm === 12 ? hj + 1 : hj}-${String(hm === 12 ? 1 : hm + 1).padStart(2, "0")}-01`;
    const wtHeute = new Date(`${heute}T12:00:00Z`).getUTCDay() || 7;
    const dienstagNaechsteWoche = plusTage(heute, 7 - wtHeute + 2);

    // ── 1. IDENTITÄT VOR DEM ANLIEGEN ──
    {
      const [k1, k2, k3, k3b, k4] = [await kunde(460), await kunde(461), await kunde(462), await kunde(463), await kunde(464)];
      // a) Rot-Probe (Auswertung + Abstimmung mit der Prüf-Regel 22.10.): mit Namen begrüßt, „… habens an Moment?“ — nur „Ja.“ —
      //    „Ihre Rate über …“ → der Gruß ist keine Frage nach der Person: still die Korrektur, genau eine (je Zeile)
      const g1 = await anrufMit(k1, [{ aras: "Grüß Sie, Herr Prüfkunde460! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam. Kurz vorweg: I bin a KI, aber a nette. Habens an Moment?", ms: 300 },
        { kunde: "Ja.", nachMs: 600 }, { warteMs: 400 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      // b) „Spreche ich mit Herrn … selbst?“ — „Ja, am Apparat.“ — dann die Rate: keine Korrektur
      const g2 = await anrufMit(k2, [...bestaetigt(461), { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      // c) „Mit wem spreche ich, bitte?“ — er nennt seinen Namen (c2: zerrissen in der Abschrift: „Hier ist“ · „- Prüfkun“)
      const g3 = await anrufMit(k3, [{ aras: `${KI_HINWEIS_VORGABE} Mit wem spreche ich, bitte?`, ms: 300 }, { kunde: "Prüfkunde462, hallo.", nachMs: 600 }, { warteMs: 400 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      const g3b = await anrufMit(k3b, [{ aras: `${KI_HINWEIS_VORGABE} Mit wem spreche ich, bitte?`, ms: 300 }, { kunde: "Hier ist", nachMs: 600 }, { warteMs: 1300 }, { kunde: "- Prüfkun", nachMs: 100 }, { warteMs: 1300 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      // d) Rot-Probe: die Frau geht ran — „Nein, hier ist seine Frau.“ → die Rate danach: Korrektur
      const g4 = await anrufMit(k4, [{ aras: frageNachPerson(464), ms: 300 }, { kunde: "Nein, hier ist seine Frau.", nachMs: 600 }, { warteMs: 400 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      await schlafen(4500);
      const z1 = laufZahlen(g1.callId), z2 = laufZahlen(g2.callId), z3 = laufZahlen(g3.callId), z3b = laufZahlen(g3b.callId), z4 = laufZahlen(g4.callId);
      const k1t = korrekturen(g1);
      ok("Identität (Rot-Probe Auswertung): mit Namen begrüßt, nur „Ja.“ auf „habens an Moment?“, dann der Betrag → KEINE Bestätigung: still GENAU EINE Korrektur mit der Frage nach der Person",
        !z1?.identitaet.bestaetigt && k1t.length === 1 && k1t[0].art === "anweisung" && /„Entschuldigung — spreche ich mit Herrn Prüfkunde460 selbst\?“/.test(k1t[0].text) && z1?.identitaet.korrekturen === 1, JSON.stringify({ id: z1?.identitaet, n: k1t.length }));
      ok("Identität: „Spreche ich mit Herrn … selbst?“ — „Ja, am Apparat.“ → bestätigt (Ja), die Rate danach ohne Korrektur", !!z2?.identitaet.bestaetigt && z2.identitaet.wie === "ja" && korrekturen(g2).length === 0, JSON.stringify(z2?.identitaet));
      ok("Identität: „Mit wem spreche ich, bitte?“ — er nennt seinen Nachnamen (auch zerrissen: „Hier ist“ · „- Prüfkun“) → bestätigt (Name), keine Korrektur",
        z3?.identitaet.wie === "name" && korrekturen(g3).length === 0 && z3b?.identitaet.wie === "name" && korrekturen(g3b).length === 0, JSON.stringify({ c: z3?.identitaet, c2: z3b?.identitaet }));
      ok("Identität (Rot-Probe): „Nein, hier ist seine Frau.“ → verneint, nicht bestätigt — die Rate danach wird still korrigiert", !!z4?.identitaet.verneint && !z4.identitaet.bestaetigt && korrekturen(g4).length === 1, JSON.stringify(z4?.identitaet));
      for (const g of [g1, g2, g3, g3b, g4]) await fertig(g);
      const proto = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE kanal = 'telefon' AND (daten->>'callId')::int = ${g1.callId} AND daten->>'regel' = 'anliegen_vor_identitaet'`) as any[];
      ok("… die Korrektur steht im Protokoll („Identität noch offen — ARAS nannte „Rate“ zu früh“), ohne Wortlaut des Kunden", proto.length === 1 && /Identität noch offen — ARAS nannte „Rate“ zu früh/.test(proto[0].text), JSON.stringify(proto));

      // e) Eröffnung vorab (beim Klingeln/Abheben vorbereitet): sein „Ja, hallo?“ beim ABHEBEN ist keine Antwort — die Frage hört er erst danach
      delete process.env.ARAS_EROEFFNUNG_SOFORT;
      const [k5, k6] = [await kunde(465), await kunde(466)];
      const g5 = await anrufMit(k5, [{ aras: frageNachPerson(465), ms: 1500, ton: { dbfs: -24 } }, { beiKundenStimme: "Ja, hallo?" }, { nachKundeStillMs: 3200 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      await schlafen(1000); g5.tw.laut(600);
      await schlafen(6500);
      const z5 = laufZahlen(g5.callId);
      ok("Identität (Rot-Probe beim Klingeln vorbereitet): sein „Ja, hallo?“ beim Abheben zählt NIE — die Frage kam erst danach bei ihm an; die Rate danach wird still korrigiert",
        !!z5?.identitaet.frage && !z5.identitaet.bestaetigt && korrekturen(g5).length === 1, JSON.stringify(z5?.identitaet));
      await fertig(g5);
      const g6 = await anrufMit(k6, [{ aras: frageNachPerson(466), ms: 1500, ton: { dbfs: -24 } }, { beiKundenStimme: "Hallo?" }, { nachKundeStillMs: 2800 }, { kunde: "Ja, am Apparat.", nachMs: 100 }, { warteMs: 700 }, { aras: rate, ms: 400 }, { warteMs: 1500 }]);
      await schlafen(1000); g6.tw.laut(600);
      await schlafen(7000);
      const z6 = laufZahlen(g6.callId);
      ok("Identität beim Klingeln vorbereitet: sein Ja NACH der gehörten Frage bestätigt — die Rate danach ohne Korrektur", !!z6?.identitaet.bestaetigt && korrekturen(g6).length === 0, JSON.stringify(z6?.identitaet));
      await fertig(g6);
      process.env.ARAS_EROEFFNUNG_SOFORT = "1";

      // f) Seine Antwort ist noch nicht fertig abgeschrieben (Zeile offen, kein Satzzeichen), da nennt ARAS schon die Rate: erst seine
      //    Zeile lesen — „Ja am Apparat“ bestätigt, KEINE Korrektur; g) Rot-Probe: „Nein hier ist seine Frau“ → die Korrektur kommt danach
      const [k7, k9] = [await kunde(467), await kunde(469)];
      const g7 = await anrufMit(k7, [{ aras: frageNachPerson(467), ms: 300 }, { kunde: "Ja am Apparat", nachMs: 600 }, { warteMs: 150 }, { aras: rate, ms: 400 }, { warteMs: 2000 }]);
      const g9 = await anrufMit(k9, [{ aras: frageNachPerson(469), ms: 300 }, { kunde: "Nein hier ist seine Frau", nachMs: 600 }, { warteMs: 150 }, { aras: rate, ms: 400 }, { warteMs: 2000 }]);
      await schlafen(4000);
      const z7 = laufZahlen(g7.callId), z9 = laufZahlen(g9.callId);
      ok("Identität: seine Antwort noch offen in der Abschrift („Ja am Apparat“ ohne Satzzeichen), ARAS nennt schon die Rate → erst seine Zeile lesen: bestätigt, KEINE Korrektur",
        !!z7?.identitaet.bestaetigt && z7.identitaet.wie === "ja" && korrekturen(g7).length === 0, JSON.stringify(z7?.identitaet));
      ok("Identität (Rot-Probe): „Nein hier ist seine Frau“ noch offen, ARAS nennt schon die Rate → nach seiner Zeile still GENAU EINE Korrektur",
        !!z9?.identitaet.verneint && !z9.identitaet.bestaetigt && korrekturen(g9).length === 1, JSON.stringify(z9?.identitaet));
      for (const g of [g7, g9]) await fertig(g);
    }

    // ── 2. ZAHLTAG-SÄTZE ──
    {
      const [kA, kB, kC, kD, kE] = [await kunde(470), await kunde(471), await kunde(472), await kunde(473), await kunde(474)];
      const frage = { aras: "Geht sich des heute noch aus?", ms: 300 };
      // a) Echtgespräch 22.10.: „es geht immer am Ersten bei mir“ — das Modell trägt nichts ein → die Brücke trägt den nächsten Ersten ein
      const gA = await anrufMit(kA, [...bestaetigt(470), frage, { warteMs: 700 }, { kunde: "Na, es geht immer am Ersten bei mir.", nachMs: 200 }, { warteMs: 12_000 }]);
      // b) „Nein, erst nächsten Dienstag.“ + „Alles klar, dann notiere ich mir den Dienstag.“ → sofort: Dienstag der nächsten Kalenderwoche
      const gB = await anrufMit(kB, [...bestaetigt(471), frage, { warteMs: 700 }, { kunde: "Nein, erst nächsten Dienstag.", nachMs: 200 }, { warteMs: 400 }, { aras: "Alles klar, dann notiere ich mir den Dienstag.", ms: 300 }, { warteMs: 3000 }]);
      // c) Rot-Probe: Unklares („Mitte nächster Woche, wenn das Gehalt kommt“) + „Des merk i mir.“ → nichts eingetragen, still die Rückfrage
      const gC = await anrufMit(kC, [...bestaetigt(472), frage, { warteMs: 700 }, { kunde: "Mitte nächster Woche, wenn das Gehalt kommt.", nachMs: 200 }, { warteMs: 400 }, { aras: "Des merk i mir.", ms: 300 }, { warteMs: 12_000 }]);
      // d) Rot-Probe: die Zeit für einen Rückruf ist kein Zahltag
      const gD = await anrufMit(kD, [...bestaetigt(473), { aras: "Wann passt es Ihnen für einen Rückruf?", ms: 300 }, { warteMs: 700 }, { kunde: "Morgen um zehn.", nachMs: 200 }, { warteMs: 12_000 }]);
      // e) „Geht sich des heute noch aus?“ — „Ja.“ → heute (die Anweisung sagt es der Stimme genauso)
      const gE = await anrufMit(kE, [...bestaetigt(474), frage, { warteMs: 700 }, { kunde: "Ja.", nachMs: 200 }, { warteMs: 12_000 }]);
      await warten(async () => (await wz(gA.callId, "zahlungszusage_merken")).length > 0 && (await wz(gE.callId, "zahlungszusage_merken")).length > 0, 16_000);
      await schlafen(1500);
      const zA = await wz(gA.callId, "zahlungszusage_merken"), zB = await wz(gB.callId, "zahlungszusage_merken"), zC = await wz(gC.callId, "zahlungszusage_merken"), zD = await wz(gD.callId, "zahlungszusage_merken"), zE = await wz(gE.callId, "zahlungszusage_merken");
      ok(`Zahltag „am Ersten“ (Echtgespräch 22.10.) → die Brücke trägt den nächsten Ersten ein (${naechsterErster})`, zA.length === 1 && zA[0].ok && zA[0].eingabe?.datum === naechsterErster && String(zA[0].aufruf_id).startsWith("bruecke_wort_"), JSON.stringify(zA));
      ok(`Zahltag „erst nächsten Dienstag“ + ARAS „notiere ich mir den Dienstag“ → sofort eingetragen: Dienstag der nächsten Kalenderwoche (${dienstagNaechsteWoche}), keine Rückfrage`, zB.length === 1 && zB[0].ok && zB[0].eingabe?.datum === dienstagNaechsteWoche && !gB.att.spur.eingeschoben.some((x) => x.text === KORREKTUR_ZUSAGE), JSON.stringify(zB));
      ok("Rot-Probe: Unklares („Mitte nächster Woche, wenn das Gehalt kommt“) + „Des merk i mir.“ → nichts eingetragen, still die Rückfrage nach dem Tag", zC.length === 0 && gC.att.spur.eingeschoben.some((x) => x.art === "anweisung" && x.text === KORREKTUR_ZUSAGE), JSON.stringify(zC));
      ok("Rot-Probe: „Wann passt es Ihnen für einen Rückruf?“ — „Morgen um zehn.“ ist kein Zahltag → keine Zusage", zD.length === 0, JSON.stringify(zD));
      ok("„Geht sich des heute noch aus?“ — „Ja.“ → Zahltag heute eingetragen", zE.length === 1 && zE[0].ok && zE[0].eingabe?.datum === heute, JSON.stringify(zE));
      for (const g of [gA, gB, gC, gD, gE]) await fertig(g);
    }

    // ── 3. STREITFALL ──
    {
      const [kS, kN] = [await kunde(480), await kunde(481)];
      const gS = await anrufMit(kS, [...bestaetigt(480),
        { aras: "I ruf an wegen Ihrer offenen Rate — i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte.", ms: 500 }, { warteMs: 700 },
        { kunde: "Ich hab eine Betrugsanzeige erstattet, das ist Abzocke.", nachMs: 200 }, { warteMs: 800 },
        { aras: "Der Link kommt gleich per WhatsApp an.", ms: 300 }, { warteMs: 300 },
        { werkzeug: "zahlungslink_senden", eingabe: { weg: "whatsapp", zweck: "rate" } },
        { werkzeug: "aufgabe_fuer_justin", eingabe: { art: "sonstiges", text: "Kunde spricht von Betrug und Anzeige." } },
        { werkzeug: "zahlungszusage_merken", eingabe: { datum: morgen } },
        { warteMs: 11_000 },
      ]);
      // Rot-Probe: „Anzeige auf Instagram“ ist Werbung, kein Streitfall
      const gN = await anrufMit(kN, [...bestaetigt(481), { kunde: "Ich hab Sie über eine Anzeige auf Instagram gefunden.", nachMs: 200 }, { warteMs: 2500 }]);
      await warten(() => gS.att.spur.werkzeuge.length >= 3, 12_000);
      await schlafen(10_500);
      const zS = laufZahlen(gS.callId);
      const w = (n: string) => gS.att.spur.werkzeuge.find((x) => x.name === n)?.ergebnis;
      ok("Streitfall („Betrugsanzeige erstattet … Abzocke“): still der Hinweis an die Stimme — ab sofort nichts fordern, ein Mensch meldet sich", zS?.streit === "anzeige" && gS.att.spur.eingeschoben.some((x) => x.art === "anweisung" && x.text === HINWEIS_STREITFALL), JSON.stringify({ streit: zS?.streit }));
      ok("… kein Link: die schon geplante Rechnung fällt weg, „Der Link kommt gleich“ plant nichts, und das Modell wird abgewiesen (streitfall) — 0 Versand-Zeilen",
        (await wz(gS.callId, "zahlungslink_senden")).length === 0 && w("zahlungslink_senden")?.ok === false && w("zahlungslink_senden")?.fehler === "streitfall", JSON.stringify(w("zahlungslink_senden")));
      ok("… keine Zusage (auch das Modell nicht)", (await wz(gS.callId, "zahlungszusage_merken")).length === 0 && w("zahlungszusage_merken")?.ok === false);
      const aufg = await wz(gS.callId, "aufgabe_fuer_justin");
      const [todo] = (await sqlPool`SELECT COUNT(*)::int AS n, MAX(titel) AS titel FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:justin:streitfall:${kS.pid}`}`) as any[];
      ok("… GENAU EINE Aufgabe für Justin (Art streitfall, von der Brücke, mit seinen Worten) — die zweite des Modells („sonstiges“) wird nicht angelegt",
        aufg.length === 1 && aufg[0].ok && aufg[0].eingabe?.art === "streitfall" && String(aufg[0].aufruf_id).startsWith("bruecke_streit_") && /Betrugsanzeige erstattet/.test(String(aufg[0].eingabe?.text)) && Number(todo?.n) === 1 && w("aufgabe_fuer_justin")?.ok === true,
        `${JSON.stringify(aufg.map((x) => [x.aufruf_id, x.eingabe?.art]))} · Aufgaben ${todo?.n} · ${todo?.titel}`);
      const [ap] = (await sqlPool`SELECT aus_am, aus_grund FROM fiaon_aras_person WHERE person_id = ${kS.pid}`) as any[];
      const nochmal = await planEinreihen({ personId: kS.pid, nummer: `+4917000000${kS.n}`, spielart: "rate", grund: "Prüfstand", erzeugtVon: "chef" });
      ok("… ARAS ist für diese Person aus (wie „Aras für diesen Kunden aus“ in der Akte) — der Planer reiht sie nicht mehr ein", !!ap?.aus_am && /Streitfall/.test(String(ap?.aus_grund)) && !nochmal.ok && /für diesen Kunden aus/.test(nochmal.grund ?? ""), JSON.stringify({ ap, nochmal }));
      const aS = await fertig(gS);
      ok("… Ergebnis „erreicht_sonstiges“ mit Notiz „Streitfall …“ (nie eine Zusage)", aS?.ergebnis === "erreicht_sonstiges" && /Streitfall/.test(String(aS?.ergebnis_notiz)), `${aS?.ergebnis} · ${aS?.ergebnis_notiz}`);
      const e = await ergebnisseTag(heute);
      ok("… in den Ergebnissen zählt der Streitfall unter „Beschwerde“ (und als Aufgabe)", !!e.zeilen.find((z) => z.spielart === "rate")?.zellen.beschwerde.ids.includes(Number(aS?.id)) && !!e.zeilen.find((z) => z.spielart === "rate")?.zellen.aufgaben.ids.includes(Number(aS?.id)));
      ok("Rot-Probe: „Anzeige auf Instagram“ ist kein Streitfall — ARAS bleibt für ihn an", laufZahlen(gN.callId)?.streit === null && !((await sqlPool`SELECT aus_am FROM fiaon_aras_person WHERE person_id = ${kN.pid} AND aus_am IS NOT NULL`) as any[]).length);
      await fertig(gN);
    }

    // ── 4. ANSAGE STATT MENSCH ──
    {
      const [kA, kB, kC, kD, kE, kF] = [await kunde(490), await kunde(491), await kunde(492), await kunde(493), await kunde(494), await kunde(495)];
      // a) Die Ansage zerrissen über drei Zeilen — die erste (lang, ohne Ansage-Wort) hielt die alte Erkennung auf
      const gA = await anrufMit(kA, [{ kunde: "Hallo, hier ist der Anschluss von Familie Prüfkunde.", nachMs: 100 }, { warteMs: 300 }, { kunde: "Bitte hinterlassen Sie uns eine", nachMs: 100 }, { warteMs: 1300 }, { kunde: "Nachricht, wir rufen zurück.", nachMs: 100 }, { warteMs: 4000 }]);
      // b) Anruf-Assistent (Anruffilter): „Nennen Sie bitte Ihren Namen und den Grund Ihres Anrufs.“
      const gB = await anrufMit(kB, [{ aras: frageNachPerson(491), ms: 300 }, { kunde: "Hallo, die Person, die Sie anrufen, nutzt einen Filterdienst. Nennen Sie bitte Ihren Namen und den Grund Ihres Anrufs.", nachMs: 400 }, { warteMs: 4000 }]);
      // c) Rot-Probe: ein Mensch (bestätigt) erzählt von seiner Mailbox — „nach dem Ton“ ist dann keine Ansage
      const gC = await anrufMit(kC, [...bestaetigt(492), { kunde: "Ich hab Ihre Nachricht auf meiner Mailbox gehört, nach dem Ton war's aber leise.", nachMs: 200 }, { warteMs: 6000 }]);
      // f) Rot-Probe: ARAS kündigte der Maschine die Rechnung an — an eine Ansage wird nichts geschickt
      const gF = await anrufMit(kF, [{ aras: "I schick Ihnen glei die Rechnung zu.", ms: 300 }, { kunde: "Der Teilnehmer ist zurzeit nicht erreichbar. Bitte sprechen Sie nach dem Ton.", nachMs: 300 }, { warteMs: 4000 }]);
      // e) Die Ansage ist noch nicht zu Ende geschrieben, da wird aufgelegt → beim Ende: Ergebnis mailbox (nicht „erreicht“)
      const gE = await anrufMit(kE, [{ kunde: "Bitte hinterlassen Sie eine Nachricht nach dem Signalton", nachMs: 100 }, { warteMs: 3000 }]);
      await schlafen(250); gE.tw.aufhaengen();
      await schlafen(3000);
      const gD = await anrufMit(kD, [...bestaetigt(493), { warteMs: 5000 }]);
      await schlafen(1500);
      const rD = await mailboxErkannt(gD.callId);
      ok("AMD meldet Maschine, aber die Identität ist bestätigt → ein Mensch: das Gespräch läuft weiter (Widerspruch bleibt heil)", rD === "weiter" && laufendeSitzungen().some((x) => x.callId === gD.callId), rD);
      const aA = await fertig(gA), aB = await fertig(gB), aE = await fertig(gE), aF = await fertig(gF);
      ok("Ansage über drei Zeilen (Anschluss … „hinterlassen Sie uns eine“ · „Nachricht“) → aufgelegt, Ergebnis mailbox, fiaon_calls „niemand_erreicht“ — nie „erreicht“",
        aA?.ende_grund === "mailbox" && aA?.ergebnis === "mailbox" && aA?.call_status === "niemand_erreicht", `${aA?.ende_grund}/${aA?.ergebnis}/${aA?.call_status}`);
      ok("Anruf-Assistent („Nennen Sie bitte Ihren Namen und den Grund Ihres Anrufs“) → aufgelegt, Ergebnis mailbox, keine Prüfung nötig", aB?.ende_grund === "mailbox" && aB?.ergebnis === "mailbox" && aB?.pruefung_status === "entfaellt", `${aB?.ende_grund}/${aB?.ergebnis}/${aB?.pruefung_status}`);
      ok("Rot-Probe: ein bestätigter Mensch erzählt von seiner Mailbox („nach dem Ton …“) → KEIN Auflegen", laufZahlen(gC.callId)?.ansage === null && laufendeSitzungen().some((x) => x.callId === gC.callId), JSON.stringify(laufZahlen(gC.callId)?.ansage));
      ok("Ansage noch offen beim Auflegen → beim Ende erkannt: Ergebnis mailbox (Ende kunde_aufgelegt), fiaon_calls „niemand_erreicht“", aE?.ende_grund === "kunde_aufgelegt" && aE?.ergebnis === "mailbox" && aE?.call_status === "niemand_erreicht", `${aE?.ende_grund}/${aE?.ergebnis}/${aE?.call_status}`);
      ok("Rot-Probe: die Rechnung, die ARAS einer Ansage ankündigte, wird nicht geschickt (an eine Maschine gibt es kein Wort zu halten)", aF?.ergebnis === "mailbox" && (await wz(gF.callId, "zahlungslink_senden")).length === 0);
      await fertig(gC); await fertig(gD);
    }

    // ── 5. WORT HALTEN BIS ZUM SCHLUSS (die echten Sätze; Ende: aufgelegt, Stille, ARAS beendet) ──
    {
      const [kA, kB, kC, kE, kF] = [await kunde(540), await kunde(541), await kunde(542), await kunde(544), await kunde(545)];
      // a) Koordination 22.10.: „Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?“ — eine Zusage, keine Angebots-Frage
      const gA = await anrufMit(kA, [...bestaetigt(540), { aras: "Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?", ms: 400 }, { warteMs: 11_000 }]);
      // b) Echtgespräch: „Dann schick i Ihnen den Link gleich rüber …“ · „Passt es, wenn i's Ihnen jetzt schick?“ — „Ja, per E-Mail, bitte“ → per Mail
      const gB = await anrufMit(kB, [...bestaetigt(541), { aras: "Dann schick i Ihnen den Link gleich rüber, damit Sie es in Ruhe erledigen können.", ms: 400 }, { warteMs: 300 },
        { aras: "Passt es, wenn i's Ihnen jetzt schick?", ms: 300 }, { warteMs: 700 }, { kunde: "Ja, per E-Mail, bitte", nachMs: 200 }, { warteMs: 11_000 }]);
      // c) Er legt gleich nach der Ankündigung auf (vor den 8 s) → beim Auflegen geschickt
      const gC = await anrufMit(kC, [...bestaetigt(542), { aras: "i schick Ihnen die Rechnung schnell per WhatsApp rüber", ms: 400 }, { warteMs: 6000 }]);
      // e) ARAS verabschiedet sich und beendet, bevor die 8 s um sind → beim Ende geschickt
      const gE = await anrufMit(kE, [...bestaetigt(544), { aras: "I schick's Ihnen glei aufs Handy.", ms: 300 }, { warteMs: 300 }, { aras: "Danke Ihnen, und einen schönen Tag noch!", ms: 300 }, { warteMs: 200 },
        { werkzeug: "anruf_beenden", eingabe: { ergebnis: "erreicht_sonstiges", notiz: "Rechnung angekündigt." } }, { warteMs: 6000 }]);
      // f) Rot-Probe: Angebot im selben Satz („I schick Ihnen glei den Link — passt des?“) + „Nein, brauch ich nicht.“ → nichts
      const gF = await anrufMit(kF, [...bestaetigt(545), { aras: "I schick Ihnen glei den Link — passt des?", ms: 300 }, { warteMs: 700 }, { kunde: "Nein, brauch ich nicht.", nachMs: 200 }, { warteMs: 3000 }]);
      await schlafen(1500); gC.tw.aufhaengen();
      await warten(async () => (await wz(gA.callId, "zahlungslink_senden")).length > 0 && (await wz(gB.callId, "zahlungslink_senden")).length > 0, 16_000);
      const lA = await wz(gA.callId, "zahlungslink_senden"), lB = await wz(gB.callId, "zahlungslink_senden");
      ok("Wort halten (Koordination 22.10.): „Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?“ ist eine Zusage → die Brücke schickt (ein Versuch)", lA.length === 1 && String(lA[0].aufruf_id).startsWith("bruecke_wort_"), JSON.stringify(lA));
      ok("Wort halten (Echtgespräch): Angebot über zwei Zeilen + „Ja, per E-Mail, bitte“ → per MAIL (sein Weg, nicht WhatsApp)", lB.length === 1 && lB[0].eingabe?.weg === "mail", JSON.stringify(lB));
      const aC = await fertig(gC), aE = await fertig(gE), aF = await fertig(gF);
      ok("Ende „kunde_aufgelegt“ vor den 8 s: die angekündigte Rechnung geht beim Auflegen raus („rüber“ ohne Satzzeichen)", aC?.ende_grund === "kunde_aufgelegt" && (await wz(gC.callId, "zahlungslink_senden")).length === 1, `${aC?.ende_grund} · ${(await wz(gC.callId, "zahlungslink_senden")).length}`);
      ok("Ende „aras_beendet“ vor den 8 s: „I schick's Ihnen glei aufs Handy.“ geht beim Ende raus", aE?.ende_grund === "aras_beendet" && (await wz(gE.callId, "zahlungslink_senden")).length === 1, `${aE?.ende_grund} · ${(await wz(gE.callId, "zahlungslink_senden")).length}`);
      ok("Rot-Probe: „I schick Ihnen glei den Link — passt des?“ + „Nein, brauch ich nicht.“ → kein Link (auch nicht beim Ende)", (await wz(gF.callId, "zahlungslink_senden")).length === 0 && !!aF);
      await fertig(gA); await fertig(gB);
      // d) Ende „stille“: „I schick Ihnen glei an Link … — geht sich des heute noch aus?“ und dann Stille (im Prüfstand nach 3 s) → beim Ende geschickt
      process.env.ARAS_STILLE_ENDE_MS = "3000";
      const kD = await kunde(543);
      const gD = await anrufMit(kD, [...bestaetigt(543), { aras: "I schick Ihnen glei an Link, damit Sie's bequem erledigen können — geht sich des heute noch aus?", ms: 400 }, { warteMs: 9000 }]);
      await warten(async () => !!(await anruf(gD.callId))?.nachbereitet_am, 12_000);
      const aD = await anruf(gD.callId);
      delete process.env.ARAS_STILLE_ENDE_MS;
      ok("Ende „stille“ (Echtgespräch: „Er kündigte an, ihr einen Link zu schicken“, dann still): der Link geht beim Ende raus — die Anschlussfrage macht es zu keinem Angebot",
        aD?.ende_grund === "stille" && (await wz(gD.callId, "zahlungslink_senden")).length === 1, `${aD?.ende_grund} · ${(await wz(gD.callId, "zahlungslink_senden")).length}`);
      await fertig(gD);
    }
    await sqlPool`UPDATE fiaon_aras_plan SET status = 'verfallen' WHERE status IN ('wartet', 'verschoben')`;
    await einstellungSetzen("aras_stufe", "0", "pruefstand");
  }

  log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
  server.close();
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht === 0 ? 0 : 1);
}

main().catch(async (err) => { console.error("ABBRUCH:", err); process.exit(2); });
