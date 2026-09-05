// ═══════════════════════════════════════════════════════════════════════════
// DAS DEMO-KONTO — der Kundenbereich, wie er im besten Fall aussieht (23.08.2026)
//
// Justin: „Wir müssen ein 1:1-Demo-Konto anlegen, das das perfekte Kundenkonto
// zeigt … alles mit Platzhaltern … auf der Investorenseite mit einem Button."
//
// Dieser Router antwortet für GENAU EINE Referenz (FIAON-DEMO) mit festen,
// erfundenen Daten — ohne Cookie, ohne Datenbank, ohne Schreibzugriff. Er
// liegt VOR den echten Kundenrouten, damit `requireKunde` ihn nie sieht. Die
// Seite /demo/kundenbereich ist der echte Kundenbereich (mein-bereich.tsx) mit
// dieser Referenz: dieselbe Oberfläche, nur die Daten kommen von hier.
//
// Alles, was schreiben würde (Ticket, Passwort, Lastschrift, Abo), antwortet
// freundlich mit „nur zur Ansicht". Max Mustermann ist kein Kunde.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { paket as paketVon } from "@shared/fiaon-pakete";

export const DEMO_REF = "FIAON-DEMO";
const router = Router();

const tag = (d: Date): string => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const vorTagen = (n: number): Date => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 30, 0, 0); return d; };
const monatePlus = (start: Date, n: number): Date => { const d = new Date(start); d.setMonth(d.getMonth() + n); return d; };

function demoBereich() {
  const pk = paketVon("pro");
  const paketName = pk?.label || "FIAON Pro";
  const monatlichCents = pk?.preisCents ?? 5999;
  const rahmen = 5000;

  const kundeSeit = vorTagen(124);
  const start = vorTagen(119);
  const erste = vorTagen(121);
  const raten = Array.from({ length: 12 }, (_, i) => {
    const f = monatePlus(erste, i);
    const bezahlt = i < 4;
    return {
      nr: i + 1, betragCents: monatlichCents, faelligAm: tag(f), faelligIso: iso(f),
      status: bezahlt ? "bezahlt" : "offen", bezahltAm: bezahlt ? tag(f) : null,
      referenz: `FIAON-DEMO-R${String(i + 1).padStart(2, "0")}`,
    };
  });
  const naechste = raten.find((r) => r.status !== "bezahlt")!;

  const etappen = [
    { key: "start", titel: "Startgespräch", text: "Geführt mit Lena Winter. Ihr Konto ist seitdem vollständig freigeschaltet.", stand: "fertig", datum: tag(start), stempel: "erledigt" },
    { key: "unterlagen", titel: "Unterlagen vollständig", text: "Kontoauszug und Ausweis liegen vor und sind geprüft.", stand: "fertig", datum: tag(vorTagen(118)), stempel: "geprüft", href: "#unterlagen" },
    { key: "auskunft", titel: "Bonitätsauskunft", text: "Ihre Auskunft ist eingegangen.", stand: "fertig", datum: tag(vorTagen(112)), stempel: "liegt vor", href: "#bonitaet" },
    { key: "analyse", titel: "Analyse durch FIAON", text: "Jeder Eintrag geprüft und in Menschensprache erklärt.", stand: "fertig", datum: tag(vorTagen(110)), stempel: "fertig" },
    { key: "schreiben", titel: "Schreiben versenden", text: "Zwei Löschanträge sind versendet, einer bereits erfolgreich. Der dritte Eintrag wartet auf die Antwort der Gegenseite – Frist läuft bis Ende des Monats.", stand: "jetzt", datum: null, stempel: "2 von 3 erledigt", href: "#schreiben" },
    { key: "girokonto", titel: "Girokonto bei der DKB", text: "Kostenlos, unabhängig von Ihrer Bonität. Spart im Jahr rund 60 € Kontoführung.", stand: "kommt", datum: null, stempel: "heute möglich", href: "#vorteile" },
    { key: "karte", titel: `Kreditkarte bis ${rahmen.toLocaleString("de-DE")} €`, text: "Das Ziel. Realistisch, sobald Ihr Wert die Schwelle des Kartenpartners erreicht – nach dem letzten offenen Eintrag ist es so weit.", stand: "kommt", datum: null, stempel: "nächster Schritt" },
  ];
  const jetzt = etappen.find((e) => e.stand === "jetzt")!;

  return {
    ok: true,
    demo: true,
    kunde: {
      ref: DEMO_REF, vorname: "Max", nachname: "Mustermann", email: "max.mustermann@beispiel.de",
      telefon: "+49 170 1234567", strasse: "Musterstraße 12", plz: "10115", ort: "Berlin", land: "DE",
      geburtsdatum: "1988-05-14", kundeSeit: tag(kundeSeit), profilRueckfrage: false, profilHinweis: null,
    },
    paket: {
      key: pk?.key || "pro", name: paketName, abo: true, rahmen, wunschlimit: rahmen, monatlichCents,
      zahlungsstatus: "paid", zahlungsreferenz: "FIAON-DEMO-R01", faelligAm: tag(erste),
    },
    stufe: { stufe: "voll_aktiv", text: "Ihr Konto ist vollständig aktiv.", grund: null, naechsterSchritt: null, vollAktiv: true, pflicht: false, bezahlt: true },
    bonitaet: {
      stufe: "geprueft", fuerKunden: "Ihre Auskunft liegt vor und ist ausgewertet: drei Einträge, zwei davon angreifbar – beide sind bereits angegangen.",
      naechsterSchritt: "Warten auf die Antwort zum dritten Eintrag. Wir melden uns, sobald sie da ist.",
      bezahlt: true, hatDokument: true, geprueft: true, darfKaufen: false, darfHochladen: false, bestellRef: "FIAON-SCHUFA-DEMO",
      zahlungsreferenz: "FIAON-SCHUFA-DEMO", zahlungsstatus: "paid", preisEuro: 74,
    },
    unterlagen: { kontoauszug: true, ausweis: true, auskunft: true, erneutKontoauszug: false, erneutAusweis: false, kycStatus: "verified", kontoStatus: "active" },
    abo: {
      verlaengerung: { gefragt: false, entschieden: false, verlaengert: false, beendet: false, bezahlteRaten: 4 },
      naechste: { nr: naechste.nr, betragCents: naechste.betragCents, faelligAm: naechste.faelligAm, status: naechste.status, referenz: naechste.referenz },
      offen: 8, bezahlt: 4, raten,
    },
    termin: { beginn: start.toISOString(), status: "erledigt", agent: "Lena Winter" },
    fahrplan: etappen,
    naechsterSchritt: { key: jetzt.key, titel: jetzt.titel, text: jetzt.text, href: jetzt.href || null },
    ansprechpartner: { name: "Lena Winter", rolle: "Onboarding" },
    lastschrift: { mandat: "MD-DEMO-0001", status: "active", aktiv: true },
    kontoVerbunden: false,
    finanzen: {
      id: 1, ref: DEMO_REF, status: "fertig", fehler: null,
      zeitraumVon: iso(vorTagen(210)), zeitraumBis: iso(vorTagen(120)),
      einnahmenCents: 3 * 284000, ausgabenCents: 3 * 231500, gehaltCents: 284000, saldoEndeCents: 187420,
      dispoGenutzt: false, dispoTiefstCents: null, ruecklastschriften: 0,
      fixkosten: [
        { name: "Miete", betrag_cents: 98000, rhythmus: "monatlich", kategorie: "Wohnen" },
        { name: "Strom & Gas", betrag_cents: 11500, rhythmus: "monatlich", kategorie: "Wohnen" },
        { name: "Mobilfunk & Internet", betrag_cents: 5490, rhythmus: "monatlich", kategorie: "Kommunikation" },
        { name: "Kfz-Versicherung", betrag_cents: 6200, rhythmus: "monatlich", kategorie: "Versicherung" },
        { name: "Haftpflicht", betrag_cents: 590, rhythmus: "monatlich", kategorie: "Versicherung" },
        { name: "Streaming", betrag_cents: 1799, rhythmus: "monatlich", kategorie: "Freizeit" },
      ],
      kategorien: [
        { name: "Wohnen", betrag_cents: 109500, anteil: 0.47 },
        { name: "Lebensmittel", betrag_cents: 42000, anteil: 0.18 },
        { name: "Mobilität", betrag_cents: 24500, anteil: 0.11 },
        { name: "Versicherung", betrag_cents: 6790, anteil: 0.03 },
        { name: "Freizeit", betrag_cents: 18200, anteil: 0.08 },
        { name: "Sonstiges", betrag_cents: 30510, anteil: 0.13 },
      ],
      warnungen: [],
      merksaetze: [
        "Ihr Gehalt geht regelmäßig am Monatsende ein – ein stabiles Bild für jede Bank.",
        "Rund 525 € bleiben im Monat übrig. Das trägt eine Kreditkarte mit kleinem Rahmen gut.",
        "Keine Rücklastschriften, kein Dispo – in den letzten drei Monaten nichts, was auffällt.",
      ],
      erstelltAm: vorTagen(117).toISOString(),
    },
  };
}

const nurAnsicht = (res: Response) => res.status(200).json({ ok: false, demo: true, error: "Im Demo-Konto ist alles nur zur Ansicht. Im echten Konto läuft dieser Schritt sofort durch." });

router.get(`/kunde/${DEMO_REF}/bereich`, (_req: Request, res: Response) => { res.json(demoBereich()); });
// 05.09.2026 (Berater-Sitzung, /app/demo): Der Kundenbereich fragt auch die
// Termine ab — ohne diese Route antwortete der echte Weg mit 401. Dieselbe
// Form wie GET /kunde/:ref/termine, aus den festen Demo-Daten gebaut.
router.get(`/kunde/${DEMO_REF}/termine`, async (_req: Request, res: Response) => {
  const b = demoBereich();
  const { berlinDatumText, berlinUhrzeit } = await import("../lib/fiaon-termine");
  const beginn = new Date(b.termin.beginn);
  res.json({
    ok: true, demo: true,
    kommende: [],
    vergangene: [{
      beginn: b.termin.beginn, datumText: berlinDatumText(beginn), uhrzeit: berlinUhrzeit(beginn),
      art: "Startgespräch", status: b.termin.status, mit: b.termin.agent, absageLink: null,
    }],
    buchungsLink: null,
  });
});
router.get(`/kunde/${DEMO_REF}/tickets`, (_req: Request, res: Response) => {
  res.json({ ok: true, demo: true, tickets: [
    { id: 2, betreff: "Frage zur Frist des dritten Eintrags", text: "Bis wann muss die Gegenseite antworten?", status: "beantwortet",
      antwort: "Die Frist endet am Monatsende. Kommt keine Antwort, gilt der Eintrag als nicht belegt – wir setzen dann den nächsten Schritt auf.",
      beantwortet_am: vorTagen(6).toISOString(), created_at: vorTagen(7).toISOString() },
    { id: 1, betreff: "Kontoauszug nachreichen", text: "Ich habe den aktuellen Auszug hochgeladen – ist er angekommen?", status: "beantwortet",
      antwort: "Ja, vielen Dank. Er ist geprüft und die Auswertung liegt unter „Meine Finanzen“.",
      beantwortet_am: vorTagen(115).toISOString(), created_at: vorTagen(116).toISOString() },
  ] });
});
router.get(`/kunde/${DEMO_REF}/startgespraech`, (_req: Request, res: Response) => { res.json({ ok: true, demo: true, token: null, error: "Im Demo-Konto ist das Startgespräch bereits geführt." }); });
router.post(`/kunde/${DEMO_REF}/tickets`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/passwort`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/lastschrift/start`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/abo/verlaengerung`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/startgespraech/spaeter`, (_req: Request, res: Response) => nurAnsicht(res));
router.patch(`/profile/${DEMO_REF}`, (_req: Request, res: Response) => nurAnsicht(res));

export default router;
