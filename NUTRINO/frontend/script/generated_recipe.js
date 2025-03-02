import { getAuth } from "firebase/auth";
import { fetchAuthToken } from "./auth.js"; // Ensure this function is in auth.js

document.addEventListener("DOMContentLoaded", () => {
    const generateButton = document.getElementById("generate-recipe-btn");
    const recipeOutput = document.getElementById("recipe-output");

    if (generateButton) {
        generateButton.addEventListener("click", async () => {
            try {
                const auth = getAuth();
                const user = auth.currentUser;

                if (!user) {
                    alert("You must be logged in to generate recipes!");
                    window.location.href = "login.html";
                    return;
                }

                const authToken = await fetchAuthToken();
                if (!authToken) {
                    alert("Authentication failed. Please log in again.");
                    window.location.href = "login.html";
                    return;
                }

                const promptInput = document.getElementById("recipe-input");
                const prompt = promptInput.value.trim();

                if (!prompt) {
                    alert("Please enter a recipe prompt!");
                    promptInput.focus();
                    return;
                }

                // ✅ UI Update - Show Loading
                generateButton.textContent = "Generating...";
                generateButton.disabled = true;
                recipeOutput.innerHTML = "<p>Generating recipe...</p>";

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

                // ✅ Improved Recipe Display
                recipeOutput.innerHTML = `
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
                recipeOutput.innerHTML = `<p style="color: red;">Failed to generate recipe. Please try again.</p>`;
                alert("Failed to generate recipe. Try again later.");
            } finally {
                // ✅ UI Update - Restore Button
                generateButton.textContent = "Generate Recipe";
                generateButton.disabled = false;
            }
        });
    }
});
