// ═══════════════════════════════════════════════════════════════════════════
// GEDANKE DES TAGES — 90 Sätze, die ein erwachsener Mensch lesen kann
//
// Der Anspruch ist niedriger als er klingt und trotzdem selten erfüllt: KEINE
// Kalenderweisheiten. Kein „Der Weg ist das Ziel", kein „Wer will, findet
// Wege", kein Zitat, das man auf eine Tasse drucken kann.
//
// Die Regel beim Schreiben war: Jeder Satz muss auf den ARBEITSTAG hier
// zutreffen — auf Telefonate, auf Absagen, auf Zahlen, auf Kollegen. Wenn ein
// Satz genauso gut in einem Fitnessstudio hängen könnte, ist er rausgeflogen.
//
// Neunzig Stück, damit sich in einem Vierteljahr keiner wiederholt. Die
// Reihenfolge ist bewusst durchmischt (nicht thematisch sortiert), sonst käme
// drei Wochen lang dasselbe Thema.
// ═══════════════════════════════════════════════════════════════════════════

export interface Gedanke {
  /** Stabile Nummer — sie steht im Post und verhindert Wiederholungen. */
  nr: number;
  text: string;
}

export const GEDANKEN: Gedanke[] = [
  { nr: 1, text: "Der zweite Anruf ist nicht der erste noch einmal. Er ist ein anderer Anruf mit mehr Wissen." },
  { nr: 2, text: "Ein „Nein“ am Telefon ist eine Information, kein Urteil über dich." },
  { nr: 3, text: "Wer sich vorbereitet, telefoniert kürzer. Nicht schneller — kürzer." },
  { nr: 4, text: "Die unangenehmste Aufgabe des Tages kostet vormittags zehn Minuten und abends eine Stunde." },
  { nr: 5, text: "Niemand erinnert sich an dein bestes Gespräch. Alle erinnern sich, ob du zurückgerufen hast." },
  { nr: 6, text: "Eine Zahl ohne Zeitraum ist eine Behauptung." },
  { nr: 7, text: "Wenn du dir eine Notiz sparst, sparst du sie deinem Kollegen weg." },
  { nr: 8, text: "Der Kunde hört nicht, was du sagst. Er hört, was er versteht." },
  { nr: 9, text: "Du kannst nicht kontrollieren, wer abhebt. Du kannst kontrollieren, wie oft du wählst." },
  { nr: 10, text: "Fünf gute Gespräche schlagen fünfzig abgehakte." },
  { nr: 11, text: "Wer alles gleich wichtig nimmt, hat keine Prioritäten, sondern eine Liste." },
  { nr: 12, text: "Ein Versprechen ohne Datum ist kein Versprechen." },
  { nr: 13, text: "Das Gespräch beginnt nicht, wenn du sprichst. Es beginnt, wenn du zuhörst." },
  { nr: 14, text: "Unsicherheit auszusprechen kostet dich zwei Sekunden Stolz und spart dir zwei Wochen Irrtum." },
  { nr: 15, text: "Wer nachfragt, wirkt nicht unwissend, sondern aufmerksam." },
  { nr: 16, text: "Es gibt keine schwierigen Kunden. Es gibt Menschen an einem schwierigen Tag." },
  { nr: 17, text: "Was du heute sauber dokumentierst, musst du in drei Wochen nicht rekonstruieren." },
  { nr: 18, text: "Ein voller Kalender ist kein Beweis für einen produktiven Tag." },
  { nr: 19, text: "Der Unterschied zwischen Beharrlichkeit und Belästigung ist ein vereinbarter Termin." },
  { nr: 20, text: "Wenn du dich beim Erklären verhaspelst, hast du es selbst noch nicht verstanden." },
  { nr: 21, text: "Ehrlichkeit ist die einzige Antwort, die man sich nicht merken muss." },
  { nr: 22, text: "Ein Fehler, den du meldest, ist ein Vorfall. Ein Fehler, den du versteckst, ist ein Problem." },
  { nr: 23, text: "Zuständigkeit heißt nicht, alles zu können. Sie heißt, dass es nicht liegen bleibt." },
  { nr: 24, text: "Wer beim Reden schon die Antwort plant, hört nicht zu." },
  { nr: 25, text: "Die letzten zehn Prozent einer Aufgabe entscheiden, ob die ersten neunzig zählen." },
  { nr: 26, text: "Ein Kunde, der Fragen stellt, hat Interesse. Einer, der schweigt, hat abgeschlossen." },
  { nr: 27, text: "Du wirst nicht daran gemessen, wie beschäftigt du warst." },
  { nr: 28, text: "Schnell antworten ist eine Form von Respekt." },
  { nr: 29, text: "Wenn drei Leute dieselbe Frage stellen, ist nicht die Frage das Problem." },
  { nr: 30, text: "Ein System, dem man nicht traut, wird umgangen — und dann stimmt gar nichts mehr." },
  { nr: 31, text: "Erfahrung ist die Fähigkeit, denselben Fehler wiederzuerkennen, bevor er passiert." },
  { nr: 32, text: "Gute Arbeit erkennt man daran, dass hinterher niemand nacharbeiten muss." },
  { nr: 33, text: "Wer ständig improvisiert, hat kein Talent, sondern keine Vorbereitung." },
  { nr: 34, text: "Am Telefon hört man dein Gesicht." },
  { nr: 35, text: "Der beste Zeitpunkt für schlechte Nachrichten ist sofort." },
  { nr: 36, text: "Eine Entschuldigung ohne Änderung ist eine Ankündigung der Wiederholung." },
  { nr: 37, text: "Was du nicht aufschreibst, hast du nicht entschieden." },
  { nr: 38, text: "Höflichkeit kostet nichts und ist trotzdem selten." },
  { nr: 39, text: "Wenn du eine Abkürzung findest, prüfe, wer sie bezahlt." },
  { nr: 40, text: "Der Kunde vergleicht dich nicht mit dem Wettbewerb, sondern mit seiner letzten guten Erfahrung." },
  { nr: 41, text: "Konzentration ist kein Charakterzug, sondern eine Entscheidung über das Handy." },
  { nr: 42, text: "Wer nur auf Zahlen schaut, verpasst den Grund für die Zahlen." },
  { nr: 43, text: "Zuhören ist keine Pause im Gespräch." },
  { nr: 44, text: "Ein klarer Satz ist schwerer zu schreiben als drei unklare." },
  { nr: 45, text: "Die meisten Missverständnisse entstehen aus Wörtern, die beide zu kennen glauben." },
  { nr: 46, text: "Wenn du glaubst, es sei offensichtlich, sag es trotzdem." },
  { nr: 47, text: "Verlässlichkeit schlägt Brillanz — jeden einzelnen Tag." },
  { nr: 48, text: "Wer nie unterbrochen wird, arbeitet vermutlich an etwas Unwichtigem." },
  { nr: 49, text: "Ein Kunde, den du an einen Kollegen abgibst, ist kein verlorener Kunde." },
  { nr: 50, text: "Die Wahrheit ist selten bequem und immer billiger." },
  { nr: 51, text: "Wenn zwei Wege gleich gut aussehen, nimm den, den du erklären kannst." },
  { nr: 52, text: "Nichts kostet mehr Zeit als eine Aufgabe, über die man dreimal nachdenkt, ohne sie anzufangen." },
  { nr: 53, text: "Struktur ist nicht das Gegenteil von Freiheit, sondern ihre Voraussetzung." },
  { nr: 54, text: "Wer keine Fragen stellt, bekommt keine Einwände zu hören — nur Absagen." },
  { nr: 55, text: "Am Anfang eines Gesprächs entscheidet die Stimme, am Ende der Inhalt." },
  { nr: 56, text: "Eine Liste, die nie kürzer wird, ist keine Liste, sondern ein Archiv." },
  { nr: 57, text: "Wer sich selbst nicht korrigiert, wird korrigiert." },
  { nr: 58, text: "Ein Termin, der verschoben wird, ist besser als einer, der platzt." },
  { nr: 59, text: "Man verliert Kunden nicht durch Fehler, sondern durch Schweigen danach." },
  { nr: 60, text: "Routine ist die Belohnung für Disziplin, nicht ihr Ersatz." },
  { nr: 61, text: "Wenn dir eine Zahl seltsam vorkommt, ist sie meistens falsch." },
  { nr: 62, text: "Wer alles selbst macht, wächst genau bis zu seiner eigenen Kapazität." },
  { nr: 63, text: "Freundlich bleiben ist keine Schwäche, sondern Selbstbeherrschung." },
  { nr: 64, text: "Ein Prozess, den man erklären muss, ist zu kompliziert." },
  { nr: 65, text: "Der schwierigste Teil des Zuhörens ist, nicht sofort zu widersprechen." },
  { nr: 66, text: "Gute Notizen sind ein Geschenk an dein zukünftiges Ich." },
  { nr: 67, text: "Man erkennt ein starkes Team daran, wie es mit dem schwächsten Tag umgeht." },
  { nr: 68, text: "Wenn du keine Zeit hast, es richtig zu machen, hast du auch keine, es zweimal zu machen." },
  { nr: 69, text: "Der Preis ist selten das Problem. Meistens ist es die Unsicherheit." },
  { nr: 70, text: "Wer Erwartungen nicht ausspricht, wird sie enttäuscht sehen." },
  { nr: 71, text: "Ein Rückruf am nächsten Morgen ist mehr wert als drei am selben Nachmittag." },
  { nr: 72, text: "Der Ton entscheidet, ob dein Argument überhaupt ankommt." },
  { nr: 73, text: "Wer ständig Ausnahmen macht, hat keine Regel." },
  { nr: 74, text: "Man kann Vertrauen nicht schneller aufbauen, aber sehr schnell verlieren." },
  { nr: 75, text: "Eine gute Frage bringt dich weiter als drei gute Antworten." },
  { nr: 76, text: "Nicht jeder Widerspruch ist ein Angriff." },
  { nr: 77, text: "Wenn du etwas zum dritten Mal von Hand machst, baue es." },
  { nr: 78, text: "Klarheit ist eine Form von Freundlichkeit." },
  { nr: 79, text: "Ein halbes Versprechen ist ein ganzes Problem." },
  { nr: 80, text: "Wer sich Ziele nur vornimmt, hat sie nicht geplant." },
  { nr: 81, text: "Man wächst an Aufgaben, die man sich nicht ausgesucht hat." },
  { nr: 82, text: "Es ist keine Schande, etwas nicht zu wissen — nur, so zu tun als ob." },
  { nr: 83, text: "Wenn du müde bist, telefoniere kürzer, nicht schlechter." },
  { nr: 84, text: "Der Unterschied zwischen Ordnung und Chaos sind fünf Minuten am Ende des Tages." },
  { nr: 85, text: "Wer den Kunden ausreden lässt, spart sich die Hälfte der Einwände." },
  { nr: 86, text: "Man sollte nie eine Entscheidung treffen, die man am Telefon nicht begründen könnte." },
  { nr: 87, text: "Kollegen sind keine Konkurrenz um dieselbe Provision, sondern um dieselbe Uhrzeit." },
  { nr: 88, text: "Was gemessen wird, verbessert sich. Was nur besprochen wird, bleibt." },
  { nr: 89, text: "Erfolg ist meistens die Summe von Dingen, die niemand gesehen hat." },
  { nr: 90, text: "Am Ende zählt nicht, wie viele Menschen du erreicht hast, sondern wie viele dir noch einmal zuhören würden." },
];

/**
 * Der Gedanke für einen bestimmten Tag.
 *
 * Rotiert über die Tage seit einem festen Startpunkt. Bei 90 Sätzen bedeutet
 * das: Wiederholung frühestens nach 90 Tagen — und zwar garantiert, nicht
 * zufällig. Ein Zufallsgenerator hätte nach dem Geburtstagsparadox schon in
 * der dritten Woche eine Wiederholung produziert.
 */
export function gedankeFuer(datumISO: string): Gedanke {
  const tage = Math.floor(Date.parse(`${datumISO}T00:00:00Z`) / 86_400_000);
  return GEDANKEN[((tage % GEDANKEN.length) + GEDANKEN.length) % GEDANKEN.length];
}
