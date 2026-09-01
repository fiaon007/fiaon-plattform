// ═══════════════════════════════════════════════════════════════════════════
// SEO-DATEN — strukturierte Daten, Canonical und Open Graph je Seite
// (26.08.2026)
//
// Justin: „Bitte JEDE Seite SEO und SEA optimieren, also das Maximum."
//
// ── WAS DIESER BAUSTEIN LEISTET ───────────────────────────────────────────
// `Dunkel` setzt Titel und Beschreibung. Was bisher fehlte und was Google
// tatsächlich liest:
//
//   · JSON-LD (FAQPage, HowTo, WebApplication, Article, BreadcrumbList) —
//     das ist die Sprache der Rich Results. Eine FAQ-Seite ohne FAQPage-
//     Markup ist für die Suche eine Textwüste.
//   · rel=canonical — ohne sie zersplittern ?utm_…-Adressen aus Anzeigen
//     die Rankings derselben Seite. Für SEA-Landepages Pflicht.
//   · og:title/og:description/og:url — sonst trägt jeder geteilte Link den
//     Titel der Startseite.
//
// ── DIE GRENZE DIESES BAUSTEINS ───────────────────────────────────────────
// Er ist Client-seitig. Google rendert JavaScript und liest das zuverlässig;
// für Messenger-Vorschauen zählt weiterhin das statische index.html. Die
// Basis-OG-Daten dort bleiben deshalb bestehen — hier wird nur übersteuert.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { seoSeite } from "@shared/fiaon-seo-seiten";

const URSPRUNG = "https://fiaon.com";

type Frage = { f: string; a: string };
type Krume = { name: string; pfad: string };

export interface SeoAngaben {
  /** Pfad der Seite, z. B. "/werkzeuge/kreditrechner" — wird zur Canonical. */
  pfad: string;
  titel: string;
  beschreibung: string;
  /** Sichtbare FAQ der Seite — erzeugt FAQPage-Markup. Nur Fragen angeben, die auch im Text stehen: unsichtbares Markup ist ein Abstrafungsgrund. */
  fragen?: Frage[];
  /** Brotkrumen von der Startseite bis hierher. */
  krumen?: Krume[];
  /** Für Rechner und Prüfer: WebApplication-Markup (kostenlos, Kategorie Finanzen). */
  werkzeug?: { name: string };
  /** Für Ratgeber-Pfeiler: Article-Markup mit Stand-Datum. */
  artikel?: { ueberschrift: string; stand: string };
}

/** Ein <script type="application/ld+json"> je Block, beim Verlassen entfernt. */
export default function SeoDaten(angaben: SeoAngaben) {
  // 02.09.2026 (E-079): Titel und Beschreibung kommen aus der gemeinsamen
  // Tabelle, wenn die Seite dort steht — dieselben Werte wie im Server-HTML.
  const tabelle = seoSeite(angaben.pfad);
  const s: SeoAngaben = tabelle ? { ...angaben, titel: tabelle.titel, beschreibung: tabelle.beschreibung } : angaben;
  useEffect(() => {
    const bloecke: object[] = [];

    if (s.krumen?.length) {
      bloecke.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "FIAON", item: URSPRUNG + "/" },
          ...s.krumen.map((k, i) => ({
            "@type": "ListItem", position: i + 2, name: k.name, item: URSPRUNG + k.pfad,
          })),
        ],
      });
    }
    if (s.fragen?.length) {
      bloecke.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: s.fragen.map((f) => ({
          "@type": "Question", name: f.f,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    if (s.werkzeug) {
      bloecke.push({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: s.werkzeug.name,
        url: URSPRUNG + s.pfad,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        provider: { "@type": "Organization", name: "FIAON", url: URSPRUNG },
      });
    }
    if (s.artikel) {
      bloecke.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: s.artikel.ueberschrift,
        dateModified: s.artikel.stand,
        author: { "@type": "Organization", name: "FIAON", url: URSPRUNG },
        publisher: { "@type": "Organization", name: "FIAON", url: URSPRUNG },
        mainEntityOfPage: URSPRUNG + s.pfad,
        inLanguage: "de",
      });
    }

    const scripts = bloecke.map((b) => {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-seo", "seite");
      el.textContent = JSON.stringify(b);
      document.head.appendChild(el);
      return el;
    });

    // Canonical: Anzeigen hängen ?utm_… an — ohne Canonical zersplittert das.
    let canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const canonWarNeu = !canon;
    const canonAlt = canon?.href ?? "";
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = URSPRUNG + s.pfad;

    // Open Graph übersteuern, damit geteilte Links DIESE Seite zeigen.
    const og = (eigenschaft: string, wert: string) => {
      let m = document.querySelector<HTMLMetaElement>(`meta[property="${eigenschaft}"]`);
      const alt = m?.getAttribute("content") ?? null;
      if (!m) { m = document.createElement("meta"); m.setAttribute("property", eigenschaft); document.head.appendChild(m); }
      m.setAttribute("content", wert);
      return { m, alt };
    };
    const ogs = [
      og("og:title", s.titel),
      og("og:description", s.beschreibung),
      og("og:url", URSPRUNG + s.pfad),
      og("og:type", s.artikel ? "article" : "website"),
    ];

    return () => {
      scripts.forEach((el) => el.remove());
      if (canonWarNeu) canon?.remove();
      else if (canon) canon.href = canonAlt;
      ogs.forEach(({ m, alt }) => { if (alt !== null) m.setAttribute("content", alt); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pfad]);

  return null;
}
