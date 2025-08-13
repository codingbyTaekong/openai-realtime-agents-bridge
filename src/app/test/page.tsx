"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// Bridge hooks
import { useBridgeSession, type BridgeMessage, type BridgeSessionStatus } from "../hooks/useBridgeSession";
import { useBridgeAudio } from "../hooks/useBridgeAudio";
import { usePcm16Player } from "../hooks/usePcm16Player";

// 메시지 타입 정의
interface ChatMessage {
  id: string;
  type: "text" | "audio" | "system";
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
}

export default function TestPage() {
  // Bridge session 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [userId, setUserId] = useState("");
  const [isAudioMode, setIsAudioMode] = useState(false);

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Bridge session 콜백
  const bridgeCallbacks = {
    onConnectionChange: (status: BridgeSessionStatus) => {
      console.log("연결 상태 변경:", status);
      const systemMessage: ChatMessage = {
        id: uuidv4(),
        type: "system",
        content: `연결 상태: ${status.status}${status.sessionId ? ` (세션: ${status.sessionId})` : ""}`,
        role: "system",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, systemMessage]);
    },

    onMessage: (message: BridgeMessage) => {
      console.log("메시지 수신:", message);
      const chatMessage: ChatMessage = {
        id: message.id,
        type: message.type === "text" ? "text" : message.type === "audio" ? "audio" : "system",
        content: message.content || JSON.stringify(message.data),
        role: message.role || "assistant",
        timestamp: message.timestamp
      };
      setMessages(prev => [...prev, chatMessage]);
    },

    onAgentResponse: (response: any) => {
      console.log("에이전트 응답:", response);
      const chatMessage: ChatMessage = {
        id: uuidv4(),
        type: "text",
        content: response.content || response.message || JSON.stringify(response),
        role: "assistant",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, chatMessage]);
      setIsLoading(false);
    },

    onTranscript: (transcript: string, role: "user" | "assistant") => {
      console.log("음성 전사:", transcript, role);
      const chatMessage: ChatMessage = {
        id: uuidv4(),
        type: "text",
        content: `[음성 전사] ${transcript}`,
        role: role,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, chatMessage]);
    },

    onAudioResponse: (audioData: string) => {
      // PCM16 base64 델타를 즉시 재생
      try {
        pcmPlayer.playBase64Pcm16(audioData);
      } catch (e) {
        console.warn('오디오 재생 실패:', e);
      }
    },

    onRealtimeEvent: (event: any) => {
      console.log("OpenAI Realtime 이벤트:", event.type, event);
      
      // 특정 이벤트에 대한 UI 업데이트
      if (event.type === 'response.done') {
        setIsLoading(false);
      }
    },

    onError: (error: { message: string; code?: string }) => {
      console.error("브릿지 서버 오류:", error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: "system",
        content: `오류: ${error.message}`,
        role: "system",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  // Bridge session 훅
  const {
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
    isConnected
  } = useBridgeSession(bridgeCallbacks);

  // Bridge audio 콜백
  const audioCallbacks = {
    onAudioChunk: async (audioData: ArrayBuffer) => {
      // 실시간 오디오 청크 전송 (Realtime API 방식)
      if (isConnected) {
        try {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
          sendAudio(base64, 'pcm16');
        } catch (error) {
          console.error("실시간 오디오 전송 오류:", error);
        }
      }
    },

    onRecordingStart: () => {
      console.log("녹음 시작");
      if (isConnected) {
        clearAudio(); // 이전 오디오 버퍼 클리어
      }
    },

    onRecordingStop: () => {
      console.log("녹음 종료");
      if (isConnected) {
        commitAudio(); // 오디오 입력 커밋하고 응답 생성
      }
      
      const audioMessage: ChatMessage = {
        id: uuidv4(),
        type: "audio",
        content: "[음성 입력 완료]",
        role: "user",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, audioMessage]);
      setIsLoading(true);
    },

    onAudioData: async (audioBlob: Blob, format: string) => {
      // 전체 오디오 데이터 (필요시 사용)
      console.log("전체 오디오 데이터:", format, audioBlob.size, "바이트");
    },

    onRecordingStateChange: (state: any) => {
      console.log("녹음 상태 변경:", state);
    },

    onError: (error: Error) => {
      console.error("오디오 오류:", error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: "system",
        content: `오디오 오류: ${error.message}`,
        role: "system",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Bridge audio 훅
  const {
    recordingState,
    startRecording,
    stopRecording,
    isRecording
  } = useBridgeAudio(
    { sampleRate: 24000, channels: 1, format: 'pcm16' },
    audioCallbacks
  );

  // PCM16 플레이어 (오토플레이 정책 회피: 첫 사용자 상호작용 시 컨텍스트 생성)
  const pcmPlayer = usePcm16Player({ sampleRate: 24000, volume: 1.0 });

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 랜덤 사용자 ID 생성
  useEffect(() => {
    setUserId(`user_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // 연결 처리
  const handleConnect = async () => {
    await connect({ serverUrl, userId });
  };

  // 연결 해제 처리
  const handleDisconnect = () => {
    disconnect();
  };

  // 텍스트 메시지 전송
  const handleSendText = () => {
    if (!inputText.trim() || !isConnected) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: "text",
      content: inputText,
      role: "user",
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    sendText(inputText);
    setInputText("");
    setIsLoading(true);
  };

  // 엔터 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // 오디오 녹음 토글
  const handleAudioToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 메시지 타임스탬프 포맷
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          브릿지 서버 테스트 페이지
        </h1>
        
        {/* 연결 설정 */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">서버 URL:</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="http://localhost:8000"
              disabled={isConnected}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">사용자 ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="user_123"
              disabled={isConnected}
            />
          </div>

          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            className={`px-4 py-2 rounded text-white font-medium ${
              isConnected 
                ? "bg-red-500 hover:bg-red-600" 
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isConnected ? "연결 해제" : "연결"}
          </button>

          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === "CONNECTED" 
              ? "bg-green-100 text-green-800" 
              : status === "CONNECTING"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}>
            {status}
          </div>
        </div>

        {/* 세션 정보 */}
        {isConnected && (
          <div className="mt-2 text-sm text-gray-600">
            세션 ID: {sessionInfo.sessionId} | 사용자: {sessionInfo.userId}
          </div>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="bg-white rounded-lg shadow h-full flex flex-col">
          {/* 메시지 리스트 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                브릿지 서버에 연결하고 대화를 시작해보세요.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}>
                    <div className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-2 rounded-lg ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : message.role === "assistant"
                        ? "bg-gray-200 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      <div className="text-sm">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-1 ${
                        message.role === "user" ? "text-blue-100" : "text-gray-500"
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              {/* 모드 토글 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAudioMode(false)}
                  className={`px-3 py-1 rounded text-sm ${
                    !isAudioMode ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  텍스트
                </button>
                <button
                  onClick={() => setIsAudioMode(true)}
                  className={`px-3 py-1 rounded text-sm ${
                    isAudioMode ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  음성
                </button>
              </div>

              {isAudioMode ? (
                /* 음성 입력 */
                <div className="flex-1 flex items-center gap-2">
                  <button
                    onClick={handleAudioToggle}
                    disabled={!isConnected}
                    className={`px-4 py-2 rounded-full font-medium ${
                      isRecording
                        ? "bg-red-500 text-white animate-pulse"
                        : isConnected
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isRecording ? "🔴 녹음 중지" : "🎤 녹음 시작"}
                  </button>
                  
                  {isRecording && (
                    <div className="text-sm text-gray-600">
                      녹음 시간: {recordingState.recordingTime}초
                      {recordingState.audioLevel > 0 && (
                        <div className="ml-2 inline-block">
                          음성 레벨: {Math.round(recordingState.audioLevel * 100)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* 텍스트 입력 */
                <>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!isConnected}
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!isConnected || !inputText.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    전송
                  </button>
                </>
              )}
              
              {/* 컨트롤 버튼 */}
              {isConnected && (
                <div className="flex gap-2">
                  <button
                    onClick={() => interrupt()}
                    className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                    title="중단"
                  >
                    ⏹️
                  </button>
                  <button
                    onClick={() => mute(true)}
                    className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    title="음소거"
                  >
                    🔇
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
