import { auth, db } from "./auth.js";
import { getDocs, query, where, collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ Function to Fetch User Stats
async function fetchUserStats() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("❌ User not logged in.");
            return;
        }

        console.log(`🔍 Fetching stats for: ${user.email}`);

        // ✅ Get User UID
        const userId = user.uid;

        // ✅ Fetch Total Recipes Searched
        const recipesQuery = query(collection(db, "recipes"), where("userId", "==", userId));
        const recipesSnapshot = await getDocs(recipesQuery);
        const totalRecipes = recipesSnapshot.size;

        // ✅ Fetch Total Meals Searched
        const mealsQuery = query(collection(db, "meals"), where("userId", "==", userId));
        const mealsSnapshot = await getDocs(mealsQuery);
        const totalMeals = mealsSnapshot.size;

        // ✅ Fetch User Details from Firestore
        const userDoc = await getDoc(doc(db, "users", userId));
        const userData = userDoc.exists() ? userDoc.data() : null;

        // ✅ Update UI
        document.getElementById("user-name").textContent = userData?.name || "Unknown";
        document.getElementById("user-email").textContent = userData?.email || "Not Available";
        document.getElementById("search-count").textContent = totalRecipes + totalMeals;

        // ✅ Update Medals based on activity
        updateMedals(totalRecipes + totalMeals);
        
    } catch (error) {
        console.error("❌ Error fetching user stats:", error);
        alert("Failed to load user statistics. Please check your permissions.");
    }
}

// ✅ Function to Update Medals
function updateMedals(totalSearches) {
    const achievementsList = document.querySelector(".achievements");
    achievementsList.innerHTML = ""; // Clear previous medals

    if (totalSearches >= 1) achievementsList.innerHTML += `<li>🥇 First Search Completed</li>`;
    if (totalSearches >= 10) achievementsList.innerHTML += `<li>🔥 10+ Searches Achieved</li>`;
    if (totalSearches >= 25) achievementsList.innerHTML += `<li>🌟 25+ Searches Pro User</li>`;
    if (totalSearches >= 50) achievementsList.innerHTML += `<li>🏆 50+ Master Chef</li>`;
}

// ✅ Function to Change & Persist Profile Picture
document.getElementById("change-avatar").addEventListener("click", () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    
    document.getElementById("avatar").src = newAvatarUrl;
    localStorage.setItem("profileAvatar", newAvatarUrl); // Store the avatar till session ends
});

// ✅ Load Saved Profile Picture on Page Load
document.addEventListener("DOMContentLoaded", async () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fetchUserStats(); // Fetch user stats after login
        } else {
            console.error("⚠️ User is not logged in.");
        }
    });

    // Load stored profile picture
    const savedAvatar = localStorage.getItem("profileAvatar");
    if (savedAvatar) {
        document.getElementById("avatar").src = savedAvatar;
    }
});
