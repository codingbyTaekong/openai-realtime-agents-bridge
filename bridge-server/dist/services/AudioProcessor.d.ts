import { Buffer } from 'buffer';
export interface ProcessedAudio {
    data: Buffer | string;
    format: string;
    sampleRate: number;
    duration?: number;
}
export declare class AudioProcessor {
    private readonly MAX_AUDIO_SIZE;
    private readonly DEFAULT_SAMPLE_RATE;
    private readonly DEFAULT_CHANNELS;
    constructor();
    /**
     * 입력 오디오 데이터 처리
     */
    processAudioInput(audioData: Buffer | string, format: string): Promise<ProcessedAudio>;
    /**
     * WAV 오디오 처리
     */
    private processWavAudio;
    /**
     * WebM 오디오 처리
     */
    private processWebmAudio;
    /**
     * PCM 오디오 처리
     */
    private processPcmAudio;
    /**
     * WAV 헤더 파싱
     */
    private parseWavHeader;
    /**
     * 오디오 데이터를 Base64로 인코딩
     */
    encodeToBase64(buffer: Buffer): string;
    /**
     * Base64 오디오 데이터 디코딩
     */
    decodeFromBase64(base64Data: string): Buffer;
    /**
     * 오디오 형식 변환 (기본 구현)
     */
    convertAudioFormat(buffer: Buffer, fromFormat: string, toFormat: string): Promise<Buffer>;
    /**
     * 오디오 메타데이터 추출
     */
    getAudioMetadata(buffer: Buffer, format: string): Record<string, any>;
}
//# sourceMappingURL=AudioProcessor.d.ts.map