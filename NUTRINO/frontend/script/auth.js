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

            // Redirect user after login
            window.location.href = "dashboard.html";
        }
    } catch (error) {
        console.error("Authentication Error:", error);
        displayError("Google authentication failed. Please try again.");
    }
}

// Update UI for login/logout state
document.addEventListener("DOMContentLoaded", () => {
    const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
    const loginLink = document.getElementById("login-link");
    const signupButton = document.getElementById("signup-link")?.querySelector("button");
    const userNameSpan = document.getElementById("user-name");
    const logoutButton = document.getElementById("logout-button");

    if (loggedInUser) {
        // Change Sign Up button to username
        if (signupButton) {
            signupButton.textContent = loggedInUser.name || loggedInUser.email;
            signupButton.disabled = true;
        }

        // Change Login to Logout
        if (loginLink) {
            loginLink.textContent = "Logout";
            loginLink.href = "#";
            loginLink.addEventListener("click", () => logoutUser());
        }

        // Show Logout button
        if (logoutButton) {
            logoutButton.style.display = "inline-block";
            logoutButton.addEventListener("click", () => logoutUser());
        }

        // Display user info
        if (userNameSpan) userNameSpan.innerText = `Welcome, ${loggedInUser.name || loggedInUser.email}`;
    }
});

// Logout function
function logoutUser() {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    window.location.href = "index.html"; // Redirect after logout
}

// Function to Display Error Messages in UI
function displayError(message) {
    alert(message);
}
