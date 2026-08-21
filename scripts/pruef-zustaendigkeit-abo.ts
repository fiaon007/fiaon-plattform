// ═══════════════════════════════════════════════════════════════════════════
// ABNAHME — ZUSTÄNDIGKEIT, TERMINART, ABO-FÄLLIGKEIT, ÜBERFÄLLIGKEIT
//
//   0  Entmarkierung: nichts Produktives an Prüfstands-Konten
//   1  Die Rolle bestimmt die Terminart (nicht der URL-Parameter)
//   2  paid_at: die Rekonstruktions-Vorschau steht
//   3  Abo-Fälligkeit aus dem absoluten Zahldatum, Monatsenden, 12 Monate
//   4  Überfälligkeit ab Tag 1: Rollenwechsel, Abstände, bestätigter Versand
//   5  Drei erfolglose Anrufe → Liste „Bereit zur Übergabe" mit CSV
//   6  Die Inkasso-Differenz ist gemessen und begründet
//
// Screenshots: Buchungslink als bezahlter Kunde · als unbezahlter ·
// Tag-1-Überfälliger in der Inkasso-Arbeitsliste · Liste „Bereit zur Übergabe".
//
//   npx tsx scripts/pruef-zustaendigkeit-abo.ts               (Server auf 5188)
//   npx tsx scripts/pruef-zustaendigkeit-abo.ts --rot-probe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { istTestkontoSql } from "../server/lib/fiaon-mitarbeiter-sicht";
import {
  zustaendigeRolle, zustaendigeRolleSql, QUELLE_FUER_ROLLE, terminartFuerPerson,
  UEBERFAELLIG_AB_TAGEN,
} from "../server/lib/fiaon-zustaendigkeit";
import { QUELLEN, entscheidFuerPerson, terminTokenErzeugen } from "../server/lib/fiaon-termine";
import { faelligkeit, ankerTag } from "../server/lib/fiaon-abo-zyklus";
import { MAHNSTUFEN, mahnAbstandSql } from "../server/routes/fiaon-abo";
import { UEBERGABE_AB_VERSUCHEN } from "../server/routes/fiaon-forderung";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const ROT = process.argv.includes("--rot-probe");
const BILD = "reports/zustaendigkeit";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `\n        → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

async function ebeneWeg(seite: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    let getan = false;
    for (const name of [/^Verstanden$/i, /^Gelesen$/i]) {
      const k = seite.getByRole("button", { name }).first();
      if (await k.count() > 0) { await k.click({ timeout: 3000 }).catch(() => {}); getan = true; await seite.waitForTimeout(400); }
    }
    if (!getan) return;
  }
}

async function main(): Promise<void> {
  mkdirSync(BILD, { recursive: true });

  // ═══════════════════════════════════════════════════════════════════════
  titel("0 — DIE ENTMARKIERUNG HAT GEWIRKT");
  // ═══════════════════════════════════════════════════════════════════════
  const [an] = (await sqlPool.unsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
        WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL) AS personen,
      (SELECT COUNT(*)::int FROM fiaon_commissions c JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE ${istTestkontoSql("a")}) AS provisionen,
      (SELECT COUNT(*)::int FROM fiaon_agents a WHERE a.id IN (2, 7)
        AND NOT COALESCE(a.is_test_account, FALSE)) AS entmarkiert
  `)) as any[];
  pruef("Kein produktiver Kunde hängt mehr an einem Prüfstands-Konto",
    Number(an.personen) === 0, `${an.personen} übrig`);
  pruef("Keine Provision hängt mehr an einem Prüfstands-Konto",
    Number(an.provisionen) === 0, `${an.provisionen} übrig`);
  pruef("Die Konten #2 und #7 sind entmarkiert", Number(an.entmarkiert) === 2,
    `${an.entmarkiert} von 2`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("1 — DIE ROLLE BESTIMMT DIE TERMINART");
  // ═══════════════════════════════════════════════════════════════════════
  // Jeder Wert in QUELLE_FUER_ROLLE muss eine echte Gesprächsart sein. Ohne
  // diese Prüfung wäre die Trennung der beiden Dateien eine Wette.
  for (const [rolle, quelle] of Object.entries(QUELLE_FUER_ROLLE)) {
    pruef(`Die Gesprächsart für „${rolle}“ (${quelle}) steht in QUELLEN`,
      Object.prototype.hasOwnProperty.call(QUELLEN, quelle),
      "sonst rechnet dauerFuer mit der Vorgabe und die Rollenprüfung greift nicht");
  }

  const proTopf = (await sqlPool.unsafe(`
    SELECT DISTINCT ON (rolle) id, rolle FROM (
      SELECT p.id, ${zustaendigeRolleSql("p")} AS rolle FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT COALESCE(p.is_blocked, FALSE)
    ) x ORDER BY rolle, id
  `)) as any[];
  pruef("Es gibt einen Prüffall je Zuständigkeit", proTopf.length === 3,
    `gefunden: ${proTopf.map((r) => r.rolle).join(", ")}`);

  for (const f of proTopf) {
    // Der ungünstigste Fall: Es wird ausdrücklich die FALSCHE Art mitgeschickt.
    const e = await entscheidFuerPerson(Number(f.id), "onboarding_call");
    pruef(`Person ${f.id} (${f.rolle}): abgeleitet wird „${e.quelle}“`,
      e.quelle === QUELLE_FUER_ROLLE[String(f.rolle) as keyof typeof QUELLE_FUER_ROLLE],
      `zustaendig=${e.zustaendig}`);
    if (String(f.rolle) !== "onboarding") {
      pruef(`… und das mitgeschickte „onboarding_call“ wird vermerkt und verworfen`,
        e.verworfen === "onboarding_call",
        "ein stillschweigend überschriebener Parameter ist nicht mehr erklärbar");
    }
  }

  // Die beiden Fassungen (TypeScript und SQL) müssen dasselbe sagen.
  for (const f of proTopf) {
    const a = await terminartFuerPerson(Number(f.id));
    pruef(`Person ${f.id}: SQL sagt „${f.rolle}“, TypeScript sagt „${a?.zustaendig}“`,
      a?.zustaendig === String(f.rolle));
  }

  if (ROT) {
    // Der Schaden: Der URL-Parameter setzt sich durch. Bleibt die Prüfung
    // grün, prüft sie die Umkehrung nicht.
    const inkassoFall = proTopf.find((r) => String(r.rolle) === "inkasso");
    if (inkassoFall) {
      const e = await entscheidFuerPerson(Number(inkassoFall.id), "onboarding_call");
      pruef("ROT-PROBE: ein mitgeschicktes „?art=start“ setzt sich NICHT durch",
        e.quelle !== "onboarding_call",
        `abgeleitet wurde „${e.quelle}“ — dann entscheidet weiter die Adresse`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("2 — DIE paid_at-REKONSTRUKTION LIEGT ALS VORSCHAU VOR");
  // ═══════════════════════════════════════════════════════════════════════
  const csvDa = existsSync("reports/paid-at-rekonstruktion.csv");
  pruef("reports/paid-at-rekonstruktion.csv ist erzeugt", csvDa,
    "npx tsx scripts/mess-zustaendigkeit-abo.ts");
  if (csvDa) {
    const inhalt = readFileSync("reports/paid-at-rekonstruktion.csv", "utf-8");
    pruef("… und nennt Güte und Quelle je Vorschlag",
      /guete/.test(inhalt) && /quelle_des_vorschlags/.test(inhalt));
    // NICHTS geschrieben: Die Zahl der Bestellungen ohne paid_at darf sich
    // durch diesen Prüfstand nicht verändert haben.
    const [o] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE payment_status = 'paid' AND paid_at IS NULL AND merged_into IS NULL
        AND archived_at IS NULL AND gdpr_deleted_at IS NULL
    `) as any[];
    pruef(`Es wurde NICHTS geschrieben (${o.n} Bestellungen ohne Zahldatum)`,
      Number(o.n) > 0,
      "wären es 0, hätte etwas ohne Freigabe geschrieben");
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("3 — ABO-FÄLLIGKEIT AUS DEM ABSOLUTEN ZAHLDATUM");
  // ═══════════════════════════════════════════════════════════════════════
  // Die Monatsenden — der Fall, an dem sich jede Datumsrechnung beweist.
  for (const [anker, n, soll] of [
    ["2026-01-31", 1, "2026-02-28"], ["2026-01-31", 2, "2026-03-31"],
    ["2028-01-31", 1, "2028-02-29"], ["2026-08-31", 1, "2026-09-30"],
    ["2026-08-31", 2, "2026-10-31"], ["2026-07-05", 12, "2027-07-05"],
  ] as [string, number, string][]) {
    pruef(`${anker} + ${n} Monat(e) = ${soll}`, faelligkeit(anker, n) === soll,
      `gerechnet: ${faelligkeit(anker, n)}`);
  }
  // Und die Regel, die der Betreiber genannt hat: NIE aus der vorherigen
  // Fälligkeit weiterrechnen. Der Beweis: Wer vom 28.02. weiterrechnet,
  // verliert den 31. für immer.
  const kettenTreu = faelligkeit("2026-01-31", 2) === "2026-03-31";
  pruef("Der 31. kommt nach dem Februar zurück (kein Weiterrechnen von Fälligkeit zu Fälligkeit)",
    kettenTreu, "sonst wandert der Termin jeden Monat weiter nach vorn");

  // Am Bestand: liegt Rate 2 einen Monat nach dem Zahldatum?
  const raten = (await sqlPool`
    SELECT r.rate_nr, r.faellig_am, a.paid_at, r.ref
    FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.storniert_am IS NULL AND a.paid_at IS NOT NULL AND a.merged_into IS NULL
      -- ── AB DEM 17.08.2026 ──────────────────────────────────────────
      -- Bis zum 16.08. rechnete der Motor mit „+30 Tage" statt mit dem
      -- monatlichen Jahrestag (siehe fiaon-abo-zyklus.ts). Zwei Raten vom
      -- 13. und 14.08. liegen deshalb genau einen Tag zu früh — Bestand, nicht
      -- Rechnung. Ein Prüfstand, der über die Korrektur hinweg misst, wird
      -- dauerhaft rot und dann abgeschaltet.
      AND r.rate_nr = 2 AND r.created_at >= '2026-08-17'
    ORDER BY r.created_at DESC LIMIT 20
  `) as any[];
  const treffer = raten.filter((r) => {
    const anker = ankerTag(r.paid_at);
    return anker && ankerTag(r.faellig_am) === faelligkeit(anker, 1);
  });
  pruef(`Rate 2 liegt einen Monat nach dem Zahldatum (${treffer.length} von ${raten.length} seit der Korrektur)`,
    raten.length === 0 || treffer.length === raten.length,
    raten.filter((r) => !treffer.includes(r)).slice(0, 3)
      .map((r) => `${r.ref}: ist ${ankerTag(r.faellig_am)}, soll ${faelligkeit(ankerTag(r.paid_at)!, 1)}`).join(" | "));

  // ═══════════════════════════════════════════════════════════════════════
  titel("4 — ÜBERFÄLLIGKEIT AB TAG 1");
  // ═══════════════════════════════════════════════════════════════════════
  pruef("Die Ableitung zählt ab Tag 1 nach Fälligkeit", UEBERFAELLIG_AB_TAGEN === 1,
    `UEBERFAELLIG_AB_TAGEN = ${UEBERFAELLIG_AB_TAGEN}`);
  pruef("Die Erinnerungs-Abstände sind 0/3/7/14/21",
    MAHNSTUFEN.join(",") === "0,3,7,14,21", MAHNSTUFEN.join(","));
  // Der SQL-Ausdruck MUSS aus derselben Liste kommen — sonst verschiebt eine
  // Änderung die Anzeige und nicht den Versand.
  const sqlAusdruck = mahnAbstandSql();
  for (const [stufe, tage] of MAHNSTUFEN.entries()) {
    pruef(`… und der SQL-Ausdruck kennt Stufe ${stufe} → Tag ${tage}`,
      sqlAusdruck.includes(`WHEN ${stufe} THEN ${tage}`), sqlAusdruck);
  }

  // Ein echter Tag-1-Fall: Er MUSS „inkasso" sein.
  const [tag1] = (await sqlPool`
    SELECT a.person_id, r.faellig_am, r.rate_nr,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Ohne Namen') AS name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
      AND r.faellig_am < CURRENT_DATE AND a.merged_into IS NULL
      AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
    ORDER BY r.faellig_am DESC LIMIT 1
  `) as any[];
  if (tag1) {
    const z = await zustaendigeRolle(Number(tag1.person_id));
    pruef(`Ein überfälliger Kunde ist „inkasso“ (${tag1.name}, Rate ${tag1.rate_nr} fällig `
      + `${new Date(tag1.faellig_am).toLocaleDateString("de-DE")})`,
      z?.rolle === "inkasso", `ist „${z?.rolle}“`);
  }

  // Die Mahnstufe darf nur mit Beleg stehen.
  const [ohneBeleg] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
    WHERE mahnstufe > 0 AND letzte_erinnerung_at IS NOT NULL
      AND mahnstufe_bestaetigt_am IS NULL AND letzte_erinnerung_at > NOW() - INTERVAL '1 hour'
  `) as any[];
  pruef("Keine Mahnstufe der letzten Stunde ohne bestätigten Versand",
    Number(ohneBeleg.n) === 0, `${ohneBeleg.n} ohne Beleg`);

  if (ROT) {
    // Der Schaden: Tag 0 wäre schon überfällig. Dann stünde jeder, der am
    // Fälligkeitstag zahlt, morgens im Forderungsmanagement.
    const [tag0] = (await sqlPool`
      SELECT a.person_id FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
        AND r.faellig_am = CURRENT_DATE AND a.merged_into IS NULL
        AND r.mahnstufe = 0 AND r.inkasso_agent_id IS NULL AND p.inkasso_ab IS NULL
      LIMIT 1
    `) as any[];
    if (tag0) {
      const z = await zustaendigeRolle(Number(tag0.person_id));
      pruef("ROT-PROBE: wer HEUTE fällig ist, ist noch NICHT inkasso",
        z?.rolle !== "inkasso",
        `Person ${tag0.person_id} ist „${z?.rolle}“ — dann trifft es Pünktliche`);
    } else {
      console.log("        (kein Kunde mit Fälligkeit HEUTE — Gegenprobe entfällt)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("5 — DREI ERFOLGLOSE ANRUFE → BEREIT ZUR ÜBERGABE");
  // ═══════════════════════════════════════════════════════════════════════
  pruef("Die Schwelle steht bei drei Versuchen", UEBERGABE_AB_VERSUCHEN === 3,
    String(UEBERGABE_AB_VERSUCHEN));

  // ═══════════════════════════════════════════════════════════════════════
  titel("6 — DIE INKASSO-DIFFERENZ IST GEMESSEN");
  // ═══════════════════════════════════════════════════════════════════════
  const diffDa = existsSync("reports/inkasso-differenz.csv");
  pruef("reports/inkasso-differenz.csv ist erzeugt", diffDa);
  if (diffDa) {
    const z = readFileSync("reports/inkasso-differenz.csv", "utf-8").split("\n");
    pruef("… und nennt je Fall, ob er nur in der Arbeitsliste steht",
      /nur_in_arbeitsliste/.test(z[0]), z[0].slice(0, 90));
    pruef(`… mit ${z.length - 1} Zeilen`, z.length > 100, `${z.length - 1} Zeilen`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("7 — DIE VIER BEWEISBILDER");
  // ═══════════════════════════════════════════════════════════════════════
  const browser = await chromium.launch();
  try {
    // ── (1) Buchungslink als BEZAHLTER Kunde → Onboarding ───────────────
    const [bezahlt] = (await sqlPool.unsafe(`
      SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Ohne Namen') AS name
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT COALESCE(p.is_blocked, FALSE)
        AND ${zustaendigeRolleSql("p")} = 'onboarding'
      ORDER BY p.id LIMIT 1
    `)) as any[];
    const [unbezahlt] = (await sqlPool.unsafe(`
      SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Ohne Namen') AS name
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT COALESCE(p.is_blocked, FALSE)
        AND ${zustaendigeRolleSql("p")} = 'vertrieb'
        AND NOT EXISTS (SELECT 1 FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.payment_status = 'paid' AND a.merged_into IS NULL)
      ORDER BY p.id LIMIT 1
    `)) as any[];

    for (const [nr, fall, sollArt, sollRolle] of [
      [1, bezahlt, "onboarding_call", "onboarding"],
      [2, unbezahlt, "nichterreicht_mail", "vertrieb"],
    ] as [number, any, string, string][]) {
      if (!fall) { pruef(`Es gibt einen Prüffall für Bild ${nr}`, false); continue; }
      const seite = await browser.newContext({ viewport: { width: 430, height: 950 } })
        .then((k) => k.newPage());
      // ── DER LINK TRÄGT ABSICHTLICH `?art=start` ─────────────────────
      // Genau der Parameter, der früher entschieden hat. Bleibt die Ableitung
      // bei ihrer Art, ist die Umkehrung bewiesen — beim unbezahlten Kunden
      // ist es der schärfere Fall, denn dort widerspricht er.
      const token = terminTokenErzeugen(Number(fall.id));
      const antwort = await seite.goto(`${BASIS}/termin/${token}?art=start`,
        { waitUntil: "domcontentloaded", timeout: 45_000 });
      void antwort;
      await seite.waitForTimeout(3500);
      const j = await seite.evaluate(async (t) => {
        const r = await fetch(`/api/fiaon/termin/${t}?art=start`);
        return await r.json().catch(() => null);
      }, token);
      pruef(`Bild ${nr}: ${fall.name} bekommt die Art „${sollArt}“`,
        j?.art === sollArt, `bekommen: „${j?.art}“ (zuständig ${j?.zustaendig})`);
      pruef(`Bild ${nr}: die Zuständigkeit ist „${sollRolle}“`,
        j?.zustaendig === sollRolle, `bekommen: „${j?.zustaendig}“`);
      pruef(`Bild ${nr}: das mitgeschickte „?art=start“ ist ${sollArt === "onboarding_call" ? "deckungsgleich" : "verworfen"}`,
        sollArt === "onboarding_call" ? j?.verworfen == null : j?.verworfen === "onboarding_call",
        `verworfen=${j?.verworfen}`);
      await seite.screenshot({
        path: `${BILD}/${nr}-buchungslink-${sollRolle}.png`, fullPage: false,
      });
      console.log(`        ${BILD}/${nr}-buchungslink-${sollRolle}.png`);
      await seite.context().close();
    }

    // ── (3) Tag-1-Überfälliger in der Inkasso-Arbeitsliste ──────────────
    const [inkassoAgent] = (await sqlPool`
      SELECT id, name FROM fiaon_agents
      WHERE active AND rolle = 'inkasso' AND NOT COALESCE(is_test_account, FALSE)
      ORDER BY id LIMIT 1
    `) as any[];
    if (inkassoAgent) {
      const { signAgentToken } = await import("../server/routes/fiaon-agent");
      const k = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      await k.addCookies([{
        name: "fiaon_agent_token", value: signAgentToken(Number(inkassoAgent.id), 0),
        domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
      }]);
      const seite = await k.newPage();
      await seite.goto(`${BASIS}/agent/inkasso`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ebeneWeg(seite);
      // ── ERST WARTEN, DANN MESSEN (AGENTS.md) ──────────────────────────
      // Vier Sekunden waren zu kurz: Der Screenshot zeigte einen Ladekreis auf
      // weißer Fläche, und der Prüfstand meldete „Liste geht nicht auf" — ein
      // Fehler, den es nicht gab. Diese Falle steht in AGENTS.md und ist mir
      // heute zum dritten Mal passiert. Jetzt wird auf einen INHALT gewartet.
      const geladen = await seite.locator("text=/€/").first()
        .waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
      const text = await seite.locator("body").innerText();
      pruef("Die Inkasso-Arbeitsliste geht auf", geladen,
        text.replace(/\s+/g, " ").slice(0, 140) || "(leer — noch im Ladezustand)");
      if (tag1) {
        // Der Tag-1-Fall muss DRIN sein — sonst ist der Rollenwechsel eine
        // Behauptung.
        pruef(`… und enthält den überfälligen Kunden (${tag1.name})`,
          text.includes(String(tag1.name).split(" ")[0]),
          "der Rollenwechsel wirkt dann nur in der Ableitung, nicht in der Liste");
      }
      await seite.screenshot({ path: `${BILD}/3-inkasso-arbeitsliste.png` });
      console.log(`        ${BILD}/3-inkasso-arbeitsliste.png`);
      await k.close();
    } else {
      pruef("Es gibt ein aktives Inkasso-Konto für Bild 3", false);
    }

    // ── (4) Die Liste „Bereit zur Übergabe" ────────────────────────────
    // Eigener Kontext OHNE Agenten-Token: Der Verwaltungsbereich weist einen
    // angemeldeten Mitarbeiter ab (AGENTS.md, Befund vom 21.08.2026).
    const adminK = await browser.newContext({ viewport: { width: 1440, height: 1150 } });
    const hub = await adminK.newPage();
    await hub.goto(`${BASIS}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const auf = await hub.evaluate(async (code) => {
      const r = await fetch("/api/fiaon/zugang/oeffnen", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      return r.status;
    }, process.env.ADMIN_ACCESS_CODE || "20032017");
    pruef("Der Verwaltungsbereich lässt sich öffnen", auf === 200, `status ${auf}`);
    await hub.goto(`${BASIS}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWeg(hub);
    const kachel = hub.locator('[data-fiaon="kachel-uebergabe-bereit"]').first();
    const da = await kachel.waitFor({ state: "visible", timeout: 25_000 })
      .then(() => true).catch(() => false);
    pruef("Die Kachel „Bereit zur Übergabe“ ist da", da);
    if (da) {
      const kText = await kachel.innerText();
      pruef("… und nennt Anzahl und Summe", /\d/.test(kText) && /€/.test(kText),
        kText.replace(/\s+/g, " ").slice(0, 100));
      await kachel.click();
      const liste = hub.locator('[data-fiaon="unsichtbar-liste"]').first();
      const listeDa = await liste.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true).catch(() => false);
      pruef("Der Klick öffnet die Liste mit den Namen", listeDa);
      pruef("Es gibt einen CSV-Ausgang",
        await hub.locator('[data-fiaon="uebergabe-csv"]').count() > 0,
        "der Auftrag verlangt PDF und CSV");
      if (listeDa) {
        // Die Liste holt ihre Daten erst nach dem Klick — und `uebergabeBereitschaftPruefen`
        // schreibt dabei Vormerkungen. Ohne Warten zeigt das Beweisbild
        // „Wird geladen …", und das beweist nichts.
        await liste.locator("text=/erfolglose Anrufe/").first()
          .waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
        const lText = await liste.innerText();
        pruef("… und nennt je Fall Anrufe, offene Raten und Fälligkeit",
          /erfolglose Anrufe/i.test(lText) && /Rate \d+ fällig/i.test(lText),
          lText.replace(/\s+/g, " ").slice(0, 160));
      }
      await hub.waitForTimeout(1000);
      await hub.screenshot({ path: `${BILD}/4-bereit-zur-uebergabe.png` });
      console.log(`        ${BILD}/4-bereit-zur-uebergabe.png`);

      // Der CSV-Ausgang muss auch antworten — ein Link ist keine Datei.
      const csv = await hub.evaluate(async () => {
        const r = await fetch("/api/fiaon/admin/uebergabe-bereit.csv", { credentials: "include" });
        const t = await r.text();
        return { status: r.status, zeilen: t.split("\n").length, kopf: t.split("\n")[0] };
      });
      pruef(`Der CSV-Ausgang liefert Daten (${csv.zeilen - 1} Zeilen)`,
        csv.status === 200 && csv.zeilen > 1, `status ${csv.status}`);
      pruef("… mit Mahnhistorie und Zustimmungsnachweis im Kopf",
        /mahnstufe/i.test(csv.kopf) && /zustimmung/i.test(csv.kopf), csv.kopf.slice(0, 260));
    }
    await adminK.close();
  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}\n  ${ok} ok · ${rot} rot`);
  if (rot > 0) { console.log("\n  ROT:"); for (const f of fehler) console.log(`    · ${f}`); }
  console.log(`  Screenshots: ${BILD}/\n${"═".repeat(72)}`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
