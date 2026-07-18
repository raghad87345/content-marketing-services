const listEl = document.getElementById("campaign-list");
const modal = document.getElementById("campaign-modal");
const form = document.getElementById("campaign-form");
const statusEl = document.getElementById("campaign-status");
const modalTitle = document.getElementById("modal-title");
const previewBox = document.getElementById("post-preview");

function openModal(campaign = null) {
  form.reset();
  statusEl.textContent = "";
  previewBox.classList.add("hidden");
  document.getElementById("campaign_id").value = campaign ? campaign.id : "";
  modalTitle.textContent = campaign ? "Edit Campaign" : "Add Campaign";

  if (campaign) {
    document.getElementById("post_id").value = campaign.post_id;
    document.getElementById("keywords").value = campaign.keywords;
    document.getElementById("comment_reply").value = campaign.comment_reply;
    document.getElementById("dm_message").value = campaign.dm_message;
    document.getElementById("active").checked = campaign.active;
    if (campaign.post_thumbnail_url) {
      showPreview(campaign.post_thumbnail_url, campaign.post_caption);
    }
  }
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

function showPreview(thumbnailUrl, caption) {
  if (!thumbnailUrl && !caption) {
    previewBox.classList.add("hidden");
    return;
  }
  document.getElementById("preview-thumb").src = thumbnailUrl || "";
  document.getElementById("preview-caption").textContent = caption || "(no caption)";
  previewBox.classList.remove("hidden");
}

document.getElementById("new-campaign-btn").addEventListener("click", () => openModal());
document.getElementById("close-modal-btn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.getElementById("post_id").addEventListener("blur", async (e) => {
  const postId = e.target.value.trim();
  if (!postId) return;
  try {
    const preview = await apiRequest(`/api/posts/${encodeURIComponent(postId)}/preview`);
    showPreview(preview.thumbnail_url, preview.caption);
  } catch (err) {
    previewBox.classList.add("hidden");
  }
});

async function loadCampaigns() {
  const campaigns = await apiRequest("/api/campaigns");
  listEl.innerHTML = "";

  if (campaigns.length === 0) {
    listEl.innerHTML = '<p class="muted">No campaigns yet. Click "Add Campaign" to create one.</p>';
    return;
  }

  campaigns.forEach((campaign) => {
    const card = document.createElement("div");
    card.className = "campaign-card";
    card.innerHTML = `
      <img src="${escapeHtml(campaign.post_thumbnail_url) || ""}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="info">
        <div class="post-id">Post: ${escapeHtml(campaign.post_id)}</div>
        <div class="keywords">Keywords: ${escapeHtml(campaign.keywords)}</div>
      </div>
      <span class="badge ${campaign.active ? "active" : "inactive"}">${campaign.active ? "Active" : "Inactive"}</span>
      <div class="actions">
        <button class="link-btn" data-action="toggle" data-id="${campaign.id}">${campaign.active ? "Pause" : "Activate"}</button>
        <button class="link-btn" data-action="edit" data-id="${campaign.id}">Edit</button>
        <button class="link-btn danger" data-action="delete" data-id="${campaign.id}">Delete</button>
      </div>
    `;
    listEl.appendChild(card);
    card.dataset.campaign = JSON.stringify(campaign);
  });

  listEl.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "toggle") {
        await apiRequest(`/api/campaigns/${id}/toggle`, { method: "PATCH" });
        loadCampaigns();
      } else if (action === "delete") {
        if (confirm("Delete this campaign?")) {
          await apiRequest(`/api/campaigns/${id}`, { method: "DELETE" });
          loadCampaigns();
        }
      } else if (action === "edit") {
        const campaign = JSON.parse(btn.closest(".campaign-card").dataset.campaign);
        openModal(campaign);
      }
    });
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.classList.remove("error");
  statusEl.textContent = "Saving...";

  const id = document.getElementById("campaign_id").value;
  const payload = {
    post_id: document.getElementById("post_id").value,
    keywords: document.getElementById("keywords").value,
    comment_reply: document.getElementById("comment_reply").value,
    dm_message: document.getElementById("dm_message").value,
    active: document.getElementById("active").checked,
  };

  try {
    if (id) {
      await apiRequest(`/api/campaigns/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await apiRequest("/api/campaigns", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    loadCampaigns();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.classList.add("error");
  }
});

loadCampaigns();
