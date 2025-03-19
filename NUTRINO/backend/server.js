import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const app = express();
app.use(cors({ origin: ["https://yourdomain.com"] })); // ✅ Restricted CORS for security
app.use(express.json());

const API_KEY = process.env.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

if (!API_KEY) {
    console.error("❌ ERROR: Missing API_KEY in environment variables.");
    process.exit(1);
}

// ✅ Firebase Initialization with Cleanup
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log("✅ Firebase Admin SDK initialized.");
} catch (error) {
    console.error("❌ ERROR: Firebase Initialization Failed:", error.message);
    process.exit(1);
}

const db = admin.firestore();

// ✅ Graceful Shutdown
process.on("SIGINT", async () => {
    console.log("🛑 Server shutting down...");
    await admin.app().delete();
    process.exit(0);
});

// ✅ Health Check Route
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
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Unauthorized: Invalid token" });
    }
}

// ✅ Generate & Store Recipe
app.post("/api/fetch-recipe", verifyAuthToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "❌ Prompt is required." });

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: `Recipe for ${prompt}` }] }] }),
        });

        const data = await response.json();
        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return res.status(500).json({ error: "❌ Invalid recipe response format" });
        }

        const recipeText = data.candidates[0].content.parts[0].text;
        const newRecipeRef = db.collection("recipes").doc();
        await newRecipeRef.set({
            userId: req.user.uid,
            content: recipeText,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({ recipeId: newRecipeRef.id, recipeText });
    } catch (error) {
        return res.status(500).json({ error: "❌ Failed to fetch recipe" });
    }
});

// ✅ Fetch Recent Recipes
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
        return res.status(500).json({ error: "Failed to retrieve recipes." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
