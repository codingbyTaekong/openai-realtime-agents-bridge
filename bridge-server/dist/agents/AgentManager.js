"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentManager = void 0;
const ChatSupervisorAgent_1 = require("./ChatSupervisorAgent");
class AgentManager {
    constructor(openaiService) {
        this.sessionAgents = new Map();
        this.openaiService = openaiService;
        this.chatSupervisorAgent = new ChatSupervisorAgent_1.ChatSupervisorAgent(openaiService);
    }
    /**
     * Realtime용 supervisor 설정 노출
     */
    getSupervisorRealtimeConfig() {
        return {
            instructions: this.chatSupervisorAgent.getRealtimeInstructions(),
            tools: this.chatSupervisorAgent.getRealtimeTools(),
        };
    }
    /**
     * 텍스트 메시지 처리
     */
    async processMessage(sessionId, message) {
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
            // 텍스트 메시지인 경우 chatSupervisor 에이전트로 처리
            if (message.type === 'text') {
                const response = await this.chatSupervisorAgent.processTextMessage(sessionId, message.content, sessionState.conversationHistory);
                // 응답을 대화 히스토리에 추가
                if (response) {
                    const assistantMessage = {
                        id: `resp_${Date.now()}`,
                        type: 'text',
                        content: response.content || '',
                        role: 'assistant',
                        timestamp: Date.now()
                    };
                    sessionState.conversationHistory.push(assistantMessage);
                }
                return response;
            }
            return null;
        }
        catch (error) {
            console.error('메시지 처리 오류:', error);
            throw error;
        }
    }
    /**
     * 오디오 메시지 처리
     */
    async processAudioMessage(sessionId, audioMessage) {
        try {
            console.log(`오디오 메시지 처리 중: 세션=${sessionId}`);
            // 세션별 에이전트 상태 초기화 (필요한 경우)
            if (!this.sessionAgents.has(sessionId)) {
                this.sessionAgents.set(sessionId, {
                    conversationHistory: [],
                    currentAgent: 'chatAgent',
                    lastActivity: new Date()
                });
            }
            const sessionState = this.sessionAgents.get(sessionId);
            // 오디오 메시지를 대화 히스토리에 추가
            sessionState.conversationHistory.push(audioMessage);
            sessionState.lastActivity = new Date();
            // 오디오 처리 - 대화 히스토리와 함께 전달
            const response = await this.chatSupervisorAgent.processAudioMessage(sessionId, audioMessage, sessionState.conversationHistory);
            return response;
        }
        catch (error) {
            console.error('오디오 메시지 처리 오류:', error);
            throw error;
        }
    }
    /**
     * 세션 중단
     */
    interruptSession(sessionId) {
        try {
            console.log(`세션 중단: ${sessionId}`);
            const sessionState = this.sessionAgents.get(sessionId);
            if (sessionState) {
                // 현재 진행 중인 작업 중단
                sessionState.lastActivity = new Date();
            }
            // OpenAI 세션 중단 (실제 구현 필요)
        }
        catch (error) {
            console.error('세션 중단 오류:', error);
        }
    }
    /**
     * 세션 음소거
     */
    muteSession(sessionId, muted) {
        try {
            console.log(`세션 음소거 설정: ${sessionId}, 음소거=${muted}`);
            const sessionState = this.sessionAgents.get(sessionId);
            if (sessionState) {
                sessionState.muted = muted;
                sessionState.lastActivity = new Date();
            }
        }
        catch (error) {
            console.error('세션 음소거 오류:', error);
        }
    }
    /**
     * 세션 연결 해제
     */
    disconnectSession(sessionId) {
        try {
            console.log(`세션 연결 해제: ${sessionId}`);
            // 세션 상태 정리
            this.sessionAgents.delete(sessionId);
            // OpenAI 세션 종료
            this.openaiService.closeSession(sessionId);
        }
        catch (error) {
            console.error('세션 연결 해제 오류:', error);
        }
    }
    /**
     * 세션 대화 히스토리 조회
     */
    getSessionHistory(sessionId) {
        const sessionState = this.sessionAgents.get(sessionId);
        return sessionState?.conversationHistory || [];
    }
    /**
     * 활성 세션 수 조회
     */
    getActiveSessionCount() {
        return this.sessionAgents.size;
    }
    /**
     * 모든 활성 세션 ID 조회
     */
    getActiveSessionIds() {
        return Array.from(this.sessionAgents.keys());
    }
    /**
     * 세션 정보 조회
     */
    getSessionInfo(sessionId) {
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
    async switchAgent(sessionId, targetAgent) {
        try {
            const sessionState = this.sessionAgents.get(sessionId);
            if (!sessionState) {
                return false;
            }
            console.log(`에이전트 전환: ${sessionState.currentAgent} -> ${targetAgent}`);
            sessionState.currentAgent = targetAgent;
            sessionState.lastActivity = new Date();
            return true;
        }
        catch (error) {
            console.error('에이전트 전환 오류:', error);
            return false;
        }
    }
    /**
     * 비활성 세션 정리
     */
    cleanupInactiveSessions() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const sessionsToRemove = [];
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
exports.AgentManager = AgentManager;
// 정기적으로 비활성 세션 정리 (10분마다)
setInterval(() => {
    // AgentManager 인스턴스에 접근할 수 있는 방법이 필요할 때 사용
}, 10 * 60 * 1000);
//# sourceMappingURL=AgentManager.js.map