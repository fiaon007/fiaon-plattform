// ═══════════════════════════════════════════════════════════════════════════
// META-AUTOMATIK: POSTEN AUF INSTAGRAM UND FACEBOOK (15.10.2026, E-380)
//
// Ein freigegebener Post aus dem Social-Studio geht zu seiner Planzeit auf
// Instagram (@fiaon.ltd) und auf die Facebook-Seite „FIAON" — von selbst, sobald
// der Meta-Zugang (META_SYSTEM_TOKEN) die Posting-Rechte trägt. Die Regeln
// (fällig, welche Kanäle, welche Dateien, Leitplanken) stehen in
// shared/fiaon-social-meta.ts; hier nur Datenbank und Meta.
//
// ── DER WEG EINES POSTS ───────────────────────────────────────────────────
//   1. Fällig (Planzeit erreicht, höchstens 2 h alt, nach dem Einschalten) →
//      Auftrag je Kanal anlegen. Der eindeutige Index (post, kanal, fassung)
//      ist die Sperre: Zwei Server, die gleichzeitig laufen, posten nie doppelt.
//   2. Instagram: Container anlegen (Bild, Karussell aus Kinder-Containern, Reel)
//      → warten, bis Meta ihn verarbeitet hat (Reels dauern Minuten; der nächste
//      Lauf sieht wieder nach) → media_publish GENAU EINMAL.
//      Facebook: Seiten-Token aus /me/accounts → Foto, Mehrbild-Beitrag oder Video.
//   3. Danach meldet die Automatik den Post im Studio als veröffentlicht — über
//      denselben Weg wie ein Mensch (socialAktion „veroeffentlicht"), mit Link.
//
// ── DIE ZUSTÄNDE EINES AUFTRAGS ────────────────────────────────────────────
//   laeuft  in Arbeit (wer ihn hat, hat ihn per bedingtem UPDATE geholt)
//   warten  Container angelegt, Meta verarbeitet noch
//   unklar  Veröffentlichen angestoßen, Antwort fehlt → im Profil nachsehen;
//           findet sich nichts, bleibt er stehen — NIE automatisch neu posten
//   ok      online, Link im Studio
//   fehler  eindeutig gescheitert, VOR dem Veröffentlichen → bis zu 3 Versuche
//
// Die Medien holt Meta über eine signierte, zeitlich begrenzte Adresse
// (/api/fiaon/social/meta-datei/:id) — die Studio-Dateien bleiben sonst privat.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { sqlPool } from "./db-pool";
import { graph, MetaFehler } from "./fiaon-meta";
import { socialAktion, ensureSocialTabellen } from "./fiaon-social";
import { sozialFeedLeeren } from "./fiaon-sozial-feed";
import { KI_PUNKT, type SocialIch } from "@shared/fiaon-social";
import {
  AUFTRAG_HAENGT_MS, AUTO_FENSTER_MS, AUTO_HOECHSTVERSUCHE, CONTAINER_VERFALL_MS, IG_TAGESGRENZE,
  autoKanaele, captionFuerMeta, istFaellig, medienPlan, rechteAusScopes,
  type AutoDatei, type AutoKanal, type MedienPlan, type MetaAutomatikStand, type PostingRechte,
} from "@shared/fiaon-social-meta";

export type GraphFn = typeof graph;

const SEITE = (process.env.PUBLIC_BASE_URL || "https://fiaon.com").replace(/\/+$/, "");
const SCHALTER = "social_auto_posten";
const AKTIV_SEIT = "social_auto_aktiv_seit";
const KI_STOPP = "social_auto_ki_stopp";
const AUTOMATIK: SocialIch = { stufe: "geschaeftsfuehrung", agentId: null, name: "Automatik (Meta)", darfTrotzdem: false, automatik: true };

// ── Tabellen ───────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureMetaAutomatikTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const r = (await sqlPool`SELECT to_regclass('public.fiaon_social_meta_auftraege') AS a, to_regclass('public.fiaon_meta_utm_protokoll') AS u`) as any[];
      if (r[0]?.a && r[0]?.u) return;
      const text = readFileSync(path.resolve(process.cwd(), "db", "migrations", "110_meta_automatik.sql"), "utf8");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(text);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

async function einstellung(key: string): Promise<string | null> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`.catch(() => [])) as any[];
  const v = String(r?.value ?? "").trim();
  return v || null;
}
async function einstellungSetzen(key: string, wert: string | null): Promise<void> {
  if (wert === null) { await sqlPool`DELETE FROM fiaon_settings WHERE key = ${key}`; return; }
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

// ── Rechte und Seite ───────────────────────────────────────────────────────
let rechteSpeicher: { bis: number; rechte: PostingRechte } | null = null;
/** Was darf der Meta-Zugang? Aus debug_token (App-Token), zehn Minuten gemerkt. Ohne Antwort: nichts. */
export async function postingRechte(g: GraphFn = graph): Promise<PostingRechte> {
  if (rechteSpeicher && rechteSpeicher.bis > Date.now()) return rechteSpeicher.rechte;
  const token = process.env.META_SYSTEM_TOKEN;
  let rechte: PostingRechte = { instagram: false, facebook: false, kommentare: false };
  if (token) {
    try {
      const d = await g("debug_token", { params: { input_token: token }, appToken: true });
      if (d?.data?.is_valid) rechte = rechteAusScopes(d.data.scopes);
    } catch (e) {
      console.warn("[SOCIAL-META] Rechte nicht lesbar:", e instanceof MetaFehler ? e.klartext : String(e).slice(0, 200));
    }
  }
  rechteSpeicher = { bis: Date.now() + 10 * 60_000, rechte };
  return rechte;
}

interface Seite { pageId: string; pageToken: string; igId: string | null }
let seiteSpeicher: { bis: number; seite: Seite } | null = null;
/** Die Facebook-Seite mit ihrem Seiten-Token und dem verbundenen Instagram-Konto (nur im Speicher, nie in der DB). */
async function seiteLesen(g: GraphFn): Promise<Seite> {
  if (seiteSpeicher && seiteSpeicher.bis > Date.now()) return seiteSpeicher.seite;
  const j = await g("me/accounts", { params: { fields: "id,name,access_token,instagram_business_account{id,username}", limit: 25 } });
  const seiten = (j?.data ?? []) as any[];
  const s = seiten.find((x) => x?.instagram_business_account?.username === "fiaon.ltd") ?? seiten.find((x) => /fiaon/i.test(String(x?.name))) ?? null;
  if (!s?.id || !s?.access_token) throw new Error("Die Facebook-Seite „FIAON“ ist für den Meta-Zugang nicht sichtbar.");
  const seite = { pageId: String(s.id), pageToken: String(s.access_token), igId: s.instagram_business_account?.id ? String(s.instagram_business_account.id) : null };
  seiteSpeicher = { bis: Date.now() + 30 * 60_000, seite };
  return seite;
}

// ── Signierte Medien-Adressen (Meta holt die Dateien selbst) ───────────────
function medienSchluessel(): Buffer {
  const s = process.env.META_APP_SECRET;
  if (!s) throw new Error("META_APP_SECRET fehlt — ohne ihn gibt es keine signierten Medien-Adressen.");
  return createHmac("sha256", s).update("fiaon-social-meta-datei-v1").digest();
}
const signatur = (id: number, bis: number) => createHmac("sha256", medienSchluessel()).update(`${id}.${bis}`).digest("hex").slice(0, 40);
/** Öffentliche Adresse einer Studio-Datei, drei Stunden gültig. */
export function medienUrl(dateiId: number, jetztMs = Date.now()): string {
  const bis = Math.floor(jetztMs / 1000) + 3 * 3600;
  return `${SEITE}/api/fiaon/social/meta-datei/${dateiId}?bis=${bis}&sig=${signatur(dateiId, bis)}`;
}
/** Passt die Signatur und ist sie noch gültig? */
export function medienSignaturPruefen(id: number, bisRoh: unknown, sigRoh: unknown, jetztMs = Date.now()): boolean {
  const bis = Number(bisRoh);
  const sig = String(sigRoh ?? "");
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(bis) || bis * 1000 < jetztMs || sig.length !== 40) return false;
  try {
    const soll = Buffer.from(signatur(id, bis));
    return timingSafeEqual(soll, Buffer.from(sig));
  } catch { return false; }
}

// ── Aufträge ───────────────────────────────────────────────────────────────
interface Auftrag {
  id: number; post_id: number; kanal: AutoKanal; fassung: number; zustand: string; container_id: string | null;
  kinder: string[] | null; media_id: string | null; versuche: number; begonnen_am: string; aktualisiert_am: string;
}
const auftragAus = (r: any): Auftrag => ({
  id: Number(r.id), post_id: Number(r.post_id), kanal: r.kanal, fassung: Number(r.fassung), zustand: String(r.zustand),
  container_id: r.container_id ?? null, kinder: Array.isArray(r.kinder) ? r.kinder.map(String) : null, media_id: r.media_id ?? null,
  versuche: Number(r.versuche), begonnen_am: String(r.begonnen_am), aktualisiert_am: String(r.aktualisiert_am),
});

/** Einen Auftrag von einem Zustand in den nächsten — nur, wenn er noch im erwarteten steht (sonst hat ihn ein anderer). */
async function uebergang(id: number, von: string[], nach: string, felder: Partial<Record<"container_id" | "media_id" | "permalink" | "fehler", string | null>> & { kinder?: string[] | null; ki_gesetzt?: boolean | null; fertig?: boolean; versuchPlus?: boolean } = {}): Promise<boolean> {
  const r = (await sqlPool`
    UPDATE fiaon_social_meta_auftraege SET
      zustand = ${nach},
      container_id = ${felder.container_id !== undefined ? felder.container_id : sqlPool`container_id`},
      kinder = ${felder.kinder !== undefined ? (felder.kinder ? sqlPool`${JSON.stringify(felder.kinder)}::text::jsonb` : null) : sqlPool`kinder`},
      media_id = ${felder.media_id !== undefined ? felder.media_id : sqlPool`media_id`},
      permalink = ${felder.permalink !== undefined ? felder.permalink : sqlPool`permalink`},
      ki_gesetzt = ${felder.ki_gesetzt !== undefined ? felder.ki_gesetzt : sqlPool`ki_gesetzt`},
      fehler = ${felder.fehler !== undefined ? felder.fehler : sqlPool`fehler`},
      halter = ${nach === "laeuft" ? sqlPool`halter` : null},
      versuche = versuche + ${felder.versuchPlus ? 1 : 0},
      fertig_am = ${felder.fertig ? sqlPool`NOW()` : sqlPool`fertig_am`},
      aktualisiert_am = NOW()
    WHERE id = ${id} AND zustand = ANY(${von}::text[])
    RETURNING id`) as any[];
  return r.length > 0;
}

/** Die Post-Zeile, wie die Automatik sie braucht. */
async function postLesen(id: number): Promise<any | null> {
  const [r] = (await sqlPool`
    SELECT id, version, fassung, status, format, kanaele, ki_noetig, caption, erster_kommentar, dateien, veroeffentlicht, plattform_ids, plan_zeitpunkt, titel
      FROM fiaon_social_posts WHERE id = ${id}`) as any[];
  return r ?? null;
}
const json = (v: any) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
const dateienAus = (r: any): AutoDatei[] => (Array.isArray(json(r.dateien)) ? json(r.dateien) : []).map((d: any) => ({
  datei_id: Number(d?.datei_id), pos: Number(d?.pos ?? 0), rolle: String(d?.rolle ?? ""), mime: String(d?.mime ?? ""),
})).filter((d: AutoDatei) => Number.isInteger(d.datei_id) && d.datei_id > 0);

// ── Instagram ──────────────────────────────────────────────────────────────
/** Container anlegen. Liefert Container-Id (fertig zum Prüfen) oder Kinder-Ids (Karussell: erst Kinder fertig). */
async function igContainer(g: GraphFn, igId: string, plan: MedienPlan, caption: string, ki: boolean, kinder: string[] | null): Promise<{ container: string | null; kinder: string[] | null }> {
  const kiFeld = ki ? { is_ai_generated: "true" } : {};
  if (plan.art === "bild") {
    const j = await g(`${igId}/media`, { methode: "POST", params: { image_url: medienUrl(plan.bild.datei_id), caption, ...kiFeld } });
    return { container: String(j.id), kinder: null };
  }
  if (plan.art === "reel") {
    const j = await g(`${igId}/media`, { methode: "POST", zeitMs: 60_000, params: {
      media_type: "REELS", video_url: medienUrl(plan.video.datei_id), ...(plan.cover ? { cover_url: medienUrl(plan.cover.datei_id) } : {}),
      caption, share_to_feed: "true", ...kiFeld,
    } });
    return { container: String(j.id), kinder: null };
  }
  // Karussell: erst die Kinder (ohne Text, die KI-Info gehört an den Karussell-Container), dann — wenn alle fertig — der Rahmen.
  if (!kinder) {
    const ids: string[] = [];
    for (const b of plan.bilder) {
      const j = await g(`${igId}/media`, { methode: "POST", params: { image_url: medienUrl(b.datei_id), is_carousel_item: "true" } });
      ids.push(String(j.id));
    }
    return { container: null, kinder: ids };
  }
  for (const k of kinder) {
    const s = await g(k, { params: { fields: "status_code" } });
    if (s?.status_code !== "FINISHED") {
      if (s?.status_code === "ERROR" || s?.status_code === "EXPIRED") throw new Error(`Karussell-Bild ${k}: ${s.status_code}`);
      return { container: null, kinder };
    }
  }
  const j = await g(`${igId}/media`, { methode: "POST", params: { media_type: "CAROUSEL", children: kinder.join(","), caption, ...kiFeld } });
  return { container: String(j.id), kinder };
}

/** Nach einer unklaren Antwort: steht der Beitrag schon im Profil? (Text-Anfang + Zeit) */
async function igSuchen(g: GraphFn, igId: string, caption: string, seitMs: number): Promise<{ id: string; permalink: string | null } | null> {
  const j = await g(`${igId}/media`, { params: { fields: "id,caption,timestamp,permalink", limit: 12 } });
  const anfang = caption.slice(0, 80);
  const m = ((j?.data ?? []) as any[]).find((x) => String(x?.caption ?? "").startsWith(anfang) && Date.parse(String(x?.timestamp)) >= seitMs - 5 * 60_000);
  return m ? { id: String(m.id), permalink: m.permalink ? String(m.permalink) : null } : null;
}

// ── Facebook ───────────────────────────────────────────────────────────────
const fbLink = (u: unknown): string | null => {
  const s = String(u ?? "").trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `https://www.facebook.com${s.startsWith("/") ? "" : "/"}${s}`;
};

/** Facebook in einem Zug: Vorarbeiten (unveröffentlichte Fotos) dürfen wiederholt werden, der Beitrag selbst nur einmal. */
async function fbVorbereiten(g: GraphFn, seite: Seite, plan: MedienPlan): Promise<string[]> {
  if (plan.art !== "karussell") return [];
  const ids: string[] = [];
  for (const b of plan.bilder) {
    const j = await g(`${seite.pageId}/photos`, { methode: "POST", token: seite.pageToken, params: { url: medienUrl(b.datei_id), published: "false" } });
    ids.push(String(j.id));
  }
  return ids;
}
async function fbVeroeffentlichen(g: GraphFn, seite: Seite, plan: MedienPlan, caption: string, fotos: string[]): Promise<{ id: string; permalink: string | null }> {
  let objekt: string;
  if (plan.art === "bild") {
    const j = await g(`${seite.pageId}/photos`, { methode: "POST", token: seite.pageToken, einmal: true, params: { url: medienUrl(plan.bild.datei_id), caption, published: "true" } });
    objekt = String(j.post_id ?? j.id);
  } else if (plan.art === "karussell") {
    const j = await g(`${seite.pageId}/feed`, { methode: "POST", token: seite.pageToken, einmal: true, params: {
      message: caption, attached_media: JSON.stringify(fotos.map((id) => ({ media_fbid: id }))),
    } });
    objekt = String(j.id);
  } else {
    const j = await g(`${seite.pageId}/videos`, { methode: "POST", token: seite.pageToken, einmal: true, zeitMs: 120_000, params: { file_url: medienUrl(plan.video.datei_id), description: caption } });
    objekt = String(j.id);
  }
  let permalink: string | null = null;
  try {
    const p = await g(objekt, { token: seite.pageToken, params: { fields: "permalink_url" } });
    permalink = fbLink(p?.permalink_url);
  } catch { /* der Link kommt beim nächsten Blick — der Beitrag steht */ }
  return { id: objekt, permalink };
}
async function fbSuchen(g: GraphFn, seite: Seite, caption: string, seitMs: number): Promise<{ id: string; permalink: string | null } | null> {
  const j = await g(`${seite.pageId}/feed`, { token: seite.pageToken, params: { fields: "id,message,created_time,permalink_url", limit: 12 } });
  const anfang = caption.slice(0, 80);
  const m = ((j?.data ?? []) as any[]).find((x) => String(x?.message ?? "").startsWith(anfang) && Date.parse(String(x?.created_time)) >= seitMs - 5 * 60_000);
  return m ? { id: String(m.id), permalink: fbLink(m.permalink_url) } : null;
}

// ── Im Studio melden ───────────────────────────────────────────────────────
async function imStudioMelden(postId: number, kanal: AutoKanal, permalink: string, plattformId: string, kiGesetzt: boolean): Promise<string | null> {
  try {
    let p = await postLesen(postId);
    if (!p) return "Post nicht mehr da";
    if (kiGesetzt && p.ki_noetig) {
      await socialAktion(postId, "checkliste", { version: Number(p.version), kanal, punkt: KI_PUNKT, erledigt: true }, AUTOMATIK);
      p = await postLesen(postId);
    }
    await socialAktion(postId, "veroeffentlicht", { version: Number(p.version), kanal, permalink, plattform_id: plattformId }, AUTOMATIK);
    sozialFeedLeeren(); // die Website zeigt den Post beim nächsten Abruf
    return null;
  } catch (e: any) {
    return `Online, aber im Studio nicht gemeldet: ${String(e?.message ?? e).slice(0, 200)}`;
  }
}

// ── Einen Auftrag weiterbringen ────────────────────────────────────────────
/** Ist der Fehler eindeutig (Meta hat abgelehnt) oder unklar (keine/kaputte Antwort)? */
const eindeutig = (e: unknown) => e instanceof MetaFehler && e.code != null && e.status >= 400 && e.status < 500;

async function auftragBearbeiten(g: GraphFn, a: Auftrag, rechte: PostingRechte, kiStopp: boolean, jetztMs: number): Promise<"ok" | "warten" | "fehler" | "unklar" | "abgebrochen"> {
  const p = await postLesen(a.post_id);
  const kanaele = Array.isArray(p?.kanaele) ? p.kanaele.map(String) : [];
  const sicht = p ? { status: p.status, format: p.format, kanaele, ki_noetig: !!p.ki_noetig, veroeffentlicht: json(p.veroeffentlicht), plattform_ids: json(p.plattform_ids) } : null;
  // Der Post hat sich geändert (neue Fassung, zurück an Claude, verworfen) oder ist schon online → nicht posten.
  const nochFrei = !!p && Number(p.fassung) === a.fassung && autoKanaele(sicht!, rechte).includes(a.kanal)
    && (p.status === "freigegeben" || p.status === "eingeplant" || p.status === "veroeffentlicht");
  if (!nochFrei) {
    await uebergang(a.id, ["laeuft", "warten"], "fehler", { fehler: "Abgebrochen: Der Post wurde geändert, verworfen oder ist schon online.", versuchPlus: true });
    await sqlPool`UPDATE fiaon_social_meta_auftraege SET versuche = ${AUTO_HOECHSTVERSUCHE} WHERE id = ${a.id}`;
    return "abgebrochen";
  }
  const ki = !!p.ki_noetig;
  if (a.kanal === "instagram" && ki && kiStopp) {
    await uebergang(a.id, ["laeuft", "warten"], "fehler", { fehler: "KI-Posts sind angehalten: Meta hat die KI-Info zuletzt nicht bestätigt." });
    return "fehler";
  }
  const plan = medienPlan(p.format, dateienAus(p));
  if ("fehler" in plan) {
    await uebergang(a.id, ["laeuft", "warten"], "fehler", { fehler: plan.fehler });
    await sqlPool`UPDATE fiaon_social_meta_auftraege SET versuche = ${AUTO_HOECHSTVERSUCHE} WHERE id = ${a.id}`;
    return "fehler";
  }
  const caption = captionFuerMeta(p.caption, a.kanal);
  const seite = await seiteLesen(g);

  if (a.kanal === "instagram") {
    if (!seite.igId) throw new Error("Mit der Seite „FIAON“ ist kein Instagram-Konto verbunden.");
    let container = a.container_id;
    let kinder = a.kinder;
    // Ein Container verfällt nach 24 h — dann von vorn.
    if (container && jetztMs - Date.parse(a.begonnen_am) > CONTAINER_VERFALL_MS) { container = null; kinder = null; }
    if (!container) {
      const c = await igContainer(g, seite.igId, plan, caption, ki, kinder);
      container = c.container; kinder = c.kinder;
      if (!container) { await uebergang(a.id, ["laeuft"], "warten", { kinder, container_id: null }); return "warten"; }
      await uebergang(a.id, ["laeuft"], "laeuft", { kinder, container_id: container });
    }
    const st = await g(container, { params: { fields: "status_code" } });
    if (st?.status_code === "IN_PROGRESS") { await uebergang(a.id, ["laeuft"], "warten"); return "warten"; }
    if (st?.status_code !== "FINISHED") {
      await uebergang(a.id, ["laeuft"], "fehler", { fehler: `Instagram hat die Datei nicht angenommen (${st?.status_code ?? "ohne Status"}).`, container_id: null, kinder: null });
      return "fehler";
    }
    // Ab hier: veröffentlichen — GENAU EINMAL. Vorher „unklar" setzen: Stirbt der Prozess jetzt, postet niemand nach.
    if (!(await uebergang(a.id, ["laeuft"], "unklar", { fehler: "Veröffentlichen angestoßen" }))) return "abgebrochen";
    const seit = Date.now();
    let mediaId: string;
    try {
      const j = await g(`${seite.igId}/media_publish`, { methode: "POST", einmal: true, zeitMs: 60_000, params: { creation_id: container } });
      mediaId = String(j.id);
    } catch (e) {
      if (eindeutig(e)) {
        await uebergang(a.id, ["unklar"], "fehler", { fehler: `Instagram lehnt ab: ${(e as MetaFehler).klartext}`.slice(0, 500), container_id: null, kinder: null });
        return "fehler";
      }
      const gefunden = await igSuchen(g, seite.igId, caption, seit).catch(() => null);
      if (!gefunden) { await uebergang(a.id, ["unklar"], "unklar", { fehler: `Antwort fehlt, Beitrag nicht gefunden — nicht erneut gepostet. ${String((e as any)?.message ?? e).slice(0, 200)}` }); return "unklar"; }
      mediaId = gefunden.id;
    }
    let permalink: string | null = null;
    let kiGesetzt: boolean | null = null;
    try {
      const m = await g(mediaId, { params: { fields: ki ? "permalink,is_ai_generated" : "permalink" } });
      permalink = m?.permalink ? String(m.permalink) : null;
      if (ki) kiGesetzt = m?.is_ai_generated === true ? true : m?.is_ai_generated === false ? false : null;
    } catch { /* Link fehlt — unten Ersatz */ }
    if (ki && kiGesetzt === false) await einstellungSetzen(KI_STOPP, new Date().toISOString());
    // Erster Kommentar (z. B. der Link) — nur, wenn der Zugang kommentieren darf; ein Fehler hier stört den Post nicht.
    if (p.erster_kommentar && rechte.kommentare) {
      try { await g(`${mediaId}/comments`, { methode: "POST", einmal: true, params: { message: String(p.erster_kommentar).slice(0, 2200) } }); } catch { /* egal */ }
    }
    const link = permalink ?? `https://www.instagram.com/fiaon.ltd/`;
    const meldung = permalink ? await imStudioMelden(a.post_id, "instagram", permalink, mediaId, ki && kiGesetzt !== false) : "Online, aber ohne Link — im Studio nicht gemeldet.";
    const kiHinweis = ki && kiGesetzt === false ? "Meta hat die KI-Info NICHT bestätigt — weitere KI-Posts angehalten." : ki && kiGesetzt === null ? "KI-Info gesetzt, Rückmeldung von Meta fehlt." : null;
    await uebergang(a.id, ["unklar"], "ok", { media_id: mediaId, permalink: link, ki_gesetzt: ki ? kiGesetzt : null, fehler: [meldung, kiHinweis].filter(Boolean).join(" · ") || null, fertig: true });
    return "ok";
  }

  // Facebook
  const fotos = await fbVorbereiten(g, seite, plan);
  if (!(await uebergang(a.id, ["laeuft"], "unklar", { fehler: "Veröffentlichen angestoßen" }))) return "abgebrochen";
  const seit = Date.now();
  let ergebnis: { id: string; permalink: string | null };
  try {
    ergebnis = await fbVeroeffentlichen(g, seite, plan, caption, fotos);
  } catch (e) {
    if (eindeutig(e)) {
      await uebergang(a.id, ["unklar"], "fehler", { fehler: `Facebook lehnt ab: ${(e as MetaFehler).klartext}`.slice(0, 500) });
      return "fehler";
    }
    const gefunden = await fbSuchen(g, seite, caption, seit).catch(() => null);
    if (!gefunden) { await uebergang(a.id, ["unklar"], "unklar", { fehler: `Antwort fehlt, Beitrag nicht gefunden — nicht erneut gepostet. ${String((e as any)?.message ?? e).slice(0, 200)}` }); return "unklar"; }
    ergebnis = gefunden;
  }
  // Der KI-Haken für Facebook gilt durch FB_KI_SATZ am Ende des Beitrags (Justin 15.10.2026).
  const meldung = ergebnis.permalink ? await imStudioMelden(a.post_id, "facebook", ergebnis.permalink, ergebnis.id, ki) : "Online, aber ohne Link — im Studio nicht gemeldet.";
  await uebergang(a.id, ["unklar"], "ok", { media_id: ergebnis.id, permalink: ergebnis.permalink, fehler: meldung, fertig: true });
  return "ok";
}

// ── DER LAUF (alle 5 Minuten) ──────────────────────────────────────────────
export interface PostenErgebnis { zustand: "aus" | "keine_rechte" | "gelaufen"; gepostet: number; wartend: number; fehler: number; unklar: number }

export async function metaPostenLauf(jetzt: Date = new Date(), g: GraphFn = graph): Promise<PostenErgebnis> {
  const leer = (zustand: PostenErgebnis["zustand"]): PostenErgebnis => ({ zustand, gepostet: 0, wartend: 0, fehler: 0, unklar: 0 });
  await ensureSocialTabellen();
  await ensureMetaAutomatikTabellen();
  const schalter = (await einstellung(SCHALTER)) ?? "an";
  if (schalter === "aus") return leer("aus");
  const rechte = await postingRechte(g);
  if (!rechte.instagram && !rechte.facebook) return leer("keine_rechte");

  // Erstes Mal mit Rechten (oder nach dem Not-Aus wieder an): ab JETZT — nichts nachholen.
  let aktivSeit = await einstellung(AKTIV_SEIT);
  if (!aktivSeit) { aktivSeit = jetzt.toISOString(); await einstellungSetzen(AKTIV_SEIT, aktivSeit); }
  const aktivMs = Date.parse(aktivSeit);
  const jetztMs = jetzt.getTime();
  const kiStopp = !!(await einstellung(KI_STOPP));
  const erg = leer("gelaufen");
  const laufKennung = randomBytes(12).toString("hex");

  // 1. Hängengebliebene Aufträge (Absturz vor dem Veröffentlichen) zurück auf „fehler" — „unklar" bleibt unklar.
  await sqlPool`
    UPDATE fiaon_social_meta_auftraege SET zustand = 'fehler', halter = NULL, fehler = 'Hängengeblieben (Neustart) — neuer Versuch.', aktualisiert_am = NOW()
     WHERE zustand = 'laeuft' AND aktualisiert_am < ${new Date(jetztMs - AUFTRAG_HAENGT_MS)}`;

  // 2. Neue fällige Posts: einen Auftrag je Kanal anlegen (der Index verhindert doppelte).
  const faellig = (await sqlPool`
    SELECT id, fassung, status, format, kanaele, ki_noetig, veroeffentlicht, plattform_ids, plan_zeitpunkt
      FROM fiaon_social_posts
     WHERE status IN ('freigegeben', 'eingeplant')
       AND plan_zeitpunkt IS NOT NULL
       AND plan_zeitpunkt <= ${jetzt}
       AND plan_zeitpunkt >= ${new Date(Math.max(jetztMs - AUTO_FENSTER_MS, aktivMs))}
     ORDER BY plan_zeitpunkt, id LIMIT 20`) as any[];
  for (const r of faellig) {
    const sicht = { status: r.status, format: r.format, kanaele: Array.isArray(r.kanaele) ? r.kanaele.map(String) : [], ki_noetig: !!r.ki_noetig, veroeffentlicht: json(r.veroeffentlicht), plattform_ids: json(r.plattform_ids) };
    if (!istFaellig(Date.parse(r.plan_zeitpunkt), jetztMs, aktivMs)) continue;
    for (const k of autoKanaele(sicht, rechte)) {
      await sqlPool`
        INSERT INTO fiaon_social_meta_auftraege (post_id, kanal, fassung) VALUES (${Number(r.id)}, ${k}, ${Number(r.fassung)})
        ON CONFLICT (post_id, kanal, fassung) DO NOTHING`;
    }
  }

  // 3. Gescheiterte (vor dem Veröffentlichen) nach zehn Minuten erneut — höchstens dreimal, höchstens sechs Stunden lang.
  await sqlPool`
    UPDATE fiaon_social_meta_auftraege SET zustand = 'laeuft', halter = NULL, versuche = versuche + 1, aktualisiert_am = NOW()
     WHERE zustand = 'fehler' AND versuche < ${AUTO_HOECHSTVERSUCHE - 1}
       AND aktualisiert_am < NOW() - INTERVAL '10 minutes' AND begonnen_am > NOW() - INTERVAL '6 hours'`;

  // 4. Instagram-Tagesgrenze.
  const [ig24] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_social_meta_auftraege WHERE kanal = 'instagram' AND zustand = 'ok' AND fertig_am > NOW() - INTERVAL '24 hours'`) as any[];
  let igFrei = IG_TAGESGRENZE - Number(ig24?.n ?? 0);

  // 5. Abarbeiten: neue (laeuft, versuche 0), erneute (laeuft) und wartende Container. Jeder Auftrag wird erst „geholt".
  const offen = (await sqlPool`
    SELECT * FROM fiaon_social_meta_auftraege
     WHERE zustand IN ('laeuft', 'warten') AND begonnen_am > NOW() - INTERVAL '26 hours'
     ORDER BY begonnen_am, id LIMIT 20`) as any[];
  for (const roh of offen) {
    const a = auftragAus(roh);
    if (a.kanal === "instagram" && igFrei <= 0) continue;
    // Holen: ein bedingtes UPDATE mit der Kennung dieses Laufs — läuft ein zweiter Server, bekommt nur einer
    // den Auftrag (wartende und frische ohne Halter; ein Halter gilt, bis der Auftrag die Hand verlässt).
    const [geholt] = (await sqlPool`
      UPDATE fiaon_social_meta_auftraege SET zustand = 'laeuft', halter = ${laufKennung}, aktualisiert_am = NOW()
       WHERE id = ${a.id} AND halter IS NULL AND zustand IN ('laeuft', 'warten')
       RETURNING *`) as any[];
    if (!geholt) continue;
    try {
      const r = await auftragBearbeiten(g, auftragAus(geholt), rechte, kiStopp, jetztMs);
      if (r === "ok") { erg.gepostet++; if (a.kanal === "instagram") igFrei--; }
      else if (r === "warten") erg.wartend++;
      else if (r === "unklar") erg.unklar++;
      else if (r === "fehler") erg.fehler++;
    } catch (e: any) {
      erg.fehler++;
      const text = e instanceof MetaFehler ? e.klartext : String(e?.message ?? e);
      await uebergang(a.id, ["laeuft"], "fehler", { fehler: text.slice(0, 500) });
    }
  }
  if (erg.gepostet || erg.fehler || erg.unklar) console.log(`[SOCIAL-META] gepostet ${erg.gepostet}, wartend ${erg.wartend}, Fehler ${erg.fehler}, unklar ${erg.unklar}`);
  return erg;
}

// ── Für das Studio: Stand und Not-Aus ──────────────────────────────────────
export async function metaAutomatikStand(g: GraphFn = graph): Promise<MetaAutomatikStand> {
  await ensureSocialTabellen();
  await ensureMetaAutomatikTabellen();
  const [schalter, aktivSeit, rechte] = await Promise.all([einstellung(SCHALTER), einstellung(AKTIV_SEIT), postingRechte(g)]);
  const naechsteRoh = (await sqlPool`
    SELECT id, titel, plan_zeitpunkt, status, format, kanaele, ki_noetig, veroeffentlicht, plattform_ids FROM fiaon_social_posts
     WHERE status IN ('freigegeben', 'eingeplant') AND plan_zeitpunkt > NOW() ORDER BY plan_zeitpunkt, id LIMIT 10`) as any[];
  let naechster: MetaAutomatikStand["naechster"] = null;
  for (const r of naechsteRoh) {
    const k = autoKanaele({ status: r.status, format: r.format, kanaele: Array.isArray(r.kanaele) ? r.kanaele.map(String) : [], ki_noetig: !!r.ki_noetig, veroeffentlicht: json(r.veroeffentlicht), plattform_ids: json(r.plattform_ids) }, rechte);
    if (k.length) { naechster = { id: Number(r.id), titel: String(r.titel ?? ""), plan_zeitpunkt: new Date(r.plan_zeitpunkt).toISOString(), kanaele: k }; break; }
  }
  const [heute] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_social_meta_auftraege
     WHERE zustand = 'ok' AND (fertig_am AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  const fehler = (await sqlPool`
    SELECT post_id, kanal, fehler, aktualisiert_am FROM fiaon_social_meta_auftraege
     WHERE (zustand IN ('fehler', 'unklar') OR (zustand = 'ok' AND fehler IS NOT NULL)) AND aktualisiert_am > NOW() - INTERVAL '3 days'
     ORDER BY aktualisiert_am DESC LIMIT 5`) as any[];
  const [utm] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ergebnis = 'ok')::int AS ok, COUNT(*) FILTER (WHERE ergebnis = 'fehler')::int AS fehler, MAX(am) AS zuletzt
      FROM fiaon_meta_utm_protokoll`) as any[];
  return {
    ok: true,
    postenAn: (schalter ?? "an") !== "aus",
    rechte,
    aktivSeit: aktivSeit ?? null,
    naechster,
    heuteGepostet: Number(heute?.n ?? 0),
    letzteFehler: fehler.map((f) => ({ post_id: Number(f.post_id), kanal: String(f.kanal), fehler: String(f.fehler ?? ""), am: new Date(f.aktualisiert_am).toISOString() })),
    anzeigen: { geaendert: Number(utm?.ok ?? 0), zuletzt: utm?.zuletzt ? new Date(utm.zuletzt).toISOString() : null, fehler: Number(utm?.fehler ?? 0) },
  };
}

/** Not-Aus im Studio. Wieder an = ab jetzt (nichts aus der Aus-Zeit nachholen); setzt auch den KI-Stopp zurück. */
export async function postenSchalten(an: boolean): Promise<void> {
  await ensureMetaAutomatikTabellen();
  await einstellungSetzen(SCHALTER, an ? "an" : "aus");
  if (an) {
    await einstellungSetzen(AKTIV_SEIT, new Date().toISOString());
    await einstellungSetzen(KI_STOPP, null);
  }
  rechteSpeicher = null;
}

/** Nur für den Prüfstand: gemerkte Rechte und Seite vergessen. */
export function _speicherLeeren(): void { rechteSpeicher = null; seiteSpeicher = null; }
export const _AUTO_FENSTER_MS = AUTO_FENSTER_MS;
