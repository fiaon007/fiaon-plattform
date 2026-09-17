// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — USt-IdNr. PRÜFEN (17.09.2026, E-188)
//
// VIES-REST der EU-Kommission, schlüsselfrei:
//   GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{LAND}/vat/{NR}
//   · Österreich liefert Name UND Anschrift (am 17.09.2026 getestet).
//   · Deutschland liefert nur gültig/ungültig — Name und Anschrift kommen als
//     „---". Oft antwortet der deutsche Knoten gar nicht („MS_UNAVAILABLE",
//     „MS_MAX_CONCURRENT_REQ"): Dann ist das Ergebnis NULL, nicht „ungültig".
//   · Die Schweiz ist nicht in VIES → UID-Register (ValidateVatNumber).
// VIES ist langsam: gemessen 10–13 s je Abruf. Deshalb 15 s Frist — die
// Prüfung läuft neben dem Auftrag her und hält ihn nie auf.
//
// BZSt eVatR wird bewusst NICHT benutzt: Die Abfrage verlangt eine eigene
// deutsche USt-IdNr. des Anfragenden, und deutsche Nummern lassen sich dort
// regulär gar nicht anfragen.
// ═══════════════════════════════════════════════════════════════════════════
import { AnbieterFehler, holen, sauber } from "./typen";
import { ustIdErkennen } from "./formate";
import { mwstPruefen } from "./uid-register";

export interface UstIdErgebnis {
  gueltig: boolean | null;
  name?: string;
  anschrift?: string;
  quelle: "VIES" | "UID-Register";
}

/** Die VIES-Antwort deuten. Nur „VALID"/„INVALID" sind Aussagen — alles andere heißt „weiß nicht". */
export function viesDeuten(j: any): UstIdErgebnis {
  const lage = String(j?.userError ?? "").toUpperCase();
  const gueltig = lage === "VALID" || (lage === "" && j?.isValid === true) ? true : lage === "INVALID" ? false : null;
  const echt = (v: unknown) => { const s = sauber(String(v ?? "").replace(/\n/g, ", "), 240); return s && !/^-+$/.test(s) ? s : undefined; };
  const raus: UstIdErgebnis = { gueltig, quelle: "VIES" };
  if (gueltig) {
    const name = echt(j?.name), anschrift = echt(j?.address);
    if (name) raus.name = name;
    if (anschrift) raus.anschrift = anschrift;
  }
  return raus;
}

export async function ustIdPruefen(roh: unknown, signal?: AbortSignal): Promise<UstIdErgebnis> {
  const erkannt = ustIdErkennen(roh);
  if (!erkannt) throw new AnbieterFehler("eingabe", "Bitte eine USt-IdNr. im Format DE123456789, ATU12345678 oder CHE-123.456.789 angeben.");

  if (erkannt.land === "CH") {
    try {
      const { gueltig, firma } = await mwstPruefen(erkannt.nummer, signal);
      const anschrift = firma ? [firma.strasse, [firma.plz, firma.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
      return { gueltig, ...(firma?.name ? { name: firma.name } : {}), ...(anschrift ? { anschrift } : {}), quelle: "UID-Register" };
    } catch {
      return { gueltig: null, quelle: "UID-Register" };
    }
  }

  // „DE811128135" → ms/DE/vat/811128135 · „ATU14189108" → ms/AT/vat/U14189108
  const nummer = erkannt.nummer.slice(2);
  try {
    const res = await holen(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${erkannt.land}/vat/${encodeURIComponent(nummer)}`,
      { headers: { Accept: "application/json" } }, 15_000, signal);
    if (!res.ok) return { gueltig: null, quelle: "VIES" };
    return viesDeuten(await res.json().catch(() => null));
  } catch {
    return { gueltig: null, quelle: "VIES" };
  }
}
