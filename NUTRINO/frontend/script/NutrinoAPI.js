const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Function to get a fresh Firebase authentication token
async function getFreshAuthToken() {
    try {
        const user = firebase.auth().currentUser;
        if (user) {
            const newToken = await user.getIdToken(true); // Force refresh
            localStorage.setItem("authToken", newToken);
            console.log("✅ Token refreshed successfully");
            return newToken;
        } else {
            throw new Error("User not logged in");
        }
    } catch (error) {
        console.error("❌ Token Refresh Error:", error);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return null;
    }
}

// ✅ Fetch Recipe with refreshed token
export async function fetchRecipe(prompt) {
    let authToken = localStorage.getItem("authToken");

    if (!authToken) {
        authToken = await getFreshAuthToken(); // Refresh token if missing
        if (!authToken) return null; // Stop if token refresh failed
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
        console.log("✅ API Response:", data);

        if (response.status === 403 && data.error.includes("Invalid token")) {
            console.warn("🔄 Token expired. Refreshing...");
            authToken = await getFreshAuthToken(); // Try refreshing token
            if (!authToken) return null; // Stop if token refresh failed

            // Retry request with new token
            return fetchRecipe(prompt);
        }

        if (!response.ok) throw new Error(data.error || "Recipe fetch failed");
        return data;
    } catch (error) {
        console.error("❌ API Error:", error.message);
        alert("Error fetching recipe. Try again.");
        return null;
    }
}
