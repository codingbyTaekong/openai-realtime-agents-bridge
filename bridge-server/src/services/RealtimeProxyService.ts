import WebSocket from 'ws';
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
export class RealtimeProxyService extends EventEmitter {
  private openaiWs: WebSocket | null = null;
  private sessionId: string;
  private apiKey: string;
  private isConnected: boolean = false;
  private model: string;
  private voice?: string;
  private instructions?: string;
  private tools?: any[];

  constructor(options: RealtimeProxyOptions) {
    super();
    this.sessionId = options.sessionId;
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-4o-realtime-preview-2025-06-03';
    this.voice = options.voice || 'sage';
    this.instructions = options.instructions;
    this.tools = options.tools;
  }

  /**
   * OpenAI Realtime API WebSocket 연결
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`OpenAI Realtime WebSocket 연결 시작: ${this.sessionId}`);

        // OpenAI Realtime API WebSocket URL
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`;
        
        this.openaiWs = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        this.openaiWs.on('open', () => {
          console.log(`OpenAI Realtime WebSocket 연결됨: ${this.sessionId}`);
          this.isConnected = true;
          
          // 초기 세션 설정
          this.sendToOpenAI({
            type: 'session.update',
            session: {
              model: this.model,
              voice: this.voice,
              instructions: this.instructions,
              tools: this.tools,
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'gpt-4o-mini-transcribe'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.9,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true
              }
            }
          });

          resolve();
        });

        this.openaiWs.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`OpenAI → 클라이언트: ${message.type}`, {
              sessionId: this.sessionId,
              eventType: message.type
            });
            
            // 클라이언트로 메시지 전달
            this.emit('openai_message', message);
            
            // 특정 이벤트 처리
            this.handleOpenAIEvent(message);
            
          } catch (error) {
            console.error('OpenAI 메시지 파싱 오류:', error);
          }
        });

        this.openaiWs.on('error', (error) => {
          console.error(`OpenAI WebSocket 오류 (${this.sessionId}):`, error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        });

        this.openaiWs.on('close', (code, reason) => {
          console.log(`OpenAI WebSocket 연결 해제 (${this.sessionId}): ${code} - ${reason}`);
          this.isConnected = false;
          this.emit('disconnected', { code, reason: reason.toString() });
        });

      } catch (error) {
        console.error('OpenAI WebSocket 연결 실패:', error);
        reject(error);
      }
    });
  }

  /**
   * 클라이언트 메시지를 OpenAI로 전달
   */
  sendToOpenAI(message: any): void {
    if (!this.openaiWs || this.openaiWs.readyState !== WebSocket.OPEN) {
      console.warn('OpenAI WebSocket이 연결되지 않음');
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.openaiWs.send(messageStr);
      
      console.log(`클라이언트 → OpenAI: ${message.type}`, {
        sessionId: this.sessionId,
        eventType: message.type
      });

    } catch (error) {
      console.error('OpenAI 메시지 전송 오류:', error);
      this.emit('error', error);
    }
  }

  /**
   * 오디오 데이터를 OpenAI로 전송
   */
  sendAudioToOpenAI(audioData: Buffer): void {
    if (!this.isConnected) {
      console.warn('OpenAI WebSocket이 연결되지 않음 - 오디오 전송 실패');
      return;
    }

    // Base64로 인코딩하여 전송
    const base64Audio = audioData.toString('base64');
    
    this.sendToOpenAI({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  /**
   * 오디오 입력 커밋 (처리 시작)
   */
  commitAudioInput(): void {
    this.sendToOpenAI({
      type: 'input_audio_buffer.commit'
    });
  }

  /**
   * 오디오 입력 클리어
   */
  clearAudioInput(): void {
    this.sendToOpenAI({
      type: 'input_audio_buffer.clear'
    });
  }

  /**
   * 응답 생성 트리거
   */
  createResponse(): void {
    this.sendToOpenAI({
      type: 'response.create'
    });
  }

  /**
   * 현재 응답 중단
   */
  cancelResponse(): void {
    this.sendToOpenAI({
      type: 'response.cancel'
    });
  }

  /**
   * OpenAI 이벤트 처리
   */
  private handleOpenAIEvent(message: any): void {
    switch (message.type) {
      case 'session.created':
        console.log(`OpenAI 세션 생성됨: ${message.session?.id}`);
        this.emit('session_created', message.session);
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        console.log(`음성 전사 완료: "${message.transcript}"`);
        this.emit('audio_transcription', {
          text: message.transcript,
          item_id: message.item_id
        });
        break;
        
      case 'response.audio.delta':
        // 실시간 오디오 스트림
        this.emit('audio_delta', {
          audio: message.delta,
          item_id: message.item_id,
          response_id: message.response_id
        });
        break;
        
      case 'response.audio.done':
        console.log(`오디오 응답 완료: ${message.item_id}`);
        this.emit('audio_done', {
          item_id: message.item_id,
          response_id: message.response_id
        });
        break;
        
      case 'response.audio_transcript.delta':
        // 응답 음성의 실시간 전사
        this.emit('response_transcript_delta', {
          delta: message.delta,
          item_id: message.item_id
        });
        break;
        
      case 'response.audio_transcript.done':
        console.log(`응답 전사 완료: "${message.transcript}"`);
        this.emit('response_transcript_done', {
          transcript: message.transcript,
          item_id: message.item_id
        });
        break;
        
      case 'error':
        console.error('OpenAI 오류:', message.error);
        this.emit('error', new Error(message.error?.message || 'OpenAI 오류'));
        break;
        
      default:
        // 기타 이벤트는 그대로 전달
        this.emit('other_event', message);
        break;
    }
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (this.openaiWs) {
      this.isConnected = false;
      this.openaiWs.close();
      this.openaiWs = null;
      console.log(`OpenAI WebSocket 연결 해제: ${this.sessionId}`);
    }
  }

  /**
   * 연결 상태 확인
   */
  get connected(): boolean {
    return this.isConnected && this.openaiWs?.readyState === WebSocket.OPEN;
  }

  /**
   * 세션 설정 업데이트
   */
  updateSession(sessionConfig: any): void {
    this.sendToOpenAI({
      type: 'session.update',
      session: sessionConfig
    });
  }

  /**
   * 사용자 텍스트 메시지 전송
   */
  sendTextMessage(text: string): void {
    const itemId = `msg_${Date.now()}`;
    
    this.sendToOpenAI({
      type: 'conversation.item.create',
      item: {
        id: itemId,
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    });

    // 응답 생성 트리거
    this.createResponse();
  }
}
