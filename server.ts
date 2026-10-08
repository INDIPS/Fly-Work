import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();
const SCRIPT_PATH = path.join(ROOT_DIR, 'net_probe.py');

// Initialize Gemini Client with telemetry user-agent header
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -----------------------------------------------------------------------------
// Live API WebSocket Server (gemini-3.8-live)
// -----------------------------------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', async (clientWs) => {
  try {
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction:
          'You are a senior network systems engineer and voice advisor. Assist with network discovery, subnets, firewall rules, port verification, and security analysis concisely.',
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('Error forwarding client audio to Live API:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session.close();
      } catch {}
    });
  } catch (err: any) {
    console.error('Failed to connect to Live API session:', err);
    clientWs.send(JSON.stringify({ error: err.message || 'Live session initialization failed' }));
    clientWs.close();
  }
});

// -----------------------------------------------------------------------------
// Gemini API: Multi-Turn Chatbot
// -----------------------------------------------------------------------------
app.post('/api/gemini/chat', async (req, res) => {
  const {
    messages = [],
    role = 'Network Systems & Security Architect',
    model = 'gemini-3.5-flash',
  } = req.body;

  try {
    // Select supported model
    const selectedModel =
      model === 'gemini-3.1-pro-preview'
        ? 'gemini-3.5-flash' // Fallback to flash since paid key was declined
        : model === 'gemini-3.1-flash-lite'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-3.5-flash';

    const systemInstruction = `You are a ${role}. Provide highly accurate, technical, and actionable guidance for network discovery, subnet management, port security (SSH, RDP, MCP endpoints), and system administration. Answer concisely.`;

    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({
      success: true,
      text: response.text || '',
      modelUsed: selectedModel,
    });
  } catch (err: any) {
    console.error('Gemini Chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Gemini API: Google Maps Grounding
// -----------------------------------------------------------------------------
app.post('/api/gemini/maps', async (req, res) => {
  const { query: userQuery, location } = req.body;

  try {
    const prompt = location
      ? `${userQuery} near ${location}`
      : userQuery;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    res.json({
      success: true,
      text: response.text || '',
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
      webSearchQueries: response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [],
    });
  } catch (err: any) {
    console.error('Gemini Maps error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Gemini API: Audio Transcription (gemini-3.5-transcribe)
// -----------------------------------------------------------------------------
app.post('/api/gemini/transcribe', async (req, res) => {
  const { audioData, mimeType = 'audio/webm' } = req.body;

  if (!audioData) {
    return res.status(400).json({ success: false, error: 'audioData base64 string is required' });
  }

  try {
    const cleanBase64 = audioData.includes('base64,')
      ? audioData.split('base64,')[1]
      : audioData;

    const audioPart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [audioPart, { text: 'Transcribe this spoken audio accurately into text.' }],
      },
    });

    res.json({
      success: true,
      text: response.text || '',
    });
  } catch (err: any) {
    console.error('Gemini Transcribe error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Gemini API: Veo Video Generation / Animation
// -----------------------------------------------------------------------------
app.post('/api/gemini/video-generate', async (req, res) => {
  const {
    imageBase64,
    mimeType = 'image/png',
    prompt = 'Subtle cinematic pan and camera motion of this network equipment',
    aspectRatio = '16:9',
  } = req.body;

  try {
    const cleanImage = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      image: {
        imageBytes: cleanImage,
        mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: (aspectRatio === '9:16' ? '9:16' : '16:9') as any,
      },
    });

    res.json({
      success: true,
      operationName: operation.name,
      aspectRatio,
    });
  } catch (err: any) {
    console.error('Veo Video generation error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Veo generation requires a paid API key or project authorization.',
    });
  }
});

app.post('/api/gemini/video-status', async (req, res) => {
  const { operationName } = req.body;
  if (!operationName) {
    return res.status(400).json({ success: false, error: 'operationName required' });
  }

  try {
    const updated = await ai.operations.getVideosOperation({
      operation: { name: operationName } as any,
    });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    res.json({
      success: true,
      done: updated.done || false,
      videoUri: uri,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Existing Network Discovery APIs
// -----------------------------------------------------------------------------
app.get('/api/network/detect', async (_req, res) => {
  try {
    const py = spawn('python3', [SCRIPT_PATH, '--detect-only']);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    py.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout.trim());
          return res.json({ success: true, data: parsed });
        } catch {
          return res.json({ success: true, raw: stdout.trim() });
        }
      }
      return res.status(500).json({
        success: false,
        error: stderr || 'Failed to detect active interface',
        fallback: {
          detected_cidr: '192.168.1.0/24',
          local_ip: '192.168.1.105',
          interface_type: 'Standard Local Subnet',
          details: 'Default routing fallback',
        },
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/network/scan', async (req, res) => {
  const {
    zone = '127.0.0.1/32',
    ports = '22,3389,8000,8080,5000,3000',
    timeout = 0.5,
    concurrency = 100,
    noDns = false,
  } = req.body;

  const args = [
    SCRIPT_PATH,
    '--zone',
    String(zone),
    '--ports',
    String(ports),
    '--timeout',
    String(timeout),
    '--concurrency',
    String(concurrency),
    '--json',
  ];
  if (noDns) args.push('--no-dns');

  try {
    const py = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    py.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout.trim());
          return res.json({ success: true, ...parsed });
        } catch (e: any) {
          return res.status(500).json({
            success: false,
            error: `JSON parsing failed: ${e.message}`,
            rawStdout: stdout,
          });
        }
      }
      return res.status(500).json({
        success: false,
        error: stderr || `Process exited with code ${code}`,
        rawStdout: stdout,
      });
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/network/scan-stream', (req, res) => {
  const zone = (req.query.zone as string) || '127.0.0.1/32';
  const ports = (req.query.ports as string) || '22,3389,8000,8080,5000,3000';
  const timeout = (req.query.timeout as string) || '0.5';
  const concurrency = (req.query.concurrency as string) || '150';
  const noDns = req.query.noDns === 'true';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('status', {
    state: 'started',
    zone,
    ports,
    timeout: Number(timeout),
    timestamp: Date.now(),
  });

  const args = [
    SCRIPT_PATH,
    '--zone',
    zone,
    '--ports',
    ports,
    '--timeout',
    timeout,
    '--concurrency',
    concurrency,
    '--inline',
  ];
  if (noDns) args.push('--no-dns');

  const py = spawn('python3', args);
  let lineBuffer = '';

  py.stdout.on('data', (chunk) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const host = JSON.parse(line.trim());
        sendEvent('host', host);
      } catch {
        sendEvent('log', { text: line });
      }
    }
  });

  py.stderr.on('data', (chunk) => {
    sendEvent('log', { text: chunk.toString(), isError: true });
  });

  py.on('close', (code) => {
    if (lineBuffer.trim()) {
      try {
        const host = JSON.parse(lineBuffer.trim());
        sendEvent('host', host);
      } catch {
        sendEvent('log', { text: lineBuffer });
      }
    }
    sendEvent('status', {
      state: 'finished',
      exitCode: code,
      timestamp: Date.now(),
    });
    res.end();
  });

  req.on('close', () => {
    py.kill('SIGINT');
  });
});

app.get('/api/network/script', (_req, res) => {
  try {
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="net_probe.py"');
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/network/mcp-schema', (_req, res) => {
  const schema = {
    name: 'discover_network_ports',
    description:
      'Discovers active network hosts, hotspot subnets, and probes for remote access (RDP, SSH) and MCP service endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: {
          type: 'string',
          description:
            'Target CIDR subnet to scan (e.g. "192.168.43.0/24"). Auto-detects if omitted.',
        },
        ports: {
          type: 'string',
          description:
            'Comma-separated list of target ports or presets ("22,3389,8000,8080,5000", "ssh", "rdp", "mcp").',
          default: '22,3389,8000,8080,5000',
        },
        timeout: {
          type: 'number',
          description: 'Socket connection timeout in seconds (default: 0.5)',
          default: 0.5,
        },
        concurrency: {
          type: 'number',
          description: 'Maximum parallel async probes (default: 150)',
          default: 150,
        },
      },
      required: [],
    },
    cli_integration: {
      command: 'python3 net_probe.py --mcp',
      pipe_example: 'python3 net_probe.py --inline | jq -c .',
    },
  };
  res.json(schema);
});

// -----------------------------------------------------------------------------
// Frontend Mounting
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[NetProbe Sentinel + AI Engine] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
