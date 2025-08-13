export interface SessionStatus {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  sessionId?: string;
  userId?: string;
}

export interface AudioMessage {
  id: string;
  type: "audio";
  data: Buffer | string; // Base64 encoded audio data
  format: "wav" | "webm" | "pcm16";
  sampleRate: number;
  timestamp: number;
}

export interface TextMessage {
  id: string;
  type: "text";
  content: string;
  role: "user" | "assistant";
  timestamp: number;
}

export interface SystemMessage {
  id: string;
  type: "system";
  event: string;
  data?: any;
  timestamp: number;
}

export type Message = AudioMessage | TextMessage | SystemMessage;

export interface ClientSession {
  id: string;
  userId?: string;
  status: SessionStatus["status"];
  openaiSession?: any;
  createdAt: Date;
  lastActivity: Date;
}

export interface AgentConfig {
  name: string;
  voice: string;
  instructions: string;
  tools: any[];
}

export interface OpenAISessionConfig {
  model: string;
  voice: string;
  inputAudioFormat: string;
  outputAudioFormat: string;
  inputAudioTranscription?: {
    model: string;
  };
}

// Socket.IO 이벤트 타입 정의
export interface ServerToClientEvents {
  message: (message: Message) => void;
  session_status: (status: SessionStatus) => void;
  agent_response: (response: any) => void;
  audio_response: (audioData: string) => void;
  transcript: (transcript: string, role: "user" | "assistant") => void;
  error: (error: { message: string; code?: string }) => void;
  realtime_event: (event: any) => void;
}

export interface ClientToServerEvents {
  join_session: (data: { userId?: string }) => void;
  send_message: (message: Omit<Message, "id" | "timestamp">) => void;
  send_audio: (audioData: Buffer | string, format: string) => void;
  send_text: (text: string) => void;
  disconnect_session: () => void;
  interrupt: () => void;
  mute: (muted: boolean) => void;
  commit_audio: () => void;
  clear_audio: () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  sessionId: string;
  userId?: string;
}
