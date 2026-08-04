import { test, expect } from "@playwright/test";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * URSACHE: `threshold: 0.15` macht hohe Abschnitte unsichtbar
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Braucht KEINE Anmeldung — der Fehler steckt allein in der Beobachter-Schwelle.
 *
 * Gemeldet wurde: Unter dem letzten Kunden von „Heute fällig" kommt „ganz lange
 * nichts, nur weiß", bis irgendwann die überfälligen Kunden auftauchen.
 *
 * `useImBild` blendet einen Abschnitt mit `opacity: 0` aus, bis der
 * IntersectionObserver auslöst. Der Abschnitt BELEGT dabei seinen vollen Platz
 * — er ist unsichtbar, nicht abwesend. Und die Schwelle 0.15 bedeutet nicht
 * „15 % des Bildschirms", sondern „15 % DER ELEMENTFLÄCHE müssen im Bild sein".
 *
 * Daraus folgen zwei Fehler, und der zweite ist der schwere:
 *
 *  1. Man muss 15 % der Abschnittshöhe blind durchscrollen, bevor er erscheint.
 *     Bei 30 Karten sind das über 1000 Pixel Weiß.
 *
 *  2. Ist ein Abschnitt höher als Bildschirmhöhe / 0.15, kann das Verhältnis
 *     0.15 NIE erreicht werden — mehr als die Bildschirmhöhe kann nicht
 *     gleichzeitig sichtbar sein. Der Abschnitt bleibt dann FÜR IMMER
 *     unsichtbar, egal wie weit man scrollt. Bei 900 px Bildschirmhöhe liegt
 *     die Grenze bei 6000 px, also etwa 30 Kundenkarten. Die Liste lädt bis zu
 *     300.
 *
 * Ein dekorativer Einblend-Effekt darf Inhalt nie dauerhaft verbergen. Genau
 * das prüfen diese Tests.
 */

const BILD = { width: 1280, height: 900 };

/**
 * Baut einen hohen Block, der wie `Abschnitt` per IntersectionObserver
 * eingeblendet wird, und meldet, ob er es je geschafft hat.
 */
function seite(hoehe: number, opts: { threshold: number; rootMargin?: string }) {
  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    .vorlauf { height: 1200px; background: #f8fafc; }
    .block { transition: opacity .4s; opacity: 0; background: #fff;
             border: 1px solid #e2e8f0; }
    .block.drin { opacity: 1; }
  </style></head><body>
    <div class="vorlauf">Vorlauf</div>
    <section id="block" class="block" style="height: ${hoehe}px">Abschnitt</section>
    <div class="vorlauf">Nachlauf</div>
    <script>
      window.__drin = false;
      var el = document.getElementById('block');
      var b = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { window.__drin = true; el.classList.add('drin'); b.disconnect(); }
      }, ${JSON.stringify(opts)});
      b.observe(el);
      // Groesstes je erreichtes Verhaeltnis mitschreiben — das belegt, dass die
      // Schwelle nicht knapp verpasst, sondern unerreichbar ist.
      window.__maxRatio = 0;
      var m = new IntersectionObserver(function (e) {
        window.__maxRatio = Math.max(window.__maxRatio, e[0].intersectionRatio);
      }, { threshold: Array.from({ length: 101 }, function (_, i) { return i / 100; }) });
      m.observe(el);
    </script>
  </body></html>`;
}

/** Scrollt den Abschnitt langsam durch und meldet, ob er je sichtbar wurde. */
async function durchscrollen(page: import("@playwright/test").Page, hoehe: number) {
  const gesamt = 1200 + hoehe + 1200;
  for (let y = 0; y <= gesamt; y += 300) {
    await page.evaluate((py) => window.scrollTo(0, py as number), y);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(200);
  return page.evaluate(() => ({
    drin: (window as any).__drin as boolean,
    maxRatio: (window as any).__maxRatio as number,
  }));
}

test.use({ viewport: BILD });

test.describe("Abschnitt darf nie dauerhaft unsichtbar bleiben", () => {
  // 900px Bild / 0.15 = 6000px Grenze. 9000px liegt klar darueber.
  const HOCH = 9000;

  test("VORHER: ein hoher Abschnitt wird mit threshold 0.15 NIE sichtbar", async ({ page }) => {
    await page.setContent(seite(HOCH, { threshold: 0.15 }));
    const r = await durchscrollen(page, HOCH);

    // Das ist der gemeldete Fehler in seiner schlimmsten Form.
    expect(
      r.drin,
      `Erwartet: Der ${HOCH}px hohe Abschnitt bleibt unsichtbar. ` +
      `Groesstes erreichtes Verhaeltnis: ${r.maxRatio.toFixed(3)}`,
    ).toBe(false);

    // Und zwar nicht knapp: Mehr als Bildhoehe/Elementhoehe ist unmoeglich.
    expect(r.maxRatio).toBeLessThan(0.15);
    expect(r.maxRatio).toBeLessThanOrEqual(BILD.height / HOCH + 0.01);
  });

  test("VORHER: auch ein mittelhoher Abschnitt erscheint viel zu spaet", async ({ page }) => {
    // 4000px liegt unter der Grenze, erscheint also — aber erst nach
    // 0.15 * 4000 = 600px blindem Scrollen.
    const MITTEL = 4000;
    await page.setContent(seite(MITTEL, { threshold: 0.15 }));

    // Genau bis zur Oberkante des Abschnitts scrollen: Er beruehrt das Bild
    // schon, muesste also sichtbar sein — ist er aber nicht.
    await page.evaluate(() => window.scrollTo(0, 1200 - 900 + 400));
    await page.waitForTimeout(250);
    const drinBeiKontakt = await page.evaluate(() => (window as any).__drin);

    expect(
      drinBeiKontakt,
      "Der Abschnitt ist im Bild, bleibt aber weiss — das ist die gemeldete Luecke.",
    ).toBe(false);
  });

  test("NACHHER: threshold 0 mit Vorlauf blendet zuverlaessig ein", async ({ page }) => {
    // Die Behebung: Schwelle 0 (jedes sichtbare Pixel genuegt) und ein
    // POSITIVER unterer rootMargin, der frueher ausloest. Beides ist von der
    // Elementhoehe unabhaengig und kann darum nicht fehlschlagen.
    const behebung = { threshold: 0, rootMargin: "0px 0px 15% 0px" };

    for (const hoehe of [9000, 4000, 300]) {
      await page.setContent(seite(hoehe, behebung));
      const r = await durchscrollen(page, hoehe);
      expect(
        r.drin,
        `Ein ${hoehe}px hoher Abschnitt muss sichtbar werden.`,
      ).toBe(true);
    }
  });

  test("NACHHER: erscheint schon BEVOR er das Bild erreicht", async ({ page }) => {
    const HOCH2 = 9000;
    await page.setContent(seite(HOCH2, { threshold: 0, rootMargin: "0px 0px 15% 0px" }));

    // Kurz vor der Oberkante stehen bleiben: Der Vorlauf von 15 % der Bildhoehe
    // (135px) muss den Abschnitt bereits eingeblendet haben.
    await page.evaluate(() => window.scrollTo(0, 1200 - 900 + 100));
    await page.waitForTimeout(250);

    expect(
      await page.evaluate(() => (window as any).__drin),
      "Der Abschnitt soll fertig eingeblendet sein, wenn der Blick ihn erreicht.",
    ).toBe(true);
  });
});

/**
 * Und dieselbe Zusicherung an der echten Seite. Überspringt sich ohne
 * Agentensitzung selbst, statt falschen Alarm zu geben.
 */
test.describe("/agent/heute: kein Abschnitt bleibt weiss", () => {
  test("nach dem Durchscrollen ist jeder Abschnitt sichtbar", async ({ page }) => {
    await page.goto("/agent/heute", { waitUntil: "domcontentloaded" });
    test.skip(!page.url().includes("/agent/heute"), "Keine Agentensitzung");

    const abschnitte = page.locator("main section");
    test.skip(await abschnitte.count() === 0, "Keine Abschnitte gerendert");

    // Langsam bis zum Seitenende scrollen, damit jeder Beobachter ausloesen
    // kann — genau der Weg, den der Agent zurueckgelegt hat.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    await page.waitForTimeout(600);

    const unsichtbar = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main section"))
        .map((s, i) => ({
          i,
          titel: (s.querySelector("h2")?.textContent || "?").trim(),
          opacity: getComputedStyle(s).opacity,
          hoehe: Math.round(s.getBoundingClientRect().height),
        }))
        .filter((s) => Number(s.opacity) < 0.99));

    expect(
      unsichtbar,
      "Diese Abschnitte belegen Platz, sind aber unsichtbar — genau die " +
      "gemeldete weisse Flaeche:\n" + JSON.stringify(unsichtbar, null, 2),
    ).toEqual([]);
  });
});
