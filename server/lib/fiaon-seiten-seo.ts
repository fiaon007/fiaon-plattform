// ═══════════════════════════════════════════════════════════════════════════
// EIN EIGENER KOPF FÜR JEDE ÖFFENTLICHE SEITE (25.08.2026)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Gemessen an der laufenden Seite: /, /preise, /privatkunden, /bonitaet und
// /werkzeuge/verjaehrung liefern ALLE denselben Titel
// („FIAON – Das Betriebssystem für Bonität") und dieselbe Beschreibung.
// Nur /ratgeber hatte einen eigenen — weil dafür schon ein Vorrenderer
// existierte.
//
// Für Google heißt das: 47 Seiten bewerben sich mit demselben Schild. Wer
// „SCHUFA Eintrag löschen" sucht, bekommt keinen Grund, ausgerechnet unsere
// Werkzeug-Seite zu öffnen — der Titel sagt nichts über sie aus. Titel und
// Beschreibung sind das, was in der Trefferliste STEHT; sie entscheiden über
// die Klickrate, noch bevor Rang und Inhalt eine Rolle spielen.
//
// ── WARUM HIER UND NICHT IM BROWSER ────────────────────────────────────────
// React setzt den Titel erst, NACHDEM JavaScript gelaufen ist. Google rendert
// zwar, aber verzögert und nicht garantiert; andere Crawler (Bing, LinkedIn,
// WhatsApp-Vorschau) tun es gar nicht. Der Kopf muss im ausgelieferten HTML
// stehen.
//
// ── EINE MECHANIK, NICHT ZWEI ──────────────────────────────────────────────
// `kopfEinsetzen` stammt aus fiaon-ratgeber-seo.ts und wird von dort
// mitbenutzt. Zwei Fassungen desselben Kopfbaus liefen unweigerlich
// auseinander — eine bekäme das nächste Feld, die andere nicht.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";

export const BASIS = "https://fiaon.com";

const esc = (s: string) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function indexHtml(): string | null {
  const kandidaten = [
    path.resolve(import.meta.dirname, "public", "index.html"),
    path.resolve(process.cwd(), "dist", "public", "index.html"),
    path.resolve(process.cwd(), "client", "index.html"),
  ];
  const f = kandidaten.find((k) => fs.existsSync(k));
  return f ? fs.readFileSync(f, "utf8") : null;
}

export function kopfEinsetzen(html: string, kopf: {
  titel: string; beschreibung: string; url: string; ld?: unknown[];
  og?: Record<string, string>; robots?: string;
}): string {
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(kopf.titel)}</title>`);
  const setz = (name: string, attr: "name" | "property", wert: string) => {
    const re = new RegExp(`<meta ${attr}="${name}" content="[^"]*"\\s*/?>`);
    const neu = `<meta ${attr}="${name}" content="${esc(wert)}" />`;
    out = re.test(out) ? out.replace(re, neu) : out.replace("</head>", `    ${neu}\n  </head>`);
  };
  setz("description", "name", kopf.beschreibung);
  setz("og:title", "property", kopf.titel);
  setz("og:description", "property", kopf.beschreibung);
  setz("og:url", "property", kopf.url);
  setz("twitter:title", "name", kopf.titel);
  setz("twitter:description", "name", kopf.beschreibung);
  if (kopf.og?.type) setz("og:type", "property", kopf.og.type);
  // 25.08.2026: `robots` wird ERSETZT, nicht angehaengt. In client/index.html
  // steht bereits `index, follow`. Zwei Angaben nebeneinander sind zwar nach
  // Googles Regel „die strengste gewinnt" ungefaehrlich — andere Crawler
  // halten sich daran aber nicht, und /login stand dann live auf „index".
  setz("robots", "name", kopf.robots || "index,follow,max-image-preview:large");
  const extra = [
    `<link rel="canonical" href="${esc(kopf.url)}" />`,
    ...(kopf.ld ?? []).map((l) => `<script type="application/ld+json">${JSON.stringify(l).replace(/</g, "\\u003c")}</script>`),
  ].join("\n    ");
  return out.replace("</head>", `    ${extra}\n  </head>`);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITEN
//
// Regeln, nach denen diese Texte geschrieben sind:
//  · Titel höchstens ~60 Zeichen, sonst schneidet Google ab. Das WICHTIGSTE
//    Wort steht vorn — hinten steht die Marke.
//  · Beschreibung 140–158 Zeichen: ein Nutzenversprechen und ein Grund zu
//    klicken. Keine Aufzählung von Stichwörtern; Google schreibt sie sonst um.
//  · Kein „berät", keine „Garantie" (AGENTS.md), Kunden werden gesiezt.
//  · Jede Beschreibung ist EINMALIG. Zwei gleiche wären wieder derselbe Fehler.
// ═══════════════════════════════════════════════════════════════════════════
export interface SeitenKopf { titel: string; beschreibung: string; robots?: string }

export const SEITEN: Record<string, SeitenKopf> = {
  "/": {
    titel: "FIAON — Bonität verstehen und verbessern",
    beschreibung: "Erfahren Sie, was Auskunfteien über Sie gespeichert haben, welche Einträge angreifbar sind und was Sie konkret tun können. Persönliche Begleitung statt Formularflut.",
  },
  "/was-ist-fiaon": {
    titel: "Was ist FIAON? Ablauf und Leistungen erklärt",
    beschreibung: "Von der ersten Auskunft bis zum bereinigten Eintrag: Wie FIAON arbeitet, was in jedem Schritt passiert und woran Sie erkennen, dass es vorangeht.",
  },
  "/privatkunden": {
    titel: "Bonität für Privatpersonen — Ihre Möglichkeiten",
    beschreibung: "Negativeintrag, abgelehnter Kredit, keine Ratenzahlung mehr möglich? Wir prüfen Ihre Auskunft, benennen die angreifbaren Punkte und begleiten Sie durch die Korrektur.",
  },
  "/business": {
    titel: "Firmenbonität prüfen und verbessern — FIAON",
    beschreibung: "Schlechte Firmenbonität kostet Lieferantenkredite und Aufträge. Wir prüfen Ihre Einträge bei Creditreform, Bürgel und SCHUFA und begleiten die Bereinigung.",
  },
  "/bonitaet": {
    titel: "Bonitätsauskunft anfordern — so geht es",
    beschreibung: "Ihre vollständige Auskunft mit Erklärung: welcher Eintrag woher stammt, wie lange er bleibt und welcher davon angreifbar ist. In verständlichem Deutsch.",
  },
  "/preise": {
    titel: "Preise und Pakete — FIAON",
    beschreibung: "Alle Pakete auf einen Blick: was enthalten ist, was es kostet und was Sie dafür bekommen. Feste Beträge, keine versteckten Posten, monatlich zahlbar.",
  },
  "/kreditkarte": {
    titel: "Kreditkarte trotz negativem Eintrag",
    beschreibung: "Welche Karten es ohne Bonitätsprüfung wirklich gibt, was sie kosten und worauf Sie achten sollten. Ehrlich verglichen, mit den Nachteilen.",
  },
  "/banking": {
    titel: "Girokonto trotz negativem Eintrag eröffnen",
    beschreibung: "Das Basiskonto steht Ihnen per Gesetz zu — auch mit Eintrag. Welche Bank wie schnell eröffnet, was sie prüft und wie Sie den Antrag richtig stellen.",
  },
  "/kontakt": {
    titel: "Kontakt — FIAON erreichen",
    beschreibung: "Schreiben Sie uns Ihr Anliegen, oder lassen Sie sich zurückrufen. Wir melden uns werktags innerhalb eines Arbeitstags mit einer konkreten Einschätzung.",
  },
  "/team": {
    titel: "Das Team hinter FIAON",
    beschreibung: "Wer bei FIAON arbeitet, woher wir kommen und warum wir dieses Unternehmen aufgebaut haben. Menschen mit Namen und Gesicht, kein Callcenter.",
  },
  "/karriere": {
    titel: "Karriere bei FIAON — offene Stellen",
    beschreibung: "Wir suchen Menschen, die zuhören können und Zahlen verstehen. Was Sie bei uns erwartet, wie wir arbeiten und wie Sie sich bewerben.",
  },
  "/partner": {
    titel: "Partner werden — Zusammenarbeit mit FIAON",
    beschreibung: "Für Vermittler, Kanzleien und Unternehmen: Wie eine Zusammenarbeit mit FIAON aussieht, welche Konditionen gelten und wie der gemeinsame Ablauf funktioniert.",
  },
  "/presse": {
    titel: "Presse — Material und Ansprechpartner",
    beschreibung: "Pressemitteilungen, Bildmaterial und Zahlen zu FIAON. Für Anfragen erreichen Sie unsere Ansprechpartner direkt.",
  },
  "/oesterreich": {
    titel: "Bonität in Österreich — KSV1870 und CRIF",
    beschreibung: "Wie KSV1870 und CRIF Ihre Bonität bewerten, welche Fristen in Österreich gelten und wie Sie einen falschen Eintrag löschen lassen.",
  },
  "/schweiz": {
    titel: "Bonität in der Schweiz — ZEK und CRIF",
    beschreibung: "Betreibungsregister, ZEK und CRIF: Was in der Schweiz über Sie gespeichert ist, wie lange es bleibt und welche Einträge sich entfernen lassen.",
  },
  "/sicherheit": {
    titel: "Datensicherheit bei FIAON",
    beschreibung: "Wo Ihre Daten liegen, wer sie sehen kann und wie lange wir sie aufbewahren. Server in Frankfurt, Verschlüsselung, klare Löschfristen.",
  },
  "/ratgeber": { titel: "", beschreibung: "" }, // hat einen eigenen Vorrenderer

  // ── Werkzeuge: jedes beantwortet EINE Suchfrage ───────────────────────────
  "/werkzeuge/verjaehrung": {
    titel: "Verjährungsrechner — ist Ihre Schuld verjährt?",
    beschreibung: "Geben Sie das Datum der letzten Zahlung ein und sehen Sie sofort, wann die Forderung verjährt und was eine Mahnung daran ändert. Kostenlos, ohne Anmeldung.",
  },
  "/werkzeuge/loeschfrist": {
    titel: "Löschfrist-Rechner: Wann verschwindet der Eintrag?",
    beschreibung: "Erledigte Forderung, Inkasso, Insolvenz: Rechnen Sie aus, wann Ihr Eintrag bei der Auskunftei gelöscht wird — und wann Sie ihn früher angreifen können.",
  },
  "/werkzeuge/inkassokosten": {
    titel: "Inkassokosten prüfen — was ist erlaubt?",
    beschreibung: "Inkassobüros rechnen häufig zu viel ab. Prüfen Sie in einer Minute, welcher Betrag bei Ihrer Forderung gesetzlich zulässig ist und was Sie streichen können.",
  },
  "/werkzeuge/selbstauskunft": {
    titel: "Selbstauskunft kostenlos anfordern — Anleitung",
    beschreibung: "Ihre Datenkopie nach Artikel 15 DSGVO ist kostenlos. Hier steht, an wen Sie schreiben, was hineingehört und wie lange die Auskunftei Zeit hat.",
  },
  "/werkzeuge/eintrag-pruefen": {
    titel: "Ist Ihr Eintrag angreifbar? Kurzprüfung",
    beschreibung: "Nicht jeder Negativeintrag ist rechtmäßig. Beantworten Sie ein paar Fragen und erfahren Sie, ob Ihrer die formalen Anforderungen überhaupt erfüllt.",
  },
  "/werkzeuge/spielraum": {
    titel: "Haushaltsrechner — was bleibt Ihnen monatlich?",
    beschreibung: "Einnahmen gegen Ausgaben: Sehen Sie, welcher Betrag Ihnen wirklich bleibt und welche Rate realistisch ist, bevor Sie etwas zusagen.",
  },
  "/werkzeuge/karten-check": {
    titel: "Karten-Check: Welche Karte bekommen Sie?",
    beschreibung: "Prepaid, Debit oder echte Kreditkarte — welche Sie mit Ihrer aktuellen Bonität realistisch bekommen und was sie im Jahr kostet.",
  },

  // ── Rechtliches: indexierbar, aber nicht beworben ────────────────────────
  "/impressum": { titel: "Impressum — FIAON", beschreibung: "Anbieterkennzeichnung nach § 5 TMG: FIAON LTD, Anschrift, Vertretung, Registereintrag und Kontaktmöglichkeiten." },
  "/privacy": { titel: "Datenschutzerklärung — FIAON", beschreibung: "Welche Daten wir verarbeiten, auf welcher Rechtsgrundlage, wie lange wir sie speichern und welche Rechte Sie nach der DSGVO haben." },
  "/agb": { titel: "Allgemeine Geschäftsbedingungen — FIAON", beschreibung: "Die Bedingungen für unsere Leistungen: Vertragsschluss, Laufzeit, Zahlung, Kündigung und Haftung — vollständig zum Nachlesen." },
  "/terms": { titel: "Nutzungsbedingungen — FIAON", beschreibung: "Die Bedingungen für die Nutzung dieser Website und des Kundenbereichs." },
  "/widerrufsbelehrung": { titel: "Widerrufsbelehrung — FIAON", beschreibung: "Ihr Widerrufsrecht als Verbraucher: Frist, Form, Folgen des Widerrufs und das Muster-Widerrufsformular." },
  "/cookie-einstellungen": { titel: "Cookie-Einstellungen — FIAON", beschreibung: "Entscheiden Sie selbst, welche Cookies gesetzt werden. Notwendige Cookies lassen sich nicht abwählen, alle anderen jederzeit widerrufen.", robots: "noindex,follow" },

  // ── Kein Suchziel: Formulare, Konto, interne Wege ────────────────────────
  "/login": { titel: "Anmelden — FIAON", beschreibung: "Melden Sie sich in Ihrem FIAON-Kundenbereich an.", robots: "noindex,follow" },
  "/passwort-vergessen": { titel: "Passwort vergessen — FIAON", beschreibung: "Setzen Sie Ihr Passwort für den FIAON-Kundenbereich zurück.", robots: "noindex,follow" },
  "/antrag": { titel: "Antrag stellen — FIAON", beschreibung: "Ihr Antrag bei FIAON in wenigen Schritten.", robots: "noindex,follow" },
  "/business-antrag": { titel: "Firmenantrag — FIAON", beschreibung: "Ihr Firmenantrag bei FIAON.", robots: "noindex,follow" },
  "/bonitaet-antrag": { titel: "Bonitätsauskunft beantragen — FIAON", beschreibung: "Beantragen Sie Ihre Bonitätsauskunft bei FIAON.", robots: "noindex,follow" },
  "/bonitaet-danke": { titel: "Vielen Dank — FIAON", beschreibung: "Ihre Anfrage ist bei uns eingegangen.", robots: "noindex,follow" },
  "/abo-kuendigen": { titel: "Kündigung — FIAON", beschreibung: "Kündigen Sie Ihr FIAON-Abonnement.", robots: "noindex,follow" },
  "/karte-sichern": { titel: "Karte sichern — FIAON", beschreibung: "Sichern Sie sich Ihre Karte über FIAON.", robots: "noindex,follow" },
  "/investoren": { titel: "Investoren — FIAON", beschreibung: "Informationen für Investoren.", robots: "noindex,follow" },
  "/datenraum": { titel: "Datenraum — FIAON", beschreibung: "Vertraulicher Datenraum.", robots: "noindex,nofollow" },
  "/plattform-konzept": { titel: "Plattform-Konzept — FIAON", beschreibung: "Das Konzept hinter der FIAON-Plattform.", robots: "noindex,follow" },
  "/demo": { titel: "Demo — FIAON", beschreibung: "Sehen Sie sich FIAON unverbindlich an.", robots: "noindex,follow" },
  "/demo/produkt": { titel: "Produkt-Demo — FIAON", beschreibung: "Die Produktansicht von FIAON.", robots: "noindex,follow" },
  "/start": { titel: "Start — FIAON", beschreibung: "Ihr Einstieg bei FIAON.", robots: "noindex,follow" },
  "/mein-bereich": { titel: "Mein Bereich — FIAON", beschreibung: "Ihr persönlicher Bereich bei FIAON.", robots: "noindex,follow" },
  // Vertraulich: Ein Vertrag gehoert nie in einen Suchindex.
  "/vereinbarung": { titel: "Vertrauliches Dokument — FIAON", beschreibung: "Diese Seite ist geschützt.", robots: "noindex,nofollow" },
  // Fremder Datenraum: gehoert weder in unseren Index noch in unsere Sitemap.
  "/scp-datenraum": { titel: "Datenraum", beschreibung: "Vertraulicher Zugang.", robots: "noindex,nofollow" },
};

/** Die Seiten, die in die Sitemap gehören — alles, was nicht auf noindex steht. */
export function indexierbareSeiten(): string[] {
  return Object.entries(SEITEN)
    .filter(([, k]) => !String(k.robots ?? "").includes("noindex") && k.titel)
    .map(([pfad]) => pfad);
}

/** Fertiges HTML für eine öffentliche Seite — oder null, wenn sie hier nicht geführt wird. */
export function seitenHtml(pfad: string): string | null {
  const kopf = SEITEN[pfad];
  if (!kopf || !kopf.titel) return null;
  const html = indexHtml();
  if (!html) return null;
  const url = `${BASIS}${pfad === "/" ? "/" : pfad}`;
  const ld: unknown[] = [
    { "@context": "https://schema.org", "@type": "Organization", name: "FIAON", url: BASIS,
      logo: { "@type": "ImageObject", url: `${BASIS}/icon-maskable-512.png` },
      areaServed: ["DE", "AT", "CH"], knowsLanguage: "de" },
  ];
  if (pfad === "/") {
    ld.push({ "@context": "https://schema.org", "@type": "WebSite", name: "FIAON", url: BASIS, inLanguage: "de" });
  } else {
    ld.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "FIAON", item: BASIS },
      { "@type": "ListItem", position: 2, name: kopf.titel.split(" — ")[0].split(" · ")[0], item: url },
    ] });
  }
  return kopfEinsetzen(html, { titel: kopf.titel, beschreibung: kopf.beschreibung, url, ld, robots: kopf.robots });
}
