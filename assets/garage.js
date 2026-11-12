import { firebaseConfig, node } from "./shared.js";
export const CATEGORIES = ["Esportivos", "Clássicos", "Projetos"];
export const MAX_IMAGE_LENGTH = 420000;
export function safeImage(value) {
  return (
    typeof value === "string" &&
    value.length <= MAX_IMAGE_LENGTH &&
    /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}
export function validatePost(raw) {
  const post = {};
  for (const [key, min, max] of [
    ["title", 2, 80],
    ["description", 10, 3000],
    ["brand", 1, 60],
    ["power", 0, 40],
    ["year", 0, 20],
    ["setup", 0, 100],
  ]) {
    post[key] = String(raw[key] || "").trim();
    if (post[key].length < min || post[key].length > max)
      throw new Error(
        "Revise o título, a marca, a história e os limites dos campos.",
      );
  }
  if (!CATEGORIES.includes(raw.category))
    throw new Error("Selecione uma categoria.");
  if (
    !["contain", "cover"].includes(raw.fit) ||
    !["dark", "light", "warm"].includes(raw.tone)
  )
    throw new Error("Selecione a apresentação das fotos.");
  if (
    !Array.isArray(raw.images) ||
    raw.images.length < 1 ||
    raw.images.length > 4 ||
    !raw.images.every(safeImage)
  )
    throw new Error("Adicione de 1 a 4 fotos válidas.");
  return {
    ...post,
    category: raw.category,
    fit: raw.fit,
    tone: raw.tone,
    images: [...raw.images],
  };
}
export function photoVisual(post, index = 0) {
  const box = node("div", "car-visual");
  box.dataset.fit = post.fit;
  box.dataset.tone = post.tone;
  const img = node("img");
  img.alt = `${post.title} — foto ${index + 1}`;
  img.loading = "lazy";
  if (safeImage(post.images?.[index]) || post.previewImage)
    img.src = post.previewImage || post.images[index];
  box.append(img);
  return box;
}
export function carCard(post, onOpen) {
  const card = node("article", "car-card"),
    button = node("button", "car-open");
  button.type = "button";
  button.setAttribute("aria-label", `Ver exposição: ${post.title}`);
  const visual = photoVisual(post);
  visual.append(node("span", "car-badge", post.category));
  const caption = node("div", "car-caption"),
    text = node("div");
  text.append(
    node("p", "", `${post.brand} / CPM2`),
    node("h3", "", post.title),
  );
  caption.append(text, node("span", "car-arrow", "↗"));
  button.append(visual, caption);
  button.addEventListener("click", () => onOpen?.(post));
  card.append(button);
  return card;
}
export function showCar(post, target) {
  let index = 0;
  const visual = photoVisual(post);
  visual.classList.add("detail-photo");
  const body = node("div", "detail-body"),
    title = node("h2", "", post.title);
  title.id = "car-title";
  body.append(
    node("p", "eyebrow", `${post.category} / ${post.brand}`),
    title,
    node("p", "", post.description),
  );
  const specs = node("dl", "specs");
  for (const [label, value] of [
    ["Marca", post.brand],
    ["Ano", post.year],
    ["Potência no jogo", post.power],
    ["Preparação", post.setup],
    ["Universo", "CPM2"],
  ])
    if (value) {
      const group = node("div");
      group.append(node("dt", "", label), node("dd", "", value));
      specs.append(group);
    }
  body.append(specs);
  target.replaceChildren(visual);
  if (post.images.length > 1) {
    const nav = node("div", "photo-nav"),
      prev = node("button", "", "←"),
      next = node("button", "", "→"),
      count = node("span", "", "1 / " + post.images.length);
    prev.setAttribute("aria-label", "Foto anterior");
    next.setAttribute("aria-label", "Próxima foto");
    count.setAttribute("aria-live", "polite");
    const move = (step) => {
      index = (index + step + post.images.length) % post.images.length;
      visual.querySelector("img").src = post.images[index];
      visual.querySelector("img").alt = `${post.title} — foto ${index + 1}`;
      count.textContent = `${index + 1} / ${post.images.length}`;
    };
    prev.onclick = () => move(-1);
    next.onclick = () => move(1);
    nav.append(prev, count, next);
    target.append(nav);
  }
  target.append(body);
}
export async function readPosts() {
  const response = await fetch(
    `${firebaseConfig.databaseURL}/garagePosts.json`,
    { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "permission"
        : "network",
    );
  return Object.entries((await response.json()) || {})
    .map(([id, p]) => ({ ...p, id }))
    .filter((p) => {
      try {
        validatePost(p);
        return true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
