// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: VERTRETUNG (01.10.2026) — DER VERTRETER IST EIN MITARBEITER
//
// Seit 01.10. 10:28 ist das ganze Team bis 15.10. abwesend, Nikita (#13)
// vertritt (fiaon_settings.team_abwesenheit). Geprüft wird, was E-260 mit
// Justin als Vertreter nicht brauchte:
//
//   0. Aufbau: Abwesenheit mit 13 als Vertreter; 13 ist „Mitarbeiter", 928 nicht.
//   1. Terminseite (freieSlots — Anzeige UND Annahme): Kunde eines Abwesenden
//      sieht vor „bis" nur Plätze des Vertreters (2 h Vorlauf, Takt der
//      Gesprächsart, B4: Termine der Abwesenden belegen ihn), danach den
//      Betreuer; ohne Betreuer danach den Pool; Vertreter = Betreuer → seine
//      Plätze mit B4; „nur einzelne" → Pool der Anwesenden; Zahlungsgespräch
//      (inkasso_call) beim Vertreter angenommen, Rot-Probe: ein Abwesender nicht;
//      Gründer-/Global-Termine belegen den Vertreter nicht und nennen nie ihn;
//      Abwesenheit aus → wie vorher (Rot-Probe).
//   2. Route /api/fiaon/termin (echter Router): GET nennt die Vertretung und
//      keinen abwesenden Betreuer im Kopf; POST bucht beim Vertreter, Notiz
//      „in Abwesenheit von …", Kunde bleibt beim Betreuer, Bestätigung nennt den
//      Vertreter; ohne Betreuer kein Pin (Rot-Probe: nach „bis" im Pool pinnt
//      es wie immer); bestehender Termin bei Abwesendem nennt den Vertreter,
//      ein Global-Termin nicht; ein nicht angebotener Platz → 409. Die Mails
//      „Termin buchen" (sendePayloadBauen) nennen den Vertreter.
//   3. Maras Übergaben (WhatsApp, aufgabeFuerMenschen): an den Vertreter,
//      Heikles + Leitung zusätzlich aufs Board, ohne Person → /agent/whatsapp;
//      Vertreter = Betreiber (928) → Board wie E-260; aus → Betreuer.
//   4. Postfach: aufgabe_an_betreuer, notiz_an_betreuer, Übergabe aus dem Lauf
//      (anBetreuerUebergeben) → Vertreter; Heikles/Leitung → Kopie aufs Board.
//   5. Zugriff: darfAnKunde (Akte) und vertreterSiehtBetreuer (WhatsApp-Raum).
//   6. Übersicht und reine Regeln (heikleUebergabe, quelleUmleitbar, Quelltext).
//   Gegenprüfung (01.10.2026, nachgezogen): Rückruf aus dem Postfach NACH „bis" →
//   Betreuer (E-260), nicht der Vertreter; „Termin verpasst" (Route + Sende-Menü)
//   und die Bestätigung nach dem Verschieben nennen den, der anruft; die
//   Board-Kopie hält sich an `still`; heikleUebergabe ohne Fehltreffer
//   („Termin stornieren", „Klagenfurt", „gerichtet", „Nummer gelöscht",
//   „Erstattung der Auslagen"), mit „verweigert die Zahlung" (Eskalation);
//   gesperrter/Test-Betreuer → kein „… ist bis … nicht im Haus".
//
// NUR gegen die lokale Test-DB (Struktur-Kopie, keine Kunden). Kein Netz: Brevo
// ist eine Attrappe, WhatsApp und Make ohne Schlüssel.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_vertretung?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-vertretung.ts
// Eigene Datensätze (Personen PRUEFVT-…) werden am Ende entfernt; Agent 531 bekommt
// seine Rolle zurück, die Abwesenheit wird gelöscht.
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import; alles andere außer localhost ist gesperrt ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
process.env.MAKE_WEBHOOK_URL = "";
const BREVO: { an: string; betreff: string; text: string }[] = [];
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    BREVO.push({ an: String(b.to?.[0]?.email ?? "").toLowerCase(), betreff: String(b.subject ?? ""), text: String(b.textContent ?? b.htmlContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<vt-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 900)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
const quelle = (pfad: string) => readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");

const { sqlPool } = await import("../server/lib/db-pool");
const abw = await import("../server/lib/fiaon-abwesenheit");
const termine = await import("../server/lib/fiaon-termine");
const mt = await import("../server/lib/fiaon-mara-termin");
const { berlinDatum } = await import("../server/lib/fiaon-time");

const MARKE = `PRUEFVT-${Date.now().toString(36)}`;
const START = new Date(Date.now() - 1000);
const VERTRETER = 13;   // Nikita — echter Mitarbeiter
const ABWESEND = 8;     // Daniel — abwesend
const ANDERER = 505;    // Hans-Jürgen — abwesend, kein Vertreter
const BETREIBER = 928;  // Justin — Testkonto
const personen: number[] = [];
const refs: string[] = [];
let server: import("node:http").Server | null = null;
let rolle531: string | null = null;
let zeiten531: import("../server/lib/fiaon-termine").Zeitfenster[] | null = null;

async function person(ein: { betreuer?: number | null; tier?: number; name?: string; email?: boolean } = {}): Promise<number> {
  const n = personen.length + 1;
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason, primary_email, primary_phone)
    VALUES (${`${MARKE}-${n}`}, ${ein.name ?? "Pruef"}, ${`Vertretung${n}`}, ${ein.betreuer ?? null}, ${ein.tier ?? 2}, 'nur_lead',
            ${ein.email === false ? null : `vt${n}-${MARKE.toLowerCase()}@pruefstand.invalid`}, ${`+49151770${String(1000 + n)}`})
    RETURNING id`) as any[];
  personen.push(Number(p.id));
  return Number(p.id);
}
async function terminDirekt(ein: { personId: number; agentId: number; beginn: Date | string; quelle?: string; dauer?: number }): Promise<number> {
  const [t] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token)
    VALUES (${ein.personId}, ${ein.agentId}, ${new Date(ein.beginn)}, ${ein.dauer ?? 20}, 'gebucht', ${ein.quelle ?? "nichterreicht_mail"},
            ${`${MARKE}-${Math.random().toString(36).slice(2)}`.padEnd(48, "0").slice(0, 48)})
    RETURNING id`) as any[];
  return Number(t.id);
}
/** Die offenen Aufgaben, die zu einer Person gehören (Link oder Schlüssel). */
async function aufgabenVon(personId: number | null, nummer?: string): Promise<any[]> {
  return (await sqlPool`
    SELECT id, schluessel, titel, text, link, quelle, zustaendig_art, zustaendig_agent_id
      FROM fiaon_betreiber_todos
     WHERE created_at >= ${START}
       AND (${personId != null} AND (link LIKE ${`%person=${personId}`} OR schluessel LIKE ${`wa-${personId}-%`} OR schluessel LIKE ${`postmeister:${personId}:%`} OR schluessel LIKE ${`postmeister:antwort:${personId}%`})
            OR (${!!nummer} AND schluessel LIKE ${`wa-n${nummer ?? "-"}-%`}))
     ORDER BY id`) as any[];
}
const anVertreter = (a: any) => a.zustaendig_art === "agent" && Number(a.zustaendig_agent_id) === VERTRETER;
const aufsBoard = (a: any) => a.zustaendig_art === "betreiber" && a.zustaendig_agent_id == null;
const istKopie = (a: any) => String(a.schluessel ?? "").endsWith(":betreiber");

async function aufraeumen(): Promise<void> {
  const ids = personen.length ? personen : [0];
  await sqlPool`DELETE FROM fiaon_testkonto_warnungen WHERE tabelle = 'fiaon_termine' AND datensatz_id IN (SELECT id::text FROM fiaon_termine WHERE person_id = ANY(${ids}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termin_versuche WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termine WHERE person_id = ANY(${ids})`.catch((e) => console.error("Aufräumen termine:", e));
  await sqlPool`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${ids}) OR nummer LIKE '49151777%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE created_at >= ${START})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START}`.catch((e) => console.error("Aufräumen Aufgaben:", String(e).slice(0, 160)));
  await sqlPool`DELETE FROM fiaon_agent_events WHERE created_at >= ${START}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`.catch((e) => console.error("Aufräumen personen:", e));
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${abw.ABWESENHEIT_SCHLUESSEL}`.catch(() => {});
  if (rolle531 !== null) await sqlPool`UPDATE fiaon_agents SET rolle = ${rolle531} WHERE id = 531`.catch(() => {});
  if (zeiten531 !== null) await termine.verfuegbarkeitSetzen(531, zeiten531).catch(() => {});
  abw.abwesenheitVergessen();
}

const bis = new Date(Date.now() + 50 * 3_600_000);
const setzen = async (vertreterId: number, fuer: number[] = []) => {
  const r = await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId, fuer }, "Prüfstand Vertretung");
  abw.abwesenheitVergessen();
  return r;
};

try {
  await aufraeumen();
  await mt.protokollTabelle();

  // ═══ 0. Aufbau ═════════════════════════════════════════════════════════════
  abschnitt("0. Aufbau: Nikita (#13) vertritt das ganze Team");
  {
    const z13 = (await termine.verfuegbarkeitVon(VERTRETER)).filter((x) => x.aktiv).length;
    const z8 = (await termine.verfuegbarkeitVon(ABWESEND)).filter((x) => x.aktiv).length;
    ok("13 und 8 haben Arbeitszeiten", z13 > 0 && z8 > 0, { z13, z8 });
    const an = await setzen(VERTRETER);
    const ab = await abw.abwesenheitJetzt();
    ok("Abwesenheit an: Vertreter 13, für das ganze Team", an.ok && ab?.vertreter.id === VERTRETER && ab.fuer.length === 0, an.fehler ?? an.was);
    ok("13 gilt als Mitarbeiter (Übergaben an ihn)", ab?.vertreter.mitarbeiter === true, ab?.vertreter);
    const p928 = await abw.vertreterPruefen(BETREIBER);
    ok("928 (Testkonto/Gründer) gilt NICHT als Mitarbeiter", p928.vertreter?.mitarbeiter === false, p928);
  }
  const ab0 = (await abw.abwesenheitJetzt())!;
  const vorBis = (s: { beginn: string }) => new Date(s.beginn).getTime() < bis.getTime();

  // ═══ 1. Terminseite ═══════════════════════════════════════════════════════
  abschnitt("1. Terminseite (freieSlots): vor „bis“ der Vertreter, danach der normale Weg");
  const PA = await person({ betreuer: ABWESEND });
  let X = "";
  {
    const a = await termine.freieSlots(PA, sqlPool, "auto");
    const vor = a.slots.filter(vorBis), nach = a.slots.filter((s) => !vorBis(s));
    ok("Kunde eines Abwesenden: vor „bis“ nur Plätze von 13 (mindestens einer)", vor.length > 0 && vor.every((s) => s.agentId === VERTRETER),
      { n: vor.length, agenten: Array.from(new Set(vor.map((s) => s.agentId))) });
    ok("… danach nur Plätze des Betreuers 8", nach.length > 0 && nach.every((s) => s.agentId === ABWESEND), Array.from(new Set(nach.map((s) => s.agentId))));
    ok("… Kopf nennt keinen Betreuer, Auskunft trägt die Abwesenheit (13 vertritt 8)",
      a.betreuer === null && a.abwesenheit?.vertreterId === VERTRETER && a.abwesenheit?.betreuerId === ABWESEND && !a.abwesenheit?.vertreterIstBetreuer, { betreuer: a.betreuer, ab: a.abwesenheit });
    ok("… 2 Stunden Vorlauf wie jede Kundenbuchung", a.slots.every((s) => new Date(s.beginn).getTime() >= Date.now() + 119 * 60_000));
    const jeTag = new Map<string, number>();
    for (const s of a.slots) jeTag.set(s.datum, (jeTag.get(s.datum) ?? 0) + 1);
    const proTag = await termine.slotsProTag();
    ok(`… höchstens ${proTag} Zeiten je Tag (Knappheit wie immer)`, Array.from(jeTag.values()).every((n) => n <= proTag), Object.fromEntries(jeTag));

    // B4: Ein Termin des Abwesenden belegt den Vertreter.
    X = vor[0].beginn;
    const PX = await person({ betreuer: ABWESEND });
    await terminDirekt({ personId: PX, agentId: ABWESEND, beginn: X });
    const b = await termine.freieSlots(PA, sqlPool, "auto");
    const roh = await abw.freiePlaetzeVertreter(ab0, 120, sqlPool, { takt: 20 });
    ok("B4: der Termin von 8 zur Zeit X belegt 13 — X weder roh noch auf der Seite", !roh.some((s) => s.beginn === X) && !b.slots.some((s) => s.beginn === X && s.agentId === VERTRETER));
    // Gründer und Global: belegen den Vertreter nicht.
    const Y = roh.find((s) => Math.abs(new Date(s.beginn).getTime() - new Date(X).getTime()) >= 60 * 60_000)!.beginn;
    const PY = await person({ betreuer: ABWESEND });
    await terminDirekt({ personId: PY, agentId: ABWESEND, beginn: Y, quelle: "global", dauer: 30 });
    const roh2 = await abw.freiePlaetzeVertreter(ab0, 120, sqlPool, { takt: 20 });
    ok("Global-Termin von 8 belegt den Vertreter NICHT (NIE_UMLEITEN_QUELLEN)", roh2.some((s) => s.beginn === Y));
    // E-265: Nennform — der Vertreter ohne Anrede heißt „Nikita Boychenko", nie „Nikita"; der Gebuchte bleibt, wie er kam.
    ok("anruferFuer: normaler Termin bei 8 → „Nikita Boychenko“; Global/Gründer → der Gebuchte (Nennform)",
      (await abw.anruferFuer(ABWESEND, X, "Herr Stripling", sqlPool, "nichterreicht_mail")) === "Nikita Boychenko"
      && (await abw.anruferFuer(ABWESEND, Y, "Herr Stripling", sqlPool, "global")) === "Herr Stripling"
      && (await abw.anruferFuer(ABWESEND, Y, "Herr Stripling", sqlPool, "gruender")) === "Herr Stripling"
      && (await abw.anruferFuer(ABWESEND, X, "Herr Stripling")) === "Nikita Boychenko");
    const anN = await abw.anruferNennform(ABWESEND, X, { nom: "Herr Stripling", dat: "Herrn Stripling" }, sqlPool, "nichterreicht_mail");
    const anG = await abw.anruferNennform(ABWESEND, Y, { nom: "Herr Stripling", dat: "Herrn Stripling" }, sqlPool, "global");
    ok("anruferNennform: beide Fälle des Vertreters (ohne Anrede = voller Name), Global beide Fälle des Gebuchten",
      anN.nom === "Nikita Boychenko" && anN.dat === "Nikita Boychenko" && anN.vertreter && anN.vertreterVorname === "Nikita"
      && anG.nom === "Herr Stripling" && anG.dat === "Herrn Stripling" && !anG.vertreter, { anN, anG });
  }
  {
    // Ohne Betreuer: vor „bis" der Vertreter, danach der Pool.
    const PB = await person({ betreuer: null, tier: 3 });
    const a = await termine.freieSlots(PB, sqlPool, "auto");
    const vor = a.slots.filter(vorBis), nach = a.slots.filter((s) => !vorBis(s));
    ok("ohne Betreuer: vor „bis“ nur 13, danach Pool (Anwesende ab „bis“)", vor.length > 0 && vor.every((s) => s.agentId === VERTRETER) && nach.length > 0,
      { vor: Array.from(new Set(vor.map((s) => s.agentId))), nach: Array.from(new Set(nach.map((s) => s.agentId))) });
    ok("… Auskunft: Abwesenheit ohne Betreuer", a.abwesenheit?.betreuerId == null && a.betreuer === null);
    // Gegenprüfung: Ein gesperrter Test-Betreuer (927) kommt nach „bis" nicht zurück — kein Name in der Auskunft.
    const PT = await person({ betreuer: 927 });
    const t = await termine.freieSlots(PT, sqlPool, "auto");
    ok("gesperrter/Test-Betreuer (927): Vertretung ohne Betreuer-Namen (kein „… ist bis … nicht im Haus“)",
      !!t.abwesenheit && t.abwesenheit.betreuerNenn === null && t.abwesenheit.betreuerId === null && t.slots.filter(vorBis).every((s) => s.agentId === VERTRETER), t.abwesenheit);
    // Vertreter = Betreuer: seine Plätze, B4 gilt.
    const PN = await person({ betreuer: VERTRETER });
    const n = await termine.freieSlots(PN, sqlPool, "auto");
    ok("Vertreter = Betreuer: alle Plätze bei 13, Kopf nennt ihn, X (Termin von 8) belegt",
      n.slots.length > 0 && n.slots.every((s) => s.agentId === VERTRETER) && n.betreuer?.id === VERTRETER && n.abwesenheit?.vertreterIstBetreuer === true
      && !n.slots.some((s) => s.beginn === X), { betreuer: n.betreuer, ab: n.abwesenheit });
  }
  {
    // Startgespräch: Takt 15 — die Plätze des Vertreters im 15-Minuten-Raster, die Annahme nimmt sie.
    const PO = await person({ betreuer: ABWESEND, tier: 0 });
    const refO = `${MARKE}-O`; refs.push(refO);
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status, payment_status, assigned_agent_id) VALUES (${refO}, ${PO}, ${refO}, 'submitted', 'paid', ${ABWESEND})`;
    const a = await termine.freieSlots(PO, sqlPool, "auto");
    const vor = a.slots.filter(vorBis);
    const minuten = (s: { uhrzeit: string }) => Number(s.uhrzeit.slice(3, 5));
    ok(`Startgespräch (${a.quelle}): Plätze von 13 im 15-Minuten-Raster`, a.quelle === "onboarding_call" && vor.length > 0 && vor.every((s) => s.agentId === VERTRETER && minuten(s) % 15 === 0),
      vor.map((s) => s.uhrzeit));
    const bu = await termine.terminBuchen({ personId: PO, agentId: VERTRETER, beginn: vor[0].beginn, quelle: "auto", herkunft: "onboarding_einladung" });
    const [t] = (await sqlPool`SELECT dauer_min, quelle FROM fiaon_termine WHERE id = ${bu.id}`) as any[];
    ok("… Annahme bucht beim Vertreter (Raster-Wand hält), 15 Minuten", Number(t?.dauer_min) === 15 && t?.quelle === "onboarding_call", t);
  }
  {
    // Zahlungsgespräch: Rollenwand lässt den Vertreter durch, einen anderen Abwesenden nicht.
    const [r] = (await sqlPool`SELECT COALESCE(rolle, 'agent') AS rolle FROM fiaon_agents WHERE id = 531`) as any[];
    rolle531 = String(r?.rolle ?? "agent");
    zeiten531 = await termine.verfuegbarkeitVon(531);
    await sqlPool`UPDATE fiaon_agents SET rolle = 'inkasso' WHERE id = 531`;
    // Das Forderungsmanagement braucht Zeiten — sonst greift der Rollen-Rückfall (Vertrieb), und die Wand stünde gar nicht.
    await termine.verfuegbarkeitSetzen(531, [1, 2, 3, 4, 5, 6].map((wochentag) => ({ wochentag, von: "09:00", bis: "18:00", aktiv: true })));
    const PI = await person({ betreuer: null, tier: 1 });
    const refI = `${MARKE}-I`; refs.push(refI);
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status, payment_status) VALUES (${refI}, ${PI}, ${refI}, 'submitted', 'paid')`;
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${refI}, 2, ${`${refI}-2`}, 7999, ${berlinDatum(new Date(Date.now() - 5 * 86_400_000))}::date, 'offen')`;
    const a = await termine.freieSlots(PI, sqlPool, "auto");
    const vor = a.slots.filter(vorBis), nach = a.slots.filter((s) => !vorBis(s));
    ok(`Zahlungsgespräch (${a.quelle}): vor „bis“ der Vertreter, danach das Forderungsmanagement (531)`,
      a.quelle === "inkasso_call" && vor.length > 0 && vor.every((s) => s.agentId === VERTRETER) && nach.every((s) => s.agentId === 531),
      { q: a.quelle, vor: Array.from(new Set(vor.map((s) => s.agentId))), nach: Array.from(new Set(nach.map((s) => s.agentId))) });
    let gebucht = false;
    try {
      const bu = await termine.terminBuchen({ personId: PI, agentId: VERTRETER, beginn: vor[vor.length - 1].beginn, quelle: "auto", herkunft: "nicht_erreicht_mail" });
      gebucht = !!bu.id && bu.quelle === "inkasso_call" && bu.vertretung === false;
    } catch (e) { console.log("    ", String((e as Error).message)); }
    ok("… Annahme: die Rollenwand lässt den Vertreter durch (wie ein Betreuer)", gebucht);
    let falsch = "";
    try {
      const roh505 = await termine.rohSlots([{ id: ANDERER, vorname: "HJ" }], 20);
      await termine.terminBuchen({ personId: PI, agentId: ANDERER, beginn: roh505.find(vorBis)!.beginn, quelle: "auto", herkunft: "nicht_erreicht_mail" });
    } catch (e) { falsch = String((e as any)?.code ?? ""); }
    ok("Rot-Probe: ein anderer Abwesender (505, Rolle agent) bleibt an der Rollenwand hängen", falsch === "falsche_rolle", falsch);
    await sqlPool`UPDATE fiaon_agents SET rolle = ${rolle531} WHERE id = 531`;
    await termine.verfuegbarkeitSetzen(531, zeiten531);
    rolle531 = null; zeiten531 = null;
  }
  {
    // Nur einzelne abwesend (10): ohne Betreuer Pool der Anwesenden; Kunde von 8 normal bei 8.
    await setzen(VERTRETER, [10]);
    const PB2 = await person({ betreuer: null, tier: 3 });
    const a = await termine.freieSlots(PB2, sqlPool, "auto");
    const b = await termine.freieSlots(PA, sqlPool, "auto");
    ok("nur 10 abwesend: Pool ohne 10 vor „bis“, keine Abwesenheits-Auskunft", !a.slots.some((s) => s.agentId === 10 && vorBis(s)) && !a.abwesenheit && a.slots.length > 0,
      Array.from(new Set(a.slots.filter(vorBis).map((s) => s.agentId))));
    ok("… Kunde von 8 (anwesend) bucht bei 8, Kopf nennt ihn", b.slots.every((s) => s.agentId === ABWESEND) && b.betreuer?.id === ABWESEND && !b.abwesenheit);
    // Aus: wie vor der Vertretung (Rot-Probe).
    await abw.abwesenheitSetzen({ an: false }, "Prüfstand Vertretung"); abw.abwesenheitVergessen();
    const c = await termine.freieSlots(PA, sqlPool, "auto");
    ok("Rot-Probe — Abwesenheit aus: Kunde von 8 sieht nur 8, Kopf nennt 8", c.slots.length > 0 && c.slots.every((s) => s.agentId === ABWESEND) && c.betreuer?.id === ABWESEND && !c.abwesenheit);
    await setzen(VERTRETER);
  }
  {
    const g = quelle("server/routes/fiaon-gruender-termin.ts"), gl = quelle("server/routes/fiaon-global-termin.ts") + quelle("server/lib/fiaon-global-termin.ts");
    ok("Gründer- und Global-Buchung laufen nicht über freieSlots (werden nie umgeleitet)", !/freieSlots\(/.test(g) && !/freieSlots\(/.test(gl));
  }

  // ═══ 2. Route ═══════════════════════════════════════════════════════════════
  abschnitt("2. Route /api/fiaon/termin (echter Router)");
  const express = (await import("express")).default;
  const router = (await import("../server/routes/fiaon-termin")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/fiaon", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server!.once("listening", r));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;
  const holen = async (pfad: string, init: RequestInit = {}) => {
    const r = await echtFetch(`${basis}${pfad}`, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  {
    const tok = termine.terminTokenErzeugen(PA);
    const g = await holen(`/termin/${tok}?anrede=sie&von=mara_whatsapp_link`);
    const vor = (g.json?.slots ?? []).filter(vorBis);
    // E-265: die Seite liest beide in der Nennform — „Herr Stripling ist bis … nicht im Haus — bis dahin ruft Sie Nikita Boychenko an".
    ok("GET: 200, Kopf ohne Betreuer, Vertretung „Nikita Boychenko“ für „Herr Stripling“ bis …", g.status === 200 && g.json?.betreuer === null
      && g.json?.vertretung?.anrufer === "Nikita Boychenko" && g.json?.vertretung?.betreuer === "Herr Stripling" && /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d\d\.\d\d\., \d\d:\d\d Uhr$/.test(String(g.json?.vertretung?.bis)),
      { status: g.status, betreuer: g.json?.betreuer, vertretung: g.json?.vertretung });
    ok("GET: vor „bis“ nur Plätze von 13", vor.length > 0 && vor.every((s: any) => s.agentId === VERTRETER));
    const wahl = vor[vor.length - 1];
    const p = await holen(`/termin/${tok}/buchen`, { method: "POST", body: JSON.stringify({ beginn: wahl.beginn, agentId: wahl.agentId, herkunft: "mara_whatsapp_link", anrede: "sie" }) });
    ok("POST: gebucht, die Seite nennt „Nikita Boychenko“ (Nennform)", p.status === 200 && p.json?.ok && p.json?.termin?.agentVorname === "Nikita Boychenko", p);
    const [t] = (await sqlPool`SELECT id, agent_id, notiz FROM fiaon_termine WHERE person_id = ${PA} AND status = 'gebucht' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Termin bei 13, Notiz „in Abwesenheit von Herrn Stripling, bei Nikita Boychenko“ (Nennform)", Number(t?.agent_id) === VERTRETER && /in Abwesenheit von Herrn Stripling, bei Nikita Boychenko\./.test(String(t?.notiz)), t);
    const [pa] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${PA}`) as any[];
    ok("Kunde bleibt bei Betreuer 8 (zuordnen: false)", Number(pa?.assigned_agent_id) === ABWESEND, pa);
    await warte(300);
    const [m] = (await sqlPool`SELECT payload FROM fiaon_mail_log WHERE person_id = ${PA} AND event = 'termin_bestaetigung' ORDER BY id DESC LIMIT 1`) as any[];
    const pl = typeof m?.payload === "string" ? JSON.parse(m.payload) : m?.payload;
    ok("Bestätigung nennt den Vertreter in der Nennform (agent_vorname, hinweis_anruf)", pl?.agent_vorname === "Nikita Boychenko" && /Nikita Boychenko/.test(String(pl?.hinweis_anruf ?? "")) && !/\bNikita\b(?! Boychenko)/.test(String(pl?.hinweis_anruf ?? "")), pl ? { agent_vorname: pl.agent_vorname, hinweis_anruf: pl.hinweis_anruf } : m);
    // Ein nicht angebotener Platz (Daniel vor „bis") wird abgelehnt.
    const PA2 = await person({ betreuer: ABWESEND });
    const roh8 = await termine.rohSlots([{ id: ABWESEND, vorname: "Daniel" }], 20);
    const tok2 = termine.terminTokenErzeugen(PA2);
    const f = await holen(`/termin/${tok2}/buchen`, { method: "POST", body: JSON.stringify({ beginn: roh8.find(vorBis)!.beginn, agentId: ABWESEND }) });
    ok("Rot-Probe: ein Platz des Abwesenden vor „bis“ → 409 nicht_angeboten", f.status === 409 && f.json?.grund === "nicht_angeboten", f);
    // Bestehender Termin bei einem Abwesenden: die Seite nennt den Vertreter — bei Global nicht.
    const tPA2 = roh8.filter(vorBis).slice(-1)[0].beginn;
    await terminDirekt({ personId: PA2, agentId: ABWESEND, beginn: tPA2 });
    const g2 = await holen(`/termin/${tok2}`);
    ok("bestehender Termin bei 8 vor „bis“: die Seite nennt „Nikita Boychenko“ (nom und dat)", g2.json?.termin?.agentVorname === "Nikita Boychenko" && g2.json?.termin?.agentDat === "Nikita Boychenko", g2.json?.termin);
    const PG = await person({ betreuer: ABWESEND });
    const tPG = roh8.filter(vorBis).reverse().find((s) => Math.abs(new Date(s.beginn).getTime() - new Date(tPA2).getTime()) >= 60 * 60_000)!.beginn;
    await terminDirekt({ personId: PG, agentId: ABWESEND, beginn: tPG, quelle: "global", dauer: 30 });
    const g3 = await holen(`/termin/${termine.terminTokenErzeugen(PG)}`);
    ok("… ein Global-Termin bei 8 nennt weiter „Herr Stripling“ / „mit Herrn Stripling“", g3.json?.termin?.agentVorname === "Herr Stripling" && g3.json?.termin?.agentDat === "Herrn Stripling", g3.json?.termin);
    // Ohne Betreuer: beim Vertreter kein Pin; nach „bis" im Pool pinnt es wie immer.
    const PB = await person({ betreuer: null, tier: 3 });
    const tokB = termine.terminTokenErzeugen(PB);
    const gb = await holen(`/termin/${tokB}`);
    const vB = (gb.json?.slots ?? []).filter(vorBis), nB = (gb.json?.slots ?? []).filter((s: any) => !vorBis(s));
    const pb = await holen(`/termin/${tokB}/buchen`, { method: "POST", body: JSON.stringify({ beginn: vB[0].beginn, agentId: vB[0].agentId }) });
    const [pbP] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${PB}`) as any[];
    const [pbT] = (await sqlPool`SELECT notiz FROM fiaon_termine WHERE person_id = ${PB} ORDER BY id DESC LIMIT 1`) as any[];
    ok("ohne Betreuer, gebucht bei 13: Kunde bleibt ohne Betreuer (kein Pin an den Vertreter), Notiz „in Abwesenheit des Teams“",
      pb.status === 200 && vB[0].agentId === VERTRETER && pbP?.assigned_agent_id == null && /in Abwesenheit des Teams, bei Nikita Boychenko/.test(String(pbT?.notiz)), { pb: pb.json, pbP, pbT });
    const PB3 = await person({ betreuer: null, tier: 3 });
    const tokB3 = termine.terminTokenErzeugen(PB3);
    const nach = nB.find((s: any) => s.agentId !== VERTRETER) ?? nB[0];
    const pb3 = await holen(`/termin/${tokB3}/buchen`, { method: "POST", body: JSON.stringify({ beginn: nach.beginn, agentId: nach.agentId }) });
    const [pb3P] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${PB3}`) as any[];
    const [pb3T] = (await sqlPool`SELECT notiz FROM fiaon_termine WHERE person_id = ${PB3} ORDER BY id DESC LIMIT 1`) as any[];
    ok("Rot-Probe: nach „bis“ im Pool gebucht → pinnt wie immer, keine Vertretungs-Notiz", pb3.status === 200 && Number(pb3P?.assigned_agent_id) === Number(nach.agentId) && !pb3T?.notiz,
      { pb3: pb3.json, pb3P, nach });
    // Gegenprüfung: gesperrter/Test-Betreuer → die Seite sagt nicht „927 ist bis … nicht im Haus".
    const gT = await holen(`/termin/${termine.terminTokenErzeugen(await person({ betreuer: 927 }))}`);
    ok("GET, Kunde eines gesperrten Test-Betreuers (927): Vertretung ohne Betreuer — die Seite schweigt", gT.status === 200 && gT.json?.vertretung?.anrufer === "Nikita Boychenko" && gT.json?.vertretung?.betreuer === null, gT.json?.vertretung);

    // ── Gegenprüfung: „Termin verpasst" und „Termin verschoben" nennen den, der anruft ──
    const keks = async (id: number) => {
      const [ag] = (await sqlPool`SELECT session_epoch FROM fiaon_agents WHERE id = ${id}`) as any[];
      const nutz = `${id}.${Number(ag?.session_epoch ?? 0)}.${Date.now() + 30 * 60_000}`;
      return `fiaon_agent_token=${nutz}.${createHmac("sha256", process.env.SESSION_SECRET!).update(`agent2:${nutz}`).digest("hex").slice(0, 40)}`;
    };
    const mailVon = async (personId: number, event: string) => {
      await warte(300);
      const [m] = (await sqlPool`SELECT payload FROM fiaon_mail_log WHERE person_id = ${personId} AND event = ${event} ORDER BY id DESC LIMIT 1`) as any[];
      return (typeof m?.payload === "string" ? JSON.parse(m.payload) : m?.payload) ?? null;
    };
    const PV = await person({ betreuer: ABWESEND });
    // mailSenden schickt nur Kunden mit einer nicht archivierten Bestellung.
    const refV = `${MARKE}-V`; refs.push(refV);
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status, payment_status, assigned_agent_id) VALUES (${refV}, ${PV}, ${refV}, 'submitted', 'paid', ${ABWESEND})`;
    const tV = await terminDirekt({ personId: PV, agentId: ABWESEND, beginn: new Date(Date.now() - 60 * 60_000) });
    const rV = await holen(`/agent/termine/${tV}/nicht-zustande`, { method: "POST", headers: { cookie: await keks(VERTRETER) }, body: JSON.stringify({ grund: "nicht_erschienen" }) });
    const mV = await mailVon(PV, "termin_verpasst");
    ok("„Termin verpasst“ (Termin bei 8 in der Abwesenheit, Nikita meldet ihn über die Route): die Mail nennt „Nikita Boychenko“",
      rV.status === 200 && rV.json?.ok && mV?.agent_vorname === "Nikita Boychenko", { r: rV.json, agent_vorname: mV?.agent_vorname });
    const ms = await import("../server/lib/fiaon-mail-senden");
    const sV = await ms.sendePayloadBauen("termin_verpasst", PV);
    ok("… Sende-Menü (sendePayloadBauen, ohne Zusatz): ebenfalls „Nikita Boychenko“", { ...sV?.basis, ...sV?.links }.agent_vorname === "Nikita Boychenko", sV?.links);
    const PVg = await person({ betreuer: ABWESEND });
    const tVg = await terminDirekt({ personId: PVg, agentId: ABWESEND, beginn: new Date(Date.now() - 3 * 60 * 60_000), quelle: "gruender" });
    await sqlPool`UPDATE fiaon_termine SET status = 'verpasst' WHERE id = ${tVg}`;
    const sVg = await ms.sendePayloadBauen("termin_verpasst", PVg);
    ok("Rot-Probe: verpasstes Gründer-Gespräch nennt den Gebuchten („Herr Stripling“), nie den Vertreter", sVg?.links.agent_vorname === "Herr Stripling", sVg?.links);
    ok("… auch der Onboarding-Weg (nicht erschienen) fragt anruferFuer", /anruferFuer\(Number\(k\.agent_id\), beginn/.test(quelle("server/routes/fiaon-onboarding-bereich.ts")));

    const belegt8 = (await sqlPool`SELECT beginn FROM fiaon_termine WHERE agent_id = ${ABWESEND} AND status = 'gebucht' AND beginn > NOW()`) as any[];
    const frei8 = roh8.filter((s) => belegt8.every((b) => Math.abs(new Date(b.beginn).getTime() - new Date(s.beginn).getTime()) >= 60 * 60_000));
    const frei8vor = frei8.filter(vorBis), frei8nach = frei8.filter((s) => !vorBis(s));
    const PS = await person({ betreuer: ABWESEND });
    const tS = await terminDirekt({ personId: PS, agentId: ABWESEND, beginn: frei8vor[0].beginn });
    const rS = await holen(`/agent/termine/${tS}/verschieben`, { method: "POST", headers: { cookie: await keks(ABWESEND) }, body: JSON.stringify({ beginn: frei8vor[frei8vor.length - 1].beginn }) });
    const mS = await mailVon(PS, "termin_bestaetigung");
    ok("Verschieben auf eine Zeit vor „bis“ (Termin bei 8): die Bestätigung nennt „Nikita Boychenko“", frei8vor.length >= 2 && rS.status === 200 && mS?.agent_vorname === "Nikita Boychenko" && !!mS?.verschoben_von,
      { r: rS.json, agent_vorname: mS?.agent_vorname, n: frei8vor.length });
    const PS2 = await person({ betreuer: ABWESEND });
    const tS2 = await terminDirekt({ personId: PS2, agentId: ABWESEND, beginn: frei8vor[1]?.beginn ?? frei8vor[0].beginn });
    const rS2 = await holen(`/agent/termine/${tS2}/verschieben`, { method: "POST", headers: { cookie: await keks(ABWESEND) }, body: JSON.stringify({ beginn: frei8nach[0].beginn }) });
    const mS2 = await mailVon(PS2, "termin_bestaetigung");
    ok("Rot-Probe: verschoben auf eine Zeit NACH „bis“ → die Bestätigung nennt „Herr Stripling“", rS2.status === 200 && mS2?.agent_vorname === "Herr Stripling", { r: rS2.json, agent_vorname: mS2?.agent_vorname });
  }
  server.close(); server = null;
  {
    // Die Mails „Termin buchen“ (nicht erreicht, Einladung …) nennen den, der bis „bis“ anruft.
    const ms = await import("../server/lib/fiaon-mail-senden");
    const PM = await person({ betreuer: ABWESEND });
    const m1 = await ms.sendePayloadBauen("nicht_erreicht_termin", PM);
    ok(`Mail „nicht erreicht — Termin buchen“: agent_vorname = Vertreter (${m1?.basis.agent_vorname}), Terminlink dabei`,
      m1?.basis.agent_vorname === "Nikita Boychenko" && /\/termin\//.test(String(m1?.links.termin_link ?? "")), m1 ? { a: m1.basis.agent_vorname, l: m1.links.termin_link } : null);
    const PMN = await person({ betreuer: VERTRETER });
    ok("… eigener Kunde des Vertreters: sein Name wie immer", (await ms.sendePayloadBauen("nicht_erreicht_termin", PMN))?.basis.agent_vorname === "Nikita Boychenko");
    await abw.abwesenheitSetzen({ an: false }, "Prüfstand Vertretung"); abw.abwesenheitVergessen();
    ok("Rot-Probe — Abwesenheit aus: die Mail nennt den Betreuer in der Nennform („Herr Stripling“)", (await ms.sendePayloadBauen("nicht_erreicht_termin", PM))?.basis.agent_vorname === "Herr Stripling");
    await setzen(VERTRETER);
  }

  // ═══ 3. Maras Übergaben (WhatsApp) ═════════════════════════════════════════
  abschnitt("3. Maras Übergaben auf WhatsApp → an den Vertreter");
  const wa = await import("../server/lib/fiaon-whatsapp-mara");
  {
    const P1 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700001", P1, null, `Kunde bittet um Rückruf heute Nachmittag ${MARKE}`, false, "rueckruf");
    const a1 = await aufgabenVon(P1);
    ok("Rückruf-Wunsch: Aufgabe bei 13, keine Kopie aufs Board", a1.length === 1 && anVertreter(a1[0]) && !a1.some(istKopie), a1);
    const [pr] = (await sqlPool`SELECT text, daten FROM fiaon_mara_protokoll WHERE person_id = ${P1} AND art = 'uebergabe' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Protokoll: „Aufgabe an Nikita Boychenko (Vertretung bis …)“", /^Aufgabe an Nikita Boychenko \(Vertretung bis /.test(String(pr?.text)), pr?.text);

    const P2 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700002", P2, null, `Ich will kündigen, sonst geht das zum Anwalt ${MARKE}`, true, "heikel");
    const a2 = await aufgabenVon(P2);
    ok("Heikel (Kündigung/Anwalt): bei 13 UND als Kopie aufs Board", a2.some((x) => anVertreter(x) && !istKopie(x)) && a2.some((x) => aufsBoard(x) && istKopie(x) && /^Zur Kenntnis \(heikel\)/.test(x.titel)), a2);
    await wa.aufgabeFuerMenschen("4915177700002", P2, null, `Nachtrag zur Kündigung ${MARKE}`, true, "heikel");
    const a2b = await aufgabenVon(P2);
    ok("… eine zweite Nachricht hängt sich an (keine neuen Karten)", a2b.length === a2.length, { vorher: a2.length, nachher: a2b.length });

    const P3 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700003", P3, null, `Kunde bestreitet Antrag ${MARKE}`, true, "bestreitet", { leitung: true });
    const a3 = await aufgabenVon(P3);
    ok("Bestreiten (an die Leitung): bei 13 statt Leitung 8, Kopie aufs Board", a3.some((x) => anVertreter(x) && !istKopie(x)) && a3.some((x) => aufsBoard(x) && istKopie(x)) && !a3.some((x) => Number(x.zustaendig_agent_id) === ABWESEND), a3);

    await wa.aufgabeFuerMenschen("4915177700009", null, null, `Unbekannte Nummer fragt nach dem Antrag ${MARKE}`, false, "anliegen");
    const a4 = await aufgabenVon(null, "4915177700009");
    // E-IT-H (08.10.2026): Der Link trägt die Nummer — der Raum öffnet genau dieses Gespräch.
    ok("ohne Person: bei 13, Link in den WhatsApp-Raum des Mitarbeiters (mit ?nummer=)", a4.length === 1 && anVertreter(a4[0]) && a4[0].link === "/agent/whatsapp?nummer=4915177700009", a4);

    const PN = await person({ betreuer: VERTRETER });
    await wa.aufgabeFuerMenschen("4915177700010", PN, null, `Eigener Kunde von Nikita ${MARKE}`, false, "anliegen");
    const a5 = await aufgabenVon(PN);
    ok("eigener Kunde des Vertreters: bei 13", a5.length === 1 && anVertreter(a5[0]), a5);

    // Gegenprüfung: Die Board-Kopie hält sich an `still` — wie die Aufgabe selbst.
    const P8 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700011", P8, null, `Kunde bestreitet den Antrag ${MARKE}`, true, "bestreitet");
    const k8 = (await aufgabenVon(P8)).find(istKopie);
    if (k8) await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE id = ${k8.id}`;
    await wa.aufgabeFuerMenschen("4915177700011", P8, null, `Noch eine Nachricht dazu ${MARKE}`, false, "bestreitet");
    const [k8b] = k8 ? (await sqlPool`SELECT status, text FROM fiaon_betreiber_todos WHERE id = ${k8.id}`) as any[] : [];
    ok("Board-Kopie (bestreitet): die zweite Nachricht hängt still an — erledigt bleibt erledigt", !!k8 && k8b?.status === "erledigt" && /Noch eine Nachricht dazu/.test(String(k8b?.text)), { k8, k8b });
    const P9 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700012", P9, null, `Ich kündige ${MARKE}`, true, "heikel");
    const k9 = (await aufgabenVon(P9)).find(istKopie);
    if (k9) await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE id = ${k9.id}`;
    await wa.aufgabeFuerMenschen("4915177700012", P9, null, `Und zwar sofort ${MARKE}`, true, "heikel");
    const [k9b] = k9 ? (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE id = ${k9.id}`) as any[] : [];
    ok("Rot-Probe: „heikel“ (nie still) öffnet die Kopie wieder — wie die Aufgabe selbst", !!k9 && k9b?.status === "offen", { k9, k9b });

    // Vertreter = Betreiber: Board wie E-260, keine Kopie.
    await setzen(BETREIBER);
    const P6 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700006", P6, null, `Ich kündige ${MARKE}`, true, "heikel");
    const a6 = await aufgabenVon(P6);
    ok("Vertreter = Betreiber (928): Aufgabe auf dem Board, keine zweite Karte", a6.length === 1 && aufsBoard(a6[0]) && !istKopie(a6[0]), a6);
    // Aus: an den Betreuer.
    await abw.abwesenheitSetzen({ an: false }, "Prüfstand Vertretung"); abw.abwesenheitVergessen();
    const P7 = await person({ betreuer: ABWESEND });
    await wa.aufgabeFuerMenschen("4915177700007", P7, null, `Rückruf bitte ${MARKE}`, false, "rueckruf");
    const a7 = await aufgabenVon(P7);
    ok("Rot-Probe — Abwesenheit aus: Aufgabe beim Betreuer 8", a7.length === 1 && Number(a7[0].zustaendig_agent_id) === ABWESEND, a7);
    await setzen(VERTRETER);
  }

  // ═══ 4. Postfach ════════════════════════════════════════════════════════════
  abschnitt("4. Postfach (Postmeister) → an den Vertreter");
  const pw = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const pl = await import("../server/lib/fiaon-postmeister-lauf");
  {
    const k = (personId: number) => ({ personId, ref: null, postfach: "support@fiaon.com", postmeisterId: null, kundenlage: "unbezahlt" as any });
    const Q1 = await person({ betreuer: ABWESEND });
    const e1 = await pw.aufgabeAnBetreuer.ausfuehren({ titel: `Unterlagen prüfen ${MARKE}`, text: `Kunde hat Kontoauszüge geschickt ${MARKE}.`, faellig_in_tagen: 1, dringend: false, kollege: "", rueckruf_am: "" }, k(Q1) as any);
    const q1 = await aufgabenVon(Q1);
    ok("aufgabe_an_betreuer: bei 13, Kunde liest „Nikita Boychenko meldet sich …“", e1.ok && q1.length === 1 && anVertreter(q1[0]) && /^Nikita Boychenko meldet sich/.test(e1.ergebnis), { e1: e1.ergebnis, q1 });
    const Q2 = await person({ betreuer: ABWESEND });
    await pw.aufgabeAnBetreuer.ausfuehren({ titel: `Geld zurück? ${MARKE}`, text: `Kunde will sein Geld zurück (Widerruf) ${MARKE}.`, faellig_in_tagen: 0, dringend: true, kollege: "Leitung", rueckruf_am: "" }, k(Q2) as any);
    const q2 = await aufgabenVon(Q2);
    ok("… „Leitung“ (8 abwesend): bei 13 + Kopie aufs Board", q2.some((x) => anVertreter(x)) && q2.some((x) => aufsBoard(x) && istKopie(x)) && !q2.some((x) => Number(x.zustaendig_agent_id) === ABWESEND), q2);
    const Q3 = await person({ betreuer: ABWESEND });
    await pw.notizAnBetreuer.ausfuehren({ text: `Kunde droht mit dem Anwalt wegen der Mahnung ${MARKE}`, dringend: true, anrufen: false }, k(Q3) as any);
    const q3 = await aufgabenVon(Q3);
    ok("notiz_an_betreuer (Anwaltsdrohung): bei 13 + Kopie aufs Board", q3.some((x) => anVertreter(x)) && q3.some((x) => aufsBoard(x) && istKopie(x)), q3);
    const Q4 = await person({ betreuer: ABWESEND });
    await pw.notizAnBetreuer.ausfuehren({ text: `Kunde hat seinen Ausweis hochgeladen ${MARKE}`, dringend: false, anrufen: false }, k(Q4) as any);
    const q4 = await aufgabenVon(Q4);
    ok("… gewöhnliche Notiz: nur bei 13, keine Kopie", q4.length === 1 && anVertreter(q4[0]), q4);
    const Q5 = await person({ betreuer: ABWESEND });
    await pl.anBetreuerUebergeben({ id: 990001, personId: Q5, ref: null, postfach: "support@fiaon.com", betreff: `Frage ${MARKE}`, zusammenfassung: `Kunde fragt nach dem Stand ${MARKE}`, grund: "Rückfrage", dringend: false });
    const q5 = await aufgabenVon(Q5);
    ok("Übergabe aus dem Postfach-Lauf (anBetreuerUebergeben): bei 13 statt beim abwesenden Betreuer", q5.length === 1 && anVertreter(q5[0]), q5);
    const Q6 = await person({ betreuer: ABWESEND });
    await pl.anBetreuerUebergeben({ id: 990002, personId: Q6, ref: null, postfach: "support@fiaon.com", betreff: `Widerruf ${MARKE}`, zusammenfassung: `Kunde widerruft den Vertrag ${MARKE}`, grund: "Widerruf", dringend: true });
    const q6 = await aufgabenVon(Q6);
    ok("… Widerruf: bei 13 + Kopie aufs Board", q6.some((x) => anVertreter(x)) && q6.some((x) => aufsBoard(x) && istKopie(x)), q6);
    const Q7 = await person({ betreuer: ANDERER });
    await pl.anBetreuerUebergeben({ id: 990003, personId: Q7, ref: null, postfach: "support@fiaon.com", betreff: `Frage ${MARKE}`, zusammenfassung: `Kunde von 505 ${MARKE}`, grund: "Rückfrage", dringend: false });
    ok("… auch für Kunden eines anderen Abwesenden (505)", (await aufgabenVon(Q7)).some(anVertreter));

    // ── Gegenprüfung: Rückruf-Wunsch aus der Mail — vor „bis" beim Vertreter, DANACH beim Betreuer (E-260) ──
    const wand = (d: Date) => {
      const t: Record<string, string> = {};
      for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) t[x.type] = x.value;
      return `${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute}`;
    };
    const r8 = new Set((await termine.rohSlots([{ id: ABWESEND, vorname: "D" }], 20)).map((s) => s.beginn));
    const r13 = await termine.rohSlots([{ id: VERTRETER, vorname: "N" }], 20);
    const nachBis = r13.filter((s) => new Date(s.beginn).getTime() > bis.getTime() + 3_600_000 && r8.has(s.beginn));
    const rueckruf = async (betreuer: number | null, zeit: string) => {
      const Q = await person({ betreuer });
      const e = await pw.aufgabeAnBetreuer.ausfuehren({ titel: `Rückruf ${MARKE}`, text: `Bitte rufen Sie mich an ${MARKE}.`, faellig_in_tagen: 1, dringend: false, kollege: "", rueckruf_am: wand(new Date(zeit)) }, k(Q) as any);
      const [t] = (await sqlPool`SELECT agent_id FROM fiaon_termine WHERE person_id = ${Q} AND status = 'gebucht' ORDER BY id DESC LIMIT 1`) as any[];
      return { Q, e, agent: t ? Number(t.agent_id) : null };
    };
    const n1 = await rueckruf(ABWESEND, nachBis[0].beginn);
    // E-265: der Kunde liest die Nennform des Betreuers („… ruft Herr Stripling an"), nie „Daniel".
    ok("Rückruf-Wunsch NACH „bis“ (Vertreter 13): Termin beim Betreuer 8, Kunde liest „… ruft Herr Stripling an“, Aufgabe bei 13",
      n1.agent === ABWESEND && /ruft Herr Stripling an/.test(n1.e.ergebnis) && !/\bDaniel\b/.test(n1.e.ergebnis) && (await aufgabenVon(n1.Q)).some(anVertreter), { agent: n1.agent, e: n1.e.ergebnis });
    const vorPlatz = (await abw.freiePlaetzeVertreter((await abw.abwesenheitJetzt())!, 20)).find((s) => new Date(s.beginn).getTime() > Date.now() + 3 * 3_600_000)!;
    const v1 = await rueckruf(ABWESEND, vorPlatz.beginn);
    ok("… Wunsch VOR „bis“: Termin beim Vertreter 13", v1.agent === VERTRETER && /Der Rückruf steht im Kalender/.test(v1.e.ergebnis), { agent: v1.agent, e: v1.e.ergebnis });
    const o1 = await rueckruf(null, nachBis[1]?.beginn ?? nachBis[0].beginn);
    ok("… ohne Betreuer, Wunsch nach „bis“: beim Aufgaben-Empfänger (Vertreter 13)", o1.agent === VERTRETER, { agent: o1.agent, e: o1.e.ergebnis });
    await setzen(BETREIBER);
    const b1 = await rueckruf(ABWESEND, nachBis[2]?.beginn ?? nachBis[0].beginn);
    ok("Rot-Probe — Vertreter 928: nach „bis“ ebenfalls beim Betreuer 8 (wie E-260)", b1.agent === ABWESEND && /ruft Herr Stripling an/.test(b1.e.ergebnis), { agent: b1.agent, e: b1.e.ergebnis });
    await setzen(VERTRETER);

    // Gegenprüfung: Zahlungsverweigerung (Eskalation) ist heikel — bei 13 UND als Kopie aufs Board.
    const QE = await person({ betreuer: ABWESEND });
    await pw.eskalationVorbereiten.ausfuehren({ zitat: `Ich zahle keinen Cent ${MARKE}` }, k(QE) as any);
    const qe = (await sqlPool`SELECT zustaendig_art, zustaendig_agent_id, schluessel FROM fiaon_betreiber_todos WHERE created_at >= ${START} AND schluessel LIKE ${`postmeister:eskalation:${QE}%`}`) as any[];
    ok("Eskalation „Zahlung verweigert“: bei 13 + Kopie aufs Board", qe.some(anVertreter) && qe.some((x) => aufsBoard(x) && istKopie(x)), qe);
  }

  // ═══ 5. Zugriff ════════════════════════════════════════════════════════════
  abschnitt("5. Zugriff: Akte und WhatsApp-Raum");
  {
    const kz = await import("../server/lib/fiaon-kundenzugriff");
    const PZ = await person({ betreuer: ABWESEND });
    ok("Akte: der Vertreter darf an den Kunden eines Abwesenden", await kz.darfAnKunde(VERTRETER, "agent", PZ));
    ok("Rot-Probe: ein anderer Mitarbeiter (505) nicht", !(await kz.darfAnKunde(ANDERER, "agent", PZ)));
    const ab = (await abw.abwesenheitJetzt())!;
    ok("WhatsApp-Raum (rein): Vertreter sieht 8 und ohne Betreuer, 505 nicht; nur 10 abwesend → 8 nicht",
      abw.vertreterSiehtBetreuer(ab, VERTRETER, ABWESEND) && abw.vertreterSiehtBetreuer(ab, VERTRETER, null)
      && !abw.vertreterSiehtBetreuer(ab, ANDERER, ABWESEND) && !abw.vertreterSiehtBetreuer({ ...ab, fuer: [10] }, VERTRETER, ABWESEND)
      && !abw.vertreterSiehtBetreuer({ ...ab, fuer: [10] }, VERTRETER, null) && !abw.vertreterSiehtBetreuer(null, VERTRETER, ABWESEND));
    const raum = quelle("server/routes/fiaon-whatsapp-postfach.ts");
    ok("WhatsApp-Raum: Liste, Nummer, Suche und Start fragen sichtFuer (kein harter Besitzfilter mehr)",
      (raum.match(/sichtFuer\(blick\)/g) ?? []).length >= 4 && !/Number\(z\.assigned_agent_id \?\? z\.lead_agent \?\? 0\) === blick\.agentId/.test(raum)
      && !/Number\(z\?\.agent \?\? 0\) !== blick\.agentId/.test(raum));
    await abw.abwesenheitSetzen({ an: false }, "Prüfstand Vertretung"); abw.abwesenheitVergessen();
    ok("Rot-Probe — Abwesenheit aus: der Vertreter darf nicht mehr an den fremden Kunden", !(await kz.darfAnKunde(VERTRETER, "agent", PZ)));
    await setzen(VERTRETER);
  }

  // ═══ 6. Übersicht und reine Regeln ═════════════════════════════════════════
  abschnitt("6. Übersicht, reine Regeln, Quelltext");
  {
    const { terminUebersicht } = await import("../server/lib/fiaon-termin-uebersicht");
    const u = await terminUebersicht({ chefAgentId: BETREIBER });
    ok("Reiter „Termine“: neue Übergaben gehen an Nikita Boychenko", u.uebergaben.neueAn?.art === "vertreter" && u.uebergaben.neueAn?.name === "Nikita Boychenko", u.uebergaben);
    const zeilen = u.termine.filter((t) => personen.includes(t.person.id) && t.bei.id === ABWESEND && t.status === "gebucht");
    const glob = zeilen.filter((t) => /Global/i.test(t.art.text));
    ok("… Marke „Betreuer abwesend“ an normalen Terminen von 8, nie an Global-Terminen",
      zeilen.some((t) => t.beiAbwesendem) && glob.length > 0 && glob.every((t) => !t.beiAbwesendem), zeilen.map((t) => [t.art.text, t.beiAbwesendem]));
    ok("heikleUebergabe: Kündigung, Widerruf, Anwalt, Beschwerde, Löschen, Gericht, bestreitet — ja",
      ["Ich kündige", "Widerruf", "gehe zum Anwalt", "Beschwerde", "bitte meine Daten löschen", "wir sehen uns vor Gericht", "Kunde bestreitet Antrag"].every((t) => abw.heikleUebergabe(t)));
    ok("… Rückruf, Unterlagen, „ausgerichtet“ — nein", ["Bitte um Rückruf", "Ausweis hochgeladen", "Termin ausgerichtet auf morgen"].every((t) => !abw.heikleUebergabe(t)));
    const jaG = ["Kunde verweigert die Zahlung", "Zahlung verweigert — Anruf vor Eskalation", "Ich zahle nichts mehr", "Vertragskündigung", "Bitte stornieren Sie meinen Vertrag",
      "Storno bitte", "Ich werde Sie verklagen", "gerichtlich vorgehen", "Kunde möchte, dass seine Daten gelöscht werden", "Konto löschen bitte", "Rückerstattung der 49 €",
      "Erstatten Sie mir den Betrag", "Ich habe nie etwas beantragt", "Verbraucherzentrale eingeschaltet", "Das ist Abzocke"];
    ok("heikleUebergabe (Gegenprüfung): Zahlungsverweigerung, Storno des Vertrags, Klage, Daten/Konto löschen, Geld zurück — ja",
      jaG.every((t) => abw.heikleUebergabe(t)), jaG.filter((t) => !abw.heikleUebergabe(t)));
    const neinG = ["Termin stornieren", "Klagenfurt", "an Daniel gerichtet", "Nummer gelöscht", "Erstattung der Auslagen", "Wie angekündigt, die Unterlagen",
      "Kunde möchte seine SCHUFA-Daten löschen lassen", "seine Daten aus der SCHUFA löschen", "Termin-Storno", "Max Löscher: Rückfrage", "Karte noch nicht bestellt"];
    ok("… Fehltreffer der ersten Fassung („Termin stornieren“, „Klagenfurt“, „gerichtet“, „Nummer gelöscht“, „Erstattung der Auslagen“ …) — nein",
      neinG.every((t) => !abw.heikleUebergabe(t)), neinG.filter((t) => abw.heikleUebergabe(t)));
    ok("quelleUmleitbar: gruender/global nein, sonst ja", !abw.quelleUmleitbar("gruender") && !abw.quelleUmleitbar("global") && abw.quelleUmleitbar("nichterreicht_mail") && abw.quelleUmleitbar(null));
    ok("WhatsApp: heikle Klassen = heikel, bestreitet, loeschen, in_ruhe, wut", ["heikel", "bestreitet", "loeschen", "in_ruhe", "wut"].every((k) => wa.HEIKLE_KLASSEN.has(k as any)) && !wa.HEIKLE_KLASSEN.has("rueckruf"));
    const cl = quelle("CHANGELOG.md");
    ok("CHANGELOG nennt die Vertretung (01.10.2026)", /Vertretung \(01\.10\.2026\)/.test(cl));
    const rg = quelle("client/src/pages/agent/rundgaenge.ts");
    ok("Rundgang „Termine“ erklärt Übergaben an den Vertreter und die Terminseite", /Übergaben bekommt der Vertreter/.test(rg) && /Terminseite/.test(rg));
  }
} catch (e) {
  ok("Prüfstand ohne Ausnahme durchgelaufen", false, String((e as Error)?.stack ?? e).slice(0, 1200));
} finally {
  if (server) server.close();
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  ok("kein fremder Netzaufruf (nur Brevo-Attrappe)", FREMD.length === 0, FREMD);
  console.log(`\nVertretung (01.10.2026): ${gruen} ok, ${rot} rot${rot ? `\n  ${fehler.join("\n  ")}` : ""}`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(rot ? 1 : 0);
}
