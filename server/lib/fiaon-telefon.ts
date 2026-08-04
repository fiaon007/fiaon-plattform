// ═══════════════════════════════════════════════════════════════════════════
// FIAON Telefonnummern — die wählbare Form, an EINER Stelle
//
// Das Problem, das Agenten gemeldet haben: In „Heute" fehlte beim Anrufen die
// Ländervorwahl. Gemessen: von 4.521 Personen hatten 2.058 eine Nummer OHNE
// „+" — obwohl in der zugehörigen Bestellung `phone_country_code = '+49'`
// danebenstand. Die Vorwahl war da, sie wurde nur nie mit der Nummer
// zusammengesetzt. Ein `tel:`-Link auf „1711790779" wählt nichts Sinnvolles:
// das Telefon versucht eine Ortsnummer im eigenen Netz.
//
// REGELN, in dieser Reihenfolge:
//   1. Steht schon ein „+" davor → übernehmen (nur Leerzeichen entfernen).
//   2. Getrennte Vorwahl vorhanden (`phone_country_code`) → zusammensetzen,
//      dabei die nationale Null verwerfen (+49 + 0171… wäre falsch).
//   3. Nummer beginnt mit „00" → „00" ist die alte Schreibweise für „+".
//   4. Land bekannt (DE/AT/CH …) → Vorwahl dieses Landes davor.
//   5. Sonst: NICHT wählbar. Dann wird die Nummer angezeigt, aber nicht
//      verlinkt, und die Oberfläche sagt „Vorwahl fehlt".
//
// Punkt 5 ist bewusst so: Eine geratene Vorwahl wählt einen fremden Menschen
// an. Lieber ein ehrlicher Hinweis als ein Anruf beim falschen Teilnehmer.
// ═══════════════════════════════════════════════════════════════════════════

/** Ländervorwahlen der Märkte, in denen FIAON tatsächlich arbeitet. */
const LAND_VORWAHL: Record<string, string> = {
  DE: "49", DEUTSCHLAND: "49", GERMANY: "49",
  AT: "43", OESTERREICH: "43", "ÖSTERREICH": "43", AUSTRIA: "43",
  CH: "41", SCHWEIZ: "41", SWITZERLAND: "41",
  LU: "352", LI: "423", NL: "31", BE: "32", FR: "33", IT: "39", ES: "34",
  PL: "48", CZ: "420", HU: "36", HR: "385", BG: "359", RO: "40", GR: "30",
  DK: "45", SE: "46", NO: "47", FI: "358", PT: "351", IE: "353", GB: "44", UK: "44",
};

export interface WaehlbareNummer {
  /** Anzeigeform, z. B. „+49 171 1790779" — nie leer, wenn irgendeine Nummer da ist. */
  anzeige: string | null;
  /** Für `tel:` — nur gesetzt, wenn die Nummer wirklich wählbar ist. */
  waehlbar: string | null;
  /** Warum nicht wählbar? Klartext für die Oberfläche. */
  hinweis: string | null;
}

const LEER: WaehlbareNummer = { anzeige: null, waehlbar: null, hinweis: null };

function ziffern(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Gruppiert eine E.164-Nummer lesbar: +49 171 1790779. */
function lesbar(e164: string): string {
  const d = e164.replace(/^\+/, "");
  // Vorwahl bestimmen (1–3 Stellen) über die bekannte Liste, sonst zwei Stellen.
  const codes = Array.from(new Set(Object.values(LAND_VORWAHL))).sort((a, b) => b.length - a.length);
  const code = codes.find((c) => d.startsWith(c)) || d.slice(0, 2);
  const rest = d.slice(code.length);
  if (rest.length <= 4) return `+${code} ${rest}`;
  return `+${code} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

/**
 * Ermittelt die wählbare Nummer aus allem, was an einer Person/Bestellung steht.
 *
 * `quellen` wird in der übergebenen Reihenfolge geprüft — die erste brauchbare
 * gewinnt. Übergib die spezifischste zuerst (z. B. die Nummer der Bestellung
 * vor der Sammelnummer der Person).
 */
export function waehlbareNummer(
  quellen: Array<{ nummer?: unknown; vorwahl?: unknown }>,
  land?: unknown,
): WaehlbareNummer {
  const landCode = String(land ?? "").trim().toUpperCase();
  const landVorwahl = LAND_VORWAHL[landCode] || null;
  let ohneVorwahl: string | null = null;

  for (const q of quellen) {
    const roh = String(q.nummer ?? "").trim();
    if (!roh) continue;
    const d = ziffern(roh);
    if (d.length < 6) continue; // Fragment, keine Rufnummer

    // 1. Bereits internationale Form
    if (roh.startsWith("+")) {
      const e164 = `+${d}`;
      return { anzeige: lesbar(e164), waehlbar: e164, hinweis: null };
    }

    // 2. Getrennte Vorwahl vorhanden
    const vw = ziffern(q.vorwahl);
    if (vw) {
      const national = d.replace(/^0+/, "");
      const e164 = `+${vw}${national}`;
      return { anzeige: lesbar(e164), waehlbar: e164, hinweis: null };
    }

    // 3. Alte Auslandsschreibweise 00…
    if (d.startsWith("00")) {
      const e164 = `+${d.slice(2)}`;
      return { anzeige: lesbar(e164), waehlbar: e164, hinweis: null };
    }

    // 4. Land bekannt → Vorwahl des Landes
    if (landVorwahl) {
      const e164 = `+${landVorwahl}${d.replace(/^0+/, "")}`;
      return { anzeige: lesbar(e164), waehlbar: e164, hinweis: null };
    }

    // 5. Nummer merken, aber nicht wählbar machen
    if (!ohneVorwahl) ohneVorwahl = roh;
  }

  if (ohneVorwahl) {
    return {
      anzeige: ohneVorwahl,
      waehlbar: null,
      hinweis: "Ländervorwahl fehlt — bitte in der Akte ergänzen, dann ist die Nummer wählbar.",
    };
  }
  return LEER;
}

/** Kurzform, wenn nur eine Zeile (Bestellung oder Person) vorliegt. */
export function nummerAusZeile(row: any): WaehlbareNummer {
  return waehlbareNummer(
    [
      { nummer: row?.phone, vorwahl: row?.phone_country_code },
      { nummer: row?.primary_phone },
      { nummer: row?.contact_phone },
      { nummer: row?.telefon },
    ],
    row?.country,
  );
}
