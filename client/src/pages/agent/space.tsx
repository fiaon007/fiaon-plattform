import { useCallback, useEffect, useState } from "react";
import { AgentShell, Avatar, api } from "./shared";
import { Reveal } from "./motion";
import { Skelett, useToast } from "@/lib/fiaon-ui";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/space — der gemeinsame Raum
//
// Wir arbeiten verteilt. Es gibt kein Treppenhaus, in dem jemand erzählt, dass
// der Anruf um elf gut lief. Der Space ist der Ersatz dafür — und damit die
// einzige Seite dieser Plattform, die nichts abarbeitet.
//
// GESTALTUNG: Startup-Vibe ohne Verspieltheit. Das heißt konkret: großzügiger
// Weißraum und ein weiches Eintreten der Karten — aber keine bunten Flächen,
// keine Emojis, keine Icon-Bibliothek. Die vier Reaktionsmarken sind selbst
// gezeichnet, 1,5 px, currentColor, wie alle Zeichen im Haus.
// ═══════════════════════════════════════════════════════════════════════════

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
  kommentare: { id: number; agentId: number; name: string; avatar: string | null; text: string; am: string }[];
}

// ── Die vier Marken ────────────────────────────────────────────────────────
// Bewusst vier und nicht zwölf: Eine große Auswahl macht aus einer Zustimmung
// eine Entscheidung. 20×20-Raster, 1,5 px, currentColor — dieselben Regeln wie
// in client/src/lib/fiaon-zeichen.tsx.
function Marke({ art, size = 17 }: { art: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 20 20", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true, focusable: "false" as const,
  };
  if (art === "daumen") {
    return (
      <svg {...p}>
        <path d="M6 17V9l3.5-5.5c.8-1.1 2.5-.5 2.5.9V8h3.4c1 0 1.8.9 1.6 1.9l-1 5c-.2.9-1 1.6-2 1.6H6Z" />
        <path d="M6 9H3.6c-.6 0-1.1.5-1.1 1.1v5.8c0 .6.5 1.1 1.1 1.1H6" />
      </svg>
    );
  }
  if (art === "herz") {
    return (
      <svg {...p}>
        <path d="M10 16.5S3 12.4 3 7.9A3.9 3.9 0 0 1 10 5.6a3.9 3.9 0 0 1 7 2.3c0 4.5-7 8.6-7 8.6Z" />
      </svg>
    );
  }
  if (art === "stern") {
    return (
      <svg {...p}>
        <path d="m10 2.8 2.3 4.6 5.1.7-3.7 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.6 8.1l5.1-.7L10 2.8Z" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <path d="M11.4 2.5 4.2 11.3h4.5l-.9 6.2 7.2-8.8h-4.5l.9-6.2Z" />
    </svg>
  );
}

const MARKEN_TEXT: Record<string, string> = {
  daumen: "Stark", herz: "Gern gelesen", stern: "Merkenswert", blitz: "Schnell umgesetzt",
};

/** „vor 2 Std“ — Uhrzeiten sind hier weniger nützlich als Abstände. */
function vorWann(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std`;
  const tage = Math.round(std / 24);
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

export default function AgentSpaceSeite() {
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  const { zeige } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [hinweis, setHinweis] = useState("");
  const [darfVerwalten, setDarfVerwalten] = useState(false);
  const [ich, setIch] = useState<{ id: number; vorname: string } | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [sendet, setSendet] = useState(false);

  const laden = useCallback(async () => {
    const r = await api("/agent/space");
    if (r.ok) {
      setPosts(r.json.posts || []);
      setHinweis(r.json.hinweis || "");
      setDarfVerwalten(!!r.json.darfVerwalten);
      setIch(r.json.ich || null);
    }
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const schreiben = async () => {
    const text = entwurf.trim();
    if (text.length < 2) return;
    setSendet(true);
    const r = await api("/agent/space", { method: "POST", body: JSON.stringify({ text }) });
    setSendet(false);
    if (!r.ok) {
      // Die Kundendaten-Sperre meldet sich hier. Der Grund steht im Klartext
      // da — eine Ablehnung ohne Begründung erzeugt nur Ratlosigkeit.
      zeige("fehler", "Nicht veröffentlicht", r.json?.error || "Bitte erneut versuchen.");
      return;
    }
    setEntwurf("");
    void laden();
  };

  const reagieren = async (post: Post, art: string) => {
    const neu = post.meine === art ? null : art;
    // Sofort umschalten, dann bestätigen lassen: Eine Reaktion, die eine halbe
    // Sekunde überlegt, fühlt sich kaputt an.
    setPosts((l) => l.map((p) => {
      if (p.id !== post.id) return p;
      const z = { ...p.reaktionen };
      if (p.meine) z[p.meine] = Math.max(0, (z[p.meine] || 1) - 1);
      if (neu) z[neu] = (z[neu] || 0) + 1;
      return { ...p, meine: neu, reaktionen: z };
    }));
    await api(`/agent/space/${post.id}/reaktion`, { method: "POST", body: JSON.stringify({ art: neu }) });
  };

  return (
    <div className="pb-24 md:pb-10">
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Reveal index={0}>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight leading-tight">
            <span className="fi-gradient-text">Space</span>
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fi-text-leise)" }}>
            {ich ? `Guten Tag, ${ich.vorname}. ` : ""}Unser gemeinsamer Raum — für alle im Team.
          </p>
        </Reveal>

        {/* ── Schreiben ─────────────────────────────────────────────────── */}
        <Reveal index={1}>
          <div className="fi-karte mt-5 p-4">
            <textarea
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              rows={3}
              placeholder="Was lief gut? Was hilft den anderen?"
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
              style={{ color: "var(--fi-text)" }}
            />
            <div className="mt-2 pt-2.5 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--fi-linie)" }}>
              {/* Der stille Hinweis. Er steht IMMER da, nicht erst nach einer
                  Ablehnung — die Wand im Server fängt Nummern und IBANs, aber
                  keine Namen. Den Rest macht die Gewohnheit. */}
              <p className="text-[11.5px] leading-snug flex-1 min-w-[200px]" style={{ color: "var(--fi-text-still)" }}>
                {hinweis}
              </p>
              <button type="button" onClick={() => void schreiben()}
                      disabled={sendet || entwurf.trim().length < 2}
                      className="fi-primaerknopf px-4 py-2 text-[13px] font-semibold disabled:opacity-40">
                {sendet ? "…" : "Veröffentlichen"}
              </button>
            </div>
          </div>
        </Reveal>

        {/* ── Feed ──────────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          {laedt && [0, 1, 2].map((i) => (
            <div key={i} className="fi-karte p-4">
              <Skelett h={16} w="40%" />
              <div className="mt-3"><Skelett h={13} w="90%" /></div>
              <div className="mt-1.5"><Skelett h={13} w="70%" /></div>
            </div>
          ))}

          {!laedt && posts.length === 0 && (
            <div className="fi-karte p-6 text-center">
              <p className="text-[14px] font-semibold">Hier ist noch nichts.</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--fi-text-still)" }}>
                Schreib den ersten Beitrag — ein Satz genügt.
              </p>
            </div>
          )}

          {!laedt && posts.map((p, i) => (
            <PostKarte key={p.id} post={p} index={i} ich={ich} darfVerwalten={darfVerwalten}
                       onReaktion={(art) => void reagieren(p, art)} onAenderung={laden} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PostKarte({
  post, index, ich, darfVerwalten, onReaktion, onAenderung,
}: {
  post: Post; index: number; ich: { id: number; vorname: string } | null;
  darfVerwalten: boolean; onReaktion: (art: string) => void; onAenderung: () => void;
}) {
  const { zeige } = useToast();
  const [kommentarOffen, setKommentarOffen] = useState(false);
  const [kommentar, setKommentar] = useState("");
  const [busy, setBusy] = useState(false);

  const system = post.autorTyp === "system";
  const eigen = ich && post.autorAgentId === ich.id;

  const kommentieren = async () => {
    const text = kommentar.trim();
    if (text.length < 2) return;
    setBusy(true);
    const r = await api(`/agent/space/${post.id}/kommentar`, { method: "POST", body: JSON.stringify({ text }) });
    setBusy(false);
    if (!r.ok) { zeige("fehler", "Nicht gespeichert", r.json?.error || "Bitte erneut versuchen."); return; }
    setKommentar(""); setKommentarOffen(false); onAenderung();
  };

  const anpinnen = async () => {
    await api(`/agent/space/${post.id}/anpinnen`, { method: "POST", body: JSON.stringify({ an: !post.angepinnt }) });
    onAenderung();
  };

  const loeschen = async () => {
    if (!confirm("Diesen Beitrag entfernen? Er verschwindet aus dem Feed, bleibt aber gespeichert.")) return;
    const r = await api(`/agent/space/${post.id}`, { method: "DELETE" });
    if (!r.ok) { zeige("fehler", "Nicht entfernt", r.json?.error || "Bitte erneut versuchen."); return; }
    onAenderung();
  };

  // Die erste Zeile eines Systemposts ist seine Überschrift („Gedanke des
  // Tages"). Sie wird eigenständig gesetzt, damit der Feed nicht aus lauter
  // gleich aussehenden Textblöcken besteht.
  const zeilen = post.text.split("\n");
  const titel = system ? zeilen[0] : null;
  const koerper = system ? zeilen.slice(1).join("\n").trim() : post.text;

  return (
    <Reveal index={Math.min(index, 8)}>
      <article className="fi-karte p-4 sm:p-5 relative overflow-hidden">
        {post.angepinnt && (
          <span className="absolute right-0 top-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em]"
                style={{ background: "rgba(29,78,216,.07)", color: "var(--fi-primaer)", borderBottomLeftRadius: 10 }}>
            Angepinnt
          </span>
        )}

        <div className="flex items-start gap-3">
          {system ? (
            <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black tracking-tight"
                  style={{ background: "var(--fi-primaer)", color: "#fff" }} aria-hidden="true">
              FI
            </span>
          ) : (
            <Avatar src={post.autorAvatar} name={post.autorName} size={36} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold leading-tight">
              {post.autorName || "Teammitglied"}
              {post.autorTyp === "leitung" && (
                <span className="ml-2 text-[10.5px] font-bold uppercase tracking-[.08em]"
                      style={{ color: "var(--fi-text-still)" }}>Leitung</span>
              )}
            </p>
            <p className="text-[11.5px]" style={{ color: "var(--fi-text-still)" }}>{vorWann(post.am)}</p>
          </div>
          {(darfVerwalten || eigen) && (
            <span className="shrink-0 flex items-center gap-2">
              {darfVerwalten && (
                <button type="button" onClick={() => void anpinnen()}
                        className="text-[11.5px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                  {post.angepinnt ? "Lösen" : "Anpinnen"}
                </button>
              )}
              <button type="button" onClick={() => void loeschen()}
                      className="text-[11.5px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                Entfernen
              </button>
            </span>
          )}
        </div>

        {titel && (
          <p className="mt-3.5 text-[15px] font-bold tracking-tight leading-snug">{titel}</p>
        )}
        <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--fi-text)" }}>
          {koerper}
        </p>

        {/* ── Marken ──────────────────────────────────────────────────── */}
        <div className="mt-3.5 pt-3 flex flex-wrap items-center gap-1.5" style={{ borderTop: "1px solid var(--fi-linie)" }}>
          {["daumen", "herz", "stern", "blitz"].map((art) => {
            const n = post.reaktionen[art] || 0;
            const an = post.meine === art;
            return (
              <button key={art} type="button" onClick={() => onReaktion(art)}
                      title={MARKEN_TEXT[art]} aria-pressed={an} aria-label={MARKEN_TEXT[art]}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-colors"
                      style={an
                        ? { background: "rgba(29,78,216,.09)", color: "var(--fi-primaer)" }
                        : { color: "var(--fi-text-still)" }}>
                <Marke art={art} />
                {n > 0 && <span className="fi-zahl">{n}</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => setKommentarOffen((o) => !o)}
                  className="ml-auto text-[12px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
            {post.kommentare.length > 0 ? `${post.kommentare.length} Antworten` : "Antworten"}
          </button>
        </div>

        {post.kommentare.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {post.kommentare.map((k) => (
              <div key={k.id} className="flex items-start gap-2.5">
                <Avatar src={k.avatar} name={k.name} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug">
                    <span className="font-semibold">{k.name}</span>
                    <span className="ml-2 text-[11px]" style={{ color: "var(--fi-text-still)" }}>{vorWann(k.am)}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{k.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {kommentarOffen && (
          <div className="mt-3 flex items-start gap-2">
            <textarea value={kommentar} onChange={(e) => setKommentar(e.target.value)} rows={2}
                      placeholder="Antworten …"
                      className="flex-1 resize-none rounded-xl px-3 py-2 text-[13px] outline-none"
                      style={{ border: "1px solid var(--fi-linie)", background: "var(--fi-seite)" }} />
            <button type="button" onClick={() => void kommentieren()} disabled={busy || kommentar.trim().length < 2}
                    className="fi-primaerknopf px-3 py-2 text-[12.5px] font-semibold disabled:opacity-40">
              {busy ? "…" : "Senden"}
            </button>
          </div>
        )}
      </article>
    </Reveal>
  );
}
