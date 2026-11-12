// Prüfstand E-507 (12.11.2026): die Empfehlungs-Vereinbarung (Koop-Modell „empfehlung“, Empfehlungspartner von FIAON Global).
// Zwei Teile wie pruef-koop-modelle.ts:
//   A  REIN (immer, ohne Datenbank): Die fünf bestehenden Bereiche bleiben Zeichen für Zeichen gleich (feste Prüfsummen von
//      Vertrag, Vertrag mit Annahmevermerk, Seite, Übersicht, Annahme-Texten, Titel); das neue Modell hat seine eigene Fassung,
//      seinen eigenen Knopf ohne Zahlungspflicht, keine Lieferung — und kein Wort aus der Liefer-Welt im Vertrag.
//        env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus BREVO_API_KEY=pruef node_modules/.bin/tsx scripts/pruef-koop-empfehlung.ts
//   B  NUR lokal (PG 127.0.0.1), alle Abrufe nach außen abgefangen: anlegen → annehmen ohne Menge → Satz im Schalter →
//      Partnerseite nur mit Empfehlungen → Empfehlung eintragen → nie Liefer-Partner (Akte, Kontakt, Zeiten, Menge) →
//      Partner-Mail mit eigenem Text → Karte fürs Kundenportal.
//        env -i HOME=$HOME PATH=$PATH BREVO_API_KEY=pruef SESSION_SECRET=pruef \
//          DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<lokale Kopie>' node_modules/.bin/tsx scripts/pruef-koop-empfehlung.ts
import { createHash } from "node:crypto";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }
const TEIL_B = /127\.0\.0\.1|localhost/.test(String(process.env.DATABASE_URL ?? ""));
if (!TEIL_B) {
  if (process.env.DATABASE_URL) console.error("Teil B nur gegen den lokalen Prüfstand — es läuft nur Teil A.");
  // db-pool verlangt beim Laden eine Adresse — Teil A verbindet nie.
  process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
}

// Nichts verlässt die Maschine: Brevo wird mitgeschrieben, jeder andere Abruf nach außen bekommt eine leere Antwort.
const mails: { an: string; von: string; betreff: string; text: string }[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.includes("api.brevo.com")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    mails.push({ an: b.to?.[0]?.email, von: String(b.sender?.email ?? ""), betreff: b.subject, text: String(b.textContent ?? "") });
    return new Response(JSON.stringify({ messageId: `<pruef-${mails.length}@brevo>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)) return echtFetch(url, init);
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;

const sha = (x: string) => createHash("sha256").update(x).digest("hex").slice(0, 16);
/** Prüfsummen der bestehenden Bereiche — gerechnet mit dem Stand VOR E-507 (Vertrag · mit Vermerk · Seite · Übersicht · Annahme · Titel). */
const ALT: Record<string, string> = {
  vorsorge: "91c59496e5660547:d0cbe483aa666227:9a8dcdead25ee683:f7732ca43b436531:2c6fdd33f683e2d0:c5d6020d93555ecb",
  recht: "498c4e39a9a65234:e399d5b3b413a4ea:0ea40bcffc1b365b:d47276e440eebb5b:e5488ef1923ed97f:e809e703826d53c6",
  steuern: "6799762b86f74009:c754a4c3f5c9e158:6a882dbe0de2b1a4:8dbfc0c49cf20e31:3b13eb51f1b0b0d5:06b466eacf2d6b7b",
  energie: "63b465b169b0df08:075a1a3ce724961b:526e009b805edec8:03fd5be11b53bb29:6924cd530f9441f1:0e876414e1051d20",
  telekom: "82ebfb0fff69a202:e1ff062ea08b833a:9b45ae9b0c947398:cf0d0017cf718c88:916d7640dd559a79:098e579335115497",
};
const ohneTags = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

async function main() {
  const { sqlPool } = await import("../server/lib/db-pool");
  const S = await import("../shared/fiaon-global-angebot-koop");
  const M = await import("../shared/fiaon-global-angebot-koop-modelle");
  const P = await import("../shared/fiaon-koop-partnerschaft");
  const EP = await import("../shared/fiaon-koop-empfehlung");

  console.log("Teil A — reine Regeln");
  console.log("Die bestehenden Bereiche bleiben Zeichen für Zeichen gleich");
  {
    const partner = { art: "unternehmer", anrede: "Frau", vorname: "Petra", nachname: "Muster", firma: "Muster Beratung", strasse: "Musterweg 1", plz: "10115", ort: "Berlin", land: "DE", email: "p@pruefstand.test", telefon: "" } as any;
    const vermerk = { am: new Date("2026-11-12T10:00:00Z"), ip: "203.0.113.9", userAgent: "x", hash: "h", wahl: { wunschWoche: 10 }, unterschrift: { art: "getippt", name: "Petra Muster" } } as any;
    for (const bereich of Object.keys(ALT)) {
      const parameter = S.koopParameterAus({ bereich, ...(bereich === "recht" || bereich === "steuern" ? { region: "Berlin" } : {}) } as any);
      const d = { ref: "FIAON-IA-KPRUEF1", fassung: S.koopFassungFuer(bereich), partner, parameter, gueltigBis: "2026-12-31" } as any;
      const jetzt = [sha(S.koopRumpfHtml(d, null)), sha(S.koopRumpfHtml(d, vermerk)), sha(JSON.stringify(S.koopSeite(d))), sha(JSON.stringify(S.koopBestellUebersicht(d))), sha(JSON.stringify(S.koopAnnahmeTexte(d))), sha(S.koopVertragTitel(d) + S.koopVertragUnterzeile(d))].join(":");
      ok(jetzt === ALT[bereich], `${bereich}: Vertrag, Vermerk, Seite, Übersicht, Annahme-Texte und Titel unverändert`);
      ok(S.koopLiefertKontakte(bereich) && S.koopKnopfText(d) === S.KOOP_KNOPF, `${bereich}: weiter Liefer-Partner mit dem alten Knopf`);
    }
    ok(S.koopParameterAus({}).bereich === "vorsorge" && S.koopFassungFuer(undefined) === "IA-KOOP-2026-10-16-A", "ohne Bereich bleibt es Vorsorge, Fassung A");
  }

  console.log("\nDas Modell „empfehlung“");
  const partner = { art: "unternehmer", anrede: "Herr", vorname: "Max", nachname: "Muster", firma: "", strasse: "Musterweg 1", plz: "10115", ort: "Berlin", land: "DE", email: "m@pruefstand.test", telefon: "" } as any;
  const par = S.koopParameterAus({ bereich: "empfehlung" } as any);
  const d = { ref: "FIAON-IA-KPRUEF9", fassung: S.koopFassungFuer("empfehlung"), partner, parameter: par, gueltigBis: "2026-12-31" } as any;
  ok(S.koopModellVon("empfehlung") === "empfehlung" && d.fassung === "IA-KOOP-EMPFEHLUNG-2026-11-12" && (S.KOOP_FASSUNGEN as readonly string[]).includes(d.fassung) && S.istKoopFassung(d.fassung), "eigene Fassung IA-KOOP-EMPFEHLUNG-2026-11-12, Teil der Koop-Familie");
  ok(!S.koopLiefertKontakte("empfehlung"), "kein Liefer-Partner (koopLiefertKontakte = false)");
  ok(par.provisionProzent === 30 && par.kuendigungTage === 30 && par.preisCents === 0 && S.koopParameterFehler(par) === null && S.koopPflichtFehlen(d).length === 0, "Vorgaben: 30 %, dreißig Tage Kündigung, kein Preis — vollständig");
  ok(S.koopParameterAus({ bereich: "empfehlung", provisionProzent: 27.5 } as any).provisionProzent === 27.5 && S.koopParameterAus({ bereich: "empfehlung", provisionProzent: 80 } as any).provisionProzent === 30 && S.koopParameterAus({ bereich: "empfehlung", provisionProzent: 0 } as any).provisionProzent === 30, "Satz mit Nachkommastelle geht; 0 und über 50 fallen auf die Vorgabe");
  ok(S.koopParameterFehler({ ...par, provisionProzent: 0 }) !== null, "ohne Satz: Parameter-Fehler");
  const rumpf = S.koopRumpfHtml(d, null); const text = ohneTags(rumpf);
  const ziffern = S.koopZiffern(d);
  ok(ziffern.length === 7 && ziffern[2].titel === "Provision" && S.koopVertragTitel(d) === "FIAON — Empfehlungs-Vereinbarung", "sieben Ziffern, Ziffer 3 „Provision“, Titel „Empfehlungs-Vereinbarung“");
  ok(/Der Partner erhält 30 % aller Zahlungen, die bei FIAON vom empfohlenen Kunden in den ersten zwölf Monaten nach der Meldung eingehen/.test(text), "Ziffer 3: 30 % auf zwölf Monate ab der Meldung");
  ok(/Durchlaufende Fremdkosten/.test(text) && /Gutschriftverfahren/.test(text) && /binnen vierzehn Tagen/.test(text) && /entfällt die Provision daran/.test(text), "Fremdkosten zählen nicht, Gutschrift, vierzehn Tage, Erstattung");
  ok(/nennt nur den Kontakt/.test(text) && /vermittelt keine Kredite oder Finanzierungen/.test(text) && /macht keine Zusagen/.test(text), "der Partner nennt nur den Kontakt — keine Beratung, keine Vermittlung, keine Zusagen");
  ok(/nur, wenn der empfohlene Kunde damit einverstanden ist/.test(text) && /§ 14 BGB/.test(text) && /Frist von dreißig Tagen/.test(text), "Einverständnis der Person, Unternehmer, dreißig Tage Kündigung");
  const LIEFER = /Start-Rahmen|Wunschmenge|qualifiziert|Reklamation|Monatsrechnung|Reverse|Termin|je Woche|zahlungspflichtig|FIAON übermittelt/;
  ok(!LIEFER.test(text), `kein Wort aus der Liefer-Welt im Vertrag${LIEFER.test(text) ? ` — gefunden: ${text.match(LIEFER)?.[0]}` : ""}`);
  // „bis zu“ als eigenes Wortpaar (Spitzenwert-Versprechen) — „bis zum Ende“ ist etwas anderes.
  const VERBOTEN = /Affiliate|\bbis zu\b|garantier|Garantie/i;
  const seite = S.koopSeite(d); const A = S.koopAnnahmeTexte(d); const U = S.koopBestellUebersicht(d);
  const allesSeite = JSON.stringify({ seite, A, U });
  ok(!VERBOTEN.test(text) && !VERBOTEN.test(allesSeite), `Wortprobe: kein „Affiliate“, kein „bis zu“, keine Garantie${VERBOTEN.test(text + allesSeite) ? ` — gefunden: ${(text + allesSeite).match(VERBOTEN)?.[0]}` : ""}`);
  ok(/Annahme mit dem Knopf „Partnerschaft vereinbaren“\./.test(text) && S.koopKnopfText(d) === "Partnerschaft vereinbaren" && A.knopf === "Partnerschaft vereinbaren", "eigener Knopf „Partnerschaft vereinbaren“ — im Vertrag und auf der Seite");
  const mitVermerk = ohneTags(S.koopRumpfHtml(d, { am: new Date("2026-11-14T10:00:00Z"), ip: "203.0.113.9", userAgent: "x", hash: "abc", wahl: { wunschWoche: 0 }, unterschrift: { art: "getippt", name: "Max Muster" } } as any));
  ok(/mit dem Knopf „Partnerschaft vereinbaren“/.test(mitVermerk) && /Provision \(Ziffer 3\): 30 %/.test(mitVermerk) && !/Kontakte je Woche/.test(mitVermerk), "Annahmevermerk nennt die Provision, keine Menge");
  ok(seite.hero.preis === "30 %" && seite.rechner.jeStueckCents === 240_000 && seite.rechner.stufen.join(",") === "1,2,4,6,10" && /Rechenbeispiel/.test(seite.rechner.fein), "Seite: 30 % groß, Rechenbeispiel 2.400 € je Kunde (30 % von 8.000 €)");
  ok(S.koopParameterAus({ bereich: "empfehlung", provisionProzent: 25, beispielCents: 1_000_000 } as any) && S.koopSeite({ ...d, parameter: S.koopParameterAus({ bereich: "empfehlung", provisionProzent: 25, beispielCents: 1_000_000 } as any) }).rechner.jeStueckCents === 250_000, "anderer Satz und anderes Beispiel rechnen mit (25 % von 10.000 € = 2.500 €)");
  ok(seite.ablauf.liste.length === 5 && seite.fragen.liste.length === 6 && seite.kontakt.themen.length === 3 && seite.vertrag.titel === "Ihre Vereinbarung", "Seite: fünf Schritte, sechs Fragen, wen man empfehlen kann");
  ok(U.titel === "Ihre Partnerschaft im Überblick" && U.zeilen.some((z) => z.label === "Kosten für Sie" && /keine/.test(z.wert)) && A.titel === "Partnerschaft vereinbaren" && /Vereinbarung gelesen/.test(A.gelesen) && !/zahlungspflichtig|Kontakt/.test(A.unterKnopf), "Übersicht und Annahme: keine Kosten, eigene Häkchen-Texte");
  ok(S.koopHashEingabe(d, rumpf).startsWith("global-angebot-koop|FIAON-IA-KPRUEF9|IA-KOOP-EMPFEHLUNG-2026-11-12|"), "Prüfsumme trägt Angebot und Fassung");
  ok(M.koopModellSeite(d).annahme.schritt?.knopf === "Zur Partnerseite" && /Partnerseite/.test(M.koopModellSeite(d).annahme.fertigTitel ?? ""), "nach der Annahme: Schritt „Zur Partnerseite“");
  for (const s of ["de", "en"] as const) {
    const w = P.KOOP_PARTNERSCHAFT_PORTAL[s];
    ok(w.aktivTitel(0) && w.aktivTitel(1) !== w.aktivTitel(3) && w.aktivText("30 %").includes("30 %") && w.offenText("30 %").includes(String(EP.KOOP_PROVISION_MONATE)) && !VERBOTEN.test(JSON.stringify([w.aktivText("30 %"), w.offenText("30 %"), w.auge, w.offenTitel])), `Portal-Karte (${s}): Worte da, mit Satz und Monaten`);
  }
  ok(P.koopProzentText(27.5) === "27,5 %" && P.koopProzentText(30) === "30 %", "Prozent-Text mit Komma");

  if (!TEIL_B) {
    console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (Teil A, rein — Teil B nur gegen den lokalen Prüfstand)`);
    process.exit(schlecht ? 1 : 0);
  }

  console.log("\nTeil B — gegen den lokalen Prüfstand");
  const A0 = await import("../server/lib/fiaon-global-angebot");
  const K = await import("../server/lib/fiaon-global-angebot-koop");
  const L = await import("../server/lib/fiaon-koop-lieferung");
  const E = await import("../server/lib/fiaon-koop-empfehlung");
  await A0.ensureAngebotTabellen(); await L.ensureKoopTabellen(); await E.ensureEmpfehlungTabelle();
  const st = Date.now().toString(36);
  const mail = `empf.${st}@pruefstand.test`;
  const kontext = { ip: "84.150.10.20", userAgent: "Mozilla/5.0 (Macintosh) Safari/605.1.15", leitung: false };
  const an = await K.koopAnlegen({ gueltigBis: "2099-12-31", partner: { anrede: "Herr", vorname: "Max", nachname: "Muster", firma: "", strasse: "Partnerstraße 9", plz: "10117", ort: "Berlin", land: "DE", email: mail }, parameter: { bereich: "empfehlung" } }, "Prüfstand");
  ok(an.ok, `Empfehlungs-Vereinbarung angelegt${an.ok ? "" : ` — ${(an as any).error}`}`);
  if (!an.ok) throw new Error("Anlegen gescheitert");
  let z = (await A0.angebotLesen({ id: an.id }))!;
  ok(String(z.fassung) === "IA-KOOP-EMPFEHLUNG-2026-11-12" && /^FIAON-IA-K[A-Z0-9]{6}$/.test(String(z.angebot_ref)), "Zeile trägt die Fassung und eine Koop-Kennung");
  const falsch = await K.koopAnlegen({ fassung: "IA-KOOP-2026-10-16-A", partner: { anrede: "Herr", vorname: "Max", nachname: "Muster", strasse: "X 1", plz: "10117", ort: "Berlin", land: "DE", email: `falsch.${st}@pruefstand.test` }, parameter: { bereich: "empfehlung" } }, "Prüfstand");
  ok(!falsch.ok, "Fassung und Bereich müssen zusammenpassen");

  // Portal-Karte: offen → Link zur Vereinbarung
  const offen = await L.koopPartnerschaftFuerPortal({ personId: null, email: mail.toUpperCase() });
  ok(offen?.stand === "offen" && offen.link.startsWith("/business/angebot/") && offen.prozent === 30, "Portal-Karte (offen): Link zur Vereinbarung, 30 %");
  ok((await L.koopPartnerschaftFuerPortal({ personId: null, email: `niemand.${st}@pruefstand.test` })) === null && (await L.koopPartnerschaftFuerPortal({ personId: null, email: null })) === null, "Portal-Karte: ohne Vereinbarung keine Karte");

  const sicht = await K.koopKundenSicht("tok", z);
  ok((sicht.body as any).modell === "empfehlung" && (sicht.body as any).annahmeBereit === true && (sicht.body as any).annahme.knopf === "Partnerschaft vereinbaren", "Kundensicht: Modell empfehlung, annahmebereit, eigener Knopf");
  const dz = K.koopDatenAus(z);
  let r = await K.koopAnnehmen(z, { textHash: K.koopTextHash(dz), gelesen: true, unterschrift: { art: "getippt", name: "Max Muster" } }, kontext, { zuViel: () => false });
  ok(r.status === 400 && (r.body as any).code === "HAEKCHEN", "ohne Unternehmer-Haken: keine Annahme");
  r = await K.koopAnnehmen(z, { textHash: "falsch", gelesen: true, unternehmer: true, unterschrift: { art: "getippt", name: "Max Muster" } }, kontext, { zuViel: () => false });
  ok(r.status === 409 && (r.body as any).code === "GEAENDERT", "falsche Prüfsumme: keine Annahme");
  r = await K.koopAnnehmen(z, { textHash: K.koopTextHash(dz), gelesen: true, unternehmer: true, unterschrift: { art: "getippt", name: "Max Muster" } }, kontext, { zuViel: () => false });
  ok(r.status === 200 && (r.body as any).ok === true, `Annahme OHNE Menge geht${r.status === 200 ? "" : ` — ${JSON.stringify(r.body).slice(0, 200)}`}`);
  ok(String((r.body as any).meinAuftrag ?? "").startsWith("/partner/") && (r.body as any).schrittKnopf === "Zur Partnerseite" && /Partnerseite/.test(String((r.body as any).fertigTitel)) && (r.body as any).betragCents === 0, "Fertig-Ansicht: Knopf „Zur Partnerseite“, nichts zu zahlen");
  z = (await A0.angebotLesen({ id: an.id }))!;
  const schalter = L.koopSchalterAus(z);
  ok(String(z.status) === "angenommen" && EP.koopProvisionAus(schalter)?.prozent === 30 && /^\d{4}-\d{2}-\d{2}$/.test(String(schalter.provision?.seit)) && schalter.wunschWoche === undefined && schalter.unternehmer === true, "angenommen: Satz 30 % ab heute im Schalter, keine Menge");
  const [pdf] = (await sqlPool`SELECT length(vertrag_pdf) AS n, text_hash FROM fiaon_global_angebote WHERE id = ${an.id}`) as any[];
  ok(Number(pdf.n) > 5000 && String(pdf.text_hash) === K.koopTextHash(dz), "Vereinbarung als PDF mit Annahmevermerk gespeichert, Prüfsumme passt");
  await K.koopNacharbeit(an.id);
  const [todo] = (await sqlPool`SELECT titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${z.angebot_ref}:koop-justin`} LIMIT 1`.catch(() => [])) as any[];
  ok(todo && /Empfehlungs-Partnerschaft angenommen/.test(String(todo.titel)) && /KEINE LIEFERUNG/.test(String(todo.text)), "Aufgabe an Justin: Empfehlungs-Partnerschaft, keine Lieferung");
  const eintrag = K.koopListenEintrag(z, { heute: "2026-11-12", aufrufe: null }) as any;
  ok(/Empfehlungspartner · 30 % Provision/.test(eintrag.koop.zeile) && eintrag.koop.wunschWoche === null, "Liste der Leitung: Zeile „Empfehlungspartner · 30 % Provision“");

  console.log("\nPartnerseite");
  const token = L.koopPartnerToken(String(z.angebot_ref));
  const zt = await L.koopAngebotAusToken(token);
  ok(zt && Number(zt.id) === an.id, "der Partner-Link öffnet diese Vereinbarung");
  let ps = await L.koopPartnerSicht(z) as any;
  ok(ps.ok && ps.modell === "empfehlung" && ps.kontakte.length === 0 && ps.rechnungen.length === 0 && ps.stand.zeiten === null && ps.empfehlungen?.prozent === 30 && ps.empfehlungen.liste.length === 0, "Sicht: nur Empfehlungen (30 %), keine Kontakte, keine Rechnungen, keine Zeiten");
  const e1 = await E.koopEmpfehlungEintragen(z, { name: `Erika Beispiel ${st}`, telefon: "+49 170 0000009", notiz: "Möchte eine US-Gesellschaft aufbauen.", personId: 1 }, "Max Muster (Partnerbereich)", "partner", "Max Muster");
  ok(!e1.ok, "Empfehlung ohne Einverständnis der Person: abgelehnt");
  const e2 = await E.koopEmpfehlungEintragen(z, { name: `Erika Beispiel ${st}`, telefon: "+49 170 0000009", notiz: "Möchte eine US-Gesellschaft aufbauen.", einverstanden: true, personId: 1 }, "Max Muster (Partnerbereich)", "partner", "Max Muster");
  ok(e2.ok, `Empfehlung mit Einverständnis eingetragen${e2.ok ? "" : ` — ${(e2 as any).error}`}`);
  ps = await L.koopPartnerSicht(z) as any;
  const zeile = ps.empfehlungen?.liste?.[0] ?? {};
  ok(ps.empfehlungen?.liste.length === 1 && zeile.stand === "gemeldet" && !("telefon" in zeile) && !("notiz" in zeile) && !("email" in zeile) && !("personId" in zeile), "Liste: eine Empfehlung „gemeldet“ — ohne Telefon, Notiz, E-Mail und Personennummer");
  const [roh] = (await sqlPool`SELECT person_id, quelle FROM fiaon_koop_empfehlungen WHERE angebot_id = ${an.id} ORDER BY id DESC LIMIT 1`) as any[];
  ok(roh.person_id === null && roh.quelle === "partner", "der Partner setzt nie eine Personen-Nummer");

  console.log("\nNie Liefer-Partner");
  const k1 = await L.koopKontaktAnlegen(1, { angebotId: an.id, thema: "x", termin: new Date(Date.now() + 5 * 864e5).toISOString(), art: "telefon", einwilligung: true, notiz: "" } as any, { name: "Prüfer", agentId: null });
  ok(!k1.ok && (k1 as any).status === 409, "Kontakt übermitteln: abgelehnt (409)");
  const zs = await L.koopZeitenSetzen(z, { tage: [1, 2], von: "09:00", bis: "17:00", dauerMin: 60, arten: ["telefon"] }, "Prüfstand");
  const ws = await L.koopWunschSetzen(z, 10, "Prüfstand");
  ok(!zs.ok && !ws.ok, "Zeiten und Menge: gibt es hier nicht");
  const [irgendwer] = (await sqlPool`SELECT id FROM fiaon_persons ORDER BY id DESC LIMIT 1`) as any[];
  if (irgendwer) {
    const lage = await L.koopAkteLage(Number(irgendwer.id)) as any;
    ok(lage.ok && !(lage.partner as any[]).some((p) => Number(p.angebotId) === an.id), "Akte „Partner-Termin“: der Empfehlungspartner steht nicht in der Liste");
  }
  ok(!(await L.koopVorsorgePartner()).some((x) => Number(x.id) === an.id), "kein Vorsorge-Partner");
  const liste = await L.koopListenLieferung(z);
  ok(liste && /Empfehlungspartner — keine Lieferung · 1 Empfehlung$/.test(liste.zeile) && liste.partnerLink.includes("/partner/"), "Zeile „Lieferung“ im Chefbüro: keine Lieferung, 1 Empfehlung, Link zur Partnerseite");
  const [rechnungen] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_koop_rechnungen WHERE angebot_id = ${an.id}`) as any[];
  ok(Number(rechnungen.n) === 0, "keine Rechnung an den Partner");

  console.log("\nPartner-Mail und Portal-Karte");
  const vorher = mails.length;
  const m1 = await L.koopPartnerMailSenden(z);
  const pm = mails.slice(vorher).find((m) => m.an === mail);
  ok(m1 && pm && /Partnerseite/.test(pm.betreff) && /Empfehlungspartner von FIAON Global/.test(pm.text) && /\/partner\//.test(pm.text) && !/Zeiten|Termine|Monatsrechnung|Wunschmenge/.test(pm.text), "Mail: Partnerseite mit Link — ohne Zeiten, Termine, Rechnungen");
  ok(pm && /welcome@/.test(pm.von), `Absender welcome@${pm ? ` (${pm.von})` : ""}`);
  ok(!(await L.koopPartnerMailSenden((await A0.angebotLesen({ id: an.id }))!)), "die Mail geht genau einmal hinaus");
  const aktiv = await L.koopPartnerschaftFuerPortal({ personId: null, email: mail });
  ok(aktiv?.stand === "aktiv" && aktiv.link.startsWith("/partner/") && aktiv.prozent === 30 && aktiv.empfehlungen === 1, "Portal-Karte (aktiv): Link zur Partnerseite, 30 %, 1 Empfehlung");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden`);
  await sqlPool.end();
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
