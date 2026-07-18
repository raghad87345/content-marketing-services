const form = document.getElementById("settings-form");
const statusEl = document.getElementById("settings-status");
const tokenHint = document.getElementById("token-hint");

async function loadConfig() {
  try {
    const config = await apiRequest("/api/config");
    document.getElementById("page_id").value = config.page_id || "";
    document.getElementById("instagram_business_account_id").value =
      config.instagram_business_account_id || "";
    tokenHint.textContent = config.has_token
      ? `Current token on file: ${config.access_token_masked}`
      : "No token saved yet.";
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.classList.add("error");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = "Saving...";

  const payload = {
    access_token: document.getElementById("access_token").value || null,
    page_id: document.getElementById("page_id").value,
    instagram_business_account_id: document.getElementById("instagram_business_account_id").value,
  };

  try {
    await apiRequest("/api/config", { method: "POST", body: JSON.stringify(payload) });
    statusEl.textContent = "Saved.";
    document.getElementById("access_token").value = "";
    loadConfig();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.classList.add("error");
  }
});

loadConfig();
