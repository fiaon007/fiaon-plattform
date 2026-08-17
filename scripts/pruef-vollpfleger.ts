// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER AGENT ALS VOLLPFLEGER
//
// ── WAS BEWIESEN WERDEN MUSS ───────────────────────────────────────────────
//   1  Die vier Wände halten:
//        Bezahltes ist unantastbar
//        Preise nur aus dem Katalog (mitgeschickte Beträge werden abgelehnt)
//        Provisions-Wand unverändert
//        Jede Aktion steht im Verlauf UND im Aktivitätsprotokoll
//   2  Der Dubletten-Check greift VOR dem Speichern — ein eindeutiger Treffer
//      erzeugt NIE eine zweite Person (die Rot-Probe des Auftrags)
//   3  Der Besitzschutz gilt an jeder neuen Route
//   4  Paket-Hygiene: zweite offene Stufe ersetzt die alte; die Auskunft ist
//      davon ausgenommen und nur einmal lebend
//
// ── ECHTE ROUTEN, ECHTER SERVER ────────────────────────────────────────────
// Ein Quelltext-Grep beweist nur, dass Code existiert (AGENTS.md, 11.08.2026:
// „Die Route existiert" war grün, während der Knopf fehlte). Dieser Stand ruft
// die Routen über HTTP auf.
//
// ── UND ER RÄUMT AUF ───────────────────────────────────────────────────────
// Die Anlage-Route schreibt echte Bestellungen — sie soll es ja. Deshalb legt
// dieser Stand seine Prüffälle mit erkennbaren Namen an (`PRUEFSTAND`) und
// setzt sie am Ende auf `merged_into` (kein Hard-Delete, AGENTS.md). Das
// Aufräumen läuft IMMER, auch wenn Prüfungen scheitern — ein Aufräumen, das nur
// im Erfolgsfall läuft, läuft nie.
//
//   npx tsx scripts/pruef-vollpfleger.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEFSTAND-${Date.now().toString(36).toUpperCase()}`;

/**
 * Eine Rufnummer, die es nur in diesem Lauf gibt.
 *
 * ── WARUM (25.08.2026) ─────────────────────────────────────────────────────
 * Erster Entwurf nahm „0176 99887766" fest. Beim zweiten Lauf hängte
 * `bindePersonAnAntrag` die neue Bestellung an die Person des ERSTEN Laufs —
 * dieselbe Nummer, derselbe Mensch, völlig richtig.
 *
 * Nur: Diese Person war vom Aufräumen als Testperson markiert, und
 * `findeBestehende` überspringt Testpersonen (auch richtig — ein Testdatensatz
 * darf keine echte Anlage blockieren). Ergebnis: Der Dubletten-Check fand
 * nichts, HTTP 200 statt 409, und fünf Prüfungen wurden rot.
 *
 * Ein Prüfstand, der über Läufe hinweg dieselben Merkmale benutzt, prüft ab
 * dem zweiten Mal etwas anderes als beim ersten.
 *
 * `07`-Vorwahl + Zeitstempel: eine Nummer, die niemandem gehört und in keinem
 * Lauf zweimal vorkommt.
 */
const PRUEF_NUMMER = `+4917${String(Date.now()).slice(-9)}`;

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/** Alles, was dieser Lauf angelegt hat — für das Aufräumen. */
const angelegt: string[] = [];
let testAgentId: number | null = null;

/**
 * Ein Agenten-Cookie, wie es die Anmeldung setzt.
 *
 * ── DIE ECHTE FUNKTION, NICHT EINE NACHGEBAUTE ──────────────────────────────
 * Ein erster Entwurf baute die Signatur selbst zusammen („agent:id:exp"). Das
 * Format ist aber „agent2:…" mit vier Teilen, und der Cookie heißt
 * `fiaon_agent_token`, nicht `fiaon_agent`. Beides hätte zu einem 401 geführt,
 * und ich hätte den Fehler bei den Routen gesucht.
 *
 * `signAgentToken` ist exportiert — wer sie nachbaut, prüft seine Kopie.
 */
async function agentCookie(id: number): Promise<string> {
  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  // Der zweite Wert ist die „epoch": Sie macht alte Sitzungen ungültig, wenn
  // ein Konto stillgelegt wird. Für ein frisches Konto ist sie 0.
  const [a] = (await sqlPool`
    SELECT COALESCE(session_epoch, 0)::int AS epoch FROM fiaon_agents WHERE id = ${id}
  `.catch(() => [{ epoch: 0 }])) as any[];
  return `fiaon_agent_token=${signAgentToken(id, Number(a?.epoch ?? 0))}`;
}

async function ruf(
  pfad: string, koerper: unknown, cookie: string,
): Promise<{ status: number; j: any }> {
  const r = await fetch(`${BASIS}/api/fiaon${pfad}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(koerper),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, j };
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("VORBEREITUNG — ein Testkonto, das sich am Ende selbst stilllegt");
  // ═════════════════════════════════════════════════════════════════════════
  // AGENTS.md: Ein Browser-/Routen-Prüfstand darf keine echte Anmeldung
  // benutzen. Also ein eigenes Konto — und `testkontoStilllegen` am Ende.
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE} Agent`}, ${`${MARKE.toLowerCase()}@example.invalid`},
            'agent', TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  testAgentId = Number(neu.id);

  // ══════════════════════════════════════════════════════════════════════════
  // DAS ONBOARDING DES TESTKONTOS
  //
  // ── WARUM DAS NÖTIG IST ─────────────────────────────────────────────────
  // `customerDataGate` sperrt ALLE /agent/*-Routen mit 403, solange ein
  // Mitarbeiter seine Zustimmungen nicht erteilt und den Vertrag nicht
  // gezeichnet hat. Das ist richtig — ein neues Konto soll nicht sofort an
  // Kundendaten. Der erste Lauf dieses Prüfstands lief genau dagegen.
  //
  // ── UND WARUM DAS HIER KEIN GEFÄLSCHTER NACHWEIS IST ────────────────────
  // AGENTS.md, 06.08.2026: „Ein Rechtsnachweis, den ein Roboter erzeugt, ist
  // wertlos." Das gilt für ECHTE Menschen — dort hat ein Testlauf einmal die
  // Verpflichtungserklärung der Vertriebsleitung angenommen.
  //
  // Hier geht es um ein Konto mit `is_test_account = TRUE`, das am Ende des
  // Laufs stillgelegt wird. Der Eintrag trägt die Prüfstandsmarke im Feld
  // `ip`, damit er in keiner Auswertung als menschliche Zustimmung zählt.
  // Zusätzlich wird die Zustimmung NUR für dieses Konto gesetzt — nicht für
  // eine bestehende Rolle, nicht für die Vorlage.
  // ══════════════════════════════════════════════════════════════════════════
  // `getActiveTemplate` ist NICHT exportiert (bewusst — sie ist Innenleben der
  // Onboarding-Routen). Die aktive Vorlage wird deshalb direkt gelesen; das ist
  // ehrlicher als einen Export zu erzwingen, den nur ein Prüfstand braucht.
  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${testAgentId}, ${d.key}, ${d.version}, NOW(),
              ${`PRUEFSTAND/${MARKE}`}, 'pruef-vollpfleger.ts (kein Mensch)')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [vorlage] = (await sqlPool`
    -- Die Spalte heisst status, nicht active (zwei Fehlversuche: erst die
    -- falsche Tabelle, dann die falsche Spalte). Beide scheiterten still im
    -- .catch — und der Prüfstand meldete „keine aktive Vorlage", statt zu
    -- sagen, dass die Abfrage kaputt war. Ein .catch, das einen echten Fehler
    -- verschluckt, kostet zwei Durchläufe.
    SELECT version FROM fiaon_contract_templates
    WHERE status = 'active' ORDER BY version DESC LIMIT 1
  `.catch((e) => { console.error("        (Vorlagen-Abfrage:", e, ")"); return []; })) as any[];
  if (vorlage) {
    await sqlPool`
      -- Alle Pflichtspalten: variables_json, rendered_html und doc_hash sind
      -- NOT NULL. Ein erster Entwurf ließ sie weg und scheiterte still im
      -- .catch — dann wäre der Vertragsteil unbemerkt offen geblieben.
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html,
         signature_name, signature_mode, doc_hash, status, signed_at)
      VALUES (${testAgentId}, ${Number(vorlage.version)},
              ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE} — kein Vertrag, kein Mensch.</p>`},
              ${`${MARKE} (Prüfstand)`}, 'pruefstand',
              ${`pruefstand-${MARKE}`}, 'signed', NOW())
    `.catch((e) => console.error("        (Vertrag nicht gesetzt:", e, ")"));
    console.log(`        Vertragsvorlage ${vorlage.version} gezeichnet (Prüfstand)`);
  } else {
    console.log("        (keine aktive Vertragsvorlage — der Vertragsteil entfällt)");
  }

  const cookie = await agentCookie(testAgentId);
  console.log(`        Testkonto ${testAgentId} (${MARKE})`);

  // Greift die Anmeldung überhaupt? Ohne diese Prüfung laufen alle folgenden
  // ins Leere, und man sucht den Fehler an der falschen Stelle.
  const probe = await ruf("/agent/kunden/pruefen", { email: "niemand@example.invalid" }, cookie);
  pruef("Das Testkonto ist angemeldet", probe.status === 200,
    `HTTP ${probe.status} — ${JSON.stringify(probe.j).slice(0, 120)}`);
  if (probe.status !== 200) {
    console.log("\n  Ohne Anmeldung sind die folgenden Prüfungen sinnlos. Abbruch.");
    return;
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("WAND 2 — PREISE NUR AUS DEM KATALOG");
  // ═════════════════════════════════════════════════════════════════════════
  const mitBetrag = await ruf("/agent/kunden/neu", {
    firstName: "Preis", lastName: MARKE,
    email: `preis.${MARKE.toLowerCase()}@example.invalid`,
    packKey: "pro", amountDue: 1,
  }, cookie);
  pruef("Ein mitgeschickter Betrag wird ABGELEHNT", mitBetrag.status === 400,
    `HTTP ${mitBetrag.status}`);
  pruef("… mit einer Begründung, die den Katalog nennt",
    /Katalog/.test(String(mitBetrag.j?.error ?? "")),
    String(mitBetrag.j?.error ?? "").slice(0, 90));
  pruef("… und es entstand KEINE Bestellung",
    ((await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE last_name = ${MARKE} AND first_name = 'Preis'
    `) as any[])[0].n === 0,
    "ein abgelehnter Aufruf darf nichts hinterlassen");

  const falschesPaket = await ruf("/agent/kunden/neu", {
    firstName: "Fantasie", lastName: MARKE,
    email: `fantasie.${MARKE.toLowerCase()}@example.invalid`,
    packKey: "gold_deluxe",
  }, cookie);
  pruef("Ein unbekanntes Paket wird abgelehnt", falschesPaket.status === 400,
    `HTTP ${falschesPaket.status}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("EINGABEN — ohne Erreichbarkeit kein Kunde");
  // ═════════════════════════════════════════════════════════════════════════
  const ohneKontakt = await ruf("/agent/kunden/neu",
    { firstName: "Ohne", lastName: MARKE, packKey: "pro" }, cookie);
  pruef("Ohne E-Mail UND ohne Nummer wird abgelehnt", ohneKontakt.status === 400);
  pruef("… und der Grund steht dabei",
    /Erreichbarkeit/.test(String(ohneKontakt.j?.error ?? "")),
    "ohne Person gibt es keinen Terminlink und keinen Versand");
  const ohneName = await ruf("/agent/kunden/neu",
    { email: `x.${MARKE.toLowerCase()}@example.invalid`, packKey: "pro" }, cookie);
  pruef("Ohne Namen wird abgelehnt", ohneName.status === 400);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE ANLAGE — ein Kunde entsteht");
  // ═════════════════════════════════════════════════════════════════════════
  const mail = `anlage.${MARKE.toLowerCase()}@example.invalid`;
  const anlage = await ruf("/agent/kunden/neu", {
    firstName: "Anlage", lastName: MARKE, email: mail,
    phone: PRUEF_NUMMER, packKey: "pro",
    street: "Prüfweg 1", zip: "10115", city: "Berlin",
  }, cookie);
  pruef("Der Kunde wird angelegt", anlage.status === 200 && !!anlage.j?.ref,
    `HTTP ${anlage.status} — ${JSON.stringify(anlage.j).slice(0, 140)}`);
  const ref = String(anlage.j?.ref ?? "");
  if (ref) angelegt.push(ref);

  if (ref) {
    const [z] = (await sqlPool`
      SELECT a.pack_key, a.pack_name, a.amount_due, a.payment_status, a.payment_reference,
             a.assigned_agent_id, a.person_id, a.phone,
             p.primary_email, p.primary_phone, p.assigned_agent_id AS person_agent
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.ref = ${ref}
    `) as any[];
    pruef("Der Preis kommt aus dem Katalog (59,99 für Pro)",
      Math.abs(Number(z.amount_due) - 59.99) < 0.005, `${z.amount_due}`);
    pruef("Der Zustand ist „Zahlung offen“", z.payment_status === "pending_payment",
      String(z.payment_status));
    pruef("Es gibt einen Verwendungszweck", /^FIAON[A-Z0-9]{4,}/.test(String(z.payment_reference)),
      String(z.payment_reference));
    pruef("Der anlegende Agent ist zugewiesen (Besitzschutz)",
      Number(z.assigned_agent_id) === testAgentId, String(z.assigned_agent_id));
    pruef("Eine PERSON ist entstanden", z.person_id != null, String(z.person_id));
    pruef("… und sie trägt die E-Mail", String(z.primary_email ?? "").toLowerCase() === mail,
      String(z.primary_email));
    pruef("… und die Nummer mit Landesvorwahl",
      String(z.primary_phone ?? "").startsWith("+49"), String(z.primary_phone));
    pruef("… und zwar GENAU die eingegebene",
      String(z.primary_phone ?? "").replace(/[^\d]/g, "").slice(-9)
        === PRUEF_NUMMER.replace(/[^\d]/g, "").slice(-9),
      `${z.primary_phone} vs. ${PRUEF_NUMMER}`);
    pruef("Auch an der Person ist der Agent zugewiesen",
      Number(z.person_agent) === testAgentId, String(z.person_agent));

    // ── WAND 4: DIE SPUR ──────────────────────────────────────────────────
    const [spur] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_contact_log
      WHERE ref = ${ref} AND note ILIKE '%angelegt%'
    `) as any[];
    pruef("Die Anlage steht im Kundenverlauf", Number(spur.n) >= 1, `${spur.n} Einträge`);
    const [akt] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_agent_events
      WHERE type = 'kunde_angelegt' AND agent_id = ${testAgentId}
    `) as any[];
    pruef("… und im Aktivitätsprotokoll", Number(akt.n) >= 1, `${akt.n} Einträge`);
    pruef("Der Typ steht im Aktivitäts-Katalog",
      /typ: "kunde_angelegt"/.test(lies("server/lib/fiaon-aktivitaet.ts")),
      "sonst erscheint der Eintrag in der Ansicht nicht");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE ROT-PROBE — ein eindeutiger Treffer erzeugt NIE eine zweite Person");
  // ═════════════════════════════════════════════════════════════════════════
  const [vorher] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE merged_into_person_id IS NULL
  `) as any[];

  const zweiterVersuch = await ruf("/agent/kunden/neu", {
    // Dieselbe Adresse, anderer Name — genau der Fall, der Doppelgänger macht.
    firstName: "Zweiter", lastName: MARKE, email: mail, packKey: "ultra",
  }, cookie);
  pruef("Der zweite Versuch wird mit 409 abgelehnt", zweiterVersuch.status === 409,
    `HTTP ${zweiterVersuch.status}`);
  pruef("… mit dem Grund „existiert“", zweiterVersuch.j?.grund === "existiert",
    String(zweiterVersuch.j?.grund));
  pruef("… und dem Treffer-Merkmal im Text",
    /Treffer über E-Mail/.test(String(zweiterVersuch.j?.error ?? "")),
    String(zweiterVersuch.j?.error ?? "").slice(0, 100));
  pruef("… und einem Weg zur bestehenden Akte",
    !!zweiterVersuch.j?.weiter?.ref, JSON.stringify(zweiterVersuch.j?.weiter));

  const [nachher] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE merged_into_person_id IS NULL
  `) as any[];
  pruef("ES ENTSTAND KEINE ZWEITE PERSON",
    Number(nachher.n) === Number(vorher.n),
    `vorher ${vorher.n}, nachher ${nachher.n} — das ist die Kernwand`);

  // Und über die RUFNUMMER? Derselbe Mensch, andere Adresse.
  const ueberNummer = await ruf("/agent/kunden/neu", {
    firstName: "Nummer", lastName: MARKE,
    email: `andere.${MARKE.toLowerCase()}@example.invalid`,
    phone: PRUEF_NUMMER, packKey: "pro",
  }, cookie);
  pruef("Auch über die RUFNUMMER wird erkannt", ueberNummer.status === 409,
    `HTTP ${ueberNummer.status} — ${String(ueberNummer.j?.error ?? "").slice(0, 80)}`);
  pruef("… und der Treffer wird als Rufnummer benannt",
    /Rufnummer/.test(String(ueberNummer.j?.error ?? "")),
    String(ueberNummer.j?.error ?? "").slice(0, 90));

  // ═════════════════════════════════════════════════════════════════════════
  titel("PAKET-HYGIENE — zwei offene Stufen wären zwei Rechnungen");
  // ═════════════════════════════════════════════════════════════════════════
  if (ref) {
    const upgrade = await ruf(`/agent/customers/${encodeURIComponent(ref)}/produkt`,
      { packKey: "ultra" }, cookie);
    pruef("Ein Upgrade wird angelegt", upgrade.status === 200 && !!upgrade.j?.ref,
      `HTTP ${upgrade.status} — ${JSON.stringify(upgrade.j).slice(0, 120)}`);
    if (upgrade.j?.ref) angelegt.push(String(upgrade.j.ref));
    pruef("Die alte offene Stufe wird stillgelegt",
      Array.isArray(upgrade.j?.ersetzt) && upgrade.j.ersetzt.includes(ref),
      JSON.stringify(upgrade.j?.ersetzt));
    const [alt] = (await sqlPool`
      SELECT merged_into FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    pruef("… und trägt den Verweis auf die neue", alt?.merged_into === upgrade.j?.ref,
      String(alt?.merged_into));
    pruef("Der Hinweis erklärt, warum",
      /nur eine Zahlungsaufforderung/.test(String(upgrade.j?.hinweis ?? "")),
      String(upgrade.j?.hinweis ?? ""));

    // ── DIE AUSKUNFT IST KEIN STUFENPAKET ────────────────────────────────
    const auskunft = await ruf(`/agent/customers/${encodeURIComponent(upgrade.j?.ref ?? ref)}/produkt`,
      { packKey: "schufa" }, cookie);
    pruef("Die Bonitätsauskunft lässt sich zusätzlich anlegen",
      auskunft.status === 200, `HTTP ${auskunft.status}`);
    if (auskunft.j?.ref) angelegt.push(String(auskunft.j.ref));
    pruef("… und legt KEIN Paket still",
      Array.isArray(auskunft.j?.ersetzt) && auskunft.j.ersetzt.length === 0,
      `${JSON.stringify(auskunft.j?.ersetzt)} — die Kategoriegrenze kostete einmal 583,98 €`);
    pruef("… und trägt das SCHUFA-Präfix",
      String(auskunft.j?.ref ?? "").includes("FIAON-SCHUFA-"),
      String(auskunft.j?.ref));
    pruef("… mit 74 € aus dem Katalog",
      Math.abs(Number(auskunft.j?.paket?.preisEuro) - 74) < 0.005,
      String(auskunft.j?.paket?.preisEuro));

    const zweiteAuskunft = await ruf(`/agent/customers/${encodeURIComponent(upgrade.j?.ref ?? ref)}/produkt`,
      { packKey: "schufa" }, cookie);
    pruef("Eine ZWEITE offene Auskunft wird abgelehnt", zweiteAuskunft.status === 409,
      `HTTP ${zweiteAuskunft.status}`);
    pruef("… mit dem Grund „schon offen“", zweiteAuskunft.j?.grund === "schon_offen",
      String(zweiteAuskunft.j?.grund));
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("WAND 1 — BEZAHLTES IST UNANTASTBAR");
  // ═════════════════════════════════════════════════════════════════════════
  // Geprüft am Quelltext UND an einem echten bezahlten Fall: Ein Prüfstand, der
  // eine Zahlung erzeugt, wäre selbst ein Schaden.
  const anlageQuelle = lies("server/routes/fiaon-agent-anlage.ts");
  pruef("Die Hygiene fasst nur OFFENE Bestellungen an",
    /AND payment_status IN \('pending_payment', 'claimed_paid'\)/.test(anlageQuelle));
  pruef("… und prüft das beim Stilllegen ein zweites Mal",
    (anlageQuelle.match(/payment_status IN \('pending_payment', 'claimed_paid'\)/g) ?? []).length >= 2,
    "zwischen Lesen und Schreiben kann eine Zahlung eingehen");
  pruef("Eine bezahlte Auskunft verhindert die zweite",
    /grund: "bezahlt"/.test(anlageQuelle));

  const [bezahlteAngefasst] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NOT NULL
      AND updated_at > NOW() - INTERVAL '10 minutes'
  `) as any[];
  pruef("Dieser Lauf hat KEINE bezahlte Bestellung stillgelegt",
    Number(bezahlteAngefasst.n) === 0, `${bezahlteAngefasst.n} — das wäre ein echter Schaden`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("WAND 3 — DIE PROVISIONS-WAND BLEIBT");
  // ═════════════════════════════════════════════════════════════════════════
  // ── OHNE KOMMENTARE PRÜFEN ─────────────────────────────────────────────
  // Erster Entwurf suchte „provision" im ganzen Text — und traf den Kommentar,
  // der ERKLÄRT, dass hier keine Provision gebucht wird. Wer die Abwesenheit
  // von Code prüft, schließt Kommentare aus (dieselbe Lehre wie am 23.08.).
  const anlageCode = anlageQuelle
    .split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*|--)/.test(z)).join("\n");
  pruef("Die Anlage bucht KEINE Provision",
    !/onCustomerPaid|commissionBuchen|INSERT INTO fiaon_commissions/i.test(anlageCode),
    "die Provision entscheidet weiter onCustomerPaid nach der bestehenden Regel");
  const [prov] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions
    WHERE agent_id = ${testAgentId}
  `.catch(() => [{ n: 0 }])) as any[];
  pruef("Für das Testkonto entstand keine Provision", Number(prov.n) === 0, `${prov.n}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("STAMMDATEN UND TERMIN");
  // ═════════════════════════════════════════════════════════════════════════
  // ── DIE LEBENDE REFERENZ, NICHT DIE STILLGELEGTE ───────────────────────
  // Der Upgrade-Test legt `ref` still (das ist ja der Sinn der Paket-Hygiene).
  // Danach findet keine Route sie mehr — sie filtern alle `merged_into IS NULL`.
  // Ein erster Entwurf prüfte weiter mit `ref` und bekam sechsmal HTTP 404,
  // also RICHTIGES Verhalten, das wie ein Fehler aussah.
  const [lebend] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE last_name = ${MARKE} AND merged_into IS NULL
      AND COALESCE(type, '') <> 'schufa'
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  const aktuelleRef = String(lebend?.ref ?? ref);
  console.log(`        Lebende Referenz: ${aktuelleRef}`);

  if (aktuelleRef) {
    const ref = aktuelleRef;   // ab hier gilt die lebende
    const stamm = await ruf(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`,
      { city: "Hamburg", street: "Neuer Weg 5" }, cookie);
    pruef("Stammdaten lassen sich ändern", stamm.status === 200, `HTTP ${stamm.status}`);
    const [nachStamm] = (await sqlPool`
      SELECT city FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    pruef("… und die Änderung kommt an", nachStamm?.city === "Hamburg", String(nachStamm?.city));
    const [stammSpur] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_contact_log
      WHERE ref = ${ref} AND type = 'edit'
    `) as any[];
    pruef("… mit einem Verlaufseintrag je Feld", Number(stammSpur.n) >= 2, `${stammSpur.n}`);

    const verboten = await ruf(`/agent/customers/${encodeURIComponent(ref)}/stammdaten`,
      { amountDue: 1, payment_status: "paid" }, cookie);
    pruef("Beträge und Zahlungszustände werden hier abgelehnt", verboten.status === 400,
      `HTTP ${verboten.status}`);

    const termin = await ruf(`/agent/customers/${encodeURIComponent(ref)}/termin-anbieten`,
      { senden: false }, cookie);
    pruef("Der Terminlink lässt sich holen (ohne Versand)",
      termin.status === 200 && /\/termin\//.test(String(termin.j?.link ?? "")),
      `HTTP ${termin.status} — ${String(termin.j?.link ?? "").slice(0, 60)}`);
    pruef("… und es wurde nichts gesendet", termin.j?.gesendet === false);
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
}

/**
 * Aufräumen — läuft IMMER, auch wenn Prüfungen scheitern.
 *
 * Kein Hard-Delete (AGENTS.md): Die Prüf-Bestellungen werden auf `merged_into`
 * gesetzt und tragen im Verlauf, warum. Das Testkonto legt sich still.
 */
async function aufraeumen(): Promise<void> {
  console.log("  ── Aufräumen ──");
  const refs = (await sqlPool`
    SELECT ref FROM fiaon_applications WHERE last_name = ${MARKE} OR ref = ANY(${angelegt})
  `) as any[];
  for (const r of refs) {
    await sqlPool`
      UPDATE fiaon_applications
      SET merged_into = 'PRUEFSTAND-AUFGERAEUMT', payment_status = 'expired', updated_at = NOW()
      WHERE ref = ${r.ref} AND payment_status <> 'paid'
    `.catch(() => {});
  }
  console.log(`     ${refs.length} Prüf-Bestellungen stillgelegt`);

  // Die Prüf-Personen ebenso.
  const personen = (await sqlPool`
    UPDATE fiaon_persons SET ist_test_am = NOW(), updated_at = NOW()
    WHERE last_name = ${MARKE} AND ist_test_am IS NULL
    RETURNING id
  `.catch(() => [])) as any[];
  console.log(`     ${personen.length} Prüf-Personen als Test markiert`);

  if (testAgentId != null) {
    const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
    await testkontoStilllegen(testAgentId).catch(() => {});
    console.log(`     Testkonto ${testAgentId} stillgelegt`);
  }
}

main()
  .catch((e) => { console.error(e); rot++; })
  .finally(async () => {
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
    await sqlPool.end().catch(() => {});
    process.exit(rot > 0 ? 1 : 0);
  });
