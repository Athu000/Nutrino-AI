import { auth, db } from "./auth.js";
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit, serverTimestamp, 
    doc, getDoc // ✅ Fix: Import missing Firestore functions
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("✅ User Logged In:", user.email);
        fetchMealPlan(user.uid); // 🔹 Fetch meal plan only if user is logged in
    } else {
        console.error("❌ User not authenticated.");
        alert("Please log in first.");
        window.location.href = "login.html"; // 🔹 Redirect to login page
    }
});

// ✅ DELETE OLD MEAL PLAN
async function deleteOldMealPlan() {
    const authToken = await getAuthToken();
    if (!authToken) {
        console.error("❌ Failed to retrieve auth token.");
        return;
    }

    try {
        console.log("🗑️ Deleting old meal plan...");
        const response = await fetch(`${API_BASE_URL}/delete-meal-plan`, {  
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error(`Delete Error: ${response.status} ${response.statusText}`);

        console.log("✅ Old meal plan deleted successfully.");
    } catch (error) {
        console.error("❌ Error deleting meal plan:", error);
    }
}

// ✅ FETCH LATEST MEAL PLAN FROM FIRESTORE
async function fetchMealPlan() {
    console.log("🔎 Checking Local Storage...");
    
    let mealPlanData = localStorage.getItem("latestMealPlan");

    if (!mealPlanData) {
        console.warn("⚠️ No meal plan found in localStorage. Fetching from Firestore...");
        
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not authenticated.");
            return;
        }

        const mealPlanId = localStorage.getItem("mealPlanId");
        if (!mealPlanId) {
            console.error("❌ Meal Plan ID not found in localStorage.");
            return;
        }

        // Fetch data from Firestore
        try {
            const mealPlanRef = doc(db, "meals", mealPlanId);
            const mealPlanSnap = await getDoc(mealPlanRef);
            
            if (!mealPlanSnap.exists()) {
                console.warn("⚠️ Meal Plan does not exist in Firestore.");
                return;
            }

            mealPlanData = mealPlanSnap.data();
            localStorage.setItem("latestMealPlan", JSON.stringify(mealPlanData));

        } catch (error) {
            console.error("❌ Error fetching meal plan:", error);
            return;
        }
    } else {
        mealPlanData = JSON.parse(mealPlanData);
    }

    console.log("✅ Meal Plan Retrieved:", mealPlanData);

    const mealPlanContainer = document.getElementById("mealPlanContainer");
    if (mealPlanContainer) {
        mealPlanContainer.innerHTML = `
            <div class="meal-plan-card">
                <h2>🍽️ Your AI-Generated Meal Plan</h2>
                <p><strong>Ingredients:</strong> ${mealPlanData.ingredients || "Not provided"}</p>
                <p><strong>Meals Per Day:</strong> ${mealPlanData.mealsPerDay}</p>
                <p><strong>Servings:</strong> ${mealPlanData.servings}</p>
                <p><strong>Dietary Restrictions:</strong> ${mealPlanData.dietaryRestrictions?.join(", ") || "None"}</p>
                <pre>${mealPlanData.mealPlan || "No meal plan generated."}</pre>
            </div>
        `;
    } else {
        console.error("❌ mealPlanContainer element not found.");
    }
}

// ✅ CLEAR PREVIOUS MEAL PLAN
function clearPreviousMealPlan() {
    localStorage.removeItem("latestMealPlan");
    console.log("🗑️ Cleared previous meal plan.");
}

// ✅ FETCH FORM DATA FROM meal_planner.html
function getMealPreferences() {
    const ingredients = document.getElementById("ingredients")?.value.trim() || "";
    const mealsPerDay = parseInt(document.getElementById("meals")?.value) || 3;
    const servings = parseInt(document.getElementById("servings")?.value) || 1;
    const dietaryRestrictions = [...document.querySelectorAll("input[name='dietary']:checked")].map(input => input.value);

    return { ingredients, mealsPerDay, servings, dietaryRestrictions };
}

// ✅ REQUEST NEW MEAL PLAN FROM API
async function fetchNewMealPlan() {
    clearPreviousMealPlan(); // Clears old meal plan from local storage

    const preferences = getMealPreferences();
    if (!preferences.ingredients || !preferences.mealsPerDay || !preferences.servings) {
        alert("Please fill all required fields.");
        console.error("❌ Missing required fields.");
        return;
    }

    console.log("📤 Sending meal plan request:", preferences);

    try {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error("❌ Authentication token missing.");

        const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(preferences)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

        const newMealPlan = await response.json();
        console.log("✅ API Response:", newMealPlan);

        // ✅ Save directly to Firestore
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not authenticated.");
            return;
        }

        console.log("📤 Saving new meal plan to Firestore...");
        
        const docRef = await addDoc(collection(db, "meals"), {
            userId: user.uid,
            ingredients: preferences.ingredients,
            mealsPerDay: preferences.mealsPerDay,
            servings: preferences.servings,
            dietaryRestrictions: preferences.dietaryRestrictions || [],
            mealPlan: newMealPlan.mealPlan, // ✅ Directly save API response
            createdAt: serverTimestamp()
        });

        localStorage.setItem("mealPlanId", docRef.id); // ✅ Store mealPlan ID
        console.log("✅ Meal plan saved successfully.");

        // ✅ Redirect **AFTER** meal is stored
        window.location.href = "meals.html";

    } catch (error) {
        console.error("❌ Error fetching new meal plan:", error);
    }
}

// ✅ EVENT LISTENERS
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded");

    const form = document.getElementById("meal-planner-form");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetchNewMealPlan();
        });
    }

    // Call display function only in meals.html
    if (window.location.pathname.includes("meals.html")) {
        displayMealPlan();
    }
});

// ✅ Make sure function is globally available
window.displayMealPlan = displayMealPlan;
