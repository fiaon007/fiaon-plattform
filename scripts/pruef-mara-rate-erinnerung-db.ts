// Prüfstand E-406 B1 (19.10.2026), Datenbank-Teil: Mara-Inkasso, erste Stufe — frisch fällige Raten persönlich und
// freundlich. Mit erfundenen Testkunden (@e406.invalid) gegen eine LOKALE Prüfdatenbank. Kein Netz: Brevo ist eine
// Attrappe (fetch abgefangen), alles andere außer localhost ist gesperrt. Bricht ab, wenn DATABASE_URL nicht auf
// 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-rate-erinnerung-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import (Muster: pruef-mara-nicht-erreicht-db.ts) ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
const BREVO: { an: string; betreff: string; html: string; text: string }[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    BREVO.push({ an: String(b.to?.[0]?.email ?? "").toLowerCase(), betreff: String(b.subject ?? ""), html: String(b.htmlContent ?? ""), text: String(b.textContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<e406-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 600)}` : ""}`); }
}

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const M = await import("../server/lib/fiaon-mara-rate-erinnerung");
  const R = await import("../shared/fiaon-mara-rate-erinnerung");
  await import("../server/routes/fiaon-abo").then((a) => a.ensureAboTabellen());
  await M.merkerTabelle();
  await import("../server/lib/fiaon-mara-entscheidungen").then((e) => e.entscheidungTabellen()).catch((e: any) => console.log(`  (Hinweis: Kartentabelle nicht angelegt: ${e.message})`));

  const stempel = Date.now().toString(36).toUpperCase();
  const mailVon = (nn: string) => `${nn.toLowerCase()}-${stempel.toLowerCase()}@e406.invalid`;
  const heute = R.berlinTag(new Date());
  const tagMinus = (n: number) => R.tagDanach(heute, -n);
  // Ein Takt-Zeitpunkt sicher im Fenster 10–18 Uhr: jetzt (wenn offen), sonst heute 11:00 Berlin.
  const jetztEcht = new Date();
  const taktZeit = () => (R.imFenster(new Date()) && R.imFenster(new Date(Date.now() + 120_000)) ? new Date() : new Date(R.fensterBeginnAm(heute).getTime() + 3_600_000));
  console.log(`(Prüfzeit ${jetztEcht.toISOString()}, heute ${heute}, Takt um ${taktZeit().toISOString()})`);

  // ── Testkunden (erfunden): Person + bezahlte Bestellung „pro“ + Rate 1 (bezahlt) + Rate 2 (offen) ──
  const kunde = async (nn: string, o: {
    faelligVor?: number; test?: boolean; mail?: boolean; blockiert?: boolean; werbesperre?: boolean;
    antrag?: Record<string, unknown>; rate?: Record<string, unknown>; kontakte?: number; packKey?: string;
  } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am, is_blocked, werbung_gesperrt_am)
      VALUES (${`PR-E406-${nn}-${stempel}`}, ${"Test"}, ${nn}, ${o.mail === false ? null : mailVon(nn)}, 8,
              ${o.test ? new Date() : null}, ${!!o.blockiert}, ${o.werbesperre ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    const ref = `FIAON-E406-${nn.toUpperCase().slice(0, 12)}-${stempel}`;
    const zref = `E406${nn.toUpperCase()}${stempel}`.slice(0, 30);
    await sql`INSERT INTO fiaon_applications ${sql({
      ref, person_id: pid, type: "private", pack_key: o.packKey ?? "pro", pack_name: "FIAON Pro (Standard)", payment_status: "paid",
      status: "payment_completed", created_at: new Date(Date.now() - 45 * 86_400_000), paid_at: new Date(Date.now() - 40 * 86_400_000),
      first_name: "Test", last_name: nn, email: o.mail === false ? null : mailVon(nn), payment_reference: zref, amount_due: 59.99,
      ...(o.antrag ?? {}),
    } as any)}`;
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle)
      VALUES (${ref}, 1, ${`${zref}-1`}, 5999, ${tagMinus(40)}::date, 'bezahlt', NOW() - INTERVAL '40 days', 'pruefstand')`;
    const faellig = tagMinus(o.faelligVor ?? 1);
    const [r] = (await sql`INSERT INTO fiaon_abo_raten ${sql({
      ref, rate_nr: 2, zahlungsreferenz: `${zref}-2`, betrag_cents: 5999, faellig_am: faellig, status: "offen", quelle: "pruefstand",
      mahnstufe: 1, erinnerungen: 2, ...(o.rate ?? {}),
    } as any)} RETURNING id`) as any[];
    // Vorabinfo (Tag −3) als Zustellprotokoll — so wie der Abo-Motor sie schreibt. Sie zählt seit der Abnahme NICHT
    // (Justin 19.10., „100 % auf Verkauf“: die Zählung beginnt mit der Fälligkeit, KONTAKT_VORLAUF_TAGE = 0).
    // Dazu `kontakte` gezählte Kontakte ab Tag 0: die Rechnung (09:00), weitere Erinnerungen von Hand am selben Tag
    // (13:00, 17:00) nur, wenn verlangt. Standard: nur die Rechnung (1 Kontakt).
    await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, created_at)
      VALUES ('abo_payment_reminder', ${pid}, ${mailVon(nn)}, 'versandt', 'echt', (${faellig}::date - 3)::timestamp AT TIME ZONE 'Europe/Berlin' + INTERVAL '9 hours')`;
    const n = o.kontakte ?? 1;
    for (let i = 0; i < n; i++) {
      await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, created_at)
        VALUES ('abo_payment_reminder', ${pid}, ${mailVon(nn)}, 'versandt', 'echt', ${faellig}::date::timestamp AT TIME ZONE 'Europe/Berlin' + make_interval(hours => ${9 + 4 * (i % 3)}::int))`;
    }
    return { pid, ref, rateId: Number(r.id), zref: `${zref}-2`, faellig };
  };
  const merker = async (rateId: number) => ((await sql`SELECT * FROM fiaon_mara_rate_erinnerung WHERE rate_id = ${rateId}`) as any[])[0] ?? null;
  const anBrevo = (nn: string) => BREVO.filter((m) => m.an === mailVon(nn));
  const rateZeile = async (rateId: number) => ((await sql`SELECT mahnstufe, erinnerungen, letzte_erinnerung_at, vorab_am, status FROM fiaon_abo_raten WHERE id = ${rateId}`) as any[])[0];

  console.log("── 1 · Positiv: seit 1 Tag fällig, Vorabinfo + Rechnung → EINE persönliche Mail");
  const A = await kunde("Annaprobe");
  const vorher = await rateZeile(A.rateId);
  const t1 = await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mA = await merker(A.rateId);
  const brA = anBrevo("Annaprobe");
  ok(t1.neu >= 1 && mA?.status === "versandt", "vorgemerkt und versandt", { t1, merker: mA });
  ok(brA.length === 1, "genau EINE Mail an Brevo", brA.length);
  ok(/^Kurz von Mara: Ihre Monatsrate vom \d{2}\.\d{2}\.\d{4}$/.test(brA[0]?.betreff ?? ""), "Betreff persönlich mit Fälligkeitstag", brA[0]?.betreff);
  ok((brA[0]?.html ?? "").includes(`href="https://fiaon.com/zahlung/${A.zref}"`), "Knopf „Jetzt bezahlen“ → Zahlungsseite DIESER Rate", A.zref);
  ok(/\/termin\/[^"\s]+\?von=mara_rate_mail/.test(brA[0]?.html ?? ""), "zweiter Knopf → persönlicher Terminlink (Herkunft mara_rate_mail)");
  ok(/digitale Assistentin/.test(brA[0]?.text ?? "") && R.textPruefen(`${brA[0]?.betreff}\n\n${brA[0]?.text}`).length === 0, "Text an Brevo besteht die Textprüfung (E-393, Wortwand, kein Verkauf, KI-Offenlegung)");
  ok(/59,99 €/.test(brA[0]?.text ?? "") && (brA[0]?.text ?? "").includes(A.zref), "Betrag der Rate und Ratenreferenz im Text");
  const [logA] = (await sql`SELECT status FROM fiaon_mail_log WHERE person_id = ${A.pid} AND event = ${R.RATE_ERINNERUNG_EVENT}`) as any[];
  ok(logA?.status === "versandt", "Zustellprotokoll: eine Zeile „versandt“ mit person_id");
  const [vA] = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${A.ref} AND note LIKE 'Mara: freundliche Mail zur Rate 2%' ORDER BY id DESC LIMIT 1`) as any[];
  ok(!!vA, "Akte: Verlaufseintrag „Mara: freundliche Mail zur Rate 2 …“", vA?.note);
  const nachher = await rateZeile(A.rateId);
  ok(JSON.stringify(vorher) === JSON.stringify(nachher), "E-182: die Rate selbst bleibt unberührt (Mahnstufe, Zähler, letzte Erinnerung) — der Mahnmotor wird nie verschoben", { vorher, nachher });

  console.log("── 2 · Nie doppelt");
  const t2 = await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok(anBrevo("Annaprobe").length === 1 && t2.neu === 0, "zweiter Takt: keine zweite Mail, kein neuer Merker", t2);
  ok((await M.vormerken(heute)) === 0, "vormerken noch einmal: nichts Neues (ein Merker je Rate)");

  console.log("── 3 · Negativ: wer KEINE Mail bekommt (Merker mit Grund)");
  const fall = async (name: string, nn: string, o: Parameters<typeof kunde>[1], status: string, grund: RegExp, vor?: (k: Awaited<ReturnType<typeof kunde>>) => Promise<void>) => {
    const k = await kunde(nn, o);
    if (vor) await vor(k);
    await M.rateErinnerungTakt({ jetzt: taktZeit() });
    const m = await merker(k.rateId);
    ok(m?.status === status && grund.test(String(m?.grund ?? "")) && anBrevo(nn).length === 0, `${name} → ${status} (${m?.grund ?? "—"})`, m);
    return k;
  };
  const neg: Awaited<ReturnType<typeof kunde>>[] = [];
  neg.push(await fall("Vertragsende (Altvertrag, Rate danach fällig)", "Endeprobe", {
    antrag: { gekuendigt_am: new Date(Date.now() - 20 * 86_400_000), vertrag_ende_am: new Date(Date.now() - 10 * 86_400_000), agb_stand: null },
  }, "ausgelassen", /Vertragsende/));
  neg.push(await fall("Testperson", "Testprobe", { test: true }, "ausgelassen", /Testkonto/));
  neg.push(await fall("Mahnstopp (nach der ersten Zahlung)", "Mahnstoppprobe", { antrag: { mahnstopp_am: new Date() } }, "ausgelassen", /Mahnstopp/));
  neg.push(await fall("Kündigung eingegangen, nicht gebucht", "Kuendprobe", {}, "ausgelassen", /Kündigung eingegangen/, async (k) => {
    await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status) VALUES (${k.ref}, 'Test', 'Kuendprobe', ${mailVon("Kuendprobe")}, 'Prüfstand E-406', 'pending')`;
  }));
  neg.push(await fall("Kündigung gebucht (Rate noch vor dem Ende)", "Gebuchtprobe", {
    antrag: { gekuendigt_am: new Date(Date.now() - 2 * 86_400_000), vertrag_ende_am: new Date(Date.now() + 20 * 86_400_000) },
  }, "ausgelassen", /Kündigung gebucht/));
  neg.push(await fall("schon 3 Kontakte zu dieser Rate", "Dreiprobe", { kontakte: 3 }, "ausgelassen", /3 Kontakte/));
  neg.push(await fall("Global-Bestellung (Einmalkauf, keine Forderung aus einem Abo)", "Globalprobe", { packKey: "global_struktur" }, "ausgelassen", /Bestellung trägt keine Forderung|FIAON Global/));
  neg.push(await fall("Vertriebssperre (is_blocked)", "Sperrprobe", { blockiert: true }, "ausgelassen", /Vertriebssperre/));
  neg.push(await fall("Widerruf im Postfach", "Widerrufprobe", {}, "ausgelassen", /Widerruf/, async (k) => {
    await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, empfangen_am, flags, aktion)
      VALUES ('welcome@fiaon.com', ${`e406-w-${k.pid}`}, ${`e406-t-${k.pid}`}, ${k.pid}, NOW() - INTERVAL '3 days', ${sql.json({ widerruf: true })}, 'entwurf')`;
  }));
  neg.push(await fall("Beschwerde (heikler Fall, 30 Tage)", "Beschwerdeprobe", {}, "ausgelassen", /kann nicht zahlen|Beschwerde/, async (k) => {
    await sql`INSERT INTO fiaon_betreiber_todos (titel, person_id, art, status) VALUES ('Prüfstand E-406: Beschwerde', ${k.pid}, 'beschwerde', 'offen')`;
  }));
  neg.push(await fall("offene Entscheidungskarte bei Justin", "Karteprobe", {}, "ausgelassen", /Entscheidung/, async (k) => {
    await sql`INSERT INTO fiaon_mara_entscheidungen (schluessel, art, person_id, titel, status) VALUES (${`e406:${k.pid}`}, 'mahnstopp', ${k.pid}, 'Prüfstand E-406', 'offen')`;
  }));
  neg.push(await fall("Zahlungszusage offen", "Zusageprobe", { rate: { inkasso_zusage_am: R.tagDanach(heute, 3) } }, "erledigt", /Zahlungszusage/));
  neg.push(await fall("Termin steht", "Terminprobe", {}, "erledigt", /Termin/, async (k) => {
    await sql`INSERT INTO fiaon_termine ${sql({ person_id: k.pid, agent_id: 8, beginn: new Date(Date.now() + 2 * 86_400_000), status: "gebucht", quelle: "pruefstand", storno_token: `e406t${k.pid}${stempel}` } as any)}`;
  }));
  neg.push(await fall("passender Eingang im Bankbuch", "Eingangprobe", {}, "erledigt", /Eingang/, async (k) => {
    await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, extracted_ref, applied) VALUES (${`e406-${k.pid}`}, NOW(), 5999, 'EUR', 'Unbekannt', ${k.zref}, FALSE)`;
  }));
  neg.push(await fall("keine E-Mail-Adresse", "Ohnemailprobe", { mail: false }, "ohne_mail", /keine E-Mail/));
  const negMails = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = ${R.RATE_ERINNERUNG_EVENT} AND person_id = ANY(${neg.map((x) => x.pid)})`) as any[];
  ok(Number(negMails[0].n) === 0, `keiner der ${neg.length} bekommt eine Mail`, negMails[0].n);

  console.log("── 4 · Werbesperre: Zahlungspost ohne Verkauf geht trotzdem");
  const W = await kunde("Werbeprobe", { werbesperre: true });
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(W.rateId))?.status === "versandt" && anBrevo("Werbeprobe").length === 1, "Werbesperre → versandt (Service, kein Verkauf)", await merker(W.rateId));
  ok(!/Kreditkarte|Limit|Partnerbank|Ihr Ziel/i.test(anBrevo("Werbeprobe")[0]?.html ?? ""), "… ohne Karten-Block, Limit oder Partnerbank");

  console.log("── 5 · Nichts doppelt am selben Tag: Rechnung/Mahnung heute → Mara wartet bis morgen");
  const H = await kunde("Heuteprobe");
  await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, created_at) VALUES ('abo_payment_reminder', ${H.pid}, ${mailVon("Heuteprobe")}, 'versandt', 'echt', NOW())`;
  // Diese Mail zählt auch als Kontakt (jetzt 2: Rechnung + heute; die Vorabinfo zählt nicht) — unter 3, „heute“ urteilt allein.
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mH = await merker(H.rateId);
  ok(mH?.status === "vorgemerkt" && /heute ging schon/.test(String(mH?.grund)) && anBrevo("Heuteprobe").length === 0, "wartet (Grund „heute ging schon …“), keine Mail", mH);
  ok(mH?.nicht_vor && R.berlinTag(new Date(mH.nicht_vor)) === R.tagDanach(heute) && R.berlinMinuten(new Date(mH.nicht_vor)) === R.FENSTER_AB_MIN, "… bis morgen 10:00", mH?.nicht_vor);
  const morgen = new Date(R.fensterBeginnAm(R.tagDanach(heute)).getTime() + 5 * 60_000);
  await sql`UPDATE fiaon_mail_log SET created_at = created_at - INTERVAL '1 day' WHERE person_id = ${H.pid} AND event = 'abo_payment_reminder' AND created_at > NOW() - INTERVAL '1 hour'`;
  await M.rateErinnerungTakt({ jetzt: morgen });
  ok((await merker(H.rateId))?.status === "versandt" && anBrevo("Heuteprobe").length === 1, "am nächsten Tag (10:05): versandt — Tag 2 liegt noch in der ersten Stufe", await merker(H.rateId));

  console.log("── 6 · Abo-Motor heute dran (Tag 3, Stufe 2 fällig) → Mara schreibt nicht, die erste Stufe verfällt");
  const D3 = await kunde("Motorprobe", { faelligVor: 3, rate: { letzte_erinnerung_at: new Date(Date.now() - 3 * 86_400_000) } });
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mD3 = await merker(D3.rateId);
  ok(mD3?.status === "verfallen" && /Abo-Motors/.test(String(mD3?.grund)) && anBrevo("Motorprobe").length === 0, "Tag 3 + Mahnung heute fällig → verfallen, keine Mail", mD3);
  const D4 = await kunde("Altprobe", { faelligVor: 4 });
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(D4.rateId)) === null && anBrevo("Altprobe").length === 0, "seit 4 Tagen fällig → nicht in der Grundmenge (Altbestand ruht)");
  const D0 = await kunde("Heutefaelligprobe", { faelligVor: 0 });
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(D0.rateId)) === null, "heute fällig (Tag 0) → noch nicht dran (die Rechnung ist heute)");

  console.log("── 7 · Fenster 10–18 Uhr");
  const F = await kunde("Fensterprobe");
  const frueh = new Date(R.fensterBeginnAm(heute).getTime() - 90 * 60_000); // 08:30
  await M.rateErinnerungTakt({ jetzt: frueh });
  const mF = await merker(F.rateId);
  ok(mF?.status === "vorgemerkt" && /10 Uhr|10–18/.test(String(mF?.grund)) && anBrevo("Fensterprobe").length === 0, "08:30 → wartet, keine Mail", mF);
  ok(mF?.nicht_vor && new Date(mF.nicht_vor).getTime() === R.fensterBeginnAm(heute).getTime(), "… bis heute 10:00", mF?.nicht_vor);
  await M.rateErinnerungTakt({ jetzt: new Date(R.fensterBeginnAm(heute).getTime() - 60_000) });
  ok(anBrevo("Fensterprobe").length === 0, "09:59: nichts");
  await M.rateErinnerungTakt({ jetzt: new Date(R.fensterBeginnAm(heute).getTime() + 5 * 60_000) });
  ok(anBrevo("Fensterprobe").length === 1 && (await merker(F.rateId))?.status === "versandt", "10:05: versandt");

  console.log("── 8 · Zwischendurch bezahlt oder Ratenpause → der Takt sendet nicht mehr");
  const Z = await kunde("Bezahltprobe");
  await M.vormerken(heute);
  await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE id = ${Z.rateId}`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(Z.rateId))?.status === "erledigt" && anBrevo("Bezahltprobe").length === 0, "bezahlt → erledigt, keine Mail", await merker(Z.rateId));
  const P = await kunde("Pauseprobe");
  await M.vormerken(heute);
  const { ratenpauseAnwenden } = await import("../server/lib/fiaon-ratenpause");
  const pause = await ratenpauseAnwenden({ ref: P.ref, grund: "Prüfstand E-406: Ratenpause", agentId: null, agentName: "Prüfstand", verlauf: false });
  ok(pause.ok === true, "Ratenpause über den bestehenden Weg gesetzt", pause);
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mP = await merker(P.rateId);
  ok(mP?.status === "erledigt" && /nicht mehr fällig/.test(String(mP?.grund)) && anBrevo("Pauseprobe").length === 0, "Ratenpause → erledigt, keine Mail", mP);

  console.log("── 9 · Kunde schreibt gerade selbst → Mara wartet 24 h Ruhe ab");
  const G = await kunde("Gespraechprobe");
  await sql`INSERT INTO fiaon_whatsapp ${sql({ person_id: G.pid, richtung: "rein", text: "Hallo, kurze Frage", nummer: `4915100${String(G.pid).padStart(6, "0")}` } as any)}`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mG = await merker(G.rateId);
  ok(mG?.status === "vorgemerkt" && /schreibt gerade selbst/.test(String(mG?.grund)) && anBrevo("Gespraechprobe").length === 0, "wartet, keine Mail", mG);
  // Integration E-406 Welle 1 (B1 × C1): Ein Anliegen im Kundenbereich zählt genauso — Mara antwortet dort, keine zweite Mail daneben.
  const GA = await kunde("Anliegenprobe");
  await sql`INSERT INTO fiaon_tickets (ref, person_id, betreff, text, status) VALUES (${GA.ref}, ${GA.pid}, 'Rate', 'Kann ich später zahlen?', 'offen')`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mGA = await merker(GA.rateId);
  ok(mGA?.status === "vorgemerkt" && /schreibt gerade selbst/.test(String(mGA?.grund)) && anBrevo("Anliegenprobe").length === 0, "Anliegen im Kundenbereich → wartet, keine Mail", mGA);
  await sql`DELETE FROM fiaon_tickets WHERE person_id = ${GA.pid}`;

  console.log("── 10 · Schalter aus, Hängengebliebenes, Verfall");
  await M.schalterSetzen(false);
  const S = await kunde("Schalterprobe");
  const tAus = await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok(tAus.aus === true && (await merker(S.rateId)) === null && anBrevo("Schalterprobe").length === 0, "Schalter aus: kein Merker, keine Mail");
  await M.schalterSetzen(true);
  ok(await M.schalterLesen(), "Schalter wieder an");
  const Hg = await kunde("Haengeprobe");
  await sql`INSERT INTO fiaon_mara_rate_erinnerung (rate_id, person_id, ref, rate_nr, faellig_am, status, bearbeitet_am) VALUES (${Hg.rateId}, ${Hg.pid}, ${Hg.ref}, 2, ${Hg.faellig}::date, 'in_arbeit', NOW() - INTERVAL '40 minutes')`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(Hg.rateId))?.status === "unklar" && anBrevo("Haengeprobe").length === 0, "hängengeblieben → „unklar“, nie neu gesendet");
  await sql`UPDATE fiaon_mara_rate_erinnerung SET faellig_am = ${tagMinus(5)}::date WHERE rate_id = ${G.rateId}`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok((await merker(G.rateId))?.status === "verfallen", "vorgemerkt, aber über Tag 3 → „verfallen“");

  console.log("── 11 · Wirkung im Steuerpult: angeschrieben, danach bezahlt");
  await sql`UPDATE fiaon_mara_rate_erinnerung SET versandt_am = NOW() - INTERVAL '1 day' WHERE rate_id = ${A.rateId}`;
  await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE id = ${A.rateId}`;
  const st = await M.rateErinnerungStand();
  ok(st.an && st.eingerichtet, "Schalter an, Tabelle da");
  ok(st.woche.angeschrieben >= 4 && st.woche.bezahlt >= 1 && st.woche.bezahltCents >= 5999, "7 Tage: angeschrieben und danach bezahlt (mit Betrag)", st.woche);
  ok(st.heute.bezahlt >= 1, "heute: eine nach Maras Mail bezahlte Rate", st.heute);
  ok(st.tage.length >= 1 && st.tage.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.tag)), "je Tag eine Zeile (Berliner Tag)", st.tage);
  ok(st.gruende.length === 5 && st.gruende.every((g) => g.n >= 1 && g.grund.length > 5), "Gründe fürs Nichtschreiben sichtbar (die fünf häufigsten, 7 Tage)", st.gruende);

  console.log("── 12 · Rot-Probe: Merker verloren → trotzdem kein zweites Mal (die eigene Mail zählt als Kontakt)");
  // Rechnung + Erinnerung ab der Fälligkeit (2) + Maras eigene Mail = 3.
  const B2 = await kunde("Zweitprobe", { kontakte: 2 });
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  ok(anBrevo("Zweitprobe").length === 1, "erste Mail raus");
  await sql`DELETE FROM fiaon_mara_rate_erinnerung WHERE rate_id = ${B2.rateId}`;
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mB2 = await merker(B2.rateId);
  ok(anBrevo("Zweitprobe").length === 1 && mB2?.status === "ausgelassen" && /3 Kontakte/.test(String(mB2?.grund)), "Merker gelöscht → neuer Merker „ausgelassen (3 Kontakte)“, keine zweite Mail", mB2);

  console.log("── 13 · Abnahme (Justin 19.10., „100 % auf Verkauf“): die Vorabinfo vom Tag −3 zählt nicht — die Zählung beginnt mit der Fälligkeit");
  // Gemessen (Produktion nur lesend, 30 Tage, 134 nach Tag 0 offene Raten): alte Zählung ab Tag −7 sperrte 83 (3 Kontakte:
  // Vorabinfo, Rechnung, WhatsApp), ab der Fälligkeit nur noch 6 — 128 statt 51 erreichbar.
  const V = await kunde("Vorabprobe", { kontakte: 2 });
  const [mv] = (await sql`SELECT COUNT(*)::int AS n, MIN(created_at) < ${V.faellig}::date::timestamp AT TIME ZONE 'Europe/Berlin' AS vorab
                          FROM fiaon_mail_log WHERE person_id = ${V.pid} AND event = 'abo_payment_reminder'`) as any[];
  ok(mv?.n === 3 && mv?.vorab === true, "Lage: 3 Raten-Mails im alten 7-Tage-Fenster (Vorabinfo Tag −3, Rechnung und Erinnerung Tag 0) — alte Zählung: gesperrt", mv);
  await M.rateErinnerungTakt({ jetzt: taktZeit() });
  const mV = await merker(V.rateId);
  ok(mV?.status === "versandt" && Number(mV?.kontakte) === 2 && anBrevo("Vorabprobe").length === 1, "ROT mit der alten Zählung: ab der Fälligkeit nur 2 Kontakte → Mara schreibt (Merker kontakte = 2)", mV);
  ok(R.KONTAKT_VORLAUF_TAGE === 0, "die Regel sagt es selbst: KONTAKT_VORLAUF_TAGE = 0");

  ok(FREMD.length === 0, "kein Netzzugriff außer der Brevo-Attrappe", FREMD);

  // Aufräumen: eigene Zeilen (Stempel) — die Prüfdatenbank wird danach ohnehin gelöscht.
  await sql`DELETE FROM fiaon_mara_rate_erinnerung WHERE ref LIKE ${`FIAON-E406-%-${stempel}`}`;
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error("Prüfstand abgebrochen:", e); process.exit(2); });
