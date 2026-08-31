/**
 * The DMG's own "Lingering Injuries" d20 table (2014 core rules, p. 272), weighted the same way:
 * eye/limb/leg/hobbled at 1 in 20 each, internal injury/broken ribs/horrible scar at 3 in 20 each,
 * festering wound at 3 in 20, minor scar at 4 in 20 - 20 total.
 *
 * Only the part of each injury that maps to a real dnd5e data field is automated as Active Effect
 * changes; everything else (a repeated saving throw each turn, HP max decaying over real time, "only
 * one item in hand") is described in the effect and the chat announcement for the table to apply by
 * hand - dnd5e has no persistent field an effect can target for those, only for the numeric ones:
 *  - "<path>.roll.mode" is an AdvantageModeField: adding -1/+1 registers one source of
 *    disadvantage/advantage (system.skills.<skl>.roll.mode here)
 *  - system.attributes.movement.walk is a FormulaField: ADD appends to the formula, MULTIPLY wraps
 *    it and multiplies - both are strings, not attack-roll advantage, which dnd5e never stores on
 *    the actor at all (it's resolved at roll time), so "disadvantage on ranged attacks" (Lose an Eye)
 *    stays text-only rather than being widened into something the book doesn't say.
 * SPEED is a placeholder resolved per actor, so a world using metres does not get a -5 metre leg.
 */
const SPEED = "@speedPenalty";
const INJURIES = {
  eye: { weight: 1, changes: [["system.skills.prc.roll.mode", "add", -1]] },
  limb: { weight: 1, changes: [] },
  leg: { weight: 1, changes: [["system.attributes.movement.walk", "multiply", "0.5"]] },
  hobbled: { weight: 1, changes: [["system.attributes.movement.walk", "add", SPEED]] },
  internalInjury: { weight: 3, changes: [] },
  brokenRibs: { weight: 3, changes: [] },
  horribleScar: {
    weight: 3,
    changes: [
      ["system.skills.per.roll.mode", "add", -1],
      ["system.skills.itm.roll.mode", "add", 1]
    ]
  },
  festeringWound: { weight: 3, changes: [] },
  minorScar: { weight: 4, changes: [] }
};
// One entry per point of weight, e.g. ["eye", "limb", "leg", "hobbled", "internalInjury",
// "internalInjury", "internalInjury", ...] - 20 entries total, same odds as rolling the book's d20.
const INJURY_POOL = Object.entries(INJURIES).flatMap(([id, { weight }]) => Array(weight).fill(id));

/**
 * DMG "Massive Damage" (a hit that drops a character to 0 HP with leftover damage >= their HP max
 * kills them instantly) is core rules text but dnd5e does not automate it - nothing in the system
 * currently checks for it, it is left to the table to notice and rule on. This house rule automates
 * the detection and, per the DMG's own suggested pairing, rolls on its Lingering Injuries table
 * instead of applying instant death: the character survives, grievously wounded, and carries the
 * wound as a permanent Active Effect with whatever part of the penalty dnd5e can enforce on its own.
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

/**
 * Five feet, or a metre and a half where the world measures distance in metres: dnd5e stores
 * movement as a formula string, so the change is appended to the actor's own speed and evaluated.
 * @param {Actor5e} actor
 * @returns {string}
 */
function speedPenalty(actor) {
  const units = actor.system.attributes.movement?.units ?? "ft";
  return ["m", "km"].includes(units) ? " - 1.5" : " - 5";
}

async function applyLingeringInjury(actor, moduleId) {
  const injuryId = INJURY_POOL[Math.floor(Math.random() * INJURY_POOL.length)];
  const key = `DND5E_HOUSE_RULES.rules.lingeringInjury.table.${injuryId}`;
  const name = game.i18n.localize(`${key}.name`);
  const description = game.i18n.localize(`${key}.description`);
  const mechanic = game.i18n.localize(`${key}.mechanic`);

  const modes = { add: CONST.ACTIVE_EFFECT_MODES.ADD, multiply: CONST.ACTIVE_EFFECT_MODES.MULTIPLY };
  const changes = INJURIES[injuryId].changes.map(([changeKey, mode, value]) => ({
    key: changeKey,
    mode: modes[mode],
    value: value === SPEED ? speedPenalty(actor) : value
  }));

  // The automated part (if any) is enforced by dnd5e; the rest of the injury never expires on its
  // own and is on the table to track - remove the effect from the Active Effects tab once healed.
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name,
    img: "icons/svg/aura.svg", // dnd5e's own default icon for actor-owned Active Effects
    description: `<p>${description}</p><p><strong>${mechanic}</strong></p>`,
    changes,
    origin: actor.uuid,
    flags: { [moduleId]: { lingeringInjury: injuryId } }
  }]);

  ChatMessage.create({
    content: `<p>${game.i18n.format("DND5E_HOUSE_RULES.rules.lingeringInjury.announcement", {
      name: actor.name,
      injury: name
    })}</p><p><em>${mechanic}</em></p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}
