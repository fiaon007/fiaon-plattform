// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE DEUTSCHLAND — openregister.de (17.09.2026, E-188)
//
// Deutschland hat keine amtliche Schnittstelle zum Handelsregister, und das
// Portal handelsregister.de darf nicht ausgelesen werden (Nutzungsordnung:
// 60 Abrufe je Stunde für die ganze Server-Adresse, Sperre, §§ 303a/b StGB).
// Eine echte Trefferliste gibt es deshalb nur über einen Schlüssel-Anbieter.
//
// openregister.de (Doku gelesen am 17.09.2026, https://docs.openregister.de):
//   GET https://api.openregister.de/v1/autocomplete/company?query=…  1 Credit
//   GET https://api.openregister.de/v1/company/{company_id}         10 Credits
//   Kopfzeile Authorization: Bearer <Schlüssel> · Free: 500 Credits im Monat
//   402 = Guthaben leer, 429 = zu schnell → der nächste Anbieter ist dran.
// Die Details bringen Vertreter mit Vor- und Nachname und — wo der Anbieter
// sie auf der Firmen-Website gefunden hat — Website, Telefon und USt-IdNr.
//
// Aktiv nur mit OPENREGISTER_API_KEY. UNGEPRÜFT GEGEN DEN ECHTEN DIENST: Am
// Bautag gab es keinen Schlüssel; gelesen wird nach der OpenAPI-Beschreibung
// 2.5.0 und nachsichtig.
// ═══════════════════════════════════════════════════════════════════════════
import { type Anbieter, type Firma, type Treffer, type Vertreter, AnbieterFehler, holen, statusPruefen, sauber, ohneLeere, vertreterAus } from "./typen";
import { rechtsformDE } from "./rechtsformen";
import { ustIdDE } from "./formate";

const BASIS = "https://api.openregister.de/v1";
export const QUELLE_OPENREGISTER = "Quelle: Handelsregister (über openregister.de)";
const schluessel = () => process.env.OPENREGISTER_API_KEY || "";
/** Kennungen sehen aus wie „DE-HRB-F1103-267645". */
const kenntId = (id: string) => /^[A-Z]{2}-[A-Za-z]{2,4}-[\w.-]{1,60}$/.test(id);

/** openregister nennt das Gericht ohne „Amtsgericht": „Berlin (Charlottenburg)". */
const gericht = (g: unknown): string | undefined => {
  const s = sauber(g, 100);
  return s ? (/gericht/i.test(s) ? s : `Amtsgericht ${s}`) : undefined;
};
const registerText = (art: unknown, nr: unknown, g: unknown): string | undefined => {
  const kern = [sauber(art, 6), sauber(nr, 12)].filter(Boolean).join(" ");
  return kern ? [kern, gericht(g)?.replace(/^Amtsgericht /, "AG ")].filter(Boolean).join(", ") : undefined;
};

function ortOderNichts(roh: unknown): string | undefined {
  const o = sauber(roh, 80);
  return o && !o.includes(":") && o.length <= 50 ? o : undefined;
}

export function openregisterTreffer(j: any): Treffer[] {
  const liste = Array.isArray(j?.results) ? j.results : [];
  const treffer: Treffer[] = [];
  for (const z of liste) {
    if (!z?.company_id || !z?.name) continue;
    treffer.push(ohneLeere({
      id: String(z.company_id).slice(0, 80), name: String(z.name).slice(0, 200),
      rechtsform: rechtsformDE(z.legal_form),
      // Live-Test 17.09.2026: openregister liefert bei einzelnen Einträgen Registertext im
      // Ortsfeld („Errichtet: HARIBO Service-GmbH"). Ein Ort hat keinen Doppelpunkt.
      ort: ortOderNichts(z.address?.city), plz: sauber(z.address?.postal_code, 10),
      register: registerText(z.register_type, z.register_number, z.register_court),
      status: z.active === false ? "gelöscht" : z.active === true ? "aktiv" : undefined,
    }));
  }
  // Aktive zuerst — gelöschte Vorgänger gleichen Namens sollen nicht oben stehen.
  return treffer.sort((a, b) => Number(a.status === "gelöscht") - Number(b.status === "gelöscht")).slice(0, 12);
}

export function openregisterFirma(j: any): Firma | null {
  const name = sauber(j?.name?.name ?? j?.name, 200);
  if (!name) return null;
  const vertreter: Vertreter[] = [];
  for (const r of Array.isArray(j?.representation) ? j.representation : []) {
    if (r?.end_date) continue;
    const v = vertreterAus(r?.name, r?.role_detail?.label_de ?? r?.role, r?.natural_person?.first_name, r?.natural_person?.last_name);
    if (v) vertreter.push(v);
  }
  const reg = j?.register || {};
  return ohneLeere({
    name,
    rechtsform: rechtsformDE(j?.legal_form ?? j?.name?.legal_form),
    registergericht: gericht(reg.register_court),
    registernummer: [sauber(reg.register_type, 6), sauber(reg.register_number, 12)].filter(Boolean).join(" ") || undefined,
    strasse: sauber(j?.address?.street, 160), plz: sauber(j?.address?.postal_code, 10), ort: sauber(j?.address?.city, 80),
    land: "DE",
    ustId: ustIdDE(j?.contact?.vat_id) ?? undefined,
    website: sauber(j?.contact?.website_url, 200), telefon: sauber(j?.contact?.phone, 40), email: sauber(j?.contact?.email, 160),
    zweck: sauber(j?.purpose?.purpose, 1200),
    vertreter: vertreter.slice(0, 12),
    quelleRegister: "openregister", quelleText: QUELLE_OPENREGISTER, abgerufenAm: new Date().toISOString(),
  }) as Firma;
}

export const openregister: Anbieter = {
  kennung: "openregister",
  land: "DE",
  quelleText: QUELLE_OPENREGISTER,
  proMinute: 30,
  zeitMs: 2500,
  aktiv: () => schluessel().length > 0,
  kenntId,

  async suchen(q, signal) {
    const res = await holen(`${BASIS}/autocomplete/company?query=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${schluessel()}`, Accept: "application/json" },
    }, 2500, signal);
    statusPruefen(res, "openregister");
    return openregisterTreffer(await res.json().catch(() => null));
  },

  async detail(id, signal) {
    if (!kenntId(id)) throw new AnbieterFehler("eingabe", "Keine openregister-Kennung");
    const res = await holen(`${BASIS}/company/${encodeURIComponent(id)}?export=true`, {
      headers: { Authorization: `Bearer ${schluessel()}`, Accept: "application/json" },
    }, 6000, signal);
    if (res.status === 404) return null;
    statusPruefen(res, "openregister");
    return openregisterFirma(await res.json().catch(() => null));
  },
};
