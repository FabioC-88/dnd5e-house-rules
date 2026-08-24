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
