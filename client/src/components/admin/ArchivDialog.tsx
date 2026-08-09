// ═══════════════════════════════════════════════════════════════════════════
// ARCHIV-DIALOG — löschen, ohne zu löschen
//
// Der Knopf, der bisher fehlte. Im Bestand liegen Bestellungen, die es fachlich
// nicht gibt: dreimal derselbe Antrag, weil der Kunde ihn dreimal angefangen
// hat; Testeinträge; ein von Agenten gemeldeter Fake-Account. Sie standen in
// jeder Arbeitsliste und machten jede Liste ein Stück unglaubwürdiger.
//
// Der Dialog sagt VORHER, was passiert und was nicht — und er sagt auch, wenn
// er nicht kann: Bei einer bezahlten Bestellung oder einer gebuchten Provision
// ist der Knopf gesperrt, mit der Begründung als Text daneben. Ein Knopf, der
// still nichts tut, ist schlimmer als keiner.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

export interface ArchivPfade {
  /** Prüfung (GET), `:ref` wird ersetzt */
  pruefung: string;
  /** Archivieren (POST), `:ref` wird ersetzt */
  archivieren: string;
  /** Wiederherstellen (POST), `:ref` wird ersetzt — nur Admin */
  wiederherstellen?: string;
}

type Pruefung = {
  ref: string; archivierbar: boolean; sperrgrund: string | null;
  bereitsArchiviert: boolean; archiviertAm: string | null; archivGrund: string | null;
  archivNotiz: string | null; archiviertVon: string | null;
  zahlungsStatus: string | null; provisionen: number;
};

const GRUENDE = [
  { key: "doppelt", text: "Doppelt angelegt" },
  { key: "testeintrag", text: "Testeintrag" },
  { key: "widerrufen", text: "Kunde widerrufen" },
  { key: "sonstiges", text: "Sonstiges" },
] as const;

const GRUND_TEXT: Record<string, string> = Object.fromEntries(GRUENDE.map((g) => [g.key, g.text]));

async function hole(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const datum = (v: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
};

// `bestellung` und nicht `ref`: React fängt eine Eigenschaft namens `ref`
// selbst ab — sie käme in diesem Bauteil nie an, und der Dialog wäre ohne
// Fehlermeldung leer.
export default function ArchivDialog({ bestellung: bestellRef, pfade, offen, aufSchliessen, aufFertig }: {
  bestellung: string;
  pfade: ArchivPfade;
  offen: boolean;
  aufSchliessen: () => void;
  aufFertig?: () => void;
}) {
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [grund, setGrund] = useState<string>("doppelt");
  const [notiz, setNotiz] = useState("");
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!offen) return;
    setLaedt(true); setFehler(null);
    void (async () => {
      const { ok, json } = await hole(pfade.pruefung.replace(":ref", encodeURIComponent(bestellRef)));
      if (ok) setPruefung(json.pruefung);
      else setFehler(json?.error || "Die Prüfung ließ sich nicht laden.");
      setLaedt(false);
    })();
  }, [offen, bestellRef, pfade.pruefung]);

  if (!offen) return null;

  const archivieren = async () => {
    setBeschaeftigt(true); setFehler(null);
    const { ok, json } = await hole(pfade.archivieren.replace(":ref", encodeURIComponent(bestellRef)), {
      method: "POST",
      body: JSON.stringify({ grund, notiz: notiz.trim() || null }),
    });
    setBeschaeftigt(false);
    if (ok) { aufFertig?.(); aufSchliessen(); }
    else setFehler(json?.error || "Archivieren fehlgeschlagen — es wurde nichts geändert.");
  };

  const wiederherstellen = async () => {
    if (!pfade.wiederherstellen) return;
    setBeschaeftigt(true); setFehler(null);
    const { ok, json } = await hole(pfade.wiederherstellen.replace(":ref", encodeURIComponent(bestellRef)), {
      method: "POST", body: JSON.stringify({}),
    });
    setBeschaeftigt(false);
    if (ok) { aufFertig?.(); aufSchliessen(); }
    else setFehler(json?.error || "Wiederherstellen fehlgeschlagen.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
         style={{ background: "rgba(7,11,22,.55)" }} onClick={aufSchliessen}>
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl border border-slate-200 max-h-full overflow-y-auto"
           style={{ boxShadow: "0 4px 8px rgba(15,23,42,.07), 0 22px 50px rgba(29,78,216,.15)" }}
           onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,.86)", backdropFilter: "blur(20px) saturate(180%)" }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-slate-900">
              {pruefung?.bereitsArchiviert ? "Bestellung im Archiv" : "Bestellung archivieren"}
            </h3>
            <p className="text-[11.5px] text-slate-500 font-mono">{bestellRef}</p>
          </div>
          <button type="button" onClick={aufSchliessen}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-600 hover:border-slate-300">
            Schließen
          </button>
        </header>

        <div className="p-4 sm:p-5 space-y-4">
          {laedt ? (
            <p className="text-[13px] text-slate-400">Lädt …</p>
          ) : !pruefung ? (
            <p className="text-[13px] text-rose-700">{fehler}</p>
          ) : pruefung.bereitsArchiviert ? (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-[13px] text-slate-800">
                  Archiviert am <b>{datum(pruefung.archiviertAm)}</b>
                  {pruefung.archiviertVon ? <> von <b>{pruefung.archiviertVon}</b></> : null}.
                </p>
                <p className="text-[12.5px] text-slate-600 mt-1">
                  Grund: <b>{GRUND_TEXT[String(pruefung.archivGrund)] ?? pruefung.archivGrund}</b>
                  {pruefung.archivNotiz ? ` — ${pruefung.archivNotiz}` : ""}
                </p>
                <p className="text-[12px] text-slate-500 mt-2 leading-snug">
                  Diese Bestellung erscheint in keiner Arbeits-, Verteilungs- oder Zahlungsliste und in
                  keiner Kennzahl. Sie ist nicht gelöscht: Verlauf, Rechnungsnummer und Zahlungsspur
                  bleiben erhalten.
                </p>
              </div>
              {pfade.wiederherstellen ? (
                <button type="button" onClick={() => void wiederherstellen()} disabled={beschaeftigt}
                  className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: "#2563eb" }}>
                  {beschaeftigt ? "Hole zurück …" : "Aus dem Archiv zurückholen"}
                </button>
              ) : (
                <p className="text-[12.5px] text-slate-500">
                  Zurückholen kann nur der Vorgesetzte.
                </p>
              )}
            </>
          ) : !pruefung.archivierbar ? (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50">
              <p className="text-[13px] font-bold text-amber-900">Archivieren ist hier gesperrt</p>
              <p className="text-[12.5px] text-amber-900 mt-1 leading-snug">{pruefung.sperrgrund}</p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-slate-700 leading-snug">
                Die Bestellung verschwindet aus Arbeitslisten, Verteilung, Erinnerungen, Zahlungslisten
                und Kennzahlen. Sie wird <b>nicht gelöscht</b> und bleibt in der Akte unter „Archiv"
                sichtbar — mit Grund, Zeitpunkt und Namen. Zurückholen kann der Vorgesetzte jederzeit.
              </p>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Grund (Pflicht)
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {GRUENDE.map((g) => {
                    const an = grund === g.key;
                    return (
                      <button key={g.key} type="button" onClick={() => setGrund(g.key)}
                        className={`text-left px-3 py-2 rounded-lg border text-[13px] font-semibold ${an
                          ? "border-slate-900 bg-slate-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {g.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  {grund === "sonstiges" ? "Erklärung (Pflicht)" : "Notiz (freiwillig)"}
                </label>
                <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
                  placeholder={grund === "sonstiges"
                    ? "In einem Satz: warum gibt es diese Bestellung nicht?"
                    : "Optional: ein Satz zur Einordnung"}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400" />
              </div>

              {fehler && (
                <p className="text-[12.5px] text-rose-700 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                  {fehler}
                </p>
              )}

              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => void archivieren()}
                  disabled={beschaeftigt || (grund === "sonstiges" && notiz.trim().length < 5)}
                  className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: "#2563eb" }}>
                  {beschaeftigt ? "Archiviere …" : "Ins Archiv legen"}
                </button>
                <button type="button" onClick={aufSchliessen} disabled={beschaeftigt}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600">
                  Abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
