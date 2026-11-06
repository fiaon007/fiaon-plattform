// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND AUSZAHLUNGSPLAN (E-484, 06.11.2026)
//
// Spielt den Auszahlungsplan im FIAON Banking gegen einen LAUFENDEN lokalen Server durch — echtes HTTP mit zwei
// Banking-Sitzungen (Inhaber und Geschäftsführung), die TAN aus der abgelegten Mail, der Bestätigungslink der
// Buchhaltung aus ihrer Mail:
//   Plan anlegen (EINE TAN, je Empfänger ein EIGENER Plan) → Altposten „verrechnet“ in derselben Transaktion
//   geschlossen (oder „zusätzlich“ unberührt) → Teilbetrag auslösen → Wartezeit je Plan → Freigabe mit TAN →
//   Auftrag an die Buchhaltung → deren Bestätigung (Bank-Referenz freiwillig, aber eindeutig) → ausgebucht, Beleg.
//   Dazu die Riegel gegen doppelte Zahlung: Rennen, Stau-Grenze, Takt-Netz in der Datenbank, Seitenwege, Sammellauf,
//   Wallet, Pause, Kontowechsel, Beenden, Sammelmitteilung alle zehn Teilbeträge, Obergrenze.
//
//   PRUEF_BASIS=http://127.0.0.1:5292 DATABASE_URL=postgresql://…@127.0.0.1:…/<prüf-db> CRONS=aus \
//   BANKING_MAIL_PROBE=<Probe-Ordner des Servers> SESSION_SECRET=<wie der Server> \
//   npx tsx scripts/pruef-auszahlungsplan.ts [--rot-probe=rennen]
//
// LÄUFT NUR GEGEN DEN LOKALEN PRÜFSTAND: Datenbank auf 127.0.0.1/localhost mit „pruef“ im Namen, Server lokal mit
// BANKING_MAIL_PROBE, kein Mail-Schlüssel in der Umgebung (der Lauf lädt Servermodule — Sammellauf und Wallet laufen
// im eigenen Prozess). Die Mitarbeiterkonten legt der Lauf selbst an (Adressen auf .invalid, je Lauf einmalig) und
// legt sie am Ende still. Für die Selbstfreigabe braucht die Geschäftsführung ein Mitarbeiterkonto mit ihrer
// Banking-Adresse: Der Lauf nimmt das vorhandene (oder legt es an), setzt eine Prüf-IBAN und stellt danach alles
// zurück. Zeit wird nicht abgewartet — die Wartezeit dreht der Lauf in der Prüf-Datenbank zurück. Den 15. für den
// Sammellauf stellt er nur im eigenen Prozess und nur für diesen einen Aufruf ein.
//
// Rot-Probe (AGENTS.md „Ein Prüfstand muss rot werden können“): im Server die Zeilensperre beim Auslösen
// (teilAusloesen: „SELECT p.*, NOW() AS jetzt FROM fiaon_auszahlungsplan p WHERE p.id = … FOR UPDATE“) lokal
// entfernen, Server neu starten, dann mit „--rot-probe=rennen“ laufen lassen: Der Lauf nimmt das Takt-Netz (EXCLUDE)
// aus der Prüf-Datenbank, lässt nur das Rennen laufen — es muss ROT werden — und baut das Netz danach wieder ein.
// Ohne den Eingriff im Code bleibt das Rennen grün (die Zeilensperre allein hält). Danach den Code zurückbauen.
// ═══════════════════════════════════════════════════════════════════════════

import postgres from "postgres";
import bcrypt from "bcryptjs";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";

const HERKUNFT = (process.env.PRUEF_BASIS ?? "http://127.0.0.1:5292").replace(/\/+$/, "");
const BASIS = `${HERKUNFT}/api/fiaon`;
const DB = process.env.DATABASE_URL ?? "";
const PROBE = process.env.BANKING_MAIL_PROBE ?? "";
const PW = "pruefstand-buch-2026";
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const ROT_PROBE = (process.argv.find((a) => a.startsWith("--rot-probe=")) ?? "").slice("--rot-probe=".length);

function abbruch(grund: string): never {
  console.error(`ABBRUCH: ${grund}`);
  process.exit(1);
}
// ── Die Wände: erst prüfen, dann Servermodule laden ─────────────────────────
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DB) || !/\/[^/?]*pruef[^/?]*(\?|$)/i.test(DB)) {
  abbruch("Dieser Lauf schreibt Auszahlungen. Er läuft nur gegen eine lokale Prüfstand-Datenbank (127.0.0.1, „pruef“ im Namen).");
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(HERKUNFT)) abbruch("Nur gegen einen lokalen Server (PRUEF_BASIS).");
if (!PROBE) abbruch("BANKING_MAIL_PROBE fehlt — ohne den Probe-Ordner des Servers sind PIN, TAN und Links nicht lesbar.");
if (process.env.NODE_ENV === "production") abbruch("NODE_ENV=production — der Prüfstand läuft nie mit Produktionseinstellungen.");
if (String(process.env.CRONS || "").toLowerCase() !== "aus") abbruch("CRONS=aus fehlt — der Lauf lädt Servermodule, deren Tagesläufe sonst anspringen.");
for (const k of ["GOOGLE_SA_KEY", "BREVO_API_KEY", "MAKE_WEBHOOK_URL"]) {
  if (process.env[k]) abbruch(`${k} ist gesetzt — der Prüfstand darf keine echte Mail verschicken.`);
}
if (ROT_PROBE && ROT_PROBE !== "rennen") abbruch(`Unbekannte Rot-Probe „${ROT_PROBE}“ (bekannt: rennen).`);
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "pruefstand-sitzung";

// ── Ergebnis ────────────────────────────────────────────────────────────────
const gruen: string[] = [];
const rot: string[] = [];
const ohne: string[] = [];
function pruefe(name: string, ok: boolean, info = ""): void {
  (ok ? gruen : rot).push(name);
  console.log(`${ok ? "\x1b[32mok  \x1b[0m" : "\x1b[31mROT \x1b[0m"} ${name}${info ? ` — ${info}` : ""}`);
}
function uebersprungen(name: string, grund: string): void {
  ohne.push(name);
  console.log(`\x1b[33m--  \x1b[0m ${name} — ÜBERSPRUNGEN: ${grund}`);
}
function abschnitt(t: string): void {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 72 - t.length))}`);
}

// ── HTTP mit Keksen je Person ───────────────────────────────────────────────
class Sitzung {
  kekse = "";
  merken(res: Response): void {
    for (const c of (res.headers as any).getSetCookie?.() ?? []) {
      const kv = String(c).split(";")[0];
      const k = kv.split("=")[0];
      this.kekse = this.kekse.split("; ").filter((x) => x && !x.startsWith(`${k}=`)).concat(/=$/.test(kv) ? [] : [kv]).join("; ");
    }
  }
  async ruf(pfad: string, koerper?: unknown, extra: Record<string, string> = {}): Promise<{ status: number; j: any }> {
    try {
      const res = await fetch(`${BASIS}${pfad}`, {
        method: koerper === undefined ? "GET" : "POST",
        headers: {
          ...(koerper !== undefined ? { "Content-Type": "application/json", Origin: HERKUNFT } : {}),
          ...(this.kekse ? { Cookie: this.kekse } : {}),
          ...extra,
        },
        body: koerper !== undefined ? JSON.stringify(koerper) : undefined,
      });
      this.merken(res);
      const roh = Buffer.from(await res.arrayBuffer()).toString("utf8");
      let j: any;
      try { j = JSON.parse(roh); } catch { j = { roh: roh.slice(0, 200) }; }
      return { status: res.status, j: j ?? {} };
    } catch (e) {
      // Ein Netzfehler wird eine rote Prüfung, kein Abbruch.
      return { status: 0, j: { error: `Netzfehler: ${String(e).slice(0, 160)}` } };
    }
  }
}

// ── Die abgelegten Mails (Probe-Ordner des Servers) ────────────────────────
interface Mail { datei: string; an: string; betreff: string; text: string }
const mailCache = new Map<string, Mail>();
function mails(): Mail[] {
  if (!existsSync(PROBE)) return [];
  return readdirSync(PROBE).filter((d) => d.endsWith(".txt")).sort().map((d) => {
    const alt = mailCache.get(d);
    if (alt) return alt;
    const roh = readFileSync(join(PROBE, d), "utf8");
    const m: Mail = {
      datei: d,
      an: (roh.match(/^An: (.*)$/m) || [])[1] ?? "",
      betreff: (roh.match(/^Betreff: (.*)$/m) || [])[1] ?? "",
      text: roh.split("\n\n").slice(1).join("\n\n"),
    };
    // Nur vollständig geschriebene Dateien merken (der Server schreibt sie am Stück, mit Zeilenende).
    if (m.betreff && roh.endsWith("\n")) mailCache.set(d, m);
    return m;
  });
}
const marke = (): Set<string> => new Set(mails().map((m) => m.datei));
const neueMails = (vorher: Set<string>): Mail[] => mails().filter((m) => !vorher.has(m.datei));
const anhaenge = (m: Mail): string[] => {
  const stamm = m.datei.replace(/\.txt$/, "");
  return readdirSync(PROBE).filter((x) => x.startsWith(`${stamm}-`)).map((x) => join(PROBE, x));
};
const tanAus = (m?: Mail | null): string =>
  ((m?.betreff.match(/^TAN (\d{3}) (\d{3})/) || m?.text.match(/TAN:?\s+(\d{3}) (\d{3})/) || []) as string[]).slice(1).join("");
const tokenAus = (m?: Mail | null): string => (m?.text.match(/\/auszahlung-ausfuehren\/([A-Za-z0-9_-]+)/) || [])[1] ?? "";
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function warteAuf(bedingung: () => boolean | Promise<boolean>, ms = 8000): Promise<boolean> {
  const bis = Date.now() + ms;
  for (;;) {
    if (await bedingung()) return true;
    if (Date.now() > bis) return false;
    await warte(100);
  }
}
const geld = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);

// ── PDF-Text (pypdf liest die eingebettete Schrift sauber) — fehlt es, wird übersprungen, nicht rot ──
let pythonMitPypdf: string | null | undefined;
function pdfText(pfad: string): string | null {
  if (pythonMitPypdf === undefined) {
    pythonMitPypdf = null;
    for (const py of ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]) {
      try {
        execFileSync(py, ["-I", "-c", "import pypdf"], { stdio: "ignore", cwd: tmpdir() });
        pythonMitPypdf = py;
        break;
      } catch { /* nächster Kandidat */ }
    }
  }
  if (!pythonMitPypdf) return null;
  try {
    return execFileSync(pythonMitPypdf, ["-I", "-c", "import sys,pypdf;r=pypdf.PdfReader(sys.argv[1]);print(' '.join((p.extract_text() or '') for p in r.pages))", pfad],
      { encoding: "utf8", maxBuffer: 20_000_000, cwd: tmpdir() }).replace(/\s+/g, " ");
  } catch (e) {
    return `PDF-TEXT-FEHLER ${String(e).slice(0, 160)}`;
  }
}

/**
 * Den Sammellauf am 15. prüfen, egal an welchem Tag dieser Lauf läuft: Nur der Aufruf „new Date()“ ohne Argument
 * zeigt für die Dauer von `arbeit` auf den Stichtag — in diesem Prozess, nicht im Server. Date.now() bleibt echt.
 */
async function mitStichtag<T>(isoTag: string, arbeit: () => Promise<T>): Promise<T> {
  const Echt = Date;
  const versatz = new Echt(`${isoTag}T10:00:00Z`).getTime() - Echt.now();
  const Verschoben: any = function (this: unknown, ...a: any[]) {
    if (!new.target) return (Echt as any)();
    return a.length === 0 ? new Echt(Echt.now() + versatz) : new (Echt as any)(...a);
  };
  Verschoben.prototype = Echt.prototype;
  Object.setPrototypeOf(Verschoben, Echt);
  (globalThis as any).Date = Verschoben;
  try { return await arbeit(); } finally { (globalThis as any).Date = Echt; }
}

// Prüf-IBANs (öffentliche Beispiel-IBANs mit gültiger Prüfziffer)
const IBAN = {
  A: "DE89370400440532013000", A2: "DE75512108001245126199", B: "DE02120300000000202051", C: "DE44500105175407324931",
  G: "DE12500105170648489890", T: "DE02500105170137075030", R: "DE27100777770209299700",
};

async function main(): Promise<void> {
  const { sqlPool: sql } = (await import("../server/lib/db-pool")) as any;
  const bh: any = await import("../server/lib/fiaon-buchhaltung");
  const ap: any = await import("../server/lib/fiaon-auszahlungsplan");
  const agentMod: any = await import("../server/routes/fiaon-agent");
  const sicht: any = await import("../server/lib/fiaon-mitarbeiter-sicht");
  const JS: string = bh.inhaber().email;
  const GF: string = bh.geschaeftsfuehrung().email;
  const EXT: string = bh.BUCHHALTUNG_AUSFUEHRUNG;
  const KIND: string = bh.KIND_AUSZAHLUNGSPLAN;
  const lauf = Date.now().toString(36);
  const maske = (i: string): string => bh.ibanMaskiert(i);
  const huebsch = (i: string): string => bh.ibanHuebsch(i);

  // ═══ S0 Prüfstand vorbereiten ═══════════════════════════════════════════
  abschnitt("S0 Prüfstand vorbereiten");
  // Tabellen vor jeder Transaktion (AGENTS.md: DDL wartet sonst auf die eigene offene Transaktion).
  await bh.buchSchema();
  await ap.planSchema();
  await agentMod.ensureAgentTables();
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_passwort_hash', ${await bcrypt.hash(PW, 10)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_sperre', '[]', NOW())
    ON CONFLICT (key) DO UPDATE SET value = '[]', updated_at = NOW()`;
  for (const iban of Object.values(IBAN)) if (!bh.ibanGueltig(iban)) abbruch(`Prüf-IBAN ${iban} hat eine falsche Prüfziffer.`);
  const [{ start: laufStart }] = await sql`SELECT NOW() AS start`;

  const angelegt: number[] = [];
  const kontoSetzen = async (id: number, iban: string) => {
    await sql`
      UPDATE fiaon_agents SET bank_iban_enc = ${agentMod.encryptSecret(iban)}, bank_holder_enc = ${agentMod.encryptSecret("Planprobe Kontoinhaber")},
             bank_bic_enc = ${agentMod.encryptSecret("COBADEFFXXX")}, bank_iban_masked = ${maske(iban)}, zugang_gesperrt_am = NULL
       WHERE id = ${id}`;
  };
  const neuerAgent = async (kennung: string, iban: string | null, name?: string): Promise<number> => {
    const [r] = await sql`
      INSERT INTO fiaon_agents (name, email, first_name, last_name, active)
      VALUES (${name ?? `Planprobe ${kennung.toUpperCase()} ${lauf}`}, ${`planprobe-${kennung}-${lauf}@fiaon.invalid`}, 'Planprobe', ${kennung.toUpperCase()}, TRUE)
      RETURNING id`;
    const id = Number(r.id);
    angelegt.push(id);
    if (iban) await kontoSetzen(id, iban);
    return id;
  };
  const A = await neuerAgent("a", IBAN.A);
  const B = await neuerAgent("b", IBAN.B);
  const C = await neuerAgent("c", IBAN.C);
  const N = await neuerAgent("n", null);
  const T = await neuerAgent("t", IBAN.T, `Planprobe Prüfstand ${lauf}`); // Name trifft das Testkonto-Muster
  // Das Mitarbeiterkonto zur Banking-Adresse der Geschäftsführung (für die Selbstfreigabe) — danach zurückgestellt.
  let [gRow] = await sql`
    SELECT id, active, is_test_account, zugang_gesperrt_am, bank_iban_enc, bank_holder_enc, bank_bic_enc, bank_iban_masked
      FROM fiaon_agents WHERE LOWER(email) = LOWER(${GF}) LIMIT 1`;
  if (!gRow) {
    [gRow] = await sql`INSERT INTO fiaon_agents (name, email, active) VALUES ('Planprobe Geschäftsführung', ${GF}, TRUE)
      RETURNING id, active, is_test_account, zugang_gesperrt_am, bank_iban_enc, bank_holder_enc, bank_bic_enc, bank_iban_masked`;
  }
  const G = Number(gRow.id);
  await sql`UPDATE fiaon_agents SET active = TRUE, is_test_account = FALSE WHERE id = ${G}`;
  await kontoSetzen(G, IBAN.G);
  await sql`
    UPDATE fiaon_auszahlungsplan SET status = 'beendet', status_von = 'pruefstand', status_am = NOW(), status_grund = 'Prüfstand: Neustart'
     WHERE agent_id = ${G} AND status IN ('aktiv', 'pausiert')`;

  const ref = (k: string) => `PRUEF-PLAN-${lauf}-${k}`;
  const vormerkung = async (agentId: number, k: string, cents: number): Promise<number> => {
    const [r] = await sql`
      INSERT INTO fiaon_provision_vormerkung (agent_id, ref, payment_reference, amount_cents, kind, anlass)
      VALUES (${agentId}, ${ref(k)}, ${ref(k)}, ${cents}, 'own', 'Prüfstand Auszahlungsplan') RETURNING id`;
    return Number(r.id);
  };
  const provision = async (agentId: number, k: string, cents: number, status: string, extra: { payoutId?: number; ab?: boolean } = {}): Promise<number> => {
    const [r] = await sql`
      INSERT INTO fiaon_commissions (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, payout_id, auszahlbar_ab)
      VALUES (${agentId}, ${ref(k)}, 'Prüfstand', ${cents}, 0, ${cents}, ${status}, 'own', ${extra.payoutId ?? null},
              ${extra.ab ? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10) : null}::date)
      RETURNING id`;
    return Number(r.id);
  };
  const auszahlung = async (agentId: number, k: string, cents: number, iban: string, status = "angefordert"): Promise<number> => {
    const [p] = await sql`
      INSERT INTO fiaon_payouts (agent_id, amount_cents, status, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked, requested_at)
      VALUES (${agentId}, ${cents}, ${status}, ${agentMod.encryptSecret("Planprobe Kontoinhaber")}, ${agentMod.encryptSecret(iban)},
              ${agentMod.encryptSecret("COBADEFFXXX")}, ${maske(iban)}, NOW())
      RETURNING id`;
    if (status !== "requested") await provision(agentId, `${k}-P`, cents, "in_auszahlung", { payoutId: Number(p.id) });
    return Number(p.id);
  };

  // ── Banking-Anmeldung: Passwort, dann PIN aus der Mail ──
  const anmelden = async (person: string): Promise<Sitzung> => {
    const s = new Sitzung();
    const a = await s.ruf("/buchhaltung/anmelden", { email: bh.BUCH_LOGIN, passwort: PW });
    if (a.status !== 200) abbruch(`Banking-Passwort abgewiesen: ${a.status} ${JSON.stringify(a.j)}`);
    const vorher = marke();
    const p = await s.ruf("/buchhaltung/pin-anfordern", { email: person });
    if (p.status !== 200) abbruch(`PIN anfordern: ${p.status} ${JSON.stringify(p.j)} — läuft der Server mit BANKING_MAIL_PROBE=${PROBE}?`);
    let pin = "";
    await warteAuf(() => {
      const m = neueMails(vorher).filter((x) => x.an === person && /^PIN /.test(x.betreff)).pop();
      pin = (m?.text.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/) || [])[1] ?? "";
      return !!pin;
    }, 4000);
    const pp = await s.ruf("/buchhaltung/pin-pruefen", { email: person, pin });
    if (pp.status !== 200) abbruch(`PIN abgewiesen (${person}): ${pp.status} ${JSON.stringify(pp.j)}`);
    return s;
  };
  const js = await anmelden(JS);
  const gf = await anmelden(GF);
  const leer = new Sitzung();
  pruefe("Banking-Anmeldung Inhaber und Geschäftsführung (PIN aus der Mail)", true);

  /** Eine TAN anfordern und aus der Mail lesen — so, wie ein Mensch sie liest. */
  const neueTan = async (s: Sitzung, an: string, pfad: string, koerper: unknown = {}) => {
    const vorher = marke();
    const r = await s.ruf(pfad, koerper);
    let mail: Mail | null = null;
    if (r.status === 200) {
      await warteAuf(() => !!(mail = neueMails(vorher).filter((x) => x.an === an && /^TAN /.test(x.betreff)).pop() ?? null), 4000);
    }
    return { r, tan: tanAus(mail), mail: mail as Mail | null };
  };
  /** Klassischer Weg (E-347) bis zur Buchhaltung: zur Freigabe → Geschäftsführung gibt mit der TAN aus der Mail frei. */
  const zurBuchhaltung = async (payoutId: number): Promise<{ id: number; nummer: string; token: string }> => {
    const vorher = marke();
    const z = await js.ruf(`/buchhaltung/auszahlung/${payoutId}/zur-freigabe`, {});
    const a = z.j?.auftrag ?? {};
    let m72: Mail | null = null;
    await warteAuf(() => !!(m72 = neueMails(vorher).filter((x) => x.an === GF && x.betreff.startsWith(`Bitte freigeben: ${a.nummer}`)).pop() ?? null), 4000);
    const vorFrei = marke();
    const f = await gf.ruf(`/buchhaltung/auftrag/${a.id}/freigeben`, { tan: tanAus(m72) });
    let mExt: Mail | null = null;
    await warteAuf(() => !!(mExt = neueMails(vorFrei).filter((x) => x.an === EXT && x.betreff.startsWith(`Zahlungsauftrag ${a.nummer} `)).pop() ?? null), 4000);
    if (z.status !== 200 || f.status !== 200 || !tokenAus(mExt)) {
      console.log(`   (zurBuchhaltung #${payoutId}: ${z.status} ${z.j?.error ?? ""} / ${f.status} ${f.j?.error ?? ""})`);
    }
    return { id: Number(a.id || 0), nummer: String(a.nummer || ""), token: tokenAus(mExt) };
  };

  // ── Altposten der Empfänger (alles, was ein Plan „verrechnet“) ──
  const vA1 = await vormerkung(A, "A-V1", 1250);
  const vA2 = await vormerkung(A, "A-V2", 800);
  const kA1 = await provision(A, "A-K1", 9000, "bestaetigt");
  const kA2 = await provision(A, "A-K2", 4000, "vorgemerkt", { ab: true });
  const pA1 = await auszahlung(A, "A-P1", 30000, IBAN.A);
  const pA2 = await auszahlung(A, "A-P2", 32170, IBAN.A);
  const pA3 = await auszahlung(A, "A-P3", 16200, IBAN.A, "requested"); // Altzeile ohne Provision
  const pA4 = await auszahlung(A, "A-P4", 5500, IBAN.A);
  const pA5 = await auszahlung(A, "A-P5", 2000, IBAN.A);
  const oA1 = await zurBuchhaltung(pA1);
  const oA2 = await zurBuchhaltung(pA2);
  // Die Klasse „schon als überwiesen gebucht, Auftrag liegt trotzdem noch bei der Buchhaltung“ (vor dem Riegel entstanden)
  await sql`UPDATE fiaon_payouts SET status = 'ausgezahlt', processed_at = NOW() WHERE id = ${pA2}`;
  await sql`UPDATE fiaon_commissions SET status = 'ausgezahlt' WHERE payout_id = ${pA2}`;
  // Eigene Anweisung des Inhabers im Banking (Entwurf, nicht bei der Buchhaltung)
  const anw = await js.ruf(`/buchhaltung/auszahlung/${pA5}/anweisen`, {});
  const oA5 = { id: Number(anw.j?.auftrag?.id ?? 0), nummer: String(anw.j?.auftrag?.nummer ?? "?"), status: String(anw.j?.auftrag?.status ?? "?") };
  const vB1 = await vormerkung(B, "B-V1", 700);
  const pB1 = await auszahlung(B, "B-P1", 12000, IBAN.B);
  const oB1 = await zurBuchhaltung(pB1);
  // Zur Freigabe geschickt, aber noch nicht freigegeben: liegt bei der Geschäftsführung, nicht bei der Buchhaltung
  const pB2 = await auszahlung(B, "B-P2", 2500, IBAN.B);
  const vorB2zf = marke();
  const zfB2 = await js.ruf(`/buchhaltung/auszahlung/${pB2}/zur-freigabe`, {});
  const oB2 = { id: Number(zfB2.j?.auftrag?.id ?? 0), nummer: String(zfB2.j?.auftrag?.nummer ?? "?") };
  let tanB2 = "";
  await warteAuf(() => !!(tanB2 = tanAus(neueMails(vorB2zf).filter((x) => x.an === GF && x.betreff.startsWith(`Bitte freigeben: ${oB2.nummer}`)).pop())), 4000);
  await vormerkung(G, "G-V1", 600);
  const vC1 = await vormerkung(C, "C-V1", 900);
  const kC1 = await provision(C, "C-K1", 7000, "bestaetigt");
  const pC1 = await auszahlung(C, "C-P1", 11100, IBAN.C);
  const pC2 = await auszahlung(C, "C-P2", 4400, IBAN.C);
  pruefe("Testdaten: drei Aufträge liegen über den klassischen Weg bei der Buchhaltung", !!oA1.token && !!oA2.token && !!oB1.token,
    `${oA1.nummer} ${oA2.nummer} ${oB1.nummer}`);
  pruefe("Testdaten: ein Entwurf im Banking (Inhaber) und ein Auftrag zur Freigabe bei der Geschäftsführung (mit TAN-Mail)",
    oA5.id > 0 && oA5.status === "entwurf" && oB2.id > 0 && /^\d{6}$/.test(tanB2), `${oA5.nummer} ${oA5.status} · ${oB2.nummer}`);
  const linkStatus = async (token: string) => (await leer.ruf(`/buchhaltung/extern/${token}`)).status;
  pruefe("Testdaten: ihre Bestätigungslinks gelten", (await linkStatus(oA1.token)) === 200 && (await linkStatus(oA2.token)) === 200 && (await linkStatus(oB1.token)) === 200);

  const altZaehlen = async (ids: number[]) => {
    const [r] = await sql`
      SELECT (SELECT COUNT(*)::int FROM fiaon_provision_vormerkung WHERE agent_id = ANY(${ids})) AS v,
             (SELECT COUNT(*)::int FROM fiaon_commissions WHERE agent_id = ANY(${ids})) AS c,
             (SELECT COUNT(*)::int FROM fiaon_payouts WHERE agent_id = ANY(${ids})) AS p,
             (SELECT COUNT(*)::int FROM fiaon_buch_auftrag o JOIN fiaon_payouts p ON p.id = o.payout_id WHERE p.agent_id = ANY(${ids})) AS o`;
    return `${r.v}/${r.c}/${r.p}/${r.o}`;
  };
  const zuPlan = async (agentId: number) => (await sql`SELECT id, nummer, status FROM fiaon_auszahlungsplan WHERE agent_id = ${agentId} ORDER BY id`) as any[];

  // ═══ T1 Plan anlegen — „verrechnet“, eine TAN, je Empfänger ein eigener Plan ═══
  abschnitt("T1 Plan anlegen (verrechnet): Vorschau, TAN, alles oder nichts, Altposten");
  const kand = await js.ruf("/buchhaltung/auszahlungsplan/kandidaten");
  const kliste: any[] = kand.j?.kandidaten ?? [];
  const kA = kliste.find((k) => k.agentId === A);
  const kB = kliste.find((k) => k.agentId === B);
  const kN = kliste.find((k) => k.agentId === N);
  pruefe("Kandidaten: A und B wählbar, Konto lesbar (gleicher Schlüssel wie der Server)", kand.status === 200 && kA?.auswaehlbar === true && kB?.auswaehlbar === true
    && kA?.ibanMasked === maske(IBAN.A), `${kand.status} A=${kA?.auswaehlbar}/${kA?.grund ?? ""} B=${kB?.auswaehlbar}`);
  pruefe("Kandidaten: Altposten von A vor der TAN sichtbar (8 Posten, Summe, alle drei ZA)", kA?.altposten?.anzahl === 8 && kA?.altposten?.cents === 68750
    && (kA?.altposten?.auftraege ?? []).map((o: any) => o.nummer).sort().join(",") === [oA1.nummer, oA2.nummer, oA5.nummer].sort().join(","),
    `${kA?.altposten?.anzahl} / ${kA?.altposten?.cents} / ${(kA?.altposten?.auftraege ?? []).map((o: any) => o.nummer).join(",")}`);
  pruefe("Kandidaten: ohne Bankverbindung nicht wählbar (mit Grund), Testkonto gar nicht in der Liste",
    kN?.auswaehlbar === false && /Bankverbindung/.test(kN?.grund ?? "") && !kliste.some((k) => k.agentId === T), `${kN?.grund}`);
  pruefe("Vorgaben: Teilbetrag, Abstand, Stau-Grenze aus dem Code, Altposten „verrechnet“, Hinweis an",
    kand.j?.vorgaben?.teilCents === ap.VORGABE_TEIL_CENTS && kand.j?.vorgaben?.abstandMin === ap.VORGABE_ABSTAND_MIN
      && kand.j?.vorgaben?.maxOffen === ap.VORGABE_MAX_OFFEN && kand.j?.vorgaben?.altposten === "verrechnet" && kand.j?.vorgaben?.hinweisAnInhaber === true,
    JSON.stringify(kand.j?.vorgaben));

  const grundAB = `Prüfstand Auszahlungsplan ${lauf}`;
  const einAB = { empfaenger: [{ agentId: A, anspruch: "60,25" }, { agentId: B, anspruchCents: 4000 }], teilbetrag: "10", abstandMin: 90, maxOffen: 6, grund: grundAB };
  const tanN = await js.ruf("/buchhaltung/auszahlungsplan/neu/tan", { ...einAB, empfaenger: [{ agentId: N, anspruchCents: 3000 }] });
  const tanT = await js.ruf("/buchhaltung/auszahlungsplan/neu/tan", { ...einAB, empfaenger: [{ agentId: T, anspruchCents: 3000 }] });
  pruefe("Empfänger ohne IBAN → 400 EMPFAENGER", tanN.status === 400 && tanN.j?.code === "EMPFAENGER", `${tanN.status} ${tanN.j?.error}`);
  pruefe("Empfänger mit Testkonto → 400 EMPFAENGER", tanT.status === 400 && tanT.j?.code === "EMPFAENGER" && /Testkonto/.test(tanT.j?.error ?? ""), `${tanT.status} ${tanT.j?.error}`);
  const kurz = await js.ruf("/buchhaltung/auszahlungsplan/neu/vorschau", { ...einAB, grund: "x" });
  pruefe("Grund zu kurz → 400 EINGABE mit Klartext", kurz.status === 400 && kurz.j?.code === "EINGABE" && /Grund/.test(kurz.j?.error ?? ""), `${kurz.status} ${kurz.j?.error}`);

  // Neue Vormerkung — die Vorschau muss sie zeigen, eine schon angeforderte TAN darf danach nicht mehr passen.
  const tAlt = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einAB);
  const vA3 = await vormerkung(A, "A-V3", 500);
  const geaendert = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einAB, tan: tAlt.tan });
  pruefe("Neue Vormerkung zwischen TAN und Anlage → 409 ALTPOSTEN_GEAENDERT", geaendert.status === 409 && geaendert.j?.code === "ALTPOSTEN_GEAENDERT",
    `${geaendert.status} ${geaendert.j?.code} ${geaendert.j?.error ?? ""}`);

  const vs = await js.ruf("/buchhaltung/auszahlungsplan/neu/vorschau", einAB);
  const v = vs.j?.vorschau ?? {};
  const vA = (v.empfaenger ?? []).find((e: any) => e.agentId === A);
  const vB = (v.empfaenger ?? []).find((e: any) => e.agentId === B);
  pruefe("Vorschau: Standard „verrechnet“, 60,25 € = 7 Teile (letzter 0,25 €), 40 € = 4 Teile", vs.status === 200 && v.altposten === "verrechnet"
    && vA?.anzahlTeile === 7 && vA?.letzterTeilCents === 25 && vB?.anzahlTeile === 4 && v.anzahlTeile === 11 && v.summeCents === 10025,
    `${vs.status} ${v.altposten} A=${vA?.anzahlTeile}/${vA?.letzterTeilCents} B=${vB?.anzahlTeile}`);
  pruefe("Vorschau: je Empfänger Altposten mit Anzahl, Summe und ZA (A 9 Posten, B 3 Posten)", vA?.altposten?.anzahl === 9 && vA?.altposten?.cents === 69250
    && vB?.altposten?.anzahl === 3 && vB?.altposten?.cents === 15200 && v.altpostenAnzahl === 12 && v.altpostenCents === 84450
    && (vB?.altposten?.auftraege ?? []).map((o: any) => o.nummer).sort().join(",") === [oB1.nummer, oB2.nummer].sort().join(","),
    `A ${vA?.altposten?.anzahl}/${vA?.altposten?.cents} · B ${vB?.altposten?.anzahl}/${vB?.altposten?.cents} · Σ ${v.altpostenCents}`);
  pruefe("Vorschau: zurückzurufen = genau die drei ZA bei der Buchhaltung (nicht Entwurf/zur Freigabe), keine TAN-Bindung in der Antwort",
    (v.zurueckgerufen ?? []).slice().sort().join(",") === [oA1.nummer, oA2.nummer, oB1.nummer].sort().join(",") && !("ziel" in v), (v.zurueckgerufen ?? []).join(","));
  const gfVs = await gf.ruf("/buchhaltung/auszahlungsplan/neu/vorschau", einAB);
  pruefe("Geschäftsführung: Vorschau → 403 NUR_INHABER", gfVs.status === 403 && gfVs.j?.code === "NUR_INHABER", String(gfVs.status));

  const t1 = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einAB);
  const tanText = t1.mail?.text ?? "";
  pruefe("TAN-Mail an den Inhaber: je Empfänger ein Plan, Summe der verrechneten Altposten, die ZA",
    t1.r.status === 200 && t1.r.j?.an === JS && /^\d{6}$/.test(t1.tan) && /je Empfänger ein eigener Plan/.test(tanText)
      && tanText.includes(`Altposten verrechnet: ${geld(84450)} in 12 Posten`) && [oA1.nummer, oA2.nummer, oB1.nummer].every((n) => tanText.includes(n)),
    `${t1.r.status} ${t1.r.j?.error ?? ""}`);
  const ohneTan = await js.ruf("/buchhaltung/auszahlungsplan/neu", einAB);
  const falscheTan = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einAB, tan: t1.tan === "123456" ? "654321" : "123456" });
  pruefe("Anlegen ohne TAN / mit falscher TAN → 400 TAN", ohneTan.status === 400 && ohneTan.j?.code === "TAN" && falscheTan.status === 400 && falscheTan.j?.code === "TAN",
    `${ohneTan.status} ${ohneTan.j?.code} / ${falscheTan.status} ${falscheTan.j?.code}`);
  const t1b = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einAB);
  const andereEingabe = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einAB, empfaenger: [{ agentId: A, anspruch: "70,25" }, { agentId: B, anspruchCents: 4000 }], tan: t1b.tan });
  pruefe("Die TAN gilt nur für genau diese Eingabe (anderer Anspruch → 400 TAN)", andereEingabe.status === 400 && andereEingabe.j?.code === "TAN",
    `${andereEingabe.status} ${andereEingabe.j?.error}`);
  pruefe("Nach den abgewiesenen Versuchen: kein Plan, nichts geschlossen", (await zuPlan(A)).length === 0 && (await zuPlan(B)).length === 0
    && (await linkStatus(oA1.token)) === 200);

  // Alles oder nichts: A ist schon angelegt und verrechnet, da ändert sich bei B etwas → nichts bleibt stehen.
  const zaehlVorher = await altZaehlen([A, B]);
  const t2 = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einAB);
  const vorAtom = marke();
  const sperre = postgres(DB, { ssl: "require", max: 1, onnotice: () => {} });
  let gewartet = false;
  let atom: { status: number; j: any } = { status: 0, j: {} };
  try {
    await sperre.begin(async (tx: any) => {
      await tx`SELECT id FROM fiaon_provision_vormerkung WHERE id = ${vB1} FOR UPDATE`;
      const anfrage = js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einAB, tan: t2.tan });
      gewartet = await warteAuf(async () => {
        const [w] = await sql`
          SELECT COUNT(*)::int AS n FROM pg_stat_activity
           WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%fiaon_provision_vormerkung%' AND pid <> pg_backend_pid()`;
        return Number(w?.n) > 0;
      }, 8000);
      await tx`UPDATE fiaon_provision_vormerkung SET amount_cents = amount_cents + 1 WHERE id = ${vB1}`;
      void anfrage.then((x) => { atom = x; });
    });
    await warteAuf(() => atom.status !== 0, 15000);
  } finally {
    await sperre.end({ timeout: 5 }).catch(() => {});
  }
  pruefe("Alles oder nichts: die Anlage wartete auf B (A war schon in der Transaktion)", gewartet);
  pruefe("… dann Altposten von B geändert → 409 ALTPOSTEN_GEAENDERT", atom.status === 409 && atom.j?.code === "ALTPOSTEN_GEAENDERT", `${atom.status} ${atom.j?.code} ${atom.j?.error ?? ""}`);
  const [atomA] = await sql`
    SELECT (SELECT COUNT(*)::int FROM fiaon_auszahlungsplan WHERE agent_id IN (${A}, ${B})) AS plaene,
           (SELECT status FROM fiaon_provision_vormerkung WHERE id = ${vA1}) AS v,
           (SELECT status FROM fiaon_payouts WHERE id = ${pA1}) AS p,
           (SELECT status FROM fiaon_buch_auftrag WHERE id = ${oA1.id}) AS o,
           (SELECT benutzt_am IS NOT NULL FROM fiaon_buch_tan WHERE person = ${JS} AND zweck = 'plan-anlegen' ORDER BY id DESC LIMIT 1) AS tan_verbraucht`;
  pruefe("… und für A blieb NICHTS stehen: kein Plan, Vormerkung offen, Auszahlung angefordert, Auftrag bei der Buchhaltung",
    atomA?.plaene === 0 && atomA?.v === "offen" && atomA?.p === "angefordert" && atomA?.o === "freigegeben" && (await linkStatus(oA1.token)) === 200
      && (await altZaehlen([A, B])) === zaehlVorher, JSON.stringify(atomA));
  pruefe("… keine Mail „Bitte NICHT ausführen“ aus dem abgebrochenen Versuch", !neueMails(vorAtom).some((m) => /^Bitte NICHT ausführen/.test(m.betreff)));

  // Jetzt wirklich: eine TAN, zwei Pläne.
  const zaehlVorAnlage = await altZaehlen([A, B]);
  const t3 = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einAB);
  const vorAnlage = marke();
  const an = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einAB, tan: t3.tan });
  const planA = (an.j?.plaene ?? []).find((p: any) => p.agentId === A) ?? { id: 0, nummer: "?" };
  const planB = (an.j?.plaene ?? []).find((p: any) => p.agentId === B) ?? { id: 0, nummer: "?" };
  pruefe("EINE TAN → je Empfänger ein EIGENER Plan (zwei Nummern)", an.status === 200 && planA.id > 0 && planB.id > 0 && planA.nummer !== planB.nummer,
    `${an.status} ${an.j?.error ?? ""} ${planA.nummer} ${planB.nummer}`);
  pruefe("Antwort nennt alle drei zurückgerufenen ZA", [oA1.nummer, oA2.nummer, oB1.nummer].every((n) => (an.j?.zurueckgerufen ?? []).includes(n)),
    (an.j?.zurueckgerufen ?? []).join(","));
  const [teileA] = await sql`SELECT COUNT(*)::int AS n, SUM(betrag_cents)::int AS s, MAX(betrag_cents) FILTER (WHERE nr = 7)::int AS letzter FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planA.id}`;
  const [teileB] = await sql`SELECT COUNT(*)::int AS n, SUM(betrag_cents)::int AS s FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planB.id}`;
  pruefe("Teile: A 7 (Summe = Anspruch, letzter 0,25 €), B 4 (Summe = Anspruch)", teileA?.n === 7 && teileA?.s === 6025 && teileA?.letzter === 25 && teileB?.n === 4 && teileB?.s === 4000,
    `${JSON.stringify(teileA)} ${JSON.stringify(teileB)}`);
  const [pz] = await sql`SELECT altposten, altposten_cents, altposten_anzahl, hinweis_an_inhaber, max_offen, abstand_min, naechste_ab <= NOW() AS sofort FROM fiaon_auszahlungsplan WHERE id = ${planA.id}`;
  pruefe("Plan A: verrechnet 692,50 € in 9 Posten, Hinweis-Mail an (Standard), erste Auslösung sofort", pz?.altposten === "verrechnet" && pz?.altposten_cents === 69250
    && pz?.altposten_anzahl === 9 && pz?.hinweis_an_inhaber === true && pz?.sofort === true, JSON.stringify(pz));
  const [st] = await sql`
    SELECT (SELECT string_agg(status || ':' || COALESCE(erledigt_von, ''), ',' ORDER BY id) FROM fiaon_provision_vormerkung WHERE id IN (${vA1}, ${vA2}, ${vA3})) AS v,
           (SELECT bool_and(note LIKE ${`%im Auszahlungsplan ${planA.nummer} verrechnet%`}) FROM fiaon_provision_vormerkung WHERE id IN (${vA1}, ${vA2}, ${vA3})) AS v_vermerk,
           (SELECT string_agg(status, ',' ORDER BY id) FROM fiaon_commissions WHERE id IN (${kA1}, ${kA2})) AS k,
           (SELECT status || '|' || COALESCE(reject_reason, '') FROM fiaon_payouts WHERE id = ${pA1}) AS p1,
           (SELECT string_agg(status, ',') FROM fiaon_commissions WHERE payout_id = ${pA1}) AS p1k,
           (SELECT status FROM fiaon_payouts WHERE id = ${pA2}) AS p2,
           (SELECT string_agg(status, ',') FROM fiaon_commissions WHERE payout_id = ${pA2}) AS p2k,
           (SELECT status FROM fiaon_payouts WHERE id = ${pA3}) AS p3,
           (SELECT status || '|' || (SELECT string_agg(status, ',') FROM fiaon_commissions WHERE payout_id = ${pA4}) FROM fiaon_payouts WHERE id = ${pA4}) AS p4,
           (SELECT status FROM fiaon_payouts WHERE id = ${pA5}) || '|' || (SELECT status FROM fiaon_buch_auftrag WHERE id = ${oA5.id}) AS p5,
           (SELECT status FROM fiaon_payouts WHERE id = ${pB2}) || '|' || (SELECT status FROM fiaon_buch_auftrag WHERE id = ${oB2.id}) AS pb2,
           (SELECT status || '|' || COALESCE(extern_token_hash, '-') || '|' || COALESCE(rueckruf_grund, '') FROM fiaon_buch_auftrag WHERE id = ${oA1.id}) AS o1,
           (SELECT status || '|' || COALESCE(rueckruf_grund, '') FROM fiaon_buch_auftrag WHERE id = ${oA2.id}) AS o2,
           (SELECT status FROM fiaon_provision_vormerkung WHERE id = ${vB1}) AS vb,
           (SELECT status FROM fiaon_payouts WHERE id = ${pB1}) AS pb,
           (SELECT status FROM fiaon_buch_auftrag WHERE id = ${oB1.id}) AS ob`;
  pruefe("Vormerkungen von A verworfen (vom Inhaber, mit Vermerk „im Auszahlungsplan … verrechnet“)",
    st?.v === [`verworfen:${JS}`, `verworfen:${JS}`, `verworfen:${JS}`].join(",") && st?.v_vermerk === true, `${st?.v} ${st?.v_vermerk}`);
  pruefe("Bestätigte und vorgemerkte Provision storniert", st?.k === "storniert,storniert", st?.k);
  pruefe("Offene Auszahlung abgelehnt mit Grund „Im Auszahlungsplan AP-… verrechnet“, ihre Provision storniert",
    st?.p1 === `abgelehnt|Im Auszahlungsplan ${planA.nummer} verrechnet` && st?.p1k === "storniert", `${st?.p1} · ${st?.p1k}`);
  pruefe("Altzeile „requested“ und Auszahlung ohne Auftrag abgelehnt", st?.p3 === "abgelehnt" && st?.p4 === "abgelehnt|storniert", `${st?.p3} · ${st?.p4}`);
  pruefe("Auftrag bei der Buchhaltung zurückgerufen: zurückgezogen, Link gelöscht, Grund", st?.o1 === `zurueckgezogen|-|Im Auszahlungsplan ${planA.nummer} verrechnet`, st?.o1);
  pruefe("Schon gebuchte Auszahlung bleibt „ausgezahlt“, nur ihr Auftrag wird geschlossen",
    st?.p2 === "ausgezahlt" && st?.p2k === "ausgezahlt" && /^zurueckgezogen\|Auszahlung bereits als überwiesen gebucht/.test(st?.o2 ?? ""), `${st?.p2} ${st?.p2k} · ${st?.o2}`);
  pruefe("B ebenso: Vormerkung verworfen, Auszahlung abgelehnt, Auftrag zurückgerufen", st?.vb === "verworfen" && st?.pb === "abgelehnt" && st?.ob === "zurueckgezogen",
    `${st?.vb} ${st?.pb} ${st?.ob}`);
  pruefe("Entwurf im Banking und Auftrag zur Freigabe geschlossen, ihre Auszahlungen abgelehnt", st?.p5 === "abgelehnt|zurueckgezogen" && st?.pb2 === "abgelehnt|zurueckgezogen",
    `${st?.p5} · ${st?.pb2}`);
  const [tanB2Zeile] = await sql`SELECT benutzt_am IS NOT NULL AS verbraucht FROM fiaon_buch_tan WHERE zweck = ${`freigabe:${oB2.id}`} ORDER BY id DESC LIMIT 1`;
  const altTan = await gf.ruf(`/buchhaltung/auftrag/${oB2.id}/freigeben`, { tan: tanB2 });
  pruefe("Die Freigabe-TAN aus der Mail zum geschlossenen Auftrag ist entwertet, Freigeben → 400", tanB2Zeile?.verbraucht === true && altTan.status === 400,
    `TAN verbraucht=${tanB2Zeile?.verbraucht} · ${altTan.status} ${altTan.j?.error ?? ""}`);
  pruefe("Alle drei Bestätigungslinks sind tot (404)", (await linkStatus(oA1.token)) === 404 && (await linkStatus(oA2.token)) === 404 && (await linkStatus(oB1.token)) === 404);
  pruefe("Nichts gelöscht: Vormerkungen/Provisionen/Auszahlungen/Aufträge von A und B gleich viele", (await altZaehlen([A, B])) === zaehlVorAnlage,
    `${zaehlVorAnlage} → ${await altZaehlen([A, B])}`);
  await warteAuf(() => neueMails(vorAnlage).some((m) => m.an === GF && /angelegt/.test(m.betreff)), 3000);
  const nichtAusf = neueMails(vorAnlage).filter((m) => m.an === EXT && /^Bitte NICHT ausführen/.test(m.betreff));
  pruefe("GENAU EINE Mail „Bitte NICHT ausführen“ an die Buchhaltung, mit genau den drei ZA dort und der Bitte um Bank-Referenz",
    nichtAusf.length === 1 && [oA1.nummer, oA2.nummer, oB1.nummer].every((n) => nichtAusf[0].betreff.includes(n))
      && !nichtAusf[0].betreff.includes(oA5.nummer) && !nichtAusf[0].betreff.includes(oB2.nummer) && /Bank-Referenz/.test(nichtAusf[0].text),
    `${nichtAusf.length}: ${nichtAusf.map((m) => m.betreff).join(" | ")}`);
  pruefe("Info-Mail „angelegt“ an die Geschäftsführung", neueMails(vorAnlage).some((m) => m.an === GF && /angelegt/.test(m.betreff) && m.betreff.includes(planA.nummer)));
  const [ev] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_agent_events WHERE agent_id = ${A} AND type = 'payout_rejected' AND meta LIKE ${`%"plan":"${planA.nummer}"%`}`;
  pruefe("Ereignis „payout_rejected“ je abgelehnter Altauszahlung (Quelle Auszahlungsplan)", Number(ev?.n) === 4, String(ev?.n));
  const zweit = await js.ruf("/buchhaltung/auszahlungsplan/neu/tan", { ...einAB, empfaenger: [{ agentId: A, anspruchCents: 3000 }] });
  pruefe("Zweiter Plan für A → 400 EMPFAENGER („läuft schon“)", zweit.status === 400 && zweit.j?.code === "EMPFAENGER" && /läuft schon/.test(zweit.j?.error ?? ""),
    `${zweit.status} ${zweit.j?.error}`);
  const kand2 = await js.ruf("/buchhaltung/auszahlungsplan/kandidaten");
  const kA2b = (kand2.j?.kandidaten ?? []).find((k: any) => k.agentId === A);
  pruefe("Kandidaten danach: A nicht wählbar, offener Plan genannt", kA2b?.auswaehlbar === false && kA2b?.offenerPlan === planA.nummer, `${kA2b?.offenerPlan}`);

  // ═══ T1b „zusätzlich“ — Altposten bleiben unberührt ═════════════════════
  abschnitt("T1b Plan anlegen (zusätzlich): Altposten unberührt");
  const gAltVorher = await ap.planAltposten(G);
  const einCG = { empfaenger: [{ agentId: C, anspruchCents: 12000 }, { agentId: G, anspruchCents: 3000 }], teilCents: 1000, abstandMin: 15, maxOffen: 2,
    altposten: "zusaetzlich", grund: `Prüfstand zusätzlich ${lauf}` };
  const tC = await neueTan(js, JS, "/buchhaltung/auszahlungsplan/neu/tan", einCG);
  pruefe("TAN-Mail „zusätzlich“: Altposten bleiben bestehen", tC.r.status === 200 && /Altposten bleiben bestehen/.test(tC.mail?.text ?? ""), `${tC.r.status} ${tC.r.j?.error ?? ""}`);
  const vorC = marke();
  const anC = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...einCG, tan: tC.tan });
  const planC = (anC.j?.plaene ?? []).find((p: any) => p.agentId === C) ?? { id: 0, nummer: "?" };
  const planG = (anC.j?.plaene ?? []).find((p: any) => p.agentId === G) ?? { id: 0, nummer: "?" };
  pruefe("Zwei weitere Pläne (C, G) mit einer TAN", anC.status === 200 && planC.id > 0 && planG.id > 0, `${anC.status} ${anC.j?.error ?? ""}`);
  const [stC] = await sql`
    SELECT (SELECT status FROM fiaon_provision_vormerkung WHERE id = ${vC1}) AS v, (SELECT status FROM fiaon_commissions WHERE id = ${kC1}) AS k,
           (SELECT status FROM fiaon_payouts WHERE id = ${pC1}) AS p1, (SELECT status FROM fiaon_payouts WHERE id = ${pC2}) AS p2,
           (SELECT altposten || '|' || altposten_cents FROM fiaon_auszahlungsplan WHERE id = ${planC.id}) AS plan`;
  pruefe("C unberührt: Vormerkung offen, Provision bestätigt, Auszahlungen angefordert; Plan „zusaetzlich“ ohne Summe",
    stC?.v === "offen" && stC?.k === "bestaetigt" && stC?.p1 === "angefordert" && stC?.p2 === "angefordert" && stC?.plan === "zusaetzlich|0", JSON.stringify(stC));
  const gAltNach = await ap.planAltposten(G);
  pruefe("Konto der Geschäftsführung: offene Posten unverändert", gAltVorher.anzahl >= 1 && gAltNach.fingerabdruck === gAltVorher.fingerabdruck, `${gAltVorher.anzahl} → ${gAltNach.anzahl}`);
  pruefe("Keine Mail „Bitte NICHT ausführen“ bei „zusätzlich“", !neueMails(vorC).some((m) => /^Bitte NICHT ausführen/.test(m.betreff)));

  // ═══ T14 Rechte und Herkunft ═══════════════════════════════════════════
  abschnitt("T14 Rechte und Herkunft");
  pruefe("Ohne Sitzung: Reiter → 401", (await leer.ruf("/buchhaltung/auszahlungsplan")).status === 401);
  pruefe("Ohne Sitzung: Auslösen → 401", (await leer.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/ausloesen`, {})).status === 401);
  const fremd = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/ausloesen`, {}, { Origin: "https://boese.example" });
  pruefe("Fremde Herkunft → 403 HERKUNFT", fremd.status === 403 && fremd.j?.code === "HERKUNFT", `${fremd.status} ${fremd.j?.code}`);
  for (const [pfad, koerper] of [
    ["/buchhaltung/auszahlungsplan/kandidaten", undefined], ["/buchhaltung/auszahlungsplan/neu/tan", einAB], ["/buchhaltung/auszahlungsplan/neu", einAB],
    [`/buchhaltung/auszahlungsplan/${planA.id}/weiter`, {}], [`/buchhaltung/auszahlungsplan/${planA.id}/ende/tan`, {}],
    [`/buchhaltung/auszahlungsplan/${planA.id}/ende`, { grund: "Prüfstand", tan: "123456" }], [`/buchhaltung/auszahlungsplan/${planA.id}/hinweis`, { an: false }],
    [`/buchhaltung/auszahlungsplan/${planA.id}/konto/tan`, {}], [`/buchhaltung/auszahlungsplan/${planA.id}/konto`, { tan: "123456" }],
    [`/buchhaltung/auftrag/${oA1.id}/zurueckrufen`, { grund: "Prüfstand" }],
  ] as [string, unknown][]) {
    const r = await gf.ruf(pfad, koerper);
    pruefe(`Geschäftsführung: ${pfad.replace(/\/\d+/g, "/:id")} → 403 NUR_INHABER`, r.status === 403 && r.j?.code === "NUR_INHABER", `${r.status} ${r.j?.code}`);
  }
  const umstellen = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/altposten`, { modus: "zusaetzlich" });
  pruefe("Altposten-Modus nachträglich umstellen gibt es nicht (404)", umstellen.status === 404, String(umstellen.status));

  // ═══ T2 Erste Auslösung ════════════════════════════════════════════════
  abschnitt("T2 Erste Auslösung sofort (Geschäftsführung), T8 Hinweis an den Inhaber");
  const zaehle = async (planId: number, nummer: string) => {
    const [z] = await sql`
      SELECT (SELECT COUNT(*)::int FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${planId}) AS takt,
             (SELECT COUNT(*)::int FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id WHERE t.plan_id = ${planId}) AS auftraege,
             (SELECT COUNT(*)::int FROM fiaon_payouts p WHERE EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = ${KIND} AND c.ref LIKE ${`${nummer}-T%`})) AS payouts`;
    return { takt: Number(z.takt), auftraege: Number(z.auftraege), payouts: Number(z.payouts) };
  };
  const zurueckdrehen = async (planId: number, min: number) => {
    // Zeile für Zeile, die älteste zuerst: So überlappt kein verschobenes Sperrfenster ein noch nicht verschobenes.
    for (const k of (await sql`SELECT id FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${planId} ORDER BY ausgeloest_am ASC, id ASC`) as any[]) {
      await sql`UPDATE fiaon_auszahlungsplan_takt SET ausgeloest_am = ausgeloest_am - ${min}::int * INTERVAL '1 minute', sperre_bis = sperre_bis - ${min}::int * INTERVAL '1 minute' WHERE id = ${k.id}`;
    }
    await sql`UPDATE fiaon_auszahlungsplan SET naechste_ab = naechste_ab - ${min}::int * INTERVAL '1 minute', letzte_ausloesung_am = letzte_ausloesung_am - ${min}::int * INTERVAL '1 minute' WHERE id = ${planId}`;
  };
  const freiDrehen = async (planId: number) => {
    const [p] = await sql`SELECT abstand_min FROM fiaon_auszahlungsplan WHERE id = ${planId}`;
    await zurueckdrehen(planId, Number(p?.abstand_min ?? 90) + 1);
  };
  const ausloesen = (s: Sitzung, planId: number) => s.ruf(`/buchhaltung/auszahlungsplan/${planId}/ausloesen`, {});
  const hinweise = (vorher: Set<string>, nummer: string) => neueMails(vorher).filter((m) => m.an === JS && /^Bitte freigeben: /.test(m.betreff) && m.betreff.includes(nummer));

  const z0 = await zaehle(planA.id, planA.nummer);
  const vorA1 = marke();
  const rA1 = await ausloesen(gf, planA.id);
  const a1: any = rA1.j?.auftrag ?? {};
  pruefe("Auslösen (GF): 200, Teil 1 von 7, Auftrag eingereicht, über die Buchhaltung, im Namen des Inhabers",
    rA1.status === 200 && rA1.j?.schon === false && rA1.j?.teil?.nr === 1 && rA1.j?.teil?.anzahl === 7 && a1.status === "eingereicht"
      && a1.ausfuehrungExtern === EXT && a1.erstelltVon === JS && !!a1.planTeilId, `${rA1.status} ${rA1.j?.error ?? ""} ${a1.nummer}`);
  const [pa1] = await sql`
    SELECT p.status, p.amount_cents, c.status AS cs, c.kind, c.ref,
           (SELECT EXTRACT(EPOCH FROM (sperre_bis - ausgeloest_am))::int FROM fiaon_auszahlungsplan_takt WHERE auftrag_id = ${a1.id ?? 0}) AS fenster,
           (SELECT EXTRACT(EPOCH FROM (naechste_ab - letzte_ausloesung_am))::int FROM fiaon_auszahlungsplan WHERE id = ${planA.id}) AS warte
      FROM fiaon_payouts p JOIN fiaon_commissions c ON c.payout_id = p.id WHERE p.id = ${a1.payoutId ?? 0}`;
  pruefe("Auszahlung 10 € angefordert, Provision „in_auszahlung“ / „auszahlungsplan“, Takt 90 Min, nächste ab +90 Min",
    pa1?.status === "angefordert" && pa1?.amount_cents === 1000 && pa1?.cs === "in_auszahlung" && pa1?.kind === KIND && pa1?.ref === `${planA.nummer}-T001`
      && pa1?.fenster === 5400 && pa1?.warte === 5400, JSON.stringify(pa1));
  const z1 = await zaehle(planA.id, planA.nummer);
  pruefe("Genau eine Takt-Zeile, ein Auftrag, eine Auszahlung", z1.takt === z0.takt + 1 && z1.auftraege === z0.auftraege + 1 && z1.payouts === z0.payouts + 1, JSON.stringify(z1));
  await warteAuf(() => hinweise(vorA1, a1.nummer ?? "?").length > 0, 3000);
  pruefe("T8: Hinweis „Bitte freigeben“ an den Inhaber (die Geschäftsführung hat ausgelöst), mit Link zum Auftrag",
    hinweise(vorA1, a1.nummer ?? "?").length === 1 && hinweise(vorA1, a1.nummer ?? "?")[0].text.includes(`auftrag=${a1.id}`));

  // ═══ T3 Wartezeit je Plan ══════════════════════════════════════════════
  abschnitt("T3 Wartezeit je Plan — zwei Pläne blockieren sich nicht");
  const sofort = await ausloesen(js, planA.id);
  pruefe("Gleich danach (Inhaber) → 409 ZU_FRUEH mit naechsteAb", sofort.status === 409 && sofort.j?.code === "ZU_FRUEH" && !!sofort.j?.naechsteAb, `${sofort.status} ${sofort.j?.code}`);
  await zurueckdrehen(planA.id, 89);
  const n89 = await ausloesen(js, planA.id);
  pruefe("Nach 89 Minuten → noch 409 ZU_FRUEH", n89.status === 409 && n89.j?.code === "ZU_FRUEH", `${n89.status} ${n89.j?.code}`);
  const vorB1 = marke();
  const rB1 = await ausloesen(gf, planB.id);
  pruefe("Plan B hat seinen eigenen Takt: sofort auslösbar, während A wartet", rB1.status === 200 && rB1.j?.teil?.nr === 1, `${rB1.status} ${rB1.j?.error ?? ""}`);
  await zurueckdrehen(planA.id, 2);
  const vorA2 = marke();
  const rA2 = await ausloesen(js, planA.id);
  pruefe("Nach 91 Minuten → 200 (Teil 2)", rA2.status === 200 && rA2.j?.teil?.nr === 2, `${rA2.status} ${rA2.j?.error ?? ""}`);
  await warte(300);
  pruefe("T8: Inhaber löst selbst aus → kein Hinweis an sich selbst", hinweise(vorA2, rA2.j?.auftrag?.nummer ?? "?").length === 0);
  pruefe("T8: B (GF) → Hinweis an den Inhaber", hinweise(vorB1, rB1.j?.auftrag?.nummer ?? "?").length === 1);
  const hAus = await js.ruf(`/buchhaltung/auszahlungsplan/${planB.id}/hinweis`, { an: false });
  const hFalsch = await js.ruf(`/buchhaltung/auszahlungsplan/${planB.id}/hinweis`, { an: "nein" });
  await freiDrehen(planB.id);
  const vorB2 = marke();
  const rB2 = await ausloesen(gf, planB.id);
  await warte(400);
  pruefe("T8: Hinweis abgeschaltet → GF löst aus, kein Hinweis; kein Boolean → 400", hAus.status === 200 && hFalsch.status === 400 && rB2.status === 200
    && hinweise(vorB2, rB2.j?.auftrag?.nummer ?? "?").length === 0, `${hAus.status}/${hFalsch.status}/${rB2.status}`);
  await js.ruf(`/buchhaltung/auszahlungsplan/${planB.id}/hinweis`, { an: true });

  // ═══ T4 Rennen ═════════════════════════════════════════════════════════
  abschnitt("T4 Rennen: zwei Personen, Doppelklick, zwei Pläne");
  await freiDrehen(planA.id);
  const zR0 = await zaehle(planA.id, planA.nummer);
  const [ra, rb] = await Promise.all([ausloesen(gf, planA.id), ausloesen(js, planA.id)]);
  const zR1 = await zaehle(planA.id, planA.nummer);
  const okR = [ra, rb].filter((x) => x.status === 200 && x.j?.schon === false);
  const zuFrueh = [ra, rb].filter((x) => x.status === 409 && x.j?.code === "ZU_FRUEH");
  pruefe("Rennen GF gegen Inhaber: genau EINE Auslösung, die andere 409 ZU_FRUEH", okR.length === 1 && zuFrueh.length === 1,
    `${ra.status} ${ra.j?.code ?? ra.j?.teil?.nr} / ${rb.status} ${rb.j?.code ?? rb.j?.teil?.nr}`);
  pruefe("… genau ein neuer Auftrag, eine Auszahlung, ein Takt-Eintrag", zR1.takt === zR0.takt + 1 && zR1.auftraege === zR0.auftraege + 1 && zR1.payouts === zR0.payouts + 1,
    `${JSON.stringify(zR0)} → ${JSON.stringify(zR1)}`);
  await freiDrehen(planA.id);
  const [d1, d2] = await Promise.all([ausloesen(gf, planA.id), ausloesen(gf, planA.id)]);
  const zR2 = await zaehle(planA.id, planA.nummer);
  pruefe("Doppelklick derselben Person: 200 + 200 (einmal schon:true), derselbe Auftrag", d1.status === 200 && d2.status === 200
    && [d1.j?.schon, d2.j?.schon].sort().join(",") === "false,true" && d1.j?.auftrag?.id === d2.j?.auftrag?.id && zR2.takt === zR1.takt + 1,
    `${d1.status}/${d2.status} schon=${d1.j?.schon}/${d2.j?.schon} ${d1.j?.auftrag?.nummer}/${d2.j?.auftrag?.nummer}`);
  await freiDrehen(planA.id);
  await freiDrehen(planB.id);
  const [x1, x2] = await Promise.all([ausloesen(gf, planA.id), ausloesen(js, planB.id)]);
  pruefe("Zwei Pläne gleichzeitig: beide 200 (eigener Takt je Person)", x1.status === 200 && x2.status === 200, `${x1.status} ${x1.j?.code ?? ""} / ${x2.status} ${x2.j?.code ?? ""}`);

  // ═══ T5 Takt-Netz in der Datenbank ═════════════════════════════════════
  abschnitt("T5 Takt-Netz (EXCLUDE) in der Datenbank");
  let netz = "";
  try {
    await sql.begin(async (tx: any) => {
      await tx`INSERT INTO fiaon_auszahlungsplan_takt (plan_id, teil_id, von, ausgeloest_am, sperre_bis) VALUES (${planA.id}, 0, 'pruefstand', NOW(), NOW() + INTERVAL '10 minutes')`;
      throw new Error("ZURUECK");
    });
  } catch (e: any) { netz = String(e?.code || e?.message); }
  pruefe("Überlappendes Sperrfenster direkt eingefügt → 23P01", netz === "23P01", netz);

  // ═══ T7 Freigabe durch die Geschäftsführung → Buchhaltung ══════════════
  abschnitt("T7 Freigabe (GF, vier Augen) → Auftrag an die Buchhaltung, IBAN maskiert");
  const auftragVonTeil = async (planId: number, nr: number) => {
    const [r] = await sql`SELECT o.id, o.nummer, o.status FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
                           WHERE t.plan_id = ${planId} AND t.nr = ${nr} AND o.status IN ('eingereicht', 'freigegeben') ORDER BY o.id DESC LIMIT 1`;
    return r ? { id: Number(r.id), nummer: String(r.nummer), status: String(r.status) } : { id: 0, nummer: "?", status: "?" };
  };
  const extMail = (vorher: Set<string>, nummer: string) => neueMails(vorher).filter((m) => m.an === EXT && m.betreff.startsWith(`Zahlungsauftrag ${nummer} `)).pop() ?? null;
  const freigeben = async (s: Sitzung, wer: string, auftragId: number, nummer: string) => {
    const t = await neueTan(s, wer, `/buchhaltung/auftrag/${auftragId}/tan`, {});
    const vorher = marke();
    const f = await s.ruf(`/buchhaltung/auftrag/${auftragId}/freigeben`, { tan: t.tan });
    let m: Mail | null = null;
    await warteAuf(() => !!(m = extMail(vorher, nummer)), 4000);
    return { t, f, mail: m as Mail | null, token: tokenAus(m), vorher };
  };
  const A1 = await auftragVonTeil(planA.id, 1);
  const fr1 = await freigeben(gf, GF, A1.id, A1.nummer);
  pruefe("TAN zur Freigabe (GF): vier Augen, TAN-Mail nennt den Plan", fr1.t.r.status === 200 && fr1.t.r.j?.art === "vier_augen" && /Auszahlungsplan/.test(fr1.t.mail?.text ?? ""),
    `${fr1.t.r.status} ${fr1.t.r.j?.error ?? ""}`);
  pruefe("Freigabe (GF): 200, freigegeben, vier Augen", fr1.f.status === 200 && fr1.f.j?.auftrag?.status === "freigegeben" && fr1.f.j?.auftrag?.freigabeArt === "vier_augen",
    `${fr1.f.status} ${fr1.f.j?.error ?? ""}`);
  const mText = fr1.mail?.text ?? "";
  pruefe("Mail an die Buchhaltung: IBAN nur maskiert (weder am Stück noch in Vierergruppen), Teil genannt, Link",
    !!fr1.mail && mText.includes(maske(IBAN.A)) && !mText.includes(IBAN.A) && !mText.includes(huebsch(IBAN.A)) && /Teilbetrag 1 von 7/.test(mText) && !!fr1.token,
    fr1.mail?.betreff ?? "keine Mail");
  await warte(400);
  pruefe("Keine Freigabebestätigung je Teilbetrag, keine 72-h-Freigabe-Mail", !neueMails(fr1.vorher).some((m) => /^Freigabe bestätigt/.test(m.betreff))
    && !mails().some((m) => m.an === GF && m.betreff.startsWith(`Bitte freigeben: ${A1.nummer}`)));
  const [vorBest] = await sql`
    SELECT p.status AS ps, t.ausgefuehrt_am IS NULL AS offen FROM fiaon_payouts p JOIN fiaon_auszahlungsplan_teil t ON t.payout_id = p.id
     WHERE t.plan_id = ${planA.id} AND t.nr = 1`;
  const amLinkVorbei = await js.ruf(`/buchhaltung/auftrag/${A1.id}/ausfuehren`, { bankReferenz: "PRUEF-AM-LINK-VORBEI" });
  pruefe("Nach der Freigabe ist NICHTS ausgebucht, kein Beleg; der Inhaber führt nicht am Link vorbei aus (400)", vorBest?.ps === "angefordert" && vorBest?.offen === true
    && !mails().some((m) => m.betreff.startsWith(`Ausgeführt: ${A1.nummer}`)) && amLinkVorbei.status === 400, `${vorBest?.ps} · ${amLinkVorbei.status} ${amLinkVorbei.j?.error ?? ""}`);
  const [sf1] = await sql`SELECT selbstfreigabe FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planA.id} AND nr = 1`;
  pruefe("Keine Selbstfreigabe vermerkt (die GF ist nicht Empfängerin von A)", sf1?.selbstfreigabe === false);
  const sicht1 = await leer.ruf(`/buchhaltung/extern/${fr1.token}`);
  pruefe("Link-Seite der Buchhaltung: volle IBAN, Teil „1 von 7“, Bank-Referenz leer", sicht1.status === 200 && sicht1.j?.auftrag?.iban === huebsch(IBAN.A)
    && sicht1.j?.auftrag?.plan?.teil === "1 von 7" && sicht1.j?.auftrag?.bankReferenz === null, JSON.stringify(sicht1.j?.auftrag?.plan));

  // ═══ T9 Bestätigung der Buchhaltung — Bank-Referenz freiwillig ═════════
  abschnitt("T9 Bestätigung der Buchhaltung (ohne und mit Bank-Referenz), leise ausgebucht, Beleg");
  const [{ t9 }] = await sql`SELECT NOW() AS t9`;
  const vorB9 = marke();
  const best1 = await leer.ruf(`/buchhaltung/extern/${fr1.token}/bestaetigen`, {});
  pruefe("Bestätigen OHNE Bank-Referenz → 200 (das Feld ist freiwillig)", best1.status === 200 && best1.j?.auftrag?.stand === "bestaetigt" && best1.j?.auftrag?.bankReferenz === null,
    `${best1.status} ${best1.j?.error ?? ""}`);
  const [z9] = await sql`
    SELECT o.status AS os, o.extern_bank_referenz AS ref, p.status AS ps, string_agg(c.status, ',') AS cs, bool_and(t.ausgefuehrt_am IS NOT NULL) AS teil,
           (SELECT COUNT(*)::int FROM fiaon_commission_statements s WHERE s.payout_id = p.id) AS abrechnungen
      FROM fiaon_buch_auftrag o JOIN fiaon_payouts p ON p.id = o.payout_id JOIN fiaon_commissions c ON c.payout_id = p.id
      JOIN fiaon_auszahlungsplan_teil t ON t.auftrag_id = o.id
     WHERE o.id = ${A1.id} GROUP BY o.status, o.extern_bank_referenz, p.status, p.id`;
  pruefe("Ausgebucht: Auftrag ausgeführt, Auszahlung + Provision ausgezahlt, Teil ausgeführt, Abrechnung erzeugt",
    z9?.os === "ausgefuehrt" && z9?.ref === null && z9?.ps === "ausgezahlt" && z9?.cs === "ausgezahlt" && z9?.teil === true && z9?.abrechnungen === 1, JSON.stringify(z9));
  const A2 = await auftragVonTeil(planA.id, 2);
  const fr2 = await freigeben(js, JS, A2.id, A2.nummer);
  pruefe("T8: Inhaber gibt als Einzelzeichner frei", fr2.t.r.j?.art === "einzel" && fr2.f.status === 200 && fr2.f.j?.auftrag?.freigabeArt === "einzel", `${fr2.f.status} ${fr2.f.j?.error ?? ""}`);
  const REF = `PRUEF-REF-${lauf}`.toUpperCase();
  const zuKurz = await leer.ruf(`/buchhaltung/extern/${fr2.token}/bestaetigen`, { bankReferenz: "ab" });
  pruefe("Bank-Referenz zu kurz → 400 mit Klartext („leer lassen“)", zuKurz.status === 400 && /Bank-Referenz/.test(zuKurz.j?.error ?? "") && /leer lassen/.test(zuKurz.j?.error ?? ""),
    zuKurz.j?.error);
  const best2 = await leer.ruf(`/buchhaltung/extern/${fr2.token}/bestaetigen`, { bankReferenz: REF });
  pruefe("Bestätigen MIT Bank-Referenz → 200, gespeichert", best2.status === 200 && best2.j?.auftrag?.bankReferenz === REF, `${best2.status} ${best2.j?.error ?? ""}`);
  await warteAuf(() => neueMails(vorB9).filter((m) => /Durchführungsbeleg/.test(m.betreff)).length >= 2, 8000);
  const [leise] = await sql`
    SELECT (SELECT COUNT(*)::int FROM fiaon_mail_log WHERE event IN ('agent_payout_done', 'commission_statement_issued') AND created_at > ${t9}) AS mails,
           (SELECT COUNT(*)::int FROM fiaon_agent_events WHERE agent_id = ${A} AND type = 'commission_statement_issued' AND meta LIKE '%"leise":true%' AND created_at > ${t9}) AS ereignisse`;
  pruefe("Leise: kein agent_payout_done / commission_statement_issued im Mailprotokoll, Ereignisse mit „leise“", leise?.mails === 0 && leise?.ereignisse === 2, JSON.stringify(leise));
  const belegPruefen = (mail: Mail | null | undefined, name: string, muster: RegExp[], extra = "") => {
    const pdf = mail ? anhaenge(mail).find((x) => x.endsWith(".pdf")) : undefined;
    if (!pdf) { pruefe(`${name}: PDF als Anhang`, false, mail?.betreff ?? "keine Mail"); return; }
    const text = pdfText(pdf);
    if (text === null) { uebersprungen(name, "pypdf fehlt — Beleg-Text nicht lesbar (PDF liegt bei)"); return; }
    const fehlt = muster.filter((re) => !re.test(text));
    pruefe(name, fehlt.length === 0, fehlt.length ? `fehlt: ${fehlt.map((r) => r.source).join(" | ")}` : extra);
  };
  const beleg1 = neueMails(vorB9).find((m) => m.an === GF && m.betreff.startsWith(`Ausgeführt: ${A1.nummer}`));
  belegPruefen(beleg1, "Beleg Teil 1 (an die GF): Plan-Kette, vier Augen, „Bank-Referenz … nicht angegeben“", [
    /Auszahlungsplan angelegt/i, /Teilbetrag 1 von 7 ausgelöst/i, /Vier-Augen-Prinzip \(Plan vom Inhaber mit TAN angelegt\)/i, /FIAON-Referenz/i,
    /Bank-Referenz \(laut Buchhaltung\) nicht angegeben/i, /Auszahlungsplan \(Teilbetrag\)/i,
  ]);
  const beleg2 = neueMails(vorB9).find((m) => m.an === JS && m.betreff.startsWith(`Ausgeführt: ${A2.nummer}`));
  belegPruefen(beleg2, "Beleg Teil 2 (an den Inhaber): Einzelzeichnung, Bank-Referenz der Buchhaltung", [
    /Einzelzeichnung des Inhabers \(Plan mit TAN angelegt\)/i, new RegExp(`Bank-Referenz \\(laut Buchhaltung\\) ${REF}`, "i"), /Teilbetrag 2 von 7 ausgelöst/i,
  ]);

  // ═══ T10 Doppelte Bank-Referenz ════════════════════════════════════════
  abschnitt("T10 Doppelte Bank-Referenz");
  const A3 = await auftragVonTeil(planA.id, 3);
  const fr3 = await freigeben(gf, GF, A3.id, A3.nummer);
  const dup = await leer.ruf(`/buchhaltung/extern/${fr3.token}/bestaetigen`, { bankReferenz: REF.toLowerCase() });
  pruefe("Dieselbe Bank-Referenz (klein geschrieben) für einen anderen Auftrag → 400", dup.status === 400 && /schon für einen anderen Auftrag/.test(dup.j?.error ?? ""),
    `${dup.status} ${dup.j?.error}`);
  const [d3] = await sql`SELECT status, extern_bestaetigt_am IS NULL AS offen FROM fiaon_buch_auftrag WHERE id = ${A3.id}`;
  pruefe("… der Auftrag bleibt offen bei der Buchhaltung", d3?.status === "freigegeben" && d3?.offen === true, JSON.stringify(d3));

  // ═══ T7b Selbstfreigabe ════════════════════════════════════════════════
  abschnitt("T7b Selbstfreigabe: die Geschäftsführung gibt einen Teilbetrag an sich selbst frei");
  const rG1 = await ausloesen(gf, planG.id);
  const lgG = await gf.ruf("/buchhaltung/auszahlungsplan");
  pruefe("Reiter (GF): Plan G ist ihr eigener (ichBinEmpfaenger)", (lgG.j?.plaene ?? []).find((p: any) => p.id === planG.id)?.ichBinEmpfaenger === true, `${rG1.status}`);
  const frG = await freigeben(gf, GF, Number(rG1.j?.auftrag?.id ?? 0), String(rG1.j?.auftrag?.nummer ?? "?"));
  const [sfG] = await sql`SELECT selbstfreigabe FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planG.id} AND nr = 1`;
  pruefe("Freigegeben, Selbstfreigabe vermerkt", frG.f.status === 200 && sfG?.selbstfreigabe === true, `${frG.f.status} ${frG.f.j?.error ?? ""} ${sfG?.selbstfreigabe}`);
  const vorBG = marke();
  const bestG = await leer.ruf(`/buchhaltung/extern/${frG.token}/bestaetigen`, {});
  await warteAuf(() => neueMails(vorBG).some((m) => m.an === GF && /Durchführungsbeleg/.test(m.betreff)), 8000);
  belegPruefen(neueMails(vorBG).find((m) => m.an === GF && /Durchführungsbeleg/.test(m.betreff)),
    "Beleg G: Selbstfreigabe ausdrücklich vermerkt", [/Freigabe durch die empfangende Person im Rahmen des vom Inhaber mit TAN angelegten Plans/i], `${bestG.status}`);
  const lgG2 = await js.ruf("/buchhaltung/auszahlungsplan");
  pruefe("Reiter: Plan G zählt eine Selbstfreigabe", (lgG2.j?.plaene ?? []).find((p: any) => p.id === planG.id)?.selbstfreigaben === 1);

  // ═══ T11 Ablehnen ══════════════════════════════════════════════════════
  abschnitt("T11 Ablehnen: Teil zurück in den Plan, Wartezeit bleibt verbraucht");
  const A4 = await auftragVonTeil(planA.id, 4);
  const [vorAbl] = await sql`SELECT naechste_ab FROM fiaon_auszahlungsplan WHERE id = ${planA.id}`;
  const [p4] = await sql`SELECT payout_id FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planA.id} AND nr = 4`;
  const ablOhne = await gf.ruf(`/buchhaltung/auftrag/${A4.id}/ablehnen`, { notiz: "" });
  const abl = await gf.ruf(`/buchhaltung/auftrag/${A4.id}/ablehnen`, { notiz: "Prüfstand Ablehnung" });
  const [nachAbl] = await sql`
    SELECT t.payout_id, (SELECT status FROM fiaon_payouts WHERE id = ${p4?.payout_id ?? 0}) AS ps,
           (SELECT string_agg(status, ',') FROM fiaon_commissions WHERE payout_id = ${p4?.payout_id ?? 0}) AS cs,
           (SELECT naechste_ab FROM fiaon_auszahlungsplan WHERE id = ${planA.id}) AS naechste_ab
      FROM fiaon_auszahlungsplan_teil t WHERE t.plan_id = ${planA.id} AND t.nr = 4`;
  pruefe("Ablehnen ohne Grund → 400; mit Grund (GF) → 200", ablOhne.status === 400 && abl.status === 200, `${ablOhne.status}/${abl.status} ${abl.j?.error ?? ""}`);
  pruefe("Auszahlung abgelehnt, Provision storniert (nie zurück auf „bestätigt“), Teil frei", nachAbl?.payout_id === null && nachAbl?.ps === "abgelehnt" && nachAbl?.cs === "storniert",
    JSON.stringify(nachAbl));
  pruefe("Wartezeit unverändert (der Takt bleibt verbraucht)", new Date(nachAbl?.naechste_ab).getTime() === new Date(vorAbl?.naechste_ab).getTime());
  await freiDrehen(planA.id);
  const rA4b = await ausloesen(js, planA.id);
  pruefe("Die nächste Auslösung nimmt denselben Teil (4)", rA4b.status === 200 && rA4b.j?.teil?.nr === 4, `${rA4b.status} nr=${rA4b.j?.teil?.nr} ${rA4b.j?.error ?? ""}`);

  // ═══ T12 Zurückrufen ═══════════════════════════════════════════════════
  abschnitt("T12 Erneut senden und Zurückrufen");
  const vorNeu = marke();
  const neuSenden = await gf.ruf(`/buchhaltung/auftrag/${A3.id}/an-buchhaltung`, {});
  let mNeu: Mail | null = null;
  await warteAuf(() => !!(mNeu = extMail(vorNeu, A3.nummer)), 4000);
  const tokNeu = tokenAus(mNeu);
  pruefe("Erneut an die Buchhaltung (GF): neuer Link, alter tot, IBAN wieder nur maskiert", neuSenden.status === 200 && !!tokNeu && tokNeu !== fr3.token
    && (await linkStatus(fr3.token)) === 404 && (await linkStatus(tokNeu)) === 200 && !(mNeu as Mail | null)?.text.includes(huebsch(IBAN.A)), `${neuSenden.status}`);
  const rrOhne = await js.ruf(`/buchhaltung/auftrag/${A3.id}/zurueckrufen`, {});
  pruefe("Zurückrufen ohne Grund → 400", rrOhne.status === 400, `${rrOhne.status} ${rrOhne.j?.error}`);
  const vorRr = marke();
  const rr = await js.ruf(`/buchhaltung/auftrag/${A3.id}/zurueckrufen`, { grund: "Prüfstand Rückruf" });
  pruefe("Zurückrufen (Inhaber) → 200, zurückgezogen", rr.status === 200 && rr.j?.auftrag?.status === "zurueckgezogen" && rr.j?.mail === true, `${rr.status} ${rr.j?.error ?? ""}`);
  pruefe("„Bitte NICHT ausführen“ mit dieser ZA an die Buchhaltung", neueMails(vorRr).some((m) => m.an === EXT && /^Bitte NICHT ausführen/.test(m.betreff) && m.betreff.includes(A3.nummer)));
  pruefe("Link danach tot (404)", (await linkStatus(tokNeu)) === 404);
  const [t3z] = await sql`
    SELECT t.payout_id, (SELECT status FROM fiaon_payouts p WHERE p.id = o.payout_id) AS ps, (SELECT string_agg(status, ',') FROM fiaon_commissions c WHERE c.payout_id = o.payout_id) AS cs
      FROM fiaon_auszahlungsplan_teil t, fiaon_buch_auftrag o WHERE t.plan_id = ${planA.id} AND t.nr = 3 AND o.id = ${A3.id}`;
  pruefe("Teil 3 wieder frei, Auszahlung abgelehnt, Provision storniert", t3z?.payout_id === null && t3z?.ps === "abgelehnt" && t3z?.cs === "storniert", JSON.stringify(t3z));
  const rrNach = await js.ruf(`/buchhaltung/auftrag/${A1.id}/zurueckrufen`, { grund: "Prüfstand zu spät" });
  pruefe("Zurückrufen nach der Bestätigung → 409", rrNach.status === 409 && /bestätigt/.test(rrNach.j?.error ?? ""), `${rrNach.status} ${rrNach.j?.error}`);
  const oC2 = await zurBuchhaltung(pC2);
  await sql`UPDATE fiaon_payouts SET status = 'ausgezahlt', processed_at = NOW() WHERE id = ${pC2}`;
  await sql`UPDATE fiaon_commissions SET status = 'ausgezahlt' WHERE payout_id = ${pC2}`;
  const vorRr2 = marke();
  const rr2 = await js.ruf(`/buchhaltung/auftrag/${oC2.id}/zurueckrufen`, { grund: "Prüfstand: schon gebucht" });
  const [c2] = await sql`SELECT (SELECT status FROM fiaon_payouts WHERE id = ${pC2}) AS ps, (SELECT status FROM fiaon_buch_auftrag WHERE id = ${oC2.id}) AS os`;
  pruefe("Auftrag zu schon gebuchter Auszahlung (ohne Plan): Rückruf schließt den Auftrag, Auszahlung bleibt „ausgezahlt“",
    rr2.status === 200 && c2?.os === "zurueckgezogen" && c2?.ps === "ausgezahlt" && (await linkStatus(oC2.token)) === 404
      && neueMails(vorRr2).some((m) => m.an === EXT && m.betreff.includes(oC2.nummer)), `${rr2.status} ${JSON.stringify(c2)}`);

  // ═══ T18 Pause ═════════════════════════════════════════════════════════
  abschnitt("T18 Pause: nichts auslösen, nichts freigeben; fortsetzen nur der Inhaber");
  const A5 = await auftragVonTeil(planA.id, 5);
  const pOhne = await gf.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/pause`, {});
  pruefe("Pause ohne Grund → 400 GRUND", pOhne.status === 400 && pOhne.j?.code === "GRUND", `${pOhne.status} ${pOhne.j?.code}`);
  const vorP = marke();
  const pa = await gf.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/pause`, { grund: "Prüfstand Pause" });
  await warteAuf(() => neueMails(vorP).some((m) => m.an === JS && /pausiert/.test(m.betreff)), 3000);
  pruefe("Pause (GF) → 200, Hinweis an den Inhaber", pa.status === 200 && neueMails(vorP).some((m) => m.an === JS && /pausiert/.test(m.betreff)), `${pa.status} ${pa.j?.error ?? ""}`);
  const lp = await gf.ruf("/buchhaltung/auszahlungsplan");
  const lpA = (lp.j?.plaene ?? []).find((p: any) => p.id === planA.id);
  pruefe("Reiter: Zustand „pausiert“, kein Auslösen, GF darf nicht fortsetzen", lpA?.zustand === "pausiert" && lpA?.darfAusloesen === false && lpA?.darfFortsetzen === false, lpA?.zustand);
  await freiDrehen(planA.id);
  const ausP = await ausloesen(gf, planA.id);
  pruefe("Auslösen im pausierten Plan → 409 NICHT_AKTIV", ausP.status === 409 && ausP.j?.code === "NICHT_AKTIV", `${ausP.status} ${ausP.j?.code}`);
  const vorTanP = marke();
  const tanP = await gf.ruf(`/buchhaltung/auftrag/${A5.id}/tan`, {});
  const frP = await gf.ruf(`/buchhaltung/auftrag/${A5.id}/freigeben`, { tan: "123456" });
  await warte(300);
  pruefe("TAN und Freigabe im pausierten Plan → 400, keine TAN-Mail", tanP.status === 400 && /pausiert/.test(tanP.j?.error ?? "") && frP.status === 400
    && /pausiert/.test(frP.j?.error ?? "") && !neueMails(vorTanP).some((m) => /^TAN /.test(m.betreff)), `${tanP.status}/${frP.status}`);
  const wGf = await gf.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/weiter`, {});
  const wJs = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/weiter`, {});
  pruefe("Fortsetzen: GF 403, Inhaber 200", wGf.status === 403 && wJs.status === 200, `${wGf.status}/${wJs.status}`);
  const tanW = await neueTan(gf, GF, `/buchhaltung/auftrag/${A5.id}/tan`, {});
  pruefe("Nach dem Fortsetzen: TAN wieder möglich", tanW.r.status === 200 && !!tanW.tan, `${tanW.r.status} ${tanW.r.j?.error ?? ""}`);

  // ═══ T19 Konto geändert / Empfänger gesperrt ═══════════════════════════
  abschnitt("T19 Konto geändert: nur diese Person steht, die andere läuft weiter");
  await kontoSetzen(A, IBAN.A2);
  const vorK = marke();
  const lk = await js.ruf("/buchhaltung/auszahlungsplan");
  const lkA = (lk.j?.plaene ?? []).find((p: any) => p.id === planA.id);
  await warteAuf(() => neueMails(vorK).some((m) => m.an === JS && /angehalten/.test(m.betreff)), 3000);
  pruefe("Plan A: Zustand „konto“, Inhaber darf das neue Konto bestätigen", lkA?.zustand === "konto" && lkA?.darfKontoBestaetigen === true && lkA?.kontoAktuellMasked === maske(IBAN.A2),
    `${lkA?.zustand} ${lkA?.sperrGrund ?? ""}`);
  await js.ruf("/buchhaltung/auszahlungsplan");
  await warte(400);
  pruefe("Hinweis „angehalten“ an den Inhaber genau einmal (nicht bei jedem Öffnen)", neueMails(vorK).filter((m) => m.an === JS && /angehalten/.test(m.betreff)).length === 1);
  await freiDrehen(planA.id);
  const kA_ = await ausloesen(gf, planA.id);
  pruefe("Auslösen für A → 409 KONTO", kA_.status === 409 && kA_.j?.code === "KONTO", `${kA_.status} ${kA_.j?.code}`);
  await freiDrehen(planB.id);
  const kB_ = await ausloesen(gf, planB.id);
  pruefe("B läuft weiter → 200", kB_.status === 200, `${kB_.status} ${kB_.j?.error ?? ""}`);
  const kt = await neueTan(js, JS, `/buchhaltung/auszahlungsplan/${planA.id}/konto/tan`, {});
  const kb = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/konto`, { tan: kt.tan });
  pruefe("Neues Konto mit TAN bestätigt", kt.r.status === 200 && kb.status === 200 && kb.j?.ibanMasked === maske(IBAN.A2), `${kt.r.status}/${kb.status} ${kb.j?.error ?? ""}`);
  const kA2_ = await ausloesen(gf, planA.id);
  const [kIban] = await sql`SELECT iban FROM fiaon_buch_auftrag WHERE id = ${kA2_.j?.auftrag?.id ?? 0}`;
  pruefe("Danach geht A wieder — auf das neue Konto", kA2_.status === 200 && bh.ibanSauber(kIban?.iban ?? "") === IBAN.A2, `${kA2_.status} ${kA2_.j?.error ?? ""}`);
  await sql`UPDATE fiaon_agents SET zugang_gesperrt_am = NOW() WHERE id = ${B}`;
  const vorS = marke();
  await gf.ruf("/buchhaltung/lage");
  await warteAuf(() => neueMails(vorS).some((m) => m.an === JS && /angehalten/.test(m.betreff)), 3000);
  const [gs] = await sql`SELECT konto_hinweis_am IS NOT NULL AS gesetzt FROM fiaon_auszahlungsplan WHERE id = ${planB.id}`;
  pruefe("Empfänger B gesperrt: Hinweis an den Inhaber (auch über die Übersicht)", gs?.gesetzt === true && neueMails(vorS).some((m) => m.an === JS && /angehalten/.test(m.betreff)));
  await sql`UPDATE fiaon_agents SET zugang_gesperrt_am = NULL WHERE id = ${B}`;
  await gf.ruf("/buchhaltung/lage");
  const [gs2] = await sql`SELECT konto_hinweis_am IS NULL AS frei FROM fiaon_auszahlungsplan WHERE id = ${planB.id}`;
  pruefe("Sperre aufgehoben: Merker zurückgesetzt", gs2?.frei === true);

  // ═══ T16 Sammellauf am 15. ═════════════════════════════════════════════
  abschnitt("T16 Sammellauf: neue Provisionen laufen normal, Plan-Teilbeträge nie");
  const kAneu = await provision(A, "A-NEU1", 6100, "bestaetigt"); // nach Planbeginn verdient
  const planProvVorher = async () => (await sql`
    SELECT string_agg(c.id || ':' || c.status || ':' || COALESCE(c.payout_id, 0), ',' ORDER BY c.id) AS s
      FROM fiaon_commissions c WHERE c.agent_id IN (${A}, ${C}) AND c.kind = ${KIND}`)[0]?.s ?? "";
  const planProv0 = await planProvVorher();
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('auszahlung_lauf_monat', '', NOW())
    ON CONFLICT (key) DO UPDATE SET value = '', updated_at = NOW()`;
  const stichtag = `${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7)}-15`;
  const lauf1: any = await mitStichtag(stichtag, () => agentMod.auszahlungstagLauf({ trocken: false }));
  const eA = (lauf1.anforderungen ?? []).find((x: any) => x.agentId === A);
  const eC = (lauf1.anforderungen ?? []).find((x: any) => x.agentId === C);
  pruefe("Sammellauf fällig (Stichtag 15.)", lauf1.laufFaellig === true && lauf1.tag === 15, `${lauf1.heute} fällig=${lauf1.laufFaellig}`);
  pruefe("A („verrechnet“): die NEUE Provision geht normal in die Auszahlung — nur sie", !!eA?.payoutId && eA?.amountCents === 6100, JSON.stringify(eA));
  pruefe("C („zusätzlich“): die alte bestätigte Provision geht normal in die Auszahlung", !!eC?.payoutId && eC?.amountCents === 7000, JSON.stringify(eC));
  const [lk1] = await sql`
    SELECT (SELECT status || ':' || COALESCE(payout_id, 0) FROM fiaon_commissions WHERE id = ${kAneu}) AS neu,
           (SELECT COUNT(*)::int FROM fiaon_commissions WHERE payout_id IN (${eA?.payoutId ?? 0}, ${eC?.payoutId ?? 0}) AND kind = ${KIND}) AS plan_in_lauf`;
  pruefe("Keine Plan-Provision in einer Sammel-Auszahlung, Plan-Provisionen unverändert", lk1?.neu === `in_auszahlung:${eA?.payoutId}` && lk1?.plan_in_lauf === 0
    && (await planProvVorher()) === planProv0, JSON.stringify(lk1));
  const zAuszVor = await sql`SELECT COUNT(*)::int AS n FROM fiaon_payouts WHERE agent_id IN (${A}, ${C})`;
  const lauf2: any = await mitStichtag(stichtag, () => agentMod.auszahlungstagLauf({ trocken: false }));
  const zAuszNach = await sql`SELECT COUNT(*)::int AS n FROM fiaon_payouts WHERE agent_id IN (${A}, ${C})`;
  pruefe("Zweiter Lauf im selben Monat legt nichts an", lauf2.schonGelaufen === true && (lauf2.anforderungen ?? []).length === 0 && zAuszNach[0].n === zAuszVor[0].n,
    `schon=${lauf2.schonGelaufen} n=${(lauf2.anforderungen ?? []).length}`);

  // ═══ T17 Wallet ════════════════════════════════════════════════════════
  abschnitt("T17 Wallet: Anfordern läuft normal, Verlauf ohne Teilbeträge, Plan-Block");
  // Das Onboarding-Tor ist für Prüfstand-Konten zu (kein unterschriebener Vertrag) — dort keine Rechtsnachweise
  // fälschen. Deshalb der echte Handler direkt, mit nachgebauter Anfrage und Antwort.
  const handler = (methode: string, pfad: string) => {
    const schicht = (agentMod.default as any).stack.find((l: any) => l.route?.path === pfad && l.route.methods?.[methode]);
    const kette = schicht?.route?.stack ?? [];
    return kette[kette.length - 1]?.handle as ((req: any, res: any) => Promise<void>) | undefined;
  };
  const rufHandler = (methode: string, pfad: string, agentId: number): Promise<{ status: number; j: any }> => {
    const h = handler(methode, pfad);
    if (!h) return Promise.resolve({ status: 0, j: { error: `Handler ${pfad} nicht gefunden` } });
    return new Promise((fertig) => {
      const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(j: any) { fertig({ status: this.statusCode, j }); return this; }, setHeader() {} };
      Promise.resolve(h({ agent: { id: agentId }, cookies: {}, headers: {}, body: {}, query: {} }, res)).catch((e: unknown) => fertig({ status: 599, j: { error: String(e) } }));
    });
  };
  const kAneu2 = await provision(A, "A-NEU2", 5500, "bestaetigt");
  const [q1, q2] = await Promise.all([rufHandler("post", "/agent/payouts/request", A), rufHandler("post", "/agent/payouts/request", A)]);
  const qOk = [q1, q2].filter((q) => q.status === 200);
  const [kn2] = await sql`SELECT status, payout_id FROM fiaon_commissions WHERE id = ${kAneu2}`;
  pruefe("Klick des Plan-Empfängers (zweimal gleichzeitig): genau EINE normale Auszahlung über die neue Provision",
    qOk.length === 1 && Number(qOk[0]?.j?.payout?.amount_cents) === 5500 && kn2?.status === "in_auszahlung" && Number(kn2?.payout_id) === Number(qOk[0]?.j?.payout?.id),
    `${q1.status}/${q2.status} ${JSON.stringify(qOk[0]?.j?.payout)} ${[q1, q2].find((q) => q.status !== 200)?.j?.error ?? ""}`);
  pruefe("Plan-Provisionen dabei unberührt", (await planProvVorher()) === planProv0);
  const w = await rufHandler("get", "/agent/payouts", A);
  const planPayoutsA = ((await sql`SELECT c.payout_id FROM fiaon_commissions c WHERE c.agent_id = ${A} AND c.kind = ${KIND}`) as any[]).map((r) => Number(r.payout_id));
  const [fertigA] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_auszahlungsplan_teil WHERE plan_id = ${planA.id} AND ausgefuehrt_am IS NOT NULL`;
  const [inAusz] = await sql`
    SELECT COALESCE(SUM(p.amount_cents), 0)::int AS s FROM fiaon_payouts p
     WHERE p.agent_id = ${A} AND p.status = 'angefordert' AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = ${KIND})`;
  pruefe("Wallet: Verlauf ohne Plan-Teilbeträge", w.status === 200 && !(w.j?.history ?? []).some((h: any) => planPayoutsA.includes(Number(h.id))), `${w.status} ${w.j?.error ?? ""}`);
  pruefe("Wallet: Plan-Block (Nummer, ausgeführt, verrechnet 9 Posten, Hinweis mit Sammelmail)", w.j?.plan?.nummer === planA.nummer && w.j?.plan?.ausgefuehrt?.anzahl === fertigA?.n
    && w.j?.plan?.verrechnet?.anzahl === 9 && /Sammelmail/.test(w.j?.plan?.hinweis ?? "") && w.j?.planFehler === null,
    JSON.stringify(w.j?.plan && { n: w.j.plan.nummer, a: w.j.plan.ausgefuehrt, v: w.j.plan.verrechnet }));
  pruefe("Wallet: „In Auszahlung“ ohne Plan-Teilbeträge", Number(w.j?.inAuszahlungCents) === inAusz?.s, `${w.j?.inAuszahlungCents} = ${inAusz?.s}`);

  // ═══ T15 Seitenwege ════════════════════════════════════════════════════
  abschnitt("T15 Seitenwege: Plan-Teilbeträge nur über ihren Reiter");
  const offenPlan = Number(kA2_.j?.auftrag?.payoutId ?? 0);
  const planAuftraegeJe = async () => (await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_buch_auftrag o
     WHERE EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = o.payout_id AND c.kind = ${KIND})`)[0]?.n;
  const vorSeiten = await planAuftraegeJe();
  const zf = await js.ruf(`/buchhaltung/auszahlung/${offenPlan}/zur-freigabe`, {});
  const aw = await gf.ruf(`/buchhaltung/auszahlung/${offenPlan}/anweisen`, {});
  pruefe("„Zur Freigabe“ und „Anweisen“ für einen Plan-Teilbetrag → 400 mit Klartext", zf.status === 400 && aw.status === 400 && /Auszahlungsplan/.test(zf.j?.error ?? "")
    && /Auszahlungsplan/.test(aw.j?.error ?? ""), `${zf.status} ${zf.j?.error} / ${aw.status}`);
  // Der Weg über die Buchhaltung für eine normale Auszahlung — dann darf das Chefbüro nicht daneben buchen.
  const oC1 = await zurBuchhaltung(pC1);
  const adm = new Sitzung();
  const tuer = await adm.ruf("/zugang/oeffnen", { code: ADMIN_CODE });
  pruefe("Admin-Tür des Prüfstands geöffnet", tuer.status === 200, String(tuer.status));
  const mpPlan = await adm.ruf(`/admin/payouts/${offenPlan}/mark-paid`, {});
  const rjPlan = await adm.ruf(`/admin/payouts/${offenPlan}/reject`, { reason: "Prüfstand" });
  pruefe("Chefbüro mark-paid / reject auf einen Plan-Teilbetrag → 409 AUSZAHLUNGSPLAN", mpPlan.status === 409 && mpPlan.j?.code === "AUSZAHLUNGSPLAN"
    && rjPlan.status === 409 && rjPlan.j?.code === "AUSZAHLUNGSPLAN", `${mpPlan.status} ${mpPlan.j?.code} / ${rjPlan.status} ${rjPlan.j?.code}`);
  const mpC1 = await adm.ruf(`/admin/payouts/${pC1}/mark-paid`, {});
  const rjC1 = await adm.ruf(`/admin/payouts/${pC1}/reject`, { reason: "Prüfstand" });
  pruefe("mark-paid / reject neben einem Auftrag bei der Buchhaltung → 409 BEI_BUCHHALTUNG mit ZA", mpC1.status === 409 && mpC1.j?.code === "BEI_BUCHHALTUNG"
    && mpC1.j?.auftrag === oC1.nummer && /zurückrufen/.test(mpC1.j?.error ?? "") && rjC1.status === 409 && rjC1.j?.code === "BEI_BUCHHALTUNG", `${mpC1.status} ${mpC1.j?.code} / ${rjC1.status}`);
  const rrC1 = await js.ruf(`/buchhaltung/auftrag/${oC1.id}/zurueckrufen`, { grund: "Prüfstand: im Chefbüro abschließen" });
  const rjC1b = await adm.ruf(`/admin/payouts/${pC1}/reject`, { reason: "Prüfstand nach Rückruf" });
  pruefe("Nach dem Rückruf geht der normale Weg im Chefbüro wieder (reject 200)", rrC1.status === 200 && rjC1b.status === 200, `${rrC1.status}/${rjC1b.status}`);
  const aa = await gf.ruf("/buchhaltung/auszahlungen/alle-anweisen", {});
  const az = await js.ruf("/buchhaltung/auszahlungen/alle-zur-freigabe", {});
  pruefe("„Alle anweisen“ / „Alle zur Freigabe“: kein Auftrag für Plan-Teilbeträge, ausgelassene gezählt", aa.status === 200 && az.status === 200
    && (az.j?.planTeile ?? 0) >= 1 && (await planAuftraegeJe()) === vorSeiten, `${aa.status}/${az.status} planTeile=${az.j?.planTeile}`);
  const [stPlan] = await sql`SELECT p.status AS ps, c.status AS cs FROM fiaon_payouts p JOIN fiaon_commissions c ON c.payout_id = p.id WHERE p.id = ${offenPlan}`;
  pruefe("Der Plan-Teilbetrag ist nach allen Versuchen unverändert", stPlan?.ps === "angefordert" && stPlan?.cs === "in_auszahlung", JSON.stringify(stPlan));
  const planPayouts = ((await sql`SELECT payout_id FROM fiaon_commissions WHERE kind = ${KIND} AND payout_id IS NOT NULL`) as any[]).map((r) => Number(r.payout_id));
  const ap1 = await adm.ruf("/admin/payouts");
  pruefe("/admin/payouts: keine Plan-Teilbeträge, Hinweiszeile da", ap1.status === 200 && !(ap1.j?.data ?? []).some((p: any) => planPayouts.includes(Number(p.id)))
    && !!ap1.j?.planHinweis?.text, `${ap1.status} ${ap1.j?.planHinweis?.text ?? ""}`);
  const bz = await js.ruf("/buchhaltung/auszahlungen");
  pruefe("Banking „Auszahlungen“: keine Plan-Teilbeträge, Zahl für die Hinweiszeile", bz.status === 200 && !(bz.j?.auszahlungen ?? []).some((p: any) => planPayouts.includes(Number(p.id)))
    && (bz.j?.planTeile?.offen ?? 0) >= 1, JSON.stringify(bz.j?.planTeile));
  const ba = await js.ruf("/buchhaltung/auftraege");
  pruefe("Banking „Aufträge“: keine Plan-Aufträge, Zahl der laufenden", ba.status === 200 && !(ba.j?.auftraege ?? []).some((a: any) => !!a.planTeilId) && (ba.j?.planAuftraegeLaufend ?? 0) >= 1,
    `laufend=${ba.j?.planAuftraegeLaufend}`);

  // ═══ T21 Beenden mit TAN ═══════════════════════════════════════════════
  abschnitt("T21 Beenden mit TAN: Eingereichtes zurückgezogen, Freigegebenes bleibt sichtbar");
  const A5f = await freigeben(js, JS, A5.id, A5.nummer);
  const eingereichtA = ((await sql`
    SELECT o.nummer FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
     WHERE t.plan_id = ${planA.id} AND o.status = 'eingereicht' ORDER BY o.id`) as any[]).map((r) => String(r.nummer));
  const et = await neueTan(js, JS, `/buchhaltung/auszahlungsplan/${planA.id}/ende/tan`, {});
  const eOhne = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/ende`, { tan: et.tan });
  pruefe("Beenden ohne Grund → 400", eOhne.status === 400, `${eOhne.status} ${eOhne.j?.error}`);
  const et2 = await neueTan(js, JS, `/buchhaltung/auszahlungsplan/${planA.id}/ende/tan`, {});
  const en = await js.ruf(`/buchhaltung/auszahlungsplan/${planA.id}/ende`, { grund: "Prüfstand Ende", tan: et2.tan });
  pruefe("Beenden → 200: alle eingereichten zurückgezogen, der freigegebene steht in der Liste", en.status === 200 && eingereichtA.length >= 1
    && eingereichtA.every((n) => (en.j?.zurueckgezogen ?? []).includes(n)) && (en.j?.beiBuchhaltung ?? []).some((x: any) => x.nummer === A5.nummer),
    `${en.status} ${en.j?.error ?? ""} zurück=${JSON.stringify(en.j?.zurueckgezogen)} bei=${JSON.stringify((en.j?.beiBuchhaltung ?? []).map((x: any) => x.nummer))}`);
  const le = await js.ruf("/buchhaltung/auszahlungsplan");
  pruefe("Reiter: Plan beendet, der Auftrag bei der Buchhaltung bleibt sichtbar (Rückruf möglich)", (le.j?.plaene ?? []).find((p: any) => p.id === planA.id)?.zustand === "beendet"
    && (le.j?.beiBuchhaltung ?? []).some((a: any) => a.id === A5.id && a.darfZurueckrufen === true));
  const nachEnde = await ausloesen(gf, planA.id);
  pruefe("Auslösen nach dem Ende → 409 NICHT_AKTIV", nachEnde.status === 409 && nachEnde.j?.code === "NICHT_AKTIV", `${nachEnde.status} ${nachEnde.j?.code}`);
  const bEnde = await leer.ruf(`/buchhaltung/extern/${A5f.token}/bestaetigen`, {});
  const [pe] = await sql`SELECT status FROM fiaon_auszahlungsplan WHERE id = ${planA.id}`;
  pruefe("Die Buchhaltung kann den freigegebenen noch bestätigen; der Plan bleibt „beendet“", bEnde.status === 200 && pe?.status === "beendet", `${bEnde.status} ${pe?.status}`);
  const [sumA] = await sql`
    SELECT COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('angefordert', 'ausgezahlt')), 0)::int AS s
      FROM fiaon_payouts p WHERE EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = ${KIND} AND c.ref LIKE ${`${planA.nummer}-T%`})`;
  pruefe("Plan A: nie mehr unterwegs oder gezahlt als der Anspruch", sumA?.s <= 6025, `${sumA?.s} ≤ 6025`);
  const nf = await gf.ruf("/buchhaltung/auszahlungsplan/999999/ausloesen", {});
  const nfx = await gf.ruf("/buchhaltung/auszahlungsplan/abc/ausloesen", {});
  pruefe("Unbekannter / kaputter Plan → 404", nf.status === 404 && nfx.status === 404, `${nf.status}/${nfx.status}`);

  // ═══ T6 Stau-Grenze ════════════════════════════════════════════════════
  abschnitt("T6 Stau-Grenze (C: höchstens 2 unterwegs)");
  const rC1 = await ausloesen(js, planC.id);
  await freiDrehen(planC.id);
  const rC2 = await ausloesen(js, planC.id);
  await freiDrehen(planC.id);
  const rC3 = await ausloesen(js, planC.id);
  pruefe("Zwei gehen, der dritte → 409 STAU", rC1.status === 200 && rC2.status === 200 && rC3.status === 409 && rC3.j?.code === "STAU",
    `${rC1.status}/${rC2.status}/${rC3.status} ${rC3.j?.code ?? ""}`);
  const ls = await js.ruf("/buchhaltung/auszahlungsplan");
  pruefe("Reiter: Zustand „stau“ mit Grund", (ls.j?.plaene ?? []).find((p: any) => p.id === planC.id)?.zustand === "stau");

  // ═══ T20 + T13 Sammelmitteilung und Obergrenze ═════════════════════════
  abschnitt("T20 Sammelmitteilung alle zehn Teile, T13 Obergrenze bis „fertig“");
  const meldungen = async () => {
    const zeilen = (await sql`
      SELECT l.status, (x.p ->> 'stand_anzahl') AS stand FROM fiaon_mail_log l
       CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(l.payload) = 'string' THEN (l.payload #>> '{}')::jsonb ELSE l.payload END AS p) x
       WHERE l.event = 'agent_auszahlungsplan_stand' AND (x.p ->> 'plan_nummer') = ${planC.nummer} ORDER BY l.id`) as any[];
    return zeilen.map((z) => ({ status: String(z.status), stand: String(z.stand) }));
  };
  const inhaberMeldungen = () => mails().filter((m) => m.an === JS && m.betreff.startsWith(`${planC.nummer}`));
  const summeC = async () => (await sql`
    SELECT COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('angefordert', 'ausgezahlt')), 0)::int AS unterwegs_oder_gezahlt,
           COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'ausgezahlt'), 0)::int AS gezahlt,
           COUNT(*) FILTER (WHERE p.status = 'ausgezahlt')::int AS n_gezahlt, COUNT(*) FILTER (WHERE p.status = 'abgelehnt')::int AS n_abgelehnt,
           COUNT(*) FILTER (WHERE p.status NOT IN ('ausgezahlt', 'abgelehnt'))::int AS n_rest, COUNT(*)::int AS n
      FROM fiaon_payouts p WHERE EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = ${KIND} AND c.ref LIKE ${`${planC.nummer}-T%`})`)[0];
  let hoechst = 0;
  let ausgefuehrt = 0;
  let schritteOk = true;
  const ausfuehren = async (auftragId: number, nummer: string, k: number) => {
    const f = await freigeben(gf, GF, auftragId, nummer);
    const b = await leer.ruf(`/buchhaltung/extern/${f.token}/bestaetigen`, k % 3 === 0 ? {} : { bankReferenz: `PRUEF-${lauf}-C${k}` });
    const ok = f.f.status === 200 && b.status === 200;
    if (!ok) { schritteOk = false; console.log(`   (Teil ${nummer}: Freigabe ${f.f.status} ${f.f.j?.error ?? ""} / Bestätigung ${b.status} ${b.j?.error ?? ""})`); }
    hoechst = Math.max(hoechst, (await summeC()).unterwegs_oder_gezahlt);
    return ok;
  };
  for (const r of [rC1, rC2]) if (await ausfuehren(Number(r.j?.auftrag?.id ?? 0), String(r.j?.auftrag?.nummer ?? "?"), ++ausgefuehrt)) { /* gezählt */ }
  let abgelehnt = false;
  let zurueckgerufen = false;
  let nachZehn = { mails: -1, log: -1 };
  while (ausgefuehrt < 12) {
    await freiDrehen(planC.id);
    let r = await ausloesen(js, planC.id);
    if (r.status !== 200) { schritteOk = false; console.log(`   (Auslösen C: ${r.status} ${r.j?.code} ${r.j?.error ?? ""})`); break; }
    if (ausgefuehrt === 3 && !abgelehnt) {
      const nr = r.j?.teil?.nr;
      const x = await gf.ruf(`/buchhaltung/auftrag/${r.j?.auftrag?.id}/ablehnen`, { notiz: "Prüfstand: gemischte Abfolge" });
      abgelehnt = x.status === 200;
      await freiDrehen(planC.id);
      r = await ausloesen(js, planC.id);
      pruefe("Gemischte Abfolge: nach dem Ablehnen derselbe Teil", abgelehnt && r.status === 200 && r.j?.teil?.nr === nr, `${x.status} ${nr} → ${r.j?.teil?.nr}`);
    }
    if (ausgefuehrt === 3 && !zurueckgerufen) {
      const nr = r.j?.teil?.nr;
      const f = await freigeben(gf, GF, Number(r.j?.auftrag?.id ?? 0), String(r.j?.auftrag?.nummer ?? "?"));
      const x = await js.ruf(`/buchhaltung/auftrag/${r.j?.auftrag?.id}/zurueckrufen`, { grund: "Prüfstand: gemischte Abfolge" });
      zurueckgerufen = f.f.status === 200 && x.status === 200;
      await freiDrehen(planC.id);
      r = await ausloesen(js, planC.id);
      pruefe("Gemischte Abfolge: nach dem Rückruf derselbe Teil", zurueckgerufen && r.status === 200 && r.j?.teil?.nr === nr, `${x.status} ${nr} → ${r.j?.teil?.nr}`);
      hoechst = Math.max(hoechst, (await summeC()).unterwegs_oder_gezahlt);
    }
    await ausfuehren(Number(r.j?.auftrag?.id ?? 0), String(r.j?.auftrag?.nummer ?? "?"), ++ausgefuehrt);
    if (ausgefuehrt === 10) {
      await warteAuf(async () => inhaberMeldungen().length >= 1 && (await meldungen()).length >= 1, 8000);
      const ms = inhaberMeldungen();
      const lg = await meldungen();
      const [m10] = await sql`SELECT meilenstein FROM fiaon_auszahlungsplan WHERE id = ${planC.id}`;
      pruefe("10. ausgeführter Teil: genau eine Sammelmeldung an den Inhaber „10 von 12“", ms.length === 1 && /: 10 von 12 Teilbeträgen ausgeführt/.test(ms[0]?.betreff ?? "") && m10?.meilenstein === 10,
      ms.map((m) => m.betreff).join(" | "));
      pruefe("… und genau eine Sammelmitteilung an den Empfänger über das Mailwerk (Stand 10)", lg.length === 1 && lg[0].stand === "10", JSON.stringify(lg));
      const [zu] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_commission_statements s JOIN fiaon_auszahlungsplan_teil t ON t.payout_id = s.payout_id WHERE t.plan_id = ${planC.id} AND s.gesendet_am IS NOT NULL`;
      pruefe("Abrechnungen gelten nur bei Zustellung als zugestellt (Prüfstand ohne Mailweg: keine)", lg[0]?.status === "ok" ? zu?.n === 10 : zu?.n === 0, `Mailwerk ${lg[0]?.status} · zugestellt ${zu?.n}`);
      nachZehn = { mails: ms.length, log: lg.length };
    }
    if (ausgefuehrt === 11) {
      await warte(1200);
      pruefe("11. Teil: keine weitere Sammelmeldung", inhaberMeldungen().length === nachZehn.mails && (await meldungen()).length === nachZehn.log,
        `${inhaberMeldungen().length} / ${(await meldungen()).length}`);
    }
  }
  pruefe("Alle Schritte der Abfolge gingen durch (Auslösen, Freigabe, Bestätigung)", schritteOk && ausgefuehrt === 12 && abgelehnt && zurueckgerufen, `ausgeführt ${ausgefuehrt}`);
  await warteAuf(() => inhaberMeldungen().some((m) => /abgeschlossen/.test(m.betreff)), 8000);
  const [pc] = await sql`SELECT status, meilenstein FROM fiaon_auszahlungsplan WHERE id = ${planC.id}`;
  pruefe("Nach dem 12. Teil: Plan „fertig“, Abschlussmeldung an den Inhaber", pc?.status === "fertig" && pc?.meilenstein === 12 && inhaberMeldungen().some((m) => /abgeschlossen/.test(m.betreff)),
    JSON.stringify(pc));
  const vorFertig = await summeC();
  await freiDrehen(planC.id);
  const nochmal = await ausloesen(js, planC.id);
  const nachFertig = await summeC();
  pruefe("Weiteres Auslösen → 409, keine 13. Auszahlung", nochmal.status === 409 && ["FERTIG", "NICHT_AKTIV"].includes(nochmal.j?.code) && nachFertig.n === vorFertig.n,
    `${nochmal.status} ${nochmal.j?.code}`);
  pruefe("Summe der gezahlten Teilbeträge = Anspruch (12 gezahlt, 2 abgelehnt, nichts offen)", nachFertig.gezahlt === 12000 && nachFertig.n_gezahlt === 12
    && nachFertig.n_abgelehnt === 2 && nachFertig.n_rest === 0, JSON.stringify(nachFertig));
  pruefe("Zu keinem Zeitpunkt mehr unterwegs oder gezahlt als der Anspruch", hoechst > 0 && hoechst <= 12000, `höchstens ${hoechst}`);
  const [storno] = await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_commissions c JOIN fiaon_payouts p ON p.id = c.payout_id
     WHERE c.kind = ${KIND} AND c.ref LIKE ${`${planC.nummer}-T%`} AND p.status = 'abgelehnt' AND c.status <> 'storniert'`;
  pruefe("Provisionen der abgelehnten Versuche storniert (nie zurück auf „bestätigt“)", storno?.n === 0, String(storno?.n));
  const [ohneRef] = await sql`
    SELECT COUNT(*) FILTER (WHERE extern_bank_referenz IS NULL)::int AS ohne, COUNT(*) FILTER (WHERE extern_bank_referenz IS NOT NULL)::int AS mit,
           (SELECT indexdef FROM pg_indexes WHERE indexname = 'fiaon_buch_auftrag_extref_uq') AS idx
      FROM fiaon_buch_auftrag WHERE plan_teil_id IS NOT NULL AND status = 'ausgefuehrt' AND extern_bestaetigt_am >= ${laufStart}`;
  pruefe("Bank-Referenz freiwillig: viele Bestätigungen ohne Referenz nebeneinander, eindeutig nur die angegebenen (Teilindex, groß/klein egal)",
    ohneRef?.ohne >= 4 && ohneRef?.mit >= 4 && /upper\(extern_bank_referenz\)/i.test(ohneRef?.idx ?? "") && /WHERE \(extern_bank_referenz IS NOT NULL\)/.test(ohneRef?.idx ?? ""),
    `ohne ${ohneRef?.ohne}, mit ${ohneRef?.mit}`);

  // ═══ Ende des Laufs: offene Pläne regulär beenden (mit TAN, wie ein Mensch) ═══
  abschnitt("Ende des Laufs: offene Pläne mit TAN beenden");
  for (const p of [planB, planG]) {
    const t = await neueTan(js, JS, `/buchhaltung/auszahlungsplan/${p.id}/ende/tan`, {});
    const e = await js.ruf(`/buchhaltung/auszahlungsplan/${p.id}/ende`, { grund: "Prüfstand: Ende des Laufs", tan: t.tan });
    pruefe(`${p.nummer} beendet (eingereichte Teilbeträge zurückgezogen: ${(e.j?.zurueckgezogen ?? []).length})`, e.status === 200, `${e.status} ${e.j?.error ?? ""}`);
  }
  const [rest] = await sql`
    SELECT COUNT(*)::int AS n FROM fiaon_buch_auftrag o JOIN fiaon_auszahlungsplan_teil t ON t.id = o.plan_teil_id
     WHERE t.plan_id = ANY(${[planA.id, planB.id, planC.id, planG.id]}) AND o.status IN ('entwurf', 'eingereicht', 'freigegeben')`;
  pruefe("Kein laufender Plan-Auftrag dieses Laufs bleibt zurück", rest?.n === 0, String(rest?.n));
}

/**
 * Ein Prüfstand-Konto am Ende stilllegen (AGENTS.md). Die Wand aus db/migrations/072_pruefstands-wand.sql lässt die
 * Testkonto-Marke nicht neu setzen, sobald Provisionen am Konto hängen — und ein Plan-Empfänger hat welche. Dann nur
 * abschalten (inaktiv, ohne Passwort, aus der Verteilung, „— stillgelegt“ im Namen); gelöscht wird nichts.
 */
async function kontoStilllegen(sql: any, sicht: any, id: number): Promise<"markiert" | "abgeschaltet"> {
  try {
    await sicht.testkontoStilllegen(id);
    return "markiert";
  } catch {
    await sql`
      UPDATE fiaon_agents SET active = FALSE, password_hash = NULL, distribution_active = FALSE,
             name = CASE WHEN name LIKE '%— stillgelegt' THEN name ELSE CONCAT(name, ' — stillgelegt') END
       WHERE id = ${id}`;
    return "abgeschaltet";
  }
}

/** Rot-Probe: das Rennen ohne Takt-Netz. Mit der Zeilensperre im Code grün, ohne sie rot. */
async function rotProbeRennen(): Promise<void> {
  const { sqlPool: sql } = (await import("../server/lib/db-pool")) as any;
  const bh: any = await import("../server/lib/fiaon-buchhaltung");
  const ap: any = await import("../server/lib/fiaon-auszahlungsplan");
  const agentMod: any = await import("../server/routes/fiaon-agent");
  const sicht: any = await import("../server/lib/fiaon-mitarbeiter-sicht");
  const JS: string = bh.inhaber().email;
  const GF: string = bh.geschaeftsfuehrung().email;
  const lauf = Date.now().toString(36);
  abschnitt("ROT-PROBE Rennen ohne Takt-Netz");
  await bh.buchSchema();
  await ap.planSchema(); // vor dem Ausbau: der Lauf selbst baut das Netz sonst gleich wieder ein
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('buchhaltung_passwort_hash', ${await bcrypt.hash(PW, 10)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  const [r] = await sql`
    INSERT INTO fiaon_agents (name, email, first_name, last_name, active)
    VALUES (${`Planprobe R ${lauf}`}, ${`planprobe-r-${lauf}@fiaon.invalid`}, 'Planprobe', 'R', TRUE) RETURNING id`;
  const R = Number(r.id);
  await sql`
    UPDATE fiaon_agents SET bank_iban_enc = ${agentMod.encryptSecret(IBAN.R)}, bank_holder_enc = ${agentMod.encryptSecret("Planprobe Kontoinhaber")},
           bank_bic_enc = ${agentMod.encryptSecret("COBADEFFXXX")}, bank_iban_masked = ${bh.ibanMaskiert(IBAN.R)} WHERE id = ${R}`;
  const anmelden = async (person: string): Promise<Sitzung> => {
    const s = new Sitzung();
    await s.ruf("/buchhaltung/anmelden", { email: bh.BUCH_LOGIN, passwort: PW });
    const vorher = marke();
    await s.ruf("/buchhaltung/pin-anfordern", { email: person });
    let pin = "";
    await warteAuf(() => !!(pin = ((neueMails(vorher).filter((x) => x.an === person && /^PIN /.test(x.betreff)).pop()?.text ?? "").match(/\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/) || [])[1] ?? ""), 4000);
    const pp = await s.ruf("/buchhaltung/pin-pruefen", { email: person, pin });
    if (pp.status !== 200) abbruch(`PIN abgewiesen (${person}): ${JSON.stringify(pp.j)}`);
    return s;
  };
  const js = await anmelden(JS);
  const gf = await anmelden(GF);
  const ein = { empfaenger: [{ agentId: R, anspruchCents: 10000 }], teilCents: 1000, abstandMin: 15, maxOffen: 10, altposten: "zusaetzlich", grund: `Prüfstand Rot-Probe ${lauf}` };
  const vorher = marke();
  await js.ruf("/buchhaltung/auszahlungsplan/neu/tan", ein);
  let tan = "";
  await warteAuf(() => !!(tan = tanAus(neueMails(vorher).filter((x) => x.an === JS && /^TAN /.test(x.betreff)).pop())), 4000);
  const anl = await js.ruf("/buchhaltung/auszahlungsplan/neu", { ...ein, tan });
  const plan = anl.j?.plaene?.[0];
  if (!plan) abbruch(`Plan für die Rot-Probe nicht angelegt: ${JSON.stringify(anl.j)}`);
  await js.ruf("/buchhaltung/auszahlungsplan"); // der Server legt sein Schema an, bevor das Netz fällt
  await sql.unsafe("ALTER TABLE fiaon_auszahlungsplan_takt DROP CONSTRAINT IF EXISTS fiaon_auszahlungsplan_takt_kein_doppel");
  try {
    for (let runde = 1; runde <= 3; runde++) {
      for (const k of (await sql`SELECT id FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${plan.id} ORDER BY ausgeloest_am ASC, id ASC`) as any[]) {
        await sql`UPDATE fiaon_auszahlungsplan_takt SET ausgeloest_am = ausgeloest_am - INTERVAL '20 minutes', sperre_bis = sperre_bis - INTERVAL '20 minutes' WHERE id = ${k.id}`;
      }
      await sql`UPDATE fiaon_auszahlungsplan SET naechste_ab = NOW() - INTERVAL '1 minute', letzte_ausloesung_am = letzte_ausloesung_am - INTERVAL '20 minutes' WHERE id = ${plan.id}`;
      const [vor] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${plan.id}`;
      const [a, b] = await Promise.all([gf.ruf(`/buchhaltung/auszahlungsplan/${plan.id}/ausloesen`, {}), js.ruf(`/buchhaltung/auszahlungsplan/${plan.id}/ausloesen`, {})]);
      const [nach] = await sql`SELECT COUNT(*)::int AS n FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${plan.id}`;
      const ok = [a, b].filter((x) => x.status === 200 && x.j?.schon === false).length;
      pruefe(`Rennen ohne Takt-Netz, Runde ${runde}: genau EINE Auslösung`, ok === 1 && nach.n === vor.n + 1, `${a.status} ${a.j?.code ?? a.j?.teil?.nr} / ${b.status} ${b.j?.code ?? b.j?.teil?.nr} · Takt +${nach.n - vor.n}`);
    }
  } finally {
    // Netz wieder einbauen: überlappende Fenster dieses Plans auseinanderlegen (nur Prüf-DB), dann wie in planSchema.
    for (const k of (await sql`SELECT id FROM fiaon_auszahlungsplan_takt WHERE plan_id = ${plan.id} ORDER BY id`) as any[]) {
      await sql`UPDATE fiaon_auszahlungsplan_takt SET ausgeloest_am = TIMESTAMPTZ '2000-01-01 00:00:00+00' + ${Number(k.id)}::int * INTERVAL '1 minute',
                sperre_bis = TIMESTAMPTZ '2000-01-01 00:00:00+00' + ${Number(k.id)}::int * INTERVAL '1 minute' + INTERVAL '30 seconds' WHERE id = ${k.id}`;
    }
    const [ext] = await sql`SELECT 1 AS da FROM pg_extension WHERE extname = 'btree_gist' LIMIT 1`;
    const element = ext ? "plan_id WITH =" : "int8range(plan_id, plan_id, '[]') WITH =";
    await sql.unsafe(`ALTER TABLE fiaon_auszahlungsplan_takt ADD CONSTRAINT fiaon_auszahlungsplan_takt_kein_doppel
      EXCLUDE USING gist (${element}, tstzrange(ausgeloest_am, sperre_bis, '[)') WITH &&)`);
    const [da] = await sql`SELECT 1 AS da FROM pg_constraint WHERE conname = 'fiaon_auszahlungsplan_takt_kein_doppel'`;
    console.log(da ? "Takt-Netz wieder eingebaut." : "ACHTUNG: Takt-Netz NICHT wieder eingebaut — Server neu starten (planSchema baut es ein).");
    await sql`UPDATE fiaon_auszahlungsplan SET status = 'beendet', status_von = 'pruefstand', status_am = NOW(), status_grund = 'Prüfstand: Rot-Probe' WHERE id = ${plan.id}`;
    await kontoStilllegen(sql, sicht, R);
  }
}

async function start(): Promise<void> {
  const { sqlPool: sql } = (await import("../server/lib/db-pool")) as any;
  try {
    if (ROT_PROBE === "rennen") await rotProbeRennen();
    else await mainMitAufraeumen();
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

/** Der Hauptlauf mit Aufräumen, das IMMER läuft — auch nach einem Absturz mitten im Lauf. */
async function mainMitAufraeumen(): Promise<void> {
  const { sqlPool: sql } = (await import("../server/lib/db-pool")) as any;
  const sicht: any = await import("../server/lib/fiaon-mitarbeiter-sicht");
  const bh: any = await import("../server/lib/fiaon-buchhaltung");
  const [vorher] = await sql`SELECT COALESCE(MAX(id), 0)::int AS id FROM fiaon_agents`;
  const GF: string = bh.geschaeftsfuehrung().email;
  const [gAlt] = await sql`
    SELECT id, active, is_test_account, zugang_gesperrt_am, bank_iban_enc, bank_holder_enc, bank_bic_enc, bank_iban_masked
      FROM fiaon_agents WHERE LOWER(email) = LOWER(${GF}) LIMIT 1`;
  try {
    await main();
  } catch (e) {
    console.error("ABSTURZ:", e);
    rot.push("Lauf abgestürzt (siehe oben)");
  } finally {
    // Prüfstand-Konten dieses Laufs stilllegen (AGENTS.md) — ihre Pläne enden mit.
    const konten = (await sql`SELECT id FROM fiaon_agents WHERE id > ${vorher.id} AND email LIKE 'planprobe-%@fiaon.invalid'`) as any[];
    const art = { markiert: 0, abgeschaltet: 0 };
    for (const k of konten) art[await kontoStilllegen(sql, sicht, Number(k.id))] += 1;
    console.log(`\nPrüfstand-Konten: ${art.markiert} als Testkonto stillgelegt, ${art.abgeschaltet} nur abgeschaltet (Provisionen hängen daran — Wand aus Migration 072).`);
    const ids = konten.map((k) => Number(k.id));
    const [gNeu] = await sql`SELECT id FROM fiaon_agents WHERE LOWER(email) = LOWER(${GF}) LIMIT 1`;
    if (gNeu) ids.push(Number(gNeu.id));
    if (ids.length) {
      await sql`
        UPDATE fiaon_auszahlungsplan SET status = 'beendet', status_von = 'pruefstand', status_am = NOW(), status_grund = 'Prüfstand: Ende des Laufs'
         WHERE agent_id = ANY(${ids}) AND status IN ('aktiv', 'pausiert')`;
    }
    if (gAlt) {
      await sql`
        UPDATE fiaon_agents SET active = ${gAlt.active}, is_test_account = ${gAlt.is_test_account}, zugang_gesperrt_am = ${gAlt.zugang_gesperrt_am},
               bank_iban_enc = ${gAlt.bank_iban_enc}, bank_holder_enc = ${gAlt.bank_holder_enc}, bank_bic_enc = ${gAlt.bank_bic_enc}, bank_iban_masked = ${gAlt.bank_iban_masked}
         WHERE id = ${gAlt.id}`;
    } else if (gNeu) {
      await kontoStilllegen(sql, sicht, Number(gNeu.id));
    }
    if (gNeu) {
      await sql`
        UPDATE fiaon_provision_vormerkung SET status = 'verworfen', erledigt_am = NOW(), erledigt_von = 'pruefstand', note = 'Prüfstand aufgeräumt'
         WHERE agent_id = ${Number(gNeu.id)} AND ref LIKE 'PRUEF-PLAN-%' AND status = 'offen'`;
    }
  }
}

start()
  .then(() => {
    console.log(`\n${gruen.length} grün, ${rot.length} rot${ohne.length ? `, ${ohne.length} übersprungen` : ""}`);
    if (rot.length) { console.log("ROT:"); rot.forEach((r) => console.log(`  · ${r}`)); }
    if (ohne.length) { console.log("ÜBERSPRUNGEN:"); ohne.forEach((r) => console.log(`  · ${r}`)); }
    process.exit(rot.length ? 1 : 0);
  })
  .catch((e) => {
    console.error("ABBRUCH:", e);
    console.log(`\n${gruen.length} grün, ${rot.length} rot (abgebrochen)`);
    process.exit(2);
  });
