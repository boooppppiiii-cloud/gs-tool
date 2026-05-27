/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatRecord {
  time: string;
  roleName: string;
  type: string;
  content: string;
  target: string;
}

export interface RechargeRecord {
  amount: string;
  roleName: string;
  status: string;
  method: string;
}

export interface ServerProfile {
  id: string;
  name: string;
  keyPlayers?: string[];
  openingDate: string;
  mergeStage?: string;
  gsName?: string;
  group?: string;
  gsPersona?: {
    age?: string;
    hometown?: string;
    occupation?: string;
    family?: string;
    lifestyle?: string;
    others?: string;
  };
  serverEcology?: string;
  persistentPortraits?: {
    [roleName: string]: {
      paymentHabits: string;
      personality: string;
      gameHabits: string;
      realLifePersona: string;
      summary: string;
      occupation?: string;
      combatRanking?: string;
      lastUpdated: string;
    };
  };
  ownerId: string;
}

export interface ExecutionRecord {
  id: string;
  historyRecordId: string;
  playerName: string;
  outburstIndex: number;
  outburstTitle: string;
  serverProfileName: string;
  category: '待推进' | '已解决';
  submissionStatus: '草稿' | '待审核' | '已完成' | '待归档';
  date: string;
  description: string;
  reflection?: string;
  attachments: { name: string; type: string; dataUrl: string }[];
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  group?: string;
  caseContent?: string;
}

export interface ServerContext extends ServerProfile {}

export interface GsCommunicationReport {
  roleName: string;
  activeCount: number;
  passiveCount: number;
  badCount: number;
  contentTypes: { inGame: number; outGame: number };
  hasIntervened: boolean;
  interventionSummary: string;
}

export interface AnalysisResult {
  identifiedKeyPlayers: string[]; // AI determined key players
  playerReports: PlayerBehaviorReport[];
  rechargeReport: RechargeReport;
  serverEcology: string; // AI generated ecology summary
  gsCommunicationReports?: GsCommunicationReport[];
  _usage?: { inputTokens: number; outputTokens: number };
}

export interface PortraitItem {
  label: string;    // 信息词条
  value: string;    // 玩家具体信息（仅来自数据）
  evidence: string; // 信息依据
  obtained: boolean;
}

export interface PortraitDimension {
  name: string;           // e.g. "维度一：现实属性"
  items: PortraitItem[];
  completionRate: number; // obtained / total, 0-1
}

export interface PortraitTable {
  isKeyPlayer: boolean;   // 开服3天内充值≥500元
  basicData: {
    totalRecharge: number;
    recentActivity: string;
    anomalySignals: string;
  };
  dimensions: PortraitDimension[];
  overallCompletion: number; // total obtained / total items
}

export interface PlayerBehaviorReport {
  roleName: string;
  portrait: {
    paymentHabits: string;
    personality: string;
    gameHabits: string;
    realLifePersona: string;
    summary: string;
  };
  portraitTable?: PortraitTable;
  negativeOutbursts: {
    title?: string;          // AI 生成的案例标题
    tags?: string[];         // AI 生成的标签
    mergeStage?: string;     // 合服阶段
    caseBackground?: string; // 案例背景
    trigger: string;
    context: {
      roleName: string;
      content: string;
      time: string;
    }[]; // 上下文用于展示微信气泡
    triggerPoint: string; // 负面触发点
    gsAdvice: {
      action: string;      // 具体动作
      reason: string;
      disposalPlan: string; // GS 处置方案（综合建议）
      resultEvaluation?: string; // 案例结果评估
      resultTags?: string[];     // 结果标签
    };
  }[];
}

export interface RechargeReport {
  totalPaid: number;
  totalUnpaid: number;
  playerSummaries: {
    roleName: string;
    totalPaid: number;
    isConverted: boolean;
    conversionDetails: string;
    paymentHabits: string;
  }[];
  paymentProfile: string;
  rechargeData: { name: string; value: number }[]; // For visualization
}

export interface User {
  id: string;
  username: string;
  email?: string;
  hashedPassword?: string;
}

export interface AnalysisCase {
  id: string;
  title: string;
  tags: string[];         // 案例类型
  serverName: string;     // 区服
  gsName: string;         // GS
  playerName: string;     // 玩家
  mergeStage?: string;     // 合服阶段，如：新服、双合、三合、多合
  caseBackground?: string; // 案例背景
  outburstReason: string; // 玩家爆发负面原因
  triggerPoint: string;   // 负面触发点
  context: {              // 溯源上下文
    roleName: string;
    content: string;
    time: string;
  }[];
  gsAction: string;       // GS 具体处置动作
  disposalPlan: string;   // GS 处置方案 (综合/处置策略)
  caseResult: string;     // 案例结果
  timestamp: string;
  views: number;
  likes: number;
  votedUserIds?: string[];
  isHot?: boolean;
  isPublic: boolean;
  ownerId: string;
}

export interface LeaderReview {
  id: string;
  executionRecordId: string;
  isGsCaused: boolean | null;
  comment: string;
  decision: '打回' | '继续推进' | '结案' | null;
  aiCheckResult?: string;
  reviewedAt: string;
  reviewerId: string;
  memberUserId?: string;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  serverConfig: ServerContext;
  result: AnalysisResult;
  group?: string;
  hasCsv?: boolean;
}

export interface MonthHistory {
  month: string;
  records: HistoryRecord[];
}
