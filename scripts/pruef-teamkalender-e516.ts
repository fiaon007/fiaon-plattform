// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-516 (16.11.2026) — Firmen-Suche, Teamkalender, still übernehmen,
// Team-Abo für alle, Schweizer Absendernummer
//
//   CRONS=aus npx tsx scripts/pruef-teamkalender-e516.ts            nur die reinen Regeln
//   CRONS=aus DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<wegwerf-db>?sslmode=require \
//     npx tsx scripts/pruef-teamkalender-e516.ts --db                 dazu Lesen/Übernehmen/Trigger gegen eine WEGWERF-DB
//
// Der DB-Teil läuft NUR gegen 127.0.0.1/localhost (nie gegen Produktion) und legt eigene Zeilen an.
// ═══════════════════════════════════════════════════════════════════════════
import { firmenSucheLesen, zweiterName, likeEntschaerfen } from "../shared/fiaon-firmen-suche";
import { jetztFrei, kundeUndFirma, istEchteFirma, teamFarbe, personenOrdnen, uhrAusMinuten, TEAM_FARBEN, type TeamKalenderAntwort, type Zerleger } from "../shared/fiaon-teamkalender";

let gut = 0; let schlecht = 0;
function ok(name: string, bed: boolean, info?: unknown) {
  if (bed) { gut++; console.log(`  ✓ ${name}`); }
  else { schlecht++; console.log(`  ✗ ${name}${info !== undefined ? ` — ${JSON.stringify(info)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n${t}`);

// ── A. Suche ────────────────────────────────────────────────────────────────
abschnitt("A. Firmen-Suche (shared/fiaon-firmen-suche.ts)");
{
  const s = firmenSucheLesen("Muster");
  ok("A1 Name: aktiv, KEINE Ziffern (vorher LIKE '%%' → alles)", s.aktiv && s.ziffern === "" && s.text === "Muster", s);
  ok("A2 Nummer mit Leerzeichen und führender 0 → 15233559405", firmenSucheLesen("0152 3355 9405").ziffern === "15233559405");
  ok("A3 +49-Schreibweise → 4915233559405", firmenSucheLesen("+49 152 33559405").ziffern === "4915233559405");
  ok("A4 0041 → 41…", firmenSucheLesen("0041 44 244").ziffern === "4144244");
  ok("A5 zwei Ziffern zählen nicht", firmenSucheLesen("12").ziffern === "" && firmenSucheLesen("12").aktiv);
  ok("A6 nur Nullen zählen nicht", firmenSucheLesen("000").ziffern === "");
  ok("A7 leer → keine Suche", !firmenSucheLesen("   ").aktiv && firmenSucheLesen(undefined).text === "");
  ok("A8 Platzhalter entschärft", likeEntschaerfen("50%_a\\b") === "50\\%\\_a\\\\b");
  ok("A9 auf 80 Zeichen gekürzt", firmenSucheLesen("x".repeat(200)).text.length === 80);
  ok("A10 Mehrfach-Leerzeichen zusammengezogen", firmenSucheLesen("  Max    Muster ").text === "Max Muster");
  ok("A11 zweiter Name: Platzhalter-Karte → Firma aus der Anfrage", zweiterName("Privatperson · Max Muster", "beispiel europe gmbh") === "beispiel europe gmbh");
  ok("A12 zweiter Name: steht schon auf der Karte → nichts", zweiterName("Privatperson · Erika Beispiel", "Erika Beispiel") === null);
  ok("A13 zweiter Name: gleich (Groß/klein) → nichts", zweiterName("Probe GmbH", "probe gmbh") === null);
  ok("A14 zweiter Name: „GmbH“ → echter Name", zweiterName("GmbH", "Lena Lorem") === "Lena Lorem");
  ok("A15 zweiter Name: keine Mappe → nichts", zweiterName("Selbständig", null) === null && zweiterName("Selbständig", "  ") === null);
}

// ── B. Namen im Teamkalender ────────────────────────────────────────────────
abschnitt("B. Kunde und Firma (kundeUndFirma)");
{
  const b = kundeUndFirma({ first_name: "Max", last_name: "Muster", company_name: "Privatperson · Max Muster", firmen_karte: "Privatperson · Max Muster", mappe_firma: "beispiel europe gmbh" });
  ok("B1 Platzhalter-Karte: Name + Firma aus der Mappe", b.kunde === "Max Muster" && b.firma === "beispiel europe gmbh", b);
  const p = kundeUndFirma({ first_name: "Paul", last_name: "Probe", company_name: "Selbständig" });
  ok("B2 „Selbständig“ ist keine Firma", p.kunde === "Paul Probe" && p.firma === null, p);
  const g = kundeUndFirma({ company_name: "Muster Bau GmbH" });
  ok("B3 nur Firma → Firma als Name, keine doppelte Firma", g.kunde === "Muster Bau GmbH" && g.firma === null, g);
  const leer = kundeUndFirma({});
  ok("B4 gar nichts → „Kunde“", leer.kunde === "Kunde" && leer.firma === null);
  ok("B5 istEchteFirma", istEchteFirma("beispiel europe gmbh") && !istEchteFirma("GmbH") && !istEchteFirma("Privatperson · X") && !istEchteFirma("Torsten Gernhold (Firma offen)") && !istEchteFirma("Mehrere"));
  const pl = kundeUndFirma({ company_name: "Privatperson · Jens Nørd" });
  ok("B6 nur Platzhalter-Firma → Name ohne „Privatperson ·“", pl.kunde === "Jens Nørd", pl);
}

// ── C. Jetzt frei ───────────────────────────────────────────────────────────
abschnitt("C. „Jetzt frei“ (jetztFrei) — Testuhr in UTC, Montag 16.11.2026 10:00");
{
  // Test-Zerleger: UTC statt Berlin, damit die Zahlen ohne Zeitzone lesbar bleiben.
  const z: Zerleger = (d) => ({ tag: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), wd: ((d.getUTCDay() + 6) % 7) + 1 });
  const jetzt = new Date("2026-11-16T10:00:00Z"); // Montag
  const p = (id: number) => ({ id, name: `P${id}`, vorname: `P${id}`, rolle: "agent", anwesend: false, ich: id === 1 });
  const t = (id: number, agentId: number, iso: string, dauer = 30, abgesagt = false) => ({ id, agentId, beginn: iso, dauerMin: dauer, status: abgesagt ? "abgesagt" : "gebucht", quelle: "global", personId: id, kunde: "K", firma: null, firmaId: null, abgesagt, vertretung: false, selbstGebucht: true, artText: "x", artTon: "#000" });
  const dienstMo = (agentId: number, von = "09:00", bis = "17:00") => ({ agentId, wochentag: 1, von, bis });
  const a: TeamKalenderAntwort = {
    personen: [p(1), p(2), p(3), p(4), p(5), p(6), p(7)],
    termine: [
      t(11, 1, "2026-11-16T09:45:00Z", 30),              // läuft bis 10:15
      t(51, 5, "2026-11-16T13:00:00Z", 30),              // P5 frei bis 13:00
      t(61, 6, "2026-11-16T09:00:00Z", 30),              // vorbei
      t(71, 7, "2026-11-16T10:00:00Z", 30, true),        // abgesagt → zählt nicht
    ],
    sperren: [{ agentId: 2, beginn: "2026-11-16T09:30:00Z", ende: "2026-11-16T11:00:00Z", grund: null },
              { agentId: 6, beginn: "2026-11-16T12:30:00Z", ende: "2026-11-16T13:00:00Z", grund: null }],
    dienst: [dienstMo(1), dienstMo(2), dienstMo(4, "14:00", "18:00"), dienstMo(5), dienstMo(6), dienstMo(7, "08:00", "16:00")],
  };
  const f = jetztFrei(a, jetzt, z);
  const von = (id: number) => f.find((x) => x.agentId === id)!;
  ok("C1 im Termin bis 10:15", von(1).zustand === "termin" && von(1).bis === "10:15" && von(1).text === "im Termin bis 10:15", von(1));
  ok("C2 geblockt bis 11:00", von(2).zustand === "belegt" && von(2).text === "geblockt bis 11:00", von(2));
  ok("C3 ohne Zeiten", von(3).zustand === "ohne_zeiten", von(3));
  ok("C4 außer Dienst, ab 14:00", von(4).zustand === "ausser_dienst" && von(4).text === "im Dienst ab 14:00", von(4));
  ok("C5 frei bis zum nächsten Termin 13:00", von(5).zustand === "frei" && von(5).bis === "13:00", von(5));
  ok("C6 frei bis zur nächsten Sperre 12:30 (vergangener Termin zählt nicht)", von(6).zustand === "frei" && von(6).bis === "12:30", von(6));
  ok("C7 abgesagter Termin zählt nicht → frei bis Dienstende 16:00", von(7).zustand === "frei" && von(7).bis === "16:00", von(7));
  const spaet = jetztFrei(a, new Date("2026-11-16T19:00:00Z"), z);
  ok("C8 nach Dienstende: heute nicht mehr im Dienst", spaet.find((x) => x.agentId === 5)!.text === "heute nicht mehr im Dienst");
  ok("C9 uhrAusMinuten", uhrAusMinuten(0) === "00:00" && uhrAusMinuten(615) === "10:15" && uhrAusMinuten(1440) === "24:00");
  ok("C10 Farben wiederholen sich ringförmig", teamFarbe(0) === TEAM_FARBEN[0] && teamFarbe(TEAM_FARBEN.length) === TEAM_FARBEN[0] && teamFarbe(-1) === TEAM_FARBEN[TEAM_FARBEN.length - 1]);
  const ord = personenOrdnen([
    { id: 3, ich: false, rolle: "agent", vorname: "Anna" }, { id: 2, ich: false, rolle: "vertriebsleiter", vorname: "Zoe" },
    { id: 1, ich: true, rolle: "agent", vorname: "Mia" }, { id: 4, ich: false, rolle: "vertriebsleiter", vorname: "Ben" },
  ]);
  ok("C11 Reihenfolge: ich, Leitung (nach Name), andere", ord.map((x) => x.id).join(",") === "1,4,2,3", ord.map((x) => x.id));
}

// ── D. Absendernummer + Fenster + Abo-Regel ─────────────────────────────────
abschnitt("D. Absendernummer, Fenster, Abo-Regel");
const softphone = await import("../server/lib/fiaon-softphone");
{
  const env = { TWILIO_CALLER_ID: "+493012345678", TWILIO_CALLER_ID_CH: "+41442449301", TWILIO_CALLER_ID_AT: "+43123456789" };
  ok("D1 +41 → Schweizer Nummer", softphone.absenderFuerZiel("+41791234567", env) === "+41442449301");
  ok("D2 +43 → österreichische Nummer", softphone.absenderFuerZiel("+436641234567", env) === "+43123456789");
  ok("D3 +49 → Standard", softphone.absenderFuerZiel("+4915233559405", env) === "+493012345678");
  ok("D4 ohne CH-Nummer → Standard", softphone.absenderFuerZiel("+41791234567", { TWILIO_CALLER_ID: "+493012345678" }) === "+493012345678");
  ok("D5 unbrauchbare CH-Nummer → Standard", softphone.absenderFuerZiel("+41791234567", { TWILIO_CALLER_ID: "+493012345678", TWILIO_CALLER_ID_CH: "044 244 93 01" }) === "+493012345678");
}
const tk = await import("../server/lib/fiaon-teamkalender");
{
  const jetzt = new Date("2026-11-16T10:00:00Z");
  const def = tk.teamFenster("quatsch", "", jetzt);
  ok("D6 ungültiges Fenster → −1/+8 Tage", def.von.toISOString() === "2026-11-15T10:00:00.000Z" && def.bis.toISOString() === "2026-11-24T10:00:00.000Z");
  const gross = tk.teamFenster("2026-11-01T00:00:00Z", "2026-12-31T00:00:00Z", jetzt);
  ok("D7 zu großes Fenster → Standard", gross.von.toISOString() === def.von.toISOString());
  const gut7 = tk.teamFenster("2026-11-15T00:00:00Z", "2026-11-23T00:00:00Z", jetzt);
  ok("D8 Woche + Luft geht durch", gut7.von.toISOString() === "2026-11-15T00:00:00.000Z");
  ok("D9 rückwärts → Standard", tk.teamFenster("2026-11-23T00:00:00Z", "2026-11-15T00:00:00Z", jetzt).von.toISOString() === def.von.toISOString());
}
const kal = await import("../server/lib/fiaon-kalender-abo");
ok("D10 Team-Abo: aktiver Mitarbeiter ohne Stufe darf", kal.kontoDarfAbo("team", { aktiv: true, gesperrt: false, stufe: null }) === true);
ok("D11 Team-Abo: gesperrt nie", kal.kontoDarfAbo("team", { aktiv: true, gesperrt: true, stufe: "inhaber" }) === false);
ok("D12 Team-Abo: deaktiviert ohne Inhaber nie", kal.kontoDarfAbo("team", { aktiv: false, gesperrt: false, stufe: null }) === false);

// ── E. Gegen eine Wegwerf-DB ────────────────────────────────────────────────
if (process.argv.includes("--db")) {
  const url = String(process.env.DATABASE_URL || "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    console.log("\nE. übersprungen — DATABASE_URL zeigt nicht auf 127.0.0.1/localhost (nie gegen Produktion).");
    schlecht++;
  } else {
    abschnitt("E. Lesen, still übernehmen, Trigger (Wegwerf-DB)");
    const { sqlPool: sql } = await import("../server/lib/db-pool");
    const fs = await import("node:fs");
    // Sperrzeiten + Abo-Tabelle + der neue Trigger (085 → 136), wie in Produktion.
    for (const f of ["db/migrations/133_sperrzeiten.sql", "db/migrations/085_kalender_abo.sql", "db/migrations/136_kalender_abo_team_fuer_alle.sql"]) {
      await sql.unsafe(fs.readFileSync(f, "utf8"));
    }
    await sql`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS admin_stufe TEXT`;
    await sql`ALTER TABLE fiaon_firmen_leads ADD COLUMN IF NOT EXISTS person_id INTEGER`;
    const agent = async (name: string, rolle: string, test = false) => Number(((await sql`
      INSERT INTO fiaon_agents (name, first_name, email, rolle, active, is_test_account)
      VALUES (${name}, ${name.split(" ")[0]}, ${`${name.replace(/\s/g, ".").toLowerCase()}@beispiel-e516.de`}, ${rolle}, TRUE, ${test})
      RETURNING id`) as any[])[0].id);
    const A = await agent("Anna Berg", "agent");
    const B = await agent("Ben Leit", "vertriebsleiter");
    const C = await agent("Cara Kahl", "agent");
    const D = await agent("Dora Ohne", "agent");
    const T = await agent("Tim Sonder", "agent", true);
    const person = async (vn: string, nn: string, firma: string | null, betreuer: number | null) => Number(((await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, company_name, assigned_agent_id)
      VALUES (${`E516-${vn}-${nn}`}, ${vn}, ${nn}, ${firma}, ${betreuer}) RETURNING id`) as any[])[0].id);
    const p1 = await person("Max", "Muster", "Privatperson · Max Muster", B);
    const p2 = await person("Mia", "Kunde", "Muster Bau GmbH", C);
    const p3 = await person("Tom", "Test", null, T);
    const firmaId = Number(((await sql`INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, person_id, status) VALUES ('Privatperson · Max Muster', 'Max Muster', ${p1}, 'termin') RETURNING id`) as any[])[0].id);
    const morgen = new Date(Date.now() + 864e5); morgen.setUTCHours(9, 0, 0, 0);
    const plus = (min: number) => new Date(morgen.getTime() + min * 60_000);
    const termin = async (pid: number, aid: number, beginn: Date, quelle = "global", status = "gebucht") => Number(((await sql`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, quelle, status, storno_token)
      VALUES (${pid}, ${aid}, ${beginn}, 30, ${quelle}, ${status}, ${`e516-${aid}-${beginn.getTime()}-${Math.round(Math.random() * 1e9)}`}) RETURNING id`) as any[])[0].id);
    const tB = await termin(p1, B, plus(0));
    const tC = await termin(p2, C, plus(60), "agent_manuell");
    const tA = await termin(p2, A, plus(60), "agent_manuell");    // A hat um +60 selbst einen Termin → Doppelbuchung bei tC
    const tT = await termin(p3, T, plus(120));                    // Testkonto → nicht im Teamkalender
    const tVorbei = await termin(p1, B, new Date(Date.now() - 3 * 3600e3));
    const tAbgesagt = await termin(p1, B, plus(180), "global", "abgesagt");
    await sql`UPDATE fiaon_termine SET abgesagt_am = NOW() WHERE id = ${tAbgesagt}`;
    await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis) VALUES (${B}, 1, '09:00', '17:00')`;
    // Über die EINE Schreibstelle (E-498: nur fiaon-sperrzeit.ts schreibt in fiaon_sperrzeiten).
    const sz = await import("../server/lib/fiaon-sperrzeit");
    await sz.sperrzeitAnlegen({ agentId: B, beginn: plus(240).toISOString(), ende: plus(300).toISOString(), grund: "Zoom privat" });
    await sz.sperrzeitAnlegen({ agentId: A, beginn: plus(240).toISOString(), ende: plus(300).toISOString(), grund: "Arzt" });

    const fenster = { von: new Date(Date.now() - 864e5), bis: new Date(Date.now() + 3 * 864e5) };
    const daten = await tk.teamKalenderLesen(A, fenster.von, fenster.bis);
    const ids = daten.personen.map((p) => p.id);
    ok("E1 Personen: ich, Leitung, wer Termine hat", ids.includes(A) && ids.includes(B) && ids.includes(C), ids);
    ok("E2 ohne Termin + keine Leitung → nicht dabei", !ids.includes(D));
    ok("E3 Testkonto → nicht dabei", !ids.includes(T) && !daten.termine.some((t) => t.id === tT));
    ok("E4 ich zuerst, dann Leitung", daten.personen[0].id === A && daten.personen[0].ich && daten.personen.findIndex((p) => p.id === B) < daten.personen.findIndex((p) => p.id === C));
    const bt = daten.termine.find((t) => t.id === tB);
    ok("E5 Muster-Termin: Name, Firmenkarte, Global", !!bt && bt.kunde === "Max Muster" && bt.firmaId === firmaId && bt.quelle === "global", bt);
    ok("E6 abgesagter Termin (jünger als 7 Tage) sichtbar und markiert", daten.termine.some((t) => t.id === tAbgesagt && t.abgesagt));
    const sB = daten.sperren.find((s) => s.agentId === B); const sA = daten.sperren.find((s) => s.agentId === A);
    ok("E7 Sperre des Kollegen ohne Grund, eigene mit Grund", !!sB && sB.grund === null && !!sA && sA.grund === "Arzt", { sB, sA });
    ok("E8 Arbeitszeiten geliefert (HH:MM)", daten.dienst.some((d) => d.agentId === B && d.von === "09:00" && d.bis === "17:00"));
    ok("E9 keine Telefonnummer in der Antwort", !JSON.stringify(daten).match(/primary_phone|"phone"/));

    // Still übernehmen
    const r1 = await tk.terminUebernehmen(tB, { id: A, name: "Anna Berg" });
    const [nach] = (await sql`SELECT agent_id, vertretung, uebergeben_von, uebergeben_grund FROM fiaon_termine WHERE id = ${tB}`) as any[];
    const [pers] = (await sql`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${p1}`) as any[];
    ok("E10 Übernehmen: 200, Termin bei mir, als Vertretung", r1.status === 200 && Number(nach.agent_id) === A && nach.vertretung === true && Number(nach.uebergeben_von) === B, { r1, nach });
    ok("E11 Kunde bleibt beim Betreuer (Mandat unberührt)", Number(pers.assigned_agent_id) === B, pers);
    const fl = (await sql`SELECT notiz FROM fiaon_firmen_log WHERE firma_id = ${firmaId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    ok("E12 Verlauf im Firmen-Cockpit", !!fl[0] && /übernommen von Anna Berg, vorher Ben Leit/.test(String(fl[0].notiz)), fl[0]);
    const mails = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE created_at > NOW() - INTERVAL '5 minutes'`.catch(() => [{ n: 0 }])) as any[];
    ok("E13 keine Mail ausgelöst", Number(mails[0]?.n ?? 0) === 0, mails[0]);
    const r2 = await tk.terminUebernehmen(tB, { id: A, name: "Anna Berg" });
    ok("E14 zweites Mal → 409 SCHON_MEINS", r2.status === 409 && r2.body.code === "SCHON_MEINS", r2);
    const r3 = await tk.terminUebernehmen(tC, { id: A, name: "Anna Berg" });
    ok("E15 Doppelbuchung → 409 BELEGT, Termin bleibt bei Cara", r3.status === 409 && r3.body.code === "BELEGT"
      && Number(((await sql`SELECT agent_id FROM fiaon_termine WHERE id = ${tC}`) as any[])[0].agent_id) === C, r3);
    const r4 = await tk.terminUebernehmen(tVorbei, { id: C, name: "Cara Kahl" });
    ok("E16 vorbei → 409 VORBEI", r4.status === 409 && r4.body.code === "VORBEI", r4);
    const r5 = await tk.terminUebernehmen(tAbgesagt, { id: C, name: "Cara Kahl" });
    ok("E17 abgesagt → 409 NICHT_OFFEN", r5.status === 409 && r5.body.code === "NICHT_OFFEN", r5);
    const r6 = await tk.terminUebernehmen(tC, { id: T, name: "Tim Sonder" });
    ok("E18 Testkonto darf nicht übernehmen → 403", r6.status === 403, r6);
    const r7 = await tk.terminUebernehmen(999999, { id: A, name: "Anna Berg" });
    ok("E19 unbekannter Termin → 404", r7.status === 404);

    // Trigger 136: Team-Abo eines Nicht-Inhabers bleibt bei einer Stufen-Änderung, fällt bei Deaktivierung.
    const abo = async (aid: number, umfang: string) => {
      await sql`INSERT INTO fiaon_kalender_abo (id, agent_id, umfang, zufall, token_hash) VALUES (${Math.floor(Math.random() * 1e9)}, ${aid}, ${umfang}, ${`z${aid}${umfang}`}, ${`h${aid}${umfang}${Math.random()}`})`;
    };
    const offen = async (aid: number, umfang: string) => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_kalender_abo WHERE agent_id = ${aid} AND umfang = ${umfang} AND widerrufen_am IS NULL`) as any[])[0].n);
    await abo(C, "team"); await abo(C, "eigene");
    await sql`UPDATE fiaon_agents SET admin_stufe = 'geschaeftsfuehrung' WHERE id = ${C}`;
    ok("E20 Stufe ändert sich → Team-Abo bleibt (vorher: widerrufen)", (await offen(C, "team")) === 1);
    await sql`UPDATE fiaon_agents SET active = FALSE WHERE id = ${C}`;
    ok("E21 deaktiviert → beide Abos widerrufen", (await offen(C, "team")) === 0 && (await offen(C, "eigene")) === 0);
    await abo(B, "team");
    await sql`UPDATE fiaon_agents SET zugang_gesperrt_am = NOW() WHERE id = ${B}`;
    ok("E22 gesperrt → Team-Abo widerrufen", (await offen(B, "team")) === 0);
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n${gut} gut, ${schlecht} schlecht`);
process.exit(schlecht ? 1 : 0);
