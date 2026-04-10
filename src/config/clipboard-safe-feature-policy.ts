import clipboardSafeFeaturePolicyJson from "./clipboard-safe-feature-policy.json";

export type ClipboardSafeFeaturePolicy = {
  policyName: string;
  version: number;
  description: string;
  activeFeatureColumns: string[];
  derivedFeatureColumns: string[];
  categoricalColumns: string[];
  booleanColumns: string[];
  conditionalFeatureColumns: string[];
  excludedFeatureColumns: string[];
};

export const clipboardSafeFeaturePolicy =
  clipboardSafeFeaturePolicyJson as ClipboardSafeFeaturePolicy;

export const CLIPBOARD_SAFE_ACTIVE_FEATURE_COLUMNS =
  clipboardSafeFeaturePolicy.activeFeatureColumns;
export const CLIPBOARD_SAFE_DERIVED_FEATURE_COLUMNS =
  clipboardSafeFeaturePolicy.derivedFeatureColumns;
export const CLIPBOARD_SAFE_CATEGORICAL_COLUMNS =
  clipboardSafeFeaturePolicy.categoricalColumns;
export const CLIPBOARD_SAFE_BOOLEAN_COLUMNS =
  clipboardSafeFeaturePolicy.booleanColumns;
export const CLIPBOARD_SAFE_CONDITIONAL_FEATURE_COLUMNS =
  clipboardSafeFeaturePolicy.conditionalFeatureColumns;
export const CLIPBOARD_SAFE_EXCLUDED_FEATURE_COLUMNS =
  clipboardSafeFeaturePolicy.excludedFeatureColumns;
