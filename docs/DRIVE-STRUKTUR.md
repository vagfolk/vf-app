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

De två dokumentmapparna är skapade men ännu tomma. Dokument läggs manuellt i rätt mapp i Google Drive. Appens dokumentvy får bara öppna och läsa; den skapar, laddar upp, flyttar, redigerar eller raderar inga dokument. Medlemsrollen får länken till `Medlem`, medan styrelsebehöriga får länkar till både `Medlem` och `Styrelse`. Rollen hämtas vid inloggning och inga EKO-anrop görs för varje dokument. Kod för länkarna finns lokalt men är ännu inte publicerad i den skyddade webbappen.

Appens nuvarande Drive-behörighet är `drive.file`, som inte ger dataskriptet generell läsning av manuellt inlagda dokument. Därför öppnas respektive Drive-mapp i en ny flik; Google Drives egen läsbehörighet måste också vara ordnad för de konton som ska öppna den. Approllen styr vad som syns i appen, men den delar inte automatiskt ut Drive-behörighet. Ingen bredare Drive-behörighet har lagts till. Funktion med båda rollerna och faktisk dokumentöppning är ännu inte provad.

Den sedan tidigare avskilda mappen **gammal VF-APP används ej.** och hemsidans egen mapp är inte delar av den aktuella appinstallationen och har inte flyttats.
