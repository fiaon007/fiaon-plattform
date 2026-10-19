// ═══════════════════════════════════════════════════════════════════════════
// MARA FORDERT FEHLENDE KYC-UNTERLAGEN SELBST NACH — DER SERVER (E-406 B2, 19.10.2026)
//
// Die Regel steht rein in shared/fiaon-kyc-nachfordern.ts (kycUrteil). Hier:
//   kycTakt()     alle 30 Minuten (Takt mara_kyc_nachfordern, fiaon-mara-steuerpult.ts): Kandidaten lesen
//                 (bezahltes, laufendes Privat-Paket, Ausweis oder Kontoauszug fehlt ganz oder ist neu
//                 angefordert), je Mensch die Kundensicht (unterlagenStand „kunde“) als Wahrheit, das Urteil,
//                 dann der EINE Weg unterlagenAnfrageSenden (Upload-Link ohne Anmeldung, Zustandsregel,
//                 Drossel, Protokoll, Verlauf). Höchstens KYC_LAUF_DECKEL je Lauf, KYC_TAG_DECKEL je Tag.
//   kycStand()    Schalter + Zahlen fürs Chefbüro (Mara › Bonitätsauskunft › Unterlagen).
// Jede Bitte steht in fiaon_mara_kyc (auch abgelehnte/gescheiterte — die zählen gegen KYC_FEHL_HOECHSTENS).
// Geld, Freigabe und Prüfung tut Mara nicht: Sie bittet nur um die Unterlage.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  KYC_ARTEN, KYC_LAUF_DECKEL, KYC_QUELLE, KYC_SCHALTER, KYC_TAG_DECKEL, istKycArt, kycAnlassSatz, kycBitte, kycPrivatPaketSql,
  kycSchalterAn, kycUrteil, kycVertragLaeuftSql, type KycArt, type KycFakten, type KycUrteil,
} from "@shared/fiaon-kyc-nachfordern";
import { imVersandfenster } from "@shared/fiaon-nicht-erreicht-nachfass";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "@shared/fiaon-kuendigung-regel";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Das Protokoll — NEUE Tabelle, Laufzeit-DDL mit kurzer Sperrfrist (E-254), Katalog zuerst.
// ───────────────────────────────────────────────────────────────────────────
let tabelleBereit: Promise<boolean> | null = null;
export function kycTabelle(lauf: Lauf = sqlPool): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      const [t] = (await lauf`SELECT to_regclass('fiaon_mara_kyc') IS NOT NULL AS da`) as any[];
      if (t?.da) return true;
      await lauf.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_mara_kyc (
          id BIGSERIAL PRIMARY KEY,
          person_id BIGINT NOT NULL,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ergebnis TEXT NOT NULL,
          nummer INTEGER,
          arten TEXT[] NOT NULL DEFAULT '{}',
          grund TEXT)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_kyc_person_idx ON fiaon_mara_kyc (person_id, am DESC)`;
        // Nie doppelt, auch mit mehreren Instanzen: Je Mensch und Erinnerung kann nur EINE Zeile „sendet“/„gesendet“/„unklar“ stehen.
        await tx`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_mara_kyc_einmal ON fiaon_mara_kyc (person_id, nummer) WHERE ergebnis IN ('sendet', 'gesendet', 'unklar')`;
      });
      return true;
    })().catch((e) => {
      console.error("[MARA-KYC] Protokoll-Tabelle nicht bereit — Mara fordert nichts an:", String(e?.message || e).slice(0, 200));
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/** Der Schalter (fiaon_settings.mara_kyc_nachfordern). Fehlt er: AN. Lesefehler: AUS (lieber keine Mail). */
export async function kycSchalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${KYC_SCHALTER}`) as any[];
    return kycSchalterAn(z?.value);
  } catch (e) {
    console.error("[MARA-KYC] Schalter nicht lesbar — nichts anfordern:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function kycSchalterSetzen(an: boolean): Promise<void> {
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${KYC_SCHALTER}, ${an ? "an" : "aus"})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Kandidaten — ein reines SELECT mit allen Fakten außer der Kundensicht
// ───────────────────────────────────────────────────────────────────────────
/** Liegt die Unterlage irgendwo an der Person (Spalte einer Bestellung oder aktive Datei)? */
function liegtSql(kategorie: KycArt, person: string): string {
  const spalte = kategorie === "ausweis" ? "id_card_pdf" : "bank_statement_pdf";
  return `(EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = ${person} AND x.gdpr_deleted_at IS NULL AND LENGTH(x.${spalte}) > 0)
        OR EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = ${person} AND d.art = 'unterlage' AND d.kategorie = '${kategorie}'
                     AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL))`;
}

export function kycKandidatenSql(): string {
  return `
WITH k AS (
  SELECT a.person_id, MIN(COALESCE(a.paid_at, a.completed_at, a.created_at)) AS bezahlt_am
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND ${kycPrivatPaketSql("a")} AND ${kycVertragLaeuftSql("a")}
   GROUP BY a.person_id
)
SELECT p.id AS person_id, k.bezahlt_am,
       (p.ist_test_am IS NOT NULL) AS test,
       COALESCE(p.is_blocked, FALSE) AS gesperrt,
       ${KUENDIGUNG_UNGEBUCHT_SQL("p.id")} AS kuendigung_offen,
       (NULLIF(TRIM(p.primary_email), '') IS NOT NULL
         OR EXISTS (SELECT 1 FROM fiaon_applications e WHERE e.person_id = p.id AND NULLIF(TRIM(e.email), '') IS NOT NULL)) AS hat_email,
       EXISTS (SELECT 1 FROM fiaon_unterlagen_anfragen u WHERE u.person_id = p.id AND u.quelle = 'auskunft') AS auswertung,
       (SELECT MAX(u.am) FROM fiaon_unterlagen_anfragen u
         WHERE u.person_id = p.id AND (u.mail_status = 'gesendet' OR u.whatsapp_status = 'gesendet')) AS letzte_bitte,
       -- „sendet“ (gerade in Arbeit) und „unklar“ (beim Senden unterbrochen) zählen wie gesendet — lieber eine Mail zu wenig.
       (SELECT COUNT(*)::int FROM fiaon_mara_kyc m WHERE m.person_id = p.id AND m.ergebnis IN ('gesendet', 'sendet', 'unklar')) AS mara_gesendet,
       (SELECT COUNT(*)::int FROM fiaon_mara_kyc m WHERE m.person_id = p.id AND m.ergebnis IN ('abgelehnt', 'fehlgeschlagen')
          AND m.am > COALESCE((SELECT MAX(m2.am) FROM fiaon_mara_kyc m2 WHERE m2.person_id = p.id AND m2.ergebnis IN ('gesendet', 'sendet', 'unklar')), 'epoch'::timestamptz)) AS mara_fehl,
       (SELECT MAX(m.am) FROM fiaon_mara_kyc m WHERE m.person_id = p.id) AS letzter_versuch,
       (SELECT MAX(m.am) FROM fiaon_mara_kyc m WHERE m.person_id = p.id AND m.ergebnis IN ('gesendet', 'sendet', 'unklar')) AS letzte_mara,
       (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre,
       (SELECT MAX(l.created_at) FROM fiaon_mail_log l WHERE l.person_id = p.id AND l.status = 'versandt') AS letzte_mail,
       NOT ${liegtSql("ausweis", "p.id")} AS ausweis_fehlt,
       NOT ${liegtSql("kontoauszug", "p.id")} AS konto_fehlt,
       EXISTS (SELECT 1 FROM fiaon_applications r WHERE r.person_id = p.id AND r.merged_into IS NULL AND COALESCE(r.reupload_id_card, FALSE)) AS ausweis_neu,
       EXISTS (SELECT 1 FROM fiaon_applications r WHERE r.person_id = p.id AND r.merged_into IS NULL AND COALESCE(r.reupload_bank_statement, FALSE)) AS konto_neu
  FROM k JOIN fiaon_persons p ON p.id = k.person_id
 WHERE p.merged_into_person_id IS NULL
 ORDER BY k.bezahlt_am ASC NULLS LAST, p.id ASC`;
}

interface KandidatZeile {
  person_id: number; bezahlt_am: string | null; test: boolean; gesperrt: boolean; kuendigung_offen: boolean; hat_email: boolean;
  auswertung: boolean; letzte_bitte: string | null; mara_gesendet: number; mara_fehl: number; letzter_versuch: string | null;
  letzte_mail: string | null; ausweis_fehlt: boolean; konto_fehlt: boolean; ausweis_neu: boolean; konto_neu: boolean;
  letzte_mara: string | null; werbesperre: boolean;
}

async function kandidatenLesen(lauf: Lauf): Promise<KandidatZeile[]> {
  const { globalKundeBereit } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  return (await lauf.begin("READ ONLY", async (tx: any) => {
    await tx.unsafe("SET LOCAL statement_timeout = 60000");
    return (await tx.unsafe(kycKandidatenSql())) as any[];
  })) as KandidatZeile[];
}

/** Die grobe Vorauswahl aus dem SELECT: was fehlt ganz oder ist von der Verwaltung neu angefordert? */
function grobFehlt(z: KandidatZeile): KycArt[] {
  const f: KycArt[] = [];
  if (z.ausweis_fehlt || z.ausweis_neu) f.push("ausweis");
  if (z.konto_fehlt || z.konto_neu) f.push("kontoauszug");
  return f;
}

function faktenAus(z: KandidatZeile, fehlt: KycArt[], globalKunde: boolean): KycFakten {
  return {
    personDa: true, vertragLaeuft: true, testkonto: !!z.test, globalKunde, gesperrt: !!z.gesperrt,
    kuendigungOffen: !!z.kuendigung_offen, hatEmail: !!z.hat_email, auswertungAblauf: !!z.auswertung, fehlt,
    bezahltAm: z.bezahlt_am, maraGesendet: Number(z.mara_gesendet || 0), maraFehlversuche: Number(z.mara_fehl || 0),
    letzteBitteAm: z.letzte_bitte, letzteMaraAm: z.letzte_mara, letzterVersuchAm: z.letzter_versuch, letzteMailAm: z.letzte_mail,
  };
}

/** Die Kundensicht ist die Wahrheit: was er in seinem Bereich als „fehlt“ oder „bitte neu“ sieht. */
async function kundensicht(personId: number, lauf: Lauf): Promise<{ art: KycArt; stand: "fehlt" | "bitte_neu" }[]> {
  const { unterlagenStand } = await import("./fiaon-unterlagen");
  const st = await unterlagenStand(personId, "kunde", lauf);
  return st.kategorien
    .filter((k) => istKycArt(k.kategorie) && (k.status === "fehlt" || k.status === "bitte_neu"))
    .map((k) => ({ art: k.kategorie as KycArt, stand: k.status as "fehlt" | "bitte_neu" }));
}

/** Atomar beanspruchen: Nur wer die Zeile „sendet“ anlegen kann, sendet (zweite Instanz → null, nichts geschieht). */
async function beanspruchen(personId: number, nummer: number, arten: KycArt[], lauf: Lauf): Promise<number | null> {
  const r = (await lauf`
    INSERT INTO fiaon_mara_kyc (person_id, ergebnis, nummer, arten) VALUES (${personId}, 'sendet', ${nummer}, ${arten})
    ON CONFLICT DO NOTHING RETURNING id`) as any[];
  return r.length ? Number(r[0].id) : null;
}

async function abschliessen(id: number, ergebnis: "gesendet" | "abgelehnt" | "fehlgeschlagen", grund: string | null, lauf: Lauf): Promise<void> {
  await lauf`UPDATE fiaon_mara_kyc SET ergebnis = ${ergebnis}, grund = ${grund ? grund.slice(0, 400) : null}, am = NOW() WHERE id = ${id}`;
}

export interface KycTaktErgebnis {
  aus: boolean; fenster: boolean; kandidaten: number; gesendet: number; abgelehnt: number; fehlgeschlagen: number;
  wartet: number; ausgelassen: number; erledigt: number; deckel: boolean; texte: string[];
}
const LEER = (): KycTaktErgebnis => ({ aus: false, fenster: true, kandidaten: 0, gesendet: 0, abgelehnt: 0, fehlgeschlagen: 0, wartet: 0, ausgelassen: 0, erledigt: 0, deckel: false, texte: [] });
export function istBearbeitet(e: KycTaktErgebnis): boolean { return e.gesendet + e.abgelehnt + e.fehlgeschlagen > 0; }

/**
 * Der Takt. `senden` = die Bitte (für den Prüfstand austauschbar); Standard ist der EINE Weg unterlagenAnfrageSenden.
 */
export async function kycTakt(opts: {
  jetzt?: Date; hoechstens?: number; lauf?: Lauf;
  senden?: (ein: { personId: number; arten: KycArt[]; saetze: Partial<Record<KycArt, string>>; anlassSatz: string }) => Promise<{ ok: boolean; status: string; meldung: string }>;
} = {}): Promise<KycTaktErgebnis> {
  const e = LEER();
  const lauf = opts.lauf ?? sqlPool;
  const jetzt = opts.jetzt ?? new Date();
  if (!(await kycTabelle(lauf))) return e;
  if (!(await kycSchalterLesen(lauf))) { e.aus = true; return e; }
  // Ein Absturz mitten im Senden: lieber keine zweite Mail als eine doppelte — die Zeile zählt als gesendet.
  await lauf`UPDATE fiaon_mara_kyc SET ergebnis = 'unklar', grund = 'Beim Senden unterbrochen — wird nicht wiederholt (nie doppelt)'
              WHERE ergebnis = 'sendet' AND am < NOW() - INTERVAL '30 minutes'`;
  if (!imVersandfenster(jetzt)) { e.fenster = false; return e; }
  const [h] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_mara_kyc
     WHERE ergebnis IN ('gesendet', 'sendet', 'unklar') AND am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'`) as any[];
  let frei = Math.max(0, Math.min(KYC_TAG_DECKEL - Number(h?.n || 0), Math.floor(opts.hoechstens ?? KYC_LAUF_DECKEL)));
  if (frei <= 0) { e.deckel = true; return e; }
  const zeilen = await kandidatenLesen(lauf);
  const { istGlobalKunde } = await import("./fiaon-global-kunde");
  // Wer noch keine Erinnerung hatte, zuerst; dann die ältesten Zahlungen.
  const reihe = zeilen.filter((z) => grobFehlt(z).length > 0)
    .sort((a, b) => Number(a.mara_gesendet || 0) - Number(b.mara_gesendet || 0));
  e.kandidaten = reihe.length;
  for (const z of reihe) {
    if (frei <= 0) { e.deckel = true; break; }
    const personId = Number(z.person_id);
    // Erst die billige Prüfung (ohne Kundensicht): Wer ohnehin warten muss oder ausfällt, kostet nichts weiter.
    const grob = kycUrteil(faktenAus(z, grobFehlt(z), false), jetzt);
    if (grob.art !== "senden") { zaehlen(e, grob); continue; }
    try {
      const global = await istGlobalKunde(personId, lauf);
      const sicht = await kundensicht(personId, lauf);
      const u = kycUrteil(faktenAus(z, sicht.map((s) => s.art), global), jetzt);
      if (u.art !== "senden") { zaehlen(e, u); continue; }
      const saetze: Partial<Record<KycArt, string>> = {};
      for (const s of sicht) { const b = kycBitte(s.art, s.stand); if (b) saetze[s.art] = b; }
      // Werbesperre: Die Bitte um die Unterlage geht (Service) — aber nur die Bitte. Die Tür (sperrUrteil) wertet jeden
      // Satz im Anlass-Feld als Angebot; darum ohne Anlass-Satz (menschSperre: auch „Stopp“ auf WhatsApp/im Postfach).
      const { menschSperre } = await import("./fiaon-mail-frequenz");
      const sperre = z.werbesperre || !!(await menschSperre(personId, lauf).catch(() => null))?.werbesperre;
      const anlassSatz = sperre ? "" : kycAnlassSatz(u.nummer);
      const zeile = await beanspruchen(personId, u.nummer, u.arten, lauf);
      if (zeile == null) continue; // eine andere Instanz ist dran — nie doppelt
      let r: { ok: boolean; status: string; meldung: string };
      try {
        const schicken = (anlass: string) => (opts.senden
          ? opts.senden({ personId, arten: u.arten, saetze, anlassSatz: anlass })
          : standardSenden(personId, u.arten, saetze, anlass));
        r = await schicken(anlassSatz);
        // Sperre an der ADRESSE (eine andere Person dahinter): noch einmal als reine Bitte, ohne Anlass-Satz.
        if (!r.ok && anlassSatz && /Werbesperre/i.test(String(r.meldung || ""))) r = await schicken("");
      } catch (err) {
        r = { ok: false, status: "fehlgeschlagen", meldung: `Fehler: ${err instanceof Error ? err.message : String(err)}` };
      }
      if (r.ok) {
        await abschliessen(zeile, "gesendet", null, lauf);
        e.gesendet++; frei--;
        e.texte.push(`Person ${personId}: Erinnerung ${u.nummer} (${u.arten.join(", ")}) gesendet`);
        // E-397-Motor: „Unterlage angefordert“ schließt den Team-Auftrag „Unterlage anfordern“ für genau diese Unterlagen.
        const { ereignisMelden } = await import("./fiaon-auftraege");
        await ereignisMelden({ ereignis: "unterlage_angefordert", personId, akteur: { id: null, name: "Mara" },
          detail: u.arten.map((a) => (a === "ausweis" ? "Ausweis" : "Kontoauszug")).join(", ") }, lauf);
      } else {
        const art = r.status === "abgelehnt" ? "abgelehnt" : "fehlgeschlagen";
        await abschliessen(zeile, art, r.meldung, lauf);
        if (art === "abgelehnt") e.abgelehnt++; else e.fehlgeschlagen++;
        e.texte.push(`Person ${personId}: nicht gesendet (${String(r.meldung || "").slice(0, 120)})`);
      }
    } catch (err) {
      // Vor dem Senden (Kundensicht, Global-Prüfung) gescheitert: nichts ging raus, nichts beansprucht — der nächste Lauf prüft neu.
      e.fehlgeschlagen++;
      console.error(`[MARA-KYC] Person ${personId}:`, err instanceof Error ? err.message : err);
    }
  }
  if (istBearbeitet(e)) console.log(`[MARA-KYC] Takt: ${e.gesendet} gesendet, ${e.abgelehnt} abgelehnt, ${e.fehlgeschlagen} fehlgeschlagen, ${e.wartet} warten, ${e.ausgelassen} ausgelassen, ${e.erledigt} erledigt.`);
  return e;
}

function zaehlen(e: KycTaktErgebnis, u: KycUrteil): void {
  if (u.art === "warten") e.wartet++;
  else if (u.art === "auslassen") e.ausgelassen++;
  else if (u.art === "erledigt") e.erledigt++;
}

async function standardSenden(personId: number, arten: KycArt[], saetze: Partial<Record<KycArt, string>>, anlassSatz: string) {
  const { unterlagenAnfrageSenden } = await import("./fiaon-unterlagen-link");
  const r = await unterlagenAnfrageSenden({
    personId, arten, kanaele: ["mail"], saetze, quelle: "mara_kyc", anlassSatz,
    akteur: { name: "Mara", agentId: null, rolle: "admin" },
  });
  return { ok: r.ok, status: r.status, meldung: r.ok ? r.meldung : (r.mail?.grund || r.meldung) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STAND FÜRS CHEFBÜRO (/chef/s/mara?reiter=auskunft, Karte „Unterlagen“)
// ═══════════════════════════════════════════════════════════════════════════
export interface KycStand {
  an: boolean;
  eingerichtet: boolean;
  heute: number;
  gesendet7: number;
  nichtGesendet7: number;
  /** Laufende Privat-Pakete, bei denen Ausweis oder Kontoauszug fehlt (ganz oder neu angefordert). */
  fehlen: number;
  /** Davon schon zweimal erinnert — jetzt ist das Team dran. */
  nachZwei: number;
  /** Seit Maras Erinnerung haben so viele Ausweis oder Kontoauszug hochgeladen (30 Tage). */
  geliefert30: number;
  hoechstens: number;
  abstandTage: number;
}

export async function kycStand(lauf: Lauf = sqlPool): Promise<KycStand> {
  const an = await kycSchalterLesen(lauf);
  const eingerichtet = await kycTabelle(lauf);
  const { KYC_HOECHSTENS, KYC_ABSTAND_TAGE } = await import("@shared/fiaon-kyc-nachfordern");
  const leer: KycStand = { an, eingerichtet, heute: 0, gesendet7: 0, nichtGesendet7: 0, fehlen: 0, nachZwei: 0, geliefert30: 0, hoechstens: KYC_HOECHSTENS, abstandTage: KYC_ABSTAND_TAGE };
  if (!eingerichtet) return leer;
  const [z] = (await lauf`
    SELECT
      COUNT(*) FILTER (WHERE ergebnis = 'gesendet' AND am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute,
      COUNT(*) FILTER (WHERE ergebnis = 'gesendet' AND am > NOW() - INTERVAL '7 days')::int AS gesendet7,
      COUNT(*) FILTER (WHERE ergebnis IN ('abgelehnt', 'fehlgeschlagen', 'unklar') AND am > NOW() - INTERVAL '7 days')::int AS nicht7
    FROM fiaon_mara_kyc`) as any[];
  const [g] = (await lauf`
    SELECT COUNT(DISTINCT m.person_id)::int AS n FROM fiaon_mara_kyc m
     WHERE m.ergebnis = 'gesendet' AND m.am > NOW() - INTERVAL '30 days'
       AND EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = m.person_id AND d.art = 'unterlage' AND d.quelle = 'kunde'
                     AND d.kategorie IN ('ausweis', 'kontoauszug') AND d.hochgeladen_am > m.am)`.catch(() => [{ n: 0 }])) as any[];
  let fehlen = 0, nachZwei = 0;
  try {
    const zeilen = (await kandidatenLesen(lauf)).filter((x) => grobFehlt(x).length > 0 && !x.test);
    fehlen = zeilen.length;
    nachZwei = zeilen.filter((x) => Number(x.mara_gesendet || 0) >= KYC_HOECHSTENS).length;
  } catch (e) {
    console.error("[MARA-KYC] Stand:", String((e as Error)?.message || e).slice(0, 160));
  }
  return {
    ...leer, heute: Number(z?.heute || 0), gesendet7: Number(z?.gesendet7 || 0), nichtGesendet7: Number(z?.nicht7 || 0),
    fehlen, nachZwei, geliefert30: Number(g?.n || 0),
  };
}

export { KYC_ARTEN, KYC_QUELLE };
