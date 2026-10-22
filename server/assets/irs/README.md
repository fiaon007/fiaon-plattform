# IRS-Formulare (amtliche, ausfüllbare PDFs)

Unverändert von irs.gov übernommen; FIAON füllt die Formularfelder mit pdf-lib aus der Akte
(`shared/fiaon-global-irs.ts` = welches Feld woher, `server/lib/fiaon-global-irs.ts` = Füllen).
Werke der US-Bundesregierung sind gemeinfrei (17 U.S.C. § 105).

| Datei       | Formular | Revision            | Quelle                                         | Abgerufen   | SHA-256 |
|-------------|----------|---------------------|------------------------------------------------|-------------|---------|
| `fss4.pdf`  | SS-4     | Rev. December 2025  | https://www.irs.gov/pub/irs-pdf/fss4.pdf       | 22.10.2026  | 23d295529950b05979596cf58d559db6c433a4ec852407b1820265c117cb3ca2 |
| `f8821.pdf` | 8821     | Rev. January 2021   | https://www.irs.gov/pub/irs-pdf/f8821.pdf      | 22.10.2026  | 8c9561c2059c30866d8e80e8db85e3847d68e6fa74cebf4062d6dadca372799c |

Neue Revision: Datei ersetzen, Feldnamen prüfen (`scripts/pruef-global-unterschrift.ts` liest jedes
zugeordnete Feld aus der Datei und wird rot, wenn eines fehlt), Tabelle oben anpassen.
Unterschrift und Datum bleiben immer leer — der Kunde unterschreibt von Hand (Registered-Agent-Partner).
