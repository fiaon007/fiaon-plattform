// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE DEUTSCHLAND — handelsregister.ai (17.09.2026, E-188)
//
//   GET https://handelsregister.ai/api/v1/search-organizations?q=…&limit=…   1 Credit
//   GET https://handelsregister.ai/api/v1/fetch-organization?q={entity_id}
//       &feature=related_persons                                  5 + 2 Credits
//   Kopfzeile x-api-key · 60 Aufrufe je Minute · 1 Credit = 0,01 €
//
// DIE AGB BINDEN DEN CACHE: Ziff. 4.2 erlaubt Zwischenspeichern höchstens
// 24 Stunden. Deshalb hält die Cache-Tabelle der Route ALLES nur 24 h — eine
// Regel für alle Quellen ist einfacher zu halten als eine je Anbieter.
// Ziff. 4.3: keine maschinenlesbare Weitergabe an Dritte — die Daten gehen
// nur in den Auftrag des Kunden, der seine eigene Firma auswählt.
//
// Eine USt-IdNr. liefert der Dienst nicht. „ai_search" (+20 Credits, auch bei
// Fehlschlag berechnet) und „realtime_mode" (+10) bleiben bewusst aus.
//
// Aktiv nur mit HANDELSREGISTER_AI_KEY. UNGEPRÜFT GEGEN DEN ECHTEN DIENST: Am
// Bautag gab es keinen Schlüssel; die Felder folgen llms.txt und dem
// amtlichen SDK des Anbieters (related_persons.current[].name / .role).
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, type Vertreter, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere, vertreterAus } from "./typen";
import { rechtsformDE } from "./rechtsformen";

const BASIS = "https://handelsregister.ai/api/v1";
export const QUELLE_HRAI = "Quelle: Handelsregister (über handelsregister.ai)";
const schluessel = () => process.env.HANDELSREGISTER_AI_KEY || "";
const kenntId = (id: string) => /^[A-Za-z0-9._~-]{6,128}$/.test(id) && !/^[A-Z]{2}-[A-Za-z]{2,4}-/.test(id) && !/^CHE/i.test(id);

const gericht = (g: unknown): string | undefined => {
  const s = sauber(g, 100);
  return s ? (/gericht/i.test(s) ? s : `Amtsgericht ${s}`) : undefined;
};
const strasse = (a: any): string | undefined => sauber([a?.street, a?.house_number].filter(Boolean).join(" "), 160);
const STATUS: Record<string, string> = { ACTIVE: "aktiv", LIQUIDATION: "in Liquidation", IN_LIQUIDATION: "in Liquidation", INACTIVE: "gelöscht", DELETED: "gelöscht", TERMINATED: "gelöscht" };

export function hraiTreffer(j: any): Treffer[] {
  const liste = Array.isArray(j?.results) ? j.results : [];
  const treffer: Treffer[] = [];
  for (const z of liste) {
    if (!z?.entity_id || !z?.name) continue;
    const r = z.registration || {};
    const kern = [sauber(r.register_type, 6), sauber(r.register_number, 12)].filter(Boolean).join(" ");
    treffer.push(ohneLeere({
      id: String(z.entity_id).slice(0, 128), name: String(z.name).slice(0, 200),
      rechtsform: rechtsformDE(z.legal_form),
      ort: sauber(z.address?.city, 80), plz: sauber(z.address?.postal_code, 10),
      register: kern ? [kern, gericht(r.court)?.replace(/^Amtsgericht /, "AG ")].filter(Boolean).join(", ") : undefined,
      status: STATUS[String(z.status_normalized ?? z.status ?? "").toUpperCase()],
    }));
  }
  return treffer.sort((a, b) => Number(a.status === "gelöscht") - Number(b.status === "gelöscht")).slice(0, 12);
}

export function hraiFirma(j: any): Firma | null {
  const name = sauber(j?.name, 200);
  if (!name) return null;
  const r = j.registration || {};
  const vertreter: Vertreter[] = [];
  const personen = Array.isArray(j?.related_persons?.current) ? j.related_persons.current : [];
  for (const p of personen) {
    const rolle = p?.role?.de?.long ?? p?.role?.de?.short ?? p?.role?.label ?? p?.label ?? (typeof p?.role === "string" ? p.role : undefined);
    const v = vertreterAus(p?.name, rolle, p?.first_name, p?.last_name);
    if (v) vertreter.push(v);
  }
  return ohneLeere({
    name,
    rechtsform: rechtsformDE(j.legal_form),
    registergericht: gericht(r.court),
    registernummer: [sauber(r.register_type, 6), sauber(r.register_number, 12)].filter(Boolean).join(" ") || undefined,
    strasse: strasse(j.address), plz: sauber(j.address?.postal_code, 10), ort: sauber(j.address?.city, 80),
    land: "DE",
    website: sauber(j.contact_data?.website, 200), telefon: sauber(j.contact_data?.phone_number, 40), email: sauber(j.contact_data?.email, 160),
    zweck: sauber(j.purpose, 1200),
    vertreter: vertreter.slice(0, 12),
    quelleRegister: "handelsregister-ai", quelleText: QUELLE_HRAI, abgerufenAm: new Date().toISOString(),
  }) as Firma;
}

export const handelsregisterAi: Anbieter = {
  kennung: "handelsregister-ai",
  land: "DE",
  quelleText: QUELLE_HRAI,
  proMinute: 60,
  zeitMs: 2500,
  aktiv: () => schluessel().length > 0,
  kenntId,

  async suchen(q, signal) {
    const res = await holen(`${BASIS}/search-organizations?q=${encodeURIComponent(q)}&limit=12`, {
      headers: { "x-api-key": schluessel(), Accept: "application/json" },
    }, 2500, signal);
    statusPruefen(res, "handelsregister.ai");
    return hraiTreffer(await res.json().catch(() => null));
  },

  async detail(id, signal) {
    if (!kenntId(id)) throw new AnbieterFehler("eingabe", "Keine handelsregister.ai-Kennung");
    const res = await holen(`${BASIS}/fetch-organization?q=${encodeURIComponent(id)}&feature=related_persons`, {
      headers: { "x-api-key": schluessel(), Accept: "application/json" },
    }, 8000, signal);
    if (res.status === 404) return null;
    statusPruefen(res, "handelsregister.ai");
    return hraiFirma(await res.json().catch(() => null));
  },
};
