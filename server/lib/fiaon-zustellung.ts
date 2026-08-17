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
import { besterZustand, brevoKonfiguriert, ereignisseFuer, nachschauSammel, OHNE_SCHLUESSEL } from "./fiaon-brevo";
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

export type ZweigZustand = "bestaetigt" | "zweig_fehlt" | "pruefung_gestoert";

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
    /**
     * Nur diese Ereignisse prüfen. Damit ist die Einzelprüfung DERSELBE Code
     * mit einem Element — eine Logik, nicht zwei. Der Auftrag verlangt das
     * ausdrücklich, und der Grund ist bekannt: Zwei Fassungen derselben
     * Prüfung gehen auseinander, und beide Prüfstände bleiben grün.
     */
    nur?: string[];
    fortschritt?: (s: { schritt: string; versandt: number; gesamt: number }) => void;
  } = {},
): Promise<SammelErgebnis> {
  const start = Date.now();
  const alleEvents = await mailEvents();
  const events = opts.nur?.length
    ? alleEvents.filter((e) => opts.nur!.includes(e.type))
    : alleEvents;
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
      dauerSekunden: 0, klartext: k, testAdresse,
    };
  }

  // ── 1. ALLE SENDEN ───────────────────────────────────────────────────────
  // Gestaffelt: Make drosselt bei zu vielen Anfragen gleichzeitig, und ein
  // gedrosselter Versand sähe später aus wie ein fehlender Zweig.
  const versandFehler = new Map<string, string>();
  let versandt = 0;
  for (const e of events) {
    const v = await mailSenden({
      event: e.type, akteur, test: true, testAdresse,
      zusatz: { pruef_marke: `fiaon-zweigpruefung-${e.type}-${start}` },
    }).catch((err) => ({ ok: false, grund: err instanceof Error ? err.message : String(err) }));
    if (!v.ok) versandFehler.set(e.type, String((v as any).grund ?? "unbekannt"));
    versandt++;
    melde({ schritt: "senden", versandt, gesamt: events.length });
    if (staffel > 0) await new Promise((r) => setTimeout(r, staffel));
  }

  // ── 2. EINMAL WARTEN ─────────────────────────────────────────────────────
  melde({ schritt: "warten", versandt, gesamt: events.length });
  await new Promise((r) => setTimeout(r, warten));

  // ── 3. EINMAL FRAGEN ─────────────────────────────────────────────────────
  melde({ schritt: "nachschau", versandt, gesamt: events.length });
  const nachschau = await nachschauSammel(testAdresse, new Date(start - 120_000));

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
      await verifikationSpeichern(e.type, false, text);
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

    // Die Zuordnung: frische Ereignisse, deren Betreff den Ereignisnamen trägt.
    // Der Betreff ist das, was wir haben — Make gibt uns keine messageId zurück.
    const frisch = nachschau.ereignisse.filter((x) =>
      x.am && new Date(x.am).getTime() >= start - 120_000);
    const meine = frisch.filter((x) =>
      (x.betreff ?? "").toLowerCase().includes(e.type.toLowerCase())
      || (x.betreff ?? "").toLowerCase().includes(String(e.label ?? "").toLowerCase()));

    if (meine.length > 0) {
      bestaetigt++;
      const z = besterZustand(meine);
      const text = `Zweig bestätigt: Der Testversand ist bei Brevo angekommen (${z?.zustand ?? "angenommen"}).`;
      await verifikationSpeichern(e.type, true, text);
      zweige.push({ event: e.type, zustand: "bestaetigt", text, gesehenAm: z?.am ?? null, brevoZustand: z?.zustand ?? null });
      continue;
    }

    zweigFehlt++;
    const text = `Nicht bestätigt — die Testmail kam in ${Math.round(warten / 1000)} Sekunden nicht bei Brevo an. `
      + "Zwei mögliche Ursachen, beide gleich wahrscheinlich: (1) Im Make-Szenario fehlt der Zweig mit dem Filter "
      + `event_type = ${e.type}, oder er ist inaktiv. (2) Der Zweig existiert, aber das verknüpfte Brevo-Template `
      + "ist nicht aktiv oder nicht zugeordnet. Make hat die Anfrage angenommen, danach verliert sich die Spur.";
    await verifikationSpeichern(e.type, false, text);
    zweige.push({ event: e.type, zustand: "zweig_fehlt", text, gesehenAm: null, brevoZustand: null });
  }

  return {
    ok: nachschau.ok,
    zweige, bestaetigt, zweigFehlt, gestoert,
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
