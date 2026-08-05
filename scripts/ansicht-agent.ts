// Werkzeug: Bildschirmfotos des Agent-Portals als ECHTER Agent (Desktop + 380px).
//
// Ohne dieses Werkzeug bleibt „sieht gut aus" eine Behauptung. Es meldet sich mit
// einer echten Sitzung an (signiertes Cookie wie der Server es ausstellt) und
// fotografiert die Seiten in zwei Breiten — die Hälfte des Vertriebs arbeitet am
// Handy.
//
// Aufruf: npx tsx scripts/ansicht-agent.ts [pfad...]
//         AGENT=10 npx tsx scripts/ansicht-agent.ts /agent/vertrieb
import "dotenv/config";
import { chromium } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { signAgentToken, AGENT_COOKIE_NAME } from "../server/routes/fiaon-agent";

const BASIS = process.env.BASIS || "http://localhost:5188";
const AGENT = Number(process.env.AGENT || 8);
const pfade = process.argv.slice(2).length ? process.argv.slice(2) : ["/agent/start", "/agent/kunden"];

(async () => {
  const [a] = (await sqlPool`
    SELECT id, name, session_epoch, COALESCE(rolle,'agent') AS rolle FROM fiaon_agents WHERE id = ${AGENT}
  `) as any[];
  if (!a) throw new Error(`Agent #${AGENT} nicht gefunden`);
  console.log(`Sitzung: ${a.name} (#${a.id}, ${a.rolle})\n`);
  const token = signAgentToken(a.id, Number(a.session_epoch || 0));
  const url = new URL(BASIS);

  const browser = await chromium.launch();
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["handy", { width: 380, height: 860 }],
  ] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    await ctx.addCookies([{
      name: AGENT_COOKIE_NAME, value: token,
      domain: url.hostname, path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    }]);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.log(`  [console] ${m.text().slice(0, 200)}`); });
    page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message.slice(0, 200)}`));

    for (const pfad of pfade) {
      await page.goto(`${BASIS}${pfad}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => {
        console.log(`  [warnung] ${pfad}: ${String(e).split("\n")[0]}`);
      });
      // Die Seiten holen ihre Zahlen nach dem ersten Bild — ohne Wartezeit
      // fotografiert man Skelette und nennt es Gestaltung.
      await page.waitForTimeout(Number(process.env.WARTE || 6000));
      const datei = `/tmp/agent-${name}${pfad.replace(/[\/?=&]/g, "_")}.png`;
      await page.screenshot({ path: datei, fullPage: true });
      console.log(`${datei}`);
    }
    await ctx.close();
  }
  await browser.close();
  await sqlPool.end?.();
})();
