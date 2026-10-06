// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO — Tabellen, Abfragen, Import und Aktionen (06.10.2026, E-294)
//
// Die Regeln (Status, Kanäle, Checklisten, Wort-Check, Manifest) stehen in
// shared/fiaon-social.ts — hier nur, was die Datenbank braucht. Die Routen
// (server/routes/fiaon-social.ts) sind dünn und rufen diese Funktionen.
//
// Leitplanken:
//   • Import idempotent über extern_id + Import-Prüfsumme (Manifest ohne Status
//     und Plan, Caption, Alt-Text, [pos, rolle, sha256]). Verglichen wird IMMER
//     mit dem letzten IMPORT, nie mit dem aktuellen Inhalt — sonst überschreibt
//     jeder erneute Lauf von social-sync.ts Justins Arbeit im Studio.
//   • Ein geänderter Inhalt wird NIE still überschrieben: neue Fassung, alter
//     Stand als Schnappschuss im Verlauf, Status zurück auf „zur_freigabe".
//   • Der Token-Import setzt nie „freigegeben" — der Status aus dem Manifest ist
//     nur eine Selbstauskunft (11 Launch-Manifeste sagen „freigegeben").
//   • Jede Studio-Aktion prüft `version` (Optimistic Locking, 409) und schreibt
//     eine Zeile in fiaon_social_verlauf. Der Wort-Check wird bei „Freigeben"
//     frisch gerechnet, nie aus der Datenbank übernommen.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "crypto";
import fs, { readFileSync } from "fs";
import path from "path";
import { sqlPool } from "./db-pool";
import { berlinToday, berlinPlusTage, berlinZeitpunkt } from "./fiaon-time";
import {
  SOCIAL_REGELSTAND, SOCIAL_STATUS, GRUND_MIN, KANAL_INFO, KI_PUNKT,
  socialWortcheck, ausnahmenAusManifest, checklisteSoll, offenePflichtpunkte, zeichenStaende,
  erlaubteAktionen, darfUebergang, istSocialStatus, istSocialKanal, istPlanDatum, istPlanZeit,
  importKanon, planHinweise, planSortierung, permalinkPruefen, rasterSymbol, rasterZuschnitt,
  studioUrl, wortTrefferZahl, istAusnahmeSchluessel, SOCIAL_VERSCHIEBBAR, SOCIAL_STATUS_INFO,
  istWebsiteSchalterStatus, websiteStand, feedBildEintraege, WEB_480_MAX_BREITE, WEB_480_MAX_BYTES, IMPORT_MAX_DATEIEN,
  type FeedDateiEintrag, type SocialManifest, type SocialStatus, type SocialKanal, type SocialFormat, type SocialMarke, type SocialRolle,
  type SocialWortcheck, type SocialCheckliste, type SocialPostKarte, type SocialPostDetail, type SocialDatei,
  type SocialIch, type SocialAktion, type SocialImportAntwort, type SocialFehlerCode, type SocialWortFeld,
  type SocialRasterKachel, type SocialInstagramAntwort, type SocialPlanAntwort, type SocialVeroeffentlichung,
} from "@shared/fiaon-social";
import { SOZIALE_PROFILE } from "@shared/fiaon-sozial";
import {
  dateiSchreiben, dateiTypAusBytes, rolleTypFehler, metaHinweise, sha256Hex, vorhandeneShas, speicherBytes,
  dateiUrl, dateiDownloadUrl, downloadName, webVarianten, type DateiAnalyse,
} from "./fiaon-social-dateien";

// ── Tabellen ───────────────────────────────────────────────────────────────
// Die Migration 094 läuft beim Start (npm start → db:migrate:sql). Fehlt sie
// trotzdem (lokaler Prüfstand, Neustart ohne Lauf), führt der Wächter GENAU
// dieselbe Datei aus — eine Definition, ein Ort. Neue Tabellen sperren keine
// bestehenden; trotzdem mit kurzem lock_timeout (DDL-Wache-Muster, E-254).
let bereit: Promise<void> | null = null;
export function ensureSocialTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const r = (await sqlPool`
        SELECT to_regclass('public.fiaon_social_posts') AS p, to_regclass('public.fiaon_social_dateien') AS d,
               to_regclass('public.fiaon_social_verlauf') AS v, to_regclass('public.fiaon_social_profile') AS pr,
               to_regclass('public.fiaon_social_follower') AS f`) as any[];
      if (r[0]?.p && r[0]?.d && r[0]?.v && r[0]?.pr && r[0]?.f) return;
      const datei = path.resolve(process.cwd(), "db", "migrations", "094_social_studio.sql");
      const text = readFileSync(datei, "utf8");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(text);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Fehler als Wert ────────────────────────────────────────────────────────
export class SocialFehlerWurf extends Error {
  constructor(public status: number, text: string, public code?: SocialFehlerCode, public extra: Record<string, unknown> = {}) { super(text); }
}
const wurf = (status: number, text: string, code?: SocialFehlerCode, extra: Record<string, unknown> = {}) => new SocialFehlerWurf(status, text, code, extra);

// ── Wer handelt ────────────────────────────────────────────────────────────
export interface SocialHandelnder { von: string; name: string; agentId: number | null; stufe: SocialIch["stufe"] | "import" }

export async function ichLaden(chef: { agentId: number | null; stufe: SocialIch["stufe"] } | undefined): Promise<SocialIch> {
  // E-294 (Prüfung 06.10.2026): ohne Chef-Sitzung GESPERRT, nie „inhaber" annehmen —
  // hängt ichLaden je an einer Route ohne requireChef, bekäme sonst jeder darfTrotzdem.
  if (!chef || !chef.stufe) throw wurf(401, "Bitte im Chefbüro anmelden.", "UNGUELTIG");
  let name = chef.agentId ? `Chef #${chef.agentId}` : "Inhaber";
  if (chef.agentId) {
    try {
      const r = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${chef.agentId}`) as any[];
      if (r[0]?.name) name = String(r[0].name);
    } catch { /* Anzeige-Zucker */ }
  }
  const stufe = chef.stufe;
  return { stufe, agentId: chef.agentId ?? null, name, darfTrotzdem: stufe === "inhaber" };
}
export const handelnderAus = (ich: SocialIch): SocialHandelnder => ({ von: ich.agentId ? `chef:${ich.agentId}` : "inhaber", name: ich.name, agentId: ich.agentId, stufe: ich.stufe });

// ── Zeilen → API ───────────────────────────────────────────────────────────
interface PostDatei { datei_id: number; pos: number; rolle: SocialRolle; dateiname: string; sha256: string; sekunden: number | null; mime: string; bytes: number; breite: number | null; hoehe: number | null }

const POST_SPALTEN = `p.*, p.plan_datum::text AS pd, to_char(p.plan_zeit, 'HH24:MI') AS pz`;
const iso = (d: any) => (d ? new Date(d).toISOString() : null);
const arr = (x: any): string[] => (Array.isArray(x) ? x.map(String) : []);

function vorschauAus(dateien: PostDatei[]): SocialPostKarte["vorschau"] {
  const d = dateien.find((x) => x.rolle === "cover") ?? dateien.find((x) => x.rolle === "bild" || x.rolle === "story");
  return d ? { datei_id: d.datei_id, url: dateiUrl(d.datei_id), breite: d.breite, hoehe: d.hoehe } : null;
}

function karteAus(r: any, heute: string = berlinToday()): SocialPostKarte {
  const dateien = (Array.isArray(r.dateien) ? r.dateien : []) as PostDatei[];
  const wc = r.wortcheck as SocialWortcheck | null;
  const veroeff = (r.veroeffentlicht ?? {}) as Record<string, unknown>;
  // E-296: dieselbe Regel wie der Website-Feed (shared/fiaon-social.ts §9) — mit Instagram-Meldung und dem
  // Wort-Check nach den aktuellen Regeln (gespeichert, wenn der Regelstand passt; sonst nur bei Schalter an frisch).
  const rot = wc && wc.regelstand === SOCIAL_REGELSTAND ? wc.ergebnis === "rot" : !!r.website_sichtbar && wortcheckFuer(r).ergebnis === "rot";
  const web = websiteStand({
    website_sichtbar: !!r.website_sichtbar, status: r.status, plan_datum: r.pd, format: r.format, dateien: dateien as FeedDateiEintrag[],
    wortcheck_rot: rot, kanaele: arr(r.kanaele), gemeldet: Object.keys(veroeff),
  }, heute);
  return {
    id: Number(r.id), extern_id: r.extern_id, version: Number(r.version), fassung: Number(r.fassung),
    titel: r.titel, serie: r.serie ?? null, format: r.format, marke: r.marke, kanaele: arr(r.kanaele).filter(istSocialKanal) as SocialKanal[],
    themen: arr(r.themen), plan_datum: r.pd, plan_zeit: r.pz ?? null, plan_zeitpunkt: iso(r.plan_zeitpunkt),
    reihenfolge: r.reihenfolge == null ? null : Number(r.reihenfolge), status: r.status, ki_noetig: !!r.ki_noetig,
    wortcheck_ergebnis: wc?.ergebnis ?? null, wort_treffer: wortTrefferZahl(wc),
    vorschau: vorschauAus(dateien), dateien_anzahl: dateien.length,
    veroeffentlicht_kanaele: Object.keys(veroeff).filter(istSocialKanal) as SocialKanal[],
    website_sichtbar: web.sichtbar, website_jetzt: web.jetzt,
  };
}

/** Der Wort-Check aus den gespeicherten Feldern eines Posts (frisch gerechnet). */
function wortcheckFuer(r: any): SocialWortcheck {
  return socialWortcheck({
    marke: r.marke, titel: r.titel, caption: r.caption, erster_kommentar: r.erster_kommentar, alt_text: r.alt_text,
    hashtags: arr(r.hashtags), bildtexte: Array.isArray(r.bildtexte) ? r.bildtexte.map(String) : [],
    ausnahmen: arr(r.ausnahmen), ausnahmen_unbekannt: arr(r.ausnahmen_unbekannt), manifest: r.wortcheck_manifest ?? null,
  });
}

function sperrenFuer(r: any, wc: SocialWortcheck, ich: SocialIch): Partial<Record<SocialAktion, string>> {
  const s: Partial<Record<SocialAktion, string>> = {};
  if (wc.ergebnis === "rot") {
    const stellen = wc.felder.filter((f) => f.treffer.length).map((f) => f.titel).join(", ");
    s.freigeben = ich.darfTrotzdem
      ? `Wort-Check rot (${stellen}). Freigeben nur mit „Trotzdem freigeben“ und Grund.`
      : `Wort-Check rot (${stellen}). Freigeben kann nur der Inhaber — mit Grund.`;
  }
  if (r.ki_noetig) {
    const soll = checklisteSoll({ format: r.format, ki_noetig: true, link: r.link, kanaele: arr(r.kanaele) });
    const offen = (arr(r.kanaele).filter(istSocialKanal) as SocialKanal[]).filter((k) => offenePflichtpunkte(soll, r.checkliste ?? {}, k).length);
    if (offen.length) s.veroeffentlicht = `KI-Haken fehlt noch bei: ${offen.map((k) => KANAL_INFO[k].titel).join(", ")}. Erst abhaken, dann melden.`;
  }
  return s;
}

async function detailAus(r: any, ich: SocialIch): Promise<SocialPostDetail> {
  const karte = karteAus(r);
  const dateien = (Array.isArray(r.dateien) ? r.dateien : []) as PostDatei[];
  const bilder = dateien.filter((d) => d.rolle === "bild").length;
  let wc = r.wortcheck as SocialWortcheck | null;
  if (!wc || wc.regelstand !== SOCIAL_REGELSTAND) {
    // Regeln haben sich geändert (oder noch nie geprüft): neu rechnen und still ablegen — keine neue version.
    wc = wortcheckFuer(r);
    // SKIP LOCKED: hält ein Import gerade die Zeile, wartet das reine Ansehen nicht — dann eben beim nächsten Mal.
    try {
      await sqlPool`UPDATE fiaon_social_posts SET wortcheck = ${sqlPool.json(wc as any)}
                     WHERE id = (SELECT id FROM fiaon_social_posts WHERE id = ${r.id} FOR UPDATE SKIP LOCKED)`;
    } catch { /* Anzeige bleibt richtig */ }
  }
  const verlauf = (await sqlPool`
    SELECT id, art, von, fassung, grund, am, vorher, nachher FROM fiaon_social_verlauf
     WHERE post_id = ${r.id} ORDER BY am DESC, id DESC LIMIT 50`) as any[];
  // E-296: kleine Web-Bilder (480 px) je Bild/Titelbild — das Studio legt fehlende an.
  const web = await webVarianten(dateien.filter((d) => d.rolle === "bild" || d.rolle === "cover").map((d) => Number(d.datei_id)));
  const sd: SocialDatei[] = dateien.map((d) => ({
    id: d.datei_id, pos: d.pos, rolle: d.rolle, dateiname: d.dateiname, mime: d.mime, bytes: d.bytes,
    breite: d.breite, hoehe: d.hoehe, sekunden: d.sekunden, sha256: d.sha256,
    url: dateiUrl(d.datei_id), download_url: dateiDownloadUrl(d.datei_id),
    download_name: downloadName(r.extern_id, d.pos, d.rolle, d.mime, bilder),
    web_480: (() => { const w = web.get(Number(d.datei_id)); return w ? { id: w.id, breite: w.breite, hoehe: w.hoehe } : null; })(),
  }));
  const soll = checklisteSoll({ format: r.format, ki_noetig: !!r.ki_noetig, link: r.link, kanaele: arr(r.kanaele) });
  const meta: string[] = [];
  return {
    ...karte,
    wortcheck_ergebnis: wc.ergebnis, wort_treffer: wortTrefferZahl(wc),
    caption: r.caption ?? "", hashtags: arr(r.hashtags), erster_kommentar: r.erster_kommentar ?? null, alt_text: r.alt_text ?? null,
    bildtexte: Array.isArray(r.bildtexte) ? r.bildtexte.map(String) : [], link: r.link ?? null, welt: r.welt ?? null,
    ki_grund: r.ki_grund ?? null, ausnahmen: arr(r.ausnahmen).filter(istAusnahmeSchluessel),
    wortcheck: wc, checkliste: (r.checkliste ?? {}) as SocialCheckliste, checkliste_soll: soll,
    zeichen: zeichenStaende({ caption: r.caption, erster_kommentar: r.erster_kommentar, kanaele: arr(r.kanaele) }),
    freigabe: r.freigegeben_am ? { von: r.freigegeben_von ?? null, am: iso(r.freigegeben_am), grund: r.freigabe_grund ?? null, trotz_rot: !!r.freigabe_trotz_rot } : null,
    veroeffentlicht: (r.veroeffentlicht ?? {}) as Partial<Record<SocialKanal, SocialVeroeffentlichung>>,
    kennzahlen: (r.kennzahlen ?? {}) as Record<string, unknown>,
    notizen: r.notizen ?? null,
    zurueck_notiz: r.status === "entwurf" ? r.zurueck_notiz ?? null : null,
    im_studio_bearbeitet: !!r.im_studio_bearbeitet,
    dateien: sd,
    zip_url: `/api/fiaon/chef/social/post/${r.id}/zip`,
    verlauf: verlauf.map((v) => ({ id: Number(v.id), art: v.art, von: v.von, fassung: v.fassung == null ? null : Number(v.fassung), grund: v.grund ?? null, am: iso(v.am)!, vorher: v.vorher ?? null, nachher: v.nachher ?? null })),
    erlaubte_aktionen: erlaubteAktionen(r.status),
    sperren: sperrenFuer(r, wc, ich),
    zuletzt_importiert_am: iso(r.zuletzt_importiert_am),
    meta_hinweise: meta,
    website: websiteStand({
      website_sichtbar: !!r.website_sichtbar, status: r.status, plan_datum: r.pd, format: r.format,
      dateien: dateien as FeedDateiEintrag[], wortcheck_rot: wc.ergebnis === "rot", web_480_ids: new Set(Array.from(web.keys())),
      kanaele: arr(r.kanaele), gemeldet: Object.keys((r.veroeffentlicht ?? {}) as Record<string, unknown>),
    }, berlinToday()),
  };
}

// ── Lesen ──────────────────────────────────────────────────────────────────
export async function postLaden(id: number, ich: SocialIch): Promise<SocialPostDetail | null> {
  await ensureSocialTabellen();
  const r = (await sqlPool.unsafe(`SELECT ${POST_SPALTEN} FROM fiaon_social_posts p WHERE p.id = $1`, [id])) as any[];
  return r[0] ? detailAus(r[0], ich) : null;
}

/** Datei-Ids, die zu einem Post gehören (für die ZIP-Reihenfolge). */
export async function postDateienFuerZip(id: number): Promise<{ extern_id: string; dateien: PostDatei[] } | null> {
  await ensureSocialTabellen();
  const r = (await sqlPool`SELECT extern_id, dateien FROM fiaon_social_posts WHERE id = ${id}`) as any[];
  if (!r[0]) return null;
  return { extern_id: r[0].extern_id, dateien: (Array.isArray(r[0].dateien) ? r[0].dateien : []) as PostDatei[] };
}

export async function planLaden(vonRoh: unknown, bisRoh: unknown, ich: SocialIch): Promise<SocialPlanAntwort> {
  await ensureSocialTabellen();
  const heute = berlinToday();
  const von = istPlanDatum(String(vonRoh ?? "")) ? String(vonRoh) : berlinPlusTage(-7);
  let bis = istPlanDatum(String(bisRoh ?? "")) ? String(bisRoh) : berlinPlusTage(30);
  if (bis < von) throw wurf(400, "„bis“ liegt vor „von“.", "UNGUELTIG");
  const tage = (Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000;
  if (tage > 120) bis = new Date(Date.parse(`${von}T12:00:00Z`) + 120 * 86_400_000).toISOString().slice(0, 10);
  const rows = (await sqlPool.unsafe(
    `SELECT ${POST_SPALTEN} FROM fiaon_social_posts p WHERE p.plan_datum BETWEEN $1::date AND $2::date`, [von, bis])) as any[];
  const posts = rows.map((x) => karteAus(x, heute)).sort(planSortierung);
  const zaehler = await statusZaehler();
  // „Heute zu posten" rechnet unabhängig vom geblätterten Zeitraum (Prüfung 06.10.2026).
  const heuteRows = (await sqlPool.unsafe(
    `SELECT ${POST_SPALTEN} FROM fiaon_social_posts p WHERE p.plan_datum = $1::date AND p.status <> 'verworfen'`, [heute])) as any[];
  const bc = (await sqlPool`
    SELECT id, titel, plan_datum::text AS pd, zurueck_notiz FROM fiaon_social_posts
     WHERE status = 'entwurf' AND zurueck_notiz IS NOT NULL ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 50`) as any[];
  const n = (await sqlPool.unsafe(
    `SELECT ${POST_SPALTEN} FROM fiaon_social_posts p
      WHERE p.status IN ('zur_freigabe','freigegeben','eingeplant','entwurf')
        AND ((p.plan_zeitpunkt IS NOT NULL AND p.plan_zeitpunkt >= NOW()) OR (p.plan_zeitpunkt IS NULL AND p.plan_datum >= $1::date))
      ORDER BY p.plan_datum, p.plan_zeit NULLS FIRST, p.reihenfolge NULLS LAST, p.id LIMIT 1`, [heute])) as any[];
  return {
    ok: true, ich, von, bis, heute, posts,
    heute_posts: heuteRows.map((x) => karteAus(x, heute)).sort(planSortierung),
    bei_claude: bc.map((x) => ({ id: Number(x.id), titel: x.titel, plan_datum: x.pd, notiz: String(x.zurueck_notiz) })),
    hinweise: planHinweise(posts, von, bis, heute),
    zaehler,
    naechster: n[0] ? { id: Number(n[0].id), titel: n[0].titel, plan_zeitpunkt: iso(n[0].plan_zeitpunkt), plan_datum: n[0].pd, status: n[0].status } : null,
    speicher_bytes: await speicherBytes(),
  };
}

/** Zähler je Status (für Plan und die Zahlmarke am Reiter — ein GROUP BY, sonst nichts). */
export async function statusZaehler(): Promise<Record<SocialStatus, number>> {
  await ensureSocialTabellen();
  const z = (await sqlPool`SELECT status, COUNT(*)::int AS n FROM fiaon_social_posts GROUP BY status`) as any[];
  const zaehler = Object.fromEntries(SOCIAL_STATUS.map((s) => [s, 0])) as Record<SocialStatus, number>;
  for (const x of z) if (istSocialStatus(x.status)) zaehler[x.status as SocialStatus] = Number(x.n);
  return zaehler;
}

export async function instagramVorschau(tageRoh: unknown, markeRoh: unknown, ich: SocialIch): Promise<SocialInstagramAntwort> {
  await ensureSocialTabellen();
  const t = Number(tageRoh);
  const tage = Number.isFinite(t) && t >= 0 && t <= 90 ? Math.round(t) : 0;
  // Vorgabe „alle": Das Launch-Raster (Reihenfolge 1→10) mischt FIAON und Global auf EINEM Konto (@fiaon.ltd).
  const marke: SocialMarke | "alle" = markeRoh === "global" ? "global" : markeRoh === "fiaon" ? "fiaon" : "alle";
  const stichtag = berlinPlusTage(tage);
  // Welches KONTO? Heute gibt es nur @fiaon.ltd — dort erscheinen FIAON- und Global-Posts
  // gemischt (Launch 1→10). „nur FIAON"/„nur Global" ist dann ein Filter auf diesem Raster.
  // Erst wenn ein eigenes Instagram-Profil für Global angelegt ist (fiaon_social_profile),
  // zeigt marke=global dessen ganzes Raster.
  const globalProfil = (await sqlPool`SELECT 1 FROM fiaon_social_profile WHERE kanal = 'instagram' AND marke = 'global' LIMIT 1`) as any[];
  const eigenesGlobal = marke === "global" && globalProfil.length > 0;
  const nurFilter = marke !== "alle" && !eigenesGlobal;
  // @> statt = ANY(): so trifft die Abfrage den GIN-Index fiaon_social_posts_kanaele_idx.
  const rows = (await sqlPool.unsafe(
    `SELECT ${POST_SPALTEN} FROM fiaon_social_posts p
      WHERE p.kanaele @> ARRAY['instagram']::text[] AND ($1 = 'alle' OR p.marke = $1) AND p.status <> 'verworfen' AND p.plan_datum <= $2::date
      ORDER BY p.plan_datum DESC, p.plan_zeit DESC NULLS LAST, p.reihenfolge DESC NULLS LAST, p.id DESC LIMIT 120`, [marke, stichtag])) as any[];
  const kacheln: SocialRasterKachel[] = rows.map((r) => {
    const dateien = (Array.isArray(r.dateien) ? r.dateien : []) as PostDatei[];
    const v = vorschauAus(dateien);
    return {
      post_id: Number(r.id), titel: r.titel, format: r.format as SocialFormat, status: r.status,
      geplant: !(r.status === "veroeffentlicht" || r.status === "ausgewertet"),
      plan_datum: r.pd, plan_zeit: r.pz ?? null, bild: v,
      zuschnitt: rasterZuschnitt(v?.breite ?? null, v?.hoehe ?? null),
      symbol: rasterSymbol(r.format), ki_noetig: !!r.ki_noetig,
    };
  });
  const profilMarke: SocialMarke = eigenesGlobal ? "global" : "fiaon";
  const pr = (await sqlPool`SELECT * FROM fiaon_social_profile WHERE kanal = 'instagram' AND marke = ${profilMarke}`) as any[];
  const fo = (await sqlPool`SELECT anzahl FROM fiaon_social_follower WHERE kanal = 'instagram' AND marke = ${profilMarke} ORDER BY datum DESC LIMIT 1`) as any[];
  const vorgabe = profilMarke === "fiaon" ? SOZIALE_PROFILE.find((p) => p.kanal === "instagram") : undefined;
  const profil: SocialInstagramAntwort["profil"] = pr[0]
    ? { handle: pr[0].handle ?? "", name: pr[0].name ?? "", bio: pr[0].bio ?? null, links: arr((pr[0].links ?? []).map((l: any) => (typeof l === "string" ? l : l?.url ?? ""))).filter(Boolean),
        profilbild_url: pr[0].profilbild_datei_id ? dateiUrl(Number(pr[0].profilbild_datei_id)) : null, beitraege: kacheln.length, follower: fo[0] ? Number(fo[0].anzahl) : null, quelle: "profil" }
    : { handle: vorgabe?.handle ?? "", name: "FIAON", bio: null, links: [], profilbild_url: null, beitraege: kacheln.length, follower: fo[0] ? Number(fo[0].anzahl) : null, quelle: "vorgabe" };
  if (!profil.handle) profil.handle = profilMarke === "global" ? "@fiaon.global (noch nicht angelegt)" : "@fiaon.ltd";
  return { ok: true, ich, tage, marke, nur_filter: nurFilter, stichtag, profil, kacheln };
}

// ── Verlauf ────────────────────────────────────────────────────────────────
async function verlaufSchreiben(tx: any, e: { post_id: number; version: number; fassung: number; art: string; wer: SocialHandelnder; vorher?: unknown; nachher?: unknown; grund?: string | null }) {
  await tx`
    INSERT INTO fiaon_social_verlauf (post_id, version, fassung, art, von_agent_id, von, vorher, nachher, grund)
    VALUES (${e.post_id}, ${e.version}, ${e.fassung}, ${e.art}, ${e.wer.agentId}, ${e.wer.von === "import-token" ? "import-token" : `${e.wer.von} (${e.wer.name})`},
            ${e.vorher === undefined ? null : tx.json(e.vorher as any)}, ${e.nachher === undefined ? null : tx.json(e.nachher as any)}, ${e.grund ?? null})`;
}

/** Schnappschuss der Textfelder und Dateien — damit ist jede Fassung wiederherstellbar. */
const schnappschuss = (r: any) => ({
  fassung: r.fassung, titel: r.titel, serie: r.serie, format: r.format, marke: r.marke, kanaele: r.kanaele, themen: r.themen,
  caption: r.caption, hashtags: r.hashtags, erster_kommentar: r.erster_kommentar, alt_text: r.alt_text, bildtexte: r.bildtexte,
  link: r.link, ki_noetig: r.ki_noetig, ki_grund: r.ki_grund, ausnahmen: r.ausnahmen, dateien: r.dateien,
  status: r.status, plan_datum: r.pd, plan_zeit: r.pz, veroeffentlicht: r.veroeffentlicht, kennzahlen: r.kennzahlen, checkliste: r.checkliste,
  website_sichtbar: !!r.website_sichtbar,
});

// ── Import ─────────────────────────────────────────────────────────────────
/**
 * Eine hochgeladene Datei: `pfad` (multer auf der Platte — der Normalfall) oder
 * `inhalt` (Aufrufe ohne Platte). Gelesen wird erst im Import, eine nach der anderen.
 */
export interface ImportDatei { name: string; pfad?: string; inhalt?: Buffer }
export interface ImportEingabe {
  manifest: SocialManifest;
  metaRoh: unknown;
  warnungen: string[];
  caption: string;
  altText: string | null;
  dateien: ImportDatei[];
  ordner: string | null;
  probe: boolean;
  wer: SocialHandelnder;
}

const planZeitpunkt = (datum: string, zeit: string | null): Date | null => {
  if (!zeit) return null;
  const [h, m] = zeit.split(":").map(Number);
  return berlinZeitpunkt(datum, h * 60 + m);
};

export async function socialImport(e: ImportEingabe): Promise<{ status: number; antwort: SocialImportAntwort & { probe?: boolean } }> {
  await ensureSocialTabellen();
  const m = e.manifest;
  const hinweise: string[] = [...e.warnungen];
  // 1) Dateien zuordnen und prüfen — Reihenfolge aus dem Manifest, nicht aus dem Upload.
  const hoch = new Map<string, ImportDatei>();
  for (const d of e.dateien) {
    if (hoch.has(d.name)) throw wurf(400, `„${d.name}“ wurde zweimal hochgeladen.`, "UNGUELTIG");
    if (!d.pfad && !d.inhalt) throw wurf(400, `„${d.name}“ ist leer.`, "UNGUELTIG");
    hoch.set(d.name, d);
  }
  const imManifest = new Set(m.dateien.map((d) => d.datei));
  for (const n of Array.from(hoch.keys())) if (!imManifest.has(n)) throw wurf(422, `Die Datei „${n}“ steht nicht in meta.json.`, "DATEI_FEHLT");
  // E-294 (Prüfung 06.10.2026): EINE Datei nach der anderen lesen, prüfen, loslassen.
  // In `geplant` steht danach nur der Pfad; die Bytes liest dateiSchreiben erst beim
  // INSERT noch einmal — so liegt nie mehr als eine Datei (samt Hex-Kopie) im Speicher.
  type Plan = { pos: number; rolle: SocialRolle; name: string; sha256: string; inhalt: Buffer | { pfad: string } | null; analyse: DateiAnalyse | null; sekunden: number | null };
  const geplant: Plan[] = [];
  const ohneBytes: { sha: string; rolle: SocialRolle; name: string }[] = [];
  for (let i = 0; i < m.dateien.length; i++) {
    const d = m.dateien[i];
    const h = hoch.get(d.datei) ?? null;
    if (h) {
      let b: Buffer | null = h.inhalt ?? (await fs.promises.readFile(h.pfad!));
      const sha = sha256Hex(b);
      if (d.sha256 && d.sha256 !== sha) throw wurf(422, `Die Datei „${d.datei}“ passt nicht zur Prüfsumme aus meta.json.`, "PRUEFSUMME");
      const a = dateiTypAusBytes(b);
      if (!a) throw wurf(422, `„${d.datei}“ ist kein erlaubter Dateityp (JPEG, PNG, PDF, MP4, MOV).`, "DATEI_TYP");
      const f = rolleTypFehler(d.rolle, a, d.datei);
      if (f) throw wurf(422, f, "DATEI_TYP");
      hinweise.push(...metaHinweise(d.rolle, a, b.length, d.datei));
      geplant.push({ pos: i + 1, rolle: d.rolle, name: d.datei, sha256: sha, inhalt: h.pfad ? { pfad: h.pfad } : h.inhalt!, analyse: a, sekunden: d.sekunden ?? a.sekunden });
      b = null;
    } else {
      if (!d.sha256) throw wurf(422, `Die Datei „${d.datei}“ fehlt, und meta.json nennt keine Prüfsumme, über die sie sich finden ließe.`, "DATEI_FEHLT");
      ohneBytes.push({ sha: d.sha256, rolle: d.rolle, name: d.datei });
      geplant.push({ pos: i + 1, rolle: d.rolle, name: d.datei, sha256: d.sha256, inhalt: null, analyse: null, sekunden: d.sekunden ?? null });
    }
  }
  const vorhanden = await vorhandeneShas(ohneBytes.map((x) => x.sha));
  // Auch ein Verweis per sha256 muss zur Rolle passen (kein vorhandenes PDF als „bild“).
  for (const x of ohneBytes) {
    const mime = vorhanden.get(x.sha);
    if (!mime) continue;
    const f = rolleTypFehler(x.rolle, { mime: mime as DateiAnalyse["mime"], endung: "jpg", breite: null, hoehe: null, sekunden: null, moovVorne: null }, x.name);
    if (f) throw wurf(422, f, "DATEI_TYP");
  }
  const fehlend = Array.from(new Set(ohneBytes.map((x) => x.sha).filter((s) => !vorhanden.has(s))));
  const schonDa = geplant.filter((g) => !g.inhalt).length - fehlend.length;

  // 2) Prüfsumme und Wort-Check
  const kanon = importKanon(m, e.caption, e.altText, geplant.map((g) => ({ pos: g.pos, rolle: g.rolle, sha256: g.sha256 })));
  const importHash = createHash("sha256").update(kanon).digest("hex");
  const ausn = ausnahmenAusManifest(m.wortcheck?.ausnahmen ?? []);
  for (const u of ausn.unbekannt) hinweise.push(`Ausnahme „${u}“ ist nicht in der festen Liste — nicht angewendet.`);
  const wc = socialWortcheck({
    marke: m.marke, titel: m.titel, caption: e.caption, erster_kommentar: m.erster_kommentar, alt_text: e.altText,
    hashtags: m.hashtags, bildtexte: m.bildtexte, ausnahmen: ausn.schluessel, ausnahmen_unbekannt: ausn.unbekannt, manifest: m.wortcheck,
  });
  if (m.status && m.status !== "zur_freigabe") hinweise.push(`Status „${m.status}“ aus meta.json ignoriert — eingespielt wird immer „zur_freigabe“; freigeben geht nur im Studio.`);
  const pz = planZeitpunkt(m.plan.datum, m.plan.zeit);

  const neuePostDateien = async (tx: any, postId: number): Promise<PostDatei[]> => {
    const out: PostDatei[] = [];
    for (const g of geplant) {
      const id = await dateiSchreiben(tx, { post_id: postId, pos: g.pos, rolle: g.rolle, dateiname: g.name, sha256: g.sha256, inhalt: g.inhalt, analyse: g.analyse, sekunden: g.sekunden, von: e.wer.von });
      const k = (await tx`SELECT mime, bytes, breite, hoehe, sekunden FROM fiaon_social_dateien WHERE id = ${id}`) as any[];
      out.push({ datei_id: id, pos: g.pos, rolle: g.rolle, dateiname: g.name, sha256: g.sha256, sekunden: k[0]?.sekunden == null ? null : Number(k[0].sekunden),
        mime: k[0]?.mime ?? "application/octet-stream", bytes: Number(k[0]?.bytes ?? 0), breite: k[0]?.breite ?? null, hoehe: k[0]?.hoehe ?? null });
    }
    return out;
  };

  const wcAntwort = { ergebnis: wc.ergebnis, treffer: wortTrefferZahl(wc), abweichung_zum_manifest: wc.abweichung_zum_manifest };
  if (wc.abweichung_zum_manifest) hinweise.push(`Wort-Check: meta.json sagt „${m.wortcheck?.ergebnis ?? "?"}“, der Server sagt „${wc.ergebnis}“.`);

  return await sqlPool.begin(async (tx: any) => {
    // Gleichzeitige Importe derselben id hintereinander (auch wenn es die Zeile noch nicht gibt).
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"social-import:" + m.id}))`;
    const alt = (await tx.unsafe(`SELECT ${POST_SPALTEN} FROM fiaon_social_posts p WHERE p.extern_id = $1 FOR UPDATE`, [m.id])) as any[];
    const a = alt[0];
    const basis = { extern_id: m.id, dateien: { gespeichert: 0, schon_vorhanden: Math.max(0, schonDa), fehlend }, wortcheck: wcAntwort, hinweise };

    if (!a) {
      if (e.probe || fehlend.length) {
        if (!e.probe) throw wurf(422, `Es fehlen ${fehlend.length} Datei(en), die noch nicht in der Datenbank liegen. Bitte mitschicken.`, "DATEI_FEHLT", { fehlend });
        return { status: 200, antwort: { ok: true as const, probe: true, ergebnis: "neu" as const, id: 0, version: 0, fassung: 1, status: "zur_freigabe" as SocialStatus, vorher_status: null, konflikt: false, studio_url: "", ...basis } };
      }
      const ins = (await tx`
        INSERT INTO fiaon_social_posts (extern_id, schema, ordner, version, fassung, import_hash, zuletzt_importiert_am,
          serie, titel, format, welt, marke, kanaele, themen, plan_datum, plan_zeit, plan_zeitpunkt, zeitzone, reihenfolge,
          status, caption, hashtags, erster_kommentar, alt_text, bildtexte, link, ki_noetig, ki_grund,
          ausnahmen, ausnahmen_unbekannt, wortcheck, wortcheck_manifest, meta_roh)
        VALUES (${m.id}, ${m.schema}, ${e.ordner}, 1, 1, ${importHash}, NOW(),
          ${m.serie}, ${m.titel}, ${m.format}, ${m.welt}, ${m.marke}, ${m.kanaele}::text[], ${m.themen}::text[],
          ${m.plan.datum}::date, ${m.plan.zeit}::time, ${pz}, ${m.plan.zeitzone}, ${m.plan.reihenfolge},
          'zur_freigabe', ${e.caption}, ${m.hashtags}::text[], ${m.erster_kommentar}, ${e.altText}, ${tx.json(m.bildtexte as any)}, ${m.link},
          ${m.ki.noetig}, ${m.ki.grund}, ${ausn.schluessel}::text[], ${ausn.unbekannt}::text[], ${tx.json(wc as any)},
          ${m.wortcheck ? tx.json(m.wortcheck as any) : null}, ${tx.json(e.metaRoh as any)})
        RETURNING id`) as any[];
      const id = Number(ins[0].id);
      const pd = await neuePostDateien(tx, id);
      await tx`UPDATE fiaon_social_posts SET dateien = ${tx.json(pd as any)} WHERE id = ${id}`;
      await verlaufSchreiben(tx, { post_id: id, version: 1, fassung: 1, art: "import_neu", wer: e.wer, nachher: { import_hash: importHash, dateien: pd.length, wortcheck: wc.ergebnis }, grund: hinweise.length ? hinweise.join(" · ") : null });
      return { status: 201, antwort: { ok: true as const, ergebnis: "neu" as const, id, version: 1, fassung: 1, status: "zur_freigabe" as SocialStatus, vorher_status: null, konflikt: false, studio_url: studioUrl(id), ...basis, dateien: { ...basis.dateien, gespeichert: geplant.filter((g) => g.inhalt).length } } };
    }

    const id = Number(a.id);
    // (b) Inhalt unverändert seit dem letzten Import
    if (a.import_hash && String(a.import_hash).trim() === importHash) {
      let version = Number(a.version);
      const planAnders = a.pd !== m.plan.datum || (a.pz ?? null) !== m.plan.zeit || (a.reihenfolge ?? null) !== m.plan.reihenfolge;
      if (planAnders) {
        if (a.plan_im_studio_geaendert) hinweise.push("Termin im Studio verschoben — Termin aus meta.json nicht übernommen.");
        else if (a.status !== "entwurf" && a.status !== "zur_freigabe") hinweise.push(`Termin aus meta.json weicht ab, der Post ist schon „${a.status}“ — nur im Studio verschieben.`);
        else if (!e.probe) {
          version += 1;
          await tx`UPDATE fiaon_social_posts SET plan_datum = ${m.plan.datum}::date, plan_zeit = ${m.plan.zeit}::time, plan_zeitpunkt = ${pz},
                     reihenfolge = ${m.plan.reihenfolge}, version = ${version}, updated_at = NOW() WHERE id = ${id}`;
          await verlaufSchreiben(tx, { post_id: id, version, fassung: Number(a.fassung), art: "plan_aus_import", wer: e.wer, vorher: { plan_datum: a.pd, plan_zeit: a.pz }, nachher: { plan_datum: m.plan.datum, plan_zeit: m.plan.zeit } });
          hinweise.push("Termin aus meta.json übernommen.");
        }
      }
      return { status: 200, antwort: { ok: true as const, ...(e.probe ? { probe: true } : {}), ergebnis: "unveraendert" as const, id, version, fassung: Number(a.fassung), status: a.status, vorher_status: null, konflikt: false, studio_url: studioUrl(id), ...basis, dateien: { gespeichert: 0, schon_vorhanden: geplant.length, fehlend: [] } } };
    }

    // (c) Inhalt geändert → neue Fassung, nie still überschreiben
    if (a.status === "verworfen") throw wurf(409, "Dieser Post wurde im Studio verworfen. Eine neue Fassung braucht eine neue id in meta.json.", "VERWORFEN");
    // Live stehende Posts nie per Import „unveröffentlichen" (Prüfung 06.10.2026): Links,
    // Kennzahlen und der Platz im Raster blieben sonst nur im Verlauf.
    if (a.status === "veroeffentlicht" || a.status === "ausgewertet") {
      throw wurf(409, "Dieser Post ist schon veröffentlicht. Eine geänderte Fassung braucht eine neue id in meta.json — der veröffentlichte Stand bleibt, wie er ist.", "BEREITS_VEROEFFENTLICHT");
    }
    if (fehlend.length && !e.probe) throw wurf(422, `Es fehlen ${fehlend.length} Datei(en), die noch nicht in der Datenbank liegen. Bitte mitschicken.`, "DATEI_FEHLT", { fehlend });
    const konflikt = !!a.im_studio_bearbeitet;
    // KI-Kennzeichnung: Studio ODER Manifest (Prüfung 06.10.2026). Eine Verschärfung aus
    // dem Studio überlebt jede neue Fassung; senken geht nur im Studio (Inhaber, mit Grund).
    const kiNoetig = !!a.ki_noetig || m.ki.noetig;
    const kiGrund = kiNoetig && !m.ki.noetig ? (a.ki_grund ?? m.ki.grund) : m.ki.grund;
    const kiKonflikt = !!a.ki_noetig !== m.ki.noetig;
    if (kiKonflikt && kiNoetig && !m.ki.noetig) hinweise.push("KI-Kennzeichnung: meta.json sagt „nicht nötig“, im Studio steht „nötig“ — es bleibt bei „nötig“. Senken geht nur im Studio.");
    const fassung = Number(a.fassung) + 1;
    const version = Number(a.version) + 1;
    if (konflikt) hinweise.push("Der Post war im Studio bearbeitet — die Studio-Fassung bleibt im Verlauf abrufbar.");
    if (a.status === "freigegeben" || a.status === "eingeplant") hinweise.push(`Die alte Fassung war „${a.status}“ — die neue muss neu freigegeben werden.`);
    // E-296: Der Website-Schalter galt für den alten Inhalt — nach der neuen Freigabe neu einschalten.
    if (a.website_sichtbar) hinweise.push("„Auf der Website zeigen“ ist für die neue Fassung aus — nach der Freigabe neu einschalten.");
    if (e.probe) {
      return { status: 200, antwort: { ok: true as const, probe: true, ergebnis: "neue_version" as const, id, version: Number(a.version), fassung, status: "zur_freigabe" as SocialStatus, vorher_status: a.status, konflikt, studio_url: studioUrl(id), ...basis } };
    }
    const vorher = schnappschuss(a);
    const pd = await neuePostDateien(tx, id);
    const behalteIds = new Set(pd.map((d) => d.datei_id));
    const altIds = ((Array.isArray(a.dateien) ? a.dateien : []) as PostDatei[]).map((d) => d.datei_id).filter((x) => !behalteIds.has(x));
    if (altIds.length) {
      // Alte Dateien bleiben (Verlauf), werden aber als ersetzt markiert.
      await tx`UPDATE fiaon_social_dateien SET ersetzt_durch = ${pd[0]?.datei_id ?? null} WHERE id = ANY(${altIds}::bigint[])`;
    }
    const planBehalten = !!a.plan_im_studio_geaendert;
    if (planBehalten) hinweise.push("Termin im Studio verschoben — Termin aus meta.json nicht übernommen.");
    await tx`
      UPDATE fiaon_social_posts SET
        schema = ${m.schema}, ordner = COALESCE(${e.ordner}, ordner), version = ${version}, fassung = ${fassung},
        import_hash = ${importHash}, zuletzt_importiert_am = NOW(), im_studio_bearbeitet = FALSE,
        serie = ${m.serie}, titel = ${m.titel}, format = ${m.format}, welt = ${m.welt}, marke = ${m.marke},
        kanaele = ${m.kanaele}::text[], themen = ${m.themen}::text[],
        plan_datum = CASE WHEN ${planBehalten} THEN plan_datum ELSE ${m.plan.datum}::date END,
        plan_zeit = CASE WHEN ${planBehalten} THEN plan_zeit ELSE ${m.plan.zeit}::time END,
        plan_zeitpunkt = CASE WHEN ${planBehalten} THEN plan_zeitpunkt ELSE ${pz}::timestamptz END,
        reihenfolge = CASE WHEN ${planBehalten} THEN reihenfolge ELSE ${m.plan.reihenfolge}::int END,
        status = 'zur_freigabe', caption = ${e.caption}, hashtags = ${m.hashtags}::text[], erster_kommentar = ${m.erster_kommentar},
        alt_text = ${e.altText}, bildtexte = ${tx.json(m.bildtexte as any)}, link = ${m.link}, ki_noetig = ${kiNoetig}, ki_grund = ${kiGrund},
        ausnahmen = ${ausn.schluessel}::text[], ausnahmen_unbekannt = ${ausn.unbekannt}::text[], wortcheck = ${tx.json(wc as any)},
        wortcheck_manifest = ${m.wortcheck ? tx.json(m.wortcheck as any) : null}, meta_roh = ${tx.json(e.metaRoh as any)},
        dateien = ${tx.json(pd as any)}, checkliste = '{}'::jsonb,
        freigegeben_von = NULL, freigegeben_von_agent = NULL, freigegeben_am = NULL, freigabe_grund = NULL, freigabe_trotz_rot = FALSE,
        zurueck_notiz = NULL, veroeffentlicht = '{}'::jsonb, veroeffentlicht_am = NULL, kennzahlen = '{}'::jsonb,
        website_sichtbar = FALSE, updated_at = NOW()
      WHERE id = ${id}`;
    await verlaufSchreiben(tx, { post_id: id, version, fassung, art: "neue_version", wer: e.wer, vorher, nachher: { import_hash: importHash, dateien: pd.length, wortcheck: wc.ergebnis, konflikt }, grund: hinweise.length ? hinweise.join(" · ") : null });
    if (kiKonflikt) {
      await verlaufSchreiben(tx, { post_id: id, version, fassung, art: "ki_konflikt", wer: e.wer,
        vorher: { studio: !!a.ki_noetig, grund: a.ki_grund ?? null }, nachher: { manifest: m.ki.noetig, gilt: kiNoetig },
        grund: kiNoetig && !m.ki.noetig ? "Studio sagt „KI nötig“, meta.json nicht — es bleibt „nötig“." : "meta.json verlangt jetzt die KI-Kennzeichnung." });
    }
    return { status: 200, antwort: { ok: true as const, ergebnis: "neue_version" as const, id, version, fassung, status: "zur_freigabe" as SocialStatus, vorher_status: a.status, konflikt, studio_url: studioUrl(id), ...basis, dateien: { ...basis.dateien, gespeichert: geplant.filter((g) => g.inhalt).length } } };
  });
}

// ── Aktionen ───────────────────────────────────────────────────────────────
const textOk = (x: unknown, min = GRUND_MIN) => typeof x === "string" && x.trim().length >= min;
/** „2026-10-08“ → „08.10.2026“. */
const datumDe = (iso: string) => `${String(iso).slice(8, 10)}.${String(iso).slice(5, 7)}.${String(iso).slice(0, 4)}`;

/**
 * Führt eine Studio-Aktion aus. Jede prüft version, Status und Rechte, erhöht
 * version und schreibt den Verlauf. Liefert eine kurze Meldung für den Knopf.
 */
export async function socialAktion(id: number, aktion: SocialAktion, body: any, ich: SocialIch): Promise<{ meldung: string; ziel: string; notiz: string }> {
  await ensureSocialTabellen();
  const wer = handelnderAus(ich);
  const b = body && typeof body === "object" ? body : {};
  return await sqlPool.begin(async (tx: any) => {
    const r = ((await tx.unsafe(`SELECT ${POST_SPALTEN} FROM fiaon_social_posts p WHERE p.id = $1 FOR UPDATE`, [id])) as any[])[0];
    if (!r) throw wurf(404, "Diesen Post gibt es nicht (mehr).", "NICHT_GEFUNDEN");
    const v = Number(b.version);
    if (!Number.isInteger(v) || v !== Number(r.version)) {
      throw wurf(409, "Der Post wurde inzwischen geändert (von dir in einem anderen Fenster, von jemand anderem oder durch einen Import). Bitte neu laden.", "VERSION_VERALTET", { version: Number(r.version) });
    }
    const status = r.status as SocialStatus;
    const neu = Number(r.version) + 1;
    const fassung = Number(r.fassung);
    const verlauf = (art: string, vorher: unknown, nachher: unknown, grund: string | null = null) =>
      verlaufSchreiben(tx, { post_id: id, version: neu, fassung, art, wer, vorher, nachher, grund });

    switch (aktion) {
      case "freigeben": {
        if (status !== "zur_freigabe") throw wurf(409, `Freigeben geht nur aus „Zur Freigabe“ — der Post ist „${status}“.`, "UEBERGANG_UNZULAESSIG");
        const wc = wortcheckFuer(r);
        const rot = wc.ergebnis === "rot";
        const trotzdem = b.trotzdem === true;
        const grund = typeof b.grund === "string" ? b.grund.trim() : "";
        if (rot && !trotzdem) {
          await tx`UPDATE fiaon_social_posts SET wortcheck = ${tx.json(wc as any)} WHERE id = ${id}`;
          throw wurf(409, "Der Wort-Check ist rot — so geht der Post nicht raus. Text ändern lassen oder (nur Inhaber) mit Grund trotzdem freigeben.", "WORTCHECK_ROT", { felder: wc.felder.filter((f: SocialWortFeld) => f.treffer.length) });
        }
        if (rot && trotzdem && ich.stufe !== "inhaber") throw wurf(403, "„Trotzdem freigeben“ darf nur der Inhaber.", "NUR_INHABER");
        if (rot && trotzdem && grund.length < GRUND_MIN) throw wurf(400, `Bitte einen Grund angeben (mindestens ${GRUND_MIN} Zeichen), warum der Post trotz rotem Wort-Check raus darf.`, "GRUND_FEHLT");
        await tx`
          UPDATE fiaon_social_posts SET status = 'freigegeben', version = ${neu}, wortcheck = ${tx.json(wc as any)},
            freigegeben_von = ${wer.name}, freigegeben_von_agent = ${wer.agentId}, freigegeben_am = NOW(),
            freigabe_grund = ${rot ? grund : null}, freigabe_trotz_rot = ${rot}, updated_at = NOW()
          WHERE id = ${id}`;
        await verlauf(rot ? "freigabe_trotz_rot" : "freigegeben", { status, wortcheck: wc.ergebnis }, { status: "freigegeben" }, rot ? grund : null);
        return { meldung: rot ? "Trotz rotem Wort-Check freigegeben — mit Grund protokolliert." : "Freigegeben.", ziel: `social:${id}`, notiz: `${status}→freigegeben${rot ? " TROTZ ROT: " + grund : ""}` };
      }
      case "zurueck": {
        if (!darfUebergang(status, "entwurf")) throw wurf(409, `„Zurück an Claude“ geht im Status „${status}“ nicht.`, "UEBERGANG_UNZULAESSIG");
        if (!textOk(b.notiz)) throw wurf(400, `Bitte aufschreiben, was anders werden soll (mindestens ${GRUND_MIN} Zeichen).`, "GRUND_FEHLT");
        const notiz = String(b.notiz).trim().slice(0, 4000);
        await tx`
          UPDATE fiaon_social_posts SET status = 'entwurf', version = ${neu}, zurueck_notiz = ${notiz},
            freigegeben_von = NULL, freigegeben_von_agent = NULL, freigegeben_am = NULL, freigabe_grund = NULL, freigabe_trotz_rot = FALSE, updated_at = NOW()
          WHERE id = ${id}`;
        await verlauf("zurueck_an_claude", { status }, { status: "entwurf" }, notiz);
        return { meldung: "Zurück an Claude — die Notiz liegt am Post.", ziel: `social:${id}`, notiz: `${status}→entwurf: ${notiz.slice(0, 200)}` };
      }
      case "verschieben": {
        if (!SOCIAL_VERSCHIEBBAR.includes(status)) throw wurf(409, `Ein Post im Status „${status}“ wird nicht mehr verschoben.`, "UEBERGANG_UNZULAESSIG");
        const datum = String(b.datum ?? "");
        const zeit = b.zeit == null || b.zeit === "" ? null : String(b.zeit);
        if (!istPlanDatum(datum)) throw wurf(400, "Bitte ein gültiges Datum wählen.", "UNGUELTIG");
        if (zeit !== null && !istPlanZeit(zeit)) throw wurf(400, "Die Uhrzeit muss HH:MM sein — oder leer.", "UNGUELTIG");
        const pz = planZeitpunkt(datum, zeit);
        await tx`
          UPDATE fiaon_social_posts SET plan_datum = ${datum}::date, plan_zeit = ${zeit}::time, plan_zeitpunkt = ${pz},
            plan_im_studio_geaendert = TRUE, version = ${neu}, kal_sequenz = kal_sequenz + 1, kal_geaendert_am = NOW(), updated_at = NOW()
          WHERE id = ${id}`;
        await verlauf("verschoben", { plan_datum: r.pd, plan_zeit: r.pz }, { plan_datum: datum, plan_zeit: zeit });
        return { meldung: `Verschoben auf ${datum.split("-").reverse().join(".")}${zeit ? `, ${zeit} Uhr` : ""}.`, ziel: `social:${id}`, notiz: `${r.pd} ${r.pz ?? ""}→${datum} ${zeit ?? ""}` };
      }
      case "veroeffentlicht": {
        if (!(status === "freigegeben" || status === "eingeplant" || status === "veroeffentlicht")) {
          throw wurf(409, `Als veröffentlicht melden geht erst nach der Freigabe — der Post ist „${status}“.`, "UEBERGANG_UNZULAESSIG");
        }
        const roh: any[] = Array.isArray(b.meldungen) ? b.meldungen : b.kanal ? [{ kanal: b.kanal, permalink: b.permalink, plattform_id: b.plattform_id }] : [];
        if (!roh.length) throw wurf(400, "Bitte mindestens einen Kanal mit Link zum Beitrag melden.", "PERMALINK_FEHLT");
        const kanaele = arr(r.kanaele);
        if (roh.length > kanaele.length) throw wurf(400, `Höchstens ${kanaele.length} Meldungen — so viele Kanäle hat der Post.`, "UNGUELTIG");
        // Nur die geprüften Felder weiter — nichts Ungefiltertes aus dem Body in Post und Verlauf.
        const meldungen: { kanal: SocialKanal; permalink: string; plattform_id: string | null }[] = [];
        for (const x of roh) {
          const k = String(x?.kanal ?? "").slice(0, 40);
          if (meldungen.some((y) => y.kanal === k)) throw wurf(400, `Der Kanal „${k}“ steht doppelt in der Meldung.`, "UNGUELTIG");
          meldungen.push({ kanal: k as SocialKanal, permalink: String(x?.permalink ?? "").trim().slice(0, 600), plattform_id: x?.plattform_id ? String(x.plattform_id).slice(0, 200) : null });
        }
        const soll = checklisteSoll({ format: r.format, ki_noetig: !!r.ki_noetig, link: r.link, kanaele });
        const ohneKi: SocialKanal[] = [];
        const veroeff = { ...(r.veroeffentlicht ?? {}) } as Record<string, SocialVeroeffentlichung>;
        const jetzt = new Date().toISOString();
        for (const x of meldungen) {
          const k = x.kanal;
          if (!istSocialKanal(k) || !kanaele.includes(k)) throw wurf(400, `Der Kanal „${k}“ gehört nicht zu diesem Post.`, "UNGUELTIG");
          const fehler = permalinkPruefen(k, x.permalink);
          if (fehler) throw wurf(400, `${KANAL_INFO[k].titel}: ${fehler}`, "PERMALINK_FEHLT");
          if (offenePflichtpunkte(soll, r.checkliste ?? {}, k).length) ohneKi.push(k);
          veroeff[k] = { am: jetzt, permalink: x.permalink, plattform_id: x.plattform_id, von: wer.name };
        }
        if (ohneKi.length) throw wurf(409, `Erst den KI-Haken setzen: ${ohneKi.map((k) => KANAL_INFO[k].titel).join(", ")}. Der Post ist als KI-Inhalt gekennzeichnet (Art. 50 KI-VO).`, "KI_HAKEN_FEHLT", { kanaele: ohneKi });
        // E-296: Beim ERSTEN Melden kommt der Post mit auf die Website (Schalter an) — wenn er auf Instagram
        // geht, ein Bild hat und der Wort-Check nicht rot ist. Gezeigt wird er erst mit der Instagram-Meldung
        // (Feed-Regel). Weitere Kanäle melden ändert den Schalter nicht mehr. Und (Prüfung 06.10.2026): Wurde der
        // Schalter für DIESE Fassung schon einmal von Hand geschaltet (Verlauf „website“), bleibt Justins Wahl —
        // ein bewusstes Aus vor der ersten Meldung wird nicht überschrieben.
        const ersteMeldung = status !== "veroeffentlicht";
        let webAn = ersteMeldung && !r.website_sichtbar && kanaele.includes("instagram")
          && feedBildEintraege(r.format, (Array.isArray(r.dateien) ? r.dateien : []) as FeedDateiEintrag[]).length > 0 && wortcheckFuer(r).ergebnis !== "rot";
        if (webAn) {
          const geschaltet = (await tx`
            SELECT 1 FROM fiaon_social_verlauf WHERE post_id = ${id} AND art = 'website' AND fassung = ${Number(r.fassung)} LIMIT 1`) as any[];
          if (geschaltet.length) webAn = false;
        }
        await tx`
          UPDATE fiaon_social_posts SET status = 'veroeffentlicht', version = ${neu}, veroeffentlicht = ${tx.json(veroeff as any)},
            veroeffentlicht_am = COALESCE(veroeffentlicht_am, NOW()), website_sichtbar = (website_sichtbar OR ${webAn}), updated_at = NOW()
          WHERE id = ${id}`;
        await verlauf("veroeffentlicht", { status, veroeffentlicht: r.veroeffentlicht ?? {}, website_sichtbar: !!r.website_sichtbar }, { status: "veroeffentlicht", meldungen, website_sichtbar: !!r.website_sichtbar || webAn });
        const aufInstagram = meldungen.some((x) => x.kanal === "instagram") || !!(r.veroeffentlicht ?? {}).instagram;
        const webSatz = webAn
          ? (!aufInstagram ? " Auf der Website, sobald Instagram gemeldet ist." : r.pd > berlinToday() ? ` Auf der Website ab ${datumDe(r.pd)}.` : " Steht damit auch auf der Website.")
          : "";
        return { meldung: `Als veröffentlicht gemeldet: ${meldungen.map((x) => KANAL_INFO[x.kanal].titel).join(", ")}.${webSatz}`, ziel: `social:${id}`, notiz: `${meldungen.map((x) => `${x.kanal} ${x.permalink}`).join(" · ")}${webAn ? " · website an" : ""}` };
      }
      case "verwerfen": {
        if (!darfUebergang(status, "verworfen")) throw wurf(409, `Ein Post im Status „${status}“ kann nicht mehr verworfen werden.`, "UEBERGANG_UNZULAESSIG");
        if (!textOk(b.grund)) throw wurf(400, `Bitte einen Grund angeben (mindestens ${GRUND_MIN} Zeichen).`, "GRUND_FEHLT");
        const grund = String(b.grund).trim().slice(0, 2000);
        await tx`UPDATE fiaon_social_posts SET status = 'verworfen', verworfen_grund = ${grund}, version = ${neu}, updated_at = NOW() WHERE id = ${id}`;
        await verlauf("verworfen", { status }, { status: "verworfen" }, grund);
        return { meldung: "Verworfen.", ziel: `social:${id}`, notiz: `${status}→verworfen: ${grund.slice(0, 200)}` };
      }
      case "ki-haken": {
        if (status === "verworfen" || status === "ausgewertet") throw wurf(409, `Im Status „${status}“ ändert sich die KI-Kennzeichnung nicht mehr.`, "UEBERGANG_UNZULAESSIG");
        if (typeof b.noetig !== "boolean") throw wurf(400, "Bitte „KI-Kennzeichnung nötig: ja oder nein“ wählen.", "UNGUELTIG");
        const senken = !!r.ki_noetig && b.noetig === false;
        // E-294 (Prüfung 06.10.2026): Die KI-Pflicht (Art. 50 KI-VO, Meta-Regel) lässt sich
        // nicht nebenbei abschalten. Senken: nur Inhaber, Grund ≥ GRUND_MIN — und nie,
        // solange Claudes Manifest selbst „nötig“ sagt.
        if (senken) {
          if (ich.stufe !== "inhaber") throw wurf(403, "Die KI-Kennzeichnung abschalten darf nur der Inhaber — mit Grund.", "NUR_INHABER");
          if ((r.meta_roh as any)?.ki_kennzeichnung?.noetig === true) {
            throw wurf(409, "Claudes meta.json sagt „KI-Kennzeichnung nötig“ — so bleibt es. Soll es anders sein: „Zurück an Claude“ mit Begründung, die neue Fassung bringt das neue Manifest.", "UEBERGANG_UNZULAESSIG");
          }
          if (!textOk(b.grund)) throw wurf(400, `Bitte begründen, warum keine KI-Kennzeichnung nötig ist (mindestens ${GRUND_MIN} Zeichen).`, "GRUND_FEHLT");
        } else if (!textOk(b.grund, 3)) throw wurf(400, "Bitte kurz den Grund nennen (z. B. „Video aus Higgsfield“ oder „echtes Foto, keine KI“).", "GRUND_FEHLT");
        const grund = String(b.grund).trim().slice(0, 500);
        const aendert = !!r.ki_noetig !== b.noetig;
        // Steht der Post schon frei oder eingeplant, gilt die alte Freigabe für die alte Kennzeichnung — neu prüfen.
        const zurueckZurFreigabe = aendert && (status === "freigegeben" || status === "eingeplant");
        await tx`UPDATE fiaon_social_posts SET ki_noetig = ${b.noetig}, ki_grund = ${grund}, im_studio_bearbeitet = TRUE, version = ${neu}, updated_at = NOW(),
                   status = ${zurueckZurFreigabe ? "zur_freigabe" : status},
                   freigegeben_von = CASE WHEN ${zurueckZurFreigabe} THEN NULL ELSE freigegeben_von END,
                   freigegeben_von_agent = CASE WHEN ${zurueckZurFreigabe} THEN NULL ELSE freigegeben_von_agent END,
                   freigegeben_am = CASE WHEN ${zurueckZurFreigabe} THEN NULL ELSE freigegeben_am END,
                   freigabe_grund = CASE WHEN ${zurueckZurFreigabe} THEN NULL ELSE freigabe_grund END,
                   freigabe_trotz_rot = CASE WHEN ${zurueckZurFreigabe} THEN FALSE ELSE freigabe_trotz_rot END
                 WHERE id = ${id}`;
        await verlauf("ki_kennzeichnung", { noetig: !!r.ki_noetig, grund: r.ki_grund, status }, { noetig: b.noetig, grund, status: zurueckZurFreigabe ? "zur_freigabe" : status }, grund);
        const satz = b.noetig ? "KI-Kennzeichnung: nötig. Der KI-Haken ist jetzt in jedem Kanal Pflicht." : "KI-Kennzeichnung: nicht nötig.";
        return { meldung: zurueckZurFreigabe ? `${satz} Die Freigabe ist damit aufgehoben — bitte neu freigeben.` : satz, ziel: `social:${id}`, notiz: `ki_noetig ${!!r.ki_noetig}→${b.noetig}${zurueckZurFreigabe ? ` (${status}→zur_freigabe)` : ""}: ${grund}` };
      }
      case "checkliste": {
        if (status === "verworfen" || status === "ausgewertet") throw wurf(409, `Im Status „${status}“ wird nichts mehr abgehakt.`, "UEBERGANG_UNZULAESSIG");
        const k = String(b.kanal ?? "");
        const punkt = String(b.punkt ?? "");
        const kanaele = arr(r.kanaele);
        if (!istSocialKanal(k) || !kanaele.includes(k)) throw wurf(400, `Der Kanal „${k}“ gehört nicht zu diesem Post.`, "UNGUELTIG");
        const soll = checklisteSoll({ format: r.format, ki_noetig: !!r.ki_noetig, link: r.link, kanaele });
        if (!(soll[k] ?? []).some((p) => p.punkt === punkt)) throw wurf(400, `„${punkt}“ steht nicht auf der Checkliste für ${KANAL_INFO[k].titel}.`, "UNGUELTIG");
        if (typeof b.erledigt !== "boolean") throw wurf(400, "Bitte „erledigt“ als ja/nein schicken.", "UNGUELTIG");
        const cl = JSON.parse(JSON.stringify(r.checkliste ?? {})) as SocialCheckliste;
        const zeile = { ...(cl[k] ?? {}) };
        if (b.erledigt) zeile[punkt] = { am: new Date().toISOString(), von: wer.name };
        else delete zeile[punkt];
        cl[k] = zeile;
        await tx`UPDATE fiaon_social_posts SET checkliste = ${tx.json(cl as any)}, version = ${neu}, updated_at = NOW() WHERE id = ${id}`;
        await verlauf(punkt === KI_PUNKT ? "ki_haken" : "checkliste", { kanal: k, punkt, erledigt: !!r.checkliste?.[k]?.[punkt] }, { kanal: k, punkt, erledigt: b.erledigt });
        return { meldung: b.erledigt ? "Abgehakt." : "Haken entfernt.", ziel: `social:${id}`, notiz: `${k}.${punkt}=${b.erledigt}` };
      }
      case "website": {
        // E-296: Schalter „Auf der Website zeigen“. Einschalten (vormerken) ab der Freigabe, nur mit Instagram als
        // Kanal, mit Bild und ohne roten Wort-Check; ausschalten geht immer. Gezeigt wird erst, wenn der Post auf
        // Instagram als veröffentlicht gemeldet ist, und nie vor dem Plantag (Berlin).
        if (typeof b.sichtbar !== "boolean") throw wurf(400, "Bitte „Auf der Website zeigen“ als an oder aus schicken.", "UNGUELTIG");
        const an = b.sichtbar;
        if (!!r.website_sichtbar === an) return { meldung: an ? "Steht schon auf der Website (ab dem Plantag)." : "Steht schon nicht auf der Website.", ziel: `social:${id}`, notiz: `unverändert ${an}` };
        if (an) {
          if (!istWebsiteSchalterStatus(status)) throw wurf(409, `Auf die Website kommt ein Post erst nach der Freigabe — er ist „${SOCIAL_STATUS_INFO[status]?.titel ?? status}“.`, "UEBERGANG_UNZULAESSIG");
          if (!arr(r.kanaele).includes("instagram")) throw wurf(409, "Dieser Post geht nicht auf Instagram — die Website zeigt nur Beiträge von @fiaon.ltd.", "KEIN_INSTAGRAM");
          if (!feedBildEintraege(r.format, (Array.isArray(r.dateien) ? r.dateien : []) as FeedDateiEintrag[]).length) {
            throw wurf(409, "Dieser Post hat kein Bild — die Website zeigt nur Posts mit Folien oder Titelbild.", "KEIN_BILD");
          }
          const wc = wortcheckFuer(r);
          if (wc.ergebnis === "rot") throw wurf(409, "Der Wort-Check ist rot — auf die Website kommt nur, was grün ist.", "WORTCHECK_ROT", { felder: wc.felder.filter((f: SocialWortFeld) => f.treffer.length) });
        }
        await tx`UPDATE fiaon_social_posts SET website_sichtbar = ${an}, version = ${neu}, updated_at = NOW() WHERE id = ${id}`;
        await verlauf("website", { website_sichtbar: !!r.website_sichtbar }, { website_sichtbar: an, ab: r.pd });
        const spaeter = r.pd > berlinToday();
        const gemeldet = !!(r.veroeffentlicht ?? {}).instagram && (status === "veroeffentlicht" || status === "ausgewertet");
        const meldung = an
          ? (!gemeldet ? "Vorgemerkt: Der Post erscheint auf der Website, sobald er auf Instagram als veröffentlicht gemeldet ist."
            : spaeter ? `Auf der Website ab ${datumDe(r.pd)} (Plantag).` : "Steht jetzt auf der Website. Schon geöffnete Seiten zeigen es nach spätestens fünf Minuten.")
          : "Von der Website genommen. Schon geöffnete Seiten zeigen es höchstens noch fünf Minuten.";
        return { meldung, ziel: `social:${id}`, notiz: `${!!r.website_sichtbar}→${an}${an && r.pd > berlinToday() ? ` ab ${r.pd}` : ""}` };
      }
      default:
        throw wurf(400, "Diese Aktion gibt es nicht.", "UNGUELTIG");
    }
  });
}

// ── Kleine Web-Bilder (E-296) ──────────────────────────────────────────────
/**
 * Das Studio rechnet beim Einschalten von „Auf der Website zeigen“ je Bild/Titelbild
 * ein 480 px breites JPEG (canvas, Qualität 0,82) und schickt es hierher. Der Server
 * prüft selbst: JPEG aus den Bytes, höchstens 600 px breit, nicht größer als das
 * Original, gleiches Seitenverhältnis, die Quelle ist ein aktuelles Bild DIESES Posts.
 * Gespeichert als variante 'web_480' mit quelle_id = Original (dateiSchreiben,
 * eindeutiger Index je post/sha256/variante). Jede Datei einzeln: Was nicht passt,
 * steht in `fehler`, der Rest wird trotzdem gespeichert. Keine neue version — der
 * Inhalt des Posts ändert sich nicht; eine Verlaufszeile, wenn etwas angelegt wurde.
 */
export interface WebVarianteEingang { quelle_id: number; inhalt: Buffer }
export interface WebVariantenErgebnis { angelegt: { quelle_id: number; id: number }[]; schon_da: number[]; fehler: { quelle_id: number; error: string }[] }

export async function webVariantenSpeichern(id: number, eingang: WebVarianteEingang[], ich: SocialIch): Promise<WebVariantenErgebnis> {
  await ensureSocialTabellen();
  const wer = handelnderAus(ich);
  if (!eingang.length) throw wurf(400, "Es kam kein Bild an.", "UNGUELTIG");
  if (eingang.length > IMPORT_MAX_DATEIEN) throw wurf(400, `Höchstens ${IMPORT_MAX_DATEIEN} kleine Bilder auf einmal.`, "UNGUELTIG");
  const r = ((await sqlPool`SELECT id, extern_id, version, fassung, dateien FROM fiaon_social_posts WHERE id = ${id}`) as any[])[0];
  if (!r) throw wurf(404, "Diesen Post gibt es nicht (mehr).", "NICHT_GEFUNDEN");
  const liste = ((Array.isArray(r.dateien) ? r.dateien : []) as PostDatei[]).filter((d) => d.rolle === "bild" || d.rolle === "cover");
  const jeId = new Map(liste.map((d) => [Number(d.datei_id), d] as const));
  const out: WebVariantenErgebnis = { angelegt: [], schon_da: [], fehler: [] };
  const gesehen = new Set<number>();
  for (const e of eingang) {
    const q = Number(e.quelle_id);
    const fehler = (text: string) => out.fehler.push({ quelle_id: Number.isFinite(q) ? q : 0, error: text });
    if (!Number.isInteger(q) || q <= 0) { fehler("Die Quelle fehlt (Feldname = id des Originals)."); continue; }
    if (gesehen.has(q)) { fehler("Diese Quelle kam zweimal."); continue; }
    gesehen.add(q);
    const eintrag = jeId.get(q);
    if (!eintrag) { fehler("Diese Datei ist kein aktuelles Bild oder Titelbild dieses Posts."); continue; }
    const k = ((await sqlPool`
      SELECT id, post_id, mime, breite, hoehe FROM fiaon_social_dateien
       WHERE id = ${q} AND variante = 'original' AND geloescht_am IS NULL AND inhalt_geleert_am IS NULL`) as any[])[0];
    if (!k || Number(k.post_id) !== id || !(k.mime === "image/jpeg" || k.mime === "image/png")) { fehler("Das Original ist kein JPEG/PNG dieses Posts (mehr)."); continue; }
    if (!Buffer.isBuffer(e.inhalt) || !e.inhalt.length) { fehler("Die Datei ist leer."); continue; }
    if (e.inhalt.length > WEB_480_MAX_BYTES) { fehler(`Das kleine Bild ist größer als ${Math.round(WEB_480_MAX_BYTES / 1024)} KB.`); continue; }
    const a = dateiTypAusBytes(e.inhalt);
    if (!a || a.mime !== "image/jpeg") { fehler("Das kleine Bild muss ein JPEG sein."); continue; }
    if (!a.breite || !a.hoehe) { fehler("Die Maße des kleinen Bildes ließen sich nicht lesen."); continue; }
    if (a.breite > WEB_480_MAX_BREITE) { fehler(`Das kleine Bild ist ${a.breite} px breit — höchstens ${WEB_480_MAX_BREITE} px.`); continue; }
    const ob = Number(k.breite) || 0, oh = Number(k.hoehe) || 0;
    if (ob && a.breite > ob) { fehler("Das kleine Bild ist breiter als das Original."); continue; }
    if (ob && oh && Math.abs(a.breite / a.hoehe - ob / oh) > (ob / oh) * 0.03) { fehler("Das Seitenverhältnis passt nicht zum Original."); continue; }
    const sha = sha256Hex(e.inhalt);
    try {
      const neuId = await sqlPool.begin(async (tx: any) => {
        // Je Post nacheinander (zwei offene Fenster schicken sonst dieselben Bilder gleichzeitig).
        await tx`SELECT pg_advisory_xact_lock(hashtext(${"social-web:" + id}))`;
        const da = (await tx`
          SELECT id FROM fiaon_social_dateien
           WHERE variante = 'web_480' AND quelle_id = ${q} AND geloescht_am IS NULL AND inhalt_geleert_am IS NULL LIMIT 1`) as any[];
        if (da[0]) return null;
        const basis = String(eintrag.dateiname || `datei-${q}`).replace(/\.[a-z0-9]+$/i, "");
        return await dateiSchreiben(tx, {
          post_id: id, pos: Number(eintrag.pos) || 1, rolle: eintrag.rolle, dateiname: `${basis}_web480.jpg`, sha256: sha,
          inhalt: e.inhalt, analyse: a, sekunden: null, von: wer.von, variante: "web_480", quelle_id: q,
        });
      });
      if (neuId === null) out.schon_da.push(q);
      else out.angelegt.push({ quelle_id: q, id: neuId });
    } catch (err: any) {
      console.error("[SOCIAL] Web-Bild:", err);
      fehler(err instanceof Error && /gehört schon/.test(err.message) ? err.message : "Speichern ging nicht.");
    }
  }
  if (out.angelegt.length) {
    try {
      await sqlPool.begin(async (tx: any) => {
        await verlaufSchreiben(tx, { post_id: id, version: Number(r.version), fassung: Number(r.fassung), art: "web_varianten", wer,
          nachher: { angelegt: out.angelegt, schon_da: out.schon_da, fehler: out.fehler.length } });
      });
    } catch (err) { console.error("[SOCIAL] Web-Bild-Verlauf:", err); }
  }
  return out;
}
