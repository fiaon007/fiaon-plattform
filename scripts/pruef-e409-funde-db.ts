// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 × E-406 (20.10.2026), DATENBANK: die Funde des unabhängigen Prüfers am ECHTEN Code gegen eine lokale
// Kopie — je Fund mindestens ein Fall, der auf dem Stand VOR der Korrektur rot ist. Erfundene Personen (Marke Q409),
// kein Netz, keine Schlüssel.
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_funde
//   (danach node scripts/run-migrations.mjs mit DATABASE_URL auf die Kopie)
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=… DATABASE_URL_EXTERN=… \
//     node_modules/.bin/tsx scripts/pruef-e409-funde-db.ts
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.KI_ANBIETER = "openai";
process.env.CRONS = "aus";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 600)}` : ""}`); }
};
let netz = 0;
globalThis.fetch = (async (url: any) => { netz++; return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 }); }) as any;

const NOTAUS = ["mara_aktion_an", "mara_wa_an", "postmeister_an", "mara_wa_nachfass", "mara_nicht_erreicht_mail", "mara_rate_erinnerung",
  "mara_anliegen", "mara_nacharbeit_mail", "mara_kyc_nachfordern", "unterlagen_umhaengen", "mara_notaus_vorher"];

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const A = await import("../server/lib/fiaon-ki-ampel");
  const E = await import("../server/lib/fiaon-ki-einstellungen");
  const H = await import("../server/lib/fiaon-ki-heute");
  const HE = await import("../server/lib/fiaon-mara-heute");
  const P = await import("../server/lib/fiaon-ki-pruefung");
  const ENT = await import("../server/lib/fiaon-mara-entscheidungen");
  const MT = await import("../server/lib/fiaon-mara-termin");
  const AUF = await import("../server/lib/fiaon-mara-auftrag");
  const ANW = await import("../server/lib/fiaon-mara-anweisung");
  const { aktionTabellen } = await import("../server/lib/fiaon-mara-aktion");
  await ENT.entscheidungTabellen();
  await MT.protokollTabelle();
  await aktionTabellen();
  await P.pruefungTabellen();
  await (await import("../server/lib/fiaon-postmeister-schema")).postmeisterSchema();
  await (await import("../server/lib/fiaon-mara-heute")).rueckTabelle();

  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, "mara_ampel", "aras_probe_nummer"]})`) as any[];
  const aufraeumen = async () => {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE 'PR-Q409-%'`) as any[]).map((r) => Number(r.id));
    if (personen.length) {
      for (const t of ["fiaon_postmeister", "fiaon_mara_aktion", "fiaon_whatsapp", "fiaon_mara_protokoll", "fiaon_ki_pruefung", "fiaon_mara_entscheidungen"]) {
        await sql.unsafe(`DELETE FROM ${t} WHERE person_id = ANY($1::int[])`, [personen]).catch(() => {});
      }
      await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, "mara_ampel", "aras_probe_nummer"]})`;
    await sql`DELETE FROM fiaon_mara_anweisung WHERE text LIKE '%Q409%'`.catch(() => {});
    A.ampelZwischenspeicherLeeren();
  };
  await aufraeumen();

  const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PR-Q409-1', 'Erika', 'Q409muster', 'q409@test.invalid') RETURNING id`) as any[];
  const pid = Number(p.id);

  /** Ein Abschnitt für sich: bricht er ab (auf dem alten Stand fehlt etwa eine Funktion), zählt das als rot. */
  const abschnitt = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { ok(false, `${name}: Abbruch`, String((e as Error)?.message ?? e).slice(0, 160)); }
  };
  try {
    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 3 + 1 · Maras Zahlen: Mails = Postfach + Mail-Aktion, WhatsApp nur von Mara — EINE Quelle für Lagezimmer und „Heute“");
    await abschnitt("Fund 3 + 1", async () => {
      const vorH = await H.kiHeute();
      await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, aktion, betreff, text, antwort, gesendet_am, empfangen_am, created_at)
                VALUES ('support@fiaon.com', 'q409-a', 't-q409-a', ${pid}, 'auto_beantwortet', 'Frage', 'Wie ist der Stand?', 'Alles gut.', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
                       ('support@fiaon.com', 'q409-b', 't-q409-b', ${pid}, 'entwurf', 'Noch eine', 'Und?', 'Entwurf', NULL, NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '8 minutes')`;
      await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, text, gesendet_am) VALUES (${pid}, 'FIAON-Q409', 'B', 1, 'gesendet', 'Ihre Aktivierung', 'Text', NOW() - INTERVAL '4 minutes')`;
      await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, von, status, gesendet_am, created_at)
                VALUES ('q409-wa-1', 'raus', '+4915100409001', ${pid}, 'text', 'Gern, ich kümmere mich.', 'Mara Lindner', 'delivered', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
                       ('q409-wa-2', 'raus', '+4915100409001', ${pid}, 'text', 'Hallo, hier Herr Stripling.', 'Daniel Stripling', 'delivered', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
                       ('q409-wa-3', 'rein', '+4915100409001', ${pid}, 'text', 'Danke!', NULL, 'gelesen', NULL, NOW() - INTERVAL '2 minutes')`;
      const h = await H.kiHeute();
      const d = (a: number, b: number) => a - b;
      ok(d(h.mara.mails.geschrieben, vorH.mara.mails.geschrieben) === 2, "„Mails geschrieben“: Postfach-Antwort + Aktionsmail (vorher immer 0)", { vor: vorH.mara.mails, nach: h.mara.mails });
      ok(d(h.mara.whatsapps.raus, vorH.mara.whatsapps.raus) === 1, "„WhatsApps raus“: nur Maras eigene (nicht der Mitarbeiter)", { vor: vorH.mara.whatsapps, nach: h.mara.whatsapps });
      ok(h.mara.mails.entwuerfe >= 1 && h.mara.whatsapps.rein >= 1, "Entwürfe warten und WhatsApps herein werden gezählt", { m: h.mara.mails, w: h.mara.whatsapps });
      const mt = await AUF.maraTag();
      ok(mt.mails.geschrieben >= 2 && mt.mails.entwuerfe >= 1, "Maras Tagesbericht (maraTag): kein stilles 0 mehr", mt.mails);
      const mh = await HE.maraHeuteLesen({ ohneGeld: true });
      const { maraHeuteKurz } = await import("../server/routes/fiaon-mara-heute");
      ok(h.mara.erledigt === mh.erledigt && maraHeuteKurz(mh).erledigt === mh.erledigt && h.mara.mails.geschrieben === mh.kennzahlen.mails.geschrieben, "Lagezimmer und KI-Team › Heute: dieselben Zahlen aus einer Quelle", { heute: h.mara.erledigt, lage: mh.erledigt });
      ok(maraHeuteKurz(mh).link === "/chef/s/ki-heute" && !("gelb" in maraHeuteKurz(mh) && Array.isArray((maraHeuteKurz(mh) as any).gelb)), "Lagezimmer: kurze Fassung mit Link, ohne Einzelzeilen");
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 1 · EINE Ampel: ein Klick überschreibt keine andere Zeile (auch keine unbekannte)");
    await abschnitt("Fund 1", async () => {
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_ampel', ${JSON.stringify({ stufen: { rueckruf_eintragen: "rot", werkzeug_von_morgen: "gelb" }, verlauf: [] })})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      A.ampelZwischenspeicherLeeren();
      const r = await A.ampelSetzen("mara", "antwort_senden", "gelb", "Prüfstand Q409");
      const st = await A.ampelStand("mara", true);
      ok(r.ok && st.stufen.antwort_senden === "gelb" && st.stufen.rueckruf_eintragen === "rot" && st.stufen.werkzeug_von_morgen === "gelb", "Setzen behält Rot einer anderen Zeile und fremde Schlüssel", st.stufen);
      ok((await A.ampelStufe("mara", "rueckruf_eintragen")) === "rot", "Rot bleibt rot");
      await sql`DELETE FROM fiaon_settings WHERE key = 'mara_ampel'`;
      A.ampelZwischenspeicherLeeren();
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 2 + 9 · Not-Aus über ALLE Mara-Wege; „Wieder an“ = genau der Stand von vorher");
    await abschnitt("Fund 2 + 9", async () => {
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_nachfass', 'aus'), ('postmeister_an', 'an')`;
      const n1 = await E.maraNotaus(true, "Prüfstand Q409");
      const jetzt = new Map(((await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${NOTAUS})`) as any[]).map((z) => [z.key, z.value]));
      ok(n1.ok && NOTAUS.filter((k) => k !== "mara_notaus_vorher").every((k) => jetzt.get(k) === "aus"), "Not-Aus: alle zehn Wege aus (Aktion, WhatsApp, Postfach, Nachfassen ×2, B1, C1, C2, B2 ×2)", Object.fromEntries(jetzt));
      ok(jetzt.has("mara_notaus_vorher"), "der Stand von vorher ist gemerkt");
      // Die Wege selbst lesen „aus“ (Fund 9: Nachfassen und 2× nicht erreicht hatten nur ihren eigenen Schalter).
      const NF = await import("../server/lib/fiaon-mara-nachfass");
      const nf = await NF.nachfassLauf({ trocken: true });
      ok((nf.uebersprungen.schalter_aus ?? 0) === 1, "WhatsApp-Nachfassen steht", nf.uebersprungen);
      ok(!(await (await import("../server/lib/fiaon-mara-nicht-erreicht")).schalterLesen()), "Nachfass-Mail nach 2× nicht erreicht steht");
      ok(!(await (await import("../server/lib/fiaon-mara-rate-erinnerung")).schalterLesen()), "B1 Raten-Mail steht");
      ok(!(await (await import("../server/lib/fiaon-mara-anliegen")).anliegenSchalterLesen()), "C1 Anliegen steht");
      ok(!(await (await import("../server/lib/fiaon-mara-nacharbeit")).schalterLesen()), "C2 Nacharbeit steht");
      ok(!(await (await import("../server/lib/fiaon-mara-kyc")).kycSchalterLesen()), "B2 KYC steht");
      const d = await AUF.dauerauftraegeLaufen();
      ok(d.geplant === 0 && d.ausgefuehrt === 0, "Maras Daueraufträge warten", d);
      const stand = await E.maraNotausStand();
      ok(stand.aktiv && stand.wege.find((x) => x.schluessel === "mara_wa_nachfass")?.vorherAn === false && stand.wege.find((x) => x.schluessel === "mara_aktion_an")?.vorherAn === true, "die Rückfrage kann zeigen, was wieder angeht und was aus bleibt", stand.wege.slice(0, 4));
      // Doppelklick: der Merker bleibt der von vorher.
      await E.maraNotaus(true, "Prüfstand Q409 (zweiter Klick)");
      const w = await E.maraNotaus(false, "Prüfstand Q409");
      const nach = new Map(((await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${NOTAUS})`) as any[]).map((z) => [z.key, z.value]));
      ok(w.ok && nach.get("mara_wa_nachfass") === "aus", "„Wieder an“: was vorher bewusst AUS war, bleibt aus", Object.fromEntries(nach));
      ok(nach.get("postmeister_an") === "an" && !nach.has("mara_aktion_an") && !nach.has("mara_rate_erinnerung") && !nach.has("mara_notaus_vorher"), "… und alles andere steht wie vorher (gesetzt bleibt gesetzt, fehlte bleibt Vorgabe), der Merker ist weg", Object.fromEntries(nach));
      const w2 = await E.maraNotaus(false, "Prüfstand Q409");
      ok(!w2.ok && w2.status === 409, "„Wieder an“ ohne Not-Aus schaltet nichts an (409)", w2);
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${NOTAUS})`;
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 4 · „Mara anweisen“ zu einer Aktionsmail landet in der Anweisung der Mail-Aktion");
    await abschnitt("Fund 4", async () => {
      const [z] = (await sql`INSERT INTO fiaon_ki_pruefung (kanal, bezug_art, bezug_id, person_id, urteil, punkte, begruendung, modell, kosten_cents, schluessel)
                             VALUES ('mail', 'mara_aktion', 940901, ${pid}, 'auffaellig', ${JSON.stringify([{ regel: "ton", schwere: "weich", treffer: "", hinweis: "Q409: nie „Leider“ im ersten Satz." }])}::text::jsonb, NULL, NULL, 0, 'aktion:B')
                             RETURNING id`) as any[];
      const vorAktion = await ANW.anweisungLesen("aktion");
      const vorPost = await ANW.anweisungLesen("postfach");
      const r = await P.pruefungEntscheiden(Number(z.id), "anweisen", "Prüfstand Q409");
      const nachAktion = await ANW.anweisungLesen("aktion");
      const nachPost = await ANW.anweisungLesen("postfach");
      ok(/Q409/.test(nachAktion) && !/Q409/.test(vorAktion), "die Hausanweisung „aktion“ trägt den Hinweis", r.hinweis);
      ok(nachPost === vorPost, "die Postfach-Anweisung bleibt unberührt");
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 6 · Rot = echte Karte oder ehrlich weggelassen; Lesefehler = streng");
    await abschnitt("Fund 6", async () => {
      const WA = await import("../server/lib/fiaon-whatsapp-mara");
      await A.ampelSetzen("mara", "zahlungszusage_merken", "rot", "Prüfstand Q409");
      await A.ampelSetzen("mara", "auskunft_anbieten", "rot", "Prüfstand Q409");
      const ctx = { personId: pid, leadId: null, nummer: "+4915100409001", kunde: "Ich zahle am Freitag." };
      const z1 = await WA.werkzeugAusfuehren("zahlungszusage_merken", { datum: "2030-01-04" }, ctx as any);
      ok(z1.ergebnis?.ok === false && /Ampel rot \(Zahlungszusage merken\)/.test(String(z1.aktion.vorlegen ?? "")), "WhatsApp, Rot mit Karte: nichts eingetragen, Karte an Justin (vorlegen)", z1.aktion);
      ok(/Geschäftsführung/.test(String(z1.ergebnis?.meldung ?? "")) && !/gesperrt/.test(String(z1.ergebnis?.meldung ?? "")), "dem Modell: ehrlich „unsere Geschäftsführung klärt es“", z1.ergebnis?.meldung);
      const z2 = await WA.werkzeugAusfuehren("auskunft_anbieten", {}, ctx as any);
      ok(z2.ergebnis?.ok === false && !z2.aktion.vorlegen && /lass es weg/.test(String(z2.ergebnis?.meldung ?? "")), "Rot mit „weglassen“: keine Karte, Mara antwortet ohne Angebot", z2);
      await new Promise((r) => setTimeout(r, 400)); // das Protokoll schreibt im Hintergrund
      const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE person_id = ${pid} AND art = 'ampel_rot' ORDER BY id`) as any[];
      ok(prot.length === 2 && prot.every((x) => /nicht ausgeführt/.test(x.text)), "Protokoll: ampel_rot je Weigerung, ehrlich formuliert", prot.map((x) => x.text));
      const kaputt: any = () => Promise.reject(new Error("Datenbank weg (Prüfstand)"));
      ok((await A.ampelStufe("mara", "rueckruf_eintragen", kaputt)) === "rot", "Lesefehler: Rückruf → rot (die strengste Stufe), nicht grün");
      ok((await A.ampelStufe("mara", "angaben_aendern", kaputt)) === "gelb" && (await A.ampelStufe("mara", "kuendigung_aufnehmen", kaputt)) === "gruen", "Lesefehler: ohne Rot → gelb; Kündigung bleibt fest grün");
      await sql`DELETE FROM fiaon_settings WHERE key = 'mara_ampel'`;
      A.ampelZwischenspeicherLeeren();
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 11 · Probe-Nummer verdeckt, keine Kundennamen für die Leitung auf „Heute“");
    await abschnitt("Fund 11", async () => {
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('aras_probe_nummer', '+4917000409678') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      const sicht = await E.einstellungenLesen();
      ok(sicht.werte.aras_probe_nummer === "••• 678" && sicht.gesetzt.aras_probe_nummer === true, "Einstellungen: nur die letzten 3 Ziffern", sicht.werte.aras_probe_nummer);
      ok(!JSON.stringify(sicht).includes("17000409"), "die volle Nummer verlässt den Server nicht");
      await ENT.entscheidungAnlegen({
        schluessel: "q409:karte", art: "frage", personId: pid, ref: null, titel: "Frau Q409muster fragt", text: "Frau Q409muster möchte die Rate verschieben.",
        empfehlung: "akte", optionen: [{ key: "akte", label: "Akte öffnen", werkzeug: "link", link: "/chef/s/akte?id=1" }, { key: "nichts", label: "So lassen", werkzeug: "nichts" }],
        belege: [{ art: "zitat", name: "Kunde", text: "Ich bin Erika Q409muster" }],
      } as any).catch((e) => console.log("     (Karte:", String(e?.message ?? e), ")"));
      const leitung = await H.kiHeute({ nameZeigen: false, entscheiden: false });
      const inhaber = await H.kiHeute({ nameZeigen: true, entscheiden: true });
      const meine = (k: any) => k.personId === pid && (k.optionen ?? []).some((o: any) => o.key === "akte");
      const kL = (leitung.karten as any[]).find(meine);
      const kI = (inhaber.karten as any[]).find(meine);
      const kPost = (leitung.karten as any[]).find((k) => k.art === "postmeister_entwurf" && k.personId === pid);
      ok(kL && kL.name === null && !/Q409muster/.test(JSON.stringify(kL)), "Leitung: Karte ohne Kundennamen (Name, Titel, Text, Zitate)", kL);
      ok(kI && /Q409muster/.test(String(kI.titel) + String(kI.name ?? "")), "Inhaber: wie bisher mit Namen");
      ok(kL?.optionen?.find((o: any) => o.key === "akte")?.link === "/chef/s/akte?id=1", "die Link-Option kommt als Link an (Fund 5: kein Knopf, kein 400)", { art: kL?.art, titel: kL?.titel, optionen: kL?.optionen });
      ok(/^\/chef\/s\/postmeister\?eintrag=\d+$/.test(String(kPost?.optionen?.find((o: any) => o.key === "selbst")?.link ?? "")), "Postfach-Karte: „Selbst antworten“ ist ein Link", kPost?.optionen);
      ok(leitung.darf.entscheiden === false && inhaber.darf.entscheiden === true, "entscheiden darf nur der Inhaber");
    });
  } finally {
    await aufraeumen();
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  ok(netz === 0, `kein Netz (${netz} Aufrufe)`);
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await new Promise((r) => setTimeout(r, 4000));
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
