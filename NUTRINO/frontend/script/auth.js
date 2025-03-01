// Google OAuth Client ID
const GOOGLE_CLIENT_ID = "219803626569-ss8k12eljbv6fi56rpff0jmm2309hot0.apps.googleusercontent.com";

// Initialize Google Authentication
function initGoogleAuth() {
    if (!window.google || !google.accounts) {
        console.error("Google API failed to load.");
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    // Render Sign-in Button
    const signInButton = document.getElementById("g-signin");
    if (signInButton) {
        google.accounts.id.renderButton(signInButton, {
            theme: "outline",
            size: "large"
        });
    } else {
        console.warn("Google sign-in button element not found.");
    }

    // Automatically prompt sign-in
    google.accounts.id.prompt();
}

// Handle Google Login Response
async function handleCredentialResponse(response) {
    try {
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
            localStorage.setItem("loggedInUser", userData.email);
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
    const loggedInUser = localStorage.getItem("loggedInUser");
    const userEmailElement = document.getElementById("user-email");

    if (loggedInUser) {
        if (userEmailElement) {
            userEmailElement.textContent = `Logged in as: ${loggedInUser}`;
        }
    } else {
        initGoogleAuth();
    }

    // Attach click event to Google Sign-In button
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
