/**
 * DMG "Slow Natural Healing": a long rest no longer puts hit points back on its own - the only way
 * up is spending Hit Dice. Unlike Gritty Realism this has no native setting, but dnd5e reads the
 * flag straight off CONFIG while building the rest result (Actor5e#_getRestHitPointRecovery), so
 * turning it off there is the whole rule. The rest chat card stays honest by itself: with no hit
 * points restored it reports "regains N Hit Dice" instead of "regains 0 hit points".
 *
 * Everything else about a long rest is untouched: Hit Dice, spell slots, item uses, and the level of
 * exhaustion it removes. Applies to every actor, not just player characters - it is a rule of the
 * world, not a penalty aimed at the party.
 */
export default {
  id: "slow-natural-healing",
  titleKey: "DND5E_HOUSE_RULES.rules.slowNaturalHealing.title",
  hintKey: "DND5E_HOUSE_RULES.rules.slowNaturalHealing.hint",
  default: false,

  register(moduleId) {
    game.settings.register(moduleId, this.id, {
      name: this.titleKey,
      hint: this.hintKey,
      scope: "world",
      // config: false - toggled from the House Rules Manager menu, not the default Settings list
      // (same pattern dnd5e itself uses for its own variant-rule settings).
      config: false,
      type: Boolean,
      default: this.default
    });
  },

  onReady(moduleId) {
    if (!game.settings.get(moduleId, this.id)) return;

    const longRest = CONFIG.DND5E?.restTypes?.long;
    if (!longRest) {
      console.warn(`${moduleId} | slow-natural-healing: CONFIG.DND5E.restTypes.long not found, rule not applied.`);
      return;
    }

    longRest.recoverHitPoints = false;

    // _getRestHitPointRecovery is also the only place that clears temp HP and temp max at the end of
    // a long rest, and it now bails out before reaching them - so put those two back, or the dialog's
    // own "Recover Temp HP" checkboxes would be promising something that never happens.
    Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
      if (result.type !== "long") return;
      const hp = actor.system.attributes?.hp;
      if (!hp) return; // groups and anything else without hit points, same guard dnd5e uses

      if (config.recoverTemp) result.updateData["system.attributes.hp.temp"] = 0;
      if (!config.recoverTempMax) return;
      result.updateData["system.attributes.hp.tempmax"] = 0;
      // hp.max excludes tempmax (hp.effectiveMax includes it), so clearing a positive one can leave
      // the actor above their maximum. dnd5e never had to handle that: it was writing hp.value here.
      if (hp.value > hp.max) result.updateData["system.attributes.hp.value"] = hp.max;
    });

    // An opt-in "spend Hit Dice" checkbox, added to dnd5e's own long rest dialog as data rather than
    // as injected markup: BaseRestDialog turns context.fields into the form, and whatever the form
    // submits is merged into the rest config, which is handed to the rest hooks.
    //
    // Named "autoHD" on purpose, matching dnd5e's own field: Actor5e#initiateRest already runs
    // `if (config.autoHD) await this.autoSpendHitDice(...)` before recovering Hit Dice for the rest -
    // that's dnd5e's native pre-rest spend, we're only adding the checkbox the long rest dialog never
    // exposed for it (dnd5e's own long-rest.hbs has no Hit Dice section at all; short rest gets one,
    // long rest doesn't). No hook of our own needed: reusing the field name is the whole mechanism.
    const LongRestDialog = longRest.dialogClass;
    longRest.dialogClass = class LongRestDialogWithHitDice extends LongRestDialog {
      async _prepareContext(options) {
        const context = await super._prepareContext(options);
        // Under Gritty Realism a long rest is too long to prompt about a new day, so the
        // configuration section does not exist yet - the guard ShortRestDialog uses for the same
        // reason when an actor has no Hit Dice.
        if (!context.fields.length) {
          context.formSections.unshift({ legend: "DND5E.REST.Configuration", fields: context.fields });
        }
        context.fields.push({
          field: new foundry.data.fields.BooleanField({
            label: game.i18n.localize("DND5E_HOUSE_RULES.rules.slowNaturalHealing.spendLabel"),
            hint: game.i18n.localize("DND5E_HOUSE_RULES.rules.slowNaturalHealing.spendHint")
          }),
          input: context.inputs.createCheckboxInput,
          name: "autoHD",
          value: context.config.autoHD
        });
        return context;
      }
    };
  }
};
