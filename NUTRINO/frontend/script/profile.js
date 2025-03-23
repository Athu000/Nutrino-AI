import { auth, db } from "./auth.js";
import { 
    getDocs, query, where, collection, doc, getDoc, updateDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.exists() ? userDoc.data() : null;

        if (!userData) {
            console.error("⚠️ User data not found in Firestore.");
            return;
        }

        // ✅ Update UI
        document.getElementById("user-name").textContent = userData.name || "Unknown";
        document.getElementById("user-email").textContent = userData.email || "Not Available";
        document.getElementById("search-count").textContent = totalRecipes;
        document.getElementById("meal-count").textContent = totalMeals;

        const totalSearches = totalRecipes + totalMeals;

        // ✅ Update Medals & Rank
        updateMedals(totalSearches);
        updateUserRank(userId, totalSearches);

        // ✅ Load User Profile Picture
        loadUserProfilePicture(userId);
    } catch (error) {
        console.error("❌ Error fetching user stats:", error);
        alert("Failed to load user statistics. Please check your permissions.");
    }
}

function updateMedals(totalSearches) {
    const achievementsList = document.querySelector(".achievements");
    achievementsList.innerHTML = ""; // Clear previous list

    const medals = [
        { threshold: 1, emoji: "🥇", text: "First Search Completed" },
        { threshold: 10, emoji: "🔥", text: "10+ Searches Achieved" },
        { threshold: 25, emoji: "🌟", text: "25+ Searches Pro User" },
        { threshold: 50, emoji: "🏆", text: "50+ Master Chef" },
        { threshold: 100, emoji: "🎖", text: "100+ Recipe Expert" },
        { threshold: 250, emoji: "🥈", text: "250+ Culinary Genius" },
        { threshold: 500, emoji: "🥇", text: "500+ AI Recipe King" },
        { threshold: 750, emoji: "👑", text: "750+ Kitchen Maestro" },
        { threshold: 900, emoji: "🚀", text: "900+ Ultimate Foodie" },
        { threshold: 1000, emoji: "🌍", text: "1000+ Global AI Chef" }
    ];

    let nextMedal = null;

    medals.forEach((medal) => {
        if (totalSearches >= medal.threshold) {
            achievementsList.innerHTML += `<li style="background: gold; color: black; font-weight: bold;">${medal.emoji} ${medal.text}</li>`;
        } else if (!nextMedal) {
            nextMedal = medal;
        }
    });

    // ✅ Show the next medal if there is one
    if (nextMedal) {
        achievementsList.innerHTML += `<li style="background: silver; color: black; font-weight: bold; opacity: 0.7;">🎯 Next: ${nextMedal.emoji} ${nextMedal.text} at ${nextMedal.threshold} searches</li>`;
    }
}
async function loadCookingChart(userId) {
    try {
        // ✅ Fetch total number of recipes searched by the user
        const recipesQuery = query(collection(db, "recipes"), where("userId", "==", userId));
        const recipesSnapshot = await getDocs(recipesQuery);
        const totalRecipes = recipesSnapshot.size;

        // ✅ Fetch total number of meals searched by the user
        const mealsQuery = query(collection(db, "meals"), where("userId", "==", userId));
        const mealsSnapshot = await getDocs(mealsQuery);
        const totalMeals = mealsSnapshot.size;

        // ✅ Calculate total searches
        const totalSearches = totalRecipes + totalMeals;

        // ✅ Update chart with fetched data
        const ctx = document.getElementById("cookingChart").getContext("2d");

        new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["Recipes", "Meals"],
                datasets: [{
                    data: [totalRecipes, totalMeals],
                    backgroundColor: ["#ff6384", "#36a2eb"]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "top"
                    }
                }
            }
        });

        console.log(`✅ Cooking chart updated: Recipes - ${totalRecipes}, Meals - ${totalMeals}`);
    } catch (error) {
        console.error("❌ Error loading cooking chart:", error);
    }
}

// ✅ Call the function when the user logs in
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadCookingChart(user.uid);
    }
});

// ✅ Function to Update User Rank in Firestore
async function updateUserRank(userId, totalSearches) {
    try {
        const rank =
            totalSearches >= 50 ? "Master Chef" :
            totalSearches >= 25 ? "Pro User" :
            totalSearches >= 10 ? "Intermediate Cook" :
            "Beginner";

        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { rank });

        document.getElementById("user-rank").textContent = `🏅 ${rank}`;
    } catch (error) {
        console.error("❌ Error updating user rank:", error);
    }
}

// ✅ Function to Load User Profile Picture from Firestore
async function loadUserProfilePicture(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().profilePicture) {
            document.getElementById("avatar").src = userDoc.data().profilePicture;
        }
    } catch (error) {
        console.error("❌ Error loading profile picture:", error);
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
        try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, { profilePicture: newAvatarUrl }, { merge: true });
            console.log("✅ Profile picture updated successfully.");
        } catch (error) {
            console.error("❌ Error updating profile picture:", error);
        }
    }
});
function goToMainPage() {
    window.location.href = "index.html";
}
// ✅ Load Data on Page Load
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
    // ✅ Add Event Listener to Main Page Button
    document.getElementById("main-page").addEventListener("click", goToMainPage);

});
