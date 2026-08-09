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
import { besterZustand, brevoKonfiguriert, ereignisseFuer, OHNE_SCHLUESSEL } from "./fiaon-brevo";
import { mailEvent, verifikationSpeichern } from "./fiaon-mail-events";
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
  // fehlt" und schickte den Betreiber in die falsche Richtung, während in
  // Wahrheit die Brevo-Vorlage nicht aktiv war. Von hier aus sehen beide
  // Ursachen identisch aus, also werden beide genannt.
  const text = `Nicht bestätigt — die Testmail kam in ${Math.round(maxWarten / 60000)} Minuten nicht bei Brevo an. `
    + "Zwei mögliche Ursachen, beide gleich wahrscheinlich: (1) Im Make-Szenario fehlt der Zweig mit dem Filter "
    + `event_type = ${event}, oder er ist inaktiv. (2) Der Zweig existiert, aber das verknüpfte Brevo-Template `
    + "ist nicht aktiv oder nicht zugeordnet. Prüfe beides — Make hat die Anfrage angenommen, danach verliert sich die Spur.";
  await verifikationSpeichern(event, false, text);
  return { event, bestaetigt: false, text, gewartetSekunden: Math.round((Date.now() - start) / 1000) };
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
): Promise<{ geprueft: number; aktualisiert: number; grund?: string }> {
  if (!brevoKonfiguriert()) return { geprueft: 0, aktualisiert: 0, grund: OHNE_SCHLUESSEL };

  const zeilen = (await lauf`
    SELECT id, empfaenger, created_at, zustellung
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
  if (zeilen.length === 0) return { geprueft: 0, aktualisiert: 0 };

  // Nach Adresse bündeln: Eine Brevo-Abfrage je Adresse statt je Zeile.
  const jeAdresse = new Map<string, any[]>();
  for (const z of zeilen) {
    const k = String(z.empfaenger).toLowerCase();
    jeAdresse.set(k, [...(jeAdresse.get(k) || []), z]);
  }

  let aktualisiert = 0;
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
    }
  }
  if (aktualisiert) console.log(`[ZUSTELLUNG] ${aktualisiert} von ${zeilen.length} Zeilen aktualisiert`);
  return { geprueft: zeilen.length, aktualisiert };
}

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
