# Dino Run

Corsa infinita sui binari della giungla, nella famiglia di Subway Surfers.
Canvas, senza librerie né risorse esterne.

- **Tre binari** con vagoni lunghi da schivare, vagoni con la **rampa** su cui
  salire e correre sopra, vagoni che vengono incontro (solo Grande), tronchi
  da saltare, rami sotto cui rotolare, massi.
- **File e archi di frutti** che mostrano la strada; ogni frutto conta.
- **Power-up**: calamita (i frutti vengono da te), molla (salti altissimi,
  anche sopra i vagoni), pterodattilo (voli sopra tutto e prendi i frutti in
  cielo).
- Tre cuori; un urto dà 2,2 secondi di protezione e rallenta un attimo. Quando
  manca un cuore, sul percorso ne compare uno. La velocità sale per circa 80
  secondi.
- **Piccolo** (3 anni): più lento, niente vagoni in arrivo, e in ogni tratto c'è
  sempre un binario libero: basta cambiare binario, saltare e rotolare non
  servono mai. **Grande** (6 anni): più veloce, tratti in cui bisogna saltare,
  rotolare o salire sulla rampa.

Comandi: scorri col dito (sinistra/destra, su per saltare, giù per rotolare)
oppure tocca la metà sinistra o destra dello schermo. Su PC frecce o WASD,
spazio per saltare, Esc per la pausa.

```
node build.js
node test/smoke.js         # ~2 minuti: un bot corre due minuti per età senza un urto
node test/smoke.js quick   # solo le regole
node test/look.js          # Chrome vero, muto: fotogrammi in test/frames e tocchi reali
```

Il collaudo lungo esiste perché ogni tratto (in `PATTERNS`, dentro
`src/10-run.js`) deve avere una via d'uscita anche specchiato e concatenato
alla velocità massima; per il Piccolo il bot può soltanto cambiare binario.
