# House Rules Manager (dnd5e)

Modulo Foundry VTT (v14+, `dnd5e` richiesto) che centralizza le house rules delle campagne: ogni
house rule vive nel proprio file, si attiva/disattiva da un'app dedicata ("House Rules Manager",
raggiungibile da **Configure Settings**) o dalle impostazioni del modulo, e resta isolata dal resto
del codice.

## Installazione

In Foundry, **Add-on Modules > Install Module**, incolla il manifest:

```
https://github.com/FabioC-88/dnd5e-house-rules/releases/latest/download/module.json
```

Poi attiva il modulo nel mondo (richiede il sistema `dnd5e`).

## House rules disponibili

- **Esaurimento dopo un K.O.** (`exhaustion-on-drop`, disattivata di default) — un PG che finisce a
  0 PF guadagna un livello di esaurimento **nel momento in cui viene curato e torna sopra 0 PF**, non
  appena cade: l'esaurimento è il prezzo di essere rimessi in piedi. Nessun tetto per riposo (più K.O.
  nello stesso combattimento = più livelli, uno per ogni volta che il PG viene tirato su); chi resta a
  0 PF e non viene mai curato non guadagna nulla. Vale solo per i PG, non per PNG/alleati.
- **Controllo Morale** (`morale-check`, disattivata di default) — aggiunge uno status "Capo" da
  attivare sui token dal Token HUD (come Prone/Poisoned) e, quando un PNG scende a metà PF o un token
  marcato "Capo" cade, un messaggio privato al DM con tre pulsanti diretti (Normale / Svantaggio /
  Fallimento automatico) che tirano il TS Saggezza CD 10 per quello specifico PNG con un clic — la
  fuga/resa resta sempre una tua decisione, il modulo non muove né fa agire i token al posto tuo. Per
  controlli morale non legati a una soglia PF (es. mirati/selezionati a piacimento), crea una macro con:
  ```js
  game.modules.get("dnd5e-house-rules").api.rollMoraleCheck();
  // oppure, con svantaggio o fallimento automatico ("forze soverchianti"):
  game.modules.get("dnd5e-house-rules").api.rollMoraleCheck({ mode: "disadvantage" });
  game.modules.get("dnd5e-house-rules").api.rollMoraleCheck({ mode: "autoFail" });
  ```
- **Menomazione invece della morte per danno massiccio** (`lingering-injury-on-massive-damage`,
  disattivata di default) — quando un colpo porterebbe un PG a morte istantanea per la regola del
  Danno Massiccio del DMG (che dnd5e non automatizza), il modulo lo rileva e applica invece una
  menomazione permanente casuale (Effetto Attivo sull'attore) — il personaggio sopravvive, gravemente
  ferito. Solo per i PG. **La penalità è automatizzata**: l'effetto porta con sé i `changes` che
  dnd5e applica da solo (svantaggio, malus ai tiri per colpire, velocità, PF massimi, caratteristiche).

  | Menomazione | Penalità meccanica |
  |---|---|
  | Costola Incrinata | svantaggio alle prove di Forza |
  | Tendine Lacerato | velocità −5 ft e −1 ai tiri per colpire in mischia |
  | Occhio Ferito | svantaggio a Percezione e −2 ai tiri per colpire a distanza |
  | Trauma Cranico | svantaggio a concentrazione e iniziativa |
  | Cicatrice Profonda | −3 PF massimi |
  | Nervo Danneggiato | svantaggio alle prove di Destrezza |
  | Costituzione Minata | −1 a Costituzione |
  | Fiato Corto | velocità −5 ft e svantaggio alle prove di Costituzione |

  Nomi e descrizioni stanno in `lang/{en,it}.json` sotto `rules.lingeringInjury.table`, i `changes`
  nella costante `INJURIES` in cima a `houserules/lingering-injury-on-massive-damage/index.js`: per
  cambiare la durezza di una menomazione si tocca solo quella tabella. Nei mondi che misurano in
  metri la penalità alla velocità diventa 1,5 m invece di 5 ft. L'effetto resta finché non lo rimuovi
  a mano (nessuna scadenza automatica).
- **Le ferite non guariscono da sole** (`slow-natural-healing`, disattivata di default) — col riposo
  lungo **non** si recuperano PF in automatico: si torna su solo spendendo Dadi Vita (la variante
  "Slow Natural Healing" del DMG). Tutto il resto del riposo è invariato: Dadi Vita, slot, poteri e
  il livello di esaurimento in meno. Vale per tutti gli attori, PNG compresi. Il dialogo del riposo
  lungo guadagna una spunta opzionale **"Spendi Dadi Vita a riposo finito"**, che tira i dadi *dopo*
  che il riposo li ha restituiti — l'ordine conta: con le regole 2024 il riposo lungo ridà **tutti**
  i dadi spesi, quindi spenderli prima significherebbe farseli rimborsare e curarsi a costo zero.
  Per dosarli uno alla volta c'è l'app Dadi Vita della scheda, che dnd5e ha già di suo.

Il **riposo lento** (riposo lungo 7 giorni / riposo breve 8 ore, variante "Gritty Realism") **non**
è gestito da questo modulo: è un'opzione nativa del sistema dnd5e, si attiva direttamente da
**Configure Settings → dnd5e → Rules**.

Anche **"il riposo lungo conta solo in un luogo sicuro"** non è gestita dal modulo: Foundry non ha
modo di sapere se il party è al sicuro, resta una valutazione del DM al tavolo (utile in
abbinamento a Gritty Realism, per evitare che il party si accampi una settimana ovunque pur di
recuperare).

## Aggiungere una nuova house rule

1. Copia `houserules/_example/` in una nuova cartella, es. `houserules/flanking/`.
2. Nel nuovo `index.js`, cambia `id`, `titleKey`, `hintKey`, `default`, e implementa:
   - `register(moduleId)` — registra il toggle on/off (`game.settings.register`).
   - `onReady(moduleId)` — se il toggle è attivo, aggancia gli hook/API di `dnd5e` necessari
     (es. `Hooks.on("dnd5e.preRollAttack", ...)`, `CONFIG.DND5E`, ecc.).
3. Aggiungi le chiavi di traduzione usate da `titleKey`/`hintKey` in `lang/en.json` e `lang/it.json`.
4. Importa e registra la nuova regola in `houserules/index.js`:
   ```js
   import flanking from "./flanking/index.js";
   export const HOUSE_RULES = [exampleRule, flanking];
   ```

Non serve nessun bundler: Foundry carica i moduli ES direttamente, quindi il registro in
`houserules/index.js` è l'unico punto da aggiornare per collegare una nuova cartella.

## Struttura

```
module.json                     manifest Foundry
scripts/main.js                 hook "init"/"ready": registra tutte le house rules
scripts/house-rules-manager.js  app Settings Menu con i toggle
houserules/<nome>/index.js      una house rule per cartella (vedi _example/ come template)
lang/{en,it}.json               traduzioni
templates/house-rules-manager.hbs  markup dell'app Settings Menu
styles/house-rules.css          stile minimo dell'app
```

## Release

Ogni push di un tag `v*` (es. `v0.2.0`) fa partire `.github/workflows/release.yml`, che:
1. aggiorna `version` e `download` in `module.json` in base al tag;
2. committa `module.json` su `main`;
3. crea lo zip del pacchetto;
4. pubblica una GitHub Release con `module.json` e lo zip allegati, pronti per il manifest URL
   sopra.
