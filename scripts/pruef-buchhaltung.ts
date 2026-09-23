// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND BUCHHALTUNG (E-227)
//
// Spielt die ganze Kette gegen einen LAUFENDEN Server durch: Anmeldung in zwei
// Schritten, Zahlungsauftrag anlegen → einreichen → freigeben → ausführen,
// Kassenbuch, Bankabgleich, Übergabe, Papiere, Protokoll.
//
//   npx tsx scripts/pruef-buchhaltung.ts
//
// LÄUFT NUR GEGEN DEN LOKALEN PRÜFSTAND. Das Skript legt Aufträge an, bucht
// Geld und setzt ein Passwort — gegen Produktion wäre das eine Katastrophe,
// deshalb bricht es bei jeder anderen Datenbank sofort ab.
//
// Voraussetzung: Server auf PRUEF_BASIS (Vorgabe http://127.0.0.1:5199) mit
// SESSION_SECRET=pruefstand-sitzung und DATABASE_URL auf die Struktur-Kopie
// (siehe Gedächtnis „Lokaler Prüfstand"). Der PIN wird hier direkt in der
// Datenbank erzeugt, weil der Mailversand auf dem Prüfstand abgeklemmt ist.
// ═══════════════════════════════════════════════════════════════════════════

import postgres from "postgres";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const BASIS = `${process.env.PRUEF_BASIS ?? "http://127.0.0.1:5199"}/api/fiaon`;
const SECRET = process.env.SESSION_SECRET ?? "pruefstand-sitzung";
const DB = process.env.DATABASE_URL ?? "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand";
const PW = "pruefstand-buch-2026";

if (!/127\.0\.0\.1|localhost/.test(DB) || !/pruef/i.test(DB)) {
  console.error("ABBRUCH: Dieses Skript schreibt Geldbuchungen. Es läuft nur gegen die lokale Prüfstand-Datenbank.");
  process.exit(1);
}

const sql = postgres(DB, { ssl: "require", max: 3 });

let kekse = "";
function merken(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const kv = c.split(";")[0];
    const k = kv.split("=")[0];
    kekse = kekse.split("; ").filter((x) => x && !x.startsWith(`${k}=`)).concat(kv).join("; ");
  }
}

async function ruf(pfad: string, koerper?: unknown, methode?: string): Promise<{ status: number; j: any }> {
  const res = await fetch(`${BASIS}${pfad}`, {
    method: methode ?? (koerper === undefined ? "GET" : "POST"),
    headers: { ...(koerper !== undefined ? { "Content-Type": "application/json" } : {}), Cookie: kekse },
    body: koerper !== undefined ? JSON.stringify(koerper) : undefined,
  });
  merken(res);
  const t = await res.text();
  let j: any; try { j = JSON.parse(t); } catch { j = { roh: t.slice(0, 200) }; }
  return { status: res.status, j };
}

const gruen: string[] = [];
const rot: string[] = [];
function pruefe(name: string, ok: boolean, info = ""): void {
  (ok ? gruen : rot).push(name);
  console.log(`${ok ? "\x1b[32mok  \x1b[0m" : "\x1b[31mROT \x1b[0m"} ${name}${info ? ` — ${info}` : ""}`);
}

// PIN wie server/lib/fiaon-buchhaltung.ts — Alphabet und Hash müssen gleich bleiben.
const PIN_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const pinHash = (pin: string) => createHash("sha256").update(`${SECRET}:${pin.replace(/-/g, "").toUpperCase()}`).digest("hex");

async function pinFuer(person: string): Promise<string> {
  const b = randomBytes(12);
  let o = "";
  for (let i = 0; i < 12; i++) o += PIN_ALPHABET[b[i] % PIN_ALPHABET.length];
  const pin = `${o.slice(0, 4)}-${o.slice(4, 8)}-${o.slice(8, 12)}`;
  await sql`UPDATE fiaon_buch_pin SET benutzt_am = NOW() WHERE person = ${person} AND benutzt_am IS NULL`;
  await sql`INSERT INTO fiaon_buch_pin (person, pin_hash, gueltig_bis) VALUES (${person}, ${pinHash(pin)}, NOW() + INTERVAL '10 minutes')`;
  return pin;
}

async function anmelden(person: string): Promise<any> {
  kekse = "";
  const a = await ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: PW });
  if (a.status !== 200) throw new Error(`Passwort abgelehnt: ${JSON.stringify(a.j)}`);
  const p = await ruf("/buchhaltung/pin-pruefen", { email: person, pin: await pinFuer(person) });
  if (p.status !== 200) throw new Error(`PIN abgelehnt: ${JSON.stringify(p.j)}`);
  return p.j.ich;
}

const istPdf = async (pfad: string): Promise<{ ok: boolean; groesse: number; text: string }> => {
  const r = await fetch(`${BASIS}${pfad}`, { headers: { Cookie: kekse } });
  const b = Buffer.from(await r.arrayBuffer());
  return { ok: r.status === 200 && b.subarray(0, 4).toString() === "%PDF", groesse: b.length, text: b.toString("latin1") };
};

async function lauf(): Promise<void> {
  await ruf("/buchhaltung/status");           // legt das Schema an
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_passwort_hash', ${await bcrypt.hash(PW, 10)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  await sql`DELETE FROM fiaon_buch_auftrag`;
  await sql`DELETE FROM fiaon_buch_bewegung`;
  await sql`DELETE FROM fiaon_settings WHERE key IN ('buchhaltung_anfangsbestand','buchhaltung_bankabgleich','buchhaltung_uebergabe')`;

  // ── Türen ──────────────────────────────────────────────────────────────
  kekse = "";
  pruefe("Ohne Anmeldung keine Lage", (await ruf("/buchhaltung/lage")).status === 401);
  pruefe("Falsches Passwort abgewiesen",
    (await ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: "falsch" })).status === 401);
  kekse = "";
  pruefe("PIN ohne Passwort-Schritt abgewiesen",
    (await ruf("/buchhaltung/pin-anfordern", { email: "florentine@fiaon.com" })).status === 401);

  const flo = await anmelden("florentine@fiaon.com");
  pruefe("Buchhaltung angemeldet", flo?.rolle === "buchhaltung", flo?.name);
  pruefe("Buchhaltung darf keinen Anfangsbestand setzen",
    (await ruf("/buchhaltung/anfangsbestand", { betrag: "100", am: "2026-09-01" })).status === 403);

  // ── Auftrag ────────────────────────────────────────────────────────────
  const kaputt = await ruf("/buchhaltung/auftrag", { empfaenger: "Test", iban: "DE86202208000047719325", betrag: "10", zweck: "x" });
  pruefe("IBAN mit falscher Prüfziffer abgewiesen", kaputt.status === 400, kaputt.j?.error);

  const neu = await ruf("/buchhaltung/auftrag", {
    empfaenger: "Musterdienst GmbH", iban: "DE89370400440532013000", bic: "COBADEFFXXX",
    betrag: "1.234,56", zweck: "Rechnung 2026-114", kategorie: "Dienstleister",
  });
  const id = neu.j?.auftrag?.id;
  pruefe("Auftrag angelegt", neu.status === 200 && neu.j?.auftrag?.status === "entwurf", neu.j?.auftrag?.nummer);
  pruefe("Deutsches Betragsformat gelesen", neu.j?.auftrag?.betragCents === 123456);
  pruefe("Eingereicht", (await ruf(`/buchhaltung/auftrag/${id}/einreichen`, {})).j?.auftrag?.status === "eingereicht");
  pruefe("Buchhaltung darf nicht freigeben", (await ruf(`/buchhaltung/auftrag/${id}/entscheiden`, { frei: true })).status === 403);
  pruefe("Ausführen vor Freigabe abgewiesen", (await ruf(`/buchhaltung/auftrag/${id}/ausfuehren`, { bankReferenz: "X1" })).status === 400);

  // ── Inhaber ────────────────────────────────────────────────────────────
  const js = await anmelden("js@fiaon.com");
  pruefe("Inhaber angemeldet", js?.rolle === "inhaber");
  const anf = await ruf("/buchhaltung/anfangsbestand", { betrag: "735,81", am: "2026-09-07", notiz: "Kontoauszug" });
  pruefe("Anfangsbestand gesetzt", anf.j?.kasse?.anfang?.cents === 73581);

  const eigen = await ruf("/buchhaltung/auftrag", { empfaenger: "Eigen", iban: "DE89370400440532013000", betrag: "5", zweck: "eigen" });
  await ruf(`/buchhaltung/auftrag/${eigen.j.auftrag.id}/einreichen`, {});
  const selbst = await ruf(`/buchhaltung/auftrag/${eigen.j.auftrag.id}/entscheiden`, { frei: true });
  pruefe("Vier Augen: eigener Auftrag nicht freigebbar", selbst.status === 400 && /Vier Augen/.test(selbst.j?.error || ""));
  pruefe("Ablehnung ohne Grund abgewiesen", (await ruf(`/buchhaltung/auftrag/${id}/entscheiden`, { frei: false })).status === 400);
  pruefe("Freigegeben", (await ruf(`/buchhaltung/auftrag/${id}/entscheiden`, { frei: true, notiz: "geprüft" })).j?.auftrag?.status === "freigegeben");
  pruefe("Ausführen ohne Bankreferenz abgewiesen", (await ruf(`/buchhaltung/auftrag/${id}/ausfuehren`, { bankReferenz: "" })).status === 400);

  const vorher = (await ruf("/buchhaltung/lage")).j.kasse.bestandCents;
  const aus = await ruf(`/buchhaltung/auftrag/${id}/ausfuehren`, { bankReferenz: "AWX-99213", wertAm: "2026-09-23" });
  pruefe("Ausgeführt", aus.j?.auftrag?.status === "ausgefuehrt");
  pruefe("Bestand um den Betrag gesunken", aus.j?.kasse?.bestandCents === vorher - 123456, `${vorher} → ${aus.j?.kasse?.bestandCents}`);
  pruefe("Keine Doppelbuchung", (await ruf(`/buchhaltung/auftrag/${id}/ausfuehren`, { bankReferenz: "AWX-99213" })).status === 400);

  const best = await istPdf(`/buchhaltung/auftrag/${id}/bestaetigung.pdf`);
  pruefe("Zahlungsbestätigung ist ein PDF", best.ok, `${best.groesse} Bytes`);

  // ── Kasse ──────────────────────────────────────────────────────────────
  const einlage = await ruf("/buchhaltung/bewegung", {
    art: "einlage", betrag: "10.000,00", wertAm: "2026-09-20", zweck: "Einlage", gegenpartei: "Inhaber",
  });
  pruefe("Einlage gebucht", einlage.j?.kasse?.bestandCents === aus.j.kasse.bestandCents + 1000000);
  const abg = await ruf("/buchhaltung/abgleich", { betrag: "9.000,00", am: "2026-09-23" });
  pruefe("Bankabgleich nennt die Differenz", abg.j?.kasse?.differenzCents === 900000 - einlage.j.kasse.bestandCents,
    `${abg.j?.kasse?.differenzCents} Cent`);

  // ── Übergabe und Papiere ───────────────────────────────────────────────
  await ruf("/buchhaltung/uebergabe", { bisher: "Prüfstand", stichtag: "2026-09-24" });
  pruefe("Inhaber bestätigt die Übernahme nicht für andere", (await ruf("/buchhaltung/uebergabe/bestaetigen", {})).status === 403);
  await anmelden("florentine@fiaon.com");
  pruefe("Übernahme bestätigt", !!(await ruf("/buchhaltung/uebergabe/bestaetigen", {})).j?.uebergabe?.bestaetigtVon);

  const verm = await istPdf("/buchhaltung/uebergabe.pdf");
  pruefe("Übergabevermerk ist ein PDF", verm.ok, `${verm.groesse} Bytes`);
  const zug = await istPdf("/buchhaltung/zugang.pdf");
  pruefe("Zugangsblatt ist ein PDF", zug.ok, `${zug.groesse} Bytes`);
  pruefe("Kein Passwort im Zugangsblatt", !zug.text.includes(PW));

  // ── Protokoll ──────────────────────────────────────────────────────────
  const zeilen = (await ruf("/buchhaltung/protokoll")).j?.zeilen ?? [];
  pruefe("Protokoll nennt Person und Handlung",
    zeilen.some((z: any) => z.aktion === "Auftrag freigegeben" && z.person === "js@fiaon.com")
    && zeilen.some((z: any) => z.aktion === "Auftrag angelegt" && z.person === "florentine@fiaon.com"),
    `${zeilen.length} Zeilen`);

  await ruf("/buchhaltung/abmelden", {});
  pruefe("Nach dem Abmelden ist die Tür zu", (await ruf("/buchhaltung/lage")).status === 401);
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
