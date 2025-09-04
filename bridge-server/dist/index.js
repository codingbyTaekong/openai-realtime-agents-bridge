"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid");
const SessionManager_1 = require("./services/SessionManager");
const AudioProcessor_1 = require("./services/AudioProcessor");
const OpenAIService_1 = require("./services/OpenAIService");
const RealtimeProxyService_1 = require("./services/RealtimeProxyService");
const AgentManager_1 = require("./agents/AgentManager");
const contents_1 = __importDefault(require("./routes/contents"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// CORS 설정
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});
// Middleware
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// 업로드 디렉토리 설정 및 정적 서빙
const uploadsDir = path_1.default.resolve(process.cwd(), 'upload_files');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadsDir));
// Services 초기화
const sessionManager = new SessionManager_1.SessionManager();
const audioProcessor = new AudioProcessor_1.AudioProcessor();
const openaiService = new OpenAIService_1.OpenAIService();
const agentManager = new AgentManager_1.AgentManager(openaiService);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeSessions: sessionManager.getActiveSessionCount()
    });
});
// REST 라우트
app.use('/api/contents', contents_1.default);
// Session management endpoint
app.post('/api/session', async (req, res) => {
    try {
        const sessionData = await openaiService.createSession();
        res.json(sessionData);
    }
    catch (error) {
        console.error('Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});
// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log(`클라이언트 연결됨: ${socket.id}`);
    let currentSession = null;
    let realtimeProxy = null;
    // 세션 참여 처리
    socket.on('join_session', async (data) => {
        try {
            const sessionId = (0, uuid_1.v4)();
            const session = {
                id: sessionId,
                userId: data.userId,
                status: 'CONNECTING',
                createdAt: new Date(),
                lastActivity: new Date()
            };
            // 세션 저장
            sessionManager.createSession(session);
            currentSession = session;
            socket.data.sessionId = sessionId;
            socket.data.userId = data.userId;
            // Socket을 세션 룸에 참여시킴
            await socket.join(`session:${sessionId}`);
            // OpenAI Realtime API 프록시 생성 (supervisor 지침/도구 주입)
            const supervisor = agentManager.getSupervisorRealtimeConfig();
            realtimeProxy = new RealtimeProxyService_1.RealtimeProxyService({
                apiKey: process.env.OPENAI_API_KEY,
                sessionId: sessionId,
                model: 'gpt-4o-realtime-preview-2025-06-03',
                voice: 'sage',
                instructions: supervisor.instructions,
                tools: supervisor.tools
            });
            // 프록시 이벤트 리스너 설정
            realtimeProxy.on('openai_message', (message) => {
                // OpenAI 메시지를 클라이언트로 전달
                socket.emit('realtime_event', message);
            });
            realtimeProxy.on('audio_transcription', (data) => {
                // 사용자 음성 전사
                socket.emit('transcript', data.text, 'user');
            });
            realtimeProxy.on('response_transcript_done', (data) => {
                // 에이전트 응답 전사
                socket.emit('transcript', data.transcript, 'assistant');
            });
            realtimeProxy.on('audio_delta', (data) => {
                // 실시간 오디오 스트림
                socket.emit('audio_response', data.audio);
            });
            realtimeProxy.on('error', (error) => {
                console.error('Realtime 프록시 오류:', error);
                socket.emit('error', { message: error.message });
            });
            realtimeProxy.on('disconnected', (data) => {
                console.log('OpenAI 연결 해제:', data);
                session.status = 'DISCONNECTED';
            });
            // OpenAI Realtime API 연결
            await realtimeProxy.connect();
            session.status = 'CONNECTED';
            session.openaiSession = realtimeProxy;
            // 클라이언트에게 세션 상태 알림
            const statusUpdate = {
                status: 'CONNECTED',
                sessionId: sessionId,
                userId: data.userId
            };
            socket.emit('session_status', statusUpdate);
            console.log(`세션 생성됨: ${sessionId} (사용자: ${data.userId || 'anonymous'})`);
        }
        catch (error) {
            console.error('세션 참여 오류:', error);
            socket.emit('error', { message: '세션 생성에 실패했습니다.' });
            // 정리
            if (realtimeProxy) {
                realtimeProxy.disconnect();
                realtimeProxy = null;
            }
        }
    });
    // 텍스트 메시지 처리
    socket.on('send_text', async (text) => {
        if (!currentSession || !realtimeProxy) {
            socket.emit('error', { message: '세션이 연결되지 않았습니다.' });
            return;
        }
        try {
            console.log(`텍스트 메시지 전송: ${currentSession.id} - "${text}"`);
            // OpenAI Realtime API로 직접 전송
            realtimeProxy.sendTextMessage(text);
            // 활동 시간 업데이트
            sessionManager.updateLastActivity(currentSession.id);
        }
        catch (error) {
            console.error('텍스트 메시지 처리 오류:', error);
            socket.emit('error', { message: '메시지 처리에 실패했습니다.' });
        }
    });
    // 오디오 데이터 처리
    socket.on('send_audio', async (audioData, format) => {
        if (!currentSession || !realtimeProxy) {
            socket.emit('error', { message: '세션이 연결되지 않았습니다.' });
            return;
        }
        try {
            console.log(`오디오 데이터 수신: ${currentSession.id}, 형식=${format}, 크기=${audioData instanceof ArrayBuffer ? audioData.byteLength : audioData.length}바이트`);
            // ArrayBuffer를 Buffer로 직접 변환 (Socket.IO가 자동으로 변환해줌)
            let audioBuffer;
            if (audioData instanceof ArrayBuffer) {
                audioBuffer = Buffer.from(audioData);
            }
            else if (Buffer.isBuffer(audioData)) {
                audioBuffer = audioData;
            }
            else {
                console.error('지원하지 않는 오디오 데이터 타입:', typeof audioData);
                socket.emit('error', { message: '지원하지 않는 오디오 데이터 형식입니다.' });
                return;
            }
            // OpenAI Realtime API로 직접 전송 (RealtimeProxyService에서 base64 변환 수행)
            realtimeProxy.sendAudioToOpenAI(audioBuffer);
            // 활동 시간 업데이트
            sessionManager.updateLastActivity(currentSession.id);
        }
        catch (error) {
            console.error('오디오 메시지 처리 오류:', error);
            socket.emit('error', { message: '오디오 처리에 실패했습니다.' });
        }
    });
    // 오디오 입력 커밋 (Push-to-Talk 종료 시)
    socket.on('commit_audio', () => {
        if (realtimeProxy) {
            console.log(`오디오 입력 커밋: ${currentSession?.id}`);
            realtimeProxy.commitAudioInput();
            realtimeProxy.createResponse();
        }
    });
    // 오디오 입력 클리어
    socket.on('clear_audio', () => {
        if (realtimeProxy) {
            console.log(`오디오 입력 클리어: ${currentSession?.id}`);
            realtimeProxy.clearAudioInput();
        }
    });
    // 세션 중단 처리
    socket.on('interrupt', () => {
        if (realtimeProxy) {
            console.log(`응답 중단: ${currentSession?.id}`);
            realtimeProxy.cancelResponse();
        }
    });
    // 음소거 처리 (세션 설정 업데이트)
    socket.on('mute', (muted) => {
        if (realtimeProxy) {
            console.log(`음소거 설정: ${currentSession?.id}, 음소거=${muted}`);
            // 음소거 시에는 turn_detection을 비활성화
            const sessionConfig = muted ? {
                turn_detection: null
            } : {
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.9,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    create_response: true
                }
            };
            realtimeProxy.updateSession(sessionConfig);
        }
    });
    // 세션 연결 해제
    socket.on('disconnect_session', () => {
        if (currentSession) {
            console.log(`세션 연결 해제 요청: ${currentSession.id}`);
            // Realtime 프록시 연결 해제
            if (realtimeProxy) {
                realtimeProxy.disconnect();
                realtimeProxy = null;
            }
            // 세션 정리
            sessionManager.removeSession(currentSession.id);
            currentSession = null;
            console.log(`세션 연결 해제 완료`);
        }
    });
    // 클라이언트 연결 해제
    socket.on('disconnect', (reason) => {
        console.log(`클라이언트 연결 해제됨: ${socket.id}, 이유: ${reason}`);
        if (currentSession) {
            console.log(`세션 정리 중: ${currentSession.id}`);
            // Realtime 프록시 연결 해제
            if (realtimeProxy) {
                realtimeProxy.disconnect();
                realtimeProxy = null;
            }
            // 세션 정리
            sessionManager.removeSession(currentSession.id);
            currentSession = null;
        }
    });
});
// 서버 시작
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`🚀 브릿지 서버가 포트 ${PORT}에서 시작되었습니다.`);
    console.log(`📡 Socket.IO 서버가 활성화되었습니다.`);
    console.log(`🌐 허용된 CORS 오리진: ${allowedOrigins.join(', ')}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM 수신됨, 서버를 종료합니다...');
    server.close(() => {
        console.log('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT 수신됨, 서버를 종료합니다...');
    server.close(() => {
        console.log('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map