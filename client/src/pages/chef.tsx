// ═══════════════════════════════════════════════════════════════════════════
// /chef — das Chefbüro (24.08.2026)
// Bezug: CHEFBUERO_PLAN_2026-08-24.md §2.2/§2.3 (E-053), Scheiben 1+2.
//
// NEUE Routen /chef und /chef/<raum> im Parallelbetrieb: die bestehende helle
// AdminShell unter /admin bleibt unangetastet, jede Kachel hier führt auf die
// bestehenden Seiten. Davor liegt die persönliche Anmeldung (ChefAnmeldung):
// /chef/status entscheidet — das alte fiaon_admin-Cookie zählt im Übergang
// als angemeldeter Inhaber.
//
// Verdrahtung (App.tsx, macht Justin/der Betreiber):
//   <Route path="/chef" component={ChefPage} />
//   <Route path="/chef/:raum" component={ChefPage} />
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import ChefAnmeldung, { type ChefStatus } from "@/components/admin/ChefAnmeldung";
import { ChefShell, ChefRaumSeite, CHEF_RAEUME, raumErlaubt, STUFEN_NAME, type ChefStufe } from "@/components/admin/ChefShell";
// 26.08.2026: Das Lagezimmer ist keine Kachelliste mehr, sondern der Raum, in
// dem die Zahlen des Unternehmens stehen. Die uebrigen sieben Raeume bleiben
// Kachellisten auf die bestehenden /admin-Seiten — dort ist eine Liste richtig.
import ChefLagezimmer from "@/components/admin/ChefLagezimmer";
// 26.08.2026: Drei weitere Raeume sind eigene Seiten statt Kachellisten —
// Werkstatt, Kundenauflistung und Zahlungszentrale. Sie zeigen Daten, nicht
// Verweise, und dafuer ist eine Kachelliste die falsche Form.
import ChefWerkzeuge from "@/components/admin/ChefWerkzeuge";
import ChefKundenliste from "@/components/admin/ChefKundenliste";
import ChefZahlungen from "@/components/admin/ChefZahlungen";
import ChefRegister from "@/components/admin/ChefRegister";

/**
 * Welche Raeume eine eigene Seite haben statt einer Kachelliste.
 * Die Stufe wird durchgereicht: Das Register blendet aus, was diese Stufe
 * ohnehin nicht oeffnen duerfte — ein Verzeichnis voller gesperrter Tueren
 * waere kein Verzeichnis, sondern eine Liste von Enttaeuschungen.
 */
const EIGENE_SEITE: Record<string, (stufe: ChefStufe) => JSX.Element> = {
  werkzeuge: () => <ChefWerkzeuge />,
  kundenliste: () => <ChefKundenliste />,
  zahlungen: () => <ChefZahlungen />,
  register: (stufe) => <ChefRegister stufe={stufe} />,
};

const STUFEN: ChefStufe[] = ["inhaber", "geschaeftsfuehrung", "leitung"];

export default function ChefPage() {
  const [location, navigate] = useLocation();
  const [status, setStatus] = useState<ChefStatus | null>(null);

  // Raum aus der URL: /chef → Lagezimmer, /chef/<raum> → dieser Raum.
  const teil = location.split("?")[0].split("/")[2] || "";
  const raum = CHEF_RAEUME.find((r) => r.key === teil) ?? CHEF_RAEUME[0];

  if (!status) {
    return <ChefAnmeldung onAngemeldet={setStatus} />;
  }
  const stufe: ChefStufe = STUFEN.includes(status.stufe as ChefStufe) ? (status.stufe as ChefStufe) : "leitung";

  const abmelden = () => {
    fetch("/api/fiaon/chef/abmelden", { method: "POST", credentials: "include" })
      .catch(() => {})
      .finally(() => { setStatus(null); navigate("/chef"); });
  };

  return (
    <ChefShell stufe={stufe} name={status.name} raumKey={raum.key} onAbmelden={abmelden}>
      {raumErlaubt(raum, stufe) ? (
        raum.key === "lage"
          ? <ChefLagezimmer name={status.name} />
          : EIGENE_SEITE[raum.key]
            ? EIGENE_SEITE[raum.key](stufe)
            : <ChefRaumSeite raum={raum} />
      ) : (
        <div className="cb-hinweis" role="status">
          <b><Lock size={16} strokeWidth={1.75} /> {raum.label} ist für dich geschlossen.</b>
          <p>
            Diesen Raum gibt es erst ab Stufe {STUFEN_NAME[raum.mindest]} — deine Stufe
            ist {STUFEN_NAME[stufe]}. Wenn du hier hinein musst, sprich mit Justin.
          </p>
        </div>
      )}
    </ChefShell>
  );
}
