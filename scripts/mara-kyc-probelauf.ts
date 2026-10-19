// ═══════════════════════════════════════════════════════════════════════════
// MARA FORDERT KYC NACH / UNTERLAGEN UMHÄNGEN — PROBELAUF NACHRECHNEN, NUR LESEND (E-406 B2, 19.10.2026)
//
// Dieselben Regeln wie der Plattform-Takt (shared/fiaon-kyc-nachfordern.ts, shared/fiaon-unterlagen-vorpruefung.ts),
// ohne Datenbank: Das Skript druckt die Abfrage; gelesen wird mit dem Nur-Lese-Werkzeug (ro.mjs, READ ONLY,
// Zeitlimit) — dann zählt es je Urteil. Die grobe Vorauswahl („fehlt ganz“ / „neu angefordert“) — die
// Kundensicht (unterlagenStand) rechnet erst der Takt je Mensch.
//
//   npx tsx scripts/mara-kyc-probelauf.ts --sql kyc > k.sql          (vor der ersten Bitte: --ohne-protokoll)
//   node ~/Developer/it-rettung/werkzeuge/ro.mjs k.sql kompakt > k.json
//   npx tsx scripts/mara-kyc-probelauf.ts --zaehlen k.json [--jetzt 2026-10-20T08:00:00Z]
//
// Schreibt nichts, nirgends. Produktion wird nie per Skript beschrieben.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import { kycKandidatenSql } from "../server/lib/fiaon-mara-kyc";
import { globalKundeSql } from "../server/lib/fiaon-global-kunde";
import { kycUrteil, type KycArt } from "../shared/fiaon-kyc-nachfordern";

const arg = process.argv.slice(2);
if (arg[0] === "--sql" && arg[1] === "kyc") {
  let sql = kycKandidatenSql();
  // Vor dem ersten Lauf gibt es das Protokoll noch nicht — dann ist es leer.
  if (arg.includes("--ohne-protokoll")) {
    sql = sql.replace(/FROM fiaon_mara_kyc (m2?)\b/g, "FROM (SELECT NULL::bigint AS person_id, NULL::timestamptz AS am, NULL::text AS ergebnis WHERE FALSE) $1");
  }
  process.stdout.write(`SELECT x.*, ${globalKundeSql("x.person_id")} AS global FROM (${sql}) x;\n`);
} else if (arg[0] === "--zaehlen") {
  const zeilen = JSON.parse(fs.readFileSync(arg[1], "utf8")) as any[];
  const i = arg.indexOf("--jetzt");
  const jetzt = i > 0 ? new Date(arg[i + 1]) : new Date();
  const je: Record<string, number> = {};
  let vorauswahl = 0, ausweis = 0, konto = 0;
  for (const z of zeilen) {
    const fehlt: KycArt[] = [];
    if (z.ausweis_fehlt || z.ausweis_neu) fehlt.push("ausweis");
    if (z.konto_fehlt || z.konto_neu) fehlt.push("kontoauszug");
    if (!fehlt.length) continue;
    vorauswahl++;
    if (fehlt.includes("ausweis")) ausweis++;
    if (fehlt.includes("kontoauszug")) konto++;
    const u = kycUrteil({
      personDa: true, vertragLaeuft: true, testkonto: !!z.test, globalKunde: !!z.global, gesperrt: !!z.gesperrt,
      kuendigungOffen: !!z.kuendigung_offen, hatEmail: !!z.hat_email, auswertungAblauf: !!z.auswertung, fehlt,
      bezahltAm: z.bezahlt_am, maraGesendet: Number(z.mara_gesendet || 0), maraFehlversuche: Number(z.mara_fehl || 0),
      letzteBitteAm: z.letzte_bitte, letzterVersuchAm: z.letzter_versuch, letzteMailAm: z.letzte_mail,
    }, jetzt);
    const k = u.art === "senden" ? "senden" : `${u.art}: ${(u as any).grund}`;
    je[k] = (je[k] ?? 0) + 1;
  }
  console.log(JSON.stringify({ laufendePrivatPakete: zeilen.length, vorauswahl, ausweisFehlt: ausweis, kontoauszugFehlt: konto, jeUrteil: je, jetzt: jetzt.toISOString() }, null, 1));
} else {
  console.error("--sql kyc [--ohne-protokoll] | --zaehlen <k.json> [--jetzt <ISO>]");
  process.exit(2);
}
