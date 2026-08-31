const MAX_EXHAUSTION = 6;

/**
 * Being knocked out costs a player character one level of exhaustion - but the level lands when
 * they are put back on their feet, not the instant they drop: the exhaustion is the price of being
 * dragged back from 0 HP, so it is applied on the update that heals them above 0 HP.
 *
 * No cap per rest: repeated knockdowns in the same fight/day each add a level, on purpose (brutal,
 * realistic tone for Shadow of the Dragon Queen) - one for every time the character is brought back
 * up. A character who is never healed above 0 HP never gains the level. NPCs/allies are not affected.
 *
 * The setting id stays "exhaustion-on-drop" so worlds that already enabled this rule keep it on
 * across the update (the settings key is what Foundry persists, not the folder or the title).
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

    // No isGM guard here: healing a downed ally is very often applied by a player (the cleric's own
    // chat card, or the downed player clicking the heal on their own token), and this hook must not
    // silently skip those. preUpdate hooks only run on the client that initiates the update, so the
    // level is still counted exactly once, and that client already has permission to write the actor.
    Hooks.on("preUpdateActor", (actor, changes, _options, _userId) => {
      if (actor.type !== "character") return;

      const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
      if (newHp === undefined) return;

      const oldHp = actor.system.attributes.hp.value;
      // The way back up is the trigger: down at 0 HP, and this update brings them above 0.
      if (oldHp > 0 || newHp <= 0) return;

      // The same update may already be changing exhaustion - a long rest restores HP and removes a
      // level in one go - so build on the pending value instead of clobbering it (a long rest taken
      // from 0 HP then nets out: the rest's -1 and this rule's +1 cancel).
      const currentExhaustion = foundry.utils.getProperty(changes, "system.attributes.exhaustion")
        ?? actor.system.attributes.exhaustion
        ?? 0;
      const nextExhaustion = Math.min(currentExhaustion + 1, MAX_EXHAUSTION);
      foundry.utils.setProperty(changes, "system.attributes.exhaustion", nextExhaustion);
    });
  }
};
