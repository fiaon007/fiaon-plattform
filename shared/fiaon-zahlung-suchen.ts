// ═══════════════════════════════════════════════════════════════════════════
// MARA SUCHT DIE ZAHLUNG SELBST — DER ABGLEICH (E-401 3/6, 19.10.2026)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Schrieb ein Kunde „habe bezahlt / überwiesen“, bat Mara bisher um den Beleg — und am Ende lag ein Auftrag
// „Stufe A klären“ bei einem Menschen, der im Bankbuch nachsah. Jetzt sieht der SERVER selbst nach, bevor Mara
// schreibt (wie zahlungslink_bauen vorab), und sagt ihr, was dort steht.
//
// Hier steht nur die REINE Rechnung (ohne Datenbank, im Prüfstand geprüft): Welche Eingänge der letzten
// 21 Tage gehören zu diesem Menschen, und was bedeutet das für seine Antwort?
//
// ── WANN GEHÖRT EIN EINGANG ZU IHM ────────────────────────────────────────
//   · zuordnung — das Bankbuch hat ihn schon einer seiner Bestellungen zugeordnet (matched_ref), oder
//   · referenz  — die sechs Zeichen seiner Zahlungsreferenz (FIAON-XXXXXX / FIAONXXXXXX) oder seiner
//                 Bestellnummer stehen im Verwendungszweck bzw. in der erkannten Referenz, oder
//   · name      — der Zahlername enthält Vor- UND Nachname als GANZE Wörter (ohne Umlaute/Akzente, „ae“ = „ä“).
// Ist ein Eingang schon einer FREMDEN Bestellung zugeordnet, gehört er nicht zu ihm (das Bankbuch weiß es besser). Steht im
// Zweck (oder in der erkannten Referenz) nur die FIAON-Referenz eines ANDEREN, ebenso nicht (E-401 Nachbesserung).
//
// ── NUR DER NAME (E-401 Nachbesserung, Prüfer-Fund) ──────────────────────
// Ein Eingang, bei dem NUR der Name passt (keine Referenz, keine Zuordnung im Bankbuch), ist „moeglich“: Mara sieht ihn
// sich nicht als „gefunden“ an — zwei Menschen können gleich heißen. Er kommt als Prüfauftrag auf die Karte (ohne
// „Zubuchen“-Knopf), der Kunde hört nur „wir prüfen den Eingang“, nie „gefunden/angekommen“. Sicher ist ein Eingang erst
// über Referenz oder Zuordnung (auch „abweichend“ nur so). Vorher: „Susanna Bergmann“ galt als „Anna Berg“ (Teilstück).
// Dieselbe Normalform wie der Bankabgleich E-276 (server/lib/fiaon-zahlung-unverbucht.ts).
//
// ── WAS ER BEDEUTET (Betrag GLEICH, centgenau) ────────────────────────────
//   gebucht    — schon verbucht (applied) und seiner Bestellung zugeordnet → Mara sagt es (Datum, Betrag).
//   gefunden   — da, noch nicht gebucht, Betrag = eine offene Rate oder Erstzahlung → Vorschlag auf die
//                Karte „Geld eingegangen“ (ein Mensch bucht mit einem Klick, nie Mara) + „Ich habe Ihre
//                Überweisung … gefunden, wir ordnen sie jetzt zu.“
//   unterwegs  — angekündigt (Airwallex: „Geld ist UNTERWEGS“), noch nicht auf dem Konto.
//   abweichend — da, noch nicht gebucht, er ist es (Referenz/Zuordnung) — aber der Betrag passt zu keiner offenen Forderung.
//   moeglich   — da, noch nicht gebucht, aber NUR der Name passt → ein Mensch prüft; dem Kunden nur „wir prüfen“.
//   nicht_gefunden — wie bisher: Datum/Beleg erbitten, nicht doppelt zahlen.
// Jede offene Forderung nimmt höchstens EINEN Eingang (zwei Überweisungen über 59,99 € → Rate 2 und Rate 3).
//
// ── DIE ANTWORTPRÜFUNG (zahlungAntwortFunde) ──────────────────────────────
// Nie eine Zusage, die nicht im Bankbuch steht: „gebucht“ nur, wenn gebucht; „angekommen/gefunden“ nur, wenn
// gefunden; Datum und Betrag in so einem Satz nur aus dem Bankbuch; und nie „kein Eingang“, wenn er da ist.
// ═══════════════════════════════════════════════════════════════════════════

/** So weit sieht Mara zurück (Justin/E-401: „Eingänge der letzten 21 Tage“). */
export const ZAHLUNG_SUCHEN_TAGE = 21;

// ── Normalformen (dieselben Regeln wie zweckNorm/nameNorm in fiaon-zahlung-unverbucht.ts) ──
const VON = "äöüàáâãåèéêëìíîïòóôõùúûýÿçñşșćčšžłğıÄÖÜÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝŸÇÑŞȘĆČŠŽŁĞI";
const NACH = "aouaaaaaeeeeiiiioooouuuyycnssccszlgiaouaaaaaeeeeiiiioooouuuyycnssccszlgi";

/** Verwendungszweck: groß, nur A–Z und 0–9 („Fiaon - muayrm“ → „FIAONMUAYRM“). */
export function zweckForm(x: string | null | undefined): string {
  return String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Ein Name: klein, ohne Umlaute/Akzente, „ae/oe/ue“ wie „ä/ö/ü“, „ß“ = „ss“, nur a–z. */
export function namensForm(x: string | null | undefined): string {
  let t = String(x ?? "");
  for (let i = 0; i < VON.length; i++) t = t.split(VON[i]).join(NACH[i]);
  return t.toLowerCase().replace(/ß/g, "ss").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u").replace(/[^a-z]/g, "");
}

/** Die sechs Zeichen einer Zahlungsreferenz („FIAON-596FE4“ / „FIAON596FE4-2“ → „596FE4“). */
export function referenzCode(r: string | null | undefined): string | null {
  const v = zweckForm(r);
  return /^FIAON[A-Z0-9]{6}/.test(v) && !v.startsWith("FIAONSCHUFA") ? v.slice(5, 11) : null;
}

const NAMENSTEILE = new Set(["von", "van", "der", "den", "de", "del", "da", "di", "la", "le", "zu", "zur", "ten", "ter", "al", "el", "bin", "dos", "du"]);
/** Vorname: das erste Wort (mind. 2 Buchstaben). Nachname: das längste Wort (mind. 3), ohne „von/van/de …“. */
function namensPaar(vorname: string | null | undefined, nachname: string | null | undefined): { vn: string; nn: string } | null {
  const vn = namensForm(String(vorname ?? "").trim().split(/\s+/)[0] ?? "");
  const teile = String(nachname ?? "").replace(/-/g, " ").trim().split(/\s+/).map((w) => namensForm(w)).filter((w) => w.length >= 3 && !NAMENSTEILE.has(w));
  const nn = teile.sort((a, b) => b.length - a.length)[0] ?? "";
  return vn.length >= 2 && nn.length >= 3 ? { vn, nn } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════
export interface ZsBestellung {
  ref: string;
  /** payment_reference (FIAON-XXXXXX oder FIAONXXXXXX). */
  zahlungsreferenz: string | null;
  vorname?: string | null;
  nachname?: string | null;
  /** Erstzahlung offen (abgeschickt, pending_payment/claimed_paid, nicht zusammengeführt, nicht storniert) — dann `sollCents`. */
  erstzahlungOffen: boolean;
  sollCents: number;
}

export interface ZsRate {
  id: number;
  /** Bestellnummer (fiaon_applications.ref). */
  ref: string;
  nr: number;
  zahlungsreferenz: string | null;
  cents: number;
  /** JJJJ-MM-TT */
  faellig: string | null;
}

export interface ZsEingang {
  /** fiaon_bank_txns.id */
  id: number;
  txnId: string;
  /** Buchungstag (Berlin), JJJJ-MM-TT. */
  datum: string;
  cents: number;
  zahler: string | null;
  zweck: string | null;
  erkannteRef: string | null;
  /** matched_ref — die Bestellnummer, der das Bankbuch ihn zugeordnet hat. */
  zugeordnet: string | null;
  /** applied — verbucht. */
  gebucht: boolean;
  /** match_status „ignored“ (kein Kundengeld). */
  ignoriert: boolean;
  /** Airwallex PENDING („Geld ist UNTERWEGS“). */
  unterwegs: boolean;
  /** Bei gebuchten: welche Rate er bezahlt hat (Ratennotiz „Bankeingang <txn>“). */
  rateNr?: number | null;
}

export interface ZsPerson { vorname: string | null; nachname: string | null }

export type ZsWeg = "zuordnung" | "referenz" | "name";
export type ZsStand = "gebucht" | "gefunden" | "unterwegs" | "abweichend" | "moeglich";
export type ZsArt = ZsStand | "nicht_gefunden";

export interface ZsZiel {
  art: "rate" | "erstzahlung";
  ref: string;
  /** In der Schreibweise der Datenbank (Rate: zahlungsreferenz, Erstzahlung: payment_reference). */
  referenz: string;
  rateNr: number | null;
  rateId: number | null;
  cents: number;
  faellig: string | null;
}

export interface ZsTreffer {
  eingang: ZsEingang;
  stand: ZsStand;
  wege: ZsWeg[];
  /** gefunden/unterwegs: was er damit bezahlt (Betrag gleich). abweichend: die nächste offene Forderung zum Vergleich. */
  ziel: ZsZiel | null;
}

export interface ZsErgebnis {
  art: ZsArt;
  /** Alle Treffer: gefunden, unterwegs, abweichend, gebucht — je Stand der neueste zuerst. */
  treffer: ZsTreffer[];
  haupt: ZsTreffer | null;
  /** Fällige offene Forderungen ohne gefundenen Eingang (Erstzahlung, Raten bis heute). */
  ohneEingang: ZsZiel[];
  tage: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ABGLEICH
// ═══════════════════════════════════════════════════════════════════════════
const RANG: Record<ZsStand, number> = { gefunden: 0, unterwegs: 1, abweichend: 2, gebucht: 3, moeglich: 4 };

/** Die Wörter eines Zahlernamens in Namensform („KALINA KAYALI“ → kalina, kayali; „Anna-Lena Berg“ → anna, lena, berg). */
function namensWorte(x: string | null | undefined): string[] {
  return String(x ?? "").split(/[\s,;/.\-–]+/).map((w) => namensForm(w)).filter(Boolean);
}
/**
 * Stehen Vor- UND Nachname als GANZE Wörter im Zahlernamen? Ein Doppelname darf getrennt stehen („Anna-Lena“ = „ANNA
 * LENA“). Vorher reichte ein Teilstück: „Susanna Bergmann“ enthält „anna“ und „berg“, „KALINA KAYALI“ enthält „ali“
 * und „kaya“ (Prüfer-Fund E-401). Rein.
 */
export function nameTrifft(zahler: string | null | undefined, p: { vn: string; nn: string }): boolean {
  const w = namensWorte(zahler);
  const hat = (x: string) => w.includes(x) || w.some((a, i) => i + 1 < w.length && a + w[i + 1] === x);
  return hat(p.vn) && hat(p.nn);
}
/** Die FIAON-Codes (sechs Zeichen) in Verwendungszweck und erkannter Referenz — „FIAON-ZZZ999-3“ → ZZZ999. Rein. */
export function fiaonCodesIn(...texte: (string | null | undefined)[]): string[] {
  const aus: string[] = [];
  for (const t of texte) {
    for (const m of Array.from(String(t ?? "").toUpperCase().matchAll(/FIAON[\s\-_.:]*([A-Z0-9]{6})(?![A-Z0-9])/g))) {
      if (m[1] !== "SCHUFA" && !aus.includes(m[1])) aus.push(m[1]);
    }
  }
  return aus;
}

function plusTage(t: string, n: number): string {
  const d = new Date(`${t}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Welche Rate nennt der Zweck? „FIAON-J8UU3U-3“, „FIAON J8UU3U 3“, „Rate 3“, „3. Rate“ — sonst null. */
export function rateImZweck(...texte: (string | null | undefined)[]): number | null {
  const muster = [
    /FIAON[\s-]*[A-Z0-9]{6}[\s.,\-/]+(\d{1,2})(?![\d.,]\d)(?!\d)/i,
    /\brate\s*(?:nr\.?\s*)?(\d{1,2})\b/i,
    /\b(\d{1,2})\s*\.?\s*rate\b/i,
  ];
  for (const t of texte) {
    for (const m of muster) {
      const x = String(t ?? "").match(m);
      if (x) {
        const n = Number(x[1]);
        if (Number.isInteger(n) && n >= 1 && n <= 36) return n;
      }
    }
  }
  return null;
}

/**
 * Sucht seine Zahlung im Bankbuch. Rein. `heute` als JJJJ-MM-TT (Berlin). Eingänge außerhalb des Fensters
 * (`tage`, Vorgabe 21), ohne Geld oder „kein Kundengeld“ zählen nicht.
 */
export function zahlungSuchen(ein: {
  person: ZsPerson;
  bestellungen: ZsBestellung[];
  raten: ZsRate[];
  eingaenge: ZsEingang[];
  heute: string;
  tage?: number;
}): ZsErgebnis {
  const tage = Math.max(1, Math.min(90, Math.round(Number(ein.tage ?? ZAHLUNG_SUCHEN_TAGE)) || ZAHLUNG_SUCHEN_TAGE));
  const ab = plusTage(ein.heute, -tage);

  // Seine Kennzeichen: Bestellnummern (genau), Codes (Zahlungsreferenz, Bestellnummer, Raten), Namen.
  const refs = ein.bestellungen.map((b) => b.ref);
  const refsForm = refs.map((r) => zweckForm(r));
  const codes: string[] = [];
  const codeDazu = (c: string | null) => { if (c && !codes.includes(c)) codes.push(c); };
  for (const b of ein.bestellungen) { codeDazu(referenzCode(b.zahlungsreferenz)); codeDazu(referenzCode(b.ref)); }
  for (const r of ein.raten) codeDazu(referenzCode(r.zahlungsreferenz));
  const paare: { vn: string; nn: string }[] = [];
  for (const p of [namensPaar(ein.person.vorname, ein.person.nachname), ...ein.bestellungen.map((b) => namensPaar(b.vorname, b.nachname))]) {
    if (p && !paare.some((x) => x.vn === p.vn && x.nn === p.nn)) paare.push(p);
  }

  const seins = (zugeordnet: string | null) => !!zugeordnet && refsForm.includes(zweckForm(zugeordnet));
  const wegeFuer = (e: ZsEingang): ZsWeg[] => {
    const w: ZsWeg[] = [];
    if (seins(e.zugeordnet)) w.push("zuordnung");
    const zf = zweckForm(e.zweck);
    const ef = zweckForm(e.erkannteRef);
    if (codes.some((c) => zf.includes(c) || ef.startsWith(`FIAON${c}`))) w.push("referenz");
    if (e.zahler && paare.some((p) => nameTrifft(e.zahler, p))) w.push("name");
    return w;
  };
  /** Steht im Zweck nur die FIAON-Referenz eines ANDEREN (keiner seiner Codes)? Dann ist es nicht seiner. */
  const fremdeReferenz = (e: ZsEingang): boolean => {
    const imZweck = fiaonCodesIn(e.zweck, e.erkannteRef);
    return imZweck.length > 0 && !imZweck.some((c) => codes.includes(c));
  };

  // Was er schuldet: Erstzahlungen und offene Raten — Erstzahlung zuerst, Raten nach Fälligkeit.
  const ziele: ZsZiel[] = [
    ...ein.bestellungen.filter((b) => b.erstzahlungOffen && b.sollCents > 0).map((b): ZsZiel => ({
      art: "erstzahlung", ref: b.ref, referenz: b.zahlungsreferenz || b.ref, rateNr: null, rateId: null, cents: b.sollCents, faellig: null,
    })),
    ...ein.raten.slice().sort((a, b) => String(a.faellig ?? "9999").localeCompare(String(b.faellig ?? "9999")) || a.nr - b.nr).map((r): ZsZiel => ({
      art: "rate", ref: r.ref, referenz: r.zahlungsreferenz || r.ref, rateNr: r.nr, rateId: r.id, cents: r.cents, faellig: r.faellig,
    })),
  ];
  const zielKey = (z: ZsZiel) => `${z.art}:${z.ref}:${z.rateNr ?? 0}`;
  const vergeben: string[] = [];

  const treffer: ZsTreffer[] = [];
  const kandidaten = ein.eingaenge
    .filter((e) => e.cents > 0 && !e.ignoriert && e.datum && e.datum >= ab && e.datum <= plusTage(ein.heute, 1))
    // Ältere zuerst: Zwei gleiche Überweisungen bezahlen erst die ältere Forderung.
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.id - b.id);
  for (const e of kandidaten) {
    // Einer fremden Bestellung zugeordnet: nicht seiner.
    if (e.zugeordnet && !seins(e.zugeordnet)) continue;
    // E-401 Nachbesserung: Nennt der Zweck die FIAON-Referenz eines anderen Kunden (und keine seiner), ist es nicht seiner —
    // auch wenn der Name passt (das Bankbuch hat ihn nur noch nicht zugeordnet).
    if (!seins(e.zugeordnet) && fremdeReferenz(e)) continue;
    const wege = wegeFuer(e);
    if (!wege.length) continue;
    if (e.gebucht) {
      // Verbucht zählt nur, wenn das Bankbuch ihn SEINER Bestellung zugeordnet hat.
      if (wege.includes("zuordnung")) treffer.push({ eingang: e, stand: "gebucht", wege, ziel: null });
      continue;
    }
    // E-401 Nachbesserung: NUR der Name — „moeglich“ (ein Mensch prüft); bindet keine Forderung, die ein sicherer Eingang
    // (Referenz) braucht. Auch „abweichend“ und „unterwegs“ gibt es nur über Referenz oder Zuordnung.
    if (!wege.includes("zuordnung") && !wege.includes("referenz")) {
      const gleich = ziele.find((z) => z.cents === e.cents && !vergeben.includes(zielKey(z))) ?? null;
      treffer.push({ eingang: e, stand: "moeglich", wege, ziel: gleich });
      continue;
    }
    const zf = zweckForm(e.zweck);
    const genannt = rateImZweck(e.zweck, e.erkannteRef);
    const passend = ziele
      .filter((z) => z.cents === e.cents && !vergeben.includes(zielKey(z)))
      .map((z) => {
        const code = referenzCode(z.referenz);
        let p = 0;
        if (code && zf.includes(code)) p += 4;
        if (z.rateNr != null && genannt != null && z.rateNr === genannt) p += 2;
        return { z, p };
      })
      .sort((a, b) => b.p - a.p);
    const ziel = passend[0]?.z ?? null;
    if (ziel) {
      vergeben.push(zielKey(ziel));
      treffer.push({ eingang: e, stand: e.unterwegs ? "unterwegs" : "gefunden", wege, ziel });
    } else {
      const offen = ziele.find((z) => !vergeben.includes(zielKey(z))) ?? null;
      treffer.push({ eingang: e, stand: e.unterwegs ? "unterwegs" : "abweichend", wege, ziel: offen });
    }
  }
  treffer.sort((a, b) => RANG[a.stand] - RANG[b.stand] || b.eingang.datum.localeCompare(a.eingang.datum) || b.eingang.id - a.eingang.id);
  const haupt = treffer[0] ?? null;
  const ohneEingang = ziele.filter((z) => !vergeben.includes(zielKey(z)) && (z.art === "erstzahlung" || (z.faellig != null && z.faellig <= ein.heute)));
  return { art: haupt ? haupt.stand : "nicht_gefunden", treffer, haupt, ohneEingang, tage };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXTE — was Mara sagt (Satz), was sie weiß (Hinweis), was im Datensatz steht (kurz)
// ═══════════════════════════════════════════════════════════════════════════
/** „59,99 €“ */
export function euroDe(cents: number): string {
  return `${(Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
/** „2026-10-16“ → „16.10.2026“ */
export function tagDe(iso: string | null | undefined): string {
  const t = String(iso ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : "";
}
function zielText(z: ZsZiel | null): string {
  if (!z) return "";
  return z.art === "rate" ? `Rate ${z.rateNr} (${z.referenz})` : `Erstzahlung (${z.referenz})`;
}
const WEG_TEXT: Record<ZsWeg, string> = { zuordnung: "im Bankbuch seiner Bestellung zugeordnet", referenz: "Referenz im Verwendungszweck", name: "sein Name als Zahler" };

/** Der eine Satz, den die Antwort sagen soll (Deutsch). */
export function zahlungSatz(e: ZsErgebnis): string {
  const h = e.haupt;
  if (!h) {
    return "Auf unserem Konto ist zu Ihrer Zahlung noch kein Eingang zu sehen — eine Überweisung braucht oft ein bis zwei Werktage. "
      + "Schicken Sie mir gern den Beleg (Datum, Betrag, Verwendungszweck), und bitte überweisen Sie nicht noch einmal.";
  }
  const b = euroDe(h.eingang.cents);
  const t = tagDe(h.eingang.datum);
  // E-401 Nachbesserung: Die ältere, gebuchte Zahlung ist da — die NEU gemeldete fehlt noch: auch das sagt der Satz.
  const offen = e.ohneEingang[0] ?? null;
  const offenSatz = offen
    ? ` Zu Ihrer ${offen.art === "rate" ? `Rate ${offen.rateNr}` : "Zahlung"} über ${euroDe(offen.cents)} sehe ich noch keinen Eingang — schicken Sie mir gern den Beleg, und bitte überweisen Sie nicht noch einmal.`
    : "";
  switch (h.stand) {
    case "moeglich":
      return "Danke für Ihre Nachricht! Wir prüfen gerade die Eingänge auf unserem Konto und ordnen Ihre Zahlung zu — Sie hören von uns, sobald das erledigt ist. Bitte überweisen Sie nicht noch einmal.";
    case "gefunden":
      return `Ich habe Ihre Überweisung über ${b} gefunden (bei uns eingegangen am ${t}), wir ordnen sie jetzt zu.`;
    case "abweichend":
      return `Ihre Überweisung über ${b} ist bei uns angekommen (am ${t}), wir ordnen sie jetzt zu.`;
    case "unterwegs":
      return `Ihre Überweisung über ${b} ist auf dem Weg zu uns (angekündigt am ${t}) — sobald sie angekommen ist, ordnen wir sie zu.`;
    case "gebucht":
    default:
      return `Ihre Zahlung über ${b} ist am ${t} bei uns eingegangen und gebucht${h.eingang.rateNr ? ` (Rate ${h.eingang.rateNr})` : ""}.${offenSatz}`;
  }
}

/** Kurzform für Datensatz und Belegprüfung (werkzeugDaten.zahlung_suchen) — Beträge auch als „59.99“. */
export function zahlungKurz(e: ZsErgebnis): {
  art: ZsArt; satz: string; tage: number;
  treffer: { stand: ZsStand; eingang: number; datum: string; betrag: string; betragPunkt: string; ziel: string | null; wege: ZsWeg[] }[];
  ohneEingang: { ziel: string; betrag: string; betragPunkt: string; faellig: string | null }[];
} {
  return {
    art: e.art, satz: zahlungSatz(e), tage: e.tage,
    treffer: e.treffer.slice(0, 6).map((t) => ({
      stand: t.stand, eingang: t.eingang.id, datum: tagDe(t.eingang.datum), betrag: euroDe(t.eingang.cents),
      betragPunkt: (t.eingang.cents / 100).toFixed(2), ziel: t.ziel ? zielText(t.ziel) : (t.eingang.rateNr ? `Rate ${t.eingang.rateNr}` : null), wege: t.wege,
    })),
    ohneEingang: e.ohneEingang.slice(0, 4).map((z) => ({ ziel: zielText(z), betrag: euroDe(z.cents), betragPunkt: (z.cents / 100).toFixed(2), faellig: z.faellig ? tagDe(z.faellig) : null })),
  };
}

/** Eine Zeile je Treffer für den Hinweis an Mara (und die Akte). */
export function trefferZeile(t: ZsTreffer): string {
  const b = euroDe(t.eingang.cents);
  const d = tagDe(t.eingang.datum);
  const wie = t.wege.map((w) => WEG_TEXT[w]).join(", ");
  switch (t.stand) {
    case "moeglich":
      return "MÖGLICHER EINGANG (NUR der Name des Zahlers passt, keine Referenz) — ob er zu ihm gehört, prüft ein Mensch (Karte im Mara-Steuerpult). Betrag und Datum dieses Eingangs nennst du NICHT.";
    case "gebucht":
      return `GEBUCHT: ${b}, bei uns eingegangen am ${d}${t.eingang.rateNr ? ` (Rate ${t.eingang.rateNr})` : ""} — schon verbucht.`;
    case "gefunden":
      return `ANGEKOMMEN, NOCH NICHT GEBUCHT: ${b}, eingegangen am ${d}, passt zu seiner ${zielText(t.ziel)} (Betrag gleich; ${wie}).`;
    case "unterwegs":
      return `UNTERWEGS: ${b}, angekündigt am ${d}${t.ziel ? ` (passt zu seiner ${zielText(t.ziel)})` : ""} — noch nicht auf dem Konto.`;
    case "abweichend":
    default:
      return `ANGEKOMMEN, BETRAG WEICHT AB: ${b}, eingegangen am ${d} (${wie})${t.ziel ? ` — offen ist seine ${zielText(t.ziel)} über ${euroDe(t.ziel.cents)}` : " — offen ist nichts mehr"}.`;
  }
}

/**
 * Der Block für Maras Auftrag (vorab, wie „VORAB GEHOLT“). `kanal` steuert nur den Zusatz zur Zahlungsstelle (Mail).
 * `kartenGelegt`: der Server hat den Eingang Justin zum Zuordnen vorgelegt (Karte „Geld eingegangen“).
 */
export function zahlungHinweis(e: ZsErgebnis, o: { kanal: "mail" | "whatsapp"; kartenGelegt?: boolean } = { kanal: "mail" }): string {
  const satz = zahlungSatz(e);
  const kopf = `ZAHLUNG GESUCHT (zahlung_suchen ist gelaufen — der Server hat eben im Bankbuch nachgesehen, alle Eingänge der letzten ${e.tage} Tage; nicht noch einmal fragen):`;
  const fakten = [
    ...e.treffer.slice(0, 4).map((t) => `· ${trefferZeile(t)}`),
    ...e.ohneEingang.slice(0, 3).map((z) => `· NOCH OHNE EINGANG: seine ${zielText(z)} über ${euroDe(z.cents)}${z.faellig ? `, fällig ${tagDe(z.faellig)}` : ""}.`),
  ];
  // E-401 Nachbesserung (Prüfer-Fund): „keine Aufgabe“ nur, wenn wirklich nichts mehr offen ist — fehlt die neu gemeldete
  // Zahlung noch (NOCH OHNE EINGANG) oder passt nur der Name, gilt die Regel zum Zahlungsbeleg wie bisher.
  const keinMensch = o.kanal === "mail"
    ? (zahlungsstelleUnnoetig(e, o.kartenGelegt ? [e.haupt?.eingang.id ?? 0] : [])
      ? " Keine Aufgabe an die Zahlungsstelle oder einen Kollegen dafür — der Server hat es schon erledigt."
      : " Schickt er einen Beleg mit, gilt die Regel zum Zahlungsbeleg wie bisher (Aufgabe an die Zahlungsstelle).")
    : " Kein Kollege, kein Termin.";
  const nieGebucht = "Sag nicht „gebucht“, „verbucht“ oder „freigeschaltet“ — das geschieht erst mit der Zuordnung.";
  const offenRest = e.ohneEingang.length
    ? " Für das, was NOCH OHNE EINGANG ist, siehst du keinen Eingang: das sagst du ruhig dazu (eine Überweisung braucht oft ein bis zwei Werktage) und bittest um den Beleg (Datum, Betrag, Verwendungszweck) — und darum, nicht doppelt zu überweisen."
    : "";
  let tun: string;
  switch (e.art) {
    case "gefunden":
      tun = `SO ANTWORTEST DU: Danke ihm — seine Überweisung IST da. Sag es mit Betrag und Eingangstag, so: „${satz}“ ${nieGebucht} Keine Zahlungsbitte, kein Zahlungslink, keinen Beleg verlangen.${o.kartenGelegt ? " Die Zuordnung liegt schon zur Freigabe bereit." : ""}${keinMensch}`;
      break;
    case "abweichend":
      tun = `SO ANTWORTEST DU: Danke ihm — seine Überweisung ist da, nur der Betrag passt zu keiner offenen Forderung genau. Sag es so: „${satz}“ Nenn den Betrag, wie er angekommen ist. ${nieGebucht} Keine neue Zahlungsbitte und keine Zusage, ob etwas fehlt oder zurückgeht — das klärt die Zuordnung.${keinMensch}`;
      break;
    case "unterwegs":
      tun = `SO ANTWORTEST DU: Danke ihm — seine Überweisung ist angekündigt und auf dem Weg. Sag es so: „${satz}“ Nicht „angekommen“, nicht „gebucht“. Keine Zahlungsbitte; bitte ihn, nicht noch einmal zu überweisen.${keinMensch}`;
      break;
    case "moeglich":
      tun = `SO ANTWORTEST DU: Danke ihm. Auf dem Konto ist ein Eingang, bei dem NUR der Name passt — ob es seiner ist, prüft ein Mensch. Sag es so: „${satz}“ Sag NICHT, dass sie angekommen, gefunden oder gebucht ist, und nenn keinen Betrag und kein Datum dieses Eingangs. Keine Zahlungsbitte.${keinMensch}`;
      break;
    case "gebucht":
      tun = `SO ANTWORTEST DU: Seine Zahlung ist schon gebucht — sag es ihm mit Datum und Betrag und danke ihm, so: „${satz}“${offenRest || " Es ist dazu nichts mehr offen — keine Zahlungsbitte."}${keinMensch}`;
      break;
    default:
      tun = `NICHTS GEFUNDEN: Auf dem Konto ist in den letzten ${e.tage} Tagen KEIN passender Eingang von ihm. Danke ihm ehrlich, ohne Vorwurf: Eine Überweisung braucht oft ein bis zwei Werktage. Bitte ihn um den Beleg (Datum, Betrag, Verwendungszweck) und darum, in seinem Banking nachzusehen, ob sie mit seinem Verwendungszweck ausgeführt wurde — und NICHT noch einmal zu überweisen. Sinngemäß: „${satz}“ Sag NIE, dass sie angekommen, gefunden oder gebucht ist.${o.kanal === "mail" ? " Schickt er einen Beleg mit, gilt die Regel zum Zahlungsbeleg wie bisher." : " Kein Kollege, kein Termin."}`;
  }
  return [kopf, ...fakten, `ZU SEINER ZAHLUNG (seine übrigen Fragen beantwortest du wie sonst) — ${tun}`].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANTWORTPRÜFUNG — nie eine Zusage, die nicht im Bankbuch steht
// ═══════════════════════════════════════════════════════════════════════════
const L = String.raw`(?<![\p{L}\p{N}])`;
const R = String.raw`(?![\p{L}\p{N}])`;
// Nur die Zahlung selbst — nicht „Zahlungserinnerung“, „Zahlungsseite“, „Zahlungslink“ (die bekommt er ja wirklich).
const ZAHL_NOMEN = new RegExp(`${L}(?:zahlung(?:en)?|zahlungseingang|überweisung(?:en)?|ueberweisung(?:en)?|betrag|beträge|rate|raten|monatsrate|eingang|eingänge|geld|payments?|transfers?|money|amount|instal+ments?)${R}`, "iu");
/** „sie/es/diese“ für die Zahlung — klein geschrieben; groß nur „Sie ist/wurde …“ (das höfliche „Sie“ sagt „sind“). */
const PRONOMEN = new RegExp(`${L}(?:sie|diese|dieser|es|er|it|this)${R}`, "u");
const PRONOMEN_GROSS = /^(?:Sie|Diese|Es|Er|It|This)\s+(?:ist|wurde|was|has)\b/;
const GEBUCHT = new RegExp(`${L}(?:gebucht|verbucht|zugebucht|verrechnet|gutgeschrieben|booked|credited|posted|recorded)${R}`, "iu");
const DA = new RegExp(`${L}(?:eingegangen|angekommen|gefunden|erhalten|eingetroffen|gutgeschrieben|received|arrived|found)${R}|${L}(?:ist|sind)\\s+(?:schon\\s+|bereits\\s+)?(?:bei\\s+uns\\s+)?da${R}`, "iu");
const NEGATION = new RegExp(`${L}(?:nicht|noch\\s+nicht|kein\\p{L}*|nie|niemals|nichts|not|no|never|yet\\s+to)${R}`, "iu");
const BEDINGT = new RegExp(`${L}(?:sobald|wenn|falls|nachdem|bis|wird|werden|würde|wuerde|kann|könnte|once|when|if|after|will|would|as\\s+soon)${R}|${L}nach\\s+(?:der|dem|ihrer|ihrem)\\s+(?:buchung|eingang|zahlung|zuordnung)${R}`, "iu");
const KEIN_EINGANG = new RegExp(`${L}(?:kein\\p{L}*\\s+(?:passende\\p{L}*\\s+)?(?:eingang|zahlungseingang|zahlung|überweisung|ueberweisung)|(?:noch\\s+)?nicht\\s+(?:bei\\s+uns\\s+)?(?:eingegangen|angekommen|gefunden|da)|noch\\s+nichts\\s+(?:eingegangen|angekommen)|no\\s+payment|not\\s+(?:yet\\s+)?(?:arrived|received|found))${R}`, "iu");
const DATUM = /\b(\d{1,2})\.(\d{1,2})\.(?:\d{2,4})?/g;
const BETRAG = /\b(\d{1,4}(?:\.\d{3})*)(?:[.,](\d{2}))?\s*(?:€|EUR|Euro)/gi;

/** Sätze — ein Punkt hinter einem Datum („am 16.10. bei uns“) trennt nicht; „…2026. Ihre …“ schon. */
function saetze(text: string): string[] {
  return String(text ?? "").split(/(?<=[!?])\s+|(?<=[^\d\s][.])\s+|(?<=\d{4}[.])\s+(?=[A-ZÄÖÜ„"])|\n+/).map((s) => s.trim()).filter(Boolean);
}
/** Teilsätze — Komma (nicht in „59,99“), Semikolon, Gedankenstrich, „aber“, „und“ trennen Aussagen. */
function teile(satz: string): string[] {
  return satz.split(/(?<!\d),|,(?!\d)|[;:–—]|\s(?:aber|und|but|and|doch)\s/i).map((s) => s.trim()).filter(Boolean);
}
/**
 * Sagt dieser Satz, dass eine Zahlung DA ist bzw. gebucht ist (nicht verneint, nicht bedingt)? `vorher`: Der Satz davor
 * sprach von der Zahlung — dann zählt auch „Sie ist bei uns eingegangen.“ (Pronomen ohne eigenes Zahlungswort).
 */
function behauptung(satz: string, verb: RegExp, vorher = false): string | null {
  const nomenImSatz = ZAHL_NOMEN.test(satz);
  if (!nomenImSatz && !vorher) return null;
  for (const t of teile(satz)) {
    if (!verb.test(t)) continue;
    if (NEGATION.test(t) || BEDINGT.test(t)) continue;
    if (nomenImSatz && (ZAHL_NOMEN.test(t) || PRONOMEN.test(t) || PRONOMEN_GROSS.test(t) || /^(?:ist|wurde|sind|wurden|haben|habe|has|have|was)\b/i.test(t))) return satz;
    if (!nomenImSatz && PRONOMEN_GROSS.test(t)) return satz;
  }
  return null;
}
const tagMonat = (d: string, m: string) => `${String(Number(d)).padStart(2, "0")}.${String(Number(m)).padStart(2, "0")}`;

/**
 * Prüft Maras Antwort gegen das Bankbuch. Liefert Mängel als Sätze (leer = in Ordnung). Rein.
 * `frueher`: Zahlungen, die schon länger gebucht sind (Akte) — ein Satz darüber mit genau diesem Datum oder Betrag ist frei.
 */
export function zahlungAntwortFunde(text: string, e: ZsErgebnis, o: { frueher?: { datum: string; cents: number }[] } = {}): string[] {
  const funde: string[] = [];
  const satz = zahlungSatz(e);
  const gebucht = e.treffer.filter((t) => t.stand === "gebucht");
  const da = e.treffer.filter((t) => t.stand === "gefunden" || t.stand === "abweichend" || t.stand === "gebucht");
  const unterwegs = e.treffer.filter((t) => t.stand === "unterwegs");
  const erlaubteTage = new Set<string>();
  const erlaubteCents = new Set<number>();
  for (const t of e.treffer) {
    // E-401 Nachbesserung: Ein nur „möglicher“ Eingang (nur der Name) kann einem anderen gehören — sein Datum und Betrag
    // sind nie eine Aussage über SEINE Zahlung.
    if (t.stand === "moeglich") continue;
    erlaubteTage.add(tagMonat(t.eingang.datum.slice(8, 10), t.eingang.datum.slice(5, 7)));
    erlaubteCents.add(t.eingang.cents);
    if (t.ziel) erlaubteCents.add(t.ziel.cents);
  }
  for (const z of e.ohneEingang) {
    erlaubteCents.add(z.cents);
    if (z.faellig) erlaubteTage.add(tagMonat(z.faellig.slice(8, 10), z.faellig.slice(5, 7)));
  }
  const frueherTage = (o.frueher ?? []).map((f) => tagMonat(f.datum.slice(8, 10), f.datum.slice(5, 7)));
  const frueherCents = (o.frueher ?? []).map((f) => f.cents);
  const zitat = (s: string) => (s.length > 90 ? `${s.slice(0, 89)} …` : s);

  let vorher = false;
  for (const s of saetze(text)) {
    const davor = vorher;
    vorher = ZAHL_NOMEN.test(s);
    const tageImSatz = Array.from(s.matchAll(DATUM)).map((m) => tagMonat(m[1], m[2]));
    const centsImSatz = Array.from(s.matchAll(BETRAG)).map((m) => Number(String(m[1]).replace(/\./g, "")) * 100 + Number(m[2] ?? 0));
    // Ein Satz über eine ältere, gebuchte Zahlung (Akte) — nur mit genau ihrem Datum (ein Betrag allein wäre mehrdeutig).
    const ueberFrueher = tageImSatz.length > 0 && tageImSatz.every((t) => frueherTage.includes(t))
      && (!centsImSatz.length || centsImSatz.every((c) => frueherCents.includes(c)));
    const g = behauptung(s, GEBUCHT, davor);
    if (g && !gebucht.length && !ueberFrueher) {
      funde.push(`Die Antwort sagt, die Zahlung sei gebucht („${zitat(g)}“) — im Bankbuch ist dazu nichts gebucht (${e.tage} Tage). Schreib nur, was zahlung_suchen gefunden hat: „${satz}“`);
      continue;
    }
    const d = !g ? behauptung(s, DA, davor) : null;
    if (d && !da.length && !ueberFrueher) {
      if (!unterwegs.length) {
        funde.push(`Die Antwort sagt, die Zahlung sei angekommen oder gefunden („${zitat(d)}“) — im Bankbuch ist dazu kein passender Eingang (${e.tage} Tage). Schreib: „${satz}“`);
        continue;
      }
      // Unterwegs: „gefunden“ stimmt, „angekommen/eingegangen“ noch nicht.
      if (!/gefunden|found/i.test(d)) {
        funde.push(`Die Antwort sagt, die Zahlung sei angekommen („${zitat(d)}“) — sie ist erst angekündigt (unterwegs). Schreib: „${satz}“`);
        continue;
      }
    }
    if ((g || d) && !ueberFrueher) {
      const fremdTag = tageImSatz.find((t) => !erlaubteTage.has(t));
      const fremdBetrag = centsImSatz.find((c) => !erlaubteCents.has(c));
      if (fremdTag) funde.push(`Datum ${fremdTag}. in einer Zahlungsaussage („${zitat(s)}“) steht so nicht im Bankbuch — nimm das Datum aus zahlung_suchen: „${satz}“`);
      if (fremdBetrag != null) funde.push(`Betrag ${euroDe(fremdBetrag)} in einer Zahlungsaussage („${zitat(s)}“) steht so nicht im Bankbuch — nimm den Betrag aus zahlung_suchen: „${satz}“`);
      continue;
    }
    // Der Eingang IST da — „kein Eingang“ wäre falsch (außer für eine andere, noch offene Forderung).
    if (KEIN_EINGANG.test(s) && (e.art === "gefunden" || e.art === "abweichend") && !e.ohneEingang.length) {
      funde.push(`Die Antwort sagt, es sei kein Eingang da („${zitat(s)}“) — seine Überweisung ist im Bankbuch. Schreib: „${satz}“`);
    }
  }
  return funde;
}

const MELDUNG = new RegExp(String.raw`(?<![\p{L}])(?:habe|hab|hatte|haben|wurde|ist|sind|schon|bereits|gestern|heute|soeben|eben)\s+(?:[^\s.!?]+\s+){0,5}?(?:bezahlt|überwiesen|ueberwiesen|gezahlt|eingezahlt|beglichen|abgebucht)(?![\p{L}])|(?<![\p{L}])(?:zahlungsbeleg|überweisungsbeleg|ueberweisungsbeleg|zahlungsnachweis|überweisungsnachweis)(?![\p{L}])|(?<![\p{L}])(?:i\s+(?:have\s+)?(?:already\s+)?(?:paid|transferred)|payment\s+(?:has\s+been\s+)?(?:sent|made))(?![\p{L}])`, "iu");
const VERNEINT = new RegExp(String.raw`(?<![\p{L}])(?:nicht|kein\p{L}*|nie|noch\s+nicht|not)(?![\p{L}])`, "iu");
/** Ein Fragesatz: endet mit „?“ oder beginnt mit einem Fragewort / Verb zuerst („Ist die Rate schon bezahlt“). */
const FRAGE_ANFANG = /^\s*(?:ist|sind|wurde|wurden|muss|m(?:ü|ue)ssen|soll|sollte|sollen|kann|k(?:ö|oe)nnen|hat|habt|haben\s+sie|bis\s+wann|wann|wie|wo|warum|wieso|was|has|have\s+you|did|is|was)\b/i;
/** Er selbst meldet: „ich/wir habe(n) …“, „habe … bezahlt“ (ohne „ich“ am Satzanfang) — nicht „Habe ich …?“. */
const ICH_MELDET = new RegExp(String.raw`(?:^|[^\p{L}])(?:ich|wir)\s+(?:[^\s.!?]+\s+){0,2}?(?:habe|hab|haben|hatte|hatten)(?![\p{L}])|^\s*(?:habe|hab|hatte)\s+(?!ich\b|wir\b)|(?:^|[^\p{L}])i\s+(?:have\s+)?(?:already\s+)?(?:paid|transferred)(?![\p{L}])`, "iu");

/**
 * Hat er eine Zahlung gemeldet? (Mail und WhatsApp — nur seine eigenen Worte). Rein.
 * E-401 Nachbesserung (Prüfer-Fund): Eine FRAGE ist keine Meldung — „Ist die Rate schon bezahlt?“, „Muss die Rate heute
 * bezahlt werden?“, „Wurde meine Rate schon abgebucht?“ lösten die Suche aus, und Mara bat einen Kunden, der nie gezahlt
 * hatte, „bitte nicht noch einmal überweisen“. In einer Frage zählt nur, was er selbst meldet („Ich habe heute bezahlt,
 * ist das angekommen?“).
 */
export function meldetBezahlt(text: string): boolean {
  const k = String(text ?? "");
  if (!k.trim()) return false;
  for (const satz of k.split(/(?<=[.!?])\s+|\n+/)) {
    const m = satz.match(MELDUNG);
    // „Ich habe noch nicht bezahlt“ / „habe es nie überwiesen“ ist keine Meldung.
    if (!m || VERNEINT.test(m[0])) continue;
    const frage = /\?\s*$/.test(satz) || FRAGE_ANFANG.test(satz);
    if (!frage || ICH_MELDET.test(satz.slice(0, (m.index ?? 0) + m[0].length))) return true;
  }
  return false;
}

/**
 * Braucht es für seine gemeldete Zahlung KEINE Aufgabe an die Zahlungsstelle mehr? Nur, wenn nichts Fälliges mehr ohne
 * Eingang ist UND der Eingang gebucht, angekündigt (unterwegs) oder gefunden UND dem Menschen vorgelegt ist (Karte).
 * Bei „abweichend“, „moeglich“ (nur der Name) oder einer noch fehlenden Zahlung bleibt die Regel zum Zahlungsbeleg.
 * (E-401 Nachbesserung, Prüfer-Fund: vorher sperrte schon ein älterer, gebuchter Eingang die Weitergabe des Belegs.) Rein.
 */
export function zahlungsstelleUnnoetig(e: ZsErgebnis, vorgelegt: number[]): boolean {
  if (e.ohneEingang.length || !e.haupt) return false;
  if (e.art === "gebucht" || e.art === "unterwegs") return true;
  if (e.art === "gefunden") return vorgelegt.includes(e.haupt.eingang.id);
  return false;
}
/**
 * Meint eine aufgabe_an_betreuer die Zahlungsstelle (kollege „Zahlung“ — dieselbe Regel wie im Werkzeug) — ohne Rückruf
 * und nicht die Leitung? Nur dann kann zahlung_suchen sie ersetzen. Titel und Text zählen NICHT (Prüfer-Fund: „Erstattung
 * der doppelten Überweisung“ an die Leitung wurde gesperrt). Rein.
 */
export function aufgabeAnZahlungsstelle(p: { kollege?: unknown; rueckruf_am?: unknown } | null | undefined): boolean {
  const kollege = String(p?.kollege ?? "");
  if (String(p?.rueckruf_am ?? "").trim()) return false;
  if (/\b(leitung|chef|gesch[äa]ftsf[üu]hr\w*|management)\b/i.test(kollege)) return false;
  return /\b(zahlung|beleg|buchhaltung|inkasso|forderung|bankbuch)\b/i.test(kollege);
}
