// ═══════════════════════════════════════════════════════════════════════════
// /agent/tagesbericht — DER TAGESABSCHLUSS (23.09.2026, E-216)
//
// Justin: „Er wird gefragt: ‚Das System hat folgendes über Ihren heutigen
// Arbeitstag aufgezeichnet …‘ — so detailliert wie möglich, dass er sich denkt
// ‚wow, geil, was die alles wissen‘."
//
// Die Seite hat drei Teile, in dieser Reihenfolge:
//   1. WAS WIR WISSEN — die Aufzeichnung. Zahlen, Zeiten, Namen. Sie steht
//      zuerst, weil sie der Grund ist, warum der Rest ernst genommen wird.
//   2. WAS WIR NICHT WISSEN KÖNNEN — Gespräche über das eigene Telefon und
//      Zusagen, die noch nirgends stehen. Mit Namen, sonst ist es eine Zahl
//      ohne Deckung.
//   3. WIE DER TAG WAR — drei Felder, keine Pflicht.
//
// Die Systemzahl und die Selbstangabe stehen NEBENEINANDER und werden nie
// addiert. Wer 12 gezählte und 38 ergänzte Gespräche hat, soll genau das sehen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell, api } from "./shared";
import "@/styles/office-tagesbericht.css";

interface Aufzeichnung {
  tag: string;
  anrufe: { gesamt: number; gespraeche: number; minuten: number; ersterUm: string | null; letzterUm: string | null; nummern: number };
  ergebnisse: { gesamt: number; jeArt: { art: string; text: string; n: number }[] };
  termine: { gebucht: number; namen: string[] };
  zahlungGemeldet: { anzahl: number; namen: string[] };
  mandate: number;
  whatsapp: number;
  erstesZeichen: string | null;
  letztesZeichen: string | null;
}
interface Kunde { id: number; name: string; stufe: number }
interface Daten {
  aufzeichnung: Aufzeichnung;
  kunden: Kunde[];
  ergebnisse: { wert: string; text: string }[];
  stand: { faellig: boolean; abgegeben: boolean; tag: string; abUm: string | null; gestern: { tag: string; fehlt: boolean } };
  sperreAb: string;
  bereits: { abgegebenAm: string; anrufeSelbst: number; gut: string | null; schlecht: string | null; verbesserung: string | null; stimmung: number | null } | null;
}

const tagText = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

export default function Tagesbericht() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fertig, setFertig] = useState<string | null>(null);

  const [anrufeSelbst, setAnrufeSelbst] = useState("");
  const [nachgetragen, setNachgetragen] = useState<{ personId: number; ergebnis: string }[]>([]);
  const [zusagen, setZusagen] = useState<{ personId: number; datum: string }[]>([]);
  const [gut, setGut] = useState("");
  const [schlecht, setSchlecht] = useState("");
  const [verbesserung, setVerbesserung] = useState("");
  const [stimmung, setStimmung] = useState<number | null>(null);

  const laden = useCallback(async () => {
    const r = await api("/agent/tagesbericht");
    if (!r.ok) { setFehler(r.json?.error || "Der Tagesbericht ließ sich nicht laden."); return; }
    setD(r.json);
    if (r.json.bereits) {
      setAnrufeSelbst(String(r.json.bereits.anrufeSelbst || ""));
      setGut(r.json.bereits.gut ?? ""); setSchlecht(r.json.bereits.schlecht ?? "");
      setVerbesserung(r.json.bereits.verbesserung ?? ""); setStimmung(r.json.bereits.stimmung ?? null);
    }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const kundenName = useMemo(() => {
    const m = new Map<number, string>();
    for (const k of d?.kunden ?? []) m.set(k.id, k.name);
    return m;
  }, [d]);

  const abgeben = async () => {
    setBusy(true);
    const r = await api("/agent/tagesbericht", {
      method: "POST",
      body: JSON.stringify({
        anrufeSelbst: Number(anrufeSelbst) || 0,
        nachgetragen: nachgetragen.filter((n) => n.personId && n.ergebnis),
        zusagen: zusagen.filter((z) => z.personId && z.datum),
        gut, schlecht, verbesserung, stimmung,
      }),
    });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Der Bericht ließ sich nicht speichern."); return; }
    setFertig(
      `Danke. ${r.json.gebucht > 0 ? `${r.json.gebucht} Gespräch(e) sind jetzt in den Akten — diese Menschen stehen morgen nicht mehr in deiner Liste. ` : ""}`
      + `${r.json.zusagen > 0 ? `${r.json.zusagen} Zusage(n) sind eingetragen. ` : ""}`
      + `${r.json.ticket ? "Dein Verbesserungsvorschlag liegt als Ticket bei der Leitung." : ""}`,
    );
    void laden();
  };

  if (fehler && !d) return <AgentShell><p className="tb-fehler">{fehler}</p></AgentShell>;
  if (!d) return <AgentShell><p className="tb-still">Lädt …</p></AgentShell>;

  const a = d.aufzeichnung;
  const gezaehlt = a.anrufe.gesamt;
  const ergaenzt = Number(anrufeSelbst) || 0;

  return (
    <AgentShell>
      <div className="tb">
        <header className="tb-kopf">
          <div>
            <span className="tb-pille">Tagesabschluss</span>
            <h1>{tagText(a.tag)}</h1>
            <p>Das hat das System über deinen Arbeitstag aufgezeichnet. Ergänze, was es nicht wissen kann.</p>
          </div>
          {d.bereits && <span className="tb-marke gut">Bereits abgegeben</span>}
        </header>

        {d.stand.gestern.fehlt && (
          <div className="tb-hinweis">
            Für <b>{tagText(d.stand.gestern.tag)}</b> fehlt dein Bericht noch.
            Ab dem {new Date(`${d.sperreAb}T12:00:00`).toLocaleDateString("de-DE")} braucht die Arbeitsliste den Bericht vom Vortag.
          </div>
        )}

        {/* ── 1. WAS WIR WISSEN ──────────────────────────────────────────── */}
        <section className="tb-block">
          <h2>Was aufgezeichnet wurde</h2>

          <div className="tb-zahlen">
            <div className="tb-zahl"><span>Anrufe über das System</span><b>{a.anrufe.gesamt}</b>
              <small>{a.anrufe.gespraeche} davon länger als 30 Sekunden</small></div>
            <div className="tb-zahl"><span>Am Telefon</span><b>{a.anrufe.minuten}<i>Min.</i></b>
              <small>{a.anrufe.nummern} verschiedene Nummern</small></div>
            <div className="tb-zahl"><span>Gebuchte Ergebnisse</span><b>{a.ergebnisse.gesamt}</b>
              <small>{a.erstesZeichen ? `erstes ${a.erstesZeichen}, letztes ${a.letztesZeichen}` : "noch keins"}</small></div>
            <div className="tb-zahl"><span>Termine gebucht</span><b>{a.termine.gebucht}</b>
              <small>{a.termine.namen.slice(0, 2).join(", ") || "—"}</small></div>
          </div>

          {a.ergebnisse.jeArt.length > 0 && (
            <div className="tb-liste">
              {a.ergebnisse.jeArt.map((e) => (
                <div key={e.art} className="tb-zeile"><span>{e.text}</span><b>{e.n}</b></div>
              ))}
            </div>
          )}

          <div className="tb-liste">
            {a.zahlungGemeldet.anzahl > 0 && (
              <div className="tb-zeile"><span>Zahlung gemeldet{a.zahlungGemeldet.namen.length ? `: ${a.zahlungGemeldet.namen.join(", ")}` : ""}</span><b>{a.zahlungGemeldet.anzahl}</b></div>
            )}
            {a.mandate > 0 && <div className="tb-zeile"><span>Mandate übernommen</span><b>{a.mandate}</b></div>}
            {a.whatsapp > 0 && <div className="tb-zeile"><span>WhatsApp geschrieben</span><b>{a.whatsapp}</b></div>}
            {a.anrufe.ersterUm && (
              <div className="tb-zeile"><span>Erster Anruf {a.anrufe.ersterUm}, letzter {a.anrufe.letzterUm}</span><b /></div>
            )}
          </div>
        </section>

        {/* ── 2. WAS WIR NICHT WISSEN KÖNNEN ─────────────────────────────── */}
        <section className="tb-block">
          <h2>Was wir nicht wissen können</h2>
          <p className="tb-still">
            Über dein eigenes Handy geführte Gespräche sieht das System nicht.
            Was du hier einträgst, landet in der Akte — und diese Menschen stehen morgen nicht mehr in deiner Liste.
          </p>

          <label className="tb-feld">
            <span>Wie viele Menschen hast du darüber hinaus telefonisch erreicht?</span>
            <input type="number" min={0} max={999} value={anrufeSelbst}
                   onChange={(e) => setAnrufeSelbst(e.target.value)} placeholder="0" />
          </label>
          {ergaenzt > 0 && (
            <p className="tb-gegen">
              <b>{gezaehlt}</b> vom System gezählt · <b>{ergaenzt}</b> von dir ergänzt.
              Beide Zahlen bleiben getrennt stehen.
            </p>
          )}

          <h3>Mit wem? <small>Jeder Eintrag wird als Gesprächsergebnis gebucht.</small></h3>
          {nachgetragen.map((n, i) => (
            <div key={i} className="tb-paar">
              <select value={n.personId || ""} onChange={(e) => setNachgetragen((v) => v.map((x, j) => j === i ? { ...x, personId: Number(e.target.value) } : x))}>
                <option value="">Mensch wählen …</option>
                {d.kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <select value={n.ergebnis} onChange={(e) => setNachgetragen((v) => v.map((x, j) => j === i ? { ...x, ergebnis: e.target.value } : x))}>
                <option value="">Ergebnis …</option>
                {d.ergebnisse.map((e) => <option key={e.wert} value={e.wert}>{e.text}</option>)}
              </select>
              <button type="button" className="tb-weg" onClick={() => setNachgetragen((v) => v.filter((_x, j) => j !== i))} aria-label="Zeile entfernen">×</button>
            </div>
          ))}
          <button type="button" className="tb-klein" onClick={() => setNachgetragen((v) => [...v, { personId: 0, ergebnis: "" }])}>
            Gespräch nachtragen
          </button>

          <h3>Hat dir jemand Zahlung zugesagt? <small>Wird als Zusage eingetragen — Mahnlauf und Pipeline wissen es dann.</small></h3>
          {zusagen.map((z, i) => (
            <div key={i} className="tb-paar">
              <select value={z.personId || ""} onChange={(e) => setZusagen((v) => v.map((x, j) => j === i ? { ...x, personId: Number(e.target.value) } : x))}>
                <option value="">Mensch wählen …</option>
                {d.kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
              <input type="date" value={z.datum} onChange={(e) => setZusagen((v) => v.map((x, j) => j === i ? { ...x, datum: e.target.value } : x))} />
              <button type="button" className="tb-weg" onClick={() => setZusagen((v) => v.filter((_x, j) => j !== i))} aria-label="Zeile entfernen">×</button>
            </div>
          ))}
          <button type="button" className="tb-klein" onClick={() => setZusagen((v) => [...v, { personId: 0, datum: "" }])}>
            Zusage nachtragen
          </button>
          {zusagen.some((z) => z.personId && kundenName.get(z.personId)) && (
            <p className="tb-still">
              Eingetragen für: {zusagen.filter((z) => z.personId).map((z) => kundenName.get(z.personId)).join(", ")}
            </p>
          )}
        </section>

        {/* ── 3. WIE DER TAG WAR ─────────────────────────────────────────── */}
        <section className="tb-block">
          <h2>Wie war dein Tag?</h2>
          <div className="tb-stimmung">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={stimmung === n ? "an" : ""} onClick={() => setStimmung(n)}>{n}</button>
            ))}
            <span className="tb-still">1 = zäh · 5 = stark</span>
          </div>
          <label className="tb-feld"><span>Was lief besonders gut?</span>
            <textarea rows={2} value={gut} onChange={(e) => setGut(e.target.value)} maxLength={2000} /></label>
          <label className="tb-feld"><span>Was lief schlecht?</span>
            <textarea rows={2} value={schlecht} onChange={(e) => setSchlecht(e.target.value)} maxLength={2000} /></label>
          <label className="tb-feld"><span>Was sollen wir verbessern?</span>
            <textarea rows={2} value={verbesserung} onChange={(e) => setVerbesserung(e.target.value)} maxLength={2000}
                      placeholder="Ab zehn Zeichen geht es als Ticket an die Leitung." /></label>
        </section>

        {fehler && <p className="tb-fehler">{fehler}</p>}
        {fertig && <p className="tb-fertig">{fertig}</p>}

        <div className="tb-fuss">
          <button type="button" className="tb-knopf" disabled={busy} onClick={() => void abgeben()}>
            {busy ? "Speichert …" : d.bereits ? "Bericht aktualisieren" : "Bericht abgeben"}
          </button>
          <span className="tb-still">
            Die Leitung sieht genau dasselbe wie du — keine Zahl über dich, die du nicht selbst siehst.
          </span>
        </div>
      </div>
    </AgentShell>
  );
}
