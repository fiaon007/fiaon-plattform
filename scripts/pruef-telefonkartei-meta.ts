// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-259 (29.09.2026): TELEFONKARTEI — WHATSAPP ÜBER META + REIHUNG
//
// Justin zu /chef/s/telefonkartei:
//   (1) „Wenn ich WhatsApp-Nachricht auswähle […], dann muss das über unser
//       WhatsApp-Meta-Konto laufen, nicht über das private."
//   (2) „Ich brauche ganz oben immer den frischesten Kunden, einen Kunden, der
//       nicht schon 10× angerufen wurde — also ganz oben A, dann B und dann C,
//       die keine oder am wenigsten Anrufe bekommen haben."
//
// Geprüft wird mit echter Datenbank (eigene Kopie) und einer Meta-Attrappe:
//   1  Reihung: angelegte Testpersonen A/B/C/Rate mit 0/2/3/5/6/12 Versuchen,
//      frisch und alt, Pause (vor 2 Std. versucht, Zusage), Wunschzeit — die
//      Reihenfolge in „Alle", A, B, C, Rate; die Zählung (Softphone + Ergebnis
//      = ein Versuch, Privathandy-Ergebnis zählt, Lead-Ergebnis zählt, Serie
//      endet beim Erreichen).
//   2  WhatsApp je Fall: Rechnung (Vorlage, Bildfassung, Knopf = Referenz),
//      Rate (Knopf = Rate-Referenz), Nicht erreicht (Vorlage + Tagesplatz; im
//      offenen Fenster freier Text mit Justins Kalender; Tagesplatz belegt;
//      drei Tage Abstand; Bestandskunde ohne Vorlage), Antrag (Lead ohne
//      Vorlage, Abbrecher mit nicht freigegebener Vorlage, freier Text im
//      Fenster), Sperren (Werbesperre, Vertriebssperre), Festnetz, keine
//      Nummer, Doppelklick, Meta-Fehler; persönliche Nachricht (Fenster zu →
//      409-Fall, Fenster offen → freier Text, Rückfrage-Vorlage);
//      Protokoll in fiaon_whatsapp, Gespräch (Mara an/aus), Verlauf.
//   3  Kein Netz außer den Attrappen; am Ende alles aufgeräumt.
//   Nachbesserung E-259 (Gegenprüfung 29.09.2026) — je Befund ein Fall:
//      „Weitere laden" nach eigenen Klicks (niemand fehlt, niemand doppelt),
//      hängende Wählzeilen ohne SID und Wählbündel binnen 5 Min., „erreicht" am
//      entdoppelten Ergebnis, Ratenergebnisse, Ergebnisse ohne outcome,
//      Wunschzeit erst in der Versuchsstufe; Abbrecher-Knopf = Code seines Leads
//      (führt in GENAU seinen Antrag), ohne Lead keine Vorlage; kein nackter
//      /antrag (Text und Mail); „Stopp" sperrt auch freien Text, Werbesperre nur
//      mit Bestätigung; Nicht erreicht im Fenster: Doppelklick und 3 Tage; zwei
//      gleichzeitige „Rechnung schicken" = eine Vorlage; A ohne Nicht-erreicht-
//      Vorlage; Hinweis „allgemeines Terminformular"; neutrale Meldung.
//
// NUR gegen den lokalen Prüfstand fiaon_pruefstand_e259. Es geht keine echte
// WhatsApp und keine Mail raus: fetch ist eine Attrappe, BREVO_API_KEY fehlt
// (Mails scheitern mit „nicht gesetzt"). Eigene Testzeilen: Personen
// 925901–926020, Nummern 491590099259…/491590099260…, Referenzen TK259-….
//
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e259?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-telefonkartei-meta.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e259?sslmode=require";
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand_e259/.test(process.env.DATABASE_URL!)) { console.error("NUR gegen den lokalen Prüfstand fiaon_pruefstand_e259!"); process.exit(2); }
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "RESEND_API_KEY", "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}

// ── KEIN NETZ: jede Anfrage geht an die Attrappe ─────────────────────────────
process.env.MAKE_WEBHOOK_URL = "http://make.pruefstand.invalid/hook";
process.env.WHATSAPP_WABA_ID = "pruef-waba";
process.env.WHATSAPP_PHONE_ID = "pruef-nummer";
process.env.META_SYSTEM_TOKEN = "pruef-token";
process.env.META_APP_SECRET = "pruef-geheim";
process.env.META_GRAPH_URL = "http://meta.pruefstand.invalid";

// Bei „Meta" freigegeben — zuerst OHNE fiaon_kk(b)_antrag_offen (Prüfung „nicht freigegeben"),
// danach mit (Abbrecher-Knopf; die Liste wird dafür bei der Attrappe erweitert).
const FREI = [
  "fiaon_kk_rechnung", "fiaon_kkb_rechnung", "fiaon_kk_rate", "fiaon_kkb_rate",
  "fiaon_kk_nicht_erreicht", "fiaon_kkb_nicht_erreicht", "fiaon_kk_rueckfrage", "fiaon_kkb_rueckfrage",
  "fiaon_kk_tag1", "fiaon_kk_termin_morgen",
];
/** Diese Nummer lehnt „Meta" ab (131026, nicht zustellbar). */
const NR_FEHLER = "49159009925959";
const aufrufe: { url: string; methode: string; body: string }[] = [];
const metaSendungen: { an: string; typ: string; vorlage: string | null; werte: string[]; knopf: string | null; text: string | null }[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input?.url ?? input);
  const methode = String(init?.method ?? "GET");
  const body = typeof init?.body === "string" ? init.body : "";
  aufrufe.push({ url, methode, body });
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "Content-Type": "application/json" } });
  if (url.startsWith("http://make.pruefstand.invalid")) return new Response("Accepted", { status: 200 });
  if (url.startsWith("http://meta.pruefstand.invalid")) {
    if (url.includes("/message_templates")) return json({ data: FREI.map((name, i) => ({ name, status: "APPROVED", category: "UTILITY", id: String(i + 1), components: [] })) });
    if (url.includes("/messages")) {
      const j = JSON.parse(body || "{}");
      const komp: any[] = j.template?.components ?? [];
      metaSendungen.push({
        an: String(j.to), typ: String(j.type), vorlage: j.template?.name ?? null,
        werte: (komp.find((c) => c.type === "body")?.parameters ?? []).map((p: any) => String(p.text)),
        knopf: komp.find((c) => c.type === "button")?.parameters?.[0]?.text ?? null,
        text: j.text?.body ?? null,
      });
      if (String(j.to) === NR_FEHLER) return json({ error: { message: "Message undeliverable", code: 131026 } }, 400);
      return json({ messages: [{ id: `wamid.PRUEF259.${aufrufe.length}` }] });
    }
    return json({});
  }
  throw new Error(`Prüfstand: kein Netz (${url})`);
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const tk = await import("../server/lib/fiaon-telefonkartei");
const wa = await import("../server/lib/fiaon-whatsapp");
const { linkPruefung } = await import("../shared/fiaon-mara-ton");

let ok = 0, fehl = 0;
const pruef = (name: string, bed: boolean, info: unknown = "") => {
  if (bed) { ok++; console.log(`  ✓ ${name}`); }
  else { fehl++; console.log(`  ✗ ${name}${info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);

const IDS = Array.from({ length: 120 }, (_, i) => 925901 + i);
const NR = (id: number) => `49159009${id}`;
const DOMAIN = "tk259.invalid";
const TAG = 86_400_000;
const STD = 3_600_000;
const vor = (ms: number) => new Date(Date.now() - ms);
const AKTEUR = "Justin Schwarzott";
const AGENT = 8; // ein Mitarbeiter aus der Strukturkopie — nur als Wähler der Softphone-Anrufe

async function aufraeumen() {
  // Jede Tabelle mit person_id bzw. ref — nur die eigenen Testzeilen.
  const spalten = (await sqlPool`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name IN ('person_id', 'ref')
       AND table_name NOT IN ('fiaon_persons', 'fiaon_applications', 'fiaon_leads')`) as any[];
  for (const s of spalten) {
    const t = String(s.table_name);
    if (s.column_name === "person_id") await sqlPool.unsafe(`DELETE FROM "${t}" WHERE person_id::text = ANY($1)`, [IDS.map(String)]).catch(() => {});
    else await sqlPool.unsafe(`DELETE FROM "${t}" WHERE ref::text LIKE 'TK259-%'`).catch(() => {});
  }
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE nummer LIKE '49159009925%' OR nummer LIKE '49159009926%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer LIKE '49159009925%' OR nummer LIKE '49159009926%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_wa_tagesplatz WHERE schluessel LIKE 'n:49159009925%' OR schluessel LIKE 'n:49159009926%' OR schluessel LIKE 'p:925%' OR schluessel LIKE 'p:926%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_calls WHERE nummer LIKE '+49159009925%' OR nummer LIKE '+49159009926%' OR nummer LIKE '+4930925%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_kurzlinks WHERE lead_id IN (SELECT id FROM fiaon_leads WHERE email LIKE ${"%@" + DOMAIN})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_lead_log WHERE lead_id IN (SELECT id FROM fiaon_leads WHERE email LIKE ${"%@" + DOMAIN})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_leads WHERE person_id = ANY(${IDS}) OR email LIKE ${"%@" + DOMAIN}`;
  await sqlPool`DELETE FROM fiaon_applications WHERE person_id = ANY(${IDS}) OR ref LIKE 'TK259-%'`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${IDS})`;
}

interface PersonOpt {
  tier: 0 | 1 | 2 | 3; grund?: string; alt: number; telefon?: string | null; anrede?: string | null;
  werbesperre?: boolean; blocked?: boolean; zusage?: string | null; nach?: string;
}
async function person(id: number, o: PersonOpt) {
  const tel = o.telefon === undefined ? `+${NR(id)}` : o.telefon;
  await sqlPool`
    INSERT INTO fiaon_persons (id, person_ref, first_name, last_name, anrede, primary_email, primary_phone, country,
                               priority_tier, tier_reason, werbung_gesperrt_am, is_blocked, promised_payment_date, created_at, updated_at)
    VALUES (${id}, ${`TK259-P${id}`}, 'Test', ${o.nach ?? `Kartei${id}`}, ${o.anrede ?? null}, ${`p${id}@${DOMAIN}`}, ${tel}, 'DE',
            ${o.tier}, ${o.grund ?? (o.tier === 3 ? "nur_lead" : o.tier === 1 ? "zahlung_angekuendigt" : o.tier === 2 ? "rechnung_offen" : "bezahlt")},
            ${o.werbesperre ? vor(TAG) : null}, ${!!o.blocked}, ${o.zusage ?? null}, ${vor(o.alt)}, ${vor(o.alt)})`;
}
/** Eine Bestellung: offen (Rechnung gestellt), gemeldet oder bezahlt. */
async function bestellung(id: number, o: { status: "pending_payment" | "claimed_paid" | "paid" | "abbruch"; alt: number; erreichbarkeit?: string }) {
  const ref = `TK259-${id}`;
  const zahlung = o.status === "abbruch" ? "pending" : o.status;
  await sqlPool`
    INSERT INTO fiaon_applications (ref, payment_reference, type, status, current_step, pack_key, pack_name, first_name, last_name, email, country,
                                    person_id, payment_status, amount_due, claimed_paid_at, paid_at, erreichbarkeit, created_at, updated_at)
    VALUES (${ref}, ${`FIAON-TK${String(id).slice(-4)}`}, 'privat', ${o.status === "abbruch" ? "started" : "submitted"}, ${o.status === "abbruch" ? 2 : 9},
            'pro', 'FIAON Pro (Standard)', 'Test', ${`Kartei${id}`}, ${`p${id}@${DOMAIN}`}, 'DE', ${id}, ${zahlung}, 59.99,
            ${o.status === "claimed_paid" ? vor(o.alt) : null}, ${o.status === "paid" ? vor(o.alt) : null}, ${o.erreichbarkeit ?? null},
            ${vor(o.alt)}, ${vor(o.alt)})`;
  return ref;
}
async function lead(id: number, alt: number): Promise<number> {
  const [l] = (await sqlPool`
    INSERT INTO fiaon_leads (person_id, email, vorname, nachname, telefon, erstellt_am, updated_at)
    VALUES (${id}, ${`p${id}@${DOMAIN}`}, 'Test', ${`Kartei${id}`}, ${`+${NR(id)}`}, ${vor(alt)}, ${vor(alt)}) RETURNING id`) as any[];
  return Number(l.id);
}
/** Ein Softphone-Anruf (fiaon_calls, raus). `ergebnis` null = im Softphone kein Ergebnis gesetzt. */
async function anruf(id: number, alt: number, ergebnis: string | null = "nicht_erreicht", o: { status?: string; sid?: string | null } = {}) {
  const sid = o.sid === undefined ? `CA259${id}${Math.round(alt / 1000)}` : o.sid;
  await sqlPool`
    INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, beginn, status, ergebnis, twilio_sid, created_at, updated_at)
    VALUES (${id}, ${AGENT}, ${`+${NR(id)}`}, 'raus', ${vor(alt)}, ${o.status ?? "beendet"}, ${ergebnis}, ${sid}, ${vor(alt)}, ${vor(alt)})`;
}
/** Ein Ergebnis im Kontaktprotokoll (Akte, Privathandy, Kartei). `outcome` null = Onboarding-Eintrag mit Notiz. */
async function ergebnis(id: number, alt: number, outcome: string | null = "nicht_erreicht", notiz: string | null = null) {
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
    VALUES (${`TK259-${id}`}, ${id}, ${AGENT}, 'Prüfstand', 'result', ${outcome}, ${notiz}, ${vor(alt)})`;
}
async function leadErgebnis(leadId: number, alt: number, outcome = "nicht_erreicht") {
  await sqlPool`INSERT INTO fiaon_lead_log (lead_id, agent_name, type, outcome, created_at) VALUES (${leadId}, 'Prüfstand', 'result', ${outcome}, ${vor(alt)})`;
}
/** Die Karten eines Reiters, nur die eigenen Testpersonen, in Reihenfolge. */
async function reihe(gruppe: "alle" | "A" | "B" | "C" | "rate", nur: number[]): Promise<number[]> {
  const aus: number[] = [];
  for (let seite = 0; seite < 10; seite++) {
    const l = await tk.karteiListe({ gruppe, seite });
    aus.push(...l.karten.map((k) => k.personId));
    if (!l.mehr) break;
  }
  return aus.filter((id) => nur.includes(id));
}
const name = (liste: number[], namen: Record<number, string>) => liste.map((id) => namen[id] ?? String(id)).join(" ");

try {
  await aufraeumen();
  await tk.karteiTabellen();
  await wa.waTabellen();

  // ═════════════════════════════════════════════════════════════════════════
  titel("1  Reihung: frisch, A → B → C → Rate, wenigste Versuche, ab 10 ans Ende");
  // ═════════════════════════════════════════════════════════════════════════
  const R = {
    A1: 925901, A2: 925902, A3: 925903, A4: 925904, A5: 925905,
    B1: 925906, B2: 925907, B3: 925908, D1: 925909, E1: 925910, F1: 925911,
    C1: 925912, C2: 925913, R1: 925914, X1: 925915, G1: 925916,
  };
  const namen: Record<number, string> = Object.fromEntries(Object.entries(R).map(([k, v]) => [v, k]));
  // A — Zahlung gemeldet
  await person(R.A1, { tier: 1, alt: 30 * TAG }); await bestellung(R.A1, { status: "claimed_paid", alt: 1 * TAG });          // frisch, 0 Versuche
  await person(R.A2, { tier: 1, alt: 30 * TAG }); await bestellung(R.A2, { status: "claimed_paid", alt: 20 * TAG });         // alt, 0
  await person(R.A3, { tier: 1, alt: 30 * TAG }); await bestellung(R.A3, { status: "claimed_paid", alt: 20 * TAG });         // alt, 3 Softphone
  for (const t of [5, 4, 3]) await anruf(R.A3, t * TAG);
  await person(R.A4, { tier: 1, alt: 30 * TAG }); await bestellung(R.A4, { status: "claimed_paid", alt: 1 * TAG });          // frisch, 12 → Ende
  for (let i = 0; i < 12; i++) await anruf(R.A4, (2 + i) * TAG);
  await person(R.A5, { tier: 1, alt: 30 * TAG }); await bestellung(R.A5, { status: "claimed_paid", alt: 20 * TAG });         // alt, vor 2 Std. versucht → Pause
  await anruf(R.A5, 2 * STD);
  // B — Rechnung offen
  await person(R.B1, { tier: 2, alt: 30 * TAG }); await bestellung(R.B1, { status: "pending_payment", alt: 2 * TAG });       // frisch, 0
  await person(R.B3, { tier: 2, alt: 30 * TAG, zusage: new Date(Date.now() + TAG).toISOString().slice(0, 10) });
  await bestellung(R.B3, { status: "pending_payment", alt: 1 * TAG });                                                       // frisch, Zusage → Pause
  await person(R.B2, { tier: 2, alt: 30 * TAG }); await bestellung(R.B2, { status: "pending_payment", alt: 10 * TAG });      // alt, 5 Privathandy-Ergebnisse
  for (const t of [9, 8, 7, 6, 5]) await ergebnis(R.B2, t * TAG);
  await person(R.D1, { tier: 2, alt: 30 * TAG }); await bestellung(R.D1, { status: "pending_payment", alt: 10 * TAG });      // alt: Anruf + Ergebnis = 1, dazu 1 Privathandy = 2
  await anruf(R.D1, 3 * TAG); await ergebnis(R.D1, 3 * TAG - 10 * 60_000); await ergebnis(R.D1, 2 * TAG);
  await person(R.E1, { tier: 2, alt: 30 * TAG }); await bestellung(R.E1, { status: "pending_payment", alt: 10 * TAG });      // alt: 4 nicht, 1 erreicht, 1 nicht → 6 / Serie 1
  for (const t of [9, 8, 7, 6]) await anruf(R.E1, t * TAG);
  await anruf(R.E1, 5 * TAG, "erreicht_sonstiges"); await anruf(R.E1, 4 * TAG);
  // F1: alt, 0 Versuche, aber seine Wunschzeit passt JETZT nicht.
  const stunde = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((p) => p.type === "hour")!.value);
  const fremdesFenster = stunde >= 8 && stunde < 12 ? "Abends (18–20)" : "Vormittags (8–12)";
  await person(R.F1, { tier: 2, alt: 30 * TAG }); await bestellung(R.F1, { status: "pending_payment", alt: 10 * TAG, erreichbarkeit: fremdesFenster });
  // G1: alt, 0 Versuche, ohne Wunschzeit (passt immer) — steht vor F1, aber (Nachbesserung) HINTER keinem mit mehr Versuchen.
  await person(R.G1, { tier: 2, alt: 30 * TAG }); await bestellung(R.G1, { status: "pending_payment", alt: 10 * TAG });
  // C — Leads
  await person(R.C1, { tier: 3, alt: 1 * TAG }); await lead(R.C1, 1 * TAG);                                                 // frisch, 0
  await person(R.C2, { tier: 3, alt: 5 * TAG }); const c2Lead = await lead(R.C2, 5 * TAG);                                  // alt, 2 Lead-Ergebnisse
  await leadErgebnis(c2Lead, 4 * TAG); await leadErgebnis(c2Lead, 3 * TAG);
  // Rate offen und Bezahlt
  await person(R.R1, { tier: 0, alt: 60 * TAG }); const r1Ref = await bestellung(R.R1, { status: "paid", alt: 60 * TAG });
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status)
                VALUES (${r1Ref}, 2, ${`FIAON-TK${String(R.R1).slice(-4)}-2`}, 5999, (NOW() AT TIME ZONE 'Europe/Berlin')::date - 1, 'offen')`;
  await person(R.X1, { tier: 0, alt: 60 * TAG }); await bestellung(R.X1, { status: "paid", alt: 60 * TAG });

  const alle = Object.values(R);
  const t0 = Date.now();
  const reiheAlle = await reihe("alle", alle);
  const dauer = Date.now() - t0;
  // Nachbesserung E-259: Die Wunschzeit sortiert erst INNERHALB derselben Versuchsstufe — F1 (0 Versuche, Wunschzeit
  // passt nicht) steht vor D1 (2 Versuche), aber hinter G1 (0 Versuche, passt).
  const erwartetAlle = ["A1", "B1", "B3", "C1", "R1", "A2", "A3", "A5", "G1", "F1", "D1", "B2", "E1", "C2", "A4", "X1"].map((k) => (R as any)[k] as number);
  pruef(`„Alle“: erst die Frischen A→B→C→Rate, dann der Bestand, ab 10 Versuchen/Bezahlt ans Ende (${name(reiheAlle, namen)})`,
    reiheAlle.join(",") === erwartetAlle.join(","), `erwartet ${name(erwartetAlle, namen)}`);
  console.log(`    (Abfrage „Alle“ mit Zählung: ${dauer} ms im Prüfstand)`);
  const reiheA = await reihe("A", alle);
  pruef(`Reiter A: frisch, dann 0 vor 3 Versuchen, Pause dahinter, 12 Versuche am Ende (${name(reiheA, namen)})`,
    reiheA.join(",") === [R.A1, R.A2, R.A3, R.A5, R.A4].join(","));
  const reiheB = await reihe("B", alle);
  pruef(`Reiter B: frisch (ohne Pause vor Zusage), dann 0 (Wunschzeit passt vor passt nicht) → 2 → 5 → 6 Versuche (${name(reiheB, namen)})`,
    reiheB.join(",") === [R.B1, R.B3, R.G1, R.F1, R.D1, R.B2, R.E1].join(","));
  pruef(`Reiter C: frischer Lead vor Lead mit 2 Versuchen (${name(await reihe("C", alle), namen)})`, (await reihe("C", alle)).join(",") === [R.C1, R.C2].join(","));
  pruef("Reiter Rate: die fällige Rate", (await reihe("rate", alle)).join(",") === String(R.R1));

  const karte = async (id: number) => (await tk.karteEinzeln(id))!;
  const a3 = await karte(R.A3), d1 = await karte(R.D1), e1 = await karte(R.E1), c2 = await karte(R.C2), b2 = await karte(R.B2), a4 = await karte(R.A4);
  pruef(`Zählung: 3 Softphone-Anrufe = 3 Versuche, 3 in Folge (${a3.kontakt.versuche}/${a3.kontakt.fehlInFolge})`, a3.kontakt.versuche === 3 && a3.kontakt.fehlInFolge === 3);
  pruef(`Zählung: Anruf + Ergebnis 10 Min. später = EIN Versuch, Privathandy-Ergebnis zählt (${d1.kontakt.versuche})`, d1.kontakt.versuche === 2);
  pruef(`Zählung: Serie endet beim Erreichen (6 Versuche, 1 in Folge: ${e1.kontakt.versuche}/${e1.kontakt.fehlInFolge})`, e1.kontakt.versuche === 6 && e1.kontakt.fehlInFolge === 1);
  pruef(`Zählung: Lead-Ergebnisse zählen, auch „in Folge“ (${c2.kontakt.versuche}/${c2.kontakt.fehlInFolge})`, c2.kontakt.versuche === 2 && c2.kontakt.fehlInFolge === 2);
  pruef(`Zählung: 5 Privathandy-Ergebnisse ohne Softphone (${b2.kontakt.versuche})`, b2.kontakt.versuche === 5);
  pruef(`Karte trägt die Zahl („${a4.kontakt.versuche} Versuche“, zuletzt ${a4.kontakt.letzterVersuch ? "gesetzt" : "leer"})`, a4.kontakt.versuche === 12 && !!a4.kontakt.letzterVersuch);
  const suche = await tk.karteiListe({ gruppe: "A", suche: "Kartei92590" });
  pruef(`Suche nimmt dieselbe Ordnung (${suche.karten.length} Treffer, erste ${namen[suche.karten[0]?.personId] ?? "–"})`, suche.karten[0]?.personId === R.A1);

  // ═════════════════════════════════════════════════════════════════════════
  titel("1b Zählung — Nachbesserung: Wählzeilen, Bündel, erreicht, Raten, ohne outcome");
  // ═════════════════════════════════════════════════════════════════════════
  const Z = { PH: 925961, JETZT: 925962, ER: 925963, RT: 925964, NU: 925965 };
  // PH: 14 Wählzeilen ohne Twilio-SID binnen 48 Sekunden (nie rausgegangen) + 2 echte Versuche, der zweite als
  // Bündel aus drei Wahlen binnen 2 Minuten → 2 Versuche (vorher 17).
  await person(Z.PH, { tier: 2, alt: 30 * TAG }); await bestellung(Z.PH, { status: "pending_payment", alt: 10 * TAG });
  for (let i = 0; i < 14; i++) await anruf(Z.PH, 2 * TAG - i * 3_000, null, { status: "gewaehlt", sid: null });
  await anruf(Z.PH, 3 * TAG);
  for (const m of [0, 1, 2]) await anruf(Z.PH, 1 * TAG - m * 60_000, m === 2 ? "nicht_erreicht" : null, { status: m === 2 ? "beendet" : "niemand_erreicht" });
  const kPH = await karte(Z.PH);
  pruef(`Hängende Wählzeilen (gewaehlt, ohne SID) zählen nicht, 3 Wahlen binnen 5 Min. = 1 Versuch (${kPH.kontakt.versuche} Versuche, ${kPH.kontakt.fehlInFolge} in Folge)`,
    kPH.kontakt.versuche === 2 && kPH.kontakt.fehlInFolge === 2);
  // JETZT: eine Wählzeile ohne SID von vor 2 Minuten — der Anruf kann gerade laufen, sie zählt.
  await person(Z.JETZT, { tier: 2, alt: 30 * TAG }); await bestellung(Z.JETZT, { status: "pending_payment", alt: 10 * TAG });
  await anruf(Z.JETZT, 2 * 60_000, null, { status: "gewaehlt", sid: null });
  pruef("… eine Wählzeile ohne SID von vor 2 Minuten zählt (läuft vielleicht gerade)", (await karte(Z.JETZT)).kontakt.versuche === 1);
  // ER: 5 Fehlversuche, dann ein Softphone-Gespräch OHNE Softphone-Ergebnis, das Ergebnis steht nur in der Akte
  // („erreicht — zahlt am", 5 Min. später) → erreicht bleibt, die Serie ist 0 (vorher 6).
  await person(Z.ER, { tier: 2, alt: 30 * TAG }); await bestellung(Z.ER, { status: "pending_payment", alt: 20 * TAG });
  for (const t of [9, 8, 7, 6, 5]) await anruf(Z.ER, t * TAG);
  await anruf(Z.ER, 1 * TAG, null); await ergebnis(Z.ER, 1 * TAG - 5 * 60_000, "erreicht_zahlt_am");
  const kER = await karte(Z.ER);
  pruef(`„Erreicht" am entdoppelten Akte-Ergebnis bleibt: 6 Versuche, 0 in Folge (${kER.kontakt.versuche}/${kER.kontakt.fehlInFolge})`,
    kER.kontakt.versuche === 6 && kER.kontakt.fehlInFolge === 0);
  // RT: Ratenergebnisse — 3× rate_nicht_erreicht, dann rate_zahlt_am → erreicht, Serie 0.
  await person(Z.RT, { tier: 0, alt: 60 * TAG }); await bestellung(Z.RT, { status: "paid", alt: 60 * TAG });
  for (const t of [9, 8, 7]) await ergebnis(Z.RT, t * TAG, "rate_nicht_erreicht");
  await ergebnis(Z.RT, 6 * TAG, "rate_zahlt_am");
  const kRT = await karte(Z.RT);
  pruef(`„rate_zahlt_am" heißt erreicht: 4 Versuche, 0 in Folge (${kRT.kontakt.versuche}/${kRT.kontakt.fehlInFolge})`, kRT.kontakt.versuche === 4 && kRT.kontakt.fehlInFolge === 0);
  // NU: Ergebnisse ohne outcome (Onboarding-Bereich) — „verpasst" zählt nicht, „Startgespräch geführt" beendet die Serie.
  await person(Z.NU, { tier: 0, alt: 60 * TAG }); await bestellung(Z.NU, { status: "paid", alt: 60 * TAG });
  await ergebnis(Z.NU, 9 * TAG, "rate_nicht_erreicht"); await ergebnis(Z.NU, 8 * TAG, "rate_nicht_erreicht");
  await ergebnis(Z.NU, 7 * TAG, null, "Startgespräch verpasst — Kunde nicht erschienen (22.09.2026, 10:00 Uhr).");
  await ergebnis(Z.NU, 6 * TAG, null, "Startgespräch geführt (23.09.2026, 10:00 Uhr).");
  const kNU = await karte(Z.NU);
  pruef(`Ergebnisse ohne outcome sind keine Versuche; „Startgespräch geführt" beendet die Serie (${kNU.kontakt.versuche}/${kNU.kontakt.fehlInFolge})`,
    kNU.kontakt.versuche === 2 && kNU.kontakt.fehlInFolge === 0);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2  WhatsApp je Fall — über das FIAON-Konto (Attrappe)");
  // ═════════════════════════════════════════════════════════════════════════
  const W = {
    RECHNUNG: 925921, WERBESPERRE: 925922, RATE: 925923, NICHT: 925924, NICHT_3T: 925925, TAGESPLATZ: 925926,
    FENSTER: 925927, BESTAND: 925928, LEAD: 925929, LEAD_FENSTER: 925930, ABBRECHER: 925931, FESTNETZ: 925932,
    VERTRIEB: 925933, OHNE_NR: 925934, RUECKFRAGE: 925935, FEHLER: 925959,
    // Nachbesserung E-259
    A_NICHT: 925936, AB_LEAD: 925937, AB_ALT: 925938, AB_FENSTER: 925939, STOPP: 925940, WS_FENSTER: 925941,
    PARALLEL: 925942, LEAD_MAIL: 925943, AB_OHNE: 925944,
  };
  await person(W.RECHNUNG, { tier: 2, alt: 3 * TAG, anrede: "Frau", nach: "Muster" }); await bestellung(W.RECHNUNG, { status: "pending_payment", alt: 3 * TAG });
  await person(W.WERBESPERRE, { tier: 2, alt: 3 * TAG, werbesperre: true }); await bestellung(W.WERBESPERRE, { status: "pending_payment", alt: 3 * TAG });
  await person(W.RATE, { tier: 0, alt: 60 * TAG }); const rateRef = await bestellung(W.RATE, { status: "paid", alt: 60 * TAG });
  await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status)
                VALUES (${rateRef}, 3, ${`FIAON-TK${String(W.RATE).slice(-4)}-3`}, 4999, (NOW() AT TIME ZONE 'Europe/Berlin')::date - 2, 'offen')`;
  await person(W.NICHT, { tier: 2, alt: 3 * TAG }); await bestellung(W.NICHT, { status: "pending_payment", alt: 3 * TAG });
  await person(W.NICHT_3T, { tier: 2, alt: 3 * TAG }); await bestellung(W.NICHT_3T, { status: "pending_payment", alt: 3 * TAG });
  await person(W.TAGESPLATZ, { tier: 2, alt: 3 * TAG }); await bestellung(W.TAGESPLATZ, { status: "pending_payment", alt: 3 * TAG });
  await person(W.FENSTER, { tier: 1, alt: 3 * TAG }); await bestellung(W.FENSTER, { status: "claimed_paid", alt: 3 * TAG });
  await person(W.BESTAND, { tier: 0, alt: 60 * TAG }); await bestellung(W.BESTAND, { status: "paid", alt: 60 * TAG });
  await person(W.LEAD, { tier: 3, alt: 1 * TAG }); await lead(W.LEAD, 1 * TAG);
  await person(W.LEAD_FENSTER, { tier: 3, alt: 1 * TAG }); await lead(W.LEAD_FENSTER, 1 * TAG);
  await person(W.ABBRECHER, { tier: 3, grund: "antrag_abgebrochen", alt: 2 * TAG }); await bestellung(W.ABBRECHER, { status: "abbruch", alt: 2 * TAG });
  await person(W.FESTNETZ, { tier: 2, alt: 3 * TAG, telefon: `+4930${W.FESTNETZ}` }); await bestellung(W.FESTNETZ, { status: "pending_payment", alt: 3 * TAG });
  await person(W.VERTRIEB, { tier: 2, alt: 3 * TAG, blocked: true }); await bestellung(W.VERTRIEB, { status: "pending_payment", alt: 3 * TAG });
  await person(W.OHNE_NR, { tier: 2, alt: 3 * TAG, telefon: null }); await bestellung(W.OHNE_NR, { status: "pending_payment", alt: 3 * TAG });
  await person(W.RUECKFRAGE, { tier: 2, alt: 3 * TAG }); await bestellung(W.RUECKFRAGE, { status: "pending_payment", alt: 3 * TAG });
  await person(W.FEHLER, { tier: 2, alt: 3 * TAG }); await bestellung(W.FEHLER, { status: "pending_payment", alt: 3 * TAG });
  await person(W.A_NICHT, { tier: 1, alt: 3 * TAG }); await bestellung(W.A_NICHT, { status: "claimed_paid", alt: 3 * TAG });
  // Abbrecher MIT Lead (Antrag 2 Tage alt), mit Lead und Antrag älter als 60 Tage, und einer mit offenem Fenster.
  await person(W.AB_LEAD, { tier: 3, grund: "antrag_abgebrochen", alt: 2 * TAG }); await bestellung(W.AB_LEAD, { status: "abbruch", alt: 2 * TAG }); await lead(W.AB_LEAD, 2 * TAG);
  await person(W.AB_ALT, { tier: 3, grund: "antrag_abgebrochen", alt: 80 * TAG }); await bestellung(W.AB_ALT, { status: "abbruch", alt: 70 * TAG }); await lead(W.AB_ALT, 80 * TAG);
  await person(W.AB_FENSTER, { tier: 3, grund: "antrag_abgebrochen", alt: 2 * TAG }); await bestellung(W.AB_FENSTER, { status: "abbruch", alt: 2 * TAG });
  await person(W.AB_OHNE, { tier: 3, grund: "antrag_abgebrochen", alt: 2 * TAG }); await bestellung(W.AB_OHNE, { status: "abbruch", alt: 2 * TAG });
  await person(W.STOPP, { tier: 2, alt: 3 * TAG }); await bestellung(W.STOPP, { status: "pending_payment", alt: 3 * TAG });
  await person(W.WS_FENSTER, { tier: 2, alt: 3 * TAG, werbesperre: true }); await bestellung(W.WS_FENSTER, { status: "pending_payment", alt: 3 * TAG });
  await person(W.PARALLEL, { tier: 2, alt: 3 * TAG }); await bestellung(W.PARALLEL, { status: "pending_payment", alt: 3 * TAG });
  await sqlPool`UPDATE fiaon_persons SET primary_email = NULL WHERE id = ${W.PARALLEL}`;
  await sqlPool`UPDATE fiaon_applications SET email = NULL WHERE person_id = ${W.PARALLEL}`;
  await person(W.LEAD_MAIL, { tier: 3, alt: 1 * TAG }); await lead(W.LEAD_MAIL, 1 * TAG);
  // Offene Fenster: der Kunde hat vor einer Stunde geschrieben.
  for (const id of [W.FENSTER, W.LEAD_FENSTER, W.AB_FENSTER, W.WS_FENSTER]) {
    await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at)
                  VALUES (${`wamid.REIN259.${id}`}, 'rein', ${NR(id)}, ${id}, 'text', 'Hallo, ich habe eine Frage', 'empfangen', ${vor(STD)}, ${vor(STD)})`;
  }
  // „STOPP" vor einer Stunde — das öffnet das Fenster UND ist ein Stopp.
  await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at)
                VALUES (${`wamid.STOPP259.${W.STOPP}`}, 'rein', ${NR(W.STOPP)}, ${W.STOPP}, 'text', 'STOPP', 'empfangen', ${vor(STD)}, ${vor(STD)})`;
  // Heute schon eine WhatsApp auf einem anderen Weg (Mara, Zentrale).
  await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, von, gesendet_am, created_at)
                VALUES ('wamid.ANDERS259', 'raus', ${NR(W.TAGESPLATZ)}, ${W.TAGESPLATZ}, 'vorlage', 'Erinnerung', 'fiaon_kk_tag1', 'gesendet', 'Mara', NOW(), NOW())`;
  // „Nicht erreicht" schon vor einem Tag (Akte eines Betreuers).
  await sqlPool`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, von, gesendet_am, created_at)
                VALUES ('wamid.GESTERN259', 'raus', ${NR(W.NICHT_3T)}, ${W.NICHT_3T}, 'vorlage', 'Nicht erreicht', 'fiaon_kkb_nicht_erreicht', 'gesendet', 'Florentine Lombardi', ${vor(TAG)}, ${vor(TAG)})`;

  const sendungen = () => metaSendungen.length;
  const waZeilen = async (id: number) => (await sqlPool`SELECT richtung, typ, vorlage, status, von, text, fehler FROM fiaon_whatsapp WHERE person_id = ${id} AND richtung = 'raus' ORDER BY id`) as any[];
  const gespraech = async (id: number) => ((await sqlPool`SELECT mara_an, mara_aus_grund, person_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${NR(id)}`) as any[])[0];
  // Die Ergebniskette schreibt über die Bestellnummer (ref), Vermerke tragen auch person_id — beides lesen.
  const verlauf = async (id: number) => (await sqlPool`SELECT type, outcome, agent_id, agent_name, note FROM fiaon_contact_log WHERE person_id = ${id} OR ref = ${`TK259-${id}`} ORDER BY id`) as any[];

  // ── Vorschau (whatsapp-lage) ──
  const lage = (await tk.karteiWaLage(W.RECHNUNG, AKTEUR))!;
  pruef(`Vorschau Rechnung: Vorlage „${lage.faelle.rechnung?.klartext}“, Fenster zu, freier Text nicht möglich`,
    lage.faelle.rechnung?.weg === "vorlage" && lage.faelle.rechnung.klartext === "Ihre offene Rechnung" && !lage.fensterOffen && lage.frei.weg === null && lage.frei.kurz === "24-Stunden-Fenster zu");
  pruef("Vorschau schickt nichts", sendungen() === 0);
  const lageTP = (await tk.karteiWaLage(W.TAGESPLATZ, AKTEUR))!;
  pruef(`Vorschau Tagesplatz belegt: „${lageTP.faelle.nicht_erreicht?.kurz}“ — Rechnung trotzdem möglich (vom Kunden erbeten)`,
    lageTP.faelle.nicht_erreicht?.weg === null && lageTP.faelle.nicht_erreicht.kurz === "heute schon eine WhatsApp" && lageTP.faelle.rechnung?.weg === "vorlage");
  const lageWS = (await tk.karteiWaLage(W.WERBESPERRE, AKTEUR))!;
  pruef(`Vorschau Werbesperre: „${lageWS.faelle.rechnung?.kurz}“`, lageWS.faelle.rechnung?.weg === null && lageWS.faelle.rechnung.kurz === "Werbesperre");

  // ── Rechnung (erste Zahlung) über ergebnisFesthalten ──
  const r1 = await tk.ergebnisFesthalten(W.RECHNUNG, "rechnung", AKTEUR);
  const s1 = metaSendungen.at(-1);
  pruef(`Rechnung: WhatsApp über FIAON gesendet (${r1.wa?.text})`, r1.ok && r1.wa?.ok === true && r1.wa.weg === "vorlage");
  pruef(`… Bildfassung fiaon_kkb_rechnung, Werte [Name, Betrag, Referenz] (${s1?.vorlage} · ${s1?.werte.join("|")})`,
    s1?.vorlage === "fiaon_kkb_rechnung" && s1.werte.join("|") === `Frau Muster|59,99|FIAON-TK${String(W.RECHNUNG).slice(-4)}`);
  pruef(`… Knopf = Zahlungsseite dieser Referenz (${s1?.knopf})`, s1?.knopf === `FIAON-TK${String(W.RECHNUNG).slice(-4)}`);
  pruef("… an die FIAON-Nummer des Kunden (kanonisch)", s1?.an === NR(W.RECHNUNG));
  const z1 = await waZeilen(W.RECHNUNG);
  pruef(`… fiaon_whatsapp: raus, Vorlage, von „${z1[0]?.von}“ (im Raum „Mensch“)`, z1.length === 1 && z1[0].vorlage === "fiaon_kkb_rechnung" && z1[0].status === "gesendet" && z1[0].von === AKTEUR);
  const g1 = await gespraech(W.RECHNUNG);
  pruef("… Gespräch angelegt, Mara bleibt an (Vorlage = Anstupser)", g1?.mara_an === true && Number(g1.person_id) === W.RECHNUNG);
  const v1 = await verlauf(W.RECHNUNG);
  const e1b = v1.find((z) => z.type === "result");
  pruef(`… Verlauf: Ergebnis ohne Mitarbeiter-ID, nennt nur, was rausging („${String(e1b?.note ?? "").slice(0, 90)}…“)`,
    !!e1b && e1b.agent_id == null && /WhatsApp über FIAON geschickt/.test(e1b.note) && !/Zahlungsdaten per WhatsApp/.test(e1b.note));
  pruef(`… Mail scheitert im Prüfstand ehrlich (${r1.mail?.text})`, r1.mail?.ok === false);
  const vorher = sendungen();
  const r1b = await tk.ergebnisFesthalten(W.RECHNUNG, "rechnung", AKTEUR);
  pruef(`Doppelklick: zweite Rechnung binnen 10 Min. schickt nichts und meldet „doppelt" (${r1b.meldung})`, sendungen() === vorher && r1b.ok && r1b.doppelt === true && !r1b.wa);
  // Zwei gleichzeitige „Rechnung schicken" (zweites Gerät) — genau eine Vorlage bei Meta.
  const vorPar = sendungen();
  const par = await Promise.all([tk.ergebnisFesthalten(W.PARALLEL, "rechnung", AKTEUR), tk.ergebnisFesthalten(W.PARALLEL, "rechnung", AKTEUR)]);
  pruef(`Zwei gleichzeitige „Rechnung schicken": eine WhatsApp, der andere Klick „doppelt" (${sendungen() - vorPar} Sendung, doppelt: ${par.map((x) => !!x.doppelt).join("/")})`,
    sendungen() - vorPar === 1 && par.filter((x) => x.doppelt).length === 1 && (await waZeilen(W.PARALLEL)).length === 1);

  // ── Werbesperre / Vertriebssperre ──
  const rWS = await tk.ergebnisFesthalten(W.WERBESPERRE, "rechnung", AKTEUR);
  pruef(`Werbesperre: keine Rechnung-Vorlage (${rWS.wa?.text})`, rWS.wa?.ok === false && /Werbesperre/.test(rWS.wa.text) && (await waZeilen(W.WERBESPERRE)).length === 0);
  const vWS = await verlauf(W.WERBESPERRE);
  pruef("… Verlauf sagt „WhatsApp nicht gesendet“", vWS.some((z) => z.type === "result" && /WhatsApp nicht gesendet \(/.test(z.note)));
  const kV = (await tk.karteEinzeln(W.VERTRIEB))!;
  const rV = await tk.karteiWhatsApp(kV, "nicht_erreicht", AKTEUR);
  pruef(`Vertriebssperre: keine Nicht-erreicht-Vorlage (${rV.text})`, !rV.ok && /Vertriebssperre/.test(rV.text));

  // ── Rate ──
  const rR = await tk.ergebnisFesthalten(W.RATE, "rechnung", AKTEUR);
  const sR = metaSendungen.at(-1);
  const rateRefText = `FIAON-TK${String(W.RATE).slice(-4)}-3`;
  pruef(`Rate: fiaon_kkb_rate mit [voller Name, Betrag, Fälligkeit, Rate-Referenz] (${sR?.vorlage} · ${sR?.werte.join("|")})`,
    rR.wa?.ok === true && sR?.vorlage === "fiaon_kkb_rate" && sR.werte[0] === `Test Kartei${W.RATE}` && sR.werte[1] === "49,99" && /^\d{2}\.\d{2}\.\d{4}$/.test(sR.werte[2]) && sR.werte[3] === rateRefText);
  pruef(`… Knopfwert = Referenz dieser Rate (${sR?.knopf})`, sR?.knopf === rateRefText);

  // ── Nicht erreicht ──
  const rN = await tk.ergebnisFesthalten(W.NICHT, "nicht_erreicht", AKTEUR);
  const sN = metaSendungen.at(-1);
  pruef(`Nicht erreicht: fiaon_kkb_nicht_erreicht [Name, „Justin“] (${sN?.vorlage} · ${sN?.werte.join("|")})`,
    rN.wa?.ok === true && sN?.vorlage === "fiaon_kkb_nicht_erreicht" && sN.werte.join("|") === `Test Kartei${W.NICHT}|Justin`);
  pruef(`… die Meldung sagt offen, wohin der Knopf führt („${rN.wa?.text.slice(-60)}“)`, /allgemeines Terminformular, nicht dein Kalender/.test(String(rN.wa?.text)));
  const lageN = (await tk.karteiWaLage(W.NICHT_3T, AKTEUR))!;
  const lageB = (await tk.karteiWaLage(W.RUECKFRAGE, AKTEUR))!;
  pruef(`… ebenso die Vorschau im Blatt („${lageB.faelle.nicht_erreicht?.hinweis}“)`, lageB.faelle.nicht_erreicht?.weg === "vorlage" && /allgemeines Terminformular/.test(String(lageB.faelle.nicht_erreicht.hinweis)) && lageN.faelle.nicht_erreicht?.weg === null);
  const rA = await tk.ergebnisFesthalten(W.A_NICHT, "nicht_erreicht", AKTEUR);
  pruef(`A (Zahlung gemeldet): keine Nicht-erreicht-Vorlage („es fehlt nur noch Ihr Ja" stimmt nicht) — ${rA.wa?.text.slice(0, 70)}…`,
    rA.ok && rA.wa?.ok === false && /fiaon_kk_kalender/.test(rA.wa.text) && (await waZeilen(W.A_NICHT)).length === 0);
  const [tp] = (await sqlPool`SELECT weg FROM fiaon_wa_tagesplatz WHERE schluessel = ${`p:${W.NICHT}`} AND tag = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  pruef(`… Tagesplatz genommen (weg „${tp?.weg}“)`, tp?.weg === "telefonkartei");
  const vN = await verlauf(W.NICHT);
  pruef("… Ergebnis „nicht erreicht“ im Verlauf, mit WhatsApp über FIAON", vN.some((z) => z.type === "result" && z.outcome === "nicht_erreicht" && /WhatsApp über FIAON/.test(z.note)));
  const vorN = sendungen();
  const rN3 = await tk.karteiWhatsApp((await tk.karteEinzeln(W.NICHT_3T))!, "nicht_erreicht", AKTEUR);
  pruef(`Nicht erreicht: letzte keine 3 Tage alt → keine zweite (${rN3.text})`, !rN3.ok && /keine 3 Tage/.test(rN3.text) && sendungen() === vorN);
  const rTP = await tk.ergebnisFesthalten(W.TAGESPLATZ, "nicht_erreicht", AKTEUR);
  pruef(`Nicht erreicht: heute schon eine WhatsApp → nur Mail/Verlauf (${rTP.wa?.text})`, rTP.ok && rTP.wa?.ok === false && rTP.wa.text.includes(wa.TAGESPLATZ_BELEGT) && sendungen() === vorN);
  const rF = await tk.ergebnisFesthalten(W.FENSTER, "nicht_erreicht", AKTEUR);
  const sF = metaSendungen.at(-1);
  pruef(`Offenes Fenster: freier Text mit Justins Kalender statt Vorlage (${rF.wa?.weg})`,
    rF.wa?.ok === true && rF.wa.weg === "text" && sF?.typ === "text" && /\/justin\?k=/.test(String(sF.text)) && !/wa\.me/.test(String(sF.text)));
  const gF = await gespraech(W.FENSTER);
  pruef(`… freier Text: Mara pausiert („${gF?.mara_aus_grund}“, läuft von selbst ab)`, gF?.mara_an === false && gF.mara_aus_grund === "mensch");
  pruef(`… Meldung neutral („${rF.wa?.text.slice(-62)}“)`, !/\ber hat uns\b/.test(String(rF.wa?.text)) && /kam eine Nachricht/.test(String(rF.wa?.text)));
  const vorF2 = sendungen();
  const rF2 = await tk.ergebnisFesthalten(W.FENSTER, "nicht_erreicht", AKTEUR);
  pruef(`Offenes Fenster, zweiter Klick binnen 10 Min.: nichts gesendet, „doppelt" (${rF2.meldung.slice(0, 50)})`, sendungen() === vorF2 && rF2.doppelt === true);
  // Elf Minuten später (Takt und Ergebnis zurückdatiert): Die 3-Tage-Regel gilt jetzt auch für den freien Text.
  await sqlPool`UPDATE fiaon_telefonkartei_takt SET am = am - INTERVAL '11 minutes' WHERE person_id = ${W.FENSTER} AND art = 'nicht_erreicht'`;
  await sqlPool`UPDATE fiaon_contact_log SET created_at = created_at - INTERVAL '11 minutes' WHERE ref = ${`TK259-${W.FENSTER}`} AND type = 'result'`;
  const rF3 = await tk.ergebnisFesthalten(W.FENSTER, "nicht_erreicht", AKTEUR);
  pruef(`… nach 11 Min.: Ergebnis gebucht, aber keine zweite WhatsApp binnen 3 Tagen (${rF3.wa?.text.slice(0, 70)})`,
    sendungen() === vorF2 && rF3.ok && !rF3.doppelt && rF3.wa?.ok === false && /keine 3 Tage/.test(rF3.wa.text));
  const vF3 = (await verlauf(W.FENSTER)).filter((z) => z.type === "result" && z.outcome === "nicht_erreicht");
  pruef(`… der Verlauf nennt je Klick, was wirklich rausging (${vF3.length} Ergebnisse, das zweite ohne WhatsApp)`,
    vF3.length === 2 && /WhatsApp über FIAON geschickt/.test(vF3[0].note) && /WhatsApp nicht gesendet/.test(vF3[1].note));
  const rB = await tk.ergebnisFesthalten(W.BESTAND, "nicht_erreicht", AKTEUR);
  pruef(`Bestandskunde (bezahlt): keine passende Vorlage — ehrlich (${rB.wa?.text.slice(0, 80)}…)`, rB.wa?.ok === false && /fiaon_kk_kalender/.test(rB.wa.text));

  // ── Antrag ──
  const vorA = sendungen();
  const rL = await tk.ergebnisFesthalten(W.LEAD, "antrag", AKTEUR);
  pruef(`Lead C, Fenster zu: keine Vorlage mit Antrag-Link — ehrlich (${rL.wa?.text.slice(0, 70)}…)`, rL.ok && rL.wa?.ok === false && /fiaon_kk_antrag_link/.test(rL.wa.text) && sendungen() === vorA);
  const rLF = await tk.ergebnisFesthalten(W.LEAD_FENSTER, "antrag", AKTEUR);
  const sLF = metaSendungen.at(-1);
  const [codeLF] = (await sqlPool`SELECT link_code FROM fiaon_leads WHERE person_id = ${W.LEAD_FENSTER}`) as any[];
  pruef(`Lead C, Fenster offen: freier Text mit SEINEM Link (/a/${codeLF?.link_code}/w), kein nackter /antrag (${JSON.stringify(linkPruefung(String(sLF?.text)).filter((f) => f.art === "nackt").map((f) => f.link))})`,
    rLF.wa?.ok === true && sLF?.typ === "text" && !!codeLF?.link_code && String(sLF.text).includes(`/a/${codeLF.link_code}/w`)
      && linkPruefung(String(sLF.text)).every((f) => f.art !== "nackt") && !/fiaon\.com\/antrag(\s|$)/.test(String(sLF.text)));
  const [ll] = (await sqlPool`SELECT ll.outcome, ll.agent_id FROM fiaon_lead_log ll JOIN fiaon_leads l ON l.id = ll.lead_id WHERE l.person_id = ${W.LEAD_FENSTER} AND ll.type = 'result'`) as any[];
  pruef("… Lead-Ergebnis „erreicht — Interesse“ ohne Mitarbeiter-ID", ll?.outcome === "erreicht_interesse" && ll.agent_id == null);
  const rAb = await tk.ergebnisFesthalten(W.ABBRECHER, "antrag", AKTEUR);
  pruef(`Abbrecher: Vorlage nicht freigegeben → ehrlich, nichts gesendet (${rAb.wa?.text.slice(0, 80)})`, rAb.wa?.ok === false && /nicht freigegeben/.test(rAb.wa.text));
  // Die Mail des Lead-Falls trägt seinen Link (Kanal m) — im Protokoll steht der Text auch ohne Versand.
  await tk.ergebnisFesthalten(W.LEAD_MAIL, "antrag", AKTEUR);
  const [mLM] = (await sqlPool`SELECT payload FROM fiaon_mail_log WHERE person_id = ${W.LEAD_MAIL} AND event = 'frei_text' ORDER BY id DESC LIMIT 1`) as any[];
  const mailText = (() => { const p0 = typeof mLM?.payload === "string" ? JSON.parse(mLM.payload) : mLM?.payload; return String((typeof p0 === "string" ? JSON.parse(p0) : p0)?.text ?? ""); })();
  const [codeLM] = (await sqlPool`SELECT link_code FROM fiaon_leads WHERE person_id = ${W.LEAD_MAIL}`) as any[];
  pruef(`Mail „Antrag schicken": sein Link /a/<code>/m, kein nackter /antrag (${mailText.match(/https?:\S+/)?.[0] ?? "–"})`,
    !!codeLM?.link_code && mailText.includes(`/a/${codeLM.link_code}/m`) && linkPruefung(mailText).every((f) => f.art !== "nackt"));

  // ── Abbrecher-Knopf, jetzt mit freigegebener Vorlage (Attrappe erweitert, Zwischenspeicher der Freigaben erneuert) ──
  FREI.push("fiaon_kk_antrag_offen", "fiaon_kkb_antrag_offen");
  { const echt = Date.now; Date.now = () => echt() + 6 * 60_000; try { await wa.freigegebeneVorlagen(); } finally { Date.now = echt; } }
  const lageAb = (await tk.karteiWaLage(W.AB_LEAD, AKTEUR))!;
  pruef(`Vorschau Abbrecher mit Lead: Vorlage „${lageAb.faelle.antrag?.klartext}“ — ohne einen Code anzulegen`,
    lageAb.faelle.antrag?.weg === "vorlage" && ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_kurzlinks k JOIN fiaon_leads l ON l.id = k.lead_id WHERE l.person_id = ${W.AB_LEAD}`) as any[])[0].n === 0);
  const rAbL = await tk.ergebnisFesthalten(W.AB_LEAD, "antrag", AKTEUR);
  const sAbL = metaSendungen.at(-1);
  const [codeAb] = (await sqlPool`SELECT link_code FROM fiaon_leads WHERE person_id = ${W.AB_LEAD}`) as any[];
  const { kurzlinkLesen } = await import("../server/lib/fiaon-kurzlink");
  const zielAb = codeAb?.link_code ? await kurzlinkLesen(String(codeAb.link_code)) : null;
  pruef(`Abbrecher mit Lead: fiaon_kkb_antrag_offen, Knopf = SEIN Code (${sAbL?.knopf}), nie „start"`,
    rAbL.wa?.ok === true && sAbL?.vorlage === "fiaon_kkb_antrag_offen" && sAbL.knopf === `${codeAb?.link_code}/w` && sAbL.knopf !== "start");
  pruef(`… der Code führt in GENAU seinen begonnenen Antrag (${zielAb?.antrag?.ref}) → Wiedereinstieg`, zielAb?.antrag?.ref === `TK259-${W.AB_LEAD}` && zielAb.antrag.bezahlt === false);
  const vorAb = sendungen();
  const rAbO = await tk.ergebnisFesthalten(W.AB_OHNE, "antrag", AKTEUR);
  pruef(`Abbrecher OHNE Lead: keine Vorlage, ehrlicher Grund (${rAbO.wa?.text.slice(0, 90)}…)`, rAbO.wa?.ok === false && /kein Lead/.test(rAbO.wa.text) && sendungen() === vorAb);
  const rAbA = await tk.ergebnisFesthalten(W.AB_ALT, "antrag", AKTEUR);
  pruef(`Abbrecher mit Antrag älter als 60 Tage: keine Vorlage — der Code führte in einen NEUEN Antrag (${rAbA.wa?.text.slice(0, 90)}…)`,
    rAbA.wa?.ok === false && /neuen Antrag/.test(rAbA.wa.text) && sendungen() === vorAb);
  const rAbF = await tk.ergebnisFesthalten(W.AB_FENSTER, "antrag", AKTEUR);
  const sAbF = metaSendungen.at(-1);
  pruef(`Abbrecher, Fenster offen: freier Text mit dem Wiedereinstieg in seinen Antrag, nicht nackt`,
    rAbF.wa?.ok === true && sAbF?.typ === "text" && /\/antrag\?weiter=TK259-925939\./.test(String(sAbF.text)) && linkPruefung(String(sAbF.text)).every((f) => f.art !== "nackt"));

  // ── Nummern ──
  const rFN = await tk.karteiWhatsApp((await tk.karteEinzeln(W.FESTNETZ))!, "rechnung", AKTEUR);
  pruef(`Festnetz: kein WhatsApp (${rFN.text})`, !rFN.ok && /Festnetz/.test(rFN.text));
  const rON = await tk.karteiWhatsApp((await tk.karteEinzeln(W.OHNE_NR))!, "rechnung", AKTEUR);
  pruef(`Keine Nummer: kein WhatsApp (${rON.text})`, !rON.ok && /Keine Nummer/.test(rON.text));
  const rE = await tk.karteiWhatsApp((await tk.karteEinzeln(W.FEHLER))!, "rechnung", AKTEUR);
  const zE = await waZeilen(W.FEHLER);
  pruef(`Meta lehnt ab (131026): ehrlich gemeldet, Zeile mit Fehler (${rE.text.slice(0, 70)})`, !rE.ok && /WhatsApp nicht gesendet/.test(rE.text) && zE[0]?.status === "fehler" && /131026/.test(String(zE[0].fehler)));

  // ── Persönliche Nachricht ──
  const vorP = sendungen();
  const pZu = await tk.karteiNachricht(W.RUECKFRAGE, "frei", AKTEUR, "Hallo, wie besprochen hier kurz die Info.\n\nViele Grüße\nJustin Schwarzott");
  pruef(`Persönlich, Fenster zu: kein freier Text, „fensterZu“ (${pZu.meldung.slice(0, 60)}…)`, !pZu.ok && pZu.fensterZu === true && sendungen() === vorP);
  const pRf = await tk.karteiNachricht(W.RUECKFRAGE, "rueckfrage", AKTEUR);
  const sRf = metaSendungen.at(-1);
  pruef(`Rückfrage-Vorlage: fiaon_kkb_rueckfrage [Name, „Justin“] (${sRf?.vorlage} · ${sRf?.werte.join("|")})`,
    pRf.ok && sRf?.vorlage === "fiaon_kkb_rueckfrage" && sRf.werte.join("|") === `Test Kartei${W.RUECKFRAGE}|Justin`);
  const vRf = await verlauf(W.RUECKFRAGE);
  pruef("… Vermerk im Verlauf, ohne Mitarbeiter-ID", vRf.some((z) => z.type === "system" && z.agent_id == null && z.agent_name === AKTEUR && /Rückfrage-Vorlage/.test(z.note)));
  const TEXT = "Hallo Test Kartei925927,\n\nwie besprochen: Sehen Sie sich in Ruhe alles an und melden Sie sich gern wieder bei mir.\n\nViele Grüße\nJustin Schwarzott";
  const pOf = await tk.karteiNachricht(W.FENSTER, "frei", AKTEUR, TEXT);
  const sOf = metaSendungen.at(-1);
  pruef("Persönlich, Fenster offen: freier Text über FIAON, genau Justins Text", pOf.ok && sOf?.typ === "text" && sOf.text === TEXT);
  pruef("… Vermerk mit dem Text im Verlauf", (await verlauf(W.FENSTER)).some((z) => z.type === "system" && /persönliche Nachricht/.test(z.note) && z.note.includes("melden Sie sich gern")));
  const pDu = await tk.karteiNachricht(W.FENSTER, "frei", AKTEUR, "Hallo, kannst du mir bitte kurz zurückschreiben? Viele Grüße Justin");
  pruef(`Persönlich: die Wand gilt auch hier (Du-Form → nicht gesendet: ${pDu.meldung.slice(0, 70)})`, !pDu.ok && /Du-Form/.test(pDu.meldung));
  const vorDopp = sendungen();
  const pDopp = await Promise.all([tk.karteiNachricht(W.LEAD_FENSTER, "frei", AKTEUR, "Hallo, danke für Ihre Nachricht — ich melde mich gleich.\n\nViele Grüße\nJustin Schwarzott"),
    tk.karteiNachricht(W.LEAD_FENSTER, "frei", AKTEUR, "Hallo, danke für Ihre Nachricht — ich melde mich gleich.\n\nViele Grüße\nJustin Schwarzott")]);
  pruef(`Persönlich, derselbe Text zweimal gleichzeitig: eine Sendung (${sendungen() - vorDopp})`, sendungen() - vorDopp === 1 && pDopp.filter((x) => x.doppelt).length === 1);

  // ── „STOPP" und Werbesperre (Nachbesserung E-259) ──
  const kSt = (await tk.karteEinzeln(W.STOPP))!;
  pruef("Karte zeigt „Stopp“", kSt.stopp === true && (await tk.karteEinzeln(W.RECHNUNG))!.stopp === false);
  const lageSt = (await tk.karteiWaLage(W.STOPP, AKTEUR))!;
  pruef(`Vorschau nach „STOPP": Fenster offen, aber kein freier Text („${lageSt.frei.kurz}“), Nicht erreicht gesperrt`,
    lageSt.fensterOffen && lageSt.frei.weg === null && lageSt.frei.kurz === "Stopp" && lageSt.faelle.nicht_erreicht?.weg === null);
  const vorSt = sendungen();
  const pSt = await tk.karteiNachricht(W.STOPP, "frei", AKTEUR, "Hallo, darf ich Ihnen kurz unser Angebot zur Kreditkarte erklären?\n\nViele Grüße\nJustin Schwarzott", { bestaetigt: true });
  const nSt = await tk.ergebnisFesthalten(W.STOPP, "nicht_erreicht", AKTEUR);
  pruef(`„STOPP": persönliche Nachricht geht nicht, auch nicht bestätigt (${pSt.meldung.slice(0, 60)}…); Nicht erreicht ohne WhatsApp`,
    !pSt.ok && /Stopp/.test(pSt.meldung) && nSt.wa?.ok === false && /Stopp/.test(nSt.wa.text) && sendungen() === vorSt);
  const lageWs = (await tk.karteiWaLage(W.WS_FENSTER, AKTEUR))!;
  pruef(`Werbesperre, Fenster offen: freier Text nur mit Bestätigung („${lageWs.frei.kurz}“)`, lageWs.frei.weg === "text" && lageWs.frei.bestaetigen === true && lageWs.frei.kurz === "Werbesperre");
  const WS_TEXT = "Hallo, danke für Ihre Nachricht. Ihre Frage beantworte ich gern: Die Unterlagen liegen bei uns.\n\nViele Grüße\nJustin Schwarzott";
  const pWs1 = await tk.karteiNachricht(W.WS_FENSTER, "frei", AKTEUR, WS_TEXT);
  pruef(`… ohne Haken: nicht gesendet, „bestaetigen" (${pWs1.meldung.slice(0, 60)}…)`, !pWs1.ok && pWs1.bestaetigen === true && sendungen() === vorSt);
  const pWs2 = await tk.karteiNachricht(W.WS_FENSTER, "frei", AKTEUR, WS_TEXT, { bestaetigt: true });
  pruef("… mit Haken: gesendet, Vermerk nennt die Bestätigung", pWs2.ok && sendungen() === vorSt + 1
    && (await verlauf(W.WS_FENSTER)).some((z) => z.type === "system" && /trotz Sperre ausdrücklich bestätigt/.test(z.note)));

  // ═════════════════════════════════════════════════════════════════════════
  titel("3  „Weitere laden“ nach eigenen Klicks — niemand fehlt, niemand doppelt");
  // ═════════════════════════════════════════════════════════════════════════
  // 40 frische B-Kunden ohne Versuch (Justins Ablauf: „ich rufe oft 30 Kunden an").
  const NEU = Array.from({ length: 40 }, (_, i) => 925971 + i);
  for (const id of NEU) { await person(id, { tier: 2, alt: 2 * TAG }); await bestellung(id, { status: "pending_payment", alt: 1 * TAG }); }
  const eigeneB = ((await sqlPool`SELECT id FROM fiaon_persons WHERE id = ANY(${IDS}) AND priority_tier = 2 AND NOT is_blocked AND merged_into_person_id IS NULL`) as any[]).map((z) => Number(z.id));
  const s0 = await tk.karteiListe({ gruppe: "B" });
  // Die ersten 10 Karten der Seite: „Nicht erreicht" übers Softphone (jetzt) — sie rutschen nach hinten (Pause, 1 Versuch).
  for (const k of s0.karten.slice(0, 10)) await anruf(k.personId, 60_000);
  // Gegenprobe mit dem alten Weg (OFFSET): Seite 2 bringt schon gezeigte Karten wieder.
  const altS1 = await tk.karteiListe({ gruppe: "B", seite: 1 });
  const altDoppelt = altS1.karten.filter((k) => s0.karten.some((x) => x.personId === k.personId)).length;
  pruef(`Gegenprobe OFFSET: Seite 2 zeigt ${altDoppelt} schon gesehene Karten erneut (der alte Fehler)`, altDoppelt > 0);
  const gezeigt = s0.karten.map((k) => k.personId);
  let mehr = s0.mehr, runden = 0;
  while (mehr && runden++ < 20) {
    const w = await tk.karteiListe({ gruppe: "B", ohne: gezeigt });
    gezeigt.push(...w.karten.map((k) => k.personId));
    mehr = w.mehr;
  }
  const doppelt = gezeigt.length - new Set(gezeigt).size;
  const fehlt = eigeneB.filter((id) => !gezeigt.includes(id));
  pruef(`„Weitere laden“ mit den gezeigten Karten: ${gezeigt.length} Karten, ${doppelt} doppelt, ${fehlt.length} fehlen (von ${eigeneB.length})`,
    doppelt === 0 && fehlt.length === 0 && gezeigt.length === eigeneB.length);
  const s1neu = (await tk.karteiListe({ gruppe: "B", ohne: s0.karten.map((k) => k.personId) })).karten;
  pruef(`… Seite 2 beginnt mit den nächsten nie angerufenen Frischen (${s1neu.slice(0, 10).map((k) => k.kontakt.versuche).join(",")} Versuche)`,
    s1neu.slice(0, 10).every((k) => k.kontakt.versuche === 0 && NEU.includes(k.personId)));

  // ── Nirgends ein wa.me ──
  pruef("Keine Sendung trägt einen wa.me-Link", metaSendungen.every((s) => !/wa\.me/.test(String(s.text ?? ""))));
  pruef(`Jede Sendung ging an die Meta-Attrappe (${metaSendungen.length} Sendungen)`, aufrufe.filter((a) => a.url.includes("/messages")).every((a) => a.url.startsWith("http://meta.pruefstand.invalid")));
} catch (e) {
  fehl++;
  console.error("\n  ✗ ABBRUCH:", e);
} finally {
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  const [rest] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${IDS}))::int AS p,
           (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'TK259-%')::int AS a,
           (SELECT COUNT(*) FROM fiaon_whatsapp WHERE nummer LIKE '491590099259%')::int AS w,
           (SELECT COUNT(*) FROM fiaon_calls WHERE person_id = ANY(${IDS}))::int AS c,
           (SELECT COUNT(*) FROM fiaon_contact_log WHERE person_id = ANY(${IDS}) OR ref LIKE 'TK259-%')::int AS cl,
           (SELECT COUNT(*) FROM fiaon_wa_tagesplatz WHERE schluessel LIKE 'p:9259%' OR schluessel LIKE 'n:491590099259%')::int AS tp`
    .catch(() => [{ p: -1, a: -1, w: -1, c: -1, cl: -1, tp: -1 }])) as any[];
  console.log(`\nAufgeräumt: ${rest.p} Personen, ${rest.a} Bestellungen, ${rest.w} WhatsApp, ${rest.c} Anrufe, ${rest.cl} Verlaufszeilen, ${rest.tp} Tagesplätze übrig.`);
  const fremd = aufrufe.filter((a) => !/^http:\/\/(make|meta)\.pruefstand\.invalid/.test(a.url));
  console.log(`Netz: ${aufrufe.length} Anfragen, alle an Attrappen${fremd.length ? ` — ABER ${fremd.length} fremde: ${fremd.map((f) => f.url).join(", ")}` : ""}; ${metaSendungen.length} Sendungen bei der Meta-Attrappe.`);
  if (fremd.length) fehl++;
  console.log(`E-259 Telefonkartei (Meta + Reihung): ${ok} bestanden, ${fehl} nicht.`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(fehl ? 1 : 0);
}
