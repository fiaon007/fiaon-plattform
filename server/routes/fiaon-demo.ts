// ═══════════════════════════════════════════════════════════════════════════
// DAS DEMO-KONTO — der Kundenbereich in jeder Stufe seines Weges
//
// Justin (23.08.2026): „Wir müssen ein 1:1-Demo-Konto anlegen, das das perfekte
// Kundenkonto zeigt … alles mit Platzhaltern … auf der Investorenseite mit
// einem Button."
//
// Justin (10.09.2026): „Setze es mir so zurück, dass wir direkt sehen, wie es
// der Kunde sieht, also starten bei 1! Und bitte in HIGH END Demo Modus, dass
// wir es uns im Detail ansehen können."
//
// Dieser Router antwortet für GENAU EINE Referenz (FIAON-DEMO) mit festen,
// erfundenen Daten — ohne Cookie, ohne Datenbank, ohne Schreibzugriff. Er
// liegt VOR den echten Kundenrouten, damit `requireKunde` ihn nie sieht. Die
// Seite /demo/kundenbereich ist der echte Kundenbereich (mein-bereich.tsx) mit
// dieser Referenz: dieselbe Oberfläche, nur die Daten kommen von hier.
//
// ── WAS SICH AM 10.09.2026 GEÄNDERT HAT ────────────────────────────────────
// Vorher gab es EINEN festen Zustand: ein Kunde mitten im Weg, Startgespräch
// geführt, vier Raten bezahlt. Der Anfang war damit nie zu sehen — und der
// Anfang ist die Stelle, an der ein echter Kunde zum ersten Mal auf den
// Bereich schaut. Jetzt trägt jede Antwort eine STUFE (`?stufe=1` … `12`,
// Vorgabe 1). Die Stufen stehen in shared/fiaon-demo-stufen.ts, weil der
// Kundenbereich zwei Dinge daraus ableitet, die nicht von hier kommen: den
// Stand der Selbstauskunft und die versandten Schreiben.
//
// Jedes Feld folgt der Stufe. Ein Kunde auf Stufe 1 hat gerade unterschrieben,
// keine Rate bezahlt, keine Unterlagen abgegeben, keinen Betreuer gesprochen —
// und seine Finanzauswertung gibt es noch nicht, weil sie aus dem Kontoauszug
// entsteht. Wer hier ein Feld ergänzt, ergänzt es für alle zwölf Stufen; sonst
// erzählt die Demo zwei verschiedene Geschichten.
//
// Alles, was schreiben würde (Ticket, Passwort, Lastschrift, Abo), antwortet
// freundlich mit „nur zur Ansicht“. Max Mustermann ist kein Kunde.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { paket as paketVon } from "@shared/fiaon-pakete";
import { demoStand, demoStufeAus, demoAlterTage, DEMO_STUFEN, DEMO_STUFEN_MAX } from "@shared/fiaon-demo-stufen";

export const DEMO_REF = "FIAON-DEMO";
const router = Router();

const tag = (d: Date): string => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const vorTagen = (n: number): Date => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 30, 0, 0); return d; };
const monatePlus = (start: Date, n: number): Date => { const d = new Date(start); d.setMonth(d.getMonth() + n); return d; };
/** Die Stufe aus der Adresszeile — `?stufe=` (oder kurz `?s=`). */
const stufeAus = (req: Request): number => demoStufeAus(req.query.stufe ?? req.query.s ?? 1);

function demoBereich(stufeRoh: unknown) {
  const st = demoStand(stufeRoh);
  const stufe = st.stufe;
  const pk = paketVon("pro");
  const paketName = pk?.label || "FIAON Pro";
  const monatlichCents = pk?.preisCents ?? 5999;
  const rahmen = 5000;

  // Das Alter der Akte wächst mit der Stufe — sonst stünde auf Stufe 1
  // „Kunde seit vier Monaten“ neben einem leeren Weg.
  const alter = demoAlterTage(stufe);
  const antrag = vorTagen(alter);
  const zurueck = (n: number) => vorTagen(Math.max(0, alter - n));

  // Die erste Rate ist am Tag des Antrags fällig, jede weitere einen Monat später.
  const raten = Array.from({ length: 12 }, (_, i) => {
    const f = monatePlus(antrag, i);
    const istBezahlt = i === 0 ? st.bezahlt : i === 1 ? st.rate2 : (stufe >= DEMO_STUFEN_MAX && i === 2);
    return {
      nr: i + 1, betragCents: monatlichCents, faelligAm: tag(f), faelligIso: iso(f),
      status: istBezahlt ? "bezahlt" : "offen", bezahltAm: istBezahlt ? tag(f) : null,
      referenz: `FIAON-DEMO-R${String(i + 1).padStart(2, "0")}`,
    };
  });
  const naechste = raten.find((r) => r.status !== "bezahlt") ?? null;
  const bezahlteRaten = raten.filter((r) => r.status === "bezahlt").length;

  // Tage, an denen etwas passiert ist — nur für Schritte, die auf dieser Stufe
  // schon erledigt sind. `datum()` in fiaon-rahmenweg.ts liest genau hier.
  const amStart = st.startgespraech ? zurueck(5) : null;
  const amUnterlagen = st.unterlagen ? zurueck(8) : null;
  const amAuskunft = st.auskunft ? zurueck(12) : null;
  const amAnalyse = st.analyse ? zurueck(16) : null;
  const amKonto = st.konto ? zurueck(64) : null;

  const fertigWenn = (key: string, titel: string, text: string, wann: Date | null, stempel: string, href?: string) =>
    wann ? [{ key, titel, text, stand: "fertig" as const, datum: tag(wann), stempel, href: href ?? null }] : [];

  // Der alte Fahrplan (Bestandsbereich /mein-bereich). Der neue Weg unter /app
  // rechnet selbst; er liest hier nur die Daten der erledigten Schritte.
  const etappen = [
    ...fertigWenn("start", "Startgespräch", "Geführt mit Lena Winter. Ihr Konto ist seitdem vollständig freigeschaltet.", amStart, "erledigt"),
    ...fertigWenn("unterlagen", "Unterlagen vollständig", "Kontoauszug und Ausweis liegen vor und sind geprüft.", amUnterlagen, "geprüft", "#unterlagen"),
    ...fertigWenn("auskunft", "Bonitätsauskunft", "Ihre Auskunft ist eingegangen.", amAuskunft, "liegt vor", "#bonitaet"),
    ...fertigWenn("analyse", "Analyse durch FIAON", "Jeder Eintrag geprüft und in Menschensprache erklärt.", amAnalyse, "fertig"),
  ];

  // Die drei Tore zur Karte (E-067). Das erste ist zugleich Schritt 1 des Weges.
  const tore = [
    { titel: "Antrag vollständig", erfuellt: st.datenOk, warum: st.datenOk ? null : "Name, Anschrift und Geburtsdatum müssen zu Ihrem Ausweis passen." },
    { titel: "Paket, Auskunft und zwei Raten bezahlt", erfuellt: st.rate2, warum: st.rate2 ? null : "Zwei pünktliche Raten sind zugleich Ihr Zahlungsnachweis für die Bank." },
    { titel: "Kontoauszug und Ausweis geprüft", erfuellt: st.unterlagen, warum: st.unterlagen ? null : "Ein Handyfoto genügt, wenn alles lesbar ist." },
  ];

  const kontoStufe = !st.bezahlt
    ? { stufe: "wartet_auf_zahlung", text: "Ihr Konto wird freigeschaltet, sobald Ihre erste Zahlung eingegangen ist.", grund: "Erste Zahlung offen", naechsterSchritt: "Erste Zahlung", vollAktiv: false, pflicht: true, bezahlt: false }
    : !st.startgespraech
      ? { stufe: "aktiv", text: "Ihr Konto ist freigeschaltet. Nach dem Startgespräch geht es an Ihre Akte.", grund: null, naechsterSchritt: "Startgespräch", vollAktiv: false, pflicht: false, bezahlt: true }
      : { stufe: "voll_aktiv", text: "Ihr Konto ist vollständig aktiv.", grund: null, naechsterSchritt: null, vollAktiv: true, pflicht: false, bezahlt: true };

  const bonitaet = {
    stufe: st.analyse ? "geprueft" : st.auskunft ? "eingegangen" : st.bezahlt ? "beauftragt" : "offen",
    fuerKunden: st.analyse
      ? "Ihre Auskunft liegt vor und ist ausgewertet: drei Einträge, zwei davon angreifbar – beide sind bereits angegangen."
      : st.auskunft
        ? "Ihre Auskunft ist eingegangen. Ein Mensch geht sie gerade Eintrag für Eintrag durch."
        : st.bezahlt
          ? "Wir haben Ihre Auskunft beauftragt. Sobald sie da ist, tragen wir sie hier ein."
          : "Ihre Auskunft beschaffen wir, sobald Ihre erste Zahlung eingegangen ist.",
    naechsterSchritt: st.schreiben
      ? "Warten auf die Antwort zum ersten Schreiben. Wir melden uns, sobald sie da ist."
      : st.analyse
        ? "Aus der Prüfung entsteht Ihr erstes Schreiben. Sie unterschreiben, wir versenden."
        : "Wir melden uns, sobald es etwas zu entscheiden gibt.",
    bezahlt: st.bezahlt, hatDokument: st.auskunft, geprueft: st.analyse,
    darfKaufen: false, darfHochladen: false, bestellRef: "FIAON-SCHUFA-DEMO",
    zahlungsreferenz: "FIAON-SCHUFA-DEMO", zahlungsstatus: st.bezahlt ? "paid" : "pending", preisEuro: 74,
  };

  // Die Finanzauswertung entsteht AUS dem Kontoauszug. Vor Schritt 5 gibt es
  // sie nicht — eine Demo, die sie trotzdem zeigt, verspricht etwas Falsches.
  const finanzen = !st.unterlagen ? null : {
    id: 1, ref: DEMO_REF, status: "fertig", fehler: null,
    zeitraumVon: iso(vorTagen(alter + 90)), zeitraumBis: iso(zurueck(8)),
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
    erstelltAm: (amUnterlagen ?? antrag).toISOString(),
  };

  const jetzt = DEMO_STUFEN.find((x) => x.nr === stufe) ?? DEMO_STUFEN[0];

  return {
    ok: true,
    demo: true,
    /** Welche Stufe des Weges diese Antwort zeigt (1 … 12). */
    demoStufe: stufe,
    demoStufeTitel: jetzt.titel,
    kunde: {
      ref: DEMO_REF, vorname: "Max", nachname: "Mustermann", email: "max.mustermann@beispiel.de",
      telefon: "+49 170 1234567", strasse: "Musterstraße 12", plz: "10115", ort: "Berlin", land: "DE",
      geburtsdatum: "1988-05-14", kundeSeit: tag(antrag), profilRueckfrage: false, profilHinweis: null,
    },
    paket: {
      key: pk?.key || "pro", name: paketName, abo: true, rahmen, wunschlimit: rahmen, monatlichCents,
      zahlungsstatus: st.bezahlt ? "paid" : "pending_payment", zahlungsreferenz: "FIAON-DEMO-R01", faelligAm: tag(antrag),
    },
    stufe: kontoStufe,
    bonitaet,
    unterlagen: {
      kontoauszug: st.unterlagen, ausweis: st.unterlagen, auskunft: st.auskunft,
      erneutKontoauszug: false, erneutAusweis: false,
      kycStatus: st.unterlagen ? "verified" : "offen", kontoStatus: st.bezahlt ? "active" : "pending",
    },
    abo: {
      verlaengerung: { gefragt: false, entschieden: false, verlaengert: false, beendet: false, bezahlteRaten },
      naechste: naechste ? { nr: naechste.nr, betragCents: naechste.betragCents, faelligAm: naechste.faelligAm, status: naechste.status, referenz: naechste.referenz } : null,
      offen: raten.length - bezahlteRaten, bezahlt: bezahlteRaten, raten,
    },
    termin: amStart ? { beginn: amStart.toISOString(), status: "erledigt", agent: "Lena Winter" } : null,
    onboardingGelaufen: st.startgespraech,
    fahrplan: etappen,
    naechsterSchritt: { key: jetzt.key, titel: jetzt.titel, text: jetzt.was, href: null },
    ansprechpartner: { name: "Lena Winter", rolle: "Onboarding" },
    lastschrift: st.bezahlt ? { mandat: "MD-DEMO-0001", status: "active", aktiv: true } : { mandat: null, status: null, aktiv: false },
    kontoVerbunden: false,
    karte: { bereit: st.kartenweg, esFehlt: [], verschickt: st.kartenweg, tore },
    konto: { eroeffnet: st.konto, am: amKonto ? tag(amKonto) : null },
    passwortGesetzt: true,
    finanzen,
  };
}

const nurAnsicht = (res: Response) => res.status(200).json({ ok: false, demo: true, error: "Im Demo-Konto ist alles nur zur Ansicht. Im echten Konto läuft dieser Schritt sofort durch." });

router.get(`/kunde/${DEMO_REF}/bereich`, (req: Request, res: Response) => { res.json(demoBereich(stufeAus(req))); });

/** Die Stufenliste für die Bedienung im Demo-Modus. */
router.get(`/kunde/${DEMO_REF}/stufen`, (_req: Request, res: Response) => {
  res.json({ ok: true, demo: true, stufen: DEMO_STUFEN, hoechste: DEMO_STUFEN_MAX });
});

// 05.09.2026 (Berater-Sitzung, /app/demo): Der Kundenbereich fragt auch die
// Termine ab — ohne diese Route antwortete der echte Weg mit 401. Dieselbe
// Form wie GET /kunde/:ref/termine, aus den festen Demo-Daten gebaut.
router.get(`/kunde/${DEMO_REF}/termine`, async (req: Request, res: Response) => {
  const b = demoBereich(stufeAus(req));
  // Vor dem Startgespräch gibt es keinen Termin — der Weg zeigt dann „Zeit wählen“.
  if (!b.termin) return res.json({ ok: true, demo: true, kommende: [], vergangene: [], buchungsLink: null });
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

router.get(`/kunde/${DEMO_REF}/tickets`, (req: Request, res: Response) => {
  const st = demoStand(stufeAus(req));
  const alter = demoAlterTage(st.stufe);
  const zurueck = (n: number) => vorTagen(Math.max(0, alter - n));
  const tickets: any[] = [];
  if (st.schreiben) {
    tickets.push({
      id: 2, betreff: "Frage zur Frist des ersten Schreibens", text: "Bis wann muss die Gegenseite antworten?", status: "beantwortet",
      antwort: "Die Frist endet am Monatsende. Kommt keine Antwort, gilt der Eintrag als nicht belegt – wir setzen dann den nächsten Schritt auf.",
      beantwortet_am: zurueck(30).toISOString(), created_at: zurueck(31).toISOString(),
    });
  }
  if (st.unterlagen) {
    tickets.push({
      id: 1, betreff: "Kontoauszug nachreichen", text: "Ich habe den aktuellen Auszug hochgeladen – ist er angekommen?", status: "beantwortet",
      antwort: "Ja, vielen Dank. Er ist geprüft und die Auswertung liegt unter „Meine Finanzen“.",
      beantwortet_am: zurueck(8).toISOString(), created_at: zurueck(9).toISOString(),
    });
  }
  res.json({ ok: true, demo: true, tickets });
});

router.get(`/kunde/${DEMO_REF}/startgespraech`, (req: Request, res: Response) => {
  const st = demoStand(stufeAus(req));
  res.json({
    ok: true, demo: true, token: null,
    error: st.startgespraech
      ? "Im Demo-Konto ist das Startgespräch bereits geführt."
      : "In der Demo-Ansicht lässt sich kein Termin buchen. Im echten Konto wählen Sie hier Ihre Zeit.",
  });
});
router.post(`/kunde/${DEMO_REF}/tickets`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/passwort`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/lastschrift/start`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/abo/verlaengerung`, (_req: Request, res: Response) => nurAnsicht(res));
router.post(`/kunde/${DEMO_REF}/startgespraech/spaeter`, (_req: Request, res: Response) => nurAnsicht(res));
router.patch(`/profile/${DEMO_REF}`, (_req: Request, res: Response) => nurAnsicht(res));

export default router;
