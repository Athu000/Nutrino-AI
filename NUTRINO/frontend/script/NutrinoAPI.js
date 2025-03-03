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
        return;
    }

    try {
        const recipeData = JSON.parse(recipeDataStr);
        const text = recipeData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("Recipe text missing.");
            return;
        }

        document.getElementById("recipe-title").textContent = extractTitle(text);
        document.getElementById("recipe-desc").textContent = "A delicious AI-generated recipe!";
        document.getElementById("recipe-calories").textContent = extractCalories(text);
        document.getElementById("ingredients-list").innerHTML = extractSection(text, "Ingredients");
        document.getElementById("instructions-list").innerHTML = extractSection(text, "Instructions");
    } catch (error) {
        console.error("Error parsing recipeData:", error);
    }
}

window.addEventListener("DOMContentLoaded", displayRecipe);

// ✅ Extract Calories Properly
function extractCalories(text) {
    const match = text.match(/Estimated Calories per Serving:\s*([\d-]+)/i);
    return match ? `${match[1]} kcal` : "N/A";
}

// ✅ Extract Title
function extractTitle(text) {
    const match = text.match(/^##\s*(.+)/);
    return match ? match[1].trim() : "AI-Generated Recipe";
}

// ✅ Extract Ingredients or Instructions Properly
function extractSection(text, section) {
    const regex = new RegExp(`\*\*${section}:\*\*([\s\S]*?)(?=\n\*\*|$)`, "i");
    const match = text.match(regex);

    if (match) {
        return match[1]
            .trim()
            .split("\n")
            .filter(line => line.trim() !== "")
            .map(line => `<li>${line.replace(/^(\*|-|\d+\.)\s*/, "").trim()}</li>`)
            .join("");
    } else {
        return "<li>No data available.</li>";
    }
}

// ✅ Extract Additional Metadata (Cuisine, Prep Time, Servings, etc.)
function extractMeta(text) {
    const metaRegex = /\*\*Cuisine:\*\* (.+?)\n\*\*Prep Time:\*\* (.+?) \| \*\*Cook Time:\*\* (.+?) \| \*\*Total Time:\*\* (.+?)\n\*\*Servings:\*\* (.+?) \| \*\*Calories:\*\* (.+?)\n/;
    const match = text.match(metaRegex);

    if (match) {
        return `
            <p><strong>Cuisine:</strong> ${match[1]}</p>
            <p><strong>Prep Time:</strong> ${match[2]}</p>
            <p><strong>Cook Time:</strong> ${match[3]}</p>
            <p><strong>Total Time:</strong> ${match[4]}</p>
            <p><strong>Servings:</strong> ${match[5]}</p>
            <p><strong>Calories:</strong> ${match[6]}</p>
        `;
    }
    return "<p>No metadata available.</p>";
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
