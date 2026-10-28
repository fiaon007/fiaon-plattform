// ═══════════════════════════════════════════════════════════════════════════
// APPLE-BEWEGUNG FÜR DIE GANZE BUSINESS-WELT (E-442, 28.10.2026)
//
// Justin (28.10.): „Die gesamte Website braucht mehr Animationen, auch alle anderen Seiten müssen auf das Apple-Design
// und die Animationen umgestellt werden … und die Animationen viel besser und moderner.“
//
// Vorbild ist Apples „StaggeredFadeIn“ (vermessen auf apple.com/de/iphone am 28.10.): Inhalte stehen 30 px tiefer und
// unsichtbar, und sobald sie ins Bild kommen, gleiten sie gestaffelt hoch — Deckkraft 0,9 s, Weg 0,9 s, je Element
// 0,12 s später (höchstens sechs Stufen). Einmal je Element, nie an die Scrollposition gekoppelt (Justin 23.08.:
// Scroll-Spulen „ruckelt“). Danach werden die Klassen wieder entfernt, damit die eigenen Hover-Übergänge der Karten
// nicht mit Verzögerung laufen.
//
// Ein Haken für alle Seiten: GlobalNav (/business, 80 Unterseiten, Auftrag, Rechtsseiten, Angebote) und die
// Landingpages rufen ihn auf. Die Liste ZIELE nennt Blöcke, die noch keine eigene Bewegung haben; Bausteine mit
// eigenem Auftritt (Hero, Pakettafeln, Etappen, Schaltzentrale, Bogen, Vorführraum-Telefone) sind ausgenommen.
// Ohne JS, im Vorab-HTML und bei „weniger Bewegung“ steht alles sofort sichtbar (die Klasse ap-bewegung fehlt dann).
// Stil: styles/global-rahmen-apple.css (wird mit Kopf und Fuß geladen, also auf jeder Business-Seite).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect } from "react";
import { nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";

/** Blöcke, die beim Hineinscrollen gestaffelt hochgleiten. */
const ZIELE = [
  // /business und Privatpersonen
  ".fg-beleg-kopf", ".fg-beleg-spalte", ".fg-kleingedruckt > div", ".fg-paket-fuss", ".fg-tarif-vergleich",
  ".fg-jb.band", ".fg-jb.voll", ".fg-jb.kompakt", ".fg-stern-unter > *", ".fg-fuer-chips",
  ".fg-gespraech-seite", ".fg-kal", ".dk-frage", ".fg-fragen-alle", ".fg-schluss-text > *", ".gv-mappe",
  ".sz-kopf", ".sz-karte", ".sz-profile",
  // die 80 Unterseiten und die Redaktion
  ".fd-krumen", ".fd-kopf .fg-auge", ".fd-h1", ".fd-lead", ".fd-kopf-knoepfe", ".fd-ziffern", ".fd-merkblatt", ".fd-karteikarte",
  ".fd-kurz", ".fd-abschnitt > *", ".fd-karte", ".fd-rolle", ".fd-paket", ".fd-tafel", ".fd-tabelle", ".fd-hinweis",
  ".fd-etappe", ".fd-standort", ".fd-weiter-raster > a", ".fd-verzeichnis li", ".fd-finder", ".fd-gespraech-karte",
  ".fd-zitat", ".fd-vermerk", ".fd-vip-zeile", ".fd-weiter > .fg-auge",
  // Auftrag, Mein Auftrag, Rechtsseiten
  ".gs-kopf > *", ".gs-blatt", ".gs-seite", ".gr-wahl", ".gr-papier", ".gr-weiter",
  // Fuß
  ".gf-oben > *", ".gf-orte",
].join(",");

/** Wer schon eine eigene Bewegung hat, bleibt unberührt (sonst doppelt oder gegeneinander). */
const AUSNAHMEN = ".hg, .gk, .gk-mobil, .dk-auf, .fg-eb, .sn, .hb-c, .gv-buehne, .fg-tarif, .fd-tafeln, [role=dialog], dialog";

/** Höchstens so viele Stufen: Was zugleich ins Bild kommt, wartet nie länger als 0,72 s. */
const STUFEN = 6;

export function useApfelBewegung() {
  // useLayoutEffect: Der Startzustand steht vor dem ersten Bild — sonst blitzen Blöcke im Bild kurz auf und verschwinden.
  useLayoutEffect(() => {
    if (ruhigGewuenscht() || typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    html.classList.add("ap-bewegung");

    const fertig = (el: HTMLElement) => {
      el.classList.remove("ap-rein", "ap-da");
      el.style.removeProperty("--ap-i");
    };
    const zeigen = (liste: HTMLElement[]) => {
      // Reihenfolge wie beim Lesen: oben vor unten, links vor rechts.
      liste.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return Math.round(ra.top - rb.top) || ra.left - rb.left;
      });
      liste.forEach((el, i) => {
        el.style.setProperty("--ap-i", String(Math.min(i, STUFEN)));
        el.classList.add("ap-da");
        let weg = 0;
        const ende = (e?: TransitionEvent) => {
          if (e && (e.target !== el || e.propertyName !== "transform")) return;
          window.clearTimeout(weg); el.removeEventListener("transitionend", ende); fertig(el);
        };
        el.addEventListener("transitionend", ende);
        weg = window.setTimeout(ende, 1900); // falls kein transitionend kommt (Tab hinten, Element versteckt)
      });
    };
    let wartet: HTMLElement[] = [];
    const io = new IntersectionObserver((eintraege) => {
      const neu: HTMLElement[] = [];
      for (const e of eintraege) if (e.isIntersecting) { neu.push(e.target as HTMLElement); io.unobserve(e.target); }
      if (!neu.length) return;
      // Solange der Ladebildschirm steht, sammeln — der Auftritt beginnt, wenn die Seite sichtbar wird.
      if (html.classList.contains("ld-an")) { wartet.push(...neu); return; }
      zeigen(neu);
    // threshold 0 + Rand unten: Der Auftritt beginnt, sobald die Oberkante 7 % über dem unteren Rand steht. Ein Anteil
    // (z. B. 0.08) wäre falsch: Sehr hohe Blöcke (der Mustervertrag am Telefon) zeigen nie 8 % ihrer Fläche auf einmal
    // und blieben für immer unsichtbar (Messung 28.10.).
    }, { threshold: 0, rootMargin: "0px 0px -7% 0px" });
    const loesen = nachLadebild(() => { if (wartet.length) { zeigen(wartet); wartet = []; } });

    const markieren = () => {
      document.querySelectorAll<HTMLElement>(ZIELE).forEach((el) => {
        if (el.dataset.ap) return;
        if (el.closest(AUSNAHMEN)) { el.dataset.ap = "aus"; return; }
        // Hülle mit eigenen Zielen darin (z. B. ein Abschnitt mit Karten): Die Karten gleiten einzeln, die Hülle bleibt still.
        if (el.querySelector(ZIELE)) { el.dataset.ap = "aus"; return; }
        el.dataset.ap = "1";
        el.classList.add("ap-rein");
        io.observe(el);
      });
    };
    markieren();
    // Später erscheinende Blöcke (Kalender, aufgeklappte Fragen, nachgeladene Beiträge) bekommen denselben Auftritt.
    let bild = 0;
    const mo = new MutationObserver(() => { if (!bild) bild = requestAnimationFrame(() => { bild = 0; markieren(); }); });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      loesen(); mo.disconnect(); io.disconnect(); cancelAnimationFrame(bild);
      document.querySelectorAll<HTMLElement>("[data-ap]").forEach((el) => { fertig(el); delete el.dataset.ap; });
      html.classList.remove("ap-bewegung");
    };
  }, []);

  // Die Kopf-Pille wird beim Scrollen schmaler (wie Apples Leiste) — über eine Klasse am <html>, eine Messung je Bild.
  useEffect(() => {
    const html = document.documentElement;
    let bild = 0;
    const messen = () => { bild = 0; html.classList.toggle("ap-gescrollt", window.scrollY > 24); };
    const planen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener("scroll", planen, { passive: true });
    return () => { window.removeEventListener("scroll", planen); cancelAnimationFrame(bild); html.classList.remove("ap-gescrollt"); };
  }, []);
}
