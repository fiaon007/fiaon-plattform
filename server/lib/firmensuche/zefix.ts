// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE SCHWEIZ — ZEFIX PublicREST, DER AMTLICHE WEG (17.09.2026, E-188)
//
// https://www.zefix.admin.ch/ZefixPublicREST/api/v1 — Basic Auth. Das Konto
// ist kostenlos und wird per E-Mail an zefix@bj.admin.ch beantragt. Solange
// ZEFIX_BENUTZER und ZEFIX_PASSWORT nicht in der Umgebung stehen, ist dieser
// Anbieter „nicht aktiv" und die Reihenfolge beginnt beim UID-Register.
//
// UNGEPRÜFT GEGEN DEN ECHTEN DIENST: Am Bautag gab es kein Konto. Die Felder
// folgen der amtlichen OpenAPI-Beschreibung (Version 2.7.2.3); gelesen wird
// nachsichtig — fehlt ein Feld, bleibt es leer, die Suche bricht nicht.
//
// Das undokumentierte …/ZefixREST (ohne „Public") wird bewusst NICHT benutzt.
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere } from "./typen";
import { rechtsformCH } from "./rechtsformen";
import { uidAusZiffern, uidZiffern, handelsregisteramt } from "./formate";

const BASIS = "https://www.zefix.admin.ch/ZefixPublicREST/api/v1";
export const QUELLE_ZEFIX_REST = "Quelle: Zefix – Zentraler Firmenindex, Bundesamt für Justiz";

function ausweis(): string | null {
  const b = process.env.ZEFIX_BENUTZER, p = process.env.ZEFIX_PASSWORT;
  return b && p ? `Basic ${Buffer.from(`${b}:${p}`, "utf8").toString("base64")}` : null;
}

const STATUS: Record<string, string> = { ACTIVE: "aktiv", BEING_CANCELLED: "in Liquidation", CANCELLED: "gelöscht" };
const formText = (f: any): string | undefined => rechtsformCH(f?.uid) ?? sauber(f?.name?.de, 120);

export function zefixTreffer(liste: any): Treffer[] {
  if (!Array.isArray(liste)) return [];
  const treffer: Treffer[] = [];
  for (const z of liste) {
    const uid = uidAusZiffern(z?.uid);
    if (!uid || !z?.name || z?.status === "CANCELLED") continue;
    treffer.push(ohneLeere({
      id: uid, name: String(z.name).slice(0, 200), rechtsform: formText(z.legalForm),
      ort: sauber(z.legalSeat, 80), register: uid, status: STATUS[String(z.status)] ?? undefined,
    }));
  }
  return treffer.slice(0, 12);
}

export function zefixFirma(z: any): Firma | null {
  const uid = uidAusZiffern(z?.uid);
  if (!uid || !z?.name) return null;
  const a = z.address || {};
  return ohneLeere({
    name: String(z.name).slice(0, 200),
    rechtsform: formText(z.legalForm),
    registergericht: handelsregisteramt(z.canton),
    registernummer: uid,
    strasse: sauber([a.street, a.houseNumber].filter(Boolean).join(" "), 160),
    plz: sauber(a.swissZipCode, 10), ort: sauber(a.city ?? z.legalSeat, 80),
    land: "CH",
    zweck: sauber(z.purpose, 1200),
    quelleRegister: "zefix", quelleText: QUELLE_ZEFIX_REST, abgerufenAm: new Date().toISOString(),
  }) as Firma;
}

export const zefix: Anbieter = {
  kennung: "zefix",
  land: "CH",
  quelleText: QUELLE_ZEFIX_REST,
  proMinute: 60,
  zeitMs: 2500,
  aktiv: () => ausweis() !== null,
  kenntId: (id) => uidAusZiffern(id) !== null,

  async suchen(q, signal) {
    const a = ausweis();
    if (!a) throw new AnbieterFehler("schluessel", "Zefix: keine Zugangsdaten");
    const res = await holen(`${BASIS}/company/search`, {
      method: "POST",
      headers: { Authorization: a, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: q, activeOnly: true }),
    }, 2500, signal);
    // Zefix antwortet auf „nichts gefunden" mit 404 — das ist eine leere Liste, kein Fehler.
    if (res.status === 404) return [];
    statusPruefen(res, "Zefix");
    return zefixTreffer(await res.json().catch(() => null));
  },

  async detail(id, signal) {
    const a = ausweis();
    if (!a) throw new AnbieterFehler("schluessel", "Zefix: keine Zugangsdaten");
    const uid = uidAusZiffern(id);
    if (!uid) throw new AnbieterFehler("eingabe", "Keine gültige UID");
    const res = await holen(`${BASIS}/company/uid/CHE${uidZiffern(uid)}`, { headers: { Authorization: a, Accept: "application/json" } }, 5000, signal);
    if (res.status === 404) return null;
    statusPruefen(res, "Zefix");
    const j: any = await res.json().catch(() => null);
    return zefixFirma(Array.isArray(j) ? j[0] : j);
  },
};
