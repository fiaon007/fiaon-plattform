// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-520 (17.11.2026): AUFTRAG „GRÜNDUNG BESTELLEN“ + DER GROSSE SCHNITT
//
// Teil A rein (ohne Datenbank): Fälligkeit, Bestellnummer, „überfällig ab nächstem Werktag 10 Uhr“, Auftragstext
// ohne Kundennamen, Bestell-Anleitung mit Werten und Leerstellen, Schnitt-Bewertung (alles zu, neuer Ablauf bleibt).
// Teil B mit einer LOKALEN Prüfdatenbank (erfundene Namen): Wächter legt genau EINEN Auftrag an, Zugriff nur für die
// Person mit dem offenen Auftrag, Sicht im Office, „Bestellt“ nur mit Nummer → Station, Auftrag zu; Nachhalten
// (Ampel) und Entwarnung; der Schnitt-Lauf schließt alles Übrige, lässt „Gründung bestellen“ offen, Zurückholen geht.
// Kein Netz, keine Mail. NIE GEGEN DIE PRODUKTION: nur 127.0.0.1 und eine Datenbank „fiaon_pruefstand_e520…“.
//   B=/opt/homebrew/opt/postgresql@18/bin; $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e520g
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e520g?sslmode=require' node_modules/.bin/tsx scripts/pruef-gruendung-auftrag-e520.ts
// ═══════════════════════════════════════════════════════════════════════════
const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
const MIT_DB = !!ziel && ["127.0.0.1", "localhost"].includes(ziel.hostname) && /^fiaon_pruefstand_e520/.test(ziel.pathname.replace(/^\//, ""));
if (url && !MIT_DB) { console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen eine lokale Kopie fiaon_pruefstand_e520… auf 127.0.0.1."); process.exit(2); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN", "META_SYSTEM_TOKEN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(2); }
}
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

let gut = 0; const rot: string[] = [];
const ok = (bed: unknown, text: string, fund?: unknown) => {
  if (bed) { gut++; console.log(`  ok    ${text}`); } else { rot.push(text); console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 500)}` : ""}`); }
};

const G = await import("../shared/fiaon-global-gruendung-auftrag");
const H = await import("../shared/fiaon-hausputz-regeln");

// ── TEIL A · REIN ────────────────────────────────────────────────────────────
console.log("\n── A1  Fällig: bezahlt, läuft, kein Test, keine Übernahme, Station offen");
const basis = { status: "gestartet", bezahltAm: new Date("2026-11-13T12:00:00Z"), storniertAm: null, abgeschlossenAm: null, istTest: false, bestand: false, stationStatus: null };
ok(G.gruendungFaellig(basis), "bezahlt + Station nie angefasst → fällig");
ok(G.gruendungFaellig({ ...basis, stationStatus: "in_arbeit" }), "Station „in Arbeit“ → weiter fällig");
ok(!G.gruendungFaellig({ ...basis, stationStatus: "erledigt" }), "Station erledigt → nicht fällig");
ok(!G.gruendungFaellig({ ...basis, bezahltAm: null }), "unbezahlt → nicht fällig");
ok(!G.gruendungFaellig({ ...basis, istTest: true }), "Testauftrag → nie");
ok(!G.gruendungFaellig({ ...basis, bestand: true }), "Übernahme einer bestehenden Gesellschaft (E-506) → nichts zu gründen");
ok(!G.gruendungFaellig({ ...basis, storniertAm: new Date() }) && !G.gruendungFaellig({ ...basis, status: "storniert" }), "storniert → nie");
ok(!G.gruendungFaellig({ ...basis, abgeschlossenAm: new Date() }), "abgeschlossen → nie");

console.log("\n── A2  Bestellnummer");
ok(G.gruendungBestellnummer(" ab12c3d4 ") === "AB12C3D4", "Kleinbuchstaben und Leerzeichen werden bereinigt");
ok(G.gruendungBestellnummer("#H-463 849") === "H463849", "„#“, Bindestrich, Leerzeichen fallen weg");
ok(G.gruendungBestellnummer("") === null && G.gruendungBestellnummer("erledigt") === null, "leer oder ein Wort ohne Ziffer → keine Nummer");
ok(G.gruendungBestellnummer("12") === null && G.gruendungBestellnummer("A".repeat(15) + "1") === null, "zu kurz / zu lang → keine Nummer");
ok(G.gruendungBestellnummer("AB12;DROP") === null, "Sonderzeichen → keine Nummer");

console.log("\n── A3  Überfällig ab dem nächsten Werktag 10 Uhr (Berlin)");
const B = (iso: string) => new Date(iso);
ok(!G.gruendungUeberfaellig(B("2026-11-17T08:00:00+01:00"), B("2026-11-17T23:30:00+01:00")), "am selben Tag nie");
ok(!G.gruendungUeberfaellig(B("2026-11-17T08:00:00+01:00"), B("2026-11-18T09:59:00+01:00")), "Folgetag 09:59 → noch nicht");
ok(G.gruendungUeberfaellig(B("2026-11-17T08:00:00+01:00"), B("2026-11-18T10:00:00+01:00")), "Folgetag 10:00 → überfällig");
ok(!G.gruendungUeberfaellig(B("2026-11-20T16:00:00+01:00"), B("2026-11-21T12:00:00+01:00")), "Freitag angelegt, Samstag mittags → nicht");
ok(!G.gruendungUeberfaellig(B("2026-11-20T16:00:00+01:00"), B("2026-11-23T09:30:00+01:00")), "Freitag angelegt, Montag 09:30 → noch nicht");
ok(G.gruendungUeberfaellig(B("2026-11-20T16:00:00+01:00"), B("2026-11-23T10:05:00+01:00")), "Freitag angelegt, Montag 10:05 → überfällig");
ok(G.gruendungUeberfaellig(B("2026-11-21T11:00:00+01:00"), B("2026-11-24T08:00:00+01:00")), "Samstag angelegt, Dienstag früh → überfällig (Montag war der Stichtag)");
ok(!G.gruendungUeberfaellig(new Date("x"), new Date()), "kaputtes Datum → nie");

console.log("\n── A3b Neue Aufträge nur zwischen 7 und 20 Uhr (keine Mail in der Nacht)");
ok(!G.gruendungAnlegenJetzt(B("2026-11-17T03:10:00+01:00")) && !G.gruendungAnlegenJetzt(B("2026-11-17T06:59:00+01:00")), "nachts und vor 7 Uhr: nein");
ok(G.gruendungAnlegenJetzt(B("2026-11-17T07:00:00+01:00")) && G.gruendungAnlegenJetzt(B("2026-11-17T19:59:00+01:00")), "7:00 bis 19:59: ja");
ok(!G.gruendungAnlegenJetzt(B("2026-11-17T20:00:00+01:00")), "ab 20 Uhr: nein");
ok(G.gruendungAnlegenJetzt(B("2026-07-01T07:30:00+02:00")), "Sommerzeit zählt richtig");

console.log("\n── A4  Auftragstext: klar, ohne Kundennamen, mit Link in die Akte");
const txt = G.gruendungAuftragText({ gesellschaft: "PRUEFMUSTER LLC", bundesstaat: "Delaware", fastTrack: true, bezahltAmText: "17.11.2026" });
ok(/^Heute: Gründung bestellen — PRUEFMUSTER LLC \(Delaware\)$/.test(txt.titel), "Titel nennt Gesellschaft und Staat", txt.titel);
ok(/Fast-Track/.test(txt.text) && /Bestellnummer/.test(txt.text) && /Reiter „Gründung bestellen“/.test(txt.text), "Text: Vorrang, Beleg, Weg");
ok(!/Fast-Track/.test(G.gruendungAuftragText({ gesellschaft: "X LLC", bundesstaat: "Delaware", fastTrack: false, bezahltAmText: "1.1." }).text), "ohne Fast-Track kein Fast-Track-Satz");
ok(G.gruendungSchluessel("fiaon-abc-1") === "global:FIAON-ABC-1:gruendung-bestellen" && H.SCHNITT_BLEIBT.test(G.gruendungSchluessel("FIAON-ABC-1")), "Schlüssel beginnt mit „global:“ und überlebt den Schnitt");
ok(G.gruendungLink("FIAON-ABC-1") === "/agent/global/FIAON-ABC-1?reiter=gruendung", "Link öffnet die Akte auf dem Reiter");

console.log("\n── A5  Bestell-Anleitung: Werte eingesetzt, Leerstellen benannt, keine Chefbüro-Links");
const an = G.gruendungAnleitung({ gesellschaftName: "PRUEFMUSTER LLC", bundesstaatName: "Delaware", vorname: "Anna", nachname: "Prüfmann", telefon: "+49301234567", wohnadresse: "Prüfweg 1\n12345 Musterstadt" });
ok(an.schritte.map((s) => s.key).join(",") === G.GRUENDUNG_SCHRITTE.join(","), "die vier Schritte der Bestellung, in der Reihenfolge", an.schritte.map((s) => s.key));
const f = (key: string, feld: string) => an.schritte.find((s) => s.key === key)?.felder.find((x) => x.feld === feld);
ok(f("s04_bestellen", "Name (ohne Endung)")?.wert === "PRUEFMUSTER" && f("s04_bestellen", "Name (ohne Endung)")?.kopieren === true, "Name ohne „LLC“, kopierbar");
ok(f("s04_bestellen", "State")?.wert === "Delaware", "Bundesstaat eingesetzt");
ok(f("s08_formation", "Member")?.wert === "Anna Prüfmann", "Member = der Kunde");
ok(an.fehlend.length === 0, "nichts fehlt", an.fehlend);
ok(an.schritte.every((s) => s.links.every((l) => /^https:\/\//.test(l.url))), "nur externe Links");
const leer = G.gruendungAnleitung({ gesellschaftName: "", bundesstaatName: "Delaware" });
ok(leer.fehlend.includes("nameOhneEndung") && leer.fehlend.includes("kunde"), "ohne Name/Kunde: Leerstellen werden benannt", leer.fehlend);
ok(leer.schritte.flatMap((s) => s.felder).filter((x) => x.fehlt).every((x) => !x.kopieren), "eine Leerstelle hat keinen Kopieren-Knopf");

console.log("\n── A6  Der große Schnitt: alles Offene zu — der neue Ablauf bleibt");
const d = {
  auftraege: [
    { id: 1, zustaendig_art: "agent", titel: "Kunde bittet um Rückruf", text: "", art: "mara_rueckruf", schluessel: "x-1", quelle: "mara", alter_tage: 40 },
    { id: 2, zustaendig_art: "betreiber", titel: "Geld zurück", text: "Kunde will Erstattung", art: "beschwerde", schluessel: "x-2", quelle: "mara", alter_tage: 3 },
    { id: 3, zustaendig_art: "agent", titel: "Frage offen", text: "", frage: true, art: "sonstiges", schluessel: "x-3", quelle: "hand", alter_tage: 1 },
    { id: 4, zustaendig_art: "agent", titel: "Heute: Gründung bestellen — X LLC (Delaware)", text: "", art: "global", schluessel: "global:FIAON-X:gruendung-bestellen", quelle: "global", alter_tage: 0 },
    { id: 5, zustaendig_art: "agent", titel: "Test", text: "", ist_test: true, art: "sonstiges", schluessel: "x-5", quelle: "hand", alter_tage: 9 },
    { id: 6, zustaendig_art: "agent", titel: "FIAON Global: Muster GmbH bittet um einen Anruf", text: "", art: "global", schluessel: "global-anfrage:77", quelle: "global", alter_tage: 2 },
    { id: 7, zustaendig_art: "betreiber", titel: "Neue Empfehlung", text: "", art: "sonstiges", schluessel: "koop-empfehlung:4", quelle: "koop", alter_tage: 13 },
    { id: 8, zustaendig_art: "betreiber", titel: "WhatsApp: Global — bitte übernehmen", text: "", art: null, schluessel: "wa-55-global-2026-11-10", quelle: "mara", alter_tage: 7 },
  ],
  vermerke: [{ id: 11, text: "bitte anrufen", typ: "sonstige", zustaendig_agent_id: 7, alter_tage: 50 }, { id: 12, text: "Geld zurück!", typ: "sonstige", zustaendig_agent_id: null, fuer_betreiber: true, alter_tage: 2 }],
  rueckrufe: [{ id: 21, anliegen: "Rückruf", zustaendig_agent_id: 7, alter_tage: 60 }],
};
const sanft = H.hausputzBewerten(d);
const schnitt = H.hausputzBewerten(d, { schnitt: true });
ok(sanft.length < schnitt.length && !sanft.some((e) => e.regel === "schnitt"), "ohne Schnitt greift die Regel „schnitt“ nie", sanft.map((e) => e.regel));
ok(schnitt.length === 7 && schnitt.every((e) => e.aktion === "schliessen"), "im Schnitt: 7 von 11 Zeilen gehen zu, jede als „schließen“", schnitt.map((e) => `${e.tabelle}:${e.id}:${e.regel}`));
ok(!schnitt.some((e) => e.tabelle === "auftrag" && e.id === 4), "„Gründung bestellen“ bleibt offen");
ok(![6, 7, 8].some((id) => schnitt.some((e) => e.tabelle === "auftrag" && e.id === id)), "FIAON Global (Anruf-Auftrag, WhatsApp-Global) und Kooperation bleiben offen — dort lesen Abläufe den Stand");
ok(H.schnittVerschont({ schluessel: "global:FIAON-X:eingang:3" }) && H.schnittVerschont({ schluessel: "koop:interesse:5:1" }) && !H.schnittVerschont({ schluessel: "antrag:FIAON-Y:a-klaeren", art: "stufe_a_klaeren" }), "verschont wird nach Schlüssel/Art — Privat-Aufträge nicht");
ok(schnitt.find((e) => e.tabelle === "auftrag" && e.id === 5)?.regel === "test", "eine genauere Regel behält ihren Grund (Testkonto)");
ok(schnitt.find((e) => e.tabelle === "auftrag" && e.id === 2)?.regel === "schnitt" && schnitt.find((e) => e.tabelle === "auftrag" && e.id === 3)?.regel === "schnitt", "auch Erstattung und offene Frage gehen im Schnitt zu");
const zahlen = H.hausputzZaehlen(d, schnitt);
ok(zahlen.nachher.auftraege === 4 && zahlen.nachher.vermerke === 0 && zahlen.nachher.rueckrufe === 0, "Zahlen nachher: 4 Aufträge (Global/Koop), 0 „Zu tun“, 0 Rückrufe", zahlen.nachher);
ok(H.hausputzIstSchnitt("2026-11-17 SCHNITT alle raus — Justin (Chat)") && !H.hausputzIstSchnitt("2026-10-20 go Justin (Chat)") && !H.hausputzIstSchnitt(null), "nur eine Freigabe mit dem Wort SCHNITT schaltet ihn ein");

if (!MIT_DB) {
  console.log(`\n${rot.length ? "ROT" : "GRÜN"}: ${gut} ok, ${rot.length} rot (nur Teil A — ohne Datenbank).`);
  process.exit(rot.length ? 1 : 0);
}

// ── TEIL B · MIT LOKALER DATENBANK ───────────────────────────────────────────
const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const M: any = await import("../server/lib/fiaon-global-mandat");
const W = await import("../server/lib/fiaon-global-gruendung-auftrag");
const T: any = await import("../server/routes/fiaon-betreiber-todo");
await A.ensureGlobalTabelle();
await M.ensureGlobalMandat();
await T.ensureTodoTabelle?.();

const stempel = Date.now().toString(36).toUpperCase();
/** Der Wächter legt nur tagsüber an — der Prüfstand läuft zu jeder Uhrzeit, also mit einer festen Tageszeit von heute (12 Uhr UTC). */
const TAGS = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
const mailVon = (n: string) => `${n}-${stempel.toLowerCase()}@pruefmuster.example`;
const agentNeu = async (name: string) => Number(((await sqlPool`
  INSERT INTO fiaon_agents (name, email, password_hash, rolle, active) VALUES (${name}, ${mailVon(name.split(" ")[0].toLowerCase())}, 'x', 'agent', TRUE) RETURNING id`) as any[])[0].id);
const BESTELLT = { id: await agentNeu("Greta Gründung"), name: "Greta Gründung" };
const FREMD = { id: await agentNeu("Franz Fremd"), name: "Franz Fremd" };
process.env[G.GRUENDUNG_ENV] = String(BESTELLT.id);
await sqlPool`DELETE FROM fiaon_settings WHERE key = ${G.GRUENDUNG_SETTING}`;

const auftragNeu = async (nr: number, opt: { bezahlt?: boolean; llc?: string } = {}) => {
  const REF = `FIAON-E520-${stempel}-${nr}`;
  const MAIL = mailVon(`kunde${nr}`);
  await sqlPool`
    INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, completed_at, amount_due, contact_name, contact_email, email, created_at)
    VALUES (${REF}, 'privat', 'submitted', 'global_individuell', 'Prüfstand', ${"PAY-" + REF}, 'paid', NOW(), NOW(), 100, 'Anna Prüfmann', ${MAIL}, ${MAIL}, NOW())`;
  // Die Bestellzeile steht immer als „bezahlt“ (die Preis-Wand der Datenbank lässt ein offenes Individualangebot ohne Angebotsteil
  // nicht zu) — maßgeblich für den Wächter ist allein fiaon_global_auftraege.bezahlt_am.
  await sqlPool`
    INSERT INTO fiaon_global_auftraege
      (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email, rechnung_ust_modus, created_at, gesellschaft, bezahlt_am)
    VALUES (${REF}, 'global_individuell', 'DE',
      ${sqlPool.json({ art: "privat", name: "Anna Prüfmann", strasse: "Prüfweg 1", plz: "12345", ort: "Musterstadt", land: "DE" } as any)},
      ${sqlPool.json({ anrede: "Frau", vorname: "Anna", nachname: "Prüfmann", funktion: "", email: MAIL, telefon: "+49301234567" } as any)},
      ${sqlPool.json({ annahme: "Auftrag zahlungspflichtig erteilen" } as any)}, 'PRUEF', 'de', NOW(), 'individualangebot', ${opt.bezahlt === false ? "offen" : "gestartet"}, 'Anna Prüfmann', ${MAIL}, 'none', NOW(),
      ${sqlPool.json({ name: opt.llc ?? "PRUEFMUSTER LLC", form: "llc", bundesstaat: "DE" } as any)}, ${opt.bezahlt === false ? null : new Date()})`;
  return REF;
};
const todo = async (ref: string) => ((await sqlPool`SELECT id, status, zustaendig_art, zustaendig_agent_id, titel, link, prioritaet, faellig_am, erledigt_art FROM fiaon_betreiber_todos WHERE schluessel = ${G.gruendungSchluessel(ref)}`) as any[])[0];

console.log("\n── B1  Der Wächter legt genau EINEN Auftrag an — bei der Person, die bestellt");
const R1 = await auftragNeu(1);
const R2 = await auftragNeu(2, { bezahlt: false, llc: "UNBEZAHLT LLC" });
const w1 = await W.gruendungWaechter(TAGS);
ok(w1.angelegt >= 1, "Wächter meldet: angelegt", w1);
const t1 = await todo(R1);
ok(t1 && t1.status !== "erledigt" && t1.zustaendig_art === "agent" && Number(t1.zustaendig_agent_id) === BESTELLT.id, "Auftrag liegt bei der eingestellten Person", t1);
ok(String(t1?.titel) === "Heute: Gründung bestellen — PRUEFMUSTER LLC (Delaware)", "Titel: Gesellschaft und Bundesstaat beim Namen, ohne Kundennamen", t1?.titel);
ok(String(t1?.link) === G.gruendungLink(R1) && Number(t1?.prioritaet) === 1, "Link in die Akte (Reiter), dringend");
ok(!(await todo(R2)), "unbezahlt → kein Auftrag");
const w2 = await W.gruendungWaechter(TAGS);
const n1 = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${G.gruendungSchluessel(R1)}`) as any[])[0].n);
ok(w2.angelegt === 0 && n1 === 1, "zweiter Lauf: kein zweiter Auftrag", { w2, n1 });

console.log("\n── B2  Zugriff: nur wer den offenen Auftrag hat");
ok(await W.gruendungDarf(BESTELLT.id, R1), "die Person mit dem Auftrag darf an die Akte");
ok(!(await W.gruendungDarf(FREMD.id, R1)), "ein Kollege ohne Auftrag nicht");
ok(!(await W.gruendungDarf(BESTELLT.id, R2)), "keine Akte ohne eigenen Auftrag");
ok((await W.gruendungRefsVon(BESTELLT.id)).includes(R1) && (await W.gruendungRefsVon(FREMD.id)).length === 0, "Raum „Global“: genau die eigenen Gründungs-Akten");

console.log("\n── B3  Die Sicht im Office");
const s1 = await W.gruendungSicht(R1);
ok(s1?.faellig === true && s1.schritte.length === 4 && s1.auftrag?.offen === true && s1.auftrag?.bei === "Greta Gründung", "fällig, vier Schritte, Auftrag offen bei der Person", s1 && { f: s1.faellig, n: s1.schritte.length, a: s1.auftrag });
ok(s1?.gesellschaft === "PRUEFMUSTER LLC" && s1?.bundesstaat === "Delaware", "Gesellschaft und Bundesstaat aus der Akte", s1 && { g: s1.gesellschaft, b: s1.bundesstaat });
ok(s1?.schritte.find((x) => x.key === "s08_formation")?.felder.find((x) => x.feld === "Member")?.wert === "Anna Prüfmann", "Member aus dem Kontakt der Akte");
const s2 = await W.gruendungSicht(R2);
ok(s2?.faellig === false && s2.bezahltAm === null, "unbezahlte Akte: nicht fällig");
ok((await W.gruendungSicht("FIAON-GIBT-ES-NICHT")) === null, "unbekannte Referenz → null");

console.log("\n── B4  „Bestellt“ nur mit Nummer → Station, Haken, Auftrag zu");
const b0 = await W.gruendungBestellt(R1, { bestellnummer: "fertig" }, BESTELLT);
ok(!b0.ok && (b0 as any).status === 400, "ohne echte Nummer → 400", b0);
const bU = await W.gruendungBestellt(R2, { bestellnummer: "AB12C3D4" }, BESTELLT);
ok(!bU.ok && (bU as any).status === 409, "unbezahlt → 409", bU);
const b1 = await W.gruendungBestellt(R1, { bestellnummer: " ab12c3d4 " }, BESTELLT);
ok(b1.ok, "mit Nummer → gespeichert", b1);
const [st] = (await sqlPool`SELECT status, intern FROM fiaon_global_schritte WHERE ref = ${R1} AND schluessel = ${G.GRUENDUNG_STATION}`) as any[];
ok(st?.status === "erledigt" && /Bestellnummer AB12C3D4/.test(String(st?.intern)), "Station „Gründung eingereicht“ erledigt, Nummer intern vermerkt", st);
const [hk] = (await sqlPool`SELECT arbeitsablauf_haken AS h FROM fiaon_global_auftraege WHERE ref = ${R1}`) as any[];
const haken = typeof hk?.h === "string" ? JSON.parse(hk.h) : (hk?.h ?? {});
ok(G.GRUENDUNG_HAKEN.every((k) => haken[k]?.von === "Greta Gründung"), "die drei Haken der Bestellung sind gesetzt", Object.keys(haken));
const t1b = await todo(R1);
ok(t1b?.status === "erledigt" && t1b?.erledigt_art === "auto", "Auftrag ist erledigt (durch die Tatsache, nicht von Hand)", t1b);
ok(await W.gruendungDarf(BESTELLT.id, R1), "24 Stunden nach dem Erledigen darf die Person noch nachsehen");
ok(!(await W.gruendungRefsVon(BESTELLT.id)).includes(R1), "in der Liste der offenen Gründungen steht die Akte nicht mehr");
await sqlPool`UPDATE fiaon_betreiber_todos SET erledigt_am = NOW() - INTERVAL '2 days' WHERE schluessel = ${G.gruendungSchluessel(R1)}`;
ok(!(await W.gruendungDarf(BESTELLT.id, R1)), "danach endet der Sonder-Zugriff");
ok(b1.ok && (b1 as any).gruendung?.bestellnummer === "AB12C3D4", "die Antwort trägt den neuen Stand gleich mit");
ok(/Danach trägst du unten die Bestellnummer ein\./.test(String(s1?.schritte.find((x) => x.key === "s08_formation")?.text)), "Schritt 8 verweist im Office auf die Bestellnummer, nicht auf die Station");
const s1b = await W.gruendungSicht(R1);
ok(s1b?.faellig === false && s1b?.bestellnummer === "AB12C3D4" && !!s1b?.eingereichtAm, "Sicht: erledigt, mit Nummer und Tag", s1b && { n: s1b.bestellnummer, am: s1b.eingereichtAm });
const b2 = await W.gruendungBestellt(R1, { bestellnummer: "AB12C3D4" }, BESTELLT);
ok(b2.ok, "noch einmal dieselbe Nummer: kein Fehler, nichts doppelt");
const w3 = await W.gruendungWaechter(TAGS);
ok(w3.angelegt === 0, "Wächter danach: nichts Neues", w3);

console.log("\n── B5  Nachhalten: am nächsten Werktag 10 Uhr noch offen → Ampel; erledigt → Ampel aus");
const R3 = await auftragNeu(3, { llc: "LIEGENGEBLIEBEN LLC" });
await W.gruendungWaechter(TAGS);
const t3 = await todo(R3);
ok(t3 && t3.status !== "erledigt", "Auftrag für die dritte Akte ist da");
await sqlPool`UPDATE fiaon_betreiber_todos SET created_at = NOW() - INTERVAL '5 days' WHERE id = ${t3.id}`;
const w4 = await W.gruendungWaechter(TAGS);
const alarm = async (ref: string) => ((await sqlPool`SELECT stufe, vorbei_am, titel, text FROM fiaon_system_alarme WHERE schluessel = ${G.gruendungAlarmSchluessel(ref)}`) as any[])[0];
const a3 = await alarm(R3);
ok(w4.eskaliert === 1 && a3 && a3.stufe === "rot" && !a3.vorbei_am && /LIEGENGEBLIEBEN LLC/.test(String(a3.titel)), "rote Zeile in der Ampel, mit Gesellschaft", { w4, a3 });
ok(!/Prüfmann/.test(`${a3?.titel} ${a3?.text}`), "Ampel-Text ohne Kundennamen");
const w5 = await W.gruendungWaechter(TAGS);
ok(w5.eskaliert === 0, "kein zweiter Alarm für dieselbe Sache", w5);
ok((await W.gruendungBestellt(R3, { bestellnummer: "ZX98Y7W6" }, BESTELLT)).ok && !!(await alarm(R3))?.vorbei_am, "bestellt → Ampel geht aus");
// Die Station von anderer Hand gesetzt (Chefbüro): Der Wächter schließt den Auftrag.
const R4 = await auftragNeu(4, { llc: "VON HAND LLC" });
await W.gruendungWaechter(TAGS);
await M.globalStationSpeichern(R4, { schluessel: G.GRUENDUNG_STATION, status: "erledigt" }, { id: FREMD.id, name: "Prüf-Leitung" });
const w6 = await W.gruendungWaechter(TAGS);
ok(w6.geschlossen === 1 && (await todo(R4))?.status === "erledigt", "Station im Chefbüro gesetzt → Wächter schließt den Auftrag", w6);

console.log("\n── B6  Der Schnitt-Lauf: alles Übrige zu, „Gründung bestellen“ bleibt, Zurückholen geht");
const P = await import("../server/lib/fiaon-hausputz");
const R5 = await auftragNeu(5, { llc: "BLEIBT OFFEN LLC" });
await W.gruendungWaechter(TAGS);
await T.todoAnlegen(`e520-alt-${stempel}-1`, { titel: "Alter Auftrag eins", text: "liegt seit Wochen" });
await T.todoAnlegen(`e520-alt-${stempel}-2`, { titel: "Kunde will Geld zurück", text: "Erstattung zugesagt" });
const offenVor = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE status <> 'erledigt'`) as any[])[0].n);
ok(offenVor >= 3, "vor dem Schnitt sind mindestens drei Aufträge offen", offenVor);
const freigabe = `2026-11-17 SCHNITT Prüfstand ${stempel}`;
const lauf = await P.hausputzAusfuehren(freigabe);
ok(lauf.ok && Number(lauf.zahlen?.erledigt) >= 2, "Schnitt-Lauf gelaufen", lauf);
const offenNach = (await sqlPool`SELECT schluessel FROM fiaon_betreiber_todos WHERE status <> 'erledigt'`) as any[];
ok(offenNach.length >= 1 && offenNach.every((x) => H.schnittVerschont({ schluessel: x.schluessel })), "offen bleiben NUR Aufträge von FIAON Global (hier: „Gründung bestellen“)", offenNach.map((x) => x.schluessel));
ok((await todo(R5))?.status !== "erledigt", "der frische Auftrag „Gründung bestellen“ ist noch offen");
const [alt2] = (await sqlPool`SELECT status, erledigt_art, erledigt_ereignis FROM fiaon_betreiber_todos WHERE schluessel = ${`e520-alt-${stempel}-2`}`) as any[];
ok(alt2?.status === "erledigt" && alt2?.erledigt_art === "hausputz" && /Großer Schnitt/.test(String(alt2?.erledigt_ereignis)), "auch die Erstattung ging zu — mit Grund „Großer Schnitt“", alt2);
const nochmal = await P.hausputzAusfuehren(freigabe);
ok(!nochmal.ok && /schon gelaufen/.test(String(nochmal.grund)), "dieselbe Freigabe läuft kein zweites Mal", nochmal);
const zur = await P.hausputzZurueckholen({ laufId: Number(lauf.laufId), regel: "schnitt" }, "Prüf-Leitung");
const [alt2b] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`e520-alt-${stempel}-2`}`) as any[];
ok(zur.zurueck >= 2 && alt2b?.status !== "erledigt", "Zurückholen öffnet die Zeilen wieder", { zur, alt2b });

ok(netz.length === 0, "kein Aufruf ins Netz", netz);
console.log(`\n${rot.length ? "ROT" : "GRÜN"}: ${gut} ok, ${rot.length} rot.`);
if (rot.length) console.log(rot.map((r) => `  · ${r}`).join("\n"));
await sqlPool.end({ timeout: 5 }).catch(() => {});
process.exit(rot.length ? 1 : 0);
