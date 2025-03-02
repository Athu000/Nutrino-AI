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
        document.getElementById("recipe-title").textContent = "Error: Recipe Not Found";
        return;
    }

    try {
        recipeData = JSON.parse(decodeURIComponent(recipeData));

        // ✅ Extract relevant details
        const recipeTitle = recipeData.candidates[0]?.content?.parts[0]?.text || "Generated Recipe";
        const recipeDescription = "Delicious AI-generated recipe based on your input.";
        const calories = "Unknown"; // API response does not include calories
        const ingredients = extractSection(recipeData, "Ingredients");
        const instructions = extractSection(recipeData, "Instructions");

        // ✅ Populate HTML elements
        document.getElementById("recipe-title").textContent = recipeTitle.split("\n")[0].replace("## ", "");
        document.getElementById("recipe-desc").textContent = recipeDescription;
        document.getElementById("recipe-calories").textContent = calories;
        document.getElementById("ingredients-list").innerHTML = ingredients;
        document.getElementById("instructions-list").innerHTML = instructions;

    } catch (error) {
        console.error("❌ Error parsing recipe data:", error);
        document.getElementById("recipe-title").textContent = "Error: Invalid Recipe Data";
    }
}

// ✅ Improved function to extract Ingredients or Instructions
function extractSection(data, sectionTitle) {
    const text = data.candidates[0]?.content?.parts[0]?.text || "";

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

    document.getElementById("goBackBtn").addEventListener("click", () => {
        window.location.href = "index.html";
    });

    document.getElementById("generateAnotherBtn").addEventListener("click", () => {
        window.location.href = "recipe_generator.html";
    });
});

// ✅ Load Firebase dynamically
loadFirebase();
