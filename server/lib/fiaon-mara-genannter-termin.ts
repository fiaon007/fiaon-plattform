// ═══════════════════════════════════════════════════════════════════════════
// MARA TRÄGT EINEN VEREINBARTEN TERMIN EIN (19.10.2026, E-395)
//
// Justin (Fall #7131, Mail #7131): „Mara muss ab jetzt in mein Kalender den Termin eintragen, den Kunden
// einen guten Termin wünschen und sich zurücknehmen. Trainiere Mara auf genau sowas!“
//
// Die Erkennung ist rein (shared/fiaon-genannter-termin.ts). Hier: Daten lesen, den Teilnehmer wählen,
// eintragen, Spuren schreiben — und dem Modell sagen, was schon geschehen ist und wie es antwortet.
// Der SERVER trägt ein, nie das Modell (Muster E-236: „Wer anruft, entscheidet der Server“).
//
// Wer ist Teilnehmer — in dieser Reihenfolge:
//   1. der Name aus der Team-Notiz oder aus seinem Text („mit Justin“ → 928)
//   2. Firmenthema (Firmenkredit, Global …) ohne Namen → Justin (Einstellung gruender_termin_agent_id, sonst 928)
//   3. sonst sein Betreuer (aktiv, nicht Forderungsmanagement)
//   4. sonst Justin
// Eingetragen wird mit `vereinbart: true` (terminBuchen): keine 2-Stunden-Vorlaufzeit, kein Raster — der
// Termin IST vereinbart, Mara bucht keinen neuen Platz. Vergangenheit, Doppelbuchung und Überschneidung
// bleiben gesperrt. Nicht in MARA_EIGENE_HERKUNFT: Mara verschiebt so einen Termin nie selbst.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  genannterTermin, istTeamNotiz,
  type GenanntErgebnis, type TeamNotiz, type TerminMitarbeiter, type BestehenderTerminKurz,
} from "@shared/fiaon-genannter-termin";
import { zeitFuerKunde } from "@shared/fiaon-mara-ton";
import { nennform } from "@shared/fiaon-mitarbeiter-name";

type Lauf = typeof sqlPool;

export const GENANNT_HERKUNFT = "mara_mail_genannt";
/** Notiz-Arten, die ein Mensch aus dem Team schreibt (fiaon_contact_log.type). */
const NOTIZ_ARTEN = ["result", "note", "startgespraech", "kunde_anliegen_antwort"];

export interface GenanntLage {
  erkennung: GenanntErgebnis;
  /** In DIESEM Lauf neu eingetragen. */
  eingetragen: boolean;
  terminId: number | null;
  teilnehmer: { id: number; nom: string; dat: string } | null;
  /** „heute um 11 Uhr“ — so, wie der Kunde es liest. */
  kundenZeit: string | null;
  fehler: string | null;
  /** Der Block für Maras Auftrag (vorab). */
  hinweis: string | null;
  /** Für die Handlungsliste der Postmeister-Zeile. */
  handlung: string | null;
  /** Diese Antwort ist keine Zahlungsaufforderung — der Grund (wie zahlungsRuhe). */
  ruhe: string | null;
}

/** Die Notizen der letzten 14 Tage — Menschen aus dem Team, neueste zuerst. */
export async function teamNotizenLesen(personId: number, lauf: Lauf = sqlPool): Promise<TeamNotiz[]> {
  const zeilen = (await lauf`
    SELECT c.created_at AS am, c.note AS text, c.agent_id, c.agent_name
      FROM fiaon_contact_log c
     WHERE (c.person_id = ${personId}
            OR c.ref IN (SELECT ref FROM fiaon_applications WHERE person_id = ${personId}))
       AND c.created_at > NOW() - INTERVAL '14 days'
       AND c.voided_at IS NULL AND c.agent_id IS NOT NULL
       AND c.type = ANY(${NOTIZ_ARTEN})
       AND COALESCE(TRIM(c.note), '') <> ''
     ORDER BY c.created_at DESC LIMIT 40`.catch(() => [])) as any[];
  return zeilen
    .map((z) => ({ am: z.am, text: String(z.text ?? ""), agentId: z.agent_id == null ? null : Number(z.agent_id), agentName: z.agent_name ?? null }))
    .filter(istTeamNotiz);
}

/** Der Block „LETZTE GESPRÄCHSNOTIZEN DES TEAMS“ für Maras Auftrag — null, wenn es keine gibt. */
export function teamNotizenText(notizen: TeamNotiz[]): string | null {
  if (!notizen.length) return null;
  const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return notizen.slice(0, 8)
    .map((n) => `- [${fmt.format(new Date(n.am))}] ${n.agentName ?? "Team"}: „${String(n.text).replace(/\s+/g, " ").trim().slice(0, 400)}“`)
    .join("\n");
}

async function mitarbeiterLesen(lauf: Lauf): Promise<(TerminMitarbeiter & { rolle: string; roh: any })[]> {
  const zeilen = (await lauf`
    SELECT id, name, first_name, last_name, anrede, rolle FROM fiaon_agents
     WHERE active AND zugang_gesperrt_am IS NULL
       AND COALESCE(name, '') !~* '(prüfkonto|pruefkonto|demo)'`.catch(async () => (await lauf`
    SELECT id, name, first_name, last_name, anrede, rolle FROM fiaon_agents
     WHERE active AND COALESCE(name, '') !~* '(prüfkonto|pruefkonto|demo)'`))) as any[];
  return zeilen.map((a) => ({ id: Number(a.id), vorname: a.first_name ?? null, nachname: a.last_name ?? null, rolle: String(a.rolle ?? "agent"), roh: a }));
}

async function gruenderId(lauf: Lauf): Promise<number> {
  const [s] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'gruender_termin_agent_id'`.catch(() => [])) as any[];
  const n = Number(String(s?.value ?? "").replace(/"/g, ""));
  return Number.isInteger(n) && n > 0 ? n : 928;
}

async function notizSchreiben(personId: number, ref: string | null, text: string, lauf: Lauf): Promise<void> {
  const { akteRef } = await import("./fiaon-postmeister-werkzeuge");
  const r = await akteRef(personId, ref).catch(() => null);
  if (!r) return;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${r}, ${personId}, NULL, 'Postmeister', 'system', ${text.slice(0, 900)})`.catch(() => {});
}

function belegSatz(e: GenanntErgebnis): string {
  if (e.beleg === "notiz" && e.notiz) {
    const tag = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date(e.notiz.am));
    return `Beleg: Notiz von ${e.notiz.agentName ?? "einem Kollegen"} am ${tag}: „${String(e.notiz.text).replace(/\s+/g, " ").slice(0, 200)}“.`;
  }
  if (e.beleg === "kunde") return "Beleg: Er sagt selbst, dass das Gespräch mit uns ist.";
  return "";
}

const ZURUECK = `Danach NICHTS verkaufen: keine Karte, keine Kreditkarte, kein Wunschlimit, keine Partnerbank, keine Zahlungsbitte, kein Link, kein „wenn Sie später doch …“. Kurz und warm bleiben. Nächster Schritt: erledigt.`;

/**
 * Erkennen, eintragen, Spuren schreiben. Liefert null, wenn er keinen Termin nennt (oder einen vergangenen).
 * Fehler beim Eintragen brechen die Antwort nie ab — dann sagt der Hinweis, dass nichts eingetragen ist.
 */
export async function genannterTerminBehandeln(ein: {
  personId: number | null;
  ref: string | null;
  /** NUR sein eigener Teil der Mail (kontext.kundeText). */
  kundeText: string;
  postmeisterId?: number | null;
  jetzt?: Date;
  notizen?: TeamNotiz[];
}, lauf: Lauf = sqlPool): Promise<GenanntLage | null> {
  if (!ein.personId || !String(ein.kundeText ?? "").trim()) return null;
  const personId = ein.personId;
  const jetzt = ein.jetzt ?? new Date();
  const [person] = (await lauf`SELECT ist_test_am, assigned_agent_id FROM fiaon_persons WHERE id = ${personId}`.catch(() => [])) as any[];
  if (!person || person.ist_test_am) return null;

  const notizen = ein.notizen ?? await teamNotizenLesen(personId, lauf);
  const team = await mitarbeiterLesen(lauf);
  const bestehende = ((await lauf`
    SELECT id, beginn, agent_id, status FROM fiaon_termine
     WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW() - INTERVAL '1 hour'`.catch(() => [])) as any[])
    .map((t): BestehenderTerminKurz => ({ id: Number(t.id), beginn: t.beginn, agentId: Number(t.agent_id), status: String(t.status) }));

  const e = genannterTermin({ kundeText: ein.kundeText, jetzt, notizen, mitarbeiter: team, bestehende });
  if (e.art === "keiner" || e.art === "vergangen") return null;

  const lage: GenanntLage = {
    erkennung: e, eingetragen: false, terminId: null, teilnehmer: null, kundenZeit: null, fehler: null,
    hinweis: null, handlung: null, ruhe: "einen Termin, den er nennt — heute keine Zahlungsbitte und kein Verkauf",
  };
  const { parseBerlinInput } = await import("./fiaon-time");
  const beginn = e.wandzeit ? parseBerlinInput(e.wandzeit) : null;
  lage.kundenZeit = beginn ? zeitFuerKunde(beginn, jetzt) : (e.uhrzeit ? `um ${e.uhrzeit.replace(/:00$/, "")} Uhr` : null);
  const wann = lage.kundenZeit ?? "zur genannten Zeit";

  if (e.art === "steht_schon" && e.bestehend) {
    const a = team.find((x) => x.id === e.bestehend!.agentId);
    const nf = nennform(a?.roh ?? null);
    lage.teilnehmer = a ? { id: a.id, nom: nf.nom, dat: nf.dat } : null;
    lage.terminId = e.bestehend.id;
    lage.kundenZeit = zeitFuerKunde(new Date(e.bestehend.beginn), jetzt);
    lage.hinweis = `VEREINBARTER TERMIN — STEHT SCHON IM KALENDER (Termin #${e.bestehend.id}; nichts eintragen, kein Rückruf-Werkzeug): Er hat ${lage.kundenZeit} ein Gespräch${lage.teilnehmer ? ` mit ${lage.teilnehmer.dat}` : ""}. SO ANTWORTEST DU (Justin, 19.10.2026: „einen guten Termin wünschen und sich zurücknehmen“): Erledige sein übriges Anliegen wie sonst. Dann ein warmer Satz: „Ihr Gespräch ${lage.kundenZeit}${lage.teilnehmer ? ` mit ${lage.teilnehmer.dat}` : ""} steht bei uns — ich wünsche Ihnen ein richtig gutes Gespräch!“ ${ZURUECK}`;
    lage.handlung = `Genannter Termin ${lage.kundenZeit} steht schon (Termin #${e.bestehend.id}) — nichts eingetragen.`;
    return lage;
  }

  if (e.art === "mit_uns") {
    // Teilnehmer wählen.
    const aktiv = (id: number | null | undefined) => (id ? team.find((x) => x.id === Number(id) && x.rolle !== "inkasso") ?? null : null);
    let wer = aktiv(e.teilnehmerId);
    if (!wer && e.thema === "global") wer = aktiv(await gruenderId(lauf));
    if (!wer) wer = aktiv(person.assigned_agent_id);
    if (!wer) wer = aktiv(await gruenderId(lauf));
    if (wer && beginn) {
      const nf = nennform(wer.roh);
      lage.teilnehmer = { id: wer.id, nom: nf.nom, dat: nf.dat };
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        const b = await terminBuchen({
          personId, agentId: wer.id, beginn: e.wandzeit!, quelle: "agent_manuell", herkunft: GENANNT_HERKUNFT, vereinbart: true,
        }, lauf);
        lage.eingetragen = true;
        lage.terminId = b.id;
        lage.kundenZeit = zeitFuerKunde(new Date(b.beginn), jetzt);
        const notiz = `Vom Kunden in einer E-Mail genannt${ein.postmeisterId ? ` [Mail #${ein.postmeisterId}]` : ""}: „${String(ein.kundeText).replace(/\s+/g, " ").slice(0, 220)}“ — ${belegSatz(e) || "laut Kunde"}`;
        await lauf`UPDATE fiaon_termine SET notiz = ${notiz.slice(0, 1000)}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
        const { buchungMelden } = await import("./fiaon-termin-meldung");
        await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
        const { protokollieren } = await import("./fiaon-mara-termin");
        await protokollieren({
          art: "termin_eingetragen", kanal: "mail", personId, terminId: b.id,
          text: `Vereinbarten Termin eingetragen: ${b.datumText} ${b.uhrzeit} Uhr bei ${wer.roh.name} (${e.beleg === "notiz" ? "passt zur Team-Notiz" : "laut Kunde"}).`,
          daten: { beginn: b.beginn, beleg: e.beleg, thema: e.thema, mail: ein.postmeisterId ?? null },
        }, lauf);
        await notizSchreiben(personId, ein.ref, `Mara: Termin ${b.datumText} ${b.uhrzeit} Uhr mit ${wer.roh.name} eingetragen — der Kunde hat ihn in seiner Mail genannt${e.beleg === "notiz" && e.notiz ? `; passt zur Notiz von ${e.notiz.agentName}` : ""}.`, lauf);
        lage.handlung = `Vereinbarten Termin eingetragen: ${b.datumText} ${b.uhrzeit} Uhr bei ${wer.roh.name} (Termin #${b.id}).`;
      } catch (err: any) {
        lage.fehler = String(err?.message || err).slice(0, 160);
        await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ein Gespräch ${wann} mit ${wer.roh.name} — eintragen ging nicht (${lage.fehler}). Bitte selbst in den Kalender setzen.`, lauf);
        lage.handlung = `Genannter Termin ${wann} bei ${wer.roh.name} NICHT eingetragen: ${lage.fehler}`;
      }
    } else {
      lage.fehler = !beginn ? "Zeitpunkt unlesbar" : "kein Teilnehmer gefunden";
      lage.handlung = `Genannter Termin ${wann} nicht eingetragen: ${lage.fehler}`;
    }
    if (lage.eingetragen && lage.teilnehmer) {
      lage.hinweis = `VEREINBARTER TERMIN — VOM SERVER ERKANNT UND EINGETRAGEN (Termin #${lage.terminId}; nicht noch einmal buchen, kein Rückruf-Werkzeug): Er hat ${lage.kundenZeit} ein Gespräch mit ${lage.teilnehmer.dat}. ${belegSatz(e)} Der Termin steht jetzt im Kalender von ${lage.teilnehmer.dat}. SO ANTWORTEST DU (Justin, 19.10.2026: „einen guten Termin wünschen und sich zurücknehmen“): Erledige sein übriges Anliegen wie sonst (ein Storno nur, wenn er es ausdrücklich will). Dann genau ein warmer Satz: „Ihr Gespräch ${lage.kundenZeit} mit ${lage.teilnehmer.dat} ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!“ ${ZURUECK}`;
    } else {
      lage.hinweis = `GENANNTER TERMIN — NICHT EINGETRAGEN (${lage.fehler ?? "unbekannt"}): Er hat ${wann} ein Gespräch mit uns. Schreibe NICHT, dass es eingetragen ist. Wünsche ihm in einem Satz ein gutes Gespräch. ${ZURUECK}`;
    }
    return lage;
  }

  // Dritte oder unklar: nichts eintragen, gut wünschen, zurücknehmen. Bei „unklar“ sieht der Betreuer es in der Akte.
  if (e.art === "unklar") {
    await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ein Gespräch ${wann}, ohne dass klar ist, mit wem — nichts eingetragen. Falls es unser Termin ist: bitte selbst in den Kalender setzen.`, lauf);
  }
  lage.hinweis = e.art === "dritte"
    ? `ER NENNT EINEN TERMIN BEI DRITTEN (${wann}, z. B. Bank, Notar, Behörde): Wünsche ihm in einem Satz viel Erfolg. Schreibe NICHT, dass etwas eingetragen ist. In dieser Antwort nichts verkaufen und keine Zahlungsbitte.`
    : `ER NENNT EIN GESPRÄCH (${wann}), OHNE DASS KLAR IST, MIT WEM: Wünsche ihm in einem Satz ein gutes Gespräch. Schreibe NICHT, dass etwas eingetragen ist. In dieser Antwort nichts verkaufen und keine Zahlungsbitte.`;
  lage.handlung = `Genannter Termin ${wann} (${e.art === "dritte" ? "bei Dritten" : "unklar, mit wem"}) — nichts eingetragen.`;
  return lage;
}
