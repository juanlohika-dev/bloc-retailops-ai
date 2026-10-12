import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

async function testGemini() {
  console.log('Testing Google Gemini connection with GEMINI_API_KEY...');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Hello! You are Pax, the frontline retail operations copilot for Project BLOC. Give a quick 1-sentence greeting to promoter Liza at SM Megamall.',
  });

  console.log('\n🤖 GEMINI 2.5 FLASH RESPONSE:');
  console.log(response.text);
  console.log('\n✅ GEMINI 2.5 FLASH 100% OPERATIONAL!');
}

testGemini().then(() => process.exit(0)).catch(err => {
  console.error('❌ Gemini Error:', err);
  process.exit(1);
});
