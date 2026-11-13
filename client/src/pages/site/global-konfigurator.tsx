// ═══════════════════════════════════════════════════════════════════════════
// /business/start — DER HONORARRECHNER ALS EIGENE SEITE (Register E-509, 12.11.2026; Wortlaut E-510, 13.11.2026)
//
// Bis E-509 stand hier der Direktkauf mit Paketwahl (pages/business-start.tsx, E-188). Die Adresse bleibt, damit jeder
// alte Link, jede Anzeige und jede Mail ankommt: Wer „Angebot anfordern“ klickt, landet beim Honorarrechner des einen
// Mandats (im Code „Konfigurator“). ?paket=global_… und ?rahmen=… stellen den Regler (VerkaufKonfigurator liest sie).
// Dieselbe Fläche steht auf der Startseite; hier trägt sie die Seite allein — für Anzeigen, Mails und die Karte „Ein
// Mandat“ der Unterseiten. Unter dem Rechner steht der Kasten „Auf einen Blick“: die vier Antworten der 30-Sekunden-Probe
// (Sprachleitfaden 1.3) — was geschieht, was es kostet und wann, was der Klient selbst tut, was gilt, wenn etwas ausbleibt.
// Darunter das Vertrauens-Band (Register, Presse-Zeile, Vertrag vor der Unterschrift, Zahlung per Rechnung).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { Dunkel } from "@/components/site/DunkleBuehne";
import { useSprache } from "@/i18n/sprache";
import VerkaufKonfigurator, { VerkaufKonfigLead } from "@/components/site/global/VerkaufKonfigurator";
import GlobalBlick from "@/components/site/global/GlobalBlick";
import GlobalVertrauen from "@/components/site/global/GlobalVertrauen";
import { VERKAUF_TEXTE } from "@shared/fiaon-global-verkauf";
import { BUSINESS_START } from "@shared/fiaon-business-grenze";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import "@/styles/global.css";
import "@/styles/global-grafik.css";
import "@/styles/global-apple.css";
import "@/styles/global-verkauf.css";

export default function GlobalKonfiguratorSeite() {
  const s = useSprache() === "en" ? "en" : "de";
  const V = VERKAUF_TEXTE[s];
  // Der Kopf gleitet wie auf der Startseite einmal herein (data-an am Abschnitt, global-apple.css).
  const sek = useRef<HTMLElement>(null);
  useEinmalSichtbar(sek, 0, "0px 0px -10% 0px");
  return (
    <Dunkel seite="business" titel={V.seo.titel} beschreibung={V.seo.beschreibung}>
      <div className="fg fg-neu fg-start vk-seite">
        <section className="fg-sek vk-konfig-sek" ref={sek} aria-labelledby="vk-konfig-titel">
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div>
                <span className="fg-auge">{V.konfig.auge}</span>
                <h1 className="fg-h2" id="vk-konfig-titel">{V.konfig.h2a} <em>{V.konfig.h2b}</em></h1>
              </div>
              <VerkaufKonfigLead sprache={s} />
            </div>
            <VerkaufKonfigurator sprache={s} eigeneSeite />
            {/* Die vier Antworten der 30-Sekunden-Probe — die Spanne des Kapitalrahmens steht schon am Regler. */}
            <GlobalBlick titel={V.blick.titel} punkte={V.blick.punkte} ebene="h2" />
            <p className="vk-seite-zurueck">
              <a href={`${BUSINESS_START[s]}#produkt`}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8H4M7.5 4.5L4 8l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {V.produkt.name}
              </a>
            </p>
          </div>
        </section>
        <GlobalVertrauen sprache={s} />
      </div>
    </Dunkel>
  );
}
