// ═══════════════════════════════════════════════════════════════════════════
// DIE FUSSZEILE DER BUSINESS-WELT — FIAON GLOBAL (19.09.2026)
//
// Wie der Kopf (GlobalNav.tsx): nur FIAON Global. Keine Ratgeber zu Einträgen,
// keine Privatkunden-Pakete, kein Kundenbereich der Bonitätslinie. Dafür, was
// ein Geschäftskunde am Ende einer Seite sucht: alle Themen, die drei Standorte
// mit Gesellschaft, der Vertragspartner mit Registernummer, die Verbindung der
// Partner offen gesagt, und die Rechtsseiten — die gemeinsamen öffnen mit
// ?bereich=business, damit auch dort der Business-Rahmen steht (lib/bereich.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useSprache } from "@/i18n/sprache";
import { globalMenue } from "@shared/fiaon-global-menue";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN, standortNachweis } from "@shared/fiaon-global-partner";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { schwesterPfad } from "@shared/fiaon-seo-seiten";
import { mitBereich } from "@/lib/bereich";
import { GlobalMarke } from "@/components/site/GlobalNav";
import "@/styles/global-rahmen.css";

const EN = {
  satz: "Your US company from one source — for companies and private individuals. Fixed price, everything included.",
  gespraech: "Arrange a call", beauftragen: "Order now", auftrag: "My order",
  themen: [
    { titel: "FIAON Global", eintraege: [["/en/business#leistungen", "Services"], ["/en/business#pakete", "Packages and prices"], ["/en/business#ablauf", "How it works"], ["/en/business#fragen", "FAQ"], ["/en/business/auftrag", "My order"]] },
  ],
  orte: { london: "Contracting party", zuerich: "Capital stage partner", miami: "Team on the ground" },
  verbunden: "Schwarzott Capital Partners AG and Schwarzott Global LLC are connected to FIAON through our founder Justin Schwarzott. Your contracting party is always FIAON LTD.",
  recht: [["/impressum", "Legal notice"], ["/datenschutz", "Privacy policy"], ["/cookie-einstellungen", "Cookie settings"]],
  registriert: "Registered in England and Wales",
  keineBank: "FIAON is neither a bank nor a law firm. Accounts, cards and loans are decided solely by the institutions; tax and legal questions are handled by our partners under your engagement.",
} as const;

// 19.09.2026 (E-192): Ein Paket heißt „Global Banking" — „Bank" in einer Bezeichnung ist nach § 39 KWG Kreditinstituten
// vorbehalten, außer der Zusammenhang schließt den Anschein von Bankgeschäften aus (§ 41 KWG). Dieser Satz steht
// deshalb auf jeder Seite der Business-Welt, direkt beim Vertragspartner.
const KEINE_BANK = "FIAON ist keine Bank und keine Kanzlei. Über Konten, Karten und Darlehen entscheiden allein die Institute; Steuer- und Rechtsfragen klären unsere Partner auf Ihr Mandat.";

const DE_ORTE = { london: "Vertragspartner", zuerich: "Partner Kapital-Etappe", miami: "Team vor Ort" } as const;

export default function GlobalFuss() {
  const sprache = useSprache();
  const en = sprache === "en";
  const jahr = new Date().getFullYear();
  const recht: [string, string][] = en
    ? EN.recht.map(([p, l]) => [schwesterPfad(p, "en") ?? p, l])
    : [["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"], ["/cookie-einstellungen", "Cookie-Einstellungen"], ["/business/widerrufsbelehrung", "Widerrufsbelehrung"], ["/business/mustervertrag", "Mustervertrag"]];
  // Die Business-eigenen Rechtsseiten tragen den Rahmen ohnehin; die gemeinsamen bekommen ?bereich=business.
  const rechtHref = (p: string) => (p.startsWith("/business") ? p : mitBereich(p));

  return (
    <footer className="gf" aria-label={en ? "FIAON Global — footer" : "FIAON Global — Fußzeile"}>
      <div className="gf-rahmen">
        <div className="gf-oben">
          <div className="gf-marke">
            <GlobalMarke en={en} hell />
            <p>{en ? EN.satz : "US-Gesellschaft aus einer Hand — für Unternehmen und Privatpersonen. Festpreis, alles inklusive."}</p>
            <div className="gf-tun">
              <a href={en ? "/en/business#gespraech" : "/business#gespraech"} className="gf-knopf">{en ? EN.gespraech : "Gespräch vereinbaren"}</a>
              <a href={globalStartPfad(undefined, en ? "en" : "de")} className="gf-knopf hell">{en ? EN.beauftragen : "Beauftragen"}</a>
            </div>
            <p className="gf-kontakt">
              <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a>
              <span aria-hidden="true">·</span>
              <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a>
              <span aria-hidden="true">·</span>
              <a href={en ? "/en/business/auftrag" : "/business/auftrag"}>{en ? EN.auftrag : "Mein Auftrag"}</a>
            </p>
          </div>

          <nav className="gf-themen" aria-label={en ? "Topics" : "Themen"}>
            {(en ? EN.themen.map((g) => ({ titel: g.titel, eintraege: g.eintraege.map(([pfad, titel]) => ({ pfad, titel })) })) : globalMenue()).map((g) => (
              <div key={g.titel} className="gf-spalte">
                <p className="gf-titel">{g.titel}</p>
                <ul>{g.eintraege.map((e) => <li key={e.pfad}><a href={e.pfad}>{e.titel}</a></li>)}</ul>
              </div>
            ))}
          </nav>
        </div>

        <ul className="gf-orte" aria-label={en ? "Locations" : "Standorte"}>
          {GLOBAL_STANDORTE.map((o) => (
            <li key={o.schluessel}>
              <span className="gf-stadt">{o.stadt}</span>
              <b>{o.gesellschaft}</b>
              <span>{en ? EN.orte[o.schluessel] : DE_ORTE[o.schluessel]} · {standortNachweis(o)}</span>
            </li>
          ))}
        </ul>

        <div className="gf-unten">
          <div className="gf-firma">
            <p>© {jahr} {FIAON_FIRMA.name} · {en ? EN.registriert : "Eingetragen in England und Wales"}, Company No. {FIAON_FIRMA.companyNo} · {FIAON_FIRMA.strasse}, {FIAON_FIRMA.ortZeile}</p>
            <p className="gf-verbunden">{en ? EN.keineBank : KEINE_BANK}</p>
            <p className="gf-verbunden">{en ? EN.verbunden : GLOBAL_VERBUNDEN}</p>
          </div>
          <nav className="gf-recht" aria-label={en ? "Legal" : "Rechtliches"}>
            {recht.map(([p, l]) => <a key={p} href={rechtHref(p)}>{l}</a>)}
            {/* Die Einwilligung lässt sich von jeder Seite aus ändern (components/site/EinwilligungsHinweis.tsx). */}
            <button type="button" onClick={() => window.dispatchEvent(new Event("fiaon-einwilligung-oeffnen"))}>{en ? "Consent" : "Einwilligung ändern"}</button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
