// ═══════════════════════════════════════════════════════════════════════════
// WIE VERDIENT DIESER MENSCH? — EINE QUELLE FÜR VORSCHAU UND ABRECHNUNG
//
// ── DIE FORDERUNG AUS DEM AUFTRAG ──────────────────────────────────────────
// „Diese Vorschau liest dieselbe Berechnung wie die Abrechnung (EINE Quelle —
// Grep, dass keine zweite Rechnung entsteht)."
//
// Das ist der Kern dieser Datei. Ohne sie gäbe es zwei Rechnungen: eine, die dem
// Betreiber im Reiter eine Zahl zeigt, und eine, die tatsächlich bucht. Sie
// würden auseinanderlaufen, und der erste Streit darüber wäre einer über Geld.
//
// ── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
// Diese Datei BUCHT nicht. Sie beantwortet Fragen:
//   · „Was bekommt dieser Mensch für einen Abschluss dieses Pakets?"
//   · „Was bekommt er für ein geführtes Startgespräch?"
//   · „Was hat er in diesem Monat zusammen — gebucht und absehbar?"
// Wer bucht, holt sich die Antwort hier und schreibt sie in
// `fiaon_commissions`. Dort steht der Betrag dann FEST (Einfrier-Prinzip): Eine
// spätere Änderung des Bausteins rührt eine gebuchte Zeile nicht an.
//
// ── DER BESTAND WIRD NICHT ÜBERGANGEN ─────────────────────────────────────
// Es gibt neun Menschen mit Werten in den alten Feldern (`commission_rate_bp`,
// `stundensatz_cents`, `inkasso_praemie_wert`). Jede Funktion hier liest ZUERST
// einen Baustein und fällt sonst auf das alte Feld zurück. Ein Umzug per
// Migration wäre ein stiller Eingriff in Vergütungsdaten — das entscheidet der
// Betreiber. Der Rückfall ist ausdrücklich und benannt (`herkunft`), damit die
// Oberfläche zeigen kann, woher eine Zahl kommt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";

export type BausteinTyp = "fixum" | "provision" | "pauschale" | "stundensatz" | "einmalig";

export interface Baustein {
  id: number;
  agentId: number;
  typ: BausteinTyp;
  aktiv: boolean;
  betragCents: number | null;
  satzBp: number | null;
  modus: "prozent" | "festbetrag" | null;
  paket: string | null;
  anlass: string | null;
  rechtsgrund: "dienstvertrag" | "anstellung" | "sonstiges" | null;
  buchen: boolean;
  auszahlungstag: number | null;
  gueltigAb: string;
  wirktAm: string | null;
  vermerk: string | null;
  erstelltAm: string;
  erstelltVon: string | null;
  geaendertAm: string | null;
}

/**
 * Die Anlässe für Pauschalen, die das System heute selbst erzeugt.
 *
 * Sie stehen hier, damit die Oberfläche sie zur Auswahl anbieten kann UND die
 * Buchungsstellen denselben Schlüssel benutzen. Ein Anlass, den nur die
 * Oberfläche kennt, erzeugt eine Pauschale, die niemand bucht.
 *
 * `vorgabeCents` ist der Wert, der bis zum 20.08.2026 HART IM CODE stand —
 * er bleibt der Rückfall, solange kein Baustein etwas anderes sagt.
 */
export const PAUSCHAL_ANLAESSE = [
  {
    schluessel: "startgespraech",
    text: "Startgespräch geführt & Konto freigeschaltet",
    vorgabeCents: 1500,
    hinweis: "Entsteht beim Abschluss eines Onboarding-Gesprächs mit Freischaltung.",
  },
  {
    schluessel: "rate_eingezogen",
    text: "Eingezogene Rate",
    vorgabeCents: 200,
    hinweis: "Nur bei bankbestätigter Buchung und vorher dokumentierter Bearbeitung — "
      + "Selbstzahler erzeugen keine.",
  },
] as const;

/** Die Pakete für eine Staffelung. Namen wie im Katalog. */
export const PAKET_STAFFEL = ["FIAON Starter", "FIAON Pro", "FIAON Ultra", "FIAON High End"] as const;

export const RECHTSGRUENDE = [
  { schluessel: "dienstvertrag", text: "Freier Dienstvertrag", buchen: true },
  {
    schluessel: "anstellung", text: "Anstellung", buchen: false,
    hinweis: "Bei einer Anstellung läuft das Fixum über die LOHNABRECHNUNG. Es wird "
      + "hier nur angezeigt und NICHT als Provisionsgutschrift gebucht — sonst "
      + "entstünde eine Gutschrift im Gutschriftverfahren für Arbeitslohn.",
  },
  { schluessel: "sonstiges", text: "Sonstiges", buchen: true },
] as const;

function zeile(r: any): Baustein {
  return {
    id: Number(r.id),
    agentId: Number(r.agent_id),
    typ: String(r.typ) as BausteinTyp,
    aktiv: r.aktiv === true,
    betragCents: r.betrag_cents == null ? null : Number(r.betrag_cents),
    satzBp: r.satz_bp == null ? null : Number(r.satz_bp),
    modus: r.modus ?? null,
    paket: r.paket ?? null,
    anlass: r.anlass ?? null,
    rechtsgrund: r.rechtsgrund ?? null,
    buchen: r.buchen !== false,
    auszahlungstag: r.auszahlungstag == null ? null : Number(r.auszahlungstag),
    gueltigAb: String(r.gueltig_ab).slice(0, 10),
    wirktAm: r.wirkt_am ? String(r.wirkt_am).slice(0, 10) : null,
    vermerk: r.vermerk ?? null,
    erstelltAm: r.erstellt_am,
    erstelltVon: r.erstellt_von ?? null,
    geaendertAm: r.geaendert_am ?? null,
  };
}

/**
 * Alle Bausteine eines Menschen — auch die abgeschalteten.
 *
 * Die Oberfläche braucht beide: aktive zum Rechnen, inaktive zum Anzeigen als
 * zusammengeklappte Karte. Entfernte (abgelöste) bleiben draußen; sie sind
 * Geschichte und stehen im Verlauf.
 */
export async function bausteine(agentId: number): Promise<Baustein[]> {
  const rows = (await sqlPool`
    SELECT * FROM fiaon_verguetung_bausteine
     WHERE agent_id = ${agentId} AND entfernt_am IS NULL
     ORDER BY typ, COALESCE(paket, ''), COALESCE(anlass, ''), gueltig_ab DESC
  `.catch(() => [] as any[])) as any[];
  return rows.map(zeile);
}

/**
 * Der Baustein, der an einem Stichtag GILT — je Typ (und ggf. Paket/Anlass).
 *
 * „Gilt" heißt: aktiv, `gueltig_ab` liegt nicht in der Zukunft, und von mehreren
 * passenden der JÜNGSTE. Damit wirkt eine Änderung ab ihrem Datum und nicht
 * rückwirkend.
 */
async function gueltiger(
  agentId: number, typ: BausteinTyp,
  wahl: { paket?: string | null; anlass?: string | null } = {},
  stichtag?: string,
): Promise<Baustein | null> {
  const tag = stichtag ?? await berlinToday();
  const rows = (await sqlPool`
    SELECT * FROM fiaon_verguetung_bausteine
     WHERE agent_id = ${agentId} AND typ = ${typ} AND aktiv AND entfernt_am IS NULL
       AND gueltig_ab <= ${tag}::date
       AND (${wahl.anlass ?? null}::text IS NULL OR anlass = ${wahl.anlass ?? null})
       -- Ein Baustein OHNE Paket gilt fuer alle; einer MIT Paket nur fuer dieses.
       -- Der genauere gewinnt, deshalb die Sortierung unten.
       AND (paket IS NULL OR paket = ${wahl.paket ?? null})
     ORDER BY (paket IS NOT NULL) DESC, gueltig_ab DESC, id DESC
     LIMIT 1
  `.catch(() => [] as any[])) as any[];
  return rows.length > 0 ? zeile(rows[0]) : null;
}

export interface Betrag {
  cents: number;
  /** Woher der Wert kommt — für die Anzeige und für die Fehlersuche. */
  herkunft: "baustein" | "person" | "vorgabe" | "keine";
  bausteinId: number | null;
  erklaerung: string;
}

/**
 * Was bekommt dieser Mensch für einen Abschluss?
 *
 * Umschaltbar: Prozent vom Abschlusswert (heutiger Standard) ODER Festbetrag je
 * Abschluss, optional gestaffelt nach Paket.
 *
 * ── DIE PROVISIONS-WAND BLEIBT UNBERÜHRT ────────────────────────────────
 * Ob überhaupt eine Provision entsteht (dokumentierter Kontakt), entscheidet
 * weiter die bestehende Prüfung an der Buchungsstelle. Diese Funktion
 * beantwortet nur die Höhe. Eine Zusammenlegung wäre bequem und würde die Wand
 * beim nächsten Umbau mitreißen.
 */
export async function provisionCents(
  agentId: number, umsatzCents: number,
  opt: { paket?: string | null; stichtag?: string; personSatzBp?: number | null } = {},
): Promise<Betrag> {
  const b = await gueltiger(agentId, "provision", { paket: opt.paket ?? null }, opt.stichtag);
  if (b) {
    if (b.modus === "festbetrag" && b.betragCents != null) {
      return {
        cents: b.betragCents, herkunft: "baustein", bausteinId: b.id,
        erklaerung: `Festbetrag ${(b.betragCents / 100).toFixed(2)} € je Abschluss`
          + (b.paket ? ` (${b.paket})` : ""),
      };
    }
    if (b.satzBp != null) {
      return {
        cents: Math.round((umsatzCents * b.satzBp) / 10_000),
        herkunft: "baustein", bausteinId: b.id,
        erklaerung: `${(b.satzBp / 100).toLocaleString("de-DE")} % vom Abschlusswert`
          + (b.paket ? ` (${b.paket})` : ""),
      };
    }
  }
  // Rückfall auf das alte Feld an der Person — ausdrücklich, nicht stillschweigend.
  const satz = Number(opt.personSatzBp ?? 0);
  if (satz > 0) {
    return {
      cents: Math.round((umsatzCents * satz) / 10_000),
      herkunft: "person", bausteinId: null,
      erklaerung: `${(satz / 100).toLocaleString("de-DE")} % (Satz am Mitarbeiter, kein Baustein)`,
    };
  }
  return { cents: 0, herkunft: "keine", bausteinId: null, erklaerung: "Kein Provisionssatz gesetzt" };
}

/**
 * Was bekommt dieser Mensch für eine Tätigkeit (Startgespräch, Rate)?
 *
 * Der Rückfall ist der Wert, der bis zum 20.08.2026 hart im Quelltext stand.
 * Damit ändert diese Datei keinen einzigen Betrag, solange niemand einen
 * Baustein anlegt — sie macht die Beträge nur einstellbar.
 */
export async function pauschaleCents(
  agentId: number, anlass: string, stichtag?: string,
): Promise<Betrag> {
  const b = await gueltiger(agentId, "pauschale", { anlass }, stichtag);
  if (b?.betragCents != null) {
    return {
      cents: b.betragCents, herkunft: "baustein", bausteinId: b.id,
      erklaerung: `${(b.betragCents / 100).toFixed(2)} € je ${b.anlass ?? anlass}`,
    };
  }
  const vorgabe = PAUSCHAL_ANLAESSE.find((a) => a.schluessel === anlass);
  if (vorgabe) {
    return {
      cents: vorgabe.vorgabeCents, herkunft: "vorgabe", bausteinId: null,
      erklaerung: `${(vorgabe.vorgabeCents / 100).toFixed(2)} € (Vorgabe im System, kein Baustein)`,
    };
  }
  return { cents: 0, herkunft: "keine", bausteinId: null, erklaerung: `Unbekannter Anlass: ${anlass}` };
}

/** Der Stundensatz — Baustein, sonst das Feld an der Person. */
export async function stundensatzCents(
  agentId: number, opt: { personCents?: number | null; stichtag?: string } = {},
): Promise<Betrag> {
  const b = await gueltiger(agentId, "stundensatz", {}, opt.stichtag);
  if (b?.betragCents != null) {
    return {
      cents: b.betragCents, herkunft: "baustein", bausteinId: b.id,
      erklaerung: `${(b.betragCents / 100).toFixed(2)} € je Stunde`,
    };
  }
  const p = Number(opt.personCents ?? 0);
  if (p > 0) {
    return {
      cents: p, herkunft: "person", bausteinId: null,
      erklaerung: `${(p / 100).toFixed(2)} € je Stunde (am Mitarbeiter, kein Baustein)`,
    };
  }
  return { cents: 0, herkunft: "keine", bausteinId: null, erklaerung: "Kein Stundensatz gesetzt" };
}

export interface MonatsVorschau {
  monat: string;
  fixumCents: number;
  fixumGebucht: boolean;
  fixumHinweis: string | null;
  provisionCents: number;
  provisionAnzahl: number;
  pauschalCents: number;
  pauschalAnzahl: number;
  stundenCents: number;
  stundenMinuten: number;
  einmaligCents: number;
  einmaligAnzahl: number;
  summeCents: number;
  /** Was NICHT in die Summe eingeht und warum — Anstellung, fehlende Sätze. */
  hinweise: string[];
}

/**
 * „So verdient dieser Mensch diesen Monat aktuell."
 *
 * ── WAS GEZÄHLT WIRD, UND WARUM GENAU SO ────────────────────────────────
 * Provisionen und Pauschalen kommen aus `fiaon_commissions` — den TATSÄCHLICH
 * gebuchten Zeilen dieses Monats. Nicht aus einer Neuberechnung: Die gebuchte
 * Zeile trägt ihren Betrag selbst, und genau das ist das Einfrier-Prinzip. Eine
 * Vorschau, die neu rechnet, würde bei einer Satzänderung eine andere Zahl
 * zeigen als die Abrechnung — und die Abrechnung hätte recht.
 *
 * Das Fixum ist der eine Posten, der NICHT aus gebuchten Zeilen kommt: Es
 * entsteht erst am Monatsende. Es wird deshalb als absehbar ausgewiesen — und
 * bei Rechtsgrund „Anstellung" ausdrücklich NICHT mitgezählt.
 */
export async function monatsVorschau(
  agentId: number, monat: string,
): Promise<MonatsVorschau> {
  const von = `${monat}-01`;
  const hinweise: string[] = [];

  // ── Gebuchte Provisionen und Pauschalen dieses Monats ────────────────────
  const [gebucht] = (await sqlPool`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE kind <> 'onboarding' AND COALESCE(rate_bp,0) > 0), 0)::int AS provision_cents,
      COUNT(*) FILTER (WHERE kind <> 'onboarding' AND COALESCE(rate_bp,0) > 0)::int AS provision_n,
      COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'onboarding' OR COALESCE(rate_bp,0) = 0), 0)::int AS pauschal_cents,
      COUNT(*) FILTER (WHERE kind = 'onboarding' OR COALESCE(rate_bp,0) = 0)::int AS pauschal_n
    FROM fiaon_commissions
   WHERE agent_id = ${agentId}
     AND status <> 'cancelled'
     AND created_at >= ${von}::date
     AND created_at < (${von}::date + INTERVAL '1 month')
  `.catch(() => [{ provision_cents: 0, provision_n: 0, pauschal_cents: 0, pauschal_n: 0 }] as any[])) as any[];

  // ── Bestätigte Stunden dieses Monats ────────────────────────────────────
  // Die Tabelle heißt `fiaon_stunden` und trägt KEINEN Betrag — nur Minuten.
  // Der Betrag entsteht aus Minuten × Stundensatz, und deshalb wird er hier
  // gerechnet und nicht gelesen. (Ein erster Entwurf fragte nach
  // `fiaon_inkasso_stunden.betrag_cents`; beides gibt es nicht. Gemessen an
  // information_schema statt geraten.)
  const [std] = (await sqlPool`
    SELECT COALESCE(SUM(minuten), 0)::int AS minuten
      FROM fiaon_stunden
     WHERE agent_id = ${agentId} AND bestaetigt_am IS NOT NULL AND entfernt_am IS NULL
       AND tag >= ${von}::date AND tag < (${von}::date + INTERVAL '1 month')
  `.catch(() => [{ minuten: 0 }] as any[])) as any[];
  const [person] = (await sqlPool`
    SELECT stundensatz_cents FROM fiaon_agents WHERE id = ${agentId}
  `.catch(() => [{}] as any[])) as any[];
  const satz = await stundensatzCents(agentId, {
    personCents: person?.stundensatz_cents ?? null, stichtag: `${monat}-28`,
  });
  const stundenMinuten = Number(std?.minuten ?? 0);
  if (stundenMinuten > 0 && satz.cents === 0) {
    hinweise.push(`${Math.floor(stundenMinuten / 60)} bestätigte Stunden ohne Stundensatz — `
      + "sie ergeben 0 €. Ein Satz gehört gesetzt, bevor abgerechnet wird.");
  }

  // ── Fixum ───────────────────────────────────────────────────────────────
  const fix = await gueltiger(agentId, "fixum", {}, `${monat}-28`);
  let fixumCents = 0;
  let fixumGebucht = false;
  let fixumHinweis: string | null = null;
  if (fix?.betragCents != null) {
    fixumCents = fix.betragCents;
    fixumGebucht = fix.buchen;
    if (!fix.buchen) {
      fixumHinweis = "Rechtsgrund Anstellung — läuft über die Lohnabrechnung und wird "
        + "hier NICHT als Provisionsgutschrift gebucht.";
      hinweise.push(`Fixum ${(fixumCents / 100).toFixed(2)} € ist NICHT in der Summe: ${fixumHinweis}`);
    }
  }

  // ── Einmalige Gutschriften und Abzüge, die auf diesen Monat wirken ──────
  const einmalig = (await sqlPool`
    SELECT betrag_cents, vermerk FROM fiaon_verguetung_bausteine
     WHERE agent_id = ${agentId} AND typ = 'einmalig' AND aktiv AND entfernt_am IS NULL
       AND COALESCE(wirkt_am, gueltig_ab) >= ${von}::date
       AND COALESCE(wirkt_am, gueltig_ab) < (${von}::date + INTERVAL '1 month')
  `.catch(() => [] as any[])) as any[];
  const einmaligCents = einmalig.reduce((s, e) => s + Number(e.betrag_cents || 0), 0);

  const provisionCentsSumme = Number(gebucht?.provision_cents ?? 0);
  const pauschalCentsSumme = Number(gebucht?.pauschal_cents ?? 0);
  const stundenCents = Math.round((stundenMinuten / 60) * satz.cents);

  return {
    monat,
    fixumCents,
    fixumGebucht,
    fixumHinweis,
    provisionCents: provisionCentsSumme,
    provisionAnzahl: Number(gebucht?.provision_n ?? 0),
    pauschalCents: pauschalCentsSumme,
    pauschalAnzahl: Number(gebucht?.pauschal_n ?? 0),
    stundenCents,
    stundenMinuten,
    einmaligCents,
    einmaligAnzahl: einmalig.length,
    summeCents: (fixumGebucht ? fixumCents : 0) + provisionCentsSumme + pauschalCentsSumme
      + stundenCents + einmaligCents,
    hinweise,
  };
}
