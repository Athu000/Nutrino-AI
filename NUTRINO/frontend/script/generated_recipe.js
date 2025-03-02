// ✅ Load Firebase dynamically to fix module errors
async function loadFirebase() {
    try {
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        console.log("✅ Firebase Authentication Loaded in Recipe Generator");
    } catch (error) {
        console.error("❌ Firebase Load Error:", error);
    }
}

// ✅ Function to parse and display the recipe
function displayRecipe() {
    const urlParams = new URLSearchParams(window.location.search);
    let recipeData = urlParams.get("data");

    if (!recipeData) {
        console.error("❌ No recipe data found in URL.");
        alert("Error: No recipe data found. Please generate a recipe first.");
        window.location.href = "index.html"; // Redirect to home page
        return;
    }

    try {
        recipeData = JSON.parse(decodeURIComponent(recipeData));
        console.log("✅ Received Recipe Data:", recipeData);

        // ✅ Extract Recipe Details
        const recipeTitle = recipeData.candidates?.[0]?.content?.parts?.[0]?.text || "Generated Recipe";
        console.log("✅ Extracted Recipe Title:", recipeTitle);

        const recipeDescription = "Delicious AI-generated recipe based on your input.";
        const calories = "Unknown"; // API response does not include calories
        const ingredients = extractSection(recipeData, "Ingredients");
        const instructions = extractSection(recipeData, "Instructions");

        // ✅ Update HTML elements (Check if elements exist before modifying)
        const titleElement = document.getElementById("recipe-title");
        if (titleElement) titleElement.textContent = recipeTitle.split("\n")[0].replace("## ", "");

        const descElement = document.getElementById("recipe-desc");
        if (descElement) descElement.textContent = recipeDescription;

        const caloriesElement = document.getElementById("recipe-calories");
        if (caloriesElement) caloriesElement.textContent = calories;

        const ingredientsList = document.getElementById("ingredients-list");
        if (ingredientsList) ingredientsList.innerHTML = ingredients;

        const instructionsList = document.getElementById("instructions-list");
        if (instructionsList) instructionsList.innerHTML = instructions;

    } catch (error) {
        console.error("❌ Error parsing recipe data:", error);
        alert("Invalid Recipe Data. Redirecting...");
        window.location.href = "index.html";
    }
}

// ✅ Improved function to extract Ingredients or Instructions
function extractSection(data, sectionTitle) {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // ✅ Regex to capture everything between sections
    const sectionRegex = new RegExp(`\\*\\*${sectionTitle}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*|$)`, "i");
    const match = text.match(sectionRegex);

    if (match && match[1]) {
        return match[1]
            .trim()
            .split("\n")
            .filter(line => line.trim() !== "")
            .map(line => `<li>${line.replace(/^(\*|\d+\.)\s*/, "").trim()}</li>`)
            .join("") || "<li>No data available.</li>";
    }
    return "<li>No data available.</li>";
}

// ✅ Handle navigation buttons
document.addEventListener("DOMContentLoaded", function () {
    displayRecipe(); // Load and display recipe

    const goBackBtn = document.getElementById("goBackBtn");
    if (goBackBtn) {
        goBackBtn.addEventListener("click", () => {
            window.location.href = "index.html";
        });
    }

    const generateAnotherBtn = document.getElementById("generateAnotherBtn");
    if (generateAnotherBtn) {
        generateAnotherBtn.addEventListener("click", () => {
            window.location.href = "recipe_generator.html";
        });
    }
});

// ✅ Load Firebase dynamically
loadFirebase();
