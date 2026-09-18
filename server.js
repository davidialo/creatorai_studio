import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const indexFile = path.join(__dirname, 'index.html');

app.use(express.json({ limit: '2mb' }));

// Serve files from the project root
app.use(express.static(__dirname));

// OpenAI configuration
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

const client = apiKey
  ? new OpenAI({
      apiKey,
      timeout: 30000
    })
  : null;

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(client),
    model
  });
});

// AI generation
app.post('/api/ai', async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'creative');
    const prompt = String(req.body?.prompt || '').trim();

    if (!prompt) {
      return res.status(400).json({
        error: 'Enter an instruction first.'
      });
    }

    if (!client) {
      return res.status(503).json({
        error: 'AI is not connected. Please try again later.'
      });
    }

    let task = prompt;

    if (mode === 'ad') {
      task = `
Create a complete advertising package for:

${prompt}

Include:
1. Campaign concept
2. Target audience
3. Main hook
4. 20-30 second video script
5. Shot-by-shot storyboard
6. On-screen text
7. Voiceover
8. Call to action
9. Three alternative hooks
`;
    }

    if (mode === 'video') {
      task = `
Create a production-ready AI video plan for:

${prompt}

Include:
1. Title
2. Concept
3. Duration
4. Aspect ratio
5. Scene-by-scene prompts
6. Narration
7. Captions
8. Music direction
9. Transitions
10. Export settings
`;
    }

    if (mode === 'code') {
      task = `
Act as a senior software engineer.

Build production-quality code for:

${prompt}

Include complete files where appropriate and clear setup instructions.

Do not invent APIs or pretend that an unavailable API exists.
`;
    }

    const response = await client.responses.create({
      model,
      instructions: `
You are CreatorAI Studio.

You are an AI creative director and senior software engineer specializing in:
- AI video
- advertising
- creative writing
- storyboards
- software development

Give useful, practical and well-structured results.

Never claim that a video has actually been rendered unless a real video renderer has completed the rendering.
`,
      input: task
    });

    return res.json({
      ok: true,
      result: response.output_text || ''
    });

  } catch (error) {
    console.error('AI ERROR:', error);

    return res.status(500).json({
      error: error?.message || 'AI request failed.'
    });
  }
});

// Create renderer-ready video manifest
app.post('/api/render-plan', (req, res) => {
  try {
    const title = String(
      req.body?.title || 'CreatorAI Video'
    );

    const aspect = String(
      req.body?.aspect || '9:16'
    );

    const scenes = Array.isArray(req.body?.scenes)
      ? req.body.scenes
      : [];

    if (scenes.length === 0) {
      return res.status(400).json({
        error: 'Add at least one scene.'
      });
    }

    const manifest = {
      version: 1,
      title,
      aspect,

      scenes: scenes.map((scene, index) => ({
        id: index + 1,
        duration: Number(scene?.duration) || 4,
        prompt: String(scene?.prompt || ''),
        narration: String(scene?.narration || ''),
        caption: String(scene?.caption || '')
      }))
    };

    return res.json({
      ok: true,
      manifest,
      status: 'ready_for_renderer'
    });

  } catch (error) {
    console.error('RENDER PLAN ERROR:', error);

    return res.status(500).json({
      error: 'Could not create the render plan. Please try again.'
    });
  }
});

// Send the root index.html for the website
app.get('/{*splat}', (req, res) => {
  res.sendFile(indexFile);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(
    `CreatorAI Studio running on port ${port}`
  );
});
