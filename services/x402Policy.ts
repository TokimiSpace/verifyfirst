import type { PaymentRequiredEnvelope } from '@ifandonlyif/x402-preflight';

export const MAX_X402_PAYMENT_OPTIONS = 16;

const MAX_IDENTIFIER_LENGTH = 512;
const MAX_AMOUNT_DIGITS = 256;

export type X402IffState = 'consistent' | 'diverged' | 'stale' | 'unobserved' | 'unavailable';

export type X402EnterpriseDecision =
  | 'READY_FOR_HUMAN_APPROVAL'
  | 'DENY_REQUIREMENT_DIVERGED'
  | 'HOLD_IFF_EVIDENCE_STALE'
  | 'HOLD_IFF_UNOBSERVED'
  | 'HOLD_IFF_UNAVAILABLE'
  | 'HOLD_POLICY_MISMATCH';

export interface X402PaymentOption {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  [key: string]: unknown;
}

export interface ValidatedX402PaymentRequired extends PaymentRequiredEnvelope {
  x402Version: 2;
  accepts: X402PaymentOption[];
}

export interface X402EnterprisePolicy {
  allowedNetworks: readonly string[];
  allowedAssets: readonly string[];
  allowedPayees: readonly string[];
  maxAmount: string;
}

export type X402SandboxPolicy = X402EnterprisePolicy;

export type X402PolicyMismatchReason =
  | 'NETWORK_NOT_ALLOWED'
  | 'ASSET_NOT_ALLOWED'
  | 'PAYEE_NOT_ALLOWED'
  | 'AMOUNT_EXCEEDS_LIMIT';

export interface X402OptionPolicyCheck {
  index: number;
  option: X402PaymentOption;
  checks: {
    networkAllowed: boolean;
    assetAllowed: boolean;
    payeeAllowed: boolean;
    amountWithinLimit: boolean;
  };
  matchesPolicy: boolean;
  mismatchReasons: X402PolicyMismatchReason[];
}

export interface X402EnterprisePolicyResult {
  decision: X402EnterpriseDecision;
  iffState: X402IffState;
  localPolicyMatched: boolean;
  /** First fully eligible alternative. It is evidence for review, not a bound payment choice. */
  selectedIndex: number | null;
  selectedOptionBinding: 'NOT_BOUND';
  paymentExecution: 'NOT_EXECUTED';
  optionChecks: X402OptionPolicyCheck[];
}

export type X402PolicyEvaluation = X402EnterprisePolicyResult;

export interface X402ValidationIssue {
  path: string;
  code: 'REQUIRED' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'TOO_MANY_ITEMS' | 'TOO_LONG';
  message: string;
}

export class X402PolicyValidationError extends Error {
  readonly code: 'INVALID_PAYMENT_REQUIRED' | 'INVALID_X402_POLICY';
  readonly issues: X402ValidationIssue[];

  constructor(
    code: X402PolicyValidationError['code'],
    issues: X402ValidationIssue[],
  ) {
    super(code);
    this.name = 'X402PolicyValidationError';
    this.code = code;
    this.issues = issues;
  }
}

const IFF_DECISIONS: Record<X402IffState, X402EnterpriseDecision> = {
  consistent: 'READY_FOR_HUMAN_APPROVAL',
  diverged: 'DENY_REQUIREMENT_DIVERGED',
  stale: 'HOLD_IFF_EVIDENCE_STALE',
  unobserved: 'HOLD_IFF_UNOBSERVED',
  unavailable: 'HOLD_IFF_UNAVAILABLE',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const readRequiredIdentifier = (
  source: Record<string, unknown>,
  field: 'scheme' | 'network' | 'asset' | 'payTo',
  path: string,
  issues: X402ValidationIssue[],
): string | null => {
  const value = source[field];
  if (value === undefined || value === null) {
    issues.push({ path: `${path}.${field}`, code: 'REQUIRED', message: `${field} is required.` });
    return null;
  }
  if (typeof value !== 'string') {
    issues.push({ path: `${path}.${field}`, code: 'INVALID_TYPE', message: `${field} must be a string.` });
    return null;
  }
  if (!value || value !== value.trim() || /\s|[\u0000-\u001f\u007f]/u.test(value)) {
    issues.push({ path: `${path}.${field}`, code: 'INVALID_VALUE', message: `${field} must be a non-empty identifier without whitespace.` });
    return null;
  }
  if (value.length > MAX_IDENTIFIER_LENGTH) {
    issues.push({ path: `${path}.${field}`, code: 'TOO_LONG', message: `${field} exceeds ${MAX_IDENTIFIER_LENGTH} characters.` });
    return null;
  }
  return value;
};

const readPositiveAmount = (
  source: Record<string, unknown>,
  path: string,
  issues: X402ValidationIssue[],
): string | null => {
  const value = source.amount;
  if (value === undefined || value === null) {
    issues.push({ path: `${path}.amount`, code: 'REQUIRED', message: 'amount is required.' });
    return null;
  }
  if (typeof value !== 'string') {
    issues.push({ path: `${path}.amount`, code: 'INVALID_TYPE', message: 'amount must be a string.' });
    return null;
  }
  if (!/^[1-9][0-9]*$/u.test(value)) {
    issues.push({ path: `${path}.amount`, code: 'INVALID_VALUE', message: 'amount must be a positive base-10 integer string.' });
    return null;
  }
  if (value.length > MAX_AMOUNT_DIGITS) {
    issues.push({ path: `${path}.amount`, code: 'TOO_LONG', message: `amount exceeds ${MAX_AMOUNT_DIGITS} digits.` });
    return null;
  }
  return value;
};

/**
 * Strictly parses the x402 v2 fields used by the enterprise policy gate.
 * Extra protocol fields are preserved, but the required payment fields never
 * receive coercion or whitespace normalization.
 */
export const parseX402Requirement = (value: unknown): ValidatedX402PaymentRequired => {
  const issues: X402ValidationIssue[] = [];
  if (!isRecord(value)) {
    throw new X402PolicyValidationError('INVALID_PAYMENT_REQUIRED', [{
      path: '$', code: 'INVALID_TYPE', message: 'PaymentRequired must be an object.',
    }]);
  }

  if (value.x402Version !== 2) {
    issues.push({ path: '$.x402Version', code: 'INVALID_VALUE', message: 'x402Version must equal 2.' });
  }

  if (!Array.isArray(value.accepts)) {
    issues.push({ path: '$.accepts', code: 'INVALID_TYPE', message: 'accepts must be an array.' });
  } else if (value.accepts.length === 0) {
    issues.push({ path: '$.accepts', code: 'REQUIRED', message: 'accepts must contain at least one option.' });
  } else if (value.accepts.length > MAX_X402_PAYMENT_OPTIONS) {
    issues.push({ path: '$.accepts', code: 'TOO_MANY_ITEMS', message: `accepts may contain at most ${MAX_X402_PAYMENT_OPTIONS} options.` });
  }

  const options: X402PaymentOption[] = [];
  if (Array.isArray(value.accepts) && value.accepts.length <= MAX_X402_PAYMENT_OPTIONS) {
    value.accepts.forEach((candidate, index) => {
      const path = `$.accepts[${index}]`;
      if (!isRecord(candidate)) {
        issues.push({ path, code: 'INVALID_TYPE', message: 'Payment option must be an object.' });
        return;
      }
      const scheme = readRequiredIdentifier(candidate, 'scheme', path, issues);
      const network = readRequiredIdentifier(candidate, 'network', path, issues);
      const asset = readRequiredIdentifier(candidate, 'asset', path, issues);
      const amount = readPositiveAmount(candidate, path, issues);
      const payTo = readRequiredIdentifier(candidate, 'payTo', path, issues);
      if (scheme && network && asset && amount && payTo) {
        options.push({ ...candidate, scheme, network, asset, amount, payTo });
      }
    });
  }

  if (issues.length > 0) throw new X402PolicyValidationError('INVALID_PAYMENT_REQUIRED', issues);
  return { ...value, x402Version: 2, accepts: options };
};

export const parseX402PaymentRequired = parseX402Requirement;

const normalizeIdentifier = (value: string): string => value.trim().toLowerCase();

const parsePolicy = (policy: X402EnterprisePolicy) => {
  const issues: X402ValidationIssue[] = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new X402PolicyValidationError('INVALID_X402_POLICY', [{
      path: '$.policy', code: 'INVALID_TYPE', message: 'policy must be an object.',
    }]);
  }
  const readAllowed = (
    value: readonly string[],
    field: 'allowedNetworks' | 'allowedAssets' | 'allowedPayees',
  ): Set<string> => {
    if (!Array.isArray(value)) {
      issues.push({ path: `$.policy.${field}`, code: 'INVALID_TYPE', message: `${field} must be an array.` });
      return new Set();
    }
    const normalized = new Set<string>();
    value.forEach((item, index) => {
      if (typeof item !== 'string' || !item.trim() || /[\u0000-\u001f\u007f]/u.test(item)) {
        issues.push({ path: `$.policy.${field}[${index}]`, code: 'INVALID_VALUE', message: 'Allowed identifiers must be non-empty strings.' });
      } else if (item.trim().length > MAX_IDENTIFIER_LENGTH) {
        issues.push({ path: `$.policy.${field}[${index}]`, code: 'TOO_LONG', message: `Allowed identifier exceeds ${MAX_IDENTIFIER_LENGTH} characters.` });
      } else {
        normalized.add(normalizeIdentifier(item));
      }
    });
    return normalized;
  };

  const networks = readAllowed(policy.allowedNetworks, 'allowedNetworks');
  const assets = readAllowed(policy.allowedAssets, 'allowedAssets');
  const payees = readAllowed(policy.allowedPayees, 'allowedPayees');
  if (typeof policy.maxAmount !== 'string') {
    issues.push({ path: '$.policy.maxAmount', code: 'INVALID_TYPE', message: 'maxAmount must be an integer string.' });
  } else if (!/^(0|[1-9][0-9]*)$/u.test(policy.maxAmount)) {
    issues.push({ path: '$.policy.maxAmount', code: 'INVALID_VALUE', message: 'maxAmount must be a non-negative base-10 integer string.' });
  } else if (policy.maxAmount.length > MAX_AMOUNT_DIGITS) {
    issues.push({ path: '$.policy.maxAmount', code: 'TOO_LONG', message: `maxAmount exceeds ${MAX_AMOUNT_DIGITS} digits.` });
  }

  if (issues.length > 0) throw new X402PolicyValidationError('INVALID_X402_POLICY', issues);
  return { networks, assets, payees, maxAmount: BigInt(policy.maxAmount) };
};

/**
 * Checks each alternative independently. The first fully compliant option is
 * identified for human review, but is deliberately not bound, signed, or paid.
 */
export const resolveX402Decision = (
  localPolicyMatched: boolean,
  iffState: X402IffState,
): X402EnterpriseDecision => (
  localPolicyMatched ? IFF_DECISIONS[iffState] : 'HOLD_POLICY_MISMATCH'
);

export const evaluateX402Policy = (
  paymentRequired: unknown,
  policy: X402SandboxPolicy,
  iffState: X402IffState,
): X402PolicyEvaluation => {
  const envelope = parseX402Requirement(paymentRequired);
  const normalizedPolicy = parsePolicy(policy);
  const optionChecks = envelope.accepts.map<X402OptionPolicyCheck>((option, index) => {
    const checks = {
      networkAllowed: normalizedPolicy.networks.has(normalizeIdentifier(option.network)),
      assetAllowed: normalizedPolicy.assets.has(normalizeIdentifier(option.asset)),
      payeeAllowed: normalizedPolicy.payees.has(normalizeIdentifier(option.payTo)),
      amountWithinLimit: BigInt(option.amount) <= normalizedPolicy.maxAmount,
    };
    const mismatchReasons: X402PolicyMismatchReason[] = [];
    if (!checks.networkAllowed) mismatchReasons.push('NETWORK_NOT_ALLOWED');
    if (!checks.assetAllowed) mismatchReasons.push('ASSET_NOT_ALLOWED');
    if (!checks.payeeAllowed) mismatchReasons.push('PAYEE_NOT_ALLOWED');
    if (!checks.amountWithinLimit) mismatchReasons.push('AMOUNT_EXCEEDS_LIMIT');
    return {
      index,
      option,
      checks,
      matchesPolicy: mismatchReasons.length === 0,
      mismatchReasons,
    };
  });
  const selectedIndex = optionChecks.find(check => check.matchesPolicy)?.index ?? null;
  const localPolicyMatched = selectedIndex !== null;

  return {
    decision: resolveX402Decision(localPolicyMatched, iffState),
    iffState,
    localPolicyMatched,
    selectedIndex,
    selectedOptionBinding: 'NOT_BOUND',
    paymentExecution: 'NOT_EXECUTED',
    optionChecks,
  };
};

export const evaluateX402EnterprisePolicy = evaluateX402Policy;
