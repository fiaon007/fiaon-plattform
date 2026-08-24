// ═══════════════════════════════════════════════════════════════════════════
// /agent/arbeitszeiten — Raum 9: Wann arbeite ich? (23.08.2026)
//
// Pflicht im Office (E-039): Ohne Wochenplan (≥ 15 h) bekommt niemand Leads
// oder Termine. Wochenraster Mo–So, 6–22 Uhr in halben Stunden; malen mit
// Maus/Finger, Vorlagen, Stunden live, speichern → PUT /agent/arbeitszeiten.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-arbeitszeiten.css";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-rundgang.css";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const START = 6, ENDE = 22; // Stunden
const SLOTS = (ENDE - START) * 2; // halbe Stunden
const slotZeit = (i: number) => `${String(START + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
const VORLAGEN: [string, [number, number][]][] = [["Vormittag 9–13", [[9, 13]]], ["Nachmittag 14–18", [[14, 18]]], ["Voller Tag 9–17", [[9, 17]]], ["Abend 17–21", [[17, 21]]]];

type Raster = boolean[][]; // [tag][slot]
const leer = (): Raster => TAGE.map(() => Array(SLOTS).fill(false));
function ausBloecken(bloecke: { wochentag: number; von: string; bis: string }[]): Raster {
  const r = leer();
  for (const b of bloecke) { const t = b.wochentag - 1; const v = (Number(b.von.slice(0, 2)) - START) * 2 + (b.von.slice(3) === "30" ? 1 : 0); const e = (Number(b.bis.slice(0, 2)) - START) * 2 + (b.bis.slice(3) === "30" ? 1 : 0); for (let i = Math.max(0, v); i < Math.min(SLOTS, e); i++) r[t][i] = true; }
  return r;
}
function zuBloecken(r: Raster) {
  const out: { wochentag: number; von: string; bis: string }[] = [];
  r.forEach((tag, t) => { let i = 0; while (i < SLOTS) { if (!tag[i]) { i++; continue; } let j = i; while (j < SLOTS && tag[j]) j++; out.push({ wochentag: t + 1, von: slotZeit(i), bis: j >= SLOTS ? `${ENDE}:00` : slotZeit(j) }); i = j; } });
  return out;
}

export default function AgentArbeitszeitenPage() { return <AgentShell><ArbeitszeitenInnen /></AgentShell>; }

function ArbeitszeitenInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Availability"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [raster, setRaster] = useState<Raster>(leer());
  const [mindest, setMindest] = useState(15);
  const [geladen, setGeladen] = useState(false);
  const [stand, setStand] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [handyTag, setHandyTag] = useState(() => Math.min(6, Math.max(0, (new Date().getDay() + 6) % 7))); // Handy: ein Tag auf einmal
  const malen = useRef<{ wert: boolean } | null>(null);
  useEffect(() => { api("/agent/arbeitszeiten").then((r) => { if (r.ok) { setRaster(ausBloecken(r.json.bloecke || [])); setMindest(r.json.mindestStunden || 15); } }).finally(() => setGeladen(true)); }, []);
  const stunden = useMemo(() => raster.reduce((s, t) => s + t.filter(Boolean).length, 0) / 2, [raster]);
  const proTag = useMemo(() => raster.map((t) => t.filter(Boolean).length / 2), [raster]);
  const setze = (t: number, i: number, wert: boolean) => setRaster((r) => { if (r[t][i] === wert) return r; const n = r.map((x) => x.slice()); n[t][i] = wert; return n; });
  const start = (t: number, i: number) => { const wert = !raster[t][i]; malen.current = { wert }; setze(t, i, wert); };
  const ueber = (t: number, i: number) => { if (malen.current) setze(t, i, malen.current.wert); };
  useEffect(() => { const ende = () => { malen.current = null; }; window.addEventListener("mouseup", ende); window.addEventListener("touchend", ende); return () => { window.removeEventListener("mouseup", ende); window.removeEventListener("touchend", ende); }; }, []);
  const vorlage = (bl: [number, number][], tage: number[]) => setRaster((r) => { const n = r.map((x) => x.slice()); for (const t of tage) for (const [v, e] of bl) for (let i = (v - START) * 2; i < (e - START) * 2; i++) n[t][i] = true; return n; });
  const speichern = async () => {
    setSpeichert(true); setStand(null);
    const r = await api("/agent/arbeitszeiten", { method: "PUT", body: JSON.stringify({ bloecke: zuBloecken(raster) }) });
    setSpeichert(false);
    setStand(r.ok ? (r.json.vollstaendig ? "Gespeichert. Ab jetzt bekommst du Termine und Leads in diesen Zeiten." : `Gespeichert – aber ${r.json.stundenProWoche} h sind weniger als ${r.json.mindestStunden} h. Bis dahin bekommst du keine Leads.`) : (r.json?.error || "Speichern fehlgeschlagen."));
  };

  return (
    <div className="az">
      <section className="az-kopf">
        <div>
          <span className="az-pille">Availability · Pflicht</span>
          <h1>Wann <span className="az-verlauf">arbeitest du?</span></h1>
          <p>Termine und Leads kommen nur in Zeiten, die hier eingetragen sind. Male deine Woche – mindestens {mindest} Stunden. Du kannst sie jederzeit ändern; gebuchte Termine bleiben.</p>
        </div>
        <div className={`az-summe${stunden >= mindest ? " gut" : ""}`}><b>{stunden.toLocaleString("de-DE")} h</b><small>pro Woche · mindestens {mindest} h</small><div className="az-balken"><i style={{ width: `${Math.min(100, (stunden / Math.max(mindest, 1)) * 100)}%` }} /></div></div>
      </section>

      <section className="az-vorlagen">
        <span>Schnell füllen:</span>
        {VORLAGEN.map(([n, bl]) => <button key={n} type="button" onClick={() => vorlage(bl, [0, 1, 2, 3, 4])}>{n} · Mo–Fr</button>)}
        <button type="button" className="leer" onClick={() => setRaster(leer())}>Alles löschen</button>
      </section>

      {/* Handy: ein Tag pro Ansicht, große Felder – Stunde für Stunde, zwei halbe Stunden je Zeile */}
      <section className="az-handy" aria-label="Wochenplan (Handy)">
        <div className="az-handy-tage" role="tablist">
          {TAGE.map((tag, t) => <button key={tag} type="button" role="tab" aria-selected={handyTag === t} className={`az-handy-tag${handyTag === t ? " an" : ""}${proTag[t] ? " voll" : ""}`} onClick={() => setHandyTag(t)}><b>{tag}</b><small>{proTag[t] ? `${proTag[t].toLocaleString("de-DE")} h` : "–"}</small></button>)}
        </div>
        <div className="az-handy-vorlagen">
          {VORLAGEN.map(([n, bl]) => <button key={n} type="button" onClick={() => vorlage(bl, [handyTag])}>{n.split(" ")[0]} {n.split(" ")[1]}</button>)}
          <button type="button" className="leer" onClick={() => setRaster((r) => { const n = r.map((x) => x.slice()); n[handyTag] = Array(SLOTS).fill(false); return n; })}>{TAGE[handyTag]} leeren</button>
        </div>
        <div className="az-handy-stunden">
          {Array.from({ length: SLOTS / 2 }, (_, h) => (
            <div key={h} className="az-handy-zeile">
              <span>{String(START + h).padStart(2, "0")} Uhr</span>
              {[0, 1].map((k) => { const i = h * 2 + k; const an = raster[handyTag][i]; const bis = i + 1 >= SLOTS ? `${ENDE}:00` : slotZeit(i + 1); return (
                <button key={k} type="button" className={`az-handy-slot${an ? " an" : ""}`} aria-pressed={an} aria-label={`${TAGE[handyTag]} ${slotZeit(i)} bis ${bis}`} onClick={() => setze(handyTag, i, !an)}>{slotZeit(i)}<i>–</i>{bis}</button>
              ); })}
            </div>
          ))}
        </div>
        <p className="az-handy-hinweis">Jedes Feld ist eine halbe Stunde – antippen schaltet es an oder aus. Die Knöpfe oben füllen ganze Blöcke für den gewählten Tag.</p>
      </section>

      <section className="az-raster" aria-label="Wochenplan">
        <div className="az-zeiten"><div className="az-ecke" />{Array.from({ length: SLOTS }, (_, i) => <div key={i} className={`az-zeit${i % 2 ? " halb" : ""}`}>{i % 2 ? "" : slotZeit(i)}</div>)}</div>
        {TAGE.map((tag, t) => (
          <div key={tag} className="az-tag">
            <div className="az-tag-kopf"><b>{tag}</b><small>{proTag[t] ? `${proTag[t].toLocaleString("de-DE")} h` : "–"}</small></div>
            {raster[t].map((an, i) => (
              <div key={i} className={`az-slot${an ? " an" : ""}${i % 2 ? " halb" : ""}`} role="button" aria-label={`${tag} ${slotZeit(i)}`} aria-pressed={an}
                   onMouseDown={(e) => { e.preventDefault(); start(t, i); }} onMouseEnter={() => ueber(t, i)}
                   onTouchStart={(e) => { e.preventDefault(); start(t, i); }} onTouchMove={(e) => { const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) as HTMLElement | null; const d = el?.dataset; if (d?.t && d?.i) ueber(Number(d.t), Number(d.i)); }} data-t={t} data-i={i} />
            ))}
          </div>
        ))}
      </section>

      <section className="az-fuss">
        {stand && <p className={`az-stand${stand.startsWith("Gespeichert") && !stand.includes("weniger") ? " ok" : ""}`}>{stand}</p>}
        <button type="button" className="az-knopf" onClick={speichern} disabled={!geladen || speichert}>{speichert ? "Speichere …" : "Wochenplan speichern"}</button>
        <small>Zeiten in Europe/Berlin. Urlaub und Ausnahmen kommen als Nächstes.</small>
      </section>
      {/* 24.08.2026: Rundgang je Raum (E-063). */}
      <Rundgang raum="availability" titel={RUNDGAENGE.availability.titel} schritte={RUNDGAENGE.availability.schritte} />
    </div>
  );
}
