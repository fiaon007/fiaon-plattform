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
//
// E-401 (2/6, 19.10.2026): auch auf WhatsApp (`kanal: "whatsapp"`, server/lib/fiaon-whatsapp-mara.ts). Dort zählt der
// Termin nur, wenn er schon feststeht (genanntAufWhatsApp — das Aushandeln einer Zeit mit Mara bleibt der Rückruf-Weg,
// E-236), Herkunft mara_whatsapp_genannt, Protokoll mit Kanal und Nummer, Notiz „per WhatsApp genannt“. Eine Person mit
// Vertriebssperre (is_blocked) bekommt auf WhatsApp keinen Termin von Mara — ein Vermerk sagt es dem Menschen. Weil
// WhatsApp-Mara dieselbe Nachricht nach einem KI-Fehler erneut anfasst, schreibt sie je Nachricht höchstens einen
// Vermerk ([WhatsApp #id]). Das Mail-Verhalten ist unverändert (kanal fehlt = "mail").
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  genannterTermin, istTeamNotiz, genanntAufWhatsApp, genanntSatz, berlinWand, uhrzeitenGenannt, starkVereinbart,
  type GenanntErgebnis, type TeamNotiz, type TerminMitarbeiter, type BestehenderTerminKurz,
} from "@shared/fiaon-genannter-termin";
import { zeitFuerKunde } from "@shared/fiaon-mara-ton";
import { nennform } from "@shared/fiaon-mitarbeiter-name";

type Lauf = typeof sqlPool;

export const GENANNT_HERKUNFT = "mara_mail_genannt";
/** E-401 (2/6): derselbe Weg auf WhatsApp. */
export const GENANNT_HERKUNFT_WA = "mara_whatsapp_genannt";
export type GenanntKanal = "mail" | "whatsapp";
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
  /** E-401 (2/6): der Kanal, auf dem er den Termin genannt hat. */
  kanal: GenanntKanal;
  /** E-401: „HH:MM“ (Berlin) des eingetragenen bzw. schon stehenden Termins — so muss er in der Antwort stehen. */
  uhrzeitTermin: string | null;
  /** E-401: der eine warme Satz, den die Antwort sagen soll (auch der sichere Satz auf WhatsApp). */
  satz: string | null;
  /**
   * E-401 Nachbesserung: true = Mara nimmt sich zurück (kein Kartenlink, kein Zahlungslink, kein Verkaufswort). false nur,
   * wenn er SELBST nach Karte, Link oder Zahlung fragt (kundeFragtSelbst) — dann erfüllt sie seine Bitte sachlich.
   */
  zurueck: boolean;
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

async function notizSchreiben(personId: number, ref: string | null, text: string, lauf: Lauf, wa: { marke: string | null } | null = null): Promise<void> {
  const { akteRef } = await import("./fiaon-postmeister-werkzeuge");
  const r = await akteRef(personId, ref).catch(() => null);
  if (!r) return;
  const marke = wa?.marke ?? null;
  // E-401: Mit Marke („[WhatsApp #id]“) höchstens ein Vermerk je Nachricht — auch wenn Mara sie erneut anfasst.
  if (marke) {
    const [schon] = (await lauf`
      SELECT 1 FROM fiaon_contact_log WHERE person_id = ${personId} AND agent_id IS NULL AND type = 'system'
         AND created_at > NOW() - INTERVAL '3 days' AND POSITION(${marke} IN note) > 0 LIMIT 1`.catch(() => [])) as any[];
    if (schon) return;
  }
  const notiz = marke ? `${text.slice(0, 880)} ${marke}` : text.slice(0, 900);
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${r}, ${personId}, NULL, ${wa ? "Mara" : "Postmeister"}, 'system', ${notiz})`.catch(() => {});
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
 * E-401 Nachbesserung (Prüfer-Fund): Fragt er SELBST nach Karte, Link oder Zahlung, ist das Erfüllen seiner Bitte kein
 * Verkauf — Justins „sich zurücknehmen“ heißt „nichts anbieten“, nicht „seine Bitte nicht erfüllen“.
 */
const ZURUECK_GEFRAGT = `Er fragt SELBST nach Karte, Link oder Zahlung — das erfüllst du sachlich, wie sonst (den Link bzw. die Zahlungsseite), aber ohne zusätzliches Angebot, ohne Wunschlimit-Werbung, ohne „wenn Sie später doch …“. Kurz und warm bleiben.`;
/** E-401: auf WhatsApp endet die Nachricht mit dem guten Wunsch — nicht mit dem Link und der Frage, die der Auftrag sonst verlangt. */
const ZURUECK_WA = `Danach NICHTS verkaufen: keine Karte, keine Kreditkarte, kein Wunschlimit, keine Partnerbank, keine Zahlungsbitte, kein Link, keine Abschlussfrage, kein „wenn Sie später doch …“. Kurz und warm bleiben — diese Nachricht endet mit dem guten Wunsch, nicht mit einer Frage.`;

/**
 * Erkennen, eintragen, Spuren schreiben. Liefert null, wenn er keinen Termin nennt (oder einen vergangenen).
 * Fehler beim Eintragen brechen die Antwort nie ab — dann sagt der Hinweis, dass nichts eingetragen ist.
 */
export async function genannterTerminBehandeln(ein: {
  personId: number | null;
  ref: string | null;
  /** NUR sein eigener Teil der Mail (kontext.kundeText) bzw. seine offenen WhatsApp-Nachrichten ohne Knöpfe. */
  kundeText: string;
  postmeisterId?: number | null;
  jetzt?: Date;
  notizen?: TeamNotiz[];
  /** E-401 (2/6): "whatsapp" — sonst Mail (wie bisher). */
  kanal?: GenanntKanal;
  /** E-401: WhatsApp — die Nummer (Protokoll), die Nachricht (Beleg, ein Vermerk je Nachricht), unsere letzte Nachricht davor. */
  nummer?: string | null;
  waId?: number | null;
  letzteRaus?: string | null;
  /**
   * E-401: Wann er es geschrieben hat, wenn das nicht eben war (Nachricht aus einer Pause) — „morgen“ zählt ab dann.
   * Ob der Zeitpunkt schon vorbei ist, entscheidet weiter `jetzt`.
   */
  bezug?: Date | null;
  /** E-401 Nachbesserung: Er fragt selbst nach Karte, Link oder Zahlung — Mara erfüllt das (kein „zurücknehmen“ dafür). */
  kundeFragtSelbst?: boolean;
  /**
   * E-406 C1 (19.10.2026): Ein Anliegen aus dem Kundenbereich — dieselbe Regel wie die Mail (Kanal „mail“), nur der
   * Beleg heißt „Anliegen #…“, und „heute“/„morgen“ zählt ab dem Tag, an dem er es geschrieben hat (`am`): Ein
   * Anliegen kann nach einer KI-Pause oder über Nacht liegen. Fehlt es: alles wie bisher.
   */
  anliegen?: { id: number | null; am: Date | null } | null;
}, lauf: Lauf = sqlPool): Promise<GenanntLage | null> {
  if (!ein.personId || !String(ein.kundeText ?? "").trim()) return null;
  const personId = ein.personId;
  const jetzt = ein.jetzt ?? new Date();
  const kanal: GenanntKanal = ein.kanal === "whatsapp" ? "whatsapp" : "mail";
  const wa = kanal === "whatsapp";
  const anl = !wa && !!ein.anliegen;
  // E-406 C1: im Anliegen der Tag, an dem er schrieb (wie `bezug` auf WhatsApp).
  if (anl && ein.anliegen?.am && !ein.bezug) ein = { ...ein, bezug: ein.anliegen.am };
  // E-401: Ohne Uhrzeit kein genannter Termin — auf WhatsApp (jede Nachricht kommt hierher) dann gar keine Abfrage.
  if (wa && !uhrzeitenGenannt(ein.kundeText).length) return null;
  const [person] = (await lauf`SELECT ist_test_am, assigned_agent_id, COALESCE(is_blocked, FALSE) AS gesperrt FROM fiaon_persons WHERE id = ${personId}`.catch(() => [])) as any[];
  if (!person || person.ist_test_am) return null;

  const notizen = ein.notizen ?? await teamNotizenLesen(personId, lauf);
  const team = await mitarbeiterLesen(lauf);
  const bestehende = ((await lauf`
    SELECT id, beginn, agent_id, status FROM fiaon_termine
     WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW() - INTERVAL '1 hour'`.catch(() => [])) as any[])
    .map((t): BestehenderTerminKurz => ({ id: Number(t.id), beginn: t.beginn, agentId: Number(t.agent_id), status: String(t.status) }));

  const e = genannterTermin({ kundeText: ein.kundeText, jetzt: (wa || anl) && ein.bezug ? ein.bezug : jetzt, notizen, mitarbeiter: team, bestehende });
  if (e.art === "keiner" || e.art === "vergangen") return null;
  // E-401: Auf WhatsApp nur ein Termin, der schon feststeht — das Aushandeln mit Mara bleibt der Rückruf-Weg (E-236).
  if (wa && !genanntAufWhatsApp(e, { kundeText: ein.kundeText, letzteRaus: ein.letzteRaus ?? null }).gilt) return null;

  const lage: GenanntLage = {
    erkennung: e, eingetragen: false, terminId: null, teilnehmer: null, kundenZeit: null, fehler: null,
    hinweis: null, handlung: null, ruhe: "einen Termin, den er nennt — heute keine Zahlungsbitte und kein Verkauf",
    kanal, uhrzeitTermin: null, satz: null, zurueck: !ein.kundeFragtSelbst,
  };
  if (ein.kundeFragtSelbst) lage.ruhe = null;
  const { parseBerlinInput } = await import("./fiaon-time");
  const beginn = e.wandzeit ? parseBerlinInput(e.wandzeit) : null;
  // E-401: Kam seine Nachricht früher (bezug), kann der Zeitpunkt inzwischen vorbei sein — dann wie „vergangen“.
  if ((wa || anl) && ein.bezug && beginn && beginn.getTime() <= jetzt.getTime()) return null;
  lage.kundenZeit = beginn ? zeitFuerKunde(beginn, jetzt) : (e.uhrzeit ? `um ${e.uhrzeit.replace(/:00$/, "")} Uhr` : null);
  const wann = lage.kundenZeit ?? "zur genannten Zeit";
  const zurueck = ein.kundeFragtSelbst ? ZURUECK_GEFRAGT : wa ? ZURUECK_WA : ZURUECK;
  const waNotiz = wa ? { marke: ein.waId ? `[WhatsApp #${ein.waId}]` : null } : null;
  const wo = wa ? "per WhatsApp" : anl ? `in seinem Anliegen im Kundenbereich${ein.anliegen?.id ? ` [Anliegen #${ein.anliegen.id}]` : ""}` : "in seiner Mail";

  if (e.art === "steht_schon" && e.bestehend) {
    const a = team.find((x) => x.id === e.bestehend!.agentId);
    const nf = nennform(a?.roh ?? null);
    lage.teilnehmer = a ? { id: a.id, nom: nf.nom, dat: nf.dat } : null;
    lage.terminId = e.bestehend.id;
    lage.kundenZeit = zeitFuerKunde(new Date(e.bestehend.beginn), jetzt);
    lage.uhrzeitTermin = berlinWand(new Date(e.bestehend.beginn)).hhmm;
    lage.satz = genanntSatz({ art: e.art, eingetragen: false, zeit: lage.kundenZeit, mit: lage.teilnehmer?.dat ?? null });
    lage.hinweis = `VEREINBARTER TERMIN — STEHT SCHON IM KALENDER (Termin #${e.bestehend.id}; nichts eintragen, kein Rückruf-Werkzeug): Er hat ${lage.kundenZeit} ein Gespräch${lage.teilnehmer ? ` mit ${lage.teilnehmer.dat}` : ""}. SO ANTWORTEST DU (Justin, 19.10.2026: „einen guten Termin wünschen und sich zurücknehmen“): Erledige sein übriges Anliegen wie sonst. Dann ein warmer Satz: „${lage.satz}“ ${zurueck}`;
    lage.handlung = `Genannter Termin ${lage.kundenZeit} steht schon (Termin #${e.bestehend.id}) — nichts eingetragen.`;
    return lage;
  }

  // ── E-401 Nachbesserung (Prüfer-Fund): ER NENNT EINE ANDERE ZEIT ALS DEN TERMIN, DER STEHT ─────────────────────
  // Nur seine Aussage (keine Team-Notiz) und im Kalender steht schon ein künftiger Termin von ihm (nicht ±30 Minuten,
  // sonst wäre es „steht schon“): Er hat die Zeit vermutlich falsch im Kopf. Vorher buchte der Server einen ZWEITEN
  // Termin (ohne Raster) — und jede weitere Nachricht „wir haben … mit Justin“ noch einen. Jetzt: nichts eintragen,
  // den stehenden Termin nennen, ein Vermerk für den Menschen. Das deckelt auch „höchstens ein genannter Termin“.
  const kuenftig = bestehende.filter((b) => new Date(b.beginn).getTime() > jetzt.getTime())
    .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime());
  if (e.art === "mit_uns" && e.beleg === "kunde" && kuenftig.length) {
    const t = kuenftig[0];
    const a = team.find((x) => x.id === t.agentId);
    const nf = nennform(a?.roh ?? null);
    lage.teilnehmer = a ? { id: a.id, nom: nf.nom, dat: nf.dat } : null;
    lage.terminId = t.id;
    const steht = zeitFuerKunde(new Date(t.beginn), jetzt);
    lage.uhrzeitTermin = berlinWand(new Date(t.beginn)).hhmm;
    lage.fehler = "Es steht schon ein anderer Termin — nichts eingetragen";
    lage.satz = `Bei uns steht Ihr Gespräch ${steht}${lage.teilnehmer ? ` mit ${lage.teilnehmer.dat}` : ""} — meinen Sie diesen Termin?`;
    lage.hinweis = `ER NENNT EINE ANDERE ZEIT ALS SEIN TERMIN (nichts eingetragen, kein zweiter Termin): Er schreibt ${wann}; im Kalender steht sein Gespräch ${steht}${lage.teilnehmer ? ` mit ${lage.teilnehmer.dat}` : ""} (Termin #${t.id}). SO ANTWORTEST DU: Erledige sein übriges Anliegen wie sonst. Dann freundlich, sinngemäß: „${lage.satz}“ Schreib NICHT, dass ${wann} eingetragen ist. Will er wirklich eine andere Zeit, gilt der Termin-Weg (verschieben), nicht dieser. ${zurueck}`;
    await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ${wo} ein Gespräch ${wann}${lage.teilnehmer ? ` mit ${a?.roh?.name ?? lage.teilnehmer.nom}` : ""} — im Kalender steht aber schon sein Termin ${steht} (Termin #${t.id}). Nichts eingetragen, kein zweiter Termin. Bitte prüfen, welche Zeit gilt.`, lauf, waNotiz);
    lage.handlung = `Genannter Termin ${wann} NICHT eingetragen — es steht schon Termin #${t.id} (${steht}).`;
    return lage;
  }

  if (e.art === "mit_uns") {
    // Teilnehmer wählen.
    const aktiv = (id: number | null | undefined) => (id ? team.find((x) => x.id === Number(id) && x.rolle !== "inkasso") ?? null : null);
    let wer = aktiv(e.teilnehmerId);
    if (!wer && e.thema === "global") wer = aktiv(await gruenderId(lauf));
    if (!wer) wer = aktiv(person.assigned_agent_id);
    if (!wer) wer = aktiv(await gruenderId(lauf));
    // E-401: Vertriebssperre (is_blocked = kein Termin) — auf WhatsApp trägt Mara nichts ein; der Mensch entscheidet.
    if (wa && wer && beginn && person.gesperrt) {
      const nf = nennform(wer.roh);
      lage.teilnehmer = { id: wer.id, nom: nf.nom, dat: nf.dat };
      lage.fehler = "Vertriebssperre — nicht automatisch eingetragen";
      await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ${wo} ein Gespräch ${wann} mit ${wer.roh.name} — er hat die Vertriebssperre, deshalb nichts eingetragen. Falls es stimmt: bitte selbst prüfen und in den Kalender setzen.`, lauf, waNotiz);
      lage.handlung = `Genannter Termin ${wann} bei ${wer.roh.name} NICHT eingetragen: ${lage.fehler}`;
    } else if (wer && beginn && e.wandzeit && (await import("./fiaon-mara-ampel").then((m) => m.ampelRot("termin_eintragen", lauf === sqlPool ? undefined : lauf)).catch(() => false))) {
      // ── E-406 B3: Ampel „Termine eintragen“ auf Rot (Mara-Steuerpult) — Mara trägt nichts ein. Justin bekommt die Karte
      // „Termin eintragen?“ (fiaon-mara-aufraeumen.ts) mit genau dieser Buchung; der Kunde hört nur „ein gutes Gespräch“.
      const nf = nennform(wer.roh);
      lage.teilnehmer = { id: wer.id, nom: nf.nom, dat: nf.dat };
      lage.fehler = "Ampel rot — liegt der Geschäftsführung als Karte vor";
      const { terminRotKarteAnlegen } = await import("./fiaon-mara-aufraeumen");
      await terminRotKarteAnlegen({
        personId, ref: ein.ref, agentId: wer.id, agentName: String(wer.roh.name ?? nf.nom), wandzeit: e.wandzeit, beginn,
        herkunft: wa ? GENANNT_HERKUNFT_WA : GENANNT_HERKUNFT, vereinbart: e.beleg === "notiz" || !wa || starkVereinbart(ein.kundeText),
        kanal, kundeText: String(ein.kundeText), beleg: belegSatz(e) || "laut Kunde",
        quelle: wa ? (ein.waId ? `WhatsApp #${ein.waId}` : "WhatsApp") : (ein.postmeisterId ? `Mail #${ein.postmeisterId}` : "Mail"),
      }, lauf);
      await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ${wo} ein Gespräch ${wann} mit ${wer.roh.name} — „Termine eintragen“ steht auf Rot, deshalb nichts eingetragen. Die Karte „Termin eintragen?“ liegt im Mara-Steuerpult.`, lauf, waNotiz);
      lage.handlung = `Genannter Termin ${wann} bei ${wer.roh.name} NICHT eingetragen: ${lage.fehler}`;
    } else if (wer && beginn) {
      const nf = nennform(wer.roh);
      lage.teilnehmer = { id: wer.id, nom: nf.nom, dat: nf.dat };
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        // E-401 Nachbesserung (Prüfer-Fund): Auf WhatsApp bucht nur seine Aussage („mit Herrn …“) ohne Team-Notiz und ohne
        // „wie besprochen / vereinbart“ NICHT außerhalb des Rasters: Dann gelten die Arbeitszeiten des Mitarbeiters wie bei
        // jedem Rückruf (kein_slot → nichts eingetragen, ein Mensch sieht den Vermerk). Mit Notiz oder ausdrücklich
        // vereinbart (und in der Mail, E-395) bleibt es wie bisher: eingetragen, wie es feststeht.
        const belegt = e.beleg === "notiz" || !wa || starkVereinbart(ein.kundeText);
        const b = await terminBuchen({
          personId, agentId: wer.id, beginn: e.wandzeit!, quelle: "agent_manuell", herkunft: wa ? GENANNT_HERKUNFT_WA : GENANNT_HERKUNFT, vereinbart: belegt,
        }, lauf);
        lage.eingetragen = true;
        lage.terminId = b.id;
        lage.kundenZeit = zeitFuerKunde(new Date(b.beginn), jetzt);
        lage.uhrzeitTermin = berlinWand(new Date(b.beginn)).hhmm;
        const notiz = wa
          ? `Vom Kunden per WhatsApp genannt${ein.waId ? ` [WhatsApp #${ein.waId}]` : ""}: „${String(ein.kundeText).replace(/\s+/g, " ").slice(0, 220)}“ — ${belegSatz(e) || "laut Kunde"}`
          : anl
            ? `Vom Kunden in einem Anliegen im Kundenbereich genannt${ein.anliegen?.id ? ` [Anliegen #${ein.anliegen.id}]` : ""}: „${String(ein.kundeText).replace(/\s+/g, " ").slice(0, 220)}“ — ${belegSatz(e) || "laut Kunde"}`
            : `Vom Kunden in einer E-Mail genannt${ein.postmeisterId ? ` [Mail #${ein.postmeisterId}]` : ""}: „${String(ein.kundeText).replace(/\s+/g, " ").slice(0, 220)}“ — ${belegSatz(e) || "laut Kunde"}`;
        await lauf`UPDATE fiaon_termine SET notiz = ${notiz.slice(0, 1000)}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
        const { buchungMelden } = await import("./fiaon-termin-meldung");
        await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
        const { protokollieren } = await import("./fiaon-mara-termin");
        await protokollieren({
          art: "termin_eingetragen", kanal, personId, terminId: b.id, ...(wa ? { nummer: ein.nummer ?? null } : {}),
          text: `Vereinbarten Termin eingetragen: ${b.datumText} ${b.uhrzeit} Uhr bei ${wer.roh.name} (${e.beleg === "notiz" ? "passt zur Team-Notiz" : "laut Kunde"}).`,
          daten: wa
            ? { beginn: b.beginn, beleg: e.beleg, thema: e.thema, whatsapp: ein.waId ?? null }
            : anl ? { beginn: b.beginn, beleg: e.beleg, thema: e.thema, anliegen: ein.anliegen?.id ?? null }
            : { beginn: b.beginn, beleg: e.beleg, thema: e.thema, mail: ein.postmeisterId ?? null },
        }, lauf);
        await notizSchreiben(personId, ein.ref, `Mara: Termin ${b.datumText} ${b.uhrzeit} Uhr mit ${wer.roh.name} eingetragen — der Kunde hat ihn ${wo} genannt${e.beleg === "notiz" && e.notiz ? `; passt zur Notiz von ${e.notiz.agentName}` : ""}.`, lauf, waNotiz);
        lage.handlung = `Vereinbarten Termin eingetragen: ${b.datumText} ${b.uhrzeit} Uhr bei ${wer.roh.name} (Termin #${b.id}).`;
      } catch (err: any) {
        lage.fehler = String(err?.message || err).slice(0, 160);
        await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ein Gespräch ${wann} mit ${wer.roh.name} — eintragen ging nicht (${lage.fehler}). Bitte selbst in den Kalender setzen.`, lauf, waNotiz);
        lage.handlung = `Genannter Termin ${wann} bei ${wer.roh.name} NICHT eingetragen: ${lage.fehler}`;
      }
    } else {
      lage.fehler = !beginn ? "Zeitpunkt unlesbar" : "kein Teilnehmer gefunden";
      lage.handlung = `Genannter Termin ${wann} nicht eingetragen: ${lage.fehler}`;
    }
    if (lage.eingetragen && lage.teilnehmer) {
      lage.satz = genanntSatz({ art: e.art, eingetragen: true, zeit: lage.kundenZeit, mit: lage.teilnehmer.dat });
      lage.hinweis = `VEREINBARTER TERMIN — VOM SERVER ERKANNT UND EINGETRAGEN (Termin #${lage.terminId}; nicht noch einmal buchen, kein Rückruf-Werkzeug): Er hat ${lage.kundenZeit} ein Gespräch mit ${lage.teilnehmer.dat}. ${belegSatz(e)} Der Termin steht jetzt im Kalender von ${lage.teilnehmer.dat}. SO ANTWORTEST DU (Justin, 19.10.2026: „einen guten Termin wünschen und sich zurücknehmen“): Erledige sein übriges Anliegen wie sonst (ein Storno nur, wenn er es ausdrücklich will). Dann genau ein warmer Satz: „${lage.satz}“ ${zurueck}`;
    } else {
      lage.satz = genanntSatz({ art: e.art, eingetragen: false, zeit: wann, mit: null });
      lage.hinweis = `GENANNTER TERMIN — NICHT EINGETRAGEN (${lage.fehler ?? "unbekannt"}): Er hat ${wann} ein Gespräch mit uns. Schreibe NICHT, dass es eingetragen ist. Wünsche ihm in einem Satz ein gutes Gespräch. ${zurueck}`;
    }
    return lage;
  }

  // Dritte oder unklar: nichts eintragen, gut wünschen, zurücknehmen. Bei „unklar“ sieht der Betreuer es in der Akte.
  if (e.art === "unklar") {
    await notizSchreiben(personId, ein.ref, `Mara: Der Kunde nennt ein Gespräch ${wann}, ohne dass klar ist, mit wem — nichts eingetragen. Falls es unser Termin ist: bitte selbst in den Kalender setzen.`, lauf, waNotiz);
  }
  lage.satz = genanntSatz({ art: e.art, eingetragen: false, zeit: wann, mit: null });
  // E-401 Nachbesserung: Fragt er selbst nach Karte, Link oder Zahlung, erfüllt Mara das (ZURUECK_GEFRAGT) — sonst wie bisher.
  const ruheSatz = ein.kundeFragtSelbst ? ZURUECK_GEFRAGT : "In dieser Antwort nichts verkaufen und keine Zahlungsbitte.";
  lage.hinweis = e.art === "dritte"
    ? `ER NENNT EINEN TERMIN BEI DRITTEN (${wann}, z. B. Bank, Notar, Behörde): Wünsche ihm in einem Satz viel Erfolg. Schreibe NICHT, dass etwas eingetragen ist. ${ruheSatz}`
    : `ER NENNT EIN GESPRÄCH (${wann}), OHNE DASS KLAR IST, MIT WEM: Wünsche ihm in einem Satz ein gutes Gespräch. Schreibe NICHT, dass etwas eingetragen ist. ${ruheSatz}`;
  lage.handlung = `Genannter Termin ${wann} (${e.art === "dritte" ? "bei Dritten" : "unklar, mit wem"}) — nichts eingetragen.`;
  return lage;
}
