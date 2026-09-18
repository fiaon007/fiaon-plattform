// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER ZUGANG ZU „MEIN AUFTRAG" PER MAIL (17.09.2026, E-188)
//
// ── WARUM ─────────────────────────────────────────────────────────────────
// Ein Firmenkunde von FIAON Global hat kein Passwort und kein Konto im
// Privatkundenbereich. Sein Bereich ist „Mein Auftrag"; der Zugang ist ein
// signiertes Token, das an die Antragsnummer gebunden ist und 30 Tage gilt
// (globalTokenErzeugen in fiaon-global-auftrag.ts). Läuft es ab, ist die Mail
// gelöscht oder versucht er es am Privatkunden-Login, braucht er einen FRISCHEN
// Link — und den bekommt er ausschließlich an die Adresse, die am Auftrag steht.
//
// ── EINE FUNKTION, VIER AUFRUFER ──────────────────────────────────────────
//   · POST /global/zugang { email }            — „Zugang neu anfordern" auf der
//                                                 Seite (Agent „bereich")
//   · POST /login, POST /verify-identity       — der Firmenkunde am Privatkunden-
//                                                 Login bzw. bei „Passwort
//                                                 vergessen" (fiaon-antrag.ts)
//   · POST /app/login-link                     — dasselbe am Anmelde-Link von /app
//   · POST /agent/global/auftraege/:ref/zugang-senden — die zuständige Person
//                                                 (mit `ref` und ohne Drossel)
// Alle rufen globalZugangSenden(email) und bekommen die ZAHL der verschickten
// Mails zurück. Die öffentlichen Aufrufer zeigen sie nie an: Ihre Antwort ist
// immer dieselbe, damit niemand Adressen durchprobieren kann.
//
// ── DIE REGELN ────────────────────────────────────────────────────────────
//   · Die getippte Adresse ist nur der SUCHSCHLÜSSEL. Verschickt wird an die
//     Adresse der Auftragsakte — wer eine fremde Adresse tippt, bekommt nichts.
//   · Eine Mail je Auftrag, jede mit eigenem frischem Link; höchstens fünf
//     Aufträge je Anforderung, stornierte nie.
//   · Drossel je E-Mail-Adresse: drei Anforderungen je Stunde (Speicher mit
//     Verfall, wie beim Anmelde-Link von /app). Die Drossel je IP gehört an die
//     Route — dort ist die IP bekannt.
//   · Pflichtmail in der Frequenzbremse (der Mensch hat sie selbst ausgelöst),
//     im Protokoll steht sie wie jede Mail; der Link selbst wird dort geschwärzt
//     (globalMailSenden).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";

const JE_STUNDE = 3;
const FENSTER_MS = 60 * 60 * 1000;
const HOECHSTENS_AUFTRAEGE = 5;

// ── Die Drossel je E-Mail (rein, mit der Uhr als Parameter — prüfbar ohne Warten) ──
const anforderungen = new Map<string, number[]>();
let letztePflege = 0;
const schluesselFuer = (email: string) => createHash("sha256").update(email).digest("hex");

/** Zählt eine Anforderung und sagt, ob sie noch im Deckel liegt. */
export function globalZugangErlaubt(email: string, jetzt: number = Date.now()): boolean {
  if (jetzt - letztePflege > 10 * 60 * 1000) {
    letztePflege = jetzt;
    anforderungen.forEach((zeiten, k) => { if (!zeiten.some((t) => jetzt - t < FENSTER_MS)) anforderungen.delete(k); });
  }
  const k = schluesselFuer(email);
  const frisch = (anforderungen.get(k) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  if (frisch.length >= JE_STUNDE) { anforderungen.set(k, frisch); return false; }
  frisch.push(jetzt);
  anforderungen.set(k, frisch);
  return true;
}
/** Nur für den Prüfstand: Drossel leeren. */
export function globalZugangDrosselLeeren(): void { anforderungen.clear(); letztePflege = 0; }

export function globalZugangAdresse(roh: unknown): string | null {
  const email = String(roh ?? "").trim().toLowerCase();
  return email.length >= 5 && email.length <= 200 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email) ? email : null;
}

/**
 * Schickt zu jeder Global-Bestellung dieser Adresse eine Mail `global_zugang` mit
 * frischem Link. Gibt die Zahl der verschickten Mails zurück — 0 heißt: keine
 * Aufträge, Drossel, oder der Versand scheiterte (steht dann im Mailprotokoll).
 * Wirft nie: Ein Login darf an dieser Mail nicht scheitern.
 */
export async function globalZugangSenden(
  emailRoh: string,
  opts: { ref?: string | null; ohneDrossel?: boolean; ausgeloestVon?: string } = {},
): Promise<number> {
  try {
    const email = globalZugangAdresse(emailRoh);
    if (!email) return 0;
    if (!opts.ohneDrossel && !globalZugangErlaubt(email)) {
      console.log("[GLOBAL-ZUGANG] Drossel je Adresse erreicht — keine weitere Mail in dieser Stunde.");
      return 0;
    }
    const { sqlPool } = await import("./db-pool");
    // Ohne Tabelle gibt es keinen Auftrag — und diese Funktion legt sie nicht an.
    const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_auftraege') AS tabelle`) as any[];
    if (!t?.tabelle) return 0;

    const ref = String(opts.ref ?? "").trim();
    const zeilen = (await sqlPool`
      SELECT g.ref
        FROM fiaon_global_auftraege g
        JOIN fiaon_applications a ON a.ref = g.ref
        LEFT JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
       WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
         AND a.cancelled_at IS NULL AND a.archived_at IS NULL
         AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'superseded')
         AND g.status <> 'storniert'
         AND (${ref} = '' OR g.ref = ${ref})
         AND ${email} IN (
           LOWER(TRIM(COALESCE(g.email, ''))), LOWER(TRIM(COALESCE(a.email, ''))),
           LOWER(TRIM(COALESCE(a.contact_email, ''))), LOWER(TRIM(COALESCE(a.billing_email, ''))),
           LOWER(TRIM(COALESCE(p.primary_email, ''))))
       ORDER BY g.created_at DESC
       LIMIT ${HOECHSTENS_AUFTRAEGE}`) as any[];
    if (!zeilen.length) return 0;

    const { globalAkteLesen, globalBestellungLesen, globalMailSenden, globalVerlauf } = await import("./fiaon-global-auftrag");
    let verschickt = 0;
    for (const z of zeilen) {
      const akte = await globalAkteLesen(String(z.ref));
      const b = await globalBestellungLesen(String(z.ref));
      if (!akte || !b) continue;
      const mail = await globalMailSenden("global_zugang", akte, b, { ausgeloestVon: opts.ausgeloestVon ?? "System (FIAON Global, Zugang)" });
      if (mail.ok) {
        verschickt++;
        await globalVerlauf(String(z.ref), `FIAON Global: Link zu „Mein Auftrag“ an ${akte.email || "den Kunden"} geschickt (${opts.ausgeloestVon ?? "vom Kunden angefordert"}).`);
      } else {
        console.error(`[GLOBAL-ZUGANG] ${z.ref}: Mail ging nicht raus: ${mail.grund}`);
      }
    }
    return verschickt;
  } catch (e) {
    console.error("[GLOBAL-ZUGANG]", e instanceof Error ? e.message : e);
    return 0;
  }
}
