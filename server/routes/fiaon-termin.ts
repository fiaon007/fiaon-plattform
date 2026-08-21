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
  versuchProtokollieren,
} from "../lib/fiaon-termine";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { anrufHinweis, ABSAGE_HINWEIS } from "../../shared/fiaon-termin-text";

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
      hinweis_anruf: anrufHinweis(buchung.agentVorname),
      hinweis_absage: ABSAGE_HINWEIS,
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
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
      FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      WHERE t.person_id = ${person.id} AND t.status = 'gebucht' AND t.beginn > NOW()
      ORDER BY t.beginn ASC LIMIT 1
    `) as any[];

    // `art=start` schaltet auf das Startgespräch um: 15 Minuten statt 20 und
    // ausschließlich Slots des Onboardings. Die Art steht im Pfad und nicht im
    // Token, weil sie keine Berechtigung ist, sondern eine Auskunft.
    const quelle = String(req.query.art) === "start" ? "onboarding_call" : "nichterreicht_mail";
    const auskunft = await freieSlots(person.id, sqlPool, quelle);

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

    res.json({
      ok: true,
      art: quelle,
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
  const { beginn, agentId, quelle } = req.body || {};
  const gewuenscht = quelle === "onboarding_call" ? "onboarding_call"
    : quelle === "onboarding" ? "onboarding" : "nichterreicht_mail";
  let personId: number | null = null;

  const ablehnen = async (grund: string, text: string, status = 409) => {
    await versuchProtokollieren({
      ergebnis: "abgelehnt", personId, slotBeginn: beginn ?? null,
      agentId: agentId ? Number(agentId) : null, grund, quelle: gewuenscht, akteur: "kunde",
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

    const buchung = await terminBuchen({
      personId: geprueft.personId,
      agentId: Number(agentId),
      beginn: String(beginn),
      quelle: gewuenscht,
    });
    await buchungAnwenden(buchung);
    await bestaetigungSenden(buchung);

    await versuchProtokollieren({
      ergebnis: "gebucht", personId: geprueft.personId, slotBeginn: beginn,
      agentId: Number(agentId), quelle: gewuenscht, akteur: "kunde",
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
      quelle: gewuenscht, akteur: "kunde",
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

    await sqlPool`
      UPDATE fiaon_termine SET status = ${String(ergebnis)}, erledigt_am = NOW(),
             notiz = ${notiz ? String(notiz).slice(0, 4000) : null}, updated_at = NOW()
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
      `.catch(() => {});
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
router.post("/agent/termine/:id/uebergeben", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const zielId = Number(req.body?.agentId);
    const grund = String(req.body?.grund ?? "").trim();
    if (!zielId) return res.status(400).json({ ok: false, error: "Bitte einen Kollegen auswählen." });
    if (grund.length < 5) {
      return res.status(400).json({
        ok: false,
        error: "Bitte in einem Satz sagen, warum du übergibst — der Kollege liest ihn morgen früh.",
      });
    }

    const [termin] = (await sqlPool`
      SELECT id, person_id, agent_id, beginn, quelle, status, storno_token
      FROM fiaon_termine WHERE id = ${id} AND abgesagt_am IS NULL
    `) as any[];
    if (!termin) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
    if (Number(termin.agent_id) === zielId) {
      return res.status(400).json({ ok: false, error: "Der Termin liegt schon bei diesem Kollegen." });
    }

    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    const darf = Number(termin.agent_id) === req.agent!.id
      || ["vertriebsleiter", "admin"].includes(rolle);
    if (!darf) {
      return res.status(403).json({
        ok: false,
        error: "Diesen Termin kann nur sein Zuständiger oder die Leitung übergeben.",
      });
    }

    const [ziel] = (await sqlPool`
      SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, rolle, active
      FROM fiaon_agents
      WHERE id = ${zielId} AND active AND NOT COALESCE(is_test_account, FALSE)
    `) as any[];
    if (!ziel) return res.status(404).json({ ok: false, error: "Diesen Kollegen gibt es nicht (mehr)." });
    // Dieselbe Grenze wie beim Buchen: Das Forderungsmanagement nimmt keine
    // Termine an (Begründung in server/lib/fiaon-termine.ts).
    if (String(ziel.rolle) === "inkasso") {
      return res.status(400).json({
        ok: false,
        error: "Das Forderungsmanagement nimmt keine Termine an. Dort gibt es die Wiedervorlage an der Rate.",
      });
    }

    // Wechselt ein Startgespräch aus dem Onboarding heraus, ist es ab jetzt
    // eine Vertretung — und wieder zurück, wenn es ins Onboarding geht.
    const sollRolle = String(termin.quelle) === "onboarding_call" ? "onboarding" : null;
    const vertretung = sollRolle ? String(ziel.rolle || "agent") !== sollRolle : false;

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

    // ── DIE INFO-MAIL AN DEN KUNDEN ───────────────────────────────────────
    // Sie geht über `termin_bestaetigung` mit dem neuen Vornamen. Scheitert
    // sie, ist die Übergabe trotzdem gültig — sie steht in der Datenbank, und
    // der Mitarbeiter erfährt es im Klartext, statt es zu glauben.
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
          hinweis_anruf: anrufHinweis(String(ziel.vorname)),
          hinweis_absage: ABSAGE_HINWEIS,
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

    res.json({
      ok: true,
      vertretung,
      hinweis: `Termin an ${ziel.name} übergeben. ${mailHinweis}`
        + (vertretung ? " Er ist als Vertretung markiert." : ""),
    });
  } catch (err) {
    console.error("[TERMIN] uebergeben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/termine/uebernehmer — wer kommt für eine Übergabe infrage? */
router.get("/agent/termine/uebernehmer", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const kollegen = (await sqlPool`
      SELECT id, name, COALESCE(rolle, 'agent') AS rolle
      FROM fiaon_agents
      WHERE active AND NOT COALESCE(is_test_account, FALSE)
        AND COALESCE(rolle, 'agent') <> 'inkasso'
        AND id <> ${req.agent!.id}
      ORDER BY COALESCE(rolle, 'agent'), name
    `) as any[];
    res.json({ ok: true, kollegen });
  } catch (err) {
    console.error("[TERMIN] uebernehmer:", err);
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
    if (person.assigned_agent_id && Number(person.assigned_agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von einem Kollegen betreut." });
    }

    const buchung = await terminBuchen({
      personId: Number(personId), agentId: req.agent!.id,
      beginn: String(beginn), quelle: "agent_manuell",
    });
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
    await sqlPool.begin(async (tx) => { await verfuegbarkeitSetzen(req.agent!.id, fenster, tx as any); });
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
