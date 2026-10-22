// ═══════════════════════════════════════════════════════════════════════════
// DIE STATIONEN DES FAHRPLANS — Werte, Prüfung, Anzeige (22.10.2026)
//
// Justin: „die Schritte (Stationen) wie ITIN, D-U-N-S, EIN müssen besser
//          aussehen und wir müssen die echten Werte eintragen können — nicht
//          nur einen Status im Dropdown wählen. 100 % funktional."
//
// Jede Station des Fahrplans (GLOBAL_FAHRPLAN in fiaon-global-mandat.ts) hat
// hier ihre eigenen Felder. Diese Datei ist REIN — keine Datenbank, kein Netz,
// das „heute“ kommt als Parameter. Sie ist die EINE Stelle für:
//
//   · welche Felder eine Station hat (Chefbüro- und Office-Editor rendern daraus),
//   · wie jeder Wert geprüft und geschrieben wird (der Server prüft hiermit —
//     die Oberfläche zeigt dieselbe Meldung schon beim Tippen),
//   · was der Kunde davon sieht (globalPlusFuerKunde — die Wand gegen Interna:
//     verschlüsselte ITIN, Kontoinstitut, Name des Registered-Agent-Anbieters),
//   · welche Zeilen das Portal unter einer Station zeigt,
//   · welcher Satz in den Verlauf des Kunden geht („Ihre ITIN ist da.“).
//
// Speicherorte (keine neue Tabelle):
//   gesellschaft       Name, Form, Bundesstaat, Gründungstag (über globalGesellschaftSetzen — setzt die Fristen)
//   gesellschaft_plus  Registernummer, EIN, ITIN (verschlüsselt), D-U-N-S, Telefon, Adressen, Konto
//   fiaon_global_kapital  Karten (je Karte eine Zeile, inhaber firma/privat), Kreditrahmen/Darlehen
//
// Die ITIN ist eine persönliche Steuernummer. Sie liegt nur verschlüsselt in
// der Akte (encryptSecret, AES-256-GCM); Listen und Editor zeigen die Maske
// •••-••-1234, der Kunde sieht sie in seinem Portal erst nach „Anzeigen“.
// ═══════════════════════════════════════════════════════════════════════════
import type { BereichSprache, GlobalGesellschaft } from "./fiaon-global-bereich";
import type { GlobalGesellschaftPlus } from "./fiaon-global-mandat";

type Paar = { de: string; en: string };

// ── FELDER JE STATION ────────────────────────────────────────────────────────
export type StationFeldArt = "text" | "mehrzeilig" | "datum" | "staat" | "form" | "ein" | "itin" | "duns" | "telefon" | "telefon_int" | "email" | "rolle";
/** Wohin ein Wert geschrieben wird: die Grunddaten der Gesellschaft (mit Fristen) oder gesellschaft_plus. */
export type StationFeldOrt = "grund" | "plus";
export interface StationFeld {
  feld: string;
  ort: StationFeldOrt;
  art: StationFeldArt;
  /** Beschriftung im Editor (das Team liest deutsch). */
  titel: string;
  /** Leiser Satz unter dem Feld. */
  hilfe?: string;
  platzhalter?: string;
  /** true = sieht nur das Team. */
  intern?: boolean;
  max?: number;
}

export const GLOBAL_STATION_FELDER: Record<string, StationFeld[]> = {
  eingetragen: [
    { feld: "name", ort: "grund", art: "text", titel: "Name der Gesellschaft", platzhalter: "MUSTER HOLDINGS LLC", max: 160 },
    { feld: "form", ort: "grund", art: "form", titel: "Rechtsform" },
    { feld: "bundesstaat", ort: "grund", art: "staat", titel: "Bundesstaat" },
    { feld: "gegruendetAm", ort: "grund", art: "datum", titel: "Gegründet am", hilfe: "Bundesstaat und Gründungstag setzen den Pflichtenkalender." },
    { feld: "aktenzeichen", ort: "plus", art: "text", titel: "State File Number", platzhalter: "z. B. 2026-001234567", max: 40 },
  ],
  // E-424 (22.10.2026): Die Kontaktperson, die Wyoming verlangt, ist eine NATÜRLICHE Person aus dem Kreis der
  // Gesellschafter oder der Geschäftsführung des Kunden — in der Regel der Inhaber selbst, NIE jemand von FIAON (Wyoming
  // hat Firmen beanstandet, bei denen Partner dieselbe Kontaktperson für viele Kunden eingetragen hatten). Vorbelegt aus
  // dem Auftrag; vertraulich, nicht öffentlich. Ihre Anschrift ist eine Wohnanschrift — keine Agent-Adresse, kein
  // virtuelles Büro, kein Postfach (der Editor warnt).
  agent: [
    { feld: "agentAdresse", ort: "plus", art: "mehrzeilig", titel: "Anschrift des Registered Agent", hilfe: "Nur die Adresse — der Name des Anbieters erscheint beim Kunden nie.", platzhalter: "30 N Gould St, Ste R\nSheridan, WY 82801", max: 300 },
    { feld: "registeredAgent", ort: "plus", art: "text", titel: "Anbieter (intern)", intern: true, max: 200 },
    { feld: "kontaktperson", ort: "plus", art: "text", titel: "Kontaktperson der Gesellschaft — Name", hilfe: "Inhaber, Gesellschafter oder Manager des Kunden — nie jemand von FIAON.", platzhalter: "Vor- und Nachname", max: 120 },
    { feld: "kontaktRolle", ort: "plus", art: "rolle", titel: "Rolle in der Gesellschaft", intern: true },
    { feld: "kontaktEmail", ort: "plus", art: "email", titel: "E-Mail der Kontaktperson", intern: true, max: 160 },
    { feld: "kontaktTelefon", ort: "plus", art: "telefon_int", titel: "Telefon der Kontaktperson", intern: true, platzhalter: "+41 79 123 45 67" },
    { feld: "kontaktAdresse", ort: "plus", art: "mehrzeilig", titel: "Wohnanschrift der Kontaktperson", intern: true, hilfe: "Wohnanschrift — keine Agent-Adresse, kein virtuelles Büro, kein Postfach. Vertraulich, nicht öffentlich.", max: 300 },
  ],
  adresse: [
    { feld: "usTelefon", ort: "plus", art: "telefon", titel: "US-Telefonnummer", platzhalter: "+1 307 555 0148", hilfe: "Wird als +1XXXXXXXXXX gespeichert." },
    { feld: "usAdresse", ort: "plus", art: "mehrzeilig", titel: "US-Geschäftsadresse", platzhalter: "412 W 17th Street, Suite 210\nCheyenne, WY 82001", max: 300 },
    { feld: "privatAdresse", ort: "plus", art: "mehrzeilig", titel: "Private US-Adresse", hilfe: "Nur, wenn der Kunde eine hat.", max: 300 },
  ],
  ein: [
    { feld: "ein", ort: "plus", art: "ein", titel: "EIN", platzhalter: "12-3456789" },
    { feld: "einBriefAm", ort: "plus", art: "datum", titel: "Bestätigungsschreiben der IRS vom", hilfe: "Das Schreiben selbst als Dokument „EIN-Bestätigung“ in den Tresor legen." },
  ],
  itin: [
    { feld: "itin", ort: "plus", art: "itin", titel: "ITIN", platzhalter: "9XX-XX-XXXX", hilfe: "Wird verschlüsselt gespeichert und überall maskiert gezeigt." },
    { feld: "itinBescheidAm", ort: "plus", art: "datum", titel: "Bescheid der IRS vom", hilfe: "Den Bescheid als Dokument „ITIN-Bescheid“ in den Tresor legen." },
  ],
  konto: [
    { feld: "kontoInstitut", ort: "plus", art: "text", titel: "Institut (intern)", intern: true, max: 120 },
    { feld: "kontoEroeffnetAm", ort: "plus", art: "datum", titel: "Eröffnet am", hilfe: "Der Kunde liest „Geschäftskonto eröffnet“ mit diesem Tag — nie eine Kontonummer." },
  ],
  duns: [
    { feld: "duns", ort: "plus", art: "duns", titel: "D-U-N-S-Nummer", platzhalter: "12-345-6789" },
  ],
};
/** Stationen, deren Werte Zeilen in Banken & Kapital sind (je Karte, je Rahmen eine Zeile). */
export const GLOBAL_STATION_KAPITAL: Record<string, { arten: ("karte" | "kreditrahmen" | "darlehen")[]; titel: string }> = {
  karte_1: { arten: ["karte"], titel: "Karten" },
  kartenleiter: { arten: ["karte"], titel: "Karten" },
  kreditrahmen: { arten: ["kreditrahmen", "darlehen"], titel: "Kreditrahmen und Darlehen" },
};
/** Welche Dokumentart zu einer Station in den Tresor gehört. */
export const GLOBAL_STATION_DOKUMENT: Record<string, string> = {
  eingetragen: "gruendungsurkunde", ein: "ein_brief", itin: "itin_bescheid", operating_agreement: "operating_agreement",
  konto: "bank_vertrag", karte_1: "karten_unterlage", kartenleiter: "karten_unterlage", kreditrahmen: "kapital_vertrag",
};

// ── STATUS-NAMEN JE STATION ──────────────────────────────────────────────────
// Die EIN für Kunden ohne SSN/ITIN beantragt unser Registered-Agent-Partner per Fax: Sein Team schickt vorher das
// Formular SS-4 zur Unterschrift. Die drei Schritte liegen auf den allgemeinen Status: in Arbeit = „SS-4 zur
// Unterschrift“, beantragt = „Eingereicht (Fax)“, erledigt = „EIN erteilt“. Das SS-4 selbst liegt als Dokument zur
// Unterschrift an der Station (Formular irs_ss4, shared/fiaon-global-akte.ts).
export const GLOBAL_STATION_STATUS_NAME: Record<string, Partial<Record<string, Paar>>> = {
  ein: {
    in_arbeit: { de: "SS-4 zur Unterschrift", en: "SS-4 for signature" },
    beantragt: { de: "Eingereicht (Fax)", en: "Filed (fax)" },
    erledigt: { de: "EIN erteilt", en: "EIN issued" },
  },
};
/** Der Name eines Status an einer Station — die eigene Bezeichnung, sonst null (dann gilt der allgemeine Name). */
export function stationStatusName(schluessel: string, status: string, s: BereichSprache = "de"): string | null {
  return GLOBAL_STATION_STATUS_NAME[schluessel]?.[status]?.[s] ?? null;
}
/** Weitere Dokumente an einer Station, die zur Unterschrift bereitgestellt werden (mit Pflichtunterlage). */
export const GLOBAL_STATION_UNTERSCHRIFT: Record<string, { art: string; pflichtKey: string; titel: string }> = {
  ein: { art: "steuer", pflichtKey: "irs_ss4", titel: "IRS Form SS-4 zur Unterschrift — von Hand, Scan als PDF (FIAON als Third Party Designee)" },
};

// ── FORMATE ──────────────────────────────────────────────────────────────────
const ziffern = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** EIN: neun Ziffern, 12-3456789. Das Präfix 00 vergibt die IRS nicht. */
export function stationEin(roh: unknown): string | null {
  const z = ziffern(roh);
  if (z.length !== 9 || z.startsWith("00")) return null;
  return `${z.slice(0, 2)}-${z.slice(2)}`;
}
/**
 * ITIN: neun Ziffern, beginnt mit 9, die Ziffern 4–5 liegen in 50–65, 70–88, 90–92 oder 94–99
 * (IRS, „Individual Taxpayer Identification Number“). Geschrieben 9XX-XX-XXXX.
 */
export function stationItin(roh: unknown): string | null {
  const z = ziffern(roh);
  if (z.length !== 9 || z[0] !== "9") return null;
  const g = Number(z.slice(3, 5));
  const gruppe = (g >= 50 && g <= 65) || (g >= 70 && g <= 88) || (g >= 90 && g <= 92) || (g >= 94 && g <= 99);
  return gruppe ? `${z.slice(0, 3)}-${z.slice(3, 5)}-${z.slice(5)}` : null;
}
/** Die Maske einer ITIN aus den letzten vier Ziffern: •••-••-1234. */
export function stationItinMaske(ende: unknown): string | null {
  const z = ziffern(ende);
  return z.length === 4 ? `•••-••-${z}` : null;
}
/** D-U-N-S: neun Ziffern, 12-345-6789; nur Nullen gibt es nicht. */
export function stationDuns(roh: unknown): string | null {
  const z = ziffern(roh);
  if (z.length !== 9 || /^0+$/.test(z)) return null;
  return `${z.slice(0, 2)}-${z.slice(2, 5)}-${z.slice(5)}`;
}
/**
 * US-Telefonnummer nach E.164: +1 und zehn Ziffern (Nordamerika: Vorwahl und Amt beginnen mit 2–9).
 * „(307) 555-0148“, „307 555 0148“, „+1 307-555-0148“ → „+13075550148“.
 */
export function stationTelefon(roh: unknown): string | null {
  let z = ziffern(roh);
  if (z.length === 11 && z.startsWith("1")) z = z.slice(1);
  if (z.length !== 10 || !/^[2-9]\d{2}[2-9]\d{6}$/.test(z)) return null;
  return `+1${z}`;
}
/** Internationale Nummer (E.164): „+41 79 123 45 67“ → „+41791234567“. Ohne „+“ und Landesvorwahl → null. */
export function stationTelefonInt(roh: unknown): string | null {
  const t = String(roh ?? "").trim();
  if (!/^(\+|00)/.test(t)) return null;
  const z = t.replace(/^00/, "").replace(/\D/g, "");
  return z.length >= 8 && z.length <= 15 && z[0] !== "0" ? `+${z}` : null;
}
export const STATION_ROLLEN: { wert: string; titel: string }[] = [
  { wert: "inhaber", titel: "Inhaber" }, { wert: "gesellschafter", titel: "Gesellschafter (Member)" }, { wert: "manager", titel: "Geschäftsführung (Manager)" },
];
/**
 * Warnungen (kein Fehler) zur Wohnanschrift der Kontaktperson: Agent-Adresse, virtuelles Büro oder Postfach sind in
 * Wyoming keine Anschrift einer natürlichen Person. Gibt die Sätze zurück, die der Editor gelb … blau zeigt.
 */
export function stationKontaktWarnungen(adresse: unknown, agentAdresse: unknown): string[] {
  const a = String(adresse ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!a) return [];
  const w: string[] = [];
  if (/\b(p\.?\s?o\.?\s?box|postfach|post office box|pmb|private mailbox)\b/.test(a)) w.push("Die Anschrift sieht nach einem Postfach aus — Wyoming verlangt die Wohnanschrift der Person.");
  if (/virtual office|virtuelles büro|regus|davinci|opus virtual|mail ?forward|registered agent|\bc\/o\b|suite r\b/.test(a)) w.push("Die Anschrift sieht nach einem virtuellen Büro oder einer Agent-Adresse aus — bitte die Wohnanschrift eintragen.");
  const ag = String(agentAdresse ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const ersteZeile = (x: string) => x.split(/[,\n]/)[0].trim();
  if (ag && ersteZeile(a) && ersteZeile(a) === ersteZeile(ag)) w.push("Die Anschrift ist die des Registered Agent — die Kontaktperson braucht ihre eigene Wohnanschrift.");
  return w;
}

/** +13075550148 → „+1 307 555 0148“. */
export function stationTelefonText(e164: unknown): string {
  const z = ziffern(e164);
  return z.length === 11 && z.startsWith("1") ? `+1 ${z.slice(1, 4)} ${z.slice(4, 7)} ${z.slice(7)}` : String(e164 ?? "");
}

// Namen von Registered-Agent- und Gründungsanbietern: Sie stehen nie beim Kunden (Adresse ja, Anbieter nein).
const ANBIETER = /northwest|registered agents? inc|incfile|zenbusiness|legalzoom|bizee|harbor compliance|cogency|ct corporation|wyoming agents|firstbase|doola|stripe atlas|genesis tax|greenback/i;
export function stationAnbieterImText(text: unknown): boolean { return ANBIETER.test(String(text ?? "")); }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function istTag(v: string): boolean {
  const m = ISO.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}
const zeile = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const block = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").split("\n").map((x) => x.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n").slice(0, max);

// ── PRÜFEN ───────────────────────────────────────────────────────────────────
export interface StationWerte {
  /** Für globalGesellschaftSetzen: nur die Felder, die geändert werden. */
  grund: Partial<Record<"name" | "form" | "bundesstaat" | "gegruendetAm", string | null>>;
  /** Für gesellschaft_plus: Wert oder null (= leeren). Die ITIN steht hier im KLARTEXT unter `itin` — der Server verschlüsselt. */
  plus: Partial<Record<string, string | null>>;
}
export type StationPruefung = { ok: true; werte: StationWerte } | { ok: false; feld: string; error: string };

/**
 * Prüft die Werte einer Station. `roh` enthält nur die Felder, die das Team geändert hat; ein leerer
 * Text leert das Feld. `heute` (YYYY-MM-DD, Berlin) begrenzt Daten: Was erst noch kommt, ist nicht passiert.
 */
export function stationWertePruefen(schluessel: string, roh: Record<string, unknown> | null | undefined, heute: string): StationPruefung {
  const felder = GLOBAL_STATION_FELDER[schluessel] ?? [];
  const werte: StationWerte = { grund: {}, plus: {} };
  const ein = roh && typeof roh === "object" ? roh : {};
  for (const name of Object.keys(ein)) {
    if (!felder.some((f) => f.feld === name)) return { ok: false, feld: name, error: `Das Feld „${name}“ gehört nicht zu dieser Station.` };
  }
  for (const f of felder) {
    if (!(f.feld in ein)) continue;
    const r = ein[f.feld];
    const leer = String(r ?? "").trim() === "";
    let wert: string | null = null;
    if (!leer) {
      switch (f.art) {
        case "text": wert = zeile(r, f.max ?? 200); break;
        case "mehrzeilig": wert = block(r, f.max ?? 300); if (wert.length < 6) return { ok: false, feld: f.feld, error: `${f.titel}: bitte die vollständige Adresse (Straße, Ort, Bundesstaat, ZIP).` }; break;
        case "datum":
          wert = String(r).trim();
          if (!istTag(wert)) return { ok: false, feld: f.feld, error: `${f.titel}: bitte ein gültiges Datum wählen.` };
          if (wert > heute) return { ok: false, feld: f.feld, error: `${f.titel}: Das Datum liegt in der Zukunft.` };
          if (wert < "2000-01-01") return { ok: false, feld: f.feld, error: `${f.titel}: Das Datum liegt zu weit zurück.` };
          break;
        case "staat": {
          const code = String(r).trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(code)) return { ok: false, feld: f.feld, error: "Bundesstaat: bitte aus der Liste wählen." };
          wert = code; break;
        }
        case "form": {
          const x = String(r).trim().toLowerCase();
          if (x !== "llc" && x !== "corporation") return { ok: false, feld: f.feld, error: "Rechtsform: bitte LLC oder Corporation wählen." };
          wert = x === "llc" ? "LLC" : "Corporation"; break;
        }
        case "ein": wert = stationEin(r); if (!wert) return { ok: false, feld: f.feld, error: "Die EIN hat neun Ziffern im Format 12-3456789." }; break;
        case "itin": wert = stationItin(r); if (!wert) return { ok: false, feld: f.feld, error: "Die ITIN hat neun Ziffern im Format 9XX-XX-XXXX (beginnt mit 9; Ziffern 4–5 zwischen 50 und 99)." }; break;
        case "duns": wert = stationDuns(r); if (!wert) return { ok: false, feld: f.feld, error: "Die D-U-N-S-Nummer hat neun Ziffern (12-345-6789)." }; break;
        case "telefon": wert = stationTelefon(r); if (!wert) return { ok: false, feld: f.feld, error: "Bitte eine US-Nummer mit zehn Ziffern eingeben, z. B. +1 307 555 0148." }; break;
        case "telefon_int": wert = stationTelefonInt(r); if (!wert) return { ok: false, feld: f.feld, error: `${f.titel}: bitte mit Landesvorwahl, z. B. +41 79 123 45 67.` }; break;
        case "email": {
          const e = String(r).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) || e.length > 160) return { ok: false, feld: f.feld, error: `${f.titel}: bitte eine gültige E-Mail-Adresse.` };
          wert = e; break;
        }
        case "rolle": wert = String(r).trim(); if (!STATION_ROLLEN.some((x) => x.wert === wert)) return { ok: false, feld: f.feld, error: "Rolle: bitte Inhaber, Gesellschafter oder Geschäftsführung wählen." }; break;
      }
    }
    if (wert && !f.intern && f.art !== "itin" && stationAnbieterImText(wert)) {
      return { ok: false, feld: f.feld, error: `${f.titel}: Bitte ohne Namen des Anbieters — der Kunde sieht dieses Feld.` };
    }
    if (f.ort === "grund") (werte.grund as Record<string, string | null>)[f.feld] = wert;
    else werte.plus[f.feld] = wert;
  }
  return { ok: true, werte };
}

// ── WAS DER KUNDE SIEHT ──────────────────────────────────────────────────────
/** Die Felder von gesellschaft_plus, die das Portal zeigen darf. Alles andere (itinEnc, kontoInstitut, registeredAgent) bleibt drin. */
export const GLOBAL_PLUS_KUNDE = ["aktenzeichen", "ein", "einBriefAm", "agentAdresse", "kontaktperson", "usAdresse", "usTelefon", "privatAdresse", "itinBescheidAm", "duns", "kontoEroeffnetAm", "hinweis"] as const;
export type GlobalPlusKunde = Partial<Record<(typeof GLOBAL_PLUS_KUNDE)[number], string | null>> & { itinMaske?: string | null; itinVorhanden?: boolean };
/** Die Wand gegen Interna: nur freigegebene Felder, die ITIN nur als Maske. */
export function globalPlusFuerKunde(plus: GlobalGesellschaftPlus | null | undefined): GlobalPlusKunde {
  const p = (plus ?? {}) as Record<string, unknown>;
  const aus: GlobalPlusKunde = {};
  for (const k of GLOBAL_PLUS_KUNDE) if (p[k] != null && String(p[k]).trim() !== "") (aus as Record<string, unknown>)[k] = String(p[k]);
  const maske = stationItinMaske(p.itinEnde);
  if (p.itinEnc && maske) { aus.itinMaske = maske; aus.itinVorhanden = true; }
  return aus;
}
/** Für Team-Listen: wie oben, plus Interna — aber die ITIN auch hier nur als Maske. */
export function globalPlusFuerTeam(plus: GlobalGesellschaftPlus | null | undefined): Record<string, unknown> {
  const p = { ...((plus ?? {}) as Record<string, unknown>) };
  const maske = stationItinMaske(p.itinEnde);
  delete p.itinEnc; delete p.itinEnde;
  return { ...p, ...(maske ? { itinMaske: maske, itinVorhanden: true } : {}) };
}

// ── ANZEIGE UNTER EINER STATION (Portal) ─────────────────────────────────────
export interface StationZeile { key: string; titel: string; wert: string; kopie?: string; geheim?: "itin" }
const W: Record<BereichSprache, Record<string, string>> = {
  de: {
    name: "Gesellschaft", staat: "Bundesstaat", gegruendet: "Gegründet am", akz: "State File Number", agentAdresse: "Anschrift des Registered Agent", kontakt: "Kontaktperson",
    telefon: "US-Telefonnummer", geschaeft: "US-Geschäftsadresse", privat: "Private US-Adresse", ein: "EIN", einBrief: "Bestätigung der US-Steuerbehörde vom",
    itin: "ITIN", itinBescheid: "Bescheid der US-Steuerbehörde vom", duns: "D-U-N-S-Nummer", konto: "Geschäftskonto eröffnet am",
  },
  en: {
    name: "Company", staat: "State", gegruendet: "Formed on", akz: "State file number", agentAdresse: "Registered agent address", kontakt: "Contact person",
    telefon: "US phone number", geschaeft: "US business address", privat: "Private US address", ein: "EIN", einBrief: "IRS confirmation dated",
    itin: "ITIN", itinBescheid: "IRS notice dated", duns: "D-U-N-S number", konto: "Business account opened on",
  },
};
/** Die Zeilen, die das Portal unter einer Station zeigt. `tag` formatiert ein Datum in der Sprache der Seite. */
export function stationZeilen(schluessel: string, g: GlobalGesellschaft | null | undefined, p: GlobalPlusKunde | null | undefined, s: BereichSprache, tag: (iso: string) => string, staatName: (code: string) => string | null = () => null): StationZeile[] {
  const w = W[s]; const gg = g ?? {}; const pp = p ?? {};
  const z: StationZeile[] = [];
  const dazu = (key: string, titel: string, wert: string | null | undefined, extra: Partial<StationZeile> = {}) => { if (wert) z.push({ key, titel, wert, ...extra }); };
  switch (schluessel) {
    case "eingetragen":
      dazu("name", w.name, gg.name ?? null);
      dazu("staat", w.staat, gg.bundesstaat ? (staatName(gg.bundesstaat) ?? gg.bundesstaat) : null);
      dazu("gegruendet", w.gegruendet, gg.gegruendetAm ? tag(gg.gegruendetAm) : null);
      dazu("akz", w.akz, pp.aktenzeichen, { kopie: pp.aktenzeichen ?? undefined });
      break;
    case "agent":
      dazu("agentAdresse", w.agentAdresse, pp.agentAdresse);
      dazu("kontakt", w.kontakt, pp.kontaktperson);
      break;
    case "adresse":
      dazu("telefon", w.telefon, pp.usTelefon ? stationTelefonText(pp.usTelefon) : null, { kopie: pp.usTelefon ?? undefined });
      dazu("geschaeft", w.geschaeft, pp.usAdresse);
      dazu("privat", w.privat, pp.privatAdresse);
      break;
    case "ein":
      dazu("ein", w.ein, pp.ein, { kopie: pp.ein ?? undefined });
      dazu("einBrief", w.einBrief, pp.einBriefAm ? tag(pp.einBriefAm) : null);
      break;
    case "itin":
      dazu("itin", w.itin, pp.itinMaske, { geheim: "itin" });
      dazu("itinBescheid", w.itinBescheid, pp.itinBescheidAm ? tag(pp.itinBescheidAm) : null);
      break;
    case "konto":
      dazu("konto", w.konto, pp.kontoEroeffnetAm ? tag(pp.kontoEroeffnetAm) : null);
      break;
    case "duns":
      dazu("duns", w.duns, pp.duns, { kopie: pp.duns ?? undefined });
      break;
  }
  return z;
}

// ── VERLAUF: WAS DER KUNDE LIEST, WENN EIN WERT NEU DA IST ───────────────────
// Nur beim ERSTEN Eintragen (vorher leer) — eine Korrektur ist eine interne Zeile. Nie ein Wert im Satz.
export const GLOBAL_STATION_VERLAUF: Record<string, Paar> = {
  aktenzeichen: { de: "Ihre Gesellschaft ist im Register des Bundesstaats eingetragen.", en: "Your company is entered in the state register." },
  agentAdresse: { de: "Die Anschrift Ihres Registered Agent steht in Ihrem Portal.", en: "Your registered agent's address is now in your portal." },
  usTelefon: { de: "Ihre US-Telefonnummer ist eingerichtet.", en: "Your US phone number is set up." },
  usAdresse: { de: "Ihre US-Geschäftsadresse steht.", en: "Your US business address is in place." },
  privatAdresse: { de: "Ihre private US-Adresse steht.", en: "Your private US address is in place." },
  ein: { de: "Ihre EIN ist da.", en: "Your EIN has arrived." },
  itin: { de: "Ihre ITIN ist da.", en: "Your ITIN has arrived." },
  duns: { de: "Die D-U-N-S-Nummer Ihrer Gesellschaft ist da.", en: "Your company's D-U-N-S number has arrived." },
  kontoEroeffnetAm: { de: "Ihr US-Geschäftskonto ist eröffnet.", en: "Your US business account is open." },
};
/** Die Sätze für den Kunden zu den Feldern, die vorher leer waren und jetzt einen Wert haben. */
export function stationVerlaufSaetze(neuGesetzt: string[], s: BereichSprache): string[] {
  return neuGesetzt.map((f) => GLOBAL_STATION_VERLAUF[f]?.[s]).filter((x): x is string => !!x);
}
