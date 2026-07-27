/**
 * Untergrenze für Datums-/Terminfelder in DEUTSCHER Zeit.
 *
 * `<input type="datetime-local">` erwartet Wandzeit ohne Zeitzone — genau in
 * der Zeitzone, in der der Benutzer denkt. Der Browser des Agenten steht auf
 * deutscher Zeit, der Server rechnet ohnehin in Europe/Berlin (fiaon-time.ts).
 * Wir erzeugen die Grenze deshalb explizit als Berlin-Wandzeit, damit ein
 * Agent im Ausland nicht plötzlich Termine in der eigenen Vergangenheit
 * setzen kann.
 *
 * Hintergrund: Ohne `min` liess sich ein Rückruf 15 Tage in der Vergangenheit
 * speichern (gemessen: am 27.07. gesetzt, Termin auf dem 12.07.). Ein solcher
 * Termin wird nie fällig und verschwindet lautlos aus der Wiedervorlage.
 *
 * @param mitUhrzeit true → "YYYY-MM-DDTHH:mm" (datetime-local), sonst "YYYY-MM-DD".
 */
export function jetztFuerEingabe(mitUhrzeit: boolean): string {
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
  // sv-SE liefert bereits "YYYY-MM-DD HH:mm" — nur das Trennzeichen anpassen.
  const [datum, uhrzeit] = teile.split(" ");
  return mitUhrzeit ? `${datum}T${uhrzeit}` : datum;
}
