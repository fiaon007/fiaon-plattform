// Prüfstand E-401 (5/6, 19.10.2026), Datenbank-Teil: Mara fasst nach 2× „nicht erreicht“ selbst nach —
// mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank. Kein Netz: Brevo ist eine Attrappe (fetch
// abgefangen), alles andere außer localhost ist gesperrt. Bricht ab, wenn DATABASE_URL nicht auf
// 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e401?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-nicht-erreicht-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import (Muster: pruef-mara-termine.ts) ──
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
    return new Response(JSON.stringify({ messageId: `<e401-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
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
  const K = await import("../server/lib/fiaon-kontakt-ergebnis");
  const N = await import("../server/lib/fiaon-mara-nicht-erreicht");
  const R = await import("../shared/fiaon-nicht-erreicht-nachfass");

  await N.nachfassTabelle();
  const stempel = Date.now().toString(36).toUpperCase();
  const mailVon = (nn: string) => `${nn.toLowerCase()}-${stempel.toLowerCase()}@e401.invalid`;

  // ── Testpersonen (erfunden) ─────────────────────────────────────────────
  const person = async (vn: string, nn: string, o: {
    test?: boolean; mail?: boolean; agent?: number | null; blockiert?: boolean; werbesperre?: boolean; inkasso?: boolean;
    antrag?: Record<string, unknown> | null;
  } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am, is_blocked, werbung_gesperrt_am, inkasso_ab)
      VALUES (${`PR-E401N-${nn}-${stempel}`}, ${vn}, ${nn}, ${o.mail === false ? null : mailVon(nn)}, ${o.agent === undefined ? 8 : o.agent},
              ${o.test ? new Date() : null}, ${!!o.blockiert}, ${o.werbesperre ? new Date() : null}, ${o.inkasso ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    let ref: string | null = null;
    if (o.antrag !== null) {
      ref = `FIAON-E401N-${nn.toUpperCase()}-${stempel}`;
      await sql`INSERT INTO fiaon_applications ${sql({
        ref, person_id: pid, type: "private", pack_key: "pro", pack_name: "FIAON Pro (Standard)", payment_status: "pending",
        created_at: new Date(Date.now() - 5 * 86_400_000), first_name: vn, last_name: nn, email: o.mail === false ? null : mailVon(nn),
        payment_reference: `E401N-${nn.slice(0, 6)}-${stempel}`.slice(0, 30),
        ...(o.antrag ?? {}),
      } as any)}`;
    }
    return { pid, ref };
  };
  const versuch = async (p: { pid: number; ref: string | null }, ergebnis: "nicht_erreicht" | "mailbox" | "erreicht_sonstiges" = "nicht_erreicht") => {
    // Entprellung (30 Min., fiaon-fehlversuch.ts) überspringen: Jeder Aufruf hier ist ein neuer Anruf.
    await sql`UPDATE fiaon_fehlversuch_marke SET am = NOW() - INTERVAL '31 minutes' WHERE person_id = ${p.pid}`.catch(() => {});
    return K.ergebnisAnwenden({ ref: p.ref, personId: p.pid, ergebnis });
  };
  const merker = async (pid: number) => ((await sql`SELECT * FROM fiaon_nicht_erreicht_nachfass WHERE person_id = ${pid}`) as any[])[0] ?? null;
  const mails = async (pid: number) => (await sql`SELECT event, status, grund, payload FROM fiaon_mail_log WHERE person_id = ${pid} AND event = ${R.NACHFASS_EVENT} ORDER BY id`) as any[];
  const anBrevo = (nn: string) => BREVO.filter((m) => m.an === mailVon(nn));

  const jetzt = new Date();
  const imFenster = R.imVersandfenster(jetzt);
  // Ein Takt-Zeitpunkt sicher im Fenster: jetzt (wenn offen), sonst das nächste 08:00 (+5 Min.).
  const taktZeit = () => {
    const n = new Date();
    return R.imVersandfenster(n) && R.imVersandfenster(new Date(n.getTime() + 60_000)) ? n : new Date(R.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };
  console.log(`(Prüfzeit ${jetzt.toISOString()}, ${imFenster ? "im" : "außerhalb des"} Versandfensters)`);

  console.log("── 1 · Positiv (Vertrieb): 2× nicht erreicht → vorgemerkt → der Takt sendet EINE Mail mit Terminlink");
  const A = await person("Anna", "Nachfassprobe");
  const w1 = await versuch(A);
  ok(!w1.maraNachfass?.urteil && (await merker(A.pid)) === null, "nach dem 1. Versuch: nichts vorgemerkt", w1.maraNachfass);
  const w2 = await versuch(A);
  const erw = imFenster ? "senden" : "warten";
  ok(w2.maraNachfass?.urteil?.art === erw, `nach dem 2. Versuch: Urteil „${erw}“`, w2.maraNachfass);
  ok(/Mara schickt dem Kunden .*Terminlink/.test(w2.meldung), "Meldung an den Mitarbeiter sagt es", w2.meldung);
  const mA = await merker(A.pid);
  ok(mA?.status === "vorgemerkt" && Number(mA?.versuche) === 2, "Merker: vorgemerkt, 2 Versuche", mA);
  ok(anBrevo("Nachfassprobe").length === 0 && (await mails(A.pid)).length === 0, "im Klick selbst geht noch nichts raus (der Takt sendet)");
  const t1 = await N.nachfassTakt({ jetzt: taktZeit() });
  const mA2 = await merker(A.pid);
  const brA = anBrevo("Nachfassprobe");
  ok(mA2?.status === "versandt" && t1.versandt >= 1, "Takt: versandt", { merker: mA2, t1 });
  ok(brA.length === 1, "genau EINE Mail an Brevo", brA.length);
  ok(/zweimal nicht erreicht/.test(brA[0]?.betreff ?? "") && /wann passt es Ihnen/.test(brA[0]?.betreff ?? ""), "Betreff richtig", brA[0]?.betreff);
  ok(/\/termin\/[^"\s]+\?von=nicht_erreicht_2_mail/.test(brA[0]?.html ?? ""), "Knopf: persönlicher Terminlink mit Herkunft nicht_erreicht_2_mail");
  ok(/Herr Stripling/.test(brA[0]?.html ?? "") && !/\bDaniel\b/.test(brA[0]?.html ?? ""), "Betreuer in der Nennform („Herr Stripling“), nie der Vorname");
  const logA = await mails(A.pid);
  ok(logA.length === 1 && logA[0].status === "versandt", "Zustellprotokoll: eine Zeile „versandt“ mit person_id", logA.map((x: any) => x.status));
  const [vA] = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${A.ref} AND note LIKE 'Mara: kurze Mail mit dem Terminlink%' ORDER BY id DESC LIMIT 1`) as any[];
  ok(!!vA, "Akte: Verlaufseintrag „Mara: kurze Mail mit dem Terminlink versandt“");

  console.log("── 2 · Nie doppelt");
  await N.nachfassTakt({ jetzt: taktZeit() });
  ok(anBrevo("Nachfassprobe").length === 1, "zweiter Takt: keine zweite Mail");
  const w3 = await versuch(A);
  ok(!w3.maraNachfass?.urteil && (await merker(A.pid))?.status === "versandt", "3. Versuch: nichts Neues (nur beim 2.)", w3.maraNachfass);
  await versuch(A, "erreicht_sonstiges");
  const [zA] = (await sql`SELECT unreachable_count FROM fiaon_persons WHERE id = ${A.pid}`) as any[];
  ok(Number(zA.unreachable_count) === 0, "erreicht → Zähler 0");
  await versuch(A); const w5 = await versuch(A);
  ok(!w5.maraNachfass?.urteil, "neue Serie binnen 30 Tagen (wieder 2×) → KEINE zweite Mail", w5.maraNachfass);
  await N.nachfassTakt({ jetzt: taktZeit() });
  ok(anBrevo("Nachfassprobe").length === 1 && (await mails(A.pid)).length === 1, "weiter genau eine Mail");
  await sql`UPDATE fiaon_nicht_erreicht_nachfass SET vorgemerkt_am = NOW() - INTERVAL '31 days' WHERE person_id = ${A.pid}`;
  await versuch(A, "erreicht_sonstiges"); await versuch(A); const w6 = await versuch(A);
  ok(!!w6.maraNachfass?.urteil, "nach 30 Tagen darf eine neue Serie wieder eine Mail vormerken", w6.maraNachfass);

  console.log("── 3 · Positiv (Onboarding) und „Mailbox“ zählt mit");
  const O = await person("Olga", "Onboardingprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 3 * 86_400_000) } });
  await versuch(O, "mailbox"); const wO = await versuch(O, "nicht_erreicht");
  ok(wO.maraNachfass?.urteil?.art === erw, "bezahlt, Startgespräch offen: Mailbox + nicht erreicht → vorgemerkt", wO.maraNachfass);

  console.log("── 4 · Negativ: wer NIE eine Mail bekommt (Merker „ausgelassen“ mit Grund)");
  const fall = async (name: string, nn: string, o: Parameters<typeof person>[2], grund: RegExp, vor?: (p: { pid: number; ref: string | null }) => Promise<void>) => {
    const p = await person("Test", nn, o);
    if (vor) await vor(p);
    await versuch(p); const w = await versuch(p);
    const m = await merker(p.pid);
    ok(m?.status === "ausgelassen" && grund.test(String(m?.grund ?? "")), `${name} → ausgelassen (${m?.grund ?? "—"})`, { urteil: w.maraNachfass?.urteil, m });
    return p;
  };
  const pW = await fall("Werbesperre", "Werbesperreprobe", { werbesperre: true }, /Werbesperre/);
  const pB = await fall("Vertriebssperre (is_blocked)", "Sperrprobe", { blockiert: true }, /Vertriebssperre/);
  const pT = await fall("Testkonto", "Testkontoprobe", { test: true }, /Testkonto/);
  const pI = await fall("Forderungsmanagement (inkasso_ab)", "Ratenprobe", { inkasso: true }, /Forderungsmanagement/);
  const pG = await fall("Kunde von FIAON Global", "Globalprobe", { antrag: { pack_key: "global_struktur", pack_name: "FIAON Global Struktur" } }, /FIAON Global/);
  const pK = await fall("gekündigt", "Kuendigungsprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 40 * 86_400_000), gekuendigt_am: new Date(Date.now() - 2 * 86_400_000) } }, /gekündigt/);
  const pS = await fall("„Stopp“ auf WhatsApp", "Stoppprobe", {}, /Stopp/, async (p) => {
    await sql`INSERT INTO fiaon_whatsapp ${sql({ person_id: p.pid, richtung: "rein", text: "STOPP", nummer: `4915100${String(p.pid).padStart(6, "0")}` } as any)}`.catch((e: any) => console.log(`    (Hinweis: WhatsApp-Zeile nicht angelegt: ${e.message})`));
  });
  const pM = await fall("keine E-Mail", "Ohnemailprobe", { mail: false }, /keine E-Mail/);
  const pBu = await fall("Termin steht schon", "Terminprobe", {}, /Termin oder vereinbarter Rückruf/, async (p) => {
    await sql`INSERT INTO fiaon_termine ${sql({ person_id: p.pid, agent_id: 8, beginn: new Date(Date.now() + 2 * 86_400_000), status: "gebucht", quelle: "nichterreicht_mail", storno_token: `e401n${p.pid}${stempel}` } as any)}`;
  });
  // E-401 Nachbesserung (Prüfer-Fund): ein eingegangener, NIE gebuchter Kündigungsantrag (gekuendigt_am leer) — vorher „senden“.
  const pKo = await fall("Kündigung eingegangen, nicht gebucht", "Kuendantragprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 20 * 86_400_000) } },
    /Kündigung eingegangen/, async (p) => {
      await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status) VALUES (${p.ref}, 'Test', 'Kuendantragprobe', ${mailVon("Kuendantragprobe")}, 'Prüfstand E-401', 'pending')`;
    });
  const negativ = [pW, pB, pT, pI, pG, pK, pS, pM, pBu, pKo];
  await N.nachfassTakt({ jetzt: taktZeit() });
  const negMails = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = ${R.NACHFASS_EVENT} AND person_id = ANY(${negativ.map((x) => x.pid)})`) as any[];
  ok(Number(negMails[0].n) === 0, "keiner der zehn bekommt eine Mail (auch nicht durch den Takt)", negMails[0].n);

  console.log("── 5 · Zwischendurch erreicht oder gebucht → der Takt sendet nicht mehr");
  const E = await person("Emil", "Erreichtprobe");
  await versuch(E); await versuch(E);
  ok((await merker(E.pid))?.status === "vorgemerkt", "vorgemerkt");
  await versuch(E, "erreicht_sonstiges");
  await N.nachfassTakt({ jetzt: taktZeit() });
  const mE = await merker(E.pid);
  ok(mE?.status === "erledigt" && anBrevo("Erreichtprobe").length === 0, "erreicht → erledigt, keine Mail", mE);
  const Bk = await person("Berta", "Buchtprobe");
  await versuch(Bk); await versuch(Bk);
  await sql`INSERT INTO fiaon_termine ${sql({ person_id: Bk.pid, agent_id: 8, beginn: new Date(Date.now() + 3 * 86_400_000), status: "gebucht", quelle: "nichterreicht_mail", storno_token: `e401b${Bk.pid}${stempel}` } as any)}`;
  await N.nachfassTakt({ jetzt: taktZeit() });
  const mB = await merker(Bk.pid);
  ok(mB?.status === "erledigt" && /Termin/.test(String(mB?.grund)) && anBrevo("Buchtprobe").length === 0, "selbst gebucht → erledigt, keine Mail", mB);

  console.log("── 6 · Versandfenster: 21:30 vorgemerkt → wartet bis 08:00");
  const F = await person("Frida", "Fensterprobe");
  await versuch(F);
  await sql`UPDATE fiaon_persons SET unreachable_count = 2 WHERE id = ${F.pid}`;
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  // Heute 21:30 Berliner Zeit — der Versatz, bei dem die Berliner Uhr wirklich 21:30 zeigt.
  const abends = ["+02:00", "+01:00"].map((v) => new Date(`${heute}T21:30:00${v}`)).find((d) => R.berlinMinuten(d) === 21 * 60 + 30)!;
  const vF = await N.nachfassVormerken(F.pid, 2, sql, abends);
  const morgen8 = R.naechstesFenster(abends);
  ok(vF.urteil?.art === "warten" && (vF.urteil as any).nichtVor.getTime() === morgen8.getTime(), "21:30 → warten bis morgen 08:00", vF.urteil);
  ok(/morgen 08:00 Uhr/.test(vF.hinweis ?? ""), "Hinweis „morgen 08:00 Uhr“", vF.hinweis);
  await N.nachfassTakt({ jetzt: new Date(abends.getTime() + 15 * 60_000) });
  ok(anBrevo("Fensterprobe").length === 0 && (await merker(F.pid))?.status === "vorgemerkt", "Takt um 21:45: nichts (Fenster zu)");
  await N.nachfassTakt({ jetzt: new Date(morgen8.getTime() - 60_000) });
  ok(anBrevo("Fensterprobe").length === 0, "Takt um 07:59: nichts");
  await N.nachfassTakt({ jetzt: new Date(morgen8.getTime() + 5 * 60_000) });
  ok(anBrevo("Fensterprobe").length === 1 && (await merker(F.pid))?.status === "versandt", "Takt um 08:05: gesendet");

  console.log("── 7 · Abstand: Rückhol-Mail vor 2 h → wartet (keine zwei Terminlinks am selben Tag)");
  const Rh = await person("Rita", "Abstandprobe");
  await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, created_at) VALUES ('rueckhol_s4', ${Rh.pid}, ${mailVon("Abstandprobe")}, 'versandt', NOW() - INTERVAL '2 hours')`;
  await versuch(Rh); const wR = await versuch(Rh);
  ok(wR.maraNachfass?.urteil?.art === "warten" && /Terminlink/.test(String((wR.maraNachfass?.urteil as any)?.grund)), "warten (Abstand)", wR.maraNachfass?.urteil);
  await N.nachfassTakt({ jetzt: taktZeit() });
  ok(anBrevo("Abstandprobe").length === 0 && (await merker(Rh.pid))?.status === "vorgemerkt", "Takt sendet noch nicht");

  // E-401 Nachbesserung (Prüfer-Fund): auch nach einer Mara-Aktion-Mail (Status „gesendet“) wartet Mara den Abstand ab.
  const Ma = await person("Mia", "Aktionsabstandprobe");
  await sql`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, created_at) VALUES ('mara_aktion', ${Ma.pid}, ${mailVon("Aktionsabstandprobe")}, 'gesendet', NOW() - INTERVAL '3 hours')`;
  await versuch(Ma); const wMa = await versuch(Ma);
  ok(wMa.maraNachfass?.urteil?.art === "warten", "Mara-Aktion vor 3 h → warten (vorher: sofort senden)", wMa.maraNachfass?.urteil);
  // … und umgekehrt: die Rückholung sendet binnen 20 h nach Maras Mail nicht (die SQL läuft, die Person ist ausgeschlossen).
  {
    const RH = await import("../server/lib/fiaon-rueckholung");
    let fehlerRh = "";
    const s4 = await RH.rueckholKandidaten("s4_nie_gemahnt", 500).catch((e: any) => { fehlerRh = String(e?.message ?? e); return []; });
    const s5 = await RH.rueckholKandidaten("s5_altbestand", 500).catch((e: any) => { fehlerRh = String(e?.message ?? e); return []; });
    ok(!fehlerRh, "rueckholKandidaten (S4 und Dauerpflege) laufen mit der neuen 20-Stunden-Sperre", fehlerRh);
    ok(![...s4, ...s5].some((f: any) => Number(f.personId ?? f.person_id) === A.pid), "Person A (Maras Mail eben versandt) steht in keiner Rückhol-Liste");
  }

  console.log("── 8 · Schalter aus, Hängengebliebenes, Verfall");
  await N.schalterSetzen(false);
  const S = await person("Sven", "Schalterprobe");
  await versuch(S); const wS = await versuch(S);
  ok(!wS.maraNachfass?.urteil && (await merker(S.pid)) === null, "Schalter aus: nichts vorgemerkt", wS.maraNachfass);
  const tAus = await N.nachfassTakt({ jetzt: taktZeit() });
  ok(tAus.aus === true, "Takt: aus");
  await N.schalterSetzen(true);
  ok(await N.schalterLesen(), "Schalter wieder an");
  const H = await person("Hugo", "Haengeprobe");
  await sql`INSERT INTO fiaon_nicht_erreicht_nachfass (person_id, vorgemerkt_am, versuche, status, bearbeitet_am) VALUES (${H.pid}, NOW() - INTERVAL '1 hour', 2, 'in_arbeit', NOW() - INTERVAL '40 minutes')`;
  const V = await person("Vera", "Verfallprobe");
  await sql`INSERT INTO fiaon_nicht_erreicht_nachfass (person_id, vorgemerkt_am, versuche, status, nicht_vor) VALUES (${V.pid}, NOW() - INTERVAL '49 hours', 2, 'vorgemerkt', NOW() - INTERVAL '1 hour')`;
  await N.nachfassTakt({ jetzt: taktZeit() });
  ok((await merker(H.pid))?.status === "unklar" && anBrevo("Haengeprobe").length === 0, "hängengeblieben → „unklar“, nie neu gesendet");
  ok((await merker(V.pid))?.status === "verfallen" && anBrevo("Verfallprobe").length === 0, "zu lange gewartet → „verfallen“");

  console.log("── 9 · In einer Transaktion (Tagesbericht-Weg): Vormerken bricht nichts ab");
  const Tx = await person("Theo", "Transaktionsprobe");
  let txFehler = "";
  try {
    await sql.begin(async (tx: any) => {
      await tx`UPDATE fiaon_persons SET unreachable_count = 1 WHERE id = ${Tx.pid}`;
      const w = await K.ergebnisAnwenden({ ref: Tx.ref, personId: Tx.pid, ergebnis: "nicht_erreicht" }, tx);
      ok(!!w.maraNachfass?.urteil, "in der Transaktion vorgemerkt", w.maraNachfass);
      const [m] = (await tx`SELECT status FROM fiaon_nicht_erreicht_nachfass WHERE person_id = ${Tx.pid}`) as any[];
      ok(m?.status === "vorgemerkt", "Merker in der Transaktion sichtbar");
      throw new Error("zurückrollen");
    });
  } catch (e: any) { txFehler = e.message; }
  ok(txFehler === "zurückrollen" && (await merker(Tx.pid)) === null, "zurückgerollt — kein Merker bleibt");

  console.log("── 10 · Die Tür hält Global auch ohne den Takt auf (PRIVATLINIE_PERSON)");
  const { sendMakeWebhookMitGrund } = await import("../server/make-webhook");
  const tuer = await sendMakeWebhookMitGrund(R.NACHFASS_EVENT as any, { email: mailVon("Globalprobe"), person_id: pG.pid, termin_link: "https://www.fiaon.com/termin/x" });
  ok(!tuer.ok && /FIAON Global/.test(String(tuer.grund)), "Tür: Global-Kunde → nicht gesendet", tuer);
  const tuerT = await sendMakeWebhookMitGrund(R.NACHFASS_EVENT as any, { email: mailVon("Testkontoprobe"), person_id: pT.pid, termin_link: "https://www.fiaon.com/termin/x" });
  ok(!tuerT.ok && /Testkonto/.test(String(tuerT.grund)), "Tür: Testkonto → nicht gesendet (NUR_BIS_VERTRAGSENDE)", tuerT);

  console.log("── 11 · Der Stand fürs Chefbüro");
  const st = await N.nachfassStand();
  ok(st.an === true && st.eingerichtet === true, "an, eingerichtet");
  ok(st.woche.versandt >= 2 && st.woche.ausgelassen >= 9 && st.wartet >= 1, "Zahlen: versandt ≥ 2, ausgelassen ≥ 9, wartet ≥ 1", st);
  ok(st.gruende.length > 0 && st.gruende.every((g) => g.n >= 1), "häufigste Gründe fürs Auslassen", st.gruende);

  ok(FREMD.length === 0, "kein fremder Netzaufruf (nur Brevo-Attrappe)", FREMD);
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
