// Prüfstand E-386 (16.10.2026): Lieferstrecke des Kooperationsvertrags — ein Kontakt von der Einwilligung bis zur Monatsrechnung.
// NUR gegen eine LOKALE Kopie (Prüfstand, PG 127.0.0.1:54329). Mails gehen nie raus: fetch zu api.brevo.com wird hier
// abgefangen und protokolliert. Aufruf:
//   env -i HOME=$HOME PATH=$PATH BREVO_API_KEY=pruef SESSION_SECRET=pruef \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_koop?sslmode=require' node_modules/.bin/tsx scripts/pruef-koop-lieferung.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

if (!/127\.0\.0\.1|localhost/.test(String(process.env.DATABASE_URL))) { console.error("Nur gegen den lokalen Prüfstand."); process.exit(3); }

// ── Brevo abfangen ──────────────────────────────────────────────────────────
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
  const L = await import("../server/lib/fiaon-koop-lieferung");
  const S = await import("../shared/fiaon-koop-lieferung");
  const P = await import("../shared/fiaon-pakete");
  const { katalogpreiseSyncen } = await import("../server/lib/fiaon-katalogpreise");
  await A.ensureAngebotTabellen();
  await L.ensureKoopTabellen();
  await katalogpreiseSyncen();
  const stempel = Date.now().toString(36);

  console.log("Reine Regeln");
  ok(S.koopLetzterWerktagVor("2026-10-19") === "2026-10-16", "letzter Werktag vor Montag 19.10. = Freitag 16.10.");
  ok(S.koopTerminTagMoeglich("2026-10-19", "2026-10-16") && !S.koopTerminTagMoeglich("2026-10-19", "2026-10-17"), "Montagstermin: Freitag ja, Samstag nein (Ziffer 4)");
  ok(S.koopLetzterWerktagVor("2026-10-05") === "2026-10-02", "Feiertag 03.10. zählt (Samstag), Montag 05.10. → Freitag 02.10.");
  ok(S.koopFeiertage(2026).has("2026-04-03") && S.koopFeiertage(2026).has("2026-05-25"), "Karfreitag und Pfingstmontag 2026 erkannt");
  ok(!S.koopZeitenAus({ tage: [], von: "09:00", bis: "18:00", dauerMin: 60, arten: ["telefon"] }).ok && S.koopZeitenAus({ tage: [1, 5], von: "09:00", bis: "12:00", dauerMin: 60, arten: ["telefon", "video"] }).ok, "Zeiten werden geprüft");
  ok(P.paket("koop_kontakte")?.preisJeAngebot === true && P.paket("koop_kontakte")?.abo === false && P.paket("koop_kontakte")?.zahlungsseite === "global" && !P.istGlobalPaket("koop_kontakte"), "Katalog: koop_kontakte — kein Abo, Betrag aus dem Vertrag, Global-Kategorie, kein Global-Start");
  const { produktkategorie } = await import("../server/lib/fiaon-produktkategorie");
  ok(produktkategorie({ type: "business", ref: "FIAON-KOOP-X", pack_key: "koop_kontakte" }) === "global", "Produktkategorie der Monatsrechnung = global (nie Privat-Erinnerung/Rückholung)");

  console.log("\nPersonen und Vertrag");
  const person = async (vor: string, nach: string, extra: Record<string, unknown> = {}) => {
    const [p] = (await sqlPool`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, primary_phone, country, birthdate, is_blocked, werbung_gesperrt_am, created_at, updated_at)
      VALUES (${`PRUEF-${stempel}-${vor}`.toUpperCase()}, ${vor}, ${nach}, ${`${vor.toLowerCase()}.${stempel}@pruefstand.test`}, ${"+4917612345" + String(Math.floor(Math.random() * 900) + 100)},
              ${(extra.country as string) ?? "DE"}, ${(extra.birthdate as string) ?? "1985-04-02"}, ${extra.is_blocked === true}, ${extra.werbung ? new Date() : null}, NOW(), NOW())
      RETURNING id`) as any[];
    return Number(p.id);
  };
  const partnerId = await person("Paul", "Partner");
  const kunde = await person("Klara", "Kundin");
  const kunde2 = await person("Karl", "Zweiter");
  const kunde3 = await person("Kim", "Dritte");
  const gesperrt = await person("Gesa", "Gesperrt", { is_blocked: true });
  const werbung = await person("Wera", "Werbesperre", { werbung: true });
  const ohneDaten = await person("Olaf", "Ohneland", { country: "", birthdate: null as any });
  await sqlPool`UPDATE fiaon_persons SET country = NULL, birthdate = NULL WHERE id = ${ohneDaten}`;
  const [agent] = (await sqlPool`SELECT id, name FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];
  const wer = { name: String(agent?.name ?? "Prüfer"), agentId: agent ? Number(agent.id) : null };

  const anlage = await K.koopAnlegen({
    personId: partnerId, gueltigBis: "2026-12-31",
    partner: { anrede: "Herr", vorname: "Paul", nachname: "Partner", firma: "Finanz- und Vermögensberatung", strasse: "Teststraße 1", plz: "10115", ort: "Berlin", land: "DE", email: `paul.${stempel}@pruefstand.test`, telefon: "+49 30 1234567" },
    parameter: { startDeckel: 5 },
  }, "Prüfstand");
  ok(anlage.ok, `Kooperationsvertrag angelegt${anlage.ok ? ` (${anlage.ref})` : ""}`);
  if (!anlage.ok) throw new Error(anlage.error);
  let z = (await A.angebotLesen({ id: anlage.id }))!;
  const d = K.koopDatenAus(z);
  const annahme = await K.koopAnnehmen(z, {
    textHash: K.koopTextHash(d), wunschWoche: 2, gelesen: true, unternehmer: true, unterschrift: { art: "getippt", name: "Paul Partner" },
  }, { ip: "84.150.10.20", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15", leitung: false }, { zuViel: () => false });
  ok(annahme.status === 200 && (annahme.body as any).ok, `Partner nimmt an (2 Kontakte je Woche, Start-Rahmen 5) — ${annahme.status}`);
  z = (await A.angebotLesen({ id: anlage.id }))!;

  let stand = await L.koopLieferStand(z);
  ok(stand.aktiv && /keine Zeiten/.test(String(stand.sperre)), "ohne freigegebene Zeiten: kein Kontakt möglich");

  console.log("\nPartnerbereich");
  const token = L.koopPartnerToken(String(z.angebot_ref));
  ok((await L.koopAngebotAusToken(token))?.id === z.id, "signierter Partnerlink öffnet genau diesen Vertrag");
  ok(!(await L.koopAngebotAusToken(token.slice(0, -2) + "00")), "verfälschter Link öffnet nichts");
  const lauf1 = await L.koopLieferLauf();
  ok(lauf1.partnerMails >= 1 && mails.filter((m) => m.an === d.partner.email && /Partnerbereich/.test(m.betreff) && m.text.includes("/partner/")).length === 1, "Lauf schickt den Partnerbereich einmal nach der Annahme");
  ok((await L.koopLieferLauf()).partnerMails === 0, "… und kein zweites Mal");
  ok(!(await L.koopZeitenSetzen(z, { tage: [1], von: "09:00", bis: "09:30", dauerMin: 60, arten: ["telefon"] }, "Paul")).ok, "Zeiten ohne Platz für einen Termin werden abgelehnt");
  const zs = await L.koopZeitenSetzen(z, { tage: [1, 2, 3, 4, 5], von: "09:00", bis: "17:00", dauerMin: 60, arten: ["telefon", "video"] }, "Paul (Partnerbereich)");
  ok(zs.ok, `Partner gibt Zeiten frei: ${zs.ok ? zs.zeitenText : ""}`);
  z = (await A.angebotLesen({ id: anlage.id }))!;
  stand = await L.koopLieferStand(z);
  ok(stand.sperre === null && stand.startRahmen?.deckel === 5 && stand.woche.wunsch === 2, "jetzt frei: Start-Rahmen 0/5, Woche 0/2");

  console.log("\nKundenbereich: Interesse");
  const kl = await L.koopKundeLage(kunde);
  ok(kl.zeigen && kl.stand === "frage", "Karte im Kundenbereich erscheint (Frage)");
  ok(!(await L.koopKundeLage(gesperrt)).zeigen && !(await L.koopKundeLage(werbung)).zeigen && !(await L.koopKundeLage(partnerId)).zeigen, "Gesperrte, Werbegesperrte und der Partner selbst sehen keine Karte");
  await L.koopInteresseVermerken(kunde, { ja: true, kanal: "kundenbereich", von: "Klara Kundin (Kundenbereich)", ip: "84.1.2.3", userAgent: "Mozilla" });
  ok((await L.koopKundeLage(kunde)).stand === "gewuenscht", "Interesse gespeichert");
  const [aufgabe] = (await sqlPool`SELECT titel FROM fiaon_betreiber_todos WHERE person_id = ${kunde} ORDER BY id DESC LIMIT 1`) as any[];
  ok(/Vorsorge und Absicherung/.test(String(aufgabe?.titel)), "Betreuer bekommt die Aufgabe „Kunde wünscht ein Gespräch“");
  const [ewI] = (await sqlPool`SELECT * FROM fiaon_koop_einwilligungen WHERE person_id = ${kunde} AND art = 'interesse'`) as any[];
  ok(ewI?.kanal === "kundenbereich" && ewI.wortlaut === S.KOOP_INTERESSE.wortlaut && ewI.erteilt_am && ewI.fassung === S.KOOP_EINWILLIGUNG_FASSUNG && ewI.ip === "84.1.2.3", "Interesse mit Datum, Uhrzeit, Wortlaut, Kanal, Fassung und IP");

  console.log("\nAkte: Qualifizierungsmaske");
  const lage = await L.koopAkteLage(kunde) as any;
  const p0 = lage.partner?.[0];
  ok(p0 && p0.termine.length > 0 && p0.themen.length === 5, `Akte zeigt den Partner mit ${p0?.termine.length ?? 0} freien Terminen und fünf Themen`);
  ok(p0.termine.every((t: any) => S.koopTerminTagMoeglich(t.tag, new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }))), "jeder angebotene Termin hält die Werktag-Regel");
  const thema = p0.themen[0].thema;
  const t1 = p0.termine[0];
  const basis = { angebotId: Number(z.id), thema, termin: t1.iso, art: "telefon", notiz: "zwei Kinder, möchte ansparen" };
  let r: any = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: false }, wer);
  ok(!r.ok && /Ja/.test(r.error), "ohne ausdrückliches Ja: kein Kontakt");
  r = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: true, notiz: "hat Schulden bei der Bank" }, wer);
  ok(!r.ok && /Notiz/.test(r.error), "Notiz mit Schulden/Bonität wird abgelehnt (geht an den Partner)");
  r = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: true, thema: "Bausparen" }, wer);
  ok(!r.ok, "Thema außerhalb der Liste des Partners wird abgelehnt");
  r = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: true, art: "vor_ort" }, wer);
  ok(!r.ok, "Terminart, die der Partner nicht anbietet, wird abgelehnt");
  r = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: true, termin: new Date(Date.now() + 3600_000).toISOString() }, wer);
  ok(!r.ok, "Termin außerhalb der freien Termine wird abgelehnt");
  const vorher = mails.length;
  r = await L.koopKontaktAnlegen(kunde, { ...basis, einwilligung: true }, wer);
  ok(r.ok && r.uebermittelt, `Kontakt 1 gespeichert und übermittelt — ${r.meldung ?? r.error}`);
  const kontakt1 = Number(r.id);
  await new Promise((w) => setTimeout(w, 1500));
  const mPartner = mails.slice(vorher).find((m) => m.an === d.partner.email);
  if (!mPartner) console.log("    Mails seit vorher:", mails.slice(vorher).map((m) => `${m.an} | ${m.betreff}`));
  const mKunde = mails.slice(vorher).find((m) => m.an.startsWith("klara."));
  ok(mPartner && mPartner.text.includes("Klara Kundin") && mPartner.text.includes(thema) && mPartner.text.includes("Einwilligung") && mPartner.text.includes("/partner/") && !/Schulden|Einkommen|SCHUFA/i.test(mPartner.text), "Mail an den Partner: Name, Thema, Termin, Einwilligung, Partnerbereich — nichts zu Schulden/Einkommen");
  ok(mKunde && /Gesprächstermin/.test(mKunde.betreff) && mKunde.text.includes("widerrufen"), "Bestätigung an die Kundin mit Widerrufshinweis");
  const [ewU] = (await sqlPool`SELECT e.* FROM fiaon_koop_einwilligungen e JOIN fiaon_koop_kontakte k ON k.einwilligung_id = e.id WHERE k.id = ${kontakt1}`) as any[];
  ok(ewU?.art === "uebermittlung" && ewU.kanal === "telefon" && ewU.wortlaut.includes("Paul Partner") && ewU.wortlaut.includes(thema) && ewU.wortlaut.includes("Antwort des Kunden: Ja") && ewU.erteilt_von === wer.name, "Einwilligung: Wortlaut mit Partnername und Thema, Kanal Telefon, Mitarbeiter, Zeitpunkt");
  r = await L.koopKontaktAnlegen(kunde, { ...basis, termin: p0.termine[1].iso, einwilligung: true }, wer);
  ok(!r.ok && /exklusiv/.test(r.error), "Exklusivität: dieselbe Kundin zum selben Thema → abgelehnt");
  r = await L.koopKontaktAnlegen(gesperrt, { ...basis, einwilligung: true }, wer);
  ok(!r.ok && /Vertriebssperre/.test(r.error), "Gesperrte: kein Kontakt");
  r = await L.koopKontaktAnlegen(werbung, { ...basis, einwilligung: true }, wer);
  ok(!r.ok && /Werbesperre/.test(r.error), "Werbegesperrte: kein Kontakt");
  r = await L.koopKontaktAnlegen(ohneDaten, { ...basis, termin: p0.termine[1].iso, einwilligung: true }, wer);
  ok(!r.ok && /Deutschland|volljährig/.test(r.error), "fehlt Wohnsitz/Geburtsdatum in der Akte: Mitarbeiter muss bestätigen");
  r = await L.koopKontaktAnlegen(kunde2, { ...basis, termin: t1.iso, einwilligung: true }, wer);
  ok(!r.ok && /nicht \(mehr\) frei/.test(r.error), "belegter Termin wird nicht doppelt vergeben");
  r = await L.koopKontaktAnlegen(ohneDaten, { ...basis, termin: p0.termine[1].iso, einwilligung: true, bestaetigt: ["wohnsitz_de", "volljaehrig"] }, wer);
  ok(r.ok, "mit Bestätigung: Kontakt 2 übermittelt");
  const kontakt2 = Number(r.id);
  z = (await A.angebotLesen({ id: anlage.id }))!;
  stand = await L.koopLieferStand(z);
  ok(stand.woche.geliefert === 2 && /Wunschmenge/.test(String(stand.sperre)), "Wunschmenge der Woche (2) erreicht → Sperre");
  r = await L.koopKontaktAnlegen(kunde2, { ...basis, termin: p0.termine[2].iso, einwilligung: true }, wer);
  ok(!r.ok && /Wunschmenge/.test(r.error), "dritter Kontakt in dieser Woche abgelehnt");
  const ws = await L.koopWunschSetzen(z, 5, "Paul (Partnerbereich)");
  ok(ws.ok, "Partner erhöht die Wunschmenge auf 5");
  z = (await A.angebotLesen({ id: anlage.id }))!;
  r = await L.koopKontaktAnlegen(kunde2, { ...basis, termin: p0.termine[2].iso, einwilligung: true }, wer);
  ok(r.ok, "Kontakt 3 übermittelt");
  const kontakt3 = Number(r.id);
  r = await L.koopKontaktAnlegen(kunde2, { ...basis, thema: p0.themen[1].thema, termin: p0.termine[3].iso, einwilligung: true }, wer);
  ok(r.ok, "Kontakt 4 (derselbe Kunde, anderes Thema) übermittelt");
  r = await L.koopKontaktAnlegen(kunde2, { ...basis, thema: p0.themen[2].thema, termin: p0.termine[4].iso, einwilligung: true }, wer);
  ok(r.ok, "Kontakt 5 übermittelt");
  z = (await A.angebotLesen({ id: anlage.id }))!;
  stand = await L.koopLieferStand(z);
  ok(/Start-Rahmen/.test(String(stand.sperre)) && stand.startRahmen?.geliefert === 5, "Start-Rahmen (5) erreicht → Sperre bis zur ersten bezahlten Rechnung");

  console.log("\nReklamation vor der Rechnung");
  const jetztNachTermin = new Date(Date.parse(p0.termine[2].iso) + 26 * 3600_000);
  let rk: any = await L.koopReklamieren(z, kontakt3, { grund: "kein_abschluss", wahl: "gutschrift" });
  ok(!rk.ok, "„Kein Abschluss“ ist kein Grund");
  rk = await L.koopReklamieren(z, kontakt2, { grund: "keine_einwilligung", wahl: "gutschrift" }, jetztNachTermin);
  ok(rk.ok && rk.ergebnis === "abgelehnt" && /Nachweis der Einwilligung/.test(rk.begruendung), "Einwilligung bestritten → abgelehnt mit Nachweis (Datum, Kanal, Wortlaut)");
  rk = await L.koopReklamieren(z, kontakt3, { grund: "dublette", wahl: "gutschrift" }, jetztNachTermin);
  ok(rk.ok && rk.ergebnis === "abgelehnt", "Dublette ohne früheren Kontakt → abgelehnt");
  rk = await L.koopReklamieren(z, kontakt3, { grund: "daten_falsch", wahl: "ersatz" }, jetztNachTermin);
  ok(!rk.ok, "ein Kontakt wird nur einmal reklamiert");
  const zuSpaet = new Date(Date.parse(p0.termine[0].iso) + 9 * 864e5);
  rk = await L.koopReklamieren(z, kontakt1, { grund: "nicht_erschienen", wahl: "gutschrift" }, zuSpaet);
  ok(!rk.ok && /frist/i.test(rk.error), "nach der Frist (7 Tage nach dem Termin) keine Reklamation");

  console.log("\nMonatsrechnung");
  const monat = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7);
  const [jj, mm] = monat.split("-").map(Number);
  const folgeErster = new Date(Date.UTC(mm === 12 ? jj + 1 : jj, mm === 12 ? 0 : mm, 1, 9, 0));
  ok(!(await L.koopMonatsrechnung(z, monat)).angelegt, "laufender Monat wird nicht abgerechnet");
  const vorRechnung = mails.length;
  const re = await L.koopMonatsrechnung(z, monat, folgeErster);
  ok(re.angelegt && re.ref && re.anzahl === 5 && re.betragCents === 5 * 5900, `Rechnung für ${monat}: 5 Kontakte × 59 € = ${(re.betragCents / 100).toFixed(2)} €`);
  ok(!(await L.koopMonatsrechnung(z, monat, folgeErster)).angelegt, "zweiter Aufruf legt nichts doppelt an");
  const [b] = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${re.ref}`) as any[];
  ok(b?.pack_key === "koop_kontakte" && b.payment_status === "pending_payment" && /^FIAON-INV-/.test(String(b.invoice_number)) && b.payment_reference && Number(b.amount_due) === 295 && b.rechnung_ust_modus === "reverse_charge" && b.person_id === partnerId && b.payment_email_sent_at, "Bestellzeile: Rechnungsnummer, Verwendungszweck, 295,00 €, Reverse Charge, am Partner, keine Privat-Zahlungsmail");
  const tage = Math.round((new Date(b.payment_due_date).getTime() - folgeErster.getTime()) / 864e5);
  ok(tage === 14, `Zahlungsziel ${tage} Tage`);
  const { rechnungAlsPdf } = await import("../server/lib/fiaon-rechnung-pdf");
  const pdf = await rechnungAlsPdf(String(b.payment_reference));
  ok(pdf && pdf.pdf.length > 1500, `Rechnungs-PDF erzeugt (${pdf?.pdf.length ?? 0} Byte)`);
  if (process.env.PDF_AUS && pdf) {
    const { writeFileSync } = await import("node:fs");
    const [rz] = (await sqlPool`SELECT id FROM fiaon_koop_rechnungen WHERE ref = ${re.ref}`) as any[];
    writeFileSync(`${process.env.PDF_AUS}/rechnung.pdf`, pdf.pdf);
    const auf = await L.koopAufstellungPdf(Number(rz.id));
    if (auf) writeFileSync(`${process.env.PDF_AUS}/aufstellung.pdf`, auf);
  }
  const zeile = await L.koopRechnungsZeile(String(b.ref));
  ok(zeile && /5 × 59 € netto/.test(zeile.beschreibung) && /01\.\d\d\.\d{4} – \d\d\.\d\d\.\d{4}/.test(zeile.zeitraum), `Rechnungszeile: „${zeile?.beschreibung.slice(0, 60)}…“, Zeitraum ${zeile?.zeitraum}`);
  const { b2bUstModus } = await import("../server/fiaon-invoice");
  ok(b2bUstModus(b) === "reverse_charge" && b2bUstModus({ rechnung_ust_modus: "reverse_charge", tax_id: "", pack_key: "global_struktur" }) === "none", "Reverse Charge auf der Kooperationsrechnung auch ohne USt-IdNr. — Global unverändert");
  await new Promise((ok2) => setTimeout(ok2, 4000));
  const mRe = mails.slice(vorRechnung).find((m) => /Ihre Rechnung/.test(m.betreff));
  ok(mRe && mRe.an === d.partner.email && mRe.anhaenge.length >= 1 && mRe.text.includes(String(b.payment_reference)), `Rechnungsmail an den Partner mit ${mRe?.anhaenge.length ?? 0} Anhang/Anhängen (${mRe?.anhaenge.join(", ")})`);
  const { zahlungsauftragFinden } = await import("../server/lib/fiaon-zahlungsauftrag");
  const za: any = await zahlungsauftragFinden(String(b.payment_reference));
  ok(za && za.firmenauftrag === true && !za.auftrag && Number(za.amountDue) === 295, "Zahlungsseite: Firmenrechnung über 295 €, ohne fremden Auftragsblock");

  console.log("\nReklamation nach der Rechnung → Gutschrift in der nächsten");
  rk = await L.koopReklamieren(z, kontakt1, { grund: "daten_falsch", wahl: "gutschrift", text: "Nummer vergeben" }, new Date(Date.parse(p0.termine[0].iso) + 864e5));
  ok(rk.ok && rk.ergebnis === "berechtigt" && /nächsten Monatsrechnung/.test(rk.begruendung), "berechtigt — Gutschrift in der nächsten Rechnung");

  console.log("\nRuhen und erste Zahlung");
  await sqlPool`UPDATE fiaon_applications SET payment_due_date = NOW() - INTERVAL '9 days' WHERE ref = ${re.ref}`;
  z = (await A.angebotLesen({ id: anlage.id }))!;
  stand = await L.koopLieferStand(z);
  ok(stand.ruht && /ruht/.test(String(stand.sperre)), "Rechnung 9 Tage über Fälligkeit offen → Übermittlung ruht");
  const vorErinnerung = mails.length;
  const lE = await L.koopLieferLauf();
  ok(lE.erinnerungen === 1 && mails.slice(vorErinnerung).some((m) => /Erinnerung/.test(m.betreff)), "eine Zahlungserinnerung");
  ok((await L.koopLieferLauf()).erinnerungen === 0, "… und nur eine");
  await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid', paid_at = NOW() WHERE ref = ${re.ref}`;
  stand = await L.koopLieferStand(z);
  ok(!stand.ruht && stand.startRahmen === null && (stand.sperre === null || /Wunschmenge/.test(stand.sperre)), `bezahlt → ruht nicht mehr, Start-Rahmen entfällt, Wunschmenge gilt (${stand.sperre ?? "frei"})`);
  const { onCustomerPaid } = await import("../server/routes/fiaon-agent");
  await onCustomerPaid(String(re.ref)).catch((e: unknown) => console.log("    (onCustomerPaid:", String(e).slice(0, 120), ")"));
  const [prov] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_commissions WHERE ref = ${re.ref}`) as any[];
  ok(Number(prov?.n) === 0, "Zahlung der Kooperationsrechnung: keine Provision");

  console.log("\nZweiter Monat mit Gutschrift");
  ok((await L.koopWunschSetzen(z, 10, "Paul (Partnerbereich)")).ok, "Partner erhöht auf 10 je Woche");
  z = (await A.angebotLesen({ id: anlage.id }))!;
  const lage2 = await L.koopAkteLage(kunde3) as any;
  r = await L.koopKontaktAnlegen(kunde3, { angebotId: Number(z.id), thema: lage2.partner[0].themen[1].thema, termin: lage2.partner[0].termine.at(-1).iso, art: "video", einwilligung: true }, wer);
  ok(r.ok, `Kontakt 6 übermittelt${r.ok ? "" : ` — ${r.error}`}`);
  const naechster = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
  await sqlPool`UPDATE fiaon_koop_kontakte SET abrechnung_monat = ${naechster(monat)} WHERE id = ${Number(r.id)}`;
  const [y2, m2] = naechster(monat).split("-").map(Number);
  const re2 = await L.koopMonatsrechnung(z, naechster(monat), new Date(Date.UTC(m2 === 12 ? y2 + 1 : y2, m2 === 12 ? 0 : m2, 1, 9)));
  ok(re2.angelegt && re2.anzahl === 1 && re2.betragCents === 0 && re2.ref === null, "1 Kontakt − 1 Gutschrift = 0 € → keine Rechnung, Gutschrift verrechnet");
  const [gz] = (await sqlPool`SELECT gutschrift_cents FROM fiaon_koop_rechnungen WHERE angebot_id = ${Number(z.id)} AND monat = ${naechster(monat)}`) as any[];
  ok(Number(gz?.gutschrift_cents) === 5900, "Gutschrift 59 € steht an der Monatszeile");

  console.log("\nWiderruf");
  const sicht: any = await L.koopPartnerSicht(z);
  ok(sicht.kontakte.length === 6 && sicht.rechnungen.length === 2 && sicht.rechnungen.some((x: any) => x.status === "bezahlt"), "Partnerbereich: 6 Kontakte, 2 Monatszeilen, eine bezahlt");
  const vorW = mails.length;
  const w = await L.koopWiderruf(kunde, { name: "Prüfer", kanal: "telefon" });
  ok(w.widerrufen >= 1 && w.partnerInformiert === 1 && mails.slice(vorW).some((m) => /Widerruf/.test(m.betreff) && m.an === d.partner.email), "Widerruf: Einwilligung beendet, Partner sofort informiert");
  ok((await L.koopKundeLage(kunde)).stand === "frage", "nach dem Widerruf: Karte fragt wieder (kein Termin, kein Interesse aktiv)");
  const kk = await L.koopKeinKontakt(z, kontakt3);
  ok(kk.ok, "Partner meldet „kein Kontakt mehr gewünscht“");

  console.log("\nAufräumen (nur Prüfdaten)");
  const ids = [partnerId, kunde, kunde2, kunde3, gesperrt, werbung, ohneDaten];
  await sqlPool`DELETE FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)}`;
  await sqlPool`DELETE FROM fiaon_koop_rechnungen WHERE angebot_id = ${Number(z.id)}`;
  await sqlPool`DELETE FROM fiaon_koop_einwilligungen WHERE person_id = ANY(${ids}::int[])`;
  await sqlPool`DELETE FROM fiaon_applications WHERE ref LIKE ${"FIAON-KOOP-" + String(z.angebot_ref).slice(-6) + "-%"}`;
  await sqlPool`DELETE FROM fiaon_global_angebote WHERE id = ${Number(z.id)}`;
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${ids}::int[])`;
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}::int[])`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids}::int[])`;
  const [rest] = (await sqlPool`SELECT (SELECT COUNT(*) FROM fiaon_koop_kontakte WHERE angebot_id = ${Number(z.id)})::int + (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${ids}::int[]))::int AS n`) as any[];
  ok(Number(rest.n) === 0, "Prüfdaten entfernt");
  console.log(`\nMails abgefangen: ${mails.length} (keine ging raus)`);
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden`);
  await sqlPool.end({ timeout: 2 }).catch(() => {});
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
