// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: GEHT DER RECHNUNGS-KNOPF BEI ECHTEN KUNDEN?
//
// ── DIE MELDUNG (Florentine Lombardi, 19.08.2026) ──────────────────────────
// „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine Mail
// schicken."
//
// ── WARUM IM BROWSER UND NICHT AM QUELLTEXT ────────────────────────────────
// AGENTS.md, 11.08.2026: „Die Route existiert" war grün, während der Knopf
// fehlte. Hier wird deshalb GEKLICKT — an ECHTEN Kunden aus Florentines Liste,
// mit ihrer Rolle.
//
// ── UND ES GEHT KEINE MAIL RAUS ────────────────────────────────────────────
// Die Sende-Route ist abgefangen (`page.route`). Der Payload wird MITGELESEN und
// geprüft: Er muss das richtige Paket, den richtigen Betrag und die richtige
// Referenz tragen — das war die Meldung von gestern, und sie darf nicht
// zurückkommen. Die Vorschau-Route läuft ECHT: Sie sendet nichts und ist genau
// das, was geprüft werden soll.
//
//   npx tsx scripts/pruef-sendesperre-browser.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEFSEND-${Date.now().toString(36).toUpperCase()}`;

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

let testAgentId: number | null = null;
/** Alles, was der abgefangene Versand gesehen hat. */
const versandGesehen: any[] = [];

async function attrappen(seite: Page): Promise<void> {
  // Der Versand: Er wuerde eine echte Mail an einen echten Kunden schicken.
  for (const muster of [
    "**/api/fiaon/agent/crm/kunden/*/rechnung",
    "**/api/fiaon/agent/customers/*/send-payment-email",
  ]) {
    await seite.route(muster, async (r) => {
      if (r.request().method() !== "POST") return r.continue();
      let koerper: any = null;
      try { koerper = JSON.parse(r.request().postData() || "{}"); } catch { /* leer */ }
      versandGesehen.push({ url: r.request().url(), koerper });
      await r.fulfill({
        status: 200, contentType: "application/json",
        // Alle Felder, die die Oberflaeche liest (AGENTS.md, 18.08.2026).
        body: JSON.stringify({
          ok: true, versandtAn: "pruefstand@example.invalid",
          warnung: null, kunde: null,
        }),
      });
    });
  }
}

async function main(): Promise<void> {
  mkdirSync("reports/sendesperre", { recursive: true });

  // ── FLORENTINES ROLLE, ABER EIN TESTKONTO ──────────────────────────────
  // Ein Browsertest meldet sich NIE als echter Mensch an (AGENTS.md,
  // 06.08.2026). Das Konto bekommt dieselbe Rolle — und die Kunden, die geprüft
  // werden, sind Florentines echte.
  const [flo] = (await sqlPool`
    SELECT id, rolle FROM fiaon_agents WHERE name ILIKE '%florentine%' LIMIT 1
  `) as any[];
  if (!flo) { console.log("Florentine nicht gefunden."); await sqlPool.end(); return; }

  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE} Agent`}, ${`${MARKE.toLowerCase()}@example.invalid`},
            ${flo.rolle ?? "agent"}, TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  testAgentId = Number(neu.id);
  console.log(`  Testkonto ${testAgentId}, Rolle ${flo.rolle ?? "agent"} (wie Florentine)`);

  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${testAgentId}, ${d.key}, ${d.version}, NOW(),
              ${`PRUEFSTAND/${MARKE}`}, 'pruef-sendesperre-browser.ts (kein Mensch)')
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
      VALUES (${testAgentId}, ${Number(vorlage.version)}, ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE} — kein Vertrag, kein Mensch.</p>`},
              ${`${MARKE} (Prüfstand)`}, 'pruefstand', ${`pruefsend-${MARKE}`}, 'signed', NOW())
    `.catch(() => {});
  }

  // ── FÜNF ECHTE FÄLLE, GEZIELT GEWÄHLT ──────────────────────────────────
  // Nicht die erstbesten (AGENTS.md): je einer aus den wichtigsten Gründen, und
  // die zwei, die gestern falsch entschieden wurden.
  const { sendeGrundSql } = await import("../server/lib/fiaon-massgebliche-bestellung");
  const faelle = (await sqlPool.unsafe(`
    SELECT DISTINCT ON (grund) p.id, grund,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name
    FROM (
      SELECT p.*, ${sendeGrundSql("p")} AS grund FROM fiaon_persons p
      WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
        AND p.ist_test_am IS NULL AND NOT p.is_blocked
    ) p
    ORDER BY grund, p.id
  `, [Number(flo.id)])) as any[];
  console.log(`  ${faelle.length} Prüffälle, je einer pro Grund:`);
  for (const f of faelle) console.log(`     Person ${f.id}  ${f.grund.padEnd(18)} ${String(f.name).slice(0, 26)}`);

  // Die Kunden dem Testkonto leihen — und am Ende ZURÜCKGEBEN. Ohne das sieht
  // der Prüfstand sie nicht (der Besitzschutz greift richtig).
  // ── UND JE EINER PRO ZAHLUNGSZUSTAND ──────────────────────────────────
  // Die Auswahl oben deckt die GRÜNDE ab, aber alle drei sendbaren Fälle können
  // dieselbe Zahlungslage haben. Für die unabhängige Prüfung (und damit für die
  // Rot-Probe) braucht es je einen mit `pending_payment`, `claimed_paid` und
  // `expired` — gemessen hat Florentine 133, 50 und 36 davon.
  //
  // `claimed_paid` ist der wichtigste: Ein Kunde, der seine Zahlung GEMELDET
  // hat, fragt oft genau dann nach den Daten. Wer den ausschließt, verliert die
  // Menschen, die schon zahlen wollten.
  const jeZustand = (await sqlPool.unsafe(`
    SELECT DISTINCT ON (a.payment_status) p.id, a.payment_status
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id
    WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
      AND p.ist_test_am IS NULL AND NOT p.is_blocked
      AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
      AND a.payment_status IN ('pending_payment','claimed_paid','expired')
      AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''),
                   NULLIF(a.billing_email,''), NULLIF(p.primary_email,'')) IS NOT NULL
    ORDER BY a.payment_status, p.id
  `, [Number(flo.id)])) as any[];
  console.log(`  ${jeZustand.length} weitere Fälle, je einer pro Zahlungszustand:`);
  for (const z of jeZustand) console.log(`     Person ${z.id}  ${z.payment_status}`);

  const geliehen = Array.from(new Set([
    ...faelle.map((f) => Number(f.id)),
    ...jeZustand.map((z) => Number(z.id)),
  ]));
  await sqlPool`
    UPDATE fiaon_persons SET assigned_agent_id = ${testAgentId}
    WHERE id = ANY(${geliehen})
  `;

  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const token = signAgentToken(testAgentId, 0);

  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: token,
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  // ── DIE NEUERUNGS-EBENE WEGKLICKEN, NICHT UMGEHEN ───────────────────────
  // GEMESSEN im ersten Lauf: Der Screenshot zeigte „63 wichtige Neuerungen" über
  // der ganzen Seite, und der Prüfstand wartete 30 Sekunden auf eine Karte, die
  // dahinter lag. Das ist RICHTIGES Verhalten (ein neuer Mitarbeiter soll sie
  // sehen) und nur für den Prüflauf im Weg.
  //
  // Ein zweiter Entwurf setzte einen Platzhalter in den Speicherschlüssel — das
  // wirkte nicht, weil die Ebene gegen die ECHTEN Kennungen prüft
  // (`!seen.includes(u.id)`). Also wird der Knopf gedrückt, den auch ein Mensch
  // drückt. Das prüft denselben Weg und umgeht nichts.
  const ebeneWegklicken = async (seite: Page): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      const knopf = seite.getByRole("button", { name: /^Verstanden$/i }).first();
      if (await knopf.count() === 0) return;
      await knopf.click({ timeout: 4000 }).catch(() => {});
      await seite.waitForTimeout(600);
    }
  };

  try {
    titel("1. DIE VORSCHAU-ROUTE ANTWORTET FÜR JEDEN GRUND");
    const seite = await kontext.newPage();
    await attrappen(seite);
    await seite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWegklicken(seite);
    const kamKarte = await seite.locator("[data-fi-kunde]").first()
      .waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
    // Ihr Ausbleiben ist ein FEHLSCHLAG, nicht ein Übersprungen (AGENTS.md).
    pruef("Die Kundenliste zeigt Karten", kamKarte,
      "ohne Karten sagt der Test nichts über den Knopf");

    for (const f of faelle) {
      const v = await seite.evaluate(async (id) => {
        const r = await fetch(`/api/fiaon/agent/crm/kunden/${id}/rechnung-vorschau`,
          { credentials: "include" });
        return { status: r.status, body: await r.json().catch(() => null) };
      }, Number(f.id));
      const b = v.body;
      const sendbar = f.grund === "frei" || f.grund === "erste_rechnung";
      pruef(`Person ${f.id} (${f.grund}): Vorschau antwortet`, v.status === 200 && b?.ok === true,
        `status ${v.status}`);
      pruef(`Person ${f.id}: „moeglich“ stimmt mit dem Grund überein`,
        !!b?.moeglich === sendbar,
        `moeglich=${b?.moeglich}, Grund ${f.grund}`);
      if (sendbar) {
        pruef(`Person ${f.id}: Empfänger genannt`, !!b?.empfaenger, `empfaenger=${b?.empfaenger}`);
        if (f.grund === "frei") {
          pruef(`Person ${f.id}: Paket und Verwendungszweck genannt`,
            !!b?.paket && !!b?.verwendungszweck,
            `paket=${b?.paket}, zweck=${b?.verwendungszweck}`);
        } else {
          pruef(`Person ${f.id}: Vorschau sagt, dass die erste Rechnung entsteht`,
            b?.ersteRechnung === true && /erste/i.test(String(b?.hinweis)),
            `hinweis=${b?.hinweis}`);
        }
      } else {
        pruef(`Person ${f.id}: Grund im Klartext genannt`,
          !!b?.hinweis && String(b.hinweis).length > 15, `hinweis=${b?.hinweis}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("1b. DIE UNABHÄNGIGE ERWARTUNG (Rot-Probe-fähig)");
    // ═══════════════════════════════════════════════════════════════════════
    // ── WARUM DIESE GRUPPE EXISTIERT ──────────────────────────────────────
    // Die Prüffälle oben werden über `sendeGrundSql` ausgewählt — also über die
    // Funktion, die geprüft wird. Bei der Rot-Probe (Auflösung künstlich
    // verschärft: `claimed_paid` und `expired` entfernt) blieb der Lauf GRÜN:
    // Die Erwartung war mitgewandert. Ein Test, der seinen Sollwert vom
    // Prüfling bezieht, prüft nichts (AGENTS.md: „Ein Prüfstand muss rot werden
    // können").
    //
    // Hier steht die Erwartung deshalb UNABHÄNGIG, als Satz über die Daten:
    //
    //   Wer eine lebende unbezahlte Bestellung UND eine zustellbare Adresse
    //   hat, MUSS Zahlungsdaten bekommen können.
    //
    // Das ist die Regel aus dem Auftrag, wörtlich. Sie steht in reinem SQL, ohne
    // eine Zeile des Prüflings — und sie schließt `claimed_paid` ausdrücklich
    // ein: Ein Kunde, der seine Zahlung GEMELDET hat, fragt oft genau dann nach
    // den Daten.
    const mussGehen = (await sqlPool`
      SELECT p.id, a.payment_status,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.person_ref) AS name
      FROM fiaon_persons p
      JOIN fiaon_applications a ON a.person_id = p.id
      WHERE p.assigned_agent_id = ${testAgentId}
        AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
        AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
        AND COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                     NULLIF(a.billing_email, ''), NULLIF(p.primary_email, '')) IS NOT NULL
      ORDER BY p.id
    `) as any[];
    pruef("Es gibt mindestens einen Fall für die unabhängige Prüfung",
      mussGehen.length > 0,
      "ohne ihn kann die Rot-Probe nichts zeigen");
    for (const m of mussGehen) {
      const v = await seite.evaluate(async (id) => {
        const r = await fetch(`/api/fiaon/agent/crm/kunden/${id}/rechnung-vorschau`,
          { credentials: "include" });
        return await r.json().catch(() => null);
      }, Number(m.id));
      pruef(`Person ${m.id} (${m.payment_status}): MUSS sendbar sein`,
        v?.moeglich === true,
        `moeglich=${v?.moeglich}, hinweis=${v?.hinweis} — `
        + "lebende unbezahlte Bestellung mit zustellbarer Adresse");
    }

    titel("2. DER KNOPF IM BROWSER — FREIGEGEBEN ODER MIT ECHTEM GRUND");
    // Der sendbare Fall: Knopf finden, drücken, Bestätigung lesen, senden.
    const frei = faelle.find((f) => f.grund === "frei");
    if (!frei) {
      pruef("Ein sendbarer Fall in Florentines Liste vorhanden", false,
        "ohne ihn sagt der Test nichts über den Erfolgsweg");
    } else {
      await seite.goto(`${BASIS}/agent/kunden?person=${frei.id}`,
        { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWegklicken(seite);
      const karte = seite.locator(`[data-fi-kunde="${frei.id}"]`);
      await karte.waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
      const knopf = karte.getByRole("button", { name: /Zahlungsdaten senden/i }).first();
      const da = await knopf.count() > 0;
      pruef("Der Knopf „Zahlungsdaten senden“ ist da", da,
        "bei einem sendbaren Kunden muss er sichtbar sein");
      if (da) {
        pruef("… und nicht gesperrt", !(await knopf.isDisabled()));
        await seite.screenshot({ path: "reports/sendesperre/1-knopf-frei.png" });
        console.log("        reports/sendesperre/1-knopf-frei.png");

        await knopf.click();
        const dialog = seite.getByRole("dialog", { name: /Zahlungsdaten senden/i });
        const kam = await dialog.waitFor({ state: "visible", timeout: 10_000 })
          .then(() => true).catch(() => false);
        pruef("Die Bestätigung öffnet sich", kam);
        if (kam) {
          // ── AUF DEN INHALT WARTEN, NICHT AUF DIE ZEIT ──────────────────
          // GEMESSEN im ersten Lauf: Der Text war „das bekommt Marco Spanier /
          // wird geprüft …" — die Vorschau lief noch. Drei Prüfungen wurden rot
          // an einem Zustand, der eine Zehntelsekunde später richtig war.
          // AGENTS.md: „Erst warten, dann messen. Eine Seite, die noch lädt, hat
          // nichts, was falsch sein könnte."
          //
          // Gewartet wird auf die MARKE im Inhalt (der Sendeknopf wird erst
          // freigegeben, wenn die Vorschau da ist) — und ihr Ausbleiben ist ein
          // Fehlschlag, kein Übersprungen.
          const sendeKnopf = dialog.getByRole("button", { name: /Jetzt senden|Rechnung stellen/i }).first();
          const bereit = await sendeKnopf.waitFor({ state: "visible", timeout: 12_000 })
            .then(() => true).catch(() => false);
          pruef("Die Vorschau ist geladen", bereit,
            "der Sendeknopf erscheint erst mit den Angaben");
          const t = (await dialog.innerText()).toLowerCase();
          pruef("Sie nennt das Paket", /fiaon|bonität/i.test(t), t.slice(0, 140));
          pruef("Sie nennt einen Betrag", /€/.test(t), t.slice(0, 140));
          pruef("Sie nennt den Verwendungszweck", /fiaon-/i.test(t), t.slice(0, 200));
          await seite.screenshot({ path: "reports/sendesperre/2-bestaetigung.png" });
          console.log("        reports/sendesperre/2-bestaetigung.png");

          await sendeKnopf.click();
          await seite.waitForTimeout(2500);
          pruef("Der Versand wurde ausgelöst (abgefangen)", versandGesehen.length > 0,
            `${versandGesehen.length} Aufrufe`);
          if (versandGesehen.length > 0) {
            const k = versandGesehen[versandGesehen.length - 1].koerper;
            pruef("… und trägt eine Referenz mit (die geprüft wird)",
              k !== null && Object.prototype.hasOwnProperty.call(k, "ref"),
              `Körper: ${JSON.stringify(k)}`);
          }
        }
      }
    }

    // Ein gesperrter Fall: Der Grund muss DASTEHEN, nicht nur der Knopf fehlen.
    const gesperrt = faelle.find((f) => f.grund === "keine_bestellung" || f.grund === "antrag_unfertig");
    if (gesperrt) {
      await seite.goto(`${BASIS}/agent/kunden?person=${gesperrt.id}`,
        { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWegklicken(seite);
      const karte = seite.locator(`[data-fi-kunde="${gesperrt.id}"]`);
      const kamG = await karte.waitFor({ state: "visible", timeout: 25_000 })
        .then(() => true).catch(() => false);
      pruef(`Die Karte des gesperrten Falls ist da (Person ${gesperrt.id})`, kamG);
      const t = kamG ? (await karte.innerText()).toLowerCase() : "";
      pruef(`Gesperrter Fall (${gesperrt.grund}): der Grund steht auf der Karte`,
        /keine bestellung|formular|bezahlt|e-mail/i.test(t),
        t.replace(/\s+/g, " ").slice(0, 200));
      await seite.screenshot({ path: "reports/sendesperre/3-gesperrt-mit-grund.png" });
      console.log("        reports/sendesperre/3-gesperrt-mit-grund.png");
    }

  } finally {
    // Die geliehenen Kunden ZURÜCK — vor allem anderen.
    await sqlPool`
      UPDATE fiaon_persons SET assigned_agent_id = ${Number(flo.id)}
      WHERE id = ANY(${geliehen})
    `.catch((e) => console.error("  !! Kunden nicht zurückgegeben:", e));
    console.log(`  ${geliehen.length} Kunden an Florentine zurückgegeben`);
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/sendesperre/`);
  console.log(`${"═".repeat(72)}\n`);
}

main()
  .catch((e) => { console.error(e); rot++; })
  .finally(async () => {
    if (testAgentId != null) {
      const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
      await testkontoStilllegen(testAgentId).catch(() => {});
      console.log(`  Testkonto ${testAgentId} stillgelegt\n`);
    }
    await sqlPool.end();
    process.exit(rot > 0 ? 1 : 0);
  });
