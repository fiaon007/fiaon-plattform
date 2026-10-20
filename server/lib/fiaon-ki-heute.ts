// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE“ IM KI-RAUM + KOSTEN AUS EINER QUELLE (E-409, 19.10.2026)
//
// kiHeute() zieht zusammen, was Mara und Aras heute getan haben — aus den
// bestehenden Quellen (maraTag, Entscheidungen, KI-Pause, WhatsApp-Bremse)
// und aus der Aras-Anbindung (sobald Team 1 sie meldet). Dazu die Kosten je
// Dienst und Tag aus fiaon_ki_nutzung ALLER Dienste + Telefon (Schätzung aus
// fiaon_calls.dauer_sek × TWILIO_MIN_CENTS, dazu fiaon_aras_anruf.kosten_telefon_cents,
// sobald die Tabelle da ist). Vertrag § 12: eine Quelle — hier, bis Team 1
// fiaon-ki-kosten.ts mit derselben Signatur liefert; dann liest diese Datei dort.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { KI_DIENSTE, dienstLabel, dienstWer, TWILIO_MIN_CENTS, type KiHeute, type KostenDienst } from "@shared/fiaon-ki-team";
import { REGISTER } from "@shared/fiaon-ki-schalter";
import { aras, arasVerbunden } from "./fiaon-ki-aras-anbindung";

const berlinTag = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

/** Deckel je Dienst aus dem Register (Vorgabe) bzw. fiaon_settings. */
async function deckelLesen(): Promise<Record<string, number | null>> {
  const schluessel = KI_DIENSTE.map((d) => d.deckelSchluessel).filter((s): s is string => !!s);
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`.catch(() => [])) as any[];
  const werte = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  const aus: Record<string, number | null> = {};
  for (const d of KI_DIENSTE) {
    if (!d.deckelSchluessel) { aus[d.dienst] = null; continue; }
    const e = REGISTER.find((r) => r.schluessel === d.deckelSchluessel);
    let w = werte.get(d.deckelSchluessel);
    if ((w == null || w === "") && d.deckelSchluessel === "postmeister_tag_euro" && process.env.POSTMEISTER_TAG_EURO) w = String(process.env.POSTMEISTER_TAG_EURO);
    const n = Number(w);
    aus[d.dienst] = Number.isFinite(n) && w !== "" && w != null ? n : (e ? Number(e.vorgabe) || null : null);
  }
  return aus;
}

/** Kosten je Dienst an einem Berliner Tag — KI aus fiaon_ki_nutzung, Telefon geschätzt. */
export async function kiKostenJeDienst(tag: string = berlinTag()): Promise<KostenDienst[]> {
  const ki = (await sqlPool`
    SELECT dienst, COALESCE(SUM(kosten_cents), 0)::float AS cents FROM fiaon_ki_nutzung
     WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date GROUP BY dienst`.catch(() => [])) as any[];
  const [tel] = (await sqlPool`
    SELECT COALESCE(SUM(dauer_sek), 0)::float AS sek FROM fiaon_calls
     WHERE (COALESCE(beginn, created_at) AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date`.catch(() => [{ sek: 0 }])) as any[];
  // Aras-Anrufe stehen mit ihren Sekunden ebenfalls in fiaon_calls (eine Anruf-Tabelle, Vertrag § 2) — darum keine
  // zweite Zählung aus fiaon_aras_anruf.kosten_telefon_cents; sobald Team 1 dort Ist-Preise schreibt, wird hier umgestellt.
  const telefonCents = (Number(tel?.sek ?? 0) / 60) * TWILIO_MIN_CENTS;
  const deckel = await deckelLesen();
  const zeilen: KostenDienst[] = ki.map((z) => ({
    dienst: String(z.dienst), label: dienstLabel(String(z.dienst)), wer: dienstWer(String(z.dienst)),
    euro: Math.round(Number(z.cents) || 0) / 100, deckel: deckel[String(z.dienst)] ?? null, anteil: 0,
  }));
  if (telefonCents > 0) zeilen.push({ dienst: "telefon", label: dienstLabel("telefon"), wer: "haus", euro: Math.round(telefonCents) / 100, deckel: null, anteil: 0 });
  const summe = zeilen.reduce((s, z) => s + z.euro, 0);
  for (const z of zeilen) z.anteil = summe ? Math.round((z.euro / summe) * 1000) / 10 : 0;
  return zeilen.sort((a, b) => b.euro - a.euro);
}

/** Verlauf: KI und Telefon je Tag, die letzten N Tage (Berlin). */
export async function kiKostenVerlauf(tage: number): Promise<{ tag: string; ki: number; telefon: number }[]> {
  const n = Math.max(1, Math.min(90, Number(tage) || 14));
  const ki = (await sqlPool`
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date::text AS tag, COALESCE(SUM(kosten_cents), 0)::float AS cents
      FROM fiaon_ki_nutzung WHERE created_at > NOW() - (${n} || ' days')::interval GROUP BY 1`.catch(() => [])) as any[];
  const tel = (await sqlPool`
    SELECT (COALESCE(beginn, created_at) AT TIME ZONE 'Europe/Berlin')::date::text AS tag, COALESCE(SUM(dauer_sek), 0)::float AS sek
      FROM fiaon_calls WHERE COALESCE(beginn, created_at) > NOW() - (${n} || ' days')::interval GROUP BY 1`.catch(() => [])) as any[];
  const aus = new Map<string, { tag: string; ki: number; telefon: number }>();
  for (let i = n - 1; i >= 0; i--) { const t = berlinTag(new Date(Date.now() - i * 86_400_000)); aus.set(t, { tag: t, ki: 0, telefon: 0 }); }
  for (const z of ki) { const e = aus.get(String(z.tag)); if (e) e.ki = Math.round(Number(z.cents) || 0) / 100; }
  for (const z of tel) { const e = aus.get(String(z.tag)); if (e) e.telefon = Math.round((Number(z.sek) / 60) * TWILIO_MIN_CENTS) / 100; }
  return Array.from(aus.values());
}

/** Name in einem Text verdecken („Herr Müller“ → „Herr …“) — für die Leitung (Vertrag § 9, wie auf „Qualität“). Rein. */
export function namenVerdecken(text: string): string {
  return String(text ?? "").replace(/\b(Herr|Frau|Herrn)\s+[A-ZÄÖÜ][\wäöüßÄÖÜ-]+(?:\s+[A-ZÄÖÜ][\wäöüßÄÖÜ-]+)?/g, (_m: string, a: string) => `${a} …`);
}

/** Eine Karte für die Leitung: kein Name, keine Zitate, Namen im Text verdeckt — entscheiden darf sie ohnehin nicht. Rein. */
export function karteFuerLeitung<T extends Record<string, any>>(k: T): T {
  return { ...k, name: null, text: namenVerdecken(String(k.text ?? "")), titel: namenVerdecken(String(k.titel ?? "")), belege: [] };
}

/**
 * Die Heute-Seite. E-409 × E-406 (Funde 1 + 3, 20.10.2026): Maras Zahlen kommen aus DERSELBEN Quelle wie das Lagezimmer
 * (maraHeuteLesen, server/lib/fiaon-mara-heute.ts — Maras eigene Handlungen, nicht „alle Zeilen der Tabelle“), dazu der
 * Not-Aus über alle Wege. `nameZeigen` = Inhaber/Geschäftsführung; die Leitung sieht keine Kundennamen (Fund 11).
 */
export async function kiHeute(opt: { karten?: number; nameZeigen?: boolean; entscheiden?: boolean } = {}): Promise<KiHeute> {
  const tag = berlinTag();
  const zeig = opt.nameZeigen === true;
  const [mh, entsch, pause, wa, kosten, pr, notaus, auf] = await Promise.all([
    import("./fiaon-mara-heute").then((m) => m.maraHeuteLesen()).catch((e) => { console.error("[KI-HEUTE] Mara heute:", String((e as Error)?.message ?? e).slice(0, 160)); return null; }),
    import("./fiaon-mara-entscheidungen").then((m) => m.entscheidungenStand({ warten: 0 })).catch(() => null),
    import("./fiaon-ki-pause").then((m) => m.kiPauseLesen()).catch(() => null),
    import("./fiaon-wa-bremse").then((m) => m.waBremseLage()).catch(() => null),
    kiKostenJeDienst(tag).catch(() => [] as KostenDienst[]),
    import("./fiaon-ki-pruefung").then((m) => m.pruefungStand()).catch(() => ({ heute: 0, auffaellig: 0, offenKarten: 0 })),
    import("./fiaon-ki-einstellungen").then((m) => m.maraNotausStand()).catch(() => null),
    sqlPool`
      SELECT COUNT(*) FILTER (WHERE status IN ('fertig','teilweise'))::int AS gelaufen,
             COUNT(*) FILTER (WHERE status IN ('entwurf','rueckfrage'))::int AS wartend
        FROM fiaon_mara_auftrag
       WHERE erstellt_am >= (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin')`.catch(() => [{ gelaufen: 0, wartend: 0 }]),
  ]);
  const weg = (k: string) => notaus?.wege.find((w) => w.schluessel === k)?.an ?? true;
  const offen = (entsch as any)?.offen ?? [];
  const kartenRoh = Array.isArray(offen) ? offen.slice(0, Math.max(1, Math.min(12, opt.karten ?? 6))) : [];
  const karten = zeig ? kartenRoh : kartenRoh.map((k: any) => karteFuerLeitung(k));
  let arasTeil: KiHeute["aras"] = null;
  const a = aras();
  if (arasVerbunden() && a?.plan) {
    try {
      const e = await a.plan.arasEinstellungenLesen();
      const z = a.nachbereitung?.tagesZahlen ? await a.nachbereitung.tagesZahlen(tag) : { gewaehlt: 0, erreicht: 0, gespraeche: 0, zusagen: 0, euroKi: 0, euroTelefon: 0 };
      arasTeil = {
        verbunden: true, an: String((e as any).an ?? (e as any).aras_an ?? "aus") === "an" || (e as any).an === true,
        notaus: (e as any).notaus === true || String((e as any).aras_notaus ?? "aus") === "an",
        gewaehlt: z.gewaehlt, erreicht: z.erreicht, gespraeche: z.gespraeche, zusagen: z.zusagen,
        euro: Math.round((z.euroKi + z.euroTelefon) * 100) / 100, laufend: a.waehler?.laufendeSitzungen?.().length ?? 0,
      };
    } catch (e) {
      console.error("[KI-HEUTE] Aras:", String((e as Error)?.message ?? e).slice(0, 120));
      arasTeil = { verbunden: true, an: false, notaus: false, gewaehlt: 0, erreicht: 0, gespraeche: 0, zusagen: 0, euro: 0, laufend: 0 };
    }
  }
  const k = mh?.kennzahlen;
  return {
    tag,
    darf: { namen: zeig, entscheiden: opt.entscheiden === true, rueckgaengig: opt.entscheiden === true, notaus: opt.entscheiden === true },
    mara: {
      mails: { geschrieben: k?.mails.geschrieben ?? 0, entwuerfe: k?.mails.entwuerfe ?? 0, reinHeute: k?.mails.rein ?? 0 },
      whatsapps: { raus: k?.whatsapps.raus ?? 0, rein: k?.whatsapps.rein ?? 0, menschen: k?.whatsapps.menschen ?? 0 },
      termine: k?.termine ?? 0,
      auftraege: { gelaufen: Number((auf as any[])[0]?.gelaufen ?? 0), wartend: Number((auf as any[])[0]?.wartend ?? 0) },
      entscheidungen: { offen: Number((entsch as any)?.zaehler?.offen ?? offen.length ?? 0), geldRecht: Number((entsch as any)?.zaehler?.geldRecht ?? 0) },
      an: { aktion: weg("mara_aktion_an"), whatsapp: weg("mara_wa_an"), postfach: weg("postmeister_an") },
      notaus: notaus ?? { aktiv: false, seit: null, von: null, wege: [] },
      erledigt: mh?.erledigt ?? 0,
      zeilen: mh?.zeilen ?? [],
      geld: mh?.geld ?? null,
      aufraeumen: mh?.aufraeumen ?? [],
      haengt: mh?.haengt ?? [],
      gelb: (mh?.gelb ?? []).map((g) => (zeig ? g : { ...g, name: null, text: namenVerdecken(g.text) })),
    },
    aras: arasTeil,
    karten,
    kiBand: pause ? { an: !!(pause as any).an, art: (pause as any).art ?? null, seit: (pause as any).seit ?? null, anbieter: String((pause as any).anbieter ?? "openai") } : null,
    waBremse: wa ? { pause: !!(wa as any).pause?.an, qualitaet: (wa as any).qualitaet ?? null, satz: (wa as any).satz ?? null } : null,
    kosten,
    pruefung: { heute: pr.heute, auffaellig: pr.auffaellig, offenKarten: pr.offenKarten },
  };
}
