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

// Initialize inside routes to ensure fresh env variables if needed
app.get('/api/health', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    const keyStatus = key ? `Present (Starts with ${key.substring(0, 4)}...)` : 'Missing';
    
    // Test if we can list models to verify API key validity
    // Note: listModels might not be available in all SDK versions or configurations
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
  const { prompt } = req.body;

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
    apiKey = apiKey.trim(); // Prevent Dokploy newline injection from breaking URL routing

    const fallbackModels = [
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    let finalResponseText = null;
    let lastError = null;

    for (const modelName of fallbackModels) {
      try {
        console.log(`Attempting REST API generation with model: ${modelName}`);
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || JSON.stringify(data));
        }

        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          finalResponseText = data.candidates[0].content.parts[0].text;
          console.log(`Success with ${modelName}!`);
          break; // Success, exit the loop
        } else {
          throw new Error('Unexpected response structure from Gemini API');
        }
      } catch (err) {
        lastError = err;
        console.warn(`REST API Model ${modelName} failed: ${err.message}`);
      }
    }

    if (finalResponseText) {
      res.json({ text: finalResponseText });
    } else {
      throw lastError || new Error("All native fallback models failed.");
    }

  } catch (error) {
    console.error('Total Gemini API Failure:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to refine text'
    });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
