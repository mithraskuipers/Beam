(() => {
  "use strict";

  const galleryEl = document.getElementById("gallery");
  const emptyState = document.getElementById("emptyState");
  const itemCountEl = document.getElementById("itemCount");
  const toastStack = document.getElementById("toastStack");

  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");

  const connectPanel = document.getElementById("connectPanel");
  const toggleConnectBtn = document.getElementById("toggleConnectBtn");
  const qrImg = document.getElementById("qrImg");
  const senderUrlEl = document.getElementById("senderUrl");

  const toggleSelectBtn = document.getElementById("toggleSelectBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const selectionBar = document.getElementById("selectionBar");
  const selCount = document.getElementById("selCount");
  const selDownloadBtn = document.getElementById("selDownloadBtn");
  const selDeleteBtn = document.getElementById("selDeleteBtn");
  const selCancelBtn = document.getElementById("selCancelBtn");

  const lightbox = document.getElementById("lightbox");
  const lightboxStage = document.getElementById("lightboxStage");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxCopyBtn = document.getElementById("lightboxCopyBtn");
  const lightboxDownloadBtn = document.getElementById("lightboxDownloadBtn");
  const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");

  let items = [];
  let selectMode = false;
  const selected = new Set();
  let lightboxIndex = -1;

  // ---------------------------------------------------------------- toasts

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 240);
    }, 2200);
  }

  // ---------------------------------------------------------------- helpers

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function extOf(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
  }

  const fileSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  const playSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>';
  const downloadSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';
  const copySvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const checkSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  // ---------------------------------------------------------------- rendering

  function updateCount() {
    itemCountEl.textContent = items.length === 1 ? "1 item" : `${items.length} items`;
    emptyState.hidden = items.length > 0;
  }

  function buildCard(item) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;

    let mediaHtml = "";
    if (item.category === "image") {
      mediaHtml = `<img class="card-media" src="${item.url}" alt="${escapeHtml(item.original_name)}" loading="lazy">`;
    } else if (item.category === "video") {
      mediaHtml = `<video class="card-media" src="${item.url}#t=0.5" preload="metadata" muted playsinline></video><div class="video-badge">${playSvg}</div>`;
    } else {
      mediaHtml = `<div class="file-face">${fileSvg}<span class="file-name">${escapeHtml(item.original_name)}</span><span class="file-ext">${extOf(item.original_name)}</span></div>`;
    }

    card.innerHTML = `
      <button class="card-hit" aria-label="Open ${escapeHtml(item.original_name)}"></button>
      ${mediaHtml}
      <div class="card-overlay"></div>
      <div class="card-checkbox">${checkSvg}</div>
      <div class="card-meta">${formatTime(item.timestamp)} · ${formatSize(item.size)}</div>
      <div class="card-quick-actions">
        <button class="qa-download" type="button" aria-label="Download">${downloadSvg}</button>
        ${item.category === "image" ? `<button class="qa-copy" type="button" aria-label="Copy to clipboard">${copySvg}</button>` : ""}
      </div>
    `;

    card.querySelector(".card-hit").addEventListener("click", () => onCardActivate(item.id));
    card.querySelector(".card-checkbox").addEventListener("click", (e) => {
      e.stopPropagation();
      onCardActivate(item.id);
    });
    card.querySelector(".qa-download").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadItem(item);
    });
    const qaCopy = card.querySelector(".qa-copy");
    if (qaCopy) {
      qaCopy.addEventListener("click", (e) => {
        e.stopPropagation();
        copyToClipboard(item);
      });
    }

    if (selectMode) card.classList.add("selecting");
    if (selected.has(item.id)) card.classList.add("selected");

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAll() {
    galleryEl.innerHTML = "";
    items.forEach((item) => galleryEl.appendChild(buildCard(item)));
    updateCount();
  }

  function prependItem(item) {
    items.unshift(item);
    const card = buildCard(item);
    galleryEl.prepend(card);
    updateCount();
  }

  function removeItemsByIds(ids) {
    const idSet = new Set(ids);
    items = items.filter((it) => !idSet.has(it.id));
    ids.forEach((id) => {
      selected.delete(id);
      const card = galleryEl.querySelector(`.card[data-id="${id}"]`);
      if (card) card.remove();
    });
    updateCount();
    updateSelectionBar();
  }

  // ---------------------------------------------------------------- selection

  function onCardActivate(id) {
    if (selectMode) {
      toggleSelect(id);
    } else {
      openLightbox(id);
    }
  }

  function toggleSelect(id) {
    const card = galleryEl.querySelector(`.card[data-id="${id}"]`);
    if (selected.has(id)) {
      selected.delete(id);
      if (card) card.classList.remove("selected");
    } else {
      selected.add(id);
      if (card) card.classList.add("selected");
    }
    updateSelectionBar();
  }

  function updateSelectionBar() {
    const n = selected.size;
    selCount.textContent = n === 1 ? "1 selected" : `${n} selected`;
    selectionBar.classList.toggle("visible", selectMode && n > 0);
  }

  function setSelectMode(on) {
    selectMode = on;
    galleryEl.classList.toggle("select-mode", on);
    toggleSelectBtn.textContent = on ? "Done" : "Select";
    toggleSelectBtn.classList.toggle("btn-primary", on);
    toggleSelectBtn.classList.toggle("btn-ghost", !on);
    if (!on) {
      selected.clear();
      galleryEl.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
    }
    galleryEl.querySelectorAll(".card").forEach((c) => c.classList.toggle("selecting", on));
    updateSelectionBar();
  }

  toggleSelectBtn.addEventListener("click", () => setSelectMode(!selectMode));
  selCancelBtn.addEventListener("click", () => setSelectMode(false));

  selDownloadBtn.addEventListener("click", async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    toast("Zipping files…");
    try {
      const res = await fetch("/api/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("zip failed");
      const blob = await res.blob();
      triggerBlobDownload(blob, "beam_files.zip");
      toast(`Downloaded ${ids.length} files`);
    } catch (err) {
      toast("Couldn't build the zip");
    }
  });

  selDeleteBtn.addEventListener("click", async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    try {
      await fetch("/api/delete-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      removeItemsByIds(ids);
      setSelectMode(false);
    } catch (err) {
      toast("Couldn't delete those files");
    }
  });

  clearAllBtn.addEventListener("click", async () => {
    if (items.length === 0) return;
    if (!confirm("Remove all received files? This can't be undone.")) return;
    try {
      await fetch("/api/clear", { method: "POST" });
      items = [];
      selected.clear();
      galleryEl.innerHTML = "";
      updateCount();
      updateSelectionBar();
    } catch (err) {
      toast("Couldn't clear the gallery");
    }
  });

  // ---------------------------------------------------------------- download / copy

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadItem(item) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.original_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`Downloading ${item.original_name}`);
  }

  async function copyToClipboard(item) {
    if (!window.isSecureContext || !navigator.clipboard || !window.ClipboardItem) {
      toast("Copy needs this page opened via localhost or https");
      return;
    }
    try {
      const res = await fetch(item.url);
      const srcBlob = await res.blob();
      // Clipboard image writes are commonly limited to PNG - convert if needed.
      const pngBlob = await toPngBlob(srcBlob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      toast("Copied to clipboard");
    } catch (err) {
      toast("Couldn't copy, downloading instead");
      downloadItem(item);
    }
  }

  function toPngBlob(blob) {
    if (blob.type === "image/png") return Promise.resolve(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("convert failed"))), "image/png");
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // ---------------------------------------------------------------- lightbox

  function openLightbox(id) {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    lightboxIndex = idx;
    renderLightbox();
    lightbox.classList.add("open");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightboxStage.innerHTML = "";
  }

  function stepLightbox(delta) {
    if (items.length === 0) return;
    lightboxIndex = (lightboxIndex + delta + items.length) % items.length;
    renderLightbox();
  }

  function renderLightbox() {
    const item = items[lightboxIndex];
    if (!item) return closeLightbox();
    lightboxTitle.textContent = item.original_name;
    lightboxStage.innerHTML = "";

    if (item.category === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.original_name;
      lightboxStage.appendChild(img);
      lightboxCopyBtn.hidden = false;
    } else if (item.category === "video") {
      const video = document.createElement("video");
      video.src = item.url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      lightboxStage.appendChild(video);
      lightboxCopyBtn.hidden = true;
    } else {
      const wrap = document.createElement("div");
      wrap.className = "lightbox-file";
      wrap.innerHTML = `${fileSvg}<div>${escapeHtml(item.original_name)}</div><div style="opacity:.6;font-size:12.5px;">${formatSize(item.size)}</div>`;
      lightboxStage.appendChild(wrap);
      lightboxCopyBtn.hidden = true;
    }
  }

  lightboxCloseBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  lightboxPrev.addEventListener("click", () => stepLightbox(-1));
  lightboxNext.addEventListener("click", () => stepLightbox(1));
  lightboxDownloadBtn.addEventListener("click", () => {
    const item = items[lightboxIndex];
    if (item) downloadItem(item);
  });
  lightboxCopyBtn.addEventListener("click", () => {
    const item = items[lightboxIndex];
    if (item) copyToClipboard(item);
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  // ---------------------------------------------------------------- connect panel

  toggleConnectBtn.addEventListener("click", () => {
    connectPanel.hidden = !connectPanel.hidden;
  });

  fetch("/api/info")
    .then((r) => r.json())
    .then((info) => {
      senderUrlEl.textContent = info.sender_url.replace(/^https?:\/\//, "");
      qrImg.src = "/api/qr";
    })
    .catch(() => {});

  // ---------------------------------------------------------------- socket + initial load

  const socket = io({ transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    statusPill.classList.add("online");
    statusText.textContent = "Live";
  });
  socket.on("disconnect", () => {
    statusPill.classList.remove("online");
    statusText.textContent = "Offline";
  });

  socket.on("new_item", (item) => {
    prependItem(item);
    const label = item.category === "image" ? "New photo" : item.category === "video" ? "New video" : "New file";
    toast(`${label} received`);
  });

  socket.on("items_deleted", (data) => {
    removeItemsByIds(data.ids || []);
  });

  socket.on("items_cleared", () => {
    items = [];
    selected.clear();
    galleryEl.innerHTML = "";
    updateCount();
    updateSelectionBar();
  });

  fetch("/api/items")
    .then((r) => r.json())
    .then((data) => {
      items = data;
      renderAll();
    })
    .catch(() => {
      toast("Couldn't load received files");
    });
})();
