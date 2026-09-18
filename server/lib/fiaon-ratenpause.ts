// ═══════════════════════════════════════════════════════════════════════════
// RATENPAUSE — EINEN MONAT AUSSETZEN (18.09.2026, Team-Feedback Priorität 5)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// „Wenn ich die Ratenpause im System aktiviere, passiert nichts: Der Kunde
// bleibt überfällig, Rechnungen und Zahlungserinnerungen gehen weiter raus."
// Der Knopf „1 Monat ausgesetzt + Termin" in der Pipeline speicherte eine
// ZAHLUNGSZUSAGE in 30 Tagen (Ergebnis `zahlt_am`) — also nur eine
// Wiedervorlage fürs Telefon. Fälligkeit, Mahnstufe und Überfälligkeit blieben
// unberührt; der Mahn-Takt las die Rate am nächsten Morgen wieder als fällig.
//
// ── WAS DIE PAUSE JETZT TUT ───────────────────────────────────────────────
// Alle offenen Raten der Bestellung rücken um einen Kalendermonat — die Kette
// bleibt im Rhythmus, am Ende steht eine Rate einen Monat später. Mahnstufe,
// Erinnerungen und Überfälligkeit fallen auf null (wie bei einer von Hand
// verschobenen Rate, /admin/abo/raten/:id/verschieben). Bis zur neuen
// Fälligkeit liest kein Takt die Raten als fällig: keine Erinnerung, keine
// Mahnung, keine Rückhol-Mail, kein Eintrag in der Inkasso-Liste.
//
// Ist die älteste offene Rate länger als einen Monat überfällig, reicht ein
// Monat nicht, um sie aus der Überfälligkeit zu holen — dann rückt die Kette so
// weit wie nötig, höchstens drei Monate; darüber ist es ein Härtefall für die
// Leitung. Höchstens eine Pause je Bestellung in 60 Tagen. Läuft für eine
// offene Rate schon ein Lastschrifteinzug, gibt es keine Pause — der Einzug
// ist bei der Bank, eine neue Fälligkeit hielte ihn nicht auf.
//
// Geld wird dabei nicht angefasst: kein Betrag, kein Status, keine Buchung.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;

export const PAUSE_SPERRE_TAGE = 60;
export const PAUSE_HOECHSTENS_MONATE = 3;

/** JJJJ-MM-TT plus n Kalendermonate, am Monatsende gekappt (31.01. + 1 = 28./29.02.). */
export function plusMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Wie viele Monate muss die Kette rücken, damit die älteste Rate wieder in der Zukunft liegt? */
export function pauseMonate(aeltesteFaellig: string, heute: string): number | null {
  for (let n = 1; n <= PAUSE_HOECHSTENS_MONATE; n++) {
    if (plusMonate(aeltesteFaellig, n) > heute) return n;
  }
  return null;
}

const tagDe = (iso: string) => iso.split("-").reverse().join(".");

export async function ratenpauseAnwenden(
  ein: { ref: string; grund: string; agentId: number | null; agentName: string; ohneSperre?: boolean; verlauf?: boolean },
  lauf: Lauf = sqlPool,
): Promise<{ ok: true; monate: number; verschoben: { nr: number; vorher: string; jetzt: string }[]; meldung: string } | { ok: false; fehler: string }> {
  const grund = String(ein.grund || "").trim();
  if (grund.length < 5) return { ok: false, fehler: "Bitte kurz den Grund nennen (z. B. „Analyse fehlt noch“) — er steht im Verlauf." };

  const offene = (await lauf`
    SELECT id, rate_nr, faellig_am::date::text AS faellig, zahlungsreferenz, lastschrift_status
      FROM fiaon_abo_raten
     WHERE ref = ${ein.ref} AND status = 'offen' AND storniert_am IS NULL
     ORDER BY rate_nr
  `) as any[];
  if (offene.length === 0) return { ok: false, fehler: "Zu dieser Bestellung gibt es keine offene Rate." };
  if (offene.some((r) => String(r.lastschrift_status || "") === "eingereicht")) {
    return { ok: false, fehler: "Für eine offene Rate läuft bereits ein Lastschrifteinzug — eine Pause hält ihn nicht auf. Bitte an die Leitung." };
  }

  if (!ein.ohneSperre) {
    const [zuletzt] = (await lauf`
      SELECT created_at FROM fiaon_raten_arbeit
       WHERE ref = ${ein.ref} AND ergebnis = 'ratenpause'
         AND created_at > NOW() - make_interval(days => ${PAUSE_SPERRE_TAGE})
       ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (zuletzt) {
      const am = new Date(zuletzt.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
      return { ok: false, fehler: `Für diese Bestellung gab es am ${am} schon eine Ratenpause — höchstens eine in ${PAUSE_SPERRE_TAGE} Tagen. Weitere entscheidet die Leitung (Härtefall).` };
    }
  }

  const heute = berlinToday();
  const aelteste = String(offene[0].faellig);
  const monate = pauseMonate(aelteste, heute);
  if (monate == null) {
    return { ok: false, fehler: `Die älteste offene Rate (Rate ${offene[0].rate_nr}, fällig ${tagDe(aelteste)}) ist länger als ${PAUSE_HOECHSTENS_MONATE} Monate überfällig — hier hilft keine Pause. Bitte als Härtefall an die Leitung.` };
  }

  const verschoben: { nr: number; vorher: string; jetzt: string }[] = [];
  for (const r of offene) {
    const vorher = String(r.faellig);
    const jetzt = plusMonate(vorher, monate);
    const [neu] = (await lauf`
      UPDATE fiaon_abo_raten SET
        faellig_am = ${jetzt}::date,
        mahnstufe = 0, erinnerungen = 0, letzte_erinnerung_at = NULL,
        ueberfaellig_seit = NULL, mahnstufe_bestaetigt_am = NULL,
        mahnstufe_versuch_am = NULL, mahnstufe_fehler = NULL,
        vorab_am = NULL, inkasso_wiedervorlage = NULL, inkasso_zusage_am = NULL,
        notiz = LEFT(COALESCE(notiz || ' | ', '') || ${`Ratenpause ${tagDe(heute)}: ${tagDe(vorher)} → ${tagDe(jetzt)} (${grund})`}, 2000),
        updated_at = NOW()
      WHERE id = ${r.id} AND status = 'offen'
      RETURNING id
    `) as any[];
    if (neu) verschoben.push({ nr: Number(r.rate_nr), vorher, jetzt });
  }
  if (verschoben.length === 0) return { ok: false, fehler: "Die Raten haben sich zwischenzeitlich geändert — bitte die Akte neu laden." };

  const erste = verschoben[0];
  const monatText = monate === 1 ? "einen Monat" : `${monate} Monate`;
  const meldung = `Ratenpause: ${monatText} ausgesetzt. Rate ${erste.nr} ist jetzt am ${tagDe(erste.jetzt)} fällig`
    + (verschoben.length > 1 ? `, die ${verschoben.length - 1} folgenden rücken mit` : "")
    + ". Mahnstufe und Überfälligkeit sind zurückgesetzt — bis dahin gehen keine Erinnerungen raus.";
  // Der Weg über das Ratenergebnis schreibt den Verlauf selbst (mit Grund) — hier nur,
  // wenn jemand die Pause direkt setzt.
  if (ein.verlauf !== false) {
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ein.ref}, ${ein.agentId}, ${ein.agentName}, 'system',
              ${`${meldung} Grund: ${grund} (von ${ein.agentName}).`})
    `.catch(() => {});
  }
  console.log(`[RATENPAUSE] ${ein.ref}: ${monate} Monat(e), ${verschoben.length} Raten — ${ein.agentName}: ${grund}`);
  return { ok: true, monate, verschoben, meldung };
}
