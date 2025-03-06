import { auth, db } from "./auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy, limit  } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Get or Refresh Firebase Auth Token
async function getAuthToken() {
    try {
        const user = auth.currentUser;
        if (user) {
            return await user.getIdToken(true);
        }
    } catch (error) {
        console.error("❌ Auth Token Error:", error);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
    }
    return null;
}

// ✅ Delete Old Recipe from Firestore
async function deleteOldRecipe() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const recipesRef = collection(db, "recipes");
        const q = query(recipesRef, where("userId", "==", user.uid), orderBy("createdAt", "asc"),
            orderBy("createdAt", "asc"), 
            limit(1)
        ); // Order by oldest first
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const oldestDoc = querySnapshot.docs[0]; // Delete the first (oldest) recipe
            await deleteDoc(doc(db, "recipes", oldestDoc.id));
            console.log("✅ Old recipe deleted from Firestore.");
        } else {
            console.log("⚠️ No old recipes found to delete.");
        }
    } catch (error) {
        console.error("❌ Error deleting old recipe:", error);
    }
}

// ✅ Fetch Recipe & Save to Firestore
async function fetchRecipe(prompt) {
    let authToken = await getAuthToken();
    if (!authToken) return;

    try {
        console.log("🗑️ Deleting old recipe before fetching a new one...");
        await deleteOldRecipe(); // ✅ Moved deletion before API call

        console.log("📤 Sending request to API:", API_BASE_URL);
        const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            console.error("❌ API Request Failed:", response.status, response.statusText);
            alert("Failed to fetch recipe. Try again.");
            return;
        }

        const data = await response.json();
        console.log("✅ API Response Received:", data);

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            console.error("❌ API Response is malformed:", data);
            alert("Received an invalid recipe response.");
            return;
        }

        let recipeText = data.candidates[0].content.parts[0].text;
        console.log("✅ Extracted Recipe Text:", recipeText);

        // ✅ Save new Recipe to Firestore
        const user = auth.currentUser;
        if (user) {
            const docRef = await addDoc(collection(db, "recipes"), {
                userId: user.uid,
                recipe: recipeText,
                createdAt: new Date()
            });
            console.log(`✅ New recipe saved to Firestore (ID: ${docRef.id})`);

            // ✅ Ensure the page updates instead of a full reload
            sessionStorage.setItem("latestRecipe", JSON.stringify({ id: docRef.id, recipeText }));
            window.location.href = "generated_recipe.html";
        }
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
}

// ✅ Display Recipe from Firestore
async function displayRecipe() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not logged in.");
            return;
        }

        const recipesRef = collection(db, "recipes");
        const q = query(recipesRef, where("userId", "==", user.uid),
            orderBy("createdAt", "asc"),             
            limit(1)
        );
        const querySnapshot = await getDocs(q, { source: "server" });

        if (querySnapshot.empty) {
            console.log("⚠️ No recipes found.");
            document.getElementById("recipe-title").textContent = "No recipes found.";
            return;
        }

        // Get the latest recipe
        const latestRecipe = querySnapshot.docs[querySnapshot.docs.length - 1].data().recipe;
        console.log("✅ Loaded Latest Recipe:", latestRecipe);

        document.getElementById("recipe-title").textContent = extractTitle(latestRecipe);
        document.getElementById("recipe-desc").textContent = "A delicious AI-generated recipe! 😋";
        console.log("✅ Extracting Ingredients...");
        document.getElementById("ingredients-list").innerHTML = extractSection(latestRecipe, "Ingredients");
        
        console.log("✅ Extracting Instructions...");
        document.getElementById("instructions-list").innerHTML = extractSection(latestRecipe, "Instructions");
        
        console.log("✅ Extracting Nutrition...");
        document.getElementById("nutrition-list").innerHTML = extractSection(latestRecipe, "Nutritional Information");} catch (error) {
        console.error("❌ Error displaying recipe:", error);
    }
}

// ✅ Extract Title (Keep emojis)
function extractTitle(text) {
    if (!text) return "AI-Generated Recipe";
    const match = text.match(/^##\s*(.+)/);
    return match ? cleanText(match[1].trim()) : "AI-Generated Recipe";
}

// ✅ Extract Ingredients, Instructions & Nutrition (Keep emojis, remove ** and extra symbols)
function extractSection(text, section) {
    if (!text) return `<li>⚠️ No data available.</li>`;

    console.log(`🔎 Searching for section: ${section} in text...`); // Debugging

    // Updated regex to handle extra text after the section name
    const regex = new RegExp(`\\*\\*${section}.*?\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i");
    const match = text.match(regex);

    if (!match) {
        console.warn(`⚠️ Section '${section}' not found in text.`);
        return `<li>⚠️ No data available.</li>`;
    }

    console.log(`✅ Found Section: ${section}`, match[1]); // Debugging

    return match[1]
        .trim()
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => `<li>${cleanText(line.trim())}</li>`)
        .join("");
}


// ✅ Remove Extra Symbols (Keep Emojis)
function cleanText(text) {
     return text
        .replace(/\*\*/g, "") // Remove **bold**
        .replace(/^[-*•]\s*/g, "") // Remove bullet points but keep emojis
        .trim();
    cleanedLine = cleanedLine
        .replace(/Preheat/g, '🔥 Preheat')
        .replace(/Mix/g, '🥣 Mix')
        .replace(/Stir/g, '🌀 Stir')
        .replace(/Bake/g, '🔥 Bake')
        .replace(/Serve/g, '🍽️ Serve')
        .replace(/Cool/g, '❄️ Cool')
        .replace(/Whisk/g, '🥄 Whisk')
        .replace(/Cream/g, '🧈 Cream')
        .replace(/Fold/g, '🎭 Fold')
        .replace(/Grease/g, '🛢️ Grease')
        .replace(/Beat/g, '🥊 Beat')
        .replace(/Sprinkle/g, '✨ Sprinkle');

    return cleanedLine;
}

// ✅ Handle UI Actions & Buttons
function clearPreviousRecipe() {
    sessionStorage.removeItem("latestRecipe");
    localStorage.removeItem("latestRecipe");
    document.getElementById("recipe-desc").innerHTML = "";
}

function reloadNewRecipe() {
    clearPreviousRecipe();
    window.location.href = window.location.pathname + "?new";
}

// ✅ Event Listeners for Buttons
document.addEventListener("DOMContentLoaded", function () {
    let urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("new")) {
        clearPreviousRecipe();
    }

    document.getElementById("goBackBtn").addEventListener("click", function () {
        clearPreviousRecipe();
        window.location.href = "index.html";
    });

    document.getElementById("generateAnotherBtn").addEventListener("click", function () {
        reloadNewRecipe();
    });

    displayRecipe();
});

// ✅ Make function globally accessible
window.fetchRecipe = fetchRecipe;
window.displayRecipe = displayRecipe;
