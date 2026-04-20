import { TruthGuardAnalysis, Language, InputType } from "../types";

export type APIErrorCode =
  | 'LLM_QUOTA'
  | 'LLM_FAILED'
  | 'LOCAL_RATE_LIMIT'
  | 'INVALID_INPUT'
  | 'TOTAL_OUTAGE'
  | 'SERVER_ERROR';

export interface APIDegradation {
  level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  score: number;
  services: string[];
}

export class APIError extends Error {
  statusCode: number;
  errorCode?: APIErrorCode;
  degradation?: APIDegradation;
  constructor(message: string, statusCode: number, errorCode?: APIErrorCode, degradation?: APIDegradation) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.degradation = degradation;
  }
}

/**
 * TruthGuard analysis function supporting multiple input types
 */
export const analyzeTruthGuard = async (
  input: string,
  inputType?: InputType,
  language: Language = 'en',
  forceRefresh: boolean = false
): Promise<TruthGuardAnalysis> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      inputType,
      language,
      forceRefresh
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `HTTP error! status: ${response.status}`;
    const errorCode = errorData.errorCode as APIErrorCode | undefined;
    const degradation = errorData.degradation as APIDegradation | undefined;

    throw new APIError(message, response.status, errorCode, degradation);
  }

  const data = await response.json();

  // Ensure TruthGuard-specific fields have defaults
  return {
    ...data,
    inputType: data.inputType || inputType || 'SMS_TEXT',
    originalInput: data.originalInput || input,
    riskSignals: data.riskSignals || [],
    suggestedActions: data.suggestedActions || [],
    scamProbability: data.scamProbability ?? (100 - (data.trustScore || 50)),
    finalVerdict: data.finalVerdict || 'C_SUSPICIOUS_NEEDS_VERIFICATION',
    conclusion: data.conclusion || data.verdict || input,
    normalizedInput: data.normalizedInput || {},
    primaryActions: data.primaryActions || [],
    agentVerification: data.agentVerification || {
      status: 'NOT_RUN',
      redirectChain: [],
      forms: [],
      ctaButtons: [],
      asksForLogin: false,
      asksForOtp: false,
      asksForPayment: false,
      asksForAppDownload: false,
      asksToAddChat: false,
      screenshots: [],
      riskObservations: [],
    },
    officialRoute: data.officialRoute || {
      status: 'OFFICIAL_UNKNOWN',
      label: '',
      rationale: '',
      lane: 'UNVERIFIED',
    },
    likelyLosses: data.likelyLosses || [],
    trustSummary: data.trustSummary || [],
  } as TruthGuardAnalysis;
};
