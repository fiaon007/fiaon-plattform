// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › MAILWERK — „IHR VORSORGE-ÜBERBLICK“: JUSTIN DRÜCKT DEN KNOPF (E-487 (09.11.2026))
//
// Maras Mail an zahlende Kunden in Deutschland (server/lib/fiaon-vorsorge-einladung.ts). Diese Karte zeigt vor dem Klick, was
// passiert (AGENTS.md: „Ein Massenversand braucht die Grenze VOR dem Klick“): Empfänger je Kreis, wer als Nächstes dran ist,
// Staffel (höchstens 60 am Tag, 09–19 Uhr, je Mensch eine Mail), der aktive Partner mit freien Terminen. Dann:
//   · Vorschau — die echte Mail des Nächsten im Kreis, gerendert vom Motor; sendet NIE.
//   · Prüfversand — dieselbe Mail an die Testadresse des Mailwerks (Knopf und Abmeldelink führen auf die Vorschau-Seite).
//   · EIN Knopf „Freigeben“ (Schalter an + Kreis in einer Buchung) und „Anhalten“ (ab sofort nichts mehr).
// Ohne aktiven Vorsorge-Partner oder ohne offenen Empfänger ist „Freigeben“ gesperrt — mit sichtbarem Grund.
// Keine eigene Chef-Seite: eine Karte im bestehenden Raum Mailwerk. Rundgang: RUNDGANG_MAILWERK (pages/agent/rundgaenge.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { VORSORGE_KREISE, VORSORGE_KREIS_TEXT, type VorsorgeKreis } from "@shared/fiaon-vorsorge";
import "@/styles/mailwerk-vorsorge.css";

interface Freigabe { am: string; von: string; kreis: VorsorgeKreis; angehaltenAm: string | null; angehaltenVon: string | null }
interface Stand {
  ok: boolean; error?: string;
  einstellungen: { an: boolean; kreis: VorsorgeKreis; freigabe: Freigabe | null };
  kreise: Record<VorsorgeKreis, { gesamt: number; offen: number; versandt: number }>;
  gesperrt: { grund: string; text: string; anzahl: number }[];
  bezahlt: number;
  heute: { versandt: number; deckel: number };
  fenster: string;
  partner: { name: string; rolle: string; freieTermine: number; sperre: string | null }[];
  naechste: Record<VorsorgeKreis, { name: string; mail: string }[]>;
  trichter: { versandt: number; geoeffnet: number; ueberblick: number; gebucht: number };
  protokoll: { zeit: string; text: string; wer: string }[];
}

const wann = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })
  : "—");

async function posten(pfad: string, body: unknown): Promise<{ ok: boolean; json: any }> {
  const r = await fetch(`/api/fiaon${pfad}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
  }).catch(() => null);
  const json = r ? await r.json().catch(() => null) : null;
  return { ok: !!r?.ok && json?.ok === true, json };
}

export default function MailwerkVorsorge({ testAdresse }: { testAdresse: string }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kreis, setKreis] = useState<VorsorgeKreis | null>(null);
  const [vorschau, setVorschau] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);

  const laden = useCallback(() => {
    fetch("/api/fiaon/chef/mailwerk/vorsorge", { credentials: "include" })
      .then((r) => r.json())
      .then((d: Stand) => { if (!d?.ok) throw new Error(d?.error || "nicht ok"); setStand(d); setFehler(null); })
      .catch(() => setFehler("Der Stand des Vorsorge-Überblicks lässt sich gerade nicht laden."));
  }, []);
  useEffect(() => { laden(); }, [laden]);
  // Der Kreis startet bei dem, der eingestellt ist — danach wählt der Mensch.
  useEffect(() => { if (stand && kreis === null) setKreis(stand.einstellungen.kreis); }, [stand, kreis]);

  if (fehler) return <section className="cz-block mv" data-mailwerk-vorsorge><p className="cm-fein">{fehler}</p></section>;
  if (!stand || !kreis) return <section className="cz-block mv" data-mailwerk-vorsorge><p className="cm-fein">Vorsorge-Überblick wird geladen …</p></section>;

  const e = stand.einstellungen;
  const zahlen = stand.kreise[kreis];
  const titel = VORSORGE_KREIS_TEXT[kreis].titel;
  const partnerDa = stand.partner.length > 0;
  const gesperrtGrund = !partnerDa
    ? "Freigeben ist gesperrt: Es gibt keinen aktiven Vorsorge-Partner — die Seite hätte nichts zu buchen."
    : zahlen.offen === 0 ? `Freigeben ist gesperrt: Im Kreis „${titel}“ wartet niemand mehr auf die Mail.` : null;
  const gesperrtSumme = stand.gesperrt.reduce((n, g) => n + g.anzahl, 0);

  async function pruefversand() {
    setBusy("pruef"); setMeldung(null);
    const r = await posten("/chef/mailwerk/vorsorge/pruefversand", { kreis, an: testAdresse });
    setBusy(null);
    setMeldung({ text: r.ok ? r.json.meldung : `Prüfversand fehlgeschlagen: ${r.json?.error ?? "Netzwerkfehler"}`, gut: r.ok });
  }
  async function freigeben() {
    if (!kreis) return;
    const frage = `Jetzt freigeben?\n\nKreis „${titel}“: ${zahlen.offen} Kunden.\nHöchstens ${stand!.heute.deckel} am Tag, ${stand!.fenster}, gleichmäßig verteilt — jeder bekommt genau eine Mail.\n\n„Anhalten“ stoppt jederzeit sofort.`;
    if (!window.confirm(frage)) return;
    setBusy("frei"); setMeldung(null);
    const r = await posten("/chef/mailwerk/vorsorge/freigeben", { kreis });
    setBusy(null);
    setMeldung({ text: r.ok ? r.json.meldung : `Nicht freigegeben: ${r.json?.error ?? "Netzwerkfehler"}`, gut: r.ok });
    laden();
  }
  async function anhalten() {
    setBusy("halt"); setMeldung(null);
    const r = await posten("/chef/mailwerk/vorsorge/anhalten", {});
    setBusy(null);
    setMeldung({ text: r.ok ? r.json.meldung : `Nicht angehalten: ${r.json?.error ?? "Netzwerkfehler"}`, gut: r.ok });
    laden();
  }

  return (
    <section className="cz-block mv" data-mailwerk-vorsorge>
      <header>
        <h2>Ihr Vorsorge-Überblick — Maras Einladung</h2>
        <p>
          Eine Mail je Kunde mit persönlichem Link (30 Tage): Themen festhalten und auf Wunsch selbst einen Termin beim
          Vorsorge-Partner buchen. <b>Sie geht erst raus, wenn du freigibst</b> — höchstens {stand.heute.deckel} am Tag,
          {" "}{stand.fenster}, gleichmäßig über den Tag, je Mensch genau eine.
        </p>
      </header>

      {meldung && <div className={`mv-meldung${meldung.gut ? "" : " schlecht"}`} role="status">{meldung.text}</div>}

      <div className="mv-status">
        <span className={`mv-an${e.an ? " ja" : ""}`}>{e.an ? "FREIGEGEBEN" : "AUS"}</span>
        <span>
          {e.an && e.freigabe
            ? `Kreis „${VORSORGE_KREIS_TEXT[e.kreis].titel}“ · freigegeben ${wann(e.freigabe.am)} von ${e.freigabe.von}`
            : e.freigabe?.angehaltenAm ? `Angehalten ${wann(e.freigabe.angehaltenAm)} von ${e.freigabe.angehaltenVon ?? "—"}` : "Noch nie freigegeben"}
        </span>
        <span>Heute {stand.heute.versandt} von {stand.heute.deckel}</span>
      </div>

      <div className="mv-partner">
        {partnerDa ? stand.partner.map((p) => (
          <div key={p.name}>
            <b>{p.name}</b> <span>· {p.rolle}</span>
            <small>{p.sperre ? `Gerade kein neuer Termin: ${p.sperre}` : `${p.freieTermine} freie Termine in den nächsten drei Wochen`}</small>
          </div>
        )) : <div className="mv-warn">Kein aktiver Vorsorge-Partner.</div>}
      </div>

      <div className="mv-kreise" role="radiogroup" aria-label="Empfängerkreis">
        {VORSORGE_KREISE.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kreis === k} className={`mv-kreis${kreis === k ? " an" : ""}`} onClick={() => setKreis(k)}>
            <b>{VORSORGE_KREIS_TEXT[k].titel}{e.an && e.kreis === k ? " · läuft" : ""}</b>
            <span className="mv-zahl">{stand.kreise[k].offen}</span>
            <span className="mv-klein">offen · {stand.kreise[k].versandt} schon angeschrieben</span>
            <span className="mv-text">{VORSORGE_KREIS_TEXT[k].text}</span>
          </button>
        ))}
      </div>

      <div className="mv-naechste">
        <b>Als Nächstes im Kreis „{titel}“</b>
        {stand.naechste[kreis].length
          ? <ul>{stand.naechste[kreis].map((n, i) => <li key={`${n.mail}-${i}`}>{n.name} <span>{n.mail}</span></li>)}</ul>
          : <p className="cm-fein">Niemand offen.</p>}
      </div>

      <div className="mv-tun">
        <button type="button" className="mv-knopf" onClick={() => setVorschau(true)}>Vorschau ansehen</button>
        <button type="button" className="mv-knopf" disabled={busy === "pruef"} onClick={() => void pruefversand()}>
          {busy === "pruef" ? "Wird gesendet …" : `Prüfversand an ${testAdresse || "die Testadresse"}`}
        </button>
        {e.an ? (
          <>
            {kreis !== e.kreis && (
              <button type="button" className="mv-knopf haupt" disabled={!!gesperrtGrund || busy === "frei"} onClick={() => void freigeben()}>
                Auf Kreis „{titel}“ umstellen
              </button>
            )}
            <button type="button" className="mv-knopf warn" disabled={busy === "halt"} onClick={() => void anhalten()}>{busy === "halt" ? "…" : "Anhalten"}</button>
          </>
        ) : (
          <button type="button" className="mv-knopf haupt" disabled={!!gesperrtGrund || busy === "frei"} onClick={() => void freigeben()}>
            {busy === "frei" ? "…" : `Freigeben — Kreis „${titel}“ (${zahlen.offen})`}
          </button>
        )}
      </div>
      {gesperrtGrund && !e.an && <p className="cm-fein mv-grund">{gesperrtGrund}</p>}
      <p className="cm-fein">
        Vorschau und Prüfversand senden nie an Kunden — dort führen Knopf und Abmeldelink auf die Vorschau-Seite. Nie an A, B
        oder C, Österreich/Schweiz, FIAON Global, Gesperrte, Abgemeldete oder Gekündigte. Jede Mail trägt den persönlichen
        Abmeldelink und steht im Protokoll und in der Akte.
      </p>

      <div className="mv-trichter" aria-label="Wirkung seit dem Start">
        <span><b>{stand.trichter.versandt}</b> versandt</span>
        <span><b>{stand.trichter.geoeffnet}</b> Seite geöffnet</span>
        <span><b>{stand.trichter.ueberblick}</b> Überblick gespeichert</span>
        <span><b>{stand.trichter.gebucht}</b> Termine gebucht</span>
      </div>

      <details className="mv-details">
        <summary>Nicht im Kreis: {gesperrtSumme} von {stand.bezahlt} zahlenden Kunden — nach Grund</summary>
        <ul>{stand.gesperrt.map((g) => <li key={g.grund}><span>{g.text}</span><b>{g.anzahl}</b></li>)}</ul>
      </details>
      {stand.protokoll.length > 0 && (
        <details className="mv-details">
          <summary>Protokoll ({stand.protokoll.length})</summary>
          <ul>{stand.protokoll.map((z, i) => <li key={`${z.zeit}-${i}`}><span>{wann(z.zeit)} · {z.wer}: {z.text}</span></li>)}</ul>
        </details>
      )}

      {vorschau && (
        <div className="cm-schleier" onClick={() => setVorschau(false)}>
          <div className="cm-fenster" onClick={(ev) => ev.stopPropagation()}>
            <div className="cm-fenster-kopf">
              <div>
                <b>Ihr Vorsorge-Überblick</b>
                <span>{stand.naechste[kreis][0] ? `mit den Daten von ${stand.naechste[kreis][0].name}` : "mit Beispieldaten"} · sendet nie</span>
              </div>
              <button type="button" onClick={() => setVorschau(false)} aria-label="Schließen">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <iframe title="Vorschau Ihr Vorsorge-Überblick" src={`/api/fiaon/chef/mailwerk/vorsorge/vorschau?kreis=${kreis}`} />
          </div>
        </div>
      )}
    </section>
  );
}
