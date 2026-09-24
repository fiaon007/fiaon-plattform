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
  /** P9: Kurzbefund der automatischen Prüfung — nur gesetzt, wenn auffällig. */
  pruefung?: string | null;
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
  /** 18.09.2026: ersetzte Fassungen (Archiv), neueste zuerst. */
  fruehere: { id: number; art: string; am: string; kb: number }[];
  /**
   * 24.09.2026 (E-240): Wo steht der Mensch bei der Bonitätsauskunft? Die Akte
   * zeigt danach den Knopf — „Auskunft anbieten" (nichts), „Zahlungslink senden"
   * (offen) oder keinen (bezahlt, liegt vor). Vorher bot die Kachel auch denen
   * „Anfordern" an, die sie längst bezahlt hatten. Null, wenn keine Person dranhängt.
   */
  auskunft: {
    stufe: "bezahlt" | "offen" | "dokument" | "nichts";
    /** Der Preis für DIESEN Menschen (74 € mit Paket, sonst 149 €). */
    preisText: string;
    mitAbo: boolean;
    /** Betrag der offenen Bestellung; „gemeldet" = der Kunde sagt, er habe überwiesen. */
    offen: { betragText: string; gemeldet: boolean } | null;
    /** „SCHUFA-Auskunft" / „KSV-Auskunft" / „Bonitätsauskunft" — wie der Kunde sie kennt. */
    wort: string;
    /**
     * Würde die Unterlagen-Mail die Auskunft ANBIETEN? Nein bei Werbesperre und
     * solange das Paket nicht bezahlt ist (angebotLage) — dann bittet sie nur darum.
     * „werbesperre" gilt auch bei einer offenen Bestellung: Dann geht die Mail
     * ohne Zahlungslink (auskunftMailTeil, Gegenlesen 24.09.2026).
     */
    angebot: boolean;
    /** „kuerzlich_angeboten" (Integration 25.09.2026): die gemeinsame Bremse — ein Angebot in den letzten drei Tagen. */
    ohneAngebot: "werbesperre" | "paket_offen" | "kuerzlich_angeboten" | null;
  } | null;
}

/** Der Auskunft-Stand für die Akte — darf die Dokumentansicht nie aufhalten. */
async function auskunftFuerAkte(personId: number | null, lauf: Lauf): Promise<DokumentLageVoll["auskunft"]> {
  if (personId == null) return null;
  try {
    const { auskunftStand } = await import("./fiaon-auskunft");
    const { auskunftWort, euroText } = await import("@shared/fiaon-auskunft");
    const { angebotLage } = await import("../routes/fiaon-auskunft-kauf");
    const [s, lage] = await Promise.all([auskunftStand(personId, lauf), angebotLage(personId, lauf)]);
    // Integration 25.09.2026: Dieselbe Bremse wie die Unterlagen-Mail (auskunftMailTeil) — sonst
    // verspräche der Knopf „Auskunft anbieten" ein Angebot, das der Server gerade weglässt.
    const { zuletztAngeboten } = await import("./fiaon-auskunft");
    const kuerzlich = lage.angebot && s.stufe === "nichts" && !s.dokumentDa ? await zuletztAngeboten(personId, {}, lauf) : null;
    return {
      stufe: s.stufe, preisText: s.preis.text, mitAbo: s.preis.mitAbo, wort: auskunftWort(s.land),
      offen: s.offen ? { betragText: euroText(s.offen.betragCents || s.preis.cents), gemeldet: s.offen.status === "claimed_paid" } : null,
      angebot: lage.angebot && !kuerzlich, ohneAngebot: kuerzlich ? "kuerzlich_angeboten" : lage.grund,
    };
  } catch (e) {
    console.error("[DOK] Auskunft-Stand:", String(e).slice(0, 160));
    return null;
  }
}

/**
 * Der Dokumentstand einer Person.
 *
 * Liest NIE die BYTEA-Inhalte, nur `LENGTH()` und die ersten Bytes — sonst
 * zöge jede Aktenansicht mehrere Megabyte durch die Leitung, nur um „liegt
 * vor" anzuzeigen.
 */
export async function dokumentStand(
  opts: { personId?: number | null; ref?: string | null; rolle: string; zustaendig?: boolean },
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
    -- ── DIE PAKET-BESTELLUNG ZUERST (11.09.2026, E-181) ────────────────────
    -- Michael Lorenz: Ultra bezahlt am 17.07., Bonitaetsauskunft dazu bezahlt
    -- am 15.08. „Neueste zuerst" waehlte die Auskunft-Bestellung, deren Typ
    -- „schufa" nur die Auskunft verlangt — und die Akte sagte „Fuer dieses
    -- Paket kein Ausweis noetig", waehrend Ausweis und Kontoauszug an der
    -- Ultra-Bestellung hingen. 63 Personen haben mehr als eine Bestellung.
    ORDER BY (payment_status = 'paid') DESC,
             (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
             created_at DESC
    LIMIT 1
  `) as any[];
  if (!a) return null;

  // ── DIE DATEI KANN AN JEDER BESTELLUNG DER PERSON HAENGEN (E-181) ──────
  // Der Kunde laedt in seinem Bereich hoch — an die Bestellung, mit der er
  // angemeldet ist. Der Betreuer sieht die Akte der Person. Deshalb zaehlt
  // eine Datei, die IRGENDWO an der Person haengt, und der Inhalt kommt von
  // der Bestellung, die sie traegt (die massgebliche zuerst).
  const personId = a.person_id != null ? Number(a.person_id) : null;
  let hatPaket = String(a.type || "") !== "schufa" && !String(a.ref).startsWith("FIAON-SCHUFA-");
  if (personId != null) {
    const [ueberall] = (await lauf`
      SELECT
        bool_or(COALESCE(x.type, '') <> 'schufa' AND x.ref NOT LIKE 'FIAON-SCHUFA-%') AS hat_paket,
        MAX(x.documents_uploaded_at) AS hochgeladen_am,
        bool_or(x.reupload_id_card) AS re_ausweis, bool_or(x.reupload_bank_statement) AS re_auszug,
        (SELECT LENGTH(y.id_card_pdf) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.id_card_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS gr_ausweis,
        (SELECT SUBSTRING(y.id_card_pdf FROM 1 FOR 4) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.id_card_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS kopf_ausweis,
        (SELECT y.ref FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.id_card_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS ref_ausweis,
        (SELECT LENGTH(y.bank_statement_pdf) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.bank_statement_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS gr_auszug,
        (SELECT SUBSTRING(y.bank_statement_pdf FROM 1 FOR 4) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.bank_statement_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS kopf_auszug,
        (SELECT y.ref FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.bank_statement_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS ref_auszug,
        (SELECT LENGTH(y.schufa_pdf) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.schufa_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS gr_schufa,
        (SELECT SUBSTRING(y.schufa_pdf FROM 1 FOR 4) FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.schufa_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS kopf_schufa,
        (SELECT y.ref FROM fiaon_applications y WHERE y.person_id = ${personId} AND y.gdpr_deleted_at IS NULL AND y.schufa_pdf IS NOT NULL ORDER BY (y.ref = ${a.ref}) DESC, (y.merged_into IS NULL) DESC, y.created_at DESC LIMIT 1) AS ref_schufa
      FROM fiaon_applications x
      WHERE x.person_id = ${personId} AND x.merged_into IS NULL AND x.gdpr_deleted_at IS NULL
    `.catch(() => [null])) as any[];
    if (ueberall) {
      hatPaket = hatPaket || !!ueberall.hat_paket;
      a.documents_uploaded_at = ueberall.hochgeladen_am ?? a.documents_uploaded_at;
      a.re_ausweis = !!ueberall.re_ausweis; a.re_auszug = !!ueberall.re_auszug;
      for (const art of ["ausweis", "auszug", "schufa"] as const) {
        a[`gr_${art}`] = ueberall[`gr_${art}`] ?? null;
        a[`kopf_${art}`] = ueberall[`kopf_${art}`] ?? null;
        a[`ref_${art}`] = ueberall[`ref_${art}`] ?? null;
      }
    }
  }

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
  // E-181: Nur wer AUSSCHLIESSLICH eine Bonitaetsauskunft bestellt hat, braucht
  // nur die Auskunft. Wer irgendein Paket hat, braucht alle drei — egal, welche
  // Bestellung die Akte gerade traegt. Justin: „JEDER braucht Ausweis,
  // Kontoauszug, SCHUFA."
  const benoetigt: DokumentArt[] = hatPaket
    ? ["ausweis", "kontoauszug", "schufa"]
    : ["schufa"];

  const groessen: Record<DokumentArt, number | null> = {
    ausweis: a.gr_ausweis, kontoauszug: a.gr_auszug, schufa: a.gr_schufa,
  };
  const koepfe: Record<DokumentArt, Buffer | null> = {
    ausweis: a.kopf_ausweis, kontoauszug: a.kopf_auszug, schufa: a.kopf_schufa,
  };
  const erneut: Record<DokumentArt, boolean> = {
    ausweis: !!a.re_ausweis, kontoauszug: !!a.re_auszug, schufa: false,
  };

  // P9 (01.09.2026): Das Urteil der automatischen Prüfung je Dokument —
  // damit der Mitarbeiter „sieht nicht wie ein Kontoauszug aus" direkt an
  // der Zeile liest, statt es bei der Handprüfung zu entdecken.
  let urteile: Record<string, any> = {};
  try {
    const { urteileLesen } = await import("./fiaon-dokument-pruefung");
    // `urteileLesen` liefert ein Objekt je DokumentART (fuer eine Bestellung).
    // Je Art zaehlt das Urteil der Bestellung, an der die Datei haengt.
    const refs = Array.from(new Set([String(a.ref), a.ref_ausweis, a.ref_auszug, a.ref_schufa].filter(Boolean).map(String)));
    const jeRef: Record<string, Record<string, any>> = {};
    for (const r of refs) jeRef[r] = await urteileLesen([r]);
    urteile = {
      ausweis: jeRef[String(a.ref_ausweis || a.ref)]?.ausweis ?? jeRef[String(a.ref)]?.ausweis,
      kontoauszug: jeRef[String(a.ref_auszug || a.ref)]?.kontoauszug ?? jeRef[String(a.ref)]?.kontoauszug,
      schufa: jeRef[String(a.ref_schufa || a.ref)]?.schufa ?? jeRef[String(a.ref)]?.schufa,
    };
  } catch { /* Prüfmodul darf die Akte nie aufhalten */ }

  return {
    ref: a.ref, personId: a.person_id ?? null,
    kycStatus: a.kyc_status ?? null,
    schufaStatus: a.schufa_status ?? null,
    adminNotiz: a.admin_note ?? null,
    schufaNotiz: a.admin_schufa_note ?? null,
    geprueftAm: a.admin_reviewed_at ?? null,
    hochgeladenAm: a.documents_uploaded_at ?? null,
    inhaltErlaubt: darfInhalt(opts.rolle) || !!opts.zustaendig,
    fruehere: personId != null ? await fruehereFassungen(personId, lauf) : [],
    auskunft: await auskunftFuerAkte(personId, lauf),
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
        // P9: hinweisIntern der automatischen Prüfung, nur wenn auffällig.
        pruefung: (() => {
          const u = urteile[d.art];
          if (!u || (u.erkannt !== false && u.vollstaendig !== false)) return null;
          return u.hinweisIntern || null;
        })(),
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

/**
 * Vor dem Ersetzen: die bisherige Fassung ins Archiv (18.09.2026).
 *
 * Team-Feedback, Priorität 1: „Alle hochgeladenen Dokumente müssen dauerhaft im
 * System gespeichert bleiben." Bis heute überschrieb jeder neue Upload die
 * Spalte — der Juni war weg, sobald der Juli kam. Jetzt wandert die alte Fassung
 * nach `fiaon_dokumente` (art = 'frueher_<art>', ohne Vorgang — die Tabelle
 * erlaubt als quelle nur kunde/mitarbeiter/erzeugt/eingegangen), bevor die neue
 * geschrieben wird. Die Akte zeigt sie unter „Frühere Fassungen".
 * Kein Fehler hier darf den Upload aufhalten — er wird protokolliert.
 */
export async function unterlageSichern(ref: string, art: DokumentArt, lauf: Lauf = sqlPool): Promise<void> {
  const spalte = DOKUMENTE.find((d) => d.art === art)!.spalte;
  await lauf.unsafe(
    `INSERT INTO fiaon_dokumente (person_id, ref, art, dateiname, mime, bytes, inhalt, quelle, doc_hash, hochgeladen_am)
     SELECT a.person_id, a.ref, 'frueher_' || $2,
            $2 || '-fruehere-fassung.' || CASE WHEN substring(a.${spalte} from 1 for 4) = '\\x25504446'::bytea THEN 'pdf' ELSE 'jpg' END,
            CASE WHEN substring(a.${spalte} from 1 for 4) = '\\x25504446'::bytea THEN 'application/pdf' ELSE 'image/jpeg' END,
            LENGTH(a.${spalte}), a.${spalte}, 'kunde', encode(sha256(a.${spalte}), 'hex'),
            COALESCE(a.documents_uploaded_at, a.updated_at, NOW())
       FROM fiaon_applications a
      WHERE a.ref = $1 AND a.person_id IS NOT NULL AND a.${spalte} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM fiaon_dokumente d
                         WHERE d.person_id = a.person_id AND d.art = 'frueher_' || $2
                           AND d.doc_hash = encode(sha256(a.${spalte}), 'hex'))`,
    [ref, art],
  ).catch((e: any) => console.error(`[DOK] Archiv ${ref}/${art}:`, String(e?.message || e).slice(0, 200)));
}

/** Frühere Fassungen einer Person (ohne Inhalt) — für die Akte. */
export async function fruehereFassungen(personId: number, lauf: Lauf = sqlPool): Promise<{ id: number; art: string; am: string; kb: number }[]> {
  const zeilen = (await lauf`
    SELECT id, substring(art from 9) AS art, hochgeladen_am, bytes FROM fiaon_dokumente
     WHERE person_id = ${personId} AND art LIKE 'frueher\\_%' AND geloescht_am IS NULL
     ORDER BY hochgeladen_am DESC LIMIT 30
  `.catch(() => [] as any[])) as any[];
  return zeilen.map((z) => ({ id: Number(z.id), art: String(z.art), am: new Date(z.hochgeladen_am).toISOString(), kb: Math.max(1, Math.round(Number(z.bytes) / 1024)) }));
}

/**
 * Welche Bestellung trägt das Dokument dieser Person? (18.09.2026)
 *
 * ── DER BEFUND (Team-Feedback, Priorität 1) ─────────────────────────────
 * „Bezahlte Bonitätsauskünfte sind verschwunden und weder für den Kunden noch
 * für den Mitarbeiter einsehbar." Gelöscht wurde nichts — aber eine Person hat
 * oft mehrere Bestellungen (Paket, Auskunft, Dublette), und 63 Bestellungen mit
 * Unterlagen haben eine jüngere Schwester. Wer über die Schwester schaute
 * (Kundenbereich, Download, Analyse), fand „nichts". Neun Personen hatten ihre
 * Unterlagen nur an einer zusammengeführten Bestellung (merged_into).
 *
 * Die Regel: Ein Dokument gehört der PERSON. Gesucht wird an allen ihren
 * Bestellungen — die angefragte zuerst, dann die nicht zusammengeführten,
 * dann die jüngste. Ohne Person bleibt es bei der Bestellung selbst.
 */
export async function dokumentTraeger(
  q: { ref?: string | null; personId?: number | null }, art: DokumentArt, lauf: Lauf = sqlPool,
): Promise<string | null> {
  const spalte = DOKUMENTE.find((d) => d.art === art)!.spalte;
  const [row] = (await lauf.unsafe(
    `SELECT y.ref FROM fiaon_applications y
      WHERE y.gdpr_deleted_at IS NULL AND y.${spalte} IS NOT NULL
        AND (y.ref = $1
             OR y.person_id = COALESCE($2::bigint, (SELECT x.person_id FROM fiaon_applications x WHERE x.ref = $1 LIMIT 1)))
      ORDER BY (y.ref = $1) DESC, (y.merged_into IS NULL) DESC, y.documents_uploaded_at DESC NULLS LAST, y.created_at DESC
      LIMIT 1`,
    [q.ref ?? "", q.personId ?? null],
  )) as any[];
  return row?.ref ? String(row.ref) : null;
}

/**
 * Der Inhalt. Nur über diese eine Funktion — sie prüft die Rolle selbst.
 *
 * 18.09.2026 (Team-Feedback): „Sowohl wir als Mitarbeiter als auch die Kunden
 * müssen darauf zugreifen können." Bis heute durfte nur die Leitung öffnen;
 * der Betreuer sah „liegt vor" und konnte mit dem Kunden nicht über dessen
 * Auszug sprechen. Jetzt öffnet auch, wer den Kunden betreut (`zustaendig`,
 * geprüft über darfAnKunde) — jeder Abruf steht mit Namen im Verlauf.
 * Gesucht wird personenweit (dokumentTraeger).
 */
export async function dokumentInhalt(
  ref: string, art: DokumentArt, rolle: string, lauf: Lauf = sqlPool, opts: { zustaendig?: boolean } = {},
): Promise<{ ok: true; daten: Buffer; typ: string; ref: string } | { ok: false; grund: string; code: number }> {
  if (!darfInhalt(rolle) && !opts.zustaendig) {
    return {
      ok: false, code: 403,
      grund: "Dieses Dokument darf nur öffnen, wer den Kunden betreut, oder die Leitung.",
    };
  }
  const traeger = await dokumentTraeger({ ref }, art, lauf);
  if (!traeger) return { ok: false, code: 404, grund: "Dieses Dokument liegt nicht vor." };
  const spalte = DOKUMENTE.find((d) => d.art === art)!.spalte;
  const [row] = (await lauf.unsafe(
    `SELECT ${spalte} AS daten FROM fiaon_applications
      WHERE ref = $1 AND gdpr_deleted_at IS NULL LIMIT 1`, [traeger],
  )) as any[];
  if (!row?.daten) return { ok: false, code: 404, grund: "Dieses Dokument liegt nicht vor." };
  const daten = Buffer.from(row.daten);
  return { ok: true, daten, typ: mimeFuer(dateiTyp(daten.subarray(0, 4))), ref: traeger };
}
