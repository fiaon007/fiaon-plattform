// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara — Maras Steuerpult (21.09.2026)
//
// Justin: „Ich möchte die Arbeit von Mara einsehen, im Detail sehen können,
// steuern können und ALLES nachvollziehen können."
//
//   · Oben: läuft sie, wie viel heute, was kommt zurück (Antworten, Zahlungen),
//     was es kostet.
//   · Steuerung: An/Aus, Mails je Stunde, Kostendeckel, Stufen, Emojis,
//     Probe ohne Senden, ein Durchgang jetzt.
//   · Unten jede Mail vollständig — mit dem, was danach geschah, Maras
//     Gedächtnis zu dem Menschen und „Aus der Aktion nehmen".
// Die Regeln selbst stehen in server/lib/fiaon-mara-aktion.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-mara.css";

interface Einstellungen { an: boolean; jeStunde: number; tagEuro: number; stufen: string[]; emojis: boolean; postfach: string; start: string | null }
interface Stand {
  einstellungen: Einstellungen;
  zaehler: { letzteStunde: number; heute: number; tagesDeckel: number; anlaufTag: number; kostenHeuteEuro: number };
  zahlen: { gesendet: number; menschen: number; antworten: number; gemeldet: number; bezahlt: number; abgelehnt: number; fehler: number; ausgeschlossen: number; postfach?: { heute_rein?: number; heute_beantwortet?: number; entwuerfe?: number } };
  kosten: { heuteEuro: number; wocheEuro: number };
  schlange: { personId: number; ref: string; stufe: "A" | "B"; schritt: number; name: string; paket: string | null; betragEuro: number | null; wunschlimit: number | null; ereignisAm: string; zuletztAm: string | null }[];
}
interface Mail {
  id: number; personId: number; ref: string; stufe: string; schritt: number; status: string; grund: string | null;
  betreff: string | null; text: string | null; empfaenger: string; name: string; am: string | null;
  antwortAm: string | null; gemeldetAm: string | null; bezahltAm: string | null; kostenCent: number; ausgeschlossen: boolean;
}
type Reiter = "gesendet" | "schlange" | "abgelehnt" | "fehler";

const euro = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const zeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

async function senden(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

export default function ChefMara() {
  const stand = useDaten<Stand>("/chef/mara/stand");
  const [reiter, setReiter] = useState<Reiter>("gesendet");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [probe, setProbe] = useState<any | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const s = stand.daten;
  const e = s?.einstellungen;

  const melden = (t: string) => { setMeldung(t); window.setTimeout(() => setMeldung(null), 6000); };
  const setzen = async (schluessel: string, wert: string, satz: string) => {
    try { await senden("/chef/mara/einstellung", { schluessel, wert }); melden(satz); stand.neu(); } catch (err: any) { melden(err.message); }
  };
  const probeSchreiben = async (personId?: number) => {
    setBeschaeftigt("probe");
    try { setProbe(await senden("/chef/mara/probe", personId ? { personId } : {})); } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };
  const durchgang = async () => {
    if (!window.confirm("Mara schickt jetzt die nächsten Mails — nach denselben Regeln wie im Takt (Stunde, Anlauf, Kostendeckel). Weiter?")) return;
    setBeschaeftigt("durchgang");
    try {
      const j = await senden("/chef/mara/durchgang", {});
      const r = j.ergebnis || {};
      melden(r.grund ? `Kein Versand: ${r.grund}.` : `${r.gesendet} gesendet, ${r.abgelehnt} von der Prüfung zurückgehalten${r.fehler ? `, ${r.fehler} Fehler` : ""}.`);
      stand.neu(); setRunde((x) => x + 1);
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };

  const rate = e ? Math.min(e.jeStunde, Math.ceil((s?.zaehler.tagesDeckel ?? 0) / 24)) : 0;

  return (
    <div className="mp">
      <Rundgang raum="mara" titel="Mara" schritte={RUNDGAENGE.mara.schritte} />
      {stand.laedt && !s && <Geruest zeilen={8} />}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {s && e && (
        <>
          <header className="mp-kopf">
            <div className="mp-wer">
              <span className={`mp-punkt${e.an ? " an" : ""}`} aria-hidden="true" />
              <div>
                <h1>Mara Lindner</h1>
                <p>{e.an
                  ? `Schreibt rund um die Uhr jeden an, der noch nichts bezahlt hat — ${e.stufen.join(" vor ")} zuerst, heißeste zuerst.`
                  : "Die Aktion ist pausiert. Antworten im Postfach laufen weiter."}</p>
              </div>
            </div>
            <button type="button" className={`mp-schalter${e.an ? " an" : ""}`} aria-pressed={e.an}
              onClick={() => void setzen("mara_aktion_an", e.an ? "aus" : "an", e.an ? "Aktion pausiert." : "Aktion läuft — die nächsten Mails gehen im Takt raus.")}>
              <span className="mp-schalter-knopf" />{e.an ? "Aktion läuft" : "Aktion pausiert"}
            </button>
          </header>

          <section className="mp-zahlen" aria-label="Stand">
            <Zahl titel="Heute gesendet" wert={`${s.zaehler.heute}`} unter={`von ${s.zaehler.tagesDeckel} · ${s.zaehler.anlaufTag <= 3 ? `Anlauf Tag ${s.zaehler.anlaufTag}` : "voller Takt"}`} />
            <Zahl titel="Letzte Stunde" wert={`${s.zaehler.letzteStunde}`} unter={`Takt jetzt ${rate} je Stunde`} />
            <Zahl titel="In der Schlange" wert={`${s.schlange.length}${s.schlange.length >= 40 ? "+" : ""}`} unter="fällig, nach Hitze" />
            <Zahl titel="Antworten" wert={`${s.zahlen.antworten}`} unter={`von ${s.zahlen.menschen} Menschen · 14 Tage`} ton="blau" />
            <Zahl titel="Zahlung danach" wert={`${s.zahlen.bezahlt}`} unter={`bezahlt · ${s.zahlen.gemeldet} gemeldet · 14 Tage`} ton="gruen" />
            <Zahl titel="Kosten heute" wert={euro(s.kosten.heuteEuro)} unter={`Deckel ${euro(e.tagEuro)} · Woche ${euro(s.kosten.wocheEuro)}`} />
          </section>

          <section className="mp-steuer" aria-label="Steuerung">
            <div className="mp-feld">
              <label htmlFor="mp-stunde">Mails je Stunde <b>{e.jeStunde}</b></label>
              <input id="mp-stunde" type="range" min={0} max={50} step={5} defaultValue={e.jeStunde}
                onMouseUp={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)}
                onTouchEnd={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)}
                onKeyUp={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)} />
              <small>Im Anlauf weniger: Tag 1 höchstens 200, Tag 2 400, Tag 3 800 — schützt die Absenderadresse.</small>
            </div>
            <div className="mp-feld">
              <label htmlFor="mp-euro">Kostendeckel je Tag</label>
              <div className="mp-reihe">
                <input id="mp-euro" type="number" min={0} max={100} defaultValue={e.tagEuro} className="mp-zahlfeld"
                  onBlur={(ev) => { if (Number(ev.target.value) !== e.tagEuro) void setzen("mara_aktion_tag_euro", ev.target.value, `Kostendeckel: ${ev.target.value} € am Tag.`); }} />
                <span>€</span>
              </div>
              <small>Eine Mail kostet rund einen halben Cent.</small>
            </div>
            <div className="mp-feld">
              <span className="mp-etikett">Wer angeschrieben wird</span>
              <div className="mp-reihe">
                {["A", "B"].map((st) => {
                  const drin = e.stufen.includes(st);
                  const neu = drin ? e.stufen.filter((x) => x !== st) : [...e.stufen, st].sort();
                  return (
                    <button key={st} type="button" className={`mp-pille${drin ? " an" : ""}`} aria-pressed={drin}
                      onClick={() => void setzen("mara_aktion_stufen", neu.join(","), `Stufen: ${neu.join(", ") || "keine"}.`)}>
                      {st === "A" ? "A · Zahlung gemeldet" : "B · Rechnung offen"}
                    </button>
                  );
                })}
                <span className="mp-pille gesperrt" title="Erst nach Prüfung der Mail-Einwilligung (§ 7 UWG)">C · wartet auf Einwilligung</span>
              </div>
            </div>
            <div className="mp-feld">
              <span className="mp-etikett">Stil</span>
              <div className="mp-reihe">
                <button type="button" className={`mp-pille${e.emojis ? " an" : ""}`} aria-pressed={e.emojis}
                  onClick={() => void setzen("mara_aktion_emojis", e.emojis ? "aus" : "an", e.emojis ? "Ohne Emojis." : "Höchstens ein 🙂 je Mail.")}>
                  {e.emojis ? "ein 🙂 erlaubt" : "ohne Emojis"}
                </button>
                <select className="mp-auswahl" value={e.postfach} aria-label="Absender"
                  onChange={(ev) => void setzen("mara_aktion_postfach", ev.target.value, `Absender: ${ev.target.value}.`)}>
                  <option value="support@fiaon.com">von support@fiaon.com</option>
                  <option value="welcome@fiaon.com">von welcome@fiaon.com</option>
                </select>
              </div>
            </div>
            <div className="mp-knoepfe">
              <button type="button" className="mp-knopf" disabled={!!beschaeftigt} onClick={() => void probeSchreiben()}>
                {beschaeftigt === "probe" ? "Mara schreibt …" : "Probe: nächste Mail ansehen"}
              </button>
              <button type="button" className="mp-knopf voll" disabled={!!beschaeftigt || !e.an} onClick={() => void durchgang()}>
                {beschaeftigt === "durchgang" ? "Sendet …" : "Jetzt einen Durchgang"}
              </button>
            </div>
          </section>

          <nav className="mp-reiter" aria-label="Ansicht">
            {([["gesendet", `Gesendet · ${s.zahlen.gesendet}`], ["schlange", `Schlange · ${s.schlange.length}${s.schlange.length >= 40 ? "+" : ""}`], ["abgelehnt", `Zurückgehalten · ${s.zahlen.abgelehnt}`], ["fehler", `Fehler · ${s.zahlen.fehler}`]] as [Reiter, string][]).map(([k, t]) => (
              <button key={k} type="button" className={`mp-reiter-knopf${reiter === k ? " an" : ""}`} aria-pressed={reiter === k} onClick={() => setReiter(k)}>{t}</button>
            ))}
            <a className="mp-reiter-knopf" href="/chef/s/postmeister">Postfach · {s.zahlen.postfach?.heute_beantwortet ?? 0} heute beantwortet</a>
          </nav>

          {reiter === "schlange"
            ? <Schlange liste={s.schlange} onProbe={(id) => void probeSchreiben(id)} beschaeftigt={!!beschaeftigt} />
            : <Mails status={reiter} runde={runde} melden={melden} />}

          <details className="mp-regeln">
            <summary>So arbeitet Mara</summary>
            <ul>
              <li><b>Wen:</b> jeden mit offener Rechnung — A (Zahlung gemeldet, Geld nicht da) vor B (Antrag fertig). Heißeste zuerst: das jüngste Ereignis.</li>
              <li><b>Wann:</b> erste Mail 24 Stunden nach Antrag bzw. Zahlungsmeldung, dann nach 2, 4 und 7 Tagen, danach alle 14 Tage — bis er zahlt. Rund um die Uhr.</li>
              <li><b>Wie:</b> jede Mail aus seiner Akte, seinem ganzen Weg und ihrem Gedächtnis geschrieben — nie zweimal dieselbe. Knopf zur Zahlungsseite, Karte positiv, keine Zusage, keine Frist.</li>
              <li><b>Rücksicht:</b> Schreibt der Kunde selbst, antwortet Mara im Postfach und die Aktion wartet 7 Tage. Hat ein Mitarbeiter in den letzten 12 Stunden mit ihm gesprochen oder ging vor weniger als 6 Stunden eine andere Mail raus, wartet sie.</li>
              <li><b>Nie:</b> bei Werbesperre, Vertriebssperre, „Stopp“, Storno, Kündigung, Zustellproblem — oder wenn du ihn hier aus der Aktion nimmst.</li>
              <li><b>Prüfung:</b> Jede Mail läuft durch die Wortwand (nichts garantieren, nichts empfehlen, keine Frist) und die Sie-Form. Was hängen bleibt, geht nicht raus und steht unter „Zurückgehalten“.</li>
            </ul>
          </details>
        </>
      )}

      {probe && <ProbeFenster probe={probe} onZu={() => setProbe(null)} />}
      {meldung && <div className="mp-meldung" role="status">{meldung}</div>}
    </div>
  );
}

function Zahl({ titel, wert, unter, ton }: { titel: string; wert: string; unter?: string; ton?: "gruen" | "blau" }) {
  return (
    <div className={`mp-zahl${ton ? ` ${ton}` : ""}`}>
      <span className="mp-zahl-titel">{titel}</span>
      <span className="mp-zahl-wert">{wert}</span>
      {unter && <span className="mp-zahl-unter">{unter}</span>}
    </div>
  );
}

function Schlange({ liste, onProbe, beschaeftigt }: { liste: Stand["schlange"]; onProbe: (personId: number) => void; beschaeftigt: boolean }) {
  if (!liste.length) return <p className="mp-leer">Gerade ist niemand fällig — alle haben ihre Mail oder warten auf den nächsten Takt.</p>;
  return (
    <ol className="mp-liste">
      {liste.map((k) => (
        <li key={k.personId} className="mp-zeile">
          <div className="mp-zeile-kopf">
            <span className={`mp-stufe ${k.stufe}`}>{k.stufe}</span>
            <a className="mp-name" href={`/chef/s/akte?id=${k.personId}`} target="_blank" rel="noreferrer">{k.name}</a>
            <span className="mp-still">Mail {k.schritt} · {k.stufe === "A" ? "Zahlung gemeldet" : "Antrag"} {seit(k.ereignisAm)}{k.zuletztAm ? ` · letzte Mail ${seit(k.zuletztAm)}` : ""}</span>
            <button type="button" className="mp-klein" disabled={beschaeftigt} onClick={() => onProbe(k.personId)}>Probe</button>
          </div>
          <div className="mp-still">{[k.paket, k.betragEuro != null ? euro(k.betragEuro) : null, k.wunschlimit ? `Wunschlimit ${k.wunschlimit.toLocaleString("de-DE")} €` : null].filter(Boolean).join(" · ")}</div>
        </li>
      ))}
    </ol>
  );
}

function Mails({ status, runde, melden }: { status: Reiter; runde: number; melden: (t: string) => void }) {
  const [liste, setListe] = useState<Mail[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const r = await fetch(`${API}/chef/mara/mails?status=${status}`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || "Die Mails ließen sich nicht laden.");
      setListe(j.mails);
    } catch (err: any) { setFehler(err.message); }
  }, [status]);
  useEffect(() => { setListe(null); void laden(); }, [laden, runde]);

  if (fehler) return <Fehlermeldung text={fehler} erneut={() => void laden()} />;
  if (!liste) return <Geruest zeilen={5} />;
  if (!liste.length) return <p className="mp-leer">{status === "gesendet" ? "Noch keine Mail aus der Aktion." : status === "abgelehnt" ? "Nichts zurückgehalten — jede Mail hat die Prüfung bestanden." : "Keine Fehler."}</p>;
  return (
    <ol className="mp-liste">
      {liste.map((m) => (
        <li key={m.id} className={`mp-zeile${offen === m.id ? " offen" : ""}`}>
          <button type="button" className="mp-zeile-knopf" aria-expanded={offen === m.id} onClick={() => setOffen(offen === m.id ? null : m.id)}>
            <span className="mp-zeile-kopf">
              <span className={`mp-stufe ${m.stufe}`}>{m.stufe}</span>
              <span className="mp-name">{m.name}</span>
              <span className="mp-still">Mail {m.schritt} · {zeit(m.am)}</span>
              {m.antwortAm && <span className="mp-chip blau">hat geantwortet</span>}
              {m.gemeldetAm && <span className="mp-chip gelb">Zahlung gemeldet</span>}
              {m.bezahltAm && <span className="mp-chip gruen">bezahlt</span>}
              {m.ausgeschlossen && <span className="mp-chip">aus der Aktion</span>}
            </span>
            <span className="mp-betreff">{m.betreff || "—"}</span>
            {m.grund && <span className="mp-grund">{m.grund}</span>}
          </button>
          {offen === m.id && <MailDetail m={m} melden={melden} onGeaendert={() => void laden()} />}
        </li>
      ))}
    </ol>
  );
}

function MailDetail({ m, melden, onGeaendert }: { m: Mail; melden: (t: string) => void; onGeaendert: () => void }) {
  const person = useDaten<{ gedaechtnis: { am: string; text: string; quelle: string }[]; postfach: any[]; ausschluss: any }>(`/chef/mara/person/${m.personId}`);
  const [gedaechtnis, setGedaechtnis] = useState<{ am: string; text: string; quelle: string }[] | null>(null);
  const g = gedaechtnis ?? person.daten?.gedaechtnis ?? [];
  const aus = async (raus: boolean) => {
    try { await senden("/chef/mara/ausschluss", { personId: m.personId, aus: raus }); melden(raus ? `${m.name} ist aus der Aktion genommen.` : `${m.name} ist wieder in der Aktion.`); onGeaendert(); } catch (err: any) { melden(err.message); }
  };
  const vergessen = async (index: number) => {
    try { const j = await senden("/chef/mara/gedaechtnis/loeschen", { personId: m.personId, index }); setGedaechtnis(j.gedaechtnis); } catch (err: any) { melden(err.message); }
  };
  return (
    <div className="mp-detail">
      <div className="mp-mail">
        <div className="mp-mail-kopf"><span>An {m.empfaenger}</span><span>{m.kostenCent ? `${m.kostenCent.toFixed(2).replace(".", ",")} ct` : ""}</span></div>
        <pre className="mp-mail-text">{m.text || "—"}</pre>
      </div>
      <div className="mp-seite">
        <h3>Was Mara sich zu {m.name.split(" ")[0]} gemerkt hat</h3>
        {person.laedt && !person.daten ? <Geruest zeilen={2} /> : g.length ? (
          <ul className="mp-gedaechtnis">
            {g.map((x, i) => (
              <li key={`${i}-${x.text.slice(0, 20)}`}>
                <span>{x.am ? `${x.am.slice(8, 10)}.${x.am.slice(5, 7)}. · ` : ""}{x.text}</span>
                <button type="button" className="mp-klein" onClick={() => void vergessen(i)} aria-label="Vergessen">Vergessen</button>
              </li>
            ))}
          </ul>
        ) : <p className="mp-still">Noch nichts — Mara merkt sich, was der Kunde ihr schreibt.</p>}
        {(person.daten?.postfach?.length ?? 0) > 0 && (
          <>
            <h3>Seine Mails an uns</h3>
            <ul className="mp-post">
              {person.daten!.postfach.slice(0, 6).map((p: any) => (
                <li key={p.id}><span className="mp-still">{zeit(p.empfangen_am)}</span> {p.zusammenfassung || p.betreff}{p.gesendet_am ? <span className="mp-chip blau">beantwortet</span> : null}</li>
              ))}
            </ul>
          </>
        )}
        <div className="mp-knoepfe">
          <a className="mp-knopf" href={`/chef/s/akte?id=${m.personId}`} target="_blank" rel="noreferrer">Akte öffnen</a>
          {m.ausgeschlossen
            ? <button type="button" className="mp-knopf" onClick={() => void aus(false)}>Wieder in die Aktion</button>
            : <button type="button" className="mp-knopf warn" onClick={() => void aus(true)}>Aus der Aktion nehmen</button>}
        </div>
      </div>
    </div>
  );
}

function ProbeFenster({ probe, onZu }: { probe: any; onZu: () => void }) {
  useEffect(() => {
    const t = (ev: KeyboardEvent) => { if (ev.key === "Escape") onZu(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [onZu]);
  const p = probe.probe || {};
  return (
    <div className="mp-schleier" role="dialog" aria-modal="true" aria-label="Probe" onClick={onZu}>
      <div className="mp-fenster" onClick={(ev) => ev.stopPropagation()}>
        <div className="mp-fenster-kopf">
          <div>
            <span className="mp-still">Probe — nicht gesendet · Stufe {probe.fuer?.stufe} · Mail {probe.fuer?.schritt}</span>
            <h2>{probe.fuer?.name}</h2>
          </div>
          <button type="button" className="mp-klein" onClick={onZu}>Schließen</button>
        </div>
        {p.ok ? (
          <>
            <p className="mp-betreff">Betreff: {p.betreff}</p>
            <pre className="mp-mail-text">{p.text}</pre>
          </>
        ) : (
          <>
            <p className="mp-grund">Diese Mail würde Mara zurückhalten: {p.grund}</p>
            {p.kern && <pre className="mp-mail-text">{p.kern}</pre>}
          </>
        )}
        <p className="mp-still">Kosten dieser Probe: {Number(p.kostenCents || 0).toFixed(2).replace(".", ",")} ct</p>
      </div>
    </div>
  );
}
