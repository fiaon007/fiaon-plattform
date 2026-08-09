// ═══════════════════════════════════════════════════════════════════════════
// ANTRAGS-ARCHIV — die „Lösch"-Funktion, die keine ist
//
// Im Bestand liegen Bestellungen, die es fachlich nicht gibt: dreimal dasselbe
// Paket, weil der Kunde den Antrag dreimal angefangen hat; Testeinträge aus der
// Entwicklung; ein von Agenten gemeldeter Fake-Account. Bisher gab es dafür
// keinen Knopf — also blieb alles in den Arbeitslisten stehen, und jede Liste
// wurde ein Stück unglaubwürdiger.
//
// Löschen wäre die naheliegende und die falsche Antwort. Eine gelöschte
// Bestellung nimmt ihren Gesprächsverlauf, ihre Rechnungsnummer und ihre
// Provisionsspur mit — und niemand kann später prüfen, ob das richtig war.
//
// Archivieren heißt: raus aus Arbeitslisten, Verteilung, Follow-up, Zahlungs-
// listen und Kennzahlen. In der Akte bleibt die Bestellung sichtbar, mit Grund,
// Zeitpunkt und Namen. Wiederherstellen ist ein Klick (nur Admin).
//
// ZWEI HARTE SPERREN
//   1. BEZAHLTE Bestellungen sind nicht archivierbar. Geld, das geflossen ist,
//      verschwindet nicht aus den Zahlen — sonst wäre die Archivfunktion ein
//      Werkzeug, um Umsatz zu verstecken.
//   2. Bestellungen mit gebuchter PROVISION sind nicht archivierbar. Daran hängt
//      der Anspruch eines Agenten. Ihn stillschweigend aus den Listen zu nehmen
//      wäre ein Eingriff in fremdes Geld.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/** Ein laufender Transaktionskontext von postgres.js (oder der Pool selbst). */
type Lauf = typeof sqlPool;

export const ARCHIV_GRUENDE = [
  { key: "doppelt", text: "Doppelt angelegt" },
  { key: "testeintrag", text: "Testeintrag" },
  { key: "widerrufen", text: "Kunde widerrufen" },
  { key: "sonstiges", text: "Sonstiges" },
] as const;

export type ArchivGrund = (typeof ARCHIV_GRUENDE)[number]["key"];

export const GRUND_TEXT: Record<string, string> =
  Object.fromEntries(ARCHIV_GRUENDE.map((g) => [g.key, g.text]));

export interface ArchivPruefung {
  ref: string;
  archivierbar: boolean;
  /** Klartext neben dem gesperrten Knopf — nie nur „nicht möglich". */
  sperrgrund: string | null;
  bereitsArchiviert: boolean;
  archiviertAm: string | null;
  archivGrund: string | null;
  archivNotiz: string | null;
  archiviertVon: string | null;
  zahlungsStatus: string | null;
  provisionen: number;
}

export class ArchivVerboten extends Error {
  code: string;
  constructor(code: string, nachricht: string) {
    super(nachricht);
    this.name = "ArchivVerboten";
    this.code = code;
  }
}

/** Darf diese Bestellung ins Archiv? Beantwortet die Frage MIT Begründung. */
export async function archivPruefung(ref: string, lauf: Lauf = sqlPool): Promise<ArchivPruefung | null> {
  const [a] = await lauf`
    SELECT a.ref, a.payment_status, a.archived_at, a.archived_reason, a.archived_note,
           a.archived_by, a.invoice_number,
           (SELECT COUNT(*)::int FROM fiaon_commissions k
             WHERE k.ref = a.ref AND COALESCE(k.status, '') <> 'storniert') AS provisionen
    FROM fiaon_applications a WHERE a.ref = ${ref}
  `;
  if (!a) return null;

  const provisionen = Number(a.provisionen ?? 0);
  let sperrgrund: string | null = null;
  if (a.payment_status === "paid") {
    sperrgrund = "Diese Bestellung ist bezahlt. Bezahlte Bestellungen bleiben in den Zahlen — "
      + "sonst könnte man mit dem Archiv Umsatz verstecken. Für Rückabwicklung: Storno oder Erstattung.";
  } else if (provisionen > 0) {
    sperrgrund = `An dieser Bestellung hängt eine gebuchte Provision (${provisionen}). `
      + "Daran hängt der Anspruch eines Agenten — er wird nicht durch Archivieren beendet.";
  }

  return {
    ref: String(a.ref),
    archivierbar: !sperrgrund && !a.archived_at,
    sperrgrund,
    bereitsArchiviert: !!a.archived_at,
    archiviertAm: a.archived_at ?? null,
    archivGrund: a.archived_reason ?? null,
    archivNotiz: a.archived_note ?? null,
    archiviertVon: a.archived_by ?? null,
    zahlungsStatus: a.payment_status ?? null,
    provisionen,
  };
}

export interface ArchivAkteur {
  name: string;
  agentId?: number | null;
  /** 'admin' darf wiederherstellen, 'leitung' nur archivieren. */
  rolle: "admin" | "leitung";
}

/**
 * Bestellung archivieren. Grund ist Pflicht; bei „Sonstiges" auch der Freitext —
 * ein Archiveintrag ohne Begründung ist in drei Monaten nicht mehr erklärbar.
 */
export async function archiviereAntrag(
  ref: string,
  grund: string,
  notiz: string | null,
  akteur: ArchivAkteur,
  opts: { tx?: Lauf } = {},
): Promise<{ ref: string; personId: number | null }> {
  if (!GRUND_TEXT[grund]) {
    throw new ArchivVerboten("grund_fehlt",
      `Bitte einen Grund wählen: ${ARCHIV_GRUENDE.map((g) => g.text).join(", ")}.`);
  }
  const text = (notiz ?? "").trim();
  if (grund === "sonstiges" && text.length < 5) {
    throw new ArchivVerboten("notiz_fehlt",
      "Bei „Sonstiges“ braucht es einen Satz dazu — sonst weiß später niemand, warum.");
  }

  // Eine Transaktion um alles — oder die des Aufrufers (der Prüfstand rollt
  // damit den ganzen Lauf zurück, statt Testzeilen hinterher zu löschen).
  const arbeit = async (tx: Lauf) => {
    const [a] = await tx`
      SELECT a.ref, a.person_id, a.payment_status, a.archived_at, a.pack_name,
             (SELECT COUNT(*)::int FROM fiaon_commissions k
               WHERE k.ref = a.ref AND COALESCE(k.status, '') <> 'storniert') AS provisionen
      FROM fiaon_applications a WHERE a.ref = ${ref} FOR UPDATE
    `;
    if (!a) throw new ArchivVerboten("nicht_gefunden", `Bestellung ${ref} gibt es nicht.`);
    if (a.archived_at) throw new ArchivVerboten("schon_archiviert", `Bestellung ${ref} ist bereits archiviert.`);
    if (a.payment_status === "paid") {
      throw new ArchivVerboten("bezahlt",
        "Bezahlte Bestellungen sind nicht archivierbar. Geld, das geflossen ist, bleibt in den Zahlen.");
    }
    if (Number(a.provisionen ?? 0) > 0) {
      throw new ArchivVerboten("provision",
        "An dieser Bestellung hängt eine gebuchte Provision. Sie wird nicht durch Archivieren beendet.");
    }

    await tx`
      UPDATE fiaon_applications SET
        archived_at = NOW(),
        archived_reason = ${grund},
        archived_note = ${text || null},
        archived_by = ${akteur.name},
        archived_by_agent_id = ${akteur.agentId ?? null},
        updated_at = NOW()
      WHERE ref = ${ref}
    `;

    await tx`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${akteur.agentId ?? null}, 'antrag_archiviert',
              ${JSON.stringify({ ref, personId: a.person_id, grund, notiz: text || null, paket: a.pack_name })},
              ${akteur.name}, ${`Bestellung archiviert — ${GRUND_TEXT[grund]}`})
    `;

    // Klartext in den Verlauf: Wer die Akte öffnet, soll nicht rätseln, wohin
    // eine Bestellung verschwunden ist.
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${ref}, ${akteur.agentId ?? null}, ${akteur.name}, 'system', 'archiviert',
              ${`Bestellung archiviert (${GRUND_TEXT[grund]})${text ? `: ${text}` : ""}. Sie erscheint in keiner Arbeits- oder Zahlungsliste mehr und bleibt in der Akte sichtbar.`})
    `;

    // Einstufung nachziehen: Ohne diesen Schritt bliebe der Kunde in der
    // Anrufliste, obwohl der Anlass dafür archiviert ist.
    if (a.person_id != null) {
      const { personTierAktualisieren } = await import("./tier");
      await personTierAktualisieren(tx, { personId: Number(a.person_id) }).catch(() => {});
    }

    return { ref: String(a.ref), personId: a.person_id != null ? Number(a.person_id) : null };
  };
  if (opts.tx) return arbeit(opts.tx);
  const erg = await sqlPool.begin(arbeit) as { ref: string; personId: number | null };
  // Die Dubletten-Liste zeigt Bestellzahlen — nach einem Archiveintrag sind sie
  // veraltet.
  (await import("./fiaon-dubletten-kandidaten")).kandidatenCacheLeeren();
  return erg;
}

/** Wiederherstellen — nur Admin. Auch das wird protokolliert. */
export async function stelleAntragWiederHer(
  ref: string,
  akteur: ArchivAkteur,
  opts: { tx?: Lauf } = {},
): Promise<{ ref: string; personId: number | null }> {
  if (akteur.rolle !== "admin") {
    throw new ArchivVerboten("nur_admin",
      "Wiederherstellen darf nur der Vorgesetzte. Archivieren kann auch die Vertriebsleitung.");
  }
  const arbeit = async (tx: Lauf) => {
    const [a] = await tx`
      SELECT ref, person_id, archived_at, archived_reason FROM fiaon_applications
      WHERE ref = ${ref} FOR UPDATE
    `;
    if (!a) throw new ArchivVerboten("nicht_gefunden", `Bestellung ${ref} gibt es nicht.`);
    if (!a.archived_at) throw new ArchivVerboten("nicht_archiviert", `Bestellung ${ref} ist nicht archiviert.`);

    await tx`
      UPDATE fiaon_applications SET
        archived_at = NULL, archived_reason = NULL, archived_note = NULL,
        archived_by = NULL, archived_by_agent_id = NULL, updated_at = NOW()
      WHERE ref = ${ref}
    `;
    await tx`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${akteur.agentId ?? null}, 'antrag_wiederhergestellt',
              ${JSON.stringify({ ref, personId: a.person_id, vorherGrund: a.archived_reason })},
              ${akteur.name}, ${"Bestellung aus dem Archiv zurückgeholt"})
    `;
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${ref}, ${akteur.agentId ?? null}, ${akteur.name}, 'system', 'wiederhergestellt',
              ${"Bestellung aus dem Archiv zurückgeholt — sie erscheint wieder in den Arbeitslisten."})
    `;
    if (a.person_id != null) {
      const { personTierAktualisieren } = await import("./tier");
      await personTierAktualisieren(tx, { personId: Number(a.person_id) }).catch(() => {});
    }
    return { ref: String(a.ref), personId: a.person_id != null ? Number(a.person_id) : null };
  };
  if (opts.tx) return arbeit(opts.tx);
  return await sqlPool.begin(arbeit) as { ref: string; personId: number | null };
}

/**
 * Ein Agent MELDET einen Testeintrag — archivieren darf er nicht.
 *
 * Warum nicht: Ein Agent, der seine eigene Arbeitsliste kürzen kann, hat einen
 * Anreiz, unbequeme Kunden zu „Testeinträgen" zu erklären. Die Meldung landet
 * als Aufgabe bei der Vertriebsleitung, die entscheidet.
 */
export async function meldeTesteintrag(
  ref: string,
  begruendung: string,
  agent: { id: number; name: string },
): Promise<{ ref: string }> {
  const text = (begruendung ?? "").trim();
  if (text.length < 5) {
    throw new ArchivVerboten("begruendung_fehlt",
      "Bitte in einem Satz beschreiben, woran du erkennst, dass das kein echter Kunde ist.");
  }
  const [a] = await sqlPool`SELECT ref, person_id FROM fiaon_applications WHERE ref = ${ref}`;
  if (!a) throw new ArchivVerboten("nicht_gefunden", `Bestellung ${ref} gibt es nicht.`);

  await sqlPool.begin(async (tx) => {
    await tx`
      INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status,
                                  autor_art, autor_agent_id, autor_name)
      VALUES ('aufgabe', ${ref},
              ${`Als Testeintrag gemeldet: ${text}`},
              'team', TRUE, FALSE, 'offen', 'agent', ${agent.id}, ${agent.name})
    `;
    await tx`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${agent.id}, 'testeintrag_gemeldet',
              ${JSON.stringify({ ref, personId: a.person_id, begruendung: text })},
              ${agent.name}, ${"Verdacht auf Testeintrag — Entscheidung liegt bei der Vertriebsleitung"})
    `;
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${ref}, ${agent.id}, ${agent.name}, 'system', 'testeintrag_gemeldet',
              ${`Als Testeintrag gemeldet: ${text}`})
    `;
  });
  return { ref: String(a.ref) };
}
