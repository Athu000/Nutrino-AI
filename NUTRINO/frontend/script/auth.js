// Google OAuth Client ID
const GOOGLE_CLIENT_ID = "219803626569-ss8k12eljbv6fi56rpff0jmm2309hot0.apps.googleusercontent.com";

let googleAuthInitialized = false; // Prevent multiple calls

function initGoogleAuth() {
    if (googleAuthInitialized) return; // Prevent duplicate calls
    googleAuthInitialized = true;

    if (!window.google || !google.accounts) {
        console.error("Google API failed to load.");
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID, 
        callback: handleCredentialResponse
    });

    // Render Google sign-in button
    const signInButton = document.getElementById("g-signin");
    if (signInButton) {
        google.accounts.id.renderButton(signInButton, { theme: "outline", size: "large" });
    } else {
        console.warn("Google sign-in button element not found.");
    }

    // Automatically prompt sign-in (Only once)
    setTimeout(() => {
        if (google.accounts.id) {
            google.accounts.id.prompt();
        }
    }, 1000);
}

// Handle Google Login Response
async function handleCredentialResponse(response) {
    try {
        if (typeof jwt_decode === "undefined") {
            console.error("jwt_decode is not loaded.");
            displayError("Authentication failed. Please refresh and try again.");
            return;
        }

        const userData = jwt_decode(response.credential);

        if (userData.email) {
            console.log("User Data:", userData);

            // Send token to backend for verification
            const backendResponse = await fetch("https://nutrino-ai.onrender.com/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: response.credential })
            });

            const result = await backendResponse.json();
            if (!backendResponse.ok) {
                throw new Error(result.error || "Google authentication failed.");
            }

            // Save user details in local storage
            localStorage.setItem("loggedInUser", JSON.stringify({
                email: userData.email,
                name: userData.name,
                picture: userData.picture || "" 
            }));
            localStorage.setItem("authToken", response.credential);

            // Redirect user after login
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error("Authentication Error:", error);
        displayError("Google authentication failed. Please try again.");
    }
}

// Check User Login Status on Page Load
document.addEventListener("DOMContentLoaded", () => {
    const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const authLinks = document.getElementById("auth-links");
    const userInfo = document.getElementById("user-info");
    const userNameSpan = document.getElementById("user-name");
    const userProfilePic = document.getElementById("user-profile-pic");
    const logoutButton = document.getElementById("logout-button");

    if (loggedInUser) {
        // Hide login/signup links
        if (authLinks) authLinks.style.display = "none";

        // Show user info
        if (userInfo) userInfo.style.display = "flex";
        if (userNameSpan) userNameSpan.innerText = `Welcome, ${loggedInUser.name || loggedInUser.email}`;
        
        // Display profile picture if available
        if (loggedInUser.picture && userProfilePic) {
            userProfilePic.src = loggedInUser.picture;
            userProfilePic.style.display = "block";
        }

        // Show logout button
        if (logoutButton) {
            logoutButton.style.display = "inline-block";
            logoutButton.addEventListener("click", function () {
                localStorage.removeItem("loggedInUser");
                localStorage.removeItem("authToken");
                window.location.href = "index.html"; // Redirect after logout
            });
        }
    } else {
        // Show login/signup buttons if user is not logged in
        if (authLinks) authLinks.style.display = "block";
        if (userInfo) userInfo.style.display = "none";
        
        initGoogleAuth();
    }

    // Ensure Google Sign-In Button Works
    setTimeout(() => {
        const googleSignInButton = document.getElementById("google-signin-btn");
        if (googleSignInButton) {
            googleSignInButton.addEventListener("click", (event) => {
                event.preventDefault();
                if (google.accounts.id) {
                    google.accounts.id.prompt();
                } else {
                    console.error("Google authentication is not initialized.");
                }
            });
        } else {
            console.warn("Google Sign-In button not found.");
        }
    }, 500);
});

// Function to Display Error Messages in UI
function displayError(message) {
    alert(message); // Replace with a UI-based error display if needed
}
