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
async function fetchRecipe(prompt) {
    let authToken = localStorage.getItem("authToken") || await getAuthToken();
    if (!authToken) return null;

    try {
        const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (response.status === 403 && data.error.includes("Invalid token")) {
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
    const recipeData = JSON.parse(sessionStorage.getItem("recipeData"));
    if (!recipeData) {
        alert("No recipe data found. Redirecting...");
        return (window.location.href = "index.html");
    }

    const text = recipeData.candidates?.[0]?.content?.parts?.[0]?.text || "Generated Recipe";
    document.getElementById("recipe-title")?.textContent = text.split("\n")[0].replace("## ", "");
    document.getElementById("recipe-desc")?.textContent = "Delicious AI-generated recipe based on your input.";
    document.getElementById("recipe-calories")?.textContent = "Unknown";
    document.getElementById("ingredients-list")?.innerHTML = extractSection(text, "Ingredients");
    document.getElementById("instructions-list")?.innerHTML = extractSection(text, "Instructions");
}

// ✅ Extract Ingredients or Instructions
function extractSection(text, section) {
    const match = text.match(new RegExp(`\*\*${section}:\*\*([\s\S]*?)(?=\n\*\*|$)`, "i"));
    return match ? match[1].trim().split("\n").map(line => `<li>${line.replace(/^([*-]|\d+\.)\s*/, "").trim()}</li>`).join("") : "<li>No data available.</li>";
}

// ✅ Handle navigation buttons
window.addEventListener("DOMContentLoaded", () => {
    displayRecipe();
    document.getElementById("goBackBtn")?.addEventListener("click", () => window.location.href = "index.html");
    document.getElementById("generateAnotherBtn")?.addEventListener("click", () => window.location.href = "recipe_generator.html");
    loadFirebase();
});
