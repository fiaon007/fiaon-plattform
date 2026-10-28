// ═══════════════════════════════════════════════════════════════════════════
// DIE FACHBEREICHE IM GLOBAL-PORTAL (E-341, 12.10.2026)
//
// Justin: „Unternehmensberater, Rechtsanwalt, Steuerberater, einfach 100 %
//          sinnvoll mit Anträgen, Auswertungen, vieles, was er nutzen kann …
//          dass man sagt: YES, geil!"
//
// Drei Bereiche mit Reitern — Inhalte aus shared/fiaon-global-fach-*.ts,
// KI und Generator über /api/fiaon/global/mein-auftrag/:ref/fach/*:
//   Strategie & Wachstum: KI-Sparring · Werkzeuge (Liquiditätsplan, Kapital-
//     bedarf, Kreditwürdigkeits-Fahrplan, Bank-Exposé) · Strategiebuch
//   Recht & Verträge: Vorlagen auf einen Klick · KI-Rechtsfragen · Verzeichnis
//   Steuern & Pflichten: Formulare · Pflichten-Check · KI-Steuerfragen · Wissen
// Namen: keine geschützten Berufsbezeichnungen, kein „beraten" (siehe
// shared/fiaon-global-fach.ts). Für den Einzelfall: „Einzelfall prüfen lassen".
// Fortschritt (Checklisten, Rechner) bleibt in diesem Browser (localStorage).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
// E-452 (28.10.2026): Justin: „weg mit den ICONS, die sehen billig aus“ — es bleiben nur Bedien-Zeichen
// (Ausklapp-Winkel, Schließen-Kreuz). Reiter, Karten, Knöpfe und Werkzeuge sprechen in Worten.
import { ChevronDown, X } from "lucide-react";
import { FACH_HINWEIS, type FachBereich, type FachKapitel, type FachVorlage, type FachFormular } from "@shared/fiaon-global-fach";
import { FACH_STRATEGIE_KAPITEL } from "@shared/fiaon-global-fach-strategie";
import { FACH_RECHT_KAPITEL, FACH_VORLAGEN } from "@shared/fiaon-global-fach-recht";
import { FACH_STEUERN_KAPITEL, FACH_FORMULARE } from "@shared/fiaon-global-fach-steuern";

type T = Record<string, any>;
type Reiter = "sparring" | "bibliothek" | "werkzeuge" | "vorlagen" | "formulare" | "check";

const REITER: Record<FachBereich, Reiter[]> = {
  strategie: ["sparring", "werkzeuge", "bibliothek"],
  recht: ["vorlagen", "sparring", "bibliothek"],
  steuern: ["formulare", "check", "sparring", "bibliothek"],
};
const REITER_TEXT: Record<Reiter, { de: string; en: string }> = {
  sparring: { de: "KI-Sparring", en: "AI sparring" },
  bibliothek: { de: "Bibliothek", en: "Library" },
  werkzeuge: { de: "Werkzeuge", en: "Tools" },
  vorlagen: { de: "Vorlagen", en: "Templates" },
  formulare: { de: "Formulare", en: "Forms" },
  check: { de: "Pflichten-Check", en: "Compliance check" },
};
const BIBLIOTHEK_NAME: Record<FachBereich, string> = { strategie: "Strategiebuch", recht: "Verzeichnis", steuern: "Steuerwissen" };
const FRAGEN: Record<FachBereich, string[]> = {
  strategie: [
    "Wie baue ich in den USA geschäftliche Kreditwürdigkeit auf?",
    "Welche Unterlagen brauche ich für einen Kreditrahmen?",
    "Wie plane ich meine Liquidität für ein Jahr?",
    "Wie gewinne ich erste Kunden in den USA?",
  ],
  recht: [
    "Was gehört in ein Operating Agreement einer Ein-Personen-LLC?",
    "Wie unterschreibe ich richtig für meine LLC?",
    "Was passiert, wenn der Annual Report zu spät kommt?",
    "Brauche ich ein Impressum für Kunden in der EU?",
  ],
  steuern: [
    "Welche Steuerformulare muss meine LLC jährlich einreichen?",
    "Was ist Form 5472 und warum ist sie wichtig?",
    "Brauche ich als Inhaber eine ITIN?",
    "Wie behandelt Deutschland meine LLC steuerlich?",
  ],
};
const KAPITEL: Record<FachBereich, FachKapitel[]> = { strategie: FACH_STRATEGIE_KAPITEL, recht: FACH_RECHT_KAPITEL, steuern: FACH_STEUERN_KAPITEL };

const speicher = {
  lesen<X>(k: string, leer: X): X { try { const v = window.localStorage.getItem(k); return v ? (JSON.parse(v) as X) : leer; } catch { return leer; } },
  schreiben(k: string, v: unknown) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* privates Fenster */ } },
};
const usd = (n: number) => `$ ${Math.round(n).toLocaleString("de-DE")}`;

/** KI-Text → Absätze und Listen (ohne Markdown-Zeichen). */
function KiText({ text }: { text: string }) {
  const bloecke: { liste: boolean; zeilen: string[] }[] = [];
  for (const roh of text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").split("\n")) {
    const z = roh.trim();
    if (!z) { bloecke.push({ liste: false, zeilen: [] }); continue; }
    const istListe = /^([-–•*]|\d+[.)])\s+/.test(z);
    const letzter = bloecke[bloecke.length - 1];
    const sauber = z.replace(/^([-–•*]|\d+[.)])\s+/, "");
    if (letzter && letzter.liste === istListe && letzter.zeilen.length) letzter.zeilen.push(sauber);
    else bloecke.push({ liste: istListe, zeilen: [sauber] });
  }
  return (
    <>
      {bloecke.filter((b) => b.zeilen.length).map((b, i) => b.liste
        ? <ul key={i}>{b.zeilen.map((z, j) => <li key={j}>{z}</li>)}</ul>
        : <p key={i}>{b.zeilen.join(" ")}</p>)}
    </>
  );
}

// ── Einzelfall prüfen lassen ─────────────────────────────────────────────────
function Einzelfall({ bereich, mitToken, vorschau, zu, vorbelegt }: { bereich: FachBereich; mitToken: (p: string) => string; vorschau: boolean; zu: () => void; vorbelegt?: string }) {
  const [text, setText] = useState(vorbelegt ?? "");
  const [stand, setStand] = useState<"" | "laeuft" | "ok">("");
  const [fehler, setFehler] = useState("");
  const senden = async () => {
    setStand("laeuft"); setFehler("");
    try {
      const r = await fetch(mitToken("/fach/einzelfall"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bereich, text }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setStand("ok"); else { setStand(""); setFehler(j.error || "—"); }
    } catch { setStand(""); setFehler("Keine Verbindung — bitte noch einmal."); }
  };
  return (
    <div className="gp-schleier" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) zu(); }}>
      <div className="gp-dialog">
        <button type="button" className="gp-dialog-zu" onClick={zu} aria-label="Schließen"><X size={18} /></button>
        {stand === "ok" ? (
          <div className="gp-fertig">
            <svg className="gp-haken-gross" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
            <h3>Ihre Anfrage ist bei uns</h3>
            <p>Ihr Ansprechpartner meldet sich — den Verlauf sehen Sie unter „Anfragen“.</p>
            <button type="button" className="gp-knopf" onClick={zu}>Schließen</button>
          </div>
        ) : (
          <>
            <span className="gp-auge">Einzelfall prüfen lassen</span>
            <h3>Worum geht es konkret?</h3>
            <p className="gp-leise">Mit allen wichtigen Umständen — direkt an Ihren Ansprechpartner.</p>
            <textarea className="gp-eingabe" rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={1800} />
            {fehler && <p className="gp-meldung schlecht">{fehler}</p>}
            {vorschau && <p className="gp-meldung">Vorschau — Anfragen schickt hier nur der Kunde.</p>}
            <button type="button" className="gp-knopf gross" disabled={vorschau || text.trim().length < 10 || stand === "laeuft"} onClick={senden}>
              {stand === "laeuft" ? "Wird gesendet …" : "Anfrage senden"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── KI-Sparring ──────────────────────────────────────────────────────────────
function Sparring({ bereich, verlauf, mitToken, vorschau, frageVor, onEinzelfall }: {
  bereich: FachBereich; verlauf: T[]; mitToken: (p: string) => string; vorschau: boolean; frageVor: string; onEinzelfall: (text?: string) => void;
}) {
  const [nachrichten, setNachrichten] = useState<T[]>(verlauf);
  const [frage, setFrage] = useState(frageVor);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const faden = useRef<HTMLDivElement>(null);
  useEffect(() => { setNachrichten(verlauf); }, [verlauf]);
  useEffect(() => { setFrage(frageVor); }, [frageVor]);
  useEffect(() => { const f = faden.current; if (f) f.scrollTop = f.scrollHeight; }, [nachrichten.length, laeuft]);
  const stellen = async (e?: FormEvent, text?: string) => {
    e?.preventDefault();
    const q = (text ?? frage).trim();
    if (q.length < 3 || laeuft) return;
    setNachrichten((n) => [...n, { rolle: "kunde", text: q, am: new Date().toISOString() }]);
    setFrage(""); setLaeuft(true); setFehler("");
    try {
      const r = await fetch(mitToken("/fach/chat"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bereich, frage: q }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setNachrichten((n) => [...n, { rolle: "ki", text: j.antwort, am: new Date().toISOString() }]);
      else setFehler(j.error || "Gerade nicht erreichbar.");
    } catch { setFehler("Keine Verbindung — bitte noch einmal."); }
    finally { setLaeuft(false); }
  };
  return (
    <div className="gpf-sparring">
      <div className="gpf-sparring-kopf">
        <div><b>Ihr Sparringspartner</b><small>{FACH_HINWEIS[bereich]}</small></div>
      </div>
      <div className="gpf-faden" ref={faden}>
        {nachrichten.length === 0 && (
          <div className="gpf-start">
            <p>Fragen Sie frei — oder wählen Sie:</p>
            <div className="gpf-chips">
              {FRAGEN[bereich].map((q) => <button key={q} type="button" onClick={() => void stellen(undefined, q)}>{q}</button>)}
            </div>
          </div>
        )}
        {nachrichten.map((n, i) => (
          <div key={i} className={`gpf-blase ${n.rolle}`}>
            {n.rolle === "ki" ? <KiText text={n.text} /> : <p>{n.text}</p>}
          </div>
        ))}
        {laeuft && <div className="gpf-blase ki tippt" aria-label="Antwort wird geschrieben"><span /><span /><span /></div>}
      </div>
      {fehler && <p className="gp-meldung schlecht">{fehler}</p>}
      {vorschau && <p className="gpf-vorschau-zeile">Vorschau — der Kunde sieht diese Antworten nicht.</p>}
      <form className="gpf-frage" onSubmit={stellen}>
        <textarea className="gp-eingabe" rows={2} value={frage} placeholder="Ihre Frage …" maxLength={1500} onChange={(e) => setFrage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void stellen(); } }} />
        <button type="submit" className="gp-knopf" disabled={laeuft || frage.trim().length < 3}>{laeuft ? "Einen Moment …" : "Fragen"}</button>
      </form>
      <button type="button" className="gpf-einzelfall" onClick={() => onEinzelfall(nachrichten.filter((n) => n.rolle === "kunde").slice(-1)[0]?.text)}>
        Einzelfall prüfen lassen
      </button>
    </div>
  );
}

// ── Bibliothek ───────────────────────────────────────────────────────────────
function Bibliothek({ bereich, gref, onFrage }: { bereich: FachBereich; gref: string; onFrage: (q: string) => void }) {
  const liste = KAPITEL[bereich];
  const [offen, setOffen] = useState<string | null>(null);
  const k = liste.find((x) => x.id === offen) ?? null;
  const gruppen = useMemo(() => Array.from(new Set(liste.map((x) => x.gruppe))), [liste]);
  const schluessel = (id: string) => `gp-fach:${gref}:${id}`;
  const [erledigt, setErledigt] = useState<Record<string, boolean[]>>({});
  useEffect(() => {
    const e: Record<string, boolean[]> = {};
    for (const x of liste) e[x.id] = speicher.lesen<boolean[]>(schluessel(x.id), []);
    setErledigt(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereich]);
  const haken = (id: string, i: number) => setErledigt((e) => { const n = [...(e[id] ?? [])]; n[i] = !n[i]; speicher.schreiben(schluessel(id), n); return { ...e, [id]: n }; });
  if (liste.length === 0) return <p className="gp-leise">Folgt in Kürze.</p>;
  if (k) {
    const fertig = (erledigt[k.id] ?? []).filter(Boolean).length;
    return (
      <article className="gpf-kapitel">
        <button type="button" className="gp-link" onClick={() => { setOffen(null); window.scrollTo({ top: 0 }); }}>Zurück: {BIBLIOTHEK_NAME[bereich]}</button>
        <span className="gp-auge">{k.gruppe}</span>
        <h2 className="gpf-kapitel-titel">{k.titel}</h2>
        <p className="gpf-kapitel-kurz">{k.kurz}</p>
        <p className="gpf-kapitel-meta">{k.minuten} Min. Lesezeit · {k.stand}</p>
        {k.abschnitte.map((ab, i) => (
          <section key={i} className="gpf-abschnitt">
            {ab.titel && <h3>{ab.titel}</h3>}
            {ab.absaetze.map((p, j) => <p key={j}>{p}</p>)}
            {ab.liste && <ul>{ab.liste.map((l, j) => <li key={j}>{l}</li>)}</ul>}
            {ab.merke && <div className="gpf-merke"><b>Merke</b><p>{ab.merke}</p></div>}
          </section>
        ))}
        {k.umsetzen && k.umsetzen.length > 0 && (
          <section className="gpf-umsetzen">
            {/* E-452: kein Zähler („2 / 5“) — die Haken sprechen für sich; ist alles erledigt, sagt es ein ruhiger Satz. */}
            <div className="gpf-umsetzen-kopf"><h3>Jetzt umsetzen</h3>{fertig === k.umsetzen.length && <span>Alles abgehakt.</span>}</div>
            {k.umsetzen.map((u, i) => (
              <label key={i} className={`gpf-haken${erledigt[k.id]?.[i] ? " an" : ""}`}>
                <input type="checkbox" checked={!!erledigt[k.id]?.[i]} onChange={() => haken(k.id, i)} />
                <span className="gpf-haken-feld">{erledigt[k.id]?.[i] && <i className="gp-hk" />}</span>
                <span>{u}</span>
              </label>
            ))}
          </section>
        )}
        {k.quellen && k.quellen.length > 0 && (
          <section className="gpf-quellen"><h3>Amtliche Quellen</h3>{k.quellen.map((q) => <a key={q.url} href={q.url} target="_blank" rel="noopener noreferrer">{q.titel}</a>)}</section>
        )}
        <button type="button" className="gp-knopf leise" onClick={() => onFrage(`Zum Kapitel „${k.titel}“: `)}>Frage dazu stellen</button>
      </article>
    );
  }
  return (
    <div className="gpf-bibliothek">
      {gruppen.map((gr) => (
        <section key={gr}>
          <h3 className="gpf-gruppe">{gr}</h3>
          <div className="gpf-karten">
            {liste.filter((x) => x.gruppe === gr).map((x, i) => {
              const n = (erledigt[x.id] ?? []).filter(Boolean).length;
              return (
                <button key={x.id} type="button" className="gpf-karte" style={{ ["--i" as any]: i }} onClick={() => { setOffen(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <span className="gpf-karte-meta">{x.minuten} Min.{x.umsetzen?.length ? ` · ${n}/${x.umsetzen.length} umgesetzt` : ""}</span>
                  <b>{x.titel}</b>
                  <small>{x.kurz}</small>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Recht: Vorlagen ──────────────────────────────────────────────────────────
function Vorlagen({ mitToken, vorbelegung, vorschau, laden, geh }: { mitToken: (p: string) => string; vorbelegung: Record<string, string>; vorschau: boolean; laden: () => void; geh: (s: string) => void }) {
  const [v, setV] = useState<FachVorlage | null>(null);
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [unterschrift, setUnterschrift] = useState(false);
  const [stand, setStand] = useState<"" | "laeuft">("");
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const oeffnen = (x: FachVorlage) => {
    setV(x); setMeldung(null); setUnterschrift(false);
    setWerte(Object.fromEntries(x.felder.map((f) => [f.key, f.vorbelegt ? (vorbelegung[f.vorbelegt] ?? "") : ""])));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const erstellen = async () => {
    if (!v) return;
    setStand("laeuft"); setMeldung(null);
    try {
      const r = await fetch(mitToken("/fach/vorlage"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vorlage: v.id, werte, unterschrift }) });
      if (r.ok && (r.headers.get("content-type") || "").includes("application/pdf")) {
        const url = URL.createObjectURL(await r.blob());
        window.open(url, "_blank", "noopener");
        setMeldung({ gut: true, text: "Vorschau-PDF geöffnet — nichts abgelegt." });
      } else {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) { setMeldung({ gut: true, text: j.meldung }); laden(); } else setMeldung({ gut: false, text: j.error || "—" });
      }
    } catch { setMeldung({ gut: false, text: "Keine Verbindung — bitte noch einmal." }); }
    finally { setStand(""); }
  };
  if (FACH_VORLAGEN.length === 0) return <p className="gp-leise">Folgt in Kürze.</p>;
  if (v) {
    const fehlt = v.felder.filter((f) => f.pflicht && !werte[f.key]?.trim());
    return (
      <div className="gpf-editor">
        <button type="button" className="gp-link" onClick={() => setV(null)}>Zurück: alle Vorlagen</button>
        <span className="gp-auge">Vorlage · {v.sprache === "en" ? "englisches Dokument" : "deutsches Dokument"}</span>
        <h2 className="gpf-kapitel-titel">{v.titel}</h2>
        <p className="gpf-kapitel-kurz">{v.wozu}</p>
        <p className="gp-leise">{v.wann}</p>
        <div className="gpf-felder">
          {v.felder.map((f) => (
            <label key={f.key} className={`gp-feldname${f.typ === "langtext" ? " breit" : ""}`}>
              <span>{f.label}{f.pflicht ? " *" : ""}{f.vorbelegt && vorbelegung[f.vorbelegt] ? <em className="gpf-aus-akte">aus Ihrer Akte</em> : null}</span>
              {f.typ === "langtext" ? <textarea className="gp-eingabe" rows={4} value={werte[f.key] ?? ""} onChange={(e) => setWerte({ ...werte, [f.key]: e.target.value })} />
                : f.typ === "auswahl" ? (
                  <select className="gp-eingabe" value={werte[f.key] ?? ""} onChange={(e) => setWerte({ ...werte, [f.key]: e.target.value })}>
                    <option value="">—</option>{(f.optionen ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : <input className="gp-eingabe" value={werte[f.key] ?? ""} onChange={(e) => setWerte({ ...werte, [f.key]: e.target.value })} />}
              {f.hilfe && <small>{f.hilfe}</small>}
            </label>
          ))}
        </div>
        <label className="gp-haken"><input type="checkbox" checked={unterschrift} onChange={(e) => setUnterschrift(e.target.checked)} /> <span>Danach hier unterschreiben</span></label>
        <p className="gpf-hinweis">{FACH_HINWEIS.recht}</p>
        {meldung && <p className={`gp-meldung ${meldung.gut ? "gut" : "schlecht"}`}>{meldung.text}{meldung.gut && !vorschau && <> <button type="button" className="gp-link" onClick={() => geh("tresor")}>Zum Tresor</button></>}</p>}
        <button type="button" className="gp-knopf gross" disabled={fehlt.length > 0 || stand === "laeuft"} onClick={erstellen}>
          {stand === "laeuft" ? "Wird erstellt …" : (vorschau ? "Vorschau-PDF erstellen" : "Dokument erstellen")}
        </button>
      </div>
    );
  }
  return (
    <div className="gpf-vorlagen">
      {FACH_VORLAGEN.map((x, i) => (
        <button key={x.id} type="button" className="gpf-vorlage" style={{ ["--i" as any]: i }} onClick={() => oeffnen(x)}>
          <span className="gpf-vorlage-sprache">{x.sprache.toUpperCase()}</span>
          <b>{x.titel}</b>
          <small>{x.wozu}</small>
          <span className="gpf-vorlage-los">Erstellen</span>
        </button>
      ))}
    </div>
  );
}

// ── Steuern: Formulare & Check ───────────────────────────────────────────────
function Formulare({ staat }: { staat: string | null }) {
  const [offen, setOffen] = useState<string | null>(null);
  const liste = FACH_FORMULARE.filter((f) => !f.staaten?.length || (staat && f.staaten.includes(staat)));
  if (liste.length === 0) return <p className="gp-leise">Folgt in Kürze.</p>;
  return (
    <div className="gpf-formulare">
      {liste.map((f) => (
        <div key={f.id} className={`gpf-formular${offen === f.id ? " offen" : ""}`}>
          <button type="button" className="gpf-formular-kopf" onClick={() => setOffen(offen === f.id ? null : f.id)} aria-expanded={offen === f.id}>
            <span className="gpf-nummer">{f.nummer}</span>
            <span className="gpf-formular-titel"><b>{f.titel}</b><small>{f.wer} · {f.wann}</small></span>
            <ChevronDown size={18} className="gpf-pfeil" />
          </button>
          {offen === f.id && (
            <div className="gpf-formular-inhalt">
              <p>{f.was}</p>
              <ol>{f.schritte.map((x, i) => <li key={i}>{x}</li>)}</ol>
              {f.folgen && <div className="gpf-merke warn"><b>Bei Versäumnis</b><p>{f.folgen}</p></div>}
              <div className="gpf-merke"><b>Was FIAON tut</b><p>{f.fiaon}</p></div>
              <a className="gp-link" href={f.quelle.url} target="_blank" rel="noopener noreferrer">{f.quelle.titel}</a>
            </div>
          )}
        </div>
      ))}
      <p className="gpf-hinweis">{FACH_HINWEIS.steuern}</p>
    </div>
  );
}

const CHECK_FRAGEN: { key: string; frage: string; optionen: { wert: string; text: string }[] }[] = [
  { key: "wohnsitz", frage: "Wo wohnen Sie?", optionen: [{ wert: "de", text: "Deutschland" }, { wert: "at", text: "Österreich" }, { wert: "ch", text: "Schweiz" }, { wert: "anders", text: "Anderes Land" }] },
  { key: "inhaber", frage: "Wie viele Gesellschafter hat Ihre LLC?", optionen: [{ wert: "eins", text: "Nur mich" }, { wert: "mehr", text: "Zwei oder mehr" }] },
  { key: "einnahmen", frage: "Hat Ihre LLC schon Einnahmen?", optionen: [{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Noch nicht" }] },
  { key: "dienstleister", frage: "Bezahlt Ihre LLC Dienstleister in den USA?", optionen: [{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }] },
  { key: "verkauf", frage: "Verkaufen Sie an Endkunden im Bundesstaat Ihrer LLC?", optionen: [{ wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }, { wert: "weiss", text: "Weiß nicht" }] },
  { key: "fuehrung", frage: "Von wo führen Sie die LLC überwiegend?", optionen: [{ wert: "heim", text: "Von zu Hause (DE/AT/CH)" }, { wert: "usa", text: "Aus den USA" }, { wert: "gemischt", text: "Gemischt" }] },
];
function Check_({ staat, onFrage }: { staat: string | null; onFrage: (q: string) => void }) {
  const [a, setA] = useState<Record<string, string>>({});
  const fertig = CHECK_FRAGEN.every((f) => a[f.key]);
  const formular = (id: string) => FACH_FORMULARE.find((f) => f.id === id);
  const kapitel = (teil: string) => FACH_STEUERN_KAPITEL.find((k) => k.id.includes(teil));
  const ergebnis: { titel: string; warum: string }[] = [];
  if (fertig) {
    if (a.inhaber === "eins") {
      const f = formular("form-5472");
      ergebnis.push({ titel: f ? `${f.nummer} — ${f.titel}` : "Form 5472 mit pro forma Form 1120", warum: "Jährlich an den IRS — in der Regel auch ohne Einnahmen." });
    } else {
      ergebnis.push({ titel: "Mehrere Gesellschafter: andere Bundesformulare", warum: "In der Regel wie eine Personengesellschaft (z. B. Form 1065) — ein Fall für Ihre Steuerkanzlei." });
    }
    if (staat === "FL") ergebnis.push({ titel: formular("florida-annual-report")?.titel ?? "Florida Annual Report", warum: "Jahresbericht ab Januar, spätestens zum ersten Mai — sonst droht die Auflösung." });
    if (a.dienstleister === "ja") ergebnis.push({ titel: formular("form-1099-nec") ? `${formular("form-1099-nec")!.nummer} — ${formular("form-1099-nec")!.titel}` : "Form 1099-NEC", warum: "Sie melden die Zahlungen — vorher holen Sie ein Form W-9 ein." });
    if (a.verkauf !== "nein" && staat === "FL") ergebnis.push({ titel: formular("florida-sales-tax")?.titel ?? "Sales Tax in Florida", warum: "In der Regel ist eine Registrierung beim Florida Department of Revenue nötig." });
    if (a.einnahmen === "ja") ergebnis.push({ titel: formular("form-w-8ben")?.titel ?? "Form W-8BEN gegenüber US-Zahlern", warum: "US-Zahler fragen nach Ihrem Auslandsstatus — Details unter „Formulare“." });
    const heim = a.wohnsitz === "de" ? kapitel("deutschland") : a.wohnsitz === "at" || a.wohnsitz === "ch" ? kapitel("oesterreich") ?? kapitel("schweiz") : null;
    ergebnis.push({ titel: heim?.titel ?? "Ihr Heimatland", warum: a.fuehrung === "heim"
      ? "Ihr Finanzamt prüft, wo die Geschäftsleitung liegt — DIE Frage für Ihre Steuerkanzlei."
      : "Auch im Heimatland gelten Melde- und Erklärungspflichten — klären Sie sie mit Ihrer Steuerkanzlei." });
    ergebnis.push({ titel: "BOI-Meldung bei FinCEN", warum: "Für in den USA gegründete Gesellschaften seit März 2025 entfallen — hier ist nichts zu tun." });
  }
  return (
    <div className="gpf-check">
      {CHECK_FRAGEN.map((f, i) => (
        <div key={f.key} className="gpf-check-frage" style={{ ["--i" as any]: i }}>
          <b>{i + 1}. {f.frage}</b>
          <div className="gpf-check-optionen">
            {f.optionen.map((o) => <button key={o.wert} type="button" className={a[f.key] === o.wert ? "an" : ""} onClick={() => setA({ ...a, [f.key]: o.wert })}>{o.text}</button>)}
          </div>
        </div>
      ))}
      {fertig ? (
        <div className="gpf-check-ergebnis">
          <h3>Das betrifft Ihre Gesellschaft</h3>
          {ergebnis.map((e, i) => <div key={i} className="gpf-check-punkt" style={{ ["--i" as any]: i }}><span className="gpf-check-zeichen" aria-hidden="true">✓</span><div><b>{e.titel}</b><p>{e.warum}</p></div></div>)}
          <p className="gpf-hinweis">{FACH_HINWEIS.steuern}</p>
          <button type="button" className="gp-knopf leise" onClick={() => onFrage("Zu meinem Pflichten-Check: ")}>Frage dazu stellen</button>
        </div>
      ) : <p className="gp-leise">Sechs Fragen — dann sehen Sie Ihre Pflichten.</p>}
    </div>
  );
}

// ── Strategie: Werkzeuge ─────────────────────────────────────────────────────
function Liquiditaet({ gref }: { gref: string }) {
  const k = `gp-liq:${gref}`;
  const [e, setE] = useState(() => speicher.lesen(k, { start: 20000, umsatz: 8000, wachstum: 5, fix: 4500, variabel: 25, einmal: 0, einmalMonat: 3 }));
  useEffect(() => { speicher.schreiben(k, e); }, [k, e]);
  const zeilen = useMemo(() => {
    let stand = Number(e.start) || 0; const out: { m: number; ein: number; aus: number; stand: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const ein = (Number(e.umsatz) || 0) * Math.pow(1 + (Number(e.wachstum) || 0) / 100, m - 1);
      const aus = (Number(e.fix) || 0) + ein * (Number(e.variabel) || 0) / 100 + (m === Number(e.einmalMonat) ? Number(e.einmal) || 0 : 0);
      stand += ein - aus; out.push({ m, ein, aus, stand });
    }
    return out;
  }, [e]);
  const min = Math.min(Number(e.start) || 0, ...zeilen.map((z) => z.stand));
  const max = Math.max(Number(e.start) || 0, ...zeilen.map((z) => z.stand), 1);
  const spanne = max - Math.min(min, 0) || 1;
  const y = (v: number) => 150 - ((v - Math.min(min, 0)) / spanne) * 140;
  const punkte = zeilen.map((z, i) => `${20 + i * 50},${y(z.stand)}`).join(" ");
  const tiefster = zeilen.reduce((a, b) => (b.stand < a.stand ? b : a), zeilen[0]);
  const feld = (key: keyof typeof e, label: string, suffix = "") => (
    <label className="gp-feldname"><span>{label}</span>
      <div className="gpf-zahl"><input className="gp-eingabe" inputMode="decimal" value={String(e[key])} onChange={(ev) => setE({ ...e, [key]: ev.target.value.replace(",", ".") as any })} />{suffix && <em>{suffix}</em>}</div>
    </label>
  );
  return (
    <div className="gpf-werkzeug">
      <div className="gpf-werkzeug-kopf"><div><b>Liquiditätsplan · zwölf Monate</b><small>Werte ändern — die Kurve folgt sofort.</small></div>
        <button type="button" className="gp-knopf leise klein" onClick={() => window.print()}>Drucken</button></div>
      <div className="gpf-felder drei">
        {feld("start", "Kontostand heute", "USD")}{feld("umsatz", "Umsatz im ersten Monat", "USD")}{feld("wachstum", "Wachstum je Monat", "%")}
        {feld("fix", "Fixkosten je Monat", "USD")}{feld("variabel", "Variable Kosten vom Umsatz", "%")}{feld("einmal", "Einmalige Ausgabe", "USD")}
        {feld("einmalMonat", "… im Monat (1–12)")}
      </div>
      <svg className="gpf-kurve" viewBox="0 0 600 160" role="img" aria-label="Kontostand über zwölf Monate">
        <line x1="0" x2="600" y1={y(0)} y2={y(0)} className="null" />
        <polyline points={`20,${y(0)} ${punkte} ${20 + 11 * 50},${y(0)}`} className="flaeche" />
        <polyline points={punkte} className="linie" />
        {zeilen.map((z, i) => <circle key={i} cx={20 + i * 50} cy={y(z.stand)} r={z === tiefster ? 5 : 3} className={z.stand < 0 ? "rot" : z === tiefster ? "tief" : ""} />)}
      </svg>
      <div className="gpf-kennzahlen">
        <div><small>Stand nach zwölf Monaten</small><b className={zeilen[11].stand < 0 ? "rot" : ""}>{usd(zeilen[11].stand)}</b></div>
        <div><small>Tiefster Stand</small><b className={tiefster.stand < 0 ? "rot" : ""}>{usd(tiefster.stand)} <em>Monat {tiefster.m}</em></b></div>
        <div><small>Umsatz im Jahr</small><b>{usd(zeilen.reduce((s2, z) => s2 + z.ein, 0))}</b></div>
      </div>
      {tiefster.stand < 0 && <p className="gp-meldung schlecht">In Monat {tiefster.m} reicht das Geld nicht — Puffer, Kreditrahmen oder spätere Ausgaben schließen die Lücke.</p>}
      <div className="gpf-tabelle-huelle"><table className="gpf-tabelle"><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Kontostand</th></tr></thead>
        <tbody>{zeilen.map((z) => <tr key={z.m}><td>{z.m}</td><td>{usd(z.ein)}</td><td>{usd(z.aus)}</td><td className={z.stand < 0 ? "rot" : ""}>{usd(z.stand)}</td></tr>)}</tbody></table></div>
    </div>
  );
}

function Kapitalbedarf({ gref }: { gref: string }) {
  const k = `gp-kap:${gref}`;
  const [zeilen, setZeilen] = useState<{ was: string; betrag: string }[]>(() => speicher.lesen(k, [{ was: "Ware / Material", betrag: "15000" }, { was: "Marketing", betrag: "5000" }, { was: "Laufende Kosten (drei Monate)", betrag: "12000" }]));
  const [puffer, setPuffer] = useState(15);
  useEffect(() => { speicher.schreiben(k, zeilen); }, [k, zeilen]);
  const summe = zeilen.reduce((s2, z) => s2 + (Number(z.betrag.replace(",", ".")) || 0), 0);
  return (
    <div className="gpf-werkzeug">
      <div className="gpf-werkzeug-kopf"><div><b>Kapitalbedarf</b><small>Die Summe mit Puffer ist Ihre Zahl fürs Bank-Exposé.</small></div></div>
      {zeilen.map((z, i) => (
        <div key={i} className="gpf-kap-zeile">
          <input className="gp-eingabe" value={z.was} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, was: e.target.value } : x)))} />
          <div className="gpf-zahl"><input className="gp-eingabe" inputMode="decimal" value={z.betrag} onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, betrag: e.target.value } : x)))} /><em>USD</em></div>
          <button type="button" className="gp-kopie" onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))} aria-label="Zeile entfernen">Entfernen</button>
        </div>
      ))}
      <button type="button" className="gp-link" onClick={() => setZeilen([...zeilen, { was: "", betrag: "" }])}>Position hinzufügen</button>
      <label className="gp-feldname"><span>Puffer für Unvorhergesehenes: {puffer} %</span><input type="range" min={0} max={40} value={puffer} onChange={(e) => setPuffer(Number(e.target.value))} /></label>
      <div className="gpf-kennzahlen">
        <div><small>Summe</small><b>{usd(summe)}</b></div>
        <div><small>Puffer</small><b>{usd(summe * puffer / 100)}</b></div>
        <div className="gross"><small>Kapitalbedarf</small><b>{usd(summe * (1 + puffer / 100))}</b></div>
      </div>
    </div>
  );
}

const KREDIT_SCHRITTE = [
  "EIN liegt vor, Gesellschaft im Register aktiv",
  "Adresse und Telefon überall gleich (Register, Bank, Website)",
  "Geschäftskonto eröffnet und regelmäßig genutzt",
  "Website und E-Mail-Adresse auf der eigenen Domain",
  "DUNS-Nummer bei Dun & Bradstreet beantragt",
  "Erste Lieferanten mit Zahlungsziel („Net 30“), die an Auskunfteien melden",
  "Rechnungen immer vor Fälligkeit bezahlt",
  "Erste Firmenkarte genutzt, Auslastung niedrig",
  "Bank-Mappe vollständig (Register, EIN, Operating Agreement, Kontoauszüge)",
];
function Kreditfahrplan({ gref }: { gref: string }) {
  const k = `gp-kredit:${gref}`;
  const [h, setH] = useState<boolean[]>(() => speicher.lesen(k, []));
  const n = h.filter(Boolean).length;
  return (
    <div className="gpf-werkzeug">
      {/* E-452: keine Prozentzahl, kein Zähler — die Haken sprechen für sich. */}
      <div className="gpf-werkzeug-kopf"><div><b>Kreditwürdigkeit Ihrer Firma</b><small>Was Auskunfteien und Banken sehen wollen — zum Abhaken.</small></div></div>
      {KREDIT_SCHRITTE.map((x, i) => (
        <label key={i} className={`gpf-haken${h[i] ? " an" : ""}`}>
          <input type="checkbox" checked={!!h[i]} onChange={() => { const neu = [...h]; neu[i] = !neu[i]; setH(neu); speicher.schreiben(k, neu); }} />
          <span className="gpf-haken-feld">{h[i] && <i className="gp-hk" />}</span><span>{x}</span>
        </label>
      ))}
      {n === KREDIT_SCHRITTE.length && <p className="gpf-alles-abgehakt">Alles abgehakt.</p>}
    </div>
  );
}

function Expose({ mitToken, vorschau, laden, geh }: { mitToken: (p: string) => string; vorschau: boolean; laden: () => void; geh: (s: string) => void }) {
  const FELDER: { key: string; label: string; hilfe: string }[] = [
    { key: "geschaeft", label: "Was macht Ihr Unternehmen?", hilfe: "Produkt oder Leistung, für wen, seit wann." },
    { key: "kunden", label: "Wer sind Ihre Kunden, wo verkaufen Sie?", hilfe: "Zielgruppe, Märkte, Kunden (ohne Namen, wenn vertraulich)." },
    { key: "umsatz", label: "Umsatz und Entwicklung", hilfe: "Letztes Jahr, laufendes Jahr, Planung." },
    { key: "kosten", label: "Wichtigste Kosten und Marge", hilfe: "Große Kostenblöcke, ungefähre Marge." },
    { key: "kapital", label: "Wie viel Kapital suchen Sie?", hilfe: "Betrag in USD — der Kapitalbedarf-Rechner hilft." },
    { key: "verwendung", label: "Wofür genau?", hilfe: "Ware, Marketing, Personal, Ausstattung …" },
    { key: "team", label: "Wer führt das Unternehmen?", hilfe: "Sie und Ihr Team, Erfahrung, Branche." },
    { key: "besonderheit", label: "Was spricht für Sie?", hilfe: "Verträge, wiederkehrende Umsätze, Referenzen, Sicherheiten." },
  ];
  const [w, setW] = useState<Record<string, string>>({});
  const [stand, setStand] = useState("");
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const los = async () => {
    setStand("laeuft"); setMeldung(null);
    try {
      const r = await fetch(mitToken("/fach/expose"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) });
      if (r.ok && (r.headers.get("content-type") || "").includes("application/pdf")) { window.open(URL.createObjectURL(await r.blob()), "_blank", "noopener"); setMeldung({ gut: true, text: "Vorschau-PDF geöffnet — nichts abgelegt." }); }
      else { const j = await r.json().catch(() => ({})); if (r.ok && j.ok) { setMeldung({ gut: true, text: j.meldung }); laden(); } else setMeldung({ gut: false, text: j.error || "—" }); }
    } catch { setMeldung({ gut: false, text: "Keine Verbindung — bitte noch einmal." }); }
    finally { setStand(""); }
  };
  return (
    <div className="gpf-werkzeug">
      <div className="gpf-werkzeug-kopf"><div><b>Bank-Exposé (Executive Summary)</b><small>Auf Deutsch ausfüllen — die KI legt ein englisches PDF in Ihren Tresor.</small></div></div>
      <div className="gpf-felder">
        {FELDER.map((f) => (
          <label key={f.key} className="gp-feldname breit"><span>{f.label}</span>
            <textarea className="gp-eingabe" rows={2} value={w[f.key] ?? ""} onChange={(e) => setW({ ...w, [f.key]: e.target.value })} /><small>{f.hilfe}</small></label>
        ))}
      </div>
      {meldung && <p className={`gp-meldung ${meldung.gut ? "gut" : "schlecht"}`}>{meldung.text}{meldung.gut && !vorschau && <> <button type="button" className="gp-link" onClick={() => geh("tresor")}>Zum Tresor</button></>}</p>}
      <button type="button" className="gp-knopf gross" disabled={(w.geschaeft ?? "").trim().length < 20 || stand === "laeuft"} onClick={los}>
        {stand === "laeuft" ? "Die KI schreibt Ihr Exposé …" : "Exposé erstellen"}
      </button>
    </div>
  );
}

// ── Der Bereich ──────────────────────────────────────────────────────────────
export default function GlobalFach({ bereich, a, s, mitToken, vorschau, laden, geh }: {
  bereich: FachBereich; a: T; s: "de" | "en"; mitToken: (p: string) => string; vorschau: boolean; laden: () => void; geh: (seite: string) => void;
}) {
  const [reiter, setReiter] = useState<Reiter>(REITER[bereich][0]);
  const [daten, setDaten] = useState<{ vorbelegung: Record<string, string>; chats: Record<string, T[]> } | null>(null);
  const [frageVor, setFrageVor] = useState("");
  const [einzelfall, setEinzelfall] = useState<{ text?: string } | null>(null);
  const [werkzeug, setWerkzeug] = useState<"liquiditaet" | "kapital" | "kredit" | "expose">("liquiditaet");
  useEffect(() => { setReiter(REITER[bereich][0]); setFrageVor(""); }, [bereich]);
  useEffect(() => {
    let weg = false;
    fetch(mitToken("/fach")).then((r) => r.json()).then((j) => { if (!weg && j?.ok) setDaten({ vorbelegung: j.vorbelegung ?? {}, chats: j.chats ?? {} }); }).catch(() => {});
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereich]);
  const fragen = (q: string) => { setFrageVor(q); setReiter("sparring"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const staat = a.gesellschaft?.bundesstaatCode ?? null;

  return (
    <section className="gp-abschnitt gpf">
      <div className="gpf-reiter" role="tablist">
        {REITER[bereich].map((r) => {
          const R = REITER_TEXT[r];
          return (
            <button key={r} type="button" role="tab" aria-selected={reiter === r} className={reiter === r ? "an" : ""} onClick={() => setReiter(r)}>
              {r === "bibliothek" ? BIBLIOTHEK_NAME[bereich] : (s === "en" ? R.en : R.de)}
            </button>
          );
        })}
      </div>
      {s === "en" && reiter !== "sparring" && <p className="gp-leise">Library and templates in German; documents in English.</p>}
      <div className="gpf-inhalt" key={`${bereich}:${reiter}`}>
        {reiter === "sparring" && <Sparring bereich={bereich} verlauf={daten?.chats?.[bereich] ?? []} mitToken={mitToken} vorschau={vorschau} frageVor={frageVor} onEinzelfall={(text) => setEinzelfall({ text })} />}
        {reiter === "bibliothek" && <Bibliothek bereich={bereich} gref={String(a.ref)} onFrage={fragen} />}
        {reiter === "vorlagen" && <Vorlagen mitToken={mitToken} vorbelegung={daten?.vorbelegung ?? {}} vorschau={vorschau} laden={laden} geh={geh} />}
        {reiter === "formulare" && <Formulare staat={staat} />}
        {reiter === "check" && <Check_ staat={staat} onFrage={fragen} />}
        {reiter === "werkzeuge" && (
          <>
            <div className="gpf-werkzeugwahl">
              {([["liquiditaet", "Liquiditätsplan"], ["kapital", "Kapitalbedarf"], ["kredit", "Kreditwürdigkeit"], ["expose", "Bank-Exposé"]] as const).map(([k2, t2]) => (
                <button key={k2} type="button" className={werkzeug === k2 ? "an" : ""} onClick={() => setWerkzeug(k2)}>{t2}</button>
              ))}
            </div>
            {werkzeug === "liquiditaet" && <Liquiditaet gref={String(a.ref)} />}
            {werkzeug === "kapital" && <Kapitalbedarf gref={String(a.ref)} />}
            {werkzeug === "kredit" && <Kreditfahrplan gref={String(a.ref)} />}
            {werkzeug === "expose" && <Expose mitToken={mitToken} vorschau={vorschau} laden={laden} geh={geh} />}
          </>
        )}
      </div>
      {reiter !== "sparring" && (
        <button type="button" className="gpf-einzelfall unten" onClick={() => setEinzelfall({})}>Einzelfall prüfen lassen</button>
      )}
      {einzelfall && <Einzelfall bereich={bereich} mitToken={mitToken} vorschau={vorschau} zu={() => setEinzelfall(null)} vorbelegt={einzelfall.text} />}
    </section>
  );
}

