import { auth, db } from "./auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Fetch User Stats from Firestore
export async function fetchUserStats() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log("⚠️ User not logged in.");
            return;
        }

        console.log(`🔍 Fetching stats for: ${user.email}`);

        // ✅ Fetch User Data from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            console.error("❌ User document not found in Firestore.");
            return;
        }

        const userData = userDocSnap.data();
        document.getElementById("user-name").textContent = userData.name || "Unknown";
        document.getElementById("user-email").textContent = userData.email || "Not Available";

        // ✅ Fetch Total Meals Searched
        const mealsQuery = query(collection(db, "meals"), where("userId", "==", user.uid));
        const mealsSnapshot = await getDocs(mealsQuery);
        const totalMeals = mealsSnapshot.size;

        // ✅ Fetch Total Recipes Searched
        const recipesQuery = query(collection(db, "recipes"), where("userId", "==", user.uid));
        const recipesSnapshot = await getDocs(recipesQuery);
        const totalRecipes = recipesSnapshot.size;

        // ✅ Update UI
        document.getElementById("search-count").textContent = totalRecipes;
        document.getElementById("meal-count").textContent = totalMeals;

        console.log(`✅ Fetched Stats - Meals: ${totalMeals}, Recipes: ${totalRecipes}`);
    } catch (error) {
        console.error("❌ Error fetching user stats:", error);
        alert("Error fetching user statistics. Please try again.");
    }
}

// ✅ Change Avatar Functionality
export function setupAvatar() {
    const avatar = document.getElementById("avatar");
    const changeAvatarBtn = document.getElementById("change-avatar");
    const saveAvatarBtn = document.getElementById("save-avatar");

    // Load avatar from localStorage if available
    const savedAvatar = localStorage.getItem("userAvatar");
    if (savedAvatar) avatar.src = savedAvatar;

    // Change Avatar
    changeAvatarBtn.addEventListener("click", () => {
        const randomSeed = Math.random().toString(36).substring(7);
        avatar.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    });

    // Save Avatar
    saveAvatarBtn.addEventListener("click", () => {
        localStorage.setItem("userAvatar", avatar.src);
        alert("✅ Avatar Saved!");
    });
}

// ✅ Run Functions When Page Loads
document.addEventListener("DOMContentLoaded", () => {
    fetchUserStats();
    setupAvatar();
});
