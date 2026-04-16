export type ClipboardAffixKind = "prefix" | "suffix";

export type CanonicalModRecord = {
  canonicalModId: string;
  sourceModId: string;
  domain: string;
  generationType: string;
  groups: string[];
  statIds: string[];
  sourceVersion: string;
  isHybrid: boolean;
  allowedTags: string[];
  englishTemplates: string[];
};

export type EnglishAffixDictionaryEntry = {
  canonicalModId: string;
  sourceModId: string;
  affixKind: ClipboardAffixKind;
  textTemplatesEn: string[];
  normalizedTextTemplatesEn: string[];
  matchTokensEn: string[];
  matchingConfidence: "high" | "medium";
};

export type CountingPolicyArtifact = {
  countHybridAsSingleAffix: boolean;
  includeCraftedInPrefixSuffixCount: boolean;
  includeFracturedInPrefixSuffixCount: boolean;
  excludeSections: string[];
  nullOnUnmatchedExplicit: boolean;
  scope: "en_v1";
  sourceVersion: string;
};

export type RePoeVendoredFile = {
  name: string;
  url: string;
  sha256: string;
  size: number;
};

export type RePoeVendorManifest = {
  source: "repoe-fork";
  game: "poe1";
  snapshotLabel: string;
  sourceRepoUrl: string;
  exportBaseUrl: string;
  fetchedAt: string;
  files: RePoeVendoredFile[];
};

export type ClipboardAffixValidationUnmatched = {
  sampleId: string;
  category: string;
  line: string;
  sectionKind: string;
};

export type ClipboardAffixAnalysisLine = {
  line: string;
  normalizedLine: string;
  sectionKind: string;
  matchedCanonicalModId: string | null;
  matchedAffixKind: ClipboardAffixKind | null;
};

export type ClipboardAffixValidationReport = {
  sourceVersion: string;
  scopeCategories: string[];
  checkedSampleCount: number;
  candidateLineCount: number;
  matchedCandidateCount: number;
  unmatchedCandidateCount: number;
  matchRate: number;
  unmatchedExamples: ClipboardAffixValidationUnmatched[];
};
