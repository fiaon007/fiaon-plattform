// Prüfstand für die Admin-Zugangsschleuse: startet einen Mini-Express mit
// genau der Reihenfolge aus server/routes.ts und klopft die Tür ab.
// Aufruf: npx tsx scripts/pruef-admin-zugang.ts
import express from "express";
import cookieParser from "cookie-parser";
import zugang, { adminCodeGate } from "../server/routes/fiaon-admin-zugang";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/fiaon/zugang", zugang);
app.use("/api/fiaon", adminCodeGate);
app.get("/api/fiaon/admin/probe", (_req, res) => res.json({ ok: true, geheim: "Kennzahlen" }));
app.get("/api/fiaon/oeffentlich", (_req, res) => res.json({ ok: true }));

const server = app.listen(0, async () => {
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  let fehler = 0;
  const pruefe = (name: string, ist: unknown, soll: unknown) => {
    const gut = JSON.stringify(ist) === JSON.stringify(soll);
    if (!gut) fehler++;
    console.log(`${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  (ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)})`}`);
  };

  pruefe("Admin-Endpoint ohne Code ⇒ 401", (await fetch(`${base}/api/fiaon/admin/probe`)).status, 401);
  pruefe("Öffentlicher Endpoint bleibt offen", (await fetch(`${base}/api/fiaon/oeffentlich`)).status, 200);
  pruefe("Status ohne Cookie ⇒ gesperrt", (await (await fetch(`${base}/api/fiaon/zugang/status`)).json()).entsperrt, false);

  const falsch = await fetch(`${base}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "12345678" }),
  });
  pruefe("Falscher Code ⇒ 401", falsch.status, 401);
  pruefe("Falscher Code setzt kein Cookie", !!falsch.headers.get("set-cookie"), false);

  const richtig = await fetch(`${base}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "20032017" }),
  });
  pruefe("Richtiger Code ⇒ 200", richtig.status, 200);
  const cookie = (richtig.headers.get("set-cookie") || "").split(";")[0];
  pruefe("Cookie ist httpOnly", /HttpOnly/i.test(richtig.headers.get("set-cookie") || ""), true);

  pruefe("Admin-Endpoint mit Cookie ⇒ 200",
    (await fetch(`${base}/api/fiaon/admin/probe`, { headers: { cookie } })).status, 200);
  pruefe("Status mit Cookie ⇒ offen",
    (await (await fetch(`${base}/api/fiaon/zugang/status`, { headers: { cookie } })).json()).entsperrt, true);
  pruefe("Gefälschtes Cookie ⇒ 401",
    (await fetch(`${base}/api/fiaon/admin/probe`, { headers: { cookie: `fiaon_admin=${Date.now() + 9e8}.aaaaaaaa` } })).status, 401);

  // Bremse: nach 5 Fehlversuchen (einer ist oben schon verbraucht) kommt 429.
  let sah429 = false;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${base}/api/fiaon/zugang/oeffnen`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "00000000" }),
    });
    if (r.status === 429) { sah429 = true; break; }
  }
  pruefe("Bremse nach Fehlversuchen ⇒ 429", sah429, true);

  console.log(fehler === 0 ? "\nAlles grün." : `\n${fehler} Prüfung(en) rot.`);
  server.close();
  process.exit(fehler === 0 ? 0 : 1);
});
