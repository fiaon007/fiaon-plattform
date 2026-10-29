// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (lokale DB): ARAS — Anruf-Wunsch, Erinnerung vor dem Global-Gespräch, Rückruf „bei ARAS“ (E-458, 29.10.2026)
//
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e458_aras
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e458_aras?sslmode=require' \
//     DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e458_aras?sslmode=require' \
//     npx tsx scripts/pruef-aras-wunsch.ts
//   dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_e458_aras
//
// Justin (29.10.2026): „ARAS telefoniert nur noch die Termine oder die Leute die einen Anruf wollen“ + „go Plan“ (Punkt 8).
// Geprüft wird der ganze Weg gegen echte Tabellen: wer eingereiht wird (und wer nicht, mit Grund), dass Stufe 0 niemanden
// einreiht, dass ein verschobenes Gespräch die Erinnerung mitnimmt, dass Mara „bei ARAS“ nur nach dem KI-Hinweis einträgt,
// dass das Briefing den Wunsch und das Gespräch kennt, das Kästchen der Buchung nur mit dem Satz der Seite zählt und das
// Werkzeug „Gespräch bestätigen“ an den Termin schreibt. Keine Schlüssel in der Umgebung → kein Versand, kein Netz; der
// Anbieter ist die Attrappe. Nur erfundene Namen und Nummern.
// ═══════════════════════════════════════════════════════════════════════════
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "pruefstand-geheimnis-e458";
delete process.env.OPENAI_API_KEY; delete process.env.BREVO_API_KEY; delete process.env.TWILIO_ACCOUNT_SID;

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

async function main(): Promise<void> {
  if (!/127\.0\.0\.1|localhost/.test(String(process.env.DATABASE_URL))) throw new Error("Nur gegen die lokale Prüf-DB.");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasAusweisId, arasSchemaZuruecksetzen } = await import("../server/lib/fiaon-aras-schema");
  const { einstellungSetzen, planFuellen, arasEinstellungenLesen, arasEinstellungenVergessen } = await import("../server/lib/fiaon-aras-plan");
  const { einwilligungMerken, einwilligungWiderrufen } = await import("../server/lib/fiaon-telefon-einwilligung");
  const W = await import("../server/lib/fiaon-aras-wunsch");
  const { GLOBAL_TERMIN_ARAS_TEXT, GLOBAL_TERMIN_ARAS_HINWEIS } = await import("../shared/fiaon-ja-zum-anruf");
  const { erinnerungFenster } = await import("../shared/fiaon-aras");

  titel("0. SCHEMA, EINSTELLUNGEN (wie Produktion 29.10.: Willkommen und Rate aus, Termin an)");
  arasSchemaZuruecksetzen();
  await arasSchema();
  const ausweis = await arasAusweisId();
  await einstellungSetzen("aras_adapter", "attrappe", "pruefstand");
  await einstellungSetzen("aras_an", "an", "pruefstand");
  await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "aus", lead: "aus", zuruf: "aus", stufe_b: "aus", stufe_a: "aus", rate: "aus", zusage: "aus", rueckholung: "aus", auftrag: "aus", eingehend: "aus", probe: "an" }), "pruefstand");
  // Fenster jeden Tag 08–21 Uhr, damit der Prüfstand zu jeder Tageszeit einreihen kann (die Regeln selbst prüft pruef-aras-plan).
  await einstellungSetzen("aras_fenster", JSON.stringify({ verkauf: { "1-7": ["08:00", "21:00"] }, rate: { "1-7": ["08:00", "21:00"] } }), "pruefstand");
  await einstellungSetzen("aras_stufe", "0", "pruefstand");
  const e0 = await arasEinstellungenLesen(true);
  ok("Stufe 0, Anruf-Wunsch und Erinnerung per Vorgabe an, Willkommen und Rate aus", e0.stufe === 0 && e0.spielarten.wunsch && e0.spielarten.erinnerung && !e0.spielarten.willkommen && !e0.spielarten.rate);

  titel("1. TESTDATEN (erfunden)");
  const nr = (n: number) => `+4917100045${String(n).padStart(2, "0")}`;
  async function person(n: number, extra: { werbesperre?: boolean; kind?: string; firma?: string; email?: string } = {}): Promise<number> {
    const [p] = (await sqlPool`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, company_name, kind, primary_phone, primary_email, phone_key9, country, anrede, werbung_gesperrt_am)
      VALUES (${`PRUEF-E458-${n}`}, 'Test', ${`Wunschkunde${n}`}, ${extra.firma ?? null}, ${extra.kind ?? "private"}, ${nr(n)}, ${extra.email ?? null}, ${nr(n).replace(/\D/g, "").slice(-9)}, 'DE', 'herr', ${extra.werbesperre ? new Date() : null})
      RETURNING id`) as any[];
    return Number(p.id);
  }
  async function antrag(personId: number, n: number, payment_status: string): Promise<string> {
    const ref = `PRUEF-E458-A${n}`;
    await sqlPool`
      INSERT INTO fiaon_applications (ref, payment_reference, person_id, payment_status, status, current_step, submitted_at, pack_key, pack_name, type, ist_entwurf, created_at)
      VALUES (${ref}, ${`${ref}-Z`}, ${personId}, ${payment_status}, 'approved', 9, NOW(), 'pro', 'Pro', 'privat', FALSE, NOW() - INTERVAL '2 hours')`;
    return ref;
  }
  const ja = (personId: number, n: number, art: any, quelle: { art?: string; id?: string } = {}) =>
    einwilligungMerken({ personId, nummer: nr(n), art, wortlaut: "Ja, FIAON darf mich anrufen – auch ARAS, die digitale Mitarbeiterin von FIAON (eine KI).", quelleArt: quelle.art ?? null, quelleId: quelle.id ?? null, erteiltAm: new Date(Date.now() - 2 * 86_400_000) });
  // W1: Antrag-Kästchen, Antrag lebt → Anruf-Wunsch
  const w1 = await person(1); const a1 = await antrag(w1, 1, "pending_payment"); const j1 = await ja(w1, 1, "antrag_kaestchen", { art: "antrag", id: a1 });
  // W2: Antrag-Kästchen, Antrag storniert → nicht
  const w2 = await person(2); const a2 = await antrag(w2, 2, "cancelled"); await ja(w2, 2, "antrag_kaestchen", { art: "antrag", id: a2 });
  // W3: Ja per WhatsApp, aber danach schon mit ihm gesprochen → nicht
  const w3 = await person(3); await ja(w3, 3, "zuruf_whatsapp", { art: "whatsapp" });
  await sqlPool`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, ende, dauer_sek, ergebnis) VALUES (${w3}, ${ausweis}, ${nr(3)}, 'raus', 'beendet', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '3 minutes', 180, 'erreicht_sonstiges')`;
  // W4: nur ein mündliches Ja (Art „chef“) → kein Anruf-Wunsch
  const w4 = await person(4); await ja(w4, 4, "chef", { art: "akte" });
  // W5: Firma (kind business), Ja per Mail → Anruf-Wunsch (die Wand für Firmen ist für den Wunsch offen)
  const w5 = await person(5, { kind: "business", firma: "Prüf Holding GmbH", email: "pruef-e458-5@example.invalid" }); await ja(w5, 5, "zuruf_mail", { art: "mail" });
  // W6: Ja, aber Werbesperre → nicht
  const w6 = await person(6, { werbesperre: true }); const a6 = await antrag(w6, 6, "pending_payment"); await ja(w6, 6, "antrag_kaestchen", { art: "antrag", id: a6 });
  // W7: Ja, aber ein Termin steht schon → nicht (dann ruft ohnehin jemand an)
  const w7 = await person(7); await ja(w7, 7, "zuruf_whatsapp", { art: "whatsapp" });
  // W10/W11 (Justin 29.10. nachmittags: „ARAS darf JEDEN im System anrufen“): ein Ja gilt ein halbes Jahr statt 30 Tage.
  const altesJa = (personId: number, n: number, ref: string, tage: number) =>
    einwilligungMerken({ personId, nummer: nr(n), art: "antrag_kaestchen", wortlaut: "Ja, FIAON darf mich anrufen – auch ARAS, die digitale Mitarbeiterin von FIAON (eine KI).", quelleArt: "antrag", quelleId: ref, erteiltAm: new Date(Date.now() - tage * 86_400_000) });
  const w10 = await person(14); await altesJa(w10, 14, await antrag(w10, 14, "pending_payment"), 60);
  const w11 = await person(15); await altesJa(w11, 15, await antrag(w11, 15, "pending_payment"), 200);
  // Global-Gespräche: G1 mit Kästchen (morgen 14:00 — innerhalb der 40 Stunden), G2 ohne Kästchen (drei Stunden später)
  const morgen2 = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); })();
  const { berlinZeitpunkt } = await import("../server/lib/fiaon-time");
  const beginnG1 = berlinZeitpunkt(morgen2, 14 * 60);
  const g1p = await person(8, { kind: "business", firma: "Prüf Global AG", email: "pruef-e458-8@example.invalid" });
  const [ag] = (await sqlPool`SELECT id FROM fiaon_agents WHERE active AND COALESCE(art, 'mensch') = 'mensch' ORDER BY id LIMIT 1`) as any[];
  const agentId = Number(ag?.id ?? ausweis);
  const [t1] = (await sqlPool`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, notiz)
    VALUES (${g1p}, ${agentId}, ${beginnG1}, 30, 'gebucht', 'global', ${`pruef-e458-g1-${Date.now()}`}, ${"Firma: Prüf Global AG\nThema: US-Gesellschaft"}) RETURNING id`) as any[];
  const g1 = Number(t1.id);
  await einwilligungMerken({ personId: g1p, nummer: nr(8), art: "termin_kaestchen", wortlaut: GLOBAL_TERMIN_ARAS_TEXT.de, quelleArt: "global_termin", quelleId: String(g1) });
  const g2p = await person(9, { kind: "business", firma: "Ohne Kästchen GmbH" });
  await sqlPool`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token) VALUES (${g2p}, ${agentId}, ${new Date(beginnG1.getTime() + 3 * 3600_000)}, 30, 'gebucht', 'global', ${`pruef-e458-g2-${Date.now()}`})`;
  await sqlPool`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token) VALUES (${w7}, ${agentId}, ${new Date(Date.now() + 2 * 86_400_000 + 7200_000)}, 20, 'gebucht', 'agent_manuell', ${`pruef-e458-w7-${Date.now()}`})`;
  ok("Testdaten angelegt (9 Anruf-Wünsche, 2 Global-Gespräche)", !!w1 && !!w10 && !!w11 && !!g1 && !!j1.id);

  titel("2. KANDIDATEN — wer dran ist, und warum die anderen nicht");
  const alle = await W.wunschKandidaten(sqlPool, { mitAusgeschlossenen: true });
  const k = (p: number) => alle.find((x) => x.personId === p);
  ok("W1 (Antrag-Kästchen, Antrag lebt): bereit", !!k(w1) && k(w1)!.grund === null, JSON.stringify(k(w1)?.grund));
  ok("W2 (Antrag storniert): nicht — mit Grund", k(w2)?.grund === "Antrag storniert, abgelöst oder gekündigt", String(k(w2)?.grund));
  ok("W3 (seit dem Ja schon gesprochen): nicht", k(w3)?.grund === "seit dem Ja schon mit ihm gesprochen", String(k(w3)?.grund));
  ok("W4 (nur mündliches Ja „chef“): gar kein Kandidat", !k(w4));
  ok("W5 (Firma, Ja per Mail): bereit, als Firma erkannt", !!k(w5) && k(w5)!.grund === null && k(w5)!.firma, JSON.stringify(k(w5)));
  ok("W6 (Werbesperre): nicht", k(w6)?.grund === "Werbesperre", String(k(w6)?.grund));
  ok("W7 (Termin steht): nicht", k(w7)?.grund === "ein Termin steht schon", String(k(w7)?.grund));
  ok("W10 (Ja vor 60 Tagen): bereit — seit 29.10. gilt ein Ja ein halbes Jahr (vorher 30 Tage)", !!k(w10) && k(w10)!.grund === null, JSON.stringify(k(w10)));
  ok("Rot-Probe: W11 (Ja vor 200 Tagen) ist kein Kandidat — älter als ein halbes Jahr", !k(w11));
  const er = await W.erinnerungKandidaten(e0);
  ok("Erinnerung: nur G1 (mit Kästchen), Fenster 11:00–13:30 am Gesprächstag", er.length === 1 && er[0].terminId === g1 && !!er[0].fenster && !er[0].fenster.vortag
    && er[0].fenster.ab.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) === "11:00", JSON.stringify(er.map((x) => ({ t: x.terminId, f: x.fenster }))));

  titel("3. STUFE 0 REIHT NIEMANDEN EIN (Rot-Probe), STUFE 1 GENAU DIE RICHTIGEN");
  const r0 = await planFuellen();
  const [n0] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE spielart IN ('wunsch', 'erinnerung')`) as any[];
  ok("Stufe 0: kein Eintrag, Grund stufe_0", Number(n0.n) === 0 && !!r0.uebersprungen.stufe_0);
  await einstellungSetzen("aras_stufe", "1", "pruefstand"); arasEinstellungenVergessen();
  const r1 = await planFuellen();
  const plan = (await sqlPool`SELECT id, person_id, spielart, einwilligung_id, termin_id, frueh_ab, spaet_bis, rechtsgrund, versuch_nr, status FROM fiaon_aras_plan WHERE spielart IN ('wunsch', 'erinnerung') ORDER BY id`) as any[];
  const wunschP = plan.filter((p) => p.spielart === "wunsch").map((p) => Number(p.person_id)).sort();
  ok("Stufe 1: Anruf-Wunsch genau für W1, W5 (Firma) und W10 (Ja vor 60 Tagen) — W2, W3, W4, W6, W7, W11 nicht", JSON.stringify(wunschP) === JSON.stringify([w1, w5, w10].sort()), JSON.stringify({ wunschP, r1 }));
  const pE = plan.find((p) => p.spielart === "erinnerung");
  ok("Stufe 1: Erinnerung für G1 mit Einwilligung, Fenster bis 30 Minuten vor dem Gespräch", !!pE && Number(pE.termin_id) === g1 && pE.rechtsgrund === "einwilligung"
    && new Date(pE.spaet_bis).getTime() === beginnG1.getTime() - 30 * 60_000, JSON.stringify(pE));
  ok("Rechtsgrund jedes Anruf-Wunsches: Einwilligung, mit seiner Einwilligungs-Zeile, 1. Versuch", plan.filter((p) => p.spielart === "wunsch").every((p) => p.rechtsgrund === "einwilligung" && !!p.einwilligung_id && Number(p.versuch_nr) === 1));
  await planFuellen();
  const [n2] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_aras_plan WHERE spielart IN ('wunsch', 'erinnerung')`) as any[];
  ok("Zweiter Lauf: keine Doppelten", Number(n2.n) === plan.length, `${n2.n} statt ${plan.length}`);

  titel("4. VOR DEM WÄHLEN: Ja zurückgenommen, Gespräch verschoben");
  const pW1 = plan.find((p) => p.spielart === "wunsch" && Number(p.person_id) === w1);
  ok("W1: vor dem Wählen nichts dagegen", (await W.wunschEntfaellt(pW1)) === null);
  await einwilligungWiderrufen({ personId: w1, quelle: "pruefstand" });
  ok("W1: nach dem Widerruf entfällt der Anruf („Ja zum Anruf zurückgenommen“)", (await W.wunschEntfaellt(pW1)) === "Ja zum Anruf zurückgenommen");
  // G1 eine Stunde später (wie „Verschoben“ im Chefbüro: beginn an Ort und Stelle)
  const neuG1 = new Date(beginnG1.getTime() + 3600_000);
  await sqlPool`UPDATE fiaon_termine SET beginn = ${neuG1} WHERE id = ${g1}`;
  const e1 = await arasEinstellungenLesen(true);
  const weg = await W.erinnerungEntfaellt({ id: Number(pE.id), termin_id: g1, einwilligung_id: Number(pE.einwilligung_id), anlass_am: beginnG1, land: "DE" }, e1);
  const [pE2] = (await sqlPool`SELECT frueh_ab, spaet_bis, anlass_am, status FROM fiaon_aras_plan WHERE id = ${Number(pE.id)}`) as any[];
  ok("G1 verschoben: der Eintrag rückt mit (spätestens 30 Minuten vor der NEUEN Zeit), wartet weiter", weg?.status === "verschoben" && new Date(pE2.spaet_bis).getTime() === neuG1.getTime() - 30 * 60_000 && new Date(pE2.anlass_am).getTime() === neuG1.getTime() && pE2.status === "wartet", JSON.stringify({ weg, pE2 }));
  await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt' WHERE id = ${g1}`;
  const weg2 = await W.erinnerungEntfaellt({ id: Number(pE.id), termin_id: g1, einwilligung_id: Number(pE.einwilligung_id), anlass_am: neuG1, land: "DE" }, e1);
  ok("Rot-Probe: abgesagtes Gespräch → Erinnerung verfällt", weg2?.status === "verfallen");
  await sqlPool`UPDATE fiaon_termine SET status = 'gebucht' WHERE id = ${g1}`;

  titel("5. BRIEFING: ARAS weiß, worum es geht");
  const { briefingBauen } = await import("../server/lib/fiaon-aras-briefing");
  const pW5 = plan.find((p) => p.spielart === "wunsch" && Number(p.person_id) === w5);
  const b5 = await briefingBauen({ personId: w5, nummer: nr(5), spielart: "wunsch", planId: Number(pW5.id) });
  ok("Firma (W5): Business-Welt (global), Anruf-Wunsch „per Mail“", b5.global === true && b5.wunsch?.quelle === "per Mail", JSON.stringify({ g: b5.global, w: b5.wunsch }));
  const bE = await briefingBauen({ personId: g1p, nummer: nr(8), spielart: "erinnerung", terminId: g1, planId: Number(pE.id) });
  ok("Erinnerung (G1): das Gespräch mit Zeit, Person und Firma; Betreuer = die Person des Gesprächs", !!bE.gespraech && bE.gespraech.firma === "Prüf Global AG" && bE.gespraech.thema === "US-Gesellschaft" && /um fünfzehn Uhr/.test(bE.gespraech.wann) && bE.betreuer?.nom === bE.gespraech.mitNom && bE.global, JSON.stringify(bE.gespraech));

  titel("6. RÜCKRUF „BEI ARAS“ (Mara): nur nach dem KI-Hinweis, mit Fenster");
  const r1p = await person(10); await antrag(r1p, 10, "pending_payment");
  const fenster = (() => {
    // ein Fenster heute in einer Stunde (oder morgen 10–12, wenn es dafür zu spät ist)
    const jetzt = new Date(); const ab = new Date(jetzt.getTime() + 30 * 60_000); const bis = new Date(ab.getTime() + 90 * 60_000);
    const h = Number(bis.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }));
    if (h >= 21 || h < 9 || ab.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) !== bis.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); const t = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
      return { von: berlinZeitpunkt(t, 10 * 60), bis: berlinZeitpunkt(t, 12 * 60) };
    }
    return { von: ab, bis };
  })();
  const ohneKi = await W.arasRueckrufEintragen({ personId: r1p, nummer: nr(10), kanal: "whatsapp", von: fenster.von, bis: fenster.bis, anliegen: "Fragen zur Aktivierung", angebot: "Herr Probe kann Sie morgen anrufen — passt das?", antwort: "Ja" });
  ok("Rot-Probe: Angebot ohne KI-Hinweis → nichts eingetragen", !ohneKi.ok && (ohneKi as any).grund === "ohne_ki_hinweis");
  const angebot = "Sehr gern! Unsere digitale Mitarbeiterin ARAS – eine KI – kann Sie heute zwischen 14 und 16 Uhr anrufen. Passt Ihnen das?";
  const mitKi = await W.arasRueckrufEintragen({ personId: r1p, nummer: nr(10), kanal: "whatsapp", von: fenster.von, bis: fenster.bis, anliegen: "Fragen zur Aktivierung", angebot, antwort: "Ja gerne" });
  ok("Mit KI-Hinweis: eingetragen", mitKi.ok, JSON.stringify(mitKi));
  if (mitKi.ok) {
    const [t] = (await sqlPool`SELECT agent_id, herkunft, status, notiz FROM fiaon_termine WHERE id = ${mitKi.terminId}`) as any[];
    ok("Termin im Kalender von ARAS, Herkunft mara_bei_aras, Fenster und Anliegen in der Notiz", Number(t.agent_id) === ausweis && t.herkunft === "mara_bei_aras" && t.status === "gebucht" && /Fragen zur Aktivierung/.test(t.notiz) && /zwischen/.test(t.notiz), JSON.stringify(t));
    const [e] = (await sqlPool`SELECT art, wortlaut, quelle_art, quelle_id, beleg FROM fiaon_telefon_einwilligung WHERE quelle_art = 'mara_bei_aras' AND quelle_id = ${String(mitKi.terminId)}`) as any[];
    ok("Nachweis: Ja per WhatsApp, Wortlaut = Maras Angebot mit KI-Hinweis, seine Antwort im Beleg", e?.art === "zuruf_whatsapp" && e.wortlaut === angebot && e.beleg?.antwort === "Ja gerne" && !!e.beleg?.fenster?.text, JSON.stringify(e));
    const [p] = (await sqlPool`SELECT spielart, frueh_ab, spaet_bis, erzeugt_von, rechtsgrund FROM fiaon_aras_plan WHERE id = ${mitKi.planId}`) as any[];
    ok("Warteschlange: „termin“ (Vorrang) mit genau dem Fenster, von Mara", p?.spielart === "termin" && p.erzeugt_von === "mara" && p.rechtsgrund === "einwilligung"
      && new Date(p.frueh_ab).getTime() === mitKi.von.getTime() && new Date(p.spaet_bis).getTime() === mitKi.bis.getTime(), JSON.stringify(p));
    const bm = await briefingBauen({ personId: r1p, nummer: nr(10), spielart: "termin", terminId: mitKi.terminId, planId: mitKi.planId });
    ok("Briefing: ARAS kennt Maras Fenster, sein Anliegen und den Weg (WhatsApp)", bm.wunsch?.fenster === mitKi.text && bm.wunsch?.anliegen === "Fragen zur Aktivierung" && bm.wunsch?.kanal === "whatsapp", JSON.stringify(bm.wunsch));
    // Ein zweiter Kunde im selben Fenster: der Platzhalter rückt um eine Termin-Dauer (keine Überschneidung im ARAS-Kalender)
    const r2p = await person(11); await antrag(r2p, 11, "pending_payment");
    const zweiter = await W.arasRueckrufEintragen({ personId: r2p, nummer: nr(11), kanal: "mail", von: fenster.von, bis: fenster.bis, anliegen: "Frage zum Vertrag", angebot, antwort: "Ja" });
    const [t2] = zweiter.ok ? ((await sqlPool`SELECT beginn FROM fiaon_termine WHERE id = ${zweiter.terminId}`) as any[]) : [null];
    ok("Zweiter Rückruf im selben Fenster: eingetragen, Platzhalter später, Ja „per Mail“", zweiter.ok && !!t2 && new Date(t2.beginn).getTime() > mitKi.von.getTime(), JSON.stringify(zweiter));
  }
  await einstellungSetzen("aras_stufe", "0", "pruefstand"); arasEinstellungenVergessen();
  const r3p = await person(12);
  const stufe0 = await W.arasRueckrufEintragen({ personId: r3p, nummer: nr(12), kanal: "whatsapp", von: fenster.von, bis: fenster.bis, anliegen: "x", angebot, antwort: "Ja" });
  ok("Rot-Probe: in Stufe 0 nimmt ARAS keine Rückrufe an — Mara bucht beim Betreuer", !stufe0.ok && (stufe0 as any).grund === "aras_nicht_bereit" && !(await W.arasRueckrufBereit()).bereit);
  await einstellungSetzen("aras_stufe", "1", "pruefstand"); arasEinstellungenVergessen();

  titel("7. DIE GESPRÄCHSBUCHUNG (fiaon.com/ und Unterseiten): Hinweis statt Kästchen — nur der Satz der Seite zählt, der Nachweis nennt die echte Seite");
  // Justin 29.10. nachmittags: „braucht kein eigenes Kreuz“ — über dem Knopf steht der Hinweis, die Buchung ist die Grundlage.
  const SERVER_SAETZE = [GLOBAL_TERMIN_ARAS_HINWEIS.de, GLOBAL_TERMIN_ARAS_HINWEIS.en, GLOBAL_TERMIN_ARAS_TEXT.de, GLOBAL_TERMIN_ARAS_TEXT.en];
  const g3p = await person(13, { kind: "business", firma: "Hinweis KG" });
  const [t3] = (await sqlPool`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token) VALUES (${g3p}, ${agentId}, ${new Date(beginnG1.getTime() + 5 * 3600_000)}, 30, 'gebucht', 'global', ${`pruef-e458-g3-${Date.now()}`}) RETURNING id`) as any[];
  W.globalTerminEinwilligungMerken({ terminId: Number(t3.id), wortlautBrowser: "Ja, Sie dürfen mich anrufen.", wortlautServer: SERVER_SAETZE, telefon: nr(13), ip: "203.0.113.5", ua: "Prüfstand", sprache: "de" });
  W.globalTerminEinwilligungMerken({ terminId: Number(t3.id), wortlautBrowser: GLOBAL_TERMIN_ARAS_HINWEIS.en, wortlautServer: SERVER_SAETZE, telefon: nr(13), ip: "203.0.113.5", ua: "Prüfstand", sprache: "en", seite: "/en", referer: "https://fiaon.com/en/business/wissen" });
  await new Promise((l) => setTimeout(l, 800));
  const ew3 = (await sqlPool`SELECT art, wortlaut, quelle_art, person_id, beleg FROM fiaon_telefon_einwilligung WHERE quelle_art = 'global_termin' AND quelle_id = ${String(t3.id)}`) as any[];
  ok("Fremder Satz: nichts gespeichert — der Hinweis der Seite (englisch): genau ein Nachweis termin_buchung an der Person", ew3.length === 1 && ew3[0].art === "termin_buchung" && ew3[0].wortlaut === GLOBAL_TERMIN_ARAS_HINWEIS.en && Number(ew3[0].person_id) === g3p, JSON.stringify(ew3));
  const beleg3 = typeof ew3[0]?.beleg === "string" ? JSON.parse(ew3[0].beleg) : ew3[0]?.beleg;
  ok("Nachweis nennt die Seite, die der Browser schickt („/en“), und dass es kein Kästchen gab", beleg3?.seite === "/en" && /kein Kästchen/.test(String(beleg3?.kaestchen)), JSON.stringify(beleg3));
  const er3 = await W.erinnerungKandidaten(await arasEinstellungenLesen(true));
  ok("Erinnerung: die Buchung mit Hinweis (G3) ist dabei — ohne Kästchen", er3.some((x) => x.terminId === Number(t3.id)), JSON.stringify(er3.map((x) => x.terminId)));
  // Ein Browser mit dem alten Stand schickt noch den Kästchen-Satz → weiter gespeichert, als termin_kaestchen. Trägt die Buchung
  // dann beides, bekommt sie trotzdem nur EINE Erinnerung.
  W.globalTerminEinwilligungMerken({ terminId: Number(t3.id), wortlautBrowser: GLOBAL_TERMIN_ARAS_TEXT.de, wortlautServer: SERVER_SAETZE, telefon: nr(13), ip: "203.0.113.5", ua: "Prüfstand", sprache: "de" });
  await new Promise((l) => setTimeout(l, 800));
  const ew3b = (await sqlPool`SELECT art FROM fiaon_telefon_einwilligung WHERE quelle_art = 'global_termin' AND quelle_id = ${String(t3.id)} ORDER BY id`) as any[];
  const er3b = await W.erinnerungKandidaten(await arasEinstellungenLesen(true));
  ok("Alter Stand im Browser (Kästchen-Satz): als termin_kaestchen gespeichert — und G3 steht trotzdem nur EINMAL in der Erinnerungsliste",
    JSON.stringify(ew3b.map((x) => x.art)) === JSON.stringify(["termin_buchung", "termin_kaestchen"]) && er3b.filter((x) => x.terminId === Number(t3.id)).length === 1, JSON.stringify({ ew3b, n: er3b.filter((x) => x.terminId === Number(t3.id)).length }));
  const seiten = [W.belegSeite("/business/wissen/sba", "https://fiaon.com/"), W.belegSeite(undefined, "https://fiaon.com/en?utm_source=x"), W.belegSeite("https://fremd.example/x", "kaputt"), W.belegSeite("/?a=b"), W.belegSeite("/")];
  ok("Seite für den Nachweis: Browser-Pfad vor Referer, Referer ohne Suchteil, Fremdes → „/“", JSON.stringify(seiten) === JSON.stringify(["/business/wissen/sba", "/en", "/", "/", "/"]), JSON.stringify(seiten));
  const k3 = await W.wunschKandidaten(sqlPool, { personId: g3p, mitAusgeschlossenen: true });
  ok("Rot-Probe: die Gesprächsbuchung ist KEIN Anruf-Wunsch (deckt nur die Erinnerung)", k3.length === 0);

  titel("8. WERKZEUG „GESPRÄCH BESTÄTIGEN“ (Erinnerung)");
  const { werkzeugAusfuehren } = await import("../server/lib/fiaon-aras-werkzeuge");
  const { briefingBauen: bb } = await import("../server/lib/fiaon-aras-briefing");
  const [c] = (await sqlPool`INSERT INTO fiaon_calls (person_id, nummer, richtung, status, gefuehrt_von, agent_id) VALUES (${g1p}, ${nr(8)}, 'raus', 'gewaehlt', 'aras', ${ausweis}) RETURNING id`) as any[];
  const briefE = await bb({ personId: g1p, nummer: nr(8), spielart: "erinnerung", terminId: g1, planId: Number(pE.id) });
  const [aa] = (await sqlPool`INSERT INTO fiaon_aras_anruf (call_id, plan_id, spielart, adapter, modell, stimme, prompt_version, briefing) VALUES (${Number(c.id)}, ${Number(pE.id)}, 'erinnerung', 'attrappe', 'gpt-live-1', 'juni', 'pruef', ${sqlPool.json(briefE as any)}) RETURNING id`) as any[];
  const ctx: any = {
    callId: Number(c.id), arasAnrufId: Number(aa.id), personId: g1p, ref: null, nummer: nr(8), land: "DE", spielart: "erinnerung", briefing: briefE, einstellungen: e1,
    letzteKundenZeile: () => null, aufnahmeStarten: async () => ({ ok: true }), uebergabe: async () => ({ ok: false }), beenden: async () => {}, ergebnisGesetzt: false, ausgefuehrt: [],
  };
  const ja1 = await werkzeugAusfuehren(ctx, "gespraech_bestaetigen", { bleibt: true }, "pruef-1");
  const [nt] = (await sqlPool`SELECT notiz FROM fiaon_termine WHERE id = ${g1}`) as any[];
  ok("„bleibt“: am Termin steht „ARAS-Erinnerung …: bestätigt“, die alte Notiz bleibt", ja1.ok && /ARAS-Erinnerung .*: bestätigt — es bleibt dabei\./.test(nt.notiz) && /Firma: Prüf Global AG/.test(nt.notiz), nt.notiz);
  const nein1 = await werkzeugAusfuehren(ctx, "gespraech_bestaetigen", { bleibt: false, wunsch: "lieber nächste Woche Dienstag" }, "pruef-2");
  const [nt2] = (await sqlPool`SELECT notiz FROM fiaon_termine WHERE id = ${g1}`) as any[];
  const todo = (await sqlPool`SELECT titel FROM fiaon_betreiber_todos WHERE schluessel = ${`aras:erinnerung:${g1}`}`.catch(() => [])) as any[];
  ok("„andere Zeit“: Wunsch am Termin und genau eine Aufgabe für die Person des Gesprächs", nein1.ok && /möchte eine andere Zeit — „lieber nächste Woche Dienstag“/.test(nt2.notiz) && todo.length === 1 && /möchte eine andere Zeit/.test(todo[0].titel), JSON.stringify({ todo, nein1 }));
  const ctxW: any = { ...ctx, spielart: "wunsch", trocken: false };
  const ohne = await werkzeugAusfuehren({ ...ctxW, arasAnrufId: 999999 } as any, "gespraech_bestaetigen", { bleibt: true }, "pruef-3");
  ok("Rot-Probe: ohne Gespräch zu diesem Anruf schreibt das Werkzeug nichts", !ohne.ok);

  titel("9. LAGE FÜR DAS CHEFBÜRO");
  const lage = await W.wunschLage(await arasEinstellungenLesen(true));
  ok("Karte „Wen ARAS anruft“: Stufe 1, Anruf-Wunsch und Erinnerung an, Liste mit Gründen, Rückrufe bei ARAS gezählt",
    lage.stufe === 1 && lage.an.wunsch && lage.an.erinnerung && !lage.an.rate && lage.wunsch.some((w) => w.grund === "Werbesperre") && lage.zahlen.rueckrufeBeiAras >= 1 && lage.erinnerung.some((e) => e.terminId === g1), JSON.stringify(lage.zahlen));
  ok("Fenster-Regel (rein) stimmt mit dem Planer überein", (() => { const f = erinnerungFenster(neuG1, { fenster: e1.fenster }); return !!f && f.bis.getTime() === neuG1.getTime() - 30 * 60_000; })());

  titel("10. „ARAS DARF JEDEN IM SYSTEM ANRUFEN“ — der Einmal-Schalter (Justin 29.10. nachmittags)");
  const G = await import("../server/lib/fiaon-aras-golive");
  // Ausgangslage wie in Produktion am 29.10. mittags (B2B-Plan): nur Termin und Probe an, Stufe 0.
  await einstellungSetzen("aras_spielarten", JSON.stringify({ termin: "an", willkommen: "aus", lead: "aus", zuruf: "aus", stufe_b: "aus", stufe_a: "aus", rate: "aus", zusage: "aus", rueckholung: "aus", auftrag: "aus", eingehend: "aus", probe: "an" }), "pruefstand");
  await einstellungSetzen("aras_stufe", "0", "pruefstand"); arasEinstellungenVergessen();
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${G.JEDEN_MERKER}`;
  const lief = await G.jedenPruefen();
  const nachher = await arasEinstellungenLesen(true);
  ok("Läuft einmal: Termin, Anruf-Wunsch, Erinnerung und alle Vertragsarten (Willkommen, Zahlung gemeldet, Rate, Zusage, Auftrag) an",
    lief && G.JEDEN_AN.every((s) => nachher.spielarten[s]), JSON.stringify(nachher.spielarten));
  ok("Rot-Probe: Lead, Verkauf nach JA, Antrag unbezahlt und Rückholung bleiben aus — und die Stufe bleibt 0 (ARAS ruft niemanden an)",
    !nachher.spielarten.lead && !nachher.spielarten.zuruf && !nachher.spielarten.stufe_b && !nachher.spielarten.rueckholung && nachher.stufe === 0, JSON.stringify({ s: nachher.spielarten, stufe: nachher.stufe }));
  await einstellungSetzen("aras_spielarten", JSON.stringify({ ...JSON.parse(String(((await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'aras_spielarten'`) as any[])[0]?.value ?? "{}")), rate: "aus" }), "pruefstand");
  arasEinstellungenVergessen();
  const lief2 = await G.jedenPruefen();
  const nachher2 = await arasEinstellungenLesen(true);
  ok("Zweiter Lauf: nichts — schaltet Justin danach etwas aus (hier: Rate), bleibt es aus", lief2 === false && !nachher2.spielarten.rate && nachher2.spielarten.willkommen, JSON.stringify(nachher2.spielarten));
  const lageJ = await W.wunschLage(nachher2);
  ok("Karte: zeigt alle acht Schalter (auch Zahlung gemeldet, Zusage, Auftrag)", ["termin", "wunsch", "erinnerung", "willkommen", "stufe_a", "rate", "zusage", "auftrag"].every((s) => typeof (lageJ.an as any)[s] === "boolean") && lageJ.an.stufe_a && lageJ.an.auftrag && !lageJ.an.rate, JSON.stringify(lageJ.an));

  log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
  await sqlPool.end({ timeout: 2 }).catch(() => null);
  process.exit(schlecht === 0 ? 0 : 1);
}

main().catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
