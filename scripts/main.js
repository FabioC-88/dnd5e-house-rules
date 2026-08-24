import { MODULE_ID } from "./constants.js";
import { HOUSE_RULES } from "../houserules/index.js";
import { HouseRulesManager } from "./house-rules-manager.js";

Hooks.once("init", () => {
  for (const rule of HOUSE_RULES) {
    rule.register(MODULE_ID);
  }

  game.settings.registerMenu(MODULE_ID, "houseRulesManager", {
    name: "DND5E_HOUSE_RULES.manager.menuName",
    label: "DND5E_HOUSE_RULES.manager.menuLabel",
    hint: "DND5E_HOUSE_RULES.manager.menuHint",
    icon: "fa-solid fa-scroll",
    type: HouseRulesManager,
    restricted: true
  });
});

Hooks.once("ready", () => {
  for (const rule of HOUSE_RULES) {
    rule.onReady?.(MODULE_ID);
  }
});
