// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — XML-HANDGRIFFE FÜR DIE BEIDEN SOAP-DIENSTE (17.09.2026, E-188)
//
// Das UID-Register (CH) und das Firmenbuch (AT) sprechen SOAP. Beide Antworten
// sind flach und regelmäßig; ein ganzer XML-Parser als neue Abhängigkeit wäre
// dafür zu viel. Gelesen wird namensraum-blind: „<ns13:NAME>" und „<NAME>"
// sind dasselbe Element — die Präfixe wechseln je Antwort.
//
// GESCHRIEBEN wird nie ohne xmlText(): Was der Besucher tippt, landet als
// Text in einem Element, nie als Markup.
// ═══════════════════════════════════════════════════════════════════════════

/** Besuchereingabe für ein XML-Textelement entschärfen. Steuerzeichen, die XML 1.0 verbietet, fallen weg. */
export function xmlText(roh: unknown): string {
  return String(roh ?? "")
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlEntschaerfen(roh: string): string {
  return roh
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => zeichen(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => zeichen(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function zeichen(code: number): string {
  try { return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; } catch { return ""; }
}

const maske = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Alle Blöcke <…:name …>…</…:name> — der INHALT, noch als XML. Nicht für Elemente, die sich selbst enthalten. */
export function xmlBloecke(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${maske(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${maske(name)}>`, "g");
  const raus: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) raus.push(m[1]);
  return raus;
}

/** Wie xmlBloecke, aber mit dem öffnenden Tag — wenn die Attribute zählen (Firmenbuch: AUFRECHT, FKEN, PNR). */
export function xmlElemente(xml: string, name: string): { kopf: string; inhalt: string }[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${maske(name)}(\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${maske(name)}>`, "g");
  const raus: { kopf: string; inhalt: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) raus.push({ kopf: m[1] || "", inhalt: m[2] });
  return raus;
}

/** Der Text des ERSTEN Elements mit diesem Namen, entschärft und geglättet; fehlt es, undefined. */
export function xmlWert(xml: string, name: string): string | undefined {
  const [erster] = xmlBloecke(xml, name);
  if (erster === undefined) return undefined;
  const text = xmlEntschaerfen(erster.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function xmlWerte(xml: string, name: string): string[] {
  return xmlBloecke(xml, name)
    .map((b) => xmlEntschaerfen(b.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Attribut aus einem öffnenden Tag, namensraum-blind: xmlAttribut(' ns6:FKEN="GF"', "FKEN") → „GF". */
export function xmlAttribut(kopf: string, name: string): string | undefined {
  const m = kopf.match(new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${maske(name)}\\s*=\\s*"([^"]*)"`));
  return m ? xmlEntschaerfen(m[1]).trim() : undefined;
}

/** SOAP-Fehler als Klartext (1.1: faultstring, 1.2: Reason/Text); kein Fehler → undefined. */
export function soapFehler(xml: string): string | undefined {
  if (!/<(?:[\w.-]+:)?Fault[\s>]/.test(xml)) return undefined;
  return xmlWert(xml, "faultstring") ?? xmlWert(xml, "Text") ?? "SOAP-Fehler";
}
