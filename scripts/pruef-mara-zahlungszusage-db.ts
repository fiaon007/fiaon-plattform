// Prüfstand E-406 B1 Nachbesserung (19.10.2026), Datenbank-Teil: Mail-Mara hält den genannten Zahltag fest.
// Prüfer-Fund: Antwortet der Kunde auf Maras Raten-Mail „ich zahle am Freitag“, blieb promised_payment_date leer.
// Hier gegen eine LOKALE Prüfdatenbank mit erfundenen Testkunden (@e406z.invalid): das Server-Modul direkt UND der
// echte Weg durch Mail-Mara (antwortErzeugen) mit einer Modell-Attrappe — kein Netz, kein Versand. Bricht ab, wenn
// DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null PGSSLMODE=require \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406n?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-zahlungszusage-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Modell-Attrappe VOR jedem Import: antwortet aus ANTWORT, merkt sich Maras Auftrag — sonst kein Netz ──
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e406z";
process.env.KI_ANBIETER = "openai";
let ANTWORT = "";
const AUFTRAEGE: string[] = [];
let modellRufe = 0;
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    modellRufe++;
    try { AUFTRAEGE.push(JSON.stringify(JSON.parse(String(init?.body ?? "{}")).input ?? "")); } catch { AUFTRAEGE.push(""); }
    const text = JSON.stringify({ antwort: ANTWORT, naechster_schritt: { art: "zahlung", url: null, text: "Jetzt bezahlen" }, belege: [], fragen_beantwortet: [], merken: [] });
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 700)}` : ""}`); }
}

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const M = await import("../server/lib/fiaon-mara-zahlungszusage");
  const Z = await import("../shared/fiaon-zahlungszusage");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const { naechsterVersuch } = await import("../shared/fiaon-wiedervorlage");
  await import("../server/routes/fiaon-abo").then((a) => a.ensureAboTabellen());

  const stempel = Date.now().toString(36).toUpperCase();
  let lfd = 10;
  const mailVon = (nn: string) => `${nn.toLowerCase()}-${stempel.toLowerCase()}@e406z.invalid`;
  const heute = berlinToday();
  const plus = (n: number) => Z.plusTage(heute, n);
  const wochentagDe = (d: string) => ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][new Date(`${d}T12:00:00Z`).getUTCDay()];
  const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  console.log(`(Prüfzeit ${new Date().toISOString()}, heute ${heute})`);

  // ── Testkunden (erfunden): Person + bezahlte Bestellung + Rate 1 (bezahlt) + Rate 2 (offen, seit gestern fällig) ──
  const kunde = async (nn: string, o: { test?: boolean; antrag?: Record<string, unknown>; rate?: Record<string, unknown>; dritteIn?: number } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am)
      VALUES (${`PR-E406Z-${nn}-${stempel}`}, ${"Test"}, ${nn}, ${mailVon(nn)}, 8, ${o.test ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    const ref = `FIAON-E406Z-${nn.toUpperCase().slice(0, 10)}-${stempel}`;
    // Eine Zahlungsreferenz in der echten Form (FIAON-XXXXXX), damit Mara die Zahlungsseite der Rate holen kann.
    const zref = `FIAON-${stempel.slice(-4)}${String(lfd++).padStart(2, "0")}`;
    await sql`INSERT INTO fiaon_applications ${sql({
      ref, person_id: pid, type: "private", pack_key: "pro", pack_name: "FIAON Pro (Standard)", payment_status: "paid",
      status: "payment_completed", created_at: new Date(Date.now() - 45 * 86_400_000), paid_at: new Date(Date.now() - 40 * 86_400_000),
      first_name: "Test", last_name: nn, email: mailVon(nn), payment_reference: zref, amount_due: 59.99, freigeschaltet_am: new Date(Date.now() - 39 * 86_400_000),
      ...(o.antrag ?? {}),
    } as any)}`;
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle)
      VALUES (${ref}, 1, ${`${zref}-1`}, 5999, ${plus(-40)}::date, 'bezahlt', NOW() - INTERVAL '40 days', 'pruefstand')`;
    const [r] = (await sql`INSERT INTO fiaon_abo_raten ${sql({
      ref, rate_nr: 2, zahlungsreferenz: `${zref}-2`, betrag_cents: 5999, faellig_am: plus(-1), status: "offen", quelle: "pruefstand",
      mahnstufe: 1, erinnerungen: 2, letzte_erinnerung_at: new Date(Date.now() - 20 * 3600_000), ...(o.rate ?? {}),
    } as any)} RETURNING id`) as any[];
    let rate3: number | null = null;
    if (o.dritteIn != null) {
      const [r3] = (await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle)
        VALUES (${ref}, 3, ${`${zref}-3`}, 5999, ${plus(o.dritteIn)}::date, 'offen', 'pruefstand') RETURNING id`) as any[];
      rate3 = Number(r3.id);
    }
    return { pid, ref, rateId: Number(r.id), rate3, zref: `${zref}-2` };
  };
  const person = async (pid: number) => ((await sql`SELECT promised_payment_date::text AS zusage, follow_up_date::text AS wv FROM fiaon_persons WHERE id = ${pid}`) as any[])[0];
  const rate = async (id: number) => ((await sql`SELECT inkasso_zusage_am::text AS zusage, inkasso_wiedervorlage::text AS wv, mahnstufe, erinnerungen,
    letzte_erinnerung_at, faellig_am::text AS faellig, status, ueberfaellig_seit, vorab_am FROM fiaon_abo_raten WHERE id = ${id}`) as any[])[0];
  const verlauf = async (pid: number) => (await sql`SELECT ref, agent_name, type, note, (promised_date AT TIME ZONE 'Europe/Berlin')::date::text AS zusage
    FROM fiaon_contact_log WHERE person_id = ${pid} AND note LIKE 'Zahlungszusage per E-Mail%' ORDER BY id`) as any[];
  /** Steht seine Zusage so, wie der Fund sie verlangt (Person + Rate + Verlauf)? — dieselbe Prüfung für Rot-Probe und Fälle. */
  const steht = async (k: { pid: number; rateId: number }, datum: string) => {
    const p = await person(k.pid); const r = await rate(k.rateId); const v = await verlauf(k.pid);
    return p?.zusage === datum && r?.zusage === datum && v.some((x) => x.zusage === datum);
  };
  const B1_BETREFF = "Re: Kurz von Mara: Ihre Monatsrate vom 18.10.2026";

  console.log("── 1 · „Ich zahle am Freitag“ auf Maras Raten-Mail → festgehalten (Person, Rate, Verlauf)");
  const A = await kunde("Annazusage");
  const vorher = await rate(A.rateId);
  const erwartet = (Z.zahltagErkennen("Ich zahle am Freitag.", heute) as any).datum as string;
  const lA = await M.zahlungszusageBehandeln({ personId: A.pid, kundeText: "Hallo Mara, ich zahle am Freitag. Gruß", betreff: B1_BETREFF, quelle: "Mail #prüf" });
  ok(lA?.urteil.art === "merken" && lA.geschrieben && (lA.urteil as any).datum === erwartet, `Urteil „merken“ für ${wochentagDe(erwartet)}, ${erwartet}`, lA?.urteil);
  const pA = await person(A.pid);
  ok(pA?.zusage === erwartet, "fiaon_persons.promised_payment_date = der Freitag (vorher leer — das war der Fund)", pA);
  ok(pA?.wv === naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: erwartet }).datum, "follow_up_date = die EINE Regel (Werktag nach dem Zahltag)", pA);
  const rA = await rate(A.rateId);
  ok(rA?.zusage === erwartet && rA?.wv === Z.plusTage(erwartet, 1), "Rate 2: inkasso_zusage_am = Freitag, inkasso_wiedervorlage = Tag danach (wie das Inkasso)", rA);
  ok(rA?.mahnstufe === vorher.mahnstufe && rA?.erinnerungen === vorher.erinnerungen && String(rA?.letzte_erinnerung_at) === String(vorher.letzte_erinnerung_at)
    && rA?.faellig === vorher.faellig && rA?.status === "offen" && String(rA?.ueberfaellig_seit) === String(vorher.ueberfaellig_seit) && String(rA?.vorab_am) === String(vorher.vorab_am),
    "E-182: Mahnstufe, Zähler, letzte Erinnerung, Fälligkeit bleiben — der Mahnmotor läuft unverändert", { vorher, rA });
  const vA = await verlauf(A.pid);
  ok(vA.length === 1 && vA[0].ref === A.ref && vA[0].agent_name === Z.ZUSAGE_AGENT_NAME && vA[0].type === "system" && vA[0].zusage === erwartet
    && /zahlt Rate 2 am/.test(vA[0].note) && /„Hallo Mara, ich zahle am Freitag\.“/.test(vA[0].note), "Akte: ein Verlaufseintrag mit Zusage-Datum und seinen Worten", vA);
  ok(/FESTGEHALTEN/.test(lA?.hinweis ?? "") && (lA?.hinweis ?? "").includes(Z.zusageSatz(erwartet)), "Hinweis für Mara: festgehalten + der eine Satz");
  ok(await steht(A, erwartet), "Gesamtprüfung „steht“ grün");

  console.log("── 2 · Was danach greift (die bestehenden Wege lesen die Zusage)");
  const { FRIST_FILTER } = await import("../server/lib/fiaon-inkasso");
  const [inZusagen] = (await sql.unsafe(`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r WHERE r.id = $1 AND ${FRIST_FILTER.zusagen}`, [A.rateId])) as any[];
  ok(inZusagen?.n === 1, "Inkasso/Collections: die Rate steht unter „Zusagen offen“");
  const RE = await import("../server/lib/fiaon-mara-rate-erinnerung");
  const RS = await import("../shared/fiaon-mara-rate-erinnerung");
  const f = await RE.faktenLaden(A.rateId, heute);
  ok(f?.fakten.zusageOffen === true && RS.rateErinnerungUrteil(f!.fakten).art !== "senden", "B1: Maras Raten-Mail schreibt ihm jetzt nicht noch einmal (Zusage offen)", f?.fakten);
  const [wa] = (await sql`SELECT EXISTS (SELECT 1 FROM fiaon_persons pz WHERE pz.id = ${A.pid} AND pz.promised_payment_date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS wartet`) as any[];
  ok(wa?.wartet === true, "WhatsApp-Zentrale: die Bedingung aus RATE_ERINNERBAR („zugesagtes Zahldatum abwarten“) greift");

  console.log("── 3 · Dieselbe Mail noch einmal (KI-Pause, neu schreiben) → nichts doppelt");
  const lA2 = await M.zahlungszusageBehandeln({ personId: A.pid, kundeText: "Hallo Mara, ich zahle am Freitag. Gruß", betreff: B1_BETREFF });
  ok(lA2?.urteil.art === "merken" && (lA2.urteil as any).schon && !lA2.geschrieben && (await verlauf(A.pid)).length === 1, "zweiter Lauf: „stand schon“, kein zweiter Verlaufseintrag", lA2?.urteil);

  console.log("── 4 · Unklar, zu weit, vergangen, pünktlich → NICHTS festgehalten");
  const U = await kunde("Ulrichzusage");
  const lU = await M.zahlungszusageBehandeln({ personId: U.pid, kundeText: "Ich zahle nächste Woche.", betreff: B1_BETREFF });
  ok(lU?.urteil.art === "unklar" && !lU.geschrieben && (await person(U.pid))?.zusage == null && (await rate(U.rateId))?.zusage == null && (await verlauf(U.pid)).length === 0,
    "„nächste Woche“ → unklar, nichts geschrieben, Mara fragt nach", lU?.urteil);
  ok(/Meinen Sie \[Wochentag\], den \[TT\.MM\.\]\?/.test(lU?.hinweis ?? ""), "… Hinweis: Rückfrage mit Wochentag und Datum");
  const W = await kunde("Wilmazusage");
  const weit = plus(40);
  const lW = await M.zahlungszusageBehandeln({ personId: W.pid, kundeText: `Ich zahle am ${ddmm(weit)}${weit.slice(0, 4)}`, betreff: B1_BETREFF });
  ok(lW?.urteil.art === "zu_weit" && (await person(W.pid))?.zusage == null, "in 40 Tagen → zu weit (eine Pause, keine Zusage), nichts geschrieben", lW?.urteil);
  const V = await kunde("Veitzusage");
  const lV = await M.zahlungszusageBehandeln({ personId: V.pid, kundeText: "Ich zahle morgen.", betreff: B1_BETREFF, geschriebenAm: new Date(Date.now() - 4 * 86_400_000) });
  ok(lV?.urteil.art === "vergangen" && (await person(V.pid))?.zusage == null, "vor 4 Tagen geschrieben „morgen“ → der Tag ist vorbei, nichts geschrieben (Bezug = der Tag, an dem ER schrieb)", lV?.urteil);
  const P = await kunde("Paulzusage", { rate: { faellig_am: plus(10) } });
  const lP = await M.zahlungszusageBehandeln({ personId: P.pid, kundeText: "Ich zahle morgen.", betreff: B1_BETREFF });
  ok(lP?.urteil.art === "puenktlich" && (await person(P.pid))?.zusage == null, "Rate erst in 10 Tagen fällig, er zahlt morgen → pünktlich, nichts festzuhalten", lP?.urteil);

  console.log("── 5 · Nur geschuldete Raten (dieselben Wände wie Mahnmotor und Inkasso)");
  const T = await kunde("Testzusage", { test: true });
  const lT = await M.zahlungszusageBehandeln({ personId: T.pid, kundeText: "Ich zahle morgen.", betreff: B1_BETREFF });
  ok(lT?.urteil.art === "keine_rate" && (await person(T.pid))?.zusage == null, "Testkonto → keine Forderung, nichts geschrieben", lT?.urteil);
  const E = await kunde("Endezusage", { antrag: { gekuendigt_am: new Date(Date.now() - 20 * 86_400_000), vertrag_ende_am: new Date(Date.now() - 10 * 86_400_000), agb_stand: null } });
  const lE = await M.zahlungszusageBehandeln({ personId: E.pid, kundeText: "Ich zahle morgen.", betreff: B1_BETREFF });
  ok(lE?.urteil.art === "keine_rate" && (await rate(E.rateId))?.zusage == null, "Rate nach dem Vertragsende (Altvertrag) → nie eine Forderung, nichts geschrieben (E-394)", lE?.urteil);
  const S = await kunde("Stoppzusage", { antrag: { mahnstopp_am: new Date() } });
  const lS = await M.zahlungszusageBehandeln({ personId: S.pid, kundeText: "Ich zahle morgen.", betreff: B1_BETREFF });
  ok(lS?.urteil.art === "keine_rate" && (await person(S.pid))?.zusage == null, "Mahnstopp nach der ersten Zahlung → keine Forderung, nichts geschrieben", lS?.urteil);

  console.log("── 6 · Zwei offene Raten, eine schon stehende Wiedervorlage, „Ja“ auf Maras Rückfrage");
  const Z2 = await kunde("Zweizusage", { dritteIn: 20 });
  const lZ = await M.zahlungszusageBehandeln({ personId: Z2.pid, kundeText: "Ich überweise in 3 Tagen", betreff: B1_BETREFF });
  ok(lZ?.urteil.art === "merken" && (await rate(Z2.rateId))?.zusage === plus(3) && (await rate(Z2.rate3!))?.zusage == null, "nur die Rate, die bis dahin fällig ist (Rate 2) — Rate 3 (in 20 Tagen) bleibt", { r2: await rate(Z2.rateId), r3: await rate(Z2.rate3!) });
  const H = await kunde("Hanszusage", { rate: { inkasso_wiedervorlage: plus(14) } });
  await M.zahlungszusageBehandeln({ personId: H.pid, kundeText: "Ich zahle morgen", betreff: B1_BETREFF });
  ok((await rate(H.rateId))?.wv === plus(14) && (await rate(H.rateId))?.zusage === plus(1), "eine spätere Wiedervorlage (Härtefall/Ruhe) bleibt stehen — nie früher", await rate(H.rateId));
  const J = await kunde("Juliazusage");
  const fuenf = plus(5);
  const frage = `Sehr gern! Meinen Sie ${wochentagDe(fuenf)}, den ${ddmm(fuenf)}?`;
  const lJ = await M.zahlungszusageBehandeln({ personId: J.pid, kundeText: "Ja, genau.", letzteMara: frage, betreff: "Re: Ihre Rate" });
  ok(lJ?.erkennung.art === "tag" && (lJ.erkennung as any).quelle === "rueckfrage" && await steht(J, fuenf), `„Ja, genau.“ auf „${frage}“ → festgehalten`, lJ?.erkennung);

  console.log("── 7 · Der echte Weg durch Mail-Mara (antwortErzeugen, Modell-Attrappe)");
  const PA = await import("../server/lib/fiaon-postmeister-agent");
  const flags = { kuendigung: false, bestreitet: false, widerruf: false, beschwerde: false, rechtlich: false, stopp: false, zahlung_behauptet: false, rueckruf_wunsch: false, droht_anwalt: false, zahlungsunfaehig: false, auskunft_fehlt: false };
  const einordnung = { kategorien: ["zahlung"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Kunde nennt seinen Zahltag.", flags } as any;
  const G = await kunde("Gretazusage");
  ANTWORT = `Ihre Monatsrate über 59,99 € mit dem Verwendungszweck ${G.zref} ist noch offen. ${Z.zusageSatz(erwartet)} Über den Knopf unten ist Ihre Zahlungsseite für diesen Tag schon bereit.\nHerzliche Grüße`;
  const rufeVorher = modellRufe;
  const eG = await PA.antwortErzeugen({
    postfach: "welcome@fiaon.com", mail: { betreff: B1_BETREFF, text: "Hallo Mara,\nich zahle am Freitag.\nViele Grüße", von: mailVon("Gretazusage"), alterTage: 0, am: new Date() },
    verlauf: [], einordnung, personId: G.pid, ref: G.ref, postmeisterId: null,
  }).catch((e: any) => ({ ok: false, grund: String(e?.message || e) }) as any);
  const hG = (eG.handlungen ?? []).find((h: any) => h.werkzeug === Z.ZUSAGE_WERKZEUG);
  ok(hG?.ok === true && /festgehalten/.test(hG.ergebnis), "Mail-Mara: Handlung zahlungszusage_merken „festgehalten“", { grund: eG.grund, handlungen: eG.handlungen });
  ok(await steht(G, erwartet), "… und in der Datenbank: Person, Rate und Verlauf tragen den Freitag", { p: await person(G.pid), r: await rate(G.rateId) });
  ok(modellRufe > rufeVorher && AUFTRAEGE.slice(rufeVorher).some((a) => a.includes("ZAHLTAG (zahlungszusage_merken ist gelaufen") && a.includes("FESTGEHALTEN")), "Maras Auftrag enthielt den Hinweis „ZAHLTAG … FESTGEHALTEN“ (vor dem Schreiben)");
  ok(eG.ok && (eG.pruefung?.fehlend ?? []).length === 0 && eG.automatischErlaubt === true, "die Antwort mit dem Satz geht sauber durch (keine Mängel, Automat erlaubt)", { pruefung: eG.pruefung, grund: eG.grund });
  ok(eG.naechsterSchritt?.art === "zahlung" && String(eG.naechsterSchritt?.url ?? "").endsWith(`/zahlung/${G.zref}`), "der Knopf bleibt die Zahlungsseite DIESER Rate (für seinen Tag)", eG.naechsterSchritt);

  console.log("── 8 · Rot-Proben (der Prüfstand sieht den Fehler)");
  const O = await kunde("Ottozusage");
  ok(!(await steht(O, erwartet)), "Rot-Probe: ohne den Zahltag-Schritt (Stand B1) bleibt promised_payment_date leer — „steht“ ist rot");
  const K = await kunde("Karlzusage");
  ANTWORT = `Ihre Monatsrate über 59,99 € mit dem Verwendungszweck ${K.zref} ist noch offen. Danke, ich habe mir den Freitag als Ihren Zahltag notiert.\nHerzliche Grüße`;
  const eK = await PA.antwortErzeugen({
    postfach: "welcome@fiaon.com", mail: { betreff: B1_BETREFF, text: "Ich zahle nächste Woche.", von: mailVon("Karlzusage"), alterTage: 0, am: new Date() },
    verlauf: [], einordnung, personId: K.pid, ref: K.ref, postmeisterId: null,
  }).catch((e: any) => ({ ok: false, grund: String(e?.message || e) }) as any);
  ok((eK.pruefung?.fehlend ?? []).some((x: string) => /sein Zahltag sei notiert/.test(x)) && eK.automatischErlaubt === false,
    "Rot-Probe Antwort: Mara behauptet „notiert“, der Server hielt nichts fest → Mangel, nicht automatisch senden", { fehlend: eK.pruefung?.fehlend, auto: eK.automatischErlaubt, grund: eK.grund });
  ok((await person(K.pid))?.zusage == null, "… und in der Datenbank steht für ihn nichts");

  ok(FREMD.length === 0, `kein Netzzugriff außer der Modell-Attrappe (${FREMD.length})`, FREMD.slice(0, 3));
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
