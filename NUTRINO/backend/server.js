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
                contents: [{parts: [{
                        text: `Generate a **detailed, structured recipe** for ${prompt}. 
                
                        📌 **Output Format:**
                        - **Recipe Title**: Provide a **clear and appealing title**.
                        - **Ingredients List**: Mention **each ingredient** along with exact measurements.
                        - **Step-by-Step Instructions**:  
                          1️⃣ Write instructions **in a numbered list** with easy-to-follow steps.  
                          2️⃣ Each step should be **detailed and include cooking techniques**.  
                          3️⃣ Use **appropriate food-related emojis** to enhance readability.  
                        - **Nutritional Information**:  
                          ✅ Provide detailed nutrition facts, including:
                            - **Calories (in kcal)**
                            - **Protein, Carbohydrates, Fats (in grams)**
                            - **Any relevant vitamins or minerals**
                        - **Serving Suggestions**: Recommend how to serve the dish.
                
                        🎯 **Guidelines for Formatting:**
                        - **Do NOT include unnecessary symbols like "**"**.
                        - **Ensure readability by using proper spacing & structure**.
                        - **Make the response concise, engaging, and useful**.
                        - **DO NOT generate multiple recipes—ONLY one per request.**
                        `
                    }]
                }]
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
                Generate a **highly detailed** structured meal plan for **ONE DAY ONLY** using the given inputs:
                
                - **Ingredients available:** ${ingredients}
                - **Number of meals per day:** ${mealsPerDay}
                - **Servings per meal:** ${servings}
                - **Dietary restrictions:** ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "None"}
                
                ### **Output Format:**
                📌 **Meal Plan Name:** [Give a clear, descriptive name]
                
                🍽️ **Meals for the day:** (Exactly ${mealsPerDay} meals)
                
                For each meal, provide:
                1️⃣ **Meal Name** – A short, appetizing title  
                2️⃣ **Ingredients Used** – List **each ingredient** with proper measurements  
                3️⃣ **Step-by-Step Cooking Instructions** – Give **detailed** steps, including:
                   - Preparation (washing, cutting, marination, soaking if required)
                   - Cooking method (boiling, frying, baking, steaming, etc.)
                   - Cooking time and seasoning tips
                   - Final assembly and serving suggestions  
                
                📢 **Important Notes:**
                - Ensure the instructions are **clear and easy to follow**.  
                - Keep the portion sizes appropriate for ${servings} servings per meal.  
                - Use **common household cooking terms** (e.g., sauté, simmer, bake, grill).  
                - If an ingredient is used multiple times across meals, mention it but **avoid repetition in instructions**.  
                - The plan should be **structured, engaging, and practical**.  
                - **Do NOT generate multiple-day plans. Focus ONLY on one day.**  
                
                🎯 **Goal:** Provide a **realistic, easy-to-follow, and complete meal plan** that feels useful and practical for the user.  
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
