import OpenAI from 'openai';
import type { OpenAISessionConfig } from '../types';

export class OpenAIService {
  private openai: OpenAI;
  private sessions: Map<string, any> = new Map();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  /**
   * OpenAI 세션 생성 (ephemeral key)
   */
  async createSession(): Promise<any> {
    try {
      const response = await this.openai.realtime.sessions.create({
        model: "gpt-4o-realtime-preview-2025-06-03",
      });

      console.log('OpenAI 세션 생성됨:', response.id);
      return response;

    } catch (error) {
      console.error('OpenAI 세션 생성 오류:', error);
      throw new Error('OpenAI 세션 생성에 실패했습니다.');
    }
  }

  /**
   * 실시간 세션 생성 및 설정
   */
  async createRealtimeSession(sessionId: string, config?: Partial<OpenAISessionConfig>): Promise<any> {
    try {
      const defaultConfig: OpenAISessionConfig = {
        model: "gpt-4o-realtime-preview-2025-06-03",
        voice: "sage",
        inputAudioFormat: "pcm16",
        outputAudioFormat: "pcm16",
        inputAudioTranscription: {
          model: "gpt-4o-mini-transcribe"
        }
      };

      const sessionConfig = { ...defaultConfig, ...config };
      
      // 실제 OpenAI Realtime Session 객체를 저장
      const session = {
        id: sessionId,
        config: sessionConfig,
        status: 'active',
        createdAt: new Date()
      };

      this.sessions.set(sessionId, session);
      
      console.log(`실시간 세션 설정됨: ${sessionId}`, sessionConfig);
      return session;

    } catch (error) {
      console.error('실시간 세션 생성 오류:', error);
      throw new Error('실시간 세션 생성에 실패했습니다.');
    }
  }

  /**
   * 텍스트 메시지를 OpenAI에 전송
   */
  async sendTextMessage(sessionId: string, message: string): Promise<any> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      // OpenAI Responses API 사용
      const response = await this.openai.responses.create({
        model: 'gpt-4.1',
        input: [
          {
            type: 'message',
            role: 'user',
            content: message
          }
        ]
      });

      console.log(`텍스트 메시지 처리됨: ${sessionId}`);
      return response;

    } catch (error) {
      console.error('텍스트 메시지 전송 오류:', error);
      throw new Error('텍스트 메시지 전송에 실패했습니다.');
    }
  }

  /**
   * 오디오 메시지를 OpenAI에 전송
   */
  async sendAudioMessage(sessionId: string, audioData: Buffer): Promise<any> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      // 오디오 데이터를 Base64로 인코딩
      const base64Audio = audioData.toString('base64');

      // OpenAI에 오디오 메시지 전송 (실제 구현은 Realtime API 사용)
      console.log(`오디오 메시지 처리됨: ${sessionId}, 크기: ${audioData.length}바이트`);
      
      // 임시 응답 (실제로는 Realtime API 응답)
      return {
        type: 'audio_response',
        sessionId: sessionId,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('오디오 메시지 전송 오류:', error);
      throw new Error('오디오 메시지 전송에 실패했습니다.');
    }
  }

  /**
   * 함수 호출 처리
   */
  async executeFunctionCall(functionName: string, arguments_: any): Promise<any> {
    try {
      console.log(`함수 호출: ${functionName}`, arguments_);

      // 함수별 처리 로직
      switch (functionName) {
        case 'getUserAccountInfo':
          return this.getUserAccountInfo(arguments_.phone_number);
        
        case 'lookupPolicyDocument':
          return this.lookupPolicyDocument(arguments_.topic);
        
        case 'findNearestStore':
          return this.findNearestStore(arguments_.zip_code);
        
        default:
          throw new Error(`알 수 없는 함수: ${functionName}`);
      }

    } catch (error) {
      console.error('함수 호출 오류:', error);
      throw error;
    }
  }

  /**
   * 세션 종료
   */
  async closeSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        // 세션 정리 작업
        this.sessions.delete(sessionId);
        console.log(`세션 종료됨: ${sessionId}`);
      }
    } catch (error) {
      console.error('세션 종료 오류:', error);
    }
  }

  /**
   * 모든 활성 세션 조회
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 사용자 계정 정보 조회 (샘플 데이터)
   */
  private getUserAccountInfo(phoneNumber: string): any {
    // 샘플 데이터 (실제로는 데이터베이스에서 조회)
    return {
      accountId: "NT-123456",
      name: "Alex Johnson",
      phone: phoneNumber,
      email: "alex.johnson@email.com",
      plan: "Unlimited Plus",
      balanceDue: "$42.17",
      lastBillDate: "2024-05-15",
      lastPaymentDate: "2024-05-20",
      lastPaymentAmount: "$42.17",
      status: "Active",
      address: {
        street: "1234 Pine St",
        city: "Seattle",
        state: "WA",
        zip: "98101"
      }
    };
  }

  /**
   * 정책 문서 조회 (샘플 데이터)
   */
  private lookupPolicyDocument(topic: string): any[] {
    // 샘플 데이터 (실제로는 문서 검색 시스템에서 조회)
    const sampleDocs = [
      {
        id: "ID-010",
        name: "Family Plan Policy",
        topic: "family plan options",
        content: "The family plan allows up to 5 lines per account. All lines share a single data pool."
      },
      {
        id: "ID-020",
        name: "Promotions and Discounts Policy",
        topic: "promotions and discounts",
        content: "The Summer Unlimited Data Sale provides a 20% discount on the Unlimited Plus plan."
      }
    ];

    return sampleDocs.filter(doc => 
      doc.topic.toLowerCase().includes(topic.toLowerCase()) ||
      doc.content.toLowerCase().includes(topic.toLowerCase())
    );
  }

  /**
   * 가장 가까운 매장 찾기 (샘플 데이터)
   */
  private findNearestStore(zipCode: string): any[] {
    // 샘플 데이터 (실제로는 지리적 검색 서비스 사용)
    return [
      {
        name: "NewTelco Downtown Store",
        address: "1234 Main St, City, State",
        zip_code: zipCode,
        phone: "(555) 123-4567",
        hours: "Mon-Sat 10am-7pm, Sun 11am-5pm"
      }
    ];
  }
}
