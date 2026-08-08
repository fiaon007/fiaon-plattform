// ═══════════════════════════════════════════════════════════════════════════
// MASSEN-ZUSAMMENFÜHRUNG — der ganze Bestand in einem Lauf
//
// ZIEL: EIN Mensch = EIN Personensatz = EINE Akte, ohne dass jemand 1.100 Paare
// durchklickt. Was beweisbar derselbe Mensch ist, wird zusammengeführt; was nach
// zwei Menschen aussieht, wird als „geklärt, keine Dublette" abgehakt. Danach ist
// die Kandidatenliste leer — nicht, weil weggesehen wird, sondern weil jeder Fall
// eine dokumentierte Entscheidung hat.
//
// WAS DIESER LAUF NICHT SELBST ENTSCHEIDET
//   · Die Kriterien stehen in `server/lib/fiaon-massen-merge.ts`.
//   · Das Zusammenführen macht `personenZusammenfuehren` — mit Zählprobe,
//     Alias-Sicherung und Rücknahme bei jedem Zweifel.
//   · Die Produkt-Hygiene macht `server/lib/fiaon-produkt-hygiene.ts`.
// Dieses Skript ist die Reihenfolge, die Vorschau, die Wellen und die Notbremse.
//
// SICHERHEITEN
//   1. Vorschau ist Pflicht. Ohne `--schreiben` wird nichts geschrieben.
//   2. Jede GRUPPE läuft in EINER Transaktion — samt Produkt-Hygiene und
//      Zuständigkeit. Bricht etwas, ist diese Gruppe unberührt.
//   3. Nach jeder WELLE (50 Gruppen) werden Invarianten geprüft. Bricht eine,
//      stoppt der Lauf sofort. Die bereits sauberen Wellen bleiben.
//   4. Eine Weigerung der Merge-Maschine (z. B. Testkonto trifft echten Kunden)
//      ist KEIN Invariantenbruch: Die Gruppe wird übersprungen und im Report
//      benannt. Der Lauf läuft weiter.
//
//   npx tsx scripts/massen-merge.ts                    → Vorschau + CSV
//   npx tsx scripts/massen-merge.ts --schreiben        → ausführen
//   npx tsx scripts/massen-merge.ts --schreiben --grenze=20   → nur 20 Gruppen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  besserenNamenFinden, bildeGruppen, invariantenBrueche, invariantenBruecheGesamt,
  ladeMassenPersonen, KRITERIUM_TEXT,
  type Gruppe, type Stand,
} from "../server/lib/fiaon-massen-merge";
import { personenZusammenfuehren, MergeVerboten } from "../server/lib/fiaon-person-merge";
import { hygieneAusfuehren, hygieneFaelle } from "../server/lib/fiaon-produkt-hygiene";
import { findeKandidaten, kandidatenCacheLeeren } from "../server/lib/fiaon-dubletten-kandidaten";

const SCHREIBEN = process.argv.includes("--schreiben");
const GRENZE = Number(process.argv.find((a) => a.startsWith("--grenze="))?.split("=")[1] ?? "0") || 0;
const WELLE = 50;
const AKTEUR = { name: "Betreiber (Massen-Zusammenführung 08.08.2026)", agentId: null as number | null };

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tag = (v: unknown): string =>
  v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" }).format(new Date(String(v))) : "";

// ── Schließungen: was NICHT zusammengeführt wird und warum ─────────────────
interface Schliessung { a: number; b: number; nameA: string; nameB: string; art: "haushalt" | "vermutung"; grund: string }

/**
 * Alle offenen Kandidatenpaare, die auch nach dem Zusammenführen zwei Menschen
 * bleiben — mit Begründung. Quelle ist dieselbe Kandidatensuche, die den
 * Arbeitsplatz speist; sonst bliebe dort etwas stehen, was hier als erledigt gilt.
 */
async function offeneSchliessungen(gruppenZuordnung: Map<number, number>): Promise<Schliessung[]> {
  kandidatenCacheLeeren();
  const kandidaten = await findeKandidaten();
  const raus: Schliessung[] = [];
  for (const k of kandidaten) {
    const a = k.links;
    const b = k.rechts;
    // Paare innerhalb derselben Gruppe verschwinden durch den Merge selbst.
    const ga = gruppenZuordnung.get(a.id);
    const gb = gruppenZuordnung.get(b.id);
    if (ga != null && ga === gb) continue;
    const haushalt = k.stufe === "telefon" || k.stufe === "email";
    raus.push({
      a: a.id, b: b.id, nameA: a.name, nameB: b.name,
      art: haushalt ? "haushalt" : "vermutung",
      grund: haushalt
        ? `Gemeinsames Merkmal (${k.stufeText}), aber kein zweiter Beweis: ${a.vorname ?? "—"} / ${b.vorname ?? "—"}. Haushalt, Firmenanschluss oder geteilte Adresse.`
        : `Nur Namensähnlichkeit ohne zweites Merkmal (${k.merkmal}). Kein Beweis für denselben Menschen.`,
    });
  }
  return raus;
}

// ── Invarianten ────────────────────────────────────────────────────────────
// Die Regeln stehen in `server/lib/fiaon-massen-merge.ts` — dort prüft sie auch
// der Prüfstand. Hier werden nur die Zahlen erhoben.

async function gesamtStand(): Promise<Stand> {
  const [r] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(DISTINCT payment_reference) FROM fiaon_applications
             WHERE payment_reference IS NOT NULL)::int AS verwendungszwecke,
           (SELECT COUNT(*) FROM fiaon_contact_log)::int AS verlauf,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_leads)::int AS leads,
           (SELECT COUNT(*) FROM fiaon_applications WHERE person_id IS NULL)::int AS ohne_person
  `;
  return {
    bestellungen: Number(r.bestellungen), verwendungszwecke: Number(r.verwendungszwecke),
    verlauf: Number(r.verlauf), provisionen: Number(r.provisionen),
    leads: Number(r.leads), ohnePerson: Number(r.ohne_person),
  };
}

/** Der Stand EINER Gruppe — genau, weil er nur ihre Personen zählt. */
async function gruppenStand(tx: any, ids: number[]): Promise<Stand> {
  const [r] = await tx`
    WITH refs AS (SELECT ref, payment_reference FROM fiaon_applications WHERE person_id = ANY(${ids}::int[]))
    SELECT (SELECT COUNT(*) FROM refs)::int AS bestellungen,
           (SELECT COUNT(DISTINCT payment_reference) FROM refs WHERE payment_reference IS NOT NULL)::int AS verwendungszwecke,
           (SELECT COUNT(*) FROM fiaon_contact_log WHERE ref IN (SELECT ref FROM refs))::int AS verlauf,
           (SELECT COUNT(*) FROM fiaon_commissions WHERE ref IN (SELECT ref FROM refs))::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_leads WHERE person_id = ANY(${ids}::int[]))::int AS leads,
           0 AS ohne_person
  `;
  return {
    bestellungen: Number(r.bestellungen), verwendungszwecke: Number(r.verwendungszwecke),
    verlauf: Number(r.verlauf), provisionen: Number(r.provisionen),
    leads: Number(r.leads), ohnePerson: 0,
  };
}

class InvarianteGebrochen extends Error {
  constructor(public gruppeId: number | null, nachricht: string) {
    super(nachricht);
    this.name = "InvarianteGebrochen";
  }
}

// ── Eine Gruppe ausführen ──────────────────────────────────────────────────
interface GruppenErgebnis {
  gruppe: Gruppe;
  zusammengefuehrt: number[];
  stillgelegt: string[];
  betreuerGesetzt: number | null;
  uebersprungen?: string;
}

async function fuehreGruppeAus(g: Gruppe): Promise<GruppenErgebnis> {
  const ids = [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)];

  return await sqlPool.begin(async (tx) => {
    const vorher = await gruppenStand(tx, ids);

    // Trägt ein Verlierer den saubereren Namen („Milan Acimovic" statt
    // „Wien Wien"), wird er beim Zusammenführen ausdrücklich übernommen. Der
    // bisherige Name des Gewinners bleibt als Alias auffindbar.
    const namensQuelle = besserenNamenFinden(g);

    const zusammengefuehrt: number[] = [];
    for (const v of g.verlierer) {
      // Betreuerwahl: die Merge-Maschine verlangt eine ausdrückliche Wahl, wenn
      // BEIDE Seiten einen dokumentierten Betreuer haben. Sie bekommt die
      // Gruppenentscheidung — dieselbe für jeden Schritt, damit am Ende nicht
      // die Reihenfolge über die Zuständigkeit entscheidet.
      const betreuer = g.betreuerId != null && v.person.betreuerId === g.betreuerId ? "verlierer" : "gewinner";
      const felder = namensQuelle && namensQuelle.id === v.person.id
        ? { first_name: "verlierer" as const, last_name: "verlierer" as const }
        : undefined;
      await personenZusammenfuehren(v.person.id, g.gewinner.id, { betreuer, felder }, AKTEUR, { tx: tx as any });
      zusammengefuehrt.push(v.person.id);
    }

    // ── Zuständigkeit: genau ein Agent, ausdrücklich gesetzt ───────────────
    // Der pfadabhängige Weg über die Einzel-Merges reicht nicht: Ist der
    // Zielagent nur bei einem mittleren Verlierer dokumentiert, stünde am Ende
    // ein anderer da. Also einmal am Schluss, mit Begründung im Protokoll.
    let betreuerGesetzt: number | null = null;
    if (g.betreuerId != null) {
      const [ist] = await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${g.gewinner.id}`;
      if (Number(ist?.assigned_agent_id ?? 0) !== g.betreuerId) {
        await tx`
          UPDATE fiaon_persons SET assigned_agent_id = ${g.betreuerId}, updated_at = NOW()
          WHERE id = ${g.gewinner.id}
        `;
        betreuerGesetzt = g.betreuerId;
      }
      // betreuung_seit = ÄLTESTER dokumentierter Kontakt der Gruppe. Die
      // Betreuung beginnt, wenn der Mensch das erste Mal betreut wurde — nicht,
      // wenn zufällig der Merge lief.
      const aeltester = [g.gewinner, ...g.verlierer.map((v) => v.person)]
        .map((p) => p.betreuungSeit)
        .filter(Boolean)
        .sort()[0];
      if (aeltester) {
        await tx`UPDATE fiaon_persons SET betreuung_seit = ${aeltester} WHERE id = ${g.gewinner.id}`;
      }
      if (g.betreuerKonflikt) {
        await tx`
          INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
          VALUES (${g.betreuerId}, 'person_betreuer_entschieden',
                  ${JSON.stringify({
                    personId: g.gewinner.id,
                    gruppe: g.id,
                    gewaehlt: g.betreuerId,
                    verdraengt: g.betreuerVerdraengt,
                    grund: g.betreuerGrund,
                  })},
                  ${AKTEUR.name},
                  ${`Zuständigkeit nach Zusammenführung entschieden: ${g.betreuerGrund}. Gebuchte Provisionen bleiben unberührt.`})
        `;
      }
    }

    // ── Produkt-Hygiene: ein Kunde, eine Stufe ─────────────────────────────
    const faelle = await hygieneFaelle([g.gewinner.id], tx as any);
    const stillgelegt = await hygieneAusfuehren(faelle, tx as any, "Massen-Zusammenführung 08.08.2026");

    // ── Invarianten der Gruppe ─────────────────────────────────────────────
    const nachher = await gruppenStand(tx, [g.gewinner.id]);
    const brueche = invariantenBrueche(vorher, nachher);
    if (brueche.length > 0) throw new InvarianteGebrochen(g.id, brueche.join("; "));

    const [offen] = await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE person_id = ${g.gewinner.id} AND merged_into IS NULL AND archived_at IS NULL
        AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
        AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
    `;
    if (Number(offen.n) > 1) {
      throw new InvarianteGebrochen(g.id, `Gewinner hat nach der Hygiene noch ${offen.n} offene Stufen`);
    }
    const [waisen] = await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id IS NULL AND ref = ANY(
        SELECT ref FROM fiaon_applications WHERE person_id = ${g.gewinner.id})
    `;
    if (Number(waisen.n) > 0) throw new InvarianteGebrochen(g.id, "Bestellung ohne Person");

    return { gruppe: g, zusammengefuehrt, stillgelegt, betreuerGesetzt };
  }) as GruppenErgebnis;
}

// ── Hauptlauf ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("\n══ Massen-Zusammenführung: ein Mensch, ein Personensatz ══\n");

  const personen = await ladeMassenPersonen();
  console.log(`  Lebende Personen im Bestand: ${personen.length}`);

  const { gruppen: alleGruppen, ausschluesse } = bildeGruppen(personen);
  const gruppen = GRENZE > 0 ? alleGruppen.slice(0, GRENZE) : alleGruppen;

  const zuordnung = new Map<number, number>();
  for (const g of alleGruppen) {
    zuordnung.set(g.gewinner.id, g.id);
    for (const v of g.verlierer) zuordnung.set(v.person.id, g.id);
  }
  const schliessungen = await offeneSchliessungen(zuordnung);

  // ── Vorschau ─────────────────────────────────────────────────────────────
  mkdirSync("reports", { recursive: true });
  const kopf = ["gruppe", "gewinner_id", "gewinner_ref", "gewinner_name", "gewinner_grund",
    "verlierer_id", "verlierer_ref", "verlierer_name", "kriterium", "kriterium_text", "merkmal",
    "bestellungen_gruppe", "bezahlt_gruppe", "betreuer_id", "betreuer_name", "betreuer_grund",
    "betreuer_konflikt", "verdraengte_betreuer"];
  const zeilen: string[] = [];
  for (const g of gruppen) {
    for (const v of g.verlierer) {
      zeilen.push([
        g.id, g.gewinner.id, g.gewinner.personRef, g.gewinner.name, g.gewinnerGrund,
        v.person.id, v.person.personRef, v.person.name, v.kriterium, KRITERIUM_TEXT[v.kriterium], v.merkmal,
        g.bestellungen, g.bezahlteBestellungen, g.betreuerId ?? "", g.betreuerName ?? "", g.betreuerGrund,
        g.betreuerKonflikt ? "ja" : "nein",
        g.betreuerVerdraengt.map((x) => `${x.name ?? x.agentId}`).join(" / "),
      ].map(feld).join(";"));
    }
  }
  writeFileSync("reports/massen-merge-vorschau.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  const personenInGruppen = gruppen.reduce((s, g) => s + 1 + g.verlierer.length, 0);
  const jeKriterium = new Map<string, number>();
  for (const g of gruppen) for (const v of g.verlierer) jeKriterium.set(v.kriterium, (jeKriterium.get(v.kriterium) ?? 0) + 1);
  const konflikte = gruppen.filter((g) => g.betreuerKonflikt);
  const haushalte = schliessungen.filter((s) => s.art === "haushalt");
  const vermutungen = schliessungen.filter((s) => s.art === "vermutung");

  console.log(`  Gruppen:                       ${gruppen.length}`);
  console.log(`  Personen in Gruppen:           ${personenInGruppen}`);
  console.log(`  Davon zusammenzuführen:        ${personenInGruppen - gruppen.length}`);
  console.log(`  Betroffene Bestellungen:       ${gruppen.reduce((s, g) => s + g.bestellungen, 0)}`);
  console.log(`  Davon bezahlt:                 ${gruppen.reduce((s, g) => s + g.bezahlteBestellungen, 0)}`);
  console.log(`  Größte Gruppe:                 ${gruppen[0] ? gruppen[0].verlierer.length + 1 : 0} Sätze`);
  console.log(`  Betreuer-Entscheidungen nötig: ${konflikte.length}`);
  console.log("");
  for (const k of ["A", "B", "C", "D", "E"] as const) {
    console.log(`  Kriterium ${k}  ${String(jeKriterium.get(k) ?? 0).padStart(5)}  ${KRITERIUM_TEXT[k]}`);
  }
  console.log("");
  console.log(`  Automatisch zu schließen (Haushalt):   ${haushalte.length}`);
  console.log(`  Automatisch zu schließen (Vermutung):  ${vermutungen.length}`);
  console.log(`  Untersuchte Paare ohne Beweis:         ${ausschluesse.length}`);
  console.log(`\n  Vorschau: reports/massen-merge-vorschau.csv`);

  console.log("\n  Die zehn größten Gruppen:");
  for (const g of gruppen.slice(0, 10)) {
    console.log(`   Gruppe ${String(g.id).padEnd(6)} ${String(g.gewinner.name).slice(0, 26).padEnd(28)} `
      + `${g.verlierer.length + 1} Sätze, ${g.bestellungen} Bestellungen (${g.bezahlteBestellungen} bezahlt), `
      + `Kriterien ${g.kriterien.join("+")}${g.betreuerKonflikt ? ` — Betreuer: ${g.betreuerName ?? g.betreuerId} (${g.betreuerGrund})` : ""}`);
  }

  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // ── Ausführung in Wellen ────────────────────────────────────────────────
  console.log(`\n══ Ausführung in Wellen zu ${WELLE} Gruppen ══\n`);
  const start = await gesamtStand();
  console.log(`  Ausgangsstand: ${start.bestellungen} Bestellungen, ${start.verwendungszwecke} Verwendungszwecke, `
    + `${start.verlauf} Verlaufseinträge, ${start.provisionen} Provisionen\n`);

  const ergebnisse: GruppenErgebnis[] = [];
  const uebersprungen: { gruppe: Gruppe; grund: string }[] = [];
  let gestopptBei: { gruppe: number | null; grund: string } | null = null;

  for (let i = 0; i < gruppen.length && !gestopptBei; i += WELLE) {
    const welle = gruppen.slice(i, i + WELLE);
    const nummer = Math.floor(i / WELLE) + 1;

    for (const g of welle) {
      try {
        const e = await fuehreGruppeAus(g);
        ergebnisse.push(e);
      } catch (err: any) {
        if (err instanceof InvarianteGebrochen) {
          // NOTBREMSE. Diese Gruppe ist zurückgerollt, alle vorherigen bleiben.
          gestopptBei = { gruppe: err.gruppeId, grund: err.message };
          console.log(`\n  !! NOTBREMSE bei Gruppe ${err.gruppeId}: ${err.message}`);
          console.log("     Diese Gruppe wurde zurückgerollt. Der Lauf hält an.\n");
          break;
        }
        // Eine Weigerung ist kein Bruch: Die Maschine hat den Fall geprüft und
        // abgelehnt. Sie steht im Report, der Lauf geht weiter.
        const grund = err instanceof MergeVerboten ? `${err.code}: ${err.message}` : String(err?.message ?? err);
        uebersprungen.push({ gruppe: g, grund });
        console.log(`  übersprungen: Gruppe ${g.id} (${g.gewinner.name}) — ${grund.slice(0, 120)}`);
      }
    }
    if (gestopptBei) break;

    // ── Invarianten nach der Welle ────────────────────────────────────────
    const jetzt = await gesamtStand();
    const brueche = invariantenBruecheGesamt(start, jetzt);
    if (brueche.length > 0) {
      gestopptBei = { gruppe: null, grund: brueche.join("; ") };
      console.log(`\n  !! NOTBREMSE nach Welle ${nummer}: ${brueche.join("; ")}\n`);
      break;
    }
    console.log(`  Welle ${String(nummer).padStart(3)}: ${ergebnisse.length} Gruppen fertig, `
      + `${jetzt.bestellungen} Bestellungen, ${jetzt.verlauf} Verlaufseinträge — Invarianten gehalten`);
  }

  // ── Restliche Paare abhaken ─────────────────────────────────────────────
  let geschlossen = 0;
  if (!gestopptBei) {
    console.log("\n  Restliche Paare abhaken (Haushalt, Vermutung) …");
    const rest = await offeneSchliessungen(new Map());
    await sqlPool.begin(async (tx) => {
      for (const s of rest) {
        const [kl, gr] = s.a < s.b ? [s.a, s.b] : [s.b, s.a];
        await tx`
          INSERT INTO fiaon_dubletten_entschieden (person_a, person_b, entscheidung, begruendung, akteur)
          VALUES (${kl}, ${gr}, 'keine_dublette', ${s.grund}, ${AKTEUR.name})
        `;
        geschlossen++;
      }
    });
    kandidatenCacheLeeren();
    console.log(`  Abgehakt: ${geschlossen} Paare (bleiben als Historie stehen, rücknehmbar).`);
  }

  // ── Ergebnis-CSV ────────────────────────────────────────────────────────
  const ergKopf = ["gruppe", "gewinner_id", "gewinner_name", "zusammengefuehrt", "verlierer_ids",
    "stillgelegte_bestellungen", "betreuer_gesetzt", "ergebnis"];
  const ergZeilen = ergebnisse.map((e) => [
    e.gruppe.id, e.gruppe.gewinner.id, e.gruppe.gewinner.name, e.zusammengefuehrt.length,
    e.zusammengefuehrt.join(" "), e.stillgelegt.join(" "), e.betreuerGesetzt ?? "", "zusammengeführt",
  ].map(feld).join(";"));
  for (const u of uebersprungen) {
    ergZeilen.push([u.gruppe.id, u.gruppe.gewinner.id, u.gruppe.gewinner.name, 0, "", "", "", `übersprungen: ${u.grund}`]
      .map(feld).join(";"));
  }
  const schlussKopf = ["person_a", "person_b", "name_a", "name_b", "art", "begruendung"];
  const schlussZeilen = (await offeneSchliessungen(new Map())).map((s) =>
    [s.a, s.b, s.nameA, s.nameB, s.art, s.grund].map(feld).join(";"));

  writeFileSync("reports/massen-merge-ergebnis.csv",
    `${ergKopf.join(";")}\n${ergZeilen.join("\n")}\n\n`
    + `automatisch geschlossen (Haushalt/Vermutung)\n${schlussKopf.join(";")}\n${schlussZeilen.join("\n")}\n`,
    "utf8");

  // ── Abnahme: ist die Kandidatenliste leer? ──────────────────────────────
  kandidatenCacheLeeren();
  const offeneKandidaten = await findeKandidaten();
  const jeStufe = new Map<string, number>();
  for (const k of offeneKandidaten) jeStufe.set(k.stufe, (jeStufe.get(k.stufe) ?? 0) + 1);

  const ende = await gesamtStand();
  console.log("\n══ Ergebnis ══\n");
  console.log(`  Gruppen zusammengeführt:  ${ergebnisse.length}`);
  console.log(`  Personensätze aufgelöst:  ${ergebnisse.reduce((s, e) => s + e.zusammengefuehrt.length, 0)}`);
  console.log(`  Bestellungen stillgelegt: ${ergebnisse.reduce((s, e) => s + e.stillgelegt.length, 0)}`);
  console.log(`  Gruppen übersprungen:     ${uebersprungen.length}`);
  console.log(`  Paare abgehakt:           ${geschlossen}`);
  console.log(`  Offene Kandidaten danach: ${offeneKandidaten.length} `
    + `(${Array.from(jeStufe.entries()).map(([s, n]) => `${s}: ${n}`).join(", ") || "keine"})`);
  console.log("");
  console.log(`  Bestellungen:      ${start.bestellungen} → ${ende.bestellungen}`);
  console.log(`  Verwendungszwecke: ${start.verwendungszwecke} → ${ende.verwendungszwecke}`);
  console.log(`  Verlaufseinträge:  ${start.verlauf} → ${ende.verlauf}`);
  console.log(`  Provisionen:       ${start.provisionen} → ${ende.provisionen}`);
  console.log(`  Ohne Person:       ${start.ohnePerson} → ${ende.ohnePerson}`);
  if (gestopptBei) {
    console.log(`\n  ANGEHALTEN bei Gruppe ${gestopptBei.gruppe ?? "—"}: ${gestopptBei.grund}`);
    console.log("  Die bereits ausgeführten Wellen sind sauber und bleiben.");
  }
  console.log(`\n  Ergebnis: reports/massen-merge-ergebnis.csv\n`);

  await sqlPool.end();
  if (gestopptBei) process.exit(2);
}

main().catch((err) => {
  console.error("[MASSEN-MERGE]", err);
  process.exit(1);
});
