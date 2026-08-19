// ═══════════════════════════════════════════════════════════════════════════
// DAS MIKROFON — GERÄTEWAHL, PEGEL, HÖRBARKEIT
//
// ── DER BEFUND (Videoauswertung des Anrufs bei Nikita, 19.08.2026) ─────────
// Auf dem Wählbild stand am Pegelbalken „sehr leise", der Balken war leer — und
// der Anruf ging trotzdem raus. Beim Kunden: „nimmt ab, keiner spricht."
//
// ── DER HAUPTVERDÄCHTIGE, UND ER HAT SICH BESTÄTIGT ───────────────────────
// Im ganzen Panel gab es (Stand 30.08.2026):
//
//   · kein `navigator.mediaDevices.enumerateDevices()`
//   · kein `device.audio.setInputDevice(...)`
//   · `getUserMedia({ audio: true })` — OHNE `deviceId`
//
// Das Twilio-SDK nimmt damit immer das Gerät, das der Browser als Standard
// führt. Ist das ein stummes Headset, ein Monitor-Mikrofon oder ein virtuelles
// Gerät, spricht der Agent in nichts hinein — und hat in der Anwendung KEINE
// Möglichkeit, das zu ändern. Der Pegelmesser vom 30.08. maß denselben
// Standard, war also ehrlich und trotzdem nutzlos: Er zeigte das Problem und
// bot keinen Ausweg.
//
// Diese Datei ist der Ausweg. Sie liegt bewusst NICHT in der Softphone-Datei:
// Die Gerätewahl wird an zwei Stellen gebraucht (Wählbild und Sprechprobe), und
// die Hörbarkeitsschwelle an drei (Balken, Sperre, Warnung im Gespräch). Drei
// Zahlen an drei Stellen gehen auseinander.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ab welchem Pegel gilt Sprache als hörbar?
 *
 * Der Wert bezieht sich auf die Skala aus `pegelMessen` (0–100). Er ist nicht
 * geraten: Ein völlig stummes Gerät liefert 0, das Grundrauschen eines
 * eingeschalteten Mikrofons in einem stillen Raum liegt bei 1 bis 2. Wer redet,
 * kommt auf 15 bis 60.
 *
 * 2 ist also die Grenze zwischen „das Gerät liefert nichts" und „das Gerät
 * liefert wenigstens Rauschen". Genau diese Unterscheidung braucht die Sperre —
 * nicht „ist es laut genug", sondern „kommt überhaupt etwas an".
 */
export const HOERBAR_AB = 2;

/** Unter diesem Wert ist etwas da, aber zu leise für ein Telefonat. */
export const LEISE_UNTER = 8;

/**
 * Wie lange muss es still sein, bevor der Anrufknopf sperrt?
 *
 * Drei Sekunden. Kürzer wäre eine Sperre, die beim Öffnen des Panels zuschnappt,
 * bevor der Mensch überhaupt etwas sagen konnte — und eine Sperre, die man nicht
 * versteht, wird als Fehler gemeldet, nicht als Hinweis gelesen.
 */
export const SPERRE_NACH_SEKUNDEN = 3;

/** Und im laufenden Gespräch: acht Sekunden. */
export const WARNUNG_NACH_SEKUNDEN = 8;

export interface Eingabegeraet {
  deviceId: string;
  label: string;
}

/**
 * Alle verfügbaren Eingabegeräte.
 *
 * ── WARUM DAS ERST NACH DER ERLAUBNIS FUNKTIONIERT ────────────────────────
 * Ohne erteilte Mikrofon-Erlaubnis liefert `enumerateDevices` die Geräte mit
 * LEEREM `label` — der Browser verrät die Namen nicht, solange er nicht muss.
 * Eine Auswahlliste mit vier Einträgen „" ist schlimmer als keine.
 *
 * Deshalb gibt diese Funktion in dem Fall eine leere Liste zurück, und der
 * Aufrufer fragt zuerst die Erlaubnis ab. Ein Ersatzname („Mikrofon 2") wäre
 * eine Erfindung: Der Mensch soll sein Gerät wiedererkennen, nicht raten.
 */
export async function eingabegeraeteHolen(): Promise<Eingabegeraet[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const alle = await navigator.mediaDevices.enumerateDevices();
    return alle
      .filter((g) => g.kind === "audioinput" && g.deviceId && g.label)
      // „default" und „communications" sind Alias-Einträge auf dasselbe Gerät.
      // Sie doppelt anzuzeigen verwirrt; der echte Eintrag steht ohnehin dabei.
      .filter((g) => g.deviceId !== "communications")
      .map((g) => ({ deviceId: g.deviceId, label: g.label }));
  } catch {
    return [];
  }
}

// ── DIE GESPEICHERTE WAHL ─────────────────────────────────────────────────
// Je Mitarbeiter, nicht je Browser-Profil: Zwei Menschen an einem Rechner
// (Schulung, Springer) haben verschiedene Headsets. Der Schlüssel trägt deshalb
// die Agentenkennung.
//
// `localStorage` und nicht der Server: Eine Gerätekennung gilt nur an DIESEM
// Rechner. Auf dem Server gespeichert würde sie am zweiten Arbeitsplatz auf ein
// Gerät zeigen, das es dort nicht gibt — und die Anwendung würde ein
// funktionierendes Standardgerät gegen ein nicht vorhandenes tauschen.
const schluessel = (agentId: number | null | undefined) =>
  `fiaon.mikrofon.${agentId ?? "unbekannt"}`;

export function gewaehltesGeraet(agentId: number | null | undefined): string | null {
  try {
    return localStorage.getItem(schluessel(agentId)) || null;
  } catch {
    return null;
  }
}

export function geraetSpeichern(agentId: number | null | undefined, deviceId: string | null): void {
  try {
    if (deviceId) localStorage.setItem(schluessel(agentId), deviceId);
    else localStorage.removeItem(schluessel(agentId));
  } catch { /* Privater Modus: dann gilt eben der Standard. */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SPRECHPROBE BEIM ERSTEN MAL — EINMALIG ERZWUNGEN
//
// ── WARUM ERZWUNGEN ───────────────────────────────────────────────────────
// Die Sperre bei fehlendem Pegel greift erst, wenn das Mikrofon NICHTS liefert.
// Es gibt einen zweiten Fall, den kein Pegel zeigt: Das Mikrofon liefert, aber
// der Ton geht in ein anderes Gerät als in die Telefonie — oder es ist so leise,
// dass am anderen Ende nichts ankommt. Beides sieht am Balken gesund aus.
//
// Nur das eigene Ohr entscheidet das. Deshalb muss die Probe EINMAL durchlaufen
// werden, bevor der erste Anruf möglich ist.
//
// ── UND WARUM NUR EINMAL ──────────────────────────────────────────────────
// Eine Pflicht bei jedem Öffnen wäre eine Klickstrecke, die man wegdrückt, ohne
// zuzuhören — dann prüft sie nichts mehr und nervt nur. Einmal je Mitarbeiter
// (und erneut bei einem Gerätewechsel, denn dann ist die alte Probe wertlos).
// ═══════════════════════════════════════════════════════════════════════════

const probeSchluessel = (agentId: number | null | undefined) =>
  `fiaon.sprechprobe.${agentId ?? "unbekannt"}`;

/**
 * Wurde die Sprechprobe für dieses Gerät schon bestanden?
 *
 * Gespeichert wird die GERÄTEKENNUNG, nicht ein Ja/Nein: Wer das Headset
 * wechselt, hat eine unbestätigte Kette — und genau dann ist die Probe wieder
 * nötig. Ein bloßes Ja würde nach dem Wechsel weiter gelten.
 */
export function probeBestanden(agentId: number | null | undefined, deviceId: string | null): boolean {
  try {
    const gemerkt = localStorage.getItem(probeSchluessel(agentId));
    if (!gemerkt) return false;
    return gemerkt === (deviceId || "standard");
  } catch {
    // Ohne Speicher keine Pflicht: Sonst wäre das Telefon im privaten Modus
    // dauerhaft gesperrt, und eine Sperre, die man nicht auflösen kann, ist
    // schlimmer als eine fehlende Prüfung.
    return true;
  }
}

export function probeMerken(agentId: number | null | undefined, deviceId: string | null): void {
  try {
    localStorage.setItem(probeSchluessel(agentId), deviceId || "standard");
  } catch { /* siehe oben */ }
}

/**
 * Die Auflagen für `getUserMedia` — mit dem gewählten Gerät, wenn es eines gibt.
 *
 * `exact` und nicht `ideal`: Bei `ideal` weicht der Browser stillschweigend auf
 * ein anderes Gerät aus, wenn das gewählte fehlt. Dann glaubt der Agent, er
 * spreche in sein Headset, und der Ton kommt aus dem Notebook-Mikrofon — genau
 * die Sorte Lüge, um die es hier geht. Mit `exact` gibt es stattdessen einen
 * Fehler, den man anzeigen kann.
 */
export function tonAuflagen(deviceId: string | null): MediaStreamConstraints {
  const grund: MediaTrackConstraints = {
    // Diese drei sind bei Telefonie richtig und stehen deshalb an EINER Stelle:
    // Echoauslöschung, Rauschunterdrückung, Pegelanpassung.
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  return { audio: deviceId ? { ...grund, deviceId: { exact: deviceId } } : grund };
}

/**
 * Der Effektivwert (RMS) eines Zeitfensters, auf 0–100 gedehnt.
 *
 * Effektivwert und nicht Spitzenwert: Ein Spitzenwert schlägt bei jedem
 * Tastenklick aus und zeigt damit „liefert", wo nur die Tastatur klappert.
 */
export function pegelAusZeitdaten(daten: Uint8Array): number {
  let summe = 0;
  for (let i = 0; i < daten.length; i++) {
    const a = (daten[i] - 128) / 128;
    summe += a * a;
  }
  const rms = Math.sqrt(summe / daten.length);
  // Roh liegt Sprache bei 0,02–0,2. Ohne Dehnung wäre der Balken nicht zu sehen.
  return Math.min(100, Math.round(rms * 400));
}

/** Der Klartext zu einem Pegel — an einer Stelle, für Balken und Sperre. */
export function pegelText(pegel: number | null): string {
  if (pegel == null) return "wird gemessen …";
  if (pegel < HOERBAR_AB) return "kein Signal — sag einmal etwas";
  if (pegel < LEISE_UNTER) return "sehr leise";
  return "liefert";
}
