// ═══════════════════════════════════════════════════════════════════════════
// /agent/space (NEU) — Team-Space, komplett neu gebaut (23.08.2026, Plan §4/§11)
//
// Der Raum, in dem das Team miteinander redet — jetzt als lebendiger Feed
// auf der dunklen Bühne: mittige Spalte (max. 640 px), schwebende Glas-
// Karten mit Tiefe, 3D-Tilt am Zeiger, Reaktionen mit Federsprung,
// Kommentar-Threads mit Verbindungslinie, Composer wie bei X, Team-Präsenz
// aus dem Flur als überlappende Avatare im Sticky-Kopf.
//
// Alle Funktionen der alten Seite (space.tsx) sind 1:1 übernommen — gleiche
// Endpunkte, gleiche Aktionen. Die alte Seite bleibt als /agent/space-alt
// erreichbar; /admin/space nutzt weiterhin die alte Komponente.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowUp, ChevronDown, FileText, ImagePlus, MessageCircle, PenLine, Pin,
  Sparkles, ThumbsDown, ThumbsUp, X,
} from "lucide-react";
import { AgentShell, Avatar, api } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-space.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

// ── Datenformen (wie in space.tsx) ──────────────────────────────────────────
interface Kommentar {
  id: number; agentId: number | null; text: string; am: string;
  name: string | null; avatar: string | null;
  antwortAuf: number | null;
  bearbeitet: boolean;
  meiner: boolean;
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
  akteRef: string | null;
  aktePerson: number | null;
  hatBild: boolean;
  bearbeitet: boolean;
  meiner: boolean;
  bearbeitbarBis: string | null;
  reaktionen: Record<string, number>;
  meine: string | null;
  kommentare: Kommentar[];
}

// Der Server liefert die erlaubten Arten (`daten.reaktionen`); hier steht nur,
// WIE eine Art aussieht. Unbekannte Arten fallen auf den Daumen zurück.
const REAKTIONS_MARKE: Record<string, { titel: string; Icon: typeof ThumbsUp }> = {
  gut: { titel: "Gefällt mir", Icon: ThumbsUp },
  schlecht: { titel: "Gefällt mir nicht", Icon: ThumbsDown },
};

// Kennmarke je Systembeitrags-Art — sagt in zwei Wörtern, was man da liest.
const ART_MARKE: Record<string, string> = {
  gedanke: "Gedanke des Tages",
  impuls: "Verkaufs-Impuls",
  abschluss: "Abschluss",
  rangliste: "Der Tag in Zahlen",
  woche: "Wochenrückblick",
  meilenstein: "Meilenstein",
  rekord: "Rekord",
  feiertage: "Heute weltweit",
  neuzugang: "Neu im Team",
  verkuendung: "Ansage",
  update: "Neu in der Plattform",
};

/** Erfolgs-Arten bekommen den Konfetti-Schimmer. */
const FEIER_ARTEN = new Set(["abschluss", "meilenstein", "rekord"]);

/** Wann — in der Sprache, in der Menschen darüber reden. */
function wann(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  if (min < 1440) return `vor ${Math.round(min / 60)} Std`;
  const t = Math.round(min / 1440);
  if (t === 1) return "gestern";
  if (t < 7) return `vor ${t} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", timeZone: "Europe/Berlin" });
}

/** Jünger als zwölf Stunden? Dann glüht der Avatar-Ring. */
function istFrisch(iso: string): boolean {
  const d = new Date(iso).getTime();
  return !Number.isNaN(d) && Date.now() - d < 12 * 3600_000;
}

/** Der Systemavatar — FIAON selbst, dieselbe Kachel wie das Favicon. */
function SystemAvatar({ size = 44 }: { size?: number }) {
  return (
    <span className="sp-systemavatar" style={{ width: size, height: size }} aria-label="FIAON">
      <svg viewBox="0 0 64 64" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        <g fill="#fff">
          <rect x="19" y="17" width="6.5" height="30" rx="3.25" />
          <rect x="19" y="17" width="24" height="6.5" rx="3.25" />
          <rect x="19" y="29" width="17" height="6.5" rx="3.25" />
        </g>
        <path d="M40 44 L50 34" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Eine Kommentarzeile — oberste Ebene wie Antwort, dieselbe Form. */
function KommentarZeile({ k, onAntwort, onWeg }: {
  k: Kommentar; onAntwort: () => void; onWeg: () => void;
}) {
  return (
    <div className="sp-kommentar">
      <Avatar src={k.avatar} name={k.name ?? "?"} size={28} />
      <div className="sp-kommentar-rest">
        <p className="sp-kommentar-blase"><b>{k.name ?? "Jemand"}</b> {k.text}</p>
        <p className="sp-kommentar-zeit">
          {wann(k.am)}
          <button type="button" onClick={onAntwort} className="sp-kommentar-tat">Antworten</button>
          {k.meiner && (
            <button type="button" onClick={onWeg} className="sp-kommentar-tat">Löschen</button>
          )}
        </p>
      </div>
      {/* 24.08.2026: Rundgang je Raum (E-063). */}
      <Rundgang raum="space" titel={RUNDGAENGE.space.titel} schritte={RUNDGAENGE.space.schritte} />
    </div>
  );
}

/** 3D-Tilt: höchstens 4 Grad, nur mit feinem Zeiger, nie bei reduced-motion. */
function tiltAn(e: React.MouseEvent<HTMLElement>) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--sp-ry", `${(x * 4).toFixed(2)}deg`);
  el.style.setProperty("--sp-rx", `${(-y * 4).toFixed(2)}deg`);
}
function tiltAus(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--sp-ry", "0deg");
  el.style.setProperty("--sp-rx", "0deg");
}

export default function AgentSpaceNeuPage() {
  return <AgentShell><SpaceInnen /></AgentShell>;
}

function SpaceInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Team"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [daten, setDaten] = useState<any>(null);
  const [text, setText] = useState("");
  const [gross, setGross] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kommentarZu, setKommentarZu] = useState<number | null>(null);
  const [kommentarText, setKommentarText] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);
  const komposer = useRef<HTMLDivElement>(null);
  // Nachladen (unendliches Scrollen)
  const [mehr, setMehr] = useState(true);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const fuehler = useRef<HTMLDivElement>(null);
  const kopf = useRef<HTMLDivElement>(null);
  // Neue Beiträge, während man liest
  const [neue, setNeue] = useState(0);
  const oberste = useRef<number | null>(null);
  // Bild und Akten-Chip am Composer
  const [bild, setBild] = useState<string | null>(null);
  const [akte, setAkte] = useState<{ ref: string; name: string } | null>(null);
  const [akteSuche, setAkteSuche] = useState("");
  const [akteTreffer, setAkteTreffer] = useState<any[]>([]);
  // Eigenen Beitrag ändern und zurücknehmen
  const [bearbeite, setBearbeite] = useState<number | null>(null);
  const [bearbeiteText, setBearbeiteText] = useState("");
  const [loesche, setLoesche] = useState<Post | null>(null);
  // Auf welchen Kommentar wird geantwortet?
  const [antwortAuf, setAntwortAuf] = useState<{ id: number; name: string } | null>(null);
  const [alleKommentare, setAlleKommentare] = useState<Set<number>>(new Set());
  const [pinOffen, setPinOffen] = useState<number | null>(null);
  // Neu: Lightbox und Team-Präsenz
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [leute, setLeute] = useState<any[]>([]);
  const wurzel = useRef<HTMLDivElement>(null);

  // ── Feed laden (markiert serverseitig den Besuch als gesehen —
  //    darauf beruht die Ungelesen-Marke GET /agent/space/ungelesen im Menü) ──
  const laden = useCallback(async () => {
    const r = await api("/agent/space");
    if (r.ok) {
      setDaten(r.json);
      setMehr(!!r.json.mehr);
      oberste.current = r.json.posts?.[0]?.id ?? null;
      setNeue(0);
    }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // ── Team-Präsenz aus dem Flur, alle 60 s ─────────────────────────────────
  useEffect(() => {
    const holen = () => api("/agent/flur").then((r) => { if (r.ok) setLeute(r.json.leute || []); }).catch(() => {});
    holen();
    const uhr = setInterval(holen, 60_000);
    return () => clearInterval(uhr);
  }, []);

  // ── Unendliches Scrollen: Beobachter am Fuß, 400 px Vorlauf ─────────────
  const nachladen = useCallback(async () => {
    if (laedtMehr || !mehr || !daten?.posts?.length) return;
    setLaedtMehr(true);
    const letzter = daten.posts[daten.posts.length - 1].id;
    const r = await api(`/agent/space?vor=${letzter}`);
    setLaedtMehr(false);
    if (!r.ok) { setMehr(false); return; }
    setMehr(!!r.json.mehr && (r.json.posts?.length ?? 0) > 0);
    setDaten((d: any) => d && { ...d, posts: [...d.posts, ...(r.json.posts ?? [])] });
  }, [daten, laedtMehr, mehr]);

  useEffect(() => {
    const ziel = fuehler.current;
    if (!ziel) return;
    const beobachter = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting) void nachladen();
    }, { rootMargin: "400px" });
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [nachladen]);

  // ── „Neue Beiträge": alle zwei Minuten nachsehen, Pille statt Einfügen ──
  useEffect(() => {
    const uhr = setInterval(async () => {
      if (document.hidden || !oberste.current) return;
      const r = await api("/agent/space?limit=5");
      if (!r.ok) return;
      const n = (r.json.posts ?? []).findIndex((p: Post) => p.id === oberste.current);
      setNeue(n > 0 ? n : 0);
    }, 120_000);
    return () => clearInterval(uhr);
  }, []);

  // ── Aufgleiten beim Scrollen: ein Beobachter für alle Karten ────────────
  const sichtbarBeobachter = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    sichtbarBeobachter.current = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (e.isIntersecting) {
          e.target.classList.add("sp-da");
          sichtbarBeobachter.current?.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    return () => sichtbarBeobachter.current?.disconnect();
  }, []);
  const aufgleiten = useCallback((el: HTMLElement | null) => {
    if (el && !el.classList.contains("sp-da")) sichtbarBeobachter.current?.observe(el);
  }, []);

  // ── Parallax: Glutflecken wandern langsamer als der Inhalt ──────────────
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let el: HTMLElement | null = wurzel.current;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY)) break;
      el = el.parentElement;
    }
    const behaelter: HTMLElement | Window = el && el !== document.body ? el : window;
    const setzen = () => {
      const y = behaelter instanceof Window ? window.scrollY : behaelter.scrollTop;
      wurzel.current?.style.setProperty("--sp-par", `${(-y * 0.12).toFixed(1)}px`);
    };
    behaelter.addEventListener("scroll", setzen, { passive: true });
    return () => behaelter.removeEventListener("scroll", setzen);
  }, [daten ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lightbox: Escape schließt ───────────────────────────────────────────
  useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox]);

  // ── Schreiben ───────────────────────────────────────────────────────────
  const senden = async () => {
    setBusy(true); setFehler(null);
    const r = await api("/agent/space", {
      method: "POST",
      body: JSON.stringify({ text, bild, akteRef: akte?.ref ?? null }),
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Konnte nicht gesendet werden."); return; }
    setText(""); setGross(false); setBild(null); setAkte(null); setAkteSuche("");
    void laden();
  };

  // Bild wählen — verkleinert im Browser, bevor irgendetwas hochgeht.
  const bildWaehlen = async (datei: File) => {
    setFehler(null);
    if (!/^image\/(jpeg|png|webp)$/.test(datei.type)) {
      setFehler("Nur JPEG, PNG oder WebP."); return;
    }
    const bitmap = await createImageBitmap(datei).catch(() => null);
    if (!bitmap) { setFehler("Das Bild konnte nicht gelesen werden."); return; }
    const max = 1400;
    const faktor = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const leinwand = document.createElement("canvas");
    leinwand.width = Math.round(bitmap.width * faktor);
    leinwand.height = Math.round(bitmap.height * faktor);
    leinwand.getContext("2d")?.drawImage(bitmap, 0, 0, leinwand.width, leinwand.height);
    setBild(leinwand.toDataURL("image/jpeg", 0.82));
    setGross(true);
  };

  // Akten-Suche, entprellt.
  useEffect(() => {
    if (akteSuche.trim().length < 2) { setAkteTreffer([]); return; }
    const uhr = setTimeout(async () => {
      const r = await api(`/agent/space/akte-suche?q=${encodeURIComponent(akteSuche)}`);
      setAkteTreffer(r.ok ? r.json.treffer : []);
    }, 280);
    return () => clearTimeout(uhr);
  }, [akteSuche]);

  const speichern = async (postId: number) => {
    const r = await api(`/agent/space/${postId}`, {
      method: "PATCH", body: JSON.stringify({ text: bearbeiteText }),
    });
    if (!r.ok) { setFehler(r.json?.error || "Änderung abgelehnt."); return; }
    setBearbeite(null); void laden();
  };

  const entfernen = async (postId: number) => {
    const r = await api(`/agent/space/${postId}`, { method: "DELETE" });
    setLoesche(null);
    if (!r.ok) { setFehler(r.json?.error || "Konnte nicht entfernt werden."); return; }
    void laden();
  };

  const loesen = async (postId: number) => {
    await api(`/agent/space/${postId}/anpinnen`, {
      method: "POST", body: JSON.stringify({ an: false }),
    }).catch(() => {});
    void laden();
  };

  const kommentarWeg = async (id: number) => {
    await api(`/agent/space/kommentar/${id}`, { method: "DELETE" }).catch(() => {});
    void laden();
  };

  const reagieren = async (postId: number, art: string) => {
    // Sofort umschalten, dann senden — eine Reaktion darf nicht überlegen.
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
    await api(`/agent/space/${postId}/reaktion`, {
      method: "POST", body: JSON.stringify({ art }),
    }).catch(() => {});
  };

  const kommentieren = async (postId: number) => {
    if (kommentarText.trim().length < 2) return;
    const r = await api(`/agent/space/${postId}/kommentar`, {
      method: "POST", body: JSON.stringify({ text: kommentarText, antwortAuf: antwortAuf?.id ?? null }),
    });
    if (!r.ok) { setFehler(r.json?.error || "Kommentar abgelehnt."); return; }
    setKommentarText(""); setAntwortAuf(null);
    void laden();
  };

  const zumComposer = () => {
    komposer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setGross(true);
    setTimeout(() => feld.current?.focus(), 350);
  };

  const alle: Post[] = daten?.posts ?? [];
  // Angepinntes gehört in eine Leiste, nicht in den Feed — max. zwei.
  const angepinnte = alle.filter((p) => p.angepinnt).slice(0, 2);
  const posts = alle.filter((p) => !p.angepinnt);
  const ich = daten?.ich;
  const online = leute.filter((l) => l.status === "da" || l.status === "telefon");

  return (
    <div className="sp" ref={wurzel}>
      {/* Glutflecken + Punktfeld — reine CSS-Tiefe, kein WebGL. */}
      <div className="sp-glut" aria-hidden="true" />
      <div className="sp-punkte" aria-hidden="true" />

      <div className="sp-spalte">
        <div ref={kopf} aria-hidden="true" />

        {/* ── Kopf: Pille, Überschrift, Team-Präsenz aus dem Flur ─────────── */}
        <header className="sp-kopf">
          <span className="sp-pille">Team-Feed</span>
          <h1>Was das <span className="sp-verlauf">Team</span> gerade bewegt.</h1>
        </header>

        <div className="sp-praesenz-klebt">
          <Link href="/agent/flur" className="sp-praesenz" aria-label="Zum Flur — wer ist online">
            <span className="sp-praesenz-avatare">
              {online.slice(0, 8).map((l, i) => (
                <span key={l.id} className="sp-praesenz-avatar" style={{ zIndex: 20 - i }}>
                  <Avatar src={l.avatar ?? null} name={l.name} size={32} />
                </span>
              ))}
              {online.length === 0 && <span className="sp-praesenz-leer">Gerade ist niemand online</span>}
            </span>
            {online.length > 0 && (
              <span className="sp-praesenz-text">
                <b>{online.length}</b> {online.length === 1 ? "Kollege online" : "Kollegen online"}
              </span>
            )}
            <span className="sp-praesenz-pfeil" aria-hidden="true">Zum Flur</span>
          </Link>
        </div>

        {/* ── Tagesleiste: die Zahlen des Tages als Blau-Glut-Kacheln ─────── */}
        {(daten?.tageszahlen ?? []).length > 0 && (
          <div className="sp-tagesleiste">
            {daten.tageszahlen.map((z: any) => (
              <div key={z.titel} className="sp-tag-kachel">
                <b>{z.wert}</b>
                <span>{z.titel}</span>
                {z.hinweis && <small>{z.hinweis}</small>}
              </div>
            ))}
          </div>
        )}

        {/* ── Angepinntes: schmale Leiste, aufklappbar ─────────────────────── */}
        {angepinnte.length > 0 && (
          <div className="sp-pinleiste">
            {angepinnte.map((p) => {
              const offen = pinOffen === p.id;
              const kopfzeile = p.text.split("\n")[0].slice(0, 90);
              return (
                <div key={p.id} className="sp-pinzeile" data-offen={offen ? "1" : "0"}>
                  <button type="button" onClick={() => setPinOffen(offen ? null : p.id)} className="sp-pinknopf">
                    <Pin size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span className="sp-pintext">{kopfzeile}</span>
                    <ChevronDown size={14} strokeWidth={1.75} className="sp-pinpfeil" aria-hidden="true" />
                  </button>
                  {offen && (
                    <div className="sp-pininhalt">
                      <p className="sp-text">{p.text}</p>
                      {daten?.darfVerwalten && (
                        <button type="button" onClick={() => void loesen(p.id)} className="sp-pinloesen">
                          Nicht mehr anpinnen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Composer: „Was läuft bei dir?" — wächst beim Tippen ─────────── */}
        <div ref={komposer} className={`sp-karte sp-komposer${gross ? " sp-komposer-gross" : ""}`}>
          <div className="sp-komposer-kopf">
            <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={44} />
            <textarea
              ref={feld}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(320, e.target.scrollHeight)}px`;
              }}
              onFocus={() => setGross(true)}
              placeholder="Was läuft bei dir?"
              rows={gross ? 3 : 1}
              className="sp-komposer-feld"
              aria-label="Beitrag schreiben"
            />
          </div>

          {bild && (
            <div className="sp-bildvorschau">
              <img src={bild} alt="Gewähltes Bild" />
              <button type="button" onClick={() => setBild(null)} aria-label="Bild entfernen">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          {akte && (
            <div className="sp-aktechip sp-aktechip-wahl">
              <span className="sp-aktechip-marke" aria-hidden="true"><FileText size={15} strokeWidth={1.75} /></span>
              <span className="sp-aktechip-rest">
                <b>{akte.ref}</b>
                <span className="sp-aktechip-hinweis">Im Feed erscheint nur die Referenz — kein Name, kein Betrag.</span>
              </span>
              <button type="button" onClick={() => setAkte(null)} aria-label="Akte entfernen" className="sp-aktechip-weg">
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          )}

          {gross && (
            <div className="sp-komposer-fuss">
              {!akte && (
                <div className="sp-aktesuche">
                  <input value={akteSuche} onChange={(e) => setAkteSuche(e.target.value)}
                         placeholder="Akte anhängen (Name oder Referenz suchen) …"
                         aria-label="Akte suchen" className="sp-aktesuche-feld" />
                  {akteTreffer.length > 0 && (
                    <div className="sp-aktesuche-liste">
                      {akteTreffer.map((t: any) => (
                        <button key={t.ref} type="button"
                                onClick={() => { setAkte({ ref: t.ref, name: t.name }); setAkteSuche(""); setAkteTreffer([]); }}
                                className="sp-aktesuche-zeile">
                          <b>{t.name}</b><span>{t.ref}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="sp-hinweis">
                {daten?.hinweis}{" "}
                <b>Wenn es um einen bestimmten Kunden geht, häng die Akte an — das ist der richtige Weg.</b>
              </p>
              <div className="sp-komposer-knoepfe">
                <label className="sp-bildknopf">
                  <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
                  Bild
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sp-versteckt"
                         onChange={(e) => { const f = e.target.files?.[0]; if (f) void bildWaehlen(f); }} />
                </label>
                <button type="button" onClick={() => { setGross(false); setText(""); setFehler(null); }}
                        className="sp-abbrechen">Abbrechen</button>
                <button type="button" onClick={() => void senden()}
                        disabled={busy || text.trim().length < 3}
                        className="sp-senden">
                  {busy ? "…" : "Teilen"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── „Neue Beiträge"-Pille — antippen statt automatisch einfügen ── */}
        {neue > 0 && (
          <button type="button"
                  onClick={() => {
                    kopf.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    void laden();
                  }}
                  className="sp-neu-pille">
            <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
            {neue} {neue === 1 ? "neuer Beitrag" : "neue Beiträge"}
          </button>
        )}

        {fehler && <p className="sp-fehler">{fehler}</p>}

        {/* ── Skeleton beim ersten Laden ──────────────────────────────────── */}
        {!daten && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="sp-karte sp-skelett" aria-hidden="true">
                <div className="sp-skelett-kopf">
                  <span className="sp-skelett-kreis" />
                  <span className="sp-skelett-zeilen">
                    <span className="sp-skelett-balken" style={{ width: "34%" }} />
                    <span className="sp-skelett-balken" style={{ width: "18%" }} />
                  </span>
                </div>
                <span className="sp-skelett-balken" style={{ width: "92%" }} />
                <span className="sp-skelett-balken" style={{ width: "74%" }} />
              </div>
            ))}
          </>
        )}

        {daten && posts.length === 0 && (
          <div className="sp-karte sp-leer-karte">
            <Sparkles size={22} strokeWidth={1.75} aria-hidden="true" />
            <p className="sp-leer-titel">Hier ist noch nichts</p>
            <p className="sp-leer-text">
              Schreib den ersten Beitrag — ein Erfolg, eine Frage, ein Gedanke.
              Das Team liest mit.
            </p>
          </div>
        )}

        {/* ── Der Feed ─────────────────────────────────────────────────────── */}
        {posts.map((p) => {
          const system = p.autorTyp === "system" || !!p.autoArt;
          const feier = !!p.autoArt && FEIER_ARTEN.has(p.autoArt);
          return (
            <article key={p.id} ref={aufgleiten}
                     onMouseMove={tiltAn} onMouseLeave={tiltAus}
                     className={`sp-karte sp-post${system ? " sp-post-system" : ""}${feier ? " sp-post-feier" : ""}`}>
              {feier && <span className="sp-konfetti" aria-hidden="true" />}

              <header className="sp-post-kopf">
                {system
                  ? <SystemAvatar />
                  : (
                    <span className={`sp-avatar-ring${istFrisch(p.am) ? " sp-avatar-frisch" : ""}`}>
                      <Avatar src={p.autorAvatar} name={p.autorName ?? "FIAON"} size={44} />
                    </span>
                  )}
                <div className="sp-post-wer">
                  <p className="sp-autor">
                    {p.autorName ?? (p.autorTyp === "leitung" ? "Vertriebsleitung" : "FIAON")}
                    {p.autorTyp === "leitung" && p.autorName && <span className="sp-rolle-chip">Leitung</span>}
                    {system && <span className="sp-rolle-chip sp-rolle-system">FIAON</span>}
                  </p>
                  <p className="sp-zeit">
                    {wann(p.am)}
                    {p.bearbeitet && <span className="sp-bearbeitet"> · bearbeitet</span>}
                  </p>
                </div>

                {p.autoArt && ART_MARKE[p.autoArt] && (
                  <span className="sp-artmarke">{ART_MARKE[p.autoArt]}</span>
                )}

                {(p.meiner || daten?.darfVerwalten) && (
                  <div className="sp-postmenue">
                    {p.meiner && p.bearbeitbarBis && new Date(p.bearbeitbarBis) > new Date() && (
                      <button type="button" onClick={() => { setBearbeite(p.id); setBearbeiteText(p.text); }}
                              className="sp-postmenue-knopf">Ändern</button>
                    )}
                    <button type="button" onClick={() => setLoesche(loesche?.id === p.id ? null : p)}
                            className="sp-postmenue-knopf sp-postmenue-weg">
                      {p.meiner ? "Zurücknehmen" : "Entfernen"}
                    </button>
                  </div>
                )}
              </header>

              {bearbeite === p.id ? (
                <div className="sp-bearbeiten">
                  <textarea value={bearbeiteText} onChange={(e) => setBearbeiteText(e.target.value)}
                            rows={4} aria-label="Beitrag ändern" className="sp-bearbeiten-feld" />
                  <div className="sp-bearbeiten-knoepfe">
                    <button type="button" onClick={() => setBearbeite(null)} className="sp-abbrechen">Abbrechen</button>
                    <button type="button" onClick={() => void speichern(p.id)}
                            disabled={bearbeiteText.trim().length < 3}
                            className="sp-senden">Speichern</button>
                  </div>
                </div>
              ) : (
                <p className="sp-text">{p.text}</p>
              )}

              {p.hatBild && (
                <button type="button" className="sp-bildknopf-auf"
                        onClick={() => setLightbox(`/api/fiaon/agent/space/bild/${p.id}`)}
                        aria-label="Bild groß ansehen">
                  <img src={`/api/fiaon/agent/space/bild/${p.id}`} alt="" loading="lazy" className="sp-bild" />
                </button>
              )}

              {p.akteRef && (
                <a href={`/agent/kunden?ref=${encodeURIComponent(p.akteRef)}`} className="sp-aktechip">
                  <span className="sp-aktechip-marke" aria-hidden="true"><FileText size={15} strokeWidth={1.75} /></span>
                  <span className="sp-aktechip-rest">
                    <b>{p.akteRef}</b>
                    <span className="sp-aktechip-hinweis">Akte öffnen — wenn du berechtigt bist</span>
                  </span>
                </a>
              )}

              {loesche?.id === p.id && (
                <div className="sp-bestaetigung">
                  <p className="sp-bestaetigung-titel">
                    {p.meiner ? "Beitrag zurücknehmen?" : "Beitrag entfernen?"}
                  </p>
                  <p className="sp-bestaetigung-text">
                    {p.meiner
                      ? "Er verschwindet aus dem Feed. Reaktionen und Kommentare darauf verschwinden mit."
                      : "Er verschwindet für alle. Das wird protokolliert — mit deinem Namen."}
                  </p>
                  <div className="sp-bestaetigung-knoepfe">
                    <button type="button" onClick={() => setLoesche(null)} className="sp-abbrechen">Behalten</button>
                    <button type="button" onClick={() => void entfernen(p.id)} className="sp-gefahr">
                      {p.meiner ? "Zurücknehmen" : "Entfernen"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Reaktionen: springen kurz, Zähler federt ─────────────── */}
              <div className="sp-reaktionen">
                {(daten?.reaktionen ?? []).map((art: string) => {
                  const m = REAKTIONS_MARKE[art] ?? { titel: art, Icon: ThumbsUp };
                  const n = p.reaktionen[art] ?? 0;
                  const meine = p.meine === art;
                  return (
                    <button key={art} type="button" onClick={() => void reagieren(p.id, art)}
                            className="sp-reaktion" data-an={meine ? "1" : "0"}
                            title={m.titel} aria-label={m.titel} aria-pressed={meine}>
                      <m.Icon size={16} strokeWidth={1.75} className="sp-reaktion-zeichen" aria-hidden="true" />
                      {n > 0 && <span key={n} className="sp-zaehler">{n}</span>}
                    </button>
                  );
                })}
                <button type="button"
                        onClick={() => setKommentarZu(kommentarZu === p.id ? null : p.id)}
                        className="sp-kommentarknopf">
                  <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                  {p.kommentare.length > 0
                    ? `${p.kommentare.length} ${p.kommentare.length === 1 ? "Kommentar" : "Kommentare"}`
                    : "Kommentieren"}
                </button>
              </div>

              {/* ── Kommentare als Thread mit Verbindungslinie ───────────── */}
              {kommentarZu === p.id && (
                <div className="sp-kommentare">
                  {(() => {
                    const oben = p.kommentare.filter((k) => !k.antwortAuf);
                    const alleAuf = alleKommentare.has(p.id);
                    const sichtbar = alleAuf ? oben : oben.slice(0, 3);
                    return (
                      <>
                        {!alleAuf && oben.length > 3 && (
                          <button type="button"
                                  onClick={() => setAlleKommentare((m) => new Set(m).add(p.id))}
                                  className="sp-mehr-kommentare">
                            {oben.length - 3} weitere {oben.length - 3 === 1 ? "Kommentar" : "Kommentare"} anzeigen
                          </button>
                        )}
                        {sichtbar.map((k) => {
                          const antworten = p.kommentare.filter((x) => x.antwortAuf === k.id);
                          return (
                            <div key={k.id}>
                              <KommentarZeile k={k}
                                              onAntwort={() => setAntwortAuf({ id: k.id, name: k.name ?? "Jemand" })}
                                              onWeg={() => void kommentarWeg(k.id)} />
                              {antworten.length > 0 && (
                                <div className="sp-antworten">
                                  {antworten.map((x) => (
                                    <KommentarZeile key={x.id} k={x}
                                                    onAntwort={() => setAntwortAuf({ id: k.id, name: x.name ?? "Jemand" })}
                                                    onWeg={() => void kommentarWeg(x.id)} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                  <div className="sp-kommentar-eingabe">
                    {antwortAuf && (
                      <p className="sp-antwort-hinweis">
                        Antwort an <b>{antwortAuf.name}</b>
                        <button type="button" onClick={() => setAntwortAuf(null)}>abbrechen</button>
                      </p>
                    )}
                    <div className="sp-kommentar-neu">
                      <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={28} />
                      <input value={kommentarText} onChange={(e) => setKommentarText(e.target.value)}
                             onKeyDown={(e) => { if (e.key === "Enter") void kommentieren(p.id); }}
                             placeholder={antwortAuf ? `Antwort an ${antwortAuf.name} …` : "Etwas dazu sagen …"}
                             aria-label="Kommentar" className="sp-kommentar-feld" />
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {/* Der Fühler fürs Nachladen — unsichtbar, 400 px Vorlauf. */}
        <div ref={fuehler} aria-hidden="true" style={{ height: 1 }} />
        {laedtMehr && <p className="sp-lade">Lädt weitere Beiträge …</p>}
        {!mehr && posts.length > 10 && (
          <p className="sp-ende">Das war alles. Willkommen ganz unten.</p>
        )}
      </div>

      {/* ── Handy: Composer von unten erreichbar ──────────────────────────── */}
      <button type="button" className="sp-fab" onClick={zumComposer} aria-label="Beitrag schreiben">
        <PenLine size={18} strokeWidth={1.75} aria-hidden="true" />
        Schreiben
      </button>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="sp-lightbox" role="dialog" aria-modal="true" aria-label="Bild"
             onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
          <button type="button" className="sp-lightbox-zu" aria-label="Schließen"
                  onClick={() => setLightbox(null)}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
