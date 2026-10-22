// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-409 KALIBRIERUNG (22.10.2026), DATENBANK — die Einmal-Neubewertung der ARAS-Prüfungen seit dem Go-live und
// die Stufen-Ampel danach. Nachgestellt ist die Lage vom 21./22.10.: Prüfzeilen der alten Fassung (ohne Regelstand) mit den
// Fehlalarmen gegen Justins Vorgaben — und zwei echte Verstöße, die bleiben. Erfundene Person (Marke E409K), kein Netz,
// keine Schlüssel, das Modell ist eine Attrappe.
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e408_basis fiaon_pr_pruef
//   U="postgresql://fiaon@127.0.0.1:54329/fiaon_pr_pruef?sslmode=require"
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL="$U" DATABASE_URL_EXTERN="$U" npx tsx scripts/pruef-e409-kalibrierung-db.ts
//   PGSSLMODE=require dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pr_pruef
// ═══════════════════════════════════════════════════════════════════════════
const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_(?:pruefstand|pr_)/.test(URL_)) { console.error("Nur gegen eine lokale Prüfstand-Datenbank (fiaon_pruefstand* / fiaon_pr_*)."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "WHATSAPP_TOKEN"]) delete process.env[k];
process.env.KI_ANBIETER = "openai";
process.env.CRONS = "aus";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra: unknown = "") => {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)?.slice(0, 700)}` : ""}`); }
};
let netz = 0;
globalThis.fetch = (async (url: any) => { netz++; return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 }); }) as any;

const MARKE = "e409k";
const MERKER = "pruef_mara_neubewertung_e409_2210";
const KEYS = [MERKER, "aras_stufe", "aras_stufe_auto", "pruef_mara_an", "pruef_mara_quote", "pruef_mara_tag_euro"];

async function main() {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const P = await import("../server/lib/fiaon-ki-pruefung");
  const S = await import("../server/lib/fiaon-aras-stufe");
  const PL = await import("../server/lib/fiaon-aras-plan");
  const R = await import("../shared/fiaon-ki-pruefung-regeln");
  await (await import("../server/lib/fiaon-aras-schema")).arasSchema();
  await (await import("../server/lib/fiaon-mara-termin")).protokollTabelle();
  await (await import("../server/lib/fiaon-postmeister-schema")).postmeisterSchema();
  await (await import("../server/lib/fiaon-mara-entscheidungen")).entscheidungTabellen();
  await P.pruefungTabellen();

  const vorher = (await sql`SELECT key, value, updated_at FROM fiaon_settings WHERE key = ANY(${KEYS})`) as any[];
  const aufraeumen = async () => {
    const personen = ((await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE 'PR-E409K-%'`) as any[]).map((r) => Number(r.id));
    const anrufe = ((await sql`SELECT id, call_id FROM fiaon_aras_anruf WHERE prompt_version = ${MARKE}`) as any[]);
    const pruefIds = ((await sql`SELECT id FROM fiaon_ki_pruefung WHERE person_id = ANY(${personen}) OR (bezug_art = 'aras_anruf' AND bezug_id = ANY(${anrufe.map((a) => Number(a.id))})) OR (bezug_art = 'postmeister' AND bezug_id = 940901)`) as any[]).map((r) => Number(r.id));
    await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel = ANY(${pruefIds.map((i) => `pruefung:${i}`)})`;
    await sql`DELETE FROM fiaon_ki_pruefung WHERE id = ANY(${pruefIds})`;
    await sql`DELETE FROM fiaon_aras_anruf WHERE prompt_version = ${MARKE}`;
    if (anrufe.length) await sql`DELETE FROM fiaon_calls WHERE id = ANY(${anrufe.map((a) => Number(a.call_id))})`;
    await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PR-E409K-%'`;
    await sql`DELETE FROM fiaon_aras_stufe_tag WHERE tag >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - 9`;
    await sql`DELETE FROM fiaon_system_alarme WHERE schluessel LIKE 'aras:stufe:%'`.catch(() => null);
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${KEYS})`;
    P.pruefModellSetzen(null);
    P.pruefungZwischenspeicherLeeren();
    PL.arasEinstellungenVergessen();
  };
  await aufraeumen();
  const [person] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PR-E409K-1', 'Kordula', 'Musterhuber', 'e409k@test.invalid') RETURNING id`) as any[];
  const pid = Number(person.id);
  const [agent] = (await sql`SELECT id FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];

  // ── Bausteine: ein ARAS-Anruf (Zeiten in Sekunden nach dem Abheben) und seine Prüfzeile der ALTEN Fassung ──
  const A = (text: string) => ({ t: 0, wer: "aras", text }), K = (text: string) => ({ t: 0, wer: "kunde", text });
  const OHNE_NAMEN = [A("Grüß Sie!"), A("ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam."), A("Kurz vorweg: I bin a KI, aber a nette."), A("(lacht) I ruf wegen Ihrem Kreditkartenpaket an — mit wem sprech i, bitte?")];
  const MIT_NAMEN = [A("Grüß Sie, Frau Musterhuber!"), A("ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam."), A("Kurz vorweg: I bin a KI, aber a nette."), A("(lacht) I ruf wegen Ihrem Kreditkartenpaket an — habens an Moment?")];
  const RATE = A("I ruf an wegen Ihrer offenen Rate über neunundneunzig Euro neunundneunzig — i schick Ihnen glei die Rechnung zu, seins so guat und zahlens ma die ein, bitte.");
  const E373 = A("Sobald Ihre Zahlung da ist, schalten wir Ihren Account frei, damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit nutzen können.");
  const AUFNAHME = [A("Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?"), K("Ja, gern.")];
  type Anruf = { am: string; transkript?: any[] | null; ja?: number | null; ki?: number; live?: any; status?: string; marke?: string };
  const anruf = async (o: Anruf): Promise<number> => {
    const [c] = (await sql`INSERT INTO fiaon_calls (person_id, agent_id, nummer, richtung, status, beginn, gefuehrt_von)
                           VALUES (${pid}, ${Number(agent.id)}, '+4915100409001', 'raus', 'beendet', ${o.am}::timestamptz, 'aras') RETURNING id`) as any[];
    const [a] = (await sql`
      INSERT INTO fiaon_aras_anruf (call_id, spielart, adapter, prompt_version, briefing, angenommen_am, ki_hinweis_am, aufnahme_ja_am, aufnahme_gestartet_am,
                                    transkript, zusammenfassung, ergebnis, ende_grund, sekunden_sitzung, pruefung, pruefung_status, created_at, updated_at)
      VALUES (${Number(c.id)}, 'rate', 'attrappe', ${MARKE}, ${sql.json({ nachname: "Musterhuber", vorname: "Kordula", anrede: null, marke: o.marke ?? null })},
              ${o.am}::timestamptz, ${o.am}::timestamptz + make_interval(secs => ${o.ki ?? 2}),
              ${o.ja != null ? sql`${o.am}::timestamptz + make_interval(secs => ${o.ja})` : null}, ${o.ja != null ? sql`${o.am}::timestamptz + make_interval(secs => ${o.ja})` : null},
              ${o.transkript ? sql.json(o.transkript) : null}, ${`Gespräch ${o.marke ?? ""}`}, 'erreicht_sonstiges', 'aras_beendet', 120,
              ${o.live ? sql.json(o.live) : null}, ${o.status ?? "offen"}, ${o.am}::timestamptz, NOW() - INTERVAL '5 minutes')
      RETURNING id`) as any[];
    return Number(a.id);
  };
  const M = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) => ({ regel: `modell_${regel}`, schwere, treffer, hinweis });
  const altePruefung = async (anrufId: number, urteil: string, punkte: any[], modell: string, am: string): Promise<number> => {
    const [z] = (await sql`
      INSERT INTO fiaon_ki_pruefung (kanal, bezug_art, bezug_id, person_id, urteil, punkte, begruendung, modell, kosten_cents, schluessel, created_at)
      VALUES ('telefon', 'aras_anruf', ${anrufId}, ${pid}, ${urteil}, ${JSON.stringify(punkte)}::text::jsonb, ${modell === "regeln" ? null : "Alte Begründung (E409K)."}, ${modell}, 0, 'spielart:rate', ${am}::timestamptz + INTERVAL '3 minutes')
      RETURNING id`) as any[];
    await sql`UPDATE fiaon_aras_anruf SET pruefung_status = ${urteil} WHERE id = ${anrufId}`;
    return Number(z.id);
  };
  const zeile = async (id: number) => ((await sql`SELECT * FROM fiaon_ki_pruefung WHERE id = ${id}`) as any[])[0] ?? null;
  const status = async (anrufId: number) => String(((await sql`SELECT pruefung_status FROM fiaon_aras_anruf WHERE id = ${anrufId}`) as any[])[0]?.pruefung_status ?? "");
  const harteRegeln = (z: any) => (Array.isArray(z?.punkte) ? z.punkte : []).filter((p: any) => p.schwere === "hart").map((p: any) => p.regel);

  // Gestern (21.10.-Lage) und heute (22.10.-Lage), Berliner Zeit — beide nach dem Go-live (21.10. 07:00 UTC).
  const [zeit] = (await sql`SELECT GREATEST(NOW() - INTERVAL '1 day', '2026-10-21 08:00:00+00'::timestamptz)::text AS gestern, (NOW() - INTERVAL '40 minutes')::text AS heute`) as any[];
  const G = String(zeit.gestern), H = String(zeit.heute);

  try {
    // ═════════════════════════════════════════════════════════════════════
    console.log("── Lage wie am 21./22.10.: Prüfzeilen der alten Fassung (ohne Regelstand), Stufe 1 seit gestern Abend");
    const f: Record<string, { anruf: number; pruefung: number }> = {};
    const mach = async (name: string, a: Anruf, urteil: string, punkte: any[], modell: string) => { const id = await anruf({ ...a, marke: name }); f[name] = { anruf: id, pruefung: await altePruefung(id, urteil, punkte, modell, a.am) }; };
    // gestern: 5 „fehler“ (3 Fehlalarme, 2 echte) + 3 saubere
    await mach("g1_name", { am: G, ja: 40, transkript: [...OHNE_NAMEN, K("Musterhuber, Kordula"), A("Okay, sehr gut, Frau Musterhuber."), RATE, A("Damit wir Ihr Wunschlimit von fünfundzwanzigtausend Euro weiter begleiten können, fehlt die noch."), ...AUFNAHME] },
      "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "I ruf an wegen Ihrer offenen Rate", hinweis: "x" }, M("ton", "weich", "ARAS: Damit wir Ihr Wunschlimit …", "Wunschlimit als Versprechen?"), M("ton", "weich", "ARAS: (lacht) I ruf wegen Ihrem Kreditkartenpaket an.", "Lachen und Umgangssprache.")], "gpt-attrappe");
    await mach("g2_ki_aufnahme", { am: G, ja: 60, transkript: [A("Grüß Sie!"), A("ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam."), A("Kurz vorweg: I bin a KI, aber a nette."), A("(lacht) mit wem spreche ich bitte?"), K("Hallo"), A("Spreche ich mit Frau Musterhuber?"), K("Ja, genau."), A("Mhm, Sein Wunschlimit sind fünfundzwanzigtausend."), ...AUFNAHME] },
      "fehler", [{ regel: "limit_freigabe", schwere: "hart", treffer: "Mhm, Sein Wunschlimit sind fünfundzwanzigtausend.", hinweis: "x" }, M("telefon_ki_hinweis", "hart", "ARAS: Kurz vorweg: I bin a KI, aber a nette.", "Der KI-Hinweis muss im ersten Satz erfolgen."), M("telefon_aufnahme", "hart", "ARAS: Darf ich unser Gespräch kurz aufzeichnen?", "Aufnahme vor dem hörbaren Ja.")], "gpt-attrappe");
    await mach("g3_live_alt", { am: G, live: { live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } }, "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "", hinweis: "Live-Prüfung ohne Aufnahme: …" }], "regeln");
    await mach("g4_echt_identitaet", { am: G, ja: 50, transkript: [...MIT_NAMEN, K("Ja"), A("Okay, sehr gut, Frau Musterhuber — es geht um Ihre offene Rate über neunundneunzig Euro."), A("Okay, Ah, die Visa-Karte von unserer Partnerbank, genau die, mit Ihrem Wunschlimit, (lacht) damit Sie schnell loslegen können."), ...AUFNAHME] },
      "fehler", [{ regel: "limit_zusage", schwere: "hart", treffer: "… damit Sie schnell loslegen können.", hinweis: "x" }, M("druck", "weich", "Geht sich des heute noch aus?", "Druck.")], "gpt-attrappe");
    await mach("g5_echt_ki_spaet", { am: G, ki: 23, live: { live: true, punkte: [{ regel: "ki_hinweis_spaet", schwere: "hart" }] } }, "fehler", [{ regel: "ki_hinweis_spaet", schwere: "hart", treffer: "", hinweis: "Live-Prüfung ohne Aufnahme: KI-Hinweis zu spät." }], "regeln");
    for (const n of ["g6", "g7", "g8"]) await mach(n, { am: G, live: { live: true, punkte: [] } }, "ok", [], "regeln");
    // heute: 3 „fehler“ (alle Fehlalarme) + 3 saubere
    await mach("h1_name", { am: H, ja: 70, transkript: [...OHNE_NAMEN, K("Mit Kordula Musterhuber"), A("Mhm, freut mi, leiwand."), RATE, A("Geht sich des heute noch aus?"), ...AUFNAHME] },
      "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "I ruf an …", hinweis: "x" }, M("druck", "weich", "Geht sich das heut noch aus?", "Frage erzeugt Druck."), M("druck", "weich", "Wann schaffens die Überweisung — heut noch oder lieber morgen?", "Druck.")], "gpt-attrappe");
    await mach("h2_live_alt", { am: H, live: { live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } }, "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "", hinweis: "Live-Prüfung ohne Aufnahme: …" }], "regeln");
    await mach("h3_klebt", { am: H, ja: 35, transkript: [...OHNE_NAMEN, K("Mitmusterhuba"), A("Okay, Ah, grüß Sie, Frau Musterhuber, freut mi."), RATE, E373, ...AUFNAHME] },
      "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "I ruf an …", hinweis: "x" }, { regel: "limit_zusage", schwere: "hart", treffer: E373.text, hinweis: "x" }, M("ton", "weich", "ARAS: Kurz vorweg, i bin a KI, aber a nette.", "Sehr umgangssprachlich und dialektal.")], "gpt-attrappe");
    for (const n of ["h4", "h5", "h6"]) await mach(n, { am: H, live: { live: true, punkte: [] } }, "ok", [], "regeln");
    // Stufe 1 seit gestern Abend (wie die Automatik sie am 22.10. um 00:09 setzte), Automatik an; die Ampel-Zeilen standen auf Rot.
    await PL.einstellungSetzen("aras_stufe", "1", "pruefstand");
    await sql`UPDATE fiaon_settings SET updated_at = NOW() - INTERVAL '20 hours' WHERE key = 'aras_stufe'`;
    await PL.einstellungSetzen("aras_stufe_auto", "an", "pruefstand");
    PL.arasEinstellungenVergessen();
    await sql`INSERT INTO fiaon_aras_stufe_tag (tag, stufe, werte, farbe, punkte) VALUES ((${G}::timestamptz AT TIME ZONE 'Europe/Berlin')::date, 2, '{}'::jsonb, 'rot', '[]'::jsonb), ((${H}::timestamptz AT TIME ZONE 'Europe/Berlin')::date, 1, '{}'::jsonb, 'rot', '[]'::jsonb)
              ON CONFLICT (tag) DO UPDATE SET farbe = 'rot'`;
    // So hätte die ALTE Zählung gerechnet (Status „fehler“ oder harter Live-Befund): heute 3 von 6 → Rot → Stufe 1 → 0.
    const altHeute = ((await sql`SELECT COUNT(*) FILTER (WHERE pruefung_status = 'fehler' OR (pruefung->'punkte') @> '[{"schwere":"hart"}]')::int AS n FROM fiaon_aras_anruf WHERE prompt_version = ${MARKE} AND created_at >= ${H}::timestamptz - INTERVAL '1 minute'`) as any[])[0].n;
    ok(altHeute === 3, "Ausgangslage: nach alter Zählung heute 3 von 6 Gesprächen „Prüf-Fehler“ (Rot, Stufe zurück)", altHeute);

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Die Stufen-Automatik (normaler Lauf): bewertet zuerst neu, rechnet die Tageszeilen neu, schaltet NICHT hoch");
    const lauf = await S.stufeAutomatik(sql);
    const neuGerechnet = ((await sql`SELECT COUNT(*) FILTER (WHERE regel_stand = ${R.PRUEF_REGEL_STAND})::int AS n, COUNT(*)::int AS alle FROM fiaon_ki_pruefung WHERE person_id = ${pid}`) as any[])[0];
    ok(neuGerechnet.n === neuGerechnet.alle && neuGerechnet.alle === 14, "alle 14 alten Prüfzeilen tragen jetzt den Regelstand e409-2210 (die Automatik rief die Neubewertung)", neuGerechnet);
    ok(!lauf.geaendert && !lauf.rotJetzt && lauf.neu == null, "kein Rot mehr seit der Stufen-Änderung → keine weitere Stufe zurück, und auch KEINE Stufe hoch", { g: lauf.geaendert, rot: lauf.rotJetzt, grund: lauf.grund });
    ok((await PL.arasEinstellungenLesen(true)).stufe === 1, "aras_stufe bleibt 1 (hochschalten macht die Automatik erst nach grünen Tagen — oder Justin)");
    const tage = (await sql`SELECT tag::text AS tag, farbe, punkte, (werte->>'pruefFehler')::int AS pf, (werte->>'gespraeche')::int AS g FROM fiaon_aras_stufe_tag
                             WHERE tag IN ((${G}::timestamptz AT TIME ZONE 'Europe/Berlin')::date, (${H}::timestamptz AT TIME ZONE 'Europe/Berlin')::date) ORDER BY tag`) as any[];
    const pfFarbe = (t: any) => (t?.punkte ?? []).find((p: any) => p.schluessel === "pruef_fehler")?.farbe;
    ok(tage.length === 2 && tage[1].pf === 0 && pfFarbe(tage[1]) === "gruen", "heute: 0 von 6 Prüf-Fehlern (vorher 3) → Prüf-Ampel grün", tage[1]);
    ok(tage[0].pf === 2 && pfFarbe(tage[0]) === "rot", "gestern: 2 echte Verstöße (Rate vor der Identität, KI-Hinweis nach 23 s) von 8 → bleibt rot (vorher 5)", tage[0]);
    ok(!lauf.karte, "keine neue Stufen-Karte an Justin");

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Je Fall: Fehlalarme → ok, echte Verstöße → fehler; Status, Begründung, Merker");
    for (const n of ["g1_name", "g2_ki_aufnahme", "g3_live_alt", "h1_name", "h2_live_alt", "h3_klebt"]) {
      const z = await zeile(f[n].pruefung);
      ok(z?.urteil === "ok" && !harteRegeln(z).length && (await status(f[n].anruf)) === "ok" && /^Neu bewertet \(E-409, 22\.10\.2026; vorher „fehler“\)/.test(String(z?.begruendung ?? "")), `${n}: fehler → ok (Status ok, Begründung sagt „neu bewertet“)`, { u: z?.urteil, p: z?.punkte, b: z?.begruendung });
    }
    const g3 = await zeile(f.g3_live_alt.pruefung);
    ok((g3?.punkte ?? []).some((p: any) => p.regel === "alt_anliegen_vor_identitaet" && p.schwere === "weich"), "alter Live-Befund ohne Wortlaut bleibt sichtbar — als „alt_…“, weich, nicht nachprüfbar");
    const g4 = await zeile(f.g4_echt_identitaet.pruefung), g5 = await zeile(f.g5_echt_ki_spaet.pruefung);
    ok(g4?.urteil === "fehler" && harteRegeln(g4).includes("anliegen_vor_identitaet") && !harteRegeln(g4).includes("limit_zusage"), "ROT-PROBE g4: Gruß mit Namen + „Moment?“ + nur „Ja“ + Rate → bleibt fehler (jetzt wegen der Identität, nicht wegen „Wunschlimit … loslegen“)", g4?.punkte);
    ok(g5?.urteil === "fehler" && harteRegeln(g5).includes("ki_hinweis_spaet"), "ROT-PROBE g5: KI-Hinweis nach 23 s (Zeitstempel) → bleibt fehler", g5?.punkte);
    const [merker] = (await sql`SELECT value FROM fiaon_settings WHERE key = ${MERKER}`) as any[];
    const mj = merker ? JSON.parse(String(merker.value)) : null;
    ok(mj?.geprueft === 14 && mj?.fehlerVorher === 8 && mj?.fehlerNachher === 2 && mj?.geaendert?.length === 6, "Merker in fiaon_settings: 14 neu gerechnet, „fehler“ 8 → 2, 6 geändert", mj);

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Einmal: zweiter Lauf ändert nichts; Nachzügler der alten Instanz werden gefangen; andere Zeilen bleiben unberührt");
    const nochmal = await P.arasPruefungenNeuBewerten({ sofort: true, bis: new Date(Date.now() + 2000) });
    ok(nochmal === null, "zweiter Lauf: nichts mehr zu tun", nochmal);
    const nz = await anruf({ am: H, marke: "nachzuegler", transkript: [...OHNE_NAMEN, K("Musterhuber hier"), RATE, ...AUFNAHME], ja: 30 });
    const nzP = await altePruefung(nz, "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "x", hinweis: "x" }], "regeln", H);
    const vorDem = await anruf({ am: "2026-10-20T12:00:00+02:00", marke: "vor_go_live", live: { live: true, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } });
    const vorDemP = await altePruefung(vorDem, "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "", hinweis: "x" }], "regeln", "2026-10-20T12:00:00+02:00");
    await sql`INSERT INTO fiaon_ki_pruefung (kanal, bezug_art, bezug_id, person_id, urteil, punkte, modell, kosten_cents) VALUES ('mail', 'postmeister', 940901, ${pid}, 'fehler', '[{"regel":"modell_wahrheit","schwere":"hart","treffer":"x","hinweis":"x"}]'::jsonb, 'gpt-attrappe', 0)`;
    const nach = await P.arasPruefungenNeuBewerten({ sofort: true, bis: new Date(Date.now() + 2000) });
    ok(nach?.geprueft === 1 && (await zeile(nzP))?.urteil === "ok", "Nachzügler (Zeile ohne Regelstand, nach dem ersten Lauf) → beim nächsten Lauf neu gerechnet", nach);
    ok((await zeile(vorDemP))?.urteil === "fehler" && (await zeile(vorDemP))?.regel_stand == null, "eine Prüfung vor dem Go-live (20.10.) bleibt unberührt");
    const mail = ((await sql`SELECT urteil, regel_stand FROM fiaon_ki_pruefung WHERE bezug_art = 'postmeister' AND bezug_id = 940901`) as any[])[0];
    ok(mail?.urteil === "fehler" && mail?.regel_stand == null, "Mail-/WhatsApp-Prüfungen bleiben unberührt (nur ARAS)", mail);
    const [merker2] = (await sql`SELECT value FROM fiaon_settings WHERE key = ${MERKER}`) as any[];
    ok(merker2?.value === merker?.value, "der Merker hält den ERSTEN Lauf fest — Nachzügler ändern ihn nicht");

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Karten: ein Fehlalarm mit offener Karte wird geschlossen; ein echter Verstoß behält seine Karte");
    const k1 = await anruf({ am: H, marke: "karte_fehlalarm", ja: 30, transkript: [...OHNE_NAMEN, K("Musterhuber, Kordula"), RATE, ...AUFNAHME] });
    const k1P = await altePruefung(k1, "fehler", [{ regel: "anliegen_vor_identitaet", schwere: "hart", treffer: "x", hinweis: "x" }], "regeln", H);
    const k2 = await anruf({ am: H, marke: "karte_echt", ja: 30, transkript: [...OHNE_NAMEN, K("Musterhuber, Kordula"), A("Wenn Sie heute nicht zahlen, geht das ans Inkasso."), ...AUFNAHME] });
    const k2P = await altePruefung(k2, "fehler", [{ regel: "druck", schwere: "hart", treffer: "Wenn Sie heute nicht zahlen, geht das ans Inkasso.", hinweis: "x" }], "regeln", H);
    for (const id of [k1P, k2P]) {
      await sql`INSERT INTO fiaon_mara_entscheidungen (schluessel, art, person_id, titel, text, empfehlung, optionen) VALUES (${`pruefung:${id}`}, 'pruefung', ${pid}, ${`E409K Prüf-Mara #${id}`}, 'x', 'in_ordnung', '[{"key":"in_ordnung","label":"In Ordnung","werkzeug":"pruefung_in_ordnung"}]'::jsonb)`;
      await sql`UPDATE fiaon_ki_pruefung SET karte_schluessel = ${`pruefung:${id}`} WHERE id = ${id}`;
    }
    const kl = await P.arasPruefungenNeuBewerten({ sofort: true, bis: new Date(Date.now() + 2000) });
    const karte = async (id: number) => String(((await sql`SELECT status FROM fiaon_mara_entscheidungen WHERE schluessel = ${`pruefung:${id}`}`) as any[])[0]?.status ?? "");
    ok(kl?.kartenZu === 1 && (await karte(k1P)) === "erledigt_von_selbst" && (await zeile(k1P))?.entschieden === "neu_bewertet", "Fehlalarm: Karte geschlossen, Prüfung „neu_bewertet“", kl);
    ok((await karte(k2P)) === "offen" && (await zeile(k2P))?.urteil === "fehler" && !(await zeile(k2P))?.entschieden, "ROT-PROBE: Drohung mit Inkasso → bleibt fehler, Karte bleibt offen");

    // ═════════════════════════════════════════════════════════════════════
    console.log("── Nach dem Deploy: neue Prüfungen im Takt — das Modell (Attrappe) liefert die alten Fehlalarme, Prüf-Mara verwirft sie");
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('pruef_mara_an', 'an') ON CONFLICT (key) DO UPDATE SET value = 'an'`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('pruef_mara_quote', '{"telefon":100,"mail":0,"whatsapp":0}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    const antworten: Record<string, unknown> = {
      t1: { urteil: "fehler", begruendung: "KI-Hinweis nicht im ersten Satz, Aufnahme vor dem Ja, dialektal, Druck, Wunschlimit als Versprechen.", punkte: [
        { regel: "telefon_ki_hinweis", schwere: "hart", treffer: "ARAS: Kurz vorweg: I bin a KI, aber a nette.", hinweis: "Der KI-Hinweis muss im ersten Satz erfolgen." },
        { regel: "telefon_aufnahme", schwere: "hart", treffer: "ARAS: Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", hinweis: "Aufnahme vor dem hörbaren Ja." },
        { regel: "ton", schwere: "weich", treffer: "ARAS: (lacht) I ruf wegen Ihrem Kreditkartenpaket an.", hinweis: "Sehr umgangssprachlich und dialektal, Lachen." },
        { regel: "druck", schwere: "weich", treffer: "Geht sich des heute noch aus?", hinweis: "Frage erzeugt Druck." },
        { regel: "wahrheit", schwere: "hart", treffer: E373.text, hinweis: "Verspricht die Karte mit Wunschlimit, was nicht garantiert werden darf." }] },
      t2: { urteil: "fehler", begruendung: "Drohung mit Inkasso.", punkte: [{ regel: "drohung", schwere: "hart", treffer: "Wenn Sie heute nicht zahlen, geht das ans Inkasso.", hinweis: "Drohung." }] },
    };
    P.pruefModellSetzen(async (ein: { text: string }) => {
      const m = /\(E409K-(t\d)\)/.exec(ein.text);
      return { urteil: R.modellUrteilLesen(JSON.stringify(antworten[m?.[1] ?? ""] ?? { urteil: "ok", punkte: [], begruendung: "ok" })), modell: "gpt-attrappe", kostenCents: 0 };
    });
    const t1 = await anruf({ am: H, marke: "t1", ja: 40, transkript: [...OHNE_NAMEN, K("Musterhuber, Kordula"), RATE, E373, A("Geht sich des heute noch aus? (E409K-t1)"), ...AUFNAHME] });
    const t2 = await anruf({ am: H, marke: "t2", ja: 40, transkript: [...OHNE_NAMEN, K("Musterhuber, Kordula"), A("Wenn Sie heute nicht zahlen, geht das ans Inkasso. (E409K-t2)"), ...AUFNAHME] });
    const t3 = await anruf({ am: H, marke: "t3", live: { live: true, stand: R.PRUEF_REGEL_STAND, punkte: [{ regel: "anliegen_vor_identitaet", schwere: "hart" }] } });
    const e = await P.pruefungTakt();
    const pz = async (anrufId: number) => ((await sql`SELECT * FROM fiaon_ki_pruefung WHERE bezug_art = 'aras_anruf' AND bezug_id = ${anrufId}`) as any[])[0] ?? null;
    const z1 = await pz(t1), z2 = await pz(t2), z3 = await pz(t3);
    ok(z1?.urteil === "ok" && !(z1?.punkte ?? []).length && z1?.regel_stand === R.PRUEF_REGEL_STAND && /5 Modell-Hinweise nach Justins Vorgaben verworfen/.test(String(z1?.begruendung)), "alle fünf alten Modell-Fehlalarme verworfen → ok, mit Regelstand, Begründung sagt es", z1);
    ok(z2?.urteil === "fehler" && (z2?.punkte ?? []).some((p: any) => R.punktMitBestand(p, "telefon")), "ROT-PROBE: Drohung mit Inkasso → fehler (Regel und Modell)", z2?.punkte);
    ok(z3?.urteil === "fehler" && (await status(t3)) === "fehler", "ROT-PROBE: neuer Live-Befund (mit Regelstand) „Rate vor der Identität“ → fehler", z3);
    ok(e.geprueft === 3, "drei Anrufe geprüft", e);
  } finally {
    await aufraeumen();
    for (const v of vorher) await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${v.key}, ${v.value}, ${v.updated_at}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
  }
  ok(netz === 0, `kein Netz (${netz} Aufrufe)`);
  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  await new Promise((r) => setTimeout(r, 1000));
  await sql.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
