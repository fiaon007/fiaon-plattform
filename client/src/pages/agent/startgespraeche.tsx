import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell, api } from "./shared";
import { Reveal } from "./motion";
import { Skelett, useToast } from "@/lib/fiaon-ui";
import { LageTafel } from "./vertrieb-service";
import { ZusageTafel } from "./vertrieb-zusage";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/startgespraeche — der Onboarding-Bereich
//
// Fünfzehn Minuten mit einem Menschen, der gerade bezahlt hat. Diese Seite
// beantwortet dafür genau zwei Fragen: Wen spreche ich heute? Und was weiß das
// System schon über ihn?
//
// Was hier NICHT steht: Umsätze, Provisionen, Vertriebslisten, andere Kunden.
// Der Server liefert sie nicht aus (404/403), und die Seite fragt nicht danach.
// ═══════════════════════════════════════════════════════════════════════════

interface Termin {
  id: number;
  personId: number;
  name: string;
  vorname: string | null;
  telefon: string | null;
  email: string | null;
  beginn: string;
  datum: string;
  datumText: string;
  uhrzeit: string;
  dauerMin: number;
  status: string;
  notiz: string | null;
  heute: boolean;
  vorbei: boolean;
}

interface Kennzahlen {
  dieseWoche: number; offen: number; erledigt: number; verpasst: number;
  erledigungsquote: number | null; noShowQuote: number | null;
}

export default function AgentStartgespraecheSeite() {
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  const { zeige } = useToast();
  const [termine, setTermine] = useState<Termin[]>([]);
  const [zahlen, setZahlen] = useState<Kennzahlen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [keinZugang, setKeinZugang] = useState(false);
  const [zusageOffen, setZusageOffen] = useState(false);
  const [ansicht, setAnsicht] = useState<"liste" | "kalender">("liste");
  const [offen, setOffen] = useState<number | null>(null);

  const laden = useCallback(async () => {
    const r = await api("/agent/startgespraeche".replace("/startgespraeche", "/onboarding/termine"));
    if (r.status === 404) { setKeinZugang(true); setLaedt(false); return; }
    if (r.status === 403 && r.json?.code === "zusage_erforderlich") { setZusageOffen(true); setLaedt(false); return; }
    if (r.ok) setTermine(r.json.termine || []);
    const k = await api("/agent/onboarding/kennzahlen");
    if (k.ok) setZahlen(k.json);
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  /** Nach Tagen gruppieren — der Kalenderblick ist eine Tagesspalte, keine Matrix. */
  const tage = useMemo(() => {
    const map = new Map<string, Termin[]>();
    for (const t of termine.filter((x) => x.status === "gebucht" || x.heute)) {
      const l = map.get(t.datum) || [];
      l.push(t);
      map.set(t.datum, l);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [termine]);

  if (zusageOffen) {
    return (
      <ZusageTafel
        basis="/agent/onboarding/zusage"
        onAngenommen={() => { setZusageOffen(false); setLaedt(true); void laden(); }}
      />
    );
  }

  if (keinZugang) {
    return (
      <div className="fi-karte p-8 text-center max-w-lg mx-auto">
        <p className="text-[15px] font-semibold">Nicht gefunden.</p>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>
          Diese Seite gibt es für dein Konto nicht.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: "var(--fi-breite-max)" }}>
        <Reveal index={0}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
                <span className="fi-gradient-text">Startgespräche</span>
              </h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
                Fünfzehn Minuten, in denen ein Kunde das System einmal erklärt bekommt.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(["liste", "kalender"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setAnsicht(a)}
                        className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                        style={ansicht === a
                          ? { background: "var(--fi-primaer)", color: "#fff" }
                          : { background: "#fff", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                  {a === "liste" ? "Liste" : "Kalender"}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Kennzahlen ─────────────────────────────────────────────────── */}
        <Reveal index={1}>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { t: "Diese Woche", w: zahlen?.dieseWoche, h: "Gebuchte Gespräche seit Montag." },
              { t: "Offen", w: zahlen?.offen, h: "Termine, die noch bevorstehen." },
              { t: "Erledigungsquote", w: zahlen?.erledigungsquote != null ? `${zahlen.erledigungsquote} %` : "—",
                h: "Anteil geführter Gespräche an allen, die stattfinden sollten." },
              { t: "Nicht erschienen", w: zahlen?.noShowQuote != null ? `${zahlen.noShowQuote} %` : "—",
                h: "Anteil der Kunden, die nicht ans Telefon gegangen sind." },
            ].map((f) => (
              <div key={f.t} className="fi-karte p-4" title={f.h}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[.08em]" style={{ color: "var(--fi-text-still)" }}>
                  {f.t}
                </p>
                {zahlen ? (
                  <p className="text-[24px] font-bold leading-none mt-1.5 fi-zahl">{f.w ?? 0}</p>
                ) : <Skelett h={26} w={48} className="mt-1.5" />}
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── Termine ────────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-3">
          {laedt && [0, 1].map((i) => <div key={i} className="fi-karte p-4"><Skelett h={20} /></div>)}

          {!laedt && tage.length === 0 && (
            <div className="fi-karte p-6 text-center">
              <p className="text-[14px] font-semibold">Kein Startgespräch gebucht.</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                Bezahlte Kunden werden beim ersten Login eingeladen und wählen ihre Zeit selbst.
                Trag deine Erreichbarkeit unter „Mehr“ → „Profil“ ein, damit dort Zeiten stehen.
              </p>
            </div>
          )}

          {!laedt && ansicht === "kalender" && tage.length > 0 && (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {tage.map(([datum, liste]) => (
                <div key={datum} className="fi-karte p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2.5"
                     style={{ color: liste[0].heute ? "#059669" : "var(--fi-text-still)" }}>
                    {liste[0].heute ? "Heute" : liste[0].datumText}
                  </p>
                  <div className="space-y-1.5">
                    {liste.map((t) => (
                      <button key={t.id} type="button" onClick={() => { setAnsicht("liste"); setOffen(t.id); }}
                              className="w-full text-left px-2.5 py-2 rounded-lg"
                              style={{ background: "var(--fi-seite)", border: "1px solid var(--fi-linie)" }}>
                        <span className="block text-[13px] font-bold fi-zahl">{t.uhrzeit}</span>
                        <span className="block text-[12px] truncate" style={{ color: "var(--fi-text-leise)" }}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!laedt && ansicht === "liste" && tage.map(([datum, liste]) => (
            <div key={datum}>
              <p className="text-[11px] font-semibold uppercase tracking-[.09em] mb-2 mt-4"
                 style={{ color: liste[0].heute ? "#059669" : "var(--fi-text-still)" }}>
                {liste[0].heute ? "Heute" : liste[0].datumText}
              </p>
              <div className="space-y-2.5">
                {liste.map((t, i) => (
                  <TerminKarte key={t.id} termin={t} index={i} offen={offen === t.id}
                               onOeffnen={() => setOffen(offen === t.id ? null : t.id)}
                               onFertig={laden} zeige={zeige} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TerminKarte({
  termin, index, offen, onOeffnen, onFertig, zeige,
}: {
  termin: Termin; index: number; offen: boolean;
  onOeffnen: () => void; onFertig: () => void; zeige: ReturnType<typeof useToast>["zeige"];
}) {
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const dokumentieren = async (ergebnis: "erledigt" | "verpasst") => {
    setBusy(ergebnis);
    const r = await api(`/agent/onboarding/termine/${termin.id}/ergebnis`, {
      method: "POST", body: JSON.stringify({ ergebnis, notiz: notiz.trim() || undefined }),
    });
    setBusy(null);
    if (!r.ok) { zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    zeige("erfolg", "Festgehalten", r.json.hinweis || "");
    setNotiz("");
    onFertig();
  };

  const einladen = async () => {
    setBusy("einladung");
    const r = await api(`/agent/onboarding/person/${termin.personId}/einladung`, { method: "POST" });
    setBusy(null);
    zeige(r.ok ? "erfolg" : "info", r.ok ? "Einladung verschickt" : "Nicht verschickt",
      r.ok ? `An ${termin.email}` : (r.json?.error || r.json?.grund || "Bitte später erneut."));
  };

  return (
    <Reveal index={Math.min(index, 6)}>
      <div className="fi-karte relative overflow-hidden">
        <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: termin.heute ? "#059669" : "var(--fi-linie)" }} />
        <div className="p-4 sm:p-5 pl-5 sm:pl-6">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-[58px] text-center">
              <span className="block text-[16px] font-bold fi-zahl leading-none">{termin.uhrzeit}</span>
              <span className="block text-[10.5px] mt-0.5" style={{ color: "var(--fi-text-still)" }}>
                {termin.dauerMin} Min
              </span>
            </span>
            <button type="button" onClick={onOeffnen} className="flex-1 min-w-0 text-left">
              <p className="text-[15.5px] font-bold leading-tight truncate">{termin.name}</p>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--fi-text-still)" }}>
                {termin.telefon || "keine Nummer hinterlegt"}
                {termin.status !== "gebucht" && ` · ${termin.status === "erledigt" ? "erledigt" : "nicht erschienen"}`}
              </p>
            </button>
            {termin.telefon && (
              <a href={`tel:${termin.telefon}`} className="fi-primaerknopf shrink-0 px-3.5 py-2 text-[12.5px] font-semibold">
                Anrufen
              </a>
            )}
          </div>

          {offen && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {/* Die Lage — dieselbe Tafel wie im Vertriebsbereich, nur über
                  einen Endpunkt, der ausschließlich lesend ist. */}
              <LageTafel personId={termin.personId} basis="/agent/onboarding/person" />

              {termin.status === "gebucht" && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--fi-linie)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2"
                     style={{ color: "var(--fi-text-still)" }}>
                    Ergebnis festhalten
                  </p>
                  <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
                            placeholder="Notiz zum Gespräch — landet im Verlauf des Kunden."
                            className="w-full resize-none rounded-xl px-3 py-2 text-[13px] outline-none"
                            style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)" }} />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void dokumentieren("erledigt")} disabled={!!busy}
                            className="fi-primaerknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "erledigt" ? "…" : "Gespräch geführt"}
                    </button>
                    <button type="button" onClick={() => void dokumentieren("verpasst")} disabled={!!busy}
                            className="fi-zweitknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "verpasst" ? "…" : "Nicht erschienen"}
                    </button>
                    <button type="button" onClick={() => void einladen()} disabled={!!busy}
                            className="fi-zweitknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                      {busy === "einladung" ? "…" : "Einladung erneut senden"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
                    „Nicht erschienen“ zählt wie ein erfolgloser Anruf und lädt den Kunden erneut ein.
                  </p>
                </div>
              )}

              {termin.notiz && (
                <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                  Notiz: {termin.notiz}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}
