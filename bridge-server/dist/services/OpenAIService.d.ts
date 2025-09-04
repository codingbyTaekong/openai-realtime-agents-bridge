import type { OpenAISessionConfig } from '../types';
export declare class OpenAIService {
    private openai;
    private sessions;
    constructor();
    /**
     * OpenAI 세션 생성 (ephemeral key)
     */
    createSession(): Promise<any>;
    /**
     * 실시간 세션 생성 및 설정
     */
    createRealtimeSession(sessionId: string, config?: Partial<OpenAISessionConfig>): Promise<any>;
    /**
     * 텍스트 메시지를 OpenAI에 전송
     */
    sendTextMessage(sessionId: string, message: string): Promise<any>;
    /**
     * 오디오 메시지를 OpenAI에 전송
     */
    sendAudioMessage(sessionId: string, audioData: Buffer): Promise<any>;
    /**
     * 함수 호출 처리
     */
    executeFunctionCall(functionName: string, arguments_: any): Promise<any>;
    /**
     * 세션 종료
     */
    closeSession(sessionId: string): Promise<void>;
    /**
     * 모든 활성 세션 조회
     */
    getActiveSessions(): string[];
    /**
     * 사용자 계정 정보 조회 (샘플 데이터)
     */
    private getUserAccountInfo;
    /**
     * 정책 문서 조회 (샘플 데이터)
     */
    private lookupPolicyDocument;
    /**
     * 가장 가까운 매장 찾기 (샘플 데이터)
     */
    private findNearestStore;
}
//# sourceMappingURL=OpenAIService.d.ts.map