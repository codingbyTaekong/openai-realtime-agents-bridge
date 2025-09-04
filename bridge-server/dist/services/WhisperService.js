"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhisperService = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
class WhisperService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
        }
        this.openai = new openai_1.default({
            apiKey: apiKey
        });
    }
    /**
     * 오디오 데이터를 텍스트로 변환
     */
    async transcribeAudio(audioData, format = 'wav', language) {
        let tempFilePath = null;
        try {
            console.log(`음성 전사 시작: 형식=${format}, 크기=${audioData.length}바이트`);
            // 임시 파일 생성
            tempFilePath = await this.createTempAudioFile(audioData, format);
            // OpenAI Whisper API 호출
            const transcription = await this.openai.audio.transcriptions.create({
                file: await this.createFileFromPath(tempFilePath),
                model: 'whisper-1',
                language: language,
                response_format: 'json'
            });
            console.log(`음성 전사 완료: "${transcription.text}"`);
            return {
                text: transcription.text,
                language: language,
                duration: this.estimateAudioDuration(audioData, format)
            };
        }
        catch (error) {
            console.error('음성 전사 오류:', error);
            throw new Error(`음성 전사에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
        finally {
            // 임시 파일 정리
            if (tempFilePath) {
                try {
                    (0, fs_1.unlinkSync)(tempFilePath);
                }
                catch (cleanupError) {
                    console.warn('임시 파일 정리 실패:', cleanupError);
                }
            }
        }
    }
    /**
     * 오디오 번역 (다른 언어를 영어로)
     */
    async translateAudio(audioData, format = 'wav') {
        let tempFilePath = null;
        try {
            console.log(`음성 번역 시작: 형식=${format}, 크기=${audioData.length}바이트`);
            // 임시 파일 생성
            tempFilePath = await this.createTempAudioFile(audioData, format);
            // OpenAI Whisper 번역 API 호출
            const translation = await this.openai.audio.translations.create({
                file: await this.createFileFromPath(tempFilePath),
                model: 'whisper-1',
                response_format: 'json'
            });
            console.log(`음성 번역 완료: "${translation.text}"`);
            return {
                text: translation.text,
                language: 'en', // 번역 결과는 항상 영어
                duration: this.estimateAudioDuration(audioData, format)
            };
        }
        catch (error) {
            console.error('음성 번역 오류:', error);
            throw new Error(`음성 번역에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
        finally {
            // 임시 파일 정리
            if (tempFilePath) {
                try {
                    (0, fs_1.unlinkSync)(tempFilePath);
                }
                catch (cleanupError) {
                    console.warn('임시 파일 정리 실패:', cleanupError);
                }
            }
        }
    }
    /**
     * 임시 오디오 파일 생성
     */
    async createTempAudioFile(audioData, format) {
        const timestamp = Date.now();
        const extension = this.getFileExtension(format);
        const filename = `audio_${timestamp}.${extension}`;
        const filepath = (0, path_1.join)((0, os_1.tmpdir)(), filename);
        return new Promise((resolve, reject) => {
            const writeStream = (0, fs_1.createWriteStream)(filepath);
            writeStream.on('error', (error) => {
                reject(new Error(`임시 파일 생성 실패: ${error.message}`));
            });
            writeStream.on('finish', () => {
                resolve(filepath);
            });
            writeStream.write(audioData);
            writeStream.end();
        });
    }
    /**
     * 파일 경로에서 File 객체 생성
     */
    async createFileFromPath(filepath) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        const buffer = fs.readFileSync(filepath);
        const filename = filepath.split('/').pop() || 'audio.wav';
        // Node.js 환경에서 File 객체 생성
        return new File([buffer], filename, {
            type: this.getMimeType(filename)
        });
    }
    /**
     * 형식에 따른 파일 확장자 반환
     */
    getFileExtension(format) {
        switch (format.toLowerCase()) {
            case 'wav':
                return 'wav';
            case 'webm':
                return 'webm';
            case 'mp3':
                return 'mp3';
            case 'mp4':
                return 'mp4';
            case 'm4a':
                return 'm4a';
            case 'ogg':
                return 'ogg';
            case 'flac':
                return 'flac';
            case 'pcm':
            case 'pcm16':
                return 'wav'; // PCM을 WAV 컨테이너로 처리
            default:
                return 'wav'; // 기본값
        }
    }
    /**
     * 파일명에 따른 MIME 타입 반환
     */
    getMimeType(filename) {
        const extension = filename.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'wav':
                return 'audio/wav';
            case 'webm':
                return 'audio/webm';
            case 'mp3':
                return 'audio/mpeg';
            case 'mp4':
                return 'audio/mp4';
            case 'm4a':
                return 'audio/mp4';
            case 'ogg':
                return 'audio/ogg';
            case 'flac':
                return 'audio/flac';
            default:
                return 'audio/wav';
        }
    }
    /**
     * 오디오 재생 시간 추정 (간단한 구현)
     */
    estimateAudioDuration(audioData, format) {
        // 실제로는 오디오 헤더를 파싱해야 하지만, 
        // 여기서는 간단한 추정 공식 사용
        if (format.toLowerCase() === 'wav') {
            // WAV 파일의 경우 헤더에서 정확한 시간 계산 가능
            try {
                if (audioData.length >= 44) {
                    const byteRate = audioData.readUInt32LE(28);
                    const dataSize = audioData.readUInt32LE(40);
                    return byteRate > 0 ? dataSize / byteRate : 0;
                }
            }
            catch (error) {
                console.warn('WAV 시간 계산 실패:', error);
            }
        }
        // 기본 추정: 44.1kHz, 16bit, 모노 기준
        const estimatedBytesPerSecond = 44100 * 2; // 44.1kHz * 16bit/8 * 1channel
        return audioData.length / estimatedBytesPerSecond;
    }
    /**
     * 지원되는 오디오 형식 확인
     */
    isSupportedFormat(format) {
        const supportedFormats = [
            'wav', 'mp3', 'mp4', 'm4a', 'ogg', 'webm', 'flac', 'pcm', 'pcm16'
        ];
        return supportedFormats.includes(format.toLowerCase());
    }
    /**
     * 오디오 품질 검사
     */
    validateAudioQuality(audioData, format) {
        const issues = [];
        const recommendations = [];
        // 파일 크기 검사
        if (audioData.length < 1024) { // 1KB 미만
            issues.push('오디오 파일이 너무 작습니다');
            recommendations.push('더 긴 오디오를 녹음해주세요');
        }
        if (audioData.length > 25 * 1024 * 1024) { // 25MB 초과
            issues.push('오디오 파일이 너무 큽니다');
            recommendations.push('오디오 길이를 줄이거나 품질을 낮춰주세요');
        }
        // 형식 지원 검사
        if (!this.isSupportedFormat(format)) {
            issues.push(`지원되지 않는 오디오 형식: ${format}`);
            recommendations.push('WAV, MP3, MP4, WebM 등의 형식을 사용해주세요');
        }
        return {
            isValid: issues.length === 0,
            issues,
            recommendations
        };
    }
}
exports.WhisperService = WhisperService;
//# sourceMappingURL=WhisperService.js.map