// Prüfstand E-394 (19.10.2026): Kein Raten-Erzeuger legt eine Rate NACH dem Vertragsende eines gekündigten
// Altvertrags an. Gemessen (nur lesend, 19.10.): Am 17.10. um 08:08 legte der Ketten-Nachzieher (aboNachziehen über
// ketteSicherstellen im Abo-Motor, quelle „nachgezogen“) 35 Raten mit 2.207,65 € an — alle nach dem Vertragsende,
// alle um 09:08 vom Tageslauf (kuendigungsFolgenNachziehen) wieder storniert. Jetzt fragen alle vier Erzeuger
// dieselbe Regel wie Storno und Mahnung (FAELLIG_NACH_ENDE_SQL_FUER / faelligNachVertragsende in
// server/lib/fiaon-raten-storno.ts). Der Storno-Weg bleibt als Netz.
//
// Mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank. Kein Netz, keine Mail (keine Schlüssel). Bricht ab,
// wenn DATABASE_URL nicht auf 127.0.0.1/localhost und fiaon_pruefstand* zeigt.
//   createdb -T fiaon_pruefstand_e372_vorlage fiaon_pruefstand_e394   (Port 54329, PGSSLMODE=require)
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e394?sslmode=require' \
//     DATABASE_URL_EXTERN=<dasselbe> node_modules/.bin/tsx scripts/pruef-e394-raten-erzeuger.ts
import { readFileSync } from "node:fs";

const URL_ = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand/.test(URL_)) { console.error("Nur gegen eine lokale fiaon_pruefstand*-Datenbank."); process.exit(3); }
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  console.log("── 0 · Quelltext: eine Regel, kein zweiter Text");
  const ST = await import("../server/lib/fiaon-raten-storno");
  const { JAHRESVERTRAG_AB } = await import("../shared/fiaon-antrag-stand");
  // Der Text, den Mahnmotor, „überfällig stellen“ und Inkasso bis heute lesen (75a5379d) — er darf sich nicht ändern.
  const bisher = `(a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL
  AND (a.agb_stand IS NULL OR a.agb_stand < DATE '${JAHRESVERTRAG_AB}')
  AND r.faellig_am > COALESCE((a.vertrag_ende_am AT TIME ZONE 'Europe/Berlin')::date,
                              ((a.gekuendigt_am + INTERVAL '24 hours') AT TIME ZONE 'Europe/Berlin')::date))`;
  ok(ST.RATE_NACH_ENDE_SQL_FUER("a", "r") === bisher, "RATE_NACH_ENDE_SQL_FUER liefert wörtlich den bisherigen Text (Mahnung/Inkasso unverändert)");
  ok(ST.RATE_NACH_ENDE_SQL_FUER("a", "r") === ST.FAELLIG_NACH_ENDE_SQL_FUER("a", "r.faellig_am"), "RATE_NACH_ENDE_SQL_FUER ist FAELLIG_NACH_ENDE_SQL_FUER mit der Fälligkeit der Rate");
  const stornoText = lies("server/lib/fiaon-raten-storno.ts");
  ok(/export const RATE_NACH_ENDE_SQL_FUER = \(a: string, r: string\): string => FAELLIG_NACH_ENDE_SQL_FUER\(a, `\$\{r\}\.faellig_am`\);/.test(stornoText), "RATE_NACH_ENDE_SQL_FUER ruft FAELLIG_NACH_ENDE_SQL_FUER (eine Quelle)");
  ok((stornoText.match(/INTERVAL '24 hours'/g) ?? []).length === 1, "Die Vertragsende-Rechnung steht in fiaon-raten-storno.ts genau einmal");
  ok(/SELECT \$\{lauf\.unsafe\(FAELLIG_NACH_ENDE_SQL_FUER\("a", "f\.tag"\)\)\} AS nach_ende/.test(stornoText), "faelligNachVertragsende fragt FAELLIG_NACH_ENDE_SQL_FUER");
  const abo = lies("server/routes/fiaon-abo.ts");
  ok(!/INTERVAL '24 hours'/.test(abo) && !/vertrag_ende_am AT TIME ZONE/.test(abo), "fiaon-abo.ts formuliert das Vertragsende nirgends selbst");
  const teil = (von: string, bis: string) => abo.slice(abo.indexOf(von), abo.indexOf(bis, abo.indexOf(von)));
  const erzeuger = teil("export async function ratenFuerHeuteErzeugen(", "let erzeugt = 0;");
  ok(/AND NOT \$\{FAELLIG_NACH_ENDE_SQL_FUER\("a", "\$1::date"\)\}/.test(erzeuger) && /`, \[heute\]\)\) as any\[\];/.test(erzeuger), "ratenFuerHeuteErzeugen: Regel mit heute als Fälligkeit (Parameter)");
  const kette = teil("export async function ketteSicherstellen(", "const erg = await aboNachziehen");
  ok(/AND NOT \$\{sqlPool\.unsafe\(FAELLIG_NACH_ENDE_SQL_FUER\("a", "\(NOW\(\) AT TIME ZONE 'Europe\/Berlin'\)::date"\)\)\}/.test(kette), "ketteSicherstellen: Altvertrag mit Ende vor heute zählt nicht als „ohne Kette“");
  const nach = teil("export async function aboNachziehen(", "return { geprueft: apps.length");
  ok(/if \(await faelligNachVertragsende\(app\.ref, faellig\)\) \{ uebersprungen\+\+; continue; \}/.test(nach)
    && nach.indexOf("faelligNachVertragsende(app.ref, faellig)") < nach.indexOf("if (opts.nurZaehlen)")
    && nach.indexOf("faelligNachVertragsende(app.ref, faellig)") < nach.indexOf("INSERT INTO fiaon_abo_raten"), "aboNachziehen: Sperre vor Vorschau-Zählung und vor jedem INSERT");
  const folge = teil("export async function naechsteRateAnlegen(", "ON CONFLICT DO NOTHING");
  ok(/if \(await faelligNachVertragsende\(ref, faellig\)\) return;/.test(folge)
    && folge.indexOf("faelligNachVertragsende(ref, faellig)") < folge.indexOf("guthabenVerbrauchen(ref, betrag)"), "naechsteRateAnlegen: Sperre VOR dem Guthabenverbrauch");
  const anlegen = teil("export async function aboBeiZahlungAnlegen(", "return { angelegt: true };");
  ok(/if \(await faelligNachVertragsende\(ref, faelligkeit\(anker, 1\)\)\)/.test(anlegen) && anlegen.indexOf("faelligNachVertragsende") < anlegen.lastIndexOf("INSERT INTO fiaon_abo_raten"), "aboBeiZahlungAnlegen: Sperre vor Rate 2");
  ok(/m\.kuendigungsFolgenNachziehen\(\)/.test(abo), "Netz bleibt: Tageslauf ruft weiter kuendigungsFolgenNachziehen");

  const { sqlPool } = await import("../server/lib/db-pool");
  const KU = await import("../server/lib/fiaon-kuendigung");
  const ABO = await import("../server/routes/fiaon-abo");
  await ABO.ensureAboTabellen();
  await KU.kuendigungSpalten();
  const E = await import("../server/lib/fiaon-mara-entscheidungen");
  await E.entscheidungTabellen();
  const Z = await import("../server/lib/fiaon-abo-zyklus");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const sql = sqlPool;

  // ── Testkunden ─────────────────────────────────────────────────────────
  const person = async (nn: string) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PR-E394-${nn}`}, 'Test', ${nn}, ${`${nn.toLowerCase()}@test.invalid`}) RETURNING id`) as any[];
    return Number(p.id);
  };
  const bestellung = async (ref: string, o: { bezahlt: string; gekuendigt?: string | null; zurueck?: string | null; ende?: string | null; letzte?: number | null; agb?: string | null }) => {
    const pid = await person(ref.replace(/^FIAON-E394-/, ""));
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, created_at, paid_at, agb_stand, gekuendigt_am, kuendigung_zurueckgenommen_am,
                                              letzte_rate_nr, vertrag_ende_am, first_name, last_name, email, payment_reference)
              VALUES (${ref}, ${pid}, 'private', 'pro', 'FIAON Pro', 'paid', ${o.bezahlt}, ${o.bezahlt}, ${o.agb ?? null}, ${o.gekuendigt ?? null}, ${o.zurueck ?? null},
                      ${o.letzte ?? null}, ${o.ende ?? null}, 'Test', 'Person', ${`${ref.toLowerCase()}@test.invalid`}, ${`${ref}-RF`})`;
  };
  const rate = async (ref: string, nr: number, faellig: string, status: "bezahlt" | "offen" | "storniert" = "bezahlt") => {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, bezahlt_am, storniert_am, storno_grund, zahlungsreferenz)
              VALUES (${ref}, ${nr}, 5999, ${faellig}, ${status}, ${status === "bezahlt" ? `${faellig}T12:00:00Z` : null},
                      ${status === "storniert" ? "2026-10-16T18:18:42Z" : null}, ${status === "storniert" ? ST.STORNO_NACH_VERTRAGSENDE : null}, ${`${ref}-${nr}`})`;
  };
  const raten = async (ref: string) => (await sql`SELECT rate_nr, to_char(faellig_am, 'YYYY-MM-DD') AS f, status, quelle FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY rate_nr`) as any[];
  const neueOffene = async (ref: string) => (await raten(ref)).filter((r) => r.status === "offen");
  const nachEndeOffen = async (refPraefix: string) => Number(((await sql.unsafe(`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.ref LIKE $1 AND r.status = 'offen' AND r.storniert_am IS NULL AND ${ST.RATE_NACH_ENDE_SQL_FUER("a", "r")}`, [`${refPraefix}%`])) as any[])[0].n);

  console.log("── 1 · Tageslauf-Erzeuger (ratenFuerHeuteErzeugen), fester Tag 20.10.2026");
  const H = "2026-10-20";
  // Altvertrag, gekündigt 20.07. (Ende 21.07.), „letzte Rate“ fehlt — bisher hielt ihn hier nichts auf.
  await bestellung("FIAON-E394-T-ALT", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-07-20T15:00:00Z", letzte: null });
  await rate("FIAON-E394-T-ALT", 1, "2026-07-20"); await rate("FIAON-E394-T-ALT", 2, "2026-08-20", "storniert"); await rate("FIAON-E394-T-ALT", 3, "2026-09-20", "storniert");
  // Altvertrag, gekündigt 05.10., Vertragsende 25.10. — die Rate vom 20.10. ist geschuldet und entsteht weiter.
  await bestellung("FIAON-E394-T-BIS", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-10-05T10:00:00Z", ende: "2026-10-25T21:59:59Z", letzte: null });
  await rate("FIAON-E394-T-BIS", 1, "2026-07-20"); await rate("FIAON-E394-T-BIS", 2, "2026-08-20"); await rate("FIAON-E394-T-BIS", 3, "2026-09-20");
  // Zurückgenommene Kündigung — der Vertrag läuft, die Rate entsteht normal.
  await bestellung("FIAON-E394-T-ZURUECK", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-07-25T10:00:00Z", zurueck: "2026-07-28T10:00:00Z", letzte: null });
  await rate("FIAON-E394-T-ZURUECK", 1, "2026-07-20"); await rate("FIAON-E394-T-ZURUECK", 2, "2026-08-20"); await rate("FIAON-E394-T-ZURUECK", 3, "2026-09-20");
  // Jahresvertrag (AGB ab 03.09.), gekündigt — unverändert: die Regel gilt nur für Altverträge.
  await bestellung("FIAON-E394-T-JAHR", { bezahlt: "2026-09-20T10:00:00Z", gekuendigt: "2026-10-01T10:00:00Z", agb: "2026-09-20", letzte: null });
  await rate("FIAON-E394-T-JAHR", 1, "2026-09-20");
  // Ungekündigt — Gegenprobe.
  await bestellung("FIAON-E394-T-NORMAL", { bezahlt: "2026-07-20T10:00:00Z" });
  await rate("FIAON-E394-T-NORMAL", 1, "2026-07-20"); await rate("FIAON-E394-T-NORMAL", 2, "2026-08-20"); await rate("FIAON-E394-T-NORMAL", 3, "2026-09-20");

  const n1 = await ABO.ratenFuerHeuteErzeugen(H, sql);
  ok((await neueOffene("FIAON-E394-T-ALT")).length === 0, "Altvertrag gekündigt (Ende 21.07.): keine Rate am 20.10.", JSON.stringify(await raten("FIAON-E394-T-ALT")));
  const bis = await neueOffene("FIAON-E394-T-BIS");
  ok(bis.length === 1 && bis[0].f === H && Number(bis[0].rate_nr) === 4 && bis[0].quelle === "tageslauf", "Altvertrag mit Ende 25.10.: Rate 4 (20.10.) bis zum Ende entsteht weiter", JSON.stringify(bis));
  const zur = await neueOffene("FIAON-E394-T-ZURUECK");
  ok(zur.length === 1 && zur[0].f === H, "Zurückgenommene Kündigung: Rate entsteht normal", JSON.stringify(zur));
  const jahr = await neueOffene("FIAON-E394-T-JAHR");
  ok(jahr.length === 1 && jahr[0].f === H && Number(jahr[0].rate_nr) === 2, "Jahresvertrag gekündigt: unverändert, Rate 2 entsteht", JSON.stringify(jahr));
  ok((await neueOffene("FIAON-E394-T-NORMAL")).length === 1, "Ungekündigt: Rate entsteht");
  ok(n1 === 4, "Ergebnis: genau 4 neue Raten", String(n1));
  ok(await ABO.ratenFuerHeuteErzeugen(H, sql) === 0, "Zweiter Lauf am selben Tag legt nichts an (idempotent)");
  // Einen Monat später: Rate 4 bezahlt, 20.11. liegt nach dem Ende 25.10. → nichts.
  await sql`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = '2026-10-21T12:00:00Z' WHERE ref = 'FIAON-E394-T-BIS' AND rate_nr = 4`;
  await ABO.ratenFuerHeuteErzeugen("2026-11-20", sql);
  ok((await neueOffene("FIAON-E394-T-BIS")).length === 0, "Altvertrag mit Ende 25.10.: am 20.11. keine Rate mehr", JSON.stringify(await raten("FIAON-E394-T-BIS")));

  console.log("── 2 · Ketten-Nachzieher (ketteSicherstellen → aboNachziehen), heute = echter Berliner Tag");
  const T = berlinToday();
  const tagMinus = Z.tagMinus;
  // Muster der 35 vom 17.10.: Altvertrag, vor Monaten gekündigt, letzte Rate 1, alle Folgeraten nach dem Ende storniert.
  const ankerAlt = tagMinus(T, 100);
  await bestellung("FIAON-E394-K-ALT", { bezahlt: `${ankerAlt}T10:00:00Z`, gekuendigt: `${tagMinus(ankerAlt, -3)}T10:00:00Z`, letzte: 1 });
  await rate("FIAON-E394-K-ALT", 1, ankerAlt);
  await rate("FIAON-E394-K-ALT", 2, Z.faelligkeit(ankerAlt, 1), "storniert");
  await rate("FIAON-E394-K-ALT", 3, Z.faelligkeit(ankerAlt, 2), "storniert");
  // Rotprobe Zählung: die bisherige Abfrage von ketteSicherstellen (ohne die neue Zeile) zählte diesen Vertrag mit.
  const KETTE_ALT = `SELECT COUNT(*)::int AS c FROM fiaon_applications a
    WHERE a.ref = $1 AND a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE) AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1 AND r.storniert_am IS NULL)`;
  const altGezaehlt = Number(((await sql.unsafe(KETTE_ALT, ["FIAON-E394-K-ALT"])) as any[])[0].c);
  const neuGezaehlt = Number(((await sql.unsafe(`${KETTE_ALT} AND NOT ${ST.FAELLIG_NACH_ENDE_SQL_FUER("a", "(NOW() AT TIME ZONE 'Europe/Berlin')::date")}`, ["FIAON-E394-K-ALT"])) as any[])[0].c);
  ok(altGezaehlt === 1 && neuGezaehlt === 0, `Rotprobe: alte Zählung „ohne Kette“ = ${altGezaehlt}, neue = ${neuGezaehlt}`);
  const k0 = await ABO.ketteSicherstellen();
  ok(k0.neu === 0 && (await neueOffene("FIAON-E394-K-ALT")).length === 0, "ketteSicherstellen: nur der beendete Altvertrag offen → kein Lauf, keine Rate", JSON.stringify(k0));
  // Weitere Verträge ohne Kette (je nur Rate 1) — jetzt läuft aboNachziehen wirklich und muss je Vertrag entscheiden.
  const ankerNeu = tagMinus(T, 20);
  const naechste = Z.naechsteFaelligkeit(ankerNeu, T);
  await bestellung("FIAON-E394-K-BIS", { bezahlt: `${ankerNeu}T10:00:00Z`, gekuendigt: `${tagMinus(T, 2)}T10:00:00Z`, ende: `${tagMinus(naechste, -3)}T21:59:59Z`, letzte: null });
  await rate("FIAON-E394-K-BIS", 1, ankerNeu);
  await bestellung("FIAON-E394-K-KURZ", { bezahlt: `${ankerNeu}T10:00:00Z`, gekuendigt: `${tagMinus(T, 2)}T10:00:00Z`, ende: `${tagMinus(naechste, 1)}T21:59:59Z`, letzte: null });
  await rate("FIAON-E394-K-KURZ", 1, ankerNeu);
  await bestellung("FIAON-E394-K-ZURUECK", { bezahlt: `${ankerNeu}T10:00:00Z`, gekuendigt: `${tagMinus(T, 10)}T10:00:00Z`, zurueck: `${tagMinus(T, 8)}T10:00:00Z` });
  await rate("FIAON-E394-K-ZURUECK", 1, ankerNeu);
  await bestellung("FIAON-E394-K-JAHR", { bezahlt: `${ankerNeu}T10:00:00Z`, gekuendigt: `${tagMinus(T, 10)}T10:00:00Z`, agb: ankerNeu > JAHRESVERTRAG_AB ? ankerNeu : JAHRESVERTRAG_AB });
  await rate("FIAON-E394-K-JAHR", 1, ankerNeu);
  await bestellung("FIAON-E394-K-NORMAL", { bezahlt: `${ankerNeu}T10:00:00Z` });
  await rate("FIAON-E394-K-NORMAL", 1, ankerNeu);
  const vorschau = await ABO.aboNachziehen({ nurZaehlen: true });
  const k1 = await ABO.ketteSicherstellen();
  ok((await neueOffene("FIAON-E394-K-ALT")).length === 0, "Muster der 35: keine neue Rate nach dem Ende", JSON.stringify(await raten("FIAON-E394-K-ALT")));
  ok((await neueOffene("FIAON-E394-K-KURZ")).length === 0, `Altvertrag, Ende einen Tag vor der nächsten Fälligkeit (${naechste}): keine Rate`, JSON.stringify(await raten("FIAON-E394-K-KURZ")));
  const kb = await neueOffene("FIAON-E394-K-BIS");
  ok(kb.length === 1 && kb[0].f === naechste && kb[0].quelle === "nachgezogen", `Altvertrag, Ende nach der nächsten Fälligkeit: Rate ${naechste} entsteht`, JSON.stringify(kb));
  ok((await neueOffene("FIAON-E394-K-ZURUECK")).length === 1, "Zurückgenommene Kündigung: Kette entsteht normal");
  ok((await neueOffene("FIAON-E394-K-JAHR")).length === 1, "Jahresvertrag gekündigt: unverändert, Kette entsteht");
  ok((await neueOffene("FIAON-E394-K-NORMAL")).length === 1, "Ungekündigt: Kette entsteht");
  ok(k1.neu === 4 && vorschau.neu === 4, `ketteSicherstellen meldet 4 neue, die Vorschau ebenso (beide ohne die zwei nach dem Ende)`, JSON.stringify({ k1, vorschau: vorschau.neu }));

  console.log("── 3 · Folgerate nach Zahlung (naechsteRateAnlegen) und Rate 2 bei Zahlung (aboBeiZahlungAnlegen)");
  await bestellung("FIAON-E394-N-ALT", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-08-25T10:00:00Z", letzte: null });
  await rate("FIAON-E394-N-ALT", 1, "2026-07-20"); await rate("FIAON-E394-N-ALT", 2, "2026-08-20");
  await ABO.naechsteRateAnlegen("FIAON-E394-N-ALT", { rate_nr: 2, faellig_am: "2026-08-20", betrag_cents: 5999, zahlungsreferenz: "FIAON-E394-N-ALT-2" });
  ok((await raten("FIAON-E394-N-ALT")).length === 2, "Altvertrag gekündigt 25.08. (Ende 26.08.): nach Zahlung von Rate 2 keine Rate 3 (20.09.)", JSON.stringify(await raten("FIAON-E394-N-ALT")));
  await bestellung("FIAON-E394-N-BIS", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-08-25T10:00:00Z", ende: "2026-09-30T21:59:59Z", letzte: null });
  await rate("FIAON-E394-N-BIS", 1, "2026-07-20"); await rate("FIAON-E394-N-BIS", 2, "2026-08-20");
  await ABO.naechsteRateAnlegen("FIAON-E394-N-BIS", { rate_nr: 2, faellig_am: "2026-08-20", betrag_cents: 5999, zahlungsreferenz: "FIAON-E394-N-BIS-2" });
  const nb = await neueOffene("FIAON-E394-N-BIS");
  ok(nb.length === 1 && nb[0].f === "2026-09-20" && Number(nb[0].rate_nr) === 3, "Altvertrag mit Ende 30.09.: Rate 3 (20.09.) entsteht", JSON.stringify(nb));
  await bestellung("FIAON-E394-Z-ALT", { bezahlt: "2026-07-20T10:00:00Z", gekuendigt: "2026-07-21T10:00:00Z", letzte: null });
  const za = await ABO.aboBeiZahlungAnlegen("FIAON-E394-Z-ALT");
  ok(!za.angelegt && /Vertragsende/.test(String(za.grund)) && (await neueOffene("FIAON-E394-Z-ALT")).length === 0, "Bei Zahlung, schon gekündigt (Ende 22.07.): keine Rate 2 (20.08.)", JSON.stringify(za));
  await bestellung("FIAON-E394-Z-NORMAL", { bezahlt: "2026-07-20T10:00:00Z" });
  const zn = await ABO.aboBeiZahlungAnlegen("FIAON-E394-Z-NORMAL");
  ok(zn.angelegt && (await neueOffene("FIAON-E394-Z-NORMAL")).length === 1, "Bei Zahlung, ungekündigt: Rate 2 entsteht", JSON.stringify(zn));

  console.log("── 4 · Nichts mehr nachzustornieren — und das Netz hält trotzdem");
  ok(await nachEndeOffen("FIAON-E394-") === 0, "Keine offene Testrate liegt nach dem Vertragsende (RATE_NACH_ENDE_SQL_FUER)");
  const F = await import("../server/lib/fiaon-kuendigung-folgen");
  const vorNetz = await F.kuendigungsFolgenNachziehen();
  ok(vorNetz.ratenStorniert === 0 && vorNetz.fehler === 0, "Tageslauf-Storno findet nichts mehr (vorher: jede neue Rate einmal angelegt, dann storniert)", JSON.stringify(vorNetz));
  // Rotprobe: genau der INSERT des alten Nachziehers (ohne Sperre) für das Muster der 35.
  const vergangen = Z.zyklenBis(ankerAlt, T);
  const altNr = vergangen + 2, altFaellig = Z.faelligkeit(ankerAlt, vergangen + 1);
  await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
            VALUES ('FIAON-E394-K-ALT', ${altNr}, ${`FIAON-E394-K-ALT-RF-${altNr}`}, 5999, ${altFaellig}::date, 'offen', 'nachgezogen', 'Bestandsaufnahme (nächste Fälligkeit)')
            ON CONFLICT DO NOTHING`;
  ok(await nachEndeOffen("FIAON-E394-K-ALT") === 1, `Rotprobe: ohne Sperre entstünde Rate ${altNr} (${altFaellig}) — die Regel erkennt sie als nach dem Ende`);
  ok(await ST.faelligNachVertragsende("FIAON-E394-K-ALT", altFaellig) && !(await ST.faelligNachVertragsende("FIAON-E394-K-BIS", naechste)), "faelligNachVertragsende: nach dem Ende ja, bis zum Ende nein");
  const netz = await F.kuendigungsFolgenNachziehen();
  const [weg] = (await sql`SELECT status, storno_grund FROM fiaon_abo_raten WHERE ref = 'FIAON-E394-K-ALT' AND rate_nr = ${altNr}`) as any[];
  ok(netz.ratenStorniert === 1 && weg?.status === "storniert" && weg?.storno_grund === ST.STORNO_NACH_VERTRAGSENDE, "Netz bleibt: der Tageslauf-Storno fängt genau diese Rate", JSON.stringify({ netz, weg }));

  console.log("── 5 · Der Tageslauf läuft im Ganzen ohne Fehler");
  let tagFehler: string | null = null;
  try { await ABO.aboTageslauf({ lauf: sqlPool, force: true }); } catch (e) { tagFehler = String((e as Error).message).slice(0, 200); }
  ok(!tagFehler, "aboTageslauf (Erzeugen mit Parameter, Nachziehen, überfällig stellen) läuft", tagFehler ?? "");
  ok(await nachEndeOffen("FIAON-E394-") === 0, "Nach dem Tageslauf: keine offene Testrate nach dem Vertragsende");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (lokale Datenbank)`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
