// ═══════════════════════════════════════════════════════════════════════════
// LAGEZIMMER › „MARA HEUTE“ — die kurze Zusammenfassung (E-406 B3, 19.10.2026; E-409 × E-406, 20.10.2026)
//
// Justin, Vorschlag 3: „Karte ‚Mara heute‘ — nur Auffälliges, kein langer Bericht.“ Seit der Zusammenführung mit
// dem KI-Team gibt es EINE Quelle für Maras Zahlen (maraHeuteLesen): hier eine Zeile (selbst erledigt, die drei
// größten Arten, Geld heute, offene Entscheidungen, Gelbes) und „Mehr“ in KI-Team › Heute — dort stehen die
// Einzelheiten, „Rückgängig“ und der Not-Aus. Keine Namen (Stufe Leitung). GET /chef/mara-heute.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot } from "lucide-react";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";

const API = "/api/fiaon";
const zahl = (n: number) => Number(n || 0).toLocaleString("de-DE");
const eur = (cents: number) => `${(Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

interface Kurz {
  stand: string; erledigt: number; oben: { art: string; n: number; text: string }[];
  geld: { heuteCents: number; zahlungen: number } | null; entscheidungen: number; gelb: number; aufraeumen: number; haengt: number; link: string;
}

export default function ChefMaraHeute() {
  const [d, setD] = useState<Kurz | null>(null);
  const start = useRef<(() => void) | null>(null);
  const laden = useCallback(() => {
    fetch(`${API}/chef/mara-heute`, { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok && typeof j.erledigt === "number") setD(j); }).catch(() => {});
  }, []);
  useEffect(() => { laden(); }, [laden]);
  if (!d) return null;
  const teile = [
    d.geld ? `Geld heute ${eur(d.geld.heuteCents)}` : null,
    d.entscheidungen ? `${zahl(d.entscheidungen)} ${d.entscheidungen === 1 ? "Entscheidung" : "Entscheidungen"} offen` : null,
    d.gelb ? `${zahl(d.gelb)} gelb` : null,
    d.aufraeumen ? `${zahl(d.aufraeumen)} Vorschläge` : null,
    d.haengt ? `${zahl(d.haengt)} im Team hängen` : null,
  ].filter(Boolean);
  return (
    <section className="cl-block mh-block" aria-label="Mara heute">
      <Rundgang raum="lagezimmer" titel="Lagezimmer" schritte={RUNDGAENGE.lagezimmer.schritte} knopf="keiner" startRef={start} />
      <div className="cl-block-kopf">
        <h2><Bot size={17} strokeWidth={1.9} /> Mara heute</h2>
        <small>
          <b className="mh-zahl">{zahl(d.erledigt)}</b> selbst erledigt
          {" · "}<button type="button" className="mh-link" onClick={() => start.current?.()}>Rundgang</button>
        </small>
      </div>
      <a href={d.link} className="cl-klemmzeile mh-kurz" title="Einzelheiten, Gelb mit „Rückgängig“ und der Not-Aus stehen in KI-Team › Heute.">
        <span>{d.oben.length ? d.oben.map((z) => `${zahl(z.n)} ${z.text}`).join(" · ") : "Heute noch nichts erledigt"}{teile.length ? ` — ${teile.join(" · ")}` : ""}</span>
        <em>Mehr in KI-Team</em>
        <ArrowRight size={15} strokeWidth={1.75} className="pfeil" />
      </a>
      <style>{`
        .mh-block .cl-block-kopf h2 { display: flex; align-items: center; gap: 10px; }
        .mh-block .cl-klemmzeile em { color: #94a3b8; white-space: nowrap; font-style: normal; }
        .mh-block .cl-klemmzeile span { min-width: 0; }
        .mh-zahl { font-variant-numeric: tabular-nums; }
        .mh-link { background: none; border: 0; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
        @media (max-width: 640px) { .mh-block .cl-klemmzeile { flex-wrap: wrap; } .mh-block .cl-klemmzeile em { flex: 1 0 100%; } }
      `}</style>
    </section>
  );
}
