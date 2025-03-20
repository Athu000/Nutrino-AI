import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy,getDoc, limit,setDoc ,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Get or Refresh Firebase Auth Token
async function getAuthToken() {
    try {
        const user = auth.currentUser;
        if (user) {
            return await user.getIdToken(true);
        }
    } catch (error) {
        console.error("❌ Auth Token Error:", error);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
    }
    return null;
}

// ✅ Delete Old Recipe from Firestore
async function deleteOldRecipe() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const recipesRef = collection(db, "recipes");
        const q = query(
            recipesRef,
            where("userId", "==", user.uid),
            orderBy("createdAt", "asc"), // ✅ Only one orderBy
            limit(1) // ✅ Only delete the oldest recipe
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const oldestDoc = querySnapshot.docs[0]; // Get the oldest recipe
            await deleteDoc(doc(db, "recipes", oldestDoc.id));
            console.log("✅ Old recipe deleted from Firestore:", oldestDoc.id);
        } else {
            console.log("⚠️ No old recipes found to delete.");
        }
    } catch (error) {
        console.error("❌ Error deleting old recipe:", error);
    }
}

// ✅ Fetch Recipe & Save to Firestore
async function fetchRecipe(prompt) {
    let authToken = await getAuthToken();
    if (!authToken) return;

    try {
        console.log("🗑️ Deleting old recipe before fetching a new one...");
        await deleteOldRecipe(); // ✅ Delete the previous recipe before API call

        console.log("📤 Sending request to API:", API_BASE_URL);
        const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            console.error("❌ API Request Failed:", response.status, response.statusText);
            alert("Failed to fetch recipe. Try again.");
            return;
        }

        const data = await response.json();
        console.log("✅ API Response Received:", data);
        
        if (!data.recipe || typeof data.recipe !== "string") {
            console.error("❌ API Response is malformed:", data);
            alert("Received an invalid recipe response.");
            return;
        }

        let recipeText = data.recipe;
        console.log("✅ Extracted Recipe Text:", recipeText);

        // ✅ Save new Recipe to Firestore
        const user = auth.currentUser;
        if (user) {
            const docRef = await addDoc(collection(db, "recipes"), {
                userId: user.uid,
                recipe: recipeText,
                createdAt: new Date()
            });
            console.log(`✅ New recipe saved to Firestore (ID: ${docRef.id})`);

            // ✅ Ensure the page updates instead of a full reload
            sessionStorage.setItem("latestRecipe", JSON.stringify({ id: docRef.id, recipeText }));

            // ✅ Redirect properly (prevent double navigation)
            setTimeout(() => {
                window.location.href = "generated_recipe.html";
            }, 1500);
        }
    } catch (error) {
        console.error("❌ API Error:", error);
        alert("Error fetching recipe. Try again.");
    }
}
document.addEventListener("DOMContentLoaded", function () {
    const recipeCards = document.querySelectorAll(".Grid-col1"); // Select all recipe cards
    const recipeInput = document.getElementById("rec_search"); // Recipe input box

    // ✅ When a recipe card is clicked, set its name in the input box and scroll up
    recipeCards.forEach(card => {
        card.addEventListener("click", function (event) {
            event.preventDefault(); // ⛔ Prevent redirection

            const recipeName = card.querySelector(".Text-root1")?.textContent.trim(); // Get recipe name
            if (recipeName) {
                recipeInput.value = recipeName; // Set recipe name in input box

                // ✅ Scroll smoothly to the input box
                recipeInput.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                console.warn("⚠️ Recipe name not found inside the card:", card);
            }
        });
    });
});


// ✅ Display Recipe from Firestore
async function displayRecipe() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not logged in.");
            return;
        }

        console.log("✅ Logged-in User ID:", user.uid);

        const recipesRef = collection(db, "recipes");
        const q = query(
            recipesRef,
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        let querySnapshot;
        let retries = 3;

        while (retries > 0) {
            querySnapshot = await getDocs(q);
            console.log("🔍 Firestore Query Result:", querySnapshot.docs.map(doc => doc.data()));

            if (!querySnapshot.empty) break;

            console.warn(`⏳ Firestore delay... Retrying (${4 - retries}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
        }

        if (querySnapshot.empty) {
            console.warn("⚠️ No recipes found.");
            document.getElementById("recipe-title").textContent = "No recipes found.";
            return;
        }

        const latestDoc = querySnapshot.docs[0].data();
        console.log("✅ Latest Recipe Document:", latestDoc);

        // ✅ Fetching the correct field (content) instead of recipe
        const latestRecipe = latestDoc.content || latestDoc.recipe;

        if (!latestRecipe) {
            console.error("❌ Recipe field is missing in Firestore document!");
            document.getElementById("recipe-title").textContent = "No valid recipe found.";
            return;
        }

        // ✅ Update UI Elements
        document.getElementById("recipe-title").textContent = extractTitle(latestRecipe);
        document.getElementById("recipe-desc").textContent = "A delicious AI-generated recipe! 😋";
        console.log("✅ Extracting Ingredients...");
        document.getElementById("ingredients-list").innerHTML = extractSection(latestRecipe, "Ingredients");

        console.log("✅ Extracting Instructions...");
        document.getElementById("instructions-list").innerHTML = extractSection(latestRecipe, "Instructions");

        console.log("✅ Extracting Nutrition...");
        document.getElementById("nutrition-list").innerHTML = extractSection(latestRecipe, "Nutritional Information");

    } catch (error) {
        console.error("❌ Error displaying recipe:", error);
    }
}



// ✅ Extract Title (Keep emojis)
function extractTitle(text) {
    if (!text) return "AI-Generated Recipe";
    const match = text.match(/^##\s*(.+)/);
    return match ? cleanText(match[1].trim()) : "AI-Generated Recipe";
}

// ✅ Extract Ingredients, Instructions & Nutrition
function extractSection(text, section) {
    if (!text) return `<li>⚠️ No data available.</li>`;

    console.log(`🔎 Searching for section: ${section} in text...`);

    // Improved regex to handle flexible section formatting
    const regex = new RegExp(
        `\\*{0,2}\\s*${section}\\s*:?\\s*\\*{0,2}\\s*([\\s\\S]*?)(?=\\n\\s*\\*{0,2}[A-Z]|$)`,
        "i"
    );
    const match = text.match(regex);

    if (!match) {
        console.warn(`⚠️ Section '${section}' not found in text.`);
        return `<li>⚠️ No data available.</li>`;
    }

    console.log(`✅ Found Section: ${section}`, match[1]);

    return match[1]
        .trim()
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => `<li>${cleanText(line.trim())}</li>`)
        .join("");
}

// ✅ Improved Text Cleaner with Bullet Point Handling
function cleanText(text) {
    let cleanedLine = text
        .replace(/\*\*/g, "") // Remove **bold**
        .replace(/^[-*•]\s*(?=\w)/g, "• ") // Keep bullet points
        .trim();

    // 🍽️ Add Meaningful Cooking Emojis
    cleanedLine = cleanedLine
        .replace(/\bPreheat\b/g, '🔥 Preheat')
        .replace(/\bMix\b/g, '🥣 Mix')
        .replace(/\bStir\b/g, '🌀 Stir')
        .replace(/\bBake\b/g, '🔥 Bake')
        .replace(/\bServe\b/g, '🍽️ Serve')
        .replace(/\bCool\b/g, '❄️ Cool')
        .replace(/\bWhisk\b/g, '🥄 Whisk')
        .replace(/\bCream\b/g, '🧈 Cream')
        .replace(/\bFold\b/g, '🎭 Fold')
        .replace(/\bGrease\b/g, '🛢️ Grease')
        .replace(/\bBeat\b/g, '🥊 Beat')
        .replace(/\bSprinkle\b/g, '✨ Sprinkle');

    return cleanedLine;
}

// ✅ Handle UI Actions & Buttons
function clearPreviousRecipe() {
    sessionStorage.removeItem("latestRecipe");
    localStorage.removeItem("latestRecipe");
    document.getElementById("recipe-desc").innerHTML = "";
}

function reloadNewRecipe() {
    clearPreviousRecipe();
    window.location.href = window.location.pathname + "?new";
}

// ✅ Event Listeners for Buttons
document.addEventListener("DOMContentLoaded", function () {
    let urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("new")) {
        clearPreviousRecipe();
    }

    document.getElementById("goBackBtn").addEventListener("click", function () {
        clearPreviousRecipe();
        window.location.href = "index.html";
    });

    document.getElementById("generateAnotherBtn").addEventListener("click", function () {
        reloadNewRecipe();
    });

    displayRecipe();
});
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

// ✅ **Make function globally accessible**
window.handleMealPlan = handleMealPlan;

// ✅ Make function globally accessible
window.fetchRecipe = fetchRecipe;
window.displayRecipe = displayRecipe;
