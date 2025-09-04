import type { Message } from '../types';
import { OpenAIService } from '../services/OpenAIService';
export interface SupervisorResponse {
    nextResponse: string;
    error?: string;
}
export interface AgentResponse {
    content: string;
    type: 'text' | 'audio';
    timestamp: number;
    metadata?: any;
}
export declare class ChatSupervisorAgent {
    private openaiService;
    private whisperService;
    private readonly companyName;
    private readonly sampleAccountInfo;
    private readonly samplePolicyDocs;
    private readonly sampleStoreLocations;
    constructor(openaiService: OpenAIService);
    /**
     * Realtime 세션용 시스템 지침 반환 (공개)
     */
    getRealtimeInstructions(): string;
    /**
     * Realtime 세션용 도구 스키마 반환 (공개)
     */
    getRealtimeTools(): any[];
    /**
     * 텍스트 메시지 처리 (chatAgent 역할)
     */
    processTextMessage(sessionId: string, userMessage: string, conversationHistory: Message[]): Promise<AgentResponse>;
    /**
     * 오디오 메시지 처리
     */
    processAudioMessage(sessionId: string, audioMessage: Message, conversationHistory?: Message[]): Promise<AgentResponse>;
    /**
     * 직접 처리 가능한 메시지인지 확인
     */
    private shouldHandleDirectly;
    /**
     * 직접 응답 처리
     */
    private handleDirectResponse;
    /**
     * Supervisor Agent에서 다음 응답 가져오기
     */
    private getNextResponseFromSupervisor;
    /**
     * 도구 호출 처리
     */
    private handleToolCalls;
    /**
     * 도구 응답 가져오기
     */
    private getToolResponse;
    /**
     * 필러 문구 랜덤 선택
     */
    private getRandomFillerPhrase;
    /**
     * Supervisor Agent 지침 반환
     */
    private getSupervisorInstructions;
    /**
     * Supervisor Agent 도구 정의
     */
    private getSupervisorTools;
}
//# sourceMappingURL=ChatSupervisorAgent.d.ts.map