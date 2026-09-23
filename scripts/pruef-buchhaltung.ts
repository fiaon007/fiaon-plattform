// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND FIAON BANKING (E-228)
//
// Spielt das Banking gegen einen LAUFENDEN Server durch: Anmeldung, Sitzungen,
// Untätigkeit, TAN-Bindung, Kontostand, Umsätze mit Saldo, Überweisung mit
// Freigabe und Ausführung, Mitarbeiter-Auszahlung über den Zahlungsverkehr,
// Empfänger-Vorschläge, Daueraufträge, alle Papiere, Sperre, Herkunftsprüfung.
//
//   npx tsx scripts/pruef-buchhaltung.ts
//
// LÄUFT NUR GEGEN DEN LOKALEN PRÜFSTAND — das Skript legt Bankzeilen,
// Auszahlungen und Buchungen an. Bei jeder anderen Datenbank bricht es ab.
// PIN und TAN erzeugt es direkt in der Datenbank (Mail ist dort abgeklemmt),
// mit derselben Rechnung wie server/lib/fiaon-buchhaltung.ts.
// ═══════════════════════════════════════════════════════════════════════════

import postgres from "postgres";
import bcrypt from "bcryptjs";
import { createCipheriv, createHash, randomBytes } from "crypto";

const BASIS = `${process.env.PRUEF_BASIS ?? "http://127.0.0.1:5199"}/api/fiaon`;
const SECRET = process.env.SESSION_SECRET ?? "pruefstand-sitzung";
const DB = process.env.DATABASE_URL ?? "postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand";
const PW = "pruefstand-buch-2026";

if (!/127\.0\.0\.1|localhost/.test(DB) || !/pruef/i.test(DB)) {
  console.error("ABBRUCH: Dieses Skript schreibt Geldbuchungen. Es läuft nur gegen die lokale Prüfstand-Datenbank.");
  process.exit(1);
}
const sql = postgres(DB, { ssl: "require", max: 3 });

// ── Kekse je Person ─────────────────────────────────────────────────────────
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
      headers: { ...(koerper !== undefined ? { "Content-Type": "application/json" } : {}), Cookie: this.kekse, ...extra },
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

// ── PIN, TAN, Verschlüsselung wie im Server ────────────────────────────────
const PIN_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const pinHash = (pin: string) => createHash("sha256").update(`${SECRET}:${pin.replace(/-/g, "").toUpperCase()}`).digest("hex");
const tanHash = (tan: string, ziel: string) => createHash("sha256").update(`${SECRET}:tan:${ziel}:${tan}`).digest("hex");
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

async function tanFuer(person: string, zweck: string, ziel: string): Promise<string> {
  const tan = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  await sql`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE person = ${person} AND zweck = ${zweck} AND benutzt_am IS NULL`;
  await sql`INSERT INTO fiaon_buch_tan (person, zweck, ziel, tan_hash, gueltig_bis) VALUES (${person}, ${zweck}, ${ziel}, ${tanHash(tan, ziel)}, NOW() + INTERVAL '5 minutes')`;
  return tan;
}

async function anmelden(person: string): Promise<Sitzung> {
  const s = new Sitzung();
  const a = await s.ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: PW });
  if (a.status !== 200) throw new Error(`Passwort abgelehnt: ${JSON.stringify(a.j)}`);
  const p = await s.ruf("/buchhaltung/pin-pruefen", { email: person, pin: await pinFuer(person) });
  if (p.status !== 200) throw new Error(`PIN abgelehnt: ${JSON.stringify(p.j)}`);
  return s;
}

const istPdf = (b: Buffer) => b.subarray(0, 4).toString() === "%PDF";
const tagVor = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

async function lauf(): Promise<void> {
  const leer = new Sitzung();
  await leer.ruf("/buchhaltung/status"); // Schema
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_passwort_hash', ${await bcrypt.hash(PW, 10)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  for (const t of ["fiaon_buch_auftrag", "fiaon_buch_bewegung", "fiaon_buch_tan", "fiaon_buch_sitzung", "fiaon_buch_empfaenger", "fiaon_buch_dauerauftrag"]) {
    await sql.unsafe(`DELETE FROM ${t}`).catch(() => null);
  }
  await sql`DELETE FROM fiaon_settings WHERE key IN ('buchhaltung_anfangsbestand','buchhaltung_bankabgleich','buchhaltung_uebergabe','buchhaltung_sperre')`;
  await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE 'PRUEF-%' OR txn_id LIKE 'AWX-PRUEF-%'`;

  // Testdaten: zwei Eingänge im Geschäftskonto (gestern zugeordnet, heute offen), einer im Altkonto.
  await sql`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, match_status, applied)
    VALUES ('AWX-PRUEF-1', ${tagVor(1)}::date, 12000, 'EUR', 'Maria Prüf', 'FIAON-PRUEF1', 'matched', true),
           ('AWX-PRUEF-2', ${tagVor(0)}::date, 5000, 'EUR', 'Hans Offen', 'ohne Referenz', 'unmatched', false),
           ('PRUEF-WISE-1', '2026-08-15'::date, 8000, 'EUR', 'Alt Kunde', 'FIAON-ALT', 'matched', true)`;

  // Eine angeforderte Auszahlung für einen vorhandenen Mitarbeiter
  let [ag] = (await sql`SELECT id, name FROM fiaon_agents WHERE email = 'paula.pruefstand@fiaon.test' LIMIT 1`) as any[];
  if (!ag) {
    [ag] = (await sql`INSERT INTO fiaon_agents (name, email) VALUES ('Paula Prüfstand', 'paula.pruefstand@fiaon.test') RETURNING id, name`) as any[];
  }
  await sql`DELETE FROM fiaon_payouts WHERE iban_masked = 'DE89 •••• •••• 3000'`;
  const [po] = (await sql`
    INSERT INTO fiaon_payouts (agent_id, amount_cents, status, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked, requested_at)
    VALUES (${ag.id}, 25550, 'angefordert', ${verschluesseln("Paula Prüfstand")}, ${verschluesseln("DE89370400440532013000")},
            ${verschluesseln("COBADEFFXXX")}, 'DE89 •••• •••• 3000', NOW())
    RETURNING id`) as any[];
  await sql`UPDATE fiaon_agents SET bank_iban_enc = ${verschluesseln("DE89370400440532013000")}, bank_holder_enc = ${verschluesseln("Paula Prüfstand")} WHERE id = ${ag.id}`;

  // ── 1. Türen ───────────────────────────────────────────────────────────
  pruefe("Ohne Anmeldung keine Lage", (await leer.ruf("/buchhaltung/lage")).status === 401);
  pruefe("Falsches Passwort abgewiesen", (await new Sitzung().ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: "falsch" })).status === 401);
  pruefe("PIN ohne Passwort-Schritt abgewiesen", (await new Sitzung().ruf("/buchhaltung/pin-anfordern", { email: "florentine@fiaon.com" })).status === 401);

  const flo = await anmelden("florentine@fiaon.com");
  const js = await anmelden("js@fiaon.com");
  const l1 = await flo.ruf("/buchhaltung/lage");
  pruefe("Buchhaltung sieht beide Konten", l1.status === 200 && l1.j?.konten?.length === 2);
  pruefe("Ohne Anfangsbestand kein Saldo", l1.j?.kasse?.buchCents === null);
  pruefe("Herkunft fremder Seite abgewiesen", (await js.ruf("/buchhaltung/lebenszeichen", {}, { Origin: "https://boese.example" })).status === 403);

  // ── 2. Kontostand: nur Inhaber, nur mit passender TAN ──────────────────
  pruefe("Buchhaltung darf den Kontostand nicht bewegen", (await flo.ruf("/buchhaltung/kasse/tan", { art: "anfang", betrag: "1000", am: tagVor(2) })).status === 403);
  const anfangZiel = `anfang:100000:${tagVor(2)}`;
  const tan1 = await tanFuer("js@fiaon.com", "kasse", anfangZiel);
  const falsch = await js.ruf("/buchhaltung/kasse/buchen", { art: "anfang", betrag: "2000", am: tagVor(2), tan: tan1 });
  pruefe("TAN gilt nicht für einen anderen Betrag", falsch.status === 400, falsch.j?.error);
  const tan1b = await tanFuer("js@fiaon.com", "kasse", anfangZiel);
  const anf = await js.ruf("/buchhaltung/kasse/buchen", { art: "anfang", betrag: "1000", am: tagVor(2), tan: tan1b });
  pruefe("Anfangsbestand mit TAN gesetzt", anf.status === 200 && anf.j?.kasse?.anfang?.cents === 100000);
  const [eing] = (await sql`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS s FROM fiaon_bank_txns
     WHERE txn_id LIKE 'AWX-%' AND (booked_at AT TIME ZONE 'Europe/Berlin')::date > ${tagVor(2)}::date
       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'`) as any[];
  const [aus0] = (await sql`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS s FROM fiaon_payouts
     WHERE status = 'ausgezahlt' AND (processed_at AT TIME ZONE 'Europe/Berlin')::date > ${tagVor(2)}::date
       AND (processed_at AT TIME ZONE 'Europe/Berlin')::date >= DATE '2026-09-02'`) as any[];
  const erwartet = 100000 + Number(eing.s) - Number(aus0.s);
  pruefe("Saldo = Anfang + Eingänge − Auszahlungen seit dem Folgetag", anf.j?.kasse?.buchCents === erwartet, `${anf.j?.kasse?.buchCents} / erwartet ${erwartet}`);
  const nochmal = await js.ruf("/buchhaltung/kasse/buchen", { art: "anfang", betrag: "1000", am: tagVor(2), tan: tan1b });
  pruefe("Eine TAN gilt nur einmal", nochmal.status === 400);

  // ── 3. Umsätze ─────────────────────────────────────────────────────────
  const um = await flo.ruf("/buchhaltung/umsaetze?limit=50");
  const zeilen = um.j?.zeilen ?? [];
  pruefe("Umsätze aus der Bank im Strom", zeilen.some((u: any) => u.beleg === "AWX-PRUEF-1") && zeilen.some((u: any) => u.beleg === "PRUEF-WISE-1"));
  const wise = zeilen.find((u: any) => u.beleg === "PRUEF-WISE-1");
  pruefe("Altkonto-Zeile ohne Saldo", wise?.konto === "wise" && wise?.saldoNach === null);
  const offen = zeilen.find((u: any) => u.beleg === "AWX-PRUEF-2");
  pruefe("Nicht zugeordneter Eingang erkannt", offen?.art === "offen");
  const nurWise = await flo.ruf("/buchhaltung/umsaetze?konto=wise&limit=50");
  pruefe("Filter nach Konto", (nurWise.j?.zeilen ?? []).every((u: any) => u.konto === "wise"));
  const suche = await flo.ruf("/buchhaltung/umsaetze?q=120,00");
  pruefe("Suche nach Betrag", (suche.j?.zeilen ?? []).some((u: any) => u.beleg === "AWX-PRUEF-1"));
  const csv = await flo.ruf("/buchhaltung/umsaetze.csv");
  pruefe("CSV mit Kopf und Zeilen", csv.status === 200 && csv.roh.toString("utf8").includes("Buchungstag;Konto;Art") && csv.roh.toString("utf8").includes("Maria Prüf"));

  // ── 4. Überweisung mit vier Augen ──────────────────────────────────────
  const neu = await flo.ruf("/buchhaltung/auftrag", {
    empfaenger: "Musterdienst GmbH", iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX",
    betrag: "234,56", zweck: "Rechnung 2026-114", kategorie: "Dienstleister", einreichen: true,
  });
  const a = neu.j?.auftrag;
  pruefe("Auftrag der Buchhaltung direkt eingereicht", a?.status === "eingereicht", a?.nummer);
  pruefe("Buchhaltung kann keine TAN für Freigaben holen", (await flo.ruf(`/buchhaltung/auftrag/${a.id}/tan`, {})).status === 403);
  const zielA = `auftrag:${a.id}:${a.betragCents}:${a.iban}`;
  const tanFalsch = await tanFuer("js@fiaon.com", "freigabe", zielA);
  pruefe("Falsche TAN abgewiesen", (await js.ruf(`/buchhaltung/auftrag/${a.id}/freigeben`, { tan: tanFalsch === "123456" ? "654321" : "123456" })).status === 400);
  const tanA = await tanFuer("js@fiaon.com", "freigabe", zielA);
  const fr = await js.ruf(`/buchhaltung/auftrag/${a.id}/freigeben`, { tan: tanA });
  pruefe("Inhaber gibt mit TAN frei (vier Augen)", fr.j?.auftrag?.status === "freigegeben" && fr.j?.auftrag?.freigabeArt === "vier_augen");
  pruefe("Buchhaltung trägt keine Überweisung ein", (await flo.ruf(`/buchhaltung/auftrag/${a.id}/ausfuehren`, { bankReferenz: "X" })).status === 403);
  const vorher = (await js.ruf("/buchhaltung/lage")).j.kasse.buchCents;
  const aus = await js.ruf(`/buchhaltung/auftrag/${a.id}/ausfuehren`, { bankReferenz: "AWX-REF-1", wertAm: tagVor(0) });
  pruefe("Überweisung eingetragen", aus.j?.auftrag?.status === "ausgefuehrt");
  const nachher = (await js.ruf("/buchhaltung/lage")).j.kasse.buchCents;
  pruefe("Saldo um den Betrag gesunken", nachher === vorher - 23456, `${vorher} → ${nachher}`);
  pruefe("Keine Doppelbuchung", (await js.ruf(`/buchhaltung/auftrag/${a.id}/ausfuehren`, { bankReferenz: "AWX-REF-1" })).status === 400);
  const best = await flo.ruf(`/buchhaltung/auftrag/${a.id}/bestaetigung.pdf`);
  pruefe("Zahlungsbestätigung ist ein PDF", best.status === 200 && istPdf(best.roh), `${best.roh.length} Bytes`);

  // Einzelzeichnung des Inhabers
  const eigen = await js.ruf("/buchhaltung/auftrag", { empfaenger: "Software AG", iban: "DE02120300000000202051", betrag: "10", zweck: "Lizenz" });
  const e = eigen.j?.auftrag;
  const tanE = await tanFuer("js@fiaon.com", "freigabe", `auftrag:${e.id}:${e.betragCents}:${e.iban}`);
  const frE = await js.ruf(`/buchhaltung/auftrag/${e.id}/freigeben`, { tan: tanE });
  pruefe("Inhaber gibt eigenen Auftrag als Einzelzeichner frei", frE.j?.auftrag?.freigabeArt === "einzel");

  // ── 5. Empfänger-Vorschläge ────────────────────────────────────────────
  const v1 = await flo.ruf("/buchhaltung/empfaenger?q=Muster");
  pruefe("Kartei schlägt bezahlten Empfänger vor", (v1.j?.vorschlaege ?? []).some((x: any) => x.name === "Musterdienst GmbH" && x.iban === "DE89370400440532013000"));
  const v2 = await flo.ruf(`/buchhaltung/empfaenger?q=${encodeURIComponent(String(ag.name).split(" ")[0])}`);
  pruefe("Mitarbeiter mit Bankverbindung als Vorschlag", (v2.j?.vorschlaege ?? []).some((x: any) => x.quelle === "mitarbeiter"), String(ag.name));

  // ── 6. Mitarbeiter-Auszahlung über den Zahlungsverkehr ─────────────────
  const anw = await flo.ruf(`/buchhaltung/auszahlung/${po.id}/anweisen`, {});
  const pa = anw.j?.auftrag;
  pruefe("Auszahlung angewiesen und eingereicht", pa?.payoutId === po.id && pa?.status === "eingereicht" && pa?.iban === "DE89370400440532013000");
  pruefe("Kein zweiter Auftrag zur selben Auszahlung", (await flo.ruf(`/buchhaltung/auszahlung/${po.id}/anweisen`, {})).j?.auftrag?.id === pa.id);
  const tanP = await tanFuer("js@fiaon.com", "freigabe", `auftrag:${pa.id}:${pa.betragCents}:${pa.iban}`);
  await js.ruf(`/buchhaltung/auftrag/${pa.id}/freigeben`, { tan: tanP });
  const vorP = (await js.ruf("/buchhaltung/lage")).j.kasse.buchCents;
  const ausP = await js.ruf(`/buchhaltung/auftrag/${pa.id}/ausfuehren`, { bankReferenz: "AWX-REF-2" });
  pruefe("Auszahlungs-Auftrag ausgeführt", ausP.j?.auftrag?.status === "ausgefuehrt", ausP.j?.hinweis ?? "");
  const [pz] = (await sql`SELECT status FROM fiaon_payouts WHERE id = ${po.id}`) as any[];
  pruefe("Auszahlung im Mitarbeiter-System abgeschlossen", pz?.status === "ausgezahlt");
  const nachP = (await js.ruf("/buchhaltung/lage")).j.kasse.buchCents;
  pruefe("Auszahlung zählt genau einmal", nachP === vorP - 25550, `${vorP} → ${nachP}`);
  const bel = await flo.ruf(`/buchhaltung/auszahlung/${po.id}/beleg.pdf`);
  pruefe("Auszahlungsbeleg ist ein PDF", bel.status === 200 && istPdf(bel.roh));
  const jour = await flo.ruf("/buchhaltung/auszahlungsjournal.pdf");
  pruefe("Auszahlungsjournal ist ein PDF", jour.status === 200 && istPdf(jour.roh));

  // ── 7. Buchung von Hand und Storno ─────────────────────────────────────
  const buchZiel = `buchung:einlage:500000:${tagVor(0)}:Einlage Inhaber`;
  const tanB = await tanFuer("js@fiaon.com", "kasse", buchZiel);
  const vorB = (await js.ruf("/buchhaltung/lage")).j.kasse.buchCents;
  const bu = await js.ruf("/buchhaltung/kasse/buchen", { art: "einlage", betrag: "5000", wertAm: tagVor(0), zweck: "Einlage Inhaber", gegenpartei: "Justin", tan: tanB });
  pruefe("Einlage mit TAN gebucht", bu.status === 200 && bu.j?.kasse?.buchCents === vorB + 500000);
  const [bw] = (await sql`SELECT id FROM fiaon_buch_bewegung WHERE art = 'einlage' ORDER BY id DESC LIMIT 1`) as any[];
  const tanS = await tanFuer("js@fiaon.com", "kasse", `storno:${bw.id}`);
  const st = await js.ruf("/buchhaltung/kasse/buchen", { art: "storno", id: bw.id, grund: "Prüfung", tan: tanS });
  pruefe("Storno mit TAN nimmt die Einlage zurück", st.status === 200 && st.j?.kasse?.buchCents === vorB);
  const ab = await js.ruf("/buchhaltung/kasse/abgleich", { betrag: "900", am: tagVor(0) });
  pruefe("Bankabgleich nennt die Differenz", typeof ab.j?.kasse?.abgleich?.differenzCents === "number", `${ab.j?.kasse?.abgleich?.differenzCents}`);
  pruefe("Buchhaltung erfasst keinen Bankabgleich", (await flo.ruf("/buchhaltung/kasse/abgleich", { betrag: "1", am: tagVor(0) })).status === 403);

  // ── 8. Dauerauftrag, Auszüge, Übergabe, Zugang ─────────────────────────
  const da = await flo.ruf("/buchhaltung/dauerauftrag", { empfaenger: "Büro GmbH", iban: "DE02500105170137075030", betrag: "450", zweck: "Miete", tagImMonat: 1 });
  pruefe("Dauerauftrag angelegt", da.status === 200 && /^\d{4}-\d{2}-01$/.test(da.j?.dauerauftrag?.naechsteAm ?? ""), da.j?.dauerauftrag?.naechsteAm);
  pruefe("Dauerauftrag beendet", (await flo.ruf(`/buchhaltung/dauerauftrag/${da.j.dauerauftrag.id}/beenden`, {})).status === 200);
  const monat = tagVor(0).slice(0, 7);
  const ausz = await flo.ruf(`/buchhaltung/auszug.pdf?konto=geschaeft&monat=${monat}`);
  pruefe("Kassenbuchauszug ist ein PDF", ausz.status === 200 && istPdf(ausz.roh), `${ausz.roh.length} Bytes`);
  const auszW = await flo.ruf("/buchhaltung/auszug.pdf?konto=wise&monat=2026-08");
  pruefe("Auszug Altkonto ist ein PDF", auszW.status === 200 && istPdf(auszW.roh));
  await js.ruf("/buchhaltung/uebergabe", { bisher: "Prüfstand", stichtag: tagVor(0) });
  pruefe("Inhaber bestätigt die Übernahme nicht für andere", (await js.ruf("/buchhaltung/uebergabe/bestaetigen", {})).status === 403);
  pruefe("Buchhaltung bestätigt die Übernahme", (await flo.ruf("/buchhaltung/uebergabe/bestaetigen", {})).status === 200);
  const verm = await flo.ruf("/buchhaltung/uebergabe.pdf");
  pruefe("Übergabevermerk ist ein PDF", verm.status === 200 && istPdf(verm.roh));
  const zug = await flo.ruf("/buchhaltung/zugang.pdf");
  pruefe("Zugangsblatt ohne Passwort", zug.status === 200 && istPdf(zug.roh) && !zug.roh.toString("latin1").includes(PW));

  // ── 9. Sicherheit ──────────────────────────────────────────────────────
  const sich = await js.ruf("/buchhaltung/sicherheit");
  pruefe("Protokoll nennt Person und Handlung",
    (sich.j?.protokoll ?? []).some((p: any) => p.aktion.startsWith("Auftrag freigegeben") && p.person === "js@fiaon.com"), `${sich.j?.protokoll?.length} Zeilen`);
  pruefe("Inhaber sieht alle Sitzungen", (sich.j?.sitzungen ?? []).some((s: any) => s.person === "florentine@fiaon.com"));
  await js.ruf("/buchhaltung/zugang/sperre", { email: "florentine@fiaon.com", gesperrt: true });
  pruefe("Gesperrter Zugang endet sofort", (await flo.ruf("/buchhaltung/lage")).status === 401);
  const pinGesperrt = new Sitzung();
  await pinGesperrt.ruf("/buchhaltung/anmelden", { email: "accounting@fiaon.com", passwort: PW });
  pruefe("Gesperrte Person bekommt keinen PIN", (await pinGesperrt.ruf("/buchhaltung/pin-anfordern", { email: "florentine@fiaon.com" })).status === 403);
  await js.ruf("/buchhaltung/zugang/sperre", { email: "florentine@fiaon.com", gesperrt: false });
  await sql`UPDATE fiaon_buch_sitzung SET zuletzt_aktiv = NOW() - INTERVAL '20 minutes' WHERE person = 'js@fiaon.com' AND beendet_am IS NULL`;
  pruefe("Nach 15 Minuten Stille ist die Sitzung zu", (await js.ruf("/buchhaltung/lage")).status === 401);
  const js2 = await anmelden("js@fiaon.com");
  await js2.ruf("/buchhaltung/abmelden", {});
  pruefe("Nach dem Abmelden ist die Tür zu", (await js2.ruf("/buchhaltung/lage")).status === 401);
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
