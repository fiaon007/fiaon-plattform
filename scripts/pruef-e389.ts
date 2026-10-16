// Prüfstand E-389 (16.10.2026): die Filter der Betreuung auch in Chefbüro › Alle Kunden.
// Offline: gemeinsame Filterliste (shared/fiaon-kundenfilter.ts), dieselben Titel wie die Kunden-Zentrale,
// dieselben SQL-Bedingungen (filterBedingungen), Anschluss in Route, Liste und „Nächster Kunde“. Aufruf:
//   env -i HOME=$HOME PATH=$PATH DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e389.ts
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

async function main() {
  const F = await import("../shared/fiaon-kundenfilter");
  const Z = await import("../server/lib/fiaon-kundenzentrale");
  const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

  console.log("── 1 · Adresse lesen und schreiben");
  const a = F.kundenZusatzAus(new URLSearchParams("stufe=B,A,B,X&agent=10&kycOffen=1&ruhend=true&tests=1&unsinn=1"));
  ok(JSON.stringify(a.stufe) === JSON.stringify(["B", "A"]), "Stufen: nur A/B/C/bezahlt, ohne Doppel", JSON.stringify(a.stufe));
  ok(a.agent === 10, "Zuständiger als Zahl");
  ok(a.spezial.kycOffen === true && a.spezial.ruhend === true && Object.keys(a.spezial).length === 2, "nur bekannte Schalter (tests/unsinn fallen weg)", JSON.stringify(a.spezial));
  const b = F.kundenZusatzAus({ agent: "abc", stufe: "", kycOffen: "0" });
  ok(b.agent === null && b.stufe === undefined && Object.keys(b.spezial).length === 0, "Unsinn ergibt keinen Filter (auch aus req.query)");
  ok(F.kundenZusatzAlsSuche(a) === "stufe=B%2CA&agent=10&kycOffen=1&ruhend=1", "zurück in die Adresse", F.kundenZusatzAlsSuche(a));
  ok(JSON.stringify(F.kundenZusatzAus(new URLSearchParams(F.kundenZusatzAlsSuche(a)))) === JSON.stringify(a), "hin und zurück gleich");
  ok(F.kundenZusatzAlsSuche({ spezial: {} }) === "" && F.kundenZusatzAnzahl(a) === 4, "leer bleibt leer, Anzahl zählt Gruppen");

  console.log("── 2 · Wortgleich mit der Kunden-Zentrale (Betreuung)");
  const zentrale = lies("client/src/pages/admin-kunden.tsx");
  for (const st of F.KUNDEN_STUFEN) ok(zentrale.includes(`{ wert: "${st.wert}", titel: "${st.titel}", schluessel: "${st.zahl}" }`), `Stufe ${st.wert}: „${st.titel}“ und Zähler ${st.zahl} wie in der Betreuung`);
  for (const k of F.KUNDEN_SPEZIAL_SCHLUESSEL) ok(zentrale.includes(`${k}: "${F.KUNDEN_SPEZIAL_TITEL[k]}",`), `Schalter ${k}: „${F.KUNDEN_SPEZIAL_TITEL[k]}“ wie in der Betreuung`);
  const zaehler = lies("server/lib/fiaon-kundenzentrale.ts");
  for (const o of F.KUNDEN_SPEZIAL_GRUPPEN.flatMap((g) => g.optionen)) if (o.zahl) ok(zaehler.includes(`AS ${o.zahl}`), `Zähler ${o.zahl} heißt in der Betreuung genauso`);

  console.log("── 3 · Eine Regel: filterBedingungen");
  const werte: unknown[] = [];
  const par = (v: unknown) => { werte.push(v); return `$${werte.length}`; };
  const teile = Z.filterBedingungen({ stufe: ["A", "bezahlt"], agent: 10, kycOffen: true, ohneTelefon: true }, par);
  ok(teile.length === 4 && teile[0] === "p.priority_tier = ANY($1::int[])" && JSON.stringify(werte[0]) === "[1,0]", "Stufe A + bezahlt → priority_tier 1 und 0 als Parameter", teile[0]);
  ok(teile[1] === "p.assigned_agent_id = $2" && werte[1] === 10, "Zuständiger als Parameter, nie im Text");
  ok(Z.filterBedingungen({}, par).length === 0, "ohne Filter keine Bedingung");
  for (const o of F.KUNDEN_SPEZIAL_GRUPPEN.flatMap((g) => g.optionen)) {
    ok(Z.filterBedingungen({ [o.schluessel]: true } as never, par).length === 1, `Schalter ${o.schluessel} ergibt genau eine Bedingung`);
  }
  ok(/wo\.push\(\.\.\.filterBedingungen\(f, par\)\)/.test(zaehler), "Kunden-Zentrale benutzt dieselbe Funktion");

  console.log("── 4 · Angeschlossen: Route, Liste, Akte");
  const route = lies("server/routes/fiaon-chef-uebersichten.ts");
  ok(/teile\.push\(\.\.\.filterBedingungen\(alsZentraleFilter\(zusatz\), par\)\)/.test(route) && /kundenZusatzAus\(req\.query/.test(route), "/chef/kunden liest die Zusatzfilter und nutzt die Regel der Zentrale");
  ok(/zahlen: zahlen \?\? \{\}/.test(route) && /\n\s+agenten,\n/.test(route), "Antwort trägt Zähler und Mitarbeiter");
  ok(/requireChef\("leitung"\)/.test(route.slice(route.indexOf('router.get("/chef/kunden"'), route.indexOf('router.get("/chef/kunden"') + 80)), "Zugang unverändert: ab Leitung");
  const liste = lies("client/src/components/admin/ChefKundenliste.tsx");
  ok(/KUNDEN_STUFEN\.map/.test(liste) && /<FiaonFilter/.test(liste) && /Alle Zuständigen/.test(liste) && /<FiaonFilterChips/.test(liste), "Alle Kunden zeigt Stufen, Zuständigen, Filter-Knopf und Chips");
  ok(/\(zusatzSuche \? `&\$\{zusatzSuche\}` : ""\)/.test(liste) && /extra: zusatzSuche/.test(liste), "Liste schickt die Filter mit und legt sie in der Reihe ab");
  const reihe = lies("client/src/lib/akte-reihe.ts");
  ok(/\(r\.extra \? `&\$\{r\.extra\}` : ""\)/.test(reihe), "„Nächster Kunde“ lädt Folgeseiten mit denselben Filtern");
  ok(!/ChefKundenliste|fiaon-kundenfilter/.test(zentrale), "Betreuungs-Seite selbst unverändert");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
