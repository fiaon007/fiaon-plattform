// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-G, TEIL C: ROUTEN ÜBER HTTP UND DAS BAUTEIL IM BROWSER
// (aufgerufen von scripts/pruef-it-g.ts — nur gegen http://127.0.0.1:5317 mit
// der lokalen Kopie fiaon_it_g; nie gegen die Produktion)
//
// „Eine Funktion ist erst geliefert, wenn ein Mensch sie anklicken kann“
// (AGENTS.md): Hier wird das Feld wirklich getippt (1-7-1-1-6-3), eingefügt,
// mit der Rücktaste bedient, und in der Akte wird „Kunde bearbeiten“ gedrückt
// und gespeichert — gemessen am gerenderten Text und an der Datenbank.
// Die Kündigungsseite wird bis zur Grundwahl geführt, der letzte Knopf
// (Kündigung absenden) wird im Browser NICHT gedrückt; den Antrag selbst
// prüft der HTTP-Teil gegen die lokale Kopie.
//
// Browser: PLAYWRIGHT_BROWSERS_PATH muss auf ein Chromium zeigen
// (z. B. ~/Developer/fiaon-plattform/.playwright).
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { signAgentToken, AGENT_COOKIE_NAME } from "../server/routes/fiaon-agent";

type Pruef = (name: string, bedingung: boolean, hinweis?: string) => void;
const BILDER = "reports/it-g";

/** Das Verwaltungs-Cookie der LOKALEN Instanz (gleiches Geheimnis, Vorgabe-Code) — nur für den Prüfstand. */
function adminCookieLokal(): string {
  const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  const code = String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
  const fp = createHmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
  const exp = Date.now() + 60 * 60 * 1000;
  return `${exp}.${createHmac("sha256", geheim).update(`adminzugang:${exp}:${fp}`).digest("hex").slice(0, 40)}`;
}

export async function browserTeil(basis: string, pruef: Pruef, titel: (t: string) => void): Promise<string | void> {
  const MARKE = `ITGB${Date.now().toString(36).toUpperCase()}`;
  const mail = (n: string) => `pruef.${MARKE.toLowerCase()}.${n}@example.invalid`;
  const refs = { mit: `FIAON-TEST-${MARKE}-M`, ohne: `FIAON-TEST-${MARKE}-O` };
  const personen: number[] = [];
  const [agent] = (await sqlPool`SELECT id, session_epoch FROM fiaon_agents WHERE id = 927 AND active`) as any[];
  if (!agent) { pruef("Prüfkonto 927 (Vertriebsleitung, Testkonto) vorhanden", false); return; }
  const agentCookie = `${AGENT_COOKIE_NAME}=${signAgentToken(927, Number(agent.session_epoch || 0))}`;
  const anlegen = async (ref: string, email: string, vor: string, nach: string, geb: string | null) => {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, birthdate, account_status, assigned_agent_id)
      VALUES (${`P-${ref}`}, 'private', ${vor}, ${nach}, ${email}, ${geb}, 'pending', 927) RETURNING id`) as any[];
    personen.push(Number(p.id));
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, payment_status, first_name, last_name, email, birthdate, person_id, assigned_agent_id, pack_key, pack_name, amount_due, created_at, updated_at)
      VALUES (${ref}, 'private', 'submitted', 'paid', ${vor}, ${nach}, ${email}, ${geb}, ${Number(p.id)}, 927, 'basic', 'FIAON Basic', 59.99, NOW() - INTERVAL '3 days', NOW())`;
    return Number(p.id);
  };
  const json = async (pfad: string, body: unknown, cookie = agentCookie) => {
    const r = await fetch(`${basis}/api/fiaon${pfad}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
    return { status: r.status, j: (await r.json().catch(() => ({}))) as any };
  };

  const browser = await chromium.launch();
  try {
    const pMit = await anlegen(refs.mit, mail("mit"), "Gerda", "Geburtsprobe", "1964-11-17");
    await anlegen(refs.ohne, mail("ohne"), "Otto", "Ohnedatum", null);

    // ═══════════════════════════════════════════════════════════════════
    titel("C1  Routen über HTTP (lokaler Server)");
    // ═══════════════════════════════════════════════════════════════════
    let r = await json(`/agent/customers/${refs.mit}/stammdaten`, { phone: "abc" });
    pruef("Stammdaten: Telefon „abc“ → 400 statt „ok“", r.status === 400 && r.j.ok === false && /Telefon/.test(r.j.error || ""), JSON.stringify(r));
    r = await json(`/agent/customers/${refs.mit}/stammdaten`, { birthdate: "0063-11-17" });
    pruef("Stammdaten: 0063-11-17 → 400 mit Text", r.status === 400 && /Geburtsdatum/.test(r.j.error || ""), JSON.stringify(r));
    r = await json(`/agent/customers/${refs.mit}/stammdaten`, { birthdate: "01.01.2012" });
    pruef("Stammdaten: unter 18 → 400 mit rueckfrage", r.status === 400 && r.j.rueckfrage === true, JSON.stringify(r));
    r = await json(`/agent/customers/${refs.mit}/stammdaten`, { birthdate: "17.11.63" });
    pruef("Stammdaten: „17.11.63“ → gespeichert", r.status === 200 && r.j.ok === true && Array.isArray(r.j.geaendert) && r.j.geaendert.length === 1, JSON.stringify(r));
    r = await json(`/agent/kunden/neu`, { firstName: "Neu", lastName: "Anlage", email: mail("neu"), birthdate: "2025-11-15" });
    pruef("Kunde anlegen: 2025-11-15 → 400 (vorher ungeprüft übernommen)", r.status === 400 && /Geburtsdatum/.test(r.j.error || ""), JSON.stringify(r));
    // Chef-Akte: dieselbe Engine (Person + Bestellungen), Entfernen erlaubt.
    const admin = `fiaon_admin=${adminCookieLokal()}`;
    r = await json(`/admin/kunden/${refs.mit}/stammdaten`, { birthdate: "1963-11-18" }, admin);
    const [nachChef] = (await sqlPool`SELECT p.birthdate AS p, a.birthdate AS a FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${refs.mit}`) as any[];
    pruef("Chef-Akte schreibt Bestellung UND Person (vorher nur die Bestellung)", r.status === 200 && nachChef?.p === "1963-11-18" && nachChef?.a === "1963-11-18", JSON.stringify({ r, nachChef }));
    r = await json(`/agent/customers/${refs.mit}/stammdaten`, { birthdate: "1963-11-17" });
    pruef("zurück auf 17.11.1963", r.status === 200);
    // Kündigungsseite
    r = await json(`/abo-kuendigen`, { firstName: "Otto", lastName: "Ohnedatum", email: mail("ohne"), birthdate: "1970-01-01", reason: "__verify_only__" }, "");
    // Gegenprüfung 08.10.: Nach außen nur „ok“ oder EINE neutrale Meldung — kein Feld verrät, ob bei uns ein Geburtsdatum steht.
    pruef("Kündigung: ohne jedes Geburtsdatum → angenommen (Name + E-Mail), Antwort neutral", r.status === 200 && r.j.ok === true && r.j.ohneGeburtsdatum === undefined && r.j.grund === undefined, JSON.stringify(r));
    r = await json(`/abo-kuendigen`, { firstName: "Gerda", lastName: "Geburtsprobe", email: mail("mit"), birthdate: "1963-11-18", reason: "__verify_only__" }, "");
    pruef("Kündigung: falsches Geburtsdatum → angenommen (Team prüft), keine Auskunft über das Datum", r.status === 200 && r.j.ok === true && r.j.grund === undefined, JSON.stringify(r));
    r = await json(`/abo-kuendigen`, { firstName: "Fremd", lastName: "Geburtsprobe", email: mail("mit"), birthdate: "1963-11-17", reason: "__verify_only__" }, "");
    const rKeinKonto = await json(`/abo-kuendigen`, { firstName: "Gerda", lastName: "Geburtsprobe", email: mail("gibtsnicht"), birthdate: "1963-11-17", reason: "__verify_only__" }, "");
    pruef("Kündigung: Name passt nicht / E-Mail unbekannt → dieselbe neutrale 404", r.status === 404 && rKeinKonto.status === 404 && r.j.error === rKeinKonto.j.error && r.j.grund === undefined && !/geburt/i.test(r.j.error || ""), JSON.stringify({ r, rKeinKonto }));
    r = await json(`/abo-kuendigen`, { firstName: "gerda", lastName: "GEBURTSPROBE", email: mail("mit").toUpperCase(), birthdate: "17.11.63", reason: "__verify_only__" }, "");
    pruef("Kündigung: „17.11.63“, Groß/klein egal → erkannt", r.status === 200 && r.j.ok && !r.j.ohneGeburtsdatum, JSON.stringify(r));
    r = await json(`/abo-kuendigen`, { firstName: "Otto", lastName: "Ohnedatum", email: mail("ohne"), birthdate: "1970-01-01", reason: "Ich nutze den Service nicht mehr" }, "");
    const [antrag] = (await sqlPool`SELECT identifiziert_ueber FROM cancellation_requests WHERE ref = ${refs.ohne} ORDER BY id DESC LIMIT 1`) as any[];
    const [vermerk] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${refs.ohne} AND note LIKE 'Kündigungsantrag über das Formular — ohne Geburtsdatum%' LIMIT 1`) as any[];
    pruef("Kündigung ohne Geburtsdatum: Antrag mit identifiziert_ueber = name_email + Verlaufseintrag „Identität prüfen“", r.status === 200 && antrag?.identifiziert_ueber === "name_email" && !!vermerk, JSON.stringify({ r, antrag, vermerk }));
    const [aufgabe] = r.j?.id ? (await sqlPool`SELECT titel, status FROM fiaon_betreiber_todos WHERE schluessel = ${`kuendigung-identitaet:${r.j.id}`}`) as any[] : [];
    pruef("… und die Aufgabe „Kündigung – Identität prüfen“ steht offen", aufgabe?.titel === "Kündigung – Identität prüfen" && aufgabe?.status === "offen", JSON.stringify(aufgabe));

    // ═══════════════════════════════════════════════════════════════════
    titel("C2  Das Bauteil im Browser — Kündigungsseite (380 px, Kunde)");
    // ═══════════════════════════════════════════════════════════════════
    mkdirSync(BILDER, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 380, height: 860 }, locale: "de-DE" });
    const page = await ctx.newPage();
    await page.goto(`${basis}/abo-kuendigen`, { waitUntil: "domcontentloaded", timeout: 120000 });
    const tag = page.getByRole("textbox", { name: "Tag" });
    await tag.waitFor({ timeout: 90000 });
    // Einwilligung: die sparsamste Wahl („Nur notwendige“), damit nichts die Felder verdeckt.
    const nurNotwendige = page.getByRole("button", { name: "Nur notwendige" });
    if (await nurNotwendige.isVisible().catch(() => false)) await nurNotwendige.click();
    pruef("Kein natives Datumsfeld auf der Seite", (await page.locator('input[type="date"]').count()) === 0);
    await tag.focus();
    await page.keyboard.type("171163", { delay: 40 });
    const werte = async () => [await tag.inputValue(), await page.getByRole("textbox", { name: "Monat" }).inputValue(), await page.getByRole("textbox", { name: "Jahr" }).inputValue()].join("·");
    pruef("Tippen 1-7-1-1-6-3 springt weiter: 17·11·63", (await werte()) === "17·11·63", await werte());
    const zeileVorher = (await page.locator('[data-geburt-stand]').first().innerText().catch(() => "")).trim();
    pruef("Schon beim Tippen: „17. November 1963“ (63 als 1963 gelesen)", /17\. November 1963/.test(zeileVorher) && /1963/.test(zeileVorher), zeileVorher);
    await page.keyboard.press("Tab");
    pruef("Verlassen ergänzt sichtbar: 17·11·1963", (await werte()) === "17·11·1963", await werte());
    await page.screenshot({ path: `${BILDER}/kuendigung-380.png`, fullPage: false });
    // Einfügen
    await page.getByRole("textbox", { name: "Monat" }).fill("");
    await page.getByRole("textbox", { name: "Tag" }).fill("");
    await page.getByRole("textbox", { name: "Jahr" }).fill("");
    await tag.focus();
    await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement;
      const dt = new DataTransfer(); dt.setData("text", "1963-03-14");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(150);
    pruef("Einfügen „1963-03-14“ ins Tag-Feld verteilt sich: 14·03·1963", (await werte()) === "14·03·1963", await werte());
    // Rücktaste im leeren Feld springt zurück
    await page.getByRole("textbox", { name: "Jahr" }).fill("");
    await page.getByRole("textbox", { name: "Jahr" }).focus();
    await page.keyboard.press("Backspace");
    const fokus = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.getAttribute("aria-label"));
    pruef("Rücktaste im leeren Jahr springt in den Monat", fokus === "Monat", String(fokus));
    // Freie Eingabe am Stück ins Tag-Feld
    await page.getByRole("textbox", { name: "Monat" }).fill(""); await tag.fill("");
    await tag.focus();
    await page.keyboard.type("1.3.27", { delay: 30 });
    await page.keyboard.press("Tab");
    pruef("„1.3.27“ getippt → 01·03·1927", (await werte()) === "01·03·1927", await werte());
    // Ohne Geburtsdatum bei uns: bis zur Grundwahl, NICHT absenden.
    await page.getByPlaceholder("Max", { exact: true }).fill("Otto");
    await page.getByPlaceholder("Mustermann", { exact: true }).fill("Ohnedatum");
    await page.getByPlaceholder("max@beispiel.de").fill(mail("ohne"));
    await page.getByRole("button", { name: /Weiter zur Kündigung/ }).first().click();
    // Gegenprüfung 08.10.: Die Seite sagt nicht mehr, ob bei uns ein Geburtsdatum steht — sie geht einfach weiter.
    // Ein offener Antrag aus C1 liegt schon vor (409) — dann steht dieser Satz da.
    await page.waitForTimeout(2500);
    const seite = (await page.locator("body").innerText()).toLowerCase();
    pruef("Kündigungsseite ohne Geburtsdatum: weiter statt „Keine Übereinstimmung“", !/keine übereinstimmung/.test(seite) && (/bereits ein offener kündigungsantrag/.test(seite) || /kündigungsantrag/.test(seite)), seite.slice(0, 300));
    pruef("Kündigungsseite: keine Auskunft „kein Geburtsdatum hinterlegt“", !/kein geburtsdatum hinterlegt/.test(seite) && (await page.locator("[data-ohne-geburtsdatum]").count()) === 0);
    pruef("Kündigungsseite: kein „du“ mehr", !/\b(bestätige deine|deine identität|dein kündigungsantrag|bei dir)\b/.test(seite));
    await page.screenshot({ path: `${BILDER}/kuendigung-ohne-geburt.png` });
    await ctx.close();

    // ═══════════════════════════════════════════════════════════════════
    titel("C3  Das Bauteil in der Akte — „Kunde bearbeiten“ (Mitarbeiter)");
    // ═══════════════════════════════════════════════════════════════════
    await sqlPool`UPDATE fiaon_persons SET birthdate = NULL WHERE id = ${pMit}`;
    await sqlPool`UPDATE fiaon_applications SET birthdate = NULL WHERE ref = ${refs.mit}`;
    const actx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "de-DE" });
    const [name, wert] = agentCookie.split("=");
    await actx.addCookies([{ name, value: wert, url: basis }]);
    const ap = await actx.newPage();
    await ap.goto(`${basis}/agent/kunden?person=${pMit}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    // Das Prüfkonto hat keinen Wochenplan — die Pflicht-Karte „Verfügbarkeit“ verschiebt sich mit „In 5 Minuten erinnern“.
    const spaeter = ap.getByRole("button", { name: "In 5 Minuten erinnern" });
    await spaeter.waitFor({ timeout: 15000 }).catch(() => {});
    if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
    const datenReiter = ap.getByRole("button", { name: /^Daten$/ }).or(ap.getByRole("tab", { name: /^Daten$/ }));
    await datenReiter.first().waitFor({ timeout: 45000 }).catch(() => {});
    // Die Pflicht-Karte kann auf einem langsamen Prüfstand erst NACH dem Reiter kommen — dann jetzt wegklicken.
    await ap.waitForTimeout(1500);
    if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
    await datenReiter.first().click().catch(() => {});
    const nachtragen = ap.getByRole("button", { name: /Geburtsdatum fehlt – jetzt nachtragen/ });
    await nachtragen.waitFor({ timeout: 20000 }).catch(() => {});
    const sichtbar = await nachtragen.isVisible().catch(() => false);
    if (!sichtbar) await ap.screenshot({ path: `${BILDER}/akte-fehlschlag.png` });
    pruef("Akte zeigt „Geburtsdatum fehlt – jetzt nachtragen“", sichtbar);
    await nachtragen.click().catch(() => {});
    const aTag = ap.locator('.pi-geburt-gruppe input[aria-label="Tag"]');
    await aTag.waitFor({ timeout: 10000 }).catch(() => {});
    await ap.waitForTimeout(400);
    const fokusAkte = await ap.evaluate(() => (document.activeElement as HTMLInputElement | null)?.getAttribute("aria-label"));
    pruef("Der Sprung landet im Tag-Feld des Geburtsdatums", fokusAkte === "Tag", String(fokusAkte));
    await aTag.focus();
    await ap.keyboard.type("171163", { delay: 40 });
    const zeileAkte = (await ap.locator('.pi-geburt-gruppe [data-geburt-stand]').innerText().catch(() => "")).trim();
    pruef("Akte: Gegenlesen „17. November 1963 · 62 Jahre“", /17\. November 1963 · 6\d Jahre/.test(zeileAkte), zeileAkte);
    await ap.screenshot({ path: `${BILDER}/akte-kunde-bearbeiten.png` });
    await ap.getByRole("button", { name: /^Speichern$/ }).first().click();
    // Erst warten, dann messen (AGENTS.md): bis die Datenbank den Wert trägt (höchstens 15 s).
    let db: any = null;
    for (let i = 0; i < 30; i++) {
      [db] = (await sqlPool`SELECT p.birthdate AS p, a.birthdate AS a FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${refs.mit}`) as any[];
      if (db?.p && db?.a) break;
      await ap.waitForTimeout(500);
    }
    pruef("Akte „Speichern“ → Person und Bestellung 1963-11-17", db?.p === "1963-11-17" && db?.a === "1963-11-17", JSON.stringify(db));
    // Erst warten, dann messen: bis die Akte neu geladen ist (höchstens 20 s, langsamer Prüfstand).
    let dlText = "";
    for (let i = 0; i < 40; i++) {
      dlText = (await ap.locator(".pi-dl").first().innerText().catch(() => "")).replace(/\s+/g, " ");
      if (/17\.11\.1963/.test(dlText)) break;
      await ap.waitForTimeout(500);
    }
    pruef("Akte zeigt danach vierstellig mit Alter", /17\.11\.1963 · 62 Jahre/.test(dlText), dlText.slice(0, 200));
    // Unter 18: Rückfrage mit „Stimmt so“
    await ap.getByRole("button", { name: /Kunde bearbeiten/ }).first().click().catch(() => {});
    const t2 = ap.locator('.pi-geburt-gruppe input[aria-label="Tag"]');
    await t2.waitFor({ timeout: 10000 }).catch(() => {});
    await t2.fill(""); await ap.locator('.pi-geburt-gruppe input[aria-label="Monat"]').fill(""); await ap.locator('.pi-geburt-gruppe input[aria-label="Jahr"]').fill("");
    await t2.focus();
    await ap.keyboard.type("01012012", { delay: 30 });
    const stimmt = ap.locator("[data-geburt-bestaetigen]");
    await stimmt.waitFor({ timeout: 5000 }).catch(() => {});
    pruef("Unter 18: Rückfrage „stimmt das?“ mit Knopf „Stimmt so“", await stimmt.isVisible().catch(() => false));
    await ap.screenshot({ path: `${BILDER}/akte-rueckfrage.png` });
    // Abweichung: Person ≠ Bestellung → Hinweis mit Übernehmen-Knöpfen
    await sqlPool`UPDATE fiaon_persons SET birthdate = '2025-11-15' WHERE id = ${pMit}`;
    await ap.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await spaeter.waitFor({ timeout: 8000 }).catch(() => {});
    if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
    await datenReiter.first().waitFor({ timeout: 45000 }).catch(() => {});
    await ap.waitForTimeout(1500);
    if (await spaeter.isVisible().catch(() => false)) await spaeter.click();
    await datenReiter.first().click().catch(() => {});
    const abw = ap.locator("[data-geburt-abweichung]");
    await abw.waitFor({ timeout: 20000 }).catch(() => {});
    pruef("Akte: „Geburtsdatum weicht ab“ sichtbar", await abw.isVisible().catch(() => false));
    await ap.screenshot({ path: `${BILDER}/akte-abweichung.png` });
    // Gegenprüfung 08.10.: Der Knopf nennt das Alter; „15.11.2025 · 0 Jahre“ fragt erst nach (abgelehnt → nichts geschrieben).
    let dialogText = "";
    ap.once("dialog", (d) => { dialogText = d.message(); void d.dismiss(); });
    await abw.getByRole("button", { name: /15\.11\.2025 · \d+ Jahre? übernehmen/ }).click().catch(() => {});
    await ap.waitForTimeout(800);
    const [db1] = (await sqlPool`SELECT p.birthdate AS p, a.birthdate AS a FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${refs.mit}`) as any[];
    pruef("„15.11.2025 übernehmen“ fragt erst nach (stimmt das?) — abgelehnt bleibt alles", /stimmt das/.test(dialogText) && db1?.p === "2025-11-15" && db1?.a === "1963-11-17", JSON.stringify({ dialogText, db1 }));
    const knopf = abw.getByRole("button", { name: /17\.11\.1963 · \d+ Jahre übernehmen/ });
    await knopf.click().catch(() => {});
    await ap.waitForTimeout(1500);
    const [db2] = (await sqlPool`SELECT p.birthdate AS p, a.birthdate AS a FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${refs.mit}`) as any[];
    pruef("„17.11.1963 übernehmen“ setzt beide", db2?.p === "1963-11-17" && db2?.a === "1963-11-17", JSON.stringify(db2));
    await actx.close();
  } finally {
    await browser.close().catch(() => {});
    // Nur die lokale Kopie: Prüfdaten entfernen.
    const alleRefs = [refs.mit, refs.ohne];
    await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE schluessel IN (SELECT 'kuendigung-identitaet:' || id::text FROM cancellation_requests WHERE ref = ANY(${alleRefs}))`.catch(() => {});
    await sqlPool`DELETE FROM cancellation_requests WHERE ref = ANY(${alleRefs})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ANY(${alleRefs})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${alleRefs}) OR email LIKE ${`pruef.${MARKE.toLowerCase()}.%`}`.catch(() => {});
    for (const id of personen) {
      await sqlPool`DELETE FROM fiaon_person_aliases WHERE person_id = ${id}`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_persons WHERE id = ${id}`.catch(() => {});
    }
    await sqlPool`DELETE FROM fiaon_persons WHERE primary_email LIKE ${`pruef.${MARKE.toLowerCase()}.%`}`.catch(() => {});
  }
}
