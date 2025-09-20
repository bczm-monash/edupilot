// instructors.js

// Get elements
const editBtn = document.getElementById("editToggle");
const overlay = document.getElementById("editOverlay");
const closeOverlayBtn = document.getElementById("closeOverlay");
const deleteBtn = document.getElementById("deleteSelected");
const selectAllChk = document.getElementById("selectAllChk");
const overlayBody = document.getElementById("overlayBody");

// Mock data (replace later with DB fetch)
const instructors = [
  { id: 1, name: "Mr. Chong", email: "chong@example.com" },
  { id: 2, name: "Dr. Kamala", email: "kamala@example.com" },
  { id: 3, name: "Dr. Fikri", email: "fikri@example.com" }
];

// Render instructor table in main page
function renderInstructors() {
  const list = document.getElementById("instructorList");
  list.innerHTML = "";
  instructors.forEach(inst => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="instructor-title">${inst.name}</td>
      <td class="instructor-email">${inst.email}</td>
      <td>
        <button class="delete-btn" onclick="removeInstructor(${inst.id})">Remove</button>
      </td>
    `;
    list.appendChild(row);
  });
}

// Render instructor list in overlay
function renderOverlayList() {
  overlayBody.innerHTML = "";
  instructors.forEach(inst => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <input type="checkbox" class="rowChk" data-id="${inst.id}">
      <span>${inst.name} (${inst.email})</span>
    `;
    overlayBody.appendChild(row);
  });
}

// Show overlay
editBtn.addEventListener("click", () => {
  renderOverlayList();
  overlay.style.display = "flex";
});

// Close overlay
closeOverlayBtn.addEventListener("click", () => {
  overlay.style.display = "none";
});

// Select all toggle
selectAllChk.addEventListener("change", (e) => {
  document.querySelectorAll(".rowChk").forEach(chk => {
    chk.checked = e.target.checked;
  });
});

// Remove one instructor (from table)
function removeInstructor(id) {
  // Remove from instructors array
  for (let i = instructors.length - 1; i >= 0; i--) {
    if (instructors[i].id === id) {
      instructors.splice(i, 1);
      break;
    }
  }

  // Re-render table & overlay
  renderInstructors();
  renderOverlayList();
}

// Delete selected (from overlay)
deleteBtn.addEventListener("click", () => {
  const selectedIds = Array.from(document.querySelectorAll(".rowChk:checked"))
    .map(chk => parseInt(chk.dataset.id));

  // Remove from instructors list
  for (let i = instructors.length - 1; i >= 0; i--) {
    if (selectedIds.includes(instructors[i].id)) {
      instructors.splice(i, 1);
    }
  }

  renderInstructors();
  renderOverlayList();
});

// Initial load
renderInstructors();
