// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE GEMESSENEN RESTE
//
//   (a) Der Wartezustand nimmt Nummern-Anfragen aus der Tagesliste
//   (b) „Erreicht — Sonstiges" braucht eine Notiz — im SERVER, nicht nur in
//       der Oberfläche
//
//   npx tsx scripts/pruef-reste.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  BRAUCHT_NOTIZ, NOTIZ_MINDESTLAENGE, pruefeNotiz, ERGEBNISSE,
} from "../server/lib/fiaon-kontakt-ergebnis";
import { WARTE_TAGE, WARTE_TEXT } from "../server/lib/fiaon-warten";

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
  titel("(a) DER WARTEZUSTAND — Nummern-Anfragen raus aus der Tagesliste");
  // ═════════════════════════════════════════════════════════════════════════
  // GEMESSEN vor dem Lauf: 11 Personen mit einer Nummern-Anfrage, davon
  // standen 7 in der Tagesliste — bei einem Kunden, dessen Nummer nicht stimmt.
  const [stand] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS personen,
           COUNT(DISTINCT p.id) FILTER (WHERE p.wartet_auf IS NOT NULL)::int AS wartend,
           COUNT(DISTINCT p.id) FILTER (
             WHERE p.wartet_auf IS NULL
               AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
           )::int AS noch_in_tagesliste
    FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE c.note ILIKE '%number_update%' OR c.type ILIKE '%number_update%'
  `) as any[];
  console.log(`        ${stand.personen} Personen mit Nummern-Anfrage · ${stand.wartend} im Wartezustand`);
  pruef("Keine Nummern-Anfrage steht mehr in der Tagesliste",
    Number(stand.noch_in_tagesliste) === 0,
    `${stand.noch_in_tagesliste} übrig — dort kann der Agent nichts tun als überblättern`);
  pruef("Sie sind im Wartezustand, nicht verschwunden",
    Number(stand.wartend) >= 7, `${stand.wartend} wartend`);

  // ── DER WARTEZUSTAND MUSS VON SELBST ENDEN ─────────────────────────────
  // Ein Wartezustand, den jemand von Hand beenden muss, ist ein Wartezustand
  // für immer.
  const warten = lies("server/lib/fiaon-warten.ts");
  pruef(`Die Frist ist begrenzt (${WARTE_TAGE} Tage)`, WARTE_TAGE > 0 && WARTE_TAGE <= 14,
    `${WARTE_TAGE} Tage`);
  pruef("Es gibt einen Weg zurück ohne Menschenhand",
    /export async function nichtMehrWarten/.test(warten));
  pruef("Er wird bei Nummer UND Termin ausgelöst",
    /WarteGrund = "nummer" \| "termin"/.test(warten));
  pruef("Die Wiedervorlage wird nur nach HINTEN verschoben",
    /GREATEST\(COALESCE\(follow_up_date/.test(warten),
    "sonst holt ein Wartezustand einen bewusst weit weggelegten Fall nach vorn");
  pruef("Jeder Wartegrund hat einen Klartext",
    Object.values(WARTE_TEXT).every((t) => t.length > 8), JSON.stringify(WARTE_TEXT));

  // ── UND DER LAUF HAT KEINE MAIL GESCHICKT ──────────────────────────────
  const lauf = lies("scripts/warten-bestand.ts");
  pruef("Der Bestandslauf verschickt KEINE Mail",
    !/mailSenden|sendeMail|make-webhook/i.test(lauf),
    "die Anfrage ist längst raus — eine zweite wäre eine Belästigung");
  pruef("Er benutzt die bestehende Funktion statt eigenem UPDATE",
    /await wartenAufKunde\(/.test(lauf) && !/UPDATE fiaon_persons/.test(lauf),
    "ein eigenes UPDATE wäre eine zweite Fassung derselben Regel");
  const [spur] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_contact_log
    WHERE note ILIKE '%Wartezustand nachgetragen%'
  `) as any[];
  pruef("Jede Änderung hat eine Spur im Kundenverlauf", Number(spur.n) >= 7,
    `${spur.n} Einträge`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("(b) DIE NOTIZPFLICHT — im Server, nicht nur in der Oberfläche");
  // ═════════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ─────────────────────────────────────────────────────────
  // Die Pflicht stand in Softphone.tsx und kunden-neu.tsx — aber NICHT im
  // Listen-Weg (kunden.tsx) und in keinem Fall im Server. Der Listen-Weg kam
  // ohne Notiz durch, und jeder direkte Routen-Aufruf ebenfalls.
  pruef("„Erreicht — Sonstiges“ braucht eine Notiz",
    BRAUCHT_NOTIZ.has("erreicht_sonstiges"));
  pruef("Die Mindestlänge ist 10 Zeichen", NOTIZ_MINDESTLAENGE === 10);

  // Die Funktion selbst, an allen Grenzfällen.
  pruef("Ohne Notiz → Fehlermeldung",
    pruefeNotiz("erreicht_sonstiges", "") !== null);
  pruef("Nur Leerzeichen zählen nicht",
    pruefeNotiz("erreicht_sonstiges", "          ") !== null,
    "zehn Leerzeichen sind keine Auskunft");
  pruef("Zu kurz → Fehlermeldung",
    pruefeNotiz("erreicht_sonstiges", "kurz") !== null);
  pruef("Genau 10 Zeichen genügen",
    pruefeNotiz("erreicht_sonstiges", "1234567890") === null);
  pruef("Eine echte Notiz geht durch",
    pruefeNotiz("erreicht_sonstiges", "Will erst mit seiner Frau sprechen") === null);
  pruef("Die Meldung nennt die Mindestlänge",
    /mindestens 10 Zeichen/.test(pruefeNotiz("erreicht_sonstiges", "") ?? ""));
  pruef("Sie sagt, WARUM",
    /der nächste Anrufer fängt bei Null an/.test(pruefeNotiz("erreicht_sonstiges", "") ?? ""),
    "eine Sperre ohne Grund wird als Schikane erlebt");

  // ── UND SIE GILT NUR DORT, WO SIE NÖTIG IST ────────────────────────────
  // Jede weitere Pflicht erzeugt Ausweichverhalten: Dann klickt jemand „nicht
  // erreicht", weil das schneller geht — und die Statistik ist verdorben.
  const ohnePflicht = ERGEBNISSE.filter((e) => !BRAUCHT_NOTIZ.has(e));
  pruef("Alle anderen Ergebnisse brauchen KEINE Notiz",
    ohnePflicht.every((e) => pruefeNotiz(e, "") === null),
    `${ohnePflicht.length} Ergebnisse ohne Pflicht`);
  pruef("Es ist genau eine Pflicht, nicht mehr", BRAUCHT_NOTIZ.size === 1,
    `${BRAUCHT_NOTIZ.size} — jede weitere Hürde erzeugt Ausweichverhalten`);

  // ── DIE ROUTE PRÜFT SIE ────────────────────────────────────────────────
  const route = lies("server/routes/fiaon-agent.ts");
  pruef("Die Route ruft pruefeNotiz auf",
    /const notizFehler = pruefeNotiz\(String\(outcome\), note\);/.test(route));
  pruef("… und lehnt mit 400 ab",
    /if \(notizFehler\) return res\.status\(400\)/.test(route));
  // ── DIE REIHENFOLGE IM RICHTIGEN AUSSCHNITT PRÜFEN ────────────────────
  // Erster Entwurf verglich `indexOf("const notizFehler")` mit
  // `indexOf("const entry = await logAction")` — über die GANZE Datei. Das
  // zweite Muster kommt dreimal vor, und der erste Treffer stand 120 Zeilen
  // WEITER OBEN in einer anderen Route. Die Prüfung wurde rot, obwohl der Code
  // stimmte.
  //
  // Wer eine Reihenfolge prüft, schneidet erst den Block heraus, um den es geht.
  const iRoute = route.indexOf('router.post("/agent/customers/:ref/contact-result"');
  const block = route.slice(iRoute, iRoute + 3000);
  pruef("… VOR dem Speichern",
    iRoute > 0
      && block.indexOf("const notizFehler") > 0
      && block.indexOf("const notizFehler") < block.indexOf("const entry = await logAction"),
    "sonst steht das Ergebnis schon im Log, wenn die Prüfung greift");

  // ── DER LISTEN-WEG HAT DAS FELD JETZT ──────────────────────────────────
  const liste = lies("client/src/pages/agent/kunden.tsx");
  pruef("Der Listen-Weg kennt die Pflicht",
    /const outcomeNeedsNotiz = \(o: string\) => o === "erreicht_sonstiges"/.test(liste));
  pruef("Er zeigt ein Notizfeld", /Was war das Ergebnis\?/.test(liste));
  pruef("Er sperrt den Speicher-Knopf ohne Notiz",
    /outcomeNeedsNotiz\(pending\.key\) && String\(pending\.notiz \?\? ""\)\.trim\(\)\.length < NOTIZ_MIN/.test(liste));
  pruef("Er schickt die Notiz mit", /if \(notizText\) body\.note = notizText;/.test(liste));
  pruef("Er zeigt, wie viele Zeichen noch fehlen",
    /Noch \$\{NOTIZ_MIN - String\(pending\.notiz \?\? ""\)\.trim\(\)\.length\} Zeichen/.test(liste),
    "sonst rät der Mitarbeiter, wie viel „genug“ ist");
  pruef("Und er sagt, warum die Notiz nötig ist",
    /Ohne Notiz ist das Gespräch verloren/.test(liste));

  // Die anderen beiden Wege bleiben, wie sie waren.
  pruef("Softphone hat die Pflicht weiterhin",
    /notizPflicht: true/.test(lies("client/src/components/Softphone.tsx")));
  pruef("kunden-neu hat sie weiterhin",
    /braucht: "notiz"/.test(lies("client/src/pages/agent/kunden-neu.tsx")));

  // ═════════════════════════════════════════════════════════════════════════
  titel("(c) DER NACHLAUF STEHT IM TAGESLAUF — und ist idempotent");
  // ═════════════════════════════════════════════════════════════════════════
  // ── WARUM (27.08.2026) ─────────────────────────────────────────────────
  // Der Bestandslauf hat am 24.08. sieben Fälle nachgetragen. Drei Tage später
  // standen ZWEI wieder da: alte Wiedervorlage fällig, kein Wartezustand
  // gesetzt. Ein Lauf, den ein Mensch aufrufen muss, wird vergessen.
  const agentRoute = lies("server/routes/fiaon-agent.ts");
  pruef("Der Nachlauf ist als Tageslauf registriert",
    /tageslauf\("warten-nummern-nachtragen"/.test(agentRoute));
  pruef("… über die Registratur, nicht mit eigenem setInterval",
    !/setInterval\([^)]*nummernAnfragen/.test(agentRoute),
    "eine zweite Fassung der CRONS-Bremse war schon viermal im Haus");
  pruef("… und läuft auch kurz nach dem Start",
    /beimStartNach: 90_000/.test(agentRoute),
    "sonst bleiben die Fälle vom Vortag bis morgen liegen");

  const { nummernAnfragenNachtragen } = await import("../server/lib/fiaon-warten");
  // ── DER DOPPELLAUF ERZEUGT NICHTS ──────────────────────────────────────
  // Beide Läufe in EINER Transaktion, die zurückgerollt wird (AGENTS.md): So
  // wird der Bestand nicht angefasst, und die Aussage stimmt trotzdem.
  let ersteRunde = -1;
  let zweiteRunde = -1;
  await sqlPool.begin(async (tx) => {
    ersteRunde = (await nummernAnfragenNachtragen(tx as any)).gesetzt;
    zweiteRunde = (await nummernAnfragenNachtragen(tx as any)).gesetzt;
    throw new Error("PRUEFSTAND_ROLLBACK");
  }).catch((e) => {
    if (!String(e?.message ?? e).includes("PRUEFSTAND_ROLLBACK")) throw e;
  });
  console.log(`        erster Lauf: ${ersteRunde} gesetzt · zweiter Lauf: ${zweiteRunde}`);
  pruef("Der ZWEITE Lauf setzt nichts mehr", zweiteRunde === 0,
    `${zweiteRunde} — ein Nachlauf, der bei jedem Aufruf schreibt, verschiebt `
      + "Wiedervorlagen endlos nach hinten");
  pruef("Und der Bestand blieb unangetastet (Transaktion zurückgerollt)",
    Number(((await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_contact_log
      WHERE note ILIKE '%Wartezustand nachgetragen%'
        AND created_at > NOW() - INTERVAL '2 minutes'
    `) as any[])[0].n) === 0,
    "ein Prüfstand darf keine echten Vorgänge erzeugen");

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
