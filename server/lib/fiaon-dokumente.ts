// ═══════════════════════════════════════════════════════════════════════════
// KUNDENDOKUMENTE — Ausweis, Kontoauszug, Bonitätsauskunft
//
// ── DER BEFUND (10.08.2026) ────────────────────────────────────────────────
// `GET /api/fiaon/document/:ref/:type` war als „Public (no auth)" gemountet.
// Wer eine Bestellreferenz kannte — sie steht in jeder Zahlungs-Mail, auf
// jeder Rechnung, in jedem Screenshot — konnte den AUSWEIS des Kunden
// herunterladen. Ohne Anmeldung, ohne Spur.
//
// Die Route ist nicht aus Nachlässigkeit offen: Das Kundenportal hält seine
// Anmeldung nur im Browser (sessionStorage), es gibt kein Sitzungs-Cookie, an
// dem eine Prüfung hängen könnte. Der Kunde MUSS an seine eigenen Unterlagen.
//
// Die Lösung ist dieselbe wie bei Rechnungs-, Termin- und Zugangslinks: ein
// SIGNIERTER, kurzlebiger Link. Der Kunde holt ihn sich über seine Referenz
// und lädt damit herunter; wer nur die Referenz hat, kommt nicht weiter.
//
// ── DIE ZWEITE GRENZE: WER IM HAUS DARF ────────────────────────────────────
// In der Verpflichtungserklärung der Vertriebsleitung steht wörtlich:
//
//   „Kundendokumente öffnen oder herunterladen (Ausweis, Kontoauszug,
//    SCHUFA) — sichtbar ist nur, ob sie vorliegen."
//
// Das stand bisher nur im Text. Ab jetzt steht es im Code: `darfInhalt()`
// gibt für die Vertriebsleitung `false` zurück, und die Datei-Route prüft das,
// bevor sie ein Byte ausliefert.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export const DOKUMENTE = [
  { art: "ausweis", spalte: "id_card_pdf", label: "Ausweis", kurz: "id-card" },
  { art: "kontoauszug", spalte: "bank_statement_pdf", label: "Kontoauszug", kurz: "bank-statement" },
  { art: "schufa", spalte: "schufa_pdf", label: "Bonitätsauskunft", kurz: "schufa" },
] as const;

export type DokumentArt = (typeof DOKUMENTE)[number]["art"];

export function istDokumentArt(v: unknown): v is DokumentArt {
  return DOKUMENTE.some((d) => d.art === v);
}

/** Die alten Kurzformen aus dem Kundenportal weiter verstehen. */
export function artAusKurz(v: string): DokumentArt | null {
  return DOKUMENTE.find((d) => d.kurz === v || d.art === v)?.art ?? null;
}

/**
 * Darf diese Rolle den INHALT sehen?
 *
 * Nur der Vorgesetzte. Für alle anderen ist ein Ausweis eine Zeile „liegt vor",
 * mehr nicht — so steht es in der Erklärung, die sie unterschrieben haben.
 */
export function darfInhalt(rolle: string): boolean {
  // ══════════════════════════════════════════════════════════════════════════
  // „NUR DER VORGESETZTE" — UND DER IST DIE VERTRIEBSLEITUNG (26.08.2026)
  //
  // Florentine (Punkt 8): „Bei den Dokumenten in der Kundenakte wird
  // teilweise angezeigt, dass diese nur vom Vorgesetzten geöffnet werden
  // können. Für die tägliche Bearbeitung wäre es wichtig, dass auch der
  // zuständige Mitarbeiter die hochgeladenen Dokumente einsehen kann."
  //
  // BEFUND: Hier stand `rolle === "admin"`. Diese Rolle trägt in der
  // Datenbank NIEMAND — Justin, Florentine und Daniel sind
  // `vertriebsleiter`. Praktisch konnte damit kein einziger Mensch ein
  // Dokument öffnen, obwohl die Regel ausdrücklich „nur der Vorgesetzte"
  // lautet. Die Leitung war ausgesperrt.
  //
  // NACHHER: Leitung und Verwaltung. Das ist genau das, was der Satz meint.
  //
  // NICHT geändert: der gewöhnliche Mitarbeiter. Für ihn bleibt ein Ausweis
  // eine Zeile „liegt vor". So steht es in der Verpflichtungserklärung, die
  // jeder unterschrieben hat — das lässt sich nicht nebenbei in einer
  // Fehlerbehebung umdrehen. Ob es geändert werden SOLL, ist eine
  // Entscheidung für Justin; sie gehört ins Register und in eine neue
  // Fassung der Erklärung, nicht in diese Zeile.
  // ══════════════════════════════════════════════════════════════════════════
  return rolle === "admin" || rolle === "vertriebsleiter";
}

// ───────────────────────────────────────────────────────────────────────────
// Signierte Kundenlinks
// ───────────────────────────────────────────────────────────────────────────

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

/** Gültigkeit eines Download-Links. Kurz — er wird sofort benutzt. */
export const LINK_MINUTEN = 15;

export function dokumentTokenErzeugen(ref: string, art: DokumentArt, ttlMs = LINK_MINUTEN * 60_000): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", geheimnis())
    .update(`dok.${ref}.${art}.${exp}`).digest("hex").slice(0, 32);
  return `${exp}.${sig}`;
}

export function dokumentTokenPruefen(ref: string, art: DokumentArt, token: string): boolean {
  const [expStr, sig] = String(token || "").split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  const erwartet = createHmac("sha256", geheimnis())
    .update(`dok.${ref}.${art}.${exp}`).digest("hex").slice(0, 32);
  const a = Buffer.from(erwartet);
  const b = Buffer.from(String(sig || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

// ───────────────────────────────────────────────────────────────────────────
// Stand
// ───────────────────────────────────────────────────────────────────────────

export interface DokumentStand {
  art: DokumentArt;
  label: string;
  vorhanden: boolean;
  /** Nur bei vorhandenen. */
  groesseKb: number | null;
  seit: string | null;
  /** MIME-Typ, aus den ersten Bytes erkannt — für Vorschau als Bild oder PDF. */
  typ: "pdf" | "bild" | "unbekannt" | null;
  /** Wird dieses Dokument für diese Bestellart überhaupt gebraucht? */
  benoetigt: boolean;
  /** Erneut angefordert (`reupload_*`). */
  erneutAngefordert: boolean;
}

export interface DokumentLageVoll {
  ref: string | null;
  personId: number | null;
  kycStatus: string | null;
  schufaStatus: string | null;
  adminNotiz: string | null;
  schufaNotiz: string | null;
  geprueftAm: string | null;
  hochgeladenAm: string | null;
  dokumente: DokumentStand[];
  /** Darf der Aufrufer Inhalte öffnen? Die Oberfläche zeigt danach an. */
  inhaltErlaubt: boolean;
}

/**
 * Der Dokumentstand einer Person.
 *
 * Liest NIE die BYTEA-Inhalte, nur `LENGTH()` und die ersten Bytes — sonst
 * zöge jede Aktenansicht mehrere Megabyte durch die Leitung, nur um „liegt
 * vor" anzuzeigen.
 */
export async function dokumentStand(
  opts: { personId?: number | null; ref?: string | null; rolle: string },
  lauf: Lauf = sqlPool,
): Promise<DokumentLageVoll | null> {
  const [a] = (await lauf`
    SELECT ref, person_id, type, kyc_status, schufa_status, admin_note, admin_schufa_note,
           admin_reviewed_at, documents_uploaded_at, updated_at,
           COALESCE(reupload_id_card, FALSE) AS re_ausweis,
           COALESCE(reupload_bank_statement, FALSE) AS re_auszug,
           LENGTH(id_card_pdf) AS gr_ausweis,
           LENGTH(bank_statement_pdf) AS gr_auszug,
           LENGTH(schufa_pdf) AS gr_schufa,
           SUBSTRING(id_card_pdf FROM 1 FOR 4) AS kopf_ausweis,
           SUBSTRING(bank_statement_pdf FROM 1 FOR 4) AS kopf_auszug,
           SUBSTRING(schufa_pdf FROM 1 FOR 4) AS kopf_schufa
    FROM fiaon_applications
    WHERE ${opts.ref ? lauf`ref = ${opts.ref}` : lauf`person_id = ${opts.personId ?? -1}`}
      AND merged_into IS NULL AND gdpr_deleted_at IS NULL
    ORDER BY (payment_status = 'paid') DESC, created_at DESC
    LIMIT 1
  `) as any[];
  if (!a) return null;

  // ══════════════════════════════════════════════════════════════════════
  // DIE BONITÄTSAUSKUNFT WIRD BEI JEDEM PAKET GEBRAUCHT (27.08.2026)
  //
  // Ein Mitarbeiter rief Justin an und fragte: „Warum braucht man für dieses
  // Paket keine Bonitätsauskunft?" Justin: „BRAUCHEN WIR FÜR JEDES PAKET!"
  //
  // Hier stand: Bonitätsprodukte brauchen die Auskunft, alle anderen nur
  // Ausweis und Kontoauszug. Die Kachel meldete deshalb bei jedem normalen
  // Paket „für dieses Paket nicht nötig" — zwei Zeilen unter dem Satz
  // „Vollständig heißt: Paket bezahlt, SCHUFA (74 €) bezahlt, Kontoauszug und
  // Ausweis da". Dieselbe Anzeige widersprach sich also selbst, und die
  // Kartenbedingungen in fiaon-konto-karte.ts verlangen schufa_bezahlt
  // ebenfalls.
  //
  // Das ist nicht nur verwirrend, es kostet Geld: Ein Mitarbeiter, der liest
  // „nicht nötig", verkauft die Auskunft (74 €) nicht.
  //
  // Ab jetzt: Die Auskunft steht IMMER auf der Liste. Ausweis und Kontoauszug
  // bleiben, wo sie waren — bei einer reinen Auskunftsbestellung beschafft
  // FIAON die Auskunft, dort ist sie ohnehin der einzige Gegenstand.
  // ══════════════════════════════════════════════════════════════════════
  const istBonitaet = String(a.type || "") === "schufa";
  const benoetigt: DokumentArt[] = istBonitaet
    ? ["schufa"]
    : ["ausweis", "kontoauszug", "schufa"];

  const groessen: Record<DokumentArt, number | null> = {
    ausweis: a.gr_ausweis, kontoauszug: a.gr_auszug, schufa: a.gr_schufa,
  };
  const koepfe: Record<DokumentArt, Buffer | null> = {
    ausweis: a.kopf_ausweis, kontoauszug: a.kopf_auszug, schufa: a.kopf_schufa,
  };
  const erneut: Record<DokumentArt, boolean> = {
    ausweis: !!a.re_ausweis, kontoauszug: !!a.re_auszug, schufa: false,
  };

  return {
    ref: a.ref, personId: a.person_id ?? null,
    kycStatus: a.kyc_status ?? null,
    schufaStatus: a.schufa_status ?? null,
    adminNotiz: a.admin_note ?? null,
    schufaNotiz: a.admin_schufa_note ?? null,
    geprueftAm: a.admin_reviewed_at ?? null,
    hochgeladenAm: a.documents_uploaded_at ?? null,
    inhaltErlaubt: darfInhalt(opts.rolle),
    dokumente: DOKUMENTE.map((d) => {
      const gr = groessen[d.art];
      return {
        art: d.art, label: d.label,
        vorhanden: gr != null && Number(gr) > 0,
        groesseKb: gr != null ? Math.round(Number(gr) / 1024) : null,
        seit: gr != null ? (a.documents_uploaded_at ?? a.updated_at ?? null) : null,
        typ: gr != null ? dateiTyp(koepfe[d.art]) : null,
        benoetigt: benoetigt.includes(d.art),
        erneutAngefordert: erneut[d.art],
      };
    }),
  };
}

/**
 * Dateityp aus den ersten Bytes.
 *
 * Der Dateiname wird nicht gespeichert, und Kunden laden Ausweise als Foto
 * genauso oft hoch wie als PDF. Ein Bild in einen PDF-Betrachter zu stecken
 * zeigt eine leere Fläche — deshalb wird geschaut, was es wirklich ist.
 */
export function dateiTyp(kopf: Buffer | Uint8Array | null): "pdf" | "bild" | "unbekannt" {
  if (!kopf || kopf.length < 3) return "unbekannt";
  const b = Buffer.from(kopf);
  if (b.subarray(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "bild";           // JPEG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return "bild"; // PNG
  return "unbekannt";
}

export function mimeFuer(typ: string | null): string {
  return typ === "bild" ? "image/jpeg" : "application/pdf";
}

/** Der Inhalt. Nur über diese eine Funktion — sie prüft die Rolle selbst. */
export async function dokumentInhalt(
  ref: string, art: DokumentArt, rolle: string, lauf: Lauf = sqlPool,
): Promise<{ ok: true; daten: Buffer; typ: string } | { ok: false; grund: string; code: number }> {
  if (!darfInhalt(rolle)) {
    return {
      ok: false, code: 403,
      grund: "Kundendokumente darf nur der Vorgesetzte öffnen. Sichtbar ist für dich, ob sie vorliegen — "
        + "so steht es in deiner Verpflichtungserklärung.",
    };
  }
  const spalte = DOKUMENTE.find((d) => d.art === art)!.spalte;
  const [row] = (await lauf.unsafe(
    `SELECT ${spalte} AS daten FROM fiaon_applications
      WHERE ref = $1 AND gdpr_deleted_at IS NULL LIMIT 1`, [ref],
  )) as any[];
  if (!row?.daten) return { ok: false, code: 404, grund: "Dieses Dokument liegt nicht vor." };
  const daten = Buffer.from(row.daten);
  return { ok: true, daten, typ: mimeFuer(dateiTyp(daten.subarray(0, 4))) };
}
