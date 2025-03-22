import { auth, db } from "./auth.js";
import { 
    collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit, serverTimestamp, 
    doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuthToken } from "./NutrinoAPI.js"; 
const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Ensure User is Authenticated
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("✅ User Logged In:", user.email);
        fetchMealPlan();
    } else {
        console.error("❌ User not authenticated.");
        alert("Please log in first.");
        window.location.href = "login.html"; 
    }
});

// ✅ DELETE OLD MEAL PLAN
async function deleteOldMealPlan() {
    console.log("🗑️ Removing old meal plan from frontend and Firestore...");

    const user = auth.currentUser;
    if (!user) return console.error("❌ User not authenticated.");

    const mealPlanId = localStorage.getItem("mealPlanId");

    if (mealPlanId) {
        try {
            await deleteDoc(doc(db, "meals", mealPlanId));
            console.log("✅ Meal plan deleted from Firestore.");
        } catch (error) {
            console.error("❌ Error deleting meal plan from Firestore:", error);
        }
    }

    // ✅ Clear Local Storage and UI
    localStorage.removeItem("latestMealPlan");
    localStorage.removeItem("mealPlanId");

    ["ingredients", "mealsPerDay", "servings", "dietaryRestrictions", "planName", "mealPlanDescription", "mealsContainer", "importantNotes"]
        .forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerHTML = "";
        });

    console.log("✅ Old meal plan cleared.");
}

// ✅ FETCH MEAL PLAN FROM FIRESTORE OR LOCAL STORAGE
async function fetchMealPlan() {
    console.log("🔄 Checking for existing meal plan...");

    let mealPlanData = localStorage.getItem("latestMealPlan");

    if (!mealPlanData) {
        console.warn("⚠️ No meal plan found in localStorage. Fetching from Firestore...");
        
        const user = auth.currentUser;
        if (!user) return console.error("❌ User not authenticated.");

        const mealPlanId = localStorage.getItem("mealPlanId");
        if (!mealPlanId) return console.warn("⚠️ No meal plan ID found.");

        try {
            const mealPlanSnap = await getDoc(doc(db, "meals", mealPlanId));
            if (!mealPlanSnap.exists()) return console.warn("⚠️ Meal Plan does not exist in Firestore.");

            mealPlanData = mealPlanSnap.data();
            localStorage.setItem("latestMealPlan", JSON.stringify(mealPlanData));

        } catch (error) {
            return console.error("❌ Error fetching meal plan:", error);
        }
    } else {
        mealPlanData = JSON.parse(mealPlanData);
    }

    console.log("✅ Meal Plan Retrieved:", mealPlanData);
    displayMealPlan(mealPlanData);
}

// ✅ DISPLAY MEAL PLAN
function displayMealPlan(mealPlanData) {
    console.log("🖥️ Rendering Meal Plan...");

    if (!mealPlanData) {
        console.warn("⚠️ No meal plan data available.");
        return;
    }

    const elements = {
        ingredients: document.getElementById("ingredients"),
        mealsPerDay: document.getElementById("mealsPerDay"),
        servings: document.getElementById("servings"),
        dietaryRestrictions: document.getElementById("dietaryRestrictions"),
        planName: document.getElementById("planName"),
        mealPlanDescription: document.getElementById("mealPlanDescription"),
        mealsContainer: document.getElementById("mealsContainer"),
        importantNotes: document.getElementById("importantNotes"),
    };

    for (let key in elements) {
        if (!elements[key]) return console.error(`❌ Missing element: #${key}`);
    }

    elements.ingredients.textContent = mealPlanData.ingredients || "Not provided";
    elements.mealsPerDay.textContent = mealPlanData.mealsPerDay || "Unknown";
    elements.servings.textContent = mealPlanData.servings || "Unknown";
    elements.dietaryRestrictions.textContent = mealPlanData.dietaryRestrictions?.join(", ") || "None";
    elements.planName.textContent = "Custom AI-Generated Meal Plan";
    elements.mealPlanDescription.textContent = mealPlanData.mealPlan || "No meal description available.";

    // ✅ Populate Meals
    elements.mealsContainer.innerHTML = "";
    const mealSections = mealPlanData.mealPlan.split("\n\n").filter(section => section.trim() !== "");
    
    mealSections.forEach(meal => {
        const mealItemDiv = document.createElement("div");
        mealItemDiv.classList.add("meal-item");
        mealItemDiv.innerHTML = `<p>${meal.replace(/\n/g, "<br>")}</p>`;
        elements.mealsContainer.appendChild(mealItemDiv);
    });

    console.log("✅ Meal Plan Displayed Successfully.");
}

// ✅ GENERATE NEW MEAL PLAN
async function fetchNewMealPlan() {
    await deleteOldMealPlan();  // ✅ Ensures old plan is deleted before fetching new one
    
    console.log("📤 Requesting new meal plan...");
    
    const preferences = {
        ingredients: document.getElementById("ingredients")?.value.trim() || "",
        mealsPerDay: parseInt(document.getElementById("meals")?.value) || 3,
        servings: parseInt(document.getElementById("servings")?.value) || 1,
        dietaryRestrictions: [...document.querySelectorAll("input[name='dietary']:checked")].map(input => input.value)
    };

    if (!preferences.ingredients) return alert("Please enter ingredients.");

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
        if (!user) return console.error("❌ User not authenticated.");

        const docRef = await addDoc(collection(db, "meals"), {
            userId: user.uid,
            ...preferences,
            mealPlan: newMealPlan.mealPlan,
            createdAt: serverTimestamp()
        });

        localStorage.setItem("mealPlanId", docRef.id);
        console.log("✅ Meal plan saved successfully.");
        
        setTimeout(() => {
            displayMealPlan(newMealPlan);
            window.location.href = "meals.html";
        }, 1000);

    } catch (error) {
        console.error("❌ Error generating meal plan:", error);
    }
}

// ✅ EVENT LISTENERS
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ Document Loaded");

    if (window.location.pathname.includes("meals.html")) {
        setTimeout(fetchMealPlan, 500); // Ensure elements exist before rendering
    }

    const form = document.getElementById("meal-planner-form");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetchNewMealPlan();
        });
    }
});
