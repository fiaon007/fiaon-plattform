// ═══════════════════════════════════════════════════════════════════════════
// DIE TÜR ZUR AKTE: /akte/<Kennung>  (E-315, 09.10.2026)
//
// Justin: „die EINE perfekte zentrale Akte, über die man ALLES steuern kann“. Jeder Link auf einen Menschen — aus
// Aufgaben, Mails, Terminen, WhatsApp, vCards — zeigt auf diese eine Adresse (shared/fiaon-akte-aufloesung.ts:
// akteAdresse/akteLinkFuer). Die Tür entscheidet nach der Sitzung:
//   · Chefbüro angemeldet → die zentrale Akte im Chefbüro (ChefPage erkennt /akte/… selbst)
//   · Office angemeldet   → die Akte der Mitarbeiter (/agent/kunden?person=<Kopf>), Rechte prüft sie selbst
//   · niemand angemeldet  → Auswahl: Chefbüro oder Team-Office
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import "@/styles/chefbuero.css";
import { kommtAusOffice } from "@/lib/akte-bereich";

const ChefPage = lazy(() => import("@/pages/chef"));

type Stand = "pruefen" | "chef" | "keiner" | "fehler";



export default function AkteTuerPage() {
  const [, params] = useRoute("/akte/:kennung");
  const [, navigate] = useLocation();
  const kennung = params?.kennung ? decodeURIComponent(params.kennung) : "";
  const [stand, setStand] = useState<Stand>("pruefen");
  const [fehler, setFehler] = useState("");
  const [chefWahl, setChefWahl] = useState(false);

  useEffect(() => {
    let an = true;
    (async () => {
      const chef = await fetch("/api/fiaon/chef/status", { credentials: "include" }).then((r) => r.json()).catch(() => null);
      if (!an) return;
      const chefDa = !!(chef?.ok && chef.angemeldet);
      if (chefDa && !kommtAusOffice()) { setStand("chef"); return; }
      const ich = await fetch("/api/fiaon/agent/me", { credentials: "include" }).catch(() => null);
      if (!an) return;
      if (!ich?.ok && chefDa) { setStand("chef"); return; }
      if (ich?.ok) {
        const r = await fetch(`/api/fiaon/agent/akte/aufloesen?id=${encodeURIComponent(kennung)}`, { credentials: "include" }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : {};
        if (!an) return;
        if (r?.ok && j.personId) { navigate(`/agent/kunden?person=${j.personId}`, { replace: true }); return; }
        setFehler(j.error || "Diese Akte ließ sich nicht öffnen.");
        setStand("fehler");
        return;
      }
      setStand("keiner");
    })();
    return () => { an = false; };
  }, [kennung, navigate]);

  if (stand === "chef" || chefWahl) {
    return <Suspense fallback={<div className="cb" />}><ChefPage /></Suspense>;
  }
  return (
    <div className="cb akte-tuer">
      <div className="akte-tuer-karte" role={stand === "pruefen" ? "status" : undefined}>
        {stand === "pruefen" && <p>Akte wird geöffnet …</p>}
        {stand === "fehler" && (
          <>
            <b>Akte nicht geöffnet</b>
            <p>{fehler}</p>
            <a className="cw-knopf" href="/agent/kunden">Zu meinen Kunden</a>
          </>
        )}
        {stand === "keiner" && (
          <>
            <b>Bitte anmelden</b>
            <p>Diese Akte öffnet sich nach der Anmeldung — im Chefbüro oder im Team-Office.</p>
            <div className="akte-tuer-knoepfe">
              <button type="button" className="cw-knopf" onClick={() => setChefWahl(true)}>Chefbüro</button>
              <a className="cw-knopf hell" href="/agent">Team-Office</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
