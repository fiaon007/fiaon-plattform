// ═══════════════════════════════════════════════════════════════════════════
// NEUES GESPRÄCH (23.09.2026, E-210/E-220; ausgelagert 28.09.2026, E-248)
//
// Wer nie geschrieben hat, darf nur eine von Meta freigegebene Vorlage
// bekommen. Justin (E-220): „auch nur eine Nummer frei eintippen und
// schreiben" — eine getippte Nummer ist ein gültiges Ziel.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { vorlageNameRoh, type Vorlage } from "./wr-format";

type Ziel = { art: string; id: number; name: string; nummer: string };

export function NeuesGespraech({ api, onZu, onGestartet, melden }: {
  api: string; onZu: () => void; onGestartet: (nummer: string) => void; melden: (t: string) => void;
}) {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<(Ziel & { betreuer: string | null })[]>([]);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [vorlagen, setVorlagen] = useState<{ vorlagen: Vorlage[]; inPruefung: number } | null>(null);
  const [sendet, setSendet] = useState(false);
  const sperre = useRef(false);

  useEffect(() => {
    void fetch(`${api}/vorlagen`, { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.ok) setVorlagen(j); }).catch(() => {});
  }, [api]);
  useEffect(() => {
    if (suche.trim().length < 2) { setTreffer([]); return; }
    const id = window.setTimeout(() => {
      void fetch(`${api}/suche?q=${encodeURIComponent(suche.trim())}`, { credentials: "include" })
        .then((r) => r.json()).then((j) => { if (j?.ok) setTreffer(j.treffer); }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [suche, api]);
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [onZu]);

  // E-220: Eine getippte Ziffernfolge ist ein gültiges Ziel — mit oder ohne
  // Pluszeichen, mit oder ohne Leerzeichen. Deutsche 0-Nummern bekommen die 49.
  const freieNummer = useMemo(() => {
    const roh = suche.replace(/[^\d+]/g, "");
    if (!/\d/.test(roh)) return null;
    let z = roh.replace(/\D/g, "");
    if (roh.startsWith("00")) z = z.slice(2);
    else if (roh.startsWith("0")) z = `49${z.slice(1)}`;
    return z.length >= 10 && z.length <= 15 ? z : null;
  }, [suche]);

  const beginnen = async (vorlage: string) => {
    if (!ziel || sperre.current) return;
    sperre.current = true; setSendet(true);
    try {
      const r = await fetch(`${api}/starten`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // E-230: Die Nummer ist schon fertig und wird als „+…" angezeigt — mit Plus
          // schicken, sonst deutet der Server +1 248 … als deutsche Nummer (+49 1248 …).
          nummer: `+${ziel.nummer}`, vorlage,
          personId: ziel.art === "person" ? ziel.id : null,
          leadId: ziel.art === "lead" ? ziel.id : null,
          // Ohne Namen keine erfundene Anrede — „und willkommen" ist der Weg
          // des Hauses für genau diesen Fall (shared/fiaon-lead-texte.ts).
          werte: [ziel.art === "frei" ? "und willkommen" : ziel.name],
        }),
      });
      const j = await r.json();
      if (!j?.ok) { melden(j?.error || "Das ging nicht raus."); return; }
      melden(`Nachricht an ${ziel.art === "frei" ? `+${ziel.nummer}` : ziel.name} ist unterwegs.`);
      onGestartet(j.nummer);
    } catch { melden("Keine Verbindung."); } finally { sperre.current = false; setSendet(false); }
  };

  return (
    <div className="wr-schleier" role="dialog" aria-modal="true" aria-label="Neues Gespräch" onClick={onZu}>
      <div className="wr-fenster" onClick={(e) => e.stopPropagation()}>
        <div className="wr-fenster-kopf">
          <div>
            <h2>Neues Gespräch</h2>
            <p className="wr-still">Wer nie geschrieben hat, darf nur eine von Meta freigegebene Vorlage bekommen. Antwortet er darauf, könnt ihr 24 Stunden frei schreiben.</p>
          </div>
          <button type="button" className="wr-klein" onClick={onZu}>Schließen</button>
        </div>
        {!ziel ? (
          <>
            <input className="wr-feld" autoFocus value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail oder Nummer" aria-label="Menschen suchen" />
            {freieNummer && (
              <button type="button" className="wr-treffer-zeile wr-frei" onClick={() => setZiel({ art: "frei", id: 0, name: freieNummer, nummer: freieNummer })}>
                <span><b>+{freieNummer}</b> <span className="wr-still">frei eingetippt</span></span>
                <span className="wr-still">An diese Nummer schreiben</span>
              </button>
            )}
            <div className="wr-treffer">
              {suche.trim().length < 2 ? <p className="wr-still">Tippe einen Namen, eine E-Mail oder eine Nummer. Eine Nummer geht auch ohne Datensatz.</p>
                : treffer.length === 0 && !freieNummer ? <p className="wr-still">Niemand gefunden. Tippe die Nummer mit Landesvorwahl, dann geht es trotzdem.</p>
                  : treffer.map((t) => (
                    <button key={`${t.art}-${t.id}`} type="button" className="wr-treffer-zeile" onClick={() => setZiel(t)}>
                      <span><b>{t.name}</b> <span className="wr-still">+{t.nummer}</span></span>
                      <span className="wr-still">{t.art === "lead" ? "Interessent" : "Kunde"}{t.betreuer ? ` · ${t.betreuer}` : ""}</span>
                    </button>
                  ))}
            </div>
          </>
        ) : (
          <>
            <p className="wr-ziel">
              An <b>{ziel.art === "frei" ? `+${ziel.nummer}` : ziel.name}</b>
              {ziel.art !== "frei" && <span className="wr-still"> +{ziel.nummer}</span>}
              {" "}<button type="button" className="wr-klein" onClick={() => setZiel(null)}>ändern</button>
            </p>
            <div className="wr-neu-vorlagen">
              {!vorlagen ? <p className="wr-still">Lädt …</p>
                : vorlagen.vorlagen.length === 0 ? (
                  <p className="wr-still">
                    Noch ist keine Vorlage freigegeben{vorlagen.inPruefung ? ` — ${vorlagen.inPruefung} liegen bei Meta in Prüfung` : ""}.
                    Sobald die erste grün ist, kannst du von hier aus schreiben.
                  </p>
                ) : vorlagen.vorlagen.map((v) => (
                  <div key={v.name} className="wr-karte gross">
                    <div className="wr-karte-inhalt">
                      <b>{v.klartext ?? vorlageNameRoh(v.name)}</b>
                      {v.zweck && <small className="wr-karte-zweck">{v.zweck}</small>}
                      <span className="wr-karte-text lang">{(v.text ?? "").replace("{{1}}", ziel.art === "frei" ? "und willkommen" : ziel.name)}</span>
                    </div>
                    <button type="button" className="wr-karte-senden" disabled={sendet} onClick={() => void beginnen(v.name)}>
                      {sendet ? "Sendet …" : "Senden"}
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
