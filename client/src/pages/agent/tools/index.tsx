// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools — Tools: Werkzeuge für Bonitätsmanager (23.08.2026, Plan §4/§11)
//
// Der Hub mit vier Karten. Jedes Werkzeug ist eine eigene Unterseite:
//   /agent/tools/paketfinder   Situation des Kunden → passendes Paket + Provision
//   /agent/tools/gespraech     Live-Leitfaden während des Anrufs
//   /agent/tools/recht         Löschfrist, Verjährung, Inkassokosten
//   /agent/tools/tagescheck    Mein Tag in Zahlen, Ziel 5 Abschlüsse
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Link } from "wouter";
import { Package, Headset, Scale, Target } from "lucide-react";
import { AgentShell } from "../shared";
import { useOffice } from "../OfficeShell";
import "@/styles/office-tools.css";

export const WERKZEUGE = [
  { href: "/agent/tools/paketfinder", Icon: Package, titel: "Paketfinder", text: "Ziel, Einträge, Dringlichkeit, Budget – das passende Paket aus dem Katalog, die Rate, deine Provision und drei Sätze fürs Gespräch.", hinweis: "Im Gespräch" },
  { href: "/agent/tools/gespraech", Icon: Headset, titel: "Gesprächs-Begleiter", text: "Leitfaden mit Timer und Abhak-Schritten für Erstanruf, Rückruf, Startgespräch und Zahlungserinnerung. Einwände auf einen Klick, am Ende ins Kontaktprotokoll.", hinweis: "Während des Anrufs" },
  { href: "/agent/tools/recht", Icon: Scale, titel: "Rechtsrechner", text: "Löschfrist, Verjährung und Inkassokosten in einem Werkzeug – mit dem Satz, den du dem Kunden vorlesen kannst.", hinweis: "Wenn der Kunde fragt" },
  { href: "/agent/tools/tagescheck", Icon: Target, titel: "Tages-Check", text: "Kontakte, erreichte Kunden, Termine und Abschlüsse heute. Ziel 5 Abschlüsse als Ring – und was jetzt am meisten bringt, mit Anruf-Knopf.", hinweis: "Morgens und zwischendurch" },
];

export default function AgentToolsPage() { return <AgentShell><ToolsInnen /></AgentShell>; }

function ToolsInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Werkzeuge für Bonitätsmanager</span>
          <h1>Vier Werkzeuge, <span className="to-verlauf">ein Klick.</span></h1>
          <p>Alles, was du am Telefon brauchst, ohne zu rechnen oder zu suchen. Kunden werden gesiezt, du wirst geduzt.</p>
        </div>
      </section>
      <section className="to-raster">
        {WERKZEUGE.map((w) => (
          <Link key={w.href} href={w.href} className="to-kachel">
            <i><w.Icon size={22} strokeWidth={1.75} /></i>
            <div><b>{w.titel}</b><span>{w.text}</span><small>{w.hinweis}</small></div>
          </Link>
        ))}
      </section>
    </div>
  );
}
