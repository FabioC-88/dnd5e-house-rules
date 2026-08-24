import { MODULE_ID } from "./constants.js";
import { HOUSE_RULES } from "../houserules/index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Settings menu app listing every registered house rule with its toggle. */
export class HouseRulesManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dnd5e-house-rules-manager",
    tag: "form",
    window: {
      title: "DND5E_HOUSE_RULES.manager.appTitle",
      icon: "fa-solid fa-scroll"
    },
    position: {
      width: 520,
      height: "auto"
    },
    form: {
      handler: HouseRulesManager.onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/house-rules-manager.hbs`
    }
  };

  async _prepareContext(_options) {
    const rules = HOUSE_RULES.map(rule => ({
      id: rule.id,
      title: game.i18n.localize(rule.titleKey),
      hint: game.i18n.localize(rule.hintKey),
      enabled: game.settings.get(MODULE_ID, rule.id)
    }));
    return { rules };
  }

  static async onSubmit(_event, _form, formData) {
    const data = formData.object;
    let changed = false;

    for (const rule of HOUSE_RULES) {
      const enabled = Boolean(data[rule.id]);
      const current = game.settings.get(MODULE_ID, rule.id);
      if (enabled !== current) {
        await game.settings.set(MODULE_ID, rule.id, enabled);
        changed = true;
      }
    }

    if (changed) {
      ui.notifications.info(game.i18n.localize("DND5E_HOUSE_RULES.manager.reloadNotice"));
    }
  }
}
