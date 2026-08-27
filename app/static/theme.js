const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("cad-theme");
if (savedTheme === "dark") root.classList.add("dark-ui");
toggle?.addEventListener("click", () => {
  root.classList.toggle("dark-ui");
  localStorage.setItem("cad-theme", root.classList.contains("dark-ui") ? "dark" : "light");
});

const navToggle = document.getElementById("nav-toggle");
const topbarNav = document.getElementById("topbar-nav");
navToggle?.addEventListener("click", () => {
  const open = topbarNav.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!topbarNav?.classList.contains("nav-open")) return;
  if (topbarNav.contains(event.target) || navToggle.contains(event.target)) return;
  topbarNav.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
});
topbarNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => topbarNav.classList.remove("nav-open"));
});

const accountToggle = document.getElementById("account-toggle");
const accountPanel = document.getElementById("account-panel");
accountToggle?.addEventListener("click", () => {
  const open = accountPanel.classList.toggle("open");
  accountToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!accountPanel?.classList.contains("open")) return;
  if (accountPanel.contains(event.target) || accountToggle.contains(event.target)) return;
  accountPanel.classList.remove("open");
  accountToggle.setAttribute("aria-expanded", "false");
});
