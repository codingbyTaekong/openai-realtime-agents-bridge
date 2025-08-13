# 테스트 페이지 E2E 가이드 (브릿지 서버 연동)

본 문서는 `src/app/test/page.tsx`에서 마이크 연결 → 브릿지 서버(Socket.IO) → OpenAI Realtime API(WebSocket)까지 이어지는 전체 플로우를 설명합니다. 구현은 다음 공식 문서를 준수합니다: [Realtime](https://platform.openai.com/docs/guides/realtime), [Realtime Conversations](https://platform.openai.com/docs/guides/realtime-conversations), [Realtime Transcription](https://platform.openai.com/docs/guides/realtime-transcription), [Realtime VAD](https://platform.openai.com/docs/guides/realtime-vad).

## 준비

- 루트(Next.js): `npm install && npm run dev` → http://localhost:3000
- 브릿지 서버(Express/Socket.IO): `cd bridge-server && npm install && npm run dev` → http://localhost:8000
- `.env` (브릿지 서버): `OPENAI_API_KEY` 필수

## 접속

1) 브라우저에서 `http://localhost:3000/test` 접속
2) 서버 URL(`http://localhost:8000`)과 사용자 ID 확인 후 [연결] 버튼 클릭
3) 상태 뱃지가 `CONNECTED`로 변경되면 준비 완료

## 오디오 입력(마이크)

- 훅: `src/app/hooks/useBridgeAudio.ts`
- 형식: PCM16 스트리밍(권장), 샘플레이트 24kHz, 모노
- 처리: WebAudio로 마이크 캡처 → 24kHz로 다운샘플 → 16-bit PCM 변환 → 100ms 단위 ArrayBuffer 전달
- 콜백: `onAudioChunk(ArrayBuffer)`에서 base64 인코딩 후 `send_audio(base64, 'pcm16')` 전송

## 브릿지 세션(Socket.IO)

- 훅: `src/app/hooks/useBridgeSession.ts`
- 핵심 이벤트
  - 클 → 서: `join_session`, `send_text`, `send_audio`, `commit_audio`, `clear_audio`, `interrupt`, `mute`
  - 서 → 클: `session_status`, `realtime_event`, `audio_response`(실시간 오디오), `transcript`(user/assistant)

## 서버 ↔ OpenAI Realtime

- 파일: `bridge-server/src/services/RealtimeProxyService.ts`
- 연결: `wss://api.openai.com/v1/realtime?model=...` (헤더: Authorization, OpenAI-Beta: realtime=v1)
- 초기 세션 업데이트(`session.update`)
  - model, voice, tools, instructions
  - input_audio_format/output_audio_format: `pcm16`
  - input_audio_transcription: `gpt-4o-mini-transcribe`
  - turn_detection(server VAD): threshold 0.9, prefix/silence, create_response true
- 오디오 스트림
  - 클 → 서: `send_audio(base64, 'pcm16')`
  - 서 → OpenAI: `input_audio_buffer.append`
  - PTT 종료: `commit_audio` → `input_audio_buffer.commit` + `response.create`
- 실시간 응답 수신
  - `response.audio.delta` → `audio_response`로 프론트 송신
  - `conversation.item.input_audio_transcription.completed` → `transcript(user)`
  - `response.audio_transcript.done` → `transcript(assistant)`

## 테스트 절차(권장)

1) 테스트 페이지에서 연결 후, 텍스트 모드로 간단 메시지 전송 → 응답 수신 확인
2) 음성 모드 전환 → 녹음 시작/중지(Push-to-Talk)
3) 중지 시 서버가 `commit_audio` 처리 후 응답 생성 → 실시간 오디오 델타 수신 확인
4) 음성/텍스트 전사 이벤트(`transcript`) 수신 확인
5) `음소거` 버튼으로 서버 VAD 토글(세션 `turn_detection` 업데이트) 확인

## 설계 포인트

- PCM16 24kHz를 프론트에서 직접 생성해 전송하여 지연과 변환 비용 최소화
- 서버는 OpenAI Realtime API의 원시 이벤트를 최대한 그대로 프록시해 범용성 보장
- `AgentManager`에서 `ChatSupervisorAgent`의 지침/도구를 노출해 Realtime 세션의 system prompt/도구 호출로 활용

## 알려진 이슈/메모

- 브라우저의 자동 재생 정책으로 오디오 재생이 차단될 수 있으니 첫 상호작용 후 재생 시도 필요
- 일부 이벤트 명칭은 OpenAI Realtime 릴리스에 따라 변경될 수 있음(핵심 흐름은 동일)
- `WhisperService`는 레거시 호환용이며, 실시간 전사는 Realtime 세션 구성으로 대체됨

## 참조 링크

- Realtime 가이드: https://platform.openai.com/docs/guides/realtime
- Realtime Conversations: https://platform.openai.com/docs/guides/realtime-conversations
- Realtime Transcription: https://platform.openai.com/docs/guides/realtime-transcription
- Realtime VAD: https://platform.openai.com/docs/guides/realtime-vad


