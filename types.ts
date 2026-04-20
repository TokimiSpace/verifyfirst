export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL'
}

// Identity Status Classification
export type IdentityStatus = 'UNKNOWN_ENTITY' | 'VERIFIED_INFLUENCER' | 'IMPERSONATOR' | 'OFFICIAL_PROJECT';

export interface SourceLink {
  title: string;
  url: string;
}

export interface HistoryEvent {
  id: string;
  date: string;
  description: string;
  type: 'PREDICTION_WIN' | 'PREDICTION_LOSS' | 'CONTROVERSY' | 'NEUTRAL_NEWS' | 'SCAM_ALLEGATION' | 'INVESTIGATION';
  token?: string; // e.g., "BTC", "SOL"
  sentiment: Sentiment;
  details: string;
  sourceUrl?: string; // URL to evidence source for this specific event
}

// Engagement Quality Audit Results
export interface EngagementAudit {
  averageLikes: number;
  averageRetweets: number;
  averageReplies: number;
  engagementRate: number; // Percentage
  ghostFollowerRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  analysisNote: string;
}

// Shill/Promotional Content Analysis
export interface ShillAnalysisSummary {
  totalShillTweets: number;
  undisclosedPromos: number;
  disclosedPromos: number;
}

// Engagement Quality Assessment
export type EngagementQuality = 'ORGANIC' | 'MIXED' | 'SUSPICIOUS' | 'BOT_HEAVY';

export interface KOLAnalysis {
  handle: string;
  displayName: string;
  bioSummary: string;
  trustScore: number; // 0 to 100
  identityStatus?: IdentityStatus; // Identity classification (optional for backward compat with cache)
  followersCount?: string;
  walletAddresses?: string[]; // Public wallet addresses found (format: "ETH:0x...", "SOL:...")
  verdict?: string; // One-sentence summary verdict (e.g., "High Risk Scammer")
  engagementQuality?: EngagementQuality; // Assessment of follower authenticity (from search grounding)
  credibilityStrengths: string[]; // List of positive credibility indicators
  riskFactors: string[]; // List of identified risk factors from search results
  engagementAudit?: EngagementAudit; // Detailed engagement metrics (optional, from search grounding)
  shillAnalysis?: ShillAnalysisSummary; // Promotional content analysis (optional, from search grounding)
  history: HistoryEvent[];
  searchQueries?: string[]; // Search queries used by Google Search grounding
  groundedSearch?: boolean; // Indicates if Google Search grounding was used
  lastAnalyzed: string;
  source?: 'cache' | 'api'; // Whether result came from cache or live API
  cachedAt?: number; // Timestamp when result was cached
}

export type LoadingState = 'IDLE' | 'SEARCHING' | 'ANALYZING' | 'COMPLETED' | 'ERROR';

export type Language = 'en' | 'zh-TW' | 'vi';

// ========== TruthGuard AI Types (Hackathon Modules) ==========

// Input type for flexible analysis (Module A)
export type InputType = 'URL' | 'SMS_TEXT' | 'PHONE' | 'IMAGE';

export type FinalVerdict =
  | 'A_MARKETING'
  | 'B_RISKY_MARKETING'
  | 'C_SUSPICIOUS_NEEDS_VERIFICATION'
  | 'D_HIGH_RISK_SCAM';

export type TrustLane = 'OBSERVED' | 'CORROBORATED' | 'MODEL_INFERENCE' | 'UNVERIFIED';

export interface NormalizedInput {
  text?: string;
  url?: string;
  domain?: string;
  phone?: string;
  platform?: string;
  handle?: string;
  profileUrl?: string;
  screenshot?: boolean;
  screenshotOcrText?: string;
  userNote?: string;
}

export interface TrustTaggedValue {
  label: string;
  value: string;
  lane: TrustLane;
}

export interface AgentVerification {
  status: 'NOT_RUN' | 'OBSERVED_URL' | 'OBSERVED_PROFILE' | 'LIMITED';
  originalUrl?: string;
  redirectChain: string[];
  finalLandingPage?: string;
  pageTitle?: string;
  visibleSummary?: string;
  forms: string[];
  ctaButtons: string[];
  asksForLogin: boolean;
  asksForOtp: boolean;
  asksForPayment: boolean;
  asksForAppDownload: boolean;
  asksToAddChat: boolean;
  detectedPattern?: string;
  screenshots: string[];
  riskObservations: TrustTaggedValue[];
}

export interface OfficialRouteResolution {
  status: 'OFFICIAL_CONFIRMED' | 'OFFICIAL_CANDIDATE' | 'OFFICIAL_UNKNOWN';
  label: string;
  url?: string;
  rationale: string;
  lane: TrustLane;
}

export interface PrimaryAction {
  label: string;
  actionUrl?: string;
  kind: 'OFFICIAL_ROUTE' | 'REPORT' | 'HOTLINE' | 'GUIDANCE';
  emphasis: 'primary' | 'secondary' | 'disabled';
  description: string;
}

export interface LikelyLoss {
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AnalysisInput {
  type: InputType;
  content: string;  // The actual handle, URL, or SMS text
}

// Risk Signal (Module B - Explainable Evidence)
export interface RiskSignal {
  type: string;           // e.g., "GUARANTEED_RETURNS", "PRESSURE_TACTICS", "IMPERSONATION"
  evidence: string;       // Specific evidence supporting this signal
  level: 'CRITICAL' | 'WARNING' | 'INFO';
}

// Action Plan (Module C - Action Guidance)
export type ActionType = 'CALL_165' | 'BLOCK' | 'OFFICIAL_CHANNEL' | 'REPORT' | 'VERIFY' | 'IGNORE';

export interface ActionPlan {
  label: string;          // Button text (bilingual)
  actionUrl?: string;     // URL to open (if applicable)
  type: ActionType;
  priority: number;       // 1 = highest priority
}

// Extended Analysis with TruthGuard features
export interface TruthGuardAnalysis extends KOLAnalysis {
  // Module A: Input flexibility
  inputType: InputType;
  originalInput: string;

  // Module B: Explainable evidence
  riskSignals: RiskSignal[];

  // Module C: Action guidance
  suggestedActions: ActionPlan[];

  // Senior mode
  isSeniorMode?: boolean;

  // Scam probability (0-100)
  scamProbability: number;

  // Quick verdict for senior mode
  seniorModeVerdict?: string;

  finalVerdict: FinalVerdict;
  conclusion: string;
  normalizedInput: NormalizedInput;
  primaryActions: PrimaryAction[];
  agentVerification: AgentVerification;
  officialRoute: OfficialRouteResolution;
  likelyLosses: LikelyLoss[];
  trustSummary: TrustTaggedValue[];

  // Cofacts community fact-check
  cofactsResult?: CofactsResult;

  // Service degradation info — tells UI which external services were unavailable
  degradation?: ServiceDegradation;
}

// Service degradation info — populated when external services are unavailable
export type DegradationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface ServiceDegradation {
  level: DegradationLevel;
  score: number;
  services: string[];
}

// Cofacts (cofacts.tw) community fact-check types
export interface CofactsReply {
  text: string;
  type: 'RUMOR' | 'NOT_RUMOR' | 'OPINIONATED' | 'NOT_ARTICLE';
  createdAt: string;
}

export interface CofactsArticle {
  id: string;
  text: string;
  articleType: string;
  replyCount: number;
  createdAt: string;
  replies: CofactsReply[];
}

export interface CofactsResult {
  status: 'FOUND' | 'NOT_FOUND' | 'ERROR';
  totalMatches: number;
  articles: CofactsArticle[];
}
