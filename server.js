import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// Serve index.html and other files from the repository root
app.use(express.static(__dirname));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: !!client,
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna'
  });
});

// AI endpoint
app.post('/api/ai', async (req, res) => {
  try {
    const { mode = 'creative', prompt = '' } = req.body || {};

    if (!prompt.trim()) {
      return res.status(400).json({
        error: 'Enter an instruction first.'
      });
    }

    if (!client) {
      return res.status(503).json({
        error: 'AI is not connected yet. Add OPENAI_API_KEY in Render Environment Variables.'
      });
    }

    let task = prompt;

    if (mode === 'ad') {
      task = `Create a complete advertising package for: ${prompt}.
Include concept, audience, hook, 20-30 second script, shot-by-shot storyboard, on-screen text, voiceover, CTA, and 3 alternate hooks.`;
    }

    if (mode === 'video') {
      task = `Create a production-ready AI video plan for: ${prompt}.
Include title, concept, duration, aspect ratio, shot prompts, narration, captions, music direction, transitions, and export settings.`;
    }

    if (mode === 'code') {
      task = `Act as a senior software engineer.
Build production-quality code for: ${prompt}.
Include complete files where appropriate and setup instructions.
Do not invent APIs.`;
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions:
        'You are CreatorAI Studio, an AI creative director and senior software engineer specializing in video, advertising and coding. Never claim a video was rendered unless a real renderer completed it.',
      input: task
    });

    res.json({
      ok: true,
      result: response.output_text
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error?.message || 'AI request failed.'
    });
  }
});

// Video production plan
app.post('/api/render-plan', (req, res) => {
  const {
    title = 'CreatorAI Video',
    scenes = [],
    aspect = '9:16'
  } = req.body || {};

  if (!scenes.length) {
    return res.status(400).json({
      error: 'Add at least one scene.'
    });
  }

  res.json({
    ok: true,
    manifest: {
      version: 1,
      title,
      aspect,
      scenes: scenes.map((scene, index) => ({
        id: index + 1,
        duration: Number(scene.duration) || 4,
        prompt: String(scene.prompt || ''),
        narration: String(scene.narration || ''),
        caption: String(scene.caption || '')
      }))
    },
    status: 'ready_for_renderer'
  });
});

// Website fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`CreatorAI Studio running on port ${port}`);
});
