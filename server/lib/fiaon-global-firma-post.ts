// ═══════════════════════════════════════════════════════════════════════════
// FIRMENANGEBOT (E-301): KEINE AUTOMATISCHE MAIL AN DIE KUNDIN (Justin, 07.10.2026)
//
// „Link nur an Justin, KEINE automatische Mail an die Kundin.“ Vertrag, Rechnungen, Termine und Fristen schickt
// bzw. nennt der Ansprechpartner von Hand — er bekommt dafür je Vorgang eine Aufgabe.
//
// ── WO ES GILT ────────────────────────────────────────────────────────────
// An den Quellen ist die Automatik abgeschaltet (Zahlungstakt: nur die Aufgabe am zehnten Tag; Bestätigung des
// Individualangebots: nie für Firmen; Terminerinnerung des Startgesprächs: ab der Buchung erledigt). Dazu zwei
// Wände an den Türen, durch die jede Kundenmail geht — für alles, was künftig dazukommt oder übersehen wurde:
//   · server/make-webhook.ts sendMakeWebhookMitGrund (Make/Brevo-Ereignisse: Termine, Zahlungspost, Vorlagen)
//   · server/lib/fiaon-global-auftrag.ts globalMailSenden (Global-Mails direkt über den Motor: Start, Etappe,
//     Fristen des Pflichtenkalenders, Zahlungserinnerung, Startgespräch …)
// Frei bleibt, was ein MENSCH auslöst (Handversand, Knopf mit Namen), und was die Kundin selbst anfordert
// (global_zugang: „Link zu Mein Auftrag schicken“, gedrosselt).
//
// Erkannt wird die Kundin an der ADRESSE (Firmenangebot offen, abgelaufen oder angenommen; Firmenakte mit
// angebot_id eines Firmenangebots) und an der AKTE (bestaetigungen.firmenangebot = true). Bei einer Störung der
// Abfrage lassen die Wände durch wie die übrigen Wände an diesen Türen — und schreiben es ins Log.
// ═══════════════════════════════════════════════════════════════════════════
// Die Datenbank wird erst in der Abfrage geladen — istFirmenAkte und globalAutomatik bleiben rein (Prüfstände ohne DB,
// der Zahlungstakt importiert diese Datei).

export const FIRMA_KEINE_AUTOMATIK = "Firmenangebot (E-301): keine automatische Mail an die Kundin — Vertrag, Rechnungen, Termine und Fristen schickt der Ansprechpartner von Hand.";
/** Mails, die die Kundin selbst anfordert — sie bleiben frei. */
export const FIRMA_ANGEFORDERT: ReadonlySet<string> = new Set(["global_zugang"]);

/** Löst eine Automatik die Global-Mail aus? Leer, „System …“ und „Tageslauf …“ = Automatik; ein Name = ein Mensch. */
export function globalAutomatik(ausgeloestVon: string | null | undefined): boolean {
  const v = String(ausgeloestVon ?? "").trim();
  return !v || /^(System|Tageslauf)\b/i.test(v);
}

/** Trägt die Akte das Merkmal des Firmenangebots (bestaetigungen.firmenangebot = true)? Rein. */
export function istFirmenAkte(akte: { bestaetigungen?: unknown } | null | undefined): boolean {
  let b: unknown = akte?.bestaetigungen;
  for (let i = 0; i < 2 && typeof b === "string"; i++) { try { b = JSON.parse(b); } catch { return false; } }
  return !!b && typeof b === "object" && (b as Record<string, unknown>).firmenangebot === true;
}

/** Gehört die Adresse der Kundin eines Firmenangebots (offen, abgelaufen, angenommen) oder einer Firmenakte? */
export async function firmaKundinAdresse(email: string): Promise<boolean> {
  const a = String(email || "").trim().toLowerCase();
  if (!a || !process.env.DATABASE_URL) return false;
  const { sqlPool } = await import("./db-pool");
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS angebote, to_regclass('public.fiaon_global_auftraege') AS akten`) as any[];
  if (!t?.angebote) return false;
  const [x] = (await sqlPool`
    SELECT 1 AS treffer FROM fiaon_global_angebote
     WHERE fassung LIKE 'IA-FIRMA-%' AND status IN ('offen', 'abgelaufen', 'angenommen')
       AND LOWER(TRIM(COALESCE(kunde->>'email', CASE WHEN jsonb_typeof(kunde) = 'string' THEN (kunde #>> '{}')::jsonb ->> 'email' END, ''))) = ${a}
     LIMIT 1`) as any[];
  if (x) return true;
  if (!t.akten) return false;
  const [y] = (await sqlPool`
    SELECT 1 AS treffer FROM fiaon_global_auftraege g
     WHERE LOWER(TRIM(COALESCE(g.email, ''))) = ${a}
       AND g.angebot_id IN (SELECT id FROM fiaon_global_angebote WHERE fassung LIKE 'IA-FIRMA-%')
     LIMIT 1`) as any[];
  return !!y;
}

/** Die Frage für globalMailSenden: Soll diese Global-Mail wegen E-301 NICHT rausgehen? */
export async function firmaGlobalMailSperre(event: string, akte: { bestaetigungen?: unknown } | null | undefined, an: string, ausgeloestVon: string | null | undefined): Promise<boolean> {
  if (FIRMA_ANGEFORDERT.has(event) || !globalAutomatik(ausgeloestVon)) return false;
  if (istFirmenAkte(akte)) return true;
  return firmaKundinAdresse(an).catch((e) => {
    console.error(`[FIAON-FIRMA] '${event}': Firmenkundin nicht prüfbar — lasse durch:`, e instanceof Error ? e.message : e);
    return false;
  });
}
