// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Übersicht (E-228)
//
// Das eine Navy-Glas dieser App ist die Kontoplatte. Darauf steht zuerst,
// was stimmt: der Kontostand der Bank, wenn Airwallex ihn liefert — sonst der
// Saldo laut Buch, ausdrücklich so benannt. Darunter, was zu tun ist.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lage, MonatsFluss, Umsatz } from "./api";
import { geld, geldVz, heute, monatKurz, monatName, tag, uhr, zahl } from "./format";
import { Chip, Guilloche, Knopf, Kopieren, Zeichen } from "./ui";
import { UmsatzDetail, UmsatzListe } from "./umsaetze";

export type Reiter = "start" | "umsaetze" | "ueberweisung" | "auftraege" | "auszahlungen" | "dauer" | "auszuege" | "empfaenger" | "sicherheit" | "kontostand";

// ── Die Kontoplatte ─────────────────────────────────────────────────────────
function Kontoplatte({ lage, onGehe }: { lage: Lage; onGehe: (r: Reiter) => void }) {
  const k = lage.kasse;
  const konto = lage.konten.find((x) => x.schluessel === "geschaeft")!;
  const live = k.live.ok && k.live.cents != null;
  const haupt = live ? k.live.cents! : k.buchCents;
  const differenz = live ? k.liveDifferenzCents : k.abgleich?.differenzCents ?? null;
  return (
    <section className="bk-platte" aria-label="Geschäftskonto">
      <Guilloche className="bk-platte-band" linien={24} />
      <div className="bk-platte-kopf">
        <div>
          <div className="bk-platte-art">Geschäftskonto · {konto.inhaber}</div>
          <div className="bk-platte-institut">{konto.institut} · seit {tag(konto.seit)}</div>
        </div>
        <div className={`bk-platte-quelle${live ? " live" : ""}`}>
          <i aria-hidden="true" />
          {live ? `Bank live · ${uhr(k.live.stand)}` : "Stand laut Buch"}
        </div>
      </div>

      <div className="bk-platte-stand">
        <span className="bk-platte-l">{live ? "Kontostand" : "Saldo laut Buch"}</span>
        <span className="bk-platte-zahl">{haupt != null ? zahl(haupt) : "—"}<small>EUR</small></span>
        {live && k.live.verfuegbarCents != null && k.live.verfuegbarCents !== k.live.cents ? (
          <span className="bk-platte-neben">Verfügbar {geld(k.live.verfuegbarCents)}</span>
        ) : null}
        {!live && k.buchCents == null ? (
          <span className="bk-platte-neben">
            {lage.ich.rolle === "inhaber"
              ? <button type="button" className="bk-platte-link" onClick={() => onGehe("kontostand")}>Anfangsbestand setzen, dann rechnet das Buch den Saldo</button>
              : "Der Inhaber setzt den Anfangsbestand — erst dann rechnet das Buch einen Saldo."}
          </span>
        ) : null}
      </div>

      <div className="bk-platte-iban">
        <span className="bk-mono">{konto.ibanDisplay}</span>
        <Kopieren wert={konto.iban} beschriftung="IBAN" klein />
        <span className="bk-platte-bic">BIC <span className="bk-mono">{konto.bic}</span></span>
      </div>

      <div className="bk-platte-fuss">
        <div>
          <span>Saldo laut Buch</span>
          <strong>{k.buchCents != null ? geld(k.buchCents) : "nicht gesetzt"}</strong>
        </div>
        <div>
          <span>{live ? "Differenz Bank zu Buch" : "Bankabgleich"}</span>
          <strong>
            {differenz == null
              ? (live ? "—" : k.abgleich ? "vor Buchbeginn" : "nicht abgeglichen")
              : differenz === 0 ? "stimmt überein" : geldVz(differenz)}
          </strong>
        </div>
        <div>
          <span>Unterwegs</span>
          <strong>{k.unterwegsCents ? geld(k.unterwegsCents) : "nichts"}</strong>
        </div>
      </div>
      {!live && k.live.grund ? <div className="bk-platte-hinweis">{k.live.grund}</div> : null}
    </section>
  );
}

// ── Geldfluss je Monat (Eingänge / Ausgänge, beide Konten) ──────────────────
const FARBE_EIN = "#1D4ED8";
const FARBE_AUS = "#D97706";

function Geldfluss({ fluss }: { fluss: MonatsFluss[] }) {
  const monate = useMemo(() => {
    const karte = new Map<string, { ein: number; aus: number }>();
    for (const f of fluss) {
      const m = karte.get(f.monat) || { ein: 0, aus: 0 };
      m.ein += f.einCents; m.aus += f.ausCents;
      karte.set(f.monat, m);
    }
    return Array.from(karte.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [fluss]);
  const huelle = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(560);
  const [spitze, setSpitze] = useState<{ x: number; y: number; t: string } | null>(null);
  const [tabelle, setTabelle] = useState(false);
  useEffect(() => {
    const el = huelle.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBreite(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!monate.length) return <div className="bk-leise">Noch keine Bewegungen.</div>;
  const H = 210, oben = 12, unten = 26, links = 52;
  const max = Math.max(1, ...monate.map(([, m]) => Math.max(m.ein, m.aus)));
  const stufe = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000].map((e) => e * 100).find((s) => max / s <= 4) ?? max / 4;
  const obenWert = Math.ceil(max / stufe) * stufe;
  const y = (c: number) => oben + (H - oben - unten) * (1 - c / obenWert);
  const spalte = (breite - links) / monate.length;
  const balken = Math.min(26, (spalte - 18) / 2);

  return (
    <div className="bk-diagramm">
      <div className="bk-diagramm-kopf">
        <div className="bk-legende">
          <span><i style={{ background: FARBE_EIN }} />Eingänge</span>
          <span><i style={{ background: FARBE_AUS }} />Ausgänge</span>
        </div>
        <button type="button" className="bk-link-knopf" onClick={() => setTabelle((t) => !t)}>{tabelle ? "Als Diagramm" : "Als Tabelle"}</button>
      </div>
      {tabelle ? (
        <table className="bk-tabelle">
          <thead><tr><th>Monat</th><th className="bk-r">Eingänge</th><th className="bk-r">Ausgänge</th><th className="bk-r">Saldo</th></tr></thead>
          <tbody>{monate.map(([m, w]) => (
            <tr key={m}><td>{monatName(m)}</td><td className="bk-r">{geld(w.ein)}</td><td className="bk-r">{geld(w.aus)}</td><td className="bk-r">{geldVz(w.ein - w.aus)}</td></tr>
          ))}</tbody>
        </table>
      ) : (
        <div ref={huelle} className="bk-diagramm-flaeche" onMouseLeave={() => setSpitze(null)}>
          <svg width={breite} height={H} role="img" aria-label="Eingänge und Ausgänge je Monat">
            {[0, 0.5, 1].map((a) => (
              <g key={a}>
                <line x1={links} x2={breite} y1={y(obenWert * a)} y2={y(obenWert * a)} className="bk-raster" />
                <text x={links - 8} y={y(obenWert * a) + 4} className="bk-achse" textAnchor="end">
                  {`${Math.round((obenWert * a) / 100_000)}k`}
                </text>
              </g>
            ))}
            {monate.map(([m, w], i) => {
              const x0 = links + i * spalte + (spalte - (balken * 2 + 2)) / 2;
              const teile = [
                { wert: w.ein, farbe: FARBE_EIN, name: "Eingänge", x: x0 },
                { wert: w.aus, farbe: FARBE_AUS, name: "Ausgänge", x: x0 + balken + 2 },
              ];
              return (
                <g key={m}>
                  {teile.map((t) => {
                    const hoehe = Math.max(t.wert > 0 ? 2 : 0, y(0) - y(t.wert));
                    const r = Math.min(4, hoehe / 2, balken / 2);
                    const oy = y(0) - hoehe;
                    const d = hoehe <= 0 ? "" : `M${t.x} ${y(0)}V${oy + r}Q${t.x} ${oy} ${t.x + r} ${oy}H${t.x + balken - r}Q${t.x + balken} ${oy} ${t.x + balken} ${oy + r}V${y(0)}Z`;
                    return (
                      <g key={t.name}>
                        {d ? <path d={d} fill={t.farbe} /> : null}
                        <rect x={t.x - 3} y={oben} width={balken + 6} height={H - oben - unten} fill="transparent"
                          onMouseEnter={() => setSpitze({ x: t.x + balken / 2, y: Math.min(oy, y(0) - 8), t: `${monatName(m)} · ${t.name} ${geld(t.wert)}` })} />
                      </g>
                    );
                  })}
                  <text x={links + i * spalte + spalte / 2} y={H - 8} className="bk-achse" textAnchor="middle">{monatKurz(m)}</text>
                </g>
              );
            })}
            <line x1={links} x2={breite} y1={y(0)} y2={y(0)} className="bk-grundlinie" />
          </svg>
          {spitze ? <div className="bk-spitze" style={{ left: Math.min(breite - 180, Math.max(0, spitze.x - 90)), top: Math.max(0, spitze.y - 40) }}>{spitze.t}</div> : null}
        </div>
      )}
    </div>
  );
}

// ── Zu erledigen ────────────────────────────────────────────────────────────
function ZuTun({ lage, onGehe }: { lage: Lage; onGehe: (r: Reiter) => void }) {
  const inhaber = lage.ich.rolle === "inhaber";
  const warten = lage.auftraege.filter((a) => a.status === "eingereicht");
  const ueberweisen = lage.auftraege.filter((a) => a.status === "freigegeben");
  const entwuerfe = lage.auftraege.filter((a) => a.status === "entwurf" && a.erstelltVon === lage.ich.email);
  const punkte: { z: string; t: string; x: string; r: Reiter; art: "warn" | "info" | "still" }[] = [];
  if (inhaber && warten.length) punkte.push({ z: "schild", t: `${warten.length} Auftrag${warten.length === 1 ? "" : "e"} warten auf deine Freigabe`, x: geld(warten.reduce((s, a) => s + a.betragCents, 0)), r: "auftraege", art: "warn" });
  if (!inhaber && warten.length) punkte.push({ z: "uhr", t: `${warten.length} eingereicht — Freigabe durch den Inhaber steht aus`, x: geld(warten.reduce((s, a) => s + a.betragCents, 0)), r: "auftraege", art: "info" });
  if (ueberweisen.length) punkte.push({ z: "senden", t: inhaber ? `${ueberweisen.length} freigegeben — überweisen und Bankreferenz eintragen` : `${ueberweisen.length} freigegeben — Überweisung durch den Inhaber`, x: geld(ueberweisen.reduce((s, a) => s + a.betragCents, 0)), r: "auftraege", art: inhaber ? "warn" : "info" });
  if (entwuerfe.length) punkte.push({ z: "dokument", t: `${entwuerfe.length} eigene Entwürfe noch nicht eingereicht`, x: "", r: "auftraege", art: "still" });
  if (lage.auszahlungOffen.ohneAuftrag) punkte.push({ z: "team", t: `${lage.auszahlungOffen.ohneAuftrag} Mitarbeiter-Auszahlungen angefordert, noch nicht angewiesen`, x: geld(lage.auszahlungOffen.cents), r: "auszahlungen", art: "warn" });
  if (lage.offen.offenAnzahl) punkte.push({ z: "rein", t: `${lage.offen.offenAnzahl} Eingänge ohne Zuordnung`, x: geld(lage.offen.offenCents), r: "umsaetze", art: "info" });
  if (inhaber && !lage.kasse.anfang) punkte.push({ z: "waage", t: "Anfangsbestand fehlt — ohne ihn kein Saldo", x: "", r: "kontostand", art: "warn" });
  const naechster = lage.dauerauftraege.filter((d) => !d.beendetAm).sort((a, b) => a.naechsteAm.localeCompare(b.naechsteAm))[0];
  if (naechster) punkte.push({ z: "wiederholen", t: `Nächster Dauerauftrag am ${tag(naechster.naechsteAm)}: ${naechster.empfaenger}`, x: geld(naechster.betragCents), r: "dauer", art: "still" });

  if (!punkte.length) return <div className="bk-alles-gut"><Zeichen n="haken" g={18} /> Nichts offen. Alles gebucht, nichts wartet.</div>;
  return (
    <ul className="bk-zutun">
      {punkte.map((p, i) => (
        <li key={i}>
          <button type="button" onClick={() => onGehe(p.r)} className={`bk-zutun-${p.art}`}>
            <span className="bk-zutun-z"><Zeichen n={p.z} g={16} /></span>
            <span className="bk-zutun-t">{p.t}</span>
            {p.x ? <span className="bk-zutun-x">{p.x}</span> : null}
            <Zeichen n="rechts" g={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Die Seite ───────────────────────────────────────────────────────────────
export default function Uebersicht({ lage, onGehe, onNeu }: { lage: Lage; onGehe: (r: Reiter) => void; onNeu: () => void }) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const monat = heute().slice(0, 7);
  const diesen = lage.fluss.filter((f) => f.monat === monat);
  const einMonat = diesen.reduce((s, f) => s + f.einCents, 0);
  const ausMonat = diesen.reduce((s, f) => s + f.ausCents, 0);
  const wartend = lage.auftraege.filter((a) => a.status === "eingereicht");
  const wise = lage.konten.find((k) => k.schluessel === "wise");
  const wiseSumme = lage.fluss.filter((f) => f.konto === "wise").reduce((s, f) => s + f.einCents, 0);

  return (
    <div className="bk-seite bk-start">
      {lage.uebergabe && !lage.uebergabe.bestaetigtVon && lage.ich.rolle === "buchhaltung" ? (
        <div className="bk-band">
          <Zeichen n="dokument" g={18} />
          <div>
            <strong>Übergabe der Buchhaltung zum {tag(lage.uebergabe.stichtag)}</strong>
            <span>Bisher geführt von {lage.uebergabe.bisher}. Bitte den Vermerk lesen und die Übernahme bestätigen.</span>
          </div>
          <Knopf art="primaer" klein onClick={() => onGehe("auszuege")}>Zum Vermerk</Knopf>
        </div>
      ) : null}

      <div className="bk-start-oben">
        <Kontoplatte lage={lage} onGehe={onGehe} />
        <div className="bk-start-seite">
          <div className="bk-kacheln">
            <div className="bk-kachel"><span>Eingänge {monatName(monat).split(" ")[0]}</span><strong className="bk-plus">{geld(einMonat)}</strong></div>
            <div className="bk-kachel"><span>Ausgänge {monatName(monat).split(" ")[0]}</span><strong>{geld(ausMonat)}</strong></div>
            <button type="button" className="bk-kachel bk-kachel-knopf" onClick={() => onGehe("auftraege")}>
              <span>Wartet auf Freigabe</span><strong>{wartend.length}</strong><em>{wartend.length ? geld(wartend.reduce((s, a) => s + a.betragCents, 0)) : "nichts offen"}</em>
            </button>
            <button type="button" className="bk-kachel bk-kachel-knopf" onClick={() => onGehe("umsaetze")}>
              <span>Nicht zugeordnet</span><strong>{lage.offen.offenAnzahl}</strong><em>{geld(lage.offen.offenCents)}</em>
            </button>
          </div>
          {wise ? (
            <div className="bk-altkonto">
              <div>
                <span className="bk-altkonto-name">{wise.name}</span>
                <span className="bk-mono bk-leise">{wise.ibanDisplay}</span>
              </div>
              <div className="bk-altkonto-r">
                <Chip art="still" zeichen="schloss">Gesperrt seit {tag(wise.gesperrtSeit)}</Chip>
                <span className="bk-leise">Eingänge gesamt {geld(wiseSumme)}</span>
              </div>
            </div>
          ) : null}
          <div className="bk-schnell">
            <Knopf art="primaer" zeichen="senden" onClick={() => onGehe("ueberweisung")}>Neue Überweisung</Knopf>
            <Knopf zeichen="team" onClick={() => onGehe("auszahlungen")}>Auszahlungen</Knopf>
            <Knopf zeichen="dokument" onClick={() => onGehe("auszuege")}>Auszüge</Knopf>
          </div>
        </div>
      </div>

      <div className="bk-start-unten">
        <section className="bk-karte">
          <header className="bk-karte-kopf">
            <h2>Letzte Umsätze</h2>
            <button type="button" className="bk-link-knopf" onClick={() => onGehe("umsaetze")}>Alle Umsätze</button>
          </header>
          <UmsatzListe zeilen={lage.letzte as Umsatz[]} onWahl={(u) => setGewaehlt(u.uid)} kontoZeigen />
        </section>
        <div className="bk-start-rechts">
          <section className="bk-karte">
            <header className="bk-karte-kopf"><h2>Zu erledigen</h2><button type="button" className="bk-link-knopf" onClick={onNeu}>Aktualisieren</button></header>
            <ZuTun lage={lage} onGehe={onGehe} />
          </section>
          <section className="bk-karte">
            <header className="bk-karte-kopf"><h2>Geldfluss je Monat</h2><span className="bk-leise">beide Konten</span></header>
            <Geldfluss fluss={lage.fluss} />
          </section>
        </div>
      </div>
      <UmsatzDetail uid={gewaehlt} onZu={() => setGewaehlt(null)} />
    </div>
  );
}
