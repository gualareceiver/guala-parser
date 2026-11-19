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

// Пополнение баланса: те же пределы, что в боте (MIN_TOPUP_RUB, max_topup_rub()).
const TOPUP_MIN = 100;
const TOPUP_MAX = 9216;
const TOPUP_DEFAULT = 1000;

// Адрес оплаты на сервере бота. Пока его нет, кнопка «Оплатить» — заглушка.
const PAY_API_URL = "";
const BOT_URL = "https://t.me/gualaparser_bot";

const KIND_NOTES = {
  access: "Доступ на срок: все функции бота, каналов в отчётах сколько угодно. Если доступ уже есть, срок добавится к нему.",
  channels: "Пакет каналов: платите только за каналы, которые попали в отчёт. Остаток пакета не сгорает.",
  balance: "Пополнение баланса: его можно потратить в боте на доступ и пакеты каналов.",
};
const RECIPIENT_LABELS = { access: "Доступ получит", channels: "Пакет получит", balance: "Баланс пополнится у" };

const rub = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const rubFraction = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatRub = (value) => `${rub.format(value)} ₽`;

function unitNote(product) {
  if (product.kind === "access") return `${rub.format(Math.round(product.price / product.days))} ₽ в день`;
  return `${rubFraction.format(product.price / product.channels)} ₽ за канал`;
}

// Ник Telegram: 5–32 символа, латиница, цифры и «_», начинается с буквы.
// Принимаем и вставленные «@ник» или ссылку t.me/ник.
function normalizeUsername(raw) {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/^(t\.me|telegram\.me)\//i, "").replace(/^@/, "").split(/[/?#\s]/)[0];
}
const isUsername = (value) => /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value);

const params = new URLSearchParams(window.location.search);
const linkedRecipient = normalizeUsername(params.get("u") || "");
const recipientFromBot = isUsername(linkedRecipient) ? linkedRecipient : "";

let kind = "access";
let selected = PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT.access);
let amount = TOPUP_DEFAULT;
if (params.get("p") === "topup") {
  kind = "balance";
  const fromLink = Number.parseInt(params.get("a") || "", 10);
  if (Number.isFinite(fromLink)) amount = fromLink;
} else {
  const fromLink = PRODUCTS.find((p) => p.id === params.get("p"));
  if (fromLink) {
    selected = fromLink;
    kind = fromLink.kind;
  }
}

const $ = (id) => document.getElementById(id);
const segmented = document.querySelector(".segmented");
const tabs = segmented.querySelectorAll("button");
const panel = $("panel");
const amountPanel = $("amount-panel");
const amountInput = $("amount-input");
const amountField = amountInput.closest(".field");
const amountHint = $("amount-hint");
const chips = $("amount-chips").querySelectorAll("button");
const recipientBlock = $("recipient-block");
const recipientInput = $("recipient-input");
const recipientField = recipientInput.closest(".field");
const recipientHint = $("recipient-hint");
const recipientHintDefault = recipientHint.innerHTML;
const gift = $("gift");
const payButton = $("pay-button");
const orderHint = $("order-hint");

const methodChips = $("method-chips").querySelectorAll("button");

let recipientTouched = false;
let method = "sbp";
let stubShown = false;

function amountError() {
  if (!Number.isInteger(amount) || amount < TOPUP_MIN || amount > TOPUP_MAX) {
    return `Введите сумму от ${formatRub(TOPUP_MIN)} до ${formatRub(TOPUP_MAX)}.`;
  }
  return "";
}

function recipient() {
  return recipientFromBot || normalizeUsername(recipientInput.value);
}

function renderTabs() {
  segmented.dataset.kind = kind;
  tabs.forEach((tab) => {
    const active = tab.dataset.kind === kind;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $("kind-note").textContent = KIND_NOTES[kind];
  panel.hidden = kind === "balance";
  amountPanel.hidden = kind !== "balance";
}

function renderList() {
  panel.replaceChildren();
  if (kind === "balance") return;
  panel.setAttribute("aria-labelledby", `tab-${kind}`);
  PRODUCTS.filter((p) => p.kind === kind).forEach((product) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "choice";
    row.setAttribute("role", "radio");
    row.dataset.id = product.id;

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
    sub.style.display = "block";
    sub.textContent = unitNote(product);
    text.append(title, sub);

    const price = document.createElement("span");
    price.className = "choice-price";
    price.textContent = formatRub(product.price);

    row.append(radio, text, price);
    row.addEventListener("click", () => {
      selected = product;
      render();
    });
    panel.append(row);
  });
}

function renderSelection() {
  panel.querySelectorAll(".choice").forEach((row) => {
    const checked = row.dataset.id === selected.id;
    row.setAttribute("aria-checked", String(checked));
    row.tabIndex = checked ? 0 : -1;
  });
  chips.forEach((chip) => chip.setAttribute("aria-pressed", String(Number(chip.dataset.amount) === amount)));
}

function renderOrder() {
  const isBalance = kind === "balance";
  const total = isBalance ? amount : selected.price;
  const error = isBalance ? amountError() : "";

  $("order-title").textContent = isBalance
    ? "Пополнение баланса"
    : selected.kind === "access" ? `Доступ на ${selected.title}` : `Пакет ${selected.title}`;
  $("order-price").textContent = error ? "—" : formatRub(total);
  $("order-total").textContent = error ? "—" : formatRub(total);
  gift.hidden = isBalance || !selected.gift;

  amountHint.textContent = error || `От ${formatRub(TOPUP_MIN)} до ${formatRub(TOPUP_MAX)}.`;
  amountHint.classList.toggle("is-error", Boolean(error) && amountInput.value !== "");
  amountField.classList.toggle("is-invalid", Boolean(error) && amountInput.value !== "");

  const orderRecipient = $("order-recipient");
  if (recipientFromBot) {
    orderRecipient.hidden = false;
    orderRecipient.replaceChildren(
      `${RECIPIENT_LABELS[kind]} `,
      Object.assign(document.createElement("b"), { textContent: `@${recipientFromBot}` }),
    );
    recipientBlock.hidden = true;
  } else {
    orderRecipient.hidden = true;
    recipientBlock.hidden = false;
  }

  const name = recipient();
  const nameInvalid = !recipientFromBot && recipientTouched && !isUsername(name);
  recipientField.classList.toggle("is-invalid", nameInvalid);
  recipientHint.classList.toggle("is-error", nameInvalid);
  if (nameInvalid) {
    recipientHint.textContent = name
      ? "Ник — от 5 до 32 символов: латинские буквы, цифры и «_», первая — буква."
      : "Укажите ник, на который зачислить покупку.";
  } else {
    recipientHint.innerHTML = recipientHintDefault;
  }

  payButton.textContent = "Оплатить";
  payButton.removeAttribute("href");
  payButton.setAttribute("role", "button");
  payButton.tabIndex = 0;
  payButton.setAttribute("aria-disabled", String(Boolean(error)));
  methodChips.forEach((chip) => chip.setAttribute("aria-checked", String(chip.dataset.method === method)));
  if (!stubShown) orderHint.textContent = "";

  const url = new URL(window.location.href);
  if (isBalance) {
    url.searchParams.set("p", "topup");
    if (!error) url.searchParams.set("a", String(amount));
  } else {
    url.searchParams.set("p", selected.id);
    url.searchParams.delete("a");
  }
  window.history.replaceState(null, "", url);
}

function render() {
  renderSelection();
  renderOrder();
}

function switchKind(nextKind) {
  if (nextKind === kind) return;
  kind = nextKind;
  if (kind !== "balance") selected = PRODUCTS.find((p) => p.id === DEFAULT_PRODUCT[kind]);
  renderTabs();
  renderList();
  render();
}

const KIND_ORDER = ["access", "channels", "balance"];
tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchKind(tab.dataset.kind));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = KIND_ORDER[(KIND_ORDER.indexOf(kind) + step + KIND_ORDER.length) % KIND_ORDER.length];
    switchKind(next);
    segmented.querySelector(`[data-kind="${next}"]`).focus();
  });
});

panel.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const list = PRODUCTS.filter((p) => p.kind === kind);
  const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
  selected = list[(list.indexOf(selected) + step + list.length) % list.length];
  render();
  panel.querySelector(`[data-id="${selected.id}"]`).focus();
});

amountInput.addEventListener("input", () => {
  amountInput.value = amountInput.value.replace(/\D/g, "");
  amount = amountInput.value ? Number.parseInt(amountInput.value, 10) : Number.NaN;
  render();
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    amount = Number(chip.dataset.amount);
    amountInput.value = String(amount);
    render();
  });
});

recipientInput.addEventListener("input", () => {
  if (recipientTouched) render();
});
recipientInput.addEventListener("blur", () => {
  recipientTouched = recipientInput.value.trim() !== "" || recipientTouched;
  const name = normalizeUsername(recipientInput.value);
  if (name !== recipientInput.value) recipientInput.value = name;
  render();
});

methodChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    method = chip.dataset.method;
    render();
  });
});

function pay(event) {
  event.preventDefault();
  recipientTouched = true;
  stubShown = false;
  render();
  if (payButton.getAttribute("aria-disabled") === "true" || !isUsername(recipient())) {
    if (!recipientFromBot && !isUsername(recipient())) recipientInput.focus();
    return;
  }
  // Оплата через сервер бота подключается вместе с PAY_API_URL.
  stubShown = true;
  orderHint.replaceChildren(
    "Оплата на сайте скоро заработает. Пока оплатить можно ",
    Object.assign(document.createElement("a"), { href: BOT_URL, rel: "noopener", textContent: "в боте" }),
    ".",
  );
}

payButton.addEventListener("click", pay);
payButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") pay(event);
});

amountInput.value = String(amount);
renderTabs();
renderList();
render();
requestAnimationFrame(() => requestAnimationFrame(() => segmented.classList.add("is-ready")));
