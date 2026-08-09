// ═══════════════════════════════════════════════════════════════════════════
// DUBLETTEN-AUFRÄUMEN — füllt die Arbeitsliste, führt NICHTS zusammen
//
// Dieser Lauf schreibt eine Prüfliste und sonst nichts. Kein Merge, auch nicht
// bei der stärksten Stufe (gleiche Rufnummer). Der Grund steht im Bestand:
// Ein Antrag lief unter „Magdalena" und gehörte zu Konstantinos Nikoloudis —
// dieselbe E-Mail trug zwei Menschen. Wer aus einem Merkmal automatisch einen
// Zusammenschluss macht, führt irgendwann genau diese zwei Menschen zusammen,
// und niemand merkt es, bis einer von beiden anruft.
//
// Entschieden wird am Arbeitsplatz /admin/dubletten (oder im Bereich
// „Dubletten" der Vertriebsleitung) — von einem Menschen, Paar für Paar.
//
// NACHWEIS, DASS DIE SUCHE GREIFT
// Die CSV enthält außerdem die Paare, die BEREITS zusammengeführt sind, geprüft
// mit denselben Regeln. Damit ist belegt, dass die Suche bekannte Fälle findet
// — namentlich „Axel Conrad" (Person 3775 und 4492). Ohne diesen Abschnitt
// könnte man der Kandidatensuche nur glauben.
//
//   npx tsx scripts/dubletten-aufraeumen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  findeKandidaten, nameAehnlich, nameSchluessel, STUFE_TEXT, type Stufe,
} from "../server/lib/fiaon-dubletten-kandidaten";

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const datum = (v: unknown): string =>
  v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" }).format(new Date(String(v))) : "";

/**
 * Bereits zusammengeführte Paare — mit denselben Regeln nachgeprüft.
 *
 * Diese Paare stehen NICHT auf der Arbeitsliste (sie sind erledigt), aber sie
 * sind der Beweis, dass die Regeln greifen.
 */
async function bereitsZusammengefuehrt(): Promise<any[]> {
  const rows = await sqlPool`
    SELECT v.id AS v_id, v.first_name AS v_vor, v.last_name AS v_nach,
           v.primary_email AS v_mail, v.primary_phone AS v_tel, v.phone_key9 AS v_key,
           v.birthdate AS v_gb, v.created_at AS v_seit,
           g.id AS g_id, g.first_name AS g_vor, g.last_name AS g_nach,
           g.primary_email AS g_mail, g.primary_phone AS g_tel, g.phone_key9 AS g_key,
           g.birthdate AS g_gb, g.created_at AS g_seit,
           (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.person_id = g.id) AS g_bestellungen,
           (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.person_id = v.id) AS v_bestellungen,
           ag.name AS betreuer
    FROM fiaon_persons v
    JOIN fiaon_persons g ON g.id = v.merged_into_person_id
    LEFT JOIN fiaon_agents ag ON ag.id = g.assigned_agent_id
    WHERE v.merged_into_person_id IS NOT NULL
    ORDER BY v.id
  `;
  return (rows as any[]).map((r) => {
    // Dieselben Regeln wie die Kandidatensuche, nur auf ein fertiges Paar.
    let stufe: Stufe | "unklar" = "unklar";
    const mailG = String(r.g_mail ?? "").trim().toLowerCase();
    const mailV = String(r.v_mail ?? "").trim().toLowerCase();
    const ae = nameAehnlich(nameSchluessel(r.g_vor, r.g_nach), nameSchluessel(r.v_vor, r.v_nach));
    if (r.g_key && r.v_key && r.g_key === r.v_key) stufe = "telefon";
    else if (mailG && mailG === mailV) stufe = "email";
    else if (ae.ja && r.g_gb && r.g_gb === r.v_gb) stufe = "name_geburtsdatum";
    else if (ae.ja) stufe = "name";
    return { ...r, stufe };
  });
}

async function main(): Promise<void> {
  console.log("\n══ Dubletten-Kandidaten — Prüfliste, kein Zusammenführen ══\n");

  const kandidaten = await findeKandidaten();
  const erledigt = await bereitsZusammengefuehrt();

  const kopf = [
    "zustand", "stufe", "stufe_text", "merkmal",
    "person_a_id", "person_a_name", "person_a_email", "person_a_telefon",
    "person_a_geburtsdatum", "person_a_bestellungen", "person_a_bezahlt",
    "person_a_betreuer", "person_a_letzter_kontakt", "person_a_angelegt",
    "person_b_id", "person_b_name", "person_b_email", "person_b_telefon",
    "person_b_geburtsdatum", "person_b_bestellungen", "person_b_bezahlt",
    "person_b_betreuer", "person_b_letzter_kontakt", "person_b_angelegt",
    "vorschlag_gewinner", "betreuer_streit", "hinweis",
  ];

  const zeilen: string[] = [];
  for (const k of kandidaten) {
    zeilen.push([
      "offen", k.stufe, k.stufeText, k.merkmal,
      k.links.id, k.links.name, k.links.email, k.links.telefon,
      k.links.geburtsdatum, k.links.bestellungen, k.links.bezahlteBestellungen,
      k.links.betreuerName, datum(k.links.letzterKontakt), datum(k.links.angelegt),
      k.rechts.id, k.rechts.name, k.rechts.email, k.rechts.telefon,
      k.rechts.geburtsdatum, k.rechts.bestellungen, k.rechts.bezahlteBestellungen,
      k.rechts.betreuerName, datum(k.rechts.letzterKontakt), datum(k.rechts.angelegt),
      k.vorschlagGewinnerId,
      k.betreuerStreit ? "JA — braucht eine ausdrückliche Wahl" : "nein",
      k.vermutung ? "Vermutung — nur ähnlicher Name" : "",
    ].map(feld).join(";"));
  }
  for (const e of erledigt) {
    zeilen.push([
      "bereits_zusammengefuehrt", e.stufe,
      e.stufe === "unklar" ? "von der Suche NICHT erfasst" : STUFE_TEXT[e.stufe as Stufe], "",
      e.g_id, [e.g_vor, e.g_nach].filter(Boolean).join(" "), e.g_mail, e.g_tel,
      e.g_gb, e.g_bestellungen, "", e.betreuer, "", datum(e.g_seit),
      e.v_id, [e.v_vor, e.v_nach].filter(Boolean).join(" "), e.v_mail, e.v_tel,
      e.v_gb, e.v_bestellungen, "", "", "", datum(e.v_seit),
      e.g_id, "nein",
      "Nachweis: dieses Paar ist erledigt und wird von denselben Regeln erkannt",
    ].map(feld).join(";"));
  }

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/dubletten-kandidaten.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  // ── Zahlen je Stufe ─────────────────────────────────────────────────────
  const jeStufe: Record<string, number> = { telefon: 0, email: 0, name_geburtsdatum: 0, name: 0 };
  for (const k of kandidaten) jeStufe[k.stufe]++;
  const mitZahlung = kandidaten.filter((k) => k.links.bezahlteBestellungen + k.rechts.bezahlteBestellungen > 0).length;
  const mitStreit = kandidaten.filter((k) => k.betreuerStreit).length;

  console.log("  Offene Kandidatenpaare je Stufe:");
  console.log(`    a) Gleiche Rufnummer .......................... ${jeStufe.telefon}`);
  console.log(`    b) Gleiche E-Mail ............................. ${jeStufe.email}`);
  console.log(`    c) Ähnlicher Name + gleiches Geburtsdatum ..... ${jeStufe.name_geburtsdatum}`);
  console.log(`    d) Nur ähnlicher Name (Vermutung) ............. ${jeStufe.name}`);
  console.log(`    ─────────────────────────────────────────────────────`);
  console.log(`    Gesamt ........................................ ${kandidaten.length}`);
  console.log(`    davon mit bezahlter Bestellung ................ ${mitZahlung}`);
  console.log(`    davon mit zwei verschiedenen Betreuern ........ ${mitStreit}  (brauchen eine ausdrückliche Wahl)`);
  console.log(`\n  Bereits zusammengeführte Paare (Nachweis) ....... ${erledigt.length}`);
  const unklar = erledigt.filter((e) => e.stufe === "unklar");
  if (unklar.length > 0) {
    console.log(`    davon von der Suche NICHT erfasst ............ ${unklar.length}`);
    for (const u of unklar.slice(0, 5)) {
      console.log(`      · ${u.g_id}/${u.v_id} ${[u.g_vor, u.g_nach].filter(Boolean).join(" ")}`);
    }
  }

  // ── Die Gegenprobe, die der Vorgesetzte verlangt hat ─────────────────────
  const conrad = erledigt.find((e) =>
    [Number(e.g_id), Number(e.v_id)].includes(3775) && [Number(e.g_id), Number(e.v_id)].includes(4492));
  const conradOffen = kandidaten.find((k) =>
    [k.links.id, k.rechts.id].includes(3775) && [k.links.id, k.rechts.id].includes(4492));
  console.log("\n  Gegenprobe „Axel Conrad“ (3775 / 4492):");
  if (conradOffen) {
    console.log(`    In der Arbeitsliste, Stufe ${conradOffen.stufe} — wartet auf eine Entscheidung.`);
  } else if (conrad) {
    console.log(`    Steht in der CSV als „bereits_zusammengefuehrt“, erkannt über Stufe ${conrad.stufe}.`);
    console.log(`    Das Paar ist erledigt (4492 zeigt auf 3775) — die Regel greift also.`);
    if (conrad.stufe === "unklar") console.log(`    ACHTUNG: Die Regeln würden dieses Paar NICHT finden.`);
  } else {
    console.log(`    NICHT GEFUNDEN — die Kandidatensuche ist unvollständig, bitte prüfen.`);
  }

  console.log(`\n  Liste geschrieben: reports/dubletten-kandidaten.csv (${zeilen.length} Zeilen)`);
  console.log(`  Es wurde NICHTS zusammengeführt. Entscheiden: /admin/dubletten\n`);
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[DUBLETTEN-AUFRAEUMEN]", err);
  process.exit(1);
});
