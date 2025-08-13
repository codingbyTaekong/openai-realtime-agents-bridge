import type { ClientSession } from '../types';

export class SessionManager {
  private sessions: Map<string, ClientSession> = new Map();

  constructor() {
    // 정기적으로 비활성 세션 정리
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // 1분마다 실행
  }

  /**
   * 새 세션 생성
   */
  createSession(session: ClientSession): void {
    this.sessions.set(session.id, session);
    console.log(`세션 생성됨: ${session.id}`);
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 세션 업데이트
   */
  updateSession(sessionId: string, updates: Partial<ClientSession>): boolean {
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
  removeSession(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId);
    if (removed) {
      console.log(`세션 제거됨: ${sessionId}`);
    }
    return removed;
  }

  /**
   * 모든 세션 조회
   */
  getAllSessions(): ClientSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 활성 세션 수 조회
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 사용자별 세션 조회
   */
  getSessionsByUserId(userId: string): ClientSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId
    );
  }

  /**
   * 비활성 세션 정리 (30분 이상 비활성)
   */
  private cleanupInactiveSessions(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const sessionsToRemove: string[] = [];

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
  updateLastActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * 세션 상태 변경
   */
  updateSessionStatus(sessionId: string, status: ClientSession['status']): boolean {
    return this.updateSession(sessionId, { status });
  }
}
