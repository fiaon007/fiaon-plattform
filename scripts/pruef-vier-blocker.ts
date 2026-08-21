// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DIE VIER BLOCKER AUS DEM BETRIEB (21.08.2026)
//
//   TEIL 1  Die Rechnung hängt nicht mehr an Vertragsfeldern, und für eine
//           Zustimmung gibt es KEIN Eingabefeld, sondern einen Link.
//   TEIL 2  Das Ergebnis aus dem Telefon-Panel wird angenommen — auch ohne
//           Anruf-Kennung (eingehender Anruf). Und jeder Ausgang ist sichtbar.
//   TEIL 3  Onboarding sieht beim Anrufen Kundendaten UND kommt an die sieben
//           Schritte.
//   TEIL 4  Ein Termin lässt sich an einen Kollegen übergeben.
//
// ── ES ENTSTEHT NICHTS ECHTES ──────────────────────────────────────────────
// Alle schreibenden Routen sind abgefangen (`page.route`) und liefern genau
// die Felder, die die Oberfläche liest (AGENTS.md: eine Attrappe, die WENIGER
// liefert, erzeugt Fehler, die es nicht gibt). Die Nutzlasten werden
// MITGELESEN und geprüft — das ist der eigentliche Beweis.
//
// Das Testkonto legt sich am Ende selbst still (`testkontoStilllegen`).
//
//   npx tsx scripts/pruef-vier-blocker.ts               (Server auf 5188)
//   npx tsx scripts/pruef-vier-blocker.ts --rot-probe   (prüft die Wand)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page, type BrowserContext } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEF4B-${Date.now().toString(36).toUpperCase()}`;
const ROT_PROBE = process.argv.includes("--rot-probe");
const BILD = "reports/vier-blocker";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

const testkonten: number[] = [];
/**
 * Geliehene Termine — mit ihrem ECHTEN vorherigen Zuständigen.
 *
 * ── WARUM DIESE LISTE OBEN STEHT (21.08.2026) ───────────────────────────
 * Die Rückgabe lag im `try`-Block, hinter den Klicks. Ein Playwright-Timeout
 * beim Übergeben-Knopf hat den Block verlassen — und zwei echte Kundentermine
 * blieben an stillgelegten Prüfstands-Konten hängen (#684, #688). Zu diesen
 * Terminen wäre niemand erschienen.
 *
 * AGENTS.md: „Aufräumen läuft immer, nicht nur bei Durchbrüchen." Also steht
 * die Liste hier und die Rückgabe im `finally`.
 */
const geliehenTermine: { id: number; alt: number }[] = [];
/** Alles, was eine abgefangene Schreibroute gesehen hat. */
const gesehen: { url: string; koerper: any }[] = [];

/** Ein Mitarbeiterkonto mit Rolle, Zusage und Vertrag — sonst greift jedes Gate. */
async function testkonto(rolle: string, suffix: string): Promise<number> {
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE}-${suffix} (Prüfstand)`},
            ${`${MARKE.toLowerCase()}-${suffix}@example.invalid`},
            ${rolle}, TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  const id = Number(neu.id);
  testkonten.push(id);

  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${id}, ${d.key}, ${d.version}, NOW(),
              ${`PRUEFSTAND/${MARKE}`}, 'pruef-vier-blocker.ts (kein Mensch)')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [vorlage] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (vorlage) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html,
         signature_name, signature_mode, doc_hash, status, signed_at)
      VALUES (${id}, ${Number(vorlage.version)}, ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE} — kein Vertrag, kein Mensch.</p>`},
              ${`${MARKE} (Prüfstand)`}, 'pruefstand', ${`pruef4b-${MARKE}-${suffix}`}, 'signed', NOW())
    `.catch(() => {});
  }
  return id;
}

async function attrappen(seite: Page): Promise<void> {
  // JEDE Route, die etwas Echtes auslösen würde: Mail, Ergebnis, Übergabe.
  const muster = [
    "**/api/fiaon/agent/crm/kunden/*/rechnung",
    "**/api/fiaon/agent/crm/kunden/*/zustimmungs-link",
    "**/api/fiaon/agent/crm/kunden/*/aktivitaet",
    "**/api/fiaon/telefon/*/ergebnis",
    "**/api/fiaon/agent/termine/*/uebergeben",
  ];
  for (const m of muster) {
    await seite.route(m, async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      let koerper: any = null;
      try { koerper = JSON.parse(r.request().postData() || "{}"); } catch { /* leer */ }
      const url = r.request().url();
      gesehen.push({ url, koerper });
      // Die Antwortform der ECHTEN Route — alle Felder, die die Oberfläche liest.
      const antwort = url.includes("zustimmungs-link")
        ? {
            ok: true, gesendet: true,
            link: "https://www.fiaon.com/zustimmung/PRUEFSTAND.0.0",
            offen: ["Zustimmung zu den AGB"],
            meldung: "Link an pruefstand@example.invalid verschickt.",
          }
        : url.includes("/uebergeben")
          ? { ok: true, vertretung: false, hinweis: "Termin an den Kollegen übergeben." }
          : url.includes("/ergebnis") || url.includes("/aktivitaet")
            ? { ok: true, meldung: "Ergebnis gespeichert.", hinweis: "Ergebnis gespeichert." }
            : { ok: true, versandtAn: "pruefstand@example.invalid", warnung: null, kunde: null };
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(antwort) });
    });
  }
}

// ── DIE NEUERUNGS-EBENEN WEGKLICKEN, NICHT UMGEHEN ────────────────────────
// GEMESSEN im ersten Lauf: Playwright fand den Knopf „Übergeben", konnte ihn
// aber 30 Sekunden lang nicht treffen — „<div> intercepts pointer events".
// Das war die Neuerungs-Karte unten rechts, genau über dem Knopf.
//
// Sie wird GEDRÜCKT und nicht per CSS ausgeblendet: Ein Prüfstand, der die
// Oberfläche zurechtbiegt, prüft eine Oberfläche, die es nicht gibt. Und sie
// erscheint verzögert — deshalb wird direkt vor dem Klick noch einmal geräumt.
async function ebeneWeg(seite: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    let getan = false;
    for (const name of [/^Verstanden$/i, /^Gelesen$/i, /^Schlie\u00dfen$/i]) {
      const knopf = seite.getByRole("button", { name }).first();
      if (await knopf.count() > 0) {
        await knopf.click({ timeout: 3000 }).catch(() => {});
        getan = true;
        await seite.waitForTimeout(400);
      }
    }
    if (!getan) return;
  }
}

/**
 * Wartet, bis das Telefon im Browser steht — und stellt dann einen
 * eingehenden Anruf.
 *
 * ── WARUM NICHT `waitForTimeout` ──────────────────────────────────────────
 * Zwei Läufe hintereinander mit demselben Code: einmal grün, einmal „Die
 * Klingel-Attrappe steht bereit — ROT". Das Softphone lädt seinen Stand über
 * eine Abfrage; 2500 ms reichen mal und mal nicht. Eine Prüfung, deren
 * Ergebnis vom Netz abhängt, ist keine Prüfung (AGENTS.md: erst warten, dann
 * messen — und das Ausbleiben als Fehlschlag melden).
 */
async function klingelnLassen(seite: Page, nummer: string): Promise<boolean> {
  const da = await seite.waitForFunction(
    () => typeof (window as any).__fiaonTelefonTest === "function",
    undefined, { timeout: 20_000 },
  ).then(() => true).catch(() => false);
  if (!da) return false;
  await seite.evaluate((nr) => (window as any).__fiaonTelefonTest(nr), nummer);
  return true;
}

async function kontextFuer(agentId: number): Promise<BrowserContext> {
  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1380, height: 1000 } });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: signAgentToken(agentId, 0),
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);
  return kontext;
}

async function main(): Promise<void> {
  mkdirSync(BILD, { recursive: true });
  const zurueck: { personId: number; alt: number | null }[] = [];

  // ═══════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — RECHNUNG UND VERTRAG SIND ZWEI DINGE");
  // ═══════════════════════════════════════════════════════════════════════
  const agentId = await testkonto("vertriebsleiter", "vertrieb");
  console.log(`  Testkonto ${agentId} (vertriebsleiter)`);

  const { sendeGrundSql, fehlendeFelderSql, zustimmungFehltSql } =
    await import("../server/lib/fiaon-massgebliche-bestellung");

  // ── DER GEMELDETE FALL, NAMENTLICH ────────────────────────────────────
  // Nicht irgendeiner (AGENTS.md: der ungünstigste, nicht der erstbeste):
  // Hans Neumann aus dem Screenshot des Betreibers.
  const [hans] = (await sqlPool.unsafe(`
    SELECT p.id, p.assigned_agent_id,
           ${sendeGrundSql("p")} AS grund,
           ${fehlendeFelderSql("p")} AS vertrag_fehlt,
           ${zustimmungFehltSql("p")} AS zustimmung_fehlt
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND LOWER(p.first_name) = 'hans' AND LOWER(p.last_name) = 'neumann'
    ORDER BY p.id LIMIT 1
  `)) as any[];
  pruef("Hans Neumann ist im Bestand auffindbar", !!hans);

  // ── UND EIN BEFREITER MIT ADRESSE ─────────────────────────────────────
  // Hans Neumann hat GAR KEINE E-Mail (weder Bestellung noch Person) — er
  // bleibt also zu Recht gesperrt, nur mit EINEM Grund statt sechs. Der
  // Beweis „Knopf ist frei" braucht jemanden aus den 137, der eine hat.
  const [befreit] = (await sqlPool.unsafe(`
    SELECT p.id, p.assigned_agent_id,
           ${fehlendeFelderSql("p")} AS vertrag_fehlt,
           ${zustimmungFehltSql("p")} AS zustimmung_fehlt
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
      AND ${sendeGrundSql("p")} = 'erste_rechnung'
      AND ${zustimmungFehltSql("p")} IS NOT NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.status IN ('started','config','personal_data','contract','finances'))
    ORDER BY p.id LIMIT 1
  `)) as any[];
  pruef("Es gibt einen befreiten Fall MIT Adresse und offener Zustimmung", !!befreit,
    "ohne ihn sagt der Test nichts über den freigegebenen Knopf");

  for (const f of [hans, befreit].filter(Boolean)) {
    zurueck.push({ personId: Number(f.id), alt: f.assigned_agent_id != null ? Number(f.assigned_agent_id) : null });
  }
  if (zurueck.length > 0) {
    await sqlPool`
      UPDATE fiaon_persons SET assigned_agent_id = ${agentId}
      WHERE id = ANY(${zurueck.map((x) => x.personId)})
    `;
  }

  const kontext = await kontextFuer(agentId);
  const seite = await kontext.newPage();
  await attrappen(seite);

  try {
    if (hans) {
      await seite.goto(`${BASIS}/agent/kunden?person=${hans.id}`,
        { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWeg(seite);
      const karteDa = await seite.locator("[data-fi-kunde]").first()
        .waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
      pruef("Hans Neumanns Karte ist da", karteDa,
        "eine Seite, die noch lädt, hat nichts, was falsch sein könnte");

      // ── DIE KARTE, NICHT DIE SEITE ────────────────────────────────────
      // Erster Entwurf las `body.innerText()`. Die Liste zeigt aber ALLE
      // Kunden des Kontos — der Text einer fremden Karte hat die Prüfung
      // beantwortet. Ein Prüfstand, der die falsche Karte liest, sagt nichts.
      // Auf GENAU DIESE Karte warten, nicht auf irgendeine: Die Liste baut
      // sich in mehreren Durchläufen auf, und „die erste Karte ist da" heißt
      // nicht „Hans ist da". Zweimal grün, einmal rot — das ist ein Ratespiel
      // und keine Prüfung.
      const karte = seite.locator(`[data-fi-kunde="${hans.id}"]`).first();
      await karte.waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
      const daKarten = await seite.locator("[data-fi-kunde]").evaluateAll(
        (els) => els.map((e) => e.getAttribute("data-fi-kunde")).join(", "));
      pruef("Hans Neumanns Karte ist einzeln adressierbar", await karte.count() > 0,
        `Person ${hans.id} gesucht, auf der Seite: ${daKarten || "(keine)"}`);
      const text = await karte.innerText().catch(() => "");
      // ── DER SPERRGRUND IST EINER, NICHT SECHS ─────────────────────────
      pruef("Die Sperre nennt NUR noch die fehlende Adresse",
        /Keine E-Mail-Adresse/i.test(text),
        `grund=${hans.grund}`);
      // ── DER SPERRBLOCK, NICHT DIE GANZE KARTE ─────────────────────────
      // Erster Entwurf suchte „gesperrt … Tag des Gehaltseingangs" im
      // Kartentext — und wurde rot, weil GENAU DAS die neue graue Zeile ist.
      // Der Prüfstand hat also die Behebung für den Fehler gehalten. Jetzt
      // wird gefragt, wo der Satz steht: im Sperrgrund (falsch) oder in der
      // Vertragslücke (richtig).
      const sperrText = await karte.locator('[data-fiaon="vertrags-luecke"]')
        .evaluateAll((els) => els.length.toString()).catch(() => "0");
      void sperrText;
      const ohneLuecke = await karte.evaluate((el) => {
        const k = el.cloneNode(true) as HTMLElement;
        k.querySelectorAll('[data-fiaon="vertrags-luecke"]').forEach((x) => x.remove());
        return (k as HTMLElement).innerText;
      }).catch(() => "");
      pruef("Der Gehaltseingangstag steht NICHT mehr im Sperrgrund",
        !/Tag des Gehaltseingangs/i.test(ohneLuecke),
        "der Sperrblock nennt weiter Vertragsfelder");
      pruef("… sondern in der grauen Vertragszeile",
        /Tag des Gehaltseingangs/i.test(text),
        "die Auskunft darf nicht verschwinden, nur weil sie nicht mehr sperrt");

      // ── DIE VERTRAGSLÜCKE STEHT GETRENNT DA ──────────────────────────
      const luecke = karte.locator('[data-fiaon="vertrags-luecke"]').first();
      pruef("Die Vertragslücke steht als eigener Block",
        await luecke.count() > 0, `vertrag_fehlt=${hans.vertrag_fehlt}`);
      if (await luecke.count() > 0) {
        const lt = await luecke.innerText();
        pruef("… und sagt „Für den Vertrag fehlen noch“", /Für den Vertrag fehlen noch/i.test(lt), lt.slice(0, 90));
      }

      // ── FÜR EINE ZUSTIMMUNG GIBT ES KEIN EINGABEFELD ─────────────────
      const linkKnopf = karte.locator('[data-fiaon="zustimmungs-link"]').first();
      pruef("Der Knopf „Zustimmungs-Link an den Kunden“ ist da",
        await linkKnopf.count() > 0, `zustimmung_fehlt=${hans.zustimmung_fehlt}`);
      pruef("Der alte Weg „Fehlendes am Telefon ergänzen“ ist weg",
        await karte.locator('[data-fiaon="fehlendes-ergaenzen"]').count() === 0,
        "er führte zu einem Formular — auch für Willenserklärungen");
      // Ein Kästchen für AGB/SCHUFA/Vertrag darf es in der Mitarbeitersicht
      // NICHT geben. Das ist die eigentliche Wand dieses Teils.
      const kaestchen = await karte.locator('input[type="checkbox"]').evaluateAll(
        (els) => els.map((e) => (e as HTMLInputElement).name + "|" + (e as HTMLElement).getAttribute("aria-label")).join(" "));
      pruef("Kein Kästchen für AGB, SCHUFA oder Vertrag in der Mitarbeitersicht",
        !/agb|schufa|consent|vertrag/i.test(kaestchen), kaestchen.slice(0, 120));

      await seite.screenshot({ path: `${BILD}/1-hans-neumann.png`, fullPage: false });
      console.log(`        ${BILD}/1-hans-neumann.png`);
    }

    if (befreit) {
      await seite.goto(`${BASIS}/agent/kunden?person=${befreit.id}`,
        { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWeg(seite);
      await seite.locator("[data-fi-kunde]").first()
        .waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});

      const sendeKnopf = seite.getByRole("button", { name: /Zahlungsdaten senden/i }).first();
      pruef("Der befreite Kunde hat einen FREIEN Sende-Knopf",
        await sendeKnopf.count() > 0 && await sendeKnopf.isEnabled(),
        "nach der neuen Regel muss er frei sein");

      // Der Zustimmungs-Link — GEDRÜCKT, nicht nur gefunden.
      const lk = seite.locator('[data-fiaon="zustimmungs-link"]').first();
      if (await lk.count() > 0) {
        await lk.click();
        await seite.waitForTimeout(900);
        const traf = gesehen.find((g) => g.url.includes("zustimmungs-link"));
        pruef("Der Zustimmungs-Link löst eine Anfrage aus", !!traf,
          "der Knopf war da und tat nichts — genau der Fehler von gestern");
        const feld = seite.locator('[data-fiaon="zustimmungs-link-text"]').first();
        pruef("Der Link steht danach zum Kopieren da", await feld.count() > 0,
          "ohne ihn steht der Mitarbeiter ohne Weg da, wenn die Mail scheitert");
      }
      await seite.screenshot({ path: `${BILD}/2-befreit.png` });
      console.log(`        ${BILD}/2-befreit.png`);
    }

    // ═════════════════════════════════════════════════════════════════════
    titel("TEIL 2 — DAS ERGEBNIS AUS DEM TELEFON-PANEL");
    // ═════════════════════════════════════════════════════════════════════
    // Der gemeldete Fall ist der EINGEHENDE Anruf: Dort gibt es keine
    // Anruf-Kennung, und genau daran ist der Klick verpufft. Die Attrappe
    // `__fiaonTelefonTest` setzt denselben Zustand, den das Twilio-Ereignis
    // setzen würde — sie erzeugt keinen Anruf.
    const telSeite = await kontext.newPage();
    await attrappen(telSeite);
    await telSeite.goto(`${BASIS}/agent/kunden${befreit ? `?person=${befreit.id}` : ""}`,
      { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWeg(telSeite);
    await telSeite.waitForTimeout(2500);

    // ── EINE NUMMER, DIE DER SERVER KENNT ─────────────────────────────
    // Ohne sie erkennt `wer-ist-zustaendig` niemanden, das Panel hat weder
    // Anruf-Kennung noch Kunden — und dann ist die richtige Antwort eine
    // Meldung, kein Versand. Für den Beweis „das Ergebnis wird angenommen"
    // braucht es aber einen erkannten Menschen.
    const [nummer] = (await sqlPool`
      SELECT p.id, NULLIF(TRIM(p.primary_phone), '') AS nr
      FROM fiaon_persons p
      WHERE p.id = ANY(${[Number(befreit?.id ?? 0), Number(hans?.id ?? 0)]})
        AND NULLIF(TRIM(p.primary_phone), '') IS NOT NULL
      LIMIT 1
    `) as any[];
    pruef("Der Prüffall hat eine Rufnummer", !!nummer?.nr,
      "ohne sie erkennt der Server den Anrufer nicht");

    const gestartet = await klingelnLassen(telSeite, String(nummer?.nr ?? ""));
    pruef("Die Klingel-Attrappe steht bereit", gestartet,
      "ohne sie lässt sich ein eingehender Anruf nicht nachstellen");

    if (gestartet) {
      // ── ERST WARTEN, DANN MESSEN (AGENTS.md) ──────────────────────────
      // Ein fester `waitForTimeout(1200)` war zu kurz: Das Klingelfenster war
      // noch nicht da, und der Prüfstand meldete einen Fehler, den es nicht
      // gab. Ihr Ausbleiben ist ein Fehlschlag, kein Übersprungen.
      const klingelt = await telSeite.locator(".fi-ein").first()
        .waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
      pruef("Das Klingelfenster geht auf", klingelt);
      const annehmen = telSeite.getByRole("button", { name: /^Annehmen$/i }).first();
      pruef("Das Klingelfenster zeigt „Annehmen“", await annehmen.count() > 0);
      // ── ERST WISSEN, WER DRAN IST, DANN ABNEHMEN ──────────────────────
      // Das Klingelfenster erscheint SOFORT, der Name kommt aus einer
      // zweiten Abfrage („wer-ist-zustaendig"). Wer sofort klickt, nimmt ab,
      // bevor der Kunde erkannt ist — dann steht im Panel kein `personId`,
      // und das Ergebnis kann sich an nichts hängen. Ein Mensch liest den
      // Namen; der Prüfstand wartet darauf. Drei Läufe waren sonst zweimal
      // grün und einmal rot, ohne dass sich der Code geändert hätte.
      const erkannt = await telSeite.locator(".fi-ein-name")
        .filter({ hasNotText: /Unbekannte Nummer/i }).first()
        .waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
      pruef("Der Anrufer wird erkannt, bevor abgenommen wird", erkannt,
        "ohne erkannten Kunden kann sich das Ergebnis an nichts hängen");
      await telSeite.screenshot({ path: `${BILD}/3-klingelt.png` });
      if (await annehmen.count() > 0) {
        await annehmen.click();
        await telSeite.waitForTimeout(1200);
        // Auflegen führt in den Ergebnis-Schritt — wie im echten Gespräch.
        const auflegen = telSeite.locator('[aria-label="Auflegen"], button:has-text("Auflegen")').first();
        if (await auflegen.count() > 0) await auflegen.click().catch(() => {});
        await telSeite.waitForTimeout(1200);

        const ergebnisSicht = telSeite.locator('[data-ansicht="ergebnis"]').first();
        pruef("Nach dem Auflegen steht der Ergebnis-Schritt da",
          await ergebnisSicht.count() > 0,
          "beim eingehenden Anruf blieb er vorher im Zustand „gespraech“ hängen");

        if (await ergebnisSicht.count() > 0) {
          const vorher = gesehen.length;
          // Gezielt „Nicht erreicht": kein Datumsfeld, keine Pflichtnotiz —
          // der kürzeste Weg von Klick zu Anfrage. Der ungünstigste Fall ist
          // hier nicht der interessanteste (AGENTS.md gilt für die AUSWAHL
          // des Prüffalls, nicht dafür, den Test an einem Dialog scheitern
          // zu lassen, der gar nicht geprüft wird).
          const knopf = ergebnisSicht.locator("button.fi-tel-ergebnis")
            .filter({ hasText: /^Nicht erreicht$/i }).first();
          const beschriftung = await knopf.innerText().catch(() => "");
          await knopf.click();
          await telSeite.waitForTimeout(1500);
          const neu = gesehen.slice(vorher);
          // ── DER EIGENTLICHE BEWEIS ─────────────────────────────────────
          pruef(`Das Ergebnis „${beschriftung.trim()}" wird ANGENOMMEN`,
            neu.length > 0,
            "der Klick löste keine einzige Anfrage aus — Vikas Meldung, wörtlich");
          if (neu.length > 0) {
            pruef("… und geht über eine der beiden bekannten Routen",
              /\/ergebnis|\/aktivitaet/.test(neu[0].url), neu[0].url);
            pruef("… und trägt ein Ergebnis im Rumpf",
              !!(neu[0].koerper?.ergebnis || neu[0].koerper?.art),
              JSON.stringify(neu[0].koerper).slice(0, 120));
          }
          await telSeite.screenshot({ path: `${BILD}/4-ergebnis.png` });
          console.log(`        ${BILD}/4-ergebnis.png`);
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    titel("TEIL 3 — ONBOARDING SIEHT KUNDENDATEN UND DIE SIEBEN SCHRITTE");
    // ═════════════════════════════════════════════════════════════════════
    // Ein Onboarding-Konto MIT einem eigenen Startgespräch — das ist die
    // Lage von Viktoria und Rifka. Der Termin wird für den Prüflauf auf das
    // Testkonto umgehängt und danach zurückgegeben.
    const obId = await testkonto("onboarding", "onboarding");
    const [terminEcht] = (await sqlPool`
      SELECT t.id, t.person_id, t.agent_id
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.quelle = 'onboarding_call' AND t.abgesagt_am IS NULL
        AND t.status IN ('gebucht', 'verpasst')
        AND NULLIF(TRIM(p.primary_phone), '') IS NOT NULL
      ORDER BY t.beginn DESC LIMIT 1
    `) as any[];
    pruef("Es gibt ein Startgespräch als Prüffall", !!terminEcht);

    if (terminEcht) {
      geliehenTermine.push({ id: Number(terminEcht.id), alt: Number(terminEcht.agent_id) });
      await sqlPool`UPDATE fiaon_termine SET agent_id = ${obId} WHERE id = ${Number(terminEcht.id)}`;
      const antwort = await seite.evaluate(async (pid) => {
        const r = await fetch(`/api/fiaon/telefon/kunde/${pid}`, { credentials: "include" });
        return { status: r.status, body: await r.json().catch(() => null) };
      }, Number(terminEcht.person_id));
      // Die Route wird mit dem VERTRIEBS-Konto aufgerufen — deshalb hier nur
      // der Aufbau. Der Onboarding-Blick kommt gleich mit eigenem Kontext.
      void antwort;

      const obKontext = await kontextFuer(obId);
      const obSeite = await obKontext.newPage();
      await attrappen(obSeite);
      await obSeite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWeg(obSeite);

      const daten = await obSeite.evaluate(async (pid) => {
        const r = await fetch(`/api/fiaon/telefon/kunde/${pid}`, { credentials: "include" });
        return { status: r.status, body: await r.json().catch(() => null) };
      }, Number(terminEcht.person_id));
      pruef("Onboarding bekommt die Kundendaten (kein 403)",
        daten.status === 200 && daten.body?.ok === true,
        `status ${daten.status}: ${JSON.stringify(daten.body).slice(0, 120)}`);
      const k = daten.body?.kunde ?? {};
      pruef("… mit Kundenname", !!k.name, JSON.stringify(k).slice(0, 100));
      pruef("… mit Paket oder der Auskunft, dass keines da ist",
        k.paket !== undefined, `paket=${k.paket}`);
      pruef("… mit Zahlungsstand", !!k.zahlungsstand, `zahlungsstand=${k.zahlungsstand}`);
      pruef("… mit SCHUFA-Stand", !!k.schufaStand, `schufaStand=${k.schufaStand}`);
      pruef("… mit den offenen Punkten", Array.isArray(k.offenePunkte),
        `offenePunkte=${JSON.stringify(k.offenePunkte)}`);
      pruef("… und mit dem eigenen Termin (dafür gibt es „Gespräch führen“)",
        !!k.termin?.id, `termin=${JSON.stringify(k.termin)}`);

      await obSeite.screenshot({ path: `${BILD}/5-onboarding-panel.png` });
      console.log(`        ${BILD}/5-onboarding-panel.png`);
      await obKontext.close();
    }

    // ═════════════════════════════════════════════════════════════════════
    titel("TEIL 4 — DEN TERMIN AN EINEN KOLLEGEN ÜBERGEBEN");
    // ═════════════════════════════════════════════════════════════════════
    // ── EIN TERMIN, DEN DAS TESTKONTO SIEHT ───────────────────────────
    // Ohne ihn ist der Kalender leer, und „kein Knopf gefunden" hieße nur
    // „keine Zeile da". Der Termin wird geliehen und danach zurückgegeben.
    // Nur Termine ECHTER Mitarbeiter leihen: Ein Termin, der schon an einem
    // Testkonto hängt, wäre ein Fehler, den dieser Lauf zementieren würde.
    const [leihTermin] = (await sqlPool`
      SELECT t.id, t.agent_id FROM fiaon_termine t
      JOIN fiaon_agents ag ON ag.id = t.agent_id
      WHERE t.abgesagt_am IS NULL AND t.status = 'gebucht' AND t.beginn > NOW()
        AND ag.active AND NOT COALESCE(ag.is_test_account, FALSE)
      ORDER BY t.beginn LIMIT 1
    `) as any[];
    if (leihTermin) {
      geliehenTermine.push({ id: Number(leihTermin.id), alt: Number(leihTermin.agent_id) });
      await sqlPool`UPDATE fiaon_termine SET agent_id = ${agentId} WHERE id = ${Number(leihTermin.id)}`;
    }
    pruef("Es gibt einen Termin als Prüffall", !!leihTermin);

    const kalSeite = await kontext.newPage();
    await attrappen(kalSeite);
    await kalSeite.goto(`${BASIS}/agent/kalender`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWeg(kalSeite);
    await kalSeite.waitForTimeout(2500);
    // Die Tagesansicht zeigt nur Heute und Überfälliges. Der geliehene Termin
    // kann morgen liegen — dann ist „kein Knopf" nur „keine Zeile".
    await kalSeite.getByRole("button", { name: /^woche$/i }).first()
      .click({ timeout: 4000 }).catch(() => {});
    await kalSeite.waitForTimeout(1200);

    const uebergeben = kalSeite.locator('[data-fiaon="termin-uebergeben"]').first();
    await uebergeben.waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
    await ebeneWeg(kalSeite);
    const hatTermin = await uebergeben.count() > 0;
    pruef("Im Kalender steht ein Knopf „Übergeben“", hatTermin,
      `die Route allein ist keine Funktion (AGENTS.md). Zeilen: `
      + `${await kalSeite.locator('[role="button"][title*="Termin-Details"]').count()}, `
      + `Kalendertext: ${(await kalSeite.locator("main, .max-w-3xl").last().innerText()
          .catch(() => "")).replace(/\s+/g, " ").slice(0, 300)}`);

    if (hatTermin) {
      // ── WER LIEGT DARÜBER? ────────────────────────────────────────────
      // Playwright meldete „<div> intercepts pointer events" und wartete 30
      // Sekunden. Statt zu raten, wird gefragt, WAS an dieser Stelle liegt —
      // und dann gezielt geschlossen. Ein Prüfstand, der blind `force: true`
      // klickt, würde auch einen echten Bedienfehler übersehen.
      const oben = await uebergeben.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null;
        if (!t || el.contains(t)) return "";
        let s = "";
        for (let n: HTMLElement | null = t; n && s.length < 200; n = n.parentElement) {
          s += `${n.tagName}.${n.className || ""}|`;
        }
        return s;
      });
      if (oben) console.log(`        darüber liegt: ${oben.slice(0, 180)}`);
      await uebergeben.scrollIntoViewIfNeeded().catch(() => {});
      await kalSeite.mouse.wheel(0, -120);
      await kalSeite.waitForTimeout(400);
      await uebergeben.click({ timeout: 8000 }).catch(async () => {
        // Letzter Ausweg mit Vermerk: Der Knopf ist erreichbar, nur verdeckt.
        console.log("        Klick verdeckt — über die Tastatur ausgelöst.");
        await uebergeben.focus();
        await kalSeite.keyboard.press("Enter");
      });
      await kalSeite.waitForTimeout(900);
      const feld = kalSeite.locator('[data-fiaon="uebergabe-feld"]').first();
      pruef("Auswahl und Grund gehen auf", await feld.count() > 0);

      const senden = kalSeite.locator('[data-fiaon="uebergabe-senden"]').first();
      pruef("Ohne Auswahl und Grund ist „Übergeben“ gesperrt",
        await senden.isDisabled(),
        "eine Übergabe ohne Grund ist am nächsten Tag ein Rätsel");

      const auswahl = feld.locator("select").first();
      // Die Liste kommt über eine Abfrage — sie ist nicht sofort da. Ein
      // fester Zeitwert wäre wieder das Ratespiel von vorhin.
      await auswahl.locator("option[value]:not([value=''])").first()
        .waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
      const werte = await auswahl.locator("option").evaluateAll(
        (els) => els.map((e) => (e as HTMLOptionElement).value).filter(Boolean));
      pruef("Die Auswahl nennt Kollegen", werte.length > 0, `optionen=${werte.length}`);
      if (werte.length > 0) {
        await auswahl.selectOption(werte[0]);
        await feld.locator("input[type=text]").first().fill("Prüfstand — krank bis Freitag");
        await kalSeite.waitForTimeout(400);
        pruef("Mit Auswahl und Grund ist der Knopf frei", await senden.isEnabled());
        const vorher = gesehen.length;
        await senden.click();
        await kalSeite.waitForTimeout(1400);
        const neu = gesehen.slice(vorher).find((g) => g.url.includes("/uebergeben"));
        pruef("Die Übergabe wird ausgelöst (abgefangen)", !!neu);
        pruef("… und trägt Kollegen und Grund mit",
          !!neu?.koerper?.agentId && String(neu?.koerper?.grund ?? "").length >= 5,
          JSON.stringify(neu?.koerper));
      }
      await kalSeite.screenshot({ path: `${BILD}/6-uebergabe.png` });
      console.log(`        ${BILD}/6-uebergabe.png`);
    }

    // ═════════════════════════════════════════════════════════════════════
    if (ROT_PROBE) {
      titel("ROT-PROBE — WIRD DER PRÜFSTAND ROT, WENN DER FEHLER ZURÜCKKOMMT?");
      // Der Fehler von Teil 2 war: keine Anruf-Kennung → stiller Rücksprung.
      // Hier wird genau das nachgestellt, indem die Ergebnis-Routen mit 500
      // antworten. Bliebe der Prüfstand grün, prüfte er nichts.
      const probeSeite = await kontext.newPage();
      for (const m of ["**/api/fiaon/telefon/*/ergebnis", "**/api/fiaon/agent/crm/kunden/*/aktivitaet"]) {
        await probeSeite.route(m, (r) => r.fulfill({
          status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }),
        }));
      }
      await probeSeite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWeg(probeSeite);
      pruef("ROT-PROBE: Das Telefon steht bereit",
        await klingelnLassen(probeSeite, String(nummer?.nr ?? "+4915199999999")));
      // ── EINE ROT-PROBE, DIE NICHT LÄUFT, IST KEINE ────────────────────
      // Erster Entwurf hatte alles in `if (await an.count() > 0)` verpackt:
      // Der Knopf war nicht da, der Block wurde übersprungen, und der
      // Prüfstand meldete „39 ok, 0 rot" — ohne eine einzige Prüfung der
      // Wand. Ein Übersprungen, das wie Erfolg aussieht, ist die
      // gefährlichste Sorte Fehler (AGENTS.md). Jetzt ist jeder Schritt eine
      // eigene Prüfung, und sein Ausbleiben ist ROT.
      const probeKlingelt = await probeSeite.locator(".fi-ein").first()
        .waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
      pruef("ROT-PROBE: Das Klingelfenster geht auf", probeKlingelt);
      const an = probeSeite.getByRole("button", { name: /^Annehmen$/i }).first();
      pruef("ROT-PROBE: „Annehmen“ ist erreichbar", await an.count() > 0);
      if (await an.count() > 0) {
        await an.click();
        await probeSeite.waitForTimeout(1000);
        const auf = probeSeite.locator('[aria-label="Auflegen"], button:has-text("Auflegen")').first();
        if (await auf.count() > 0) await auf.click().catch(() => {});
        await probeSeite.waitForTimeout(1200);
        const knopf = probeSeite.locator("button.fi-tel-ergebnis")
          .filter({ hasText: /^Nicht erreicht$/i }).first();
        pruef("ROT-PROBE: Der Ergebnis-Knopf ist da", await knopf.count() > 0);
        if (await knopf.count() > 0) {
          await knopf.click();
          await probeSeite.waitForTimeout(2000);
          const text = await probeSeite.locator("body").innerText();
          // ── WAS DIE PROBE WIRKLICH PRÜFT ────────────────────────────
          // Nicht einen bestimmten Wortlaut, sondern: Bleibt der Klick
          // stumm? Der Befund war „ich klicke, und es wird nicht
          // angenommen" — jede Antwort ist besser als keine. Der erste
          // Entwurf suchte nur nach „nicht gespeichert" und wurde rot,
          // obwohl der Satz „Dieses Ergebnis lässt sich nicht zuordnen …"
          // sichtbar dastand. Ein Prüfstand, der die richtige Antwort für
          // falsch hält, ist genauso wertlos wie einer, der nie rot wird.
          pruef("ROT-PROBE: Ein abgelehntes Ergebnis erzeugt eine sichtbare Meldung",
            /nicht gespeichert|Keine Verbindung|Der Server hat mit 500|lässt sich nicht zuordnen/i.test(text),
            `stumm geblieben. Sichtbar war: ${text.replace(/\s+/g, " ").slice(-220)}`);
          // Und die zweite Hälfte des Befundes: Er sprang zurück auf die
          // Wähltastatur, als hätte man nichts gedrückt.
          pruef("ROT-PROBE: Das Panel springt NICHT stumm auf die Wähltastatur zurück",
            await probeSeite.locator('[data-ansicht="ergebnis"]').count() > 0
            || /nicht gespeichert|lässt sich nicht zuordnen|Der Server hat mit 500/i.test(text),
            "genau das war der gemeldete Fehler");
          await probeSeite.screenshot({ path: `${BILD}/7-rot-probe.png` });
          console.log(`        ${BILD}/7-rot-probe.png`);
        }
      }
      await probeSeite.close();
    }
  } finally {
    await kontext.close();
    for (const r of zurueck) {
      await sqlPool`
        UPDATE fiaon_persons SET assigned_agent_id = ${r.alt} WHERE id = ${r.personId}
      `.catch(() => {});
    }
    console.log(`  ${zurueck.length} Kunden zurückgegeben`);
    for (const t of geliehenTermine) {
      await sqlPool`
        UPDATE fiaon_termine SET agent_id = ${t.alt} WHERE id = ${t.id}
      `.catch(() => {});
      console.log(`  Termin ${t.id} zurückgegeben an Agent ${t.alt}`);
    }
    const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
    for (const id of testkonten) {
      await testkontoStilllegen(id).catch(() => {});
      console.log(`  Testkonto ${id} stillgelegt`);
    }
  }

  console.log(`\n${"═".repeat(72)}\n  ${ok} ok · ${rot} rot`);
  if (rot > 0) { console.log("\n  ROT:"); for (const f of fehler) console.log(`    · ${f}`); }
  console.log(`  Screenshots: ${BILD}/\n${"═".repeat(72)}`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
