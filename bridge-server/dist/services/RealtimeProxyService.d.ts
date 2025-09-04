import { EventEmitter } from 'events';
export interface RealtimeProxyOptions {
    apiKey: string;
    model?: string;
    voice?: string;
    sessionId: string;
    instructions?: string;
    tools?: any[];
}
/**
 * OpenAI Realtime API WebSocket 프록시 서비스
 * 클라이언트와 OpenAI Realtime API 간의 실시간 연결을 중계
 */
export declare class RealtimeProxyService extends EventEmitter {
    private openaiWs;
    private sessionId;
    private apiKey;
    private isConnected;
    private model;
    private voice?;
    private instructions?;
    private tools?;
    constructor(options: RealtimeProxyOptions);
    /**
     * OpenAI Realtime API WebSocket 연결
     */
    connect(): Promise<void>;
    /**
     * 클라이언트 메시지를 OpenAI로 전달
     */
    sendToOpenAI(message: any): void;
    /**
     * 오디오 데이터를 OpenAI로 전송
     */
    sendAudioToOpenAI(audioData: Buffer): void;
    /**
     * 오디오 입력 커밋 (처리 시작)
     */
    commitAudioInput(): void;
    /**
     * 오디오 입력 클리어
     */
    clearAudioInput(): void;
    /**
     * 응답 생성 트리거
     */
    createResponse(): void;
    /**
     * 현재 응답 중단
     */
    cancelResponse(): void;
    /**
     * OpenAI 이벤트 처리
     */
    private handleOpenAIEvent;
    /**
     * 연결 해제
     */
    disconnect(): void;
    /**
     * 연결 상태 확인
     */
    get connected(): boolean;
    /**
     * 세션 설정 업데이트
     */
    updateSession(sessionConfig: any): void;
    /**
     * 사용자 텍스트 메시지 전송
     */
    sendTextMessage(text: string): void;
}
//# sourceMappingURL=RealtimeProxyService.d.ts.map