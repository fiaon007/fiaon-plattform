// ═══════════════════════════════════════════════════════════════════════════
// TELEFONIE, DOKUMENTE, GESPRÄCHSBLATT — Routen
//
// Die Regeln stehen in den Bibliotheken. Hier steht, wer was darf — und die
// Twilio-Rückrufe, die von außen kommen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { tageslauf } from "../lib/fiaon-crons";
import { sqlPool } from "../lib/db-pool";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  ansageText, aufnahmeFrist, aufnahmenAufraeumen, einrichtungsStand, MAX_MINUTEN, offeneAnrufe, telefonBereit,
  twimlAusgehend, wahlProtokoll, wahlPruefen, zugangsAusweis,
  nummerKontingent, nummerWarnungMelden,
} from "../lib/fiaon-softphone";
import { DOKUMENTE, dokumentInhalt, dokumentStand, istDokumentArt } from "../lib/fiaon-dokumente";
import { gespraechsblatt } from "../lib/fiaon-gespraechsblatt";
import { anrufNachbereiten } from "../lib/fiaon-transkript";
import { ergebnisNachbereiten, istErgebnis } from "../lib/fiaon-kontakt-ergebnis";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();

// ── DIE ROLLE KOMMT AUS fiaon-kundenzugriff.ts ───────────────────────────
// Hier stand eine eigene Fassung. Die in fiaon-mail.ts deutete „inkasso"
// stillschweigend zu „agent" um — eine Erlaubnisliste aus drei Namen, die
// niemand erweiterte. Der Inkasso-Mitarbeiter bekam beim Senden 403.

/**
 * Darf dieses Konto NICHT telefonieren?
 *
 * ── ATTRAPPE ODER PRÜFKONTO (11.08.2026) ───────────────────────────────────
 * Eine Attrappe (`is_test_account`) hat keinen Menschen dahinter — sie darf
 * nicht wählen, weil am anderen Ende ein echter Kunde abhebt und ins Leere
 * spricht.
 *
 * Das PRÜFKONTO des Vorgesetzten hat sehr wohl einen Menschen dahinter. Es
 * trägt beide Merkmale, und bis heute gewann das falsche: Der Vorgesetzte
 * konnte über sein eigenes Konto nicht telefonieren.
 *
 * Die Regel ist nicht „ist es als Test markiert", sondern „sitzt jemand da".
 */
async function istTestkonto(agentId: number): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT is_test_account, pruefkonto FROM fiaon_agents WHERE id = ${agentId}
  `) as any[];
  return !!a?.is_test_account && !a?.pruefkonto;
}

/** Darf dieser Mensch diesen Kunden anfassen? Dieselbe Grenze wie beim Mailversand. */
// ── DIE ZUGRIFFSFRAGE STEHT IN fiaon-kundenzugriff.ts ─────────────────────
// Sie wurde hier UND in der jeweils anderen Datei beantwortet — zwei Kopien
// mit derselben Lücke: Das Forderungsmanagement fiel in den letzten Zweig
// (nach `assigned_agent_id`) und durfte niemanden anrufen und niemandem
// schreiben. Zweimal repariert wäre beim nächsten Mal wieder zweimal zu
// reparieren, und eine Stelle vergisst man.

// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /telefon/stand — was die Oberfläche wissen muss, bevor sie etwas zeigt. */
router.get("/telefon/stand", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const stand = einrichtungsStand();
    res.json({
      ok: true,
      ...stand,
      // Die Liste der fehlenden Werte geht NUR an den Vorgesetzten. Ein
      // Teammitglied braucht die Namen von Umgebungsvariablen nicht.
      fehlend: [],
      maxMinuten: MAX_MINUTEN,
      offene: await offeneAnrufe(req.agent!.id),
      testkonto: await istTestkonto(req.agent!.id),
      // Fuer die gespeicherte Mikrofon-Wahl im Browser: Sie gilt je Mitarbeiter,
      // nicht je Browser-Profil (zwei Menschen an einem Rechner haben zwei
      // Headsets). Die Geraetekennung selbst bleibt im Browser — auf dem Server
      // gespeichert wuerde sie am zweiten Arbeitsplatz auf ein Geraet zeigen,
      // das es dort nicht gibt.
      agentId: req.agent!.id,
      // ── DER TAGESSTAND DER RUFNUMMER (19.08.2026) ─────────────────────
      // Sichtbar im Panel — aber nur, wenn es etwas zu sagen gibt. Der Stand
      // trägt seinen Satz selbst (`hinweis`); unter der Schwelle ist er `null`
      // und das Panel zeigt nichts. Eine Zahl, die immer dasteht, liest
      // niemand mehr.
      //
      // Hier stand früher „Wer bei 98 von 100 steht, soll es wissen, BEVOR der
      // Knopf nicht mehr geht." Der Knopf geht jetzt immer — der Hinweis ist
      // eine Information, keine Vorwarnung auf eine Sperre.
      kontingent: await nummerKontingent(process.env.TWILIO_CALLER_ID || ""),
    });
  } catch (err) {
    console.error("[TELEFON] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/telefon/einrichtung — die Karte in den Einstellungen. */
router.get("/admin/telefon/einrichtung", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...einrichtungsStand(), ansage: await ansageText(), maxMinuten: MAX_MINUTEN });
  } catch (err) {
    console.error("[TELEFON] einrichtung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /telefon/wem?nummer=… — „Du rufst [Name] an", VOR dem Wählen.
 *
 * Der Mensch muss sehen, wen er gleich am Apparat hat, BEVOR er drückt. Eine
 * Warnung nach dem Verbinden ist keine Warnung, sondern ein Protokoll.
 *
 * Absichtlich sparsam: Nur Name und ob die Nummer bekannt ist. Wer eine
 * fremde Nummer eintippt, soll nicht die halbe Akte eines Menschen sehen, zu
 * dem er keinen Auftrag hat.
 */
router.get("/telefon/wem", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const roh = String(req.query.nummer || "");
    const { wahlPruefen } = await import("../lib/fiaon-softphone");
    const pruefung = await wahlPruefen(roh);
    if (!pruefung.nummer) {
      return res.json({ ok: true, nummer: null, person: null, anzeige: "Noch keine gültige Rufnummer." });
    }
    const { personZurNummer } = await import("../lib/fiaon-anruf-zuordnung");
    const z = await personZurNummer(pruefung.nummer);
    res.json({
      ok: true,
      nummer: pruefung.nummer,
      waehlbar: pruefung.erlaubt,
      grund: pruefung.grund,
      person: z.person ? { id: z.person.personId, name: z.person.name } : null,
      mehrdeutig: z.mehrdeutig,
      anzeige: z.anzeige,
    });
  } catch (err) {
    console.error("[TELEFON] wem:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/ausweis — der kurzlebige Zugang für das Browser-SDK.
 *
 * Vier Wände, in dieser Reihenfolge: eingerichtet, echte Rolle, kein
 * Testkonto, erlaubte Nummer. Jede Wahl wird protokolliert — auch die
 * abgelehnte, denn genau die will man später sehen.
 */
router.post("/telefon/ausweis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nummerRoh = String(req.body?.nummer || "");
    const personId = req.body?.personId ? Number(req.body.personId) : null;

    const ablehnen = async (grund: string, code = 403) => {
      await wahlProtokoll({
        agentId: req.agent!.id, agentName: req.agent!.name, nummer: nummerRoh,
        personId, erlaubt: false, grund,
      });
      return res.status(code).json({ ok: false, error: grund });
    };

    if (!telefonBereit()) return ablehnen(einrichtungsStand().hinweis, 503);
    if (await istTestkonto(req.agent!.id)) {
      return ablehnen("Testkonten können nicht telefonieren.");
    }
    // ══════════════════════════════════════════════════════════════════════
    // JEDER MITARBEITER DARF TELEFONIEREN
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Der Vorgesetzte: „Das Handy soll für JEDEN funktionieren, der
    // Mitarbeiter ist!"
    //
    // Hier stand eine Liste aus drei Rollen — „agent", „vertriebsleiter",
    // „onboarding". Das Forderungsmanagement fehlte. Ein Mensch, dessen
    // ganze Arbeit darin besteht, Kunden wegen offener Raten anzurufen,
    // bekam: „Deine Rolle darf nicht telefonieren."
    //
    // ── WARUM JETZT EINE SPERRLISTE STATT EINER ERLAUBNISLISTE ────────────
    // Eine Erlaubnisliste muss man bei jeder neuen Rolle erweitern — und
    // genau das vergisst man. Der Fehler fällt erst auf, wenn ein Mensch vor
    // einer verschlossenen Tür steht und nicht arbeiten kann.
    //
    // Umgekehrt herum ist die Voreinstellung richtig: Wer ein aktives Konto
    // hat, darf telefonieren. Wer NICHT darf, muss namentlich hier stehen —
    // und das fällt beim Eintragen auf, nicht Wochen später.
    //
    // Die eigentlichen Grenzen sind ohnehin andere und stehen weiter unten:
    // die Richtlinie (Wand), das Testkonto (Wand) und die Frage, ob dieser
    // Mensch an DIESEN Kunden darf.
    // ══════════════════════════════════════════════════════════════════════
    const OHNE_TELEFON: string[] = [];
    if (OHNE_TELEFON.includes(rolle)) {
      return ablehnen("Deine Rolle darf nicht telefonieren.");
    }

    // ── DIE RICHTLINIE IST EINE WAND, KEIN HINWEIS ────────────────────────
    // Serverseitig geprüft, nicht in der Oberfläche versteckt. Wer ein
    // Gespräch ohne Hinweis aufzeichnet, macht sich nach § 201 StGB
    // persönlich strafbar — und FIAON hat die Aufzeichnung eingeschaltet.
    // Ein Knopf, den man in der Konsole umgehen kann, wäre hier keine
    // Absicherung, sondern eine Ausrede.
    const { darfWaehlen } = await import("../lib/fiaon-telefon-zusage");
    const richtlinie = await darfWaehlen(req.agent!.id);
    if (!richtlinie.erlaubt) {
      await wahlProtokoll({
        agentId: req.agent!.id, agentName: req.agent!.name, nummer: nummerRoh,
        personId, erlaubt: false, grund: "Telefon-Richtlinie nicht angenommen",
      });
      return res.status(412).json({
        ok: false, richtlinieOffen: true,
        neufassung: richtlinie.neufassung, error: richtlinie.grund,
      });
    }
    // ── DAS LAND DES KUNDEN, BEVOR GEWÄHLT WIRD (31.08.2026) ──────────────
    // Ohne diese Zeilen ratet `wahlPruefen` bei einer national geschriebenen
    // Nummer die Vorwahl — und aus dem Schweizer Kunden 0797435749 wurde am
    // 19.08.2026 dreimal +49797435749, also Deutschland. Das Land steht in der
    // Akte; es muss nur mitgegeben werden.
    //
    // `personId` ist hier nur ein VORSCHLAG aus der offenen Karte (die Zuordnung
    // nach der gewählten Nummer passiert weiter unten). Für die Landfrage genügt
    // er: Er entscheidet nicht, WEM der Anruf gehört, sondern nur, welche
    // Vorwahl zu einer unvollständigen Nummer passt. Fehlt er, verweigert
    // `wahlPruefen` — und das ist die richtige Richtung.
    let kundenLand: string | null = null;
    const vorschlagId = Number(req.body?.personId) || 0;
    if (vorschlagId > 0) {
      const [pl] = (await sqlPool`
        SELECT country FROM fiaon_persons WHERE id = ${vorschlagId}
      `.catch(() => [])) as any[];
      kundenLand = pl?.country ?? null;
    }
    const pruefung = await wahlPruefen(nummerRoh, sqlPool, kundenLand);
    if (!pruefung.erlaubt) return ablehnen(pruefung.grund!, 400);

    // ══════════════════════════════════════════════════════════════════════
    // DER TAGESSTAND DER RUFNUMMER — WARNT, SPERRT NICHT (19.08.2026)
    //
    // ── HIER STAND EINE WAND, UND SIE HAT DEN VERTRIEB ANGEHALTEN ─────────
    // Bis heute antwortete diese Stelle bei Erreichen der Grenze mit HTTP 429,
    // und der Agent konnte nicht mehr wählen. Die Begründung von damals lautete
    // ausdrücklich: „ein Schutz in der Oberfläche wäre eine Bitte, dieser hier
    // ist eine Wand."
    //
    // Die Wand stand an der falschen Stelle. GEMESSEN am 19.08.2026
    // (scripts/mess-anrufgrenze.ts): Zwischen 13:18 und 15:14 Uhr hat sie
    // **26 Anrufe** verhindert — 18 bei Lucas Böhnert, 8 bei Nikita Boychenko,
    // 9 Kunden waren nicht erreichbar. Die Grenze lag bei 100, der gemessene
    // Normalbetrieb bei bis zu 252 Anrufen je Nummer und Tag. Der Betreiber
    // musste die Einstellung auf 0 setzen, um weiterarbeiten zu lassen.
    //
    // Der Schaden durch eine spam-markierte Rufnummer ist ein VERMUTETER
    // Zukunftsschaden. Der Schaden durch ein blockiertes Vertriebsteam ist
    // heute und zählbar. Deshalb gilt ab jetzt die Hausregel aus AGENTS.md:
    // Schutzmechanismen warnen den Betreiber, sie halten die Kernarbeit nicht
    // an. Hart gesperrt wird nur, was Sicherheit oder Recht verlangt — die
    // Berechtigung (darfAnKunde), die Richtlinien-Zusage (darfWaehlen) und eine
    // fehlende oder unwählbare Nummer (wahlPruefen). Alle drei stehen oben.
    //
    // Hier wird deshalb NUR GEZÄHLT: Der Stand geht an das Panel des Agenten
    // (dezenter Hinweis) und, ab dem 1,5-fachen, als Warnung an den Betreiber.
    // Es gibt in diesem Block keinen `return` mehr.
    const absender = process.env.TWILIO_CALLER_ID || "";
    const kontingent = await nummerKontingent(absender);
    if (kontingent.stufe === "warnung") {
      // Fire-and-forget: Eine Warnung an den Betreiber darf einen Anruf nicht
      // verzögern — und schon gar nicht verhindern, wenn sie selbst scheitert.
      void nummerWarnungMelden(absender, kontingent).catch(() => {});
    }

    // ══════════════════════════════════════════════════════════════════════
    // DER ANRUF FOLGT DER GEWÄHLTEN NUMMER — NICHT DER OFFENEN KARTE
    //
    // ── DER BEFUND (16.08.2026) ───────────────────────────────────────────
    // Team: „Mehrfach ‚Diana — Mailbox gesprochen', aber die Aufnahme gehört
    // zu einer komplett anderen Person."
    //
    // Hier stand ausschließlich `req.body.personId` — also das, was in der
    // Oberfläche gerade als Kundenkarte offen war. Wer eine Karte offen
    // hatte und eine fremde Nummer eintippte, hängte Aufnahme, Transkript
    // und KI-Notiz an die falsche Akte. Ein Datenschutzproblem, kein
    // Anzeigefehler.
    //
    // Jetzt entscheidet die Nummer. Die Karte ist nur noch ein Vorschlag,
    // dem widersprochen werden darf — und der Widerspruch steht im
    // Wahlprotokoll, damit man sieht, wie oft nebenher gewählt wird.
    // ══════════════════════════════════════════════════════════════════════
    const { anrufZuordnen } = await import("../lib/fiaon-anruf-zuordnung");
    const zuordnung = await anrufZuordnen(pruefung.nummer!, personId);
    const echtePersonId = zuordnung.person?.personId ?? null;

    // Die Zugriffsprüfung gilt für die Person, die WIRKLICH angerufen wird.
    // Vorher wurde die offene Karte geprüft — man konnte also einen fremden
    // Kunden anrufen, solange man eine eigene Karte offen hatte.
    if (echtePersonId && !(await darfAnKunde(req.agent!.id, rolle, echtePersonId))) {
      return ablehnen("Dieser Kunde wird von jemand anderem betreut.");
    }
    if (zuordnung.widerspruch) {
      await wahlProtokoll({
        agentId: req.agent!.id, agentName: req.agent!.name, nummer: pruefung.nummer!,
        personId: echtePersonId, erlaubt: true,
        grund: `Kartenkontext war Person ${personId}, gewählt wurde die Nummer von `
          + `${zuordnung.person!.name} (Person ${echtePersonId}) — der Anruf folgt der Nummer.`,
      });
    }

    const ausweis = await zugangsAusweis(req.agent!.id);
    if (!ausweis.ok) return ablehnen(ausweis.grund!, 503);

    await wahlProtokoll({
      agentId: req.agent!.id, agentName: req.agent!.name, nummer: pruefung.nummer!,
      personId: echtePersonId, erlaubt: true, grund: null,
    });
    // Der Anruf-Datensatz entsteht JETZT, nicht erst beim Rückruf von Twilio:
    // Bricht die Verbindung ab, bevor Twilio sich meldet, gäbe es sonst gar
    // keine Spur — und die Ergebnis-Pflicht liefe ins Leere.
    //
    // `ref` kommt aus der Zuordnung, nicht aus dem Body: Sonst hinge der
    // Verlaufseintrag weiter an der Bestellung der offenen Karte, während der
    // Anruf schon der richtigen Person gehört.
    // ── DIE HERKUNFT DER ZUORDNUNG STEHT DABEI (19.08.2026) ───────────────
    // Hier ist sie unstrittig: Diese Sitzung hat gewählt, also gehört ihr der
    // Anruf. Der Wert wird trotzdem geschrieben — sonst ist „gewaehlt" nur die
    // Abwesenheit von „zustaendigkeit", und eine Abwesenheit kann man nicht
    // von einem Versehen unterscheiden.
    const [c] = (await sqlPool`
      INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, status, von_nummer,
                               zuordnung_herkunft)
      VALUES (${echtePersonId}, ${zuordnung.person?.ref ?? null}, ${req.agent!.id},
              ${pruefung.nummer!}, 'gewaehlt', ${absender || null}, 'gewaehlt')
      RETURNING id
    `) as any[];

    res.json({
      ok: true, token: ausweis.token, identitaet: ausweis.identitaet,
      nummer: pruefung.nummer, callId: Number(c.id), maxMinuten: MAX_MINUTEN,
      // Damit das Panel „Du rufst [Name] an" anzeigen kann — und bei einer
      // unbekannten Nummer ausdrücklich sagt, dass die Zuordnung im
      // Ergebnis-Schritt nachgeholt werden muss.
      anruftPerson: zuordnung.person
        ? { id: zuordnung.person.personId, name: zuordnung.person.name, ref: zuordnung.person.ref }
        : null,
      anzeige: zuordnung.anzeige,
      mehrdeutig: zuordnung.mehrdeutig,
      zuordnungPflicht: zuordnung.person == null,
    });
  } catch (err) {
    console.error("[TELEFON] ausweis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EINGEHENDE ANRUFE
//
// ── EINRICHTUNG BEI TWILIO ─────────────────────────────────────────────────
// Console → Phone Numbers → die eigene Nummer → Voice Configuration:
//
//     A call comes in:  Webhook
//     URL:              https://www.fiaon.com/api/fiaon/telefon/eingehend
//     HTTP:             POST
//
// Das ist NICHT die TwiML-App (die ist für ausgehende Rufe aus dem Browser),
// sondern die Einstellung an der Nummer selbst.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /telefon/eingehend — ein Kunde ruft an.
 *
 * ── OFFEN, ABER NICHT UNGESCHÜTZT ─────────────────────────────────────────
 * Twilio ruft diese Adresse ohne Anmeldung auf, also muss sie offen sein. Sie
 * gibt aber NICHTS preis: Die Antwort ist TwiML, das Twilio ausführt — kein
 * Kundenname, keine Nummer, keine Historie steht darin. Wer die Adresse
 * fremd aufruft, bekommt eine Ansage für einen unbekannten Anrufer.
 *
 * Die Twilio-Signatur wird geprüft, wenn ein Auth-Token gesetzt ist.
 */
router.post("/telefon/eingehend", async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as any;
  const von = String(b.From || b.Caller || "");
  const sid = String(b.CallSid || "");
  res.type("text/xml");

  try {
    const {
      zustaendigFuer, twimlEingehend, eingehendProtokollieren,
    } = await import("../lib/fiaon-anruf-eingehend");

    const z = await zustaendigFuer(von);

    // ── DER ANRUF STEHT IM PROTOKOLL, BEVOR ES KLINGELT ───────────────────
    // Auch wenn niemand rangeht: Ein verpasster Anruf ist die wichtigste
    // Information von allen — da wollte jemand etwas und hat es nicht
    // bekommen. Ohne Eintrag ruft niemand zurück.
    const callId = sid
      ? await eingehendProtokollieren({
        twilioSid: sid, von, personId: z.person?.id ?? null,
        agentId: z.agentId, grundKennung: z.grundKennung,
      }).catch(() => null)
      : null;

    console.log(`[TELEFON] Eingehend von ${von}: ${z.person?.name ?? "unbekannt"}`
      + ` → ${z.agentName ?? "niemand"} (${z.grundKennung})`
      + `${callId ? ` · Anruf #${callId}` : ""}`);

    return res.send(twimlEingehend({
      z,
      ansage: await ansageText(),
      aufnahmeCallback: absoluteUrl("/api/fiaon/telefon/aufnahme"),
      statusCallback: absoluteUrl("/api/fiaon/telefon/status"),
      verpasstCallback: absoluteUrl("/api/fiaon/telefon/eingehend/nach-dial"),
    }));
  } catch (err) {
    console.error("[TELEFON] eingehend:", err);
    // ── EIN FEHLER DARF DEN ANRUFER NICHT INS LEERE LAUFEN LASSEN ─────────
    // Ohne diese Antwort hört der Kunde Twilios englische Standardmeldung
    // („an application error has occurred") — das ist schlimmer als ein
    // Besetztzeichen.
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Guten Tag. Es liegt gerade eine technische Störung vor. Wir sehen Ihren Anruf und melden uns zurück. Bitte entschuldigen Sie.</Say>
  <Hangup/>
</Response>`);
  }
});

/** POST /telefon/eingehend/nach-dial — Twilio meldet, wie das Klingeln ausging. */
router.post("/telefon/eingehend/nach-dial", async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as any;
  const stand = String(b.DialCallStatus || "");
  const sid = String(b.CallSid || "");
  res.type("text/xml");
  try {
    const { twimlNachDial } = await import("../lib/fiaon-anruf-eingehend");
    // Der Ausgang gehört in die Akte: „angenommen" oder „niemand ran".
    if (sid) {
      await sqlPool`
        UPDATE fiaon_calls
        SET status = ${stand === "completed" || stand === "answered" ? "beendet" : "verpasst"},
            ergebnis = COALESCE(ergebnis, ${
              stand === "completed" || stand === "answered" ? null : "nicht_angenommen"}),
            ende = COALESCE(ende, NOW()), updated_at = NOW()
        WHERE twilio_sid = ${sid}
      `.catch(() => {});
    }
    if (stand && stand !== "completed" && stand !== "answered") {
      console.warn(`[TELEFON] Eingehender Anruf nicht angenommen (${stand}) · ${sid}`);
    }
    return res.send(twimlNachDial(stand));
  } catch (err) {
    console.error("[TELEFON] nach-dial:", err);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response/>`);
  }
});

/**
 * GET /telefon/eingehend/wer-ist-zustaendig — für die Anzeige im Browser.
 *
 * Wenn das Softphone klingelt, weiß es nur die Nummer. Diese Route sagt, WER
 * anruft und WARUM er bei mir landet — damit der Mensch beim Abnehmen schon
 * weiß, worum es geht.
 */
router.get("/telefon/eingehend/wer-ist-zustaendig", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { zustaendigFuer } = await import("../lib/fiaon-anruf-eingehend");
    const z = await zustaendigFuer(String(req.query.von || ""));
    // Nur was für die Anzeige gebraucht wird. Keine Adresse, keine Historie.
    res.json({
      ok: true,
      kunde: z.person ? {
        id: z.person.id, name: z.person.name, paket: z.person.paket,
        tageOffen: z.person.tageOffen, offenCents: z.person.offenCents,
      } : null,
      grund: z.grund,
      grundKennung: z.grundKennung,
      /** Bin ICH der Zuständige — oder klingelt es bei mir als Vertretung? */
      fuerMich: z.agentId === req.agent!.id,
      zustaendig: z.agentVorname,
    });
  } catch (err) {
    console.error("[TELEFON] wer-ist-zustaendig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /telefon/kunde/:personId — die Stammdaten fürs laufende Gespräch.
 *
 * ── DER BEFUND (11.08.2026) ───────────────────────────────────────────────
 * Ein Agent: „Während des Anrufs kann ich die Stammdaten und Kundendetails
 * nicht vernünftig einsehen."
 *
 * Das Telefon zeigte Name, Dauer und Nummer. Wer gefragt wird „welches Paket
 * habe ich denn gebucht", musste das Gespräch verlassen.
 *
 * Diese Route liefert genau das, was am Telefon gebraucht wird — nicht die
 * ganze Akte: Buchungen, offener Betrag, Verwendungszweck, Ort. Wenige Felder,
 * damit die Antwort in Millisekunden da ist.
 */
// ═══════════════════════════════════════════════════════════════════════════
// WAS DAS ONBOARDING BEIM ANRUFEN BRAUCHT (21.08.2026)
//
// ── DIE MELDUNG ───────────────────────────────────────────────────────────
// „Onboarding ruft an und sieht weder Kundendaten noch die sieben Schritte."
//
// ── ZWEI URSACHEN, BEIDE HIER ─────────────────────────────────────────────
//  1. Die Antwort trug fünf Felder: Paket, offener Betrag, Verwendungszweck,
//     E-Mail, Ort. Für einen Verkäufer reicht das. Ein Startgespräch beginnt
//     aber mit „Sie haben bezahlt, jetzt richten wir Sie ein" — dafür braucht
//     es den Zahlungsstand, den Stand der Bonitätsauskunft und die offenen
//     Punkte. Nichts davon war dabei.
//  2. Der Termin fehlte. Das Cockpit mit den sieben Schritten
//     (`OnboardingCockpit`) braucht eine Termin-Kennung — und die gab es nur
//     auf der Seite /agent/startgespraeche. Wer aus dem Telefon heraus
//     arbeitete, kam nicht hin. Jetzt liegt der Termin in der Antwort, und das
//     Panel kann das Cockpit selbst öffnen.
//
// Die Bausteine kommen aus `fiaon-kundenlage.ts` — dieselben, die der
// Onboarding-Bereich und der Vertrieb benutzen. Eine eigene Fassung hier wäre
// die dritte Wahrheit über denselben Zahlungsstand.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/telefon/kunde/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      // ── DER GRUND STATT „KEIN ZUGRIFF" ────────────────────────────────
      // Der Client hat diese Antwort bisher verschluckt und „Wird geladen …"
      // stehen lassen — für den Menschen am Telefon nicht von einem Ausfall
      // zu unterscheiden. Jetzt steht da, WARUM, und was er tun kann.
      return res.status(403).json({
        ok: false,
        error: rolle === "onboarding"
          ? "Zu diesem Kunden hast du kein Startgespräch — deshalb siehst du seine Daten nicht. "
            + "Wenn der Termin bei dir liegen soll, lass ihn dir von der Leitung übergeben."
          : "Dieser Kunde wird von jemand anderem betreut.",
        rolle,
      });
    }
    const { buchungenVon, offenCents } = await import("../lib/fiaon-buchungen");
    const [p] = (await sqlPool`
      SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Ohne Namen') AS name,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS email,
             NULLIF(TRIM(CONCAT_WS(' ', p.zip, p.city)), '') AS ort,
             (SELECT MIN(a.created_at)::date FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL) AS kunde_seit
      FROM fiaon_persons p WHERE p.id = ${personId}
    `) as any[];
    const buchungen = await buchungenVon(personId);

    // ── DER OFFENE TERMIN DIESES MITARBEITERS ─────────────────────────────
    // Er entscheidet, ob das Panel den Knopf „Gespräch führen" zeigt. Nur
    // eigene Termine: Ein Cockpit zu einem fremden Startgespräch wäre eine
    // Zuständigkeitsübernahme durch die Hintertür.
    const [termin] = (await sqlPool`
      SELECT id, beginn, dauer_min, status, quelle, vertretung
      FROM fiaon_termine
      WHERE person_id = ${personId} AND agent_id = ${req.agent!.id}
        AND quelle = 'onboarding_call' AND abgesagt_am IS NULL
        AND status IN ('gebucht', 'verpasst')
      ORDER BY ABS(EXTRACT(EPOCH FROM (beginn - NOW()))) LIMIT 1
    `) as any[];

    // ── WER IST ZUSTÄNDIG? EINE ABLEITUNG (21.08.2026) ────────────────────
    // Das Panel hat diese Frage bisher gar nicht gestellt. Wer angerufen hat,
    // wusste nicht, ob er der Zuständige ist oder einspringt — und ein Anruf
    // aus der falschen Rolle beginnt mit dem falschen Satz.
    //
    // Dieselbe Funktion, die Terminvergabe, Übergabe und die Admin-Liste
    // lesen (server/lib/fiaon-zustaendigkeit.ts).
    const { zustaendigeRolle, ROLLEN_FUER } = await import("../lib/fiaon-zustaendigkeit");
    const zust = await zustaendigeRolle(personId);

    // Zahlungsstand, Unterlagen und Bonität — nur wenn jemand sie braucht.
    // Für den Vertrieb wäre es eine Abfrage ohne Leser.
    let lage: any = null;
    if (rolle === "onboarding" || termin) {
      const { zahlungsLage, dokumentLage } = await import("../lib/fiaon-kundenlage");
      const [zahlung, dokumente] = await Promise.all([
        zahlungsLage(personId).catch(() => null),
        dokumentLage(personId).catch(() => null),
      ]);
      lage = { zahlung, dokumente };
    }

    res.json({
      ok: true,
      kunde: {
        name: p?.name ?? null,
        email: p?.email ?? null,
        ort: p?.ort ?? null,
        kundeSeit: p?.kunde_seit
          ? new Date(p.kunde_seit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })
          : null,
        buchungen: buchungen.filter((b) => !b.erledigt),
        offenCents: offenCents(buchungen),
        // Der Verwendungszweck der ältesten offenen Buchung — den braucht man,
        // wenn der Kunde sagt „ich überweise gleich".
        verwendungszweck: buchungen.find((b) => b.offen)?.verwendungszweck ?? null,
        // ── FÜR DAS STARTGESPRÄCH ─────────────────────────────────────────
        paket: buchungen.find((b) => b.art === "paket")?.bezeichnung ?? null,
        zahlungsstand: buchungen.some((b) => b.offen)
          ? `Offen: ${(offenCents(buchungen) / 100).toFixed(2).replace(".", ",")} €`
          : buchungen.length > 0 ? "Bezahlt" : "Keine Bestellung",
        schufaStand: buchungen.find((b) => b.art === "bonitaet")
          ? (buchungen.find((b) => b.art === "bonitaet")!.bezahlt
              ? "Bonitätsauskunft bezahlt"
              : "Bonitätsauskunft bestellt, noch offen")
          : "Keine Bonitätsauskunft bestellt",
        offenePunkte: (lage?.dokumente?.fehlt ?? []) as string[],
        // ── DIE ZUSTÄNDIGKEIT, IM KLARTEXT ────────────────────────────────
        // `ichBinZustaendig` sagt dem Menschen am Telefon, ob er einspringt.
        // Es SPERRT nichts: Wer schon in der Leitung ist, soll das Gespräch
        // führen und nicht auf eine Rollenmeldung starren.
        zustaendig: zust
          ? {
              rolle: zust.rolle,
              grund: zust.grund,
              ichBinZustaendig: ROLLEN_FUER[zust.rolle].includes(String(rolle)),
              betreuerName: zust.agentName,
              betreuerRolle: zust.agentRolle,
              vertretung: zust.vertretung,
            }
          : null,
        termin: termin
          ? {
              id: Number(termin.id),
              beginn: new Date(termin.beginn).toISOString(),
              dauerMin: Number(termin.dauer_min ?? 15),
              status: String(termin.status),
              vertretung: termin.vertretung === true,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("[TELEFON] kunde:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/ansage — was der ANGERUFENE hört, bevor verbunden wird.
 *
 * ── WARUM DAS EINE EIGENE ADRESSE BRAUCHT ─────────────────────────────────
 * Ein Agent: „Die angekündigte Durchsage scheint nur ich zu hören, nicht der
 * Kunde."
 *
 * Die Ansage stand als <Say> VOR dem <Dial> — bei einem Anruf aus dem Browser
 * ist der Agent der Anrufer, also hörte nur er sie. Der Kunde wurde ohne
 * Hinweis aufgezeichnet; §201 StGB verlangt aber, dass der Hinweis den
 * erreicht, der aufgezeichnet wird.
 *
 * Twilio ruft diese Adresse auf, sobald der Kunde abnimmt. Was hier steht,
 * hört er — dann werden beide Seiten verbunden.
 */
router.all("/telefon/ansage", async (_req: Request, res: Response) => {
  try {
    const text = await ansageText();
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE" voice="Polly.Vicki">${
      String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }</Say></Response>`);
  } catch (err) {
    console.error("[TELEFON] ansage:", err);
    // Lieber eine kurze Standardansage als gar keine: Ohne Hinweis darf nicht
    // aufgezeichnet werden.
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE" voice="Polly.Vicki">Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet.</Say></Response>`);
  }
});

/**
 * POST /telefon/twiml — Twilio fragt, was zu tun ist.
 *
 * Kommt von außen. Deshalb wird die Nummer HIER noch einmal geprüft: Wer den
 * Ausweis abgreift, könnte sonst eine beliebige Nummer wählen.
 */
router.post("/telefon/twiml", async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    // Reihenfolge mit Absicht: `An` und `Ziel` sind unsere eigenen, nicht
    // reservierten Namen. `To` steht ganz hinten — Twilio setzt es bei
    // Browser-Anrufen selbst auf die Client-Identität und überschreibt dabei
    // einen gleichnamigen eigenen Parameter. Wer sich darauf verlässt,
    // bekommt eine leere Nummer.
    const an = String(b?.An || b?.Ziel || b?.PhoneNumber || b?.To || "");

    // ══════════════════════════════════════════════════════════════════════
    // DIE ANRUF-ZEILE REIST MIT (22.08.2026)
    //
    // ── DER BEFUND ────────────────────────────────────────────────────────
    // Twilio meldete Status und Aufnahme nur mit seiner CallSid. Der Server
    // kannte die SID aber noch nicht und nahm ersatzweise „die jüngste
    // gewählte Zeile ohne SID" — von IRGENDEINEM Agenten. Wählten zwei
    // Kollegen binnen Sekunden, bekam der eine die SID (und damit Aufnahme,
    // Transkript und KI-Zusammenfassung) des anderen. Gemessen gegen Twilios
    // eigene Aufzeichnung: 194 von 1.613 Anrufen (12 %), 132 Aufnahmen am
    // falschen Kunden, 56 Akten mit fremder Gesprächszusammenfassung.
    //
    // ── DIE LÖSUNG ────────────────────────────────────────────────────────
    // Der Browser gibt die Kennung der Zeile (`Anruf`) mit. Twilio schickt
    // diese Parameter an die TwiML-Anfrage — zusammen mit der CallSid. Hier,
    // und nur hier, werden beide zum ersten Mal gemeinsam gesehen: Die SID
    // wird an GENAU diese Zeile gebunden, und die Kennung wandert als
    // `?anruf=` in beide Callback-URLs, damit auch Status und Aufnahme die
    // Zeile kennen, ohne raten zu müssen.
    //
    // `From` ist bei Browser-Anrufen `client:agent-<id>` — die Bindung gilt
    // nur, wenn die Zeile demselben Agenten gehört. Eine gefälschte Kennung
    // kann so keinen fremden Anruf kapern.
    // ══════════════════════════════════════════════════════════════════════
    const anrufId = Number(String(b?.Anruf || "").replace(/\D/g, "")) || null;
    const callSid = String(b?.CallSid || "");
    const vonClient = String(b?.From || "");
    if (anrufId && callSid) {
      await sqlPool`
        UPDATE fiaon_calls
        SET twilio_sid = COALESCE(twilio_sid, ${callSid}), updated_at = NOW()
        WHERE id = ${anrufId} AND status = 'gewaehlt'
          AND (${vonClient} = '' OR ${vonClient} = 'client:agent-' || agent_id::text)
      `.catch((e) => console.error("[TELEFON] twiml: SID-Bindung fehlgeschlagen", e));
    }
    const mitKennung = (pfad: string) => absoluteUrl(pfad) + (anrufId ? `?anruf=${anrufId}` : "");

    // ── WAS WIRKLICH ANKAM, WIRD AUFGESCHRIEBEN ─────────────────────────
    // Diese Route ist die einzige Stelle, an der man sieht, was Twilio
    // übergibt. Ohne diesen Vermerk bleibt „die To-Spalte ist leer" eine
    // Beobachtung ohne Ursache. Die Diagnose zeigt den letzten Aufruf.
    const { letztenTwimlAufrufMerken } = await import("../lib/fiaon-telefon-diagnose");
    await letztenTwimlAufrufMerken({
      an, roh: Object.fromEntries(
        Object.entries(b ?? {}).filter(([k]) => !/token|secret|signature/i.test(k)),
      ),
    }).catch(() => {});

    const pruefung = await wahlPruefen(an);
    res.type("text/xml");
    if (!pruefung.erlaubt) {
      console.error(`[TELEFON] TwiML ohne wählbare Nummer. Angekommen: ${JSON.stringify(Object.keys(b ?? {}))}`);
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">${an
        ? "Diese Nummer darf nicht gewählt werden."
        : "Es wurde keine Rufnummer übergeben. Bitte im Verwaltungsbereich die Telefon-Diagnose öffnen."
      }</Say><Hangup/></Response>`);
    }
    res.send(twimlAusgehend({
      an: pruefung.nummer!,
      von: process.env.TWILIO_CALLER_ID || "",
      ansage: await ansageText(),
      aufnahmeCallback: mitKennung("/api/fiaon/telefon/aufnahme"),
      statusCallback: mitKennung("/api/fiaon/telefon/status"),
      // Die Ansage wird dem ANGERUFENEN vorgelesen, sobald er abnimmt.
      ansageUrl: absoluteUrl("/api/fiaon/telefon/ansage"),
    }));
  } catch (err) {
    console.error("[TELEFON] twiml:", err);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">Es ist ein Fehler aufgetreten.</Say><Hangup/></Response>`);
  }
});

/** POST /telefon/status — Twilio meldet Ende und Dauer. */
router.post("/telefon/status", async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const sid = String(b?.CallSid || "");
    const dauer = Number(b?.DialCallDuration ?? b?.CallDuration ?? 0);
    const status = String(b?.DialCallStatus || b?.CallStatus || "");
    // ── WELCHE ZEILE? IN DIESER REIHENFOLGE, NIE „IRGENDWER" ───────────────
    //   1. die Kennung aus der Callback-URL (seit 22.08.2026 immer dabei)
    //   2. die SID, falls sie schon gebunden ist
    //   3. Übergang für Browser mit altem Skript: die jüngste gewählte Zeile
    //      DESSELBEN Agenten (`From` = client:agent-<id>) — nicht mehr die
    //      jüngste von allen. Das war der Fehler, der 132 Aufnahmen an den
    //      falschen Kunden hängte.
    const anrufId = Number(String(req.query?.anruf || "").replace(/\D/g, "")) || null;
    const agentAusClient = Number(/^client:agent-(\d+)$/.exec(String(b?.From || ""))?.[1] || 0) || null;
    if (sid) {
      // Erst die Zeile bestimmen, DANN schreiben — damit der Weg dorthin
      // aufgeschrieben werden kann. Weg 3 (jüngste Zeile desselben Agenten,
      // ohne Kennung) ist eine Vermutung: Er funktioniert, aber er wird als
      // solcher markiert, damit der Tagesabgleich ihn gegenprüft.
      const [ziel] = (await sqlPool`
        SELECT id, weg FROM (
          SELECT id, 1 AS weg FROM fiaon_calls WHERE id = ${anrufId} AND (twilio_sid IS NULL OR twilio_sid = ${sid})
          UNION ALL
          SELECT id, 2 FROM fiaon_calls WHERE twilio_sid = ${sid}
          UNION ALL
          SELECT id, 3 FROM fiaon_calls WHERE twilio_sid IS NULL AND status = 'gewaehlt'
            AND ${agentAusClient}::int IS NOT NULL AND agent_id = ${agentAusClient}
          ORDER BY weg, id DESC
        ) t ORDER BY weg LIMIT 1
      `) as any[];
      if (ziel) {
        await sqlPool`
          UPDATE fiaon_calls
          SET twilio_sid = COALESCE(twilio_sid, ${sid}),
              ende = NOW(), dauer_sek = ${dauer || null},
              status = ${status === "completed" ? "beendet" : status === "no-answer" || status === "busy" ? "abgelehnt" : "fehlgeschlagen"},
              zuordnung_unklar_grund = CASE WHEN ${Number(ziel.weg) === 3} AND zuordnung_unklar_grund IS NULL
                THEN 'status-ohne-kennung (Fallback jüngste Zeile des Agenten)' ELSE zuordnung_unklar_grund END,
              updated_at = NOW()
          WHERE id = ${ziel.id}
        `;
        if (Number(ziel.weg) === 3) console.warn(`[TELEFON] Status ohne Kennung: SID ${sid} per Fallback an Anruf ${ziel.id} (Agent ${agentAusClient}) gebunden — bitte Abgleich beachten.`);
      } else {
        console.error(`[TELEFON] Status-Callback ohne passende Zeile: SID ${sid}, anruf=${anrufId}, From=${String(b?.From || "")} — NICHT zugeordnet (kein Raten).`);
      }
    }
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  } catch (err) {
    console.error("[TELEFON] status:", err);
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
});

/** POST /telefon/aufnahme — Twilio meldet die fertige Aufnahme. */
router.post("/telefon/aufnahme", async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const sid = String(b?.CallSid || "");
    const url = String(b?.RecordingUrl || "");
    // Dieselbe Reihenfolge wie im Status-Callback: Kennung vor SID. Eine
    // Aufnahme an der falschen Zeile ist ein Datenschutzfall — die
    // Zusammenfassung eines fremden Gesprächs in der Akte eines Kunden.
    const anrufId = Number(String(req.query?.anruf || "").replace(/\D/g, "")) || null;
    if (sid && url) {
      // `recording_url` wird NIE überschrieben: Hängt an der Zeile schon eine
      // andere Aufnahme (anderer RecordingSid), ist das ein Konfliktfall —
      // dann lieber laut scheitern als leise die Akte eines Kunden mit einem
      // fremden Gespräch füllen (das war der Kern von E-012).
      const [c] = (await sqlPool`
        UPDATE fiaon_calls
        SET recording_url = COALESCE(recording_url, ${`${url}.mp3`}),
            recording_sid = COALESCE(recording_sid, ${String(b?.RecordingSid || "")}),
            twilio_sid = COALESCE(twilio_sid, ${sid}),
            dauer_sek = COALESCE(dauer_sek, ${Number(b?.RecordingDuration ?? 0) || null}),
            updated_at = NOW()
        WHERE id = COALESCE(
          (SELECT id FROM fiaon_calls WHERE id = ${anrufId} AND (twilio_sid IS NULL OR twilio_sid = ${sid})),
          (SELECT id FROM fiaon_calls WHERE twilio_sid = ${sid} ORDER BY id LIMIT 1)
        )
          AND (recording_sid IS NULL OR recording_sid = ${String(b?.RecordingSid || "")})
        RETURNING id
      `) as any[];
      if (!c) {
        // Eine Aufnahme ohne Zeile ist ein Datenschutz-Vorfall in Wartestellung:
        // Sie darf NIRGENDS hingeraten werden. Laut melden + in Justins Liste.
        console.error(`[TELEFON] AUFNAHME OHNE ZEILE: CallSid ${sid}, RecordingSid ${String(b?.RecordingSid || "")}, anruf=${anrufId} — nicht zugeordnet.`);
        await sqlPool`
          INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, quelle, letzte_aktivitaet)
          VALUES ('Telefon: Aufnahme ohne Zuordnung',
                  ${`Twilio meldete eine Aufnahme, die zu keiner Anruf-Zeile passt. CallSid ${sid}, RecordingSid ${String(b?.RecordingSid || "")}, anruf-Kennung ${anrufId ?? "fehlt"}. In Twilio prüfen und von Hand zuordnen — nichts raten.`},
                  'telefon', 1, 'telefon-abgleich', NOW())
        `.catch(() => {});
      }
      // Nachbereitung im Hintergrund: Der Rückruf von Twilio darf nicht
      // minutenlang offen bleiben, sonst wiederholt Twilio ihn.
      if (c) {
        void anrufNachbereiten(Number(c.id)).catch((e) =>
          console.error("[TELEFON] Nachbereitung:", e));
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] aufnahme:", err);
    res.json({ ok: true });
  }
});

/**
 * POST /telefon/:id/ergebnis — das Gespräch dokumentieren.
 *
 * Läuft durch `ergebnisAnwenden` — denselben Weg wie der Handeintrag in der
 * Kundenliste. Kein zweiter Weg, der eines Tages anders rechnet.
 */
// ═══════════════════════════════════════════════════════════════════════════
// VERBINDUNGSZUSTÄNDE EINES LAUFENDEN ANRUFS
//
// ── WARUM DIESE ROUTE EXISTIERT ────────────────────────────────────────────
// Meldung: „Der Kunde nimmt ab, aber es spricht niemand." Bei Einweg-Audio ist
// meist der Medienpfad in eine Richtung nicht aufgebaut — sichtbar NUR im
// ICE-Zustand der Verbindung, und der lebt im Browser und ist nach dem Auflegen
// weg. Wer hinterher fragt, hat keine Daten.
//
// Die Zustände landen als Notiz am Anruf. Absichtlich KEINE eigene Tabelle: Es
// sind wenige Zeilen je Gespräch, sie gehören zum Anruf, und eine Tabelle für
// Diagnose-Schnipsel wäre eine Tabelle, die niemand pflegt.
//
// ── WAS HIER NICHT PASSIERT ────────────────────────────────────────────────
// Keine Deutung. Der Server schreibt auf, was der Browser gesehen hat. Ob es
// die Region, der Codec oder eine Firewall war, entscheidet ein Mensch mit
// Twilios Sicht daneben — die Vermutungen stehen im Report, nicht im Code.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/telefon/:id/verbindung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const art = String(req.body?.art || "").slice(0, 24);
    const wert = String(req.body?.wert || "").slice(0, 64);
    if (!id || !art || !wert) return res.status(400).json({ ok: false, error: "Unvollständig." });

    // Nur am EIGENEN Anruf. Ohne diese Bedingung könnte jeder Agent Notizen an
    // fremde Gespräche hängen.
    const pegel = req.body?.pegel;
    const zeile = `[${new Date().toISOString().slice(11, 19)}] ${art}=${wert}`
      + (typeof pegel === "number" ? ` pegel=${Math.round(pegel)}` : "");
    const rows = await sqlPool`
      UPDATE fiaon_calls
      SET transkript_grund = LEFT(COALESCE(transkript_grund || ' | ', '') || ${zeile}, 2000),
          updated_at = NOW()
      WHERE id = ${id} AND agent_id = ${req.agent!.id}
      RETURNING id
    `;
    if ((rows as any[]).length === 0) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    // Auch ins Log: Bei einem gehäuften Muster sucht man nicht 200 Anrufe
    // einzeln durch.
    if (art === "ice" && wert === "failed") {
      console.warn(`[TELEFON] ICE failed an Anruf ${id} (Agent ${req.agent!.id}) — Einweg-Audio-Verdacht.`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] verbindung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/telefon/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ergebnis = String(req.body?.ergebnis || "");

    const [c] = (await sqlPool`
      SELECT id, person_id, ref, agent_id FROM fiaon_calls WHERE id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (Number(c.agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Das ist nicht dein Anruf." });
    }

    // ══════════════════════════════════════════════════════════════════════
    // EIN INKASSO-ANRUF BEKOMMT EIN RATEN-ERGEBNIS (22.08.2026, V-7)
    //
    // Kommt der Anruf aus dem Forderungsmanagement, trägt er die Rate mit
    // (`rateId`). Dann gilt hier NICHT die Vertriebskette (Übergabe bei
    // „blockiert", Nachschub, Tier) — sondern dieselbe Funktion wie der
    // Ergebnis-Knopf an der Rate. Ein Anruf, ein Ergebnis, eine Prämie.
    // ══════════════════════════════════════════════════════════════════════
    const rateId = Number(req.body?.rateId || 0);
    if (rateId > 0) {
      const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
      const rolle = await rolleVon(req.agent!.id);
      if (!["inkasso", "vertriebsleiter", "admin"].includes(rolle)) {
        return res.status(403).json({ ok: false, error: "Raten-Ergebnisse hält nur das Forderungsmanagement fest." });
      }
      const { istRatenErgebnis, ratenErgebnisAnwenden } = await import("../lib/fiaon-inkasso");
      if (!istRatenErgebnis(ergebnis)) return res.status(400).json({ ok: false, error: "Unbekanntes Raten-Ergebnis." });
      const erg = await ratenErgebnisAnwenden({
        rateId, ergebnis, agentId: req.agent!.id, agentName: req.agent!.name,
        zusageDatum: req.body?.zusageDatum || null,
        notiz: req.body?.notiz ? String(req.body.notiz).trim() : null,
      });
      if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler, brauchtNotiz: ergebnis === "eskalation" });
      await sqlPool`
        UPDATE fiaon_calls
        SET ergebnis = ${`rate_${ergebnis}`}, ergebnis_am = NOW(), updated_at = NOW(),
            status = CASE WHEN status = 'laeuft' THEN 'beendet' ELSE status END,
            ende = COALESCE(ende, NOW())
        WHERE id = ${id}
      `;
      return res.json({ ok: true, meldung: erg.meldung ?? "Ergebnis an der Rate festgehalten.", wiedervorlage: erg.wiedervorlage ?? null });
    }

    if (!istErgebnis(ergebnis)) return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis." });

    let ref = c.ref as string | null;
    if (!ref && c.person_id) {
      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ${c.person_id} AND merged_into IS NULL AND archived_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      ref = a?.ref ?? null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // DERSELBE WEG WIE DIE LISTE — NICHT NUR DERSELBE ZUSTAND
    //
    // ── DER BEFUND (16.08.2026) ───────────────────────────────────────────
    // Team: „‚Nicht erreicht' aus dem Panel wirkt nicht auf die Kundenliste;
    // über die Liste direkt schon."
    //
    // Hier stand `ergebnisAnwenden` — das ist der ZUSTAND (Zähler,
    // Wiedervorlage), aber nicht der VERLAUF. Den schrieben die Listenrouten
    // selbst. Also: Der Zähler stieg, die Akte blieb leer, die Karte sah
    // unverändert aus, und der Agent hielt das Panel für kaputt.
    //
    // GEMESSEN: 554 von 842 Anrufen mit Ergebnis hatten keinen
    // Verlaufseintrag. Drei vereinbarte Rückrufe hatten keinen
    // Kalendereintrag — sie wären nie fällig geworden.
    //
    // `ergebnisNachbereiten` ist ab jetzt die EINE Kette: Verlauf, Zustand,
    // Nummern-Mail, Übergabe, Nachschub. Panel und Liste rufen dieselbe.
    // ══════════════════════════════════════════════════════════════════════
    const notiz = req.body?.notiz ? String(req.body.notiz).trim() : null;

    // ── „ERREICHT — SONSTIGES" BRAUCHT EINE NOTIZ ────────────────────────
    // Ohne sie ist das Ergebnis ein erledigter Haken und keine Auskunft:
    // „Erreicht, Sonstiges" sagt dem nächsten Menschen am Telefon NICHTS.
    // GEMESSEN: siebenmal im Panel gedrückt — dort gab es gar kein Notizfeld.
    if (ergebnis === "erreicht_sonstiges" && (notiz ?? "").length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Bei „Erreicht — Sonstiges“ ist eine Notiz Pflicht: Was wurde besprochen "
          + "oder vereinbart? (mindestens 10 Zeichen)",
        brauchtNotiz: true,
      });
    }

    const terminZeitpunkt = req.body?.terminDatum
      ? (/T\d{2}:\d{2}/.test(String(req.body.terminDatum))
          ? String(req.body.terminDatum)
          : `${String(req.body.terminDatum)}T10:00:00`)
      : null;

    const nach = c.person_id && ref
      ? await ergebnisNachbereiten({
          ref, personId: Number(c.person_id), ergebnis: ergebnis as any,
          notiz,
          zusageDatum: req.body?.zusageDatum || null,
          terminZeitpunkt,
          akteur: { id: req.agent!.id, name: req.agent!.name },
          herkunft: "telefon",
        })
      : null;
    const wirkung = nach?.wirkung
      ?? { meldung: nach?.meldung ?? "Ergebnis festgehalten.", wiedervorlage: null, zusage: null, gesperrt: false };

    // ══════════════════════════════════════════════════════════════════════
    // EIN ERGEBNIS GILT FÜR DAS GESPRÄCH, NICHT FÜR DEN VERBINDUNGSVERSUCH
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Trotz dass ich nach dem Telefonat ein Ergebnis gedrückt habe,
    // steht die Person ohne Ergebnis da. Beim Telefon steht dann 1 Person ohne
    // Ergebnis, obwohl ein Ergebnis festgehalten wurde."
    //
    // Gemessen: Von zwölf Anrufen ohne Ergebnis hatten FÜNF einen anderen
    // Anruf MIT Ergebnis beim selben Kunden im selben Zeitfenster. Der Agent
    // hat also festgehalten — nur an einem von zwei Einträgen.
    //
    // Woher die zwei kommen: Ein Wählversuch, der nach drei Sekunden abbricht
    // (besetzt, Mailbox, Fehlverbindung), erzeugt eine Zeile. Der zweite
    // Versuch, der klappt, eine weitere. Das Ergebnis landet am zweiten — der
    // erste bleibt für immer „offen".
    //
    // ── DAS ERGEBNIS GILT FÜR ALLE VERSUCHE DESSELBEN GESPRÄCHS ───────────
    // Zwei Stunden Fenster: Wer denselben Menschen morgens und nachmittags
    // anruft, hat zwei Gespräche und braucht zwei Ergebnisse. Wer es dreimal
    // in fünf Minuten versucht, hat EIN Gespräch.
    // ══════════════════════════════════════════════════════════════════════
    const mitErfasst = (await sqlPool`
      UPDATE fiaon_calls
      SET ergebnis = ${ergebnis}, ergebnis_am = NOW(), updated_at = NOW(),
          -- Ein Versuch, der auf „läuft" hängen blieb, ist mit dem Ergebnis
          -- beendet. Sonst steht er morgen noch in der Liste.
          status = CASE WHEN status = 'laeuft' THEN 'beendet' ELSE status END,
          ende = COALESCE(ende, NOW()),
          -- ── DIE ZUORDNUNG IST JETZT BELEGT (19.08.2026) ────────────────
          -- Diese Route hat oben geprueft, dass agent_id die eigene Kennung
          -- ist („Das ist nicht dein Anruf"). Wer hier ein Ergebnis setzt, hat
          -- das Gespraech also gefuehrt — aus der Ableitung wird ein Nachweis.
          -- Eine Herkunft „gewaehlt" bleibt stehen; sie ist nicht schwaecher.
          zuordnung_herkunft = CASE WHEN COALESCE(zuordnung_herkunft, '') = 'zustaendigkeit'
                                    THEN 'ergebnis' ELSE zuordnung_herkunft END
      WHERE id = ${id}
         OR (
           ergebnis IS NULL
           AND agent_id = ${req.agent!.id}
           AND person_id IS NOT NULL
           AND person_id = ${c.person_id}
           AND beginn BETWEEN
             (SELECT beginn FROM fiaon_calls WHERE id = ${id}) - INTERVAL '2 hours'
             AND (SELECT beginn FROM fiaon_calls WHERE id = ${id}) + INTERVAL '2 hours'
         )
      RETURNING id
    `) as any[];
    if (mitErfasst.length > 1) {
      console.log(`[TELEFON] Ergebnis „${ergebnis}" für ${mitErfasst.length} Versuche `
        + `desselben Gesprächs (Anruf #${id}, Person ${c.person_id}).`);
    }
    // Die Notiz gehört auch an den ANRUF: Wer die Aufnahme später anhört,
    // findet daneben, was der Agent verstanden hat.
    if (notiz) {
      await sqlPool`
        UPDATE fiaon_calls SET ergebnis_notiz = ${notiz.slice(0, 4000)}, updated_at = NOW()
        WHERE id = ${id}
      `.catch(() => {});
    }
    res.json({
      ok: true, ...wirkung,
      meldung: nach?.meldung ?? (wirkung as any).meldung,
      nummerMail: nach?.nummerMail,
      uebergabe: nach?.uebergabe,
      offene: await offeneAnrufe(req.agent!.id),
    });
  } catch (err) {
    console.error("[TELEFON] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /telefon/person/:personId/anrufe — für die Akte. */
router.get("/telefon/person/:personId/anrufe", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    res.json({
      ok: true,
      anrufe: await sqlPool`
        SELECT c.id, c.nummer, c.beginn, c.dauer_sek, c.status, c.ergebnis, c.ergebnis_am,
               c.transkript_status, c.transkript_grund, c.zusammenfassung, c.transkript,
               (c.transkript IS NOT NULL) AS hat_transkript,
               -- Die Twilio-URL selbst kommt NIE ins Frontend: Sie ist ohne
               -- Ablauf gültig und öffnet mit Basic-Auth die Aufnahme. Nach
               -- außen geht nur, OB es eine gibt.
               (c.recording_url IS NOT NULL AND c.aufnahme_geloescht_am IS NULL) AS hat_aufnahme,
               c.aufnahme_geloescht_am, c.ohne_aufzeichnung_am,
               COALESCE(NULLIF(a.first_name, ''), a.name) AS agent
        FROM fiaon_calls c LEFT JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE c.person_id = ${personId}
        ORDER BY c.beginn DESC LIMIT 50
      `,
      // Die Frist muss in der Akte stehen: „Diese Aufnahme wird am 12.11.
      // gelöscht" ist eine Information, „Aufnahmen werden irgendwann
      // gelöscht" ist keine.
      fristTage: await aufnahmeFrist(),
    });
  } catch (err) {
    console.error("[TELEFON] anrufe:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /telefon/:id/aufnahme — die Aufnahme abspielen.
 *
 * ── WARUM DIE TWILIO-URL NIE INS FRONTEND GEHÖRT ───────────────────────────
 * Sie ist unbefristet gültig und öffnet mit den Konto-Zugangsdaten die
 * Aufnahme eines Kundengesprächs. Wer sie einmal aus dem Netzwerkprotokoll
 * kopiert, kann das Gespräch morgen noch abspielen — auch wenn er längst
 * keinen Zugang mehr hat.
 *
 * Deshalb wird sie hier SERVERSEITIG geholt und der Datenstrom durchgereicht.
 * Die Rechteprüfung sitzt vor dem Abruf, und der Abruf wird protokolliert:
 * Wer ein Gespräch anhört, soll das nachvollziehbar tun.
 */
router.get("/telefon/:id/aufnahme", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    // ── HERUNTERLADEN IST DERSELBE WEG (19.08.2026) ──────────────────────
    // Der Auftrag nannte eine „signierte URL". Sie wäre hier ein Rückschritt:
    // Eine signierte Adresse ist gültig, solange die Signatur gilt — auch für
    // den, der sie aus dem Netzwerkprotokoll kopiert und weitergibt.
    //
    // Diese Route ist an die SITZUNG gebunden (`requireAgent`), prüft bei jedem
    // Abruf die Zuständigkeit und reicht den Datenstrom serverseitig durch. Wer
    // die Adresse weitergibt, gibt nichts weiter. Der Unterschied zum Abspielen
    // ist deshalb nur die Kopfzeile — und der Protokolleintrag.
    const laden = String(req.query.laden || "") === "1";
    const [c] = (await sqlPool`
      SELECT c.id, c.recording_url, c.person_id, c.agent_id, c.aufnahme_geloescht_am,
             c.beginn,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name) AS kunde
      FROM fiaon_calls c
      LEFT JOIN fiaon_persons p ON p.id = c.person_id
      WHERE c.id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (c.aufnahme_geloescht_am) {
      return res.status(410).json({
        ok: false,
        error: "Diese Aufnahme ist nach Ablauf der Aufbewahrungsfrist gelöscht worden.",
      });
    }
    if (!c.recording_url) {
      return res.status(404).json({ ok: false, error: "Zu diesem Anruf gibt es keine Aufnahme." });
    }

    const rolle = await rolleVon(req.agent!.id);
    if (c.person_id && !(await darfAnKunde(req.agent!.id, rolle, Number(c.person_id)))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID || "";
    const tok = process.env.TWILIO_AUTH_TOKEN || "";
    if (!sid || !tok) {
      return res.status(503).json({ ok: false, error: "Telefonie ist nicht eingerichtet." });
    }
    const quelle = String(c.recording_url).endsWith(".mp3")
      ? String(c.recording_url)
      : `${c.recording_url}.mp3`;
    const r = await fetch(quelle, {
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") },
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    if (!r || !r.ok || !r.body) {
      return res.status(502).json({
        ok: false,
        error: `Die Aufnahme war bei Twilio nicht abrufbar (HTTP ${r?.status ?? "keine Antwort"}).`,
      });
    }

    // Wer hört zu? Das gehört in die Akte.
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${c.person_id ?? null}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${laden
                ? `Aufnahme von Anruf ${id} HERUNTERGELADEN.`
                : `Aufnahme von Anruf ${id} angehört.`}, NOW())
    `.catch(() => {});

    res.setHeader("Content-Type", "audio/mpeg");
    // Kein Zwischenspeichern: Die Aufnahme kann jederzeit gelöscht werden, und
    // ein Browser-Cache würde sie überleben.
    res.setHeader("Cache-Control", "no-store, private");

    if (laden) {
      // ── DER DATEINAME: kunde_datum.mp3 ────────────────────────────────
      // Er landet im Download-Ordner eines Menschen, zwischen hundert anderen
      // Dateien. „aufnahme.mp3" ist dort verloren; „mueller_2026-08-19.mp3"
      // findet man wieder.
      //
      // Umlaute und Leerzeichen werden ersetzt, nicht gelöscht: Aus „Müller
      // Schmidt" wird „mueller_schmidt" und nicht „mllerschmidt".
      const roh = String(c.kunde || "kunde").toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "kunde";
      const tag = new Date(c.beginn ?? Date.now())
        .toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
      res.setHeader("Content-Disposition",
        `attachment; filename="${roh}_${tag}.mp3"`);
    }
    const { Readable } = await import("node:stream");
    Readable.fromWeb(r.body as any).pipe(res);
  } catch (err) {
    console.error("[TELEFON] aufnahme:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /telefon/:id/nachbereiten — Transkript nachholen. */
router.post("/telefon/:id/nachbereiten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await anrufNachbereiten(Number(req.params.id));
    res.json({ ok: erg.ok, grund: erg.grund ?? null });
  } catch (err) {
    console.error("[TELEFON] nachbereiten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dokumente/:personId — der Stand. Für alle Rollen; Inhalte nicht. */
router.get("/dokumente/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    const stand = await dokumentStand({ personId, rolle }, sqlPool);
    if (!stand) return res.json({ ok: true, stand: null });
    res.json({ ok: true, stand });
  } catch (err) {
    console.error("[DOK] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/dokumente/:ref — Betreiberansicht mit Inhalten. */
router.get("/admin/dokumente/:ref", async (req: Request, res: Response) => {
  try {
    const stand = await dokumentStand({ ref: String(req.params.ref), rolle: "admin" }, sqlPool);
    res.json({ ok: true, stand });
  } catch (err) {
    console.error("[DOK] admin stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/dokumente/:ref/:art/datei — der Inhalt.
 *
 * Hinter dem Admin-Code-Gate. Die Rollenprüfung steckt zusätzlich in
 * `dokumentInhalt` — eine Route, die man versehentlich woanders mountet,
 * gibt trotzdem nichts heraus.
 */
router.get("/admin/dokumente/:ref/:art/datei", async (req: Request, res: Response) => {
  try {
    const art = String(req.params.art);
    if (!istDokumentArt(art)) return res.status(400).json({ ok: false, error: "Unbekannte Dokumentart." });
    const erg = await dokumentInhalt(String(req.params.ref), art, "admin");
    if (!erg.ok) return res.status(erg.code).json({ ok: false, error: erg.grund });
    res.setHeader("Content-Type", erg.typ);
    res.setHeader("Content-Disposition", `inline; filename="${req.params.ref}-${art}"`);
    // Kein Zwischenspeicher: Ein Ausweis hat in keinem Proxy etwas verloren.
    res.setHeader("Cache-Control", "no-store, private");
    res.send(erg.daten);
  } catch (err) {
    console.error("[DOK] datei:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /agent/dokumente/:personId/:art/datei — für Team und Leitung.
 *
 * Antwortet ausdrücklich mit 403 und dem Wortlaut aus der
 * Verpflichtungserklärung. Bis heute stand diese Grenze NUR im Text der
 * Erklärung; jetzt steht sie im Code.
 */
router.get("/agent/dokumente/:personId/:art/datei", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const art = String(req.params.art);
    if (!istDokumentArt(art)) return res.status(400).json({ ok: false, error: "Unbekannte Dokumentart." });
    const rolle = await rolleVon(req.agent!.id);
    const [p] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${Number(req.params.personId)} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Keine Bestellung gefunden." });
    const erg = await dokumentInhalt(String(p.ref), art, rolle);
    if (!erg.ok) return res.status(erg.code).json({ ok: false, error: erg.grund });
    res.setHeader("Content-Type", erg.typ);
    res.setHeader("Cache-Control", "no-store, private");
    res.send(erg.daten);
  } catch (err) {
    console.error("[DOK] agent datei:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/dokumente/:personId/:art/hochladen — der Mitarbeiter lädt HOCH.
 *
 * ── WARUM (Justin, 24.08.2026) ────────────────────────────────────────────
 * „Wenn man die Akte geöffnet hat, unter ‚Dokumente‘ soll auch der Mitarbeiter
 * für den Kunden was hochladen können (PRAXIS: falls der Kunde es nicht
 * schafft…)."
 *
 * Der gemessene Alltag gibt ihm recht: Viele Kunden schicken den Ausweis als
 * Handyfoto per WhatsApp oder Mail an den Mitarbeiter, weil sie am Portal
 * scheitern. Bisher endete das dort — der Mitarbeiter konnte das Dokument
 * ansehen, aber nicht in die Akte legen. Der Kunde galt weiter als „Unterlagen
 * fehlen", obwohl sie längst da waren.
 *
 * ── DIE GRENZE BLEIBT ─────────────────────────────────────────────────────
 * HOCHLADEN darf jeder, der den Kunden betreut. ANSEHEN darf weiterhin nur die
 * Leitung (`darfInhalt`) — das steht so in der Verpflichtungserklärung, die
 * jeder unterschrieben hat, und ändert sich hier nicht. Der Mitarbeiter legt
 * das Dokument also ab, ohne es danach im Portal wieder öffnen zu können.
 * Das ist gewollt: Er hat es ohnehin schon auf dem Telefon.
 *
 * ── NACHVOLLZIEHBARKEIT ───────────────────────────────────────────────────
 * Jeder Upload durch einen Mitarbeiter schreibt eine Zeile in den Verlauf, mit
 * Name, Dokumentart und Dateigröße. Ein Ausweis, der ohne Zutun des Kunden in
 * der Akte auftaucht, muss erklärbar sein.
 */
router.post(
  "/agent/dokumente/:personId/:art/hochladen",
  requireAgent,
  (req: AgentRequest, res: Response, next) => {
    // Multer erst hier laden — die Route ist selten, der Speicher liegt im RAM.
    import("multer")
      .then(({ default: multer }) => {
        multer({
          storage: multer.memoryStorage(),
          limits: { fileSize: 25 * 1024 * 1024 },
        }).single("datei")(req as any, res as any, (err: any) => {
          if (err) {
            const zuGross = err?.code === "LIMIT_FILE_SIZE";
            return res.status(400).json({
              ok: false,
              error: zuGross
                ? "Die Datei ist größer als 25 MB. Bitte als PDF oder verkleinertes Foto schicken."
                : "Die Datei konnte nicht gelesen werden.",
            });
          }
          next();
        });
      })
      .catch(() => res.status(500).json({ ok: false, error: "Upload nicht verfügbar." }));
  },
  async (req: AgentRequest, res: Response) => {
    try {
      const personId = Number(req.params.personId);
      const art = String(req.params.art);
      if (!istDokumentArt(art)) {
        return res.status(400).json({ ok: false, error: "Unbekannte Dokumentart." });
      }
      const rolle = await rolleVon(req.agent!.id);
      if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
        return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
      }

      const datei = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined;
      if (!datei || !datei.buffer?.length) {
        return res.status(400).json({ ok: false, error: "Es wurde keine Datei mitgeschickt." });
      }

      // Nur das, was hinterher auch wieder angezeigt werden kann. Eine .docx in
      // der Ausweisspalte wäre eine Datei, die niemand mehr öffnet.
      const kopf = datei.buffer.subarray(0, 4);
      const istPdf = kopf.toString("latin1").startsWith("%PDF");
      const istJpg = kopf[0] === 0xff && kopf[1] === 0xd8;
      const istPng = kopf[0] === 0x89 && kopf[1] === 0x50 && kopf[2] === 0x4e && kopf[3] === 0x47;
      if (!istPdf && !istJpg && !istPng) {
        return res.status(400).json({
          ok: false,
          error: "Nur PDF, JPG oder PNG. Ein Handyfoto genügt, wenn alles lesbar ist.",
        });
      }

      const [antrag] = (await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ${personId} AND merged_into IS NULL
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      if (!antrag) {
        return res.status(400).json({
          ok: false,
          error: "Zu diesem Kunden gibt es keine Bestellung — Dokumente hängen an der Bestellung.",
        });
      }

      const spalte = DOKUMENTE.find((d) => d.art === art)!.spalte;
      const label = DOKUMENTE.find((d) => d.art === art)!.label;
      // Spaltenname kommt aus der festen Liste oben, nicht aus der Anfrage.
      await sqlPool.unsafe(
        `UPDATE fiaon_applications
            SET ${spalte} = $1, documents_uploaded_at = NOW()
          WHERE ref = $2`,
        [datei.buffer, antrag.ref],
      );

      // Hat der Kunde damit alles beisammen? Dann rückt der Antrag weiter —
      // dieselbe Regel wie beim Upload durch den Kunden selbst.
      await sqlPool`
        UPDATE fiaon_applications
           SET status = 'documents_submitted'
         WHERE ref = ${antrag.ref}
           AND bank_statement_pdf IS NOT NULL AND id_card_pdf IS NOT NULL
           AND status IN ('pending', 'documents_requested')
      `.catch(() => {});

      const kb = Math.max(1, Math.round(datei.buffer.length / 1024));
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`${label} für den Kunden hochgeladen (${kb} KB, ${istPdf ? "PDF" : istJpg ? "JPG" : "PNG"}).`},
                NOW())
      `.catch(() => {});

      const stand = await dokumentStand({ personId, rolle }, sqlPool);
      res.json({ ok: true, stand, meldung: `${label} liegt jetzt in der Akte.` });
    } catch (err) {
      console.error("[DOK] agent hochladen:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  },
);

/** POST /dokumente/:personId/anfordern — über die Registry, mit Zustandsprüfung. */
router.post("/dokumente/:personId/anfordern", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    const art = String(req.body?.art || "");
    // Zwei Ereignisse aus der bestehenden Registry — keine neuen erfinden.
    const event = art === "schufa" ? "schufa_requested" : "documents_change_request";
    const { mailSenden } = await import("../lib/fiaon-mail-senden");
    const erg = await mailSenden({
      event, personId,
      zusatz: req.body?.notiz ? { grund: String(req.body.notiz) } : {},
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: rolle as any },
    });
    res.json(erg);
  } catch (err) {
    console.error("[DOK] anfordern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSBLATT
// ═══════════════════════════════════════════════════════════════════════════

router.get("/gespraechsblatt/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({
        ok: false,
        error: "Dieser Kunde wird von jemand anderem betreut — ein Gesprächsblatt gibt es nur zu eigenen Kunden.",
      });
    }
    const blatt = await gespraechsblatt(personId);
    if (!blatt) return res.status(404).json({ ok: false, error: "Person nicht gefunden." });
    await sqlPool`
      INSERT INTO fiaon_gespraechsblatt_log (person_id, agent_id, akteur, aus_cache)
      VALUES (${personId}, ${req.agent!.id}, ${req.agent!.name}, ${blatt.ausCache})
    `.catch(() => {});
    res.json({ ok: true, blatt });
  } catch (err) {
    console.error("[BLATT]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/telefon/diagnose — die Kette Schritt für Schritt.
 *
 * Nur für den Vorgesetzten: Die Antwort nennt Kontonamen und Nummern.
 */
router.get("/admin/telefon/diagnose", async (_req: Request, res: Response) => {
  try {
    const { telefonDiagnose } = await import("../lib/fiaon-telefon-diagnose");
    res.json({ ok: true, ...(await telefonDiagnose()) });
  } catch (err) {
    console.error("[TELEFON] diagnose:", err);
    res.status(500).json({
      ok: false,
      error: `Die Diagnose selbst ist gescheitert: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-RICHTLINIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Satz, den das Team am Gesprächsbeginn vorliest.
 *
 * Änderbar in den Einstellungen — aber nie leer: Fällt der Eintrag weg, gilt
 * die Vorgabe. Ein leerer Pflichtsatz wäre schlimmer als ein unpassender.
 */
async function hinweisSatz(): Promise<string> {
  const { HINWEIS_VORGABE } = await import("../lib/fiaon-telefon-zusage");
  const [r] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'telefon_hinweis_satz'
  `.catch(() => [] as any[])) as any[];
  const v = String(r?.value ?? "").trim();
  return v.length > 10 ? v : HINWEIS_VORGABE;
}

/**
 * GET /telefon/suche — Kunden für die Wählanzeige.
 *
 * NUR im Sichtfeld der Rolle: Wer nur eigene Kunden betreut, findet auch nur
 * eigene. Eine Telefonsuche über den ganzen Bestand wäre selbst schon ein
 * Leck — man bekäme Namen und Rufnummern von Menschen, mit denen man nichts
 * zu tun hat.
 */
router.get("/telefon/suche", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, treffer: [] });
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    // Rufnummern mit und ohne Leerzeichen finden — der eine tippt 0176…,
    // der andere +49 176 …, und beide meinen denselben Menschen.
    const roh = q.replace(/[^0-9+]/g, "");
    const treffer = (await sqlPool`
      SELECT p.id AS person_id,
             TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
             COALESCE(p.primary_phone, '') AS nummer
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked
        AND COALESCE(p.primary_phone, '') <> ''
        AND (${nurEigene}::int IS NULL OR p.assigned_agent_id = ${nurEigene}::int)
        AND (
          (COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) ILIKE ${`%${q}%`}
          OR (${roh.length >= 4} AND regexp_replace(COALESCE(p.primary_phone,''), '[^0-9+]', '', 'g') LIKE ${`%${roh}%`})
        )
      ORDER BY p.priority_tier NULLS LAST, p.last_name
      LIMIT 8
    `) as any[];
    res.json({
      ok: true,
      treffer: treffer.map((t) => ({
        personId: Number(t.person_id), name: String(t.name).trim() || "Ohne Namen",
        nummer: String(t.nummer),
      })),
    });
  } catch (err) {
    console.error("[TELEFON] suche:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/browser-fehler — was im Browser geworfen wurde.
 *
 * ── WARUM DAS DIE LETZTE LÜCKE SCHLIESST ───────────────────────────────────
 * Die Diagnose prüft neun Stellen — alle auf dem Server. Der zehnte Ort ist
 * der Browser des Nutzers, und dort konnte ich nie hineinsehen. Im Panel
 * stand „der Fehler nennt keinen Grund", und aus der Ferne war nicht zu
 * klären, WAS geworfen wurde: ein Mikrofon-Nein, ein Modulfehler, ein
 * Twilio-Code oder ein leeres Objekt.
 *
 * Jetzt schickt der Browser es her. Die Diagnose zeigt es als Schritt 10.
 */
router.post("/telefon/browser-fehler", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = req.body ?? {};
    const eintrag = {
      am: new Date().toISOString(),
      agent: req.agent!.name,
      wo: String(b.wo ?? "unbekannt").slice(0, 40),
      name: b.name ? String(b.name).slice(0, 60) : null,
      code: b.code ?? null,
      message: b.message ? String(b.message).slice(0, 300) : null,
      description: b.description ? String(b.description).slice(0, 300) : null,
      explanation: b.explanation ? String(b.explanation).slice(0, 300) : null,
      causes: Array.isArray(b.causes) ? b.causes.slice(0, 4) : null,
      browser: String(b.browser ?? "").slice(0, 200),
      roh: String(b.roh ?? "").slice(0, 600),
    };
    await sqlPool`
      INSERT INTO fiaon_settings (key, value)
      VALUES ('telefon_letzter_browserfehler', ${JSON.stringify(eintrag)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    // Auch in die Serverkonsole: Beim nächsten Bericht steht es dort, ohne
    // dass jemand eine Diagnose öffnen muss.
    console.error(`[TELEFON] Browser-Fehler bei „${eintrag.wo}" (${eintrag.agent}): `
      + `${eintrag.name ?? "ohne Name"} ${eintrag.code ?? ""} ${eintrag.message ?? ""} `
      + `| ${eintrag.roh}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] browser-fehler:", err);
    res.status(500).json({ ok: false });
  }
});

/**
 * GET /telefon/naechster — wer ist als Nächstes dran?
 *
 * ── DER ANLASS ─────────────────────────────────────────────────────────────
 * Ein Agent, sinngemäß: „Wenn ich ‚Nicht erreicht' klicke, lande ich wieder
 * auf der Wähltastatur — mit der Nummer DESSELBEN Kunden. Um zum nächsten zu
 * kommen, muss ich auf ‚Anderen Kunden wählen', und dort steht ein leeres
 * Suchfeld. Ich muss die Nummer von Hand eintippen."
 *
 * Zwei Klicks und eine Sucheingabe zwischen zwei Anrufen. Bei sechzig
 * Gesprächen am Tag sind das zwei Minuten reines Klicken — und, schlimmer, ein
 * Bruch im Rhythmus. Wer abarbeitet, will nicht suchen.
 *
 * ── DIESELBE REIHENFOLGE WIE DIE KUNDENLISTE ──────────────────────────────
 * Bewusst nicht „irgendein offener Fall": Der Agent hat seine Liste vor Augen
 * und erwartet, dass das Telefon ihr folgt. Zwei Reihenfolgen für dieselbe
 * Arbeit wären schlimmer als gar keine Hilfe.
 */
router.get("/telefon/naechster", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    // Wen wir gerade erledigt haben, überspringen wir — sonst schlägt das
    // Telefon denselben Menschen vor, den man eben dokumentiert hat.
    const ausser = String(req.query.ausser || "")
      .split(",").map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);

    const [k] = (await sqlPool`
      SELECT p.id AS person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, 'Ohne Namen') AS name,
             p.primary_phone, p.priority_tier, p.tier_reason,
             p.promised_payment_date, p.follow_up_date,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref,
             (SELECT COALESCE(NULLIF(a.phone, ''), NULLIF(a.contact_phone, ''))
                FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS app_phone
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${req.agent!.id}
        AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked
        AND p.priority_tier BETWEEN 1 AND 3
        AND p.ruhe_seit IS NULL
        -- Wer eine Verabredung in der Zukunft hat, ist heute fertig. Dieselbe
        -- Regel wie in der Kundenliste — eine Definition, ein Ort.
        AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
        AND NOT (p.id = ANY(${ausser}::int[]))
        AND COALESCE(NULLIF(p.primary_phone, ''), (
              SELECT NULLIF(COALESCE(a.phone, a.contact_phone), '')
              FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1
            )) IS NOT NULL
      ORDER BY
        p.priority_tier ASC,
        p.promised_payment_date ASC NULLS LAST,
        p.follow_up_date ASC NULLS LAST,
        p.id ASC
      LIMIT 1
    `) as any[];

    if (!k) {
      return res.json({
        ok: true, kunde: null,
        hinweis: "Keiner mehr offen. Entweder ist die Liste leer, oder alle haben eine "
          + "Verabredung in der Zukunft — beides heißt: für heute fertig.",
      });
    }

    // Dieselbe Aufbereitung wie in der Kundenliste — eine Definition, ein Ort.
    const { waehlbareNummer } = await import("../lib/fiaon-telefon");
    const tel = waehlbareNummer([
      { nummer: k.primary_phone },
      { nummer: k.app_phone },
    ], null);
    if (!tel.waehlbar) {
      // Eine unbrauchbare Nummer ist kein „kein Kunde": Der Agent soll sehen,
      // dass hier etwas zu tun ist — nur nicht am Telefon.
      return res.json({
        ok: true, kunde: null,
        hinweis: `Der nächste wäre ${k.name}, aber seine Nummer ist nicht wählbar. `
          + "Öffne ihn in der Kundenliste und lass sie korrigieren.",
      });
    }

    res.json({
      ok: true,
      kunde: {
        personId: Number(k.person_id),
        name: String(k.name),
        nummer: tel.waehlbar,
        ref: k.ref ?? null,
        stufe: Number(k.priority_tier),
        grund: k.tier_reason ?? null,
      },
    });
  } catch (err) {
    console.error("[TELEFON] naechster:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /telefon/richtlinie — Text und eigener Stand. */
router.get("/telefon/richtlinie", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageStand, zusageHash } = await import("../lib/fiaon-vertrieb-zusage");
    const { TELEFON_ZUSAGE_TEXT, TELEFON_ZUSAGE_VERSION, HINWEIS_VORGABE } =
      await import("../lib/fiaon-telefon-zusage");
    const stand = await zusageStand(req.agent!.id, "telefon", TELEFON_ZUSAGE_VERSION);
    res.json({
      ok: true, ...stand,
      text: TELEFON_ZUSAGE_TEXT,
      // Der Prüfwert belegt, dass der angezeigte Text derselbe ist, der
      // gespeichert wurde. Ohne ihn könnte man den Wortlaut später ändern
      // und behaupten, es sei immer so gewesen.
      pruefwert: zusageHash(TELEFON_ZUSAGE_TEXT).slice(0, 16),
      hinweisSatz: await hinweisSatz(),
      hinweisVorgabe: HINWEIS_VORGABE,
    });
  } catch (err) {
    console.error("[TELEFON] richtlinie:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /telefon/richtlinie — annehmen. */
router.post("/telefon/richtlinie", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageSpeichern, istRoboterUnterschrift, zusageHash } =
      await import("../lib/fiaon-vertrieb-zusage");
    const { TELEFON_ZUSAGE_TEXT, TELEFON_ZUSAGE_VERSION } =
      await import("../lib/fiaon-telefon-zusage");

    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const ua = String(req.headers["user-agent"] || "");
    // Dieselbe Wand wie bei der Verpflichtungserklärung: Ein Rechtsnachweis,
    // den ein Skript erzeugen kann, ist keiner. Am 08.08.2026 hat ein
    // Browser-Test eine Erklärung echt angenommen.
    const roboter = istRoboterUnterschrift(ip || null, ua || null);
    if (roboter.roboter) {
      return res.status(403).json({ ok: false, error: `Annahme abgelehnt: ${roboter.grund}` });
    }
    if (String(req.body?.pruefwert || "") !== zusageHash(TELEFON_ZUSAGE_TEXT).slice(0, 16)) {
      return res.status(400).json({
        ok: false,
        error: "Der angezeigte Text passt nicht zur gespeicherten Fassung. Bitte die Seite neu laden.",
      });
    }
    // Der getippte Name ist Teil des Nachweises — wie bei der
    // Verpflichtungserklärung. Wer seinen Namen schreibt, hat gelesen.
    const getippt = String(req.body?.name || "").trim();
    if (getippt.length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Bitte schreib deinen Namen in das Feld. Das ist die Unterschrift.",
      });
    }
    // ── VORHER→NACHHER (24.08.2026, Befund Justin) ────────────────────────
    // Vorher wurde das Ergebnis von zusageSpeichern IGNORIERT und immer
    // { ok: true } geantwortet. Lehnte die Speicherung ab (falscher Name,
    // Roboter-Wand …), schloss der Client die Tafel trotzdem – und das
    // nächste Wählen öffnete sie wieder: eine Endlosschleife ohne Erklärung.
    const ergebnis = await zusageSpeichern({
      agentId: req.agent!.id, agentName: req.agent!.name, bereich: "telefon",
      version: TELEFON_ZUSAGE_VERSION, sollVersion: TELEFON_ZUSAGE_VERSION,
      text: TELEFON_ZUSAGE_TEXT, nameGetippt: getippt,
      gelesen: req.body?.gelesen === true,
      ip: ip || null, userAgent: ua || null,
    });
    if (!ergebnis.ok) {
      return res.status(400).json({ ok: false, error: ergebnis.grund || "Annahme fehlgeschlagen." });
    }
    console.log(`[TELEFON] Richtlinie angenommen: ${req.agent!.name} (${TELEFON_ZUSAGE_VERSION})`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] richtlinie annehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/:id/ohne-aufzeichnung — der Kunde hat widersprochen.
 *
 * Stoppt die laufende Twilio-Aufnahme SOFORT und vermerkt es am Anruf. Das
 * Gespräch läuft weiter — man legt nicht auf, weil jemand nicht aufgezeichnet
 * werden will.
 */
router.post("/telefon/:id/ohne-aufzeichnung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [c] = (await sqlPool`
      SELECT id, twilio_sid, agent_id FROM fiaon_calls WHERE id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (Number(c.agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Das ist nicht dein Anruf." });
    }

    // Twilio anweisen, die Aufnahme zu beenden. Schlägt das fehl, wird der
    // Vermerk TROTZDEM gesetzt: Der Wille des Kunden ist festgehalten, auch
    // wenn die Technik gerade klemmt — und der Vermerk ist der Nachweis.
    let gestoppt = false;
    if (c.twilio_sid && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const kopf = "Basic " + Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString("base64");
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`
        + `/Calls/${c.twilio_sid}/Recordings.json`,
        { headers: { Authorization: kopf }, signal: AbortSignal.timeout(8000) },
      ).catch(() => null);
      const j = await r?.json().catch(() => null) as any;
      for (const rec of j?.recordings ?? []) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`
          + `/Recordings/${rec.sid}.json`,
          {
            method: "POST", headers: { Authorization: kopf, "Content-Type": "application/x-www-form-urlencoded" },
            body: "Status=stopped", signal: AbortSignal.timeout(8000),
          },
        ).catch(() => null);
        gestoppt = true;
      }
    }

    await sqlPool`
      UPDATE fiaon_calls
      SET ohne_aufzeichnung_am = NOW(),
          transkript_status = 'entfaellt',
          transkript_grund = 'Der Kunde hat der Aufzeichnung widersprochen.',
          updated_at = NOW()
      WHERE id = ${id}
    `;
    console.log(`[TELEFON] Aufnahme auf Kundenwunsch beendet (Anruf ${id}, Twilio ${gestoppt ? "gestoppt" : "nicht erreicht"})`);
    res.json({
      ok: true, gestoppt,
      meldung: gestoppt
        ? "Die Aufnahme ist beendet. Am Anruf steht, dass der Kunde widersprochen hat."
        : "Am Anruf steht, dass der Kunde widersprochen hat. Die Aufnahme konnte nicht "
          + "bestätigt gestoppt werden — bitte dem Vorgesetzten Bescheid geben.",
    });
  } catch (err) {
    console.error("[TELEFON] ohne-aufzeichnung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/telefon/aufnahmen-aufraeumen — der Löschlauf von Hand.
 *
 * Ohne `--schreiben` gibt es nur die Vorschau. Ein Lauf, der beim ersten
 * Klick löscht, ist bei unumkehrbaren Vorgängen die falsche Voreinstellung.
 */
router.post("/admin/telefon/aufnahmen-aufraeumen", async (req: Request, res: Response) => {
  try {
    const erg = await aufnahmenAufraeumen(req.body?.schreiben !== true);
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[TELEFON] aufraeumen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/telefon/frist — die Frist lesen. POST — setzen. */
router.get("/admin/telefon/frist", async (_req: Request, res: Response) => {
  const { aufnahmenAufraeumen: lauf } = await import("../lib/fiaon-softphone");
  const vorschau = await lauf(true).catch(() => null);
  res.json({ ok: true, tage: await aufnahmeFrist(), faellig: vorschau?.faellig ?? 0 });
});

router.post("/admin/telefon/frist", async (req: Request, res: Response) => {
  const n = Number(req.body?.tage);
  if (!Number.isFinite(n) || n < 7 || n > 365) {
    return res.status(400).json({
      ok: false,
      error: "Die Frist muss zwischen 7 und 365 Tagen liegen. Unter 7 Tagen kann man keine "
        + "Beschwerde mehr prüfen; über 365 wäre es kein Ablauf, sondern ein Archiv.",
    });
  }
  await sqlPool`
    INSERT INTO fiaon_settings (key, value) VALUES ('aufnahme_frist_tage', ${String(Math.round(n))})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  res.json({ ok: true, tage: Math.round(n) });
});

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF
//
// Einmal am Tag löschen, was älter als die Frist ist. Über `tageslauf()`
// registriert — die eine Tür, die im Nicht-Produktionsbetrieb zu bleibt.
// Ein Löschlauf, der auf einem Entwicklungsrechner gegen die Produktion
// läuft, wäre unumkehrbarer Schaden.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("aufnahmen-aufraeumen", () => {
  void aufnahmenAufraeumen(false).then((e) => {
    if (e.geloescht > 0 || e.fehler > 0) {
      console.log(`[TELEFON] Tageslauf: ${e.geloescht} Aufnahmen gelöscht (Frist ${e.frist} Tage), ${e.fehler} Fehler.`);
    }
  }).catch((err) => console.error("[TELEFON] Tageslauf Aufnahmen:", err));
}, 24 * 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════
// TÄGLICH: GEHÖRT DER NAME ZUM GESPRÄCH?
//
// ── WARUM DAS EIN TAGESLAUF IST UND KEIN SKRIPT ZUM ERINNERN ──────────────
// Der Fehler „Anruf hängt an der falschen Person" war am 17.08.2026 behoben und
// am 19.08. wieder gemeldet — weil der Bestand nicht mitgeräumt war und niemand
// ihn messen konnte. AGENTS.md: „Wiederkehrende Bestandskorrekturen gehören in
// den Tageslauf, nicht als Skript zum Erinnern."
//
// Der Lauf KORRIGIERT nichts von selbst. Er ZÄHLT und meldet, wenn eine Zeile
// einen fremden Namen trägt, ohne die Marke „Zuordnung unklar" zu haben. Ein
// automatisches Umhängen wäre Raten — und ein geratener Anruf im Profil eines
// Menschen wird als Leistungsnachweis gelesen.
//
// Nur bei einem Fund gibt es eine Zeile im Log. Ein täglicher Lauf, der „0 in
// Ordnung" schreibt, erzeugt Rauschen, in dem echte Meldungen untergehen.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("anruf-zuordnung-pruefen", () => {
  void (async () => {
    const { NUMMER_PASST_SQL } = await import("../lib/fiaon-anruf-pruefung");
    const [r] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS offen,
             MIN(k.id) AS erster,
             MAX(k.beginn) AS juengster
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
       WHERE k.person_id IS NOT NULL
         AND (${NUMMER_PASST_SQL("k", "p")}) IS FALSE
         AND k.zuordnung_unklar_am IS NULL
    `)) as any[];
    const n = Number(r?.offen ?? 0);
    if (n === 0) return;
    console.warn(`[TELEFON] ${n} Anruf(e) tragen einen Namen, dessen Nummer nicht `
      + `die gewählte ist (ältester #${r.erster}, jüngster ${r.juengster}). `
      + "Beheben: npx tsx scripts/anruf-zuordnung-bereinigen.ts --schreiben");
  })().catch((err) => console.error("[TELEFON] Tageslauf Anruf-Zuordnung:", err));
}, 24 * 60 * 60 * 1000, { beimStartNach: 90_000 });

// ═══════════════════════════════════════════════════════════════════════════
// TÄGLICH: STIMMT UNSERE ZUORDNUNG MIT TWILIOS EIGENER AUFZEICHNUNG ÜBEREIN?
//
// Der Bestandslauf oben prüft nur in sich (Name ↔ Nummer in unserer Zeile).
// Der Kern von E-012 war aber eine VERTAUSCHTE SID: Unsere Zeile war in sich
// stimmig — nur gehörte die Aufnahme zu einem anderen Gespräch. Das sieht man
// ausschließlich bei Twilio: Der Kind-Leg des Anrufs (ParentCallSid) trägt die
// wirklich gewählte Nummer. Dieser Lauf holt sie für die Anrufe der letzten
// 48 Stunden und vergleicht die letzten 9 Ziffern mit unserer Zeile.
// Bei Abweichung: Marke „Zuordnung unklar" + Aufgabe in Justins Liste.
// KEINE automatische Korrektur — ein geratener Anruf in einer Kundenakte ist
// schlimmer als eine offene Frage.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("anruf-twilio-abgleich", () => {
  void (async () => {
    const acc = process.env.TWILIO_ACCOUNT_SID || "", tok = process.env.TWILIO_AUTH_TOKEN || "";
    if (!acc || !tok) return;
    const auth = "Basic " + Buffer.from(`${acc}:${tok}`).toString("base64");
    // Merkzettel statt neuer Spalte: bis zu welcher Anruf-Kennung wurde schon
    // abgeglichen? (Eine ALTER-TABLE-Spalte wäre schöner, aber der Lauf soll
    // auch ohne Schema-Änderung sicher sein.)
    const { getSettings, setSetting } = await import("./fiaon-agent");
    const abId = Number((await getSettings()).telefon_abgleich_bis_id) || 0;
    const rows = (await sqlPool`
      SELECT id, twilio_sid, nummer FROM fiaon_calls
      WHERE twilio_sid IS NOT NULL AND nummer IS NOT NULL
        AND beginn > NOW() - INTERVAL '48 hours'
        AND id > ${abId}
        AND zuordnung_unklar_am IS NULL
      ORDER BY id ASC LIMIT 400
    `) as any[];
    let falsch = 0, geprueft = 0;
    for (const r of rows) {
      try {
        const kinder = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${acc}/Calls.json?ParentCallSid=${encodeURIComponent(r.twilio_sid)}&PageSize=5`,
          { headers: { Authorization: auth } },
        ).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        const gewaehlt: string[] = ((kinder as any)?.calls ?? []).map((c: any) => String(c.to || "").replace(/\D/g, "").slice(-9)).filter(Boolean);
        geprueft++;
        const unsere = String(r.nummer).replace(/\D/g, "").slice(-9);
        if (gewaehlt.length && unsere && !gewaehlt.includes(unsere)) {
          falsch++;
          await sqlPool`
            UPDATE fiaon_calls SET zuordnung_unklar_am = NOW(),
              zuordnung_unklar_grund = ${`twilio-abgleich: Twilio wählte ${gewaehlt.join("/")}, Zeile trägt …${unsere}`},
              updated_at = NOW() WHERE id = ${r.id}
          `;
        }
        await setSetting("telefon_abgleich_bis_id", String(r.id));
        await new Promise((x) => setTimeout(x, 150)); // Twilio-Ratenlimit schonen
      } catch { /* nächster */ }
    }
    if (falsch > 0) {
      console.warn(`[TELEFON] Twilio-Abgleich: ${falsch} von ${geprueft} Anrufen passen NICHT zu Twilios Aufzeichnung — als „Zuordnung unklar" markiert.`);
      await sqlPool`
        INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, quelle, letzte_aktivitaet)
        VALUES ('Telefon: Zuordnungs-Abgleich meldet Abweichungen',
                ${`${falsch} Anruf(e) der letzten 48 Stunden tragen eine andere Nummer als Twilios eigene Aufzeichnung. In der Team-Zentrale unter „Zuordnung prüfen" ansehen.`},
                'telefon', 1, 'telefon-abgleich', NOW())
      `.catch(() => {});
    }
  })().catch((err) => console.error("[TELEFON] Twilio-Abgleich:", err));
}, 24 * 60 * 60 * 1000, { beimStartNach: 10 * 60_000 });

export default router;
