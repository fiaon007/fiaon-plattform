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
import { GLOBAL_FUSS_WOERTER, GLOBAL_WOERTER } from "@/i18n/global";
import { globalMenue } from "@shared/fiaon-global-menue";
import { GLOBAL_VERBUNDEN, GLOBAL_VERBUNDEN_EN } from "@shared/fiaon-global-partner";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { SozialeLinks } from "@/components/site/SozialeLinks";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { schwesterPfad } from "@shared/fiaon-seo-seiten";
import { mitBereich } from "@/lib/bereich";
import { GlobalMarke } from "@/components/site/GlobalNav";
import GlobalOrte from "@/components/site/global/GlobalOrte";
import "@/styles/global-rahmen.css";
import "@/styles/global-grafik.css";

// 19.09.2026 (E-192): Ein Paket heißt „Global Banking" — „Bank" in einer Bezeichnung ist nach § 39 KWG Kreditinstituten
// vorbehalten, außer der Zusammenhang schließt den Anschein von Bankgeschäften aus (§ 41 KWG). Der Satz KEINE_BANK
// (GLOBAL_FUSS_WOERTER.keineBank) steht deshalb auf jeder Seite der Business-Welt, direkt beim Vertragspartner.
// 06.10.2026 (E-293): Alle Wörter des Fußes stehen in i18n/global.ts (GLOBAL_FUSS_WOERTER), damit die Wortwand sie
// liest; die Standort-Liste ist jetzt „Drei Orte“ mit Mini-Uhren (components/site/global/GlobalOrte.tsx).

export default function GlobalFuss() {
  const sprache = useSprache();
  const en = sprache === "en";
  const w = GLOBAL_FUSS_WOERTER[en ? "en" : "de"];
  const jahr = new Date().getFullYear();
  const recht: [string, string][] = w.recht.map(({ pfad, text }) => [en && !pfad.startsWith("/en/") ? schwesterPfad(pfad, "en") ?? pfad : pfad, text]);
  // Die Business-eigenen Rechtsseiten tragen den Rahmen ohnehin; die gemeinsamen bekommen ?bereich=business.
  const rechtHref = (p: string) => (/^\/(en\/)?business(\/|$)/.test(p) ? p : mitBereich(p));

  return (
    <footer className="gf" aria-label={w.label}>
      <div className="gf-rahmen">
        <div className="gf-oben">
          <div className="gf-marke">
            <GlobalMarke en={en} hell />
            <p>{w.satz}</p>
            <div className="gf-tun">
              <a href={en ? "/en/business#gespraech" : "/business#gespraech"} className="gf-knopf">{w.gespraech}</a>
              <a href={globalStartPfad(undefined, en ? "en" : "de")} className="gf-knopf hell">{w.beauftragen}</a>
            </div>
            <p className="gf-kontakt">
              <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a>
              <span aria-hidden="true">·</span>
              <a href={`mailto:${FIAON_FIRMA.email}`}>{FIAON_FIRMA.email}</a>
              <span aria-hidden="true">·</span>
              <a href={en ? "/en/business/auftrag" : "/business/auftrag"}>{w.auftrag}</a>
            </p>
            <SozialeLinks en={en} className="gf-sozial" />
          </div>

          <nav className="gf-themen" aria-label={w.themen}>
            {/* 24.09.2026 (E-234): dieselben vier Spalten in beiden Sprachen — die Unterseiten gibt es jetzt auch englisch. */}
            {globalMenue(en ? "en" : "de").map((g) => (
              <div key={g.titel} className="gf-spalte">
                <p className="gf-titel">{g.titel}</p>
                <ul>{g.eintraege.map((e) => <li key={e.pfad}><a href={e.pfad}>{e.titel}</a></li>)}</ul>
              </div>
            ))}
          </nav>
        </div>

        <GlobalOrte en={en} label={w.standorte} sie={w.orteSie} sieZusatz={w.orteSieZusatz} rollen={w.orte} uhren={GLOBAL_WOERTER[en ? "en" : "de"].uhren} />

        <div className="gf-unten">
          <div className="gf-firma">
            <p>© {jahr} {FIAON_FIRMA.name} · {w.registriert}, Company No. {FIAON_FIRMA.companyNo} · {FIAON_FIRMA.strasse}, {FIAON_FIRMA.ortZeile}</p>
            <p className="gf-verbunden">{w.keineBank}</p>
            <p className="gf-verbunden">{en ? GLOBAL_VERBUNDEN_EN : GLOBAL_VERBUNDEN}</p>
          </div>
          <nav className="gf-recht" aria-label={w.rechtlich}>
            {recht.map(([p, l]) => <a key={p} href={rechtHref(p)}>{l}</a>)}
            {/* Die Einwilligung lässt sich von jeder Seite aus ändern (components/site/EinwilligungsHinweis.tsx). */}
            <button type="button" onClick={() => window.dispatchEvent(new Event("fiaon-einwilligung-oeffnen"))}>{w.einwilligung}</button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
