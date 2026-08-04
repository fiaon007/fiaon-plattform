// Werkzeug: macht Bildschirmfotos der Verwaltung (Desktop + 380px),
// damit die Gestaltung wirklich angesehen wird und nicht nur behauptet.
// Aufruf: npx tsx scripts/ansicht-verwaltung.ts [pfad...]
import { chromium } from "playwright";

const BASIS = process.env.BASIS || "http://localhost:5188";
const pfade = process.argv.slice(2).length ? process.argv.slice(2) : ["/admin"];

(async () => {
  const browser = await chromium.launch();
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["handy", { width: 380, height: 860 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.log(`  [console] ${m.text().slice(0, 200)}`); });
    page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message.slice(0, 200)}`));

    // Code eingeben (einmal je Kontext), dann laden.
    await page.goto(`${BASIS}/admin`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await fetch("/api/fiaon/zugang/oeffnen", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "20032017" }),
      });
    });

    for (const pfad of pfade) {
      // Nicht auf „networkidle" warten: Seiten mit Dauer-Abfragen (Badges alle
      // 60 s) erreichen den Zustand nie und würden das Werkzeug aufhängen.
      await page.goto(`${BASIS}${pfad}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => {
        console.log(`  [warnung] ${pfad}: ${String(e).split("\n")[0]}`);
      });
      await page.waitForTimeout(Number(process.env.WARTE || 3000));
      const datei = `/tmp/fiaon-${name}${pfad.replace(/\//g, "_")}.png`;
      await page.screenshot({ path: datei, fullPage: true });
      console.log(`${datei}`);

      // Zusätzlich jeden Abschnitt einzeln — ein Vollbild von 4.000px wird beim
      // Ansehen so stark verkleinert, dass man Details nicht mehr beurteilen kann.
      if (process.env.ABSCHNITTE === "1") {
        const teile = page.locator("section.a3-tafel, div.a3-buehne, div.grid.grid-cols-2");
        const n = await teile.count();
        for (let i = 0; i < n; i++) {
          const d = `/tmp/fiaon-${name}-teil${i}.png`;
          await teile.nth(i).screenshot({ path: d }).catch(() => {});
          console.log(`  ${d}`);
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
})();
