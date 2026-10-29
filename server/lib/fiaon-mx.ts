// ═══════════════════════════════════════════════════════════════════════════
// NIMMT DIESE DOMÄNE POST AN? — DNS-PRÜFUNGEN AN EINER STELLE (E-458, 29.10.2026)
//
// Bis heute stand die MX-Prüfung nur im Antrag (server/routes/fiaon-antrag-neu.ts: „kann die E-Mail-Domain Post
// empfangen?“). Der Mail-Motor braucht sie zweimal: bevor er eine Chef-Adresse aus einem belegten Muster ableitet (nie
// an eine Domäne ohne MX), und für die Bereitschaft eines Versand-Postfachs (MX, SPF, DKIM, DMARC der eigenen Domäne).
// Der Auflöser ist austauschbar, damit der Prüfstand ohne Netz läuft (mxAufloeserSetzen).
// ═══════════════════════════════════════════════════════════════════════════
import { promises as dnsPromises } from "dns";

export interface MxAufloeser {
  resolveMx: (domain: string) => Promise<{ exchange: string; priority: number }[]>;
  resolve4: (domain: string) => Promise<string[]>;
  resolveTxt: (domain: string) => Promise<string[][]>;
}
const ECHT: MxAufloeser = {
  resolveMx: (d) => dnsPromises.resolveMx(d),
  resolve4: (d) => dnsPromises.resolve4(d),
  resolveTxt: (d) => dnsPromises.resolveTxt(d),
};
let aufloeser: MxAufloeser = ECHT;
/** Prüfstand: einen Attrappen-Auflöser einsetzen (null = echtes DNS). */
export function mxAufloeserSetzen(a: MxAufloeser | null): void { aufloeser = a ?? ECHT; }

const zeitlich = <T,>(p: Promise<T>, ms = 2500) => Promise.race([p, new Promise<never>((_, nein) => setTimeout(() => nein(Object.assign(new Error("Zeit"), { code: "ETIMEOUT" })), ms))]);
const endgueltig = (e: any) => ["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(String(e?.code));

/** Kann die Domäne Post empfangen? „mx“ = Mailserver eingetragen · „a“ = nur eine Adresse · „keine“ · „unklar“ (Zeit, Störung). */
export async function mailDomain(domain: string): Promise<"mx" | "a" | "keine" | "unklar"> {
  try {
    const mx = await zeitlich(aufloeser.resolveMx(domain));
    if (mx.some((m) => m.exchange && m.exchange !== ".")) return "mx";
  } catch (e) { if (!endgueltig(e)) return "unklar"; }
  try {
    const a = await zeitlich(aufloeser.resolve4(domain));
    if (a.length) return "a";
  } catch (e) { if (!endgueltig(e)) return "unklar"; }
  return "keine";
}

/** TXT-Einträge — null bei einer Störung (Zeit, SERVFAIL), [] wenn es den Namen sicher nicht gibt. */
async function txt(name: string): Promise<string[] | null> {
  try { return (await zeitlich(aufloeser.resolveTxt(name))).map((t) => t.join("")); } catch (e) { return endgueltig(e) ? [] : null; }
}

export interface VersandDns {
  mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean;
  /** E-458 (Befund Bereitschaft): eine Abfrage lief in eine Störung (Zeit, SERVFAIL) — das Ergebnis ist nicht sicher. */
  unklar?: boolean;
}
/**
 * Ist eine Versand-Domäne für Google Workspace eingerichtet? MX vorhanden, SPF mit include:_spf.google.com, DKIM-Schlüssel
 * unter google._domainkey, DMARC-Eintrag. Nur lesend.
 */
export async function versandDns(domain: string): Promise<VersandDns> {
  const d = String(domain || "").toLowerCase();
  const [mx, wurzel, dkim, dmarc] = await Promise.all([mailDomain(d), txt(d), txt(`google._domainkey.${d}`), txt(`_dmarc.${d}`)]);
  return {
    mx: mx === "mx",
    spf: !!wurzel?.some((t) => /^v=spf1\b/i.test(t) && /include:_spf\.google\.com/i.test(t)),
    dkim: !!dkim?.some((t) => /v=DKIM1/i.test(t) || /\bp=[A-Za-z0-9+/=]{20,}/.test(t)),
    dmarc: !!dmarc?.some((t) => /^v=DMARC1\b/i.test(t)),
    unklar: mx === "unklar" || wurzel === null || dkim === null || dmarc === null,
  };
}
