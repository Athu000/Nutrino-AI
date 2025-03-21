import { auth, db } from "./auth.js";
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit, serverTimestamp, 
    doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("✅ User Logged In:", user.email);
        fetchMealPlan(user.uid);
    } else {
        console.error("❌ User not authenticated.");
        alert("Please log in first.");
        window.location.href = "login.html"; 
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

    displayMealPlan(mealPlanData); // ✅ Calls global function to display meal plan
}

// ✅ DISPLAY MEAL PLAN
window.displayMealPlan = function displayMealPlan(mealPlanData = null) {
    console.log("🖥️ Rendering Meal Plan...");

    if (!mealPlanData) {
        const storedData = localStorage.getItem("latestMealPlan");
        if (!storedData) {
            console.warn("⚠️ No meal plan data available.");
            return;
        }
        mealPlanData = JSON.parse(storedData);
    }

    // ✅ Select elements in HTML
    const ingredientsEl = document.getElementById("ingredients");
    const mealsPerDayEl = document.getElementById("mealsPerDay");
    const servingsEl = document.getElementById("servings");
    const dietaryRestrictionsEl = document.getElementById("dietaryRestrictions");
    const planNameEl = document.getElementById("planName");
    const mealPlanDescriptionEl = document.getElementById("mealPlanDescription");
    const mealsContainerEl = document.getElementById("mealsContainer");
    const importantNotesEl = document.getElementById("importantNotes");

    if (!ingredientsEl || !mealsPerDayEl || !servingsEl || !dietaryRestrictionsEl || !planNameEl || !mealPlanDescriptionEl || !mealsContainerEl || !importantNotesEl) {
        console.error("❌ Missing required elements in HTML.");
        return;
    }

    // ✅ Populate meal plan details
    ingredientsEl.textContent = mealPlanData.ingredients || "Not provided";
    mealsPerDayEl.textContent = mealPlanData.mealsPerDay || "Unknown";
    servingsEl.textContent = mealPlanData.servings || "Unknown";
    dietaryRestrictionsEl.textContent = mealPlanData.dietaryRestrictions?.join(", ") || "None";
    planNameEl.textContent = "Custom AI-Generated Meal Plan";
    mealPlanDescriptionEl.textContent = mealPlanData.mealPlan || "No meal description available.";

    // ✅ Populate meals dynamically
    mealsContainerEl.innerHTML = "";
    const mealSections = mealPlanData.mealPlan.split("\n\n").filter(section => section.trim() !== "");

    mealSections.forEach(meal => {
        const mealItemDiv = document.createElement("div");
        mealItemDiv.classList.add("meal-item");
        mealItemDiv.innerHTML = `<p>${meal.replace(/\n/g, "<br>")}</p>`;
        mealsContainerEl.appendChild(mealItemDiv);
    });

    // ✅ Add Important Notes
    importantNotesEl.innerHTML = "";
    const notes = [
        "⚠️ This is an AI-generated meal plan. Consult a nutritionist for professional advice.",
        "✅ Ensure a balanced diet by including fruits, vegetables, and proteins.",
        "💧 Stay hydrated throughout the day!"
    ];
    notes.forEach(note => {
        const li = document.createElement("li");
        li.textContent = note;
        importantNotesEl.appendChild(li);
    });

    console.log("✅ Meal Plan Displayed Successfully.");
};

// ✅ FETCH NEW MEAL PLAN
async function fetchNewMealPlan() {
    const preferences = {
        ingredients: document.getElementById("ingredients")?.value.trim() || "",
        mealsPerDay: parseInt(document.getElementById("meals")?.value) || 3,
        servings: parseInt(document.getElementById("servings")?.value) || 1,
        dietaryRestrictions: [...document.querySelectorAll("input[name='dietary']:checked")].map(input => input.value)
    };

    if (!preferences.ingredients) {
        alert("Please enter ingredients.");
        return;
    }

    console.log("📤 Requesting new meal plan:", preferences);

    try {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error("Authentication token missing.");

        const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(preferences)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const newMealPlan = await response.json();
        console.log("✅ API Response:", newMealPlan);

        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not authenticated.");
            return;
        }

        const docRef = await addDoc(collection(db, "meals"), {
            userId: user.uid,
            ...preferences,
            mealPlan: newMealPlan.mealPlan,
            createdAt: serverTimestamp()
        });

        localStorage.setItem("mealPlanId", docRef.id);
        console.log("✅ Meal plan saved successfully.");
        window.location.href = "meals.html";

    } catch (error) {
        console.error("❌ Error generating meal plan:", error);
    }
}

// ✅ EVENT LISTENERS
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded");
    if (window.location.pathname.includes("meals.html")) {
        displayMealPlan();
    }
});
