// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 NACHBESSERUNG (20.10.2026), DATENBANK — Teil 2 der Prüfer-Funde und die Brücke zu Aras (E-408):
// je Fund mindestens ein Fall, der auf dem Stand VOR der Korrektur (da786d66) rot ist. Erfundene Personen (Marke Q419),
// kein Netz, keine Schlüssel. Aras ist eine ATTRAPPE über die Anbindung (dieselben Funktionsnamen und derselbe
// Schlüssel aras_notaus wie Team 1s Kern: waehler.notaus / waehler.start).
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_nachb
//   (danach node scripts/run-migrations.mjs mit DATABASE_URL auf die Kopie)
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=… DATABASE_URL_EXTERN=… \
//     node_modules/.bin/tsx scripts/pruef-e409-nachbesserung-db.ts
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
const ARAS_KEYS = ["aras_notaus", "aras_an", "aras_ampel"];

/** Ein Ausschnitt aus Team 1s ARAS_AMPEL (shared/fiaon-aras.ts, E-408 Teil 1) — dieselbe Form, dieselben Namen. */
const ARAS_AMPEL_ATTRAPPE = [
  { key: "akte_nachsehen", label: "Akte nachsehen", satz: "Liest Zahlungen, Termine, Notizen, Vertrag.", stufen: ["gruen"], vorgabe: "gruen", fest: true, kanal: "alle" },
  { key: "zahlungslink_senden", label: "Zahlungslink senden", satz: "WhatsApp oder Mail mit seinem persönlichen Link.", stufen: ["gruen", "gelb", "rot"], vorgabe: "gruen", kanal: "alle" },
  { key: "ratenpause_setzen", label: "Ratenpause", satz: "Kette rückt — steht in „Heute“, 24 h rückgängig.", stufen: ["gelb", "rot"], vorgabe: "gelb", kanal: "alle" },
] as const;

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const A = await import("../server/lib/fiaon-ki-ampel");
  const E = await import("../server/lib/fiaon-ki-einstellungen");
  const AB = await import("../server/lib/fiaon-ki-aras-anbindung");
  const MT = await import("../server/lib/fiaon-mara-termin");
  await MT.protokollTabelle();

  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, ...ARAS_KEYS, "mara_ampel"]})`) as any[];
  const aufraeumen = async () => {
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, ...ARAS_KEYS, "mara_ampel"]})`;
    A.ampelZwischenspeicherLeeren();
    AB.arasAnbindungLoesen();
  };
  await aufraeumen();

  // ── Die Aras-Attrappe: Team 1s Funktionen mit Team 1s Schlüssel (einstellungSetzen schreibt aras_* wie der Kern) ──
  const rufe: string[] = [];
  const arasSetzen = async (k: string, v: string) => {
    await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  };
  const anbinden = () => AB.arasAnbinden({
    konstanten: { ARAS_AMPEL: ARAS_AMPEL_ATTRAPPE as any },
    plan: {
      arasEinstellungenLesen: async () => ({}), einstellungSetzen: async (k: string, w: string) => arasSetzen(k, w),
      planLage: async () => ({}), planListe: async () => [], planEinreihen: async () => ({ ok: false }), planVerschieben: async () => {},
      planEntfernen: async () => {}, tagesplan: async () => ({}), lernvorschlag: async () => null,
    },
    waehler: {
      notaus: async (_von: string, grund: string) => { rufe.push(`notaus:${grund}`); await arasSetzen("aras_notaus", "an"); return { beendet: 1 }; },
      start: async () => { rufe.push("start"); await arasSetzen("aras_notaus", "aus"); },
      leerlauf: async () => ({ laufend: 0 }), laufendeSitzungen: () => [],
    },
  });
  const wert = async (k: string): Promise<string | null> => {
    const [z] = (await sql`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[];
    return z ? String(z.value) : null;
  };
  const notausSchluessel = async () => ((await sql`SELECT key FROM fiaon_settings WHERE key ILIKE '%notaus%' ORDER BY key`) as any[]).map((z) => String(z.key));

  const abschnitt = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { ok(false, `${name}: Abbruch`, String((e as Error)?.message ?? e).slice(0, 200)); }
  };
  try {
    // ═════════════════════════════════════════════════════════════════════
    console.log("── Aras · der KI-Team-Not-Aus erreicht Aras — über SEINEN Not-Aus (aras_notaus), kein zweiter Schlüssel");
    await abschnitt("Aras Not-Aus", async () => {
      anbinden();
      await arasSetzen("aras_an", "an");
      const n1 = await E.maraNotaus(true, "Prüfstand Q419");
      ok(n1.ok && rufe.includes("notaus:Not-Aus im KI-Team"), "Not-Aus: Team 1s waehler.notaus wird gerufen (laufende Gespräche enden mit Abschiedssatz)", rufe);
      ok((await wert("aras_notaus")) === "an", "aras_notaus = an (Aras wählt nicht mehr)");
      ok((await wert("aras_an")) === "an", "aras_an (der Betriebsschalter) bleibt unberührt");
      ok(n1.ok && (n1 as any).aras?.angehalten === true && n1.geaendert.some((g) => g.schluessel === "aras_notaus" && g.nachher === "an"), "die Antwort sagt, dass Aras steht", n1);
      const keys = await notausSchluessel();
      ok(JSON.stringify(keys) === JSON.stringify(["aras_notaus", "mara_notaus_vorher"]), "kein zweiter Not-Aus-Schlüssel — nur aras_notaus und der Merker", keys);
      const merker = JSON.parse(String(await wert("mara_notaus_vorher")));
      ok(merker?.werte && "aras_notaus" in merker.werte && merker.werte.aras_notaus === null, "der Merker kennt Arasʼ Stand von vorher (fehlte = nicht angehalten)", merker?.werte);
      const st = await E.maraNotausStand();
      ok((st as any).aras?.verbunden === true && (st as any).aras?.angehalten === true && (st as any).aras?.vorherAngehalten === false, "„Heute“ zeigt Aras im Not-Aus (und was „Wieder an“ tut)", (st as any).aras);
      rufe.length = 0;
      const w1 = await E.maraNotaus(false, "Prüfstand Q419");
      ok(w1.ok && rufe.includes("start") && (await wert("aras_notaus")) === "aus", "„Wieder an“: Aras wieder frei (waehler.start), weil er vorher lief", { rufe, aras: await wert("aras_notaus") });
      ok((await wert("aras_an")) === "an" && !(await notausSchluessel()).includes("mara_notaus_vorher"), "aras_an unverändert, Merker weg");
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Aras · war er VOR dem Not-Aus schon angehalten, bleibt er es nach „Wieder an“");
    await abschnitt("Aras schon angehalten", async () => {
      anbinden();
      await arasSetzen("aras_notaus", "an");
      rufe.length = 0;
      await E.maraNotaus(true, "Prüfstand Q419");
      const w = await E.maraNotaus(false, "Prüfstand Q419");
      ok(w.ok && !rufe.includes("start") && (await wert("aras_notaus")) === "an", "„Wieder an“ startet Aras NICHT (er stand schon vorher)", { rufe, aras: await wert("aras_notaus") });
      ok(w.ok && /schon vor dem Not-Aus/.test(String((w as any).aras?.text ?? "")), "und sagt das ehrlich", (w as any).aras);
      await sql`DELETE FROM fiaon_settings WHERE key = 'aras_notaus'`;
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Aras · zweiter Klick, nachdem Aras erst dazukam: sein Stand wird nachgetragen, der Rest des Merkers bleibt");
    await abschnitt("Aras kommt dazu", async () => {
      AB.arasAnbindungLoesen();
      await arasSetzen("mara_wa_nachfass", "aus");
      await E.maraNotaus(true, "Prüfstand Q419 (ohne Aras)");
      const m1 = JSON.parse(String(await wert("mara_notaus_vorher")));
      ok(!("aras_notaus" in (m1?.werte ?? {})), "ohne Anbindung fasst der Not-Aus Aras nicht an", m1?.werte);
      anbinden();
      rufe.length = 0;
      await E.maraNotaus(true, "Prüfstand Q419 (mit Aras)");
      const m2 = JSON.parse(String(await wert("mara_notaus_vorher")));
      ok(m2?.werte?.mara_wa_nachfass === "aus" && "aras_notaus" in (m2?.werte ?? {}) && m2.von === m1.von, "Merker: Aras nachgetragen, Mara-Stand von vorher unverändert", m2);
      ok(rufe.includes("notaus:Not-Aus im KI-Team"), "und Aras steht jetzt", rufe);
      await E.maraNotaus(false, "Prüfstand Q419");
      ok((await wert("mara_wa_nachfass")) === "aus" && (await wert("aras_notaus")) === "aus", "„Wieder an“: Nachfassen bleibt aus (wie vorher), Aras wieder frei");
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, "aras_notaus"]})`;
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Aras · die EINE Ampel erreicht Aras: aras_ampel { stufen } — derselbe Schlüssel, den Team 1 beim Anrufbeginn liest");
    await abschnitt("Aras Ampel", async () => {
      anbinden();
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_ampel', ${JSON.stringify({ stufen: { antwort_senden: "gelb" }, verlauf: [] })}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      const r = await A.ampelSetzen("aras", "zahlungslink_senden", "rot", "Prüfstand Q419");
      const roh = JSON.parse(String(await wert("aras_ampel")));
      // Team 1 liest so (shared/fiaon-aras.ts einstellungenAnwenden): fest oder unbekannte Stufe → Vorgabe, sonst stufen[key].
      const team1 = (key: string) => { const a = ARAS_AMPEL_ATTRAPPE.find((x) => x.key === key)!; const s = roh?.stufen?.[key]; return (a as any).fest || !(a.stufen as readonly string[]).includes(s) ? a.vorgabe : s; };
      ok(r.ok && team1("zahlungslink_senden") === "rot", "Rot in KI-Team › Werkzeuge = Rot bei Aras (aras_ampel.stufen)", roh);
      const f = await A.ampelSetzen("aras", "akte_nachsehen", "rot", "Prüfstand Q419");
      ok(!f.ok && team1("akte_nachsehen") === "gruen", "feste Aras-Werkzeuge bleiben fest");
      ok(JSON.parse(String(await wert("mara_ampel")))?.stufen?.antwort_senden === "gelb" && !JSON.parse(String(await wert("mara_ampel")))?.stufen?.zahlungslink_senden, "Maras Ampel bleibt unberührt — zwei Listen, je EIN Schlüssel");
      const zeilen = await A.ampelZeilenLesen("aras");
      ok(zeilen.length === ARAS_AMPEL_ATTRAPPE.length && zeilen.find((z: any) => z.key === "zahlungslink_senden")?.stufe === "rot", "KI-Team › Werkzeuge zeigt Arasʼ Liste aus seiner Anbindung", zeilen.map((z: any) => `${z.key}:${z.stufe}`));
    });
  } finally {
    await aufraeumen();
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${v.key}, ${v.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  ok(netz === 0, `kein Netz (${netz} Aufrufe)`);
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await new Promise((r) => setTimeout(r, 1500));
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
