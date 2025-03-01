const express = require("express");
const cors = require("cors");

// ✅ Use node-fetch for older Node.js versions
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Use API Key from Vercel Environment Variables
const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ✅ Test Backend Route
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Ensure Correct API Route
app.post("/api/fetch-recipe", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // ✅ Fetch Recipe from Gemini API
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a structured recipe for: ${prompt}` }] }]
            }),
        });

        // ✅ Check for Errors Before Parsing JSON
        if (!response.ok) {
            return res.status(response.status).json({ error: "API request failed" });
        }

        const data = await response.json();
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch from Gemini API", details: error.message });
    }
});

// ✅ Use Dynamic Port for Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
