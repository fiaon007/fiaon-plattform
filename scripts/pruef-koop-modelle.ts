// Prüfstand E-390 (16.10.2026): Vertragsvorlagen Recht, Steuern (Partnerplatz) und Energie, Telefon (je Abschluss) — vom
// Angebot über Annahme, Einwilligung, Übermittlung und Abschluss-Meldung bis zur Monatsrechnung. NUR lokal, Brevo abgefangen.
//   env -i HOME=$HOME PATH=$PATH BREVO_API_KEY=pruef SESSION_SECRET=pruef \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<lokale Kopie>' node_modules/.bin/tsx scripts/pruef-koop-modelle.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }
if (!/127\.0\.0\.1|localhost/.test(String(process.env.DATABASE_URL))) { console.error("Nur gegen den lokalen Prüfstand."); process.exit(3); }

const mails: { an: string; betreff: string; text: string; anhaenge: string[] }[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("api.brevo.com")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    mails.push({ an: b.to?.[0]?.email, betreff: b.subject, text: String(b.textContent ?? ""), anhaenge: (b.attachment ?? []).map((a: any) => a.name) });
    return new Response(JSON.stringify({ messageId: `<pruef-${mails.length}@brevo>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  return echtFetch(url, init);
}) as typeof fetch;

async function main() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const A = await import("../server/lib/fiaon-global-angebot");
  const K = await import("../server/lib/fiaon-global-angebot-koop");
  const S = await import("../shared/fiaon-global-angebot-koop");
  const L = await import("../server/lib/fiaon-koop-lieferung");
  const { katalogpreiseSyncen } = await import("../server/lib/fiaon-katalogpreise");
  await A.ensureAngebotTabellen(); await L.ensureKoopTabellen(); await katalogpreiseSyncen();
  const [spalten] = (await sqlPool`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'fiaon_koop_kontakte' AND column_name IN ('anschrift', 'abschluss_am', 'abschluss_art', 'kein_abschluss_am')`) as any[];
  ok(Number(spalten.n) === 4, "Migration 112: vier neue Spalten am Kontakt");
  const st = Date.now().toString(36);
  const ids: number[] = []; const angebote: number[] = [];
  const person = async (vor: string, nach: string) => {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, primary_phone, country, birthdate, street, zip, city, created_at, updated_at)
      VALUES (${`PRUEF-${st}-${vor}`.toUpperCase()}, ${vor}, ${nach}, ${`${vor.toLowerCase()}.${st}@pruefstand.test`}, ${"+4917699" + String(Math.floor(Math.random() * 90000) + 10000)}, 'DE', '1980-05-05', 'Musterweg 3', '10115', 'Berlin', NOW(), NOW()) RETURNING id`) as any[];
    ids.push(Number(p.id)); return Number(p.id);
  };
  const annehmen = async (bereich: string, region?: string) => {
    const pid = await person(`Partner${bereich}`, "Muster");
    const an = await K.koopAnlegen({ personId: pid, gueltigBis: "2026-12-31",
      partner: { anrede: "Frau", vorname: "Petra", nachname: "Muster", firma: `${bereich} Muster GmbH`, strasse: "Partnerstraße 9", plz: "10117", ort: "Berlin", land: "DE", email: `p-${bereich}.${st}@pruefstand.test` },
      parameter: { bereich, ...(region ? { region } : {}) } }, "Prüfstand");
    if (!an.ok) throw new Error(`${bereich}: ${an.error}`);
    angebote.push(an.id);
    let z = (await A.angebotLesen({ id: an.id }))!;
    const d = K.koopDatenAus(z);
    const r = await K.koopAnnehmen(z, { textHash: K.koopTextHash(d), wunschWoche: 10, gelesen: true, unternehmer: true, unterschrift: { art: "getippt", name: "Petra Muster" } },
      { ip: "84.150.10.20", userAgent: "Mozilla/5.0 (Macintosh) Safari/605.1.15", leitung: false }, { zuViel: () => false });
    z = (await A.angebotLesen({ id: an.id }))!;
    await L.koopZeitenSetzen(z, { tage: [1, 2, 3, 4, 5], von: "09:00", bis: "17:00", dauerMin: 60, arten: ["telefon", "video"] }, "Prüfstand");
    return { z: (await A.angebotLesen({ id: an.id }))!, d, status: r.status, pid };
  };

  console.log("Vorsorge bleibt Wort für Wort");
  const vor = S.koopParameterAus({});
  ok(vor.bereich === "vorsorge" && vor.preisCents === 5900 && S.koopFassungFuer("vorsorge") === "IA-KOOP-2026-10-16-A", "Altangebot ohne Bereich = Vorsorge, 59 €, Fassung A");
  const dv = { ref: "FIAON-IA-KTEST01", fassung: S.KOOP_FASSUNG, partner: { anrede: "Herr", vorname: "A", nachname: "B", firma: "", strasse: "X 1", plz: "10115", ort: "Berlin", land: "DE", email: "a@b.de", telefon: "", art: "unternehmer" }, parameter: vor, gueltigBis: "2026-12-31" } as any;
  ok(S.koopRumpfHtml(dv).includes("Termine") || S.koopRumpfHtml(dv).includes("qualifizierte"), "Vorsorge-Vertrag rendert wie bisher");

  console.log("\nRecht — Partnerplatz");
  ok(S.koopPflichtFehlen({ partner: dv.partner, parameter: S.koopParameterAus({ bereich: "recht" }) }).some((x) => /Region/.test(x)), "ohne Region: Annahme gesperrt");
  const recht = await annehmen("recht", "Berlin");
  ok(recht.status === 200 && recht.d.fassung === "IA-KOOP-PLATZ-2026-10-16" && recht.d.parameter.preisCents === 69000, "Angebot Recht: Fassung PLATZ, 690 €, angenommen");
  const html = S.koopRumpfHtml(recht.d);
  ok(/49b Abs\. 3/.test(html) && /nicht davon ab, ob, wie viele und welche Mandate/.test(html) && /höchstens drei Partnerplätze/.test(html) && !/je qualifiziertem Kontakt/.test(html), "Vertrag Recht: § 49b BRAO, unabhängig von Mandaten, drei Plätze, kein Preis je Kontakt");
  ok(S.koopSeite(recht.d).rechner.festMonat === "690 €" && /Partnerplatz/.test(S.koopAnnahmeTexte(recht.d).titel), "Angebotsseite: fester Monatspreis statt Rechner");
  const kundeR = await person("Rita", "Recht");
  const lageR = await L.koopAkteLage(kundeR) as any;
  const pR = lageR.partner.find((x: any) => x.angebotId === Number(recht.z.id));
  ok(pR?.modell === "platz" && pR.themen.length === 5, "Akte kennt den Partnerplatz mit fünf Gebieten");
  let r: any = await L.koopKontaktAnlegen(kundeR, { angebotId: Number(recht.z.id), thema: pR.themen[0].thema, termin: pR.termine[0].iso, art: "telefon", einwilligung: true, notiz: "Inkassoschreiben vom 02.10., Schulden aus 2021" }, { name: "Prüfer", agentId: null });
  ok(r.ok, `Recht: Notiz mit Inkasso/Schulden erlaubt, Kontakt übermittelt${r.ok ? "" : ` — ${r.error}`}`);
  const [kR] = (await sqlPool`SELECT k.*, e.wortlaut, e.fassung FROM fiaon_koop_kontakte k JOIN fiaon_koop_einwilligungen e ON e.id = k.einwilligung_id WHERE k.id = ${r.id}`) as any[];
  ok(kR.preis_cents === 0 && kR.abrechnung_monat === null && /Kosten des Erstgesprächs nennt Ihnen die Kanzlei/.test(kR.wortlaut) && kR.fassung === "KOOP-EW-RECHT-2026-10-16", "Kontakt kostet nichts einzeln; Einwilligung nennt Kosten vorab, eigene Fassung");
  r = await L.koopKontaktAnlegen(kundeR, { angebotId: Number(recht.z.id), thema: pR.themen[1].thema, termin: pR.termine[1].iso, art: "telefon", einwilligung: true, notiz: "Therapie läuft" }, { name: "Prüfer", agentId: null });
  ok(!r.ok && /Gesundheit/.test(r.error), "Recht: Gesundheit bleibt gesperrt");
  // Monatsrechnung: Annahmemonat frei, Folgemonat im Voraus
  const jetzt = new Date();
  const monat = jetzt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7);
  const [y, m] = monat.split("-").map(Number);
  const folge = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  ok(!(await L.koopMonatsrechnung(recht.z, monat, jetzt)).angelegt, "Annahmemonat: keine Rechnung (kostenfrei)");
  const zweiter = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 8));
  const re = await L.koopMonatsrechnung(recht.z, folge, zweiter);
  ok(re.angelegt && re.betragCents === 69000 && re.ref, `Partnerplatz ${folge}: Rechnung über 690 € am Monatsersten`);
  const [b] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${re.ref}`) as any[];
  ok(/Partnerplatz Recht/.test(String(b.pack_name)) && b.rechnung_ust_modus === "reverse_charge", "Bestellzeile: „Partnerplatz Recht“, Reverse Charge");
  const zeile = await L.koopRechnungsZeile(String(b.ref));
  ok(zeile && /unabhängig von Mandaten/.test(zeile.beschreibung), "Rechnungstext: fester Monatspreis, unabhängig von Mandaten");
  await L.koopLieferLauf(zweiter);
  const [nR] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_koop_rechnungen WHERE angebot_id = ${Number(recht.z.id)}`) as any[];
  ok(Number(nR.n) === 1, "Lauf legt den Monat nicht doppelt an (eine Rechnung)");
  const sichtR: any = await L.koopPartnerSicht(recht.z);
  ok(sichtR.modell === "platz" && sichtR.kontakte[0]?.reklamierbarBis === null && !sichtR.stand.startRahmen, "Partnerbereich Recht: keine Reklamation, kein Start-Rahmen");

  console.log("\nSteuern — Partnerplatz");
  const steuern = await annehmen("steuern", "PLZ 10–14");
  const hs = S.koopRumpfHtml(steuern.d);
  ok(steuern.status === 200 && /§ 9 Abs\. 2 des Steuerberatungsgesetzes/.test(hs) && /490 €/.test(hs) && /Lohnsteuerhilfeverein/.test(hs), "Vertrag Steuern: § 9 StBerG, 490 €, Lohnsteuerhilfeverein");

  console.log("\nEnergie — je Abschluss");
  const energie = await annehmen("energie");
  const he = S.koopRumpfHtml(energie.d);
  ok(energie.status === 200 && energie.d.fassung === "IA-KOOP-ABSCHLUSS-2026-10-16" && /129 €.*\(Strom\).*159 €.*\(Gas\)/s.test(he) && /Lieferbeginn/.test(he) && /neunzig Tagen/.test(he) && /Aufstellung aller Verträge/.test(he), "Vertrag Energie: 129/159 €, Lieferbeginn, 90 Tage, Auskunftsrecht");
  ok(/nicht allein wegen eines Eintrags/.test(he) && /nicht an Kunden weiterzuberechnen/.test(he), "Pflichten: Einzelprüfung, keine Weiterberechnung an Kunden");
  const kundeE = await person("Emil", "Energie");
  const lageE = await L.koopAkteLage(kundeE) as any;
  const pE = lageE.partner.find((x: any) => x.angebotId === Number(energie.z.id));
  r = await L.koopKontaktAnlegen(kundeE, { angebotId: Number(energie.z.id), thema: "Strom", termin: pE.termine[0].iso, art: "telefon", einwilligung: true, notiz: "Abschlag 142 €, 2.400 kWh" }, { name: "Prüfer", agentId: null });
  ok(r.ok && r.uebermittelt, "Energie: Kunde übermittelt");
  const kE1 = Number(r.id);
  const [ke] = (await sqlPool`SELECT k.*, e.wortlaut FROM fiaon_koop_kontakte k JOIN fiaon_koop_einwilligungen e ON e.id = k.einwilligung_id WHERE k.id = ${kE1}`) as any[];
  ok(ke.anschrift === "Musterweg 3, 10115 Berlin" && ke.preis_cents === 0 && ke.abrechnung_monat === null && /Anschrift/.test(ke.wortlaut) && /Vergütung, wenn ein Vertrag zustande kommt/.test(ke.wortlaut), "Anschrift übermittelt, noch nichts berechnet; Einwilligung nennt Anschrift und Vergütung");
  ok(mails.some((x) => x.an === `p-energie.${st}@pruefstand.test` && /Anschrift: Musterweg 3/.test(x.text) && /Abschluss/.test(x.text)), "Mail an den Versorger mit Anschrift und Hinweis auf die Meldung");
  await new Promise((w) => setTimeout(w, 1500));
  ok(mails.some((x) => x.an === `emil.${st}@pruefstand.test` && /Rückruf/.test(x.betreff) && /Vertrag entsteht nur/.test(x.text)), "Bestätigung an den Kunden: Rückruf, Vertrag nur durch ihn selbst");
  const kundeE2 = await person("Erna", "Energie");
  r = await L.koopKontaktAnlegen(kundeE2, { angebotId: Number(energie.z.id), thema: "Gas", termin: pE.termine[1].iso, art: "telefon", einwilligung: true }, { name: "Prüfer", agentId: null });
  const kE2 = Number(r.id);
  let ab: any = await L.koopAbschlussMelden(energie.z, kE1, "Strom");
  ok(ab.ok && /129 €/.test(ab.meldung), "Abschluss Strom gemeldet → 129 €");
  ab = await L.koopAbschlussMelden(energie.z, kE1, "Gas");
  ok(!ab.ok, "zweite Meldung zum selben Kunden abgelehnt");
  ab = await L.koopAbschlussMelden(energie.z, kE2, "kein");
  ok(ab.ok, "„Kein Abschluss“ vermerkt");
  ok(!(await L.koopAbschlussMelden(recht.z, Number(kR.id), "Strom")).ok, "Recht kann keine Abschlüsse melden");
  const reE = await L.koopMonatsrechnung(energie.z, monat, zweiter);
  ok(reE.angelegt && reE.anzahl === 1 && reE.betragCents === 12900, "Monatsrechnung Energie: 1 Abschluss × 129 € (kein Abschluss = nichts)");
  const zeE = await L.koopRechnungsZeile(String(reE.ref));
  ok(zeE && /gemeldete|Abschlüsse/.test(zeE.beschreibung), "Rechnungstext: vermittelte Abschlüsse");
  const sichtE: any = await L.koopPartnerSicht(energie.z);
  ok(sichtE.modell === "abschluss" && sichtE.sparten.length === 2 && sichtE.kontakte.every((k: any) => k.reklamierbarBis === null), "Partnerbereich Energie: Sparten, keine Reklamation");

  console.log("\nTelefon & Internet — je Abschluss");
  const tel = await annehmen("telekom");
  const ht = S.koopRumpfHtml(tel.d);
  ok(tel.status === 200 && /99 €.*\(Mobilfunk\).*149 €.*\(Internet und Festnetz\)/s.test(ht) && /Widerrufsfrist/.test(ht) && /§ 5 TKG/.test(ht), "Vertrag Telefon: 99/149 €, Widerrufsfrist, § 5 TKG");

  console.log("\nAufräumen");
  await sqlPool`DELETE FROM fiaon_koop_kontakte WHERE angebot_id = ANY(${angebote}::int[])`;
  await sqlPool`DELETE FROM fiaon_applications WHERE ref IN (SELECT ref FROM fiaon_koop_rechnungen WHERE angebot_id = ANY(${angebote}::int[]))`;
  await sqlPool`DELETE FROM fiaon_koop_rechnungen WHERE angebot_id = ANY(${angebote}::int[])`;
  await sqlPool`DELETE FROM fiaon_koop_einwilligungen WHERE person_id = ANY(${ids}::int[])`;
  await sqlPool`DELETE FROM fiaon_global_angebote WHERE id = ANY(${angebote}::int[])`;
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${ids}::int[])`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids}::int[])`;
  ok(true, "Prüfdaten entfernt");
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
