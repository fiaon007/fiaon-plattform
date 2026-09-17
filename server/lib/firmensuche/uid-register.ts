// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE SCHWEIZ — DAS UID-REGISTER DES BUNDESAMTS FÜR STATISTIK
// (17.09.2026, E-188)
//
// PublicServices, SOAP 1.1, ohne Anmeldung:
//   https://www.uid-wse.admin.ch/V5.0/PublicServices.svc
//   Search (anonym höchstens 30 Treffer) · GetByUID · ValidateVatNumber
//
// WARUM DIESER DIENST IN DER SCHWEIZ VORN STEHT: Er antwortet auf eine
// Namenssuche meist in 0,3–2,1 s (gemessen 17.09.2026, acht Abrufe; ein
// Ausreißer über 2,5 s) — LINDAS braucht rund 6 s. Weil es Ausreißer gibt,
// darf auch dieser Aufruf nach der Frist zu Ende laufen (zeitMs 6 s): Die
// späte Antwort füllt den Cache, der nächste Tastendruck hat sie. Und
// er kennt ALLE UID-Einheiten, auch die, die nicht im Handelsregister stehen:
// Einzelunternehmen, Freiberufler, Vereine. Dazu liefert er, ob die Firma im
// MWST-Register eingetragen ist — daraus wird die MWST-Nummer.
//
// Ein Limit je Minute ist laut Schnittstellenbeschreibung 5.0 möglich
// (Fehler „Request_limit_exceeded"), der Wert ist nicht veröffentlicht. Der
// Eimer unten ist deshalb vorsichtig gewählt.
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere } from "./typen";
import { xmlText, xmlWert, soapFehler } from "./xml";
import { rechtsformCH } from "./rechtsformen";
import { uidAusZiffern, uidZiffern, handelsregisteramt } from "./formate";

const ENDPUNKT = "https://www.uid-wse.admin.ch/V5.0/PublicServices.svc";
const AKTION = "http://www.uid.admin.ch/xmlns/uid-wse/IPublicServices/";
export const QUELLE_UID = "Quelle: UID-Register, Bundesamt für Statistik (BFS)";

const umschlag = (inhalt: string) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:uid="http://www.uid.admin.ch/xmlns/uid-wse" xmlns:p="http://www.uid.admin.ch/xmlns/uid-wse/5" xmlns:s="http://www.uid.admin.ch/xmlns/uid-wse-shared/2" xmlns:e="http://www.ech.ch/xmlns/eCH-0097/5">
  <soap:Body>${inhalt}</soap:Body>
</soap:Envelope>`;

export function suchUmschlag(q: string): string {
  return umschlag(`<uid:Search>
    <uid:searchParameters><p:uidEntitySearchParameters><p:organisationName>${xmlText(q)}</p:organisationName></p:uidEntitySearchParameters></uid:searchParameters>
    <uid:config><s:searchMode>Auto</s:searchMode><s:maxNumberOfRecords>30</s:maxNumberOfRecords><s:searchNameAndAddressHistory>false</s:searchNameAndAddressHistory></uid:config>
  </uid:Search>`);
}

async function rufen(operation: string, xml: string, fristMs: number, signal?: AbortSignal): Promise<string> {
  const res = await holen(ENDPUNKT, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${AKTION}${operation}"` },
    body: xml,
  }, fristMs, signal);
  const text = await res.text().catch(() => "");
  const fehler = soapFehler(text);
  if (fehler) {
    if (/Request_limit_exceeded/i.test(text)) throw new AnbieterFehler("drossel", "UID-Register: Limit erreicht");
    throw new AnbieterFehler("antwort", `UID-Register: ${fehler.slice(0, 100)}`);
  }
  statusPruefen(res, "UID-Register");
  return text;
}

// UID-Status nach eCH-0108: 1 provisorisch · 2 in Reaktivierung · 3 definitiv ·
// 4 in Mutation · 5 gelöscht · 6 definitiv gelöscht · 7 annulliert.
const LEBT = new Set(["1", "2", "3", "4"]);

interface Einheit { uid: string; name: string; status: string; firma: Firma }

/** Eine Einheit aus ihrem XML-Stück. Die Feldnamen sind im Stück eindeutig — deshalb genügt xmlWert. */
export function einheitLesen(stueck: string): Einheit | null {
  const uid = uidAusZiffern(xmlWert(stueck, "uidOrganisationId"));
  const name = xmlWert(stueck, "organisationLegalName") ?? xmlWert(stueck, "organisationName");
  if (!uid || !name) return null;
  const strasse = [xmlWert(stueck, "street"), xmlWert(stueck, "houseNumber")].filter(Boolean).join(" ");
  const imHr = xmlWert(stueck, "commercialRegisterStatus") === "2";
  const mwstAktiv = xmlWert(stueck, "vatStatus") === "2" && xmlWert(stueck, "vatEntryStatus") === "1";
  const firma = ohneLeere({
    name: name.slice(0, 200),
    rechtsform: rechtsformCH(xmlWert(stueck, "legalForm")),
    registergericht: imHr ? handelsregisteramt(xmlWert(stueck, "cantonAbbreviation")) : undefined,
    registernummer: uid,
    strasse: sauber(strasse, 160),
    plz: sauber(xmlWert(stueck, "swissZipCode"), 10),
    ort: sauber(xmlWert(stueck, "town"), 80),
    land: "CH",
    ustId: mwstAktiv ? `${uid} MWST` : undefined,
    quelleRegister: "uid-register", quelleText: QUELLE_UID, abgerufenAm: new Date().toISOString(),
  }) as Firma;
  return { uid, name: firma.name, status: xmlWert(stueck, "uidregStatusEnterpriseDetail") ?? "", firma };
}

export function trefferLesen(xml: string): Treffer[] {
  const stuecke = xml.split(/<(?:[\w.-]+:)?uidEntitySearchResultItem[\s>]/).slice(1);
  const treffer: Treffer[] = [];
  const gesehen = new Set<string>();
  for (const stueck of stuecke) {
    const e = einheitLesen(stueck);
    if (!e || gesehen.has(e.uid) || !LEBT.has(e.status)) continue;
    gesehen.add(e.uid);
    treffer.push(ohneLeere({
      id: e.uid, name: e.name, rechtsform: e.firma.rechtsform, ort: e.firma.ort, plz: e.firma.plz,
      register: e.uid, status: e.status === "1" ? "provisorisch" : "aktiv",
    }));
  }
  return treffer.slice(0, 12);
}

export const uidRegister: Anbieter = {
  kennung: "uid-register",
  land: "CH",
  quelleText: QUELLE_UID,
  proMinute: 20,
  zeitMs: 6000,
  aktiv: () => true,
  kenntId: (id) => uidAusZiffern(id) !== null,

  async suchen(q, signal) {
    return trefferLesen(await rufen("Search", suchUmschlag(q), 6000, signal));
  },

  async detail(id, signal) {
    const uid = uidAusZiffern(id);
    if (!uid) throw new AnbieterFehler("eingabe", "Keine gültige UID");
    const xml = await rufen("GetByUID", umschlag(`<uid:GetByUID><uid:uid>
      <e:uidOrganisationIdCategorie>CHE</e:uidOrganisationIdCategorie><e:uidOrganisationId>${xmlText(uidZiffern(uid))}</e:uidOrganisationId>
    </uid:uid></uid:GetByUID>`), 5000, signal);
    return einheitLesen(xml)?.firma ?? null;
  },
};

/** MWST-Nummer prüfen: true = aktiv im MWST-Register, false = nicht (oder gelöscht). Name/Anschrift liefert GetByUID. */
export async function mwstPruefen(uid: string, signal?: AbortSignal): Promise<{ gueltig: boolean; firma: Firma | null }> {
  const sauberUid = uidAusZiffern(uid);
  if (!sauberUid) throw new AnbieterFehler("eingabe", "Keine gültige UID");
  const xml = await rufen("ValidateVatNumber", umschlag(`<uid:ValidateVatNumber><uid:vatNumber>${xmlText(sauberUid)}</uid:vatNumber></uid:ValidateVatNumber>`), 6000, signal);
  const gueltig = xmlWert(xml, "ValidateVatNumberResult") === "true";
  const firma = await uidRegister.detail(sauberUid, signal ?? new AbortController().signal).catch(() => null);
  return { gueltig, firma };
}
