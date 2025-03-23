import { auth, db } from "./auth.js";
import { getDocs, query, where, collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ Function to Fetch User Stats
async function fetchUserStats(user) {
    try {
        if (!user) {
            console.error("❌ User not logged in.");
            return;
        }

        console.log(`🔍 Fetching stats for: ${user.email}`);

        const userId = user.uid;

        // ✅ Fetch Total Recipes Searched by User
        const recipesQuery = query(collection(db, "recipes"), where("userId", "==", userId));
        const recipesSnapshot = await getDocs(recipesQuery);
        const totalRecipes = recipesSnapshot.size;

        // ✅ Fetch Total Meals Searched by User
        const mealsQuery = query(collection(db, "meals"), where("userId", "==", userId));
        const mealsSnapshot = await getDocs(mealsQuery);
        const totalMeals = mealsSnapshot.size;

        // ✅ Fetch User Details
        const userDoc = await getDoc(doc(db, "users", userId));
        const userData = userDoc.exists() ? userDoc.data() : null;

        // ✅ Update UI
        document.getElementById("user-name").textContent = userData?.name || "Unknown";
        document.getElementById("user-email").textContent = userData?.email || "Not Available";
        document.getElementById("search-count").textContent = totalRecipes;
        document.getElementById("meal-count").textContent = totalMeals;

        var totalSearches = totalRecipes + totalMeals;
        // ✅ Update Medals based on activity
        updateMedals(totalRecipes + totalMeals);
        updateMedals(totalSearches);
        updateUserRank(userId, totalSearches);
        // ✅ Load User Profile Picture
        loadUserProfilePicture(userId);
    } catch (error) {
        console.error("❌ Error fetching user stats:", error);
        alert("Failed to load user statistics. Please check your permissions.");
    }
}

// ✅ Update Medals Based on Search Count
function updateMedals(totalSearches) {
    const achievementsList = document.querySelector(".achievements");
    achievementsList.innerHTML = "";

    if (totalSearches >= 1) achievementsList.innerHTML += `<li>🥇 First Search Completed</li>`;
    if (totalSearches >= 10) achievementsList.innerHTML += `<li>🔥 10+ Searches Achieved</li>`;
    if (totalSearches >= 25) achievementsList.innerHTML += `<li>🌟 25+ Searches Pro User</li>`;
    if (totalSearches >= 50) achievementsList.innerHTML += `<li>🏆 50+ Master Chef</li>`;
}
// ✅ Function to Update User Rank in Firestore
async function updateUserRank(userId, totalSearches) {
    const rank =
        totalSearches >= 50 ? "Master Chef" :
        totalSearches >= 25 ? "Pro User" :
        totalSearches >= 10 ? "Intermediate Cook" :
        "Beginner";

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { rank });

    document.getElementById("user-rank").textContent = `🏅 ${rank}`;
}
// ✅ Function to Load & Save User Profile Picture in Firestore
async function loadUserProfilePicture(userId) {
    const userRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userRef);

    if (userDocSnap.exists() && userDocSnap.data().profilePicture) {
        document.getElementById("avatar").src = userDocSnap.data().profilePicture;
    }
}

// ✅ Function to Change & Persist Profile Picture
document.getElementById("change-avatar").addEventListener("click", async () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;

    document.getElementById("avatar").src = newAvatarUrl;
    
    // ✅ Store New Avatar in Firestore
    const user = auth.currentUser;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { profilePicture: newAvatarUrl }, { merge: true });
    }
});


// ✅ Load Saved Profile Picture on Page Load
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            fetchUserStats(user);
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
