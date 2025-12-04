export type LLMProvider = 'openai' | 'gemini';

export interface LLMConfig {
    provider: LLMProvider;
    apiKey: string;
    endpoint?: string;
}

async function callOpenAI(prompt: string, fileContent: string, config: LLMConfig): Promise<string> {
    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a code assistant that helps split large pull requests. Extract only the changes relevant to the given prompt from the provided file content. Return only the modified file content, nothing else.'
                },
                {
                    role: 'user',
                    content: `Prompt: ${prompt}\n\nFile Content:\n${fileContent}\n\nExtract only the changes relevant to the prompt and return the modified file.`
                }
            ],
            temperature: 0.3,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(prompt: string, fileContent: string, config: LLMConfig): Promise<string> {
    const endpoint = config.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`;

    const response = await fetch(`${endpoint}?key=${config.apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `You are a code assistant that helps split large pull requests. Extract only the changes relevant to the given prompt from the provided file content. Return only the modified file content, nothing else.

Prompt: ${prompt}

File Content:
${fileContent}

Extract only the changes relevant to the prompt and return the modified file.`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
            }
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

export async function callLLM(prompt: string, fileContent: string, config: LLMConfig): Promise<string> {
    if (!config.apiKey) {
        throw new Error('LLM API key not configured');
    }

    try {
        if (config.provider === 'gemini') {
            return await callGemini(prompt, fileContent, config);
        } else {
            return await callOpenAI(prompt, fileContent, config);
        }
    } catch (error: any) {
        console.error('LLM call failed:', error);
        throw new Error(`LLM processing failed: ${error.message}`);
    }
}

export function saveLLMConfig(config: LLMConfig) {
    localStorage.setItem('llm-config', JSON.stringify(config));
}

export function loadLLMConfig(): LLMConfig | null {
    const stored = localStorage.getItem('llm-config');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}
