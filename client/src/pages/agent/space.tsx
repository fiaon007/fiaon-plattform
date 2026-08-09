import { useCallback, useEffect, useRef, useState } from "react";
import { AgentShell } from "./shared";

// ═══════════════════════════════════════════════════════════════════════════
// SPACE — der Raum, in dem das Team miteinander redet
//
// ── WAS DER BETREIBER BEANSTANDET HAT ──────────────────────────────────────
// „Sieht aus wie ein MVP." Zu Recht: eine Spalte über die volle Breite,
// Beiträge als Kästen mit Rahmen, Reaktionen als Textknöpfe. Das ist eine
// Liste, kein Raum.
//
// ── DIE KOMPOSITION ────────────────────────────────────────────────────────
// Auf dem Bildschirm drei Spalten, wie jedes gute soziale Netzwerk:
//   LINKS   ein kompaktes Profilkärtchen — wer bin ich, was habe ich heute
//   MITTE   der Feed, 620 px. Diese Breite ist keine Willkür: Darüber wird
//           eine Textzeile länger als das Auge in einem Sprung erfasst.
//   RECHTS  „Heute" — Geburtstage, Termine, was ansteht
// Auf 380 px fällt alles bis auf den Feed weg, randlos, wie eine native App.
//
// ── WARUM KARTEN OHNE RAHMEN ───────────────────────────────────────────────
// Ein Rahmen sagt „Formular". Ein weicher Schatten auf hellem Grund sagt
// „liegt darauf". Das ist der ganze Unterschied zwischen einer Tabelle und
// einem Feed.
// ═══════════════════════════════════════════════════════════════════════════

interface Kommentar {
  id: number; agentId: number | null; text: string; am: string;
  name: string | null; avatar: string | null;
}

interface Post {
  id: number;
  autorAgentId: number | null;
  autorTyp: string;
  autorName: string | null;
  autorAvatar: string | null;
  text: string;
  angepinnt: boolean;
  autoArt: string | null;
  am: string;
  reaktionen: Record<string, number>;
  meine: string | null;
  kommentare: Kommentar[];
}

const REAKTIONS_MARKE: Record<string, { titel: string; zeichen: React.ReactNode }> = {
  daumen: {
    titel: "Stark",
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 17V8.6l3.2-5.1c.2-.4.7-.6 1.1-.4.7.3 1.1 1 1.1 1.8L11 8.2h3.6c1 0 1.7.9 1.5 1.9l-1 5c-.1.7-.8 1.2-1.5 1.2H6Z" />
        <path d="M6 8.6H4.3c-.4 0-.8.4-.8.8v6.8c0 .4.4.8.8.8H6" />
      </svg>
    ),
  },
  herz: {
    titel: "Freut mich",
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 16.5s-6-3.7-6-7.7a3.4 3.4 0 0 1 6-2.2 3.4 3.4 0 0 1 6 2.2c0 4-6 7.7-6 7.7Z" />
      </svg>
    ),
  },
  stern: {
    titel: "Bemerkenswert",
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m10 3 2.2 4.5 4.9.7-3.6 3.4.9 4.9L10 14.2 5.6 16.5l.9-4.9L2.9 8.2l4.9-.7L10 3Z" />
      </svg>
    ),
  },
  blitz: {
    titel: "Los geht's",
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 16c2.4-1.2 4.1-3.1 5.2-5.6C9.3 7.8 11.1 5.9 13.6 5" />
        <path d="M15.4 3.2v3.1M17 4.7h-3.1" />
        <circle cx="6.2" cy="6.4" r="1" /><circle cx="16.4" cy="13.6" r="1" />
      </svg>
    ),
  },
};

/** Wann — in der Sprache, in der Menschen darüber reden. */
function wann(iso: string): string {
  const d = new Date(iso);
  // Lieber gar nichts als „Invalid Date": Ein kaputter Zeitstempel darf nicht
  // aussehen wie ein Programmfehler im Gesicht des Nutzers.
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  if (min < 1440) return `vor ${Math.round(min / 60)} Std`;
  const t = Math.round(min / 1440);
  if (t === 1) return "gestern";
  if (t < 7) return `vor ${t} Tagen`;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit", month: "long", timeZone: "Europe/Berlin",
  });
}

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const kuerzel = name.split(/\s+/).slice(0, 2).map((t) => t[0]).join("").toUpperCase() || "?";
  if (src) {
    return <img src={src} alt="" width={size} height={size} className="fi-sp-avatar" />;
  }
  return (
    <span className="fi-sp-avatar fi-sp-avatar-text" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {kuerzel}
    </span>
  );
}

/** Systembeiträge bekommen eine Marke statt eines Gesichts. */
function AutoMarke({ art }: { art: string }) {
  return (
    <span className="fi-sp-automarke" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {art === "neuzugang" ? (
          <><circle cx="10" cy="7" r="3.2" /><path d="M4 16.5c0-3 2.7-5 6-5s6 2 6 5" /></>
        ) : art === "verkuendung" ? (
          <><path d="M4 8.5v3a1 1 0 0 0 1 1h2l5 3.5v-12L7 8.5H5a1 1 0 0 0-1 1Z" /><path d="M15 7.5a4 4 0 0 1 0 5" /></>
        ) : (
          <><path d="M3 16c2.4-1.2 4.1-3.1 5.2-5.6C9.3 7.8 11.1 5.9 13.6 5" /><path d="M15.4 3.2v3.1M17 4.7h-3.1" /></>
        )}
      </svg>
    </span>
  );
}

export default function AgentSpace() {
  const [daten, setDaten] = useState<any>(null);
  const [text, setText] = useState("");
  const [gross, setGross] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kommentarZu, setKommentarZu] = useState<number | null>(null);
  const [kommentarText, setKommentarText] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/agent/space", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setDaten(j);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const senden = async () => {
    setBusy(true); setFehler(null);
    const r = await fetch("/api/fiaon/agent/space", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Konnte nicht gesendet werden."); return; }
    setText(""); setGross(false);
    void laden();
  };

  const reagieren = async (postId: number, art: string) => {
    // Sofort umschalten, dann senden: Eine Reaktion, die eine halbe Sekunde
    // überlegt, fühlt sich kaputt an.
    setDaten((d: any) => d && {
      ...d,
      posts: d.posts.map((p: Post) => {
        if (p.id !== postId) return p;
        const war = p.meine;
        const z = { ...p.reaktionen };
        if (war) z[war] = Math.max(0, (z[war] || 1) - 1);
        if (war !== art) z[art] = (z[art] || 0) + 1;
        return { ...p, reaktionen: z, meine: war === art ? null : art };
      }),
    });
    await fetch(`/api/fiaon/agent/space/${postId}/reaktion`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art }),
    }).catch(() => {});
  };

  const kommentieren = async (postId: number) => {
    if (kommentarText.trim().length < 2) return;
    const r = await fetch(`/api/fiaon/agent/space/${postId}/kommentar`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: kommentarText }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { setFehler(j?.error || "Kommentar abgelehnt."); return; }
    setKommentarText("");
    void laden();
  };

  const posts: Post[] = daten?.posts ?? [];
  const ich = daten?.ich;

  return (
    <AgentShell>
      <style>{SPACE_CSS}</style>
      <div className="fi-sp-buehne">

        {/* ── LINKS: wer bin ich ──────────────────────────────────────────── */}
        <aside className="fi-sp-seite fi-sp-links">
          <div className="fi-sp-karte fi-sp-profil">
            <Avatar src={null} name={ich?.vorname ?? "?"} size={52} />
            <p className="fi-sp-profil-name">{ich?.vorname ?? ""}</p>
            <p className="fi-sp-profil-rolle">{daten?.darfVerwalten ? "Vertriebsleitung" : "Team"}</p>
            <div className="fi-sp-profil-zahlen">
              <div>
                <b>{posts.length}</b>
                <span>Beiträge sichtbar</span>
              </div>
              <div>
                <b>{posts.filter((p) => p.meine).length}</b>
                <span>davon reagiert</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MITTE: der Feed ─────────────────────────────────────────────── */}
        <main className="fi-sp-feed">
          {/* Komposer — als einladende Karte, nicht als Formular. */}
          <div className={`fi-sp-karte fi-sp-komposer ${gross ? "fi-sp-komposer-gross" : ""}`}>
            <div className="fi-sp-komposer-kopf">
              <Avatar src={null} name={ich?.vorname ?? "?"} size={38} />
              <textarea
                ref={feld}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setGross(true)}
                placeholder="Was lief gut?"
                rows={gross ? 4 : 1}
                className="fi-sp-komposer-feld"
                aria-label="Beitrag schreiben"
              />
            </div>
            {gross && (
              <div className="fi-sp-komposer-fuss">
                <p className="fi-sp-hinweis">{daten?.hinweis}</p>
                <div className="fi-sp-komposer-knoepfe">
                  <button type="button" onClick={() => { setGross(false); setText(""); setFehler(null); }}
                          className="fi-sp-abbrechen">Abbrechen</button>
                  <button type="button" onClick={() => void senden()}
                          disabled={busy || text.trim().length < 3}
                          className="fi-sp-senden">
                    {busy ? "…" : "Teilen"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {fehler && <p className="fi-sp-fehler">{fehler}</p>}

          {!daten && <p className="fi-sp-leer">Wird geladen …</p>}
          {daten && posts.length === 0 && (
            <div className="fi-sp-karte fi-sp-leer-karte">
              <p className="fi-sp-leer-titel">Hier ist noch nichts</p>
              <p className="fi-sp-leer-text">
                Schreib den ersten Beitrag. Ein Space, in dem niemand etwas sagt,
                bleibt leer — auch wenn er noch so schön aussieht.
              </p>
            </div>
          )}

          {posts.map((p, i) => (
            <article key={p.id} className="fi-sp-karte fi-sp-post"
                     style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
              {p.angepinnt && (
                <p className="fi-sp-pin">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.5 2.5 17.5 7.5M11 4 4.5 8.5 3 17l8.5-1.5L16 9" />
                  </svg>
                  Angepinnt
                </p>
              )}

              <header className="fi-sp-post-kopf">
                {p.autorTyp === "system" || p.autoArt
                  ? <AutoMarke art={String(p.autoArt || "")} />
                  : <Avatar src={p.autorAvatar} name={p.autorName ?? "FIAON"} />}
                <div className="min-w-0 flex-1">
                  <p className="fi-sp-autor">
                    {p.autorName ?? (p.autorTyp === "leitung" ? "Vertriebsleitung" : "FIAON")}
                  </p>
                  <p className="fi-sp-zeit">{wann(p.am)}</p>
                </div>
              </header>

              <p className="fi-sp-text">{p.text}</p>

              {/* ── Reaktionen ─────────────────────────────────────────── */}
              <div className="fi-sp-reaktionen">
                {(daten?.reaktionen ?? []).map((art: string) => {
                  const m = REAKTIONS_MARKE[art];
                  const n = p.reaktionen[art] ?? 0;
                  const meine = p.meine === art;
                  return (
                    <button key={art} type="button" onClick={() => void reagieren(p.id, art)}
                            className="fi-sp-reaktion" data-an={meine ? "1" : "0"}
                            title={m?.titel} aria-label={m?.titel}>
                      {m?.zeichen}
                      {n > 0 && <span key={n} className="fi-sp-zaehler">{n}</span>}
                    </button>
                  );
                })}
                <button type="button"
                        onClick={() => setKommentarZu(kommentarZu === p.id ? null : p.id)}
                        className="fi-sp-kommentarknopf">
                  {p.kommentare.length > 0
                    ? `${p.kommentare.length} ${p.kommentare.length === 1 ? "Kommentar" : "Kommentare"}`
                    : "Kommentieren"}
                </button>
              </div>

              {/* ── Kommentare ─────────────────────────────────────────── */}
              {kommentarZu === p.id && (
                <div className="fi-sp-kommentare">
                  {p.kommentare.map((k) => (
                    <div key={k.id} className="fi-sp-kommentar">
                      <Avatar src={k.avatar} name={k.name ?? "?"} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="fi-sp-kommentar-blase">
                          <b>{k.name ?? "Jemand"}</b> {k.text}
                        </p>
                        <p className="fi-sp-kommentar-zeit">{wann(k.am)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="fi-sp-kommentar-neu">
                    <Avatar src={null} name={ich?.vorname ?? "?"} size={28} />
                    <input value={kommentarText} onChange={(e) => setKommentarText(e.target.value)}
                           onKeyDown={(e) => { if (e.key === "Enter") void kommentieren(p.id); }}
                           placeholder="Antworten …" aria-label="Kommentar"
                           className="fi-sp-kommentar-feld" />
                  </div>
                </div>
              )}
            </article>
          ))}
        </main>

        {/* ── RECHTS: Heute ───────────────────────────────────────────────── */}
        <aside className="fi-sp-seite fi-sp-rechts">
          <div className="fi-sp-karte">
            <p className="fi-sp-seiten-titel">Heute</p>
            <p className="fi-sp-seiten-datum">
              {new Date().toLocaleDateString("de-DE", {
                weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin",
              })}
            </p>
            <p className="fi-sp-seiten-text">
              Was hier steht, kommt aus echten Zahlen des Teams — nie aus Kundendaten.
            </p>
          </div>
          <div className="fi-sp-karte">
            <p className="fi-sp-seiten-titel">Der Raum</p>
            <p className="fi-sp-seiten-text">{daten?.hinweis}</p>
          </div>
        </aside>
      </div>
    </AgentShell>
  );
}

const SPACE_CSS = `
/* ── Bühne: drei Spalten, Feed in der Mitte ────────────────────────────── */
.fi-sp-buehne {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 620px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  max-width: 1180px;
  margin: 0 auto;
}
.fi-sp-seite { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 12px; }
.fi-sp-links { justify-self: end; width: 100%; max-width: 250px; }
.fi-sp-rechts { justify-self: start; width: 100%; max-width: 250px; }
/* Unter 1080 px verschwinden die Seitenspalten — der Feed bleibt mittig. */
@media (max-width: 1079px) {
  .fi-sp-buehne { grid-template-columns: minmax(0, 620px); justify-content: center; }
  .fi-sp-seite { display: none; }
}
@media (max-width: 639px) {
  /* Randlos wie eine native App. */
  .fi-sp-buehne { gap: 0; margin: -20px -16px 0; }
}

/* ── Karten: kein Rahmen, ein weicher Schatten ─────────────────────────── */
.fi-sp-karte {
  background: var(--fi-karte, #fff);
  border-radius: 20px;
  padding: 16px 18px;
  box-shadow:
    0 1px 2px rgba(15,23,42,.04),
    0 10px 28px -20px rgba(11,18,38,.34),
    inset 0 0 0 1px rgba(15,23,42,.045);
}
@media (max-width: 639px) {
  .fi-sp-karte { border-radius: 0; box-shadow: inset 0 -1px 0 rgba(15,23,42,.07); padding: 15px 16px; }
}

/* ── Avatare ───────────────────────────────────────────────────────────── */
.fi-sp-avatar {
  border-radius: 999px; object-fit: cover; flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.08), 0 2px 6px -3px rgba(11,18,38,.4);
}
.fi-sp-avatar-text {
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff;
  background: linear-gradient(158deg, #3b82f6, #1d4ed8);
}
.fi-sp-automarke {
  width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(158deg, rgba(37,99,235,.14), rgba(29,78,216,.06));
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.16);
}

/* ── Komposer ──────────────────────────────────────────────────────────── */
.fi-sp-komposer { margin-bottom: 14px; transition: box-shadow 260ms cubic-bezier(.32,.72,0,1); }
.fi-sp-komposer-gross {
  box-shadow:
    0 1px 2px rgba(15,23,42,.04),
    0 24px 54px -26px rgba(11,18,38,.42),
    inset 0 0 0 1px rgba(37,99,235,.2);
}
.fi-sp-komposer-kopf { display: flex; align-items: flex-start; gap: 11px; }
.fi-sp-komposer-feld {
  flex: 1 1 auto; border: 0; outline: none; resize: none; background: none;
  font-size: 15px; line-height: 1.55; color: var(--fi-text, #0f172a);
  padding: 8px 0; min-height: 38px;
  font-family: inherit;
}
.fi-sp-komposer-feld::placeholder { color: #94a3b8; }
.fi-sp-komposer-fuss {
  margin-top: 12px; padding-top: 12px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.06);
  animation: fiSpAuf 260ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-komposer-knoepfe { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.fi-sp-hinweis { font-size: 11.5px; color: #94a3b8; line-height: 1.5; margin: 0; }
.fi-sp-abbrechen {
  background: none; border: 0; cursor: pointer; padding: 8px 4px;
  font-size: 13px; font-weight: 600; color: #94a3b8;
}
.fi-sp-senden {
  margin-left: auto; padding: 9px 20px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 13.5px; font-weight: 700; color: #fff;
  background: linear-gradient(160deg, #2563eb, #1d4ed8);
  box-shadow: 0 10px 22px -10px rgba(29,78,216,.65), inset 0 1px 0 rgba(255,255,255,.22);
  transition: transform 120ms, filter 160ms;
}
.fi-sp-senden:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
.fi-sp-senden:active:not(:disabled) { transform: translateY(1px); }
.fi-sp-senden:disabled { opacity: .35; cursor: default; box-shadow: none; }

/* ── Beitrag ───────────────────────────────────────────────────────────── */
.fi-sp-post {
  margin-bottom: 12px;
  animation: fiSpPostAuf 480ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpPostAuf {
  from { opacity: 0; transform: translateY(14px) scale(.985); }
  to   { opacity: 1; transform: none; }
}
@keyframes fiSpAuf { from { opacity: 0 } to { opacity: 1 } }

.fi-sp-pin {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: #1d4ed8; margin: 0 0 9px;
}
.fi-sp-post-kopf { display: flex; align-items: center; gap: 11px; margin-bottom: 11px; }
.fi-sp-autor { font-size: 14px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 0; line-height: 1.3; }
.fi-sp-zeit { font-size: 11.5px; color: #94a3b8; margin: 1px 0 0; }
.fi-sp-text {
  font-size: 14.5px; line-height: 1.62; color: var(--fi-text, #1e293b);
  margin: 0; white-space: pre-wrap; overflow-wrap: anywhere;
}

/* ── Reaktionen mit Mikro-Animation ────────────────────────────────────── */
.fi-sp-reaktionen {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin-top: 13px; padding-top: 12px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.055);
}
.fi-sp-reaktion {
  display: inline-flex; align-items: center; gap: 5px;
  height: 34px; padding: 0 11px; border: 0; cursor: pointer; border-radius: 999px;
  color: #94a3b8; background: transparent;
  transition: background 160ms, color 160ms, transform 130ms cubic-bezier(.32,.72,0,1);
}
.fi-sp-reaktion:hover { background: rgba(15,23,42,.05); color: #475569; transform: translateY(-1px); }
.fi-sp-reaktion:active { transform: scale(.92); }
.fi-sp-reaktion[data-an="1"] {
  background: rgba(37,99,235,.1); color: #1d4ed8;
}
/* Der Zaehler SPRINGT, wenn er sich aendert: Das key-Attribut am span startet
   die Animation bei jeder neuen Zahl neu. Eine Zahl, die sich lautlos
   aendert, bemerkt niemand. */
.fi-sp-zaehler {
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  animation: fiSpSprung 380ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpSprung {
  0%   { transform: translateY(5px) scale(.6); opacity: 0 }
  55%  { transform: translateY(-2px) scale(1.18); opacity: 1 }
  100% { transform: none; opacity: 1 }
}
.fi-sp-kommentarknopf {
  margin-left: auto; background: none; border: 0; cursor: pointer;
  padding: 0 6px; height: 34px; font-size: 12.5px; font-weight: 600; color: #94a3b8;
  transition: color 160ms;
}
.fi-sp-kommentarknopf:hover { color: #1d4ed8; }

/* ── Kommentare ────────────────────────────────────────────────────────── */
.fi-sp-kommentare {
  margin-top: 11px; padding-top: 11px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.055);
  animation: fiSpAuf 220ms ease both;
}
.fi-sp-kommentar { display: flex; gap: 9px; margin-bottom: 9px; }
.fi-sp-kommentar-blase {
  margin: 0; padding: 8px 12px; border-radius: 4px 15px 15px 15px;
  background: rgba(15,23,42,.04);
  font-size: 13px; line-height: 1.5; color: #1e293b; overflow-wrap: anywhere;
}
.fi-sp-kommentar-blase b { font-weight: 700; margin-right: 4px; }
.fi-sp-kommentar-zeit { font-size: 10.5px; color: #94a3b8; margin: 3px 0 0 12px; }
.fi-sp-kommentar-neu { display: flex; gap: 9px; align-items: center; }
.fi-sp-kommentar-feld {
  flex: 1 1 auto; height: 36px; padding: 0 14px; border: 0; outline: none;
  border-radius: 999px; background: rgba(15,23,42,.04);
  font-size: 13px; color: #1e293b; font-family: inherit;
}

/* ── Seitenspalten ─────────────────────────────────────────────────────── */
.fi-sp-profil { text-align: center; }
.fi-sp-profil .fi-sp-avatar { margin: 0 auto 9px; }
.fi-sp-profil-name { font-size: 15px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 0; }
.fi-sp-profil-rolle { font-size: 11.5px; color: #94a3b8; margin: 1px 0 0; }
.fi-sp-profil-zahlen {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  margin-top: 13px; padding-top: 13px; box-shadow: inset 0 1px 0 rgba(15,23,42,.06);
}
.fi-sp-profil-zahlen b {
  display: block; font-size: 17px; font-weight: 700; color: var(--fi-text, #0f172a);
  font-variant-numeric: tabular-nums; line-height: 1.2;
}
.fi-sp-profil-zahlen span { display: block; font-size: 10px; color: #94a3b8; line-height: 1.3; }
.fi-sp-seiten-titel {
  font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: #94a3b8; margin: 0 0 5px;
}
.fi-sp-seiten-datum { font-size: 14px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 0 0 6px; }
.fi-sp-seiten-text { font-size: 12px; color: #64748b; line-height: 1.55; margin: 0; }

.fi-sp-fehler {
  padding: 11px 14px; border-radius: 14px; margin-bottom: 12px;
  background: rgba(217,119,6,.08); color: #b45309;
  font-size: 12.5px; font-weight: 600; line-height: 1.5;
}
.fi-sp-leer { text-align: center; padding: 40px 0; font-size: 13px; color: #94a3b8; }
.fi-sp-leer-karte { text-align: center; padding: 34px 22px; }
.fi-sp-leer-titel { font-size: 15px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 0; }
.fi-sp-leer-text { font-size: 13px; color: #64748b; line-height: 1.6; margin: 6px 0 0; }

@media (prefers-reduced-motion: reduce) {
  .fi-sp-post, .fi-sp-zaehler, .fi-sp-komposer-fuss, .fi-sp-kommentare { animation: none !important; }
  .fi-sp-reaktion, .fi-sp-senden, .fi-sp-komposer { transition: none !important; }
}
`;
