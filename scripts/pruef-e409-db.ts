// Prüfstand E-409 (19.10.2026), Datenbank-Teil: Prüf-Mara (Takt mit Modell-Attrappe → Befunde, Karte NUR bei
// Auffälligem, idempotent, entscheiden), Werkzeug-Ampel (rot sperrt, gelb protokolliert, fest bleibt), Einstellungen
// (Register-Grenze, fremder Setzer → 409, Aras → 404), Mara-Auftrag einstellung_setzen (nur Register), Heute, Kosten.
// NUR gegen eine lokale fiaon_pruefstand*-Datenbank, ohne Schlüssel (kein Netz, kein Versand):
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e409
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e409?sslmode=require' DATABASE_URL_EXTERN=<dasselbe> \
//     node_modules/.bin/tsx scripts/pruef-e409-db.ts
//   PGSSLMODE=require dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_e409
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.KI_ANBIETER = "openai";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
let netz = 0;
globalThis.fetch = (async (url: any) => { netz++; return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 }); }) as any;

async function main() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const sql = sqlPool;
  const P = await import("../server/lib/fiaon-ki-pruefung");
  const A = await import("../server/lib/fiaon-ki-ampel");
  const E = await import("../server/lib/fiaon-ki-einstellungen");
  const H = await import("../server/lib/fiaon-ki-heute");
  const ENT = await import("../server/lib/fiaon-mara-entscheidungen");
  const { protokollTabelle } = await import("../server/lib/fiaon-mara-termin");
  const { ensureTabelle } = await import("../server/routes/fiaon-postmeister").catch(() => ({ ensureTabelle: null as any }));
  await ENT.entscheidungTabellen();
  await protokollTabelle();
  await P.pruefungTabellen();
  if (ensureTabelle) await ensureTabelle();
  await (await import("../server/lib/fiaon-postmeister-schema")).postmeisterSchema();

  // ── Testdaten (erfunden) ───────────────────────────────────────────────
  await sql`DELETE FROM fiaon_settings WHERE key IN ('pruef_mara_quote','pruef_mara_an','pruef_mara_tag_euro','mara_ampel','mara_wa_an','mara_wa_tag_euro','mara_aktion_an','postmeister_an','postmeister_tag_euro')`;
  const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PR-E409-T', 'Tim', 'Testkunde', 'e409@test.invalid') RETURNING id`) as any[];
  const pid = Number(p.id);
  const mail = async (gmail: string, antwort: string) => {
    const [z] = (await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, aktion, antwort, gesendet_am, empfangen_am)
                           VALUES ('support@fiaon.com', ${gmail}, ${`t-${gmail}`}, ${pid}, 'gesendet', ${antwort}, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours') RETURNING id`) as any[];
    return Number(z.id);
  };
  const gutId = await mail("e409-gut", "Guten Tag Herr Testkunde, vielen Dank für Ihre Nachricht. Ihre Zahlung ist eingegangen — alles ist im grünen Bereich. Freundliche Grüße, Mara Lindner");
  const schlechtId = await mail("e409-schlecht", "Guten Tag, das Angebot gilt nur heute — wenn Sie nicht bis Freitag zahlen, geht das an Inkasso. Wir buchen dann per Lastschrift ab.");
  const [wa] = (await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status, von, auto_antwort) VALUES ('raus', '+49151000E409', ${pid}, 'text', 'Hallo, leider leider leider ist das so, aber gut.', 'gesendet', 'mara', TRUE) RETURNING id`) as any[];
  const waId = Number(wa.id);

  console.log("── 1 · Prüf-Mara: Takt mit Modell-Attrappe — Karte NUR bei Auffälligem");
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('pruef_mara_quote', '{"telefon":100,"mail":100,"whatsapp":100}')`;
  let modellRufe = 0;
  P.pruefModellSetzen(async ({ text }) => { modellRufe++; return { urteil: { urteil: /Inkasso/.test(text) ? "fehler" : "ok", punkte: [], begruendung: "Attrappe" }, modell: "attrappe", kostenCents: 0.1 }; });
  const r1 = await P.pruefungTakt();
  ok(r1.geprueft === 3 && r1.auffaellig === 1, `3 geprüft, 1 auffällig (${JSON.stringify(r1)})`);
  ok(modellRufe === 3, `Attrappe dreimal gefragt (${modellRufe})`);
  const z = (await sql`SELECT * FROM fiaon_ki_pruefung WHERE person_id = ${pid} ORDER BY id`) as any[];
  const zGut = z.find((x) => Number(x.bezug_id) === gutId && x.bezug_art === "postmeister"), zSchl = z.find((x) => Number(x.bezug_id) === schlechtId), zWa = z.find((x) => x.bezug_art === "whatsapp");
  ok(zGut?.urteil === "ok" && !zGut.karte_schluessel, "saubere Mail: ok, keine Karte");
  ok(zSchl?.urteil === "fehler" && !!zSchl.karte_schluessel, `Druck/Lastschrift: fehler + Karte (${zSchl?.karte_schluessel})`);
  const punkte = Array.isArray(zSchl?.punkte) ? zSchl.punkte : JSON.parse(String(zSchl?.punkte ?? "[]"));
  ok(punkte.some((x: any) => x.regel === "druck") && punkte.some((x: any) => x.regel === "lastschrift"), "Punkte: druck + lastschrift");
  ok(zWa?.urteil === "ok" || zWa?.urteil === "auffaellig", `WhatsApp geprüft (${zWa?.urteil}), Modell ok → ${zWa?.karte_schluessel ? "Karte" : "keine Karte"}`);
  ok(zSchl?.schluessel === "postfach:support", `Schlüssel postfach:support (${zSchl?.schluessel})`);
  const [karte] = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE schluessel = ${zSchl.karte_schluessel}`) as any[];
  ok(karte?.art === "pruefung" && karte.empfehlung === "anweisen" && karte.status === "offen", "Karte: Art pruefung, Empfehlung anweisen, offen");
  ok(!String(karte?.text ?? "").includes("Tim"), "Karte nennt keinen Vornamen");
  const r2 = await P.pruefungTakt();
  ok(r2.geprueft === 0, "zweiter Lauf prüft nichts doppelt");
  const fq = await P.fehlerquote(7);
  ok(fq.gesamt.n === 3 && fq.gesamt.auffaellig === 1, `Fehlerquote 1/3 (${JSON.stringify(fq.gesamt)})`);
  const st = await P.pruefungStand();
  ok(st.heute === 3 && st.auffaellig === 1 && st.offenKarten === 1, `Stand heute 3/1, 1 Karte offen (${JSON.stringify({ h: st.heute, a: st.auffaellig, o: st.offenKarten })})`);
  // Karte über den Karten-Weg entscheiden (Werkzeug pruefung_in_ordnung) — die Werkzeuge sind beim Laden angemeldet.
  const ent = await ENT.entscheiden(Number(karte.id), "in_ordnung", { von: "Prüfstand E409" });
  ok(ent.ok && ent.karte?.status === "entschieden", `Karte per Werkzeug entschieden (${ent.karte?.status} ${ent.error ?? ""})`);
  const [zNach] = (await sql`SELECT entschieden FROM fiaon_ki_pruefung WHERE id = ${zSchl.id}`) as any[];
  ok(zNach?.entschieden === "in_ordnung", "Prüfung trägt entschieden = in_ordnung");
  const fq2 = await P.fehlerquote(7);
  ok(fq2.gesamt.auffaellig === 0, "„in Ordnung“ zählt nicht mehr als Fehler");
  // Deckel: bei 0 € fragt der Takt das Modell nicht mehr — Regeln laufen trotzdem.
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('pruef_mara_tag_euro', '0')`;
  await sql`INSERT INTO fiaon_ki_nutzung (dienst, modell, kosten_cents, ok) VALUES ('pruef-mara', 'attrappe', 1, TRUE)`;
  const id3 = await mail("e409-deckel", "Hallo, nur heute noch!");
  modellRufe = 0;
  const r3 = await P.pruefungTakt();
  const [z3] = (await sql`SELECT urteil, modell FROM fiaon_ki_pruefung WHERE bezug_id = ${id3} AND bezug_art = 'postmeister'`) as any[];
  ok(r3.geprueft === 1 && modellRufe === 0 && z3?.modell === "deckel" && z3?.urteil === "fehler", `Deckel erreicht: Regeln ja, Modell nein (${z3?.modell}/${z3?.urteil})`);
  await sql`UPDATE fiaon_settings SET value = '10' WHERE key = 'pruef_mara_tag_euro'`;
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('pruef_mara_an', 'aus')`;
  const r4 = await P.pruefungTakt();
  ok(r4.grund === "schalter_aus" && r4.geprueft === 0, "Schalter aus → kein Lauf");
  await sql`UPDATE fiaon_settings SET value = 'an' WHERE key = 'pruef_mara_an'`;
  ok(netz === 0, `kein Netz (${netz} Aufrufe)`);

  console.log("── 2 · Werkzeug-Ampel");
  const s1 = await A.ampelSetzen("mara", "rueckruf_eintragen", "rot", "Prüfstand");
  ok(s1.ok && s1.zeile.stufe === "rot", "rueckruf_eintragen → rot gespeichert");
  const g1 = await A.ampelPruefen("mara", "rueckruf_eintragen", { kanal: "whatsapp", personId: pid, nummer: "+49151000E409" });
  ok(g1.gesperrt && !!g1.text, "rot sperrt mit Satz");
  const s2 = await A.ampelSetzen("mara", "zahlungszusage_merken", "gelb", "Prüfstand");
  const g2 = await A.ampelPruefen("mara", "zahlungszusage_merken", { kanal: "whatsapp", personId: pid });
  ok(s2.ok && !g2.gesperrt && g2.stufe === "gelb", "gelb lässt durch");
  await new Promise((r) => setTimeout(r, 150));
  const prot = (await sql`SELECT art FROM fiaon_mara_protokoll WHERE person_id = ${pid} AND art IN ('ampel_rot','ampel_gelb') ORDER BY id`) as any[];
  ok(prot.some((x) => x.art === "ampel_rot") && prot.some((x) => x.art === "ampel_gelb"), `Protokoll ampel_rot + ampel_gelb (${prot.map((x) => x.art).join(",")})`);
  const s3 = await A.ampelSetzen("mara", "geld_buchen", "gruen", "Prüfstand");
  ok(!s3.ok, "fest rot lässt sich nicht umschalten");
  const s4 = await A.ampelSetzen("mara", "konto_freischalten", "gruen", "Prüfstand");
  ok(!s4.ok, "konto_freischalten kennt kein grün (braucht einen Menschen)");
  const g3 = await A.ampelPruefen("mara", "unbekanntes_werkzeug", { kanal: "mail" });
  ok(!g3.gesperrt && g3.stufe === "gruen", "unbekanntes Werkzeug → grün (die Ampel bremst nur, was sie kennt)");
  const zeilen = await A.ampelZeilenLesen("mara");
  ok(zeilen.find((x) => x.key === "rueckruf_eintragen")?.geaendertAm != null, "Zeile trägt „geändert am“");
  // Der WhatsApp-Werkzeugweg selbst: rot kommt als Meldung ans Modell zurück, ohne zu buchen.
  const WA = await import("../server/lib/fiaon-whatsapp-mara");
  const wz = await WA.werkzeugAusfuehren("rueckruf_eintragen", { zeit: "2030-01-01 10:00" }, { personId: pid, leadId: null, nummer: "+49151000E409" } as any);
  ok(wz.ergebnis?.ok === false && String(wz.ergebnis?.meldung ?? "").includes("gesperrt") && wz.aktion.ok === false, "werkzeugAusfuehren: rot → Meldung, kein Termin");
  const [termine] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${pid}`) as any[];
  ok(Number(termine.n) === 0, "kein Termin gebucht");

  console.log("── 3 · Einstellungen (Register) und Mara-Auftrag einstellung_setzen");
  const e1 = await E.einstellungSetzen("mara_wa_tag_euro", "45", "Prüfstand");
  ok(e1.ok && (e1 as any).wert === "45", "KI_SCHLUESSEL: mara_wa_tag_euro = 45");
  const e2 = await E.einstellungSetzen("mara_wa_tag_euro", "999", "Prüfstand");
  ok(!e2.ok && e2.status === 400, "über der Grenze → 400");
  const e3 = await E.einstellungSetzen("mara_aktion_an", "aus", "Prüfstand");
  ok(!e3.ok && e3.status === 409 && e3.fehler.includes("/chef/mara/einstellung"), "fremder Setzer → 409 mit Route");
  const e4 = await E.einstellungSetzen("aras_an", "an", "Prüfstand");
  ok(!e4.ok && e4.status === 404, "Aras nicht verbunden → 404");
  const e5 = await E.einstellungSetzen("gibt_es_nicht", "x", "Prüfstand");
  ok(!e5.ok && e5.status === 404, "unbekannt → 404");
  const sicht = await E.einstellungenLesen();
  ok(sicht.werte.mara_wa_tag_euro === "45" && sicht.gesetzt.mara_wa_tag_euro === true && sicht.werte.pruef_mara_tag_euro === "10", "Werte gelesen (gesetzt + Vorgabe)");
  ok(sicht.werte.postmeister_tag_euro === "35" && sicht.arasVerbunden === false, "Vorgabe postmeister_tag_euro 35, Aras nicht verbunden");
  const { werkzeugFinden } = await import("../server/lib/fiaon-mara-auftrag");
  const wSet = werkzeugFinden("einstellung_setzen")!;
  const a1 = await wSet.ausfuehren({ schluessel: "irgendwas_fremdes", wert: "1" }, "Prüfstand");
  ok(!a1.ok, "Mara-Auftrag: Schlüssel außerhalb des Registers abgelehnt");
  const [fremd] = (await sql`SELECT 1 FROM fiaon_settings WHERE key = 'irgendwas_fremdes'`) as any[];
  ok(!fremd, "… und nichts geschrieben");
  const a2 = await wSet.ausfuehren({ schluessel: "mara_wa_nachfass_tag", wert: "600" }, "Prüfstand");
  ok(!a2.ok, "Mara-Auftrag: Wert über der Grenze abgelehnt");
  const a3 = await wSet.ausfuehren({ schluessel: "mara_wa_nachfass_tag", wert: "25" }, "Prüfstand");
  const [nf] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'mara_wa_nachfass_tag'`) as any[];
  ok(a3.ok && nf?.value === "25", "Mara-Auftrag: Register-Schlüssel gesetzt");
  const PM = await import("../server/lib/fiaon-postmeister-agent");
  await E.einstellungSetzen("postmeister_tag_euro", "12", "Prüfstand");
  ok((await PM.postmeisterTagEuro()) === 12, "postmeister_tag_euro wird vom Postfach gelesen");
  const n1 = await E.maraNotaus(true, "Prüfstand");
  const notaus = (await sql`SELECT key, value FROM fiaon_settings WHERE key IN ('mara_aktion_an','mara_wa_an','postmeister_an')`) as any[];
  ok(n1.aktion === "aus" && notaus.length === 3 && notaus.every((x) => x.value === "aus"), "Not-Aus Mara setzt drei Schalter auf aus");
  await E.maraNotaus(false, "Prüfstand");
  const wieder = (await sql`SELECT value FROM fiaon_settings WHERE key IN ('mara_aktion_an','mara_wa_an','postmeister_an')`) as any[];
  ok(wieder.every((x) => x.value === "an"), "… und „wieder an“ stellt an");

  console.log("── 4 · Heute und Kosten");
  const h = await H.kiHeute();
  ok(h.tag.length === 10 && h.mara && h.aras === null && Array.isArray(h.kosten) && h.pruefung.heute === 4, `kiHeute: Form stimmt, Aras null, 4 Prüfungen heute (${h.pruefung.heute})`);
  ok(h.mara.an.aktion && h.mara.an.whatsapp && h.mara.an.postfach, "Heute: Mara an (drei Schalter)");
  ok(h.mara.gelb.length >= 1, `Heute: gelbes Werkzeug gelistet (${h.mara.gelb.length})`);
  const k = await H.kiKostenJeDienst();
  ok(k.some((x) => x.dienst === "pruef-mara" && x.deckel === 10), `Kosten: pruef-mara mit Deckel 10 (${JSON.stringify(k.map((x) => [x.dienst, x.euro, x.deckel]))})`);
  const v = await H.kiKostenVerlauf(14);
  ok(v.length === 14 && v[13].ki >= 0, "Verlauf 14 Tage");

  // Aufräumen — auch die Schalter, sonst stolpern andere Prüfstände auf derselben Kopie über eine rote Ampel.
  await sql`DELETE FROM fiaon_settings WHERE key IN ('mara_ampel','pruef_mara_quote','pruef_mara_an','pruef_mara_tag_euro','mara_wa_tag_euro','mara_wa_nachfass_tag','postmeister_tag_euro')`;
  await sql`DELETE FROM fiaon_ki_nutzung WHERE dienst = 'pruef-mara' AND modell = 'attrappe'`;
  await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel LIKE 'pruefung:%'`;
  await sql`DELETE FROM fiaon_ki_pruefung WHERE person_id = ${pid}`;
  await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ${pid}`;
  await sql`DELETE FROM fiaon_postmeister WHERE person_id = ${pid}`;
  await sql`DELETE FROM fiaon_whatsapp WHERE id = ${waId}`;
  await sql`DELETE FROM fiaon_persons WHERE id = ${pid}`;
  console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
