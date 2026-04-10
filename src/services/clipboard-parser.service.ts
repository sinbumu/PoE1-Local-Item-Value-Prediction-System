import type {
  ClipboardInfluenceFlags,
  ClipboardLocale,
  ClipboardParsedItem,
  ClipboardSection,
  ClipboardSectionKind,
  ParseClipboardOptions,
} from "../types/clipboard.types";

type LocaleDictionary = {
  rarityLabel: string;
  requirementsHeader: string;
  socketsPrefix: string;
  itemLevelPrefix: string;
  influenceKeywords: Partial<Record<keyof ClipboardInfluenceFlags, string[]>>;
};

const BLOCK_SEPARATOR = "--------";

const LOCALE_DICTIONARIES: Record<Exclude<ClipboardLocale, "unknown">, LocaleDictionary> = {
  en: {
    rarityLabel: "Rarity:",
    requirementsHeader: "Requirements:",
    socketsPrefix: "Sockets:",
    itemLevelPrefix: "Item Level:",
    influenceKeywords: {
      shaper: ["Shaper Item"],
      elder: ["Elder Item"],
      crusader: ["Crusader Item"],
      redeemer: ["Redeemer Item"],
      hunter: ["Hunter Item"],
      warlord: ["Warlord Item"],
      searing: ["Searing Exarch Item", "Eater of Worlds Item"],
      tangled: ["Tangled Item"],
    },
  },
  ko: {
    rarityLabel: "희귀도:",
    requirementsHeader: "요구사항:",
    socketsPrefix: "홈:",
    itemLevelPrefix: "아이템 레벨:",
    influenceKeywords: {
      shaper: ["쉐이퍼 아이템"],
      elder: ["엘더 아이템"],
      crusader: ["성전사 아이템"],
      redeemer: ["구원자 아이템"],
      hunter: ["사냥꾼 아이템"],
      warlord: ["대장군 아이템"],
      searing: ["절망의 분출자 아이템", "세계 포식자 아이템"],
      tangled: ["뒤엉킨 아이템"],
    },
  },
};

function createEmptyInfluenceFlags(): ClipboardInfluenceFlags {
  return {
    shaper: false,
    elder: false,
    crusader: false,
    redeemer: false,
    hunter: false,
    warlord: false,
    searing: false,
    tangled: false,
  };
}

function normalizeClipboardText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

function splitBlocks(raw: string): string[][] {
  return normalizeClipboardText(raw)
    .split(BLOCK_SEPARATOR)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0),
    )
    .filter((block) => block.length > 0);
}

function detectLocale(
  blocks: string[][],
  localeHint?: Exclude<ClipboardLocale, "unknown">,
): ClipboardLocale {
  if (localeHint) {
    return localeHint;
  }

  const firstLine = blocks[0]?.[0] ?? "";
  if (firstLine.startsWith(LOCALE_DICTIONARIES.en.rarityLabel)) {
    return "en";
  }
  if (firstLine.startsWith(LOCALE_DICTIONARIES.ko.rarityLabel)) {
    return "ko";
  }

  return "unknown";
}

function parseHeaderBlock(
  lines: string[],
  locale: ClipboardLocale,
  warnings: string[],
): Pick<ClipboardParsedItem, "rarity" | "itemName" | "baseType"> {
  const dictionary =
    locale === "unknown" ? null : LOCALE_DICTIONARIES[locale];

  const rarityLine = lines[0] ?? "";
  if (!dictionary || !rarityLine.startsWith(dictionary.rarityLabel)) {
    warnings.push("header block does not match a known locale rarity label");
    return {
      rarity: null,
      itemName: lines[1] ?? null,
      baseType: lines[2] ?? lines[1] ?? null,
    };
  }

  const rarity = rarityLine.slice(dictionary.rarityLabel.length).trim() || null;
  const itemName = lines[1] ?? null;
  const baseType = lines[2] ?? lines[1] ?? null;

  return {
    rarity,
    itemName,
    baseType,
  };
}

function classifySection(lines: string[], locale: ClipboardLocale, index: number): ClipboardSection {
  if (index === 0) {
    return {
      kind: "header",
      title: null,
      lines,
    };
  }

  const dictionary =
    locale === "unknown" ? null : LOCALE_DICTIONARIES[locale];
  const firstLine = lines[0] ?? "";

  if (dictionary?.requirementsHeader === firstLine) {
    return {
      kind: "requirements",
      title: firstLine,
      lines,
    };
  }

  if (dictionary && lines.some((line) => line.startsWith(dictionary.socketsPrefix))) {
    return {
      kind: "sockets",
      title: null,
      lines,
    };
  }

  if (dictionary && lines.some((line) => line.startsWith(dictionary.itemLevelPrefix))) {
    return {
      kind: "item_level",
      title: null,
      lines,
    };
  }

  if (lines.some((line) => /\{ Crafted Modifier \}/i.test(line))) {
    return {
      kind: "crafted_mods",
      title: null,
      lines,
    };
  }

  if (lines.some((line) => /\{ Fractured Modifier \}/i.test(line))) {
    return {
      kind: "fractured_mods",
      title: null,
      lines,
    };
  }

  if (lines.some((line) => /\{ Enchant \}/i.test(line))) {
    return {
      kind: "enchant_mods",
      title: null,
      lines,
    };
  }

  if (index === 1) {
    return {
      kind: "properties",
      title: null,
      lines,
    };
  }

  return {
    kind: "unknown",
    title: null,
    lines,
  };
}

function parseInfluences(lines: string[], locale: ClipboardLocale): ClipboardInfluenceFlags {
  const flags = createEmptyInfluenceFlags();
  if (locale === "unknown") {
    return flags;
  }

  const dictionary = LOCALE_DICTIONARIES[locale];
  for (const [key, keywords] of Object.entries(dictionary.influenceKeywords)) {
    if (!keywords || keywords.length === 0) {
      continue;
    }

    flags[key as keyof ClipboardInfluenceFlags] = lines.some((line) =>
      keywords.some((keyword) => line.includes(keyword)),
    );
  }

  return flags;
}

export class ClipboardParserService {
  parse(rawText: string, options?: ParseClipboardOptions): ClipboardParsedItem {
    const warnings: string[] = [];
    const normalized = normalizeClipboardText(rawText);
    const blocks = splitBlocks(rawText);

    if (blocks.length === 0) {
      return {
        rawText: normalized,
        locale: options?.localeHint ?? "unknown",
        rarity: null,
        itemName: null,
        baseType: null,
        sections: [],
        influences: createEmptyInfluenceFlags(),
        warnings: ["clipboard text is empty"],
      };
    }

    const locale = detectLocale(blocks, options?.localeHint);
    const header = parseHeaderBlock(blocks[0], locale, warnings);
    const sections = blocks.map((block, index) => classifySection(block, locale, index));
    const allLines = blocks.flat();

    if (locale === "unknown") {
      warnings.push("locale could not be detected automatically");
    }

    return {
      rawText: normalized,
      locale,
      rarity: header.rarity,
      itemName: header.itemName,
      baseType: header.baseType,
      sections,
      influences: parseInfluences(allLines, locale),
      warnings,
    };
  }

  parseSections(rawText: string, options?: ParseClipboardOptions): ClipboardSection[] {
    return this.parse(rawText, options).sections;
  }

  inferSectionKind(lines: string[], locale: ClipboardLocale, index: number): ClipboardSectionKind {
    return classifySection(lines, locale, index).kind;
  }
}
