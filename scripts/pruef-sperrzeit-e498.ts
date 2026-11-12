// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-498 (12.11.2026): ZEIT BLOCKIEREN — SPERRZEITEN FÜR DIE BUCHUNGSSEITEN
//
// Ausfall: Von Hand vereinbarte Zeiten (Zoom, Treffen vor Ort) standen nur in einem Apple-Kalender; die
// Buchungsseiten kannten nur Plattform-Termine → zweimal in zwei Tagen drohte eine Doppelbuchung.
// Fix: fiaon_sperrzeiten (Migration 133), Schreiben nur über sperrzeitAnlegen/sperrzeitLoeschen
// (server/lib/fiaon-sperrzeit.ts), Regeln rein in fiaon-sperrzeit-regeln.ts, Abzug in rohSlots,
// globalAngebotLaden und im Startgespräch-Angebot, „Belegt“ im Kalender-Abo.
//
//   A  REIN (keine Datenbank, keine Uhr — `jetzt` als Parameter)
//      1  Eingabeprüfung: Berliner Wandzeit (Sommer/Winter), Sekunden weg, 5 Minuten / 62 Tage,
//         Ende vor Beginn, vorbei, zu weit, Notiz bereinigt
//      2  Überschneidung: halboffen — Rand frei, eine Minute drin = gesperrt; Takt 15/20/30
//      3  Global-Kalender (globalZeitenRechnen) mit den beiden Fällen vom 11./12.11.: Fr 13.11. 14:30 Zoom,
//         Mi 18.11. 16:00–18:30 Treffen; Tagesdeckel und Vorlauf UNVERÄNDERT; mehrtägig; Zeitumstellung
//      4  Kurztext
//   B  MIT DATENBANK (lokal, fiaon_pruefstand_*)
//      5  Anlegen/Doppelklick/ungültig; Zeile weich gelöscht; nur die EIGENE Zeit löschbar
//      6  rohSlots VORHER/NACHHER (Takt 20/30/15, Rand), andere Person unberührt, Löschen gibt frei
//      7  freieSlots (Terminlink): kein Platz in der Sperre, Tagesdeckel (5) unverändert
//      8  globalAngebotLaden + globalTerminBuchen: gesperrte Zeit wird weder angeboten noch angenommen
//      9  Startgespräch-Angebot: sperrenAlsBelegung → startgespraechZeitenRechnen
//      10 Kein Nebeneffekt: kein Termin, keine Mail, kein Telefon-Wortlaut; schon gebuchter Termin wird gemeldet,
//         bleibt aber bestehen
//      11 Kalender-Abo: „Belegt“ ohne Notiz und ohne Kunde, Team-Abo mit Vorname, weg nach Löschen, Zwischenspeicher
//      12 Fehlt die Tabelle, rechnet alles wie vorher (keine Ausnahme)
//      13 Schreibstelle: keine zweite INSERT/UPDATE/DELETE-Stelle im Quelltext
//
// NUR gegen die lokale Test-DB (fiaon_pruefstand_*). Kein Netz, keine Schlüssel:
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null SESSION_SECRET=pruefstand-nur-lokal \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e498?sslmode=require' npx tsx scripts/pruef-sperrzeit-e498.ts
//   Abschnitt C (Tabelle fehlt, Server vor der Migration): dasselbe mit --ohne-tabelle gegen eine Datenbank OHNE Migration 133
//   (z. B. createdb -T fiaon_pruefstand_e469 fiaon_pruefstand_e498_ohne).
// Eigene Datensätze (Konten „Sperre Alpha/Beta“, Person PRUEF498-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
// Jede Verbindung nach außen ist gesperrt (kein Brevo, kein Meta, nichts) — nur localhost.
const echtFetch = globalThis.fetch;
const FREMD: string[] = [];
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  FREMD.push(u);
  throw new Error(`Prüfstand: Verbindung nach außen gesperrt (${u.slice(0, 60)})`);
}) as typeof fetch;

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const mal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Abschnitt C: eine Datenbank, in der Migration 133 NICHT gelaufen ist (Server startet, bevor die Tabelle da ist). */
async function ohneTabelle() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const sperrM = await import("../server/lib/fiaon-sperrzeit");
  const termine = await import("../server/lib/fiaon-termine");
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_sperrzeiten') IS NOT NULL AS da`) as any[];
  if (t.da) { console.error("Die Tabelle fiaon_sperrzeiten existiert — für --ohne-tabelle eine Datenbank OHNE Migration 133 nehmen."); process.exit(3); }
  titel("C  Tabelle fehlt (Server vor der Migration): alles rechnet wie vor E-498");
  let agent = 0;
  try {
    const [a] = (await sqlPool`INSERT INTO fiaon_agents (name, first_name, email, active, rolle) VALUES ('Sperre Gamma', 'Gamma', ${`sperre-gamma-${Date.now()}@beispiel.invalid`}, TRUE, 'agent') RETURNING id`) as any[];
    agent = Number(a.id);
    await termine.verfuegbarkeitSetzen(agent, [1, 2, 3, 4, 5].map((w) => ({ wochentag: w, von: "09:00", bis: "18:00", aktiv: true })));
    ok("Tabelle fehlt: sperrzeitTabelleDa() = false", (await sperrM.sperrzeitTabelleDa()) === false);
    let wirft = ""; let slots: any[] = [];
    try { slots = await termine.rohSlots([{ id: agent, vorname: "Gamma" }], 20); } catch (e) { wirft = String((e as Error)?.message ?? e); }
    ok("rohSlots wirft nicht und liefert Plätze", wirft === "" && slots.length > 0, wirft);
    ok("sperrenLesen / sperrenJePerson / sperrenAlsBelegung / sperrzeitenListe: leer, ohne Ausnahme",
      (await sperrM.sperrenLesen([agent], new Date(), new Date(Date.now() + 86_400_000))).length === 0
      && (await sperrM.sperrenJePerson([agent], new Date(), new Date(Date.now() + 86_400_000))).size === 0
      && (await sperrM.sperrenAlsBelegung(agent, new Date(), new Date(Date.now() + 86_400_000))).length === 0
      && (await sperrM.sperrzeitenListe(agent)).length === 0);
    const nah = new Date(Date.now() + 3 * 86_400_000); const iso = (d: Date) => d.toISOString().slice(0, 16) + ":00Z";
    const anl2 = await sperrM.sperrzeitAnlegen({ agentId: agent, beginn: iso(nah), ende: iso(new Date(nah.getTime() + 3_600_000)) });
    ok("Anlegen ohne Tabelle: verständliche Meldung (code keine_tabelle) statt Absturz", !anl2.ok && anl2.code === "keine_tabelle", JSON.stringify(anl2).slice(0, 120));
    ok("Löschen ohne Tabelle → false", (await sperrM.sperrzeitLoeschen(1, agent)) === false);
    const abo = await import("../server/lib/fiaon-kalender-abo");
    const z = await abo.aboHolen(agent, "eigene", "Prüfstand E-498");
    let feedFehler = ""; let ics = "";
    try { if (z) ics = (await abo.aboFeed(z)).ics; } catch (e) { feedFehler = String((e as Error)?.message ?? e); }
    ok("Kalender-Abo ohne Tabelle: Feed wird gebaut, ohne Sperrzeit-Einträge", !!z && feedFehler === "" && ics.includes("BEGIN:VCALENDAR") && !ics.includes("sperrzeit-"), feedFehler);
    if (z) await sqlPool`DELETE FROM fiaon_kalender_abo WHERE id = ${z.id}`.catch(() => {});
    ok("Kein Aufruf nach außen", FREMD.length === 0, FREMD.join(", "));
  } finally {
    if (agent) {
      await sqlPool`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${agent}`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_agents WHERE id = ${agent}`.catch(() => {});
    }
    await sqlPool.end({ timeout: 2 }).catch(() => {});
  }
  titel(`ERGEBNIS (ohne Tabelle): ${gut} ok, ${schlecht} rot`);
  process.exit(schlecht ? 1 : 0);
}

async function main() {
  if (process.argv.includes("--ohne-tabelle")) return ohneTabelle();
  const regeln = await import("../server/lib/fiaon-sperrzeit-regeln");
  const {
    sperrzeitPruefen, sperrzeitUeberlappt, sperrzeitAlsBelegung, sperrzeitKurz, zeitpunktKurz, sperrzeitGrund, sperrFensterMs,
    SPERRZEIT_MIN_MINUTEN, SPERRZEIT_MAX_TAGE, SPERRZEIT_GRUND_MAX,
  } = regeln;
  const { globalZeitenRechnen, kalendertagPlus, GLOBAL_PRO_TAG } = await import("../server/lib/fiaon-global-zeiten");
  const { parseBerlinInput, berlinDatum, berlinWochentag, berlinZeitpunkt } = await import("../server/lib/fiaon-time");

  // ═════════════════════════════════════════════════════════════════════════
  titel("A1  Eingabeprüfung (rein)");
  // ═════════════════════════════════════════════════════════════════════════
  const jetzt = new Date("2026-11-12T09:00:00Z"); // Do 12.11.2026, 10:00 Berlin
  const gueltig = sperrzeitPruefen({ beginn: "2026-11-18T16:00", ende: "2026-11-18T18:30", grund: "Treffen vor Ort" }, jetzt);
  ok("gültige Eingabe wird angenommen", gueltig.ok === true);
  if (gueltig.ok) {
    ok("Winter: 16:00 Berliner Zeit = 15:00 UTC, Ende 17:30 UTC", gueltig.beginn.toISOString() === "2026-11-18T15:00:00.000Z" && gueltig.ende.toISOString() === "2026-11-18T17:30:00.000Z", `${gueltig.beginn.toISOString()} – ${gueltig.ende.toISOString()}`);
    ok("Notiz bleibt", gueltig.grund === "Treffen vor Ort");
  }
  const sommer = sperrzeitPruefen({ beginn: "2027-03-30T10:00", ende: "2027-03-30T11:00" }, new Date("2027-03-20T09:00:00Z"));
  ok("Sommer: 10:00 Berliner Zeit = 08:00 UTC", sommer.ok && sommer.beginn.toISOString() === "2027-03-30T08:00:00.000Z", sommer.ok ? sommer.beginn.toISOString() : sommer.error);
  const mitSek = sperrzeitPruefen({ beginn: "2026-11-18T16:00:45", ende: "2026-11-18T17:00:59" }, jetzt);
  ok("Sekunden werden abgeschnitten", mitSek.ok && mitSek.beginn.getUTCSeconds() === 0 && mitSek.ende.getUTCSeconds() === 0);
  const mitZone = sperrzeitPruefen({ beginn: "2026-11-18T15:00:00Z", ende: "2026-11-18T16:00:00+00:00" }, jetzt);
  ok("Eingabe mit Zeitzone gilt unverändert", mitZone.ok && mitZone.beginn.toISOString() === "2026-11-18T15:00:00.000Z");
  const fehl = (e: any) => { const p = sperrzeitPruefen(e, jetzt); return p.ok ? "ok" : p.code; };
  ok("Ende gleich Beginn → ende_vor_beginn", fehl({ beginn: "2026-11-18T16:00", ende: "2026-11-18T16:00" }) === "ende_vor_beginn");
  ok("Ende vor Beginn → ende_vor_beginn", fehl({ beginn: "2026-11-18T17:00", ende: "2026-11-18T16:00" }) === "ende_vor_beginn");
  ok(`${SPERRZEIT_MIN_MINUTEN - 1} Minuten → zu_kurz`, fehl({ beginn: "2026-11-18T16:00", ende: "2026-11-18T16:04" }) === "zu_kurz");
  ok(`genau ${SPERRZEIT_MIN_MINUTEN} Minuten → ok`, fehl({ beginn: "2026-11-18T16:00", ende: "2026-11-18T16:05" }) === "ok");
  ok(`genau ${SPERRZEIT_MAX_TAGE} Tage → ok, ein Tag mehr → zu_lang`,
    fehl({ beginn: "2026-11-13T00:00", ende: "2027-01-14T00:00" }) === "ok" && fehl({ beginn: "2026-11-13T00:00", ende: "2027-01-15T00:00" }) === "zu_lang");
  ok("Ende in der Vergangenheit → vorbei", fehl({ beginn: "2026-11-10T10:00", ende: "2026-11-10T11:00" }) === "vorbei");
  ok("laufend (Beginn vorbei, Ende kommt) → ok", fehl({ beginn: "2026-11-12T09:00", ende: "2026-11-12T15:00" }) === "ok");
  ok("mehr als ein Jahr voraus → zu_weit", fehl({ beginn: "2028-01-01T10:00", ende: "2028-01-01T11:00" }) === "zu_weit");
  ok("Beginn fehlt / kaputt / keine Zeichenkette → beginn_fehlt", fehl({ ende: "2026-11-18T17:00" }) === "beginn_fehlt" && fehl({ beginn: "morgen", ende: "2026-11-18T17:00" }) === "beginn_fehlt" && fehl({ beginn: 12345, ende: "2026-11-18T17:00" }) === "beginn_fehlt");
  ok("Ende fehlt → ende_fehlt", fehl({ beginn: "2026-11-18T16:00" }) === "ende_fehlt");
  ok("Notiz: Leerzeichen zusammen, Steuerzeichen raus", sperrzeitGrund("  Zoom \n\t mit   Firma\u0007 ") === "Zoom mit Firma");
  ok("Notiz leer → null", sperrzeitGrund("   ") === null && sperrzeitGrund(null) === null && sperrzeitGrund(undefined) === null);
  ok(`Notiz höchstens ${SPERRZEIT_GRUND_MAX} Zeichen`, (sperrzeitGrund("x".repeat(500)) ?? "").length === SPERRZEIT_GRUND_MAX);

  // ═════════════════════════════════════════════════════════════════════════
  titel("A2  Überschneidung — halboffen, auch am Rand");
  // ═════════════════════════════════════════════════════════════════════════
  const MIN = 60_000;
  const t0 = Date.parse("2026-11-18T15:00:00Z"); // 16:00 Berlin
  const sperre = [{ von: t0, bis: t0 + 150 * MIN }]; // bis 18:30
  const frei = (startMin: number, takt: number) => !sperrzeitUeberlappt(sperre, t0 + startMin * MIN, takt);
  ok("Takt 30: Slot endet genau zum Beginn (15:30–16:00) → frei", frei(-30, 30));
  ok("Takt 30: Slot beginnt genau zum Ende (18:30) → frei", frei(150, 30));
  ok("Takt 30: Slot 15:50 (endet 16:20) → gesperrt", !frei(-10, 30));
  ok("Takt 30: Slot 18:20 (beginnt vor 18:30) → gesperrt", !frei(140, 30));
  ok("Takt 20: Slot 15:40–16:00 → frei, 15:41 → gesperrt", frei(-20, 20) && !frei(-19, 20));
  ok("Takt 15: Slot 15:45–16:00 → frei, 15:46 → gesperrt", frei(-15, 15) && !frei(-14, 15));
  ok("Slot mitten in der Sperre → gesperrt; Slot, der die Sperre ganz umfasst, → gesperrt", !frei(60, 20) && sperrzeitUeberlappt([{ von: t0 + 10 * MIN, bis: t0 + 20 * MIN }], t0, 60));
  ok("keine Sperren (leer/undefined/null) → nie gesperrt", !sperrzeitUeberlappt([], t0, 30) && !sperrzeitUeberlappt(undefined, t0, 30) && !sperrzeitUeberlappt(null, t0, 30));
  ok("kaputtes Fenster sperrt nichts", sperrFensterMs({ beginn: "kaputt", ende: "2026-11-18T17:00:00Z" }) === null && sperrFensterMs({ beginn: "2026-11-18T17:00:00Z", ende: "2026-11-18T16:00:00Z" }) === null);

  // ═════════════════════════════════════════════════════════════════════════
  titel("A3  Global-Kalender: die beiden Fälle vom 11./12.11.2026");
  // ═════════════════════════════════════════════════════════════════════════
  const FENSTER = [1, 2, 3, 4, 5].map((w) => ({ wochentag: w, von: "09:00", bis: "18:00", aktiv: true }));
  const rechnen = (belegt: any[], j = jetzt) => globalZeitenRechnen({ jetzt: j, fenster: FENSTER, belegt, tage: 14 });
  const alsBelegung = (e: any) => { const p = sperrzeitPruefen(e, jetzt); if (!p.ok) throw new Error(p.error); return sperrzeitAlsBelegung(p)!; };
  const am = (erg: any, tag: string) => erg.frei.filter((f: any) => f.tag === tag).map((f: any) => f.zeit) as string[];
  const ohne = rechnen([]);
  const mitTreffen = rechnen([alsBelegung({ beginn: "2026-11-18T16:00", ende: "2026-11-18T18:30" })]);
  ok("Mi 18.11. ohne Sperre: 14:00 und 17:30 werden angeboten (der Ausfall)", am(ohne, "2026-11-18").includes("14:00") && am(ohne, "2026-11-18").includes("17:30"));
  ok("Mi 18.11. Treffen 16:00–18:30: 17:30 weg, 16:00/16:30/17:00 weg", ["16:00", "16:30", "17:00", "17:30"].every((z) => !am(mitTreffen, "2026-11-18").includes(z)));
  ok("… 14:00 und 15:30 bleiben frei (Rand 16:00 genau)", am(mitTreffen, "2026-11-18").includes("14:00") && am(mitTreffen, "2026-11-18").includes("15:30"));
  ok("… genau diese vier Zeiten fehlen, sonst nichts", mal(am(ohne, "2026-11-18").filter((z) => !am(mitTreffen, "2026-11-18").includes(z)), ["16:00", "16:30", "17:00", "17:30"]));
  ok("… alle anderen Tage unverändert", ohne.frei.filter((f: any) => f.tag !== "2026-11-18").length === mitTreffen.frei.filter((f: any) => f.tag !== "2026-11-18").length);
  const mitZoom = rechnen([alsBelegung({ beginn: "2026-11-13T14:30", ende: "2026-11-13T15:30" })]);
  ok("Fr 13.11. Zoom 14:30–15:30: 14:30 und 15:00 weg", !am(mitZoom, "2026-11-13").includes("14:30") && !am(mitZoom, "2026-11-13").includes("15:00"));
  ok("… 14:00 (endet 14:30) und 15:30 bleiben", am(mitZoom, "2026-11-13").includes("14:00") && am(mitZoom, "2026-11-13").includes("15:30"));
  ok("Nur 14:30 gesperrt (Zoom ohne Ende gedacht, 5 Minuten): 14:30 weg, 15:00 bleibt", (() => { const e = rechnen([alsBelegung({ beginn: "2026-11-13T14:30", ende: "2026-11-13T14:35" })]); return !am(e, "2026-11-13").includes("14:30") && am(e, "2026-11-13").includes("15:00"); })());
  ok("Tagesdeckel UNVERÄNDERT: restJeTag mit und ohne Sperre gleich", mal(ohne.restJeTag, mitTreffen.restJeTag) && mal(ohne.restJeTag, mitZoom.restJeTag) && ohne.restJeTag["2026-11-18"] === GLOBAL_PRO_TAG);
  ok("Vorlauf UNVERÄNDERT: frühester Platz bleibt Do 12.11. 12:00 (2 h)", ohne.frei[0].tag === "2026-11-12" && ohne.frei[0].zeit === "12:00" && mitTreffen.frei[0].zeit === "12:00");
  ok("Die Sperre erzeugt nie einen neuen Platz", mitTreffen.frei.every((f: any) => ohne.frei.some((o: any) => o.beginn === f.beginn)));
  // Eine Sperre verbraucht keinen Platz: Bei vollem Deckel (acht Global-Gespräche an einem Tag) bleibt der Tag zu — mit Sperre erst recht.
  const mehrtaegig = rechnen([alsBelegung({ beginn: "2026-11-18T18:00", ende: "2026-11-19T12:00" })]);
  ok("mehrtägig (Mi 18:00 – Do 12:00): Do 09:00–11:30 komplett weg, 12:00 frei", ["09:00", "10:00", "11:00", "11:30"].every((z) => !am(mehrtaegig, "2026-11-19").includes(z)) && am(mehrtaegig, "2026-11-19").includes("12:00"));
  // Zeitumstellung: Sa 27.03.2027 20:00 (Winterzeit, UTC+1) → So 28.03.2027 10:00 (Sommerzeit, UTC+2).
  // Auf der Uhr sind das 14 Stunden, in Wirklichkeit 13 (19:00 UTC → 08:00 UTC) — die Dauer rechnet in echter Zeit.
  const dst = sperrzeitPruefen({ beginn: "2027-03-27T20:00", ende: "2027-03-28T10:00" }, new Date("2027-03-20T09:00:00Z"));
  const dstB = dst.ok ? sperrzeitAlsBelegung(dst) : null;
  ok("Zeitumstellung: 20:00 → 10:00 über die Umstellung = 13 Stunden echte Dauer (780 Minuten)", !!dstB && dstB.dauerMin === 780, dstB ? String(dstB.dauerMin) : "?");
  const mo = rechnen([alsBelegung({ beginn: "2026-11-16T09:00", ende: "2026-11-16T10:00" })], new Date("2026-11-12T09:00:00Z"));
  ok("Montag 09:00–10:00 gesperrt → 09:00 und 09:30 weg, 10:00 frei", !am(mo, "2026-11-16").includes("09:00") && !am(mo, "2026-11-16").includes("09:30") && am(mo, "2026-11-16").includes("10:00"));
  ok("kaputte Belegung (Ende vor Beginn) → keine Belegung", sperrzeitAlsBelegung({ beginn: "2026-11-18T17:00:00Z", ende: "2026-11-18T16:00:00Z" }) === null);
  ok("Belegung trägt zaehltAlsGlobal=false und die echte Dauer", (() => { const b = alsBelegung({ beginn: "2026-11-18T16:00", ende: "2026-11-18T18:30" }); return b.zaehltAlsGlobal === false && b.dauerMin === 150; })());

  // ═════════════════════════════════════════════════════════════════════════
  titel("A4  Kurztext");
  // ═════════════════════════════════════════════════════════════════════════
  const k1 = sperrzeitKurz("2026-11-18T15:00:00Z", "2026-11-18T17:30:00Z");
  ok("eintägig: „Mi 18.11., 16:00–18:30 Uhr“", k1 === "Mi 18.11., 16:00–18:30 Uhr", k1);
  const k2 = sperrzeitKurz("2026-11-18T15:00:00Z", "2026-11-20T11:00:00Z");
  ok("mehrtägig: „Mi 18.11. 16:00 – Fr 20.11. 12:00 Uhr“", k2 === "Mi 18.11. 16:00 – Fr 20.11. 12:00 Uhr", k2);
  ok("kaputt → leer", sperrzeitKurz("x", "y") === "" && zeitpunktKurz("x") === "");
  const zp = zeitpunktKurz("2026-11-18T16:00:00Z");
  ok("einzelner Zeitpunkt: „Mi 18.11., 17:00 Uhr“ (ohne Punkt hinter Mi, ohne doppeltes Komma)", zp === "Mi 18.11., 17:00 Uhr", zp);

  // ═════════════════════════════════════════════════════════════════════════
  // B — MIT DATENBANK
  // ═════════════════════════════════════════════════════════════════════════
  const { sqlPool } = await import("../server/lib/db-pool");
  const sperrM = await import("../server/lib/fiaon-sperrzeit");
  const { sperrzeitAnlegen, sperrzeitLoeschen, sperrzeitenListe, sperrenAlsBelegung, sperrenJePerson } = sperrM;
  const termine = await import("../server/lib/fiaon-termine");
  const { rohSlots, freieSlots, verfuegbarkeitSetzen } = termine;

  const eigen = { agenten: [] as number[], personen: [] as number[], settings: [] as { key: string; alt: string | null }[], aboZeilen: [] as number[] };
  const agentAnlegen = async (name: string, vorname: string, extra: { stufe?: string } = {}) => {
    const [a] = (await sqlPool`
      INSERT INTO fiaon_agents (name, first_name, email, active, rolle, admin_stufe)
      VALUES (${name}, ${vorname}, ${`sperre-${vorname.toLowerCase()}-${Date.now()}@beispiel.invalid`}, TRUE, 'agent', ${extra.stufe ?? null})
      RETURNING id`) as any[];
    const id = Number(a.id);
    eigen.agenten.push(id);
    await verfuegbarkeitSetzen(id, [1, 2, 3, 4, 5].map((w) => ({ wochentag: w, von: "09:00", bis: "18:00", aktiv: true })));
    return id;
  };

  // Der Vorher-Stand der Tabelle wird gemerkt, damit am Ende nichts Fremdes angefasst wurde.
  const [tabelle] = (await sqlPool`SELECT to_regclass('public.fiaon_sperrzeiten') IS NOT NULL AS da`) as any[];
  if (!tabelle.da) { console.error("fiaon_sperrzeiten fehlt — erst scripts/run-migrations.mjs gegen die lokale DB laufen lassen."); process.exit(3); }

  try {
    const A = await agentAnlegen("Sperre Alpha", "Alpha");
    const B = await agentAnlegen("Sperre Beta", "Beta");
    const INH = await agentAnlegen("Sperre Inhaber", "Inhaber", { stufe: "inhaber" });
    log(`\n  (Prüfkonten: Alpha #${A}, Beta #${B}, Inhaber #${INH} — am Ende entfernt)`);

    // Ein Mittwoch 4–10 Tage voraus — mitten im 14-Tage-Horizont, weit hinter dem Vorlauf.
    const heute = berlinDatum(new Date());
    let tagMi = "";
    for (let i = 4; i <= 11 && !tagMi; i++) { const t = kalendertagPlus(heute, i); if (berlinWochentag(t) === 3) tagMi = t; }
    const wann = (hhmm: string, tag = tagMi) => `${tag}T${hhmm}`;
    const zeitIn = (tag: string, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return berlinZeitpunkt(tag, h * 60 + m).toISOString(); };
    const tageszeiten = (slots: { beginn: string; datum: string; uhrzeit: string; agentId: number }[], agent: number, tag = tagMi) =>
      slots.filter((s) => s.datum === tag && s.agentId === agent).map((s) => s.uhrzeit);
    log(`  (Prüftag: Mittwoch ${tagMi})`);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B5  Anlegen, Doppelklick, ungültig, Löschen");
    // ═══════════════════════════════════════════════════════════════════════
    const mailVorher = await zaehlen("fiaon_mail_log");
    const termineVorher = await zaehlen("fiaon_termine");
    const r1 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), grund: "Treffen vor Ort", vonAgentId: A });
    ok("anlegen → ok", r1.ok === true, r1.ok ? "" : r1.error);
    if (!r1.ok) throw new Error("ohne Sperrzeit keine weiteren Prüfungen");
    const id1 = r1.sperrzeit.id;
    ok("Zeile trägt Person, von/bis (UTC), Notiz", r1.sperrzeit.agentId === A && r1.sperrzeit.beginn.toISOString() === zeitIn(tagMi, "16:00") && r1.sperrzeit.ende.toISOString() === zeitIn(tagMi, "18:30") && r1.sperrzeit.grund === "Treffen vor Ort");
    const r1b = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), grund: "zweiter Klick", vonAgentId: A });
    ok("Doppelklick → dieselbe Zeile, schon=true", r1b.ok && r1b.schon === true && r1b.sperrzeit.id === id1);
    ok("… und es gibt genau eine aktive Zeile", (await zaehlen("fiaon_sperrzeiten", `agent_id = ${A} AND geloescht_am IS NULL`)) === 1);
    const kaputt = await sperrzeitAnlegen({ agentId: A, beginn: wann("18:00"), ende: wann("17:00") });
    ok("ungültig (Ende vor Beginn) → ok:false, nichts geschrieben", !kaputt.ok && (await zaehlen("fiaon_sperrzeiten", `agent_id = ${A}`)) === 1);
    const ohnePerson = await sperrzeitAnlegen({ agentId: 0, beginn: wann("10:00"), ende: wann("11:00") });
    ok("ohne Person (agentId 0) → ok:false", !ohnePerson.ok);
    const liste = await sperrzeitenListe(A);
    ok("Liste: kommende eigene Sperre, andere Person leer", liste.length === 1 && liste[0].id === id1 && (await sperrzeitenListe(B)).length === 0);
    ok("fremde Kennung löscht nichts (Beta löscht Alphas Zeit)", (await sperrzeitLoeschen(id1, B, B)) === false && (await sperrzeitenListe(A)).length === 1);
    ok("Kennung 0 / -1 / NaN löschen nichts", !(await sperrzeitLoeschen(0, A)) && !(await sperrzeitLoeschen(-1, A)) && !(await sperrzeitLoeschen(Number("x"), A)));

    // ═══════════════════════════════════════════════════════════════════════
    titel("B6  rohSlots: VORHER / NACHHER, andere Person, Löschen gibt frei");
    // ═══════════════════════════════════════════════════════════════════════
    // Positivprobe (Rot ohne Fix): dieselbe Rechnung OHNE Sperre bietet die Zeiten an.
    await sperrzeitLoeschen(id1, A, A);
    const vor20 = tageszeiten(await rohSlots([{ id: A, vorname: "Alpha" }, { id: B, vorname: "Beta" }], 20), A);
    ok("VORHER (ohne Sperre, Takt 20): 16:00, 17:00 und 17:40 werden angeboten", ["16:00", "17:00", "17:40"].every((z) => vor20.includes(z)), vor20.join(","));
    const r2 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), grund: "Treffen vor Ort", vonAgentId: A });
    if (!r2.ok) throw new Error(r2.error);
    const id2 = r2.sperrzeit.id;
    const slots20 = await rohSlots([{ id: A, vorname: "Alpha" }, { id: B, vorname: "Beta" }], 20);
    const nach20 = tageszeiten(slots20, A);
    ok("NACHHER Takt 20: nichts zwischen 16:00 und 17:40 mehr (letzter Platz 17:40)", !nach20.some((z) => z >= "16:00"), nach20.join(","));
    ok("… 15:40 (endet genau 16:00) bleibt, davor alles wie vorher", nach20.includes("15:40") && mal(nach20, vor20.filter((z) => z < "16:00")));
    ok("andere Person (Beta) am selben Tag unberührt", mal(tageszeiten(slots20, B), vor20));
    const nach30 = tageszeiten(await rohSlots([{ id: A, vorname: "Alpha" }], 30), A);
    ok("Takt 30 (Gründer-Seite): 15:30 frei, 16:00 bis 17:30 weg", nach30.includes("15:30") && !["16:00", "16:30", "17:00", "17:30"].some((z) => nach30.includes(z)), nach30.join(","));
    const nach15 = tageszeiten(await rohSlots([{ id: A, vorname: "Alpha" }], 15), A);
    ok("Takt 15 (Startgespräch): 15:45 frei, 16:00 bis 17:45 weg", nach15.includes("15:45") && !nach15.some((z) => z >= "16:00"), nach15.join(","));
    // Rand: Sperre 16:10–16:50 mit Takt 20 — 16:00 (bis 16:20) und 16:40 (bis 17:00) ragen hinein, 15:40 und 17:00 nicht.
    const r3 = await sperrzeitAnlegen({ agentId: B, beginn: wann("16:10"), ende: wann("16:50"), vonAgentId: B });
    if (!r3.ok) throw new Error(r3.error);
    const rand20 = tageszeiten(await rohSlots([{ id: B, vorname: "Beta" }], 20), B);
    ok("Rand (Sperre 16:10–16:50, Takt 20): 16:00, 16:20, 16:40 weg; 15:40 und 17:00 bleiben", !["16:00", "16:20", "16:40"].some((z) => rand20.includes(z)) && rand20.includes("15:40") && rand20.includes("17:00"), rand20.join(","));
    // Löschen gibt frei
    ok("freigeben → true", (await sperrzeitLoeschen(id2, A, A)) === true);
    ok("… dieselbe Rechnung bietet 16:00 wieder an", tageszeiten(await rohSlots([{ id: A, vorname: "Alpha" }], 20), A).includes("16:00"));
    ok("… zweites Löschen → false", (await sperrzeitLoeschen(id2, A, A)) === false);
    const [weich] = (await sqlPool`SELECT geloescht_am, geloescht_von FROM fiaon_sperrzeiten WHERE id = ${id2}`) as any[];
    ok("Zeile bleibt (weich gelöscht), mit Zeit und Person", !!weich?.geloescht_am && Number(weich.geloescht_von) === A);
    // Karte je Person
    const karte = await sperrenJePerson([A, B], new Date(Date.now() - 86_400_000), new Date(Date.now() + 15 * 86_400_000));
    ok("sperrenJePerson: nur noch Beta hat eine Sperre", !karte.has(A) && karte.get(B)?.length === 1);
    await sperrzeitLoeschen(r3.sperrzeit.id, B, B);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B7  freieSlots (Terminlink): kein Platz in der Sperre, Tagesdeckel unverändert");
    // ═══════════════════════════════════════════════════════════════════════
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, kind, assigned_agent_id) VALUES ('PRUEF498-1', 'private', ${A}) RETURNING id`) as any[];
    const personId = Number(p.id);
    eigen.personen.push(personId);
    const ohneAuskunft = await freieSlots(personId, sqlPool, "nichterreicht_mail");
    ok("Betreuer = Alpha, Auskunft liefert Plätze", ohneAuskunft.betreuer?.id === A && ohneAuskunft.slots.length > 0, JSON.stringify(ohneAuskunft.betreuer));
    const jeTag = (s: { datum: string }[]) => { const m = new Map<string, number>(); for (const x of s) m.set(x.datum, (m.get(x.datum) ?? 0) + 1); return m; };
    const r4 = await sperrzeitAnlegen({ agentId: A, beginn: wann("09:00"), ende: wann("18:00"), grund: "ganzer Tag", vonAgentId: A });
    if (!r4.ok) throw new Error(r4.error);
    const mitAuskunft = await freieSlots(personId, sqlPool, "nichterreicht_mail");
    ok("Ganztag gesperrt: der Prüftag verschwindet aus dem Angebot", !mitAuskunft.slots.some((s) => s.datum === tagMi) && ohneAuskunft.slots.some((s) => s.datum === tagMi));
    ok("… alle anderen Tage unverändert (gleiche Anzahl je Tag, Tagesdeckel 5 gilt wie vorher)", [...jeTag(ohneAuskunft.slots)].filter(([d]) => d !== tagMi).every(([d, n]) => jeTag(mitAuskunft.slots).get(d) === n) && [...jeTag(mitAuskunft.slots)].every(([, n]) => n <= 5));
    await sperrzeitLoeschen(r4.sperrzeit.id, A, A);
    const r5 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), vonAgentId: A });
    if (!r5.ok) throw new Error(r5.error);
    const teil = await freieSlots(personId, sqlPool, "nichterreicht_mail");
    ok("Teilsperre: kein angebotener Platz überschneidet 16:00–18:30; der Tag hat weiter Plätze", !teil.slots.some((s) => s.datum === tagMi && s.uhrzeit >= "15:50" && s.uhrzeit < "18:30") && teil.slots.some((s) => s.datum === tagMi), teil.slots.filter((s) => s.datum === tagMi).map((s) => s.uhrzeit).join(","));
    ok("… und höchstens 5 Plätze je Tag (Knappheit wie vorher)", [...jeTag(teil.slots)].every(([, n]) => n <= 5));
    await sperrzeitLoeschen(r5.sperrzeit.id, A, A);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B8  Global-Kalender: angeboten UND angenommen (globalAngebotLaden / globalTerminBuchen)");
    // ═══════════════════════════════════════════════════════════════════════
    const einst = async (key: string, wert: string) => {
      const [alt] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`) as any[];
      eigen.settings.push({ key, alt: alt ? String(alt.value) : null });
      await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${key}, ${wert}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    };
    await einst("global_kalender_agent_id", String(A)); // „Gespräche führt“ = Alpha → modus „team“
    const g = await import("../server/lib/fiaon-global-termin");
    const angebotOhne = await g.globalAngebotLaden();
    ok("Global-Kalender führt Alpha, Prüftag hat Zeiten (Vorher)", angebotOhne.person?.id === A && angebotOhne.ergebnis.frei.some((f: any) => f.tag === tagMi && f.zeit === "17:00"), `${angebotOhne.person?.id} ${angebotOhne.grund}`);
    const r6 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), grund: "Treffen vor Ort", vonAgentId: A });
    if (!r6.ok) throw new Error(r6.error);
    const angebotMit = await g.globalAngebotLaden();
    const gMi = (a: any) => a.ergebnis.frei.filter((f: any) => f.tag === tagMi).map((f: any) => f.zeit) as string[];
    ok("Nachher: 16:00, 16:30, 17:00, 17:30 nicht mehr in `frei`; 15:30 und 14:00 bleiben", ["16:00", "16:30", "17:00", "17:30"].every((z) => !gMi(angebotMit).includes(z)) && gMi(angebotMit).includes("15:30") && gMi(angebotMit).includes("14:00"), gMi(angebotMit).join(","));
    ok("Tagesdeckel UNVERÄNDERT (restJeTag gleich)", mal(angebotOhne.ergebnis.restJeTag, angebotMit.ergebnis.restJeTag));
    ok("Das Angebot (gestreute Zeiten je Tag) enthält nichts aus der Sperre", !(angebotMit.tage.find((t: any) => t.tag === tagMi)?.zeiten ?? []).some((z: string) => z >= "15:50" && z < "18:30"));
    const kontakt = { name: "Prüfer Sperre", vorname: "Prüfer", nachname: "Sperre", firma: "Beispiel GmbH", email: "pruefer@beispiel.invalid", telefon: "+4930123456", paket: null, paketText: null, land: "DE", sprache: "de" as const };
    const mailB = await zaehlen("fiaon_mail_log");
    const gesperrt = await g.globalTerminBuchen({ kontakt, tag: tagMi, zeit: "17:00", thema: null });
    ok("Buchung IN der Sperre (17:00) wird abgelehnt: nicht_angeboten, kein Termin", gesperrt.ok === false && (gesperrt as any).grund === "nicht_angeboten" && (await zaehlen("fiaon_termine", `agent_id = ${A} AND quelle = 'global'`)) === 0, JSON.stringify(gesperrt).slice(0, 160));
    ok("… und es geht keine Mail raus", (await zaehlen("fiaon_mail_log")) === mailB);
    await sperrzeitLoeschen(r6.sperrzeit.id, A, A);
    const angebotNach = await g.globalAngebotLaden();
    ok("Freigegeben: 17:00 wird wieder angeboten (Gegenprobe)", gMi(angebotNach).includes("17:00"));

    // ═══════════════════════════════════════════════════════════════════════
    titel("B9  Startgespräch-Angebot: sperrenAlsBelegung → startgespraechZeitenRechnen");
    // ═══════════════════════════════════════════════════════════════════════
    const sg = await import("../server/lib/fiaon-global-angebot-startgespraech");
    const r7 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), vonAgentId: A });
    if (!r7.ok) throw new Error(r7.error);
    const bel = await sperrenAlsBelegung(A, new Date(Date.now() - 86_400_000), new Date(Date.now() + 16 * 86_400_000));
    ok("sperrenAlsBelegung: eine Belegung, 150 Minuten, zählt auf keinen Deckel", bel.length === 1 && bel[0].dauerMin === 150 && bel[0].zaehltAlsGlobal === false);
    const fenster = (await termine.verfuegbarkeitVon(A)).filter((f) => f.aktiv);
    const ab = new Date(Date.now() + 2 * 3_600_000);
    const sgOhne = sg.startgespraechZeitenRechnen({ ab, fenster, belegt: [], proTag: 8 });
    const sgMit = sg.startgespraechZeitenRechnen({ ab, fenster, belegt: bel, proTag: 8 });
    ok("ohne Sperre bietet das Startgespräch 17:00 an (Vorher)", sgOhne.frei.some((f: any) => f.tag === tagMi && f.zeit === "17:00"));
    ok("mit Sperre: 16:00–17:30 weg, 15:30 bleibt", !sgMit.frei.some((f: any) => f.tag === tagMi && f.zeit >= "16:00" && f.zeit < "18:30") && sgMit.frei.some((f: any) => f.tag === tagMi && f.zeit === "15:30"));
    await sperrzeitLoeschen(r7.sperrzeit.id, A, A);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B10 Kein Nebeneffekt — und ein schon gebuchter Termin wird gemeldet, nicht angefasst");
    // ═══════════════════════════════════════════════════════════════════════
    const [t1] = (await sqlPool`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle)
      VALUES (${personId}, ${A}, ${zeitIn(tagMi, "17:00")}, 30, 'gebucht', 'global') RETURNING id`) as any[];
    const terminId = Number(t1.id);
    const vorAnlegen = await zaehlen("fiaon_termine");
    const mailVor = await zaehlen("fiaon_mail_log");
    const [terminAlt] = (await sqlPool`SELECT status, beginn, dauer_min, abgesagt_am, erinnert_am, notiz FROM fiaon_termine WHERE id = ${terminId}`) as any[];
    const r8 = await sperrzeitAnlegen({ agentId: A, beginn: wann("16:00"), ende: wann("18:30"), grund: "Treffen vor Ort", vonAgentId: A });
    if (!r8.ok) throw new Error(r8.error);
    ok("Antwort nennt den kollidierenden Termin (Zeit, Dauer, Art) — ohne Kundendaten", r8.termine.length === 1 && r8.termine[0].id === terminId && r8.termine[0].dauerMin === 30 && r8.termine[0].quelle === "global" && !("personId" in r8.termine[0]) && !("name" in r8.termine[0]));
    const [terminNeu] = (await sqlPool`SELECT status, beginn, dauer_min, abgesagt_am, erinnert_am, notiz FROM fiaon_termine WHERE id = ${terminId}`) as any[];
    ok("Der Termin bleibt bestehen und unverändert (gebucht, nicht abgesagt)", mal(terminAlt, terminNeu) && terminNeu.status === "gebucht" && !terminNeu.abgesagt_am);
    ok("Es entsteht KEIN Termin (fiaon_termine gleich viele Zeilen)", (await zaehlen("fiaon_termine")) === vorAnlegen);
    ok("Es geht KEINE Mail raus (fiaon_mail_log unverändert)", (await zaehlen("fiaon_mail_log")) === mailVor && (await zaehlen("fiaon_mail_log")) === mailVorher);
    ok("Kein Aufruf nach außen (Brevo/Make/WhatsApp)", FREMD.length === 0, FREMD.join(", "));
    const [spalten] = (await sqlPool`SELECT array_agg(column_name::text ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_name = 'fiaon_sperrzeiten'`) as any[];
    ok("Die Tabelle kennt keinen Kunden, keine Nummer, keine Mail (nur Person, Zeit, Notiz, Protokoll)", mal(spalten.c, ["id", "agent_id", "beginn", "ende", "grund", "erstellt_von", "erstellt_am", "geloescht_am", "geloescht_von"]), JSON.stringify(spalten.c));
    ok("Die Sperre steht neben dem Termin (beide aktiv, keiner ersetzt den anderen)", (await zaehlen("fiaon_sperrzeiten", `agent_id = ${A} AND geloescht_am IS NULL`)) === 1 && (await zaehlen("fiaon_termine", `id = ${terminId} AND status = 'gebucht'`)) === 1);
    const ueber = await sperrzeitAnlegen({ agentId: A, beginn: wann("19:00"), ende: wann("20:00"), vonAgentId: A });
    ok("Sperre ohne Termin darin → termine: []", ueber.ok && ueber.termine.length === 0);
    if (ueber.ok) await sperrzeitLoeschen(ueber.sperrzeit.id, A, A);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B11 Kalender-Abo: „Belegt“ ohne Notiz und ohne Kunde");
    // ═══════════════════════════════════════════════════════════════════════
    const abo = await import("../server/lib/fiaon-kalender-abo");
    const aboA = await abo.aboHolen(A, "eigene", "Prüfstand E-498");
    const aboI = await abo.aboHolen(INH, "team", "Prüfstand E-498");
    if (aboA) eigen.aboZeilen.push(aboA.id);
    if (aboI) eigen.aboZeilen.push(aboI.id);
    ok("Abos entstehen (eigene für Alpha, Team für den Inhaber)", !!aboA && !!aboI);
    if (aboA && aboI) {
      const feed = await abo.aboFeed(aboA);
      const uid = `sperrzeit-${r8.sperrzeit.id}@fiaon.com`;
      ok("eigenes Abo: Eintrag mit fester UID sperrzeit-<id>@fiaon.com, Titel „Belegt“", feed.ics.includes(`UID:${uid}`) && /SUMMARY:Belegt\r?\n/.test(feed.ics));
      ok("… zur richtigen Zeit (16:00–18:30 Berliner Zeit = 15:00–17:30 UTC)", feed.ics.includes(`DTSTART:${zeitIn(tagMi, "16:00").replace(/[-:]|\.\d{3}/g, "")}`) && feed.ics.includes(`DTEND:${zeitIn(tagMi, "18:30").replace(/[-:]|\.\d{3}/g, "")}`));
      ok("… OHNE die Notiz „Treffen vor Ort“ und ohne Kunden-/Firmennamen", !feed.ics.includes("Treffen vor Ort") && !feed.ics.includes("Beispiel") && !feed.ics.includes("PRUEF498"));
      ok("… ohne Wecker (VALARM)", (feed.ics.split(`UID:${uid}`)[1] ?? "").split("END:VEVENT")[0].indexOf("BEGIN:VALARM") === -1);
      ok("der gebuchte Termin steht weiter im Abo (Termin-UID), die Sperre kommt dazu", feed.ics.includes(`UID:termin-${terminId}@fiaon.com`));
      const feedB = await abo.aboFeed({ ...aboA, agent_id: B });
      ok("Beta sieht Alphas Sperre NICHT im eigenen Abo", !feedB.ics.includes(uid));
      const team = await abo.aboFeed(aboI);
      ok("Team-Abo (Inhaber): „Alpha · belegt“", team.ics.includes(`UID:${uid}`) && /SUMMARY:Alpha · belegt\r?\n/.test(team.ics));
      ok("Team-Abo ohne Notiz", !team.ics.includes("Treffen vor Ort"));
      // Zwischenspeicher: erst gemerkt, dann nach dem Löschen sofort frisch
      const gemerkt1 = await abo.aboFeedGemerkt(aboA);
      ok("Zwischenspeicher hält den Feed mit Sperre", gemerkt1.ics.includes(uid));
      ok("Sperre freigeben (Route-Weg)", await sperrzeitLoeschen(r8.sperrzeit.id, A, A));
      const gemerkt2 = await abo.aboFeedGemerkt(aboA);
      ok("… der Zwischenspeicher wurde vergessen: sofort kein „Belegt“ mehr, ETag ändert sich", !gemerkt2.ics.includes(uid) && gemerkt2.etag !== gemerkt1.etag);
      ok("gelöschte Sperre fehlt auch im Team-Abo", !(await abo.aboFeed(aboI)).ics.includes(uid));
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("B12 Ein Lesefehler legt keine Buchungsseite lahm");
    // ═══════════════════════════════════════════════════════════════════════
    // Simulierter Lesefehler. Die Tabelle, die WIRKLICH fehlt (Server vor der Migration), prüft der Lauf mit --ohne-tabelle
    // gegen eine Datenbank ohne Migration 133 (Abschnitt C unten).
    const lesefehler = await (async () => {
      const kaputtLauf: any = (..._a: any[]) => { throw new Error("simulierter Lesefehler"); };
      kaputtLauf.unsafe = () => { throw new Error("x"); };
      const fehlerAus: string[] = [];
      const alt = console.error; console.error = (...a: any[]) => { fehlerAus.push(a.join(" ")); };
      try { return { liste: await sperrM.sperrenLesen([A], new Date(), new Date(Date.now() + 86_400_000), kaputtLauf), fehlerAus }; } finally { console.error = alt; }
    })();
    ok("Lesefehler: leere Liste statt Ausnahme, der Fehler steht im Log", lesefehler.liste.length === 0 && lesefehler.fehlerAus.some((z) => z.includes("[SPERRZEIT]")), lesefehler.fehlerAus.join("|"));
    ok("Ohne Personen (leere Liste) wird gar nicht erst gefragt", (await sperrM.sperrenLesen([], new Date(), new Date())).length === 0);
    ok("rohSlots ohne Agenten → leer (wie vorher)", (await rohSlots([], 20)).length === 0);

    // ═══════════════════════════════════════════════════════════════════════
    titel("B13 Schreibstelle: nur fiaon-sperrzeit.ts schreibt in fiaon_sperrzeiten");
    // ═══════════════════════════════════════════════════════════════════════
    const treffer: string[] = [];
    const durchsuchen = (ordner: string) => {
      for (const n of readdirSync(ordner)) {
        if (n === "node_modules" || n === "dist" || n === ".git" || n === ".playwright") continue;
        const pfad = join(ordner, n);
        const st = statSync(pfad);
        if (st.isDirectory()) { durchsuchen(pfad); continue; }
        if (!/\.(ts|tsx|mjs|js)$/.test(n)) continue;
        if (pfad.endsWith("scripts/pruef-sperrzeit-e498.ts")) continue;
        const text = readFileSync(pfad, "utf8");
        if (/(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+fiaon_sperrzeiten/i.test(text)) treffer.push(pfad.replace(process.cwd() + "/", ""));
      }
    };
    for (const o of ["server", "shared", "client/src", "scripts"]) durchsuchen(join(process.cwd(), o));
    ok("genau eine Datei schreibt: server/lib/fiaon-sperrzeit.ts", mal(treffer, ["server/lib/fiaon-sperrzeit.ts"]), treffer.join(", "));
    ok("Keine Telefon-Wortwahl / Mail-Vorlage im Sperrzeit-Code", !/mailSenden|mailDirektSenden|brevo|whatsapp|terminBestaetigung/i.test(readFileSync("server/lib/fiaon-sperrzeit.ts", "utf8") + readFileSync("server/lib/fiaon-sperrzeit-regeln.ts", "utf8")));
  } finally {
    // ── Aufräumen: nur, was dieser Lauf angelegt hat ──
    await sqlPool`DELETE FROM fiaon_sperrzeiten WHERE agent_id = ANY(${eigen.agenten.length ? eigen.agenten : [0]})`.catch(() => {});
    if (eigen.personen.length) await sqlPool`DELETE FROM fiaon_termine WHERE person_id = ANY(${eigen.personen})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_termine WHERE agent_id = ANY(${eigen.agenten.length ? eigen.agenten : [0]})`.catch(() => {});
    if (eigen.aboZeilen.length) await sqlPool`DELETE FROM fiaon_kalender_abo WHERE id = ANY(${eigen.aboZeilen})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_termin_versuche WHERE agent_id = ANY(${eigen.agenten.length ? eigen.agenten : [0]})`.catch(() => {});
    if (eigen.personen.length) await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${eigen.personen})`.catch(() => {});
    for (const s of eigen.settings.reverse()) {
      if (s.alt === null) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${s.key}`.catch(() => {});
      else await sqlPool`UPDATE fiaon_settings SET value = ${s.alt} WHERE key = ${s.key}`.catch(() => {});
    }
    if (eigen.agenten.length) {
      await sqlPool`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ANY(${eigen.agenten})`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_agents WHERE id = ANY(${eigen.agenten})`.catch((e) => console.error("Aufräumen Konten:", String(e?.message ?? e).slice(0, 120)));
    }
  }

  async function zaehlen(tabelle: string, wo = "TRUE"): Promise<number> {
    try {
      const [r] = (await sqlPool.unsafe(`SELECT COUNT(*)::int AS n FROM ${tabelle} WHERE ${wo}`)) as any[];
      return Number(r?.n ?? 0);
    } catch { return -1; }
  }
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  titel(`ERGEBNIS: ${gut} ok, ${schlecht} rot`);
  process.exit(schlecht ? 1 : 0);
}

main().catch((e) => { console.error("PRÜFSTAND ABGEBROCHEN:", e); process.exit(2); });
