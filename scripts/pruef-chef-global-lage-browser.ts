// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-PRÜFSTAND — Chefbüro › Global-Lage (E-508, 12.11.2026)
//
// Hausregel (AGENTS.md): „Eine Funktion ist erst geliefert, wenn ein Mensch sie anklicken kann.“ Dieser Prüfstand FINDET
// die Knöpfe der Global-Lage am Bildschirm, DRÜCKT sie und misst das Ergebnis am gerenderten Text — am Bildschirm
// (1440 px) und in Handy-Breite (390 px). Er läuft NUR gegen einen lokalen Server mit lokaler Daten-Kopie:
// BASIS und DATABASE_URL müssen auf localhost/127.0.0.1 zeigen, sonst bricht er ab. Was er schreibt (Notiz, Wiedervorlage,
// „gültig bis“, Fixkosten), stellt er am Ende zurück — auch wenn eine Prüfung scheitert.
//
// Aufruf (Server läuft lokal, z. B. Port 5319, ADMIN_ACCESS_CODE = PRUEF_CODE):
//   PLAYWRIGHT_BROWSERS_PATH=~/Developer/fiaon-plattform/.playwright BASIS=http://localhost:5319 PRUEF_CODE=<lokaler Code> \
//   DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<kopie> node_modules/.bin/tsx scripts/pruef-chef-global-lage-browser.ts [fotoordner]
// ═══════════════════════════════════════════════════════════════════════════
import { chromium, type Page, type BrowserContext } from "playwright";
import postgres from "postgres";

const BASIS = String(process.env.BASIS || "http://localhost:5319").replace(/\/$/, "");
const DB = String(process.env.DATABASE_URL || "");
const CODE = String(process.env.PRUEF_CODE || "");
const FOTOS = process.argv[2] || "";
const lokal = (u: string) => /^(https?|postgres(ql)?):\/\/([^@/]*@)?(127\.0\.0\.1|localhost)[:/]/.test(u);
if (!lokal(BASIS) || !lokal(DB)) { console.error("Dieser Prüfstand läuft nur lokal (BASIS und DATABASE_URL auf localhost/127.0.0.1) — abgebrochen."); process.exit(3); }
if (!CODE) { console.error("PRUEF_CODE fehlt (der lokale Zugangscode des Prüf-Servers)."); process.exit(3); }

let gut = 0; let schlecht = 0;
const ok = (name: string, bedingung: unknown, zusatz = "") => { if (bedingung) { gut++; return; } schlecht++; console.error(`  ✗ ${name}${zusatz ? ` — ${zusatz}` : ""}`); };
const geld = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const glatt = (s: string | null | undefined) => String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

const sql = postgres(DB, { ssl: "require", max: 1, onnotice: () => {} });
const browser = await chromium.launch({ headless: true });

async function sitzung(opt: Parameters<typeof browser.newContext>[0]): Promise<{ ctx: BrowserContext; page: Page; fehler: string[] }> {
  const ctx = await browser.newContext(opt);
  const r = await ctx.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } });
  if (r.status() !== 200) throw new Error(`Lokale Anmeldung fehlgeschlagen (${r.status()})`);
  const page = await ctx.newPage();
  const fehler: string[] = [];
  page.on("pageerror", (e) => fehler.push(String(e).slice(0, 240)));
  page.on("console", (m) => { if (m.type() === "error" && !/status of 40[134]|favicon/.test(m.text())) fehler.push(m.text().slice(0, 240)); });
  await page.goto(`${BASIS}/chef`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.setItem("chef-menue-schmal", "0"); for (const k of ["chef-global-lage", "lagezimmer", "chef-global-kunden", "globalAuftraege"]) localStorage.setItem(`fiaon_rundgang_${k}`, "ja"); });
  return { ctx, page, fehler };
}
async function lage(page: Page) {
  await page.goto(`${BASIS}/chef`, { waitUntil: "domcontentloaded" });
  // Erst warten, dann messen: Die Marke im Inhalt muss da sein — ihr Ausbleiben ist ein Fehlschlag, kein Überspringen.
  await page.waitForSelector("[data-cgl='auftragswert']", { timeout: 45000 });
  await page.waitForTimeout(1800); // die große Zahl zählt einmal hoch
}
const foto = async (page: Page, name: string) => { if (FOTOS) await page.screenshot({ path: `${FOTOS}/${name}.png` }); };

// Der Stand vor dem Lauf — zum Zurückstellen.
const api = async (ctx: BrowserContext) => (await (await ctx.request.get(`${BASIS}/api/fiaon/chef/global-lage`)).json()) as any;
let vorherAngebot: { id: number; g: string; status: string; verlauf: unknown } | null = null;
const [fixVorher] = await sql`SELECT value FROM fiaon_settings WHERE key = 'chef_fixkosten_monat_cents'`;

try {
  // ═════════════════════════════════════════════════════════════════════════
  console.log("Bildschirm (1440 px)");
  const b = await sitzung({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, permissions: ["clipboard-read", "clipboard-write"] });
  const p = b.page;
  await lage(p);
  const daten = await api(b.ctx);
  ok("Die Antwort des Servers ist da und ohne Lücken", daten?.ok && Array.isArray(daten.luecken) && daten.luecken.length === 0, JSON.stringify(daten?.luecken));

  // /chef öffnet die Global-Lage, das Menü führt Global zuerst
  ok("/chef zeigt die Global-Lage", glatt(await p.locator(".cgl-kopf h1").innerText()) === "Lage");
  const gruppen = (await p.locator(".cb-leiste .cb-leiste-titel").allInnerTexts()).map((t) => glatt(t).toLowerCase());
  ok("Menü: „FIAON Global“ steht direkt nach „Heute“, „Privatkunden“ weiter unten", gruppen[0] === "heute" && gruppen[1] === "fiaon global" && gruppen.indexOf("privatkunden") > gruppen.indexOf("team"), gruppen.join(" | "));
  ok("Menü: der erste Raum heißt Global-Lage und ist markiert", glatt(await p.locator(".cb-leiste .cb-punkt").first().innerText()).toLowerCase().includes("global-lage") && (await p.locator(".cb-leiste .cb-punkt").first().getAttribute("class"))!.includes("an"));

  // Auftragswert: die Zahl am Bildschirm = die Zahl des Servers
  ok("Auftragswert am Bildschirm = Server", glatt(await p.locator(".cgl-wert-zahl").innerText()) === geld(daten.auftragswert.draussenCents), `${glatt(await p.locator(".cgl-wert-zahl").innerText())} / ${geld(daten.auftragswert.draussenCents)}`);
  const spalten = (await p.locator(".cgl-wert-spalte").allInnerTexts()).map(glatt);
  ok("Drei Spalten mit Start-Betrag und Erfolgshonorar getrennt", spalten.length === 3 && spalten[0].includes(geld(daten.auftragswert.offen.startCents)) && spalten[0].includes(geld(daten.auftragswert.offen.erfolgCents))
    && spalten[1].includes(geld(daten.auftragswert.angenommen.startCents)) && spalten[2].includes(geld(daten.auftragswert.bezahlt.erfolgCents)), spalten.join(" || "));

  // Fixkosten: sichtbar, „Ändern“ drücken, Wert setzen
  ok("Fixkosten-Karte zeigt den Eingang des Monats", glatt(await p.locator("[data-cgl='fixkosten']").innerText()).includes(geld(daten.fixkosten.monatCents)));
  await p.getByRole("button", { name: "Ändern" }).click();
  await p.locator("#cgl-fixwert").fill("20.000");
  await p.locator("[data-cgl='fixkosten']").getByRole("button", { name: "Speichern" }).click();
  await p.waitForFunction(() => /von 20\.000\s€ gedeckt/.test(document.querySelector("[data-cgl='fixkosten']")?.textContent?.replace(/ /g, " ") ?? ""), undefined, { timeout: 15000 }).catch(() => null);
  ok("Fixkosten: neuer Wert steht da und der Startwert-Hinweis ist weg", /von 20\.000 € gedeckt/.test(glatt(await p.locator("[data-cgl='fixkosten']").innerText())) && !glatt(await p.locator("[data-cgl='fixkosten']").innerText()).includes("Startwert"));
  const [fixNeu] = await sql`SELECT value FROM fiaon_settings WHERE key = 'chef_fixkosten_monat_cents'`;
  ok("Fixkosten stehen in der Datenbank", fixNeu?.value === "2000000", String(fixNeu?.value));

  // Feed: Wichtiges/Alles und Wochen blättern
  const zeilenWichtig = await p.locator(".cgl-feed-zeile").count();
  await p.getByRole("button", { name: "Alles", exact: true }).click();
  await p.waitForTimeout(300);
  const zeilenAlles = await p.locator(".cgl-feed-zeile").count();
  ok("Feed: „Alles“ zeigt mindestens so viele Zeilen wie „Wichtiges“ und keine ausgeblendeten", zeilenAlles >= zeilenWichtig && !glatt(await p.locator("#cgl-feed").innerText()).includes("leise ausgeblendet"), `${zeilenWichtig} → ${zeilenAlles}`);
  await p.getByRole("button", { name: "Wichtiges", exact: true }).click();
  const wocheJetzt = glatt(await p.locator("#cgl-feed h2").innerText());
  ok("Feed: zeigt die Woche des Servers", wocheJetzt.startsWith(daten.woche.name), `${wocheJetzt} / ${daten.woche.name}`);
  await p.getByRole("button", { name: /Woche davor/ }).click();
  await p.waitForFunction((alt) => !(document.querySelector("#cgl-feed h2")?.textContent ?? "").startsWith(alt), daten.woche.name, { timeout: 15000 }).catch(() => null);
  const wocheDavor = glatt(await p.locator("#cgl-feed h2").innerText());
  ok("Feed: „Woche davor“ blättert zurück", wocheDavor !== wocheJetzt && (await p.getByRole("button", { name: "Diese Woche" }).count()) === 1, wocheDavor);
  ok("Feed: die Vorwoche hat sieben Tage", (await p.locator(".cgl-feed-tag").count()) === 7);
  await p.getByRole("button", { name: "Diese Woche" }).click();
  await p.waitForFunction((soll) => (document.querySelector("#cgl-feed h2")?.textContent ?? "").startsWith(soll), daten.woche.name, { timeout: 15000 }).catch(() => null);
  ok("Feed: „Diese Woche“ führt zurück", glatt(await p.locator("#cgl-feed h2").innerText()).startsWith(daten.woche.name));

  // Mandant: Notiz & Wiedervorlage, Verlängern, Link kopieren
  const ziel = (daten.mandanten as any[]).find((m) => m.phase === "angebot" && m.kannVerlaengern && m.link && !m.akteRef);
  ok("Es gibt ein offenes Angebot als Prüffall", !!ziel);
  if (ziel) {
    const [v] = await sql`SELECT id, gueltig_bis::text AS g, status, verlauf FROM fiaon_global_angebote WHERE id = ${ziel.angebotId}`;
    vorherAngebot = { id: Number(v.id), g: String(v.g).slice(0, 10), status: String(v.status), verlauf: v.verlauf };
    const karte = p.locator(`[data-cgl-mandant="${ziel.schluessel}"]`);
    await karte.scrollIntoViewIfNeeded();
    ok("Karte zeigt Name, Schritt und beide Beträge", glatt(await karte.innerText()).includes(ziel.name) && glatt(await karte.innerText()).includes(ziel.schritt.schritt) && glatt(await karte.innerText()).includes(`Start ${geld(ziel.wert.startCents)}`) && glatt(await karte.innerText()).includes(`Erfolgshonorar ${geld(ziel.wert.erfolgCents)}`));
    ok("„Angebot ansehen“ führt auf die Kundenseite des Angebots", ((await karte.getByRole("link", { name: "Angebot ansehen" }).getAttribute("href")) ?? "").includes("/business/angebot/"));
    await karte.getByRole("button", { name: "Link kopieren" }).click();
    await karte.getByRole("button", { name: "Kopiert" }).waitFor({ timeout: 5000 }).catch(() => null);
    ok("„Link kopieren“ meldet „Kopiert“", (await karte.getByRole("button", { name: "Kopiert" }).count()) === 1);
    ok("Der Link liegt in der Zwischenablage", (await p.evaluate(() => navigator.clipboard.readText().catch(() => ""))) === ziel.link);

    await karte.getByRole("button", { name: "Notiz & Wiedervorlage" }).click();
    await karte.locator("textarea").fill("PRUEFSTAND Browser: meldet sich bis Montag.");
    await karte.getByRole("button", { name: "in 3 Tagen" }).click();
    await karte.getByPlaceholder(/anrufen/).fill("PRUEFSTAND nachhaken");
    await foto(p, "pruef-01-notiz-form");
    await karte.getByRole("button", { name: "Festhalten" }).click();
    await karte.locator(".cgl-ok").waitFor({ timeout: 15000 }).catch(() => null);
    ok("Notiz: Meldung „gespeichert“ mit Wiedervorlage", /Notiz gespeichert · Wiedervorlage am/.test(glatt(await karte.locator(".cgl-ok").innerText().catch(() => ""))));
    await p.waitForFunction((k) => (document.querySelector(`[data-cgl-mandant="${k}"] .cgl-notiz`)?.textContent ?? "").includes("PRUEFSTAND Browser"), ziel.schluessel, { timeout: 15000 }).catch(() => null);
    ok("Notiz steht an der Karte", glatt(await karte.locator(".cgl-notiz").innerText().catch(() => "")).includes("PRUEFSTAND Browser: meldet sich bis Montag."));
    const wartet = p.locator("#cgl-wartet .cgl-wartet-zeile", { hasText: "PRUEFSTAND nachhaken" });
    ok("Wiedervorlage steht in „Wir warten auf“", (await wartet.count()) === 1);
    ok("Notiz steht im Feed von heute", glatt(await p.locator(".cgl-feed-tag").first().innerText()).includes("PRUEFSTAND Browser"));
    const [dbNotiz] = await sql`SELECT bezug_art, bezug_id, wiedervorlage_text, erledigt_am FROM fiaon_global_notizen WHERE text LIKE 'PRUEFSTAND Browser%' AND entfernt_am IS NULL ORDER BY id DESC LIMIT 1`;
    ok("Notiz steht in der Datenbank am richtigen Angebot", dbNotiz?.bezug_art === "angebot" && String(dbNotiz?.bezug_id) === String(ziel.angebotId) && dbNotiz?.wiedervorlage_text === "PRUEFSTAND nachhaken");
    await wartet.getByRole("button", { name: "Erledigt" }).click();
    await p.waitForFunction(() => !(document.querySelector("#cgl-wartet")?.textContent ?? "").includes("PRUEFSTAND nachhaken"), undefined, { timeout: 15000 }).catch(() => null);
    ok("„Erledigt“ nimmt die Wiedervorlage aus der Liste", (await p.locator("#cgl-wartet .cgl-wartet-zeile", { hasText: "PRUEFSTAND nachhaken" }).count()) === 0);

    await karte.getByRole("button", { name: "Verlängern", exact: true }).click();
    await karte.getByRole("button", { name: "14 Tage ab heute" }).click();
    await foto(p, "pruef-02-verlaengern-form");
    await karte.locator("[data-cgl='verlaengern-form']").getByRole("button", { name: "Verlängern", exact: true }).click();
    await karte.locator(".cgl-ok", { hasText: "Gültig bis" }).waitFor({ timeout: 15000 }).catch(() => null);
    ok("Verlängern: Meldung „Gültig bis …“", /Gültig bis \d\d\.\d\d\./.test(glatt(await karte.locator(".cgl-ok").innerText().catch(() => ""))));
    const [n] = await sql`SELECT gueltig_bis::text AS g, status, parameter = ${sql.json((await sql`SELECT parameter FROM fiaon_global_angebote WHERE id = ${ziel.angebotId}`)[0].parameter)} AS gleich FROM fiaon_global_angebote WHERE id = ${ziel.angebotId}`;
    ok("Verlängern: nur das Datum hat sich geändert, das Angebot ist offen", String(n.g).slice(0, 10) > vorherAngebot.g && n.status === "offen" && n.gleich === true, `${vorherAngebot.g} → ${n.g}`);
    const verwalten = (await karte.getByRole("link", { name: "Angebot verwalten" }).getAttribute("href")) ?? "";
    ok("„Angebot verwalten“ zeigt auf genau dieses Angebot", verwalten.includes("reiter=angebote") && verwalten.includes(`angebot=${ziel.angebotRef}`), verwalten);
    await p.goto(`${BASIS}${verwalten}`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(`[data-angebot="${ziel.angebotRef}"]`, { timeout: 45000 }).catch(() => null);
    await p.waitForTimeout(1200);
    ok("Der Reiter „Angebote“ öffnet und rollt zu diesem Angebot", await p.evaluate((ref) => { const el = document.querySelector(`[data-angebot="${ref}"]`); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }, ziel.angebotRef));
  }
  // Der Warnsatz zur Teil-2-Rechnung steht an Mandanten mit ausstehendem Honorar — und es gibt dort KEINEN schnellen Knopf.
  await lage(p);
  const mitWarnung = (daten.mandanten as any[]).find((m) => m.meilensteinOffen);
  if (mitWarnung) {
    const k = p.locator(`[data-cgl-mandant="${mitWarnung.schluessel}"]`);
    ok("Warnsatz „Achtung, Rechnung“ steht an der Karte", glatt(await k.locator(".cgl-meilenstein").innerText()).includes("stellt sofort die Rechnung"));
    ok("Kein Knopf der Global-Lage stellt eine Rechnung", (await p.locator(".cgl button", { hasText: /eingetragen|übernommen|Rechnung stellen|Meilenstein/i }).count()) === 0);
  }
  // Rundgang und der alte Raum
  await p.getByRole("button", { name: "Rundgang" }).click();
  await p.waitForTimeout(900);
  ok("Rundgang startet mit dem Satz zur neuen Startseite", glatt(await p.locator("body").innerText()).includes("Das Chefbüro öffnet jetzt mit FIAON Global."));
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
  await p.goto(`${BASIS}/chef/lage`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  ok("Das Lagezimmer Privat ist unter /chef/lage erreichbar", glatt(await p.locator(".cb-kopf-titel b").innerText()) === "Lagezimmer Privat" && (await p.locator(".cgl").count()) === 0);
  ok("Keine Fehler in der Konsole (Bildschirm)", b.fehler.length === 0, b.fehler.join(" | "));
  await b.ctx.close();

  // ═════════════════════════════════════════════════════════════════════════
  console.log("Handy (390 px)");
  const h = await sitzung({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const q = h.page;
  await lage(q);
  const breite = await q.evaluate(() => ({
    dok: document.documentElement.scrollWidth, fenster: window.innerWidth,
    ueber: Array.from(document.querySelectorAll<HTMLElement>(".cgl *")).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && !e.closest(".cgl-wege"); }).slice(0, 4).map((e) => e.className || e.tagName),
  }));
  ok("Handy: nichts ragt seitlich heraus", breite.dok <= breite.fenster + 1 && breite.ueber.length === 0, JSON.stringify(breite));
  const knoepfe = await q.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".cgl .cgl-knopf")).filter((e) => e.offsetParent !== null).map((e) => ({ h: Math.round(e.getBoundingClientRect().height), klein: e.classList.contains("klein"), t: (e.textContent ?? "").trim() })));
  const zuKlein = knoepfe.filter((k) => k.h < (k.klein ? 40 : 44));
  ok("Handy: jeder Knopf ist mindestens 44 px hoch (kleine 40 px)", knoepfe.length > 10 && zuKlein.length === 0, JSON.stringify(zuKlein.slice(0, 4)));
  const ersteKarte = q.locator(".cgl-karte").first();
  await ersteKarte.scrollIntoViewIfNeeded();
  await ersteKarte.getByRole("button", { name: "Notiz & Wiedervorlage" }).click();
  const schrift = await ersteKarte.locator("textarea").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  ok("Handy: Eingaben haben 16 px (kein Zoom beim Tippen)", schrift >= 16, String(schrift));
  await foto(q, "pruef-11-handy-notiz");
  await ersteKarte.getByRole("button", { name: "Abbrechen" }).click();
  ok("Handy: die große Zahl ist dieselbe", glatt(await q.locator(".cgl-wert-zahl").innerText()) === geld((await api(h.ctx)).auftragswert.draussenCents));
  ok("Keine Fehler in der Konsole (Handy)", h.fehler.length === 0, h.fehler.join(" | "));
  await h.ctx.close();
} catch (e) {
  schlecht++; console.error("  ✗ Der Prüfstand ist abgebrochen:", String((e as any)?.message ?? e).slice(0, 400));
} finally {
  // Aufräumen läuft immer.
  await sql`UPDATE fiaon_global_notizen SET entfernt_am = NOW(), entfernt_von = 'Browser-Prüfstand E-508' WHERE entfernt_am IS NULL AND (text LIKE 'PRUEFSTAND%' OR wiedervorlage_text LIKE 'PRUEFSTAND%')`.catch(() => {});
  if (vorherAngebot) await sql`UPDATE fiaon_global_angebote SET gueltig_bis = ${vorherAngebot.g}::date, status = ${vorherAngebot.status}, verlauf = ${sql.json(vorherAngebot.verlauf as any)} WHERE id = ${vorherAngebot.id}`.catch((e) => console.error("Zurückstellen des Angebots:", e));
  if (fixVorher) await sql`UPDATE fiaon_settings SET value = ${fixVorher.value} WHERE key = 'chef_fixkosten_monat_cents'`.catch(() => {});
  else await sql`DELETE FROM fiaon_settings WHERE key = 'chef_fixkosten_monat_cents'`.catch(() => {});
  await browser.close();
  await sql.end({ timeout: 5 });
}
if (schlecht) { console.error(`\nDURCHGEFALLEN: ${schlecht} (bestanden ${gut})`); process.exit(1); }
console.log(`\nALLES GRÜN: ${gut} Prüfungen`);
