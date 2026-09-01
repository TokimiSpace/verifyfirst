import { describe, expect, it } from 'vitest';
import {
  evaluateX402Policy,
  parseX402Requirement,
  X402PolicyValidationError,
  type X402SandboxPolicy,
  type X402IffState,
} from '../services/x402Policy';

const payee = '0x1111111111111111111111111111111111111111';
const asset = '0x0000000000000000000000000000000000000000';

const paymentRequired = (overrides: Record<string, unknown> = {}) => ({
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    asset,
    amount: '9007199254740993',
    payTo: payee,
    ...overrides,
  }],
});

const policy: X402SandboxPolicy = {
  allowedNetworks: ['eip155:8453'],
  allowedAssets: [asset],
  allowedPayees: [payee],
  maxAmount: '9007199254740994',
};

describe('parseX402Requirement', () => {
  it('accepts a strict x402 v2 envelope and preserves protocol extension fields', () => {
    const parsed = parseX402Requirement({
      ...paymentRequired(),
      resource: { url: 'https://merchant.example/pay' },
    });
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts[0]).toMatchObject({ scheme: 'exact', amount: '9007199254740993' });
    expect(parsed.resource).toEqual({ url: 'https://merchant.example/pay' });
  });

  it.each([
    ['non-object envelope', null],
    ['wrong version', { ...paymentRequired(), x402Version: 1 }],
    ['missing accepts', { x402Version: 2 }],
    ['empty accepts', { x402Version: 2, accepts: [] }],
    ['too many options', { x402Version: 2, accepts: Array.from({ length: 17 }, () => paymentRequired().accepts[0]) }],
    ['non-object option', { x402Version: 2, accepts: ['invalid'] }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseX402Requirement(value)).toThrow(X402PolicyValidationError);
  });

  it.each(['scheme', 'network', 'asset', 'amount', 'payTo'] as const)('requires option.%s', (field) => {
    const option = { ...paymentRequired().accepts[0] };
    delete option[field];
    expect(() => parseX402Requirement({ x402Version: 2, accepts: [option] })).toThrow(X402PolicyValidationError);
  });

  it.each([
    ['0'], ['-1'], ['1.5'], ['01'], [' 1'], ['1 '], ['1e3'], [1],
  ])('rejects a non-positive or non-canonical amount %p', (amount) => {
    expect(() => parseX402Requirement(paymentRequired({ amount }))).toThrow(X402PolicyValidationError);
  });

  it('returns precise issue paths for invalid required fields', () => {
    try {
      parseX402Requirement(paymentRequired({ network: '', payTo: ' bad payee ' }));
      throw new Error('expected parser to reject invalid identifiers');
    } catch (error) {
      expect(error).toBeInstanceOf(X402PolicyValidationError);
      expect((error as X402PolicyValidationError).issues.map(issue => issue.path)).toEqual([
        '$.accepts[0].network',
        '$.accepts[0].payTo',
      ]);
    }
  });
});

describe('evaluateX402Policy', () => {
  it.each<[X402IffState, string]>([
    ['consistent', 'READY_FOR_HUMAN_APPROVAL'],
    ['diverged', 'DENY_REQUIREMENT_DIVERGED'],
    ['stale', 'HOLD_IFF_EVIDENCE_STALE'],
    ['unobserved', 'HOLD_IFF_UNOBSERVED'],
    ['unavailable', 'HOLD_IFF_UNAVAILABLE'],
  ])('maps IFF %s without ever executing payment', (iffState, decision) => {
    const result = evaluateX402Policy(paymentRequired(), policy, iffState);
    expect(result).toMatchObject({
      decision,
      iffState,
      localPolicyMatched: true,
      selectedIndex: 0,
      selectedOptionBinding: 'NOT_BOUND',
      paymentExecution: 'NOT_EXECUTED',
    });
    expect(result.optionChecks[0]).toMatchObject({
      matchesPolicy: true,
      mismatchReasons: [],
      checks: {
        networkAllowed: true,
        assetAllowed: true,
        payeeAllowed: true,
        amountWithinLimit: true,
      },
    });
  });

  it.each([
    ['network', { network: 'eip155:1' }, 'NETWORK_NOT_ALLOWED'],
    ['asset', { asset: '0x2222222222222222222222222222222222222222' }, 'ASSET_NOT_ALLOWED'],
    ['payee', { payTo: '0x3333333333333333333333333333333333333333' }, 'PAYEE_NOT_ALLOWED'],
    ['amount', { amount: '9007199254740995' }, 'AMOUNT_EXCEEDS_LIMIT'],
  ])('holds a local %s mismatch', (_field, override, reason) => {
    const result = evaluateX402Policy(paymentRequired(override), policy, 'consistent');
    expect(result).toMatchObject({
      decision: 'HOLD_POLICY_MISMATCH',
      localPolicyMatched: false,
      selectedIndex: null,
      selectedOptionBinding: 'NOT_BOUND',
      paymentExecution: 'NOT_EXECUTED',
    });
    expect(result.optionChecks[0].mismatchReasons).toContain(reason);
  });

  it('uses BigInt for amounts beyond Number.MAX_SAFE_INTEGER', () => {
    const result = evaluateX402Policy(
      paymentRequired({ amount: '99999999999999999999999999999999999999' }),
      { ...policy, maxAmount: '100000000000000000000000000000000000000' },
      'consistent',
    );
    expect(result.decision).toBe('READY_FOR_HUMAN_APPROVAL');
    expect(result.optionChecks[0].checks.amountWithinLimit).toBe(true);
  });

  it('selects the first fully compliant alternative and leaves it unbound', () => {
    const envelope = paymentRequired();
    envelope.accepts = [
      { ...envelope.accepts[0], network: 'eip155:1' },
      { ...envelope.accepts[0], amount: policy.maxAmount },
      { ...envelope.accepts[0], amount: '1' },
    ];
    const result = evaluateX402Policy(envelope, policy, 'consistent');
    expect(result.selectedIndex).toBe(1);
    expect(result.optionChecks.map(check => check.matchesPolicy)).toEqual([false, true, true]);
    expect(result.selectedOptionBinding).toBe('NOT_BOUND');
    expect(result.paymentExecution).toBe('NOT_EXECUTED');
  });

  it('matches case-insensitive network, asset, and payee policy identifiers', () => {
    const result = evaluateX402Policy(paymentRequired(), {
      ...policy,
      allowedNetworks: ['EIP155:8453'],
      allowedAssets: [asset.toUpperCase()],
      allowedPayees: [payee.toUpperCase()],
    }, 'consistent');
    expect(result.localPolicyMatched).toBe(true);
  });

  it('rejects invalid policy amounts before comparing with BigInt', () => {
    expect(() => evaluateX402Policy(paymentRequired(), {
      ...policy,
      maxAmount: '-1',
    }, 'consistent')).toThrowError(expect.objectContaining({ code: 'INVALID_X402_POLICY' }));
  });
});
