// ═══════════════════════════════════════════════════════════════════════════
// /vorsorge/:token — „IHR VORSORGE-ÜBERBLICK“ OHNE ANMELDUNG (E-487 (09.11.2026))
//
// Der Knopf in Maras Mail führt hierher: ein signierter, persönlicher Link (30 Tage, server/lib/fiaon-vorsorge.ts). Der Kunde
// hält fest, welche Vorsorge-Themen ihm wichtig sind, und bucht auf Wunsch selbst einen Termin beim Partner — mit eigenem,
// nie vorangekreuztem Kästchen zum Wortlaut. Keine Finanzdaten, nie im Index (Kopfzeile X-Robots-Tag aus server/routes.ts
// und robots-Meta hier), kein Referer. Hell im Glasblau der Kundenseiten, Handy zuerst; das eine Navy-Glas ist der Partner.
// Ein Link „v.<ablauf>.<signatur>“ ist die Vorschau aus dem Chefbüro: echter Partner, nichts wird gespeichert.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { VorsorgeBuchung } from "@/components/kunde/VorsorgeBuchung";
import { VORSORGE_TEXTE, type VorsorgeLage } from "@shared/fiaon-vorsorge";
import "@/styles/vorsorge.css";

export default function VorsorgePage() {
  const [, params] = useRoute("/vorsorge/:token");
  const token = params?.token ?? "";
  const [lage, setLage] = useState<VorsorgeLage | null>(null);
  const [fehler, setFehler] = useState<{ text: string; code?: string } | null>(null);
  const basis = `/koop/vorsorge/${encodeURIComponent(token)}`;

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon${basis}`, { credentials: "include" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok && j.lage) { setLage(j.lage as VorsorgeLage); setFehler(null); }
    else setFehler({ text: j?.error || VORSORGE_TEXTE.fehler, code: j?.code });
  }, [basis]);

  useEffect(() => {
    document.title = "Ihr Vorsorge-Überblick · FIAON";
    const robots = document.createElement("meta"); robots.name = "robots"; robots.content = "noindex, nofollow";
    const referrer = document.createElement("meta"); referrer.name = "referrer"; referrer.content = "no-referrer";
    document.head.appendChild(robots); document.head.appendChild(referrer);
    void laden();
    return () => { robots.remove(); referrer.remove(); };
  }, [laden]);

  return (
    <main className="vs-seite" data-fiaon="vorsorge-seite">
      <div className="vs-innen">
        <header className="vs-kopf">
          <span className="vs-marke"><FiaonWortmarke dekorativ /></span>
          <span className="vs-kopf-pille">Persönlicher Link</span>
        </header>

        {!lage && !fehler && <p className="vs-laedt">Wird geladen …</p>}

        {fehler && (
          <div className="vs-karte vs-auf">
            <h1 className="vs-titel klein">{fehler.code === "abgelaufen" ? "Dieser Link ist abgelaufen" : "Dieser Link funktioniert nicht"}</h1>
            <p>{fehler.text}</p>
            {fehler.code === "abgelaufen" && <a className="vs-knopf" href="/app">Zum Kundenbereich</a>}
          </div>
        )}

        {lage && (
          <>
            <h1 className="vs-titel vs-auf">
              Guten Tag{lage.name ? ` ${lage.name}` : ""},<span>{VORSORGE_TEXTE.titel}</span>
            </h1>
            <p className="vs-lead vs-auf">{VORSORGE_TEXTE.lead}</p>
            <div className="vs-karte vs-auf">
              {lage.zeigen
                ? <VorsorgeBuchung basis={basis} lage={lage} setLage={setLage} kontext="seite" />
                : <p>{lage.hinweis ?? VORSORGE_TEXTE.nichtMoeglich}</p>}
            </div>
          </>
        )}

        <footer className="vs-fuss">
          <a href="/datenschutz#vorsorge">Datenschutz</a>
          <a href="/impressum">Impressum</a>
        </footer>
      </div>
    </main>
  );
}
