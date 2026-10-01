// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARAS TERMINE UND „TEAM ABWESEND" (29.09.2026, E-260)
//
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können als Chef auf
// einer eigenen übersichtlichen cleanen Seite … Die anderen Mitarbeiter
// arbeiten erst wieder am Freitag. Bis dahin schupfe ich das ganze."
// Regeln: server/lib/fiaon-abwesenheit.ts, fiaon-termin-uebersicht.ts,
// fiaon-termin-ergebnis.ts, fiaon-mara-termin.ts (freieZeiten, rueckrufBuchen,
// terminLesen, terminlinkFuer), shared/fiaon-termin-uebersicht.ts.
//
//   1. Rein: Gruppen (genau ein „jetzt": fälliger Termin vor wartendem Kunden vor dem nächsten —
//      Gegenprüfung 29.09.), wartet nach Stufe/Betrag, Berliner Tage, Filter, Überschneidung,
//      zusagePasst, stufeAusTier, Klartext „verschoben".
//   2. Abwesenheit aus: Mara bucht beim Betreuer (weg „betreuer").
//   3. Setzen mit Klartext-Absagen (keine Zeiten, gesperrt, vorbei, > 14 Tage) — dann an.
//   4. An: Plätze vor „bis" nur beim Vertreter, danach beim Betreuer; Termine der
//      Abwesenden gelten beim Vertreter als belegt (B4) — Rot-Probe über „fuer".
//   5. Buchen: beim Vertreter, herkunft mara_whatsapp, Kunde bleibt beim Betreuer,
//      ohne Betreuer KEIN Pin (B10), gesperrter Betreuer: Person UND Antrag bleiben
//      (Gegenprüfung 29.09.) — Rot-Proben: buchungAnwenden ohne { zuordnen: false }
//      pinnt bzw. hängt samt Antrag an 928 um.
//   5b. Nach „bis" der normale Weg (Gegenprüfung 29.09.): ohne Betreuer Pool-Plätze
//      ab „bis", Buchung dort; „bis" in 15 Min. keine Sackgasse; „nicht frei" nach
//      „bis" nennt den Betreuer; „nur einzelne" → Pool der Anwesenden.
//   6. Namen (B2): bestehende Termine bei Abwesenden nennen den Vertreter, nach „bis"
//      den Betreuer; Werkzeug-Satz, Lage, Postmeister, Absagesperre bleiben wahr.
//   7. Terminlink bei Abwesenheit: kein Link, stattdessen freie_zeiten.
//   8. Verschieben (B8): alter Termin „verschoben", KEINE Absagemail an den Kunden,
//      Zeit wieder frei — Rot-Probe: „agent" schickt sie.
//   9. Postmeister: Rückruf aus einer Mail landet beim Vertreter (Raster), Aufgabe aufs Board.
//  10. Ablauf und Aus: „bis" vorbei → aus und „abgelaufen" im Verlauf; Aus → „beendet";
//      nur für einzelne → die anderen buchen normal.
//  11. Route GET /chef/mara/termine (echter Router, Chef-Cookie): Gruppen, Marken,
//      Zusage aus fiaon_whatsapp (nur ab der Buchung, nur eine Uhrzeit — ein Angebot
//      30 s vorher nie; verschoben → Marke statt Zitat), offener verpasster Termin
//      von vor 6 Tagen unter „wartet", Stufe „abbrecher", Anliegen aus der Mail-
//      Notiz, Überschneidung, ohne Testpersonen.
//  12. Routen POST …/ergebnis (Erledigt ohne Kundenwechsel, B7: bleibt nach dem
//      12-Stunden-Lauf erledigt — Rot-Probe: ohne Abschluss wird er „verpasst";
//      Startgespräch 409) und POST /chef/mara/abwesenheit (Protokollzeile, 409).
//
// NUR gegen die lokale Test-DB (Struktur-Kopie, keine Kunden). Kein Netz: Brevo
// ist eine Attrappe (fetch abgefangen), WhatsApp und Make ohne Schlüssel.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e260?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-termine.ts
// Eigene Datensätze (Personen PRUEF260-…, Nummern 49151260xxxxx) werden am Ende entfernt.
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
    return new Response(JSON.stringify({ messageId: `<e260-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { createHmac, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 700)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { sqlPool } = await import("../server/lib/db-pool");
const abw = await import("../server/lib/fiaon-abwesenheit");
const mt = await import("../server/lib/fiaon-mara-termin");
const termine = await import("../server/lib/fiaon-termine");
const ueb = await import("../shared/fiaon-termin-uebersicht");
const { berlinDatum, berlinZeitpunkt } = await import("../server/lib/fiaon-time");

const MARKE = `PRUEF260-${Date.now().toString(36)}`;
const VERTRETER = 928;
const BETREUER = 13;
const personen: number[] = [];
const termineIds: number[] = [];
const refs: string[] = [];
let server: import("node:http").Server | null = null;

/** „YYYY-MM-DD HH:MM" in Berlin — so, wie Mara Zeiten an rueckrufBuchen gibt. */
const wand = (iso: string | Date) => {
  const d = new Date(iso);
  const t: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) t[p.type] = p.value;
  return `${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute}`;
};

async function person(ein: { betreuer?: number | null; tier?: number; grund?: string | null; email?: string | null; test?: boolean; nummer?: string | null; name?: string }): Promise<number> {
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason, primary_email, primary_phone, ist_test_am)
    VALUES (${`${MARKE}-${personen.length + 1}`}, ${ein.name ?? "Pruef"}, ${`Kunde${personen.length + 1}`}, ${ein.betreuer ?? null}, ${ein.tier ?? 2},
            ${ein.grund ?? "nur_lead"}, ${ein.email ?? null}, ${ein.nummer ?? null}, ${ein.test ? new Date() : null})
    RETURNING id`) as any[];
  personen.push(Number(p.id));
  return Number(p.id);
}
async function terminDirekt(ein: { personId: number; agentId: number; beginn: Date | string; status?: string; quelle?: string; herkunft?: string | null; notiz?: string | null }): Promise<{ id: number; storno: string }> {
  const storno = randomBytes(12).toString("hex");
  const [t] = (await sqlPool`
    INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token, herkunft, notiz)
    VALUES (${ein.personId}, ${ein.agentId}, ${new Date(ein.beginn)}, 20, ${ein.status ?? "gebucht"}, ${ein.quelle ?? "agent_manuell"}, ${storno},
            ${ein.herkunft ?? null}, ${ein.notiz ?? null})
    RETURNING id`) as any[];
  termineIds.push(Number(t.id));
  return { id: Number(t.id), storno };
}

/**
 * Plätze ohne Überschneidung mit einem gebuchten Termin des Mitarbeiters (mit Dauer) — rohSlots kennt
 * nur „gleicher Beginn", die Datenbank-Sperre fiaon_termine_keine_ueberschneidung jede Überschneidung
 * (Gegenprüfung 29.09.: mittags lag Nikitas nächster Platz 13:50 über dem 14:00-Termin aus Abschnitt 4).
 */
async function ohneUeberschneidung(agentId: number, slots: { beginn: string }[]): Promise<any[]> {
  const bel = (await sqlPool`SELECT beginn, COALESCE(dauer_min, 20) AS d FROM fiaon_termine WHERE agent_id = ${agentId} AND status = 'gebucht'`) as any[];
  return slots.filter((x) => {
    const von = new Date(x.beginn).getTime();
    return !bel.some((b) => { const bv = new Date(b.beginn).getTime(); return bv < von + 20 * 60_000 && bv + Number(b.d) * 60_000 > von; });
  });
}

async function aufraeumen(): Promise<void> {
  const ids = personen.length ? personen : [0];
  await sqlPool`DELETE FROM fiaon_testkonto_warnungen WHERE tabelle = 'fiaon_termine' AND datensatz_id IN (SELECT id::text FROM fiaon_termine WHERE person_id = ANY(${ids}))`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_testkonto_warnungen WHERE tabelle = 'fiaon_persons' AND datensatz_id = ANY(${ids.map(String)})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termin_versuche WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_termine WHERE person_id = ANY(${ids})`.catch((e) => console.error("Aufräumen termine:", e));
  await sqlPool`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${ids}) OR nummer LIKE '49151260%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE text LIKE ${`%${MARKE}%`} OR titel LIKE ${`%${MARKE}%`}`.catch((e) => console.error("Aufräumen Aufgaben:", String(e).slice(0, 160)));
  await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${refs.length ? refs : ["-"]})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`.catch((e) => console.error("Aufräumen personen:", e));
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${abw.ABWESENHEIT_SCHLUESSEL}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_admin_log WHERE pfad LIKE '%/chef/mara/%' AND zeit > NOW() - INTERVAL '1 hour'`.catch(() => {});
  abw.abwesenheitVergessen();
}

try {
  // ═══ 1. Rein ════════════════════════════════════════════════════════════════
  abschnitt("1. Gruppen, Filter, Überschneidung (rein)");
  {
    const J = berlinZeitpunkt("2026-10-06", 10 * 60); // Dienstag 10:00 Berlin
    const z = (id: number, beginn: Date, extra: any = {}) => ({
      id, beginn: beginn.toISOString(), dauerMin: 20, status: "gebucht", abgeschlossen: false,
      person: { id, name: `P${id}`, stufe: null, stufeText: null, stand: null }, geld: null, mara: null, beiAbwesendem: false, ...extra,
    });
    const zeilen = [
      z(1, berlinZeitpunkt("2026-10-06", 9 * 60 + 30)),                                      // 30 Min. vorbei → wartet
      z(2, berlinZeitpunkt("2026-10-06", 9 * 60 + 50)),                                      // 10 Min. vorbei → jetzt (Spielraum 15)
      z(3, berlinZeitpunkt("2026-10-06", 15 * 60)),                                          // heute
      z(4, berlinZeitpunkt("2026-10-07", 9 * 60)),                                           // morgen
      z(5, berlinZeitpunkt("2026-10-11", 12 * 60)),                                          // Sonntag → woche
      z(6, berlinZeitpunkt("2026-10-12", 12 * 60)),                                          // Montag → später
      z(7, berlinZeitpunkt("2026-10-05", 12 * 60), { status: "verpasst", abgeschlossen: false, person: { id: 7, name: "P7", stufe: "C" }, geld: null }),
      z(8, berlinZeitpunkt("2026-10-05", 13 * 60), { status: "verpasst", abgeschlossen: false, person: { id: 8, name: "P8", stufe: "A" }, geld: { betragCents: 100 } }),
      z(9, berlinZeitpunkt("2026-10-05", 14 * 60), { status: "verpasst", abgeschlossen: false, person: { id: 9, name: "P9", stufe: "rate" }, geld: { betragCents: 9999 } }),
      z(10, berlinZeitpunkt("2026-10-05", 15 * 60), { status: "erledigt", abgeschlossen: true }),
      z(11, berlinZeitpunkt("2026-10-05", 16 * 60), { status: "verpasst", abgeschlossen: true }),
      z(12, berlinZeitpunkt("2026-10-06", 23 * 60 + 30), {}),                                // 23:30 Berlin (UTC 21:30) → heute
    ] as any[];
    const g = ueb.gruppieren(zeilen, J);
    const gr = (id: number) => g.find((x) => x.id === id)?.gruppe;
    ok("genau ein „jetzt“ — der früheste ab jetzt − 15 Min. (#2)", g.filter((x) => x.gruppe === "jetzt").length === 1 && gr(2) === "jetzt", g.map((x) => [x.id, x.gruppe]));
    ok("30 Min. vorbei und offen verpasst → „wartet“", gr(1) === "wartet" && gr(7) === "wartet" && gr(8) === "wartet");
    ok("heute / morgen / Sonntag = woche / Montag = später", gr(3) === "heute" && gr(4) === "morgen" && gr(5) === "woche" && gr(6) === "spaeter", g.map((x) => [x.id, x.gruppe]));
    ok("23:30 Berlin zählt als heute (Berliner Kalender, nicht UTC)", gr(12) === "heute");
    ok("erledigt und abgearbeitet verpasst → „erledigt“", gr(10) === "erledigt" && gr(11) === "erledigt");
    const wartet = g.filter((x) => x.gruppe === "wartet").map((x) => x.id);
    ok("„wartet“: A vor Rate vor C, ohne Stufe zuletzt (8, 9, 7, 1)", JSON.stringify(wartet) === JSON.stringify([8, 9, 7, 1]), wartet);
    ok("Filter „mara“ und „abwesend“", ueb.filtern([{ mara: {}, beiAbwesendem: false }, { mara: null, beiAbwesendem: true }] as any, "mara").length === 1
      && ueb.filtern([{ mara: {}, beiAbwesendem: false }, { mara: null, beiAbwesendem: true }] as any, "abwesend").length === 1);
    const a = z(20, berlinZeitpunkt("2026-10-06", 12 * 60)), b = z(21, berlinZeitpunkt("2026-10-06", 12 * 60 + 10)), c = z(22, berlinZeitpunkt("2026-10-06", 12 * 60 + 20));
    ok("Überschneidung mit Dauer: 12:00 ↔ 12:10 ja, 12:00 ↔ 12:20 nein", ueb.ueberschneidungen(a as any, [a, b, c] as any).map((x: any) => x.id).join() === "21");

    // Gegenprüfung 29.09.: Das Glas ignorierte wartende Kunden.
    const ohneFaellig = ueb.gruppieren(zeilen.filter((x: any) => x.id !== 2), J);
    const fokus = ohneFaellig.find((x) => x.gruppe === "jetzt");
    ok("Glas: ohne fälligen Termin steht der dringendste wartende Kunde oben (#8, A) — nicht der nächste Termin (#3)",
      fokus?.id === 8 && ueb.fokusArt(fokus as any, J) === "wartet" && !ohneFaellig.some((x) => x.id === 8 && x.gruppe === "wartet"), ohneFaellig.map((x) => [x.id, x.gruppe]));
    ok("… und zählt weiter als wartend (istWartend), die übrigen Wartenden bleiben in der Reihe (9, 7, 1)",
      ueb.istWartend(fokus as any, J) && JSON.stringify(ohneFaellig.filter((x) => x.gruppe === "wartet").map((x) => x.id)) === "[9,7,1]");
    const bald = [...zeilen.filter((x: any) => x.id !== 2), z(30, berlinZeitpunkt("2026-10-06", 10 * 60 + 10))];
    const gb = ueb.gruppieren(bald as any, J);
    ok("Glas: ein Termin, der in 10 Min. beginnt, geht dem wartenden Kunden vor (#30, „jetzt“)",
      gb.find((x) => x.gruppe === "jetzt")?.id === 30 && ueb.fokusArt(gb.find((x) => x.gruppe === "jetzt") as any, J) === "jetzt");
    const nurSpaeter = ueb.gruppieren([z(40, berlinZeitpunkt("2026-10-06", 15 * 60))] as any, J);
    ok("Glas: ohne Wartende der nächste Termin („naechster“)", nurSpaeter[0].gruppe === "jetzt" && ueb.fokusArt(nurSpaeter[0] as any, J) === "naechster");
    ok("Rot-Probe: nichts offen → kein „jetzt“ (nur dann der Leersatz)", !ueb.gruppieren([z(10, berlinZeitpunkt("2026-10-05", 15 * 60), { status: "erledigt", abgeschlossen: true })] as any, J).some((x) => x.gruppe === "jetzt"));

    // Maras Zusage: Angebot ≠ Zusage, der Tag muss passen.
    const B = berlinZeitpunkt("2026-09-30", 9 * 60 + 30).toISOString();
    const G = berlinZeitpunkt("2026-09-29", 11 * 60);
    ok("zusagePasst: „morgen um 9:30 Uhr“ am Vortag ja", ueb.zusagePasst("Gern, Justin ruft Sie morgen um 9:30 Uhr an.", B, G));
    ok("zusagePasst: Maras Angebot mit drei Zeiten und Frage nein",
      !ueb.zusagePasst("Justin kann Sie heute um 18:30 Uhr, morgen um 9:30 Uhr oder morgen um 20:10 Uhr anrufen. Was passt Ihnen?", B, G));
    ok("zusagePasst: falscher Tag („heute“) nein; Wochentag/Datum geprüft",
      !ueb.zusagePasst("Gern, Justin ruft Sie heute um 9:30 Uhr an.", B, G)
      && ueb.zusagePasst("Gern, Nikita ruft Sie am Mittwoch, 30. September, um 9:30 Uhr an.", B, berlinZeitpunkt("2026-09-25", 10 * 60))
      && !ueb.zusagePasst("Gern, Nikita ruft Sie am Donnerstag um 9:30 Uhr an.", B, berlinZeitpunkt("2026-09-25", 10 * 60)));

    // Stufe erledigter Zeilen: dieselbe Regel wie die Telefonkartei.
    ok("stufeAusTier: 3 + antrag_abgebrochen = abbrecher, 3 + nur_lead = C, -1 = ausgeschlossen, ohne Tier mit Antrag = B",
      ueb.stufeAusTier(3, "antrag_abgebrochen", true) === "abbrecher" && ueb.stufeAusTier(3, "nur_lead", false) === "C"
      && ueb.stufeAusTier(-1, "ausgeschlossen", true) === "ausgeschlossen" && ueb.stufeAusTier(null, null, true) === "B" && ueb.stufeAusTier(null, null, false) === "C");

    // Klartext „verschoben" für Kalender und Termin-Zentrale.
    const art = await import("../shared/fiaon-termin-art");
    ok("absageSatz: „verschoben“ in Worten, nie „durch verschoben“",
      /^Von Mara auf Wunsch des Kunden verschoben am 29\.09\., 11:03 Uhr$/.test(art.absageSatz("29.09., 11:03", "verschoben"))
      && art.absageSatz("29.09., 11:03", "kunde") === "Abgesagt am 29.09., 11:03 Uhr durch den Kunden"
      && !/durch verschoben/.test(art.absageSatz("x", "verschoben")));
    const quelle = (await import("node:fs")).readFileSync(new URL("../server/routes/fiaon-agent.ts", import.meta.url), "utf8");
    ok("Agenten-Kalender baut den Satz über absageSatz (kein roher Wert mehr)", /absageSatz\(/.test(quelle) && !/durch \$\{t\.abgesagt_von\}/.test(quelle));
  }

  // ═══ Aufbau ═════════════════════════════════════════════════════════════════
  await aufraeumen();
  await mt.protokollTabelle();
  const [v] = (await sqlPool`SELECT id, name, first_name, last_name, anrede, COALESCE(active, TRUE) AS aktiv FROM fiaon_agents WHERE id = ${VERTRETER}`) as any[];
  // E-265 (29.09.2026, Justin „zum letzten Mal!!"): Kundensätze nennen die NENNFORM — 928 und 13 haben keine
  // gepflegte Anrede, also der volle Name („Justin Schwarzott", „Nikita Boychenko"), nie der Vorname allein.
  const { nennform } = await import("../shared/fiaon-mitarbeiter-name");
  const NENN_V = nennform(v).nom;
  const [b13] = (await sqlPool`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${BETREUER}`) as any[];
  const NENN_B = nennform(b13).nom;
  const zeiten928 = (await termine.verfuegbarkeitVon(VERTRETER)).filter((x) => x.aktiv).length;
  ok("Aufbau: Konto 928 da, aktiv, mit Zeiten; Betreuer 13 hat Zeiten", !!v?.aktiv && zeiten928 > 0 && (await termine.verfuegbarkeitVon(BETREUER)).length > 0, { v, zeiten928 });

  const P1 = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000001" });
  const P2 = await person({ betreuer: null, tier: 3, nummer: "+4915126000002" });
  const P7 = await person({ betreuer: BETREUER, tier: 1, nummer: "+4915126000007" });
  const P9 = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000009" });

  // ═══ 2. Aus ═════════════════════════════════════════════════════════════════
  abschnitt("2. Abwesenheit aus — Mara bucht beim Betreuer");
  {
    const a = await mt.freieZeiten(P1);
    ok("freieZeiten: weg „betreuer“, alle Plätze bei 13", a.weg === "betreuer" && a.slots.length > 0 && a.slots.every((s) => s.agentId === BETREUER), { weg: a.weg, n: a.slots.length });
    ok("abwesenheitJetzt ohne Zeile: null", (await abw.abwesenheitJetzt()) === null);
  }

  // ═══ 3. Setzen ══════════════════════════════════════════════════════════════
  abschnitt("3. Setzen: Klartext-Absagen, dann an");
  const bis = new Date(Date.now() + 50 * 3_600_000);
  {
    const ohneZeiten = await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId: 531 }, "Prüfstand");
    ok("Vertreter ohne Zeitfenster (531): abgelehnt mit Klartext", !ohneZeiten.ok && /keine Arbeitszeiten/.test(String(ohneZeiten.fehler)), ohneZeiten.fehler);
    const gesperrt = await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId: 12 }, "Prüfstand");
    ok("gesperrter Vertreter (12): abgelehnt", !gesperrt.ok && /gesperrt/.test(String(gesperrt.fehler)), gesperrt.fehler);
    const vorbei = await abw.abwesenheitSetzen({ an: true, bis: new Date(Date.now() - 3_600_000).toISOString(), vertreterId: VERTRETER }, "Prüfstand");
    ok("„bis“ in der Vergangenheit: abgelehnt", !vorbei.ok && /nicht in der Zukunft/.test(String(vorbei.fehler)), vorbei.fehler);
    const weit = await abw.abwesenheitSetzen({ an: true, bis: new Date(Date.now() + 20 * 86_400_000).toISOString(), vertreterId: VERTRETER }, "Prüfstand");
    ok("„bis“ mehr als 14 Tage voraus: abgelehnt", !weit.ok && /14 Tage/.test(String(weit.fehler)), weit.fehler);
    ok("nach Absagen ist nichts gesetzt", (await abw.abwesenheitLesen(true)).an === false);
    const an = await abw.abwesenheitSetzen({ an: true, bis: wand(bis), vertreterId: VERTRETER, fuer: [] }, "Prüfstand");
    ok("an (Berliner Wandzeit „YYYY-MM-DD HH:MM“): gesetzt, Verlauf „an: …“, Testkonto 928 ausdrücklich zugelassen",
      an.ok && an.zustand.an && an.zustand.vertreterId === VERTRETER && /^an: bis /.test(an.zustand.verlauf[0]?.was ?? ""), an);
    const jetzt = await abw.abwesenheitJetzt();
    ok("abwesenheitJetzt: Vertreter 928, anrufName = Nennform (E-265, nie der Vorname)", jetzt?.vertreter.id === VERTRETER && jetzt?.vertreter.anrufName === NENN_V && NENN_V !== String(v.first_name), jetzt?.vertreter);
    ok("istAbwesend: 13 ja, 928 (Vertreter) nein, 13 nach „bis“ nein",
      abw.istAbwesend(jetzt, BETREUER) && !abw.istAbwesend(jetzt, VERTRETER) && !abw.istAbwesend(jetzt, BETREUER, new Date(bis.getTime() + 3_600_000)));
  }

  // ═══ 4. Plätze ══════════════════════════════════════════════════════════════
  abschnitt("4. An: Plätze beim Vertreter, Termine der Abwesenden belegt (B4)");
  let S1 = "", S2 = "", S3 = "";
  {
    const a = await mt.freieZeiten(P1);
    const vor = a.slots.filter((s) => new Date(s.beginn) < bis);
    const nach = a.slots.filter((s) => new Date(s.beginn) >= bis);
    ok("weg „abwesenheit“, Angebot nennt den Vertreter", a.weg === "abwesenheit" && a.agent?.id === VERTRETER && a.abwesenheit?.betreuer?.id === BETREUER, { weg: a.weg, agent: a.agent });
    ok("vor „bis“ nur Plätze von 928 (mindestens drei)", vor.length >= 3 && vor.every((s) => s.agentId === VERTRETER), { n: vor.length, agenten: Array.from(new Set(vor.map((s) => s.agentId))) });
    ok("nach „bis“ nur Plätze des Betreuers 13", nach.every((s) => s.agentId === BETREUER), Array.from(new Set(nach.map((s) => s.agentId))));
    ok("20 Minuten Vorlauf beim Vertreter", vor.every((s) => new Date(s.beginn).getTime() >= Date.now() + 19 * 60_000));
    S1 = vor[0].beginn; S2 = vor[1].beginn; S3 = vor[2].beginn;
    // Ein Termin bei 13 genau zu S1 (P7) — Justin ruft ihn an, also ist S1 bei ihm belegt.
    await terminDirekt({ personId: P7, agentId: BETREUER, beginn: S1, quelle: "agent_manuell", herkunft: "agent" });
    const b = await mt.freieZeiten(P1);
    ok("B4: der Platz, an dem 13 einen Termin hat, fehlt jetzt beim Vertreter", !b.slots.some((s) => s.beginn === S1 && s.agentId === VERTRETER) && b.slots.some((s) => s.beginn === S2));
    const ab = await abw.abwesenheitJetzt();
    const bel = await abw.belegtFuerVertreter(ab!);
    ok("belegtFuerVertreter enthält den Termin von 13", bel.some((x) => x.von === new Date(S1).getTime()));
    // Rot-Probe: Ist 13 NICHT abwesend (nur 10), gehört sein Termin nicht zu Justins Belegung.
    const nur10 = { ...ab!, fuer: [10] };
    ok("Rot-Probe: Abwesenheit nur für 10 → der Termin von 13 belegt den Vertreter nicht", !(await abw.belegtFuerVertreter(nur10)).some((x) => x.von === new Date(S1).getTime()));
  }

  // ═══ 5. Buchen ══════════════════════════════════════════════════════════════
  abschnitt("5. Buchen beim Vertreter, ohne die Zuordnung zu ändern (B10)");
  let terminP1 = 0;
  {
    const r = await mt.rueckrufBuchen({ personId: P1, nummer: "4915126000001" }, { zeit: wand(S2), anliegen: `Rückruf zur Rechnung ${MARKE}` });
    terminP1 = r.termin?.id ?? 0;
    if (terminP1) termineIds.push(terminP1);
    ok("rueckrufBuchen: gebucht bei 928, Name = Vertreter", r.ok && r.termin?.agentId === VERTRETER && r.termin?.vorname === String(v.first_name), r);
    const [t] = (await sqlPool`SELECT agent_id, herkunft, quelle, notiz FROM fiaon_termine WHERE id = ${terminP1}`) as any[];
    ok("Termin: herkunft mara_whatsapp, Notiz „in Abwesenheit von Nikita, bei …“", t?.herkunft === "mara_whatsapp" && /in Abwesenheit von Nikita, bei /.test(String(t?.notiz)), t);
    const [p] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${P1}`) as any[];
    ok("P1 bleibt bei Betreuer 13", Number(p?.assigned_agent_id) === BETREUER, p);
    const [pr] = (await sqlPool`SELECT daten FROM fiaon_mara_protokoll WHERE termin_id = ${terminP1} AND art = 'termin_gebucht'`) as any[];
    const d = typeof pr?.daten === "string" ? JSON.parse(pr.daten) : pr?.daten;
    ok("Protokoll: weg „abwesenheit“, abwesend 13, vertreter 928", d?.weg === "abwesenheit" && Number(d?.abwesend) === BETREUER && Number(d?.vertreter) === VERTRETER, d);

    const r2 = await mt.rueckrufBuchen({ personId: P2, nummer: "4915126000002" }, { zeit: wand(S3), anliegen: "Frage zum Antrag" });
    if (r2.termin?.id) termineIds.push(r2.termin.id);
    const [p2] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${P2}`) as any[];
    ok("ohne Betreuer: gebucht bei 928, Kunde NICHT an 928 gebunden", r2.ok && r2.termin?.agentId === VERTRETER && p2?.assigned_agent_id == null, { r2: r2.meldung, p2 });
    // Rot-Probe: dieselbe Nachbehandlung OHNE Option pinnt — der Schutz ist die Option, nicht Zufall.
    const P8 = await person({ betreuer: null, tier: 3 });
    const frei = (await mt.freieZeiten(P8)).slots.filter((s) => s.agentId === VERTRETER);
    const b8 = await termine.terminBuchen({ personId: P8, agentId: VERTRETER, beginn: frei[0].beginn, quelle: "agent_manuell", herkunft: "agent" });
    termineIds.push(b8.id);
    await termine.buchungAnwenden(b8);
    const [p8] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${P8}`) as any[];
    ok("Rot-Probe: buchungAnwenden ohne { zuordnen: false } bindet den Kunden an 928", Number(p8?.assigned_agent_id) === VERTRETER, p8);

    // Gegenprüfung 29.09.: Kunde eines GESPERRTEN Betreuers (12) — vorher wanderte er samt Antrag an 928.
    const refG = `FIAON-G260${Date.now().toString(36).toUpperCase()}`;
    refs.push(refG);
    const PG = await person({ betreuer: 12, tier: 2, nummer: "+4915126000012" });
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status, assigned_agent_id) VALUES (${refG}, ${PG}, ${refG}, 'submitted', 12)`;
    const zg = await mt.freieZeiten(PG);
    ok("gesperrter Betreuer: Abwesenheit greift (weg „abwesenheit“), nach „bis“ der Pool ohne 12 und ohne 928",
      zg.weg === "abwesenheit" && zg.abwesenheit?.nach.weg === "pool"
      && zg.slots.filter((s) => new Date(s.beginn) >= bis).every((s) => s.agentId !== 12 && s.agentId !== VERTRETER), { weg: zg.weg, nach: zg.abwesenheit?.nach });
    const sg = zg.slots.find((s) => s.agentId === VERTRETER)!;
    const rg = await mt.rueckrufBuchen({ personId: PG, nummer: "4915126000012" }, { zeit: wand(sg.beginn), anliegen: `gesperrt ${MARKE}` });
    if (rg.termin?.id) termineIds.push(rg.termin.id);
    const [pg] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${PG}`) as any[];
    const [ag] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${refG}`) as any[];
    const [wander] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${refG} AND note LIKE 'Kunde zu %gewechselt%'`) as any[];
    ok("gesperrter Betreuer: gebucht bei 928, Person UND Antrag bleiben bei 12, kein „Kunde gewechselt“ im Verlauf",
      rg.ok && rg.termin?.agentId === VERTRETER && Number(pg?.assigned_agent_id) === 12 && Number(ag?.assigned_agent_id) === 12 && Number(wander?.n) === 0,
      { ok: rg.ok, meldung: rg.meldung, pg, ag, wander });
    // Rot-Probe: dieselbe Lage, buchungAnwenden OHNE Option → wandert samt Antrag an 928 (der alte Fehler).
    const refR = `FIAON-R260${Date.now().toString(36).toUpperCase()}`;
    refs.push(refR);
    const PR = await person({ betreuer: 12, tier: 2 });
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status, assigned_agent_id) VALUES (${refR}, ${PR}, ${refR}, 'submitted', 12)`;
    const freiR = (await mt.freieZeiten(PR)).slots.filter((s) => s.agentId === VERTRETER);
    const bR = await termine.terminBuchen({ personId: PR, agentId: VERTRETER, beginn: freiR[freiR.length - 1].beginn, quelle: "agent_manuell", herkunft: "agent" });
    termineIds.push(bR.id);
    await termine.buchungAnwenden(bR);
    const [pr2] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${PR}`) as any[];
    const [ar2] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${refR}`) as any[];
    ok("Rot-Probe: buchungAnwenden ohne { zuordnen: false } hängt Person und Antrag an 928", Number(pr2?.assigned_agent_id) === VERTRETER && Number(ar2?.assigned_agent_id) === VERTRETER, { pr2, ar2 });

    // Das Werkzeug, wie Mara es ruft: freie_zeiten und rueckruf_eintragen.
    const wa = await import("../server/lib/fiaon-whatsapp-mara");
    const P3 = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000003" });
    const fz = await wa.werkzeugAusfuehren("freie_zeiten", {}, { personId: P3, leadId: null, nummer: "4915126000003" });
    ok("Werkzeug freie_zeiten: Mitarbeiter = Vertreter (Nennform), jede Zeit mit „ruft_an“", fz.ergebnis?.ok && fz.ergebnis.mitarbeiter === NENN_V
      && Array.isArray(fz.ergebnis.zeiten) && fz.ergebnis.zeiten.every((x: any) => typeof x.ruft_an === "string"), fz.ergebnis);
    const zeit = fz.ergebnis.zeiten.find((x: any) => x.ruft_an === NENN_V)?.zeit;
    const rr = await wa.werkzeugAusfuehren("rueckruf_eintragen", { zeit, anliegen: "Rückruf" }, { personId: P3, leadId: null, nummer: "4915126000003" });
    const idP3 = (rr.aktion as any)?.termin?.id;
    if (idP3) termineIds.push(idP3);
    ok("Werkzeug rueckruf_eintragen: „Gern, Justin Schwarzott ruft Sie … an.“ (Nennform)", rr.ergebnis?.ok && new RegExp(`^Gern, ${NENN_V} ruft Sie `).test(String(rr.ergebnis.so_schreiben)), rr.ergebnis);
  }

  // ═══ 6. Namen ═══════════════════════════════════════════════════════════════
  abschnitt("6. Wer ruft an — die Namen bleiben wahr (B2)");
  {
    const k7 = await mt.kuenftigerTermin(P7);
    ok("bestehender Termin bei 13 vor „bis“: Mara nennt den Vertreter", k7?.vorname === String(v.first_name) && k7?.agentId === BETREUER, k7);
    const P4 = await person({ betreuer: BETREUER, tier: 2 });
    const nachBis = (await mt.freieZeiten(P9)).slots.find((s) => s.agentId === BETREUER && new Date(s.beginn) >= bis)
      ?? { beginn: new Date(bis.getTime() + 86_400_000).toISOString() };
    await terminDirekt({ personId: P4, agentId: BETREUER, beginn: nachBis.beginn, herkunft: "agent" });
    const k4 = await mt.kuenftigerTermin(P4);
    ok("Termin bei 13 NACH „bis“: Mara nennt Nikita (Nennform „Nikita Boychenko“)", k4?.vorname === "Nikita" && k4?.nenn.nom === NENN_B, k4);
    const schon = await mt.rueckrufBuchen({ personId: P7, nummer: "4915126000007" }, { zeit: wand(S3), anliegen: "noch einmal" });
    ok("„Termin steht schon“: fertiger Satz mit dem Vertreter (Nennform)", !schon.ok && schon.grund === "schon_termin" && schon.bestehend?.vorname === String(v.first_name)
      && schon.meldung.includes(`Genau, ${NENN_V} ruft Sie`), schon.meldung);
    const pw = await import("../server/lib/fiaon-postmeister-werkzeuge");
    const bt = await pw.bestehenderTermin(P7);
    ok("Postmeister (bestehenderTermin): nennt den Vertreter (Nennform)", bt?.vorname === NENN_V, bt);
    const wa = await import("../server/lib/fiaon-whatsapp-mara");
    const lage = await wa.lageFuer(P9, null, null, "");
    // Gegenprüfung 29.09.: vorher überschrieb der Vertreter den festen Betreuer — „Sein Betreuer: Justin".
    ok("WhatsApp-Lage: betreuer = der FESTE (Nikita), anrufer = Vertreter, „wer“ sagt, dass das Team nicht im Haus ist",
      String(lage.betreuer).split(" ")[0] === "Nikita" && String(lage.anrufer).split(" ")[0] === String(v.first_name) && !!lage.anruferBis
      && /nicht im Haus/.test(lage.wer) && /Nikita/.test(lage.wer), { betreuer: lage.betreuer, anrufer: lage.anrufer, wer: lage.wer });
    const stand = wa.standZeilen({ stufe: "lead" as any, betreuer: "Nikita", anrufer: String(v.first_name), anruferBis: lage.anruferBis });
    ok("Stand-Zeile: „Sein Betreuer: Nikita. Bis … ruft Justin an“ — eine Aussage, kein Widerspruch",
      stand.some((z) => z.startsWith("Sein Betreuer: Nikita.") && z.includes(`ruft ${v.first_name} an`)), stand);
    const ton = await import("../shared/fiaon-mara-ton");
    // E-265: Persona mit Nennformen — ohne gepflegte Anrede der volle Name und „nie er/sie".
    const persona = ton.personaText("whatsapp", { betreuer: lage.betreuerN, vertretung: { name: NENN_V, dat: NENN_V, bis: String(lage.anruferBis) } });
    ok("Persona: fester Betreuer Nikita Boychenko, bis „bis“ nennt sie den Vertreter (Nennform)", new RegExp(`fester Betreuer ist ${NENN_B}[^;]*; bis `).test(persona) && persona.includes(`übernimmt ${NENN_V} Anruf`) && /nie er\/sie/.test(persona), persona.split("\n").find((z) => /Betreuer/.test(z)));
    // E-265 Nachbesserung (29.09.2026, f18): die Nennform EINMAL — danach „Sie hören direkt von uns".
    ok("Rückfallsatz nennt den, der anruft (Vertreter, Nennform) — einmal", wa.rueckfallSatz(lage.anruferN).includes(`schaut sich ${NENN_V} das persönlich an`) && wa.rueckfallSatz(lage.anruferN).split(NENN_V).length === 2);
    const dossier = await import("../server/lib/fiaon-postmeister-dossier");
    const akte = await dossier.akteLesen(P9, null).catch((e: any) => ({ fehler: String(e?.message ?? e) })) as any;
    ok("Postmeister-Akte: betreuer bleibt Nikita (Nennform), vertretung = Vertreter (Nennform) mit „bis“",
      akte?.betreuer === NENN_B && akte?.vertretung?.name === NENN_V && !!akte?.vertretung?.bis, { betreuer: akte?.betreuer, vertretung: akte?.vertretung, fehler: akte?.fehler });
  }

  // ═══ 7. Terminlink ══════════════════════════════════════════════════════════
  abschnitt("7. Terminlink bei Abwesenheit: Zeiten statt Link");
  {
    const l = await mt.terminlinkFuer({ personId: P9, nummer: "4915126000009" });
    ok("kein Link, Hinweis auf freie_zeiten und rueckruf_eintragen", !l.ok && !l.link && /freie_zeiten/.test(l.meldung) && /rueckruf_eintragen/.test(l.meldung), l);
  }

  // ═══ 5b. Nach „bis“ der normale Weg ═════════════════════════════════════════
  abschnitt("5b. Nach „bis“: Betreuer bzw. Pool — keine Sackgasse (Gegenprüfung 29.09.)");
  {
    // Ohne Betreuer: vorher 0 Plätze nach „bis“.
    const PB = await person({ betreuer: null, tier: 3, nummer: "+4915126000021" });
    const zb = await mt.freieZeiten(PB);
    const nachB = zb.slots.filter((s) => new Date(s.beginn) >= bis);
    ok("ohne Betreuer: vor „bis“ nur 928, nach „bis“ Pool-Plätze (nicht 928), Weg „pool“",
      zb.weg === "abwesenheit" && nachB.length > 0 && nachB.every((s) => s.agentId !== VERTRETER)
      && zb.slots.filter((s) => new Date(s.beginn) < bis).every((s) => s.agentId === VERTRETER) && zb.abwesenheit?.nach.weg === "pool",
      { weg: zb.weg, nach: nachB.length, agenten: Array.from(new Set(nachB.map((s) => s.agentId))) });
    const wunsch = nachB[Math.min(3, nachB.length - 1)];
    const rb = await mt.rueckrufBuchen({ personId: PB, nummer: "4915126000021" }, { zeit: wand(wunsch.beginn), anliegen: `nach bis ${MARKE}` });
    if (rb.termin?.id) termineIds.push(rb.termin.id);
    ok("Wunsch nach „bis“ ohne Betreuer: gebucht beim Pool-Mitarbeiter, nicht „nicht frei“", rb.ok && rb.termin?.agentId === wunsch.agentId, rb.meldung);

    // „nicht frei“ nach „bis“ nennt den Betreuer, nicht den Vertreter.
    const PN = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000022" });
    const tagNach = new Date(bis.getTime() + 36 * 3_600_000);
    const nachts = `${wand(tagNach).slice(0, 10)} 03:10`;
    const rn = await mt.rueckrufBuchen({ personId: PN, nummer: "4915126000022" }, { zeit: nachts, anliegen: "nachts" });
    ok("„nicht frei“ nach „bis“: nennt Nikita und ihre Arbeitszeit, nicht den Vertreter; sagt je Alternative, wer anruft",
      !rn.ok && rn.grund === "nicht_frei" && new RegExp(`ist ${NENN_B} nicht frei`).test(rn.meldung) && !new RegExp(`ist ${NENN_V} nicht frei`).test(rn.meldung) && /wer anruft: /.test(rn.meldung), rn.meldung);

    // „bis“ in 15 Minuten: vorher weg „keiner“, 0 Plätze, Link gesperrt.
    const alt = await abw.abwesenheitLesen(true);
    const kurz = new Date(Date.now() + 15 * 60_000);
    await abw.abwesenheitSetzen({ an: true, bis: kurz.toISOString(), vertreterId: VERTRETER, fuer: [] }, "Prüfstand");
    // Eine frische Person ohne Betreuer (PB hängt nach seiner Buchung jetzt am Pool-Mitarbeiter).
    const PK = await person({ betreuer: null, tier: 3, nummer: "+4915126000023" });
    const zk = await mt.freieZeiten(PK);
    ok("„bis“ in 15 Min.: trotzdem Plätze (Pool ab „bis“), keine Sackgasse", zk.slots.length > 0 && zk.weg === "abwesenheit", { weg: zk.weg, n: zk.slots.length });
    const lk = await mt.terminlinkFuer({ personId: PK, nummer: "4915126000023" });
    ok("… Terminlink: statt Link die Zeiten — und die gibt es wirklich", !lk.ok && /freie_zeiten/.test(lk.meldung) && zk.slots.length > 0, lk.meldung);
    // „nur einzelne“ (10): ein Kunde ohne Betreuer bleibt im Pool — ohne Florentine vor „bis“.
    await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId: VERTRETER, fuer: [10] }, "Prüfstand");
    const ze = await mt.freieZeiten(PK);
    ok("nur einzelne (10): ohne Betreuer Pool der Anwesenden — keine Plätze von 10 vor „bis“, keine von 928",
      ze.weg === "pool" && !ze.slots.some((s) => s.agentId === 10 && new Date(s.beginn) < bis) && !ze.slots.some((s) => s.agentId === VERTRETER),
      { weg: ze.weg, agenten: Array.from(new Set(ze.slots.map((s) => s.agentId))) });
    // Zurück auf den Stand davor (das ganze Team bis „bis“).
    await abw.abwesenheitSetzen({ an: true, bis: alt.bis ?? bis.toISOString(), vertreterId: VERTRETER, fuer: [] }, "Prüfstand");
  }

  // ═══ 8. Verschieben ═════════════════════════════════════════════════════════
  abschnitt("8. Verschieben (B8): keine Absagemail an den Kunden, Zeit wieder frei");
  {
    const P5 = await person({ betreuer: BETREUER, tier: 2, email: `${MARKE.toLowerCase()}-p5@fiaon.invalid`, nummer: "+4915126000005" });
    const slots13 = await ohneUeberschneidung(BETREUER, await termine.rohSlots([{ id: BETREUER, vorname: "Nikita" }], 20, sqlPool, 60 * 60_000));
    const alt = slots13.find((s) => new Date(s.beginn) < bis && new Date(s.beginn).getTime() > Date.now() + 2 * 3_600_000) ?? slots13[0];
    const t5 = await terminDirekt({ personId: P5, agentId: BETREUER, beginn: alt.beginn, quelle: "nichterreicht_mail", herkunft: "termin_verpasst_mail" });
    const neu = (await mt.freieZeiten(P5)).slots.find((s) => s.agentId === VERTRETER && s.beginn !== alt.beginn)!;
    const r = await mt.rueckrufBuchen({ personId: P5, nummer: "4915126000005" }, { zeit: wand(neu.beginn), anliegen: "lieber später", verschieben: true });
    if (r.termin?.id) termineIds.push(r.termin.id);
    ok("vom Kunden gebuchter Termin bei Abwesendem → zum Vertreter verschoben (derselbe Mensch am Telefon)", r.ok && r.termin?.agentId === VERTRETER, r.meldung);
    const [a5] = (await sqlPool`SELECT status, abgesagt_von FROM fiaon_termine WHERE id = ${t5.id}`) as any[];
    ok("alter Termin: abgesagt_von „verschoben“", a5?.status === "abgesagt" && a5?.abgesagt_von === "verschoben", a5);
    await warte(1500);
    const [m5] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${P5} AND event = 'termin_absage'`) as any[];
    ok("KEINE Absagemail an den Kunden (fiaon_mail_log)", Number(m5?.n) === 0, m5);
    ok("Mitarbeiter liest „Termin verschoben (Mara)“ statt „ABGESAGT“ (Brevo-Attrappe)", BREVO.some((m) => /^Termin verschoben \(Mara\)/.test(m.betreff)) && !BREVO.some((m) => /ABGESAGT/.test(m.betreff) && m.text.includes(`Kunde${personen.indexOf(P5) + 1}`)),
      BREVO.map((m) => m.betreff));
    const frei = await termine.rohSlots([{ id: BETREUER, vorname: "Nikita" }], 20, sqlPool, 60 * 60_000);
    ok("die alte Zeit ist bei 13 wieder frei", frei.some((s) => s.beginn === alt.beginn));
    // Rot-Probe: „agent" schickt dem Kunden die Absagemail.
    const P5b = await person({ betreuer: BETREUER, tier: 2, email: `${MARKE.toLowerCase()}-p5b@fiaon.invalid` });
    const t5b = await terminDirekt({ personId: P5b, agentId: BETREUER, beginn: (await ohneUeberschneidung(BETREUER, frei)).find((s) => s.beginn !== alt.beginn)!.beginn, herkunft: "agent" });
    await termine.terminAbsagen(t5b.storno, "agent");
    await warte(1500);
    const [m5b] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${P5b} AND event = 'termin_absage'`) as any[];
    ok("Rot-Probe: Absage „agent“ schreibt die Absagemail ins Protokoll", Number(m5b?.n) === 1, m5b);
  }

  // ═══ 9. Postmeister ═════════════════════════════════════════════════════════
  abschnitt("9. Postmeister: Rückruf aus einer Mail beim Vertreter, Aufgabe aufs Board");
  {
    const P6 = await person({ betreuer: BETREUER, tier: 2, name: "Mailkunde" });
    const pw = await import("../server/lib/fiaon-postmeister-werkzeuge");
    const frei = (await mt.freieZeiten(P6)).slots.filter((s) => s.agentId === VERTRETER);
    // Wunsch 7 Minuten nach einem freien Platz → er rastet auf den Platz ein (höchstens 10 Min. früher).
    const wunsch = new Date(new Date(frei[1].beginn).getTime() + 7 * 60_000);
    const e = await pw.aufgabeAnBetreuer.ausfuehren({
      titel: `Mailkunde zurückrufen ${MARKE}`, text: `Kunde bittet um Rückruf wegen der Rechnung ${MARKE}.`, faellig_in_tagen: 0, dringend: false, kollege: "", rueckruf_am: wand(wunsch),
    }, { personId: P6, ref: null, postfach: "support@fiaon.com", postmeisterId: null, kundenlage: "unbezahlt" as any });
    const [t6] = (await sqlPool`SELECT id, agent_id, beginn, herkunft FROM fiaon_termine WHERE person_id = ${P6} AND status = 'gebucht'`) as any[];
    if (t6?.id) termineIds.push(Number(t6.id));
    ok("Termin beim Vertreter, auf seinen Platz eingerastet, herkunft mara_mail", Number(t6?.agent_id) === VERTRETER && new Date(t6?.beginn).toISOString() === frei[1].beginn && t6?.herkunft === "mara_mail", { t6, platz: frei[1].beginn });
    ok("Satz an den Kunden nennt den Vertreter, nicht Nikita", e.ok && e.ergebnis.startsWith("Justin") && !/Nikita/.test(e.ergebnis), e.ergebnis);
    const [todo] = (await sqlPool`SELECT zustaendig_art, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE text LIKE ${`%${MARKE}%`} ORDER BY id DESC LIMIT 1`) as any[];
    ok("Aufgabe liegt beim Betreiber (Board), nicht bei 13", todo?.zustaendig_art === "betreiber" && todo?.zustaendig_agent_id == null, todo);
    const [p6] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${P6}`) as any[];
    ok("Kunde bleibt bei 13", Number(p6?.assigned_agent_id) === BETREUER);
  }

  // ═══ 10. Ablauf, Aus, einzelne ══════════════════════════════════════════════
  abschnitt("10. Ablauf und Aus");
  {
    const w = await abw.abwesenheitLesen(true);
    const abgelaufen = { ...w, bis: new Date(Date.now() - 60_000).toISOString() };
    await sqlPool`UPDATE fiaon_settings SET value = ${JSON.stringify(abgelaufen)} WHERE key = ${abw.ABWESENHEIT_SCHLUESSEL}`;
    abw.abwesenheitVergessen();
    ok("„bis“ vorbei → abwesenheitJetzt null", (await abw.abwesenheitJetzt()) === null);
    abw.abwesenheitVergessen();
    const nach = await abw.abwesenheitLesen(true);
    ok("… und einmal als „abgelaufen“ vermerkt (an = false)", nach.an === false && nach.endeteWie === "abgelaufen" && /^abgelaufen/.test(nach.verlauf[0]?.was ?? ""), nach.verlauf[0]);
    ok("nach Ablauf bucht Mara wieder beim Betreuer", (await mt.freieZeiten(P9)).weg === "betreuer");
    const ein = await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId: VERTRETER, fuer: [10] }, "Prüfstand");
    ok("nur für 10: P9 (Betreuer 13) bucht normal bei 13", ein.ok && (await mt.freieZeiten(P9)).weg === "betreuer");
    const aus = await abw.abwesenheitSetzen({ an: false }, "Prüfstand");
    ok("Aus: an = false, Verlauf „beendet“", aus.ok && !aus.zustand.an && /^beendet/.test(aus.zustand.verlauf[0]?.was ?? ""), aus.zustand.verlauf[0]);
    await abw.abwesenheitSetzen({ an: true, bis: bis.toISOString(), vertreterId: VERTRETER, fuer: [] }, "Prüfstand");
  }

  // ═══ 11. Route GET ══════════════════════════════════════════════════════════
  abschnitt("11. GET /chef/mara/termine (echter Router, Chef-Cookie)");
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const router = (await import("../server/routes/fiaon-mara-steuerpult")).default;
  const app = express();
  app.use(cookieParser()); app.use(express.json());
  app.use("/api/fiaon", router);
  server = app.listen(0);
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;
  const keks = () => {
    const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:${VERTRETER}:inhaber:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=${VERTRETER}.inhaber.${exp}.${sig}`;
  };
  const holen = async (pfad: string, init: RequestInit = {}) => {
    const r = await echtFetch(`${basis}${pfad}`, { ...init, headers: { cookie: keks(), "content-type": "application/json", ...(init.headers || {}) } });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  const post = (pfad: string, body: unknown) => holen(pfad, { method: "POST", body: JSON.stringify(body) });
  {
    // Zusage: Maras WhatsApp nach der Buchung mit der Uhrzeit.
    const uhr = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(S2));
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status) VALUES ('raus', '4915126000001', ${P1}, 'text', ${`Gern, Justin ruft Sie um ${uhr} Uhr an.`}, 'gesendet')`;
    // Eine Testperson mit Termin — darf nicht erscheinen.
    const PT = await person({ betreuer: BETREUER, test: true });
    const tT = await terminDirekt({ personId: PT, agentId: BETREUER, beginn: S3, herkunft: "mara_whatsapp" });
    // Überschneidung: ein Termin bei 8 zur selben Zeit wie der von P7 bei 13.
    const P10 = await person({ betreuer: 8, tier: 2 });
    const t10 = await terminDirekt({ personId: P10, agentId: 8, beginn: S1, herkunft: "agent" });

    // Gegenprüfung 29.09. — Zusage: Maras Angebot 30 s VOR der Buchung ist keine Zusage.
    const PA = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000031" });
    const zA = (await mt.freieZeiten(PA)).slots.filter((s) => s.agentId === VERTRETER);
    const rA = await mt.rueckrufBuchen({ personId: PA, nummer: "4915126000031" }, { zeit: wand(zA[zA.length - 2].beginn), anliegen: "Angebot-Probe" });
    if (rA.termin?.id) termineIds.push(rA.termin.id);
    const [tA] = (await sqlPool`SELECT created_at FROM fiaon_termine WHERE id = ${rA.termin!.id}`) as any[];
    const uhrA = rA.termin!.uhrzeit.replace(/^0/, "");
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status, created_at)
      VALUES ('raus', '4915126000031', ${PA}, 'text', ${`Justin kann Sie um 8:10 Uhr, um ${uhrA} Uhr oder um 21:50 Uhr anrufen. Was passt Ihnen?`}, 'gesendet', ${new Date(new Date(tA.created_at).getTime() - 30_000)})`;
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status) VALUES ('raus', '4915126000031', ${PA}, 'text', ${`Soll es um ${uhrA} Uhr sein?`}, 'gesendet')`;
    // Verschoben: Mara bucht und sagt zu, danach ändert ein Mensch die Zeit.
    const PV = await person({ betreuer: BETREUER, tier: 2, nummer: "+4915126000032" });
    const zV = (await mt.freieZeiten(PV)).slots.filter((s) => s.agentId === VERTRETER);
    const rV = await mt.rueckrufBuchen({ personId: PV, nummer: "4915126000032" }, { zeit: wand(zV[zV.length - 3].beginn), anliegen: "Verschiebe-Probe" });
    if (rV.termin?.id) termineIds.push(rV.termin.id);
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, status) VALUES ('raus', '4915126000032', ${PV}, 'text', ${`Gern, Justin ruft Sie um ${rV.termin!.uhrzeit} Uhr an.`}, 'gesendet')`;
    await sqlPool`UPDATE fiaon_termine SET beginn = beginn + INTERVAL '1 day' WHERE id = ${rV.termin!.id}`;
    // Offener verpasster Termin von vor 6 Tagen (A) — vorher nach 3 Tagen aus der Übersicht.
    const PW = await person({ betreuer: BETREUER, tier: 1 });
    const tW = await terminDirekt({ personId: PW, agentId: VERTRETER, beginn: new Date(Date.now() - 6 * 86_400_000), status: "verpasst", herkunft: "gruender_seite" });
    // Erledigte Zeile eines Abbrechers — vorher „C“.
    const PAb = await person({ betreuer: BETREUER, tier: 3, grund: "antrag_abgebrochen" });
    const tAb = await terminDirekt({ personId: PAb, agentId: BETREUER, beginn: new Date(Date.now() - 20 * 3_600_000), status: "erledigt", herkunft: "agent" });

    const r = await holen("/chef/mara/termine");
    const d = r.json;
    ok("200, ok, Abwesenheit an mit Vertreter 928, 13 unter „abwesend“", r.status === 200 && d?.ok && d.abwesenheit?.an && d.abwesenheit.vertreter?.id === VERTRETER
      && d.abwesenheit.abwesend.some((x: any) => x.id === BETREUER), { status: r.status, ab: d?.abwesenheit });
    const zeile = (id: number) => (d?.termine ?? []).find((x: any) => x.id === id);
    const z1 = zeile(terminP1);
    ok("Maras Termin: Marke „von Mara · WhatsApp“, beim Vertreter, neu", z1?.mara?.weg === "mara_whatsapp" && z1?.mara?.kanal === "WhatsApp" && z1?.bei?.istVertreter === true && z1?.neu === true, z1);
    ok("Maras Zusage aus fiaon_whatsapp (mit der Uhrzeit)", String(z1?.mara?.zusage ?? "").includes(uhr), z1?.mara);
    ok("Anliegen aus dem Protokoll", String(z1?.mara?.anliegen ?? "").includes(MARKE), z1?.mara?.anliegen);
    const z7 = (d?.termine ?? []).find((x: any) => x.person?.id === P7 && x.status === "gebucht");
    ok("Termin bei 13: „Betreuer abwesend“ und gleichzeitig mit dem Termin bei 8", z7?.beiAbwesendem === true && z7?.gleichzeitigMit?.some((g: any) => g.id === t10.id), z7);
    ok("Testperson fehlt", !zeile(tT.id));
    const zA2 = zeile(rA.termin!.id);
    ok("Zusage: Maras Angebot 30 s vor der Buchung und eine Rückfrage danach sind keine Zusage", !!zA2 && zA2.mara?.zusage === null, zA2?.mara);
    const zV2 = zeile(rV.termin!.id);
    ok("Verschoben seit Maras Zusage: kein Zitat, dafür verschobenVon = die gebuchte Zeit",
      !!zV2 && zV2.mara?.zusage === null && zV2.mara?.verschobenVon === rV.termin!.beginn, zV2?.mara);
    const zW = zeile(tW.id);
    ok("offener verpasster Termin von vor 6 Tagen: steht da und wartet (Glas oder „wartet“)", !!zW && (zW.gruppe === "wartet" || zW.gruppe === "jetzt"), zW?.gruppe);
    ok("Zähler „wartet“ zählt ihn mit", Number(d?.zaehler?.wartet) >= 1);
    const zAb = zeile(tAb.id);
    ok("Erledigte Zeile eines Abbrechers: Stufe „abbrecher“ wie in der Telefonkartei (vorher „C“)", zAb?.person?.stufe === "abbrecher", zAb?.person);
    const mail = (d?.termine ?? []).find((x: any) => x.mara?.weg === "mara_mail");
    ok("Mail-Termin: Anliegen aus der Notiz „Rückrufwunsch aus E-Mail …“", String(mail?.mara?.anliegen ?? "").includes(MARKE), mail?.mara);
    ok("genau ein „jetzt“", (d?.termine ?? []).filter((x: any) => x.gruppe === "jetzt").length === 1);
    ok("Zähler: bei Abwesenden gezählt, Vorschläge für „bis“ da", Number(d?.zaehler?.beiAbwesenden) >= 1 && (d?.abwesenheit?.vorschlaege ?? []).length >= 3, d?.zaehler);
    const ohne = await echtFetch(`${basis}/chef/mara/termine`);
    ok("ohne Anmeldung: 401", ohne.status === 401);
  }

  // ═══ 12. Routen POST ════════════════════════════════════════════════════════
  abschnitt("12. POST …/ergebnis und POST /chef/mara/abwesenheit");
  {
    const ref = `FIAON-P260${Date.now().toString(36).toUpperCase()}`;
    refs.push(ref);
    const P11 = await person({ betreuer: BETREUER, tier: 2 });
    await sqlPool`INSERT INTO fiaon_applications (ref, person_id, payment_reference, status) VALUES (${ref}, ${P11}, ${ref}, 'submitted')`;
    const vor13 = new Date(Date.now() - 13 * 3_600_000);
    const t11 = await terminDirekt({ personId: P11, agentId: BETREUER, beginn: vor13, herkunft: "mara_whatsapp" });
    const P12 = await person({ betreuer: BETREUER, tier: 2 });
    const t12 = await terminDirekt({ personId: P12, agentId: BETREUER, beginn: new Date(vor13.getTime() - 20 * 60_000), herkunft: "mara_whatsapp" });
    const e = await post(`/chef/mara/termine/${t11.id}/ergebnis`, { ergebnis: "erledigt" });
    ok("Erledigt: 200 mit Hinweis", e.status === 200 && e.json?.ok && /erledigt/.test(String(e.json?.hinweis)), e);
    const [a11] = (await sqlPool`SELECT status, erledigt_am, agent_id FROM fiaon_termine WHERE id = ${t11.id}`) as any[];
    const [p11] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${P11}`) as any[];
    ok("Termin erledigt, agent_id bleibt 13, Kunde bleibt bei 13", a11?.status === "erledigt" && !!a11?.erledigt_am && Number(a11?.agent_id) === BETREUER && Number(p11?.assigned_agent_id) === BETREUER, { a11, p11 });
    const [cl] = (await sqlPool`SELECT agent_id, agent_name, note FROM fiaon_contact_log WHERE ref = ${ref} ORDER BY id DESC LIMIT 1`) as any[];
    ok("Verlauf der Akte: vom Chef, „für Nikita“, „erledigt“", Number(cl?.agent_id) === VERTRETER && /Chefbüro, für Nikita/.test(String(cl?.agent_name)) && /erledigt/.test(String(cl?.note)), cl);
    const { runVerpassteTermine } = await import("../server/routes/fiaon-startgespraech");
    await runVerpassteTermine();
    const [n11] = (await sqlPool`SELECT status FROM fiaon_termine WHERE id = ${t11.id}`) as any[];
    const [n12] = (await sqlPool`SELECT status FROM fiaon_termine WHERE id = ${t12.id}`) as any[];
    ok("B7: nach dem 12-Stunden-Lauf bleibt er erledigt", n11?.status === "erledigt", n11);
    ok("Rot-Probe B7: ohne Abschluss wird derselbe Fall „verpasst“", n12?.status === "verpasst", n12);
    const P13 = await person({ betreuer: BETREUER, tier: 0 });
    const t13 = await terminDirekt({ personId: P13, agentId: BETREUER, beginn: new Date(new Date(S3).getTime() + 60 * 60_000), quelle: "onboarding_call", herkunft: "onboarding_einladung" });
    const s = await post(`/chef/mara/termine/${t13.id}/ergebnis`, { ergebnis: "erledigt" });
    ok("Startgespräch: 409 mit Verweis auf die Akte", s.status === 409 && /Akte/.test(String(s.json?.error)), s);
    ok("unbekannter Termin: 404; falsches Ergebnis: 400",
      (await post(`/chef/mara/termine/999999999/ergebnis`, { ergebnis: "erledigt" })).status === 404
      && (await post(`/chef/mara/termine/${t13.id}/ergebnis`, { ergebnis: "gelöscht" })).status === 400);
    const aus = await post("/chef/mara/abwesenheit", { an: false });
    ok("Schalter aus über die Route: ok, Abwesenheit aus", aus.status === 200 && aus.json?.ok && aus.json?.abwesenheit?.an === false && aus.json?.abwesenheit?.endeteWie === "beendet", aus.json);
    await warte(300);
    const [log] = (await sqlPool`SELECT ziel, notiz, agent_id FROM fiaon_admin_log WHERE pfad LIKE '%/chef/mara/abwesenheit' AND ziel = 'team_abwesenheit' ORDER BY id DESC LIMIT 1`) as any[];
    ok("Protokollzeile im Chef-Protokoll (wer, was)", Number(log?.agent_id) === VERTRETER && /^beendet/.test(String(log?.notiz)), log);
    const falsch = await post("/chef/mara/abwesenheit", { an: true, bis: bis.toISOString(), vertreterId: 531 });
    ok("Schalter an mit Vertreter ohne Zeiten: 409 mit Klartext", falsch.status === 409 && /Arbeitszeiten/.test(String(falsch.json?.error)), falsch.json);
    const an = await post("/chef/mara/abwesenheit", { an: true, bis: wand(bis), vertreterId: VERTRETER });
    ok("Schalter an über die Route: ok, an, bis wie gewählt", an.status === 200 && an.json?.abwesenheit?.an === true && Math.abs(new Date(an.json.abwesenheit.bis).getTime() - bis.getTime()) < 60_000, an.json?.abwesenheit);
  }
} catch (e) {
  ok("Prüfstand ohne Ausnahme durchgelaufen", false, String((e as Error)?.stack ?? e).slice(0, 900));
} finally {
  if (server) server.close();
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  ok("kein fremder Netzaufruf (nur Brevo-Attrappe)", FREMD.length === 0, FREMD);
  console.log(`\n${gruen} ok, ${rot} rot${rot ? `\n  ${fehler.join("\n  ")}` : ""}`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(rot ? 1 : 0);
}
