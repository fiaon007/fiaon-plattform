// ═══════════════════════════════════════════════════════════════════════════
// DAS COCKPIT (20.10.2026) — EINE Statusleiste oben, das einzige Glas der Seite
//
// Justin: „die gesamte Seite ist total unübersichtlich … das gesamte Layout, UI VIEL übersichtlicher, cleaner“.
// Vorher: vier große Zahlen (auch bei 0), darunter ein halber Bildschirm „Strom verbunden · 0 Gespräche“.
// Jetzt: ein Satz, was Aras gerade tut („Aras ruft gerade niemanden an“), Stufe, Kunden an/aus, Kosten heute,
// Leerlauf und Not-Aus als kleine Knöpfe. Läuft ein Gespräch, wächst DIESELBE Karte um den Live-Kasten
// (wer, wie lange, Text live, Übernehmen/Auflegen); ohne Gespräch steht dort eine leise Zeile.
// ═══════════════════════════════════════════════════════════════════════════
import { STUFEN, type Stufe } from "@shared/fiaon-aras";
import { senden } from "../ki-teile";
import { euroText, statusSatz } from "./aras-texte";
import { FrageKnopf, Hinweis, Punkt, useHinweis } from "./aras-teile";
import { LiveKaesten, type ArasLiveHaken } from "./ArasLive";

export interface CockpitLage {
  verbunden: boolean; an: boolean; notaus: boolean; leerlauf?: boolean; stufe?: number;
  heute: { gewaehlt: number; erreicht: number; gespraeche: number; zusagen: number; euroKi: number; euroTelefon: number; proben?: number; deckel: number | null };
  plan?: { wartet?: number } | null;
}

export function ArasCockpit({ lage, live, onNeu, onReiter }: { lage: CockpitLage | null; live: ArasLiveHaken; onNeu: () => void; onReiter: (r: "anrufe" | "stufe" | "einstellungen") => void }) {
  const hinweis = useHinweis();
  const verbunden = !!lage?.verbunden;
  const schalten = async (pfad: string, body: unknown, ok: string) => {
    try { await senden(pfad, body); hinweis.gut(ok); onNeu(); } catch (e) { hinweis.rot((e as Error).message); }
  };
  if (!lage) return <section className="ar-cockpit lade" data-ki="cockpit" aria-busy="true"><div className="ar-zeile-lade" /></section>;
  if (!verbunden) {
    return (
      <section className="ar-cockpit" data-ki="cockpit">
        <div className="ar-status"><Punkt /><b>Aras ist noch nicht verbunden</b></div>
        <p className="ar-cockpit-leise">Die Probe unten läuft trotzdem — der Rest füllt sich, sobald der Telefon-Kern angemeldet ist.</p>
      </section>
    );
  }
  const stufe = Math.max(0, Math.min(3, Number(lage.stufe ?? 0))) as Stufe;
  const kundenAn = lage.an && stufe >= 1 && !lage.notaus;
  const s = statusSatz(lage, live.sitzungen);
  const h = lage.heute;
  const kosten = (Number(h.euroKi) || 0) + (Number(h.euroTelefon) || 0);
  const deckel = Number(h.deckel) || 0;
  const anteil = deckel > 0 ? Math.min(100, Math.round((kosten / deckel) * 100)) : 0;
  const anrufe = (Number(h.gewaehlt) || 0) + (Number(h.proben) || 0);
  const heuteSatz = anrufe === 0 ? "Heute noch kein Anruf"
    : [h.gewaehlt ? `${h.gewaehlt} Kundenanruf${h.gewaehlt === 1 ? "" : "e"}` : "", h.zusagen ? `${h.zusagen} Zusage${h.zusagen === 1 ? "" : "n"}` : "", h.proben ? `${h.proben} Probe${h.proben === 1 ? "" : "n"}` : ""].filter(Boolean).join(" · ");
  return (
    <section className={`ar-cockpit${live.sitzungen.length ? " mit-live" : ""}`} data-ki="cockpit" aria-label="Was Aras gerade tut">
      <div className="ar-cockpit-oben">
        <div className="ar-status" data-ar="status">
          <Punkt klasse={s.klasse} puls={live.sitzungen.length > 0} />
          <b>{s.satz}</b>
        </div>
        <div className="ar-cockpit-knoepfe">
          <button type="button" className={`ar-knopf klein${lage.leerlauf ? " an" : ""}`} aria-pressed={!!lage.leerlauf} data-ar="leerlauf"
            title="Leerlauf: kein neues Gespräch, ein laufendes endet normal — z. B. vor einem Deploy."
            onClick={() => void schalten("/chef/aras/leerlauf", { an: !lage.leerlauf }, lage.leerlauf ? "Leerlauf aus — Aras darf wieder neu anrufen." : "Leerlauf an — kein neues Gespräch.")}>
            {lage.leerlauf ? "Leerlauf aus" : "Leerlauf"}
          </button>
          {lage.notaus ? (
            <FrageKnopf klasse="haupt" frage="Aras wieder wählen lassen?" ja="Wieder an" data="wieder-an" onJa={() => void schalten("/chef/aras/start", {}, "Not-Aus aufgehoben.")}>Wieder an</FrageKnopf>
          ) : (
            <FrageKnopf klasse="rot" frage="Aras sofort stoppen?" ja="Stoppen" data="notaus" titel="Not-Aus: Aras wählt nicht mehr, laufende Gespräche enden mit einem Abschiedssatz."
              onJa={() => void schalten("/chef/aras/notaus", { grund: "Chefbüro" }, "Not-Aus ist an — Aras ist gestoppt.")}>Not-Aus</FrageKnopf>
          )}
        </div>
      </div>
      <div className="ar-cockpit-fakten">
        <button type="button" className="ar-fakt" onClick={() => onReiter("stufe")} title={STUFEN[stufe].versucheJeTag ? `${STUFEN[stufe].versucheJeTag} Anrufe am Tag · ${STUFEN[stufe].parallel} gleichzeitig` : "Stufe 0: Aras ruft nur dich an (Probe)."}>
          Stufe {stufe} · {STUFEN[stufe].name}
        </button>
        <button type="button" className="ar-fakt" onClick={() => onReiter("einstellungen")}
          title={kundenAn ? "Aras ruft Kunden nach Plan an." : stufe === 0 ? "In Stufe 0 ruft Aras keine Kunden an." : !lage.an ? "„Aras wählt“ ist aus (Einstellungen)." : "Not-Aus ist an."}>
          <Punkt klasse={kundenAn ? "gut" : ""} />Kunden {kundenAn ? "an" : "aus"}
        </button>
        <span className="ar-fakt ar-fakt-geld" title={`KI ${euroText(h.euroKi)} · Telefon ${euroText(h.euroTelefon)}${deckel ? ` · Deckel ${euroText(deckel)}` : ""}`}>
          Heute {euroText(kosten)}{deckel ? <> von {euroText(deckel)}</> : null}
          {deckel ? <span className="ar-balken" aria-hidden="true"><i style={{ width: `${anteil}%` }} className={anteil >= 90 ? "voll" : ""} /></span> : null}
        </span>
        <button type="button" className="ar-fakt" onClick={() => onReiter("anrufe")}>{heuteSatz}</button>
      </div>
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      <div className="ar-cockpit-live" data-ki="live">
        {live.sitzungen.length ? <LiveKaesten live={live} /> : (
          <p className="ar-ruhig-zeile">
            <span>Gerade kein Gespräch.</span>
            <span className="ar-strom" title={live.strom === "offen" ? "Die Live-Verbindung steht — ein Gespräch erscheint hier sofort." : "Die Live-Verbindung wird aufgebaut …"}>
              <Punkt klasse={live.strom === "offen" ? "gut" : live.strom === "verbindet" ? "warn" : ""} />{live.strom === "offen" ? "live verbunden" : live.strom === "verbindet" ? "verbindet …" : "nicht verbunden"}
            </span>
          </p>
        )}
        {!live.sitzungen.length && live.meldung ? <p className={`ar-hinweis${live.meldung.rot ? " rot" : ""}`} role="status">{live.meldung.text}</p> : null}
      </div>
    </section>
  );
}
