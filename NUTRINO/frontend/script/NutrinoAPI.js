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
    let authToken = localStorage.getItem("authToken");

    if (!authToken) {
        authToken = await getAuthToken();
        if (!authToken) return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (response.status === 403 && data.error?.includes("Invalid token")) {
            authToken = await getAuthToken();
            if (!authToken) return null;
            return fetchRecipe(prompt);
        }

        if (response.ok) {
            sessionStorage.setItem("recipeData", JSON.stringify(data));
            window.location.href = "generated_recipe.html";
        } else {
            alert("Failed to fetch recipe. Try again.");
        }

        return data;
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
    return null;
}

// ✅ Display Recipe from sessionStorage
function displayRecipe() {
    const recipeDataStr = sessionStorage.getItem("recipeData");

    if (!recipeDataStr) {
        console.error("No recipe data found.");
        document.getElementById("recipe-title").textContent = "Error: No Recipe Found.";
        return;
    }

    let recipeData;
    try {
        recipeData = JSON.parse(recipeDataStr);
    } catch (error) {
        console.error("Error parsing recipeData:", error);
        sessionStorage.removeItem("recipeData");
        return;
    }

    if (!recipeData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        sessionStorage.removeItem("recipeData");
        return;
    }

    const text = recipeData.candidates[0].content.parts[0].text;

    document.getElementById("recipe-title").textContent = extractTitle(text);
    document.getElementById("recipe-desc").textContent = "A delicious AI-generated recipe!";
    document.getElementById("recipe-calories").textContent = "Unknown";
    document.getElementById("ingredients-list").innerHTML = extractSection(text, "Ingredients");
    document.getElementById("instructions-list").innerHTML = extractSection(text, "Instructions");
}

// ✅ Extract Title
function extractTitle(text) {
    return text.split("\n")[0].replace("## ", "").trim() || "AI-Generated Recipe";
}

// ✅ Extract Ingredients or Instructions
function extractSection(text, section) {
    const match = text.match(new RegExp(`\\*\\*${section}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i"));
    return match
        ? match[1].trim().split("\n").map(line => `<li>${line.replace(/^([*-]|\d+\.)\s*/, "").trim()}</li>`).join("")
        : "<li>No data available.</li>";
}

// ✅ Handle navigation buttons
window.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("generated_recipe.html")) {
        displayRecipe();
    }
    document.getElementById("goBackBtn")?.addEventListener("click", () => window.location.href = "index.html");
    document.getElementById("generateAnotherBtn")?.addEventListener("click", () => window.location.href = "recipe_generator.html");
    loadFirebase();
});

// ✅ Make function globally accessible
window.fetchRecipe = fetchRecipe;
