// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-MANDAT › REITER „ARBEITSABLAUF“ (E-462, 29.10.2026)
//
// Der komplette Ablauf je Global-Kunde — Gründung beim Registered Agent bis ITIN —
// Schritt für Schritt, mit jedem Formularfeld und Kopieren-Knopf. Inhalt aus EINER
// Quelle: shared/fiaon-global-arbeitsablauf.ts. Schritte mit Fahrplan-Station
// zeigen ihren Stand von selbst („Station öffnen“), die übrigen hakt man ab
// (POST /chef/global/mandate/:ref/arbeitsablauf, interner Verlauf mit wer/wann).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { ListChecks, Copy, Check, ExternalLink, AlertTriangle, Info, ChevronDown, FileText, ArrowRight } from "lucide-react";
import { datum } from "./chef-teile";
import {
  ABLAUF_VORAB, ABLAUF_WER_TEXT, ablaufBloecke, ablaufEinsetzen, ablaufStaat, ablaufStand, ablaufWerte,
  type AblaufLink, type AblaufReiter, type AblaufSchritt, type AblaufSchrittStand, type AblaufFeld, type AblaufHaken,
} from "@shared/fiaon-global-arbeitsablauf";
import "@/styles/chef-global-arbeitsablauf.css";

type Tun = (pfad: string, methode: "POST" | "DELETE", body?: unknown) => Promise<boolean>;

const ZUSTAND_TEXT: Record<string, string> = { erledigt: "Erledigt", in_arbeit: "In Arbeit", offen: "Offen", wartet: "Wartet auf Kunde" };
const ZUSTAND_TON: Record<string, string> = { erledigt: "gruen", in_arbeit: "blau", offen: "", wartet: "gelb" };

const WERTE_ZEILEN: { key: string; titel: string }[] = [
  { key: "gesellschaft", titel: "Gesellschaft" },
  { key: "nameOhneEndung", titel: "Name ohne LLC" },
  { key: "bundesstaat", titel: "Bundesstaat" },
  { key: "vorname", titel: "Vorname (Member)" },
  { key: "nachname", titel: "Nachname (Member)" },
  { key: "kontaktMail", titel: "Kontakt-E-Mail" },
  { key: "telefon", titel: "Telefon des Kunden" },
  { key: "wohnadresse", titel: "Wohnadresse" },
  { key: "usTelefon", titel: "US-Nummer" },
];

function KopierKnopf({ text, an, setAn, id }: { text: string; an: string | null; setAn: (k: string | null) => void; id: string }) {
  return (
    <button type="button" className="cgr-ab-kopie" title="Kopieren"
            onClick={async () => { try { await navigator.clipboard.writeText(text); setAn(id); window.setTimeout(() => setAn(null), 1600); } catch { /* egal */ } }}>
      {an === id ? <Check size={13} /> : <Copy size={13} />}<span>{an === id ? "Kopiert" : "Kopieren"}</span>
    </button>
  );
}

export default function ChefGlobalArbeitsablauf({ m, tun, setReiter, stationOeffnen }: {
  m: any; tun: Tun; setReiter: (r: AblaufReiter) => void; stationOeffnen: (schluessel: string) => void;
}) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [umgeschaltet, setUmgeschaltet] = useState<Set<string>>(new Set());

  const werte = useMemo(() => ablaufWerte({
    gesellschaftName: m.gesellschaft?.name, bundesstaatName: m.gesellschaft?.bundesstaatName,
    vorname: m.kontakt?.vorname, nachname: m.kontakt?.nachname,
    telefon: m.kontaktVorschlag?.telefon || m.kontakt?.telefon, wohnadresse: m.kontaktVorschlag?.adresse,
    usTelefon: m.gesellschaftPlus?.usTelefon,
  }), [m]);
  // E-465 (29.10.2026): der Ablauf je Bundesstaat der Gesellschaft (Register, Gebühr, Summe, Express, Jahrespflicht).
  const bloecke = useMemo(() => ablaufBloecke(werte.bundesstaat), [werte.bundesstaat]);
  const haken = (m.arbeitsablaufHaken ?? {}) as Record<string, AblaufHaken>;
  const stand = useMemo(() => ablaufStand({
    status: String(m.status), bezahltAm: m.bezahltAm ?? null, schritte: (m.schritte ?? []) as any[],
    plus: m.gesellschaftPlus ?? null,
    dokumentArten: ((m.dokumente ?? []) as any[]).filter((d) => !(d.abgelehnt && !d.abgelehnt.erledigt)).map((d) => String(d.art)),
    haken,
  }), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const standVon = new Map(stand.schritte.map((s) => [s.key, s]));
  const naechster = stand.naechster ? bloecke.flatMap((b) => b.schritte).find((s) => s.key === stand.naechster) ?? null : null;
  const prozent = Math.round((stand.erledigt / stand.gesamt) * 100);
  const vorabDa = ABLAUF_VORAB.filter((v) => stand.vorab[v.key]?.da).length;

  const abhaken = async (key: string, erledigt: boolean) => {
    setLaeuft(key);
    try { await tun("/arbeitsablauf", "POST", { schritt: key, erledigt }); } finally { setLaeuft(null); }
  };
  // Erledigte Schritte sind eingeklappt, alle anderen offen — ein Klick auf den Kopf dreht das um.
  const istAuf = (s: AblaufSchrittStand) => (s.zustand !== "erledigt") !== umgeschaltet.has(s.key);
  const umschalten = (key: string) => setUmgeschaltet((alt) => { const n = new Set(alt); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const hinspringen = (key: string) => {
    setUmgeschaltet((alt) => { const n = new Set(alt); const s = standVon.get(key); if (s && s.zustand === "erledigt") n.add(key); else n.delete(key); return n; });
    window.requestAnimationFrame(() => document.querySelector(`[data-ablauf="${key}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <div className="cgr-gitter cgr-ab">
      <section className="cgr-block breit cgr-ab-kopf">
        <div className="cgr-block-kopf">
          <h3><ListChecks size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Arbeitsablauf je Kunde <small>US-LLC bis ITIN · 8 Blöcke, 20 Schritte · Bundesstaat {m.gesellschaft?.bundesstaatName ? werte.bundesstaat : "noch offen — Anleitung zeigt Florida, bis der Staat in „Gesellschaft“ steht"}</small></h3>
          <button type="button" className="cw-knopf" onClick={() => anleitungOeffnen(werte.bundesstaat)} title="Die Anleitung ohne Kundendaten (mit Leerstellen) in einem neuen Tab — zum Drucken oder Weitergeben.">
            <FileText size={14} /> Als Anleitung öffnen
          </button>
        </div>
        <div className="cgr-ab-zahl"><b>{stand.erledigt}</b> von {stand.gesamt} erledigt</div>
        <div className="cgr-fortschritt"><span style={{ width: `${prozent}%` }} /></div>
        {naechster ? (
          <button type="button" className="cgr-ab-naechster" onClick={() => hinspringen(naechster.key)}>
            <span>Als Nächstes</span><b>Schritt {naechster.nr} · {naechster.titel}</b><em>{ABLAUF_WER_TEXT[naechster.wer]}</em><ArrowRight size={14} />
          </button>
        ) : <p className="cgr-satz"><b>Alles erledigt.</b> Jetzt laufen nur noch die Jahrespflichten.</p>}
        <p className="cgr-ab-hinweis info"><Info size={14} /> Die Gründung bestellst du sofort nach dem Zahlungseingang. Das EIN-Formular erst, wenn der Kunde Tätigkeit und „Einverstanden“ geschickt hat.</p>
        <p className="cgr-ab-hinweis warnung"><AlertTriangle size={14} /> Kein Kundenkontakt, bevor die Zahlungsbestätigung raus ist. Kundentexte immer gesiezt, als Mara-Entwurf.</p>
      </section>

      <section className="cgr-block breit">
        <h3>Werte dieses Kunden <small>zum Kopieren in die Formulare</small></h3>
        <dl className="cgr-ab-werte">
          {WERTE_ZEILEN.map((z) => {
            const w = werte[z.key];
            return (
              <div key={z.key} className={w ? "" : "fehlt"}>
                <dt>{z.titel}</dt>
                <dd>{w ? <><span>{w}</span><KopierKnopf text={w} an={kopiert} setAn={setKopiert} id={`w-${z.key}`} /></> : <em>fehlt</em>}</dd>
              </div>
            );
          })}
        </dl>
        {(!werte.gesellschaft || !werte.nachname) && (
          <p className="cgr-satz">Es fehlen Angaben. Name der Gesellschaft und Kontaktperson pflegst du im Reiter <button type="button" className="cgr-link" onClick={() => setReiter("gesellschaft")}>Fahrplan &amp; Werte</button>.</p>
        )}
      </section>

      <section className="cgr-block breit cgr-ab-block">
        <header className="cgr-ab-block-kopf">
          <span className="cgr-ab-block-nr">0</span>
          <div><b>Vorher vom Kunden holen</b><small>mit der Willkommens- bzw. Zahlungsmail, ein Mal · {vorabDa} von {ABLAUF_VORAB.length} da</small></div>
        </header>
        <ul className="cgr-ab-vorab">
          {ABLAUF_VORAB.map((v) => {
            const s = stand.vorab[v.key];
            const gehakt = !!haken[v.key];
            return (
              <li key={v.key} className={s?.da ? "da" : ""}>
                <label className="cgr-ab-haken">
                  <input type="checkbox" checked={!!s?.da} disabled={laeuft === v.key || (s?.ausTresor && !gehakt)}
                         onChange={(e) => void abhaken(v.key, e.target.checked)} />
                  <span><b>{v.titel}</b><small>{v.text}</small>
                    {s?.ausTresor && <em>Liegt im Tresor.</em>}
                    {gehakt && <em>Abgehakt {datum(s?.datum)}{s?.von ? ` · ${s.von}` : ""}</em>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {bloecke.map((b) => {
        const fertig = b.schritte.filter((s) => standVon.get(s.key)?.zustand === "erledigt").length;
        return (
          <section key={b.nr} className="cgr-block breit cgr-ab-block">
            <header className="cgr-ab-block-kopf">
              <span className={`cgr-ab-block-nr${fertig === b.schritte.length ? " fertig" : ""}`}>{b.nr}</span>
              <div><b>{b.titel}</b><small>{b.wann} · {fertig} von {b.schritte.length} erledigt</small></div>
            </header>
            {b.text && <p className="cgr-satz">{b.text}</p>}
            <ol className="cgr-ab-schritte">
              {b.schritte.map((s) => {
                const st = standVon.get(s.key)!;
                return (
                  <Schritt key={s.key} s={s} st={st} auf={istAuf(st)} naechster={stand.naechster === s.key} werte={werte}
                           kopiert={kopiert} setKopiert={setKopiert} laeuft={laeuft === s.key}
                           umschalten={() => umschalten(s.key)} abhaken={(an) => void abhaken(s.key, an)}
                           setReiter={setReiter} stationOeffnen={stationOeffnen} />
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function Schritt({ s, st, auf, naechster, werte, kopiert, setKopiert, laeuft, umschalten, abhaken, setReiter, stationOeffnen }: {
  s: AblaufSchritt; st: AblaufSchrittStand; auf: boolean; naechster: boolean; werte: Record<string, string>;
  kopiert: string | null; setKopiert: (k: string | null) => void; laeuft: boolean;
  umschalten: () => void; abhaken: (an: boolean) => void; setReiter: (r: AblaufReiter) => void; stationOeffnen: (k: string) => void;
}) {
  const vonHand = s.quelle.art === "haken";
  return (
    <li className={`cgr-ab-schritt z-${st.zustand}${naechster ? " naechster" : ""}${auf ? " auf" : ""}`} data-ablauf={s.key}>
      <button type="button" className="cgr-ab-schritt-kopf" onClick={umschalten} aria-expanded={auf}>
        <span className="cgr-ab-nr">{st.zustand === "erledigt" ? <Check size={14} strokeWidth={2.4} /> : s.nr}</span>
        <span className="cgr-ab-titel">
          <b>{s.titel}</b>
          <small>{ABLAUF_WER_TEXT[s.wer]} · {st.quelle}{st.datum ? ` · ${datum(st.datum)}` : ""}{st.von ? ` · ${st.von}` : ""}</small>
        </span>
        <span className="cgr-ab-marken">
          {naechster && <span className="cgr-pille blau">Als Nächstes</span>}
          <span className={`cgr-pille ${ZUSTAND_TON[st.zustand]}`}>{ZUSTAND_TEXT[st.zustand]}</span>
        </span>
        <ChevronDown size={15} className="cgr-ab-pfeil" />
      </button>
      {auf && (
        <div className="cgr-ab-inhalt">
          <p className="cgr-ab-text">{s.text}</p>
          {s.felder && s.felder.length > 0 && (
            <table className="cgr-ab-felder">
              <tbody>
                {s.felder.map((f, i) => <Feld key={i} f={f} werte={werte} id={`${s.key}-${i}`} kopiert={kopiert} setKopiert={setKopiert} />)}
              </tbody>
            </table>
          )}
          {s.hinweise?.map((h, i) => (
            <p key={i} className={`cgr-ab-hinweis ${h.ton}`}>{h.ton === "warnung" ? <AlertTriangle size={14} /> : <Info size={14} />} {h.text}</p>
          ))}
          <div className="cgr-ab-tun">
            {vonHand && (
              <label className="cgr-ab-haken knopf">
                <input type="checkbox" checked={st.zustand === "erledigt"} disabled={laeuft} onChange={(e) => abhaken(e.target.checked)} />
                <span>{st.zustand === "erledigt" ? "Erledigt" : "Als erledigt abhaken"}</span>
              </label>
            )}
            {st.station && (
              <button type="button" className="cw-knopf cgr-haupt" onClick={() => stationOeffnen(st.station!)}>Station öffnen</button>
            )}
            {s.links?.map((l, i) => <LinkKnopf key={i} l={l} werte={werte} setReiter={setReiter} />)}
          </div>
        </div>
      )}
    </li>
  );
}

function Feld({ f, werte, id, kopiert, setKopiert }: { f: AblaufFeld; werte: Record<string, string>; id: string; kopiert: string | null; setKopiert: (k: string | null) => void }) {
  const { text, fehlt } = ablaufEinsetzen(f.wert, werte);
  return (
    <tr className={fehlt ? "fehlt" : ""}>
      <th>{f.feld}</th>
      <td><span className="cgr-ab-wert">{text}</span>{f.hinweis && <small>{f.hinweis}</small>}</td>
      <td className="cgr-ab-kopie-zelle">{f.kopieren !== false && !fehlt && <KopierKnopf text={text} an={kopiert} setAn={setKopiert} id={id} />}</td>
    </tr>
  );
}

function LinkKnopf({ l, werte, setReiter }: { l: AblaufLink; werte: Record<string, string>; setReiter: (r: AblaufReiter) => void }) {
  if ("reiter" in l) return <button type="button" className="cw-knopf" onClick={() => setReiter(l.reiter)}>{l.titel}</button>;
  const href = "url" in l ? ablaufEinsetzen(l.url, werte, { url: true }).text : l.pfad;
  return <a className="cw-knopf" href={href} target="_blank" rel="noopener noreferrer">{l.titel} <ExternalLink size={12} /></a>;
}

// ── „Als Anleitung öffnen“ — dieselbe Quelle, ohne Kundendaten (Leerstellen), als eigene Seite zum Drucken ─────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function anleitungOeffnen(staat: string) {
  const S = ablaufStaat(staat);
  const leer = (v: string) => esc(ablaufEinsetzen(v, null).text);
  const link = (l: AblaufLink) => "url" in l ? `<li>${esc(l.titel)}: ${esc(ablaufEinsetzen(l.url, null, { url: true }).text)}</li>`
    : "pfad" in l ? `<li>${esc(l.titel)}: Chefbüro ${esc(l.pfad)}</li>` : `<li>${esc(l.titel)}: Reiter im Mandat</li>`;
  const teile: string[] = [];
  teile.push(`<h2>0 · Vorher vom Kunden holen</h2><ol>${ABLAUF_VORAB.map((v) => `<li><b>${esc(v.titel)}</b> — ${esc(v.text)}</li>`).join("")}</ol>`);
  for (const b of ablaufBloecke(S.name)) {
    teile.push(`<h2>${b.nr} · ${esc(b.titel)} <small>${esc(b.wann)}</small></h2>${b.text ? `<p>${esc(b.text)}</p>` : ""}`);
    for (const s of b.schritte) {
      teile.push(`<section><h3>☐ ${s.nr}. ${esc(s.titel)} <small>${esc(ABLAUF_WER_TEXT[s.wer])}</small></h3><p>${esc(s.text)}</p>`
        + (s.felder?.length ? `<table>${s.felder.map((f) => `<tr><th>${esc(f.feld)}</th><td>${leer(f.wert)}${f.hinweis ? ` <small>(${esc(f.hinweis)})</small>` : ""}</td></tr>`).join("")}</table>` : "")
        + (s.hinweise?.length ? s.hinweise.map((h) => `<p class="h">${h.ton === "warnung" ? "Achtung: " : "Hinweis: "}${esc(h.text)}</p>`).join("") : "")
        + (s.links?.length ? `<ul class="l">${s.links.map(link).join("")}</ul>` : "")
        + `</section>`);
    }
  }
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arbeitsablauf je Global-Kunde — ${S.name}</title>
<style>body{font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;color:#0f172a;max-width:860px;margin:32px auto;padding:0 16px}h1{font-weight:500;font-size:24px}
h2{margin:28px 0 6px;font-size:17px;font-weight:600;border-bottom:1px solid #cbd5e1;padding-bottom:4px}h2 small,h3 small{font-weight:400;color:#64748b;font-size:12px;margin-left:6px}
h3{margin:14px 0 2px;font-size:14px}section{break-inside:avoid}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{text-align:left;vertical-align:top;padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:13px}
th{width:34%;font-weight:500;color:#334155}td small{color:#64748b}.h{background:#fef3c7;padding:6px 10px;border-radius:6px;font-size:13px}.l{font-size:12px;color:#475569;word-break:break-all}
@media print{body{margin:0}}</style></head><body><h1>Arbeitsablauf je Global-Kunde — ${S.name}</h1>
<p>US-LLC über den Registered Agent bis zur ITIN. Leerstellen ‹…› füllst du je Kunde aus. Kundentexte immer gesiezt.</p>${teile.join("\n")}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
