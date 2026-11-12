import { $, firebaseConfig, ADMIN_UID, node } from "./shared.js";
import { validatePost, carCard, showCar, MAX_IMAGE_LENGTH } from "./garage.js";
let auth,
  images = [],
  records = [],
  currentId = null,
  etag = "null_etag",
  createdAt = null,
  busy = false,
  dirty = false,
  deleteTarget = null;
const fields = [
  "title",
  "description",
  "brand",
  "category",
  "year",
  "power",
  "setup",
  "fit",
  "tone",
];
function values() {
  return Object.fromEntries(fields.map((k) => [k, $(k).value]));
}
function preview() {
  const p = {
    ...values(),
    images,
    title: $("title").value || "O próximo projeto",
    brand: $("brand").value || "Minha garagem",
  };
  if (!images.length) p.previewImage = "assets/images/garage-banner.png";
  $("post-preview").replaceChildren(carCard(p, () => previewDetail()));
}
function previewDetail() {
  try {
    const p = validatePost({ ...values(), images });
    showCar(p, $("preview-detail-body"));
    $("preview-dialog").showModal();
  } catch (e) {
    $("save-feedback").textContent = e.message;
  }
}
$("close-preview").onclick = () => $("preview-dialog").close();
$("preview-detail").onclick = previewDetail;
$("post-form").addEventListener("input", () => {
  dirty = true;
  preview();
});
function lock(value) {
  busy = value;
  $("editor-fields").disabled = value;
  $("new-post").disabled = value;
  $("logout").disabled = value;
  document
    .querySelectorAll("[data-record-action]")
    .forEach((b) => (b.disabled = value));
}
function renderImages() {
  const list = $("upload-list");
  list.replaceChildren();
  images.forEach((src, i) => {
    const item = node("div", "upload-item"),
      img = node("img");
    img.src = src;
    img.alt = `Foto ${i + 1}`;
    const remove = node("button", "", "Remover");
    remove.type = "button";
    remove.dataset.remove = "";
    remove.onclick = () => {
      images.splice(i, 1);
      dirty = true;
      renderImages();
      preview();
    };
    item.append(img, node("span", "", i === 0 ? "CAPA" : `0${i + 1}`));
    if (i) {
      const cover = node("button", "", "Usar como capa");
      cover.type = "button";
      cover.onclick = () => {
        images.unshift(images.splice(i, 1)[0]);
        dirty = true;
        renderImages();
        preview();
      };
      item.append(cover);
    }
    item.append(remove);
    list.append(item);
  });
}
export async function optimizeImage(file) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw new Error("Use PNG, JPG ou WebP com até 12 MB por foto.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 60000000)
      throw new Error(
        "Esta foto tem resolução muito alta. Reduza para até 60 megapixels.",
      );
    let size = 1400;
    for (let pass = 0; pass < 5; pass++) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", 0.83 - pass * 0.08);
      if (data.length <= MAX_IMAGE_LENGTH) return data;
      size *= 0.8;
    }
    throw new Error(
      "Não foi possível otimizar esta foto. Tente uma versão menor.",
    );
  } finally {
    bitmap.close();
  }
}
$("photos").addEventListener("change", async () => {
  const files = [...$("photos").files];
  if (images.length + files.length > 4) {
    $("save-feedback").textContent = "Cada exposição aceita até 4 fotos.";
    $("photos").value = "";
    return;
  }
  lock(true);
  $("save-feedback").textContent = "Preparando suas fotos…";
  try {
    const additions = [];
    for (const file of files) additions.push(await optimizeImage(file));
    images.push(...additions);
    dirty = true;
    renderImages();
    preview();
    $("save-feedback").textContent =
      "Fotos prontas. Confira a prévia antes de publicar.";
  } catch (e) {
    $("save-feedback").textContent = e.message;
  } finally {
    $("photos").value = "";
    lock(false);
  }
});
async function request(path, options = {}) {
  const user = auth.currentUser;
  if (user?.uid !== ADMIN_UID) throw new Error("Entre com a conta autorizada.");
  const token = await user.getIdToken();
  const response = await fetch(
    `${firebaseConfig.databaseURL}/${path}.json?auth=${encodeURIComponent(token)}`,
    { cache: "no-store", ...options, signal: AbortSignal.timeout(20000) },
  );
  if (response.status === 412)
    throw new Error(
      "Esta exposição mudou em outra sessão. Reabra a exposição antes de salvar.",
    );
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "O banco não autorizou esta operação. Verifique se as regras da garagem foram publicadas e se sua conta está autorizada."
        : "Não foi possível confirmar no servidor. Confira a conexão e tente novamente.",
    );
  return response;
}
function clearEditor() {
  currentId = null;
  etag = "null_etag";
  createdAt = null;
  images = [];
  $("post-form").reset();
  dirty = false;
  $("editor-title").textContent = "Prepare a próxima exposição";
  $("publish").textContent = "Publicar exposição ↗";
  renderImages();
  preview();
}
function canLeave() {
  return (
    !dirty || window.confirm("Descartar as alterações ainda não publicadas?")
  );
}
$("new-post").onclick = () => {
  if (canLeave()) {
    clearEditor();
    $("save-feedback").textContent = "";
    $("title").focus();
  }
};
async function refresh() {
  try {
    const response = await request("garagePosts");
    records = Object.entries((await response.json()) || {})
      .map(([id, p]) => ({ ...p, id }))
      .sort((a, b) => b.createdAt - a.createdAt);
    $("data-status").textContent = "";
    renderRecords();
  } catch (e) {
    $("data-status").textContent = e.message;
  }
}
function renderRecords() {
  $("post-count").textContent = String(records.length);
  $("admin-posts").replaceChildren();
  if (!records.length)
    $("admin-posts").append(
      node("p", "muted", "Sua primeira exposição começa no editor acima."),
    );
  records.forEach((p) => {
    const row = node("article", "admin-record"),
      info = node("div"),
      actions = node("div", "admin-actions");
    info.append(
      node("h3", "", p.title),
      node(
        "p",
        "",
        `${p.category} · ${new Date(p.createdAt).toLocaleDateString("pt-BR")}`,
      ),
    );
    const edit = node("button", "button secondary", "Editar"),
      remove = node("button", "button secondary danger", "Excluir");
    edit.dataset.recordAction = "";
    remove.dataset.recordAction = "";
    edit.disabled = remove.disabled = busy;
    edit.onclick = () => editPost(p.id);
    remove.onclick = () => {
      deleteTarget = p;
      $("delete-description").textContent =
        `A exposição “${p.title}” será removida do site, junto com suas fotos.`;
      $("delete-feedback").textContent = "";
      $("delete-dialog").showModal();
    };
    actions.append(edit, remove);
    row.append(info, actions);
    $("admin-posts").append(row);
  });
}
async function editPost(id) {
  if (!canLeave()) return;
  lock(true);
  try {
    const response = await request(`garagePosts/${id}`, {
      headers: { "X-Firebase-ETag": "true" },
    });
    const p = await response.json();
    if (!p) throw new Error("Esta exposição já foi removida.");
    currentId = id;
    etag = response.headers.get("ETag");
    if (!etag)
      throw new Error(
        "Não foi possível obter a versão da exposição. Recarregue e tente novamente.",
      );
    createdAt = p.createdAt;
    fields.forEach((k) => ($(k).value = p[k] || ""));
    images = [...p.images];
    dirty = false;
    renderImages();
    preview();
    $("editor-title").textContent = "Editar exposição";
    $("publish").textContent = "Salvar alterações ↗";
    $("save-feedback").textContent = "";
    $("post-form").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    $("data-status").textContent = e.message;
  } finally {
    lock(false);
  }
}
$("post-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  let p;
  try {
    p = validatePost({ ...values(), images });
  } catch (error) {
    $("save-feedback").textContent = error.message;
    return;
  }
  lock(true);
  $("save-feedback").textContent = "Publicando na garagem…";
  currentId ||= crypto.randomUUID();
  try {
    const response = await request(`garagePosts/${currentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": etag },
      body: JSON.stringify({
        ...p,
        createdAt: createdAt || { ".sv": "timestamp" },
        updatedAt: { ".sv": "timestamp" },
        updatedBy: ADMIN_UID,
      }),
    });
    await response.json();
    clearEditor();
    $("save-feedback").textContent =
      "Exposição publicada! Já está disponível na garagem do site.";
    await refresh();
  } catch (error) {
    $("save-feedback").textContent =
      error.message + " Suas alterações continuam no editor.";
  } finally {
    lock(false);
  }
};
$("cancel-delete").onclick = () => $("delete-dialog").close();
$("delete-dialog").addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
$("confirm-delete").onclick = async () => {
  if (!deleteTarget || busy) return;
  lock(true);
  $("confirm-delete").disabled = $("cancel-delete").disabled = true;
  try {
    const response = await request(`garagePosts/${deleteTarget.id}`, {
      headers: { "X-Firebase-ETag": "true" },
    });
    const version = response.headers.get("ETag");
    if (!version)
      throw new Error("Não foi possível verificar a versão. Tente novamente.");
    const latest = await response.json();
    if (
      JSON.stringify(latest) !==
      JSON.stringify(
        Object.fromEntries(
          Object.entries(deleteTarget).filter(([k]) => k !== "id"),
        ),
      )
    ) {
      if (latest?.updatedAt !== deleteTarget.updatedAt)
        throw new Error(
          "A exposição mudou. Feche esta janela e recarregue a lista antes de excluir.",
        );
    }
    await request(`garagePosts/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "If-Match": version },
    });
    if (currentId === deleteTarget.id) clearEditor();
    $("delete-dialog").close();
    await refresh();
  } catch (e) {
    $("delete-feedback").textContent = e.message;
  } finally {
    lock(false);
    $("confirm-delete").disabled = $("cancel-delete").disabled = false;
  }
};
$("login-form").onsubmit = async (e) => {
  e.preventDefault();
  $("login-submit").disabled = true;
  $("login-error").textContent = "";
  try {
    await auth.signInWithEmailAndPassword(
      $("email").value.trim(),
      $("password").value,
    );
    $("password").value = "";
  } catch {
    $("login-error").textContent =
      "Não foi possível entrar. Confira o e-mail, a senha e sua conexão.";
  } finally {
    $("login-submit").disabled = false;
  }
};
$("reset-password").onclick = async () => {
  if (!$("email").reportValidity()) return;
  $("reset-password").disabled = true;
  try {
    auth.languageCode = "pt-BR";
    await auth.sendPasswordResetEmail($("email").value.trim());
    $("reset-feedback").textContent =
      "Se este e-mail estiver cadastrado, você receberá um link de redefinição.";
  } catch {
    $("reset-feedback").textContent =
      "Não foi possível solicitar o link. Tente novamente mais tarde.";
  } finally {
    $("reset-password").disabled = false;
  }
};
$("logout").onclick = async () => {
  if (!canLeave()) return;
  try {
    await auth.signOut();
    clearEditor();
  } catch {
    $("data-status").textContent = "Não foi possível sair. Tente novamente.";
  }
};
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
try {
  if (!window.firebase) throw new Error();
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  auth.onAuthStateChanged(async (user) => {
    const allowed = user?.uid === ADMIN_UID;
    $("login-section").hidden = allowed;
    $("admin-section").hidden = !allowed;
    $("logout").hidden = !allowed;
    if (!allowed) {
      records = [];
      images = [];
      dirty = false;
      $("admin-posts").replaceChildren();
      clearEditor();
      if (user) {
        $("login-error").textContent =
          "Esta conta não possui acesso à garagem.";
        await auth.signOut();
      }
      return;
    }
    await refresh();
  });
} catch {
  $("login-error").textContent =
    "Não foi possível carregar o acesso. Confira a conexão e recarregue a página.";
  $("login-submit").disabled = $("reset-password").disabled = true;
}
preview();
