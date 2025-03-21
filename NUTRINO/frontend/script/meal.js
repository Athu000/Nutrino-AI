import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy,getDoc, limit,setDoc ,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ✅ Handle Meal Plan Creation & Fetching
export async function handleMealPlan(action, ingredients = "", mealsPerDay = 3, servings = 1, dietaryRestrictions = []) {
    const mealPlanContainer = document.getElementById("meal-plan");

    try {
        if (!auth || !auth.currentUser) {
            alert("❌ Please log in to continue.");
            return;
        }

        const user = auth.currentUser;

        if (action === "create") {
            console.log("📩 Creating meal plan for user:", user.uid);
            
            const mealPlanRef = await addDoc(collection(db, "meals"), {
                userId: user.uid,
                ingredients,
                mealsPerDay,
                servings,
                dietaryRestrictions,
                mealPlan: "Generating meal plan...",
                createdAt: serverTimestamp(),
            });

            console.log(`✅ Meal Plan Created in Firestore (ID: ${mealPlanRef.id})`);

            const authToken = await user.getIdToken();
            const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authToken}`
                },
                body: JSON.stringify({ ingredients, mealsPerDay, servings, dietaryRestrictions }),
            });

            const data = await response.json();
            if (!response.ok || !data.mealPlan) {
                throw new Error(data.error || "API did not return a valid meal plan.");
            }

            console.log("✅ API Meal Plan:", data.mealPlan);

            await setDoc(mealPlanRef, { mealPlan: data.mealPlan }, { merge: true });

            alert("🎉 Meal plan created successfully!");

            // ✅ Ensure redirection actually happens
            setTimeout(() => {
                window.location.href = "meals.html";
            }, 1000);

        } else if (action === "fetch") {
            console.log("🔍 Fetching meal plan for user:", user.uid);

            const mealPlanQuery = query(
                collection(db, "meals"),
                where("userId", "==", user.uid),
                orderBy("createdAt", "desc"),
                limit(1)
            );

            const querySnapshot = await getDocs(mealPlanQuery);

            if (querySnapshot.empty) {
                console.warn("⚠️ No meal plan found.");
                mealPlanContainer.innerHTML = "<p>⚠️ No meal plan found. Please create one!</p>";
                return;
            }

            const latestMealPlan = querySnapshot.docs[0].data();
            console.log("✅ Meal Plan Found:", latestMealPlan);

            mealPlanContainer.innerHTML = `<p>${latestMealPlan.mealPlan}</p>`;
        }
    } catch (error) {
        console.error(`❌ Error handling meal plan (${action}):`, error);
        alert(`Failed to ${action} meal plan. Please try again.`);
    }
}

// ✅ Ensure DOM elements exist before adding event listeners
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ DOM Loaded");

    // ✅ Fix: Ensure "Create Meal Plan" button works
    const mealPlannerForm = document.getElementById("meal-planner-form");
    if (mealPlannerForm) {
        mealPlannerForm.addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent page reload

            const ingredients = document.getElementById("ingredients").value.trim();
            const mealsPerDay = parseInt(document.getElementById("meals").value);
            const servings = parseInt(document.getElementById("servings").value);
            
            // ✅ Collect dietary restrictions
            const dietaryRestrictions = [];
            document.querySelectorAll('input[name="dietary"]:checked').forEach((checkbox) => {
                dietaryRestrictions.push(checkbox.value);
            });

            console.log("📩 Sending Meal Plan Request:", { ingredients, mealsPerDay, servings, dietaryRestrictions });

            // ✅ Call handleMealPlan function
            handleMealPlan("create", ingredients, mealsPerDay, servings, dietaryRestrictions);
        });
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("✅ User is logged in:", user.email);
            handleMealPlan("fetch");
        } else {
            console.warn("⚠️ No user logged in.");
        }
    });
});
// ✅ **Enhanced Meal Plan Formatting**
function formatMealPlan(mealText, mealsPerDay) {
    if (!mealText) return "<p>⚠️ No meal plan available.</p>";

    let formattedHTML = "";
    const mealSections = {
        "Breakfast": [],
        "Lunch": [],
        "Dinner": [],
        "Snack": []
    };

    const mealLines = mealText.split("\n").filter(line => line.trim() !== "");
    let currentMealType = "Breakfast"; // Default start

    for (let line of mealLines) {
        if (/breakfast/i.test(line)) currentMealType = "Breakfast";
        else if (/lunch/i.test(line)) currentMealType = "Lunch";
        else if (/dinner/i.test(line)) currentMealType = "Dinner";
        else if (/snack/i.test(line)) currentMealType = "Snack";

        mealSections[currentMealType].push(`<li>${cleanText(line)}</li>`);
    }

    // ✅ **Auto-add a snack if mealsPerDay > 3**
    if (mealsPerDay > 3 && mealSections.Snack.length === 0) {
        mealSections.Snack.push("<li>🥜 Healthy Snack: Nuts, Yogurt, or Fruit</li>");
    }

    // ✅ Append meals in correct order
    formattedHTML += `<div class="meal-day"><h3>📅 Your Meal Plan</h3>`;
    
    ["Breakfast", "Lunch", "Dinner", "Snack"].forEach(mealType => {
        if (mealSections[mealType].length > 0) {
            formattedHTML += `<div class="meal-item">
                <h4>🍽️ ${mealType}</h4>
                <ul>${mealSections[mealType].join("")}</ul>
            </div>`;
        }
    });

    formattedHTML += `</div>`;
    return formattedHTML;
}

// ✅ **Text Cleaning Helper**
function cleanText(text) {
    return text
        .replace(/\*\*/g, "") // Remove bold formatting
        .replace(/^[-*•]\s*(?=\w)/g, "• ") // Keep bullet points
        .trim();
}

// ✅ **Event Listeners Moved from `meal_planner.html`**
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ DOM Loaded");

    // ✅ Handle Meal Plan Form Submission
    const mealPlannerForm = document.getElementById("meal-planner-form");
    if (mealPlannerForm) {
        mealPlannerForm.addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent page reload

            const ingredients = document.getElementById("ingredients").value.trim();
            const mealsPerDay = parseInt(document.getElementById("meals").value);
            const servings = parseInt(document.getElementById("servings").value);
            
            // ✅ Collect dietary restrictions
            const dietaryRestrictions = [];
            document.querySelectorAll('input[name="dietary"]:checked').forEach((checkbox) => {
                dietaryRestrictions.push(checkbox.value);
            });

            console.log("📩 Sending Meal Plan Request:", { ingredients, mealsPerDay, servings, dietaryRestrictions });

            // ✅ Call handleMealPlan function
            handleMealPlan("create", ingredients, mealsPerDay, servings, dietaryRestrictions);
        });
    }

    // ✅ Show/Hide "Other Diet" Text Field
    const otherDietCheckbox = document.getElementById("other-diet");
    const otherDietText = document.getElementById("other-diet-text");
    if (otherDietCheckbox && otherDietText) {
        otherDietCheckbox.addEventListener("change", function () {
            otherDietText.style.display = this.checked ? "block" : "none";
        });
    }

    // ✅ Handle "Go Back" Button
    const goBackBtn = document.getElementById("goBackBtn");
    if (goBackBtn) {
        goBackBtn.addEventListener("click", function () {
            window.location.href = "index.html"; // Redirect to home or dashboard
        });
    }

    // ✅ Fetch Meal Plan if User is Logged In
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("✅ User is logged in:", user.email);
            handleMealPlan("fetch");
        } else {
            console.warn("⚠️ No user logged in.");
        }
    });
});

/// ✅ Make function globally accessible
window.handleMealPlan = handleMealPlan;
