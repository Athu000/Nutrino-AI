import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, setDoc, doc 
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

  // ✅ Dark Mode Toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  const body = document.body;

  if (localStorage.getItem("darkMode") === "enabled") {
      body.classList.add("dark-mode");
  }

  darkModeToggle.addEventListener("click", () => {
      body.classList.toggle("dark-mode");

      if (body.classList.contains("dark-mode")) {
          localStorage.setItem("darkMode", "enabled");
          darkModeToggle.textContent = "☀️"; // Light mode icon
      } else {
          localStorage.setItem("darkMode", "disabled");
          darkModeToggle.textContent = "🌙"; // Dark mode icon
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
});

// ✅ Export Firebase Auth & Firestore for other scripts
export { auth, db, provider };
