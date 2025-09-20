// list_students.js

// Get elements
const editBtn = document.getElementById("editToggle");
const overlay = document.getElementById("editOverlay");
const closeOverlayBtn = document.getElementById("closeOverlay");
const deleteBtn = document.getElementById("deleteSelected");
const selectAllChk = document.getElementById("selectAllChk");
const overlayBody = document.getElementById("overlayBody");

// Mock data (replace later with DB fetch)
const students = [
  { id: 1, name: "Anoushka", email: "anoushka@example.com" },
  { id: 2, name: "Juno", email: "juno@example.com" },
  { id: 3, name: "Min Xuan", email: "minxuan@example.com" }
];

// Render student rows in the main table
function renderStudents() {
  const list = document.getElementById("studentList");
  list.innerHTML = "";
  students.forEach(stu => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${stu.name}</td>
      <td>${stu.email}</td>
      <td>
        <button class="delete-btn" onclick="removeStudent(${stu.id})">Remove</button>
      </td>
    `;
    list.appendChild(tr);
  });
}

// Render student list in overlay (checkbox list)
function renderOverlayList() {
  overlayBody.innerHTML = "";
  students.forEach(stu => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <input type="checkbox" class="rowChk" data-id="${stu.id}">
      <span>${stu.name} (${stu.email})</span>
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

// Remove a single student by button
function removeStudent(id) {
  const index = students.findIndex(s => s.id === id);
  if (index !== -1) {
    students.splice(index, 1);
    renderStudents();
    renderOverlayList();
  }
}

// Delete selected (from overlay)
deleteBtn.addEventListener("click", () => {
  const selectedIds = Array.from(document.querySelectorAll(".rowChk:checked"))
    .map(chk => parseInt(chk.dataset.id));

  for (let i = students.length - 1; i >= 0; i--) {
    if (selectedIds.includes(students[i].id)) {
      students.splice(i, 1);
    }
  }

  renderStudents();
  renderOverlayList();
});

// Initial load
renderStudents();
