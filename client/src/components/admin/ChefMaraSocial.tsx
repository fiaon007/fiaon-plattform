// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=social — DAS SOCIAL-STUDIO (06.10.2026, E-294)
//
// Justin (06.10.2026): „unser Content … muss auch auf der Plattform eine Seite
// haben, mit Termin, Post, Plattform, Texten … wie sieht Instagram aus wenn es
// fertig ist … dass man auch echt was machen kann von dort aus" und „alles über
// die Plattform steuern: Claude spielt die Posts ein, wir prüfen, bearbeiten und
// posten dort".
//
// Keine neue Chef-Seite (Hausregel 26.09.): der fünfte Reiter im Mara-Steuerpult.
// Scheibe 1 „Ansehen und arbeiten":
//   · Plan (sicht=plan, Start): Kopfkarte „Heute zu posten" mit Countdown — die
//     EINE Glasfläche —, Woche oder Monat, Filter nach Kanal, Marke, Status.
//   · So sieht es aus (sicht=vorschau): das Instagram-Profil im Handy, Raster 3:4
//     aus der Mitte jedes 4:5-Beitrags, Zeitregler heute / 7 / 30 Tage. Vorgabe ist
//     das EINE Raster @fiaon.ltd (FIAON und Global gemischt, wie es online steht);
//     „nur FIAON“ / „nur Global“ sind Filter darauf (Prüfung 06.10.2026).
//   · Post-Detail (&post=<id>, aus Plan und Vorschau): links das Handy (Glas),
//     rechts Texte mit Kopieren und Zeichenzählung, Dateien einzeln und als ZIP,
//     Checkliste je Kanal mit KI-Pflichthaken und die Status-Knöpfe.
// Profile, Bearbeiten mit Verlauf, LinkedIn/Facebook/TikTok-Vorschau, Kalender-
// Abo und Meta-Veröffentlichung folgen in den nächsten Scheiben.
//
// Daten: GET /api/fiaon/chef/social/* (server/routes/fiaon-social.ts), Typen und
// Regeln in shared/fiaon-social.ts. Die Seite lädt selbst (useDaten) — die Wurzel
// des Steuerpults holt nur die Zahlmarke am Reiter.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Geruest } from "./chef-teile";
import { useMaraLage } from "./mara-lage";
import { heuteBerlin, type SocialSicht, type PlanZustand, type VorschauKonto } from "./social/social-teile";
import "@/styles/chef-social.css";

const SocialPlan = lazy(() => import("./social/SocialPlan"));
const SocialVorschau = lazy(() => import("./social/SocialVorschau"));
const SocialPost = lazy(() => import("./social/SocialPost"));


function ausAdresse(): { sicht: SocialSicht; post: number | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    const p = Number(q.get("post"));
    return { sicht: q.get("sicht") === "vorschau" ? "vorschau" : "plan", post: Number.isInteger(p) && p > 0 ? p : null };
  } catch { return { sicht: "plan", post: null }; }
}

export default function ChefMaraSocial({ onGeaendert }: { onGeaendert?: () => void }) {
  const lage = useMaraLage();
  const [ort, setOrt] = useState(ausAdresse);
  // Plan-Zustand lebt hier, damit Woche und Filter nach dem Post-Detail noch stehen.
  const [plan, setPlan] = useState<PlanZustand>(() => ({ anker: heuteBerlin(), ansicht: "woche", filter: { kanal: "", marke: "", status: "" } }));
  const [vorschauTage, setVorschauTage] = useState<number>(7);
  const [vorschauMarke, setVorschauMarke] = useState<VorschauKonto>("alle");
  // Zuletzt geöffneter Post: nach „Zurück“ rollt Plan bzw. Vorschau wieder zu seiner Karte.
  const [zuletzt, setZuletzt] = useState<number | null>(null);

  // Zurück-Taste des Browsers: Post-Detail → Plan (pushState beim Öffnen, siehe unten).
  useEffect(() => {
    const zurueck = () => { perKlick.current = false; setOrt((alt) => { if (alt.post) setZuletzt(alt.post); return ausAdresse(); }); };
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, []);

  const adresse = useCallback((sicht: SocialSicht, post: number | null, neuerEintrag: boolean) => {
    setOrt({ sicht, post });
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("reiter", "social");
      u.searchParams.set("sicht", sicht);
      if (post) u.searchParams.set("post", String(post)); else u.searchParams.delete("post");
      if (neuerEintrag) window.history.pushState(null, "", u.toString());
      else window.history.replaceState(null, "", u.toString());
    } catch { /* Adresse bleibt, die Ansicht wechselt trotzdem */ }
    // Die Seite rollt in einem inneren Behälter des Chef-Gerüsts — window.scrollTo wirkt dort
    // nicht. scrollIntoView findet den richtigen Behälter selbst.
    if (post) {
      try { (document.querySelector(".mara-reiter") as HTMLElement | null)?.scrollIntoView({ block: "start", behavior: "auto" }); } catch { /* egal */ }
    }
  }, []);

  // Geöffnet per Klick = eigener Verlaufseintrag; „Zurück" ist dann der Browser-Schritt.
  // Per Direktlink geöffnet (ICS, Import-Antwort) gibt es keinen — dann nur die Adresse.
  const perKlick = useRef(false);
  const oeffnen = useCallback((id: number) => { perKlick.current = true; setZuletzt(id); adresse(ort.sicht, id, true); }, [adresse, ort.sicht]);
  const schliessen = useCallback(() => {
    if (ort.post) setZuletzt(ort.post);
    if (perKlick.current) { perKlick.current = false; window.history.back(); return; }
    adresse(ort.sicht, null, false);
  }, [adresse, ort.sicht, ort.post]);
  const gerollt = useCallback(() => setZuletzt(null), []);
  const sichtWechseln = (s: SocialSicht) => adresse(s, null, false);

  if (lage && lage.reiter !== "social") return null;

  return (
    <div className="so">
      {ort.post ? (
        <Suspense fallback={<Geruest zeilen={10} />}>
          <SocialPost key={ort.post} id={ort.post} zurueckText={ort.sicht === "vorschau" ? "Zurück zur Vorschau" : "Zurück zum Plan"}
            onZurueck={schliessen} onGeaendert={onGeaendert} />
        </Suspense>
      ) : (
        <>
          <div className="so-kopf">
            <div className="mara-ansicht" role="group" aria-label="Social-Studio">
              <button type="button" aria-pressed={ort.sicht === "plan"} onClick={() => sichtWechseln("plan")}
                title="Was wann auf welchem Kanal erscheint — Woche oder Monat, mit Status und Filter.">Plan</button>
              <button type="button" aria-pressed={ort.sicht === "vorschau"} onClick={() => sichtWechseln("vorschau")}
                title="So sieht das Instagram-Profil aus — heute, in 7 oder in 30 Tagen.">So sieht es aus</button>
            </div>
          </div>
          <Suspense fallback={<Geruest zeilen={8} />}>
            {ort.sicht === "plan"
              ? <SocialPlan zustand={plan} setZustand={setPlan} onOeffnen={oeffnen} onGeaendert={onGeaendert} zuletzt={zuletzt} onGerollt={gerollt} />
              : <SocialVorschau tage={vorschauTage} setTage={setVorschauTage} marke={vorschauMarke} setMarke={setVorschauMarke}
                  onOeffnen={oeffnen} stichtagHeute={heuteBerlin()} zuletzt={zuletzt} onGerollt={gerollt} />}
          </Suspense>
        </>
      )}
    </div>
  );
}
