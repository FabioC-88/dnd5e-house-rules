// Must be alphanumeric only: dnd5e builds this status's ActiveEffect _id by concatenating
// "dnd5e" + this id and truncating to 16 characters (utils.staticID) without stripping
// non-alphanumeric characters - a hyphen landing inside that window fails Foundry's ID
// validation (which is exactly what happened with the previous "dnd5e-house-rules-leader" id).
const LEADER_STATUS_ID = "houseRulesLeader";
const CARD_CLASS = "dnd5e-house-rules-morale-check";

/**
 * DMG-style morale checks, DM-triggered rather than auto-resolved: the module only automates the
 * *reminder* (HP crossed half, or a token flagged as "leader" was dropped) and the *roll* (DC 10
 * Wisdom save) - fleeing/surrendering stays a table decision, not something a script can act out
 * for NPC tokens.
 *
 * The reminder is a chat card with roll buttons (Normal/Disadvantage/Auto-fail) targeting the
 * specific actor that triggered it - no need to select/target it separately. The same roll logic
 * is also exposed as a macro API for ad-hoc checks not tied to an HP threshold.
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
        // Shipped in the module itself (icons/leader.svg) rather than guessing a core Foundry
        // asset path - a wrong core path renders as a blank/broken icon in the Token HUD.
        img: `modules/${moduleId}/icons/leader.svg`
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
        postMoraleCheckCard(actor, "half");
      } else if ((newHp > half) && alreadyNotified) {
        foundry.utils.setProperty(changes, `flags.${moduleId}.moraleHalfNotified`, false);
      }

      if (actor.statuses?.has(LEADER_STATUS_ID) && (hp.value > 0) && (newHp <= 0)) {
        postMoraleCheckCard(actor, "leaderDown");
      }
    });

    // The chat card's roll buttons - html is a plain HTMLElement in this Foundry version, not jQuery.
    Hooks.on("renderChatMessageHTML", (_message, html) => {
      if (!game.user.isGM) return;
      html.querySelectorAll(`.${CARD_CLASS} [data-mode]`).forEach(button => {
        button.addEventListener("click", async () => {
          const card = button.closest(`.${CARD_CLASS}`);
          const actor = await fromUuid(card.dataset.actorUuid);
          card.querySelectorAll("[data-mode]").forEach(b => b.disabled = true);
          if (actor) await rollSingleMoraleCheck(actor, button.dataset.mode);
        });
      });
    });

    const houseRulesModule = game.modules.get(moduleId);
    houseRulesModule.api ??= {};
    houseRulesModule.api.rollMoraleCheck = rollMoraleCheck;
  }
};

function postMoraleCheckCard(actor, reason) {
  const textKey = reason === "leaderDown"
    ? "DND5E_HOUSE_RULES.rules.moraleCheck.reminderLeaderDown"
    : "DND5E_HOUSE_RULES.rules.moraleCheck.reminderHalfHp";

  const button = (mode, labelKey) =>
    `<button type="button" data-mode="${mode}">${game.i18n.localize(labelKey)}</button>`;

  ChatMessage.create({
    content: `
      <div class="${CARD_CLASS}" data-actor-uuid="${actor.uuid}">
        <p>${game.i18n.format(textKey, { name: actor.name })}</p>
        <div class="morale-check-actions">
          ${button("normal", "DND5E_HOUSE_RULES.rules.moraleCheck.buttonNormal")}
          ${button("disadvantage", "DND5E_HOUSE_RULES.rules.moraleCheck.buttonDisadvantage")}
          ${button("autoFail", "DND5E_HOUSE_RULES.rules.moraleCheck.buttonAutoFail")}
        </div>
      </div>
    `,
    whisper: ChatMessage.getWhisperRecipients("GM")
  });
}

/**
 * Roll (or auto-fail) a single actor's DC 10 Wisdom morale save.
 * @param {Actor5e} actor
 * @param {"normal"|"disadvantage"|"autoFail"} mode
 */
async function rollSingleMoraleCheck(actor, mode) {
  if (mode === "autoFail") {
    ChatMessage.create({
      content: game.i18n.format("DND5E_HOUSE_RULES.rules.moraleCheck.autoFail", { name: actor.name }),
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return;
  }

  await actor.rollSavingThrow(
    { ability: "wis", disadvantage: mode === "disadvantage" },
    { configure: false },
    { data: { flavor: game.i18n.format("DND5E_HOUSE_RULES.rules.moraleCheck.rollFlavor", { dc: 10 }) } }
  );
}

/**
 * Roll a DC 10 Wisdom morale save for each targeted (or, absent targets, controlled) NPC token.
 * Meant to be called from a GM macro, for ad-hoc checks not tied to the automatic reminder above:
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

  for (const actor of actors) await rollSingleMoraleCheck(actor, mode);
}
