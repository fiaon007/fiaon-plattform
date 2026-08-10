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
 * Ein generischer Aufwärtspfeil mit zwei Funken. Der Vorgesetzte: „Warum hat
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

function SystemAvatar({ size = 44 }: { size?: number }) {
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
 * Der Space — für Team UND Vorgesetzter.
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
  // ── MAX ZWEI, AUCH WENN MEHR IN DER DATENBANK STEHEN ──────────────────
  // Die Grenze gilt seit Paket 7 beim ANPINNEN — drei ältere Zeilen stehen
  // trotzdem noch angepinnt in der Datenbank, und die Leiste war deshalb
  // 140 px hoch statt der geforderten 56.
  //
  // Die Anzeige begrenzt jetzt selbst. Die alten Zeilen werden NICHT
  // stillschweigend gelöst: Wer sie angepinnt hat, hat es gemeint, und ein
  // Datenbestand, den die Oberfläche eigenmächtig ändert, ist schlimmer als
  // eine Leiste, die zwei von drei zeigt. Die neuesten zwei gewinnen.
  const angepinnte = alle.filter((p) => p.angepinnt).slice(0, 2);
  const posts = alle.filter((p) => !p.angepinnt);
  const ich = daten?.ich;

  // ── EINE OBERFLÄCHE, ZWEI TÜREN ───────────────────────────────────────────
  // Unter /admin/space liegt die Admin-Hülle schon außen herum (die Route ist
  // über `admin(…)` eingehängt). Ein zusätzliches AgentShell würde den
  // Vorgesetzter hinauswerfen — er hat kein Agent-Konto, und die Team-Hülle
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
            {/* 72 px: die Profil-Blase ist die einzige Stelle, an der das
                Gesicht groß sein darf. Im Feed sind es 44. */}
            <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={72} />
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
          {/* Auf schmalen Geräten stehen die Zahlen ÜBER dem Feed — dort
              fallen die Seitenspalten weg, und ohne sie wüsste niemand,
              wie der Tag läuft. */}
          {(daten?.tageszahlen ?? []).length > 0 && (
            <div className="fi-sp-tageskopf">
              {daten.tageszahlen.map((z: any) => (
                <div key={z.titel} className="fi-sp-kachel">
                  <p className="fi-sp-kachel-wert">{z.wert}</p>
                  <p className="fi-sp-kachel-titel">{z.titel}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Angepinntes: eine schmale Leiste ──────────────────────── */}
          {angepinnte.length > 0 && (
            <div className="fi-sp-pinleiste">
              <div className="fi-sp-pinreihe">
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
            </div>
          )}

          {/* Komposer — als einladende Karte, nicht als Formular. */}
          <div className={`fi-sp-karte fi-sp-komposer ${gross ? "fi-sp-komposer-gross" : ""}`}>
            <div className="fi-sp-komposer-kopf">
              <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={44} />
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
                  : <Avatar src={p.autorAvatar} name={p.autorName ?? "FIAON"} size={44} />}
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
                {/* ── KEINE INLINE-FARBE MEHR ─────────────────────────────
                    Die Marke trug `style={{ color: ART_MARKE[…].ton }}` —
                    Töne wie #64748b und #059669, die aus der Zeit stammen,
                    als die Marke keine Fläche hatte. Auf dem blauen Verlauf
                    der v5-Marke war „GEDANKE DES TAGES" in Grauton praktisch
                    unlesbar; gemessen im Schnappschuss.

                    Die Hausregel gilt auch hier: Wer eine dunkle Fläche
                    trägt, bringt seine Schriftfarbe selbst mit — weiß, aus
                    dem CSS. Die Töne bleiben als Datenfeld erhalten (andere
                    Stellen nutzen sie), nur hier gilt sie nicht mehr. */}
                {p.autoArt && ART_MARKE[p.autoArt] && (
                  <span className="fi-sp-artmarke">
                    {ART_MARKE[p.autoArt].titel}
                  </span>
                )}

                {/* Eigene Beiträge: ändern (15 Min) und zurücknehmen.
                    Leitung und Vorgesetzter dürfen jeden Beitrag entfernen. */}
                {(p.meiner || daten?.darfVerwalten) && (
                  <div className="fi-sp-postmenue">
                    {p.meiner && p.bearbeitbarBis && new Date(p.bearbeitbarBis) > new Date() && (
                      <button type="button" onClick={() => { setBearbeite(p.id); setBearbeiteText(p.text); }}
                              className="fi-sp-postmenue-knopf">Ändern</button>
                    )}
                    <button type="button" onClick={() => setLoesche(loesche?.id === p.id ? null : p)}
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

              {/* ── DIE FRAGE STEHT DA, WO SIE GESTELLT WURDE ──────────────
                  In v3 öffnete „Entfernen" einen Dialog am Seitenende. Der
                  Vorgesetzter musste scrollen, um eine Frage zu beantworten,
                  die er oben gestellt hatte — und sah dabei die Karte nicht
                  mehr, über die er entscheidet. Jetzt kippt die Karte selbst
                  in den Bestätigungszustand. */}
              {loesche?.id === p.id && (
                <div className="fi-sp-bestaetigung">
                  <p className="fi-sp-bestaetigung-titel">
                    {p.meiner ? "Beitrag zurücknehmen?" : "Beitrag entfernen?"}
                  </p>
                  <p className="fi-sp-bestaetigung-text">
                    {p.meiner
                      ? "Er verschwindet aus dem Feed. Reaktionen und Kommentare darauf verschwinden mit."
                      : "Er verschwindet für alle. Das wird protokolliert — mit deinem Namen."}
                  </p>
                  <div className="fi-sp-bestaetigung-knoepfe">
                    <button type="button" onClick={() => setLoesche(null)}
                            className="text-[12.5px] font-semibold text-slate-500">
                      Behalten
                    </button>
                    <button type="button" onClick={() => void entfernen(p.id)}
                            className="ml-auto fi-knopf-gefahr fi-knopf-gefahr-voll px-4"
                            style={{ minHeight: 38, fontSize: 12.5 }}>
                      {p.meiner ? "Zurücknehmen" : "Entfernen"}
                    </button>
                  </div>
                </div>
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
        {/* ── RECHTS: ECHTE ZAHLEN ────────────────────────────────────────
            Hier standen zwei Karten ohne eine einzige Zahl: „HEUTE ·
            Sonntag, 9. August · Was hier steht, kommt aus echten Zahlen"
            und „DER RAUM: keine Kundendaten hier" — die Hausordnung, die
            schon am Schreibfeld steht. Der Vorgesetzte hat beide zu Recht
            gestrichen. Jetzt löst die Spalte das Versprechen ein. */}
        <aside className="fi-sp-seite fi-sp-rechts">
          <div className="fi-sp-karte fi-sp-tag">
            <p className="fi-sp-tag-datum">
              {new Date().toLocaleDateString("de-DE", {
                weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin",
              })}
            </p>
            <div className="fi-sp-tag-zahlen">
              {(daten?.tageszahlen ?? []).map((z: any) => (
                <div key={z.titel} className="fi-sp-tag-zeile">
                  <span className="fi-sp-tag-wert">{z.wert}</span>
                  <span className="fi-sp-tag-titel">{z.titel}</span>
                  {z.hinweis && <span className="fi-sp-tag-hinweis">{z.hinweis}</span>}
                </div>
              ))}
              {(daten?.tageszahlen ?? []).length === 0 && (
                <p className="fi-sp-seiten-text">Die Zahlen des Tages werden geladen …</p>
              )}
            </div>
          </div>

          {/* Auf mittleren Bildschirmen wandert das Profil hierher — sonst
              wäre es ganz weg, sobald die linke Spalte fällt. */}
          <div className="fi-sp-karte fi-sp-profil fi-sp-profil-rechts">
            <Avatar src={ich?.avatar ?? null} name={ich?.name ?? ich?.vorname ?? "?"} size={48} />
            <p className="fi-sp-profil-name">{ich?.name ?? ich?.vorname ?? ""}</p>
            <p className="fi-sp-profil-rolle">{daten?.darfVerwalten ? "Vertriebsleitung" : "Team"}</p>
          </div>
        </aside>
      </div>
    </>
  );

  return alsAdmin ? inhalt : <AgentShell>{inhalt}</AgentShell>;
}

const SPACE_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   SPACE V5 — DIE BLASEN-BÜHNE

   ── WARUM V4 DUNKEL WAR UND WARUM DAS FALSCH WAR ─────────────────────────
   V4 legte den Space auf ein deckendes Navy. Der Gedanke: eine „Premium-
   Bühne", die den Feed vom hellen Rest des Systems abhebt.

   Zwei Fehler darin. Erstens verdeckte die deckende Fläche das
   Hintergrundvideo vollständig — genau das, was der Vorgesetzte auf jeder
   Seite sehen wollte. Zweitens ist Dunkel für einen FEED die falsche
   Richtung: Der Space enthält Fließtext, Kommentare, Antworten. Hell auf
   Dunkel ermüdet über längere Absätze, und man liest hier nicht drei Zahlen,
   sondern Sätze.

   V5 macht es umgekehrt: Das VIDEO ist die Bühne, der Inhalt schwebt als
   helle Glasblasen darüber. Dunkel bleibt genau EIN Element — der
   FIAON-Systemavatar. Dadurch entsteht der Kontrast, den v4 mit der ganzen
   Fläche erzwingen wollte.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. BÜHNE: Video plus sanfter Verlauf, kein Vollton ──────────────────── */
/* Dieselbe Bühne, die auch die Mail-Zentrale trägt — der Verlauf steht in
   fiaon-blase.css als „.fi-blasenbuehne". Hier wird er auf die HÜLLEN
   gelegt, weil der Space nicht selbst die Seitenfläche ist. */
body:has(.fi-sp-buehne) .agent-ambient,
body:has(.fi-sp-buehne) .admin-flaeche {
  background: linear-gradient(178deg,
    rgba(255,255,255,.85) 0%,
    rgba(241,246,254,.76) 46%,
    rgba(219,232,251,.65) 100%);
  background-attachment: fixed;
}

/* Der Space schaltet die helle Wäsche des Raums ab: Er bringt seinen eigenen
   Verlauf mit, und zwei Wäschen übereinander ergäben milchiges Grau. */
body:has(.fi-sp-buehne) .fi-raum-waesche { display: none; }

/* Die Breitengrenze der Hüllen aufheben — sonst kann der Feed nie 720 px
   plus zwei Seitenspalten tragen. Gemessen: Die Team-Hülle rendert
   „max-w-6xl" (1152 px), der Verwaltungsbereich eine eigene Variable. */
body:has(.fi-sp-buehne) main[class*="max-w-"],
body:has(.fi-sp-buehne) .admin-flaeche [class*="max-w-"] {
  max-width: none; padding-left: 0; padding-right: 0;
}

/* ── 5. + 7. RASTER: Feed 720 px mittig, 32 px Luft unter der Kopfzeile ──── */
.fi-sp-buehne {
  position: relative;
  display: grid;
  grid-template-columns: 260px minmax(480px, 720px) 280px;
  gap: 20px;
  align-items: start;
  justify-content: center;
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 20px 0;
  perspective: 1600px;
  perspective-origin: 50% 0%;
}
.fi-sp-buehne > * { position: relative; z-index: 1; }
.admin-flaeche .fi-sp-buehne { padding-top: 40px; }

.fi-sp-seite { position: sticky; top: 92px; display: flex; flex-direction: column; gap: 20px; }
.fi-sp-links { justify-self: stretch; }
.fi-sp-rechts { justify-self: stretch; }

@media (max-width: 1340px) {
  /* Zwei Spalten: Der Feed behält seine Breite, das Profil wandert nach rechts. */
  .fi-sp-buehne { grid-template-columns: minmax(480px, 720px) 280px; }
  .fi-sp-links { display: none; }
}
/* ── DER VERWALTUNGSBEREICH VERLIERT 240 PX AN SEINE SEITENLEISTE ─────────
   Gemessen: Bei 1440 px Fenster blieb der Feed dort bei 580 px statt 720,
   weil 260 + 720 + 280 + Abstände (1320) in den verbleibenden 1200 nicht
   passen. Die Media-Query fragt das FENSTER, nicht den verfügbaren Platz —
   deshalb hier eine eigene Schwelle für den Verwaltungsbereich. */
@media (max-width: 1580px) {
  .admin-flaeche .fi-sp-buehne { grid-template-columns: minmax(480px, 720px) 280px; }
  .admin-flaeche .fi-sp-links { display: none; }
}
@media (max-width: 1300px) {
  .admin-flaeche .fi-sp-buehne { grid-template-columns: minmax(0, 720px); }
  .admin-flaeche .fi-sp-seite { display: none; }
}
@media (max-width: 1060px) {
  .fi-sp-buehne { grid-template-columns: minmax(0, 720px); }
  .fi-sp-seite { display: none; }
}
@media (max-width: 639px) {
  /* 380 px: randnah, 12 px. App-Gefühl. */
  .fi-sp-buehne { gap: 0; margin: -12px 0 0; padding: 16px 12px 0; perspective: none; }
}

/* ── 2. DIE BLASE ────────────────────────────────────────────────────────
   Radius 28, Glas mit 20 px Weichzeichnung, Fläche 72 % Weiß, Haarlinie
   oben als Lichtkante, zweistufiger Blau-Schatten. */
/* ── DIE BLASE KOMMT AUS fiaon-blase.css ─────────────────────────────────
   Radius 28, Glas mit 20 px Weichzeichnung, Fläche 72 % Weiß, Haarlinie oben,
   zweistufiger Blau-Schatten — die Werte stehen an EINER Stelle, damit die
   Mail-Zentrale und die Kundenschublade dieselben tragen.

   Hier bleibt nur, was den Space von den anderen unterscheidet. */
.fi-sp-karte {
  position: relative;
  border-radius: var(--fi-blase-radius);
  padding: var(--fi-blase-innen);
  background: var(--fi-blase-flaeche);
  backdrop-filter: blur(var(--fi-blase-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--fi-blase-blur)) saturate(160%);
  box-shadow: var(--fi-blase-schatten);
  /* Nur der Space braucht das: Beiträge kommen dem Zeiger auf einer
     perspective-Bühne entgegen. */
  transform-style: preserve-3d;
}
.fi-sp-karte::before {
  content: ""; position: absolute; inset: 0 0 auto; height: 1px;
  border-radius: var(--fi-blase-radius) var(--fi-blase-radius) 0 0;
  background: linear-gradient(90deg,
    transparent, rgba(255,255,255,.9) 22%, rgba(255,255,255,1) 50%,
    rgba(255,255,255,.9) 78%, transparent);
  pointer-events: none;
}
@media (max-width: 639px) {
  .fi-sp-karte { border-radius: 22px; padding: 18px; }
}

/* ── 3. AKZENT-VERLAUF ─────────────────────────────────────────────────── */
.fi-sp-artmarke {
  flex-shrink: 0; font-size: 10px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; white-space: nowrap;
  padding: 4px 10px; border-radius: 999px;
  /* !important, weil hier über Jahre Inline-Töne standen. Eine Fläche, die
     ihre Schriftfarbe nicht durchsetzt, wird irgendwann unlesbar. */
  color: #fff !important;
  background: linear-gradient(158deg, #3b82f6, #1d4ed8);
  box-shadow: 0 4px 12px -6px rgba(29,78,216,.7), inset 0 1px 0 rgba(255,255,255,.3);
}
@media (max-width: 419px) { .fi-sp-artmarke { display: none; } }

/* ── 2. AVATAR: rund 44 px mit Verlaufs-Ring ───────────────────────────── */
.fi-sp-avatar {
  border-radius: 999px; object-fit: cover; flex-shrink: 0;
  /* Der Ring ist ein Verlauf, kein Rand: Ein einfarbiger Rand wirkt flach,
     ein Verlauf fängt Licht. */
  box-shadow:
    0 0 0 2px rgba(255,255,255,.95),
    0 0 0 3.5px rgba(59,130,246,.42),
    0 4px 12px -4px rgba(29,78,216,.4);
}
.fi-sp-avatar-text {
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff; letter-spacing: -.02em;
  background: linear-gradient(158deg, #60a5fa, #1d4ed8 66%, #1e40af);
}

/* Der Systemavatar: das EINZIGE dunkle Element. Daher der Premium-Kontrast. */
.fi-sp-systemavatar {
  flex-shrink: 0; border-radius: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(158deg, #14264f, #0a1a3c 62%, #071129);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    0 0 0 2px rgba(255,255,255,.9),
    0 6px 16px -6px rgba(7,17,41,.6);
}

/* ── 6. PIN-LEISTE: schmale Glasblase, im Ruhezustand nie über 56 px ────── */
.fi-sp-pinleiste {
  margin-bottom: 20px; border-radius: 22px; overflow: hidden;
  background: rgba(255,255,255,.66);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    0 2px 8px -2px rgba(29,78,216,.09),
    0 14px 34px -20px rgba(29,78,216,.22),
    inset 0 0 0 1px rgba(255,255,255,.85);
}
/* ── EINZEILIG IM RUHEZUSTAND ─────────────────────────────────────────────
   Die Spezifikation fordert „nie mehr als 56 px hoch im Ruhezustand" UND
   „max 2 angepinnte Titel". Zwei untereinander liegende Zeilen ergaben
   gemessen 94 px — beides gleichzeitig geht nur, wenn die zwei Titel
   NEBENEINANDER stehen.

   Also: Im Ruhezustand liegen beide Pins als schmale Chips in einer Reihe;
   ist einer aufgeklappt, wächst die Leiste. Auf schmalen Geräten wird daraus
   eine Wischleiste, statt dass die Titel umbrechen. */
.fi-sp-pinreihe {
  display: flex; align-items: stretch; gap: 0;
}
.fi-sp-pinzeile { min-width: 0; flex: 1 1 0; }
.fi-sp-pinzeile + .fi-sp-pinzeile { box-shadow: inset 1px 0 0 rgba(15,23,42,.07); }
/* Ist ein Pin offen, steht die Leiste wieder untereinander — der Inhalt
   braucht die ganze Breite. */
.fi-sp-pinreihe:has(.fi-sp-pinzeile[data-offen="1"]) { flex-direction: column; }
.fi-sp-pinreihe:has(.fi-sp-pinzeile[data-offen="1"]) .fi-sp-pinzeile + .fi-sp-pinzeile {
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
}
.fi-sp-pinknopf {
  width: 100%; display: flex; align-items: center; gap: 9px;
  /* 9 + 9 + 20 Zeilenhöhe + 2×1 Rahmen = 40 px. Eine Reihe bleibt damit weit
     unter den geforderten 56. */
  padding: 9px 14px; border: 0; cursor: pointer; background: none;
  text-align: left; color: var(--fi-primaer); transition: background 160ms;
  min-height: 40px;
}
.fi-sp-pinknopf:hover { background: rgba(37,99,235,.05); }
.fi-sp-pintext {
  flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 12.5px; font-weight: 650; color: var(--fi-text);
}
.fi-sp-pinpfeil { transition: transform 240ms cubic-bezier(.32,.72,0,1); }
.fi-sp-pinzeile[data-offen="1"] .fi-sp-pinpfeil { transform: rotate(180deg); }
.fi-sp-pininhalt {
  padding: 0 18px 16px 42px;
  animation: fiSpAufklappen 260ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-pinloesen {
  margin-top: 10px; background: none; border: 0; cursor: pointer; padding: 0;
  font-size: 11.5px; font-weight: 650; color: var(--fi-text-still);
}
.fi-sp-pinloesen:hover { color: var(--fi-primaer); text-decoration: underline; }

/* ── 4. KOMPOSER: große Blase, wächst beim Fokus ───────────────────────── */
.fi-sp-komposer {
  margin-bottom: 20px;
  transition: box-shadow 340ms cubic-bezier(.32,.72,0,1),
              transform 340ms cubic-bezier(.32,.72,0,1);
}
.fi-sp-komposer-gross {
  transform: translateZ(16px) scale(1.008);
  box-shadow:
    0 2px 8px -2px rgba(29,78,216,.14),
    0 30px 64px -24px rgba(29,78,216,.34),
    inset 0 0 0 1px rgba(147,197,253,.6);
}
.fi-sp-komposer-kopf { display: flex; align-items: flex-start; gap: 14px; }
.fi-sp-komposer-feld {
  flex: 1 1 auto; border: 0; outline: none; resize: none; background: none;
  font-size: 16px; line-height: 1.62; color: var(--fi-text);
  padding: 10px 0; min-height: 46px; font-family: inherit;
}
.fi-sp-komposer-feld::placeholder { color: var(--fi-text-still); }
.fi-sp-komposer-fuss {
  margin-top: 16px; padding-top: 16px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
  animation: fiSpAuf 300ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-komposer-knoepfe { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.fi-sp-hinweis { font-size: 11.5px; color: var(--fi-text-still); line-height: 1.55; margin: 0; }
.fi-sp-hinweis b { color: var(--fi-text-leise); font-weight: 650; }
.fi-sp-abbrechen {
  background: none; border: 0; cursor: pointer; padding: 8px 4px;
  font-size: 13px; font-weight: 600; color: var(--fi-text-still);
}
/* Veröffentlichen: Verlaufs-Fläche mit Glanzkante. */
.fi-sp-senden {
  margin-left: auto; padding: 11px 24px; border: 0; cursor: pointer;
  border-radius: 999px; font-size: 13.5px; font-weight: 700; color: #fff;
  background: linear-gradient(178deg, #3b82f6, #1d4ed8 58%, #1b429f);
  box-shadow:
    0 14px 30px -12px rgba(29,78,216,.68),
    inset 0 1px 0 rgba(255,255,255,.38);
  transition: transform 140ms cubic-bezier(.32,.72,0,1), box-shadow 200ms, filter 180ms;
}
.fi-sp-senden:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1.5px); }
.fi-sp-senden:active:not(:disabled) {
  transform: translateY(1px) scale(.985);
  box-shadow: inset 0 2px 5px rgba(9,20,56,.36);
}
.fi-sp-senden:disabled { opacity: .32; cursor: default; box-shadow: none; }

/* ── 2. EINTRITT: Aufsteigen plus Aufblühen, 450 ms ────────────────────── */
.fi-sp-post {
  margin-bottom: 20px;
  animation: fiSpBluehen 450ms cubic-bezier(.32,.72,0,1) both;
  transition: box-shadow 280ms cubic-bezier(.32,.72,0,1),
              transform 280ms cubic-bezier(.32,.72,0,1);
}
@keyframes fiSpBluehen {
  from { opacity: 0; transform: translateY(18px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
/* Hover Desktop: hebt 4 px, Schatten wächst. */
@media (min-width: 640px) {
  .fi-sp-post:hover {
    transform: translateY(-4px);
    box-shadow: var(--fi-blase-schatten-hoch);
  }
}
@keyframes fiSpAuf { from { opacity: 0 } to { opacity: 1 } }
@keyframes fiSpAufklappen {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}

.fi-sp-pin {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: var(--fi-primaer); margin: 0 0 10px;
}
.fi-sp-post-kopf { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.fi-sp-autor {
  font-size: 14.5px; font-weight: 700; color: var(--fi-text);
  margin: 0; line-height: 1.3; letter-spacing: -.01em;
}
.fi-sp-zeit { font-size: 11.5px; color: var(--fi-text-still); margin: 1px 0 0; }
.fi-sp-bearbeitet { color: var(--fi-text-still); font-style: italic; }
.fi-sp-text {
  font-size: 15px; line-height: 1.68; color: var(--fi-text-leise);
  margin: 0; white-space: pre-wrap; overflow-wrap: anywhere;
}
.fi-sp-text::first-line { font-weight: 650; color: var(--fi-text); }

/* ── 7. INTERAKTION AN DER KARTE (aus v4 übernommen) ───────────────────── */
.fi-sp-postmenue { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.fi-sp-postmenue-knopf {
  background: none; border: 0; cursor: pointer; border-radius: 9px;
  padding: 6px 10px; font-size: 11.5px; font-weight: 600; color: var(--fi-text-still);
  transition: background 160ms, color 160ms;
}
.fi-sp-postmenue-knopf:hover { background: rgba(15,23,42,.055); color: var(--fi-text); }
.fi-sp-postmenue-weg:hover { background: rgba(185,28,28,.08); color: #b91c1c; }

.fi-sp-bestaetigung {
  margin-top: 14px; padding: 15px 17px; border-radius: 20px;
  background: linear-gradient(158deg, rgba(185,28,28,.06), rgba(185,28,28,.02));
  box-shadow: inset 0 0 0 1px rgba(185,28,28,.18);
  animation: fiSpKippen 320ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpKippen {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-bestaetigung-titel { font-size: 13px; font-weight: 700; color: #b91c1c; margin: 0; }
.fi-sp-bestaetigung-text { font-size: 12.5px; line-height: 1.55; color: #7f1d1d; margin: 4px 0 0; }
.fi-sp-bestaetigung-knoepfe { display: flex; align-items: center; gap: 8px; margin-top: 13px; }

.fi-sp-bearbeiten { margin-top: 2px; }
.fi-sp-bearbeiten-feld {
  width: 100%; resize: none; outline: none; border: 0;
  padding: 13px 15px; border-radius: 18px;
  background: rgba(255,255,255,.9);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.28), 0 0 0 4px rgba(37,99,235,.08);
  font-size: 15px; line-height: 1.6; font-family: inherit; color: var(--fi-text);
}

/* ── 7. REAKTIONEN: der Zähler hüpft einmal ────────────────────────────── */
.fi-sp-reaktionen {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin-top: 16px; padding-top: 14px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
}
.fi-sp-reaktion {
  position: relative; overflow: hidden;
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 13px; border: 0; cursor: pointer; border-radius: 999px;
  color: var(--fi-text-still); background: transparent;
  transition: background 180ms, color 180ms, box-shadow 220ms,
              transform 160ms cubic-bezier(.32,.72,0,1);
}
.fi-sp-reaktion:hover { background: rgba(15,23,42,.05); color: var(--fi-text-leise); transform: translateY(-1.5px); }
.fi-sp-reaktion:active { transform: scale(.9); }
.fi-sp-reaktion[data-an="1"] {
  color: #fff;
  background: linear-gradient(158deg, #3b82f6, #1d4ed8);
  box-shadow: 0 6px 16px -8px rgba(29,78,216,.7), inset 0 1px 0 rgba(255,255,255,.32);
}
.fi-sp-zaehler {
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  /* Ein Federsprung: kurz über das Ziel hinaus, dann zurück. */
  animation: fiSpFeder 460ms cubic-bezier(.28,1.6,.4,1) both;
}
@keyframes fiSpFeder {
  0%   { transform: translateY(7px) scale(.55); opacity: 0 }
  58%  { transform: translateY(-3px) scale(1.24); opacity: 1 }
  100% { transform: none; opacity: 1 }
}
.fi-sp-kommentarknopf {
  margin-left: auto; background: none; border: 0; cursor: pointer;
  padding: 0 6px; height: 36px; font-size: 12.5px; font-weight: 600;
  color: var(--fi-text-still); transition: color 180ms;
}
.fi-sp-kommentarknopf:hover { color: var(--fi-primaer); }

/* ── Kommentare ───────────────────────────────────────────────────────── */
.fi-sp-kommentare {
  margin-top: 14px; padding-top: 14px;
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
  animation: fiSpAufklappen 300ms cubic-bezier(.32,.72,0,1) both;
}
.fi-sp-kommentar { display: flex; gap: 11px; margin-bottom: 11px; }
.fi-sp-kommentar-blase {
  margin: 0; padding: 11px 15px; border-radius: 6px 20px 20px 20px;
  background: rgba(241,246,254,.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), inset 0 0 0 1px rgba(15,23,42,.05);
  font-size: 13.5px; line-height: 1.55; color: var(--fi-text-leise); overflow-wrap: anywhere;
}
.fi-sp-kommentar-blase b { font-weight: 700; color: var(--fi-text); margin-right: 4px; }
.fi-sp-kommentar-zeit { font-size: 10.5px; color: var(--fi-text-still); margin: 3px 0 0 15px; }
.fi-sp-kommentar-tat {
  background: none; border: 0; cursor: pointer; padding: 0;
  margin-left: 11px; font-size: 10.5px; font-weight: 700; color: var(--fi-text-still);
  transition: color 160ms;
}
.fi-sp-kommentar-tat:hover { color: var(--fi-primaer); }
.fi-sp-antworten {
  margin: 0 0 5px 42px; padding-left: 14px;
  box-shadow: inset 2px 0 0 rgba(37,99,235,.16);
}
.fi-sp-mehr-kommentare {
  background: none; border: 0; cursor: pointer; padding: 4px 0 10px;
  font-size: 12px; font-weight: 650; color: var(--fi-primaer);
}
.fi-sp-mehr-kommentare:hover { text-decoration: underline; }
.fi-sp-antwort-hinweis { font-size: 11.5px; color: var(--fi-text-still); margin: 0 0 6px 42px; }
.fi-sp-antwort-hinweis b { color: var(--fi-text-leise); }
.fi-sp-kommentar-neu { display: flex; gap: 11px; align-items: center; }
.fi-sp-kommentar-feld {
  flex: 1 1 auto; height: 42px; padding: 0 17px; border: 0; outline: none;
  border-radius: 999px; background: rgba(241,246,254,.9);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.06);
  font-size: 13.5px; color: var(--fi-text); font-family: inherit;
  transition: box-shadow 200ms, background 200ms;
}
.fi-sp-kommentar-feld:focus {
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.34), 0 0 0 4px rgba(37,99,235,.1);
}

/* ── Bild, Akten-Chip, Aktensuche ─────────────────────────────────────── */
.fi-sp-bild {
  display: block; width: 100%; margin-top: 14px;
  border-radius: 20px; object-fit: cover; max-height: 560px;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.07), 0 12px 30px -20px rgba(29,78,216,.4);
}
.fi-sp-bildvorschau { position: relative; margin-top: 14px; }
.fi-sp-bildvorschau img {
  display: block; width: 100%; max-height: 280px; object-fit: cover;
  border-radius: 20px; box-shadow: inset 0 0 0 1px rgba(15,23,42,.07);
}
.fi-sp-bildvorschau button {
  position: absolute; top: 10px; right: 10px;
  width: 30px; height: 30px; border: 0; cursor: pointer; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(7,11,22,.55); color: #fff;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.fi-sp-bildknopf {
  display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
  padding: 9px 16px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; color: var(--fi-text-still);
  background: rgba(241,246,254,.9);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.06);
  transition: background 180ms, color 180ms, box-shadow 200ms, transform 160ms;
}
.fi-sp-bildknopf:hover {
  background: rgba(37,99,235,.09); color: var(--fi-primaer);
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.22); transform: translateY(-1px);
}
.fi-sp-aktechip {
  display: flex; align-items: center; gap: 12px; margin-top: 14px;
  padding: 13px 15px; border-radius: 20px; text-decoration: none;
  background: linear-gradient(158deg, rgba(59,130,246,.1), rgba(29,78,216,.035));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(37,99,235,.16);
  transition: box-shadow 240ms, transform 200ms cubic-bezier(.32,.72,0,1);
}
a.fi-sp-aktechip:hover {
  transform: translateY(-1.5px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9),
              inset 0 0 0 1px rgba(37,99,235,.34),
              0 14px 30px -16px rgba(29,78,216,.5);
}
.fi-sp-aktechip-wahl { background: rgba(241,246,254,.9); box-shadow: inset 0 0 0 1px rgba(15,23,42,.07); }
.fi-sp-aktechip-marke {
  width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; background: linear-gradient(158deg, #3b82f6, #1d4ed8);
  box-shadow: 0 4px 12px -6px rgba(29,78,216,.6), inset 0 1px 0 rgba(255,255,255,.28);
}
.fi-sp-aktechip b {
  display: block; font-size: 12.5px; font-weight: 700; color: var(--fi-primaer);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -.01em;
}
.fi-sp-aktechip-hinweis { display: block; font-size: 11px; color: var(--fi-text-still); margin-top: 1px; }
.fi-sp-aktechip-pfeil { color: var(--fi-text-still); flex-shrink: 0; }
.fi-sp-aktechip-weg {
  flex-shrink: 0; width: 26px; height: 26px; border: 0; cursor: pointer;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,.07); color: var(--fi-text-still);
}
.fi-sp-aktesuche { position: relative; margin-bottom: 12px; }
.fi-sp-aktesuche-feld {
  width: 100%; height: 44px; padding: 0 17px; border: 0; outline: none;
  border-radius: 999px; background: rgba(241,246,254,.9);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.06);
  font-size: 13.5px; color: var(--fi-text); font-family: inherit;
  transition: box-shadow 200ms, background 200ms;
}
.fi-sp-aktesuche-feld:focus {
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.34), 0 0 0 4px rgba(37,99,235,.1);
}
.fi-sp-aktesuche-liste {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20;
  border-radius: 20px; overflow: hidden; padding: 6px;
  background: rgba(255,255,255,.97);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 28px 60px -24px rgba(29,78,216,.42),
              inset 0 0 0 1px rgba(255,255,255,.95);
  animation: fiSpListeAuf 220ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpListeAuf {
  from { opacity: 0; transform: translateY(-8px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-aktesuche-zeile {
  width: 100%; display: flex; align-items: baseline; gap: 8px;
  padding: 10px 13px; border: 0; cursor: pointer; border-radius: 14px;
  background: none; text-align: left; transition: background 160ms;
}
.fi-sp-aktesuche-zeile:hover { background: rgba(37,99,235,.08); }
.fi-sp-aktesuche-zeile b { font-size: 13.5px; font-weight: 600; color: var(--fi-text); }
.fi-sp-aktesuche-zeile span {
  margin-left: auto; font-size: 11px; color: var(--fi-text-still);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ── Pille ────────────────────────────────────────────────────────────── */
.fi-sp-pill {
  position: sticky; top: 84px; z-index: 30;
  display: flex; align-items: center; gap: 7px; margin: 0 auto 20px;
  padding: 11px 21px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 12.5px; font-weight: 700; color: #fff;
  background: linear-gradient(178deg, #3b82f6, #1d4ed8 58%, #1b429f);
  box-shadow: 0 18px 38px -14px rgba(29,78,216,.7), inset 0 1px 0 rgba(255,255,255,.34);
  animation: fiSpPillAuf 420ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiSpPillAuf {
  from { opacity: 0; transform: translateY(-16px) scale(.86); }
  to   { opacity: 1; transform: none; }
}
.fi-sp-pill:hover { filter: brightness(1.08); transform: translateY(-1px); }

/* ── 5. SEITENSPALTEN ─────────────────────────────────────────────────── */
.fi-sp-profil { text-align: center; }
/* Avatar 72 px in der Profil-Blase. */
.fi-sp-profil .fi-sp-avatar { margin: 0 auto 13px; }
.fi-sp-profil-name { font-size: 16px; font-weight: 700; color: var(--fi-text); margin: 0; letter-spacing: -.015em; }
.fi-sp-profil-rolle { font-size: 11.5px; color: var(--fi-text-still); margin: 3px 0 0; }
.fi-sp-profil-zahlen {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-top: 17px; padding-top: 17px; box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
}
.fi-sp-profil-zahlen b {
  display: block; font-size: 20px; font-weight: 700; color: var(--fi-text);
  font-variant-numeric: tabular-nums; line-height: 1.2; letter-spacing: -.025em;
}
.fi-sp-profil-zahlen span { display: block; font-size: 10px; color: var(--fi-text-still); line-height: 1.35; }
.fi-sp-profil-rechts { padding: 20px; }
@media (min-width: 1341px) { .fi-sp-profil-rechts { display: none; } }

/* „Heute"-Blase mit Verlaufs-Kacheln. */
.fi-sp-tag-datum {
  font-size: 13.5px; font-weight: 700; color: var(--fi-text);
  margin: 0 0 15px; letter-spacing: -.01em;
  padding-bottom: 13px; box-shadow: inset 0 -1px 0 rgba(15,23,42,.07);
}
.fi-sp-tag-zahlen { display: grid; gap: 10px; }
.fi-sp-tag-zeile {
  display: block; padding: 12px 14px; border-radius: 16px;
  background: linear-gradient(158deg, rgba(59,130,246,.1), rgba(29,78,216,.035));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8), inset 0 0 0 1px rgba(37,99,235,.14);
}
.fi-sp-tag-wert {
  display: block; font-size: 22px; font-weight: 700; line-height: 1.1;
  font-variant-numeric: tabular-nums; letter-spacing: -.025em;
  background: linear-gradient(178deg, #1d4ed8 0%, #1e40af 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.fi-sp-tag-titel {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: .11em;
  text-transform: uppercase; color: var(--fi-primaer); margin-top: 4px; opacity: .78;
}
.fi-sp-tag-hinweis { display: block; font-size: 11px; color: var(--fi-text-still); margin-top: 2px; }
.fi-sp-seiten-titel {
  font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--fi-text-still); margin: 0 0 7px;
}
.fi-sp-seiten-text { font-size: 12.5px; color: var(--fi-text-still); line-height: 1.6; margin: 0; }

/* ── 5. 380 px: Kennzahlen als Wischleiste über dem Feed ───────────────── */
.fi-sp-tageskopf {
  display: flex; gap: 10px; margin-bottom: 20px;
  overflow-x: auto; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}
.fi-sp-tageskopf::-webkit-scrollbar { height: 0; }
.fi-sp-kachel {
  flex: 0 0 auto; min-width: 132px; scroll-snap-align: start;
  padding: 14px 16px; border-radius: 18px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow:
    0 2px 8px -2px rgba(29,78,216,.1),
    0 12px 28px -18px rgba(29,78,216,.24),
    inset 0 0 0 1px rgba(255,255,255,.9);
}
.fi-sp-kachel-wert {
  font-size: 21px; font-weight: 700; line-height: 1.15;
  font-variant-numeric: tabular-nums; letter-spacing: -.025em; margin: 0;
  background: linear-gradient(178deg, #1d4ed8, #1e40af);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
.fi-sp-kachel-titel {
  font-size: 10px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: var(--fi-primaer); margin: 3px 0 0; opacity: .78;
}
@media (min-width: 1061px) { .fi-sp-tageskopf { display: none; } }

/* ── Randfälle ────────────────────────────────────────────────────────── */
.fi-sp-fehler {
  padding: 14px 17px; border-radius: 18px; margin-bottom: 14px;
  background: rgba(254,243,199,.92);
  box-shadow: inset 0 0 0 1px rgba(217,119,6,.2);
  color: #78350f; font-size: 12.5px; font-weight: 600; line-height: 1.55;
}
.fi-sp-leer { text-align: center; padding: 44px 0; font-size: 13px; color: var(--fi-text-still); }
.fi-sp-leer-karte { text-align: center; padding: 42px 26px; }
.fi-sp-leer-titel { font-size: 16px; font-weight: 700; color: var(--fi-text); margin: 0; }
.fi-sp-leer-text { font-size: 13.5px; color: var(--fi-text-still); line-height: 1.62; margin: 8px 0 0; }
.fi-sp-ende { text-align: center; padding: 30px 0 48px; font-size: 12px; color: var(--fi-text-still); }

@media (prefers-reduced-motion: reduce) {
  .fi-sp-post, .fi-sp-zaehler, .fi-sp-komposer-fuss, .fi-sp-kommentare,
  .fi-sp-pill, .fi-sp-aktesuche-liste, .fi-sp-bestaetigung { animation: none !important; }
  .fi-sp-reaktion, .fi-sp-senden, .fi-sp-komposer, .fi-sp-post,
  .fi-sp-aktechip, .fi-sp-bildknopf { transition: none !important; }
  .fi-sp-post:hover { transform: none; }
}
`;
