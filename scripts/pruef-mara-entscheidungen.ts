// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-370 (15.10.2026): Maras Entscheidungen — Anlegen, Werkzeuge,
// „erledigt von selbst", Später.
//
// Justin: „Mara soll ALLES selbst machen können … wenn sie ne Entscheidung
// braucht, dann soll ich es mit 1 Klick entscheiden können."
//
// NUR gegen das lokale Postgres 127.0.0.1:54329 (eigene Kopie, Schema per Migrationen):
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_e370
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e370 node scripts/run-migrations.mjs
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e370 npx tsx scripts/pruef-mara-entscheidungen.ts
//
// Fährt den ECHTEN Code (fiaon-mara-entscheidungen → antragBuchen, ratenStornieren,
// bankeingangBuchen …) mit erfundenen Datensätzen (Marke Q370, Adressen auf .invalid).
// Jeder Netzaufruf ist abgeklemmt (Bestätigungsmail, Make, Meta). Räumt vorher und nachher auf.
//   A  Anlegen idempotent, entschiedene Karte bleibt, Register (werkzeugRegistrieren), Fehler, Link
//   B  Raten nach Vertragsende: Sammelkarte, Storno NUR nach dem Ende, Jahresvertrag bleibt draußen, Rücknahme
//   C  „erledigt von selbst" — beim Klick und im Sammler
//   D  Kündigung nie gebucht: buchen über antragBuchen, „Ist keine Kündigung", Empfehlung
//   E  Mahnstopp: weiter erinnern, Raten stornieren (Kunde hat recht), Empfehlung
//   F  Werbesperre auf eine Zahlungsmail: aufheben → nur Zahlungspost, Stopp-Merkmal der Mail weg
//   G  Geld eingegangen: eindeutig buchen, „kein Kundengeld"
//   H  Später
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";

const URL = String(process.env.DATABASE_URL || "");
if (!/@127\.0\.0\.1:54329\//.test(URL)) throw new Error("Nur gegen den lokalen Prüfstand 127.0.0.1:54329!");
process.env.CRONS = "aus";
process.env.WISE_AUS = "1";
process.env.NODE_ENV = "development";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "META_CAPI_TOKEN", "AIRWALLEX_API_KEY",
  "WHATSAPP_WABA_ID", "WHATSAPP_PHONE_ID", "WHATSAPP_TOKEN", "ANTHROPIC_API_KEY"]) delete process.env[k];

const sql = postgres(URL, { ssl: "require", max: 2, onnotice: () => {} });
const M = "Q370";
const VON = "Prüfstand Q370";

let blockiert = 0;
globalThis.fetch = (async (url: any) => {
  blockiert++;
  return new Response(`blockiert: ${String(url).split("?")[0]}`, { status: 599 });
}) as any;

let geprueft = 0, fehler = 0;
const ok = (name: string, bed: boolean, info: unknown = "") => {
  geprueft++;
  if (!bed) fehler++;
  console.log(`${bed ? "  ok  " : "  ROT "} ${name}${info !== "" ? `  — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
};
const tag = (versatz: number) => new Date(Date.now() + versatz * 86_400_000).toISOString().slice(0, 10);
const zeit = (versatzTage: number) => new Date(Date.now() + versatzTage * 86_400_000).toISOString();

async function aufraeumen() {
  const refs = (await sql`SELECT ref FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`).map((r: any) => r.ref);
  const personen = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE ${`PRUEF-${M}-%`}`).map((r: any) => Number(r.id));
  if (refs.length) {
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM cancellation_requests WHERE ref = ANY(${refs})`;
    await sql`DELETE FROM fiaon_provision_vormerkung WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_commissions WHERE ref = ANY(${refs})`.catch(() => {});
  }
  if (personen.length) {
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${personen})`;
    await sql`DELETE FROM fiaon_postmeister WHERE person_id = ANY(${personen})`;
    await sql`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${personen})`;
    await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${personen})`.catch(() => {});
  }
  await sql`DELETE FROM fiaon_mail_log WHERE empfaenger LIKE ${`%@${M.toLowerCase()}.invalid`}`.catch(() => {});
  await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`}`;
  const todos = (await sql`SELECT id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`%${M}%`} OR link LIKE ${`%${M}%`} OR titel LIKE ${`%${M}%`}`.catch(() => [])).map((r: any) => Number(r.id));
  if (todos.length) {
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ANY(${todos})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE id = ANY(${todos})`.catch(() => {});
  }
  await sql`DELETE FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`}`;
  if (personen.length) await sql`DELETE FROM fiaon_persons WHERE id = ANY(${personen})`;
  await sql`DELETE FROM fiaon_mara_entscheidungen WHERE schluessel LIKE ${`q370:%`} OR person_id = ANY(${personen.length ? personen : [0]})
              OR art IN ('raten_nach_ende', 'eingang_unverbucht', 'wa_vorlagen')`.catch(() => {});
}

/** Person + Bestellung. */
async function kunde(x: string, o: {
  status?: string; agb?: string | null; gekuendigtAm?: string | null; paidAt?: string | null; mahnstoppAm?: string | null;
  pack?: string; cents?: number; pr?: string;
}) {
  const ref = `FIAON-${M}${x}-TEST`;
  const pr = o.pr ?? `FIAON-${M}${x}`.slice(0, 12);
  const [p] = await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email)
    VALUES (${`PRUEF-${M}-${x}`}, ${`Probe${x}`}, ${`Kunde${x}`}, ${`kunde-${x.toLowerCase()}@${M.toLowerCase()}.invalid`}) RETURNING id`;
  const status = o.status ?? "paid";
  await sql`
    INSERT INTO fiaon_applications (ref, payment_reference, payment_status, status, type, pack_key, pack_name, amount_due,
                                    email, first_name, last_name, person_id, created_at, paid_at, completed_at, agb_stand, gekuendigt_am, mahnstopp_am)
    VALUES (${ref}, ${pr}, ${status}, ${status === "paid" ? "payment_completed" : "payment_pending"}, 'private',
            ${o.pack ?? "pro"}, ${`Prüf ${x}`}, ${(o.cents ?? 5999) / 100},
            ${`kunde-${x.toLowerCase()}@${M.toLowerCase()}.invalid`}, ${`Probe${x}`}, ${`Kunde${x}`}, ${p.id},
            ${o.paidAt ?? zeit(-120)}, ${status === "paid" ? (o.paidAt ?? zeit(-120)) : null}, ${status === "paid" ? (o.paidAt ?? zeit(-120)) : null},
            ${o.agb === undefined ? "2026-07-01" : o.agb}, ${o.gekuendigtAm ?? null}, ${o.mahnstoppAm ?? null})`;
  return { ref, pr, personId: Number(p.id) };
}
const rate = async (ref: string, nr: number, faellig: string, o: { bezahlt?: string | null; cents?: number } = {}) => {
  const [r] = await sql`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle)
    VALUES (${ref}, ${nr}, ${`${ref}-${nr}`}, ${o.cents ?? 5999}, ${faellig}, ${o.bezahlt ? "bezahlt" : "offen"}, ${o.bezahlt ?? null}, 'auto')
    RETURNING id`;
  return Number(r.id);
};
const rateLesen = async (id: number) => (await sql`SELECT status, storno_grund, mahnstufe FROM fiaon_abo_raten WHERE id = ${id}`)[0] as any;
const karteLesen = async (schluesselOderId: string | number) => (typeof schluesselOderId === "number"
  ? await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE id = ${schluesselOderId}`
  : await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE schluessel = ${schluesselOderId}`)[0] as any;

async function main() {
  await aufraeumen().catch(() => {});
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  const { kuendigungZuruecknehmen } = await import("../server/lib/fiaon-kuendigung");
  const { ratenNachVertragsendeStornieren } = await import("../server/lib/fiaon-raten-storno");
  await E.entscheidungTabellen();
  await aufraeumen();

  // ── A: Anlegen, Register ────────────────────────────────────────────────
  console.log("\nA  Anlegen idempotent, Register, Fehler, Link");
  const optionen = [
    { key: "ja", label: "Ja", werkzeug: "q370_probe", ton: "gut" as const, args: { wert: 7 } },
    { key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" as const },
    { key: "weg", label: "Weg", werkzeug: "q370_gibtsnicht" },
    { key: "link", label: "Öffnen", werkzeug: "link", link: "/chef/s/konto" },
  ];
  const a1 = await E.entscheidungAnlegen({ schluessel: "q370:a:1", art: "q370_test", titel: "Erste Fassung", text: "Text", empfehlung: "ja", optionen });
  const a2 = await E.entscheidungAnlegen({ schluessel: "q370:a:1", art: "q370_test", titel: "Zweite Fassung", text: "Text", empfehlung: "ja", optionen });
  ok("A neu angelegt, beim zweiten Mal dieselbe Karte (nicht neu)", !!a1?.neu && !!a2 && a2.id === a1!.id && a2.neu === false, { a1, a2 });
  ok("A offene Karte wird aufgefrischt (Titel)", (await karteLesen("q370:a:1"))?.titel === "Zweite Fassung");
  let wirft = false;
  try { await E.entscheidungAnlegen({ schluessel: "q370:a:x", art: "q370_test", titel: "x", text: "x", empfehlung: "fehlt", optionen }); } catch { wirft = true; }
  ok("A Empfehlung außerhalb der Optionen wird abgelehnt", wirft);
  let gerufen: any = null;
  E.werkzeugRegistrieren("q370_probe", async (args, k) => { gerufen = { args, von: k.von, karte: k.karte.schluessel }; return E.ausfuehrErgebnis.erledigt(`Probe ${args.wert}`); });
  const fLink = await E.entscheiden(a1!.id, "link", { von: VON });
  ok("A Link-Option entscheidet nichts (400)", !fLink.ok && fLink.status === 400, fLink.error);
  const fUnb = await E.entscheiden(a1!.id, "weg", { von: VON });
  ok("A unbekanntes Werkzeug → Fehler in der Karte, Karte bleibt offen", !fUnb.ok && (await karteLesen(a1!.id)).status === "offen" && /Unbekanntes Werkzeug/.test(String((await karteLesen(a1!.id)).fehler)), fUnb.error);
  const e1 = await E.entscheiden(a1!.id, "ja", { von: VON });
  ok("A Werkzeug aus werkzeugRegistrieren läuft mit Argumenten und Wer", e1.ok && gerufen?.args?.wert === 7 && gerufen?.von === VON && e1.karte?.ergebnis === "Probe 7", { gerufen, karte: e1.karte?.ergebnis });
  ok("A Karte entschieden, gewählt, Fehler gelöscht", e1.karte?.status === "entschieden" && e1.karte?.gewaehlt === "ja" && !e1.karte?.fehler && e1.karte?.entschiedenVon === VON);
  const a3 = await E.entscheidungAnlegen({ schluessel: "q370:a:1", art: "q370_test", titel: "Dritte Fassung", text: "Text", empfehlung: "ja", optionen });
  ok("A entschiedene Karte gleichen Schlüssels bleibt unberührt (null, Titel wie vorher)", a3 === null && (await karteLesen("q370:a:1"))?.titel === "Zweite Fassung");
  const e1b = await E.entscheiden(a1!.id, "lassen", { von: VON });
  ok("A zweiter Klick auf entschiedene Karte tut nichts", e1b.ok && e1b.schon === true && (await karteLesen(a1!.id)).gewaehlt === "ja");
  ok("A alle Werkzeuge der Detektoren sind angemeldet",
    ["nichts", "raten_nach_ende_stornieren", "kuendigung_buchen", "kuendigungsantrag_schliessen", "einwand_anerkennen", "mahnstopp_aufheben",
      "bankeingang_buchen", "bankeingang_zuordnen", "bankeingang_kein_kunde", "werbesperre_aufheben", "wa_vorlagen_einreichen"].every((n) => E.entscheidungWerkzeugNamen().includes(n)),
    E.entscheidungWerkzeugNamen());

  // ── B: Raten nach Vertragsende ──────────────────────────────────────────
  console.log("\nB  Raten nach Vertragsende — Storno NUR nach dem Ende");
  // Altvertrag, Raten am 10., gekündigt am 12.09. → Frist 13.09. liegt in 10.09.–09.10. → Vertragsende 09.10.2026.
  const B = await kunde("B", { agb: "2026-07-01", gekuendigtAm: "2026-09-12T10:00:00+02:00", paidAt: "2026-08-10T10:00:00+02:00" });
  const rB1 = await rate(B.ref, 1, "2026-08-10", { bezahlt: "2026-08-10T10:00:00+02:00" });
  const rB2 = await rate(B.ref, 2, "2026-09-10");
  const rB3 = await rate(B.ref, 3, "2026-10-10");
  const rB4 = await rate(B.ref, 4, "2026-11-10");
  // Jahresvertrag (ab 03.09.2026): nie auf der Karte.
  const BJ = await kunde("BJ", { agb: "2026-09-10", gekuendigtAm: "2026-09-12T10:00:00+02:00", paidAt: "2026-08-10T10:00:00+02:00" });
  await rate(BJ.ref, 1, "2026-08-10", { bezahlt: "2026-08-10T10:00:00+02:00" });
  const rBJ2 = await rate(BJ.ref, 2, "2026-11-10");
  const faelle = await E.ratenNachEndeFaelle(sql as any, [B.ref, BJ.ref]);
  const fB = faelle.find((f) => f.ref === B.ref);
  ok("B Vertragsende 09.10. (Abrechnungsmonat), Raten 3 und 4 danach, Rate 2 davor", fB?.ende === "2026-10-09" && fB.raten.map((r) => r.rate_nr).join(",") === "3,4" && fB.bisEnde.map((r) => r.rate_nr).join(",") === "2", fB);
  ok("B Jahresvertrag steht nicht drin", !faelle.some((f) => f.ref === BJ.ref));
  const sB = await E.entscheidungenSammeln({ nur: ["raten_nach_ende"] });
  const kB = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = 'raten_nach_ende' AND status = 'offen'`)[0] as any;
  const argsB = (kB?.optionen ?? []).find((o: any) => o.key === "stornieren")?.args;
  ok("B Sammelkarte angelegt, Empfehlung „stornieren“, Liste mit der Person", !!kB && kB.empfehlung === "stornieren" && sB.je.raten_nach_ende?.karten === 1
    && (kB.belege as any[]).some((b) => b.art === "zeile" && b.personId === B.personId), { titel: kB?.titel });
  ok("B Argumente nennen nur Raten 3 und 4 (nicht 2, nicht den Jahresvertrag)",
    JSON.stringify(argsB?.faelle?.find((f: any) => f.ref === B.ref)?.ids?.sort()) === JSON.stringify([rB3, rB4].sort()) && !argsB?.faelle?.some((f: any) => f.ref === BJ.ref));
  // Die Wand in der Anweisung selbst: eine Rate bis zum Ende fällt nie, auch wenn der Aufrufer sie mitschickt.
  const wand = await ratenNachVertragsendeStornieren(B.ref, [rB2], "2026-10-09", sql as any);
  ok("B ratenNachVertragsendeStornieren lässt Rate 2 (vor dem Ende) stehen", wand.length === 0 && (await rateLesen(rB2)).status === "offen");
  const eB = await E.entscheiden(Number(kB.id), "stornieren", { von: VON });
  const [r2, r3, r4, r1] = [await rateLesen(rB2), await rateLesen(rB3), await rateLesen(rB4), await rateLesen(rB1)];
  ok("B Klick: Raten 3 und 4 storniert (Grund nach_vertragsende, Mahnstufe 0)", r3.status === "storniert" && r4.status === "storniert" && r3.storno_grund === "nach_vertragsende" && Number(r4.mahnstufe) === 0, { r3, r4 });
  ok("B Rate 2 (vor dem Ende) bleibt offen, Rate 1 bezahlt", r2.status === "offen" && r1.status === "bezahlt", { r2 });
  ok("B Jahresvertrag unberührt", (await rateLesen(rBJ2)).status === "offen");
  ok("B Ergebnis in der Karte: Anzahl und Betrag", eB.ok && eB.karte?.status === "entschieden" && /2 Raten bei 1 Person storniert, 119,98 €/.test(String(eB.karte?.ergebnis)), eB.karte?.ergebnis ?? eB.error);
  const vB = (await sql`SELECT note FROM fiaon_contact_log WHERE ref = ${B.ref} AND note LIKE '%nach dem Vertragsende%'`) as any[];
  ok("B Vermerk im Verlauf der Person", vB.length === 1 && /09\.10\.2026/.test(vB[0].note), vB[0]?.note);
  await E.entscheidungenSammeln({ nur: ["raten_nach_ende"] });
  const nachB = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_entscheidungen WHERE art = 'raten_nach_ende' AND status = 'offen'`)[0] as any;
  ok("B danach keine neue Karte (nichts mehr nach dem Ende offen)", nachB.n === 0);
  const zurueck = await kuendigungZuruecknehmen(B.ref, "Prüfstand Q370");
  ok("B Rücknahme der Kündigung holt die Raten nach dem Ende zurück", zurueck.ratenZurueck === 2 && (await rateLesen(rB3)).status === "offen", zurueck);

  // ── C: erledigt von selbst ──────────────────────────────────────────────
  console.log("\nC  „erledigt von selbst“ — beim Klick und im Sammler");
  const C = await kunde("C", { agb: null, gekuendigtAm: "2026-09-12T10:00:00+02:00", paidAt: "2026-08-10T10:00:00+02:00" });
  await rate(C.ref, 1, "2026-08-10", { bezahlt: "2026-08-10T10:00:00+02:00" });
  const rC3 = await rate(C.ref, 2, "2026-10-10");
  await E.entscheidungenSammeln({ nur: ["raten_nach_ende"] });
  const kC = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = 'raten_nach_ende' AND status = 'offen'`)[0] as any;
  ok("C neue Sammelkarte mit neuer Nummer (die alte ist entschieden)", !!kC && kC.schluessel !== kB.schluessel && /^raten_nach_ende#\d+$/.test(kC.schluessel), kC?.schluessel);
  await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW() WHERE id = ${rC3}`;
  const eC = await E.entscheiden(Number(kC.id), "stornieren", { von: VON });
  ok("C Lage hat sich erledigt (bezahlt) → „erledigt_von_selbst“, nichts storniert", eC.ok && eC.karte?.status === "erledigt_von_selbst" && (await rateLesen(rC3)).status === "bezahlt", eC.karte?.ergebnis);

  // ── D: Kündigung nie gebucht ────────────────────────────────────────────
  console.log("\nD  Kündigung nie gebucht");
  const { istWillenserklaerung } = await import("../server/lib/fiaon-kuendigung");
  ok("D Formulargrund „Die Kosten sind zu hoch“ ist eine Kündigung", E.antragIstKuendigung("Die Kosten sind zu hoch", istWillenserklaerung));
  ok("D „Wie kann ich kündigen?“ ist keine", !E.antragIstKuendigung("Wie kann ich kündigen?", istWillenserklaerung));
  const D = await kunde("D", { agb: "2026-07-01", paidAt: zeit(-50) });
  await rate(D.ref, 1, tag(-50), { bezahlt: zeit(-50) });
  const rD2 = await rate(D.ref, 2, tag(-20));
  const rD3 = await rate(D.ref, 3, tag(10));
  const [cD] = await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at)
    VALUES (${D.ref}, 'ProbeD', 'KundeD', ${`kunde-d@${M.toLowerCase()}.invalid`}, 'Die Kosten sind zu hoch', 'pending', ${zeit(-20)}) RETURNING id`;
  const D2 = await kunde("D2", { agb: "2026-07-01", paidAt: zeit(-50) });
  await rate(D2.ref, 1, tag(-50), { bezahlt: zeit(-50) });
  const [cD2] = await sql`INSERT INTO cancellation_requests (ref, first_name, last_name, email, reason, status, created_at)
    VALUES (${D2.ref}, 'ProbeD2', 'KundeD2', ${`kunde-d2@${M.toLowerCase()}.invalid`}, 'Wie kann ich kündigen, falls ich umziehe?', 'pending', ${zeit(-5)}) RETURNING id`;
  await E.entscheidungenSammeln({ nur: ["kuendigung_ungebucht"] });
  const kD = await karteLesen(`kuendigung_ungebucht:${cD.id}`);
  const kD2 = await karteLesen(`kuendigung_ungebucht:${cD2.id}`);
  ok("D zwei Karten, Empfehlung buchen bzw. „Ist keine Kündigung“", kD?.empfehlung === "buchen" && kD2?.empfehlung === "keine", { d: kD?.empfehlung, d2: kD2?.empfehlung });
  ok("D Karte nennt Person und Ziel", kD?.person_id === D.personId && kD?.ref === D.ref);
  const eD = await E.entscheiden(Number(kD.id), "buchen", { von: VON });
  const aD = (await sql`SELECT gekuendigt_am, kuendigung_quelle, letzte_rate_nr FROM fiaon_applications WHERE ref = ${D.ref}`)[0] as any;
  const cDn = (await sql`SELECT status, created_at::timestamptz AS am FROM cancellation_requests WHERE id = ${cD.id}`)[0] as any;
  ok("D buchen: Kündigung zum Eingangstag, Quelle formular, Antrag bestätigt", !!aD.gekuendigt_am && aD.kuendigung_quelle === "formular"
    && Math.abs(new Date(aD.gekuendigt_am).getTime() - new Date(cDn.am).getTime()) < 1000 && cDn.status === "confirmed", { aD, cDn, e: eD.error });
  ok("D Karte entschieden mit Ergebnis „… gekündigt …“", eD.ok && eD.karte?.status === "entschieden" && /zum \d\d\.\d\d\.\d{4} gekündigt/.test(String(eD.karte?.ergebnis)), eD.karte?.ergebnis ?? eD.error);
  // Raten am Tag −50/−20/+10; Kündigung am Tag −20 (Fälligkeitstag der Rate 2) → Abrechnungsmonat bis Tag +9: Rate 2 geschuldet, Rate 3 entfällt.
  ok("D Raten nach der Regel (kuendigungSetzen): Rate 2 bleibt, Rate 3 entfällt", (await rateLesen(rD2)).status === "offen" && (await rateLesen(rD3)).status === "storniert",
    { r2: await rateLesen(rD2), r3: await rateLesen(rD3) });
  const eD2 = await E.entscheiden(Number(kD2.id), "keine", { von: VON });
  const cD2n = (await sql`SELECT status, admin_note FROM cancellation_requests WHERE id = ${cD2.id}`)[0] as any;
  const aD2 = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = ${D2.ref}`)[0] as any;
  ok("D „Ist keine Kündigung“: Antrag geschlossen (rejected), Vertrag läuft", eD2.ok && cD2n.status === "rejected" && !aD2.gekuendigt_am, cD2n);
  await E.entscheidungenSammeln({ nur: ["kuendigung_ungebucht"] });
  ok("D nach dem Buchen: keine neue Karte für diese Anträge", (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_entscheidungen WHERE art = 'kuendigung_ungebucht' AND status = 'offen' AND person_id IN (${D.personId}, ${D2.personId})`)[0].n === 0);

  // ── E: Mahnstopp ────────────────────────────────────────────────────────
  console.log("\nE  Postmeister-Mahnstopp");
  ok("E Empfehlung: bestreitet → lassen, nichts erkennbar → erinnern",
    E.mahnstoppEmpfehlung("Kunde bestreitet die Forderung").key === "lassen" && E.mahnstoppEmpfehlung("Bitte erst Rückruf").key === "erinnern");
  const mahnKunde = async (x: string, grund: string) => {
    const k = await kunde(x, { paidAt: zeit(-60), mahnstoppAm: zeit(-10) });
    await rate(k.ref, 1, tag(-60), { bezahlt: zeit(-60) });
    const r2 = await rate(k.ref, 2, tag(-20));
    const am = (await sql`SELECT mahnstopp_am FROM fiaon_applications WHERE ref = ${k.ref}`)[0].mahnstopp_am;
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, note, created_at) VALUES (${k.ref}, ${k.personId}, 'Postmeister', 'system', ${`Zahlungserinnerungen angehalten — ${grund}`}, ${am})`;
    await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, betreff, empfangen_am, kategorie, person_id, zusammenfassung)
              VALUES ('support@fiaon.com', ${`q370-${x}`}, ${`q370-${x}`}, 'Re: Ihre Monatsrate 2', ${zeit(-10.01)}, 'zahlung', ${k.personId}, 'Der Kunde schreibt zur Rate.')`;
    return { ...k, r2, am };
  };
  const E1 = await mahnKunde("E1", "Kunde bestreitet die Forderung");
  const E2 = await mahnKunde("E2", "Bitte erst Rückruf");
  const E3 = await mahnKunde("E3", "Bitte erst Rückruf");
  // Gegenprobe: Mahnstopp VOR der ersten Zahlung (Rückholung) — gilt für Raten nicht, keine Karte.
  const E4 = await kunde("E4", { paidAt: zeit(-60), mahnstoppAm: zeit(-90) });
  await rate(E4.ref, 1, tag(-60), { bezahlt: zeit(-60) });
  await rate(E4.ref, 2, tag(-20));
  await E.entscheidungenSammeln({ nur: ["mahnstopp"] });
  const karten = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = 'mahnstopp' AND ref LIKE ${`FIAON-${M}%`}`) as any[];
  const kE1 = karten.find((k) => k.ref === E1.ref), kE2 = karten.find((k) => k.ref === E2.ref), kE3 = karten.find((k) => k.ref === E3.ref);
  ok("E drei Karten, keine für den Mahnstopp vor der ersten Zahlung", !!kE1 && !!kE2 && !!kE3 && !karten.some((k) => k.ref === E4.ref), karten.map((k) => k.ref));
  ok("E Empfehlung je Grund, Grund und letzte Nachricht als Zitat", kE1?.empfehlung === "lassen" && kE2?.empfehlung === "erinnern"
    && (kE1.belege as any[]).filter((b) => b.art === "zitat").length === 2, kE1?.belege);
  const eE2 = await E.entscheiden(Number(kE2.id), "erinnern", { von: VON });
  ok("E „Weiter erinnern“: Mahnstopp weg, Rate offen, Karte entschieden",
    eE2.ok && !(await sql`SELECT mahnstopp_am FROM fiaon_applications WHERE ref = ${E2.ref}`)[0].mahnstopp_am && (await rateLesen(E2.r2)).status === "offen", eE2.karte?.ergebnis ?? eE2.error);
  const eE1 = await E.entscheiden(Number(kE1.id), "stornieren", { von: VON });
  const aE1 = (await sql`SELECT abo_gestoppt_am, mahnstopp_am FROM fiaon_applications WHERE ref = ${E1.ref}`)[0] as any;
  ok("E „Raten stornieren (Kunde hat recht)“: Rate storniert (einwand_anerkannt), Abo gestoppt",
    eE1.ok && (await rateLesen(E1.r2)).storno_grund === "einwand_anerkannt" && !!aE1.abo_gestoppt_am && /1 Rate storniert, 59,99 €/.test(String(eE1.karte?.ergebnis)), eE1.karte?.ergebnis ?? eE1.error);
  await sql`UPDATE fiaon_applications SET mahnstopp_am = NULL WHERE ref = ${E3.ref}`;
  const sE = await E.entscheidungenSammeln({ nur: ["mahnstopp"] });
  ok("E Sammler: Mahnstopp anderswo aufgehoben → Karte „erledigt_von_selbst“", (await karteLesen(Number(kE3.id))).status === "erledigt_von_selbst" && sE.je.mahnstopp.erledigt >= 1);
  const kE3b = await karteLesen(Number(kE3.id));
  const eE3 = await E.entscheiden(Number(kE3.id), "erinnern", { von: VON });
  ok("E Klick auf eine von selbst erledigte Karte ändert nichts", eE3.ok && eE3.schon === true && (await karteLesen(Number(kE3.id))).ergebnis === kE3b.ergebnis);

  // ── F: Werbesperre auf eine Zahlungsmail ────────────────────────────────
  console.log("\nF  Werbesperre auf eine Zahlungsmail");
  const F = await kunde("F", { paidAt: zeit(-60) });
  await rate(F.ref, 1, tag(-60), { bezahlt: zeit(-60) });
  await rate(F.ref, 2, tag(-20));
  await sql`UPDATE fiaon_persons SET werbung_gesperrt_am = ${zeit(-5)}, werbesperre_quelle = 'mensch' WHERE id = ${F.personId}`;
  const [pmF] = await sql`INSERT INTO fiaon_postmeister (postfach, gmail_id, thread_id, betreff, empfangen_am, kategorie, person_id, flags)
    VALUES ('support@fiaon.com', 'q370-f', 'q370-f', 'Re: Ihre Monatsrate 2 — FIAON-Q370F-2', ${zeit(-5.001)}, 'zahlung', ${F.personId}, ${JSON.stringify({ stopp: true })}::text::jsonb) RETURNING id`;
  await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, note, created_at)
    VALUES (${F.ref}, ${F.personId}, 'Postmeister', 'system', 'Kunde bittet um Stopp der Werbe- und Erinnerungsmails („bitte keine Mails mehr") — Werbesperre gesetzt.', ${zeit(-5)})`;
  await E.entscheidungenSammeln({ nur: ["werbesperre_zahlungspost"] });
  const kF = (await sql`SELECT * FROM fiaon_mara_entscheidungen WHERE art = 'werbesperre_zahlungspost' AND person_id = ${F.personId}`)[0] as any;
  ok("F Karte mit Zitat, Empfehlung „Sperre lassen“", kF?.empfehlung === "lassen" && (kF.belege as any[]).some((b) => b.art === "zitat" && b.text === "bitte keine Mails mehr"), kF?.belege);
  const eF = await E.entscheiden(Number(kF.id), "aufheben", { von: VON });
  const pF = (await sql`SELECT werbung_gesperrt_am, werbesperre_quelle FROM fiaon_persons WHERE id = ${F.personId}`)[0] as any;
  const flF = (await sql`SELECT flags FROM fiaon_postmeister WHERE id = ${pmF.id}`)[0] as any;
  ok("F aufheben: Werbung bleibt gesperrt, Herkunft = Zahlungspost-Freigabe", !!pF.werbung_gesperrt_am && pF.werbesperre_quelle === "zahlungspost_freigabe", pF);
  ok("F Stopp-Merkmal genau dieser Mail ist weg", flF.flags?.stopp === false, flF.flags);
  ok("F Ergebnis ohne „Achtung“ (kein weiterer Stopp)", eF.ok && !/Achtung/.test(String(eF.karte?.ergebnis)), eF.karte?.ergebnis ?? eF.error);
  await E.entscheidungenSammeln({ nur: ["werbesperre_zahlungspost"] });
  ok("F danach keine neue Karte", (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_entscheidungen WHERE art = 'werbesperre_zahlungspost' AND person_id = ${F.personId} AND status = 'offen'`)[0].n === 0);

  // ── G: Geld eingegangen ─────────────────────────────────────────────────
  console.log("\nG  Geld eingegangen, nicht verbucht");
  const G = await kunde("G", { status: "pending_payment", pr: `FIAON-${M}G1`, paidAt: zeit(-3) });
  const [tG] = await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, match_status, applied, note)
    VALUES (${`AWX-${M.toLowerCase()}-g`}, ${`${tag(-2)}T00:00:00Z`}, 5999, 'EUR', 'ProbeG KundeG', ${`FIAON-${M}G1`}, NULL, 'unmatched', FALSE, 'Prüfstand E-370') RETURNING id`;
  const [tK] = await sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, match_status, applied, note)
    VALUES (${`AWX-${M.toLowerCase()}-k`}, ${`${tag(-2)}T00:00:00Z`}, 18, 'EUR', 'PRUEFBANK Q370', 'Pruefbetrag', NULL, 'unmatched', FALSE, 'Prüfstand E-370') RETURNING id`;
  const sG = await E.entscheidungenSammeln({ nur: ["eingang_unverbucht"] });
  const kG = await karteLesen(`eingang:${tG.id}`), kK = await karteLesen(`eingang:${tK.id}`);
  ok("G Karte „buchen“ für den eindeutigen Eingang (Referenz im Zweck)", kG?.empfehlung === "buchen" && kG.person_id === G.personId, { e: kG?.empfehlung, titel: kG?.titel, fehler: sG.je.eingang_unverbucht?.fehler });
  ok("G 0,18 € ohne Treffer: Empfehlung „Kein Kundengeld“, Link ins Konto mit Vorauswahl", kK?.empfehlung === "kein_kunde"
    && (kK.optionen as any[]).some((o) => o.key === "konto" && o.link === `/chef/s/konto?eingang=${tK.id}`), kK?.empfehlung);
  const eG = kG ? await E.entscheiden(Number(kG.id), "buchen", { von: VON }) : { ok: false, error: "keine Karte" } as any;
  const bG = (await sql`SELECT applied FROM fiaon_bank_txns WHERE id = ${tG.id}`)[0] as any;
  const aG = (await sql`SELECT payment_status FROM fiaon_applications WHERE ref = ${G.ref}`)[0] as any;
  ok("G buchen über bankeingangBuchen: Eingang verbucht, Bestellung bezahlt", eG.ok && bG.applied === true && aG.payment_status === "paid", { e: eG.karte?.ergebnis ?? eG.error, aG });
  const eK = kK ? await E.entscheiden(Number(kK.id), "kein_kunde", { von: VON }) : { ok: false } as any;
  ok("G „Kein Kundengeld“: gekennzeichnet (ignored), nicht verbucht", eK.ok && (await sql`SELECT match_status, applied FROM fiaon_bank_txns WHERE id = ${tK.id}`)[0].match_status === "ignored");
  const eG2 = kG ? await E.entscheiden(Number(kG.id), "buchen", { von: VON }) : { ok: false } as any;
  ok("G zweiter Klick bucht nicht noch einmal", eG2.ok && eG2.schon === true);

  // ── H: Später ───────────────────────────────────────────────────────────
  console.log("\nH  Später");
  const h = await E.entscheidungAnlegen({ schluessel: "q370:h:1", art: "q370_test", titel: "Später-Probe", text: "x", empfehlung: "lassen",
    optionen: [{ key: "lassen", label: "So lassen", werkzeug: "nichts" }] });
  const sp = await E.entscheidungSpaeter(h!.id);
  const bis = sp?.spaeterBis ? new Date(sp.spaeterBis).getTime() - Date.now() : 0;
  ok("H „Später“: drei Tage", sp?.status === "spaeter" && bis > 2.9 * 86_400_000 && bis < 3.1 * 86_400_000, sp?.spaeterBis);
  const l1 = await E.entscheidungenLesen();
  ok("H nicht mehr unter „offen“, aber unter „später“", !l1.offen.some((k) => k.id === h!.id) && l1.spaeter.some((k) => k.id === h!.id));
  await E.entscheidungAnlegen({ schluessel: "q370:h:1", art: "q370_test", titel: "Später-Probe 2", text: "x", empfehlung: "lassen",
    optionen: [{ key: "lassen", label: "So lassen", werkzeug: "nichts" }] });
  ok("H Auffrischen lässt „später“ stehen", (await karteLesen(h!.id)).status === "spaeter" && (await karteLesen(h!.id)).titel === "Später-Probe 2");
  await sql`UPDATE fiaon_mara_entscheidungen SET spaeter_bis = NOW() - INTERVAL '1 minute' WHERE id = ${h!.id}`;
  await E.entscheidungenSammeln({ nur: ["wa_vorlagen"] });
  const l2 = await E.entscheidungenLesen();
  ok("H abgelaufen → wieder offen", (await karteLesen(h!.id)).status === "offen" && l2.offen.some((k) => k.id === h!.id));
  ok("H WhatsApp-Vorlagen ohne Meta-Zugang: keine Karte", (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_entscheidungen WHERE art = 'wa_vorlagen'`)[0].n === 0);
  ok("H Sortierung: Gewicht absteigend", l2.offen.every((k, i, a) => i === 0 || a[i - 1].gewicht >= k.gewicht));

  console.log(`\nNetzaufrufe abgeklemmt: ${blockiert}`);
  await aufraeumen();
  const [rest] = await sql`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-${M}%`})::int
         + (SELECT COUNT(*) FROM fiaon_bank_txns WHERE txn_id LIKE ${`AWX-${M.toLowerCase()}-%`})::int
         + (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE ${`PRUEF-${M}-%`})::int AS n`;
  ok("Aufgeräumt", rest.n === 0, rest.n);
  console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  await sql.end();
  process.exit(fehler === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error("FEHLER:", e?.stack || e); await sql.end().catch(() => {}); process.exit(1); });
