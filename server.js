import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/health', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const keyStatus = key ? `Present (Starts with ${key.substring(0, 4)}...)` : 'Missing';
    res.json({
      status: 'ok',
      port: port,
      node_env: process.env.NODE_ENV,
      apiKeyStatus: keyStatus,
      message: 'Server is running'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refine', async (req, res) => {
  const { prompt, mode } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }
    apiKey = apiKey.trim();

    let formatInstruction = "";
    switch (mode) {
      case 'professional':
        formatInstruction = "Format the text in a highly professional, articulate, and formal tone. Ensure proper business structure, elevated vocabulary, and absolute clarity.";
        break;
      case 'email':
        formatInstruction = "Format the text as a complete professional email. Include a concise Subject line, an appropriate Greeting, a clear and well-spaced Body, and a standard Sign-off.";
        break;
      case 'technical':
        formatInstruction = "Format the text as technical documentation. Be highly precise, objective, concise, and logically structured. Use bullet points, bold text for key terms, and clear headings where appropriate.";
        break;
      case 'coding':
        formatInstruction = "Format the text as a detailed developer prompt or technical spec.\n- Extract the core problem or feature request.\n- Detail the logic, constraints, and edge cases explicitly.\n- Specify preferred languages/frameworks if mentioned.\n- Provide structural guidance so an AI or human developer can immediately begin writing code.";
        break;
      case 'ai_prompt':
        formatInstruction = "Format the text as an optimized instructional prompt for an AI agent. Structure it with:\n- Role/Persona\n- Task/Objective\n- Context/Background\n- Rules & Constraints\n- Output Format Expected";
        break;
      case 'casual':
        formatInstruction = "Format the text as a casual chat message. Keep it relaxed, conversational, engaging, and friendly. Use modern phrasing, natural slang, and light emojis if appropriate.";
        break;
      case 'diary':
        formatInstruction = "Format the text as a personal journal entry. Make it reflective, expressive, insightful, and written strictly from a first-person perspective.";
        break;
      default:
        formatInstruction = "Ensure perfect grammar, spelling, and punctuation without changing the core meaning.";
        break;
    }

    const fullPrompt = `You are an expert text editor and formatter. I am providing you with raw text (which may be dictated speech or rough notes).
    
Your task:
1. Fix any grammatical, spelling, and punctuation errors.
2. ${formatInstruction}

Constraints:
- Respond ONLY with the finalized, refined text.
- Do NOT add any conversational filler, preambles, or explanations (e.g., do not say "Here is the rewritten text:").
- Output the text exactly as requested.

Raw Text:
"""
${prompt}
"""`;

    const modelName = 'gemini-2.5-flash';
    console.log(`Attempting stream generation with ${modelName}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    // Set headers for SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(value);
    }
    res.end();

  } catch (error) {
    console.error('Total Gemini API Failure:', error);
    // Since we might have already started streaming, it's safer to just end if headers are sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message || 'Failed to refine text'
      });
    } else {
      res.end();
    }
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
