const API_URL = "https://nutrino-ai.onrender.com/api/fetch-recipe";

async function fetchRecipe(prompt) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(`Error: ${data.error || "Unable to generate recipe"}`);
            return null;
        }

        return data;
    } catch (error) {
        console.error("Error fetching recipe:", error);
        alert("Failed to fetch recipe.");
        return null;
    }
}

document.getElementById("generateRecipe").addEventListener("click", async () => {
    const query = document.getElementById("rec_search").value.trim();
    if (!query) {
        alert("Enter a recipe name!");
        return;
    }

    document.getElementById("generateRecipe").innerText = "Loading...";
    const recipeData = await fetchRecipe(query);

    if (recipeData) {
        window.location.href = `generated_recipe.html?data=${encodeURIComponent(JSON.stringify(recipeData))}`;
    } else {
        document.getElementById("generateRecipe").innerText = "Create";
    }
});
