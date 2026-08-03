import { test, expect } from "@playwright/test";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * /agent/heute — Klickflächen, toter Knopf, Tour
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Diese Tests sichern drei Fehler ab, die am 03.08.2026 gemeldet wurden. Sie
 * prüfen bewusst die STRUKTUR und nicht das Aussehen: Ein Screenshot-Vergleich
 * würde bei jeder Gestaltungsänderung rot, ohne etwas über die Bedienbarkeit
 * zu sagen.
 *
 * Test 1 ist der wichtigste. Der Fehler war für den Agenten unsichtbar und
 * teuer: Ein Klick auf einen Kunden buchte ihn als „Nicht erreicht" weg.
 *
 * Die bewiesene Ursache steht in `austretende-karte-klickraub.spec.ts` — eine
 * gerade dokumentierte Karte schwebte 280 ms lang klickbar über der Liste. Hier
 * wird die daraus folgende Zusicherung geprüft, und zwar an der echten Seite:
 * Liegt über der Mitte eines Kundennamens tatsächlich dieser Name?
 *
 * `elementFromPoint` ist dafür das richtige Werkzeug, weil es Stapelkontexte,
 * absolute Positionierung und `pointer-events` genauso auswertet wie ein echter
 * Klick — anders als ein reiner Vergleich von Rechtecken.
 *
 * VORAUSSETZUNG: eine angemeldete Agentensitzung mit mindestens einem Kunden.
 * Ohne sie überspringen sich die Tests selbst, statt falschen Alarm zu geben.
 */

const ZIEL = "/agent/heute";

async function angemeldetMitKunden(page: import("@playwright/test").Page) {
  await page.goto(ZIEL, { waitUntil: "domcontentloaded" });
  // Auf einer Anmeldemaske gibt es nichts zu prüfen.
  if (!page.url().includes("/agent/heute")) return false;
  const karte = page.locator("[data-fi-karte]").first();
  return await karte.isVisible({ timeout: 8000 }).catch(() => false);
}

test.describe("Kundenkarte: Klick landet dort, wo hingezeigt wird", () => {
  test("Klick auf den Namen trifft den Namen, nicht eine Aktion", async ({ page }) => {
    test.skip(!(await angemeldetMitKunden(page)), "Keine Agentensitzung mit Kunden");

    const namen = page.locator('[data-fi-karte] [data-fi-name]');
    const anzahl = await namen.count();
    expect(anzahl, "mindestens eine Kundenkarte").toBeGreaterThan(0);

    // JEDE Karte prüfen, nicht nur die erste: Eine überlagernde Karte trifft
    // immer nur ihre unmittelbaren Nachbarn. Ein Test allein auf der ersten
    // Karte hätte den Fehler durchgelassen.
    for (let i = 0; i < anzahl; i++) {
      const name = namen.nth(i);
      await name.scrollIntoViewIfNeeded();
      const box = await name.boundingBox();
      if (!box) continue;

      const treffer = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x as number, y as number);
          if (!el) return { text: null as string | null, imNamen: false };
          return {
            text: (el.textContent || "").trim().slice(0, 60),
            imNamen: !!el.closest("[data-fi-name]"),
          };
        },
        [box.x + box.width / 2, box.y + box.height / 2],
      );

      expect(
        treffer.imNamen,
        `Karte ${i + 1}: Über der Mitte des Kundennamens liegt ein anderes ` +
        `Element ("${treffer.text}"). Ein Klick auf den Namen würde dieses ` +
        `Element auslösen. Genau so wurden Kunden versehentlich als ` +
        `"Nicht erreicht" weggebucht.`,
      ).toBe(true);
    }
  });

  test("Inhaltsebenen der Karte tragen kein translateZ", async ({ page }) => {
    test.skip(!(await angemeldetMitKunden(page)), "Keine Agentensitzung mit Kunden");

    // Die Karte neigt sich nie, also darf in ihr auch nichts in der Tiefe
    // verschoben sein. Das war NICHT die Ursache des Bedienfehlers — ein
    // Reproduktionsversuch hat das widerlegt, weil `overflow: hidden` die
    // Tiefe ohnehin flachlegt. Der Test bleibt trotzdem: Solche Ebenen kosten
    // pro Karte einen Stapelkontext und drei GPU-Ebenen für null Wirkung, und
    // sie haben mich einmal auf eine falsche Spur geführt.
    const verdacht = await page.evaluate(() => {
      const treffer: string[] = [];
      document.querySelectorAll("[data-fi-karte] *").forEach((el) => {
        const t = getComputedStyle(el).transform;
        // matrix3d hat 16 Werte; der 15. ist die Z-Verschiebung.
        if (t.startsWith("matrix3d")) {
          const w = t.slice(9, -1).split(",").map((n) => parseFloat(n));
          if (Math.abs(w[14]) > 0.5) {
            treffer.push(`${el.tagName}.${el.className}`.slice(0, 80));
          }
        }
      });
      return treffer;
    });

    expect(
      verdacht,
      "Kein Element in der Kundenkarte darf in der Tiefe verschoben sein, " +
      "solange die Karte sich nicht neigt.",
    ).toEqual([]);
  });
});

test.describe("Kein toter Knopf am unteren Bildrand", () => {
  test('„Nächste Akte" existiert nirgends im Agentenbereich', async ({ page }) => {
    // Der Knopf zeigte auf /agent/kartei — eine abgeschaltete Route, die auf
    // /agent/heute zurückleitet. Er stammte aus dem abgeschafften Pool-System.
    for (const pfad of ["/agent/heute", "/agent/kunden", "/agent/kalender"]) {
      await page.goto(pfad, { waitUntil: "domcontentloaded" });
      if (!page.url().includes(pfad)) continue;
      await expect(
        page.getByRole("link", { name: /Nächste Akte/i }),
        `${pfad}: Der Knopf "Nächste Akte" führt im Kreis und muss weg sein.`,
      ).toHaveCount(0);
    }
  });
});

test.describe("Tour öffnet sich immer und immer von vorn", () => {
  test('„Wie funktioniert das?" öffnet bei jedem Klick Schritt 1', async ({ page }) => {
    test.skip(!(await angemeldetMitKunden(page)), "Keine Agentensitzung");

    const ausloeser = page.getByRole("button", { name: /Wie funktioniert das/i });
    await expect(ausloeser).toBeVisible();

    // Zweimal öffnen. Beim zweiten Mal war vorher sofort die LETZTE Seite zu
    // sehen, weil der Schrittzähler erhalten blieb.
    for (const runde of [1, 2]) {
      await ausloeser.click();
      const dialog = page.getByRole("heading", { name: /Willkommen in deiner Kundenliste/i });
      await expect(
        dialog,
        `Runde ${runde}: Die Tour muss bei Schritt 1 beginnen.`,
      ).toBeVisible({ timeout: 3000 });

      // Es muss „Weiter" heissen, nicht „Los geht's" — Letzteres wäre der
      // letzte Schritt und damit der alte Fehler.
      await expect(
        page.getByRole("button", { name: "Weiter" }),
        `Runde ${runde}: Bei Schritt 1 gehört dort "Weiter" hin.`,
      ).toBeVisible();

      await page.getByRole("button", { name: /überspringen/i }).click();
      await expect(dialog).toBeHidden();
    }
  });
});
