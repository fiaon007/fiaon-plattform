// ═══════════════════════════════════════════════════════════════════════════
// „DARAUS EINEN TERMIN MACHEN?“ — SERVERSEITE (19.10.2026, E-397)
//
// Die Erkennung ist rein (shared/fiaon-termin-aus-notiz.ts). Hier: Daten lesen, den Vorschlag fertig
// machen (Wochentag, Name) und — NUR nach dem Klick — eintragen.
//
// Zwei Schritte, zwei Wege:
//   1. terminVorschlagFuerNotiz — läuft beim Speichern einer Notiz mit (Kundenkarte, Akte, Telefon) und liefert
//      den Vorschlag in der Antwort. Er schreibt NICHTS.
//   2. terminAusNotizEintragen — POST /agent/crm/kunden/:personId/termin-aus-notiz. Rechnet den Vorschlag aus
//      derselben Notiz NEU und bucht nur, wenn Zeit und Teilnehmer gleich geblieben sind: Einen Termin im
//      Kalender eines Kollegen gibt es nur, wenn die Notiz ihn nennt („mit Justin“) — nie, weil die Seite es sagt.
//
// Gebucht wird wie im Kalender von Hand (POST /agent/termine): Quelle agent_manuell, die Art gilt, und
// `vereinbart: true` — der Termin IST am Telefon vereinbart, also gilt das Raster nicht (wie E-395).
// Herkunft „agent_notiz“: Man sieht später, dass der Termin aus einer Notiz kam.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { terminAusNotiz, type TerminAusNotizVorschlag } from "@shared/fiaon-termin-aus-notiz";
import type { BestehenderTerminKurz, TerminMitarbeiter } from "@shared/fiaon-genannter-termin";

type Lauf = typeof sqlPool;

export const NOTIZ_HERKUNFT = "agent_notiz";

export interface TerminVorschlag extends TerminAusNotizVorschlag {
  personId: number;
  /** „Montag, 20.10. um 11:00 Uhr“ */
  wannText: string;
  teilnehmerName: string;
  /** Die Notiz, aus der der Vorschlag kommt — geht beim Klick unverändert zurück. */
  notiz: string;
}

async function teamLesen(lauf: Lauf): Promise<(TerminMitarbeiter & { name: string })[]> {
  const zeilen = (await lauf`
    SELECT id, name, first_name, last_name FROM fiaon_agents
     WHERE active AND zugang_gesperrt_am IS NULL
       AND COALESCE(name, '') !~* '(prüfkonto|pruefkonto|demo)'`.catch(() => [])) as any[];
  return zeilen.map((a) => ({
    id: Number(a.id), vorname: a.first_name ?? null, nachname: a.last_name ?? null,
    name: String(a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.name ?? `#${a.id}`),
  }));
}

function wannText(wandzeit: string): string {
  const [tag, uhr] = wandzeit.split(" ");
  const [j, m, t] = tag.split("-").map(Number);
  const wt = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(j, m - 1, t)));
  return `${wt}, ${String(t).padStart(2, "0")}.${String(m).padStart(2, "0")}. um ${uhr} Uhr`;
}

/** Der Vorschlag zur gerade gespeicherten Notiz — oder null. Schreibt nichts, wirft nie. */
export async function terminVorschlagFuerNotiz(ein: {
  personId: number;
  notiz: string | null | undefined;
  schreiberId: number;
  jetzt?: Date;
}, lauf: Lauf = sqlPool): Promise<TerminVorschlag | null> {
  try {
    const notiz = String(ein.notiz ?? "").trim();
    if (!notiz || !ein.personId) return null;
    const team = await teamLesen(lauf);
    const bestehende = ((await lauf`
      SELECT id, beginn, agent_id, status FROM fiaon_termine
       WHERE person_id = ${ein.personId} AND status = 'gebucht' AND beginn > NOW() - INTERVAL '1 hour'`.catch(() => [])) as any[])
      .map((t): BestehenderTerminKurz => ({ id: Number(t.id), beginn: t.beginn, agentId: Number(t.agent_id), status: String(t.status) }));
    const v = terminAusNotiz({ notiz, jetzt: ein.jetzt ?? new Date(), schreiberId: ein.schreiberId, mitarbeiter: team, bestehende });
    if (!v) return null;
    const wer = team.find((a) => a.id === v.teilnehmerId);
    if (!wer) return null;
    return { ...v, personId: ein.personId, wannText: wannText(v.wandzeit), teilnehmerName: wer.name, notiz };
  } catch (err) {
    console.error("[TERMIN-AUS-NOTIZ] Vorschlag:", err);
    return null;
  }
}

export type EintragenErgebnis =
  | { ok: true; terminId: number; wannText: string; teilnehmerName: string; teilnehmerId: number; buchung: any }
  | { ok: false; error: string };

/** Nach dem Klick: Vorschlag neu rechnen, vergleichen, buchen. */
export async function terminAusNotizEintragen(ein: {
  personId: number;
  notiz: string;
  wandzeit: string;
  teilnehmerId: number;
  agent: { id: number; name: string };
  jetzt?: Date;
}, lauf: Lauf = sqlPool): Promise<EintragenErgebnis> {
  const v = await terminVorschlagFuerNotiz({ personId: ein.personId, notiz: ein.notiz, schreiberId: ein.agent.id, jetzt: ein.jetzt }, lauf);
  if (!v) return { ok: false, error: "In der Notiz steht kein künftiger Tag mit Uhrzeit — oder der Termin steht schon im Kalender." };
  if (v.wandzeit !== String(ein.wandzeit) || v.teilnehmerId !== Number(ein.teilnehmerId)) {
    return { ok: false, error: "Der Vorschlag passt nicht mehr zur Notiz. Bitte die Seite neu laden." };
  }
  const { terminBuchen, buchungAnwenden, TerminFehler } = await import("./fiaon-termine");
  try {
    const b = await terminBuchen({
      personId: ein.personId, agentId: v.teilnehmerId, beginn: v.wandzeit,
      quelle: "agent_manuell", herkunft: NOTIZ_HERKUNFT, artVomMitarbeiter: true, vereinbart: true,
    }, lauf);
    const notiz = `Aus der Gesprächsnotiz von ${ein.agent.name}: „${ein.notiz.replace(/\s+/g, " ").slice(0, 400)}“`;
    await lauf`UPDATE fiaon_termine SET notiz = ${notiz.slice(0, 1000)}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
    // Ein Termin im Kalender eines Kollegen hängt den Kunden nicht um (E-260: zuordnen: false).
    await buchungAnwenden(b, lauf, { zuordnen: v.teilnehmerId === ein.agent.id });
    if (v.teilnehmerId !== ein.agent.id) {
      const { buchungMelden } = await import("./fiaon-termin-meldung");
      await buchungMelden(b.id, b.beginn, "agent_manuell", lauf).catch(() => {});
    }
    return { ok: true, terminId: b.id, wannText: v.wannText, teilnehmerName: v.teilnehmerName, teilnehmerId: v.teilnehmerId, buchung: b };
  } catch (err: any) {
    if (err instanceof TerminFehler) return { ok: false, error: err.message };
    console.error("[TERMIN-AUS-NOTIZ] Eintragen:", err);
    return { ok: false, error: "Eintragen ging nicht. Bitte im Kalender von Hand anlegen." };
  }
}
