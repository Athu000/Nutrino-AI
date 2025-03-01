// Use "let" only if API_URL is not already defined
if (typeof API_URL === "undefined") {
    var API_URL = "https://nutrino-ai.onrender.com/api/fetch-recipe"; // API URL
}

async function fetchRecipe(prompt) {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
        displayError("Authentication failed. Please log in again.");
        window.location.href = "login.html";
        return null;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data?.error || "Unable to generate recipe");
        }

        return data;
    } catch (error) {
        console.error("Error fetching recipe:", error);
        displayError(error.message);
        return null;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const generateButton = document.getElementById("generateRecipe");
    const searchInput = document.getElementById("rec_search");

    if (generateButton && searchInput) {
        generateButton.addEventListener("click", async () => {
            const query = searchInput.value.trim();
            if (!query) {
                displayError("Enter a recipe name!");
                return;
            }

            generateButton.innerText = "Loading...";
            generateButton.disabled = true;

            const recipeData = await fetchRecipe(query);

            if (recipeData) {
                window.location.href = `generated_recipe.html?data=${encodeURIComponent(JSON.stringify(recipeData))}`;
            } else {
                generateButton.innerText = "Create";
                generateButton.disabled = false;
            }
        });
    } else {
        console.warn("Generate Recipe button or search input not found.");
    }

    // Add click event for predefined recipe links
    document.querySelectorAll(".Group-root1").forEach(item => {
        item.addEventListener("click", function () {
            const recipeName = this.querySelector(".Text-root1")?.textContent;
            if (recipeName) {
                window.location.href = `generated_recipe.html?recipe=${encodeURIComponent(recipeName)}`;
            } else {
                console.error("Recipe name not found in element.");
            }
        });
    });
});

// Function to Display Error Messages in UI
function displayError(message) {
    const errorContainer = document.getElementById("error-message");
    if (errorContainer) {
        errorContainer.innerText = message;
        errorContainer.style.display = "block";
    } else {
        console.error("Error container not found.");
    }
}
