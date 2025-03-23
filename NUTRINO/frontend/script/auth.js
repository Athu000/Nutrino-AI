import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, setDoc, getDocs, query, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyARqmUW_Upyh5IRllM0LEpfU9GqziM3Cqs",
  authDomain: "nutrino-ai.firebaseapp.com",
  projectId: "nutrino-ai",
  storageBucket: "nutrino-ai.firebasestorage.app",
  messagingSenderId: "1005323663654",
  appId: "1:1005323663654:web:3ecf92fde57fbc9c7da9e7"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ✅ Function to Fetch User Statistics
export async function fetchUserStats() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.warn("⚠️ No user logged in.");
            return;
        }

        console.log(`🔍 Fetching stats for: ${user.email}`);

        const userId = user.uid;
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            console.warn("⚠️ No user data found.");
            return;
        }

        const userData = userDocSnap.data();

        // ✅ Fetch Total Meals Searched by User
        const mealsQuery = query(collection(db, "meals"), where("userId", "==", userId));
        const mealsSnapshot = await getDocs(mealsQuery);
        const totalMeals = mealsSnapshot.size;

        // ✅ Fetch Total Recipes Searched by User
        const recipesQuery = query(collection(db, "recipes"), where("userId", "==", userId));
        const recipesSnapshot = await getDocs(recipesQuery);
        const totalRecipes = recipesSnapshot.size;

        console.log(`✅ User has searched ${totalRecipes} recipes and ${totalMeals} meals.`);

        // ✅ Update Profile Page UI
        if (window.location.pathname.includes("profile.html")) {
            document.getElementById("user-name").textContent = userData.name || "Unknown";
            document.getElementById("user-email").textContent = userData.email || "Not Available";
            document.getElementById("search-count").textContent = totalRecipes || 0;
            document.getElementById("meals-count").textContent = totalMeals || 0;

            // ✅ Generate Achievements
            const achievementsList = document.querySelector(".achievements");
            achievementsList.innerHTML = ""; // Clear existing list

            if (totalRecipes >= 10) {
                achievementsList.innerHTML += `<li>🔍 10+ Recipe Searches</li>`;
            }
            if (totalMeals >= 5) {
                achievementsList.innerHTML += `<li>🍽️ Cooked 5+ Meals</li>`;
            }
            if (totalMeals >= 20) {
                achievementsList.innerHTML += `<li>👨‍🍳 Master Chef - 20 Meals Cooked</li>`;
            }
        }
    } catch (error) {
        console.error("❌ Error fetching user stats:", error);
    }
}

// ✅ Call Fetch Function After Authentication
onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchUserStats();
    }
});
// ✅ Google Sign-In Function
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log(`✅ Signed in as: ${user.email}`);

    // ✅ Store user details in Firestore
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName,
      email: user.email,
      uid: user.uid,
      lastLogin: new Date()
    });

    // ✅ Store user details in localStorage for persistence
    localStorage.setItem("authToken", await user.getIdToken());
    localStorage.setItem("loggedInUser", JSON.stringify({ email: user.email, name: user.displayName }));

    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("❌ Google Sign-In Error:", error.message);
    alert("Google Sign-In failed. Please try again.");
  }
}

// ✅ Logout Function
export function logoutUser() {
  signOut(auth)
    .then(() => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("loggedInUser");

      console.log("✅ User logged out successfully.");
      window.location.href = "index.html"; // Redirect to homepage after logout
    })
    .catch(error => {
      console.error("❌ Logout Error:", error.message);
      alert("Logout failed. Please try again.");
    });
}

// ✅ Auto-Check User Login Status & Trigger Recipe Display
document.addEventListener("DOMContentLoaded", async () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log(`✅ User Logged In: ${user.email}`);

      // ✅ Load the recipe display only if the user is on the correct page
      if (window.location.pathname.includes("generated_recipe.html")) {
        if (window.displayRecipe) { 
            window.displayRecipe(); 
        } else { 
            console.error("❌ displayRecipe is not defined globally."); 
        }
      }
    } else {
      console.log("⚠️ User not logged in.");
    }
  });

  // ✅ Grocery List Functionality
  const groceryButton = document.getElementById("generate-grocery-list");
  if (groceryButton) {
    groceryButton.addEventListener("click", generateGroceryList);
  }

  function generateGroceryList() {
    const checkedIngredients = [];
    document.querySelectorAll(".ingredient-checkbox:checked").forEach(checkbox => {
      checkedIngredients.push(checkbox.value);
    });

    localStorage.setItem("groceryList", JSON.stringify(checkedIngredients));
    alert("🛒 Grocery List Saved!");
  }

  // ✅ Likes Feature
  document.querySelectorAll(".like-button").forEach(button => {
    button.addEventListener("click", () => {
      const recipeId = button.dataset.recipeId;
      let likedRecipes = JSON.parse(localStorage.getItem("likedRecipes") || "[]");

      if (!likedRecipes.includes(recipeId)) {
        likedRecipes.push(recipeId);
        localStorage.setItem("likedRecipes", JSON.stringify(likedRecipes));
        button.textContent = "❤️ Liked!";
      } else {
        likedRecipes = likedRecipes.filter(id => id !== recipeId);
        localStorage.setItem("likedRecipes", JSON.stringify(likedRecipes));
        button.textContent = "♡ Like";
      }
    });
  });

  // ✅ Inject Profile Page CSS Dynamically
  if (window.location.pathname.includes("profile.html")) {
    const style = document.createElement("style");
    style.innerHTML = `
      body {
          font-family: 'Poppins', sans-serif;
          background-color: #f4f4f4;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
      }
      
      .profile-container {
          display: flex;
          gap: 20px;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
          max-width: 800px;
          width: 100%;
      }

      .profile-card {
          flex: 1;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 10px;
          text-align: center;
      }

      .avatar-container img {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          margin: 10px;
          border: 3px solid #007bff;
      }

      #change-avatar {
          margin-top: 10px;
          padding: 8px 12px;
          border: none;
          background: #007bff;
          color: white;
          border-radius: 5px;
          cursor: pointer;
      }

      .stats-container {
          flex: 2;
          padding: 20px;
      }

      .chart-container {
          width: 100%;
          height: 250px;
      }

      .achievements ul {
          list-style: none;
          padding: 0;
      }

      .achievements li {
          background: #ffdd57;
          padding: 8px;
          margin: 5px 0;
          border-radius: 5px;
          font-weight: bold;
      }
    `;
    document.head.appendChild(style);
    console.log("✅ Profile Page Styles Injected!");
  }

});

// ✅ Export Firebase Auth & Firestore for other scripts
export { auth, db, provider };
