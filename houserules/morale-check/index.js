const LEADER_STATUS_ID = "dnd5e-house-rules-leader";

/**
 * DMG-style morale checks, DM-triggered rather than auto-resolved: the module only automates the
 * *reminder* (HP crossed half, or a token flagged as "leader" was dropped) and the *roll* (DC 10
 * Wisdom save via the manual API below) - fleeing/surrendering stays a table decision, not something
 * a script can act out for NPC tokens.
 *
 * The "leader" flag is a token status effect (toggle it on the Token HUD like Prone/Poisoned) rather
 * than a setting, since it is per-encounter, not a world-wide value.
 */
export default {
  id: "morale-check",
  titleKey: "DND5E_HOUSE_RULES.rules.moraleCheck.title",
  hintKey: "DND5E_HOUSE_RULES.rules.moraleCheck.hint",
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

    // dnd5e rebuilds CONFIG.statusEffects from CONFIG.DND5E.conditionTypes on the "i18nInit" hook,
    // which fires after "init" but before "ready" - the leader status must be added here, not in
    // onReady(), or it never makes it into the Token HUD's status list.
    if (game.settings.get(moduleId, this.id)) {
      CONFIG.DND5E.conditionTypes[LEADER_STATUS_ID] = {
        name: "DND5E_HOUSE_RULES.rules.moraleCheck.leaderStatus",
        img: "icons/svg/target.svg" // swap for a custom icon if this one doesn't fit
      };
    }
  },

  onReady(moduleId) {
    if (!game.settings.get(moduleId, this.id)) return;

    Hooks.on("preUpdateActor", (actor, changes, _options, _userId) => {
      if (!game.user.isGM) return;
      if (actor.type !== "npc") return;

      const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
      if (newHp === undefined) return;

      const hp = actor.system.attributes.hp;
      const half = hp.max / 2;
      const alreadyNotified = actor.getFlag(moduleId, "moraleHalfNotified") ?? false;

      if ((hp.value > half) && (newHp <= half) && !alreadyNotified) {
        foundry.utils.setProperty(changes, `flags.${moduleId}.moraleHalfNotified`, true);
        notifyMoraleCheck(actor, "half");
      } else if ((newHp > half) && alreadyNotified) {
        foundry.utils.setProperty(changes, `flags.${moduleId}.moraleHalfNotified`, false);
      }

      if (actor.statuses?.has(LEADER_STATUS_ID) && (hp.value > 0) && (newHp <= 0)) {
        notifyMoraleCheck(actor, "leaderDown");
      }
    });

    const houseRulesModule = game.modules.get(moduleId);
    houseRulesModule.api ??= {};
    houseRulesModule.api.rollMoraleCheck = rollMoraleCheck;
  }
};

function notifyMoraleCheck(actor, reason) {
  const key = reason === "leaderDown"
    ? "DND5E_HOUSE_RULES.rules.moraleCheck.reminderLeaderDown"
    : "DND5E_HOUSE_RULES.rules.moraleCheck.reminderHalfHp";
  ChatMessage.create({
    content: game.i18n.format(key, { name: actor.name }),
    whisper: ChatMessage.getWhisperRecipients("GM")
  });
}

/**
 * Roll a DC 10 Wisdom morale save for each targeted (or, absent targets, controlled) NPC token.
 * Meant to be called from a GM macro:
 *   game.modules.get("dnd5e-house-rules").api.rollMoraleCheck();
 *   game.modules.get("dnd5e-house-rules").api.rollMoraleCheck({ mode: "disadvantage" });
 *   game.modules.get("dnd5e-house-rules").api.rollMoraleCheck({ mode: "autoFail" });
 * @param {object} [options]
 * @param {"normal"|"disadvantage"|"autoFail"} [options.mode="normal"]
 */
async function rollMoraleCheck({ mode = "normal" } = {}) {
  const tokens = game.user.targets.size ? Array.from(game.user.targets) : canvas.tokens.controlled;
  const actors = tokens.map(t => t.actor).filter(a => a?.type === "npc");

  if (!actors.length) {
    ui.notifications.warn(game.i18n.localize("DND5E_HOUSE_RULES.rules.moraleCheck.noTargets"));
    return;
  }

  for (const actor of actors) {
    if (mode === "autoFail") {
      ChatMessage.create({
        content: game.i18n.format("DND5E_HOUSE_RULES.rules.moraleCheck.autoFail", { name: actor.name }),
        speaker: ChatMessage.getSpeaker({ actor })
      });
      continue;
    }

    await actor.rollSavingThrow(
      { ability: "wis", disadvantage: mode === "disadvantage" },
      { configure: false },
      { data: { flavor: game.i18n.format("DND5E_HOUSE_RULES.rules.moraleCheck.rollFlavor", { dc: 10 }) } }
    );
  }
}
