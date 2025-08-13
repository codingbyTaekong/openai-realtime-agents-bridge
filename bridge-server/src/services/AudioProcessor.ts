import { Buffer } from 'buffer';

export interface ProcessedAudio {
  data: Buffer | string;
  format: string;
  sampleRate: number;
  duration?: number;
}

export class AudioProcessor {
  private readonly MAX_AUDIO_SIZE: number;
  private readonly DEFAULT_SAMPLE_RATE: number = 24000;
  private readonly DEFAULT_CHANNELS: number = 1;

  constructor() {
    this.MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE || '10485760'); // 10MB 기본값
  }

  /**
   * 입력 오디오 데이터 처리
   */
  async processAudioInput(
    audioData: Buffer | string, 
    format: string
  ): Promise<ProcessedAudio> {
    try {
      let buffer: Buffer;

      // 데이터 타입 변환
      if (typeof audioData === 'string') {
        // Base64 디코딩
        buffer = Buffer.from(audioData, 'base64');
      } else {
        buffer = audioData;
      }

      // 크기 제한 확인
      if (buffer.length > this.MAX_AUDIO_SIZE) {
        throw new Error(`오디오 크기가 최대 허용 크기를 초과했습니다. (${buffer.length} > ${this.MAX_AUDIO_SIZE})`);
      }

      console.log(`오디오 처리 중: 형식=${format}, 크기=${buffer.length}바이트`);

      // 형식에 따른 처리
      switch (format.toLowerCase()) {
        case 'wav':
          return await this.processWavAudio(buffer);
        
        case 'webm':
          return await this.processWebmAudio(buffer);
        
        case 'pcm16':
        case 'pcm':
          return await this.processPcmAudio(buffer);
        
        default:
          // 기본적으로 원본 데이터 반환
          return {
            data: buffer,
            format: format,
            sampleRate: this.DEFAULT_SAMPLE_RATE
          };
      }

    } catch (error) {
      console.error('오디오 처리 오류:', error);
      throw new Error(`오디오 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * WAV 오디오 처리
   */
  private async processWavAudio(buffer: Buffer): Promise<ProcessedAudio> {
    // WAV 헤더 파싱
    const wavInfo = this.parseWavHeader(buffer);
    
    return {
      data: buffer,
      format: 'wav',
      sampleRate: wavInfo.sampleRate || this.DEFAULT_SAMPLE_RATE,
      duration: wavInfo.duration
    };
  }

  /**
   * WebM 오디오 처리
   */
  private async processWebmAudio(buffer: Buffer): Promise<ProcessedAudio> {
    // WebM은 일반적으로 브라우저에서 녹음된 형식
    // 실제 환경에서는 FFmpeg 등을 사용하여 변환할 수 있음
    console.log('WebM 오디오 감지됨 - 원본 형식으로 전달');
    
    return {
      data: buffer,
      format: 'webm',
      sampleRate: this.DEFAULT_SAMPLE_RATE
    };
  }

  /**
   * PCM 오디오 처리
   */
  private async processPcmAudio(buffer: Buffer): Promise<ProcessedAudio> {
    return {
      data: buffer,
      format: 'pcm16',
      sampleRate: this.DEFAULT_SAMPLE_RATE
    };
  }

  /**
   * WAV 헤더 파싱
   */
  private parseWavHeader(buffer: Buffer): { sampleRate?: number; duration?: number } {
    try {
      if (buffer.length < 44) {
        console.warn('WAV 헤더가 너무 짧습니다');
        return {};
      }

      // WAV 헤더 검증
      const riffHeader = buffer.toString('ascii', 0, 4);
      const waveHeader = buffer.toString('ascii', 8, 12);

      if (riffHeader !== 'RIFF' || waveHeader !== 'WAVE') {
        console.warn('유효하지 않은 WAV 헤더');
        return {};
      }

      // 샘플 레이트 추출 (바이트 24-27)
      const sampleRate = buffer.readUInt32LE(24);
      
      // 데이터 크기 추출 (바이트 40-43)
      const dataSize = buffer.readUInt32LE(40);
      
      // 바이트 레이트 추출 (바이트 28-31)
      const byteRate = buffer.readUInt32LE(28);
      
      // 재생 시간 계산 (초)
      const duration = byteRate > 0 ? dataSize / byteRate : undefined;

      console.log(`WAV 정보: 샘플 레이트=${sampleRate}Hz, 데이터 크기=${dataSize}바이트, 재생 시간=${duration}초`);

      return {
        sampleRate,
        duration
      };

    } catch (error) {
      console.error('WAV 헤더 파싱 오류:', error);
      return {};
    }
  }

  /**
   * 오디오 데이터를 Base64로 인코딩
   */
  encodeToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Base64 오디오 데이터 디코딩
   */
  decodeFromBase64(base64Data: string): Buffer {
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * 오디오 형식 변환 (기본 구현)
   */
  async convertAudioFormat(
    buffer: Buffer, 
    fromFormat: string, 
    toFormat: string
  ): Promise<Buffer> {
    // 실제 환경에서는 FFmpeg 등을 사용하여 변환
    console.log(`오디오 형식 변환: ${fromFormat} -> ${toFormat}`);
    
    if (fromFormat === toFormat) {
      return buffer;
    }

    // 기본적으로 원본 반환 (실제로는 형식 변환 로직 필요)
    console.warn('오디오 형식 변환이 구현되지 않았습니다. 원본 데이터를 반환합니다.');
    return buffer;
  }

  /**
   * 오디오 메타데이터 추출
   */
  getAudioMetadata(buffer: Buffer, format: string): Record<string, any> {
    const metadata: Record<string, any> = {
      size: buffer.length,
      format: format
    };

    if (format.toLowerCase() === 'wav') {
      const wavInfo = this.parseWavHeader(buffer);
      metadata.sampleRate = wavInfo.sampleRate;
      metadata.duration = wavInfo.duration;
    }

    return metadata;
  }
}
