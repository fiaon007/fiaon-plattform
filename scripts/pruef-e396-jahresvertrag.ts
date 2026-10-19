// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-396 (19.10.2026) — DER JAHRESVERTRAG LÄUFT BIS ZUM LAUFZEITENDE, KULANZ NUR NACH ZAHLUNG — offline
//
// Justin, 19.10.2026: „JEDER Kunde, der … Vertrag akzeptiert hat … hat mit uns einen 12 Monats VERTRAG, AUSSER die
// Kunden, die wir aus Kulanz kündigen. Die Kunden müssen dann noch die letzte offene Rechnung einbezahlen; sobald sie
// das getan haben = gekündigt. Auch MARA muss das wissen, und das ganz genau!“
//
// Geprüft ohne Netz und ohne Datenbank (reine Regeln, Sätze, Wände): Laufzeitende und Monatsfrist, der Weg (Laufzeit /
// bisher), die Kulanz-Rechnung, DIE EINE Kulanz-Fassung an allen Stellen (Bestätigungsmail, Mara Mail und WhatsApp,
// Urkunde, Hauswissen), die Sendesperre E-393 (Jahresvertrag frei, Altvertrag und Widerruf gesperrt), die Prüfung der
// WhatsApp-Antwort, die Automatik der Formular-Anträge. Den Datenbank-Teil prüft scripts/pruef-e396-jahresvertrag-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-e396-jahresvertrag.ts
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";

let gut = 0, schlecht = 0;
const rot: string[] = [];
function ok(b: unknown, was: string, extra = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; rot.push(was); console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); }
}
const kurz = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n)}…` : t);

async function main() {
  const JV = await import("../shared/fiaon-jahresvertrag");
  const TON = await import("../shared/fiaon-mara-ton");
  const WV = await import("../shared/fiaon-wortverbote");
  const WISSEN = await import("../shared/fiaon-wissen");
  const KR = await import("../server/routes/fiaon-kuendigung");
  const PMW = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const WA = await import("../server/lib/fiaon-whatsapp-mara");
  const WAS = await import("../server/lib/fiaon-whatsapp");
  const FOLGEN = await import("../server/lib/fiaon-kuendigung-folgen");
  const URK = await import("../server/lib/fiaon-kuendigung-urkunde");

  const SATZ = "Wenn Sie die offene Rechnung über 59,99 € bezahlen, entlassen wir Sie aus Kulanz vorzeitig aus dem Vertrag — dann endet er mit dem Zahlungseingang, und es kommen keine weiteren Raten.";
  const RECHTE = "Ihr gesetzliches Widerrufs- und Kündigungsrecht bleibt unberührt.";

  console.log("── 1 · Laufzeitende und Monatsfrist (AGB § 6 Abs. 2) ───────────────────────");
  ok(JV.erstlaufzeitEnde("2026-10-06") === "2027-10-05", "Vertragsschluss 06.10.2026 → Ende der zwölf Monate 05.10.2027", JV.erstlaufzeitEnde("2026-10-06"));
  ok(JV.erstlaufzeitEnde("2027-01-31") === "2028-01-30", "31.01. → 30.01. des Folgejahres");
  ok(JV.erstlaufzeitEnde("2028-02-29") === "2029-02-27", "Schaltjahr: 29.02.2028 → 27.02.2029 (gekappt)", JV.erstlaufzeitEnde("2028-02-29"));
  const e1 = JV.jahresvertragEnde({ beginn: "2026-10-06", zugang: "2026-10-19" });
  ok(e1.fristgerecht && e1.ende === "2027-10-05", "Kündigung im ersten Monat → zum Ende der zwölf Monate", JSON.stringify(e1));
  const e2 = JV.jahresvertragEnde({ beginn: "2026-10-06", zugang: "2027-09-05" });
  ok(e2.fristgerecht && e2.ende === "2027-10-05", "Kündigung am letzten Tag der Monatsfrist (05.09.) → noch zum 05.10.", JSON.stringify(e2));
  const e3 = JV.jahresvertragEnde({ beginn: "2026-10-06", zugang: "2027-09-06" });
  ok(!e3.fristgerecht && e3.ende === "2027-10-06", "einen Tag zu spät (06.09.) → einen Monat nach Zugang (06.10.)", JSON.stringify(e3));
  const e4 = JV.jahresvertragEnde({ beginn: "2026-10-06", zugang: "2027-12-15" });
  ok(!e4.fristgerecht && e4.ende === "2028-01-15", "nach den zwölf Monaten (unbefristet) → Monatsfrist ab Zugang", JSON.stringify(e4));
  ok(JV.imWiderrufsfenster("2026-10-06", "2026-10-20") && !JV.imWiderrufsfenster("2026-10-06", "2026-10-21"), "Widerrufsfenster: bis 14 Tage nach Vertragsschluss");

  console.log("── 2 · Der Weg: Laufzeit oder bisher ───────────────────────────────────────");
  const lage = (o: Partial<Parameters<typeof JV.kuendigungsWeg>[0]>) => JV.kuendigungsWeg({ jahresvertrag: true, bezahlt: true, annahmeBelegt: true, beginn: "2026-09-19", zugang: "2026-10-19", ...o });
  ok(lage({}).weg === "laufzeit", "Jahresvertrag, bezahlt, Annahme belegt, nach 14 Tagen → Laufzeit");
  ok(lage({ jahresvertrag: false }).weg === "bisher" && lage({ jahresvertrag: false }).warum === null, "Altvertrag (vor 03.09.) → bisheriger Weg, ohne Vermerk");
  ok(lage({ annahmeBelegt: false }).weg === "bisher" && /ohne belegte Annahme/.test(String(lage({ annahmeBelegt: false }).warum)), "ohne belegte Annahme → bisher, mit Grund (Karte)");
  ok(lage({ widerrufErwaehnt: true }).weg === "bisher" && /Widerruf/.test(String(lage({ widerrufErwaehnt: true }).warum)), "Widerruf erwähnt → bisher (der Widerruf bleibt unberührt)");
  ok(lage({ beginn: "2026-10-10" }).weg === "bisher" && /14 Tagen/.test(String(lage({ beginn: "2026-10-10" }).warum)), "in den ersten 14 Tagen → bisher");
  ok(lage({ bezahlt: false }).weg === "bisher", "unbezahlt → bisher (Storno)");
  ok(lage({ beginn: null }).weg === "bisher", "ohne bestimmbaren Vertragsschluss → bisher");

  console.log("── 3 · Kulanz-Rechnung und letzte geschuldete Rate ─────────────────────────");
  ok(JV.kulanzRechnung([]) === null, "keine offene Rate → kein Angebot (der Server legt die nächste an)");
  const k1 = JV.kulanzRechnung([{ nr: 2, cents: 5999, faellig: "2026-10-20", referenz: "X-2" }]);
  ok(k1?.bisNr === 2 && k1.summeCents === 5999, "eine offene Rate → Kulanz bis Rate 2, 59,99 €");
  const k2 = JV.kulanzRechnung([{ nr: 3, cents: 5999, faellig: null }, { nr: 2, cents: 5999, faellig: null }]);
  ok(k2?.bisNr === 3 && k2.summeCents === 11998 && k2.raten[0].nr === 2, "zwei offene → bis Rate 3, Summe, älteste zuerst");
  ok(JV.letzteGeschuldeteRate({ fristgerecht: true, ende: "2027-09-18", kette: [{ nr: 1, faellig: "2026-09-20", bezahlt: true }] }) === 12, "fristgerecht: alle zwölf Raten geschuldet (Gesamtvergütung § 5 Abs. 2)");
  ok(JV.letzteGeschuldeteRate({ fristgerecht: false, ende: "2027-10-20", kette: [{ nr: 13, faellig: "2027-09-20" }, { nr: 14, faellig: "2027-10-20" }, { nr: 15, faellig: "2027-11-20" }] }) === 14, "nach Verlängerung: auch Raten bis zum Ende (14), nicht danach");

  console.log("── 4 · DIE EINE Kulanz-Fassung ─────────────────────────────────────────────");
  ok(JV.kulanzSatz("59,99 €") === SATZ, "kulanzSatz ist wörtlich der Satz aus dem Auftrag", JV.kulanzSatz("59,99 €"));
  ok(JV.RECHTE_SATZ === RECHTE, "Rechte-Satz wörtlich (Rechtsprüfung Thema 6)");
  ok(/offenen Rechnungen über zusammen 119,98 €/.test(JV.kulanzSatz("119,98 €", { mehrere: true })), "mehrere Raten: „die offenen Rechnungen über zusammen …“");
  ok(JV.laufzeitSatz("2027-09-18") === "Ihr Vertrag hat eine feste Laufzeit von zwölf Monaten und endet deshalb zum 18.09.2027.", "Laufzeit-Satz mit Datum");
  ok(/unbefristet/.test(JV.laufzeitSatz("2028-01-15", { fristgerecht: false })), "Laufzeit-Satz nach den zwölf Monaten (Monatsfrist)");
  ok(/nur nach Zahlung der offenen Rechnung/i.test(JV.MARA_JAHRESVERTRAG_REGEL) && JV.MARA_JAHRESVERTRAG_REGEL.includes(JV.kulanzSatz("X €")) && /VERTRAG VOR DEM 03\.09\.2026: NICHTS davon/.test(JV.MARA_JAHRESVERTRAG_REGEL) && /WIDERRUF: nie ein Kulanz-Angebot/.test(JV.MARA_JAHRESVERTRAG_REGEL), "Maras Regel: Kulanz nur nach Zahlung, der eine Satz, Altvertrag nein, Widerruf nein");
  const fakten = WISSEN.wissenFakten();
  ok(fakten.includes(JV.kulanzSatz("X €")) && /mit einem Monat Frist zum Ende der zwölf Monate/.test(fakten) && !/Ab der Kündigung werden keine weiteren Raten gestellt/.test(fakten), "Hauswissen: der eine Satz, das Laufzeitende — die alte Fassung ist weg");

  console.log("── 5 · Mara: Kündigungssatz (Mail und WhatsApp) ────────────────────────────");
  const LINK = "https://fiaon.com/zahlung/FIAON-E396-2";
  const raten1 = [{ vom: "20.10.", betrag: "59,99 €", cents: 5999 }];
  const wM = TON.bausteinKuendigung({ kanal: "mail", weg: "laufzeit_ende", jahresvertrag: true, heute: "19.10.", raten: raten1, bestaetigung: true, laufzeitEnde: "2027-09-18" });
  ok(/heute, am 19\.10\., bei uns eingegangen/.test(wM) && /endet deshalb zum 18\.09\.2027/.test(wM) && wM.includes(SATZ) && wM.includes(RECHTE) && /Knopf/.test(wM) && !wM.includes("https://"), `Mail: Eingang, Ende, der Satz, Rechte, Knopf — „${kurz(wM)}“`);
  const wW = TON.bausteinKuendigung({ kanal: "whatsapp", weg: "laufzeit_ende", jahresvertrag: true, heute: "19.10.", raten: raten1, link: LINK, laufzeitEnde: "18.09.2027" });
  ok(wW.includes(SATZ) && wW.includes(RECHTE) && wW.includes(LINK) && /endet deshalb zum 18\.09\.2027/.test(wW) && !/offene Rate/.test(wW), `WhatsApp: derselbe Satz, Link, nie „offene Rate“ — „${kurz(wW)}“`);
  ok(!WAS.inkassoVerdacht(wW), "WhatsApp-Inkasso-Wand lässt den Satz durch");
  for (const t of [wM, wW]) ok(!/ab sofort (?:stellen wir )?keine|ihr vertrag ist beendet|danach kommt nichts mehr|lasse ich sie aus kulanz gerne/i.test(t), `nie „ab sofort keine Raten“, „beendet“, die alte Fassung — „${kurz(t, 60)}“`);
  const wB = TON.bausteinKuendigung({ kanal: "whatsapp", weg: "bereits", jahresvertrag: true, heute: "19.10.", raten: raten1, link: LINK, laufzeitEnde: "2027-09-18" });
  ok(/liegt uns schon vor/.test(wB) && wB.includes(SATZ), "„bereits“ (Laufzeit): „liegt uns schon vor“ + der Satz");
  const wO = TON.bausteinKuendigung({ kanal: "whatsapp", weg: "laufzeit_ende", jahresvertrag: true, heute: "19.10.", raten: raten1, link: LINK, laufzeitEnde: "2027-09-18", ohneZahlung: true });
  ok(!/kulanz/i.test(wO) && !wO.includes(LINK) && /endet deshalb zum/.test(wO), "kann nicht zahlen / Widerruf im Text: nur der Stand — kein Angebot, kein Link");
  const wN = TON.bausteinKuendigung({ kanal: "mail", weg: "laufzeit_ende", jahresvertrag: true, heute: "19.10.", raten: [], laufzeitEnde: "2027-09-18" });
  ok(!/kulanz/i.test(wN) && /endet deshalb zum 18\.09\.2027/.test(wN), "nichts offen: Ende, kein Kulanz-Angebot");
  const wAltJ = TON.bausteinKuendigung({ kanal: "mail", weg: "letzte_rate", jahresvertrag: true, heute: "19.10.", rateVom: "12.10.", betrag: "59,99 €" });
  ok(wAltJ.includes(SATZ) && wAltJ.includes(RECHTE), "Jahresvertrag auf dem bisherigen Weg: dieselbe Fassung (eine statt drei)");
  const wAlt = TON.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "19.10.", rateVom: "12.10.", betrag: "59,99 €", link: LINK, giltZum: "2026-11-11" });
  ok(!/kulanz/i.test(wAlt) && /Abrechnungsmonats, dem 11\.11\.2026/.test(wAlt), "Altvertrag unverändert: kein „Kulanz“, Ende des Abrechnungsmonats");
  for (const t of [wM, wW]) ok(TON.kuendigungAnZahlung(t) === null, `Mara-Ton: keine Kündigung an Zahlung gebunden — „${kurz(t, 60)}“`);
  const GEBUCHT = [{ werkzeug: "kuendigung_aufnehmen", ok: true, zeiten: [], satz: "…" }] as any[];
  ok(!WA.handlungsPruefung(wW, GEBUCHT, "Ja, bitte.", "", { links: [LINK], ruhe: true, jahresvertrag: true } as any).length, "WhatsApp-Antwortprüfung: der Satz mit Zahlungsseite geht nach gebuchter Kündigung durch");
  ok(WA.handlungsPruefung(wW, GEBUCHT, "Ich widerrufe den Vertrag", "", { links: [LINK], ruhe: true, jahresvertrag: true } as any).length > 0, "… beim Widerruf nicht (keine Zahlungsseite)");
  ok(WA.handlungsPruefung(`Ihre Kündigung ist eingegangen. ${SATZ}`, [], "Ich kündige", "", { links: [LINK], jahresvertrag: false } as any).some((f: string) => /Kulanz/.test(f)), "… beim Altvertrag fällt „Kulanz“ auf");

  console.log("── 6 · Mara Mail: Werkzeug-Satz (kuendigungSatz) ───────────────────────────");
  const ks = PMW.kuendigungSatz("laufzeit_ende", [{ nr: 2, cents: 5999, faellig: "20.10.2026" }], { laufzeitEnde: "2027-09-18" });
  ok(/Laufzeitende \(18\.09\.2027\)/.test(ks) && /Raten bis dahin laufen weiter/.test(ks) && /Kulanz-Angebot: Bezahlt er Rate 2 über 59,99 €/.test(ks), `Werkzeug: Ende + Kulanz-Angebot — „${kurz(ks)}“`);
  const ksB = PMW.kuendigungSatz("bereits", [], { laufzeitEnde: "2027-09-18" });
  ok(/lag bereits vor/.test(ksB) && /keine Rechnung offen/.test(ksB), "„bereits“, nichts offen");
  ok(/Kulanz/.test(PMW.kuendigungSatz("letzte_rate", [{ nr: 2, cents: 5999, faellig: "12.10.2026" }], { formlos: false })) && !/Kulanz/.test(PMW.kuendigungSatz("letzte_rate", [{ nr: 2, cents: 5999, faellig: "12.10.2026" }], { formlos: true, endeTag: "2026-11-11" })), "bisheriger Weg unverändert (Jahresvertrag Kulanz, Altvertrag ohne)");

  console.log("── 7 · Sendesperre E-393 — Jahresvertrag frei, Altvertrag und Widerruf gesperrt ──");
  const antwort = `Guten Tag Herr Test, ${wM.replace(/\n+/g, " ")}`;
  ok(WV.kopplungFinden(antwort) === null, "Jahresvertrag: der Kulanz-Satz ist keine Kopplung");
  ok(WV.kopplungFinden(antwort, { ohneKulanz: true }) !== null, "Altvertrag (ohneKulanz): derselbe Satz ist eine Kopplung");
  ok(WV.kopplungFinden(antwort, { widerruf: true }) !== null, "Widerruf: gesperrt");
  const u = (o: any) => WV.kuendigungSendeUrteil({ antwort, eingang: "Ich kündige meinen Vertrag.", betreff: "Kündigung", ...o });
  ok(!u({ kulanzErlaubt: true }).gesperrt, "Sendesperre: Jahresvertrag (kulanzErlaubt) → frei");
  ok(!u({}).gesperrt, "Sendesperre: ohne Angabe → frei wie bisher");
  ok(u({ kulanzErlaubt: false }).gesperrt && /vor dem 03\.09\.2026/.test(u({ kulanzErlaubt: false }).treffer[0]?.hinweis ?? ""), "Sendesperre: Altvertrag → gesperrt, mit Altvertrag-Hinweis");
  ok(WV.kuendigungSendeUrteil({ antwort, eingang: "Hiermit widerrufe ich den Vertrag.", betreff: "Widerruf", kulanzErlaubt: true }).gesperrt, "Sendesperre: Widerruf → gesperrt, auch beim Jahresvertrag");
  ok(WV.kopplungFinden("Mit Ihrem Widerruf endet der Vertrag vorzeitig; bereits geleistete Zahlungen prüft unsere Geschäftsführung.", { widerruf: true }) === null, "Widerrufsantwort mit „vorzeitig“ und „Zahlungen“ bleibt frei (nur „Kulanz“ zählt)");
  ok(WV.kopplungFinden("Bitte begleichen Sie Ihre offene Rate über 59,99 €, dann lasse ich Sie aus Kulanz gerne aus dem Vertrag.", { ohneKulanz: true }) !== null, "Rotprobe: die alte Fassung beim Altvertrag bleibt gesperrt");
  ok(WV.drohungFinden(antwort) === null, "keine Drohung im Satz");
  ok(!WV.wandPruefen(antwort, ["kuendigung_vormerken"]).some((t) => t.art === "verboten"), "Wortwand: nichts Verbotenes");
  const ersetzt = WV.kuendigungsSaetzeErsetzen(antwort, { bezug: true, kulanzErlaubt: false });
  ok(ersetzt.entfernt.length > 0 && !ersetzt.text.includes("Kulanz vorzeitig"), "Altvertrag: der Satz wird im Entwurf ersetzt");
  ok(WV.kuendigungsSaetzeErsetzen(antwort, { bezug: true, kulanzErlaubt: true }).entfernt.length === 0, "Jahresvertrag: nichts ersetzt");

  console.log("── 8 · Kündigungsbestätigung (Mail) ────────────────────────────────────────");
  const off = [{ rate_nr: 2, betrag_cents: 5999, faellig_am: "2026-10-20", zahlungsreferenz: "FIAON-E396-2" }];
  const b1 = KR.bestaetigungInhalt({ agb_stand: "2026-09-03", gekuendigt_am: "2026-10-19T09:00:00Z", offene_raten: off, ende_tag: "2027-09-18", kuendigung_art: "laufzeit", fristgerecht: true })!;
  ok(/Ihre Kündigung vom 19\.10\.2026 ist bei uns eingegangen und eingetragen/.test(b1.vertrag_satz) && /unabhängig von jeder Zahlung/.test(b1.vertrag_satz) && /endet deshalb zum 18\.09\.2027/.test(b1.vertrag_satz) && /Monatsraten laufen wie vereinbart weiter/.test(b1.vertrag_satz), `vertrag_satz: Zugang, unabhängig, Ende, Raten laufen — „${kurz(b1.vertrag_satz)}“`);
  ok(b1.offen_satz.includes(SATZ) && b1.offen_satz.includes(RECHTE) && /Rate 2 über 59,99 €, fällig am 20\.10\.2026/.test(b1.offen_satz), `offen_satz: der Satz, welche Rechnung, Rechte — „${kurz(b1.offen_satz)}“`);
  ok(/endet zum 18\.09\.2027 — oder vorzeitig aus Kulanz/.test(b1.preheader_text) && b1.verwendungszweck === "FIAON-E396-2", "Vorzeile + Verwendungszweck (Knopf zur Zahlungsseite)");
  ok(!/ab sofort stellen wir keine/i.test(`${b1.vertrag_satz} ${b1.offen_satz}`), "nie mehr „Ab sofort stellen wir keine weiteren Raten“ beim Laufzeit-Vertrag");
  ok(WV.kopplungFinden(`${b1.vertrag_satz} ${b1.offen_satz} ${b1.preheader_text}`) === null && TON.kuendigungAnZahlung(`${b1.vertrag_satz} ${b1.offen_satz}`) === null, "Bestätigung: keine Kopplung (E-393, Mara-Ton)");
  const b2 = KR.bestaetigungInhalt({ agb_stand: "2026-09-03", gekuendigt_am: "2026-10-19T09:00:00Z", offene_raten: off })!;
  ok(b2.offen_satz.includes(SATZ) && !/endet deshalb/.test(b2.vertrag_satz), "Jahresvertrag auf dem bisherigen Weg: derselbe Satz, ohne Enddatum");
  const b3 = KR.bestaetigungInhalt({ agb_stand: "2026-08-15", gekuendigt_am: "2026-10-19T09:00:00Z", offene_raten: [{ rate_nr: 2, betrag_cents: 5999, faellig_am: "2026-10-12", zahlungsreferenz: "FIAON-ALT-2" }], ende_tag: "2026-11-11" })!;
  ok(!/kulanz/i.test(`${b3.vertrag_satz} ${b3.offen_satz}`) && /Abrechnungsmonats/.test(b3.vertrag_satz), "Altvertrag unverändert (kein „Kulanz“, Abrechnungsmonat)");

  console.log("── 9 · Urkunde ─────────────────────────────────────────────────────────────");
  const urk = URK.rumpfBauen({
    first_name: "Test", last_name: "Person", ref: "FIAON-E396-U", payment_reference: "FIAON-E396", pack_name: "FIAON Pro",
    gekuendigt_am: "2026-10-19T09:00:00Z", kuendigung_quelle: "telefon", vertrag_ende_am: "2027-09-18T21:59:59Z", kuendigung_art: "laufzeit",
    altvertrag: false, offene_raten: off,
  }, { name: "FIAON LTD", rolle: "Geschäftsführung" }, new Date("2026-10-19T10:00:00Z")).html;
  ok(/zum Ende der Laufzeit \(18\.09\.2027\)/.test(urk) && /endet deshalb zum 18\.09\.2027/.test(urk), "Urkunde: Vertragsende zum Ende der Laufzeit");
  ok(urk.includes("entlassen wir Sie aus Kulanz vorzeitig aus dem Vertrag") && urk.includes(RECHTE) && /FIAON-E396-2/.test(urk), "Urkunde: Kulanz-Angebot, Rechte-Satz, Verwendungszweck");
  ok(/bis zum Vertragsende voll für Sie da/.test(urk) && !/Mit dieser Kündigung entfallen alle künftigen Raten/.test(urk), "Urkunde: Bereich bleibt offen, kein „alle künftigen Raten entfallen“");

  console.log("── 10 · Formular-Anträge: was die Automatik bucht ──────────────────────────");
  const auto = (o: any) => FOLGEN.automatischBuchbar({ identitaetOffen: false, zielBuchbar: true, grund: "Ich kündige.", agbStand: "2026-09-03", bezahlt: true, bestellungAm: "2026-09-01T10:00:00Z", antragAm: "2026-10-19T10:00:00Z", ...o });
  ok(auto({ annahmeBelegt: true }).ja && /Laufzeitende/.test(auto({ annahmeBelegt: true }).warum), "Jahresvertrag mit belegter Annahme → automatisch gebucht (zum Laufzeitende)");
  ok(!auto({}).ja && /ohne belegte Annahme/.test(auto({}).warum), "ohne belegte Annahme → Karte (wie bisher)");
  ok(!auto({ annahmeBelegt: true, grund: "Ich widerrufe den Vertrag" }).ja, "Widerruf im Text → Karte");
  ok(!auto({ annahmeBelegt: true, bestellungAm: "2026-10-10T10:00:00Z" }).ja, "binnen 14 Tagen → Karte (möglicher Widerruf)");
  ok(auto({ agbStand: "2026-08-15" }).ja, "Altvertrag → automatisch (unverändert)");

  console.log("── 11 · Rotprobe: die alte Fassung fällt auf ───────────────────────────────");
  ok(!fakten.includes("Ab der Kündigung werden keine weiteren Raten gestellt"), "Hauswissen trägt die alte Fassung nicht mehr");
  ok(!TON.KUENDIGUNG_REGEL_TEXT.includes("dann lasse ich Sie aus Kulanz gerne aus dem Vertrag“ (auf WhatsApp"), "WhatsApp-Regel trägt die alte Fassung nicht mehr");
  ok(TON.KUENDIGUNG_REGEL_TEXT.includes(JV.MARA_JAHRESVERTRAG_REGEL), "WhatsApp-Regel trägt Justins Regel vom 19.10.");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  if (schlecht) { console.log("Rot:"); for (const r of rot) console.log(`  · ${r}`); process.exitCode = 1; }
  process.exit(process.exitCode ?? 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
