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
  const sicher = () => {
    void laufMitHistorie(
      name,
      async () => { await fn(); },
      { alleXStunden: opts.alleXStunden },
    ).catch((err) => console.error(`[CRONS] ${name}:`, err));
  };
  if (opts.beimStartNach && opts.beimStartNach > 0) setTimeout(sicher, opts.beimStartNach);
  setInterval(sicher, intervallMs);
  REGISTRIERT.push({ name, intervallMs, laeuft: true });
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
  opts: { alleXStunden?: number; meldung?: (e: T) => string } = {},
): Promise<{ gelaufen: boolean; grund?: string; ergebnis?: T }> {
  const { sqlPool } = await import("./db-pool");

  if (opts.alleXStunden && !(await istFaellig(name, opts.alleXStunden))) {
    return { gelaufen: false, grund: "noch nicht fällig" };
  }

  // Läuft schon einer? `FOR UPDATE` wäre hier zu schwach — der andere Lauf
  // hält keine Transaktion offen. Also über das Alter der Zeile.
  const [offen] = (await sqlPool`
    SELECT id FROM fiaon_lauf_historie
    WHERE name = ${name} AND ergebnis = 'laeuft'
      AND begonnen > NOW() - INTERVAL '2 hours'
    LIMIT 1
  `.catch(() => [])) as any[];
  if (offen) return { gelaufen: false, grund: "läuft bereits" };

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
      await sqlPool`
        UPDATE fiaon_lauf_historie
        SET ergebnis = 'erfolg', beendet = NOW(), dauer_ms = ${dauer},
            meldung = ${opts.meldung ? String(opts.meldung(ergebnis)).slice(0, 2000) : null}
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
    zweck: "Einstufung, Zuteilung, Eskalation überfälliger Zahlungszusagen, Nachschub",
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
  "followup-und-termine-tageswerk": {
    zweck: "Das Tageswerk im Folgelauf: Zuteilung, Eskalation, Nachschub (einmal täglich)",
    folge: "Gebrochene Zahlungszusagen werden nicht eskaliert und herrenlose Kunden "
      + "nicht verteilt. GENAU DIESER Lauf stand im August 15 Tage still.",
    fenster: 24,
  },
};

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
): Promise<{ geprueft: number; ueberfaellig: LaufAmpel[]; gewarnt: string[] }> {
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
  return { geprueft: ampeln.length, ueberfaellig, gewarnt };
}
