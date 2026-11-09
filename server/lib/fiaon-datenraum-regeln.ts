// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DIE REINEN REGELN DES SERVERS (E-489, 09.11.2026)
//
// Was der Server bei jeder Anfrage entscheidet, ohne Datenbank und ohne Netz
// nachrechenbar (scripts/pruef-datenraum.ts, Teil A):
//   · Welche Datei ist das? Am INHALT erkannt, nie am Namen (Muster
//     fiaon-global-bereich-regeln.ts) — PDF, JPG, PNG und Word/Excel/PowerPoint
//     im OOXML-Format ohne Makros. HTML, SVG und alte Office-Formate (OLE) nie.
//   · Ist im Unterschriftsbild Tinte? (Muster der Firmen-Annahme, E-301.)
//   · Einladungscodes erzeugen und nur als Prüfsumme speichern.
//   · Das Sitzungs-Plätzchen: signiert, mit Ablauf und Sitzungsstand des Gastes
//     (Sperren oder neuer Code beendet jede offene Sitzung sofort).
//   · Darf dieser Gast dieses Dokument sehen? — die EINE Regel.
//   · Wer fragt an? Die IP des Gastes hinter Cloudflare.
//
// Nachbesserung (drei Gutachten, 09.11.2026):
//   · IP: cf-connecting-ip nur, wenn die Anfrage wirklich von Cloudflare kommt (der
//     Absender, den Render sieht, liegt in einem Netz von Cloudflare) — sonst die
//     Adresse, die Render sieht. req.ip allein ist hinter Cloudflare der Rand von
//     Cloudflare (in der Produktion 7 von 7 Fällen), der erste X-Forwarded-For-Eintrag
//     ist frei wählbar. Die rohe Kette wird mitgespeichert.
//   · Unterschriftsbild: entpackt höchstens so viel, wie die Bildmaße erlauben
//     (vorher: 200 KB → 200 MB Speicher), höchstens 2400 × 1000 Punkte und 300 KB.
//   · Codes: HMAC mit einem geheimen Schlüssel statt reiner SHA-256, Hinweis nur
//     noch zwei Zeichen. Ohne SESSION_SECRET in der Produktion: Fehler statt eines
//     Ersatzschlüssels aus dem öffentlichen Repo.
//   · Vermerk mit Vorgangsnummer („· DR-1234“) — jede Kopie passt zu genau einer
//     Protokollzeile.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { DR_CODE_ALPHABET, DR_CODE_ZEICHEN, DR_DATEI_MAX_BYTES, drCodeAnzeige, type DrDateiArt } from "@shared/fiaon-datenraum-nda";
import { globalDateiname, globalDateinameKopf } from "./fiaon-global-bereich-regeln";

// ── Dateien ────────────────────────────────────────────────────────────────
export interface DrDateiTyp { mime: string; endung: string; art: DrDateiArt }
const OOXML: { marke: string; mime: string; endung: string }[] = [
  { marke: "word/document.xml", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", endung: "docx" },
  { marke: "xl/workbook.xml", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", endung: "xlsx" },
  { marke: "ppt/presentation.xml", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", endung: "pptx" },
];
/** Die Typen, die der Raum ausliefert — und nur diese. */
export const DR_AUSLIEFERBAR = new Set(["application/pdf", "image/jpeg", "image/png", ...OOXML.map((o) => o.mime)]);

/** Typ aus den Bytes — oder der Satz, warum die Datei nicht angenommen wird. */
export function drDateiTyp(b: Uint8Array | null | undefined): DrDateiTyp | { fehler: string } {
  if (!b || b.length < 16) return { fehler: "Die Datei ist leer oder beschädigt." };
  if (b.length > DR_DATEI_MAX_BYTES) return { fehler: "Die Datei ist größer als 25 MB." };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: "application/pdf", endung: "pdf", art: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", endung: "jpg", art: "bild" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { mime: "image/png", endung: "png", art: "bild" };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // Ein Office-Dokument ist ein ZIP-Behälter. Die Namen der Einträge stehen unverschlüsselt im Behälter —
    // daran erkennen wir die Art, und an „vbaProject.bin“ die Makros (.docm/.xlsm/.pptm), die hier nie hineinkommen.
    const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
    if (buf.indexOf("[Content_Types].xml", 0, "latin1") < 0) return { fehler: "Nur PDF, JPG, PNG oder Word, Excel, PowerPoint — erkannt am Inhalt der Datei." };
    if (buf.indexOf("vbaProject.bin", 0, "latin1") >= 0) return { fehler: "Dateien mit Makros nehmen wir nicht an. Bitte als PDF oder ohne Makros speichern." };
    const o = OOXML.find((x) => buf.indexOf(x.marke, 0, "latin1") >= 0);
    if (o) return { mime: o.mime, endung: o.endung, art: "office" };
  }
  return { fehler: "Nur PDF, JPG, PNG oder Word, Excel, PowerPoint — erkannt am Inhalt der Datei." };
}
export function drDateiArtVonMime(mime: string): DrDateiArt {
  return mime === "application/pdf" ? "pdf" : mime.startsWith("image/") ? "bild" : "office";
}
/** Der Name in Liste und Antwortkopf — ohne Pfad und Steuerzeichen, mit der Endung des ERKANNTEN Inhalts. */
export function drDateiname(roh: unknown, endung: string): string { return globalDateiname(roh, endung); }
/** Content-Disposition für Ansehen (inline) oder Herunterladen (attachment) — ASCII plus UTF-8-Form. */
export function drDispositionKopf(art: "inline" | "attachment", dateiname: string): string {
  return `${art}; filename="${globalDateinameKopf(dateiname)}"; filename*=UTF-8''${encodeURIComponent(dateiname)}`;
}

// ── Unterschriftsbild ──────────────────────────────────────────────────────
const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Grenzen des Unterschriftsbilds — ein zugeschnittenes Canvas bleibt weit darunter (die Seite skaliert vorher). */
export const DR_PNG = { maxBytes: 300_000, maxBreite: 2400, maxHoehe: 1000, minBreite: 60, minHoehe: 24, maxDataUrl: 420_000 } as const;
/** Liest „data:image/png;base64,…“ — null, wenn es keins ist oder zu groß (vor dem Dekodieren geprüft). */
export function drPngAusDataUrl(v: unknown): Buffer | null {
  const s = String(v ?? "");
  if (s.length > DR_PNG.maxDataUrl) return null;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return null;
  try { return Buffer.from(m[1], "base64"); } catch { return null; }
}
/**
 * null = gültige Unterschrift; sonst der Grund. Nur RGBA mit 8 Bit, nicht verschachtelt (so liefert jedes Canvas),
 * Tinte = deckende Punkte. Entpackt wird höchstens Breite × Höhe — eine „Bombe“ (kleine Datei, riesiger Inhalt) bricht
 * beim ersten Byte zu viel ab, statt den Speicher zu füllen.
 */
export function drPngTintePruefen(png: Buffer | null): string | null {
  if (!png || png.length < 200 || png.length > DR_PNG.maxBytes || !png.subarray(0, 8).equals(PNG_KOPF)) return "kein gültiges Bild";
  let pos = 8; let breite = 0; let hoehe = 0; let tiefe = 0; let farbe = 0; let verschachtelt = 0; const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const laenge = png.readUInt32BE(pos); const art = png.toString("latin1", pos + 4, pos + 8);
    const daten = png.subarray(pos + 8, pos + 8 + laenge);
    if (daten.length !== laenge) return "Bild abgeschnitten";
    if (art === "IHDR") { if (laenge < 13) return "Bildkopf kaputt"; breite = daten.readUInt32BE(0); hoehe = daten.readUInt32BE(4); tiefe = daten[8]; farbe = daten[9]; verschachtelt = daten[12]; }
    else if (art === "IDAT") idat.push(daten);
    else if (art === "IEND") break;
    pos += 12 + laenge;
  }
  if (breite < DR_PNG.minBreite || hoehe < DR_PNG.minHoehe || breite > DR_PNG.maxBreite || hoehe > DR_PNG.maxHoehe || !idat.length) return "Bildmaße unpassend";
  if (farbe !== 6 || tiefe !== 8 || verschachtelt !== 0) return "Bildformat unpassend";
  const zeile = breite * 4 + 1;
  const soll = zeile * hoehe;
  let roh: Buffer;
  try { roh = inflateSync(Buffer.concat(idat), { maxOutputLength: soll }); } catch { return "Bild nicht lesbar"; }
  if (roh.length !== soll) return "Bild unvollständig";
  let tinte = 0;
  for (let y = 0; y < hoehe; y++) { const a = y * zeile + 1; for (let x = a; x < a + zeile - 1; x++) if (roh[x] !== 0) { tinte++; if (tinte > 60) return null; } }
  return "Das Unterschriftsfeld ist leer";
}

// ── Geheimnis, Codes und Kennungen ─────────────────────────────────────────
/** Der Schlüssel für Plätzchen und Code-Prüfsummen. In der Produktion ohne SESSION_SECRET: Fehler (Muster fiaon-vertrag-bestaetigen.ts). */
export function drGeheimnis(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.SESSION_SECRET;
  if (s) return s;
  if (env.NODE_ENV === "production") throw new Error("Der Datenraum ist ohne SESSION_SECRET abgeschaltet.");
  return "fiaon-dev-datenraum-nur-lokal";
}
/** Ein neuer Einladungscode: Anzeige (einmal), Prüfsumme (gespeichert) und die letzten ZWEI Zeichen (Wiedererkennen). */
export function drCodeErzeugen(geheim: string = drGeheimnis()): { code: string; normal: string; hash: string; hinweis: string } {
  let k = "";
  for (let i = 0; i < DR_CODE_ZEICHEN; i++) k += DR_CODE_ALPHABET[randomInt(DR_CODE_ALPHABET.length)];
  const normal = `DR${k}`;
  return { code: drCodeAnzeige(normal), normal, hash: drCodeHash(normal, geheim), hinweis: k.slice(-2) };
}
/**
 * Gespeichert wird nur diese Prüfsumme: HMAC-SHA256 mit dem geheimen Schlüssel. Wer nur eine Kopie der Tabelle hat,
 * kann sie nicht durchprobieren (Gutachten 09.11.2026: reine SHA-256 plus vier Klarzeichen ließen sich in Minuten raten).
 * Wird SESSION_SECRET gewechselt, gelten alte Codes nicht mehr — dann „Neuer Code“ am Gast.
 */
export function drCodeHash(normal: string, geheim: string = drGeheimnis()): string {
  return createHmac("sha256", `fiaon-dr-code.v2:${geheim}`).update(normal).digest("hex");
}
/** Prüfsumme eines Bestätigungscodes per E-Mail (sechs Ziffern) — gebunden an Gast und Adresse. */
export function drEmailCodeHash(gastId: number, email: string, code: string, geheim: string = drGeheimnis()): string {
  return createHmac("sha256", `fiaon-dr-email.v1:${geheim}`).update(`${gastId}:${String(email).toLowerCase()}:${code}`).digest("hex");
}
export function drEmailCodeErzeugen(): string { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
/** Zufällige, nicht ratbare Kennung (Dokumente in Adressen). */
export function drKennung(): string { return randomBytes(16).toString("base64url"); }
export const drSha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
/** Vergleich in fester Zeit. */
export function drGleich(a: string, b: string): boolean {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// ── Sitzung ────────────────────────────────────────────────────────────────
export const DR_COOKIE = "fiaon_dr";
export const DR_COOKIE_PFAD = "/api/fiaon/datenraum";
export const DR_SITZUNG_TAGE = 7;
function drSignatur(gastId: number, version: number, bis: number, geheim: string): string {
  return createHmac("sha256", geheim).update(`fiaon-dr.v1:${gastId}:${version}:${bis}`).digest("hex").slice(0, 40);
}
/** gastId.version.bis.signatur — `version` ist der Sitzungsstand des Gastes (Sperren und neuer Code erhöhen ihn). */
export function drTokenBauen(gastId: number, version: number, geheim: string, jetzt = Date.now()): string {
  const bis = jetzt + DR_SITZUNG_TAGE * 24 * 3600_000;
  return `${gastId}.${version}.${bis}.${drSignatur(gastId, version, bis, geheim)}`;
}
export function drTokenPruefen(token: unknown, geheim: string, jetzt = Date.now()): { gastId: number; version: number } | null {
  if (typeof token !== "string" || token.length > 120) return null;
  const t = token.split(".");
  if (t.length !== 4) return null;
  const gastId = Number(t[0]); const version = Number(t[1]); const bis = Number(t[2]);
  if (!Number.isInteger(gastId) || gastId <= 0 || !Number.isInteger(version) || version < 1 || !Number.isFinite(bis) || bis < jetzt) return null;
  if (!drGleich(String(t[3]), drSignatur(gastId, version, bis, geheim))) return null;
  return { gastId, version };
}

// ── Wer fragt an? ──────────────────────────────────────────────────────────
// Die Netze von Cloudflare (cloudflare.com/ips, Stand 2026). Nur wenn der Absender, den Render sieht, darin liegt, ist
// cf-connecting-ip echt — wer fiaon-plattform.onrender.com direkt aufruft, könnte den Kopf sonst selbst setzen.
const CF_V4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14",
  "172.64.0.0/13", "131.0.72.0/22"];
const CF_V6 = ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"];
function v4Zahl(ip: string): number | null {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip.trim());
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}
function v6Gruppen(ip: string): number[] | null {
  const s = ip.trim().toLowerCase().replace(/%.*$/, "");
  if (!/^[0-9a-f:]+$/.test(s) || !s.includes(":")) return null;
  const teile = s.split("::");
  if (teile.length > 2) return null;
  const links = teile[0] ? teile[0].split(":") : [];
  const rechts = teile.length === 2 && teile[1] ? teile[1].split(":") : [];
  const fehlt = 8 - links.length - rechts.length;
  if (fehlt < 0 || (teile.length === 1 && fehlt !== 0)) return null;
  const g = [...links, ...Array(teile.length === 2 ? fehlt : 0).fill("0"), ...rechts].map((x) => parseInt(x || "0", 16));
  return g.length === 8 && g.every((x) => Number.isFinite(x) && x >= 0 && x <= 0xffff) ? g : null;
}
export function drIstCloudflare(ip: string): boolean {
  const z = v4Zahl(ip);
  if (z != null) {
    return CF_V4.some((n) => {
      const [a, b] = n.split("/"); const basis = v4Zahl(a)!; const bits = Number(b);
      const maske = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return ((z & maske) >>> 0) === ((basis & maske) >>> 0);
    });
  }
  const g = v6Gruppen(ip);
  if (!g) return false;
  return CF_V6.some((n) => {
    const [a, b] = n.split("/"); const basis = v6Gruppen(a)!; let bits = Number(b);
    for (let i = 0; i < 8 && bits > 0; i++) {
      const m = bits >= 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
      if ((g[i] & m) !== (basis[i] & m)) return false;
      bits -= 16;
    }
    return true;
  });
}
/**
 * Die IP des Gastes und die rohe Kette (für den Nachweis). `peer` ist req.ip (trust proxy 1: die Adresse, die Render
 * sieht — hinter Cloudflare der Rand von Cloudflare). cf-connecting-ip gilt nur, wenn `peer` ein Rand von Cloudflare ist.
 * `anschluss` ist der Schlüssel der Bremse (IPv4 voll, IPv6 je /64 — Muster anschlussSchluessel).
 */
export function drClientIp(kopf: Record<string, string | string[] | undefined>, peer: string | null | undefined, socket?: string | null): { ip: string; kette: string; anschluss: string } {
  const k = (n: string) => { const v = kopf[n]; return String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim().slice(0, 300); };
  const cf = k("cf-connecting-ip"); const xff = k("x-forwarded-for");
  const rand = String(peer || socket || "").trim().replace(/^::ffff:/i, "");
  const cfEcht = !!cf && !!rand && drIstCloudflare(rand) && (v4Zahl(cf) != null || v6Gruppen(cf) != null);
  const ip = (cfEcht ? cf : rand).replace(/^::ffff:/i, "").slice(0, 80);
  return { ip, kette: `cf=${cf || "-"}; xff=${xff || "-"}; peer=${rand || "-"}`.slice(0, 400), anschluss: drAnschluss(ip) };
}
/**
 * Der Schlüssel der Bremse — wie anschlussSchluessel (fiaon-global-angebot-aufrufe.ts, hier ohne Datenbank-Import):
 * IPv4 als volle Adresse, IPv6 als /64 (Datenschutz-Adressen wechseln den hinteren Teil).
 */
export function drAnschluss(ip: string): string {
  const s = String(ip ?? "").trim().toLowerCase();
  if (v4Zahl(s) != null) return s.replace(/^::ffff:/, "").slice(0, 80);
  const g = v6Gruppen(s);
  return g ? `${g.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64` : s.slice(0, 80);
}

// ── Die EINE Zugriffsregel ─────────────────────────────────────────────────
export interface DrZugriffLage {
  /** Gültige Sitzung mit passendem Sitzungsstand. */
  angemeldet: boolean;
  gastRaumId: number | null;
  gastGesperrt: boolean;
  raumArchiviert: boolean;
  /** Projekte, die eine unterzeichnete Vereinbarung in ihrer HEUTIGEN Fassung deckt — null = noch keine Vereinbarung. */
  ndaProjektIds: number[] | null;
  dokument: { raumId: number; projektId: number; sichtbar: boolean; entfernt: boolean; projektEntfernt: boolean } | null;
}
export type DrZugriff =
  | { erlaubt: true }
  | { erlaubt: false; status: 401 | 403 | 404; grund: "anmeldung" | "gesperrt" | "unbekannt" | "nda" | "nachtrag"; text: string };
/**
 * Darf der Gast das Dokument öffnen? Reihenfolge mit Absicht: Ein fremdes, entferntes oder unsichtbares Dokument
 * ist „unbekannt“ (404) — der Gast erfährt nicht, dass es das gibt. Erst danach zählt die Vereinbarung.
 */
export function drZugriff(z: DrZugriffLage): DrZugriff {
  if (!z.angemeldet || z.gastRaumId == null) return { erlaubt: false, status: 401, grund: "anmeldung", text: "Bitte melden Sie sich mit Ihrem Einladungscode erneut an." };
  if (z.gastGesperrt || z.raumArchiviert) return { erlaubt: false, status: 403, grund: "gesperrt", text: "Ihr Zugang ist derzeit nicht freigeschaltet." };
  const d = z.dokument;
  if (!d || d.raumId !== z.gastRaumId || d.entfernt || !d.sichtbar || d.projektEntfernt) {
    return { erlaubt: false, status: 404, grund: "unbekannt", text: "Dieses Dokument gibt es hier nicht." };
  }
  if (!z.ndaProjektIds) return { erlaubt: false, status: 403, grund: "nda", text: "Bitte unterzeichnen Sie zuerst die Vertraulichkeitsvereinbarung." };
  if (!z.ndaProjektIds.includes(d.projektId)) return { erlaubt: false, status: 403, grund: "nachtrag", text: "Für dieses Thema ergänzen wir Ihre Vereinbarung — bitte bestätigen Sie die ergänzte Fassung im Datenraum." };
  return { erlaubt: true };
}

// ── Warteschlange (je Instanz) ─────────────────────────────────────────────
/**
 * Höchstens `max` Arbeiten gleichzeitig; weitere warten bis zu `wartenMs` — dann Absage. Der Inhalt eines Dokuments
 * wird erst INNERHALB geladen: Wartende halten keinen Speicher.
 */
export function drWarteschlange(max: number, wartenMs: number) {
  let laufend = 0; const wartend: (() => void)[] = [];
  return async function <T>(arbeit: () => Promise<T>): Promise<{ ok: true; wert: T } | { ok: false }> {
    if (laufend >= max) {
      const bekommen = await new Promise<boolean>((r) => {
        const weiter = () => { clearTimeout(t); r(true); };
        const t = setTimeout(() => { const i = wartend.indexOf(weiter); if (i >= 0) wartend.splice(i, 1); r(false); }, wartenMs);
        wartend.push(weiter);
      });
      if (!bekommen) return { ok: false };
    } else laufend++;
    try { return { ok: true, wert: await arbeit() }; } finally {
      const n = wartend.shift();
      if (n) n(); else laufend--;
    }
  };
}

// ── Zeit (Europe/Berlin) ───────────────────────────────────────────────────
/** „09.11.2026“ */
export function drBerlinDatum(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
/** „9. November 2026 um 15:42 Uhr“ */
export function drBerlinZeitLang(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric" }).format(d);
  const u = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${t} um ${u} Uhr`;
}
/** Die Vorgangsnummer einer Auslieferung (= Kennung der Protokollzeile). */
export const drVorgang = (protokollId: number) => `DR-${protokollId}`;
/** Der Vermerk auf jeder ausgelieferten PDF-Seite: „Vertraulich · Name · 09.11.2026 · DR-1234“. */
export function drVermerkText(name: string, d: Date, vorgang?: string | null): string {
  return `Vertraulich · ${String(name).replace(/\s+/g, " ").trim()} · ${drBerlinDatum(d)}${vorgang ? ` · ${vorgang}` : ""}`;
}
