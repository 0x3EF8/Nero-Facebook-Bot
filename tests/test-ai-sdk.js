const { generateText } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const path = require('path');
const config = require('../src/config/config');

async function testAISDK() {
    const keys = [config.apiKeys.gemini, ...config.apiKeys.geminiBackups].filter(Boolean);
    const models = ['models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-pro'];

    for (const apiKey of keys) {
        console.log(`
Trying key: ${apiKey.substring(0, 10)}...`);
        const google = createGoogleGenerativeAI({ apiKey });

        for (const modelName of models) {
            try {
                console.log(`  Testing model: ${modelName}`);
                const { text } = await generateText({
                    model: google(modelName),
                    prompt: 'Hello',
                });
                console.log("  Success! Response:", text);
                return; // Exit on success
            } catch (error) {
                console.log("  Failed:", error.message);
                if (error.message.includes("expired")) break; // Don't try other models if key is expired
            }
        }
    }
    console.error("All keys/models failed.");
}

testAISDK();
