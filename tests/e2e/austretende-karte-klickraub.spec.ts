import { test, expect } from "@playwright/test";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * URSACHE: Die austretende Karte raubt den Klick
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Braucht KEINE Anmeldung — der Mechanismus ist reines CSS.
 *
 * Vorgeschichte: Ein Agent meldete, ein angeklickter Kunde werde als „Nicht
 * erreicht" weggebucht und verschwinde. Mein erster Verdacht war `translateZ`
 * an den Inhaltsebenen. Ein Reproduktionsversuch hat diesen Verdacht WIDERLEGT
 * — die Karte hat `overflow: hidden`, und das legt `preserve-3d` flach, womit
 * die Tiefenstaffelung ohnehin wirkungslos war. Dieser Test hält den Mechanismus
 * fest, der es wirklich ist.
 *
 * `AnimatePresence mode="popLayout"` setzt eine austretende Karte auf
 * `position: absolute`, damit die Nachbarn sofort weich nachrücken können. Genau
 * das ist die Falle: Für 280 ms schwebt die verschwindende Karte ÜBER der Liste
 * und nimmt weiter Klicks an, während darunter längst die nächste Karte
 * hochgerutscht ist.
 *
 * Der Agent dokumentiert also einen Kunden, klickt zügig den nächsten Namen an
 * — und trifft die noch verblassende Karte davor, dort inzwischen auf Höhe ihrer
 * Aktionsreihe. Der dritte Knopf darin heisst „Nicht erreicht".
 *
 * Behebung: Wer verschwindet, nimmt keine Klicks mehr an (`pointerEvents:
 * "none"` im exit-Zustand).
 */

/**
 * Baut die Situation nach: Karte 1 tritt aus (absolut, halbtransparent, liegt
 * oben), Karte 2 ist an ihre Stelle gerueckt.
 */
function seite(pointerEventsAus: boolean) {
  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; font: 14px system-ui; }
    .liste { position: relative; padding: 20px; display: flex;
             flex-direction: column; gap: 10px; }
    .karte { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
             padding: 20px; }
    /* Genau das macht popLayout mit einem austretenden Kind. */
    .austretend { position: absolute; top: 20px; left: 20px; right: 20px;
                  opacity: .4; ${pointerEventsAus ? "pointer-events: none;" : ""} }
    .name { display: block; width: 70%; text-align: left; font-size: 17px;
            font-weight: 600; border: 0; background: none; }
    .aktionen { margin-top: 16px; display: flex; gap: 8px; }
    .knopf { padding: 10px 14px; border: 1px solid #e2e8f0;
             border-radius: 10px; font-size: 12.5px; background: #fff; }
  </style></head><body>
    <div class="liste">
      <!-- Karte 1: gerade dokumentiert, verblasst noch -->
      <div class="karte austretend" data-austretend>
        <button class="name">Kunde A (verschwindet)</button>
        <div class="aktionen">
          <a class="knopf">Anrufen</a>
          <button class="knopf">Erreicht</button>
          <button class="knopf" data-falle>Nicht erreicht</button>
          <button class="knopf">Blockiert</button>
        </div>
      </div>
      <!-- Karte 2: schon hochgerueckt, der Agent zielt auf ihren Namen -->
      <div class="karte" data-ziel>
        <button class="name" data-fi-name>Kunde B (Ziel)</button>
        <div class="aktionen">
          <a class="knopf">Anrufen</a>
          <button class="knopf">Erreicht</button>
          <button class="knopf">Nicht erreicht</button>
          <button class="knopf">Blockiert</button>
        </div>
      </div>
    </div>
  </body></html>`;
}

/** Was liegt ueber der Mitte des Namens von Karte 2? */
async function ueberDemZiel(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const ziel = document.querySelector("[data-fi-name]")!;
    const r = ziel.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      text: (el?.textContent || "").trim().slice(0, 40),
      istZiel: !!el?.closest("[data-ziel]"),
      istFalle: !!el?.hasAttribute("data-falle"),
      inAustretender: !!el?.closest("[data-austretend]"),
    };
  });
}

test.describe("Austretende Karte und Klickflaechen", () => {
  test("VORHER: die verblassende Karte faengt den Klick ab", async ({ page }) => {
    await page.setContent(seite(false));
    const t = await ueberDemZiel(page);

    // Das ist der gemeldete Fehler. Schlaegt diese Erwartung fehl, ist die
    // Ursachenanalyse falsch — dann gehoert die Analyse korrigiert, nicht der
    // Test aufgeweicht.
    expect(
      t.inAustretender,
      `Erwartet: Ueber dem Namen von Karte B liegt die austretende Karte A. ` +
      `Gefunden: "${t.text}"`,
    ).toBe(true);

    // Bewusst NICHT festgeschrieben, welcher Knopf getroffen wird: Das haengt
    // an Scrollstand, Kartenhoehe und Umbruch der Aktionsreihe. Ein Test, der
    // „genau Nicht erreicht" fordert, wuerde eine Zufaelligkeit zementieren.
    // Entscheidend und schlimm genug ist: Der Klick landet irgendwo in einer
    // Karte, die der Agent gar nicht mehr vor sich hat — und dort liegen vier
    // Knoepfe, die Kunden wegbuchen.
    expect(t.istZiel, "Der Klick erreicht Karte B NICHT.").toBe(false);
  });

  test("NACHHER: wer verschwindet, nimmt keine Klicks mehr an", async ({ page }) => {
    await page.setContent(seite(true));
    const t = await ueberDemZiel(page);

    expect(
      t.istZiel,
      `Der Klick muss den Namen von Karte B treffen. Gefunden: "${t.text}"`,
    ).toBe(true);
    expect(t.inAustretender, "Die austretende Karte darf nicht mehr im Weg sein.").toBe(false);
  });
});
