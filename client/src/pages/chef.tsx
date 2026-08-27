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
import { ChefShell, ChefRaumSeite, ChefSeitenRahmen, CHEF_RAEUME, raumErlaubt, STUFEN_NAME, type ChefStufe } from "@/components/admin/ChefShell";
import { SEITE_NACH_SLUG } from "@/components/admin/chef-seiten";
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
import ChefBesucher from "@/components/admin/ChefBesucher";
import ChefZahlen from "@/components/admin/ChefZahlen";
import { Suspense } from "react";

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
  besucher: () => <ChefBesucher />,
  wert: () => <ChefZahlen />,
};

const STUFEN: ChefStufe[] = ["inhaber", "geschaeftsfuehrung", "leitung"];

export default function ChefPage() {
  const [location, navigate] = useLocation();
  const [status, setStatus] = useState<ChefStatus | null>(null);

  // Raum aus der URL: /chef → Lagezimmer, /chef/<raum> → dieser Raum,
  // /chef/s/<slug> → eine übernommene Seite innerhalb ihres Raums.
  const stuecke = location.split("?")[0].split("/").filter(Boolean);
  const istSeite = stuecke[1] === "s";
  const slug = istSeite ? (stuecke[2] || "") : "";
  const seite = istSeite ? SEITE_NACH_SLUG.get(slug) : undefined;
  const teil = istSeite ? (seite?.raum ?? "") : (stuecke[1] || "");
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
      {istSeite && !seite ? (
        <div className="cb-hinweis" role="status">
          <b>Diese Seite gibt es hier nicht.</b>
          <p>
            Der Verweis „{slug}" führt ins Leere. Über das Register findest du
            jede Funktion des Hauses — durchsuchbar, auch nach Nebenworten.
          </p>
          <p style={{ marginTop: 12 }}><a className="cw-knopf" href="/chef/register">Zum Register</a></p>
        </div>
      ) : istSeite && seite ? (
        // Reicht die Stufe für DIESE Seite? Der Raum allein genügt nicht —
        // „Provision nachbuchen" liegt im Team-Raum, ist aber Geld.
        (seite.mindest && !raumErlaubt({ ...raum, mindest: seite.mindest }, stufe)) ? (
          <div className="cb-hinweis" role="status">
            <b><Lock size={16} strokeWidth={1.75} /> {seite.label} ist für dich geschlossen.</b>
            <p>Diese Seite gibt es erst ab Stufe {STUFEN_NAME[seite.mindest]} — deine Stufe ist {STUFEN_NAME[stufe]}.</p>
          </div>
        ) : (
          <ChefSeitenRahmen seite={seite} raum={CHEF_RAEUME.find((r) => r.key === seite.raum)}>
            <Suspense fallback={<div className="cl-geruest"><span /><span /><span /><span /><span /><span /></div>}>
              <seite.Seite />
            </Suspense>
          </ChefSeitenRahmen>
        )
      ) : raumErlaubt(raum, stufe) ? (
        raum.key === "lage"
          ? <ChefLagezimmer name={status.name} />
          : EIGENE_SEITE[raum.key]
            ? EIGENE_SEITE[raum.key](stufe)
            : <ChefRaumSeite raum={raum} stufe={stufe} />
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
