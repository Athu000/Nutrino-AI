const API_URL = "https://nutrino-ai.onrender.com/api/fetch-recipe";  // Updated API URL for deployment

async function fetchRecipe(prompt) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (!response.ok) {
            displayError(`Error: ${data.error || "Unable to generate recipe"}`);
            return null;
        }

        return data;
    } catch (error) {
        console.error("Error fetching recipe:", error);
        displayError("Failed to fetch recipe. Please try again.");
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

    // Add recipe search links
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
    alert(message);  // Replace this with a UI error display if needed
}
