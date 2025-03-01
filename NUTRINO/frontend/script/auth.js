// Load Google API
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

    google.accounts.id.renderButton(
        document.getElementById("g-signin"),
        { theme: "outline", size: "large" }
    );
}

// Handle Google Login Response
function handleCredentialResponse(response) {
    try {
        const userData = jwt_decode(response.credential);
        if (userData.email) {
            localStorage.setItem("loggedInUser", userData.email);
            window.location.href = "dashboard.html"; // Redirect after login
        }
    } catch (error) {
        console.error("Error decoding token:", error);
        alert("Google authentication failed.");
    }
}

// Check User Login Status
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

    // Ensure Google Sign-In Button Works
    const googleSignInButton = document.getElementById("google-signin-btn");
    if (googleSignInButton) {
        googleSignInButton.addEventListener("click", (event) => {
            event.preventDefault();
            google.accounts.id.prompt();
        });
    }
});
