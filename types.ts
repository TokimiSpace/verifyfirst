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
  source?: 'cache' | 'api' | 'local'; // Cache, verified service response, or on-device fallback
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
  status: 'NOT_RUN' | 'OBSERVED_URL' | 'OBSERVED_PROFILE' | 'BOT_BLOCKED' | 'NOT_FOUND' | 'LIMITED';
  originalUrl?: string;
  redirectChain: string[];
  finalLandingPage?: string;
  httpStatus?: number | null;
  pageStatus?: string;
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
  x402Preflight?: IffX402Preflight;
}

export type IffX402Verdict = 'consistent' | 'diverged' | 'stale' | 'unobserved';
export type IffX402PreflightStatus = 'VERIFIED' | 'INVALID_REQUIREMENT' | 'UNAVAILABLE';

export interface IffX402Preflight {
  provider: 'ifandonlyif.io';
  evidenceBaseUrl?: string;
  evidenceSource: 'IFF_PUBLIC_API' | 'IFF_CUSTOM_API' | 'SIMULATED' | 'UNAVAILABLE';
  status: IffX402PreflightStatus;
  verdict?: IffX402Verdict;
  divergenceKind?: 'amount_only' | 'payee';
  matchesLastObserved?: boolean;
  known?: boolean;
  ownershipStatus?: string;
  ownershipMethod?: string;
  ownershipVerifiedAt?: string;
  observedAt?: string;
  stableSince?: string;
  monitorId?: string;
  monitorPublicKey?: string;
  monitorSignature?: string;
  reportHash?: string;
  receivedFingerprint?: string;
  receivedOptionFingerprints?: string[];
  fingerprintVersion?: number;
  localReceivedFingerprint?: string;
  localReceivedOptionFingerprints?: string[];
  localPayeeFingerprint?: string;
  localPayeeOptionFingerprints?: string[];
  receivedFingerprintMatchesLocal?: boolean;
  observedFingerprint?: string;
  observedOptionFingerprints?: string[];
  unmatchedReceivedOptions?: string[];
  history?: Array<{ setFingerprint: string; firstSeen: string; lastSeen: string; observations: number }>;
  inclusionAvailable: boolean;
  inclusionTreeSize?: number;
  inclusionLogIndex?: number;
  inclusionAuditPath?: string[];
  inclusionSignedTreeHead?: {
    logId: string;
    treeSize: number;
    timestamp: string;
    rootHash: string;
    signature: string;
    publicKey: string;
  };
  disclaimer?: string;
  errorCode?: string;
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

// ========== VerifyFirst Sandbox — trusted Agent controls ==========

export type AgentGrantStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type AgentDecision = 'ALLOW' | 'REQUIRE_CONFIRMATION' | 'DENY';
export type AgentActionKind =
  | 'OBSERVE_URL'
  | 'CHECK_IDENTITY'
  | 'READ_PUBLIC_DATA'
  | 'SUBMIT_PERSONAL_DATA'
  | 'LOGIN'
  | 'PAYMENT'
  | 'REQUEST_OTP'
  | 'DOWNLOAD_APP';

export interface AgentGrant {
  id: string;
  agentId: string;
  agentName: string;
  agentPurpose: string;
  userName: string;
  status: AgentGrantStatus;
  issuedAt: string;
  expiresAt: string;
  allowedTargets: string[];
  allowedActions: AgentActionKind[];
  confirmationActions: AgentActionKind[];
  deniedActions: AgentActionKind[];
}

export interface AgentActionRequest {
  id: string;
  grantId: string;
  action: AgentActionKind;
  target: string;
  purpose: string;
  dataFields?: string[];
}

export interface AgentPolicyResult {
  decision: AgentDecision;
  reasonCode: string;
  reason: string;
  matchedRule: string;
  evaluatedAt: string;
}

export interface AgentEvidencePacket {
  schema: 'verifyfirst.agent-decision.v1';
  id: string;
  createdAt: string;
  policyVersion: 'verifyfirst.sandbox-policy.v1';
  grant: AgentGrant;
  request: AgentActionRequest;
  result: AgentPolicyResult;
  parentEvidenceId?: string;
  integrity: {
    algorithm: 'SHA-256';
    digest: string;
  };
}

export interface TrustTimelineEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  decision: AgentDecision | 'INFO';
  detail: string;
  evidenceId: string;
}

// Browser-side enterprise verification summaries. Raw credentials are kept
// in memory only and are deliberately excluded from the persisted workspace.
export type EnterpriseVerificationKind = 'LEI_LOOKUP' | 'VLEI_CHAIN' | 'X402_PREFLIGHT';

export interface EnterpriseVerificationRecord {
  id: string;
  kind: EnterpriseVerificationKind;
  source: string;
  trustDomain: 'GLEIF_GOLDEN_COPY' | 'GLEIF_PRODUCTION' | 'GLEIF_TEST_FIXTURE' | 'IFF_PUBLIC_EVIDENCE' | 'IFF_CUSTOM_EVIDENCE' | 'IFF_UNAVAILABLE' | 'LOCAL_X402_SIMULATION';
  subject: string;
  decision: string;
  checkedAt: string;
  digest: string;
  limitations: string[];
  metadata: Record<string, string | number | boolean>;
}

// ========== Credential exposure incident response ==========

export type CredentialIncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type CredentialActionPhase = 'REVOKE' | 'REISSUE' | 'DEPLOY' | 'REVIEW' | 'VERIFY';
export type CredentialActionStatus = 'PENDING' | 'COMPLETED';

export interface CredentialService {
  id: string;
  label: string;
  severity: CredentialIncidentSeverity;
  matchedNames: string[];
}

export interface CredentialIncidentAnalysis {
  id: string;
  sourceUrl?: string;
  detectedAt: string;
  exposedNames: string[];
  services: CredentialService[];
}

export interface CredentialEnvironmentReference {
  id: string;
  label: string;
  system: string;
}

export interface CredentialInventoryMatch {
  name: string;
  service: string;
  severity: CredentialIncidentSeverity;
  environments: CredentialEnvironmentReference[];
}

export interface CredentialEnvironmentInventory extends CredentialEnvironmentReference {
  credentialNames: string[];
}

export interface CredentialResponseAction {
  id: string;
  phase: CredentialActionPhase;
  title: string;
  detail: string;
  affectedNames: string[];
  affectedEnvironments: CredentialEnvironmentReference[];
  owner: string;
  status: CredentialActionStatus;
  completedAt?: string;
  evidenceId?: string;
}

export interface CredentialIncidentWorkspace {
  version: 2;
  analysis: CredentialIncidentAnalysis;
  inventoryNames: string[];
  environments: CredentialEnvironmentInventory[];
  matches: CredentialInventoryMatch[];
  actions: CredentialResponseAction[];
  timeline: TrustTimelineEvent[];
}
