
async function loadFirebase() {
  try {
    // ✅ Load Firebase modules dynamically from Google's CDN
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
    const { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } = 
      await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

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

    // ✅ Google Sign-In Function
  window.signInWithGoogle = async function () {
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        localStorage.setItem("authToken", await user.getIdToken());
        localStorage.setItem("loggedInUser", JSON.stringify({ email: user.email, name: user.displayName }));

        window.location.href = "dashboard.html";
      } catch (error) {
        console.error("❌ Google Sign-In Error:", error.message);
        alert("Google Sign-In failed. Please try again.");
      }
    };


    // ✅ Logout Function
    window.logoutUser = function () {
      signOut(auth)
        .then(() => {
          localStorage.removeItem("authToken");
          localStorage.removeItem("loggedInUser");
          window.location.href = "index.html"; // Redirect to homepage after logout
        })
        .catch(error => {
          console.error("❌ Logout Error:", error.message);
          alert("Logout failed. Please try again.");
        });
    };

    // ✅ Auto-Check User Login Status & Update UI
    document.addEventListener("DOMContentLoaded", () => {
      const userEmailElement = document.getElementById("user-email");
      const authLinks = document.getElementById("auth-links");

      onAuthStateChanged(auth, (user) => {
        if (user) {
          if (userEmailElement) userEmailElement.textContent = `Logged in as: ${user.email}`;
          if (authLinks) authLinks.style.display = "none";
        } else {
          if (authLinks) authLinks.style.display = "block";
          if (userEmailElement) userEmailElement.textContent = "";
        }
      });
    });

    console.log("✅ Firebase Auth Loaded Successfully!");
  } catch (error) {
    console.error("❌ Firebase Load Error:", error);
  }
}

// ✅ Load Firebase dynamically when script runs
loadFirebase();
