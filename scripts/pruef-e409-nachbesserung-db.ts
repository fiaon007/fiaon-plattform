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
  const P = await import("../server/lib/fiaon-ki-pruefung");
  await MT.protokollTabelle();
  await P.pruefungTabellen();
  await (await import("../server/lib/fiaon-postmeister-schema")).postmeisterSchema();
  await (await import("../server/lib/fiaon-aras-schema")).arasSchema();

  const PRUEF_KEYS = ["pruef_mara_an", "pruef_mara_quote", "pruef_mara_tag_euro",
    // Funde 14, 15, 17: Schlüssel, die die Abschnitte setzen — vorher gemerkt, danach zurück.
    "mara_wa_nachfass_tag", "mara_aktion_runde_seit", "mara_aktion_postfach", "postmeister_modus_support", "mara_rate_erinnerung", "aras_spielarten", "ki_lexr_freigabe"];
  const vorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, ...ARAS_KEYS, ...PRUEF_KEYS, "mara_ampel"]})`) as any[];
  const pruefAufraeumen = async () => {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE 'PR-Q419-%'`) as any[]).map((r) => Number(r.id));
    const anrufe = ((await sql`SELECT a.id, a.call_id FROM fiaon_aras_anruf a WHERE a.prompt_version = 'q419'`.catch(() => [])) as any[]);
    await sql`DELETE FROM fiaon_ki_pruefung WHERE bezug_art = 'q419_test' OR person_id = ANY(${personen}) OR (bezug_art = 'aras_anruf' AND bezug_id = ANY(${anrufe.map((a) => Number(a.id))}))`.catch(() => {});
    if (anrufe.length) {
      await sql`DELETE FROM fiaon_aras_anruf WHERE prompt_version = 'q419'`.catch(() => {});
      await sql`DELETE FROM fiaon_calls WHERE id = ANY(${anrufe.map((a) => Number(a.call_id))})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'q419-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_whatsapp WHERE wa_id LIKE 'q419-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${personen})`.catch(() => {});
    await sql`DELETE FROM fiaon_ki_nutzung WHERE modell = 'q419-attrappe'`.catch(() => {});
    P.pruefungZwischenspeicherLeeren?.();
  };
  const aufraeumen = async () => {
    await pruefAufraeumen();
    await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PR-Q419-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${[...NOTAUS, ...ARAS_KEYS, ...PRUEF_KEYS, "mara_ampel"]})`;
    A.ampelZwischenspeicherLeeren();
    AB.arasAnbindungLoesen();
    P.pruefModellSetzen(null);
  };
  await aufraeumen();
  const [person] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PR-Q419-1', 'Erika', 'Q419muster', 'q419@test.invalid') RETURNING id`) as any[];
  const pid = Number(person.id);
  const [agent] = (await sql`SELECT id FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];

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

    // ═════════════════════════════════════════════════════════════════════
    // Prüf-Mara mit einer Modell-Attrappe: sie merkt sich, was sie lesen musste, und sieht in die Tabelle (Vormerkung).
    const fragen: string[] = [];
    const gesehen: string[] = [];
    let antwort: (text: string) => { urteil: any; modell: string; kostenCents: number } = () => ({ urteil: { urteil: "ok", punkte: [], begruendung: "Q419 ok" }, modell: "q419-modell", kostenCents: 0 });
    P.pruefModellSetzen(async (ein: { text: string }) => {
      fragen.push(ein.text);
      const m = /Q419-(M\d+)/.exec(ein.text);
      if (m) {
        const [z] = (await sql`SELECT k.modell FROM fiaon_ki_pruefung k JOIN fiaon_postmeister p ON p.id = k.bezug_id WHERE k.bezug_art = 'postmeister' AND p.gmail_id = ${`q419-${m[1]}`}`) as any[];
        gesehen.push(`${m[1]}:${z?.modell ?? "keine Zeile"}`);
      }
      return antwort(ein.text);
    });
    await arasSetzen("pruef_mara_quote", JSON.stringify({ telefon: 100, mail: 100, whatsapp: 100 }));
    const anruf = async (marke: string, o: { transkript?: any[] | null; ja?: boolean; zusammenfassung?: string; live?: any }) => {
      const [c] = (await sql`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, gefuehrt_von) VALUES (${pid}, ${Number(agent.id)}, '+4915100419001', 'raus', 'beendet', 'aras') RETURNING id`) as any[];
      const [a] = (await sql`
        INSERT INTO fiaon_aras_anruf (call_id, spielart, adapter, prompt_version, briefing, angenommen_am, ki_hinweis_am, aufnahme_ja_am, aufnahme_nein_am, aufnahme_gestartet_am,
                                      transkript, zusammenfassung, ende_grund, pruefung, pruefung_status, updated_at)
        VALUES (${Number(c.id)}, 'rate', 'attrappe', 'q419', ${sql.json({ marke })}, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes' + INTERVAL '3 seconds',
                ${o.ja ? sql`NOW() - INTERVAL '10 minutes' + INTERVAL '20 seconds'` : null}, ${o.ja ? null : sql`NOW() - INTERVAL '10 minutes' + INTERVAL '20 seconds'`},
                ${o.ja ? sql`NOW() - INTERVAL '10 minutes' + INTERVAL '21 seconds'` : null},
                ${o.transkript ? sql.json(o.transkript) : null}, ${o.zusammenfassung ?? null}, 'aras_beendet', ${o.live ? sql.json(o.live) : null}, 'offen', NOW() - INTERVAL '5 minutes')
        RETURNING id`) as any[];
      return Number(a.id);
    };
    const pruefZeile = async (art: string, id: number) => ((await sql`SELECT * FROM fiaon_ki_pruefung WHERE bezug_art = ${art} AND bezug_id = ${id}`) as any[])[0] ?? null;
    const anrufStatus = async (id: number) => String(((await sql`SELECT pruefung_status FROM fiaon_aras_anruf WHERE id = ${id}`) as any[])[0]?.pruefung_status ?? "");
    let mNr = 0;
    const mail = async (antwortText: string) => {
      mNr++;
      const marke = `M${mNr}`;
      const [z] = (await sql`
        INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, person_id, aktion, betreff, text, antwort, gesendet_am, empfangen_am, created_at)
        VALUES ('support@fiaon.com', ${`q419-${marke}`}, ${`t-q419-${marke}`}, ${pid}, 'auto_beantwortet', 'Frage', 'Wie ist der Stand?', ${`${antwortText} (Q419-${marke})`},
                NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes') RETURNING id`) as any[];
      return { id: Number(z.id), marke };
    };

    console.log("── Fund 7 + 8 (Server) · Telefon: Regeln nur auf Aras, ohne Transkript kein Modell, Teams 1 Live-Befund zählt");
    await abschnitt("Fund 7 Server", async () => {
      await pruefAufraeumen(); fragen.length = 0;
      const mitJa = await anruf("A1", { ja: true, transkript: [
        { t: 0, wer: "kunde", text: "Hallo?" },
        { t: 1, wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, ich bin der digitale Assistent, also eine KI. Spreche ich mit Frau Q419muster?" },
        { t: 2, wer: "kunde", text: "Ja. Aber hören Sie auf, sonst gehe ich zum Anwalt!" },
        { t: 3, wer: "aras", text: "Das verstehe ich gut. Ich trage ein, dass wir Sie nicht mehr anrufen. Einen schönen Tag noch." },
      ] });
      // E-409 Kalibrierung (22.10.2026): der Live-Befund trägt seinen Regelstand (stand) — ohne ihn stammt er aus der alten Fassung.
      const ohneJaLive = await anruf("A2", { ja: false, zusammenfassung: "Kundin wollte nicht reden (Q419-A2).", live: { live: true, stand: "e409-2210", punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } });
      const ohneJa = await anruf("A3", { ja: false, zusammenfassung: "Kundin sagte: sonst gehe ich zum Anwalt (Q419-A3)." });
      const ohneJaAlt = await anruf("A2b", { ja: false, zusammenfassung: "Kundin nannte ihren Namen (Q419-A2b).", live: { live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } });
      const e = await P.pruefungTakt();
      const z1 = await pruefZeile("aras_anruf", mitJa), z2 = await pruefZeile("aras_anruf", ohneJaLive), z3 = await pruefZeile("aras_anruf", ohneJa);
      const z2b = await pruefZeile("aras_anruf", ohneJaAlt);
      ok(z2b?.urteil === "ok" && (z2b?.punkte ?? []).some((p: any) => p.regel === "alt_anliegen_vor_identitaet" && p.schwere === "weich"), "E-409 Kalibrierung: ein ALTER Live-Befund (ohne Regelstand, nicht nachprüfbar) ist kein Regelverstoß mehr", z2b);
      ok(z1?.urteil === "ok" && !(z1?.punkte ?? []).some((p: any) => ["druck", "drohung"].includes(p.regel)), "mit Aufnahme: „sonst gehe ich zum Anwalt“ der KUNDIN ist kein Fehler von Aras", z1?.punkte);
      ok(await anrufStatus(mitJa) === "ok", "… und der Anruf steht auf „ok“");
      ok(z3?.urteil === "ok" && z3?.modell === "regeln", "ohne Aufnahme: die Zusammenfassung ist kein Wortlaut — kein Regelverstoß aus dem Text", z3);
      ok(!fragen.some((t) => /Q419-A[23]/.test(t)) && fragen.filter((t) => /Q419muster\?/.test(t)).length === 1, "das Modell liest nur das Gespräch mit Aufnahme, nie eine Zusammenfassung", fragen.map((t) => t.slice(0, 60)));
      ok(z2?.urteil === "fehler" && (z2?.punkte ?? []).some((p: any) => p.regel === "anliegen_vor_identitaet" && /Live-Prüfung ohne Aufnahme/.test(p.hinweis)) && z2?.modell === "regeln", "Teams 1 Live-Befund (ohne Wortlaut) zählt wie eine harte Regel", z2);
      ok(e.geprueft === 4 && await anrufStatus(ohneJaLive) === "fehler" && await anrufStatus(ohneJaAlt) === "ok", "alle vier geprüft, Status gesetzt", e);
    });

    console.log("── Fund 10 · kein Kreisel: ein Anruf mit Prüfzeile kommt nie wieder ins Modell; Vormerkung VOR dem Modell");
    await abschnitt("Fund 10", async () => {
      await pruefAufraeumen(); fragen.length = 0; gesehen.length = 0;
      const haengt = await anruf("A4", { ja: true, transkript: [{ t: 0, wer: "aras", text: "Guten Tag, hier ist Aras von FIAON, eine KI. Spreche ich mit Frau Q419muster? (Q419-A4)" }, { t: 1, wer: "kunde", text: "Ja." }] });
      await sql`INSERT INTO fiaon_ki_pruefung (kanal, bezug_art, bezug_id, person_id, urteil, punkte, modell, kosten_cents) VALUES ('telefon', 'aras_anruf', ${haengt}, ${pid}, 'auffaellig', '[]'::jsonb, 'q419-modell', 0)`;
      const m = await mail("Guten Tag, Ihre Zahlung ist eingegangen, alles ist im grünen Bereich. Freundliche Grüße");
      await P.pruefungTakt();
      ok(!fragen.some((t) => /Q419-A4/.test(t)), "der Anruf mit Prüfzeile (Status hing auf „offen“) fragt kein Modell mehr", fragen.map((t) => t.slice(0, 50)));
      ok(await anrufStatus(haengt) === "auffaellig", "… sein Status wird aus der Prüfzeile nachgezogen");
      ok(gesehen.includes(`${m.marke}:laeuft`), "während das Modell fragt, ist der Fall schon vorgemerkt (ein zweiter Lauf fragt nicht)", gesehen);
      ok((await pruefZeile("postmeister", m.id))?.modell === "q419-modell", "danach steht das Modell, das wirklich geurteilt hat");
    });

    console.log("── Fund 16 · höchstens 2 Modell-Fragen je Lauf, 60 je Stunde; ohne Modell nie „ok“; die Spalte modell ist ehrlich");
    await abschnitt("Fund 16 Deckel", async () => {
      await pruefAufraeumen(); fragen.length = 0;
      const fuenf = [];
      for (let i = 0; i < 5; i++) fuenf.push(await mail(`Guten Tag, danke für Ihre Nachricht Nummer ${i + 1}. Wir melden uns morgen mit allem. Freundliche Grüße`));
      const e1 = await P.pruefungTakt();
      ok(fragen.length === 2 && e1.geprueft === 2 && e1.wartet === 3 && e1.grund === "modell_takt", "fünf Fälle: zwei fragt das Modell, drei warten auf den nächsten Lauf", { fragen: fragen.length, e1 });
      const ohneZeile = (await Promise.all(fuenf.map((m) => pruefZeile("postmeister", m.id)))).filter((z) => !z).length;
      ok(ohneZeile === 3, "die wartenden haben KEINE Zeile — nichts als „ok“ gebucht", ohneZeile);
      await sql.unsafe(`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok) SELECT 'pruef-mara', 'q419-attrappe', 0, 0, 0, 1, 0, TRUE FROM generate_series(1, 60)`);
      fragen.length = 0;
      const e2 = await P.pruefungTakt();
      ok(fragen.length === 0 && e2.wartet === 3 && e2.geprueft === 0, "60 Modell-Fragen in der letzten Stunde: der Lauf fragt keins mehr", { fragen: fragen.length, e2 });
      await sql`DELETE FROM fiaon_ki_nutzung WHERE modell = 'q419-attrappe'`;
      await arasSetzen("pruef_mara_tag_euro", "0");
      await pruefAufraeumen(); fragen.length = 0;
      const sauber = await mail("Guten Tag, wir haben alles notiert und melden uns morgen. Freundliche Grüße");
      const lastschrift = await mail("Guten Tag, wir buchen das dann bequem per Lastschrift ab. Freundliche Grüße");
      const e3 = await P.pruefungTakt();
      const zs = await pruefZeile("postmeister", sauber.id), zl = await pruefZeile("postmeister", lastschrift.id);
      ok(!zs && e3.grund === "deckel", "über dem Tagesdeckel: der saubere Fall wartet (vorher: „ok“ mit Modell „deckel“)", { zs, e3 });
      ok(zl?.urteil === "fehler" && zl?.modell === "regeln" && fragen.length === 0, "… eine harte Regel entscheidet auch ohne Modell — Spalte modell: „regeln“", zl);
      await arasSetzen("pruef_mara_tag_euro", "10");
    });

    console.log("── Fund 16 · Modell ohne Antwort: kein „ok“, und nach drei Fehlern keine weiteren Kosten");
    await abschnitt("Fund 16 Fehler", async () => {
      await pruefAufraeumen(); fragen.length = 0;
      antwort = () => ({ urteil: null, modell: "q419-modell", kostenCents: 0 });
      const m = await mail("Guten Tag, danke für Ihre Geduld. Wir prüfen das und melden uns. Freundliche Grüße");
      for (let i = 0; i < 4; i++) await P.pruefungTakt();
      ok(!(await pruefZeile("postmeister", m.id)), "keine Antwort vom Modell: der Fall bleibt ungebucht (vorher „ok“ mit Modellnamen)");
      ok(fragen.length === 3, "nach drei Fehlern fragt Prüf-Mara diese Stelle nicht mehr (bis zum Neustart)", fragen.length);
      antwort = () => ({ urteil: { urteil: "ok", punkte: [], begruendung: "Q419 ok" }, modell: "q419-modell", kostenCents: 0 });
    });

    console.log("── Fund 16 · „gelb → grün“ je Werkzeug, Historie nur bei Arbeit");
    await abschnitt("Fund 16 Werkzeuge", async () => {
      await pruefAufraeumen(); fragen.length = 0;
      await sql`INSERT INTO fiaon_mara_protokoll (am, kanal, person_id, art, ok, text, daten) VALUES (NOW() - INTERVAL '8 minutes', 'whatsapp', ${pid}, 'ampel_gelb', TRUE, 'Ratenpause — lief (Ampel gelb).', ${sql.json({ werkzeug: "ratenpause_setzen", stufe: "gelb" })})`;
      const [w] = (await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, von, status, gesendet_am, created_at)
                             VALUES ('q419-w1', 'raus', '+4915100419001', ${pid}, 'text', 'Gern, die Rate ist um einen Monat verschoben. Alles Gute! (Q419-W1)', 'Mara Lindner', 'delivered', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes') RETURNING id`) as any[];
      await P.pruefungTakt();
      const zw = await pruefZeile("whatsapp", Number(w.id));
      ok(Array.isArray(zw?.werkzeuge) && zw.werkzeuge.includes("ratenpause_setzen"), "die Prüfung kennt das Werkzeug, das dabei unter Gelb lief", zw?.werkzeuge);
      for (let i = 1; i <= 20; i++) await sql`INSERT INTO fiaon_ki_pruefung (kanal, bezug_art, bezug_id, person_id, urteil, punkte, modell, kosten_cents, werkzeuge, created_at) VALUES ('whatsapp', 'q419_test', ${i}, NULL, 'ok', '[]'::jsonb, 'q419-modell', 0, ${["ratenpause_setzen"]}, NOW() - INTERVAL '2 days')`;
      const fq = await P.fehlerquote(28);
      ok(fq.vorschlaege.some((v: string) => v.includes("ratenpause_setzen")), "nach 4 Wochen unter 2 %: Vorschlag „gelb → grün“ (vorher nie möglich)", fq.vorschlaege);
      P.pruefungZwischenspeicherLeeren();
      const h1 = await P.pruefungTaktFuerHistorie();
      const h2 = await P.pruefungTaktFuerHistorie();
      ok(h1 === true && h2 === false, "Historie: eine Zeile beim ersten Lauf (Lebenszeichen), keine für den leeren Lauf gleich danach", { h1, h2 });
    });

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Fund 14 · „0 je Tag“ heißt 0; leer heißt Vorgabe");
    await abschnitt("Fund 14", async () => {
      await arasSetzen("mara_wa_nachfass_tag", "0");
      const NF = await import("../server/lib/fiaon-mara-nachfass");
      const nf = await NF.nachfassLauf({ trocken: true });
      ok((nf.uebersprungen.tagesdeckel ?? 0) === 1 && nf.kandidaten === 0, "Nachfassen mit Deckel 0: kein Lauf (vorher wurden daraus 40)", nf.uebersprungen);
      await arasSetzen("pruef_mara_tag_euro", "");
      ok((await E.registerZahl("pruef_mara_tag_euro")) === 10, "leerer Eintrag → Vorgabe 10 € (vorher 0)");
      await arasSetzen("pruef_mara_tag_euro", "0");
      ok((await E.registerZahl("pruef_mara_tag_euro")) === 0, "eingetragene 0 bleibt 0");
      await sql`DELETE FROM fiaon_settings WHERE key = ANY(${["mara_wa_nachfass_tag", "pruef_mara_tag_euro"]})`;
    });

    console.log("── Fund 15 · Maras Auftrag stellt Schalter über DENSELBEN Weg wie der Knopf");
    await abschnitt("Fund 15", async () => {
      const AUF = await import("../server/lib/fiaon-mara-auftrag");
      const w = AUF.werkzeugFinden("einstellung_setzen")!;
      const r1 = await w.ausfuehren({ schluessel: "mara_aktion_runde_seit", wert: "jetzt" } as any, "Prüfstand Q419");
      const runde = await wert("mara_aktion_runde_seit");
      ok(r1.ok && !!runde && runde !== "jetzt" && Number.isFinite(Date.parse(runde)), "Runde „jetzt“ → ein Zeitpunkt (vorher stand das Wort „jetzt“ da)", { r1, runde });
      const r2 = await w.ausfuehren({ schluessel: "mara_aktion_postfach", wert: "fremd@example.com" } as any, "Prüfstand Q419");
      ok(!r2.ok && (await wert("mara_aktion_postfach")) !== "fremd@example.com", "ein fremdes Absender-Postfach geht nicht (Grenze des Steuerpults)", r2);
      const r3 = await w.ausfuehren({ schluessel: "postmeister_modus_support", wert: "aus" } as any, "Prüfstand Q419");
      ok(!r3.ok && /eigenen Weg/.test(String(r3.text)) && (await wert("postmeister_modus_support")) !== "aus", "Postfach-Modus: Mara schreibt nicht vorbei, sondern sagt, wo der Schalter steht", r3);
      const r4 = await w.ausfuehren({ schluessel: "mara_rate_erinnerung", wert: "aus" } as any, "Prüfstand Q419");
      ok(r4.ok && (await wert("mara_rate_erinnerung")) === "aus", "Raten-Mail aus: über den Schalter der Raten-Mail", { r4, w: await wert("mara_rate_erinnerung") });
    });

    console.log("── Fund 17 · Werbe-Anrufe (lead, stufe_b, rueckholung) nur mit LEXR-Vermerk — auf dem Server");
    await abschnitt("Fund 17", async () => {
      anbinden();
      const s1 = await E.einstellungSetzen("aras_spielarten", JSON.stringify({ lead: "an" }), "Prüfstand Q419");
      ok(!s1.ok && (s1 as any).status === 400 && !(await wert("aras_spielarten")), "ohne Vermerk: lead lässt sich nicht einschalten (vorher ging es durch)", s1);
      const s2 = await E.einstellungSetzen("ki_lexr_freigabe", "LEXR-Freigabe am 25.10.2026 (Prüfstand)", "Prüfstand Q419");
      const s3 = await E.einstellungSetzen("aras_spielarten", JSON.stringify({ lead: "an" }), "Prüfstand Q419");
      // E-408 (Justin 20.10.2026, „nur Vertragskunden“): Lead, Stufe B, Rückholung und Zuruf sind im CODE gesperrt — auch mit
      // LEXR-Vermerk bleibt lead aus (nur eine Code-Änderung hebt das auf).
      ok(s2.ok && !s3.ok && (s3 as any).status === 400 && /gesperrt – nur Vertragskunden/.test(String((s3 as any).fehler ?? "")) && !/"lead":"an"/.test(String(await wert("aras_spielarten") ?? "")), "mit Vermerk: lead bleibt trotzdem aus (gesperrt – nur Vertragskunden)", { s2, s3 });
      const s4 = await E.einstellungSetzen("ki_lexr_freigabe", "", "Prüfstand Q419");
      ok(s4.ok, "den Vermerk löschen geht (lead war nie an)", s4);
      const s5 = await E.einstellungSetzen("aras_spielarten", JSON.stringify({ lead: "aus" }), "Prüfstand Q419");
      const s6 = await E.einstellungSetzen("ki_lexr_freigabe", "", "Prüfstand Q419");
      ok(s5.ok && s6.ok, "lead aus → dann lässt sich der Vermerk löschen", { s5, s6 });
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
