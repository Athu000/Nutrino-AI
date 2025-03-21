import { auth, db } from "./auth.js";
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ DELETE OLD MEAL PLAN (Optional, but keeping it)
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
    const user = auth.currentUser;
    if (!user) {
        console.error("❌ User not authenticated.");
        return;
    }

    try {
        console.log("📥 Fetching latest meal plan...");
        
        const mealQuery = query(
            collection(db, "meals"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        const snapshot = await getDocs(mealQuery);
        if (snapshot.empty) {
            console.warn("⚠️ No meal plan found.");
            return;
        }

        const mealPlanData = snapshot.docs[0].data();
        console.log("✅ Meal Plan Retrieved:", mealPlanData);

        displayMealPlan(mealPlanData);

        // Redirect to meals.html
        window.location.href = "meals.html";
    } catch (error) {
        console.error("❌ Error fetching meal plan:", error);
    }
}
// ✅ DISPLAY MEAL PLAN FROM FIRESTORE
async function displayMealPlan() {
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

    document.getElementById("mealPlanContainer").innerHTML = `
        <div class="meal-plan-card">
            <h2>🍽️ Your AI-Generated Meal Plan</h2>
            <p><strong>Ingredients:</strong> ${mealPlanData.ingredients || "Not provided"}</p>
            <p><strong>Meals Per Day:</strong> ${mealPlanData.mealsPerDay}</p>
            <p><strong>Servings:</strong> ${mealPlanData.servings}</p>
            <p><strong>Dietary Restrictions:</strong> ${mealPlanData.dietaryRestrictions?.join(", ") || "None"}</p>
            <pre>${mealPlanData.mealPlan || "No meal plan generated."}</pre>
        </div>
    `;
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
        
        await addDoc(collection(db, "meals"), {
            userId: user.uid,
            ingredients: preferences.ingredients,
            mealsPerDay: preferences.mealsPerDay,
            servings: preferences.servings,
            dietaryRestrictions: preferences.dietaryRestrictions || [],
            mealPlan: newMealPlan.mealPlan, // ✅ Directly save API response
            createdAt: serverTimestamp()
        });

        console.log("✅ Meal plan saved successfully.");

        // ✅ Fetch and display latest meal plan
        fetchMealPlan();

    } catch (error) {
        console.error("❌ Error fetching new meal plan:", error);
    }
}


// ✅ FORM HANDLER FUNCTION
function handleMealPlan() {
    fetchNewMealPlan();
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
