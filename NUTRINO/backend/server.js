import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

if (!API_KEY) {
    console.error("❌ ERROR: Missing API_KEY in environment variables.");
    process.exit(1);
}

// ✅ Firebase Initialization
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
    console.error("❌ ERROR: Firebase Initialization Failed:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// ✅ Health Check
app.get("/", (req, res) => {
    res.json({ message: "✅ Nutrino AI Backend is Running!" });
});

// ✅ Middleware: Verify User Authentication
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
        return res.status(403).json({ error: "Unauthorized: Invalid token" });
    }
}

// ✅ Generate New Recipe & Store in Firestore
app.post("/api/fetch-recipe", verifyAuthToken, async (req, res) => {
    try {
        console.log("📩 Request Received:", req.body);

        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "❌ Prompt is required." });

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Provide a detailed, structured recipe for ${prompt}.
                        - Include a title, ingredients, step-by-step instructions, and nutritional facts.
                        - Specify the number of calories in a clear format.
                        - Format steps in a numbered list, removing any unnecessary symbols.`
                    }]
                }]
            }),
        });

        const data = await response.json();
        console.log("🔹 API Response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || "❌ API request failed" });
        }

        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return res.status(500).json({ error: "❌ Invalid recipe response format" });
        }

        const recipeText = data.candidates[0].content.parts[0].text;
        console.log("🔹 Extracted Recipe:", recipeText);

        // ✅ Store recipe with user ID
        const newRecipeRef = db.collection("recipes").doc();
        await newRecipeRef.set({
            userId: req.user.uid,
            content: recipeText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Recipe stored successfully: ${newRecipeRef.id}`);

        return res.json({ recipeId: newRecipeRef.id, recipeText });

    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        return res.status(500).json({ error: "❌ Failed to fetch recipe from API" });
    }
});

// ✅ Fetch User's Recent Recipes
app.get("/api/recent-recipes", verifyAuthToken, async (req, res) => {
    try {
        const snapshot = await db.collection("recipes")
            .where("userId", "==", req.user.uid)
            .orderBy("createdAt", "desc")
            .limit(10)
            .get();

        const recipes = snapshot.docs.map(doc => ({
            id: doc.id,
            content: doc.data().content,
            createdAt: doc.data().createdAt
        }));

        return res.json({ recentRecipes: recipes });

    } catch (error) {
        console.error("❌ Error fetching recent recipes:", error.message);
        return res.status(500).json({ error: "Failed to retrieve recent recipes." });
    }
});

// ✅ Cooking Assistant Integration
app.post("/api/cooking-assistant", verifyAuthToken, async (req, res) => {
    try {
        const { recipeId } = req.body;
        if (!recipeId) return res.status(400).json({ error: "❌ Recipe ID is required." });

        const recipeDoc = await db.collection("recipes").doc(recipeId).get();
        if (!recipeDoc.exists) return res.status(404).json({ error: "❌ Recipe not found." });

        const recipeContent = recipeDoc.data().content;
        return res.json({ message: "✅ Cooking Assistant Ready", recipeContent });

    } catch (error) {
        console.error("❌ Error fetching Cooking Assistant data:", error.message);
        return res.status(500).json({ error: "Failed to retrieve cooking assistant data." });
    }
});

// ✅ Meal Planning Service
app.post("/api/meal-planner", verifyAuthToken, async (req, res) => {
    try {
        const { meals } = req.body;
        if (!meals || !Array.isArray(meals)) {
            return res.status(400).json({ error: "❌ Meals data is required and must be an array." });
        }

        const newPlanRef = db.collection("mealPlans").doc();
        await newPlanRef.set({
            userId: req.user.uid,
            meals,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Meal Plan stored: ${newPlanRef.id}`);
        return res.json({ message: "✅ Meal Plan Created Successfully", mealPlanId: newPlanRef.id });

    } catch (error) {
        console.error("❌ Error creating meal plan:", error.message);
        return res.status(500).json({ error: "Failed to create meal plan." });
    }
});

// ✅ Handle Unsaved Changes Alert
app.post("/api/check-unsaved-changes", verifyAuthToken, async (req, res) => {
    try {
        const { hasUnsavedChanges } = req.body;
        if (hasUnsavedChanges) {
            return res.json({ alert: "⚠️ You have unsaved changes. Do you want to continue?" });
        }
        return res.json({ message: "✅ No unsaved changes." });
    } catch (error) {
        console.error("❌ Error checking unsaved changes:", error.message);
        return res.status(500).json({ error: "Failed to check unsaved changes." });
    }
});

// ✅ Server Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
