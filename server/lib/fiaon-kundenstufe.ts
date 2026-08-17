// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTOSTUFE — ABGELEITET, NICHT GELESEN
//
// ── DER AUFTRAG DES BETREIBERS (20.08.2026) ────────────────────────────────
// „Die Kontostufe wird aus EINER Funktion abgeleitet. Alle Anzeigen lesen sie.
// Der Fehler ‚Status: Aktiv · Freigeschaltet' bei einem Kunden OHNE erledigtes
// Startgespräch darf nie wieder entstehen."
//
// ── WARUM DIE ALTE FASSUNG DAS NICHT KONNTE ────────────────────────────────
// `fiaon-kontostufe.ts` liest die SPALTE `onboarding_stufe`:
//
//     const stufe = a.onboarding_stufe === "wartet_auf_onboarding"
//       ? "wartet_auf_onboarding" : "voll_aktiv";
//
// Eine Spalte ist ein Merker, keine Wahrheit. Steht dort etwas Falsches — weil
// eine Migration sie nie gefüllt hat, weil ein Lauf sie übersprungen hat, weil
// jemand sie von Hand gesetzt hat —, dann zeigt das Portal etwas Falsches.
//
// GEMESSEN am 20.08.2026: **364 von 365** bezahlten Bestellungen standen auf
// „voll_aktiv", und **NULL** davon hatte ein erledigtes Startgespräch. Der
// Screenshot war kein Einzelfall, sondern der Normalzustand.
//
// ── DIE ABLEITUNG ──────────────────────────────────────────────────────────
//   kein_zugang            Nicht bezahlt. Das Portal ist zu.
//   wartet_auf_onboarding  Paket bezahlt, Startgespräch NICHT erledigt.
//   voll_aktiv             Startgespräch erledigt — oder Ausnahme gesetzt.
//
// Drei Zustände, eine Rechnung, kein Zwischenraum. Wer die Stufe wissen will,
// ruft diese Funktion; wer sie speichern will, speichert das Ergebnis dieser
// Funktion.
//
// ── WOZU DIE SPALTE DANN NOCH DIENT ────────────────────────────────────────
// Als Beschleuniger für Listen: 360 Kunden je einzeln ableiten wären 360
// Abfragen. Deshalb bleibt sie — aber sie ist ab jetzt eine ABSCHRIFT, und
// `stufeAbgleichen()` zieht sie nach. Weicht sie ab, gilt die Ableitung, und
// die Abweichung wird gemeldet.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export type Kundenstufe = "kein_zugang" | "wartet_auf_onboarding" | "voll_aktiv";

/** Die Stationen des Ablaufs — für die Ablauf-Leiste in Akte und Portal. */
export interface AblaufStand {
  antrag: boolean;
  zahlung: boolean;
  startgespraech: boolean;
  auskunft: boolean;
  vollAktiv: boolean;
  aboLaeuft: boolean;
}

export interface Stufenlage {
  ref: string;
  personId: number | null;
  stufe: Kundenstufe;
  /** Der Grund IN WORTEN — er steht in Akte und Portal, nicht nur im Log. */
  grund: string;
  /** Was der Kunde als Nächstes tun muss (oder wir für ihn). */
  naechsterSchritt: string;
  /** Ist die Onboarding-Pflicht für diesen Kunden ausgesetzt? Mit Grund. */
  ausnahme: { gesetzt: boolean; grund: string | null; von: string | null; am: string | null };
  bezahlt: boolean;
  termin: { id: number; beginn: string; status: string } | null;
  gespraechErledigt: boolean;
  auskunftBezahlt: boolean;
  /** Ist das eine reine Auskunft-Bestellung (74 €, kein Paket)? */
  nurAuskunft: boolean;
  ablauf: AblaufStand;
  /** Was in der Spalte steht — nur zum Abgleich, NIE als Wahrheit. */
  spalte: string | null;
  spalteWeichtAb: boolean;
}

/**
 * Die eine Ableitung.
 *
 * Eine Abfrage, alle Angaben. Nicht fünf Abfragen hintereinander: Die Akte
 * ruft sie für einen Kunden, die Liste für vierzig — bei fünf Abfragen je
 * Kunde wären das zweihundert.
 */
export async function stufeAbleiten(ref: string, lauf: Lauf = sqlPool): Promise<Stufenlage | null> {
  const [a] = (await lauf`
    SELECT a.ref, a.person_id, a.payment_status, a.status, a.type,
           a.onboarding_stufe, a.onboarding_pflicht,
           a.onboarding_ausnahme_grund, a.onboarding_ausnahme_von, a.onboarding_ausnahme_am,
           -- Ist das eine reine Auskunft-Bestellung? Sie hat kein Paket und
           -- braucht deshalb kein Startgespräch (siehe Messung: 3 Fälle).
           (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%') AS ist_auskunft,
           -- Das erledigte Startgespräch — die WAHRHEIT über die Stufe.
           (SELECT t.id FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status = 'erledigt' LIMIT 1) AS erledigt_id,
           -- Der anstehende Termin, falls einer gebucht ist.
           (SELECT t.id FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status = 'gebucht' AND t.beginn > NOW()
             ORDER BY t.beginn ASC LIMIT 1) AS gebucht_id,
           -- Hat dieser Mensch seine Bonitätsauskunft bezahlt?
           EXISTS (
             SELECT 1 FROM fiaon_applications s
             WHERE (s.type = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
               AND s.merged_into IS NULL AND s.payment_status = 'paid'
               AND (s.person_id = a.person_id
                 OR (NULLIF(TRIM(COALESCE(a.email, '')), '') IS NOT NULL
                     AND LOWER(TRIM(COALESCE(s.email, ''))) = LOWER(TRIM(a.email))))
           ) AS auskunft_bezahlt,
           -- Läuft ein Abo? Für die Ablauf-Leiste.
           EXISTS (
             SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref
           ) AS abo_laeuft
    FROM fiaon_applications a
    WHERE a.ref = ${ref} AND a.merged_into IS NULL
  `.catch(async () => {
    // ── DIE SPALTEN FÜR DIE AUSNAHME GIBT ES VIELLEICHT NOCH NICHT ────────
    // Dann läuft die Abfrage ohne sie. Eine fehlende Migration darf die Stufe
    // nicht unbestimmt machen — sie ist die Grundlage jeder Anzeige.
    return (await lauf`
      SELECT a.ref, a.person_id, a.payment_status, a.status, a.type,
             a.onboarding_stufe, a.onboarding_pflicht,
             NULL::text AS onboarding_ausnahme_grund,
             NULL::text AS onboarding_ausnahme_von,
             NULL::timestamptz AS onboarding_ausnahme_am,
             (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%') AS ist_auskunft,
             (SELECT t.id FROM fiaon_termine t
               WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
                 AND t.status = 'erledigt' LIMIT 1) AS erledigt_id,
             (SELECT t.id FROM fiaon_termine t
               WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
                 AND t.status = 'gebucht' AND t.beginn > NOW()
               ORDER BY t.beginn ASC LIMIT 1) AS gebucht_id,
             FALSE AS auskunft_bezahlt, FALSE AS abo_laeuft
      FROM fiaon_applications a
      WHERE a.ref = ${ref} AND a.merged_into IS NULL
    `) as any[];
  })) as any[];
  if (!a) return null;

  const [termin] = (a.erledigt_id || a.gebucht_id)
    ? ((await lauf`
        SELECT id, beginn, status FROM fiaon_termine
        WHERE id = ${a.erledigt_id ?? a.gebucht_id}
      `) as any[])
    : [null];

  const bezahlt = String(a.payment_status) === "paid";
  const erledigt = a.erledigt_id != null;
  const nurAuskunft = a.ist_auskunft === true;
  const ausnahmeGesetzt = a.onboarding_pflicht === false
    && String(a.onboarding_ausnahme_grund ?? "").trim() !== "";

  // ══════════════════════════════════════════════════════════════════════
  // DIE ABLEITUNG. Reihenfolge ist Absicht: Die härteste Bedingung zuerst.
  // ══════════════════════════════════════════════════════════════════════
  let stufe: Kundenstufe;
  let grund: string;
  let naechsterSchritt: string;

  if (!bezahlt) {
    stufe = "kein_zugang";
    grund = "Die Zahlung ist noch nicht gebucht.";
    naechsterSchritt = String(a.payment_status) === "claimed_paid"
      ? "Kunde hat „überwiesen“ gemeldet — Zahlungseingang prüfen und buchen."
      : "Zahlungseingang abwarten oder die Zahlungsdaten erneut senden.";
  } else if (nurAuskunft) {
    // ── EINE AUSKUNFT IST KEIN KONTO ────────────────────────────────────
    // Wer nur die Bonitätsauskunft gekauft hat, braucht kein Startgespräch:
    // Es gibt kein Paket, in das er eingeführt werden müsste. Ihn ins Gate zu
    // schicken wäre eine Aufforderung zu einem Termin über nichts.
    stufe = "voll_aktiv";
    grund = "Bonitätsauskunft ohne Paket — für dieses Produkt gibt es kein Startgespräch.";
    naechsterSchritt = "Auskunft abrufen und dem Kunden bereitstellen.";
  } else if (erledigt) {
    stufe = "voll_aktiv";
    grund = "Das Startgespräch ist geführt — das Konto ist voll freigeschaltet.";
    naechsterSchritt = "Nichts. Der Kunde arbeitet mit seinem Fahrplan.";
  } else if (ausnahmeGesetzt) {
    // ── DIE AUSNAHME ────────────────────────────────────────────────────
    // Für Härtefälle: ein Kunde, der kein Gespräch führen kann oder will, und
    // bei dem der Betreiber das ausdrücklich entschieden hat. Mit Grund und
    // Namen — sonst wäre es eine Hintertür.
    stufe = "voll_aktiv";
    grund = `Onboarding-Pflicht ausgesetzt: ${String(a.onboarding_ausnahme_grund).trim()}`;
    naechsterSchritt = "Nichts. Die Ausnahme wurde ausdrücklich entschieden.";
  } else {
    stufe = "wartet_auf_onboarding";
    grund = "Bezahlt, aber das Startgespräch ist noch nicht geführt.";
    naechsterSchritt = a.gebucht_id
      ? `Termin steht — das Gespräch führen und im Cockpit abschließen.`
      : "Startgespräch einladen: Der Kunde sieht das Gate beim nächsten Login.";
  }

  const spalte = a.onboarding_stufe != null ? String(a.onboarding_stufe) : null;
  // Die Spalte kennt „kein_zugang" nicht — dort steht bei Unbezahlten nichts.
  const spalteSoll = stufe === "kein_zugang" ? null : stufe;

  return {
    ref: String(a.ref),
    personId: a.person_id != null ? Number(a.person_id) : null,
    stufe, grund, naechsterSchritt,
    ausnahme: {
      gesetzt: ausnahmeGesetzt,
      grund: a.onboarding_ausnahme_grund ?? null,
      von: a.onboarding_ausnahme_von ?? null,
      am: a.onboarding_ausnahme_am ? new Date(a.onboarding_ausnahme_am).toISOString() : null,
    },
    bezahlt,
    termin: termin ? { id: Number(termin.id), beginn: termin.beginn, status: String(termin.status) } : null,
    gespraechErledigt: erledigt,
    auskunftBezahlt: a.auskunft_bezahlt === true,
    nurAuskunft,
    ablauf: {
      antrag: true,
      zahlung: bezahlt,
      startgespraech: erledigt,
      auskunft: a.auskunft_bezahlt === true,
      vollAktiv: stufe === "voll_aktiv",
      aboLaeuft: a.abo_laeuft === true,
    },
    spalte,
    spalteWeichtAb: spalte !== spalteSoll,
  };
}

/**
 * Die Stufe für VIELE Bestellungen — eine Abfrage, nicht vierzig.
 *
 * Für Listen und Kacheln. Liefert nur Stufe und Grund; wer mehr braucht, holt
 * `stufeAbleiten()` für die eine Zeile, die er anzeigt.
 *
 * ── WARUM DIESELBE REGEL ZWEIMAL DASTEHT ─────────────────────────────────
 * Sie steht NICHT zweimal: Die Bedingungen unten sind die SQL-Fassung derselben
 * Reihenfolge, und der Prüfstand vergleicht beide an jeder Konstellation. Ohne
 * die Sammelfassung müsste eine Liste mit 40 Kunden 40 Abfragen stellen — und
 * die Liste wäre dann so langsam, dass jemand einen Umweg baut. Ein Umweg ist
 * gefährlicher als eine geprüfte Wiederholung.
 */
export async function stufenFuerListe(
  refs: string[], lauf: Lauf = sqlPool,
): Promise<Map<string, { stufe: Kundenstufe; grund: string }>> {
  if (refs.length === 0) return new Map();
  const zeilen = (await lauf`
    SELECT a.ref,
           CASE
             WHEN a.payment_status <> 'paid' THEN 'kein_zugang'
             WHEN (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%') THEN 'voll_aktiv'
             WHEN EXISTS (SELECT 1 FROM fiaon_termine t
                           WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
                             AND t.status = 'erledigt') THEN 'voll_aktiv'
             WHEN a.onboarding_pflicht = FALSE
               AND NULLIF(TRIM(COALESCE(a.onboarding_ausnahme_grund, '')), '') IS NOT NULL
               THEN 'voll_aktiv'
             ELSE 'wartet_auf_onboarding'
           END AS stufe
    FROM fiaon_applications a
    WHERE a.ref = ANY(${refs}) AND a.merged_into IS NULL
  `) as any[];
  const raus = new Map<string, { stufe: Kundenstufe; grund: string }>();
  for (const z of zeilen) {
    const stufe = String(z.stufe) as Kundenstufe;
    raus.set(String(z.ref), {
      stufe,
      grund: stufe === "kein_zugang" ? "Zahlung nicht gebucht."
        : stufe === "wartet_auf_onboarding" ? "Startgespräch fehlt."
        : "Voll freigeschaltet.",
    });
  }
  return raus;
}

/** Die Marke für Oberflächen — an EINER Stelle benannt und gefärbt. */
export function stufeMarke(stufe: Kundenstufe): { text: string; farbe: string; hell: string } {
  switch (stufe) {
    case "kein_zugang":
      return { text: "Kein Zugang", farbe: "#64748b", hell: "rgba(100,116,139,.1)" };
    case "wartet_auf_onboarding":
      return { text: "Wartet auf Startgespräch", farbe: "#b45309", hell: "rgba(180,83,9,.1)" };
    case "voll_aktiv":
      return { text: "Voll aktiv", farbe: "#047857", hell: "rgba(4,120,87,.1)" };
  }
}

/**
 * Die Spalte an die Ableitung anpassen.
 *
 * Wird nach jedem Ereignis gerufen, das die Stufe ändern kann: Zahlung
 * gebucht, Gespräch abgeschlossen, Ausnahme gesetzt. Idempotent — zweimal
 * gerufen ändert nichts.
 *
 * Gibt zurück, OB sich etwas geändert hat: Eine Abweichung, die stillschweigend
 * korrigiert wird, ist eine verpasste Gelegenheit, ihre Ursache zu finden.
 */
export async function stufeAbgleichen(
  ref: string, lauf: Lauf = sqlPool,
): Promise<{ geaendert: boolean; von: string | null; nach: Kundenstufe | null }> {
  const lage = await stufeAbleiten(ref, lauf);
  if (!lage) return { geaendert: false, von: null, nach: null };
  if (!lage.spalteWeichtAb) return { geaendert: false, von: lage.spalte, nach: lage.stufe };

  const soll = lage.stufe === "kein_zugang" ? null : lage.stufe;
  await lauf`
    UPDATE fiaon_applications
    SET onboarding_stufe = ${soll}, updated_at = NOW()
    WHERE ref = ${ref}
  `;
  console.log(`[STUFE] ${ref}: „${lage.spalte ?? "leer"}“ → „${soll ?? "leer"}“ (${lage.grund})`);
  return { geaendert: true, von: lage.spalte, nach: lage.stufe };
}
