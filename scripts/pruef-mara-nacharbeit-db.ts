// Prüfstand E-406 C2 (19.10.2026), Datenbank-Teil: Nacharbeit nach dem Anruf — ein Klick, Mara macht den Rest.
// Mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank. Kein Netz: Brevo ist eine Attrappe (fetch abgefangen),
// das Modell ist eine Attrappe (KiSchreiber), alles andere außer localhost ist gesperrt. Bricht ab, wenn
// DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e406c2?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-mara-nacharbeit-db.ts
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import (Muster: pruef-mara-nicht-erreicht-db.ts) ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
const BREVO: { an: string; betreff: string; html: string; text: string; tags: string[] }[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    BREVO.push({ an: String(b.to?.[0]?.email ?? "").toLowerCase(), betreff: String(b.subject ?? ""), html: String(b.htmlContent ?? ""), text: String(b.textContent ?? ""), tags: b.tags ?? [] });
    return new Response(JSON.stringify({ messageId: `<e406c2-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
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
  const N = await import("../server/lib/fiaon-mara-nacharbeit");
  const R = await import("../shared/fiaon-mara-nacharbeit");
  const NE = await import("../shared/fiaon-nicht-erreicht-nachfass");
  const { KiPausiertFehler } = await import("../server/lib/fiaon-ki-pause");

  await N.nacharbeitTabelle();
  await N.schalterSetzen(true);
  const stempel = Date.now().toString(36).toUpperCase();
  const mailVon = (nn: string) => `${nn.toLowerCase()}-${stempel.toLowerCase()}@e406c2.invalid`;
  const AGENT = 8; // Daniel Stripling, Anrede Herr (Vorlage-Datenbank) — Nennform „Herr Stripling“
  let zaehler = 0;

  // ── Testpersonen (erfunden) ─────────────────────────────────────────────
  const person = async (vn: string, nn: string, o: {
    test?: boolean; mail?: boolean; blockiert?: boolean; werbesperre?: boolean; antrag?: Record<string, unknown> | null;
  } = {}) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, assigned_agent_id, ist_test_am, is_blocked, werbung_gesperrt_am)
      VALUES (${`PR-E406C2-${nn}-${stempel}`}, ${vn}, ${nn}, ${o.mail === false ? null : mailVon(nn)}, ${AGENT},
              ${o.test ? new Date() : null}, ${!!o.blockiert}, ${o.werbesperre ? new Date() : null}) RETURNING id`) as any[];
    const pid = Number(p.id);
    let ref: string | null = null;
    let zweck: string | null = null;
    if (o.antrag !== null) {
      ref = `FIAON-E406C-${nn.toUpperCase().slice(0, 8)}-${stempel}`;
      zaehler++;
      zweck = `FIAON-${zaehler.toString(36).toUpperCase().padStart(3, "Q")}${stempel.slice(-3)}`.slice(0, 12);
      await sql`INSERT INTO fiaon_applications ${sql({
        ref, person_id: pid, type: "private", pack_key: "pro", pack_name: "FIAON Pro (Standard)", payment_status: "pending_payment",
        status: "approved", current_step: 8, submitted_at: new Date(Date.now() - 2 * 86_400_000), amount_due: 59.99,
        created_at: new Date(Date.now() - 3 * 86_400_000), first_name: vn, last_name: nn, email: o.mail === false ? null : mailVon(nn),
        payment_reference: zweck,
        ...(o.antrag ?? {}),
      } as any)}`;
    }
    return { pid, ref, zweck, nn };
  };
  type P = Awaited<ReturnType<typeof person>>;
  const jetzt = new Date();
  // Ein Takt-Zeitpunkt sicher im Fenster und nach der Wartezeit: jetzt + 4 Min. (wenn offen), sonst das nächste 08:00 (+5 Min.).
  const taktZeit = () => {
    const n = new Date(Date.now() + 4 * 60_000);
    return NE.imVersandfenster(n) && NE.imVersandfenster(new Date(n.getTime() + 60_000)) ? n : new Date(NE.naechstesFenster(new Date(n.getTime() + 60_000)).getTime() + 5 * 60_000);
  };
  const tagPlus = (n: number) => R.berlinTag(new Date(Date.now() + n * 86_400_000));
  const merker = async (pid: number) => (await sql`SELECT * FROM fiaon_mara_nacharbeit WHERE person_id = ${pid} ORDER BY id`) as any[];
  const letzter = async (pid: number) => (await merker(pid)).slice(-1)[0] ?? null;
  const anBrevo = (nn: string) => BREVO.filter((m) => m.an === mailVon(nn));
  const vermerke = async (p: P, muster: string) => (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${p.ref} AND note LIKE ${muster} ORDER BY id`) as any[];
  const akteur = { id: AGENT, name: "Daniel Stripling" };
  const nach = (p: P, ergebnis: string, z: Partial<import("../server/lib/fiaon-mara-nacharbeit").NacharbeitEingabe> = {}, wann?: Date) =>
    N.nacharbeitNachErgebnis({ personId: p.pid, ref: p.ref, ergebnis, notiz: null, akteur, gewaehlt: true, ...z }, wann ?? new Date());

  // Das Modell als Attrappe: je Person eine Folge von Antworten.
  const KI_ANTWORT = new Map<number, any[]>();
  const KI_AUFRUFE: { pid: number; nachrichten: any[] }[] = [];
  const ki: import("../server/lib/fiaon-mara-nacharbeit").KiSchreiber = async (nachrichten, pid) => {
    KI_AUFRUFE.push({ pid, nachrichten });
    const folge = KI_ANTWORT.get(pid) ?? [];
    const a = folge.shift();
    if (a instanceof Error) throw a;
    return { roh: a ?? { senden: false, grund: "keine Antwort im Prüfstand", absaetze: [] }, kostenCents: 2 };
  };
  const takt = (j: Date = taktZeit()) => N.nacharbeitTakt({ jetzt: j, ki });

  console.log(`(Prüfzeit ${jetzt.toISOString()}, ${NE.imVersandfenster(jetzt) ? "im" : "außerhalb des"} Versandfensters; Takt um ${taktZeit().toISOString()})`);

  console.log("── 1 · Zahlt am …: vormerken → Takt → EINE Mail mit Betrag, Tag, Verwendungszweck und Zahlungsseite");
  const Z = await person("Zora", "Zusageprobe");
  const wZ = await nach(Z, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  ok(wZ.art === "zusage" && (wZ.urteil?.art === "warten"), "Urteil: wartet (Zeit zum Berichtigen bzw. Fenster)", wZ);
  ok(/Mara schickt dem Kunden .*Zusammenfassung \(Zahlungszusage\)/.test(wZ.hinweis ?? ""), "Satz an den Mitarbeiter", wZ.hinweis);
  ok((await letzter(Z.pid))?.status === "vorgemerkt" && anBrevo("Zusageprobe").length === 0, "vorgemerkt — im Klick geht nichts raus");
  const t1 = await takt();
  const brZ = anBrevo("Zusageprobe");
  ok((await letzter(Z.pid))?.status === "versandt" && t1.versandt >= 1, "Takt: versandt", { m: await letzter(Z.pid), t1 });
  ok(brZ.length === 1 && brZ[0].tags.includes("mara_nacharbeit"), "genau EINE Mail (Ereignis mara_nacharbeit)", brZ.map((b) => b.betreff));
  ok(/59,99 €/.test(brZ[0]?.betreff ?? "") && new RegExp(`/zahlung/${Z.zweck}"`).test(brZ[0]?.html ?? ""), "Betreff mit Betrag, Knopf auf SEINE Zahlungsseite", brZ[0]?.betreff);
  ok(brZ[0]?.html.includes(Z.zweck!) && /bis [A-Z][a-z]+, \d{1,2}\. [A-Z]/.test(brZ[0]?.text ?? ""), "Verwendungszweck und „bis <Tag>“ im Text", brZ[0]?.text?.slice(0, 400));
  ok(/Herrn Stripling/.test(brZ[0]?.html ?? "") && !/\bDaniel\b/.test(brZ[0]?.html ?? ""), "Nennform „Herrn Stripling“, nie der Vorname");
  ok(!/IBAN|BIC/.test(brZ[0]?.text?.split("—")[0] ?? ""), "keine Bankdaten im Text");
  const logZ = (await sql`SELECT status FROM fiaon_mail_log WHERE person_id = ${Z.pid} AND event = 'mara_nacharbeit'`) as any[];
  ok(logZ.length === 1 && logZ[0].status === "versandt", "Zustellprotokoll: eine Zeile „versandt“");
  ok((await vermerke(Z, "Mara: Zahlungszusage nach dem Gespräch mit Herrn Stripling%")).length === 1, "Akte: Vermerk „Mara: Zahlungszusage … bestätigt“");

  console.log("── 2 · Nie doppelt");
  await takt();
  ok(anBrevo("Zusageprobe").length === 1, "zweiter Takt: keine zweite Mail");
  const wZ2 = await nach(Z, "erreicht_sonstiges", { notiz: "Möchte sich noch bis Freitag überlegen." });
  ok(wZ2.urteil?.art === "auslassen" && /schon eine Zusammenfassung/.test((wZ2.urteil as any).grund), `binnen ${R.DOPPELT_STUNDEN} h: ausgelassen`, wZ2);
  await takt();
  ok(anBrevo("Zusageprobe").length === 1, "weiter genau eine Mail");
  // Ein neueres Ergebnis MIT Häkchen ersetzt die wartende Mail — nie zwei wartende.
  const E = await person("Erik", "Ersatzprobe");
  await nach(E, "erreicht_zahlt_am", { zusageDatum: tagPlus(3) });
  const wE2 = await nach(E, "erreicht_zahlt_am", { zusageDatum: tagPlus(4) });
  const mE = await merker(E.pid);
  ok(mE.length === 2 && mE[0].status === "ersetzt" && mE[1].status === "vorgemerkt" && wE2.ersetzt === true, "neueres Ergebnis ersetzt die wartende (ersetzt + vorgemerkt)", mE.map((x: any) => x.status));
  let doppeltFehler = "";
  await sql`INSERT INTO fiaon_mara_nacharbeit (person_id, art, ergebnis, status) VALUES (${E.pid}, 'zusage', 'erreicht_zahlt_am', 'vorgemerkt')`.catch((e: any) => { doppeltFehler = e.message; });
  ok(/unique|eindeutig|duplicate/i.test(doppeltFehler), "die Datenbank lässt keinen zweiten wartenden Merker zu", doppeltFehler);
  await takt();
  const brE = anBrevo("Ersatzprobe");
  ok(brE.length === 1, "nur EINE Mail (die neuere Zusage)", brE.length);

  console.log("── 3 · Berichtigen: ein anderes Ergebnis ohne Häkchen nimmt die wartende Mail zurück");
  const K = await person("Karl", "Korrekturprobe");
  await nach(K, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  const wK = await nach(K, "nicht_erreicht", { gewaehlt: false });
  ok(wK.ersetzt === true && (await letzter(K.pid))?.status === "zurueckgenommen", "„Nicht erreicht“ gleich danach → zurückgenommen", await letzter(K.pid));
  const K2 = await person("Kira", "Doppelbuchprobe");
  await nach(K2, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  await nach(K2, "erreicht_zahlt_am", { gewaehlt: false });
  ok((await letzter(K2.pid))?.status === "vorgemerkt", "DASSELBE Ergebnis ohne Häkchen (Telefon + Akte) → die Mail bleibt");
  // Ein neueres Ergebnis MIT Häkchen, nach dem nichts rausgeht (heikle Notiz), ersetzt die wartende trotzdem.
  const K3 = await person("Kai", "Heikelersatzprobe");
  await nach(K3, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  const wK3 = await nach(K3, "erreicht_sonstiges", { notiz: "Will kündigen und hat sich beschwert." });
  const mK3 = await merker(K3.pid);
  ok(wK3.ersetzt === true && mK3[0].status === "ersetzt" && mK3[1].status === "ausgelassen", "neueres Ergebnis mit Häkchen, aber heikel → die wartende ist ersetzt, nichts wartet mehr", mK3.map((x: any) => `${x.status}:${x.grund}`));
  // „Nicht erreicht“ MIT Häkchen (direkter Aufruf) merkt nichts vor, berichtigt aber wie ohne.
  const K4 = await person("Kurt", "Direktaufrufprobe");
  await nach(K4, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  const wK4 = await nach(K4, "nicht_erreicht", { gewaehlt: true });
  ok(wK4.ersetzt === true && (await merker(K4.pid)).length === 1 && (await letzter(K4.pid))?.status === "zurueckgenommen", "„Nicht erreicht“ mit Häkchen → kein Merker, die wartende ist zurückgenommen");
  await takt();
  ok(anBrevo("Korrekturprobe").length === 0 && anBrevo("Doppelbuchprobe").length === 1 && anBrevo("Heikelersatzprobe").length === 0 && anBrevo("Direktaufrufprobe").length === 0,
    "Takt: Zurückgenommenes und Ersetztes nicht, das andere einmal");

  console.log("── 4 · Rückruf vereinbart → Bestätigung mit Tag, Uhrzeit, wer anruft");
  const T = await person("Tina", "Rueckrufprobe");
  const wann = `${tagPlus(2)}T14:00:00`;
  const { parseBerlinInput } = await import("../server/lib/fiaon-time");
  await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, scheduled_at, created_at) VALUES (${T.ref}, ${AGENT}, 'Daniel Stripling', 'result', 'rueckruf_termin', ${parseBerlinInput(wann)}, NOW())`;
  const wT = await nach(T, "rueckruf_termin", { terminZeitpunkt: wann });
  ok(wT.art === "termin" && wT.urteil?.art === "warten", "vorgemerkt", wT);
  await takt();
  const brT = anBrevo("Rueckrufprobe");
  ok(brT.length === 1 && /Ihr Rückruf: .*14 Uhr/.test(brT[0].betreff), "Mail „Ihr Rückruf: …, 14 Uhr“", brT.map((b) => b.betreff));
  ok(/ruft <b>Herr Stripling<\/b> Sie/.test(brT[0]?.html ?? ""), "wer anruft — in der Nennform");
  ok((await vermerke(T, "Mara: Rückruf %bestätigt.")).length === 1, "Akte: Vermerk „Mara: Rückruf … bestätigt“");
  const T2 = await person("Till", "Verworfenprobe");
  const wann2 = `${tagPlus(3)}T10:30:00`;
  await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, scheduled_at, created_at, voided_at) VALUES (${T2.ref}, ${AGENT}, 'Daniel Stripling', 'result', 'rueckruf_termin', ${parseBerlinInput(wann2)}, NOW(), NOW())`;
  await nach(T2, "rueckruf_termin", { terminZeitpunkt: wann2 });
  await takt();
  ok(anBrevo("Verworfenprobe").length === 0, "verworfener Rückruf → keine Mail", await letzter(T2.pid));

  console.log("── 5 · Erreicht – Sonstiges → Maras Zusammenfassung, vom Server geprüft");
  const G = await person("Greta", "Gespraechprobe");
  KI_ANTWORT.set(G.pid, [{ senden: true, grund: "", absaetze: ["Sie möchten sich bis Freitag überlegen, ob Sie mit FIAON starten.", "Ihre Fragen zum Ablauf haben wir am Telefon geklärt."] }]);
  await nach(G, "erreicht_sonstiges", { notiz: "Kunde möchte sich bis Freitag überlegen, Fragen zum Ablauf geklärt." });
  await takt();
  const brG = anBrevo("Gespraechprobe");
  ok(brG.length === 1 && /kurz zusammengefasst/.test(brG[0].betreff) && /bis Freitag überlegen/.test(brG[0].html), "eine Mail mit Maras Sätzen", brG.map((b) => b.betreff));
  const aufrufG = KI_AUFRUFE.find((a) => a.pid === G.pid);
  ok(!!aufrufG && /<<<[\s\S]*bis Freitag überlegen[\s\S]*>>>/.test(aufrufG.nachrichten[1].content) && /Herr Stripling/.test(aufrufG.nachrichten[1].content), "Mara bekam die Notiz eingerahmt und die Nennform");
  ok((await vermerke(G, "Mara: kurze Zusammenfassung des Gesprächs mit Herrn Stripling verschickt: „Sie möchten%")).length === 1, "Akte: Vermerk mit dem geschickten Text");
  const G2 = await person("Gerd", "Zweitentwurfprobe");
  KI_ANTWORT.set(G2.pid, [
    { senden: true, grund: "", absaetze: ["Daniel meldet sich bei Ihnen, Ihr Kredit ist sofort verfügbar."] },
    { senden: true, grund: "", absaetze: ["Sie möchten die Unterlagen in Ruhe lesen und sich dann entscheiden."] },
  ]);
  await nach(G2, "erreicht_sonstiges", { notiz: "Will die Unterlagen in Ruhe lesen und sich dann entscheiden." });
  await takt();
  const brG2 = anBrevo("Zweitentwurfprobe");
  ok(brG2.length === 1 && /in Ruhe lesen/.test(brG2[0].html) && !/Daniel|Kredit/.test(brG2[0].html), "erster Text mit Mängeln → Mara schreibt EINMAL neu → der saubere geht raus", brG2.map((b) => b.html.length));
  ok(KI_AUFRUFE.filter((a) => a.pid === G2.pid).length === 2 && /Mängel/.test(KI_AUFRUFE.filter((a) => a.pid === G2.pid)[1].nachrichten.slice(-1)[0].content), "der zweite Aufruf nennt die Mängel");
  const G3 = await person("Gina", "Schlechtprobe");
  KI_ANTWORT.set(G3.pid, [
    { senden: true, grund: "", absaetze: ["Über den Rahmen entscheidet unsere Partnerbank, wir garantieren nichts."] },
    { senden: true, grund: "", absaetze: ["Wir melden uns innerhalb von 3 Tagen bei Ihnen."] },
  ]);
  await nach(G3, "erreicht_sonstiges", { notiz: "Fragt nach dem Ablauf." });
  await takt();
  const mG3 = await letzter(G3.pid);
  ok(anBrevo("Schlechtprobe").length === 0 && mG3?.status === "ausgelassen" && /^Prüfung:/.test(mG3?.grund ?? ""), "auch der zweite Text hält nicht → nichts geht raus", mG3);
  ok((await vermerke(G3, "Mara hat nach dem Gespräch keine Zusammenfassung geschickt%")).length === 1, "Akte: Vermerk, warum nicht");
  const G4 = await person("Gustav", "Nichtsprobe");
  KI_ANTWORT.set(G4.pid, [{ senden: false, grund: "nur interner Vermerk", absaetze: [] }]);
  await nach(G4, "erreicht_sonstiges", { notiz: "Akte geprüft, Daten ergänzt." });
  await takt();
  ok(anBrevo("Nichtsprobe").length === 0 && /nichts zu schreiben/.test((await letzter(G4.pid))?.grund ?? ""), "Mara: nichts für den Kunden → nichts geschickt", await letzter(G4.pid));
  const G5 = await person("Gabi", "Pauseprobe");
  KI_ANTWORT.set(G5.pid, [new KiPausiertFehler("Prüfstand: KI-Pause")]);
  await nach(G5, "erreicht_sonstiges", { notiz: "Möchte am Freitag starten." });
  const tP = await takt();
  const mG5 = await letzter(G5.pid);
  ok(anBrevo("Pauseprobe").length === 0 && mG5?.status === "vorgemerkt" && /KI-Pause/.test(mG5?.grund ?? "") && tP.wartet >= 1, "KI-Pause → wartet (30 Min.), nichts verloren", mG5);

  console.log("── 6 · Unterlagen versprochen → die bestehende Bitte mit dem Upload-Link ohne Anmeldung");
  const Uu = await person("Uwe", "Unterlagenprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 5 * 86_400_000) } });
  const wU = await nach(Uu, "erreicht_sonstiges", { notiz: "Kunde schickt die Kontoauszüge bis Freitag." });
  ok(wU.art === "unterlagen" && (await letzter(Uu.pid))?.unterlagen?.[0] === "kontoauszug", "Art Upload-Link, Unterlage: Kontoauszüge", { wU, m: await letzter(Uu.pid) });
  await takt();
  const brU = anBrevo("Unterlagenprobe");
  ok(brU.length === 1 && brU[0].tags.includes("documents_change_request") && /\/unterlagen\/\d+\.\d+\./.test(brU[0].html), "Mail „Unterlagen“ mit Upload-Link ohne Anmeldung", brU.map((b) => `${b.betreff} ${b.tags}`));
  ok(/Wie im Gespräch mit Herrn Stripling besprochen/.test(brU[0]?.html ?? ""), "mit dem Satz zum Gespräch (Nennform)");
  ok((await letzter(Uu.pid))?.status === "versandt", "Merker versandt");
  const anf = (await sql`SELECT quelle FROM fiaon_unterlagen_anfragen WHERE person_id = ${Uu.pid}`) as any[];
  ok(anf.length === 1 && anf[0].quelle === "mara_nacharbeit", "Protokoll der Anfrage: Quelle mara_nacharbeit");

  console.log("── 7 · Wer NIE eine Mail bekommt (Merker „ausgelassen“ mit Grund)");
  const fall = async (name: string, nn: string, o: Parameters<typeof person>[2], grund: RegExp, vor?: (p: P) => Promise<void>, ergebnis = "erreicht_zahlt_am", notiz: string | null = null) => {
    const p = await person("Test", nn, o);
    if (vor) await vor(p);
    const w = await nach(p, ergebnis, { zusageDatum: tagPlus(2), notiz });
    const m = await letzter(p.pid);
    ok(m?.status === "ausgelassen" && grund.test(String(m?.grund ?? "")) && /keine Mail/.test(w.hinweis ?? ""), `${name} → ausgelassen (${m?.grund ?? "—"})`, { w, m });
    return p;
  };
  const negativ: P[] = [];
  negativ.push(await fall("Werbesperre", "Werbesperreprobe", { werbesperre: true }, /Werbesperre/));
  negativ.push(await fall("Vertriebssperre (is_blocked)", "Sperrprobe", { blockiert: true }, /Vertriebssperre/));
  negativ.push(await fall("Testkonto", "Testkontoprobe", { test: true }, /Testkonto/));
  negativ.push(await fall("Kunde von FIAON Global", "Globalprobe", { antrag: { pack_key: "global_struktur", pack_name: "FIAON Global Struktur" } }, /FIAON Global/));
  negativ.push(await fall("gekündigt", "Gekuendigtprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 40 * 86_400_000), gekuendigt_am: new Date(Date.now() - 2 * 86_400_000) } }, /gekündigt/));
  negativ.push(await fall("Kündigung eingegangen, nicht gebucht", "Kuendantragprobe", { antrag: { payment_status: "paid", status: "payment_completed", paid_at: new Date(Date.now() - 20 * 86_400_000) } }, /Kündigung eingegangen/,
    async (p) => { await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status) VALUES (${p.ref}, 'Test', 'Kuendantragprobe', ${mailVon("Kuendantragprobe")}, 'Prüfstand E-406 C2', 'pending')`; }));
  negativ.push(await fall("keine E-Mail-Adresse", "Ohnemailprobe", { mail: false }, /keine E-Mail-Adresse/));
  negativ.push(await fall("heikle Notiz (Beschwerde)", "Heikelprobe", {}, /Beschwerde/, undefined, "erreicht_sonstiges", "Hat sich über die KI beschwert, will Rückruf."));
  negativ.push(await fall("offener Auftrag „Beschwerde“", "Auftragprobe", {}, /offener Auftrag/, async (p) => {
    const { ensureAuftragSpalten } = await import("../server/lib/fiaon-auftraege");
    await ensureAuftragSpalten();
    await sql`INSERT INTO fiaon_betreiber_todos ${sql({ titel: "Beschwerde prüfen", text: "Prüfstand E-406 C2", status: "offen", zustaendig_art: "agent", zustaendig_agent_id: AGENT, person_id: p.pid, art: "beschwerde", schluessel: `e406c2-${p.pid}` } as any)}`;
  }));
  negativ.push(await fall("Zahlung schon gemeldet", "Gemeldetprobe", { antrag: { payment_status: "claimed_paid" } }, /gemeldet/));
  negativ.push(await fall("keine offene Zahlung (Lead ohne Antrag)", "Ohnezahlungprobe", { antrag: null }, /keine offene Zahlung/));
  await takt();
  const negMails = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'mara_nacharbeit' AND status = 'versandt' AND person_id = ANY(${negativ.map((x) => x.pid)})`) as any[];
  ok(Number(negMails[0].n) === 0 && negativ.every((p) => anBrevo(p.nn).length === 0), "keiner von ihnen bekommt eine Mail (auch nicht durch den Takt)", { n: negMails[0].n, brevo: negativ.filter((p) => anBrevo(p.nn).length).map((p) => p.nn) });
  const nG = await person("Nina", "Nichterreichtprobe");
  const wN = await nach(nG, "nicht_erreicht");
  ok(!wN.art && !wN.urteil && (await merker(nG.pid)).length === 0, "„Nicht erreicht“ → kein Merker (dafür ist E-401 da)");

  console.log("── 8 · Zwischendurch bezahlt oder gesperrt → der Takt sendet nicht mehr");
  const Bz = await person("Bea", "Bezahltprobe");
  await nach(Bz, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  await sql`UPDATE fiaon_applications SET payment_status = 'paid', paid_at = NOW() WHERE ref = ${Bz.ref}`;
  await takt();
  ok(anBrevo("Bezahltprobe").length === 0 && (await letzter(Bz.pid))?.status === "erledigt", "bezahlt → erledigt, keine Mail", await letzter(Bz.pid));
  const Sp = await person("Sepp", "Spaetsperrprobe");
  await nach(Sp, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  await sql`UPDATE fiaon_persons SET werbung_gesperrt_am = NOW() WHERE id = ${Sp.pid}`;
  await takt();
  ok(anBrevo("Spaetsperrprobe").length === 0 && (await letzter(Sp.pid))?.status === "ausgelassen", "inzwischen Werbesperre → ausgelassen", await letzter(Sp.pid));

  console.log("── 9 · Versandfenster: 21:30 vorgemerkt → wartet bis 08:00");
  const F = await person("Frida", "Fensterprobe");
  const heute = R.berlinTag(new Date());
  const abends = ["+02:00", "+01:00"].map((v) => new Date(`${heute}T21:30:00${v}`)).find((d) => NE.berlinMinuten(d) === 21 * 60 + 30)!;
  const morgen8 = NE.naechstesFenster(abends);
  const wF = await nach(F, "erreicht_zahlt_am", { zusageDatum: tagPlus(3) }, abends);
  ok(wF.urteil?.art === "warten" && (wF.urteil as any).nichtVor.getTime() === morgen8.getTime(), "21:30 → warten bis morgen 08:00", wF.urteil);
  ok(/morgen 08:00 Uhr/.test(wF.hinweis ?? ""), "Satz „morgen 08:00 Uhr“", wF.hinweis);
  await takt(new Date(abends.getTime() + 15 * 60_000));
  ok(anBrevo("Fensterprobe").length === 0 && (await letzter(F.pid))?.status === "vorgemerkt", "Takt um 21:45: nichts (Fenster zu)");
  await takt(new Date(morgen8.getTime() - 60_000));
  ok(anBrevo("Fensterprobe").length === 0, "Takt um 07:59: nichts");
  await takt(new Date(morgen8.getTime() + 5 * 60_000));
  ok(anBrevo("Fensterprobe").length === 1 && (await letzter(F.pid))?.status === "versandt", "Takt um 08:05: gesendet");

  console.log("── 10 · Die Vorschau-Daten fürs Häkchen");
  const VZ = await person("Vali", "Vorschauprobe");
  const vd = await N.vorschauDaten(VZ.pid);
  ok(vd.an && !vd.sperrGrund && vd.betrag === "59,99 €" && !vd.zahlungGrund, "offene Zahlung → „59,99 €“", vd);
  // Mittags gerechnet (die Uhr der Vorschau zählt seit der Nachbesserung: abends kein „Zahlt sofort“) — zeitunabhängig.
  const vs = R.nacharbeitVorschau(vd, { ergebnis: "erreicht_zahlt_gleich", heute: R.berlinTag(new Date()), jetzt: new Date(`${R.berlinTag(new Date())}T10:00:00Z`) });
  ok(vs.moeglich && vs.zeile === "59,99 € heute + Zahlungsseite", `Zeile: „${vs.zeile}“`);
  const vdM = await N.vorschauDaten(negativ[6].pid);
  ok(/keine E-Mail-Adresse/.test(vdM.sperrGrund ?? ""), "ohne Adresse → Grund statt Häkchen", vdM);
  const vdG = await N.vorschauDaten(negativ[3].pid);
  ok(/FIAON Global/.test(vdG.sperrGrund ?? ""), "Global → Grund statt Häkchen", vdG);
  const vdC = await N.vorschauDaten(negativ[9].pid);
  ok(!vdC.betrag && /gemeldet/.test(vdC.zahlungGrund ?? ""), "Zahlung gemeldet → keine Zusage-Zeile", vdC);

  console.log("── 11 · Schalter aus, Hängengebliebenes, Verfall");
  await N.schalterSetzen(false);
  const S = await person("Sven", "Schalterprobe");
  const wS = await nach(S, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  ok(!wS.urteil && (await merker(S.pid)).length === 0, "Schalter aus: nichts vorgemerkt", wS);
  ok((await N.vorschauDaten(S.pid)).an === false, "Schalter aus: kein Häkchen in der Vorschau");
  const tAus = await takt();
  ok(tAus.aus === true, "Takt: aus");
  await N.schalterSetzen(true);
  const H = await person("Hugo", "Haengeprobe");
  await sql`INSERT INTO fiaon_mara_nacharbeit (person_id, art, ergebnis, status, vorgemerkt_am, bearbeitet_am) VALUES (${H.pid}, 'gespraech', 'erreicht_sonstiges', 'in_arbeit', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '40 minutes')`;
  const Vf = await person("Vera", "Verfallprobe");
  await sql`INSERT INTO fiaon_mara_nacharbeit (person_id, art, ergebnis, status, vorgemerkt_am, nicht_vor) VALUES (${Vf.pid}, 'gespraech', 'erreicht_sonstiges', 'vorgemerkt', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '1 hour')`;
  await N.nacharbeitTakt({ jetzt: new Date(), ki });
  ok((await letzter(H.pid))?.status === "unklar" && anBrevo("Haengeprobe").length === 0, "hängengeblieben → „unklar“, nie neu gesendet");
  ok((await letzter(Vf.pid))?.status === "verfallen" && anBrevo("Verfallprobe").length === 0, "zu lange gewartet → „verfallen“");

  console.log("── 12 · Der Stand fürs Chefbüro");
  const st = await N.nacharbeitStand();
  ok(st.an && st.eingerichtet && st.woche.versandt >= 6 && st.jeArt.zusage >= 3 && st.jeArt.termin >= 1 && st.jeArt.gespraech >= 2 && st.jeArt.unterlagen >= 1, "Zahlen je Art", st);
  ok(st.gruende.length > 0 && st.kostenCents > 0, "Gründe fürs Auslassen und KI-Kosten", { g: st.gruende, k: st.kostenCents });

  console.log("── 13 · Nachbesserung (Prüfer-Fund 19.10.2026): abends nie „morgen 08:00“ versprechen, Rückgängig nimmt wirklich zurück");
  const um2030 = ["+02:00", "+01:00"].map((v) => new Date(`${heute}T20:30:00${v}`)).find((d) => NE.berlinMinuten(d) === 20 * 60 + 30)!;
  // a) „Zahlt sofort“ um 20:30 → sofort ausgelassen, mit ehrlichem Satz (vorher: „morgen 08:00 Uhr …“, am Morgen still nichts).
  const A1 = await person("Anton", "Spaetzusageprobe");
  const wA1 = await nach(A1, "erreicht_zahlt_gleich", {}, um2030);
  ok(wA1.urteil?.art === "auslassen" && (wA1.urteil as any).grund === R.GRUND.zusageNachFenster, "„Zahlt sofort“ um 20:30 → ausgelassen (morgen früh wäre der Tag vorbei)", wA1);
  ok(/^Mara schickt keine Mail: sie schreibt erst ab 8 Uhr wieder/.test(wA1.hinweis ?? "") && !/morgen 08:00/.test(wA1.hinweis ?? ""), `Satz ohne leeres Versprechen: „${wA1.hinweis}“`);
  ok((await letzter(A1.pid))?.status === "ausgelassen", "Merker „ausgelassen“ (nichts wartet bis morgen)");
  const A2 = await person("Alma", "Morgenzusageprobe");
  const wA2 = await nach(A2, "erreicht_zahlt_am", { zusageDatum: tagPlus(1) }, um2030);
  ok(wA2.urteil?.art === "warten" && /08:00 Uhr/.test(wA2.hinweis ?? ""), "„Zahlt am <morgen>“ um 20:30 → wartet bis 08:00 (der Tag ist dann offen)", wA2);
  // b) Rückruf morgen 08:30, gebucht 20:30 → ausgelassen; morgen 11:00 → wartet.
  const A3 = await person("Arne", "Fruehrueckrufprobe");
  const frueh830 = `${tagPlus(1)}T08:30:00`;
  await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, scheduled_at, created_at) VALUES (${A3.ref}, ${AGENT}, 'Daniel Stripling', 'result', 'rueckruf_termin', ${parseBerlinInput(frueh830)}, NOW())`;
  const wA3 = await nach(A3, "rueckruf_termin", { terminZeitpunkt: frueh830 }, um2030);
  ok(wA3.urteil?.art === "auslassen" && (wA3.urteil as any).grund === R.GRUND.terminNachFenster && /keine Mail/.test(wA3.hinweis ?? ""), "Rückruf morgen 08:30, gebucht 20:30 → ausgelassen", wA3);
  const A4 = await person("Asta", "Elfuhrrueckrufprobe");
  const spaet11 = `${tagPlus(1)}T11:00:00`;
  await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, scheduled_at, created_at) VALUES (${A4.ref}, ${AGENT}, 'Daniel Stripling', 'result', 'rueckruf_termin', ${parseBerlinInput(spaet11)}, NOW())`;
  const wA4 = await nach(A4, "rueckruf_termin", { terminZeitpunkt: spaet11 }, um2030);
  ok(wA4.urteil?.art === "warten", "Rückruf morgen 11:00, gebucht 20:30 → wartet bis 08:00", wA4);
  // c) Ein Merker, der im Takt „erledigt“ wird (Tag vorbei), schreibt den Vermerk in die Akte.
  const A5 = await person("Abel", "Erledigtvermerkprobe");
  await sql`INSERT INTO fiaon_mara_nacharbeit (person_id, ref, art, ergebnis, zusage_tag, status, vorgemerkt_am, agent_id)
            VALUES (${A5.pid}, ${A5.ref}, 'zusage', 'erreicht_zahlt_gleich', ${tagPlus(-1)}::date, 'vorgemerkt', NOW() - INTERVAL '1 hour', ${AGENT})`;
  await takt();
  ok((await letzter(A5.pid))?.status === "erledigt" && anBrevo("Erledigtvermerkprobe").length === 0, "Zusage von gestern im Takt → erledigt, keine Mail", await letzter(A5.pid));
  ok((await vermerke(A5, "Mara hat nach dem Gespräch keine Zusammenfassung geschickt: der zugesagte Tag ist vorbei.")).length === 1, "… und die Akte sagt warum (Vermerk)");
  // d) „Irrtümlich?“ am Verlaufseintrag: ergebnisNachbereiten gibt den Eintrag, der Merker kennt ihn, die void-Route nimmt zurück.
  const { ergebnisNachbereiten } = await import("../server/lib/fiaon-kontakt-ergebnis");
  const I1 = await person("Ida", "Irrtumprobe");
  const nI1 = await ergebnisNachbereiten({ ref: I1.ref!, personId: I1.pid, ergebnis: "erreicht_zahlt_am" as any, zusageDatum: tagPlus(2), akteur, herkunft: "liste" });
  const [eI1] = (await sql`SELECT id, outcome FROM fiaon_contact_log WHERE id = ${nI1.logId ?? 0}`) as any[];
  ok(Number.isInteger(nI1.logId) && eI1?.outcome === "erreicht_zahlt_am", "ergebnisNachbereiten gibt den Verlaufseintrag zurück (logId)", nI1.logId);
  await nach(I1, "erreicht_zahlt_am", { zusageDatum: tagPlus(2), logId: nI1.logId });
  ok(Number((await letzter(I1.pid))?.log_id) === nI1.logId && (await letzter(I1.pid))?.status === "vorgemerkt", "der Merker kennt seinen Eintrag (log_id)");
  // So wie POST /agent/log/:id/void: Eintrag streichen, dann zurücknehmen.
  await sql`UPDATE fiaon_contact_log SET voided_at = NOW(), voided_by = ${AGENT} WHERE id = ${nI1.logId}`;
  const hI1 = await N.nacharbeitZuEintragZuruecknehmen(nI1.logId!);
  ok(/zurückgenommen/.test(hI1 ?? "") && (await letzter(I1.pid))?.status === "zurueckgenommen", `„Irrtümlich?“ → zurückgenommen („${hI1}“)`, await letzter(I1.pid));
  ok((await N.nacharbeitZuEintragZuruecknehmen(nI1.logId!)) === null, "zweimal „Irrtümlich?“ → nichts mehr zurückzunehmen (null)");
  // Schon gestrichen, aber der Merker wartet noch (oder ist schon im Takt): der Takt prüft den Eintrag selbst.
  const I2 = await person("Ines", "Irrtumtaktprobe");
  const [eI2] = (await sql`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, created_at) VALUES (${I2.ref}, ${AGENT}, 'Daniel Stripling', 'result', 'erreicht_zahlt_am', NOW()) RETURNING id`) as any[];
  await nach(I2, "erreicht_zahlt_am", { zusageDatum: tagPlus(2), logId: Number(eI2.id) });
  await sql`UPDATE fiaon_contact_log SET voided_at = NOW() WHERE id = ${eI2.id}`;
  await takt();
  ok(anBrevo("Irrtumtaktprobe").length === 0 && (await letzter(I2.pid))?.status === "zurueckgenommen", "gestrichener Eintrag → der Takt sendet nicht (zurückgenommen)", await letzter(I2.pid));
  // e) Dasselbe Ergebnis noch einmal, Häkchen BEWUSST aus → zurückgenommen, mit Satz. Ohne Wahl (Telefon) bleibt sie (Abschnitt 3).
  const H1 = await person("Hans", "Hakenausprobe");
  await nach(H1, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  const wH1 = await nach(H1, "erreicht_zahlt_am", { zusageDatum: tagPlus(2), gewaehlt: false, abgewaehlt: true });
  ok(wH1.ersetzt === true && /^Häkchen aus: Maras wartende Zusammenfassung ist zurückgenommen/.test(wH1.hinweis ?? "") && (await letzter(H1.pid))?.status === "zurueckgenommen",
    "dasselbe Ergebnis, Häkchen bewusst aus → zurückgenommen + Satz", { wH1, m: await letzter(H1.pid) });
  const H2 = await person("Hedi", "Altwartendprobe");
  await nach(H2, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) }, new Date(Date.now() - 40 * 60_000));
  await nach(H2, "erreicht_zahlt_am", { zusageDatum: tagPlus(2), gewaehlt: false, abgewaehlt: true });
  ok((await letzter(H2.pid))?.status === "zurueckgenommen", `bewusst aus nimmt auch eine ältere (> ${R.KORREKTUR_MINUTEN} Min.) wartende zurück`);
  // f) Eine heikle Notiz ohne Häkchen nimmt die wartende Mail zurück — auch beim gleichen Ergebnis.
  const H3 = await person("Holger", "Heikelnachtragprobe");
  await nach(H3, "erreicht_zahlt_am", { zusageDatum: tagPlus(2) });
  const wH3 = await nach(H3, "erreicht_zahlt_am", { zusageDatum: tagPlus(2), gewaehlt: false, notiz: "Kunde will doch kündigen." });
  ok((await letzter(H3.pid))?.status === "zurueckgenommen" && /Kündigung/.test(wH3.hinweis ?? ""), `heikle Notiz → zurückgenommen („${wH3.hinweis}“)`, await letzter(H3.pid));
  await takt();
  ok(anBrevo("Irrtumprobe").length === 0 && anBrevo("Hakenausprobe").length === 0 && anBrevo("Altwartendprobe").length === 0 && anBrevo("Heikelnachtragprobe").length === 0 && anBrevo("Spaetzusageprobe").length === 0 && anBrevo("Fruehrueckrufprobe").length === 0,
    "Takt: nichts von alledem geht raus");
  // g) Die Vorschau-Daten um 20:30: die ZAHLUNG zählt, nicht die Uhr (sonst sperrte „heute“ auch „Zahlt am Donnerstag“).
  const A6 = await person("Alva", "Abendvorschauprobe");
  const vdA = await N.vorschauDaten(A6.pid, um2030);
  ok(vdA.betrag === "59,99 €" && !vdA.zahlungGrund, "Vorschau-Daten um 20:30: Betrag da, kein Zahlungsgrund", vdA);
  ok(R.nacharbeitVorschau(vdA, { ergebnis: "erreicht_zahlt_am", zusageDatum: tagPlus(2), heute: R.berlinTag(um2030), jetzt: um2030 }).moeglich
     && !R.nacharbeitVorschau(vdA, { ergebnis: "erreicht_zahlt_gleich", heute: R.berlinTag(um2030), jetzt: um2030 }).moeglich,
    "20:30: „Zahlt am <übermorgen>“ mit Häkchen, „Zahlt sofort“ ohne");

  ok(FREMD.length === 0, "kein Netzaufruf außer der Brevo-Attrappe", FREMD);
  console.log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut}/${gut + schlecht} Prüfungen bestanden.`);
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
