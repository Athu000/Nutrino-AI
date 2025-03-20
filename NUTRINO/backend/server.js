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
    process.exit(1);
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
        console.log("🔑 Received Auth Token:", idToken);

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

// ✅ Fetch Recipe API Route
app.post("/api/fetch-recipe", verifyAuthToken, async (req, res) => {
    try {
        console.log("📩 Received Request:", req.body);

        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "❌ Prompt is required." });
        }

        const response = await fetch(API_URL, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{
                        text: `Provide a detailed, structured recipe for ${prompt}. 
                        - Include a title, ingredients, step-by-step instructions.
                        - Specify nutritional information from recipe with specific detail.
                        - Specify the number of calories in a clear format.
                        - Use appropriate food-related emojis to make the recipe visually engaging.
                        - Format steps in a numbered list, removing any unnecessary symbols like "**".`
                    }] }]
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

        const recipeText = data.candidates[0]?.content?.parts[0]?.text;
        if (!recipeText) {
            return res.status(500).json({ error: "❌ Invalid recipe response format" });
        }

        // Store Recipe in Firestore
        const newRecipeRef = db.collection("recipes").doc();
        await newRecipeRef.set({
            userId: req.user.uid,
            content: recipeText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Recipe stored successfully in Firestore: ${newRecipeRef.id}`);
        return res.json({ recipe: recipeText });

    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        return res.status(500).json({ error: "Failed to fetch recipe", details: error.message });
    }
});

// ✅ Fetch User's Latest Meal Plan
app.get("/api/meal-plan", verifyAuthToken, async (req, res) => {
    try {
        const mealRef = db.collection("meals")
            .where("userId", "==", req.user.uid)
            .orderBy("createdAt", "desc")
            .limit(1);
        
        const snapshot = await mealRef.get();
        if (snapshot.empty) {
            return res.status(404).json({ error: "No meal plan found." });
        }

        const mealPlanData = snapshot.docs[0].data();
        return res.json({ mealPlan: mealPlanData });

    } catch (error) {
        console.error("❌ Error fetching meal plan:", error);
        return res.status(500).json({ error: "Failed to retrieve meal plan." });
    }
});

// ✅ Store Meal Plan
app.post("/api/generate-meal-plan", verifyAuthToken, async (req, res) => {
    try {
        console.log("📩 Received Meal Plan Request:", req.body);

        const { ingredients, mealsPerDay, servings, dietaryRestrictions } = req.body;
        if (!ingredients || !mealsPerDay || !servings) {
            return res.status(400).json({ error: "❌ Missing required fields." });
        }

        const prompt = `
            Generate a structured meal plan with:
            - Ingredients: ${ingredients}
            - Meals per day: ${mealsPerDay}
            - Servings: ${servings}
            - Dietary restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "None"}
        `;

        const response = await fetch(API_URL, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            return res.status(500).json({ error: "Invalid AI response format" });
        }

        const mealPlanText = data.candidates[0].content.parts[0].text;
        const mealPlanRef = db.collection("meals").doc();
        await mealPlanRef.set({
            userId: req.user.uid,
            ingredients,
            mealsPerDay,
            servings,
            dietaryRestrictions,
            mealPlan: mealPlanText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Meal Plan stored: ${mealPlanRef.id}`);
        return res.json({ mealPlanId: mealPlanRef.id, mealPlan: mealPlanText });

    } catch (error) {
        console.error("❌ Error:", error);
        return res.status(500).json({ error: "Failed to generate meal plan" });
    }
});

// ✅ Delete Latest Meal Plan
app.delete("/api/delete-meal-plan", verifyAuthToken, async (req, res) => {
    try {
        const mealRef = db.collection("meals")
            .where("userId", "==", req.user.uid)
            .orderBy("createdAt", "desc")
            .limit(1);

        const snapshot = await mealRef.get();
        if (snapshot.empty) {
            return res.status(404).json({ error: "No meal plan found to delete." });
        }

        await snapshot.docs[0].ref.delete();
        return res.json({ message: "✅ Meal plan deleted successfully." });

    } catch (error) {
        console.error("❌ Error deleting meal plan:", error);
        return res.status(500).json({ error: "Failed to delete meal plan." });
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
