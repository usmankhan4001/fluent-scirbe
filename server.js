import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Let the SDK use its default API version (usually v1beta or v1 based on model)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.json({ text });
  } catch (error) {
    console.error('Detailed Gemini API Error:', error);
    
    // Solid fallback strategy in case primary model or endpoint fails
    try {
      console.log('Attempting fallback with alternative model/settings...');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
      const result = await fallbackModel.generateContent(prompt);
      const response = await result.response;
      res.json({ text: response.text() });
    } catch (fallbackError) {
      console.error('Fallback Gemini API Error:', fallbackError);
      res.status(500).json({ 
        error: error.message || 'Failed to refine text',
        details: error.stack
      });
    }
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
