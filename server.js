import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

/* =========================
   OPENAI
========================= */

const openaiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

/* =========================
   RUNWAY
========================= */

const runwayKey = process.env.RUNWAYML_API_SECRET;

/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(openai),
    runwayConfigured: Boolean(runwayKey),
    model: openaiModel
  });
});

/* =========================
   OPENAI CREATIVE FEATURES
========================= */

app.post('/api/ai', async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'creative');
    const prompt = String(req.body?.prompt || '').trim();

    if (!prompt) {
      return res.status(400).json({
        error: 'Enter an instruction first.'
      });
    }

    if (!openai) {
      return res.status(503).json({
        error: 'OpenAI is not connected.'
      });
    }

    let task = prompt;

    if (mode === 'ad') {
      task = `Create a complete advertising package for: ${prompt}.

Include:
- Concept
- Target audience
- Hook
- 20-30 second script
- Shot-by-shot storyboard
- On-screen text
- Voiceover
- Call to action
- 3 alternate hooks`;
    }

    else if (mode === 'video') {
      task = `Create a production-ready video concept for: ${prompt}.

Include:
- Title
- Concept
- Duration
- Aspect ratio
- Shot descriptions
- Narration
- Captions
- Music direction
- Transitions
- Export settings`;
    }

    else if (mode === 'code') {
      task = `Act as a senior software engineer.

Build production-quality code for:

${prompt}

Include complete files where appropriate and setup instructions.
Do not invent APIs.`;
    }

    const response = await openai.responses.create({
      model: openaiModel,
      instructions:
        'You are CreatorAI Studio, an AI creative director and senior software engineer specializing in video, advertising and coding.',
      input: task
    });

    return res.json({
      ok: true,
      result: response.output_text || ''
    });

  } catch (error) {
    console.error('OpenAI error:', error);

    return res.status(500).json({
      error: error?.message || 'AI request failed.'
    });
  }
});

/* =========================
   REAL RUNWAY VIDEO
========================= */

app.post('/api/video', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const ratio = String(req.body?.ratio || '720:1280');

    if (!prompt) {
      return res.status(400).json({
        error: 'Enter a video description first.'
      });
    }

    if (!runwayKey) {
      return res.status(503).json({
        error: 'Runway is not connected. Add RUNWAYML_API_SECRET in Render.'
      });
    }

    const runwayResponse = await fetch(
      'https://api.dev.runwayml.com/v1/image_to_video',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${runwayKey}`,
          'X-Runway-Version': '2024-11-06'
        },
        body: JSON.stringify({
          model: 'gen4.5',
          promptText: prompt,
          ratio,
          duration: 5
        })
      }
    );

    const data = await runwayResponse.json();

    if (!runwayResponse.ok) {
      console.error('Runway create error:', data);

      return res.status(runwayResponse.status).json({
        error:
          data?.error ||
          data?.message ||
          'Runway could not start the video.'
      });
    }

    return res.json({
      ok: true,
      taskId: data.id
    });

  } catch (error) {
    console.error('Runway video error:', error);

    return res.status(500).json({
      error: error?.message || 'Video generation failed.'
    });
  }
});

/* =========================
   CHECK RUNWAY VIDEO
========================= */

app.get('/api/video/:taskId', async (req, res) => {
  try {
    if (!runwayKey) {
      return res.status(503).json({
        error: 'Runway is not connected.'
      });
    }

    const taskId = String(req.params.taskId);

    const runwayResponse = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${runwayKey}`,
          'X-Runway-Version': '2024-11-06'
        }
      }
    );

    const data = await runwayResponse.json();

    if (!runwayResponse.ok) {
      return res.status(runwayResponse.status).json({
        error:
          data?.error ||
          data?.message ||
          'Could not check video status.'
      });
    }

    if (data.status === 'SUCCEEDED') {
      return res.json({
        ok: true,
        status: 'completed',
        videoUrl: data.output?.[0] || null
      });
    }

    if (
      data.status === 'FAILED' ||
      data.status === 'CANCELED'
    ) {
      return res.json({
        ok: false,
        status: data.status,
        error: data.failure || 'Video generation failed.'
      });
    }

    return res.json({
      ok: true,
      status: String(data.status || 'RUNNING').toLowerCase()
    });

  } catch (error) {
    console.error('Runway status error:', error);

    return res.status(500).json({
      error: error?.message || 'Could not check video.'
    });
  }
});

/* =========================
   OLD RENDER PLAN
========================= */

app.post('/api/render-plan', (req, res) => {
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
});

/* =========================
   WEBSITE
========================= */

app.get('/{*splat}', (req, res) => {
  res.sendFile(
    path.join(publicDir, 'index.html')
  );
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `CreatorAI Studio running on port ${port}`
  );
});
