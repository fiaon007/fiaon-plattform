// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND AUSZAHLUNG ÜBER DIE BUCHHALTUNG (13.10.2026)
//
// Spielt den ganzen Weg gegen einen LAUFENDEN lokalen Server durch:
//   Inhaber schickt zur Freigabe → Mail an die Geschäftsführung mit TAN und Link → sie gibt mit der TAN frei →
//   Auftrag mit Bestätigungslink an die Buchhaltung, Freigabebestätigung an sie → die Buchhaltung bestätigt die
//   SEPA-Überweisung → erst JETZT ausgebucht (Auszahlung + Provisionszeilen) → Durchführungsbeleg an die
//   Geschäftsführung. Dazu die Sperren: keine Ausführung am Link vorbei, kein zweites Bestätigen, kein
//   Bestätigungslink bei der Geschäftsführung, „Alle“ schickt Abgelehntes nicht erneut.
//
//   PRUEF_BASIS=http://127.0.0.1:5292 DATABASE_URL=…/fiaon_pruefstand_auszahlung \
//   BANKING_MAIL_PROBE=<Ordner des Servers> npx tsx scripts/pruef-auszahlung-buchhaltung.ts
//
// LÄUFT NUR GEGEN DEN LOKALEN PRÜFSTAND — der Server muss mit BANKING_MAIL_PROBE laufen (Mails als Dateien).
// Die TAN liest das Skript aus der abgelegten Mail, wie Florentine sie lesen würde.
// ═══════════════════════════════════════════════════════════════════════════

import postgres from "postgres";
import bcrypt from "bcryptjs";
import { createCipheriv, createHash, randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "fs";
import { join } from "path";

const BASIS = `${process.env.PRUEF_BASIS ?? "http://127.0.0.1:5292"}/api/fiaon`;
const HERKUNFT = process.env.PRUEF_BASIS ?? "http://127.0.0.1:5292";
const SECRET = process.env.SESSION_SECRET ?? "pruefstand-sitzung";
const DB = process.env.DATABASE_URL ?? "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_auszahlung";
const PROBE = process.env.BANKING_MAIL_PROBE ?? "/Users/Justin/Developer/it-rettung/chef-glas/mail-probe-auszahlung";
const PW = "pruefstand-buch-2026";
const GF = "florentine@fiaon.com";
const JS = "js@fiaon.com";
const EXTERN = "buchhaltung@schwarzott-global.com";

if (!/127\.0\.0\.1|localhost/.test(DB) || !/pruef/i.test(DB)) {
  console.error("ABBRUCH: Dieses Skript schreibt Geldbuchungen. Es läuft nur gegen die lokale Prüfstand-Datenbank.");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(BASIS)) {
  console.error("ABBRUCH: Nur gegen einen lokalen Server.");
  process.exit(1);
}
const sql = postgres(DB, { ssl: "require", max: 3 });

class Sitzung {
  kekse = "";
  merken(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const kv = c.split(";")[0];
      const k = kv.split("=")[0];
      this.kekse = this.kekse.split("; ").filter((x) => x && !x.startsWith(`${k}=`)).concat(/=$/.test(kv) ? [] : [kv]).join("; ");
    }
  }
  async ruf(pfad: string, koerper?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; j: any; roh: Buffer }> {
    const res = await fetch(`${BASIS}${pfad}`, {
      method: koerper === undefined ? "GET" : "POST",
      headers: { ...(koerper !== undefined ? { "Content-Type": "application/json", Origin: HERKUNFT } : {}), Cookie: this.kekse, ...extra },
      body: koerper !== undefined ? JSON.stringify(koerper) : undefined,
    });
    this.merken(res);
    const roh = Buffer.from(await res.arrayBuffer());
    let j: any; try { j = JSON.parse(roh.toString("utf8")); } catch { j = null; }
    return { status: res.status, j, roh };
  }
}

const gruen: string[] = [];
const rot: string[] = [];
function pruefe(name: string, ok: boolean, info = ""): void {
  (ok ? gruen : rot).push(name);
  console.log(`${ok ? "\x1b[32mok  \x1b[0m" : "\x1b[31mROT \x1b[0m"} ${name}${info ? ` — ${info}` : ""}`);
}

const PIN_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const pinHash = (pin: string) => createHash("sha256").update(`${SECRET}:${pin.replace(/-/g, "").toUpperCase()}`).digest("hex");
function verschluesseln(klar: string): string {
  const key = createHash("sha256").update(`${SECRET}:fiaon-bank-v1`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const d = Buffer.concat([c.update(klar, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${d.toString("base64")}`;
}
async function pinFuer(person: string): Promise<string> {
  const b = randomBytes(12);
  let o = "";
  for (let i = 0; i < 12; i++) o += PIN_ALPHABET[b[i] % PIN_ALPHABET.length];
  await sql`UPDATE fiaon_buch_pin SET benutzt_am = NOW() WHERE person = ${person} AND benutzt_am IS NULL`;
  await sql`INSERT INTO fiaon_buch_pin (person, pin_hash, gueltig_bis) VALUES (${person}, ${pinHash(o)}, NOW() + INTERVAL '10 minutes')`;
  return `${o.slice(0, 4)}-${o.slice(4, 8)}-${o.slice(8)}`;
}
async function anmelden(person: string): Promise<Sitzung> {
  const s = new Sitzung();
  const a = await s.ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: PW });
  if (a.status !== 200) throw new Error(`Passwort abgelehnt: ${JSON.stringify(a.j)}`);
  const p = await s.ruf("/buchhaltung/pin-pruefen", { email: person, pin: await pinFuer(person) });
  if (p.status !== 200) throw new Error(`PIN abgelehnt: ${JSON.stringify(p.j)}`);
  return s;
}

// ── Die abgelegten Mails ────────────────────────────────────────────────────
interface Mail { datei: string; an: string; betreff: string; text: string; anhaenge: string[] }
function mails(): Mail[] {
  if (!existsSync(PROBE)) return [];
  const alle = readdirSync(PROBE);
  return alle.filter((d) => d.endsWith(".txt")).sort().map((d) => {
    const roh = readFileSync(join(PROBE, d), "utf8");
    const stamm = d.replace(/\.txt$/, "");
    return {
      datei: d,
      an: (roh.match(/^An: (.*)$/m) || [])[1] ?? "",
      betreff: (roh.match(/^Betreff: (.*)$/m) || [])[1] ?? "",
      text: roh.split("\n\n").slice(1).join("\n\n"),
      anhaenge: alle.filter((x) => x.startsWith(`${stamm}-`)).map((x) => join(PROBE, x)),
    };
  });
}
const letzte = (an: string, betreff: RegExp) => mails().filter((m) => m.an === an && betreff.test(m.betreff)).pop() ?? null;
const tanAus = (m: Mail | null) => ((m?.text.match(/TAN\s+(\d{3}) (\d{3})/) || []).slice(1).join("")) || "";
const tokenAus = (m: Mail | null) => (m?.text.match(/\/auszahlung-ausfuehren\/([A-Za-z0-9_-]+)/) || [])[1] ?? "";
const istPdf = (b: Buffer) => b.subarray(0, 4).toString() === "%PDF";
const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const morgen = () => new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function auszahlungAnlegen(agentId: number, cents: number, iban: string, posten: { kind: string; cents: number; note?: string }[]): Promise<number> {
  const [po] = (await sql`
    INSERT INTO fiaon_payouts (agent_id, amount_cents, status, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked, requested_at)
    VALUES (${agentId}, ${cents}, 'angefordert', ${verschluesseln("Paula Prüfstand")}, ${verschluesseln(iban)},
            ${verschluesseln("COBADEFFXXX")}, ${`${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`}, NOW())
    RETURNING id`) as any[];
  for (const [i, p] of posten.entries()) {
    await sql`
      INSERT INTO fiaon_commissions (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, payout_id, kind, note)
      VALUES (${agentId}, ${`PRUEF-AZ-${po.id}-${i}`}, ${"FIAON Plus"}, ${p.cents * 5}, 2000, ${p.cents}, 'in_auszahlung', ${po.id}, ${p.kind}, ${p.note ?? null})`;
  }
  return Number(po.id);
}

async function lauf(): Promise<void> {
  if (existsSync(PROBE)) rmSync(PROBE, { recursive: true, force: true });
  const leer = new Sitzung();
  await leer.ruf("/buchhaltung/status"); // Schema
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_passwort_hash', ${await bcrypt.hash(PW, 10)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  for (const t of ["fiaon_buch_auftrag", "fiaon_buch_bewegung", "fiaon_buch_tan", "fiaon_buch_sitzung"]) await sql.unsafe(`DELETE FROM ${t}`).catch(() => null);
  await sql`DELETE FROM fiaon_settings WHERE key IN ('buchhaltung_sperre')`;
  await sql`DELETE FROM fiaon_commissions WHERE ref LIKE 'PRUEF-AZ-%'`;
  await sql`DELETE FROM fiaon_payouts WHERE status = 'angefordert'`;

  let [ag] = (await sql`SELECT id FROM fiaon_agents WHERE email = 'paula.pruefstand@fiaon.test' LIMIT 1`) as any[];
  if (!ag) [ag] = (await sql`INSERT INTO fiaon_agents (name, email) VALUES ('Paula Prüfstand', 'paula.pruefstand@fiaon.test') RETURNING id`) as any[];
  const IBAN = "DE89370400440532013000";
  const p1 = await auszahlungAnlegen(ag.id, 42350, IBAN, [
    { kind: "own", cents: 29900, note: "Abschluss FIAON Plus · Kunde K-1043" }, { kind: "team", cents: 7450 }, { kind: "praemie", cents: 5000, note: "Wochenprämie KW 41" },
  ]);
  const p2 = await auszahlungAnlegen(ag.id, 100000, IBAN, [{ kind: "gehalt", cents: 100000, note: "Festgehalt Oktober" }]);
  const p3 = await auszahlungAnlegen(ag.id, 12000, IBAN, [{ kind: "own", cents: 12000 }]);
  const p4 = await auszahlungAnlegen(ag.id, 8800, IBAN, [{ kind: "own", cents: 8800 }]);

  const flo = await anmelden(GF);
  const js = await anmelden(JS);

  // ── 1. Nur der Inhaber schickt zur Freigabe ────────────────────────────
  pruefe("Geschäftsführung kann nicht selbst zur Freigabe schicken", (await flo.ruf(`/buchhaltung/auszahlung/${p1}/zur-freigabe`, {})).status === 403);
  const z1 = await js.ruf(`/buchhaltung/auszahlung/${p1}/zur-freigabe`, {});
  const a1 = z1.j?.auftrag;
  pruefe("Auftrag entsteht im Namen des Inhabers, eingereicht, über die Buchhaltung",
    z1.status === 200 && a1?.status === "eingereicht" && a1?.erstelltVon === JS && a1?.ausfuehrungExtern === EXTERN, a1?.nummer);
  pruefe("Freigabe-Mail ist raus", z1.j?.mail === true && !!a1?.freigabeMailAm);
  const m1 = letzte(GF, /^Bitte freigeben: /);
  pruefe("Mail an Florentine: „Bitte geben Sie folgende Auszahlung frei“",
    !!m1 && m1.text.includes("bitte geben Sie folgende Auszahlung frei:") && m1.betreff.includes(a1.nummer), m1?.betreff);
  pruefe("Mail nennt Betrag, Empfänger, maskierte IBAN und den Link mit Auftrag",
    !!m1 && m1.text.includes("423,50") && m1.text.includes("Paula Prüfstand") && m1.text.includes("•••• 3000")
      && !m1.text.includes(IBAN) && m1.text.includes(`/buchhaltung?reiter=auftraege&auftrag=${a1.id}`));
  const tan1 = tanAus(m1);
  pruefe("Mail enthält eine sechsstellige TAN", /^\d{6}$/.test(tan1));
  pruefe("Kein Bestätigungslink in Florentines Mail", !!m1 && !/auszahlung-ausfuehren/.test(m1.text));

  // ── 2. Freigabe mit der TAN aus der Mail ───────────────────────────────
  const lage = await flo.ruf("/buchhaltung/lage");
  const sichtbar = (lage.j?.auftraege ?? []).find((x: any) => x.id === a1.id);
  pruefe("Florentine sieht den Auftrag im Banking", !!sichtbar && sichtbar.ausfuehrungExtern === EXTERN);
  const falsch = await flo.ruf(`/buchhaltung/auftrag/${a1.id}/freigeben`, { tan: tan1 === "123456" ? "654321" : "123456" });
  pruefe("Falsche TAN abgewiesen", falsch.status === 400, falsch.j?.error);
  pruefe("Inhaber führt am Link vorbei nicht aus (noch nicht freigegeben)", (await js.ruf(`/buchhaltung/auftrag/${a1.id}/ausfuehren`, { bankReferenz: "X" })).status === 400);
  const fr = await flo.ruf(`/buchhaltung/auftrag/${a1.id}/freigeben`, { tan: tan1 });
  pruefe("Florentine gibt mit der TAN aus der Mail frei (vier Augen)",
    fr.status === 200 && fr.j?.auftrag?.status === "freigegeben" && fr.j?.auftrag?.freigabeArt === "vier_augen" && fr.j?.auftrag?.entschiedenVon === GF, fr.j?.error);
  pruefe("Bankreferenz steht mit der Freigabe fest", !!fr.j?.auftrag?.bankReferenz, fr.j?.auftrag?.bankReferenz);
  pruefe("TAN gilt nur einmal", (await flo.ruf(`/buchhaltung/auftrag/${a1.id}/freigeben`, { tan: tan1 })).status === 400);
  const [vorAus] = (await sql`SELECT status FROM fiaon_payouts WHERE id = ${p1}`) as any[];
  pruefe("Nach der Freigabe ist NICHTS ausgebucht", vorAus?.status === "angefordert");

  const mB = letzte(EXTERN, /^Zahlungsauftrag /);
  const token = tokenAus(mB);
  pruefe("Auftrag an buchhaltung@schwarzott-global.com mit allen Details",
    !!mB && mB.text.includes("DE89 3704 0044 0532 0130 00") && mB.text.includes("COBADEFFXXX") && mB.text.includes("423,50 EUR")
      && mB.text.includes(`Ref ${fr.j?.auftrag?.bankReferenz}`) && /Freigegeben\s+Florentine/.test(mB.text), mB?.betreff);
  pruefe("Bestätigungslink an die Buchhaltung", token.length >= 30);
  await warte(600);
  const mF = letzte(GF, /^Freigabe bestätigt: /);
  pruefe("Freigabebestätigung an Florentine", !!mF && mF.text.includes(EXTERN) && !/auszahlung-ausfuehren/.test(mF.text));
  pruefe("Inhaber trägt Buchhaltungs-Aufträge nicht selbst als ausgeführt ein",
    (await js.ruf(`/buchhaltung/auftrag/${a1.id}/ausfuehren`, { bankReferenz: "X" })).status === 400);

  // ── 3. Die Seite der Buchhaltung ───────────────────────────────────────
  pruefe("Ungültiger Link: 404", (await leer.ruf(`/buchhaltung/extern/${"x".repeat(32)}`)).status === 404);
  const sicht = await leer.ruf(`/buchhaltung/extern/${token}`);
  const v = sicht.j?.auftrag;
  pruefe("Buchhaltung sieht volle IBAN, BIC, Betrag, Zweck mit Referenz",
    sicht.status === 200 && v?.stand === "offen" && v?.iban === "DE89 3704 0044 0532 0130 00" && v?.bic === "COBADEFFXXX"
      && v?.betragCents === 42350 && v?.verwendungszweck.includes(fr.j?.auftrag?.bankReferenz));
  pruefe("Fremde Herkunft kann nicht bestätigen",
    (await leer.ruf(`/buchhaltung/extern/${token}/bestaetigen`, { wertAm: heute() }, { Origin: "https://boese.example" })).status === 403);
  const zukunft = await leer.ruf(`/buchhaltung/extern/${token}/bestaetigen`, { wertAm: morgen() });
  pruefe("Ausführung in der Zukunft abgewiesen", zukunft.status === 400, zukunft.j?.error);
  const ok = await leer.ruf(`/buchhaltung/extern/${token}/bestaetigen`, { wertAm: heute(), notiz: "Onlinebanking Ref 77812" });
  pruefe("Buchhaltung bestätigt die SEPA-Überweisung", ok.status === 200 && ok.j?.auftrag?.stand === "bestaetigt", ok.j?.error ?? ok.j?.hinweis ?? "");

  const [po1] = (await sql`SELECT status FROM fiaon_payouts WHERE id = ${p1}`) as any[];
  const kz = (await sql`SELECT status FROM fiaon_commissions WHERE payout_id = ${p1}`) as any[];
  pruefe("Erst jetzt: Auszahlung ausgezahlt", po1?.status === "ausgezahlt");
  pruefe("Erst jetzt: alle Provisionszeilen ausgezahlt", kz.length === 3 && kz.every((k: any) => k.status === "ausgezahlt"));
  const [ab] = (await sql`
    SELECT status, ausgefuehrt_von, extern_bestaetigt_am, extern_wert_am::text AS wert, (bestaetigung_base64 IS NOT NULL) AS beleg
      FROM fiaon_buch_auftrag WHERE id = ${a1.id}`) as any[];
  pruefe("Auftrag ausgeführt durch die Buchhaltung, Beleg gespeichert",
    ab?.status === "ausgefuehrt" && ab?.ausgefuehrt_von === EXTERN && !!ab?.extern_bestaetigt_am && ab?.wert === heute() && ab?.beleg);
  const nochmal = await leer.ruf(`/buchhaltung/extern/${token}/bestaetigen`, { wertAm: heute() });
  pruefe("Zweites Bestätigen abgewiesen", nochmal.status === 400 && /Bereits bestätigt/.test(nochmal.j?.error ?? ""), nochmal.j?.error);
  pruefe("Link zeigt danach „bestätigt“", (await leer.ruf(`/buchhaltung/extern/${token}`)).j?.auftrag?.stand === "bestaetigt");

  const mD = letzte(GF, /^Ausgeführt: .*Durchführungsbeleg$/);
  pruefe("Durchführungsbeleg an Florentine", !!mD && mD.text.includes("1–3 Bankarbeitstagen") && mD.text.includes("SEPA-Überweisung"), mD?.betreff);
  const anhang = mD?.anhaenge.find((x) => x.endsWith(".pdf"));
  pruefe("Anhang ist ein PDF", !!anhang && istPdf(readFileSync(anhang)), anhang ? `${statSync(anhang).size} Bytes` : "fehlt");
  const pdf = await flo.ruf(`/buchhaltung/auftrag/${a1.id}/bestaetigung.pdf`);
  pruefe("Beleg auch im Banking abrufbar", pdf.status === 200 && istPdf(pdf.roh));
  pruefe("Beleg erneut senden (Inhaber)", (await js.ruf(`/buchhaltung/auftrag/${a1.id}/beleg-senden`, {})).status === 200);

  // ── 4. Florentines eigener Auftrag wird im Namen des Inhabers neu angelegt ─
  const eigen = await flo.ruf(`/buchhaltung/auszahlung/${p2}/anweisen`, {});
  pruefe("Florentine weist klassisch an", eigen.j?.auftrag?.status === "eingereicht" && eigen.j?.auftrag?.erstelltVon === GF);
  pruefe("Für ihren eigenen klassischen Auftrag bekommt sie keine TAN", (await flo.ruf(`/buchhaltung/auftrag/${eigen.j.auftrag.id}/tan`, {})).status === 403);
  const z2 = await js.ruf(`/buchhaltung/auszahlung/${p2}/zur-freigabe`, {});
  const [alt] = (await sql`SELECT status FROM fiaon_buch_auftrag WHERE id = ${eigen.j.auftrag.id}`) as any[];
  pruefe("Ihr Auftrag zurückgezogen, neuer im Namen des Inhabers",
    alt?.status === "zurueckgezogen" && z2.j?.auftrag?.erstelltVon === JS && z2.j?.auftrag?.id !== eigen.j.auftrag.id, z2.j?.auftrag?.nummer);

  // ── 5. Ablehnen und „Alle“ ─────────────────────────────────────────────
  const ablehnen = await flo.ruf(`/buchhaltung/auftrag/${z2.j.auftrag.id}/ablehnen`, { notiz: "Betrag prüfen" });
  pruefe("Florentine lehnt ab", ablehnen.status === 200 && ablehnen.j?.auftrag?.status === "abgelehnt", ablehnen.j?.error);
  const alle = await js.ruf("/buchhaltung/auszahlungen/alle-zur-freigabe", {});
  pruefe("„Alle offenen“ schickt die zwei übrigen",
    alle.status === 200 && alle.j?.gesendet?.length === 2 && alle.j?.ohneMail?.length === 0, JSON.stringify(alle.j));
  pruefe("Abgelehntes geht nicht stumm erneut raus",
    (alle.j?.uebersprungen ?? []).some((u: any) => u.id === p2 && /abgelehnt/.test(u.grund)));
  const alle2 = await js.ruf("/buchhaltung/auszahlungen/alle-zur-freigabe", {});
  pruefe("Zweites „Alle“ schickt nichts doppelt", alle2.j?.gesendet?.length === 0, JSON.stringify(alle2.j?.uebersprungen));
  const liste = await js.ruf("/buchhaltung/auszahlungen");
  const zeile2 = (liste.j?.auszahlungen ?? liste.j?.liste ?? []).find((x: any) => x.id === p2);
  pruefe("Liste markiert die Ablehnung", !!zeile2 && zeile2.gfAbgelehnt === true, JSON.stringify(zeile2 && { s: zeile2.status, a: zeile2.auftragStatus }));
  const tans = (await sql`SELECT zweck FROM fiaon_buch_tan WHERE person = ${GF} AND benutzt_am IS NULL AND gueltig_bis > NOW()`) as any[];
  pruefe("Je Auftrag eine eigene offene TAN (keine verdrängt die andere)", tans.length === 2 && new Set(tans.map((t: any) => t.zweck)).size === 2, tans.map((t: any) => t.zweck).join(", "));
  const m3 = mails().filter((m) => m.an === GF && /^Bitte freigeben: /.test(m.betreff)).slice(-2);
  const [a3, a4] = (await sql`SELECT id FROM fiaon_buch_auftrag WHERE payout_id IN (${p3}, ${p4}) AND status = 'eingereicht' ORDER BY payout_id`) as any[];
  const fr3 = await flo.ruf(`/buchhaltung/auftrag/${a3.id}/freigeben`, { tan: tanAus(m3.find((m) => m.text.includes(`auftrag=${a3.id}`)) ?? null) });
  const fr4 = await flo.ruf(`/buchhaltung/auftrag/${a4.id}/freigeben`, { tan: tanAus(m3.find((m) => m.text.includes(`auftrag=${a4.id}`)) ?? null) });
  pruefe("Beide TANs aus den Mails gelten unabhängig", fr3.j?.auftrag?.status === "freigegeben" && fr4.j?.auftrag?.status === "freigegeben", `${fr3.j?.error ?? ""} ${fr4.j?.error ?? ""}`);

  // ── 6. Neu senden an die Buchhaltung macht den alten Link ungültig ─────
  await warte(400);
  const tAlt = tokenAus(letzte(EXTERN, new RegExp(`^Zahlungsauftrag ${fr4.j.auftrag.nummer} `)));
  pruefe("Erneut an die Buchhaltung senden", (await js.ruf(`/buchhaltung/auftrag/${a4.id}/an-buchhaltung`, {})).status === 200);
  const tNeu = tokenAus(letzte(EXTERN, new RegExp(`^Zahlungsauftrag ${fr4.j.auftrag.nummer} `)));
  pruefe("Alter Link ungültig, neuer gilt", tAlt !== tNeu && (await leer.ruf(`/buchhaltung/extern/${tAlt}`)).status === 404 && (await leer.ruf(`/buchhaltung/extern/${tNeu}`)).status === 200);

  // Für die Sichtprüfung: Beleg und Seite liegen bereit.
  console.log(`\nBeleg: ${anhang}\nSeite offen: ${HERKUNFT}/auszahlung-ausfuehren/${tNeu}\nSeite bestätigt: ${HERKUNFT}/auszahlung-ausfuehren/${token}`);
}

lauf()
  .then(async () => {
    console.log(`\n${gruen.length} grün, ${rot.length} rot`);
    if (rot.length) process.exitCode = 1;
    await sql.end();
  })
  .catch(async (e) => {
    console.error("ABBRUCH:", e);
    await sql.end();
    process.exit(1);
  });
