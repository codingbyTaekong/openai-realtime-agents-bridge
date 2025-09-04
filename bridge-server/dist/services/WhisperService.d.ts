export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
    confidence?: number;
}
export declare class WhisperService {
    private openai;
    constructor();
    /**
     * 오디오 데이터를 텍스트로 변환
     */
    transcribeAudio(audioData: Buffer, format?: string, language?: string): Promise<TranscriptionResult>;
    /**
     * 오디오 번역 (다른 언어를 영어로)
     */
    translateAudio(audioData: Buffer, format?: string): Promise<TranscriptionResult>;
    /**
     * 임시 오디오 파일 생성
     */
    private createTempAudioFile;
    /**
     * 파일 경로에서 File 객체 생성
     */
    private createFileFromPath;
    /**
     * 형식에 따른 파일 확장자 반환
     */
    private getFileExtension;
    /**
     * 파일명에 따른 MIME 타입 반환
     */
    private getMimeType;
    /**
     * 오디오 재생 시간 추정 (간단한 구현)
     */
    private estimateAudioDuration;
    /**
     * 지원되는 오디오 형식 확인
     */
    isSupportedFormat(format: string): boolean;
    /**
     * 오디오 품질 검사
     */
    validateAudioQuality(audioData: Buffer, format: string): {
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    };
}
//# sourceMappingURL=WhisperService.d.ts.map