// ═══════════════════════════════════════════════════════════════════════════
// DIE SUCHE DES CHEFBÜROS — ⌘K (E-336, 12.10.2026)
//
// Justin: „oben im Header das Suchen, was man auch mit Command und K machen
//          sollte — das geht nicht, das Suchfeld!"
//
// Das Feld im Kopf war seit dem 24.08. eine Attrappe („kommt in einer späteren
// Scheibe"). Jetzt öffnet es — per Klick oder ⌘K / Strg+K — diese Palette:
//
//   · SEITEN und RÄUME aus derselben Quelle wie Menü und Register
//     (chef-seiten.tsx, CHEF_RAEUME). Gesucht wird in Name, Erklärung und
//     Nebenworten; „ue" und „ü" sind dasselbe. Was die Stufe nicht öffnen darf,
//     erscheint gar nicht erst.
//   · MENSCHEN über GET /api/fiaon/chef/suche — Name, Mail, Telefon, Firma,
//     Referenz, Personen-Nummer. Ein Treffer öffnet die EINE Akte /akte/<id>.
//   · Ohne Eingabe: zuletzt Geöffnetes (nur in diesem Browser) und die Räume.
//
// Pfeiltasten wählen, Enter öffnet, Esc schließt. Die Palette hängt per Portal
// an <body>, damit kein Glas-Elternteil (backdrop-filter) sie einklemmt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Search, CornerDownLeft, UserRound, History, ArrowRight } from "lucide-react";
import { CHEF_SEITEN, chefPfad } from "./chef-seiten";
import type { ChefRaum, ChefStufe } from "./ChefShell";
import { akteLink } from "@/lib/akte-link";
import "@/styles/chefbuero-suche.css";

type Marke = { text: string; ton: "blau" | "grau" | "rot" | "gelb" };
interface Treffer {
  id: string;
  art: "raum" | "seite" | "kunde" | "mehr";
  titel: string;
  satz: string;
  ort?: string;
  pfad: string;
  /** Raum-Schlüssel — daraus kommt das Zeichen der Zeile. */
  raum?: string;
  marken?: Marke[];
  /** Nur intern für die Rangfolge. */
  wert?: number;
}
interface Person {
  id: number; name: string; firma: string | null; email: string | null; ort: string | null;
  ref: string | null; mitarbeiter: string | null;
  zahlend: boolean; interessent: boolean; gesperrt: boolean; inkasso: boolean;
}

const ZULETZT_SCHLUESSEL = "chef-suche-zuletzt";

// „Rückholung" soll auf „rueck", „rück" und „ruck" passen.
const ae = (t: string) => t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
const ohne = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
const heu = (t: string) => `${ae(t)} ${ohne(t)}`;
const trifft = (hay: string, wort: string) => hay.includes(ae(wort)) || hay.includes(ohne(wort));

function zuletztLesen(): Treffer[] {
  try {
    const roh = JSON.parse(window.localStorage.getItem(ZULETZT_SCHLUESSEL) || "[]");
    return Array.isArray(roh) ? roh.filter((t) => t && typeof t.pfad === "string" && typeof t.titel === "string").slice(0, 5) : [];
  } catch { return []; }
}
function zuletztMerken(t: Treffer) {
  try {
    const ohneDoppel = zuletztLesen().filter((z) => z.pfad !== t.pfad);
    const eintrag: Treffer = { id: `z-${t.pfad}`, art: t.art, titel: t.titel, satz: t.satz, ort: t.ort, pfad: t.pfad, raum: t.raum };
    window.localStorage.setItem(ZULETZT_SCHLUESSEL, JSON.stringify([eintrag, ...ohneDoppel].slice(0, 5)));
  } catch { /* privates Fenster — dann eben ohne Verlauf */ }
}

/** Hebt die getippten Wörter im Namen hervor (einfacher Vergleich, ohne Umlaut-Gleichsetzung). */
function hervor(text: string, woerter: string[]): ReactNode {
  const w = woerter.filter((x) => x.length >= 2).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!w.length) return text;
  const teile = text.split(new RegExp(`(${w.join("|")})`, "ig"));
  return teile.map((t, i) => (i % 2 === 1 ? <mark key={i}>{t}</mark> : t));
}

export function ChefSuche({ offen, schliessen, raeume, darf }: {
  offen: boolean;
  schliessen: () => void;
  raeume: ChefRaum[];
  /** Darf diese Stufe etwas mit dieser Mindeststufe öffnen? */
  darf: (mindest?: ChefStufe) => boolean;
}) {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [gesamt, setGesamt] = useState(0);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zuletzt, setZuletzt] = useState<Treffer[]>([]);
  const feld = useRef<HTMLInputElement | null>(null);
  const liste = useRef<HTMLDivElement | null>(null);

  // Beim Öffnen: leeres Feld, Fokus hinein, Verlauf frisch lesen. Beim Schließen
  // bekommt das Element den Fokus zurück, das vorher ihn hatte.
  useEffect(() => {
    if (!offen) return;
    const vorher = document.activeElement as HTMLElement | null;
    setQ(""); setAktiv(0); setPersonen(null); setFehler(null);
    setZuletzt(zuletztLesen());
    const t = window.setTimeout(() => feld.current?.focus(), 0);
    return () => { window.clearTimeout(t); vorher?.focus?.(); };
  }, [offen]);

  const woerter = useMemo(() => q.trim().split(/\s+/).filter(Boolean).slice(0, 6), [q]);

  // ── Menschen: erst tippen lassen, dann fragen; die ältere Frage wird abgebrochen.
  useEffect(() => {
    if (!offen) return;
    const text = q.trim();
    if (text.length < 2) { setPersonen(null); setGesamt(0); setLaedt(false); setFehler(null); return; }
    const ab = new AbortController();
    setLaedt(true);
    const t = window.setTimeout(() => {
      fetch(`/api/fiaon/chef/suche?q=${encodeURIComponent(text)}`, { credentials: "include", signal: ab.signal })
        .then(async (r) => {
          const j = await r.json().catch(() => null);
          if (r.status === 401 || r.status === 403) throw new Error("Bitte neu anmelden — dann sucht die Palette auch Kunden.");
          if (!j?.ok) throw new Error(j?.error || "Die Kundensuche antwortet gerade nicht.");
          setPersonen(j.personen || []); setGesamt(Number(j.gesamt || 0)); setFehler(null);
        })
        .catch((e) => { if (e?.name !== "AbortError") { setPersonen([]); setFehler(String(e?.message || "Keine Verbindung zum Server.")); } })
        .finally(() => { if (!ab.signal.aborted) setLaedt(false); });
    }, 180);
    return () => { window.clearTimeout(t); ab.abort(); };
  }, [q, offen]);

  // ── Alles, was diese Stufe öffnen darf: Räume und Seiten.
  const verzeichnis = useMemo<Treffer[]>(() => {
    const raumVon = new Map(raeume.map((r) => [r.key, r]));
    const r: Treffer[] = raeume.filter((x) => darf(x.mindest)).map((x) => ({
      id: `raum-${x.key}`, art: "raum" as const, titel: x.label, satz: x.satz, ort: "Raum",
      pfad: x.key === "lage" ? "/chef" : `/chef/${x.key}`, raum: x.key,
    }));
    const s: Treffer[] = CHEF_SEITEN
      .filter((x) => x.raum && x.slug !== "akte")
      .filter((x) => { const rm = raumVon.get(x.raum); return !!rm && darf(rm.mindest) && darf(x.mindest); })
      .map((x) => ({
        id: `seite-${x.slug}`, art: "seite" as const, titel: x.label, satz: x.satz,
        ort: raumVon.get(x.raum)?.label, pfad: chefPfad(x), raum: x.raum,
        // Die Nebenworte werden mitgesucht, aber nicht angezeigt.
        auch: x.auch ?? "",
      } as Treffer & { auch: string }));
    return [...r, ...s];
  }, [raeume, darf]);

  const seitenTreffer = useMemo<Treffer[]>(() => {
    if (!woerter.length) return [];
    const ganz = ae(q.trim());
    const bewertet: Treffer[] = [];
    verzeichnis.forEach((t, i) => {
      const titel = heu(t.titel);
      const auch = heu((t as any).auch ?? "");
      const satz = heu(t.satz);
      const ort = heu(t.ort ?? "");
      if (!woerter.every((w) => trifft(`${titel} ${auch} ${satz} ${ort}`, w))) return;
      let wert = ae(t.titel).startsWith(ganz) ? 100 : titel.includes(ganz) ? 70 : 0;
      for (const w of woerter) {
        if (trifft(titel, w)) wert += 20;
        if (trifft(auch, w)) wert += 8;
        if (trifft(ort, w)) wert += 5;
        if (trifft(satz, w)) wert += 2;
      }
      if (t.art === "raum") wert += 3;
      bewertet.push({ ...t, wert: wert - i / 1000 });
    });
    return bewertet.sort((a, b) => (b.wert ?? 0) - (a.wert ?? 0)).slice(0, 7);
  }, [woerter, q, verzeichnis]);

  const kundenTreffer = useMemo<Treffer[]>(() => {
    if (!personen) return [];
    const z: Treffer[] = personen.map((p) => {
      const marken: Marke[] = [];
      if (p.gesperrt) marken.push({ text: "Gesperrt", ton: "rot" });
      if (p.inkasso) marken.push({ text: "Inkasso", ton: "gelb" });
      if (p.zahlend) marken.push({ text: "Kunde", ton: "blau" });
      else if (p.interessent) marken.push({ text: "Interessent", ton: "grau" });
      else marken.push({ text: "Antrag", ton: "grau" });
      const satz = [p.firma && p.firma !== p.name ? p.firma : null, p.email, p.ort, p.ref].filter(Boolean).join(" · ");
      return {
        id: `kunde-${p.id}`, art: "kunde" as const, titel: p.name, satz: satz || `Person ${p.id}`,
        ort: p.mitarbeiter ? `bei ${p.mitarbeiter.split(" ")[0]}` : undefined,
        pfad: akteLink(p.id, "chef") ?? `/akte/${p.id}`, marken,
      };
    });
    if (gesamt > personen.length) {
      z.push({
        id: "mehr-kunden", art: "mehr", titel: `Alle ${gesamt.toLocaleString("de-DE")} Treffer in der Kundenliste`,
        satz: "Mit Filtern, Sortierung und Geldspalten.", pfad: `/chef/kundenliste?q=${encodeURIComponent(q.trim())}`, raum: "kundenliste",
      });
    }
    return z;
  }, [personen, gesamt, q]);

  // Abschnitte in der Reihenfolge, in der sie stehen — und die flache Liste für die Pfeiltasten.
  const abschnitte = useMemo(() => {
    if (!woerter.length) {
      const raeumeListe = verzeichnis.filter((t) => t.art === "raum");
      return [
        ...(zuletzt.length ? [{ key: "zuletzt", titel: "Zuletzt geöffnet", eintraege: zuletzt }] : []),
        { key: "raeume", titel: "Räume", eintraege: raeumeListe },
      ];
    }
    // Sieht die Eingabe nach einem Menschen aus (Ziffern, @, Referenz), kommen die Kunden zuerst.
    const kundenZuerst = /[@\d]|fiaon-/i.test(q);
    const seiten = { key: "seiten", titel: "Seiten", eintraege: seitenTreffer };
    const kunden = { key: "kunden", titel: "Kunden", eintraege: kundenTreffer };
    return (kundenZuerst ? [kunden, seiten] : [seiten, kunden]).filter((a) => a.eintraege.length > 0);
  }, [woerter.length, zuletzt, verzeichnis, q, seitenTreffer, kundenTreffer]);

  const flach = useMemo(() => abschnitte.flatMap((a) => a.eintraege), [abschnitte]);
  useEffect(() => { setAktiv(0); }, [q]);
  useEffect(() => { if (aktiv >= flach.length) setAktiv(Math.max(0, flach.length - 1)); }, [flach.length, aktiv]);
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-nr="${aktiv}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aktiv]);

  const oeffnen = (t: Treffer | undefined) => {
    if (!t) return;
    if (t.art !== "mehr") zuletztMerken(t);
    schliessen();
    navigate(t.pfad);
  };

  const taste = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => (flach.length ? (a + 1) % flach.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => (flach.length ? (a - 1 + flach.length) % flach.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); oeffnen(flach[aktiv]); }
    else if (e.key === "Escape") { e.preventDefault(); schliessen(); }
    else if (e.key === "Tab") { e.preventDefault(); }
  };

  if (!offen || typeof document === "undefined") return null;
  const zeichenVon = new Map(raeume.map((r) => [r.key, r.Icon]));
  const sucheKunden = q.trim().length >= 2;
  let nr = -1;

  return createPortal(
    <div className="cbk-schleier" onMouseDown={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
      <div className="cbk" role="dialog" aria-modal="true" aria-label="Suchen im Chefbüro">
        <div className={`cbk-feld${laedt ? " laedt" : ""}`}>
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={feld} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={taste}
            placeholder="Seite, Funktion oder Kunde — Name, Mail, Telefon, Referenz"
            autoComplete="off" spellCheck={false} aria-label="Suchbegriff"
            role="combobox" aria-expanded="true" aria-controls="cbk-liste"
            aria-activedescendant={flach[aktiv] ? `cbk-${flach[aktiv].id}` : undefined}
          />
          <kbd className="cbk-kbd">Esc</kbd>
        </div>

        <div className="cbk-liste" id="cbk-liste" role="listbox" ref={liste}>
          {abschnitte.map((a) => (
            <section key={a.key} className="cbk-abschnitt">
              <div className="cbk-titel">
                <span>{a.titel}</span>
                {a.key === "kunden" && gesamt > 0 && <span>{gesamt.toLocaleString("de-DE")} {gesamt === 1 ? "Mensch" : "Menschen"}</span>}
              </div>
              {a.eintraege.map((t) => {
                nr += 1;
                const meine = nr;
                const Zeichen = t.art === "kunde" ? UserRound
                  : t.art === "mehr" ? ArrowRight
                  : a.key === "zuletzt" && !t.raum ? History
                  : (t.raum && zeichenVon.get(t.raum)) || Search;
                return (
                  <button
                    key={`${a.key}-${t.id}`} type="button" id={`cbk-${t.id}`} data-nr={meine}
                    role="option" aria-selected={aktiv === meine}
                    className={`cbk-zeile${aktiv === meine ? " an" : ""}${t.art === "mehr" ? " mehr" : ""}`}
                    onMouseMove={() => { if (aktiv !== meine) setAktiv(meine); }}
                    onClick={() => oeffnen(t)}
                  >
                    <span className="cbk-icon"><Zeichen size={16} strokeWidth={1.75} /></span>
                    <span className="cbk-text">
                      <b>{hervor(t.titel, woerter)}</b>
                      <small>{t.satz}</small>
                    </span>
                    {t.marken?.map((m) => <span key={m.text} className={`cbk-marke ${m.ton}`}>{m.text}</span>)}
                    {t.ort && <span className="cbk-ort">{t.ort}</span>}
                    <CornerDownLeft className="cbk-enter" size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                );
              })}
            </section>
          ))}

          {woerter.length > 0 && flach.length === 0 && !laedt && (
            <p className="cbk-leer">
              {fehler ?? <>Zu „{q.trim()}“ gibt es keine Seite{sucheKunden ? " und keinen Kunden" : ""}. Versuch ein anderes Wort — oder den Nachnamen allein.</>}
            </p>
          )}
          {woerter.length > 0 && flach.length > 0 && fehler && <p className="cbk-leer klein">{fehler}</p>}
          {woerter.length > 0 && !sucheKunden && seitenTreffer.length > 0 && (
            <p className="cbk-leer klein">Ab zwei Zeichen sucht die Palette auch Kunden.</p>
          )}
        </div>

        <div className="cbk-fuss" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> wählen</span>
          <span><kbd>↵</kbd> öffnen</span>
          <span><kbd>Esc</kbd> schließen</span>
          <span className="cbk-fuss-rechts">Seiten · Räume · Kunden</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
