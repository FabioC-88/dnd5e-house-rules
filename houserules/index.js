import exampleRule from "./_example/index.js";
import exhaustionOnDrop from "./exhaustion-on-drop/index.js";

/**
 * Explicit registry of every house rule shipped by this module.
 * Foundry loads ES modules directly in the browser (no bundler), so folders under
 * houserules/ cannot be auto-discovered at runtime: add a new house rule by creating
 * its folder (see houserules/_example) and importing it here.
 */
export const HOUSE_RULES = [
  exampleRule,
  exhaustionOnDrop
];
