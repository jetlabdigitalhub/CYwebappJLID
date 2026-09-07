const menuToggle = document.querySelector("[data-menu-toggle]");
const sidebar = document.querySelector("[data-sidebar]");
if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}
document.querySelectorAll("[data-confirm-delete]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm("Hapus tugas ini?")) event.preventDefault();
  });
});
