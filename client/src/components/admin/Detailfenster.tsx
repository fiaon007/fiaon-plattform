import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, ChevronRight, Phone, Mail, Copy, ExternalLink, StickyNote } from "lucide-react";
import { ACCENT } from "./AdminShell";
import VermerkDialog, { type AgentWahl } from "./VermerkDialog";
import { zahlungsstatusText } from "@shared/fiaon-kundenstatus";

// ═══════════════════════════════════════════════════════════════════════════
// Detailfenster — WER steckt hinter der Zahl?
//
// „11 heute angekündigt“ ist keine Information, mit der man arbeiten kann:
// solange nicht dasteht, WER angekündigt hat, muss man die Zahl in einer
// anderen Ansicht nachschlagen. Deshalb öffnet jede Kachel des Dashboards
// dieses Fenster — auf derselben Seite, mit Namen, Betrag, Alter, Agent und
// drei Handgriffen je Zeile: Akte öffnen, anrufen, schreiben.
//
// Bewusst nur Lesen und Verlinken, kein Freischalten: Zahlungen werden in der
// Zahlungszentrale bestätigt, wo die Prüfungen sitzen. Ein zweiter Buchungsweg
// wäre die perfekte Stelle für einen unbemerkten Fehler.
//
// Form: Desktop ein zentriertes Fenster, Handy ein Bottom-Sheet (der Daumen
// erreicht oben nichts). Glas, weil das Fenster über der Seite SCHWEBT — und
// man den Kontext darunter weiter sehen soll.
// ═══════════════════════════════════════════════════════════════════════════

/** Spiegel von LagenListe in server/routes/fiaon-admin-hub.ts — beide Seiten
 *  müssen dieselben Namen kennen, sonst fragt die Oberfläche eine Liste ab, die
 *  es nicht gibt. */
export type ListenArt =
  | "angekuendigt-heute" | "angekuendigt-alle" | "angekuendigt-alt"
  | "zusagen-heute" | "zusagen-ueberfaellig" | "zusagen-alle"
  | "bezahlt-heute" | "bezahlt-monat" | "bezahlt-alle"
  | "offen-alle" | "offen-ohne-reaktion" | "abgelaufen"
  | "erinnert-heute"
  | "abo-heute" | "abo-woche" | "abo-ueberfaellig" | "abo-bezahlt-monat";

export interface Eintrag {
  ref: string;
  zahlungsreferenz: string | null;
  name: string;
  email: string | null;
  telefon: string | null;
  betragCents: number | null;
  paket: string | null;
  datum: string | null;
  tageAlt: number | null;
  agent: string | null;
  notiz: string | null;
  status: string | null;
  akte: string;
}

export interface FensterReiter { art: ListenArt; label: string }

const eur = (c: number | null) =>
  c == null ? "—" : `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function datumKurz(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Klartext statt Rohstatus — „claimed_paid“ sagt niemandem etwas. */
// Zahlungsstände: shared/fiaon-kundenstatus.ts (eine Quelle).

const CSS = `
.df-hinter{
  position:fixed; inset:0; z-index:90;
  background:rgba(7,11,22,.55);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  animation:dfHinter 240ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes dfHinter{from{opacity:0}to{opacity:1}}

.df-fenster{
  position:relative; display:flex; flex-direction:column; width:100%; max-width:760px;
  max-height:86vh; overflow:hidden;
  border-radius:22px;
  background:linear-gradient(180deg, rgba(255,255,255,.97), rgba(252,253,255,.97));
  -webkit-backdrop-filter:blur(24px) saturate(180%); backdrop-filter:blur(24px) saturate(180%);
  border:1px solid rgba(255,255,255,.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 8px 20px rgba(7,11,22,.18), 0 40px 90px -20px rgba(13,26,63,.55);
  animation:dfAuf 380ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes dfAuf{from{opacity:0; transform:translateY(18px) scale(.98)}to{opacity:1; transform:none}}

/* Handy: von unten einfahren, volle Breite, oben abgerundet. */
@media (max-width:640px){
  .df-huelle{ align-items:flex-end !important; padding:0 !important; }
  .df-fenster{
    max-width:none; max-height:92vh;
    border-radius:22px 22px 0 0;
    animation:dfHoch 400ms cubic-bezier(.32,.72,0,1) both;
  }
  @keyframes dfHoch{from{transform:translateY(100%)}to{transform:none}}
}

.df-kopf{
  padding:16px 18px 12px;
  background:linear-gradient(180deg,#fbfcff,#f4f7fd);
  box-shadow:inset 0 -1px 0 rgba(15,23,42,.08);
}
.df-zeile{ box-shadow:inset 0 -1px 0 rgba(226,232,240,.8); transition:background 140ms ease; }
.df-zeile:hover{ background:rgba(29,78,216,.035); }
.df-zeile:last-child{ box-shadow:none; }

/* Knopf- und Reiter-Optik liegen in admin-3d.css (.a3-knopf / .a3-reiter) —
   sie werden auch von der Abo-Tafel und der Zahlungszentrale gebraucht, und
   geteilte Optik gehört nicht in eine einzelne Komponente. */

@media (prefers-reduced-motion: reduce){
  .df-hinter,.df-fenster{ animation:none !important; }
}
`;

export default function Detailfenster({
  reiter, start, titel, hinweis, alleLink, alleLabel, onClose,
}: {
  /** Ein Fenster, mehrere Sichten derselben Sache (z. B. heute / überfällig / alle) */
  reiter: FensterReiter[];
  start?: ListenArt;
  titel: string;
  hinweis: string;
  /** Wohin, wenn man die vollständige Arbeitsansicht braucht */
  alleLink: string;
  alleLabel: string;
  onClose: () => void;
}) {
  const [art, setArt] = useState<ListenArt>(start || reiter[0].art);
  const [daten, setDaten] = useState<{ eintraege: Eintrag[]; summeCents: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [filter, setFilter] = useState("");
  const [kopiert, setKopiert] = useState<string | null>(null);
  const sucheRef = useRef<HTMLInputElement>(null);
  // Vermerk direkt aus der Liste anlegen — ohne die Ansicht zu verlassen. Wer
  // eine Liste durchgeht, hält unterwegs etwas fest; ihn dafür in die Akte zu
  // schicken hieße, die Liste von vorn zu beginnen.
  const [vermerkFuer, setVermerkFuer] = useState<Eintrag | null>(null);
  const [agenten, setAgenten] = useState<AgentWahl[]>([]);
  const [notiz, setNotiz] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/agents", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setAgenten((j?.ok ? j.data : []).filter((a: any) => a.active !== false && !a.is_test_account)
        .map((a: any) => ({ id: Number(a.id), name: a.name }))))
      .catch(() => setAgenten([]));
  }, []);

  useEffect(() => {
    let lebt = true;
    setLaedt(true);
    setFehler(null);
    fetch(`/api/fiaon/admin/hub/liste?art=${art}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!lebt) return;
        if (j?.ok) setDaten({ eintraege: j.eintraege || [], summeCents: j.summeCents || 0 });
        else setFehler(j?.error || "Liste konnte nicht geladen werden.");
      })
      .catch(() => lebt && setFehler("Keine Verbindung zum Server."))
      .finally(() => lebt && setLaedt(false));
    return () => { lebt = false; };
  }, [art]);

  // ESC schließt, und der Hintergrund darf nicht mitscrollen — sonst verliert
  // man beim Schließen die Stelle, an der man war.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Fokus in das Suchfeld: bei 150 Einträgen ist Tippen der schnellste Weg.
    setTimeout(() => sucheRef.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = vorher;
    };
  }, [onClose]);

  const liste = useMemo(() => {
    const s = filter.trim().toLowerCase();
    const alle = daten?.eintraege || [];
    if (!s) return alle;
    return alle.filter((e) =>
      e.name.toLowerCase().includes(s) ||
      (e.email || "").toLowerCase().includes(s) ||
      (e.telefon || "").includes(s) ||
      e.ref.toLowerCase().includes(s) ||
      (e.zahlungsreferenz || "").toLowerCase().includes(s) ||
      (e.agent || "").toLowerCase().includes(s),
    );
  }, [daten, filter]);

  const summe = liste.reduce((s, e) => s + (e.betragCents || 0), 0);

  const kopieren = (text: string, marke: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setKopiert(marke);
      setTimeout(() => setKopiert(null), 1600);
    });
  };

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="df-hinter" onClick={onClose} />
      <div className="df-huelle fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
        <div className="df-fenster pointer-events-auto" role="dialog" aria-modal="true" aria-label={titel}>
          {/* Kopf */}
          <div className="df-kopf shrink-0">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold text-slate-900 tracking-[-.01em]">{titel}</h2>
                <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{hinweis}</p>
              </div>
              <button type="button" onClick={onClose}
                className="shrink-0 w-9 h-9 rounded-xl border bg-white flex items-center justify-center text-slate-400 hover:text-slate-700"
                style={{ borderColor: "#e4e9f2" }} aria-label="Schließen">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {reiter.length > 1 && (
                <span className="a3-reiter">
                  {reiter.map((r) => (
                    <button key={r.art} type="button" data-an={art === r.art ? "1" : undefined}
                      onClick={() => setArt(r.art)}>
                      {r.label}
                    </button>
                  ))}
                </span>
              )}
              <span className="relative flex-1 min-w-[150px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={sucheRef}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Name, Referenz, Zuständige:r …"
                  className="w-full h-[34px] pl-7 pr-2.5 rounded-[9px] border bg-white text-[12.5px] outline-none"
                  style={{ borderColor: "#e4e9f2" }}
                />
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2.5 text-[12px]">
              <span className="font-bold text-slate-800 a3-zahl">
                {laedt ? "…" : `${liste.length} ${liste.length === 1 ? "Eintrag" : "Einträge"}`}
              </span>
              {!laedt && summe > 0 && <span className="text-slate-500 a3-zahl">Volumen {eur(summe)}</span>}
              {filter && daten && liste.length !== daten.eintraege.length && (
                <button type="button" onClick={() => setFilter("")} className="text-slate-400 hover:text-slate-700 font-semibold">
                  Filter aufheben ({daten.eintraege.length})
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {laedt && <p className="px-[18px] py-8 text-[13px] text-slate-400">Wird geladen …</p>}
            {fehler && <p className="px-[18px] py-8 text-[13px] text-red-600">{fehler}</p>}
            {!laedt && !fehler && liste.length === 0 && (
              <p className="px-[18px] py-10 text-center text-[13px] text-slate-400">
                {filter ? `Kein Eintrag passt zu „${filter}“.` : "Nichts vorhanden — hier ist gerade alles erledigt."}
              </p>
            )}

            {liste.map((e) => (
              <div key={`${e.ref}-${e.datum}`} className="df-zeile px-[18px] py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-slate-900 truncate">{e.name}</p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                      {e.agent ? e.agent : <span className="text-amber-700 font-semibold">ohne Zuständigen</span>}
                      {" · "}{datumKurz(e.datum)}
                      {e.tageAlt != null && e.tageAlt >= 1 && (
                        <span className={e.tageAlt > 7 ? "text-red-600 font-semibold" : ""}>
                          {" · "}{e.tageAlt} {e.tageAlt === 1 ? "Tag" : "Tage"}
                        </span>
                      )}
                      {e.status && ` · ${zahlungsstatusText(e.status)}`}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {e.zahlungsreferenz || e.ref}{e.paket ? ` · ${e.paket}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-bold text-slate-900 a3-zahl">{eur(e.betragCents)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <a className="a3-knopf inline-flex" data-haupt="1" href={e.akte}>
                    Akte öffnen <ChevronRight size={12} />
                  </a>
                  {/* Auf dem Handy kurze Beschriftungen: mit voller Nummer und
                      E-Mail-Adresse brauchten die Knöpfe zwei Reihen, und jede
                      Zeile der Liste wurde 300px hoch. */}
                  {e.telefon && (
                    <a className="a3-knopf inline-flex" href={`tel:${e.telefon.replace(/[^\d+]/g, "")}`}>
                      <Phone size={12} />
                      <span className="hidden sm:inline">{e.telefon}</span>
                      <span className="sm:hidden">Anrufen</span>
                    </a>
                  )}
                  {e.email && (
                    <a className="a3-knopf inline-flex" href={`mailto:${e.email}`} title={e.email} aria-label="E-Mail schreiben">
                      <Mail size={12} /> <span className="hidden sm:inline">{e.email}</span>
                    </a>
                  )}
                  {/* aria-label ist Pflicht: auf dem Handy zeigt der Knopf nur
                      das Zeichen, und ein Knopf ohne Namen existiert für ein
                      Vorleseprogramm nicht. */}
                  <button type="button" className="a3-knopf inline-flex"
                    title="Notiz oder Aufgabe zu dieser Person"
                    aria-label="Vermerk anlegen"
                    onClick={() => setVermerkFuer(e)}>
                    <StickyNote size={12} /> <span className="hidden sm:inline">Vermerk</span>
                  </button>
                  {/* Referenz kopieren und Zahlungszentrale erst ab Tablet: auf
                      380px passen fünf Knöpfe nicht in eine Reihe, und die Akte
                      enthält beides ohnehin. */}
                  <button type="button" className="a3-knopf hidden sm:inline-flex" title="Zahlungsreferenz kopieren"
                    onClick={() => kopieren(e.zahlungsreferenz || e.ref, e.ref)}>
                    <Copy size={12} /> {kopiert === e.ref ? "kopiert" : "Referenz"}
                  </button>
                  <a className="a3-knopf hidden sm:inline-flex" href={`/admin/zahlungen?ref=${encodeURIComponent(e.ref)}`}
                    title="In der Zahlungszentrale öffnen">
                    <ExternalLink size={12} /> Zahlung
                  </a>
                </div>

                {e.notiz && (
                  <p className="mt-2 text-[11.5px] text-slate-500 italic leading-snug border-l-2 pl-2.5"
                    style={{ borderColor: "#e4e9f2" }}>
                    {e.notiz}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Fuß */}
          <div className="shrink-0 px-[18px] py-2.5 flex items-center justify-between gap-3"
            style={{ background: "#fbfcfe", boxShadow: "inset 0 1px 0 rgba(226,232,240,.9)" }}>
            {notiz ? (
              <span className="text-[12px] font-semibold" style={{ color: "#047857" }}>{notiz}</span>
            ) : (
              <a href={alleLink} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: ACCENT }}>
                {alleLabel} <ChevronRight size={12} />
              </a>
            )}
            <button type="button" onClick={onClose} className="text-[12px] font-semibold text-slate-500 hover:text-slate-800">
              Schließen
            </button>
          </div>
        </div>
      </div>

      {/* Vermerk zu einer Zeile — liegt ÜBER dem Fenster (z-Index 110). */}
      {vermerkFuer && (
        <VermerkDialog
          ziel={{ ref: vermerkFuer.ref, name: vermerkFuer.name }}
          agenten={agenten}
          onAbbrechen={() => setVermerkFuer(null)}
          onFertig={(m) => {
            setVermerkFuer(null);
            setNotiz(m);
            setTimeout(() => setNotiz(null), 6000);
          }}
        />
      )}
    </>,
    document.body,
  );
}
