// ═══════════════════════════════════════════════════════════════════════════
// EMPFEHLUNGEN DES PARTNERS AN FIAON — UND SEINE PROVISION (Register E-419, 22.10.2026)
//
// Justin (22.10.2026, Mansur Chehade): „außerdem arbeitet er mit uns zusammen, dafür erhält er 30 % — setze hierfür auch was auf,
// worüber er selbst abchecken kann, welche Kunden von ihm sind und welche Provision ihm erwartet.“ Und am selben Tag per WhatsApp:
// „verrechnen tun wir einstweilen nichts für die Zusammenarbeit“.
//
// Der Kooperationsvertrag (E-384) läuft FIAON → Partner: FIAON übermittelt Kontakte, der Partner zahlt je Kontakt. Hier kommt die
// Gegenrichtung dazu: Der Partner nennt FIAON Kunden und bekommt einen Anteil an dem, was diese Kunden FIAON zahlen.
//   · Basis: die gebuchten Zahlungen des empfohlenen Kunden aus der EINEN Umsatz-Quelle (UMSATZ_QUELLE_SQL, E-343) in den ersten
//     KOOP_PROVISION_MONATE Monaten ab der Meldung — ohne durchlaufende Fremdkosten (KOOP_DURCHLAUF_SCHLUESSEL).
//   · Prozentsatz je Partner im Schalter des Kooperationsvertrags (schalter.provision.prozent) — gesetzt im Chefbüro.
//   · „Berechnung ausgesetzt“ (schalter.berechnungAusgesetzt): übermittelte Kontakte kosten 0 €, kein Start-Rahmen, keine Monatsrechnung.
// Rein — Texte, Regeln und Rechnung; Datenbank und Wege in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Durchlaufende Fremdkosten: kein Umsatz für die Provision (Gründung zum Selbstkostenpreis, Fast-Track, Kooperationsrechnungen). */
export const KOOP_DURCHLAUF_SCHLUESSEL = ["llc_gruendung", "llc_gruendung_halb", "llc_fasttrack", "llc_loeschung", "koop_kontakte"] as const;
/**
 * Justin 28.10.2026 (E-432): Auch der FAST-TRACK der Kapital-Fassung C ist durchlaufend (Tippgeber-Vereinbarung Ziffer 3 Abs. 2) —
 * dort steckt er mit Gründung, Konto und Karten in EINER Bestellung (global_individuell). Von dieser ersten Zahlung zählt nur der
 * Teil ohne Fast-Track (parameter.fastTrackCents des Angebots, dessen auftrag_ref die Zahlung ist); spätere Zahlungen derselben
 * Person (Erfolgshonorar) zählen voll. SQL-Ausdruck über q (UMSATZ_QUELLE_SQL): der abzuziehende Betrag in Cent, nie mehr als q.cents.
 * E-469 (30.10.2026): Kommt diese erste Rechnung in Teilen (fiaon_teilzahlungen), wird der Fast-Track vom ersten Geld abgezogen,
 * bis er aufgebraucht ist (q.teil_vorher_cents = was vorher schon kam) — insgesamt genau einmal, wie bei einer Zahlung. Regel unverändert.
 *
 * E-487 (09.11.2026), Justin: „Die erste Zahlung (Gründung) zählt für die Provision — so steht es im Vertrag.“ Das bleibt. Neu:
 *   · Abgezogen wird nur, was der Kunde wirklich gekauft hat. Seit E-474 wählt der Kunde bei Angeboten mit parameter.fastTrackWahl
 *     selbst (schalter.fastTrack); hat er ihn abgewählt, steckt kein Fast-Track in der Zahlung — vorher zog die Regel ihn trotzdem ab.
 *     Dieselbe Regel wie kapitalCMitFastTrack (shared/fiaon-global-angebot-kapital-c.ts): ohne Wahl immer mit Fast-Track.
 *   · Bei einer Kooperation mit der schriftlichen Zusage „Fast-Track zählt mit“ zieht nichts ab. Welche das ist, steht NIE im Code
 *     (Repo öffentlich): Umgebungsvariable KOOP_FASTTRACK_ZAEHLT = Komma-Liste der Angebots-Refs der Kooperationsverträge.
 */
export function koopDurchlaufAbzugSql(fastTrackZaehltMit = false): string {
  if (fastTrackZaehltMit) return "0";
  return `COALESCE((SELECT LEAST(q.cents, GREATEST(0, COALESCE((ga.parameter->>'fastTrackCents')::int, 0) - COALESCE(q.teil_vorher_cents, 0))) FROM fiaon_global_angebote ga WHERE ga.auftrag_ref = q.ref AND ga.fassung LIKE 'IA-KAPITAL-%-C' AND NOT (COALESCE(ga.parameter->>'fastTrackWahl', 'false') = 'true' AND COALESCE(ga.schalter->>'fastTrack', 'true') = 'false') LIMIT 1), 0)`;
}
/** Der Abzug ohne „zählt mit“ — für Stellen, die keine Kooperation kennen (Prüfstände). */
export const KOOP_DURCHLAUF_ABZUG_SQL = koopDurchlaufAbzugSql(false);
/** E-487: Name der Umgebungsvariable mit den Kooperationen, bei denen der Fast-Track mitzählt. */
export const KOOP_FASTTRACK_ZAEHLT_ENV = "KOOP_FASTTRACK_ZAEHLT";
/** E-487: die Angebots-Refs aus der Umgebungsvariable (Komma, Semikolon oder Leerzeichen getrennt, Groß/klein egal). Rein. */
export function koopFastTrackZaehltListe(roh: unknown): string[] {
  return String(roh ?? "").split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
}
/** E-487: Zählt bei dieser Kooperation (Angebots-Ref des Kooperationsvertrags) der Fast-Track bei der Provision mit? Rein. */
export function koopFastTrackZaehlt(ref: unknown, roh: unknown): boolean {
  const r = String(ref ?? "").trim().toUpperCase();
  return !!r && koopFastTrackZaehltListe(roh).includes(r);
}
const objekt = (v: unknown): Record<string, unknown> => {
  let o: unknown = v;
  for (let i = 0; i < 2 && typeof o === "string"; i++) { try { o = JSON.parse(o); } catch { break; } }
  return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
};
/** E-487: Hat der Auftrag den Fast-Track? Wie im SQL: nur „mit Wahl UND abgewählt“ heißt nein. Rein. */
export function koopHatFastTrack(parameter: unknown, schalter: unknown): boolean {
  return !(String(objekt(parameter).fastTrackWahl) === "true" && String(objekt(schalter).fastTrack) === "false");
}
/**
 * E-487: dieselbe Rechnung wie koopDurchlaufAbzugSql für EINE Zahlung — für Prüfstand und Erklärung (die Datenbank rechnet mit dem
 * SQL). Nur Kapital-Fassung C, nur die Bestellung des Angebots, höchstens der Zahlbetrag, über Teilzahlungen genau einmal. Rein.
 */
export function koopFastTrackAbzugCents(e: {
  fassung: string; parameter: unknown; schalter: unknown; zahlungCents: number; teilVorherCents?: number; zaehltMit?: boolean;
}): number {
  if (e.zaehltMit || !/^IA-KAPITAL-.*-C$/.test(String(e.fassung ?? ""))) return 0;
  if (!koopHatFastTrack(e.parameter, e.schalter)) return 0;
  const ft = Math.trunc(Number(objekt(e.parameter).fastTrackCents) || 0);
  return Math.min(e.zahlungCents, Math.max(0, ft - (e.teilVorherCents ?? 0)));
}
/** So lange zählen die Zahlungen eines empfohlenen Kunden ab der Meldung. */
export const KOOP_PROVISION_MONATE = 12;
/**
 * E-487: Kennung der Global-Anfrage, die aus einer Empfehlung entsteht (fiaon_anfragen.ip) — daran erkennt der Lauf lead_post die
 * Willkommens-Mail „Empfehlung“ und lässt die Flut-Regel für Website-Anschlüsse aus (der Partner meldet über seinen Link).
 */
export const KOOP_EMPFEHLUNG_IP = "partner-empfehlung";

export interface KoopProvision { prozent: number; seit: string | null }
export function koopProvisionAus(schalter: unknown): KoopProvision | null {
  const s = schalter && typeof schalter === "object" ? (schalter as Record<string, any>).provision : null;
  const p = Number(s?.prozent);
  return Number.isFinite(p) && p > 0 && p <= 50 ? { prozent: Math.round(p * 100) / 100, seit: typeof s?.seit === "string" ? s.seit : null } : null;
}
export function koopBerechnungAusgesetzt(schalter: unknown): boolean {
  return !!(schalter && typeof schalter === "object" && (schalter as Record<string, any>).berechnungAusgesetzt === true);
}
/** Provision in Cent aus dem Umsatz in Cent — kaufmännisch gerundet. */
export function koopProvisionCents(umsatzCents: number, prozent: number): number {
  return Math.round((Math.max(0, umsatzCents) * prozent) / 100);
}

/**
 * E-487 (09.11.2026): Der Partner sieht je Empfehlung nur die STUFE mit Datum — keine Inhalte (Tippgeber-Vereinbarung Ziffer 5
 * Abs. 1). Vorher gab es nur gemeldet → „im Gespräch“ (erst mit einer Bestellung) → Kunde; ohne Zuordnung blieb sogar eine zahlende
 * Kundin auf „gemeldet“. Reihenfolge: gemeldet → Kontakt aufgenommen → Gespräch vereinbart → Angebot → Kunde; „kein Interesse“
 * steht für sich (gilt, solange danach nichts Weiteres kam — eine Zahlung ist immer „Kunde“).
 */
export type KoopEmpfehlungStand = "gemeldet" | "kontaktiert" | "gespraech" | "angebot" | "kunde" | "kein_interesse";
export const KOOP_EMPFEHLUNG_STAND_TEXT: Record<KoopEmpfehlungStand, string> = {
  gemeldet: "gemeldet",
  kontaktiert: "Kontakt aufgenommen",
  gespraech: "Gespräch vereinbart",
  angebot: "Angebot",
  kunde: "Kunde",
  kein_interesse: "kein Interesse",
};
type Zeitpunkt = Date | string | null | undefined;
const ms = (d: Zeitpunkt): number | null => { if (d == null || d === "") return null; const t = new Date(d as any).getTime(); return Number.isFinite(t) ? t : null; };
/**
 * E-487: die Stufe einer Empfehlung aus den Zeitpunkten (je das erste Mal) — Kunde = erste zählende Zahlung. Rein.
 * „kein Interesse“ gilt, wenn danach keine höhere Stufe mehr kam; ohne jede Spur bleibt sie „gemeldet“ mit dem Meldetag.
 */
export function koopEmpfehlungStufe(z: { gemeldetAm: Zeitpunkt; kontaktAm?: Zeitpunkt; gespraechAm?: Zeitpunkt; angebotAm?: Zeitpunkt; keinInteresseAm?: Zeitpunkt; kundeAm?: Zeitpunkt }): { stand: KoopEmpfehlungStand; am: Date | null } {
  const kunde = ms(z.kundeAm);
  if (kunde != null) return { stand: "kunde", am: new Date(kunde) };
  const stufen: [KoopEmpfehlungStand, number | null][] = [["angebot", ms(z.angebotAm)], ["gespraech", ms(z.gespraechAm)], ["kontaktiert", ms(z.kontaktAm)]];
  const beste = stufen.find(([, t]) => t != null) ?? null;
  const kein = ms(z.keinInteresseAm);
  if (kein != null && (!beste || (beste[1] as number) <= kein)) return { stand: "kein_interesse", am: new Date(kein) };
  if (beste) return { stand: beste[0], am: new Date(beste[1] as number) };
  const g = ms(z.gemeldetAm);
  return { stand: "gemeldet", am: g != null ? new Date(g) : null };
}

/** Kürzel für Listen außerhalb des Partnerbereichs („Sebastian S.“). */
export function koopEmpfehlungKurz(name: string): string {
  const t = String(name ?? "").trim().split(/\s+/);
  return t.length > 1 ? `${t[0]} ${t[t.length - 1].charAt(0)}.` : (t[0] ?? "");
}

/**
 * Prüft die Meldung eines Partners bzw. der Leitung. Rein.
 * E-487 (09.11.2026): `kontaktPflicht` (Partnerbereich) — Telefon ODER E-Mail muss da sein, sonst erreicht niemand die Person
 * (eine Meldung ohne beides lag bis heute ohne Anruf). Eine Telefonnummer braucht mindestens sechs Ziffern; die E-Mail klein.
 */
export function koopEmpfehlungAus(roh: any, opt: { kontaktPflicht?: boolean } = {}): { ok: true; name: string; telefon: string | null; email: string | null; notiz: string | null; personId: number | null } | { ok: false; error: string } {
  const text = (v: unknown, max: number) => String(v ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const name = text(roh?.name, 120);
  if (name.length < 3) return { ok: false, error: "Bitte den Namen der empfohlenen Person bzw. Firma angeben." };
  const telefon = text(roh?.telefon, 40) || null;
  const email = text(roh?.email, 160).toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Die E-Mail-Adresse sieht nicht richtig aus." };
  if (telefon && telefon.replace(/\D/g, "").length < 6) return { ok: false, error: "Die Telefonnummer sieht nicht richtig aus." };
  if (opt.kontaktPflicht && !telefon && !email) return { ok: false, error: "Bitte eine Telefonnummer oder E-Mail-Adresse der Person angeben, damit wir sie erreichen." };
  const notiz = text(roh?.notiz, 500) || null;
  const pid = Number(roh?.personId);
  return { ok: true, name, telefon, email, notiz, personId: Number.isInteger(pid) && pid > 0 ? pid : null };
}

export const KOOP_EMPFEHLUNG_TEXTE = {
  titel: "Ihre Empfehlungen an FIAON",
  sub: (prozent: number) => `Für jeden Kunden, den Sie uns nennen, erhalten Sie ${String(prozent).replace(".", ",")} % von dem, was er in den ersten ${KOOP_PROVISION_MONATE} Monaten an FIAON zahlt — ohne durchlaufende Fremdkosten wie Staatsgebühren oder Fast-Track.`,
  leer: "Noch keine Empfehlung. Nennen Sie uns einfach jemanden — unten oder per WhatsApp.",
  meldenTitel: "Jemanden empfehlen",
  meldenHinweis: "Bitte nur mit Einverständnis der Person: Wir rufen sie an bzw. schreiben ihr. Ihre Empfehlung steht sofort hier in der Liste.",
  // E-487: Telefon ODER E-Mail ist Pflicht — mit E-Mail geht die persönliche Einladung von Justin hinaus (Willkommens-Mail „Empfehlung“).
  kontaktHinweis: "Telefon oder E-Mail genügt. Mit E-Mail bekommt die Person sofort eine persönliche Einladung.",
  einverstanden: "Die Person ist einverstanden, dass FIAON sie kontaktiert.",
  fein: "Provision auf gebuchte Zahlungen. Zum Monatsanfang rechnen wir die Zahlungen des Vormonats automatisch per Gutschrift ab und überweisen binnen vierzehn Tagen. Muss FIAON eine Zahlung erstatten, entfällt die Provision daran.",
  auszahlTitel: "Ihre Auszahlungen",
  auszahlSub: "Jeden Monat erstellen wir Ihre Gutschrift automatisch und schicken sie Ihnen per E-Mail. Hinterlegen Sie dafür einmal Ihre Bankverbindung.",
  bankFehlt: "Noch keine Bankverbindung hinterlegt — ohne sie können wir nicht überweisen.",
  keineGutschrift: "Die erste Gutschrift kommt zum Monatsanfang, sobald ein empfohlener Kunde gezahlt hat.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): NACHTRAG — JEDE ZAHLUNG WIRD GENAU EINMAL VOLL GUTGESCHRIEBEN
//
// Befund: Die Gutschrift kannte nur „je Partner und Monat eine“ (UNIQUE angebot_id, monat). Wurde eine Empfehlung erst NACH der
// Monatsabrechnung der richtigen Person zugeordnet, stand ihre Zahlung als „offen“ im Partnerbereich — eine Gutschrift dafür kam
// nie. Jetzt rechnet jede Gutschrift je ZÄHLENDER ZAHLUNG: Provision nach der Regel heute minus das, was für genau diese Zahlung
// schon gutgeschrieben ist. Bleibt etwas offen (späte Zuordnung, eine Regel, die sich für eine schon abgerechnete Zahlung erhöht),
// kommt es als „Nachtrag“ in die nächste Gutschrift — mit der Monatsabrechnung oder sofort über „Nachtrag jetzt abrechnen“.
// Nie negativ: Zu viel Gutgeschriebenes wird nur gemeldet, nie still verrechnet. Rein — Datenbank in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════
/** Ein Posten einer Gutschrift (JSON in fiaon_koop_gutschriften.posten). */
export interface KoopGsPosten {
  empfehlungId: number; name: string; ref: string; am: string; umsatzCents: number; provisionCents: number;
  /** E-487: welche Zahlung genau (koopZahlungSchluessel) — Posten von vor E-487 haben keinen. */
  schluessel?: string;
  /** E-487: Nachtrag — die Zahlung stammt aus einem früheren Monat oder war schon zum Teil gutgeschrieben. */
  nachtrag?: boolean;
  /** E-487: bei einer Differenz die Provision nach der Regel heute und was davon schon gutgeschrieben war. */
  faelligCents?: number; schonCents?: number;
}
/** Eine zählende Zahlung eines empfohlenen Kunden (nach dem Fast-Track-Abzug). */
export interface KoopZahlung { empfehlungId: number; name: string; ref: string; am: string; rateNr: number | null; teilVorherCents: number; umsatzCents: number }
/** Der Schlüssel EINER Zahlung: Empfehlung, Bestellung, Rate, Teilzahlung (was vorher schon kam) — unabhängig von der Uhrzeit. */
export function koopZahlungSchluessel(z: Pick<KoopZahlung, "empfehlungId" | "ref" | "rateNr" | "teilVorherCents">): string {
  return `${Number(z.empfehlungId)}|${String(z.ref)}|${z.rateNr ?? "-"}|${Math.round(Number(z.teilVorherCents) || 0)}`;
}
const berlinTeile = (d: Date | string) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d));
const teil = (t: Intl.DateTimeFormatPart[], typ: string) => t.find((x) => x.type === typ)?.value ?? "";
/** Berliner Monat „JJJJ-MM“ eines Zeitpunkts (formatToParts, Hausregel). */
export function koopBerlinMonat(d: Date | string): string { const t = berlinTeile(d); return `${teil(t, "year")}-${teil(t, "month")}`; }
/** Berliner Tag „JJJJ-MM-TT“ eines Zeitpunkts. */
export function koopBerlinTag(d: Date | string): string { const t = berlinTeile(d); return `${teil(t, "year")}-${teil(t, "month")}-${teil(t, "day")}`; }

/**
 * Was für jede Zahlung schon gutgeschrieben ist (Schlüssel → Cent) — aus den Posten aller bisherigen Gutschriften. Posten mit
 * Schlüssel zählen genau dort; Posten von vor E-487 (ohne Schlüssel) gehören zur Zahlung derselben Empfehlung und Bestellung:
 * erst genau derselbe Zeitpunkt, dann derselbe Berliner Tag, sonst die einzige Zahlung dieser Bestellung. Rein.
 */
export function koopSchonGutgeschrieben(zahlungen: readonly KoopZahlung[], posten: readonly Pick<KoopGsPosten, "empfehlungId" | "ref" | "am" | "provisionCents" | "schluessel">[]): Map<string, number> {
  const schon = new Map<string, number>();
  const plus = (k: string, c: number) => schon.set(k, (schon.get(k) ?? 0) + c);
  const da = new Set(zahlungen.map(koopZahlungSchluessel));
  for (const p of posten) {
    const c = Math.round(Number(p.provisionCents) || 0);
    if (!c) continue;
    if (p.schluessel) { if (da.has(p.schluessel)) plus(p.schluessel, c); continue; }
    const kand = zahlungen.filter((z) => Number(z.empfehlungId) === Number(p.empfehlungId) && String(z.ref) === String(p.ref));
    const t = new Date(p.am).getTime();
    const treffer = kand.find((z) => new Date(z.am).getTime() === t)
      ?? kand.find((z) => koopBerlinTag(z.am) === koopBerlinTag(p.am))
      ?? (kand.length === 1 ? kand[0] : null);
    if (treffer) plus(koopZahlungSchluessel(treffer), c);
  }
  return schon;
}

/**
 * Die offenen Posten: je zählender Zahlung die Provision nach der Regel heute minus das schon Gutgeschriebene, nur wenn > 0.
 * `monat` = Monatsabrechnung dieses Monats (Zahlungen aus früheren Monaten bzw. Differenzen heißen „Nachtrag“); null = eine
 * Nachtrags-Gutschrift (alles Nachtrag). `zuViel` = Zahlungen, für die mehr gutgeschrieben ist, als die Regel heute ergibt. Rein.
 */
export function koopOffenePosten(
  zahlungen: readonly KoopZahlung[],
  bisher: readonly Pick<KoopGsPosten, "empfehlungId" | "ref" | "am" | "provisionCents" | "schluessel">[],
  prozent: number, monat: string | null,
): { posten: KoopGsPosten[]; zuViel: { empfehlungId: number; name: string; ref: string; am: string; faelligCents: number; schonCents: number }[] } {
  const schon = koopSchonGutgeschrieben(zahlungen, bisher);
  const posten: KoopGsPosten[] = [];
  const zuViel: { empfehlungId: number; name: string; ref: string; am: string; faelligCents: number; schonCents: number }[] = [];
  for (const z of zahlungen) {
    const schluessel = koopZahlungSchluessel(z);
    const faellig = koopProvisionCents(z.umsatzCents, prozent);
    const s = schon.get(schluessel) ?? 0;
    if (faellig > s) {
      posten.push({
        empfehlungId: Number(z.empfehlungId), name: z.name, ref: z.ref, am: z.am, umsatzCents: z.umsatzCents, provisionCents: faellig - s, schluessel,
        ...(monat === null || koopBerlinMonat(z.am) < monat || s > 0 ? { nachtrag: true } : {}),
        ...(s > 0 ? { faelligCents: faellig, schonCents: s } : {}),
      });
    } else if (faellig < s) {
      zuViel.push({ empfehlungId: Number(z.empfehlungId), name: z.name, ref: z.ref, am: z.am, faelligCents: faellig, schonCents: s });
    }
  }
  return { posten, zuViel };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026): DIE AUTOMATISCHE ZUORDNUNG EMPFEHLUNG → PERSON
//
// Befund: Provision zählt nur über person_id — und die setzte bis heute nur die Leitung von Hand. Eine Empfehlung blieb ohne
// Person, obwohl die Kundin am Tag danach annahm und zahlte; im Partnerbereich stand 0,00 €. Jetzt sucht ein Stundenlauf für jede
// Empfehlung ohne Person: über ihre Anfrage, die E-Mail, die letzten neun Telefonziffern, Vor- und Nachname (bzw. die Firma mit
// Rechtsform) oder den Kunden eines Global-/Kapital-Angebots — nur Spuren ab dem Meldetag minus 30 Tage. Genau eine neue Person →
// zuordnen; mehrere → Aufgabe an Justin; eine Person, die schon länger bei uns ist → Aufgabe (Bestandskunde? Justin entscheidet).
// Rein — die Suche in der Datenbank steht in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════
export const KOOP_ZUORDNUNG_TAGE_VORHER = 30;
/** Die Teile eines Namens zum Vergleich: klein, ohne Akzente, ß → ss, ohne Anrede/Titel, nur Wörter ab zwei Buchstaben. Rein. */
export function koopNameTeile(name: unknown): string[] {
  return String(name ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss")
    .replace(/[^a-z ]/g, " ").split(/\s+/).filter((x) => x.length >= 2 && !/^(herrn?|frau|dr|prof|mr|mrs|ms)$/.test(x));
}
/** Derselbe Mensch nach dem Namen: dieselben Teile (mindestens Vor- und Nachname), Reihenfolge egal. Rein. */
export function koopNamePasst(a: unknown, b: unknown): boolean {
  const x = new Set(koopNameTeile(a)); const y = new Set(koopNameTeile(b));
  return x.size >= 2 && x.size === y.size && Array.from(x).every((t) => y.has(t));
}
export interface KoopZuordnungKandidat { personId: number; weg: string; seit: Date | string | null }
export type KoopZuordnungUrteil =
  | { art: "keiner" }
  | { art: "eindeutig"; personId: number; wege: string[] }
  | { art: "pruefen"; personId: number; wege: string[]; seit: string }
  | { art: "mehrdeutig"; personen: { personId: number; wege: string[] }[] };
/** Das Urteil aus allen Treffern: je Person die Wege zusammen; eine neue Person = eindeutig. Rein. */
export function koopZuordnungUrteil(kandidaten: readonly KoopZuordnungKandidat[], gemeldetAm: Date | string): KoopZuordnungUrteil {
  const je = new Map<number, { wege: Set<string>; seit: number | null }>();
  for (const k of kandidaten) {
    const pid = Number(k.personId);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const v = je.get(pid) ?? { wege: new Set<string>(), seit: null };
    v.wege.add(String(k.weg));
    const s = ms(k.seit);
    if (s != null && (v.seit == null || s < v.seit)) v.seit = s;
    je.set(pid, v);
  }
  const personen = Array.from(je.entries()).map(([personId, v]) => ({ personId, wege: Array.from(v.wege).sort(), seit: v.seit })).sort((a, b) => a.personId - b.personId);
  if (!personen.length) return { art: "keiner" };
  if (personen.length > 1) return { art: "mehrdeutig", personen: personen.map(({ personId, wege }) => ({ personId, wege })) };
  const p = personen[0];
  const g = ms(gemeldetAm);
  if (p.seit != null && g != null && p.seit < g - KOOP_ZUORDNUNG_TAGE_VORHER * 86_400_000) return { art: "pruefen", personId: p.personId, wege: p.wege, seit: new Date(p.seit).toISOString() };
  return { art: "eindeutig", personId: p.personId, wege: p.wege };
}
/** Die Wege im Klartext für Verlauf, Info und Aufgabe. */
export const KOOP_ZUORDNUNG_WEG_TEXT: Readonly<Record<string, string>> = {
  anfrage: "die Anfrage der Empfehlung", email: "die E-Mail", telefon: "die Telefonnummer", name: "Vor- und Nachname", firma: "den Firmennamen", angebot: "den Kunden eines Angebots",
};
export const koopZuordnungWege = (wege: readonly string[]): string => wege.map((w) => KOOP_ZUORDNUNG_WEG_TEXT[w] ?? w).join(", ");

// ═══════════════════════════════════════════════════════════════════════════
// DER MONATSBERICHT AN DEN PARTNER (Register E-421, 22.10.2026)
// Justin: „ja bau die Monats-Mail mit den Empfehlungen“. Einmal im Monat (ab dem 3., für den Vormonat) bekommt jeder Partner mit
// Provision einen Überblick: neue Empfehlungen, Stand je Empfehlung, Provision des Monats und gesamt — und die Gutschrift liegt,
// wenn es eine gibt, direkt bei (dann keine zweite Mail). Rein — Versand und Daten in server/lib/fiaon-koop-empfehlung.ts.
// ═══════════════════════════════════════════════════════════════════════════
export const KOOP_BERICHT_LISTE_MAX = 12;
export interface KoopMonatsberichtEin {
  monatText: string; anrede: string; prozent: number; link: string;
  liste: { name: string; standText: string; provision: string; neu: boolean }[];
  zahlen: { gesamt: number; kunden: number; neu: number; monatProvision: string; verdient: string; ausgezahlt: string; offen: string };
  gutschrift: { nummer: string; betrag: string } | null;
  bank: { maske: string } | null;
}
export interface KoopMonatsbericht {
  betreff: string; text: string; absaetze: string[]; daten: { label: string; wert: string }[];
  knopf: { text: string; url: string }; knopf2: { text: string; url: string }; fussnote: string; anhang: { titel: string; absaetze: string[] }[];
}
const htmlSicher = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pz = (p: number) => String(p).replace(".", ",");

/** Baut den Monatsbericht. Absätze sind fertiges, sicheres HTML (nur <b>/<br>); `text` ist die Fassung ohne Tags. */
export function koopMonatsbericht(e: KoopMonatsberichtEin): KoopMonatsbericht {
  const z = e.zahlen; const m = htmlSicher(e.monatText);
  const betreff = e.gutschrift ? `Ihr Partner-Monat ${e.monatText}: ${e.gutschrift.betrag} Provision` : `Ihr Partner-Monat ${e.monatText} bei FIAON`;
  const absaetze = [
    htmlSicher(e.anrede),
    z.neu > 0 ? `vielen Dank für ${z.neu === 1 ? "Ihre neue Empfehlung" : `Ihre ${z.neu} neuen Empfehlungen`} im ${m}! Hier ist Ihr Überblick.` : `hier ist Ihr Überblick für ${m}.`,
    e.gutschrift
      ? `<b>Ihre Gutschrift ${htmlSicher(e.gutschrift.nummer)} über ${htmlSicher(e.gutschrift.betrag)} liegt bei.</b> ${e.bank ? `Wir überweisen den Betrag binnen vierzehn Tagen auf Ihr Konto ${htmlSicher(e.bank.maske)}.` : "Damit wir überweisen können, hinterlegen Sie bitte einmal Ihre Bankverbindung in Ihrem Partnerbereich unter „Ihre Auszahlungen“."}`
      : `Im ${m} ist noch keine Zahlung eines empfohlenen Kunden eingegangen. Sobald einer zahlt, kommt Ihre Gutschrift automatisch zum Monatsanfang – eine Rechnung brauchen Sie nie.`,
    `Kennen Sie jemanden, dem wir helfen können? Nennen Sie ihn uns mit einem Klick – für jeden neuen Kunden erhalten Sie ${pz(e.prozent)} % von dem, was er in den ersten ${KOOP_PROVISION_MONATE} Monaten an FIAON zahlt.`,
  ];
  const daten = [
    { label: "Ihre Empfehlungen", wert: `${z.gesamt}${z.kunden > 0 ? ` (davon ${z.kunden} ${z.kunden === 1 ? "Kunde" : "Kunden"})` : ""}` },
    { label: `Neu im ${e.monatText}`, wert: String(z.neu) },
    { label: `Provision ${e.monatText}`, wert: e.gutschrift?.betrag ?? z.monatProvision },
    { label: "Provision gesamt", wert: z.verdient },
    { label: "Ausgezahlt", wert: z.ausgezahlt },
    { label: "Noch offen", wert: z.offen },
  ].map((d) => ({ label: htmlSicher(d.label), wert: htmlSicher(d.wert) }));
  const zeilen = e.liste.slice(0, KOOP_BERICHT_LISTE_MAX).map((x) => `${htmlSicher(x.name)} · ${htmlSicher(x.standText)} · Provision bisher ${htmlSicher(x.provision)}${x.neu ? " · <b>neu</b>" : ""}`);
  if (e.liste.length > KOOP_BERICHT_LISTE_MAX) zeilen.push(`… und ${e.liste.length - KOOP_BERICHT_LISTE_MAX} weitere – alle in Ihrem Partnerbereich.`);
  const fussnote = `Provision ${pz(e.prozent)} % auf gebuchte Zahlungen Ihrer empfohlenen Kunden in den ersten ${KOOP_PROVISION_MONATE} Monaten ab Ihrer Meldung, ohne durchlaufende Fremdkosten. Muss FIAON eine Zahlung erstatten, entfällt die Provision daran.`;
  const anhang = [{ titel: "Ihre Empfehlungen", absaetze: zeilen.length ? zeilen : ["Noch keine Empfehlung."] }];
  const ohne = (s: string) => s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = [...absaetze.slice(1).map(ohne), "", ...daten.map((d) => `${ohne(d.label)}: ${ohne(d.wert)}`), "", `Ihr Partnerbereich: ${e.link}`, "", "IHRE EMPFEHLUNGEN", ...zeilen.map(ohne)].join("\n\n").replace(/\n{3,}/g, "\n\n");
  return {
    betreff, text, absaetze, daten,
    knopf: { text: "Partnerbereich öffnen", url: e.link }, knopf2: { text: "Jemanden empfehlen", url: `${e.link}#empfehlen` },
    fussnote, anhang,
  };
}
