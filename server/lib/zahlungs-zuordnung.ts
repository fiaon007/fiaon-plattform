/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZAHLUNGS-ZUORDNUNG IN STUFEN — SICHERHEIT VOR VOLLSTÄNDIGKEIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ein Bankeingang wird einer Bestellung zugeordnet. Der teure Fehler ist NICHT
 * „nicht zugeordnet" — das sieht ein Mensch auf der Prüfliste und klärt es in
 * zehn Sekunden. Der teure Fehler ist die FALSCHE Zuordnung: Sie setzt einen
 * fremden Kunden auf bezahlt, schickt ihm eine Bestätigung, bucht womöglich
 * Provision und der echte Zahler wird weiter gemahnt.
 *
 * Deshalb gilt hier durchgehend: Im Zweifel Vorschlag statt Automatik.
 *
 * DIE STUFEN
 *   1 · Referenz im Verwendungszweck        → sicher   (automatisch)
 *   2 · Absender-IBAN = hinterlegte IBAN    → sicher   (automatisch)
 *   3 · Betrag exakt + Name eindeutig       → hoch     (automatisch)
 *   4 · Alles andere                        → Vorschlagsliste für den Menschen
 *
 * Stufe 3 verlangt EINDEUTIGKEIT: Passen zwei Bestellungen gleich gut, wird
 * nichts automatisch zugeordnet — beide landen als Vorschlag.
 *
 * Tippfehler sind ausdrücklich eingeplant: „Müller" / „Mueller" / „Muller",
 * vertauschte Vor- und Nachnamen, Mädchenname, Firma statt Person, fehlende
 * Umlaute. Dafür sorgen Normalisierung und Ähnlichkeitsmaß.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Referenz-Erkennung
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FIAON-Referenz aus einem freien Verwendungszweck herauslösen.
 *
 * Kurzform (Zahlungsseite/QR-Code): FIAON-XXXXXX (6 Zeichen).
 * Langform (Bestell-Referenz):      FIAON-XXXXXXXX-XXXX (12 Zeichen).
 * Bis zu 12 alphanumerische Zeichen nach „FIAON" werden mitgenommen; die Suche
 * prüft anschliessend beide Varianten gegen beide Felder.
 *
 * Diese Funktion lag früher in `routes/fiaon-reconcile.ts`. Sie ist reine
 * Logik und wurde hierher verschoben, damit die Zuordnung ohne Datenbank
 * prüfbar ist — die Route re-exportiert sie unverändert weiter, alle
 * bestehenden Aufrufer bleiben gültig.
 */
export function extractRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = String(raw).toUpperCase();
  const idx = up.indexOf("FIAON");
  if (idx === -1) return null;
  const after = up.slice(idx + 5).replace(/[^A-Z0-9]/g, "");
  if (after.length < 6) return null;
  return `FIAON-${after.slice(0, 12)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Namens- und IBAN-Werkzeug (reine Funktionen, ohne Datenbank testbar)
// ═══════════════════════════════════════════════════════════════════════════

/** Umlaute und Akzente auflösen: „Müller" → „mueller", „Ćosić" → „cosic". */
export function normName(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Namensbestandteile ab drei Zeichen — „von", „de", „e.K." fallen weg. */
export function nameTokens(s: unknown): string[] {
  return normName(s).split(" ").filter((t) => t.length >= 3);
}

/** Levenshtein-Distanz (iterativ, speicherschonend). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let vorher = Array.from({ length: b.length + 1 }, (_, i) => i);
  let jetzt = new Array<number>(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    jetzt[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const kosten = a[i] === b[j] ? 0 : 1;
      jetzt[j + 1] = Math.min(jetzt[j] + 1, vorher[j + 1] + 1, vorher[j] + kosten);
    }
    [vorher, jetzt] = [jetzt, vorher];
  }
  return vorher[b.length];
}

/** Ähnlichkeit zweier Wörter, 0 bis 1. */
function wortAehnlichkeit(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Ähnlichkeit zweier Namen, 0 bis 1 — reihenfolgeunabhängig.
 *
 * Für jeden Bestandteil des Kundennamens wird der beste Partner im
 * Einzahlernamen gesucht. „ANNA MUELLER" und „Müller, Anna-Maria" ergeben
 * dadurch einen hohen Wert, „Anna Müller" und „Peter Schmidt" einen niedrigen.
 */
export function namensAehnlichkeit(einzahler: unknown, kunde: unknown): number {
  const a = nameTokens(einzahler);
  const b = nameTokens(kunde);
  if (a.length === 0 || b.length === 0) return 0;
  let summe = 0;
  for (const t of b) {
    let best = 0;
    for (const u of a) best = Math.max(best, wortAehnlichkeit(t, u));
    summe += best;
  }
  return summe / b.length;
}

/** IBAN auf Vergleichsform bringen: Großbuchstaben, keine Leerzeichen. */
export function normIban(s: unknown): string | null {
  const v = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v.length >= 15 ? v : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Zuordnung
// ═══════════════════════════════════════════════════════════════════════════

export interface Eingang {
  amountCents: number;
  payerName: string | null;
  senderAccount: string | null;
  /** Verwendungszweck und Beschreibung, zusammengesetzt. */
  referenceRaw: string | null;
}

export interface Kandidat {
  ref: string;
  paymentReference: string | null;
  /** Sollbetrag in Cent. */
  sollCents: number;
  paymentStatus: string;
  name: string;
  email: string | null;
  iban: string | null;
  personId: number | null;
  createdAt: Date | null;
}

export type Methode = "referenz" | "iban" | "name_betrag" | "vorschlag" | "offen";
export type Konfidenz = "sicher" | "hoch" | "mittel" | "niedrig";

export interface Vorschlag {
  ref: string;
  name: string;
  punkte: number;
  begruendung: string;
}

export interface Zuordnung {
  ref: string | null;
  personId: number | null;
  methode: Methode;
  konfidenz: Konfidenz;
  begruendung: string;
  /** true/false wenn zugeordnet, sonst null. */
  betragPasst: boolean | null;
  /** Höchstens drei, absteigend nach Güte. Nur wenn nichts automatisch passte. */
  vorschlaege: Vorschlag[];
  /** Automatisch verbuchbar? Nur Stufe 1 bis 3. */
  automatisch: boolean;
}

function trefferAuf(k: Kandidat, e: Eingang, methode: Methode, konfidenz: Konfidenz, grund: string): Zuordnung {
  return {
    ref: k.ref,
    personId: k.personId,
    methode,
    konfidenz,
    begruendung: grund,
    betragPasst: k.sollCents > 0 ? k.sollCents === e.amountCents : null,
    vorschlaege: [],
    automatisch: true,
  };
}

/** Eine Bestellung, die noch auf Geld wartet? */
function istOffen(k: Kandidat): boolean {
  return k.paymentStatus !== "paid" && k.paymentStatus !== "superseded" && k.paymentStatus !== "cancelled";
}

/**
 * Ordnet einen Eingang zu.
 *
 * `refSuche` löst eine erkannte Referenz auf (Datenbankzugriff, deshalb
 * hereingereicht — diese Funktion selbst bleibt prüfbar ohne Datenbank).
 */
export async function ordneZu(
  e: Eingang,
  kandidaten: Kandidat[],
  refSuche: (ref: string) => Promise<{ ref: string; personId: number | null } | null>,
): Promise<Zuordnung> {
  const nachRef = new Map(kandidaten.map((k) => [k.ref, k]));

  // ── Stufe 1: Referenz im Verwendungszweck ────────────────────────────────
  // Der verlässlichste Anker überhaupt. Er gilt auch dann, wenn der
  // Einzahlername nicht passt — Ehepartner, Eltern und Firmen zahlen für
  // andere. Der Name ist hier ausdrücklich NICHT das Entscheidungskriterium.
  const erkannt = extractRef(e.referenceRaw) || extractRef(e.payerName);
  if (erkannt) {
    const treffer = await refSuche(erkannt);
    if (treffer) {
      const k = nachRef.get(treffer.ref);
      const grund = `Zahlungsreferenz ${erkannt} im Verwendungszweck`;
      if (k) return trefferAuf(k, e, "referenz", "sicher", grund);
      return {
        ref: treffer.ref, personId: treffer.personId, methode: "referenz", konfidenz: "sicher",
        begruendung: grund, betragPasst: null, vorschlaege: [], automatisch: true,
      };
    }
  }

  // ── Stufe 2: Absender-IBAN = hinterlegte IBAN ────────────────────────────
  const iban = normIban(e.senderAccount);
  if (iban) {
    const passend = kandidaten.filter((k) => normIban(k.iban) === iban);
    if (passend.length > 0) {
      // Bei mehreren Bestellungen derselben IBAN: die offene mit exaktem Betrag,
      // sonst die älteste offene. Bezahlte werden nicht erneut belegt.
      const offen = passend.filter(istOffen);
      const exakt = offen.filter((k) => k.sollCents === e.amountCents);
      const ziel = exakt[0] ?? offen[0] ?? null;
      if (ziel) {
        return trefferAuf(
          ziel, e, "iban", "sicher",
          `Absender-IBAN stimmt mit der im Antrag hinterlegten IBAN überein${
            exakt.length > 0 ? " und der Betrag passt exakt" : ""}`,
        );
      }
    }
  }

  // ── Stufe 3: Betrag exakt + Name eindeutig ───────────────────────────────
  const bewertet = kandidaten
    .map((k) => ({ k, sim: namensAehnlichkeit(e.payerName, k.name), betragOk: k.sollCents === e.amountCents }))
    .filter((x) => x.sim > 0);

  const sicher = bewertet.filter((x) => x.betragOk && x.sim >= 0.85 && istOffen(x.k));
  if (sicher.length === 1) {
    return trefferAuf(
      sicher[0].k, e, "name_betrag", "hoch",
      `Betrag exakt und Name zu ${Math.round(sicher[0].sim * 100)} % übereinstimmend`,
    );
  }

  // ── Stufe 4: Vorschläge für den Menschen ─────────────────────────────────
  // Punkte: Namensähnlichkeit (0–100) + Bonus für passenden Betrag + Bonus für
  // eine noch offene Bestellung. Die Begründung sagt in Klartext, warum.
  const vorschlaege: Vorschlag[] = bewertet
    .map(({ k, sim, betragOk }) => {
      let punkte = sim * 100;
      if (betragOk) punkte += 40;
      else if (Math.abs(k.sollCents - e.amountCents) <= 200) punkte += 15;
      if (istOffen(k)) punkte += 10;
      const teile = [`Name ${Math.round(sim * 100)} % ähnlich`];
      if (betragOk) teile.push("Betrag exakt");
      else teile.push(`Betrag weicht ab (${(k.sollCents / 100).toFixed(2)} € statt ${(e.amountCents / 100).toFixed(2)} €)`);
      if (!istOffen(k)) teile.push(`bereits ${k.paymentStatus}`);
      return { ref: k.ref, name: k.name, punkte: Math.round(punkte), begruendung: teile.join(" · ") };
    })
    .filter((v) => v.punkte >= 55)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, 3);

  return {
    ref: null,
    personId: null,
    methode: vorschlaege.length > 0 ? "vorschlag" : "offen",
    konfidenz: vorschlaege.length > 0 ? (vorschlaege[0].punkte >= 100 ? "mittel" : "niedrig") : "niedrig",
    begruendung: vorschlaege.length > 0
      ? `${vorschlaege.length} möglicher Treffer — Bestätigung durch einen Menschen nötig`
      : "Kein Kandidat gefunden",
    betragPasst: null,
    vorschlaege,
    automatisch: false,
  };
}
