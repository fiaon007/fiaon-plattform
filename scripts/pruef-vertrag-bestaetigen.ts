// Prüfstand E-398 (19.10.2026): derselbe Vertrag für jeden Abschlussweg — /vertrag-bestaetigen/<Link>.
// Teil A rein (Link, Adresse, Modus, Vertragstext), Teil B mit erfundenen Testkunden gegen eine LOKALE Prüfdatenbank.
//   npx tsx scripts/pruef-vertrag-bestaetigen.ts
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e398?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-vertrag-bestaetigen.ts
import { readFileSync } from "fs";
import { antragNeuVertragHtml, KNOPF_BESTAETIGUNG } from "../shared/fiaon-antrag-neu-vertrag";
// Teil A braucht keine Datenbank — db-pool verlangt aber eine Adresse beim Laden (verbunden wird erst bei einer Abfrage).
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const {
  bestaetigenToken, bestaetigenTokenLesen, strasseTeilen, landAus, modusFuer, BESTAND_FREIGABE, BESTAETIGUNG_ALLE_WEGE_AB,
} = await import("../server/lib/fiaon-vertrag-bestaetigen");

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOOGLE_SA_KEY"]) delete process.env[k];

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 400)}` : ""}`); } }

function teilA() {
  console.log("── A1 · Der Link");
  const t = bestaetigenToken("FIAON-ABCD12-XY9Z");
  ok(bestaetigenTokenLesen(t) === "FIAON-ABCD12-XY9Z", "Hin und zurück", t);
  ok(bestaetigenTokenLesen(t.replace(/.$/, (c) => (c === "A" ? "B" : "A"))) === null, "verändert → ungültig");
  const [r, , sig] = t.split(".");
  ok(bestaetigenTokenLesen(`${Buffer.from("FIAON-ANDERS-1234").toString("base64url")}.${t.split(".")[1]}.${sig}`) === null, "fremde Bestellung mit alter Signatur → ungültig");
  ok(bestaetigenTokenLesen(bestaetigenToken("FIAON-ABCD12-XY9Z", new Date(Date.now() - 1000))) === null, "abgelaufen → ungültig");
  ok(bestaetigenTokenLesen("quatsch") === null && !!r, "Unsinn → ungültig");

  console.log("── A2 · Adresse, Land, Modus");
  ok(JSON.stringify(strasseTeilen("Hauptstraße 5a")) === JSON.stringify({ strasse: "Hauptstraße", nr: "5a" }), "Straße und Nummer", strasseTeilen("Hauptstraße 5a"));
  ok(strasseTeilen("Am Ring 12-14").nr === "12-14" && strasseTeilen("Ohne Nummer").nr === "", "Bereich und ohne Nummer");
  ok(landAus("AT") === "AT" && landAus("Österreich") === "AT" && landAus(null) === "DE" && landAus("ch") === "CH", "Land");
  ok(modusFuer(new Date(`${BESTAETIGUNG_ALLE_WEGE_AB}T10:00:00Z`)) === "abschluss" && modusFuer(new Date("2026-09-10T10:00:00Z")) === "bestaetigung", "Modus nach dem Tag der Bestellung");
  ok(BESTAND_FREIGABE === null, "Bestand ist NICHT freigegeben (erst nach Justins „go“)");

  console.log("── A3 · Vertragstext");
  const d: any = { ref: "FIAON-ABCD-1234", anrede: "Frau", vorname: "Maria", nachname: "Müller", geburt: "", strasse: "Hauptstr.", nr: "5", plz: "12345", ort: "Berlin", land: "DE", email: "m@x.de", paketKey: "pro", limit: 2500, sofortBeginn: false, angenommenAm: null };
  const normal = antragNeuVertragHtml(d);
  const best = antragNeuVertragHtml({ ...d, bestaetigung: { bestelltAm: new Date("2026-09-10T08:00:00Z") } });
  ok(/Zahlungspflichtig annehmen/.test(normal) && !new RegExp(KNOPF_BESTAETIGUNG).test(normal), "normal: „Zahlungspflichtig annehmen“");
  ok(best.includes(KNOPF_BESTAETIGUNG) && /am 10\.09\.2026 bestellt/.test(best) && /PV-[0-9-]+-B/.test(best) && !/nach seiner Unterschrift/.test(best), "Bestätigung: eigener § 13 Abs. 1, Fassung -B");
  ok(antragNeuVertragHtml({ ...d, bestaetigung: null }) === normal, "bestaetigung: null = unverändert");
}

async function teilB() {
  const URL_ = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):\d+\/fiaon_pruefstand_e398/.test(URL_)) { console.log("── Teil B übersprungen (keine lokale fiaon_pruefstand_e398)."); return; }
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const V = await import("../server/lib/fiaon-vertrag-bestaetigen");
  await V.einladungTabelle();
  const png = `data:image/png;base64,${readFileSync("client/public/favicon-192.png").toString("base64")}`;
  const tagVor = (n: number) => new Date(Date.now() - n * 864e5);
  let nr = 100;
  const bestellung = async (o: { vn: string; nn: string; vor: number; status: string; bezahlt: boolean; weg?: string | null; step?: number }) => {
    nr++;
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES (${`PR-E398B-${nr}`}, ${o.vn}, ${o.nn}, ${`${o.nn.toLowerCase()}@test.invalid`}) RETURNING id`) as any[];
    const ref = `FIAON-E398B${nr}-V${nr}X`;
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, pack_key, pack_name, payment_status, status, current_step, created_at, agb_stand,
                first_name, last_name, email, street, zip, city, country, birthdate, wanted_limit, antrag_weg, payment_reference)
              VALUES (${ref}, ${Number(p.id)}, 'private', 'ultra', 'FIAON Ultra', ${o.bezahlt ? "paid" : "pending_payment"}, ${o.status}, ${o.step ?? 5}, ${tagVor(o.vor)}, ${tagVor(o.vor).toISOString().slice(0, 10)},
                ${o.vn}, ${o.nn}, ${`${o.nn.toLowerCase()}@test.invalid`}, 'Hauptstraße 5a', '1010', 'Wien', 'AT', '1970-03-12', 10000, ${o.weg ?? null}, ${`E398BZ${nr}`})`;
    return { ref, personId: Number(p.id) };
  };
  const einladung = async (ref: string) => ((await sql`SELECT * FROM fiaon_vertrag_einladungen WHERE ref = ${ref}`) as any[])[0];
  const annahme = async (ref: string) => ((await sql`SELECT ref, weg, knopf_text, vertrag_fassung, ziel_limit, (vertrag_pdf IS NOT NULL) AS pdf, vertrag_html, haken, unterschrift_png IS NOT NULL AS sig FROM fiaon_vertragsannahmen WHERE ref = ${ref}`) as any[])[0];

  console.log("── B1 · Betreuer-Anlage von heute (ohne Annahme) → Einladung „Vertrag unterschreiben“");
  const b1 = await bestellung({ vn: "Bea", nn: "Betreuer", vor: 0, status: "payment_pending", bezahlt: false });
  const b2 = await bestellung({ vn: "Bert", nn: "Bestand", vor: 20, status: "payment_pending", bezahlt: true });
  const b3 = await bestellung({ vn: "Nora", nn: "Neuweg", vor: 0, status: "submitted", bezahlt: false, weg: "neu", step: 8 });
  const b4 = await bestellung({ vn: "Uli", nn: "Unfertig", vor: 0, status: "approved", bezahlt: false, step: 4 });
  await V.einladungenSenden();
  const e1 = await einladung(b1.ref);
  ok(e1 && e1.modus === "abschluss" && Number(e1.versuche) === 1 && /BREVO_API_KEY/.test(String(e1.fehler)), "Einladung versucht (Modus abschluss; ohne Schlüssel: Fehler vermerkt, nächster Lauf versucht es wieder)", e1);
  const [m1] = (await sql`SELECT * FROM fiaon_mail_log WHERE event = 'vertrag_unterschreiben' AND empfaenger = 'betreuer@test.invalid'`) as any[];
  ok(m1 && !/vertrag-bestaetigen\//.test(JSON.stringify(m1.payload)), "Versandprotokoll ohne den persönlichen Link", m1?.payload);
  ok(!(await einladung(b2.ref)), "Bestand (vor dem Stichtag): keine Einladung ohne Freigabe");
  ok(!(await einladung(b3.ref)), "/antrag-neu: nie");
  ok(!(await einladung(b4.ref)), "alter Antrag vor Schritt 8 (nicht abgeschickt): nie");
  await V.einladungenSenden({ bestand: true });
  ok((await einladung(b2.ref))?.modus === "bestaetigung", "mit Freigabe: Bestand bekommt „Vertrag bestätigen“");

  console.log("── B2 · Der Stand für die Seite");
  const s1 = await V.bestaetigenStand(b1.ref);
  ok(s1.ok && s1.modus === "abschluss" && s1.knopf === "Zahlungspflichtig annehmen" && s1.limitVorschlag === 10000 && s1.paket?.name === "FIAON Ultra", "abschluss: Knopf, Ziel-Limit 10.000 € aus der Bestellung", s1);
  const s2 = await V.bestaetigenStand(b2.ref);
  ok(s2.ok && s2.modus === "bestaetigung" && s2.knopf === KNOPF_BESTAETIGUNG && /-B$/.test(s2.fassungen!.vertrag), "bestaetigung: Knopf und Fassung -B", s2);
  ok((await V.bestaetigenStand("FIAON-GIBT-ES-NICHT")).grund === "unbekannt", "unbekannt");

  console.log("── B3 · Annehmen (abschluss): die Wände");
  const basis = { limit: 10000, sofort: false, hakenAgb: true, knopf: s1.knopf!, fassungen: s1.fassungen!, ip: "93.184.216.34", userAgent: "Mozilla/5.0", pruefstand: true };
  let r: any = await V.bestaetigenAnnehmen(b1.ref, { ...basis, unterschrift: null });
  ok(!r.ok && r.feld === "unterschrift", "ohne Unterschrift → nein", r);
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, knopf: "Weiter", unterschrift: { png } });
  ok(!r.ok && r.status === 400, "falscher Knopf → nein", r);
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, fassungen: { ...basis.fassungen, agb: "2020-01-01" }, unterschrift: { png } });
  ok(!r.ok && r.neuLaden === true, "alte Fassung im Browser → neu laden", r);
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, hakenAgb: false, unterschrift: { png } });
  ok(!r.ok && r.feld === "agb", "ohne AGB-Haken → nein", r);
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, limit: 1234, unterschrift: { png } });
  ok(!r.ok && r.feld === "limit", "Limit außerhalb des Pakets → nein", r);

  console.log("── B4 · Annehmen (abschluss): gespeichert wie /antrag-neu, PDF und Bestätigung");
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, sofort: true, unterschrift: { png, getippt: false } });
  ok(r.ok && r.modus === "abschluss", "angenommen", r);
  await new Promise((f) => setTimeout(f, 6000));
  const a1 = await annahme(b1.ref);
  ok(a1 && a1.weg === "abschluss-pruefstand" && a1.knopf_text === "Zahlungspflichtig annehmen" && a1.sig && Number(a1.ziel_limit) === 10000, "Zeile in fiaon_vertragsannahmen (Weg, Knopf, Unterschrift, Limit)", a1 && { weg: a1.weg, k: a1.knopf_text });
  ok(/nach seiner Unterschrift die Schaltfläche „Zahlungspflichtig annehmen“/.test(String(a1?.vertrag_html)) && /Wien/.test(String(a1?.vertrag_html)) && /12\. März 1970/.test(String(a1?.vertrag_html)), "Vertragstext wie /antrag-neu, mit Anschrift und Geburtstag aus der Bestellung");
  ok(a1?.pdf === true, "Vertrags-PDF gedruckt (vertragBestaetigungSenden)");
  const [mb] = (await sql`SELECT status, grund FROM fiaon_mail_log WHERE event = 'vertrag_bestaetigung' AND empfaenger = 'betreuer@test.invalid'`) as any[];
  ok(mb && /BREVO/.test(String(mb.grund)), "Bestätigungsmail versucht (Protokoll)", mb);
  const [b1z] = (await sql`SELECT consent_contract, consent_agb FROM fiaon_applications WHERE ref = ${b1.ref}`) as any[];
  ok(b1z.consent_contract === true && b1z.consent_agb === true, "Bestellung: Zustimmung gespeichert");
  ok((await einladung(b1.ref))?.angenommen_am, "Einladung als angenommen markiert");
  r = await V.bestaetigenAnnehmen(b1.ref, { ...basis, unterschrift: { png } });
  ok(r.ok, "zweimal annehmen → dieselbe Annahme (idempotent)", r);
  ok((await V.bestaetigenStand(b1.ref)).grund === "fertig", "Stand danach: fertig");
  const vorher = Number((await einladung(b1.ref)).versuche);
  await V.einladungenSenden({ bestand: true });
  ok(Number((await einladung(b1.ref)).versuche) === vorher, "keine neue Einladung nach der Annahme", { vorher });

  console.log("── B5 · Bestätigen (Bestand): ohne Unterschrift, „Zahlungspflichtig bestellen“");
  r = await V.bestaetigenAnnehmen(b2.ref, { ...basis, knopf: s2.knopf!, fassungen: s2.fassungen!, unterschrift: null });
  const a2 = await annahme(b2.ref);
  ok(r.ok && a2 && a2.knopf_text === KNOPF_BESTAETIGUNG && /-B$/.test(a2.vertrag_fassung) && /bestätigt am/.test(String(a2.vertrag_html)) && !a2.sig, "bestätigt, Fassung -B, ohne Unterschriftsbild", a2 && { k: a2.knopf_text, f: a2.vertrag_fassung });
  await new Promise((f) => setTimeout(f, 6000)); // die Bestätigung mit PDF läuft im Hintergrund
  await sql.end({ timeout: 5 }).catch(() => {});
}

teilA();
teilB().then(() => {
  console.log(`\n${gut} Prüfungen bestanden, ${schlecht} nicht.`);
  process.exit(schlecht ? 1 : 0);
}).catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
