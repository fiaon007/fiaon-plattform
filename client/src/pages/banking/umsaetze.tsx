// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Umsätze (E-228)
//
// Jede Zeile kommt aus genau einer Quelle: der Bank (Eingänge), den
// Auszahlungen an Mitarbeiter oder dem Kassenbuch. Das steht an jeder Zeile —
// ein Umsatz ohne Herkunft ist eine Behauptung.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { ruf, type Auftrag, type Ich, type NachholZeile, type Umsatz, type UmsatzArt } from "./api";
import { geld, geldVz, heute, initialen, tag, tagesKopf, zeit, zahl } from "./format";
import { Chip, Dialog, Knopf, KnopfLink, Kopierfeld, Laden, Leer, Meldung, Schublade, Zeichen, useEntprellt, type ChipArt } from "./ui";

export const ART_TEXT: Record<UmsatzArt, string> = {
  kunde: "Kundenzahlung", offen: "Eingang ohne Zuordnung", sonstiges: "Sonstiger Eingang",
  auszahlung: "Auszahlung an Mitarbeiter", ueberweisung: "Überweisung", einlage: "Einlage",
  eingang: "Eingang (erfasst)", ausgabe: "Ausgabe (erfasst)", korrektur: "Korrekturbuchung",
};

const HERKUNFT: Record<UmsatzArt, string> = {
  kunde: "Bank", offen: "Bank", sonstiges: "Bank", auszahlung: "Auszahlung", ueberweisung: "Zahlungsverkehr",
  einlage: "Von Hand", eingang: "Von Hand", ausgabe: "Von Hand", korrektur: "Von Hand",
};

function zustandsChip(u: Umsatz): { art: ChipArt; text: string } | null {
  if (u.storniert) return { art: "still", text: "Storniert" };
  if (u.schwebend) return { art: "info", text: "Unterwegs" };
  if (u.art === "offen") return { art: "warn", text: "Nicht zugeordnet" };
  if (u.art === "auszahlung") return { art: "tief", text: "Auszahlung" };
  if (u.art === "ueberweisung") return { art: "tief", text: "Überweisung" };
  if (u.art === "einlage") return { art: "gut", text: "Einlage" };
  if (u.art === "korrektur") return { art: "warn", text: "Korrektur" };
  if (u.art === "sonstiges") return { art: "still", text: "Sonstiges" };
  if (u.art === "eingang" || u.art === "ausgabe") return { art: "still", text: "Von Hand" };
  return null;
}

const ART_ZEICHEN: Partial<Record<UmsatzArt, string>> = {
  auszahlung: "team", ueberweisung: "senden", einlage: "bank", korrektur: "waage", eingang: "rein", ausgabe: "raus", sonstiges: "karte",
};

export function UmsatzZeile({ u, onWahl, kontoZeigen }: { u: Umsatz; onWahl: (u: Umsatz) => void; kontoZeigen?: boolean }) {
  const chip = zustandsChip(u);
  const zeichen = ART_ZEICHEN[u.art];
  return (
    <button type="button" className={`bk-umsatz${u.storniert ? " bk-storniert" : ""}`} onClick={() => onWahl(u)}>
      <span className={`bk-avatar bk-av-${u.cents < 0 ? "aus" : "ein"}`} aria-hidden="true">
        {zeichen ? <Zeichen n={zeichen} g={16} /> : initialen(u.gegenpartei)}
      </span>
      <span className="bk-u-mitte">
        <span className="bk-u-name">
          {u.gegenpartei}
          {u.kunde && u.kunde.toLowerCase() !== u.gegenpartei.toLowerCase() ? <em> · für {u.kunde}</em> : null}
        </span>
        <span className="bk-u-zweck">
          {u.zweck || ART_TEXT[u.art]}
          {u.referenz && !(u.zweck || "").includes(u.referenz) ? <span className="bk-mono"> · {u.referenz}</span> : null}
        </span>
      </span>
      <span className="bk-u-chips">
        {kontoZeigen && u.konto === "wise" ? <Chip art="still">Wise</Chip> : null}
        {chip ? <Chip art={chip.art}>{chip.text}</Chip> : null}
      </span>
      <span className="bk-u-rechts">
        <span className={`bk-u-betrag ${u.cents < 0 ? "bk-minus" : "bk-plus"}`}>{geldVz(u.cents)}</span>
        {u.saldoNach != null ? <span className="bk-u-saldo">Saldo {zahl(u.saldoNach)}</span> : null}
      </span>
    </button>
  );
}

/** Gruppiert nach Tag, wie in einer Banking-App: Kopf mit Tagessumme. */
export function UmsatzListe({ zeilen, onWahl, kontoZeigen }: { zeilen: Umsatz[]; onWahl: (u: Umsatz) => void; kontoZeigen?: boolean }) {
  const tage = useMemo(() => {
    const karte = new Map<string, Umsatz[]>();
    for (const u of zeilen) karte.set(u.tag, [...(karte.get(u.tag) || []), u]);
    return Array.from(karte.entries());
  }, [zeilen]);
  return (
    <div className="bk-umsatzliste">
      {tage.map(([t, liste]) => {
        const summe = liste.filter((u) => !u.storniert).reduce((s, u) => s + u.cents, 0);
        return (
          <section key={t} className="bk-tag">
            <header className="bk-tag-kopf">
              <span>{tagesKopf(t)}</span>
              <span className={summe < 0 ? "bk-minus" : "bk-leise"}>{geldVz(summe)}</span>
            </header>
            {liste.map((u) => <UmsatzZeile key={u.uid} u={u} onWahl={onWahl} kontoZeigen={kontoZeigen} />)}
          </section>
        );
      })}
    </div>
  );
}

// ── Liegengebliebene Eingänge buchen (01.10.2026) ───────────────────────────
// Der Eingang liegt im Bankbuch, aber keine Buchung hat ihn je angefasst (E-235:
// Referenz ohne Strich, Regel B: Rate ohne Nummer). Der Server rechnet die
// Trockenprobe vor — Ziel, Regel, Betrag, welche Provision vorgemerkt wird, welche
// Mail der Kunde bekommt — und erst dann bucht der Inhaber mit einem Klick über
// denselben Weg wie jede andere Zahlung. Was nicht buchbar ist, zeigt den Grund
// und keinen Knopf.
const REGEL_TEXT: Record<string, string> = {
  erstzahlung: "Erstzahlung — Bestellung wird bezahlt, Kunde freigeschaltet",
  rate: "Monatsrate mit Nummer",
  regel_b: "Regel B — älteste offene Rate (Referenz ohne Ratennummer)",
};

function istBankEingang(u: Umsatz): boolean {
  return u.uid.startsWith("bank:") && u.cents > 0 && !u.verbucht && !u.schwebend && !u.storniert;
}

/** Die Trockenprobe als Liste — in der Schublade und im Bestätigungsfenster dieselbe. */
export function Trockenprobe({ z, kompakt }: { z: NachholZeile; kompakt?: boolean }) {
  return (
    <dl className="bk-dl bk-probe">
      <dt>Ziel</dt><dd className="bk-mono">{z.ziel ?? "—"}{z.kunde ? <span className="bk-leise"> · {z.kunde}</span> : null}</dd>
      <dt>Regel</dt><dd>{z.regel ? REGEL_TEXT[z.regel] ?? z.regel : "—"}{z.rateNr != null ? ` · Rate ${z.rateNr}` : ""}</dd>
      <dt>Betrag</dt><dd>{geld(z.betragCents)} am {tag(z.datum)}</dd>
      {!kompakt && z.deckung ? <><dt>Deckung</dt><dd className="bk-leise">{z.deckung}</dd></> : null}
      <dt>Provision</dt><dd>{z.provision.length ? z.provision.map((p, i) => <div key={i}>{p}</div>) : "keine"}</dd>
      {!kompakt ? <><dt>Kunde bekommt</dt><dd>{z.mails.length ? z.mails.map((m, i) => <div key={i}>{m}</div>) : "keine Mail"}</dd></> : null}
      {z.hinweise.length ? <><dt>Hinweis</dt><dd className="bk-probe-hinweis">{z.hinweise.map((h, i) => <div key={i}>{h}</div>)}</dd></> : null}
    </dl>
  );
}

/** Bestätigung vor dem Klick: erst sehen, dann buchen. */
function BuchenDialog({ z, offen, laeuft, onZu, onBuchen }: { z: NachholZeile | null; offen: boolean; laeuft: boolean; onZu: () => void; onBuchen: () => void }) {
  return (
    <Dialog offen={offen && !!z} titel="Jetzt buchen?" onZu={onZu}>
      {z ? (
        <div className="bk-probe-dialog">
          <p className="bk-leise">Der Eingang geht durch denselben Buchungsweg wie jede andere Zahlung. Provision wird nach dem Schalter im Chefbüro vorgemerkt, nicht gebucht.</p>
          <Trockenprobe z={z} />
          <div className="bk-knopfreihe bk-rechts">
            <Knopf art="still" onClick={onZu} disabled={laeuft}>Abbrechen</Knopf>
            <Knopf art="primaer" zeichen="haken" onClick={onBuchen} disabled={laeuft}>{laeuft ? "Bucht …" : `${geld(z.betragCents)} auf ${z.ziel ?? "—"} buchen`}</Knopf>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

async function eingangBuchen(z: NachholZeile): Promise<{ grund: string; aufgabe: string | null }> {
  const j = await ruf<{ ergebnis: { gebucht: boolean; grund: string }; aufgabe: string | null }>(`/buchhaltung/nachholen/bank:${z.id}/buchen`, {
    body: { erwartet: { regel: z.regel, ziel: z.ziel, rateId: z.rateId } },
  });
  if (!j.ergebnis?.gebucht) throw new Error(j.ergebnis?.grund || "Nicht gebucht.");
  return { grund: j.ergebnis.grund, aufgabe: j.aufgabe ?? null };
}

/**
 * Der Kasten über der Umsatzliste: „N Eingänge warten auf Buchung" → „Alle prüfen"
 * lädt jede Trockenprobe, dann je Zeile „Jetzt buchen" (nur Inhaber) oder der Grund.
 */
export function NachholPanel({ ich, anzahl, cents, onGebucht }: { ich: Ich; anzahl: number; cents: number; onGebucht: () => void }) {
  const [liste, setListe] = useState<NachholZeile[] | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [wahl, setWahl] = useState<NachholZeile | null>(null);
  // Vorgabe: der geprüfte Zeitraum seit 24.09. — ältere Eingänge (seit 01.09.) nur auf Wunsch,
  // damit „Alle buchen" nie Zeilen mitnimmt, die niemand angesehen hat.
  const [aeltere, setAeltere] = useState(false);
  const inhaber = ich.rolle === "inhaber";

  const pruefen = async (mitAelteren = aeltere) => {
    setLaeuft("pruefen"); setFehler(null);
    try { const j = await ruf<{ zeilen: NachholZeile[] }>(`/buchhaltung/nachholen${mitAelteren ? "?seit=aeltere" : ""}`); setListe(j.zeilen); }
    catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };
  const buchen = async (z: NachholZeile) => {
    setLaeuft(`b${z.id}`); setFehler(null);
    try {
      const r = await eingangBuchen(z);
      setMeldung(`Gebucht: ${geld(z.betragCents)} auf ${z.ziel} — ${r.grund}${r.aufgabe ? ` · ${r.aufgabe}` : ""}.`);
      setWahl(null); onGebucht(); await pruefen();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };
  const alleBuchen = async () => {
    const frei = (liste || []).filter((z) => z.buchen);
    if (!frei.length) return;
    const text = frei.map((z) => `· ${geld(z.betragCents)} → ${z.ziel} (${z.regel === "erstzahlung" ? "Erstzahlung" : `Rate ${z.rateNr ?? "?"}`})${z.hinweise.length ? " — Hinweis beachten" : ""}`).join("\n");
    if (!window.confirm(`${frei.length} Eingänge jetzt buchen (${geld(frei.reduce((s, z) => s + z.betragCents, 0))})?\n\n${text}\n\nEiner nach dem anderen, Abbruch beim ersten Fehlschlag. Provision wird vorgemerkt, nicht gebucht.`)) return;
    setLaeuft("alle"); setFehler(null);
    try {
      const j = await ruf<{ gebucht: number; abgebrochen: boolean; schritte: { id: number; gebucht: boolean; grund: string }[] }>("/buchhaltung/nachholen/alle-buchen", { body: { ids: frei.map((z) => z.id) } });
      const kaputt = j.schritte.find((x) => !x.gebucht);
      setMeldung(`${j.gebucht} von ${frei.length} gebucht.${kaputt ? ` Abbruch bei #${kaputt.id}: ${kaputt.grund}` : ""}`);
      onGebucht(); await pruefen();
    } catch (e: any) { setFehler(e.message); } finally { setLaeuft(null); }
  };

  if (!anzahl && !liste) return null;
  const buchbar = (liste || []).filter((z) => z.buchen);
  return (
    <section className="bk-nachholen" aria-label="Liegengebliebene Eingänge">
      <header className="bk-nachholen-kopf">
        <div>
          <div className="bk-block-titel">Eingänge ohne Buchung</div>
          <p className="bk-leise">
            {liste
              ? `${liste.length} geprüft · ${buchbar.length} buchbar (${geld(buchbar.reduce((s, z) => s + z.betragCents, 0))}) · ${liste.length - buchbar.length} bleiben Handarbeit`
              : `${anzahl} Eingänge über ${geld(cents)} liegen seit dem 24.09. im Bankbuch, ohne dass eine Buchung sie angefasst hat. „Alle prüfen“ rechnet jede Zeile trocken vor — gebucht wird erst nach deinem Klick.`}
          </p>
        </div>
        <div className="bk-knopfreihe bk-eng">
          <Knopf zeichen="suche" klein onClick={() => void pruefen()} disabled={!!laeuft}>{laeuft === "pruefen" ? "Prüft …" : liste ? "Erneut prüfen" : `Alle ${anzahl} prüfen`}</Knopf>
          {liste && !aeltere ? <Knopf art="still" klein onClick={() => { setAeltere(true); void pruefen(true); }} disabled={!!laeuft}>Ältere einbeziehen (seit 01.09.)</Knopf> : null}
          {inhaber && buchbar.length > 1 ? (
            <Knopf art="primaer" zeichen="haken" klein onClick={() => void alleBuchen()} disabled={!!laeuft}>{laeuft === "alle" ? "Bucht …" : `Alle ${buchbar.length} buchen`}</Knopf>
          ) : null}
        </div>
      </header>
      {fehler ? <Meldung art="fehler" onZu={() => setFehler(null)}>{fehler}</Meldung> : null}
      {meldung ? <Meldung art="gut" onZu={() => setMeldung(null)}>{meldung}</Meldung> : null}
      {liste && liste.length === 0 ? <Meldung art="gut">Nichts liegt mehr — alle Eingänge sind gebucht oder unterwegs.</Meldung> : null}
      {liste && liste.length > 0 ? (
        <div className="bk-nachholen-liste">
          {liste.map((z) => (
            <article key={z.id} className={`bk-nachholen-zeile${z.buchen ? " buchbar" : ""}`}>
              <div className="bk-nz-kopf">
                <span className="bk-nz-datum">{tag(z.datum)}</span>
                <span className="bk-nz-betrag bk-plus">{geld(z.betragCents)}</span>
                <span className="bk-nz-zweck">{z.absender ? <strong>{z.absender}</strong> : null} <span className="bk-mono">{z.zweck ?? z.zweckRef ?? "—"}</span></span>
                <span className="bk-nz-nr bk-leise">#{z.id}</span>
              </div>
              {z.buchen ? (
                <>
                  <Trockenprobe z={z} kompakt />
                  {inhaber ? (
                    <div className="bk-knopfreihe bk-eng">
                      <Knopf art="primaer" zeichen="haken" klein onClick={() => setWahl(z)} disabled={!!laeuft}>{laeuft === `b${z.id}` ? "Bucht …" : "Jetzt buchen"}</Knopf>
                    </div>
                  ) : <p className="bk-leise">Buchen kann nur der Inhaber.</p>}
                </>
              ) : (
                <Meldung art="warn">Bleibt Handarbeit: {z.unklar ?? z.ergebnis}{z.ziel ? <span className="bk-mono"> · {z.ziel}</span> : null}</Meldung>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <BuchenDialog z={wahl} offen={!!wahl} laeuft={!!laeuft} onZu={() => setWahl(null)} onBuchen={() => { if (wahl) void buchen(wahl); }} />
    </section>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function UmsatzDetail({ uid, onZu, ich, onGebucht }: { uid: string | null; onZu: () => void; ich?: Ich; onGebucht?: () => void }) {
  const [daten, setDaten] = useState<{ umsatz: Umsatz; auftrag: Auftrag | null } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [probe, setProbe] = useState<{ zeile: NachholZeile | null; fehler: string | null } | null>(null);
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [gebucht, setGebucht] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    setDaten(null); setFehler(null); setProbe(null); setFrage(false); setGebucht(null);
    ruf<{ umsatz: Umsatz; auftrag: Auftrag | null }>(`/buchhaltung/umsatz/${encodeURIComponent(uid)}`)
      .then((j) => {
        setDaten(j);
        // Ein Bankeingang ohne Buchung: gleich die Trockenprobe dazu — der Mensch sieht, was ein Klick täte.
        if (istBankEingang(j.umsatz)) {
          ruf<{ zeile: NachholZeile }>(`/buchhaltung/nachholen/${encodeURIComponent(uid)}/trocken`, { body: {} })
            .then((p) => setProbe({ zeile: p.zeile, fehler: null }))
            .catch((e) => setProbe({ zeile: null, fehler: e.message }));
        }
      }).catch((e) => setFehler(e.message));
  }, [uid]);
  const u = daten?.umsatz;
  const z = probe?.zeile ?? null;
  const buchen = async () => {
    if (!z) return;
    setLaeuft(true);
    try {
      const r = await eingangBuchen(z);
      setGebucht(`Gebucht — ${r.grund}${r.aufgabe ? ` · ${r.aufgabe}` : ""}.`);
      setFrage(false); setProbe(null);
      onGebucht?.();
    } catch (e: any) { setFehler(e.message); setFrage(false); } finally { setLaeuft(false); }
  };
  return (
    <Schublade offen={!!uid} onZu={onZu} titel={u ? ART_TEXT[u.art] : "Umsatz"}>
      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : !u ? <Laden zeilen={6} /> : (
        <div className="bk-detail">
          <div className="bk-detail-betrag">
            <span className={u.cents < 0 ? "bk-minus" : "bk-plus"}>{geldVz(u.cents)}</span>
            <small>{tag(u.tag)} · {u.konto === "wise" ? "Altkonto Wise" : "Geschäftskonto"}</small>
          </div>
          <dl className="bk-dl">
            <dt>{u.cents < 0 ? "Empfänger" : "Absender"}</dt><dd>{u.gegenpartei}</dd>
            {u.kunde ? <><dt>Zugeordneter Kunde</dt><dd>{u.kunde}</dd></> : null}
            <dt>Verwendungszweck</dt><dd>{u.zweck || "—"}</dd>
            {u.referenz ? <><dt>Referenz</dt><dd className="bk-mono">{u.referenz}</dd></> : null}
            <dt>Herkunft</dt><dd>{HERKUNFT[u.art]}{u.erfasstVon ? ` · erfasst von ${u.erfasstVon.split("@")[0]}` : ""}</dd>
            <dt>Beleg</dt><dd className="bk-mono">{u.beleg || "—"}</dd>
            <dt>Stand</dt><dd>{u.storniert ? "Storniert" : u.schwebend ? "Unterwegs — noch nicht gutgeschrieben" : u.art === "offen" ? "Eingegangen, keiner Bestellung zugeordnet" : "Gebucht"}</dd>
            {u.saldoNach != null ? <><dt>Saldo danach</dt><dd>{geld(u.saldoNach)} <span className="bk-leise">laut Buch</span></dd></> : null}
            {u.notiz ? <><dt>Vermerk</dt><dd className="bk-leise">{u.notiz}</dd></> : null}
          </dl>
          {daten?.auftrag ? (
            <div className="bk-detail-block">
              <div className="bk-block-titel">Zahlungsauftrag {daten.auftrag.nummer}</div>
              <Kopierfeld l="IBAN" w={daten.auftrag.iban.replace(/(.{4})/g, "$1 ").trim()} />
              {daten.auftrag.bankReferenz ? <Kopierfeld l="Bankreferenz" w={daten.auftrag.bankReferenz} /> : null}
            </div>
          ) : null}
          {gebucht ? <Meldung art="gut">{gebucht}</Meldung> : null}
          {istBankEingang(u) && !gebucht ? (
            <div className="bk-detail-block">
              <div className="bk-block-titel">Trockenprobe — was ein Klick buchen würde</div>
              {!probe ? <Laden zeilen={3} /> : probe.fehler ? <Meldung art="fehler">{probe.fehler}</Meldung> : z ? (
                <>
                  <Trockenprobe z={z} />
                  {z.buchen ? (
                    ich?.rolle === "inhaber"
                      ? <div className="bk-knopfreihe"><Knopf art="primaer" zeichen="haken" onClick={() => setFrage(true)} disabled={laeuft}>Jetzt buchen</Knopf></div>
                      : <p className="bk-leise">Buchbar — buchen kann nur der Inhaber.</p>
                  ) : (
                    <Meldung art="warn">Bleibt Handarbeit: {z.unklar ?? z.ergebnis}. {u.art === "offen"
                      ? "Zuordnen lässt er sich in der Zahlungszentrale — dort wird er mit derselben Regel gebucht wie jeder andere Eingang."
                      : "Ein Mensch entscheidet die Zuordnung in der Zahlungszentrale."}</Meldung>
                  )}
                </>
              ) : null}
            </div>
          ) : null}
          <BuchenDialog z={z} offen={frage} laeuft={laeuft} onZu={() => setFrage(false)} onBuchen={() => void buchen()} />
          <div className="bk-knopfreihe">
            {u.auftragId ? <KnopfLink href={`/api/fiaon/buchhaltung/auftrag/${u.auftragId}/bestaetigung.pdf`} zeichen="pdf">Zahlungsbestätigung</KnopfLink> : null}
            {u.auszahlungId ? <KnopfLink href={`/api/fiaon/buchhaltung/auszahlung/${u.auszahlungId}/beleg.pdf`} zeichen="pdf">Auszahlungsbeleg</KnopfLink> : null}
            {u.abrechnungId ? <KnopfLink href={`/api/fiaon/buchhaltung/abrechnung/${u.abrechnungId}.pdf`} zeichen="dokument">Abrechnung</KnopfLink> : null}
            {u.art === "offen" ? <KnopfLink href="/chef/zahlungen" zeichen="rechts" neu={false}>Zur Zahlungszentrale</KnopfLink> : null}
          </div>
        </div>
      )}
    </Schublade>
  );
}

// ── Die Seite ───────────────────────────────────────────────────────────────
type Zeitraum = "monat" | "vormonat" | "90" | "alles" | "frei";

function zeitraumGrenzen(z: Zeitraum, von: string, bis: string): { von: string | null; bis: string | null } {
  const h = heute();
  const [j, m] = h.split("-").map(Number);
  if (z === "monat") return { von: `${h.slice(0, 7)}-01`, bis: null };
  if (z === "vormonat") {
    const vj = m === 1 ? j - 1 : j, vm = m === 1 ? 12 : m - 1;
    const letzter = new Date(Date.UTC(vj, vm, 0)).getUTCDate();
    const p = `${vj}-${String(vm).padStart(2, "0")}`;
    return { von: `${p}-01`, bis: `${p}-${letzter}` };
  }
  if (z === "90") return { von: new Date(Date.now() - 90 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }), bis: null };
  if (z === "frei") return { von: von || null, bis: bis || null };
  return { von: null, bis: null };
}

export default function Umsaetze({ vorfilter, ich, nachholen, onGebucht }: {
  vorfilter?: { arten?: UmsatzArt[]; konto?: string };
  ich?: Ich;
  nachholen?: { anzahl: number; cents: number };
  onGebucht?: () => void;
}) {
  const [konto, setKonto] = useState<string>(vorfilter?.konto ?? "alle");
  const [richtung, setRichtung] = useState<"alle" | "ein" | "aus">("alle");
  const [art, setArt] = useState<string>(vorfilter?.arten?.join(",") ?? "");
  const [zr, setZr] = useState<Zeitraum>("alles");
  const [von, setVon] = useState(""); const [bis, setBis] = useState("");
  const [q, setQ] = useState("");
  const suche = useEntprellt(q, 250);
  const [zeilen, setZeilen] = useState<Umsatz[] | null>(null);
  const [summe, setSumme] = useState<{ gesamt: number; einCents: number; ausCents: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [mehrLaeuft, setMehrLaeuft] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const parameter = useMemo(() => {
    const g = zeitraumGrenzen(zr, von, bis);
    const p = new URLSearchParams();
    if (konto !== "alle") p.set("konto", konto);
    if (richtung !== "alle") p.set("richtung", richtung);
    if (art) p.set("arten", art);
    if (g.von) p.set("von", g.von);
    if (g.bis) p.set("bis", g.bis);
    if (suche.trim()) p.set("q", suche.trim());
    return p;
  }, [konto, richtung, art, zr, von, bis, suche]);

  const laden = useCallback(async (offset = 0) => {
    const p = new URLSearchParams(parameter);
    p.set("limit", "80"); p.set("offset", String(offset));
    const j = await ruf<{ zeilen: Umsatz[]; gesamt: number; einCents: number; ausCents: number }>(`/buchhaltung/umsaetze?${p}`);
    return j;
  }, [parameter]);

  useEffect(() => {
    let weg = false;
    setZeilen(null); setFehler(null);
    laden(0).then((j) => { if (!weg) { setZeilen(j.zeilen); setSumme({ gesamt: j.gesamt, einCents: j.einCents, ausCents: j.ausCents }); } })
      .catch((e) => { if (!weg) setFehler(e.message); });
    return () => { weg = true; };
  }, [laden]);

  const mehr = async () => {
    if (!zeilen) return;
    setMehrLaeuft(true);
    try { const j = await laden(zeilen.length); setZeilen([...zeilen, ...j.zeilen]); }
    catch (e: any) { setFehler(e.message); } finally { setMehrLaeuft(false); }
  };
  const [neuLaden, setNeuLaden] = useState(0);
  useEffect(() => {
    if (!neuLaden) return;
    laden(0).then((j) => { setZeilen(j.zeilen); setSumme({ gesamt: j.gesamt, einCents: j.einCents, ausCents: j.ausCents }); }).catch((e) => setFehler(e.message));
  }, [neuLaden, laden]);
  const nachBuchung = () => { setNeuLaden((n) => n + 1); onGebucht?.(); };

  return (
    <div className="bk-seite">
      {ich && nachholen ? <NachholPanel ich={ich} anzahl={nachholen.anzahl} cents={nachholen.cents} onGebucht={nachBuchung} /> : null}
      <div className="bk-filter" role="search">
        <div className="bk-such">
          <Zeichen n="suche" g={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Referenz, Zweck oder Betrag" aria-label="Umsätze durchsuchen" />
          {q ? <button type="button" aria-label="Suche leeren" onClick={() => setQ("")}><Zeichen n="kreuz" g={14} /></button> : null}
        </div>
        <div className="bk-segment" role="tablist" aria-label="Konto">
          {[["alle", "Alle Konten"], ["geschaeft", "Geschäftskonto"], ["wise", "Altkonto Wise"]].map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={konto === w} className={konto === w ? "aktiv" : ""} onClick={() => setKonto(w)}>{t}</button>
          ))}
        </div>
        <div className="bk-segment" role="tablist" aria-label="Richtung">
          {[["alle", "Alle"], ["ein", "Eingänge"], ["aus", "Ausgänge"]].map(([w, t]) => (
            <button key={w} type="button" role="tab" aria-selected={richtung === w} className={richtung === w ? "aktiv" : ""} onClick={() => setRichtung(w as any)}>{t}</button>
          ))}
        </div>
        <select className="bk-auswahl" value={art} onChange={(e) => setArt(e.target.value)} aria-label="Art">
          <option value="">Alle Arten</option>
          <option value="kunde">Kundenzahlungen</option>
          <option value="offen">Nicht zugeordnet</option>
          <option value="auszahlung">Auszahlungen Mitarbeiter</option>
          <option value="ueberweisung">Überweisungen</option>
          <option value="einlage,eingang,ausgabe,korrektur">Von Hand erfasst</option>
          <option value="sonstiges">Sonstige Eingänge</option>
        </select>
        <select className="bk-auswahl" value={zr} onChange={(e) => setZr(e.target.value as Zeitraum)} aria-label="Zeitraum">
          <option value="alles">Gesamter Zeitraum</option>
          <option value="monat">Dieser Monat</option>
          <option value="vormonat">Letzter Monat</option>
          <option value="90">Letzte 90 Tage</option>
          <option value="frei">Eigener Zeitraum …</option>
        </select>
        {zr === "frei" ? (
          <span className="bk-zeitraum">
            <input type="date" value={von} onChange={(e) => setVon(e.target.value)} aria-label="Von" />
            <span>–</span>
            <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} aria-label="Bis" />
          </span>
        ) : null}
      </div>

      <div className="bk-summenzeile">
        <span>{summe ? `${summe.gesamt} Umsätze` : " "}</span>
        {summe ? <span>Eingänge <strong className="bk-plus">{geld(summe.einCents)}</strong></span> : null}
        {summe ? <span>Ausgänge <strong>{geld(summe.ausCents)}</strong></span> : null}
        <span className="bk-summen-rechts">
          <KnopfLink href={`/api/fiaon/buchhaltung/umsaetze.csv?${parameter}`} zeichen="herunter" klein neu={false}>CSV für die Steuerberatung</KnopfLink>
        </span>
      </div>

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
      {!zeilen ? <Laden zeilen={10} /> : zeilen.length === 0 ? (
        <Leer titel="Keine Umsätze" text="In diesem Filter gibt es nichts. Zeitraum oder Suche ändern." />
      ) : (
        <>
          <UmsatzListe zeilen={zeilen} onWahl={(u) => setGewaehlt(u.uid)} kontoZeigen={konto === "alle"} />
          {summe && zeilen.length < summe.gesamt ? (
            <div className="bk-mehr">
              <Knopf onClick={() => void mehr()} disabled={mehrLaeuft}>{mehrLaeuft ? "Lade …" : `Weitere laden (${summe.gesamt - zeilen.length})`}</Knopf>
            </div>
          ) : null}
        </>
      )}
      <UmsatzDetail uid={gewaehlt} onZu={() => setGewaehlt(null)} ich={ich} onGebucht={nachBuchung} />
      <p className="bk-fussnote">Zuletzt geladen {zeit(new Date().toISOString())} · Eingänge aus dem Abruf der Bank, Auszahlungen und Buchungen aus dem Zahlungsverkehr der FIAON LTD.</p>
    </div>
  );
}
