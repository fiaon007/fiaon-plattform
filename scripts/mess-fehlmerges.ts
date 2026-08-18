// ═══════════════════════════════════════════════════════════════════════════
// HABEN PLATZHALTER-WERTE FREMDE MENSCHEN VERSCHMOLZEN?
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Beim Öffnen/Anrufen verschiedener Kunden erscheinen dieselben Stammdaten
// (Adresse, E-Mail, Paket)."
//
// ── DER VERDACHT ───────────────────────────────────────────────────────────
// Die Massen-Zusammenführung (`server/lib/fiaon-massen-merge.ts`) verlangt
// ZWEI übereinstimmende Merkmale. Das ist gut gemeint und hat eine Lücke:
// Ein Merkmal, das im Bestand HUNDERTMAL vorkommt, ist kein Merkmal, sondern
// ein Platzhalter — eine Sammelnummer, „info@…", eine Attrappen-Adresse. Und
// `vornamenVereinbar` gibt bei einer LEEREN Seite ausdrücklich `true` zurück
// („kein Widerspruch"). Ein Satz ohne Vornamen plus eine Platzhalter-Adresse
// erfüllt damit Kriterium D — und zwei Fremde werden ein Mensch.
//
// Dieser Lauf MISST das, statt es zu behaupten. NUR LESEND: kein UPDATE,
// kein INSERT, keine Transaktion nötig.
//
//   npx tsx scripts/mess-fehlmerges.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { istAttrappenNummer, nameSchluessel, abstand } from "../server/lib/fiaon-dubletten-kandidaten";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tag = (v: unknown): string =>
  v ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })
    .format(new Date(String(v))) : "";

/** Ein Wert, der im Bestand mehrfach vorkommt, beweist nichts über einen Menschen. */
const MEHRFACH_GRENZE = 3;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. ALLE ZUSAMMENFÜHRUNGEN — wann, wer, durch wen");
  // ═════════════════════════════════════════════════════════════════════════
  // `meta` ist eine TEXT-Spalte, kein jsonb — postgres.js liefert also eine
  // Zeichenkette. Ein erster Entwurf las `m.meta.verliererId` direkt und
  // bekam überall `undefined`; die Messung meldete daraufhin 0 Merges und sah
  // wie ein sauberer Bestand aus. Deshalb wird hier ausdrücklich geparst und
  // ein Fehlschlag GEZÄHLT, nicht verschluckt.
  const rohMerges = (await sqlPool`
    SELECT id, created_at, actor, reason, meta
    FROM fiaon_agent_events
    WHERE type = 'person_merge'
    ORDER BY created_at ASC
  `) as any[];
  let unlesbar = 0;
  const merges = rohMerges.map((m) => {
    let meta: any = m.meta;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch { meta = null; unlesbar++; }
    }
    return { ...m, meta: meta ?? {} };
  });
  log(`  ${String(merges.length).padStart(6)}  protokollierte Zusammenführungen (fiaon_agent_events)`);
  if (unlesbar > 0) log(`  ${String(unlesbar).padStart(6)}  davon mit unlesbarem meta-Feld`);

  const [wegweiser] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE merged_into_person_id IS NOT NULL
  `) as any[];
  log(`  ${String(wegweiser.n).padStart(6)}  Personensätze zeigen per merged_into_person_id auf einen Gewinner`);
  if (Number(wegweiser.n) !== merges.length) {
    log(`          ⚠  Die Zahlen weichen ab — es gibt Merges ohne Protokoll oder umgekehrt.`);
  }

  const jeAkteur = new Map<string, { n: number; von: string; bis: string }>();
  for (const m of merges) {
    const k = String(m.actor ?? "—");
    const e = jeAkteur.get(k) ?? { n: 0, von: String(m.created_at), bis: String(m.created_at) };
    e.n++; e.bis = String(m.created_at);
    jeAkteur.set(k, e);
  }
  log("");
  log("  Nach Akteur:");
  for (const [name, e] of Array.from(jeAkteur.entries()).sort((a, b) => b[1].n - a[1].n)) {
    log(`   ${String(e.n).padStart(5)}  ${name.slice(0, 52).padEnd(54)} ${tag(e.von)} – ${tag(e.bis)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. HÄUFIGKEITS-ANALYSE — welche Werte sind gar keine Merkmale?");
  // ═════════════════════════════════════════════════════════════════════════
  // ── ÜBERLEBENDEN-IRRTUM, EINMAL FAST HINEINGELAUFEN ──────────────────────
  // Der erste Entwurf zählte nur LEBENDE Personen (merged_into_person_id IS
  // NULL) und meldete: kein einziger Wert kommt öfter als zweimal vor. Das las
  // sich wie ein sauberer Bestand und war das Gegenteil eines Befundes — wenn
  // ein Platzhalter fünf Menschen verschmolzen hat, steht er danach an EINER
  // lebenden Person. Die Zusammenführung LÖSCHT die Häufigkeit, die sie
  // verursacht hat.
  //
  // Gezählt wird deshalb über ALLE Personensätze, auch die Wegweiser. Das ist
  // der Stand, den die Merge-Maschine gesehen hat, und nur dieser Stand
  // beantwortet die Frage „hat ein Platzhalter das getragen?".
  const zaehlung = async (art: "email" | "phone", nurLebende: boolean) => {
    const wo = nurLebende ? sqlPool`AND p.merged_into_person_id IS NULL` : sqlPool``;
    const woA = nurLebende ? sqlPool`AND p2.merged_into_person_id IS NULL` : sqlPool``;
    if (art === "email") {
      return (await sqlPool`
        WITH werte AS (
          SELECT p.id AS person_id, lower(btrim(p.primary_email)) AS wert
          FROM fiaon_persons p
          WHERE COALESCE(p.primary_email, '') <> '' ${wo}
          UNION
          SELECT a.person_id, lower(btrim(a.value_norm))
          FROM fiaon_person_aliases a
          JOIN fiaon_persons p2 ON p2.id = a.person_id
          WHERE a.kind = 'email' AND COALESCE(a.value_norm, '') <> '' ${woA}
          UNION
          SELECT ap.person_id, lower(btrim(ap.email))
          FROM fiaon_applications ap
          JOIN fiaon_persons p2 ON p2.id = ap.person_id
          WHERE COALESCE(ap.email, '') <> '' ${woA}
        )
        SELECT wert, COUNT(DISTINCT person_id)::int AS personen
        FROM werte
        WHERE wert LIKE '%@%' AND length(wert) > 4
        GROUP BY wert
        HAVING COUNT(DISTINCT person_id) > ${MEHRFACH_GRENZE}
        ORDER BY personen DESC
      `) as any[];
    }
    return (await sqlPool`
      WITH werte AS (
        SELECT p.id AS person_id, right(regexp_replace(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) AS wert
        FROM fiaon_persons p
        WHERE COALESCE(p.primary_phone, '') <> '' ${wo}
        UNION
        SELECT p.id, right(regexp_replace(COALESCE(p.phone_key9, ''), '\\D', '', 'g'), 9)
        FROM fiaon_persons p
        WHERE COALESCE(p.phone_key9, '') <> '' ${wo}
        UNION
        SELECT a.person_id, right(regexp_replace(COALESCE(a.value_norm, ''), '\\D', '', 'g'), 9)
        FROM fiaon_person_aliases a
        JOIN fiaon_persons p2 ON p2.id = a.person_id
        WHERE a.kind = 'phone' AND COALESCE(a.value_norm, '') <> '' ${woA}
        UNION
        SELECT ap.person_id, right(regexp_replace(
                 COALESCE(ap.phone_country_code, '') || COALESCE(ap.phone, ''), '\\D', '', 'g'), 9)
        FROM fiaon_applications ap
        JOIN fiaon_persons p2 ON p2.id = ap.person_id
        WHERE TRUE ${woA}
        UNION
        SELECT ap.person_id, right(regexp_replace(COALESCE(ap.contact_phone, ''), '\\D', '', 'g'), 9)
        FROM fiaon_applications ap
        JOIN fiaon_persons p2 ON p2.id = ap.person_id
        WHERE COALESCE(ap.contact_phone, '') <> '' ${woA}
      )
      SELECT wert, COUNT(DISTINCT person_id)::int AS personen
      FROM werte
      WHERE length(wert) >= 7
      GROUP BY wert
      HAVING COUNT(DISTINCT person_id) > ${MEHRFACH_GRENZE}
      ORDER BY personen DESC
    `) as any[];
  };

  const mailLebend = await zaehlung("email", true);
  const telLebend = await zaehlung("phone", true);
  const mailZaehlung = await zaehlung("email", false);
  const telZaehlung = await zaehlung("phone", false);

  const mehrfachMails = new Map<string, number>(mailZaehlung.map((r) => [String(r.wert), Number(r.personen)]));
  const mehrfachTel = new Map<string, number>(
    telZaehlung.filter((r) => !istAttrappenNummer(String(r.wert))).map((r) => [String(r.wert), Number(r.personen)]),
  );
  const attrappen = telZaehlung.filter((r) => istAttrappenNummer(String(r.wert)));

  log(`  Nur LEBENDE Personen (der Stand von heute):`);
  log(`   ${String(mailLebend.length).padStart(5)}  E-Mail-Werte bei mehr als ${MEHRFACH_GRENZE} Personen`);
  log(`   ${String(telLebend.length).padStart(5)}  Rufnummern bei mehr als ${MEHRFACH_GRENZE} Personen`);
  log("");
  log(`  ALLE Personensätze einschließlich der Wegweiser (der Stand, den die`);
  log(`  Merge-Maschine gesehen hat):`);
  log(`   ${String(mailZaehlung.length).padStart(5)}  E-Mail-Werte bei mehr als ${MEHRFACH_GRENZE} Personen`);
  log(`   ${String(mehrfachTel.size).padStart(5)}  Rufnummern bei mehr als ${MEHRFACH_GRENZE} Personen`);
  log(`   ${String(attrappen.length).padStart(5)}  davon erkennt istAttrappenNummer schon heute als Attrappe`);
  log("");
  log("  Die 15 häufigsten E-Mail-Werte:");
  for (const r of mailZaehlung.slice(0, 15)) {
    log(`   ${String(r.personen).padStart(5)} Personen  ${String(r.wert).slice(0, 56)}`);
  }
  log("");
  log("  Die 15 häufigsten Rufnummern (ohne bekannte Attrappen):");
  for (const r of telZaehlung.filter((x) => !istAttrappenNummer(String(x.wert))).slice(0, 15)) {
    log(`   ${String(r.personen).padStart(5)} Personen  …${String(r.wert)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. JEDER MERGE, NACHGERECHNET — welcher Wert hat ihn getragen?");
  // ═════════════════════════════════════════════════════════════════════════
  // Das Protokoll nennt das Kriterium nicht (die Merge-Maschine kennt es nicht,
  // sie führt aus). Nachgerechnet wird deshalb am HEUTIGEN Stand: Welche Werte
  // teilen Verlierer und Gewinner, und widerspricht ein hartes Zweitmerkmal?
  const ids = new Set<number>();
  for (const m of merges) {
    const meta = m.meta ?? {};
    if (Number.isFinite(Number(meta.verliererId))) ids.add(Number(meta.verliererId));
    if (Number.isFinite(Number(meta.gewinnerId))) ids.add(Number(meta.gewinnerId));
  }
  const idListe = Array.from(ids);
  log(`  ${String(idListe.length).padStart(6)}  beteiligte Personensätze aus dem Protokoll`);

  const saetze = (await sqlPool`
    SELECT p.id, p.person_ref, p.first_name, p.last_name, p.company_name,
           p.primary_email, p.primary_phone, p.phone_key9, p.birthdate,
           p.street, p.zip, p.city, p.merged_into_person_id, p.assigned_agent_id
    FROM fiaon_persons p WHERE p.id = ANY(${idListe}::int[])
  `) as any[];
  const nach = new Map<number, any>(saetze.map((r) => [Number(r.id), r]));

  // Alle je genutzten Werte je Person — inklusive der ALIASE, denn genau dort
  // liegt seit dem Merge der Wert des Verlierers. Ohne sie wäre das Merkmal,
  // über das zusammengeführt wurde, nach dem Merge unsichtbar.
  const aliase = (await sqlPool`
    SELECT person_id, quelle_person_id, kind, value_norm
    FROM fiaon_person_aliases
    WHERE (person_id = ANY(${idListe}::int[]) OR quelle_person_id = ANY(${idListe}::int[]))
      AND kind IN ('email', 'phone')
  `) as any[];
  const werteJePerson = new Map<number, { mails: Set<string>; tel: Set<string> }>();
  const holen = (id: number) => {
    let e = werteJePerson.get(id);
    if (!e) { e = { mails: new Set(), tel: new Set() }; werteJePerson.set(id, e); }
    return e;
  };
  for (const r of saetze) {
    const e = holen(Number(r.id));
    if (r.primary_email) e.mails.add(String(r.primary_email).trim().toLowerCase());
    for (const t of [r.primary_phone, r.phone_key9]) {
      if (t) e.tel.add(String(t).replace(/\D/g, "").slice(-9));
    }
  }
  for (const a of aliase) {
    const v = String(a.value_norm ?? "").trim().toLowerCase();
    if (!v) continue;
    // Ein Alias zählt für BEIDE: für den, der ihn jetzt hält, und für den, von
    // dem er stammt. Sonst wäre nach dem Merge nicht mehr erkennbar, dass der
    // Verlierer diesen Wert mitgebracht hat.
    for (const id of [Number(a.person_id), Number(a.quelle_person_id)]) {
      if (!Number.isFinite(id) || !ids.has(id)) continue;
      const e = holen(id);
      if (a.kind === "email") e.mails.add(v);
      else e.tel.add(v.replace(/\D/g, "").slice(-9));
    }
  }
  const ausBestellungen = (await sqlPool`
    SELECT person_id, lower(btrim(email)) AS mail,
           right(regexp_replace(COALESCE(phone_country_code, '') || COALESCE(phone, ''), '\\D', '', 'g'), 9) AS tel
    FROM fiaon_applications WHERE person_id = ANY(${idListe}::int[])
  `) as any[];
  for (const b of ausBestellungen) {
    const e = holen(Number(b.person_id));
    if (b.mail && String(b.mail).includes("@")) e.mails.add(String(b.mail));
    if (b.tel && String(b.tel).length >= 7) e.tel.add(String(b.tel));
  }

  const dat = (v: unknown) => (v ? String(v).slice(0, 10) : "");
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  interface Befund {
    mergeAm: string; akteur: string;
    verliererId: number; gewinnerId: number;
    verlierer: string; gewinner: string;
    geteilteMails: string[]; geteilteTel: string[];
    platzhalter: string[];      // geteilte Werte, die im Bestand mehrfach vorkommen
    widersprueche: string[];    // harte Zweitmerkmale, die sich widersprechen
    eindeutigeMerkmale: number; // geteilte Werte, die NICHT mehrfach vorkommen
  }
  const befunde: Befund[] = [];

  for (const m of merges) {
    const meta = m.meta ?? {};
    const vId = Number(meta.verliererId);
    const gId = Number(meta.gewinnerId);
    const v = nach.get(vId);
    const g = nach.get(gId);
    if (!v || !g) continue;

    const wv = werteJePerson.get(vId) ?? { mails: new Set<string>(), tel: new Set<string>() };
    const wg = werteJePerson.get(gId) ?? { mails: new Set<string>(), tel: new Set<string>() };
    const geteilteMails = Array.from(wv.mails).filter((x) => wg.mails.has(x));
    const geteilteTel = Array.from(wv.tel).filter((x) => wg.tel.has(x) && x.length >= 7);

    const platzhalter: string[] = [];
    let eindeutig = 0;
    for (const mail of geteilteMails) {
      const n = mehrfachMails.get(mail);
      if (n) platzhalter.push(`E-Mail ${mail} (${n} Personen)`);
      else eindeutig++;
    }
    for (const t of geteilteTel) {
      if (istAttrappenNummer(t)) { platzhalter.push(`Attrappen-Nummer …${t}`); continue; }
      const n = mehrfachTel.get(t);
      if (n) platzhalter.push(`Rufnummer …${t} (${n} Personen)`);
      else eindeutig++;
    }

    // ── Harte Zweitmerkmale ────────────────────────────────────────────────
    // „Hart" heißt: beide Seiten haben einen Wert, und die Werte widersprechen
    // sich. Eine LÜCKE ist kein Widerspruch — das war schon die Regel der
    // Merge-Maschine und bleibt sie.
    const widersprueche: string[] = [];
    if (dat(v.birthdate) && dat(g.birthdate) && dat(v.birthdate) !== dat(g.birthdate)) {
      widersprueche.push(`Geburtsdatum ${dat(v.birthdate)} ≠ ${dat(g.birthdate)}`);
    }
    const nv = nameSchluessel(v.last_name);
    const ng = nameSchluessel(g.last_name);
    if (nv && ng && nv !== ng && abstand(nv, ng, 2) > 2) {
      widersprueche.push(`Nachname ${v.last_name} ≠ ${g.last_name}`);
    }
    const strv = norm(v.street); const strg = norm(g.street);
    const plzv = norm(v.zip); const plzg = norm(g.zip);
    if (strv && strg && strv !== strg && plzv && plzg && plzv !== plzg) {
      widersprueche.push(`Adresse ${v.street}, ${v.zip} ≠ ${g.street}, ${g.zip}`);
    }

    befunde.push({
      mergeAm: tag(m.created_at), akteur: String(m.actor ?? "—"),
      verliererId: vId, gewinnerId: gId,
      verlierer: [v.first_name, v.last_name].filter(Boolean).join(" ") || v.company_name || v.person_ref,
      gewinner: [g.first_name, g.last_name].filter(Boolean).join(" ") || g.company_name || g.person_ref,
      geteilteMails, geteilteTel, platzhalter, widersprueche,
      eindeutigeMerkmale: eindeutig,
    });
  }

  const ueberPlatzhalter = befunde.filter((b) => b.platzhalter.length > 0);
  const nurPlatzhalter = befunde.filter((b) => b.platzhalter.length > 0 && b.eindeutigeMerkmale === 0);
  const mitWiderspruch = befunde.filter((b) => b.widersprueche.length > 0);
  const verdaechtig = befunde.filter((b) => b.widersprueche.length > 0
    || (b.platzhalter.length > 0 && b.eindeutigeMerkmale === 0));
  const ohneMerkmal = befunde.filter((b) => b.geteilteMails.length === 0 && b.geteilteTel.length === 0);

  log("");
  log(`  ${String(befunde.length).padStart(6)}  nachgerechnete Merges (beide Sätze noch vorhanden)`);
  log(`  ${String(ueberPlatzhalter.length).padStart(6)}  teilen mindestens einen MEHRFACH belegten Wert`);
  log(`  ${String(nurPlatzhalter.length).padStart(6)}  teilen AUSSCHLIESSLICH mehrfach belegte Werte  ← kein Beweis`);
  log(`  ${String(mitWiderspruch.length).padStart(6)}  haben ein WIDERSPRECHENDES hartes Zweitmerkmal  ← Fehl-Merge`);
  log(`  ${String(verdaechtig.length).padStart(6)}  VERDÄCHTIG insgesamt (Widerspruch oder nur Platzhalter)`);
  log(`  ${String(ohneMerkmal.length).padStart(6)}  teilen heute gar keinen Kontaktwert (über Name+Geburtsdatum, Kriterium E)`);

  if (mitWiderspruch.length > 0) {
    log("");
    log("  Die Merges mit widersprechendem Zweitmerkmal:");
    for (const b of mitWiderspruch.slice(0, 25)) {
      log(`   ${b.mergeAm}  Person ${String(b.verliererId).padStart(5)} „${b.verlierer.slice(0, 22)}" `
        + `→ ${String(b.gewinnerId).padStart(5)} „${b.gewinner.slice(0, 22)}"`);
      for (const w of b.widersprueche) log(`              ! ${w}`);
      for (const p of b.platzhalter) log(`              · getragen von: ${p}`);
    }
    if (mitWiderspruch.length > 25) log(`   … und ${mitWiderspruch.length - 25} weitere (siehe CSV)`);
  }

  const kopf = ["merge_am", "akteur", "verlierer_id", "verlierer_name", "gewinner_id", "gewinner_name",
    "geteilte_mails", "geteilte_nummern", "platzhalter_merkmale", "eindeutige_merkmale",
    "widersprueche", "urteil"];
  const zeilen = befunde.map((b) => [
    b.mergeAm, b.akteur, b.verliererId, b.verlierer, b.gewinnerId, b.gewinner,
    b.geteilteMails.join(" "), b.geteilteTel.join(" "), b.platzhalter.join(" | "),
    b.eindeutigeMerkmale, b.widersprueche.join(" | "),
    b.widersprueche.length > 0
      ? "TRENNEN — hartes Zweitmerkmal widerspricht"
      : b.platzhalter.length > 0 && b.eindeutigeMerkmale === 0
        ? "PRÜFEN — nur über Platzhalter verbunden"
        : "unauffällig",
  ].map(feld).join(";"));
  writeFileSync("reports/fehlmerges-audit.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. WÜRDE DIE HEUTIGE REGEL ES WIEDER TUN? — Platzhalter-Paare offen");
  // ═════════════════════════════════════════════════════════════════════════
  // Nicht nur die Vergangenheit zählt. Wenn heute noch Personenpaare über einen
  // Platzhalter zusammenführbar wären, wiederholt sich der Schaden beim nächsten
  // Lauf. Diese Zahl ist die Begründung für die Regelverschärfung.
  const offenePaare = (await sqlPool`
    WITH werte AS (
      SELECT p.id AS person_id, 'email' AS art, lower(btrim(p.primary_email)) AS wert
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND COALESCE(p.primary_email, '') LIKE '%@%'
      UNION
      SELECT p.id, 'phone', right(regexp_replace(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9)
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND COALESCE(p.primary_phone, '') <> ''
    ), haeufig AS (
      SELECT art, wert FROM werte
      WHERE length(wert) >= 7
      GROUP BY art, wert HAVING COUNT(DISTINCT person_id) > ${MEHRFACH_GRENZE}
    )
    SELECT h.art, h.wert, COUNT(DISTINCT w.person_id)::int AS personen,
           COUNT(DISTINCT w.person_id) FILTER (
             WHERE NOT EXISTS (SELECT 1 FROM fiaon_persons q
                               WHERE q.id = w.person_id AND COALESCE(q.first_name, '') <> '')
           )::int AS ohne_vornamen
    FROM haeufig h JOIN werte w ON w.art = h.art AND w.wert = h.wert
    GROUP BY h.art, h.wert
    ORDER BY personen DESC
  `) as any[];
  const gefaehrlich = offenePaare.filter((r) => Number(r.ohne_vornamen) > 0
    && !(r.art === "phone" && istAttrappenNummer(String(r.wert))));
  log(`  ${String(offenePaare.length).padStart(6)}  mehrfach belegte Werte im lebenden Bestand`);
  log(`  ${String(gefaehrlich.length).padStart(6)}  davon mit mindestens einem Satz OHNE Vornamen`);
  log(`          → dort greift „vornamenVereinbar gibt bei leerer Seite true zurück"`);
  for (const r of gefaehrlich.slice(0, 12)) {
    log(`   ${String(r.personen).padStart(4)} Personen (${r.ohne_vornamen} ohne Vornamen)  `
      + `${r.art === "email" ? String(r.wert).slice(0, 44) : `…${r.wert}`}`);
  }

  log("");
  log(`  Vorschau-CSV: reports/fehlmerges-audit.csv`);
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
