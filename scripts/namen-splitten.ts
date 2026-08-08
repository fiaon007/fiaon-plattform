// ═══════════════════════════════════════════════════════════════════════════
// NAMENS-BACKFILL — „Axel Conrad" steht im Vornamensfeld
//
// Der Facebook-Lead-Fluss schickt den VOLLEN Namen im Feld `vorname` (in Make
// ist `vollständiger_name` darauf gemappt). Im Bestand liegen dadurch 3 155
// Leads und 2 307 Personen mit leerem Nachnamen.
//
// Das macht die Dubletten-Erkennung halbblind: Wer „Conrad" sucht, findet
// nichts, und derselbe Mensch mit ordentlich getrenntem Namen sieht für jeden
// Vergleich wie ein anderer aus.
//
// NICHTS GEHT VERLOREN. Der ursprüngliche Vollname wird vor der Änderung als
// Alias gesichert (`fiaon_person_aliases`, Art `name_original`). Wer später
// wissen will, was ursprünglich im Feld stand, findet es dort — und die
// Personensuche trifft seit Teil A auch über Aliase.
//
// Getrennt wird mit `nameTeilen` (server/lib/fiaon-name.ts) — derselben
// Funktion, die der Intake ab jetzt benutzt. Es gibt keine zweite Regel.
//
//   npx tsx scripts/namen-splitten.ts              → Vorschau + CSV
//   npx tsx scripts/namen-splitten.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { nameTeilen } from "../server/lib/fiaon-name";

const SCHREIBEN = process.argv.includes("--schreiben");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

interface Fall {
  art: "person" | "lead";
  id: number;
  alt: string;
  vorname: string | null;
  nachname: string | null;
}

async function main(): Promise<void> {
  console.log("\n══ Namens-Backfill: Vorname und Nachname trennen ══\n");

  // Nur Zeilen, bei denen der Nachname LEER ist und der Vorname mehrere Wörter
  // hat. Wo schon ein Nachname steht, wird nichts angefasst — der Mensch, der
  // ihn eingetragen hat, weiß es besser als diese Funktion.
  const personen = await sqlPool`
    SELECT id, first_name FROM fiaon_persons
    WHERE merged_into_person_id IS NULL
      AND COALESCE(TRIM(last_name), '') = ''
      AND first_name LIKE '% %'
    ORDER BY id
  `;
  const leads = await sqlPool`
    SELECT id, vorname FROM fiaon_leads
    WHERE COALESCE(TRIM(nachname), '') = ''
      AND vorname LIKE '% %'
    ORDER BY id
  `;

  const faelle: Fall[] = [];
  let uebersprungen = 0;
  for (const p of personen as any[]) {
    const t = nameTeilen(p.first_name);
    if (!t.getrennt || !t.nachname) { uebersprungen++; continue; }
    faelle.push({ art: "person", id: Number(p.id), alt: String(p.first_name), vorname: t.vorname, nachname: t.nachname });
  }
  for (const l of leads as any[]) {
    const t = nameTeilen(l.vorname);
    if (!t.getrennt || !t.nachname) { uebersprungen++; continue; }
    faelle.push({ art: "lead", id: Number(l.id), alt: String(l.vorname), vorname: t.vorname, nachname: t.nachname });
  }

  const kopf = ["art", "id", "bisher", "neu_vorname", "neu_nachname"];
  const zeilen = faelle.map((f) => [f.art, f.id, f.alt, f.vorname ?? "", f.nachname ?? ""].map(feld).join(";"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/namen-splitten.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  const pAnzahl = faelle.filter((f) => f.art === "person").length;
  const lAnzahl = faelle.filter((f) => f.art === "lead").length;
  console.log(`  Personen mit Vollname im Vornamensfeld:   ${personen.length}`);
  console.log(`  Leads mit Vollname im Vornamensfeld:     ${leads.length}`);
  console.log(`  → trennbar:                              ${faelle.length} (${pAnzahl} Personen, ${lAnzahl} Leads)`);
  console.log(`  → nicht trennbar (Adresse/Nummer/einteilig): ${uebersprungen}`);
  console.log(`  Vorschau: reports/namen-splitten.csv`);
  console.log("\n  Stichprobe:");
  for (const f of faelle.slice(0, 8)) {
    console.log(`    ${f.art.padEnd(7)} #${String(f.id).padEnd(6)} "${f.alt}" → "${f.vorname}" | "${f.nachname}"`);
  }

  if (!SCHREIBEN) {
    console.log("\n  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // ── Ausführen: in Blöcken, nicht Zeile für Zeile ────────────────────────
  // Der erste Entwurf schickte für jede der 5 473 Zeilen zwei Anweisungen nach
  // Oregon — über eine halbe Stunde Laufzeit für eine Änderung, die in Blöcken
  // Sekunden braucht. `unnest` macht aus den berechneten Werten eine Tabelle,
  // die Postgres in EINER Anweisung verarbeitet.
  const bloecke = <T,>(liste: T[], groesse: number): T[][] => {
    const raus: T[][] = [];
    for (let i = 0; i < liste.length; i += groesse) raus.push(liste.slice(i, i + groesse));
    return raus;
  };

  let personenGeaendert = 0;
  let leadsGeaendert = 0;
  let aliase = 0;

  await sqlPool.begin(async (tx) => {
    for (const block of bloecke(faelle.filter((f) => f.art === "person"), 500)) {
      const ids = block.map((f) => f.id);
      const vollnamen = block.map((f) => f.alt);
      const normal = block.map((f) => f.alt.trim().toLowerCase());
      const vor = block.map((f) => f.vorname ?? "");
      const nach = block.map((f) => f.nachname ?? "");

      // ERST sichern, DANN ändern.
      const gesichert = await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, feld_wert, source, quelle_person_id)
        SELECT v.id, 'name_original', v.norm, v.roh, v.roh, 'namen-splitten', v.id
        FROM unnest(${ids}::int[], ${normal}::text[], ${vollnamen}::text[]) AS v(id, norm, roh)
        WHERE NOT EXISTS (
          SELECT 1 FROM fiaon_person_aliases x
          WHERE x.person_id = v.id AND x.kind = 'name_original' AND x.value_norm = v.norm
        )
        RETURNING id
      `;
      aliase += gesichert.length;

      const geaendert = await tx`
        UPDATE fiaon_persons p
        SET first_name = v.vorname, last_name = v.nachname, updated_at = NOW()
        FROM unnest(${ids}::int[], ${vor}::text[], ${nach}::text[]) AS v(id, vorname, nachname)
        WHERE p.id = v.id AND COALESCE(TRIM(p.last_name), '') = ''
        RETURNING p.id
      `;
      personenGeaendert += geaendert.length;
    }

    for (const block of bloecke(faelle.filter((f) => f.art === "lead"), 500)) {
      const ids = block.map((f) => f.id);
      const vor = block.map((f) => f.vorname ?? "");
      const nach = block.map((f) => f.nachname ?? "");
      const notizen = block.map((f) =>
        `Name getrennt: \u201e${f.alt}\u201c \u2192 Vorname \u201e${f.vorname ?? ""}\u201c, Nachname \u201e${f.nachname ?? ""}\u201c`);

      const geaendert = await tx`
        UPDATE fiaon_leads l
        SET vorname = v.vorname, nachname = v.nachname, updated_at = NOW()
        FROM unnest(${ids}::int[], ${vor}::text[], ${nach}::text[]) AS v(id, vorname, nachname)
        WHERE l.id = v.id AND COALESCE(TRIM(l.nachname), '') = ''
        RETURNING l.id
      `;
      leadsGeaendert += geaendert.length;

      // Der Lead-Verlauf hält den ursprünglichen Wortlaut fest — Leads haben
      // keine Alias-Tabelle, und ohne diese Zeile wäre der alte Name fort.
      await tx`
        INSERT INTO fiaon_lead_log (lead_id, agent_id, agent_name, type, note)
        SELECT v.id, NULL, 'System', 'system', v.notiz
        FROM unnest(${ids}::int[], ${notizen}::text[]) AS v(id, notiz)
      `.catch((e) => console.error("[NAMEN-SPLITTEN] Lead-Verlauf:", e));
    }
  });

  console.log(`\n  Personen geändert: ${personenGeaendert} (davon ${aliase} Vollnamen als Alias gesichert)`);
  console.log(`  Leads geändert:    ${leadsGeaendert}`);
  console.log(`  Nichts gelöscht — der ursprüngliche Name bleibt auffindbar.\n`);
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[NAMEN-SPLITTEN]", err);
  process.exit(1);
});
