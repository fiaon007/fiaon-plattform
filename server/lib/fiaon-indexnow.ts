// ═══════════════════════════════════════════════════════════════════════════
// INDEXNOW — NEUE UND GEÄNDERTE SEITEN SOFORT AN BING MELDEN (27.10.2026, E-436)
//
// Bing (und Yandex, Seznam, Naver) nehmen Meldungen über IndexNow an; Bing speist
// die Websuche von ChatGPT und Copilot. Der Schlüssel liegt seit E-234 unter
// https://fiaon.com/<KEY>.txt (client/public). Gemeldet wurde bisher nur einmal von
// Hand. Jetzt automatisch:
//   · nach jedem Start (= Deploy) die Seiten, deren Stand höchstens drei Tage alt ist,
//   · nach jedem veröffentlichten Tagesartikel genau dessen Adresse.
// Nur im Betrieb (NODE_ENV=production), nie aus Prüfständen; Fehler werden nur geloggt.
// Google nimmt IndexNow nicht an — dort zählen Sitemap und Search Console.
// ═══════════════════════════════════════════════════════════════════════════
export const INDEXNOW_KEY = "21e00e2612ac8ff4d37a3caf4f087439";
const HOST = "fiaon.com";

export async function indexNowMelden(pfade: string[], anlass: string): Promise<void> {
  if (process.env.NODE_ENV !== "production" || process.env.INDEXNOW_AUS === "1") return;
  const urlList = Array.from(new Set(pfade.filter(Boolean).map((p) => (p.startsWith("http") ? p : `https://${HOST}${p}`)))).slice(0, 10_000);
  if (!urlList.length) return;
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[INDEXNOW] ${anlass}: ${urlList.length} Adresse(n) gemeldet → ${r.status}`);
  } catch (e) { console.error(`[INDEXNOW] ${anlass}:`, String(e).slice(0, 160)); }
}

/** Nach dem Start: alle indexierbaren Seiten mit frischem Stand (≤ 3 Tage) und die frischen Business-Artikel. */
export async function indexNowNachStart(): Promise<void> {
  const { seoIndexierbar } = await import("@shared/fiaon-seo-seiten");
  await import("./fiaon-global-seo"); // trägt die Business-Seiten in die Tabelle ein
  const { businessArtikelLaden } = await import("./fiaon-business-artikel-liste");
  const { businessArtikelPfad } = await import("@shared/fiaon-business-artikel");
  const grenze = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const seiten = seoIndexierbar().filter((s) => s.stand >= grenze).map((s) => (s.pfad === "/" ? "/" : s.pfad));
  const artikel = (await businessArtikelLaden()).filter((a) => a.geaendert >= grenze).map((a) => businessArtikelPfad(a.slug, a.sprache));
  await indexNowMelden([...seiten, ...artikel, "/sitemap.xml", "/llms.txt"], "nach dem Start");
}
