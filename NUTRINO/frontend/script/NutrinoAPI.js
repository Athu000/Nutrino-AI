// ✅ Import Firebase Auth & Firestore from auth.js
import { auth, db } from "./auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Get or Refresh Firebase Auth Token
async function getAuthToken() {
    try {
        const user = auth.currentUser;  // ✅ Use 'auth.currentUser' instead of 'firebase.auth().currentUser'
        if (user) {
            const token = await user.getIdToken(true);
            localStorage.setItem("authToken", token);
            return token;
        }
    } catch (error) {
        console.error("❌ Auth Token Error:", error);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
    }
    return null;
}

// ✅ Fetch Recipe & Save to Firestore
async function fetchRecipe(prompt) {
    let authToken = localStorage.getItem("authToken");

    if (!authToken) {
        authToken = await getAuthToken();
        if (!authToken) return null;
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

        if (response.status === 403 && data.error?.includes("Invalid token")) {
            authToken = await getAuthToken();
            if (!authToken) return null;
            return fetchRecipe(prompt);
        }

        if (response.ok) {
            sessionStorage.setItem("recipeData", JSON.stringify(data));

            // ✅ Save Recipe to Firestore
            const user = auth.currentUser;
            if (user) {
                await addDoc(collection(db, "recipes"), {
                    userId: user.uid,
                    recipe: data,
                    createdAt: new Date()
                });
                console.log("✅ Recipe saved to Firestore");
            }

            window.location.href = "generated_recipe.html";
        } else {
            alert("Failed to fetch recipe. Try again.");
        }

        return data;
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
    return null;
}

// ✅ Make function globally accessible
window.fetchRecipe = fetchRecipe;
