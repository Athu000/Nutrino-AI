const API_BASE_URL = "https://nutrino-ai.onrender.com/api";

// ✅ Fetch Recipe Function
export async function fetchRecipe(prompt) {
  const authToken = localStorage.getItem("authToken");

  if (!authToken) {
    alert("Authentication required. Please log in.");
    window.location.href = "login.html";
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/fetch-recipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Recipe fetch failed");

    return data;
  } catch (error) {
    console.error("❌ API Error:", error.message);
    alert("Error fetching recipe. Try again.");
    return null;
  }
}
