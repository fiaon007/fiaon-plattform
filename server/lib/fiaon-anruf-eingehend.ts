// ═══════════════════════════════════════════════════════════════════════════
// WENN DER KUNDE ANRUFT — wer geht ran?
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Der Vorgesetzte: „Wir brauchen jetzt die Funktion, die ich bei Twilio
// hinterlege, dass der Kunde uns auch anrufen kann. Wichtig: Wenn der Kunde
// anruft, muss stehen, wer dafür zuständig ist, damit der richtige rangeht!
// Irgendwie bauen, dass es smart ist und nicht stört!"
//
// ── „NICHT STÖREN" IST DIE SCHWIERIGE ANFORDERUNG ──────────────────────────
// Der naive Weg wäre, alle Browser klingeln zu lassen und den Schnellsten
// gewinnen. Das ist genau das Gegenteil von smart:
//
//   * Zehn Menschen werden unterbrochen, neun davon grundlos.
//   * Wer gerade selbst telefoniert, verliert den Faden.
//   * Der Kunde landet bei jemandem, der seine Akte nicht kennt und erst
//     fragen muss, worum es geht.
//
// Deshalb klingelt es GEZIELT: zuerst beim Zuständigen. Nur wenn der nicht da
// ist oder nicht rangeht, geht es weiter — und zwar an eine kleine, passende
// Gruppe, nicht an alle.
//
// ── DIE REIHENFOLGE DER ZUSTÄNDIGKEIT ──────────────────────────────────────
// Sie folgt der Frage „warum ruft dieser Mensch jetzt an?":
//
//   1. ÜBERFÄLLIGE RATE → das Forderungsmanagement.
//      Wer eine offene Rate hat und anruft, will fast immer darüber sprechen.
//      Und wer ihn schon dreimal angerufen hat, kennt den Fall.
//
//   2. STARTGESPRÄCH IN DEN NÄCHSTEN 24 STUNDEN → der Onboarding-Mensch.
//      „Ich schaffe es morgen nicht" ist der häufigste Anruf vor einem Termin.
//
//   3. BETREUENDER VERTRIEBSAGENT → er kennt die Vorgeschichte.
//
//   4. LETZTER GESPRÄCHSPARTNER (innerhalb von 14 Tagen).
//      Wer zuletzt mit ihm gesprochen hat, weiß, was offen war — auch ohne
//      formelle Zuständigkeit.
//
//   5. NIEMAND → die Ansage. Kein wildes Klingeln bei Unbeteiligten.
//
// ── WARUM DIESE DATEI UND NICHT DIE ROUTE ──────────────────────────────────
// Die Zuständigkeit wird an drei Stellen gebraucht: im TwiML-Webhook (wer
// klingelt), in der Oberfläche (wer wird angezeigt) und im Protokoll (wem wird
// der Anruf zugeordnet). Drei Fassungen wären drei Gelegenheiten, eine zu
// vergessen — AGENTS.md: eine Definition, ein Ort.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Wie lange nach einem Gespräch gilt jemand noch als Ansprechpartner? */
export const LETZTER_KONTAKT_TAGE = 14;

/** So lange klingelt es beim Zuständigen, bevor weitergegeben wird. */
export const KLINGELN_SEK = 20;

/** Und so lange bei der Gruppe danach. */
export const KLINGELN_GRUPPE_SEK = 25;

export interface Zustaendigkeit {
  /** Der Mensch, bei dem es zuerst klingelt. */
  agentId: number | null;
  agentName: string | null;
  agentVorname: string | null;
  /** Seine Rolle — sie entscheidet, wer als Nächstes dran ist. */
  rolle: string | null;
  /** Warum dieser Mensch? In Worten, für die Anzeige. */
  grund: string;
  /** Kurzform für die Protokollzeile. */
  grundKennung:
    | "offene_rate" | "startgespraech" | "betreuer" | "letzter_kontakt" | "niemand";
  /** Wer klingelt danach, wenn der Erste nicht rangeht? */
  weiterAn: { agentId: number; name: string }[];
  /** Der erkannte Kunde. */
  person: {
    id: number;
    name: string;
    paket: string | null;
    /** Seit wie vielen Tagen ist eine Rate offen? Null, wenn keine. */
    tageOffen: number | null;
    offenCents: number;
    /** Ein Startgespräch in den nächsten 24 Stunden? */
    terminBald: string | null;
  } | null;
}

/**
 * Die Nummer auf eine Form bringen, die sich vergleichen lässt.
 *
 * ── DIE SPALTE GAB ES SCHON ───────────────────────────────────────────────
 * Ich hatte einen eigenen Vergleich über `REGEXP_REPLACE` gebaut — und dann
 * gemessen, dass `fiaon_persons.phone_key9` genau das bereits enthält: die
 * letzten neun Ziffern, bei 3.097 Personen gefüllt, mit einem Index
 * (`fiaon_persons_phone_idx`) darauf.
 *
 * Eine zweite Fassung wäre nicht nur doppelt, sondern LANGSAMER: Ein
 * REGEXP_REPLACE über jede Zeile kann keinen Index nutzen. Bei einem
 * eingehenden Anruf hat man rund zwei Sekunden, bevor Twilio aufgibt.
 *
 * Warum neun Ziffern: Eine deutsche Mobilnummer hat nach der Vorwahl zehn oder
 * elf, eine Festnetznummer oft weniger. Neun ist die längste Länge, die bei
 * allen sicher vorhanden ist — und lang genug gegen falsche Treffer.
 */
export function nummerKern(roh: string): string | null {
  const ziffern = String(roh || "").replace(/\D/g, "");
  if (ziffern.length < 7) return null;
  return ziffern.slice(-9);
}

/**
 * Wer ist für diesen Anrufer zuständig?
 *
 * Gibt IMMER eine Antwort — auch für unbekannte Nummern. Dann steht
 * `agentId: null` und die Ansage übernimmt.
 */
export async function zustaendigFuer(
  anrufernummer: string, lauf: Lauf = sqlPool,
): Promise<Zustaendigkeit> {
  const leer: Zustaendigkeit = {
    agentId: null, agentName: null, agentVorname: null, rolle: null,
    grund: "Diese Nummer gehört zu keinem Kunden im System.",
    grundKennung: "niemand", weiterAn: [], person: null,
  };

  const kern = nummerKern(anrufernummer);
  if (!kern) return leer;

  // ── DEN KUNDEN FINDEN ─────────────────────────────────────────────────────
  // Über die letzten neun Ziffern, sowohl an der Person als auch an der
  // Bestellung. Ein Kunde, der bei der Bestellung eine andere Nummer angegeben
  // hat als später im Profil, soll trotzdem erkannt werden.
  const [p] = (await lauf`
    WITH treffer AS (
      SELECT p.id, p.assigned_agent_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, 'Unbekannt') AS name,
             (SELECT a.pack_name FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS paket,
             p.updated_at
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL
        AND (
          -- Die vorhandene, indexierte Spalte. Ein REGEXP_REPLACE hier wäre
          -- eine zweite Definition UND langsamer: kein Index nutzbar.
          p.phone_key9 = ${kern}
          -- Und die Nummer aus der Bestellung: Wer bei der Bestellung eine
          -- andere angegeben hat als später im Profil, wird trotzdem erkannt.
          OR EXISTS (
            SELECT 1 FROM fiaon_applications a
            WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND a.gdpr_deleted_at IS NULL
              AND (RIGHT(REGEXP_REPLACE(COALESCE(a.phone, ''), '[^0-9]', '', 'g'), 9) = ${kern}
                OR RIGHT(REGEXP_REPLACE(COALESCE(a.contact_phone, ''), '[^0-9]', '', 'g'), 9) = ${kern})
          )
        )
    )
    -- Bei mehreren Treffern der jüngst geänderte: Wenn zwei Personen dieselbe
    -- Nummer tragen, ist das fast immer eine noch nicht zusammengeführte
    -- Dublette, und die aktivere ist die richtige.
    SELECT * FROM treffer ORDER BY updated_at DESC NULLS LAST LIMIT 1
  `) as any[];

  if (!p) return leer;

  // ── DIE LAGE DIESES KUNDEN ────────────────────────────────────────────────
  const [lage] = (await lauf`
    SELECT
      (SELECT MIN(r.faellig_am) FROM fiaon_abo_raten r
         JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${p.id} AND a.merged_into IS NULL
          AND r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE) AS aelteste_offen,
      (SELECT COALESCE(SUM(r.betrag_cents), 0)::bigint FROM fiaon_abo_raten r
         JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${p.id} AND a.merged_into IS NULL
          AND r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE) AS offen_cents,
      (SELECT r.inkasso_agent_id FROM fiaon_abo_raten r
         JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${p.id} AND a.merged_into IS NULL
          AND r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE
          AND r.inkasso_agent_id IS NOT NULL
        ORDER BY r.faellig_am LIMIT 1) AS inkasso_agent_id,
      (SELECT t.agent_id FROM fiaon_termine t
        WHERE t.person_id = ${p.id} AND t.quelle = 'onboarding_call'
          AND t.status = 'gebucht' AND t.beginn BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        ORDER BY t.beginn LIMIT 1) AS termin_agent_id,
      (SELECT t.beginn::text FROM fiaon_termine t
        WHERE t.person_id = ${p.id} AND t.quelle = 'onboarding_call'
          AND t.status = 'gebucht' AND t.beginn BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        ORDER BY t.beginn LIMIT 1) AS termin_beginn,
      (SELECT k.agent_id FROM fiaon_calls k
        WHERE k.person_id = ${p.id} AND k.agent_id IS NOT NULL
          AND k.beginn >= NOW() - (${LETZTER_KONTAKT_TAGE} || ' days')::interval
        ORDER BY k.beginn DESC LIMIT 1) AS letzter_agent_id
  `) as any[];

  const tageOffen = lage?.aelteste_offen
    ? Math.max(0, Math.floor(
      (Date.now() - new Date(lage.aelteste_offen).getTime()) / 86_400_000))
    : null;

  const person = {
    id: Number(p.id),
    name: String(p.name),
    paket: p.paket ?? null,
    tageOffen,
    offenCents: Number(lage?.offen_cents ?? 0),
    terminBald: lage?.termin_beginn ?? null,
  };

  /** Einen Agenten laden — aber nur, wenn er aktiv und kein Testkonto ist. */
  const agentLaden = async (id: unknown) => {
    if (id == null) return null;
    const [a] = (await lauf`
      SELECT id, name, COALESCE(NULLIF(first_name, ''), name) AS vorname, rolle
      FROM fiaon_agents
      WHERE id = ${Number(id)} AND active AND NOT COALESCE(is_test_account, FALSE)
    `) as any[];
    return a ?? null;
  };

  // ── 1. ÜBERFÄLLIGE RATE ───────────────────────────────────────────────────
  if (tageOffen != null) {
    // Der zugeteilte Inkasso-Mensch, sonst der mit der kleinsten Last.
    const inkasso = await agentLaden(lage.inkasso_agent_id)
      ?? (await lauf`
        SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), a.name) AS vorname, a.rolle
        FROM fiaon_agents a
        WHERE a.active AND a.rolle = 'inkasso' AND NOT COALESCE(a.is_test_account, FALSE)
        ORDER BY (SELECT COUNT(*) FROM fiaon_abo_raten r
                   WHERE r.inkasso_agent_id = a.id AND r.status <> 'bezahlt')
        LIMIT 1
      `.then((r: any[]) => r[0] ?? null));

    if (inkasso) {
      // Weiter an die anderen Inkasso-Kollegen — nicht an den Vertrieb. Wer
      // wegen einer offenen Rate anruft, ist bei einem Vertriebsagenten
      // schlechter aufgehoben als in der Warteschlange.
      const kollegen = (await lauf`
        SELECT id, name FROM fiaon_agents
        WHERE active AND rolle = 'inkasso' AND id <> ${inkasso.id}
          AND NOT COALESCE(is_test_account, FALSE)
        ORDER BY id LIMIT 3
      `) as any[];
      return {
        agentId: Number(inkasso.id), agentName: String(inkasso.name),
        agentVorname: String(inkasso.vorname), rolle: String(inkasso.rolle),
        grund: `Rate seit ${tageOffen} ${tageOffen === 1 ? "Tag" : "Tagen"} offen`
          + ` (${(person.offenCents / 100).toFixed(2).replace(".", ",")} €)`,
        grundKennung: "offene_rate",
        weiterAn: kollegen.map((k) => ({ agentId: Number(k.id), name: String(k.name) })),
        person,
      };
    }
  }

  // ── 2. STARTGESPRÄCH IN DEN NÄCHSTEN 24 STUNDEN ───────────────────────────
  const onb = await agentLaden(lage?.termin_agent_id);
  if (onb) {
    const kollegen = (await lauf`
      SELECT id, name FROM fiaon_agents
      WHERE active AND rolle = 'onboarding' AND id <> ${onb.id}
        AND NOT COALESCE(is_test_account, FALSE)
      ORDER BY id LIMIT 3
    `) as any[];
    return {
      agentId: Number(onb.id), agentName: String(onb.name),
      agentVorname: String(onb.vorname), rolle: String(onb.rolle),
      grund: "Startgespräch steht in den nächsten 24 Stunden an",
      grundKennung: "startgespraech",
      weiterAn: kollegen.map((k) => ({ agentId: Number(k.id), name: String(k.name) })),
      person,
    };
  }

  // ── 3. DER BETREUENDE AGENT ───────────────────────────────────────────────
  const betreuer = await agentLaden(p.assigned_agent_id);
  if (betreuer) {
    // Weiter an die Vertriebsleitung — sie darf an jeden Kunden und kann
    // jede Frage beantworten.
    const leitung = (await lauf`
      SELECT id, name FROM fiaon_agents
      WHERE active AND rolle = 'vertriebsleiter' AND id <> ${betreuer.id}
        AND NOT COALESCE(is_test_account, FALSE)
      ORDER BY id LIMIT 2
    `) as any[];
    return {
      agentId: Number(betreuer.id), agentName: String(betreuer.name),
      agentVorname: String(betreuer.vorname), rolle: String(betreuer.rolle),
      grund: "Betreuender Ansprechpartner",
      grundKennung: "betreuer",
      weiterAn: leitung.map((k) => ({ agentId: Number(k.id), name: String(k.name) })),
      person,
    };
  }

  // ── 4. WER ZULETZT MIT IHM GESPROCHEN HAT ─────────────────────────────────
  const letzter = await agentLaden(lage?.letzter_agent_id);
  if (letzter) {
    return {
      agentId: Number(letzter.id), agentName: String(letzter.name),
      agentVorname: String(letzter.vorname), rolle: String(letzter.rolle),
      grund: `Hat innerhalb der letzten ${LETZTER_KONTAKT_TAGE} Tage mit ihm gesprochen`,
      grundKennung: "letzter_kontakt",
      weiterAn: [],
      person,
    };
  }

  // ── 5. NIEMAND ────────────────────────────────────────────────────────────
  // Bekannter Kunde, aber kein Zuständiger. Es klingelt NICHT wild bei allen:
  // Die Ansage bittet um eine Nachricht, und der Anruf steht im Protokoll.
  return {
    ...leer,
    person,
    grund: `${person.name} ist im System, hat aber keinen Ansprechpartner.`,
  };
}

/**
 * Den eingehenden Anruf festhalten — auch den unbeantworteten.
 *
 * ── WARUM AUCH DEN VERPASSTEN ──────────────────────────────────────────────
 * Ein Anruf, der nicht angenommen wurde, ist die wichtigste Information von
 * allen: Da wollte jemand etwas und hat es nicht bekommen. Ohne Eintrag ruft
 * niemand zurück.
 */
export async function eingehendProtokollieren(
  opts: {
    twilioSid: string;
    von: string;
    personId: number | null;
    agentId: number | null;
    grundKennung: string;
  },
  lauf: Lauf = sqlPool,
): Promise<number | null> {
  // ══════════════════════════════════════════════════════════════════════════
  // DIESE ZUORDNUNG IST EINE ABLEITUNG, KEIN NACHWEIS (19.08.2026)
  //
  // `zustaendigFuer()` beantwortet „wer SOLLTE rangehen": Inkasso-
  // Zuständigkeit, Termin in den nächsten 24 Stunden, BETREUER des Kunden, wer
  // zuletzt sprach. Wer tatsächlich abgenommen hat, weiß der Twilio-Webhook
  // nicht — er hat keine Sitzung.
  //
  // Deshalb landete in Lucas Böhnerts Gespräche-Tab ein Anruf, in dem Nikita
  // spricht: Der Kunde gehört Lucas, abgenommen hat Nikita.
  //
  // GEMESSEN: 149 eingehende Anrufe, bei 123 ist agent_id genau der Betreuer.
  //
  // Die Zuordnung bleibt (ohne sie fände niemand den Anruf), aber sie sagt ab
  // jetzt, was sie ist. Die Ansicht kennzeichnet solche Zeilen, und sobald
  // jemand das ERGEBNIS erfasst, wird die Herkunft auf „ergebnis" gehoben —
  // dann ist der Bearbeiter belegt, denn die Ergebnis-Route lehnt fremde
  // Anrufe ab.
  // ══════════════════════════════════════════════════════════════════════════
  const [r] = (await lauf`
    INSERT INTO fiaon_calls
      (person_id, agent_id, nummer, richtung, beginn, status, twilio_sid, created_at,
       zuordnung_herkunft, zustaendig_agent_id)
    VALUES (${opts.personId}, ${opts.agentId}, ${opts.von}, 'eingehend', NOW(),
            'laeuft', ${opts.twilioSid}, NOW(),
            'zustaendigkeit', ${opts.agentId})
    ON CONFLICT (twilio_sid) DO UPDATE
      SET person_id = COALESCE(EXCLUDED.person_id, fiaon_calls.person_id),
          agent_id = COALESCE(EXCLUDED.agent_id, fiaon_calls.agent_id),
          zustaendig_agent_id = COALESCE(EXCLUDED.zustaendig_agent_id,
                                         fiaon_calls.zustaendig_agent_id),
          updated_at = NOW()
    RETURNING id
  `.catch(() => [] as any[])) as any[];
  return r?.id != null ? Number(r.id) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANTWORT AN TWILIO
// ═══════════════════════════════════════════════════════════════════════════

const esc = (t: string) => String(t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Was Twilio tun soll, wenn ein Kunde anruft.
 *
 * ── ES KLINGELT GEZIELT, NICHT ÜBERALL ─────────────────────────────────────
 * Zuerst beim Zuständigen, zwanzig Sekunden. Das sind etwa fünf Klingeltöne —
 * lang genug, um ein Gespräch zu beenden und abzunehmen, kurz genug, dass der
 * Anrufer nicht das Gefühl hat, ins Leere zu rufen.
 *
 * Geht er nicht ran, folgt die kleine Gruppe aus `weiterAn` — parallel, weil
 * dort niemand mehr „der Richtige" ist und Warten nichts verbessert.
 *
 * ── DER ANRUFER ERFÄHRT, WOHIN ER KOMMT ────────────────────────────────────
 * Eine Ansage mit Namen („Ich verbinde Sie mit Diana") beruhigt mehr als
 * Musik: Der Mensch weiß, dass er richtig ist, und legt nicht auf.
 *
 * ── DIE AUFZEICHNUNG BRAUCHT EINE ANSAGE ───────────────────────────────────
 * Auch beim eingehenden Ruf. Wer aufzeichnet, ohne es zu sagen, verstößt gegen
 * §201 StGB — unabhängig davon, wer angerufen hat.
 *
 * ── KEIN ZWEITES „GUTEN TAG" ───────────────────────────────────────────────
 * Der erste Entwurf schrieb „Guten Tag." vor die Ansage. Die Aufzeichnungs-
 * ansage beginnt aber selbst mit einer Begrüßung — gemessen kam heraus:
 * „Guten Tag. Guten Tag. Dieses Gespräch wird zur Qualitätssicherung
 * aufgezeichnet." Ein Anrufer, der zweimal begrüßt wird, hört einer Maschine
 * zu.
 *
 * ── UND KEINE ERKLÄRUNGEN IM TwiML ─────────────────────────────────────────
 * Ich hatte diese Begründung erst als XML-Kommentar in die Antwort geschrieben.
 * Mein eigener Prüfstand hat sie gefunden: Er zählte „Guten Tag" zweimal —
 * einmal in der Ansage, einmal im Kommentar.
 *
 * Das war mehr als ein Zählfehler. Ein Kommentar in der Antwort geht MIT an
 * Twilio, und in diesem standen interne Messwerte. Erklärungen gehören in den
 * Quelltext, nicht in eine Nachricht an einen fremden Dienst.
 */
export function twimlEingehend(opts: {
  z: Zustaendigkeit;
  ansage: string;
  /** Wohin Twilio den Aufnahme-Hinweis schickt. */
  aufnahmeCallback: string;
  statusCallback: string;
  /** Wohin Twilio meldet, dass niemand rangegangen ist. */
  verpasstCallback: string;
}): string {
  const { z } = opts;

  // ── NIEMAND ZUSTÄNDIG: EINE EHRLICHE ANSAGE ─────────────────────────────
  // Kein wildes Klingeln bei Unbeteiligten. Der Anruf steht im Protokoll, und
  // jemand ruft zurück — das ist besser, als zehn Menschen zu unterbrechen,
  // von denen keiner helfen kann.
  if (z.agentId == null) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Guten Tag und willkommen bei Fiaon. Im Moment ist niemand erreichbar, der Ihr Anliegen kennt. Wir haben Ihre Nummer und rufen Sie zurück. Vielen Dank für Ihren Anruf.</Say>
  <Hangup/>
</Response>`;
  }

  const vorname = esc(z.agentVorname || "einem Kollegen");
  const ziele = [
    `<Client statusCallbackEvent="ringing answered">agent-${z.agentId}</Client>`,
  ];
  const gruppe = z.weiterAn
    .map((w) => `<Client>agent-${w.agentId}</Client>`)
    .join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">${esc(opts.ansage)} Ich verbinde Sie mit ${vorname}.</Say>
  <Dial timeout="${KLINGELN_SEK}" answerOnBridge="true"
        record="record-from-answer-dual"
        recordingStatusCallback="${esc(opts.aufnahmeCallback)}"
        action="${esc(opts.verpasstCallback)}"
        method="POST">
    ${ziele.join("\n    ")}
  </Dial>${gruppe ? `
  <Say language="de-DE" voice="Polly.Vicki">Einen Moment, ich versuche es bei einem Kollegen.</Say>
  <Dial timeout="${KLINGELN_GRUPPE_SEK}" answerOnBridge="true"
        record="record-from-answer-dual"
        recordingStatusCallback="${esc(opts.aufnahmeCallback)}"
        action="${esc(opts.verpasstCallback)}"
        method="POST">
      ${gruppe}
  </Dial>` : ""}
  <Say language="de-DE" voice="Polly.Vicki">Leider ist gerade niemand frei. Wir sehen Ihren Anruf und melden uns zurück. Vielen Dank.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Was Twilio als Nächstes tun soll, nachdem ein `<Dial>` beendet ist.
 *
 * ── WARUM DAS EINE EIGENE ANTWORT BRAUCHT ──────────────────────────────────
 * `action` wird IMMER aufgerufen — auch wenn das Gespräch erfolgreich war.
 * Antwortet man dort mit einer Ansage, hört der Kunde sie NACH dem Auflegen
 * des Agenten. Also: Bei Erfolg eine leere Antwort, damit die restliche
 * TwiML-Kette weiterläuft; bei Misserfolg nichts tun und die Kette
 * weiterlaufen lassen, die dann den nächsten `<Dial>` erreicht.
 */
export function twimlNachDial(dialStatus: string): string {
  // „completed" heißt: es wurde angenommen und normal beendet. Dann darf keine
  // weitere Ansage kommen — der Kunde hat aufgelegt oder der Agent.
  if (dialStatus === "completed" || dialStatus === "answered") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>`;
  }
  // Alles andere (no-answer, busy, failed): leere Antwort, damit Twilio in der
  // ursprünglichen TwiML weitermacht — dort steht der nächste Versuch.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response/>`;
}
