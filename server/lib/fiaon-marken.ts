// ═══════════════════════════════════════════════════════════════════════════
// DIE ZÄHLER-MARKEN — eine Zahl, eine Quelle, ein Ziel
//
// ── DER BEFUND (17.08.2026) ────────────────────────────────────────────────
// Betreiber: „Das Menü zeigt +4, dahinter ist nichts zu tun, der Zähler bleibt
// stehen."
//
// GEMESSEN wurden zwei Sorten Abweichung, und beide sind schädlich:
//
//   Aufgaben     Marke 0, Zielseite 8 offene Aufgaben. Die Marke zählte nur
//                „heute fällig + überfällig". Acht Aufgaben warteten, und der
//                Betreiber sah keinen Hinweis. Eine Marke, die schweigt, wenn
//                es Arbeit gibt, ist schlimmer als eine, die zu viel zeigt.
//   Zustellung   Marke 0 (nur heute), Protokoll 70 (14 Tage). Wer die Marke
//                sieht, denkt „alles gut" — und im Protokoll stehen 70
//                gescheiterte Mails.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Eine Marke zählt EXAKT das, was die Zielseite als offen zeigt. Nicht
// ähnlich, nicht „die dringenden davon" — dasselbe. Sonst muss ein Mensch
// zwei Zahlen im Kopf verrechnen, und das tut niemand.
//
// Deshalb steht jede Zählung hier EINMAL, und beide Seiten rufen sie:
// die Marke im Menü und die Zielseite selbst.
//
// ── UND DIE ANGST VOR DER DAUERHAFT HOHEN MARKE? ──────────────────────────
// Im alten Kommentar stand, eine permanent hohe Marke werde ignoriert. Das
// stimmt — aber die Antwort darauf ist nicht, sie kleiner zu rechnen. Wenn 70
// Mails in zwei Wochen scheitern, ist die Marke nicht zu hoch, sondern die
// Zahl. Wer sie kleinrechnet, versteckt Arbeit statt sie zu erledigen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Das Berliner Heute — nie CURRENT_DATE (das ist UTC). */
const HEUTE = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";

/** Wie weit zurück das Zustellprotokoll blickt. EINE Zahl für Marke und Seite. */
export const ZUSTELLUNG_TAGE = 14;

export interface MarkenStand {
  /** Der Wert der Marke. */
  wert: number;
  /** Die Zielseite, die dieselbe Zahl zeigen MUSS. */
  ziel: string;
  /** Klartext für den Titel der Marke. */
  text: string;
}

/**
 * Offene Betreiber-Aufgaben — die Zahl, die /admin/aufgaben unter „Meine"
 * anzeigt.
 *
 * Vorher zählte die Marke nur „heute + überfällig". Eine Aufgabe für nächste
 * Woche ist genauso offen; sie verschwindet nicht, nur weil sie Zeit hat.
 */
export async function markeAufgaben(lauf: Lauf = sqlPool): Promise<MarkenStand> {
  const [z] = (await lauf.unsafe(`
    SELECT COUNT(*)::int AS offen,
           COUNT(*) FILTER (WHERE faellig_am < ${HEUTE})::int AS ueberfaellig
    FROM fiaon_vermerke
    WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber
      AND entfernt_am IS NULL
  `)) as any[];
  const offen = Number(z.offen);
  const ueber = Number(z.ueberfaellig);
  return {
    wert: offen,
    ziel: "/admin/aufgaben",
    text: offen === 0
      ? "Keine offene Aufgabe."
      : `${offen} offene ${offen === 1 ? "Aufgabe" : "Aufgaben"}`
        + (ueber > 0 ? `, ${ueber} davon überfällig` : ""),
  };
}

/**
 * Gescheiterte Zustellungen — die Zahl, die das Zustellprotokoll zeigt.
 *
 * Vorher zählte die Marke nur „heute". Am 17.08.2026 stand sie auf 0, während
 * im Protokoll 70 Fehlschläge aus 14 Tagen lagen — 68 davon verbrauchte
 * Termin-Erinnerungen, die niemand bemerkt hatte.
 */
export async function markeZustellung(lauf: Lauf = sqlPool): Promise<MarkenStand> {
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE status = 'fehlgeschlagen')::int AS fehl,
           COUNT(*) FILTER (WHERE status = 'uebersprungen')::int AS uebersprungen
    FROM fiaon_mail_log
    WHERE created_at > NOW() - (${ZUSTELLUNG_TAGE} || ' days')::interval
  `) as any[];
  const fehl = Number(z.fehl);
  return {
    wert: fehl,
    ziel: "/admin/events?status=fehlgeschlagen#zustellung",
    text: fehl === 0
      ? `Keine fehlgeschlagene Mail in ${ZUSTELLUNG_TAGE} Tagen.`
      : `${fehl} fehlgeschlagen in ${ZUSTELLUNG_TAGE} Tagen`
        + (Number(z.uebersprungen) > 0 ? `, ${z.uebersprungen} übersprungen` : ""),
  };
}

/** Zahlungen, die auf Bestätigung warten — dieselbe Bedingung wie die Seite. */
export async function markeZahlungen(lauf: Lauf = sqlPool): Promise<MarkenStand> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
  `) as any[];
  return {
    wert: Number(z.n),
    ziel: "/admin/zahlungen",
    text: `${z.n} als bezahlt gemeldet, noch nicht bestätigt`,
  };
}

/** Auszahlungs-Anforderungen. */
export async function markeAuszahlungen(lauf: Lauf = sqlPool): Promise<MarkenStand> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_payouts WHERE status = 'angefordert'
  `) as any[];
  return {
    wert: Number(z.n), ziel: "/admin/auszahlungen",
    text: `${z.n} Auszahlung(en) warten auf Freigabe`,
  };
}

/** Nachbuchbare Provisionen — zeigt jetzt auf den Reiter, den es gibt. */
export async function markeNachbuchung(_lauf: Lauf = sqlPool): Promise<MarkenStand> {
  // ══════════════════════════════════════════════════════════════════════
  // KEINE ZWEITE ZÄHLUNG — DIE FUNKTION DER ZIELSEITE
  //
  // Hier stand eine eigene SELECT-Abfrage. GEMESSEN am 17.08.2026 standen
  // damit DREI Zahlen für dieselbe Sache im Haus:
  //
  //   14   die alte Menü-Marke (eigene Abfrage in fiaon-admin-hub.ts)
  //  160   meine erste Fassung hier (wieder eine eigene Abfrage)
  //   21   `backfillCandidates()` — die Funktion, die der Reiter benutzt
  //
  // Die 21 ist die Wahrheit, denn sie ist die Liste, die der Betreiber sieht.
  // Eine Marke muss die ZIELSEITE zählen, nicht deren Bedingungen nachbauen:
  // Beim Nachbauen vergisst man einen Filter, und niemand merkt es.
  // ══════════════════════════════════════════════════════════════════════
  const { backfillCandidates } = await import("../routes/fiaon-team");
  const faelle = await backfillCandidates();
  const eindeutig = faelle.filter((f: any) => f.status === "nachbuchbar").length;
  return {
    // ALLE Fälle, nicht nur die eindeutigen: Ein unklarer Betrag ist auch
    // Arbeit — er braucht eine Entscheidung.
    wert: faelle.length,
    // Bis zum 17.08.2026 zeigte das auf „/admin/nachbuchung" — eine Seite, die
    // seit dem 10.08. nur noch umleitet, und zwar auf einen Reiter, den es
    // nicht gab. Der Betreiber landete auf der Mitarbeiterliste.
    ziel: "/admin/team?tab=nachbuchung",
    text: faelle.length === 0
      ? "Jede bezahlte Bestellung hat ihre Provision."
      : `${faelle.length} bezahlte Bestellung(en) ohne Provision`
        + `, ${eindeutig} davon mit einem Klick buchbar`,
  };
}

/**
 * Die ganze Inventur — für die Admin-Ansicht UND den Prüfstand.
 *
 * Der Prüfstand vergleicht `wert` mit der Zahl, die die Zielseite liefert.
 * Weicht eine ab, ist es ein Fehler und kein Geschmack.
 */
export async function alleMarken(lauf: Lauf = sqlPool): Promise<Record<string, MarkenStand>> {
  const [aufgaben, zustellung, zahlungen, auszahlungen, nachbuchung] = await Promise.all([
    markeAufgaben(lauf), markeZustellung(lauf), markeZahlungen(lauf),
    markeAuszahlungen(lauf), markeNachbuchung(lauf),
  ]);
  return { aufgaben, zustellung, zahlungen, auszahlungen, nachbuchung };
}
