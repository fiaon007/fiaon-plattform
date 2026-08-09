import { useEffect, useState } from "react";
import { Users, AlertTriangle, RefreshCw, Phone, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";
import { PageIntro, Tip } from "@/components/admin/PageHelp";
import { KUNDENSTATUS, zahlungsstatusText } from "@shared/fiaon-kundenstatus";

// ═══════════════════════════════════════════════════════════════════
// /admin/personen — WIE VIELE KUNDEN HABEN WIR, UND WEM GEHÖREN SIE?
//
// Zwei Dinge, die vorher nirgends standen:
//
// 1. Die Kundenzahl. Bisher wurden Antrags-ZEILEN gezählt — wer den
//    Bonitäts-Check kaufte, zählte zweimal. Hier steht die Zahl der
//    MENSCHEN, direkt neben der alten Zeilenzahl, damit der Unterschied
//    belegbar ist statt behauptet.
//
// 2. Die Personen mit mehreren Agenten. Der Backfill hat sie markiert,
//    aber sie waren nirgends einsehbar. Diese Seite ändert NICHTS an der
//    Zuordnung — sie legt nur alles vor, was für die Entscheidung nötig
//    ist. Wem ein Kunde gehört, ist eine Geldfrage; das entscheidet der
//    Vorgesetzter, oder es wird mit dem Stichtag aufgelöst.
// ═══════════════════════════════════════════════════════════════════

async function apiF(url: string) {
  const r = await fetch(`/api/fiaon${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const json = await r.json().catch(() => null);
  return { ok: r.ok && json?.ok, json };
}

function eur(v: number): string {
  return `${Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function datum(v: string | null): string {
  if (!v) return "kein dokumentierter Kontakt";
  try {
    return new Date(v).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

interface Kennzahlen {
  personen: { gesamt: number; bezahlt: number; angekuendigt: number; konflikte: number };
  zeilen: { gesamt: number; bezahlt: number; angekuendigt: number; ohnePerson: number };
  entwuerfe: number;
  differenz: number;
}

function Kachel({ titel, wert, unten, hinweis, betont }: {
  titel: string; wert: string; unten?: string; hinweis?: string; betont?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-2xl p-4 ${betont ? "border-slate-400" : "border-slate-200"}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">
        {titel}{hinweis && <Tip text={hinweis} />}
      </p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{wert}</p>
      {unten && <p className="text-[11px] text-slate-400 mt-0.5">{unten}</p>}
    </div>
  );
}

function KonfliktKarte({ k }: { k: any }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOffen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
      >
        {offen ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-slate-900 truncate">{k.name}</span>
          <span className="block text-[11px] text-slate-400 truncate">
            {k.personRef} · {k.bestellungen} Bestellung(en){k.leads > 0 ? ` · ${k.leads} Lead(s)` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-bold text-slate-900 tabular-nums">
            {k.bezahlte > 0 ? eur(k.bezahltSumme) : "—"}
          </span>
          <span className="block text-[11px] text-slate-400">
            {k.bezahlte > 0 ? `${k.bezahlte} bezahlt` : "nichts bezahlt"}
          </span>
        </span>
        <span className="shrink-0 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-700">
          {k.agenten.length} Agenten
        </span>
      </button>

      {offen && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-3">
            {k.email && <span className="inline-flex items-center gap-1"><Mail size={11} />{k.email}</span>}
            {k.telefon && <span className="inline-flex items-center gap-1"><Phone size={11} />{k.telefon}</span>}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Beteiligte Agenten — sortiert nach letztem dokumentiertem Kontakt
          </p>
          <div className="space-y-2">
            {k.agenten.map((a: any) => (
              <div
                key={a.id}
                className={`px-3 py-2.5 rounded-xl border ${
                  k.zugewiesen?.id === a.id ? "border-slate-400 bg-slate-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12.5px] font-bold text-slate-800">{a.name}</span>
                  {k.zugewiesen?.id === a.id && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      aktuell zugewiesen
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-slate-500">
                  Letzter Kontakt: <b className="text-slate-700">{datum(a.letzterKontakt)}</b>
                  {a.letzteArt ? ` · ${a.letzteArt}` : ""}
                  {a.letztesErgebnis ? ` · ${a.letztesErgebnis}` : ""}
                </p>
                {a.letzteNotiz && (
                  <p className="text-[11.5px] text-slate-400 mt-1 leading-snug">„{a.letzteNotiz}"</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-3 leading-snug">
            Diese Ansicht ändert nichts. Die Zuweisung bleibt, wie sie ist, bis du sie
            änderst oder sie mit dem Stichtag aufgelöst wird.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminPersonenPage() {
  const [kz, setKz] = useState<Kennzahlen | null>(null);
  const [konflikte, setKonflikte] = useState<any[]>([]);
  const [jeAgent, setJeAgent] = useState<any[]>([]);
  const [summe, setSumme] = useState<any>(null);
  const [laden, setLaden] = useState(true);

  const laden_ = () => {
    setLaden(true);
    Promise.all([
      apiF("/admin/personen/kennzahlen").then((r) => { if (r.ok) setKz(r.json); }),
      apiF("/admin/personen/konflikte").then((r) => {
        if (r.ok) { setKonflikte(r.json.data || []); setJeAgent(r.json.agenten || []); setSumme(r.json.summe || null); }
      }),
    ]).finally(() => setLaden(false));
  };
  useEffect(laden_, []);

  return (
    <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto">
      <PageIntro
        id="personen"
        title="Kunden & Zuordnung"
        subtitle="Wie viele Menschen sind wirklich Kunden — und bei wem gibt es Streit um die Zuordnung?"
        steps={[
          "„Bezahlte Kunden“ zählt MENSCHEN, nicht Antragszeilen. Wer zusätzlich den Bonitäts-Check gekauft hat, zählte früher zweimal.",
          "Daneben steht die alte Zeilenzahl. Die Differenz ist genau die Doppelzählung, die bisher in jedem Bericht steckte.",
          "Abgebrochene Anträge ohne E-Mail und ohne Telefon sind Entwürfe. Sie sind keine Kunden und tauchen in keiner Zählung mehr auf.",
          "Unten stehen die Personen, an denen mehrere Agenten hängen. Aufklappen zeigt je Agent den letzten dokumentierten Kontakt — die einzige belastbare Grundlage für die Frage, wer wirklich gearbeitet hat.",
          "Diese Seite entscheidet nichts. Sie legt nur vor, was du für die Entscheidung brauchst.",
        ]}
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[15px] font-bold text-slate-900 inline-flex items-center gap-2">
          <Users size={16} className="text-slate-400" /> Kunden & Zuordnung
        </h1>
        <button
          onClick={laden_}
          disabled={laden}
          className="px-3 py-2 rounded-lg border border-slate-300 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={laden ? "animate-spin" : ""} /> Neu laden
        </button>
      </div>

      {/* ── Die Kundenzahl ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kachel
          betont
          titel="Bezahlte Kunden"
          wert={kz ? String(kz.personen.bezahlt) : "—"}
          unten="Menschen mit mind. einer bezahlten Bestellung"
          hinweis="Gezählt werden PERSONEN, nicht Antragszeilen. Wer zusätzlich den Bonitäts-Check gekauft hat, zählt genau einmal."
        />
        <Kachel
          titel="Alte Zählung (Zeilen)"
          wert={kz ? String(kz.zeilen.bezahlt) : "—"}
          unten={kz && kz.differenz > 0 ? `${kz.differenz} davon doppelt gezählt` : "keine Doppelzählung"}
          hinweis="So wurde bisher überall gezählt: bezahlte Antragszeilen. Die Differenz zur linken Kachel ist die Doppelzählung."
        />
        <Kachel
          titel={zahlungsstatusText("claimed_paid")}
          wert={kz ? String(kz.personen.angekuendigt) : "—"}
          unten="Personen, die „ich habe bezahlt“ gemeldet haben"
          hinweis="Auch hier: Menschen, nicht Zeilen."
        />
        <Kachel
          titel="Personen gesamt"
          wert={kz ? String(kz.personen.gesamt) : "—"}
          unten={kz ? `${kz.entwuerfe} Entwürfe zählen nicht mit` : ""}
          hinweis="Alle bekannten Menschen mit mindestens einer E-Mail oder Rufnummer. Abgebrochene Anträge ohne jeden Kontaktweg sind Entwürfe und keine Personen."
        />
      </div>

      {kz && kz.differenz > 0 && (
        <div className="mb-6 px-4 py-3 rounded-2xl border border-slate-300 bg-white text-[12.5px] text-slate-600 leading-snug">
          <b className="text-slate-900">Warum die beiden Zahlen auseinandergehen:</b>{" "}
          {kz.zeilen.bezahlt} bezahlte Antragszeilen gehören {kz.personen.bezahlt} Menschen.
          Die {kz.differenz} Differenz sind Zweitbestellungen derselben Person — fast immer
          der Bonitäts-Check, der bewusst eine eigene Bestellzeile anlegt. Umsatz und Provision
          bleiben davon unberührt: Es wurde nichts doppelt berechnet, nur doppelt gezählt.
        </div>
      )}

      {/* ── Agenten-Konflikte ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 mt-7">
        <AlertTriangle size={15} className="text-amber-500" />
        <h2 className="text-[14px] font-bold text-slate-900">Personen mit mehreren Agenten</h2>
        {summe && (
          <span className="ml-auto text-[12px] text-slate-500">
            {summe.personen} Fälle · {summe.mitZahlung} mit Zahlung · {eur(summe.bezahltSumme)}
          </span>
        )}
      </div>

      {jeAgent.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Betroffene Agenten</p>
          <div className="flex flex-wrap gap-2">
            {jeAgent.map((a) => (
              <span key={a.id} className="px-2.5 py-1 rounded-lg border border-slate-200 text-[12px] text-slate-600">
                {a.name} <b className="tabular-nums text-slate-900">{a.konflikte}</b>
                {a.mitZahlung > 0 && <span className="text-slate-400"> · {a.mitZahlung} mit Zahlung</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {laden && konflikte.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-slate-400">Lade …</p>
      )}
      {!laden && konflikte.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-slate-400 bg-white border border-slate-200 rounded-2xl">
          Keine offenen Zuordnungs-Konflikte. Jede Person hängt an genau einem Agenten.
        </p>
      )}

      <div className="space-y-2.5">
        {konflikte.map((k) => <KonfliktKarte key={k.personId} k={k} />)}
      </div>

      {konflikte.length > 0 && (
        <p className="mt-5 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-[12px] text-slate-500 leading-snug">
          <b className="text-slate-700">Warum das System hier nicht selbst entscheidet:</b> An der
          Zuordnung hängt Provision. Ein Automat, der nach „letztem Kontakt" oder „ältester
          Zuweisung" rät, verteilt fremdes Geld um — und niemand könnte hinterher begründen,
          warum. Deshalb: markieren, vorlegen, du entscheidest. Oder es wird mit dem Stichtag
          und der Basis-Provision aufgelöst.
        </p>
      )}
    </div>
  );
}
