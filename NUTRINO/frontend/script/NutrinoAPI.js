const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Fetch Recipe Function
export async function fetchRecipe(prompt) {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
        alert("Authentication required. Please log in.");
        window.location.href = "login.html";
        return null;
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
        console.log("✅ API Response:", data); // Debugging

        if (!response.ok) throw new Error(data.error || "Recipe fetch failed");

        return data;
    } catch (error) {
        console.error("❌ API Error:", error.message);
        alert("Error fetching recipe. Try again.");
        return null;
    }
}

// ✅ Generate Recipe and Store it in sessionStorage
export async function generateRecipe() {
    const userPrompt = document.getElementById("recipe-input").value;
    if (!userPrompt.trim()) {
        alert("Please enter a recipe idea.");
        return;
    }

    const recipeData = await fetchRecipe(userPrompt);

    if (!recipeData) {
        alert("Error: Could not generate recipe.");
        return;
    }

    console.log("✅ Storing Recipe Data:", recipeData);

    // ✅ Store in sessionStorage instead of passing via URL
    sessionStorage.setItem("recipeData", JSON.stringify(recipeData));

    // ✅ Redirect to recipe display page
    window.location.href = "generated_recipe.html";
}
