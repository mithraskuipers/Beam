(() => {
  "use strict";

  const cameraPanel = document.getElementById("cameraPanel");
  const video = document.getElementById("cameraVideo");
  const flashEl = document.getElementById("cameraFlash");
  const controlsEl = document.getElementById("cameraControls");
  const shutterBtn = document.getElementById("shutterBtn");
  const flipBtn = document.getElementById("flipBtn");
  const closeCamBtn = document.getElementById("closeCamBtn");
  const cameraIdle = document.getElementById("cameraIdle");
  const cameraIdleNote = document.getElementById("cameraIdleNote");
  const photoModeBtn = document.getElementById("photoModeBtn");
  const videoModeBtn = document.getElementById("videoModeBtn");
  const recIndicator = document.getElementById("recIndicator");
  const recTimerEl = document.getElementById("recTimer");

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const queueSection = document.getElementById("queueSection");
  const queueEl = document.getElementById("queue");

  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");
  const toastStack = document.getElementById("toastStack");

  let currentStream = null;
  let facingMode = "environment";
  let captureMode = null; // "photo" | "video"
  let mediaRecorder = null;
  let recordedChunks = [];
  let recInterval = null;
  let recSeconds = 0;

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

  // ---------------------------------------------------------------- socket status

  const socket = io({ transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    statusPill.classList.add("online");
    statusText.textContent = "Connected";
  });
  socket.on("disconnect", () => {
    statusPill.classList.remove("online");
    statusText.textContent = "Offline";
  });

  // ---------------------------------------------------------------- camera

  async function startCamera(mode) {
    stopStreamOnly();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: captureMode === "video",
      });
      currentStream = stream;
      video.srcObject = stream;
      cameraPanel.classList.toggle("facing-environment", mode === "environment");
      controlsEl.hidden = false;
    } catch (err) {
      returnToIdle();
      cameraIdleNote.hidden = false;
    }
  }

  function stopStreamOnly() {
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }
  }

  function returnToIdle() {
    stopStreamOnly();
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    clearInterval(recInterval);
    recInterval = null;
    recIndicator.hidden = true;
    shutterBtn.classList.remove("recording");
    controlsEl.hidden = true;
    video.hidden = true;
    video.srcObject = null;
    cameraIdle.hidden = false;
    captureMode = null;
  }

  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    photoModeBtn.hidden = true;
    videoModeBtn.hidden = true;
    cameraIdleNote.hidden = false;
  }

  photoModeBtn.addEventListener("click", () => {
    captureMode = "photo";
    cameraIdle.hidden = true;
    cameraIdleNote.hidden = true;
    video.hidden = false;
    startCamera(facingMode);
  });

  videoModeBtn.addEventListener("click", () => {
    captureMode = "video";
    cameraIdle.hidden = true;
    cameraIdleNote.hidden = true;
    video.hidden = false;
    startCamera(facingMode);
  });

  closeCamBtn.addEventListener("click", returnToIdle);

  flipBtn.addEventListener("click", () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    startCamera(facingMode);
  });

  shutterBtn.addEventListener("click", () => {
    if (!currentStream) return;
    if (captureMode === "photo") {
      takePhoto();
    } else if (captureMode === "video") {
      toggleRecording();
    }
  });

  function takePhoto() {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    flashEl.classList.remove("flashing");
    void flashEl.offsetWidth;
    flashEl.classList.add("flashing");

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File([blob], `photo-${stamp}.jpg`, { type: "image/jpeg" });
        uploadFile(file);
        returnToIdle();
      },
      "image/jpeg",
      0.92
    );
  }

  function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      startRecording();
    } else {
      mediaRecorder.stop();
    }
  }

  function startRecording() {
    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    mediaRecorder = new MediaRecorder(currentStream, { mimeType });

    mediaRecorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `video-${stamp}.${ext}`, { type: mimeType });
      uploadFile(file);
      returnToIdle();
    });

    mediaRecorder.start();
    shutterBtn.classList.add("recording");
    recSeconds = 0;
    recTimerEl.textContent = "0:00";
    recIndicator.hidden = false;
    recInterval = setInterval(() => {
      recSeconds += 1;
      const m = Math.floor(recSeconds / 60);
      const s = recSeconds % 60;
      recTimerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
    }, 1000);
  }

  // ---------------------------------------------------------------- file picking

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    Array.from(fileInput.files).forEach(uploadFile);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files) Array.from(files).forEach(uploadFile);
  });

  // ---------------------------------------------------------------- upload

  function iconSvg(kind) {
    if (kind === "image") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
    }
    if (kind === "video") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  }

  const checkSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const errorSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function uploadFile(file) {
    queueSection.hidden = false;

    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
      ? "video"
      : "file";

    const row = document.createElement("div");
    row.className = "queue-item";
    row.innerHTML = `
      <div class="queue-thumb">${iconSvg(kind)}</div>
      <div class="queue-info">
        <div class="queue-name"></div>
        <div class="queue-bar-track"><div class="queue-bar-fill"></div></div>
      </div>
      <div class="queue-status">${iconSvg(kind)}</div>
    `;
    row.querySelector(".queue-name").textContent = file.name;
    queueEl.prepend(row);

    const thumb = row.querySelector(".queue-thumb");
    if (kind === "image") {
      thumb.innerHTML = "";
      const img = document.createElement("img");
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.src = URL.createObjectURL(file);
      thumb.appendChild(img);
    }

    const bar = row.querySelector(".queue-bar-fill");
    const statusIcon = row.querySelector(".queue-status");

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.max(4, Math.round((e.loaded / e.total) * 100));
        bar.style.width = pct + "%";
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        row.classList.add("done");
        statusIcon.innerHTML = checkSvg;
        toast(`Sent ${file.name}`);
      } else {
        row.classList.add("error");
        statusIcon.innerHTML = errorSvg;
        toast(`Couldn't send ${file.name}`);
      }
    });

    xhr.addEventListener("error", () => {
      row.classList.add("error");
      statusIcon.innerHTML = errorSvg;
      toast(`Couldn't send ${file.name}`);
    });

    xhr.send(formData);
  }
})();
