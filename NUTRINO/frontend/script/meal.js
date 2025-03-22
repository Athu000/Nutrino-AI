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
        fetchMealPlan(user.uid);
    } else {
        console.error("❌ User not authenticated.");
        alert("Please log in first.");
        window.location.href = "login.html"; 
    }
});
async function deleteOldMealPlan() {
    console.log("🗑️ Removing old meal plan from frontend and Firestore...");

    const user = auth.currentUser;
    if (!user) {
        console.error("❌ User not authenticated.");
        return;
    }

    const mealPlanId = localStorage.getItem("mealPlanId");
    
    if (mealPlanId) {
        try {
            await deleteDoc(doc(db, "meals", mealPlanId));
            console.log("✅ Meal plan deleted from Firestore.");
        } catch (error) {
            console.error("❌ Error deleting meal plan from Firestore:", error);
        }
    } else {
        console.warn("⚠️ No meal plan ID found in localStorage.");
    }

    // ✅ Remove meal plan from Local Storage
    localStorage.removeItem("latestMealPlan");
    localStorage.removeItem("mealPlanId");

    // ✅ Remove meal plan from UI
    const elementsToClear = ["ingredients", "mealsPerDay", "servings", "dietaryRestrictions", "planName", "mealPlanDescription", "mealsContainer", "importantNotes"];

    elementsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.tagName === "DIV") {
                element.innerHTML = ""; // Clear content for divs
            } else {
                element.textContent = ""; // Clear text content for spans, p, etc.
            }
        }
    });

    console.log("✅ Old meal plan cleared from UI and localStorage.");

    // ✅ Fetch new meal plan after deletion
    fetchMealPlan();
}
// ✅ FETCH LATEST MEAL PLAN FROM FIRESTORE
async function fetchMealPlan() {
    deleteOldMealPlan();  // ✅ Ensure old meal is cleared before fetching a new one
    console.log("🔎 Checking Local Storage...");
    
    let mealPlanData = localStorage.getItem("latestMealPlan");
    
    console.log("🔄 Fetching Meal Plan...");
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

    displayMealPlan(mealPlanData);
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

    // ✅ Ensure required elements exist
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
        if (!elements[key]) {
            console.error(`❌ Missing element: #${key}`);
            return;
        }
    }

    // ✅ Populate meal plan details
    elements.ingredients.textContent = mealPlanData.ingredients || "Not provided";
    elements.mealsPerDay.textContent = mealPlanData.mealsPerDay || "Unknown";
    elements.servings.textContent = mealPlanData.servings || "Unknown";
    elements.dietaryRestrictions.textContent = mealPlanData.dietaryRestrictions?.join(", ") || "None";
    elements.planName.textContent = "Custom AI-Generated Meal Plan";
    elements.mealPlanDescription.textContent = mealPlanData.mealPlan || "No meal description available.";

    // ✅ Populate meals dynamically
    elements.mealsContainer.innerHTML = "";
    const mealSections = mealPlanData.mealPlan.split("\n\n").filter(section => section.trim() !== "");

    mealSections.forEach(meal => {
        const mealItemDiv = document.createElement("div");
        mealItemDiv.classList.add("meal-item");
        mealItemDiv.innerHTML = `<p>${meal.replace(/\n/g, "<br>")}</p>`;
        elements.mealsContainer.appendChild(mealItemDiv);
    });

    console.log("✅ Meal Plan Displayed Successfully.");
};

// ✅ FETCH NEW MEAL PLAN
async function fetchNewMealPlan() {
    deleteOldMealPlan();  // ✅ Ensure old meal is cleared before fetching a new one
    console.log("📤 Requesting new meal plan...");
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
        setTimeout(() =>  {
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
        setTimeout(displayMealPlan, 500); // Ensure elements exist before rendering
    }

    const form = document.getElementById("meal-planner-form");
    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            fetchNewMealPlan();
        });
    }
});
