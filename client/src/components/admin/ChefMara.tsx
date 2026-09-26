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
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { API, seit, Geruest, Fehlermeldung, useDaten } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-mara.css";
import "@/styles/chef-wa-zentrale.css";
import ChefWhatsAppZentrale from "./ChefWhatsAppZentrale";
// E-243 (26.09.2026): Der Verkauf der Bonitätsauskunft wohnt hier, nicht auf einer eigenen Seite — erst beim Öffnen geladen.
const AuskunftVerkauf = lazy(() => import("./ChefAuskunft"));
const AuskunftBeschaffung = lazy(() => import("./ChefAuskunftBeschaffung"));

interface Einstellungen { an: boolean; jeStunde: number; tagEuro: number; stufen: string[]; emojis: boolean; postfach: string; start: string | null }
interface Stand {
  einstellungen: Einstellungen;
  zaehler: { letzteStunde: number; heute: number; tagesDeckel: number; kostenHeuteEuro: number };
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

// ═══════════════════════════════════════════════════════════════════════════
// MARA ANWEISEN (23.09.2026, E-219)
//
// Justin: „Ich möchte quasi mit Mara kommunizieren … ich soll aber eben alles
// steuern, von ihrem gesamten Wissen, allen Zugriffen — einfach alles."
//
// Ein Feld, ein Satz, ein Plan. Der Plan zeigt jeden Schritt mit Namen und
// Klasse; endgültige Schritte sind rot. Erst der Klick wirkt.
// ═══════════════════════════════════════════════════════════════════════════
interface Schritt { werkzeug: string; argumente: any; wen: string; warum: string; klasse: string }
interface Auftrag {
  id: number; befehl: string; absicht: string | null; status: string; rueckfrage: string | null;
  plan: Schritt[]; ergebnis: { werkzeug?: string; wen?: string; ok?: boolean; text?: string }[];
  von: string; erstelltAm: string; fertigAm: string | null; dauerauftragId: number | null;
}
interface Dauer { id: number; befehl: string; takt: string; uhrzeit: string; an: boolean; letzterLauf: string | null; letzteMeldung: string | null }
interface MaraDaten {
  auftraege: Auftrag[];
  dauerauftraege: Dauer[];
  werkzeuge: { name: string; beschreibung: string; klasse: string; felder: string }[];
  tag: any;
}
const KLASSE_TEXT: Record<string, string> = { lesen: "nachsehen", umkehrbar: "umkehrbar", endgueltig: "endgültig" };
const STATUS_TEXT: Record<string, string> = {
  entwurf: "wartet auf dich", rueckfrage: "Rückfrage", laeuft: "läuft",
  fertig: "erledigt", teilweise: "teilweise", verworfen: "verworfen",
};

function MaraBefehl({ melden }: { melden: (t: string) => void }) {
  const d = useDaten<MaraDaten>("/chef/mara/auftraege");
  const [befehl, setBefehl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dauerBefehl, setDauerBefehl] = useState("");
  const [dauerZeit, setDauerZeit] = useState("09:00");
  const [dauerTakt, setDauerTakt] = useState("taeglich");
  const [wissenOffen, setWissenOffen] = useState(false);

  const ruf = async (pfad: string, koerper?: unknown) => {
    const r = await fetch(`${API}${pfad}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(koerper ?? {}),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) throw new Error(j?.error || "Das hat nicht geklappt.");
    return j;
  };

  const planen = async () => {
    if (befehl.trim().length < 4) return;
    setBusy("plan");
    try {
      const j = await ruf("/chef/mara/auftrag", { befehl: befehl.trim() });
      melden(j.auftrag?.status === "rueckfrage" ? "Mara hat eine Rückfrage — sie steht unten." : "Plan steht — sieh ihn dir an und bestätige.");
      setBefehl(""); d.neu();
    } catch (e: any) { melden(e.message); } finally { setBusy(null); }
  };

  const ausfuehren = async (a: Auftrag) => {
    const endgueltig = a.plan.filter((s) => s.klasse === "endgueltig");
    if (endgueltig.length && !window.confirm(
      `Dieser Auftrag enthält ${endgueltig.length} endgültige(n) Schritt:\n\n`
      + endgueltig.map((s) => `· ${s.werkzeug}${s.wen ? ` — ${s.wen}` : ""}`).join("\n")
      + "\n\nDas lässt sich nicht mit einem Klick zurücknehmen. Ausführen?")) return;
    setBusy(`a${a.id}`);
    try {
      const j = await ruf(`/chef/mara/auftrag/${a.id}/ausfuehren`);
      melden((j.ergebnis ?? []).map((x: any) => x.text).join(" · ") || "Erledigt.");
      d.neu();
    } catch (e: any) { melden(e.message); } finally { setBusy(null); }
  };

  const verwerfen = async (id: number) => {
    setBusy(`v${id}`);
    try { await ruf(`/chef/mara/auftrag/${id}/verwerfen`); melden("Verworfen."); d.neu(); }
    catch (e: any) { melden(e.message); } finally { setBusy(null); }
  };

  const dauerAnlegen = async () => {
    if (dauerBefehl.trim().length < 4) return;
    setBusy("dauer");
    try {
      await ruf("/chef/mara/dauerauftrag", { befehl: dauerBefehl.trim(), takt: dauerTakt, uhrzeit: dauerZeit });
      melden("Dauerauftrag angelegt. Er wird bei jedem Lauf neu geplant.");
      setDauerBefehl(""); d.neu();
    } catch (e: any) { melden(e.message); } finally { setBusy(null); }
  };

  if (d.fehler) return <section className="mp-karte"><h2>Mara anweisen</h2><Fehlermeldung text={d.fehler} erneut={d.neu} /></section>;
  if (!d.daten) return <section className="mp-karte"><h2>Mara anweisen</h2><Geruest zeilen={3} /></section>;

  const t = d.daten.tag;
  const offen = d.daten.auftraege.filter((a) => a.status === "entwurf" || a.status === "rueckfrage");
  const erledigt = d.daten.auftraege.filter((a) => a.status !== "entwurf" && a.status !== "rueckfrage");

  return (
    <section className="mp-karte mp-befehl" aria-label="Mara anweisen">
      <div className="mp-karte-kopf">
        <div>
          <h2>Mara anweisen</h2>
          <p className="mp-still">
            Schreib in einem Satz, was passieren soll. Mara legt dir einen Plan vor — nichts wirkt, bevor du bestätigst.
          </p>
        </div>
      </div>

      <div className="mp-befehl-eingabe">
        <textarea rows={2} value={befehl} maxLength={1000}
          onChange={(ev) => setBefehl(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) void planen(); }}
          placeholder="Zum Beispiel: Kündige den Kunden Gerold Kuhn, er hat angerufen. (⌘ + Enter)" />
        <button type="button" className="mp-knopf voll" disabled={busy === "plan" || befehl.trim().length < 4} onClick={() => void planen()}>
          {busy === "plan" ? "Denkt nach …" : "Plan bauen"}
        </button>
      </div>

      {/* ── Maras Tag ────────────────────────────────────────────────── */}
      {t && (
        <div className="mp-tag">
          <b>Maras Tag</b>
          <span>{t.mails?.geschrieben ?? 0} Mails · {t.whatsapp?.raus ?? 0} WhatsApp an {t.whatsapp?.menschen ?? 0} Menschen
            · {t.auftraege?.gelaufen ?? 0} Aufträge gelaufen · {t.kostenEuro?.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € KI-Kosten</span>
          {(t.offen ?? []).length > 0 && (
            <span className="mp-tag-offen">{t.offen.map((o: any) => `${o.wieviel} ${o.was}`).join(" · ")}</span>
          )}
        </div>
      )}

      {/* ── Was auf dich wartet ──────────────────────────────────────── */}
      {offen.length > 0 && (
        <div className="mp-auftraege">
          <h3>Wartet auf dich</h3>
          {offen.map((a) => (
            <div key={a.id} className={`mp-auftrag${a.status === "rueckfrage" ? " frage" : ""}`}>
              <p className="mp-auftrag-befehl">„{a.befehl}"</p>
              {a.rueckfrage
                ? <p className="mp-auftrag-frage">{a.rueckfrage}</p>
                : (
                  <>
                    {a.absicht && <p className="mp-still">{a.absicht}</p>}
                    <ol className="mp-plan">
                      {a.plan.map((sch, i) => (
                        <li key={i} className={sch.klasse === "endgueltig" ? "endgueltig" : ""}>
                          <b>{sch.werkzeug.replace(/_/g, " ")}</b>
                          {sch.wen ? <span className="mp-wen">{sch.wen}</span> : null}
                          <span className={`mp-klasse ${sch.klasse}`}>{KLASSE_TEXT[sch.klasse] ?? sch.klasse}</span>
                          {sch.warum && <span className="mp-still">{sch.warum}</span>}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              <div className="mp-auftrag-tun">
                {!a.rueckfrage && a.plan.length > 0 && (
                  <button type="button" className="mp-knopf voll" disabled={!!busy} onClick={() => void ausfuehren(a)}>
                    {busy === `a${a.id}` ? "Läuft …" : "Ausführen"}
                  </button>
                )}
                <button type="button" className="mp-klein" disabled={!!busy} onClick={() => void verwerfen(a.id)}>Verwerfen</button>
                <span className="mp-still">{seit(a.erstelltAm)} · {a.von}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Daueraufträge ────────────────────────────────────────────── */}
      <div className="mp-dauer">
        <h3>Daueraufträge</h3>
        <p className="mp-still">
          Wiederkehrend, bei jedem Lauf neu geplant. Enthält ein Lauf einen endgültigen Schritt, wartet er auf deinen Klick —
          ein Dauerauftrag kündigt niemanden von selbst.
        </p>
        {d.daten.dauerauftraege.map((x) => (
          <div key={x.id} className="mp-dauer-zeile">
            <div>
              <b>„{x.befehl}"</b>
              <span className="mp-still">{x.takt === "werktags" ? "werktags" : x.takt === "woechentlich" ? "montags" : "täglich"} um {x.uhrzeit}
                {x.letzterLauf ? ` · zuletzt ${seit(x.letzterLauf)}` : " · noch nie gelaufen"}</span>
              {x.letzteMeldung && <span className="mp-still">{x.letzteMeldung}</span>}
            </div>
            <div className="mp-dauer-tun">
              <button type="button" className={`mp-schalter klein${x.an ? " an" : ""}`}
                onClick={() => void ruf(`/chef/mara/dauerauftrag/${x.id}`, { an: !x.an }).then(() => d.neu()).catch((e) => melden(e.message))}>
                <span className="mp-schalter-knopf" />{x.an ? "an" : "aus"}
              </button>
              <button type="button" className="mp-klein"
                onClick={() => { if (window.confirm("Diesen Dauerauftrag löschen?")) void ruf(`/chef/mara/dauerauftrag/${x.id}`, { loeschen: true }).then(() => d.neu()).catch((e) => melden(e.message)); }}>
                Löschen
              </button>
            </div>
          </div>
        ))}
        <div className="mp-befehl-eingabe">
          <input value={dauerBefehl} maxLength={500} onChange={(ev) => setDauerBefehl(ev.target.value)}
            placeholder="Zum Beispiel: Schau, wer heute Geburtstag hat, und schick eine Glückwunsch-Nachricht." />
          <select value={dauerTakt} onChange={(ev) => setDauerTakt(ev.target.value)}>
            <option value="taeglich">täglich</option>
            <option value="werktags">werktags</option>
            <option value="woechentlich">montags</option>
          </select>
          <input type="time" value={dauerZeit} onChange={(ev) => setDauerZeit(ev.target.value)} />
          <button type="button" className="mp-knopf" disabled={busy === "dauer" || dauerBefehl.trim().length < 4} onClick={() => void dauerAnlegen()}>
            {busy === "dauer" ? "Legt an …" : "Dauerauftrag anlegen"}
          </button>
        </div>
      </div>

      {/* ── Ihr Wissen und ihre Zugriffe ─────────────────────────────── */}
      <details className="mp-wissen" onToggle={(ev) => setWissenOffen((ev.target as HTMLDetailsElement).open)}>
        <summary>Was Mara darf — {d.daten.werkzeuge.length} Werkzeuge</summary>
        {wissenOffen && (
          <ul className="mp-werkzeuge">
            {d.daten.werkzeuge.map((w) => (
              <li key={w.name}>
                <b>{w.name.replace(/_/g, " ")}</b>
                <span className={`mp-klasse ${w.klasse}`}>{KLASSE_TEXT[w.klasse] ?? w.klasse}</span>
                <span className="mp-still">{w.beschreibung}</span>
              </li>
            ))}
            <li className="mp-nicht">
              <b>nicht: Texte im Quelltext der Website</b>
              <span className="mp-still">
                Dafür bräuchte sie Schreibrechte auf den laufenden Code; ein falscher Satz dort nimmt die ganze Seite mit.
                Texte aus der Datenbank kann sie ändern.
              </span>
            </li>
          </ul>
        )}
      </details>

      {/* ── Was gelaufen ist ─────────────────────────────────────────── */}
      {erledigt.length > 0 && (
        <details className="mp-verlauf">
          <summary>Was gelaufen ist ({erledigt.length})</summary>
          {erledigt.map((a) => (
            <div key={a.id} className="mp-auftrag erledigt">
              <p className="mp-auftrag-befehl">„{a.befehl}" <span className="mp-klasse">{STATUS_TEXT[a.status] ?? a.status}</span></p>
              <ul className="mp-ergebnis">
                {(a.ergebnis ?? []).map((r, i) => (
                  <li key={i} className={r.ok === false ? "fehler" : ""}>{r.text}{r.wen ? ` — ${r.wen}` : ""}</li>
                ))}
              </ul>
              <span className="mp-still">{seit(a.fertigAm ?? a.erstelltAm)} · {a.von}</span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function MaraMailAktion() {
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
    if (!window.confirm("Mara schickt jetzt die nächsten Mails — nach denselben Regeln wie im Takt (Stunde, Kostendeckel). Weiter?")) return;
    setBeschaeftigt("durchgang");
    try {
      const j = await senden("/chef/mara/durchgang", {});
      const r = j.ergebnis || {};
      melden(r.grund ? `Kein Versand: ${r.grund}.` : `${r.gesendet} gesendet, ${r.abgelehnt} von der Prüfung zurückgehalten${r.fehler ? `, ${r.fehler} Fehler` : ""}.`);
      stand.neu(); setRunde((x) => x + 1);
    } catch (err: any) { melden(err.message); } finally { setBeschaeftigt(null); }
  };

  const rate = e ? e.jeStunde : 0;

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
            <Zahl titel="Heute gesendet" wert={`${s.zaehler.heute}`} unter={`von ${s.zaehler.tagesDeckel} möglich (24 × ${e.jeStunde})`} />
            <Zahl titel="Letzte Stunde" wert={`${s.zaehler.letzteStunde}`} unter={`Takt jetzt ${rate} je Stunde`} />
            <Zahl titel="In der Schlange" wert={`${s.schlange.length}${s.schlange.length >= 40 ? "+" : ""}`} unter="fällig, nach Hitze" />
            <Zahl titel="Antworten" wert={`${s.zahlen.antworten}`} unter={`von ${s.zahlen.menschen} Menschen · 14 Tage`} ton="blau" />
            <Zahl titel="Zahlung danach" wert={`${s.zahlen.bezahlt}`} unter={`bezahlt · ${s.zahlen.gemeldet} gemeldet · 14 Tage`} ton="gruen" />
            <Zahl titel="Kosten heute" wert={euro(s.kosten.heuteEuro)} unter={`Deckel ${euro(e.tagEuro)} · Woche ${euro(s.kosten.wocheEuro)}`} />
          </section>

          <section className="mp-steuer" aria-label="Steuerung">
            <div className="mp-feld">
              <label htmlFor="mp-stunde">Mails je Stunde <b>{e.jeStunde}</b></label>
              <input id="mp-stunde" type="range" min={0} max={500} step={10} defaultValue={e.jeStunde}
                onMouseUp={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)}
                onTouchEnd={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)}
                onKeyUp={(ev) => void setzen("mara_aktion_je_stunde", (ev.target as HTMLInputElement).value, `Takt: ${(ev.target as HTMLInputElement).value} je Stunde.`)} />
              <small>{(e.jeStunde * 24).toLocaleString("de-DE")} am Tag</small>
            </div>
            <div className="mp-feld">
              <label htmlFor="mp-euro">Kostendeckel je Tag</label>
              <div className="mp-reihe">
                <input id="mp-euro" type="number" min={0} max={500} defaultValue={e.tagEuro} className="mp-zahlfeld"
                  onBlur={(ev) => { if (Number(ev.target.value) !== e.tagEuro) void setzen("mara_aktion_tag_euro", ev.target.value, `Kostendeckel: ${ev.target.value} € am Tag.`); }} />
                <span>€</span>
              </div>
              <small>rund {(((e.jeStunde * 24) * 0.005)).toFixed(2).replace(".", ",")} € bei vollem Takt</small>
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

          {/* E-219: Mara anweisen — Befehl, Plan, ein Klick. */}
          <MaraBefehl melden={melden} />

          <Anweisungen melden={melden} />

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

/** Warum diese Mail so aussieht — erst geladen, wenn man es aufklappt. */
function Denkprotokoll({ id }: { id: number }) {
  const [offen, setOffen] = useState(false);
  const [daten, setDaten] = useState<{ wissen: Record<string, unknown> | null; maengel: string[]; verlauf: { wer: string; art: string; text: string; am: string }[] } | null>(null);
  const [laedt, setLaedt] = useState(false);
  useEffect(() => {
    if (!offen || daten) return;
    let weg = false;
    setLaedt(true);
    fetch(`${API}/chef/mara/denkprotokoll/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg && j?.ok) setDaten(j); })
      .catch(() => {})
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
  }, [offen, id, daten]);
  const d = { daten, laedt };
  return (
    <details className="mp-auftrag" onToggle={(e) => setOffen((e.target as HTMLDetailsElement).open)}>
      <summary>Denkprotokoll — was sie wusste und was geprüft wurde</summary>
      {!offen ? null : d.laedt && !d.daten ? <Geruest zeilen={3} /> : d.daten ? (
        <div className="mp-wissen">
          <ul>
            {Object.entries(d.daten.wissen ?? {}).map(([k, v]) => (
              <li key={k}><span className="mp-still">{WISSEN_TEXT[k] ?? k}</span> {v === null || v === "" ? "—" : String(v)}</li>
            ))}
            {!d.daten.wissen && <li className="mp-still">Für diese Mail wurde noch kein Protokoll mitgeschrieben (vor dem 22.09.2026).</li>}
          </ul>
          {d.daten.maengel?.length > 0 && (
            <p className="mp-grund">Die Prüfung hatte etwas zu beanstanden: {d.daten.maengel.join(" · ")}</p>
          )}
          {d.daten.verlauf?.length > 0 && (
            <>
              <h3>Was im Haus um diese Zeit passiert ist</h3>
              <ul className="mp-post">
                {d.daten.verlauf.slice(0, 6).map((v, i) => (
                  <li key={`${i}-${v.am}`}><span className="mp-still">{zeit(v.am)} · {v.wer}</span> {v.text}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : <p className="mp-still">Nicht ladbar.</p>}
    </details>
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
        <Denkprotokoll id={m.id} />
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

/**
 * Maras Anweisung — Justins eigene Stimme im Kopf der Agentin.
 * Der lange Auftrag bleibt im Quelltext (dort hängen Werkzeuge und Prüfungen);
 * was hier steht, kommt GANZ OBEN hinein und gewinnt im Zweifel.
 */
function Anweisungen({ melden }: { melden: (t: string) => void }) {
  const stand = useDaten<{ bereiche: { bereich: string; titel: string; text: string; verlauf: { id: number; text: string; von: string | null; aktiv: boolean; am: string }[] }[]; maxZeichen: number }>("/chef/mara/anweisung");
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [speichert, setSpeichert] = useState<string | null>(null);
  const b = stand.daten?.bereiche ?? [];

  const speichern = async (bereich: string, text: string) => {
    setSpeichert(bereich);
    try {
      const j = await senden("/chef/mara/anweisung", { bereich, text });
      melden(j.zeichen ? `Anweisung gespeichert (${j.zeichen} Zeichen) — sie gilt ab der nächsten Nachricht.` : "Anweisung gelöscht — Mara arbeitet wieder nur nach den Hausregeln.");
      setEntwurf((e) => { const n = { ...e }; delete n[bereich]; return n; });
      stand.neu();
    } catch (err: any) { melden(err.message); } finally { setSpeichert(null); }
  };
  const zurueck = async (id: number) => {
    try { await senden("/chef/mara/anweisung/zurueck", { id }); melden("Frühere Fassung ist wieder gültig."); stand.neu(); }
    catch (err: any) { melden(err.message); }
  };

  return (
    <section className="mp-karte" aria-label="Maras Anweisung">
      <div className="mp-karte-kopf">
        <div>
          <h2>Deine Anweisung an Mara</h2>
          <p className="mp-still">Steht vor allem anderen in ihrem Auftrag. Die Hausregeln bleiben darüber.</p>
        </div>
      </div>
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {!stand.daten ? <Geruest zeilen={3} /> : b.map((x) => {
        const wert = entwurf[x.bereich] ?? x.text;
        const geaendert = wert !== x.text;
        return (
          <div key={x.bereich} className="mp-anweisung">
            <label className="mp-etikett" htmlFor={`anw-${x.bereich}`}>{x.titel}</label>
            <textarea
              id={`anw-${x.bereich}`}
              className="mp-feld-gross"
              rows={4}
              maxLength={stand.daten!.maxZeichen}
              placeholder="Noch nichts hinterlegt — Mara arbeitet nach den Hausregeln."
              value={wert}
              onChange={(ev) => setEntwurf((e) => ({ ...e, [x.bereich]: ev.target.value }))}
            />
            <div className="mp-reihe">
              <span className="mp-still">{wert.length} / {stand.daten!.maxZeichen} Zeichen</span>
              <button type="button" className="mp-knopf voll" disabled={!geaendert || speichert === x.bereich} onClick={() => void speichern(x.bereich, wert)}>
                {speichert === x.bereich ? "Speichert …" : "Speichern — gilt sofort"}
              </button>
              {geaendert && (
                <button type="button" className="mp-klein" onClick={() => setEntwurf((e) => { const n = { ...e }; delete n[x.bereich]; return n; })}>Verwerfen</button>
              )}
            </div>
            {x.verlauf.length > 1 && (
              <details className="mp-auftrag">
                <summary>Frühere Fassungen ({x.verlauf.length - 1})</summary>
                <ul className="mp-post">
                  {x.verlauf.filter((v) => !v.aktiv).map((v) => (
                    <li key={v.id}>
                      <span className="mp-still">{zeit(v.am)} · {v.von ?? "—"}</span> {v.text.slice(0, 160)}{v.text.length > 160 ? " …" : ""}
                      <button type="button" className="mp-klein" onClick={() => void zurueck(v.id)}>Zurückholen</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Die Punkte des Denkprotokolls in Hauswort. */
const WISSEN_TEXT: Record<string, string> = {
  stufe: "Stufe:", schritt: "Wievielte Mail:", betreuer: "Betreuer:", faelligAm: "Rate fällig:",
  paket: "Paket:", offeneRate: "Offene Rate:", gedaechtnis: "Aus dem Gedächtnis:",
  fruehereMails: "Frühere Mails an ihn:", hausanweisung: "Deine Anweisung galt:", auftragZeichen: "Auftrag (Zeichen):",
};

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
        {p.wissen && (
          <div className="mp-wissen">
            <h3>Was sie dabei wusste</h3>
            <ul>
              {Object.entries(p.wissen as Record<string, unknown>).map(([k, v]) => (
                <li key={k}><span className="mp-still">{WISSEN_TEXT[k] ?? k}</span> {v === null || v === "" ? "—" : String(v)}</li>
              ))}
            </ul>
          </div>
        )}
        {p.auftrag && (
          <details className="mp-auftrag">
            <summary>Ihr ganzer Auftragstext ({Number(p.auftrag.length).toLocaleString("de-DE")} Zeichen)</summary>
            <pre className="mp-mail-text">{p.auftrag}</pre>
          </details>
        )}
        <p className="mp-still">Kosten dieser Probe: {Number(p.kostenCents || 0).toFixed(2).replace(".", ",")} ct</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DREI REITER (23.09.2026, E-229 · 26.09.2026, E-243)
//
// Justin: „bau mir eine von den Seiten um und neu auf, sodass ich von dort aus
// wirklich alles steuern kann." Mara arbeitet über zwei Wege — WhatsApp und
// Mail. Beide stehen hier, WhatsApp vorne. ?reiter=mail öffnet die Mail-Aktion.
//
// E-243, Justin 26.09.2026: „das soll nicht schon wieder eine neue eigene Seite
// sein, pflege das logisch hier irgendwo ein" — der dritte Reiter ist der
// Verkauf der Bonitätsauskunft (vorher /chef/s/auskunft): Trichter, „Verkauf
// scharf stellen", Steuerung, Pool, Rückstand. ?reiter=auskunft öffnet ihn,
// &ansicht=beschaffung die Beschaffung. Die Beschaffung bleibt zusätzlich als
// Arbeitsplatz im Raum „Kunden" (/chef/s/auskunft-beschaffung): Dort arbeitet
// das Team ab Stufe Geschäftsführung, und die Aufgaben verlinken dorthin.
// ═══════════════════════════════════════════════════════════════════════════
type MaraReiter = "whatsapp" | "mail" | "auskunft";
type AuskunftAnsicht = "verkauf" | "beschaffung";

function ausAdresse(): { reiter: MaraReiter; ansicht: AuskunftAnsicht } {
  try {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("reiter");
    return {
      reiter: r === "mail" ? "mail" : r === "auskunft" ? "auskunft" : "whatsapp",
      ansicht: q.get("ansicht") === "beschaffung" ? "beschaffung" : "verkauf",
    };
  } catch { return { reiter: "whatsapp", ansicht: "verkauf" }; }
}

export default function ChefMara() {
  const [stand, setStand] = useState(ausAdresse);
  const wechseln = (reiter: MaraReiter, ansicht: AuskunftAnsicht = "verkauf") => {
    setStand({ reiter, ansicht });
    try {
      const u = new URL(window.location.href);
      if (reiter === "whatsapp") u.searchParams.delete("reiter"); else u.searchParams.set("reiter", reiter);
      if (reiter === "auskunft" && ansicht === "beschaffung") u.searchParams.set("ansicht", "beschaffung"); else u.searchParams.delete("ansicht");
      window.history.replaceState(null, "", u.toString());
    } catch { /* Adresse bleibt, der Reiter wechselt trotzdem */ }
  };
  const { reiter, ansicht } = stand;
  return (
    <div>
      <div className="mara-reiter" role="tablist" aria-label="Maras Wege">
        <button type="button" role="tab" aria-selected={reiter === "whatsapp"} onClick={() => wechseln("whatsapp")}>WhatsApp-Zentrale</button>
        <button type="button" role="tab" aria-selected={reiter === "mail"} onClick={() => wechseln("mail")}>E-Mail-Aktion</button>
        <button type="button" role="tab" aria-selected={reiter === "auskunft"} onClick={() => wechseln("auskunft")}>Bonitätsauskunft</button>
      </div>
      {reiter === "whatsapp" && <ChefWhatsAppZentrale />}
      {reiter === "mail" && <MaraMailAktion />}
      {reiter === "auskunft" && (
        <>
          <div className="mara-ansicht" role="group" aria-label="Bonitätsauskunft">
            <button type="button" aria-pressed={ansicht === "verkauf"} onClick={() => wechseln("auskunft", "verkauf")}>Verkauf</button>
            <button type="button" aria-pressed={ansicht === "beschaffung"} onClick={() => wechseln("auskunft", "beschaffung")}>Beschaffung</button>
          </div>
          <Suspense fallback={<Geruest zeilen={8} />}>
            {ansicht === "verkauf" ? <AuskunftVerkauf /> : <AuskunftBeschaffung />}
          </Suspense>
        </>
      )}
    </div>
  );
}
