// ═══════════════════════════════════════════════════════════════════════════
// APPLE-BEWEGUNG FÜR DIE GANZE BUSINESS-WELT (E-442, 28.10.2026)
//
// Justin (28.10.): „Die gesamte Website braucht mehr Animationen, auch alle anderen Seiten müssen auf das Apple-Design
// und die Animationen umgestellt werden … und die Animationen viel besser und moderner.“
//
// Vorbild ist Apples „StaggeredFadeIn“ (vermessen auf apple.com/de/iphone am 28.10.): Inhalte stehen 30 px tiefer und
// unsichtbar, und sobald sie ins Bild kommen, gleiten sie gestaffelt hoch — Deckkraft 0,9 s, Weg 0,9 s, je Element
// 0,12 s später (höchstens sechs Stufen). Einmal je Element, nie an die Scrollposition gekoppelt (Justin 23.08.:
// Scroll-Spulen „ruckelt“). Danach werden die Klassen wieder entfernt, der Block steht in seinem eigenen Zustand.
//
// Ein Haken für alle Seiten: GlobalNav (/business, 80 Unterseiten, Auftrag, Rechtsseiten, Angebote) und die
// Landingpages rufen ihn auf. Die Liste ZIELE nennt Blöcke, die noch keine eigene Bewegung haben; Bausteine mit
// eigenem Auftritt (Hero, Pakettafeln, Etappen, Schaltzentrale, Bogen, Vorführraum, Beiträge, Angebots-Hero,
// Etappen-Linie, Standort-Uhren, Rollen-Dreieck) sind ausgenommen — ebenso alles mit eigenem data-an und alles in seitlich scrollenden Leisten.
// Sicherungen (Gegenprüfung 28.10.): Fokus per Tastatur zeigt den Block sofort; am Seitenende erscheint alles,
// was im Bild steht; beim Drucken steht alles. Ohne JS und bei „weniger Bewegung“ steht alles sofort sichtbar
// (die Klasse ap-bewegung fehlt dann). Stil: styles/global-rahmen-apple.css (Animation, nicht Übergang).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect } from "react";
import { nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";

/** Blöcke, die beim Hineinscrollen gestaffelt hochgleiten. */
const ZIELE = [
  // /business und Privatpersonen
  ".fg-beleg-kopf", ".fg-beleg-spalte", ".fg-kleingedruckt > div", ".fg-paket-fuss", ".fg-tarif-vergleich",
  ".fg-jb.band", ".fg-jb.voll", ".fg-jb.kompakt", ".fg-stern-unter > *", ".fg-fuer-chips",
  ".fg-gespraech-seite", ".fg-kal", ".dk-frage", ".fg-fragen-alle", ".fg-schluss-text > *",
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
const AUSNAHMEN = [
  ".hg", ".gk", ".gk-mobil", ".dk-auf", ".fg-eb", ".sn", ".hb-c", ".gv-buehne", ".fg-tarif", ".fd-tafeln",
  // Angebotsseite: Der Hero baut sich unter der Begrüßung selbst auf (Gegenprüfung 28.10.).
  ".gia-hero",
  // Eigene Einfahrt (Nachprüfung 28.10.): Vorführraum (.gv — die PDF-Mappe blinkte sonst doppelt), Beiträge (.sz, seitlich
  // scrollend — Karten kämen sonst leer ins Bild), Etappen-Linie, Standort-Uhren und Rollen-Dreieck der Unterseiten.
  ".gv", ".sz", ".fd-weg", ".fd-orte", ".fd-dreieck",
  "[role=dialog]", "dialog",
].join(", ");

/** Höchstens so viele Stufen: Was zugleich ins Bild kommt, wartet nie länger als 0,72 s. */
const STUFEN = 6;

/** Steht das Element in einer seitlich scrollenden Leiste? Dort meldet der Beobachter abgeschnittene Karten nie. */
function inQuerLeiste(el: Element, merk: WeakMap<Element, boolean>): boolean {
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    let quer = merk.get(a);
    if (quer === undefined) {
      const x = getComputedStyle(a).overflowX;
      quer = x === "auto" || x === "scroll";
      merk.set(a, quer);
    }
    if (quer) return true;
  }
  return false;
}

export function useApfelBewegung() {
  // useLayoutEffect: Der Startzustand steht vor dem ersten Bild — sonst blitzen Blöcke im Bild kurz auf und verschwinden.
  useLayoutEffect(() => {
    if (ruhigGewuenscht() || typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    html.classList.add("ap-bewegung");
    const offen = new Set<HTMLElement>(); // markiert, noch nicht gezeigt
    const querMerk = new WeakMap<Element, boolean>();

    const fertig = (el: HTMLElement) => {
      offen.delete(el);
      el.classList.remove("ap-rein", "ap-da");
      el.style.removeProperty("--ap-i");
    };
    /** Sofort zeigen, ohne Gleiten (Fokus, Druck). */
    const sofort = (el: HTMLElement) => { io.unobserve(el); wartet = wartet.filter((x) => x !== el); fertig(el); };
    // Staffel über Schübe hinweg: Kommt ein neuer Schub, während der vorige noch gestaffelt startet, reiht er sich
    // dahinter ein — sonst liefe Zeile 3 vor Zeile 2 los (Nachprüfung 28.10.).
    let staffelBis = 0;
    const zeigen = (liste: HTMLElement[]) => {
      // Reihenfolge wie beim Lesen: oben vor unten, links vor rechts.
      liste.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return Math.round(ra.top - rb.top) || ra.left - rb.left;
      });
      const jetzt = performance.now();
      const basis = Math.max(0, Math.ceil((staffelBis - jetzt) / 120));
      staffelBis = Math.max(staffelBis, jetzt + Math.min(basis + liste.length, STUFEN) * 120);
      liste.forEach((el, i) => {
        offen.delete(el);
        el.style.setProperty("--ap-i", String(Math.min(basis + i, STUFEN)));
        el.classList.add("ap-da");
        let weg = 0;
        const ende = (e?: AnimationEvent) => {
          if (e && (e.target !== el || e.animationName !== "ap-ein-weg")) return;
          window.clearTimeout(weg); el.removeEventListener("animationend", ende); fertig(el);
        };
        el.addEventListener("animationend", ende);
        weg = window.setTimeout(ende, 2000); // falls kein animationend kommt (Tab hinten, Element versteckt)
      });
    };
    let wartet: HTMLElement[] = [];
    const ausloesen = (neu: HTMLElement[]) => {
      if (!neu.length) return;
      // Solange der Ladebildschirm steht, sammeln — der Auftritt beginnt, wenn die Seite sichtbar wird.
      if (html.classList.contains("ld-an")) { wartet.push(...neu); return; }
      zeigen(neu);
    };
    // threshold 0 + Rand unten: Der Auftritt beginnt, sobald die Oberkante 7 % über dem unteren Rand steht. Ein Anteil
    // (z. B. 0.08) wäre falsch: Sehr hohe Blöcke (der Mustervertrag am Telefon) zeigen nie 8 % ihrer Fläche auf einmal
    // und blieben für immer unsichtbar (Messung 28.10.).
    const io = new IntersectionObserver((eintraege) => {
      const neu: HTMLElement[] = [];
      for (const e of eintraege) if (e.isIntersecting) { neu.push(e.target as HTMLElement); io.unobserve(e.target); }
      ausloesen(neu);
    }, { threshold: 0, rootMargin: "0px 0px -7% 0px" });
    const loesen = nachLadebild(() => { if (wartet.length) { zeigen(wartet); wartet = []; } });

    const markieren = () => {
      document.querySelectorAll<HTMLElement>(ZIELE).forEach((el) => {
        if (el.dataset.ap) return;
        // Eigene Bewegung (Ausnahmen, eigenes data-an) oder seitliche Leiste: nicht anfassen.
        if (el.closest(AUSNAHMEN) || el.hasAttribute("data-an") || inQuerLeiste(el, querMerk)) { el.dataset.ap = "aus"; return; }
        // Hülle mit eigenen Zielen darin (z. B. ein Abschnitt mit Karten): Die Karten gleiten einzeln, die Hülle bleibt still.
        if (el.querySelector(ZIELE)) { el.dataset.ap = "aus"; return; }
        el.dataset.ap = "1";
        el.classList.add("ap-rein");
        offen.add(el);
        io.observe(el);
      });
    };
    // Erst nach allen Layout-Effekten dieses Durchgangs (noch vor dem ersten Bild): Dann hat useEinmalSichtbar sein
    // data-an schon gesetzt, und Blöcke mit eigener Einfahrt werden erkannt (Nachprüfung 28.10.: die Prüfung lief zu früh).
    let tot = false;
    queueMicrotask(() => { if (!tot) markieren(); });
    // Später erscheinende Blöcke (Kalender, aufgeklappte Fragen, nachgeladene Beiträge) bekommen denselben Auftritt.
    let bild = 0;
    const mo = new MutationObserver((liste) => {
      // Nur neue Elemente zählen — Textwechsel (Tipp-Zeile, Uhren) lösen keinen Suchlauf aus.
      if (!liste.some((m) => Array.from(m.addedNodes).some((n) => n.nodeType === 1))) return;
      if (!bild) bild = requestAnimationFrame(() => { bild = 0; markieren(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Tastatur: Ein fokussierter Block ist sofort sichtbar — nie ein Fokusring auf Deckkraft 0 (Gegenprüfung 28.10.).
    const perFokus = (e: FocusEvent) => {
      const t = (e.target as Element | null)?.closest?.(".ap-rein:not(.ap-da)") as HTMLElement | null;
      if (t) sofort(t);
    };
    document.addEventListener("focusin", perFokus, true);
    // Am Seitenende kann nichts mehr über die 7-%-Linie steigen: Was dann im Bild steht, erscheint.
    let rollBild = 0;
    const amEnde = () => {
      rollBild = 0;
      if (!offen.size || html.classList.contains("ld-an")) return;
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 8) return;
      const neu: HTMLElement[] = [];
      offen.forEach((el) => { const r = el.getBoundingClientRect(); if (r.height > 0 && r.top < window.innerHeight && r.bottom > 0) { io.unobserve(el); neu.push(el); } });
      ausloesen(neu);
    };
    const perRollen = () => { if (!rollBild) rollBild = requestAnimationFrame(amEnde); };
    window.addEventListener("scroll", perRollen, { passive: true });
    // Drucken: alles sofort sichtbar (zusätzlich zur Druckregel im Stil).
    const perDruck = () => { Array.from(offen).forEach(sofort); };
    window.addEventListener("beforeprint", perDruck);

    return () => {
      tot = true;
      loesen(); mo.disconnect(); io.disconnect(); cancelAnimationFrame(bild); cancelAnimationFrame(rollBild);
      document.removeEventListener("focusin", perFokus, true);
      window.removeEventListener("scroll", perRollen);
      window.removeEventListener("beforeprint", perDruck);
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
