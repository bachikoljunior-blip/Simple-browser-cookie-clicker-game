"use strict";
/** 収録用のセーブ状態(中盤〜終盤相当)。数字と絵が一番おいしく見える所を狙う。 */

const UPGRADES = {
  finger: 240, grandma: 200, oven: 185, factory: 170, bank: 155, spiceRack: 90,
  portal: 140, moonBakery: 120, timeOven: 105, galaxyFactory: 92,
  blackHoleMixer: 80, universeOven: 68, godFinger: 55,
  cookieSingularity: 42, quantumBakery: 30, antimatterOven: 18,
};

// 研究は 3 本だけ未購入で残す(収録中に実際に解放するところを見せる)
const RESEARCH_SKIP = ["quantumProofing", "antimatterRecipe", "annihilationCore"];
const RESEARCH = [
  "fingerTechnique", "grandmaCrowd", "ovenBatch", "factoryNetwork", "portalNetwork",
  "bankClickDividend", "bankVault", "spiceBlend", "cpsStrike", "moonGlobalYeast",
  "moonBake", "timeLayer", "portalGlobalFold", "galaxyAssembly",
  "blackHoleCompression", "eventHorizon", "cosmicConvection", "singularityFlow",
].filter((id) => !RESEARCH_SKIP.includes(id));

// スキルツリーは「かなり育っているが、まだ伸ばす余地がある」状態に。
// 未取得を残しておくと、収録中に実際に 1 つ取るところが撮れる。
const SKILLS = [
  "core", "click_1", "click_2", "click_3", "click_4",
  "golden_1", "golden_2", "golden_3", "golden_analysis",
  "click_amp", "golden_amp", "monster_amp", "auto_amp",
  "auto_1", "auto_2", "auto_3",
  "monster_1", "monster_2", "monster_3",
  "workshop_1", "workshop_2", "eqcraft_t2", "eqcraft_t3",
  "economy_1", "economy_2", "economy_analysis",
  "research_1", "research_remodel", "research_analysis",
  "mastery_low", "order_board",
  "upgrade_moon", "upgrade_time", "upgrade_galaxy", "upgrade_blackhole",
  "upgrade_universe", "upgrade_godfinger", "upgrade_singularity",
  "upgrade_quantum", "upgrade_antimatter",
  "reward_1", "reward_synergy", "reward_choice_2",
  "unlock_reward_crackedFang", "unlock_reward_chainPrep",
  "unlock_reward_goldenChain", "unlock_reward_goldenTarget",
  "unlock_reward_beastScent",
  "start_1", "offline_1",
];

module.exports = {
  upgrades: UPGRADES,
  research: RESEARCH,
  skills: SKILLS,
  prestige: 42000,
  prestigeRuns: 9,
  monstersDefeated: 186,
  stageUnlocked: 3,
  workshopUnlocked: true,
  cookies: "4.2e21",
};
