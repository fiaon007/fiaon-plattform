// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/mara?reiter=auskunft — UNTERLAGEN (19.10.2026, E-406 B2)
//
// Justin (Vorschlag 3 „Mara führt den Betrieb“): KYC nachfordern und Unterlagen vorprüfen — selbst, und nicht
// mehr bei Justin. Drei Zeilen, wenig Text (Justin 12.10.), Details im (i):
//   1. Schalter „Mara erinnert an fehlende Ausweise und Kontoauszüge“ (Standard an) + Wirkung.
//   2. „Unterlagen prüft: …“ — wer die Prüf-Aufgaben bekommt (Vorschlag: wer am meisten prüft; nie du).
//   3. Schalter „Alte Prüf-Aufgaben umhängen“ (Standard AUS — du entscheidest) mit der Zahl aus dem Probelauf,
//      danach „Zurückholen“ (30 Tage) je Lauf — und „Alle zurückholen“ (Nachbesserung: erreicht auch Läufe, die
//      nicht mehr unter den 10 jüngsten stehen).
// Keine neue Seite (Hausregel „Keine neuen Chef-Seiten“). Server: /chef/mara/unterlagen (fiaon-mara-steuerpult.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { API, zahl, useDaten } from "./chef-teile";
import { useMeldung, Meldung, InfoKnopf } from "./mara-lage";
import "@/styles/chef-mara-unterlagen.css";

type Stand = {
  ok: true;
  kyc: {
    an: boolean; eingerichtet: boolean; heute: number; gesendet7: number; nichtGesendet7: number;
    fehlen: number; nachZwei: number; geliefert30: number; hoechstens: number; abstandTage: number;
  };
  pruefer: {
    aktuell: { id: number; name: string; quelle: "einstellung" | "vorschlag" } | null;
    eingestellt: number | null;
    auswahl: { id: number; name: string; geprueft30: number }[];
  };
  umhaengen: {
    an: boolean;
    probelauf: { beiJustin: number; umhaengen: number; personen: number };
    laeufe: { id: number; am: string; umgehaengt: number; zurueck: number }[];
    /** Was „Alle zurückholen“ zurückholt — jeder Lauf der 30 Tage, auch einer, der nicht mehr in der Liste steht. */
    offen?: { aufgaben: number; laeufe: number };
  };
  lauf?: { ok: boolean; grund?: string; umgehaengt: number; an?: string } | null;
  zurueck?: number;
};

async function post(pfad: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt — bitte noch einmal.");
  return j;
}

const tagUhr = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function MaraUnterlagen() {
  const d = useDaten<Stand>("/chef/mara/unterlagen");
  const [stand, setStand] = useState<Stand | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const { meldung, melden, zu } = useMeldung();
  const s = stand ?? d.daten;

  const machen = async (was: string, pfad: string, body: unknown, satz: (j: Stand) => string) => {
    setBusy(was);
    try {
      const j = (await post(pfad, body)) as Stand;
      setStand(j);
      melden(satz(j), "unterlagen");
    } catch (e: any) { melden(e.message, "unterlagen", true); } finally { setBusy(null); }
  };

  const k = s?.kyc;
  const p = s?.pruefer;
  const u = s?.umhaengen;
  const wer = p?.aktuell?.name ?? null;

  return (
    <section className="mku" aria-label="Unterlagen: nachfordern und prüfen" data-fiaon="mara-unterlagen">
      <div className="mara-status mt-status">
        <div className="st voll">
          <button type="button" className={`mara-schalter mt-nf-schalter${k?.an ? " an" : ""}`} data-mara-schalter="kyc"
            aria-pressed={!!k?.an} disabled={!!busy || !k} onClick={() => k && void machen("kyc", "/chef/mara/unterlagen/kyc", { an: !k.an },
              (j) => (j.kyc.an ? "An — Mara erinnert an fehlende Ausweise und Kontoauszüge (höchstens zweimal)." : "Aus — Mara erinnert nicht mehr. Der Upload-Link aus der Akte bleibt."))}>
            <span className="bahn" aria-hidden="true" />
            <span>{!k ? "Fehlende Unterlagen …" : k.an ? "Fehlende Ausweise und Kontoauszüge: Mara erinnert" : "Fehlende Unterlagen: Mara erinnert nicht"}</span>
          </button>
          <InfoKnopf offen={info} onClick={() => setInfo((x) => !x)} label="Was Mara hier tut" />
        </div>
        {k ? (
          <div className="st mt-st-text">
            <div className="st-text">
              <div>{zahl(k.heute)} heute · {zahl(k.gesendet7)} in 7 Tagen · {zahl(k.fehlen)} fehlen noch</div>
              <small>
                {k.geliefert30 ? `${zahl(k.geliefert30)} haben danach geliefert (30 Tage)` : "noch keine Lieferung nach einer Erinnerung"}
                {k.nachZwei ? ` · ${zahl(k.nachZwei)} nach 2 Erinnerungen offen` : ""}
                {k.nichtGesendet7 ? ` · ${zahl(k.nichtGesendet7)} nicht zugestellt` : ""}
              </small>
            </div>
          </div>
        ) : d.fehler ? (
          <div className="st mt-st-text"><div className="st-text"><small>{d.fehler}</small></div></div>
        ) : null}
      </div>

      <div className="mara-status mt-status">
        <div className="st voll">
          <label className="mku-label" htmlFor="mku-pruefer">Unterlagen prüft</label>
          <select id="mku-pruefer" className="mara-eingabe" disabled={!!busy || !p}
            value={p?.eingestellt != null ? String(p.eingestellt) : ""}
            onChange={(ev) => void machen("pruefer", "/chef/mara/unterlagen/pruefer", { agentId: ev.target.value ? Number(ev.target.value) : null },
              (j) => (j.pruefer.aktuell ? `Neue Prüf-Aufgaben gehen an ${j.pruefer.aktuell.name}.` : "Niemand passt — neue Prüf-Aufgaben bleiben bei dir."))}>
            <option value="">{p && p.eingestellt == null && wer ? `${wer} (Vorschlag)` : "Vorschlag: wer am meisten prüft"}</option>
            {(p?.auswahl ?? []).map((x) => (
              <option key={x.id} value={String(x.id)}>{x.name}{x.geprueft30 ? ` · ${zahl(x.geprueft30)} in 30 Tagen` : ""}</option>
            ))}
          </select>
        </div>
        <div className="st mt-st-text">
          <div className="st-text">
            <small>{wer ? "Mara prüft vor (Art, lesbar, Name) — „Geprüft“ klickt ein Mensch." : "Niemand passt — die Prüf-Aufgaben bleiben bei dir."}</small>
          </div>
        </div>
      </div>

      <div className="mara-status mt-status">
        <div className="st voll">
          <button type="button" className={`mara-schalter mt-nf-schalter${u?.an ? " an" : ""}`} data-mara-schalter="umhaengen"
            aria-pressed={!!u?.an} disabled={!!busy || !u || (!u.an && !wer)}
            onClick={() => u && void machen("umhaengen", "/chef/mara/unterlagen/umhaengen", { an: !u.an },
              (j) => (j.umhaengen.an
                ? (j.lauf?.ok ? `${zahl(j.lauf.umgehaengt)} Prüf-Aufgaben an ${j.lauf.an ?? "die Prüferin"} umgehängt.` : `Nichts umgehängt: ${j.lauf?.grund ?? "unbekannt"}.`)
                : "Aus — alte Prüf-Aufgaben bleiben, wo sie sind."))}>
            <span className="bahn" aria-hidden="true" />
            <span>{!u ? "Alte Prüf-Aufgaben …" : u.an ? `Alte Prüf-Aufgaben gehen an ${wer ?? "die Prüferin"}` : "Alte Prüf-Aufgaben bleiben bei dir"}</span>
          </button>
        </div>
        {u ? (
          <div className="st mt-st-text">
            <div className="st-text">
              <div>{u.an ? `${zahl(u.probelauf.beiJustin)} noch bei dir` : `Probelauf: ${zahl(u.probelauf.umhaengen)} von ${zahl(u.probelauf.beiJustin)} würden umgehängt`}</div>
              <small>{u.an ? "Den Rest schließt der Hausputz (schon geprüft oder Vertrag beendet)." : `${zahl(u.probelauf.personen)} Kunden · nur mit Ungeprüftem und laufendem Vertrag`}</small>
            </div>
          </div>
        ) : null}
      </div>
      {u && (u.laeufe.length > 0 || (u.offen?.aufgaben ?? 0) > 0) && (
        <ul className="mku-laeufe">
          {(u.offen?.aufgaben ?? 0) > 0 && (
            <li data-mku="alle-zurueck">
              <span>{zahl(u.offen!.aufgaben)} umgehängt (30 Tage{u.offen!.laeufe > 1 ? `, ${zahl(u.offen!.laeufe)} Läufe` : ""})</span>
              <button type="button" className="mara-knopf klein" disabled={!!busy}
                onClick={() => void machen("zurueck-alle", "/chef/mara/unterlagen/zurueck", { alle: true },
                  (j) => `${zahl(j.zurueck ?? 0)} Prüf-Aufgaben liegen wieder bei dir. Der Schalter ist aus.`)}>
                Alle zurückholen
              </button>
            </li>
          )}
          {u.laeufe.map((l) => (
            <li key={l.id}>
              <span>{tagUhr(l.am)} · {zahl(l.umgehaengt)} umgehängt{l.zurueck ? ` · ${zahl(l.zurueck)} zurück` : ""}</span>
              {l.zurueck < l.umgehaengt && (
                <button type="button" className="mara-knopf klein" disabled={!!busy}
                  onClick={() => void machen(`zurueck-${l.id}`, "/chef/mara/unterlagen/zurueck", { laufId: l.id },
                    (j) => `${zahl(j.zurueck ?? 0)} Prüf-Aufgaben liegen wieder bei dir. Der Schalter ist aus.`)}>
                  Zurückholen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {info && (
        <p className="mara-info">
          <b>Erinnern:</b> Fehlt bei einem bezahlten, laufenden Paket der Ausweis oder der Kontoauszug, schickt Mara dem Kunden die
          Unterlagen-Mail mit dem Upload-Link ohne Anmeldung — höchstens {k?.hoechstens ?? 2}-mal, mit {k?.abstandTage ?? 4} Tagen Abstand,
          von 8 bis 20 Uhr. Nie bei beendetem oder gekündigtem Vertrag, FIAON Global, Testkonto oder Vertriebssperre.
          {" "}<b>Prüfen:</b> Kommt eine Unterlage, schreibt Mara eine Vorprüfung an die Unterlage (Art, lesbar, vollständig, Name aus der Akte).
          Ausweisfotos liest keine KI. Freigeben tut immer ein Mensch mit „Geprüft“.
          {" "}<b>Umhängen:</b> Nur offene Prüf-Aufgaben mit Ungeprüftem und laufendem Vertrag; „Zurückholen“ geht 30 Tage —
          je Lauf oder mit „Alle zurückholen“ alles auf einmal.
        </p>
      )}
      <Meldung m={meldung} ort="unterlagen" onZu={zu} />
    </section>
  );
}
