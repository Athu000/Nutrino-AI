import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config(); // Load environment variables

const app = express();
app.use(cors({ origin: "*" })); // Allow all frontend requests
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// ✅ Check if API Key is available
if (!API_KEY) {
    console.error("❌ ERROR: Missing API_KEY in environment variables.");
    process.exit(1); // Stop the server if API_KEY is missing
}

// ✅ Initialize Firebase Admin SDK (Improved Error Handling)
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
    console.error("❌ ERROR: Failed to initialize Firebase Admin SDK:", error.message);
    process.exit(1); // Stop the server if Firebase is not configured correctly
}

// ✅ Health Check Route
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Middleware for Authentication Verification (Improved)
async function verifyAuthToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Unauthorized: Missing token" });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        console.log(`🔑 Authenticated User: ${decodedToken.email}`);
        next();
    } catch (error) {
        console.error("❌ Authentication Error:", error.message);
        return res.status(403).json({
            error: "Unauthorized: Invalid token",
            details: error.message
        });
    }
}

// ✅ Recipe Fetching API Route (Improved Error Handling)
app.post("/api/fetch-recipe", verifyAuthToken, async (req, res) => {
    try {
        console.log("📩 Received Request:", req.body);

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "❌ Prompt is required." });
        }

        // Fetch Recipe from Gemini API
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

        // ✅ Ensure valid recipe data structure
        if (!data || !data.candidates || !data.candidates[0]?.content) {
            return res.status(500).json({
                error: "❌ Invalid recipe response format",
                solution: "Try again later or check the API response structure."
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
