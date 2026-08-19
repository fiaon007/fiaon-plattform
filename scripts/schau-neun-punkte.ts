// ═══════════════════════════════════════════════════════════════════════════
// NACHSTELLEN: DIE NEUN PUNKTE AUS DEM TEAM-FEEDBACK
//
// Kein Quelltext-Urteil. Jede Meldung wird auf der Route nachgestellt, die das
// Team benutzt, mit der ROLLE, die das Team hat — und die Konsole wird
// mitgelesen. Eine weiße Fläche ist ein JS-Fehler, und der steht dort.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Alles Schreibende geht in eine Attrappe (AGENTS.md, 06.08.2026). Die
// Testkonten legen sich am Ende selbst still (`testkontoStilllegen`).
//
//   npx tsx scripts/schau-neun-punkte.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const BILDER = "reports/bilder-neun-punkte";

const log = (s = "") => console.log(s);
function gruppe(t: string): void { log(`\n${"═".repeat(70)}\n${t}\n${"═".repeat(70)}`); }

async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`   Bild: ${BILDER}/${name}.png`);
}

/** Konsole und Netzfehler mitschreiben — hier steht die Ursache einer weißen Seite. */
function beobachten(page: Page, wohin: { konsole: string[]; netz: string[] }): void {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      wohin.konsole.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (e) => wohin.konsole.push(`[pageerror] ${String(e.message).slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) {
      wohin.netz.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASIS, "")}`);
    }
  });
}

/** Alles Schreibende in die Attrappe. Lesendes geht durch. */
async function attrappen(kontext: BrowserContext): Promise<void> {
  await kontext.route("**/api/**", async (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD") return route.fallback();
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, attrappe: true, meldung: "Attrappe — nichts passiert." }),
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS TESTKONTO MUSS DIE SCHRANKE PASSIEREN, DIE DAS TEAM PASSIERT HAT
//
// Der erste Lauf zeigte für BEIDE Rollen nur die Mitarbeiter-Schranke
// („Zugriff gesperrt bis Abschluss"): `customerDataGate` lässt kein
// /agent/*-Endpunkt durch, solange Zustimmungen und Vertrag fehlen. Damit
// prüfte der Lauf die Schranke und nicht Daniels Meldung.
//
// AGENTS.md erlaubt genau dafür Testdaten: „Wo ein Vorgang wirklich durchlaufen
// werden muss: gegen Testdaten, die im selben Lauf entfernt werden — niemals an
// echten Kunden, Agenten oder Nachweisen."
//
// Also werden die Zustimmungen und der Vertrag für das TESTKONTO direkt
// eingesetzt (nicht über die Oberfläche geklickt — ein Rechtsnachweis, den ein
// Roboter erzeugt, ist wertlos, siehe 06.08.2026) und am Ende gelöscht. Sie
// hängen an einem Konto, das es nach dem Lauf nicht mehr gibt.
// ═══════════════════════════════════════════════════════════════════════════
async function schrankeOeffnen(agentId: number): Promise<void> {
  const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${agentId}, ${d.key}, ${d.version}, NOW(), '127.0.0.1', 'PRUEFSTAND')
      ON CONFLICT DO NOTHING
    `.catch((e) => console.error("   Zustimmung konnte nicht gesetzt werden:", e));
  }
  const [vorlage] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `) as any[];
  if (!vorlage) { log("   Keine aktive Vertragsvorlage — die Schranke bleibt zu."); return; }
  await sqlPool`
    INSERT INTO fiaon_agent_contracts
      (agent_id, template_version, variables_json, rendered_html, signature_name,
       signature_mode, signed_at, ip, user_agent, doc_hash, status)
    VALUES (${agentId}, ${vorlage.version}, '{}', '<p>PRUEFSTAND</p>', 'PRUEFSTAND',
            'typed', NOW(), '127.0.0.1', 'PRUEFSTAND', 'PRUEFSTAND', 'signed')
  `.catch((e) => console.error("   Vertrag konnte nicht gesetzt werden:", e));
}

/** Die Testnachweise wieder entfernen — sie sollen nirgends mitgezählt werden. */
async function schrankeAufraeumen(agentId: number): Promise<void> {
  await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${agentId}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${agentId}`.catch(() => {});
}

async function konto(rolle: string, name: string): Promise<{ id: number; mail: string; pass: string }> {
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-9p-${rolle}-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [k] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES (${name}, ${mail}, ${await bcrypt.hash(pass, 10)}, ${rolle}, TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  return { id: Number(k.id), mail, pass };
}

async function anmelden(page: Page, mail: string, pass: string): Promise<boolean> {
  const r = await page.request.post(`${BASIS}/api/fiaon/agent/login`, {
    data: { email: mail, password: pass },
  }).catch(() => null);
  return r != null && r.ok();
}

/** Ist die Fläche leer? Der Test auf „weißes Fenster". */
async function istLeer(page: Page, im = "body"): Promise<{ leer: boolean; text: string }> {
  const t = (await page.locator(im).innerText().catch(() => "")).trim();
  return { leer: t.length < 40, text: t.slice(0, 200).replace(/\s+/g, " ") };
}

const stillzulegen: number[] = [];

async function main(): Promise<void> {
  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 6 — KUNDENAKTE IN DER VERTRIEBSLEITUNG (weißes Fenster?)");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const k = await konto("vertriebsleiter", "Prüfstand Vertriebsleitung (Testkonto)");
    stillzulegen.push(k.id);
    await schrankeOeffnen(k.id);
    const kontext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await attrappen(kontext);
    // Die Verpflichtungserklärung als Attrappe — NIE echt annehmen.
    await kontext.route("**/api/fiaon/agent/vertrieb/zusage", async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, frei: true, offen: false, zusage: { angenommen: true } }),
      });
    });
    const page = await kontext.newPage();
    const spuren = { konsole: [] as string[], netz: [] as string[] };
    beobachten(page, spuren);
    log(`   Anmeldung als vertriebsleiter: ${await anmelden(page, k.mail, k.pass) ? "ok" : "FEHLGESCHLAGEN"}`);

    await page.goto(`${BASIS}/agent/vertrieb`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const seite = await istLeer(page);
    log(`   /agent/vertrieb geladen. Leer? ${seite.leer ? "JA — WEISS" : "nein"}`);
    log(`   Erster Text: ${seite.text}`);
    await bild(page, "teil6-vertrieb-liste");

    // Eine Akte öffnen — der Knopf heißt „Akte", sonst der Kundenname.
    const akteKnopf = page.getByRole("button", { name: /^Akte$/i }).first();
    const zahl = await akteKnopf.count();
    log(`   Knöpfe „Akte" gefunden: ${zahl}`);
    if (zahl > 0) {
      await akteKnopf.click().catch((e) => log(`   Klick scheiterte: ${e}`));
      await page.waitForTimeout(5000);
      const dialog = page.locator("[role='dialog']:visible").first();
      const hatDialog = await dialog.count() > 0;
      log(`   Akte-Schublade offen? ${hatDialog ? "ja" : "NEIN"}`);
      const inhalt = hatDialog ? await istLeer(page, "[role='dialog']") : await istLeer(page);
      log(`   Akte leer? ${inhalt.leer ? "JA — WEISS" : "nein"}`);
      log(`   Inhalt: ${inhalt.text}`);
      await bild(page, "teil6-akte-offen");
    }
    log(`\n   KONSOLE (${spuren.konsole.length}):`);
    for (const z of spuren.konsole.slice(0, 12)) log(`     ${z}`);
    log(`   NETZ-FEHLER (${spuren.netz.length}):`);
    for (const z of spuren.netz.slice(0, 12)) log(`     ${z}`);
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 7/8/9 — ONBOARDING: Gespräch führen, Notizen, erledigte");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const k = await konto("onboarding", "Prüfstand Onboarding 9P (Testkonto)");
    stillzulegen.push(k.id);
    await schrankeOeffnen(k.id);
    const kontext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await attrappen(kontext);
    await kontext.route("**/api/fiaon/agent/onboarding/zusage", async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, frei: true, offen: false, zusage: { angenommen: true } }),
      });
    });
    // Zwei Termine: einer offen, einer ERLEDIGT — für Teil 9 brauche ich beide.
    await kontext.route("**/api/fiaon/agent/onboarding/termine", async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          termine: [
            {
              id: 990_001, personId: 990_002, name: "Maximiliane von Hohenlohe-Langenburg",
              telefon: "+4915100000042", email: "pruef@pruefstand.test",
              beginn: new Date(Date.now() + 3_600_000).toISOString(),
              datum: new Date().toISOString().slice(0, 10),
              datumText: "heute", uhrzeit: "10:30", dauerMin: 15,
              status: "gebucht", notiz: null, heute: true, vorbei: false, quelle: "onboarding_call",
              terminArt: "onboarding", terminArtText: "Onboarding", terminArtTon: "#047857",
            },
            {
              id: 990_003, personId: 990_004, name: "Bereits Erledigt Testfall",
              telefon: "+4915100000043", email: "pruef2@pruefstand.test",
              beginn: new Date(Date.now() - 7_200_000).toISOString(),
              datum: new Date().toISOString().slice(0, 10),
              datumText: "heute", uhrzeit: "08:00", dauerMin: 15,
              status: "erledigt", notiz: "Gespräch gelaufen", heute: true, vorbei: true,
              erledigtAm: new Date(Date.now() - 6_000_000).toISOString(),
              quelle: "onboarding_call",
              terminArt: "onboarding", terminArtText: "Onboarding", terminArtTon: "#047857",
            },
          ],
        }),
      });
    });
    await kontext.route("**/api/fiaon/agent/onboarding/kennzahlen", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, dieseWoche: 4, offen: 1, erledigt: 3, verpasst: 1,
          heuteGeplant: 2, heuteErledigt: 1, heuteNoShow: 0, dauerSchnittMin: 17,
          freigeschaltetWoche: 3, erledigungsquote: 75, noShowQuote: 25,
          wartend: 349, wartendOhneTermin: 349,
        }),
      });
    });
    await kontext.route("**/api/fiaon/agent/onboarding/person/*/lage", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          lage: {
            paket: "FIAON Pro", zahlungsstand: "bezahlt am 01.08.",
            dokumente: { fehlt: ["Kontoauszug"], stand: "pending" },
            bonitaet: "nicht gekauft", stufe: "wartet_auf_onboarding",
          },
        }),
      });
    });

    const page = await kontext.newPage();
    const spuren = { konsole: [] as string[], netz: [] as string[] };
    beobachten(page, spuren);
    log(`   Anmeldung als onboarding: ${await anmelden(page, k.mail, k.pass) ? "ok" : "FEHLGESCHLAGEN"}`);

    await page.goto(`${BASIS}/agent/startgespraeche`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const liste = await istLeer(page);
    log(`   /agent/startgespraeche leer? ${liste.leer ? "JA — WEISS" : "nein"}`);
    log(`   Erster Text: ${liste.text}`);
    await bild(page, "teil7-startgespraeche");

    // ── TEIL 9: steht der ERLEDIGTE Termin in der aktiven Liste? ──────────
    const seitentext = await page.locator("body").innerText().catch(() => "");
    log(`\n   TEIL 9 — „Bereits Erledigt Testfall" in der Liste sichtbar? `
      + `${seitentext.includes("Bereits Erledigt") ? "JA (bleibt stehen)" : "nein"}`);
    log(`   Reiter/Filter „Erledigt" vorhanden? `
      + `${/erledigt/i.test(seitentext) ? "Text kommt vor" : "NEIN"}`);

    // ── TEIL 7: „Gespräch führen" drücken ────────────────────────────────
    const knopf = page.getByRole("button", { name: /Gespräch führen/i }).first();
    const knopfDa = await knopf.count();
    log(`\n   TEIL 7 — Knöpfe „Gespräch führen": ${knopfDa}`);
    if (knopfDa > 0) {
      await knopf.click().catch((e) => log(`   Klick scheiterte: ${e}`));
      await page.waitForTimeout(4000);
      const nachher = await page.locator("body").innerText().catch(() => "");
      // Die sieben Schritte kommen aus shared/fiaon-onboarding-agenda.ts.
      const { AGENDA } = await import("../shared/fiaon-onboarding-agenda");
      const treffer = AGENDA.filter((s: any) => nachher.includes(s.titel)).length;
      log(`   Cockpit offen? Schritte gefunden: ${treffer} von ${AGENDA.length}`);
      log(`   „Abschließen" sichtbar? ${/abschließen/i.test(nachher) ? "ja" : "NEIN"}`);
      await bild(page, "teil7-cockpit-nach-klick");
    }
    log(`\n   KONSOLE (${spuren.konsole.length}):`);
    for (const z of spuren.konsole.slice(0, 12)) log(`     ${z}`);
    log(`   NETZ-FEHLER (${spuren.netz.length}):`);
    for (const z of spuren.netz.slice(0, 12)) log(`     ${z}`);
    await kontext.close();
  }

  await browser.close();
  for (const id of stillzulegen) {
    await schrankeAufraeumen(id);
    await testkontoStilllegen(id).catch(() => {});
  }
  log(`\n   ${stillzulegen.length} Testkonten stillgelegt, Testnachweise entfernt.`);
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  for (const id of stillzulegen) {
    await schrankeAufraeumen(id);
    await testkontoStilllegen(id).catch(() => {});
  }
  await sqlPool.end();
  process.exit(1);
});
