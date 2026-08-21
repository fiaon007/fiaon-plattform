// ═══════════════════════════════════════════════════════════════════════════
// DIE TERMIN-ZENTRALE — EINE ÜBERSICHT ÜBER ALLE TERMINE ALLER MITARBEITER
//
// ── WARUM SIE GEBRAUCHT WIRD ───────────────────────────────────────────────
// GEMESSEN am 24.08.2026 an `fiaon_termine`:
//
//   120 Termine insgesamt, 33 heute, 52 diese Woche
//   32 erledigt · 16 abgesagt · 7 verpasst
//   ALLE 120 aus `nichterreicht_mail` — der Terminlink funktioniert
//   336 bezahlte Kunden ohne jeden Termin
//
// Und je Mitarbeiter:
//   Nikita Boychenko    34 Termine ·  0 erledigt · 1 verpasst
//   Lucas Böhnert       30 Termine ·  0 erledigt · 6 verpasst
//   Florentine Lombardi 27 Termine · 14 erledigt · 0 verpasst
//   Daniel Stripling    27 Termine · 18 erledigt · 0 verpasst
//
// Zwei Mitarbeiter haben bei 64 Terminen KEINEN EINZIGEN abgeschlossen. Das
// stand in keiner Ansicht. Eine Zahl, die niemand sieht, ändert nichts.
//
// ── DIE QUOTEN GEHÖREN NEBENEINANDER ───────────────────────────────────────
// Eine Erledigt-Quote allein sagt wenig — sie kann niedrig sein, weil viele
// Termine noch in der Zukunft liegen. Erst der Vergleich zwischen Menschen
// macht sie lesbar: 0 von 34 neben 18 von 27 ist eine Aussage.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
// Die Grund-Texte stehen bei der Protokollfunktion, nicht hier — sonst gibt es
// zwei Wörterbücher für dieselben Codes.
import { VERSUCH_GRUND_TEXT } from "../lib/fiaon-termine";
import { terminArtAusQuelle } from "../../shared/fiaon-termin-art";

const router = Router();

/** Die Quellen, wie `fiaon_termine.quelle` sie führt — mit Klartext. */
export const QUELLE_TEXT: Record<string, string> = {
  nichterreicht_mail: "Nicht erreicht — Terminlink",
  onboarding_call: "Startgespräch (Onboarding)",
  nummer_korrektur: "Nach Nummern-Korrektur",
  agent_manuell: "Vom Agenten eingetragen",
  portal: "Vom Kunden im Portal",
};

/** Status mit Klartext und Farbton. Bernstein heißt „jemand muss etwas tun". */
export const STATUS_TEXT: Record<string, { text: string; ton: string }> = {
  gebucht: { text: "Gebucht", ton: "#2563eb" },
  erledigt: { text: "Erledigt", ton: "#059669" },
  verpasst: { text: "Verpasst", ton: "#d97706" },
  abgesagt: { text: "Storniert", ton: "#94a3b8" },
};

/**
 * Der Zeitraum einer Ansicht — in BERLINER Zeit.
 *
 * `new Date().setHours(0,0,0,0)` nimmt die Zeitzone des Servers. Render läuft
 * in UTC; damit begänne „heute" um 2 Uhr morgens deutscher Zeit, und die
 * Termine der ersten zwei Stunden fehlten. Die Grenzen kommen deshalb aus
 * Postgres mit `AT TIME ZONE`.
 */
function zeitraumSql(ansicht: string): string {
  switch (ansicht) {
    case "woche":
      return "date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')::date)";
    case "monat":
      return "date_trunc('month', (NOW() AT TIME ZONE 'Europe/Berlin')::date)";
    default:
      return "(NOW() AT TIME ZONE 'Europe/Berlin')::date";
  }
}
function spanneSql(ansicht: string): string {
  return ansicht === "woche" ? "7 days" : ansicht === "monat" ? "1 month" : "1 day";
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/termine — Liste, Kennzahlen, Mitarbeiter-Vergleich
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/termine", async (req: Request, res: Response) => {
  try {
    const ansicht = ["heute", "woche", "monat"].includes(String(req.query.ansicht))
      ? String(req.query.ansicht) : "heute";
    const agentFilter = Number(req.query.agent) || null;
    const quelleFilter = String(req.query.quelle || "").trim() || null;
    const statusFilter = String(req.query.status || "").trim() || null;

    const von = zeitraumSql(ansicht);
    const spanne = spanneSql(ansicht);

    // ── DIE TERMINE ────────────────────────────────────────────────────────
    // `unsafe` nur für die ZEITRAUM-Bausteine (feste Zeichenketten aus der
    // Funktion oben, keine Nutzereingabe). Alle Filter laufen als Parameter —
    // ein Filter aus der Adresszeile darf nie in die Abfrage eingesetzt werden.
    const zeilen = (await sqlPool.unsafe(`
      SELECT t.id, t.beginn, t.dauer_min, t.status, t.quelle, t.notiz,
             t.erledigt_am, t.abgesagt_am, t.abgesagt_von,
             t.agent_id, ag.name AS agent_name,
             t.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Unbekannt') AS kunde_name,
             p.primary_phone, p.primary_email,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = t.person_id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_termine t
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      LEFT JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.beginn >= ${von}
        AND t.beginn < ${von} + INTERVAL '${spanne}'
        AND ($1::int IS NULL OR t.agent_id = $1)
        AND ($2::text IS NULL OR t.quelle = $2)
        AND ($3::text IS NULL OR t.status = $3)
      ORDER BY t.beginn ASC
      LIMIT 500
    `, [agentFilter, quelleFilter, statusFilter])) as any[];

    // ── DIE KENNZAHLEN ─────────────────────────────────────────────────────
    const [zahlen] = (await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE beginn::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute,
        COUNT(*) FILTER (WHERE beginn >= date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')::date)
          AND beginn < date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')::date) + INTERVAL '7 days')::int AS woche,
        COUNT(*)::int AS gesamt,
        COUNT(*) FILTER (WHERE status = 'erledigt')::int AS erledigt,
        COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst,
        COUNT(*) FILTER (WHERE status = 'abgesagt')::int AS abgesagt,
        COUNT(*) FILTER (WHERE status = 'gebucht' AND beginn < NOW())::int AS ueberfaellig,
        -- Der Hebel-Messwert: Wie viele Termine kommen aus einem Terminlink?
        COUNT(*) FILTER (WHERE quelle = 'nichterreicht_mail')::int AS aus_terminlink
      FROM fiaon_termine
    `) as any[];

    // ── BUCHUNGSVERSUCHE DER LETZTEN SIEBEN TAGE (30.08.2026) ──────────────
    //
    // Die Meldung war: „Die Buchung funktioniert unabhängig von der Uhrzeit
    // nicht zuverlässig." Bis zur Migration 062 hinterließ ein Fehlschlag
    // nichts — die Aussage war weder zu belegen noch zu widerlegen.
    //
    // Diese Karte ist der Beleg. Sie zeigt beides: gebucht UND abgelehnt, denn
    // eine Ablehnzahl ohne ihren Bezug ist keine Messung. Und sie schlüsselt
    // die Gründe auf, weil „unzuverlässig" kein Grund ist, sondern ein Gefühl.
    const [versucheGesamt] = (await sqlPool`
      SELECT COUNT(*)::int AS gesamt,
             COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
             COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt,
             COUNT(*) FILTER (WHERE akteur = 'kunde')::int AS von_kunden,
             MIN(versucht_am) AS erster
      FROM fiaon_termin_versuche
      WHERE versucht_am > NOW() - INTERVAL '7 days'
    `) as any[];

    const versucheGruende = (await sqlPool`
      SELECT grund, COUNT(*)::int AS n
      FROM fiaon_termin_versuche
      WHERE versucht_am > NOW() - INTERVAL '7 days' AND ergebnis = 'abgelehnt'
      GROUP BY grund ORDER BY n DESC
    `) as any[];

    // Die Uhrzeit-Frage direkt beantwortet: Häufen sich Ablehnungen zu
    // bestimmten Stunden? „Unabhängig von der Uhrzeit" ist eine Behauptung,
    // die diese Zeile prüfbar macht.
    const versucheStunden = (await sqlPool`
      SELECT EXTRACT(HOUR FROM versucht_am AT TIME ZONE 'Europe/Berlin')::int AS stunde,
             COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
             COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt
      FROM fiaon_termin_versuche
      WHERE versucht_am > NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `) as any[];

    // ══════════════════════════════════════════════════════════════════════
    // ANRUFE DER LETZTEN SIEBEN TAGE — AUS VORHANDENEN DATEN
    //
    // ── DIE MELDUNG ────────────────────────────────────────────────────────
    // „Von 158 Anrufen kamen 2 durch." Die Frage dahinter: Liegt es an der
    // Nummern-Reputation (Spam-Flag) oder an der Technik?
    //
    // ── WAS DIESE ZAHLEN KÖNNEN UND WAS NICHT ─────────────────────────────
    // `fiaon_calls` hat `beginn`, `ende`, `dauer_sek` und `status`. Der Status
    // kommt aus Twilios Rückruf und ist auf fünf deutsche Werte abgebildet:
    //   'gewaehlt'        gewählt, kein Rückruf angekommen (hängengeblieben)
    //   'beendet'         completed — angenommen und normal beendet
    //   'abgelehnt'       no-answer ODER busy
    //   'fehlgeschlagen'  alles andere (failed, canceled)
    //   'verpasst'        eingehend, nicht angenommen
    //
    // WICHTIG für die Deutung: Twilio schickt 'no-answer' und 'busy', aber die
    // Zuordnung wirft beide auf 'abgelehnt'. „Klingelt durch" und „besetzt"
    // sind danach nicht mehr zu unterscheiden — und eine ECHTE Klingeldauer
    // gibt es nicht, weil kein Zeitstempel für „angenommen" gespeichert wird.
    // `dauer_sek` ist die GESPRÄCHSZEIT, nicht die Klingelzeit.
    //
    // Deshalb steht hier, was die Daten hergeben, und nicht mehr: Versuche,
    // angenommen, Ø Gesprächsdauer der angenommenen, abgelehnt/besetzt,
    // fehlgeschlagen und „ohne Rückmeldung". Eine erfundene Klingeldauer wäre
    // schlimmer als keine — sie würde die Reputationsfrage falsch beantworten.
    // Der Betreiber-TODO dazu steht im Report.
    const [anrufe] = (await sqlPool`
      SELECT COUNT(*)::int AS versuche,
             COUNT(*) FILTER (WHERE status = 'beendet')::int AS angenommen,
             COUNT(*) FILTER (WHERE status = 'abgelehnt')::int AS abgelehnt_besetzt,
             COUNT(*) FILTER (WHERE status = 'fehlgeschlagen')::int AS fehlgeschlagen,
             COUNT(*) FILTER (WHERE status = 'gewaehlt')::int AS ohne_rueckmeldung,
             COUNT(*) FILTER (WHERE status = 'verpasst')::int AS eingehend_verpasst,
             -- Nur über die ANGENOMMENEN: Eine Durchschnittsdauer über
             -- Fehlversuche wäre eine Zahl ohne Bedeutung.
             ROUND(AVG(dauer_sek) FILTER (WHERE status = 'beendet' AND dauer_sek > 0))::int AS schnitt_sek,
             -- Sehr kurze Gespräche: „abgenommen und sofort aufgelegt" ist das
             -- Muster eines Spam-Verdachts. Das ist ein HINWEIS, kein Beweis.
             COUNT(*) FILTER (WHERE status = 'beendet' AND dauer_sek BETWEEN 1 AND 5)::int AS unter_5s
      FROM fiaon_calls
      WHERE beginn > NOW() - INTERVAL '7 days' AND richtung = 'raus'
    `) as any[];

    const anrufeJeAgent = (await sqlPool`
      SELECT ag.name,
             COUNT(*)::int AS versuche,
             COUNT(*) FILTER (WHERE c.status = 'beendet')::int AS angenommen,
             ROUND(AVG(c.dauer_sek) FILTER (WHERE c.status = 'beendet' AND c.dauer_sek > 0))::int AS schnitt_sek
      FROM fiaon_calls c JOIN fiaon_agents ag ON ag.id = c.agent_id
      WHERE c.beginn > NOW() - INTERVAL '7 days' AND c.richtung = 'raus'
        AND NOT ag.is_test_account
      GROUP BY ag.name ORDER BY versuche DESC
    `) as any[];

    const anrufeJeTag = (await sqlPool`
      SELECT (beginn AT TIME ZONE 'Europe/Berlin')::date AS tag,
             COUNT(*)::int AS versuche,
             COUNT(*) FILTER (WHERE status = 'beendet')::int AS angenommen
      FROM fiaon_calls
      WHERE beginn > NOW() - INTERVAL '7 days' AND richtung = 'raus'
      GROUP BY 1 ORDER BY 1 DESC
    `) as any[];

    // ── JE MITARBEITER — DER VERGLEICH ─────────────────────────────────────
    // Ohne Nebeneinander ist eine Quote nicht lesbar: Sie kann niedrig sein,
    // weil viele Termine noch in der Zukunft liegen. 0 von 34 neben 18 von 27
    // ist dagegen eine Aussage.
    const jeAgent = (await sqlPool`
      SELECT ag.id, ag.name, ag.rolle,
             COUNT(t.id)::int AS termine,
             COUNT(t.id) FILTER (WHERE t.status = 'erledigt')::int AS erledigt,
             COUNT(t.id) FILTER (WHERE t.status = 'verpasst')::int AS verpasst,
             COUNT(t.id) FILTER (WHERE t.status = 'abgesagt')::int AS abgesagt,
             -- Vergangene Termine: nur an ihnen lässt sich eine Quote messen.
             -- Ein Termin morgen ist weder erledigt noch verpasst.
             COUNT(t.id) FILTER (WHERE t.beginn < NOW())::int AS vergangen,
             COUNT(t.id) FILTER (WHERE t.beginn >= NOW() AND t.status = 'gebucht')::int AS kommend
      FROM fiaon_agents ag
      JOIN fiaon_termine t ON t.agent_id = ag.id
      WHERE COALESCE(ag.is_test_account, FALSE) = FALSE
      GROUP BY ag.id, ag.name, ag.rolle
      ORDER BY COUNT(t.id) DESC
    `) as any[];

    // ── BEZAHLTE KUNDEN OHNE TERMIN ────────────────────────────────────────
    // Die Arbeitsliste des Betreibers: Hier hakt der Ablauf.
    const [ohne] = (await sqlPool`
      SELECT COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE p.primary_email IS NOT NULL)::int AS mit_mail
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND a.payment_status = 'paid'
        AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id)
        AND COALESCE(p.ist_test_am::text, '') = ''
    `) as any[];

    const ohneListe = (await sqlPool`
      SELECT a.ref, a.person_id, a.pack_name, a.paid_at,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Unbekannt') AS name,
             p.primary_email, p.primary_phone,
             ag.name AS agent_name,
             -- Wann wurde zuletzt eine Einladung geschickt? Ohne diese Angabe
             -- schickt der Betreiber sie zum vierten Mal.
             (SELECT MAX(l.created_at) FROM fiaon_mail_log l
               WHERE l.person_id = a.person_id AND l.event = 'onboarding_einladung') AS letzte_einladung
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND a.payment_status = 'paid'
        AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id)
        AND COALESCE(p.ist_test_am::text, '') = ''
      -- Die längst Bezahlten zuerst: Sie warten am längsten.
      ORDER BY a.paid_at ASC NULLS LAST
      LIMIT 100
    `) as any[];

    // Für die Filterleiste: nur Mitarbeiter, die wirklich Termine haben.
    res.json({
      ok: true,
      ansicht,
      filter: { agent: agentFilter, quelle: quelleFilter, status: statusFilter },
      zahlen: {
        ...zahlen,
        // Die Quote nur über VERGANGENE Termine — sonst rechnet man die Zukunft
        // als Versäumnis.
        erledigtQuote: Number(zahlen.gesamt) > 0
          ? Math.round((Number(zahlen.erledigt) / Number(zahlen.gesamt)) * 100) : 0,
      },
      termine: zeilen.map((z) => ({
        id: Number(z.id),
        beginn: z.beginn,
        dauerMin: Number(z.dauer_min ?? 15),
        status: z.status,
        statusText: STATUS_TEXT[String(z.status)]?.text ?? String(z.status),
        ton: STATUS_TEXT[String(z.status)]?.ton ?? "#64748b",
        quelle: z.quelle,
        quelleText: QUELLE_TEXT[String(z.quelle)] ?? String(z.quelle),
        // Die ART neben der Quelle: Die Quelle sagt, WOHER der Termin kommt,
        // die Art sagt, WAS gleich passiert. Beides ist nützlich, aber nur die
        // Art beantwortet „worauf stelle ich mich ein?".
        art: terminArtAusQuelle(z.quelle).art,
        artText: terminArtAusQuelle(z.quelle).text,
        artTon: terminArtAusQuelle(z.quelle).ton,
        artErklaerung: terminArtAusQuelle(z.quelle).erklaerung,
        agentId: z.agent_id != null ? Number(z.agent_id) : null,
        agentName: z.agent_name ?? "— niemand zugewiesen —",
        personId: z.person_id != null ? Number(z.person_id) : null,
        kundeName: z.kunde_name,
        telefon: z.primary_phone ?? null,
        email: z.primary_email ?? null,
        ref: z.ref ?? null,
        akte: z.ref ? `/admin/kunde/${encodeURIComponent(String(z.ref))}` : null,
        erledigtAm: z.erledigt_am ?? null,
        abgesagtAm: z.abgesagt_am ?? null,
        // „storniert am … durch Kunde" — der Auftrag verlangt es ausdrücklich.
        abgesagtVon: z.abgesagt_von ?? null,
        notiz: z.notiz ?? null,
      })),
      // ── DIE BUCHUNGSVERSUCHE ─────────────────────────────────────────────
      // `seit` sagt, ab wann protokolliert wird. Ohne diese Angabe liest man
      // „0 abgelehnt" als „alles gut", obwohl es „wir zählen erst seit heute"
      // heißt — der Unterschied zwischen „ist in Ordnung" und „ich kann es
      // nicht messen" (AGENTS.md, 21.08.2026).
      versuche: {
        gesamt: Number(versucheGesamt?.gesamt ?? 0),
        gebucht: Number(versucheGesamt?.gebucht ?? 0),
        abgelehnt: Number(versucheGesamt?.abgelehnt ?? 0),
        vonKunden: Number(versucheGesamt?.von_kunden ?? 0),
        seit: versucheGesamt?.erster ?? null,
        ablehnQuote: Number(versucheGesamt?.gesamt ?? 0) > 0
          ? Math.round((Number(versucheGesamt.abgelehnt) / Number(versucheGesamt.gesamt)) * 100)
          : 0,
        gruende: versucheGruende.map((g) => ({
          grund: g.grund,
          text: VERSUCH_GRUND_TEXT[String(g.grund)] ?? String(g.grund),
          n: Number(g.n),
        })),
        stunden: versucheStunden.map((s) => ({
          stunde: Number(s.stunde), gebucht: Number(s.gebucht), abgelehnt: Number(s.abgelehnt),
        })),
      },
      // ── DIE ANRUFSTATISTIK ───────────────────────────────────────────────
      // `annahmeQuote` beantwortet die Meldung „2 von 158" direkt. `hinweis`
      // sagt, was die Zahlen NICHT hergeben — sonst liest jemand eine fehlende
      // Klingeldauer als „0 Sekunden Klingeln".
      anrufe: {
        versuche: Number(anrufe?.versuche ?? 0),
        angenommen: Number(anrufe?.angenommen ?? 0),
        abgelehntBesetzt: Number(anrufe?.abgelehnt_besetzt ?? 0),
        fehlgeschlagen: Number(anrufe?.fehlgeschlagen ?? 0),
        ohneRueckmeldung: Number(anrufe?.ohne_rueckmeldung ?? 0),
        eingehendVerpasst: Number(anrufe?.eingehend_verpasst ?? 0),
        schnittSek: Number(anrufe?.schnitt_sek ?? 0),
        unter5s: Number(anrufe?.unter_5s ?? 0),
        annahmeQuote: Number(anrufe?.versuche ?? 0) > 0
          ? Math.round((Number(anrufe.angenommen) / Number(anrufe.versuche)) * 100) : 0,
        jeAgent: anrufeJeAgent.map((a) => ({
          name: a.name, versuche: Number(a.versuche), angenommen: Number(a.angenommen),
          schnittSek: Number(a.schnitt_sek ?? 0),
        })),
        jeTag: anrufeJeTag.map((t) => ({
          tag: t.tag, versuche: Number(t.versuche), angenommen: Number(t.angenommen),
        })),
        hinweis: "Eine echte KLINGELDAUER ist nicht messbar: Es wird kein Zeitpunkt "
          + "für „angenommen“ gespeichert, und Twilios „no-answer“ und „besetzt“ "
          + "landen beide auf demselben Wert. Ø-Dauer meint die GESPRÄCHSZEIT der "
          + "angenommenen Anrufe.",
      },
      jeAgent: jeAgent.map((a) => ({
        id: Number(a.id), name: a.name, rolle: a.rolle,
        termine: Number(a.termine),
        erledigt: Number(a.erledigt),
        verpasst: Number(a.verpasst),
        abgesagt: Number(a.abgesagt),
        vergangen: Number(a.vergangen),
        kommend: Number(a.kommend),
        // Quoten über VERGANGENE Termine: Ein Termin morgen ist weder erledigt
        // noch verpasst, und ihn mitzuzählen macht jeden Vergleich falsch.
        erledigtQuote: Number(a.vergangen) > 0
          ? Math.round((Number(a.erledigt) / Number(a.vergangen)) * 100) : null,
        noShowQuote: Number(a.vergangen) > 0
          ? Math.round((Number(a.verpasst) / Number(a.vergangen)) * 100) : null,
      })),
      ohneTermin: {
        anzahl: Number(ohne.n),
        mitMail: Number(ohne.mit_mail),
        liste: ohneListe.map((o) => ({
          ref: o.ref, personId: Number(o.person_id), name: o.name,
          paket: o.pack_name, bezahltAm: o.paid_at,
          email: o.primary_email ?? null, telefon: o.primary_phone ?? null,
          agentName: o.agent_name ?? null,
          letzteEinladung: o.letzte_einladung ?? null,
          akte: `/admin/kunde/${encodeURIComponent(String(o.ref))}`,
        })),
      },
      quellen: QUELLE_TEXT,
      statusListe: STATUS_TEXT,
    });
  } catch (err) {
    console.error("[TERMIN-ZENTRALE] laden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/termine/einladen — Einladung zum Startgespräch
// ═══════════════════════════════════════════════════════════════════════════
//
// ── DIE STAFFEL IST PFLICHT ────────────────────────────────────────────────
// 336 Kunden ohne Termin. Ein Knopf, der 336 Mails auf einmal verschickt, ist
// ein Reputationsschaden: Brevo bewertet plötzliche Spitzen als Spam-Verhalten,
// und danach kommen auch die Zahlungsaufforderungen nicht mehr an.
//
// Deshalb höchstens 50 am Tag — dieselbe Grenze, die der Bestandslauf vom
// 20.08.2026 benutzt. Und eine VORSCHAU, bevor etwas rausgeht.
const TAGESGRENZE = 50;

router.post("/admin/termine/einladen", async (req: Request, res: Response) => {
  try {
    const refs: string[] = Array.isArray(req.body?.refs)
      ? req.body.refs.map((r: unknown) => String(r)).slice(0, 500) : [];
    const alle = req.body?.alle === true;
    const nurVorschau = req.body?.schreiben !== true;

    // Wie viele Einladungen gingen heute schon raus? Die Grenze gilt für den
    // TAG, nicht für den Klick.
    const [heute] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_mail_log
      WHERE event = 'onboarding_einladung'
        AND created_at >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
    `) as any[];
    const rest = Math.max(0, TAGESGRENZE - Number(heute.n));

    // Die Kandidaten: bezahlt, ohne Termin, mit E-Mail.
    const kandidaten = (await sqlPool`
      SELECT a.ref, a.person_id, p.primary_email,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, 'Unbekannt') AS name
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND a.payment_status = 'paid'
        AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id)
        AND COALESCE(p.ist_test_am::text, '') = ''
        -- Ohne Adresse kein Versand. Diese Kunden brauchen einen Anruf.
        AND NULLIF(TRIM(COALESCE(p.primary_email, '')), '') IS NOT NULL
        AND (${alle}::boolean = TRUE OR a.ref = ANY(${refs}))
      ORDER BY a.paid_at ASC NULLS LAST
      LIMIT ${Math.max(0, rest)}
    `) as any[];

    if (nurVorschau) {
      return res.json({
        ok: true, vorschau: true,
        heuteSchon: Number(heute.n), tagesgrenze: TAGESGRENZE, rest,
        wuerdenGehen: kandidaten.length,
        namen: kandidaten.slice(0, 12).map((k) => k.name),
        hinweis: rest === 0
          ? `Die Tagesgrenze von ${TAGESGRENZE} ist erreicht (${heute.n} heute verschickt). `
            + "Morgen geht es weiter — das schützt die Zustellbarkeit aller Mails."
          : `${kandidaten.length} Einladungen würden jetzt rausgehen `
            + `(noch ${rest} von ${TAGESGRENZE} heute möglich).`,
      });
    }

    // ── VERSAND ────────────────────────────────────────────────────────────
    const { mailSenden } = await import("../lib/fiaon-mail-senden");
    let gesendet = 0;
    const fehler: string[] = [];
    for (const k of kandidaten) {
      const v = await mailSenden({
        event: "onboarding_einladung",
        ref: String(k.ref),
        personId: Number(k.person_id),
        akteur: { name: "Vorgesetzter (Termin-Zentrale)", agentId: null, rolle: "admin" },
      }).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
      if ((v as any).ok) {
        gesendet++;
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
          VALUES (${k.ref}, NULL, 'Vorgesetzter', 'system',
                  'Einladung zum Startgespräch aus der Termin-Zentrale geschickt.')
        `.catch((e) => console.error(`[ZENTRALE] Verlaufseintrag zur Einladung ${k.ref} nicht geschrieben — niemand sieht, dass sie raus ist:`, e));
      } else {
        fehler.push(`${k.name}: ${(v as any).grund ?? "unbekannt"}`);
      }
      // Kleine Staffel gegen Drosselung — dieselbe Vorsicht wie beim
      // Zweig-Prüflauf.
      await new Promise((r) => setTimeout(r, 150));
    }

    res.json({
      ok: true, vorschau: false, gesendet,
      fehler: fehler.slice(0, 8),
      heuteSchon: Number(heute.n) + gesendet, tagesgrenze: TAGESGRENZE,
      hinweis: `${gesendet} Einladungen verschickt.`
        + (fehler.length ? ` ${fehler.length} scheiterten.` : "")
        + ` Heute insgesamt ${Number(heute.n) + gesendet} von ${TAGESGRENZE}.`,
    });
  } catch (err) {
    console.error("[TERMIN-ZENTRALE] einladen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
