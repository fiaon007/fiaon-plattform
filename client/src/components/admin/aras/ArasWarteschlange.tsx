// ═══════════════════════════════════════════════════════════════════════════
// REITER „ALS NÄCHSTES“ (Cockpit, 20.10.2026) — die Warteschlange: wer dran ist und warum
//
// Vorher: „Verschieben“ fragte per Browser-Fenster nach „JJJJ-MM-TT HH:MM“ — ein Tippfehler warf still einen Fehler
// (nichts geschah), „Entfernen“ ging ohne Rückfrage, Einreihen verlangte eine Personen-Nummer.
// Jetzt: je Zeile „Jetzt“ (sofort dran), „Verschieben“ (Kalender + Uhrzeit, Schnellwahl) und „Entfernen“ (mit
// Rückfrage); Einreihen mit Namenssuche; „Jetzt auffüllen“ holt fällige Kunden sofort aus den Akten (sonst alle 5 Min.).
// Gewählt wird nur, was die Ausbaustufe erlaubt — der Server prüft Sperre, Rechtsgrund und Zeitfenster.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { akteLink } from "@/lib/akte-link";
import { holen, senden, useTakt, NichtVerbunden } from "../ki-teile";
import { berlinHeute, spielartText, tagPlus, uhrzeit } from "./aras-texte";
import { FrageKnopf, Hinweis, Karte, Leer, Segment, SpielartWahl, useHinweis } from "./aras-teile";

interface PlanZeile { id: number; personId: number | null; name: string | null; spielart: string; prioritaet: number; grund: string; fruehAb: string; spaetBis: string; status: string; versuchNr: number; rechtsgrund: string }
type Status = "wartet" | "verschoben" | "fertig" | "alle";
const STATUS_TEXT: Record<string, string> = { wartet: "wartet", gewaehlt: "wird gewählt", laeuft: "läuft gerade", fertig: "erledigt", verfallen: "entfernt / verfallen", gesperrt: "gesperrt", verschoben: "verschoben" };
const RECHT_TEXT: Record<string, string> = { vertrag: "Vertrag (laufender Kunde)", einwilligung: "Einwilligung liegt vor", kunde_ruft: "Kunde ruft an", intern: "intern" };

/** „heute 15:00“, „morgen 10:00“ oder „Mi., 22.10. 10:00“. */
function wannText(iso: string): string {
  const tag = new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const h = berlinHeute();
  const t = tag === h ? "heute" : tag === tagPlus(h, 1) ? "morgen" : new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
  return `${t} ${uhrzeit(iso)}`;
}
/** Ein Zeitpunkt aus Berliner Datum + Uhrzeit (für „Verschieben“). */
function berlinZeit(tag: string, hhmm: string): Date {
  const [j, m, t] = tag.split("-").map(Number); const [hh, mm] = hhmm.split(":").map(Number);
  const utc = Date.UTC(j, m - 1, t, hh, mm);
  const zeigt = new Date(utc).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T");
  const versatz = new Date(`${zeigt}Z`).getTime() - utc;
  return new Date(utc - versatz);
}

export default function ArasWarteschlange({ verbunden }: { verbunden: boolean }) {
  const [status, setStatus] = useState<Status>("wartet");
  const [spielart, setSpielart] = useState("");
  const pfad = `/chef/aras/warteschlange?${status === "alle" ? "" : `status=${status}&`}${spielart ? `spielart=${spielart}` : ""}`.replace(/[?&]$/, "");
  const { daten, fehler, status: http, neu } = useTakt<{ ok: boolean; zeilen: PlanZeile[] }>(verbunden ? pfad : null, 20_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [verschiebenId, setVerschiebenId] = useState<number | null>(null);
  const hinweis = useHinweis();
  if (!verbunden || http === 404) return <NichtVerbunden />;

  const tun = async (name: string, f: () => Promise<string>) => {
    setBusy(name);
    try { hinweis.gut(await f()); neu(); } catch (e) { hinweis.rot((e as Error).message); } finally { setBusy(null); }
  };
  const verschieben = (z: PlanZeile, bis: Date, satz: string) => tun(`v-${z.id}`, async () => {
    await senden(`/chef/aras/warteschlange/${z.id}/verschieben`, { bis: bis.toISOString(), grund: "Chefbüro" });
    setVerschiebenId(null);
    return satz;
  });
  const auffuellen = () => tun("auffuellen", async () => {
    const r = await senden<{ eingereiht: Record<string, number>; uebersprungen: Record<string, number>; verfallen: number }>("/chef/aras/plan-fuellen", {});
    const n = Object.values(r.eingereiht ?? {}).reduce((a, b) => a + b, 0);
    if (r.uebersprungen?.stufe_0) return "Stufe 0: Aras reiht keine Kunden ein — nur Probeanrufe.";
    const welche = Object.entries(r.eingereiht ?? {}).map(([s, k]) => `${spielartText(s)} ${k}`).join(", ");
    return n ? `${n} eingereiht (${welche}).${r.verfallen ? ` ${r.verfallen} abgelaufen.` : ""}` : `Niemand Neues fällig.${r.verfallen ? ` ${r.verfallen} abgelaufen.` : ""}`;
  });
  const zeilen = daten?.zeilen ?? [];

  return (
    <div className="ar-reiter-inhalt" data-ki="warteschlange">
      <div className="ar-werkzeugleiste">
        <Segment label="Status" wert={status} onWahl={setStatus} werte={[{ w: "wartet", t: "Wartet" }, { w: "verschoben", t: "Verschoben" }, { w: "fertig", t: "Erledigt" }, { w: "alle", t: "Alle" }]} />
        <SpielartWahl wert={spielart} onChange={setSpielart} alle="Alle Gesprächsarten" />
        <button type="button" className="ar-knopf klein" disabled={busy === "auffuellen"} onClick={() => void auffuellen()} data-ar="auffuellen"
          title="Holt sofort fällige Kunden aus den Akten in die Warteschlange (sonst alle 5 Minuten von selbst). Gewählt wird nur, was die Stufe erlaubt.">
          {busy === "auffuellen" ? "füllt auf …" : "Jetzt auffüllen"}
        </button>
      </div>
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      {fehler && !daten ? <Leer titel="Die Warteschlange ließ sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={neu}>Nochmal</button></Leer> : null}
      {!daten && !fehler ? <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div> : null}
      {daten ? (
        zeilen.length === 0 ? <Leer titel={status === "wartet" ? "Gerade wartet niemand." : "Niemand in dieser Liste."}>{status === "wartet" ? "Aras füllt die Liste von selbst, sobald die Stufe Kundenanrufe erlaubt." : null}</Leer> : (
          <div className="ar-karte ar-liste-karte">
            <ul className="ar-plan-liste">
              {zeilen.map((z) => {
                const link = z.personId ? akteLink(z.personId, "chef") : null;
                const name = z.name && z.name !== "—" ? z.name : z.personId ? `Person ${z.personId}` : "—";
                const kannVerschieben = ["wartet", "verschoben", "verfallen"].includes(z.status);
                return (
                  <li key={z.id} className="ar-plan" data-ki-plan={z.id}>
                    <div className="ar-plan-text">
                      <div className="ar-plan-wer">{link ? <a href={link}>{name}</a> : <b>{name}</b>}<span>· {spielartText(z.spielart)}</span>{z.status !== "wartet" ? <span className="ar-marke leise">{STATUS_TEXT[z.status] ?? z.status}</span> : null}</div>
                      <p>{z.grund}</p>
                      <small title={`Rechtsgrund: ${RECHT_TEXT[z.rechtsgrund] ?? z.rechtsgrund} · Rang ${z.prioritaet} (1 = zuerst)`}>ab {wannText(z.fruehAb)} bis {uhrzeit(z.spaetBis)} · {z.versuchNr}. Versuch</small>
                    </div>
                    <div className="ar-plan-knoepfe">
                      {kannVerschieben ? <button type="button" className="ar-knopf klein" disabled={!!busy} onClick={() => void verschieben(z, new Date(), z.status === "wartet" ? "Ist jetzt dran — beim nächsten Durchgang." : "Wieder eingereiht — jetzt dran.")} data-ar="jetzt"
                        title="Sofort dran: Aras ruft beim nächsten Durchgang an (wenn Stufe und Zeitfenster es erlauben).">{z.status === "wartet" ? "Jetzt" : "Wieder einreihen"}</button> : null}
                      {kannVerschieben ? <button type="button" className={`ar-knopf klein${verschiebenId === z.id ? " an" : ""}`} disabled={!!busy} onClick={() => setVerschiebenId(verschiebenId === z.id ? null : z.id)} data-ar="verschieben">Verschieben</button> : null}
                      {z.status === "wartet" ? <FrageKnopf klasse="rot" frage="Aus der Liste nehmen?" ja="Entfernen" disabled={!!busy} data="entfernen"
                        onJa={() => void tun(`e-${z.id}`, async () => { await senden(`/chef/aras/warteschlange/${z.id}/entfernen`, { grund: "Chefbüro" }); return "Entfernt — Aras ruft hier nicht an."; })}>Entfernen</FrageKnopf> : null}
                    </div>
                    {verschiebenId === z.id ? <Verschieben busy={!!busy} onAbbrechen={() => setVerschiebenId(null)} onWahl={(bis, satz) => void verschieben(z, bis, satz)} /> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : null}
      <Einreihen onFertig={(satz) => { hinweis.gut(satz); neu(); }} onFehler={hinweis.rot} />
    </div>
  );
}

/** Verschieben: Schnellwahl oder Tag + Uhrzeit — nie ein Textfeld mit Datumsformat. */
function Verschieben({ busy, onWahl, onAbbrechen }: { busy: boolean; onWahl: (bis: Date, satz: string) => void; onAbbrechen: () => void }) {
  const heute = berlinHeute();
  const [tag, setTag] = useState(tagPlus(heute, 1));
  const [zeit, setZeit] = useState("10:00");
  const inStunde = new Date(Date.now() + 60 * 60_000);
  return (
    <div className="ar-verschieben" data-ar="verschieben-feld">
      <span className="ar-leise">Wann?</span>
      <button type="button" className="ar-knopf klein" disabled={busy} onClick={() => onWahl(inStunde, `Verschoben auf ${uhrzeit(inStunde.toISOString())}.`)}>In 1 Stunde</button>
      <button type="button" className="ar-knopf klein" disabled={busy} onClick={() => onWahl(berlinZeit(tagPlus(heute, 1), "10:00"), "Verschoben auf morgen 10:00.")}>Morgen 10:00</button>
      <span className="ar-verschieben-frei">
        <input type="date" value={tag} min={heute} onChange={(e) => e.target.value && setTag(e.target.value)} aria-label="Tag" />
        <input type="time" value={zeit} step={900} onChange={(e) => e.target.value && setZeit(e.target.value)} aria-label="Uhrzeit" />
        <button type="button" className="ar-knopf klein haupt" disabled={busy} onClick={() => onWahl(berlinZeit(tag, zeit), `Verschoben auf ${tag.split("-").reverse().join(".")} ${zeit}.`)}>Speichern</button>
      </span>
      <button type="button" className="ar-knopf-text" onClick={onAbbrechen}>abbrechen</button>
    </div>
  );
}

/** Von Hand einreihen: Namen suchen, Art wählen, ein Satz Grund. */
function Einreihen({ onFertig, onFehler }: { onFertig: (satz: string) => void; onFehler: (t: string) => void }) {
  const [offen, setOffen] = useState(false);
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<{ id: number; name: string; ort: string | null }[]>([]);
  const [person, setPerson] = useState<{ id: number; name: string } | null>(null);
  const [art, setArt] = useState("termin");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (person || q.trim().length < 2) { setTreffer([]); return; }
    let weg = false;
    const t = window.setTimeout(() => {
      holen<{ personen: { id: number; name: string; ort: string | null }[] }>(`/chef/suche?q=${encodeURIComponent(q.trim())}`)
        .then((j) => { if (!weg) setTreffer((j.personen ?? []).slice(0, 6)); }).catch(() => { if (!weg) setTreffer([]); });
    }, 250);
    return () => { weg = true; window.clearTimeout(t); };
  }, [q, person]);
  const einreihen = async () => {
    if (!person) return;
    setBusy(true);
    try {
      await senden("/chef/aras/warteschlange/einreihen", { personId: person.id, spielart: art, grund: grund.trim() });
      onFertig(`${person.name} ist eingereiht (${spielartText(art)}).`);
      setPerson(null); setQ(""); setGrund(""); setOffen(false);
    } catch (e) { onFehler((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Karte titel="Von Hand einreihen" satz="Aras ruft diese Person an, sobald Stufe und Zeitfenster es erlauben." data="einreihen"
      rechts={<button type="button" className="ar-knopf klein" onClick={() => setOffen(!offen)} aria-expanded={offen}>{offen ? "Schließen" : "Jemanden einreihen"}</button>}>
      {offen ? (
        <div className="ar-einreihen">
          {person ? (
            <p className="ar-gewaehlt"><b>{person.name}</b> <button type="button" className="ar-knopf-text" onClick={() => setPerson(null)}>ändern</button></p>
          ) : (
            <div className="ar-suche">
              <input type="search" placeholder="Name, Telefon oder Kennung …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Person suchen" />
              {treffer.length ? (
                <ul className="ar-treffer">{treffer.map((t) => <li key={t.id}><button type="button" onClick={() => { setPerson({ id: t.id, name: t.name }); setTreffer([]); }}>{t.name}{t.ort ? <span> · {t.ort}</span> : null}</button></li>)}</ul>
              ) : q.trim().length >= 2 ? <p className="ar-leise">Niemand gefunden.</p> : null}
            </div>
          )}
          <div className="ar-einreihen-zeile">
            <SpielartWahl wert={art} onChange={setArt} />
            <input type="text" className="ar-breit" placeholder="Grund in einem Satz (z. B. Rückruf gewünscht)" maxLength={200} value={grund} onChange={(e) => setGrund(e.target.value)} aria-label="Grund" />
            <button type="button" className="ar-knopf haupt" disabled={busy || !person || grund.trim().length < 3} onClick={() => void einreihen()}>{busy ? "reiht ein …" : "Einreihen"}</button>
          </div>
        </div>
      ) : null}
    </Karte>
  );
}
