// ═══════════════════════════════════════════════════════════════════════════
// EINE TEILZAHLUNG AUF EINE FIAON-GLOBAL-RECHNUNG BUCHEN (E-469, 30.10.2026)
//
// Ruft GENAU die Plattform-Funktion, die auch der Knopf im Chefbüro ruft (Konto › Zubuchen › „Als Teilzahlung buchen“):
// teilzahlungPruefen (Vorschau) bzw. teilzahlungBuchen (schreiben) aus server/lib/fiaon-teilzahlung.ts — kein eigenes SQL.
//
//   --txn <id|AWX-…>   der Bankeingang (fiaon_bank_txns.id oder txn_id)
//   --ref <FIAON-…>    die Rechnung: Bestellnummer (FIAON-XXXXXXXX-XXXX) oder Verwendungszweck (FIAON-XXXXXX)
//   --wer "<Name>"     steht im Vermerk (Vorgabe „Skript global-teilzahlung-buchen“)
//   --schreiben        bucht (lokal nur in eine Prüf-DB fiaon_pruefstand_…); gegen die Produktion zusätzlich --produktion
//   --nachholen        nur den Abschluss nachholen: Summe = Rechnungsbetrag, Bestellung noch nicht bezahlt → alsBezahltBuchen
//
// Vorgabe: NUR VORSCHAU über eine nur lesende Verbindung (default_transaction_read_only) — es kann nichts geschrieben werden.
// Mails, Webhooks und Netz sind in diesem Lauf abgeklemmt. Deshalb bucht das Skript in der Produktion KEINEN Abschluss
// (die Zahlung, die die Rechnung voll macht, startet den Auftrag samt Startmail) — dafür den Knopf im Chefbüro nehmen.
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   Vorschau gegen die Produktion (Adresse wird nicht ausgegeben):
//     sh ~/Developer/it-rettung/werkzeuge/ro-env.sh node_modules/.bin/tsx scripts/global-teilzahlung-buchen.ts --produktion --txn <id> --ref FIAON-…
//   Schreiben (nach dem Deploy, mit Justins Go, ARAS-Wache vorher): DATABASE_URL = Produktion OHNE Nur-Lesen-Zusatz, dazu
//     … --produktion --schreiben --txn <id> --ref FIAON-… --wer "Justin"
//   Lokal: DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_… … --txn <id> --ref FIAON-… --schreiben
// Am Ende eine Zeile „ERGEBNIS {…}“; Exit 1, wenn abgelehnt.
// Das Repo ist öffentlich: hier steht kein Kundendatum — Bankeingang und Rechnung kommen nur aus dem Aufruf.
// ═══════════════════════════════════════════════════════════════════════════

export {};
const MIT_WERT = ["--txn", "--ref", "--wer"];
const OHNE_WERT = ["--schreiben", "--produktion", "--nachholen"];
const argv = process.argv.slice(2);
const werte = new Map<string, string>();
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (MIT_WERT.includes(a)) {
    const w = argv[i + 1];
    if (w === undefined || w.startsWith("--")) abbruch(`${a} braucht einen Wert.`);
    werte.set(a, String(w)); i++;
  } else if (OHNE_WERT.includes(a)) schalter.add(a);
  else abbruch(`Unbekannter Schalter „${a}“ (erlaubt: ${[...MIT_WERT, ...OHNE_WERT].join(", ")}).`);
}
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
const nachholen = schalter.has("--nachholen");
const ref = String(werte.get("--ref") ?? "").trim().toUpperCase();
const txnRoh = String(werte.get("--txn") ?? "").trim();
const wer = String(werte.get("--wer") ?? "Skript global-teilzahlung-buchen").slice(0, 80);
if (!/^FIAON-?[A-Z0-9]{6,8}(-[A-Z0-9]{4})?$/.test(ref)) abbruch("--ref FIAON-… fehlt (Bestellnummer oder Verwendungszweck).");
if (!nachholen && !/^(\d{1,9}|(AWX|TRANSFER)-[A-Za-z0-9-]{4,80})$/.test(txnRoh)) abbruch("--txn <id> oder --txn AWX-… fehlt.");
const bank: number | string = /^\d+$/.test(txnRoh) ? Number(txnRoh) : txnRoh;

// ── Sicherheit: wohin, und was ist abgeklemmt ────────────────────────────────
let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = ""; let dbName = "";
try { const u = new URL(url); host = u.hostname; dbName = u.pathname.replace(/^\//, ""); } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch("DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion.");
if (lokal && produktion) abbruch("--produktion, aber DATABASE_URL zeigt auf 127.0.0.1/localhost — bitte prüfen.");
if (schreiben && lokal && !/^fiaon_pruefstand_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB (Name fiaon_pruefstand_…), nicht in „${dbName}“.`);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async (eingabe: unknown) => { throw new Error(`Teilzahlungs-Skript: kein Netz (${String((eingabe as any)?.url ?? eingabe).slice(0, 60)})`); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const { sqlPool } = await import("../server/lib/db-pool");
const T = await import("../server/lib/fiaon-teilzahlung");
const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const tag = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const ende = async (code: number, erg: Record<string, unknown>) => {
  console.log(`ERGEBNIS ${JSON.stringify(erg)}`);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(code);
};

console.log("FIAON Global — Teilzahlung buchen (E-469)");
console.log(`Datenbank ${lokal ? `lokal (${dbName})` : "PRODUKTION"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"} · handelnd: ${wer}`);

if (nachholen) {
  const [a] = (await sqlPool`SELECT ref FROM fiaon_applications WHERE (ref = ${ref} OR UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${ref.replace(/[^A-Z0-9]/g, "")}) AND merged_into IS NULL`) as any[];
  if (!a) await ende(1, { ok: false, error: `Zu ${ref} gibt es keine Rechnung.` });
  const s = (await T.teilzahlungenLesen([String(a.ref)])).get(String(a.ref));
  console.log(`Rechnung  ${a.ref} · Teilzahlungen ${eur(s?.bezahltCents ?? 0)} (${s?.zahlungen.length ?? 0})`);
  if (!schreiben) await ende(0, { ok: true, vorschau: true, ref: a.ref, bezahltCents: s?.bezahltCents ?? 0 });
  if (produktion) await ende(1, { ok: false, error: "Den Abschluss (Start + Startmail) in der Produktion bitte über das Chefbüro — in diesem Skript sind Mails abgeklemmt." });
  const r = await T.teilzahlungAbschliessen(String(a.ref), `teilzahlung-nachholen:${wer}`);
  await ende(r.ok ? 0 : 1, { ...r, ref: a.ref });
}

const p = await T.teilzahlungPruefen(bank, ref);
const z = p.zeile;
if (z) {
  console.log(`Eingang   #${z.id} ${z.txnId} · ${tag(z.datum)} · ${eur(z.betragCents)} · Zweck „${(z.zweck ?? "—").slice(0, 80)}“`);
}
if (!p.ok || !z?.teilzahlung) {
  console.log(`  [abgelehnt] ${p.error ?? z?.ergebnis ?? "nicht buchbar"}`);
  await ende(1, { ok: false, error: p.error ?? z?.ergebnis ?? "nicht buchbar" });
}
const t = z!.teilzahlung!;
console.log(`Rechnung  ${t.rechnungsnummer ?? "—"} · ${t.zahlungsreferenz} · ${t.ref} · Betrag ${eur(t.sollCents)} · zahlbar bis ${tag(t.faelligAm)}`);
console.log(`Plan      bisher ${eur(t.bisherCents)} + dieser ${eur(t.dieserCents)} = ${eur(t.bisherCents + t.dieserCents)} → ${t.ueberzahlung ? "ÜBERZAHLUNG (wird nicht gebucht)" : t.abschluss ? "voll bezahlt (normaler Bezahlt-Weg)" : `offen ${eur(t.offenCents)}`}`);
console.log(`Ergebnis  ${z!.ergebnis}`);
for (const h of z!.hinweise) console.log(`  Hinweis: ${h}`);
for (const m of z!.mails) console.log(`  Mail:    ${m}`);
for (const pr of z!.provision) console.log(`  Provision: ${pr}`);
if (!schreiben) await ende(z!.buchen ? 0 : 1, { ok: z!.buchen, vorschau: true, ...t });
if (t.ueberzahlung) await ende(1, { ok: false, error: "Überzahlung — bitte im Chefbüro „Als Teilzahlung buchen“ (legt die Aufgabe an) oder erstatten." });
if (t.abschluss && produktion) await ende(1, { ok: false, error: "Diese Zahlung schließt die Rechnung ab (Start + Startmail) — in der Produktion bitte über das Chefbüro buchen (Mails sind hier abgeklemmt)." });
const b = await T.teilzahlungBuchen(bank, { ziel: ref, wer, erwartet: { ziel: z!.ziel, bisherCents: t.bisherCents } });
console.log(b.ok ? `  [gebucht] ${b.zeile?.ergebnis ?? ""}` : `  [abgelehnt] ${b.error}`);
await ende(b.ok ? 0 : 1, { ok: b.ok, error: b.error ?? null, abschluss: b.abschluss ?? false, bezahlt: b.bezahlt ?? null, ref: t.ref, dieserCents: t.dieserCents, offenCents: t.offenCents });
