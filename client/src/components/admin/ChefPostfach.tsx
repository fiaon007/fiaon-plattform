// ═══════════════════════════════════════════════════════════════════════════
// DAS POSTFACH (04.09.2026, Neubau nach Justins Entwurf-Freigabe)
//
// JUSTIN am 04.09.: „Das sieht schrecklich aus als Postfach, man kann es kaum
// bedienen, ist total unübersichtlich, ich kann nicht ganz nach unten
// scrollen. Mach das bitte funktionsfähig, Schrift bisschen kleiner, verwende
// die ganze volle Seite."
//
// WAS ANDERS IST:
//   · Zwei Spalten statt drei — die Ordner sind Reiter über der Liste.
//   · Genau ZWEI Scrollbereiche (Liste, Brief). Der Brief scrollt als ein
//     Stück, nicht in vier Kästchen. Die alte Fassung hatte eine feste Höhe
//     mit drei inneren Scrollern; bei kleinerem Fenster erwischte man keinen
//     davon — deshalb „kann nicht nach unten scrollen".
//   · Schrift durchgehend kleiner (Liste 12px, Meta 10.5px, Marken 8.5px).
//   · Der getippte Entwurf überlebt das Blättern — er wird je Vorgang gemerkt.
//   · Was Mara GETAN hat (Notiz, Link, Mahnstopp) steht als „Bereits
//     erledigt" über dem Entwurf. Das ist die Antwort auf Justins Frage
//     „macht der Agent dann schon einen Weg?": ja — und hier steht welchen.
//
// Die Logik (laden, öffnen, senden, verwerfen, mehrere) ist unverändert
// übernommen; nur die Darstellung ist neu.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/chef-postfach.css";

type Ordner = "offen" | "gesendet" | "geordnet" | "kein_kunde" | "alle";

const ORDNER: { key: Ordner; name: string; zaehler: string }[] = [
  { key: "offen", name: "Zu prüfen", zaehler: "offen" },
  { key: "gesendet", name: "Gesendet", zaehler: "gesendet" },
  { key: "geordnet", name: "Eingeordnet", zaehler: "geordnet" },
  { key: "kein_kunde", name: "Kein Kunde", zaehler: "kein_kunde" },
  { key: "alle", name: "Alle", zaehler: "" },
];

const LAGE_TEXT: Record<string, string> = {
  interessent: "Interessent", unbezahlt: "nicht bezahlt", zahlung_gemeldet: "Zahlung gemeldet",
  bezahlt_ohne_startgespraech: "wartet auf Startgespräch", aktiv: "aktiv",
  rate_ueberfaellig: "Rate überfällig", gekuendigt: "gekündigt", bestreitet: "bestreitet",
  gesperrt: "gesperrt", fremd: "kein Kunde", unklar: "unklar",
};

const FLAG_TEXT: Record<string, { text: string; ton: "warn" | "rot" | "grau" }> = {
  kuendigung: { text: "Kündigung", ton: "rot" },
  bestreitet: { text: "Bestreitet", ton: "rot" },
  widerruf: { text: "Widerruf", ton: "rot" },
  beschwerde: { text: "Beschwerde", ton: "warn" },
  rechtlich: { text: "Rechtlich", ton: "rot" },
  droht_anwalt: { text: "Anwalt", ton: "rot" },
  stopp: { text: "Stopp", ton: "grau" },
  zahlung_behauptet: { text: "Sagt: bezahlt", ton: "warn" },
  rueckruf_wunsch: { text: "Rückruf", ton: "grau" },
  zahlungsunfaehig: { text: "Kann nicht zahlen", ton: "warn" },
};

async function hole(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, { credentials: "include", ...init });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Fehler ${res.status}`);
  return j;
}

function zeit(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const gleich = d.toDateString() === new Date().toDateString();
  return gleich
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function datumZeit(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function euro(v: unknown): string {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : String(v ?? "");
}

export default function ChefPostfach() {
  const [ordner, setOrdner] = useState<Ordner>("offen");
  const [postfach, setPostfach] = useState("");
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<any[]>([]);
  const [zaehler, setZaehler] = useState<Record<string, number>>({});
  const [kopf, setKopf] = useState<any>(null);
  const [offenId, setOffenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [entwuerfe, setEntwuerfe] = useState<Record<number, string>>({});
  const [markiert, setMarkiert] = useState<number[]>([]);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "warn"; text: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const textFeld = useRef<HTMLTextAreaElement>(null);
  const briefRef = useRef<HTMLDivElement>(null);

  // Der Entwurf je Vorgang — überlebt das Blättern.
  const entwurf = offenId != null ? (entwuerfe[offenId] ?? String(detail?.eintrag?.antwort ?? "")) : "";
  const entwurfSetzen = (t: string) => { if (offenId != null) setEntwuerfe((e) => ({ ...e, [offenId]: t })); };

  // 04.09.2026 (E-115): Die drei Schalter aus dem Entwurf — je Vorgang gemerkt.
  type Wahl = { anhaenge: boolean; aufgabe: boolean; aufgabeTitel: string; aufgabeText: string; aufgabeTage: number; aufgabeDringend: boolean; kuendigung: boolean; nachZahlung: boolean };
  const [wahlen, setWahlen] = useState<Record<number, Wahl>>({});
  const wahlRef = useRef<Record<number, Wahl>>({});
  wahlRef.current = wahlen;
  const wahlVorgabe = (E: any, A: any): Wahl => {
    const flags = E?.flags || {};
    const handlungen: any[] = Array.isArray(E?.handlungen) ? E.handlungen : [];
    const schonGekuendigt = !!E?.vertrag?.gekuendigtAm || handlungen.some((h) => h.werkzeug === "kuendigung_vormerken" && h.ok);
    const name = A?.name || String(E?.von || "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
    return {
      anhaenge: E?.naechsterSchritt?.art === "zahlung" || (Array.isArray(E?.anhaenge) && E.anhaenge.length > 0),
      aufgabe: false,
      aufgabeTitel: `${name}: ${String(E?.zusammenfassung || E?.betreff || "").slice(0, 70)}`.slice(0, 120),
      aufgabeText: String(E?.zusammenfassung || "").slice(0, 600),
      aufgabeTage: 2, aufgabeDringend: !!E?.dringend,
      kuendigung: !!flags.kuendigung && !schonGekuendigt && !!E?.ref,
      nachZahlung: true,
    };
  };
  const wahlVon = (id: number, E: any, A: any): Wahl => wahlen[id] ?? wahlVorgabe(E, A);
  const wahlSetzen = (id: number, E: any, A: any, teil: Partial<Wahl>) => setWahlen((w) => ({ ...w, [id]: { ...(w[id] ?? wahlVorgabe(E, A)), ...teil } }));

  const laden = useCallback(async (leise = false) => {
    try {
      const p = new URLSearchParams({ ordner, ...(postfach ? { postfach } : {}), ...(suche ? { suche } : {}) });
      const [l, k] = await Promise.all([
        hole(`/admin/postmeister/postfach?${p}`),
        hole("/admin/postmeister/kopf").catch(() => null),
      ]);
      setListe(l.zeilen ?? []);
      setZaehler(l.zaehler ?? {});
      if (k) setKopf(k);
      setFehler(null);
    } catch (e: any) {
      if (!leise) setFehler(String(e?.message || e));
    }
  }, [ordner, postfach, suche]);

  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    const t = setInterval(() => void laden(true), 30_000);
    return () => clearInterval(t);
  }, [laden]);
  useEffect(() => { if (meldung) { const t = setTimeout(() => setMeldung(null), 6000); return () => clearTimeout(t); } }, [meldung]);

  const oeffnen = useCallback(async (id: number) => {
    setOffenId(id); setDetail(null); setMeldung(null);
    try {
      const d = await hole(`/admin/postmeister/eintrag/${id}`);
      setDetail(d);
      if (briefRef.current) briefRef.current.scrollTop = 0;
    } catch (e: any) { setFehler(String(e?.message || e)); }
  }, []);

  const senden = useCallback(async (id: number, text?: string) => {
    setLaeuft(`senden-${id}`);
    try {
      const r = await fetch(`/api/fiaon/admin/postmeister/eintrag/${id}/senden`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text ?? null,
          anhaenge: wahlRef.current[id]?.anhaenge ?? null,
          aufgabe: wahlRef.current[id]?.aufgabe && wahlRef.current[id]?.aufgabeTitel
            ? { titel: wahlRef.current[id].aufgabeTitel, text: wahlRef.current[id].aufgabeText, faelligInTagen: wahlRef.current[id].aufgabeTage, dringend: wahlRef.current[id].aufgabeDringend }
            : null,
          kuendigung: wahlRef.current[id]?.kuendigung ? { vormerken: true, nachZahlung: wahlRef.current[id].nachZahlung } : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        const zusatz = Array.isArray(j.erledigt) && j.erledigt.length ? ` ${j.erledigt.join(" ")}` : "";
        setMeldung({ art: "gut", text: `Antwort ist raus.${zusatz}` });
        setWahlen((w) => { const n = { ...w }; delete n[id]; return n; });
        setEntwuerfe((e) => { const n = { ...e }; delete n[id]; return n; });
        setOffenId(null); setDetail(null); await laden();
      } else setMeldung({ art: "warn", text: j?.grund || j?.error || "Konnte nicht gesendet werden." });
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [laden]);

  // 04.09.2026 (E-119): Alle Entwürfe mit dem heutigen Stand neu schreiben lassen.
  const [neuLauf, setNeuLauf] = useState<any>(null);
  const neuLaufLaden = useCallback(async () => {
    try { const j = await hole("/admin/postmeister/neu-bearbeiten"); setNeuLauf(j); } catch { /* still */ }
  }, []);
  useEffect(() => { void neuLaufLaden(); }, [neuLaufLaden]);
  useEffect(() => {
    if (!neuLauf?.lauf?.laeuft) return;
    const t = setInterval(() => { void neuLaufLaden(); void laden(true); }, 10_000);
    return () => clearInterval(t);
  }, [neuLauf?.lauf?.laeuft, neuLaufLaden, laden]);
  const neuSchreiben = useCallback(async () => {
    const n = Number(neuLauf?.wartend?.entwuerfe || 0) + Number(neuLauf?.wartend?.fehler || 0);
    if (!window.confirm(`${n} wartende Entwürfe und Fehler neu schreiben lassen? Alte Gmail-Entwürfe werden gelöscht, Mara schreibt jeden Fall mit dem heutigen Stand neu und sendet, was die Freigaben erlauben. Dauer etwa ${Math.ceil(n * 0.4)} Minuten.`)) return;
    try {
      const j = await hole("/admin/postmeister/neu-bearbeiten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parallel: 2 }) });
      setMeldung({ art: "gut", text: `Neubearbeitung gestartet: ${j?.gestartet ?? 0} Vorgänge.` });
      await neuLaufLaden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
  }, [neuLauf, neuLaufLaden]);
  const neuStoppen = useCallback(async () => {
    try { await hole("/admin/postmeister/neu-bearbeiten/stopp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); await neuLaufLaden(); } catch { /* still */ }
  }, [neuLaufLaden]);

  // 04.09.2026 (E-117): Die Agentin hat Vor- und Nachnamen — beides hier änderbar.
  const agentinUmbenennen = useCallback(async () => {
    const vor = window.prompt("Vorname der Agentin", kopf?.agent?.vorname || "Mara"); if (vor == null) return;
    const nach = window.prompt("Nachname der Agentin (leer = ohne Nachnamen)", kopf?.agent?.nachname || ""); if (nach == null) return;
    try {
      for (const [schluessel, wert] of [["postmeister_name", vor.trim()], ["postmeister_nachname", nach.trim()]] as const) {
        await hole("/admin/postmeister/einstellung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schluessel, wert }) });
      }
      setMeldung({ art: "gut", text: `Die Agentin heißt jetzt ${[vor.trim(), nach.trim()].filter(Boolean).join(" ")}. Gilt für alle neuen Antworten.` });
      await laden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
  }, [kopf, laden]);

  const kuendigungZurueck = useCallback(async (id: number) => {
    if (!window.confirm("Kündigung zurücknehmen? Stornierte Raten leben wieder auf.")) return;
    setLaeuft(`zurueck-${id}`);
    try {
      const j = await hole(`/admin/postmeister/eintrag/${id}/kuendigung-zuruecknehmen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setMeldung({ art: "gut", text: `Kündigung zurückgenommen — ${j?.ratenZurueck ?? 0} Rate(n) wieder offen.` });
      const d = await hole(`/admin/postmeister/eintrag/${id}`); setDetail(d);
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, []);

  const verwerfen = useCallback(async (id: number) => {
    setLaeuft(`verwerfen-${id}`);
    try {
      await hole(`/admin/postmeister/eintrag/${id}/verwerfen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: "in der Zentrale verworfen" }),
      });
      setMeldung({ art: "gut", text: "Entwurf verworfen." });
      setEntwuerfe((e) => { const n = { ...e }; delete n[id]; return n; });
      setOffenId(null); setDetail(null); await laden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [laden]);

  const markierteSenden = useCallback(async () => {
    if (!markiert.length) return;
    setLaeuft("mehrere");
    try {
      const j = await hole("/admin/postmeister/senden-mehrere", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: markiert }),
      });
      setMeldung({
        art: j.fehler?.length ? "warn" : "gut",
        text: `${j.gesendet} gesendet${j.fehler?.length ? `, ${j.fehler.length} zurückgehalten` : ""}.`,
      });
      setMarkiert([]); await laden();
    } catch (e: any) { setMeldung({ art: "warn", text: String(e?.message || e) }); }
    finally { setLaeuft(null); }
  }, [markiert, laden]);

  // Tastatur: j/k blättern, ⌘↵ senden, Esc schließen.
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const imFeld = el?.tagName === "TEXTAREA" || el?.tagName === "INPUT" || el?.tagName === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && offenId != null) { e.preventDefault(); void senden(offenId, entwurf); return; }
      if (imFeld) return;
      if (e.key === "Escape") { setOffenId(null); setDetail(null); return; }
      if (e.key !== "j" && e.key !== "k") return;
      const i = liste.findIndex((z) => z.id === offenId);
      const n = e.key === "j" ? Math.min(liste.length - 1, i + 1) : Math.max(0, i - 1);
      if (liste[n] && liste[n].id !== offenId) { e.preventDefault(); void oeffnen(liste[n].id); }
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [liste, offenId, entwurf, senden, oeffnen]);

  const postfaecher: string[] = useMemo(() => {
    const ausKopf: string[] = (kopf?.jePostfach ?? []).map((p: any) => String(p.postfach));
    if (ausKopf.length) return ausKopf;
    return Array.from(new Set(liste.map((z) => String(z.postfach)))).sort();
  }, [kopf, liste]);

  const E = detail?.eintrag;
  const A = detail?.akte;
  const flags = (E?.flags ?? {}) as Record<string, boolean>;
  const istEntwurf = !!E && (E.aktion === "entwurf" || E.aktion === "fehler");
  const kannSenden = istEntwurf && entwurf.trim().length > 0;

  return (
    <div className="pf">
      {/* ── Zahlenband ─────────────────────────────────────────────────── */}
      <div className="pf-band">
        <h1>Postfach</h1>
        <div className="pf-kz"><b>{kopf?.zahlen?.offen ?? zaehler.offen ?? 0}</b><span>warten auf dich</span></div>
        <div className="pf-kz warn"><b>{kopf?.zahlen?.dringend ?? zaehler.dringend ?? 0}</b><span>dringend</span></div>
        <div className="pf-kz"><b>{kopf?.zahlen?.heute_gesendet ?? 0}</b><span>heute beantwortet</span></div>
        <div className="pf-kz"><b>{typeof kopf?.kostenHeuteEuro === "number" ? kopf.kostenHeuteEuro.toFixed(2).replace(".", ",") + " €" : "—"}</b><span>Modellkosten heute</span></div>
        <div className="pf-band-rechts">
          {markiert.length > 0 && (
            <button type="button" className="pf-knopf" disabled={laeuft === "mehrere"} onClick={() => void markierteSenden()}>
              {laeuft === "mehrere" ? "Sendet …" : `${markiert.length} markierte senden`}
            </button>
          )}
          <button type="button" className="pf-knopf still" onClick={() => void laden()}>Aktualisieren</button>
          {neuLauf?.lauf?.laeuft ? (
            <span className="pf-neulauf">
              Mara schreibt neu: <b>{neuLauf.lauf.fertig}/{neuLauf.lauf.gesamt}</b> · {neuLauf.lauf.gesendet} gesendet · {neuLauf.lauf.entwurf} Entwurf · {neuLauf.lauf.fehler} Fehler
              {neuLauf.lauf.aktuell?.length ? <small> · gerade {neuLauf.lauf.aktuell.join(", ")}</small> : null}
              <button type="button" className="pf-knopf still" onClick={() => void neuStoppen()}>Stopp</button>
            </span>
          ) : (
            <button type="button" className="pf-knopf still" title="Alle wartenden Entwürfe mit dem heutigen Stand neu schreiben lassen" onClick={() => void neuSchreiben()}>
              Alle Entwürfe neu schreiben{neuLauf?.lauf?.beendet ? ` (zuletzt ${neuLauf.lauf.gesendet} gesendet, ${neuLauf.lauf.entwurf} Entwurf)` : ""}
            </button>
          )}
          <button type="button" className="pf-knopf still pf-agentin" title="Vor- und Nachname der Agentin ändern" onClick={() => void agentinUmbenennen()}>
            {kopf?.agent?.voll || "Mara"} ✎
          </button>
        </div>
      </div>

      {(kopf?.postfaecher ?? []).filter((p: any) => p && p.ok === false).map((p: any) => (
        <div key={p.adresse} className="pf-meldung warn pf-kopfwarn">
          <b>{p.adresse}</b> ist nicht erreichbar. {p.hinweis}{p.fehler ? <span className="pf-kopfwarn-roh"> ({p.fehler})</span> : null}
        </div>
      ))}

      {(fehler || meldung) && (
        <div className={`pf-meldung ${fehler ? "warn" : meldung?.art}`}>{fehler || meldung?.text}</div>
      )}

      {/* ── Zwei Spalten. Zwei Scrollbereiche. Mehr nicht. ─────────────── */}
      <div className="pf-koerper">
        <div className="pf-liste">
          <div className="pf-reiter" role="tablist">
            {ORDNER.map((o) => (
              <button key={o.key} type="button" role="tab" aria-selected={ordner === o.key}
                      className={ordner === o.key ? "an" : ""} onClick={() => { setOrdner(o.key); setOffenId(null); setDetail(null); }}>
                {o.name}{o.zaehler && zaehler[o.zaehler] != null && <span className="n">{zaehler[o.zaehler]}</span>}
              </button>
            ))}
          </div>
          <div className="pf-filter">
            <input type="search" placeholder="Name, Betreff, Referenz …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            {postfaecher.length > 1 && (
              <select value={postfach} onChange={(e) => setPostfach(e.target.value)} title="Postfach">
                <option value="">alle Postfächer</option>
                {postfaecher.map((p) => <option key={p} value={p}>{p.replace("@fiaon.com", "")}</option>)}
              </select>
            )}
          </div>
          <div className="pf-rollen">
            {liste.length === 0 && <div className="pf-leer">Nichts in diesem Ordner.</div>}
            {liste.map((z) => {
              const an = z.id === offenId;
              const marken: { t: string; ton: string }[] = [];
              if (z.dringend) marken.push({ t: "Dringend", ton: "warn" });
              for (const [k, v] of Object.entries(z.flags ?? {})) if (v && FLAG_TEXT[k]) marken.push({ t: FLAG_TEXT[k].text, ton: FLAG_TEXT[k].ton });
              if (z.kundenlage && LAGE_TEXT[z.kundenlage] && !["aktiv", "unklar"].includes(z.kundenlage)) marken.push({ t: LAGE_TEXT[z.kundenlage], ton: "grau" });
              if ((z.nachrichtenImThread ?? 1) > 1) marken.push({ t: `${z.nachrichtenImThread} Nachrichten`, ton: "grau" });
              if (z.aktion === "fehler") marken.push({ t: "Fehler", ton: "rot" });
              return (
                <div key={z.id} className={`pf-zeile${an ? " an" : ""}`}>
                  {z.aktion === "entwurf" && (
                    <input type="checkbox" className="pf-haken" checked={markiert.includes(z.id)} aria-label="Markieren"
                           onChange={(e) => setMarkiert((m) => e.target.checked ? [...m, z.id] : m.filter((x) => x !== z.id))} />
                  )}
                  <button type="button" className="pf-zeile-knopf" onClick={() => void oeffnen(z.id)} aria-current={an}>
                    <div className="z1"><span className="nm">{z.kundeName || z.vonName || z.von}</span><span className="zt">{zeit(z.empfangenAm)}</span></div>
                    <div className="bt">{z.betreff || "(ohne Betreff)"}</div>
                    <div className="vs">{z.zusammenfassung || String(z.text ?? "").slice(0, 140)}</div>
                    {marken.length > 0 && <div className="mk">{marken.map((m, i) => <span key={i} className={`m ${m.ton}`}>{m.t}</span>)}</div>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pf-brief" ref={briefRef}>
          {offenId == null && (
            <div className="pf-leer gross">Wähle links eine Nachricht. Mit <kbd>j</kbd> und <kbd>k</kbd> blätterst du, mit <kbd>⌘↵</kbd> sendest du.</div>
          )}
          {offenId != null && !detail && <div className="pf-leer gross">Lädt …</div>}
          {E && (
            <>
              <div className="pf-bkopf">
                <h2>{E.betreff || "(ohne Betreff)"}</h2>
                <div className="meta">
                  <b>{A?.name || E.von}</b>
                  <span>·</span><span>{E.von}</span>
                  <span>·</span><span>{datumZeit(E.empfangenAm)}</span>
                  {E.kundenlage && <><span>·</span><span>{LAGE_TEXT[E.kundenlage] ?? E.kundenlage}</span></>}
                  {A?.betreuer && <><span>·</span><span>Betreuung: <b>{A.betreuer}</b></span></>}
                  {E.ref && <><span>·</span><a href={`/admin/kunde/${E.ref}`} target="_blank" rel="noreferrer">Akte öffnen</a></>}
                </div>
              </div>

              <div className="pf-leib">
                {(flags.droht_anwalt || flags.bestreitet || flags.beschwerde || flags.rechtlich) && (
                  <div className="pf-warnband">
                    <b>{flags.droht_anwalt ? "Droht mit dem Anwalt." : flags.bestreitet ? "Bestreitet die Forderung." : flags.rechtlich ? "Rechtliches Thema." : "Beschwerde."}</b>
                    {" "}Diese Antwort geht nie automatisch raus — sie wartet auf dich.
                  </div>
                )}
                {E.aktion === "fehler" && E.begruendung && (
                  <div className="pf-warnband rot"><b>Mara konnte nicht antworten.</b> {E.begruendung}</div>
                )}

                <section className="pf-abs">
                  <h3>Was der Kunde geschrieben hat</h3>
                  <div className="pf-zitat">{E.text || "(kein Text)"}</div>
                  {Array.isArray(E.anhaengeEingang) && E.anhaengeEingang.length > 0 && (
                    <div className="pf-anhaenge">
                      <span>Mitgeschickt:</span>
                      {E.anhaengeEingang.map((a: any, i: number) => (
                        <a key={i} href={`/api/fiaon/admin/postmeister/eintrag/${E.id}/anhang/${i}`} target="_blank" rel="noreferrer" title={a.typ}>
                          {a.name} <small>{Math.max(1, Math.round((a.groesse || 0) / 1024))} KB</small>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {Array.isArray(detail.verlauf) && detail.verlauf.filter((v: any) => v.id !== E.id).length > 0 && (
                  <section className="pf-abs">
                    <h3>Bisheriger Schriftwechsel · {detail.verlauf.length} Nachrichten</h3>
                    <div className="pf-verlauf">
                      {detail.verlauf.filter((v: any) => v.id !== E.id).map((v: any) => (
                        <div key={v.id} className="pf-v">
                          <div className="k"><b>Kunde</b> · {datumZeit(v.am)}{v.betreff ? ` · ${v.betreff}` : ""}</div>
                          <div className="t">{v.text}</div>
                          {v.antwort && (v.antwortGesendet || v.aktion === "auto_beantwortet") && (
                            <div className="t uns"><b>Wir</b> · {datumZeit(v.antwortGesendet)}<br />{v.antwort}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {A && (
                  <section className="pf-abs">
                    <h3>Die Akte</h3>
                    <table className="pf-akte"><tbody>
                      <tr><th>Lage</th><td>{LAGE_TEXT[A.kundenlage] ?? A.kundenlage}{A.lageGrund ? ` — ${A.lageGrund}` : ""}</td><td /></tr>
                      {(A.bestellungen ?? []).slice(0, 3).map((b: any) => (
                        <tr key={b.ref}><th>Bestellung</th><td>{b.paket || "—"} · {b.status}{b.referenz ? ` · ${b.referenz}` : ""}</td><td className="b">{b.betrag ? euro(b.betrag) : ""}</td></tr>
                      ))}
                      {(A.raten ?? []).filter((r: any) => r.status !== "bezahlt").slice(0, 4).map((r: any) => (
                        <tr key={r.nr}><th>Rate {r.nr}</th><td>{r.status}{r.faellig ? ` · fällig ${r.faellig}` : ""}{r.mahnstufe ? ` · Mahnstufe ${r.mahnstufe}` : ""}</td><td className={`b${r.status === "offen" ? " offen" : ""}`}>{euro(r.betrag)}</td></tr>
                      ))}
                      {(A.termine ?? []).slice(0, 2).map((t: any, i: number) => (
                        <tr key={i}><th>Termin</th><td>{t.beginn} · {t.status}{t.betreuer ? ` · ${t.betreuer}` : ""}</td><td /></tr>
                      ))}
                      {A.kuendigung?.am && <tr><th>Gekündigt</th><td>{A.kuendigung.am}{A.kuendigung.letzteRate ? ` · letzte Rate ${A.kuendigung.letzteRate}` : ""}</td><td /></tr>}
                      {A.sperren?.werbung && <tr><th>Werbesperre</th><td>seit {A.sperren.werbung}</td><td /></tr>}
                    </tbody></table>
                  </section>
                )}

                {Array.isArray(E.handlungen) && E.handlungen.length > 0 && (
                  <section className="pf-abs">
                    <h3>Bereits erledigt — das hat Mara getan</h3>
                    <div className="pf-getan">
                      {E.handlungen.map((h: any, i: number) => (
                        <div key={i} className={`t${h.ok ? "" : " nicht"}`}>
                          <span className="h">{h.ok ? "✓" : "✗"}</span>
                          <div><span className="w">{String(h.werkzeug || "").replace(/_/g, " ")}</span> — {h.ergebnis}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(istEntwurf || E.antwort) && (
                  <section className="pf-abs">
                    <h3>{istEntwurf ? "Antwort — Entwurf, du entscheidest" : "Gesendete Antwort"}</h3>
                    {Array.isArray(E.pruefung?.fehlend) && E.pruefung.fehlend.length > 0 && (
                      <div className="pf-warnband">{E.pruefung.fehlend.join(" · ")}</div>
                    )}
                    {istEntwurf ? (
                      <textarea ref={textFeld} className="pf-entwurf" value={entwurf} onChange={(e) => entwurfSetzen(e.target.value)}
                                rows={Math.max(6, Math.min(26, entwurf.split("\n").length + 2))} spellCheck />
                    ) : (
                      <div className="pf-zitat uns">{E.antwort}</div>
                    )}
                    {E.naechsterSchritt?.url && (
                      <div className="pf-schritt">Knopf in der Mail: <b>{E.naechsterSchritt.text || E.naechsterSchritt.art}</b> · <a href={E.naechsterSchritt.url} target="_blank" rel="noreferrer">öffnen</a></div>
                    )}
                    {Array.isArray(E.belege) && E.belege.length > 0 && (
                      <div className="pf-belege">Belegt durch: {E.belege.map((b: any) => b.feld || b.quelle || "").filter(Boolean).slice(0, 8).join(", ")}</div>
                    )}
                    {istEntwurf && (() => {
                      const W = wahlVon(E.id, E, A);
                      const handl: any[] = Array.isArray(E.handlungen) ? E.handlungen : [];
                      const maraAufgabe = handl.some((h) => (h.werkzeug === "aufgabe_an_betreuer" || h.werkzeug === "notiz_an_betreuer") && h.ok);
                      const gekuendigt = !!E.vertrag?.gekuendigtAm && !E.vertrag?.zurueckgenommenAm;
                      const rechnungRef = E.naechsterSchritt?.art === "zahlung" && E.naechsterSchritt?.url ? String(E.naechsterSchritt.url).split("/zahlung/")[1] : (E.anhaenge?.[0]?.referenz ?? null);
                      const zeigeKuendigung = !!E.flags?.kuendigung || gekuendigt || W.kuendigung;
                      return (
                        <div className="pf-schalter">
                          {(rechnungRef || W.anhaenge) && (
                            <label className={W.anhaenge ? "an" : ""}>
                              <input type="checkbox" checked={W.anhaenge} onChange={(e) => wahlSetzen(E.id, E, A, { anhaenge: e.target.checked })} />
                              <span><b>Rechnung als PDF anhängen</b>{rechnungRef ? <small> · {rechnungRef}</small> : null}</span>
                            </label>
                          )}
                          <label className={W.aufgabe ? "an" : ""}>
                            <input type="checkbox" checked={W.aufgabe} onChange={(e) => wahlSetzen(E.id, E, A, { aufgabe: e.target.checked })} />
                            <span><b>Aufgabe für {A?.betreuer || "den Betreuer"}</b>{maraAufgabe ? <small> · Mara hat schon eine angelegt</small> : <small> · mit Frist und Mail</small>}</span>
                          </label>
                          {W.aufgabe && (
                            <div className="pf-schalter-innen">
                              <input value={W.aufgabeTitel} onChange={(e) => wahlSetzen(E.id, E, A, { aufgabeTitel: e.target.value })} placeholder="Was ist zu tun?" />
                              <textarea value={W.aufgabeText} onChange={(e) => wahlSetzen(E.id, E, A, { aufgabeText: e.target.value })} rows={3} placeholder="Der Auftrag in zwei, drei Sätzen" />
                              <div className="pf-schalter-zeile">
                                <span>fällig</span>
                                <select value={W.aufgabeTage} onChange={(e) => wahlSetzen(E.id, E, A, { aufgabeTage: Number(e.target.value) })}>
                                  <option value={0}>heute</option><option value={1}>morgen</option><option value={2}>in 2 Tagen</option><option value={5}>in 5 Tagen</option>
                                </select>
                                <label className="klein"><input type="checkbox" checked={W.aufgabeDringend} onChange={(e) => wahlSetzen(E.id, E, A, { aufgabeDringend: e.target.checked })} /> dringend</label>
                              </div>
                            </div>
                          )}
                          {zeigeKuendigung && (gekuendigt ? (
                            <div className="pf-schalter-stand">
                              <span>
                                <b>Kündigung vorgemerkt.</b>{" "}
                                {E.vertrag?.vertragEndeAm ? "Der Vertrag ist beendet." : E.vertrag?.letzteRateNr ? `Rate ${E.vertrag.letzteRateNr} bleibt offen — mit ihrer Zahlung endet der Vertrag (Storno erst nach Zahlungseingang).` : "Wird mit der letzten Zahlung wirksam."}
                                {E.vertrag?.lastschrift ? " Lastschrift läuft — Justin bekommt die Aufgabe, das Abo zu beenden." : ""}
                              </span>
                              {!E.vertrag?.vertragEndeAm && (
                                <button type="button" className="pf-knopf still" disabled={laeuft === `zurueck-${E.id}`} onClick={() => void kuendigungZurueck(E.id)}>
                                  {laeuft === `zurueck-${E.id}` ? "…" : "Kunde bleibt — Kündigung zurücknehmen"}
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              <label className={W.kuendigung ? "an" : ""}>
                                <input type="checkbox" checked={W.kuendigung} disabled={!E.ref} onChange={(e) => wahlSetzen(E.id, E, A, { kuendigung: e.target.checked })} />
                                <span><b>Kündigung vormerken</b><small> · {E.ref ? "der Kunde hat gekündigt, Mara hat es nicht gebucht" : "ohne Bestellung nicht möglich"}</small></span>
                              </label>
                              {W.kuendigung && (
                                <label className={`klein einzug ${W.nachZahlung ? "an" : ""}`}>
                                  <input type="checkbox" checked={W.nachZahlung} onChange={(e) => wahlSetzen(E.id, E, A, { nachZahlung: e.target.checked })} />
                                  <span>Storno erst nach Zahlungseingang der offenen Rate <small>· aus = Kulanz, Vertrag endet sofort, offene Raten entfallen</small></span>
                                </label>
                              )}
                            </>
                          ))}
                        </div>
                      );
                    })()}
                    {istEntwurf && (
                      <div className="pf-tasten">
                        <button type="button" className="pf-knopf" disabled={!kannSenden || laeuft === `senden-${E.id}`} onClick={() => void senden(E.id, entwurf)}>
                          {laeuft === `senden-${E.id}` ? "Sendet …" : "So senden"}
                        </button>
                        <button type="button" className="pf-knopf still" onClick={() => textFeld.current?.focus()}>Ändern</button>
                        <button type="button" className="pf-knopf still" disabled={laeuft === `verwerfen-${E.id}`} onClick={() => void verwerfen(E.id)}>Verwerfen</button>
                        <span className="pf-hint">j / k blättern · ⌘↵ senden · Esc schließen</span>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
