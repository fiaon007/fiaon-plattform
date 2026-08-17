// ═══════════════════════════════════════════════════════════════════════════
// ZUSTELL-WAHRHEIT — messen statt behaupten
//
// Zwei Wege, dasselbe Ziel:
//
//   ZWEIG PRÜFEN   Ein Testversand geht über Make raus. Danach sehen wir bis
//                  zu drei Minuten lang bei Brevo nach, ob er dort ankam.
//                  Kam er an, ist der Zweig BESTÄTIGT — und zwar mit Datum,
//                  nicht mit einer Vermutung.
//
//   ABGLEICH       Stündlich werden die letzten Protokollzeilen gegen Brevos
//                  Ereignisse gehalten. Aus „versandt" (= Make hat angenommen)
//                  wird „zugestellt", „geöffnet" oder „gebounct".
//
// WARUM DREI MINUTEN
// Make nimmt die Anfrage sofort an, führt das Szenario aber asynchron aus;
// Brevo protokolliert wiederum mit Verzögerung. Unter einer Minute sind
// falsche Negative die Regel. Über drei Minuten wartet niemand vor dem
// Bildschirm. Ein Misserfolg löscht deshalb auch keine frühere Bestätigung —
// er steht nur als Ergebnis daneben.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { besterZustand, brevoKonfiguriert, ereignisseFuer, nachschauSammel, OHNE_SCHLUESSEL,
         type ZustellEreignis } from "./fiaon-brevo";
import type { BrevoKlartext } from "./fiaon-brevo-fehler";
import { mailEvent, mailEvents, verifikationSpeichern } from "./fiaon-mail-events";
import { mailSenden } from "./fiaon-mail-senden";
import type { Rolle } from "./fiaon-mail-events";

type Lauf = typeof sqlPool;

/** So lange wird nach dem Testversand bei Brevo nachgesehen. */
export const WARTEN_MS = 3 * 60_000;
/** In diesem Takt. */
const TAKT_MS = 15_000;

export interface PruefErgebnis {
  event: string;
  bestaetigt: boolean;
  text: string;
  gewartetSekunden: number;
}

/**
 * Einen Zweig prüfen: Testversand raus, dann bei Brevo nachsehen.
 *
 * @param sofortAntworten Nicht warten, nur senden und den Abgleich dem
 *                        stündlichen Lauf überlassen (für „alle prüfen").
 */
export async function zweigPruefen(
  event: string,
  testAdresse: string,
  akteur: { name: string; agentId: number | null; rolle: Rolle },
  opts: { maxWartenMs?: number } = {},
): Promise<PruefErgebnis> {
  const def = await mailEvent(event);
  if (!def) return { event, bestaetigt: false, text: `Unbekanntes Ereignis „${event}“.`, gewartetSekunden: 0 };

  if (!brevoKonfiguriert()) {
    return { event, bestaetigt: false, text: OHNE_SCHLUESSEL, gewartetSekunden: 0 };
  }

  const start = Date.now();
  const versand = await mailSenden({
    event, akteur, test: true, testAdresse,
    zusatz: { pruef_marke: `fiaon-zweigpruefung-${event}-${start}` },
  });
  if (!versand.ok) {
    const text = `Der Testversand ging schon an Make nicht raus: ${versand.grund}. `
      + "Damit lässt sich über den Zweig nichts sagen — erst muss der Webhook erreichbar sein.";
    await verifikationSpeichern(event, false, text);
    return { event, bestaetigt: false, text, gewartetSekunden: 0 };
  }

  // Ab jetzt bei Brevo nachsehen. Nur Ereignisse, die NACH dem Versand
  // entstanden sind — sonst bestätigt eine Mail von letzter Woche den Zweig.
  const seit = new Date(start - 60_000);
  const maxWarten = opts.maxWartenMs ?? WARTEN_MS;
  while (Date.now() - start < maxWarten) {
    await new Promise((r) => setTimeout(r, TAKT_MS));
    const r = await ereignisseFuer(testAdresse, seit);
    if (!r.ok) {
      const text = `Bei Brevo konnte nicht nachgesehen werden: ${r.grund}`;
      await verifikationSpeichern(event, false, text);
      return { event, bestaetigt: false, text, gewartetSekunden: Math.round((Date.now() - start) / 1000) };
    }
    const frisch = r.ereignisse.filter((e) => e.am && new Date(e.am).getTime() >= start - 60_000);
    if (frisch.length > 0) {
      const zustand = besterZustand(frisch);
      const text = `Zweig bestätigt: Der Testversand ist bei Brevo angekommen (${zustand?.zustand ?? "angenommen"}).`;
      await verifikationSpeichern(event, true, text);
      return { event, bestaetigt: true, text, gewartetSekunden: Math.round((Date.now() - start) / 1000) };
    }
  }

  // ── BEIDE URSACHEN NENNEN ────────────────────────────────────────────────
  // Genau hier lag der alte Fehler: Die Plattform behauptete „Make-Zweig
  // fehlt" und schickte den Vorgesetzten in die falsche Richtung, während in
  // Wahrheit die Brevo-Vorlage nicht aktiv war. Von hier aus sehen beide
  // Ursachen identisch aus, also werden beide genannt.
  const text = `Nicht bestätigt — die Testmail kam in ${Math.round(maxWarten / 60000)} Minuten nicht bei Brevo an. `
    + "Zwei mögliche Ursachen, beide gleich wahrscheinlich: (1) Im Make-Szenario fehlt der Zweig mit dem Filter "
    + `event_type = ${event}, oder er ist inaktiv. (2) Der Zweig existiert, aber das verknüpfte Brevo-Template `
    + "ist nicht aktiv oder nicht zugeordnet. Prüfe beides — Make hat die Anfrage angenommen, danach verliert sich die Spur.";
  await verifikationSpeichern(event, false, text);
  return { event, bestaetigt: false, text, gewartetSekunden: Math.round((Date.now() - start) / 1000) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER SAMMELLAUF: ALLE ZWEIGE IN EINEM DURCHGANG
//
// ── WARUM (21.08.2026) ─────────────────────────────────────────────────────
// Der alte Lauf ging 35-mal durch `zweigPruefen`: senden → warten → fragen.
// Bei 4 Sekunden Mindestwartezeit je Zweig sind das über zwei Minuten, in denen
// die Seite aussieht, als hinge sie. Und 35 einzelne Brevo-Abrufe reizen die
// Bremse (HTTP 429).
//
// Brevo liefert alle Ereignisse einer Adresse in EINER Antwort. Also:
//   1. alle 35 Probemails abschicken (gestaffelt gegen Make-Drosselung)
//   2. einmal warten
//   3. EINMAL bei Brevo fragen
//   4. zuordnen
//
// Ein Abruf statt 35, eine Wartezeit statt 35.
//
// ── DIE DREI ZUSTÄNDE ──────────────────────────────────────────────────────
// Der eigentliche Grund für diesen Umbau ist nicht die Zeit, sondern die
// WAHRHEIT. Vorher gab es zwei Zustände: bestätigt oder „nicht bestätigt" — und
// die Kachel zählte alles Zweite als „ohne Zweig".
//
// Als die Nachschau selbst kaputt war (endDate in der Zukunft → HTTP 400),
// meldete die Seite „35 ohne Zweig", während die Mails ankamen. Eine falsche
// Anschuldigung gegen den Betreiber, der die Zweige längst gebaut hatte.
//
//   "bestaetigt"  Die Mail ist nachweislich bei Brevo angekommen.
//   "zweig_fehlt" Sie kam NICHT an, obwohl die Abfrage funktionierte. Jetzt
//                 lohnt der Blick in Make oder auf das Brevo-Template.
//   "pruefung_gestoert" WIR konnten nicht nachsehen. Über den Zweig ist damit
//                 NICHTS gesagt — dieser Zustand zählt NICHT als „ohne Zweig".
// ═══════════════════════════════════════════════════════════════════════════

export type ZweigZustand =
  | "bestaetigt"
  | "zweig_fehlt"
  | "pruefung_gestoert"
  /**
   * Absichtlich abgeschafft — wird nie mehr gefeuert, der Zweig darf in Make
   * gelöscht werden. Zählt in KEINE Summe: Eine Ampel, die einen bewusst
   * gelöschten Zweig anmahnt, wird ignoriert, und mit ihr die echten Funde.
   */
  | "veraltet";

/**
 * Gehört dieses Brevo-Ereignis zu diesem Registry-Eintrag?
 *
 * Über den BETREFF, weil Make uns keine messageId zurückgibt. Der Betreff einer
 * Probemail trägt den Ereignisnamen oder die Beschriftung — je nachdem, welche
 * Brevo-Vorlage dranhängt. Beide werden geprüft.
 */
function passtZuEreignis(x: ZustellEreignis, e: { type: string; label?: string }): boolean {
  const betreff = (x.betreff ?? "").toLowerCase();
  if (!betreff) return false;
  if (betreff.includes(e.type.toLowerCase())) return true;
  const label = String(e.label ?? "").toLowerCase();
  // Kurze Beschriftungen wie „Willkommen" passen zu vielen Betreffs — erst ab
  // vier Zeichen zählt der Vergleich, sonst bestätigt ein Zufall den Zweig.
  return label.length >= 4 && betreff.includes(label);
}

export interface SammelZweig {
  event: string;
  zustand: ZweigZustand;
  text: string;
  /** Wann bei Brevo gesehen (nur bei „bestaetigt"). */
  gesehenAm: string | null;
  brevoZustand: string | null;
}

export interface SammelErgebnis {
  ok: boolean;
  zweige: SammelZweig[];
  bestaetigt: number;
  zweigFehlt: number;
  gestoert: number;
  /** Absichtlich abgeschaffte Ereignisse — in keiner Summe enthalten. */
  veraltet: number;
  /** Sekunden, die der ganze Lauf gebraucht hat. */
  dauerSekunden: number;
  /** Steht nur bei einem Problem an der Prüfung selbst. */
  klartext?: BrevoKlartext;
  testAdresse: string;
}

/**
 * Alle Zweige in einem Durchgang prüfen.
 *
 * @param wartenMs Wie lange nach dem Versand gewartet wird, bevor gefragt wird.
 *                 Brevo braucht typisch 5–20 Sekunden, bis ein Ereignis in der
 *                 Statistik steht.
 * @param fortschritt Wird nach jedem Abschnitt gerufen, damit die Oberfläche
 *                 eine Leiste zeigen kann statt eines Wartekreises.
 */
export async function alleZweigePruefen(
  testAdresse: string,
  akteur: { name: string; agentId: number | null; rolle: Rolle },
  opts: {
    wartenMs?: number;
    staffelMs?: number;
    /** Wie lange insgesamt nachgefragt wird. Vorgabe 4 Minuten. */
    maxWartenMs?: number;
    /** Abstand zwischen zwei Nachfragen. Vorgabe 30 Sekunden. */
    taktMs?: number;
    /**
     * KEINE neuen Probemails schicken — nur nachsehen, was schon bei Brevo
     * liegt. Für den Fall, dass der Lauf zu früh aufgegeben hat: Die Mails von
     * vorhin sind längst angekommen, es fehlt nur der Abgleich.
     */
    nurNachsehen?: boolean;
    /** Ab wann gesucht wird. Nur mit `nurNachsehen` sinnvoll. */
    suchAb?: Date;
    /**
     * NICHT in fiaon_mail_events schreiben.
     *
     * ── WARUM ES DIESE OPTION GIBT (23.08.2026) ───────────────────────────
     * Der Prüfstand `pruef-geduld.ts` lässt den echten Sammellauf gegen eine
     * fetch-Attrappe laufen. Beim ersten Durchgang schrieb er dabei 34 echte
     * Verifikationen in die Produktionsdatenbank — darunter „Zweig bestätigt"
     * für Ereignisse, die nur die Attrappe bestätigt hatte.
     *
     * Eine falsche Bestätigung ist schlimmer als keine: Sie macht die Ampel
     * grün, ohne dass ein Zweig geprüft wurde. Gefunden hat es der Prüfstand
     * selbst — an seinen eigenen Laufzeiten (34 Schreibvorgänge kosten
     * Sekunden).
     *
     * AGENTS.md: Ein Prüfstand darf keine echten Vorgänge erzeugen.
     */
    nichtSpeichern?: boolean;
    /**
     * Nur diese Ereignisse prüfen. Damit ist die Einzelprüfung DERSELBE Code
     * mit einem Element — eine Logik, nicht zwei. Der Auftrag verlangt das
     * ausdrücklich, und der Grund ist bekannt: Zwei Fassungen derselben
     * Prüfung gehen auseinander, und beide Prüfstände bleiben grün.
     */
    nur?: string[];
    fortschritt?: (s: {
      schritt: string; versandt: number; gesamt: number;
      bestaetigt?: number; naechsteFrageInMs?: number; runde?: number;
    }) => void;
  } = {},
): Promise<SammelErgebnis> {
  const start = Date.now();
  const alleEvents = await mailEvents();
  // ══════════════════════════════════════════════════════════════════════════
  // VERALTETE EREIGNISSE WERDEN NICHT GEPRÜFT UND NICHT GEZÄHLT
  //
  // ── WARUM (23.08.2026) ──────────────────────────────────────────────────
  // `followup_48h` ist als `deprecated` gekennzeichnet: GEMESSEN am 19.08.2026
  // null Versände, und es gibt keine Stelle im Quelltext, die es auslöst. Der
  // Zweig in Make kann gelöscht werden.
  //
  // Trotzdem lief es mit: Es bekam eine Probemail, kam nie bei Brevo an (weil
  // der Zweig zu Recht fehlt) und zählte als „Zweig fehlt". Eine Ampel, die
  // einen absichtlich gelöschten Zweig anmahnt, wird ignoriert — und mit ihr
  // die echten Funde daneben.
  //
  // Aus 35 werden damit 34 lebende Ereignisse. Das veraltete bekommt eine
  // eigene Zeile mit dem Hinweis, dass es weg darf.
  // ══════════════════════════════════════════════════════════════════════════
  const lebende = alleEvents.filter((e) => !e.deprecated);
  const veraltete = alleEvents.filter((e) => e.deprecated);
  const events = opts.nur?.length
    ? lebende.filter((e) => opts.nur!.includes(e.type))
    : lebende;
  const warten = opts.wartenMs ?? 25_000;
  const staffel = opts.staffelMs ?? 200;
  const melde = opts.fortschritt ?? (() => {});

  if (!brevoKonfiguriert()) {
    // Ohne Schlüssel ist JEDER Zweig „Prüfung gestört", nicht „Zweig fehlt".
    // Das ist der Kern des Auftrags: Über die Zweige ist nichts gesagt.
    const { brevoNichtEingerichtet } = await import("./fiaon-brevo-fehler");
    const k = brevoNichtEingerichtet();
    return {
      ok: false,
      zweige: events.map((e) => ({
        event: e.type, zustand: "pruefung_gestoert" as ZweigZustand,
        text: OHNE_SCHLUESSEL, gesehenAm: null, brevoZustand: null,
      })),
      bestaetigt: 0, zweigFehlt: 0, gestoert: events.length,
      veraltet: veraltete.length,
      dauerSekunden: 0, klartext: k, testAdresse,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ALLE SENDEN — ODER EBEN NICHT
  //
  // ── „NUR NACHSEHEN" (23.08.2026) ────────────────────────────────────────
  // Der Lauf von gestern gab nach 25 Sekunden auf und meldete 34 fehlende
  // Zweige. Die Mails lagen aber längst bei Brevo — es fehlte nur der Abgleich.
  //
  // Für genau diesen Fall gibt es `nurNachsehen`: Es fragt Brevo über das
  // Zeitfenster des LETZTEN Versands erneut ab, OHNE neue Probemails zu
  // schicken. 35 unnötige Mails an die Testadresse sind kein Kavaliersdelikt —
  // sie kosten Zustellreputation und verwirren den Empfänger.
  // ══════════════════════════════════════════════════════════════════════════
  const versandFehler = new Map<string, string>();
  let versandt = 0;
  for (const e of opts.nurNachsehen ? [] : events) {
    const v = await mailSenden({
      event: e.type, akteur, test: true, testAdresse,
      zusatz: { pruef_marke: `fiaon-zweigpruefung-${e.type}-${start}` },
    }).catch((err) => ({ ok: false, grund: err instanceof Error ? err.message : String(err) }));
    if (!v.ok) versandFehler.set(e.type, String((v as any).grund ?? "unbekannt"));
    versandt++;
    melde({ schritt: "senden", versandt, gesamt: events.length });
    if (staffel > 0) await new Promise((r) => setTimeout(r, staffel));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. + 3. GEDULD: MEHRMALS NACHFRAGEN, NICHT EINMAL
  //
  // ── DER FEHLER VON GESTERN (22.08.2026) ─────────────────────────────────
  // Hier stand: einmal 25 Sekunden warten, einmal fragen, fertig. Der Lauf
  // meldete daraufhin für 34 von 35 Ereignissen „die Testmail kam in 25
  // Sekunden nicht bei Brevo an" — während die Mails im Postfach des
  // Betreibers lagen und das Zustellprotokoll 10.446 Versände zählte.
  //
  // Brevos Events-API trägt Ereignisse mit 1–3 MINUTEN Verzug ein. Die auf
  // Tempo optimierte Nachschau fragte, bevor Brevo geschrieben hatte.
  //
  // Das ist derselbe Fehler wie vorgestern beim `endDate` in der Zukunft, nur
  // andersherum: Beide Male behauptete die Anzeige „Zweig fehlt", während in
  // Wahrheit UNSERE Abfrage nicht passte. Und beide Male traf es den
  // Betreiber, der seine Zweige längst gebaut hatte.
  //
  // ── DIE KORREKTUR ───────────────────────────────────────────────────────
  // Es wird gepollt: erste Abfrage nach 30 s, dann alle 30 s, bis maximal 4
  // Minuten. Ein einmal bestätigtes Ereignis BLEIBT bestätigt (die Menge wächst
  // nur), und die Leiste zählt live hoch. Erst nach Ablauf gilt ein Ereignis
  // als „Zweig fehlt".
  //
  // Tempo ist damit nicht verloren: Sind alle Zweige in Ordnung, endet der Lauf
  // beim ersten oder zweiten Durchgang — die vollen 4 Minuten braucht nur, wer
  // wirklich einen fehlenden Zweig hat.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // DAS WARTEFENSTER BEGINNT NACH DEM VERSAND, NICHT BEIM START
  //
  // ── GEFUNDEN VOM PRÜFSTAND (23.08.2026) ─────────────────────────────────
  // Erster Entwurf: `while (Date.now() - start < bisMs)`. `start` liegt VOR dem
  // Versand — die 34 gestaffelten Mails verbrauchen also einen Teil des
  // Fensters, bevor die erste Nachfrage überhaupt läuft.
  //
  // In Produktion sind das etwa 7 von 240 Sekunden, also verkraftbar. Im
  // Prüfstand mit verkürzten Zeiten war das Fenster VOLLSTÄNDIG aufgebraucht:
  // 0 Abfragen, 34-mal „Prüfung gestört". Der Prüfstand hat einen echten, wenn
  // auch kleinen Fehler gefunden — genau dafür ist er da.
  //
  // Fachlich ist es ohnehin richtig so: „Vier Minuten auf Brevo warten" heißt
  // vier Minuten NACH dem letzten Versand. Vorher gibt es nichts, worauf man
  // warten könnte.
  // ══════════════════════════════════════════════════════════════════════════
  const wartenAb = Date.now();

  const bestaetigteEreignisse = new Map<string, ZustellEreignis[]>();
  let nachschau: Awaited<ReturnType<typeof nachschauSammel>> = {
    ok: false, ereignisse: [], grund: "noch nicht gefragt",
  };
  const bisMs = opts.maxWartenMs ?? 240_000;   // 4 Minuten
  const taktMs = opts.taktMs ?? 30_000;
  // Bei „nur nachsehen" wird ab dem übergebenen Zeitpunkt gesucht (dem letzten
  // Versand), nicht ab jetzt — sonst sucht die Abfrage in einem Fenster, in dem
  // niemand etwas verschickt hat.
  const suchAb = opts.suchAb ?? new Date(start - 120_000);
  let runden = 0;

  const nochOffen = () => events.filter((e) =>
    !versandFehler.has(e.type) && !bestaetigteEreignisse.has(e.type));

  while (Date.now() - wartenAb < bisMs) {
    melde({
      schritt: runden === 0 ? "warten" : "nachfragen",
      versandt, gesamt: events.length,
      bestaetigt: bestaetigteEreignisse.size,
      naechsteFrageInMs: taktMs,
      runde: runden,
    });
    // Beim ersten Durchgang im Modus „nur nachsehen" NICHT warten: Die Mails
    // sind von vorhin, es gibt nichts, worauf man warten müsste.
    if (!(opts.nurNachsehen && runden === 0)) {
      await new Promise((r) => setTimeout(r, taktMs));
    }
    runden++;

    nachschau = await nachschauSammel(testAdresse, suchAb);
    if (!nachschau.ok) {
      // Die Abfrage selbst ist kaputt (z. B. HTTP 400). Weiterpollen wäre
      // sinnlos — es würde 4 Minuten lang derselbe Fehler.
      break;
    }

    // Zuordnen, was NEU dazugekommen ist. Bestätigtes bleibt bestätigt.
    const frisch = nachschau.ereignisse.filter((x) =>
      x.am && new Date(x.am).getTime() >= start - 120_000);
    for (const e of nochOffen()) {
      const meine = frisch.filter((x) => passtZuEreignis(x, e));
      if (meine.length > 0) bestaetigteEreignisse.set(e.type, meine);
    }

    melde({
      schritt: "nachfragen", versandt, gesamt: events.length,
      bestaetigt: bestaetigteEreignisse.size,
      naechsteFrageInMs: taktMs, runde: runden,
    });

    // Alle da? Dann ist Warten Verschwendung.
    if (nochOffen().length === 0) break;
    // Beim Nur-Nachsehen liegt der Versand in der Vergangenheit. Zwei
    // Durchgänge genügen; länger zu warten hilft nur, wenn gerade gesendet
    // wurde, und das war hier nicht der Fall.
    if (opts.nurNachsehen && runden >= 2) break;
  }

  const gefundeneGesamt = nachschau.ok ? nachschau.ereignisse.length : 0;

  // ── 4. ZUORDNEN ──────────────────────────────────────────────────────────
  const zweige: SammelZweig[] = [];
  let bestaetigt = 0;
  let zweigFehlt = 0;
  let gestoert = 0;

  for (const e of events) {
    // Ein Versandfehler ist weder das eine noch das andere: Make hat die Mail
    // nicht angenommen, also ist über den ZWEIG nichts gesagt.
    const vf = versandFehler.get(e.type);
    if (vf) {
      gestoert++;
      const text = `Der Testversand ging schon an Make nicht raus: ${vf}. `
        + "Über den Zweig ist damit nichts gesagt — erst muss der Webhook erreichbar sein.";
      if (!opts.nichtSpeichern) await verifikationSpeichern(e.type, false, text);
      zweige.push({ event: e.type, zustand: "pruefung_gestoert", text, gesehenAm: null, brevoZustand: null });
      continue;
    }

    // Konnte gar nicht nachgesehen werden? Dann ist JEDER Zweig „gestört".
    if (!nachschau.ok) {
      gestoert++;
      const text = nachschau.klartext?.titel ?? `Bei Brevo konnte nicht nachgesehen werden: ${nachschau.grund}`;
      // BEWUSST NICHT als „geprüft und gescheitert" speichern: Eine Prüfung,
      // die nicht stattfand, darf keinen Zweig als fehlend markieren.
      zweige.push({ event: e.type, zustand: "pruefung_gestoert", text, gesehenAm: null, brevoZustand: null });
      continue;
    }

    // Das Polling hat schon zugeordnet — hier wird nur ausgewertet.
    const meine = bestaetigteEreignisse.get(e.type) ?? [];

    if (meine.length > 0) {
      bestaetigt++;
      const z = besterZustand(meine);
      const text = `Zweig bestätigt: Der Testversand ist bei Brevo angekommen (${z?.zustand ?? "angenommen"}).`;
      if (!opts.nichtSpeichern) await verifikationSpeichern(e.type, true, text);
      zweige.push({ event: e.type, zustand: "bestaetigt", text, gesehenAm: z?.am ?? null, brevoZustand: z?.zustand ?? null });
      continue;
    }

    zweigFehlt++;
    // ── DIE DIAGNOSE STEHT DABEI ───────────────────────────────────────────
    // Der Auftrag verlangt sie ausdrücklich: gesuchte Adresse, Zeitfenster,
    // Anzahl der insgesamt gefundenen Brevo-Ereignisse. Ohne diese drei Zahlen
    // wird geraten — genau das ist zweimal passiert (endDate in der Zukunft,
    // und dann das zu kurze Wartefenster).
    //
    // Stehen dort 0 gefundene Ereignisse, liegt es an uns oder am Versand.
    // Stehen dort viele und keins passt, liegt es am Zweig oder am Betreff.
    const text = (opts.nurNachsehen
      ? `Nicht bestätigt — auch bei erneutem Nachsehen (${runden} Nachfragen) liegt bei Brevo `
        + "nichts vor. Es wurden keine neuen Probemails geschickt. "
      : `Nicht bestätigt — in ${Math.round((Date.now() - start) / 1000)} Sekunden `
        + `(${runden} Nachfragen) kam nichts bei Brevo an. `)
      + "Zwei mögliche Ursachen: (1) Im Make-Szenario fehlt der Zweig mit dem Filter "
      + `event_type = ${e.type}, oder er ist inaktiv. (2) Der Zweig existiert, aber die `
      + "verknüpfte Brevo-Vorlage ist nicht aktiv. Make hat die Anfrage angenommen, "
      + "danach verliert sich die Spur."
      + `\n\nDiagnose: gesucht wurde „${testAdresse}“ ab ${suchAb.toLocaleTimeString("de-DE")}; `
      + `Brevo lieferte ${gefundeneGesamt} Ereignisse für diese Adresse insgesamt`
      + (gefundeneGesamt === 0
        ? " — also NICHTS. Dann liegt es nicht am einzelnen Zweig, sondern am Versand oder an der Adresse."
        : `, davon passte keins zum Betreff dieses Ereignisses.`);
    if (!opts.nichtSpeichern) await verifikationSpeichern(e.type, false, text);
    zweige.push({ event: e.type, zustand: "zweig_fehlt", text, gesehenAm: null, brevoZustand: null });
  }

  // ── DIE VERALTETEN ALS EIGENE ZEILEN ─────────────────────────────────────
  // Sie zählen in KEINE der drei Summen: nicht bestätigt, nicht fehlend, nicht
  // gestört. Sie sind erledigt.
  for (const e of opts.nur?.length ? [] : veraltete) {
    zweige.push({
      event: e.type, zustand: "veraltet",
      text: "Veraltet — wird nie mehr gefeuert. Der Zweig kann in Make GELÖSCHT werden. "
        + "Dieses Ereignis wird nicht geprüft und zählt in keiner Summe mit.",
      gesehenAm: null, brevoZustand: null,
    });
  }

  return {
    ok: nachschau.ok,
    zweige, bestaetigt, zweigFehlt, gestoert,
    veraltet: veraltete.length,
    dauerSekunden: Math.round((Date.now() - start) / 1000),
    klartext: nachschau.klartext,
    testAdresse,
  };
}

/**
 * Der stündliche Abgleich: Was ist aus den Mails der letzten Tage geworden?
 *
 * Idempotent über `abgeglichen_am`. Zeilen, die schon einen Endzustand tragen
 * (zugestellt, gebounct), werden nicht erneut abgefragt — Brevos API ist
 * kontingentiert, und ein Zustand ändert sich nach der Zustellung höchstens
 * noch zu „geöffnet".
 */
export async function zustellungAbgleichen(
  opts: { maxZeilen?: number } = {}, lauf: Lauf = sqlPool,
): Promise<{ geprueft: number; aktualisiert: number; grund?: string; zweigeBestaetigt?: string[] }> {
  if (!brevoKonfiguriert()) return { geprueft: 0, aktualisiert: 0, grund: OHNE_SCHLUESSEL };

  const zeilen = (await lauf`
    SELECT id, event, empfaenger, created_at, zustellung
    FROM fiaon_mail_log
    WHERE status = 'versandt'
      AND empfaenger IS NOT NULL
      AND created_at > NOW() - INTERVAL '7 days'
      -- Endzustände nicht erneut abfragen; „angenommen" und Leerstand schon.
      AND COALESCE(zustellung, '') NOT IN ('gebounct', 'blockiert', 'spam', 'geklickt')
      AND (abgeglichen_am IS NULL OR abgeglichen_am < NOW() - INTERVAL '45 minutes')
    ORDER BY created_at DESC
    LIMIT ${opts.maxZeilen ?? 120}
  `) as any[];
  if (zeilen.length === 0) return { geprueft: 0, aktualisiert: 0, zweigeBestaetigt: [] };

  // Nach Adresse bündeln: Eine Brevo-Abfrage je Adresse statt je Zeile.
  const jeAdresse = new Map<string, any[]>();
  for (const z of zeilen) {
    const k = String(z.empfaenger).toLowerCase();
    jeAdresse.set(k, [...(jeAdresse.get(k) || []), z]);
  }

  let aktualisiert = 0;
  // Welche Zweige hat dieser Lauf bestätigt? Für das Protokoll — eine Zahl
  // ohne Namen sagt dem Betreiber nicht, ob seine Arbeit angekommen ist.
  const zweigeBestaetigt = new Set<string>();
  for (const [adresse, gruppe] of Array.from(jeAdresse.entries())) {
    const aelteste = gruppe.reduce((a, b) => (new Date(a.created_at) < new Date(b.created_at) ? a : b));
    const r = await ereignisseFuer(adresse, new Date(new Date(aelteste.created_at).getTime() - 3600_000));
    if (!r.ok) continue;

    for (const zeile of gruppe) {
      const gesendet = new Date(zeile.created_at).getTime();
      // Ereignisse im Fenster ab dem Versand. Ohne Fenster würde eine ältere
      // Mail an dieselbe Adresse den Zustand einer neueren überschreiben.
      const passend = r.ereignisse.filter((e) => {
        const t = e.am ? new Date(e.am).getTime() : 0;
        return t >= gesendet - 120_000 && t <= gesendet + 3 * 86_400_000;
      });
      const zustand = besterZustand(passend);
      await lauf`
        UPDATE fiaon_mail_log
        SET zustellung = ${zustand?.zustand ?? null},
            zustellung_am = ${zustand?.am ? new Date(zustand.am) : null},
            zustellung_grund = ${zustand?.grund ?? null},
            abgeglichen_am = NOW()
        WHERE id = ${zeile.id}
      `;
      if (zustand && zustand.zustand !== zeile.zustellung) aktualisiert++;

      // ══════════════════════════════════════════════════════════════════
      // DER ZWEIG PFLEGT SICH SELBST (19.08.2026)
      //
      // ── DER AUFTRAG ──────────────────────────────────────────────────
      // „Nach jedem erfolgreichen echten Versand wird der Zweig automatisch
      // als bestätigt markiert — nicht nur über den manuellen Prüfen-Knopf.
      // So pflegt sich die Ampel selbst, während der Betreiber die fehlenden
      // Zweige anlegt."
      //
      // ── WARUM DAS BESSER IST ALS DER KNOPF ───────────────────────────
      // „Alle Zweige prüfen" verschickt 35 Probemails an die Testadresse und
      // wartet je Zweig vier Sekunden — ein Lauf von rund zwei Minuten, den
      // jemand anstoßen muss. Der ECHTE Betrieb liefert dieselbe Auskunft
      // kostenlos: Wenn eine echte Kundenmail über diesen Zweig zugestellt
      // wurde, existiert der Zweig. Beweis erbracht, ohne eine einzige
      // zusätzliche Mail.
      //
      // ── WAS ALS BEWEIS GILT ──────────────────────────────────────────
      // Nur „zugestellt", „geöffnet" oder „geklickt". NICHT „angenommen":
      // Das heißt lediglich, dass Brevo die Mail entgegengenommen hat — sie
      // kann danach noch bouncen. Ein Zweig, der auf „angenommen" hin als
      // bestätigt gilt, wäre eine grüne Ampel für einen Weg, an dessen Ende
      // nichts ankommt.
      //
      // ── UND KEIN ÜBERSCHREIBEN NACH UNTEN ────────────────────────────
      // `verifikationSpeichern(..., true, ...)` löscht nichts. Eine
      // fehlgeschlagene Zustellung setzt hier gar nichts — sonst würde eine
      // einzelne Mail an ein volles Postfach einen funktionierenden Zweig
      // als kaputt melden.
      // ══════════════════════════════════════════════════════════════════
      if (zeile.event && zustand && ZUSTELLUNG_BEWEIST_ZWEIG.includes(zustand.zustand as any)) {
        try {
          const { verifikationSpeichern } = await import("./fiaon-mail-events");
          await verifikationSpeichern(
            String(zeile.event), true,
            `Im Betrieb bestätigt: eine echte Mail wurde am `
            + `${new Date(zustand.am ?? Date.now()).toLocaleString("de-DE")} ${zustand.zustand}.`,
            lauf,
          );
          zweigeBestaetigt.add(String(zeile.event));
        } catch (e) {
          // Ein Fehler in der Zweig-Pflege darf den Zustell-Abgleich nicht
          // anhalten: Der Zustand der Mail ist die wichtigere Auskunft.
          console.error("[ZUSTELLUNG] Zweig-Pflege:", e);
        }
      }
    }
  }
  if (aktualisiert) console.log(`[ZUSTELLUNG] ${aktualisiert} von ${zeilen.length} Zeilen aktualisiert`);
  if (zweigeBestaetigt.size > 0) {
    console.log(`[ZUSTELLUNG] Zweige im Betrieb bestätigt: ${Array.from(zweigeBestaetigt).join(", ")}`);
  }
  return {
    geprueft: zeilen.length, aktualisiert,
    zweigeBestaetigt: Array.from(zweigeBestaetigt),
  };
}

/**
 * Welche Zustellzustände BEWEISEN, dass ein Make-Zweig existiert?
 *
 * Bewusst als Liste und nicht als Bedingung im Code: Wer sie ändert, sieht
 * hier, dass „angenommen" fehlt — und die Begründung steht daneben. Eine
 * Bedingung mitten in einer Schleife hätte man erweitert, ohne nachzudenken.
 *
 * „angenommen" fehlt, weil es nur heißt: Brevo hat die Mail entgegengenommen.
 * Sie kann danach noch bouncen oder blockiert werden. Eine grüne Ampel dafür
 * wäre die falsche Auskunft.
 */
export const ZUSTELLUNG_BEWEIST_ZWEIG = ["zugestellt", "geoeffnet", "geklickt"] as const;

/** Klartext für die Oberfläche. */
export const ZUSTELL_TEXT: Record<string, string> = {
  angenommen: "angenommen",
  zugestellt: "zugestellt",
  geoeffnet: "geöffnet",
  geklickt: "geklickt",
  gebounct: "unzustellbar",
  blockiert: "blockiert",
  spam: "als Spam gemeldet",
  fehler: "Fehler",
};
