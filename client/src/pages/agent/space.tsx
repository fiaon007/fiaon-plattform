import { useCallback, useEffect, useRef, useState } from "react";
import { AgentShell } from "./shared";
import { FiaonEbene } from "@/components/FiaonEbene";

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
  /** Auf welchen Kommentar antwortet dieser? Genau eine Ebene tief. */
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
  /** Ist das MEIN Beitrag? Der Server entscheidet das, nicht der Browser. */
  meiner: boolean;
  /** Bis wann sich der Beitrag noch ändern lässt (15 Minuten ab Anlage). */
  bearbeitbarBis: string | null;
  reaktionen: Record<string, number>;
  meine: string | null;
  kommentare: Kommentar[];
}

const REAKTIONS_MARKE: Record<string, { titel: string; zeichen: React.ReactNode }> = {
  gut: {
    titel: "Gefällt mir",
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 17V8.6l3.2-5.1c.2-.4.7-.6 1.1-.4.7.3 1.1 1 1.1 1.8L11 8.2h3.6c1 0 1.7.9 1.5 1.9l-1 5c-.1.7-.8 1.2-1.5 1.2H6Z" />
        <path d="M6 8.6H4.3c-.4 0-.8.4-.8.8v6.8c0 .4.4.8.8.8H6" />
      </svg>
    ),
  },
  schlecht: {
    titel: "Gefällt mir nicht",
    // Dieselbe Zeichnung, gedreht — nicht neu gezeichnet: Zwei Daumen, die
    // sich in der Strichführung unterscheiden, sehen aus wie zwei Symbole
    // aus verschiedenen Sätzen.
    zeichen: (
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
           style={{ transform: "rotate(180deg)" }}>
        <path d="M6 17V8.6l3.2-5.1c.2-.4.7-.6 1.1-.4.7.3 1.1 1 1.1 1.8L11 8.2h3.6c1 0 1.7.9 1.5 1.9l-1 5c-.1.7-.8 1.2-1.5 1.2H6Z" />
        <path d="M6 8.6H4.3c-.4 0-.8.4-.8.8v6.8c0 .4.4.8.8.8H6" />
      </svg>
    ),
  },
};

/**
 * Die Kennmarke je Beitragsart — eine feine Zeile in der Kartenkopfzeile.
 *
 * Sie sagt in zwei Wörtern, WAS man da liest: eine Zahl, ein Gedanke, eine
 * Ansage. Ohne sie sieht ein Systembeitrag aus wie der Beitrag eines Kollegen.
 */
const ART_MARKE: Record<string, { titel: string; ton: string }> = {
  gedanke: { titel: "Gedanke des Tages", ton: "#64748b" },
  impuls: { titel: "Verkaufs-Impuls", ton: "#1d4ed8" },
  abschluss: { titel: "Abschluss", ton: "#059669" },
  rangliste: { titel: "Der Tag in Zahlen", ton: "#059669" },
  woche: { titel: "Wochenrückblick", ton: "#059669" },
  meilenstein: { titel: "Meilenstein", ton: "#b45309" },
  rekord: { titel: "Rekord", ton: "#b45309" },
  feiertage: { titel: "Heute weltweit", ton: "#64748b" },
  neuzugang: { titel: "Neu im Team", ton: "#1d4ed8" },
  verkuendung: { titel: "Ansage", ton: "#1d4ed8" },
  update: { titel: "Neu in der Plattform", ton: "#1d4ed8" },
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
/**
 * Der Systemavatar — FIAON selbst.
 *
 * ── WAS VORHER DA STAND ────────────────────────────────────────────────────
 * Ein generischer Aufwärtspfeil mit zwei Funken. Der Betreiber: „Warum hat
 * FIAON links daneben so ein ekelhaftes altes ICON?" Zu Recht — es war ein
 * Allerweltszeichen, das mit der Marke nichts zu tun hatte, und es stand
 * unter jedem zweiten Beitrag im Feed.
 *
 * ── WAS JETZT DA STEHT ─────────────────────────────────────────────────────
 * Dieselbe Kachel wie das Favicon: dunkles CI-Blau, das „F" der Wortmarke in
 * Weiß, dazu die Aufwärtsgeste. Wer den Tab erkennt, erkennt den Absender.
 */
/** Eine Kommentarzeile — oberste Ebene wie Antwort, dieselbe Form. */
function KommentarZeile({ k, onAntwort, onWeg }: {
  k: Kommentar; onAntwort: () => void; onWeg: () => void;
}) {
  return (
    <div className="fi-sp-kommentar">
      <Avatar src={k.avatar} name={k.name ?? "?"} size={28} />
      <div className="min-w-0 flex-1">
        <p className="fi-sp-kommentar-blase">
          <b>{k.name ?? "Jemand"}</b> {k.text}
        </p>
        <p className="fi-sp-kommentar-zeit">
          {wann(k.am)}
          <button type="button" onClick={onAntwort} className="fi-sp-kommentar-tat">Antworten</button>
          {k.meiner && (
            <button type="button" onClick={onWeg} className="fi-sp-kommentar-tat">Löschen</button>
          )}
        </p>
      </div>
    </div>
  );
}

function SystemAvatar({ size = 42 }: { size?: number }) {
  return (
    <span className="fi-sp-systemavatar" style={{ width: size, height: size }} aria-label="FIAON">
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


/**
 * Der Space — für Team UND Betreiber.
 *
 * `alsAdmin` schaltet auf die Admin-Endpunkte um. Dieselbe Oberfläche, andere
 * Tür: Eine zweite Seite wäre eine zweite Seite zum Pflegen, und die eine
 * würde bei jeder Änderung vergessen.
 */
export default function AgentSpace({ alsAdmin = false }: { alsAdmin?: boolean } = {}) {
  const basisWeg = alsAdmin ? "/api/fiaon/admin/space" : "/api/fiaon/agent/space";
  const [daten, setDaten] = useState<any>(null);
  const [text, setText] = useState("");
  const [gross, setGross] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kommentarZu, setKommentarZu] = useState<number | null>(null);
  const [kommentarText, setKommentarText] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);
  // Nachladen
  const [mehr, setMehr] = useState(true);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const fuehler = useRef<HTMLDivElement>(null);
  const kopf = useRef<HTMLDivElement>(null);
  // Neue Beiträge, während man liest
  const [neue, setNeue] = useState(0);
  const oberste = useRef<number | null>(null);
  // Bild und Akten-Chip am Komposer
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

  const laden = useCallback(async () => {
    const r = await fetch(basisWeg, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setDaten(j);
      setMehr(!!j.mehr);
      oberste.current = j.posts?.[0]?.id ?? null;
      setNeue(0);
    }
  }, [basisWeg]);
  useEffect(() => { void laden(); }, [laden]);

  // ── UNENDLICHES SCROLLEN ──────────────────────────────────────────────────
  // Über einen Beobachter am Fuß der Liste, nicht über die Scrollposition:
  // Ein Rechenwert aus scrollTop und Höhe ist bei Zoom, Tastatur und
  // ausklappenden Kommentaren jedes Mal woanders falsch.
  const nachladen = useCallback(async () => {
    if (laedtMehr || !mehr || !daten?.posts?.length) return;
    setLaedtMehr(true);
    const letzter = daten.posts[daten.posts.length - 1].id;
    const r = await fetch(`${basisWeg}?vor=${letzter}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaedtMehr(false);
    if (!j?.ok) { setMehr(false); return; }
    setMehr(!!j.mehr && (j.posts?.length ?? 0) > 0);
    setDaten((d: any) => d && { ...d, posts: [...d.posts, ...(j.posts ?? [])] });
  }, [daten, laedtMehr, mehr, basisWeg]);

  useEffect(() => {
    const ziel = fuehler.current;
    if (!ziel) return;
    const beobachter = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting) void nachladen();
      // 400 px Vorlauf: Nachgeladen wird, BEVOR der Leser unten ankommt.
    }, { rootMargin: "400px" });
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, [nachladen]);

  // ── „Neue Beiträge" ───────────────────────────────────────────────────────
  // Alle zwei Minuten nachsehen, ob oben etwas dazugekommen ist. NICHT
  // einfügen — das würde beim Lesen die Zeile wegschieben. Stattdessen eine
  // Pille, die man antippt.
  useEffect(() => {
    const uhr = setInterval(async () => {
      if (document.hidden || !oberste.current) return;
      const r = await fetch(`${basisWeg}?limit=5`, { credentials: "include" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (!j?.ok) return;
      const n = (j.posts ?? []).findIndex((p: Post) => p.id === oberste.current);
      setNeue(n > 0 ? n : 0);
    }, 120_000);
    return () => clearInterval(uhr);
  }, [basisWeg]);

  const senden = async () => {
    setBusy(true); setFehler(null);
    const r = await fetch(basisWeg, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, bild, akteRef: akte?.ref ?? null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Konnte nicht gesendet werden."); return; }
    setText(""); setGross(false); setBild(null); setAkte(null); setAkteSuche("");
    void laden();
  };

  /**
   * Bild wählen — VERKLEINERT IM BROWSER, bevor irgendetwas hochgeht.
   *
   * Ein Handyfoto hat leicht acht Megabyte. Ungeschrumpft würde jeder Beitrag
   * die Datenbank vollmachen und der Feed auf dem Mobilfunknetz nicht laden.
   * 1400 px lange Kante genügt für jede Feed-Darstellung.
   */
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

  // Akten-Suche, entprellt: Jeder Tastendruck eine Anfrage wäre bei acht
  // Zeichen acht Abfragen über den ganzen Bestand.
  useEffect(() => {
    if (akteSuche.trim().length < 2) { setAkteTreffer([]); return; }
    const uhr = setTimeout(async () => {
      const r = await fetch(`/api/fiaon/agent/space/akte-suche?q=${encodeURIComponent(akteSuche)}`,
        { credentials: "include" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      setAkteTreffer(j?.ok ? j.treffer : []);
    }, 280);
    return () => clearTimeout(uhr);
  }, [akteSuche]);

  const speichern = async (postId: number) => {
    const r = await fetch(`${basisWeg}/${postId}`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: bearbeiteText }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { setFehler(j?.error || "Änderung abgelehnt."); return; }
    setBearbeite(null); void laden();
  };

  const entfernen = async (postId: number) => {
    const r = await fetch(`${basisWeg}/${postId}`, { method: "DELETE", credentials: "include" })
      .catch(() => null);
    const j = await r?.json().catch(() => null);
    setLoesche(null);
    if (!j?.ok) { setFehler(j?.error || "Konnte nicht entfernt werden."); return; }
    void laden();
  };

  const loesen = async (postId: number) => {
    await fetch(`${basisWeg}/${postId}/anpinnen`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ an: false }),
    }).catch(() => {});
    void laden();
  };

  const kommentarWeg = async (id: number) => {
    await fetch(`/api/fiaon/agent/space/kommentar/${id}`, { method: "DELETE", credentials: "include" })
      .catch(() => {});
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
    await fetch(`${basisWeg}/${postId}/reaktion`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art }),
    }).catch(() => {});
  };

  const kommentieren = async (postId: number) => {
    if (kommentarText.trim().length < 2) return;
    const r = await fetch(`${basisWeg}/${postId}/kommentar`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: kommentarText, antwortAuf: antwortAuf?.id ?? null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { setFehler(j?.error || "Kommentar abgelehnt."); return; }
    setKommentarText(""); setAntwortAuf(null);
    void laden();
  };

  const alle: Post[] = daten?.posts ?? [];
  // ── ANGEPINNTES GEHÖRT IN EINE LEISTE, NICHT IN DEN FEED ─────────────────
  // Drei angepinnte Beiträge in voller Größe schoben den ersten echten
  // Beitrag unter die Falzlinie. Wer den Space öffnete, sah dreimal dieselbe
  // Hausordnung und musste scrollen, um zu erfahren, was das Team gemacht
  // hat. Jetzt: eine Zeile je Beitrag, aufklappbar.
  const angepinnte = alle.filter((p) => p.angepinnt);
  const posts = alle.filter((p) => !p.angepinnt);
  const ich = daten?.ich;

  // ── EINE OBERFLÄCHE, ZWEI TÜREN ───────────────────────────────────────────
  // Unter /admin/space liegt die Admin-Hülle schon außen herum (die Route ist
  // über `admin(…)` eingehängt). Ein zusätzliches AgentShell würde den
  // Betreiber hinauswerfen — er hat kein Agent-Konto, und die Team-Hülle
  // leitet jeden ohne Konto zur Anmeldung um. Genau das ist beim ersten
  // Versuch passiert: /admin/space landete auf der Team-Anmeldung.
  const inhalt = (
    <>
      <style>{SPACE_CSS}</style>
      <div className="fi-sp-buehne">

        {/* ── LINKS: wer bin ich ──────────────────────────────────────────── */}
        <aside className="fi-sp-seite fi-sp-links">
          <div className="fi-sp-karte fi-sp-profil">
            {/* DAS EIGENE GESICHT — nicht die Initialen. Der Server liefert
                `ich.avatar` seit dem 11.08.2026 mit. */}
            <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={56} />
            <p className="fi-sp-profil-name">{ich?.name ?? ich?.vorname ?? ""}</p>
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
          <div ref={kopf} aria-hidden="true" />
          {/* ── Angepinntes: eine schmale Leiste ──────────────────────── */}
          {angepinnte.length > 0 && (
            <div className="fi-sp-pinleiste">
              {angepinnte.map((p) => {
                const offen = pinOffen === p.id;
                const kopf = p.text.split("\n")[0].slice(0, 90);
                return (
                  <div key={p.id} className="fi-sp-pinzeile" data-offen={offen ? "1" : "0"}>
                    <button type="button" onClick={() => setPinOffen(offen ? null : p.id)}
                            className="fi-sp-pinknopf">
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                           strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
                           className="shrink-0" aria-hidden="true">
                        <path d="M12.5 2.5 17.5 7.5M11 4 4.5 8.5 3 17l8.5-1.5L16 9" />
                      </svg>
                      <span className="fi-sp-pintext">{kopf}</span>
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                           strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                           className="shrink-0 fi-sp-pinpfeil" aria-hidden="true">
                        <path d="m5.5 8 4.5 4.5L14.5 8" />
                      </svg>
                    </button>
                    {offen && (
                      <div className="fi-sp-pininhalt">
                        <p className="fi-sp-text">{p.text}</p>
                        {daten?.darfVerwalten && (
                          <button type="button" onClick={() => void loesen(p.id)}
                                  className="fi-sp-pinloesen">Nicht mehr anpinnen</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Komposer — als einladende Karte, nicht als Formular. */}
          <div className={`fi-sp-karte fi-sp-komposer ${gross ? "fi-sp-komposer-gross" : ""}`}>
            <div className="fi-sp-komposer-kopf">
              <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={40} />
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
            {/* Vorschau des gewählten Bildes */}
            {bild && (
              <div className="fi-sp-bildvorschau">
                <img src={bild} alt="Gewähltes Bild" />
                <button type="button" onClick={() => setBild(null)} aria-label="Bild entfernen">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={2} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
                </button>
              </div>
            )}

            {/* Der angehängte Akten-Chip */}
            {akte && (
              <div className="fi-sp-aktechip fi-sp-aktechip-wahl">
                <span className="fi-sp-aktechip-marke" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z" />
                    <path d="M11.5 2.5v4h4" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <b>{akte.ref}</b>
                  <span className="fi-sp-aktechip-hinweis">
                    Im Feed erscheint nur die Referenz — kein Name, kein Betrag.
                  </span>
                </span>
                <button type="button" onClick={() => setAkte(null)} aria-label="Akte entfernen"
                        className="fi-sp-aktechip-weg">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                       strokeWidth={2} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
                </button>
              </div>
            )}

            {gross && (
              <div className="fi-sp-komposer-fuss">
                {/* Aktensuche */}
                {!akte && (
                  <div className="fi-sp-aktesuche">
                    <input value={akteSuche} onChange={(e) => setAkteSuche(e.target.value)}
                           placeholder="Akte anhängen (Name oder Referenz suchen) …"
                           aria-label="Akte suchen" className="fi-sp-aktesuche-feld" />
                    {akteTreffer.length > 0 && (
                      <div className="fi-sp-aktesuche-liste">
                        {akteTreffer.map((t: any) => (
                          <button key={t.ref} type="button"
                                  onClick={() => { setAkte({ ref: t.ref, name: t.name }); setAkteSuche(""); setAkteTreffer([]); }}
                                  className="fi-sp-aktesuche-zeile">
                            <b>{t.name}</b><span>{t.ref}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p className="fi-sp-hinweis">
                  {daten?.hinweis}{" "}
                  <b>Wenn es um einen bestimmten Kunden geht, häng die Akte an — das ist der richtige Weg.</b>
                </p>
                <div className="fi-sp-komposer-knoepfe">
                  <label className="fi-sp-bildknopf">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2.5" y="4" width="15" height="12" rx="2.5" />
                      <circle cx="7" cy="8" r="1.3" />
                      <path d="m3.5 14 3.8-3.6c.5-.5 1.3-.5 1.8 0L12 13.5l1.6-1.5c.5-.5 1.3-.5 1.8 0l2.1 2" />
                    </svg>
                    Bild
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                           onChange={(e) => { const f = e.target.files?.[0]; if (f) void bildWaehlen(f); }} />
                  </label>
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

          {/* „Neue Beiträge" — antippen statt automatisch einfügen. Ein Feed,
              der beim Lesen die Zeile wegschiebt, ist ärgerlich. */}
          {neue > 0 && (
            <button type="button"
                    onClick={() => {
                      // NICHT window.scrollTo: Der Inhalt liegt in einem
                      // inneren Behälter der Team-Hülle, das Fenster selbst
                      // scrollt nie. Gemessen: scrollY bleibt 0, egal wie weit
                      // man gerollt hat. `scrollIntoView` findet den richtigen
                      // Behälter von selbst.
                      kopf.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      void laden();
                    }}
                    className="fi-sp-pill">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 15.5V5m0 0-4.5 4.5M10 5l4.5 4.5" />
              </svg>
              {neue} {neue === 1 ? "neuer Beitrag" : "neue Beiträge"}
            </button>
          )}

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
                  ? <SystemAvatar />
                  : <Avatar src={p.autorAvatar} name={p.autorName ?? "FIAON"} />}
                <div className="min-w-0 flex-1">
                  <p className="fi-sp-autor">
                    {p.autorName ?? (p.autorTyp === "leitung" ? "Vertriebsleitung" : "FIAON")}
                  </p>
                  <p className="fi-sp-zeit">
                    {wann(p.am)}
                    {p.bearbeitet && <span className="fi-sp-bearbeitet"> · bearbeitet</span>}
                  </p>
                </div>

                {/* Die Kennmarke: sagt in zwei Wörtern, was das hier ist. */}
                {p.autoArt && ART_MARKE[p.autoArt] && (
                  <span className="fi-sp-artmarke" style={{ color: ART_MARKE[p.autoArt].ton }}>
                    {ART_MARKE[p.autoArt].titel}
                  </span>
                )}

                {/* Eigene Beiträge: ändern (15 Min) und zurücknehmen.
                    Leitung und Betreiber dürfen jeden Beitrag entfernen. */}
                {(p.meiner || daten?.darfVerwalten) && (
                  <div className="fi-sp-postmenue">
                    {p.meiner && p.bearbeitbarBis && new Date(p.bearbeitbarBis) > new Date() && (
                      <button type="button" onClick={() => { setBearbeite(p.id); setBearbeiteText(p.text); }}
                              className="fi-sp-postmenue-knopf">Ändern</button>
                    )}
                    <button type="button" onClick={() => setLoesche(p)}
                            className="fi-sp-postmenue-knopf fi-sp-postmenue-weg">
                      {p.meiner ? "Zurücknehmen" : "Entfernen"}
                    </button>
                  </div>
                )}
              </header>

              {bearbeite === p.id ? (
                <div className="fi-sp-bearbeiten">
                  <textarea value={bearbeiteText} onChange={(e) => setBearbeiteText(e.target.value)}
                            rows={4} aria-label="Beitrag ändern" className="fi-sp-bearbeiten-feld" />
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={() => setBearbeite(null)}
                            className="text-[12.5px] font-semibold text-slate-500">Abbrechen</button>
                    <button type="button" onClick={() => void speichern(p.id)}
                            disabled={bearbeiteText.trim().length < 3}
                            className="ml-auto fi-knopf-primaer px-4 py-2 text-[13px]">Speichern</button>
                  </div>
                </div>
              ) : (
                <p className="fi-sp-text">{p.text}</p>
              )}

              {p.hatBild && (
                <img src={`/api/fiaon/agent/space/bild/${p.id}`} alt=""
                     loading="lazy" className="fi-sp-bild" />
              )}

              {/* ── Akten-Verweis ──────────────────────────────────────────
                  NUR die Referenz. Wer klickt und nicht berechtigt ist,
                  bekommt eine freundliche 404 — die Prüfung sitzt in der
                  Akte, nicht hier. */}
              {p.akteRef && (
                <a href={`/agent/kunden?ref=${encodeURIComponent(p.akteRef)}`} className="fi-sp-aktechip">
                  <span className="fi-sp-aktechip-marke" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z" />
                      <path d="M11.5 2.5v4h4" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b>{p.akteRef}</b>
                    <span className="fi-sp-aktechip-hinweis">Akte öffnen — wenn du berechtigt bist</span>
                  </span>
                  <span className="fi-sp-aktechip-pfeil" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m7.5 4.5 6 5.5-6 5.5" />
                    </svg>
                  </span>
                </a>
              )}

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
                  {(() => {
                    // Die oberste Ebene, jede mit ihren Antworten darunter.
                    // Ab drei wird eingeklappt: Ein Beitrag mit zwanzig
                    // Kommentaren schiebt sonst alles Folgende vom Bildschirm.
                    const oben = p.kommentare.filter((k) => !k.antwortAuf);
                    const alle = alleKommentare.has(p.id);
                    const sichtbar = alle ? oben : oben.slice(0, 3);
                    return (
                      <>
                        {!alle && oben.length > 3 && (
                          <button type="button"
                                  onClick={() => setAlleKommentare((m) => new Set(m).add(p.id))}
                                  className="fi-sp-mehr-kommentare">
                            {oben.length - 3} weitere {oben.length - 3 === 1 ? "Kommentar" : "Kommentare"} anzeigen
                          </button>
                        )}
                        {sichtbar.map((k) => {
                          const antworten = p.kommentare.filter((x) => x.antwortAuf === k.id);
                          return (
                            <div key={k.id}>
                              <KommentarZeile k={k} onAntwort={() => setAntwortAuf({ id: k.id, name: k.name ?? "Jemand" })}
                                              onWeg={() => void kommentarWeg(k.id)} />
                              {antworten.length > 0 && (
                                <div className="fi-sp-antworten">
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

                  {antwortAuf && (
                    <p className="fi-sp-antwort-hinweis">
                      Antwort an <b>{antwortAuf.name}</b>
                      <button type="button" onClick={() => setAntwortAuf(null)} className="ml-2 underline">
                        abbrechen
                      </button>
                    </p>
                  )}
                  <div className="fi-sp-kommentar-neu">
                    <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={28} />
                    <input value={kommentarText} onChange={(e) => setKommentarText(e.target.value)}
                           onKeyDown={(e) => { if (e.key === "Enter") void kommentieren(p.id); }}
                           placeholder={antwortAuf ? `Antwort an ${antwortAuf.name} …` : "Etwas dazu sagen …"}
                           aria-label="Kommentar" className="fi-sp-kommentar-feld" />
                  </div>
                </div>
              )}
            </article>
          ))}

          {/* Der Fühler fürs Nachladen. Unsichtbar, 400 px Vorlauf. */}
          <div ref={fuehler} aria-hidden="true" style={{ height: 1 }} />
          {laedtMehr && <p className="fi-sp-leer">Lädt weitere Beiträge …</p>}
          {!mehr && posts.length > 10 && (
            <p className="fi-sp-ende">Das war alles. Willkommen ganz unten.</p>
          )}
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
        {/* Zurücknehmen — mit Rückfrage. Ein Beitrag, den man versehentlich
            entfernt, ist weg; die Rückfrage kostet eine Sekunde. */}
        <FiaonEbene
          offen={!!loesche}
          onZu={() => setLoesche(null)}
          titel={loesche?.meiner ? "Beitrag zurücknehmen?" : "Beitrag entfernen?"}
          ueberschrift={loesche?.meiner ? "Nur du siehst diese Frage" : "Moderation"}
          breite={460}
          kinder={
            <>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
                {loesche?.meiner
                  ? "Der Beitrag verschwindet aus dem Feed. Reaktionen und Kommentare darauf verschwinden mit."
                  : "Der Beitrag verschwindet für alle. Das wird protokolliert — mit deinem Namen."}
              </p>
              {loesche && (
                <p className="mt-3 px-3.5 py-3 rounded-2xl text-[12.5px] leading-relaxed"
                   style={{ background: "rgba(15,23,42,.04)", color: "var(--fi-text-still)" }}>
                  {loesche.text.slice(0, 180)}{loesche.text.length > 180 ? " …" : ""}
                </p>
              )}
            </>
          }
          fuss={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setLoesche(null)}
                      className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
                Behalten
              </button>
              <button type="button" onClick={() => loesche && void entfernen(loesche.id)}
                      className="ml-auto fi-knopf-gefahr fi-knopf-gefahr-voll px-5">
                {loesche?.meiner ? "Zurücknehmen" : "Entfernen"}
              </button>
            </div>
          }
        />
      </div>
    </>
  );

  return alsAdmin ? inhalt : <AgentShell>{inhalt}</AgentShell>;
}

const SPACE_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   SPACE — Oberfläche
   Auf den FIAON-Tokens (styles/fiaon-design.css): #1d4ed8 als einzige
   Akzentfarbe, Schiefer als Textskala, Weiß als Trägerfläche.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Der Raum hinter allem ───────────────────────────────────────────────
   Über :has() auf die Hülle selbst, NICHT als eigene Ebene in der Bühne:
   Die Bühne trägt „perspective“, und das macht sie zum Bezugsrahmen für
   „position: fixed“ — ein fester Hintergrund darin deckt nur die Bühne ab,
   nicht den Bildschirm. Der erste Versuch war deshalb unsichtbar.

   Die Hülle setzt selbst #f8fafc. Dagegen war jeder Verlauf mit 5 %
   Deckkraft chancenlos. Hier ersetzt er sie ganz. */
body:has(.fi-sp-buehne) .agent-ambient {
  background:
    radial-gradient(1240px 720px at 14% -12%, rgba(59,130,246,.26), transparent 58%),
    radial-gradient(1020px 640px at 92% 4%, rgba(29,78,216,.2), transparent 54%),
    radial-gradient(820px 560px at 50% 106%, rgba(96,165,250,.2), transparent 56%),
    linear-gradient(176deg, #e8effa 0%, #dfe9f8 46%, #e6edfa 100%);
  background-attachment: fixed;
}
/* Eine sehr feine Körnung über dem Verlauf. Einzeln nicht zu sehen, nimmt ihm
   aber das Digitale — ohne sie entstehen auf großen Flächen Farbstufen. */
body:has(.fi-sp-buehne) .agent-ambient::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: .45; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='k'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='150' height='150' filter='url(%23k)' opacity='.3'/></svg>");
}

/* ── Bühne: drei Spalten, Feed in der Mitte ────────────────────────────── */
.fi-sp-buehne {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 620px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  max-width: 1180px;
  margin: 0 auto;
  /* Die Bühne für die Tiefe. Ohne perspective ist jedes translateZ wirkungslos
     und die Karten bleiben flach. */
  perspective: 1600px;
  perspective-origin: 50% 0%;
}
.fi-sp-buehne > * { position: relative; z-index: 1; }

.fi-sp-seite { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 12px; }
.fi-sp-links { justify-self: end; width: 100%; max-width: 252px; }
.fi-sp-rechts { justify-self: start; width: 100%; max-width: 252px; }
@media (max-width: 1079px) {
  .fi-sp-buehne { grid-template-columns: minmax(0, 620px); justify-content: center; }
  .fi-sp-seite { display: none; }
}
@media (max-width: 639px) {
  .fi-sp-buehne { gap: 0; margin: -20px -16px 0; perspective: none; }
}

/* ── Karten: Glas über der Fläche, nicht Kasten auf Papier ───────────────
   Vier Lagen Schatten. Ein einzelner Schatten sieht immer nach Vorlage aus;
   erst die Staffelung — Kontaktschatten, Streuschatten, Farbschatten,
   Lichtkante — ergibt einen Körper, der über etwas liegt. */
.fi-sp-karte {
  position: relative;
  background:
    linear-gradient(158deg, rgba(255,255,255,.78), rgba(255,255,255,.6));
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 22px;
  padding: 17px 19px;
  box-shadow:
    0 1px 2px rgba(15,23,42,.06),
    0 18px 40px -24px rgba(11,18,38,.44),
    0 0 50px -26px rgba(29,78,216,.4),
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 0 0 0 1px rgba(255,255,255,.5),
    inset 0 0 0 1.5px rgba(15,23,42,.05);
  transform-style: preserve-3d;
}
/* Die Lichtkante oben — schmal, hell, nur auf den oberen 1,5 px. Das ist der
   Unterschied zwischen „weiße Fläche" und „Glaskante im Licht". */
.fi-sp-karte::after {
  content: ""; position: absolute; inset: 0 0 auto; height: 1.5px;
  border-radius: 22px 22px 0 0;
  background: linear-gradient(90deg,
    transparent, rgba(255,255,255,.96) 22%, rgba(255,255,255,.96) 78%, transparent);
  pointer-events: none;
}
@media (max-width: 639px) {
  .fi-sp-karte {
    border-radius: 0; padding: 15px 16px;
    background: rgba(255,255,255,.9);
    box-shadow: inset 0 -1px 0 rgba(15,23,42,.07);
  }
  .fi-sp-karte::after { display: none; }
}

/* ── Avatare ─────────────────────────────────────────────────────────────
   Ein Ring aus Licht plus ein Schlagschatten: Der Kopf steht auf der Karte,
   er liegt nicht darin. */
.fi-sp-avatar {
  border-radius: 999px; object-fit: cover; flex-shrink: 0;
  box-shadow:
    0 0 0 1px rgba(15,23,42,.07),
    0 0 0 3px rgba(255,255,255,.85),
    0 4px 12px -4px rgba(11,18,38,.4);
}
.fi-sp-avatar-text {
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff; letter-spacing: -.02em;
  background: linear-gradient(158deg, #3b82f6, #1d4ed8 62%, #1e40af);
}
.fi-sp-automarke {
  width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: #1d4ed8;
  background: linear-gradient(158deg, rgba(59,130,246,.18), rgba(29,78,216,.07));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.8),
    inset 0 0 0 1px rgba(37,99,235,.18),
    0 4px 12px -6px rgba(29,78,216,.4);
}

/* ── Komposer ────────────────────────────────────────────────────────────
   Beim Fokus hebt er sich buchstäblich an: 6 px nach vorn, Schatten tiefer,
   Akzentkante an. Das ist die Rückmeldung „du bist dran" ohne ein Wort. */
.fi-sp-komposer {
  margin-bottom: 14px;
  transition: box-shadow 320ms cubic-bezier(.32,.72,0,1),
              transform 320ms cubic-bezier(.32,.72,0,1);
}
.fi-sp-komposer-gross {
  transform: translateZ(16px);
  box-shadow:
    0 1px 2px rgba(15,23,42,.05),
    0 30px 66px -30px rgba(11,18,38,.44),
    0 0 60px -24px rgba(29,78,216,.5),
    inset 0 1px 0 rgba(255,255,255,.95),
    inset 0 0 0 1px rgba(37,99,235,.24);
}
.fi-sp-komposer-kopf { display: flex; align-items: flex-start; gap: 12px; }
.fi-sp-komposer-feld {
  flex: 1 1 auto; border: 0; outline: none; resize: none; background: none;
  font-size: 15px; line-height: 1.58; color: var(--fi-text, #0f172a);
  padding: 9px 0; min-height: 40px; font-family: inherit;
}
.fi-sp-komposer-feld::placeholder { color: var(--fi-text-still, #64748b); }
.fi-sp-komposer-fuss {
  margin-top: 13px; padding-top: 13px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.06);
  animation: fiSpAuf 300ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-komposer-knoepfe { display: flex; align-items: center; gap: 8px; margin-top: 11px; }
.fi-sp-hinweis { font-size: 11.5px; color: var(--fi-text-still, #64748b); line-height: 1.5; margin: 0; }
.fi-sp-hinweis b { color: var(--fi-text-leise, #475569); font-weight: 650; }
.fi-sp-abbrechen {
  background: none; border: 0; cursor: pointer; padding: 8px 4px;
  font-size: 13px; font-weight: 600; color: var(--fi-text-still, #64748b);
}
/* Der Primärknopf: Verlauf, Innenlicht oben, farbiger Schlagschatten. Beim
   Drücken sinkt er ein und der Schatten verschwindet — Druckgefühl. */
.fi-sp-senden {
  margin-left: auto; padding: 10px 22px; border: 0; cursor: pointer;
  border-radius: 999px; font-size: 13.5px; font-weight: 700; color: #fff;
  background: linear-gradient(178deg, #2563eb, #1d4ed8 60%, #1e40af);
  box-shadow:
    0 12px 26px -12px rgba(29,78,216,.72),
    0 2px 5px -2px rgba(29,78,216,.5),
    inset 0 1px 0 rgba(255,255,255,.26);
  transition: transform 140ms cubic-bezier(.32,.72,0,1), box-shadow 200ms, filter 180ms;
}
.fi-sp-senden:hover:not(:disabled) {
  filter: brightness(1.08); transform: translateY(-1.5px);
  box-shadow: 0 18px 34px -14px rgba(29,78,216,.8), inset 0 1px 0 rgba(255,255,255,.3);
}
.fi-sp-senden:active:not(:disabled) {
  transform: translateY(1px) scale(.985);
  box-shadow: inset 0 2px 5px rgba(11,18,38,.32);
}
.fi-sp-senden:disabled { opacity: .32; cursor: default; box-shadow: none; }

/* ── Beitrag ─────────────────────────────────────────────────────────────
   Eintritt AUS DER TIEFE: 40 px hinter der Bühne, leicht gekippt, dann nach
   vorn. Kein Einblenden von unten — das macht jede Liste. */
.fi-sp-post {
  margin-bottom: 12px;
  animation: fiSpPostAuf 620ms cubic-bezier(.22,.68,0,1) both;
  transition: box-shadow 280ms cubic-bezier(.32,.72,0,1),
              transform 280ms cubic-bezier(.32,.72,0,1);
}
@media (min-width: 640px) {
  /* Beim Überfahren kommt die Karte dem Zeiger entgegen. 4 px reichen — mehr
     wirkt wie ein Spielzeug. */
  .fi-sp-post:hover {
    transform: translateZ(10px) translateY(-2px);
    box-shadow:
      0 1px 2px rgba(15,23,42,.05),
      0 24px 50px -26px rgba(11,18,38,.46),
      0 0 54px -24px rgba(29,78,216,.36),
      inset 0 1px 0 rgba(255,255,255,.95),
      inset 0 0 0 1px rgba(15,23,42,.06);
  }
}
@keyframes fiSpPostAuf {
  from { opacity: 0; transform: translateY(26px) translateZ(-40px) rotateX(4deg); }
  to   { opacity: 1; transform: none; }
}
@keyframes fiSpAuf { from { opacity: 0 } to { opacity: 1 } }

/* Angepinnt: Ziffernmarke in der Akzentfarbe, wie überall im System. */
.fi-sp-pin {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: var(--fi-primaer, #1d4ed8); margin: 0 0 9px;
}
.fi-sp-post-kopf { display: flex; align-items: center; gap: 12px; margin-bottom: 11px; }
.fi-sp-autor {
  font-size: 14px; font-weight: 700; color: var(--fi-text, #0f172a);
  margin: 0; line-height: 1.3; letter-spacing: -.01em;
}
.fi-sp-zeit { font-size: 11.5px; color: var(--fi-text-still, #64748b); margin: 1px 0 0; }
.fi-sp-text {
  font-size: 14.5px; line-height: 1.64; color: var(--fi-text-leise, #334155);
  margin: 0; white-space: pre-wrap; overflow-wrap: anywhere;
}
/* Die erste Zeile eines Systembeitrags ist seine Überschrift. */
.fi-sp-text::first-line { font-weight: 650; color: var(--fi-text, #0f172a); }

/* ── Reaktionen ──────────────────────────────────────────────────────────
   Die eigene Reaktion bekommt einen Verlauf und einen weichen Farbschein —
   sie soll sich aus der Reihe herausheben, ohne größer zu werden. */
.fi-sp-reaktionen {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin-top: 13px; padding-top: 12px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.055);
}
.fi-sp-reaktion {
  position: relative; overflow: hidden;
  display: inline-flex; align-items: center; gap: 5px;
  height: 34px; padding: 0 11px; border: 0; cursor: pointer; border-radius: 999px;
  color: var(--fi-text-still, #64748b); background: transparent;
  transition: background 180ms, color 180ms, box-shadow 220ms,
              transform 160ms cubic-bezier(.32,.72,0,1);
}
.fi-sp-reaktion:hover {
  background: rgba(15,23,42,.045); color: var(--fi-text-leise, #475569);
  transform: translateY(-1.5px);
}
.fi-sp-reaktion:active { transform: scale(.9); }
.fi-sp-reaktion[data-an="1"] {
  color: var(--fi-primaer, #1d4ed8);
  background: linear-gradient(160deg, rgba(59,130,246,.16), rgba(29,78,216,.07));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.7),
    inset 0 0 0 1px rgba(37,99,235,.2),
    0 4px 12px -6px rgba(29,78,216,.45);
}
/* Die Welle beim Antippen — geht vom Knopf aus und verläuft. */
.fi-sp-reaktion[data-an="1"]::before {
  content: ""; position: absolute; inset: 0; border-radius: 999px;
  background: radial-gradient(circle at 50% 50%, rgba(37,99,235,.3), transparent 70%);
  animation: fiSpWelle 620ms cubic-bezier(.22,.68,0,1) both;
  pointer-events: none;
}
@keyframes fiSpWelle {
  from { opacity: .8; transform: scale(.25); }
  to   { opacity: 0;  transform: scale(1.9); }
}
.fi-sp-zaehler {
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  animation: fiSpSprung 420ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpSprung {
  0%   { transform: translateY(6px) scale(.5); opacity: 0 }
  55%  { transform: translateY(-2.5px) scale(1.22); opacity: 1 }
  100% { transform: none; opacity: 1 }
}
.fi-sp-kommentarknopf {
  margin-left: auto; background: none; border: 0; cursor: pointer;
  padding: 0 6px; height: 34px; font-size: 12.5px; font-weight: 600;
  color: var(--fi-text-still, #64748b); transition: color 180ms;
}
.fi-sp-kommentarknopf:hover { color: var(--fi-primaer, #1d4ed8); }

/* ── Kommentare ──────────────────────────────────────────────────────────── */
.fi-sp-kommentare {
  margin-top: 11px; padding-top: 11px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.055);
  animation: fiSpAufklappen 300ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpAufklappen {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-kommentar { display: flex; gap: 9px; margin-bottom: 9px; }
.fi-sp-kommentar-blase {
  margin: 0; padding: 9px 13px; border-radius: 5px 16px 16px 16px;
  background: linear-gradient(158deg, rgba(241,245,249,.9), rgba(226,232,240,.62));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(15,23,42,.045);
  font-size: 13px; line-height: 1.52; color: var(--fi-text-leise, #334155);
  overflow-wrap: anywhere;
}
.fi-sp-kommentar-blase b { font-weight: 700; color: var(--fi-text, #0f172a); margin-right: 4px; }
.fi-sp-kommentar-zeit { font-size: 10.5px; color: var(--fi-text-still, #64748b); margin: 3px 0 0 13px; }
.fi-sp-kommentar-neu { display: flex; gap: 9px; align-items: center; }
.fi-sp-kommentar-feld {
  flex: 1 1 auto; height: 38px; padding: 0 15px; border: 0; outline: none;
  border-radius: 999px; background: rgba(15,23,42,.045);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.05);
  font-size: 13px; color: var(--fi-text, #1e293b); font-family: inherit;
  transition: box-shadow 200ms, background 200ms;
}
.fi-sp-kommentar-feld:focus {
  background: rgba(255,255,255,.9);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.32), 0 0 0 4px rgba(37,99,235,.09);
}

/* ── Bild im Beitrag ─────────────────────────────────────────────────────── */
.fi-sp-bild {
  display: block; width: 100%; margin-top: 12px;
  border-radius: 16px; object-fit: cover; max-height: 520px;
  box-shadow:
    inset 0 0 0 1px rgba(15,23,42,.07),
    0 10px 26px -18px rgba(11,18,38,.4);
}
.fi-sp-bildvorschau { position: relative; margin-top: 12px; }
.fi-sp-bildvorschau img {
  display: block; width: 100%; max-height: 260px; object-fit: cover;
  border-radius: 16px; box-shadow: inset 0 0 0 1px rgba(15,23,42,.07);
}
.fi-sp-bildvorschau button {
  position: absolute; top: 9px; right: 9px;
  width: 30px; height: 30px; border: 0; cursor: pointer; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(7,11,22,.55); color: #fff;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px -4px rgba(11,18,38,.5);
}
.fi-sp-bildknopf {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 9px 14px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; color: var(--fi-text-still, #64748b);
  background: rgba(15,23,42,.04);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.05);
  transition: background 180ms, color 180ms, box-shadow 200ms, transform 160ms;
}
.fi-sp-bildknopf:hover {
  background: rgba(37,99,235,.08); color: var(--fi-primaer, #1d4ed8);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.2);
  transform: translateY(-1px);
}

/* ── Akten-Chip ──────────────────────────────────────────────────────────── */
.fi-sp-aktechip {
  display: flex; align-items: center; gap: 11px; margin-top: 12px;
  padding: 11px 13px; border-radius: 16px; text-decoration: none;
  background: linear-gradient(158deg, rgba(59,130,246,.09), rgba(29,78,216,.03));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.7),
    inset 0 0 0 1px rgba(37,99,235,.16);
  transition: box-shadow 240ms, transform 200ms cubic-bezier(.32,.72,0,1);
}
a.fi-sp-aktechip:hover {
  transform: translateY(-1.5px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.8),
    inset 0 0 0 1px rgba(37,99,235,.34),
    0 12px 26px -14px rgba(29,78,216,.5);
}
.fi-sp-aktechip-wahl {
  background: rgba(15,23,42,.028);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.07);
}
.fi-sp-aktechip-marke {
  width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--fi-primaer, #1d4ed8);
  background: rgba(37,99,235,.1);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.6);
}
.fi-sp-aktechip b {
  display: block; font-size: 12.5px; font-weight: 700;
  color: var(--fi-primaer, #1d4ed8);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -.01em;
}
.fi-sp-aktechip-hinweis {
  display: block; font-size: 11px; color: var(--fi-text-still, #64748b); margin-top: 1px;
}
.fi-sp-aktechip-pfeil { color: var(--fi-text-still, #94a3b8); flex-shrink: 0; }
.fi-sp-aktechip-weg {
  flex-shrink: 0; width: 25px; height: 25px; border: 0; cursor: pointer;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,.06); color: var(--fi-text-still, #64748b);
}

/* ── Aktensuche ──────────────────────────────────────────────────────────── */
.fi-sp-aktesuche { position: relative; margin-bottom: 10px; }
.fi-sp-aktesuche-feld {
  width: 100%; height: 40px; padding: 0 15px; border: 0; outline: none;
  border-radius: 999px; background: rgba(15,23,42,.04);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.05);
  font-size: 13px; color: var(--fi-text, #1e293b); font-family: inherit;
  transition: box-shadow 200ms, background 200ms;
}
.fi-sp-aktesuche-feld:focus {
  background: rgba(255,255,255,.92);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.32), 0 0 0 4px rgba(37,99,235,.09);
}
.fi-sp-aktesuche-liste {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20;
  border-radius: 16px; overflow: hidden; padding: 6px;
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(26px) saturate(190%); -webkit-backdrop-filter: blur(26px) saturate(190%);
  box-shadow:
    0 26px 56px -26px rgba(11,18,38,.5),
    inset 0 1px 0 rgba(255,255,255,.9),
    inset 0 0 0 1px rgba(15,23,42,.07);
  animation: fiSpListeAuf 220ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpListeAuf {
  from { opacity: 0; transform: translateY(-8px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-aktesuche-zeile {
  width: 100%; display: flex; align-items: baseline; gap: 8px;
  padding: 9px 11px; border: 0; cursor: pointer; border-radius: 11px;
  background: none; text-align: left; transition: background 160ms;
}
.fi-sp-aktesuche-zeile:hover { background: rgba(37,99,235,.08); }
.fi-sp-aktesuche-zeile b { font-size: 13px; font-weight: 600; color: var(--fi-text, #1e293b); }
.fi-sp-aktesuche-zeile span {
  margin-left: auto; font-size: 11px; color: var(--fi-text-still, #64748b);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ── „Neue Beiträge"-Pille ───────────────────────────────────────────────── */
.fi-sp-pill {
  position: sticky; top: 74px; z-index: 30;
  display: flex; align-items: center; gap: 7px; margin: 0 auto 12px;
  padding: 10px 18px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 12.5px; font-weight: 700; color: #fff;
  background: linear-gradient(178deg, #2563eb, #1d4ed8 60%, #1e40af);
  box-shadow:
    0 16px 34px -14px rgba(29,78,216,.78),
    0 2px 6px -2px rgba(29,78,216,.5),
    inset 0 1px 0 rgba(255,255,255,.28);
  animation: fiSpPillAuf 420ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpPillAuf {
  from { opacity: 0; transform: translateY(-16px) scale(.86); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-pill:hover { filter: brightness(1.08); transform: translateY(-1px); }

/* ── Seitenspalten ───────────────────────────────────────────────────────── */
.fi-sp-profil { text-align: center; }
.fi-sp-profil .fi-sp-avatar { margin: 0 auto 10px; }
.fi-sp-profil-name {
  font-size: 15px; font-weight: 700; color: var(--fi-text, #0f172a);
  margin: 0; letter-spacing: -.01em;
}
.fi-sp-profil-rolle { font-size: 11.5px; color: var(--fi-text-still, #64748b); margin: 2px 0 0; }
.fi-sp-profil-zahlen {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  margin-top: 14px; padding-top: 14px; box-shadow: inset 0 1px 0 rgba(15,23,42,.06);
}
.fi-sp-profil-zahlen b {
  display: block; font-size: 18px; font-weight: 700; color: var(--fi-text, #0f172a);
  font-variant-numeric: tabular-nums; line-height: 1.2; letter-spacing: -.02em;
}
.fi-sp-profil-zahlen span {
  display: block; font-size: 10px; color: var(--fi-text-still, #64748b); line-height: 1.35;
}
.fi-sp-seiten-titel {
  font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--fi-text-still, #64748b); margin: 0 0 6px;
}
.fi-sp-seiten-datum {
  font-size: 14px; font-weight: 700; color: var(--fi-text, #0f172a);
  margin: 0 0 6px; letter-spacing: -.01em;
}
.fi-sp-seiten-text {
  font-size: 12px; color: var(--fi-text-still, #64748b); line-height: 1.58; margin: 0;
}

/* ── Angepinntes: eine Leiste, keine Kartenwand ──────────────────────────── */
.fi-sp-pinleiste {
  margin-bottom: 12px; border-radius: 18px; overflow: hidden;
  background: linear-gradient(158deg, rgba(255,255,255,.74), rgba(255,255,255,.56));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 10px 26px -18px rgba(11,18,38,.4),
    inset 0 1px 0 rgba(255,255,255,.9),
    inset 0 0 0 1px rgba(37,99,235,.14);
}
.fi-sp-pinzeile + .fi-sp-pinzeile { box-shadow: inset 0 1px 0 rgba(15,23,42,.06); }
.fi-sp-pinknopf {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 11px 15px; border: 0; cursor: pointer; background: none; text-align: left;
  color: var(--fi-primaer, #1d4ed8);
  transition: background 160ms;
}
.fi-sp-pinknopf:hover { background: rgba(37,99,235,.05); }
.fi-sp-pintext {
  flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px; font-weight: 650; color: var(--fi-text-leise, #334155);
}
.fi-sp-pinpfeil { transition: transform 240ms cubic-bezier(.32,.72,0,1); }
.fi-sp-pinzeile[data-offen="1"] .fi-sp-pinpfeil { transform: rotate(180deg); }
.fi-sp-pininhalt {
  padding: 0 15px 14px 36px;
  animation: fiSpAufklappen 260ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-pinloesen {
  margin-top: 9px; background: none; border: 0; cursor: pointer; padding: 0;
  font-size: 11.5px; font-weight: 650; color: var(--fi-text-still, #64748b);
}
.fi-sp-pinloesen:hover { color: var(--fi-primaer, #1d4ed8); text-decoration: underline; }
@media (max-width: 639px) { .fi-sp-pinleiste { border-radius: 0; } }

/* ── Systemavatar: dieselbe Kachel wie das Favicon ───────────────────────── */
.fi-sp-systemavatar {
  flex-shrink: 0; border-radius: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(158deg, #14264f, #0a1a3c 62%, #071129);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 0 0 1px rgba(255,255,255,.07),
    0 6px 16px -8px rgba(7,17,41,.7);
}

/* ── Kennmarke je Beitragsart ────────────────────────────────────────────── */
.fi-sp-artmarke {
  flex-shrink: 0; font-size: 10px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase;
  opacity: .8; white-space: nowrap;
}
@media (max-width: 479px) { .fi-sp-artmarke { display: none; } }

.fi-sp-bearbeitet { color: #94a3b8; font-style: italic; }

/* ── Beitragsmenü ────────────────────────────────────────────────────────── */
.fi-sp-postmenue { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.fi-sp-postmenue-knopf {
  background: none; border: 0; cursor: pointer; border-radius: 8px;
  padding: 5px 8px; font-size: 11.5px; font-weight: 600;
  color: var(--fi-text-still, #64748b);
  transition: background 160ms, color 160ms;
}
.fi-sp-postmenue-knopf:hover { background: rgba(15,23,42,.05); color: var(--fi-text, #0f172a); }
.fi-sp-postmenue-weg:hover { background: rgba(185,28,28,.07); color: #b91c1c; }

/* ── Bearbeiten ──────────────────────────────────────────────────────────── */
.fi-sp-bearbeiten { margin-top: 2px; }
.fi-sp-bearbeiten-feld {
  width: 100%; resize: none; outline: none; border: 0;
  padding: 11px 13px; border-radius: 14px;
  background: rgba(255,255,255,.7);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.24), 0 0 0 4px rgba(37,99,235,.07);
  font-size: 14.5px; line-height: 1.6; font-family: inherit;
  color: var(--fi-text, #0f172a);
}

/* ── Kommentare: Antworten und Aktionen ──────────────────────────────────── */
.fi-sp-kommentar-tat {
  background: none; border: 0; cursor: pointer; padding: 0;
  margin-left: 10px; font-size: 10.5px; font-weight: 700;
  color: var(--fi-text-still, #94a3b8);
  transition: color 160ms;
}
.fi-sp-kommentar-tat:hover { color: var(--fi-primaer, #1d4ed8); }
/* Eine Ebene Einzug, markiert durch eine Haarlinie — nicht durch Farbe:
   Eine zweite Flächenfarbe im Feed macht ihn unruhig. */
.fi-sp-antworten {
  margin: 0 0 4px 37px; padding-left: 12px;
  box-shadow: inset 2px 0 0 rgba(15,23,42,.07);
}
.fi-sp-mehr-kommentare {
  background: none; border: 0; cursor: pointer; padding: 4px 0 9px;
  font-size: 12px; font-weight: 650; color: var(--fi-primaer, #1d4ed8);
}
.fi-sp-mehr-kommentare:hover { text-decoration: underline; }
.fi-sp-antwort-hinweis {
  font-size: 11.5px; color: var(--fi-text-still, #64748b); margin: 0 0 6px 37px;
}
.fi-sp-antwort-hinweis b { color: var(--fi-text-leise, #475569); }

.fi-sp-fehler {
  padding: 12px 15px; border-radius: 15px; margin-bottom: 12px;
  background: linear-gradient(158deg, rgba(217,119,6,.1), rgba(217,119,6,.04));
  box-shadow: inset 0 0 0 1px rgba(217,119,6,.2);
  color: #b45309; font-size: 12.5px; font-weight: 600; line-height: 1.5;
}
.fi-sp-leer { text-align: center; padding: 40px 0; font-size: 13px; color: var(--fi-text-still, #64748b); }
.fi-sp-leer-karte { text-align: center; padding: 36px 24px; }
.fi-sp-leer-titel { font-size: 15px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 0; }
.fi-sp-leer-text {
  font-size: 13px; color: var(--fi-text-still, #64748b); line-height: 1.62; margin: 7px 0 0;
}
.fi-sp-ende {
  text-align: center; padding: 28px 0 44px;
  font-size: 12px; color: var(--fi-text-still, #94a3b8);
}

/* Wer Bewegung abgestellt hat, bekommt keine. Die Tiefe bleibt — sie ist
   Gestaltung, keine Animation. */
@media (prefers-reduced-motion: reduce) {
  .fi-sp-post, .fi-sp-zaehler, .fi-sp-komposer-fuss, .fi-sp-kommentare,
  .fi-sp-pill, .fi-sp-aktesuche-liste, .fi-sp-reaktion[data-an="1"]::before {
    animation: none !important;
  }
  .fi-sp-reaktion, .fi-sp-senden, .fi-sp-komposer, .fi-sp-post,
  .fi-sp-aktechip, .fi-sp-bildknopf { transition: none !important; }
  .fi-sp-post:hover { transform: none; }
}
`;
