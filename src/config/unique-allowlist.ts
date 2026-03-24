import type { TrainingFeatureRaw } from "../types/training-features.types";

type UniqueAllowRule = {
  id: string;
  baseTypes?: string[];
  match?: (feature: TrainingFeatureRaw) => boolean;
};

const STRICT_UNIQUE_BASE_TYPES = new Set([
  "Cabalist Regalia",
  "Champion Kite Shield",
  "Dusk Blade",
  "Engraved Greatsword",
  "Formless Ring",
  "Girded Tower Shield",
  "Karui Maul",
  "Piledriver",
  "Riveted Boots",
  "Seaglass Amulet",
  "Siege Axe",
  "Siege Helmet",
  "Slaughter Knife",
  "Unset Amulet",
  "Vaal Rapier",
  "Wyrmscale Doublet",
  "Astrolabe Amulet",
  "Crusader Boots",
  "Faun's Horn",
  "Fugitive Ring",
  "General's Brigandine",
  "Imperial Maul",
  "Lacewood Spirit Shield",
  "Ornate Quiver",
  "Raven Mask",
  "Rawhide Boots",
  "Riveted Gloves",
  "Spectral Axe",
  "Spiny Round Shield",
  "Stygian Vise",
  "Titanium Spirit Shield",
  "Void Axe",
  "Antique Gauntlets",
  "Assassin's Boots",
  "Foul Staff",
  "Heavy Belt",
  "Hellion's Paw",
  "Imperial Bow",
  "Imperial Skean",
  "Imperial Staff",
  "Leather Belt",
  "Magistrate Crown",
  "Paua Amulet",
  "Sage's Robe",
  "Steel Ring",
  "Studded Belt",
  "Vaal Claw",
  "Waxed Garb",
  "Gold Ring",
  "Hydrascale Gauntlets",
  "Lacquered Garb",
  "Moonstone Ring",
  "Onyx Amulet",
  "Saint's Hauberk",
  "Spidersilk Robe",
  "Spine Bow",
  "Stealth Boots",
  "Vaal Blade",
  "Zodiac Leather",
  "Agate Amulet",
  "Amber Amulet",
  "Ambush Mitts",
  "Amethyst Ring",
  "Ancient Gauntlets",
  "Assassin's Mitts",
  "Blood Raiment",
  "Blood Sceptre",
  "Broadhead Arrow Quiver",
  "Butcher Axe",
  "Cardinal Round Shield",
  "Carnal Armour",
  "Carnal Mitts",
  "Chain Belt",
  "Citadel Bow",
  "Colossal Tower Shield",
  "Colosseum Plate",
  "Crimson Round Shield",
  "Cryonic Ring",
  "Cutlass",
  "Demon Dagger",
  "Dragonscale Boots",
  "Enthalpic Ring",
  "Ezomyte Burgonet",
  "Ezomyte Spiked Shield",
  "Ezomyte Staff",
  "Ezomyte Tower Shield",
  "Faithful Helmet",
  "Fingerless Silk Gloves",
  "Fluted Bascinet",
  "Fugitive Boots",
  "Golden Plate",
  "Goliath Gauntlets",
  "Goliath Greaves",
  "Hubris Circlet",
  "Hydrascale Boots",
  "Jade Amulet",
  "Judgement Staff",
  "Lacquered Helmet",
  "Legion Sword",
  "Lich's Circlet",
  "Lion Sword",
  "Marble Amulet",
  "Mirrored Spiked Shield",
  "Murder Boots",
  "Murder Mitts",
  "Nightmare Mace",
  "Opal Ring",
  "Opal Wand",
  "Organic Ring",
  "Paladin Crown",
  "Pig-Faced Bascinet",
  "Praetor Crown",
  "Prophecy Wand",
  "Prophet Crown",
  "Quarterstaff",
  "Royal Burgonet",
  "Ruby Ring",
  "Sadist Garb",
  "Sage Wand",
  "Sapphire Ring",
  "Savant's Robe",
  "Serpentine Staff",
  "Shadow Sceptre",
  "Silken Hood",
  "Slink Boots",
  "Soldier Gloves",
  "Spiked Gloves",
  "Steelscale Gauntlets",
  "Steelwood Bow",
  "Synaptic Ring",
  "Tornado Wand",
  "Torturer Garb",
  "Triumphant Lamellar",
  "Unset Ring",
  "Vaal Axe",
  "Vaal Greaves",
  "Vaal Mask",
  "Vaal Regalia",
  "Vaal Spirit Shield",
  "Vanguard Belt",
  "Varnished Coat",
  "Vermillion Ring",
  "Vile Arrow Quiver",
  "Void Sceptre",
  "Widowsilk Robe",
  "Wyrmscale Boots",
  "Zealot Helmet",
]);

const STRICT_UNIQUE_RULES: UniqueAllowRule[] = [
  {
    id: "strict_unique_exuber_impresence",
    baseTypes: ["Onyx Amulet"],
    match: (feature) => feature.influenceShaper && feature.influenceElder,
  },
  {
    id: "strict_unique_ex_kaoms_heart",
    baseTypes: ["Glorious Plate"],
    match: (feature) => feature.socketCount === 0,
  },
  {
    id: "strict_unique_ex_squire",
    baseTypes: ["Elegant Round Shield"],
    match: (feature) =>
      feature.socketCount >= 3 && feature.whiteSocketCount >= 3,
  },
  {
    id: "strict_unique_ex_tabula",
    baseTypes: ["Simple Robe"],
    match: (feature) => feature.linkCount >= 6,
  },
  {
    id: "strict_unique_ex_triad_grip",
    baseTypes: ["Mesh Gloves"],
    match: (feature) =>
      feature.socketCount >= 4 && feature.whiteSocketCount >= 4,
  },
  {
    id: "strict_unique_ex_forge_sword",
    baseTypes: ["Infernal Sword"],
    match: (feature) => feature.influenceShaper && feature.influenceElder,
  },
  {
    id: "strict_unique_ex_synth_rings",
    baseTypes: [
      "Amethyst Ring",
      "Iron Ring",
      "Prismatic Ring",
      "Ruby Ring",
      "Sapphire Ring",
      "Topaz Ring",
    ],
    match: (feature) => feature.synthesised,
  },
  {
    id: "strict_unique_tiered_bases",
    baseTypes: Array.from(STRICT_UNIQUE_BASE_TYPES),
  },
];

const EXCLUDED_UNIQUE_BASE_TYPE_PATTERNS = [
  "Flask",
  "Relic",
  "Talisman",
  "Idol",
  "Map",
];

export function matchNeverSinkStrictUniqueRule(
  feature: TrainingFeatureRaw,
): string | null {
  const baseType = feature.baseType;
  if (!baseType) {
    return null;
  }

  if (
    EXCLUDED_UNIQUE_BASE_TYPE_PATTERNS.some((pattern) => baseType.includes(pattern))
  ) {
    return null;
  }

  for (const rule of STRICT_UNIQUE_RULES) {
    const baseTypeMatch =
      !rule.baseTypes || rule.baseTypes.includes(baseType);
    const customMatch = !rule.match || rule.match(feature);

    if (baseTypeMatch && customMatch) {
      return rule.id;
    }
  }

  return null;
}
