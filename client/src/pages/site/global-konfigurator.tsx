// ═══════════════════════════════════════════════════════════════════════════
// /business/start — DER KONFIGURATOR ALS EIGENE SEITE (Register E-509, 12.11.2026)
//
// Bis E-509 stand hier der Direktkauf mit Paketwahl (pages/business-start.tsx, E-188). Die Adresse bleibt, damit jeder
// alte Link, jede Anzeige und jede Mail ankommt: Wer „beauftragen“ klickt, landet jetzt beim Konfigurator des einen
// Produkts. ?paket=global_… und ?rahmen=… stellen den Regler (VerkaufKonfigurator liest sie). Dieselbe Fläche steht
// auf der Startseite; hier trägt sie die Seite allein — für Anzeigen, Mails und die Karte „Ein Mandat“ der Unterseiten.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { Dunkel } from "@/components/site/DunkleBuehne";
import { useSprache } from "@/i18n/sprache";
import VerkaufKonfigurator, { VerkaufKonfigLead } from "@/components/site/global/VerkaufKonfigurator";
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
      <div className="fg fg-neu vk-seite">
        <section className="fg-sek vk-konfig-sek" ref={sek}>
          <div className="fg-rahmen">
            <div className="fg-kopf">
              <div>
                <span className="fg-auge">{V.konfig.auge}</span>
                <h1 className="fg-h2">{V.konfig.h2a} <em>{V.konfig.h2b}</em></h1>
              </div>
              <VerkaufKonfigLead sprache={s} />
            </div>
            <VerkaufKonfigurator sprache={s} eigeneSeite />
            <p className="vk-seite-zurueck">
              <a href={`${BUSINESS_START[s]}#produkt`}>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8H4M7.5 4.5L4 8l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {V.produkt.name}
              </a>
            </p>
          </div>
        </section>
      </div>
    </Dunkel>
  );
}
