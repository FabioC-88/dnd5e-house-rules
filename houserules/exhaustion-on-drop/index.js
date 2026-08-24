const MAX_EXHAUSTION = 6;

/**
 * Every time a player character drops to 0 HP, they gain one level of exhaustion.
 * No cap per rest: repeated knockdowns in the same fight/day each add a level, on purpose
 * (brutal, realistic tone for Shadow of the Dragon Queen). NPCs/allies are not affected.
 */
export default {
  id: "exhaustion-on-drop",
  titleKey: "DND5E_HOUSE_RULES.rules.exhaustionOnDrop.title",
  hintKey: "DND5E_HOUSE_RULES.rules.exhaustionOnDrop.hint",
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

    Hooks.on("preUpdateActor", (actor, changes, _options, _userId) => {
      if (!game.user.isGM) return;
      if (actor.type !== "character") return;

      const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
      if (newHp === undefined) return;

      const oldHp = actor.system.attributes.hp.value;
      if (oldHp <= 0 || newHp > 0) return;

      const currentExhaustion = actor.system.attributes.exhaustion ?? 0;
      const nextExhaustion = Math.min(currentExhaustion + 1, MAX_EXHAUSTION);
      foundry.utils.setProperty(changes, "system.attributes.exhaustion", nextExhaustion);
    });
  }
};
