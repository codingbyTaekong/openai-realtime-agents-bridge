import { useCallback, useRef, useState } from 'react';

export interface AudioRecordingOptions {
	sampleRate?: number;
	channels?: number;
	format?: 'pcm16' | 'wav' | 'webm';
}

export interface AudioRecordingState {
	isRecording: boolean;
	isPaused: boolean;
	recordingTime: number;
	audioLevel: number;
}

export interface BridgeAudioCallbacks {
	onAudioData?: (audioData: Blob, format: string) => void;
	onAudioChunk?: (audioData: ArrayBuffer) => void; // 실시간 오디오 청크 (PCM16 권장)
	onRecordingStateChange?: (state: AudioRecordingState) => void;
	onRecordingStart?: () => void;
	onRecordingStop?: () => void;
	onError?: (error: Error) => void;
}

export function useBridgeAudio(
	options: AudioRecordingOptions = {},
	callbacks: BridgeAudioCallbacks = {}
) {
	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const audioLevelDataRef = useRef<Uint8Array | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);
	const recordingTimerRef = useRef<number | null>(null);

	const [recordingState, setRecordingState] = useState<AudioRecordingState>({
		isRecording: false,
		isPaused: false,
		recordingTime: 0,
		audioLevel: 0
	});

	const {
		sampleRate = 24000,
		channels = 1,
		format = 'pcm16'
	} = options;

	const updateRecordingState = useCallback(
		(updates: Partial<AudioRecordingState>) => {
			setRecordingState(prev => {
				const newState = { ...prev, ...updates };
				callbacks.onRecordingStateChange?.(newState);
				return newState;
			});
		},
		[callbacks]
	);

	const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
		const buffer = new ArrayBuffer(input.length * 2);
		const output = new DataView(buffer);
		let offset = 0;
		for (let i = 0; i < input.length; i++) {
			let s = Math.max(-1, Math.min(1, input[i]));
			output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
			offset += 2;
		}
		return buffer;
	};

	const downsampleBuffer = (
		input: Float32Array,
		inputSampleRate: number,
		targetSampleRate: number
	): Float32Array => {
		if (targetSampleRate === inputSampleRate) return input;
		const ratio = inputSampleRate / targetSampleRate;
		const newLength = Math.floor(input.length / ratio);
		const result = new Float32Array(newLength);
		let pos = 0;
		let idx = 0;
		while (idx < newLength) {
			const nextPos = Math.round((idx + 1) * ratio);
			let sum = 0;
			let count = 0;
			for (; pos < nextPos && pos < input.length; pos++) {
				sum += input[pos];
				count++;
			}
			result[idx] = sum / (count || 1);
			idx++;
		}
		return result;
	};

	const startRecording = useCallback(async () => {
		try {
			console.log('마이크 녹음 시작...');

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: channels,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});
			streamRef.current = stream;

			const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			audioContextRef.current = audioContext;
			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			analyserRef.current = analyser;
			source.connect(analyser);

			// ScriptProcessorNode 설정 (4096 샘플 청크)
			const processor = audioContext.createScriptProcessor(4096, channels, channels);
			processorRef.current = processor;
			source.connect(processor);
			processor.connect(audioContext.destination);

			processor.onaudioprocess = (event) => {
				if (!recordingState.isRecording) return;
				const inputBuffer = event.inputBuffer.getChannelData(0);
				const ds = downsampleBuffer(inputBuffer, audioContext.sampleRate, sampleRate);
				const pcm16 = floatTo16BitPCM(ds);
				callbacks.onAudioChunk?.(pcm16);
			};

			// 상태 업데이트
			updateRecordingState({
				isRecording: true,
				isPaused: false,
				recordingTime: 0
			});
			callbacks.onRecordingStart?.();

			// 타이머 시작
			let startTime = Date.now();
			recordingTimerRef.current = window.setInterval(() => {
				const elapsed = Math.floor((Date.now() - startTime) / 1000);
				updateRecordingState({ recordingTime: elapsed });
			}, 1000);

			// 오디오 레벨 모니터링
			audioLevelDataRef.current = new Uint8Array(analyser.frequencyBinCount);
			const updateAudioLevel = () => {
				if (analyserRef.current && audioLevelDataRef.current) {
					analyserRef.current.getByteFrequencyData(audioLevelDataRef.current);
					const sum = audioLevelDataRef.current.reduce((a, b) => a + b, 0);
					const avg = sum / audioLevelDataRef.current.length;
					updateRecordingState({ audioLevel: avg / 255 });
				}
				if (recordingState.isRecording) requestAnimationFrame(updateAudioLevel);
			};
			requestAnimationFrame(updateAudioLevel);

			console.log('녹음이 시작되었습니다. (PCM16 스트리밍)');
		} catch (error) {
			console.error('녹음 시작 오류:', error);
			callbacks.onError?.(error as Error);
			updateRecordingState({ isRecording: false, isPaused: false });
		}
	}, [channels, sampleRate, callbacks, updateRecordingState, recordingState.isRecording]);

	const stopRecording = useCallback(() => {
		try {
			console.log('녹음 중지...');

			if (processorRef.current) {
				processorRef.current.disconnect();
				processorRef.current.onaudioprocess = null as any;
				processorRef.current = null;
			}

			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
				streamRef.current = null;
			}

			if (audioContextRef.current) {
				audioContextRef.current.close();
				audioContextRef.current = null;
			}

			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
				recordingTimerRef.current = null;
			}

			updateRecordingState({
				isRecording: false,
				isPaused: false,
				audioLevel: 0
			});

			callbacks.onRecordingStop?.();
			console.log('녹음이 중지되었습니다.');
		} catch (error) {
			console.error('녹음 중지 오류:', error);
			callbacks.onError?.(error as Error);
		}
	}, [updateRecordingState, callbacks]);

	const pauseRecording = useCallback(() => {
		// ScriptProcessor 기반 스트리밍은 일시정지를 지원하지 않음
		console.warn('pauseRecording은 PCM 스트리밍 모드에서 지원되지 않습니다.');
	}, []);

	const resumeRecording = useCallback(() => {
		console.warn('resumeRecording은 PCM 스트리밍 모드에서 지원되지 않습니다.');
	}, []);

	const convertBlobToBase64 = useCallback((blob: Blob): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const result = reader.result as string;
				const base64 = result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}, []);

	const convertBlobToArrayBuffer = useCallback((blob: Blob): Promise<ArrayBuffer> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = reject;
			reader.readAsArrayBuffer(blob);
		});
	}, []);

	return {
		recordingState,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		convertBlobToBase64,
		convertBlobToArrayBuffer,
		isRecording: recordingState.isRecording,
		isPaused: recordingState.isPaused,
		recordingTime: recordingState.recordingTime,
		audioLevel: recordingState.audioLevel
	} as const;
}
