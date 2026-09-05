// ═══════════════════════════════════════════════════════════════════════════
// TERMINE — öffentliche Buchung und Agentensicht
//
// Zwei Welten in einer Datei, weil es dieselbe Sache ist:
//   ÖFFENTLICH  /api/fiaon/termin/... — kein Login, nur ein signiertes Token.
//               Der Kunde sieht freie Zeiten und bucht. Muster: die signierten
//               Rechnungs-Links (server/fiaon-invoice.ts).
//   AGENT       /api/fiaon/agent/termine/... — hinter requireAgent. Eigene
//               Termine sehen, Ergebnis dokumentieren, selbst welche anlegen.
//
// Die Regeln (Slots, Vorlauf, Besitzschutz, Doppelbuchung) stehen ALLE in
// server/lib/fiaon-termine.ts. Hier steht nur, wer was darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import {
  buchungAnwenden, freieSlots, stornoLink, terminAbsagen, terminBuchen,
  terminTokenPruefen, verfuegbarkeitSetzen, verfuegbarkeitVon,
  berlinDatumText, berlinUhrzeit, TerminFehler,
  HORIZONT_TAGE, SLOT_MINUTEN, VORLAUF_STUNDEN, dauerFuer,
  versuchProtokollieren, herkunftPruefen,
} from "../lib/fiaon-termine";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { anrufHinweisSie, ABSAGE_HINWEIS_SIE } from "../../shared/fiaon-termin-text";

const router = Router();

// ───────────────────────────────────────────────────────────────────────────
// Gemeinsam: Bestätigungsmail nach einer Buchung
// ───────────────────────────────────────────────────────────────────────────
async function bestaetigungSenden(buchung: Awaited<ReturnType<typeof terminBuchen>>): Promise<void> {
  const [p] = (await sqlPool`
    SELECT COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1
           )) AS email,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p WHERE p.id = ${buchung.personId}
  `) as any[];
  if (!p) return;
  await versendenUndProtokollieren(
    "termin_bestaetigung",
    {
      email: String(p.email || ""),
      vorname: p.vorname || null,
      nachname: p.nachname || null,
      agent_vorname: buchung.agentVorname,
      termin_datum: buchung.datumText,
      termin_uhrzeit: buchung.uhrzeit,
      // ── DIE ART GEHT MIT IN DIE MAIL (30.08.2026) ──────────────────────
      // Der Kunde soll in der Bestätigung lesen, um welches Gespräch es geht.
      // Der Wert kommt aus derselben Ableitung wie die Marke in der
      // Oberfläche — sonst steht in der Mail etwas anderes als auf der Seite.
      //
      // BETREIBER-TODO: In Brevo als {{params.termin_art}} einsetzen. Solange
      // das nicht geschehen ist, wird das Feld übertragen und nicht angezeigt
      // — es schadet nichts und wartet.
      termin_art: terminArtAusQuelle(buchung.quelle).text,
      storno_link: stornoLink(buchung.stornoToken),
      // ── „WIR RUFEN AN" ALS FERTIGER SATZ (19.08.2026) ──────────────────
      // Der Kunde, der einen Videokonferenz-Link erwartet, sitzt zur
      // vereinbarten Zeit vor seinem Rechner, während das Telefon klingelt.
      // Der Satz kommt AUSFORMULIERT mit, damit die Brevo-Vorlage ihn nur
      // einsetzen muss: {{params.hinweis_anruf}}
      //
      // Warum fertig und nicht in der Vorlage geschrieben: Dann stünde er
      // zweimal im Haus — einmal im Portal, einmal bei Brevo — und die beiden
      // würden auseinanderlaufen. Die eine Fassung steht in
      // shared/fiaon-termin-text.ts.
      hinweis_anruf: anrufHinweisSie(buchung.agentVorname),
      hinweis_absage: ABSAGE_HINWEIS_SIE,
    },
    {
      personId: buchung.personId,
      verlaufRef: p.ref || null,
      verlaufText: `Terminbestätigung versandt (${buchung.datumText} um ${buchung.uhrzeit} Uhr).`,
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — kein Login
// ═══════════════════════════════════════════════════════════════════════════

/** GET /termin/:token — freie Slots für diese Person. */
router.get("/termin/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = terminTokenPruefen(req.params.token);
    if (!geprueft) return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig." });
    if (geprueft.abgelaufen) {
      return res.status(410).json({ ok: false, error: "abgelaufen", hinweis: "Dieser Link ist nicht mehr gültig. Ihr Ansprechpartner meldet sich bei Ihnen." });
    }

    const [person] = (await sqlPool`
      SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.is_blocked, p.merged_into_person_id
      FROM fiaon_persons p WHERE p.id = ${geprueft.personId}
    `) as any[];
    if (!person || person.merged_into_person_id) {
      return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig." });
    }

    // Schon einen Termin? Dann zeigt die Seite ihn statt einer neuen Auswahl.
    const [bestehend] = (await sqlPool`
      SELECT t.id, t.beginn, t.storno_token,
             COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', NULLIF(ag.first_name, ''), NULLIF(ag.last_name, '')))) AS agent_vorname
      FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      WHERE t.person_id = ${person.id} AND t.status = 'gebucht' AND t.beginn > NOW()
      ORDER BY t.beginn ASC LIMIT 1
    `) as any[];

    // ══════════════════════════════════════════════════════════════════════
    // DIE GESPRÄCHSART KOMMT AUS DEM ZUSTAND, NICHT AUS DER ADRESSE
    //
    // ── VORHER (bis 21.08.2026) ─────────────────────────────────────────
    //     const quelle = String(req.query.art) === "start"
    //       ? "onboarding_call" : "nichterreicht_mail";
    //
    // Ein Parameter in der Adresse entschied, welches Gespräch der Kunde
    // bekommt und damit, wer ihn anruft. Er war von aussen setzbar und wurde
    // in jeder Mail mitgeschleppt: Wer eine Einladung von VOR seiner Zahlung
    // aufrief, buchte ein Verkaufsgespräch über ein Paket, das er besitzt.
    //
    // ── JETZT ───────────────────────────────────────────────────────────
    // `freieSlots(..., "auto")` fragt `entscheidFuerPerson` — dieselbe
    // Ableitung, die die Annahme benutzt. Ein mitgeschicktes `?art=` wird
    // VERMERKT und verworfen, nicht befolgt.
    //
    // GEMESSEN: 25 von 41 Terminen seit dem 20.08. hätten eine andere
    // Gesprächsart bekommen, 23 lagen bei einer nicht zuständigen Rolle.
    // ══════════════════════════════════════════════════════════════════════
    const gewuenscht = String(req.query.art || "") === "start" ? "onboarding_call"
      : String(req.query.art || "") || null;
    const auskunft = await freieSlots(person.id, sqlPool, "auto");
    const quelle = auskunft.quelle ?? "nichterreicht_mail";
    if (gewuenscht && gewuenscht !== quelle) {
      console.log(`[TERMIN] Person ${person.id}: mitgeschickte Art „${gewuenscht}" verworfen, `
        + `abgeleitet ist „${quelle}" (zuständig: ${auskunft.zustaendig ?? "?"}).`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // KEINE ZEIT IN 14 TAGEN? DANN MELDEN WIR UNS (19.08.2026)
    //
    // ── DIE MELDUNG (Herr Hertel, telefonisch) ──────────────────────────
    // Ein Kunde kann keine Zeit wählen. Die Ursache war eine andere (die
    // Rollenprüfung), aber sie hat eine zweite Lücke sichtbar gemacht: Wäre
    // der Kalender WIRKLICH leer gewesen, hätte der Kunde einen freundlichen
    // Satz gesehen — und sonst wäre nichts passiert. Kein Mensch hätte davon
    // erfahren.
    //
    // Jetzt entsteht eine Aufgabe. Ein Kunde, der eine Zeit sucht und keine
    // findet, ist ein Kunde, der gleich anruft — oder abspringt.
    //
    // ── HÖCHSTENS EINE JE PERSON UND TAG ────────────────────────────────
    // Wer die Seite fünfmal neu lädt, erzeugt sonst fünf Aufgaben. Die
    // Bedingung im INSERT prüft das in derselben Anweisung; zwei gleichzeitige
    // Aufrufe können nicht beide gewinnen.
    if (auskunft.slots.length === 0 && !bestehend) {
      await sqlPool`
        INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend,
                                    status, autor_art, autor_name, faellig_am)
        SELECT 'aufgabe',
               (SELECT a.ref FROM fiaon_applications a
                 WHERE a.person_id = ${person.id} AND a.merged_into IS NULL
                 ORDER BY a.created_at DESC LIMIT 1),
               ${`Kunde ${person.vorname ?? ""} (Person ${person.id}) hat den Terminkalender `
                 + `geöffnet und KEINE freie Zeit gefunden (${quelle}). `
                 + "Bitte innerhalb von 24 Stunden telefonisch einen Termin vereinbaren — "
                 + "oder Zeitfenster im Kalender freigeben, damit er selbst wählen kann."},
               'betreiber', TRUE, TRUE, 'offen', 'system', 'Terminseite',
               (NOW() + INTERVAL '24 hours')::date
        WHERE NOT EXISTS (
          SELECT 1 FROM fiaon_vermerke v
          WHERE v.art = 'aufgabe' AND v.status = 'offen'
            AND v.autor_name = 'Terminseite'
            AND v.text LIKE ${`%Person ${person.id})%`}
            AND v.created_at > NOW() - INTERVAL '24 hours'
        )
      `.catch((e) => console.error("[TERMIN] Aufgabe bei leerem Kalender:", e));
      console.warn(`[TERMIN] Person ${person.id} sieht KEINE freie Zeit (${quelle}) — Aufgabe angelegt.`);
    }

    // ── DIE HERKUNFT REIST MIT (24.08.2026) ─────────────────────────────
    // VORHER kannte die Seite nur das Token — welcher WEG den Kunden
    // hergebracht hat, war nach dem Klick verloren. NACHHER nimmt der Link
    // `?von=` mit (terminLink), die Seite gibt es beim Buchen zurück, und dort
    // wird es als `herkunft` festgehalten. Sie ändert NICHTS an den
    // angebotenen Zeiten oder an der Rolle — das steht bewusst so hier, damit
    // niemand später auf die Idee kommt, sie in die Slot-Auswahl zu ziehen.
    const von = herkunftPruefen(req.query.von);

    res.json({
      ok: true,
      art: quelle,
      herkunft: von,
      // Die Zuständigkeit steht in der Antwort, damit die Seite dem Kunden
      // sagen kann, mit WEM er sprechen wird — und der Prüfstand es messen kann.
      zustaendig: auskunft.zustaendig ?? null,
      verworfen: gewuenscht && gewuenscht !== quelle ? gewuenscht : null,
      vorname: person.vorname || null,
      betreuer: auskunft.betreuer,
      slotMinuten: dauerFuer(quelle),
      vorlaufStunden: VORLAUF_STUNDEN,
      horizontTage: HORIZONT_TAGE,
      termin: bestehend
        ? {
            beginn: bestehend.beginn,
            datumText: berlinDatumText(bestehend.beginn),
            uhrzeit: berlinUhrzeit(bestehend.beginn),
            agentVorname: bestehend.agent_vorname,
            stornoToken: bestehend.storno_token,
          }
        : null,
      slots: auskunft.slots,
    });
  } catch (err) {
    console.error("[TERMIN] slots:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /termin/:token/buchen — der Kunde bucht. */
router.post("/termin/:token/buchen", async (req: Request, res: Response) => {
  // ══════════════════════════════════════════════════════════════════════════
  // JEDER AUSGANG DIESER ROUTE WIRD PROTOKOLLIERT (30.08.2026)
  //
  // Die Meldung „Buchung funktioniert unabhängig von der Uhrzeit nicht
  // zuverlässig" war nicht prüfbar: Ein Fehlschlag hinterließ nichts. Jetzt
  // schreibt JEDER Weg eine Zeile — der erfolgreiche auch, sonst gibt es keine
  // Quote.
  //
  // `ablehnen` bündelt beides: Protokollzeile und Antwort. Zwei getrennte
  // Aufrufe je Ausgang wären die Gelegenheit, an einem davon das Protokoll zu
  // vergessen — und dann fehlt genau der Fall, der die Meldung erklärt.
  // ══════════════════════════════════════════════════════════════════════════
  // ── DER WUNSCH DES CLIENTS IST KEINE ENTSCHEIDUNG (21.08.2026) ──────────
  // Vorher stand hier eine Erlaubnisliste, die aus dem Rumpf der Anfrage die
  // Gesprächsart ableitete. Damit konnte jeder, der die Anfrage selbst baut,
  // seine Gesprächsart bestimmen — und die Anzeige eine Zeile vorher hatte
  // etwas anderes angeboten. Genau die Trennung, die am 19.08. 213 Kunden
  // abgewiesen hat.
  //
  // `terminBuchen` leitet die Art jetzt selbst aus dem Zustand ab. Der Wunsch
  // wird nur noch zum Protokollieren mitgenommen.
  //
  // ══════════════════════════════════════════════════════════════════════════
  // DIE HERKUNFT VON AUSSEN IST NICHT MEHR FÄLSCHBAR (24.08.2026)
  //
  // ── DER FUND ────────────────────────────────────────────────────────────
  // VORHER reichte diese ÖFFENTLICHE Route `req.body.quelle` ungeprüft an
  // `terminBuchen` weiter (unten: `quelle: wunsch ?? "auto"`). Dort gibt es die
  // Ausnahme `eigenerRueckruf` (server/lib/fiaon-termine.ts): Bei
  // „agent_manuell" und „onboarding" wird die Ableitung aus dem Kundenzustand
  // ÜBERSPRUNGEN und der Wert unverändert gespeichert — und die
  // 2-Stunden-Vorlaufprüfung entfällt.
  //
  // Wirkung: Wer {"quelle":"agent_manuell"} sendet, erzeugt einen Termin, der
  // im Kalender als vom Mitarbeiter notierter „Rückruf" erscheint (die Marke
  // kommt aus derselben Spalte, shared/fiaon-termin-art.ts) — und der zudem in
  // der nächsten Minute liegen darf. Ein Fremder schreibt damit in den
  // Arbeitstag eines Mitarbeiters und tarnt es als dessen eigene Notiz.
  //
  // ── NACHHER ─────────────────────────────────────────────────────────────
  // Der Body-Wert wird VERWORFEN. Hier geht fest „auto" an `terminBuchen`,
  // damit die Ableitung arbeitet. Bewusst ein fester Wert und keine Sperrliste
  // gegen die zwei bekannten Werte: Käme in `eigenerRueckruf` je eine dritte
  // Ausnahme dazu, wäre die Lücke lautlos wieder offen.
  //
  // Der Wunsch geht weiter ins Protokoll (`versuchProtokollieren`) — was ein
  // Client wollte, bleibt nachlesbar, es entscheidet nur nichts mehr.
  //
  // Die Mitarbeiter-Route POST /agent/termine (weiter unten, hinter
  // `requireAgent`) behält „agent_manuell" — dort steht ein angemeldeter
  // Mensch dahinter, und genau das ist der Unterschied.
  // ══════════════════════════════════════════════════════════════════════════
  const { beginn, agentId, quelle, herkunft } = req.body || {};
  const gewuenscht = "auto";
  const wunsch = quelle ? String(quelle) : null;
  let personId: number | null = null;

  const ablehnen = async (grund: string, text: string, status = 409) => {
    await versuchProtokollieren({
      ergebnis: "abgelehnt", personId, slotBeginn: beginn ?? null,
      agentId: agentId ? Number(agentId) : null, grund,
      quelle: wunsch ?? "auto", akteur: "kunde",
    });
    return res.status(status).json({ ok: false, error: text, grund });
  };

  try {
    const geprueft = terminTokenPruefen(req.params.token);
    if (!geprueft || geprueft.abgelaufen) {
      return await ablehnen("link_ungueltig",
        "Dieser Link ist ungültig oder abgelaufen. Melde dich bitte bei deinem "
        + "Ansprechpartner — er schickt dir einen neuen.", 404);
    }
    personId = geprueft.personId;

    if (!beginn || !agentId) {
      return await ablehnen("keine_auswahl", "Bitte wähle zuerst eine Zeit aus.", 400);
    }

    // Der Kunde darf nur Slots buchen, die ihm auch angeboten wurden — sonst
    // ließe sich der Besitzschutz umgehen, indem man einen fremden Agenten
    // in die Anfrage schreibt.
    const auskunft = await freieSlots(geprueft.personId, sqlPool, gewuenscht);
    const erlaubt = auskunft.slots.some(
      (s) => s.beginn === new Date(beginn).toISOString() && s.agentId === Number(agentId),
    );
    if (!erlaubt) {
      // ── DER GRUND, DEN DER KUNDE VERSTEHT ────────────────────────────────
      // „Dieser Termin ist nicht mehr frei" war richtig, aber unvollständig:
      // Der Satz sagt nicht, was jetzt zu tun ist. Und er trifft zwei Lagen —
      // der Slot wurde gerade vergeben, oder er ist aus dem Angebot gefallen
      // (Vorlauf abgelaufen, während die Seite offen lag).
      const nochFrei = auskunft.slots.length;
      return await ablehnen("nicht_angeboten",
        nochFrei > 0
          ? "Dieser Termin wurde gerade vergeben — bitte wähle einen anderen. "
            + `Es stehen noch ${nochFrei} Zeiten zur Auswahl.`
          : "Dieser Termin wurde gerade vergeben, und im Moment sind alle anderen "
            + "Zeiten belegt. Lade die Seite in ein paar Minuten neu oder melde dich "
            + "bei deinem Ansprechpartner.");
    }

    if (wunsch && wunsch !== "auto") {
      // Der Wunsch entscheidet nichts mehr — aber er soll nachlesbar bleiben.
      console.log(`[TERMIN] Person ${geprueft.personId}: mitgeschickte Quelle „${wunsch}" `
        + "aus dem Anfragerumpf verworfen (öffentliche Route bucht immer „auto“).");
    }
    const buchung = await terminBuchen({
      personId: geprueft.personId,
      agentId: Number(agentId),
      beginn: String(beginn),
      // ── FEST „auto" (24.08.2026) ──────────────────────────────────────────
      // VORHER: `quelle: wunsch ?? "auto"` — der Body entschied mit und konnte
      // über `eigenerRueckruf` die Ableitung UND den Vorlauf aushebeln (siehe
      // den Block oben). NACHHER entscheidet ausschliesslich der Zustand des
      // Menschen; der Wunsch steht nur noch im Protokoll.
      quelle: "auto",
      // Die HERKUNFT dagegen darf mitkommen: Sie steuert nichts, sie beschreibt
      // nur den Weg — und ungültige Werte fallen in `herkunftPruefen` auf
      // „unbekannt", statt gespeichert zu werden, wie sie kamen.
      herkunft: herkunft ?? null,
    });
    await buchungAnwenden(buchung);
    await bestaetigungSenden(buchung);

    await versuchProtokollieren({
      ergebnis: "gebucht", personId: geprueft.personId, slotBeginn: beginn,
      agentId: Number(agentId), quelle: buchung.quelle, akteur: "kunde",
    });

    res.json({
      ok: true,
      termin: {
        datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
        agentVorname: buchung.agentVorname, stornoToken: buchung.stornoToken,
      },
    });
  } catch (err) {
    if (err instanceof TerminFehler) {
      // Der Code aus `TerminFehler` IST der Grund-Code — „belegt", „zu_frueh",
      // „kein_slot" und die anderen. Er wird nicht neu erfunden.
      return await ablehnen(err.code, err.message);
    }
    console.error("[TERMIN] buchen:", err);
    await versuchProtokollieren({
      ergebnis: "abgelehnt", personId, slotBeginn: beginn ?? null,
      agentId: agentId ? Number(agentId) : null, grund: "serverfehler",
      quelle: wunsch ?? "auto", akteur: "kunde",
    });
    res.status(500).json({
      ok: false,
      error: "Da ist bei uns etwas schiefgelaufen — nicht bei dir. Bitte versuche "
        + "es noch einmal; klappt es weiter nicht, melde dich bei deinem Ansprechpartner.",
      grund: "serverfehler",
    });
  }
});

/** POST /termin/absagen/:stornoToken — Absage durch den Kunden. */
router.post("/termin/absagen/:stornoToken", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.stornoToken || "");
    // Kein Format-Rätsel: Ein Storno-Token ist 48 Hex-Zeichen. Alles andere
    // spart der Datenbank die Anfrage.
    if (!/^[0-9a-f]{48}$/.test(token)) {
      return res.status(404).json({ ok: false, error: "Dieser Absage-Link ist ungültig." });
    }
    const ergebnis = await terminAbsagen(token, "kunde");
    if (!ergebnis.ok) {
      return res.status(404).json({ ok: false, error: "Dieser Termin wurde bereits abgesagt oder liegt zurück." });
    }
    // Umbuchen = absagen und neu buchen. Der frische Link kommt gleich mit,
    // damit der Kunde nicht in einer Sackgasse steht.
    const { terminLink } = await import("../lib/fiaon-termine");
    // Bewusst OHNE Herkunft (24.08.2026): Wer nach einer Absage neu bucht, kam
    // ursprünglich über irgendeinen Weg — welchen, weiß dieser Link nicht mehr.
    // „unbekannt" ist hier ehrlicher als ein geratener Wert.
    res.json({ ok: true, neuBuchen: terminLink(Number(ergebnis.termin.person_id)) });
  } catch (err) {
    console.error("[TERMIN] absagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /termin/onboarding/:paymentRef — Buchungs-Token nach Antragsabschluss.
 *
 * Die Bestätigungsseite kennt nur die Zahlungsreferenz, nicht die Person. Statt
 * dort ein Token zu erzeugen (was jeder mit einer fremden Referenz könnte),
 * liefert der Server es — und nur für Bestellungen, die es wirklich gibt.
 */
router.get("/termin/onboarding/:paymentRef", async (req: Request, res: Response) => {
  try {
    const [row] = (await sqlPool`
      SELECT a.person_id FROM fiaon_applications a
      WHERE (a.payment_reference = ${req.params.paymentRef} OR a.ref = ${req.params.paymentRef})
        AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 1
    `) as any[];
    if (!row?.person_id) return res.json({ ok: true, token: null });
    const { terminTokenErzeugen } = await import("../lib/fiaon-termine");
    res.json({ ok: true, token: terminTokenErzeugen(Number(row.person_id)) });
  } catch (err) {
    console.error("[TERMIN] onboarding:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════

/** GET /agent/termine — die eigenen Termine (heute und die nächsten Tage). */
router.get("/agent/termine", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rows = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.dauer_min, t.status, t.quelle, t.notiz,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             p.primary_phone, p.priority_tier, p.tier_reason
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.agent_id = ${req.agent!.id} AND p.merged_into_person_id IS NULL
        -- Dieselbe Grenze wie im Kalender (fiaon-agent.ts): Ein verpasster
        -- Termin bleibt, SOLANGE ihn niemand abgearbeitet hat. Danach ist er
        -- fertig. Zwei Listen mit zwei Auffassungen von „offen" wären genau
        -- der Widerspruch, den das Team gemeldet hat.
        AND (t.status = 'gebucht' OR (t.status = 'verpasst' AND t.erledigt_am IS NULL))
        AND t.beginn > NOW() - INTERVAL '14 days'
      ORDER BY t.beginn ASC
      LIMIT 200
    `) as any[];
    res.json({
      ok: true,
      termine: rows.map((t) => {
        // ══════════════════════════════════════════════════════════════════
        // DIE TERMIN-ART FEHLTE GENAU HIER (19.08.2026)
        //
        // ── DIE MELDUNG (Daniel Stripling) ───────────────────────────────
        // „Bei mir werden teilweise Termine von Kunden angezeigt, die bereits
        // bezahlt haben. Aktuell ist nicht eindeutig ersichtlich, welcher
        // Bereich für den jeweiligen Termin zuständig ist. Eine eindeutige
        // Kennzeichnung wie ‚Vertrieb' / ‚Onboarding' wäre hier sehr hilfreich."
        //
        // ── WARUM ER SIE NICHT SAH, OBWOHL ES SIE GIBT ───────────────────
        // Die Ableitung `shared/fiaon-termin-art.ts` existiert seit dem
        // 30.08.2026 und wird an FÜNF Stellen benutzt: Kalender, Termin-
        // Zentrale, Startgespräch-Liste, fällige Rückrufe, Onboarding-Liste.
        //
        // Diese Route war die sechste — und die einzige, die das Feld NICHT
        // mitschickte. Sie speist die obere Leiste auf `/agent/start`, also
        // genau die Ansicht, die ein Vertriebsmitarbeiter den ganzen Tag
        // offen hat. Der Fix von damals lag also im Code, war an fünf Stellen
        // sichtbar — nur nicht an der, die das Team benutzt.
        // ══════════════════════════════════════════════════════════════════
        const art = terminArtAusQuelle(t.quelle);
        return {
          id: Number(t.id),
          personId: Number(t.person_id),
          name: t.name,
          telefon: t.primary_phone,
          beginn: t.beginn,
          datumText: berlinDatumText(t.beginn),
          uhrzeit: berlinUhrzeit(t.beginn),
          dauerMin: Number(t.dauer_min),
          status: t.status,
          quelle: t.quelle,
          notiz: t.notiz,
          tier: Number(t.priority_tier),
          tierGrund: t.tier_reason,
          heute: berlinDatumText(t.beginn) === berlinDatumText(new Date()),
          terminArt: art.art,
          terminArtText: art.text,
          terminArtTon: art.ton,
          terminArtErklaerung: art.erklaerung,
        };
      }),
    });
  } catch (err) {
    console.error("[TERMIN] agent liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/termine/:id/nicht-zustande — mit GRUND, und der Grund handelt
//
// Justin (24.08.2026): „wenn man aufs X klickt, eben wieder gefragt warum
// nicht, und entsprechend dann ein E-Mail-Event auslösen (aber auch die
// Funktion: Kunde löschen!)"
//
// VORHER kannte der Kalender nur „erledigt" und „verpasst". „Verpasst" hieß
// für JEDEN Fall dasselbe: Zähler hoch, fertig. Ob die Nummer falsch war, der
// Kunde abgesagt hat oder gar nicht mehr will — der Kunde bekam in allen drei
// Fällen dieselbe (oder gar keine) Nachricht.
// NACHHER entscheidet der Grund, was ausgelöst wird. Die Mailarten sind die
// vorhandenen; es entsteht KEINE zweite Versandlogik neben fiaon-versand.
//
// Wichtig: Der Vorgang wird IMMER dokumentiert, auch wenn der Versand
// scheitert (fehlender Make-Zweig). Ein Termin, der nicht zustande kam, darf
// nicht deshalb offen bleiben, weil eine Mail hängt.
// ═══════════════════════════════════════════════════════════════════════════
const NICHT_ZUSTANDE: Record<string, { art: string | null; hinweis: (name: string) => string; notiz: string }> = {
  nicht_erschienen: {
    art: "termin_verpasst",
    hinweis: (n) => `${n} hat den Link für einen neuen Termin bekommen.`,
    notiz: "Termin kam nicht zustande — nicht erschienen bzw. nicht abgenommen.",
  },
  nummer_falsch: {
    art: "number_update_request",
    hinweis: (n) => `${n} wurde gebeten, die Rufnummer zu berichtigen.`,
    notiz: "Termin kam nicht zustande — hinterlegte Rufnummer stimmt nicht.",
  },
  abgesagt: {
    art: "onboarding_einladung",
    hinweis: (n) => `${n} hat eine neue Einladung bekommen.`,
    notiz: "Termin kam nicht zustande — vom Kunden abgesagt bzw. passte nicht.",
  },
  kein_interesse: {
    // Kein Versand. Wer abgesagt hat, bekommt keine Aufforderung mehr.
    art: null,
    hinweis: (n) => `${n} ist gesperrt und erscheint bei niemandem mehr.`,
    notiz: "Termin kam nicht zustande — kein Interesse mehr, vom Kunden erklärt.",
  },
};

router.post("/agent/termine/:id/nicht-zustande", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const grund = String(req.body?.grund || "");
    const regel = NICHT_ZUSTANDE[grund];
    if (!regel) return res.status(400).json({ ok: false, error: "Unbekannter Grund." });

    const [termin] = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.agent_id, t.quelle, t.status,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Der Kunde') AS name
      FROM fiaon_termine t LEFT JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.id = ${id} AND t.status IN ('gebucht', 'verpasst')`) as any[];
    if (!termin) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });

    // Dieselbe Grenze wie beim Abhaken: eigener Termin, oder darfAnKunde.
    if (Number(termin.agent_id) !== req.agent!.id) {
      const { darfAnKunde, rolleVon } = await import("../lib/fiaon-kundenzugriff");
      if (!(await darfAnKunde(req.agent!.id, await rolleVon(req.agent!.id), Number(termin.person_id)))) {
        return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
      }
    }

    await sqlPool`
      UPDATE fiaon_termine
      SET status = 'verpasst', erledigt_am = NOW(),
          notiz = COALESCE(notiz || ' · ', '') || ${regel.notiz}, updated_at = NOW()
      WHERE id = ${id}`;
    await sqlPool`
      UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1, updated_at = NOW()
      WHERE id = ${termin.person_id}`.catch(() => {});

    // „Kunde will nicht mehr" sperrt — derselbe Weg wie „Kein Interesse" im
    // Vertrieb: Er verschwindet aus jeder Liste, die Daten bleiben.
    if (grund === "kein_interesse") {
      await sqlPool`
        UPDATE fiaon_persons SET is_blocked = TRUE, follow_up_date = NULL, updated_at = NOW()
        WHERE id = ${termin.person_id}`;
    }

    // Der Versand läuft über den EINEN Weg des Hauses (mailSenden): Er kennt
    // die Rollenrechte, baut den Terminlink selbst und schreibt ins
    // Zustellprotokoll. Eine zweite Versandlogik neben ihm wäre die zweite
    // Wahrheit, an der wir heute schon mehrfach hängengeblieben sind.
    let versandFehler: string | null = null;
    if (regel.art) {
      const { mailSenden } = await import("../lib/fiaon-mail-senden");
      const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
      const erg = await mailSenden({
        event: regel.art,
        personId: Number(termin.person_id),
        akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: (await rolleVon(req.agent!.id)) as any },
      }).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
      if (!(erg as any).ok) versandFehler = (erg as any).grund || "Die Nachricht konnte nicht gesendet werden.";
    }

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      SELECT a.ref, ${req.agent!.id}, ${req.agent!.name}, 'termin_nicht_zustande', ${regel.notiz}, NOW()
      FROM fiaon_applications a
      WHERE a.person_id = ${termin.person_id} AND a.merged_into IS NULL
      ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});

    res.json({
      ok: true,
      hinweis: versandFehler
        ? `Vermerkt. Die Nachricht ging NICHT raus: ${versandFehler}`
        : regel.hinweis(String(termin.name)),
    });
  } catch (err) {
    console.error("[TERMIN] nicht-zustande:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/termine/:id/ergebnis — erledigt oder nicht erschienen.
 *
 * „Nicht erschienen" zählt wie ein erfolgloser Anrufversuch: Der Kunde hat
 * einen Termin ausgemacht und ist nicht drangegangen — das ist dasselbe
 * Signal, und es muss in denselben Zähler. Sonst könnte jemand zehn Termine
 * platzen lassen, ohne dass die Automatik es je bemerkt.
 */
router.post("/agent/termine/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ergebnis, notiz } = req.body || {};
    if (!["erledigt", "verpasst"].includes(String(ergebnis))) {
      return res.status(400).json({ ok: false, error: "Ergebnis muss 'erledigt' oder 'verpasst' sein." });
    }
    // ══════════════════════════════════════════════════════════════════════
    // JEDER ZUSTÄNDIGE HAKT JEDEN TERMIN AB — EGAL, WER IHN GEBUCHT HAT
    //
    // ── DER BEFUND (16.08.2026) ───────────────────────────────────────────
    // Team: „Kundengebuchte Termine lassen sich nicht abhaken — nur die
    // selbst angelegten."
    //
    // Zwei Gründe standen in dieser einen Zeile:
    //
    //   `agent_id = req.agent.id`  Ein Termin, den der Kunde über seinen
    //                             Buchungslink gewählt hat, gehört dem
    //                             zugeteilten Betreuer. Wer den Kunden heute
    //                             betreut, weil zugeteilt wurde, bekam 404.
    //   `status = 'gebucht'`      GEMESSEN: 54 Termine stehen auf „verpasst",
    //                             weil ein Tageslauf sie nach zwölf Stunden
    //                             umsetzt. Die Liste zeigt sie („gebucht"
    //                             ODER „verpasst"), das Abhaken verlangte
    //                             „gebucht". Sie ließen sich also ansehen,
    //                             aber nie abschließen — und tauchten nach
    //                             jedem Neuladen wieder auf.
    //
    // Jetzt: Zuständigkeit über `darfAnKunde` (die EINE Definition, siehe
    // server/lib/fiaon-kundenzugriff.ts), und ein verpasster Termin darf
    // nachträglich auf „erledigt" gesetzt werden — der Kunde hat sich
    // vielleicht abends doch gemeldet.
    // ══════════════════════════════════════════════════════════════════════
    const [termin] = (await sqlPool`
      SELECT id, person_id, beginn, agent_id, quelle, status FROM fiaon_termine
      WHERE id = ${id} AND status IN ('gebucht', 'verpasst')
    `) as any[];
    if (!termin) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });

    if (Number(termin.agent_id) !== req.agent!.id) {
      const { darfAnKunde, rolleVon } = await import("../lib/fiaon-kundenzugriff");
      const rolle = await rolleVon(req.agent!.id);
      if (!(await darfAnKunde(req.agent!.id, rolle, Number(termin.person_id)))) {
        return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // EIN STARTGESPRÄCH NIMMT DEN ONBOARDING-WEG (22.08.2026, E-022 / K2)
    //
    // Dieser Haken setzte bei einem `onboarding_call` nur `erledigt` — ohne
    // Freischaltung, ohne Gutschrift, ohne Nachricht an den Kunden. Der
    // Kalender war damit eine zweite Tür zur selben Handlung, und die
    // folgenlose. Jetzt führt sie in denselben Raum.
    // ══════════════════════════════════════════════════════════════════════
    if (String(termin.quelle) === "onboarding_call") {
      const { startgespraechErgebnis } = await import("./fiaon-onboarding-bereich");
      const erg = await startgespraechErgebnis({
        terminId: id, agent: { id: req.agent!.id, name: req.agent!.name },
        ergebnis, notiz, jederZustaendige: true,
      });
      return res.status(erg.status).json(erg.body);
    }

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
        WHERE id = ${termin.person_id}
      `;
      const { automatikNachFehlversuch } = await import("../lib/fiaon-nicht-erreicht");
      const wirkung = await automatikNachFehlversuch(Number(termin.person_id));
      hinweis = `Nicht erschienen — zählt als erfolgloser Versuch.${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`;
    } else {
      const { erreichtZuruecksetzen } = await import("../lib/fiaon-nicht-erreicht");
      await erreichtZuruecksetzen(Number(termin.person_id));
    }

    const [ref] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${termin.person_id} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Termin ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr: ${ergebnis === "erledigt" ? "erledigt" : "Kunde nicht erschienen"}.${notiz ? ` ${String(notiz).slice(0, 500)}` : ""}`},
                NOW())
      `.catch((e) => console.error(`[TERMIN] Verlaufseintrag zum Ergebnis von Termin ${id} nicht geschrieben — die Akte zeigt das Gespraech nicht:`, e));
    }
    res.json({ ok: true, hinweis });
  } catch (err) {
    console.error("[TERMIN] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EINEN TERMIN AN EINEN KOLLEGEN ÜBERGEBEN
//
// ── WARUM (Auftrag Betrieb, 21.08.2026) ───────────────────────────────────
// „Wird bei Krankheit/Rollenwechsel täglich gebraucht." Bisher ging es nur
// über einen direkten UPDATE in der Datenbank — also gar nicht, für alle außer
// einem Entwickler. Die Folge sind Termine, zu denen niemand erscheint.
//
// ── WAS DABEI PASSIERT ────────────────────────────────────────────────────
//   1. Der Grund ist PFLICHT. Ein umgehängter Termin ohne Grund ist am
//      nächsten Tag ein Rätsel — für den Übernehmenden und für den Betreiber.
//   2. Der alte Zuständige bleibt in `uebergeben_von` stehen. Kein
//      Hard-Delete der Zuordnung (AGENTS.md).
//   3. Der Kunde bekommt eine Info-Mail über `termin_bestaetigung` mit dem
//      NEUEN Ansprechpartner. Dieselbe Vorlage wie bei der Buchung: Ein
//      zweiter Brevo-Text für „fast dasselbe" läuft beim ersten Wortwechsel
//      auseinander.
//   4. Der neue Zeitpunkt bleibt derselbe. Wer die Zeit ändern will, sagt sie
//      ab und bucht neu — sonst steht der Kunde vor einer Verschiebung, der er
//      nie zugestimmt hat.
//
// ── WER DARF ─────────────────────────────────────────────────────────────
// Der bisherige Zuständige und die Leitung. Nicht jeder: Ein Termin, den
// beliebige Kollegen umhängen können, ist keine Zuständigkeit mehr.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// EINEN TERMIN VERSCHIEBEN
//
// ── DER BEFUND (Daniel und Florentine, 25.08.2026) ─────────────────────────
// „Bestehende Termine können aktuell nur als ‚erledigt' oder ‚nicht erledigt'
// markiert werden. Eine Funktion zum Verschieben fehlt. Es sollte bei einem
// bestehenden Termin direkt die Möglichkeit geben, Datum und Uhrzeit zu
// ändern, ohne den Termin komplett neu anlegen zu müssen."
//
// Sie haben recht — und zwar wörtlich: Es gab keine. Die vorhandene Route
// `/agent/calendar/:logId/reschedule` verschiebt Einträge im KONTAKTVERLAUF
// (Rückrufe, Zahlungszusagen), nicht die Termine in `fiaon_termine`. In der
// Oberfläche war „Verschieben" deshalb an `art !== "termin"` gebunden — bei
// einem echten Termin erschien der Knopf nie.
//
// ── WAS HIER ANDERS IST ALS BEIM NEU ANLEGEN ───────────────────────────────
// Der Termin behält seine Kennung, seinen Storno-Link und seine Geschichte.
// Ein Neuanlegen mit anschließender Absage hinterließe zwei Einträge und beim
// Kunden zwei Mails — eine Absage und eine Einladung, in beliebiger
// Reihenfolge im Postfach.
//
// ── DER KUNDE ERFÄHRT ES ───────────────────────────────────────────────────
// Wer eine Uhrzeit ändert, an die sich ein Mensch erinnert hat, muss es ihm
// sagen. Die Mail geht über dieselbe Strecke wie die Terminbestätigung.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/termine/:id/verschieben", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const rohBeginn = String(req.body?.beginn ?? "").trim();
    if (!Number.isFinite(id) || !rohBeginn) {
      return res.status(400).json({ ok: false, error: "Termin und neue Zeit werden gebraucht." });
    }

    const { parseBerlinInput } = await import("../lib/fiaon-time");
    const neu = parseBerlinInput(rohBeginn);
    if (!neu || Number.isNaN(new Date(neu).getTime())) {
      return res.status(400).json({ ok: false, error: "Die neue Zeit ist nicht lesbar." });
    }
    if (new Date(neu).getTime() < Date.now() - 60_000) {
      return res.status(400).json({ ok: false, error: "Die neue Zeit liegt in der Vergangenheit." });
    }

    const [t] = (await sqlPool`
      SELECT id, person_id, agent_id, beginn, dauer_min, quelle, status
      FROM fiaon_termine WHERE id = ${id}
    `) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
    if (t.status !== "gebucht") {
      return res.status(400).json({ ok: false, error: "Dieser Termin ist nicht mehr offen." });
    }

    // Wer darf? Der eigene Termin — oder die Leitung. Ein fremder Kalender ist
    // niemandes Sache.
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = String(await rolleVon(req.agent!.id));
    const eigen = Number(t.agent_id) === req.agent!.id;
    if (!eigen && rolle !== "admin" && rolle !== "vertriebsleiter") {
      return res.status(403).json({ ok: false, error: "Das ist der Termin einer Kollegin oder eines Kollegen." });
    }

    const alt = t.beginn;
    try {
      await sqlPool`UPDATE fiaon_termine SET beginn = ${neu}, erinnert_am = NULL WHERE id = ${id}`;
    } catch (err: any) {
      // 23P01 = exclusion_violation: die neue Zeit überschneidet einen anderen
      // Termin. Seit dem 25.08.2026 verbietet die Datenbank das selbst.
      if (String(err?.code) === "23P01") {
        return res.status(409).json({
          ok: false,
          error: `Zu dieser Zeit läuft schon ein Termin — ein Gespräch dauert ${t.dauer_min ?? 20} Minuten. `
            + "Bitte eine andere Zeit wählen.",
        });
      }
      if (String(err?.code) === "23505") {
        return res.status(409).json({ ok: false, error: "Diese Zeit ist bereits vergeben." });
      }
      throw err;
    }

    const wann = (d: any) => new Date(d).toLocaleString("de-DE",
      { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const [ap] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${t.person_id} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (ap) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, ref, created_at)
        VALUES (${t.person_id}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Termin verschoben: ${wann(alt)} → ${wann(neu)}.`}, ${ap.ref}, NOW())
      `.catch(() => {});
    }

    // Der Kunde erfährt die neue Zeit. Misslingt die Mail, ist der Termin
    // trotzdem verschoben — aber die Antwort sagt es, damit der Mitarbeiter
    // von sich aus anruft.
    let mailOk = false;
    try {
      const { mailSenden } = await import("../lib/fiaon-mail-senden");
      const erg = await mailSenden({
        event: "termin_bestaetigung",
        personId: Number(t.person_id),
        zusatz: { termin_datum: wann(neu), verschoben_von: wann(alt) },
        akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: rolle as any },
      });
      mailOk = !!(erg as any)?.ok;
    } catch { /* siehe oben */ }

    res.json({
      ok: true,
      beginn: neu,
      meldung: `Verschoben auf ${wann(neu)}.`,
      hinweis: mailOk
        ? "Der Kunde hat die neue Zeit per Mail bekommen."
        : "Die Bestätigungsmail ging nicht raus — bitte den Kunden kurz selbst informieren.",
    });
  } catch (err) {
    console.error("[TERMIN] verschieben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TERMIN ÜBERGEBEN — EINE FUNKTION, ZWEI TÜREN (05.09.2026, E-126)
//
// Bis heute lebte die Übergabe nur in der Mitarbeiter-Route. Als vier
// Mitarbeiter gesperrt wurden, hingen fünf Kundentermine an Menschen, die
// sich nicht mehr anmelden können — und die Leitung hatte keinen Weg, sie
// aus der Zentrale heraus zu verteilen. Jetzt steckt die Logik in
// `terminUebergeben`; die Mitarbeiter-Route und die Admin-Route
// (/admin/termine/:id/uebergeben) rufen sie mit unterschiedlichem „von".
// ═══════════════════════════════════════════════════════════════════════════
export async function terminUebergeben(ein: {
  terminId: number;
  zielId: number;
  grund: string;
  trotzdem: boolean;
  /** Wer übergibt — Mitarbeiter (id) oder Leitung aus der Zentrale (id null). */
  von: { id: number | null; name: string; rolle: string };
}): Promise<{ status: number; body: any }> {
  const id = ein.terminId;
  const zielId = ein.zielId;
  const grund = String(ein.grund ?? "").trim();
  const leitung = ["vertriebsleiter", "admin"].includes(ein.von.rolle);
  if (!zielId) return { status: 400, body: { ok: false, error: "Bitte einen Kollegen auswählen." } };
  if (grund.length < 5) {
    return { status: 400, body: { ok: false, error: "Bitte in einem Satz sagen, warum du übergibst — der Kollege liest ihn morgen früh." } };
  }
  const [termin] = (await sqlPool`
    SELECT id, person_id, agent_id, beginn, quelle, status, storno_token
    FROM fiaon_termine WHERE id = ${id} AND abgesagt_am IS NULL
  `) as any[];
  if (!termin) return { status: 404, body: { ok: false, error: "Termin nicht gefunden." } };
  if (Number(termin.agent_id) === zielId) {
    return { status: 400, body: { ok: false, error: "Der Termin liegt schon bei diesem Kollegen." } };
  }
  const darf = (ein.von.id != null && Number(termin.agent_id) === ein.von.id) || leitung;
  if (!darf) {
    return { status: 403, body: { ok: false, error: "Diesen Termin kann nur sein Zuständiger oder die Leitung übergeben." } };
  }
  const [ziel] = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, rolle, active, email
    FROM fiaon_agents
    WHERE id = ${zielId} AND active AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL
  `) as any[];
  if (!ziel) return { status: 404, body: { ok: false, error: "Diesen Kollegen gibt es nicht (mehr) — oder sein Zugang ist gesperrt." } };
  // Verfügbarkeit des Übernehmers: dieselbe Tabelle wie die Buchung
  // (fiaon_agent_verfuegbarkeit, ISO-Wochentag, Berlin-Zeit).
  const [vf] = (await sqlPool`
    SELECT EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = ${zielId} AND COALESCE(v.aktiv, TRUE)) AS hat_zeiten,
           EXISTS (
             SELECT 1 FROM fiaon_agent_verfuegbarkeit v
              WHERE v.agent_id = ${zielId} AND COALESCE(v.aktiv, TRUE)
                AND v.wochentag = EXTRACT(ISODOW FROM (${termin.beginn}::timestamptz AT TIME ZONE 'Europe/Berlin'))::smallint
                AND (${termin.beginn}::timestamptz AT TIME ZONE 'Europe/Berlin')::time >= v.von
                AND (${termin.beginn}::timestamptz AT TIME ZONE 'Europe/Berlin')::time < v.bis
           ) AS frei,
           EXISTS (SELECT 1 FROM fiaon_termine x WHERE x.agent_id = ${zielId} AND x.beginn = ${termin.beginn} AND x.abgesagt_am IS NULL AND x.id <> ${id}) AS belegt
  `) as any[];
  const trotzdem = ein.trotzdem === true && leitung;
  if (vf?.belegt) {
    return { status: 409, body: { ok: false, code: "BELEGT", error: `${ziel.vorname} hat um ${berlinUhrzeit(termin.beginn)} Uhr schon einen Termin.` } };
  }
  if (!vf?.frei && !trotzdem) {
    return {
      status: 409,
      body: {
        ok: false, code: "NICHT_VERFUEGBAR",
        error: vf?.hat_zeiten
          ? `${ziel.vorname} hat am ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr keine Zeit hinterlegt.`
          : `${ziel.vorname} hat noch gar keine Zeiten hinterlegt — dort kann nichts gebucht werden.`,
        hinweis: leitung ? "Als Leitung kannst du trotzdem übergeben — der Grund steht dann im Verlauf." : "Wähle einen Kollegen, der zur Terminzeit Zeit hat.",
      },
    };
  }
  if (String(ziel.rolle) === "inkasso") {
    return { status: 400, body: { ok: false, error: "Das Forderungsmanagement nimmt keine Termine an. Dort gibt es die Wiedervorlage an der Rate." } };
  }
  // Vertretung: ein Startgespräch bei jemandem, der kein Onboarding macht,
  // bleibt beim Betreuer — nur der Termin wandert.
  const sollRolle = String(termin.quelle) === "onboarding_call" ? "onboarding" : null;
  const vertretung = sollRolle ? String(ziel.rolle || "agent") !== sollRolle : false;
  const vonName = ein.von.name;
  await sqlPool`
    UPDATE fiaon_termine
    SET agent_id = ${zielId},
        vertretung = ${vertretung},
        uebergeben_am = NOW(),
        uebergeben_von = ${Number(termin.agent_id)},
        uebergeben_grund = ${grund.slice(0, 500)},
        updated_at = NOW()
    WHERE id = ${id}
  `;
  // Der Kunde geht mit, wenn er beim Abgebenden liegt oder niemanden hat
  // (E-120) — nicht bei Vertretung.
  if (!vertretung && termin.person_id) {
    const [war] = (await sqlPool`
      SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${Number(termin.person_id)}
    `) as any[];
    const warBei = Number(war?.assigned_agent_id || 0);
    if (warBei === Number(termin.agent_id) || warBei === 0) {
      await sqlPool`
        UPDATE fiaon_persons
           SET assigned_agent_id = ${zielId}, assigned_at = NOW(),
               betreuung_seit = COALESCE(betreuung_seit, NOW()), updated_at = NOW()
         WHERE id = ${Number(termin.person_id)}
      `;
      await sqlPool`
        UPDATE fiaon_applications
           SET assigned_agent_id = ${zielId}, updated_at = NOW()
         WHERE person_id = ${Number(termin.person_id)} AND merged_into IS NULL
           AND (assigned_agent_id = ${Number(termin.agent_id)} OR assigned_agent_id IS NULL)
      `;
      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications WHERE person_id = ${Number(termin.person_id)} AND merged_into IS NULL
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      if (a?.ref) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
          VALUES (${a.ref}, ${Number(termin.person_id)}, ${ein.von.id}, ${vonName}, 'system',
                  ${`Kunde mit Termin übergeben an ${ziel.name}. Grund: ${grund.slice(0, 200)}`}, NOW())
        `.catch(() => {});
      }
    }
  }
  if (vertretung && termin.person_id) {
    const [a] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${Number(termin.person_id)} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (a?.ref) await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${a.ref}, ${Number(termin.person_id)}, ${ein.von.id}, ${vonName}, 'system',
              ${`Termin als Vertretung an ${ziel.name} übergeben (Kunde bleibt beim Betreuer). Grund: ${grund.slice(0, 200)}${trotzdem && !vf?.frei ? " — außerhalb seiner hinterlegten Zeiten (Leitung hat übersteuert)." : ""}`}, NOW())
    `.catch(() => {});
  }
  // Aufgabe an den Übernehmer — fällig am Termintag.
  await sqlPool`
    INSERT INTO fiaon_vermerke (art, ref, text, sicht, sicht_agenten, zustaendig_agent_id,
                                fuer_betreiber, dringend, status, autor_art, autor_agent_id, autor_name, faellig_am)
    SELECT 'aufgabe',
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = ${Number(termin.person_id)} AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1),
           ${`Termin übernommen von ${vonName}: ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr (${terminArtAusQuelle(termin.quelle).text}). Grund: ${grund.slice(0, 300)}${vertretung ? " — Vertretung außerhalb der zuständigen Rolle." : ""}${trotzdem && !vf?.frei ? " — ACHTUNG: außerhalb deiner hinterlegten Zeiten, bitte bestätigen oder mit dem Kunden verschieben." : ""}`},
           'agenten', ARRAY[${zielId}]::int[], ${zielId},
           FALSE, TRUE, 'offen', 'agent', ${ein.von.id}, ${vonName},
           (${termin.beginn}::timestamptz AT TIME ZONE 'Europe/Berlin')::date
  `.catch((e) => console.error("[TERMIN] Aufgabe an den Übernehmer nicht geschrieben:", e));
  const [p] = (await sqlPool`
    SELECT COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(p.primary_email), '')) AS email,
           p.first_name AS vorname, p.last_name AS nachname, a.ref
    FROM fiaon_persons p
    LEFT JOIN fiaon_applications a ON a.person_id = p.id
      AND a.merged_into IS NULL AND a.archived_at IS NULL
    WHERE p.id = ${Number(termin.person_id)}
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  let mailHinweis = "Der Kunde hat keine E-Mail-Adresse — bitte ihn selbst informieren.";
  if (p?.email) {
    const versand = await versendenUndProtokollieren(
      "termin_bestaetigung",
      {
        email: String(p.email),
        vorname: p.vorname || null,
        nachname: p.nachname || null,
        agent_vorname: String(ziel.vorname),
        termin_datum: berlinDatumText(termin.beginn),
        termin_uhrzeit: berlinUhrzeit(termin.beginn),
        termin_art: terminArtAusQuelle(termin.quelle).text,
        storno_link: stornoLink(String(termin.storno_token)),
        hinweis_anruf: anrufHinweisSie(String(ziel.vorname)),
        hinweis_absage: ABSAGE_HINWEIS_SIE,
      },
      {
        personId: Number(termin.person_id),
        verlaufRef: p.ref || null,
        verlaufText: `Termin an ${ziel.name} übergeben (${grund.slice(0, 200)}). `
          + `Der Kunde wurde über den neuen Ansprechpartner informiert.`,
      },
    ).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
    mailHinweis = (versand as any).ok
      ? `${p.email} wurde über den neuen Ansprechpartner informiert.`
      : `Die Info-Mail ging NICHT raus (${(versand as any).grund ?? "unbekannt"}) — `
        + "bitte den Kunden selbst informieren. Die Übergabe steht trotzdem.";
  }
  if (ziel.email) {
    try {
      const { sendMakeWebhook } = await import("../make-webhook");
      const { absoluteUrl } = await import("../fiaon-base-url");
      const minuten = Math.round((new Date(termin.beginn).getTime() - Date.now()) / 60_000);
      const bald = minuten >= 0 && minuten <= 180 ? `IN ${minuten} MINUTEN: ` : "";
      await sendMakeWebhook("aufgabe_zugewiesen", {
        email: String(ziel.email), vorname: String(ziel.vorname),
        aufgabe: `${bald}Termin übernommen von ${vonName}: ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr mit ${[p?.vorname, p?.nachname].filter(Boolean).join(" ") || "dem Kunden"} (${terminArtAusQuelle(termin.quelle).text}). Grund: ${grund.slice(0, 200)}${trotzdem && !vf?.frei ? " — außerhalb deiner hinterlegten Zeiten!" : ""}`,
        kunde: [p?.vorname, p?.nachname].filter(Boolean).join(" ") || null,
        faellig_am: new Date(termin.beginn).toISOString().slice(0, 10),
        faellig_am_text: berlinDatumText(termin.beginn),
        dringend: minuten >= 0 && minuten <= 180,
        portal_url: absoluteUrl("/agent/kalender"),
      });
    } catch (e) { console.warn("[TERMIN] Mail an Übernehmer:", String(e).slice(0, 120)); }
  }
  return {
    status: 200,
    body: {
      ok: true,
      vertretung,
      uebersteuert: trotzdem && !vf?.frei,
      hinweis: `Termin an ${ziel.name} übergeben. ${mailHinweis}`
        + (vertretung ? " Er ist als Vertretung markiert." : "")
        + (trotzdem && !vf?.frei ? ` ${ziel.vorname} hat zu dieser Zeit keine Sprechzeit hinterlegt — er wurde ausdrücklich darauf hingewiesen.` : ""),
    },
  };
}

router.post("/agent/termine/:id/uebergeben", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    const r = await terminUebergeben({
      terminId: Number(req.params.id),
      zielId: Number(req.body?.agentId),
      grund: String(req.body?.grund ?? ""),
      trotzdem: req.body?.trotzdem === true,
      von: { id: req.agent!.id, name: req.agent!.name, rolle },
    });
    res.status(r.status).json(r.body);
  } catch (err) {
    console.error("[TERMIN] uebergeben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Die Leitung verteilt aus der Termin-Zentrale (05.09.2026, E-126) — z. B.
 * Termine gesperrter Mitarbeiter. Gleiche Regeln, gleiche Mails; als
 * Übergebender steht die Leitung im Verlauf.
 */
router.post("/admin/termine/:id/uebergeben", async (req: Request, res: Response) => {
  try {
    const r = await terminUebergeben({
      terminId: Number(req.params.id),
      zielId: Number(req.body?.agentId),
      grund: String(req.body?.grund ?? ""),
      trotzdem: req.body?.trotzdem === true,
      von: { id: null, name: String(req.body?.von || "Justin Schwarzott (Leitung)").slice(0, 80), rolle: "admin" },
    });
    res.status(r.status).json(r.body);
  } catch (err) {
    console.error("[TERMIN] admin uebergeben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/termine/uebernehmer — wer kommt für eine Übergabe infrage?
//
// ── DIE LISTE SAGT JETZT, WER ZUSTÄNDIG WÄRE (21.08.2026) ─────────────────
// Vorher war es eine alphabetische Aufzählung aller Kollegen. Wer übergibt,
// musste selbst wissen, ob ein Startgespräch ans Onboarding gehört — und wenn
// er sich vertat, entstand eine stille Vertretung.
//
// Jetzt entscheidet `fiaon-zustaendigkeit.ts`, und zwar dieselbe Funktion, die
// auch Terminvergabe und Panel lesen. Wer die Zuständigkeit erfüllt, steht
// oben und ist als „zuständig" markiert; alle anderen bleiben wählbar, aber
// mit dem Vermerk „Vertretung". Eine Auswahl, die den falschen Weg VERBIETET,
// hätte den Krankheitsfall blockiert — sie soll ihn nur benennen.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/termine/uebernehmer", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    // ── P3 (01.09.2026): MARKIEREN, NICHT VERBIETEN ──────────────────────
    // Je Kollege drei billige Antworten: Arbeitet er zur TERMINZEIT laut
    // Wochenplan (imDienst — NULL heißt „kein Wochenplan hinterlegt", das ist
    // ein EIGENER Zustand, nicht „abwesend")? Ist er gerade da (praesenz,
    // dieselbe 20-Minuten-Frische wie /agent/flur)? Und wie voll ist seine
    // Liste (mandate/500)? Die Auswahl bleibt vollständig — der Krankheits-
    // und Vertretungsfall braucht den „falschen" Weg (Kommentar oben).
    const terminIdRoh = Number(req.query.termin);
    let terminBeginn: string | null = null;
    if (Number.isFinite(terminIdRoh) && terminIdRoh > 0) {
      const [tb] = (await sqlPool`SELECT beginn FROM fiaon_termine WHERE id = ${terminIdRoh}`) as any[];
      terminBeginn = tb?.beginn ?? null;
    }
    const kollegen = (await sqlPool`
      SELECT a.id, a.name, COALESCE(a.rolle, 'agent') AS rolle,
             -- 04.09.2026 (E-120): gegen DIESELBE Tabelle wie die Buchung
             -- (fiaon_agent_verfuegbarkeit), nicht gegen den Anwesenheits-Wochenplan.
             -- Vorher stand „kein Wochenplan" neben Kollegen, die längst buchbar waren.
             CASE WHEN NOT EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit w0 WHERE w0.agent_id = a.id AND COALESCE(w0.aktiv, TRUE))
                  THEN NULL
                  ELSE EXISTS (
                    SELECT 1 FROM fiaon_agent_verfuegbarkeit w
                    WHERE w.agent_id = a.id AND COALESCE(w.aktiv, TRUE)
                      AND w.wochentag = EXTRACT(ISODOW FROM (COALESCE(${terminBeginn}::timestamptz, NOW()) AT TIME ZONE 'Europe/Berlin'))::smallint
                      AND (COALESCE(${terminBeginn}::timestamptz, NOW()) AT TIME ZONE 'Europe/Berlin')::time >= w.von
                      AND (COALESCE(${terminBeginn}::timestamptz, NOW()) AT TIME ZONE 'Europe/Berlin')::time < w.bis)
             END AS im_dienst,
             (pr.zuletzt IS NOT NULL AND pr.zuletzt > NOW() - INTERVAL '20 minutes'
              AND pr.status IN ('da', 'telefon')) AS anwesend,
             (SELECT COUNT(*)::int FROM fiaon_persons mp
               WHERE mp.assigned_agent_id = a.id AND mp.mandat_seit IS NOT NULL
                 AND mp.merged_into_person_id IS NULL) AS mandate
      FROM fiaon_agents a
      LEFT JOIN fiaon_praesenz pr ON pr.agent_id = a.id
      WHERE a.active AND NOT COALESCE(a.is_test_account, FALSE)
        AND COALESCE(a.rolle, 'agent') <> 'inkasso'
        AND a.id <> ${req.agent!.id}
      ORDER BY COALESCE(a.rolle, 'agent'), a.name
    `) as any[];
    const MANDATE_MAX = (await import("./fiaon-office-vertrieb")).MANDATE_MAX;
    for (const k of kollegen) {
      k.imDienst = k.im_dienst; delete k.im_dienst;
      k.mandateMax = MANDATE_MAX;
      k.listeVoll = Number(k.mandate) >= MANDATE_MAX;
    }

    // Zu welchem Termin? Ohne Kennung bleibt die Liste roh — dann fehlt der
    // Bezug, und eine geratene Zuständigkeit wäre schlimmer als keine.
    const terminId = terminIdRoh;
    let soll: string | null = null;
    let grund: string | null = null;
    if (Number.isFinite(terminId) && terminId > 0) {
      const [t] = (await sqlPool`
        SELECT person_id, quelle FROM fiaon_termine WHERE id = ${terminId}
      `) as any[];
      if (t?.person_id) {
        const { zustaendigeRolle, ROLLEN_FUER } = await import("../lib/fiaon-zustaendigkeit");
        const z = await zustaendigeRolle(Number(t.person_id));
        if (z) {
          soll = z.rolle;
          grund = z.grund;
          for (const k of kollegen) {
            k.zustaendig = ROLLEN_FUER[z.rolle].includes(String(k.rolle));
          }
          // Zuständige zuerst, dann im Dienst, dann die leerste Liste —
          // die Reihenfolge ist die halbe Empfehlung (P3).
          kollegen.sort((a: any, b: any) =>
            (b.zustaendig ? 1 : 0) - (a.zustaendig ? 1 : 0)
            || (b.imDienst === true ? 1 : 0) - (a.imDienst === true ? 1 : 0)
            || Number(a.mandate || 0) - Number(b.mandate || 0)
            || String(a.name).localeCompare(String(b.name)));
        }
      }
    }
    res.json({ ok: true, kollegen, soll, grund });
  } catch (err) {
    console.error("[TERMIN] uebernehmer:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/termine/vertretungen — die Admin-Liste
//
// ── WARUM SIE EXISTIEREN MUSS ─────────────────────────────────────────────
// Vertretung ist erlaubt: Krankheit, Urlaub, ein voller Onboarding-Kalender.
// Sie darf nur nie stillschweigend zum Normalfall werden — genau das ist am
// 19./20.08.2026 passiert: 15 Startgespräche beim Vertrieb, und niemand hat es
// bemerkt, weil es nirgends stand.
//
// Diese Liste ist der Ort, an dem es steht. Sie zählt AUCH die Vergangenheit
// (14 Tage): Eine Liste, die nur die Zukunft zeigt, ist am Tag nach dem
// Vorfall leer.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/termine/vertretungen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!["vertriebsleiter", "admin"].includes(rolle)) {
      return res.status(403).json({
        ok: false,
        error: "Diese Liste ist für die Leitung — sie nennt fremde Zuständigkeiten.",
      });
    }
    const { zustaendigeRolleSql } = await import("../lib/fiaon-zustaendigkeit");
    const zeilen = (await sqlPool.unsafe(`
      SELECT t.id, t.beginn, t.quelle, t.status, t.vertretung,
             t.uebergeben_am, t.uebergeben_grund,
             ag.name AS agent_name, COALESCE(ag.rolle, 'agent') AS agent_rolle,
             vor.name AS vorher_name,
             p.id AS person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Ohne Namen') AS kunde,
             ${zustaendigeRolleSql("p")} AS soll_rolle
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      LEFT JOIN fiaon_agents vor ON vor.id = t.uebergeben_von
      WHERE t.abgesagt_am IS NULL
        AND t.beginn > NOW() - INTERVAL '14 days'
        AND (t.vertretung IS TRUE
          OR (t.quelle = 'onboarding_call' AND COALESCE(ag.rolle, 'agent') <> 'onboarding'))
      ORDER BY t.beginn DESC
    `)) as any[];
    res.json({
      ok: true,
      vertretungen: zeilen.map((r) => ({
        id: Number(r.id),
        beginn: new Date(r.beginn).toISOString(),
        quelle: String(r.quelle),
        status: String(r.status),
        markiert: r.vertretung === true,
        agentName: r.agent_name ?? null,
        agentRolle: String(r.agent_rolle),
        sollRolle: String(r.soll_rolle),
        vorherName: r.vorher_name ?? null,
        uebergebenAm: r.uebergeben_am ? new Date(r.uebergeben_am).toISOString() : null,
        uebergebenGrund: r.uebergeben_grund ?? null,
        personId: Number(r.person_id),
        kunde: String(r.kunde),
      })),
    });
  } catch (err) {
    console.error("[TERMIN] vertretungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/termine — der Agent legt selbst einen Termin an. */
router.post("/agent/termine", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { personId, beginn } = req.body || {};
    if (!personId || !beginn) return res.status(400).json({ ok: false, error: "Kunde und Zeitpunkt fehlen." });

    // Nur eigene Kunden. Ein Termin bei einem fremden Kunden wäre eine
    // Zuständigkeitsübernahme durch die Hintertür.
    const [person] = (await sqlPool`
      SELECT id, assigned_agent_id FROM fiaon_persons
      WHERE id = ${Number(personId)} AND merged_into_person_id IS NULL
    `) as any[];
    if (!person) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    // ── 24.08.2026 (Justin, Auftrag 2 / Praxisprobe) ──────────────────────
    // VORHER endete der Weg für das Forderungsmanagement hier mit 403: Diana
    // betreut niemanden, ihre Fälle gehören immer einem Kollegen. In der Akte
    // steht aber ausdrücklich „1 Monat ausgesetzt + Termin — buch danach oben
    // den Termin"; ausgesetzt ohne Gespräch verliert den Kunden. Der
    // Mitarbeiter musste den Raum wechseln und konnte es dort auch nicht.
    // NACHHER entscheidet die EINE Definition (`darfAnKunde`): Betreuer ja,
    // Leitung ja, Forderungsmanagement bei einem Menschen mit offener Rate
    // ja — sonst weiter 403. Für den gewöhnlichen Bonitätsmanager ändert sich
    // nichts: `darfAnKunde` fragt für ihn nach genau derselben Betreuung.
    if (person.assigned_agent_id && Number(person.assigned_agent_id) !== req.agent!.id) {
      const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
      const rolle = await rolleVon(req.agent!.id);
      if (!(await darfAnKunde(req.agent!.id, rolle, Number(personId)))) {
        return res.status(403).json({ ok: false, error: "Dieser Kunde wird von einem Kollegen betreut." });
      }
    }

    // ── DIE ART DES TERMINS (25.08.2026, Florentine Punkt 6) ─────────────
    // „Wenn ich einen Termin im Kalender anlege, sollte ich direkt angeben
    // können, um welche Art von Termin es sich handelt: Rückruf mit
    // Begründung, Zahlung, Vertrieb, Onboarding."
    // Die Arten sind die BESTEHENDEN Quellen — keine neue Werteliste daneben.
    // Bei allem außer dem eigenen Rückruf entscheidet wie überall die
    // Ableitung (`entscheidFuerPerson`) endgültig, was zum Kunden passt.
    const ART_ZU_QUELLE: Record<string, string> = {
      rueckruf: "agent_manuell", vertrieb: "agent_manuell",
      onboarding: "onboarding_call", zahlung: "inkasso_call",
    };
    const art = String(req.body?.art || "");
    const notiz = req.body?.notiz ? String(req.body.notiz).trim().slice(0, 500) : null;
    // Die Begruendung ist nur Pflicht, wenn jemand AUSDRUECKLICH „Rueckruf"
    // gewaehlt hat. Die Akte bucht ohne Art (Slot-Wahl zur Situation) — sie
    // darf nicht an einer Pflicht scheitern, die ihr niemand gezeigt hat.
    if (art === "rueckruf" && !notiz) {
      return res.status(400).json({ ok: false, error: "Bitte kurz begründen, warum der Rückruf stattfindet — das steht dann im Termin." });
    }
    const buchung = await terminBuchen({
      personId: Number(personId), agentId: req.agent!.id,
      // „agent_manuell" bleibt der Vorgabewert. Diese Route steht hinter
      // `requireAgent`: Ein angemeldeter Mensch notiert seinen EIGENEN Rückruf.
      // Die öffentliche Route darf diesen Wert seit dem 24.08.2026 nicht mehr
      // setzen (siehe den Fund oben bei POST /termin/:token/buchen).
      beginn: String(beginn), quelle: ART_ZU_QUELLE[art] ?? "agent_manuell", herkunft: "agent",
    });
    if (notiz) {
      await sqlPool`UPDATE fiaon_termine SET notiz = ${notiz} WHERE id = ${buchung.id}`.catch(() => {});
    }
    await buchungAnwenden(buchung);
    await bestaetigungSenden(buchung);
    // `akteur: "agent"` trennt die beiden Wege in der Statistik. Für den Agenten
    // gilt kein Vorlauf — seine Ablehnungen haben andere Gründe, und beides in
    // einen Topf zu zählen würde die Kundenquote verfälschen.
    await versuchProtokollieren({
      ergebnis: "gebucht", personId: Number(personId), slotBeginn: beginn,
      agentId: req.agent!.id, quelle: "agent_manuell", akteur: "agent",
    });
    res.json({ ok: true, termin: { datumText: buchung.datumText, uhrzeit: buchung.uhrzeit } });
  } catch (err) {
    const grund = err instanceof TerminFehler ? err.code : "serverfehler";
    await versuchProtokollieren({
      ergebnis: "abgelehnt", personId: req.body?.personId ? Number(req.body.personId) : null,
      slotBeginn: req.body?.beginn ?? null, agentId: req.agent!.id,
      grund, quelle: "agent_manuell", akteur: "agent",
    });
    if (err instanceof TerminFehler) return res.status(409).json({ ok: false, error: err.message, code: err.code });
    console.error("[TERMIN] agent buchen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/termine/:id/absagen */
router.post("/agent/termine/:id/absagen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [termin] = (await sqlPool`
      SELECT storno_token FROM fiaon_termine
      WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id} AND status = 'gebucht'
    `) as any[];
    if (!termin?.storno_token) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
    await terminAbsagen(String(termin.storno_token), "agent");
    res.json({ ok: true });
  } catch (err) {
    console.error("[TERMIN] agent absagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/verfuegbarkeit — die eigenen Zeiten. */
router.get("/agent/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [eigene] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${req.agent!.id}
    `) as any[];
    res.json({
      ok: true,
      fenster: await verfuegbarkeitVon(req.agent!.id),
      vorgabe: Number(eigene.n) === 0,
      slotMinuten: SLOT_MINUTEN,
    });
  } catch (err) {
    console.error("[TERMIN] verfuegbarkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** PUT /agent/verfuegbarkeit — eigene Zeiten setzen. */
router.put("/agent/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const fenster = Array.isArray(req.body?.fenster) ? req.body.fenster : [];
    // Die Klammer liegt hier, nicht in der Bibliothek: Löschen und Neuschreiben
    // müssen zusammen gelingen, sonst stünde ein Agent kurz ohne Zeiten da.
    await sqlPool.begin(async (tx) => {
      await verfuegbarkeitSetzen(req.agent!.id, fenster, tx as any);
      // ── BEIDE TABELLEN, ODER KEINE (25.08.2026) ────────────────────────
      // Es gibt zwei Formulare fuer dieselbe Sache: den Wochenplan unter
      // „Availability" (fiaon_arbeitszeiten) und dieses hier
      // (fiaon_agent_verfuegbarkeit). Die Terminpruefung liest NUR das
      // zweite. Der Wochenplan spiegelt laengst hierher — dieser Weg
      // spiegelte aber nicht zurueck. Wer hier etwas aenderte, sah auf der
      // Seite „Availability" danach die alten Zeiten und glaubte, seine
      // Aenderung sei verlorengegangen.
      // GEMESSEN am 25.08.2026: heute noch bei allen fuenf aktiven
      // Mitarbeitern deckungsgleich — also bevor jemand darueber stolpert.
      const roh = fenster.filter((f: any) => f && f.aktiv !== false && f.von && f.bis);
      await tx`DELETE FROM fiaon_arbeitszeiten WHERE agent_id = ${req.agent!.id}`;
      for (const f of roh) {
        await tx`INSERT INTO fiaon_arbeitszeiten (agent_id, wochentag, von, bis)
                 VALUES (${req.agent!.id}, ${Number(f.wochentag)}, ${String(f.von)}::time, ${String(f.bis)}::time)`;
      }
    });
    res.json({ ok: true, fenster: await verfuegbarkeitVon(req.agent!.id) });
  } catch (err) {
    console.error("[TERMIN] verfuegbarkeit setzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * PUT /vertrieb/verfuegbarkeit — die Vertriebsleitung setzt die Zeiten für alle.
 *
 * Bewusst „für alle, die noch nichts Eigenes haben" plus ausdrücklich
 * überschreibbar: Sonst würde ein gut gemeinter Klick die individuellen Zeiten
 * von vier Leuten wortlos plattmachen.
 */
router.put("/vertrieb/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [ich] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${req.agent!.id}`) as any[];
    if (String(ich?.rolle) !== "vertriebsleiter") {
      return res.status(403).json({ ok: false, error: "Nur die Vertriebsleitung darf Teamzeiten setzen." });
    }
    const fenster = Array.isArray(req.body?.fenster) ? req.body.fenster : [];
    const auchUeberschreiben = req.body?.auchUeberschreiben === true;

    const agenten = (await sqlPool`
      SELECT a.id FROM fiaon_agents a
      WHERE a.active AND NOT a.is_test_account
        AND (${auchUeberschreiben}::boolean
             OR NOT EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id))
    `) as any[];
    await sqlPool.begin(async (tx) => {
      for (const a of agenten) await verfuegbarkeitSetzen(Number(a.id), fenster, tx as any);
    });
    res.json({ ok: true, gesetzt: agenten.length });
  } catch (err) {
    console.error("[TERMIN] team verfuegbarkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
