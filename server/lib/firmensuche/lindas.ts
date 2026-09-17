// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE SCHWEIZ — LINDAS, DER LINKED-DATA-DIENST DES BUNDES
// (17.09.2026, E-188)
//
// Offiziell, schlüsselfrei, frei lizenziert (opendata.swiss, Quellenangabe
// Pflicht): POST https://lindas.admin.ch/query, Graph …/foj/zefix — der
// tagesaktuelle Zefix-Bestand, rund 790.000 Rechtseinheiten.
//
// GEMESSEN AM 17.09.2026:
//   · Detail über die UID (Indexzugriff):            0,3–0,4 s
//   · Namenssuche per CONTAINS/REGEX/STRSTARTS:      4,3–6,3 s (seltene Namen; häufige sind dank LIMIT schneller)
// Der Dienst hat keinen Volltextindex (weder die Stardog- noch die
// Jena-Textsuche antwortet); jede Namenssuche liest alle Firmennamen. Für
// eine Suche-beim-Tippen mit 2,5 s Frist ist das zu langsam. Deshalb steht in
// der Reihenfolge das UID-Register VOR LINDAS; LINDAS ist der Rückfall und
// darf im Hintergrund zu Ende laufen (zeitMs über der Gesamtfrist) — die
// späte Antwort füllt den Cache für den nächsten Tastendruck.
//
// Das undokumentierte www.zefix.admin.ch/ZefixREST wird bewusst NICHT benutzt.
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere } from "./typen";
import { rechtsformCH } from "./rechtsformen";
import { uidAusZiffern, uidZiffern, handelsregisteramt } from "./formate";

const ENDPUNKT = "https://lindas.admin.ch/query";
const GRAPH = "https://lindas.admin.ch/foj/zefix";
/** Über der Gesamtfrist der Suche — die späte Antwort füllt den Cache (siehe Kopf). */
const ZEIT_MS = 9000;
export const QUELLE_ZEFIX = "Quelle: Zefix – Zentraler Firmenindex, Bundesamt für Justiz (über LINDAS, opendata.swiss)";

/**
 * Besuchereingabe als SPARQL-Zeichenkette.
 *
 * SPARQL löst Codepunkt-Fluchten (Rückstrich-u plus vier Hexziffern) auf,
 * BEVOR die Grammatik liest — ein eingeschleuster Rückstrich könnte so ein
 * Anführungszeichen erzeugen und das Literal beenden. Firmennamen enthalten
 * keine Rückstriche; sie fallen deshalb ganz weg, statt verdoppelt zu werden.
 * Übrig bleibt genau ein Zeichen mit Bedeutung: das Anführungszeichen.
 */
export function sparqlLiteral(roh: string): string {
  const s = String(roh ?? "")
    .replace(/\\/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/"/g, '\\"');
  return `"${s}"`;
}

/**
 * Bis zu vier Wörter, jedes muss im Namen vorkommen — „Bäckerei Müller" findet auch „Müller Bäckerei AG".
 *
 * Die Namenssuche steht in einer UNTERABFRAGE mit eigenem LIMIT: Erst die (teure) Suche über alle Namen, dann
 * zu den höchstens 20 Funden UID, Rechtsform und Ort. In EINEM Muster geschrieben ordnet der Dienst die
 * Verknüpfungen ungünstig und braucht über 9 s statt rund 6 s (gemessen 17.09.2026).
 */
export function suchAbfrage(q: string): string {
  const woerter = q.toLowerCase().split(" ").filter((w) => w.length >= 2).slice(0, 4);
  const teile = (woerter.length ? woerter : [q.toLowerCase()]).map((w) => `CONTAINS(LCASE(?name), ${sparqlLiteral(w)})`);
  return `PREFIX schema: <http://schema.org/>
SELECT ?name ?form ?ort ?plz ?uid FROM <${GRAPH}> WHERE {
  { SELECT ?firma ?name WHERE { ?firma schema:legalName ?name . FILTER(${teile.join(" && ")}) } LIMIT 20 }
  ?firma schema:identifier ?i . ?i schema:name "CompanyUID" ; schema:value ?uid .
  OPTIONAL { ?firma schema:additionalType ?form }
  OPTIONAL { ?firma schema:address ?a . OPTIONAL { ?a schema:addressLocality ?ort } OPTIONAL { ?a schema:postalCode ?plz } }
} LIMIT 60`;
}

export function detailAbfrage(uid: string): string {
  return `PREFIX schema: <http://schema.org/>
SELECT ?name ?form ?strasse ?plz ?ort ?kanton ?zweck FROM <${GRAPH}> WHERE {
  ?i schema:value ${sparqlLiteral(`CHE${uidZiffern(uid)}`)} ; schema:name "CompanyUID" .
  ?firma schema:identifier ?i ; schema:legalName ?name .
  OPTIONAL { ?firma schema:additionalType ?form }
  OPTIONAL { ?firma schema:description ?zweck }
  OPTIONAL { ?firma schema:address ?a .
    OPTIONAL { ?a schema:streetAddress ?strasse } OPTIONAL { ?a schema:postalCode ?plz }
    OPTIONAL { ?a schema:addressLocality ?ort } OPTIONAL { ?a schema:addressRegion ?kanton } }
} LIMIT 3`;
}

async function abfragen(sparql: string, fristMs: number, signal: AbortSignal): Promise<Record<string, string>[]> {
  const res = await holen(ENDPUNKT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
    body: new URLSearchParams({ query: sparql }).toString(),
  }, fristMs, signal);
  statusPruefen(res, "LINDAS");
  const j: any = await res.json().catch(() => null);
  const zeilen = j?.results?.bindings;
  if (!Array.isArray(zeilen)) throw new AnbieterFehler("antwort", "LINDAS: unlesbare Antwort");
  return zeilen.map((b: any) => Object.fromEntries(Object.entries(b).map(([k, v]: [string, any]) => [k, String(v?.value ?? "")])));
}

/** Treffer ordnen: Namen, die mit der Eingabe BEGINNEN, zuerst; dann kurze vor langen. */
export function trefferOrdnen(treffer: Treffer[], q: string): Treffer[] {
  const s = q.toLowerCase();
  const rang = (t: Treffer) => (t.name.toLowerCase().startsWith(s) ? 0 : 1);
  return [...treffer].sort((a, b) => rang(a) - rang(b) || a.name.length - b.name.length || a.name.localeCompare(b.name, "de"));
}

export const lindas: Anbieter = {
  kennung: "lindas",
  land: "CH",
  quelleText: QUELLE_ZEFIX,
  proMinute: 12,
  zeitMs: ZEIT_MS,
  aktiv: () => true,
  kenntId: (id) => uidAusZiffern(id) !== null,

  async suchen(q, signal) {
    const zeilen = await abfragen(suchAbfrage(q), ZEIT_MS, signal);
    const gesehen = new Set<string>();
    const treffer: Treffer[] = [];
    for (const z of zeilen) {
      const uid = uidAusZiffern(z.uid);
      if (!uid || gesehen.has(uid) || !z.name) continue;
      gesehen.add(uid);
      treffer.push(ohneLeere({
        id: uid, name: z.name.slice(0, 200), rechtsform: rechtsformCH(z.form),
        ort: sauber(z.ort, 80), plz: sauber(z.plz, 10), register: uid,
      }));
    }
    return trefferOrdnen(treffer, q).slice(0, 12);
  },

  async detail(id, signal) {
    const uid = uidAusZiffern(id);
    if (!uid) throw new AnbieterFehler("eingabe", "Keine gültige UID");
    const [z] = await abfragen(detailAbfrage(uid), 5000, signal);
    if (!z?.name) return null;
    return ohneLeere({
      name: z.name.slice(0, 200),
      rechtsform: rechtsformCH(z.form),
      registergericht: handelsregisteramt(z.kanton),
      registernummer: uid,
      strasse: sauber(z.strasse, 160), plz: sauber(z.plz, 10), ort: sauber(z.ort, 80),
      land: "CH",
      zweck: sauber(z.zweck, 1200),
      quelleRegister: "lindas", quelleText: QUELLE_ZEFIX, abgerufenAm: new Date().toISOString(),
    }) as Firma;
  },
};
