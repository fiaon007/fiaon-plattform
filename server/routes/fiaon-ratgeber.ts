// ═══════════════════════════════════════════════════════════════════════════
// DER RATGEBER — Tabelle, öffentliche Seiten, Redaktion, Generator (23.08.2026)
//
// Justin: „Blog mit drei hochwertigen Artikeln; im Admin eine Seite, wo jeden
// Tag drei Artikel entstehen; ich schaue drüber (Text, Vorschau), dann wird
// veröffentlicht. Der Generator muss auf uns abgestimmt sein. Ich muss auch
// selbst jederzeit einen Artikel online stellen können — auch fünf am Tag."
//
// Öffentlich (kein Login):   GET /ratgeber · GET /ratgeber/:slug
// Redaktion (/admin, Gate):  GET /admin/ratgeber · POST /admin/ratgeber (neu)
//                            POST /admin/ratgeber/generieren {anzahl}
//                            PATCH /admin/ratgeber/:id · POST …/:id/pruefen
//                            POST …/:id/veroeffentlichen · POST …/:id/zurueckziehen
//                            DELETE …/:id
// Täglich 06:00 Berlin:      drei Entwürfe aus dem Themenplan (nur, wenn heute
//                            noch keine entstanden sind) — Justin prüft sie.
// Sitemap:                   sitemapXml() ergänzt die statische Sitemap.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { AUTORIN, HAUSSTIL, THEMEN, pruefstand, slugify, lesezeitVon, type Artikel } from "@shared/fiaon-ratgeber";
import { START_ARTIKEL } from "../lib/fiaon-ratgeber-start";
import { START_ARTIKEL_2 } from "../lib/fiaon-ratgeber-start-2";
import { INSIDER_ARTIKEL } from "../lib/fiaon-ratgeber-insider";

const router = Router();
let tabelleDa = false;

export async function ensureRatgeberTabelle(): Promise<void> {
  if (tabelleDa) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_ratgeber (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      titel TEXT NOT NULL,
      untertitel TEXT,
      teaser TEXT NOT NULL DEFAULT '',
      inhalt TEXT NOT NULL DEFAULT '',
      kategorie TEXT NOT NULL DEFAULT 'grundlagen',
      land TEXT NOT NULL DEFAULT 'DE',
      keyword TEXT NOT NULL DEFAULT '',
      schlagworte JSONB NOT NULL DEFAULT '[]'::jsonb,
      faq JSONB NOT NULL DEFAULT '[]'::jsonb,
      meta_titel TEXT NOT NULL DEFAULT '',
      meta_beschreibung TEXT NOT NULL DEFAULT '',
      lesezeit INTEGER NOT NULL DEFAULT 6,
      status TEXT NOT NULL DEFAULT 'entwurf',
      quelle TEXT NOT NULL DEFAULT 'hand',
      modell TEXT,
      pruefung JSONB,
      thema_slug TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_ratgeber_status_idx ON fiaon_ratgeber (status, published_at DESC)`;
  // Die drei Startartikel — einmalig, von Hand geschrieben, sofort veröffentlicht.
  for (const a of [...START_ARTIKEL, ...START_ARTIKEL_2, ...INSIDER_ARTIKEL]) {
    const p = pruefstand({ titel: a.titel, teaser: a.teaser, inhalt: a.inhalt, faq: a.faq, metaTitel: a.metaTitel, metaBeschreibung: a.metaBeschreibung, keyword: a.keyword });
    await sqlPool`
      INSERT INTO fiaon_ratgeber (slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword, schlagworte, faq, meta_titel, meta_beschreibung, lesezeit, status, quelle, pruefung, thema_slug, published_at)
      VALUES (${a.slug}, ${a.titel}, ${a.untertitel}, ${a.teaser}, ${a.inhalt}, ${a.kategorie}, ${a.land}, ${a.keyword}, ${JSON.stringify(a.schlagworte)}::jsonb, ${JSON.stringify(a.faq)}::jsonb,
              ${a.metaTitel}, ${a.metaBeschreibung}, ${lesezeitVon(a.inhalt)}, 'veroeffentlicht', 'hand', ${JSON.stringify(p)}::jsonb, ${a.slug}, NOW())
      ON CONFLICT (slug) DO NOTHING`;
  }
  tabelleDa = true;
}

function zeile(r: any): Artikel {
  const j = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
  return {
    id: Number(r.id), slug: r.slug, titel: r.titel, untertitel: r.untertitel ?? null, teaser: r.teaser || "", inhalt: r.inhalt || "",
    kategorie: r.kategorie, land: r.land, keyword: r.keyword || "", schlagworte: j(r.schlagworte) || [], faq: j(r.faq) || [],
    metaTitel: r.meta_titel || "", metaBeschreibung: r.meta_beschreibung || "", lesezeit: Number(r.lesezeit || 6),
    status: r.status, quelle: r.quelle, modell: r.modell ?? null, pruefung: r.pruefung ? j(r.pruefung) : null,
    erstelltAm: r.created_at, aktualisiertAm: r.updated_at, veroeffentlichtAm: r.published_at ?? null,
  };
}
const oeffentlich = (a: Artikel) => ({ ...a, pruefung: undefined, modell: undefined, quelle: undefined, autorin: AUTORIN });

// ── Öffentlich ──────────────────────────────────────────────────────────────
router.get("/ratgeber", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const kat = String(req.query.kategorie || "").trim();
    const rows = (kat
      ? await sqlPool`SELECT * FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' AND kategorie = ${kat} ORDER BY published_at DESC LIMIT 200`
      : await sqlPool`SELECT * FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY published_at DESC LIMIT 200`) as any[];
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
    const weitere = (await sqlPool`SELECT slug, titel, teaser, kategorie, land, lesezeit, published_at FROM fiaon_ratgeber
      WHERE status = 'veroeffentlicht' AND slug <> ${a.slug} ORDER BY (kategorie = ${a.kategorie}) DESC, published_at DESC LIMIT 3`) as any[];
    if (!vorschau) res.setHeader("Cache-Control", "public, max-age=120");
    res.json({ ok: true, artikel: a, weitere: weitere.map((w) => ({ slug: w.slug, titel: w.titel, teaser: w.teaser, kategorie: w.kategorie, land: w.land, lesezeit: Number(w.lesezeit), veroeffentlichtAm: w.published_at })) });
  } catch (err) { console.error("[RATGEBER] artikel:", err); res.status(500).json({ ok: false, error: "Der Ratgeber ist gerade nicht erreichbar." }); }
});

// ── Redaktion ───────────────────────────────────────────────────────────────
router.get("/admin/ratgeber", async (_req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const rows = (await sqlPool`SELECT * FROM fiaon_ratgeber ORDER BY (status = 'entwurf') DESC, updated_at DESC LIMIT 500`) as any[];
    const benutzt = new Set(rows.map((r) => r.thema_slug).filter(Boolean));
    const heute = rows.filter((r) => r.quelle === "ki" && new Date(r.created_at).toDateString() === new Date().toDateString()).length;
    res.json({ ok: true, artikel: rows.map((r) => ({ ...zeile(r), inhalt: undefined })), themenOffen: THEMEN.filter((t) => !benutzt.has(t.slug)).length, themenGesamt: THEMEN.length, heuteErzeugt: heute, generatorBereit: !!process.env.OPENAI_API_KEY, autorin: AUTORIN });
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
    let slug = slugify(String(b.slug || thema?.slug || titel));
    const [dup] = (await sqlPool`SELECT 1 FROM fiaon_ratgeber WHERE slug = ${slug}`) as any[];
    if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const [r] = (await sqlPool`
      INSERT INTO fiaon_ratgeber (slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword, schlagworte, faq, meta_titel, meta_beschreibung, lesezeit, status, quelle, thema_slug)
      VALUES (${slug}, ${titel}, ${b.untertitel ?? null}, ${String(b.teaser || "")}, ${String(b.inhalt || "")}, ${String(b.kategorie || thema?.kategorie || "grundlagen")}, ${String(b.land || thema?.land || "DE")},
              ${String(b.keyword || thema?.keyword || "")}, '[]'::jsonb, '[]'::jsonb, ${String(b.metaTitel || titel).slice(0, 70)}, ${String(b.metaBeschreibung || "")}, ${lesezeitVon(String(b.inhalt || ""))}, 'entwurf', 'hand', ${thema?.slug ?? null})
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
        schlagworte = ${b.schlagworte ? JSON.stringify(b.schlagworte) : alt.schlagworte}::jsonb, faq = ${b.faq ? JSON.stringify(b.faq) : alt.faq}::jsonb,
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
    const a = zeile(r); const p = pruefstand(a);
    const status = a.status === "veroeffentlicht" ? a.status : p.ok ? "geprueft" : "entwurf";
    await sqlPool`UPDATE fiaon_ratgeber SET pruefung = ${JSON.stringify(p)}::jsonb, status = ${status}, updated_at = NOW() WHERE id = ${a.id}`;
    res.json({ ok: true, pruefung: p, status });
  } catch (err) { console.error("[RATGEBER] pruefen:", err); res.status(500).json({ ok: false, error: "Prüfung fehlgeschlagen." }); }
});

/** Veröffentlichen — jederzeit, beliebig viele. Der Prüfstand warnt, blockiert aber nur bei Fehlern (verbotene Wörter, zu kurz). */
router.post("/admin/ratgeber/:id/veroeffentlichen", async (req: Request, res: Response) => {
  try {
    await ensureRatgeberTabelle();
    const [r] = (await sqlPool`SELECT * FROM fiaon_ratgeber WHERE id = ${Number(req.params.id)} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    const a = zeile(r); const p = pruefstand(a);
    if (!p.ok && !req.body?.trotzdem) return res.status(409).json({ ok: false, error: "Der Prüfstand meldet Fehler. Bitte beheben – oder bewusst „trotzdem veröffentlichen“.", pruefung: p });
    await sqlPool`UPDATE fiaon_ratgeber SET status = 'veroeffentlicht', pruefung = ${JSON.stringify(p)}::jsonb, published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = ${a.id}`;
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

// ── Der Generator ───────────────────────────────────────────────────────────
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    titel: { type: "string" }, untertitel: { type: "string" }, teaser: { type: "string" },
    inhalt: { type: "string", description: "Der Artikel in Markdown (## und ### Überschriften, Listen, ggf. eine Tabelle), 1500–2000 Wörter" },
    faq: { type: "array", minItems: 5, maxItems: 6, items: { type: "object", additionalProperties: false, properties: { frage: { type: "string" }, antwort: { type: "string" } }, required: ["frage", "antwort"] } },
    metaTitel: { type: "string" }, metaBeschreibung: { type: "string" },
    schlagworte: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } },
  },
  required: ["titel", "untertitel", "teaser", "inhalt", "faq", "metaTitel", "metaBeschreibung", "schlagworte"],
} as const;

async function artikelErzeugen(thema: (typeof THEMEN)[number]): Promise<{ daten: any; modell: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY fehlt.");
  const modell = process.env.FIAON_RATGEBER_MODELL || "gpt-4.1";
  const auftrag = `Schreibe den Ratgeber-Artikel zum Thema:
Titel (Vorschlag, darf leicht verbessert werden): ${thema.titel}
Haupt-Keyword: ${thema.keyword}
Land: ${thema.land === "DACH" ? "Deutschland, Österreich, Schweiz" : thema.land === "AT" ? "Österreich (KSV1870, CRIF, Datenschutzbehörde Wien)" : thema.land === "CH" ? "Schweiz (CRIF, Intrum, DSG, Betreibungsauszug)" : "Deutschland (SCHUFA)"}
Kategorie: ${thema.kategorie}
Fokus: ${thema.fokus}
Autorin (nur für den Ton, nicht nennen): ${AUTORIN.name}, ${AUTORIN.rolle}.
Liefere JSON nach Schema. Der Artikel-Text („inhalt“) ist Markdown und beginnt direkt mit dem ersten Absatz (keine H1, der Titel steht separat).`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0.5,
      response_format: { type: "json_schema", json_schema: { name: "ratgeber_artikel", strict: true, schema: SCHEMA } },
      messages: [{ role: "system", content: HAUSSTIL }, { role: "user", content: auftrag }],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || "unbekannt"}`);
  return { daten: JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")), modell };
}

/** Erzeugt bis zu `anzahl` Entwürfe aus den nächsten unbenutzten Themen. */
export async function entwuerfeErzeugen(anzahl: number, themaSlug?: string): Promise<{ erzeugt: Artikel[]; fehler: string[] }> {
  await ensureRatgeberTabelle();
  const rows = (await sqlPool`SELECT thema_slug FROM fiaon_ratgeber WHERE thema_slug IS NOT NULL`) as any[];
  const benutzt = new Set(rows.map((r) => r.thema_slug));
  const kandidaten = themaSlug ? THEMEN.filter((t) => t.slug === themaSlug) : THEMEN.filter((t) => !benutzt.has(t.slug)).slice(0, Math.max(1, Math.min(10, anzahl)));
  const erzeugt: Artikel[] = []; const fehler: string[] = [];
  for (const thema of kandidaten) {
    try {
      const { daten, modell } = await artikelErzeugen(thema);
      let slug = slugify(thema.slug);
      const [dup] = (await sqlPool`SELECT 1 FROM fiaon_ratgeber WHERE slug = ${slug}`) as any[];
      if (dup) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const p = pruefstand({ titel: daten.titel, teaser: daten.teaser, inhalt: daten.inhalt, faq: daten.faq, metaTitel: daten.metaTitel, metaBeschreibung: daten.metaBeschreibung, keyword: thema.keyword });
      const [r] = (await sqlPool`
        INSERT INTO fiaon_ratgeber (slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword, schlagworte, faq, meta_titel, meta_beschreibung, lesezeit, status, quelle, modell, pruefung, thema_slug)
        VALUES (${slug}, ${String(daten.titel)}, ${String(daten.untertitel || "")}, ${String(daten.teaser || "")}, ${String(daten.inhalt || "")}, ${thema.kategorie}, ${thema.land}, ${thema.keyword},
                ${JSON.stringify(daten.schlagworte || [])}::jsonb, ${JSON.stringify(daten.faq || [])}::jsonb, ${String(daten.metaTitel || "").slice(0, 70)}, ${String(daten.metaBeschreibung || "").slice(0, 170)},
                ${lesezeitVon(String(daten.inhalt || ""))}, ${p.ok ? "geprueft" : "entwurf"}, 'ki', ${modell}, ${JSON.stringify(p)}::jsonb, ${thema.slug})
        RETURNING *`) as any[];
      erzeugt.push(zeile(r));
    } catch (e: any) {
      console.error("[RATGEBER] Generator:", thema.slug, e?.message || e);
      fehler.push(`${thema.titel}: ${e?.message || "Fehler"}`);
    }
  }
  return { erzeugt, fehler };
}

router.post("/admin/ratgeber/generieren", async (req: Request, res: Response) => {
  try {
    const anzahl = Math.max(1, Math.min(10, Number(req.body?.anzahl || 3)));
    const out = await entwuerfeErzeugen(anzahl, req.body?.themaSlug ? String(req.body.themaSlug) : undefined);
    res.json({ ok: true, ...out, erzeugt: out.erzeugt.map((a) => ({ ...a, inhalt: undefined })) });
  } catch (err: any) { console.error("[RATGEBER] generieren:", err); res.status(500).json({ ok: false, error: err?.message || "Generator fehlgeschlagen." }); }
});

/** Täglicher Lauf: um 06:00 Berlin drei Entwürfe, falls heute noch keine entstanden sind. */
export async function ratgeberTageslauf(): Promise<void> {
  const jetzt = new Date();
  const berlin = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(jetzt);
  if (Number(berlin) < 6) return;
  await ensureRatgeberTabelle();
  const [h] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_ratgeber WHERE quelle = 'ki' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  if (Number(h?.n || 0) > 0) return;
  if (!process.env.OPENAI_API_KEY) return;
  const out = await entwuerfeErzeugen(3);
  console.log(`[RATGEBER] Tageslauf: ${out.erzeugt.length} Entwürfe, ${out.fehler.length} Fehler`);
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
