# Dino Run

Gioco canvas per bambini, senza librerie o risorse esterne. Tre corsie,
tronchi da saltare, rami sotto cui passare e massi da evitare. Ogni fila
ha almeno una corsia libera. Tre cuori; dopo un urto ci sono 2,8 secondi
di protezione. A zero cuori si può riprovare subito.

Il profilo Piccolo corre più lentamente e incontra ostacoli più distanziati.
La corsa parte subito vivace e raggiunge la velocità massima in 55 secondi;
la prima fila è sempre di frutti, così si entra nel ritmo senza un urto
immediato. Le vite hanno un riquadro dedicato in alto e i cuori pulsano dopo
un impatto.
Ogni dodici file arriva una sosta al tempio: riconoscere il simbolo permette
di recuperare un cuore. Nessun timer durante questa scelta.

Comandi: pulsanti grandi o swipe; su PC frecce, spazio per saltare, Esc
per la pausa. Cambiare scheda mette il gioco in pausa.

L'accesso segue Dino Giungla: nome, dinosauro colorato, età e tre figure
facoltative. Profili e record locali separati; nessun account online.

```
node build.js
node test/smoke.js
```

Servire la cartella con un server HTTP. Per tutta la collezione:
`node ../dino-giungla/tools/serve-collection.js`, poi http://localhost:8088.
Per installare la PWA e usare la cache offline serve HTTPS o localhost.
