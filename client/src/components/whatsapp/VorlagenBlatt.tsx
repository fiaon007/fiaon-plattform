// ═══════════════════════════════════════════════════════════════════════════
// DAS „+"-BLATT (E-248) — Vorlagen und persönliche Links
//
// VORHER war die Vorlagenliste eine vierte Zeile UNTER der Eingabe: Sie
// quetschte den Verlauf von 420 auf 140 px (Handy 64 px), schob das Feld hoch
// und zeigte Namen wie „Kkb Anfrage". Die Links „Antrag/Termin" setzten den
// NACKTEN /start- und /termin-Link ein — genau das, was Justin am 28.09.
// bei Mara bemängelt hat.
//
// NACHHER liegt das Blatt ÜBER dem Verlauf (am Handy als Blatt von unten),
// verkleinert nichts, zeigt Klartextnamen mit einer Zeile Vorschau und bietet
// nur die PERSÖNLICHEN Links dieses Menschen an — der, der zu seiner Lage
// passt, steht vorn.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { vorlageNameRoh, type RaumLinks, type Vorlage } from "./wr-format";

const LINK_TEXT: Record<"antrag" | "zahlung" | "termin" | "bereich", { knopf: string; hilfe: string }> = {
  antrag: { knopf: "Antragslink", hilfe: "persönlicher Code — führt in den eigenen Antrag" },
  zahlung: { knopf: "Zahlungsseite", hilfe: "mit der eigenen Referenz" },
  termin: { knopf: "Terminlink", hilfe: "persönlich — Zeiten des Betreuers, in der Sie-Form" },
  bereich: { knopf: "Kundenbereich", hilfe: "Anmeldung im Bereich" },
};

// Nachbesserung E-248 (Befund Foto: Stufe-B-Kunde mit offener Rechnung bekam „Monatsrate" und
// „Antrag fortsetzen" angeboten): Welche Vorlage zu welcher Stufe passt. Fehlt eine Vorlage hier,
// passt sie immer (Erstkontakt, Gespräch anbieten …). Die passenden stehen vorn, die anderen
// grau mit Hinweis — nutzbar bleiben sie (der Mensch entscheidet).
const PASST: Record<string, string[]> = {
  rate: ["kunde"], aktiviert: ["kunde"], unterlagen: ["kunde"], auskunft: ["kunde"], empfehlung: ["kunde"],
  antrag_offen: ["antrag_offen", "lead"], tag1: ["antrag_offen", "lead"], tag3: ["antrag_offen", "lead"], tag7: ["antrag_offen", "lead"],
  rechnung: ["zahlung_offen"], aktivierung: ["zahlung_offen"], letzte: ["zahlung_offen"],
};
export function vorlagePasst(name: string, stufe: string | null | undefined): boolean {
  if (!stufe) return true;
  const kern = String(name).replace(/^fiaon_kkb?_/, "").replace(/^fiaon_/, "");
  const liste = PASST[kern];
  return !liste || liste.includes(String(stufe));
}

export function VorlagenBlatt({ vorlagen, links, name, fensterOffen, sendet, onVorlage, onLink, onZu }: {
  vorlagen: Vorlage[]; links: RaumLinks | null; name: string | null; fensterOffen: boolean; sendet: boolean;
  onVorlage: (v: Vorlage) => void; onLink: (url: string) => void; onZu: () => void;
}) {
  const [suche, setSuche] = useState("");
  const [vorschau, setVorschau] = useState<string | null>(null);
  const blatt = useRef<HTMLDivElement>(null);

  // Escape schließt; ein Klick außerhalb auch (der „+"-Knopf schaltet selbst).
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onZu(); } };
    const klick = (e: PointerEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (!blatt.current || !ziel || blatt.current.contains(ziel) || ziel.closest(".wr-plus, .wr-zu-zeile")) return;
      onZu();
    };
    window.addEventListener("keydown", taste);
    window.addEventListener("pointerdown", klick);
    return () => { window.removeEventListener("keydown", taste); window.removeEventListener("pointerdown", klick); };
  }, [onZu]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = q ? vorlagen.filter((v) => `${v.klartext ?? ""} ${v.name} ${v.zweck ?? ""} ${v.text ?? ""}`.toLowerCase().includes(q)) : vorlagen;
    // Passende zuerst (stabil sortiert).
    return liste.map((v, i) => ({ v, i, p: vorlagePasst(v.name, links?.stufe) }))
      .sort((a, b) => Number(b.p) - Number(a.p) || a.i - b.i).map((x) => x.v);
  }, [suche, vorlagen, links?.stufe]);

  const linkReihe = (["antrag", "zahlung", "termin", "bereich"] as const)
    .filter((k) => !!links?.[k])
    .sort((a, b) => (a === links?.empfohlen ? -1 : b === links?.empfohlen ? 1 : 0));

  const einsetzen = (t: string) => t.replace(/\{\{1\}\}/g, name?.trim() || "und willkommen").replace(/\{\{\d+\}\}/g, "…");

  return (
    <div className="wr-blatt" ref={blatt} role="dialog" aria-label="Vorlagen und Links">
      <div className="wr-blatt-griff" aria-hidden="true" />
      <div className="wr-blatt-kopf">
        <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Vorlage suchen" aria-label="Vorlage suchen" />
        <button type="button" className="wr-klein" onClick={onZu}>Schließen</button>
      </div>

      {fensterOffen && (linkReihe.length > 0 || links?.terminHinweis) && (
        <div className="wr-blatt-links">
          <p className="wr-blatt-titel">Persönliche Links — ein Klick setzt sie in den Text</p>
          <div className="wr-blatt-linkreihe">
            {linkReihe.map((k) => (
              <button key={k} type="button" className={k === links?.empfohlen ? "empfohlen" : ""} title={`${LINK_TEXT[k].hilfe}: ${links?.[k]}`}
                onClick={() => onLink(String(links?.[k]))}>
                {LINK_TEXT[k].knopf}{k === links?.empfohlen && <span> · passt zur Lage</span>}
              </button>
            ))}
          </div>
          {links?.terminHinweis && <p className="wr-still">{links.terminHinweis}</p>}
        </div>
      )}

      <div className="wr-blatt-liste">
        <p className="wr-blatt-titel">{fensterOffen ? "Freigegebene Vorlagen" : "Das Fenster ist zu — nur eine freigegebene Vorlage geht"}</p>
        {vorlagen.length === 0 ? <p className="wr-leer">Noch keine Vorlage freigegeben — Meta prüft sie gerade.</p>
          : gefiltert.length === 0 ? <p className="wr-leer">Keine Vorlage passt zu „{suche}“.</p>
            : gefiltert.map((v) => {
              const text = einsetzen(v.text ?? "");
              const auf = vorschau === v.name;
              const passt = vorlagePasst(v.name, links?.stufe);
              // Nachbesserung E-248: zweistufig — erst die Vorschau aufklappen, dann „Diese Vorlage
              // senden". Vorher schickte ein Fehlgriff neben den Links sofort eine Vorlage.
              return (
                <div key={v.name} className={`wr-karte${auf ? " auf" : ""}${passt ? "" : " passt-nicht"}`}>
                  <button type="button" className="wr-karte-inhalt" onClick={() => setVorschau(auf ? null : v.name)} aria-expanded={auf}>
                    <b>{v.klartext ?? vorlageNameRoh(v.name)}</b>
                    {!passt && <small className="wr-karte-zweck">passt nicht zu seiner Lage</small>}
                    {v.zweck && <small className="wr-karte-zweck">{v.zweck}</small>}
                    <span className="wr-karte-text">{text}</span>
                  </button>
                  {auf ? (
                    <button type="button" className="wr-karte-senden" disabled={sendet} onClick={() => onVorlage(v)}>
                      {sendet ? "Sendet …" : "Diese Vorlage senden"}
                    </button>
                  ) : (
                    <button type="button" className="wr-karte-senden wr-karte-ansehen" onClick={() => setVorschau(v.name)}>Ansehen</button>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}
