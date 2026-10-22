// ═══════════════════════════════════════════════════════════════════════════
// DAS SIEGEL — PAdES-Signatur der FIAON LTD auf jedem digital unterschriebenen PDF (22.10.2026)
//
// Nach dem Unterschreiben bekommt das fertige PDF eine eingebettete Signatur
// (PAdES B-B: SubFilter ETSI.CAdES.detached, CMS SignedData mit contentType,
// messageDigest und signingCertificateV2, SHA-256). Ein PDF-Programm zeigt dann
// „signiert von FIAON LTD“ und meldet jede spätere Änderung an der Datei.
//
// OHNE FREMDE PAKETE: CMS und Platzhalter sind hier von Hand gebaut (DER, ~250
// Zeilen) — node:crypto signiert. Grund: Die Arbeitskopie teilt node_modules mit
// anderen Strängen; ein neues Paket hätte dort mitinstalliert werden müssen.
//
// DER SCHLÜSSEL (Render-Umgebung, nie im Repo):
//   FIAON_SIGN_CERT_PEM   Zertifikat (PEM — oder Base64 davon), optional mit Kette dahinter
//   FIAON_SIGN_KEY_PEM    privater Schlüssel (PEM, PKCS#8 oder RSA/EC — oder Base64 davon)
//   FIAON_SIGN_KEY_PASS   Passwort, wenn der Schlüssel verschlüsselt ist (optional)
// Aus einer .p12-Datei: openssl pkcs12 -in fiaon.p12 -clcerts -nokeys -out cert.pem
//                       openssl pkcs12 -in fiaon.p12 -nocerts -out key.pem   (mit Passwort)
// FIAON_SIGN_P12_BASE64 allein genügt NICHT (node:crypto liest kein PKCS#12) — dann bleibt
// das Siegel „ausstehend“ mit genau diesem Grund. Fehlt der Schlüssel, wird NIE das
// Unterschreiben verhindert: Die Prüfsumme der Datei steht im Nachweis, das Siegel „ausstehend“.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, X509Certificate, type KeyObject } from "node:crypto";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray } from "pdf-lib";

// ── DER (nur was CMS braucht) ────────────────────────────────────────────────
function laenge(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const b: number[] = []; let x = n;
  while (x > 0) { b.unshift(x & 0xff); x >>= 8; }
  return Buffer.from([0x80 | b.length, ...b]);
}
const tlv = (tag: number, inhalt: Buffer) => Buffer.concat([Buffer.from([tag]), laenge(inhalt.length), inhalt]);
const seq = (...t: Buffer[]) => tlv(0x30, Buffer.concat(t));
const set = (...t: Buffer[]) => tlv(0x31, Buffer.concat([...t].sort(Buffer.compare)));
const ganz = (n: number) => tlv(0x02, Buffer.from([n]));
const oktett = (b: Buffer) => tlv(0x04, b);
const NULL = Buffer.from([0x05, 0x00]);
function oid(s: string): Buffer {
  const t = s.split(".").map(Number);
  const out: number[] = [40 * t[0] + t[1]];
  for (const n of t.slice(2)) {
    const b: number[] = [n & 0x7f]; let x = n >> 7;
    while (x > 0) { b.unshift((x & 0x7f) | 0x80); x >>= 7; }
    out.push(...b);
  }
  return tlv(0x06, Buffer.from(out));
}
const kontext = (nr: number, inhalt: Buffer, konstruiert = true) => tlv((konstruiert ? 0xa0 : 0x80) | nr, inhalt);

interface Knoten { tag: number; start: number; kopf: number; laenge: number; ende: number }
function lesen(b: Buffer, pos: number): Knoten {
  const tag = b[pos]; let l = b[pos + 1]; let kopf = 2;
  if (l & 0x80) { const n = l & 0x7f; l = 0; for (let i = 0; i < n; i++) l = (l << 8) | b[pos + 2 + i]; kopf = 2 + n; }
  return { tag, start: pos, kopf, laenge: l, ende: pos + kopf + l };
}
function kinder(b: Buffer, k: Knoten): Knoten[] {
  const out: Knoten[] = []; let p = k.start + k.kopf;
  while (p < k.ende) { const c = lesen(b, p); out.push(c); p = c.ende; }
  return out;
}
const roh = (b: Buffer, k: Knoten) => b.subarray(k.start, k.ende);
const wert = (b: Buffer, k: Knoten) => b.subarray(k.start + k.kopf, k.ende);

const OID = {
  data: "1.2.840.113549.1.7.1", signedData: "1.2.840.113549.1.7.2", sha256: "2.16.840.1.101.3.4.2.1",
  contentType: "1.2.840.113549.1.9.3", messageDigest: "1.2.840.113549.1.9.4", signingCertV2: "1.2.840.113549.1.9.16.2.47",
  rsa: "1.2.840.113549.1.1.1", ecdsaSha256: "1.2.840.10045.4.3.2",
};

// ── SCHLÜSSEL AUS DER UMGEBUNG ───────────────────────────────────────────────
function pemAus(v: string | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.includes("-----BEGIN")) return s;
  try { const t = Buffer.from(s, "base64").toString("utf8"); return t.includes("-----BEGIN") ? t : null; } catch { return null; }
}
export interface SiegelSchluessel { key: KeyObject; zertifikate: Buffer[]; subjekt: string }
/** Der Schlüssel aus der Umgebung — oder der Grund, warum es keinen gibt. */
export function siegelSchluessel(env: NodeJS.ProcessEnv = process.env): SiegelSchluessel | { fehlt: string } {
  const certPem = pemAus(env.FIAON_SIGN_CERT_PEM);
  const keyPem = pemAus(env.FIAON_SIGN_KEY_PEM);
  if (!certPem || !keyPem) {
    return { fehlt: env.FIAON_SIGN_P12_BASE64 ? "Nur FIAON_SIGN_P12_BASE64 gesetzt — bitte als PEM hinterlegen (FIAON_SIGN_CERT_PEM + FIAON_SIGN_KEY_PEM)." : "Kein Siegel-Schlüssel hinterlegt (FIAON_SIGN_CERT_PEM, FIAON_SIGN_KEY_PEM)." };
  }
  try {
    const key = createPrivateKey({ key: keyPem, passphrase: env.FIAON_SIGN_KEY_PASS || undefined });
    const zertifikate = Array.from(certPem.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/g)).map((m) => Buffer.from(m[1].replace(/\s+/g, ""), "base64"));
    if (!zertifikate.length) return { fehlt: "FIAON_SIGN_CERT_PEM enthält kein Zertifikat." };
    const x = new X509Certificate(zertifikate[0]);
    if (!x.checkPrivateKey(key)) return { fehlt: "Zertifikat und Schlüssel passen nicht zusammen." };
    return { key, zertifikate, subjekt: x.subject.replace(/\n/g, ", ") };
  } catch (e) {
    return { fehlt: `Schlüssel nicht lesbar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Aussteller und Seriennummer aus dem Zertifikat (DER), für IssuerAndSerialNumber. */
function ausstellerUndNummer(cert: Buffer): Buffer {
  const c = lesen(cert, 0);
  const tbs = kinder(cert, c)[0];
  const t = kinder(cert, tbs);
  const i = t[0].tag === 0xa0 ? 1 : 0; // [0] version ist optional
  const serial = t[i]; const issuer = t[i + 2];
  return seq(roh(cert, issuer), roh(cert, serial));
}

/** CMS SignedData (detached) über `daten`. */
export function cmsSignieren(daten: Buffer, s: SiegelSchluessel): Buffer {
  const cert = s.zertifikate[0];
  const algSha = seq(oid(OID.sha256), NULL);
  const attrs = [
    seq(oid(OID.contentType), set(oid(OID.data))),
    seq(oid(OID.messageDigest), set(oktett(createHash("sha256").update(daten).digest()))),
    // ESS signingCertificateV2 (SHA-256 ist Vorgabe — der Algorithmus wird weggelassen)
    seq(oid(OID.signingCertV2), set(seq(seq(seq(oktett(createHash("sha256").update(cert).digest())))))),
  ];
  const signiert = set(...attrs);
  const ec = s.key.asymmetricKeyType === "ec";
  const signatur = cryptoSign("sha256", signiert, s.key);
  const signer = seq(
    ganz(1), ausstellerUndNummer(cert), algSha,
    kontext(0, wert(signiert, lesen(signiert, 0))),
    ec ? seq(oid(OID.ecdsaSha256)) : seq(oid(OID.rsa), NULL),
    oktett(signatur),
  );
  const signedData = seq(
    ganz(1), set(algSha), seq(oid(OID.data)),
    kontext(0, Buffer.concat(s.zertifikate)),
    set(signer),
  );
  return seq(oid(OID.signedData), kontext(0, signedData));
}

const PLATZ_BYTES = 12000;
const MARKE = "**********";

/**
 * Versiegelt ein PDF: unsichtbares Signaturfeld auf der letzten Seite, Platzhalter, CMS hinein.
 * Gibt das versiegelte PDF zurück — die Seiten selbst bleiben unverändert.
 */
export async function pdfVersiegeln(pdfRoh: Uint8Array, s: SiegelSchluessel, o: { grund: string; am: Date; name?: string }): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfRoh);
  const ctx = pdf.context;
  const byteRange = PDFArray.withContext(ctx);
  byteRange.push(PDFNumber.of(0)); for (let i = 0; i < 3; i++) byteRange.push(PDFName.of(MARKE));
  const sig = ctx.obj({
    Type: "Sig", Filter: "Adobe.PPKLite", SubFilter: "ETSI.CAdES.detached",
    ByteRange: byteRange, Contents: PDFHexString.of("0".repeat(PLATZ_BYTES * 2)),
    Reason: PDFString.of(o.grund), M: PDFString.fromDate(o.am), Name: PDFString.of(o.name ?? "FIAON LTD"),
  });
  const sigRef = ctx.register(sig);
  const seiten = pdf.getPages(); const letzte = seiten[seiten.length - 1];
  const widget = ctx.obj({ Type: "Annot", Subtype: "Widget", FT: "Sig", Rect: [0, 0, 0, 0], V: sigRef, T: PDFString.of(`FIAON Seal ${o.am.toISOString()}`), F: 132, P: letzte.ref });
  const widgetRef = ctx.register(widget);
  letzte.node.addAnnot(widgetRef);
  const form = pdf.catalog.getOrCreateAcroForm();
  form.addField(widgetRef);
  form.dict.set(PDFName.of("SigFlags"), PDFNumber.of(3));
  const buf = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const text = buf.toString("latin1");
  const br = text.lastIndexOf(`/ByteRange [ 0 /${MARKE} /${MARKE} /${MARKE} ]`);
  const cIdx = text.indexOf(`/Contents <${"0".repeat(32)}`, br > 0 ? br - 40000 : 0);
  if (br < 0 || cIdx < 0) throw new Error("Platzhalter der Signatur nicht gefunden.");
  const start = cIdx + "/Contents ".length; // Position von „<“
  const ende = text.indexOf(">", start) + 1;
  const bereich = [0, start, ende, buf.length - ende];
  const alt = `[ 0 /${MARKE} /${MARKE} /${MARKE} ]`;
  let neu = `[${bereich.join(" ")}]`;
  if (neu.length > alt.length) throw new Error("ByteRange passt nicht in den Platzhalter.");
  neu = neu.padEnd(alt.length, " ");
  buf.write(neu, br + "/ByteRange ".length, "latin1");
  const daten = Buffer.concat([buf.subarray(0, start), buf.subarray(ende)]);
  const cms = cmsSignieren(daten, s);
  if (cms.length > PLATZ_BYTES) throw new Error("Signatur größer als der Platzhalter.");
  buf.write(cms.toString("hex").toUpperCase().padEnd(PLATZ_BYTES * 2, "0"), start + 1, "latin1");
  return buf;
}

export interface SiegelPruefung { versiegelt: boolean; gueltig: boolean; subjekt: string | null; grund: string }
/** Prüft die eingebettete Signatur: Bytebereich deckt die Datei, Prüfsumme stimmt, Signatur passt zum Zertifikat. */
export function pdfSiegelPruefen(pdfRoh: Uint8Array): SiegelPruefung {
  const buf = Buffer.from(pdfRoh);
  const text = buf.toString("latin1");
  const m = Array.from(text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)).pop();
  if (!m) return { versiegelt: false, gueltig: false, subjekt: null, grund: "Keine eingebettete Signatur." };
  const [a, b, c, d] = m.slice(1, 5).map(Number);
  if (a !== 0 || c + d !== buf.length) return { versiegelt: true, gueltig: false, subjekt: null, grund: "Der signierte Bereich deckt nicht die ganze Datei (nachträglich geändert)." };
  try {
    const hex = text.slice(b + 1, c - 1);
    const cmsRoh = Buffer.from(hex, "hex");
    const cms = cmsRoh.subarray(0, lesen(cmsRoh, 0).ende);
    const ci = kinder(cms, lesen(cms, 0));
    const sd = kinder(cms, ci[1])[0];
    const teile = kinder(cms, sd);
    const certs = teile.find((t) => t.tag === 0xa0)!;
    const cert = roh(cms, kinder(cms, certs)[0]);
    const signerSet = teile[teile.length - 1];
    const signer = kinder(cms, kinder(cms, signerSet)[0]);
    const attrs = signer.find((t) => t.tag === 0xa0)!;
    const signatur = wert(cms, signer[signer.length - 1]);
    // Für die Prüfung wird [0] wieder zu SET (0x31).
    const signiert = Buffer.from(roh(cms, attrs)); signiert[0] = 0x31;
    const daten = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]);
    const digest = createHash("sha256").update(daten).digest();
    let md: Buffer | null = null;
    for (const at of kinder(cms, attrs)) {
      const [typ, werte] = kinder(cms, at);
      if (wert(cms, typ).equals(oid(OID.messageDigest).subarray(2))) md = wert(cms, kinder(cms, werte)[0]);
    }
    const x = new X509Certificate(cert);
    if (!md || !md.equals(digest)) return { versiegelt: true, gueltig: false, subjekt: x.subject, grund: "Die Prüfsumme der Datei passt nicht zur Signatur (geändert)." };
    const ok = cryptoVerify("sha256", signiert, createPublicKey(x.publicKey.export({ type: "spki", format: "pem" })), signatur);
    return { versiegelt: true, gueltig: ok, subjekt: x.subject.replace(/\n/g, ", "), grund: ok ? "Signatur gültig — die Datei ist seit dem Versiegeln unverändert." : "Signatur passt nicht zum Zertifikat." };
  } catch (e) {
    return { versiegelt: true, gueltig: false, subjekt: null, grund: `Signatur nicht lesbar: ${e instanceof Error ? e.message : String(e)}` };
  }
}
