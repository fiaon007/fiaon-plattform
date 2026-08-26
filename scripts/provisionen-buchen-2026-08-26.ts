// ═══════════════════════════════════════════════════════════════════════════
// PROVISIONEN BUCHEN — Kontoauszug vom 26.08.2026
//
// Justin: „Buche bitte die Provisionen den Mitarbeitern zu."
//         „Viktoria so wie alle anderen bitte, 25 % — buche bei jeden die
//          Provision bitte."
//
// ── DER SATZ: 25 %, NICHT 20 % ────────────────────────────────────────────
// GEFUNDEN beim Prüfen: Das Entscheidungsregister hält 25 % fest
// (E-035–E-039, Justins Entscheidung), und das Logbuch sagt ausdrücklich
// „auf 2500 = 25 % gesetzt". In der Datenbank standen aber 2000 = 20 % bei
// Daniel, Florentine, Lucas und Nikita — und bei Angelique, Rifka und
// Viktoria gar kein Satz.
//
// Der Lauf setzt deshalb 25 % überall dort, wo 20 % oder nichts stand.
// UNANGETASTET bleiben Hans-Jürgen (30 %) und Diana (15 %): Wer einen höheren
// Satz hat, dem nimmt man ihn nicht ohne ausdrückliche Ansage; und Dianas
// Modell ist noch offen.
//
// ── DOPPELBUCHUNG IST DIE GEFAHR ──────────────────────────────────────────
// Ein Skript, das zweimal läuft, zahlt zweimal. Deshalb trägt jede Buchung
// eine Notiz mit der TransferWise-ID, und vor dem Einfügen wird geprüft, ob
// genau diese ID schon gebucht ist. Der Lauf ist damit beliebig oft
// wiederholbar, ohne Schaden anzurichten.
//
// Aufruf:  npx tsx scripts/provisionen-buchen-2026-08-26.ts [--buchen]
//          ohne --buchen wird nur gerechnet und angezeigt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const ECHT = process.argv.includes("--buchen");
const ORDNER = `${process.env.HOME}/Desktop/FIAON/02_Finanzen`;
const NEU = "statement_165031496_EUR_2026-07-03_2026-08-26.csv";
const ALT = "statement_165031496_EUR_2026-07-03_2026-08-23.csv";
const ZIEL_BP = 2500;

/** CSV mit Anführungszeichen und eingebetteten Kommas. */
function lade(datei: string): Record<string, string>[] {
  const roh = readFileSync(`${ORDNER}/${datei}`, "utf8").replace(/^﻿/, "");
  const zeilen: string[][] = [];
  let feld = "", zeile: string[] = [], inAnf = false;
  for (let i = 0; i < roh.length; i++) {
    const c = roh[i];
    if (inAnf) {
      if (c === '"' && roh[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inAnf = false;
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === ",") { zeile.push(feld); feld = ""; }
    else if (c === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else if (c !== "\r") feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  const kopf = zeilen[0];
  return zeilen.slice(1).filter((z) => z.length > 3)
    .map((z) => Object.fromEntries(kopf.map((k, i) => [k, z[i] ?? ""])));
}

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  // ── 1. Die Sätze richtigstellen ──────────────────────────────────────────
  const vorher = (await sqlPool`
    SELECT id, name, commission_rate_bp FROM fiaon_agents
     WHERE active AND NOT is_test_account ORDER BY id`) as any[];
  console.log("── PROVISIONSSÄTZE ──");
  const zuSetzen = vorher.filter((a) => a.commission_rate_bp == null || Number(a.commission_rate_bp) === 2000);
  for (const a of vorher) {
    const alt = a.commission_rate_bp == null ? "—" : `${Number(a.commission_rate_bp) / 100} %`;
    const neu = zuSetzen.includes(a) ? `${ZIEL_BP / 100} %` : alt;
    console.log(`   ${String(a.name).padEnd(22)} ${alt.padStart(6)}  →  ${neu}`);
  }
  if (ECHT && zuSetzen.length) {
    await sqlPool`
      UPDATE fiaon_agents SET commission_rate_bp = ${ZIEL_BP}
       WHERE id = ANY(${zuSetzen.map((a) => Number(a.id))})`;
    console.log(`   ${zuSetzen.length} Sätze auf ${ZIEL_BP / 100} % gesetzt.\n`);
  } else {
    console.log(`   (Probelauf — ${zuSetzen.length} Sätze würden gesetzt)\n`);
  }

  // ── 2. Die neuen Eingänge ────────────────────────────────────────────────
  const alteIds = new Set(lade(ALT).map((z) => z["TransferWise ID"]));
  const ein = lade(NEU).filter((z) => !alteIds.has(z["TransferWise ID"]) && Number(z.Amount) > 0);

  type Fall = {
    twId: string; datum: string; betragCents: number; zahler: string; ref: string;
    agentId: number | null; agent: string; rateBp: number;
    aktenRef: string | null; paket: string | null; kunde: string; art: string;
  };
  const faelle: Fall[] = [];
  const ohne: string[] = [];

  for (const z of ein) {
    const refRoh = String(z["Payment Reference"] || "").toUpperCase();
    // Zwei Muster: mit „FIAON" davor und ohne — manche tippen nur den Kern.
    const kern = (refRoh.match(/FIAON-?[A-Z0-9]{6,}/) || [])[0]?.replace(/^FIAON-?/, "")
      || (refRoh.match(/\b[A-Z0-9]{6,10}\b/) || [])[0] || null;
    const betragCents = Math.round(Number(z.Amount) * 100);
    let t: any = null;

    if (kern) {
      const [exakt] = (await sqlPool`
        SELECT a.ref, a.pack_name, a.merged_into, p.id AS person_id,
               p.first_name, p.last_name, p.assigned_agent_id,
               ag.name AS agent, ag.commission_rate_bp, 'exakt' AS art
          FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
         WHERE (UPPER(a.payment_reference) LIKE ${"%" + kern + "%"} OR UPPER(a.ref) LIKE ${"%" + kern + "%"})
         ORDER BY (a.merged_into IS NOT NULL), a.created_at DESC LIMIT 1`) as any[];
      t = exakt ?? null;
      // Ein Zeichen daneben — der klassische Abtippfehler des Kunden.
      if (!t && kern.length >= 6) {
        const [tipp] = (await sqlPool`
          SELECT a.ref, a.pack_name, a.merged_into, p.id AS person_id,
                 p.first_name, p.last_name, p.assigned_agent_id,
                 ag.name AS agent, ag.commission_rate_bp, 'tippfehler' AS art
            FROM fiaon_applications a
            LEFT JOIN fiaon_persons p ON p.id = a.person_id
            LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
           WHERE levenshtein(UPPER(REPLACE(COALESCE(a.payment_reference,''),'FIAON-','')), ${kern}) = 1
           ORDER BY a.created_at DESC LIMIT 1`) as any[];
        t = tipp ?? null;
      }
      // Zusammengeführte Akte: der Zahlung folgt die Akte, in die sie ging.
      if (t?.merged_into) {
        const [ziel] = (await sqlPool`
          SELECT a.ref, a.pack_name, p.id AS person_id, p.first_name, p.last_name,
                 p.assigned_agent_id, ag.name AS agent, ag.commission_rate_bp,
                 'zusammengefuehrt' AS art
            FROM fiaon_applications a
            LEFT JOIN fiaon_persons p ON p.id = a.person_id
            LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
           WHERE a.ref = ${t.merged_into}`) as any[];
        if (ziel) t = ziel;
      }
    }

    if (!t?.assigned_agent_id) {
      ohne.push(`   ${z.Date}  ${Number(z.Amount).toFixed(2).padStart(7)}  ${(z["Payer Name"] || "—").slice(0, 34)}  ${refRoh.slice(0, 22)}`);
      continue;
    }
    // Der Satz kommt frisch aus der Datenbank — nach dem Richtigstellen oben.
    const [ag] = (await sqlPool`SELECT commission_rate_bp FROM fiaon_agents WHERE id = ${t.assigned_agent_id}`) as any[];
    const rateBp = Number(ag?.commission_rate_bp ?? 0);
    faelle.push({
      twId: z["TransferWise ID"], datum: z.Date, betragCents,
      zahler: z["Payer Name"] || "—", ref: refRoh,
      agentId: Number(t.assigned_agent_id), agent: t.agent || "—", rateBp,
      aktenRef: t.ref ?? null, paket: t.pack_name ?? null,
      kunde: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(), art: t.art,
    });
  }

  // ── 3. Buchen, ohne doppelt zu buchen ───────────────────────────────────
  console.log("── BUCHUNGEN ──");
  const jeAgent = new Map<string, { anz: number; basis: number; prov: number }>();
  let neuGebucht = 0, schonDa = 0;

  for (const f of faelle) {
    const marke = `KA-${f.twId}`;
    const [doppelt] = (await sqlPool`
      SELECT id FROM fiaon_commissions WHERE note LIKE ${"%" + marke + "%"} LIMIT 1`) as any[];
    const provCents = Math.round(f.betragCents * f.rateBp / 10000);
    const e = jeAgent.get(f.agent) ?? { anz: 0, basis: 0, prov: 0 };
    e.anz++; e.basis += f.betragCents; e.prov += provCents;
    jeAgent.set(f.agent, e);

    if (doppelt) { schonDa++; continue; }
    if (ECHT) {
      await sqlPool`
        INSERT INTO fiaon_commissions
          (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp,
           amount_cents, status, kind, note)
        VALUES (${f.agentId}, ${f.aktenRef}, ${f.ref}, ${f.paket},
                ${f.betragCents}, ${f.rateBp}, ${provCents}, 'bestaetigt', 'own',
                ${`Kontoauszug 26.08.2026 · ${marke} · Zahlung ${f.zahler} vom ${f.datum} · Zuordnung: ${f.art}`})`;
    }
    neuGebucht++;
  }

  for (const [name, e] of [...jeAgent.entries()].sort((a, b) => b[1].prov - a[1].prov)) {
    console.log(`   ${name.padEnd(22)} ${String(e.anz).padStart(2)} Zahlungen · ${eur(e.basis).padStart(9)} EUR · Provision ${eur(e.prov).padStart(8)} EUR`);
  }
  const summe = [...jeAgent.values()].reduce((s, e) => s + e.prov, 0);
  const basisSumme = [...jeAgent.values()].reduce((s, e) => s + e.basis, 0);
  console.log(`   ${"".padEnd(22)} ${String(faelle.length).padStart(2)} gesamt   · ${eur(basisSumme).padStart(9)} EUR · Provision ${eur(summe).padStart(8)} EUR`);
  console.log(`\n   ${ECHT ? "gebucht" : "wären zu buchen"}: ${neuGebucht}   bereits vorhanden: ${schonDa}`);

  if (ohne.length) {
    console.log("\n── OHNE ZUORDNUNG (nicht gebucht) ──");
    ohne.forEach((l) => console.log(l));
  }
  if (!ECHT) console.log("\nProbelauf. Mit --buchen wird wirklich gebucht.");
  await sqlPool.end();
})();
