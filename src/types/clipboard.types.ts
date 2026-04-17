import type { ClipboardAffixAnalysisLine } from "./affix-dictionary.types";

export type ClipboardLocale = "en" | "ko" | "unknown";

export type ClipboardSectionKind =
  | "header"
  | "properties"
  | "requirements"
  | "sockets"
  | "item_level"
  | "implicit_mods"
  | "explicit_mods"
  | "enchant_mods"
  | "fractured_mods"
  | "crafted_mods"
  | "flavour"
  | "unknown";

export type ClipboardSection = {
  kind: ClipboardSectionKind;
  title: string | null;
  lines: string[];
};

export type ClipboardInfluenceFlags = {
  shaper: boolean;
  elder: boolean;
  crusader: boolean;
  redeemer: boolean;
  hunter: boolean;
  warlord: boolean;
  searing: boolean;
  tangled: boolean;
};

export type ClipboardParsedItem = {
  rawText: string;
  locale: ClipboardLocale;
  itemClass: string | null;
  rarity: string | null;
  itemName: string | null;
  baseType: string | null;
  sections: ClipboardSection[];
  explicitAffixLines: ClipboardAffixAnalysisLine[];
  influences: ClipboardInfluenceFlags;
  warnings: string[];
};

export type ParseClipboardOptions = {
  localeHint?: Exclude<ClipboardLocale, "unknown">;
};
