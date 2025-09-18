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
  { id: 1, name: "Anoushka", email: "anoushka@example.com" },
  { id: 2, name: "Juno", email: "juno@example.com" },
  { id: 3, name: "Min Xuan", email: "minxuan@example.com" }
];

// Render instructor cards in main page
function renderInstructors() {
  const list = document.getElementById("instructorList");
  list.innerHTML = "";
  instructors.forEach(inst => {
    const li = document.createElement("li");
    li.className = "instructor-card";
    li.innerHTML = `
      <div class="instructor-title">${inst.name}</div>
      <div class="lesson-meta">Email: ${inst.email}</div>
      <button class="delete-btn">Remove</button>
    `;
    list.appendChild(li);
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

function removeInstructor(button) {
  // Find the card (or row) that contains this button
  let card = button.closest(".card"); // or ".instructor-card" depending on your CSS class
  
  // Remove the element from the DOM
  if (card) {
    card.remove();
  }
}

// Delete selected
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
