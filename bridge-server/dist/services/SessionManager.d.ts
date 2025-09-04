import type { ClientSession } from '../types';
export declare class SessionManager {
    private sessions;
    constructor();
    /**
     * 새 세션 생성
     */
    createSession(session: ClientSession): void;
    /**
     * 세션 조회
     */
    getSession(sessionId: string): ClientSession | undefined;
    /**
     * 세션 업데이트
     */
    updateSession(sessionId: string, updates: Partial<ClientSession>): boolean;
    /**
     * 세션 제거
     */
    removeSession(sessionId: string): boolean;
    /**
     * 모든 세션 조회
     */
    getAllSessions(): ClientSession[];
    /**
     * 활성 세션 수 조회
     */
    getActiveSessionCount(): number;
    /**
     * 사용자별 세션 조회
     */
    getSessionsByUserId(userId: string): ClientSession[];
    /**
     * 비활성 세션 정리 (30분 이상 비활성)
     */
    private cleanupInactiveSessions;
    /**
     * 세션 활동 시간 업데이트
     */
    updateLastActivity(sessionId: string): void;
    /**
     * 세션 상태 변경
     */
    updateSessionStatus(sessionId: string, status: ClientSession['status']): boolean;
}
//# sourceMappingURL=SessionManager.d.ts.map