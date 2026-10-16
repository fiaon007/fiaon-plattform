// Prüfstand E-383 (16.10.2026): Abgleich mit dem Profil, Freigabe nach Auftrag, Hell/Dunkel-Wechsel.
// KEIN echter Meta-Aufruf (Attrappe). Teil 1 offline, Teil 2 gegen eine LOKALE Test-DB. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e383 node_modules/.bin/tsx scripts/pruef-e383.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

process.env.META_APP_ID = "1";
process.env.META_APP_SECRET = "pruef-geheimnis";
process.env.META_SYSTEM_TOKEN = "pruef-token";

async function main() {
  const lokal = /127\.0\.0\.1:54329\//.test(String(process.env.DATABASE_URL));
  const R = await import("../shared/fiaon-social-meta");

  console.log("── 1 · Hell und dunkel, derselbe Post");
  ok(R.weltTon("glas") === "hell" && R.weltTon("kanzlei") === "hell", "glas und kanzlei sind hell");
  ok(R.weltTon("kino") === "dunkel" && R.weltTon("buehne") === "dunkel", "kino und bühne sind dunkel");
  ok(R.weltTon("") === null && R.weltTon(null) === null, "ohne Welt: keine Seite");
  ok(R.istDerselbe("Was weiß die SCHUFA über Sie? 🔍 Rund 68 Millionen Menschen …", { titel: "Was weiß die SCHUFA über Sie?", caption: "Was weiß die SCHUFA über Sie? 🔍 Über rund 69 Millionen" }), "nachträglich angepasster Text: über den Titel erkannt");
  ok(R.istDerselbe("Die meisten fangen am falschen Ende an. Sie suchen zuerst das Konto …", { titel: "x", caption: "Die meisten fangen am falschen Ende an. Sie suchen zuerst das Konto." }), "gleicher Textanfang: erkannt");
  ok(!R.istDerselbe("Jetzt unter: https://fiaon.com/business", { titel: "Ihre US-Gesellschaft. Ihr Weg", caption: "Ihre US-Gesellschaft. Ihr Weg zum US-Kapital." }), "fremder Beitrag: nicht derselbe");

  console.log("── 2 · Der Wechsel-Plan (der echte Fall vom 16.10.)");
  const B = (tag: number, h: number, m = 0) => Date.UTC(2026, 9, tag, h - 2, m); // Berlin = UTC+2 im Oktober
  const slot = (ms: number) => {
    const ab = ms + 3_600_000;
    for (let d = 0; d < 10; d++) for (const [h, m] of [[7, 30], [12, 30], [18, 30]]) {
      const t = Date.UTC(new Date(ab).getUTCFullYear(), new Date(ab).getUTCMonth(), new Date(ab).getUTCDate() + d, h - 2, m);
      if (t >= ab) return t;
    }
    return ab;
  };
  const H = "hell" as const, D = "dunkel" as const;
  const kuenftig = [
    { id: 32, ton: H, planMs: B(16, 7, 30) }, { id: 33, ton: D, planMs: B(16, 12, 30) }, { id: 34, ton: H, planMs: B(16, 18, 30) },
    { id: 35, ton: D, planMs: B(17, 10) }, { id: 36, ton: H, planMs: B(17, 14) }, { id: 37, ton: D, planMs: B(17, 18) },
    { id: 38, ton: H, planMs: B(18, 10) }, { id: 39, ton: D, planMs: B(18, 14) }, { id: 40, ton: H, planMs: B(18, 18) },
    { id: 41, ton: D, planMs: B(19, 7, 30) }, { id: 42, ton: H, planMs: B(19, 12, 30) }, { id: 43, ton: D, planMs: B(19, 18, 30) },
    { id: 44, ton: D, planMs: B(20, 7, 30) }, { id: 45, ton: H, planMs: B(20, 18, 30) }, { id: 46, ton: D, planMs: B(21, 7, 30) },
    { id: 47, ton: D, planMs: B(21, 18, 30) },
  ];
  const rueckstand = [
    { id: 26, ton: H, planMs: B(14, 7, 30) }, { id: 27, ton: D, planMs: B(14, 12, 30) }, { id: 28, ton: H, planMs: B(14, 18, 30) },
    { id: 29, ton: D, planMs: B(15, 7, 30) }, { id: 30, ton: H, planMs: B(15, 12, 30) }, { id: 31, ton: D, planMs: B(15, 18, 30) },
  ];
  const jetzt = B(16, 9, 10);
  const zuege = R.wechselPlanen({ letzterTon: D, jetztMs: jetzt, kuenftig, rueckstand, slotNach: slot });
  const neu = new Map(zuege.map((z) => [z.id, z.nachMs]));
  const reihe = [...kuenftig, ...rueckstand]
    .map((p) => ({ ...p, planMs: neu.has(p.id) ? neu.get(p.id)! : p.planMs }))
    .filter((p) => p.planMs != null && (kuenftig.some((k) => k.id === p.id) || neu.has(p.id)))
    .sort((a, b) => a.planMs! - b.planMs!);
  const folge = [D, ...reihe.map((p) => p.ton)];
  const wechselt = folge.every((t, i) => i === 0 || t !== folge[i - 1]);
  ok(wechselt, "die ganze Reihe wechselt hell/dunkel ab — nach dem letzten (dunklen) Post", reihe.map((p) => `${p.id}${p.ton === H ? "H" : "D"}`).join(" "));
  ok(!neu.has(35) && !neu.has(40), "feste Termine (Tag 107, Wochenrückblick) bleiben, wo sie sind");
  ok(neu.get(26)! > B(19, 18, 30) && neu.get(26)! < B(20, 7, 30), "#26 (hell) schließt die Lücke zwischen zwei dunklen (19./20.10.)");
  ok(neu.has(28) && neu.has(30) && neu.has(27), "weitere liegen gebliebene kommen dahinter, abwechselnd");
  ok(!neu.has(29) && !neu.has(31), "was nicht aufgeht (zwei dunkle übrig), wird nicht gequetscht");
  ok([...neu.values()].every((t) => t === null || t > jetzt), "nichts in die Vergangenheit");
  const nurDunkel = R.wechselPlanen({ letzterTon: D, jetztMs: jetzt, kuenftig: [{ id: 1, ton: D, planMs: jetzt + 3_600_000 }], rueckstand: [], slotNach: slot });
  ok(nurDunkel.length === 1 && nurDunkel[0].nachMs === null, "dunkel nach dunkel ohne hellen Ersatz → wartet ohne Uhrzeit");

  if (!lokal) { console.log("\n(Teil 3 übersprungen — nur gegen die lokale Test-DB)"); }
  else {
    console.log("── 3 · Abgleich, Freigabe, Wechsel im Lauf (lokale DB, Meta-Attrappe)");
    const { sqlPool } = await import("../server/lib/db-pool");
    const S = await import("../server/lib/fiaon-social");
    const SM = await import("../server/lib/fiaon-social-meta");
    await S.ensureSocialTabellen();
    await SM.ensureMetaAutomatikTabellen();
    await sqlPool`DELETE FROM fiaon_social_meta_auftraege`;
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('social_auto_posten','social_auto_aktiv_seit','social_auto_ki_stopp','social_auto_freigabe','social_wechsel_wartend','social_letzter_ton')`;
    await sqlPool`DELETE FROM fiaon_social_posts WHERE extern_id LIKE 'pruef-e383-%'`;
    await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('social_auto_aktiv_seit', ${new Date(Date.now() - 3 * 3_600_000).toISOString()}, NOW())`;
    const datei = (id: number) => ({ datei_id: id, pos: 0, rolle: "bild", mime: "image/jpeg", dateiname: `d${id}`, sha256: "0".repeat(64), bytes: 1, breite: 1080, hoehe: 1350, sekunden: null });
    const neuPost = async (x: { id: string; welt: string; minuten: number; caption: string; ki?: boolean }) => {
      const plan = new Date(Date.now() + x.minuten * 60_000);
      const [r] = (await sqlPool`
        INSERT INTO fiaon_social_posts (extern_id, titel, format, marke, welt, kanaele, plan_datum, plan_zeit, plan_zeitpunkt, status, caption, ki_noetig, dateien)
        VALUES (${`pruef-e383-${x.id}`}, ${`Titel ${x.id}`}, 'bild', 'fiaon', ${x.welt}, ${["instagram", "facebook"]}, ${plan.toISOString().slice(0, 10)}::date,
                ${new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(plan)}::time, ${plan},
                'zur_freigabe', ${x.caption}, ${!!x.ki}, ${JSON.stringify([datei(Number(x.id.replace(/\D/g, "")) || 9)])}::text::jsonb)
        RETURNING id`) as any[];
      return Number(r.id);
    };
    // A: schon von Hand gepostet (hell, gestern), B: liegen geblieben (dunkel, nach A geplant), C: dunkel in 3 h, D: hell in 6 h,
    // E: hell, vor 30 Min. fällig — käme direkt nach dem hellen A → darf NICHT gepostet werden.
    const A = await neuPost({ id: "a1", welt: "kanzlei", minuten: -24 * 60, caption: "Schon online: der Anfang dieses Textes ist lang genug zum Erkennen.", ki: true });
    const Bp = await neuPost({ id: "b2", welt: "kino", minuten: -20 * 60, caption: "Liegen geblieben: dunkler Beitrag, der noch fehlt im Profil heute." });
    const C = await neuPost({ id: "c3", welt: "buehne", minuten: 180, caption: "Dunkel in drei Stunden, fester Termin, bleibt an seinem Platz." });
    const Dp = await neuPost({ id: "d4", welt: "glas", minuten: 360, caption: "Hell in sechs Stunden, fester Termin, bleibt ebenfalls stehen." });
    const E = await neuPost({ id: "e5", welt: "glas", minuten: -30, caption: "Hell und schon fällig, aber direkt nach einem hellen Post." });
    const log: { pfad: string; methode: string; params: any }[] = [];
    const g: any = async (pfad: string, opt: any = {}) => {
      const methode = opt.methode ?? "GET";
      log.push({ pfad, methode, params: opt.params ?? {} });
      if (pfad === "debug_token") return { data: { is_valid: true, scopes: ["instagram_basic", "instagram_content_publish", "pages_manage_posts"] } };
      if (pfad === "me/accounts") return { data: [{ id: "seite1", name: "FIAON", access_token: "t", instagram_business_account: { id: "ig1", username: "fiaon.ltd" } }] };
      if (pfad === "ig1/media" && methode === "GET") return { data: [{ id: "m-a", caption: "Schon online: der Anfang dieses Textes ist lang genug zum Erkennen. #FIAON", timestamp: new Date(Date.now() - 20 * 3_600_000).toISOString(), permalink: "https://www.instagram.com/p/AAA/", is_ai_generated: true }] };
      if (pfad === "seite1/feed" && methode === "GET") return { data: [] };
      if (methode === "POST") throw new Error(`unerwarteter schreibender Aufruf ${pfad}`);
      throw new Error(`Attrappe kennt ${pfad} nicht`);
    };
    SM._speicherLeeren();
    const e = await SM.metaPostenLauf(new Date(), g);
    const zeile = async (id: number) => ((await sqlPool`SELECT status, plan_zeitpunkt, plattform_ids, veroeffentlicht, checkliste FROM fiaon_social_posts WHERE id = ${id}`) as any[])[0];
    const a = await zeile(A), b = await zeile(Bp), c = await zeile(C), d = await zeile(Dp), ee = await zeile(E);
    ok(a.plattform_ids?.instagram === "m-a" && a.status === "veroeffentlicht" && a.veroeffentlicht?.instagram?.permalink === "https://www.instagram.com/p/AAA/", "von Hand Gepostetes erkannt: Kennung, Freigabe, Meldung mit Link");
    ok(!!a.checkliste?.instagram?.ki_info, "KI-Haken nur, weil Instagram die KI-Info bestätigt");
    ok([b, c, d].every((x) => x.status === "freigegeben"), "alle grünen Posts freigegeben (Justins Auftrag)");
    ok(log.filter((l) => l.methode === "POST").length === 0 && e.gepostet === 0, "kein einziger Post in diesem Lauf (E wäre hell nach hell)");
    ok(ee.plan_zeitpunkt === null, "E (hell nach hell, schon fällig) wartet ohne Uhrzeit");
    ok(new Date(c.plan_zeitpunkt).getTime() > Date.now() + 2.9 * 3_600_000 && new Date(d.plan_zeitpunkt).getTime() > Date.now() + 5.9 * 3_600_000, "feste Termine C und D unverändert");
    ok(new Date(b.plan_zeitpunkt).getTime() < new Date(c.plan_zeitpunkt).getTime() || new Date(b.plan_zeitpunkt).getTime() > new Date(d.plan_zeitpunkt).getTime(), "B (dunkel, liegen geblieben) neu eingeplant");
    const reihe = [{ t: "hell", ms: 0 }, { t: "dunkel", ms: new Date(b.plan_zeitpunkt).getTime() }, { t: "dunkel", ms: new Date(c.plan_zeitpunkt).getTime() }, { t: "hell", ms: new Date(d.plan_zeitpunkt).getTime() }]
      .sort((x, y) => x.ms - y.ms).map((x) => x.t);
    ok(reihe.every((t, i) => i === 0 || t !== reihe[i - 1]), "nach dem hellen A: dunkel, hell, dunkel — der Wechsel hält", reihe.join(","));
    const stand = await SM.metaAutomatikStand(g);
    ok(stand.letzterTon === "hell" && stand.freigabeAuto === true, "Stand fürs Studio: letzter Post hell, Freigabe automatisch an");
    // Zweiter Lauf: nichts mehr zu tun, nichts doppelt.
    const vorher = log.length;
    await SM.metaPostenLauf(new Date(), g);
    ok(log.slice(vorher).every((l) => l.methode === "GET"), "zweiter Lauf: nur lesen, nichts doppelt");
    await sqlPool`DELETE FROM fiaon_social_posts WHERE extern_id LIKE 'pruef-e383-%'`;
    await sqlPool.end();
  }
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden${lokal ? "" : " (offline)"}`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
