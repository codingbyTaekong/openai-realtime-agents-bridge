import { OpenAIService } from '../services/OpenAIService';

/**
 * Toy Museum Curator Agent
 * - 리얼타임 음성 대화에 최적화된 간결한 지침 제공
 * - 도구는 현재 리얼타임 경로에서 별도 처리하지 않으므로 비워둠 ([])
 */
export class ToyMuseumAgent {
    private openaiService: OpenAIService;

    // 전시 큐레이션 샘플 데이터 (간단 요약 형태)
    private readonly sampleExhibits = [
        {
            id: 'R-1960-ASTRO',
            name: '아스트로 로보트 (1960s)',
            maker: 'Hikari Co.',
            story: '주석(틴) 바디와 스파크 휠을 사용한 초기 바람개비식 로봇 장난감으로, 우주 경쟁 시대의 낙관을 담았습니다.'
        },
        {
            id: 'R-1985-TRANS',
            name: '트랜스폼 메카 (1985)',
            maker: 'Takara/Tomy',
            story: '변신 기믹으로 아이들의 상상력을 자극한 대중적 로봇. 일부 희귀 완품은 수집가 시장에서 높은 가치를 가집니다.'
        },
        {
            id: 'R-1999-AIBO',
            name: 'AIBO ERS-110 (1999)',
            maker: 'Sony',
            story: '초기 가정용 엔터테인먼트 로봇. 센서 기반 상호작용과 “성장” 개념이 로봇 장난감의 지평을 넓혔습니다.'
        },
        {
            id: 'R-2007-NXT',
            name: 'LEGO Mindstorms NXT (2007)',
            maker: 'LEGO',
            story: '모듈식 블록과 프로그래밍으로 놀이와 교육의 경계를 잇는 STEAM 로봇의 대표작입니다.'
        }
    ];

    constructor(openaiService: OpenAIService) {
        this.openaiService = openaiService;
    }

    /**
     * Realtime 세션용 시스템 지침 반환
     */
    public getRealtimeInstructions(): string {
        // 전시 샘플을 1~2줄 요약으로 압축하여 시스템 지침에 삽입 (과도한 길이 방지)
        const curatedSnippets = this.sampleExhibits
            .slice(0, 4)
            .map(e => `- ${e.name} (${e.maker}): ${e.story}`)
            .join('\n');

        return [
            '역할: 당신은 "토이 로봇 박물관"의 큐레이터 음성 에이전트입니다.',
            '대화 스타일: 매우 간결하고 생동감 있게, 1~2문장으로 핵심만 답하세요. 목록 대신 짧은 서술을 우선합니다.',
            '사실성: 확실하지 않은 정보는 추측하지 말고 확인 후 안내를 제안하세요.',
            '행동 트리거: 방문객이 "춤춰봐"/"노래불러줘"를 말하면 인식 사실을 짧게 확인하고, 실제 동작은 별도 장치 제어로 처리된다고 안내하세요.',
            '민감/부적절 요청은 정중히 거절하세요.',
            '',
            '==== 전시 큐레이션 샘플(요약) ====',
            curatedSnippets,
            '================================='
        ].join('\n');
    }

    /**
     * 리얼타임 도구 정의 (현재 리얼타임 경로에서 함수 호출 핸들링을 하지 않으므로 빈 배열)
     */
    public getRealtimeTools(): any[] {
        return [];
    }
}


