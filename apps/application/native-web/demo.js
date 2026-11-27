const menu = [
  ["American pizza", 24, "american.webp"],
  ["Margherita", 19, "margherita-cutout.webp"],
  ["Classic Margherita", 18, "margherita-cutout.webp"],
  ["Double Pepperoni", 26, "american.webp"],
  ["Basil pizza", 21, "margherita-cutout.webp"],
  ["Spicy pizza", 23, "american.webp"],
];
const screen = document.querySelector("#screen");
const money = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
const storageKey = "yespiz.offline-demo";
const state = JSON.parse(localStorage.getItem(storageKey) || '{"basket":{},"orders":[]}');

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}
function rows() {
  return menu.flatMap(([name, price], id) => {
    const quantity = state.basket[id];
    return quantity ? [{ id, name, price, quantity }] : [];
  });
}
function total() {
  return rows().reduce((sum, item) => sum + item.price * item.quantity, 0);
}
function updateNav(page) {
  const count = rows().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector("#basket-link").textContent = count ? `Basket (${count})` : "Basket";
  document.querySelectorAll("nav a").forEach(link => {
    if (link.hash === "#" + page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
function renderMenu() {
  screen.innerHTML = `<section class="hero"><img src="margherita-cutout.webp" alt=""><h1>Margherita<br>Pizza love.</h1><button data-add="1">Add · €19</button></section>
    <h2>Pizza menu</h2><input type="search" aria-label="Search pizza" placeholder="What are you craving?"><div class="grid"></div>`;
  const grid = screen.querySelector(".grid");
  const search = screen.querySelector("input");
  function filter() {
    grid.innerHTML = menu.map(([name, price, image], id) => name.toLowerCase().includes(search.value.trim().toLowerCase())
      ? `<article class="card"><img src="${image}" alt=""><h2>${name}</h2><div class="line"><strong>${money.format(price)}</strong><button data-add="${id}" aria-label="Add ${name}">Add</button></div></article>` : "").join("")
      || "<p>No pizzas found.</p>";
  }
  search.addEventListener("input", filter);
  filter();
}
function renderBasket() {
  const items = rows();
  screen.innerHTML = "<h1>Basket</h1>";
  if (!items.length) {
    screen.insertAdjacentHTML("beforeend", '<p>Your basket is empty.</p><a href="#menu">Browse pizzas</a>');
    return;
  }
  screen.insertAdjacentHTML("beforeend", items.map(({ id, name, price, quantity }) => `
    <article class="card line"><div><h2>${name}</h2><strong>${money.format(price * quantity)}</strong></div>
    <div class="line"><button class="secondary" data-remove="${id}" aria-label="Remove one ${name}">−</button>${quantity}
    <button class="secondary" data-add="${id}" aria-label="Add one ${name}">+</button></div></article>`).join(""));
  screen.insertAdjacentHTML("beforeend", `<form class="card"><h2>Total · ${money.format(total())}</h2>
    <p>Demo checkout. No payment is collected.</p><button type="submit">Place demo order</button></form>`);
  screen.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    state.orders.unshift({ time: Date.now(), items: rows(), total: total() });
    state.basket = {};
    save();
    location.hash = "orders";
  });
}
function renderOrders() {
  screen.innerHTML = "<h1>Orders</h1>" + (state.orders.map(order => `
    <article class="card"><h2>Demo order placed</h2><p>${new Date(order.time).toLocaleString()}</p>
    <p>${order.items.map(item => `${item.quantity} × ${item.name}`).join(", ")}</p><strong>${money.format(order.total)}</strong></article>`).join("") || "<p>No orders yet.</p>");
}
function pageName() {
  const page = location.hash.slice(1);
  return page === "basket" || page === "orders" ? page : "menu";
}
function render() {
  const page = pageName();
  ({ menu: renderMenu, basket: renderBasket, orders: renderOrders })[page]();
  updateNav(page);
}
screen.addEventListener("click", event => {
  const button = event.target.closest("[data-add], [data-remove]");
  if (!button) return;
  const id = button.dataset.add ?? button.dataset.remove;
  const quantity = (state.basket[id] || 0) + (button.hasAttribute("data-add") ? 1 : -1);
  if (quantity > 0) state.basket[id] = quantity;
  else delete state.basket[id];
  save();
  if (pageName() === "basket") renderBasket();
  updateNav(pageName());
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});
render();
