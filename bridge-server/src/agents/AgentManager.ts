import type { Message, AgentConfig } from '../types';
import { OpenAIService } from '../services/OpenAIService';
import { ToyMuseumAgent } from './ToyMuseumAgent';

export class AgentManager {
  private openaiService: OpenAIService;
  private toyMuseumAgent: ToyMuseumAgent;
  private sessionAgents: Map<string, any> = new Map();

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
    this.toyMuseumAgent = new ToyMuseumAgent(openaiService);
  }

  /**
   * 주어진 agentType에 맞는 Realtime 지침/도구 반환
   */
  getRealtimeConfig() {
    return {
      instructions: this.toyMuseumAgent.getRealtimeInstructions(),
      tools: this.toyMuseumAgent.getRealtimeTools(),
    };
  }

  /**
   * 텍스트 메시지 처리
   */
  async processMessage(sessionId: string, message: Message): Promise<any> {
    try {
      console.log(`메시지 처리 중: 세션=${sessionId}, 타입=${message.type}`);

      // 세션별 에이전트 상태 초기화 (필요한 경우)
      if (!this.sessionAgents.has(sessionId)) {
        this.sessionAgents.set(sessionId, {
          conversationHistory: [],
          currentAgent: 'chatAgent',
          lastActivity: new Date()
        });
      }

      const sessionState = this.sessionAgents.get(sessionId);

      // 메시지를 대화 히스토리에 추가
      sessionState.conversationHistory.push(message);
      sessionState.lastActivity = new Date();

      return null;
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      throw error;
    }
  }


  /**
   * 세션 중단
   */
  interruptSession(sessionId: string): void {
    try {
      console.log(`세션 중단: ${sessionId}`);

      const sessionState = this.sessionAgents.get(sessionId);
      if (sessionState) {
        // 현재 진행 중인 작업 중단
        sessionState.lastActivity = new Date();
      }

      // OpenAI 세션 중단 (실제 구현 필요)

    } catch (error) {
      console.error('세션 중단 오류:', error);
    }
  }

  /**
   * 세션 음소거
   */
  muteSession(sessionId: string, muted: boolean): void {
    try {
      console.log(`세션 음소거 설정: ${sessionId}, 음소거=${muted}`);

      const sessionState = this.sessionAgents.get(sessionId);
      if (sessionState) {
        sessionState.muted = muted;
        sessionState.lastActivity = new Date();
      }

    } catch (error) {
      console.error('세션 음소거 오류:', error);
    }
  }

  /**
   * 세션 연결 해제
   */
  disconnectSession(sessionId: string): void {
    try {
      console.log(`세션 연결 해제: ${sessionId}`);

      // 세션 상태 정리
      this.sessionAgents.delete(sessionId);

      // OpenAI 세션 종료
      this.openaiService.closeSession(sessionId);

    } catch (error) {
      console.error('세션 연결 해제 오류:', error);
    }
  }

  /**
   * 세션 대화 히스토리 조회
   */
  getSessionHistory(sessionId: string): Message[] {
    const sessionState = this.sessionAgents.get(sessionId);
    return sessionState?.conversationHistory || [];
  }

  /**
   * 활성 세션 수 조회
   */
  getActiveSessionCount(): number {
    return this.sessionAgents.size;
  }

  /**
   * 모든 활성 세션 ID 조회
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessionAgents.keys());
  }

  /**
   * 세션 정보 조회
   */
  getSessionInfo(sessionId: string): any {
    const sessionState = this.sessionAgents.get(sessionId);
    if (!sessionState) {
      return null;
    }

    return {
      sessionId,
      currentAgent: sessionState.currentAgent,
      messageCount: sessionState.conversationHistory.length,
      lastActivity: sessionState.lastActivity,
      muted: sessionState.muted || false
    };
  }

  /**
   * 에이전트 전환 (핸드오프)
   */
  async switchAgent(sessionId: string, targetAgent: string): Promise<boolean> {
    try {
      const sessionState = this.sessionAgents.get(sessionId);
      if (!sessionState) {
        return false;
      }

      console.log(`에이전트 전환: ${sessionState.currentAgent} -> ${targetAgent}`);
      sessionState.currentAgent = targetAgent;
      sessionState.lastActivity = new Date();

      return true;
    } catch (error) {
      console.error('에이전트 전환 오류:', error);
      return false;
    }
  }

  /**
   * 비활성 세션 정리
   */
  cleanupInactiveSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sessionsToRemove: string[] = [];

    for (const [sessionId, sessionState] of this.sessionAgents) {
      if (sessionState.lastActivity < oneHourAgo) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this.disconnectSession(sessionId);
    }

    if (sessionsToRemove.length > 0) {
      console.log(`${sessionsToRemove.length}개의 비활성 에이전트 세션이 정리되었습니다.`);
    }
  }
}

// 정기적으로 비활성 세션 정리 (10분마다)
setInterval(() => {
  // AgentManager 인스턴스에 접근할 수 있는 방법이 필요할 때 사용
}, 10 * 60 * 1000);
