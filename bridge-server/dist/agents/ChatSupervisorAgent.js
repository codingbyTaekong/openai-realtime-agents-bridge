"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSupervisorAgent = void 0;
const WhisperService_1 = require("../services/WhisperService");
class ChatSupervisorAgent {
    constructor(openaiService) {
        this.companyName = 'NewTelco';
        // Sample data (원본 프로젝트에서 가져옴)
        this.sampleAccountInfo = {
            accountId: "NT-123456",
            name: "Alex Johnson",
            phone: "+1-206-135-1246",
            email: "alex.johnson@email.com",
            plan: "Unlimited Plus",
            balanceDue: "$42.17",
            lastBillDate: "2024-05-15",
            lastPaymentDate: "2024-05-20",
            lastPaymentAmount: "$42.17",
            status: "Active",
            address: {
                street: "1234 Pine St",
                city: "Seattle",
                state: "WA",
                zip: "98101"
            },
            lastBillDetails: {
                basePlan: "$30.00",
                internationalCalls: "$8.00",
                dataOverage: "$4.00",
                taxesAndFees: "$0.17",
                notes: "Higher than usual due to international calls and data overage."
            }
        };
        this.samplePolicyDocs = [
            {
                id: "ID-010",
                name: "Family Plan Policy",
                topic: "family plan options",
                content: "The family plan allows up to 5 lines per account. All lines share a single data pool. Each additional line after the first receives a 10% discount. All lines must be on the same account."
            },
            {
                id: "ID-020",
                name: "Promotions and Discounts Policy",
                topic: "promotions and discounts",
                content: "The Summer Unlimited Data Sale provides a 20% discount on the Unlimited Plus plan for the first 6 months for new activations completed by July 31, 2024. The Refer-a-Friend Bonus provides a $50 bill credit to both the referring customer and the new customer after 60 days of active service, for activations by August 31, 2024. A maximum of 5 referral credits may be earned per account. Discounts cannot be combined with other offers."
            },
            {
                id: "ID-030",
                name: "International Plans Policy",
                topic: "international plans",
                content: "International plans are available and include discounted calling, texting, and data usage in over 100 countries."
            },
            {
                id: "ID-040",
                name: "Handset Offers Policy",
                topic: "new handsets",
                content: "Handsets from brands such as iPhone and Google are available. The iPhone 16 is $200 and the Google Pixel 8 is available for $0, both with an additional 18-month commitment. These offers are valid while supplies last and may require eligible plans or trade-ins. For more details, visit one of our stores."
            }
        ];
        this.sampleStoreLocations = [
            {
                name: "NewTelco San Francisco Downtown Store",
                address: "1 Market St, San Francisco, CA",
                zip_code: "94105",
                phone: "(415) 555-1001",
                hours: "Mon-Sat 10am-7pm, Sun 11am-5pm"
            },
            {
                name: "NewTelco New York City Midtown Store",
                address: "350 5th Ave, New York, NY",
                zip_code: "10118",
                phone: "(212) 555-7007",
                hours: "Mon-Sat 9am-8pm, Sun 10am-6pm"
            }
        ];
        this.openaiService = openaiService;
        this.whisperService = new WhisperService_1.WhisperService();
    }
    /**
     * Realtime 세션용 시스템 지침 반환 (공개)
     */
    getRealtimeInstructions() {
        return this.getSupervisorInstructions();
    }
    /**
     * Realtime 세션용 도구 스키마 반환 (공개)
     */
    getRealtimeTools() {
        return this.getSupervisorTools();
    }
    /**
     * 텍스트 메시지 처리 (chatAgent 역할)
     */
    async processTextMessage(sessionId, userMessage, conversationHistory) {
        try {
            console.log(`chatAgent 텍스트 처리: ${sessionId}, 메시지: "${userMessage}"`);
            // 간단한 인사말 및 기본 응답 처리
            if (this.shouldHandleDirectly(userMessage)) {
                const directResponse = this.handleDirectResponse(userMessage);
                return {
                    content: directResponse,
                    type: 'text',
                    timestamp: Date.now()
                };
            }
            // Supervisor Agent에게 요청
            const supervisorResponse = await this.getNextResponseFromSupervisor(userMessage, conversationHistory);
            if (supervisorResponse.error) {
                throw new Error(supervisorResponse.error);
            }
            // 필러 문구 + supervisor 응답 결합
            const fillerPhrase = this.getRandomFillerPhrase();
            const fullResponse = `${fillerPhrase} ${supervisorResponse.nextResponse}`;
            return {
                content: fullResponse,
                type: 'text',
                timestamp: Date.now(),
                metadata: {
                    usedSupervisor: true,
                    fillerPhrase: fillerPhrase
                }
            };
        }
        catch (error) {
            console.error('텍스트 메시지 처리 오류:', error);
            return {
                content: "죄송합니다. 메시지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
                type: 'text',
                timestamp: Date.now(),
                metadata: { error: true }
            };
        }
    }
    /**
     * 오디오 메시지 처리
     */
    async processAudioMessage(sessionId, audioMessage, conversationHistory = []) {
        try {
            console.log(`오디오 메시지 처리: ${sessionId}`);
            if (audioMessage.type !== 'audio' || !audioMessage.data) {
                throw new Error('유효하지 않은 오디오 메시지입니다.');
            }
            // 오디오 데이터 준비
            let audioBuffer;
            if (typeof audioMessage.data === 'string') {
                // Base64 문자열을 Buffer로 변환
                audioBuffer = Buffer.from(audioMessage.data, 'base64');
            }
            else {
                audioBuffer = audioMessage.data;
            }
            // 오디오 품질 검사
            const audioFormat = audioMessage.format || 'wav';
            const qualityCheck = this.whisperService.validateAudioQuality(audioBuffer, audioFormat);
            if (!qualityCheck.isValid) {
                console.warn('오디오 품질 문제:', qualityCheck.issues);
                return {
                    content: `오디오 품질에 문제가 있습니다: ${qualityCheck.issues.join(', ')}. ${qualityCheck.recommendations.join(' ')}`,
                    type: 'text',
                    timestamp: Date.now(),
                    metadata: { error: true, qualityIssues: qualityCheck.issues }
                };
            }
            // Whisper로 음성을 텍스트로 변환
            console.log('음성을 텍스트로 변환 중...');
            const transcription = await this.whisperService.transcribeAudio(audioBuffer, audioFormat, 'ko');
            if (!transcription.text.trim()) {
                return {
                    content: "음성이 명확하지 않습니다. 다시 말씀해 주세요.",
                    type: 'text',
                    timestamp: Date.now(),
                    metadata: { transcriptionEmpty: true }
                };
            }
            console.log(`음성 전사 완료: "${transcription.text}"`);
            // 전사된 텍스트를 기존 텍스트 메시지 처리 로직으로 전달
            const textResponse = await this.processTextMessage(sessionId, transcription.text, conversationHistory);
            // 응답에 오디오 전사 정보 추가
            return {
                ...textResponse,
                metadata: {
                    ...textResponse.metadata,
                    audioTranscription: {
                        originalText: transcription.text,
                        language: transcription.language,
                        duration: transcription.duration,
                        audioFormat: audioFormat
                    }
                }
            };
        }
        catch (error) {
            console.error('오디오 메시지 처리 오류:', error);
            return {
                content: `오디오 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                type: 'text',
                timestamp: Date.now(),
                metadata: { error: true, errorMessage: error instanceof Error ? error.message : '알 수 없는 오류' }
            };
        }
    }
    /**
     * 직접 처리 가능한 메시지인지 확인
     */
    shouldHandleDirectly(message) {
        const lowerMessage = message.toLowerCase().trim();
        // 인사말 처리
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
        if (greetings.some(greeting => lowerMessage.includes(greeting))) {
            return true;
        }
        // 감사 인사
        const thanks = ['thank you', 'thanks', 'thank', 'appreciate'];
        if (thanks.some(thank => lowerMessage.includes(thank))) {
            return true;
        }
        // 반복 요청
        const repeatRequests = ['repeat', 'say that again', 'what did you say'];
        if (repeatRequests.some(repeat => lowerMessage.includes(repeat))) {
            return true;
        }
        return false;
    }
    /**
     * 직접 응답 처리
     */
    handleDirectResponse(message) {
        const lowerMessage = message.toLowerCase().trim();
        // 첫 인사 vs 일반 인사 구분
        if (lowerMessage === 'hi' || lowerMessage === 'hello') {
            return `Hi, you've reached ${this.companyName}, how can I help you?`;
        }
        // 다른 인사말들
        const greetings = ['hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
        if (greetings.some(greeting => lowerMessage.includes(greeting))) {
            return "Hello! How can I assist you today?";
        }
        // 감사 인사
        const thanks = ['thank you', 'thanks', 'thank', 'appreciate'];
        if (thanks.some(thank => lowerMessage.includes(thank))) {
            return "You're welcome! Is there anything else I can help you with?";
        }
        // 반복 요청
        const repeatRequests = ['repeat', 'say that again', 'what did you say'];
        if (repeatRequests.some(repeat => lowerMessage.includes(repeat))) {
            return "Could you please repeat your question? I want to make sure I understand correctly.";
        }
        return "How can I help you today?";
    }
    /**
     * Supervisor Agent에서 다음 응답 가져오기
     */
    async getNextResponseFromSupervisor(relevantContext, conversationHistory) {
        try {
            // 대화 히스토리를 필터링 (메시지만)
            const filteredHistory = conversationHistory
                .filter(msg => msg.type === 'text')
                .map(msg => ({
                type: 'message',
                role: msg.role,
                content: msg.content
            }));
            const supervisorInstructions = this.getSupervisorInstructions();
            const requestBody = {
                model: 'gpt-4.1',
                input: [
                    {
                        type: 'message',
                        role: 'system',
                        content: supervisorInstructions
                    },
                    {
                        type: 'message',
                        role: 'user',
                        content: `==== Conversation History ====
${JSON.stringify(filteredHistory, null, 2)}

==== Relevant Context From Last User Message ====
${relevantContext}`
                    }
                ],
                tools: this.getSupervisorTools(),
                parallel_tool_calls: false
            };
            const response = await this.openaiService.sendTextMessage('supervisor', JSON.stringify(requestBody));
            const finalText = await this.handleToolCalls(requestBody, response);
            if (typeof finalText === 'object' && finalText.error) {
                return { nextResponse: '', error: 'Something went wrong.' };
            }
            return { nextResponse: finalText };
        }
        catch (error) {
            console.error('Supervisor 응답 오류:', error);
            return { nextResponse: '', error: 'Something went wrong.' };
        }
    }
    /**
     * 도구 호출 처리
     */
    async handleToolCalls(body, response) {
        let currentResponse = response;
        while (true) {
            if (currentResponse?.error) {
                return { error: 'Something went wrong.' };
            }
            const outputItems = currentResponse.output ?? [];
            const functionCalls = outputItems.filter((item) => item.type === 'function_call');
            if (functionCalls.length === 0) {
                // 더 이상 함수 호출이 없으면 최종 메시지 반환
                const assistantMessages = outputItems.filter((item) => item.type === 'message');
                const finalText = assistantMessages
                    .map((msg) => {
                    const contentArr = msg.content ?? [];
                    return contentArr
                        .filter((c) => c.type === 'output_text')
                        .map((c) => c.text)
                        .join('');
                })
                    .join('\n');
                return finalText;
            }
            // 각 함수 호출 실행
            for (const toolCall of functionCalls) {
                const fName = toolCall.name;
                const args = JSON.parse(toolCall.arguments || '{}');
                const toolRes = this.getToolResponse(fName, args);
                console.log(`[supervisorAgent] 함수 호출: ${fName}`, args);
                // 함수 호출 및 결과를 요청 본문에 추가
                body.input.push({
                    type: 'function_call',
                    call_id: toolCall.call_id,
                    name: toolCall.name,
                    arguments: toolCall.arguments
                }, {
                    type: 'function_call_output',
                    call_id: toolCall.call_id,
                    output: JSON.stringify(toolRes)
                });
            }
            // 도구 출력을 포함하여 후속 요청
            currentResponse = await this.openaiService.sendTextMessage('supervisor', JSON.stringify(body));
        }
    }
    /**
     * 도구 응답 가져오기
     */
    getToolResponse(functionName, args) {
        switch (functionName) {
            case "getUserAccountInfo":
                return this.sampleAccountInfo;
            case "lookupPolicyDocument":
                return this.samplePolicyDocs.filter(doc => doc.topic.toLowerCase().includes(args.topic?.toLowerCase() || '') ||
                    doc.content.toLowerCase().includes(args.topic?.toLowerCase() || ''));
            case "findNearestStore":
                return this.sampleStoreLocations.filter(store => store.zip_code === args.zip_code);
            default:
                return { result: true };
        }
    }
    /**
     * 필러 문구 랜덤 선택
     */
    getRandomFillerPhrase() {
        const fillerPhrases = [
            "Just a second.",
            "Let me check.",
            "One moment.",
            "Let me look into that.",
            "Give me a moment.",
            "Let me see."
        ];
        return fillerPhrases[Math.floor(Math.random() * fillerPhrases.length)];
    }
    /**
     * Supervisor Agent 지침 반환
     */
    getSupervisorInstructions() {
        return `You are an expert customer service supervisor agent, tasked with providing real-time guidance to a more junior agent that's chatting directly with the customer. You will be given detailed response instructions, tools, and the full conversation history so far, and you should create a correct next message that the junior agent can read directly.

# Instructions
- You can provide an answer directly, or call a tool first and then answer the question
- If you need to call a tool, but don't have the right information, you can tell the junior agent to ask for that information in your message
- Your message will be read verbatim by the junior agent, so feel free to use it like you would talk directly to the user
  
==== Domain-Specific Agent Instructions ====
You are a helpful customer service agent working for ${this.companyName}, helping a user efficiently fulfill their request while adhering closely to provided guidelines.

# Instructions
- Always greet the user at the start of the conversation with "Hi, you've reached ${this.companyName}, how can I help you?"
- Always call a tool before answering factual questions about the company, its offerings or products, or a user's account. Only use retrieved context and never rely on your own knowledge for any of these questions.
- Escalate to a human if the user requests.
- Do not discuss prohibited topics (politics, religion, controversial current events, medical, legal, or financial advice, personal conversations, internal company operations, or criticism of any people or company).
- Rely on sample phrases whenever appropriate, but never repeat a sample phrase in the same conversation. Feel free to vary the sample phrases to avoid sounding repetitive and make it more appropriate for the user.
- Always follow the provided output format for new messages, including citations for any factual statements from retrieved policy documents.

# Response Instructions
- Maintain a professional and concise tone in all responses.
- Respond appropriately given the above guidelines.
- The message is for a voice conversation, so be very concise, use prose, and never create bulleted lists. Prioritize brevity and clarity over completeness.
    - Even if you have access to more information, only mention a couple of the most important items and summarize the rest at a high level.
- Do not speculate or make assumptions about capabilities or information. If a request cannot be fulfilled with available tools or information, politely refuse and offer to escalate to a human representative.
- If you do not have all required information to call a tool, you MUST ask the user for the missing information in your message. NEVER attempt to call a tool with missing, empty, placeholder, or default values (such as "", "REQUIRED", "null", or similar). Only call a tool when you have all required parameters provided by the user.
- Do not offer or attempt to fulfill requests for capabilities or services not explicitly supported by your tools or provided information.
- Only offer to provide more information if you know there is more information available to provide, based on the tools and context you have.
- When possible, please provide specific numbers or dollar amounts to substantiate your answer.

# User Message Format
- Always include your final response to the user.
- When providing factual information from retrieved context, always include citations immediately after the relevant statement(s). Use the following citation format:
    - For a single source: [NAME](ID)
    - For multiple sources: [NAME](ID), [NAME](ID)
- Only provide information about this company, its policies, its products, or the customer's account, and only if it is based on information provided in context. Do not answer questions outside this scope.`;
    }
    /**
     * Supervisor Agent 도구 정의
     */
    getSupervisorTools() {
        return [
            {
                type: "function",
                name: "lookupPolicyDocument",
                description: "Tool to look up internal documents and policies by topic or keyword.",
                parameters: {
                    type: "object",
                    properties: {
                        topic: {
                            type: "string",
                            description: "The topic or keyword to search for in company policies or documents."
                        }
                    },
                    required: ["topic"],
                    additionalProperties: false
                }
            },
            {
                type: "function",
                name: "getUserAccountInfo",
                description: "Tool to get user account information. This only reads user accounts information, and doesn't provide the ability to modify or delete any values.",
                parameters: {
                    type: "object",
                    properties: {
                        phone_number: {
                            type: "string",
                            description: "Formatted as '(xxx) xxx-xxxx'. MUST be provided by the user, never a null or empty string."
                        }
                    },
                    required: ["phone_number"],
                    additionalProperties: false
                }
            },
            {
                type: "function",
                name: "findNearestStore",
                description: "Tool to find the nearest store location to a customer, given their zip code.",
                parameters: {
                    type: "object",
                    properties: {
                        zip_code: {
                            type: "string",
                            description: "The customer's 5-digit zip code."
                        }
                    },
                    required: ["zip_code"],
                    additionalProperties: false
                }
            }
        ];
    }
}
exports.ChatSupervisorAgent = ChatSupervisorAgent;
//# sourceMappingURL=ChatSupervisorAgent.js.map