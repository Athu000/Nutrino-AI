import { auth, db } from "./auth.js";
import { collection, query, where, getDocs, addDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { getAuthToken } from "./auth.js"; // 🔹 Ensure getAuthToken is in a separate file
// ✅ DELETE OLD MEAL PLAN
async function deleteOldMealPlan() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        console.log("🗑️ Deleting old meal plan...");
        const mealRef = collection(db, "meal_plans");
        const q = query(mealRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
            console.log(`✅ Deleted meal plan: ${doc.id}`);
        });

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

        console.log("📤 Requesting new meal plan from API...");
        const response = await fetch(`${API_BASE_URL}/fetch-meal-plan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ preferences })
        });

        if (!response.ok) throw new Error("Failed to fetch meal plan");

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
    const user = auth.currentUser;
    if (!user) return;

    try {
        const mealRef = collection(db, "meal_plans");
        const q = query(mealRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("⚠️ No meal plan found.");
            alert("No meal plan available. Please generate a new one.");
            return;
        }

        querySnapshot.forEach((doc) => {
            const mealPlan = doc.data();
            document.getElementById("mealPlanContainer").innerHTML = formatMealPlan(mealPlan);
            console.log("✅ Meal Plan Displayed:", mealPlan);
        });

    } catch (error) {
        console.error("❌ Error displaying meal plan:", error);
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
    document.getElementById("mealPlanContainer").innerHTML = "";
    console.log("🗑️ Cleared previous meal plan.");
}

// ✅ RELOAD NEW MEAL PLAN
async function reloadNewMealPlan() {
    clearPreviousMealPlan();
    const preferences = document.getElementById("mealPreferences").value.trim();
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
/// ✅ Make function globally accessible
window.handleMealPlan = handleMealPlan;
