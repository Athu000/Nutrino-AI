import { auth, db } from "./auth.js";
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

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
        console.log("✅ Meal Plan:", mealPlanData);
        displayMealPlan(mealPlanData);
    } catch (error) {
        console.error("❌ Error fetching meal plan:", error);
    }
}

// ✅ SAVE NEW MEAL PLAN TO FIRESTORE
async function saveMealPlanToFirestore(mealPlan) {
    const user = auth.currentUser;
    if (!user) {
        console.error("❌ User not authenticated.");
        return;
    }

    try {
        console.log("📤 Saving meal plan to Firestore...");

        await addDoc(collection(db, "meals"), {
            userId: user.uid,
            ingredients: mealPlan.ingredients || "",
            mealsPerDay: mealPlan.mealsPerDay || 0,
            servings: mealPlan.servings || 0,
            dietaryRestrictions: mealPlan.dietaryRestrictions || [],
            mealPlan: mealPlan.mealPlan || "No meal plan generated",
            createdAt: serverTimestamp()
        });

        console.log("✅ Meal plan saved successfully.");
        fetchMealPlan();
    } catch (error) {
        console.error("❌ Error saving meal plan:", error);
    }
}

// ✅ DISPLAY MEAL PLAN IN HTML
function displayMealPlan(mealPlanData) {
    const mealPlanContainer = document.getElementById("mealPlanContainer");
    if (!mealPlanContainer) {
        console.error("❌ Error: 'mealPlanContainer' not found in the DOM.");
        return;
    }

    mealPlanContainer.innerHTML = `
        <h3>🍽️ Your Meal Plan</h3>
        <p><strong>Meals per Day:</strong> ${mealPlanData.mealsPerDay}</p>
        <p><strong>Servings:</strong> ${mealPlanData.servings}</p>
        <p><strong>Ingredients:</strong> ${mealPlanData.ingredients}</p>
        <p><strong>Dietary Restrictions:</strong> ${mealPlanData.dietaryRestrictions.join(", ") || "None"}</p>
        <p><strong>Meal Plan:</strong></p>
        <pre>${mealPlanData.mealPlan}</pre>
    `;
}

// ✅ CLEAR PREVIOUS MEAL PLAN
function clearPreviousMealPlan() {
    const mealPlanContainer = document.getElementById("mealPlanContainer");
    if (mealPlanContainer) {
        mealPlanContainer.innerHTML = "";
        console.log("🗑️ Cleared previous meal plan.");
    } else {
        console.warn("⚠️ 'mealPlanContainer' not found in DOM.");
    }
}

// ✅ FETCH FORM DATA
function getMealPreferences() {
    const ingredients = document.getElementById("ingredients")?.value.trim() || "";
    const mealsPerDay = parseInt(document.getElementById("meals")?.value) || 3;
    const servings = parseInt(document.getElementById("servings")?.value) || 1;
    
    const dietaryRestrictions = [...document.querySelectorAll("input[name='dietary']:checked")].map(input => input.value);

    return { ingredients, mealsPerDay, servings, dietaryRestrictions };
}

// ✅ REQUEST NEW MEAL PLAN FROM API
async function fetchNewMealPlan() {
    clearPreviousMealPlan();

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

        await saveMealPlanToFirestore(newMealPlan);
        displayMealPlan(newMealPlan);
    } catch (error) {
        console.error("❌ Error fetching new meal plan:", error);
    }
}

// ✅ FORM HANDLER FUNCTION
function handleMealPlan() {
    fetchNewMealPlan(); // ✅ Fetch and display meal plan
}

// ✅ EVENT LISTENERS
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded");

    const form = document.getElementById("meal-planner-form");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault(); // ✅ Prevents page reload
            fetchNewMealPlan();
        });
    } else {
        console.error("❌ 'Meal Planner Form' not found.");
    }

    fetchMealPlan(); // ✅ Load meal plan when page loads
});
