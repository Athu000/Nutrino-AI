// ✅ Load Firebase dynamically to fix module errors
async function loadFirebase() {
    try {
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        console.log("✅ Firebase Authentication Loaded in Recipe Generator");
    } catch (error) {
        console.error("❌ Firebase Load Error:", error);
    }
}

// ✅ Function to validate user authentication
function checkAuthToken() {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
        alert("You must be logged in to generate recipes!");
        window.location.href = "login.html";
        return null;
    }
    return authToken;
}

// ✅ Function to update UI during recipe generation
function updateUI(state, message = "") {
    const generateButton = document.getElementById("generate-recipe-btn");
    const recipeOutput = document.getElementById("recipe-output");

    if (state === "loading") {
        generateButton.textContent = "Generating...";
        generateButton.disabled = true;
        recipeOutput.innerHTML = "<p>Generating recipe...</p>";
    } else if (state === "error") {
        recipeOutput.innerHTML = `<p style="color: red;">${message}</p>`;
        alert(message);
    } else if (state === "reset") {
        generateButton.textContent = "Generate Recipe";
        generateButton.disabled = false;
    }
}

// ✅ Function to fetch and display the recipe
async function fetchRecipe() {
    try {
        const authToken = checkAuthToken();
        if (!authToken) return;

        const promptInput = document.getElementById("recipe-input");
        const prompt = promptInput?.value.trim();
        if (!prompt) {
            alert("Please enter a recipe prompt!");
            promptInput.focus();
            return;
        }

        updateUI("loading");

        const response = await fetch("https://nutrino-ai.onrender.com/api/fetch-recipe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to fetch recipe");

        // ✅ Display the fetched recipe
        document.getElementById("recipe-output").innerHTML = `
            <h2>${data.title || "Generated Recipe"}</h2>
            <img src="${data.image || 'default-image.jpg'}" alt="Recipe Image" style="max-width: 100%; height: auto;">
            <p><strong>Description:</strong> ${data.description || "No description available."}</p>
            <h3>Calories: ${data.calories || "Unknown"} kcal</h3>
            <h3>Ingredients:</h3>
            <ul>${data.ingredients ? data.ingredients.map(ing => `<li>${ing}</li>`).join('') : "<li>No ingredients listed.</li>"}</ul>
            <h3>Instructions:</h3>
            <ul>${data.instructions ? data.instructions.map(step => `<li>${step}</li>`).join('') : "<li>No instructions provided.</li>"}</ul>
        `;

    } catch (error) {
        console.error("❌ Error fetching recipe:", error.message);
        updateUI("error", "Failed to generate recipe. Please try again.");
    } finally {
        updateUI("reset");
    }
}

// ✅ Attach event listeners once DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    const generateButton = document.getElementById("generate-recipe-btn");
    if (generateButton) {
        generateButton.addEventListener("click", fetchRecipe);
    }
});

// ✅ Load Firebase dynamically
loadFirebase();
