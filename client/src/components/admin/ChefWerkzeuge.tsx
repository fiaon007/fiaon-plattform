// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKSTATT — fünf Werkzeuge für den Geschäftsführer (26.08.2026)
//
// Justin: „Wirklich JEDE JEDE JEDE Funktion und 5 nützlichen Werkzeugen."
//
// ── DIE ORDNUNG DIESES RAUMS ──────────────────────────────────────────────
// Fünf Werkzeuge, untereinander, jedes zugeklappt bis auf das, mit dem man
// arbeitet. Alle fünf gleichzeitig offen wären fünf Tabellen auf einem
// Bildschirm — und damit wieder das, was Justin ausdrücklich nicht will.
//
// Jedes Werkzeug zeigt schon zugeklappt seine EINE Zahl. Wer den Raum
// betritt, sieht ohne einen Klick, welches Werkzeug er heute braucht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import {
  MessageSquareText, ShieldCheck, Cpu, Search, Stamp, ChevronDown,
  CheckCircle2, AlertTriangle, Play, ExternalLink, Loader2, Inbox,
} from "lucide-react";
import { API, eur, zahl, datum, datumZeit, seit, Geruest, Fehlermeldung } from "./chef-teile";

// ═══════════════════════════════════════════════════════════════════════════
// Der Rahmen: ein aufklappbares Werkzeug
// ═══════════════════════════════════════════════════════════════════════════
function Werkzeug({ nr, Icon, titel, satz, kennzahl, ton = "ruhig", offen, aufklappen, children }: {
  nr: number; Icon: any; titel: string; satz: string;
  kennzahl?: { wert: string; wovon: string } | null;
  ton?: "ruhig" | "gut" | "achtung";
  offen: boolean; aufklappen: () => void; children: React.ReactNode;
}) {
  return (
    <section className={`cw-werkzeug${offen ? " auf" : ""} ton-${ton}`}>
      <button type="button" className="cw-kopf" onClick={aufklappen} aria-expanded={offen}>
        <span className="cw-nr">{nr}</span>
        <i className="cw-icon"><Icon size={21} strokeWidth={1.75} /></i>
        <span className="cw-text">
          <b>{titel}</b>
          <em>{satz}</em>
        </span>
        {kennzahl && (
          <span className="cw-kennzahl">
            <b>{kennzahl.wert}</b>
            <em>{kennzahl.wovon}</em>
          </span>
        )}
        <ChevronDown className="cw-pfeil" size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {offen && <div className="cw-inhalt">{children}</div>}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 1 — FRAG DIE ZAHLEN
//
// Eine Frage in Alltagssprache, die Antwort aus der echten Datenbank. Der
// Endpunkt dahinter war seit Monaten gebaut und hatte keinen einzigen
// Aufrufer in der Oberfläche.
//
// ── DIE ERZEUGTE ABFRAGE WIRD IMMER MITGEZEIGT ────────────────────────────
// Ohne sie ist die Antwort eine Behauptung. Mit ihr kann man nachlesen, was
// gezählt wurde — und genau daran entscheidet sich, ob man einer Zahl traut.
// ═══════════════════════════════════════════════════════════════════════════
function FragDieZahlen() {
  const [frage, setFrage] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [antwort, setAntwort] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLTextAreaElement | null>(null);

  const BEISPIELE = [
    "Wie viele Kunden haben diesen Monat zum ersten Mal bezahlt?",
    "Welche fünf Mitarbeiter haben die meisten offenen Raten?",
    "Wie viele Kunden warten seit über 30 Tagen auf ihr Startgespräch?",
    "Welche Pakete wurden dieses Jahr am häufigsten verkauft?",
  ];

  const fragen = async (text: string) => {
    const t = text.trim();
    if (!t || laeuft) return;
    setLaeuft(true); setFehler(null); setAntwort(null);
    try {
      const r = await fetch(`${API}/admin/cockpit/ask`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frage: t, question: t }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { setFehler(j?.error || `Der Server antwortete mit ${r.status}.`); return; }
      setAntwort(j);
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally {
      setLaeuft(false);
    }
  };

  const zeilen: any[] = Array.isArray(antwort?.zeilen) ? antwort.zeilen
    : Array.isArray(antwort?.rows) ? antwort.rows
    : Array.isArray(antwort?.ergebnis) ? antwort.ergebnis : [];
  const sql: string | null = antwort?.sql ?? antwort?.abfrage ?? null;
  const text: string | null = antwort?.antwort ?? antwort?.answer ?? antwort?.text ?? null;

  return (
    <div className="cw-frag">
      <p className="cw-erklaerung">
        Frag in ganzen Sätzen. Die Antwort kommt aus der echten Datenbank, und
        die erzeugte Abfrage steht darunter — nur lesend, es wird nichts verändert.
      </p>
      <div className="cw-fragfeld">
        <textarea
          ref={feld} value={frage} rows={2}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) fragen(frage); }}
          placeholder="Zum Beispiel: Wie viele Kunden zahlen gerade in Raten?"
        />
        <button type="button" className="cw-knopf haupt" onClick={() => fragen(frage)} disabled={laeuft || !frage.trim()}>
          {laeuft ? <><Loader2 size={16} className="cw-dreht" /> rechnet …</> : "Fragen"}
        </button>
      </div>
      <div className="cw-beispiele">
        {BEISPIELE.map((b) => (
          <button key={b} type="button" onClick={() => { setFrage(b); fragen(b); }}>{b}</button>
        ))}
      </div>

      {fehler && <Fehlermeldung text={fehler} />}

      {antwort && (
        <div className="cw-antwort">
          {text && <p className="cw-antwort-satz">{text}</p>}
          {zeilen.length > 0 && (
            <div className="cw-tabelle-rahmen">
              <table className="cw-tabelle">
                <thead>
                  <tr>{Object.keys(zeilen[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                </thead>
                <tbody>
                  {zeilen.slice(0, 50).map((z, i) => (
                    <tr key={i}>
                      {Object.values(z).map((v, j) => (
                        <td key={j}>{v === null || v === undefined ? "—" : String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {zeilen.length > 50 && <p className="cw-hinweis">Es werden die ersten 50 von {zahl(zeilen.length)} Zeilen gezeigt.</p>}
            </div>
          )}
          {sql && (
            <details className="cw-sql">
              <summary>Die erzeugte Abfrage ansehen</summary>
              <pre>{sql}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 2 — DER WAHRHEITS-CHECK
// ═══════════════════════════════════════════════════════════════════════════
function WahrheitsCheck() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/werkzeug/wahrheit`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Der Check ließ sich nicht ausführen.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  if (laedt) return <Geruest zeilen={6} />;
  if (fehler) return <Fehlermeldung text={fehler} erneut={laden} />;
  if (!d) return null;

  return (
    <div className="cw-wahrheit">
      <p className="cw-erklaerung">
        Sieben Stellen, an denen die Zahlen auseinanderlaufen können. Jede nennt,
        was der Befund bedeutet — und wo man ihn behebt.
      </p>
      <div className="cw-pruefliste">
        {d.pruefungen.map((p: any) => (
          <div key={p.key} className={`cw-pruefung${p.gut ? " gut" : ""}`}>
            <button type="button" className="cw-pruefkopf"
                    onClick={() => setOffen(offen === p.key ? null : p.key)}
                    aria-expanded={offen === p.key}>
              <i>{p.gut ? <CheckCircle2 size={18} strokeWidth={1.6} /> : <AlertTriangle size={18} strokeWidth={1.6} />}</i>
              <span>
                <b>{p.titel}</b>
                <em>{p.frage}</em>
              </span>
              <strong>{p.gut ? "in Ordnung" : zahl(p.anzahl)}</strong>
            </button>
            {offen === p.key && (
              <div className="cw-pruefinhalt">
                <p className="cw-folge">{p.folge}</p>
                {p.summe > 0 && <p className="cw-summe">{eur(p.summe)}</p>}
                {p.zeilen?.length > 0 && (
                  <div className="cw-tabelle-rahmen">
                    <table className="cw-tabelle">
                      <thead><tr>{Object.keys(p.zeilen[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                      <tbody>
                        {p.zeilen.map((z: any, i: number) => (
                          <tr key={i}>{Object.entries(z).map(([sp, v]: any, j: number) => (
                            <td key={j}>{v === null || v === undefined ? "—"
                              : typeof v === "boolean" ? (v ? "ja" : "nein")
                              : /cents$/.test(sp) ? eur(Number(v))
                              : k_kurz(v)}</td>
                          ))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {p.knopf?.href && (
                  <a className="cw-knopf" href={p.knopf.href}>
                    {p.knopf.label} <ExternalLink size={14} strokeWidth={1.6} />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lange Zeitstempel in der Tabelle kürzen — sonst reißt jede Spalte auf. */
function k_kurz(v: any): string {
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return datum(s);
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 3 — DER MASCHINENRAUM
// ═══════════════════════════════════════════════════════════════════════════
function Maschinenraum() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/werkzeug/maschinen`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Der Maschinenraum ließ sich nicht laden.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  const starten = async (h: any) => {
    if (laeuft) return;
    // Ein Lauf von Hand kann Mails auslösen. Deshalb wird gefragt, und die
    // Frage nennt den Namen des Laufs — nicht nur „Bist du sicher?".
    if (!window.confirm(`„${h.label}" jetzt von Hand starten?\n\n${h.satz}\n\nDabei können E-Mails an Kunden hinausgehen.`)) return;
    setLaeuft(h.key); setMeldung(null);
    try {
      const r = await fetch(`${API}${h.pfad}`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      setMeldung(r.ok ? `„${h.label}" ist durchgelaufen.${j?.anzahl != null ? ` ${zahl(j.anzahl)} Vorgänge.` : ""}`
                      : `„${h.label}" ist fehlgeschlagen: ${j?.error || r.status}`);
      laden();
    } catch {
      setMeldung(`„${h.label}" ließ sich nicht starten — keine Verbindung.`);
    } finally {
      setLaeuft(null);
    }
  };

  if (laedt) return <Geruest zeilen={5} />;
  if (fehler) return <Fehlermeldung text={fehler} erneut={laden} />;
  if (!d) return null;

  return (
    <div className="cw-maschinen">
      <p className="cw-erklaerung">
        {d.cronsAn
          ? "Die Automatik ist eingeschaltet. Gelb heißt: länger als üblich her. Rot heißt: zu lange."
          : "Achtung — die Automatik ist auf diesem Server AUSGESCHALTET. Alle Ampeln unten sind deshalb ohne Aussage."}
      </p>

      <div className="cw-ampeln">
        {d.laeufe.map((l: any) => (
          <div key={l.key ?? l.name} className={`cw-ampel ${l.ampel}`}>
            <span className="cw-punkt" aria-hidden="true" />
            <b>{l.label ?? l.name ?? l.key}</b>
            <em>{l.zuletzt ? seit(l.zuletzt) : "noch nie gelaufen"}</em>
          </div>
        ))}
      </div>

      <div className="cw-heute">
        <span><b>{zahl(d.heute.mails)}</b><em>Mails heute hinausgegangen</em></span>
        <span><b>{zahl(d.heute.zahlungen)}</b><em>Zahlungen heute eingegangen</em></span>
      </div>

      <div className="cw-handstarts">
        <h4>Von Hand anwerfen</h4>
        {d.handstarts.map((h: any) => (
          <button key={h.key} type="button" className="cw-knopf" onClick={() => starten(h)} disabled={!!laeuft}>
            {laeuft === h.key ? <Loader2 size={15} className="cw-dreht" /> : <Play size={15} strokeWidth={1.7} />}
            {h.label}
            <em>{h.satz}</em>
          </button>
        ))}
      </div>
      {meldung && <p className="cw-meldung" role="status">{meldung}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 4 — SPRUNG & FREMDSICHT
//
// Name oder Nummer eintippen, in zwei Sekunden in der Akte stehen, und mit
// einem Klick sehen, was der Kunde oder der Mitarbeiter sieht. Das ist das
// Werkzeug für jeden Beschwerdeanruf — und es lag bisher drei Ebenen tief.
// ═══════════════════════════════════════════════════════════════════════════
function SprungUndSicht() {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<any[]>([]);
  const [sucht, setSucht] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setTreffer([]); return; }
    // Erst tippen lassen, dann suchen: eine Anfrage je Tastendruck wäre bei
    // 5.196 Personen eine Last ohne Nutzen.
    const timer = setTimeout(() => {
      setSucht(true);
      fetch(`${API}/chef/kunden?q=${encodeURIComponent(t)}&proSeite=8`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => setTreffer(j?.ok ? j.zeilen : []))
        .catch(() => setTreffer([]))
        .finally(() => setSucht(false));
    }, 260);
    return () => clearTimeout(timer);
  }, [q]);

  const alsKunde = async (ref: string | null) => {
    if (!ref) { setMeldung("Zu dieser Person gibt es keine Akte, in die man springen könnte."); return; }
    try {
      const r = await fetch(`${API}/admin/kunden/${encodeURIComponent(ref)}/ansicht`, {
        method: "POST", credentials: "include",
      });
      const j = await r.json().catch(() => null);
      if (r.ok && (j?.url || j?.ziel)) window.open(j.url ?? j.ziel, "_blank", "noopener");
      else setMeldung(j?.error || "Die Kundensicht ließ sich nicht öffnen.");
    } catch {
      setMeldung("Keine Verbindung zum Server.");
    }
  };

  return (
    <div className="cw-sprung">
      <p className="cw-erklaerung">
        Name, E-Mail, Telefonnummer oder Aktenzeichen. Von hier aus geht es in
        die Akte — oder direkt in die Sicht des Kunden.
      </p>
      <div className="cw-suchfeld">
        <Search size={18} strokeWidth={1.6} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Suchen …" autoComplete="off" spellCheck={false} />
        {sucht && <Loader2 size={16} className="cw-dreht" aria-hidden="true" />}
      </div>

      {q.trim().length >= 2 && treffer.length === 0 && !sucht && (
        <p className="cw-hinweis">Nichts gefunden. Vielleicht ist die Person als Dublette zusammengeführt.</p>
      )}

      {treffer.length > 0 && (
        <ul className="cw-treffer">
          {treffer.map((t) => (
            <li key={t.id}>
              <span className="cw-treffer-wer">
                <b>{[t.first_name, t.last_name].filter(Boolean).join(" ") || t.company_name || "ohne Namen"}</b>
                <em>{t.primary_email || t.primary_phone || "keine Kontaktdaten"}{t.city ? ` · ${t.city}` : ""}</em>
              </span>
              <span className="cw-treffer-geld">
                <b>{eur(Number(t.bezahlt_cents || 0))}</b>
                <em>{t.mitarbeiter || "im Pool"}</em>
              </span>
              <span className="cw-treffer-knoepfe">
                <a className="cw-knopf klein" href={`/chef/s/akte?id=${t.id}`}>Akte</a>
                <button type="button" className="cw-knopf klein" onClick={() => alsKunde(t.ref)}>
                  als Kunde sehen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {meldung && <p className="cw-meldung" role="status">{meldung}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WERKZEUG 5 — DER FREIGABESTAPEL GELD
// ═══════════════════════════════════════════════════════════════════════════
function Freigabestapel() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/werkzeug/freigaben`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Der Stapel ließ sich nicht laden.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  if (laedt) return <Geruest zeilen={4} />;
  if (fehler) return <Fehlermeldung text={fehler} erneut={laden} />;
  if (!d) return null;

  return (
    <div className="cw-freigaben">
      <p className="cw-erklaerung">
        Vier Stapel, die nur du entscheiden kannst. Der Knopf führt jeweils
        dorthin, wo die Entscheidung getroffen wird — hier wird nichts
        versehentlich ausgelöst.
      </p>
      {d.stapel.map((t: any) => (
        <div key={t.key} className={`cw-stapel${Number(t.anzahl) === 0 ? " leer" : ""}`}>
          <button type="button" className="cw-stapelkopf"
                  onClick={() => setOffen(offen === t.key ? null : t.key)}
                  aria-expanded={offen === t.key} disabled={Number(t.anzahl) === 0}>
            <span>
              <b>{t.titel}</b>
              <em>{t.satz}</em>
            </span>
            <strong>
              {zahl(t.anzahl)}
              {t.summe > 0 && <em>{eur(t.summe)}</em>}
            </strong>
          </button>
          {offen === t.key && (
            <div className="cw-stapelinhalt">
              {t.zeilen?.length > 0 ? (
                <div className="cw-tabelle-rahmen">
                  <table className="cw-tabelle">
                    <thead><tr>{Object.keys(t.zeilen[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                    <tbody>
                      {t.zeilen.map((z: any, i: number) => (
                        <tr key={i}>{Object.entries(z).map(([k, v]: any, j: number) => (
                          <td key={j}>
                            {v === null || v === undefined ? "—"
                              : typeof v === "boolean" ? (v ? "ja" : "nein")
                              : /cents$/.test(k) ? eur(Number(v))
                              : k_kurz(v)}
                          </td>
                        ))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="cw-hinweis">Für diesen Stapel gibt es keine Einzelaufstellung — der Knopf führt an den Ort.</p>
              )}
              <a className="cw-knopf haupt" href={t.href}>
                Dort entscheiden <ExternalLink size={14} strokeWidth={1.6} />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER POSTEINGANG — was von draußen hereinkommt
//
// Kein Werkzeug im engeren Sinn, sondern eine Tür, die es nie gab: Zwei
// Kanäle schrieben in die Datenbank, ohne dass irgendeine Oberfläche sie las.
// ═══════════════════════════════════════════════════════════════════════════
function Posteingang() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/werkzeug/posteingang`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Der Posteingang ließ sich nicht laden.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  if (laedt) return <Geruest zeilen={4} />;
  if (fehler) return <Fehlermeldung text={fehler} erneut={laden} />;
  if (!d) return null;

  return (
    <div className="cw-post">
      <p className="cw-erklaerung">
        Anfragen von der Website und offene Kundenanfragen aus dem
        Kundenbereich. Beides stand bisher in der Datenbank, ohne dass es
        irgendwo zu sehen war.
      </p>

      <h4>Offene Kundenanfragen <span>{zahl(d.tickets.anzahl)}</span></h4>
      {d.tickets.zeilen.length === 0 ? (
        <p className="cw-hinweis">Keine offene Kundenanfrage.</p>
      ) : (
        <ul className="cw-postliste">
          {d.tickets.zeilen.map((t: any) => (
            <li key={t.id}>
              <span className="cw-post-wer">
                <b>{t.kunde || "unbekannt"}</b>
                <em>{t.betreff || "ohne Betreff"}</em>
              </span>
              <span className="cw-post-text">{String(t.text || "").slice(0, 180)}</span>
              <span className="cw-post-zeit">
                <b>{seit(t.created_at)}</b>
                <em>{t.zustaendig || "niemand zuständig"}</em>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h4>Anfragen von der Website <span>{zahl(d.anfragen.anzahl)}</span></h4>
      {d.anfragen.zeilen.length === 0 ? (
        <p className="cw-hinweis">Keine Anfrage.</p>
      ) : (
        <ul className="cw-postliste">
          {d.anfragen.zeilen.map((a: any) => (
            <li key={a.id}>
              <span className="cw-post-wer">
                <b>{a.name || "ohne Namen"}</b>
                <em>{a.art}{a.firma ? ` · ${a.firma}` : ""}</em>
              </span>
              <span className="cw-post-text">{String(a.text || "").slice(0, 180)}</span>
              <span className="cw-post-zeit">
                <b>{datumZeit(a.created_at)}</b>
                <em>{a.email || a.telefon || "keine Kontaktdaten"}</em>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER RAUM
// ═══════════════════════════════════════════════════════════════════════════
export default function ChefWerkzeuge() {
  const [offen, setOffen] = useState<string | null>("wahrheit");
  const [kopf, setKopf] = useState<{ wahrheit?: any; freigaben?: any; post?: any; maschinen?: any }>({});

  // Die Kennzahlen im zugeklappten Zustand: EIN Aufruf je Werkzeug, damit man
  // ohne Klick sieht, welches Werkzeug heute etwas von einem will.
  useEffect(() => {
    let weg = false;
    const hol = (pfad: string, schluessel: string) =>
      fetch(`${API}${pfad}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => { if (!weg && j?.ok) setKopf((k) => ({ ...k, [schluessel]: j })); })
        .catch(() => {});
    hol("/chef/werkzeug/wahrheit", "wahrheit");
    hol("/chef/werkzeug/freigaben", "freigaben");
    hol("/chef/werkzeug/posteingang", "post");
    hol("/chef/werkzeug/maschinen", "maschinen");
    return () => { weg = true; };
  }, []);

  const um = (k: string) => setOffen(offen === k ? null : k);

  return (
    <div className="cl cw">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Werkstatt</p>
        <h1>Fünf Werkzeuge</h1>
        <p className="cl-untertitel">
          Alle fünf arbeiten auf den echten Daten. Was etwas verändert, fragt
          vorher nach und wird im Chef-Protokoll festgehalten.
        </p>
      </header>

      <Werkzeug
        nr={1} Icon={MessageSquareText} titel="Frag die Zahlen"
        satz="Eine Frage in ganzen Sätzen, die Antwort aus der Datenbank."
        offen={offen === "frag"} aufklappen={() => um("frag")}
      >
        <FragDieZahlen />
      </Werkzeug>

      <Werkzeug
        nr={2} Icon={ShieldCheck} titel="Wahrheits-Check"
        satz="Stimmen meine Zahlen? Sieben Prüfungen an den empfindlichen Stellen."
        ton={kopf.wahrheit ? (kopf.wahrheit.offen === 0 ? "gut" : "achtung") : "ruhig"}
        kennzahl={kopf.wahrheit ? {
          wert: kopf.wahrheit.offen === 0 ? "sauber" : String(kopf.wahrheit.offen),
          wovon: kopf.wahrheit.offen === 0 ? "keine Abweichung" : `von ${kopf.wahrheit.gesamt} Prüfungen`,
        } : null}
        offen={offen === "wahrheit"} aufklappen={() => um("wahrheit")}
      >
        <WahrheitsCheck />
      </Werkzeug>

      <Werkzeug
        nr={3} Icon={Cpu} titel="Maschinenraum"
        satz="Läuft die Automatik — und kann ich sie von hier neu anwerfen?"
        ton={kopf.maschinen ? (kopf.maschinen.rot > 0 ? "achtung" : "gut") : "ruhig"}
        kennzahl={kopf.maschinen ? {
          wert: kopf.maschinen.rot > 0 ? `${kopf.maschinen.rot} rot` : "läuft",
          wovon: `${zahl(kopf.maschinen.laeufe?.length ?? 0)} Läufe`,
        } : null}
        offen={offen === "maschinen"} aufklappen={() => um("maschinen")}
      >
        <Maschinenraum />
      </Werkzeug>

      <Werkzeug
        nr={4} Icon={Search} titel="Sprung & Fremdsicht"
        satz="In zwei Sekunden in der Akte — oder in der Sicht des Kunden."
        offen={offen === "sprung"} aufklappen={() => um("sprung")}
      >
        <SprungUndSicht />
      </Werkzeug>

      <Werkzeug
        nr={5} Icon={Stamp} titel="Freigabestapel Geld"
        satz="Alles, was nur du entscheiden kannst — an einer Stelle."
        ton={kopf.freigaben ? (kopf.freigaben.offen > 0 ? "achtung" : "gut") : "ruhig"}
        kennzahl={kopf.freigaben ? {
          wert: zahl(kopf.freigaben.offen),
          wovon: kopf.freigaben.summe > 0 ? eur(kopf.freigaben.summe) : "offene Vorgänge",
        } : null}
        offen={offen === "freigaben"} aufklappen={() => um("freigaben")}
      >
        <Freigabestapel />
      </Werkzeug>

      <Werkzeug
        nr={6} Icon={Inbox} titel="Posteingang"
        satz="Anfragen von der Website und offene Kundenanfragen."
        ton={kopf.post ? ((kopf.post.tickets.anzahl + kopf.post.anfragen.anzahl) > 0 ? "achtung" : "gut") : "ruhig"}
        kennzahl={kopf.post ? {
          wert: zahl(kopf.post.tickets.anzahl + kopf.post.anfragen.anzahl),
          wovon: kopf.post.tickets.aeltesteStunden > 48
            ? `älteste liegt ${Math.floor(kopf.post.tickets.aeltesteStunden / 24)} Tage`
            : "unbeantwortet",
        } : null}
        offen={offen === "post"} aufklappen={() => um("post")}
      >
        <Posteingang />
      </Werkzeug>
    </div>
  );
}
