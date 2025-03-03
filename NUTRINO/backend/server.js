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

// ✅ Initialize Firebase Admin SDK
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
    console.error("❌ ERROR: Failed to initialize Firebase Admin SDK:", error.message);
    process.exit(1);
}

const db = admin.firestore(); // Firestore database instance

// ✅ Health Check Route
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Middleware for Authentication Verification
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

// ✅ Recipe Fetching API Route
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
                contents: [{ parts: [{ text: `Generate a structured recipe for: ${prompt}. Include the name, cuisine type, prep time, cook time, total time, number of servings, a list of ingredients, step-by-step cooking instructions, and an estimated calorie count per serving.` }] }]
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
        if (!data || !data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            return res.status(500).json({
                error: "❌ Invalid recipe response format",
                solution: "Try again later or check the API response structure."
            });
        }

        const recipeText = data.candidates[0].content.parts[0].text;
        console.log("🔹 Raw Recipe Response:", recipeText); // Debugging: Check the raw API response

        let recipe;
        try {
        recipe = JSON.parse(recipeText); // Try parsing as JSON
        } catch (e) {
        console.error("❌ Error parsing API response:", e.message);
        return res.status(500).json({ error: "Invalid API response format", details: e.message });
        }

        
        // ✅ Convert structured JSON to formatted text
        const formattedRecipe = `## ${recipe.recipeName || "Generated Recipe"}\n
**Cuisine:** ${recipe.cuisine || "Unknown"}\n
**Prep Time:** ${recipe.prepTime || "N/A"} | **Cook Time:** ${recipe.cookTime || "N/A"} | **Total Time:** ${recipe.totalTime || "N/A"}\n
**Servings:** ${recipe.servings || "N/A"} | **Calories (per serving):** ${recipe.nutritionInfo?.calories || "N/A"} kcal\n
\n**Ingredients:**\n${recipe.ingredients?.map(i => `- ${i}`).join("\n") || "No ingredients provided"}\n
\n**Instructions:**\n${recipe.instructions?.map((step, index) => `${index + 1}. ${step}`).join("\n") || "No instructions provided"}\n
\n**Tips & Variations:**\n${recipe.tipsAndVariations?.map(t => `- ${t}`).join("\n") || "No additional tips available"}`;

        // ✅ Store in Firestore
        const newRecipeRef = db.collection("recipes").doc();
        await newRecipeRef.set({
            userId: req.user.uid,
            content: formattedRecipe,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ Recipe stored in Firestore with ID:", newRecipeRef.id);

        return res.json({ candidates: [{ content: { parts: [{ text: formattedRecipe }] } }] });

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
