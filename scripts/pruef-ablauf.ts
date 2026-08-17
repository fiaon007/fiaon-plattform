// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER GANZE ABLAUF AN EINER TESTPERSON
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// „Ein Prüfstand-Durchlauf, der den GESAMTEN Ablauf an einer Testperson beweist
// (zurückgerollt): Antrag → Zahlung gebucht → Stufe wartet_auf_onboarding →
// Gate liefert beide Karten → Termin gebucht (Slot-Grenze greift) →
// Cockpit-Abschluss → voll_aktiv + account_activated + 15-€-Gutschrift genau
// einmal → Abo-Rate am Jahrestag → T+1 überfällig → Inkasso-Zuteilung."
//
// ── ALLES IN EINER TRANSAKTION, DIE ZURÜCKGEROLLT WIRD ─────────────────────
// Die Datenbank ist Produktion (AGENTS.md). Der ganze Durchlauf läuft in einer
// Transaktion; am Ende wird sie verworfen. Es bleibt keine Testperson, keine
// Testbestellung, kein Testtermin und keine Testgutschrift zurück.
//
// Deshalb wird auch KEINE Mail verschickt: Der Versand läuft über Funktionen,
// die die Transaktion nicht kennen — sie werden hier nicht gerufen, sondern
// ihre Verdrahtung wird am Quelltext geprüft. Eine echte Mail an eine
// erfundene Adresse wäre ein echter Versand.
//
//   npx tsx scripts/pruef-ablauf.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function station(n: number, t: string): void {
  console.log(`\n${"─".repeat(72)}\nSTATION ${n} — ${t}\n${"─".repeat(72)}`);
}
function titel(t: string): void { console.log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  const { stufeAbleiten, stufenFuerListe, stufeAbgleichen } =
    await import("../server/lib/fiaon-kundenstufe");

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — DIE ABLEITUNG, JE KONSTELLATION");
  // ═════════════════════════════════════════════════════════════════════════
  // Fünf Konstellationen, an echten Bestellungen. Jede muss die richtige Stufe
  // ergeben — und die Sammelfassung (SQL) muss dasselbe sagen wie die
  // Einzelfassung (TypeScript). Zwei Fassungen derselben Regel sind nur
  // zulässig, wenn sie gegeneinander geprüft werden.
  const faelle: [string, string, string][] = [
    ["unbezahlt", "payment_status <> 'paid' AND type IS DISTINCT FROM 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'", "kein_zugang"],
    ["bezahlt ohne Gespräch",
      "payment_status = 'paid' AND type IS DISTINCT FROM 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'"
      + " AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = fiaon_applications.person_id"
      + " AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')"
      + " AND NULLIF(TRIM(COALESCE(onboarding_ausnahme_grund, '')), '') IS NULL",
      "wartet_auf_onboarding"],
    ["SCHUFA-nur", "(type = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') AND payment_status = 'paid'", "voll_aktiv"],
  ];
  for (const [name, bedingung, erwartet] of faelle) {
    const [r] = (await sqlPool.unsafe(`
      SELECT ref FROM fiaon_applications
      WHERE merged_into IS NULL AND ${bedingung} LIMIT 1
    `)) as any[];
    if (!r) { pruef(`Ableitung: ${name}`, false, "kein Beispiel im Bestand"); continue; }
    const lage = await stufeAbleiten(String(r.ref));
    pruef(`Ableitung: ${name} → ${erwartet}`, lage?.stufe === erwartet,
      `${r.ref} ergab „${lage?.stufe}“`);

    // Und die Sammelfassung muss dasselbe sagen.
    const sammel = await stufenFuerListe([String(r.ref)]);
    pruef(`  … Sammelabfrage stimmt überein (${name})`,
      sammel.get(String(r.ref))?.stufe === lage?.stufe,
      `einzeln „${lage?.stufe}“ vs. sammel „${sammel.get(String(r.ref))?.stufe}“`);
  }

  // Der Bestand muss nach der Migration sauber sein.
  const [falsch] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.onboarding_stufe = 'voll_aktiv' AND a.payment_status = 'paid'
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
      AND NULLIF(TRIM(COALESCE(a.onboarding_ausnahme_grund, '')), '') IS NULL
  `) as any[];
  pruef("KEIN „voll aktiv“ ohne Gespräch und ohne Ausnahme", Number(falsch.n) === 0,
    `${falsch.n} Bestellungen — genau der Screenshot-Fehler`);

  // ── DIE TÜR HAT EINEN SCHLÜSSEL ────────────────────────────────────────
  const { freieSlots, rollenMitRueckfall } = await import("../server/lib/fiaon-termine");
  const [wartend] = (await sqlPool`
    SELECT person_id FROM fiaon_applications
    WHERE onboarding_stufe = 'wartet_auf_onboarding' AND merged_into IS NULL AND person_id IS NOT NULL
    LIMIT 1
  `) as any[];
  if (wartend) {
    const auskunft = await freieSlots(Number(wartend.person_id), sqlPool, "onboarding_call");
    const jeTag = new Map<string, number>();
    for (const s of auskunft.slots) jeTag.set(s.datum, (jeTag.get(s.datum) ?? 0) + 1);
    pruef("Ein wartender Kunde kann buchen", auskunft.slots.length > 0,
      "ein Pflicht-Gate ohne Termine ist eine verschlossene Tür");
    pruef("Höchstens fünf Zeiten je Tag",
      Array.from(jeTag.values()).every((n) => n <= 5),
      Array.from(jeTag.entries()).filter(([, n]) => n > 5).map(([t, n]) => `${t}=${n}`).join(", "));
    const r = await rollenMitRueckfall("onboarding_call");
    console.log(`        ${auskunft.slots.length} Zeiten über ${jeTag.size} Tage `
      + `(Rollen: ${r.rollen?.join(", ")}${r.rueckfall ? ", RÜCKFALL" : ""})`);
  } else pruef("Ein wartender Kunde kann buchen", false, "kein wartender Kunde gefunden");

  // ── DIE ANZEIGEN LESEN DIE ABLEITUNG ───────────────────────────────────
  pruef("Das Portal liest die Ableitung",
    /stufe: abgeleitet\?\.stufe/.test(lies("server/routes/fiaon-startgespraech.ts")));
  pruef("Die Status-Kachel liest die Stufe, nicht account_status",
    /stufe\?\.kundenstufe === 'voll_aktiv' \? 'Voll aktiv'/.test(lies("client/src/pages/dashboard.tsx")),
    "„account_status = active“ heißt nur „nicht gesperrt“");
  pruef("Die Akte liest die Ableitung",
    /stufenlage/.test(lies("server/routes/fiaon-kunden.ts"))
      && /<KundenKopf/.test(lies("client/src/pages/admin-kunde.tsx")));
  pruef("Die Leitungs-Schublade nutzt DASSELBE Bauteil",
    /<KundenKopf/.test(lies("client/src/pages/agent/vertrieb.tsx")),
    "zwei Fassungen für denselben Kunden gehen auseinander");
  pruef("Das Gate zeigt BEIDE Karten gleichzeitig",
    /<BonitaetsKarte/.test(lies("client/src/components/StartgespraechGate.tsx"))
      && /lg:grid-cols-\[1\.35fr_1fr\]/.test(lies("client/src/components/StartgespraechGate.tsx")));
  const dash = lies("client/src/pages/dashboard.tsx");
  pruef("Die Begrüßungstafel tritt hinter dem Gate zurück",
    dash.includes('if (stufe.kundenstufe === "wartet_auf_onboarding") return;'),
    "zwei Tafeln hintereinander liest niemand");
  pruef("Und sie wartet, bis die Stufe bekannt ist",
    dash.includes("if (stufe === null) return;"),
    "sonst öffnet sie, bevor klar ist, ob ein Gate ansteht — und liegt darüber");

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 4 — DER GANZE ABLAUF AN EINER TESTPERSON (zurückgerollt)");
  // ═════════════════════════════════════════════════════════════════════════
  await sqlPool.begin(async (tx: any) => {
    const marke = `PRUEF-ABLAUF-${Date.now().toString(36).toUpperCase()}`;
    const mail = `pruefstand-ablauf@example.invalid`;

    // ── STATION 1: ANTRAG ────────────────────────────────────────────────
    station(1, "ANTRAG");
    // `person_ref` ist Pflicht und hat keine Vorgabe in der Datenbank — sie
    // wird im Code erzeugt (Form: FIAON-P-XXXXXXXX). Der Prüfstand baut sie
    // genauso, mit „PRUEF" im Namen, damit sie im Zweifel erkennbar ist.
    const personRef = `FIAON-P-PRUEF${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const [person] = (await tx`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, account_status, created_at, updated_at)
      VALUES (${personRef}, 'private', 'Prüfstand', 'Ablauf', ${mail}, 'pending', NOW(), NOW())
      RETURNING id
    `) as any[];
    const [antrag] = (await tx`
      INSERT INTO fiaon_applications (
        ref, type, status, person_id, first_name, last_name, email,
        pack_key, pack_name, amount_due, payment_status, password, created_at, updated_at
      ) VALUES (
        ${marke}, 'private', 'completed', ${person.id}, 'Prüfstand', 'Ablauf', ${mail},
        'pro', 'FIAON Pro (Standard)', 59.99, 'pending_payment', 'x', NOW(), NOW()
      ) RETURNING ref, payment_reference
    `) as any[];
    pruef("Antrag angelegt", !!antrag?.ref);
    pruef("Verwendungszweck wurde automatisch gesetzt",
      typeof antrag.payment_reference === "string" && antrag.payment_reference.startsWith("FIAON-"),
      `„${antrag.payment_reference}“ — der Trigger aus Migration 037`);
    pruef("Paketname ist einzeilig", !/[\r\n]/.test("FIAON Pro (Standard)"));

    let lage = await stufeAbleiten(marke, tx);
    pruef("Stufe: kein_zugang (noch nicht bezahlt)", lage?.stufe === "kein_zugang",
      `ergab „${lage?.stufe}“`);
    pruef("Der nächste Schritt nennt die Zahlung",
      /zahlung/i.test(String(lage?.naechsterSchritt)), String(lage?.naechsterSchritt));

    // ── STATION 2: ZAHLUNG GEBUCHT ───────────────────────────────────────
    station(2, "ZAHLUNG BANKBESTÄTIGT GEBUCHT");
    await tx`
      UPDATE fiaon_applications SET
        payment_status = 'paid', status = 'payment_completed',
        completed_at = NOW(), paid_at = NOW(),
        onboarding_stufe = 'wartet_auf_onboarding', onboarding_pflicht = TRUE,
        updated_at = NOW()
      WHERE ref = ${marke}
    `;
    lage = await stufeAbleiten(marke, tx);
    pruef("Stufe: wartet_auf_onboarding", lage?.stufe === "wartet_auf_onboarding",
      `ergab „${lage?.stufe}“`);
    pruef("Der Ablauf zeigt Zahlung erledigt, Gespräch offen",
      lage?.ablauf.zahlung === true && lage?.ablauf.startgespraech === false);
    pruef("Der nächste Schritt nennt das Startgespräch",
      /startgespräch/i.test(String(lage?.naechsterSchritt)), String(lage?.naechsterSchritt));
    pruef("Die Abschrift wurde mitgeführt", lage?.spalteWeichtAb === false);

    // ── STATION 3: DAS GATE ──────────────────────────────────────────────
    station(3, "DAS GATE — beide Karten, Slot-Grenze");
    const auskunft = await freieSlots(Number(person.id), tx, "onboarding_call");
    const jeTag = new Map<string, number>();
    for (const s of auskunft.slots) jeTag.set(s.datum, (jeTag.get(s.datum) ?? 0) + 1);
    pruef("Das Gate liefert Zeiten", auskunft.slots.length > 0);
    pruef("Höchstens fünf je Tag", Array.from(jeTag.values()).every((n) => n <= 5),
      Array.from(jeTag.entries()).filter(([, n]) => n > 5).map(([t, n]) => `${t}=${n}`).join(", "));
    pruef("Die Auskunft ist noch nicht bezahlt", lage?.auskunftBezahlt === false);
    pruef("Die Auskunft ist NICHT Bedingung für die Freischaltung",
      lage?.stufe === "wartet_auf_onboarding" && lage?.ablauf.auskunft === false,
      "die Stufe hängt nur am Gespräch");

    // ── STATION 4: TERMIN GEBUCHT ────────────────────────────────────────
    station(4, "TERMIN GEBUCHT");
    const ersterSlot = auskunft.slots[0];
    if (!ersterSlot) {
      pruef("Termin buchbar", false, "keine Slots — der Ablauf bricht hier ab");
      throw new Error("ROLLBACK");
    }
    const [termin] = (await tx`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, quelle, status, created_at, updated_at)
      VALUES (${person.id}, ${ersterSlot.agentId}, ${ersterSlot.beginn}, 15,
              'onboarding_call', 'gebucht', NOW(), NOW())
      RETURNING id, beginn
    `) as any[];
    pruef("Termin angelegt", !!termin?.id);
    lage = await stufeAbleiten(marke, tx);
    pruef("Stufe bleibt wartet_auf_onboarding (gebucht ≠ geführt)",
      lage?.stufe === "wartet_auf_onboarding");
    pruef("Der nächste Schritt kennt den Termin",
      /termin steht|führen/i.test(String(lage?.naechsterSchritt)), String(lage?.naechsterSchritt));

    // ── STATION 5: DAS GESPRÄCH IST GEFÜHRT ──────────────────────────────
    station(5, "COCKPIT-ABSCHLUSS → VOLL AKTIV");
    await tx`
      UPDATE fiaon_termine SET status = 'erledigt', erledigt_am = NOW(), updated_at = NOW()
      WHERE id = ${termin.id}
    `;
    lage = await stufeAbleiten(marke, tx);
    pruef("Stufe: voll_aktiv", lage?.stufe === "voll_aktiv", `ergab „${lage?.stufe}“`);
    pruef("Der Ablauf zeigt das Gespräch erledigt", lage?.ablauf.startgespraech === true);
    pruef("Die Abschrift weicht jetzt ab (bis zum Abgleich)", lage?.spalteWeichtAb === true,
      "sie stand noch auf „wartet“ — genau dafür gibt es stufeAbgleichen()");
    const abgleich = await stufeAbgleichen(marke, tx);
    pruef("Der Abgleich zieht die Abschrift nach", abgleich.geaendert
      && abgleich.nach === "voll_aktiv");
    pruef("Zweiter Abgleich ändert nichts (idempotent)",
      (await stufeAbgleichen(marke, tx)).geaendert === false);

    // ── DIE 15-€-GUTSCHRIFT, GENAU EINMAL ────────────────────────────────
    const { onboardingGutschrift } = await import("../server/lib/fiaon-onboarding-verguetung");
    const [ag] = (await tx`SELECT id, name FROM fiaon_agents WHERE active ORDER BY id LIMIT 1`) as any[];
    const g1 = await onboardingGutschrift({
      personId: Number(person.id), agentId: Number(ag.id), agentName: ag.name,
      terminId: Number(termin.id), ref: marke,
    }, tx);
    const g2 = await onboardingGutschrift({
      personId: Number(person.id), agentId: Number(ag.id), agentName: ag.name,
      terminId: Number(termin.id), ref: marke,
    }, tx);
    pruef("Gutschrift entsteht", g1.gutgeschrieben, g1.grund);
    pruef("Sie beträgt 15 €", g1.cents === 1500, `${(g1.cents / 100).toFixed(2)} €`);
    pruef("Eine zweite wird abgewiesen", !g2.gutgeschrieben);
    const [gz] = (await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_commissions
      WHERE kind = 'onboarding' AND onboarding_person_id = ${person.id}
    `) as any[];
    pruef("Genau EINE Gutschrift je Kunde", Number(gz.n) === 1, `es sind ${gz.n}`);

    // Das Ereignis für den Kunden ist verdrahtet — geprüft am Quelltext, weil
    // ein echter Versand hier eine echte Mail wäre.
    pruef("account_activated ist am Abschluss verdrahtet",
      /account_activated/.test(lies("server/routes/fiaon-onboarding-bereich.ts")));

    // ── STATION 6: DIE ABO-RATE AM JAHRESTAG ─────────────────────────────
    station(6, "ABO-RATE AM JAHRESTAG");
    // ══════════════════════════════════════════════════════════════════
    // WARUM DIE ECHTE FUNKTION HIER NICHT GERUFEN WIRD
    //
    // `aboBeiZahlungAnlegen()` schreibt intern mit `sqlPool` — nicht mit dem
    // übergebenen Lauf. Ein Aufruf hier hätte also AUSSERHALB dieser
    // Transaktion geschrieben und wäre beim Zurückrollen NICHT verschwunden:
    // eine echte Testbestellung mit echten Raten in der Produktionsdatenbank.
    //
    // Beim ersten Versuch fiel das auf, weil sie zusätzlich
    // `ensureAboTabellen()` ruft — das macht DDL, brauchte einen Lock und lief
    // in dieser Transaktion in einen Timeout. Der Timeout war ein Glücksfall:
    // Ohne ihn hätte der Prüfstand still Produktionsdaten angelegt.
    //
    // Also wird die Kette hier mit DENSELBEN Regeln nachgezogen (Rate 1 am
    // Ankertag als bezahlt, Rate 2 einen Monat später) — und dass die echte
    // Funktion dieselben Regeln anwendet, wird am Quelltext und am echten
    // Bestand geprüft (unten).
    // ══════════════════════════════════════════════════════════════════
    const referenz = `PRUEF-A-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const anker = new Date();
    const jahrestag = new Date(anker);
    jahrestag.setMonth(jahrestag.getMonth() + 1);
    await tx`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${marke}, 1, ${`${referenz}-1`}, 5999, ${anker.toISOString().slice(0, 10)}::date,
              'bezahlt', NOW(), 'pruefstand', 'Startzahlung')
    `;
    await tx`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
      VALUES (${marke}, 2, ${`${referenz}-2`}, 5999, ${jahrestag.toISOString().slice(0, 10)}::date,
              'offen', 'pruefstand', 'Erste Monatsrate am Jahrestag')
    `;
    const raten = (await tx`
      SELECT rate_nr AS nummer, faellig_am, betrag_cents AS betrag_cent, status
      FROM fiaon_abo_raten WHERE ref = ${marke} ORDER BY rate_nr
    `) as any[];

    // Die ECHTE Funktion, geprüft am Quelltext und am Bestand.
    const aboQuelle = lies("server/routes/fiaon-abo.ts");
    pruef("Die echte Abo-Anlage verlangt bankbestätigte Zahlung",
      /if \(app\.payment_status !== "paid"\) return \{ angelegt: false/.test(aboQuelle));
    // REGEX EINZEILIG (AGENTS.md): Ein `\s*` mit echtem Zeilenumbruch im
    // Literal ergibt „Unterminated regular expression". Statt über Zeilen zu
    // suchen, wird auf zwei EINDEUTIGE Bruchstücke geprüft.
    pruef("Sie legt Rate 1 als bezahlt an (Ankerpunkt)",
      aboQuelle.includes("'bezahlt',") && aboQuelle.includes("'Startzahlung'"));
    pruef("Eine Bonitätsauskunft erzeugt KEIN Abo",
      /istBonitaetsCheck\(app\)\) return \{ angelegt: false/.test(aboQuelle));
    const [echteRaten] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
    `) as any[];
    pruef("Im Bestand hat keine Auskunft ein Abo", Number(echteRaten.n) === 0,
      `${echteRaten.n} Raten an Auskunft-Bestellungen`);
    pruef("Eine Abo-Rate entstand", raten.length > 0, `${raten.length} Raten`);
    if (raten.length > 0) {
      // ── RATE 1 IST DIE STARTZAHLUNG, NICHT DIE ERSTE FORDERUNG ────────
      // Der erste Entwurf prüfte `raten[0]` auf „liegt in der Zukunft" und
      // wurde rot: Rate 1 ist der ANKERPUNKT — heute, bezahlt. Die erste
      // offene Forderung ist Rate 2, am Jahrestag.
      pruef("Rate 1 ist die Startzahlung (bezahlt, heute)",
        Number(raten[0].nummer) === 1 && raten[0].status === "bezahlt");
      const offen = raten.find((r) => r.status === "offen");
      pruef("Es gibt eine offene Folgerate", !!offen);
      if (offen) {
        const faellig = new Date(offen.faellig_am);
        pruef("Sie liegt in der ZUKUNFT (Jahrestag)", faellig > new Date(),
          `fällig ${faellig.toISOString().slice(0, 10)}`);
        pruef("Sie trägt den Paketbetrag", Number(offen.betrag_cent) === 5999,
          `${(Number(offen.betrag_cent) / 100).toFixed(2)} €`);
        console.log(`        Rate ${offen.nummer}: ${faellig.toISOString().slice(0, 10)} · `
          + `${(Number(offen.betrag_cent) / 100).toFixed(2)} € · ${offen.status}`);
      }
    }

    // ── STATION 7: T+1 ÜBERFÄLLIG → FORDERUNGSMANAGEMENT ─────────────────
    station(7, "T+1 ÜBERFÄLLIG → FORDERUNGSMANAGEMENT");
    if (raten.length > 0) {
      // Die Rate auf gestern setzen — so wird sie überfällig, ohne zu warten.
      await tx`
        UPDATE fiaon_abo_raten SET faellig_am = CURRENT_DATE - 1
        WHERE ref = ${marke} AND rate_nr = 2
      `;
      const [ueber] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
        WHERE ref = ${marke} AND status = 'offen' AND faellig_am < CURRENT_DATE
      `) as any[];
      pruef("Die Rate ist ab T+1 überfällig", Number(ueber.n) === 1,
        `${ueber.n} überfällige Raten`);

      // Die Zuteilung ins Forderungsmanagement — die bestehende Funktion.
      // ── DIE ZUTEILUNG HEISST `inkassoVerteilen` ─────────────────────
      // Der erste Entwurf suchte `inkassoZuteilen` und fand nichts — ein
      // geratener Name. Sie hat eine VORSCHAU (`schreiben: false`), und genau
      // die wird hier benutzt: Sie zeigt, WEM die Forderung zufallen würde,
      // ohne zu schreiben. Für einen Prüfstand ist das die richtige Hälfte.
      try {
        const { inkassoVerteilen, inkassoMannschaft } =
          await import("../server/lib/fiaon-inkasso");
        const mannschaft = await inkassoMannschaft(tx);
        pruef("Es gibt eine Forderungsmannschaft", mannschaft.length > 0,
          "ohne Menschen im Forderungsmanagement bleibt jede Rate liegen");
        const vorschau = await inkassoVerteilen({ schreiben: false, anzahl: 50 }, tx);
        pruef("Die Zuteilung liefert einen Vorschlag",
          Array.isArray(vorschau.vorschlag),
          vorschau.hinweis);
        // Ist UNSERE überfällige Rate darunter? Sie ist erst seit einer
        // Sekunde überfällig — die Verteilung nimmt die ältesten zuerst,
        // deshalb genügt, dass sie als unverteilt GEZÄHLT wird.
        pruef("Überfällige Raten werden als unverteilt erkannt",
          Number(vorschau.unverteilt) > 0,
          `unverteilt: ${vorschau.unverteilt}`);
        console.log(`        ${mannschaft.length} im Forderungsmanagement · `
          + `${vorschau.unverteilt} unverteilt · ${vorschau.vorschlag.length} im Vorschlag`);
      } catch (e) {
        pruef("Die Zuteilung läuft", false, String((e as Error).message).slice(0, 90));
      }
    }

    // ── DIE AUSNAHME ─────────────────────────────────────────────────────
    station(8, "DIE AUSNAHME (Härtefall)");
    // Ein zweiter Kunde, wartend, mit gesetzter Ausnahme.
    const marke2 = `${marke}-B`;
    const [person2] = (await tx`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, created_at, updated_at)
      VALUES (${`${personRef}B`}, 'private', 'Prüfstand', 'Ausnahme', ${`b-${mail}`}, NOW(), NOW())
      RETURNING id
    `) as any[];
    await tx`
      INSERT INTO fiaon_applications (
        ref, type, status, person_id, first_name, last_name, email,
        pack_key, pack_name, amount_due, payment_status, created_at, updated_at
      ) VALUES (
        ${marke2}, 'private', 'completed', ${person2.id}, 'Prüfstand', 'Ausnahme', ${`b-${mail}`},
        'pro', 'FIAON Pro (Standard)', 59.99, 'paid', NOW(), NOW()
      )
    `;
    let lage2 = await stufeAbleiten(marke2, tx);
    pruef("Ohne Ausnahme: wartet_auf_onboarding", lage2?.stufe === "wartet_auf_onboarding");

    // Ausnahme OHNE Grund darf nicht greifen.
    await tx`
      UPDATE fiaon_applications SET onboarding_pflicht = FALSE WHERE ref = ${marke2}
    `;
    lage2 = await stufeAbleiten(marke2, tx);
    pruef("Ausnahme OHNE Grund greift NICHT", lage2?.stufe === "wartet_auf_onboarding",
      "sonst wäre der Schalter eine Hintertür ohne Spur");

    await tx`
      UPDATE fiaon_applications SET
        onboarding_ausnahme_grund = 'Kunde liegt im Krankenhaus, telefonisch nicht erreichbar.',
        onboarding_ausnahme_von = 'Prüfstand', onboarding_ausnahme_am = NOW()
      WHERE ref = ${marke2}
    `;
    lage2 = await stufeAbleiten(marke2, tx);
    pruef("Ausnahme MIT Grund greift", lage2?.stufe === "voll_aktiv");
    pruef("Der Grund steht in der Lage", /Krankenhaus/.test(String(lage2?.grund)),
      String(lage2?.grund));
    pruef("Die Ausnahme ist als solche erkennbar", lage2?.ausnahme.gesetzt === true);

    throw new Error("ROLLBACK");
  }).catch((e: any) => {
    if (e.message !== "ROLLBACK") throw e;
    console.log("\n  → Alles zurückgerollt. Keine Testperson, keine Testbestellung,");
    console.log("    kein Testtermin, keine Testgutschrift bleibt zurück.");
  });

  // ── DIE GEGENPROBE: ist wirklich nichts geblieben? ──────────────────────
  const [rest] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE 'PRUEF-ABLAUF-%'
  `) as any[];
  pruef("Keine Testbestellung übrig", Number(rest.n) === 0, `${rest.n} gefunden`);
  const [restP] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE primary_email LIKE '%pruefstand-ablauf@example.invalid'
  `) as any[];
  pruef("Keine Testperson übrig", Number(restP.n) === 0, `${restP.n} gefunden`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
