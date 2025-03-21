import { auth, db } from "./auth.js";
import { collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";
// ✅ DELETE OLD MEAL PLAN
async function deleteOldMealPlan() {
    const authToken = await getAuthToken();
    if (!authToken) return;

    try {
        console.log("🗑️ Deleting old meal plan...");
        const response = await fetch(`${API_BASE_URL}/delete-meal-plan`, {  // ✅ Updated API endpoint
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error(`Delete Error: ${response.status} ${response.statusText}`);

        console.log("✅ Old meal plan deleted successfully.");

    } catch (error) {
        console.error("❌ Error deleting meal plan:", error);
    }
}

// ✅ FETCH NEW MEAL PLAN FROM API
async function fetchMealPlan(preferences) {
    const authToken = await getAuthToken();
    if (!authToken) return;

    try {
        await deleteOldMealPlan(); // ✅ Delete old plan before fetching a new one

        // ✅ Debugging - Log the exact data being sent
        console.log("📤 Sending request to API with:", JSON.stringify(preferences, null, 2));

        const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(preferences) // 🚨 Ensure preferences is correctly structured
        });

        if (!response.ok) {
            const errorResponse = await response.json();  // Capture API error details
            console.error("❌ API Error Response:", errorResponse);
            throw new Error(`API Error: ${response.status} - ${errorResponse.error}`);
        }

        const data = await response.json();
        console.log("✅ API Response:", data);

        if (!data.mealPlan) throw new Error("Meal plan data is missing");

        return data.mealPlan;

    } catch (error) {
        console.error("❌ API Error fetching meal plan:", error);
        alert("Failed to fetch meal plan.");
    }
}

// ✅ DISPLAY MEAL PLAN
async function displayMealPlan() {
    const authToken = await getAuthToken();
    if (!authToken) return;

    try {
        console.log("📥 Fetching latest meal plan...");
        const response = await fetch(`${API_BASE_URL}/meal-plan`, {  // ✅ Updated API endpoint
            method: "GET",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

        const data = await response.json();
        if (!data.mealPlan) throw new Error("No meal plan found.");

        const container = document.getElementById("mealPlanContainer");
        if (!container) {
            console.error("❌ Error: 'mealPlanContainer' not found in the DOM.");
            return;
        }

        container.innerHTML = `<pre>${JSON.stringify(data.mealPlan, null, 2)}</pre>`;
        console.log("✅ Meal Plan Displayed:", data.mealPlan);

    } catch (error) {
        console.error("❌ Error displaying meal plan:", error);
        alert("Could not load meal plan.");
    }
}
// ✅ EXTRACT MEAL TITLE
function extractMealTitle(mealText) {
    return mealText.split("\n")[0] || "Untitled Meal Plan";
}

// ✅ EXTRACT MEAL SECTIONS (Breakfast, Lunch, Dinner)
function extractMealSections(mealText) {
    const sections = mealText.split("\n\n");
    return sections.filter((section) => section.includes(":"));
}

// ✅ CLEAN MEAL PLAN TEXT
function cleanMealText(mealText) {
    return mealText.replace(/[*_]/g, "").trim();
}

// ✅ CLEAR PREVIOUS MEAL PLAN
function clearPreviousMealPlan() {
    const container = document.getElementById("mealPlanContainer");
    if (container) {
        container.innerHTML = ""; // ✅ Clears only if the container exists
        console.log("🗑️ Cleared previous meal plan.");
    } else {
        console.warn("⚠️ Warning: 'mealPlanContainer' not found in DOM.");
    }
}

// ✅ FETCH MEAL PLAN FORM DATA
function getMealPreferences() {
    const ingredients = document.getElementById("ingredients")?.value.trim() || "";
    const meals = parseInt(document.getElementById("meals")?.value) || 3;
    const servings = parseInt(document.getElementById("servings")?.value) || 1;
    
    // ✅ Collect selected dietary restrictions
    const dietaryRestrictions = [...document.querySelectorAll("input[name='dietary']:checked")]
        .map(input => input.value);

    return { ingredients, meals, servings, dietaryRestrictions };
}

// ✅ RELOAD NEW MEAL PLAN
async function reloadNewMealPlan() {
    clearPreviousMealPlan();

    const ingredientsInput = document.getElementById("ingredients");
    const mealsInput = document.getElementById("meals");
    const servingsInput = document.getElementById("servings");
    const dietaryInputs = document.querySelectorAll("input[name='dietary']:checked");

    if (!ingredientsInput || !mealsInput || !servingsInput) {
        console.error("❌ Missing input fields in DOM.");
        return;
    }

    // ✅ Extract values correctly
    const ingredients = ingredientsInput.value.trim();
    const mealsPerDay = parseInt(mealsInput.value, 10);
    const servings = parseInt(servingsInput.value, 10);
    const dietaryRestrictions = Array.from(dietaryInputs).map(input => input.value);

    if (!ingredients || !mealsPerDay || !servings) {
        console.error("❌ Missing required fields.");
        alert("Please fill all required fields.");
        return;
    }

    // ✅ Create properly structured request
    const preferences = {
        ingredients,
        mealsPerDay,
        servings,
        dietaryRestrictions
    };

    console.log("📤 Final Meal Plan Request:", preferences); // ✅ Debugging step

    const newMealPlan = await fetchMealPlan(preferences);
    if (newMealPlan) {
        saveMealPlanToFirestore(newMealPlan);
        displayMealPlan();
    }
}

// ✅ SAVE MEAL PLAN TO FIRESTORE
async function saveMealPlanToFirestore(mealPlan) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = await addDoc(collection(db, "meal_plans"), {
            userId: user.uid,
            mealPlan: mealPlan,
            createdAt: new Date()
        });
        console.log(`✅ New meal plan saved to Firestore (ID: ${docRef.id})`);

    } catch (error) {
        console.error("❌ Error saving meal plan:", error);
    }
}
function handleMealPlan() {
    reloadNewMealPlan(); // ✅ Call function to fetch & display meal plan
}
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded");

    if (!document.getElementById("mealPreferences")) {
        console.warn("⚠️ mealPreferences input not found in DOM.");
    }

    const form = document.getElementById("meal-planner-form");
if (form) {
    form.addEventListener("submit", function (event) {
        event.preventDefault(); // ✅ Prevents page reload
        reloadNewMealPlan();
    });
} else {
    console.error("❌ 'Meal Planner Form' not found.");
}

});
