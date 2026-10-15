// ═══════════════════════════════════════════════════════════════════════════
// DER RATGEBER — Tabelle, öffentliche Seiten, Redaktion, Generator (23.08.2026)
//
// Justin: „Blog mit drei hochwertigen Artikeln; im Admin eine Seite, wo jeden
// Tag drei Artikel entstehen; ich schaue drüber (Text, Vorschau), dann wird
// veröffentlicht. Der Generator muss auf uns abgestimmt sein. Ich muss auch
// selbst jederzeit einen Artikel online stellen können — auch fünf am Tag."
//
// E-379 (15.10.2026): Jeden Tag EIN Artikel je Bereich (privat, business), selbst
// recherchiert, geprüft und veröffentlicht — die Redaktion steht in
// server/lib/fiaon-ratgeber-redaktion.ts (Tabelle, Recherche, Schreiben, Tor).
//
// Öffentlich (kein Login):   GET /ratgeber[?bereich=privat|business&sprache=de&limit=n] · GET /ratgeber/:slug
// Redaktion (/admin, Gate):  GET /admin/ratgeber · POST /admin/ratgeber (neu)
//                            POST /admin/ratgeber/generieren {bereich}  → ein Entwurf (im Hintergrund)
//                            POST /admin/ratgeber/tagesartikel          → der Tageslauf sofort (im Hintergrund)
//                            PATCH /admin/ratgeber/:id · POST …/:id/pruefen
//                            POST …/:id/veroeffentlichen · POST …/:id/zurueckziehen
//                            DELETE …/:id
// Alle 30 Minuten, ab 06:00 Berlin: Tagesartikel je Bereich (ratgeberTageslauf, Lauf „ratgeber-tagesartikel“).
// Sitemap:                   sitemapXml() ergänzt die statische Sitemap.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { AUTORIN, BEREICHE, THEMEN, pruefstand, slugify, lesezeitVon, bereichVonKategorie, type Artikel, type Bereich } from "@shared/fiaon-ratgeber";
import { kiPausiert, kiLesenMoeglich } from "../lib/fiaon-ki-pause";
import {
  ensureRatgeberTabelle, zeile, tagesStand, tagesartikelLauf, ratgeberLaufPruefen, entwurfErzeugen, naechsterLauf, faelligerTag,
  RATGEBER_LAUF, MODELL, type TageslaufErgebnis,
} from "../lib/fiaon-ratgeber-redaktion";

export { ensureRatgeberTabelle } from "../lib/fiaon-ratgeber-redaktion";

const router = Router();

const oeffentlich = (a: Artikel) => ({ ...a, pruefung: undefined, modell: undefined, quelle: undefined, quellen: undefined, anlass: undefined, autorin: AUTORIN });
const bereichAus = (v: unknown): Bereich | null => (v === "privat" || v === "business" ? v : null);

// ── Öffentlich ──────────────────────────────────────────────────────────────
router.get("/ratgeber", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const kat = String(req.query.kategorie || "").trim();
    // E-379: ?bereich=privat|business — die Privat-Seite zeigt nur Privates, /business/wissen nur Business.
    const bereich = bereichAus(req.query.bereich);
    const sprache = String(req.query.sprache || "").trim();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 200));
    const rows = (await sqlPool`
      SELECT * FROM fiaon_ratgeber
       WHERE status = 'veroeffentlicht'
         AND (${kat} = '' OR kategorie = ${kat})
         AND (${bereich ?? ""} = '' OR bereich = ${bereich ?? ""})
         AND (${sprache} = '' OR sprache = ${sprache})
       ORDER BY published_at DESC LIMIT ${limit}`) as any[];
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json({ ok: true, artikel: rows.map((r) => { const a = oeffentlich(zeile(r)); return { ...a, inhalt: undefined }; }), autorin: AUTORIN });
  } catch (err) { console.error("[RATGEBER] liste:", err); res.status(500).json({ ok: false, error: "Der Ratgeber ist gerade nicht erreichbar." }); }
});

router.get("/ratgeber/:slug", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const vorschau = req.query.vorschau === "1";
    const [r] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE slug = ${String(req.params.slug)} LIMIT 1`) as any[];
    if (!r || (r.status !== "veroeffentlicht" && !vorschau)) return res.status(404).json({ ok: false, error: "Diesen Ratgeber gibt es nicht." });
    const a = oeffentlich(zeile(r));
    // E-379: Weiterlesen bleibt im Bereich und in der Sprache — ein Unternehmer liest weiter Unternehmerthemen.
    const weitere = (await sqlPool`SELECT slug, titel, teaser, kategorie, land, lesezeit, published_at FROM fiaon_ratgeber
      WHERE status = 'veroeffentlicht' AND slug <> ${a.slug} AND bereich = ${a.bereich} AND sprache = ${String(r.sprache || "de")}
      ORDER BY (kategorie = ${a.kategorie}) DESC, published_at DESC LIMIT 3`) as any[];
    if (!vorschau) res.setHeader("Cache-Control", "public, max-age=120");
    res.json({ ok: true, artikel: a, weitere: weitere.map((w) => ({ slug: w.slug, titel: w.titel, teaser: w.teaser, kategorie: w.kategorie, land: w.land, lesezeit: Number(w.lesezeit), veroeffentlichtAm: w.published_at })) });
  } catch (err) { console.error("[RATGEBER] artikel:", err); res.status(500).json({ ok: false, error: "Der Ratgeber ist gerade nicht erreichbar." }); }
});

// ── Redaktion ───────────────────────────────────────────────────────────────
// Was gerade im Hintergrund läuft (ein Prozess, eine Arbeit): Recherche und Schreiben dauern Minuten — länger,
// als eine Anfrage offen bleiben darf. Die Seite fragt nach (GET /admin/ratgeber → arbeit, letzteArbeit).
let arbeit: { was: "tagesartikel" | "entwurf"; bereich: Bereich | null; seit: string } | null = null;
let letzteArbeit: { was: string; ende: string; ok: boolean; text: string } | null = null;

function imHintergrund(was: "tagesartikel" | "entwurf", bereich: Bereich | null, fn: () => Promise<{ ok: boolean; text: string }>): void {
  arbeit = { was, bereich, seit: new Date().toISOString() };
  void fn()
    .then((r) => { letzteArbeit = { was, ende: new Date().toISOString(), ok: r.ok, text: r.text }; })
    .catch((e: any) => { letzteArbeit = { was, ende: new Date().toISOString(), ok: false, text: String(e?.message || e).slice(0, 300) }; console.error("[RATGEBER] Hintergrund:", e); })
    .finally(() => { arbeit = null; });
}

router.get("/admin/ratgeber", async (_req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const rows = (await sqlPool`SELECT * FROM fiaon_ratgeber ORDER BY (status = 'entwurf') DESC, updated_at DESC LIMIT 500`) as any[];
    // E-379: Der Stand des Tages je Bereich und der nächste Lauf — statt „0 von 40 Themen offen".
    const jetzt = new Date();
    const { tag } = faelligerTag(jetzt);
    const stand = await tagesStand(tag);
    const { REGISTRIERT } = await import("../lib/fiaon-crons");
    const automatik = REGISTRIERT.some((r) => r.name === RATGEBER_LAUF && r.laeuft);
    const [letzter] = (await sqlPool`SELECT begonnen, ergebnis, fehler FROM fiaon_lauf_historie WHERE name = ${RATGEBER_LAUF} ORDER BY begonnen DESC LIMIT 1`.catch(() => [])) as any[];
    const naechster = automatik ? naechsterLauf(jetzt, letzter?.begonnen ? new Date(letzter.begonnen) : null, BEREICHE.every((b) => stand[b].erledigt)) : null;
    res.json({
      ok: true, artikel: rows.map((r) => ({ ...zeile(r), inhalt: undefined, recherche: undefined })),
      heute: { tag, ...stand }, naechsterLauf: naechster ? naechster.toISOString() : null, automatik,
      letzterLauf: letzter ? { am: letzter.begonnen, ergebnis: letzter.ergebnis, fehler: letzter.fehler ? String(letzter.fehler).slice(0, 300) : null } : null,
      arbeit, letzteArbeit, generatorBereit: kiLesenMoeglich(), kiPause: await kiPausiert().catch(() => false), modell: MODELL(), autorin: AUTORIN,
      themenOffen: THEMEN.filter((t) => !rows.some((r) => r.thema_slug === t.slug)).length,
    });
  } catch (err) { console.error("[RATGEBER] admin liste:", err); res.status(500).json({ ok: false, error: "Liste nicht ladbar." }); }
});

router.get("/admin/ratgeber/:id", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const [r] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE id = ${Number(req.params.id)} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    res.json({ ok: true, artikel: zeile(r) });
  } catch (err) { console.error("[RATGEBER] admin artikel:", err); res.status(500).json({ ok: false, error: "Nicht ladbar." }); }
});

/** Neuer Artikel von Hand (leer oder aus einem Thema des Plans). */
router.post("/admin/ratgeber", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const b = req.body || {};
    const thema = b.themaSlug ? THEMEN.find((t) => t.slug === b.themaSlug) : null;
    const titel = String(b.titel || thema?.titel || "Neuer Ratgeber").trim();
    // E-379: Ein neuer Business-Artikel kommt mit ?bereich=business (Kategorie „firmen").
    const kategorie = String(b.kategorie || thema?.kategorie || (b.bereich === "business" ? "firmen" : "grundlagen"));
    let slug = slugify(String(b.slug || thema?.slug || titel));
    const [dup] = (await sqlPool`SELECT 1 FROM fiaon_ratgeber WHERE slug = ${slug}`) as any[];
    if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const [r] = (await sqlPool`
      INSERT INTO fiaon_ratgeber (slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword, schlagworte, faq, meta_titel, meta_beschreibung, lesezeit, status, quelle, thema_slug, bereich)
      VALUES (${slug}, ${titel}, ${b.untertitel ?? null}, ${String(b.teaser || "")}, ${String(b.inhalt || "")}, ${kategorie}, ${String(b.land || thema?.land || "DE")},
              ${String(b.keyword || thema?.keyword || "")}, '[]'::jsonb, '[]'::jsonb, ${String(b.metaTitel || titel).slice(0, 70)}, ${String(b.metaBeschreibung || "")}, ${lesezeitVon(String(b.inhalt || ""))}, 'entwurf', 'hand', ${thema?.slug ?? null}, ${bereichVonKategorie(kategorie)})
      RETURNING *`) as any[];
    res.json({ ok: true, artikel: zeile(r) });
  } catch (err) { console.error("[RATGEBER] neu:", err); res.status(500).json({ ok: false, error: "Anlegen fehlgeschlagen." }); }
});

router.patch("/admin/ratgeber/:id", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const id = Number(req.params.id); const b = req.body || {};
    const [alt] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE id = ${id} LIMIT 1`) as any[];
    if (!alt) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const slug = b.slug ? slugify(String(b.slug)) : alt.slug;
    const inhalt = b.inhalt != null ? String(b.inhalt) : alt.inhalt;
    const [r] = (await sqlPool`
      UPDATE fiaon_ratgeber SET
        slug = ${slug}, titel = ${b.titel != null ? String(b.titel) : alt.titel}, untertitel = ${b.untertitel !== undefined ? b.untertitel : alt.untertitel},
        teaser = ${b.teaser != null ? String(b.teaser) : alt.teaser}, inhalt = ${inhalt},
        kategorie = ${b.kategorie || alt.kategorie}, land = ${b.land || alt.land}, keyword = ${b.keyword != null ? String(b.keyword) : alt.keyword},
        bereich = ${bereichVonKategorie(b.kategorie || alt.kategorie)},
        schlagworte = ${JSON.stringify(b.schlagworte ?? zeile(alt).schlagworte)}::text::jsonb, faq = ${JSON.stringify(b.faq ?? zeile(alt).faq)}::text::jsonb,
        meta_titel = ${b.metaTitel != null ? String(b.metaTitel) : alt.meta_titel}, meta_beschreibung = ${b.metaBeschreibung != null ? String(b.metaBeschreibung) : alt.meta_beschreibung},
        lesezeit = ${lesezeitVon(inhalt)}, updated_at = NOW()
      WHERE id = ${id} RETURNING *`) as any[];
    res.json({ ok: true, artikel: zeile(r) });
  } catch (err: any) {
    console.error("[RATGEBER] patch:", err);
    res.status(500).json({ ok: false, error: /unique/i.test(String(err?.message)) ? "Diese Adresse (Slug) gibt es schon." : "Speichern fehlgeschlagen." });
  }
});

router.post("/admin/ratgeber/:id/pruefen", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const [r] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE id = ${Number(req.params.id)} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const a = zeile(r); const p = pruefstand(a, { bereich: a.bereich });
    const status = a.status === "veroeffentlicht" ? a.status : p.ok ? "geprueft" : "entwurf";
    await sqlPool`UPDATE fiaon_ratgeber SET pruefung = ${JSON.stringify(p)}::text::jsonb, status = ${status}, updated_at = NOW() WHERE id = ${a.id}`;
    res.json({ ok: true, pruefung: p, status });
  } catch (err) { console.error("[RATGEBER] pruefen:", err); res.status(500).json({ ok: false, error: "Prüfung fehlgeschlagen." }); }
});

/** Veröffentlichen — jederzeit, beliebig viele. Der Prüfstand warnt, blockiert aber nur bei Fehlern (verbotene Wörter, zu kurz). */
router.post("/admin/ratgeber/:id/veroeffentlichen", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const [r] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE id = ${Number(req.params.id)} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const a = zeile(r); const p = pruefstand(a, { bereich: a.bereich });
    if (!p.ok && !req.body?.trotzdem) return res.status(409).json({ ok: false, error: "Der Prüfstand meldet Fehler. Bitte beheben – oder bewusst „trotzdem veröffentlichen“.", pruefung: p });
    await sqlPool`UPDATE fiaon_ratgeber SET status = 'veroeffentlicht', pruefung = ${JSON.stringify(p)}::text::jsonb, published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ${a.id}`;
    res.json({ ok: true, url: `/ratgeber/${a.slug}` });
  } catch (err) { console.error("[RATGEBER] veroeffentlichen:", err); res.status(500).json({ ok: false, error: "Veröffentlichen fehlgeschlagen." }); }
});

router.post("/admin/ratgeber/:id/zurueckziehen", async (req: Request, res: Response) => {
  try {
    await sqlPool`UPDATE fiaon_ratgeber SET status = 'archiv', updated_at = NOW() WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) { console.error("[RATGEBER] zurueckziehen:", err); res.status(500).json({ ok: false, error: "Fehlgeschlagen." }); }
});

router.delete("/admin/ratgeber/:id", async (req: Request, res: Response) => {
  try {
    await sqlPool`DELETE FROM fiaon_ratgeber WHERE id = ${Number(req.params.id)} AND status <> 'veroeffentlicht'`;
    res.json({ ok: true });
  } catch (err) { console.error("[RATGEBER] loeschen:", err); res.status(500).json({ ok: false, error: "Löschen fehlgeschlagen." }); }
});

// ── Der Generator (E-379: server/lib/fiaon-ratgeber-redaktion.ts) ───────────
/** „Entwurf erzeugen": ein Artikel im gewählten Bereich, recherchiert und geprüft — bleibt Entwurf (geprüft), bis jemand veröffentlicht. */
router.post("/admin/ratgeber/generieren", async (req: Request, res: Response) => {
  if (arbeit) return res.status(409).json({ ok: false, error: "Die Redaktion schreibt gerade — bitte warten, bis sie fertig ist." });
  if (!kiLesenMoeglich()) return res.status(503).json({ ok: false, error: "Kein KI-Schlüssel gesetzt." });
  if (await kiPausiert().catch(() => false)) return res.status(503).json({ ok: false, error: "Die KI ist pausiert (Chefbüro › Mara-Steuerpult)." });
  const bereich = bereichAus(req.body?.bereich) ?? "privat";
  imHintergrund("entwurf", bereich, async () => {
    const a = await entwurfErzeugen(bereich);
    return { ok: !!a.pruefung?.ok, text: `${a.titel}${a.pruefung?.ok ? " — Prüfstand ok" : " — Prüfstand meldet Fehler"}` };
  });
  res.status(202).json({ ok: true, gestartet: true });
});

/** „Tagesartikel jetzt": der Tageslauf sofort — durch dieselbe Sperre und Historie wie der Takt (laufMitHistorie). */
router.post("/admin/ratgeber/tagesartikel", async (_req: Request, res: Response) => {
  if (arbeit) return res.status(409).json({ ok: false, error: "Die Redaktion schreibt gerade — bitte warten, bis sie fertig ist." });
  imHintergrund("tagesartikel", null, async () => {
    const { laufMitHistorie, laufMeldung } = await import("../lib/fiaon-crons");
    let erg: TageslaufErgebnis | null = null;
    const l = await laufMitHistorie(RATGEBER_LAUF, async () => { erg = await tagesartikelLauf({ sofort: true }); return ratgeberLaufPruefen(erg); }, { meldung: (e) => laufMeldung(RATGEBER_LAUF, e) });
    const e = erg as TageslaufErgebnis | null;
    if (!l.gelaufen && !e) return { ok: false, text: l.grund === "läuft bereits" ? "Der Tageslauf läuft schon." : String(l.grund || "nicht gelaufen") };
    return { ok: !!e && e.fehlt.length === 0, text: e ? (e.fehlt.length ? `Es fehlt noch: ${e.fehlt.join(", ")} — ${e.grund ?? ""}` : e.veroeffentlicht ? `${e.veroeffentlicht} veröffentlicht` : "Heute ist schon alles erschienen.") : String(l.grund || "") };
  });
  res.status(202).json({ ok: true, gestartet: true });
});

/** Der Takt (server/routes.ts, alle 30 Minuten): der Tageslauf. Wirft nicht — siehe ratgeberLaufPruefen für die Historie. */
export async function ratgeberTageslauf(): Promise<TageslaufErgebnis> {
  return tagesartikelLauf();
}

/** Der Takt als Lauf mit Wahrheit: Fehlt ein Artikel, ist es KEIN Erfolg (Historie „fehler", Ampel). */
export async function ratgeberTageslaufStreng(): Promise<ReturnType<typeof ratgeberLaufPruefen>> {
  return ratgeberLaufPruefen(await tagesartikelLauf());
}

/** Die Sitemap — statische Seiten plus alle veröffentlichten Ratgeber. */
export async function sitemapXml(statisch: string): Promise<string> {
  try {
    await ensureRatgeberTabelle();
    const rows = (await sqlPool`SELECT slug, updated_at FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY published_at DESC`) as any[];
    const extra = [`  <url><loc>https://fiaon.com/ratgeber</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      ...rows.map((r) => `  <url><loc>https://fiaon.com/ratgeber/${r.slug}</loc><lastmod>${new Date(r.updated_at).toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`)].join("\n");
    return statisch.replace("</urlset>", `${extra}\n</urlset>`);
  } catch { return statisch; }
}

export default router;
