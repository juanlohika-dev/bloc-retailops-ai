import 'dotenv/config';
import { VertexAI } from '@google-cloud/vertexai';

process.env.GOOGLE_APPLICATION_CREDENTIALS = './service-account.json';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'bloc-retailops-ai';
const location = 'us-central1'; // Vertex AI models are widely available in us-central1 / asia-southeast1

async function testVertex() {
  console.log(`Connecting to Google Cloud Vertex AI (Project: ${project}, Location: ${location})...`);
  
  const vertexAI = new VertexAI({ project, location });
  const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const response = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: 'Hello Pax! Confirm you are online as the retail operations copilot for Project BLOC.' }]
    }]
  });

  const reply = response.response.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('🤖 VERTEX AI GEMINI RESPONSE:\n', reply);
  console.log('\n✅ VERTEX AI CONNECTION 100% OPERATIONAL!');
}

testVertex().then(() => process.exit(0)).catch(err => {
  console.error('❌ Vertex AI Connection Error:', err);
  process.exit(1);
});
