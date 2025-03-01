import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();

// ✅ Restrict CORS to your frontend domain
const FRONTEND_URL = "https://nutrino-ai.netlify.app";
app.use(cors({ origin: FRONTEND_URL }));

app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ✅ Middleware to Check Authentication
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1]; // Extract token
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    req.authToken = token;
    next();
}

// ✅ Test Route to Check Backend Health
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Secure Recipe Fetching API Route
app.post("/api/fetch-recipe", authenticate, async (req, res) => {
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

        // ✅ Handle API Response Properly
        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "API request failed" });
        }

        return res.json(data);
    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        return res.status(500).json({
            error: "Failed to fetch from Gemini API",
            details: error.message,
            fallback: "Try again later or check if the API key is valid."
        });
    }
});

// ✅ Dynamic Port for Deployment
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
