/**
 * Template/example house rule. Copy this folder to add a new one.
 * Each house rule module exports a single default object implementing this contract:
 *   - id:        unique key, used as the game.settings key and DOM name
 *   - titleKey / hintKey: localization keys shown in the settings list and the manager app
 *   - default:   whether the rule is enabled out of the box (keep new rules off by default)
 *   - register(moduleId): called once on the "init" hook, must register the enable/disable setting
 *   - onReady(moduleId):  called once on the "ready" hook, hook into dnd5e only if enabled
 */
export default {
  id: "example-rule",
  titleKey: "DND5E_HOUSE_RULES.rules.example.title",
  hintKey: "DND5E_HOUSE_RULES.rules.example.hint",
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

    // Replace this with the real dnd5e hook(s) the house rule needs, e.g.:
    // Hooks.on("dnd5e.preRollAttack", (rollConfig, dialogConfig, messageConfig) => { ... });
    Hooks.on("dnd5e.rollAttack", () => {
      console.log(`${moduleId} | Example house rule is enabled and an attack roll just happened.`);
    });
  }
};
