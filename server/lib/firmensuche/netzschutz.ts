// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — NETZSCHUTZ: FREMDE ADRESSEN SICHER ABRUFEN (17.09.2026, E-188)
//
// Der Impressum-Leser ruft eine Adresse ab, die ein BESUCHER OHNE LOGIN
// eingetippt hat. Ohne Schutz wäre das ein Fernrohr ins eigene Netz: Wer
// „http://169.254.169.254/…" oder „http://localhost:5432" eingibt, ließe den
// Server bei sich selbst oder beim Cloud-Anbieter anklopfen (SSRF).
//
// DIE WAND HAT VIER SCHICHTEN — jede für sich würde umgangen:
//   1. urlPruefen: nur http/https, keine Zugangsdaten in der Adresse, nur die
//      Ports 80/443, kein „localhost"/„.internal"/…, und nackte IP-Adressen
//      gar nicht. Die URL-Klasse von Node normalisiert dabei die Tarnformen
//      („2130706433", „0x7f.1", „127.1") zu 127.0.0.1 — sie fallen mit.
//   2. sichererLookup: Die Namensauflösung gehört ZUR VERBINDUNG. Node fragt
//      DIESE Funktion nach der Adresse und verbindet genau dorthin — eine
//      zweite Auflösung mit anderem Ergebnis (DNS-Rebinding) gibt es nicht.
//      Liefert ein Name AUCH NUR EINE gesperrte Adresse, wird abgelehnt.
//   3. Weiterleitungen folgt der Abruf SELBST, höchstens dreimal, und jede
//      neue Adresse läuft wieder durch Schicht 1 und 2.
//   4. Nach dem Verbinden wird die Gegenstelle des Sockets noch einmal
//      geprüft — Gürtel zum Hosenträger.
// Dazu: 6 s Frist je Seite, 600 KB Deckel auf den ENTPACKTEN Inhalt (keine
// Zip-Bombe), nur Textformate, ehrlicher User-Agent.
//
// Der Transport ist austauschbar — der Prüfstand spielt damit Weiterleitungen
// auf private Adressen durch, ohne das Netz zu berühren.
// ═══════════════════════════════════════════════════════════════════════════
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { AGENT_KENNUNG } from "./typen";

export type SchutzGrund = "schema" | "zugangsdaten" | "port" | "hostname" | "private_adresse" | "weiterleitungen"
  | "zeit" | "netz" | "inhaltstyp" | "robots" | "status";

export class NetzschutzFehler extends Error {
  grund: SchutzGrund;
  constructor(grund: SchutzGrund, text: string) { super(text); this.grund = grund; }
}

// ── Schicht 0: Welche Adressen sind tabu? ───────────────────────────────────
function v4Zahlen(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const z = m.slice(1).map(Number);
  return z.every((n) => n >= 0 && n <= 255) ? z : null;
}

function v4Gesperrt([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127                 // „dieses Netz", privat, Loopback
    || (a === 100 && b >= 64 && b <= 127)                 // 100.64/10 Carrier-NAT
    || (a === 169 && b === 254)                           // Link-Local samt Metadaten-Dienst 169.254.169.254
    || (a === 172 && b >= 16 && b <= 31)                  // privat
    || (a === 192 && b === 168)                           // privat
    || (a === 192 && b === 0 && (c === 0 || c === 2))     // IETF-Protokolle, Doku
    || (a === 192 && b === 88 && c === 99)                // 6to4-Relay
    || (a === 198 && (b === 18 || b === 19))              // Lasttests
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // Doku
    || a >= 224;                                          // Multicast, reserviert, Broadcast
}

/** IPv6 in acht 16-Bit-Gruppen; versteht „::", eingebettetes IPv4 am Ende und Zonen („%eth0"). */
function v6Gruppen(roh: string): number[] | null {
  let ip = roh.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!ip.includes(":")) return null;
  const v4 = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const z = v4Zahlen(v4[1]);
    if (!z) return null;
    ip = ip.slice(0, -v4[1].length) + ((z[0] << 8) | z[1]).toString(16) + ":" + ((z[2] << 8) | z[3]).toString(16);
  }
  const haelften = ip.split("::");
  if (haelften.length > 2) return null;
  const lese = (t: string) => (t ? t.split(":") : []);
  const vorn = lese(haelften[0]), hinten = haelften.length === 2 ? lese(haelften[1]) : [];
  const fehlt = 8 - vorn.length - hinten.length;
  if (haelften.length === 1 ? vorn.length !== 8 : fehlt < 1) return null;
  const alle = [...vorn, ...Array(haelften.length === 2 ? fehlt : 0).fill("0"), ...hinten];
  if (alle.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return alle.map((g) => parseInt(g, 16));
}

/** true = dorthin verbindet sich der Server NIE. Unlesbare Adressen sind gesperrt — im Zweifel zu. */
export function adresseGesperrt(roh: string): boolean {
  const ip = String(roh ?? "").trim().replace(/^\[|\]$/g, "");
  const v4 = v4Zahlen(ip);
  if (v4) return v4Gesperrt(v4);
  const g = v6Gruppen(ip);
  if (!g) return true;
  const eingebettet = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) {
    // ::ffff:a.b.c.d (IPv4 im IPv6-Mantel) und das veraltete ::a.b.c.d — samt „::" und „::1".
    return g[5] === 0 ? true : v4Gesperrt(eingebettet);
  }
  return (g[0] & 0xfe00) === 0xfc00                         // fc00::/7 privat (auch fd00:ec2::254, AWS-Metadaten)
    || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 // Link-Local, Site-Local
    || (g[0] & 0xff00) === 0xff00                           // Multicast
    || (g[0] === 0x64 && g[1] === 0xff9b)                   // NAT64 — trägt ein IPv4 im Bauch
    || g[0] === 0x2002                                      // 6to4 — ebenso
    || (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8))  // Teredo, Doku
    || (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0); // Verwerf-Präfix
}

// ── Schicht 1: die Adresse selbst ───────────────────────────────────────────
const TABU_ENDUNGEN = /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|private|test|example|invalid|onion|arpa)$/;

/** Wirft NetzschutzFehler — oder gibt die geprüfte URL zurück. */
export function urlPruefen(roh: string | URL): URL {
  let url: URL;
  try { url = roh instanceof URL ? new URL(roh.href) : new URL(String(roh).trim()); } catch { throw new NetzschutzFehler("schema", "Das ist keine gültige Internetadresse."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new NetzschutzFehler("schema", "Nur http- und https-Adressen sind erlaubt.");
  if (url.username || url.password) throw new NetzschutzFehler("zugangsdaten", "Adressen mit Zugangsdaten werden nicht abgerufen.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new NetzschutzFehler("port", "Nur die üblichen Web-Ports werden abgerufen.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const nackt = host.replace(/^\[|\]$/g, "");
  if (net.isIP(nackt)) {
    // Eine Firmen-Website hat einen Namen. Nackte IP-Adressen werden gar nicht
    // abgerufen — auch öffentliche nicht; das hält die Angriffsfläche klein.
    throw new NetzschutzFehler(adresseGesperrt(nackt) ? "private_adresse" : "hostname", "Diese Adresse wird nicht abgerufen.");
  }
  if (!host.includes(".") || !/^[a-z0-9.-]+$/.test(host) || host.length > 253 || TABU_ENDUNGEN.test(host)) {
    throw new NetzschutzFehler("hostname", "Diese Adresse wird nicht abgerufen.");
  }
  return url;
}

// ── Schicht 2: die Namensauflösung gehört zur Verbindung ────────────────────
type Aufloeser = (host: string, optionen: dns.LookupAllOptions, fertig: (err: NodeJS.ErrnoException | null, adressen: dns.LookupAddress[]) => void) => void;

export function sichererLookup(aufloeser: Aufloeser = dns.lookup as unknown as Aufloeser) {
  return (host: string, optionen: any, fertig?: any): void => {
    const cb: (...a: any[]) => void = typeof optionen === "function" ? optionen : fertig;
    const opt = optionen && typeof optionen === "object" ? optionen : {};
    aufloeser(host, { ...opt, all: true }, (err, adressen) => {
      if (err) return cb(err);
      const liste = Array.isArray(adressen) ? adressen : [];
      if (!liste.length) return cb(new NetzschutzFehler("netz", "Der Name lässt sich nicht auflösen."));
      if (liste.some((a) => adresseGesperrt(a.address))) return cb(new NetzschutzFehler("private_adresse", "Diese Adresse wird nicht abgerufen."));
      if (opt.all) cb(null, liste);
      else cb(null, liste[0].address, liste[0].family);
    });
  };
}

// ── Der Transport: EIN Abruf, keine Weiterleitung ───────────────────────────
export interface RohAntwort { status: number; kopf: Record<string, string>; koerper: Buffer; abgeschnitten: boolean }
export interface TransportWunsch { fristMs: number; maxBytes: number }
export type Transport = (url: URL, wunsch: TransportWunsch) => Promise<RohAntwort>;

export const echterTransport: Transport = (url, wunsch) => new Promise<RohAntwort>((ja, nein) => {
  let fertig = false;
  const ende = (fehler: Error | null, antwort?: RohAntwort) => {
    if (fertig) return;
    fertig = true;
    clearTimeout(wecker);
    req.destroy();
    fehler ? nein(fehler) : ja(antwort!);
  };
  const req = (url.protocol === "https:" ? https : http).request(url, {
    method: "GET",
    agent: false,
    lookup: sichererLookup() as unknown as net.LookupFunction,
    headers: {
      "User-Agent": AGENT_KENNUNG,
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
      "Accept-Language": "de,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
    },
  }, (res) => {
    const gegenstelle = res.socket?.remoteAddress;
    if (gegenstelle && adresseGesperrt(gegenstelle)) return ende(new NetzschutzFehler("private_adresse", "Diese Adresse wird nicht abgerufen."));
    const kopf: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) kopf[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
    const status = res.statusCode ?? 0;
    // Weiterleitungen und Fehler brauchen keinen Körper.
    if (status >= 300 && status < 400) return ende(null, { status, kopf, koerper: Buffer.alloc(0), abgeschnitten: false });

    const art = (kopf["content-encoding"] || "").toLowerCase();
    const strom = art.includes("br") ? res.pipe(zlib.createBrotliDecompress())
      : art.includes("gzip") ? res.pipe(zlib.createGunzip())
      : art.includes("deflate") ? res.pipe(zlib.createInflate())
      : res;
    const teile: Buffer[] = [];
    let groesse = 0;
    if (strom !== res) res.on("error", () => strom.destroy(new Error("abgerissen")));
    strom.on("data", (stueck: Buffer) => {
      const rest = wunsch.maxBytes - groesse;
      if (stueck.length >= rest) {
        teile.push(stueck.subarray(0, rest));
        ende(null, { status, kopf, koerper: Buffer.concat(teile), abgeschnitten: true });
      } else { teile.push(stueck); groesse += stueck.length; }
    });
    strom.on("end", () => ende(null, { status, kopf, koerper: Buffer.concat(teile), abgeschnitten: false }));
    // Ein abgerissener oder kaputt gepackter Strom: nehmen, was da ist.
    strom.on("error", () => (groesse > 0 ? ende(null, { status, kopf, koerper: Buffer.concat(teile), abgeschnitten: true }) : ende(new NetzschutzFehler("netz", "Die Seite ließ sich nicht lesen."))));
  });
  const wecker = setTimeout(() => ende(new NetzschutzFehler("zeit", "Die Seite antwortet nicht rechtzeitig.")), wunsch.fristMs);
  req.on("error", (e: any) => ende(e instanceof NetzschutzFehler ? e : new NetzschutzFehler("netz", "Die Seite ist nicht erreichbar.")));
  req.end();
});

// ── Schicht 3: der Abruf mit eigenen Weiterleitungen ────────────────────────
export interface Seite { url: string; status: number; kopf: Record<string, string>; text: string; abgeschnitten: boolean }
export interface AbrufWunsch {
  transport?: Transport;
  fristMs?: number;
  maxBytes?: number;
  maxWeiter?: number;
  /** Wird vor JEDEM Sprung gefragt (robots.txt). Wirft, wenn der Sprung nicht sein darf. */
  vorSprung?: (url: URL) => Promise<void>;
}

function zeichensatz(kopf: Record<string, string>, koerper: Buffer): string {
  const ausKopf = (kopf["content-type"] || "").match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
  const ausSeite = koerper.subarray(0, 2048).toString("latin1").match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
  return (ausKopf || ausSeite || "utf-8").toLowerCase();
}

export function alsText(kopf: Record<string, string>, koerper: Buffer): string {
  try { return new TextDecoder(zeichensatz(kopf, koerper)).decode(koerper); } catch { return new TextDecoder("utf-8").decode(koerper); }
}

export async function sicherAbrufen(roh: string | URL, wunsch: AbrufWunsch = {}): Promise<Seite> {
  const transport = wunsch.transport ?? echterTransport;
  const maxWeiter = wunsch.maxWeiter ?? 3;
  const schluss = Date.now() + (wunsch.fristMs ?? 6000);
  let url = urlPruefen(roh);
  for (let sprung = 0; ; sprung += 1) {
    if (wunsch.vorSprung) await wunsch.vorSprung(url);
    const rest = schluss - Date.now();
    if (rest <= 0) throw new NetzschutzFehler("zeit", "Die Seite antwortet nicht rechtzeitig.");
    const antwort = await transport(url, { fristMs: rest, maxBytes: wunsch.maxBytes ?? 600_000 });
    if (antwort.status >= 300 && antwort.status < 400 && antwort.kopf.location) {
      if (sprung >= maxWeiter) throw new NetzschutzFehler("weiterleitungen", "Die Seite leitet zu oft weiter.");
      let ziel: URL;
      try { ziel = new URL(antwort.kopf.location, url); } catch { throw new NetzschutzFehler("schema", "Die Seite leitet auf eine ungültige Adresse weiter."); }
      url = urlPruefen(ziel);
      continue;
    }
    const typ = (antwort.kopf["content-type"] || "").toLowerCase();
    if (antwort.status >= 200 && antwort.status < 300 && typ && !/text\/html|application\/xhtml\+xml|text\/plain/.test(typ)) {
      throw new NetzschutzFehler("inhaltstyp", "Die Adresse liefert keine lesbare Seite.");
    }
    return { url: url.href, status: antwort.status, kopf: antwort.kopf, text: alsText(antwort.kopf, antwort.koerper), abgeschnitten: antwort.abgeschnitten };
  }
}
