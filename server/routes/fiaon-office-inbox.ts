// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Inbox: der Posteingang des Bonitätsmanagers
//
// ── VORHER (23.08.2026) ────────────────────────────────────────────────────
// Es gab EINE Route: GET /agent/inbox/gesendet. Sie lieferte die Zeilen aus
// dem Versandprotokoll, die dieser Mitarbeiter SELBST ausgelöst hat
// (WHERE ausgeloest_agent_id = ich). Das war aus zwei Richtungen falsch:
//
//   1. ES FEHLTE FAST ALLES. Gemessen am 24.08.2026 auf der Produktion:
//      21.643 Protokollzeilen in 30 Tagen, davon 21.166 ohne auslösenden
//      Mitarbeiter (Automatik: Zahlungserinnerungen, Termine, Belege). Ein
//      Betreuer mit 1.166 Kunden sah in seiner „Inbox" NULL Zeilen, der
//      nächste mit 1.154 Kunden ebenfalls null, der dritte 76. Der Raum war
//      im Alltag leer, obwohl an seine Kunden täglich Post rausging.
//   2. ES WAR ZU VIEL. Wird ein Kunde nach dem Versand einem anderen Betreuer
//      übergeben, blieb die Zeile mit Name und Adresse beim alten sichtbar —
//      ein Kunde, der ihm nicht mehr gehört.
//
// Und vor allem: EINGEHENDES kam überhaupt nicht vor. Kein verpasster Anruf,
// kein Anliegen aus dem Kundenbereich, kein Rückruf-Wunsch, keine Mail, die
// nicht zustellbar war. Eine Inbox ohne Eingang.
//
// ── NACHHER (24.08.2026, Auftrag Justin) ───────────────────────────────────
// Der Besitz steht jetzt dort, wo er hingehört: fiaon_persons.assigned_agent_id.
// Jede Abfrage dieser Datei beginnt mit „meine Kunden" und kann deshalb gar
// keine fremde Zeile liefern — auch nicht, wenn jemand eine fremde ID in die
// Adresszeile schreibt (Antwort dann 404, nicht 403, wie im ganzen Haus).
//
//   GET /agent/inbox/uebersicht?filter=offen|aktivitaet|alle&suche=&tage=&seite=
//       → { ok, zahlen{...}, kunden[] } — EINE Karte je Kunde, neuestes zuerst.
//         Zusammengetragen aus fünf Quellen, alle nur gelesen:
//           · fiaon_tickets      Anliegen aus dem Kundenbereich (zu beantworten)
//           · fiaon_calls        eingehende Anrufe, verpasst und unbeantwortet
//           · fiaon_rueckrufe    Rückruf-Wünsche mit Frist
//           · fiaon_mail_log     unzustellbare Post (gebounct/blockiert/spam)
//           · fiaon_mail_log     was zuletzt rausging (auch von der Automatik)
//
//   GET /agent/inbox/kunde/:personId
//       → alles zu EINEM meiner Kunden: Anliegen, Anrufe, Rückrufe, Postverlauf.
//
// Antworten auf ein Anliegen laufen weiter über die bestehende Route
// /agent/tickets/:id/antwort, Standardmails über /agent/mail/:personId/:event
// — eine Logik, ein Ort.
//
// ── ERGÄNZUNG 24.08.2026 (Auftrag Justin) ──────────────────────────────────
// VORHER endete eine unzustellbare Mail im Verlauf mit einem Satz ohne Knopf
// („Kommt Post nicht an, hilft kein zweiter Versand …"). Der Mitarbeiter sah
// den Fehler und hatte keinen Ausweg. NACHHER gibt es genau einen:
//
//   POST /agent/inbox/post/:mailId/it-melden   → legt eine Meldung für die IT an
//
// Sie landet als Aufgabe des Betreibers im Bereich „technik" (siehe die
// ausführliche Begründung bei todoMeldung in fiaon-betreiber-todo.ts) und
// nimmt von selbst mit, was die IT braucht — Kunde, Mail-Art, Adresse,
// Zeitpunkt, Zustellstand und den Fehlertext des Versands. Der Mitarbeiter
// ergänzt höchstens einen Satz. Die Route ist damit die EINZIGE Stelle dieser
// Datei, die schreibt; alles andere liest weiterhin nur.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { VERSAND_TEXT, type VersandArt } from "../lib/fiaon-versand";
import { ZUSTELL_TEXT } from "../lib/fiaon-zustellung";
import { waehlbareNummer } from "../lib/fiaon-telefon";
import { todoMeldung, todoSchluesselVorhanden } from "./fiaon-betreiber-todo";

const router = Router();

/** Ereignisnamen in Worten – für Events außerhalb der Versand-Registry (Mail-Zentrale, Erinnerungen). */
const EXTRA_TITEL: Record<string, string> = {
  zentrale_freitext: "Freitext (Mail-Zentrale)",
  abo_payment_reminder: "Zahlungserinnerung (Rate)",
  payment_reminder: "Zahlungserinnerung (Erstzahlung)",
  payment_confirmed: "Zahlung bestätigt",
  followup_48h: "Nachfassen nach 48 Std",
};
const titelVon = (event: string): string => (VERSAND_TEXT as Record<string, { titel: string }>)[event as VersandArt]?.titel ?? EXTRA_TITEL[event] ?? event;

/**
 * Zustellwerte, die ein Problem sind — die Mail kam NICHT an.
 *
 * Steht als fester Textbaustein und NICHT als Parameter im SQL: Es sind
 * Konstanten aus fiaon-zustellung.ts, nichts davon kommt aus einer Anfrage.
 */
// 24.08.2026: VORHER stand die Liste NUR als SQL-Textbaustein da. Seit die
// IT-Meldung auch in JavaScript wissen muss, ob eine Zeile kaputt ist, gibt es
// EINE Quelle und der Textbaustein wird daraus gebaut — sonst laufen die
// beiden Listen früher oder später auseinander.
const ZUSTELL_KAPUTT = ["gebounct", "blockiert", "spam", "fehler"] as const;
const ZUSTELL_KAPUTT_SQL = `(${ZUSTELL_KAPUTT.map((v) => `'${v}'`).join(", ")})`;
const istKaputt = (v: unknown): boolean => (ZUSTELL_KAPUTT as readonly string[]).includes(String(v));
/** Der Schlüssel einer IT-Meldung — aus der Protokollzeile, damit er sich nie doppelt vergibt. */
const MELDE_SCHLUESSEL = (mailId: number): string => `it-mail-${mailId}`;
/** Zustellwerte, die beweisen, dass die Adresse wieder funktioniert. */
const ZUSTELL_OK_SQL = "('zugestellt', 'geoeffnet', 'geklickt')";

/** Wie weit die Übersicht standardmäßig zurückschaut. */
const TAGE_STANDARD = 30;
const PRO_SEITE = 40;

const zahl = (v: unknown): number => (v == null ? 0 : Number(v));

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/inbox/uebersicht — der Posteingang: eine Karte je Kunde
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/inbox/uebersicht", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ich = req.agent!.id;
    const filter = ["offen", "aktivitaet", "alle"].includes(String(req.query.filter)) ? String(req.query.filter) : "offen";
    const tage = Math.min(180, Math.max(1, Number(req.query.tage) || TAGE_STANDARD));
    const suche = String(req.query.suche || "").trim().slice(0, 120) || null;
    const seite = Math.max(0, Number(req.query.seite) || 0);
    const nurOffen = filter === "offen";
    const nurAktivitaet = filter === "aktivitaet";

    // ══════════════════════════════════════════════════════════════════════
    // EINE Abfrage, fünf Quellen. Der Grund für die eine Abfrage: Bei 1.300
    // Kunden je Betreuer wären fünf Runden zur Datenbank plus eine Runde je
    // Kunde (LATERAL) das, was die alte Kartei-Ansicht sekundenlang blockiert
    // hat. Jede Quelle wird EINMAL auf „meine Kunden" eingeschränkt und dann
    // angehängt.
    // ══════════════════════════════════════════════════════════════════════
    const zeilen = (await sqlPool`
      WITH meine AS (
        SELECT p.id, p.first_name, p.last_name, p.primary_email, p.primary_phone, p.country
        FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${ich}
          AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL
      ),
      gefiltert AS (
        SELECT * FROM meine m
        WHERE ${suche}::text IS NULL
           OR COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '') ILIKE '%' || ${suche} || '%'
           OR COALESCE(m.primary_email, '') ILIKE '%' || ${suche} || '%'
           OR COALESCE(m.primary_phone, '') ILIKE '%' || ${suche} || '%'
      ),
      anliegen AS (
        SELECT t.person_id,
               COUNT(*) FILTER (WHERE t.status = 'offen')::int AS offen,
               MAX(t.created_at) AS zuletzt,
               (ARRAY_AGG(t.betreff ORDER BY t.created_at DESC))[1] AS betreff
        FROM fiaon_tickets t
        JOIN gefiltert g ON g.id = t.person_id
        WHERE t.created_at > NOW() - (${tage}::int * INTERVAL '1 day') OR t.status = 'offen'
        GROUP BY t.person_id
      ),
      -- Verpasst UND seither nicht zurückgerufen. Ein verpasster Anruf, auf
      -- den eine Stunde später ein Gespräch folgte, ist erledigt und darf
      -- morgens nicht noch einmal als Aufgabe erscheinen.
      anrufe AS (
        SELECT c.person_id,
               COUNT(*)::int AS verpasst,
               MAX(c.beginn) AS zuletzt
        FROM fiaon_calls c
        JOIN gefiltert g ON g.id = c.person_id
        WHERE c.richtung = 'eingehend' AND c.status = 'verpasst'
          AND c.beginn > NOW() - (${tage}::int * INTERVAL '1 day')
          AND NOT EXISTS (
            SELECT 1 FROM fiaon_calls r
            WHERE r.person_id = c.person_id AND r.richtung = 'raus'
              AND r.beginn > c.beginn AND r.status IN ('beendet', 'gewaehlt')
          )
        GROUP BY c.person_id
      ),
      -- Jedes eingehende Gespräch (auch das angenommene) zählt als Aktivität.
      anrufe_alle AS (
        SELECT c.person_id, MAX(c.beginn) AS zuletzt
        FROM fiaon_calls c
        JOIN gefiltert g ON g.id = c.person_id
        WHERE c.richtung = 'eingehend' AND c.beginn > NOW() - (${tage}::int * INTERVAL '1 day')
        GROUP BY c.person_id
      ),
      rueckrufe AS (
        SELECT r.person_id, COUNT(*)::int AS offen, MAX(r.created_at) AS zuletzt,
               MIN(r.frist_bis) AS frist
        FROM fiaon_rueckrufe r
        JOIN gefiltert g ON g.id = r.person_id
        WHERE r.erledigt_am IS NULL
        GROUP BY r.person_id
      ),
      -- Unzustellbar UND seither nichts angekommen. Ist nach dem Bounce eine
      -- Mail zugestellt oder geöffnet worden, wurde die Adresse berichtigt —
      -- dann ist der Fall erledigt und darf nicht weiter mahnen.
      post_kaputt AS (
        SELECT l.person_id, COUNT(*)::int AS anzahl, MAX(l.created_at) AS zuletzt
        FROM fiaon_mail_log l
        JOIN gefiltert g ON g.id = l.person_id
        WHERE l.zustellung IN ${sqlPool.unsafe(ZUSTELL_KAPUTT_SQL)}
          AND l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
          AND NOT EXISTS (
            SELECT 1 FROM fiaon_mail_log n
            WHERE n.person_id = l.person_id AND n.id > l.id
              AND n.zustellung IN ${sqlPool.unsafe(ZUSTELL_OK_SQL)}
          )
        GROUP BY l.person_id
      ),
      post AS (
        SELECT l.person_id, MAX(l.created_at) AS zuletzt,
               (ARRAY_AGG(l.event ORDER BY l.id DESC))[1] AS event,
               (ARRAY_AGG(l.betreff ORDER BY l.id DESC))[1] AS betreff,
               (ARRAY_AGG(l.ausgeloest_agent_id ORDER BY l.id DESC))[1] AS von_agent
        FROM fiaon_mail_log l
        JOIN gefiltert g ON g.id = l.person_id
        WHERE l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
        GROUP BY l.person_id
      )
      SELECT g.id, g.first_name, g.last_name, g.primary_email, g.primary_phone, g.country,
             COALESCE(an.offen, 0) AS anliegen_offen, an.zuletzt AS anliegen_am, an.betreff AS anliegen_betreff,
             COALESCE(ar.verpasst, 0) AS anrufe_verpasst, ar.zuletzt AS anruf_am,
             aa.zuletzt AS anruf_irgendein_am,
             COALESCE(rr.offen, 0) AS rueckrufe_offen, rr.zuletzt AS rueckruf_am, rr.frist AS rueckruf_frist,
             COALESCE(pk.anzahl, 0) AS post_kaputt, pk.zuletzt AS post_kaputt_am,
             po.zuletzt AS post_am, po.event AS post_event, po.betreff AS post_betreff, po.von_agent AS post_von_agent,
             GREATEST(
               COALESCE(an.zuletzt, 'epoch'::timestamptz),
               COALESCE(aa.zuletzt, 'epoch'::timestamptz),
               COALESCE(rr.zuletzt, 'epoch'::timestamptz),
               COALESCE(po.zuletzt, 'epoch'::timestamptz)
             ) AS letzte_aktivitaet,
             (COALESCE(an.offen, 0) + COALESCE(ar.verpasst, 0) + COALESCE(rr.offen, 0) + COALESCE(pk.anzahl, 0)) AS offen_gesamt
      FROM gefiltert g
      LEFT JOIN anliegen an ON an.person_id = g.id
      LEFT JOIN anrufe ar ON ar.person_id = g.id
      LEFT JOIN anrufe_alle aa ON aa.person_id = g.id
      LEFT JOIN rueckrufe rr ON rr.person_id = g.id
      LEFT JOIN post_kaputt pk ON pk.person_id = g.id
      LEFT JOIN post po ON po.person_id = g.id
      WHERE (${nurOffen}::boolean = FALSE
             OR COALESCE(an.offen, 0) + COALESCE(ar.verpasst, 0) + COALESCE(rr.offen, 0) + COALESCE(pk.anzahl, 0) > 0)
        AND (${nurAktivitaet}::boolean = FALSE
             OR an.zuletzt IS NOT NULL OR aa.zuletzt IS NOT NULL OR rr.zuletzt IS NOT NULL OR po.zuletzt IS NOT NULL)
      ORDER BY (COALESCE(an.offen, 0) + COALESCE(ar.verpasst, 0) + COALESCE(rr.offen, 0) + COALESCE(pk.anzahl, 0)) > 0 DESC,
               GREATEST(
                 COALESCE(an.zuletzt, 'epoch'::timestamptz),
                 COALESCE(aa.zuletzt, 'epoch'::timestamptz),
                 COALESCE(rr.zuletzt, 'epoch'::timestamptz),
                 COALESCE(po.zuletzt, 'epoch'::timestamptz)
               ) DESC,
               g.id DESC
      LIMIT ${PRO_SEITE + 1} OFFSET ${seite * PRO_SEITE}
    `) as any[];

    const mehr = zeilen.length > PRO_SEITE;
    const kunden = zeilen.slice(0, PRO_SEITE).map((z) => {
      const tel = waehlbareNummer([{ nummer: z.primary_phone }], z.country);
      const vollerName = `${z.first_name ?? ""} ${z.last_name ?? ""}`.replace(/\s+/g, " ").trim();
      const aktivitaet = z.letzte_aktivitaet && new Date(z.letzte_aktivitaet).getFullYear() > 1971 ? z.letzte_aktivitaet : null;
      return {
        personId: Number(z.id),
        name: vollerName || "Ohne Namen",
        email: z.primary_email ?? null,
        telefon: tel.anzeige,
        telefonWaehlbar: tel.waehlbar,
        telefonHinweis: tel.hinweis,
        letzteAktivitaet: aktivitaet,
        offenGesamt: zahl(z.offen_gesamt),
        anliegenOffen: zahl(z.anliegen_offen),
        anliegenBetreff: z.anliegen_betreff ?? null,
        anliegenAm: z.anliegen_am ?? null,
        anrufeVerpasst: zahl(z.anrufe_verpasst),
        anrufAm: z.anruf_am ?? z.anruf_irgendein_am ?? null,
        rueckrufeOffen: zahl(z.rueckrufe_offen),
        rueckrufFrist: z.rueckruf_frist ?? null,
        postKaputt: zahl(z.post_kaputt),
        postKaputtAm: z.post_kaputt_am ?? null,
        postAm: z.post_am ?? null,
        postTitel: z.post_event ? titelVon(String(z.post_event)) : null,
        postBetreff: z.post_betreff ?? null,
        postVonMir: z.post_von_agent != null && Number(z.post_von_agent) === ich,
        postAutomatik: z.post_am != null && z.post_von_agent == null,
      };
    });

    // Die Kopfzahlen zählen über den GANZEN Bestand des Betreuers, nicht über
    // die gerade angezeigte Seite — sonst sinkt „zu beantworten", sobald
    // jemand einen Suchbegriff eintippt.
    const [z] = (await sqlPool`
      WITH meine AS (
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${ich}
          AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL
      )
      SELECT
        (SELECT COUNT(*)::int FROM meine) AS kunden,
        (SELECT COUNT(*)::int FROM fiaon_tickets t JOIN meine m ON m.id = t.person_id WHERE t.status = 'offen') AS anliegen,
        (SELECT COUNT(*)::int FROM fiaon_calls c JOIN meine m ON m.id = c.person_id
           WHERE c.richtung = 'eingehend' AND c.status = 'verpasst'
             AND c.beginn > NOW() - (${tage}::int * INTERVAL '1 day')
             AND NOT EXISTS (SELECT 1 FROM fiaon_calls r WHERE r.person_id = c.person_id
                             AND r.richtung = 'raus' AND r.beginn > c.beginn AND r.status IN ('beendet', 'gewaehlt'))) AS anrufe,
        (SELECT COUNT(*)::int FROM fiaon_rueckrufe r JOIN meine m ON m.id = r.person_id WHERE r.erledigt_am IS NULL) AS rueckrufe,
        (SELECT COUNT(*)::int FROM fiaon_mail_log l JOIN meine m ON m.id = l.person_id
           WHERE l.zustellung IN ${sqlPool.unsafe(ZUSTELL_KAPUTT_SQL)}
             AND l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
             AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log n WHERE n.person_id = l.person_id AND n.id > l.id
                             AND n.zustellung IN ${sqlPool.unsafe(ZUSTELL_OK_SQL)})) AS post_kaputt,
        -- Wie viele KARTEN die Liste zeigt. Die Zahl daneben zählt Vorgänge
        -- (drei Bounces bei einem Kunden sind drei Vorgänge, aber eine Karte);
        -- ohne diese zweite Zahl stünde über einer Liste mit 19 Karten die
        -- Marke „52" — und niemand wüsste, welche der beiden stimmt.
        (SELECT COUNT(DISTINCT y.person_id)::int FROM (
           SELECT t.person_id FROM fiaon_tickets t JOIN meine m ON m.id = t.person_id WHERE t.status = 'offen'
           UNION ALL
           SELECT c.person_id FROM fiaon_calls c JOIN meine m ON m.id = c.person_id
             WHERE c.richtung = 'eingehend' AND c.status = 'verpasst'
               AND c.beginn > NOW() - (${tage}::int * INTERVAL '1 day')
               AND NOT EXISTS (SELECT 1 FROM fiaon_calls r WHERE r.person_id = c.person_id
                               AND r.richtung = 'raus' AND r.beginn > c.beginn AND r.status IN ('beendet', 'gewaehlt'))
           UNION ALL
           SELECT r.person_id FROM fiaon_rueckrufe r JOIN meine m ON m.id = r.person_id WHERE r.erledigt_am IS NULL
           UNION ALL
           SELECT l.person_id FROM fiaon_mail_log l JOIN meine m ON m.id = l.person_id
             WHERE l.zustellung IN ${sqlPool.unsafe(ZUSTELL_KAPUTT_SQL)}
               AND l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
               AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log n WHERE n.person_id = l.person_id AND n.id > l.id
                               AND n.zustellung IN ${sqlPool.unsafe(ZUSTELL_OK_SQL)})
         ) y) AS kunden_offen,
        (SELECT COUNT(DISTINCT x.person_id)::int FROM (
           SELECT t.person_id FROM fiaon_tickets t JOIN meine m ON m.id = t.person_id WHERE t.created_at > NOW() - INTERVAL '24 hours'
           UNION ALL
           SELECT c.person_id FROM fiaon_calls c JOIN meine m ON m.id = c.person_id WHERE c.richtung = 'eingehend' AND c.beginn > NOW() - INTERVAL '24 hours'
           UNION ALL
           SELECT r.person_id FROM fiaon_rueckrufe r JOIN meine m ON m.id = r.person_id WHERE r.created_at > NOW() - INTERVAL '24 hours'
           UNION ALL
           SELECT l.person_id FROM fiaon_mail_log l JOIN meine m ON m.id = l.person_id WHERE l.created_at > NOW() - INTERVAL '24 hours'
         ) x) AS neu24
    `) as any[];

    res.json({
      ok: true, filter, tage, seite, proSeite: PRO_SEITE, mehr, kunden,
      zahlen: {
        kunden: zahl(z?.kunden),
        anliegen: zahl(z?.anliegen),
        anrufe: zahl(z?.anrufe),
        rueckrufe: zahl(z?.rueckrufe),
        postKaputt: zahl(z?.post_kaputt),
        kundenOffen: zahl(z?.kunden_offen),
        zuBeantworten: zahl(z?.anliegen) + zahl(z?.anrufe) + zahl(z?.rueckrufe) + zahl(z?.post_kaputt),
        neu24: zahl(z?.neu24),
      },
    });
  } catch (err) {
    console.error("[OFFICE-INBOX] uebersicht:", err);
    res.status(500).json({ ok: false, error: "Der Posteingang konnte nicht geladen werden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/inbox/kunde/:personId — alles zu EINEM meiner Kunden
//
// Der Besitz steht in der WHERE-Bedingung der ersten Abfrage. Gehört die
// Person jemand anderem, ist die Antwort 404 — für diesen Betreuer existiert
// sie nicht. (Ein 403 würde bestätigen, dass es die ID gibt.)
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/inbox/kunde/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ich = req.agent!.id;
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(404).json({ ok: false, error: "Diesen Kunden gibt es nicht." });

    const [p] = (await sqlPool`
      SELECT p.id, p.first_name, p.last_name, p.primary_email, p.primary_phone, p.country, p.assigned_at,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref,
             -- 24.08.2026: NEU. Der Kopf der Lade sagt jetzt in einer Zeile, wer
             -- da ist — und dazu gehört das Paket (Justins Vorgabe „Name, Paket,
             -- betreut seit"). pack_name steht mehrzeilig in der Tabelle, davon
             -- ist nur die erste Zeile der Name (Vorbild fiaon-agent-kunden.ts).
             (SELECT a.pack_name FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS pack_name
      FROM fiaon_persons p
      WHERE p.id = ${personId}
        AND p.assigned_agent_id = ${ich}
        AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Diesen Kunden gibt es nicht in deinem Bestand." });

    const [anliegen, anrufe, rueckrufe, post] = await Promise.all([
      sqlPool`
        SELECT id, betreff, text, status, antwort, beantwortet_am, created_at
        FROM fiaon_tickets WHERE person_id = ${personId}
        ORDER BY (status = 'offen') DESC, created_at DESC LIMIT 30
      `,
      sqlPool`
        SELECT id, richtung, status, beginn, dauer_sek, ergebnis, ergebnis_notiz, zusammenfassung, von_nummer, nummer
        FROM fiaon_calls WHERE person_id = ${personId}
        ORDER BY beginn DESC NULLS LAST LIMIT 20
      `,
      sqlPool`
        SELECT id, anliegen, kontakt, quelle, frist_bis, erledigt_am, ergebnis_notiz, created_at
        FROM fiaon_rueckrufe WHERE person_id = ${personId}
        ORDER BY (erledigt_am IS NULL) DESC, created_at DESC LIMIT 20
      `,
      sqlPool`
        SELECT l.id, l.event, l.betreff, l.status, l.grund, l.zustellung, l.empfaenger, l.created_at,
               l.ausgeloest_agent_id, a.name AS von
        FROM fiaon_mail_log l
        LEFT JOIN fiaon_agents a ON a.id = l.ausgeloest_agent_id
        WHERE l.person_id = ${personId}
        ORDER BY l.id DESC LIMIT 40
      `,
    ]);

    // 24.08.2026: Welche unzustellbare Mail wurde schon an die IT gemeldet?
    // Wird HIER beantwortet, damit der Knopf beim Öffnen der Lade bereits
    // „gemeldet" zeigt — auch wenn ein Kollege gestern gemeldet hat oder der
    // Mitarbeiter die Seite neu geladen hat. Fällt die Abfrage aus, bleibt der
    // Posteingang trotzdem stehen: die Meldung wäre dann nur ein zweites Mal
    // anklickbar, und dagegen schützt der eindeutige Schlüssel in der Tabelle.
    const kaputteIds = (post as any[]).filter((l) => istKaputt(l.zustellung)).map((l) => Number(l.id));
    const gemeldet = await todoSchluesselVorhanden(kaputteIds.map(MELDE_SCHLUESSEL)).catch(() => new Set<string>());

    const tel = waehlbareNummer([{ nummer: p.primary_phone }], p.country);
    res.json({
      ok: true,
      zustellText: ZUSTELL_TEXT,
      kunde: {
        personId: Number(p.id),
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Ohne Namen",
        email: p.primary_email ?? null,
        telefon: tel.anzeige, telefonWaehlbar: tel.waehlbar, telefonHinweis: tel.hinweis,
        ref: p.ref ?? null, betreutSeit: p.assigned_at ?? null,
        paket: p.pack_name ? String(p.pack_name).split("\n")[0].trim() || null : null,
      },
      anliegen: (anliegen as any[]).map((t) => ({
        id: Number(t.id), betreff: t.betreff, text: t.text, status: t.status,
        antwort: t.antwort ?? null, beantwortetAm: t.beantwortet_am ?? null, am: t.created_at,
      })),
      anrufe: (anrufe as any[]).map((c) => ({
        id: Number(c.id), richtung: c.richtung, status: c.status, am: c.beginn,
        dauer: zahl(c.dauer_sek), ergebnis: c.ergebnis ?? null,
        notiz: c.ergebnis_notiz ?? c.zusammenfassung ?? null,
        nummer: c.richtung === "eingehend" ? (c.von_nummer ?? c.nummer ?? null) : (c.nummer ?? null),
      })),
      rueckrufe: (rueckrufe as any[]).map((r) => ({
        id: Number(r.id), anliegen: r.anliegen, kontakt: r.kontakt ?? null, quelle: r.quelle,
        fristBis: r.frist_bis ?? null, erledigtAm: r.erledigt_am ?? null,
        notiz: r.ergebnis_notiz ?? null, am: r.created_at,
      })),
      post: (post as any[]).map((l) => ({
        id: Number(l.id), titel: titelVon(String(l.event)), betreff: l.betreff ?? null,
        status: l.status, grund: l.grund ?? null, zustellung: l.zustellung ?? null,
        empfaenger: l.empfaenger ?? null, am: l.created_at,
        von: l.ausgeloest_agent_id == null ? "Automatik" : (l.von ?? "Kollege"),
        vonMir: l.ausgeloest_agent_id != null && Number(l.ausgeloest_agent_id) === ich,
        // Der Server sagt, ob gemeldet werden KANN und ob es schon geschehen ist —
        // die Oberfläche rät nichts (24.08.2026).
        kaputt: istKaputt(l.zustellung),
        itGemeldet: gemeldet.has(MELDE_SCHLUESSEL(Number(l.id))),
      })),
    });
  } catch (err) {
    console.error("[OFFICE-INBOX] kunde:", err);
    res.status(500).json({ ok: false, error: "Der Kunde konnte nicht geladen werden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/inbox/post/:mailId/it-melden — „Problem an die IT melden"
//
// ── VORHER (bis 24.08.2026) ────────────────────────────────────────────────
// Eine unzustellbare Mail stand im Verlauf und blieb dort liegen. Der Hinweis
// darunter endete mit einem Rat („die Adresse muss in der Akte berichtigt
// werden") — was aber, wenn die Adresse stimmt und trotzdem nichts ankommt?
// Dann war der Mitarbeiter am Ende der Straße.
//
// ── NACHHER (Auftrag Justin, 24.08.2026) ───────────────────────────────────
// Ein Knopf legt eine Meldung an, die beim Betreiber landet. Die Meldung
// schreibt sich SELBST: Kunde, Mail-Art, Empfängeradresse, Zeitpunkt,
// Zustellstand und der Fehlertext aus dem Versandprotokoll stehen darin, weil
// der Server sie ohnehin vor sich hat. Der Mitarbeiter tippt nichts ab; er
// darf einen Satz ergänzen, muss aber nicht.
//
// ── RECHTE ─────────────────────────────────────────────────────────────────
// Nur eigene Kunden. Der Besitz steht in derselben Abfrage, die die Zeile holt
// (JOIN auf fiaon_persons mit assigned_agent_id) — es gibt keinen Weg, eine
// fremde Protokollzeile zu melden und dabei Name und Adresse zu erfahren.
// Fremde oder unbekannte Kennung: 404, wie im ganzen Haus.
//
// ── ZWEITER KLICK ──────────────────────────────────────────────────────────
// Legt nichts Neues an. Der Schlüssel der Meldung kommt aus der Kennung der
// Protokollzeile und ist in fiaon_betreiber_todos eindeutig; der zweite Klick
// bekommt „ist schon gemeldet" zurück (und hängt einen ergänzten Satz an die
// bestehende Meldung, damit er nicht verloren geht).
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/inbox/post/:mailId/it-melden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ich = req.agent!.id;
    const mailId = Number(req.params.mailId);
    if (!Number.isFinite(mailId) || mailId <= 0) return res.status(404).json({ ok: false, error: "Diese Mail gibt es nicht." });
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 1000);

    const [l] = (await sqlPool`
      SELECT l.id, l.event, l.betreff, l.status, l.grund, l.zustellung, l.empfaenger, l.created_at,
             p.id AS person_id, p.first_name, p.last_name, p.primary_email,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_mail_log l
      JOIN fiaon_persons p ON p.id = l.person_id
      WHERE l.id = ${mailId}
        AND p.assigned_agent_id = ${ich}
        AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!l) return res.status(404).json({ ok: false, error: "Diese Mail gehört zu keinem Kunden aus deinem Bestand." });
    if (!istKaputt(l.zustellung)) {
      return res.status(400).json({ ok: false, error: "Diese Mail ist unterwegs oder angekommen — dazu gibt es für die IT nichts zu tun." });
    }

    const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Ohne Namen";
    const art = titelVon(String(l.event));
    const adresse = l.empfaenger ?? l.primary_email ?? "keine Adresse im Protokoll";
    const stand = (ZUSTELL_TEXT as Record<string, string>)[String(l.zustellung)] ?? String(l.zustellung);
    const wann = new Date(l.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

    // Der Text ist bewusst eine Liste aus Zeilen und kein Fliesstext: Die IT
    // sucht darin nach Adresse und Fehlertext, nicht nach einer Erzählung.
    const zeilen = [
      `Kunde: ${name} (Person ${Number(l.person_id)}${l.ref ? `, Kennung ${l.ref}` : ""})`,
      `Mail: ${art}${l.betreff ? ` — Betreff „${l.betreff}“` : ""}`,
      `An: ${adresse}`,
      `Verschickt: ${wann} Uhr (Protokollzeile ${Number(l.id)})`,
      `Zustellung: ${stand} (${String(l.zustellung)})`,
      `Versandstand: ${String(l.status)}`,
      `Fehlertext des Versands: ${l.grund ? String(l.grund) : "keiner im Protokoll"}`,
      `Gemeldet von: ${req.agent!.name}`,
    ];
    if (notiz) zeilen.push(`Beobachtung des Mitarbeiters: ${notiz}`);

    const { neu } = await todoMeldung(
      MELDE_SCHLUESSEL(Number(l.id)),
      {
        titel: `Mail kommt bei ${name} nicht an (${stand})`,
        text: zeilen.join("\n"),
        bereich: "technik",
        prioritaet: 2,
      },
      { name: req.agent!.name, agentId: ich, notiz },
    );

    res.json({
      ok: true, neu,
      meldung: neu
        ? "An die IT gemeldet. Adresse, Zeitpunkt und Fehlertext sind mitgegangen — du musst nichts weiter tun."
        : "Das war schon gemeldet. Deine Ergänzung ist an die bestehende Meldung gegangen.",
    });
  } catch (err) {
    console.error("[OFFICE-INBOX] it-melden:", err);
    res.status(500).json({ ok: false, error: "Die Meldung konnte nicht abgeschickt werden. Bitte gleich noch einmal versuchen." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// ENTFERNT AM 24.08.2026: GET /agent/inbox/gesendet
//
// Die Route lieferte eine flache Liste aller verschickten Mails. Sie war die
// linke Spalte der alten Seite und wird von niemandem mehr aufgerufen: Die
// Frage „Was ging an diesen Kunden raus?" beantwortet jetzt der Abschnitt
// „Post an diesen Kunden" in /agent/inbox/kunde/:personId — am Kunden, wo die
// Frage im Alltag entsteht, statt in einem Strom aus 21.000 Zeilen im Monat,
// in dem niemand etwas wiederfindet.
//
// Wer sie wiederhaben will, findet sie in der Fassung vom 23.08.2026; der
// Besitzfehler darin (WHERE ausgeloest_agent_id = ich) muss dann aber gegen
// fiaon_persons.assigned_agent_id getauscht werden.
// ───────────────────────────────────────────────────────────────────────────

export default router;
