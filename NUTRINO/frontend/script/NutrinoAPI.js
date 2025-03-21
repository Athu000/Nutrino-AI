import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy,getDoc, limit,setDoc ,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        const q = query(
            recipesRef,
            where("userId", "==", user.uid),
            orderBy("createdAt", "asc"), // ✅ Only one orderBy
            limit(1) // ✅ Only delete the oldest recipe
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const oldestDoc = querySnapshot.docs[0]; // Get the oldest recipe
            await deleteDoc(doc(db, "recipes", oldestDoc.id));
            console.log("✅ Old recipe deleted from Firestore:", oldestDoc.id);
        } else {
            console.log("⚠️ No old recipes found to delete.");
        }
    } catch (error) {
        console.error("❌ Error deleting old recipe:", error);
    }
}

// ✅ Fetch Recipe & Save to Firestore
export async function fetchRecipe(prompt) {
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
        let recipeText = data.recipe || (data.candidates?.[0]?.content?.parts?.[0]?.text);

        if (!recipeText) {
            console.error("❌ API Response is malformed:", data);
            alert("Received an invalid recipe response.");
            return;
        }
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
            setTimeout(() => {
                window.location.href = "generated_recipe.html"; // Redirect after a short delay
            }, 1500);
        }
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
}
document.addEventListener("DOMContentLoaded", function () {
    const recipeCards = document.querySelectorAll(".Grid-col1"); // Select all recipe cards
    const recipeInput = document.getElementById("rec_search"); // Recipe input box

    // ✅ When a recipe card is clicked, set its name in the input box and scroll up
    recipeCards.forEach(card => {
        card.addEventListener("click", function (event) {
            event.preventDefault(); // ⛔ Prevent redirection

            const recipeName = card.querySelector(".Text-root1")?.textContent.trim(); // Get recipe name
            if (recipeName) {
                recipeInput.value = recipeName; // Set recipe name in input box

                // ✅ Scroll smoothly to the input box
                recipeInput.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                console.warn("⚠️ Recipe name not found inside the card:", card);
            }
        });
    });
});


// ✅ Display Recipe from Firestore
async function displayRecipe() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not logged in.");
            return;
        }

        console.log("✅ Logged-in User ID:", user.uid);

        const recipesRef = collection(db, "recipes");
        const q = query(
            recipesRef,
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        let querySnapshot;
        let retries = 3;

        while (retries > 0) {
            querySnapshot = await getDocs(q);
            console.log("🔍 Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

            if (!querySnapshot.empty) break;

            console.warn(`⏳ Firestore delay... Retrying (${4 - retries}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
        }

        if (querySnapshot.empty) {
            console.warn("⚠️ No recipes found.");
            document.getElementById("recipe-title").textContent = "No recipes found.";
            return;
        }

        const latestDoc = querySnapshot.docs[0].data();
        console.log("✅ Latest Recipe Document:", latestDoc);

        // ✅ Fetching the correct field (content) instead of recipe
        const latestRecipe = latestDoc.content || latestDoc.recipe;

        if (!latestRecipe) {
            console.error("❌ Recipe field is missing in Firestore document!");
            document.getElementById("recipe-title").textContent = "No valid recipe found.";
            return;
        }

        // ✅ Update UI Elements
        document.getElementById("recipe-title").textContent = extractTitle(latestRecipe);
        document.getElementById("recipe-desc").textContent = "A delicious AI-generated recipe! 😋";
        console.log("✅ Extracting Ingredients...");
        document.getElementById("ingredients-list").innerHTML = extractSection(latestRecipe, "Ingredients");

        console.log("✅ Extracting Instructions...");
        document.getElementById("instructions-list").innerHTML = extractSection(latestRecipe, "Instructions");

        console.log("✅ Extracting Nutrition...");
        document.getElementById("nutrition-list").innerHTML = extractSection(latestRecipe, "Nutritional Information");

    } catch (error) {
        console.error("❌ Error displaying recipe:", error);
    }
}


// ✅ Extract Title (Keep emojis)
function extractTitle(text) {
    if (!text) return "AI-Generated Recipe";
    const match = text.match(/^##\s*(.+)/);
    return match ? cleanText(match[1].trim()) : "AI-Generated Recipe";
}

// ✅ Extract Ingredients, Instructions & Nutrition
function extractSection(text, section) {
    if (!text) return `<li>⚠️ No data available.</li>`;

    console.log(`🔎 Searching for section: ${section} in text...`);

    // Improved regex to handle flexible section formatting
    const regex = new RegExp(
        `\\*{0,2}\\s*${section}\\s*:?\\s*\\*{0,2}\\s*([\\s\\S]*?)(?=\\n\\s*\\*{0,2}[A-Z]|$)`,
        "i"
    );
    const match = text.match(regex);

    if (!match) {
        console.warn(`⚠️ Section '${section}' not found in text.`);
        return `<li>⚠️ No data available.</li>`;
    }

    console.log(`✅ Found Section: ${section}`, match[1]);

    return match[1]
        .trim()
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => `<li>${cleanText(line.trim())}</li>`)
        .join("");
}

// ✅ Improved Text Cleaner with Bullet Point Handling
function cleanText(text) {
    let cleanedLine = text
        .replace(/\*\*/g, "") // Remove **bold**
        .replace(/^[-*•]\s*(?=\w)/g, "• ") // Keep bullet points
        .trim();

    // 🍽️ Add Meaningful Cooking Emojis
    cleanedLine = cleanedLine
        .replace(/\bPreheat\b/g, '🔥 Preheat')
        .replace(/\bMix\b/g, '🥣 Mix')
        .replace(/\bStir\b/g, '🌀 Stir')
        .replace(/\bBake\b/g, '🔥 Bake')
        .replace(/\bServe\b/g, '🍽️ Serve')
        .replace(/\bCool\b/g, '❄️ Cool')
        .replace(/\bWhisk\b/g, '🥄 Whisk')
        .replace(/\bCream\b/g, '🧈 Cream')
        .replace(/\bFold\b/g, '🎭 Fold')
        .replace(/\bGrease\b/g, '🛢️ Grease')
        .replace(/\bBeat\b/g, '🥊 Beat')
        .replace(/\bSprinkle\b/g, '✨ Sprinkle');

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
window.displayRecipe = displayRecipe;

// ✅ Ensure fetchRecipe is available after DOM loads
document.addEventListener("DOMContentLoaded", function () {
    window.fetchRecipe = fetchRecipe;
});
// ✅ Make function globally accessible
window.fetchRecipe = fetchRecipe;

