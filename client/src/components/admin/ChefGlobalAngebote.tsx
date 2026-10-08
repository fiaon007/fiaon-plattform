// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · GLOBAL-AUFTRÄGE → Reiter „Individualangebote"
// Individualangebot (01.10.2026), Register E-268
//
// Keine neue Chef-Seite (Regel „Keine neuen Chef-Seiten"): ein Reiter im Raum
// /chef/s/global-auftraege (?reiter=angebote). Hier legt die Leitung ein
// persönliches Angebot an (Person → Daten aus dem jüngsten Antrag), trägt die
// Pflichtfelder der Bürgin ein, kopiert den signierten Link — und führt nach der
// Annahme die drei Dinge, die nur ein Mensch entscheiden kann:
//   · E-271 (Kreditgarantie, 01.10.2026 abends): „Garantie erfüllt" → Kreditrahmen ≥ Ziel und Karten ≥ Ziel
//     bis zum Fristende eingetragen (Belege intern) — danach kein Garantiefall, keine Fristwarnungen mehr;
//     „Erstattung vormerken" heißt jetzt „Garantiefall" und erstattet ALLES Gezahlte (auch nach dem Meilenstein).
//   · „Meilenstein erreicht" → Rechnung Teil 2 (Zahlungsziel sieben Tage),
//   · „Frist hemmen" → nur mit Aufforderung in Textform und Grund,
//   · „Erstattung vormerken" → erst nach Fristende ohne Meilenstein: Teil 2
//     entfällt, Storno mit Erstattung, dringende Aufgabe an Justin (Geld bewegt
//     nur er, von Hand), Mail an den Kunden.
// Ob ein Knopf frei ist, sagt der Server (knoepfe) — der Grund steht als Text da.
// Server: server/routes/fiaon-global-angebot.ts.
//
// Angebot-Aufrufe (01.10.2026, Justin: „wann er es wie oft und wo geöffnet hat"): je Angebot
// „Geöffnet: n× (zuletzt …)" bzw. „Noch nicht geöffnet", „Kunde zuletzt: …" und die aufklappbare
// Liste (Zeit Berlin, Art, Gerät, Ort, du/Kunde). Alles kommt fertig vom Server (aufrufe) —
// Zeiten schon in Berlin, Ort ehrlich („Ort unbekannt"). Quelle: server/lib/fiaon-global-angebot-aufrufe.ts.
//
// E-301 (07.10.2026): FIRMENANGEBOTE (B2B) stehen in derselben Liste (art „firma“) mit eigenem Block: Firma, Teile
// (Gründung, Monate, Umsatz, Verkauf) mit Fälligkeit/Rechnung/bezahlt, Freigabe Anwalt (Teil der Versandsperre),
// Bedingungen erfüllt (startet die Garantiefrist der ersten Runde), erste Runde erhalten, Frist ruhen, Garantiefall
// (Erstattung der Gründung), Umsatz eintragen, Verkauf eintragen, Kündigung, „Rechnung jetzt stellen“. Angelegt wird
// ein Firmenangebot nur per Skript (scripts/angebot-firma-anlegen.ts). Knopf-Zustände kommen vom Server (knoepfe).
//
// E-273 (02.10.2026): Nach der Annahme bucht das System das Startgespräch selbst (beim nächsten freien Termin, in
// Justins Kalender — server/lib/fiaon-global-angebot-startgespraech.ts). Die Zeile „Startgespräch" zeigt den Termin
// oder rot „nicht gebucht — von Hand buchen" mit dem Grund; „Nachholen" versucht es noch einmal.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, type ReactNode } from "react";
import { eur, datum, datumZeit, Geruest, Fehlermeldung, useDaten, API } from "./chef-teile";

/** „800.000 $" — Kreditrahmen der Garantie (E-271). */
const usd = (n: number) => `${Math.round(n).toLocaleString("de-DE")} $`;

type Teil = {
  nr: number; titel: string; betragCents: number; faelligkeit: string; zahlungszielTage: number; bestellRef: string | null; verwendungszweck: string | null;
  rechnungsnummer: string | null; zahlungsstatus: string | null; faelligAm: string | null; bezahltAm: string | null; meilensteinAm: string | null; meilensteinArt: string | null;
  eingetragenAm: string | null; entfallenAm: string | null; entfallenGrund: string | null; rechnungUrl: string | null; zahlungsseite: string | null;
};
type AufrufZeile = { id: number; am: string; amText: string; art: string; geraet: string; ort: string; ip: string | null; wer: string; kunde: boolean; gemeldet: boolean; meldung: string | null; antwort: number | null };
type Aufrufe = {
  geoeffnet: number; vertragPdf: number; pruefberichtPdf: number; kundeAufrufe: number; besuche: number; intern: number; automatisch: number; gesamt: number;
  kundeZuletzt: { am: string; amText: string; art: string; geraet: string; ort: string } | null; kundeErster: { am: string; amText: string } | null;
  aufgabeSchluessel: string; liste: AufrufZeile[];
  /** Gegenprüfung 01.10.2026 (F1): Löschfrist erreicht (90 Tage nach Abschluss) — dann nicht „Noch nicht geöffnet". */
  geloescht?: boolean;
};
type Buergin = { name: string; bundesstaat: string | null; anschrift: string | null; registerstelle: string | null; registernummer: string | null; vertreter: string | null; funktion: string | null; unterzeichnetAm: string | null; bestaetigt: boolean; bestaetigtGrundlage: string | null };
type Angebot = {
  id: number; ref: string; status: "offen" | "angenommen" | "zurueckgezogen" | "abgelaufen"; personId: number | null; kundeName: string;
  kunde: Record<string, string>; parameter: Record<string, number>; gesamtCents: number; buergin: Buergin; fehlt: string[]; annahmeBereit: boolean;
  /** Endabnahme 01.10.2026: Grund, warum der Link noch nicht verschickt werden darf (Registernachweis der Bürgin) — null = frei. */
  versandSperre: string | null;
  gueltigBis: string; erstelltAm: string; erstelltVon: string | null; link: string | null; vertragUrl: string; pruefberichtUrl: string | null;
  anlage1Url: string; anlage1Pruefsumme: string;
  pruefbericht: { ergebnis: string; boniPunkte: number | null; boniLabel: string | null; sanktionen: boolean } | null;
  angenommenAm: string | null; ip: string | null; textHash: string | null; schalter: { sofortBeginn: boolean; jahresbetreuung: boolean } | null;
  auftragRef: string | null; officeLink: string | null; fristBeginn: string | null; fristEnde: string | null; fristHemmungTage: number;
  erstattungAusgeloestAm: string | null; erstattetAm: string | null; erstattungNotiz: string | null;
  /** E-271 (Kreditgarantie): erfüllt am/mit, Erstattungsbetrag, und was der Garantiefall heute erstatten würde (rechnet der Server). */
  garantieErfuelltAm: string | null; garantieRahmenUsd: number | null; garantieKarten: number | null; garantieVon: string | null;
  erstattungCents: number | null; erstattungVorschau: { teil2Fall: string; summeCents: number };
  bestaetigungMailAm: string | null; bestaetigungMailFehler: string | null; nacharbeitFehler: string | null;
  zurueckgezogenAm: string | null; zurueckgezogenGrund: string | null; teile: Teil[];
  knoepfe: { meilenstein: string | null; erstattung: string | null; garantie: string | null; hemmung: string | null; aendern: string | null };
  verlauf: { am: string; wer: string; was: string }[];
  /** Angebot-Aufrufe (01.10.2026) — null, wenn die Liste der Aufrufe gerade nicht ladbar ist. */
  aufrufe: Aufrufe | null;
  /** E-273 (02.10.2026): das vom System gebuchte Startgespräch — null bei offenen Angeboten oder wenn es nicht lesbar ist. */
  startgespraech: {
    stand: "gebucht" | "gefuehrt" | "vorbei" | "abgesagt" | "persoenlich" | "folgt" | "keins"; terminId: number | null; neuGebucht: boolean;
    fehler: string | null; versuche: number; versuchAm: string | null; mailAm: string | null; abgesagtVon: string | null;
    terminStatus: string | null; zeile: string | null; beginn: string | null;
  } | null;
};
type Antwort = {
  ok: boolean; angebote: Angebot[];
  vorgaben: { parameter: Record<string, number>; buergin: Buergin; buerginFelder: { schluessel: keyof Buergin; bezeichnung: string; hinweis: string }[]; fassung: string; gueltigTage: number };
};

/** E-273: die Zeile „Startgespräch" am angenommenen Angebot. Rot, solange ein Mensch von Hand buchen muss. */
function StartgespraechZeile({ sg }: { sg: NonNullable<Angebot["startgespraech"]> }) {
  const grund = sg.fehler ? sg.fehler.replace(/^(kein_platz|keine_person|technik):\s*/, "") : null;
  if (sg.stand === "gebucht" || sg.stand === "gefuehrt" || sg.stand === "vorbei") {
    return <p className="cm-klartext" data-startgespraech={sg.stand}>Startgespräch: <b>{sg.zeile}</b> · {sg.stand === "gefuehrt" ? "geführt" : sg.stand === "vorbei" ? "Zeit vorbei — im Kalender abschließen" : "gebucht"}{sg.neuGebucht ? " (nach einer Absage neu gebucht)" : ""}{sg.mailAm ? ` · Kunde informiert ${datumZeit(sg.mailAm)}` : " · Mail an den Kunden noch nicht raus"}</p>;
  }
  if (sg.stand === "abgesagt") return <p className="cm-klartext cg-rot" data-startgespraech="abgesagt">Startgespräch {sg.zeile ? `(${sg.zeile}) ` : ""}abgesagt {sg.abgesagtVon === "kunde" ? "vom Kunden" : "durch das Team"} — neuen Termin von Hand vereinbaren (Aufgabe bei Justin).</p>;
  // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): „verpasst“ heißt hier, ein Mensch hat im Kalender „kam nicht
  // zustande“ eingetragen — gebucht WAR es, und eine Aufgabe an Justin entsteht dabei nicht (globalTerminErgebnis).
  if (sg.stand === "persoenlich" && sg.terminStatus === "verpasst") return <p className="cm-klartext cg-rot" data-startgespraech="verpasst">Startgespräch{sg.zeile ? ` (${sg.zeile})` : ""} kam nicht zustande — neuen Termin von Hand vereinbaren.</p>;
  if (sg.stand === "persoenlich") return <p className="cm-klartext cg-rot" data-startgespraech="persoenlich">Startgespräch: nicht gebucht — von Hand buchen{grund ? ` (${grund})` : ""}. Aufgabe bei Justin.</p>;
  if (sg.stand === "folgt") return <p className="cm-klartext cg-rot" data-startgespraech="folgt">Startgespräch: noch nicht gebucht{grund ? ` (${grund}; ${sg.versuche} Versuch${sg.versuche === 1 ? "" : "e"}, der Stundenlauf versucht es weiter)` : " — die Buchung läuft"}. Sonst von Hand buchen.</p>;
  return null;
}

const STATUS_TEXT: Record<Angebot["status"], string> = { offen: "Offen — wartet auf Annahme", angenommen: "Angenommen", zurueckgezogen: "Zurückgezogen", abgelaufen: "Abgelaufen" };
const KUNDE_FELDER: [string, string][] = [["anrede", "Anrede"], ["vorname", "Vorname"], ["nachname", "Nachname"], ["geburtsdatum", "Geburtsdatum (JJJJ-MM-TT)"], ["strasse", "Straße"], ["plz", "PLZ"], ["ort", "Ort"], ["land", "Land (DE/AT/CH)"], ["email", "E-Mail"], ["telefon", "Telefon"]];
const PARAM_FELDER: [string, string, "euro" | "zahl"][] = [["teil1Cents", "Teil 1 „Gründung“ (€)", "euro"], ["teil2Cents", "Teil 2 „Kapital-Begleitung“ (€)", "euro"], ["fristWochen", "Frist in Wochen", "zahl"], ["erstattungTage", "Erstattung binnen Tagen", "zahl"], ["teil2ZielTage", "Zahlungsziel Teil 2 (Tage)", "zahl"], ["kapitalZielUsd", "Garantierter Kreditrahmen (US-Dollar)", "zahl"], ["kartenZiel", "Garantierte Business-Kreditkarten (Anzahl)", "zahl"], ["buergschaftUsd", "Höchstbetrag Bürgschaft (US-Dollar)", "zahl"]];

/** Wer hat den persönlichen Link wann, wie oft und wo geöffnet — und wurde Justin benachrichtigt? */
function AufrufBlock({ x }: { x: Aufrufe | null }) {
  if (!x) return <div className="cg-aufrufe" data-aufrufe="fehlt"><p className="cm-fein">Die Aufrufe des Links lassen sich gerade nicht laden — bitte die Seite gleich neu laden.</p></div>;
  const kopf = x.geloescht && x.gesamt === 0
    ? "Aufrufe gelöscht — 90 Tage nach Abschluss"
    : x.geoeffnet > 0
      ? `Geöffnet: ${x.geoeffnet}×${x.kundeZuletzt ? ` (zuletzt ${x.kundeZuletzt.amText})` : ""}`
      : x.kundeAufrufe > 0 ? "Seite noch nicht geöffnet" : "Noch nicht geöffnet";
  const neben = [
    x.vertragPdf ? `Vertrag-PDF ${x.vertragPdf}×` : null,
    x.pruefberichtPdf ? `Prüfbericht-PDF ${x.pruefberichtPdf}×` : null,
    x.besuche > 1 ? `${x.besuche} Besuche` : null,
    x.intern ? `dazu ${x.intern}× du/Team` : null,
    x.automatisch ? `${x.automatisch}× automatisch` : null,
  ].filter(Boolean);
  const letzteMeldung = x.liste.find((z) => z.gemeldet) ?? null;
  return (
    <div className="cg-aufrufe" data-aufrufe-geoeffnet={x.geoeffnet} data-aufrufe-geloescht={x.geloescht ? "ja" : undefined}>
      <p className="cg-aufruf-kopf"><b className={x.kundeAufrufe > 0 ? "cg-gut" : undefined}>{kopf}</b>{neben.length > 0 && <span className="cm-fein"> · {neben.join(" · ")}</span>}</p>
      {x.kundeZuletzt && <p className="cm-klartext">Kunde zuletzt: {x.kundeZuletzt.amText} · {x.kundeZuletzt.art} · {x.kundeZuletzt.geraet} · {x.kundeZuletzt.ort}</p>}
      {letzteMeldung && <p className="cm-fein">Letzte Meldung an dich: {letzteMeldung.amText} — {letzteMeldung.meldung ?? "läuft gerade"}</p>}
      {x.liste.length > 0 && (
        <details className="cg-verlauf cg-aufruf-liste">
          <summary>Alle Aufrufe ({x.gesamt}{x.gesamt > x.liste.length ? `, hier die letzten ${x.liste.length}` : ""})</summary>
          <div className="cm-tab-halter"><table className="cm-tab cg-aufruf-tab">
            <thead><tr><th>Zeit (Berlin)</th><th>Art</th><th>Gerät</th><th>Ort</th><th>Wer</th></tr></thead>
            <tbody>
              {x.liste.map((z) => (
                <tr key={z.id} className={z.kunde ? "cg-aufruf-kunde" : undefined}>
                  <td>{z.amText}{z.gemeldet && <span className="cm-fein" title={z.meldung ?? undefined}> · gemeldet</span>}</td>
                  <td>{z.art}{z.antwort != null && z.antwort >= 400 && <span className="cg-rot"> (Antwort {z.antwort})</span>}</td>
                  <td>{z.geraet}</td>
                  <td>{z.ort}{z.ip && <span className="cm-fein"> · IP {z.ip}</span>}</td>
                  <td>{z.wer}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </details>
      )}
      <p className="cm-fein">Beim ersten Öffnen durch den Kunden und bei jedem neuen Besuch nach 30 Minuten Pause bekommst du eine Aufgabe auf deinem Board und eine Mail an js@fiaon.com. Deine eigenen Aufrufe zählen als „du“ und lösen nichts aus. Der Ort kommt nur aus den Angaben des Netzbetreibers. Die gekürzte IP steht nur hier, nicht in Aufgabe und Mail.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// E-301 — DER BLOCK EINES FIRMENANGEBOTS
// ═══════════════════════════════════════════════════════════════════════════
type FirmaTeil = {
  id: number; nr: number; titel: string; betragCents: number; faelligkeit: "sofort" | "monatlich" | "umsatz" | "verkauf" | string; faelligAm: string | null; zeitraum: string | null;
  bestellRef: string | null; verwendungszweck: string | null; rechnungsnummer: string | null; zahlungsstatus: string | null; zahlbarBis: string | null; bezahltAm: string | null;
  entfallenAm: string | null; entfallenGrund: string | null; bemessungCents: number | null; rechnungUrl: string | null; rechnungKnopf: string | null;
  /** „gesellschafter“ = Verkauf durch Gesellschafter: keine Rechnung an die Firma (Ziffer 12 Absatz 5). */
  schuldner?: string | null;
};
type FirmaKnoepfe = { shopLive?: string | null; freigabe: string | null; aendern: string | null; bedingungen: string | null; kapital: string | null; hemmung: string | null; garantiefall: string | null; umsatz: string | null; verkauf: string | null; kuendigung: string | null; kuendigungOrdentlich?: string | null };
type FirmaAngebot = {
  art: "firma"; id: number; ref: string; status: Angebot["status"]; fassung: string; kundeName: string; vertreter: string; email: string;
  kunde: { firma: { name: string; uid: string; registernummer: string; strasse: string; plz: string; ort: string }; vertretung: { funktion: string } };
  parameter: { startCents: number; monatCents: number; mindestMonate: number; verlaengerungMonate: number; kuendigungMonate: number; umsatzSatzProzent: number; umsatzSchwelleCents: number; verkaufSatzProzent: number; kapitalUsd: number; garantieMonate: number; budgetSpaetestensMonate?: number };
  buergin: Buergin; fehlt: string[]; annahmeBereit: boolean; versandSperre: string | null;
  freigaben: { anwalt?: { name: string; am: string; textHash?: string } | null; bedingungenErfuelltAm?: string | null; kuendigung?: { am: string; zum: string; seite?: "auftraggeberin" | "fiaon"; art?: "ordentlich" | "ausserordentlich"; garantieEntfaellt?: boolean } | null; verkauf?: { am: string; endetUmsatz?: boolean } | null };
  gueltigBis: string; link: string | null; vertragUrl: string;
  /** Nachprüfung 08.10.2026: Versand gesperrt und Stufe unter „Inhaber“ — den Link sieht dann nur Justin. */
  linkNurInhaber?: boolean; pruefberichtUrl: string | null; anlage1Url: string; anlage1Pruefsumme: string; pruefsummeJetzt: string;
  compliance: { ampel: string; titel: string; bereiche: number } | null;
  angenommenAm: string | null; ip: string | null; textHash: string | null; starttag: string | null; startWahl: string | null; auftragRef: string | null; officeLink: string | null;
  /** Runde 2: Tag „Shop live“ (= Starttag des Wachstumsbudgets), Garantie ab Annahme (Fassung C), gespeicherte Unterschrift. */
  shopLiveAm?: string | null; garantieAbAnnahme?: boolean;
  /** Runde 3 (Fassung D): nur die Auszahlung erfüllt die Garantie; spätester Starttag des Wachstumsbudgets (Ziffer 10 Absatz 2). */
  garantieNurAuszahlung?: boolean; spaetesterStart?: string | null;
  unterschrift?: { art: "gezeichnet" | "getippt"; name: string | null; am: string | null; ip: string | null } | null;
  laufzeitEnde: string | null; kuendigungSpaetestens: string | null;
  garantie: { bedingungenErfuelltAm: string | null; fristBeginn: string | null; fristEnde: string | null; ruhtTage: number; erfuelltAm: string | null; betragUsd: number | null; erstattungAusgeloestAm: string | null; erstattungCents: number | null; erstattetAm: string | null; erstattungNotiz: string | null };
  summen: { gestellt: number; bezahlt: number }; teile: FirmaTeil[]; knoepfe: FirmaKnoepfe; nacharbeitFehler: string | null;
  zurueckgezogenAm: string | null; zurueckgezogenGrund: string | null; verlauf: { am: string; wer: string; was: string }[];
  aufrufe: Aufrufe | null; startgespraech: Angebot["startgespraech"];
};
type FirmaForm = "shoplive" | "buergin" | "anwalt" | "bedingungen" | "kapital" | "hemmung" | "garantiefall" | "ueberwiesen" | "umsatz" | "verkauf" | "kuendigung" | "zurueck";

function teilStand(t: FirmaTeil): { text: string; rot?: boolean } {
  if (t.entfallenAm) return { text: `entfallen — ${t.entfallenGrund ?? ""}`, rot: true };
  if (t.schuldner === "gesellschafter") return { text: "vorgemerkt — Schuldner sind die Gesellschafter, keine Rechnung an die Firma (Justin klärt)" };
  if (t.zahlungsstatus === "paid") return { text: `bezahlt${t.bezahltAm ? ` am ${datum(t.bezahltAm)}` : ""}` };
  if (t.zahlungsstatus === "cancelled" || t.zahlungsstatus === "superseded") return { text: "storniert", rot: true };
  // Eine Rechnung steht erst ab pending_payment — der Verwendungszweck steht an jeder Bestellzeile schon ab dem Anlegen.
  if (t.bestellRef && (t.zahlungsstatus === "pending_payment" || t.zahlungsstatus === "claimed_paid")) return { text: `offen · zahlbar bis ${datum(t.zahlbarBis)}` };
  if (t.bestellRef) return { text: "Rechnung hängt — „Rechnung jetzt stellen“", rot: true };
  return { text: t.faelligAm ? `fällig am ${datum(t.faelligAm)} — Rechnung kommt automatisch` : "noch nicht fällig" };
}

function FirmaAngebotBlock({ a, aktion, busy, kopieren, buerginFelder }: {
  a: FirmaAngebot; busy: string | null; buerginFelder: Antwort["vorgaben"]["buerginFelder"];
  aktion: (schluessel: string, pfad: string, body: unknown, methode?: string) => Promise<any>; kopieren: (t: string) => void;
}) {
  const [offen, setOffen] = useState<FirmaForm | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [alleTeile, setAlleTeile] = useState(false);
  const p = a.parameter; const g = a.garantie; const k = a.knoepfe;
  const los = async (schluessel: string, pfad: string, body: unknown, methode = "POST") => { const r = await aktion(schluessel, pfad, body, methode); if (r.ok) { setOffen(null); setForm({}); } };
  const auf = (f: FirmaForm, start: Record<string, any> = {}) => { setOffen(f); setForm(start); };
  const pfad = (x: string) => `/admin/global/angebote/${a.id}/firma/${x}`;
  const wichtig = a.teile.filter((t) => t.faelligkeit !== "monatlich" || t.bestellRef || t.entfallenAm);
  const naechste = a.teile.filter((t) => t.faelligkeit === "monatlich" && !t.bestellRef && !t.entfallenAm).slice(0, 2);
  const zeigen = alleTeile ? a.teile : [...wichtig, ...naechste].sort((x, y) => x.nr - y.nr);
  const Knopf = ({ grund, onClick, children, klasse = "cg-knopf" }: { grund: string | null; onClick: () => void; children: ReactNode; klasse?: string }) => (
    <span><button type="button" className={klasse} disabled={!!grund} onClick={onClick}>{children}</button>{grund && <span className="cm-fein">{grund}</span>}</span>
  );
  return (
    <section className={`cz-block cg-angebot cg-${a.status} cg-firma`} data-angebot={a.ref} data-art="firma">
      <header className="cg-angebot-kopf">
        <div>
          <h3>{a.kundeName} <span className="cg-ref">{a.ref} · Firmenangebot</span></h3>
          <p className="cm-klartext">Vertreten durch {a.vertreter} ({a.kunde.vertretung.funktion}) · UID {a.kunde.firma.uid} · {a.kunde.firma.registernummer}</p>
          <p className="cm-klartext">Gründungskosten {eur(p.startCents)} · Wachstumsbudget: Anteil {eur(p.monatCents)}/Monat (die Hälfte; FIAON trägt die andere) ab „Shop live“{p.budgetSpaetestensMonate ? `, spätestens ${p.budgetSpaetestensMonate} Monate nach Annahme` : ""} ({p.mindestMonate} Monate, dann +{p.verlaengerungMonate}, Kündigung {p.kuendigungMonate} Monate vorher) · {p.umsatzSatzProzent} % über {eur(p.umsatzSchwelleCents)}/Jahr · {p.verkaufSatzProzent} % bei Verkauf · erste Runde {usd(p.kapitalUsd)} binnen {p.garantieMonate} Monaten {a.garantieAbAnnahme === false ? "nach erfüllten Bedingungen" : "ab Annahme"} · gültig bis {datum(a.gueltigBis)}</p>
        </div>
        <span className={`cg-marke cg-marke-${a.status === "angenommen" ? "gestartet" : a.status === "offen" ? "offen" : "storniert"}`}>{STATUS_TEXT[a.status]}</span>
      </header>

      <div className="cg-links">
        {a.link && <span className="cg-linkzeile"><a href={a.link} target="_blank" rel="noreferrer">Kundenseite öffnen (Vorschau, ohne Annahme)</a>
          {a.status === "offen" && a.versandSperre
            ? <span className="cg-rot" data-versand="gesperrt"><b>Versand gesperrt:</b> {a.versandSperre}</span>
            : <button type="button" className="cg-knopf" onClick={() => kopieren(a.link!)}>Link kopieren</button>}
        </span>}
        {!a.link && a.linkNurInhaber && <span className="cg-linkzeile">
          <span className="cg-rot" data-versand="gesperrt"><b>Versand gesperrt:</b> {a.versandSperre}</span>
          <span className="cm-fein">Den Link sieht nur Justin (Stufe Inhaber), solange der Versand gesperrt ist.</span>
        </span>}
        <a href={a.vertragUrl} target="_blank" rel="noreferrer">{a.status === "angenommen" ? "Vertrag mit Annahmevermerk (PDF)" : "Vertrag — Entwurf (PDF)"}</a>
        <a href={a.anlage1Url} target="_blank" rel="noreferrer">Anlage 1 zum Unterschreiben (PDF) · Prüfsumme {a.anlage1Pruefsumme.slice(0, 12)}…</a>
        {a.pruefberichtUrl && <a href={a.pruefberichtUrl} target="_blank" rel="noreferrer">Anlage 2: Prüfbericht (PDF)</a>}
        {a.officeLink && <a href={a.officeLink}>Auftrag im Office ({a.auftragRef})</a>}
      </div>

      <AufrufBlock x={a.aufrufe ?? null} />

      {a.status === "offen" && (a.fehlt.length > 0
        ? <div className="cg-pflicht"><b>Annahme gesperrt — es fehlt:</b><ul>{a.fehlt.map((f) => <li key={f}>{f}</li>)}</ul></div>
        : <p className="cm-klartext cg-gut">Alle Pflichtfelder sind da — die Kundin kann annehmen.</p>)}

      <div className="cg-zwei">
        <div>
          <h4>Bürgin: {a.buergin.name}</h4>
          <p className="cm-klartext">Register: {a.buergin.registernummer || <span className="cg-rot">fehlt</span>} · eigenhändig unterschrieben: {a.buergin.unterzeichnetAm ? datum(a.buergin.unterzeichnetAm) : <span className="cg-rot">offen</span>} · {a.buergin.bestaetigt ? `bestätigt (${a.buergin.bestaetigtGrundlage ?? "—"})` : <span className="cg-rot">nicht bestätigt</span>}</p>
          <p className="cm-klartext">Freigabe Anwalt: {a.freigaben.anwalt ? <><b>{a.freigaben.anwalt.name}, {datum(a.freigaben.anwalt.am)}</b> · für Prüfsumme {a.freigaben.anwalt.textHash ? `${a.freigaben.anwalt.textHash.slice(0, 12)}…` : "— (ohne Prüfsumme: neu eintragen)"}{a.freigaben.anwalt.textHash && a.freigaben.anwalt.textHash !== a.pruefsummeJetzt ? <span className="cg-rot"> — der Vertrag hat sich seitdem geändert</span> : null}</> : <span className="cg-rot">fehlt (sperrt den Versand)</span>}</p>
          <p className="cm-fein">Prüfsumme des Vertrags jetzt: {a.pruefsummeJetzt.slice(0, 12)}… (steht auch in der Fußzeile des Entwurfs-PDF) — die Freigabe gilt nur für diese Fassung.</p>
          <div className="cg-knoepfe cg-knoepfe-reihe">
            <Knopf grund={k.aendern} onClick={() => auf("buergin", { ...a.buergin })}>Pflichtfelder der Bürgin eintragen</Knopf>
            <Knopf grund={k.freigabe} onClick={() => auf("anwalt", { name: a.freigaben.anwalt?.name ?? "", am: "" })}>Freigabe Anwalt eintragen (nur Justin)</Knopf>
          </div>
        </div>
        <div>
          <h4>Anlage 2: Prüfbericht (Kundenfassung)</h4>
          {a.compliance ? <p className="cm-klartext">Ampel <b>{a.compliance.ampel}</b> — {a.compliance.titel} ({a.compliance.bereiche} Bereiche)</p> : <p className="cm-klartext cg-rot">Kein Prüfbericht — sperrt die Annahme. Import mit --compliance.</p>}
        </div>
      </div>

      {a.status === "angenommen" && (
        <div className="cg-annahme">
          <p className="cm-klartext">Angenommen am {datumZeit(a.angenommenAm)} · IP {a.ip ?? "—"} · Prüfsumme {a.textHash?.slice(0, 16)}…{a.unterschrift ? ` · Unterschrift ${a.unterschrift.art === "gezeichnet" ? "gezeichnet" : `getippt („${a.unterschrift.name ?? ""}“)`}` : ""} · {a.starttag ? <>Starttag („Shop live“) <b>{datum(a.starttag)}</b>{a.startWahl ? " (gewählt)" : ""} · Laufzeit bis {datum(a.laufzeitEnde)}</> : <b>Wachstumsbudget noch nicht gestartet — „Shop live“ eintragen, wenn der Shop live ist</b>}{a.freigaben.kuendigung ? ` · ${a.freigaben.kuendigung.art === "ausserordentlich" ? "aus wichtigem Grund gekündigt" : "ordentlich gekündigt"}${a.freigaben.kuendigung.seite === "fiaon" ? " (durch FIAON)" : ""} am ${datum(a.freigaben.kuendigung.am)} zum ${datum(a.freigaben.kuendigung.zum)}${a.freigaben.kuendigung.garantieEntfaellt ? " — Garantie entfällt bei Ende vor dem Fristende" : ""}` : a.kuendigungSpaetestens ? ` · Kündigung spätestens ${datum(a.kuendigungSpaetestens)}` : ""}</p>
          {a.nacharbeitFehler && <p className="cm-klartext cg-rot">Nach der Annahme hing etwas: {a.nacharbeitFehler} <button type="button" className="cg-knopf" disabled={busy === `nach${a.id}`} onClick={() => aktion(`nach${a.id}`, `/admin/global/angebote/${a.id}/nachholen`, {})}>Nachholen</button></p>}
          {a.startgespraech && <StartgespraechZeile sg={a.startgespraech} />}
          <p className="cm-klartext">Erste Runde: {g.fristEnde
            ? <>{a.garantieAbAnnahme === false ? `Bedingungen erfüllt am ${datum(g.bedingungenErfuelltAm)}` : `Garantiefrist ab Annahme (${datum(g.fristBeginn)})${g.bedingungenErfuelltAm ? ` · Bedingungen der Bürgschaft erfüllt am ${datum(g.bedingungenErfuelltAm)}` : " · Unterlagen der Bürgschaft noch offen"}`} · Garantiefrist bis <b>{datum(g.fristEnde)}</b>{g.ruhtTage ? ` (davon ${g.ruhtTage} Tage geruht)` : ""}</>
            : "Garantiefrist beginnt mit „Bedingungen erfüllt“"}
            {g.erfuelltAm ? ` · erhalten am ${datum(g.erfuelltAm)} (${usd(g.betragUsd ?? 0)})` : ""}
            {g.erstattungAusgeloestAm ? ` · Garantiefall am ${datum(g.erstattungAusgeloestAm)}: ${eur(g.erstattungCents ?? 0)} zu erstatten` : ""}
            {g.erstattetAm ? ` · überwiesen am ${datum(g.erstattetAm)} (${g.erstattungNotiz})` : ""}</p>
          <p className="cm-klartext">Gestellt {eur(a.summen.gestellt)} · bezahlt {eur(a.summen.bezahlt)}</p>
          <div className="cm-tab-halter"><table className="cm-tab cg-teile">
            <thead><tr><th>Nr.</th><th>Posten</th><th>Betrag</th><th>Stand</th><th>Rechnung</th></tr></thead>
            <tbody>
              {zeigen.map((t) => { const st = teilStand(t); return (
                <tr key={t.id}>
                  <td>{t.nr}</td>
                  <td><b>{t.titel}</b>{t.zeitraum ? <span className="cm-klartext">{t.zeitraum}</span> : null}{t.bemessungCents != null ? <span className="cm-fein">Bemessung {eur(t.bemessungCents)}</span> : null}</td>
                  <td>{eur(t.betragCents)}</td>
                  <td className={st.rot ? "cg-rot" : undefined}>{st.text}</td>
                  <td>{t.rechnungUrl ? <a href={t.rechnungUrl} target="_blank" rel="noreferrer">{t.rechnungsnummer ?? "Rechnung"}</a> : "—"}{t.verwendungszweck ? <span className="cm-klartext">Zweck {t.verwendungszweck}</span> : null}
                    {!t.rechnungKnopf && <button type="button" className="cg-knopf" disabled={busy === `r${t.id}`} onClick={() => aktion(`r${t.id}`, pfad(`rechnung/${t.id}`), {})}>Rechnung jetzt stellen</button>}</td>
                </tr>); })}
            </tbody>
          </table></div>
          {a.teile.length > zeigen.length || alleTeile ? <button type="button" className="cg-knopf" onClick={() => setAlleTeile(!alleTeile)}>{alleTeile ? "Nur gestellte und nächste Teile zeigen" : `Alle ${a.teile.length} Teile zeigen`}</button> : null}
          <div className="cg-knoepfe cg-knoepfe-reihe">
            <Knopf klasse="cg-knopf cg-knopf-haupt" grund={k.shopLive ?? null} onClick={() => auf("shoplive", { am: "", art: "shop-live", verzoegerungFiaon: false })}>Shop live — Wachstumsbudget starten</Knopf>
            <Knopf klasse="cg-knopf cg-knopf-haupt" grund={k.bedingungen} onClick={() => auf("bedingungen", { am: "" })}>Bedingungen der Bürgschaft erfüllt</Knopf>
            <Knopf klasse="cg-knopf cg-knopf-haupt" grund={k.kapital} onClick={() => auf("kapital", { art: "", am: "", betragUsd: "", beleg: "" })}>Erste Runde erhalten</Knopf>
            <Knopf grund={k.hemmung} onClick={() => auf("hemmung", { aufgefordertAm: "", erbrachtAm: "", grund: "" })}>Garantiefrist ruhen lassen</Knopf>
            <Knopf klasse="cg-knopf cg-knopf-storno" grund={k.garantiefall} onClick={() => auf("garantiefall")}>Garantiefall → Erstattung der Gründung</Knopf>
            {g.erstattungAusgeloestAm && !g.erstattetAm && <span><button type="button" className="cg-knopf" onClick={() => auf("ueberwiesen", { am: "", notiz: "" })}>Erstattung überwiesen</button></span>}
            <Knopf grund={k.umsatz} onClick={() => auf("umsatz", { jahr: String(new Date().getFullYear()), quartal: "", kumuliert: "", beleg: "" })}>Umsatz eintragen</Knopf>
            <Knopf grund={k.verkauf} onClick={() => auf("verkauf", { veraeusserer: "", gegenleistung: "", am: "", beleg: "", endetUmsatz: false })}>Verkauf eintragen</Knopf>
            <Knopf grund={k.kuendigung} onClick={() => auf("kuendigung", { am: "", zum: "", seite: "auftraggeberin", art: a.freigaben.kuendigung || k.kuendigungOrdentlich ? "ausserordentlich" : "ordentlich", garantieEntfaellt: true })}>Kündigung eintragen</Knopf>
          </div>
        </div>
      )}
      {a.status === "offen" && <button type="button" className="cg-knopf cg-knopf-storno" onClick={() => auf("zurueck", { grund: "" })}>Angebot zurückziehen</button>}
      {a.status === "zurueckgezogen" && <p className="cm-klartext">Zurückgezogen am {datum(a.zurueckgezogenAm)}: {a.zurueckgezogenGrund}</p>}

      {offen === "buergin" && (
        <div className="cg-form cg-form-breit">
          <div className="cg-raster">{buerginFelder.map((f) => (
            <label key={String(f.schluessel)} title={f.hinweis}>{f.bezeichnung}<input type={f.schluessel === "unterzeichnetAm" ? "date" : "text"} value={String(form[f.schluessel] ?? "")} onChange={(e) => setForm({ ...form, [f.schluessel]: e.target.value })} /><span className="cm-fein">{f.hinweis}</span></label>
          ))}</div>
          <label className="cg-haken"><input type="checkbox" checked={form.bestaetigt === true} onChange={(e) => setForm({ ...form, bestaetigt: e.target.checked })} /> Bundesstaat, Anschrift und Vertretung bestätigt — Grundlage im Feld „Grundlage der Bestätigung“.</label>
          <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fb${a.id}`} onClick={() => los(`fb${a.id}`, `/admin/global/angebote/${a.id}`, { buergin: form }, "PUT")}>Speichern</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div>
        </div>
      )}
      {offen === "anwalt" && (
        <div className="cg-form"><div className="cg-raster">
          <label>Anwalt bzw. Kanzlei<input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Freigegeben am<input type="date" value={form.am ?? ""} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
        </div><p className="cm-fein">Ohne diese Freigabe bleibt der Versand des Links gesperrt (zusammen mit dem Registerauszug der Bürgin). Sie gilt für die Fassung mit der Prüfsumme {a.pruefsummeJetzt.slice(0, 12)}… — bitte mit der Fußzeile des PDF abgleichen, das der Anwalt geprüft hat. Ändern sich danach der Text oder die Angaben der Bürgin (Registerauszug, Status), sperrt der Versand wieder.</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fa${a.id}` || String(form.name || "").trim().length < 3 || !form.am} onClick={() => los(`fa${a.id}`, pfad("freigabe"), form)}>Freigabe eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "shoplive" && (() => {
        // Runde 3 (Fassung D, Ziffer 10 Absatz 2): spätester Starttag = Annahme + budgetSpaetestensMonate, es sei denn, die Verzögerung liegt bei FIAON.
        const sp = a.spaetesterStart ?? null; const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const spaet = form.art === "spaetestens"; const nachSp = !spaet && !!sp && !!form.am && form.am > sp;
        return (
        <div className="cg-form">
          {sp && <label>Was ist passiert?<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}><option value="shop-live">Der Shop ist live (Tag eintragen)</option><option value="spaetestens" disabled={heute < sp}>Spätester Starttag {datum(sp)} erreicht — Shop noch nicht live, Verzögerung nicht bei FIAON</option></select></label>}
          {!spaet && <label>Tag, an dem der Shop live ist (erreichbar und nimmt Bestellungen an)<input type="date" value={form.am ?? ""} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>}
          {nachSp && <label className="cg-haken"><input type="checkbox" checked={form.verzoegerungFiaon === true} onChange={(e) => setForm({ ...form, verzoegerungFiaon: e.target.checked })} /> Der Tag liegt nach dem spätesten Starttag ({datum(sp)}): Die Verzögerung beruht auf Umständen, die FIAON zu vertreten hat.</label>}
          <p className="cm-fein">Das ist der Starttag (Ziffer 10 Absatz 2): Das gemeinsame Wachstumsbudget beginnt, {p.mindestMonate} Monatsteile über {eur(p.monatCents)} entstehen ab diesem Tag, die erste Monatsrechnung wird sofort gestellt (Aufgabe „Rechnung schicken“), die Mindestlaufzeit läuft ab dann.{sp ? ` Spätester Starttag: ${datum(sp)} — ist der Shop dann nicht live und liegt es nicht an FIAON, ist dieser Tag der Starttag.` : ""} Lässt sich nicht zurücknehmen. Es geht keine automatische Mail an die Kundin — den Tag bitte in Textform mitteilen.</p>
          <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fsl${a.id}` || (!spaet && !form.am) || (nachSp && form.verzoegerungFiaon !== true)} onClick={() => los(`fsl${a.id}`, pfad("shop-live"), spaet ? { art: "spaetestens" } : { am: form.am, verzoegerungFiaon: form.verzoegerungFiaon === true })}>{spaet ? "Spätesten Starttag eintragen" : "Shop live eintragen"}</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
        );
      })()}
      {offen === "bedingungen" && (
        <div className="cg-form"><label>Tag, an dem die letzte Bedingung erfüllt war<input type="date" value={form.am ?? ""} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
        <p className="cm-fein">{a.garantieAbAnnahme === false ? `Damit beginnt die Garantiefrist der ersten Runde (${p.garantieMonate} Monate). Beginn und Ende der Kundin in Textform mitteilen (Ziffer 7 Absatz 3) — es geht keine automatische Mail raus.` : "Damit wird die Bürgschaft wirksam (Ziffer 8 Absatz 4/5). Die Garantiefrist läuft seit der Annahme und bleibt, wie sie ist. Den Tag der Kundin in Textform bestätigen — es geht keine automatische Mail raus."}</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fbe${a.id}` || !form.am} onClick={() => los(`fbe${a.id}`, pfad("bedingungen"), form)}>Bedingungen erfüllt eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "kapital" && (
        <div className="cg-form cg-form-breit"><div className="cg-raster">
          <label>Was ist passiert?<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}><option value="">Bitte wählen</option><option value="ausgezahlt">Erste Runde ausgezahlt</option>{!a.garantieNurAuszahlung && <option value="zugesagt">Verbindlich zugesagt (Textform)</option>}<option value="abgelehnt">Angeboten und von der Kundin abgelehnt (zählt als erhalten)</option></select></label>
          <label>Am<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
          <label>Betrag (ganze US-Dollar)<input inputMode="numeric" value={form.betragUsd} placeholder={String(p.kapitalUsd)} onChange={(e) => setForm({ ...form, betragUsd: e.target.value })} /></label>
        </div><label>Beleg in einem Satz (intern — kein Bankname gegenüber der Kundin)<textarea rows={2} value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} /></label>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fk${a.id}` || !form.art || !form.am || !form.betragUsd || String(form.beleg || "").trim().length < 20} onClick={() => los(`fk${a.id}`, pfad("kapital"), form)}>Erste Runde eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div>
        {String(form.beleg || "").trim().length < 20 && <p className="cm-fein">Noch {20 - String(form.beleg || "").trim().length} Zeichen bis zum Beleg.</p>}</div>
      )}
      {offen === "hemmung" && (
        <div className="cg-form cg-form-breit"><div className="cg-raster">
          <label>Aufforderung in Textform am<input type="date" value={form.aufgefordertAm} onChange={(e) => setForm({ ...form, aufgefordertAm: e.target.value })} /></label>
          <label>Mitwirkung erbracht am (leer = fehlt noch)<input type="date" value={form.erbrachtAm} onChange={(e) => setForm({ ...form, erbrachtAm: e.target.value })} /></label>
        </div><label>Welche Mitwirkung fehlt(e)? (mindestens 20 Zeichen)<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
        <p className="cm-fein">Die Frist ruht ab Aufforderung + sieben Tage bis zur Mitwirkung (Ziffer 7 Absatz 4). Das neue Fristende der Kundin in Textform mitteilen.</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fh${a.id}` || !form.aufgefordertAm || String(form.grund || "").trim().length < 20} onClick={() => los(`fh${a.id}`, pfad("hemmung"), form)}>Ruhezeit eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "garantiefall" && (
        <div className="cg-form cg-form-breit" role="dialog" aria-label="Garantiefall vormerken"><p className="cm-fein"><b>Garantiefrist am {datum(g.fristEnde)} abgelaufen, ohne dass die erste Runde eingetragen ist.</b> Zu erstatten: die Gründung ({eur(p.startCents)}). Der Vertrag läuft weiter. Justin bekommt EINE dringende Aufgabe mit Betrag und spätestem Datum; es wird KEIN Geld bewegt.</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `fg${a.id}`} onClick={() => los(`fg${a.id}`, pfad("garantiefall"), {})}>Garantiefall jetzt vormerken</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "ueberwiesen" && (
        <div className="cg-form"><div className="cg-raster">
          <label>Überwiesen am<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
          <label>Bankreferenz oder Notiz<input value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} /></label>
        </div><div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fu${a.id}`} onClick={() => los(`fu${a.id}`, `/admin/global/angebote/${a.id}/erstattung-ueberwiesen`, form)}>Eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "umsatz" && (
        <div className="cg-form cg-form-breit"><div className="cg-raster">
          <label>Kalenderjahr<input inputMode="numeric" value={form.jahr} onChange={(e) => setForm({ ...form, jahr: e.target.value.replace(/\D/g, "") })} /></label>
          <label>Zeitraum<select value={form.quartal} onChange={(e) => setForm({ ...form, quartal: e.target.value })}><option value="">Bitte wählen</option><option value="1">Q1 (Meldung bis 15.04.)</option><option value="2">Q2 (bis 15.07.)</option><option value="3">Q3 (bis 15.10.)</option><option value="4">Q4 (bis 15.01.)</option><option value="jahr">Jahresabgleich (Jahresabschluss)</option></select></label>
          <label>Kumulierter Netto-Umsatz der Gruppe im Jahr (€)<input inputMode="decimal" value={form.kumuliert} placeholder="z. B. 812.345,00" onChange={(e) => setForm({ ...form, kumuliert: e.target.value })} /></label>
        </div><label>Beleg (z. B. „UVA Q3 vom 12.10. liegt im Dokumentenraum“)<input value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} /></label>
        <p className="cm-fein">Der Server rechnet: {p.umsatzSatzProzent} % × (kumuliert − Schwelle, im ersten Jahr anteilig) − schon abgerechnet. Positiv → Rechnung (Zahlungsziel sieben Tage); im Jahresabgleich negativ → Gutschrift (Aufgabe an Justin).</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fum${a.id}` || !form.jahr || !form.quartal || !form.kumuliert || String(form.beleg || "").trim().length < 10} onClick={() => los(`fum${a.id}`, pfad("umsatz"), form)}>Umsatz eintragen und rechnen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "verkauf" && (
        <div className="cg-form cg-form-breit"><div className="cg-raster">
          <label>Wer veräußert? (Pflicht)<select value={form.veraeusserer ?? ""} onChange={(e) => setForm({ ...form, veraeusserer: e.target.value })}><option value="">Bitte wählen</option><option value="auftraggeberin">Auftraggeberin (Marke, Betrieb, Anteile an der US-Gesellschaft)</option><option value="gesellschafter">Gesellschafter der Auftraggeberin (ihre Anteile)</option></select></label>
          <label>Zugeflossene Gegenleistung (€)<input inputMode="decimal" value={form.gegenleistung} placeholder="z. B. 2.000.000,00" onChange={(e) => setForm({ ...form, gegenleistung: e.target.value })} /></label>
          <label>Zufluss am<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
        </div><label>Beleg in einem Satz (Kaufvertrag, Zufluss — mindestens 20 Zeichen)<textarea rows={2} value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} /></label>
        <label className="cg-haken"><input type="checkbox" checked={!!form.endetUmsatz} onChange={(e) => setForm({ ...form, endetUmsatz: e.target.checked })} /> Mehr als die Hälfte der Anteile oder der Betrieb im Ganzen geht über — die Umsatzbeteiligung endet zum Quartalsende (Ziffer 11 Absatz 8)</label>
        <p className="cm-fein">Der Server rechnet {p.verkaufSatzProzent} % der Gegenleistung. Veräußert die Auftraggeberin, stellt er die Rechnung an die Firma (Zahlungsziel sieben Tage). Veräußern Gesellschafter, schulden SIE (Ziffer 12 Absatz 5): keine Rechnung an die Firma — der Teil wird nur vorgemerkt, Justin bekommt die Aufgabe. Derselbe Zufluss mit derselben Gegenleistung lässt sich nur einmal eintragen. Bei einem Teilverkauf läuft die Umsatzbeteiligung weiter.</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `fv${a.id}` || !form.veraeusserer || !form.gegenleistung || !form.am || String(form.beleg || "").trim().length < 20} onClick={() => los(`fv${a.id}`, pfad("verkauf"), form)}>{form.veraeusserer === "gesellschafter" ? "Verkauf vormerken (ohne Rechnung)" : "Verkauf eintragen und rechnen"}</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "kuendigung" && (
        <div className="cg-form"><div className="cg-raster">
          <label>Wer kündigt<select value={form.seite} onChange={(e) => setForm({ ...form, seite: e.target.value })}><option value="auftraggeberin">Auftraggeberin</option><option value="fiaon">FIAON</option></select></label>
          <label>Art<select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>{!a.freigaben.kuendigung && !k.kuendigungOrdentlich && <option value="ordentlich">ordentlich (zum Laufzeitende)</option>}<option value="ausserordentlich">aus wichtigem Grund</option></select></label>
          <label>Kündigung eingegangen am (Textform)<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
          <label>{form.art === "ausserordentlich" ? "Wirksam zum (leer = Tag des Eingangs)" : "Zum (leer = frühestmöglich)"}<input type="date" value={form.zum} onChange={(e) => setForm({ ...form, zum: e.target.value })} /></label>
        </div>
        {form.art === "ausserordentlich" && (
          <label className="cg-haken"><input type="checkbox" checked={form.garantieEntfaellt !== false} onChange={(e) => setForm({ ...form, garantieEntfaellt: e.target.checked })} /> Garantie entfällt, wenn der Vertrag vor dem Fristende endet — der wichtige Grund liegt NICHT bei FIAON (Ziffer 14 Absatz 3). Haken weg, wenn FIAON den Grund gegeben hat.</label>
        )}
        <p className="cm-fein">{form.art === "ausserordentlich" ? `Aus wichtigem Grund wirkt die Kündigung zum genannten Tag. Monatsteile danach entfallen.${!a.starttag ? " Vor „Shop live“ geht nur diese Art — danach beginnt kein Wachstumsbudget mehr." : ""}` : `Ordentlich: Der Server rechnet das Laufzeitende (Mindestlaufzeit bzw. Verlängerung, ${p.kuendigungMonate} Monate vorher). Eine ordentliche Kündigung lässt die Garantie stehen.`} Den Eingang schriftlich bestätigen.</p>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `fkd${a.id}` || !form.am} onClick={() => los(`fkd${a.id}`, pfad("kuendigung"), form)}>Kündigung eintragen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}
      {offen === "zurueck" && (
        <div className="cg-form"><label>Grund<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
        <div className="cg-form-knoepfe"><button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `fz${a.id}` || String(form.grund || "").trim().length < 5} onClick={() => los(`fz${a.id}`, `/admin/global/angebote/${a.id}/zurueckziehen`, form)}>Zurückziehen</button><button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button></div></div>
      )}

      {a.verlauf.length > 0 && (
        <details className="cg-verlauf"><summary>Verlauf ({a.verlauf.length})</summary>
          <ul>{a.verlauf.slice().reverse().map((v, i) => <li key={i}><span className="cm-wann">{datumZeit(v.am)} · {v.wer}</span> {v.was}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

async function post(pfad: string, body: unknown, methode = "POST"): Promise<any> {
  return fetch(`${API}${pfad}`, { method: methode, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) })
    .then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({ ok: false, error: `Antwort ${r.status} ohne Inhalt` }))) }))
    .catch(() => ({ ok: false, error: "Keine Verbindung zum Server." }));
}

export default function ChefGlobalAngebote() {
  const { daten, fehler, neu } = useDaten<Antwort>("/admin/global/angebote");
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState<{ id: number; art: "buergin" | "meilenstein" | "garantie" | "hemmung" | "erstattung" | "ueberwiesen" | "zurueck" } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuForm, setNeuForm] = useState<{ personId: string; kunde: Record<string, string>; parameter: Record<string, string>; gueltigBis: string; hinweise: string[] }>({ personId: "", kunde: {}, parameter: {}, gueltigBis: "", hinweise: [] });

  const aktion = async (schluessel: string, pfad: string, body: unknown, methode = "POST") => {
    setBusy(schluessel); setMeldung(null);
    const r = await post(pfad, body, methode);
    setBusy(null);
    setMeldung(r.ok ? { gut: true, text: r.meldung || "Gespeichert." } : { gut: false, text: `Nicht gespeichert: ${r.error || "unbekannter Fehler"}` });
    // E-301 (Gegenprüfung 07.10.2026): auch nach einem Fehler neu laden — ein schon angelegter Teil (z. B. ein Verkauf, dessen
    // Rechnung hing) steht dann sichtbar in der Liste, statt zu einem zweiten Klick einzuladen.
    if (r.ok) { setOffen(null); setForm({}); }
    neu();
    return r;
  };

  if (fehler) return <Fehlermeldung text={fehler} erneut={neu} />;
  if (!daten) return <Geruest zeilen={4} />;
  const V = daten.vorgaben;

  const vorbelegen = async () => {
    const id = Number(neuForm.personId);
    if (!id) { setMeldung({ gut: false, text: "Bitte eine Personen-Nummer eintragen." }); return; }
    setBusy("vorbelegung"); setMeldung(null);
    const r = await fetch(`${API}/admin/global/angebote/vorbelegung?personId=${id}`, { credentials: "include" }).then((x) => x.json()).catch(() => ({ ok: false, error: "Keine Verbindung zum Server." }));
    setBusy(null);
    if (!r.ok) { setMeldung({ gut: false, text: r.error || "Die Person ließ sich nicht laden." }); return; }
    setNeuForm({ ...neuForm, kunde: Object.fromEntries(Object.entries(r.kunde || {}).map(([k, v]) => [k, String(v ?? "")])), hinweise: r.hinweise || [] });
  };
  const anlegen = async () => {
    const parameter: Record<string, number> = {};
    for (const [k, , art] of PARAM_FELDER) {
      const roh = String(neuForm.parameter[k] ?? "").replace(/\./g, "").replace(",", ".").trim();
      if (roh) parameter[k] = art === "euro" ? Math.round(Number(roh) * 100) : Math.round(Number(roh));
    }
    const r = await aktion("anlegen", "/admin/global/angebote", { personId: Number(neuForm.personId) || null, kunde: neuForm.kunde, parameter, gueltigBis: neuForm.gueltigBis || undefined });
    if (r.ok) { setNeuOffen(false); setNeuForm({ personId: "", kunde: {}, parameter: {}, gueltigBis: "", hinweise: [] }); setMeldung({ gut: true, text: `Angebot ${r.ref} angelegt. Link: ${r.link}` }); }
  };
  const kopieren = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMeldung({ gut: true, text: "Link in die Zwischenablage kopiert." }); }
    catch { setMeldung({ gut: false, text: `Kopieren ging nicht — bitte von Hand markieren: ${text}` }); }
  };

  return (
    <div className="cg-angebote" data-fiaon="global-angebote">
      {meldung && <div className={`cm-meldung ${meldung.gut ? "" : "cg-rot"}`} role="status">{meldung.text}</div>}
      <section className="cz-block">
        <header>
          <h2>Individualangebote</h2>
          <p>Ein persönliches Angebot für eine Person — Teil 1 sofort, Teil 2 erst beim Meilenstein, Bürgschaftszusage und Kreditgarantie: Kreditrahmen und Karten in der Frist, sonst alles Gezahlte zurück. Der Kunde liest und nimmt über einen signierten Link an; danach laufen Rechnung, Zahlungsseite und „Mein Auftrag“ wie bei jedem Global-Auftrag. Fassung {V.fassung}.</p>
        </header>
        {!neuOffen ? (
          <button type="button" className="cg-knopf cg-knopf-haupt cg-neu-angebot" onClick={() => setNeuOffen(true)}>Neues Individualangebot</button>
        ) : (
          <div className="cg-form cg-form-breit" aria-label="Neues Individualangebot">
            <div className="cg-zeile-form">
              <label>Personen-Nummer<input inputMode="numeric" value={neuForm.personId} onChange={(e) => setNeuForm({ ...neuForm, personId: e.target.value.replace(/\D/g, "") })} placeholder="z. B. 13411" /></label>
              <button type="button" className="cg-knopf" disabled={busy === "vorbelegung" || !neuForm.personId} onClick={vorbelegen}>Daten aus dem Antrag holen</button>
            </div>
            {neuForm.hinweise.length > 0 && <ul className="cg-hinweise">{neuForm.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
            <div className="cg-raster">
              {KUNDE_FELDER.map(([k, l]) => (
                <label key={k}>{l}<input value={neuForm.kunde[k] ?? ""} onChange={(e) => setNeuForm({ ...neuForm, kunde: { ...neuForm.kunde, [k]: e.target.value } })} /></label>
              ))}
            </div>
            <p className="cm-fein">Teile und Fristen (leer = Vorgabe der Fassung: {eur(V.parameter.teil1Cents)} + {eur(V.parameter.teil2Cents)}, {V.parameter.fristWochen} Wochen):</p>
            <div className="cg-raster">
              {PARAM_FELDER.map(([k, l, art]) => (
                <label key={k}>{l}<input inputMode="decimal" value={neuForm.parameter[k] ?? ""} placeholder={art === "euro" ? String(V.parameter[k] / 100) : String(V.parameter[k])} onChange={(e) => setNeuForm({ ...neuForm, parameter: { ...neuForm.parameter, [k]: e.target.value } })} /></label>
              ))}
              <label>Gültig bis (leer = {V.gueltigTage} Tage)<input type="date" value={neuForm.gueltigBis} onChange={(e) => setNeuForm({ ...neuForm, gueltigBis: e.target.value })} /></label>
            </div>
            <p className="cm-fein">Die Bürgin ({V.buergin.name}) und der Prüfbericht werden danach am Angebot eingetragen. Solange ein Pflichtfeld fehlt, kann der Kunde lesen, aber nicht annehmen.</p>
            <div className="cg-form-knoepfe">
              <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === "anlegen"} onClick={anlegen}>Anlegen</button>
              <button type="button" className="cg-knopf" onClick={() => setNeuOffen(false)}>Abbrechen</button>
            </div>
          </div>
        )}
      </section>

      {daten.angebote.length === 0 && <p className="cg-leer">Noch kein Individualangebot.</p>}
      {daten.angebote.map((a) => {
        // E-301: Firmenangebote haben ihren eigenen Block (Teile, Garantie, Beteiligungen, Kündigung).
        if ((a as unknown as { art?: string }).art === "firma") return <FirmaAngebotBlock key={a.id} a={a as unknown as FirmaAngebot} aktion={aktion} busy={busy} kopieren={kopieren} buerginFelder={V.buerginFelder} />;
        const t1 = a.teile.find((t) => t.nr === 1); const t2 = a.teile.find((t) => t.nr === 2);
        return (
          <section key={a.id} className={`cz-block cg-angebot cg-${a.status}`} data-angebot={a.ref}>
            <header className="cg-angebot-kopf">
              <div>
                <h3>{a.kundeName} <span className="cg-ref">{a.ref}</span></h3>
                <p className="cm-klartext">{eur(a.gesamtCents)} gesamt · Teil 1 {eur(a.parameter.teil1Cents)} sofort · Teil 2 {eur(a.parameter.teil2Cents)} beim Meilenstein · Frist {a.parameter.fristWochen} Wochen · gültig bis {datum(a.gueltigBis)}</p>
              </div>
              <span className={`cg-marke cg-marke-${a.status === "angenommen" ? "gestartet" : a.status === "offen" ? "offen" : "storniert"}`}>{STATUS_TEXT[a.status]}</span>
            </header>

            <div className="cg-links">
              {/* Endabnahme 01.10.2026: Solange der Registernachweis der Bürgin fehlt, gibt es „Link kopieren" nicht — nur die
                  Vorschau. Der Grund steht daneben; nach der Annahme hat der Kunde den Link ohnehin. */}
              {a.link && <span className="cg-linkzeile"><a href={a.link} target="_blank" rel="noreferrer">Kundenseite öffnen (Vorschau, ohne Annahme)</a>
                {a.status === "offen" && a.versandSperre
                  ? <span className="cg-rot" data-versand="gesperrt"><b>Versand gesperrt:</b> {a.versandSperre}</span>
                  : <button type="button" className="cg-knopf" onClick={() => kopieren(a.link!)}>Link kopieren</button>}
              </span>}
              <a href={a.vertragUrl} target="_blank" rel="noreferrer">{a.status === "angenommen" ? "Vertrag mit Annahmevermerk (PDF)" : "Vertrag — Entwurf (PDF)"}</a>
              {a.pruefberichtUrl && <a href={a.pruefberichtUrl} target="_blank" rel="noreferrer">Anlage 2: Prüfbericht (PDF)</a>}
              {/* Gegenprüfung 01.10.2026: Das Blatt zum eigenhändigen Unterschreiben — mit Prüfsumme dieser Fassung (§ 766 BGB). */}
              <a href={a.anlage1Url} target="_blank" rel="noreferrer">Anlage 1 zum Unterschreiben (PDF) · Prüfsumme {a.anlage1Pruefsumme.slice(0, 12)}…</a>
              {a.officeLink && <a href={a.officeLink}>Auftrag im Office ({a.auftragRef})</a>}
            </div>

            <AufrufBlock x={a.aufrufe ?? null} />

            {a.status === "offen" && (
              a.fehlt.length > 0
                ? <div className="cg-pflicht"><b>Annahme gesperrt — es fehlt:</b><ul>{a.fehlt.map((f) => <li key={f}>{f}</li>)}</ul></div>
                : <p className="cm-klartext cg-gut">Alle Pflichtfelder sind da — der Kunde kann annehmen.</p>
            )}

            <div className="cg-zwei">
              <div>
                <h4>Bürgin: {a.buergin.name}</h4>
                <p className="cm-klartext">{[a.buergin.bundesstaat, a.buergin.anschrift].filter(Boolean).join(" · ") || "—"}</p>
                <p className="cm-klartext">Register: {a.buergin.registernummer || <span className="cg-rot">fehlt</span>} · vertreten durch {a.buergin.vertreter || "—"} ({a.buergin.funktion || <span className="cg-rot">Funktion fehlt</span>}) · eigenhändig unterschrieben: {a.buergin.unterzeichnetAm ? datum(a.buergin.unterzeichnetAm) : <span className="cg-rot">offen</span>} · {a.buergin.bestaetigt ? `bestätigt${a.buergin.bestaetigtGrundlage ? ` (Grundlage: ${a.buergin.bestaetigtGrundlage})` : ""}` : <span className="cg-rot">nicht bestätigt</span>}</p>
                {a.knoepfe.aendern
                  ? <p className="cm-fein">{a.knoepfe.aendern}</p>
                  : <button type="button" className="cg-knopf cg-knopf-buergin" onClick={() => { setOffen({ id: a.id, art: "buergin" }); setForm({ ...a.buergin }); }}>Pflichtfelder der Bürgin eintragen</button>}
              </div>
              <div>
                <h4>Anlage 2: Prüfbericht</h4>
                {a.pruefbericht
                  ? <p className="cm-klartext">{a.pruefbericht.ergebnis}{a.pruefbericht.boniPunkte != null ? ` · Boni-Ampel ${a.pruefbericht.boniPunkte} Punkte (${a.pruefbericht.boniLabel})` : ""}{a.pruefbericht.sanktionen ? "" : " · Sanktionslisten: steht aus"}</p>
                  : <p className="cm-klartext cg-rot">Kein Prüfbericht — sperrt die Annahme.</p>}
                {a.status === "offen" && a.personId && <button type="button" className="cg-knopf" disabled={busy === `pb${a.id}`} onClick={() => aktion(`pb${a.id}`, `/admin/global/angebote/${a.id}/pruefbericht`, {})}>Bonitätsteil aus den Daten neu rechnen</button>}
              </div>
            </div>

            {a.status === "angenommen" && (
              <div className="cg-annahme">
                <p className="cm-klartext">Angenommen am {datumZeit(a.angenommenAm)} · IP {a.ip ?? "—"} · Prüfsumme {a.textHash?.slice(0, 16)}… · sofortiger Beginn: {a.schalter?.sofortBeginn ? "ja" : "nein"} · Jahresbetreuung: {a.schalter?.jahresbetreuung ? "ja" : "nein"}</p>
                {a.nacharbeitFehler && <p className="cm-klartext cg-rot">Nach der Annahme hing etwas: {a.nacharbeitFehler}</p>}
                {a.bestaetigungMailFehler && !a.bestaetigungMailAm && <p className="cm-klartext cg-rot">Bestätigungsmail ging nicht raus: {a.bestaetigungMailFehler}</p>}
                {a.startgespraech && <StartgespraechZeile sg={a.startgespraech} />}
                {(a.nacharbeitFehler || (a.bestaetigungMailFehler && !a.bestaetigungMailAm) || (a.startgespraech && !a.startgespraech.terminId && a.startgespraech.fehler)) && <button type="button" className="cg-knopf" disabled={busy === `nach${a.id}`} onClick={() => aktion(`nach${a.id}`, `/admin/global/angebote/${a.id}/nachholen`, {})}>Nachholen</button>}
                <div className="cm-tab-halter"><table className="cm-tab cg-teile">
                  <thead><tr><th>Teil</th><th>Betrag</th><th>Stand</th><th>Rechnung</th></tr></thead>
                  <tbody>
                    {[t1, t2].filter(Boolean).map((t) => (
                      <tr key={t!.nr}>
                        <td><b>{t!.titel}</b></td>
                        <td>{eur(t!.betragCents)}</td>
                        <td>{t!.entfallenAm ? <span className="cg-rot">entfallen — {t!.entfallenGrund}</span>
                          : t!.zahlungsstatus === "paid" ? <>bezahlt{t!.bezahltAm ? ` am ${datum(t!.bezahltAm)}` : ""}</>
                          : t!.zahlungsstatus === "cancelled" || t!.zahlungsstatus === "superseded" ? <span className="cg-rot">storniert</span>
                          : t!.bestellRef ? <>offen · fällig {datum(t!.faelligAm)}{t!.meilensteinAm ? ` · Meilenstein ${datum(t!.meilensteinAm)} (${t!.meilensteinArt === "karte" ? "Karte" : "Kapital"})` : ""}</>
                          : <span className="cm-wann">noch nicht fällig — erst beim Meilenstein</span>}</td>
                        <td>{t!.rechnungUrl ? <a href={t!.rechnungUrl} target="_blank" rel="noreferrer">{t!.rechnungsnummer ?? "Rechnung"}</a> : "—"}{t!.verwendungszweck ? <span className="cm-klartext">Zweck {t!.verwendungszweck}</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <p className="cm-klartext">Frist: {a.fristEnde ? <>vom {datum(a.fristBeginn)} bis <b>{datum(a.fristEnde)}</b>{a.fristHemmungTage ? ` (davon ${a.fristHemmungTage} Tage gehemmt)` : ""}</> : "beginnt mit dem Start (Zahlung Teil 1, ohne sofortigen Beginn nach der Widerrufsfrist)"}{a.garantieErfuelltAm ? ` · Garantie erfüllt am ${datum(a.garantieErfuelltAm)} (Kreditrahmen ${usd(a.garantieRahmenUsd ?? 0)}, ${a.garantieKarten} Karten)` : ""}{a.erstattungAusgeloestAm ? ` · Garantiefall vorgemerkt am ${datum(a.erstattungAusgeloestAm)}${a.erstattungCents != null ? ` (${eur(a.erstattungCents)} zu erstatten)` : ""}` : ""}{a.erstattetAm ? ` · überwiesen am ${datum(a.erstattetAm)} (${a.erstattungNotiz})` : ""}</p>
                <div className="cg-knoepfe cg-knoepfe-reihe">
                  <span><button type="button" className="cg-knopf cg-knopf-haupt cg-knopf-meilenstein" disabled={!!a.knoepfe.meilenstein} onClick={() => { setOffen({ id: a.id, art: "meilenstein" }); setForm({ art: "", datum: "", eingetragenAm: "", beleg: "" }); }}>Meilenstein erreicht → Rechnung Teil 2</button>{a.knoepfe.meilenstein && <span className="cm-fein">{a.knoepfe.meilenstein}</span>}</span>
                  <span><button type="button" className="cg-knopf cg-knopf-haupt" disabled={!!a.knoepfe.garantie} onClick={() => { setOffen({ id: a.id, art: "garantie" }); setForm({ erfuelltAm: "", rahmenUsd: "", karten: "", beleg: "" }); }}>Garantie erfüllt (Kreditrahmen ≥ {usd(a.parameter.kapitalZielUsd)} + {a.parameter.kartenZiel} Karten)</button>{a.knoepfe.garantie && <span className="cm-fein">{a.knoepfe.garantie}</span>}</span>
                  <span><button type="button" className="cg-knopf" disabled={!!a.knoepfe.hemmung} onClick={() => { setOffen({ id: a.id, art: "hemmung" }); setForm({ aufgefordertAm: "", erbrachtAm: "", grund: "" }); }}>Frist hemmen</button>{a.knoepfe.hemmung && <span className="cm-fein">{a.knoepfe.hemmung}</span>}</span>
                  <span><button type="button" className="cg-knopf cg-knopf-storno cg-knopf-erstattung" disabled={!!a.knoepfe.erstattung} onClick={() => { setOffen({ id: a.id, art: "erstattung" }); setForm({}); }}>Garantiefall → Erstattung {eur(a.erstattungCents ?? a.erstattungVorschau.summeCents)} vormerken</button>{a.knoepfe.erstattung && <span className="cm-fein">{a.knoepfe.erstattung}</span>}</span>
                  {a.erstattungAusgeloestAm && !a.erstattetAm && <span><button type="button" className="cg-knopf" onClick={() => { setOffen({ id: a.id, art: "ueberwiesen" }); setForm({ am: "", notiz: "" }); }}>Erstattung überwiesen</button></span>}
                </div>
              </div>
            )}

            {a.status === "offen" && <button type="button" className="cg-knopf cg-knopf-storno" onClick={() => { setOffen({ id: a.id, art: "zurueck" }); setForm({ grund: "" }); }}>Angebot zurückziehen</button>}
            {a.status === "zurueckgezogen" && <p className="cm-klartext">Zurückgezogen am {datum(a.zurueckgezogenAm)}: {a.zurueckgezogenGrund}</p>}

            {offen?.id === a.id && offen.art === "buergin" && (
              <div className="cg-form cg-form-breit">
                <div className="cg-raster">
                  {V.buerginFelder.map((f) => (
                    <label key={String(f.schluessel)} title={f.hinweis}>{f.bezeichnung}
                      <input type={f.schluessel === "unterzeichnetAm" ? "date" : "text"} value={String(form[f.schluessel] ?? "")} onChange={(e) => setForm({ ...form, [f.schluessel]: e.target.value })} />
                      <span className="cm-fein">{f.hinweis}</span>
                    </label>
                  ))}
                </div>
                <label className="cg-haken"><input type="checkbox" checked={form.bestaetigt === true} onChange={(e) => setForm({ ...form, bestaetigt: e.target.checked })} /> Bundesstaat, Anschrift und Vertretung habe ich bestätigt — womit, steht im Feld „Grundlage der Bestätigung“ (z. B. EIN-Antrag SS-4 oder Registerauszug).</label>
                <p className="cm-fein">Anlage 1 wird von Hand unterschrieben (§ 766 BGB) — das Original geht per Post an den Kunden, ein Scan in die Akte. Erst dann das Datum eintragen.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `b${a.id}`} onClick={() => aktion(`b${a.id}`, `/admin/global/angebote/${a.id}`, { buergin: form }, "PUT")}>Speichern</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "meilenstein" && (
              <div className="cg-form cg-form-breit" role="dialog" aria-label="Meilenstein eintragen">
                <div className="cg-raster">
                  <label>Was ist passiert?
                    <select value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>
                      <option value="">Bitte wählen</option>
                      <option value="kapital">Erstes Kapital an die Gesellschaft ausgezahlt</option>
                      <option value="karte">Erste Business-Kreditkarte für die Gesellschaft freigeschaltet</option>
                    </select>
                  </label>
                  <label>Am (Auszahlung bzw. Freischaltung)<input type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} /></label>
                  <label>Gesellschaft eingetragen am<input type="date" value={form.eingetragenAm} onChange={(e) => setForm({ ...form, eingetragenAm: e.target.value })} /></label>
                </div>
                <label>Beleg in einem Satz (intern — der Kunde sieht keinen Banknamen)<textarea rows={2} value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} placeholder="Zum Beispiel: Mitteilung des Instituts vom … liegt im Dokumentenraum." /></label>
                <p className="cm-fein">Danach entsteht die Rechnung über Teil 2 ({eur(a.parameter.teil2Cents)}, zahlbar binnen {a.parameter.teil2ZielTage} Tagen) und geht mit einer Mail an den Kunden.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `m${a.id}` || !form.art || !form.datum || !form.eingetragenAm || String(form.beleg || "").trim().length < 20} onClick={() => aktion(`m${a.id}`, `/admin/global/angebote/${a.id}/meilenstein`, form)}>Rechnung Teil 2 stellen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
                {String(form.beleg || "").trim().length < 20 && <p className="cm-fein">Noch {20 - String(form.beleg || "").trim().length} Zeichen bis zum Beleg.</p>}
              </div>
            )}
            {offen?.id === a.id && offen.art === "garantie" && (
              <div className="cg-form cg-form-breit" role="dialog" aria-label="Garantie erfüllt eintragen">
                {/* E-271: Garantieziel = Kreditrahmen (Kreditlinien/Darlehen zusammen, ohne Kartenlimits) UND Karten, bis zum Fristende. */}
                <div className="cg-raster">
                  <label>Vollständig erreicht am<input type="date" value={form.erfuelltAm} onChange={(e) => setForm({ ...form, erfuelltAm: e.target.value })} /></label>
                  <label>Kreditrahmen zusammen (US-Dollar, ohne Kartenlimits)<input inputMode="numeric" value={form.rahmenUsd} onChange={(e) => setForm({ ...form, rahmenUsd: e.target.value })} placeholder={String(a.parameter.kapitalZielUsd)} /></label>
                  <label>Freigeschaltete Business-Kreditkarten<input inputMode="numeric" value={form.karten} onChange={(e) => setForm({ ...form, karten: e.target.value })} placeholder={String(a.parameter.kartenZiel)} /></label>
                </div>
                <label>Belege in einem Satz (intern — der Kunde sieht keinen Banknamen)<textarea rows={2} value={form.beleg} onChange={(e) => setForm({ ...form, beleg: e.target.value })} placeholder="Zum Beispiel: Kreditzusagen und drei Kartenbestätigungen liegen im Dokumentenraum." /></label>
                <p className="cm-fein">Damit ist die Garantie aus Ziffer 3 Absatz 1 erfüllt: Fristwarnungen und Garantiefall entfallen, die Kapital-Begleitung ist am Ziel. Das Datum muss am oder vor dem Fristende ({datum(a.fristEnde)}) liegen.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `g${a.id}` || !form.erfuelltAm || !form.rahmenUsd || !form.karten || String(form.beleg || "").trim().length < 20} onClick={() => aktion(`g${a.id}`, `/admin/global/angebote/${a.id}/garantie`, form)}>Garantie erfüllt eintragen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
                {String(form.beleg || "").trim().length < 20 && <p className="cm-fein">Noch {20 - String(form.beleg || "").trim().length} Zeichen bis zum Beleg.</p>}
              </div>
            )}
            {offen?.id === a.id && offen.art === "hemmung" && (
              <div className="cg-form cg-form-breit">
                {/* Gegenprüfung 01.10.2026: Die Ruhezeit wird gerechnet, nicht getippt — Aufforderung + sieben Tage bis zur erbrachten Mitwirkung (oder bis heute). */}
                <div className="cg-raster">
                  <label>Aufforderung in Textform am<input type="date" value={form.aufgefordertAm} onChange={(e) => setForm({ ...form, aufgefordertAm: e.target.value })} /></label>
                  <label>Mitwirkung erbracht am (leer = fehlt noch)<input type="date" value={form.erbrachtAm} onChange={(e) => setForm({ ...form, erbrachtAm: e.target.value })} /></label>
                </div>
                <label>Welche Mitwirkung fehlt(e)? (mindestens 20 Zeichen — der Satz steht in der Mail an den Kunden)<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
                <p className="cm-fein">Die Frist ruht ab dem Tag nach Ablauf der Aufforderungsfrist (Aufforderung + sieben Tage) bis zum Tag der Mitwirkung — bei noch fehlender Mitwirkung bis heute; was schon gezählt ist, zählt nicht doppelt (Ziffer 6 Absatz 3). Der Kunde bekommt das neue Fristende sofort per Mail (Textform). Behörden, Institute oder wir selbst hemmen nie.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `h${a.id}` || !form.aufgefordertAm || String(form.grund || "").trim().length < 20} onClick={() => aktion(`h${a.id}`, `/admin/global/angebote/${a.id}/hemmung`, form)}>Ruhezeit eintragen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "erstattung" && (
              <div className="cg-form cg-form-breit" role="dialog" aria-label="Garantiefall vormerken">
                <p className="cm-fein"><b>Frist am {datum(a.fristEnde)} abgelaufen, ohne dass Kreditrahmen und Karten aus der Garantie vollständig erreicht sind.</b> Zu erstatten: <b>{eur(a.erstattungVorschau.summeCents)}</b> (alles Gezahlte). Teil 2: {a.erstattungVorschau.teil2Fall === "bezahlt → erstattet" ? "bezahlt — wird storniert und mit erstattet" : a.erstattungVorschau.teil2Fall === "offen → storniert" ? "Rechnung offen — wird storniert, der Kunde muss sie nicht zahlen" : a.erstattungVorschau.teil2Fall === "schon storniert" ? "schon storniert" : "noch nicht berechnet — entfällt"}. Teil 1 geht über den Storno-Weg mit Erstattung (Provisionen zurück), Justin bekommt EINE dringende Aufgabe „Erstattung veranlassen“ mit dem Gesamtbetrag und dem spätesten Datum, der Kunde eine Mail. Es wird KEIN Geld bewegt — überwiesen wird von Hand.</p>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `e${a.id}`} onClick={() => aktion(`e${a.id}`, `/admin/global/angebote/${a.id}/erstattung`, {})}>Garantiefall jetzt vormerken</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "ueberwiesen" && (
              <div className="cg-form cg-form-breit">
                <div className="cg-raster">
                  <label>Überwiesen am<input type="date" value={form.am} onChange={(e) => setForm({ ...form, am: e.target.value })} /></label>
                  <label>Bankreferenz oder Notiz<input value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} /></label>
                </div>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-haupt" disabled={busy === `u${a.id}`} onClick={() => aktion(`u${a.id}`, `/admin/global/angebote/${a.id}/erstattung-ueberwiesen`, form)}>Eintragen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {offen?.id === a.id && offen.art === "zurueck" && (
              <div className="cg-form">
                <label>Grund<textarea rows={2} value={form.grund} onChange={(e) => setForm({ ...form, grund: e.target.value })} /></label>
                <div className="cg-form-knoepfe">
                  <button type="button" className="cg-knopf cg-knopf-storno" disabled={busy === `z${a.id}` || String(form.grund || "").trim().length < 5} onClick={() => aktion(`z${a.id}`, `/admin/global/angebote/${a.id}/zurueckziehen`, form)}>Zurückziehen</button>
                  <button type="button" className="cg-knopf" onClick={() => setOffen(null)}>Abbrechen</button>
                </div>
              </div>
            )}

            {a.verlauf.length > 0 && (
              <details className="cg-verlauf"><summary>Verlauf ({a.verlauf.length})</summary>
                <ul>{a.verlauf.slice().reverse().map((v, i) => <li key={i}><span className="cm-wann">{datumZeit(v.am)} · {v.wer}</span> {v.was}</li>)}</ul>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
