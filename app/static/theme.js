const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("cad-theme");
if (savedTheme === "dark") root.classList.add("dark-ui");
toggle?.addEventListener("click", () => {
  root.classList.toggle("dark-ui");
  localStorage.setItem("cad-theme", root.classList.contains("dark-ui") ? "dark" : "light");
});
