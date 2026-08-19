// ═══════════════════════════════════════════════════════════════════════════
// WAND + BROWSER-ABNAHME: VERGÜTUNGS-STEUERUNG UND BANKVERBINDUNG
//
// Der Befund kam aus einem SCREENSHOT. AGENTS.md: „Wenn der Auftrag aus einem
// BILD kommt, ist das Bild die Abnahme." Also: echte Route, Reiter drücken,
// Abschnitte messen, Desktop UND 380 px ansehen.
//
// ── ES ENTSTEHT KEINE VERGÜTUNGSÄNDERUNG AN ECHTEN MENSCHEN ───────────────
// Alle schreibenden Prüfungen laufen gegen ein TESTKONTO, das sich am Ende
// selbst stilllegt. Am echten Mitarbeiter wird nur GELESEN.
//
//   npx tsx scripts/pruef-verguetung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";
import { berlinToday } from "../server/lib/fiaon-time";
import { encryptSecret, maskIban } from "../server/routes/fiaon-agent";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-verguetung";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}
function ohneKommentar(t: string): string {
  return t.split("\n").filter((z) => {
    const x = z.trim();
    return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
  }).join("\n");
}

const stillzulegen: number[] = [];

/** Öffnet die Verwaltungs-Schleuse und die Akte eines Menschen im Reiter. */
async function reiterOeffnen(
  kontext: BrowserContext, page: Page, name: string, reiter: RegExp,
  testkonto = false,
): Promise<boolean> {
  await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } })
    .catch(() => null);
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  // ── TESTKONTEN SIND AUSGEBLENDET — UND DAS IST RICHTIG ──────────────────
  // `echteMitarbeiterSql` haelt sie aus der Team-Zentrale heraus (AGENTS.md).
  // Der erste Lauf suchte die Karte des Prüfkontos und fand sie nicht: 13 rote
  // Zeilen, von denen keine etwas über den geprüften Reiter sagte.
  // Die Zentrale hat für genau diesen Fall einen Filter — er wird gedrückt.
  if (testkonto) {
    const filter = page.getByRole("button", { name: /^Testkonten \d+$/ }).first();
    if (await filter.count() > 0) {
      await filter.click();
      await page.waitForTimeout(3000);
    }
  }
  // ── DEN NAMEN MASKIEREN, BEVOR ER EIN REGEX WIRD ───────────────────────
  // Der Prüffall heisst „Prüfstand Ansicht (Testkonto)". Die Klammern sind in
  // einem Regex eine GRUPPE — gesucht wurde also „Prüfstand Ansicht Testkonto"
  // ohne Klammern, und die Karte war „nicht gefunden". Sie stand die ganze Zeit
  // oben rechts auf dem Bildschirm; nur der Screenshot hat es gezeigt.
  const sicher = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const karte = page.getByRole("button", { name: new RegExp(sicher, "i") }).first();
  if (await karte.count() === 0) {
    mkdirSync(BILDER, { recursive: true });
    await page.screenshot({ path: `${BILDER}/fehlgriff-karte.png` });
    log(`        Karte „${name}“ nicht gefunden — Bild: ${BILDER}/fehlgriff-karte.png`);
    return false;
  }
  await karte.click();
  await page.waitForTimeout(1200);
  const profil = page.getByRole("button", { name: /^Profil öffnen$/i }).first();
  if (await profil.count() > 0) await profil.click();
  await page.waitForTimeout(4000);
  const r = page.getByRole("button", { name: reiter }).first();
  if (await r.count() === 0) return false;
  await r.click();
  // Auf einen Abschnitt im INHALT warten, nicht auf die Uhr.
  await page.locator("[data-fiaon='abschnitt-bank']").first()
    .waitFor({ timeout: 25_000 }).catch(() => {});
  return true;
}

async function main(): Promise<void> {
  log("\n══ Vergütungs-Steuerung ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Eine Quelle für Vorschau und Abrechnung");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Auftrag: „Diese Vorschau liest dieselbe Berechnung wie die Abrechnung
  // (EINE Quelle — Grep, dass keine zweite Rechnung entsteht)."
  const lib = ohneKommentar(readFileSync("server/lib/fiaon-verguetung.ts", "utf8"));
  const routen = ohneKommentar(readFileSync("server/routes/fiaon-verguetung.ts", "utf8"));
  const tafel = readFileSync("client/src/components/admin/VerguetungTafel.tsx", "utf8");
  ok("Es gibt EIN Modul, das die Vergütung beantwortet",
    /export async function provisionCents/.test(lib)
    && /export async function pauschaleCents/.test(lib)
    && /export async function monatsVorschau/.test(lib));
  ok("Die Route rechnet NICHT selbst, sie ruft das Modul",
    /monatsVorschau\(/.test(routen) && !/SUM\(amount_cents\)/.test(routen),
    "in der Route steht wieder eine eigene Summenrechnung");
  ok("Die Oberfläche rechnet NICHT selbst",
    !/reduce\(\(s[^)]*\) => s \+/.test(tafel), "in der Tafel wird summiert");
  // Die Vorschau liest GEBUCHTE Zeilen — nicht eine Neuberechnung. Das ist das
  // Einfrier-Prinzip: Eine Satzänderung darf eine gebuchte Zeile nicht bewegen.
  ok("Die Vorschau liest gebuchte Positionen (fiaon_commissions)",
    /FROM fiaon_commissions/.test(lib));
  ok("Die Pauschal-Anlässe stehen an EINER Stelle",
    /export const PAUSCHAL_ANLAESSE/.test(lib));
  ok("Der Rückfall auf die Altfelder ist ausdrücklich benannt",
    /herkunft: "person"/.test(lib) && /herkunft: "vorgabe"/.test(lib));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die Wände: Zukunft, Grund, Rechtsgrund");
  // ═════════════════════════════════════════════════════════════════════════
  ok("Rückwirkende Gültigkeit wird abgelehnt",
    /gueltigAb < heute/.test(routen) && /Vergangenheit/.test(routen));
  ok("Ein Abzug ohne Grund wird abgelehnt",
    /typ === "einmalig"[\s\S]{0,400}?braucht einen Grund/.test(routen));
  ok("Ein Fixum mit Rechtsgrund Anstellung wird NICHT gebucht",
    /schluessel: "anstellung", text: "Anstellung", buchen: false/.test(lib));
  ok("Ein Baustein wird abgelöst, nicht überschrieben",
    /loest_ab_id/.test(routen) && /entfernt_am = NOW\(\)/.test(routen));
  ok("Jede Änderung geht mit Alt→Neu ins Protokoll",
    /verguetung_baustein_geaendert/.test(routen) && /alt: beschreibung\(alt\)/.test(routen));
  ok("Die vollständige IBAN wird bei jeder Einsicht protokolliert",
    /bank_viewed_by_admin/.test(routen));
  ok("Die Auszahlungs-Freigabe zeigt die IBAN vollständig",
    /iban_full: decryptSecret\(p\.bank_iban_enc\),/
      .test(ohneKommentar(readFileSync("server/routes/fiaon-team.ts", "utf8"))));

  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Der Reiter im Browser — fünf Abschnitte");
  // ═════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // DER PRÜFFALL IST EIN TESTKONTO — UND ZWAR AUS EINEM HANDFESTEN GRUND
  //
  // Erster Entwurf nahm einen echten Mitarbeiter mit hinterlegten Bankdaten.
  // Ergebnis: „Die IBAN steht vollständig da" wurde ROT — und die Ursache lag
  // nicht in der Maske.
  //
  // Der Schlüssel für die Bankdaten wird aus SESSION_SECRET abgeleitet. Diese
  // Variable steht auf dem Entwicklungsrechner NICHT in der .env, also greift
  // der Rückfallwert — und der öffnet die mit dem Produktionsschlüssel
  // verschlüsselten Werte nicht. `decryptSecret` gibt sauber `null` zurück.
  //
  // Das ist Absicht und soll so bleiben: Zahlungsdaten sollen sich nicht auf
  // jedem Rechner öffnen lassen. Für den Prüfstand heisst es: Er muss seine
  // EIGENEN Bankdaten anlegen, mit dem hier gültigen Schlüssel. Dann prüft er
  // den Anzeigeweg — und nicht die Schlüsselverwaltung.
  //
  // Die Daten sind erkennbar erfunden (LT-IBAN aus dem Testbereich) und werden
  // am Ende mit dem Konto stillgelegt.
  // ══════════════════════════════════════════════════════════════════════════
  const bcryptV = (await import("bcryptjs")).default;
  const schauMail = `pruef-vgschau-${Date.now().toString(36)}@pruefstand.test`;
  const TEST_IBAN = "DE02120300000000202051";
  const [schau] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at,
                              bank_holder_enc, bank_iban_enc, bank_bic_enc,
                              bank_iban_masked, bank_updated_at, bank_change_ack)
    VALUES ('Prüfstand Ansicht (Testkonto)', ${schauMail},
            ${await bcryptV.hash(`P-${Math.random()}`, 10)}, 'agent', TRUE, TRUE, FALSE, NOW(),
            ${encryptSecret("Prüfstand Ansicht")}, ${encryptSecret(TEST_IBAN)},
            ${encryptSecret("BYLADEM1001")}, ${maskIban(TEST_IBAN)}, NOW(), TRUE)
    RETURNING id, name
  `) as any[];
  stillzulegen.push(Number(schau.id));
  const wer = schau;
  log(`        Prüffall: ${wer.name} — eigene Testbankdaten, lokal verschlüsselt\n`);
  {
    const kontext = await browser.newContext({ viewport: { width: 1500, height: 1150 } });
    await kontext.route("**/api/**", async (r) => {
      const m = r.request().method();
      if (m === "GET" || m === "HEAD" || r.request().url().includes("/api/fiaon/zugang")) return r.fallback();
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const page = await kontext.newPage();
    const konsole: string[] = [];
    page.on("pageerror", (e) => konsole.push(String(e.message)));

    const auf = await reiterOeffnen(kontext, page, String(wer.name), /Vergütung & Stunden/i, true);
    ok("Der Reiter „Vergütung & Stunden“ öffnet", auf);

    for (const [marke, titel] of [
      ["abschnitt-bank", "Bankverbindung"],
      ["abschnitt-modell", "Vergütungsmodell"],
      ["abschnitt-vorschau", "Vorschau"],
      ["abschnitt-stunden", "Stunden & Prämien"],
      ["abschnitt-verlauf", "Verlauf der Änderungen"],
    ] as const) {
      ok(`Abschnitt „${titel}“ ist da`,
        await page.locator(`[data-fiaon='${marke}']`).count() > 0);
    }

    // ── TEIL 1: DIE BANKVERBINDUNG, VOLLSTÄNDIG ───────────────────────────
    const iban = await page.locator("[data-fiaon='bank-iban']").first().innerText().catch(() => "");
    ok("Die IBAN steht vollständig da (nicht maskiert)",
      iban.length > 12 && !iban.includes("•") && !iban.includes("*"), iban);
    log(`        IBAN im Reiter: ${iban.slice(0, 6)}…${iban.slice(-4)} (${iban.length} Zeichen)`);
    ok("Der Kontoinhaber steht dabei",
      (await page.locator("[data-fiaon='bank-inhaber']").innerText().catch(() => "")).trim().length > 2);
    ok("Es gibt einen Kopier-Knopf für die IBAN",
      await page.locator("[data-fiaon='iban-kopieren']").count() > 0);
    const t = await page.locator("body").innerText().catch(() => "");
    ok("„Zuletzt geändert“ steht dabei", /Zuletzt geändert/i.test(t));

    // ── TEIL 3: DIE MASKE ─────────────────────────────────────────────────
    ok("Der Grammatikfehler „Vom Vorgesetzter“ ist weg",
      !/Vom Vorgesetzter/.test(t), "steht noch da");
    // Der orange Kasten gehört in den Stunden-Abschnitt, nicht über alles.
    const kasten = page.locator("[data-fiaon='stunden-bestaetigen-hinweis']");
    if (await kasten.count() > 0) {
      const yKasten = (await kasten.first().boundingBox())?.y ?? 0;
      const yBank = (await page.locator("[data-fiaon='abschnitt-bank']").first().boundingBox())?.y ?? 0;
      ok("Der Bestätigungs-Kasten steht UNTER der Bankverbindung",
        yKasten > yBank, `Kasten y=${Math.round(yKasten)}, Bank y=${Math.round(yBank)}`);
    } else {
      log("        (Der Bestätigungs-Kasten erscheint nur bei unbestätigter Vergütung.)");
    }
    ok("Der Systemhinweis zur Zeiterfassung steht klein am Ende",
      await page.locator("[data-fiaon='stunden-systemhinweis']").count() > 0
      || /inkasso/i.test(String(wer.name)));

    // ── TEIL 2: DIE VORSCHAU ──────────────────────────────────────────────
    const summe = await page.locator("[data-fiaon='vorschau-summe']").innerText().catch(() => "");
    ok("Die Vorschau nennt eine Summe", /\d/.test(summe), summe);
    log(`        Vorschau-Summe im Reiter: ${summe}`);
    ok("Die fünf Knöpfe für neue Bausteine sind da",
      (await page.locator("[data-fiaon^='neu-']").count()) === 5,
      `${await page.locator("[data-fiaon^='neu-']").count()} gefunden`);

    // Ein Formular AUFKLAPPEN und den Anstellungs-Hinweis prüfen.
    await page.locator("[data-fiaon='neu-fixum']").click();
    await page.waitForTimeout(800);
    ok("Das Formular für ein Fixum klappt auf",
      await page.locator("[data-fiaon='baustein-formular']").count() > 0);
    await page.selectOption("[data-fiaon='feld-rechtsgrund']", "anstellung");
    await page.waitForTimeout(600);
    ok("Bei „Anstellung“ erscheint der Lohnabrechnungs-Hinweis SOFORT",
      await page.locator("[data-fiaon='hinweis-anstellung']").count() > 0);
    const hw = await page.locator("[data-fiaon='hinweis-anstellung']").innerText().catch(() => "");
    ok("Er sagt, dass NICHT als Provisionsgutschrift gebucht wird",
      /LOHNABRECHNUNG/i.test(hw) && /NICHT/.test(hw), hw.slice(0, 100));

    ok("Kein JS-Fehler auf der Seite", konsole.length === 0, konsole.slice(0, 2).join(" | "));
    await bild(page, "neu-reiter-desktop");
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. 380 Pixel — die schmale Ansicht");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const kontext = await browser.newContext({ viewport: { width: 380, height: 900 } });
    await kontext.route("**/api/**", async (r) => {
      const m = r.request().method();
      if (m === "GET" || m === "HEAD" || r.request().url().includes("/api/fiaon/zugang")) return r.fallback();
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const page = await kontext.newPage();
    const auf = await reiterOeffnen(kontext, page, String(wer.name), /Vergütung & Stunden/i, true);
    ok("Der Reiter öffnet auch bei 380 px", auf);
    if (auf) {
      // Nichts darf über den Rand laufen.
      const breite = await page.evaluate("document.documentElement.scrollWidth") as number;
      ok("Kein waagerechtes Scrollen bei 380 px", Number(breite) <= 382, `${breite} px breit`);
      const ibanEl = page.locator("[data-fiaon='bank-iban']").first();
      if (await ibanEl.count() > 0) {
        const box = await ibanEl.boundingBox();
        ok("Die IBAN bleibt im Bild", (box?.x ?? 0) + (box?.width ?? 0) <= 380,
          `endet bei ${Math.round((box?.x ?? 0) + (box?.width ?? 0))} px`);
      }
      await bild(page, "neu-reiter-380");
    }
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Schreiben — gegen ein TESTKONTO, nicht gegen Menschen");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const bcrypt = (await import("bcryptjs")).default;
    const mail = `pruef-vg-${Date.now().toString(36)}@pruefstand.test`;
    const [k] = (await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                                distribution_active, created_at)
      VALUES ('Prüfstand Vergütung (Testkonto)', ${mail},
              ${await bcrypt.hash(`P-${Math.random()}`, 10)}, 'agent', TRUE, TRUE, FALSE, NOW())
      RETURNING id
    `) as any[];
    const id = Number(k.id);
    stillzulegen.push(id);

    const kontext = await browser.newContext();
    await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
    const heute = await berlinToday();

    // Ein Fixum mit Anstellung — darf NICHT buchbar sein.
    const r1 = await kontext.request.post(`${BASIS}/api/fiaon/admin/verguetung/${id}/baustein`, {
      data: { typ: "fixum", betragEuro: "2000,00", rechtsgrund: "anstellung", gueltigAb: heute },
    });
    const j1 = await r1.json().catch(() => null);
    ok("Ein Fixum lässt sich anlegen", r1.ok(), `HTTP ${r1.status()}`);
    ok("Bei Anstellung kommt der Hinweis zur Lohnabrechnung zurück",
      /Lohnabrechnung/i.test(String(j1?.hinweis ?? "")), String(j1?.hinweis ?? ""));
    const [gespeichert] = (await sqlPool`
      SELECT buchen, rechtsgrund FROM fiaon_verguetung_bausteine
       WHERE agent_id = ${id} AND typ = 'fixum' AND entfernt_am IS NULL
    `) as any[];
    ok("Und es ist als NICHT buchbar gespeichert", gespeichert?.buchen === false);

    // ── ROT-PROBE 1: rückwirkend ──────────────────────────────────────────
    const r2 = await kontext.request.post(`${BASIS}/api/fiaon/admin/verguetung/${id}/baustein`, {
      data: { typ: "stundensatz", betragEuro: "20,00", gueltigAb: "2026-01-01" },
    });
    ok("Rot-Probe: rückwirkende Gültigkeit wird abgelehnt (400)", r2.status() === 400,
      `HTTP ${r2.status()}`);
    const j2 = await r2.json().catch(() => null);
    ok("Und nennt das Einfrier-Prinzip im Klartext",
      /gebuchte/i.test(String(j2?.error ?? "")), String(j2?.error ?? "").slice(0, 90));

    // ── ROT-PROBE 2: Abzug ohne Grund ─────────────────────────────────────
    const r3 = await kontext.request.post(`${BASIS}/api/fiaon/admin/verguetung/${id}/baustein`, {
      data: { typ: "einmalig", betragEuro: "-50,00", gueltigAb: heute },
    });
    ok("Rot-Probe: Abzug ohne Grund wird abgelehnt (400)", r3.status() === 400, `HTTP ${r3.status()}`);

    // Mit Grund geht er.
    const r4 = await kontext.request.post(`${BASIS}/api/fiaon/admin/verguetung/${id}/baustein`, {
      data: {
        typ: "einmalig", betragEuro: "-50,00", gueltigAb: heute,
        vermerk: "Vorschuss vom 10.08. wird verrechnet.",
      },
    });
    ok("Mit Grund wird der Abzug angenommen", r4.ok(), `HTTP ${r4.status()}`);

    // ── ROT-PROBE 3: eine GEBUCHTE Provision darf sich nicht ändern ────────
    // Der Auftrag verlangt sie ausdrücklich. Geprüft wird an der Wirkung: Eine
    // Satzänderung heute darf die Summe der bereits gebuchten Zeilen dieses
    // Monats NICHT verschieben.
    const monat = heute.slice(0, 7);
    const vorher = await kontext.request.get(
      `${BASIS}/api/fiaon/admin/verguetung/${id}?monat=${monat}`);
    const jv = await vorher.json().catch(() => null);
    const summeVorher = Number(jv?.vorschau?.provisionCents ?? 0);
    await kontext.request.post(`${BASIS}/api/fiaon/admin/verguetung/${id}/baustein`, {
      data: { typ: "provision", modus: "prozent", satzProzent: "99", gueltigAb: heute },
    });
    const nachher = await kontext.request.get(
      `${BASIS}/api/fiaon/admin/verguetung/${id}?monat=${monat}`);
    const jn = await nachher.json().catch(() => null);
    const summeNachher = Number(jn?.vorschau?.provisionCents ?? 0);
    ok("Rot-Probe: 99-%-Satz verändert bereits gebuchte Provisionen NICHT",
      summeVorher === summeNachher, `vorher ${summeVorher}, nachher ${summeNachher}`);

    // ── DIE VORSCHAU GEGEN DIE ECHTE RECHNUNG ─────────────────────────────
    // Beide Seiten getrennt rechnen und vergleichen — nicht dieselbe Abfrage
    // zweimal aufrufen.
    const [echt] = (await sqlPool`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS cents, COUNT(*)::int AS n
        FROM fiaon_commissions
       WHERE agent_id = ${id} AND status <> 'cancelled'
         AND created_at >= ${`${monat}-01`}::date
         AND created_at < (${`${monat}-01`}::date + INTERVAL '1 month')
    `) as any[];
    const vs = jn?.vorschau ?? {};
    const vorschauPositionen = Number(vs.provisionCents ?? 0) + Number(vs.pauschalCents ?? 0);
    log(`        Datenbank direkt: ${echt.cents} Cent in ${echt.n} Zeilen`);
    log(`        Vorschau:         ${vorschauPositionen} Cent (Provisionen + Pauschalen)`);
    ok("Die Vorschau stimmt mit den gebuchten Positionen überein",
      vorschauPositionen === Number(echt.cents),
      `${vorschauPositionen} ≠ ${echt.cents}`);

    // ── DIE ROLLE: VERTRIEBSLEITUNG DARF NICHT ────────────────────────────
    const vlMail = `pruef-vgvl-${Date.now().toString(36)}@pruefstand.test`;
    const vlPass = `P-${Math.random().toString(36).slice(2)}`;
    const [vl] = (await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                                distribution_active, created_at)
      VALUES ('Prüfstand VG Leitung (Testkonto)', ${vlMail},
              ${await bcrypt.hash(vlPass, 10)}, 'vertriebsleiter', TRUE, TRUE, FALSE, NOW())
      RETURNING id
    `) as any[];
    stillzulegen.push(Number(vl.id));
    const k2 = await browser.newContext();
    await k2.request.post(`${BASIS}/api/fiaon/agent/login`, { data: { email: vlMail, password: vlPass } })
      .catch(() => null);
    const verboten = await k2.request.get(`${BASIS}/api/fiaon/admin/verguetung/${id}`);
    ok("Rot-Probe: Vertriebsleitung kommt NICHT an die Bankdaten",
      verboten.status() === 401 || verboten.status() === 403,
      `HTTP ${verboten.status()} — bei 200 hätte sie fremde IBANs gelesen`);
    await k2.close();
    await kontext.close();
  }

  await browser.close();
  await aufraeumen();
  log(`\n        ${stillzulegen.length} Testkonten stillgelegt, Bausteine entfernt.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

/** Läuft IMMER — auch wenn eine Wand fällt und dabei etwas entsteht. */
async function aufraeumen(): Promise<void> {
  for (const id of stillzulegen) {
    await sqlPool`DELETE FROM fiaon_verguetung_bausteine WHERE agent_id = ${id}`.catch(() => {});
    await testkontoStilllegen(id).catch(() => {});
  }
}

main().catch(async (e) => {
  console.error(e);
  await aufraeumen();
  await sqlPool.end();
  process.exit(1);
});
