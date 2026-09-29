// ═══════════════════════════════════════════════════════════════════════════
// EIN TERMIN IST ERLEDIGT ODER DER KUNDE WAR NICHT DA — EINE REGEL, ZWEI TÜREN
// (29.09.2026, E-260)
//
// Bis heute stand diese Regel nur in der Route POST /agent/termine/:id/ergebnis
// (server/routes/fiaon-termin.ts). Justin ruft bis Freitag die Termine des
// ganzen Teams an — aber ein Chef-Cookie kommt über requireAgent nicht hinein,
// und /admin/termine/:id kennt nur „übergeben" (nimmt nach E-120 den Kunden mit)
// und „melden". Ein Termin, den Justin angerufen hat, blieb deshalb „gebucht",
// wurde nach 12 Stunden automatisch „verpasst" (runVerpassteTermine), und Mara
// entschuldigte sich beim Kunden für ein Gespräch, das stattgefunden hatte (B7).
//
// Jetzt steht der Kern hier, und BEIDE Routen rufen ihn:
//   · /agent/termine/:id/ergebnis   — nach der Prüfung darfAnKunde,
//   · /chef/mara/termine/:id/ergebnis — Reiter „Termine" im Mara-Steuerpult.
// Er ändert weder agent_id noch die Kundenzuordnung. Startgespräch und FIAON
// Global haben eigene Wege (Freischaltung, Firmen-Cockpit) und kommen hier
// nicht an — das prüfen die Routen davor.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatumText, berlinUhrzeit } from "./fiaon-termine";

export interface TerminErgebnisEin {
  terminId: number;
  personId: number;
  beginn: Date | string;
  ergebnis: "erledigt" | "verpasst";
  notiz?: string | null;
  /** Wer abschließt — steht im Verlauf der Akte. */
  akteur: { id: number | null; name: string };
}

/**
 * Status, erledigt_am und Notiz setzen; „verpasst" zählt wie ein erfolgloser
 * Anrufversuch (Zähler + Nicht-erreicht-Automatik), „erledigt" setzt ihn
 * zurück; ein Verlaufseintrag in der Akte. Gibt den Hinweis für die Oberfläche.
 */
export async function terminErgebnisSetzen(ein: TerminErgebnisEin): Promise<{ hinweis: string }> {
  const { terminId: id, ergebnis, notiz } = ein;
  // COALESCE: Eine fehlende Notiz ist keine Anweisung zum Löschen — dieselbe
  // Lehre wie im Onboarding-Weg (19.08.2026), hier stand sie noch nicht.
  await sqlPool`
    UPDATE fiaon_termine SET status = ${String(ergebnis)}, erledigt_am = NOW(),
           notiz = COALESCE(${notiz ? String(notiz).slice(0, 4000) : null}, notiz), updated_at = NOW()
    WHERE id = ${id}
  `;

  let hinweis = "Termin als erledigt vermerkt.";
  if (ergebnis === "verpasst") {
    await sqlPool`
      UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1, updated_at = NOW()
      WHERE id = ${ein.personId}
    `;
    const { automatikNachFehlversuch } = await import("./fiaon-nicht-erreicht");
    const wirkung = await automatikNachFehlversuch(Number(ein.personId));
    hinweis = `Nicht erschienen — zählt als erfolgloser Versuch.${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`;
  } else {
    const { erreichtZuruecksetzen } = await import("./fiaon-nicht-erreicht");
    await erreichtZuruecksetzen(Number(ein.personId));
  }

  const [ref] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${ein.personId} AND merged_into IS NULL AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  if (ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${ref.ref}, ${ein.akteur.id}, ${ein.akteur.name}, 'system',
              ${`Termin ${berlinDatumText(ein.beginn)} um ${berlinUhrzeit(ein.beginn)} Uhr: ${ergebnis === "erledigt" ? "erledigt" : "Kunde nicht erschienen"}.${notiz ? ` ${String(notiz).slice(0, 500)}` : ""}`},
              NOW())
    `.catch((e) => console.error(`[TERMIN] Verlaufseintrag zum Ergebnis von Termin ${id} nicht geschrieben — die Akte zeigt das Gespraech nicht:`, e));
  }
  return { hinweis };
}
