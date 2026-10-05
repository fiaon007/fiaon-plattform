import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import KarrierePopup from "@/components/site/KarrierePopup";
import { UI } from "@shared/fiaon-sprache";
import { schwesterPfad } from "@shared/fiaon-seo-seiten";
import { useSprache, inSprache } from "@/i18n/sprache";
import { globalMenue } from "@shared/fiaon-global-menue";
import GlobalNav from "@/components/site/GlobalNav";
import { useBusinessBereich } from "@/lib/bereich";
import { FiaonWortmarke, MARKE_NAVY } from "@/components/marke/FiaonWortmarke";

interface GlassNavProps {
  /** Erzwingt den Rahmen von FIAON Global — z. B. die Zahlungsseite eines Firmenauftrags ohne ?bereich=business. */
  bereich?: "business";
  // 25.09.2026 (E-241): „bonitaetsauskunft" — die Seitenfamilie unter /bonitaetsauskunft hebt ihren Menüpunkt hervor.
  activePage?: "startseite" | "privatkunden" | "business" | "was-ist-fiaon" | "plattform-konzept" | "login" | "investoren" | "karriere" | "presse" | "partner" | "datenraum" | "team" | "demo" | "ratgeber" | "kontakt" | "bonitaetsauskunft";
}

/**
 * 19.09.2026: Zwei Welten. Im Business-Bereich (/business, /en/business oder ?bereich=business)
 * zeigt jede Seite den Kopf von FIAON Global — ohne „Konto eröffnen", Login und Privatkunden-Themen
 * (Justin: „Business-Kunden sollen nicht auf die Privatkunden-Seite"). Sonst die Leiste wie bisher.
 */
export default function GlassNav(props: GlassNavProps) {
  const business = useBusinessBereich() || props.bereich === "business";
  return business ? <GlobalNav /> : <PrivatNav {...props} />;
}

function PrivatNav({ activePage = "startseite" }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mob, setMob] = useState(false);
  // Schließen läuft als kurze Rückwärts-Animation, erst danach verschwindet das Menü (E-289).
  const [mobZu, setMobZu] = useState(false);
  const menueZu = () => { setMobZu(true); window.setTimeout(() => { setMob(false); setMobZu(false); }, 220); };
  useEffect(() => {
    if (!mob) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") menueZu(); };
    window.addEventListener("keydown", taste);
    return () => { document.body.style.overflow = vorher; window.removeEventListener("keydown", taste); };
  }, [mob]);
  const [showModal, setShowModal] = useState(false);
  // Mega-Menü am Rechner: öffnet beim Überfahren der Leiste, schließt mit kurzer Verzögerung
  const [mega, setMega] = useState(false);
  // 19.09.2026 (E-191): „Business" öffnet ein eigenes Panel für FIAON Global — Leistungen,
  // Für wen, Preise und Ablauf, Wissen. Alle anderen Links öffnen das große Menü wie bisher.
  const [panel, setPanel] = useState<"alles" | "business">("alles");
  const megaTimer = useRef<number | null>(null);
  const oeffneMega = () => { if (megaTimer.current) window.clearTimeout(megaTimer.current); setMega(true); };
  const schliesseMega = () => { if (megaTimer.current) window.clearTimeout(megaTimer.current); megaTimer.current = window.setTimeout(() => setMega(false), 180); };
  // leichte 3D-Neigung der Leiste zur Maus
  const leisteRef = useRef<HTMLDivElement>(null);
  const neigen = (e: React.MouseEvent) => {
    const el = leisteRef.current; if (!el) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateZ(0)`;
  };
  const geradeStellen = () => { const el = leisteRef.current; if (el) el.style.transform = ""; };
  // Angemeldete Kunden sehen „Mein Bereich“ statt „Login“ — sonst bleibt alles, wie es war.
  const [eingeloggt, setEingeloggt] = useState(false);
  useEffect(() => {
    let weg = false;
    fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => r.json())
      .then((j) => { if (!weg && j?.eingeloggt) setEingeloggt(true); }).catch(() => {});
    return () => { weg = true; };
  }, []);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // ── Zwei Sprachen, eine Leiste (02.09.2026) ──────────────────────────────
  // Die Sprache kommt aus der Adresse (/en/…). Jeder Link zeigt auf die
  // englische Schwester, wo es sie gibt — sonst auf die deutsche Seite. Der
  // Umschalter führt auf die Schwester DERSELBEN Seite (nicht zur Startseite);
  // hat die Seite noch keine englische Fassung, auf /en.
  const sprache = useSprache();
  const en = sprache === "en";
  const ui = UI[sprache];
  const zu = (href: string) => inSprache(href, sprache);
  const aktuellerPfad = typeof window !== "undefined" ? window.location.pathname : "/";
  // Die Unterseiten von FIAON Global gibt es (noch) nur auf Deutsch — ihr englisches Gegenüber ist die Übersicht.
  const andereSprache = en ? (schwesterPfad(aktuellerPfad, "de") ?? "/") : (schwesterPfad(aktuellerPfad, "en") ?? (aktuellerPfad.startsWith("/business") ? "/en/business" : "/en"));
  const pages = en ? [
    { label: "Home", href: "/en", key: "startseite" },
    { label: "What is FIAON", href: zu("/was-ist-fiaon"), key: "was-ist-fiaon", hasGradient: true },
    { label: "Personal", href: zu("/privatkunden"), key: "privatkunden" },
    { label: "Business", href: zu("/business"), key: "business" },
  ] : [
    { label: "Startseite", href: "/", key: "startseite" },
    { label: "Was ist FIAON", href: "/was-ist-fiaon", key: "was-ist-fiaon", hasGradient: true },
    { label: "Privatkunden", href: "/privatkunden", key: "privatkunden" },
    { label: "Business", href: "/business", key: "business" },
  ];
  // ── Das Handy-Menü in fünf Gruppen (E-289) ─────────────────────────────────
  // „gross“ = die zwei Wege mit Zweitzeile (Privatkunden, dann Unternehmen), „kompakt“ = Kacheln.
  // `start` ist der Versatz der Einblend-Animation (Zeile für Zeile).
  type MenueEintrag = { href: string; label: string; text: string; key: string };
  type MenueGruppe = { titel: string; zusatz?: string; art: "gross" | "kompakt"; eintraege: MenueEintrag[]; start: number };
  const globalPunkte = (pfade: string[]): MenueEintrag[] => globalMenue().flatMap((m) => m.eintraege)
    .filter((e) => pfade.includes(e.pfad)).sort((a, b) => pfade.indexOf(a.pfad) - pfade.indexOf(b.pfad))
    .map((e) => ({ href: e.pfad, label: e.titel, text: e.text, key: e.pfad }));
  const gruppenOhneStart: Omit<MenueGruppe, "start">[] = en ? [
    { titel: "For individuals", art: "gross", eintraege: [
      { href: zu("/privatkunden"), label: "Personal", text: "Plans, process, pricing", key: "privatkunden" },
      { href: zu("/bonitaetsauskunft-beantragen"), label: "Credit report", text: "Your report, obtained and explained by FIAON", key: "bonitaetsauskunft" },
      { href: zu("/werkzeuge/eintrag-pruefen"), label: "Check an entry", text: "Five questions — can your entry be challenged?", key: "werkzeuge" },
    ] },
    { titel: "For companies", zusatz: "FIAON Global", art: "gross", eintraege: [
      { href: zu("/business"), label: "FIAON Global", text: "US company, banking and capital from one source", key: "business" },
    ] },
    { titel: "Learn", art: "kompakt", eintraege: [
      { href: "/en", label: "Home", text: "", key: "startseite" },
      { href: zu("/was-ist-fiaon"), label: "What is FIAON", text: "", key: "was-ist-fiaon" },
      { href: zu("/ratgeber"), label: "Guides", text: "", key: "ratgeber" },
      { href: zu("/kontakt"), label: "Contact & support", text: "", key: "kontakt" },
    ] },
    { titel: "About FIAON", art: "kompakt", eintraege: [
      { href: zu("/team"), label: "Team", text: "", key: "team" },
      { href: zu("/karriere"), label: "Careers", text: "", key: "karriere" },
      { href: zu("/partner"), label: "Partners", text: "", key: "partner" },
      { href: zu("/presse"), label: "Press", text: "", key: "presse" },
      { href: "/investoren", label: "Investors", text: "", key: "investoren" },
    ] },
  ] : [
    { titel: "Für Privatkunden", art: "gross", eintraege: [
      { href: "/privatkunden", label: "Privatkunden", text: "Pakete, Ablauf, Preise", key: "privatkunden" },
      { href: "/bonitaetsauskunft", label: "Bonitätsauskunft", text: "Erklärt, mit Handlungsplan – DE, AT, CH", key: "bonitaetsauskunft" },
      { href: "/werkzeuge/eintrag-pruefen", label: "Eintrag prüfen", text: "Fünf Fragen – ist Ihr Eintrag angreifbar?", key: "werkzeuge" },
      { href: "/termin", label: "Startgespräch buchen", text: "15 Minuten, ein Mensch – kostenlos", key: "termin" },
    ] },
    { titel: "Für Unternehmen", zusatz: "FIAON Global", art: "gross", eintraege: [
      { href: "/business", label: "Übersicht und Pakete", text: "US-Gesellschaft aus einer Hand, Festpreis", key: "business" },
      ...globalPunkte(["/business/us-firmengruendung", "/business/firmenkarten-kapital", "/business/paket-finder"]),
    ] },
    { titel: "Verstehen", art: "kompakt", eintraege: [
      { href: "/", label: "Startseite", text: "", key: "startseite" },
      { href: "/was-ist-fiaon", label: "Was ist FIAON", text: "", key: "was-ist-fiaon" },
      { href: "/ratgeber", label: "Ratgeber", text: "", key: "ratgeber" },
      { href: "/vergleich", label: "Vergleich", text: "", key: "vergleich" },
    ] },
    { titel: "Hilfe", art: "kompakt", eintraege: [
      { href: "/hilfe", label: "Hilfe-Center", text: "", key: "hilfe" },
      { href: "/kontakt", label: "Kontakt & Support", text: "", key: "kontakt" },
      { href: "/status", label: "Status", text: "", key: "status" },
      { href: "/transparenz", label: "Transparenz", text: "", key: "transparenz" },
    ] },
    { titel: "Über FIAON", art: "kompakt", eintraege: [
      { href: "/ueber-uns", label: "Über uns", text: "", key: "ueber-uns" },
      { href: "/team", label: "Team", text: "", key: "team" },
      { href: "/karriere", label: "Karriere", text: "", key: "karriere" },
      { href: "/partner", label: "Partner", text: "", key: "partner" },
      { href: "/presse", label: "Presse", text: "", key: "presse" },
      { href: "/investoren", label: "Investoren", text: "", key: "investoren" },
    ] },
  ];
  // Wer von einer Business-Seite kommt, sieht FIAON Global zuerst.
  const sortiert = activePage === "business" ? [gruppenOhneStart[1], gruppenOhneStart[0], ...gruppenOhneStart.slice(2)] : gruppenOhneStart;
  let zeile = 1;
  const menueGruppen: MenueGruppe[] = sortiert.map((g) => {
    const start = zeile;
    zeile += 1 + (g.art === "gross" ? g.eintraege.length : Math.ceil(g.eintraege.length / 2));
    return { ...g, start };
  });

  /** Der Umschalter: ein Glas-Chip „DE | EN" — rechts neben dem Login, am Handy die erste Zeile. */
  const SprachChip = ({ breit = false }: { breit?: boolean }) => (
    <a href={andereSprache} hrefLang={en ? "de" : "en"} lang={en ? "de" : "en"} title={ui.zurAnderenSprache} aria-label={ui.zurAnderenSprache}
       className={`nav-sprache${breit ? " breit" : ""}`} data-fiaon="sprachwechsel">
      <span className={en ? "" : "an"}>DE</span><i aria-hidden="true">|</i><span className={en ? "an" : ""}>EN</span>
    </a>
  );

  const handleAntragClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMob(false);
    setShowModal(true);
  };

  return (
    <>
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-all duration-500"
      >
        {/* z-[45]: Die Leiste mit dem Schließen-Kreuz liegt über dem Schleier des Handy-Menüs (z-40). */}
        <div className="relative z-[45] max-w-[1000px] mx-auto px-4 sm:px-6 py-3">
          {/* Glass pill container */}
          <div
            ref={leisteRef}
            className={`fiaon-glass-nav nav-3d rounded-full ${scrolled ? "shadow-lg" : ""}`}
            onMouseEnter={oeffneMega} onMouseLeave={() => { schliesseMega(); geradeStellen(); }} onMouseMove={neigen}
          >
            {/* Drei Zonen in einer Zeile: Marke · Links (nehmen den Platz dazwischen) · Knöpfe.
                Die Links sind NICHT mehr absolut zentriert — so können sie bei schmalen
                Fenstern nicht über Marke oder Knöpfe laufen. Unter 1024px: Hamburger. */}
            <div className="relative z-10 h-[72px] px-5 flex items-center justify-between gap-4">
              {/* Logo */}
              <a href={en ? "/en" : "/"} className="flex items-center shrink-0">
                <FiaonWortmarke className="text-[18px] sm:text-xl" farbe={MARKE_NAVY} />
              </a>

              {/* Desktop: Links in der Mitte — das volle Menü öffnet sich beim Überfahren der Leiste */}
              <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-1 min-w-0 whitespace-nowrap">
                {pages.map((p) => (
                  <a key={p.key} href={p.href}
                     onMouseEnter={() => setPanel(p.key === "business" && !en ? "business" : "alles")}
                     onFocus={() => { if (p.key === "business" && !en) { setPanel("business"); oeffneMega(); } }}
                     aria-haspopup={p.key === "business" && !en ? "true" : undefined}
                     className={`relative text-[13px] font-medium pb-0.5 transition-colors duration-300 ${activePage === p.key ? "text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>
                    {p.hasGradient ? <>{en ? "What is " : "Was ist "}<span className="fiaon-gradient-text-animated">FIAON</span></> : p.label}
                    {activePage === p.key && <span className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 6px rgba(37,99,235,.4)" }} />}
                  </a>
                ))}
              </div>

              {/* Desktop: CTA buttons */}
              <div className="hidden lg:flex items-center gap-3 shrink-0 whitespace-nowrap">
                <button
                  onClick={handleAntragClick}
                  className="fiaon-btn-outline-animated px-5 py-2 text-[13px] font-medium relative overflow-hidden group"
                >
                  <span className="relative z-10 group-hover:text-white transition-colors duration-300">{ui.kontoEroeffnen}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  </div>
                </button>
                <a
                  href={eingeloggt ? "/dashboard" : "/login"}
                  className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {eingeloggt ? ui.meinBereich : ui.login}
                </a>
                <SprachChip />
              </div>

              {/* Mobile hamburger */}
              <button
                type="button"
                className={`nav-burger lg:hidden${mob && !mobZu ? " auf" : ""}`}
                onClick={() => (mob ? menueZu() : setMob(true))}
                aria-label={mob ? ui.menueZu : ui.menueAuf}
                aria-expanded={mob}
              >
                <i /><i /><i />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop: Mega-Menü — alle Seiten, öffnet beim Überfahren der Leiste */}
        <div className={`hidden lg:block nav-mega ${mega ? "auf" : ""}${panel === "business" && !en ? " global" : ""}`} onMouseEnter={oeffneMega} onMouseLeave={schliesseMega} aria-hidden={!mega}>
          {panel === "business" && !en ? (
            <div className="nav-mega-innen nav-global">
              <div className="nav-global-kopf">
                <div>
                  <p className="nav-mega-titel" style={{ margin: 0 }}>FIAON Global</p>
                  <p className="nav-global-satz">US-Gesellschaft aus einer Hand — für Unternehmen und Privatpersonen. Festpreis, alles inklusive.</p>
                </div>
                <a href="/business" className="nav-global-link">Zur Übersicht<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>
              </div>
              {globalMenue().map((g) => (
                <div key={g.gruppe} className="nav-mega-gruppe">
                  <p className="nav-mega-titel">{g.titel}</p>
                  {g.eintraege.map((e) => (
                    <a key={e.pfad} href={e.pfad} className="nav-mega-eintrag" data-an={aktuellerPfad === e.pfad ? "1" : undefined} tabIndex={mega ? 0 : -1}>
                      <span className="label">{e.titel}</span>
                      <span className="text">{e.text}</span>
                    </a>
                  ))}
                </div>
              ))}
              <div className="nav-global-fuss">
                <span className="orte"><b>London</b> Vertragspartner<i aria-hidden="true">·</i><b>Zürich</b> Kapital-Etappe<i aria-hidden="true">·</i><b>Miami</b> Team vor Ort</span>
                <span className="tun">
                  <a href="/business/paket-finder" className="nav-mega-knopf still" tabIndex={mega ? 0 : -1}>Paket-Finder</a>
                  <a href="/business#gespraech" className="nav-mega-knopf" tabIndex={mega ? 0 : -1}>Gespräch vereinbaren</a>
                </span>
              </div>
            </div>
          ) : (
          <div className="nav-mega-innen">
            {(en ? [
              { titel: "For customers", eintraege: [
                { href: "/en", label: "Home", text: "Insight · Action · Access" },
                { href: zu("/was-ist-fiaon"), label: "What is FIAON", text: "The vision, explained properly" },
                { href: zu("/privatkunden"), label: "Personal", text: "Plans, process, pricing" },
                // E-241: die englische Seite zur Auskunft (die Familie /bonitaetsauskunft gibt es nur auf Deutsch).
                { href: zu("/bonitaetsauskunft-beantragen"), label: "Credit report", text: "Your report, obtained by FIAON" },
                { href: zu("/business"), label: "Business", text: "FIAON Global: US company, banking, capital" },
              ] },
              { titel: "Company", eintraege: [
                { href: zu("/team"), label: "Team", text: "Who builds FIAON" },
                { href: zu("/karriere"), label: "Careers", text: "Work for FIAON from home" },
                { href: zu("/partner"), label: "Partners", text: "Banks, credit bureaus, intermediaries" },
                { href: zu("/presse"), label: "Press", text: "Facts, figures, contacts" },
                { href: "/investoren", label: "Investors", text: "The model, the data room" },
                { href: zu("/datenraum"), label: "Data room", text: "Due diligence on request" },
              ] },
            ] : [
              { titel: "Für Kunden", eintraege: [
                { href: "/", label: "Startseite", text: "Einsicht · Aktion · Zugang" },
                { href: "/was-ist-fiaon", label: "Was ist FIAON", text: "Die Vision, genau erklärt" },
                { href: "/privatkunden", label: "Privatkunden", text: "Pakete, Ablauf, Preise" },
                // 25.09.2026 (E-241): der Menüpunkt führt auf die Übersicht der Seitenfamilie (/bonitaet leitet dorthin).
                { href: "/bonitaetsauskunft", label: "Bonitätsauskunft", text: "Erklärt, mit Handlungsplan – DE, AT, CH" },
                { href: "/business", label: "Business", text: "FIAON Global: US-Gesellschaft, Bankzugang, Kapital" },
                { href: "/termin", label: "Startgespräch buchen", text: "15 Minuten, ein Mensch – kostenlos" },
                { href: "/hilfe", label: "Hilfe-Center", text: "Antworten zu Antrag, Zahlung, Auskunft" },
                { href: "/vergleich", label: "Vergleich", text: "Anwalt, App, selbst – oder FIAON?" },
              ] },
              { titel: "Unternehmen", eintraege: [
                { href: "/team", label: "Team", text: "Wer FIAON baut" },
                { href: "/karriere", label: "Karriere", text: "Von zuhause für FIAON arbeiten" },
                { href: "/partner", label: "Partner", text: "Banken, Auskunfteien, Vermittler" },
                { href: "/presse", label: "Presse", text: "Fakten, Zahlen, Ansprechpartner" },
                { href: "/investoren", label: "Investoren", text: "Das Modell, der Datenraum" },
                { href: "/datenraum", label: "Datenraum", text: "Due Diligence auf Anfrage" },
                { href: "/ueber-uns", label: "Über FIAON", text: "Geschichte, Meilensteine, Haltung" },
                { href: "/transparenz", label: "Transparenzbericht", text: "Zahlen mit Definition und Stand" },
                { href: "/status", label: "Status", text: "Läuft FIAON gerade? Live geprüft" },
              ] },
            ]).map((g) => (
              <div key={g.titel} className="nav-mega-gruppe">
                <p className="nav-mega-titel">{g.titel}</p>
                {g.eintraege.map((e) => (
                  <a key={e.href} href={e.href} className="nav-mega-eintrag" data-an={activePage === e.href.replace("/", "") || (e.href === "/" && activePage === "startseite") ? "1" : undefined}>
                    <span className="label">{e.label}</span>
                    <span className="text">{e.text}</span>
                  </a>
                ))}
              </div>
            ))}
            <div className="nav-mega-gruppe nav-mega-konto">
              <p className="nav-mega-titel">{ui.ihrKonto}</p>
              <p className="nav-mega-satz">{ui.kontoSatz}</p>
              <button type="button" onClick={handleAntragClick} className="nav-mega-knopf">{ui.kontoEroeffnen}</button>
              <a href={eingeloggt ? "/dashboard" : "/login"} className="nav-mega-knopf still">{eingeloggt ? ui.meinBereich : ui.login}</a>
              <p className="nav-mega-fuss">{ui.vertrauen}</p>
            </div>
          </div>
          )}
        </div>

        {/* ── Handy-Menü (E-289, 05.10.2026; Justin: „sinnvoller sortieren, Business zur Ergänzung,
            Animation beim Öffnen, transparenter“). Vorher: zwei lange Listen mit 19 Zeilen, Business mitten
            unter den Privatkunden-Themen und ein zweites Mal ganz unten. Jetzt: zuerst die zwei Wege
            (Privatkunden, dann Unternehmen · FIAON Global) groß mit Zweitzeile, darunter Wissen, Hilfe und
            Über FIAON als ruhige Kacheln. Die Karte wächst aus dem Menüknopf auf, die Zeilen folgen versetzt,
            Schließen läuft rückwärts. Klareres Glas, die Seite schimmert durch. */}
        {mob && (
          <div className={`mm lg:hidden${mobZu ? " zu" : ""}`}>
            <button type="button" aria-label={ui.menueZu} onClick={menueZu} className="mm-schleier" />
            <div className="mm-karte" role="dialog" aria-modal="true" aria-label={en ? "Menu" : "Menü"}>
              <div className="mm-rolle">
                {/* Die Sprache steht ganz oben — nie verdeckt, nie abgeschnitten (Justin, 02.09.2026). */}
                <div className="mm-sprache mm-zeile" style={{ ["--i" as string]: 0 }}>
                  <span>{ui.sprache}</span>
                  <SprachChip breit />
                </div>
                {menueGruppen.map((g) => (
                  <section key={g.titel} className="mm-gruppe">
                    <p className="mm-titel mm-zeile" style={{ ["--i" as string]: g.start }}>
                      {g.titel}{g.zusatz && <span className="mm-zusatz">{g.zusatz}</span>}
                    </p>
                    {g.art === "gross" ? (
                      <div className="mm-liste">
                        {g.eintraege.map((e, i) => (
                          <a key={e.href} href={e.href} onClick={() => setMob(false)} className={`mm-weg mm-zeile${activePage === e.key ? " aktiv" : ""}`}
                             style={{ ["--i" as string]: g.start + 1 + i }} aria-current={activePage === e.key ? "page" : undefined}>
                            <span className="min-w-0"><b>{e.label}</b><small>{e.text}</small></span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="mm-kacheln">
                        {g.eintraege.map((e, i) => (
                          <a key={e.href} href={e.href} onClick={() => setMob(false)} className={`mm-kachel mm-zeile${activePage === e.key ? " aktiv" : ""}`}
                             style={{ ["--i" as string]: g.start + 1 + Math.floor(i / 2) }} aria-current={activePage === e.key ? "page" : undefined}>{e.label}</a>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <div className="mm-fuss">
                <button onClick={(e) => { setMob(false); handleAntragClick(e); }} className="mm-knopf haupt">
                  {ui.kontoEroeffnen}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
                <a href={eingeloggt ? "/dashboard" : "/login"} className="mm-knopf">{eingeloggt ? ui.meinBereich : ui.login}</a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Modal: Privatkunde oder Geschäftskunde */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" style={{ animation: "modalFadeIn .2s ease" }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setShowModal(false)}
          />
          {/* Panel */}
          <div
            className="relative w-full sm:max-w-[440px] bg-white rounded-t-[28px] sm:rounded-[28px] px-6 pt-5 pb-7 sm:p-8 sm:mx-4 overflow-hidden"
            style={{
              boxShadow: "0 30px 80px rgba(15,23,42,.28)",
              animation: "sheetUp .38s cubic-bezier(.22,1,.36,1)",
            }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[380px] h-[240px]" style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,.12), transparent 70%)" }} />
            </div>

            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Schließen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="relative z-10">
              {/* Drag handle (mobile) */}
              <div className="sm:hidden w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

              <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#2563eb] text-[11px] font-bold uppercase tracking-[.16em] mb-4">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-[#2563eb] opacity-60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
                  </span>
                  Konto eröffnen
                </div>
                <h3 className="text-[24px] font-semibold tracking-tight text-gray-900 leading-snug">
                  Wie möchten Sie <span className="fiaon-gradient-text-animated">fortfahren</span>?
                </h3>
              </div>

              <div className="space-y-3">
                {/* Privatkunde */}
                <a
                  href="/antrag"
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(37,99,235,.28)] group-hover:scale-105 transition-transform duration-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15.5px] font-semibold text-gray-900">Als Privatkunde</p>
                    <p className="text-[13px] text-gray-500">Kreditkarte für persönliche Nutzung</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </a>

                {/* Geschäftskunde */}
                <Link
                  href="/business"
                  onClick={() => setShowModal(false)}
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(30,64,175,.28)] group-hover:scale-105 transition-transform duration-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15.5px] font-semibold text-gray-900">Als Geschäftskunde</p>
                    <p className="text-[13px] text-gray-500">FIAON Global: US-Gesellschaft, Bankzugang, Kapital</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Kostenlos &amp; unverbindlich · SSL-verschlüsselt
              </div>
            </div>
          </div>
        </div>
      )}
      <KarrierePopup />
    </>
  );
}
