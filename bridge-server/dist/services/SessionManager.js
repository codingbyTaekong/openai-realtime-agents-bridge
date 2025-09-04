"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
class SessionManager {
    constructor() {
        this.sessions = new Map();
        // 정기적으로 비활성 세션 정리
        setInterval(() => {
            this.cleanupInactiveSessions();
        }, 60000); // 1분마다 실행
    }
    /**
     * 새 세션 생성
     */
    createSession(session) {
        this.sessions.set(session.id, session);
        console.log(`세션 생성됨: ${session.id}`);
    }
    /**
     * 세션 조회
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * 세션 업데이트
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }
        const updatedSession = {
            ...session,
            ...updates,
            lastActivity: new Date()
        };
        this.sessions.set(sessionId, updatedSession);
        return true;
    }
    /**
     * 세션 제거
     */
    removeSession(sessionId) {
        const removed = this.sessions.delete(sessionId);
        if (removed) {
            console.log(`세션 제거됨: ${sessionId}`);
        }
        return removed;
    }
    /**
     * 모든 세션 조회
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * 활성 세션 수 조회
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }
    /**
     * 사용자별 세션 조회
     */
    getSessionsByUserId(userId) {
        return Array.from(this.sessions.values()).filter(session => session.userId === userId);
    }
    /**
     * 비활성 세션 정리 (30분 이상 비활성)
     */
    cleanupInactiveSessions() {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const sessionsToRemove = [];
        for (const [sessionId, session] of this.sessions) {
            if (session.lastActivity < thirtyMinutesAgo) {
                sessionsToRemove.push(sessionId);
            }
        }
        for (const sessionId of sessionsToRemove) {
            this.removeSession(sessionId);
            console.log(`비활성 세션 정리됨: ${sessionId}`);
        }
        if (sessionsToRemove.length > 0) {
            console.log(`${sessionsToRemove.length}개의 비활성 세션이 정리되었습니다.`);
        }
    }
    /**
     * 세션 활동 시간 업데이트
     */
    updateLastActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }
    /**
     * 세션 상태 변경
     */
    updateSessionStatus(sessionId, status) {
        return this.updateSession(sessionId, { status });
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=SessionManager.js.map