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

De tidigare manuellt skapade dokumentmapparna har tagits bort. Dataskriptet skapade den 19 oktober 2026 nya privata mappar `Dokument/Medlem` och `Dokument/Styrelse`, och `Dokument` har flyttats till huvudmappen `VF-app`. Styrelsen väljer målgrupp när en lokal fil laddas upp via startsidans knapp `Dokument`. Där visar appen förlopp och resultat och kan flytta en felplacerad fil till papperskorgen efter bekräftelse. Vänstermenyns dokumentvy visar endast en fillista: medlem ser Medlem, styrelse ser båda. Valda filer öppnas av webbläsaren eller hämtas enligt enhetens inställningar; appen har ingen egen förhandsvisning. Inga dokument får redigeras eller raderas i dokumentvyn.

Appens nuvarande Drive-behörighet är `drive.file`. Den används för mappar och filer som dataskriptet självt skapar. Dokument ska levereras genom appens serverdel efter rollkontroll, utan direktlänk till Google Drive eller separat delning till varje medlem. Appen ska inte slå upp EKO-rader på nytt för varje dokumentöppning; en tidsbegränsad servercache för redan kontrollerad roll används. Mappskapandet är verifierat i Drive. I publicerad testversion 44 visade VF-kontot med styrelseroll båda grupperna och knappen Öppna skapade separata webbläsarflikar för två testtextfiler utan att ersätta fillistan. Med samma testkonto tillfälligt satt till Medlem i EKO visade den publicerade dokumentvyn endast filen från Medlem-mappen. Testrollen återställdes till Styrelse och kontrollerades i EKO. Textfilernas innehåll i de separata flikarna kunde inte inspekteras med testverktyget. PDF och DOCX har kontrollerats i automatiska klienttester: PDF går till separat flik, DOCX till webbläsarens nedladdningshantering. Ett fullständigt liveprov med uppladdade PDF- och Office-filer återstår eftersom webbläsartestets filväljare inte öppnade sig i Apps Script-ramen. Vid medlemsprovet misslyckades ett första startförsök, medan omladdningen fungerade; det startfelet behöver undersökas separat. Ingen bredare Drive-behörighet har godkänts.

I publicerad identitetsversion 45 och dataversion 18 syntes de uppladdade PDF- och DOCX-filerna i respektive avdelning. Styrelsens borttagningsknapp provades på en äldre testtextfil: appen begärde bekräftelse, filen försvann från listan och meddelandet ”Dokumentet togs bort.” visades. Uppladdningsförloppet och slutbekräftelsen finns i den publicerade koden och i lokala kontroller, men själva filvalet gick inte att driva i testwebbläsarens Apps Script-ram. Ett manuellt slutprov av just dessa två meddelanden återstår.

Den sedan tidigare avskilda mappen **gammal VF-APP används ej.** och hemsidans egen mapp är inte delar av den aktuella appinstallationen och har inte flyttats.
