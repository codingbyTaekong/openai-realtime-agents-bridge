## 언리얼5 연동 가이드: 브릿지 서버와 실시간 음성 대화

이 문서는 현재 브릿지 서버/웹 테스트 페이지의 동작을 기준으로, 동일한 플레이(실시간 음성) 방식을 언리얼5에서 구현하는 절차를 정리한 가이드입니다. Socket.IO 이벤트 명세, 오디오 포맷, Next.js 기준 흐름, 언리얼 블루프린트 구현 스텝을 순서대로 제공합니다.

---

## 시스템 개요

- 클라이언트(웹/언리얼): 마이크 캡처 → 24kHz 모노 PCM16 → 100ms 단위 청크 전송
- 브릿지 서버: Socket.IO 실시간 연결, OpenAI Realtime API와 프록시 중계
- OpenAI Realtime: 서버 VAD, 실시간 전사, 실시간 오디오 응답(PCM16 base64 델타)

데이터 흐름:

```
언리얼(또는 웹) → Socket.IO(send_audio) → 브릿지 서버 → OpenAI Realtime
OpenAI Realtime → 브릿지 서버(audio_response) → 언리얼(또는 웹)
```

권장 오디오 포맷:
- 입력: PCM16, 24kHz, mono, 100ms 청크(약 4800바이트)
- 출력: PCM16 base64 델타(서버 이벤트 `audio_response`)

---

## 브릿지 서버 프로토콜 요약

- 클라이언트 → 서버
  - `join_session({ userId })`: 세션 생성 및 참여
  - `send_text(text: string)`: 텍스트 전송
  - `send_audio(audioData: ArrayBuffer|Buffer, format: string)`: 오디오 청크 전송
  - `commit_audio()`: 입력 종료(PTT 끝) → 응답 생성 트리거
  - `clear_audio()`: 입력 버퍼 클리어(PTT 시작)
  - `interrupt()`: 현재 응답 중단
  - `mute(muted: boolean)`: 서버 VAD on/off (true=VAD off)
  - `disconnect_session()`: 세션 정리

- 서버 → 클라이언트
  - `session_status({ status, sessionId, userId })`
  - `realtime_event(eventObj)`: OpenAI Realtime 원본 이벤트 중계
  - `transcript(text, role)`
  - `audio_response(base64Pcm16)`: 실시간 오디오 델타(PCM16 base64)
  - `error({ message })`

포맷 주의:
- `send_audio`의 `audioData`는 바이너리 여야 합니다. 문자열(base64)만 보낼 경우 현재 서버 구현은 처리하지 않습니다. 언리얼에서 Socket.IO로 바이너리 emit이 가능한 플러그인을 사용하세요.
- `format`은 'pcm16' 문자열로 지정하는 것을 권장합니다.

---

## Next.js 기준 레퍼런스(현행 구현)

다음은 테스트 페이지의 핵심 동작을 요약한 것입니다.

- 마이크 캡처/인코딩: `useBridgeAudio` 훅이 float → PCM16(24kHz)로 변환하여 청크 콜백을 제공합니다.
- 오디오 전송: 100ms마다 `send_audio(ArrayBuffer, 'pcm16')` 호출
- PTT 모드: 시작 시 `clear_audio()`, 종료 시 `commit_audio()`
- 자동 VAD 모드: `mute(false)`로 서버 VAD 활성화, PTT 호출 불필요
- 모델 응답 재생: `audio_response(base64)` 수신 즉시 `usePcm16Player`로 재생

핵심 포인트만 발췌:

```tsx
// onAudioChunk에서 ArrayBuffer를 그대로 전송
onAudioChunk: async (audioData: ArrayBuffer) => {
  if (isConnectedRef.current) {
    sendAudio(audioData, 'pcm16');
  }
},

// 응답 오디오(base64 PCM16) 재생
onAudioResponse: (audioData: string) => {
  pcmPlayer.playBase64Pcm16(audioData);
},
```

재생기(`usePcm16Player`)는 입력 base64 PCM16 → Float32 변환 → `AudioBufferSourceNode`에 스케줄링합니다. 샘플레이트는 24kHz로 생성하면 WebAudio가 필요한 경우 자동 리샘플링합니다.

---

## 언리얼5 블루프린트 구현 가이드

언리얼에서는 Socket.IO 클라이언트와 마이크 캡처/오디오 재생을 처리해야 합니다. 블루프린트만으로 구현하려면 다음 요소가 필요합니다.

- Socket.IO 클라이언트 플러그인(블루프린트 노드 지원, 바이너리 emit 지원 필수)
- 오디오 캡처(24kHz 모노, 100ms 청크로 PCM16 바이트 획득)
- PCM16 재생(실시간 스트리밍, 지터 버퍼)

아래는 블루프린트 중심의 단계별 구현 절차입니다.

### 1) 준비

- 프로젝트에 다음 플러그인(또는 동등 기능 플러그인) 추가
  - Socket.IO 클라이언트(블루프린트 노드 제공, 바이너리 송신 지원)
  - Audio Capture(엔진 내장) → 마이크 입력 캡처
  - Procedural 오디오 재생을 지원하는 플러그인 또는 최소 C++ 헬퍼(권장)

주의: 순수 블루프린트로 PCM16 스트리밍 재생을 구현하려면 Procedural 오디오 큐/사운드웨이브에 샘플을 푸시할 수 있어야 합니다. 일부는 C++ 보일러플레이트가 필요합니다. 블루프린트 전용으로는 외부 플러그인 의존이 필요할 수 있습니다.

### 2) BP_BridgeClient 액터 생성

- 변수
  - `ServerUrl`(String): 기본 `http://localhost:8000`
  - `UserId`(String): 임의 접두사 `ue_XXXX`
  - `IsAutoVAD`(Bool): 자동 VAD 사용 여부(기본 true)
  - `IsConnected`(Bool)

- BeginPlay
  - Socket.IO `Connect(ServerUrl)`
  - `OnConnected` → `Emit("join_session", { userId: UserId })`
  - 서버 이벤트 바인딩
    - `On("session_status")` → UI 표시
    - `On("realtime_event")` → 로그/디버그
    - `On("transcript")`(text, role) → UI 표시
    - `On("audio_response")`(base64) → 재생 큐에 푸시

- EndPlay
  - `Emit("disconnect_session")` 후 소켓 정리

### 3) 마이크 캡처 → PCM16(24kHz) 100ms 청크 만들기

블루프린트만으로 실시간 PCM 바이트를 얻기 어렵다면 아래 중 하나를 사용하세요.

- 플러그인 경로: 마이크 캡처 → 24kHz 모노 다운샘플 → Float → PCM16 변환 → `TArray<uint8>`(바이너리)
- C++ 헬퍼 경로(권장): `FAudioCapture` 혹은 `AudioCapture`로 콜백에서 `NumFrames` 만큼의 float 데이터를 받아 평균으로 모노 다운믹스 → int16로 변환 → 바이트 배열 노출(BlueprintCallable)

청크 크기 산정:
- 24kHz × 0.1초 × 1채널 × 2바이트 = 약 4800바이트/청크

PTT vs 자동 VAD:
- 자동 VAD: 연결 직후 `Emit("mute", false)`(서버 VAD on). 별도의 `clear/commit` 없이 지속적으로 `send_audio` 전송
- PTT: 버튼 Down 시 `Emit("clear_audio")` + 전송 시작, 버튼 Up 시 `Emit("commit_audio")` + 전송 중지

### 4) Socket.IO로 오디오 전송(바이너리)

- 100ms마다 바이트 배열을 준비하고
- `EmitBinary("send_audio", [AudioByteArray, "pcm16"])`
  - 첫 인자는 바이너리 데이터, 두 번째 인자는 문자열 `"pcm16"`
- 연결 확인 후에만 송신(끊김 시 버퍼 폐기)

### 5) 모델 응답 오디오 재생(PCM16 base64)

서버의 `audio_response`는 PCM16 base64 델타입니다.

- 수신 처리
  - base64 → 바이트 배열 디코딩
  - PCM16(int16 LE) → float(-1..1) 변환
  - Procedural 오디오 큐(예: `USoundWaveProcedural` 기반)로 샘플을 푸시하여 재생
  - 150~300ms 지터 버퍼를 유지해 끊김 최소화

블루프린트 구현 팁:
- Procedural 재생 노드가 없다면 간단한 C++ `USoundWaveProcedural` 래퍼를 만들어 `PushAudio`(TArray<uint8>)를 BlueprintCallable로 노출하는 것을 권장합니다.

### 6) 제어/유틸 이벤트

- 응답 중단: `Emit("interrupt")`
- 서버 VAD on/off 동기화: `Emit("mute", !IsAutoVAD)`
- 세션 종료: `Emit("disconnect_session")`

---

## 단계별 체크리스트

1) 플러그인 설치 및 프로젝트 세팅
- **Socket.IO BP 플러그인**: 바이너리 emit 지원 확인
- **Audio Capture 활성화**: 마이크 접근 권한 필요
- **Procedural 재생 준비**: 플러그인 또는 소규모 C++ 래퍼

2) BP_BridgeClient 구성 및 연결
- BeginPlay에서 Connect → `join_session`
- `session_status` 수신 시 상태 UI 업데이트

3) 입력 파이프라인
- 마이크 → 24kHz 모노 → PCM16 → 100ms 청크 → `send_audio(..., "pcm16")`
- PTT 모드면 `clear_audio`/`commit_audio` 호출
- 자동 VAD 모드면 `mute(false)` 유지

4) 출력 파이프라인
- `audio_response(base64)` 수신 즉시 디코드 → Procedural 큐에 푸시
- 지터 버퍼 2~3 청크 유지

5) 오류 처리/복구
- `error({ message })` 수신 시 UI 표기 및 재시도
- 소켓 끊김 시 자동 재연결 로직 고려

---

## 트러블슈팅

- 오디오가 들리지 않음
  - 입력: 24kHz 모노 PCM16인지, 100ms 청크인지 확인
  - 출력: base64 → PCM16 변환 및 Procedural 큐 푸시 여부 확인
  - VAD가 off(`mute(true)`) 상태면 자동 응답 트리거가 비활성화될 수 있음

- 네트워크 이슈
  - 바이너리 emit 사용 여부 확인(문자열 전송은 현재 서버에서 미지원)
  - 100ms보다 작은 청크는 오버헤드 증가, 큰 청크는 지연 증가

- 레벨 시작 시 소리가 안 나옴
  - 사용자 제스처 정책과 유사하게, 오디오 서브시스템 초기화 타이밍을 BeginPlay 직후로 고정하고, 재생 시작 전 재생 컴포넌트가 활성 상태인지 확인

---

## 참고(핵심 이벤트 요약)

- Emit
  - `join_session({ userId })`
  - `send_audio(binary, 'pcm16')`
  - `clear_audio()` / `commit_audio()`
  - `interrupt()`
  - `mute(boolean)`
  - `disconnect_session()`

- On
  - `session_status(statusObj)`
  - `realtime_event(event)`
  - `transcript(text, role)`
  - `audio_response(base64Pcm16)`
  - `error({ message })`

---

필요 시 블루프린트 전용으로 부족한 부분(실시간 PCM16 재생/마이크 PCM 추출)은 최소 C++ 헬퍼로 보완하는 것을 권장합니다. 위 단계만 따르면 웹과 동일한 실시간 음성 플레이 경험을 언리얼에서도 재현할 수 있습니다.


