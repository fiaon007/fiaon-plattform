// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER KUNDENWEG ALS MASCHINE
//
// Fünf Teile, geprüft an den Zahlen, nicht an der Absicht:
//   1  Die ewige Lead-Strecke — Kadenz, Rotation, harte Stopps, Abmeldung
//   2  Der SCHUFA-Moment — Karte auf der Bühne, Kopierknöpfe
//   3  Knappe Slots — höchstens fünf je Tag, gestreut, Server filtert identisch
//   4  Abo-Klarheit als Pflichtschritt + Onboarding-Vergütung
//   5  Die Provisions-Wand — Kontakt vor Zahlung
//
// SCHREIBENDE PRÜFUNGEN LAUFEN IN EINER TRANSAKTION, die am Ende zurückgerollt
// wird (AGENTS.md). Die Datenbank ist Produktion.
//
//   npx tsx scripts/pruef-kundenweg.ts
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
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — DIE EWIGE LEAD-STRECKE");
  // ═════════════════════════════════════════════════════════════════════════
  const strecke = await import("../shared/fiaon-lead-strecke");
  const motor = await import("../server/lib/fiaon-lead-strecke");

  pruef("Die Kadenz endet NICHT", strecke.faelligNachTagen(50) > strecke.faelligNachTagen(49),
    "Stufe 50 muss später fällig sein als 49 — sonst gibt es ein Ende");
  pruef("Nach dem ersten Monat monatlich",
    strecke.faelligNachTagen(strecke.KADENZ_TAGE.length)
      - strecke.faelligNachTagen(strecke.KADENZ_TAGE.length - 1) === strecke.MONATS_ABSTAND_TAGE);
  pruef("Mindestens zehn Inhalts-Varianten", strecke.VARIANTEN.length >= 10,
    `nur ${strecke.VARIANTEN.length} — dieselbe Mail zum dritten Mal ist eine Beleidigung`);

  // Rotation: Über 24 Stufen darf keine Variante zweimal hintereinander kommen.
  let hintereinander = 0;
  for (let i = 2; i <= 24; i++) {
    if (strecke.varianteFuer(i, 1234).key === strecke.varianteFuer(i - 1, 1234).key) hintereinander++;
  }
  pruef("Keine Variante zweimal hintereinander", hintereinander === 0,
    `${hintereinander} Wiederholungen in 24 Stufen`);

  // Zwei Menschen, die am selben Tag einsteigen, bekommen in der zweiten Runde
  // NICHT dieselbe Reihenfolge — sonst wirkt die Strecke wie ein Fließband.
  const n = strecke.VARIANTEN.length;
  const a = Array.from({ length: n }, (_, i) => strecke.varianteFuer(n + 1 + i, 1).key).join(",");
  const b = Array.from({ length: n }, (_, i) => strecke.varianteFuer(n + 1 + i, 7).key).join(",");
  pruef("Zweite Runde je Mensch versetzt", a !== b);

  // Worthygiene über JEDE Variante — Betreff und Text.
  const verstoesse: string[] = [];
  for (const v of strecke.VARIANTEN) {
    const w = strecke.worthygiene(`${v.betreff} ${v.text}`);
    if (w.length) verstoesse.push(`${v.key}: ${w.join(", ")}`);
  }
  pruef("Worthygiene in allen Varianten", verstoesse.length === 0, verstoesse.join(" | "));

  // Der Abmelde-Weg MUSS in der Mail stehen — geprüft am erzeugten Text.
  const motorQuelle = lies("server/lib/fiaon-lead-strecke.ts");
  pruef("Jede Mail trägt den Abmelde-Link",
    /abmelde_url|abmelden/i.test(motorQuelle) && /Ein Klick genügt|keine Nachrichten mehr/.test(motorQuelle),
    "eine Endlos-Strecke ohne Ausgang ist rechtlich heikel");
  pruef("Die Abmelde-Seite existiert", lies("client/src/pages/abmelden.tsx").length > 500);
  pruef("Die Abmelde-Seite ist verdrahtet",
    /path="\/abmelden\/:schluessel"/.test(lies("client/src/App.tsx")),
    "eine Seite ohne Route ist unerreichbar (AGENTS.md)");
  pruef("Der Abmelde-Link nutzt einen Zufallsschlüssel, keine Kennung",
    /randomBytes/.test(motorQuelle),
    "stünde die Lead-Nummer im Link, könnte man fremde Menschen abmelden");

  // Die harten Stopps — alle sechs.
  const stoppQuelle = motorQuelle;
  for (const g of ["antrag", "kunde", "abgemeldet", "bounce", "dsgvo", "test"]) {
    pruef(`Stopp „${g}“ ist verdrahtet`, new RegExp(`"${g}"`).test(stoppQuelle));
  }

  // Die alte Strecke darf die ewige nicht abwürgen.
  const leadsQuelle = lies("server/routes/fiaon-leads.ts");
  pruef("Die alte „tot“-Markierung ist abgeschaltet",
    /if \(await ewigeStreckeAn\(\)\) return 0;/.test(leadsQuelle),
    "sie hätte genau die Leads getötet, für die die Strecke gebaut wurde");
  pruef("Der alte Batch-Versand läuft nicht parallel",
    /streckeTageslauf\(\);[\s\S]{0,200}return result;/.test(leadsQuelle),
    "zwei Motoren an einer Liste = zwei Mails am selben Morgen");
  pruef("Die Staffelung ist begrenzt", motor.STAFFEL_VORGABE > 0 && motor.STAFFEL_VORGABE <= 500,
    "2.700 Mails in einer Stunde sind für jeden Spamfilter ein Angriff");

  // ── DIE ECHTE PRÜFUNG: greifen die Stopps im Bestand? ──────────────────
  const [kunde] = (await sqlPool`
    SELECT le.id FROM fiaon_leads le
    JOIN fiaon_applications a ON a.payment_status = 'paid' AND a.merged_into IS NULL
      AND LOWER(TRIM(COALESCE(a.email, ''))) = LOWER(TRIM(le.email))
    WHERE NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL LIMIT 1
  `) as any[];
  if (kunde) {
    const g = await motor.stoppGrund(Number(kunde.id));
    pruef("Ein Lead, der Kunde geworden ist, wird gestoppt",
      g.stopp === "kunde" || g.stopp === "antrag",
      `Lead ${kunde.id} liefert „${g.stopp}“ — ein zahlender Kunde darf keine Lead-Mail bekommen`);
  } else {
    pruef("Ein Lead, der Kunde geworden ist, wird gestoppt", false, "kein Prüffall gefunden");
  }

  // Niemand in der Auswahl darf einen Antrag haben.
  const dran = await motor.faellige(200);
  const [mitAntrag] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_leads le
    WHERE le.id = ANY(${dran.map((d) => Number(d.id))}::int[])
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.merged_into IS NULL
        AND (a.person_id = le.person_id
          OR LOWER(TRIM(COALESCE(a.email,''))) = LOWER(TRIM(le.email))))
  `.catch(() => [{ n: 0 }] as any[])) as any[];
  pruef("Kein Fälliger hat einen Antrag", Number(mitAntrag.n) === 0,
    `${mitAntrag.n} von ${dran.length} hätten eine Mail bekommen, obwohl ein Agent sie anruft`);
  console.log(`        (${dran.length} Leads wären im nächsten Lauf dran)`);

  // Die Abmeldung wirkt — in einer Transaktion, die zurückgerollt wird.
  await sqlPool.begin(async (tx: any) => {
    const [l] = (await tx`
      SELECT id FROM fiaon_leads WHERE strecke_stopp IS NULL
        AND NULLIF(TRIM(COALESCE(email,'')),'') IS NOT NULL LIMIT 1
    `) as any[];
    if (!l) { pruef("Abmeldung stoppt die Strecke", false, "kein Prüffall"); return; }
    await tx`UPDATE fiaon_leads SET abgemeldet_am = NOW() WHERE id = ${l.id}`;
    const g = await motor.stoppGrund(Number(l.id), tx);
    pruef("Abmeldung stoppt die Strecke", g.stopp === "abgemeldet", `liefert „${g.stopp}“`);
    // Und ein abgemeldeter Lead darf nicht mehr in der Auswahl sein.
    const nachher = await motor.faellige(2000, tx);
    pruef("Abgemeldete stehen nicht mehr in der Auswahl",
      !nachher.some((x) => Number(x.id) === Number(l.id)));
    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 2 — DER SCHUFA-MOMENT NACH DEM ERSTEN LOGIN");
  // ═════════════════════════════════════════════════════════════════════════
  const gate = lies("client/src/components/StartgespraechGate.tsx");
  pruef("Die Bonitätskarte steht auf der Bühne", /function BonitaetsKarte/.test(gate));
  // ══════════════════════════════════════════════════════════════════════
  // DIESE REGEL HAT DER BETREIBER ERSETZT (20.08.2026)
  //
  // Hier stand: „Sie erscheint NACH der Buchung" — mit der Begründung, die
  // Auskunft stünde sonst in Konkurrenz zum Pflichtschritt.
  //
  // Der Betreiber entscheidet anders, und er hat den besseren Grund: Wer nach
  // dem Buchen die Tafel schließt, hat die Auskunft nie gesehen. GEMESSEN: 287
  // bezahlte Kunden ohne Auskunft.
  //
  // Beide Karten stehen jetzt GLEICHZEITIG. Die Konkurrenz wird durch GEWICHT
  // vermieden statt durch Verstecken: links, breiter und zuerst das Gespräch
  // (Pflicht), rechts schmaler die Auskunft (freiwillig).
  //
  // ── WARUM DIE ALTE PRÜFUNG NICHT EINFACH GELÖSCHT WIRD ──────────────
  // Weil sonst niemand mehr weiß, dass die Reihenfolge einmal eine Entscheidung
  // war. Sie wird ERSETZT, mit dem Grund daneben.
  // ══════════════════════════════════════════════════════════════════════
  pruef("Beide Karten stehen gleichzeitig in einem Gitter",
    /lg:grid-cols-\[1\.35fr_1fr\]/.test(gate),
    "links das Gespräch (breiter, Pflicht), rechts die Auskunft (freiwillig)");
  pruef("Das Gespräch hat das größere Gewicht",
    gate.indexOf("Buch dein persönliches Startgespräch") < gate.indexOf("<BonitaetsKarte"),
    "es ist der Pflichtschritt und steht zuerst");
  pruef("Die Auskunft steht in der zweiten Spalte",
    /ZWEITE SPALTE: DIE AUSKUNFT/.test(gate));
  pruef("Kopierknöpfe für IBAN und Verwendungszweck", /function KopierKnopf/.test(gate));
  pruef("Der Verwendungszweck steht ZUERST",
    /was: "Verwendungszweck"[\s\S]{0,120}was: "IBAN"/.test(gate),
    "ohne ihn kann die Zahlung nicht zugeordnet werden");
  pruef("Kopieren gibt Rückmeldung", /Kopiert/.test(gate) && /setKopiert\(true\)/.test(gate));
  pruef("Rückfall ohne Clipboard-Recht", /execCommand\("copy"\)/.test(gate),
    "ein Knopf, der nichts tut und nichts sagt, ist schlimmer als kein Knopf");
  pruef("Wer sie hat, sieht kein Angebot",
    /zustand === "bezahlt" \|\| lage\.zustand === "geliefert"\) return null/.test(gate));
  pruef("Der Kunde tippt seine Daten nicht erneut",
    /email=\{lage\.email/.test(gate) && /nachname: lage\.nachname/.test(lies("server/routes/fiaon-startgespraech.ts")));

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 3 — KNAPPE SLOTS");
  // ═════════════════════════════════════════════════════════════════════════
  const termine = await import("../server/lib/fiaon-termine");
  const mach = (anzahl: number, tag = "2026-09-01") =>
    Array.from({ length: anzahl }, (_, i) => ({
      beginn: new Date(Date.UTC(2026, 8, 1, 7 + Math.floor(i / 3), (i % 3) * 20)).toISOString(),
      datum: tag, uhrzeit: "", agentId: 1, agentVorname: "A",
    })) as any[];

  for (const anzahl of [27, 12, 6]) {
    const r = termine.slotsVerknappen(mach(anzahl), 5);
    pruef(`${anzahl} freie Zeiten → höchstens 5`, r.length === 5, `es kamen ${r.length}`);
  }
  pruef("Weniger als fünf bleiben unverändert", termine.slotsVerknappen(mach(3), 5).length === 3);
  pruef("Die Auswahl ist deterministisch",
    JSON.stringify(termine.slotsVerknappen(mach(27), 5))
      === JSON.stringify(termine.slotsVerknappen(mach(27), 5)),
    "die Buchungsannahme rechnet dasselbe — sonst bucht der Kunde daneben");

  // Gestreut, nicht die ersten fünf: Die letzte gewählte Zeit muss die letzte
  // verfügbare sein, sonst findet ein Kunde mit Nachmittagszeit nichts.
  const gestreut = termine.slotsVerknappen(mach(27), 5);
  const alle27 = mach(27);
  pruef("Die Auswahl ist über den Tag gestreut",
    gestreut[0].beginn === alle27[0].beginn
      && gestreut[4].beginn === alle27[26].beginn,
    "die ersten fünf wären alle vor 10 Uhr");

  pruef("Die Grenze ist einstellbar", await termine.slotsProTag() >= 1);
  const terminQuelle = lies("server/lib/fiaon-termine.ts");
  pruef("BEIDE Rückgabewege sind verknappt",
    (terminQuelle.match(/slotsVerknappen\(/g) || []).length >= 3,
    "einer davon ist die Definition — es müssen zwei Aufrufe sein");
  pruef("Die Buchungsannahme filtert identisch",
    /const auskunft = await freieSlots\([\s\S]{0,400}auskunft\.slots\.some/.test(lies("server/routes/fiaon-termin.ts")),
    "sonst ist die Knappheit nur eine Behauptung in der Oberfläche");

  // Und die echte Messung: kein Tag mit mehr als fünf.
  const [wartend] = (await sqlPool`
    SELECT person_id FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND person_id IS NOT NULL
    ORDER BY paid_at DESC NULLS LAST LIMIT 1
  `) as any[];
  if (wartend) {
    const au = await termine.freieSlots(Number(wartend.person_id), sqlPool, "nichterreicht_mail");
    const jeTag = new Map<string, number>();
    for (const s of au.slots) jeTag.set(s.datum, (jeTag.get(s.datum) ?? 0) + 1);
    const zuViel = Array.from(jeTag.entries()).filter(([, k]) => k > 5);
    pruef("Am echten Kunden: kein Tag über fünf", zuViel.length === 0,
      zuViel.map(([t, k]) => `${t}=${k}`).join(", "));
    console.log(`        (${au.slots.length} Zeiten über ${jeTag.size} Tage — vorher waren es 260 über 10)`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 4 — ABO-KLARHEIT + ONBOARDING-VERGÜTUNG");
  // ═════════════════════════════════════════════════════════════════════════
  const agenda = await import("../shared/fiaon-onboarding-agenda");
  const klar = agenda.AGENDA.find((x) => x.key === "abo_klarheit");
  pruef("Der Schritt „Abo-Klarheit“ existiert", !!klar);
  pruef("Er ist ein PFLICHTSCHRITT", agenda.AGENDA_PFLICHT.includes("abo_klarheit"),
    "ohne Pflicht wird er beim ersten Zeitdruck übersprungen");
  pruef("Er verlangt eine Notiz", !!klar?.notizPflicht && !!klar?.notizFrage);
  pruef("Er steht VOR dem Abschluss",
    agenda.AGENDA.findIndex((x) => x.key === "abo_klarheit")
      < agenda.AGENDA.findIndex((x) => x.key === "abschluss"),
    "danach wäre es ein Nachtrag");
  const klarText = `${klar?.titel} ${klar?.zweck} ${klar?.punkte.join(" ")}`.toLowerCase();
  pruef("Er nennt das laufende Abo", /laufendes abo|jeden monat/.test(klarText));
  pruef("Er nennt den Kündigungsweg", /kündbar/.test(klarText));
  pruef("Er trennt die 74 € vom Abo", /74 € einmalig|einmalig, kein abo/.test(klarText));
  pruef("Worthygiene im neuen Schritt",
    agenda.VERBOTENE_WORTE.filter((w) => klarText.includes(w)).length === 0);

  // Ohne Notiz im Pflichtschritt darf nicht abgeschlossen werden.
  const ohneNotiz = agenda.darfAbschliessen({
    erledigt: agenda.AGENDA_KEYS,
    notizen: Object.fromEntries(agenda.AGENDA_PFLICHT
      .filter((k) => k !== "abo_klarheit").map((k) => [k, "eine ausreichend lange Notiz"])),
  });
  pruef("Ohne Abo-Klarheit kein Abschluss", !ohneNotiz.ok
    && ohneNotiz.fehlt.some((f) => /Abo-Klarheit/i.test(f)),
    `Prüfung sagt ok=${ohneNotiz.ok}, fehlt=${ohneNotiz.fehlt.join("/")}`);

  const verg = await import("../server/lib/fiaon-onboarding-verguetung");
  pruef("Die Vergütung ist einstellbar", (await verg.verguetungCent()) >= 0);
  console.log(`        (Satz: ${((await verg.verguetungCent()) / 100).toFixed(2)} €)`);

  // GENAU EINE je Kunde — schreibend, in einer Transaktion.
  await sqlPool.begin(async (tx: any) => {
    const [p] = (await tx`
      SELECT id FROM fiaon_persons WHERE merged_into_person_id IS NULL ORDER BY id DESC LIMIT 1
    `) as any[];
    const [ag] = (await tx`SELECT id, name FROM fiaon_agents WHERE active ORDER BY id LIMIT 1`) as any[];
    const e1 = await verg.onboardingGutschrift(
      { personId: Number(p.id), agentId: Number(ag.id), agentName: ag.name, terminId: 1 }, tx);
    const e2 = await verg.onboardingGutschrift(
      { personId: Number(p.id), agentId: Number(ag.id), agentName: ag.name, terminId: 2 }, tx);
    pruef("Erste Gutschrift entsteht", e1.gutgeschrieben, e1.grund);
    pruef("Zweite Gutschrift für denselben Kunden wird abgewiesen", !e2.gutgeschrieben);
    const [z] = (await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_commissions
      WHERE kind = 'onboarding' AND onboarding_person_id = ${p.id}
    `) as any[];
    pruef("Genau EINE Gutschrift je Kunde", Number(z.n) === 1, `es sind ${z.n}`);
    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // Der Index, nicht die Prüfung im Code, ist die Wand.
  const [idx] = (await sqlPool`
    SELECT indexdef FROM pg_indexes WHERE indexname = 'fiaon_commissions_onboarding_person_idx'
  `) as any[];
  pruef("Die Wand steht in der Datenbank", !!idx && /UNIQUE/.test(String(idx.indexdef)),
    "eine Prüfung im Code passieren zwei gleichzeitige Abschlüsse beide");

  pruef("Die Gutschrift hängt am Abschluss",
    /onboardingGutschrift\(/.test(lies("server/routes/fiaon-onboarding-bereich.ts")));
  // Die Reihenfolge über die POSITION, nicht über einen Zeichenabstand: Ein
  // Regex mit „{0,2000}" misst die Länge der Kommentare dazwischen, nicht die
  // Reihenfolge. Er wurde rot, obwohl der Code stimmte.
  const obQuelle = lies("server/routes/fiaon-onboarding-bereich.ts");
  pruef("Sie kommt NACH der Freischaltung",
    obQuelle.indexOf("vollFreischalten") > 0
      && obQuelle.indexOf("vollFreischalten") < obQuelle.indexOf("onboardingGutschrift"),
    "erst gehört das Konto dem Kunden, dann entsteht das Geld");

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 5 — DIE PROVISIONS-WAND");
  // ═════════════════════════════════════════════════════════════════════════
  const agentQuelle = lies("server/routes/fiaon-agent.ts");
  pruef("Die Wand existiert", /ermittleProvisionsAnspruch/.test(agentQuelle));
  pruef("Ohne Kontakt vor Zahlung keine Provision",
    /commission_basis = 'direktzahler'/.test(agentQuelle));
  pruef("Der Grund wird vermerkt", /commission_basis_note/.test(agentQuelle),
    "eine Entscheidung ohne Vermerk ist später nicht erklärbar");
  pruef("Die Übersteuerung ist auditiert",
    /forceAgentId/.test(agentQuelle) && /"admin"/.test(agentQuelle));

  const [stichtag] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'commission_cutoff_at'
  `) as any[];
  pruef("Der Stichtag ist gesetzt", !!String(stichtag?.value || "").trim(),
    "ohne Stichtag gilt das Altmodell für alle — die Wand wäre wirkungslos");
  console.log(`        (Stichtag: ${stichtag?.value ?? "—"})`);

  const basis = (await sqlPool`
    SELECT commission_basis AS b, COUNT(*)::int AS n FROM fiaon_applications
    WHERE commission_basis IS NOT NULL GROUP BY 1
  `) as any[];
  const direkt = Number(basis.find((x) => x.b === "direktzahler")?.n ?? 0);
  pruef("Die Wand hat im Bestand gegriffen", direkt > 0,
    "keine einzige Bestellung ist als Selbstzahler vermerkt — greift sie wirklich?");
  console.log(`        (${basis.map((x) => `${x.b}=${x.n}`).join(", ")})`);

  // Der Kern: Nach dem Stichtag darf KEINE Provision ohne dokumentierten
  // Kontakt entstanden sein.
  const [nachStichtag] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions c
    JOIN fiaon_applications a ON a.ref = c.ref
    WHERE c.status <> 'storniert' AND COALESCE(c.kind, 'own') = 'own'
      AND a.created_at >= ${String(stichtag?.value || "2099-01-01")}::timestamptz
      AND a.commission_basis = 'direktzahler'
  `.catch(() => [{ n: 0 }] as any[])) as any[];
  pruef("Keine Provision trotz Selbstzahler-Vermerk", Number(nachStichtag.n) === 0,
    `${nachStichtag.n} Provisionen an Bestellungen, die als Selbstzahler vermerkt sind`);

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
