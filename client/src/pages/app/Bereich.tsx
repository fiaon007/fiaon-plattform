// ═══════════════════════════════════════════════════════════════════════════
// /app — die Schale des neuen Kundenbereichs (Bauvorlage 05.09.2026, E-150)
//
// Lädt EINMAL je Sitzung GET /kunde/:ref/bereich (plus Vorgänge und den Stand
// des Anspruchs-Checks), rechnet daraus mit shared/fiaon-rahmenweg.ts den Weg
// (Phase 0) und zeichnet fünf Reiter: Heute · Weg · Brief · Geld · Mehr.
// Vorgänge (mit Ansprüchen), Anspruchs-Check und Unterlagen sind Vollbild-
// schirme, erreichbar über Heute, Weg und Mehr.
//
// Der eine Primärknopf sitzt in der Aktionsleiste über der Bottom-Bar und
// wechselt mit dem Zustand (rahmenweg.jetzt.aktion). Kopf nicht klebend; nur
// Bottom-Bar und Aktionsleiste schweben. Demo: /app/demo/* mit FIAON-DEMO.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { rahmenwegAus, type Schritt } from "@shared/fiaon-rahmenweg";
import { FRAGEN, beantwortet as anzahlBeantwortet } from "@shared/fiaon-ansprueche";
import type { Bereich, Vorgang } from "./typen";
import { api, startgespraechBuchen, DEMO_ANTWORTEN, DEMO_POST, Ansprueche, Unterlagen, Mehr } from "./Bausteine";
import { Heute } from "./Heute";
import { Weg } from "./Weg";
import { Brief } from "./Brief";
import { Vorgaenge } from "./Vorgaenge";
import { Geld } from "./Geld";
import "@/styles/app.css";

const DEMO_REF = "FIAON-DEMO";
const basisVon = (ort: string) => (ort === "/app/demo" || ort.startsWith("/app/demo/") ? "/app/demo" : "/app");

type Reiter = "heute" | "weg" | "brief" | "geld" | "mehr";
type Bildschirm = Reiter | "vorgaenge" | "ansprueche" | "unterlagen";
const REITER: { key: Reiter; pfad: string; name: string; icon: JSX.Element }[] = [
  { key: "heute", pfad: "", name: "Heute", icon: <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg> },
  { key: "weg", pfad: "/weg", name: "Weg", icon: <svg viewBox="0 0 24 24"><path d="M5 20V4" /><path d="M5 5h11l-2 3 2 3H5" /></svg> },
  { key: "brief", pfad: "/brief", name: "Brief", icon: <svg viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></svg> },
  { key: "geld", pfad: "/geld", name: "Geld", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M9.5 10.2c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2c0 1.9-5 1.3-5 3.6 0 1.2 1.1 2 2.5 2s2.5-.8 2.5-2M12 6.5v1.7M12 15.8v1.7" /></svg> },
  { key: "mehr", pfad: "/mehr", name: "Mehr", icon: <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg> },
];
const bildschirmAus = (pfad: string, basis: string): { bildschirm: Bildschirm; rest: string[] } => {
  const teile = pfad.slice(basis.length).replace(/^\//, "").split("/").filter(Boolean);
  const k = teile[0] ?? "";
  const alle: Bildschirm[] = ["heute", "weg", "brief", "geld", "mehr", "vorgaenge", "ansprueche", "unterlagen"];
  return { bildschirm: (alle.indexOf(k as Bildschirm) !== -1 ? (k as Bildschirm) : "heute"), rest: teile.slice(1) };
};
const heuteIso = () => {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
};

export default function AppBereich() {
  const [ort, navigiere] = useLocation();
  const basis = basisVon(ort);
  const demo = basis === "/app/demo";
  const { bildschirm, rest } = bildschirmAus(ort, basis);
  const [b, setB] = useState<Bereich | null>(null);
  const [post, setPost] = useState<Vorgang[] | null>(demo ? DEMO_POST : null);
  const [postGrund, setPostGrund] = useState<string | null>(null);
  const [check, setCheck] = useState<{ beantwortet: number; gesamt: number } | null>(demo ? { beantwortet: anzahlBeantwortet(DEMO_ANTWORTEN), gesamt: FRAGEN.length } : null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  // Die Seite scrollt im Fenster (app.css). Beim Verlassen zurückdrehen.
  useEffect(() => {
    document.documentElement.classList.add("ap-scroll");
    return () => document.documentElement.classList.remove("ap-scroll");
  }, []);

  useEffect(() => {
    document.title = "Mein FIAON";
    let aktiv = true;
    (async () => {
      try {
        if (demo) { const r = await api(`/kunde/${DEMO_REF}/bereich`); if (aktiv) setB(r.json); return; }
        const me = await api("/kunde/me");
        if (!me.json?.eingeloggt || !me.json.ref) { navigiere(`/app/login?weiter=${encodeURIComponent(ort)}`); return; }
        const ref = encodeURIComponent(me.json.ref);
        const r = await api(`/kunde/${ref}/bereich`);
        if (r.status === 401) { navigiere("/app/login"); return; }
        if (!r.ok || !r.json) throw new Error(String(r.status));
        if (aktiv) setB(r.json);
        // Einzelabrufe je Karte isoliert: fällt einer aus, fällt nur seine Karte.
        api(`/kunde/${ref}/app/post`).then((x) => { if (!aktiv) return; if (x.json?.ok === false && x.json?.grund) { setPostGrund(x.json.text); setPost([]); } else setPost(Array.isArray(x.json?.vorgaenge) ? x.json.vorgaenge : []); }).catch(() => aktiv && setPost([]));
        api(`/kunde/${ref}/app/ansprueche`).then((x) => { if (!aktiv) return; if (x.json?.ok) setCheck({ beantwortet: x.json.beantwortet ?? 0, gesamt: x.json.fragenGesamt ?? FRAGEN.length }); else setCheck({ beantwortet: 0, gesamt: FRAGEN.length }); }).catch(() => aktiv && setCheck({ beantwortet: 0, gesamt: FRAGEN.length }));
      } catch {
        if (aktiv) setFehler("Ihr Bereich lässt sich gerade nicht laden. Bitte versuchen Sie es in einem Moment noch einmal.");
      }
    })();
    return () => { aktiv = false; };
  }, [demo]);

  useEffect(() => { window.scrollTo({ top: 0 }); setHinweis(null); }, [bildschirm]);

  const rw = useMemo(() => (b ? rahmenwegAus(b, { heuteIso: heuteIso(), check, vorgaengeVersandt: (post ?? []).filter((v) => v.stand === "versandt" || v.stand === "nachfrage" || v.stand === "bewilligt").length }) : null), [b, check, post]);
  const ref = b?.kunde.ref ?? "";
  const apName = b?.ansprechpartner?.name ?? null;

  // Segmente füllen sich einmal je Sitzung von links.
  const [fuellt] = useState(() => { try { if (sessionStorage.getItem("ap_fuellte")) return false; sessionStorage.setItem("ap_fuellte", "1"); return true; } catch { return true; } });

  const aktion = async (s: Schritt) => {
    if (!s.href) return;
    if (s.href === "startgespraech") {
      if (demo) { setHinweis("In der Demo-Ansicht lässt sich kein Termin buchen."); return; }
      const f = await startgespraechBuchen(ref); if (f) setHinweis(f); return;
    }
    navigiere(`${basis}${s.href}`);
  };
  const primaer = rw && rw.lage === "kunde_dran" && rw.jetzt && rw.jetzt.wer === "kunde" && rw.jetzt.aktion ? rw.jetzt : null;
  const zeigeAktion = !!primaer && (bildschirm === "heute" || bildschirm === "weg");
  const aktivReiter: Reiter | null = (["heute", "weg", "brief", "geld", "mehr"] as Bildschirm[]).indexOf(bildschirm) !== -1 ? (bildschirm as Reiter) : null;

  return (
    <div className={`ap-root${zeigeAktion ? " mit-aktion" : ""}${fuellt ? " ap-fuellt" : ""}`}>
      <Kopf b={b} basis={basis} demo={demo} />
      <main className="ap-inhalt">
        {fehler && <div className="ap-karte ap-leer"><b>{fehler}</b><button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Noch einmal</button></div>}
        {!b && !fehler && <Skelett />}
        {b && rw && bildschirm === "heute" && <Heute b={b} rw={rw} basis={basis} post={post} demo={demo} />}
        {b && rw && bildschirm === "weg" && <Weg b={b} rw={rw} basis={basis} onAktion={aktion} />}
        {b && bildschirm === "brief" && <Brief kundeRef={ref} basis={basis} demo={demo} ansprechpartner={apName} />}
        {b && rw && bildschirm === "geld" && <Geld b={b} rw={rw} kundeRef={ref} basis={basis} demo={demo} />}
        {b && bildschirm === "vorgaenge" && <Vorgaenge kundeRef={ref} basis={basis} demo={demo} post={post} grund={postGrund} reiter={rest[0] === "ansprueche" ? "ansprueche" : "vorgaenge"} ansprechpartner={apName} />}
        {b && bildschirm === "ansprueche" && <Ansprueche kundeRef={ref} demo={demo} startCheck={rest[0] === "check"} ansprechpartner={apName} onFertig={() => { api(`/kunde/${encodeURIComponent(ref)}/app/ansprueche`).then((x) => { if (x.json?.ok) setCheck({ beantwortet: x.json.beantwortet ?? 0, gesamt: x.json.fragenGesamt ?? FRAGEN.length }); }).catch(() => {}); navigiere(`${basis}/vorgaenge/ansprueche`); }} />}
        {b && bildschirm === "unterlagen" && <Unterlagen kundeRef={ref} demo={demo} u={b.unterlagen} />}
        {b && bildschirm === "mehr" && <Mehr kundeRef={ref} demo={demo} basis={basis} kunde={b.kunde} paket={b.paket} ansprechpartner={b.ansprechpartner} />}
        {hinweis && <div className="ap-meldung" role="status">{hinweis}</div>}
      </main>
      {zeigeAktion && primaer && (
        <div className="ap-aktion"><div className="ap-aktion-innen"><button type="button" className="ap-knopf" onClick={() => aktion(primaer)}>{primaer.aktion}</button></div></div>
      )}
      <BottomBar aktiv={aktivReiter} basis={basis} />
    </div>
  );
}

function Kopf({ b, basis, demo }: { b: Bereich | null; basis: string; demo: boolean }) {
  const initialen = b ? `${b.kunde.vorname?.[0] ?? ""}${b.kunde.nachname?.[0] ?? ""}`.toUpperCase() : "";
  return (
    <header className="ap-kopf">
      <div className="ap-kopf-innen">
        <Link className="ap-marke" href={basis} aria-label="Mein FIAON">
          <span className="ap-marke-zeichen">F</span>
          <span className="ap-marke-wort">FIAON</span>
        </Link>
        <div className="ap-kopf-rechts">
          {demo && <span className="ap-status" title="Feste Vorführdaten, kein echtes Konto">Demo-Ansicht</span>}
          <Link className="ap-avatar" href={`${basis}/mehr`} aria-label="Mehr">{initialen || "·"}</Link>
        </div>
      </div>
    </header>
  );
}

function Skelett() {
  return (
    <>
      <div className="ap-skelett" style={{ height: 30, width: "60%" }} />
      <div className="ap-skelett" style={{ height: 22, width: "80%" }} />
      <div className="ap-skelett" style={{ height: 220, borderRadius: 20 }} />
      <div className="ap-skelett" style={{ height: 120, borderRadius: 14 }} />
    </>
  );
}

function BottomBar({ aktiv, basis }: { aktiv: Reiter | null; basis: string }) {
  return (
    <nav className="ap-bar" aria-label="Bereiche">
      <div className="ap-bar-innen">
        {REITER.map((r) => (
          <Link key={r.key} href={`${basis}${r.pfad}`} className={`ap-reiter ${r.key}${aktiv === r.key ? " aktiv" : ""}`} aria-current={aktiv === r.key ? "page" : undefined}>
            {r.key === "brief" ? <span className="ap-reiter-kreis">{r.icon}</span> : r.icon}<span>{r.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
