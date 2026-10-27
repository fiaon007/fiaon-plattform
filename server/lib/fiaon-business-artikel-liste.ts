// ═══════════════════════════════════════════════════════════════════════════
// DIE REDAKTIONSARTIKEL DER BUSINESS-WELT IM SPEICHER (27.10.2026, E-439)
//
// Der Vorrenderer (seitenHtml) und /llms.txt sind synchron — sie können nicht auf die
// Datenbank warten. Diese Liste hält die veröffentlichten Business-Artikel (Slug,
// Titel, Teaser, Sprache) bereit; sie lädt beim ersten Gebrauch und danach höchstens
// alle fünf Minuten neu, im Hintergrund. Nur lesend.
// So stehen die Artikel im Vorab-HTML von /business/wissen als echte Links — vorher
// kamen sie nur per JavaScript, und KI-Crawler fanden sie nie.
// ═══════════════════════════════════════════════════════════════════════════
// db-pool erst beim Laden (dynamisch): Wer nur den Vorrenderer importiert (Prüfstände ohne DATABASE_URL), braucht keine Datenbank.

export interface BusinessArtikel { slug: string; titel: string; teaser: string; sprache: "de" | "en"; erschienen: string; geaendert: string }

let liste: BusinessArtikel[] = [];
let geladenUm = 0;
let laeuft: Promise<void> | null = null;

export async function businessArtikelLaden(): Promise<BusinessArtikel[]> {
  if (laeuft) { await laeuft; return liste; }
  laeuft = (async () => {
    try {
      if (!process.env.DATABASE_URL) return;
      const { sqlPool } = await import("./db-pool");
      const rows = (await sqlPool`SELECT slug, titel, teaser, sprache, published_at, updated_at FROM fiaon_ratgeber
        WHERE status = 'veroeffentlicht' AND bereich = 'business' ORDER BY published_at DESC LIMIT 400`) as any[];
      liste = rows.map((r) => ({
        slug: String(r.slug), titel: String(r.titel ?? ""), teaser: String(r.teaser ?? ""), sprache: r.sprache === "en" ? "en" : "de",
        erschienen: new Date(r.published_at ?? r.updated_at).toISOString().slice(0, 10), geaendert: new Date(r.updated_at).toISOString().slice(0, 10),
      }));
      geladenUm = Date.now();
    } catch (e) { console.error("[BUSINESS-ARTIKEL] Liste:", String(e).slice(0, 160)); }
    finally { laeuft = null; }
  })();
  await laeuft;
  return liste;
}

/** Synchron: die zuletzt geladene Liste; stößt im Hintergrund ein Nachladen an, wenn sie älter als fünf Minuten ist. */
export function businessArtikel(sprache?: "de" | "en"): BusinessArtikel[] {
  if (!laeuft && Date.now() - geladenUm > 5 * 60_000) void businessArtikelLaden();
  return sprache ? liste.filter((a) => a.sprache === sprache) : liste;
}
