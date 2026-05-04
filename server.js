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
        formatInstruction = "Format the text in a highly professional, articulate, and formal tone. Ensure proper business structure and clarity.";
        break;
      case 'email':
        formatInstruction = "Format the text as a professional email. Add Subject line, Greeting, Body, and Sign-off appropriately based on the context.";
        break;
      case 'technical':
        formatInstruction = "Format the text as technical writing. Be precise, objective, concise, and structured. Use bullet points if appropriate.";
        break;
      case 'coding':
        formatInstruction = "Format the text as a coding/developer prompt. Highlight logic, constraints, edge cases, and code architecture explicitly so a developer or AI assistant can easily understand.";
        break;
      case 'ai_prompt':
        formatInstruction = "Format and structure the text as a high-quality instructional prompt for an AI. Include role definition, task description, context, and constraints.";
        break;
      case 'casual':
        formatInstruction = "Format the text as a casual chat message in a modern 'Gen Z' style. Keep it relaxed, conversational, and use natural modern slang or abbreviations if it fits.";
        break;
      case 'diary':
        formatInstruction = "Format the text as a personal diary or journal entry. Make it reflective, expressive, and written from a first-person perspective.";
        break;
      default:
        formatInstruction = "Ensure perfect grammar, spelling, and punctuation without changing the core meaning.";
        break;
    }

    const fullPrompt = `You are an expert text editor. I am giving you raw text (which may be dictated speech or rough notes).
    
Your task:
1. Fix any grammatical, spelling, and punctuation errors.
2. ${formatInstruction}

Constraints:
- Respond ONLY with the finalized, refined text. Do not add any conversational filler or preambles.

Raw Text:
"""
${prompt}
"""`;

    // To ensure fast response, we ONLY use gemini-2.5-flash as it is the fastest and most capable for text tasks.
    // Iterating over models takes too much time.
    const modelName = 'gemini-2.5-flash';
    console.log(`Attempting generation with ${modelName}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      res.json({ text: data.candidates[0].content.parts[0].text });
    } else {
      throw new Error('Unexpected response structure from Gemini API');
    }

  } catch (error) {
    console.error('Total Gemini API Failure:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to refine text'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
