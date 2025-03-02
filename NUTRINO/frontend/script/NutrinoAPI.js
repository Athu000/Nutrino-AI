const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Load Firebase dynamically
async function loadFirebase() {
    try {
        await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        console.log("✅ Firebase Auth Loaded");
    } catch (error) {
        console.error("❌ Firebase Load Error:", error);
    }
}

// ✅ Get or Refresh Firebase Auth Token
async function getAuthToken() {
    try {
        if (!firebase?.auth) {
            await loadFirebase(); // Ensure Firebase is loaded
        }
        const user = firebase.auth().currentUser;
        if (user) {
            const token = await user.getIdToken(true);
            localStorage.setItem("authToken", token);
            return token;
        }
    } catch (error) {
        console.error("❌ Auth Token Error:", error);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
    }
    return null;
}

// ✅ Fetch Recipe with Authentication
export async function fetchRecipe(prompt) {
    let authToken = localStorage.getItem("authToken") || await getAuthToken();
    if (!authToken) return null;

    try {
        const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (response.status === 403 && data.error?.includes("Invalid token")) {
            authToken = await getAuthToken();
            if (!authToken) return null;
            return fetchRecipe(prompt);
        }
        return response.ok ? data : null;
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
    return null;
}

// ✅ Display Recipe from sessionStorage
function displayRecipe() {
    const recipeDataStr = sessionStorage.getItem("recipeData");

    console.log("📌 Recipe Data in Storage:", recipeDataStr);

    if (!recipeDataStr) {
        sessionStorage.removeItem("recipeData"); // Clear bad session data
        window.location.href = "index.html";
        return;
    }

    let recipeData;
    try {
        recipeData = JSON.parse(recipeDataStr);
    } catch (error) {
        console.error("❌ Error parsing recipeData:", error);
        sessionStorage.removeItem("recipeData"); // Prevent loop
        window.location.href = "index.html";
        return;
    }

    const text = recipeData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
        sessionStorage.removeItem("recipeData"); // Prevent looping
        window.location.href = "index.html";
        return;
    }

    // ✅ Select elements safely
    const recipeTitleElement = document.getElementById("recipe-title");
    const recipeDescElement = document.getElementById("recipe-desc");
    const recipeCaloriesElement = document.getElementById("recipe-calories");
    const ingredientsListElement = document.getElementById("ingredients-list");
    const instructionsListElement = document.getElementById("instructions-list");

    // ✅ Check if elements exist before updating
    if (recipeTitleElement) recipeTitleElement.textContent = text.split("\n")[0].replace("## ", "");
    if (recipeDescElement) recipeDescElement.textContent = "Delicious AI-generated recipe based on your input.";
    if (recipeCaloriesElement) recipeCaloriesElement.textContent = "Unknown";
    if (ingredientsListElement) ingredientsListElement.innerHTML = extractSection(text, "Ingredients");
    if (instructionsListElement) instructionsListElement.innerHTML = extractSection(text, "Instructions");
}

// ✅ Extract Ingredients or Instructions
function extractSection(text, section) {
    const match = text.match(new RegExp(`\n?\*\*${section}:\*\*([\s\S]*?)(?=\n\*\*|$)`, "i"));
    return match ? match[1].trim().split("\n").map(line => `<li>${line.replace(/^([*-]|\d+\.)\s*/, "").trim()}</li>`).join("") : "<li>No data available.</li>";
}

// ✅ Handle navigation buttons & initial load
window.addEventListener("DOMContentLoaded", async () => {
    await loadFirebase(); // Ensure Firebase is loaded
    displayRecipe();
    document.getElementById("goBackBtn")?.addEventListener("click", () => window.location.href = "index.html");
    document.getElementById("generateAnotherBtn")?.addEventListener("click", () => window.location.href = "recipe_generator.html");
});
