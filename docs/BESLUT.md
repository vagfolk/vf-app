# Vägfölk – gällande beslut och arbetsregler

Senast avstämt 2026-10-21 mot användarens besked i projektsamtalet. **Detta är beslut och mål, inte en lista över färdiga funktioner.** Läs [README](../README.md) för faktisk byggstatus. Om ett äldre förslag, en kodkommentar eller en överlämning säger något annat gäller det senaste uttryckliga beslutet från användaren. Lyft en verklig konflikt innan riktningen ändras.

## Fastlagd riktning

1. **Inget Cloudflare.** Projektet ska fortsätta med GitHub och Google. Gamla dokument om Cloudflare är historiska förslag, inte arbetsorder. Om Google-lösningen visar sig otillräckligt säker ska arbetet med verkliga uppgifter stanna och alternativen diskuteras med användaren. Välj inte en ny leverantör på egen hand.
2. **EKO betyder EKO i Google Sheets när appen diskuteras.** Excel-originalet `VF-EKO_3.13` är förlaga och jämförelsematerial. Appen ska inte synkronisera Excel mot Sheets eller bygga på två parallella medlems- eller ekonomiregister. Den aktuella Sheets-testkopian är inte automatiskt godkänd för drift.
3. **En samlad EKO-fil.** Medlemsuppgifter, roller och ekonomi hör ihop i EKO i Google Sheets. Behöriga personer sköter vanliga manuella ändringar direkt i den privata filen på datorn; kassören arbetar med ekonomi och sekreteraren med medlems- och rollfrågor enligt sina behörigheter. Appen ska inte ge någon roll ett allmänt formulär för att redigera EKO. Den särskilt beslutade överföringen av avstämd kontantförsäljning samt styrelsens snävt avgränsade ändring av telefon och e-post från ett kopplat kontaktkort är undantag. **Varje Swishbetalning från kassan bokförs manuellt av kassören i EKO.** Övriga EKO-fält redigeras fortfarande direkt i filen.
4. **Försäljningskassan är skild från kassörens ekonomiöversikt.** Behöriga styrelsemedlemmar ska kunna öppna och sköta en kassa utan att kassören är på plats. Ett försäljningstillfälle ska få ett automatiskt, beständigt ID; detaljer som antal sålda varor sparas i en separat, spårbar Drive-logg som kan skrivas ut. Efter avslut och godkännande får avstämd kontantförsäljning överföras till EKO utan dubbelbokföring; Swish bokför kassören själv betalning för betalning. Om en annan person avslutar än den som öppnade kassan ska medlemsnummer anges och kontrolleras mot EKO så att namn och roll kan hämtas. Kassörens senare godkännande är ett separat steg.
5. **Offlineförsäljning är ett krav.** Ett pågående försäljningstillfälle ska kunna lagras lokalt när kontakten saknas och synkas senare. Väntande, godkänt och faktiskt bokfört måste visas som olika tillstånd. Testad lokal lagring innebär ännu inte att detta är klart eller säkert för riktiga uppgifter.
6. **Behörighet och sekretess går före bekvämlighet.** Vanlig medlem får bara se sin egen avgift och möjligen egen historik. Styrelsen får begränsad ekonomiöversikt, kassören ska kunna läsa hela EKO via appen och sekreterare/kassör har även styrelsebehörigheter. Flera praktiska roller kan tilldelas samma person. Sekreteraren ska kunna hantera approller; en säker reservväg för administration och återställning behövs. Exakt återställningsmetod är ännu inte beslutad. Ingen medlem ska få tillgång till den privata EKO-filen bara för att appen visar en begränsad uppgift.
7. **Varje förening och installation är tekniskt isolerad.** En ny förening kan använda ett annat Google-konto, en annan Drive, andra mappnamn och helt andra fil-ID:n än Vägfölk. Inga sådana adresser, namn eller ID:n får vara hårdkodade för drift. Installationen ska skapa en egen huvudmapp och nödvändiga filer i den aktuella föreningens Drive och spara deras tekniska ID:n i just den installationens skyddade konfiguration. Varje begäran ska knytas till och kontrolleras mot ett unikt förenings-ID; appen får inte hitta eller välja driftfiler enbart genom filnamn. En användares Google-identitet ger inte i sig tillgång till någon förening: användaren måste dessutom vara registrerad med rätt status och behörighet i den aktuella föreningens EKO. En förenings konfiguration, användare och data får aldrig kunna blandas med en annan förenings genom avsikt, misstag eller namnlikhet. Vid en ny installation måste medlemmar läggas till och roller bestämmas i den gemensamma EKO-filen innan appen kan ge rätt åtkomst. Nya medlemmar/roller ska kunna läggas till utan att användaren fyller i tekniska ID:n manuellt. Första installationen ska vara så enkel som möjligt för en person utan programmeringskunskap.
8. **Appens tekniska drift och administration ska vara kostnadsfri utan faktureringskonto.** Regeln gäller appens hosting, datalagring, API:er, tekniska tillägg och administration, inte bara Google Sheets. VF-APP får endast använda sådana tekniska funktioner utan kopplat faktureringskonto, kortuppgifter, automatiska kostnader eller en betalnivå som appen själv kan aktivera. Appen ska begränsa eller tillfälligt stoppa en funktion när en gratisgräns nås; den får aldrig automatiskt beställa högre kvot eller orsaka en debitering. Om en teknisk leverantör senare kräver betalning för appens drift ska den berörda funktionen stoppas och en annan lösning diskuteras med användaren. Föreningens nödvändiga bankavtal, företags- eller föreningskonto, Swishtjänst och ordinarie Swish- eller transaktionsavgifter är däremot kostnader i föreningens verksamhet och omfattas inte av kravet på kostnadsfri appdrift. Dessa kostnader ska hanteras och bokföras korrekt i EKO. En ny betald teknisk integration utöver föreningens beslutade bank- och Swishavtal kräver fortfarande ett uttryckligt beslut. Gratisgränser och engångssteg måste beskrivas ärligt; kalla inte en oprövad installation automatisk eller garanterat gratis för all framtid.
9. **Riktiga uppgifter får inte användas i ett oprövat flöde.** Medlemsregister, kontakter och ekonomi ska ligga privat och lämnas ut enligt behörighet som kontrolleras på serversidan. Testa inloggning, föreningsgränser, Drive-rättigheter, avbrott och samtidiga försäljningar med låtsasdata först. Hemligheter får inte läggas i GitHub eller offentliga filer.
10. **Ingen fullständig chattserver ska byggas.** Knappen ska heta **Chat**.
    Funktionen är en enkel gemensam plats för inloggade användare, avsedd för korta meddelanden och
    snabbval som **Blir sen**, **Hittar inte dit** och **Behöver hjälp**. Den
    ska använda ett separat privat dokument i föreningens Drive, inte vara
    kopplad till en extern chattserver, och inte användas för långa diskussioner. Någon
    särskild styrelsechatt ska inte byggas; styrelsen kan kommunicera utanför
    appen.
11. **Vägfölks installation byggs färdig först.** Den första etappen är en fullt körbar och säker VF-app för Vägfölks faktiska arbetssätt. Automatisk installation, administration och paketering för andra föreningar ska inte byggas innan VF-versionen fungerar och har kunnat utvärderas. VF får tills vidare vara den enda konfigurerade föreningen, men förenings-ID samt Drive-, mapp- och fil-ID:n ska ligga i skyddad konfiguration och inte hårdkodas i den offentliga appkoden. Säkerhetskontrollerna ska fortfarande verifiera både användare, VF:s förenings-ID och användarens aktuella behörighet. Efter att VF-versionen är fullt fungerande tas ett nytt beslut om eventuell fortsättning för andra föreningar och vilka installationssteg som då krävs.
12. **Appen ska kunna installeras på telefon, platta och dator.** Den färdiga appen ska öppnas från en egen ikon och använda en begriplig appadress. Den nuvarande Apps Script-adressen är en skyddad ingång under uppbyggnaden, inte den beslutade slutliga installationsadressen. Installationssättet måste fortfarande utformas så att inloggning, privata uppgifter och offlineförsäljning fungerar säkert; att lägga en genväg på hemskärmen ensam uppfyller inte kravet.
13. **Snabb inläsning och ändringsstyrda uppdateringar gäller hela appen.** Behörigt innehåll för de befintliga vyerna ska läsas in vid inloggning så att ett menyval visar redan inläst innehåll direkt. Därefter kontrollerar appen om källorna ändrats och hämtar endast de delar som behöver uppdateras. Innehåll ska inte hämtas om vid varje menyval eller i täta fullständiga omhämtningar. Regeln gäller också funktioner som byggs senare. Behörighetskontroll, aktuell roll och återkallad åtkomst måste fortfarande hanteras säkert; prestanda får inte kringgå serverns behörighetsgräns. Kontroller under en öppen session behöver en dokumenterad frekvens och ska pausas när appen inte är aktiv.
14. **Tydlig utloggning för alla roller.** Både medlemmar och styrelsebehöriga ska ha en synlig **Logga ut**-knapp på Start. Den ska avsluta appens närvaromarkering och lämna den skyddade appvyn. Google-kontots inloggning i webbläsaren ska inte avslutas eftersom det kan påverka andra Google-tjänster; utloggningssidan ska vara tydlig med den skillnaden. Texten **Online** i statusindikatorn ska vara röd före appinloggning och efter utloggning, och grön först när en godkänd användare har lästs in.

## Senare beslut om försäljningskassan, 2026-10-21

Detta avsnitt ersätter äldre, motstridiga kassa- och godkännandeförslag ovan. Det beskriver **beslutat beteende**, inte färdig kod eller godkänd drift. Den första kassavyn får ha ett enkelt utseende; grafisk formgivning görs efter att funktionerna fungerar.

- **Åtkomst och arbetsyta:** Kassa öppnas från styrelsens Start i en egen fristående, minimerbar arbetsyta. Alla styrelsebehöriga kan öppna, sälja, se tidigare loggar och se alla öppna kassor i en kontrollvy. Endast Kassör och Admin granskar och godkänner avslutade kassor. Nödadministratören får se och utföra allt.
- **Öppning:** Ny kassa kräver nätanslutning, får automatiskt ett unikt, beständigt årsnummer och kopplas till inloggad öppnare och enhet. Högst en öppen kassa per person och enhet; avslutad kassa som väntar på granskning blockerar inte en ny. Flera olika personer och enheter kan ha egna kassor samtidigt. Kassa kan inte tas över från en annan enhet. Växelkassan anges som en totalsumma före start.
- **Varor och köp:** Varor läggs till med namn och pris före eller efter start; tidigare loggade varor och priser får föreslås. Ett köp har ett betalsätt, Kontant eller Swish, och ett unikt köp-ID. Vid kontantköp visas växel efter inmatat mottaget belopp. Vid Swish visas belopp och QR med unik köpreferens. Säljarens knapp **Betalt** registrerar endast vad säljaren uppger; banken kontrolleras senare av kassören. Swish får inte vara valbar förrän ett verkligt föreningsnummer och funktionen har aktiverats. Den gemensamma Swish-grunden ska kunna återanvändas för medlemsavgift.
- **Makulering:** Betalda köp kan makuleras före kassans stängning, med orsak och uppgift om betalning faktiskt mottogs. Kontant återbetalning kan göras från kassan; även mottaget Swishköp kan återbetalas kontant. Ursprungligt köp, Swishinsättning och kontant utbetalning bevaras i loggen. Ingen återbetalning får göras från en stängd kassa.
- **Offline och synk:** Efter öppning kan en kassa fortsätta och avslutas offline. Varje köp sparas lokalt direkt och synkas automatiskt när anslutning finns, med tydlig status Synkad/Väntar på synk. Kassören får inte godkänna en delvis synkad kassa. En senare uppladdning av gamla händelser får aldrig tyst ändra ett redan bokfört EKO-resultat.
- **Avslut:** Bekräftelse varnar att kassan stängs för nya köp. Avslutaren anger enbart medlemsnummer; EKO verifierar att det är en aktiv styrelsemedlem och hämtar namn och roll till loggen. Avslut kan registreras offline, men verifieras först efter återanslutning. Räknade kontanter jämförs med växelkassa plus kontantförsäljning minus kontanta återbetalningar. Loggen visar öppning, köp, avslut och godkännande med tid. Bokföringsdatum är dagen då kassan öppnades, även om köpen eller godkännandet sker senare.
- **Kassörens kontroll:** Varje kassa, online som offline, kräver kassörens godkännande. Kassören kontrollerar Swish mot banken, anger faktisk Swishsumma och jämför med loggen. Om kontanter eller Swish avviker loggas avvikelsen; automatisk kontantöverföring stoppas och kassören utreder och bokför manuellt med verifikationsnummer. Vid full överensstämmelse kan avstämd kontantförsäljning föras över till EKO en gång. Swishbetalningarna bokför kassören alltid manuellt, var för sig. Godkänd logg blir oföränderlig.
- **EKO och logg:** Kontantförsäljning kan sammanföras per vara och överföras efter godkännande. Varje mottagen Swishbetalning registreras manuellt av kassören som **en** inkomstpost i EKO med betalningens hela belopp, rätt aktiv kategori och en unik kvitto-/betalningshänvisning. Flera varor i köpet delas inte upp i flera Swishrader i EKO; varorna och varje köp finns separat i kassans Drive-logg. Swishköp får inte bakas ihop till en totalsumma per kassa. Varje kassa får en egen daterad loggfil i nummerordning, möjlig att skriva ut; inga kassatillfällen delar loggdokument.
- **Swishavgift:** EKO, inte appen, beräknar avgiften för varje giltig Swish-inkomstrad utifrån Grunddata. Därför ska kassören skapa just en rad per faktiskt mottagen Swishbetalning. En mottagen Swishbetalning som senare återbetalas kontant finns kvar som Swishbetalning i bankavstämningen och avgiftsunderlaget. Appen får inte införa en egen Swishavgiftsberäkning eller ändra EKO:s avgiftsformel för detta.
- **Trasig enhet och avbrott:** Alla styrelsemedlemmar kan från kontrollvyn avbryta en öppen kassa med orsak. Synkade köp återvinns under samma kassa-ID och går till kassörens granskning. Om enheten är förlorad och lokala köp inte kan hämtas markeras loggen som möjligen ofullständig; kassören måste kontrollera försäljningen manuellt. Avbrutna kassanummer återanvänds aldrig.

## Beslutade krav för information, möten och uppgifter

- **Kalender:** medlemmar ska se medlemskalendern. Styrelse, sekreterare,
  kassör och administratör ska se både medlemskalendern och styrelsekalendern.
  Appens kalendervy visar återstående händelser under aktuell månad direkt
  från Google Kalender, utan datumknappar. De två kalendrarna visas var för
  sig för styrelsebehöriga. Behörighetsgränsen finns i datakällan och
  kontrolleras på serversidan. Medlemmar kan bara läsa sin kalender. Styrelsen
  kan läsa båda i appen och får två små länkar till respektive Google Kalender
  för redigering där. Faktisk redigeringsrätt i Google måste tilldelas
  styrelsekontona separat; en länk ger inte behörighet i sig.
- **Nästa möte:** en medlem ska se nästa medlemsmöte. Styrelsebehöriga ska se
  både nästa medlemsmöte och nästa styrelsemöte under rubriken ”Nästa möte”.
  Dessa söks bland framtida händelser oavsett vilken månad kalendervyn visar.
- **Information:** den högra informationsskärmen ska heta ”Information”.
  Ett klick öppnar ett eget viktigt meddelande från styrelsen, inte Chat.
  Endast styrelsebehöriga får publicera sådana meddelanden. Alla aktiva
  användare ska kunna läsa dem. Informationsmeddelanden ska inte automatiskt
  läggas i Chat. Publiceringsfält och andra styrelse-, redigerings- och
  administrationsreglage ska inte visas alls för en vanlig medlem. Dold
  användarvy ersätter aldrig behörighetskontroll på serversidan.
  Själva informationsvyn ska inte ha ett extra rubrikpar; styrelsens åtgärd
  ska heta **Skicka viktigt meddelande**. I styrelsens skrivvy visas tidigare
  publicerade viktiga meddelanden, vart och ett med en diskret **Ta bort**-knapp.
  Borttagning kräver bekräftelse och kontrolleras mot aktuell styrelseroll på
  servern. Ett borttaget meddelande försvinner ur appens visning, medan en
  intern notering om vem som tog bort det och när bevaras i den privata filen.
- **Chat:** alla inloggade får läsa och lämna korta meddelanden samt
  använda beslutade snabbval. Varje post ska knytas till den inloggade
  användarens beständiga medlems-ID, visningsnamn och tid. Användaren ska inte
  kunna ange någon annans identitet.
  Knappen **Skicka** ska ligga bredvid textrutan; snabbknapparna ligger i en
  separat grupp under den.
  Chatvyn ska inte upprepa menynamnet i stora rubriker. Detsamma gäller
  andra vyers dubbla rubrikpar. Teknik- och teststatus dokumenteras utanför
  appens användargränssnitt; upprepade testetiketter ska inte täcka innehållet.
- **Notiser byggs efter grundfunktionerna:** Chat-knappen ska blinka när den
  inloggade har olästa meddelanden. Telefonen ska kunna få en notis både när
  någon skriver i Chat och när styrelsen publicerar Information. Detta kräver
  ett eget senare steg för lässtatus, telefonbehörighet och leverans när appen
  inte är öppen. Ingen sådan notis får beskrivas som fungerande innan den
  faktiskt är byggd och provad.
- **Protokoll och dokument:** alla aktuella appfiler i Drive ligger under
  huvudmappen `VF-app`. Där finns separata mappar för `Kontaktkort`,
  `EKO och ekonomi`, `Appinformation och styrning` och `Dokument`.
  `Dokument` innehåller exakt de två mapparna `Medlem` och `Styrelse`.
  De tidigare manuellt skapade dokumentmapparna togs bort av användaren.
  Appens dataskript ska skapa nya mappar och filer med sin begränsade
  `drive.file`-behörighet. Styrelsen laddar upp en lokal fil via knappen
  `Dokument` på styrelsens startsida och väljer `Medlem` eller `Styrelse`.
  En vanlig medlem ser endast medlemsdokumenten. Styrelsebehöriga ser båda.
  Dokumentvyn är en ren fillista för **alla** roller: där får ingen skapa,
  redigera, flytta eller ta bort dokument. När en fil väljs lämnas den till
  webbläsaren eller enhetens filhantering. Appen visar ingen egen
  dokumentförhandsvisning och bestämmer inte vilket program som öppnar filen.
  Om webbläsaren inte kan öppna filtypen får användaren hämta filen.
  Uppladdning finns endast på
  styrelsens startsida. Inloggningens roll avgör vilka dokumentgrupper appen
  laddar och visar; inga manuella rollval eller nya EKO-kontroller ska krävas
  när ett enskilt dokument öppnas. Dokument levereras genom appen, inte som
  direkta Drive-länkar som kräver enskilda Drive-behörigheter för medlemmarna.
  Dokumentvyn har samma enkla mittdisplaystil som övriga vyer: två
  avdelningar med endast ett skiljestreck för styrelsebehöriga, och enbart
  medlemsdokument för vanliga medlemmar. Rollen styr visningen utan manuellt
  listval. Direktdelning i Drive får inte kringgå denna uppdelning. På
  styrelsens administrativa sida `Start → Dokument` ska uppladdningen visa
  omedelbar förloppsinformation, hindra dubbelklick under pågående uppladdning
  och bekräfta resultatet. Där får styrelsen även ta bort felplacerade eller
  inaktuella dokument efter en tydlig bekräftelse; den åtgärden finns inte i
  vänstermenyns dokumentvy. Borttagning flyttar filen till Drives papperskorg.
- **Inloggade och mötesdeltagande:** alla ska se hur många som är aktuellt
  inloggade. En vanlig medlem ska inte automatiskt få en namnlista. När
  mötesläget senare är byggt ska möten kunna hållas helt eller delvis genom
  appen. Alla inloggade med rätt mötesbehörighet ska då kunna följa exempelvis
  dagordning, mötesunderlag och den ekonomiska information som kassören visar.
  Systemet ska skilja mellan att vara allmänt inloggad i appen och att ha gått
  in i det aktiva mötet. Sekreteraren ska med en knapp kunna föra in de
  registrerade mötesdeltagarna i protokollet. Fysisk närvaro är inget krav;
  listan ska kunna granskas och rättas om någon anslutit sent, lämnat mötet
  eller deltagit på annat sätt.
- **Begär ordet i mötesläget:** en deltagare i ett aktivt möte ska kunna
  trycka på **Begär ordet**. Funktionen hör till det senare samlade arbetet
  med mötesläget. Hur talarkö, återtagande av begäran och mötesordförandens
  hantering ska fungera är förslag som måste bestämmas innan den byggs.
- **Egen medlemsavgift:** medlemsvyn ska visa en enkel grön status
  **Medlemsavgift betald** eller en röd status **Medlemsavgift inte betald**.
  Betalt belopp ska inte visas. Återstående belopp ska bara visas när det är
  större än noll. Förfallodatum visas när ett sådant finns. Om ett obetalt
  belopp finns ska appen börja varna två kalendermånader före
  förfallodatumet och fortsätta visa en tydlig varning efter förfallodagen.
  Beräkningen får göras med den fullständiga avgiften på serversidan, men
  onödiga avgifts- eller medlemsuppgifter ska inte skickas till webbläsaren.
- **Betala medlemsavgiften med Swish:** när ett belopp återstår ska medlemmen
  kunna öppna Swish från appen med föreningens mottagarnummer, rätt belopp och
  en unik medlemsreferens ifyllda. Beloppet hämtas från medlemstyp,
  familjeregler och eventuell särskild avgift i EKO; det styrs inte av
  användarens approll. Det nu beslutade första flödet kräver inte Swish Handel
  API, utan bygger på kassörens kontroll mot banken. Appen kan därför inte
  själv bekräfta att pengarna kommit till banken. Efter betalningen ska
  medlemmen uttryckligen kunna ange
  **Jag har betalat**. Kassören får då ett meddelande med medlem, belopp,
  referens och tid, tydligt märkt som **uppgiven betalning – behöver
  kontrolleras**. Kassören kontrollerar insättningen mot bankkontot och
  bokför betalningen direkt i EKO. Först när EKO visar betalningen ska appen
  markera avgiften som betald. Medlemsbetalningen är alltså inte ett nytt
  undantag från regeln att vanliga manuella EKO-ändringar görs utanför appen.
- **Gemensam Swish-grund byggs senare:** den tekniska grunden för Swish ska
  kunna återanvändas av både medlemsavgifter och försäljningskassan, men ska
  inte byggas eller kopplas in nu. Den ska byggas och testas med låtsasdata
  som ett eget sammanhållet steg omedelbart innan arbetet med
  försäljningskassan börjar. Först därefter byggs kassan ovanpå samma
  betalningsmodell. Ingen fysisk Swishanslutning, inget produktionscertifikat
  och inga verkliga betalningar får användas innan Swish har aktiverats och
  testflödet har godkänts.
- **Begränsat läge vid obetald avgift:** om EKO fortfarande visar obetalt sju
  dagar efter förfallodatumet får appen begränsa åtkomsten. Medlemmen ska även
  då nå betalningsknappen, sin betalstatus, möjligt återstående belopp,
  kontaktfunktionen och utloggning. Att Swish har öppnats eller att medlemmen
  har tryckt **Jag har betalat** får inte låsa upp appen. Upplåsning sker först
  när den kontrollerade betalningen finns i EKO. Avgiftsbefriade medlemmar,
  familjemedlemmar som inte är avgiftsskyldiga och andra beslutade undantag
  får inte spärras.
- **Kontakt:** alla inloggade aktiva medlemmar ska kunna se alla andra aktiva
  medlemmars namn, små foton och kontaktuppgifter. Användaren har uttryckligen
  valt detta även utan ett individuellt delningsval i appen. Uppgifterna ska
  fortfarande lämnas ut först efter serverns inloggnings- och
  föreningskontroll; inaktiva medlemmar och andra registerfält ska inte visas.
  Kontaktknappen ska vara tillgänglig även i begränsat läge. Foton behöver
  ligga i en privat, behörighetskontrollerad källa, inte via offentliga länkar.
  Kontakt visas som kort i alfabetisk ordning efter förnamn. Knappen
  **Kontakt** öppnar kontaktlistan. Den befintliga knappen **Medlemmar** på
  styrelsens startsida ska i stället öppna en separat vy för att skapa ett
  medlemskort direkt; den ska inte öppna kontaktlistan och ingen extra
  tilläggsknapp ska ligga på startsidan. Skapandevyn sparar ett kontaktkort med namn,
  kort beskrivning och foto från galleri eller kamera, men skapar ingen
  medlemspost i EKO. Kortet och fotot sparas som filer i en egen privat
  kontaktmapp i föreningens Drive, inte i ett extra Google-kalkylark eller
  i det publika GitHub-arkivet. Appen namnger automatiskt sparade kort med
  personens namn och ID; användaren ska inte namnge filer manuellt.
  Innan ett Medlems-ID finns används ett beständigt internt kort-ID;
  filens Drive-ID och den faktiska EKO-kopplingen styr funktionen, inte
  filnamnet.
  Alla aktiva EKO-medlemmar visas automatiskt som enkla kontaktkort även
  om styrelsen ännu inte har lagt in foto eller beskrivning.
  Ett okopplat kort visas ändå för inloggade medlemmar. Styrelsen kan koppla
  kortet till ett beständigt Medlems-ID (samma sak som medlemsnummer), även
  senare när posten skapats manuellt i EKO. Namn ensamt får inte användas för
  automatisk koppling. För kopplade kort hämtas telefon och e-post från EKO.
  Kontakt i vänstermenyn är en ren läsvy även för styrelsen. Styrelsens
  startknapp **Medlemmar** öppnar både formuläret för nya kontaktkort och
  en lista över korten med diskreta knappar **Redigera** och **Ta bort**.
  Under redigering finns också **Stäng**, som återgår till listan i Medlemmar
  utan att spara. Ta bort avser kontaktkortet, inte
  EKO-posten.
  Ett borttaget kopplat kort ska inte automatiskt återskapas ur EKO;
  styrelsen får skapa ett nytt kort om personen ska visas i Kontakt igen.
  För att hindra återskapande sparas endast en intern markering av det
  borttagna Medlems-ID:t i den privata kontaktmappen; själva kortet och
  fotot försvinner från Kontakt.
  Ändrar styrelsen telefon eller e-post i ett kort med aktiv EKO-koppling ska
  appen skriva just de fälten till den kopplade posten i EKO och bekräfta
  ändringen först när den är sparad. Redigering av andra EKO-fält via kortet
  ingår inte. För okopplade kort kan telefon och e-post sparas i kortet;
  vid senare koppling får dessa inte automatiskt skriva över EKO:s värden.
- **Styrelsens startsida:** de stora innehållskorten för **Nästa möte** och
  **Information** tas bort från mittdisplayens startvy för styrelseroller.
  De mindre sidodisplayerna behålls. På startsidan visas i stället knapparna
  **Ekonomi** (styrelsens begränsade översikt) och **Medlemmar**
  (vyn för att skapa medlemskort) samt **Viktigt meddelande** som öppnar
  styrelsens vy för att skicka ett viktigt meddelande. Den sistnämnda knappen
  visas endast för styrelsebehöriga. Där finns också länkar för att öppna medlems- och
  styrelsekalendern i Google. Kalenderlänkarna flyttas från kalendervyn.
  Kassören använder samma **Ekonomi**-flik som styrelsen, men ser dessutom
  hela EKO i en skrivskyddad läsvy där. Ingen separat kassörsknapp behövs.
  Google och EKO avgör
  fortfarande vilka uppgifter respektive roll får läsa eller ändra.
  Alla befintliga administrativa reglage ska nås från styrelsens startsida,
  inte från vänstermenyns innehållsvyer. Informationskortet öppnar en
  läsvy även för styrelsen; startknappen **Viktigt meddelande** öppnar
  publicering och borttagning av tidigare meddelanden. Vanlig Chat är
  medlemmarnas kommunikation och räknas inte som administration.
- **Rollstyrning i hela appen:** användaren ska inte behöva välja mellan
  ”För medlemmar” och ”För styrelsen” i Att göra, Dokument eller andra vyer.
  EKO-rollen bestämmer automatiskt vilka listor, knappar och uppgifter som
  visas. Medlemmar ska inte se styrelsens kontroller eller innehåll alls.
  Styrelsebehöriga ser både medlems- och styrelseinnehåll där det är relevant.
  Servern ska fortfarande kontrollera varje skyddat dataanrop och ändring;
  att en knapp är dold är ingen behörighetskontroll.
- **Att göra:** namnet avser en att-göra-lista, inte sekreterarens
  medlemsregister. Styrelsen ska lägga till uppgifter från startsidan med
  rullistan **Medlem**, **Styrelse** eller **Prioriterad**. Prioriterade
  uppgifter syns överst för alla medlemmar. I Att göra-vyn visas de överst,
  med medlemsuppgifter och styrelseuppgifter i två avdelningar under.
  Vanliga medlemmar ser bara prioriterade uppgifter och medlemsuppgifter.
  Avdelningarna skiljs åt med enkla linjer utan synliga kolumnrutor.
  Varje uppgift visas som text med en vanlig kryssruta, utan en egen grå ruta
  eller en etikett som upprepar uppgiftens kategori. Skrivfältet på startsidan
  är kompakt, kan växa nedåt vid
  längre text och har listvalet och knappen **Lägg till uppgift** intill sig.
  På styrelsens startsida öppnar knappen **Att göra** detta formulär och
  styrelsens granskningslista med både aktiva och avbockade uppgifter;
  formuläret visas inte innan knappen trycks. Vänstermenyns **Att göra**
  öppnar listan. Knappen **Stäng vyn** används inte på startsidan.
  Själva Att göra-vyn visar uppgifterna och låter behöriga användare bocka av
  eller återkalla en felmarkering med kryssrutan. En
  inloggad medlem ska kunna markera en uppgift som utförd, och utförandet ska
  sparas med uppgiftens ID, personens medlems-ID och visningsnamn samt tid.
  Det ska också finnas en separat lista som bara styrelsebehöriga ser.
  Om två personer försöker bocka av samma uppgift gäller den avbockning som
  sparas först. Före avbockningen visas bekräftelsen
  **Bekräfta att uppgiften är klar** med valen **OK** och **Avbryt**.
  Den som bockade av ska kunna välja **Återkalla** vid en
  felmarkering; uppgiften öppnas då igen. Både avbockning och återkallelse
  sparas med uppgift, person och tid, och återkallelsen märks **felaktig**.
  Ingen annan medlem får återkalla den personens avbockning.
  När styrelsen har granskat en avbockad uppgift kan en styrelsebehörig välja
  **Godkänn och arkivera** i startsidans Att göra-avdelning. Vänstermenyns
  Att göra är endast för att läsa uppgifterna och bocka av eller återkalla
  egna avbockningar. Den arkiverade uppgiften försvinner från den aktiva
  Att göra-listan för alla, men händelserna skapad, utförd och arkiverad finns
  kvar i den privata uppgiftsloggen med medlems-ID, namn och tid för senare
  kontroll. En oavslutad uppgift får inte arkiveras. Vanliga medlemmar ser
  inte arkiveringsknappen.
- **Mötesläge:** den gamla prototypens idé med aktuell dagordning och
  mötesfiler är endast underlag. Ett fullständigt arbetsflöde är ännu inte
  beslutat. Mötesläget ska byggas i ett senare samlat steg, liksom
  försäljningskassan. Den gemensamma Swish-grunden ska byggas före
  försäljningskassan. Övriga beslutade delar ska göras funktionsdugliga först.
- **Dator, platta och telefon:** appens funktioner och behörigheter ska fungera
  på alla tre enhetstyperna. Telefonens instrumentpanel utformas för liggande
  skärm. I stående läge får appen be användaren vrida telefonen. En mindre
  skärm får inte bli en avskalad version som saknar nödvändiga funktioner.
  Knappar och text ska vara tydliga och användbara även med pekskärm.
- **Föreningsanpassat utseende:** när stöd för andra föreningar senare byggs
  ska föreningen kunna använda egen logotyp och egna färger utan att ändra
  appens grundlayout. Den nuvarande utseendeskissen och användarens två
  referensbilder är förslag till formgivning, inte godkänd produktlayout.
- **Appens visuella riktning:** Vägfölks layout ska utgå från användarens
  senaste bild `bilder/vf app v5.png` (1672 × 941 pixlar) och eftersträva ett slutresultat så nära den som
  läsbarhet och fungerande användning tillåter. Hela skärmen ska vara en mörk
  instrumentpanel; ingen rundad panel ska visa en bakgrund bakom appen.
  Bildens färger, belysta ramar, knappar och grafiska element är utgångspunkt.
  Rubrikens tidigare `VF GT` ersätts av `VF 26`. Mittdisplayen ska vara fri
  från fast text och ikoner så att framtida material kan visas ovanpå dess
  väg- och skogsbakgrund. Den senaste bildens rena väg- och skogsmotiv får
  användas som visuell resurs; inga separata originalskikt eller typsnitt
  finns tillgängliga från bildgenereringen. Länkarna längst ned tas bort eftersom de dubblar
  vänstermenyn; det frigjorda utrymmet används till större displayer. Den
  gula markeringen ska följa det menyval som pekaren är över och visa det
  valda alternativet när pekaren lämnar menyn. Telefonens huvudlayout utgår
  från liggande skärm. Den tidigare `GT`-skissen är avvisad som VF-riktning
  men sparas jämte tidigare alternativ; den modernare skissen är fortfarande
  endast en **möjlig** standardlayout för andra föreningar i en senare etapp.
  Den senaste bilden tillför ett smalt instrumentfält nedtill och en lägesväljare
  upptill. Sportbilsdetaljer som varningslampor, bältestext och räckvidd är
  dekorativa om de saknar verklig datakälla; de får inte se ut som äkta
  fordonsvarningar eller enhetsmätningar. Klockan ska visa enhetens lokala tid.
  Datumfältet i övre högra informationspanelen ska automatiskt visa enhetens
  aktuella lokala datum och ändras när kalenderdagen växlar.
  Temperatur ska hämtas automatiskt från SMHI för den aktuella enhetens plats,
  inte från en fast ort som Storfors. Webbläsaren måste först få platsbehörighet;
  när den har getts ska appen hämta och uppdatera prognosen utan ett manuellt
  knapptryck varje gång. Om plats eller SMHI-svar saknas visas ingen påhittad temperatur. Värdet ska
  beskrivas som prognostemperatur, inte som en mätning från enhetens sensor.
  Den bildnära skissen ska visa nederdelen som en integrerad välvd panel,
  lägesknappar och navigering i panelens form och utan extra `DEMO`-dekor.
  Den fortsatta uppbyggnaden ska följa användarens färgmarkerade bild
  `bilder/vf app v5 draw.png`: ytterram, de tre övre fälten, lägesval,
  vänstermeny, hälsning, nästa möte, mittdisplayens ram och innehåll,
  klubbinformation, styrelsemeddelande, de två fria ytorna och de nedre
  fälten ska kunna ändras var för sig. Klocka, medlemsstatus och väder ska
  också vara självständiga delar. Fasta etiketter som `demo`, `tillfälligt`
  eller `exempel` ska inte läggas inne i panelens grafiska utformning;
  skissens status och påhittade värden förklaras i text utanför panelen.
  Alla vyer inne i mittdisplayen, även Start, Kalender, Att göra, Chat,
  Information, Dokument, Min avgift, Kontakt, Medlemmar och Ekonomi, ska ha
  ett enklare, mörkt uttryck. Knapparna ska påminna om vänstermenyns inbyggda
  knappar men sakna dess färgeffekt. Innehåll delas där det passar med tunna
  skiljestreck i stället för tjocka kort och lysande ramar. Detta gäller även
  vyer som tillkommer senare.
  Den yttre instrumentpanelens godkända bilddelar påverkas inte av den
  förenklingen.
  Nederdelens korta avgiftsindikator ska heta **Medlemsstatus** utan `OK`.
  Den ska vara grön när avgiften är betald och tydligt röd vid obetald avgift,
  med glaslik glöd i samma stil som lägesknapparna. Klockan till vänster om
  medlemsstatus ska visa enhetens aktuella lokala tid.
  Hälsningen ska använda den inloggade personens visningsnamn; ett fast namn
  som Anna får inte ligga kvar i appen. Den övre 5G-texten tas bort och ersätts
  av **Status – [antal] online**, där antalet ska komma från appens verkliga
  inloggade användare. Status, Bluetooth och mottagning ska ligga direkt mot
  det övre fältets bakgrund utan en separat rektangulär ruta.
  Bluetooth- och mottagningsikonerna behålls. I den
  grafiska förhandsvisningen får signalstyrkan växla för att visa ikonen,
  men det får inte beskrivas som verklig mottagningsdata. Bältes-, tank- och
  Bluetooth-ikonerna får blinka med jämn takt som en visuell effekt.
  Temperaturvärdet och den lilla vägsymbolen i det övre högra fältet samt
  varningstriangeln vid bältestexten tas bort. Den nedre vägsymbolen vid
  temperaturfältet ska kunna vara neutral eller växla grafiskt mellan grönt
  och blått; färgen är inte en verklig uppgift om vägförhållanden.
  Prognostemperatur ska visas i ett eget fält med klockans
  typografiska stil, endast när plats och SMHI ger ett giltigt värde.
  Huvudskärmens innehåll samt de tomma vänstra och högra sidoytorna ska
  följa respektive bildrams konturer och kunna ändras som separata moduler.
  Mittdisplayens vanliga bakgrund är helt svart i stället för vägmotivet.
  Vid en ny inloggnings första inläsning från EKO får den visa animationen
  `Vagfolk26_Startsekvens_12s_v4` (WebM med MP4 som reserv). Animationen
  och EKO-hämtningen startar samtidigt. Alla startvyns EKO-uppgifter hämtas i
  bakgrunden medan filmen spelar. Instrumentpanelen runt mittdisplayen förblir
  synlig, men inget annat innehåll visas i mittdisplayen före filmens slut.
  Inlästa uppgifter visas där först när både filmen och hämtningen är klara.
  Om Google/EKO ändå tar längre tid än filmen
  ligger filmens sista bild kvar tills inläsningen är klar. Den startar inte om
  vid senare ändringskontroller mot EKO. Svart yta och video ska klippas innanför
  originalramens inre kontur utan en extra ram eller övertäckta kanter.
  Den vänstra sidoytans kontur och klickyta får inte gå ut över menyknapparna.
  Medlemsavgiftens status får bara visas som verklig när den kommer från en
  behörighetskontrollerad källa; i skissen ska exempeluppgifter märkas tydligt.
  Mötesläget är fortfarande uppskjutet och får inte framstå som färdigt.
  Den nya `VF 26`-skissen ska granskas av användaren innan layouten byggs in
  i appen. Inget beslut om att bygga stöd för andra föreningar tas nu.

## Beslutade krav för EKO i Google Sheets

- En familj ska kunna knytas ihop med ett familje-ID. Det ska vara tydligt vem som är **avgiftsskyldig**; övriga familjemedlemmar ska kunna vara medlemmar utan separat betalningsskyldighet. Familjeavgift ska definieras på ett enda ställe, inte i dubbla inställningar.
- Standardavgift ska hämtas från vald medlemstyp i Grunddata/Inställningar. En behörig person ska kunna ange en särskild avgift vid behov. Det ska finnas utrymme att lägga till medlemstyper, roller och kategorier utan tekniska ingrepp.
- Kassaboken ska ha användbara rader och val, tydlig översikt över ingående/utgående saldo och bank, kontanter och Swish. Viktiga uppgifter ska inte döljas av onödigt breda vyer. Kontrollstatus ska vara lätt att se, helst rött/grönt i stället för bara text som ”OK”. Undvik vit text på svart bakgrund.
- Mottagen medlemsavgift via Swish ska bokföras som inkomst med sitt fulla
  belopp. Bankens eller Swishtjänstens avgift ska bokföras separat som utgift
  enligt bankavtalet och bankunderlaget, så att avgiften kan räknas av i
  resultatet utan att medlemsintäkten förvanskas. EKO ska kunna hantera den
  beslutade Swishavgiften som en verksamhetskostnad.
- Räkenskapsår ska kunna anges i inställningarna. Nytt år ska utgå från föregående år och föra över ingående bank, kontanter, tillgångar och skulder korrekt utan att kassören måste kopiera saldon för hand. En avvikande period ska kunna väljas med kassörens godkännande och förklaring. Appen har ingen direkt bankkoppling och kan därför inte intyga att bokföringens saldo är samma som bankens faktiska saldo.
- Bokslutet ska kunna skrivas ut med uppgift om bland annat kassören. Formella underskrifter görs för hand på papper och sparas i pärm; kassörens inloggade godkännande i systemet är en separat kontroll, inte en ersättning för pappersunderskrifter.
- En frivillig räkningshjälp har uttryckligen lagts åt sidan för tillfället. VBA/makron får inte vara enda vägen att genomföra årsskifte i den webbaserade lösningen.

## Arbetsregler från användaren

- **Rekommendera exakt modell och resonemangsnivå innan varje ny eller återupptagen projektuppgift.** Säg samtidigt om uppgiften väntas dra ovanligt mycket krediter och låt användaren välja modell eller att göra ett stort moment själv. Börja inte läsa eller ändra projektfiler, arbeta i Drive eller starta själva uppgiften förrän användaren har fått rekommendationen och svarat. Om rekommendationen redan har getts för samma uppgift och användaren säger ”fortsätt”, fortsätt utan att begära den igen. Detta gäller också efter sidospår i samtalet.
- Förklara resultat och praktiska steg på vanlig svenska. Användaren kan hantera mappar, uppladdningar och inställningar med tydlig vägledning, men skriver inte kod.
- Skilj uttryckliga beslut från idéer och tekniska förslag. Diskutera en nödvändig ändring av arkitektur, datakälla, leverantör eller säkerhetsmodell innan den genomförs. En gammal text i projektet upphäver aldrig ett senare beslut från användaren.
- Vid osäkerhet om ett tidigare beslut: kontrollera samtalet och detta dokument, säg vad som är oklart och gör inga ändringar med riktiga uppgifter på antaganden.

## Öppet och ännu inte godkänt för drift

- Vilken Google-baserad serverlösning som säkert kan verifiera besökaren och läsa privata Drive/Sheets-filer. Apps Script är ett spår att prova, inte en färdig eller godkänd koppling.
- **Åtgärd före riktiga uppgifter:** I den lokala appen har VF-kontot öppnat appvyn och ett andra riktigt Google-konto fått **”Kontot har inte tillgång till föreningen”** utan att några testuppgifter visades. Det separata Apps Script-läsprovet är ännu inte löst: ett tidigare prov gav `data_unavailable`. Körningsloggar 2026-10-11 visar att dataskriptets `doPost` faktiskt slutfördes men att identitetsskriptet loggade HTTP 404 när det hämtade svaret. En ny version hämtar Googles omdirigerade svar igen utan att upprepa anropet; den fungerar med det kända testkontot. Ett senare svar med testpersonens uppgifter kom också från VF-kontot och utgör inte ett prov med okänt konto. Testsidan visar nu det konto skriptet faktiskt använder. Med det okända kontot `fl.linkan@gmail.com` svarade testet `authorization_required`; detta konto har ännu inte godkänt skriptets externa anrop. En senare länk till skriptprojektets auktorisering bad felaktigt om läs- eller redigeringsåtkomst till projektet och togs bort i version 10 utan att åtkomst beviljades. Version 11 försökte öppna Googles ordinarie godkännande men fastnade i Chrome inkognito på ”Waiting for authorization...”. Identitetsskriptet använde först ett eget Apps Script-hanterat Cloud-projekt, medan dataskriptet var kopplat till VF-APP. Efter användarens godkännande visar båda skripten VF-APP:s projektnummer 650474529830. Den inbyggda webbläsaren fastnade fortfarande i Googles godkännande; orsaken är fortfarande okänd. Ett uttryckligt `unknown_user` för okänt konto är ännu inte verifierat live. Den separata skriptkedjan är heller inte ansluten till den lokala appen. Kontoproven är vilande; den privata EKO-åtkomsten får inte kallas färdig eller användas med riktiga uppgifter på dessa resultat.
- **Senaste behörighetsprov 2026-10-11:** Med det andra kontot i vanlig Chrome-profil visades Googles ”Det går inte att öppna filen just nu” i godkännandeflödet, utan svar från provknappen. Körningsloggen från samma minut visar ett slutfört `doGet` och `getTestAccount`, men avslöjar inte vilket konto de använde. Den aktiva version 11-publiceringen kör som besökaren och tillåter Google-konton. Ett separat misslyckat `doGet` visade i körningsloggen att `script.external_request` saknades; identitetsskriptet begär inte Drive- eller Sheets-åtkomst. Varför Google inte slutför godkännandet för det andra kontot är oklart. Detta ändrar inte statusen ovan: avslag från dataskriptets medlemskontroll är ännu inte verifierat.
- VF-APP:s Google Auth Platform hade inga OAuth-behörigheter registrerade på sidan Data Access. De fyra behörigheter som Googles godkännandelänk begärde har nu registrerats och sparats: `openid`, e-post, grundläggande profil och `script.external_request`. Ingen Drive- eller Sheets-behörighet lades till. Codex inbyggda webbläsare fastnade fortfarande vid godkännandet efteråt och det andra kontot fick samma filfel i vanlig Chrome. Loggen från samma minut visar slutförda `doGet` och `getTestAccount` men inget `readTestData`; den visar inte säkert vilket konto som öppnade sidan. Detta är en konfigurationsåtgärd, inte ett godkänt åtkomstprov.
- **EKO-filåtkomst 2026-10-11:** Med det befintliga dataskriptets `drive.file`-behörighet gav ett läsprov av enbart filmetadata HTTP 404 för den befintliga Sheets-testkopian `VF-EKO 4.4 – konverteringstest – ENDAST TESTDATA`, men HTTP 200 för testfilen som samma skript själv skapat. Den tillfälliga provkoden togs bort efteråt; inga EKO-celler eller roller ändrades. Ett rollprov mot befintliga EKO skulle nu blanda ihop filåtkomstfel med rollbeslut och har därför inte genomförts. Filval med bibehållen `drive.file`-begränsning är ett möjligt nästa förslag som behöver beslutas och verifieras; bredare Google-behörigheter är inte godkända.
- **Picker-prov 2026-10-11:** Efter användarens besked att fortsätta med det smala filvalet finns nu en lokal, avstängd-som-standard testsida för att välja exakt den befintliga EKO-testkopian. Den är avsedd att läsa endast filmetadata. VF-APP-projektet saknar faktureringskonto. Med användarens särskilda godkännanden har Google Picker API aktiverats och en API-nyckel skapats; Google Cloud visar att den är begränsad till Google Picker API och Google Drive API samt `http://localhost:3000/*` och `https://docs.google.com/*`. Nyckelns värde finns inte i projektfilerna. VF-kontot godkände väntad `drive.file`-behörighet, men Picker visade därefter `The API developer key is invalid` vid två försök. Filvalet och dataskriptets separata åtkomst är därför ännu inte verifierade. Inga EKO-celler eller roller har ändrats i detta steg.
- **EKO-importprov 2026-10-12:** Picker-felet kringgicks i ett separat test utan bredare Google-behörighet: ägarens dataskript skapade en privat testmapp och importerade en export av den befintliga EKO-testkopian till en ny Google Sheets-fil. Skriptet kunde därefter läsa filen med `drive.file`. Sex flikar, samtliga ifyllda celler och formler, datavalideringar och villkorsstyrda formateringar överensstämde vid jämförelse av exporterade arbetsböcker. Importen ändrade tidszonen till Los Angeles och tappade en tom extrakolumn i Medlemmar; båda rättades i den nya testkopian och verifierades. Med VF-kontot synligt på testsidan och testpersonens Google-konto-ID kopplat i den nya EKO-kopian gav rollen Medlem endast egen testavgift och nekade styrelseöversikten; rollen Styrelse gav översikten; status Väntar nekades; utan kontokoppling gav skriptet `unknown_user`. Testpersonen återställdes till Aktiv/Styrelse. Endast den nya testkopians fil-ID är nu aktivt i dataskriptets privata testkonfiguration; den tidigare EKO-kopian har inte ändrats eller raderats. Detta bevisar ett användbart testspår, **inte** att den lokala appen är ansluten, att ett separat okänt Google-konto har provats färdigt eller att lösningen är säker för verkliga uppgifter.
- **Uppdaterad appstatus 2026-10-12:** Den lokala appen är nu ansluten till den privata EKO-testkopian genom ägarens dataskript. VF-kontot fick den begränsade styrelseöversikten; ett andra riktigt Google-konto nekades vid appinloggningen. Ett levande rollbyte Styrelse → Medlem visade att serverns aktuella roll slog igenom efter sidomladdning. Ett upptäckt gränssnittsfel med tidigare hämtade styrelsesummor rättades: vid nytt öppnande av vyn töms det gamla svaret och rollen kontrolleras igen, vilket provades mot testkopian utan sidomladdning. Ett automatiskt prov visade HTTP 403 för ett direkt styrelseanrop efter rollbyte i samma session. Därefter gav ett direkt liveanrop från samma inloggade VF-session mot Sheets-testkopian HTTP 200 med rollen Styrelse och HTTP 403 när samma testpost ändrades till Medlem. Endast HTTP-status visades i provet; inga ekonomisvar skrevs ut. Provkoden togs bort och testposten återställdes till Aktiv/Styrelse. Detta är fortsatt en lokal testapp med låtsasdata, inte godkänd för riktiga uppgifter eller publicering.
- **Publicerad appvy 2026-10-12:** Enbart det granskade, statiska gränssnittet finns nu på GitHub Pages från `vagfolk/vf-app`, `main`. Startsidan öppnar instrumentpanelen. Den publika vyn har ingen inloggning eller EKO-anslutning och visar tydligt att medlemsstatus och ekonomi saknas. En öppning av ”Min avgift” på den publicerade sidan gav ”Status saknas”, utan EKO-uppgifter. Detta är inte en publicering av den lokala skyddade appservern och ändrar inte kravet på verifierad behörighet före riktiga uppgifter.
- **Google-skyddad testpanel 2026-10-13:** GitHub-startsidan har ändrats till en tydlig länk till den befintliga Apps Script-webbappen; den statiska instrumentpanelen finns kvar som separat designförhandsvisning. Den inloggade testpanelen kör som besökaren, hämtar visningskod från en låst GitHub-commit och kontrollerar filens SHA-256 före visning. Identitetsskriptet lämnar bara ut begränsad profil, egen avgiftsstatus och styrelseöversikt efter dataskriptets kontroll mot den privata EKO-testkopian. I både utvecklingsversion och publicerad testversion visade VF-kontot testperson, betald avgift och styrelsesummor med enbart låtsasdata. Automatproven omfattar nekad styrelseöversikt för medlem och nekad profil för okänd användare. Ett andra riktigt konto har **inte** prövats mot just denna publicerade Google-vy; ingen del är godkänd för riktiga medlems- eller ekonomidata.
- **Tidig åtkomstkontroll 2026-10-13:** Ett andra riktigt Google-konto öppnade först den publicerade instrumentpanelens tomma skal men såg inga föreningsuppgifter; sidan visade ”Kontot har inte tillgång till föreningen”. Identitetsskriptet ändrades därefter så att EKO-testkopians profilkontroll körs innan någon HTML för instrumentpanelen lämnas ut. Okänt eller inaktivt konto får en separat sida med ”Ingen åtkomst”; vid kontrollfel stängs åtkomsten också. Version 14 är publicerad på samma testlänk. Alla 18 lokala prov för den privata läskedjan passerade. VF-kontot öppnade fortfarande den publicerade testpanelen, och användaren provade det andra kontot i inkognito och rapporterade att ”Ingen åtkomst” visades. Vanliga Chrome visade tidigare ”Det går inte att öppna filen just nu”, medan inkognito fungerade; orsaken är inte fastställd. Inga riktiga uppgifter får användas på dessa prov.
- **Chrome-kontoprov 2026-10-13:** I användarens vanliga Chrome-session var både `fl.linkan@gmail.com` och `vag26folk@gmail.com` inloggade hos Google. Den skyddade testlänken gav där ”Det går inte att öppna filen just nu”. Med endast `fl.linkan@gmail.com` i en separat Chrome-session öppnades samma länk och visade korrekt ”Ingen åtkomst”. Detta talar starkt för Googles dokumenterade begränsning för Apps Script-webbappar vid flera samtidiga Google-konton i samma session, snarare än ett allmänt fel i appen eller testfilen. En egen Chrome-profil per Google-konto är en möjlig praktisk lösning utan utloggning; det är inte ett beslut om ändrad apparkitektur. Felet i den blandade sessionen är inte åtgärdat i appkoden.
- **Rollstyrda testvyer 2026-10-13:** Startsidan visar bara genvägar som den aktuella profilen tillåter. När en skyddad vy öppnas prövas den aktuella rollen på serversidan mot EKO-testkopian innan vyn visas. Styrelsens ekonomiska data har dessutom en separat kontroll vid själva dataanropet. Lokala automatprov täcker rollbyte, nekad åtkomst och avstängt konto; den publicerade Google-testpanelen version 15 öppnades med VF-kontot och visade styrelseöversikt med låtsasdata. De övriga rollvyerna är ännu bara tomma förberedelser, och någon livekontroll av dessa med flera riktiga konton är inte gjord. Detta är inte ett klartecken för riktiga uppgifter.
- **Kalenderarbete 2026-10-13:** VF-kontot har två olika Google-kalendrar för medlemmar respektive styrelse; användaren har förtydligat att alla nuvarande händelser är testuppgifter. Styrelsekalendern var inställd på offentlig visning av händelsedetaljer och har gjorts privat; medlemskalenderns delning är oförändrad. Kalender-ID:n ligger i privata Script Properties. Kalenderläsning med serverkontrollerad EKO-roll är publicerad i den skyddade testappen. Vid ett levande prov mot Google Calendar API syntes en påhittad styrelsehändelse för rollen Styrelse. När samma testkonto tillfälligt ändrades till Medlem i EKO visades inte styrelsehändelsen, medan en medlemshändelse var synlig. Rollen återställdes till Styrelse och styrelsehändelsen visades åter. Testhändelsen ligger kvar i styrelsekalendern och är tydligt märkt TEST. Detta är ett lyckat prov av just kalenderns rollgräns med låtsasdata, inte ett godkännande för riktiga uppgifter eller hela appens säkerhet.
- **Kalendervy 2026-10-14:** Den skyddade testappen visar nu Google-kalenderhändelser direkt, uppdelade efter roll. För VF-kontot med styrelseroll syntes båda kalendrarna och två små Google-länkar. Kalendervyn visade kommande oktoberhändelser, medan ”Nästa möte” samtidigt visade ett medlemsmöte i november och ett styrelsemöte i oktober. Detta är ett levande prov med låtsasdata. Medlemsrollens nya gränssnitt och styrelsekontons faktiska redigeringsrätt i Google har inte provats i denna version; Google Kalender-behörigheter måste tilldelas separat.
- **Stabilare dokumentstart 2026-10-21:** Den befintliga skyddade testlänken uppdaterades till identitetsskriptets version 48. Skriptet hämtar appvyn från GitHub-commit `d835630` och kontrollerar dess SHA-256 före visning. Ett tillfälligt fel när dokumentlistan hämtas stoppar nu inte hela appinloggningen: Dokument visar ett fel med möjlighet att försöka igen, medan nekad behörighet fortfarande stoppar åtkomsten. Alla 98 lokala automatprov passerade. Ett levande prov med VF-kontot och styrelseroll visade Start efter startsekvensen och både medlems- och styrelsedokument i Dokument. Det avsiktliga dokumentfelet har endast simulerats i automatprov, inte framkallats i Google-testappen. Detta gäller fortsatt bara påhittade uppgifter och är inte ett godkännande för riktiga medlemsdata.
- **Kassans första liveprov 2026-10-22:** Kassavyn och de privata kassafunktionerna är publicerade i den skyddade testappen. Dataskriptet skapar en egen mapp `Försäljningskassor` under VF-app:s befintliga Drive-huvudmapp; detta kräver att den privata inställningen `VF_TEST_APP_ROOT_FOLDER_ID` pekar på huvudmappen. Med VF-testkontot öppnades kassa `K-2026-0001` med 100 kr växelkassa, och ett kontantköp av en testvara för 10 kr registrerades med mottagna 20 kr och 10 kr växel. Kassan avslutades med räknade 110 kr. Testkontots EKO-roll ändrades tillfälligt från Styrelse till Kassör för granskningen; inga avvikelser fanns, och godkännandet skapade en enda kontant inkomstpost i `Kassabok!A14:G14` med kategorin Försäljning, belopp 10 kr och kassa-referens. Rollen återställdes till Styrelse. 29 riktade lokala kassaprov passerade. Detta verifierar ett kontantflöde mot **testkopian**, inte offlineförsäljning, makulering, avbrott, Swish, samtidiga kassor eller fullständig exakt-en-gång-säkerhet i verklig drift. Swish är fortsatt avstängt utan föreningens riktiga nummer och kassören ska bokföra varje faktiskt mottagen Swishbetalning manuellt i EKO.
- **Offlinekö och återhämtning 2026-10-22:** Identitetsskriptets testpublicering version 51 innehåller en kassaklient som inte visar ett köp som sparat förrän lokal IndexedDB-lagring har slutförts. Vid tillfälligt serversvarsfel ligger samma händelse-ID kvar i kön och synken försöker igen efter 15 sekunder medan kassavyn är aktiv; den försöker också när anslutningen återkommer eller vyn blir aktiv igen. Klienten hämtar senaste serverstatus före fortsatt arbete om en kassa har ändrats på annat håll. Tre riktade simulerade klientprov passerade: misslyckad lokal lagring, förlorat svar utan dubbelköp och återhämtning av ett lokalt köp efter att styrelsen avbrutit kassan. Den publicerade kassasidan öppnades med VF-kontot och visade den befintliga testkassan. Ett verkligt nätavbrott i Googles webbapp och återöppning av appen utan nät har **inte** provats; Apps Script-ingången är ännu inte en installerbar offlineapp. Detta är därför inte ett godkännande för verklig offlineförsäljning.
- **Avgränsat GitHub-prov 2026-10-22/23:** Ett separat appskal utan köp- eller EKO-data finns på GitHub Pages under `public/offline-cash/`. Identitetsskriptets version 53 innehåller en särskild inbäddad testsida som kontrollerar `sales_manage` med den befintliga privata EKO-kedjan och skickar enbart ett ja/nej-svar till den exakta GitHub-origin som godkänts i koden. Med VF-kontot och styrelseroll visade den publicerade GitHub-sidan att Google bekräftade kassabehörigheten. Två lokala prov verifierar att fel origin/kopplingskod inte startar kontrollen och att profilsvar inte förs vidare. Ett andra riktigt konto har provats via denna GitHub-koppling men fick ännu inget uttryckligt rollbesked; se nästa punkt. I Codex inbyggda webbläsare gick ett lokalt offlineprov till webbläsarens eget anslutningsfel; ett senare kodprov upptäckte och rättade dessutom att service workern var bunden till GitHub-sökvägen. Två nya lokala prov verifierar cachebeteendet för GitHub- och lokal sökväg. **Användaren öppnade GitHub-provsidan i vanlig Chrome, kopplade från internet och rapporterade att sidan fortfarande visades efter omladdning.** Det verifierar offlineöppning av det statiska appskalet, inte offlineåtkomst till kassadata. Faktiskt köp under nätavbrott, återanslutning och synk via GitHub-sidan är ännu inte verifierade. Flytta inte den riktiga kassavyn eller använd riktiga data förrän dessa prov och behörighetsgränsen är klara.
- **Fortsatt behörighetsprov 2026-10-23:** Ett separat Chrome-konto utan VF-åtkomst (`fl.linkan`) fick ingen kassadata på GitHub-provsidan, men Google-ramen gav inget uttryckligt rollbesked och sidan nådde sin tidsgräns. Identitetsskriptets version 54 flyttade den inbäddade testvägen före den vanliga profilspärren; VF-kontots positiva prov fungerade fortsatt, medan det andra kontot fortfarande fick tidsgräns. Detta visar att åtkomsten **stängs vid uteblivet svar**, men det är inte ett verifierat EKO-rollavslag genom just den inbäddade vägen. Provsidans text säger nu tydligt ”Ingen åtkomst” om Google inte bekräftar behörigheten. Den befintliga kassavyn kan fortsätta arbeta offline när den redan är öppen, men dess start hämtar först identitet och kassalista från Google; därför kan den inte säkert visa lokalt sparade kassor efter en helt ny offlineöppning. **Förslag att utreda:** låt den redan inloggade, överordnade Google-appvyn förmedla kassaanrop till ett separat GitHub-fönster; då behöver kassasidan inte förlita sig på en inbäddad Google-ram. Detta är ännu inte byggt eller provat. Kravet att en öppnad kassa ska kunna fortsätta och avslutas offline gäller fortfarande.
- **Fristående kassafönster 2026-10-27:** Förslaget ovan har nu byggts som en separat kandidat utan att ersätta den befintliga kassaknappen på styrelsens Start. Google-skriptets version 56 öppnar `public/cash/` på GitHub Pages och förmedlar kassaanrop genom det redan inloggade Google-fönstret. Den privata servern kontrollerar fortfarande EKO-roll och förening vid varje åtgärd. VF-kontot fick ett positivt livebesked, och den fristående kassan läste både kassalistan och en tidigare testlogg via Google. En direktöppnad GitHub-sida utan Google-fönstret visade ingen kassadata. Användaren öppnade samma Google-ingång med ett separat konto utan VF-åtkomst och fick ”Ingen åtkomst” innan kassaknappen visades. Lokala automatprov täcker fönster, origin, engångskod och att nekad roll inte skickar vidare kassaåtgärder. **Köp eller annan skrivning, nätavbrott och senare synk har ännu inte provats i den fristående kandidaten.** Den är därför inte klar för riktiga uppgifter eller som ersättning för den befintliga kassavyn.
- **Fördjupat kassaprov 2026-10-27:** Ett automatiserat webbläsarprov med påhittad Google-server och simulerat nätavbrott visade att ett lokalt köp kunde synkas exakt en gång efter återanslutning. Detta prov skrev inte till EKO. Kassafönstret accepterar nu endast den observerade VF Apps Script-origin som föräldrafönster; direktöppning eller annan origin nekas. Identitetsskriptets version 57 pekar på den uppdaterade kassasidan. Med VF-kontot bekräftades behörighet i den publicerade Google-vyn och den fristående GitHub-vyn läste den befintliga kassalistan. Den ordinarie kassaknappen är ännu inte omkopplad.
- **Verkligt offlinekö 2026-10-27:** Användaren öppnade kassa `K-2026-0002` i vanlig Chrome med VF-kontot, registrerade ett kontantköp på 10 kr utan nät och såg ”Synkad” efter återanslutning. En separat läsning genom den publicerade Google-kopplingen visade exakt ett sådant köp i kassans serverlogg. Det visar synk av köp till kassaloggen; kassan är fortfarande öppen. Offlineavslut, kassörsgranskning och EKO-bokföring har inte provats i denna kedja. Användaren rapporterade också att en ny provvara inte följde med, samt att köp-ID störde den vanliga köplistan. Kassavyn har därför fått tydligare återkoppling vid varutillägg, tar med en ifylld vara vid öppning och döljer köp-ID i försäljningsvyn; ID finns kvar i den spårbara loggen. Dessa UI-ändringar behöver publiceras och kontrolleras separat.
- Hur VF:s första installation, Google-behörigheter och säker återställning genomförs säkert utan nya betalda tjänster. Ett återanvändbart installationsflöde för andra föreningar är uttryckligen uppskjutet tills VF-versionen fungerar och har utvärderats.
- Hur EKO i Google Sheets färdigställs och jämförs mot Excel-förlagans funktioner, särskilt bokslut/årsskifte. Ingen automatisk Excel–Sheets-synk är beslutad.
- Hur försäljningsgodkännande, offlinekö, separat logg och säker exakt-en-gång-överföring till EKO fungerar i verklig drift. Nuvarande test använder låtsasdata.
