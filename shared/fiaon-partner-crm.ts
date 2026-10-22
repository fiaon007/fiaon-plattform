// ═══════════════════════════════════════════════════════════════════════════
// GESCHÄFTSPARTNER-CRM — DIE REINEN REGELN (E-425, 22.10.2026)
//
// Justin: „Partner wie unser Registered-Agent-Anbieter müssen komplett mit Verlauf,
// Vertrag, Vereinbarungen, allen Daten und Details drin sein — und alle anderen
// auch. Kontakte mit denselben Feldern anlegen. Ein vollständiges, hochwertiges
// CRM, über das wir alles steuern, speichern, suchen — KI-gestützt, beim Tippen
// einer Adresse kommen Vorschläge, aus einer Mail wird alles übernommen."
//
// Diese Datei rechnet ohne Datenbank und ohne Netz — damit der Prüfstand
// (scripts/pruef-partner-crm.ts) jede Regel nachrechnen kann:
//   · Bezeichnungen (Art, Status, Verlaufs- und Dokumentarten) — EIN Ort.
//   · Eingaben prüfen (Firma, Kontakt, Verlauf, Aufgabe, Dokument).
//   · Suche normalisieren (Umlaute, Akzente, Telefonnummern als Ziffern).
//   · Bestehenden Partner wiedererkennen (Domain, E-Mail, Namenskern).
//   · KI-Antwort aus „Aus E-Mail übernehmen“ bereinigen — nur, was im Text steht.
//   · Regel-Auswertung derselben Mail ohne KI (Rückweg, wenn die KI aus ist).
//   · Adressvorschläge aus der Antwort des Anbieters (Photon) lesen.
//   · „Was steht an?“ — die Hinweise, die ohne KI entstehen.
//
// Das Repo ist öffentlich (E-242): Hier steht KEIN echtes Partnerdatum. Die
// Partnerakten liegen nur in der Datenbank; Beispieldaten sind erfunden.
// ═══════════════════════════════════════════════════════════════════════════

// ── Bezeichnungen ──────────────────────────────────────────────────────────
export const PARTNER_ARTEN = [
  { wert: "lieferant", text: "Lieferant / Dienstleister" },
  { wert: "kooperation", text: "Kooperationspartner" },
  { wert: "bank", text: "Bank / Finanzpartner" },
  { wert: "kanzlei", text: "Kanzlei / Steuer" },
  { wert: "sonstige", text: "Sonstige" },
] as const;
export type PartnerArt = (typeof PARTNER_ARTEN)[number]["wert"];

export const PARTNER_STATUS = [
  { wert: "gespraech", text: "Im Gespräch" },
  { wert: "aktiv", text: "Aktiv" },
  { wert: "pausiert", text: "Pausiert" },
  { wert: "beendet", text: "Beendet" },
] as const;
export type PartnerStatus = (typeof PARTNER_STATUS)[number]["wert"];

export const VERLAUF_TYPEN = [
  { wert: "notiz", text: "Notiz" },
  { wert: "email", text: "E-Mail" },
  { wert: "anruf", text: "Anruf" },
  { wert: "termin", text: "Termin" },
  { wert: "vertrag", text: "Vertrag" },
  { wert: "vereinbarung", text: "Vereinbarung" },
  { wert: "rechnung", text: "Rechnung" },
  { wert: "aufgabe", text: "Aufgabe" },
] as const;
export type VerlaufTyp = (typeof VERLAUF_TYPEN)[number]["wert"];

export const DOKUMENT_ARTEN = [
  { wert: "vertrag", text: "Vertrag" },
  { wert: "vereinbarung", text: "Vereinbarung" },
  { wert: "preisblatt", text: "Preisblatt" },
  { wert: "rechnung", text: "Rechnung" },
  { wert: "korrespondenz", text: "Korrespondenz" },
  { wert: "sonstiges", text: "Sonstiges" },
] as const;
export type DokumentArt = (typeof DOKUMENT_ARTEN)[number]["wert"];

const wertListe = <T extends { wert: string }>(l: readonly T[]) => l.map((x) => x.wert as string);
export function textFuer(liste: readonly { wert: string; text: string }[], wert: unknown): string {
  return liste.find((x) => x.wert === wert)?.text ?? String(wert ?? "");
}
function ausListe<T extends string>(liste: readonly { wert: string }[], roh: unknown, vorgabe: T): T {
  const w = String(roh ?? "").trim().toLowerCase();
  return (wertListe(liste).includes(w) ? w : vorgabe) as T;
}
export const artAus = (roh: unknown): PartnerArt => ausListe(PARTNER_ARTEN, artSynonym(roh), "sonstige");
export const statusAus = (roh: unknown): PartnerStatus => ausListe(PARTNER_STATUS, roh, "gespraech");
export const verlaufTypAus = (roh: unknown): VerlaufTyp => ausListe(VERLAUF_TYPEN, roh, "notiz");
export const dokumentArtAus = (roh: unknown): DokumentArt => ausListe(DOKUMENT_ARTEN, roh, "sonstiges");

/** Die KI und Menschen schreiben „Dienstleister“, „Bank“, „Steuerberater“ — hier wird daraus der eine Wert. */
function artSynonym(roh: unknown): string {
  const t = suchNormal(String(roh ?? ""));
  if (!t) return "";
  if (wertListe(PARTNER_ARTEN).includes(t)) return t;
  if (/lieferant|dienstleist|anbieter|vendor|supplier|provider|service|registered agent/.test(t)) return "lieferant";
  if (/kooperation|partner|tippgeber|affiliate|referral/.test(t)) return "kooperation";
  if (/bank|finanz|kredit|zahlung|payment|lender|funding/.test(t)) return "bank";
  if (/kanzlei|anwalt|recht|steuer|tax|law|legal|cpa|notar/.test(t)) return "kanzlei";
  return "sonstige";
}

// ── Kleine Säuberer ────────────────────────────────────────────────────────
/** Eine Zeile: ohne Steuerzeichen, Weißraum zusammengezogen, begrenzt. */
export function zeile(v: unknown, max = 200): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
/** Mehrere Zeilen (Notiz, Verlaufstext): Zeilenumbrüche bleiben, höchstens zwei Leerzeilen. */
export function mehrzeilig(v: unknown, max = 8000): string {
  return String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, " ")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
const EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
export function emailSauber(v: unknown): string {
  const e = zeile(v, 160).toLowerCase().replace(/^mailto:/, "").replace(/[<>()"\s]/g, "");
  return EMAIL.test(e) ? e : "";
}
/** Telefon: sichtbare Schreibweise bleibt (555-010-0140), nur Ziffern, + ( ) - / . und Leerzeichen. */
export function telefonSauber(v: unknown): string {
  const t = zeile(v, 40).replace(/[^\d+()\-/. ]/g, "").replace(/\s+/g, " ").trim();
  return (t.match(/\d/g)?.length ?? 0) >= 5 ? t : "";
}
export const nurZiffern = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** Website: ohne Schema angegeben → https://; nur http(s) und ein Host mit Punkt. */
export function websiteSauber(v: unknown): string {
  let w = zeile(v, 200).replace(/\s/g, "");
  if (!w) return "";
  if (!/^https?:\/\//i.test(w)) w = `https://${w.replace(/^\/+/, "")}`;
  try {
    const u = new URL(w);
    if (!/^https?:$/.test(u.protocol) || !/\.[a-z]{2,24}$/i.test(u.hostname)) return "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 200);
  } catch { return ""; }
}
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
/** „2026-10-22“ oder „22.10.2026“ → ISO; sonst "". Prüft, dass es den Tag gibt. */
export function isoTag(v: unknown): string {
  const s = zeile(v, 30);
  let iso = "";
  if (ISO_TAG.test(s.slice(0, 10))) iso = s.slice(0, 10);
  else {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
    if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : "";
}
/** Tage von a nach b (beide ISO). Positiv = b liegt später. */
export function tageZwischen(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
}

const LAENDER: Record<string, string> = {
  de: "DE", deutschland: "DE", germany: "DE", at: "AT", oesterreich: "AT", osterreich: "AT", austria: "AT",
  ch: "CH", schweiz: "CH", switzerland: "CH", suisse: "CH", li: "LI", liechtenstein: "LI",
  us: "US", usa: "US", "united states": "US", "united states of america": "US", "vereinigte staaten": "US", amerika: "US",
  gb: "GB", uk: "GB", "united kingdom": "GB", england: "GB", grossbritannien: "GB", "great britain": "GB", "vereinigtes konigreich": "GB",
  ie: "IE", irland: "IE", ireland: "IE", nl: "NL", niederlande: "NL", netherlands: "NL", be: "BE", belgien: "BE", belgium: "BE",
  lu: "LU", luxemburg: "LU", luxembourg: "LU", fr: "FR", frankreich: "FR", france: "FR", it: "IT", italien: "IT", italy: "IT",
  es: "ES", spanien: "ES", spain: "ES", pl: "PL", polen: "PL", poland: "PL", cz: "CZ", tschechien: "CZ", hr: "HR", kroatien: "HR",
  ae: "AE", "vereinigte arabische emirate": "AE", uae: "AE", "united arab emirates": "AE", dubai: "AE", ca: "CA", kanada: "CA", canada: "CA",
  cy: "CY", zypern: "CY", cyprus: "CY", mt: "MT", malta: "MT", ee: "EE", estland: "EE", estonia: "EE",
};
export const LAND_NAMEN: Record<string, string> = {
  DE: "Deutschland", AT: "Österreich", CH: "Schweiz", LI: "Liechtenstein", US: "USA", GB: "Vereinigtes Königreich", IE: "Irland",
  NL: "Niederlande", BE: "Belgien", LU: "Luxemburg", FR: "Frankreich", IT: "Italien", ES: "Spanien", PL: "Polen", CZ: "Tschechien",
  HR: "Kroatien", AE: "VAE", CA: "Kanada", CY: "Zypern", MT: "Malta", EE: "Estland",
};
/** Land als zweistelliger Code (DE, US …) aus Code oder Namen — "" wenn unbekannt. */
export function landCodeAus(v: unknown): string {
  const roh = zeile(v, 60);
  if (/^[A-Za-z]{2}$/.test(roh)) return roh.toUpperCase();
  return LAENDER[suchNormal(roh)] ?? "";
}

export interface Kondition { label: string; value: string }
/** Konditionen (Preise, Staffeln, Provision, Zahlungsziel) als freie Liste {label, value}. */
export function konditionenSauber(v: unknown): Kondition[] {
  const liste = Array.isArray(v) ? v : [];
  const aus: Kondition[] = [];
  for (const k of liste) {
    if (!k || typeof k !== "object") continue;
    const label = zeile((k as any).label ?? (k as any).titel, 120);
    const value = zeile((k as any).value ?? (k as any).wert, 1000);
    if (!label && !value) continue;
    aus.push({ label: label || "Kondition", value });
    if (aus.length >= 40) break;
  }
  return aus;
}
export function tagsSauber(v: unknown): string[] {
  const roh = Array.isArray(v) ? v : String(v ?? "").split(/[,;#\n]/);
  const aus: string[] = [];
  for (const t of roh) {
    const s = zeile(t, 32).replace(/^#/, "");
    if (s && !aus.some((x) => x.toLowerCase() === s.toLowerCase())) aus.push(s);
    if (aus.length >= 20) break;
  }
  return aus;
}

// ── Eingaben ───────────────────────────────────────────────────────────────
export interface Adresse { strasse: string; hausnummer: string; adresszusatz: string; plz: string; ort: string; region: string; landCode: string }
export interface FirmaEingabe extends Adresse {
  name: string; art: PartnerArt; status: PartnerStatus; website: string; email: string; telefon: string;
  registerNr: string; steuerNr: string; ustId: string; leistung: string; konditionen: Kondition[]; tags: string[];
  notizen: string; betreuerAgentId: number | null; vertraulich: boolean; angebotId: number | null; personId: number | null;
}
export interface KontaktEingabe extends Adresse {
  firmaId: number | null; name: string; rolle: string; email: string; telefon: string; mobil: string; durchwahl: string;
  erreichbarkeit: string; sprache: string; notizen: string; haupt: boolean;
}
export interface VerlaufEingabe { firmaId: number | null; kontaktId: number | null; typ: VerlaufTyp; am: string; titel: string; text: string; dokumentId: number | null }
export interface AufgabeEingabe { firmaId: number | null; kontaktId: number | null; titel: string; notiz: string; faelligAm: string; zustaendig: string }
export interface DokumentMeta { firmaId: number | null; kontaktId: number | null; art: DokumentArt; titel: string; gueltigAb: string; gueltigBis: string; notiz: string }

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; error: string };
const idAus = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const wahr = (v: unknown) => v === true || v === "true" || v === "1" || v === 1 || v === "on";

export function adresseAus(r: any): Adresse {
  return {
    strasse: zeile(r?.strasse, 160), hausnummer: zeile(r?.hausnummer, 20), adresszusatz: zeile(r?.adresszusatz, 120),
    plz: zeile(r?.plz, 16), ort: zeile(r?.ort, 120), region: zeile(r?.region, 80), landCode: landCodeAus(r?.landCode ?? r?.land),
  };
}

export function firmaPruefen(r: any): Pruefung<FirmaEingabe> {
  const name = zeile(r?.name, 160);
  if (name.length < 2) return { ok: false, error: "Bitte den Namen des Partners eintragen (mindestens 2 Zeichen)." };
  const emailRoh = zeile(r?.email, 160);
  const email = emailSauber(emailRoh);
  if (emailRoh && !email) return { ok: false, error: `„${emailRoh}“ ist keine gültige E-Mail-Adresse.` };
  const websiteRoh = zeile(r?.website, 200);
  const website = websiteSauber(websiteRoh);
  if (websiteRoh && !website) return { ok: false, error: `„${websiteRoh}“ ist keine gültige Website.` };
  const telRoh = zeile(r?.telefon, 40);
  const telefon = telefonSauber(telRoh);
  if (telRoh && !telefon) return { ok: false, error: `„${telRoh}“ ist keine Telefonnummer.` };
  return {
    ok: true,
    wert: {
      name, art: artAus(r?.art), status: statusAus(r?.status), website, email, telefon, ...adresseAus(r),
      registerNr: zeile(r?.registerNr, 80), steuerNr: zeile(r?.steuerNr, 80), ustId: zeile(r?.ustId, 40),
      leistung: mehrzeilig(r?.leistung, 2000), konditionen: konditionenSauber(r?.konditionen), tags: tagsSauber(r?.tags),
      notizen: mehrzeilig(r?.notizen, 8000), betreuerAgentId: idAus(r?.betreuerAgentId), vertraulich: wahr(r?.vertraulich),
      angebotId: idAus(r?.angebotId), personId: idAus(r?.personId),
    },
  };
}

export function kontaktPruefen(r: any): Pruefung<KontaktEingabe> {
  const name = zeile(r?.name, 120);
  if (name.length < 2) return { ok: false, error: "Bitte den Namen des Kontakts eintragen (mindestens 2 Zeichen)." };
  const emailRoh = zeile(r?.email, 160);
  const email = emailSauber(emailRoh);
  if (emailRoh && !email) return { ok: false, error: `„${emailRoh}“ ist keine gültige E-Mail-Adresse.` };
  const tel = (feld: string): string | null => {
    const roh = zeile(r?.[feld], 40);
    const s = telefonSauber(roh);
    return roh && !s ? null : s;
  };
  const telefon = tel("telefon"); const mobil = tel("mobil");
  if (telefon === null) return { ok: false, error: `„${zeile(r?.telefon, 40)}“ ist keine Telefonnummer.` };
  if (mobil === null) return { ok: false, error: `„${zeile(r?.mobil, 40)}“ ist keine Mobilnummer.` };
  return {
    ok: true,
    wert: {
      firmaId: idAus(r?.firmaId), name, rolle: zeile(r?.rolle, 120), email, telefon, mobil,
      durchwahl: zeile(r?.durchwahl, 12).replace(/[^\d]/g, ""), erreichbarkeit: zeile(r?.erreichbarkeit, 120),
      sprache: zeile(r?.sprache, 20), notizen: mehrzeilig(r?.notizen, 4000), haupt: wahr(r?.haupt), ...adresseAus(r),
    },
  };
}

export function verlaufPruefen(r: any, heute: string): Pruefung<VerlaufEingabe> {
  const firmaId = idAus(r?.firmaId); const kontaktId = idAus(r?.kontaktId);
  if (!firmaId && !kontaktId) return { ok: false, error: "Ein Verlaufseintrag gehört zu einem Partner oder Kontakt." };
  const titel = zeile(r?.titel, 200);
  const text = mehrzeilig(r?.text, 20000);
  if (!titel && !text) return { ok: false, error: "Bitte einen Titel oder Text eintragen." };
  const amRoh = zeile(r?.am, 30);
  const am = amRoh ? isoTag(amRoh) : heute;
  if (!am) return { ok: false, error: `„${amRoh}“ ist kein Datum.` };
  return { ok: true, wert: { firmaId, kontaktId, typ: verlaufTypAus(r?.typ), am, titel: titel || text.split("\n")[0].slice(0, 120), text, dokumentId: idAus(r?.dokumentId) } };
}

export function aufgabePruefen(r: any): Pruefung<AufgabeEingabe> {
  const firmaId = idAus(r?.firmaId); const kontaktId = idAus(r?.kontaktId);
  if (!firmaId && !kontaktId) return { ok: false, error: "Eine Aufgabe gehört zu einem Partner oder Kontakt." };
  const titel = zeile(r?.titel, 200);
  if (titel.length < 3) return { ok: false, error: "Bitte die Aufgabe in ein paar Worten beschreiben." };
  const roh = zeile(r?.faelligAm, 30);
  const faelligAm = roh ? isoTag(roh) : "";
  if (roh && !faelligAm) return { ok: false, error: `„${roh}“ ist kein Datum.` };
  return { ok: true, wert: { firmaId, kontaktId, titel, notiz: mehrzeilig(r?.notiz, 4000), faelligAm, zustaendig: zeile(r?.zustaendig, 80) } };
}

export function dokumentMetaPruefen(r: any): Pruefung<DokumentMeta> {
  const firmaId = idAus(r?.firmaId); const kontaktId = idAus(r?.kontaktId);
  if (!firmaId && !kontaktId) return { ok: false, error: "Ein Dokument gehört zu einem Partner oder Kontakt." };
  const ab = zeile(r?.gueltigAb, 30); const bis = zeile(r?.gueltigBis, 30);
  const gueltigAb = ab ? isoTag(ab) : ""; const gueltigBis = bis ? isoTag(bis) : "";
  if (ab && !gueltigAb) return { ok: false, error: `„${ab}“ ist kein Datum (gültig ab).` };
  if (bis && !gueltigBis) return { ok: false, error: `„${bis}“ ist kein Datum (gültig bis).` };
  if (gueltigAb && gueltigBis && gueltigBis < gueltigAb) return { ok: false, error: "„Gültig bis“ liegt vor „gültig ab“." };
  return { ok: true, wert: { firmaId, kontaktId, art: dokumentArtAus(r?.art), titel: zeile(r?.titel, 200), gueltigAb, gueltigBis, notiz: mehrzeilig(r?.notiz, 2000) } };
}

// ── Suche ──────────────────────────────────────────────────────────────────
/** Klein, ohne Akzente (Müller → muller), ß → ss, alles außer Buchstaben/Ziffern/@/. wird Leerzeichen. */
export function suchNormal(v: unknown): string {
  let s = String(v ?? "").toLowerCase().replace(/ß/g, "ss");
  try { s = s.normalize("NFKD").replace(/[̀-ͯ]/g, ""); } catch { /* alte Laufzeit — ohne Akzentfaltung */ }
  return s.replace(/[^a-z0-9@.+]+/g, " ").replace(/\s+/g, " ").trim();
}
/** Die Suchwörter: höchstens sechs, je höchstens 40 Zeichen, doppelte raus. Jedes Wort muss irgendwo treffen. */
export function suchWoerter(q: unknown): string[] {
  const aus: string[] = [];
  for (const w of suchNormal(String(q ?? "").slice(0, 200)).split(" ")) {
    const t = w.replace(/^[.@+]+|[.@+]+$/g, "").slice(0, 40);
    if (t && !aus.includes(t)) aus.push(t);
    if (aus.length >= 6) break;
  }
  return aus;
}
/**
 * Der Suchtext einer Zeile: alle Felder normalisiert, dazu Telefonnummern als reine Ziffern —
 * „5550100140“ findet „555-010-0140“. Die Datenbank sucht darin mit LIKE je Suchwort.
 */
export function suchtextAus(felder: unknown[], telefone: unknown[] = []): string {
  const teile = felder.map((f) => (Array.isArray(f) ? f.join(" ") : typeof f === "object" && f ? JSON.stringify(f) : String(f ?? ""))).map(suchNormal).filter(Boolean);
  const ziffern = telefone.map(nurZiffern).filter((z) => z.length >= 5);
  return ` ${[...teile, ...ziffern].join(" ")} `.slice(0, 20000);
}
/** LIKE-Muster für ein Suchwort (% und _ maskiert). */
export const likeMuster = (wort: string) => `%${wort.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;

// ── Bestehenden Partner wiedererkennen ─────────────────────────────────────
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "web.de", "t-online.de", "outlook.com", "hotmail.com", "hotmail.de",
  "live.com", "live.de", "yahoo.com", "yahoo.de", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "bluewin.ch",
  "freenet.de", "posteo.de", "mail.de", "online.de", "aon.at", "a1.net", "hispeed.ch",
]);
/** Die Domain aus E-Mail oder Website, ohne www. — Freemail-Domains zählen nicht (gmail.com ist kein Partner). */
export function domainAus(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  let host = "";
  if (s.includes("@")) host = s.split("@").pop() ?? "";
  else { try { host = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`).hostname; } catch { host = ""; } }
  host = host.replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "");
  if (!/\.[a-z]{2,24}$/.test(host) || FREEMAIL.has(host)) return "";
  return host;
}
const RECHTSFORMEN = /\b(llc|l\.l\.c|inc|incorporated|ltd|limited|gmbh|ag|ug|kg|ohg|gbr|se|sa|sarl|bv|nv|corp|corporation|co|company|plc|pllc|lp|llp|haftungsbeschrankt|mbh|e\.?v|the|und|and|partner|partners|group|gruppe)\b/g;
/** Der Kern eines Firmennamens: ohne Rechtsform, ohne Füllwörter, normalisiert. */
export function firmenNameKern(name: unknown): string {
  return suchNormal(name).replace(/[.@+]/g, " ").replace(RECHTSFORMEN, " ").replace(/\s+/g, " ").trim();
}
export interface BestandFirma { id: number; name: string; website: string | null; email: string | null; kontaktEmails: string[] }
export interface Treffer { id: number; name: string; grund: string; punkte: number }
/**
 * Gibt es diesen Partner schon? Je Kandidat die stärkste Begründung:
 *   gleiche E-Mail (100) · gleiche Domain aus E-Mail/Website (80) · gleicher Namenskern (70) · Namenskern enthalten (45).
 * Unter 45 Punkten zählt nichts — ein Treffer, der falsch ist, führt zu einer zusammengeworfenen Akte.
 */
export function firmenTreffer(v: { name?: string; website?: string; email?: string; kontaktEmails?: string[] }, bestand: BestandFirma[]): Treffer[] {
  const mails = [v.email, ...(v.kontaktEmails ?? [])].map(emailSauber).filter(Boolean);
  const domains = Array.from(new Set([domainAus(v.website), ...mails.map(domainAus)].filter(Boolean)));
  const kern = firmenNameKern(v.name);
  const aus: Treffer[] = [];
  for (const f of bestand) {
    const fMails = [f.email, ...f.kontaktEmails].map(emailSauber).filter(Boolean);
    const fDomains = new Set([domainAus(f.website), ...fMails.map(domainAus)].filter(Boolean));
    const fKern = firmenNameKern(f.name);
    let best: { grund: string; punkte: number } | null = null;
    const nimm = (grund: string, punkte: number) => { if (!best || punkte > best.punkte) best = { grund, punkte }; };
    const gleich = mails.find((m) => fMails.includes(m));
    if (gleich) nimm(`gleiche E-Mail ${gleich}`, 100);
    const dom = domains.find((d) => fDomains.has(d));
    if (dom) nimm(`gleiche Domain ${dom}`, 80);
    if (kern && fKern && kern === fKern) nimm("gleicher Name", 70);
    else if (kern.length >= 4 && fKern.length >= 4 && (kern.includes(fKern) || fKern.includes(kern))) nimm("ähnlicher Name", 45);
    const b = best as { grund: string; punkte: number } | null;
    if (b && b.punkte >= 45) aus.push({ id: f.id, name: f.name, grund: b.grund, punkte: b.punkte });
  }
  return aus.sort((a, b) => b.punkte - a.punkte).slice(0, 5);
}

// ── „Aus E-Mail übernehmen“ ────────────────────────────────────────────────
export const KI_MAIL_MAX_ZEICHEN = 20000;
export interface MailKontakt { name: string; rolle: string; email: string; telefon: string; mobil: string; durchwahl: string; erreichbarkeit: string; sprache: string; notiz: string }
export interface MailVorschlag {
  firma: { name: string; art: PartnerArt; website: string; email: string; telefon: string; registerNr: string; steuerNr: string; ustId: string; leistung: string } & Adresse;
  kontakte: MailKontakt[];
  fakten: Kondition[];
  tags: string[];
  verlauf: { typ: VerlaufTyp; am: string; titel: string; text: string } | null;
  aufgabe: { titel: string; faelligAm: string; notiz: string } | null;
  /** Was die Bereinigung verworfen hat (für den Menschen sichtbar — nichts verschwindet still). */
  verworfen: string[];
}

/** Der Auftrag an die KI. Antwort NUR als JSON-Objekt; was nicht im Text steht, bleibt leer. */
export const KI_MAIL_ANWEISUNG = [
  "Du liest eine E-Mail, eine Signatur oder Notizen, die ein Mitarbeiter von FIAON in das Partner-CRM einfügt.",
  "Ziehe daraus strukturierte Stammdaten über das Unternehmen und die Personen, die AUF DER ANDEREN SEITE stehen (nicht FIAON, nicht fiaon.com, nicht Justin Schwarzott).",
  "REGELN: Erfinde nichts. Jede E-Mail-Adresse, Telefonnummer und Website muss wörtlich im Text stehen. Unbekanntes bleibt leerer Text \"\" bzw. null.",
  "Telefon: so wie geschrieben; eine Durchwahl (ext., x, DW, Durchwahl) gehört in \"durchwahl\" (nur Ziffern).",
  "Erreichbarkeit (z. B. \"Mo–Fr 8:30–17:00 PT\") in \"erreichbarkeit\". Rolle so, wie sie in der Signatur steht.",
  "art ist genau einer von: lieferant, kooperation, bank, kanzlei, sonstige. landCode ist der zweistellige ISO-Code (US, DE, AT, CH, GB …).",
  "fakten: wichtige Konditionen und Abmachungen als Liste {label, value}, kurz und auf Deutsch (Preise, Staffeln, Fristen, Zahlungsziel, Kündigung).",
  "verlauf: EIN Eintrag, der beschreibt, was diese Mail ist (typ aus: notiz, email, anruf, termin, vertrag, vereinbarung, rechnung, aufgabe; am als YYYY-MM-DD, wenn ein Datum im Text steht, sonst \"\"; titel kurz auf Deutsch; text 1–3 Sätze Deutsch).",
  "aufgabe: nur wenn die Mail eine nächste Handlung für FIAON verlangt (z. B. Passwort setzen, Unterlagen schicken, antworten) — titel auf Deutsch, faelligAm YYYY-MM-DD oder \"\"; sonst null.",
  "Antworte NUR mit einem JSON-Objekt dieser Form:",
  "{\"firma\":{\"name\":\"\",\"art\":\"sonstige\",\"website\":\"\",\"email\":\"\",\"telefon\":\"\",\"strasse\":\"\",\"hausnummer\":\"\",\"adresszusatz\":\"\",\"plz\":\"\",\"ort\":\"\",\"region\":\"\",\"landCode\":\"\",\"registerNr\":\"\",\"steuerNr\":\"\",\"ustId\":\"\",\"leistung\":\"\"},"
    + "\"kontakte\":[{\"name\":\"\",\"rolle\":\"\",\"email\":\"\",\"telefon\":\"\",\"mobil\":\"\",\"durchwahl\":\"\",\"erreichbarkeit\":\"\",\"sprache\":\"\",\"notiz\":\"\"}],"
    + "\"fakten\":[{\"label\":\"\",\"value\":\"\"}],\"tags\":[],\"verlauf\":{\"typ\":\"email\",\"am\":\"\",\"titel\":\"\",\"text\":\"\"},\"aufgabe\":null}",
].join("\n");

/** Stehen die Ziffern dieser Nummer im Quelltext? (Schreibweise egal: 555-010-0140 = (555) 010 0140.) */
function nummerImText(nummer: string, quelleZiffern: string): boolean {
  const z = nurZiffern(nummer);
  return z.length >= 5 && quelleZiffern.includes(z);
}
const EIGENE_DOMAINS = new Set(["fiaon.com", "fiaon.de", "fiaon.ch", "fiaon.at"]);
const EIGENE_NAMEN = /\b(fiaon|justin schwarzott)\b/i;

/**
 * Die KI-Antwort bereinigen. Was nicht wörtlich im Quelltext steht (E-Mail, Telefon, Website), wird verworfen und
 * in „verworfen“ benannt. FIAON selbst ist nie der Partner. Kontakte ohne Namen und ohne Kontaktweg fallen weg.
 */
export function kiVorschlagBereinigen(roh: unknown, quelltext: string): MailVorschlag {
  const r: any = typeof roh === "string" ? jsonAusText(roh) : roh;
  const quelle = String(quelltext ?? "").toLowerCase();
  const quelleZiffern = nurZiffern(quelltext);
  const verworfen: string[] = [];
  const mailOk = (e: string, wo: string) => {
    if (!e) return "";
    if (!quelle.includes(e)) { verworfen.push(`${wo}: ${e} (steht nicht im Text)`); return ""; }
    if (EIGENE_DOMAINS.has(e.split("@")[1] ?? "")) return "";
    return e;
  };
  const telOk = (t: string, wo: string) => {
    if (!t) return "";
    if (!nummerImText(t, quelleZiffern)) { verworfen.push(`${wo}: ${t} (steht nicht im Text)`); return ""; }
    return t;
  };
  const f = r?.firma ?? {};
  const websiteRoh = websiteSauber(f.website);
  const website = websiteRoh && quelle.includes(domainAus(websiteRoh) || "\u0000") ? websiteRoh : "";
  if (websiteRoh && !website) verworfen.push(`Website: ${websiteRoh} (steht nicht im Text)`);
  let firmaName = zeile(f.name, 160);
  if (EIGENE_NAMEN.test(firmaName)) { verworfen.push(`Firma „${firmaName}“ ist FIAON selbst`); firmaName = ""; }
  const firma = {
    name: firmaName, art: artAus(f.art), website, email: mailOk(emailSauber(f.email), "Firmen-Mail"), telefon: telOk(telefonSauber(f.telefon), "Firmentelefon"),
    registerNr: zeile(f.registerNr, 80), steuerNr: zeile(f.steuerNr, 80), ustId: zeile(f.ustId, 40), leistung: mehrzeilig(f.leistung, 600),
    ...adresseAus(f),
  };
  const kontakte: MailKontakt[] = [];
  for (const k of Array.isArray(r?.kontakte) ? r.kontakte.slice(0, 12) : []) {
    const name = zeile(k?.name, 120);
    if (EIGENE_NAMEN.test(name)) continue;
    // Erst die Durchwahl abtrennen („555-010-0140 ext. 2040“), dann säubern — sonst bleibt „… . 2040“ an der Nummer.
    const geteilt = telefonUndDurchwahl(zeile(k?.telefon, 60));
    const telefon = telOk(geteilt.telefon, `Telefon ${name || "Kontakt"}`);
    const durchwahl = zeile(k?.durchwahl, 12).replace(/\D/g, "") || (telefon ? geteilt.durchwahl : "");
    const kontakt: MailKontakt = {
      name, rolle: zeile(k?.rolle, 120), email: mailOk(emailSauber(k?.email), `E-Mail ${name || "Kontakt"}`), telefon,
      mobil: telOk(telefonSauber(k?.mobil), `Mobil ${name || "Kontakt"}`), durchwahl, erreichbarkeit: zeile(k?.erreichbarkeit, 120),
      sprache: zeile(k?.sprache, 20), notiz: mehrzeilig(k?.notiz, 600),
    };
    if (!kontakt.name && !kontakt.email && !kontakt.telefon) continue;
    if (!kontakt.name) kontakt.name = kontakt.email ? kontakt.email.split("@")[0] : "Kontakt";
    const doppelt = kontakte.find((x) => (kontakt.email && x.email === kontakt.email) || suchNormal(x.name) === suchNormal(kontakt.name));
    if (doppelt) { for (const key of Object.keys(kontakt) as (keyof MailKontakt)[]) if (!doppelt[key]) doppelt[key] = kontakt[key]; continue; }
    kontakte.push(kontakt);
    if (kontakte.length >= 8) break;
  }
  const v = r?.verlauf;
  const verlauf = v && typeof v === "object" && (zeile(v.titel) || zeile(v.text))
    ? { typ: verlaufTypAus(v.typ || "email"), am: isoTag(v.am), titel: zeile(v.titel, 200) || "E-Mail übernommen", text: mehrzeilig(v.text, 2000) }
    : null;
  const a = r?.aufgabe;
  const aufgabe = a && typeof a === "object" && zeile(a.titel).length >= 3 ? { titel: zeile(a.titel, 200), faelligAm: isoTag(a.faelligAm), notiz: mehrzeilig(a.notiz, 1000) } : null;
  return { firma, kontakte, fakten: konditionenSauber(r?.fakten).slice(0, 20), tags: tagsSauber(r?.tags).slice(0, 8), verlauf, aufgabe, verworfen };
}

/** Das erste JSON-Objekt aus einem Text (Modelle schreiben manchmal ```json … ``` darum). */
export function jsonAusText(t: string): any {
  const s = String(t ?? "");
  const a = s.indexOf("{"); const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

/** „555-010-0140 ext. 2040“ → { telefon: "555-010-0140", durchwahl: "2040" }. */
export function telefonUndDurchwahl(roh: string): { telefon: string; durchwahl: string } {
  const m = /^(.*?\d)[\s,]*(?:ext\.?|extension|x|dw\.?|durchwahl|apparat)\s*:?\s*(\d{1,6})\s*$/i.exec(String(roh ?? "").trim());
  if (m) return { telefon: telefonSauber(m[1]), durchwahl: m[2] };
  return { telefon: telefonSauber(roh), durchwahl: "" };
}

const TEL_MUSTER = /(?:\+|00)?\d[\d\s().\/-]{6,}\d(?:[\s,]*(?:ext\.?|extension|x|dw\.?|durchwahl)\s*:?\s*\d{1,6})?/gi;
const MAIL_MUSTER = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
const WEB_MUSTER = /\b(?:https?:\/\/)?(?:www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b|https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b/gi;
const ADRESS_US = /(\d{1,6})\s+([A-Za-z0-9.' ]+?(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pl|Place|Ct|Court|Pkwy|Hwy)\.?)(?:,?\s*((?:Suite|Ste\.?|Unit|#)\s*[A-Za-z0-9-]+))?\s*,?\s*\n?\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/;
const ADRESS_DACH = /([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.' -]+?(?:str\.|straße|strasse|gasse|weg|platz|allee|ring|damm|ufer))\s+(\d+[a-zA-Z]?)\s*,?\s*\n?\s*(?:(D|A|CH)-)?(\d{4,5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß .-]+)/;
const ROLLEN = /\b(account manager|account executive|sales|partner(?:ship)?s?(?: team| manager)?|customer success|support|ceo|cfo|coo|founder|director|manager|geschäftsführer(?:in)?|inhaber(?:in)?|vertrieb|buchhaltung|assistant secretary|secretary|berater(?:in)?|steuerberater(?:in)?|rechtsanwalt|rechtsanwältin)\b/i;

/**
 * Die Regel-Auswertung OHNE KI: E-Mails, Telefonnummern (mit Durchwahl), Website, eine US- oder DACH-Adresse und
 * Namen aus Signaturzeilen. Weniger als die KI, aber nie erfunden — der Rückweg, wenn die KI pausiert oder fehlt.
 */
export function regelVorschlag(quelltext: string): MailVorschlag {
  const text = String(quelltext ?? "").slice(0, KI_MAIL_MAX_ZEICHEN);
  const zeilen = text.split(/\r?\n/).map((z) => z.trim());
  const mails = Array.from(new Set((text.match(MAIL_MUSTER) ?? []).map((m) => m.toLowerCase()))).filter((m) => !EIGENE_DOMAINS.has(m.split("@")[1] ?? ""));
  const webs = (text.match(WEB_MUSTER) ?? []).map(websiteSauber).filter((w) => w && !EIGENE_DOMAINS.has(domainAus(w)));
  const website = webs[0] ?? (mails[0] && domainAus(mails[0]) ? `https://www.${domainAus(mails[0])}` : "");
  const tels: { telefon: string; durchwahl: string; zeile: string }[] = [];
  for (const z of zeilen) {
    if (EIGENE_NAMEN.test(z) || /\+41 44 244/.test(z)) continue;
    for (const m of z.match(TEL_MUSTER) ?? []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(m.trim()) || nurZiffern(m).length < 7 || nurZiffern(m).length > 15) continue;
      const t = telefonUndDurchwahl(m);
      if (t.telefon && !tels.some((x) => nurZiffern(x.telefon) === nurZiffern(t.telefon) && x.durchwahl === t.durchwahl)) tels.push({ ...t, zeile: z });
    }
  }
  // Signaturblock: eine Zeile mit „Vorname Nachname“, darunter eine Rolle.
  const kontakte: MailKontakt[] = [];
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (!/^[A-ZÄÖÜ][a-zäöüß'-]+(?:\s+[A-ZÄÖÜ][a-zäöüß'-]+){1,2}$/.test(z) || EIGENE_NAMEN.test(z)) continue;
    const naechste = zeilen.slice(i + 1, i + 3).join(" ");
    const rolle = ROLLEN.exec(naechste)?.[0] ?? "";
    if (!rolle) continue;
    const block = zeilen.slice(i, i + 8).join("\n");
    const mail = (block.match(MAIL_MUSTER) ?? []).map((m) => m.toLowerCase())[0] ?? "";
    const tel = tels.find((t) => block.includes(t.zeile));
    const erreich = /(mo(?:n(?:day)?)?\.?\s*[-–]\s*fr(?:i(?:day)?)?\.?[^\n]{0,40}\d{1,2}[:.]\d{2}[^\n]{0,30})/i.exec(block)?.[1] ?? "";
    kontakte.push({
      name: z, rolle: zeile(zeilen[i + 1] && ROLLEN.test(zeilen[i + 1]) ? zeilen[i + 1] : rolle, 120), email: mail,
      telefon: tel?.telefon ?? "", mobil: "", durchwahl: tel?.durchwahl ?? "", erreichbarkeit: zeile(erreich, 120), sprache: "", notiz: "",
    });
  }
  for (const m of mails) if (!kontakte.some((k) => k.email === m) && kontakte.length < 8) {
    if (kontakte.length && !kontakte[kontakte.length - 1].email) { kontakte[kontakte.length - 1].email = m; continue; }
  }
  let adresse = adresseAus({});
  const us = ADRESS_US.exec(text);
  if (us) adresse = { strasse: zeile(us[2]), hausnummer: us[1], adresszusatz: zeile(us[3] ?? ""), plz: us[6], ort: zeile(us[4]), region: us[5], landCode: "US" };
  else {
    const d = ADRESS_DACH.exec(text);
    if (d) adresse = { strasse: zeile(d[1]), hausnummer: d[2], adresszusatz: "", plz: d[4], ort: zeile(d[5]), region: "", landCode: d[3] === "A" ? "AT" : d[3] === "CH" ? "CH" : d[4].length === 4 ? "" : "DE" };
  }
  // Firmenname: eine Zeile mit Rechtsform (LLC, GmbH …), die nicht FIAON ist.
  const firmaZeile = zeilen.find((z) => /\b(LLC|L\.L\.C\.|Inc\.?|Ltd\.?|GmbH|AG|UG|Corp\.?|Corporation|KG|PLLC|LLP)\b/.test(z) && !EIGENE_NAMEN.test(z) && z.length <= 90) ?? "";
  const firmaName = zeile(firmaZeile.replace(/^(?:von|from|bei|at)\s+/i, "").replace(/[,|·].*$/, ""), 160);
  const firmaMail = mails.find((m) => /^(info|partners?|sales|support|office|kontakt|contact|hello|team)@/.test(m)) ?? "";
  const firmaTel = tels.find((t) => !kontakte.some((k) => nurZiffern(k.telefon) === nurZiffern(t.telefon) && k.durchwahl === t.durchwahl))?.telefon ?? "";
  // Mitdenken ohne KI: Art aus Name und Rollen (Steuerberaterin → Kanzlei), eine „Bitte …“-Zeile als Aufgabenvorschlag.
  const artText = [firmaName, ...kontakte.map((k) => k.rolle)].join(" ");
  const art = artAus(artText);
  let bitte = "";
  for (const satz of zeilen.filter((z) => !z.startsWith(">")).join(" ").match(/[^.!?]+[.!?]?/g) ?? []) {
    const m = /(?:^|[,:]\s*)((?:bitte|please|kindly|could you|können sie|koennen sie)\b[\s\S]*)$/i.exec(satz.trim());
    if (m) { bitte = m[1]; break; }
  }
  const aufgabe = bitte ? { titel: zeile(bitte.replace(/[.!?]+$/, ""), 160), faelligAm: "", notiz: "" } : null;
  const absender = kontakte[0]?.name;
  return {
    firma: { name: firmaName, art, website, email: firmaMail, telefon: firmaTel, registerNr: "", steuerNr: "", ustId: "", leistung: "", ...adresse },
    kontakte, fakten: [], tags: [], verlauf: { typ: "email", am: "", titel: absender ? `E-Mail von ${absender}` : "E-Mail übernommen", text: "" }, aufgabe, verworfen: [],
  };
}

/**
 * KI-Vorschlag um das ergänzen, was die Regeln sicher gefunden haben (nie ersetzen): fehlende Website, Adresse,
 * Telefonnummern — und E-Mail-Adressen aus dem Text, die keinem Kontakt zugeordnet sind, als Hinweis.
 */
export function vorschlagErgaenzen(ki: MailVorschlag, regel: MailVorschlag): MailVorschlag {
  const aus: MailVorschlag = JSON.parse(JSON.stringify(ki));
  const f = aus.firma;
  for (const k of ["website", "email", "telefon", "strasse", "hausnummer", "adresszusatz", "plz", "ort", "region", "landCode"] as const) {
    if (!f[k] && regel.firma[k]) (f as any)[k] = regel.firma[k];
  }
  if (!f.name && regel.firma.name) f.name = regel.firma.name;
  for (const rk of regel.kontakte) {
    const k = aus.kontakte.find((x) => suchNormal(x.name) === suchNormal(rk.name) || (rk.email && x.email === rk.email));
    if (!k) continue;
    for (const key of ["email", "telefon", "durchwahl", "erreichbarkeit", "rolle"] as const) if (!k[key] && rk[key]) k[key] = rk[key];
  }
  return aus;
}

// ── Adressvorschläge (Photon / OpenStreetMap) ──────────────────────────────
export interface AdressVorschlag { zeile: string; strasse: string; hausnummer: string; plz: string; ort: string; region: string; landCode: string; land: string }
/**
 * Photon antwortet mit GeoJSON (features[].properties: name, street, housenumber, postcode, city, state, countrycode …).
 * Ohne Ort fällt ein Treffer weg; doppelte Zeilen auch. Höchstens sechs.
 */
export function photonZuVorschlaegen(antwort: unknown): AdressVorschlag[] {
  const features = Array.isArray((antwort as any)?.features) ? (antwort as any).features : [];
  const aus: AdressVorschlag[] = [];
  for (const ft of features) {
    const p = ft?.properties ?? {};
    const istStrasse = p.osm_key === "highway" || p.type === "street";
    const strasse = zeile(p.street || (istStrasse ? p.name : ""), 160);
    const ort = zeile(p.city || p.town || p.village || p.locality || p.district || (p.type === "city" ? p.name : ""), 120);
    if (!ort) continue;
    const v: AdressVorschlag = {
      strasse, hausnummer: zeile(p.housenumber, 20), plz: zeile(p.postcode, 16), ort, region: zeile(p.state, 80),
      landCode: zeile(p.countrycode, 2).toUpperCase(), land: zeile(p.country, 60), zeile: "",
    };
    const name = zeile(p.name, 120);
    const kopf = [name && name !== strasse && name !== ort && !istStrasse ? name : "", [v.strasse, v.hausnummer].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    v.zeile = [kopf, [v.plz, v.ort].filter(Boolean).join(" "), v.region && v.landCode === "US" ? v.region : "", v.land || v.landCode].filter(Boolean).join(", ");
    if (!aus.some((x) => x.zeile === v.zeile)) aus.push(v);
    if (aus.length >= 6) break;
  }
  return aus;
}
/** Wann lohnt eine Anfrage? Mindestens 4 Zeichen und eine Buchstabenfolge — „12“ fragt nicht. */
export function adressAnfrageSinnvoll(q: unknown): boolean {
  const s = zeile(q, 200);
  return s.length >= 4 && /[A-Za-zÄÖÜäöüß]{3,}/.test(s);
}

// ── „Was steht an?“ ohne KI ────────────────────────────────────────────────
export interface LageEingang {
  heute: string;
  status: PartnerStatus; art: PartnerArt; konditionen: Kondition[];
  kontakte: { name: string; email: string; telefon: string; haupt: boolean }[];
  aufgaben: { titel: string; faelligAm: string | null; erledigt: boolean }[];
  verlauf: { am: string; typ: string; titel: string }[];
  dokumente: { titel: string; art: string; gueltigBis: string | null }[];
}
export interface LageHinweis { art: "rot" | "gelb" | "ruhig"; text: string }
/** Die Hinweise, die ein aufmerksamer Mensch geben würde — aus Aufgaben, Verlauf, Dokumenten und Stammdaten. */
export function partnerHinweise(e: LageEingang): LageHinweis[] {
  const h: LageHinweis[] = [];
  const offen = e.aufgaben.filter((a) => !a.erledigt);
  const ueber = offen.filter((a) => a.faelligAm && a.faelligAm < e.heute).sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)));
  if (ueber.length) {
    const t = tageZwischen(ueber[0].faelligAm!, e.heute);
    h.push({ art: "rot", text: `${ueber.length === 1 ? "Eine Aufgabe ist" : `${ueber.length} Aufgaben sind`} überfällig — „${ueber[0].titel}“ seit ${t} ${t === 1 ? "Tag" : "Tagen"}.` });
  }
  const heuteFaellig = offen.filter((a) => a.faelligAm === e.heute);
  if (heuteFaellig.length) h.push({ art: "gelb", text: `Heute fällig: ${heuteFaellig.map((a) => `„${a.titel}“`).join(", ")}.` });
  const naechste = offen.filter((a) => a.faelligAm && a.faelligAm > e.heute).sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)))[0];
  if (naechste) {
    const t = tageZwischen(e.heute, naechste.faelligAm!);
    h.push({ art: "ruhig", text: `Als Nächstes: „${naechste.titel}“ — ${t === 1 ? "morgen" : `in ${t} Tagen`} fällig.` });
  }
  const laufend = e.status === "aktiv" || e.status === "gespraech";
  if (laufend && offen.length === 0) h.push({ art: "gelb", text: "Keine offene Aufgabe — den nächsten Schritt festlegen?" });
  for (const d of e.dokumente) {
    if (!d.gueltigBis) continue;
    const t = tageZwischen(e.heute, d.gueltigBis);
    if (t < 0) h.push({ art: e.status === "aktiv" ? "rot" : "ruhig", text: `„${d.titel}“ ist seit ${-t} ${t === -1 ? "Tag" : "Tagen"} abgelaufen.` });
    else if (t <= 60) h.push({ art: t <= 14 ? "rot" : "gelb", text: `„${d.titel}“ läuft in ${t} ${t === 1 ? "Tag" : "Tagen"} aus.` });
  }
  const letzter = e.verlauf.map((v) => v.am).sort().pop();
  if (laufend && letzter) {
    const t = tageZwischen(letzter.slice(0, 10), e.heute);
    if (t >= 30) h.push({ art: "gelb", text: `Letzter Kontakt vor ${t} Tagen — kurz melden?` });
  }
  if (laufend && !letzter) h.push({ art: "gelb", text: "Noch kein Eintrag im Verlauf." });
  if (e.kontakte.length === 0) h.push({ art: "gelb", text: "Noch kein Ansprechpartner hinterlegt." });
  else if (!e.kontakte.some((k) => k.haupt)) h.push({ art: "ruhig", text: "Kein Hauptkontakt markiert." });
  for (const k of e.kontakte) if (!k.email && !k.telefon) h.push({ art: "ruhig", text: `${k.name}: weder E-Mail noch Telefon.` });
  if (e.status === "aktiv" && !e.dokumente.some((d) => d.art === "vertrag" || d.art === "vereinbarung")) h.push({ art: "gelb", text: "Aktiv, aber kein Vertrag und keine Vereinbarung abgelegt." });
  if ((e.art === "lieferant" || e.art === "kooperation") && e.konditionen.length === 0) h.push({ art: "ruhig", text: "Keine Konditionen hinterlegt." });
  return h;
}

/** Der Text für die KI-Zusammenfassung „Was steht an?“ — nur die Lage, keine Vertragsdetails darüber hinaus. */
export function lageText(e: LageEingang & { name: string }): string {
  const offen = e.aufgaben.filter((a) => !a.erledigt);
  return [
    `Heute: ${e.heute}. Partner: ${e.name} (${textFuer(PARTNER_ARTEN, e.art)}, Status ${textFuer(PARTNER_STATUS, e.status)}).`,
    `Offene Aufgaben: ${offen.length ? offen.map((a) => `${a.titel}${a.faelligAm ? ` (fällig ${a.faelligAm})` : ""}`).join("; ") : "keine"}.`,
    `Letzte Einträge: ${e.verlauf.slice(0, 12).map((v) => `${v.am.slice(0, 10)} ${textFuer(VERLAUF_TYPEN, v.typ)}: ${v.titel}`).join(" | ") || "keine"}.`,
    `Dokumente: ${e.dokumente.map((d) => `${d.titel}${d.gueltigBis ? ` (gültig bis ${d.gueltigBis})` : ""}`).join("; ") || "keine"}.`,
  ].join("\n");
}
export const KI_LAGE_ANWEISUNG =
  "Du bist der aufmerksame Assistent der Geschäftsleitung von FIAON. Fasse in höchstens 4 kurzen Sätzen auf Deutsch zusammen, "
  + "was bei diesem Geschäftspartner als Nächstes ansteht: überfällige und nächste Aufgaben zuerst, dann auslaufende Dokumente, "
  + "dann ein konkreter Vorschlag für den nächsten Schritt. Einfache Worte, keine Floskeln, nichts erfinden, keine Aufzählungszeichen.";
