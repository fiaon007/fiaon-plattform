// ═══════════════════════════════════════════════════════════════════════════
// WAND: WESSEN GESPRÄCH, UND ZU WEM GEHÖRT DER NAME?
//
// Zwei Regeln, die ab jetzt täglich geprüft werden:
//
//   1. Ein Profil-Tab zeigt NUR belegte Gespräche — ausgehend (die Sitzung hat
//      gewählt) oder eingehend mit erfasstem Ergebnis. Ein aus der
//      Zuständigkeit GERATENER Anruf erscheint in keinem Profil.
//   2. Die gewählte Nummer gehört zur verknüpften Person — oder die Zeile trägt
//      die Marke „Zuordnung unklar". Ein Name, der nicht zum Gespräch gehört,
//      ist nicht zulässig.
//
// ── WARUM DAS EINE WAND BRAUCHT ───────────────────────────────────────────
// Der Fehler war am 17.08. behoben und am 19.08. wieder gemeldet — weil der
// Bestand nicht mitgeräumt war und niemand es messen konnte. Eine Regel ohne
// täglichen Blick fällt beim nächsten Umbau lautlos heraus.
//
// Muster: Stufen-Wächter (`pruef-stufen-waechter.ts`) — Altbestand muss sauber
// sein, Neuzugang wird GEMELDET, nicht gewertet (AGENTS.md).
//
//   npx tsx scripts/pruef-anruf-zuordnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  NUMMER_PASST_SQL, BELEGT_GEFUEHRT_SQL, HERKUNFT_BELEGT,
} from "../server/lib/fiaon-anruf-pruefung";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`); }

/** Quelltext ohne Kommentarzeilen — sonst trifft die Prüfung ihre Begründung. */
function ohneKommentar(text: string): string {
  return text.split("\n").filter((z) => {
    const t = z.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("--");
  }).join("\n");
}

async function main(): Promise<void> {
  log("\n══ Wand: Anruf-Zuordnung ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Regel steht an EINER Stelle und wird benutzt");
  // ═════════════════════════════════════════════════════════════════════════
  const team = ohneKommentar(readFileSync("server/routes/fiaon-team.ts", "utf8"));
  ok("Der Profil-Tab filtert über `BELEGT_GEFUEHRT_SQL`",
    /BELEGT_GEFUEHRT_SQL\("k"\)/.test(team),
    "der Tab zeigt wieder geratene Anrufe");
  // Die Kennzahlen müssen DIESELBE Bedingung tragen — sonst sagt die Kachel
  // eine andere Zahl als die Liste darunter.
  const treffer = (team.match(/BELEGT_GEFUEHRT_SQL\("k"\)/g) ?? []).length;
  ok("Liste UND Kennzahlen benutzen sie (zwei Fundstellen)", treffer >= 2,
    `${treffer} Fundstelle(n) — die Kachel zählt sonst eine andere Menge als die Liste`);
  ok("Die Anzeige liefert `nummer_passt` mit",
    /NUMMER_PASST_SQL\("k", "p"\)/.test(team));
  ok("Es gibt keine zweite Fassung der Herkunfts-Liste",
    !/'gewaehlt',\s*'ergebnis'/.test(team.replace(/BELEGT_GEFUEHRT_SQL[^\n]*/g, "")),
    "die Werte stehen wieder als Literal in der Route");
  ok("Die belegten Herkünfte sind genau zwei", HERKUNFT_BELEGT.length === 2);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Kein Profil zeigt einen geratenen Anruf");
  // ═════════════════════════════════════════════════════════════════════════
  // Gemessen an der WIRKUNG, nicht am Quelltext: So viele Zeilen würde der Tab
  // je Mitarbeiter zeigen, und keine davon darf geraten sein.
  const [g] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS geraten
      FROM fiaon_calls k
     WHERE k.agent_id IS NOT NULL AND NOT ${BELEGT_GEFUEHRT_SQL("k")}
  `)) as any[];
  log(`        ${g.geraten} Anrufe sind geraten (eingehend ohne Ergebnis) —`);
  log("        sie stehen an der Kundenakte, aber in keinem Profil.");
  // Das ist KEIN Fehler, sondern die Menge, die der Filter fernhält. Der Fehler
  // wäre, wenn der Filter sie durchließe — und genau das prüft Gruppe 1.
  const [sichtbar] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_calls k
     WHERE k.agent_id IS NOT NULL AND ${BELEGT_GEFUEHRT_SQL("k")}
  `)) as any[];
  ok("Es bleiben Gespräche übrig (der Filter sperrt nicht alles aus)",
    Number(sichtbar.n) > 0, `${sichtbar.n} sichtbar`);

  // ── ZÄHLPROBE JE MITARBEITER ────────────────────────────────────────────
  // Profil-Zahl == Anzahl seiner belegten Anrufe. Die Prüfung rechnet beide
  // Seiten getrennt und vergleicht — nicht dieselbe Abfrage zweimal.
  const jeAgent = (await sqlPool.unsafe(`
    SELECT ag.id, ag.name,
           COUNT(*) FILTER (WHERE ${BELEGT_GEFUEHRT_SQL("k")})::int AS belegt,
           COUNT(*)::int AS alle
      FROM fiaon_agents ag
      JOIN fiaon_calls k ON k.agent_id = ag.id
     GROUP BY 1, 2 ORDER BY alle DESC
  `)) as any[];
  log("\n        Mitarbeiter                 im Tab   ausgeblendet");
  log("        " + "─".repeat(52));
  let summeBelegt = 0;
  for (const a of jeAgent) {
    summeBelegt += Number(a.belegt);
    log(`        ${String(a.name).slice(0, 26).padEnd(27)} ${String(a.belegt).padStart(6)} `
      + `${String(Number(a.alle) - Number(a.belegt)).padStart(14)}`);
  }
  ok("Die Summe der Profil-Zahlen entspricht den belegten Anrufen",
    summeBelegt === Number(sichtbar.n), `${summeBelegt} ≠ ${sichtbar.n}`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Der Name gehört zum Gespräch (oder die Marke steht)");
  // ═════════════════════════════════════════════════════════════════════════
  // Altbestand und Neuzugang getrennt (AGENTS.md): Frisches wird gemeldet,
  // nicht gewertet — sonst wird die Wand rot, weil der Betrieb läuft.
  const [alt] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_calls k
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
     WHERE k.person_id IS NOT NULL
       AND (${NUMMER_PASST_SQL("k", "p")}) IS FALSE
       AND k.zuordnung_unklar_am IS NULL
       AND k.beginn < NOW() - INTERVAL '1 hour'
  `)) as any[];
  ok("Altbestand: kein Anruf trägt einen fremden Namen ohne Marke",
    Number(alt.n) === 0,
    `${alt.n} Zeilen — npx tsx scripts/anruf-zuordnung-bereinigen.ts --schreiben`);

  const [frisch] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_calls k
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
     WHERE k.person_id IS NOT NULL
       AND (${NUMMER_PASST_SQL("k", "p")}) IS FALSE
       AND k.zuordnung_unklar_am IS NULL
       AND k.beginn >= NOW() - INTERVAL '1 hour'
  `)) as any[];
  log(`        Neuzugang (< 1 h): ${frisch.n} — gemeldet, nicht gewertet.`);
  if (Number(frisch.n) > 0) {
    log("        Wenn diese Zahl WÄCHST, schreibt die Wähl-Route wieder die offene");
    log("        Karte statt der gewählten Nummer. Das wäre ein Rückfall.");
  }

  // ── DIE WÄHL-ROUTE MUSS DER NUMMER FOLGEN ───────────────────────────────
  const tel = ohneKommentar(readFileSync("server/routes/fiaon-telefonie.ts", "utf8"));
  ok("Die Wähl-Route ordnet über die NUMMER zu (`anrufZuordnen`)",
    /anrufZuordnen\(pruefung\.nummer!/.test(tel));
  ok("Sie speichert die aufgelöste Person, nicht die offene Karte",
    /VALUES \(\$\{echtePersonId\}/.test(tel),
    "person_id kommt wieder aus dem Body — der Fehler von vor dem 17.08.");
  ok("Die Herkunft wird mitgeschrieben",
    /zuordnung_herkunft/.test(tel));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Die Anzeige nennt Wähler, Kunde und Nummer");
  // ═════════════════════════════════════════════════════════════════════════
  const zentrale = readFileSync("client/src/pages/admin-team-zentrale.tsx", "utf8");
  ok("Die Zeile trägt „geführt von“", /geführt von/.test(zentrale));
  ok("Sie nennt den Kunden und die gewählte Nummer",
    /data-fiaon="anruf-herkunft"/.test(zentrale) && /a\.nummer/.test(zentrale));
  ok("Ein Widerspruch zwischen Nummer und Kunde wird ROT gezeigt",
    /anruf-nummer-passt-nicht/.test(zentrale));
  ok("„Zuordnung unklar“ ersetzt den Namen, statt ihn zu behaupten",
    /zuordnung_unklar_am[\s\S]{0,200}Zuordnung unklar/.test(zentrale));
  ok("Nie verbundene Wahlversuche sind gekennzeichnet",
    /anruf-nicht-verbunden/.test(zentrale));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Der Weg zum Tab ist begehbar");
  // ═════════════════════════════════════════════════════════════════════════
  // Gefunden vom Browsertest: „Profil öffnen" im Drei-Punkte-Menü zeigte auf
  // `/admin/agents/:id` — eine Adresse, die es nicht gibt („Diese Seite
  // existiert nicht"). Der Gespräche-Tab war damit über das Menü UNERREICHBAR.
  // AGENTS.md: „Ein `<a href>` ist kein Knopf." Dieselbe Klasse wie der
  // Produkt-Knopf, der vier Tage gekostet hat.
  ok("„Profil öffnen“ zeigt nicht mehr auf eine Adresse, die es nicht gibt",
    !/href=\{`\/admin\/agents\/\$\{m\.id\}`\}/.test(zentrale),
    "der toten Link ist zurück — der Tab wird über das Menü unerreichbar");
  ok("Es öffnet die Schublade über `onProfil`",
    /onProfil\(\)/.test(zentrale) && /onProfil=\{\(\) => setOffen\(m\.id\)\}/.test(zentrale));
  // Und keine andere Menü-Zeile darf auf eine Seiten-Adresse zeigen, die es im
  // Router nicht gibt. Geprüft gegen App.tsx, nicht gegen eine Annahme.
  const app = readFileSync("client/src/App.tsx", "utf8");
  const seitenLinks = Array.from(zentrale.matchAll(/href=\{?`?(\/admin\/[a-z-]+)/g))
    .map((m) => m[1]);
  const tot = Array.from(new Set(seitenLinks)).filter((p) => !app.includes(`"${p}`));
  ok("Kein Menü-Link der Team-Zentrale zeigt auf eine unbekannte Adresse",
    tot.length === 0, tot.join(", "));

  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
