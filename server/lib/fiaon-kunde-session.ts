// ═══════════════════════════════════════════════════════════════════════════
// KUNDENSITZUNG UND PASSWORTHYGIENE (22.08.2026)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Der Kunde hatte keine Sitzung. Nach dem Login lag seine Referenz im
// sessionStorage des Browsers, und jeder Kunden-Endpunkt (/profile/:ref,
// /kyc-status/:ref …) antwortete jedem, der die Referenz kannte. Dazu lagen
// die Passwörter im Klartext in fiaon_applications.password und wurden per
// `stored === password` verglichen (fiaon-login-logic.ts).
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
// 1. Ein signiertes, httpOnly-Cookie `fiaon_kunde`, gesetzt beim Login. Die
//    Signatur (HMAC mit SESSION_SECRET) verhindert, dass jemand die Referenz
//    eines anderen in sein Cookie schreibt.
// 2. `requireKunde`: die Tür für alle NEUEN Kunden-Endpunkte. Die alten
//    Endpunkte bleiben vorerst unberührt — das heutige Dashboard braucht sie
//    noch, bis der neue Bereich übernimmt (E-013). Dann bekommen sie dieselbe Tür.
// 3. Passwörter: `passwortHashen` (scrypt, Präfix `scrypt$`) und
//    `passwortPasst`, das BEIDES versteht — Hash und Altbestand im Klartext.
//    Beim nächsten erfolgreichen Login wird ein Klartext-Passwort nachgehasht
//    (fiaon-antrag.ts, Login). Kein Kunde muss etwas tun; in ein paar Wochen
//    ist der Klartext verschwunden.
// ═══════════════════════════════════════════════════════════════════════════
import type { Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const COOKIE = "fiaon_kunde";
const TAGE = 30;

function geheimnis(): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!s) {
    // Ohne Geheimnis keine Signatur — dann lieber laut scheitern als leise
    // jeden hereinlassen.
    throw new Error("SESSION_SECRET fehlt — Kundensitzung kann nicht signiert werden.");
  }
  return s;
}

function signieren(ref: string): string {
  const mac = createHmac("sha256", geheimnis()).update(ref).digest("base64url");
  return `${ref}.${mac}`;
}

/** Liest die Referenz aus dem Cookie — oder null, wenn Signatur oder Cookie fehlen. */
export function kundeAusCookie(req: Request): string | null {
  const roh = String((req as any).cookies?.[COOKIE] || "");
  const i = roh.lastIndexOf(".");
  if (i <= 0) return null;
  const ref = roh.slice(0, i);
  const mac = roh.slice(i + 1);
  const erwartet = createHmac("sha256", geheimnis()).update(ref).digest("base64url");
  if (mac.length !== erwartet.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(erwartet))) return null;
  return ref;
}

/**
 * Sitzung setzen. `bleiben` (Vorgabe: ja) = 30 Tage, gleitend verlängert bei
 * jedem geprüften Aufruf (siehe `requireKunde`). `bleiben: false` = nur bis
 * der Browser geschlossen wird. Justin (22.08.2026): „man muss eingeloggt
 * bleiben, sodass man jederzeit auf die Plattform wechseln kann."
 */
export function kundenSitzungSetzen(res: Response, ref: string, opts: { bleiben?: boolean } = {}): void {
  res.cookie(COOKIE, signieren(ref), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(opts.bleiben === false ? {} : { maxAge: TAGE * 24 * 60 * 60 * 1000 }),
    path: "/",
  });
}

export function kundenSitzungLoeschen(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
}

export interface KundeRequest extends Request {
  kundeRef?: string;
}

/** Tür für Kunden-Endpunkte: Cookie muss da sein UND zur :ref in der URL passen. */
export async function requireKunde(req: KundeRequest, res: Response, next: NextFunction): Promise<void> {
  const ref = kundeAusCookie(req);
  if (!ref) {
    // ══════════════════════════════════════════════════════════════════════
    // DIE ALS-KUNDE-ANSICHT KOMMT HIER OHNE KUNDENSITZUNG AN (25.08.2026)
    //
    // ── DER BEFUND (Florentine & Daniel, Testpunkt 6) ────────────────────
    // „Portal ansehen als Kunde geht noch nicht." Die Schleuse /als-kunde
    // stammt aus der Zeit, als das Portal alles aus sessionStorage las. Der
    // NEUE Kundenbereich (E-013) holt seine Daten aber vom Server — und
    // diese Tür kannte nur das Kunden-Cookie. Ergebnis: Die Leitung startete
    // die Ansicht, das Portal fragte /kunde/:ref/bereich, bekam 401 und warf
    // sie zur Kundenanmeldung. GEMESSEN: Token gültig, /kundenansicht/stand
    // lieferte den Kunden — nur diese Wand hier wusste nichts davon.
    //
    // ── DIE REGELN DER AUSNAHME ──────────────────────────────────────────
    // 1. NUR LESEN: alles außer GET wird abgelehnt. „Es entstehen keine
    //    Handlungen im Namen des Kunden" ist ein Versprechen der Oberfläche —
    //    gehalten wird es hier.
    // 2. DIESELBE BINDUNG wie /kundenansicht/stand: Bei der Leitung muss die
    //    eigene Anmeldung noch gelten und zum Token passen — ein
    //    weitergegebenes Cookie ist sonst ein Dauerzugang in ein fremdes
    //    Konto. Bei der Verwaltung muss der Admin-Code anliegen.
    // 3. KEINE ECHTE SITZUNG: Die gleitende Verlängerung unten stellt ein
    //    Kunden-Cookie aus — für einen Ansehenden wäre das eine Anmeldung
    //    als der Kunde. Deshalb endet dieser Zweig VOR ihr.
    // ══════════════════════════════════════════════════════════════════════
    try {
      const { KUNDENANSICHT_COOKIE, kundenansichtTokenPruefen } = await import("./fiaon-kundenansicht");
      const tok = kundenansichtTokenPruefen((req as any).cookies?.[KUNDENANSICHT_COOKIE]);
      if (tok) {
        if (req.method !== "GET") {
          res.status(403).json({ ok: false, error: "Nur-Ansicht: In der Als-Kunde-Ansicht sind keine Handlungen möglich.", code: "NUR_ANSICHT" });
          return;
        }
        let gebunden = false;
        if (tok.art === "leitung") {
          const { verifyAgentToken, AGENT_COOKIE_NAME } = await import("../routes/fiaon-agent");
          const eigen = verifyAgentToken((req as any).cookies?.[AGENT_COOKIE_NAME]);
          gebunden = !!eigen && Number(eigen.id) === tok.ansehenderId;
        } else {
          const { hasAdminCode } = await import("../routes/fiaon-admin-zugang");
          gebunden = hasAdminCode(req as any);
        }
        const inUrl2 = String(req.params?.ref || "");
        if (gebunden && (!inUrl2 || inUrl2 === tok.ref)) {
          req.kundeRef = tok.ref;
          next();
          return;
        }
      }
    } catch { /* fällt auf die normale Absage zurück */ }
    res.status(401).json({ ok: false, error: "Bitte melden Sie sich an.", code: "KEINE_SITZUNG" });
    return;
  }
  const inUrl = String(req.params?.ref || "");
  if (inUrl && inUrl !== ref) {
    res.status(403).json({ ok: false, error: "Dieser Bereich gehört einem anderen Konto.", code: "FREMDE_REF" });
    return;
  }
  req.kundeRef = ref;
  // Gleitende Verlängerung: Wer aktiv ist, bleibt angemeldet.
  kundenSitzungSetzen(res, ref);
  next();
}

// ── Passwörter ─────────────────────────────────────────────────────────────
const N = 16384, R = 8, P = 1, LAENGE = 64;

export function passwortHashen(klartext: string): string {
  const salz = randomBytes(16);
  const hash = scryptSync(klartext, salz, LAENGE, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salz.toString("base64")}$${hash.toString("base64")}`;
}

export function istGehasht(gespeichert: unknown): boolean {
  return typeof gespeichert === "string" && gespeichert.startsWith("scrypt$");
}

/** Versteht Hash UND Altbestand im Klartext — bis der Altbestand nachgehasht ist. */
export function passwortPasst(gespeichert: unknown, eingabe: string): boolean {
  if (typeof gespeichert !== "string" || !gespeichert) return false;
  if (!istGehasht(gespeichert)) return gespeichert === eingabe;
  const [, n, r, p, salzB64, hashB64] = gespeichert.split("$");
  try {
    const erwartet = Buffer.from(hashB64, "base64");
    const ist = scryptSync(eingabe, Buffer.from(salzB64, "base64"), erwartet.length,
      { N: Number(n), r: Number(r), p: Number(p) });
    return ist.length === erwartet.length && timingSafeEqual(ist, erwartet);
  } catch {
    return false;
  }
}
