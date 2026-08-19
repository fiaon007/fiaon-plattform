// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: EINE ERGEBNISLISTE, EIN NOTIZFELD
//
// ── WARUM ES DIESEN LAUF GIBT ──────────────────────────────────────────────
// „Erreicht – Sonstiges funktioniert nicht" wurde DREIMAL gemeldet. Nicht, weil
// der Fix schwierig war, sondern weil die Liste an fünf Stellen stand:
//
//   server/lib/fiaon-kontakt-ergebnis.ts        9 Werte
//   client/src/components/Softphone.tsx         8 Werte (nummer_blockiert fehlte)
//   client/src/pages/agent/kunden-neu.tsx       9 Werte
//   client/src/pages/agent/kontakt-ergebnis.tsx KUNDE_GRUPPEN — OHNE Sonstiges
//   client/src/pages/agent/kunden.tsx           gelöscht (mit dem Fix darin)
//
// Und weil der Klick in `kunden-neu.tsx` einen Zustand setzte („notiz"), für den
// es KEIN Bauteil gab: `feldOffen === "zusage"` und `=== "termin"` wurden
// gerendert, „notiz" nicht. Der Knopf setzte den Zustand und kehrte zurück —
// keine Anfrage, kein Feld, keine Meldung.
//
// Dieser Lauf verhindert die sechste Fassung und die Rückkehr des toten Knopfs.
//
//   npx tsx scripts/pruef-ergebnis-eine-liste.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ERGEBNISSE, ERGEBNIS_LISTE, BRAUCHT_NOTIZ, NOTIZ_MINDESTLAENGE, pruefeNotiz,
} from "../shared/fiaon-kontakt-ergebnis-liste";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

/** Alle .ts/.tsx unter einem Pfad. */
function dateien(wurzel: string): string[] {
  const raus: string[] = [];
  const gehe = (p: string) => {
    for (const n of readdirSync(p)) {
      const v = join(p, n);
      if (n === "node_modules" || n.startsWith(".")) continue;
      if (statSync(v).isDirectory()) gehe(v);
      else if (/\.(ts|tsx)$/.test(n)) raus.push(v);
    }
  };
  gehe(wurzel);
  return raus;
}

/** Quelltext ohne Kommentarzeilen — sonst trifft jede Prüfung ihre Begründung. */
function ohneKommentar(text: string): string {
  return text.split("\n")
    .filter((z) => {
      const t = z.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

function main(): void {
  log("\n══ Prüfstand: eine Ergebnisliste, ein Notizfeld ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Liste in shared/ ist vollständig und stimmig");
  // ═════════════════════════════════════════════════════════════════════════
  ok("Neun Ergebnisse", ERGEBNISSE.length === 9, `${ERGEBNISSE.length}`);
  ok("Die Liste deckt jeden Wert ab",
    ERGEBNISSE.every((e) => ERGEBNIS_LISTE.some((x) => x.art === e)));
  ok("„erreicht_sonstiges“ ist dabei", ERGEBNISSE.includes("erreicht_sonstiges" as any));
  ok("„nummer_blockiert“ ist dabei (fehlte im Softphone)",
    ERGEBNISSE.includes("nummer_blockiert" as any));
  ok("Genau EIN Ergebnis braucht eine Notiz", BRAUCHT_NOTIZ.size === 1,
    `${BRAUCHT_NOTIZ.size} — jede weitere Hürde erzeugt Ausweichverhalten`);
  ok("Und zwar „erreicht_sonstiges“", BRAUCHT_NOTIZ.has("erreicht_sonstiges"));
  ok("Jeder Eintrag hat Knopftext und Klartext",
    ERGEBNIS_LISTE.every((e) => e.knopf.length > 2 && e.klartext.length > 2));

  // Die Pflicht muss wirken — und bei genug Zeichen nachgeben.
  ok("Eine kurze Notiz wird abgelehnt",
    pruefeNotiz("erreicht_sonstiges", "kurz") !== null);
  ok("Eine ausreichende Notiz geht durch",
    pruefeNotiz("erreicht_sonstiges", "x".repeat(NOTIZ_MINDESTLAENGE)) === null);
  ok("Andere Ergebnisse brauchen keine Notiz",
    pruefeNotiz("nicht_erreicht", "") === null);
  ok("Die Ablehnung nennt die Mindestlänge",
    String(pruefeNotiz("erreicht_sonstiges", "")).includes(String(NOTIZ_MINDESTLAENGE)));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Keine sechste Fassung der Liste");
  // ═════════════════════════════════════════════════════════════════════════
  // ── OBERGRENZE STATT VERBOT ─────────────────────────────────────────────
  // Der erste Entwurf verlangte: KEINE Datei außer shared/ nennt vier oder mehr
  // Ergebniswerte. Er meldete acht Treffer — und die meisten zu Recht
  // bestehend: `fiaon-kontakt-ergebnis.ts` MUSS jeden Wert nennen (dort steht,
  // was ein Ergebnis für den Zustand bedeutet), und die Lead-Strecke hat eigene
  // Werte, die zufällig gleich heißen.
  //
  // AGENTS.md: „Eine Prüfung mit Fehlalarmen ist schlechter als keine" und
  // „Obergrenze statt Verbot. Eine Wand, die 397 Fehler meldet, wird nach dem
  // zweiten Lauf abgeschaltet." Also: eine begründete Liste der bekannten
  // Stellen — jede NEUE wird rot.
  const bekannt: Record<string, string> = {
    "shared/fiaon-kontakt-ergebnis-liste.ts": "die Quelle selbst",
    "scripts/pruef-ergebnis-eine-liste.ts": "dieser Prüfstand",
    "server/lib/fiaon-kontakt-ergebnis.ts":
      "die Zustands-Wirkung je Ergebnis — muss jeden Wert nennen",
    "server/routes/fiaon-agent-kunden.ts":
      "Sonderbehandlung einzelner Ergebnisse in der Route",
    "client/src/pages/agent/kunden-neu.tsx":
      "die Liste VERABREDET — welche Ergebnisse die Karte ausblenden",
    "client/src/pages/agent/kontakt-ergebnis.tsx":
      "LEAD_GRUPPEN (eigene Lead-Werte, gleiche Namen bei nicht_erreicht/mailbox)",
    "client/src/pages/agent/leads.tsx": "Lead-Strecke, eigene Werte",
    "client/src/pages/admin-leads.tsx": "Lead-Strecke, eigene Werte",
    "server/routes/fiaon-leads.ts": "Lead-Strecke, eigene Werte",
  };
  const neueFassung: string[] = [];
  for (const d of [...dateien("client/src"), ...dateien("server"), ...dateien("shared")]) {
    const rel = d.replace(/\\/g, "/");
    if (Object.keys(bekannt).some((e) => rel.endsWith(e))) continue;
    const text = ohneKommentar(readFileSync(d, "utf8"));
    const treffer = ERGEBNISSE.filter((e) => text.includes(`"${e}"`) || text.includes(`'${e}'`));
    // Vier und mehr ist eine Liste. Bis drei sind Einzelfälle (eine Route, die
    // „nicht_erreicht" und „mailbox" gesondert behandelt, ist keine Kopie).
    if (treffer.length >= 4) neueFassung.push(`${rel} (${treffer.length} Werte)`);
  }
  ok("Keine NEUE Datei führt eine eigene Ergebnisliste",
    neueFassung.length === 0,
    `${neueFassung.join(" · ")} — begründen und in „bekannt“ aufnehmen, oder shared/ benutzen`);

  // Und die gelöschten Fassungen dürfen nicht zurückkommen.
  for (const weg of [
    "client/src/pages/agent/heute.tsx",
    "client/src/pages/agent/meine-kunden.tsx",
    "client/src/pages/agent/kunden.tsx",
  ]) {
    let da = true;
    try { statSync(weg); } catch { da = false; }
    ok(`Die tote Fassung ${weg.split("/").pop()} ist weg`, !da,
      "steht wieder da — sie hängt an keiner Route und führt in die Irre");
  }
  const kontakt = ohneKommentar(readFileSync("client/src/pages/agent/kontakt-ergebnis.tsx", "utf8"));
  ok("`KUNDE_GRUPPEN` (die Fassung ohne „Sonstiges“) ist weg",
    !/KUNDE_GRUPPEN/.test(kontakt));

  // Die Mindestlänge darf nicht als Zahl in der Oberfläche stehen.
  const zahlVerdacht: string[] = [];
  for (const d of ["client/src/components/Softphone.tsx",
    "client/src/components/agent/ErgebnisWahl.tsx",
    "client/src/pages/agent/kunden-neu.tsx"]) {
    const text = ohneKommentar(readFileSync(d, "utf8"));
    if (/(length\s*<\s*10|10\s*-\s*\w*[Nn]otiz|mindestens 10)/.test(text)) {
      zahlVerdacht.push(d);
    }
  }
  ok("Die Mindestlänge steht nirgends als Zahl 10 im Quelltext",
    zahlVerdacht.length === 0, zahlVerdacht.join(", "));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Kein Zustand ohne Bauteil (der tote Knopf)");
  // ═════════════════════════════════════════════════════════════════════════
  const karte = ohneKommentar(readFileSync("client/src/pages/agent/kunden-neu.tsx", "utf8"));
  ok("`feldOffen` mit dem Wert „notiz“ ist weg",
    !/feldOffen[\s\S]{0,120}["']notiz["']/.test(karte));
  ok("Die Kundenkarte rendert `ErgebnisWahl`", /<ErgebnisWahl/.test(karte));
  ok("Die Kundenkarte baut die Ergebnisknöpfe nicht mehr selbst",
    !/ERGEBNISSE\.map\(/.test(karte));

  const wahl = readFileSync("client/src/components/agent/ErgebnisWahl.tsx", "utf8");
  const wahlOhne = ohneKommentar(wahl);
  // Für JEDEN Zustand, den das Bauteil setzen kann, muss es einen Render-Block
  // geben. Genau diese Lücke war der Fehler.
  for (const z of ["notiz", "zusage", "termin"]) {
    ok(`Es gibt einen Render-Block für „${z}“`,
      wahlOhne.includes(`offen?.braucht === "${z}"`), "kein Block gefunden");
  }
  ok("Das Notizfeld ist ein echtes Eingabefeld", /<textarea/.test(wahlOhne));
  ok("Es gibt einen Zeichenzähler", /notiz-zaehler/.test(wahlOhne));
  ok("Die Beispiel-Vorlagen sind da", /NOTIZ_VORLAGEN\.map/.test(wahlOhne));
  ok("Der Fehler wird ANGEZEIGT, nicht verschluckt",
    /ergebnis-fehler/.test(wahlOhne) && /role="alert"/.test(wahlOhne));
  ok("Das Bauteil erwartet einen Ausgang (kein `void`)",
    /Promise<ErgebnisAusgang>/.test(wahlOhne));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Der Server bleibt die Wand");
  // ═════════════════════════════════════════════════════════════════════════
  const lib = readFileSync("server/lib/fiaon-kontakt-ergebnis.ts", "utf8");
  ok("Der Server liest die Liste aus shared/",
    /shared\/fiaon-kontakt-ergebnis-liste/.test(lib));
  ok("Der Server definiert die Liste NICHT mehr selbst",
    !/export const ERGEBNISSE = \[/.test(ohneKommentar(lib)));
  const routen = readFileSync("server/routes/fiaon-agent-kunden.ts", "utf8")
    + readFileSync("server/routes/fiaon-agent.ts", "utf8");
  ok("Die Routen rufen `pruefeNotiz`", /pruefeNotiz\(/.test(routen));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Stufe A ruht nie — sie wird entschieden");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Regel des Betreibers (19.08.2026) am Quelltext festgehalten. Die
  // Wirkung auf den Bestand prüft `ruhe-staffel-nachziehen.ts` mit seinen
  // Zählproben; hier geht es darum, dass die Regel nicht wieder herausfällt.
  const ne = readFileSync("server/lib/fiaon-nicht-erreicht.ts", "utf8");
  const neOhne = ohneKommentar(ne);
  ok("Es gibt eine Stufe-A-Bedingung an EINER Stelle",
    /export function stufeASql/.test(neOhne));
  ok("Die Ruhe-Bedingung nimmt Stufe A aus",
    /NOT \$\{stufeASql\(p\)\}/.test(neOhne),
    "ruhtSql kennt die Ausnahme nicht — Stufe A würde wieder ruhen");
  ok("Ab der Leitungs-Schwelle geht Stufe A an die Vertriebsleitung",
    /versuche >= SCHWELLE_LEITUNG && istStufeA/.test(neOhne));
  ok("Die Stufe-A-Wirkung ist eine eigene Funktion (kein Mailversand im Bestandslauf)",
    /export async function stufeAAnLeitung/.test(neOhne));
  ok("Stufe A wird auch nicht gestreckt",
    /SCHWELLE_STRECKEN && !istStufeA/.test(neOhne));
  ok("Die Aufgabe geht in die Vermerke, nicht in ein zweites Aufgabensystem",
    /INSERT INTO fiaon_vermerke/.test(neOhne));
  ok("Es gibt eine Sperre gegen doppelte Aufgaben je Person",
    /status = 'offen'[\s\S]{0,400}?LIMIT 1/.test(neOhne));
  ok("Ohne aktive Vertriebsleitung fällt die Aufgabe an den Betreiber",
    /fuer_betreiber/.test(neOhne) && /zustaendig == null/.test(neOhne));
  // Der Bestandslauf darf die Regel nicht im eigenen Namen brechen.
  const lauf = ohneKommentar(readFileSync("scripts/ruhe-staffel-nachziehen.ts", "utf8"));
  ok("Der Bestandslauf setzt Stufe A NICHT auf ruhend",
    /NOT \$\{stufeASql\("p"\)\}[\s\S]{0,200}?NOT \$\{ruhtSql\("p"\)\}/.test(lauf));
  ok("Der Bestandslauf benutzt `stufeAAnLeitung` (sendet keine Mails)",
    /stufeAAnLeitung/.test(lauf) && !/automatikNachFehlversuch/.test(lauf));
  ok("Eine Zusage in der Zukunft schlägt die Wiedervorlage",
    /promised_payment_date > CURRENT_DATE/.test(lauf));

  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  if (fehlgeschlagen > 0) process.exit(1);
}

main();
