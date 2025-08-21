import { useCallback, useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface BridgeSessionStatus {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  sessionId?: string;
  userId?: string;
}

export interface BridgeMessage {
  id: string;
  type: "text" | "audio" | "system";
  content?: string;
  role?: "user" | "assistant";
  data?: any;
  timestamp: number;
}

export interface BridgeSessionCallbacks {
  onConnectionChange?: (status: BridgeSessionStatus) => void;
  onMessage?: (message: BridgeMessage) => void;
  onAgentResponse?: (response: any) => void;
  onTranscript?: (transcript: string, role: "user" | "assistant") => void;
  onAudioResponse?: (audioData: string) => void; // 실시간 오디오 스트림
  onRealtimeEvent?: (event: any) => void; // OpenAI Realtime API 이벤트
  onError?: (error: { message: string; code?: string }) => void;
}

export interface BridgeConnectOptions {
  serverUrl?: string;
  userId?: string;
}

export function useBridgeSession(callbacks: BridgeSessionCallbacks = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<BridgeSessionStatus['status']>('DISCONNECTED');
  const [sessionInfo, setSessionInfo] = useState<BridgeSessionStatus>({ status: 'DISCONNECTED' });

  const updateStatus = useCallback(
    (newStatus: BridgeSessionStatus['status'], sessionData?: Partial<BridgeSessionStatus>) => {
      setStatus(newStatus);
      const fullSessionInfo = { status: newStatus, ...sessionData };
      setSessionInfo(fullSessionInfo);
      callbacks.onConnectionChange?.(fullSessionInfo);
    },
    [callbacks]
  );

  const connect = useCallback(
    async ({ serverUrl = 'http://localhost:8000', userId }: BridgeConnectOptions = {}) => {
      if (socketRef.current) {
        console.warn('이미 연결되어 있습니다.');
        return;
      }

      updateStatus('CONNECTING');

      try {
        console.log(`브릿지 서버에 연결 중: ${serverUrl}`);

        // Socket.IO 클라이언트 생성
        const socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: false,
          timeout: 10000
        });

        socketRef.current = socket;

        // 이벤트 리스너 설정
        socket.on('connect', () => {
          console.log('Socket.IO 연결됨:', socket.id);

          // 세션 참여 요청
          socket.emit('join_session', { userId });
        });

        socket.on('session_status', (statusUpdate: BridgeSessionStatus) => {
          console.log('세션 상태 업데이트:', statusUpdate);
          updateStatus(statusUpdate.status, statusUpdate);
        });

        socket.on('message', (message: BridgeMessage) => {
          console.log('메시지 수신:', message);
          callbacks.onMessage?.(message);
        });

        socket.on('agent_response', (response: any) => {
          console.log('에이전트 응답:', response);
          callbacks.onAgentResponse?.(response);
        });

        socket.on('transcript', (transcript: string, role: "user" | "assistant") => {
          console.log('음성 전사:', transcript, role);
          callbacks.onTranscript?.(transcript, role);
        });

        socket.on('audio_response', (audioData: string) => {
          console.log('실시간 오디오 수신:', audioData.length, '바이트');
          callbacks.onAudioResponse?.(audioData);
        });

        socket.on('realtime_event', (event: any) => {
          console.log('OpenAI Realtime 이벤트:', event.type);
          callbacks.onRealtimeEvent?.(event);
        });

        socket.on('error', (error: { message: string; code?: string }) => {
          console.error('브릿지 서버 오류:', error);
          callbacks.onError?.(error);
        });

        socket.on('disconnect', (reason: string) => {
          console.log('Socket.IO 연결 해제:', reason);
          updateStatus('DISCONNECTED');
        });

        socket.on('connect_error', (error: Error) => {
          console.error('Socket.IO 연결 오류:', error);
          updateStatus('DISCONNECTED');
          callbacks.onError?.({ message: '서버 연결에 실패했습니다.' });
        });

        // 연결 시작
        socket.connect();

      } catch (error) {
        console.error('브릿지 세션 연결 오류:', error);
        updateStatus('DISCONNECTED');
        callbacks.onError?.({ message: '연결에 실패했습니다.' });
      }
    },
    [callbacks, updateStatus]
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('브릿지 세션 연결 해제 중...');

      // 서버에 연결 해제 알림
      socketRef.current.emit('disconnect_session');

      // Socket 연결 해제
      socketRef.current.disconnect();
      socketRef.current = null;

      updateStatus('DISCONNECTED');
    }
  }, [updateStatus]);

  const sendText = useCallback((text: string) => {
    if (!socketRef.current || status !== 'CONNECTED') {
      console.warn('연결되지 않음 - 텍스트 전송 실패');
      callbacks.onError?.({ message: '서버에 연결되지 않았습니다.' });
      return;
    }

    console.log('텍스트 메시지 전송:', text);
    socketRef.current.emit('send_text', text);
  }, [status, callbacks]);

  const sendAudio = useCallback((audioData: ArrayBuffer | Buffer | string, format: string = 'wav') => {
    if (!socketRef.current || status !== 'CONNECTED') {
      console.warn('연결되지 않음 - 오디오 전송 실패');
      callbacks.onError?.({ message: '서버에 연결되지 않았습니다.' });
      return;
    }

    console.log('오디오 데이터 전송:', format, typeof audioData);
    socketRef.current.emit('send_audio', audioData, format);
  }, [status, callbacks]);

  const interrupt = useCallback(() => {
    if (socketRef.current) {
      console.log('세션 중단 요청');
      socketRef.current.emit('interrupt');
    }
  }, []);

  const mute = useCallback((muted: boolean) => {
    if (socketRef.current) {
      console.log('음소거 설정:', muted);
      socketRef.current.emit('mute', muted);
    }
  }, []);

  const commitAudio = useCallback(() => {
    if (socketRef.current && status === 'CONNECTED') {
      console.log('오디오 입력 커밋');
      socketRef.current.emit('commit_audio');
    }
  }, [status]);

  const clearAudio = useCallback(() => {
    if (socketRef.current && status === 'CONNECTED') {
      console.log('오디오 입력 클리어');
      socketRef.current.emit('clear_audio');
    }
  }, [status]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    status,
    sessionInfo,
    connect,
    disconnect,
    sendText,
    sendAudio,
    commitAudio,
    clearAudio,
    interrupt,
    mute,
    isConnected: status === 'CONNECTED'
  } as const;
}
