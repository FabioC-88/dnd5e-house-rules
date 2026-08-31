/**
 * Mechanical penalty carried by each injury, as Active Effect changes (all applied with the ADD
 * mode). Keys verified against dnd5e's own data models:
 *  - "<path>.roll.mode" is an AdvantageModeField: adding -1 registers one source of disadvantage
 *    (system.abilities.<abl>.check/save, system.skills.<skl>, attributes.init, attributes.concentration)
 *  - system.bonuses.<mwak|rwak|msak|rsak>.attack and system.attributes.hp.bonuses.overall are
 *    FormulaFields, so their values are strings that get appended to the existing formula
 *  - system.abilities.<abl>.value is a plain number
 * SPEED is a placeholder resolved per actor, so a world using metres does not get a -5 metre leg.
 */
const SPEED = "@speedPenalty";
const INJURIES = {
  rib: [["system.abilities.str.check.roll.mode", -1]],
  tendon: [
    ["system.attributes.movement.walk", SPEED],
    ["system.bonuses.mwak.attack", "-1"],
    ["system.bonuses.msak.attack", "-1"]
  ],
  eye: [
    ["system.skills.prc.roll.mode", -1],
    ["system.bonuses.rwak.attack", "-2"],
    ["system.bonuses.rsak.attack", "-2"]
  ],
  head: [
    ["system.attributes.concentration.roll.mode", -1],
    ["system.attributes.init.roll.mode", -1]
  ],
  scar: [["system.attributes.hp.bonuses.overall", "-3"]],
  nerve: [["system.abilities.dex.check.roll.mode", -1]],
  constitution: [["system.abilities.con.value", -1]],
  breath: [
    ["system.attributes.movement.walk", SPEED],
    ["system.abilities.con.check.roll.mode", -1]
  ]
};
const INJURY_IDS = Object.keys(INJURIES);

/**
 * DMG "Massive Damage" (a hit that drops a character to 0 HP with leftover damage >= their HP max
 * kills them instantly) is core rules text but dnd5e does not automate it - nothing in the system
 * currently checks for it, it is left to the table to notice and rule on. This house rule automates
 * the detection and, per the DMG's own suggested pairing, replaces the instant death with a rolled
 * Lingering Injury instead: the character survives, grievously wounded, and carries the wound as a
 * permanent Active Effect with a real mechanical penalty attached.
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
  const injuryId = INJURY_IDS[Math.floor(Math.random() * INJURY_IDS.length)];
  const key = `DND5E_HOUSE_RULES.rules.lingeringInjury.table.${injuryId}`;
  const name = game.i18n.localize(`${key}.name`);
  const description = game.i18n.localize(`${key}.description`);
  const mechanic = game.i18n.localize(`${key}.mechanic`);

  const changes = INJURIES[injuryId].map(([changeKey, value]) => ({
    key: changeKey,
    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
    value: value === SPEED ? speedPenalty(actor) : value
  }));

  // The penalty is automated, but the injury never expires on its own: remove the effect from the
  // Active Effects tab whenever it is healed narratively.
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
