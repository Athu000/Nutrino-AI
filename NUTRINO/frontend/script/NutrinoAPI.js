const API_URL = "https://nutrino-ai.onrender.com/api/fetch-recipe"; // API URL

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
