const INJURY_IDS = ["rib", "tendon", "eye", "head", "scar", "nerve", "constitution", "breath"];

/**
 * DMG "Massive Damage" (a hit that drops a character to 0 HP with leftover damage >= their HP max
 * kills them instantly) is core rules text but dnd5e does not automate it - nothing in the system
 * currently checks for it, it is left to the table to notice and rule on. This house rule automates
 * the detection and, per the DMG's own suggested pairing, replaces the instant death with a rolled
 * Lingering Injury instead: the character survives, grievously wounded.
 *
 * Player characters only (mirrors exhaustion-on-drop). The trigger is a single hit whose overflow
 * damage alone would equal/exceed max HP - much rarer than "any knockout to 0 HP", so this stacks
 * with exhaustion-on-drop intentionally on that one worst-case hit, not on every K.O.
 */
export default {
  id: "lingering-injury-on-massive-damage",
  titleKey: "DND5E_HOUSE_RULES.rules.lingeringInjury.title",
  hintKey: "DND5E_HOUSE_RULES.rules.lingeringInjury.hint",
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

    Hooks.on("dnd5e.preApplyDamage", (actor, amount, _updates, _options) => {
      if (!game.user.isGM) return;
      if (actor.type !== "character") return;

      const hp = actor.system.attributes.hp;
      const buffer = hp.value + hp.temp; // temp HP and remaining HP absorb damage before the "remainder"
      if (amount <= buffer) return;

      const overflow = amount - buffer;
      if (overflow < hp.max) return;

      applyLingeringInjury(actor, moduleId);
    });
  }
};

async function applyLingeringInjury(actor, moduleId) {
  const injuryId = INJURY_IDS[Math.floor(Math.random() * INJURY_IDS.length)];
  const name = game.i18n.localize(`DND5E_HOUSE_RULES.rules.lingeringInjury.table.${injuryId}.name`);
  const description = game.i18n.localize(`DND5E_HOUSE_RULES.rules.lingeringInjury.table.${injuryId}.description`);

  // A plain marker effect: no automated mechanical changes, so the GM interprets/enforces it at the
  // table and removes it manually (via the Active Effects tab) whenever it's narratively resolved.
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name,
    img: "icons/svg/blood.svg", // swap for a custom icon if this one doesn't fit
    description,
    origin: actor.uuid,
    flags: { [moduleId]: { lingeringInjury: injuryId } }
  }]);

  ChatMessage.create({
    content: game.i18n.format("DND5E_HOUSE_RULES.rules.lingeringInjury.announcement", {
      name: actor.name,
      injury: name
    }),
    speaker: ChatMessage.getSpeaker({ actor })
  });
}
