import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ✅ Load environment variables
dotenv.config();

const app = express();
app.use(cors()); // No need for { origin: "*" }, allow all by default
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ✅ Ensure API Key is Set
if (!API_KEY) {
    console.error("❌ ERROR: Missing API_KEY in environment variables.");
    process.exit(1);
}

// ✅ Health Check Route
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Recipe Fetching API
app.post("/api/fetch-recipe", async (req, res) => {
    try {
        console.log("📩 Received Request:", req.body);

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "❌ Prompt is required." });
        }

        // ✅ Make API Request
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}` // Ensure API key is sent
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate a structured recipe for: ${prompt}` }] }]
            }),
        });

        const data = await response.json();
        console.log("🔹 API Response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "❌ API request failed",
                details: data
            });
        }

        return res.json(data);
    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        return res.status(500).json({
            error: "❌ Failed to fetch from Gemini API",
            details: error.message,
            solution: "Try again later or check if your API key is valid."
        });
    }
});

// ✅ Dynamic Port Handling
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

