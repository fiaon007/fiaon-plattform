// ═══════════════════════════════════════════════════════════════════════════
// META-AUTOMATIK — die Regeln (15.10.2026, E-380)
//
// Justin (15.10.2026): „mach mit META die gesamte Verbindung und Rechte so, dass
// auch die Posts automatisch gehen … es muss einfach automatisiert erfolgen, auch
// das Posten auf Insta und Facebook" und „achte dabei, dass wir nichts kaputt
// machen". Zwei Automatiken, beide hier als reine Regeln (Prüfstand pruef-e380):
//
//   1. POSTEN (server/lib/fiaon-social-meta.ts): Ein freigegebener Post aus dem
//      Social-Studio geht zu seiner Planzeit auf Instagram und auf die
//      Facebook-Seite — von selbst, sobald der Meta-Zugang das Posten erlaubt.
//   2. ANZEIGEN-PARAMETER (server/lib/fiaon-meta-utm.ts): Jede laufende Anzeige,
//      die auf die Website führt, bekommt einmal die utm-Parameter — damit
//      Chefbüro › Besucher Kampagne, Anzeigengruppe und Anzeige kennt.
//
// ── WAS NICHT KAPUTTGEHEN DARF (die Leitplanken) ───────────────────────────
//   · Kein Nachholen: Gepostet wird nur, was nach dem Einschalten der Automatik
//     fällig wird und höchstens zwei Stunden alt ist. Die 22 freigegebenen
//     Launch-Posts mit vergangenem Plantag (teils schon von Hand gepostet, nur
//     nicht gemeldet) gehen NIE automatisch raus.
//   · Nie doppelt: ein Auftrag je Post, Kanal und Fassung (eindeutiger Index);
//     „media_publish" wird nie wiederholt — ist die Antwort unklar, wird im Profil
//     nachgesehen statt neu gepostet.
//   · KI-Pflicht (Art. 50 KI-VO, Meta-Regel): Instagram setzt die KI-Info über
//     die Schnittstelle (is_ai_generated, seit 22.06.2026). Für Facebook-Seiten
//     gibt es kein belegtes Feld — dort steht am Ende JEDES Beitrags Justins Satz
//     FB_KI_SATZ (Justin 15.10.2026: „es reicht, wenn wir am Ende jedes Beitrages
//     stehen haben: Bild und Textmaterial teilweise mit KI erstellt").
//   · Ein Not-Aus im Social-Studio; ohne Posting-Rechte passiert gar nichts.
// ═══════════════════════════════════════════════════════════════════════════

/** Rechte, die der Meta-Zugang zum Posten braucht (debug_token → scopes). */
export const IG_RECHTE = ["instagram_basic", "instagram_content_publish"] as const;
export const FB_RECHTE = ["pages_manage_posts"] as const;

/** Wie alt darf eine Planzeit höchstens sein, damit die Automatik noch postet? */
export const AUTO_FENSTER_MS = 2 * 3_600_000;
/** Instagram erlaubt 100 API-Posts je 24 h — wir bleiben weit darunter. */
export const IG_TAGESGRENZE = 25;
/** Ein Auftrag, der so lange „läuft", ist hängengeblieben (Absturz, Neustart). */
export const AUFTRAG_HAENGT_MS = 30 * 60_000;
/** Ein Instagram-Container verfällt nach 24 h — danach neu anlegen statt warten. */
export const CONTAINER_VERFALL_MS = 23 * 3_600_000;
/** So oft versucht die Automatik einen Kanal, bevor sie aufgibt (Fehler bleibt sichtbar). */
export const AUTO_HOECHSTVERSUCHE = 3;

/** Steht am Ende jedes automatischen Facebook-Beitrags — Justins Wortlaut (15.10.2026). */
export const FB_KI_SATZ = "(Bild und Textmaterial teilweise mit KI erstellt)";

export const AUTO_KANAELE = ["instagram", "facebook"] as const;
export type AutoKanal = (typeof AUTO_KANAELE)[number];
export const AUTO_FORMATE = ["bild", "karussell", "reel"] as const;

export interface PostingRechte { instagram: boolean; facebook: boolean; kommentare: boolean }

/** Aus den Scopes des Tokens: was darf die Automatik? */
export function rechteAusScopes(scopes: readonly string[] | null | undefined): PostingRechte {
  const s = new Set((scopes ?? []).map(String));
  return {
    instagram: IG_RECHTE.every((r) => s.has(r)),
    facebook: FB_RECHTE.every((r) => s.has(r)),
    kommentare: s.has("instagram_manage_comments"),
  };
}

/** Ist ein Post jetzt fällig? Nie vor der Planzeit, nie älter als das Fenster, nie vor dem Einschalten. */
export function istFaellig(planMs: number | null, jetztMs: number, aktivSeitMs: number | null): boolean {
  if (planMs == null || !Number.isFinite(planMs) || aktivSeitMs == null) return false;
  return planMs <= jetztMs && planMs >= Math.max(jetztMs - AUTO_FENSTER_MS, aktivSeitMs);
}

export interface AutoPostSicht {
  status: string;
  format: string;
  kanaele: readonly string[];
  ki_noetig: boolean;
  veroeffentlicht?: Record<string, unknown> | null;
  plattform_ids?: Record<string, unknown> | null;
}

/** Warum ein Kanal NICHT automatisch geht — oder null, wenn er geht. Reine Regel, für Anzeige und Lauf. */
export function kanalSperre(p: AutoPostSicht, kanal: AutoKanal, rechte: PostingRechte): string | null {
  if (!p.kanaele.includes(kanal)) return "kein Kanal dieses Posts";
  if (!(p.status === "freigegeben" || p.status === "eingeplant" || p.status === "veroeffentlicht")) return "nicht freigegeben";
  if (!(AUTO_FORMATE as readonly string[]).includes(p.format)) return `Format „${p.format}“ geht nur von Hand`;
  if (p.veroeffentlicht && (p.veroeffentlicht as any)[kanal]) return "schon veröffentlicht";
  if (p.plattform_ids && (p.plattform_ids as any)[kanal]) return "schon veröffentlicht";
  if (kanal === "instagram" && !rechte.instagram) return "Meta erlaubt das Posten noch nicht";
  if (kanal === "facebook" && !rechte.facebook) return "Meta erlaubt das Posten noch nicht";
  return null;
}

/** Die Kanäle, die die Automatik für diesen Post übernimmt. */
export function autoKanaele(p: AutoPostSicht, rechte: PostingRechte): AutoKanal[] {
  return AUTO_KANAELE.filter((k) => kanalSperre(p, k, rechte) === null);
}

export interface AutoDatei { datei_id: number; pos: number; rolle: string; mime: string }
export type MedienPlan =
  | { art: "bild"; bild: AutoDatei }
  | { art: "karussell"; bilder: AutoDatei[] }
  | { art: "reel"; video: AutoDatei; cover: AutoDatei | null };

/** Welche Dateien gehen wohin? Instagram nimmt nur JPEG und MP4; ein Karussell hat 2–10 Bilder. */
export function medienPlan(format: string, dateien: readonly AutoDatei[]): MedienPlan | { fehler: string } {
  const nach = (rolle: string) => dateien.filter((d) => d.rolle === rolle).slice().sort((a, b) => a.pos - b.pos);
  const bilder = nach("bild").filter((d) => d.mime === "image/jpeg");
  if (format === "bild") {
    if (!bilder.length) return { fehler: "Kein JPEG-Bild am Post." };
    return { art: "bild", bild: bilder[0] };
  }
  if (format === "karussell") {
    if (bilder.length < 2) return { fehler: "Ein Karussell braucht mindestens zwei JPEG-Bilder." };
    if (bilder.length > 10) return { fehler: "Instagram nimmt höchstens zehn Bilder je Karussell." };
    return { art: "karussell", bilder };
  }
  if (format === "reel") {
    const video = nach("video").find((d) => d.mime === "video/mp4");
    if (!video) return { fehler: "Kein MP4-Video am Post." };
    const cover = nach("cover").find((d) => d.mime === "image/jpeg") ?? null;
    return { art: "reel", video, cover };
  }
  return { fehler: `Format „${format}“ geht nur von Hand.` };
}

/**
 * Die Bildunterschrift so, wie sie im Studio steht (Hashtags stehen schon darin); höchstens 2.200 Zeichen.
 * Facebook: am Ende immer FB_KI_SATZ — gekürzt wird vorher der Text, nie der Satz.
 */
export function captionFuerMeta(caption: string | null | undefined, kanal: AutoKanal = "instagram"): string {
  const text = String(caption ?? "").replace(/\r\n/g, "\n").trim();
  if (kanal !== "facebook") return text.slice(0, 2200);
  if (text.endsWith(FB_KI_SATZ)) return text.slice(-2200);
  return `${text.slice(0, 2200 - FB_KI_SATZ.length - 2)}\n\n${FB_KI_SATZ}`.trim();
}

// ── ANZEIGEN-PARAMETER ─────────────────────────────────────────────────────
/**
 * Die Parameter für jede Website-Anzeige. Meta setzt die {{…}} beim Klick ein.
 * Die Kostenzuordnung (fiaon-meta-kosten) liest utm_id, Chefbüro › Besucher den Namen.
 */
export const UTM_TAGS = "utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_id={{campaign.id}}&utm_term={{adset.name}}&utm_content={{ad.name}}";
/** Höchstens so viele Anzeigen je Lauf — eine neue Fassung schickt die Anzeige erneut in Metas Prüfung. */
export const UTM_JE_LAUF = 5;

export interface AnzeigeSicht {
  id: string;
  effective_status?: string;
  adset?: { effective_status?: string; end_time?: string | null; destination_type?: string | null } | null;
  creative?: {
    id?: string; url_tags?: string | null; object_story_id?: string | null;
    object_story_spec?: any; asset_feed_spec?: any; degrees_of_freedom_spec?: any; contextual_multi_ads?: any;
    instagram_user_id?: string | null; link_url?: string | null;
  } | null;
}

/** Führt die Anzeige auf unsere Website? Lead-Formulare, Profilbesuche und Nachrichten nicht. */
function fuehrtAufWebsite(a: AnzeigeSicht): boolean {
  const ziel = String(a.adset?.destination_type ?? "").toUpperCase();
  const spec = a.creative?.object_story_spec ?? {};
  const cta = spec?.link_data?.call_to_action?.value ?? spec?.video_data?.call_to_action?.value ?? {};
  if (cta?.lead_gen_form_id) return false;
  if (ziel === "WEBSITE") return true;
  if (ziel && ziel !== "UNDEFINED") return false; // ON_AD, INSTAGRAM_PROFILE, MESSENGER, WHATSAPP …
  const link = String(spec?.link_data?.link ?? spec?.video_data?.call_to_action?.value?.link ?? a.creative?.link_url ?? "");
  return /^https:\/\/([a-z0-9-]+\.)?fiaon\.com(\/|$)/i.test(link);
}

/** Bekommt diese Anzeige jetzt die Parameter? null = ja, sonst der Grund dagegen. */
export function utmSperre(a: AnzeigeSicht, jetztMs: number): string | null {
  if (a.effective_status !== "ACTIVE") return "läuft nicht";
  if (a.adset?.effective_status && a.adset.effective_status !== "ACTIVE") return "Anzeigengruppe läuft nicht";
  const ende = a.adset?.end_time ? Date.parse(a.adset.end_time) : NaN;
  if (Number.isFinite(ende) && ende <= jetztMs) return "Anzeigengruppe beendet";
  if (!a.creative?.id) return "keine Anzeigenfassung";
  if (/utm_campaign=/.test(String(a.creative.url_tags ?? ""))) return "hat schon Parameter";
  if (!fuehrtAufWebsite(a)) return "führt nicht auf die Website";
  if (!a.creative.object_story_id && !a.creative.object_story_spec) return "Anzeigenfassung ohne Beitrag/Inhalt";
  return null;
}

/** Die neue Anzeigenfassung: derselbe Inhalt, dazu die Parameter. Nur Felder, die Meta beim Anlegen nimmt. */
export function fassungMitTags(c: NonNullable<AnzeigeSicht["creative"]>, name: string): Record<string, string> {
  const p: Record<string, string> = { name: `${name} · utm`.slice(0, 250), url_tags: UTM_TAGS };
  if (c.object_story_id) {
    p.object_story_id = c.object_story_id;
    if (c.instagram_user_id) p.instagram_user_id = c.instagram_user_id;
    if (c.asset_feed_spec) p.asset_feed_spec = JSON.stringify(c.asset_feed_spec);
  } else {
    p.object_story_spec = JSON.stringify(c.object_story_spec);
    if (c.asset_feed_spec) p.asset_feed_spec = JSON.stringify(c.asset_feed_spec);
  }
  if (c.degrees_of_freedom_spec) p.degrees_of_freedom_spec = JSON.stringify(c.degrees_of_freedom_spec);
  if (c.contextual_multi_ads) p.contextual_multi_ads = JSON.stringify(c.contextual_multi_ads);
  return p;
}

// ── DIE ANZEIGE IM STUDIO ──────────────────────────────────────────────────
export interface MetaAutomatikStand {
  ok: true;
  /** Not-Aus: Justin kann das automatische Posten anhalten. */
  postenAn: boolean;
  rechte: PostingRechte;
  /** Seit wann postet die Automatik (null = noch nie mit Rechten gelaufen). */
  aktivSeit: string | null;
  naechster: { id: number; titel: string; plan_zeitpunkt: string; kanaele: AutoKanal[] } | null;
  heuteGepostet: number;
  letzteFehler: { post_id: number; kanal: string; fehler: string; am: string }[];
  anzeigen: { geaendert: number; zuletzt: string | null; fehler: number };
}
