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

// ✅ Recipe Fetching API Route
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
                contents: [{
                    parts: [{
                        text: `Provide a detailed, structured recipe for ${prompt}. 
                        - Include a title, ingredients, step-by-step instructions, and nutritional facts.
                        - Specify the number of calories in a clear format.
                        - Use appropriate food-related emojis to make the recipe visually engaging.
                        - Format steps in a numbered list, removing any unnecessary symbols like "**".`
                    }]
                }]
            } ),
        });

        const data = await response.json();
        console.log("🔹 API Response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "❌ API request failed",
                details: data
            });
        }

        if (!data || !data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            return res.status(500).json({
                error: "❌ Invalid recipe response format",
                solution: "Try again later or check the API response structure."
            });
        }

        const recipeText = data.candidates[0].content.parts[0].text;
        console.log("🔹 Extracted Recipe:", recipeText);

        const newRecipeRef = db.collection("recipes").doc();
        await newRecipeRef.set({
            userId: req.user.uid,
            content: recipeText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Recipe stored successfully in Firestore: ${newRecipeRef.id}`);
        return res.json({ candidates: [{ content: { parts: [{ text: recipeText }] } }] });

    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        return res.status(500).json({
            error: "❌ Failed to fetch from Gemini API",
            details: error.message,
            solution: "Try again later or check if your API key is valid."
        });
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
// ✅ AI Meal Planner API Route
app.post("/api/generate-meal-plan", verifyAuthToken, async (req, res) => {
    try {
        console.log("📩 Received Meal Plan Request:", req.body);

        const { ingredients, mealsPerDay, servings, dietaryRestrictions } = req.body;
        if (!ingredients || !mealsPerDay || !servings) {
            return res.status(400).json({ error: "❌ Missing required fields." });
        }

        // Construct prompt for AI
        const prompt = `
            Create a structured meal plan using the following details:
            - Ingredients: ${ingredients}
            - Meals per day: ${mealsPerDay}
            - Servings: ${servings}
            - Dietary restrictions: ${dietaryRestrictions.length > 0 ? dietaryRestrictions.join(", ") : "None"}
            
            The plan should include:
            1. Breakfast, lunch, dinner, and snacks (if applicable).
            2. Detailed meal descriptions.
            3. Ingredient breakdown and cooking instructions.
            4. Approximate calories per meal.
            5. Food-related emojis for a visually engaging output.
            Format the response in an easy-to-read, structured way.
        `;

        const response = await fetch(API_URL, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
        });

        const data = await response.json();
        console.log("🔹 AI Meal Plan Response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || "❌ API request failed",
                details: data
            });
        }

        if (!data || !data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            return res.status(500).json({
                error: "❌ Invalid meal plan response format",
                solution: "Try again later or check the API response structure."
            });
        }

        const mealPlanText = data.candidates[0].content.parts[0].text;
        console.log("🔹 Generated Meal Plan:", mealPlanText);

        // Store the meal plan in Firebase Firestore
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

        console.log(`✅ Meal Plan stored in Firestore: ${mealPlanRef.id}`);
        return res.json({ mealPlan: mealPlanText });

    } catch (error) {
        console.error("❌ Error generating meal plan:", error.message);
        return res.status(500).json({
            error: "❌ Failed to generate meal plan",
            details: error.message,
            solution: "Try again later or check API key validity."
        });
    }
});

// ✅ Update Firestore Recipes to Structured Format (Without Image)
app.post("/api/update-recipes", async (req, res) => {
    try {
        const { aiResponse } = req.body; // Extract AI-generated recipe
        if (!aiResponse || !aiResponse.candidates || !aiResponse.candidates[0]?.content?.parts[0]?.text) {
            return res.status(400).json({ error: "Invalid AI response format." });
        }

        const recipesRef = db.collection("recipes");
        const snapshot = await recipesRef.get();

        let updatedCount = 0;
        const batch = db.batch(); // ✅ Batch update for efficiency

        snapshot.forEach((doc) => {
            const data = doc.data();

            if (!data.title || !data.ingredients || !data.steps) {
                console.log(`🔄 Updating recipe: ${doc.id}`);

                // ✅ Extract structured data from AI response
                const recipeText = aiResponse.candidates[0].content.parts[0].text;

                const titleMatch = recipeText.match(/## (.*?) 🌾🥣?/);
                const title = titleMatch ? titleMatch[1].trim() : "Untitled Recipe";

                const ingredientsMatch = recipeText.match(/\*\*Ingredients:\*\*([\s\S]*?)\*\*/);
                const ingredientsList = ingredientsMatch
                    ? ingredientsMatch[1].split("\n").map(item => item.trim()).filter(Boolean)
                    : [];

                const stepsMatch = recipeText.match(/\*\*Instructions:\*\*([\s\S]*?)\*\*/);
                const stepsList = stepsMatch
                    ? stepsMatch[1].split("\n").map(item => item.trim()).filter(Boolean)
                    : [];

                const nutritionMatch = recipeText.match(/\*\*Nutritional Information.*?\*\*([\s\S]*?)\*\*/);
                const nutritionText = nutritionMatch ? nutritionMatch[1] : "";

                const caloriesMatch = nutritionText.match(/\*\*Calories:\*\*\s*([\d-]+)/);
                const calories = caloriesMatch ? parseInt(caloriesMatch[1], 10) : 0;

                const servingsMatch = recipeText.match(/\*\*Yields:\*\*\s*(\d+)/);
                const servings = servingsMatch ? parseInt(servingsMatch[1], 10) : 1;

                const prepTimeMatch = recipeText.match(/\*\*Prep time:\*\*\s*(\d+)/);
                const prepTime = prepTimeMatch ? parseInt(prepTimeMatch[1], 10) : 10;

                const cookTimeMatch = recipeText.match(/\*\*Cook time:\*\*\s*(\d+)/);
                const cookTime = cookTimeMatch ? parseInt(cookTimeMatch[1], 10) : 15;

                const totalTime = prepTime + cookTime;

                // ✅ Prepare structured data
                const updatedData = {
                    title,
                    ingredients: ingredientsList,
                    steps: stepsList,
                    calories,
                    servings,
                    prepTime,
                    cookTime,
                    totalTime,
                    tags: ["custom", "ai-generated"]
                };

                // ✅ Batch update Firestore
                batch.update(doc.ref, updatedData);
                updatedCount++;
            }
        });

        // ✅ Commit all batch updates
        await batch.commit();
        console.log(`✅ Successfully updated ${updatedCount} recipes.`);

        res.json({ message: `Updated ${updatedCount} recipes successfully!` });

    } catch (error) {
        console.error("❌ Error updating recipes:", error.message);
        res.status(500).json({ error: "Failed to update recipes." });
    }
});

// ✅ Dynamic Port Handling
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
