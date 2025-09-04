import type { Message } from '../types';
import { OpenAIService } from '../services/OpenAIService';
export declare class AgentManager {
    private openaiService;
    private chatSupervisorAgent;
    private sessionAgents;
    constructor(openaiService: OpenAIService);
    /**
     * Realtime용 supervisor 설정 노출
     */
    getSupervisorRealtimeConfig(): {
        instructions: string;
        tools: any[];
    };
    /**
     * 텍스트 메시지 처리
     */
    processMessage(sessionId: string, message: Message): Promise<any>;
    /**
     * 오디오 메시지 처리
     */
    processAudioMessage(sessionId: string, audioMessage: Message): Promise<any>;
    /**
     * 세션 중단
     */
    interruptSession(sessionId: string): void;
    /**
     * 세션 음소거
     */
    muteSession(sessionId: string, muted: boolean): void;
    /**
     * 세션 연결 해제
     */
    disconnectSession(sessionId: string): void;
    /**
     * 세션 대화 히스토리 조회
     */
    getSessionHistory(sessionId: string): Message[];
    /**
     * 활성 세션 수 조회
     */
    getActiveSessionCount(): number;
    /**
     * 모든 활성 세션 ID 조회
     */
    getActiveSessionIds(): string[];
    /**
     * 세션 정보 조회
     */
    getSessionInfo(sessionId: string): any;
    /**
     * 에이전트 전환 (핸드오프)
     */
    switchAgent(sessionId: string, targetAgent: string): Promise<boolean>;
    /**
     * 비활성 세션 정리
     */
    cleanupInactiveSessions(): void;
}
//# sourceMappingURL=AgentManager.d.ts.map