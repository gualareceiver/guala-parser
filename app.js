// Тарифы — те же, что в боте (services/billing.py). Меняете цену в боте —
// поменяйте и здесь.
const PRODUCTS = [
  { id: "access_2d", kind: "access", title: "2 дня", price: 249, days: 2 },
  { id: "access_1w", kind: "access", title: "1 неделя", price: 590, days: 7 },
  { id: "access_2w", kind: "access", title: "2 недели", price: 1090, days: 14 },
  { id: "access_1m", kind: "access", title: "1 месяц", price: 1990, days: 30, gift: true },
  { id: "access_2m", kind: "access", title: "2 месяца", price: 3490, days: 60 },
  { id: "access_3m", kind: "access", title: "3 месяца", price: 4890, days: 90 },
  { id: "ch_50", kind: "channels", title: "50 каналов", price: 99, channels: 50 },
  { id: "ch_100", kind: "channels", title: "100 каналов", price: 179, channels: 100 },
  { id: "ch_300", kind: "channels", title: "300 каналов", price: 449, channels: 300 },
  { id: "ch_500", kind: "channels", title: "500 каналов", price: 690, channels: 500 },
  { id: "ch_1000", kind: "channels", title: "1000 каналов", price: 1190, channels: 1000, gift: true },
  { id: "ch_2500", kind: "channels", title: "2500 каналов", price: 2490, channels: 2500 },
  { id: "ch_5000", kind: "channels", title: "5000 каналов", price: 4490, channels: 5000 },
];

const DEFAULT_PRODUCT = { access: "access_1m", channels: "ch_1000" };

// Адрес оплаты на сервере бота. Пока его нет, кнопка ведёт в бота.
const PAY_API_URL = "";
const BOT_URL = "https://t.me/gualaparser_bot";

const KIND_NOTES = {
  access: "Все функции бота, каналов в отчётах сколько угодно. Если доступ уже есть, срок добавится к нему.",
  channels: "Платите только за каналы, которые попали в отчёт. Остаток пакета не сгорает.",
};

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rubFraction = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatRub(value) {
  return `${rub.format(value)} ₽`;
}

function unitNote(product) {
  if (product.kind === "access") {
    return `${rub.format(Math.round(product.price / product.days))} ₽ в день`;
  }
  return `${rubFraction.format(product.price / product.channels)} ₽ за канал`;
}

function orderTitle(product) {
  return product.kind === "access" ? `Доступ на ${product.title}` : `Пакет ${product.title}`;
}

const params = new URLSearchParams(window.location.search);
const recipient = (params.get("u") || "").replace(/^@/, "");
const validRecipient = /^[A-Za-z0-9_]{3,32}$/.test(recipient) ? recipient : "";

let selected = PRODUCTS.find((p) => p.id === params.get("p")) || PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT.access);
let kind = selected.kind;

const segmented = document.querySelector(".segmented");
const tabs = segmented.querySelectorAll("button");
const panel = document.getElementById("panel");
const kindNote = document.getElementById("kind-note");
const gift = document.getElementById("gift");
const orderTitleEl = document.getElementById("order-title");
const orderPriceEl = document.getElementById("order-price");
const orderTotalEl = document.getElementById("order-total");
const orderRecipientEl = document.getElementById("order-recipient");
const payButton = document.getElementById("pay-button");
const orderHint = document.getElementById("order-hint");

function renderList() {
  segmented.dataset.kind = kind;
  tabs.forEach((tab) => {
    const active = tab.dataset.kind === kind;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panel.setAttribute("aria-labelledby", `tab-${kind}`);
  kindNote.textContent = KIND_NOTES[kind];

  panel.replaceChildren();
  PRODUCTS.filter((p) => p.kind === kind).forEach((product, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "choice";
    row.setAttribute("role", "radio");
    row.dataset.id = product.id;
    row.style.animationDelay = `${index * 35}ms`;

    const radio = document.createElement("span");
    radio.className = "radio";
    radio.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    const title = document.createElement("span");
    title.className = "choice-title";
    title.append(product.title);
    if (product.gift) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "С подарком";
      title.append(badge);
    }
    const sub = document.createElement("span");
    sub.className = "choice-sub";
    sub.textContent = unitNote(product);
    sub.style.display = "block";
    text.append(title, sub);

    const price = document.createElement("span");
    price.className = "choice-price";
    price.textContent = formatRub(product.price);

    row.append(radio, text, price);
    row.addEventListener("click", () => select(product));
    panel.append(row);
  });
  markSelected();
}

function markSelected() {
  panel.querySelectorAll(".choice").forEach((row) => {
    const checked = row.dataset.id === selected.id;
    row.setAttribute("aria-checked", String(checked));
    row.tabIndex = checked ? 0 : -1;
  });
}

function renderOrder() {
  orderTitleEl.textContent = orderTitle(selected);
  orderPriceEl.textContent = formatRub(selected.price);
  orderTotalEl.textContent = formatRub(selected.price);
  gift.hidden = !selected.gift;

  if (validRecipient) {
    orderRecipientEl.hidden = false;
    orderRecipientEl.replaceChildren(
      selected.kind === "access" ? "Доступ получит " : "Пакет получит ",
      Object.assign(document.createElement("b"), { textContent: `@${validRecipient}` }),
    );
  } else {
    orderRecipientEl.hidden = true;
  }

  if (PAY_API_URL) {
    payButton.textContent = "Оплатить";
    orderHint.textContent = "Способ оплаты — СБП или криптовалюту — выберете на следующем шаге.";
  } else {
    payButton.textContent = "Оплатить в боте";
    payButton.href = BOT_URL;
    orderHint.textContent = "Откройте в боте «Купить доступ» и выберите этот вариант.";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("p", selected.id);
  window.history.replaceState(null, "", url);
}

function select(product) {
  selected = product;
  markSelected();
  renderOrder();
}

function switchKind(nextKind) {
  if (nextKind === kind) return;
  kind = nextKind;
  selected = PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT[kind]);
  renderList();
  renderOrder();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchKind(tab.dataset.kind));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = kind === "access" ? "channels" : "access";
      switchKind(next);
      segmented.querySelector(`[data-kind="${next}"]`).focus();
    }
  });
});

panel.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const list = PRODUCTS.filter((p) => p.kind === kind);
  const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
  const index = (list.indexOf(selected) + step + list.length) % list.length;
  select(list[index]);
  panel.querySelector(`[data-id="${selected.id}"]`).focus();
});

renderList();
renderOrder();
