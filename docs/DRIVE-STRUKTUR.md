# Drive-struktur för Vägfölk-appen

Den aktiva VF-installationens filer ligger i den privata huvudmappen **VF-app** på föreningens Drive. Mappnamn är till för människor; appen ska använda mapp- och fil-ID från skyddade Script Properties.

```text
VF-app/
├── EKO och ekonomi/
│   ├── VF-EKO 4.4 – appåtkomstprov – ENDAST TESTDATA
│   └── Tidigare EKO-prov/
├── Kontaktkort/
│   └── kontaktkort och foton
├── Appinformation och styrning/
│   ├── VF-APP Information och Chat – ENDAST TESTDATA
│   ├── VF-BRO IDENTITET ENDAST TESTDATA
│   ├── VF-BRO DATA ENDAST TESTDATA
│   └── Tidigare tekniska prov/
└── Dokument/
    ├── Medlem/
    └── Styrelse/
```

De tidigare manuellt skapade dokumentmapparna har tagits bort. Dataskriptet skapade den 19 oktober 2026 nya privata mappar `Dokument/Medlem` och `Dokument/Styrelse`, och `Dokument` har flyttats till huvudmappen `VF-app`. Styrelsen ska välja målgrupp när en lokal fil laddas upp via startsidans knapp `Dokument`. Vänstermenyns dokumentvy är enbart för läsning: medlem ser Medlem, styrelse ser båda. Inga dokument får redigeras eller raderas i dokumentvyn.

Appens nuvarande Drive-behörighet är `drive.file`. Den används för mappar och filer som dataskriptet självt skapar. Dokument ska läsas genom appens serverdel efter rollkontroll, utan direktlänk till Google Drive eller separat delning till varje medlem. Appen ska inte slå upp EKO-rader på nytt för varje dokumentöppning; en tidsbegränsad servercache för redan kontrollerad roll används. Mappskapandet är verifierat i Drive. Uppladdning och öppning med båda rollerna måste provas i den publicerade appen innan funktionen kan kallas färdig. Ingen bredare Drive-behörighet har godkänts.

Den sedan tidigare avskilda mappen **gammal VF-APP används ej.** och hemsidans egen mapp är inte delar av den aktuella appinstallationen och har inte flyttats.
