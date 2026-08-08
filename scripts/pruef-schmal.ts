/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ABNAHME: Passt die Verwaltung auf ein 380-px-Telefon?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Anlass (08.08.2026): Auf 380 px waren in der Kundenakte Fristen, Datum und
 * Beträge am rechten Rand einfach nicht da. Nicht abgeschnitten mit Hinweis,
 * nicht umgebrochen — weggeschnitten. Gemessen: 174 Elemente breiter als das
 * Fenster, einzelne Karten 477 px. Zwei Ursachen:
 *
 *   1. Eine Rasterzelle ohne `min-w-0` darf nicht unter die Mindestbreite ihres
 *      Inhalts schrumpfen. Die Spalte wurde also breiter als der Bildschirm.
 *   2. Die Statusmarke stand auf `whitespace-nowrap`. „Kunde meldet Zahlung
 *      (noch nicht bankbestätigt)" ist mit Absicht lang — sie muss UMBRECHEN,
 *      nicht kürzen, denn der Zusatz darf nie fehlen.
 *
 * Ein Blick auf einen Screenshot findet das. Ein Screenshot, den niemand ansieht,
 * findet es nicht. Deshalb wird gemessen: Kein sichtbares Element darf breiter
 * sein als das Fenster.
 *
 * NUR LESEND. Es wird geklickt: nichts. Es wird geschrieben: nichts.
 *
 * VORAUSSETZUNG: Ein laufender Server.
 *   set -a && . ./.env && set +a && PORT=5188 npm run dev
 *   npx tsx scripts/pruef-schmal.ts
 */
import "dotenv/config";
import { chromium } from "playwright";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BREITE = 380;

/**
 * Seiten, die im Betrieb auf dem Telefon geöffnet werden.
 *
 * `wartenAuf` ist Pflicht, wo es geht: Eine Seite, die noch lädt, hat nichts,
 * was zu breit sein könnte — sie bestand am 08.08.2026 auch mit eingebautem
 * Fehler. Erscheint die Marke nicht, ist das ein FAIL, kein Übersprungen.
 */
const SEITEN: { pfad: string; name: string; wartenAuf?: string }[] = [
  { pfad: "/admin/kunden", name: "Kunden — die eine Liste" },
  { pfad: "/admin/dubletten", name: "Dubletten-Arbeitsplatz" },
  { pfad: "/admin/verbuchung", name: "Verbuchung" },
];

let bestanden = 0;
let gescheitert = 0;
const ok = (text: string, gut: boolean, hinweis = "") => {
  if (gut) { bestanden++; console.log(`  PASS  ${text}`); }
  else { gescheitert++; console.log(`  FAIL  ${text}${hinweis ? ` — ${hinweis}` : ""}`); }
};

async function main() {
  const browser = await chromium.launch();

  // Eine Akte mit echten Daten dazunehmen — und zwar den UNGÜNSTIGSTEN Fall,
  // nicht den erstbesten. `claimed_paid` trägt den längsten Statustext
  // („Kunde meldet Zahlung (noch nicht bankbestätigt)"), und viele Bestellungen
  // füllen die Akte. Ein Prüfstand, der sich seinen Fall zufällig aussucht,
  // bestand am 08.08.2026 auch mit wieder eingebautem Fehler.
  const { sqlPool } = await import("../server/lib/db-pool");
  const akten = await sqlPool`
    SELECT ref FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND a.payment_status = 'claimed_paid'
    ORDER BY (SELECT COUNT(*) FROM fiaon_applications x WHERE x.person_id = a.person_id) DESC
    LIMIT 4
  `;
  for (const [i, a] of (akten as any[]).entries()) {
    SEITEN.push({
      pfad: `/admin/kunde/${encodeURIComponent(String(a.ref))}`,
      name: `Kundenakte ${i + 1}`,
      wartenAuf: "Zahlungen — alle Bestellungen dieser Person",
    });
  }
  if (akten.length === 0) console.log("  HINWEIS  keine claimed_paid-Bestellung gefunden — Akten übersprungen");

  console.log(`\n══ Schmale Ansicht: ${BREITE} px ══\n`);

  for (const seite of SEITEN) {
    const ctx = await browser.newContext({ viewport: { width: BREITE, height: 850 } });
    const s = await ctx.newPage();
    await s.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
    await s.goto(`${BASIS}${seite.pfad}`, { waitUntil: "domcontentloaded" });
    // Die Verwaltung lädt ihre Karten nach; „/admin/hub/badges" braucht kalt
    // rund zehn Sekunden (bekannt, siehe AGENTS.md).
    let geladen = true;
    if (seite.wartenAuf) {
      geladen = await s.getByText(seite.wartenAuf).first()
        .waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
      ok(`${seite.name}: Inhalt ist wirklich da`, geladen, `„${seite.wartenAuf}" nie erschienen`);
    }
    await s.waitForTimeout(seite.wartenAuf ? 1500 : 13000);
    if (!geladen) { await ctx.close(); continue; }

    const messung = await s.evaluate(() => {
      // ALLE zu breiten Elemente sammeln, dann nur die TIEFSTEN melden — die
      // ohne zu breites Kind. Ein erster Entwurf meldete nur Blätter; die
      // eigentliche Fundstelle war aber eine Zeile aus drei Knöpfen, die nicht
      // umbrechen durfte. Als Blatt zählt sie nicht, also blieb der Test grün.
      const alle: Element[] = [];
      document.querySelectorAll("*").forEach((el) => {
        const k = el.getBoundingClientRect();
        if (k.width > window.innerWidth + 2 && k.height > 0) alle.push(el);
      });
      // Eine breite Tabelle in einem ausdrücklich waagerecht rollbaren Kasten
      // ist kein Fehler, sondern das übliche Mittel — der Nutzer kann schieben.
      // Gemeint ist hier das stille Wegschneiden.
      // (Ohne Hilfsfunktion geschrieben: benannte Funktionen im Browserkontext
      // bekommen von esbuild einen Helfer `__name` mitgegeben, den es dort nicht
      // gibt — der Lauf bricht dann mit „__name is not defined" ab.)
      const rollbare = new Set<Element>();
      for (const el of alle) {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll") { rollbare.add(el); break; }
        }
      }
      const zu = alle
        .filter((el) => !alle.some((a) => a !== el && el.contains(a)))
        .filter((el) => !rollbare.has(el))
        .map((el) => ({
          breite: Math.round(el.getBoundingClientRect().width),
          klasse: String((el as HTMLElement).className || "").slice(0, 60),
          text: (el.textContent || "").trim().slice(0, 40),
        }));
      // Zweite Probe: abgeschnittener Text. Ein Kasten kann die richtige Breite
      // haben und seinen Inhalt trotzdem wegschneiden (`overflow: hidden` plus
      // `white-space: nowrap`). Das sieht man an scrollWidth > clientWidth.
      const beschnitten: { klasse: string; text: string; fehlt: number }[] = [];
      document.querySelectorAll("*").forEach((el) => {
        const e = el as HTMLElement;
        if (e.children.length > 0) return;
        const cs = getComputedStyle(e);
        if (cs.overflowX === "visible") return;
        if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) {
          beschnitten.push({
            klasse: String(e.className || "").slice(0, 60),
            text: (e.textContent || "").trim().slice(0, 40),
            fehlt: e.scrollWidth - e.clientWidth,
          });
        }
      });
      return {
        ueberstand: document.documentElement.scrollWidth - window.innerWidth,
        zu,
        beschnitten,
      };
    });

    ok(`${seite.name}: Seite scrollt nicht seitwärts`, messung.ueberstand <= 0,
      `Überstand ${messung.ueberstand}px`);
    // Ein Ladeplatzhalter ist kein Layoutfehler — er verschwindet mit den Daten.
    const echte = messung.zu.filter((z) => !/^Lädt|^Laden/.test(z.text));
    ok(`${seite.name}: kein Inhalt breiter als das Fenster`, echte.length === 0,
      echte.slice(0, 3).map((z) => `${z.breite}px "${z.text}"`).join(" · "));
    // Tabs und Zahlenreihen dürfen bewusst waagerecht rollbar sein — geprüft
    // wird auf HARTES Abschneiden, also auf Kästen ohne eigene Rollmöglichkeit.
    const geschnitten = messung.beschnitten.filter((z) => z.text.length > 0 && z.fehlt > 8);
    ok(`${seite.name}: kein Text hart abgeschnitten`, geschnitten.length === 0,
      geschnitten.slice(0, 3).map((z) => `fehlen ${z.fehlt}px bei "${z.text}"`).join(" · "));

    await ctx.close();
  }

  await browser.close();
  await sqlPool.end();

  console.log(`\n══ Ergebnis: ${bestanden} bestanden, ${gescheitert} fehlgeschlagen ══\n`);
  process.exit(gescheitert > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
