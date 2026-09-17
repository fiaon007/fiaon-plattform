// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE ÖSTERREICH — DIE FIRMENBUCH-HVD-SCHNITTSTELLE DES BMJ
// (17.09.2026, E-188)
//
// Seit Januar 2025 kostenlos nach dem Informationsweiterverwendungsgesetz:
//   SOAP 1.2, https://justizonline.gv.at/jop/api/at.gv.justiz.fbw/ws
//   Kopfzeilen X-API-KEY und Content-Type: application/soap+xml;charset=UTF-8
//   SUCHEFIRMA  — FIRMENWORTLAUT mit Stern als Platzhalter
//   AUSZUG_V2   — je Firmenbuchnummer, Umfang „Kurzinformation"
//   Überlast → HTTP 429 (Schwelle nicht veröffentlicht) → nächster Anbieter.
// Schnittstellenbeschreibung v1.3 vom 22.05.2025 samt XSD gelesen.
//
// BEDINGUNGEN DES BMJ: Quellenangabe „Republik Österreich, vertreten durch das
// BMJ" ist PFLICHT und steht deshalb in jeder Antwort dieses Anbieters.
// Veränderungen sind kenntlich zu machen — wir verändern nichts, wir kürzen
// nur: Geburtsdaten der Vertreter werden NICHT weitergereicht.
//
// Aktiv nur mit JUSTIZ_FBW_API_KEY (IWG-Antrag auf JustizOnline). UNGEPRÜFT
// GEGEN DEN ECHTEN DIENST: Am Bautag gab es keinen Schlüssel — gelesen wird
// nach den Beispielantworten und dem XSD, namensraum-blind und nachsichtig.
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, type Vertreter, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere, vertreterAus } from "./typen";
import { xmlText, xmlWert, xmlWerte, xmlBloecke, xmlElemente, xmlAttribut, soapFehler } from "./xml";
import { firmenbuchnummer } from "./formate";
import { berlinToday } from "../fiaon-time";

const ENDPUNKT = "https://justizonline.gv.at/jop/api/at.gv.justiz.fbw/ws";
export const QUELLE_FIRMENBUCH = "Quelle: Firmenbuch – Republik Österreich, vertreten durch das BMJ";
const schluessel = () => process.env.JUSTIZ_FBW_API_KEY || "";

/** Der Stern ist Platzhalter der Schnittstelle — aus der Besuchereingabe fällt er heraus. */
export function suchUmschlagAT(q: string, exakt: boolean): string {
  const wort = q.replace(/[*?%]/g, " ").replace(/\s+/g, " ").trim();
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:suc="ns://firmenbuch.justiz.gv.at/Abfrage/SucheFirmaRequest">
  <soap:Header/><soap:Body><suc:SUCHEFIRMAREQUEST>
    <suc:FIRMENWORTLAUT>${xmlText(exakt ? `*${wort}*` : wort)}</suc:FIRMENWORTLAUT>
    <suc:EXAKTESUCHE>${exakt ? "true" : "false"}</suc:EXAKTESUCHE>
    <suc:SUCHBEREICH>1</suc:SUCHBEREICH>
    <suc:GERICHT></suc:GERICHT><suc:RECHTSFORM></suc:RECHTSFORM><suc:RECHTSEIGENSCHAFT></suc:RECHTSEIGENSCHAFT><suc:ORTNR></suc:ORTNR>
  </suc:SUCHEFIRMAREQUEST></soap:Body></soap:Envelope>`;
}

export function auszugUmschlag(fnr: string, stichtag: string): string {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:aus="ns://firmenbuch.justiz.gv.at/Abfrage/v2/AuszugRequest">
  <soap:Header/><soap:Body><aus:AUSZUG_V2_REQUEST>
    <aus:FNR>${xmlText(fnr)}</aus:FNR><aus:STICHTAG>${xmlText(stichtag)}</aus:STICHTAG><aus:UMFANG>Kurzinformation</aus:UMFANG>
  </aus:AUSZUG_V2_REQUEST></soap:Body></soap:Envelope>`;
}

async function rufen(xml: string, fristMs: number, signal: AbortSignal): Promise<string> {
  const res = await holen(ENDPUNKT, {
    method: "POST",
    headers: { "X-API-KEY": schluessel(), "Content-Type": "application/soap+xml;charset=UTF-8" },
    body: xml,
  }, fristMs, signal);
  if (res.status === 429 || res.status === 401 || res.status === 403) statusPruefen(res, "Firmenbuch");
  const text = (await res.text().catch(() => "")).replace(/<[^<>]*\/>/g, "");
  const fehler = soapFehler(text);
  if (fehler) throw new AnbieterFehler("antwort", `Firmenbuch: ${fehler.slice(0, 100)}`);
  statusPruefen(res, "Firmenbuch");
  return text;
}

export function firmenbuchTreffer(xml: string): Treffer[] {
  const treffer: Treffer[] = [];
  for (const e of xmlBloecke(xml, "ERGEBNIS")) {
    const fn = firmenbuchnummer(xmlWert(e, "FNR"));
    const name = xmlWert(e, "NAME");
    if (!fn || !name) continue;
    const status = xmlWert(e, "STATUS");
    const [rechtsform] = xmlBloecke(e, "RECHTSFORM");
    const [gericht] = xmlBloecke(e, "GERICHT");
    treffer.push(ohneLeere({
      id: fn, name: name.slice(0, 200),
      rechtsform: rechtsform ? xmlWert(rechtsform, "TEXT") : undefined,
      ort: sauber(xmlWert(e, "SITZ"), 80),
      register: [fn, gericht ? xmlWert(gericht, "TEXT") : undefined].filter(Boolean).join(", "),
      status: status ? status.toLowerCase().slice(0, 40) : "aktiv",
    }));
  }
  return treffer.sort((a, b) => Number(a.status !== "aktiv") - Number(b.status !== "aktiv")).slice(0, 12);
}

const aufrecht = (kopf: string) => xmlAttribut(kopf, "AUFRECHT") !== "false";
const VERTRITT = /GESCHÄFTSFÜHRER|VORSTAND|INHABER|PROKURIST|PERSÖNLICH HAFTEND|KOMPLEMENTÄR|LIQUIDATOR|ABWICKLER/i;

export function firmenbuchFirma(xml: string, fn: string): Firma | null {
  const [firma] = xmlBloecke(xml, "FIRMA");
  if (!firma) return null;
  const nameTeil = xmlElemente(firma, "FI_DKZ02").filter((e) => aufrecht(e.kopf)).pop();
  const name = nameTeil ? xmlWerte(nameTeil.inhalt, "BEZEICHNUNG").join(" ") : "";
  if (!name) return null;
  const adr = xmlElemente(firma, "FI_DKZ03").filter((e) => aufrecht(e.kopf)).pop()?.inhalt ?? "";
  const strasse = xmlWerte(adr, "STELLE").join(", ")
    || [xmlWert(adr, "STRASSE"), [xmlWert(adr, "HAUSNUMMER"), xmlWert(adr, "STIEGE"), xmlWert(adr, "TUERNUMMER")].filter(Boolean).join("/")].filter(Boolean).join(" ");
  const formTeil = xmlElemente(firma, "FI_DKZ07").filter((e) => aufrecht(e.kopf)).pop()?.inhalt ?? "";
  const sitzTeil = xmlElemente(firma, "FI_DKZ06").filter((e) => aufrecht(e.kopf)).pop()?.inhalt ?? "";

  // Personen nach ihrer Kennung (PNR), dann die aufrechten Funktionen dazu.
  const personen = new Map<string, { vorname?: string; nachname?: string; name?: string }>();
  for (const p of xmlElemente(xml, "PER")) {
    const pnr = xmlAttribut(p.kopf, "PNR");
    const n = xmlElemente(p.inhalt, "PE_DKZ02").filter((e) => aufrecht(e.kopf)).pop()?.inhalt;
    if (!pnr || !n) continue;
    const vorname = xmlWert(n, "VORNAME"), nachname = xmlWert(n, "NACHNAME");
    personen.set(pnr.trim(), {
      vorname, nachname,
      name: [xmlWert(n, "TITELVOR"), vorname, nachname, xmlWert(n, "TITELNACH")].filter(Boolean).join(" ") || xmlWerte(n, "BEZEICHNUNG").join(" "),
    });
  }
  const vertreter: Vertreter[] = [];
  for (const f of xmlElemente(xml, "FUN")) {
    const text = xmlAttribut(f.kopf, "FKENTEXT") ?? "";
    if (!VERTRITT.test(text)) continue;
    const eintraege = xmlElemente(f.inhalt, "FU_DKZ10");
    if (eintraege.length && !eintraege.some((e) => aufrecht(e.kopf) && !xmlWert(e.inhalt, "DATBIS"))) continue;
    const p = personen.get((xmlAttribut(f.kopf, "PNR") ?? "").trim());
    if (!p) continue;
    const v = vertreterAus(p.name, text.charAt(0) + text.slice(1).toLowerCase(), p.vorname && p.nachname ? p.vorname : undefined, p.vorname && p.nachname ? p.nachname : undefined);
    if (v) vertreter.push(v);
  }
  const gerichte = xmlBloecke(xml, "VOLLZ").map((v) => { const [hg] = xmlBloecke(v, "HG"); return hg ? xmlWert(hg, "TEXT") : undefined; }).filter(Boolean);

  return ohneLeere({
    name: name.slice(0, 200),
    rechtsform: xmlWert(formTeil, "TEXT"),
    registergericht: sauber(gerichte.pop(), 100),
    registernummer: fn,
    strasse: sauber(strasse, 160), plz: sauber(xmlWert(adr, "PLZ"), 10), ort: sauber(xmlWert(adr, "ORT") ?? xmlWert(sitzTeil, "SITZ"), 80),
    land: "AT",
    vertreter: vertreter.slice(0, 12),
    quelleRegister: "firmenbuch", quelleText: QUELLE_FIRMENBUCH, abgerufenAm: new Date().toISOString(),
  }) as Firma;
}

export const firmenbuch: Anbieter = {
  kennung: "firmenbuch",
  land: "AT",
  quelleText: QUELLE_FIRMENBUCH,
  proMinute: 30,
  zeitMs: 2500,
  aktiv: () => schluessel().length > 0,
  kenntId: (id) => firmenbuchnummer(id) !== null,

  async suchen(q, signal) {
    const exakt = firmenbuchTreffer(await rufen(suchUmschlagAT(q, true), 2500, signal));
    if (exakt.length || signal.aborted) return exakt;
    // Nichts Wörtliches gefunden → die phonetische Suche der Schnittstelle („Maier" findet „Mayer").
    return firmenbuchTreffer(await rufen(suchUmschlagAT(q, false), 2500, signal));
  },

  async detail(id, signal) {
    const fn = firmenbuchnummer(id);
    if (!fn) throw new AnbieterFehler("eingabe", "Keine gültige Firmenbuchnummer");
    // Stichtag = heute (Wien und Berlin teilen die Zeitzone); in der Zukunft darf er laut Schnittstelle nicht liegen.
    const xml = await rufen(auszugUmschlag(fn.replace(/^FN /, ""), berlinToday()), 8000, signal);
    return firmenbuchFirma(xml, fn);
  },
};
