import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateAvatar(prompt, filename) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: prompt,
      config: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
      }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        fs.writeFileSync(`public/${filename}`, Buffer.from(part.inlineData.data, 'base64'));
        console.log(`Saved ${filename}`);
      }
    }
  } catch (e) {
    console.error(`Failed for ${filename} with pro:`, e.message);
    try {
        const response2 = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: prompt,
            config: {
              imageConfig: { aspectRatio: "1:1" }
            }
          });
          for (const part of response2.candidates[0].content.parts) {
            if (part.inlineData) {
              fs.writeFileSync(`public/${filename}`, Buffer.from(part.inlineData.data, 'base64'));
              console.log(`Saved ${filename} with flash`);
            }
          }
    } catch (e2) {
        console.error(`Failed for ${filename} with flash:`, e2.message);
    }
  }
}

async function main() {
  if (!fs.existsSync('public')) fs.mkdirSync('public');
  await generateAvatar('A high quality professional corporate headshot of a Korean man in his 50s, CEO, wearing a suit, clean background, photorealistic, 8k resolution', 'avatar_1.png');
  await generateAvatar('A high quality professional corporate headshot of a Korean man in his 40s, manager, wearing a business casual suit, clean background, photorealistic, 8k resolution', 'avatar_2.png');
  await generateAvatar('A high quality professional corporate headshot of a Korean woman in her 30s, manager, wearing professional business attire, long hair, clean background, photorealistic, 8k resolution', 'avatar_3.png');
  await generateAvatar('A high quality professional corporate headshot of a Korean woman in her 20s, assistant manager, wearing professional business attire, long hair, clean background, photorealistic, 8k resolution', 'avatar_4.png');
  await generateAvatar('A high quality professional corporate headshot of a Korean man in his 40s, manager, wearing a business casual suit, clean background, photorealistic, 8k resolution', 'avatar_5.png');
  await generateAvatar('A high quality professional corporate headshot of a Korean man in his 30s, manager, wearing a business casual suit, clean background, photorealistic, 8k resolution', 'avatar_6.png');
}
main();
