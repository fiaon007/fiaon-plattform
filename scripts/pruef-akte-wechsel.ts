// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: EINE AKTE GEHÖRT GENAU EINEM MENSCHEN (19.09.2026)
//
// Florentine: „Er hat alles hochgeladen, wurde sogar ausgewertet, konnte auch
// Konto und Karte beantragen, aber bei Dokumenten ist nichts mehr."
// Die Unterlagen lagen vollständig an seiner Bestellung. Die Akte zeigte den
// Dokumentstand des Kunden, der VORHER offen war: In der Leitung bleibt die
// Akte als Seitenblatt offen, ein Klick auf den nächsten Namen tauschte nur
// den Kunden aus — geladene Dokumente, Anrufe und Angefangenes (freie Mail,
// Notiz, Einmal-Passwort, Zahlungsbeleg) blieben stehen.
//
// TEIL 1 (immer, ohne Server): Die Akte baut sich je Person neu auf
// (`Akte` → `AkteEinesMenschen key={personId}`), der Reiter „Dokumente" lädt
// bei jedem Öffnen frisch, und ein fremder Dokumentstand wird verworfen.
//
// TEIL 2 (`--browser`, NUR gegen einen lokalen Prüfserver): Akte eines Kunden
// OHNE Unterlagen öffnen, Reiter „Dokumente", dann im offenen Seitenblatt zu
// einem Kunden MIT Unterlagen wechseln — dort muss das Dokument stehen.
//
//   npx tsx scripts/pruef-akte-wechsel.ts
//   PRUEF_GEHEIMNIS=<SESSION_SECRET des lokalen Servers> \
//     npx tsx scripts/pruef-akte-wechsel.ts --browser        (Server auf 5199)
//
// Das Geheimnis MUSS ein nur lokal gültiges sein: Der Prüfstand stellt damit
// eine Sitzung für einen Prüf-Mitarbeiter aus. Gegen fiaon.com läuft er nicht.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => readFileSync(p, "utf8");

// ── TEIL 1: DER QUELLTEXT ──────────────────────────────────────────────────
titel("TEIL 1 — Die Akte baut sich je Person neu auf");
{
  const pipeline = lies("client/src/pages/agent/pipeline.tsx");
  pruef("`Akte` ist eine Hülle, die je Person neu aufbaut",
    /export function Akte\(props: AkteProps\) \{\s*return <AkteEinesMenschen key=\{props\.k\.personId\} \{\.\.\.props\} \/>;\s*\}/.test(pipeline),
    "export function Akte(props) { return <AkteEinesMenschen key={props.k.personId} {...props} />; }");
  pruef("Es gibt genau EINE Akte-Hülle (kein zweiter Einstieg am Schlüssel vorbei)",
    (pipeline.match(/export function Akte\b/g) ?? []).length === 1 && !/export function AkteEinesMenschen/.test(pipeline));
  pruef("Der Reiter „Dokumente“ lädt bei jedem Öffnen frisch (kein „nur wenn leer“)",
    /if \(reiter === "dokumente"\) void dokuLaden\(\);/.test(pipeline) && !/reiter === "dokumente" && doku === null/.test(pipeline));
  pruef("Ein Dokumentstand einer anderen Person wird verworfen",
    /const fremd = stand\?\.personId != null && Number\(stand\.personId\) !== Number\(k\.personId\);/.test(pipeline));
  pruef("Nach dem Löschen wird neu geladen (nicht nur geleert)",
    /setDoku\(null\); void dokuLaden\(\);/.test(pipeline));
  pruef("Die Anrufe laden bei jedem Öffnen des Reiters frisch",
    /if \(reiter === "gespraeche"\) \{\s*api\(`\/telefon\/person\/\$\{k\.personId\}\/anrufe`\)/.test(pipeline) && !/reiter === "gespraeche" && anrufe === null/.test(pipeline));

  const vertrieb = lies("client/src/pages/agent/vertrieb.tsx");
  pruef("Leitung: das Seitenblatt baut sich je Person neu auf",
    /<AkteVonAussen key=\{offen\} personId=\{offen\}/.test(vertrieb));

  // Jeder Einbau der Akte geht durch die Hülle — auch künftige.
  const einbauten = ["pipeline", "bestand", "collections", "vertrieb"].map((d) => `client/src/pages/agent/${d}.tsx`).filter(existsSync);
  const ohneHuelle = einbauten.filter((d) => /<AkteEinesMenschen\b/.test(lies(d)) && !d.endsWith("pipeline.tsx"));
  pruef("Niemand baut `AkteEinesMenschen` direkt ein (nur über `Akte`)", ohneHuelle.length === 0, ohneHuelle.join(", "));
}

// ── TEIL 2: IM BROWSER ─────────────────────────────────────────────────────
async function browserTeil(): Promise<void> {
  titel("TEIL 2 — Kundenwechsel im offenen Seitenblatt (lokaler Prüfserver)");
  const basis = process.env.PRUEF_BASIS ?? "http://127.0.0.1:5199";
  const geheim = process.env.PRUEF_GEHEIMNIS ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(basis)) { pruef("Nur gegen einen lokalen Prüfserver", false, basis); return; }
  // Das Geheimnis aus der .env ist das der Produktion — damit stellt dieser Prüfstand nie eine Sitzung aus.
  if (!geheim || geheim === process.env.SESSION_SECRET) { pruef("PRUEF_GEHEIMNIS gesetzt und NICHT das der .env (nur lokal gültig)", false); return; }
  const db = String(process.env.DATABASE_URL ?? "");
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(db)) { pruef("DATABASE_URL zeigt auf die lokale Prüf-Datenbank", false, "Server und Prüfstand brauchen dieselbe lokale Datenbank"); return; }

  const { sqlPool } = await import("../server/lib/db-pool");
  const agentId = Number(process.env.PRUEF_AGENT ?? 99);
  const [agent] = (await sqlPool`SELECT id, session_epoch, rolle FROM fiaon_agents WHERE id = ${agentId} LIMIT 1`) as any[];
  if (!agent) { pruef(`Prüf-Mitarbeiter ${agentId} vorhanden`, false); await sqlPool.end(); return; }
  // Zwei Menschen: einer ohne jede Unterlage, einer mit mindestens einer.
  const [mit] = (await sqlPool`
    SELECT a.person_id FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND p.merged_into_person_id IS NULL
       AND (a.id_card_pdf IS NOT NULL OR a.bank_statement_pdf IS NOT NULL OR a.schufa_pdf IS NOT NULL)
     ORDER BY a.id LIMIT 1`) as any[];
  const [ohne] = (await sqlPool`
    SELECT a.person_id FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND p.merged_into_person_id IS NULL
       AND a.person_id <> ${mit?.person_id ?? -1}
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications y WHERE y.person_id = a.person_id
                        AND (y.id_card_pdf IS NOT NULL OR y.bank_statement_pdf IS NOT NULL OR y.schufa_pdf IS NOT NULL))
     ORDER BY a.id LIMIT 1`) as any[];
  await sqlPool.end();
  if (!mit || !ohne) { pruef("Prüfdaten: ein Kunde mit und einer ohne Unterlagen", false); return; }

  const exp = Date.now() + 30 * 60_000;
  const nutzlast = `${agent.id}.${Number(agent.session_epoch ?? 0)}.${exp}`;
  const token = `${nutzlast}.${createHmac("sha256", geheim).update(`agent2:${nutzlast}`).digest("hex").slice(0, 40)}`;

  const { chromium } = await import("playwright");
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const host = new URL(basis).hostname;
  await ctx.addCookies([{ name: "fiaon_agent_token", value: token, domain: host, path: "/", httpOnly: true, secure: false }]);
  const page = await ctx.newPage();
  const seitenfehler: string[] = [];
  page.on("pageerror", (e) => seitenfehler.push(String(e).slice(0, 160)));
  const reiterDokumente = async () => {
    const r = page.locator("button", { hasText: /^Dokumente$/ }).first();
    if (!(await r.count())) return false;
    await r.click(); await page.waitForTimeout(1500); return true;
  };
  const zeilen = async () => (await page.locator(".pi-doku").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  const vorhanden = (z: string[]) => z.some((t) => /(PDF|Foto|Datei)( ·|$)/.test(t) && /Öffnen/.test(t));

  await page.goto(`${basis}/agent/vertrieb?person=${ohne.person_id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  for (const t of ["Überspringen", "In 5 Minuten erinnern", "Später"]) { const k = page.getByText(t, { exact: true }).first(); if (await k.count()) await k.click().catch(() => {}); }
  const reiterDa = await reiterDokumente();
  pruef("Leitung: Akte öffnet, Reiter „Dokumente“ ist da", reiterDa, "Verpflichtungserklärung des Prüf-Mitarbeiters angenommen?");
  if (reiterDa) {
    const a = await zeilen();
    pruef("Kunde OHNE Unterlagen: nichts liegt vor", a.length > 0 && !vorhanden(a), JSON.stringify(a));
    await page.evaluate((id) => window.dispatchEvent(new CustomEvent("fiaon-akte-oeffnen", { detail: { personId: Number(id) } })), mit.person_id);
    await page.waitForTimeout(2500);
    await reiterDokumente();
    const b = await zeilen();
    pruef("Wechsel im offenen Blatt zu einem Kunden MIT Unterlagen: sie stehen da", vorhanden(b), JSON.stringify(b));
    await page.evaluate((id) => window.dispatchEvent(new CustomEvent("fiaon-akte-oeffnen", { detail: { personId: Number(id) } })), ohne.person_id);
    await page.waitForTimeout(2500);
    await reiterDokumente();
    const c = await zeilen();
    pruef("… und zurück: wieder nichts (kein Rest des vorigen Kunden)", c.length > 0 && !vorhanden(c), JSON.stringify(c));
  }
  pruef("Keine Skriptfehler auf der Seite", seitenfehler.length === 0, seitenfehler.join(" | "));
  await browser.close();
}

(async () => {
  if (process.argv.includes("--browser")) await browserTeil();
  console.log(`\n══ ${ok} ok · ${rot} rot ══`);
  if (rot) { console.log(`Rot: ${fehler.join(" · ")}`); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
