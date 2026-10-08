// ═══════════════════════════════════════════════════════════════════════════
// LAUFEN TAGESLÄUFE IN DIESEM PROZESS?
//
// DER VORFALL (08.08.2026)
// Auf einem Entwicklungsrechner lief `npm run dev` — gegen die
// PRODUKTIONSDATENBANK, denn eine andere gibt es nicht. Zwanzig Minuten später
// feuerte ein frisch eingebauter Tageslauf und markierte 26 echte Kunden als
// „angeschrieben", ohne dass eine einzige Mail rausging: Die
// Entwicklungsmaschine hat keinen Mail-Kanal. Reparabel, aber vermeidbar.
//
// DIE REGEL
// Ein Prozess führt nur dann Tagesläufe aus, wenn er der BETRIEB ist. Das ist
// keine Annahme über die Umgebung, sondern eine ausdrückliche Aussage:
//   NODE_ENV=production  → das hier ist der Betrieb
//   CRONS=an             → ich weiß, was ich tue (lokaler Test)
//
// Alles andere läuft ohne Automatik. Wer einen Lauf prüfen will, ruft ihn von
// Hand über sein Skript oder die Admin-Route auf — dann ist es eine
// Entscheidung und kein Nebeneffekt des Startens.
// ═══════════════════════════════════════════════════════════════════════════

export const CRONS_AN =
  // CRONS=aus schaltet die Läufe auch in Produktion ab — nötig beim Umzug (23.08.2026):
  // Der neue Frankfurt-Service läuft vor der Umschaltung auf einer Datenkopie und darf
  // keine Erinnerungen, Mails oder Buchungen doppelt auslösen.
  String(process.env.CRONS || "").toLowerCase() !== "aus" &&
  (process.env.NODE_ENV === "production" || String(process.env.CRONS || "").toLowerCase() === "an");

let gemeldet = false;

/**
 * Registriert einen Tageslauf — oder eben nicht.
 *
 * Statt jede Aufrufstelle mit einem `if` zu versehen (das man vergessen kann),
 * geht die Registrierung durch diese eine Tür.
 */
export function tageslauf(
  name: string,
  /**
   * Die Arbeit selbst — sie wird ERWARTET (`await fn()`).
   *
   * ── WARUM HIER KEIN `catch` STEHEN DARF (02.09.2026) ──────────────────
   * Bis heute übergab fast jeder Lauf eine Hülle der Form
   *   `() => { arbeit().catch(e => console.error(e)) }`
   * Die kehrt SOFORT zurück. `laufMitHistorie` maß deshalb 0 ms, schrieb
   * jedes Mal 'erfolg' und sah nie einen Fehler — in vierzehn Tagen standen
   * über 12.000 Läufe in der Historie und NULL Fehler, obwohl darunter
   * Ratenmotor, Zahlungserinnerungen und der Postmeister liefen. Auch die
   * Sperre gegen gleichzeitige Läufe war wirkungslos, weil die Zeile sofort
   * auf 'erfolg' drehte.
   *
   * Deshalb: das Promise ZURÜCKGEBEN und den Fehler durchlassen. Die
   * Historie fängt ihn und schreibt 'fehler' mit Text — das ist der Ort, an
   * dem ihn jemand sieht.
   */
  fn: () => void | Promise<unknown>,
  intervallMs: number,
  opts: {
    /**
     * Ein ZWEITER Grund, warum dieser Lauf laufen darf — für Läufe mit eigenem
     * lokalen Testschalter (z. B. `ABO_MOTOR_LOKAL=1`).
     *
     * ── WARUM DAS HIER STEHT UND NICHT DORT (17.08.2026) ─────────────────
     * Der Abo-Motor hatte seine eigene `if (NODE_ENV === "production" ||
     * ABO_MOTOR_LOKAL)`-Zeile. Sie war richtig — aber sie war die vierte
     * Fassung derselben Regel im Haus. GEMESSEN: von sieben zeitgesteuerten
     * Läufen gingen zwei ganz an der Bremse vorbei, zwei prüften selbst, drei
     * nahmen die Registratur.
     *
     * Damit ALLE durch diese eine Tür gehen können, ohne ihren eigenen
     * Testschalter zu verlieren, nimmt die Tür ihn hier auf.
     */
    auchWenn?: boolean;
    /** Einmal kurz nach dem Start laufen (Millisekunden). 0 = nicht. */
    beimStartNach?: number;
    /**
     * Nur ausführen, wenn der letzte ERFOLG länger her ist als so viele Stunden.
     *
     * Das ersetzt starre Uhrzeit-Fenster: Ein Lauf, der einmal am Tag laufen
     * soll, bekommt `alleXStunden: 20` und holt sich beim nächsten Takt selbst
     * ein — auch wenn der Server um 6 Uhr geschlafen hat. Genau daran ist der
     * Folgelauf im August fünfzehn Tage lang gescheitert.
     *
     * Ohne Angabe läuft der Lauf bei jedem Takt (für Läufe, die ihre Arbeit
     * selbst takten).
     */
    alleXStunden?: number;
    /**
     * Nur für Minutentakte, die fast immer nichts zu tun haben (28.09.2026,
     * E-253: wa_zentrale_fortsetzen). Die Arbeit meldet mit `true`, dass sie
     * etwas getan hat — nur dann (oder bei einem Fehler) entsteht eine Zeile in
     * fiaon_lauf_historie. Sonst legte ein Minutentakt je Instanz 1.440 Zeilen
     * am Tag auf eine Tabelle, die niemand aufräumt (gemessen 28.09.: 105.531
     * Zeilen, 11.057 in 24 h). Gleichzeitige Läufe verhindert hier der Prozess
     * selbst; die Arbeit muss über Instanzen hinweg selbst atomar sein.
     */
    nurMitErgebnis?: boolean;
  } = {},
): void {
  if (!CRONS_AN && !opts.auchWenn) {
    if (!gemeldet) {
      console.log("[CRONS] Tagesläufe AUS — kein Produktionsbetrieb. Einschalten mit CRONS=an.");
      gemeldet = true;
    }
    REGISTRIERT.push({ name, intervallMs, laeuft: false });
    return;
  }
  // ── JEDER LAUF GEHT DURCH DIE HISTORIE ────────────────────────────────
  // Auch die, die ihre Arbeit selbst takten (der Abo-Motor prüft sein
  // Versandfenster, die Lead-Strecke ihren Slot). Für sie ist `alleXStunden`
  // nicht gesetzt — sie laufen wie bisher bei jedem Takt, hinterlassen aber
  // eine Spur. Ohne die Spur ist keine Ampel möglich, und ohne Ampel wiederholt
  // sich der 15-Tage-Ausfall vom August.
  // ── Mara-Topsales 08.10.2026 (Justin): DAS ERGEBNIS WIRD GESCHRIEBEN ─────────────────────────
  // Bis heute verwarf diese Hülle, was der Lauf zurückgab: Von 22.236 Historienzeilen in 48 h trugen 3 eine Meldung,
  // alles stand auf „erfolg“ — auch die Abbruch-Kette, die 47 Tage lang keine einzige Mail verschickte, und Mara an
  // Tagen mit 0–2 Mails. Jetzt steht das Ergebnis kurz und ohne Personendaten in `meldung` (laufMeldung), bei den
  // Verkaufsläufen mit der Zahl „versandt“ — daraus alarmiert verkaufsLaeufeWachen.
  const sicher = opts.nurMitErgebnis
    ? () => { void stillerLauf(name, fn).catch((err) => console.error(`[CRONS] ${name}:`, err)); }
    : () => {
      void laufMitHistorie(
        name,
        async () => await fn(),
        { alleXStunden: opts.alleXStunden, meldung: (e) => laufMeldung(name, e) },
      ).catch((err) => console.error(`[CRONS] ${name}:`, err));
    };
  if (opts.beimStartNach && opts.beimStartNach > 0) setTimeout(sicher, opts.beimStartNach);
  setInterval(sicher, intervallMs);
  REGISTRIERT.push({ name, intervallMs, laeuft: true });
}

/**
 * Ein Minutentakt mit `nurMitErgebnis` (E-253): eine Historienzeile nur, wenn die
 * Arbeit `true` meldet (etwas getan) oder scheitert — der Fehler wird wie in
 * laufMitHistorie GESCHRIEBEN, nicht verschluckt. Solange derselbe Prozess noch
 * daran arbeitet, fängt kein zweiter Durchlauf an.
 */
const stillAktiv = new Set<string>();
export async function stillerLauf(name: string, fn: () => void | Promise<unknown>): Promise<void> {
  if (stillAktiv.has(name)) return;
  stillAktiv.add(name);
  const start = Date.now();
  const zeile = async (ergebnis: "erfolg" | "fehler", fehler: string | null) => {
    const { sqlPool } = await import("./db-pool");
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, fehler)
      VALUES (${name}, ${ergebnis}, ${new Date(start)}, NOW(), ${Date.now() - start}, ${fehler})`.catch(() => {});
  };
  try {
    if ((await fn()) === true) await zeile("erfolg", null);
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    console.error(`[CRONS] ${name} FEHLER:`, err);
    await zeile("fehler", text.slice(0, 2000));
  } finally {
    stillAktiv.delete(name);
  }
}

/**
 * Alle registrierten Läufe — für die Admin-Ansicht und den Prüfstand.
 *
 * Eine Regel, die man nicht nachzählen kann, glaubt man nicht. Diese Liste
 * beantwortet „welche Automatik läuft hier eigentlich?" ohne Grep.
 */
export const REGISTRIERT: { name: string; intervallMs: number; laeuft: boolean }[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// SELBSTÜBERWACHUNG UND FÄLLIGKEIT
//
// ── DER VORFALL, AUS DEM DAS HIER ENTSTANDEN IST (30.08.2026) ──────────────
// `followup_last_run` stand fünfzehn Tage still, und niemand hat es gemerkt.
// Zwei Ursachen, die zusammen erst den stillen Ausfall ergeben:
//
//   1. DIE STARRE UHRZEIT. Der Lauf durfte nur in der 6-Uhr-Stunde (Wien)
//      weitermachen. Ein Prozess, der in dieser einen Stunde nicht lebt —
//      Neustart, Deploy, ein schlafender Dienst —, hat den Tag verloren. Und
//      den nächsten. Ein Fenster ohne Nachhol-Logik ist eine Wette darauf, dass
//      der Server zur richtigen Minute wach ist.
//
//   2. KEINE SPUR. Von acht Läufen schrieben drei ihren Stand — jeder anders.
//      Fünf schrieben nichts. „Nicht gelaufen" war von „nichts zu tun" nicht zu
//      unterscheiden, also gab es nichts zu überwachen.
//
// ── DIE ANTWORT ───────────────────────────────────────────────────────────
// Beides gehört in DIESE Datei, nicht in acht Aufrufstellen. Dasselbe Argument
// wie bei der Produktionsbremse darüber: Eine Regel, die jede Aufrufstelle
// selbst kennen muss, wird an der neunten vergessen.
//
//   · `istFaellig` fragt die HISTORIE, nicht die Uhr: „liegt der letzte
//     ERFOLGREICHE Durchlauf länger zurück als das Fenster?" Damit holt ein
//     Lauf sich beim nächsten Takt selbst ein — egal, wann der Server aufwacht.
//   · `laufMitHistorie` schreibt Start, Ende, Dauer und Ergebnis. Auch den
//     Fehler. Besonders den Fehler.
// ═══════════════════════════════════════════════════════════════════════════

/** Ab wann gilt ein Lauf als überfällig? Dieselbe Grenze wie die Ampel. */
export const AMPEL_GELB_STUNDEN = 26;
export const AMPEL_ROT_STUNDEN = 50;

/**
 * Ist dieser Lauf fällig?
 *
 * @param name    Der Name aus `tageslauf(...)`.
 * @param stunden Wie lange darf der letzte ERFOLG zurückliegen?
 *
 * Gezählt wird ab dem letzten Erfolg, nicht ab dem letzten Versuch: Ein Lauf,
 * der dreimal scheitert, ist weiter fällig. Zählte man Versuche, hätte ein
 * kaputter Lauf sich selbst stillgelegt.
 *
 * Kein Eintrag = fällig. Ein Lauf, der noch nie gelaufen ist, soll laufen.
 */
export async function istFaellig(name: string, stunden: number): Promise<boolean> {
  const { sqlPool } = await import("./db-pool");
  try {
    const [r] = (await sqlPool`
      SELECT begonnen FROM fiaon_lauf_historie
      WHERE name = ${name} AND ergebnis = 'erfolg'
      ORDER BY begonnen DESC LIMIT 1
    `) as any[];
    if (!r?.begonnen) return true;
    return Date.now() - new Date(r.begonnen).getTime() >= stunden * 3_600_000;
  } catch (e) {
    // Fehlt die Tabelle (Migration noch nicht gelaufen), darf der Lauf NICHT
    // blockieren: Eine fehlende Überwachung ist ein Grund, mehr zu laufen, nicht
    // weniger.
    console.error(`[CRONS] istFaellig(${name}):`, e instanceof Error ? e.message : e);
    return true;
  }
}

/** Wann lief ein Lauf zuletzt erfolgreich, und was war zuletzt überhaupt? */
export async function laufStand(name: string): Promise<{
  letzterErfolg: string | null; letzterVersuch: string | null;
  letzterFehler: string | null; letzteMeldung: string | null; stundenHer: number | null;
}> {
  const { sqlPool } = await import("./db-pool");
  const [r] = (await sqlPool`
    SELECT
      (SELECT begonnen FROM fiaon_lauf_historie
        WHERE name = ${name} AND ergebnis = 'erfolg' ORDER BY begonnen DESC LIMIT 1) AS erfolg,
      (SELECT begonnen FROM fiaon_lauf_historie
        WHERE name = ${name} AND ergebnis <> 'uebersprungen' ORDER BY begonnen DESC LIMIT 1) AS versuch,
      (SELECT fehler FROM fiaon_lauf_historie
        WHERE name = ${name} AND ergebnis = 'fehler' ORDER BY begonnen DESC LIMIT 1) AS fehler,
      (SELECT meldung FROM fiaon_lauf_historie
        WHERE name = ${name} AND ergebnis = 'erfolg' ORDER BY begonnen DESC LIMIT 1) AS meldung
  `.catch(() => [{}])) as any[];
  const erfolg = r?.erfolg ? new Date(r.erfolg) : null;
  return {
    letzterErfolg: erfolg ? erfolg.toISOString() : null,
    letzterVersuch: r?.versuch ? new Date(r.versuch).toISOString() : null,
    letzterFehler: r?.fehler ?? null,
    letzteMeldung: r?.meldung ?? null,
    stundenHer: erfolg ? Math.round((Date.now() - erfolg.getTime()) / 3_600_000) : null,
  };
}

/**
 * Einen Lauf ausführen und festhalten, was dabei herauskam.
 *
 * ── DIE SPERRE ────────────────────────────────────────────────────────────
 * Zwei Instanzen (oder ein Takt, der einen noch laufenden überholt) würden
 * dasselbe zweimal tun — bei Mahnungen heißt das zwei Mails an denselben
 * Menschen. Die Sperre ist eine Zeile in der Historie mit `ergebnis = 'laeuft'`
 * und einem Alter unter zwei Stunden.
 *
 * Zwei Stunden, weil ein hängengebliebener Lauf sonst für immer sperrt. Eine
 * Sperre ohne Verfall ist eine Sperre, die irgendwann alles anhält.
 */
export async function laufMitHistorie<T>(
  name: string,
  fn: () => Promise<T>,
  opts: { alleXStunden?: number; meldung?: (e: T) => string | null; sperreMinuten?: number } = {},
): Promise<{ gelaufen: boolean; grund?: string; ergebnis?: T }> {
  const { sqlPool } = await import("./db-pool");

  if (opts.alleXStunden && !(await istFaellig(name, opts.alleXStunden))) {
    return { gelaufen: false, grund: "noch nicht fällig" };
  }

  // ── WIE LANGE EINE SPERRE GILT (02.09.2026) ──────────────────────────────
  // Bis heute galten pauschal zwei Stunden. Das war zu grob, und es hat an
  // diesem Abend real geschadet: Ein Postmeister-Lauf wurde vom Neustart des
  // Dienstes mitten in der Arbeit unterbrochen. Seine Zeile blieb auf
  // 'laeuft' stehen — und sperrte den Agenten anschließend ZWEI STUNDEN,
  // obwohl sein Takt fünf Minuten beträgt und der Prozess, der ihn hielt,
  // längst nicht mehr existierte.
  //
  // Vor dem Umbau der Läufe konnte das nicht passieren: Die Zeile drehte
  // sofort auf 'erfolg', also gab es nie ein Waisenkind. Die neue Genauigkeit
  // hat diese Möglichkeit überhaupt erst geschaffen — sie muss also auch die
  // Antwort mitbringen.
  //
  // Die Frist richtet sich jetzt nach dem Takt: dreimal das Intervall, aber
  // mindestens 15 Minuten und höchstens zwei Stunden. Ein Fünf-Minuten-Lauf
  // ist damit nach einer Viertelstunde wieder frei, ein Sechs-Stunden-Lauf
  // behält seine zwei Stunden Schutz.
  const takt = REGISTRIERT.find((r) => r.name === name)?.intervallMs ?? 0;
  const minuten = opts.sperreMinuten
    ?? Math.min(120, Math.max(15, Math.round((takt * 3) / 60_000)));
  const [offen] = (await sqlPool`
    SELECT id, begonnen FROM fiaon_lauf_historie
    WHERE name = ${name} AND ergebnis = 'laeuft'
      AND begonnen > NOW() - (${minuten} || ' minutes')::interval
    LIMIT 1
  `.catch(() => [])) as any[];
  if (offen) return { gelaufen: false, grund: "läuft bereits" };

  // Was älter ist als die Frist, war ein Abbruch — kein Prozess arbeitet noch
  // daran. Die Zeile wird als solche gekennzeichnet, statt stumm liegen zu
  // bleiben: Eine Historie voller ewiger 'laeuft'-Zeilen verschweigt, dass
  // etwas mittendrin gestorben ist. (Am 02.09. stand die älteste seit 13 Tagen.)
  await sqlPool`
    UPDATE fiaon_lauf_historie
       SET ergebnis = 'abgebrochen', beendet = NOW(),
           fehler = COALESCE(fehler, 'Der Dienst wurde während des Laufs beendet (Neustart oder Absturz).')
     WHERE name = ${name} AND ergebnis = 'laeuft'
       AND begonnen <= NOW() - (${minuten} || ' minutes')::interval
  `.catch(() => {});

  const [zeile] = (await sqlPool`
    INSERT INTO fiaon_lauf_historie (name, ergebnis) VALUES (${name}, 'laeuft')
    RETURNING id
  `.catch(() => [{ id: null }])) as any[];
  const id = zeile?.id ?? null;
  const start = Date.now();

  try {
    const ergebnis = await fn();
    const dauer = Date.now() - start;
    if (id) {
      // Mara-Topsales 08.10.2026: Eine Meldung, die nichts zu sagen hat (null), bleibt leer — nicht der Text „null“.
      let meldung: string | null = null;
      try { const m = opts.meldung ? opts.meldung(ergebnis) : null; meldung = m == null ? null : String(m).slice(0, 2000); } catch { meldung = null; }
      await sqlPool`
        UPDATE fiaon_lauf_historie
        SET ergebnis = 'erfolg', beendet = NOW(), dauer_ms = ${dauer},
            meldung = ${meldung}
        WHERE id = ${id}
      `.catch(() => {});
    }
    return { gelaufen: true, ergebnis };
  } catch (err) {
    const dauer = Date.now() - start;
    const text = err instanceof Error ? `${err.message}` : String(err);
    // Der Fehler wird GESCHRIEBEN, nicht verschluckt. Genau dieses stille
    // `.catch()` hat den Ausfall vom August unsichtbar gemacht.
    console.error(`[CRONS] ${name} FEHLER:`, err);
    if (id) {
      await sqlPool`
        UPDATE fiaon_lauf_historie
        SET ergebnis = 'fehler', beendet = NOW(), dauer_ms = ${dauer},
            fehler = ${text.slice(0, 2000)}
        WHERE id = ${id}
      `.catch(() => {});
    }
    return { gelaufen: false, grund: `Fehler: ${text}` };
  }
}

/**
 * Läufe, die zu lange ausbleiben — mit dem Satz, was dadurch ausfällt.
 *
 * Der Satz steht HIER und nicht in der Oberfläche: Eine Ampel ohne Folge ist
 * eine Farbe. Wer „rot" sieht und nicht weiß, was liegen bleibt, priorisiert
 * nicht.
 */
export const LAUF_FOLGEN: Record<string, { zweck: string; folge: string; fenster: number }> = {
  "followup-und-termine": {
    zweck: "Einstufung, Zuteilung herrenloser Zahlungsmelder, Eskalation überfälliger Zahlungszusagen",
    folge: "Bezahlbereite Kunden liegen in niemandes Liste, gebrochene Zusagen werden "
      + "nicht eskaliert, und die Stufen veralten.",
    fenster: 24,
  },
  // 27.08.2026: Der Clarity-Lauf gehört in DIESEN Katalog, nicht nur in die
  // Registratur. Die Ampel-Liste liest hier — ein Lauf, der nur registriert
  // ist, fällt beim Ausfall niemandem auf. Genau daran ist der Folgelauf im
  // August fünfzehn Tage lang gescheitert.
  "clarity-besucher": {
    zweck: "Besucherzahlen und Ärgernis-Metriken von Microsoft Clarity holen und ablegen",
    folge: "Das Besucher-Dashboard bleibt auf dem alten Stand stehen — und weil Clarity "
      + "nur die letzten drei Tage herausgibt, entsteht eine Lücke im Verlauf, die sich "
      + "nicht mehr schließen lässt.",
    // 30 statt 24: Der Lauf holt bewusst nur alle 20 Stunden, und Clarity setzt
    // sein Tageslimit um Mitternacht UTC zurück. Bei 24 stünde die Ampel jeden
    // zweiten Tag kurz auf Gelb, ohne dass etwas fehlt.
    fenster: 30,
  },
  "betreuer-kopie-angleich": {
    zweck: "Betreuer-Kopie am Antrag stuendlich an die Person angleichen (eine Wahrheit)",
    folge: "Management und Telefon nennen wieder verschiedene Betreuer — Kunden werden "
      + "faelschlich als frei oder als vergeben behandelt.",
    fenster: 3,
  },
  "abo-motor": {
    zweck: "Raten anlegen, Rechnungen stellen, überfällig stellen, Inkasso zuteilen",
    folge: "Kunden bekommen keine Abo-Rechnung — es fehlt Geld, das niemand anmahnt.",
    fenster: 2,
  },
  auszahlungstag: {
    zweck: "Vorgemerkte Buchungen (Gehalt) am Freigabetag bestätigen; ab dem 15. das bestätigte Guthaben aller in die Auszahlung stellen",
    folge: "Gehalt bleibt vorgemerkt, Provisionen bleiben liegen — die Mitarbeiter sehen ihr Geld nicht kommen.",
    fenster: 26,
  },
  zahlungserinnerungen: {
    zweck: "Zahlungserinnerungen an Kunden mit offener Rechnung",
    folge: "Offene Rechnungen werden nicht angemahnt.",
    fenster: 24,
  },
  "lead-nachfass-und-verteilung": {
    zweck: "Lead-Strecke versenden, neue Leads zuweisen",
    folge: "Neue Leads bekommen keine Nachfassmail und liegen bei niemandem.",
    fenster: 24,
  },
  "rueckruf-eskalation": {
    zweck: "Rückrufwünsche eskalieren, deren 24-Stunden-Frist gerissen ist",
    folge: "Ein Kunde, der um Rückruf bittet, wartet unbegrenzt auf eine Antwort.",
    fenster: 24,
  },
  "agent-rueckruf-erinnerungen": {
    zweck: "Den Zuständigen an seinen eigenen Rückruftermin erinnern",
    folge: "Der Agent erfährt nichts von seinem Termin — der Kunde wartet.",
    fenster: 24,
  },
  "warten-nummern-nachtragen": {
    zweck: "Wartezustände nachtragen (Nummernkorrektur, Terminbitte)",
    folge: "Kunden stehen in Arbeitslisten, obwohl auf sie gewartet wird.",
    fenster: 24,
  },
  "aufnahmen-aufraeumen": {
    zweck: "Gesprächsaufnahmen nach Ablauf der Frist löschen (DSGVO)",
    folge: "Aufnahmen liegen länger als erlaubt — ein Datenschutzverstoß, der wächst.",
    fenster: 24,
  },
  // 17.09.2026 (E-188): „Mein Auftrag" von FIAON Global. Die Pakete sagen Pflichtenkalender und
  // monatlichen Durchgang zu — bleibt dieser Lauf aus, bleibt beides stumm, und niemand merkt es,
  // weil ein Firmenkunde sich nicht über eine Erinnerung beschwert, die er nie bekommen hat.
  // 19.09.2026: Firmen-Radar — sucht stündlich (6–20 Uhr Berlin) bis zu drei Mal, bis 50 geprüfte Firmen im Radar stehen.
  firmen_radar: {
    zweck: "Firmen-Radar: täglich 50 passende Firmen aus DE/AT/CH suchen, Website und Impressum prüfen, im Chefbüro bereitstellen",
    folge: "Im Chefbüro stehen keine neuen Firmen für persönliche Mails; der Vertrieb von FIAON Global bekommt keinen Nachschub.",
    fenster: 26,
  },
  // 19.09.2026 (E-196): dazu Schritt (d) — die Aufgabe, die Rechnung für das zweite Jahr der Jahresbetreuung zu stellen.
  global_tageslauf: {
    zweck: "FIAON Global: Kunden an Termine des Pflichtenkalenders erinnern (rund einen Monat und eine Woche vorher), "
      + "den monatlichen Durchgang als Aufgabe einstellen, bei fehlenden Unterlagen nach fünf Tagen nachfassen lassen, "
      + "bei gebuchter Jahresbetreuung rund einen Monat vor dem ersten Jahrestag die Aufgabe „Rechnung für das zweite Betreuungsjahr stellen“ vergeben",
    folge: "Firmenkunden werden nicht an US-Meldungen und Staatstermine erinnert, der zugesagte monatliche "
      + "Durchgang findet nicht statt, Aufträge ohne Unterlagen bleiben unbemerkt liegen, und die Rechnung für "
      + "das zweite Jahr der Jahresbetreuung wird nicht gestellt — die Betreuung beginnt dann nicht.",
    fenster: 26,
  },
  // E-188 (17.09.2026): Der Lauf tickt halbstündlich und arbeitet nur im Sendefenster (Berlin 8–20 Uhr,
  // Mo–Sa) — außerhalb kehrt er sofort zurück und zählt trotzdem als gelaufen. Steht er, steht der Takt.
  global_zahlung_takt: {
    zweck: "FIAON Global: offene Firmenaufträge am 3. und 7. Tag ruhig an die Überweisung erinnern, am 10. Tag eine dringende Aufgabe „anrufen“ an die zuständige Person",
    folge: "Ein unterschriebener Firmenauftrag über 2.499 € und mehr bleibt ohne Zahlung liegen, und niemand fasst nach — "
      + "die Erinnerungen der Privatkunden gelten für FIAON Global bewusst nicht.",
    fenster: 24,
  },
  global_widerruf_start: {
    zweck: "FIAON Global: bezahlte Privataufträge ohne den Wunsch nach sofortigem Beginn nach Ablauf der Widerrufsfrist starten (Aufgabe „US-Struktur starten“, Startmail)",
    folge: "Ein bezahlter Privatauftrag bleibt nach der Widerrufsfrist liegen: keine Start-Aufgabe, keine Startmail, der Kunde wartet.",
    fenster: 24,
  },
  "followup-und-termine-tageswerk": {
    zweck: "Das Tageswerk im Folgelauf: Zuteilung, Eskalation (einmal täglich; der alte Nachschub ist seit 11.09.2026 abgeschaltet)",
    folge: "Gebrochene Zahlungszusagen werden nicht eskaliert und herrenlose Kunden "
      + "nicht verteilt. GENAU DIESER Lauf stand im August 15 Tage still.",
    fenster: 24,
  },
  // E-244 (26.09.2026): Zahlungserinnerung offener Bonitätsauskünfte. Das Fenster ist 24 h: Der Lauf
  // arbeitet nur 07:00–20:30, meldet sich aber jede halbe Stunde (auch außerhalb, dann ohne Versand).
  // E-246 (27.09.2026, Nachprüfung): Die Nachhol-Takte der KI-Pause. In der Pause kehren sie sofort
  // zurück und zählen trotzdem als gelaufen — rot heißt also: der Takt selbst steht (z. B. Schemafehler).
  kontoauszug_nachholen: {
    zweck: "Kontoauszüge auswerten, die nie, nur halb oder während der KI-Pause ausgewertet wurden (alle 20 Min.)",
    folge: "Kunden sehen „Ihre Auswertung wird vorbereitet“ ohne Ende; Fotoseiten bleiben ungelesen, Pause-Fälle werden nie nachgeholt.",
    fenster: 2,
  },
  schufa_nachholen: {
    zweck: "SCHUFA-Auswertungen und Dokumentprüfungen nachholen, die an der KI-Pause hingen (alle 20 Min.)",
    folge: "Auskünfte aus der Pause bleiben ohne Auswertung, Ausweis-/Auskunft-Prüfungen ohne KI-Urteil — Betreuer arbeiten mit einem halben Bild.",
    fenster: 2,
  },
  transkript_nachholen: {
    zweck: "Offene und liegen gebliebene Anruf-Transkripte nachbereiten (alle 10 Min.; nie bei Widerspruch gegen die Aufzeichnung)",
    folge: "Anrufe aus der KI-Pause oder nach einem Neustart bekommen kein Transkript und keinen Aktenvermerk.",
    fenster: 2,
  },
  // E-IT-D (08.10.2026, 4a): die Liegezeit-Wache der Auskunft-Beschaffung (alle 6 Stunden).
  auskunft_liegezeit_wache: {
    zweck: "Bezahlte Auskünfte, die beschaffbar sind und seit drei Werktagen liegen, als Aufgabe an die benannte Verantwortung (zehn Werktage: dringend); unbestätigte Auftragsbestätigungen als Anruf-Aufgabe an den Betreuer",
    folge: "Bezahlte Bonitätsauskünfte liegen wieder wochenlang unbeschafft, ohne dass jemand namentlich daran erinnert wird — der Rückstand vom 29.09. wiederholt sich.",
    fenster: 14,
  },
  auskunft_erinnerung: {
    zweck: "Zahlungserinnerung an offene Bonitätsauskünfte (Tag 1/4/10/18, dann wöchentlich), ab Tag 30 Aufgabe „anrufen oder stornieren“ bzw. „stornieren?“",
    folge: "Bestellte Auskünfte werden nicht bezahlt, und niemand erinnert — die Paket-Mahnmaschine nimmt sie seit E-244 nicht mehr.",
    fenster: 24,
  },
  // ── Mara-Topsales 08.10.2026 (Justin): DIE VERKAUFSLÄUFE GEHÖREN IN DEN KATALOG ──────────────────
  // Keiner der fünf stand hier — die Ampel sah sie nicht, und ein Ausfall fiel niemandem auf (die Abbruch-Kette war
  // 47 Tage tot). Dazu prüft verkaufsLaeufeWachen, ob sie in 24 h überhaupt etwas verschickt haben.
  "antrag-erinnerungen": {
    zweck: "Abbruch-Kette (E-023): bis zu sieben Erinnerungen an Menschen, die den Antrag begonnen und nicht abgeschickt haben",
    folge: "Die wärmste Gruppe nach A/B — rund zehn neue Abbrecher am Tag — hört nichts mehr von uns und bleibt beim halben Antrag stehen.",
    fenster: 2,
  },
  mara_aktion: {
    zweck: "Maras Aktion: persönliche Mails an Stufe A (Klärung der Meldung) und B (Aktivierung offen), 08–21 Uhr",
    folge: "Menschen mit fertigem Antrag und offener erster Rate bekommen keine persönliche Mail mehr — der größte Geldhebel steht.",
    fenster: 2,
  },
  wa_zentrale_takt: {
    zweck: "WhatsApp-Automatik: Vorlagen an die freigegebenen Gruppen, bei ROT nur die Monatsrate (Service)",
    folge: "Fällige Monatsraten werden nicht per WhatsApp erinnert, neue Leads nicht begrüßt.",
    fenster: 2,
  },
  rueckholung: {
    zweck: "Rückholung: Klärmails S1–S4 und Dauerpflege an offene Bestellungen (mit Mahnstopp)",
    folge: "Gemeldete und offene Zahlungen werden nicht mehr geklärt — die Dauerpflege bleibt stehen.",
    fenster: 2,
  },
  mara_wa_nachfass: {
    zweck: "Mara fasst auf WhatsApp einmal nach (4–23 h nach seiner letzten Nachricht, im offenen 24-Stunden-Fenster)",
    folge: "Gespräche, die mit „mache ich später“ enden, verlaufen im Sand — die kostenlose Nachricht im offenen Fenster bleibt ungenutzt.",
    fenster: 2,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Mara-Topsales 08.10.2026 (Justin): DIE MELDUNG JE LAUF UND DER WÄCHTER DER VERKAUFSLÄUFE
//
// laufMeldung macht aus dem Rückgabewert eines Laufs eine kurze Zeile (JSON, höchstens 400 Zeichen) — nur Zahlen,
// Wahrheitswerte und die Felder grund/hinweis (Adressen und lange Ziffernfolgen geschwärzt). Keine Personendaten.
// Bei den Verkaufsläufen (VERKAUFSLAEUFE) steht dazu "versandt": n und, wenn der Lauf abgeschaltet ist, "aus": true.
//
// verkaufsLaeufeWachen (aus laeufeUeberwachen, alle 20 Minuten): Hat ein Verkaufslauf in den letzten 24 Stunden
// gelaufen (mindestens eine Meldung mit "versandt", die erste vor über 20 Stunden), aber zusammen 0 verschickt, und
// war er dabei nicht abgeschaltet, entsteht EINE Betreiber-Aufgabe je Lauf und Tag (Schlüssel lauf:<name>:null-versand:<Tag>).
// ═══════════════════════════════════════════════════════════════════════════
type Zahl = number | null;
const zahl0 = (v: unknown): Zahl => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Wie viel ein Verkaufslauf verschickt hat — und ob er abgeschaltet war. Der Lauf-Name aus tageslauf(…). */
export const VERKAUFSLAEUFE: Record<string, (e: any) => { versandt: Zahl; aus: boolean }> = {
  mara_aktion: (e) => ({ versandt: zahl0(e?.gesendet), aus: e?.grund === "aus" }),
  wa_zentrale_takt: (e) => ({ versandt: zahl0(e?.gesendet), aus: e?.grund === "aus" }),
  rueckholung: (e) => (Array.isArray(e)
    ? { versandt: e.reduce((n: number, x: any) => n + (Number(x?.verschickt) || 0), 0), aus: e.length > 0 && e.every((x: any) => /abgeschaltet/.test(String(x?.grund ?? ""))) }
    : { versandt: null, aus: false }),
  "antrag-erinnerungen": (e) => ({ versandt: zahl0(e), aus: false }),
  // Die Lead-Strecke läuft nur zu ihren Slots — dazwischen gibt der Takt null zurück (kein „versandt“, zählt nicht als gelaufen).
  "lead-nachfass-und-verteilung": (e) => ({ versandt: e && typeof e === "object" ? zahl0(e.sent) : null, aus: !!e?.skippedWindow && zahl0(e?.sent) === 0 }),
  mara_wa_nachfass: (e) => ({ versandt: zahl0(e?.gesendet), aus: !!e?.uebersprungen?.schalter_aus }),
};

/** Schlüssel, die eine Person oder einen Vorgang benennen können — sie stehen nie in der Meldung (auch nicht als Summe). */
const KENNUNG_SCHLUESSEL = /(^id$|_id$|Id$|person|^ref|_ref$|nummer|telefon|phone|email|adresse|iban|name)/i;

function schwaerzen(t: string): string {
  return t.replace(/[^\s@]+@[^\s@]+/g, "…@…").replace(/\+?\d[\d\s/-]{5,}\d/g, "…").slice(0, 80);
}

/** Das Ergebnis eines Laufs als kurze Meldung — ohne Personendaten. null = nichts zu sagen. Rein. */
export function laufMeldung(name: string, erg: unknown): string | null {
  const aus: Record<string, unknown> = {};
  const nimm = (k: string, v: unknown, tiefe = 0) => {
    if (Object.keys(aus).length >= 14 || KENNUNG_SCHLUESSEL.test(k.split(".").pop() ?? k)) return;
    if (typeof v === "number" && Number.isFinite(v)) aus[k] = v;
    else if (typeof v === "boolean") aus[k] = v;
    else if (typeof v === "string" && /(^|\.)(grund|hinweis)$/.test(k)) aus[k] = schwaerzen(v);
    else if (v && typeof v === "object" && !Array.isArray(v) && tiefe < 1) for (const [k2, v2] of Object.entries(v)) nimm(`${k}.${k2}`, v2, tiefe + 1);
  };
  if (typeof erg === "number" || typeof erg === "boolean") aus.wert = erg;
  else if (Array.isArray(erg)) {
    aus.anzahl = erg.length;
    for (const x of erg) if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) {
      if (typeof v === "number" && Number.isFinite(v) && !KENNUNG_SCHLUESSEL.test(k) && (k in aus || Object.keys(aus).length < 14)) aus[k] = (Number(aus[k]) || 0) + v;
    }
  } else if (erg && typeof erg === "object") for (const [k, v] of Object.entries(erg)) nimm(k, v);
  const verkauf = VERKAUFSLAEUFE[name];
  if (verkauf) {
    const v = verkauf(erg);
    if (v.versandt != null) aus.versandt = v.versandt;
    if (v.aus) aus.aus = true;
  }
  if (!Object.keys(aus).length) return null;
  return JSON.stringify(aus).slice(0, 400);
}

/** Wie viele Stunden ein Verkaufslauf vollständig gelaufen sein muss, bevor „0 verschickt“ zählt. */
export const VERKAUF_STUMM_STUNDEN = 24;

/**
 * Der Wächter der Verkaufsläufe. Gibt die Namen der stummen Läufe zurück; `nichtSenden` legt keine Aufgabe an (Prüfstand).
 */
export async function verkaufsLaeufeWachen(opts: { nichtSenden?: boolean } = {}): Promise<string[]> {
  const { sqlPool } = await import("./db-pool");
  const stumm: string[] = [];
  for (const name of Object.keys(VERKAUFSLAEUFE)) {
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS liefen,
             COALESCE(SUM((substring(meldung from '"versandt":([0-9]+)'))::int), 0)::int AS versandt,
             MIN(begonnen) AS erster
        FROM fiaon_lauf_historie
       WHERE name = ${name} AND ergebnis = 'erfolg'
         AND begonnen > NOW() - make_interval(hours => ${VERKAUF_STUMM_STUNDEN})
         AND meldung LIKE '%"versandt":%' AND meldung NOT LIKE '%"aus":true%'
    `.catch(() => [])) as any[];
    const liefen = Number(z?.liefen || 0);
    const erster = z?.erster ? new Date(z.erster).getTime() : null;
    if (!liefen || Number(z?.versandt || 0) > 0 || erster == null || Date.now() - erster < (VERKAUF_STUMM_STUNDEN - 4) * 3_600_000) continue;
    stumm.push(name);
    if (opts.nichtSenden) continue;
    const tag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    try {
      const { todoAnlegen } = await import("../routes/fiaon-betreiber-todo");
      await todoAnlegen(`lauf:${name}:null-versand:${tag}`, {
        titel: `Verkaufslauf „${name}“: seit 24 Stunden nichts verschickt`,
        text: `Der Lauf „${name}“ lief in den letzten 24 Stunden ${liefen}-mal ohne Fehler, hat aber keine einzige Nachricht verschickt. `
          + `Zweck: ${LAUF_FOLGEN[name]?.zweck ?? name}. Was ausfällt: ${LAUF_FOLGEN[name]?.folge ?? "—"} `
          + "Bitte prüfen: Schalter, KI-Pause, Deckel, WhatsApp-Bremse, Auswahl (Meldungen in fiaon_lauf_historie, Stand unter /admin/hub).",
        bereich: "technik", prioritaet: 1, link: "/admin/hub", quelle: "lauf-waechter",
      });
      console.warn(`[CRONS] Verkaufslauf ${name}: 24 h ohne Versand — Betreiber-Aufgabe angelegt.`);
    } catch (e) {
      console.error(`[CRONS] Wächter ${name}:`, e instanceof Error ? e.message : e);
    }
  }
  return stumm;
}

/** Die Ampel eines Laufs — dieselbe Rechnung für Karte, Warnung und Prüfstand. */
export type Ampel = "gruen" | "gelb" | "rot" | "unbekannt";

export function ampelFuer(stundenHer: number | null): Ampel {
  if (stundenHer == null) return "unbekannt";
  if (stundenHer < AMPEL_GELB_STUNDEN) return "gruen";
  if (stundenHer < AMPEL_ROT_STUNDEN) return "gelb";
  return "rot";
}

export interface LaufAmpel {
  name: string;
  zweck: string;
  folge: string;
  letzterErfolg: string | null;
  letzterVersuch: string | null;
  letzterFehler: string | null;
  letzteMeldung: string | null;
  stundenHer: number | null;
  ampel: Ampel;
  registriert: boolean;
}

/**
 * Der Stand ALLER bekannten Läufe — für die Karte und die Warnung.
 *
 * Die Liste kommt aus `LAUF_FOLGEN`, nicht aus `REGISTRIERT`: Ein Lauf, der
 * wegen eines Fehlers gar nicht mehr registriert wird, muss ERST RECHT
 * auffallen. Wer nur zeigt, was sich angemeldet hat, sieht das Fehlen nicht.
 */
export async function alleLaufAmpeln(): Promise<LaufAmpel[]> {
  const namen = Object.keys(LAUF_FOLGEN);
  const raus: LaufAmpel[] = [];
  for (const name of namen) {
    const s = await laufStand(name);
    raus.push({
      name,
      zweck: LAUF_FOLGEN[name].zweck,
      folge: LAUF_FOLGEN[name].folge,
      letzterErfolg: s.letzterErfolg,
      letzterVersuch: s.letzterVersuch,
      letzterFehler: s.letzterFehler,
      letzteMeldung: s.letzteMeldung,
      stundenHer: s.stundenHer,
      ampel: ampelFuer(s.stundenHer),
      registriert: REGISTRIERT.some((r) => r.name === name && r.laeuft),
    });
  }
  return raus;
}

/**
 * Bleibt ein Lauf zu lange aus, bekommt der Betreiber eine Mail.
 *
 * ── WARUM DIREKT ÜBER BREVO ───────────────────────────────────────────────
 * Der übliche Weg geht über einen Make-Zweig. Für DIESE Mail wäre das falsch:
 * Sie meldet, dass die Automatik steht — und der Make-Zweig ist selbst Teil der
 * Automatik. Eine Störungsmeldung, die denselben Weg nimmt wie das Gestörte,
 * kommt genau dann nicht an, wenn man sie braucht.
 *
 * ── HÖCHSTENS EINE MAIL JE LAUF UND TAG ───────────────────────────────────
 * Der Folgelauf tickt alle 20 Minuten. Ohne Sperre wären das 72 Mails am Tag,
 * und die 73. würde ungelesen weggewischt — samt der echten Meldung darin.
 */
export async function laeufeUeberwachen(
  opts: { nichtSenden?: boolean } = {},
): Promise<{ geprueft: number; ueberfaellig: LaufAmpel[]; gewarnt: string[]; stumm: string[] }> {
  const { sqlPool } = await import("./db-pool");
  const ampeln = await alleLaufAmpeln();
  // „unbekannt" heißt: noch nie gelaufen, seit es die Historie gibt. Am ersten
  // Tag nach dem Einbau trifft das auf ALLE zu — eine Warnlawine über einen
  // Zustand, den der Einbau selbst erzeugt hat, wäre der sichere Weg, die
  // Warnung dauerhaft zu ignorieren. Gewarnt wird deshalb nur über Läufe, die
  // schon einmal liefen und dann ausblieben.
  const ueberfaellig = ampeln.filter((a) => a.ampel === "rot" || a.ampel === "gelb");
  const gewarnt: string[] = [];

  for (const a of ueberfaellig) {
    const [letzte] = (await sqlPool`
      SELECT gewarnt_am FROM fiaon_lauf_warnungen WHERE name = ${a.name}
    `.catch(() => [])) as any[];
    if (letzte?.gewarnt_am && Date.now() - new Date(letzte.gewarnt_am).getTime() < 24 * 3_600_000) {
      continue;
    }
    if (opts.nichtSenden) { gewarnt.push(a.name); continue; }

    try {
      const { eigeneMailSenden } = await import("./fiaon-brevo");
      const betreff = `FIAON: Der Lauf „${a.name}“ ist seit ${a.stundenHer} Stunden ausgeblieben`;
      const text = [
        `Der automatische Lauf „${a.name}“ ist überfällig.`,
        "",
        `Letzter Erfolg: ${a.letzterErfolg ? new Date(a.letzterErfolg).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "keiner bekannt"}`,
        `Das sind ${a.stundenHer} Stunden.`,
        a.letzterFehler ? `Letzter Fehler: ${a.letzterFehler}` : "",
        "",
        `Zweck: ${a.zweck}`,
        `WAS DADURCH AUSFÄLLT: ${a.folge}`,
        "",
        a.registriert
          ? "Der Lauf ist registriert — er kommt also nur nicht durch."
          : "ACHTUNG: Der Lauf ist in diesem Prozess gar nicht registriert. "
            + "Entweder läuft der Dienst nicht, oder CRONS ist aus.",
        "",
        "Stand aller Läufe: /admin/hub",
      ].filter(Boolean).join("\n");
      const an = process.env.BETREIBER_MAIL || process.env.ADMIN_EMAIL || "";
      if (!an) {
        // Ohne Adresse gibt es keine Mail — aber der Protokolleintrag unten
        // entsteht trotzdem. „Konnte nicht warnen" ist etwas anderes als
        // „musste nicht warnen", und beides darf nicht gleich aussehen.
        console.error("[CRONS] Keine Betreiber-Adresse (BETREIBER_MAIL) — Warnung nur im Protokoll.");
      } else {
        const versand = await eigeneMailSenden({ an, betreff, text });
        if (!versand.ok) console.error(`[CRONS] Warnmail an ${an} scheiterte: ${versand.grund}`);
      }
      gewarnt.push(a.name);
      await sqlPool`
        INSERT INTO fiaon_lauf_warnungen (name, gewarnt_am, stunden)
        VALUES (${a.name}, NOW(), ${a.stundenHer})
        ON CONFLICT (name) DO UPDATE SET gewarnt_am = NOW(), stunden = ${a.stundenHer}
      `.catch(() => {});
      // Und ins Protokoll — eine Mail kann im Spam landen, ein Eintrag nicht.
      await sqlPool`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (NULL, 'lauf_ausgeblieben',
                ${JSON.stringify({ lauf: a.name, stunden: a.stundenHer, folge: a.folge })},
                'System',
                ${`Der Lauf „${a.name}“ ist seit ${a.stundenHer} Stunden ausgeblieben. ${a.folge}`})
      `.catch(() => {});
    } catch (e) {
      console.error(`[CRONS] Warnung für ${a.name} konnte nicht raus:`, e);
    }
  }

  if (ueberfaellig.length > 0) {
    console.warn(`[CRONS] ${ueberfaellig.length} Lauf/Läufe überfällig: `
      + ueberfaellig.map((a) => `${a.name} (${a.stundenHer} h)`).join(", "));
  }
  // Mara-Topsales 08.10.2026: dazu die Verkaufsläufe, die laufen, aber nichts verschicken.
  const stumm = await verkaufsLaeufeWachen({ nichtSenden: opts.nichtSenden }).catch(() => [] as string[]);
  return { geprueft: ampeln.length, ueberfaellig, gewarnt, stumm };
}
