// Prüfstand E-380 (15.10.2026): Meta-Automatik — freigegebene Posts zur Planzeit auf Instagram und Facebook,
// utm-Parameter an Website-Anzeigen. KEIN echter Meta-Aufruf: Meta ist hier eine Attrappe (g), die mitschreibt.
// Teil 1 offline (Regeln, Signatur, „genau einmal"), Teil 2 gegen eine LOKALE Test-DB. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e380 node_modules/.bin/tsx scripts/pruef-e380.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

process.env.META_APP_ID = "1";
process.env.META_APP_SECRET = "pruef-geheimnis";
process.env.META_SYSTEM_TOKEN = "pruef-token";

async function main() {
  const lokal = /127\.0\.0\.1:54329\//.test(String(process.env.DATABASE_URL));
  const R = await import("../shared/fiaon-social-meta");

  console.log("── 1 · Regeln (rein)");
  ok(R.rechteAusScopes(["instagram_basic", "instagram_content_publish"]).instagram && !R.rechteAusScopes(["instagram_basic"]).instagram, "Instagram nur mit beiden Rechten");
  ok(R.rechteAusScopes(["pages_manage_posts"]).facebook && !R.rechteAusScopes(["pages_read_engagement"]).facebook, "Facebook nur mit pages_manage_posts");
  const T = Date.parse("2026-10-20T10:00:00Z");
  ok(R.istFaellig(T - 60_000, T, T - 3_600_000), "eine Minute alt, nach dem Einschalten → fällig");
  ok(!R.istFaellig(T + 60_000, T, T - 3_600_000), "Planzeit in der Zukunft → nicht fällig");
  ok(!R.istFaellig(T - 3 * 3_600_000, T, T - 10 * 3_600_000), "drei Stunden alt → nie nachgeholt");
  ok(!R.istFaellig(T - 30 * 60_000, T, T - 10 * 60_000), "vor dem Einschalten geplant → nie nachgeholt");
  ok(!R.istFaellig(T - 60_000, T, null), "nie eingeschaltet → nichts fällig");
  const alle = { instagram: true, facebook: true, kommentare: false };
  const basis = { status: "freigegeben", format: "bild", kanaele: ["instagram", "facebook", "linkedin_firma"], ki_noetig: false, veroeffentlicht: {}, plattform_ids: {} };
  ok(R.autoKanaele(basis, alle).join(",") === "instagram,facebook", "Bild, freigegeben → Instagram und Facebook (LinkedIn nicht)");
  ok(R.autoKanaele({ ...basis, ki_noetig: true }, alle).join(",") === "instagram,facebook", "KI-Post → Instagram (KI-Info) und Facebook (Satz am Ende)");
  ok(R.captionFuerMeta("Text #FIAON", "facebook").endsWith(`#FIAON\n\n${R.FB_KI_SATZ}`), "Facebook: Justins Satz steht am Ende");
  ok(R.captionFuerMeta("Text #FIAON", "instagram") === "Text #FIAON", "Instagram: Text unverändert");
  ok(R.captionFuerMeta("x".repeat(3000), "facebook").length === 2200 && R.captionFuerMeta("x".repeat(3000), "facebook").endsWith(R.FB_KI_SATZ), "Facebook zu lang: der Text wird gekürzt, nie der Satz");
  ok(R.autoKanaele({ ...basis, status: "zur_freigabe" }, alle).length === 0, "nicht freigegeben → nichts");
  ok(R.autoKanaele({ ...basis, format: "story" }, alle).length === 0, "Story → nur von Hand");
  ok(R.autoKanaele({ ...basis, veroeffentlicht: { instagram: { permalink: "x" } } }, alle).join(",") === "facebook", "schon auf Instagram gemeldet → nur noch Facebook");
  ok(R.autoKanaele(basis, { instagram: false, facebook: false, kommentare: false }).length === 0, "ohne Rechte → nichts");
  const d = (id: number, pos: number, rolle: string, mime = "image/jpeg") => ({ datei_id: id, pos, rolle, mime });
  const mk = R.medienPlan("karussell", [d(3, 2, "bild"), d(1, 0, "bild"), d(2, 1, "bild")]) as any;
  ok(mk.art === "karussell" && mk.bilder.map((x: any) => x.datei_id).join(",") === "1,2,3", "Karussell in Upload-Reihenfolge");
  ok("fehler" in (R.medienPlan("karussell", [d(1, 0, "bild")]) as any), "Karussell mit einem Bild → Fehler statt Post");
  ok("fehler" in (R.medienPlan("karussell", Array.from({ length: 11 }, (_, i) => d(i + 1, i, "bild"))) as any), "Karussell mit elf Bildern → Fehler");
  ok("fehler" in (R.medienPlan("bild", [d(1, 0, "bild", "image/png")]) as any), "PNG → Fehler (Instagram nimmt JPEG)");
  const mr = R.medienPlan("reel", [d(5, 0, "video", "video/mp4"), d(6, 1, "cover")]) as any;
  ok(mr.art === "reel" && mr.video.datei_id === 5 && mr.cover.datei_id === 6, "Reel: Video + Titelbild");
  ok(R.captionFuerMeta("a".repeat(3000)).length === 2200, "Bildunterschrift höchstens 2.200 Zeichen");

  console.log("── 2 · Anzeigen-Parameter (rein)");
  const jetzt = Date.parse("2026-10-20T10:00:00Z");
  const web = { id: "1", effective_status: "ACTIVE", adset: { effective_status: "ACTIVE", end_time: null, destination_type: "WEBSITE" }, creative: { id: "c1", url_tags: null, object_story_id: "p_1" } };
  ok(R.utmSperre(web, jetzt) === null, "laufende Website-Anzeige ohne Parameter → bekommt sie");
  ok(R.utmSperre({ ...web, creative: { ...web.creative, url_tags: "utm_source=facebook&utm_campaign={{campaign.id}}" } }, jetzt) !== null, "hat schon Parameter → bleibt");
  ok(R.utmSperre({ ...web, adset: { ...web.adset, destination_type: "ON_AD" } }, jetzt) !== null, "Lead-Formular → bleibt");
  ok(R.utmSperre({ ...web, adset: { ...web.adset, destination_type: "INSTAGRAM_PROFILE" } }, jetzt) !== null, "Profilbesuch → bleibt");
  ok(R.utmSperre({ ...web, adset: { ...web.adset, end_time: "2026-10-09T00:00:00Z" } }, jetzt) !== null, "Anzeigengruppe beendet → bleibt");
  ok(R.utmSperre({ ...web, effective_status: "PAUSED" }, jetzt) !== null, "pausiert → bleibt");
  const undef = { ...web, adset: { ...web.adset, destination_type: "UNDEFINED" }, creative: { id: "c2", url_tags: null, object_story_spec: { page_id: "1", link_data: { link: "https://fiaon.com/" } } } };
  ok(R.utmSperre(undef, jetzt) === null, "ohne Ziel, Link auf fiaon.com → bekommt sie");
  ok(R.utmSperre({ ...undef, creative: { ...undef.creative, object_story_spec: { link_data: { link: "https://example.com/" } } } }, jetzt) !== null, "Link auf fremde Seite → bleibt");
  ok(R.utmSperre({ ...undef, creative: { ...undef.creative, object_story_spec: { link_data: { link: "https://fiaon.com/", call_to_action: { value: { lead_gen_form_id: "9" } } } } } }, jetzt) !== null, "Lead-Formular im Inhalt → bleibt");
  const f1 = R.fassungMitTags({ id: "c1", object_story_id: "p_1", instagram_user_id: "ig", asset_feed_spec: { message_extensions: [{ type: "whatsapp" }] }, contextual_multi_ads: { enroll_status: "OPT_IN" } }, "Anzeige");
  ok(f1.object_story_id === "p_1" && f1.url_tags === R.UTM_TAGS && JSON.parse(f1.asset_feed_spec).message_extensions && !f1.object_story_spec, "Beitrags-Anzeige: derselbe Beitrag + Parameter");
  const f2 = R.fassungMitTags(undef.creative as any, "Anzeige");
  ok(JSON.parse(f2.object_story_spec).link_data.link === "https://fiaon.com/" && f2.url_tags.includes("utm_id={{campaign.id}}"), "Inhalts-Anzeige: derselbe Inhalt + Parameter (utm_id für die Kostenzuordnung)");

  console.log("── 3 · Signierte Medien und „genau einmal“");
  const SM = await import("../server/lib/fiaon-social-meta");
  const url = new URL(SM.medienUrl(42, jetzt));
  ok(SM.medienSignaturPruefen(42, url.searchParams.get("bis"), url.searchParams.get("sig"), jetzt), "eigene Signatur gilt");
  ok(!SM.medienSignaturPruefen(43, url.searchParams.get("bis"), url.searchParams.get("sig"), jetzt), "andere Datei → ungültig");
  ok(!SM.medienSignaturPruefen(42, url.searchParams.get("bis"), url.searchParams.get("sig"), jetzt + 4 * 3_600_000), "nach drei Stunden → ungültig");
  ok(!SM.medienSignaturPruefen(42, url.searchParams.get("bis"), "0".repeat(40), jetzt), "falsche Signatur → ungültig");
  const M = await import("../server/lib/fiaon-meta");
  const echtFetch = globalThis.fetch;
  let aufrufe = 0;
  (globalThis as any).fetch = async () => { aufrufe++; return new Response(JSON.stringify({ error: { message: "kaputt", code: 1 } }), { status: 500 }); };
  try { await M.graph("x/media_publish", { methode: "POST", einmal: true, params: { creation_id: "1" } }); } catch { /* erwartet */ }
  ok(aufrufe === 1, "einmal: true → genau EIN Aufruf, keine Wiederholung", `Aufrufe ${aufrufe}`);
  aufrufe = 0;
  try { await M.graph("x/media", { methode: "POST", params: {} }); } catch { /* erwartet */ }
  ok(aufrufe === 3, "ohne einmal → wie bisher drei Versuche", `Aufrufe ${aufrufe}`);
  (globalThis as any).fetch = echtFetch;

  if (!lokal) { console.log("\n(Teil 4 übersprungen — nur gegen die lokale Test-DB 127.0.0.1:54329)"); }
  else {
    console.log("── 4 · Der Lauf gegen die lokale DB (Meta als Attrappe)");
    const { sqlPool } = await import("../server/lib/db-pool");
    const S = await import("../server/lib/fiaon-social");
    await S.ensureSocialTabellen();
    await SM.ensureMetaAutomatikTabellen();
    await sqlPool`DELETE FROM fiaon_social_meta_auftraege`;
    await sqlPool`DELETE FROM fiaon_settings WHERE key IN ('social_auto_posten', 'social_auto_aktiv_seit', 'social_auto_ki_stopp')`;
    await sqlPool`DELETE FROM fiaon_social_posts WHERE extern_id LIKE 'pruef-e380-%'`;

    // Die Attrappe: merkt sich jeden Aufruf; Verhalten je Szenario umschaltbar.
    let scopes: string[] = [];
    const log: { pfad: string; methode: string; params: any; einmal: boolean }[] = [];
    let containerStatus = "FINISHED";
    let publishFehler: "keiner" | "netz" | "abgelehnt" = "keiner";
    let n = 1000;
    const veroeffentlichtIg: { id: string; caption: string; timestamp: string }[] = [];
    const g: any = async (pfad: string, opt: any = {}) => {
      const methode = opt.methode ?? "GET";
      log.push({ pfad, methode, params: opt.params ?? {}, einmal: !!opt.einmal });
      if (pfad === "debug_token") return { data: { is_valid: true, scopes } };
      if (pfad === "me/accounts") return { data: [{ id: "seite1", name: "FIAON", access_token: "seiten-token", instagram_business_account: { id: "ig1", username: "fiaon.ltd" } }] };
      if (pfad === "ig1/media" && methode === "POST") return { id: `c${n++}` };
      if (pfad === "ig1/media" && methode === "GET") return { data: veroeffentlichtIg.map((m) => ({ ...m, permalink: `https://www.instagram.com/p/${m.id}/` })) };
      if (pfad === "ig1/media_publish") {
        if (publishFehler === "netz") { veroeffentlichtIg.push({ id: `m${n}`, caption: "VERLOREN", timestamp: new Date().toISOString() }); const { MetaFehler } = M; throw new MetaFehler("Meta nicht erreichbar", null, 0); }
        if (publishFehler === "abgelehnt") { const { MetaFehler } = M; throw new MetaFehler("Media ID is not available", 9007, 400); }
        const id = `m${n++}`;
        veroeffentlichtIg.push({ id, caption: "", timestamp: new Date().toISOString() });
        return { id };
      }
      if (/^c\d+$/.test(pfad)) return { status_code: containerStatus };
      if (/^m\d+$/.test(pfad)) return { permalink: `https://www.instagram.com/p/${pfad}/`, is_ai_generated: opt.params?.fields?.includes("is_ai_generated") ? true : undefined };
      if (pfad === "seite1/photos") return { id: `f${n++}`, post_id: `seite1_${n++}` };
      if (pfad === "seite1/feed" && methode === "POST") return { id: `seite1_${n++}` };
      if (pfad === "seite1/feed" && methode === "GET") return { data: [] }; // E-383: Abgleich liest das Profil
      if (pfad === "seite1/videos") return { id: `v${n++}` };
      if (/^seite1_\d+$|^v\d+$/.test(pfad)) return { permalink_url: `https://www.facebook.com/FIAON/posts/${pfad}` };
      throw new Error(`Attrappe kennt ${methode} ${pfad} nicht`);
    };
    const neuPost = async (x: { id: string; format: string; kanaele: string[]; ki?: boolean; planMinAlt: number; dateien: any[]; status?: string }) => {
      const plan = new Date(Date.now() - x.planMinAlt * 60_000);
      const [r] = (await sqlPool`
        INSERT INTO fiaon_social_posts (extern_id, titel, format, marke, kanaele, plan_datum, plan_zeitpunkt, status, caption, ki_noetig, dateien)
        VALUES (${`pruef-e380-${x.id}`}, ${`Prüfpost ${x.id}`}, ${x.format}, 'fiaon', ${x.kanaele}, ${plan.toISOString().slice(0, 10)}::date, ${plan}, ${x.status ?? "freigegeben"},
                ${`Prüftext ${x.id} #FIAON`}, ${!!x.ki}, ${JSON.stringify(x.dateien)}::text::jsonb)
        RETURNING id`) as any[];
      return Number(r.id);
    };
    const datei = (id: number, pos: number, rolle: string, mime = "image/jpeg") => ({ datei_id: id, pos, rolle, mime, dateiname: `d${id}`, sha256: "0".repeat(64), bytes: 1, breite: 1080, hoehe: 1350, sekunden: null });
    const post = async (id: number) => ((await sqlPool`SELECT status, veroeffentlicht, checkliste FROM fiaon_social_posts WHERE id = ${id}`) as any[])[0];
    const zaehle = (re: RegExp) => log.filter((l) => re.test(l.pfad) && l.methode === "POST").length;

    SM._speicherLeeren();
    const alt = await neuPost({ id: "alt", format: "bild", kanaele: ["instagram", "facebook"], planMinAlt: 60 * 24, dateien: [datei(1, 0, "bild")] });
    let e = await SM.metaPostenLauf(new Date(), g);
    ok(e.zustand === "keine_rechte" && log.filter((l) => l.methode === "POST").length === 0, "ohne Posting-Rechte → nichts, kein einziger schreibender Aufruf");

    scopes = ["instagram_basic", "instagram_content_publish", "pages_manage_posts"];
    SM._speicherLeeren();
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.zustand === "gelaufen" && e.gepostet === 0 && zaehle(/media_publish/) === 0, "erster Lauf mit Rechten: der Launch-Rückstand (gestern geplant) geht NICHT raus");
    // Einschaltzeit zehn Minuten zurück, damit „vor fünf Minuten geplant" fällig ist.
    await sqlPool`UPDATE fiaon_settings SET value = ${new Date(Date.now() - 10 * 60_000).toISOString()} WHERE key = 'social_auto_aktiv_seit'`;
    const a = await neuPost({ id: "bild", format: "bild", kanaele: ["instagram", "facebook", "linkedin_firma"], planMinAlt: 5, dateien: [datei(11, 0, "bild")] });
    e = await SM.metaPostenLauf(new Date(), g);
    let pa = await post(a);
    ok(e.gepostet === 2 && zaehle(/^ig1\/media_publish$/) === 1 && zaehle(/^seite1\/photos$/) === 1, "Bild: genau ein Instagram- und ein Facebook-Beitrag", JSON.stringify(e));
    ok(String(log.find((l) => l.pfad === "seite1/photos")?.params?.caption ?? "").endsWith(R.FB_KI_SATZ), "auch ein Post ohne KI-Bild trägt auf Facebook den Satz am Ende (Justins Wortlaut: jeder Beitrag)");
    ok(!String(log.find((l) => l.pfad === "ig1/media" && l.methode === "POST")?.params?.caption ?? "").includes(R.FB_KI_SATZ), "…auf Instagram nicht (dort die KI-Info von Meta)");
    ok(pa.status === "veroeffentlicht" && pa.veroeffentlicht?.instagram?.permalink?.includes("instagram.com") && pa.veroeffentlicht?.facebook?.permalink?.includes("facebook.com"), "im Studio als veröffentlicht gemeldet, mit beiden Links");
    ok(log.filter((l) => /media_publish|seite1\/photos/.test(l.pfad) && l.methode === "POST").every((l) => l.einmal), "Veröffentlichen immer mit einmal: true");
    const bildUrl = String(log.find((l) => l.pfad === "ig1/media" && l.methode === "POST")?.params?.image_url ?? "");
    ok(/\/api\/fiaon\/social\/meta-datei\/11\?bis=\d+&sig=[0-9a-f]{40}$/.test(bildUrl), "Meta holt das Bild über die signierte Adresse");
    const vorher = zaehle(/media_publish|seite1\/(photos|feed|videos)/);
    await SM.metaPostenLauf(new Date(), g);
    ok(zaehle(/media_publish|seite1\/(photos|feed|videos)/) === vorher, "zweiter Lauf: nichts doppelt");
    ok(((await post(alt)).status) === "freigegeben", "der alte Launch-Post bleibt unangetastet");

    const k = await neuPost({ id: "ki", format: "karussell", kanaele: ["instagram", "facebook"], ki: true, planMinAlt: 3, dateien: [datei(21, 0, "bild"), datei(22, 1, "bild")] });
    log.length = 0;
    await SM.metaPostenLauf(new Date(), g);
    const kinder = log.filter((l) => l.pfad === "ig1/media" && l.params.is_carousel_item === "true");
    const rahmen = log.find((l) => l.pfad === "ig1/media" && l.params.media_type === "CAROUSEL");
    ok(kinder.length === 2 && kinder.every((c) => !c.params.is_ai_generated), "Karussell: zwei Kinder ohne KI-Feld");
    let pk = await post(k);
    if (!rahmen) { await SM.metaPostenLauf(new Date(), g); pk = await post(k); }
    const rahmen2 = log.find((l) => l.pfad === "ig1/media" && l.params.media_type === "CAROUSEL");
    ok(rahmen2?.params?.is_ai_generated === "true", "KI-Karussell: KI-Info am Karussell-Container");
    const fbKi = log.find((l) => l.pfad === "seite1/feed" && l.methode === "POST");
    ok(pk.veroeffentlicht?.instagram && pk.veroeffentlicht?.facebook && String(fbKi?.params?.message ?? "").endsWith(R.FB_KI_SATZ), "KI-Post: Instagram und Facebook — dort mit Justins Satz am Ende");
    ok(!!pk.checkliste?.facebook?.ki_info, "KI-Haken auch für Facebook (durch den Satz)");
    ok(!!pk.checkliste?.instagram?.ki_info, "KI-Haken im Studio gesetzt (von der Automatik)");

    containerStatus = "IN_PROGRESS";
    const r = await neuPost({ id: "reel", format: "reel", kanaele: ["instagram"], planMinAlt: 2, dateien: [datei(31, 0, "video", "video/mp4"), datei(32, 1, "cover")] });
    log.length = 0;
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.wartend === 1 && zaehle(/media_publish/) === 0, "Reel in Verarbeitung → warten, nicht veröffentlichen");
    containerStatus = "FINISHED";
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.gepostet === 1 && zaehle(/media_publish/) === 1 && log.filter((l) => l.params.media_type === "REELS").length === 1, "nächster Lauf: Reel fertig → einmal veröffentlicht, Container nicht neu angelegt");
    ok(!!(await post(r)).veroeffentlicht?.instagram, "Reel im Studio gemeldet");

    publishFehler = "netz";
    const u = await neuPost({ id: "unklar", format: "bild", kanaele: ["instagram"], planMinAlt: 1, dateien: [datei(41, 0, "bild")] });
    log.length = 0;
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.unklar === 1 && zaehle(/media_publish/) === 1, "Antwort verloren → unklar");
    publishFehler = "keiner";
    await SM.metaPostenLauf(new Date(), g);
    await sqlPool`UPDATE fiaon_social_meta_auftraege SET aktualisiert_am = NOW() - INTERVAL '2 hours' WHERE post_id = ${u}`;
    await SM.metaPostenLauf(new Date(), g);
    ok(zaehle(/media_publish/) === 1, "unklar wird NIE automatisch neu gepostet");
    ok(((await post(u)).status) === "freigegeben", "…und nicht als veröffentlicht gemeldet");

    publishFehler = "abgelehnt";
    const f = await neuPost({ id: "abgelehnt", format: "bild", kanaele: ["instagram"], planMinAlt: 1, dateien: [datei(51, 0, "bild")] });
    log.length = 0;
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.fehler === 1, "Meta lehnt ab → Fehler (eindeutig, vor dem Post)");
    publishFehler = "keiner";
    await sqlPool`UPDATE fiaon_social_meta_auftraege SET aktualisiert_am = NOW() - INTERVAL '11 minutes' WHERE post_id = ${f}`;
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.gepostet === 1 && !!(await post(f)).veroeffentlicht?.instagram, "eindeutiger Fehler → nach zehn Minuten neuer Versuch, dann online");

    const p2 = await neuPost({ id: "parallel", format: "bild", kanaele: ["instagram", "facebook"], planMinAlt: 1, dateien: [datei(61, 0, "bild")] });
    log.length = 0;
    await Promise.all([SM.metaPostenLauf(new Date(), g), SM.metaPostenLauf(new Date(), g), SM.metaPostenLauf(new Date(), g)]);
    ok(zaehle(/media_publish/) === 1 && zaehle(/^seite1\/photos$/) === 1, "drei Läufe gleichzeitig → trotzdem genau ein Beitrag je Kanal", `IG ${zaehle(/media_publish/)}, FB ${zaehle(/^seite1\/photos$/)}`);
    ok(!!(await post(p2)).veroeffentlicht?.facebook, "…und gemeldet");

    const geaendert = await neuPost({ id: "geaendert", format: "bild", kanaele: ["instagram"], planMinAlt: 1, dateien: [datei(71, 0, "bild")] });
    containerStatus = "IN_PROGRESS";
    await SM.metaPostenLauf(new Date(), g);
    await sqlPool`UPDATE fiaon_social_posts SET status = 'zur_freigabe', fassung = fassung + 1 WHERE id = ${geaendert}`;
    containerStatus = "FINISHED";
    // E-383: Mit Auto-Freigabe AUS bleibt die geänderte Fassung beim Menschen — der alte Container geht nie raus.
    await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('social_auto_freigabe', 'aus', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'aus'`;
    log.length = 0;
    await SM.metaPostenLauf(new Date(), g);
    ok(zaehle(/media_publish/) === 0, "Post während der Verarbeitung geändert (Freigabe von Hand) → nicht veröffentlicht");
    // Mit Auto-Freigabe AN (Justin 16.10.) wird die NEUE Fassung freigegeben und genau einmal gepostet — nie die alte.
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'social_auto_freigabe'`;
    log.length = 0;
    await SM.metaPostenLauf(new Date(), g);
    await SM.metaPostenLauf(new Date(), g);
    const auftraegeG = (await sqlPool`SELECT fassung, zustand FROM fiaon_social_meta_auftraege WHERE post_id = ${geaendert} ORDER BY id`) as any[];
    ok(zaehle(/media_publish/) === 1 && auftraegeG.filter((x: any) => x.zustand === "ok").length === 1, "mit Auto-Freigabe: neue Fassung freigegeben und genau EINMAL gepostet", JSON.stringify(auftraegeG));

    await SM.postenSchalten(false);
    const aus = await neuPost({ id: "aus", format: "bild", kanaele: ["instagram"], planMinAlt: 1, dateien: [datei(81, 0, "bild")] });
    e = await SM.metaPostenLauf(new Date(), g);
    ok(e.zustand === "aus", "Not-Aus → der Lauf tut nichts");
    await SM.postenSchalten(true);
    e = await SM.metaPostenLauf(new Date(), g);
    ok(!(await post(aus)).veroeffentlicht?.instagram, "wieder an → was in der Aus-Zeit fällig war, wird NICHT nachgeholt");
    const stand = await SM.metaAutomatikStand(g);
    ok(stand.postenAn && stand.rechte.instagram && stand.heuteGepostet >= 5, "Stand fürs Studio: an, Rechte, heute gepostet", JSON.stringify({ an: stand.postenAn, heute: stand.heuteGepostet }));

    console.log("── 5 · Anzeigen-Parameter gegen die lokale DB");
    const U = await import("../server/lib/fiaon-meta-utm");
    await sqlPool`DELETE FROM fiaon_meta_utm_protokoll`;
    process.env.META_WERBEKONTO = "act_1234567";
    const ulog: { pfad: string; params: any }[] = [];
    const anzeigen = [
      { id: "a1", name: "Website", effective_status: "ACTIVE", adset: { effective_status: "ACTIVE", end_time: null, destination_type: "WEBSITE" }, creative: { id: "k1", object_story_id: "p_1" } },
      { id: "a2", name: "Lead", effective_status: "ACTIVE", adset: { effective_status: "ACTIVE", destination_type: "ON_AD" }, creative: { id: "k2", object_story_id: "p_2" } },
      { id: "a3", name: "Getaggt", effective_status: "ACTIVE", adset: { effective_status: "ACTIVE", destination_type: "WEBSITE" }, creative: { id: "k3", object_story_id: "p_3", url_tags: "utm_campaign=x" } },
    ];
    const ug: any = async (pfad: string, opt: any = {}) => { ulog.push({ pfad, params: opt.params ?? {} }); if (pfad.endsWith("/adcreatives")) return { id: "neu1" }; return { success: true }; };
    const ualle: any = async () => anzeigen;
    let ue = await U.utmLauf(new Date(), ug, ualle);
    ok(ue.geaendert === 1 && ulog.filter((l) => l.pfad.endsWith("/adcreatives")).length === 1, "nur die Website-Anzeige ohne Parameter bekommt eine neue Fassung");
    ok(ulog.some((l) => l.pfad === "a1" && JSON.parse(l.params.creative).creative_id === "neu1"), "…und wird auf die neue Fassung umgestellt");
    ue = await U.utmLauf(new Date(), ug, ualle);
    ok(ue.geaendert === 0, "zweiter Lauf: jede Anzeige nur einmal");
    await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('meta_utm_automatik', 'aus', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'aus'`;
    ue = await U.utmLauf(new Date(), ug, ualle);
    ok(ue.zustand === "aus", "Not-Aus meta_utm_automatik = aus");
    await sqlPool`DELETE FROM fiaon_settings WHERE key = 'meta_utm_automatik'`;
    await sqlPool`DELETE FROM fiaon_social_posts WHERE extern_id LIKE 'pruef-e380-%'`;
    await sqlPool.end();
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden${lokal ? "" : " (offline)"}`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
