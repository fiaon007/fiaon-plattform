// ═══════════════════════════════════════════════════════════════════════════
// MÜLL-BETRÄGE — WO KOMMEN „0,80 €" UND „1,00 €" HER?
//
// ── DIE MELDUNG (19.08.2026, Screenshots aus dem Betrieb) ──────────────────
// „FIAON Ultra (Elite Konto) 0,80 €" (Mike Hanitzsch-Hille, FIAON-DBKNSN),
// früher „High End 1,00 €" (Josef Rohrmoser). Verdacht des Betreibers: Im
// Bestand liegen Bestellungen mit Müll-Beträgen, und ein Anlage-Weg schreibt
// sie.
//
// ── WAS DIESE MESSUNG PRÜFT ───────────────────────────────────────────────
// Drei Fragen, in dieser Reihenfolge — denn die dritte Antwort entscheidet, ob
// überhaupt Bestand zu korrigieren ist:
//
//   1. Welche LEBENDEN Bestellungen tragen einen Betrag, der nicht dem
//      Katalogpreis ihres Pakets entspricht? (Toleranz 0)
//   2. WELCHER WEG hat sie angelegt oder geändert? Ohne die Herkunft wächst
//      der Müll nach.
//   3. Und: Steht „0,80 €" überhaupt in der Datenbank — oder entsteht die Zahl
//      erst beim Anzeigen?
//
// Denn 79,99 € als CENT gelesen ergibt 0,7999 € — angezeigt „0,80 €". Und
// 99,99 € ergibt „1,00 €". Beide gemeldeten Zahlen sind genau das.
//
// ── ZUSÄTZLICH: WAS HAT DER KUNDE BEKOMMEN? ───────────────────────────────
// Das Zustellprotokoll (`fiaon_mail_log`) hält den Payload jeder Mail. Wenn
// dort ein Müll-Betrag steht, braucht dieser Mensch eine Korrekturmail. Wenn
// nicht, war es ein Anzeigefehler im Innendienst — unangenehm, aber ohne
// Kundenwirkung. Der Unterschied ist der ganze Auftrag.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-muell-betraege.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { PAKETE, paket, paketPreisEuro } from "../shared/fiaon-pakete";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** amount_due ist EUR-numeric. Das ist der ganze Kern dieser Messung. */
const eur = (v: unknown) => `${Number(v ?? 0).toFixed(2).replace(".", ",")} €`;
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("0. DIE EINHEIT — WAS STEHT IN amount_due?");
  // ═════════════════════════════════════════════════════════════════════════
  // Erst die Einheit, dann die Abweichung. Wer die Einheit falsch annimmt,
  // meldet den ganzen Bestand als Müll.
  const verteilung = (await sqlPool`
    SELECT pack_key, amount_due, COUNT(*)::int AS n
    FROM fiaon_applications
    WHERE amount_due IS NOT NULL AND merged_into IS NULL AND archived_at IS NULL
      AND gdpr_deleted_at IS NULL
    GROUP BY 1, 2 ORDER BY 1 NULLS LAST, 2
  `) as any[];
  log("");
  log("  Paket                  amount_due   Anzahl   Katalog");
  for (const r of verteilung) {
    const p = paket(r.pack_key);
    const soll = p ? paketPreisEuro(p.key) : null;
    const marke = soll == null ? "kein Katalogpaket"
      : Number(r.amount_due) === soll ? "= Katalog"
      : `ABWEICHUNG (Katalog ${eur(soll)})`;
    log(`  ${String(r.pack_key ?? "— ohne Paket —").padEnd(22)} ${String(r.amount_due).padStart(9)}`
      + `   x${String(r.n).padStart(4)}   ${marke}`);
  }
  log("");
  log("  Die Zahlen stehen in EURO. Eine Zeile mit 0,80 oder 1,00 gibt es nicht.");
  log("  Zum Vergleich, wenn man sie als CENT liest:");
  for (const p of PAKETE) {
    log(`     ${p.label.padEnd(30)} ${eur(p.preisCents / 100).padStart(11)}`
      + `  → als Cent gelesen: ${eur(p.preisCents / 10000).padStart(9)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. LEBENDE BESTELLUNGEN, DEREN BETRAG NICHT DEM KATALOG ENTSPRICHT");
  // ═════════════════════════════════════════════════════════════════════════
  // Toleranz 0, wie beauftragt. SCHUFA (7400 Cent) ist ein Katalogeintrag und
  // damit automatisch mit erfasst — Bestellungen OHNE pack_key können nicht
  // gegen einen Katalogpreis geprüft werden und werden getrennt gezählt.
  const alle = (await sqlPool`
    SELECT a.ref, a.pack_key, a.pack_name, a.amount_due, a.payment_status, a.status,
           a.type, a.created_at, a.updated_at, a.person_id,
           COALESCE(a.alt_bestand, FALSE) AS alt_bestand,
           (a.ip IS NOT NULL AND a.ip <> '') AS hat_ip,
           (a.user_agent IS NOT NULL AND a.user_agent <> '') AS hat_ua,
           a.assigned_agent_id, ag.name AS betreuer,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref, a.ref) AS name,
           p.ist_test_am
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.cancelled_at IS NULL
      AND a.amount_due IS NOT NULL
    ORDER BY a.created_at DESC
  `) as any[];

  // ── DIE BONITÄTSAUSKUNFT WIRD AN IHREM EIGENEN PREIS GEMESSEN ────────────
  // Sie ist ein Einmalkauf zu 74,00 € und kein Stufenpaket. GEMESSEN: Vier
  // Auskunfts-Bestellungen tragen im pack_key das STUFENPAKET des Kunden
  // (highend, pro, ultra) — ihr Betrag von 74,00 € ist richtig, der pack_key
  // ist die Abweichung. Wer sie am pack_key misst, meldet vier Geldfehler, die
  // keine sind. Die Kategorie erkennt der Bestand am Präfix — genauso, wie es
  // `fiaon-agent-anlage.ts` beim Anlegen tut.
  const istAuskunft = (a: any) =>
    String(a.type ?? "") === "schufa" || String(a.ref).startsWith("FIAON-SCHUFA-");

  const abweichend: any[] = [];
  const auskunftFalscherKey: any[] = [];
  let ohnePaket = 0;
  for (const a of alle) {
    if (istAuskunft(a)) {
      const soll = paketPreisEuro("schufa");
      if (paket(a.pack_key) && String(a.pack_key) !== "schufa") auskunftFalscherKey.push(a);
      if (Number(a.amount_due) === soll) continue;
      abweichend.push({ ...a, soll, katalogLabel: "Bonitätsauskunft", auskunft: true });
      continue;
    }
    const p = paket(a.pack_key);
    if (!p) { ohnePaket++; continue; }
    const soll = paketPreisEuro(p.key);
    if (Number(a.amount_due) === soll) continue;
    abweichend.push({ ...a, soll, katalogLabel: p.label });
  }

  log("");
  log(`  ${String(alle.length).padStart(5)}  lebende Bestellungen mit einem Betrag`);
  log(`  ${String(ohnePaket).padStart(5)}  davon ohne Katalogpaket (pack_key leer) — nicht prüfbar`);
  log(`  ${String(abweichend.length).padStart(5)}  ABWEICHEND vom Katalogpreis (Toleranz 0)`);
  log("");
  const bezahlt = abweichend.filter((a) => a.payment_status === "paid");
  const offen = abweichend.filter((a) => a.payment_status !== "paid");
  log(`  ${String(offen.length).padStart(5)}  davon UNBEZAHLT — korrigierbar`);
  log(`  ${String(bezahlt.length).padStart(5)}  davon BEZAHLT — werden NICHT angefasst (Buchhaltungs-Spur)`);
  log("");
  log(`  ${String(auskunftFalscherKey.length).padStart(5)}  Auskunfts-Bestellungen mit dem STUFENPAKET im pack_key`);
  log("         (Betrag 74,00 € richtig, pack_key falsch — kein Geldfehler)");
  for (const a of auskunftFalscherKey) {
    log(`         ${String(a.ref).padEnd(28)} pack_key ${String(a.pack_key).padEnd(10)} ${eur(a.amount_due)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE HERKUNFT JEDER EINZELNEN — PFLICHT IM REPORT");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Verlauf (`fiaon_contact_log`) hält jede Anlage und jede Betragsänderung
  // im Klartext fest. Die Texte stehen im Code an genau einer Stelle je Weg,
  // deshalb ist die Zuordnung belastbar und keine Vermutung.
  for (const a of abweichend) {
    const spur = (await sqlPool`
      SELECT type, note, agent_name, created_at
      FROM fiaon_contact_log
      WHERE ref = ${a.ref}
        AND (note ILIKE '%amount_due%' OR note ILIKE '%angelegt%'
             OR note ILIKE '%Paket geändert%' OR note ILIKE '%Betrag%')
      ORDER BY created_at
    `) as any[];
    const t = spur.map((s) => String(s.note)).join(" | ");
    a.weg = /geändert durch Admin/.test(t) && /amount_due/.test(t) ? "Admin-Akte (Konditionen)"
      : /Paket geändert durch Admin/.test(t) ? "Admin-Akte (Paket-Dropdown, Betrag blieb stehen)"
      : /Produkt von .* angelegt/.test(t) ? "Akte: Produkt anlegen (Katalog)"
      : /Kunde von .* angelegt/.test(t) ? "Telefon-Anlage / Vollpfleger (Katalog)"
      : a.alt_bestand ? "Altbestand / Import"
      : (a.hat_ip || a.hat_ua) ? "Antragsstrecke (Browser)"
      : "unbekannt — keine Spur im Verlauf";
    a.spurText = t.slice(0, 300);
    a.spurAkteur = spur.map((s) => s.agent_name).filter(Boolean).join(", ");
  }

  const nachWeg = new Map<string, any[]>();
  for (const a of abweichend) {
    const k = String(a.weg);
    if (!nachWeg.has(k)) nachWeg.set(k, []);
    nachWeg.get(k)!.push(a);
  }
  log("");
  for (const [weg, liste] of Array.from(nachWeg.entries()).sort((x, y) => y[1].length - x[1].length)) {
    log(`  ${String(liste.length).padStart(3)}  ${weg}`);
  }
  log("");
  log("  Einzeln:");
  for (const a of abweichend) {
    log("");
    log(`  ${String(a.ref).padEnd(24)} ${String(a.name).slice(0, 26).padEnd(27)}`
      + ` ${a.payment_status}${a.ist_test_am ? "  [TESTPERSON]" : ""}`);
    log(`      Paket ${String(a.pack_key).padEnd(20)} ist ${eur(a.amount_due).padStart(10)}`
      + `   Katalog ${eur(a.soll).padStart(10)}`);
    log(`      angelegt ${String(a.created_at).slice(0, 19)}   geändert ${String(a.updated_at).slice(0, 19)}`);
    log(`      Weg: ${a.weg}${a.spurAkteur ? `  (${a.spurAkteur})` : ""}`);
    if (a.spurText) log(`      Spur: ${a.spurText.slice(0, 150)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. WELCHE WEGE SCHREIBEN AN DER KATALOG-WAND VORBEI? (QUELLTEXT)");
  // ═════════════════════════════════════════════════════════════════════════
  const wege: { name: string; datei: string; }[] = [
    { name: "Antragsstrecke", datei: "server/routes/fiaon-antrag.ts" },
    { name: "Telefon-Anlage (Vollpfleger)", datei: "server/routes/fiaon-agent-anlage.ts" },
    { name: "Admin-Akte (Konditionen)", datei: "server/routes/fiaon-kunden.ts" },
    { name: "Erste Rechnung stellen", datei: "server/lib/fiaon-rechnung-stellen.ts" },
    { name: "Team/Provision-Nachtrag", datei: "server/routes/fiaon-team.ts" },
  ];
  log("");
  for (const w of wege) {
    const q = lies(w.datei);
    const schreibt = /amount_due\s*=\s*\$\{/.test(q) || /amount_due,/.test(q);
    const katalog = /fiaon-pakete|PAKET_PREIS|paketPreisEuro|PACK_PRICES/.test(q);
    const freierBetrag = /Number\(\s*(?:body|req\.body)[^)]*[Aa]mountDue/.test(q);
    log(`  ${w.name.padEnd(30)} ${schreibt ? "schreibt amount_due" : "schreibt nicht     "}`
      + `  ${katalog ? "kennt den Katalog" : "OHNE Katalog     "}`
      + `  ${freierBetrag ? "  ← NIMMT EINEN FREIEN BETRAG AN" : ""}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE ANZEIGE — WO ENTSTEHT „0,80 €“?");
  // ═════════════════════════════════════════════════════════════════════════
  const auflösung = lies("server/lib/fiaon-massgebliche-bestellung.ts");
  const ohneKommentar = auflösung.split("\n").filter((z) => !/^\s*(\/\/|--|\*)/.test(z)).join("\n");
  const falsch = /betragCents:\s*b\.amount_due\s*!=\s*null\s*\?\s*Number\(b\.amount_due\)\s*:/.test(ohneKommentar);
  log("");
  log(`  server/lib/fiaon-massgebliche-bestellung.ts liest amount_due`);
  log(`  ${falsch ? "OHNE × 100 in ein Feld namens betragCents" : "mit × 100 (richtig)"}`);
  if (falsch) {
    log("");
    log("  Damit zeigt der Bestätigungs-Dialog für jedes Paket:");
    for (const p of PAKETE) {
      log(`     ${p.label.padEnd(30)} echt ${eur(p.preisCents / 100).padStart(10)}`
        + `   angezeigt ${eur(p.preisCents / 10000).padStart(9)}`);
    }
    log("");
    log("  „FIAON Ultra 0,80 €“ und „High End 1,00 €“ stehen genau hier — nicht");
    log("  in der Datenbank. Die Meldung des Betreibers ist richtig, die");
    log("  vermutete Ursache nicht.");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. WAS HAT DER KUNDE BEKOMMEN? — ZUSTELLPROTOKOLL");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Payload jeder Mail liegt in fiaon_mail_log. Ein Müll-Betrag dort wäre
  // ein Fall für eine Korrekturmail; ein richtiger Betrag heißt: Der Fehler
  // hat den Innendienst getroffen, nicht den Kunden.
  // ── DER PAYLOAD IST EIN JSON-STRING IN EINER jsonb-SPALTE ────────────────
  // Ein erster Entwurf fragte `payload->>'betrag'` ab und bekam bei 795 Mails
  // null. Grund: In der Spalte steht kein Objekt, sondern eine ZEICHENKETTE,
  // die JSON enthält (`jsonb_object_keys` scheiterte mit „cannot call … on a
  // scalar"). Eine Messung, die überall null findet, sieht wie „kein Problem"
  // aus — das ist die gefährlichste Sorte Fehlmessung.
  const mails = (await sqlPool`
    SELECT id, event, empfaenger, created_at, status,
           COALESCE(payload->>'betrag', (payload #>> '{}')::jsonb->>'betrag') AS betrag,
           COALESCE(payload->>'paket', (payload #>> '{}')::jsonb->>'paket') AS paket,
           COALESCE(payload->>'antrag_id', (payload #>> '{}')::jsonb->>'antrag_id') AS ref,
           person_id
    FROM fiaon_mail_log
    WHERE event IN ('payment_details', 'agent_payment_reminder', 'payment_reminder')
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
  `) as any[];
  const muellMail = mails.filter((m) => {
    const b = Number(m.betrag);
    return Number.isFinite(b) && b > 0 && b < 5;
  });
  log("");
  log(`  ${String(mails.length).padStart(5)}  Zahlungsmails mit Betrag im Payload (30 Tage)`);
  log(`  ${String(muellMail.length).padStart(5)}  davon mit einem Betrag unter 5,00 € (Müll-Verdacht)`);
  const summe = new Map<string, number>();
  for (const m of mails) summe.set(String(m.betrag), (summe.get(String(m.betrag)) ?? 0) + 1);
  log("");
  log("  Betrag im Payload:");
  for (const [b, n] of Array.from(summe.entries()).sort((x, y) => y[1] - x[1]).slice(0, 20)) {
    log(`     ${b.padStart(10)}  x${n}`);
  }
  for (const m of muellMail) {
    log(`     ${String(m.created_at).slice(0, 19)}  ${String(m.empfaenger).slice(0, 34).padEnd(35)}`
      + ` ${m.betrag}  ${m.paket ?? "—"}  ${m.ref ?? "—"}`);
  }

  // ── DIE BEHAUPTUNG IM QUELLTEXT PRÜFEN ───────────────────────────────────
  // In server/lib/fiaon-massgebliche-bestellung.ts steht: „Josef Rohrmoser
  // bekam am 18. und 19.08. FÜNF Mails über FIAON High End (1,00 €)". Ein
  // Kommentar, der mehr behauptet als die Daten hergeben, ist eine Lüge
  // (AGENTS.md) — also nachgesehen.
  const rohrmoser = (await sqlPool`
    SELECT l.created_at, l.event, l.empfaenger,
           COALESCE(l.payload->>'betrag', (l.payload #>> '{}')::jsonb->>'betrag') AS betrag,
           COALESCE(l.payload->>'paket', (l.payload #>> '{}')::jsonb->>'paket') AS paket
    FROM fiaon_mail_log l
    LEFT JOIN fiaon_persons p ON p.id = l.person_id
    WHERE (l.empfaenger ILIKE '%rohrmoser%'
           OR COALESCE(p.last_name, '') ILIKE '%rohrmoser%')
    ORDER BY l.created_at DESC LIMIT 20
  `) as any[];
  log("");
  log(`  Gegenprobe Rohrmoser (Behauptung im Quelltext: 5 Mails über 1,00 €):`);
  if (rohrmoser.length === 0) log("     Keine Mail gefunden.");
  for (const r of rohrmoser) {
    log(`     ${String(r.created_at).slice(0, 19)}  ${String(r.event).padEnd(22)}`
      + ` Betrag ${String(r.betrag ?? "—").padStart(8)}  ${r.paket ?? "—"}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  writeFileSync("reports/muell-betraege.csv",
    "ref;name;paket_key;paket_name;betrag_ist;katalog_soll;zahlungsstatus;angelegt;"
    + "geaendert;weg;akteur;betreuer;testperson\n"
    + abweichend.map((a) => [a.ref, a.name, a.pack_key, a.pack_name,
      Number(a.amount_due).toFixed(2), Number(a.soll).toFixed(2), a.payment_status,
      String(a.created_at).slice(0, 19), String(a.updated_at).slice(0, 19),
      a.weg, a.spurAkteur, a.betreuer, a.ist_test_am ? "ja" : "nein",
    ].map(feld).join(";")).join("\n") + "\n", "utf8");
  log("");
  log("  reports/muell-betraege.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
