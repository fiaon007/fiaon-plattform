// ═══════════════════════════════════════════════════════════════════════════
// BESUCHER — Microsoft Clarity im Chefbüro (27.08.2026)
//
// Justin: „Ziehe die LIVE Daten, stelle sie uns ins Chef Dashboard — mach es
//          PERFEKT, detailliert so wie möglich."
//
// ── DIE ORDNUNG DIESER SEITE ──────────────────────────────────────────────
// Zahlen über Besucher verführen zum Tapezieren: dreißig Kacheln, und keine
// sagt einem, was zu tun ist. Deshalb hier vier Ebenen mit abnehmender
// Wichtigkeit:
//
//   1. WER WAR DA — Sitzungen, Menschen, Zeit, Scrolltiefe. Vier Zahlen.
//   2. WO ES KLEMMT — Wut-Klicks, tote Klicks, Skriptfehler. Das ist der
//      eigentliche Wert von Clarity: nicht wie viele kamen, sondern wo sie
//      sich geärgert haben.
//   3. WELCHE SEITEN — mit Ärgernissen JE SEITE. „Wut-Klicks: 36" ist eine
//      Zahl; „36 Wut-Klicks auf /antrag" ist eine Aufgabe.
//   4. WOHER — Gerät, Land, Herkunft.
//
// ── DER HINWEIS AUF DEN STAND ─────────────────────────────────────────────
// Clarity erlaubt zehn Abrufe am Tag. Die Seite sagt deshalb IMMER, wie alt
// die Zahlen sind und wie viele Abrufe heute noch übrig sind — eine Zahl
// ohne Datum ist eine Behauptung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import {
  Users, MousePointerClick, Timer, ArrowDownWideNarrow, RefreshCw, Loader2,
  AlertTriangle, Globe, Smartphone, Compass, ExternalLink,
} from "lucide-react";
import { API, Karte, Hochzaehler, zahl, Geruest, Fehlermeldung, seit } from "./chef-teile";

/** Millisekunden in „2 min 14 s". */
const dauer = (ms: number): string => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} s` : `${m} min`;
};
const prozent = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("de-DE")} %`;

/** Ein Balken für eine Rangliste — Anteil an der größten Zeile. */
function Rang({ titel, Icon, zeilen, max }: {
  titel: string; Icon: any; zeilen: { name: string; sitzungen: number; menschen: number }[]; max: number;
}) {
  if (!zeilen.length) return null;
  return (
    <div className="cb-rang">
      <h3><Icon size={15} strokeWidth={1.7} aria-hidden="true" /> {titel}</h3>
      <ul>
        {zeilen.slice(0, 8).map((z) => (
          <li key={z.name}>
            <span className="cb-rang-name" title={z.name}>{z.name}</span>
            <span className="cb-rang-balken" aria-hidden="true">
              <i style={{ width: `${max > 0 ? Math.max(2, (z.sitzungen / max) * 100) : 0}%` }} />
            </span>
            <span className="cb-rang-zahl">{zahl(z.sitzungen)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ChefBesucher() {
  const [d, setD] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [holt, setHolt] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = () => {
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/clarity`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (j?.ok) setD(j); else setFehler(j?.error || "Die Besucherzahlen ließen sich nicht laden.");
      })
      .catch(() => setFehler("Keine Verbindung zum Server."))
      .finally(() => setLaedt(false));
  };
  useEffect(laden, []);

  const neuHolen = async () => {
    if (holt) return;
    setHolt(true); setMeldung(null);
    try {
      const r = await fetch(`${API}/chef/clarity/neu`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tage: 3 }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setD({ ...j, eingerichtet: true, leer: false }); setMeldung("Frisch von Clarity geholt."); }
      else setMeldung(j?.error || "Der Abruf ist nicht gelungen.");
    } catch {
      setMeldung("Keine Verbindung zum Server.");
    } finally { setHolt(false); }
  };

  if (laedt) return <div className="cl"><Geruest zeilen={8} /></div>;
  if (fehler) return <div className="cl"><Fehlermeldung text={fehler} erneut={laden} /></div>;
  if (!d) return null;

  if (!d.eingerichtet) {
    return (
      <div className="cl">
        <header className="cl-kopf">
          <p className="cl-augenbraue">Besucher</p>
          <h1>Clarity ist noch nicht verbunden</h1>
          <p className="cl-untertitel">{d.hinweis}</p>
        </header>
      </div>
    );
  }

  if (d.leer) {
    return (
      <div className="cl">
        <header className="cl-kopf">
          <p className="cl-augenbraue">Besucher</p>
          <h1>Noch keine Zahlen</h1>
          <p className="cl-untertitel">{d.hinweis}</p>
        </header>
        <button type="button" className="cw-knopf haupt" onClick={neuHolen} disabled={holt}>
          {holt ? <><Loader2 size={15} className="cw-dreht" /> holt …</> : <><RefreshCw size={15} strokeWidth={1.7} /> Jetzt von Clarity holen</>}
        </button>
        {meldung && <p className="cw-meldung" role="status">{meldung}</p>}
      </div>
    );
  }

  const k = d.kopf ?? {};
  const maxGeraet = Math.max(1, ...(d.geraete ?? []).map((z: any) => z.sitzungen));
  const maxLand = Math.max(1, ...(d.laender ?? []).map((z: any) => z.sitzungen));
  const maxHerkunft = Math.max(1, ...(d.herkunft ?? []).map((z: any) => z.sitzungen));

  // Die Seiten mit dem meisten Ärger zuerst — das ist die Arbeitsliste.
  const seitenNachAerger = [...(d.seiten ?? [])]
    .map((s: any) => ({ ...s, aergerSumme: (s.aerger?.wut ?? 0) * 3 + (s.aerger?.tot ?? 0) + (s.aerger?.fehler ?? 0) * 2 + (s.aerger?.zurueck ?? 0) }))
    .filter((s: any) => s.aergerSumme > 0)
    .sort((a: any, b: any) => b.aergerSumme - a.aergerSumme)
    .slice(0, 12);

  return (
    <div className="cl cbes">
      <header className="cl-kopf">
        <p className="cl-augenbraue">Besucher · Microsoft Clarity</p>
        <h1>Wer war da — und wo hat es geklemmt?</h1>
        <p className="cl-untertitel">
          Die letzten {d.tage} Tage. Clarity erlaubt zehn Abrufe am Tag, deshalb
          liest diese Seite aus unserem Speicher und lädt höchstens alle acht
          Stunden nach.
        </p>
      </header>

      {/* ── Stand und Nachladen ──────────────────────────────────────────── */}
      <div className="cbes-stand">
        <span>
          Stand: <b>{d.stand ? seit(d.stand) : "unbekannt"}</b>
          {d.budget && <> · heute {d.budget.verbrauchtHeute} von {d.budget.tagesbudget} Abrufen verbraucht
            {d.budget.nochMoeglich > 0
              ? <> · {d.budget.nochMoeglich} weitere möglich</>
              : <> · <b>heute keine weiteren</b></>}</>}
        </span>
        <button type="button" className="cw-knopf klein" onClick={neuHolen}
                disabled={holt || (d.budget?.nochMoeglich ?? 0) === 0}>
          {holt ? <Loader2 size={14} className="cw-dreht" /> : <RefreshCw size={14} strokeWidth={1.7} />}
          {holt ? "holt …" : "Neu holen"}
        </button>
      </div>
      {d.ladefehler && <p className="cw-meldung" role="status">{d.ladefehler}</p>}
      {meldung && <p className="cw-meldung" role="status">{meldung}</p>}

      {/* ── 1. Wer war da ────────────────────────────────────────────────── */}
      <div className="ck-kopfzahlen">
        <Karte klasse="ck-kz">
          <b><Hochzaehler ziel={k.sitzungen ?? 0} formatieren={zahl} /></b>
          <em>Sitzungen{k.bots > 0 && <> · {zahl(k.bots)} davon Bots</>}</em>
        </Karte>
        <Karte klasse="ck-kz">
          <b><Hochzaehler ziel={k.menschen ?? 0} formatieren={zahl} /></b>
          <em>unterschiedliche Menschen</em>
        </Karte>
        <Karte klasse="ck-kz">
          <b>{dauer(k.zeitAktivMs ?? 0)}</b>
          <em>aktive Zeit gesamt · von {dauer(k.zeitGesamtMs ?? 0)} Anwesenheit</em>
        </Karte>
        <Karte klasse="ck-kz">
          <b>{prozent(k.scrolltiefe ?? 0)}</b>
          <em>durchschnittliche Scrolltiefe</em>
        </Karte>
      </div>

      {/* ── 2. Wo es klemmt ──────────────────────────────────────────────── */}
      {(d.aergernisse ?? []).length > 0 && (
        <section className="cbes-abschnitt">
          <h2><AlertTriangle size={17} strokeWidth={1.7} aria-hidden="true" /> Wo sich Besucher ärgern</h2>
          <p className="cr-gruppensatz">
            Das ist der eigentliche Wert dieser Zahlen: nicht wie viele kamen,
            sondern wo sie nicht weiterkamen.
          </p>
          <div className="cbes-aerger">
            {d.aergernisse.map((a: any) => (
              <div key={a.key} className="cbes-aergerkarte">
                <b>{zahl(a.vorfaelle)}</b>
                <strong>{a.titel}</strong>
                <em>{a.satz}</em>
                <small>{prozent(a.anteil)} der Sitzungen · {zahl(a.seiten)} Seitenaufrufe betroffen</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. Seiten mit Ärger — die Arbeitsliste ───────────────────────── */}
      {seitenNachAerger.length > 0 && (
        <section className="cbes-abschnitt">
          <h2><MousePointerClick size={17} strokeWidth={1.7} aria-hidden="true" /> Diese Seiten machen Ärger</h2>
          <p className="cr-gruppensatz">
            Nach Gewicht sortiert: Ein Wut-Klick zählt dreifach, ein Skriptfehler
            doppelt — beides sind Menschen, die etwas wollten und nicht bekamen.
          </p>
          <div className="cbes-seiten">
            {seitenNachAerger.map((s: any) => (
              <a key={s.adresse} className="cbes-seite" href={s.adresse} target="_blank" rel="noopener noreferrer">
                <span className="cbes-pfad">
                  <b>{s.pfad}</b>
                  <em>{zahl(s.sitzungen)} Sitzungen{s.scrolltiefe != null && <> · {prozent(s.scrolltiefe)} Scrolltiefe</>}</em>
                </span>
                <span className="cbes-marken">
                  {s.aerger?.wut > 0 && <i data-ton="rot" title="Wut-Klicks">{s.aerger.wut} Wut</i>}
                  {s.aerger?.tot > 0 && <i data-ton="gelb" title="Tote Klicks">{s.aerger.tot} tot</i>}
                  {s.aerger?.fehler > 0 && <i data-ton="rot" title="Skriptfehler">{s.aerger.fehler} Fehler</i>}
                  {s.aerger?.zurueck > 0 && <i data-ton="gelb" title="Sofort zurück">{s.aerger.zurueck} zurück</i>}
                </span>
                <ExternalLink size={14} strokeWidth={1.6} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Die meistbesuchten Seiten ────────────────────────────────────── */}
      {(d.seiten ?? []).length > 0 && (
        <section className="cbes-abschnitt">
          <h2><Users size={17} strokeWidth={1.7} aria-hidden="true" /> Meistbesuchte Seiten</h2>
          <div className="cw-tabelle-rahmen">
            <table className="cw-tabelle">
              <thead>
                <tr>
                  <th scope="col">Seite</th><th scope="col">Sitzungen</th><th scope="col">Menschen</th>
                  <th scope="col">Scrolltiefe</th><th scope="col">aktive Zeit</th>
                </tr>
              </thead>
              <tbody>
                {d.seiten.slice(0, 20).map((s: any) => (
                  <tr key={s.adresse}>
                    <td title={s.adresse}>{s.pfad}</td>
                    <td>{zahl(s.sitzungen)}</td>
                    <td>{zahl(s.menschen)}</td>
                    <td>{s.scrolltiefe != null ? prozent(s.scrolltiefe) : "—"}</td>
                    <td>{s.zeit ? dauer(s.zeit.aktiv) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 4. Woher ─────────────────────────────────────────────────────── */}
      <section className="cbes-abschnitt">
        <h2><Compass size={17} strokeWidth={1.7} aria-hidden="true" /> Woher sie kommen</h2>
        <div className="cbes-raenge">
          <Rang titel="Herkunft" Icon={Compass} zeilen={d.herkunft ?? []} max={maxHerkunft} />
          <Rang titel="Land" Icon={Globe} zeilen={d.laender ?? []} max={maxLand} />
          <Rang titel="Gerät" Icon={Smartphone} zeilen={d.geraete ?? []} max={maxGeraet} />
        </div>
      </section>

      <p className="dk-leise cbes-fuss">
        Quelle: Microsoft Clarity, Datenexport-Schnittstelle. Clarity gibt über
        diese Schnittstelle nur die letzten drei Tage heraus — jeder Abruf wird
        bei uns aufbewahrt, daraus wächst mit der Zeit ein eigener Verlauf.
      </p>
    </div>
  );
}
