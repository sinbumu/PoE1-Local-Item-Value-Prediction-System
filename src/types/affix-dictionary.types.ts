export type ClipboardAffixKind = "prefix" | "suffix";

export type AffixValueBounds = {
  min: number | null;
  max: number | null;
};

export type CanonicalModRecord = {
  canonicalModId: string;
  sourceModId: string;
  domain: string;
  modType: string | null;
  generationType: string;
  groups: string[];
  statIds: string[];
  sourceVersion: string;
  isHybrid: boolean;
  addsTags: string[];
  allowedTags: string[];
  statValueBounds: AffixValueBounds[];
  englishTemplates: string[];
};

export type EnglishAffixDictionaryEntry = {
  canonicalModId: string;
  sourceModId: string;
  domain: string;
  modType: string | null;
  affixKind: ClipboardAffixKind;
  groups: string[];
  addsTags: string[];
  allowedTags: string[];
  statValueBounds: AffixValueBounds[];
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
  candidateCanonicalModIds: string[];
  candidateSourceModIds: string[];
  isAmbiguous: boolean;
  matchedCanonicalModId: string | null;
  matchedSourceModId: string | null;
  matchedAffixKind: ClipboardAffixKind | null;
  matchingConfidence: "high" | "medium" | null;
  matchingMethod: "normalized_exact" | null;
};

export type ClipboardAffixValidationReport = {
  sourceVersion: string;
  scopeCategories: string[];
  checkedSampleCount: number;
  candidateLineCount: number;
  matchedCandidateCount: number;
  ambiguousCandidateCount: number;
  unmatchedCandidateCount: number;
  matchRate: number;
  unmatchedExamples: ClipboardAffixValidationUnmatched[];
};
