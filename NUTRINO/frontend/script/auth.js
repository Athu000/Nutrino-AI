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

            updateAuthUI();
        }
    } catch (error) {
        console.error("Authentication Error:", error);
        displayError("Google authentication failed. Please try again.");
    }
}

// Update UI Elements Based on Login Status
function updateAuthUI() {
    const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const loginLink = document.getElementById("login-link");
    const signupLink = document.getElementById("signup-link");
    const userInfo = document.getElementById("user-info");
    const userEmailSpan = document.getElementById("user-email");
    const logoutButton = document.getElementById("logout-button");

    if (loggedInUser) {
        if (loginLink) loginLink.style.display = "none";
        if (signupLink) signupLink.style.display = "none";
        if (userInfo) userInfo.style.display = "flex";
        if (userEmailSpan) userEmailSpan.textContent = loggedInUser.name || loggedInUser.email;
        if (logoutButton) logoutButton.style.display = "inline-block";

        logoutButton.addEventListener("click", function () {
            localStorage.removeItem("loggedInUser");
            localStorage.removeItem("authToken");
            window.location.href = "index.html"; // Redirect after logout
        });
    } else {
        if (loginLink) loginLink.style.display = "block";
        if (signupLink) signupLink.style.display = "block";
        if (userInfo) userInfo.style.display = "none";
    }
}

// Run on page load
document.addEventListener("DOMContentLoaded", updateAuthUI);
