// ═══════════════════════════════════════════════════════════════════════════
// /zugang/uebergabe#<Token> — DIE EMPFÄNGERSEITE „ZUGANG ÜBERGEBEN" (08.10.2026)
//
// Die digitale Fassung des Übergabe-PDFs: Code eingeben → Willkommen, Zugang,
// Start-Passwort (verdeckt, „Anzeigen", „Kopieren"), drei Schritte, Regeln,
// Ansprechperson → „Ich habe meinen Zugang erhalten und das Passwort geändert".
//
// Das Token steht im ANKER (#…), nicht im Pfad: Ein Anker geht nie an einen
// Server, in kein Zugriffsprotokoll und in keinen Referer. Die Seite schickt es
// nur im Körper ihrer Anfragen (POST /api/fiaon/zugang-uebergabe/…). Ohne den
// Code (getrennt, mündlich) zeigt sie nichts außer dem Stand des Links.
//
// /zugang/:ref (Setz-Link für Kunden, zugang-setzen.tsx) ist eine andere Seite;
// diese Route steht in App.tsx VOR ihr. Gesiezt, wie im PDF. Immer hell.
// Texte: shared/fiaon-zugang-uebergabe.ts (dort prüft sie die Wortwand).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { UEBERGABE_CODE_STELLEN, ZUGANG_UEBERGABE_TEXTE as T, type UebergabeStand } from "@shared/fiaon-zugang-uebergabe";
import "@/styles/zugang-uebergabe.css";

interface Anzeige {
  vorname: string; name: string; rolle: string | null; zugang: string; anmeldeadresse: string; google: boolean;
  passwort: string;
  ansprech: { name: string | null; funktion: string | null; email: string | null; telefon: string | null };
  ausgestelltVon: string | null; ausgestelltAm: string; gueltigBis: string;
}

type Lage =
  | { art: "laedt" }
  | { art: "code"; gueltigBis: string; rest: number }
  | { art: "offen" }
  | { art: "fertig"; vorname: string; wann: string }
  | { art: "zu"; stand: UebergabeStand | "unbekannt" }
  | { art: "zuViele"; minuten: number }
  | { art: "fehler"; text: string };

const zeit = (s: string) => new Date(s).toLocaleString("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
}) + " Uhr";

async function senden(pfad: string, koerper: Record<string, unknown>): Promise<{ status: number; json: any }> {
  try {
    const r = await fetch(`/api/fiaon/zugang-uebergabe/${pfad}`, {
      method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(koerper),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  } catch {
    return { status: 0, json: null };
  }
}

/** Das Token aus dem Anker — nur die erlaubte Form, sonst leer. */
function tokenAusAnker(): string {
  const roh = typeof window === "undefined" ? "" : decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
  return /^[A-Za-z0-9_-]{43}$/.test(roh) ? roh : "";
}

function Zeichen({ art }: { art: "schloss" | "haken" | "halt" }) {
  // Selbst gezeichnet, 1,5 px, currentColor (AGENTS.md: keine Icon-Bibliotheken auf neuen Flächen).
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {art === "schloss" && (<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>)}
      {art === "haken" && <path d="M5 12.5l4.5 4.5L19 7.5" />}
      {art === "halt" && (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5" /><path d="M12 16.2v.3" /></>)}
    </svg>
  );
}

export default function ZugangUebergabePage() {
  // AGENTS.md: alle Haken oben, vor dem ersten return.
  const [token] = useState(tokenAusAnker);
  const [lage, setLage] = useState<Lage>({ art: "laedt" });
  const [code, setCode] = useState("");
  const [codeFehler, setCodeFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [anzeige, setAnzeige] = useState<Anzeige | null>(null);
  const [sichtbar, setSichtbar] = useState(false);
  const [kopiert, setKopiert] = useState<"ja" | "nein" | null>(null);
  const [frage, setFrage] = useState(false);
  const [bestFehler, setBestFehler] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  // Kopf: Titel, keine Suchmaschine, kein Referer. Beim Verlassen zurücksetzen.
  useEffect(() => {
    const vorher = document.title;
    document.title = T.seitenTitel;
    const metas: [string, string][] = [["robots", "noindex, nofollow"], ["referrer", "no-referrer"]];
    const alt = metas.map(([name, wert]) => {
      let m = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const neu = !m;
      if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
      const war = m.content;
      m.content = wert;
      return { m, neu, war };
    });
    return () => {
      document.title = vorher;
      for (const a of alt) { if (a.neu) a.m.remove(); else a.m.content = a.war; }
    };
  }, []);

  useEffect(() => {
    if (!token) { setLage({ art: "zu", stand: "unbekannt" }); return; }
    let an = true;
    void senden("stand", { token }).then(({ status, json }) => {
      if (!an) return;
      if (status === 429) return setLage({ art: "zuViele", minuten: Number(json?.minuten) || 15 });
      if (status === 404) return setLage({ art: "zu", stand: "unbekannt" });
      if (status === 0 || !json) return setLage({ art: "fehler", text: T.verbindung });
      if (!json.ok) return setLage({ art: "fehler", text: json.error || T.verbindung });
      if (json.stand === "offen" || json.stand === "angesehen") setLage({ art: "code", gueltigBis: json.gueltigBis, rest: Number(json.rest) });
      else setLage({ art: "zu", stand: json.stand });
    });
    return () => { an = false; };
  }, [token]);

  useEffect(() => { if (lage.art === "code") window.setTimeout(() => codeRef.current?.focus(), 150); }, [lage.art]);

  const oeffnen = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeFehler(null);
    const c = code.replace(/\D/g, "");
    if (c.length !== UEBERGABE_CODE_STELLEN) { setCodeFehler(T.codeUnvollstaendig); return; }
    setLaeuft(true);
    const { status, json } = await senden("oeffnen", { token, code: c });
    setLaeuft(false);
    if (status === 200 && json?.ok) { setCode(c); setAnzeige(json.anzeige); setLage({ art: "offen" }); return; }
    if (status === 401) { setCode(""); setCodeFehler(T.codeFalsch(Number(json?.rest) || 1)); codeRef.current?.focus(); return; }
    if (status === 410) { setCode(""); setLage({ art: "zu", stand: json?.stand ?? "abgelaufen" }); return; }
    if (status === 404) { setLage({ art: "zu", stand: "unbekannt" }); return; }
    if (status === 429) { setLage({ art: "zuViele", minuten: Number(json?.minuten) || 15 }); return; }
    if (status === 400) { setCodeFehler(T.codeUnvollstaendig); return; }
    setCodeFehler(json?.error || T.verbindung);
  };

  const kopieren = async () => {
    if (!anzeige) return;
    try { await navigator.clipboard.writeText(anzeige.passwort); setKopiert("ja"); window.setTimeout(() => setKopiert(null), 2400); }
    catch { setKopiert("nein"); }
  };

  const bestaetigen = async () => {
    setBestFehler(null);
    setLaeuft(true);
    const { status, json } = await senden("bestaetigen", { token, code });
    setLaeuft(false);
    if (status === 200 && json?.ok) {
      // Das Passwort verlässt auch den Speicher dieser Seite.
      setAnzeige(null); setCode(""); setSichtbar(false);
      setLage({ art: "fertig", vorname: json.vorname || "", wann: zeit(json.bestaetigtAm) });
      return;
    }
    if (status === 410) { setAnzeige(null); setCode(""); setLage({ art: "zu", stand: json?.stand ?? "abgelaufen" }); return; }
    if (status === 429) { setLage({ art: "zuViele", minuten: Number(json?.minuten) || 15 }); return; }
    setBestFehler(json?.error || T.verbindung);
  };

  const kopf = (
    <div className="zu-kopf">
      <span className="zu-marke"><FiaonWortmarke /></span>
      <span>{T.vertraulich}</span>
    </div>
  );

  const zustand = (zeichen: "schloss" | "haken" | "halt", titel: string, satz: string, ton = "") => (
    <div className="zu-inhalt zu-zustand">
      <div className={`zu-symbol ${ton}`}><Zeichen art={zeichen} /></div>
      <p className="zu-auge">{T.auge}</p>
      <h1>{titel}</h1>
      <p className="zu-unter">{satz}</p>
    </div>
  );

  let inhalt: JSX.Element;
  if (lage.art === "laedt") {
    inhalt = (
      <div className="zu-inhalt" role="status">
        <p className="zu-auge">{T.auge}</p>
        <p className="zu-unter">{T.laedt}</p>
        <div className="zu-laedt" />
      </div>
    );
  } else if (lage.art === "code") {
    inhalt = (
      <div className="zu-inhalt">
        <p className="zu-auge">{T.auge}</p>
        <h1>{T.codeTitel}</h1>
        <p className="zu-unter">{T.codeSatz}</p>
        <form className="zu-code-form" onSubmit={oeffnen} noValidate>
          <label htmlFor="zu-code">{T.codeFeld}</label>
          <input id="zu-code" ref={codeRef} className="zu-code-eingabe" value={code}
                 onChange={(e) => { setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, UEBERGABE_CODE_STELLEN + 1)); setCodeFehler(null); }}
                 inputMode="numeric" autoComplete="one-time-code" maxLength={UEBERGABE_CODE_STELLEN + 1}
                 aria-invalid={!!codeFehler} aria-describedby="zu-code-hinweis" placeholder="••••••" />
          <button type="submit" className="zu-knopf" disabled={laeuft}>{laeuft ? T.codePrueft : T.codeKnopf}</button>
          <p id="zu-code-hinweis" className={codeFehler ? "zu-fehler" : "zu-leise"} role={codeFehler ? "alert" : undefined}>
            {codeFehler ?? T.gilt(zeit(lage.gueltigBis))}
          </p>
        </form>
      </div>
    );
  } else if (lage.art === "offen" && anzeige) {
    const a = anzeige;
    const ansprech = [a.ansprech.funktion, a.ansprech.email, a.ansprech.telefon].filter(Boolean).join(" · ");
    inhalt = (
      <div className="zu-inhalt">
        <p className="zu-auge">{T.auge}</p>
        <h1>{T.willkommen(a.vorname)}</h1>
        <p className="zu-unter">{T.unter(a.rolle ?? "")}</p>

        <dl className="zu-meta">
          <div><dt>{T.metaFuer}</dt><dd>{a.name}{a.rolle ? ` · ${a.rolle}` : ""}</dd></div>
          <div><dt>{T.metaVon}</dt><dd>{a.ausgestelltVon || "—"}</dd></div>
          <div><dt>{T.metaBis}</dt><dd>{zeit(a.gueltigBis)}</dd></div>
        </dl>

        <h2>{T.zugangTitel}</h2>
        <div className="zu-zugang">
          <div className="zu-zeile"><b>{T.feldZugang}</b><span>{a.zugang}</span></div>
          <div className="zu-zeile"><b>{T.feldAnmeldung}</b><span>{a.anmeldeadresse}</span></div>
          <div className="zu-zeile">
            <b>{T.feldPasswort}</b>
            {/* data-clarity-mask: zusätzlich zur Messsperre (EinwilligungsHinweis) — keine Aufzeichnung sieht diese Zeile. */}
            <span className="zu-pw" data-clarity-mask="True">
              {sichtbar
                ? <code aria-label={T.feldPasswort}>{a.passwort}</code>
                : <code className="verdeckt" aria-label={`${T.feldPasswort} verdeckt`}>{"•".repeat(Math.min(14, Math.max(8, a.passwort.length)))}</code>}
              <button type="button" className="zu-knopf-klein" onClick={() => setSichtbar((v) => !v)} aria-pressed={sichtbar}>
                {sichtbar ? T.verbergen : T.anzeigen}
              </button>
              <button type="button" className="zu-knopf-klein" onClick={() => void kopieren()}>
                {kopiert === "ja" ? T.kopiert : T.kopieren}
              </button>
            </span>
          </div>
          {kopiert === "nein" && <p className="zu-fehler">{T.kopierenGeht}</p>}
          <p className="zu-hinweis">{T.passwortHinweis}</p>
        </div>

        <h2>{T.schritteTitel}</h2>
        <ol className="zu-schritte">
          <li>{T.schritt1(a.anmeldeadresse)}</li>
          <li>{T.schritt2}</li>
          <li>{T.schritt3(a.google)}</li>
        </ol>

        <h2>{T.sicherTitel}</h2>
        <ul className="zu-regeln">
          {T.sicher.map((s) => <li key={s}>{s}</li>)}
        </ul>

        {a.ansprech.name && (
          <>
            <h2>{T.ansprechTitel}</h2>
            <p><strong>{a.ansprech.name}</strong>{ansprech ? `, ${ansprech}` : ""} — {T.ansprechSatz}</p>
          </>
        )}

        <div className="zu-bestaetigen">
          {!frage ? (
            <>
              <button type="button" className="zu-knopf" onClick={() => setFrage(true)}>{T.bestaetigenKnopf}</button>
              <p className="zu-leise">{T.bestaetigenSatz}</p>
            </>
          ) : (
            <div className="zu-frage" role="dialog" aria-modal="false" aria-label={T.bestaetigenKnopf}>
              <p style={{ margin: 0 }}>{T.bestaetigenFrage}</p>
              <div className="zu-reihe">
                <button type="button" className="zu-knopf" onClick={() => void bestaetigen()} disabled={laeuft}>
                  {laeuft ? T.bestaetigenLaeuft : T.bestaetigenJa}
                </button>
                <button type="button" className="zu-knopf still" onClick={() => setFrage(false)} disabled={laeuft}>{T.bestaetigenNein}</button>
              </div>
            </div>
          )}
          {bestFehler && <p className="zu-fehler" role="alert">{bestFehler}</p>}
        </div>
      </div>
    );
  } else if (lage.art === "fertig") {
    inhalt = zustand("haken", T.fertigTitel(lage.vorname), T.fertigSatz(lage.wann), "gut");
  } else if (lage.art === "zuViele") {
    inhalt = zustand("halt", T.zuVieleTitel, T.zuVieleSatz(lage.minuten), "halt");
  } else if (lage.art === "fehler") {
    inhalt = zustand("halt", T.fehlerTitel, lage.text, "halt");
  } else {
    const stand = lage.art === "zu" ? lage.stand : "unbekannt";
    inhalt = stand === "abgelaufen" ? zustand("schloss", T.abgelaufenTitel, T.abgelaufenSatz)
      : stand === "gesperrt" ? zustand("halt", T.gesperrtTitel, T.gesperrtSatz, "halt")
      : stand === "bestaetigt" ? zustand("haken", T.bestaetigtTitel, T.bestaetigtSatz, "gut")
      : stand === "zurueckgezogen" || stand === "ersetzt" ? zustand("schloss", T.zurueckTitel, T.zurueckSatz)
      : zustand("halt", T.unbekanntTitel, T.unbekanntSatz, "halt");
  }

  return (
    <main className="zu-seite">
      <div className="zu-blatt">
        {kopf}
        <div className="zu-gold" />
        {inhalt}
      </div>
      <div className="zu-fuss">
        <span>{T.fuss}</span>
        <span><a href="/impressum" rel="noreferrer">Impressum</a> · <a href="/datenschutz" rel="noreferrer">Datenschutz</a></span>
      </div>
    </main>
  );
}
