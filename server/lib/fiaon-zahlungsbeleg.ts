// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSBELEG — der Screenshot der Überweisung, im System
//
// „Lass dir ein Bild der Überweisung schicken" läuft heute über eine
// WhatsApp-Gruppe. Das Bild ist zehn Minuten später nicht mehr auffindbar, und
// wer bucht, bucht auf Zuruf. Ab jetzt hängt der Beleg an der Bestellung — dort,
// wo auch gebucht wird.
//
// DREI GRENZEN, DIE ABSICHT SIND
//   1. Der Beleg ist OPTIONAL. Er beschleunigt, er blockiert nicht. Kein Kunde
//      und kein Agent wartet auf ihn; eine Buchung mit Bankeingang braucht ihn
//      ohnehin nicht.
//   2. Das Überweisungsdatum laut Beleg ist PFLICHT. Ein Bild ohne Datum
//      beantwortet die wichtigste Frage nicht.
//   3. Ein Beleg ist KEIN Zahlungsnachweis. Er ist ein Hinweis, den ein Mensch
//      ansieht. Gebucht wird weiter nur über `alsBezahltBuchen` — ein Upload
//      löst nie eine Buchung aus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** 10 MB. Ein Handyfoto liegt bei 2–5 MB; alles darüber ist ein Versehen. */
export const BELEG_MAX_BYTES = 10 * 1024 * 1024;

export const BELEG_TYPEN = ["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"] as const;

export class BelegVerboten extends Error {
  code: string;
  constructor(code: string, nachricht: string) {
    super(nachricht);
    this.name = "BelegVerboten";
    this.code = code;
  }
}

export interface BelegStand {
  vorhanden: boolean;
  typ: string | null;
  name: string | null;
  bytes: number | null;
  /** Überweisungsdatum laut Beleg (YYYY-MM-DD). */
  datum: string | null;
  notiz: string | null;
  von: string | null;
  am: string | null;
}

export async function belegStand(ref: string, lauf: Lauf = sqlPool): Promise<BelegStand | null> {
  const [a] = await lauf`
    SELECT (payment_proof IS NOT NULL) AS vorhanden, payment_proof_typ, payment_proof_name,
           payment_proof_bytes, payment_proof_date, payment_proof_note,
           payment_proof_by, payment_proof_at
    FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!a) return null;
  return {
    vorhanden: !!a.vorhanden,
    typ: a.payment_proof_typ ?? null,
    name: a.payment_proof_name ?? null,
    bytes: a.payment_proof_bytes != null ? Number(a.payment_proof_bytes) : null,
    datum: a.payment_proof_date ? new Date(a.payment_proof_date).toISOString().slice(0, 10) : null,
    notiz: a.payment_proof_note ?? null,
    von: a.payment_proof_by ?? null,
    am: a.payment_proof_at ? new Date(a.payment_proof_at).toISOString() : null,
  };
}

export interface BelegEingabe {
  daten: Buffer;
  typ: string;
  name: string | null;
  /** Überweisungsdatum laut Beleg, YYYY-MM-DD. Pflicht. */
  datum: string;
  notiz: string | null;
}

/**
 * Beleg an eine Bestellung hängen. Ersetzt einen vorhandenen Beleg — der
 * Austausch wird protokolliert, damit nicht unbemerkt ein anderes Bild
 * darunterliegt als das, auf das jemand gebucht hat.
 */
export async function belegAnhaengen(
  ref: string,
  ein: BelegEingabe,
  akteur: { name: string; agentId?: number | null },
  opts: { tx?: Lauf } = {},
): Promise<{ ref: string; ersetzt: boolean }> {
  if (!ein.daten || ein.daten.length === 0) {
    throw new BelegVerboten("keine_datei", "Es kam keine Datei an. Bitte das Bild oder PDF erneut wählen.");
  }
  if (ein.daten.length > BELEG_MAX_BYTES) {
    throw new BelegVerboten("zu_gross",
      `Die Datei ist ${(ein.daten.length / 1024 / 1024).toFixed(1)} MB groß — mehr als 10 MB nimmt das System nicht an. `
      + "Ein Foto vom Handy reicht völlig.");
  }
  if (!BELEG_TYPEN.includes(ein.typ as any)) {
    throw new BelegVerboten("typ",
      `Dateityp ${ein.typ || "unbekannt"} wird nicht angenommen. Erlaubt sind Foto (JPG, PNG, HEIC, WEBP) und PDF.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ein.datum ?? ""))) {
    throw new BelegVerboten("datum_fehlt",
      "Bitte das Überweisungsdatum laut Beleg angeben (JJJJ-MM-TT) — ohne Datum beantwortet der Beleg die "
      + "wichtigste Frage nicht.");
  }
  const heute = new Date().toISOString().slice(0, 10);
  if (ein.datum > heute) {
    throw new BelegVerboten("datum_zukunft", "Das Überweisungsdatum liegt in der Zukunft. Bitte prüfen.");
  }

  const arbeit = async (tx: Lauf) => {
    const [a] = await tx`
      SELECT ref, person_id, (payment_proof IS NOT NULL) AS hatte
      FROM fiaon_applications WHERE ref = ${ref} FOR UPDATE
    `;
    if (!a) throw new BelegVerboten("nicht_gefunden", `Bestellung ${ref} gibt es nicht.`);

    await tx`
      UPDATE fiaon_applications SET
        payment_proof = ${ein.daten},
        payment_proof_typ = ${ein.typ},
        payment_proof_name = ${ein.name ?? null},
        payment_proof_bytes = ${ein.daten.length},
        payment_proof_date = ${ein.datum},
        payment_proof_note = ${(ein.notiz ?? "").trim() || null},
        payment_proof_by = ${akteur.name},
        payment_proof_by_agent_id = ${akteur.agentId ?? null},
        payment_proof_at = NOW(),
        updated_at = NOW()
      WHERE ref = ${ref}
    `;

    const text = `Zahlungsbeleg hinterlegt (Überweisung laut Beleg am ${ein.datum}`
      + `, ${(ein.daten.length / 1024).toFixed(0)} kB${ein.notiz ? `, Notiz: ${ein.notiz.trim()}` : ""})`
      + `${a.hatte ? " — ersetzt einen früheren Beleg" : ""}.`
      + " Das ist ein Hinweis, keine Buchung.";
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${ref}, ${akteur.agentId ?? null}, ${akteur.name}, 'note', 'zahlungsbeleg', ${text})
    `;
    await tx`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${akteur.agentId ?? null}, 'zahlungsbeleg_hinterlegt',
              ${JSON.stringify({ ref, datum: ein.datum, bytes: ein.daten.length, typ: ein.typ, ersetzt: !!a.hatte })},
              ${akteur.name}, ${"Zahlungsbeleg an der Bestellung hinterlegt"})
    `;
    return { ref: String(a.ref), ersetzt: !!a.hatte };
  };

  if (opts.tx) return arbeit(opts.tx);
  return await sqlPool.begin(arbeit) as { ref: string; ersetzt: boolean };
}

/** Die Bytes für die Anzeige. Nur für Admin und Vertriebsleitung. */
export async function belegDaten(
  ref: string, lauf: Lauf = sqlPool,
): Promise<{ daten: Buffer; typ: string; name: string } | null> {
  const [a] = await lauf`
    SELECT payment_proof, payment_proof_typ, payment_proof_name
    FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!a?.payment_proof) return null;
  return {
    daten: a.payment_proof as Buffer,
    typ: String(a.payment_proof_typ || "application/octet-stream"),
    name: String(a.payment_proof_name || `Zahlungsbeleg-${ref}`),
  };
}
