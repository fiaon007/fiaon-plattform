import { useCallback, useEffect, useRef, useState } from "react";
import { AgentShell } from "./agent/shared";
import { Reveal } from "./agent/motion";

// ═══════════════════════════════════════════════════════════════════════════
// MAIL-ZENTRALE — der Florentine-Fall in zwanzig Sekunden
//
// „Hi {Anrede}, wie besprochen: {Zahlungsdaten}" — Kunde suchen, tippen,
// senden. Bisher war das eine Nachricht an den Betreiber und ein Wartetag.
//
// Die Bausteine werden SERVERSEITIG je Empfänger gefüllt. Das ist der ganze
// Punkt: Bei zwei Empfängern stehen zwei verschiedene Verwendungszwecke in
// zwei verschiedenen Mails. Würde der Browser das ausfüllen, bekämen beide
// denselben — und die Buchhaltung dürfte raten, von wem das Geld kam.
// ═══════════════════════════════════════════════════════════════════════════

interface Treffer { personId: number | null; name: string; email: string; extern: boolean }
interface Gruppe { schluessel: string; titel: string; anzahl: number }
interface Baustein { marke: string; titel: string; erklaerung: string }

/**
 * Die KI-Marke: der Funken-Bogen der FIAON-Wortmarke.
 *
 * Kein Blitz, kein Stern — beide sind das Klischee, das jede zweite Oberfläche
 * für „KI" benutzt. Dies ist eine aufsteigende Linie mit drei Funken, wie ein
 * Gedanke, der Form annimmt.
 */
function MarkeFunke({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 16c2.4-1.2 4.1-3.1 5.2-5.6C9.3 7.8 11.1 5.9 13.6 5" />
      <path d="M15.4 3.2v3.1M17 4.7h-3.1" />
      <circle cx="6.2" cy="6.4" r="1" />
      <circle cx="16.4" cy="13.6" r="1" />
    </svg>
  );
}

export default function MailZentraleSeite() {
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Treffer[]>([]);
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [aktiveGruppen, setAktiveGruppen] = useState<string[]>([]);
  const [bausteine, setBausteine] = useState<Baustein[]>([]);
  const [maxEmpfaenger, setMaxEmpfaenger] = useState(10);
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [extern, setExtern] = useState("");
  const [vorschau, setVorschau] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const feld = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/fiaon/mail/zentrale/gruppen", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setGruppen(j.gruppen || []);
        setBausteine(j.bausteine || []);
        setMaxEmpfaenger(j.maxEmpfaenger || 10);
      })
      .catch(() => {});
  }, []);

  // Autocomplete ab dem ERSTEN Zeichen — wer „S" tippt, sucht schon.
  useEffect(() => {
    if (suche.trim().length < 1) { setTreffer([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/fiaon/mail/zentrale/suche?q=${encodeURIComponent(suche)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => setTreffer(j?.ok ? j.treffer : []))
        .catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [suche]);

  const auswahl = useCallback(() => ({
    personIds: gewaehlt.filter((g) => g.personId).map((g) => g.personId!),
    gruppen: aktiveGruppen,
    extern: extern.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean),
  }), [gewaehlt, aktiveGruppen, extern]);

  const bausteinEinfuegen = (marke: string) => {
    const el = feld.current;
    if (!el) { setText((t) => `${t}${marke}`); return; }
    const a = el.selectionStart ?? text.length;
    setText(`${text.slice(0, a)}${marke}${text.slice(el.selectionEnd ?? a)}`);
    setTimeout(() => { el.focus(); el.setSelectionRange(a + marke.length, a + marke.length); }, 0);
  };

  const vorschauHolen = async () => {
    setBusy("vorschau");
    const r = await fetch("/api/fiaon/mail/zentrale/vorschau", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auswahl(), betreff, text }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.error || "Vorschau nicht möglich." }); return; }
    setVorschau(j);
  };

  const senden = async () => {
    setBusy("senden");
    const r = await fetch("/api/fiaon/mail/zentrale/senden", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auswahl(), betreff, text, merkmal: vorschau?.merkmal }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Unbekannter Fehler." });
    if (j?.ok) { setVorschau(null); setText(""); setBetreff(""); setGewaehlt([]); setAktiveGruppen([]); }
  };

  const ki = async (art: string) => {
    setBusy(`ki-${art}`);
    const r = await fetch("/api/fiaon/mail/zentrale/ki", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art, eingabe: text }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    if (!j?.ok) { setMeldung({ art: "schlecht", text: j?.grund || "KI nicht verfügbar." }); return; }
    setText(j.text);
    setMeldung({
      art: "gut",
      text: (j.entfernt?.length ?? 0) > 0
        ? `Vorschlag steht. Entschärft wurde: ${j.entfernt.join(", ")} — solche Zusagen dürfen nicht an Kunden.`
        : "Vorschlag steht. Bitte lies ihn, bevor du sendest.",
    });
  };

  const gewaehltGesamt = gewaehlt.length
    + aktiveGruppen.reduce((s, g) => s + (gruppen.find((x) => x.schluessel === g)?.anzahl ?? 0), 0)
    + extern.split(/[,;\s]+/).filter(Boolean).length;

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: 860 }}>
        <Reveal index={0}>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
            <span className="fi-gradient-text">Mail-Zentrale</span>
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
            Kunden suchen, schreiben, senden. Bausteine füllt der Server je Empfänger einzeln.
          </p>
        </Reveal>

        {meldung && (
          <p className="mt-4 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {/* ── Empfänger ────────────────────────────────────────────────── */}
        <Reveal index={1}>
          <div className="fi-karte mt-4 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[.08em] mb-2.5"
               style={{ color: "var(--fi-text-still)" }}>
              Empfänger {gewaehltGesamt > 0 && <span className="fi-zahl">· {gewaehltGesamt}</span>}
            </p>

            {gewaehlt.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {gewaehlt.map((g) => (
                  <span key={g.email} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[12px]"
                        style={{ background: "rgba(29,78,216,.07)", color: "var(--fi-primaer)" }}>
                    {g.name}
                    {g.extern && <span className="text-[10px] font-bold uppercase opacity-70">extern</span>}
                    <button type="button" aria-label={`${g.name} entfernen`}
                            onClick={() => setGewaehlt((l) => l.filter((x) => x.email !== g.email))}
                            className="w-4 h-4 flex items-center justify-center opacity-60">
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                        <path d="m5 5 10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input value={suche} onChange={(e) => setSuche(e.target.value)}
                   placeholder="Name oder E-Mail — auch alte Adressen"
                   className="w-full rounded-xl px-3 py-2.5 text-[13.5px] outline-none"
                   style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)", minHeight: 44 }} />

            {treffer.length > 0 && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--fi-linie)" }}>
                {treffer.slice(0, 8).map((t) => (
                  <button key={t.email} type="button"
                          onClick={() => {
                            setGewaehlt((l) => l.some((x) => x.email === t.email) ? l : [...l, t]);
                            setSuche(""); setTreffer([]);
                          }}
                          className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-slate-50"
                          style={{ boxShadow: "inset 0 -1px 0 var(--fi-linie)" }}>
                    <span className="font-semibold">{t.name}</span>
                    <span className="ml-2" style={{ color: "var(--fi-text-still)" }}>{t.email}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-[.08em] mt-4 mb-2"
               style={{ color: "var(--fi-text-still)" }}>Oder eine Gruppe</p>
            <div className="flex flex-wrap gap-1.5">
              {gruppen.map((g) => {
                const an = aktiveGruppen.includes(g.schluessel);
                return (
                  <button key={g.schluessel} type="button"
                          onClick={() => setAktiveGruppen((l) => an ? l.filter((x) => x !== g.schluessel) : [...l, g.schluessel])}
                          disabled={g.anzahl === 0}
                          className="px-3 py-2 rounded-xl text-[12.5px] font-semibold disabled:opacity-35"
                          style={an
                            ? { background: "var(--fi-primaer)", color: "#fff" }
                            : { background: "var(--fi-seite)", border: "1px solid var(--fi-linie)", color: "var(--fi-text-leise)" }}>
                    {g.titel} <span className="fi-zahl opacity-70">{g.anzahl}</span>
                  </button>
                );
              })}
            </div>

            <input value={extern} onChange={(e) => setExtern(e.target.value)}
                   placeholder="Externe Adressen, mit Komma getrennt"
                   className="w-full mt-3 rounded-xl px-3 py-2.5 text-[13px] outline-none"
                   style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)", minHeight: 42 }} />
            <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
              Testeinträge, DSGVO-Gelöschte und archivierte Datensätze sind immer ausgeschlossen.
              Deine Rolle darf an höchstens {maxEmpfaenger} Empfänger senden.
            </p>
          </div>
        </Reveal>

        {/* ── Inhalt ───────────────────────────────────────────────────── */}
        <Reveal index={2}>
          <div className="fi-karte mt-3 p-4">
            <input value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff"
                   className="w-full text-[15px] font-semibold bg-transparent outline-none pb-2.5"
                   style={{ borderBottom: "1px solid var(--fi-linie)" }} />
            <textarea ref={feld} value={text} onChange={(e) => setText(e.target.value)} rows={9}
                      placeholder="Hi {Anrede}, wie besprochen: {Zahlungsdaten}"
                      className="w-full mt-3 resize-none bg-transparent text-[14px] leading-relaxed outline-none" />

            <div className="mt-2 pt-2.5 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {bausteine.map((b) => (
                <button key={b.marke} type="button" onClick={() => bausteinEinfuegen(b.marke)} title={b.erklaerung}
                        className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold"
                        style={{ background: "var(--fi-seite)", color: "var(--fi-text-leise)" }}>
                  {b.titel}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {[
                { art: "entwurf", titel: "Entwurf aus Stichpunkten" },
                { art: "ton", titel: "Ton glätten" },
                { art: "kuerzen", titel: "Kürzen" },
              ].map((k) => (
                <button key={k.art} type="button" onClick={() => void ki(k.art)} disabled={!!busy || text.trim().length < 3}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold disabled:opacity-40"
                        style={{ background: "rgba(29,78,216,.06)", color: "var(--fi-primaer)" }}>
                  <MarkeFunke size={14} />
                  {busy === `ki-${k.art}` ? "…" : k.titel}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--fi-text-still)" }}>
              Die KI schlägt vor, du sendest. Zusagen zu Limits und das Wort „Beratung" werden automatisch entfernt.
            </p>
          </div>
        </Reveal>

        {/* ── Senden ───────────────────────────────────────────────────── */}
        <Reveal index={3}>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button"
                    onClick={async () => {
                      setBusy("test");
                      const r = await fetch("/api/fiaon/mail/zentrale/test", {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ betreff, text }),
                      }).catch(() => null);
                      const j = await r?.json().catch(() => null);
                      setBusy(null);
                      setMeldung({ art: j?.ok ? "gut" : "schlecht", text: j?.meldung || j?.error || "Fehler." });
                    }}
                    disabled={!!busy || !betreff || !text}
                    className="fi-zweitknopf px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40">
              {busy === "test" ? "…" : "Test an mich"}
            </button>
            <button type="button" onClick={() => void vorschauHolen()}
                    disabled={!!busy || !betreff || !text || gewaehltGesamt === 0}
                    className="fi-primaerknopf ml-auto px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-40">
              {busy === "vorschau" ? "…" : `Vorschau${gewaehltGesamt > 1 ? " (Pflicht)" : ""}`}
            </button>
          </div>
        </Reveal>
      </div>

      {/* ── Pflicht-Vorschau ──────────────────────────────────────────── */}
      {vorschau && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setVorschau(null)} aria-hidden="true"
               style={{ background: "rgba(7,11,22,.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
          <div className="fixed inset-0 z-[401] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
            <div role="dialog" aria-modal="true" aria-label="Vorschau vor dem Versand"
                 className="w-full flex flex-col overflow-hidden pointer-events-auto"
                 style={{ maxWidth: 620, maxHeight: "90vh", background: "#fff",
                          borderRadius: 22, boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
              <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0 fi-glas">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.2em]" style={{ color: "var(--fi-text-still)" }}>
                  So geht es raus
                </p>
                <h2 className="mt-1 text-[19px] font-bold tracking-tight">
                  <span className="fi-gradient-text">{vorschau.anzahl} {vorschau.anzahl === 1 ? "Empfänger" : "Empfänger"}</span>
                </h2>
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--fi-text-still)" }}>
                  {vorschau.empfaenger.map((e: any) => e.name).slice(0, 6).join(", ")}
                  {vorschau.anzahl > 6 && ` und ${vorschau.anzahl - 6} weitere`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4" style={{ background: "var(--fi-seite)" }}>
                <p className="text-[12px] mb-2" style={{ color: "var(--fi-text-still)" }}>
                  Betreff: <b style={{ color: "var(--fi-text)" }}>{vorschau.betreff}</b> — Bausteine sind hier mit den
                  Daten des ersten Empfängers gefüllt; jeder bekommt seine eigenen.
                </p>
                <iframe title="Vorschau" sandbox="" srcDoc={vorschau.html}
                        style={{ width: "100%", height: 420, border: "1px solid var(--fi-linie)", borderRadius: 12, background: "#fff" }} />
              </div>
              <div className="px-5 sm:px-7 py-4 shrink-0 flex flex-wrap items-center gap-2"
                   style={{ borderTop: "1px solid var(--fi-linie)" }}>
                <button type="button" onClick={() => setVorschau(null)}
                        className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                  Zurück zum Text
                </button>
                <button type="button" onClick={() => void senden()} disabled={busy === "senden"}
                        className="fi-primaerknopf ml-auto px-5 py-2.5 text-[14px] font-bold disabled:opacity-40">
                  {busy === "senden" ? "Wird verschickt …" : `An ${vorschau.anzahl} senden`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
