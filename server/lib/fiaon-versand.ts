// ═══════════════════════════════════════════════════════════════════════════
// VERSANDZENTRUM — Selbsthilfe statt Rückfrage
//
// DER ALLTAG, DEN DAS ABSTELLT
// „Der Kunde sagt, er hat die Zahlungsdaten nie bekommen." Bisher hieß das:
// Nachricht an den Vorgesetzten, der sucht im Make-Protokoll, schickt von Hand
// nach. Dreimal am Tag. Dabei ist die Frage in zwei Klicks beantwortet — wenn
// jemand sehen kann, WAS rausging und WANN, und es erneut auslösen darf.
//
// DREI SCHUTZWÄNDE, alle serverseitig:
//   1. ZUSTAND. Eine Zahlungsaufforderung an jemanden, der bezahlt hat, ist
//      peinlich und teuer. Ein Terminlink an einen Gesperrten widerspricht
//      seinem ausdrücklichen „nein". Was der Kundenzustand nicht hergibt, wird
//      gar nicht erst angeboten.
//   2. TAGESLIMIT. Höchstens drei manuelle Sendungen je Kunde, Ereignis und
//      Tag. Ein Knopf, den man in Ruhe zwanzigmal drücken kann, wird zwanzigmal
//      gedrückt — und der Kunde hält uns danach für einen Spam-Versender.
//   3. RECHTE. Teammitglied nur für eigene Kunden; die Leitung für alle;
//      das Onboarding nur für Terminlink und Zugang.
//
// Jeder Versand — automatisch wie manuell — geht durch
// `versendenUndProtokollieren` und landet damit im Mail-Protokoll UND im
// Kundenverlauf. Ein Versender, der am Protokoll vorbeischreibt, ist ein
// Versender, den später niemand erklären kann.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Höchstens so viele manuelle Sendungen je Kunde, Ereignis und Tag. */
export const TAGESLIMIT = 3;

export type VersandArt =
  | "payment_details"          // Zahlungsdaten mit Verwendungszweck
  | "welcome"                  // Willkommen / Zugang
  | "nicht_erreicht_termin"    // Terminlink (Vertriebsgespräch)
  | "onboarding_einladung"     // Einladung zum Startgespräch
  | "number_update_request";   // Bitte um Korrektur der Rufnummer

export interface VersandKnopf {
  art: VersandArt;
  titel: string;
  /** Warum man das schickt — ein Satz für den Knopf-Hinweis. */
  zweck: string;
  erlaubt: boolean;
  /** Falls nicht erlaubt: warum nicht, im Klartext. */
  grund: string | null;
  /** Wie viele Sendungen heute schon rausgingen. */
  heute: number;
}

export const VERSAND_TEXT: Record<VersandArt, { titel: string; zweck: string }> = {
  payment_details: {
    titel: "Zahlungsdaten",
    zweck: "Bankverbindung, Betrag und Verwendungszweck — wenn der Kunde sie nicht findet.",
  },
  welcome: {
    titel: "Willkommen und Zugang",
    zweck: "Begrüßung mit dem Weg ins Konto — wenn der Kunde nicht hineinkommt.",
  },
  nicht_erreicht_termin: {
    titel: "Terminlink",
    zweck: "Der Kunde wählt selbst eine Uhrzeit für ein Gespräch.",
  },
  onboarding_einladung: {
    titel: "Einladung zum Startgespräch",
    zweck: "Die 15 Minuten, in denen ihm jemand das System erklärt.",
  },
  number_update_request: {
    titel: "Bitte um neue Rufnummer",
    zweck: "Wenn die hinterlegte Nummer nicht stimmt.",
  },
};

/** Was diese Rolle überhaupt senden darf. */
export function artenFuerRolle(rolle: string): VersandArt[] {
  if (rolle === "onboarding") return ["onboarding_einladung", "welcome"];
  return ["payment_details", "welcome", "nicht_erreicht_termin", "onboarding_einladung", "number_update_request"];
}

interface Zustand {
  bezahlt: boolean;
  gesperrt: boolean;
  offeneZahlung: boolean;
  hatEmail: boolean;
  hatTermin: boolean;
  gdpr: boolean;
  archiviert: boolean;
}

async function zustandVon(personId: number, lauf: Lauf = sqlPool): Promise<Zustand | null> {
  const [z] = (await lauf`
    SELECT
      p.is_blocked,
      COALESCE(NULLIF(p.primary_email, ''), (
        SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
        FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
        ORDER BY a.created_at DESC LIMIT 1)) AS email,
      EXISTS (SELECT 1 FROM fiaon_applications a1 WHERE a1.person_id = p.id
                AND a1.merged_into IS NULL AND a1.payment_status = 'paid') AS bezahlt,
      EXISTS (SELECT 1 FROM fiaon_applications a2 WHERE a2.person_id = p.id
                AND a2.merged_into IS NULL AND a2.archived_at IS NULL
                AND a2.payment_status IN ('pending_payment', 'claimed_paid', 'expired')) AS offen,
      EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id
                AND a3.merged_into IS NULL AND a3.gdpr_deleted_at IS NOT NULL) AS gdpr,
      NOT EXISTS (SELECT 1 FROM fiaon_applications a4 WHERE a4.person_id = p.id
                AND a4.merged_into IS NULL AND a4.archived_at IS NULL) AS alles_archiviert,
      EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id
                AND t.status = 'gebucht' AND t.beginn > NOW()) AS hat_termin
    FROM fiaon_persons p WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!z) return null;
  return {
    bezahlt: !!z.bezahlt,
    gesperrt: !!z.is_blocked,
    offeneZahlung: !!z.offen,
    hatEmail: !!z.email,
    hatTermin: !!z.hat_termin,
    gdpr: !!z.gdpr,
    archiviert: !!z.alles_archiviert,
  };
}

/** Wie viele manuelle Sendungen dieser Art gingen heute schon raus? */
export async function heuteGesendet(personId: number, art: VersandArt, lauf: Lauf = sqlPool): Promise<number> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_mail_log
    WHERE person_id = ${personId} AND event = ${art}
      AND ausgeloest_agent_id IS NOT NULL
      AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  `) as any[];
  return Number(z?.n || 0);
}

/**
 * Darf diese Art an diesen Kunden gehen? Prüft Zustand UND Tageslimit.
 *
 * Der Grund kommt im Klartext zurück und wird dem Mitarbeiter angezeigt. Ein
 * ausgegrauter Knopf ohne Begründung erzeugt genau die Rückfrage, die dieses
 * Paket abschaffen soll.
 */
export async function versandErlaubt(
  personId: number, art: VersandArt, lauf: Lauf = sqlPool,
): Promise<{ erlaubt: boolean; grund: string | null; heute: number }> {
  const z = await zustandVon(personId, lauf);
  if (!z) return { erlaubt: false, grund: "Kunde nicht gefunden.", heute: 0 };
  return bewerten(z, art, await heuteGesendet(personId, art, lauf));
}

/**
 * Die Entscheidungsregeln — die EINZIGE Fassung.
 *
 * Ausgelagert, damit die Sammelprüfung sie mitbenutzen kann, ohne dass sie
 * zweimal im Haus steht. Zwei Fassungen derselben Regel wären schlimmer als
 * eine langsame Abfrage.
 */
function bewerten(
  z: NonNullable<Awaited<ReturnType<typeof zustandVon>>>, art: VersandArt, heute: number,
): { erlaubt: boolean; grund: string | null; heute: number } {
  if (z.gdpr) return { erlaubt: false, grund: "Für diesen Kunden liegt eine Löschung nach DSGVO vor.", heute };
  if (!z.hatEmail) return { erlaubt: false, grund: "Keine E-Mail-Adresse hinterlegt.", heute };
  if (z.gesperrt && art !== "welcome") {
    return { erlaubt: false, grund: "Der Kunde hat abgelehnt oder eine Kontaktsperre — kein Versand.", heute };
  }

  if (art === "payment_details") {
    if (z.bezahlt && !z.offeneZahlung) {
      return { erlaubt: false, grund: "Der Kunde hat bezahlt. Eine Zahlungsaufforderung wäre falsch.", heute };
    }
    if (!z.offeneZahlung) return { erlaubt: false, grund: "Keine offene Zahlung.", heute };
  }
  if (art === "welcome" && !z.bezahlt) {
    return { erlaubt: false, grund: "Der Zugang wird erst nach der Zahlung freigeschaltet.", heute };
  }
  if (art === "onboarding_einladung") {
    if (!z.bezahlt) return { erlaubt: false, grund: "Startgespräche bekommen nur bezahlte Kunden.", heute };
    if (z.hatTermin) return { erlaubt: false, grund: "Der Kunde hat bereits einen Termin.", heute };
  }
  if (art === "nicht_erreicht_termin" && z.hatTermin) {
    return { erlaubt: false, grund: "Der Kunde hat bereits einen Termin.", heute };
  }
  if (z.archiviert) return { erlaubt: false, grund: "Alle Bestellungen dieses Kunden sind archiviert.", heute };

  if (heute >= TAGESLIMIT) {
    return { erlaubt: false, grund: `Tageslimit erreicht (${TAGESLIMIT} Sendungen). Morgen wieder möglich.`, heute };
  }
  return { erlaubt: true, grund: null, heute };
}

/**
 * Dieselbe Prüfung für VIELE Arten auf einmal.
 *
 * `versandErlaubt` holt je Aufruf den Kundenzustand und die Tageszählung. Für
 * ein Menü mit vierzehn Ereignissen sind das achtundzwanzig Abfragen, von
 * denen vierzehn identisch sind — gemessen 3,7 Sekunden, und das Sende-Menü
 * stand solange auf „Wird geladen …".
 *
 * Hier wird der Zustand EINMAL geholt und die Tageszählung in EINER Abfrage
 * für alle Arten. Die Entscheidungsregeln bleiben, wo sie waren: in
 * `bewerten` — es gibt keine zweite Fassung davon.
 */
export async function versandErlaubtViele(
  personId: number, arten: VersandArt[], lauf: Lauf = sqlPool,
): Promise<Record<string, { erlaubt: boolean; grund: string | null; heute: number }>> {
  const z = await zustandVon(personId, lauf);
  const aus: Record<string, { erlaubt: boolean; grund: string | null; heute: number }> = {};
  if (!z) {
    for (const a of arten) aus[a] = { erlaubt: false, grund: "Kunde nicht gefunden.", heute: 0 };
    return aus;
  }
  const zeilen = (await lauf`
    SELECT event, COUNT(*)::int AS n FROM fiaon_mail_log
    WHERE person_id = ${personId} AND event = ANY(${arten as string[]})
      AND status = 'versandt' AND ausgeloest_agent_id IS NOT NULL
      AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
    GROUP BY event
  `) as any[];
  const heuteJe = new Map(zeilen.map((r) => [String(r.event), Number(r.n)]));
  for (const a of arten) aus[a] = bewerten(z, a, heuteJe.get(a) ?? 0);
  return aus;
}

/** Alle Knöpfe für einen Kunden, mit Zustand und Begründung. */
export async function versandKnoepfe(
  personId: number, rolle: string, lauf: Lauf = sqlPool,
): Promise<VersandKnopf[]> {
  const arten = artenFuerRolle(rolle);
  const knoepfe: VersandKnopf[] = [];
  for (const art of arten) {
    const p = await versandErlaubt(personId, art, lauf);
    knoepfe.push({
      art,
      titel: VERSAND_TEXT[art].titel,
      zweck: VERSAND_TEXT[art].zweck,
      erlaubt: p.erlaubt,
      grund: p.grund,
      heute: p.heute,
    });
  }
  return knoepfe;
}

/** Die Versandhistorie eines Kunden — was ging raus, wann, mit welchem Ausgang. */
export async function versandHistorie(personId: number, lauf: Lauf = sqlPool): Promise<any[]> {
  const rows = (await lauf`
    SELECT id, event, status, grund, empfaenger, ausgeloest_von, created_at
    FROM fiaon_mail_log WHERE person_id = ${personId}
    ORDER BY id DESC LIMIT 60
  `) as any[];
  return rows.map((r) => ({
    id: Number(r.id),
    art: r.event,
    titel: VERSAND_TEXT[r.event as VersandArt]?.titel ?? r.event,
    status: r.status,
    grund: r.grund,
    empfaenger: r.empfaenger,
    // „System" statt leer: Ein leeres Feld liest sich wie ein fehlender Wert,
    // dabei ist „von keinem Menschen ausgelöst" die eigentliche Auskunft.
    ausgeloestVon: r.ausgeloest_von || "System",
    am: r.created_at,
  }));
}
