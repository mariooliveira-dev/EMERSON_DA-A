/**
 * EMERSON CARVALHO — PORTFÓLIO PROFISSIONAL
 * JavaScript Puro (Vanilla JS) integrado exclusivamente ao Supabase
 * (Supabase Auth + Supabase Storage + Banco PostgreSQL / RLS)
 */

import { createClient } from "@supabase/supabase-js";

// ==========================================================================
// CONFIGURAÇÃO DO SUPABASE (APENAS SUPABASE_URL E SUPABASE_ANON_KEY)
// ==========================================================================

const STORAGE_BUCKET = "portfolio-emerson";
const LS_URL_KEY = "emerson_supabase_url";
const LS_ANON_KEY = "emerson_supabase_anon_key";

const AppState = {
  supabase: null,
  supabaseUrl: "",
  supabaseAnonKey: "",
  secretKeyDetected: false,
  session: null,
  authSubscription: null,
  currentFilter: "all",
  publicMediaItems: [],
  adminMediaItems: [],
  uploadedFilesQueue: [],
  identityState: {},
  pendingIdentitySlotKey: null,
  isLoadingPublic: false
};

const FRAMING_PRESETS = {
  top: { label: "Topo (prioriza rosto)", css: "center 15%" },
  upper: { label: "Retrato Superior", css: "center 28%" },
  center: { label: "Centralizado", css: "center center" },
  lower: { label: "Inferior", css: "center 75%" }
};

const SITE_IDENTITY_SLOTS = [
  {
    key: "hero",
    label: "Capa Principal (Hero)",
    hint: "Imagem em destaque na tela inicial do portfólio.",
    imgId: "heroPhotoImg",
    defaultPosKey: "upper"
  },
  {
    key: "perfil",
    label: "Foto de Perfil (Sobre Mim)",
    hint: "Retrato exibido na seção Minha Trajetória na Dança.",
    imgId: "aboutPhotoImg",
    defaultPosKey: "upper"
  },
  {
    key: "pagodao",
    label: "Capa — Pagodão",
    hint: "Imagem de capa do card Pagodão em Estilos de Dança.",
    imgId: "styleCoverPagodao",
    defaultPosKey: "center"
  },
  {
    key: "funk",
    label: "Capa — Funk",
    hint: "Imagem de capa do card Funk em Estilos de Dança.",
    imgId: "styleCoverFunk",
    defaultPosKey: "center"
  },
  {
    key: "jazz",
    label: "Capa — Jazz Contemporâneo",
    hint: "Imagem de capa do card Jazz Contemporâneo.",
    imgId: "styleCoverJazz",
    defaultPosKey: "center"
  },
  {
    key: "afro",
    label: "Capa — Afro",
    hint: "Imagem de capa do card Afro em Estilos de Dança.",
    imgId: "styleCoverAfro",
    defaultPosKey: "center"
  }
];

function isSecretSupabaseKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();

  // Novo formato de chave secreta do Supabase
  if (trimmed.startsWith("sb_secret_")) {
    return true;
  }

  // Formato JWT legado: verificar claim "role" no payload
  const parts = trimmed.split(".");
  if (parts.length === 3) {
    try {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      if (payload && (payload.role === "service_role" || payload.role === "supabase_admin")) {
        return true;
      }
    } catch (_) {
      // Ignora erros de decodificação caso não seja um JWT padrão
    }
  }

  return false;
}

function resolveSupabaseCredentials() {
  AppState.secretKeyDetected = false;

  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
    "";
  let envAnonKey =
    (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
    "";

  if (isSecretSupabaseKey(envAnonKey)) {
    AppState.secretKeyDetected = true;
    envAnonKey = "";
  }

  const savedUrl = localStorage.getItem(LS_URL_KEY) || "";
  let savedAnonKey = localStorage.getItem(LS_ANON_KEY) || "";

  if (isSecretSupabaseKey(savedAnonKey)) {
    localStorage.removeItem(LS_ANON_KEY);
    AppState.secretKeyDetected = true;
    savedAnonKey = "";
  }

  return {
    url: (envUrl || savedUrl).trim().replace(/\/+$/, ""),
    anonKey: (envAnonKey || savedAnonKey).trim(),
    fromEnv: Boolean(envUrl && envAnonKey)
  };
}

function initSupabaseClient() {
  const { url, anonKey, fromEnv } = resolveSupabaseCredentials();
  AppState.supabaseUrl = url;
  AppState.supabaseAnonKey = anonKey;
  AppState.credentialsFromEnv = fromEnv;

  if (AppState.secretKeyDetected && !anonKey) {
    showToast(
      "Chave secreta removida por segurança. Use apenas a chave pública (anon / sb_publishable_...).",
      "warning"
    );
  }

  if (!url || !anonKey) {
    AppState.supabase = null;
    AppState.session = null;
    return false;
  }

  try {
    AppState.supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    return true;
  } catch (err) {
    console.error("Erro ao inicializar cliente Supabase:", err);
    AppState.supabase = null;
    return false;
  }
}

// ==========================================================================
// CANVAS DE PARTÍCULAS E ILUMINAÇÃO DE PALCO (HERO)
// ==========================================================================

function isReducedMotionPreferred() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function initStageParticleCanvas() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas || !canvas.parentElement) return;

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = canvas.parentElement.offsetWidth);
  let height = (canvas.height = canvas.parentElement.offsetHeight);

  const reducedMotion = isReducedMotionPreferred();
  const particleCount = Math.min(32, Math.max(12, Math.floor(width / 36)));
  const particles = [];

  const colors = [
    "rgba(234, 179, 8, 0.55)",
    "rgba(168, 85, 247, 0.45)",
    "rgba(139, 92, 246, 0.35)",
    "rgba(255, 255, 255, 0.25)"
  ];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45 - 0.12,
      size: Math.random() * 2.4 + 0.9,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  function drawStageFrame() {
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width * 0.7,
      height * 0.3,
      20,
      width * 0.7,
      height * 0.3,
      width * 0.6
    );
    gradient.addColorStop(0, "rgba(139, 92, 246, 0.08)");
    gradient.addColorStop(0.5, "rgba(234, 179, 8, 0.03)");
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!reducedMotion) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    if (!reducedMotion) {
      requestAnimationFrame(drawStageFrame);
    }
  }

  window.addEventListener("resize", () => {
    if (!canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
    if (reducedMotion) drawStageFrame();
  });

  drawStageFrame();
}

// ==========================================================================
// GALERIA PÚBLICA CONECTADA AO SUPABASE (LEITURA PÚBLICA VIA RLS)
// ==========================================================================

async function loadPublicGallery() {
  const container = document.getElementById("galleryGrid");
  if (!container) return;

  if (!AppState.supabase) {
    AppState.publicMediaItems = [];
    renderPublicGallery();
    return;
  }

  AppState.isLoadingPublic = true;
  container.innerHTML = `
    <div class="gallery-loading-state">
      <div class="spinner-ring" aria-hidden="true"></div>
      <p>Carregando trabalhos em movimento...</p>
    </div>
  `;

  try {
    const { data, error } = await AppState.supabase
      .from("midias")
      .select("id, titulo, descricao, categoria, arquivo_url, tipo, data_publicacao, publicado")
      .eq("publicado", true)
      .order("data_publicacao", { ascending: false });

    if (error) {
      throw error;
    }

    AppState.publicMediaItems = data || [];
  } catch (err) {
    console.error("Erro ao carregar galeria pública do Supabase:", err);
    AppState.publicMediaItems = [];
    const errMsg = String(err && err.message ? err.message : err);
    if (errMsg.toLowerCase().includes("secret api key") || errMsg.toLowerCase().includes("forbidden")) {
      localStorage.removeItem(LS_ANON_KEY);
      AppState.supabase = null;
      AppState.supabaseAnonKey = "";
      AppState.secretKeyDetected = true;
      showToast(
        "Chave secreta bloqueada pelo Supabase. Substitua pela chave pública (anon / sb_publishable_...) na Área do Artista.",
        "error"
      );
    } else {
      showToast("Não foi possível carregar as mídias do Supabase.", "error");
    }
  } finally {
    AppState.isLoadingPublic = false;
    renderPublicGallery();
  }
}

function renderPublicGallery() {
  const container = document.getElementById("galleryGrid");
  if (!container) return;

  let filtered = AppState.publicMediaItems;
  const filter = AppState.currentFilter;

  if (filter === "foto") {
    filtered = filtered.filter((item) => item.tipo === "foto");
  } else if (filter === "video") {
    filtered = filtered.filter((item) => item.tipo === "video");
  } else if (filter !== "all") {
    filtered = filtered.filter((item) => item.categoria === filter);
  }

  if (filtered.length === 0) {
    const isConnected = Boolean(AppState.supabase);
    const message = isConnected
      ? "Nenhuma fotografia ou vídeo publicado nesta categoria ainda."
      : "Galeria pronta para exibir fotografias e vídeos assim que o projeto Supabase for conectado na Área do Artista.";

    container.innerHTML = `
      <div class="gallery-empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <h4 style="font-family: var(--font-display); font-size: 1.15rem; margin-bottom: 8px;">Galeria em Atualização</h4>
        <p style="color: var(--text-muted); font-size: 0.92rem; max-width: 460px;">${escapeHtml(message)}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const isVideo = item.tipo === "video";
      const dateStr = formatDisplayDate(item.data_publicacao);

      return `
        <article class="media-card" data-id="${escapeHtml(item.id)}">
          <div class="media-thumb-wrapper" data-media-id="${escapeHtml(item.id)}" role="button" tabindex="0" aria-label="${escapeHtml(item.titulo)}">
            ${
              isVideo
                ? `
              <video src="${escapeHtml(item.arquivo_url)}" preload="metadata" muted playsinline></video>
              <div class="media-play-overlay">
                <div class="media-play-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
              </div>
              <div class="media-type-badge video">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                Vídeo
              </div>
            `
                : `
              <img src="${escapeHtml(item.arquivo_url)}" alt="${escapeHtml(item.titulo)} — ${escapeHtml(item.categoria)}" loading="lazy" decoding="async" />
              <div class="media-type-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                Foto
              </div>
            `
            }
          </div>
          <div class="media-card-body">
            <div class="media-card-header">
              <h3 class="media-card-title">${escapeHtml(item.titulo)}</h3>
              <span class="media-card-date">${escapeHtml(dateStr)}</span>
            </div>
            <div class="media-card-meta">${escapeHtml(item.categoria)}</div>
            ${item.descricao ? `<p class="media-card-desc">${escapeHtml(item.descricao)}</p>` : ""}
            <div class="media-card-footer">
              <button type="button" class="media-view-btn" data-media-id="${escapeHtml(item.id)}">
                ${isVideo ? "Assistir Vídeo" : "Ampliar Imagem"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-media-id]").forEach((el) => {
    const openItem = () => handlePublicMediaClick(el.getAttribute("data-media-id"));
    el.addEventListener("click", openItem);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openItem();
      }
    });
  });
}

function handlePublicMediaClick(id) {
  const item = AppState.publicMediaItems.find((m) => m.id === id);
  if (!item) return;

  if (item.tipo === "video") {
    openVideoModal(item.arquivo_url, item.titulo);
  } else {
    openLightbox(item);
  }
}

// ==========================================================================
// VISUALIZADORES: LIGHTBOX (FOTO) & MODAL PLAYER (VÍDEO)
// ==========================================================================

let lastFocusedBeforeModal = null;

function restoreModalFocus() {
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === "function") {
    lastFocusedBeforeModal.focus();
  }
  lastFocusedBeforeModal = null;
}

function openLightbox(item) {
  const modal = document.getElementById("lightboxModal");
  const img = document.getElementById("lightboxImg");
  const title = document.getElementById("lightboxTitle");
  const meta = document.getElementById("lightboxMeta");

  if (!modal || !img) return;
  lastFocusedBeforeModal = document.activeElement;

  img.src = item.arquivo_url;
  img.alt = `${item.titulo} — ${item.categoria}`;
  title.textContent = item.titulo;
  meta.textContent = `${item.categoria} · ${formatDisplayDate(item.data_publicacao)}${item.descricao ? ` — ${item.descricao}` : ""}`;

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  const closeBtn = modal.querySelector(".lightbox-close");
  if (closeBtn) closeBtn.focus();
}

function closeLightbox() {
  const modal = document.getElementById("lightboxModal");
  const img = document.getElementById("lightboxImg");
  const wasOpen = modal && modal.classList.contains("open");
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
  if (img) img.src = "";
  if (wasOpen) restoreModalFocus();
}

function openVideoModal(url, title) {
  const modal = document.getElementById("videoModal");
  const player = document.getElementById("videoPlayer");
  const caption = document.getElementById("videoTitle");

  if (!modal || !player) return;
  lastFocusedBeforeModal = document.activeElement;

  player.src = url;
  if (caption) caption.textContent = title || "Vídeo de Coreografia";

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  const closeBtn = modal.querySelector(".video-close");
  if (closeBtn) closeBtn.focus();
  player.play().catch(() => {});
}

function closeVideoModal() {
  const modal = document.getElementById("videoModal");
  const player = document.getElementById("videoPlayer");
  const wasOpen = modal && modal.classList.contains("open");
  if (player) {
    player.pause();
    player.src = "";
  }
  if (modal) {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
  if (wasOpen) restoreModalFocus();
}

// ==========================================================================
// PAINEL ADMINISTRATIVO PROTEGIDO (SUPABASE AUTH + STORAGE + CRUD)
// ==========================================================================

function setupAdminPanel() {
  const trigger = document.getElementById("adminAccessTrigger");
  const modal = document.getElementById("adminModal");
  const closeBtn = document.getElementById("closeAdminModal");
  const closeFooterBtn = document.getElementById("closeAdminFooterBtn");

  const openModal = async () => {
    lastFocusedBeforeModal = document.activeElement;
    await syncAdminModalView();
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  };

  const closeModal = () => {
    const wasOpen = modal && modal.classList.contains("open");
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (wasOpen) restoreModalFocus();
  };

  if (trigger) trigger.addEventListener("click", openModal);

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
      e.preventDefault();
      openModal();
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener("click", closeModal);

  // Salvar configuração SUPABASE_URL + SUPABASE_ANON_KEY
  const saveConfigBtn = document.getElementById("saveSupabaseConfigBtn");
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener("click", async () => {
      const urlInput = document.getElementById("setupSupabaseUrl");
      const keyInput = document.getElementById("setupSupabaseAnonKey");
      const url = urlInput.value.trim().replace(/\/+$/, "");
      const anonKey = keyInput.value.trim();

      if (!url || !anonKey) {
        showToast("Informe SUPABASE_URL e SUPABASE_ANON_KEY.", "warning");
        return;
      }

      if (!/^https:\/\/.+\..+/.test(url)) {
        showToast("URL do Supabase inválida. Deve começar com https://", "warning");
        return;
      }

      if (isSecretSupabaseKey(anonKey)) {
        showToast(
          "Chave secreta detectada (sb_secret_ ou service_role). Por segurança, informe apenas a chave pública (anon / sb_publishable_...).",
          "error"
        );
        keyInput.value = "";
        return;
      }

      localStorage.setItem(LS_URL_KEY, url);
      localStorage.setItem(LS_ANON_KEY, anonKey);

      initSupabaseClient();
      setupAuthListener();
      await Promise.all([loadPublicGallery(), loadSiteIdentityFromSupabase()]);
      await syncAdminModalView();
      showToast("Conexão com Supabase configurada!", "success");
    });
  }

  // Botão na tela de login para testar conexão pública antes do login
  const testPublicBtn = document.getElementById("adminTestPublicBtn");
  if (testPublicBtn) {
    testPublicBtn.addEventListener("click", runPublicConnectionCheck);
  }

  // Botão na tela de login para ajustar URL/Key se necessário
  const showConfigBtn = document.getElementById("adminShowConfigBtn");
  if (showConfigBtn) {
    showConfigBtn.addEventListener("click", () => {
      showAdminSetupView();
    });
  }

  // Login Administrador (E-mail e Senha)
  const loginForm = document.getElementById("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!AppState.supabase) {
        showAdminSetupView();
        return;
      }

      const email = document.getElementById("adminLoginEmail").value.trim();
      const password = document.getElementById("adminLoginPassword").value;
      const submitBtn = document.getElementById("adminLoginSubmitBtn");

      submitBtn.disabled = true;
      submitBtn.textContent = "Autenticando...";

      try {
        const { data, error } = await AppState.supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        AppState.session = data.session;
        document.getElementById("adminLoginPassword").value = "";
        showToast("Login realizado com sucesso!", "success");
        await syncAdminModalView();
      } catch (err) {
        console.error("Erro no login:", err);
        const raw = err && err.message ? err.message : "";
        const friendly =
          raw.toLowerCase().includes("invalid login credentials")
            ? "E-mail ou senha inválidos."
            : raw || "Não foi possível autenticar no Supabase.";
        showToast(friendly, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Entrar no Painel";
      }
    });
  }

  // Tabs do Dashboard
  document.querySelectorAll(".admin-tab-btn").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateAdminTab(tab.dataset.pane);
    });
  });

  // Logout
  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (AppState.supabase) {
        await AppState.supabase.auth.signOut();
      }
      AppState.session = null;
      const valList = document.getElementById("supabaseValidationList");
      if (valList) {
        valList.innerHTML = "";
        valList.style.display = "none";
      }
      const pubCheck = document.getElementById("adminPublicCheckResult");
      if (pubCheck) {
        pubCheck.textContent = "";
        pubCheck.style.display = "none";
      }
      await syncAdminModalView();
      showToast("Sessão encerrada.", "success");
    });
  }

  // Reconfigurar credenciais Supabase
  const reconfigBtn = document.getElementById("adminReconfigureSupabaseBtn");
  if (reconfigBtn) {
    reconfigBtn.addEventListener("click", () => {
      const valList = document.getElementById("supabaseValidationList");
      if (valList) {
        valList.innerHTML = "";
        valList.style.display = "none";
      }
      showAdminSetupView();
    });
  }

  // Validação real completa das 7 operações Supabase
  const runValidationBtn = document.getElementById("runSupabaseValidationBtn");
  if (runValidationBtn) {
    runValidationBtn.addEventListener("click", runFullSupabaseValidation);
  }

  // Upload & Publicação
  setupAdminUploadControls();

  // Gerenciar / Editar / Excluir
  setupAdminManageControls();

  // Identidade Visual & Capas das Modalidades
  setupAdminIdentityControls();
}

function activateAdminTab(paneId) {
  document.querySelectorAll(".admin-tab-btn").forEach((t) => {
    t.classList.toggle("active", t.dataset.pane === paneId);
  });
  document.querySelectorAll(".admin-tab-pane").forEach((p) => {
    p.classList.toggle("active", p.id === paneId);
  });
  if (paneId === "adminPaneManage") {
    loadAdminMediaList();
  } else if (paneId === "adminPaneIdentity") {
    renderIdentitySlotsManager();
  }
}

function showAdminSetupView() {
  document.getElementById("adminSetupView").style.display = "flex";
  document.getElementById("adminLoginView").style.display = "none";
  document.getElementById("adminDashboardView").style.display = "none";
  document.getElementById("setupSupabaseUrl").value = AppState.supabaseUrl || "";
  document.getElementById("setupSupabaseAnonKey").value = AppState.supabaseAnonKey || "";
  document.getElementById("adminHeaderSubtitle").textContent = "Passo 1: Conecte seu projeto Supabase";
}

async function syncAdminModalView() {
  const setupView = document.getElementById("adminSetupView");
  const loginView = document.getElementById("adminLoginView");
  const dashboardView = document.getElementById("adminDashboardView");
  const subtitle = document.getElementById("adminHeaderSubtitle");

  if (!AppState.supabase) {
    showAdminSetupView();
    return;
  }

  const { data } = await AppState.supabase.auth.getSession();
  AppState.session = data ? data.session : null;

  if (!AppState.session) {
    setupView.style.display = "none";
    loginView.style.display = "flex";
    dashboardView.style.display = "none";
    subtitle.textContent = "Login restrito ao administrador";
    return;
  }

  setupView.style.display = "none";
  loginView.style.display = "none";
  dashboardView.style.display = "block";
  subtitle.textContent = `Autenticado: ${AppState.session.user.email}`;

  const emailDisplay = document.getElementById("adminUserEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = AppState.session.user.email || "—";

  const uidDisplay = document.getElementById("adminUserUidDisplay");
  if (uidDisplay) uidDisplay.textContent = AppState.session.user.id || "—";

  const sourceDisplay = document.getElementById("adminCredentialSourceDisplay");
  if (sourceDisplay) {
    if (AppState.credentialsFromEnv) {
      sourceDisplay.style.color = "#4ade80";
      sourceDisplay.textContent =
        "Origem da conexão: Variáveis de ambiente (VITE_SUPABASE_*). Pronto para publicação — qualquer visitante verá a galeria e capas automaticamente.";
    } else {
      sourceDisplay.style.color = "var(--accent-gold)";
      sourceDisplay.textContent =
        "Origem da conexão: Apenas localStorage deste navegador. Antes de publicar na internet, defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente/Secrets para que todos os dispositivos carreguem a galeria.";
    }
  }

  await loadAdminMediaList();
}

function setupAuthListener() {
  if (!AppState.supabase) return;
  if (AppState.authSubscription) {
    AppState.authSubscription.unsubscribe();
    AppState.authSubscription = null;
  }

  const { data } = AppState.supabase.auth.onAuthStateChange((event, session) => {
    AppState.session = session;
    if (event === "SIGNED_OUT") {
      const editForm = document.getElementById("adminEditMediaForm");
      if (editForm) editForm.style.display = "none";
    }
  });
  AppState.authSubscription = data ? data.subscription : null;
}

// ==========================================================================
// UPLOAD PARA SUPABASE STORAGE + INSERÇÃO NA TABELA MIDIAS
// ==========================================================================

function setupAdminUploadControls() {
  const dropzone = document.getElementById("uploadDropzone");
  const fileInput = document.getElementById("fileInput");
  const saveBtn = document.getElementById("saveUploadBtn");
  const clearBtn = document.getElementById("clearUploadQueueBtn");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      handleSelectedFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener("change", (e) => {
      handleSelectedFiles(e.target.files);
      fileInput.value = "";
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", resetUploadForm);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", handlePublishUploads);
  }
}

function resolveMimeType(file) {
  if (file && file.type) return file.type;
  const name = (file && file.name ? file.name : "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function handleSelectedFiles(files) {
  if (!files || files.length === 0) return;

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];

  Array.from(files).forEach((file) => {
    const mime = resolveMimeType(file);
    const isImage = allowedImageTypes.includes(mime) || mime.startsWith("image/");
    const isVideo = allowedVideoTypes.includes(mime) || mime.startsWith("video/");

    if (!isImage && !isVideo) {
      showToast(`Formato não suportado: ${file.name}. Use JPG, PNG, WEBP, MP4 ou WEBM.`, "warning");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast(`Arquivo excede 100MB: ${file.name}.`, "warning");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    AppState.uploadedFilesQueue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      tipo: isVideo ? "video" : "foto",
      previewUrl,
      file
    });
  });

  renderUploadPreviews();
}

function renderUploadPreviews() {
  const container = document.getElementById("uploadPreviews");
  if (!container) return;

  if (AppState.uploadedFilesQueue.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = AppState.uploadedFilesQueue
    .map(
      (item, index) => `
      <div class="preview-thumb-box">
        ${
          item.tipo === "video"
            ? `<video src="${item.previewUrl}" muted playsinline></video>`
            : `<img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" />`
        }
        <button type="button" class="preview-thumb-remove" data-remove-index="${index}" title="Remover da seleção">✕</button>
      </div>
    `
    )
    .join("");

  container.querySelectorAll("[data-remove-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-index"));
      const removed = AppState.uploadedFilesQueue.splice(idx, 1)[0];
      if (removed && removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderUploadPreviews();
    });
  });
}

function resetUploadForm() {
  AppState.uploadedFilesQueue.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
  AppState.uploadedFilesQueue = [];
  renderUploadPreviews();

  const titleInput = document.getElementById("uploadTitle");
  const descInput = document.getElementById("uploadDesc");
  const publishedCheckbox = document.getElementById("uploadPublishedCheckbox");
  if (titleInput) titleInput.value = "";
  if (descInput) descInput.value = "";
  if (publishedCheckbox) publishedCheckbox.checked = true;

  updateUploadProgress(false, 0, "");
}

function updateUploadProgress(active, percent, label) {
  const wrap = document.getElementById("uploadProgressWrap");
  const fill = document.getElementById("uploadProgressFill");
  const pct = document.getElementById("uploadProgressPercent");
  const lbl = document.getElementById("uploadProgressLabel");

  if (!wrap) return;
  wrap.classList.toggle("active", active);
  if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (pct) pct.textContent = `${Math.round(percent)}%`;
  if (lbl && label) lbl.textContent = label;
}

function uploadFileToSupabaseWithProgress(file, storagePath, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const encodedPath = storagePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const endpoint = `${AppState.supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", AppState.supabaseAnonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", resolveMimeType(file));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let msg = `Falha no upload (${xhr.status})`;
        try {
          const errJson = JSON.parse(xhr.responseText);
          if (errJson.message || errJson.error) {
            msg = `${errJson.message || errJson.error} (HTTP ${xhr.status})`;
          }
        } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede ao enviar arquivo ao Supabase Storage."));
    xhr.send(file);
  });
}

function sanitizeFileName(name) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? "." + parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 48);
  return `${base || "arquivo"}${ext}`;
}

function normalizeCategorySlug(category) {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

async function handlePublishUploads() {
  if (!AppState.supabase || !AppState.session) {
    showToast("Faça login como administrador para publicar mídias.", "error");
    return;
  }

  if (AppState.uploadedFilesQueue.length === 0) {
    showToast("Selecione pelo menos uma foto ou vídeo antes de publicar.", "warning");
    return;
  }

  const titleInput = document.getElementById("uploadTitle");
  const categorySelect = document.getElementById("uploadCategory");
  const descInput = document.getElementById("uploadDesc");
  const publishedCheckbox = document.getElementById("uploadPublishedCheckbox");
  const saveBtn = document.getElementById("saveUploadBtn");

  const baseTitle = titleInput && titleInput.value.trim() ? titleInput.value.trim() : "Registro Artístico";
  const categoria = categorySelect ? categorySelect.value : "Shows";
  const descricao = descInput ? descInput.value.trim() : "";
  const publicado = publishedCheckbox ? publishedCheckbox.checked : true;

  const { data: sessionData } = await AppState.supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    showToast("Sessão expirada. Faça login novamente.", "error");
    await syncAdminModalView();
    return;
  }

  saveBtn.disabled = true;
  const total = AppState.uploadedFilesQueue.length;

  try {
    for (let i = 0; i < total; i++) {
      const item = AppState.uploadedFilesQueue[i];
      const safeName = sanitizeFileName(item.name);
      const folder = normalizeCategorySlug(categoria);
      const storagePath = `${folder}/${Date.now()}-${i}-${safeName}`;

      updateUploadProgress(
        true,
        (i / total) * 100,
        `Enviando arquivo ${i + 1} de ${total} para o Supabase...`
      );

      await uploadFileToSupabaseWithProgress(item.file, storagePath, accessToken, (fraction) => {
        const overall = ((i + fraction) / total) * 100;
        updateUploadProgress(
          true,
          overall,
          `Enviando arquivo ${i + 1} de ${total} (${Math.round(fraction * 100)}%)`
        );
      });

      const { data: publicUrlData } = AppState.supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const titulo = total > 1 ? `${baseTitle} (${i + 1})` : baseTitle;

      const { data: insertedRows, error: insertError } = await AppState.supabase
        .from("midias")
        .insert({
          titulo,
          descricao,
          categoria,
          arquivo_url: publicUrlData.publicUrl,
          tipo: item.tipo,
          data_publicacao: new Date().toISOString(),
          publicado
        })
        .select("id");

      if (insertError || !insertedRows || insertedRows.length === 0) {
        // Reverte o arquivo enviado ao Storage caso o INSERT na tabela falhe (ex: RLS)
        await AppState.supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
        throw insertError || new Error("Política RLS bloqueou a inserção na tabela public.midias.");
      }
    }

    updateUploadProgress(true, 100, "Publicação concluída!");
    showToast(`${total} mídia(s) publicada(s) com sucesso no Supabase!`, "success");
    resetUploadForm();

    await Promise.all([loadPublicGallery(), loadAdminMediaList()]);
  } catch (err) {
    console.error("Erro ao publicar no Supabase:", err);
    showToast(err.message || "Erro ao publicar arquivo no Supabase.", "error");
  } finally {
    saveBtn.disabled = false;
    setTimeout(() => updateUploadProgress(false, 0, ""), 800);
  }
}

// ==========================================================================
// GERENCIAR, EDITAR E EXCLUIR MÍDIAS NO SUPABASE
// ==========================================================================

function setupAdminManageControls() {
  const refreshBtn = document.getElementById("refreshAdminMediaBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAdminMediaList);
  }

  const editForm = document.getElementById("adminEditMediaForm");
  const cancelEditBtn = document.getElementById("cancelEditMediaBtn");

  if (cancelEditBtn && editForm) {
    cancelEditBtn.addEventListener("click", () => {
      editForm.style.display = "none";
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!AppState.supabase || !AppState.session) return;

      const id = document.getElementById("editMediaId").value;
      const titulo = document.getElementById("editMediaTitle").value.trim();
      const categoria = document.getElementById("editMediaCategory").value;
      const descricao = document.getElementById("editMediaDesc").value.trim();
      const publicado = document.getElementById("editMediaPublished").checked;

      try {
        const { data: updatedRows, error } = await AppState.supabase
          .from("midias")
          .update({ titulo, categoria, descricao, publicado })
          .eq("id", id)
          .select("id");

        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error("Nenhuma linha atualizada. Verifique se o UID autenticado possui permissão RLS de UPDATE.");
        }

        editForm.style.display = "none";
        showToast("Informações atualizadas com sucesso!", "success");
        await Promise.all([loadAdminMediaList(), loadPublicGallery()]);
      } catch (err) {
        console.error("Erro ao atualizar mídia:", err);
        showToast(err.message || "Erro ao salvar alterações.", "error");
      }
    });
  }
}

async function loadAdminMediaList() {
  const tbody = document.getElementById("adminMediaList");
  if (!tbody) return;

  if (!AppState.supabase || !AppState.session) {
    tbody.innerHTML = "";
    return;
  }

  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">Carregando mídias...</td></tr>`;

  try {
    const { data, error } = await AppState.supabase
      .from("midias")
      .select("*")
      .order("data_publicacao", { ascending: false });

    if (error) throw error;

    AppState.adminMediaItems = data || [];

    if (AppState.adminMediaItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma mídia cadastrada no Supabase ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = AppState.adminMediaItems
      .map((item) => {
        const isVideo = item.tipo === "video";
        const statusBadge = item.publicado
          ? `<span class="admin-status-badge published">Publicado</span>`
          : `<span class="admin-status-badge hidden">Oculto</span>`;

        return `
          <tr>
            <td>
              ${
                isVideo
                  ? `<video src="${escapeHtml(item.arquivo_url)}" class="admin-thumb-mini" preload="metadata" muted></video>`
                  : `<img src="${escapeHtml(item.arquivo_url)}" alt="${escapeHtml(item.titulo)}" class="admin-thumb-mini" loading="lazy" />`
              }
            </td>
            <td>
              <div style="font-weight: 700; color: #fff;">${escapeHtml(item.titulo)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                ${isVideo ? "Vídeo" : "Fotografia"} · ${escapeHtml(item.categoria)} · ${escapeHtml(formatDisplayDate(item.data_publicacao))}
              </div>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div class="admin-actions-cell">
                <button type="button" class="media-edit-btn" data-edit-id="${escapeHtml(item.id)}">
                  Editar
                </button>
                <button type="button" class="media-delete-btn" data-delete-id="${escapeHtml(item.id)}">
                  Excluir
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => openEditMediaForm(btn.getAttribute("data-edit-id")));
    });

    tbody.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteMediaItem(btn.getAttribute("data-delete-id")));
    });
  } catch (err) {
    console.error("Erro ao listar mídias no painel:", err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #f87171; padding: 20px;">Erro ao carregar lista do Supabase.</td></tr>`;
  }
}

function openEditMediaForm(id) {
  const item = AppState.adminMediaItems.find((m) => m.id === id);
  if (!item) return;

  const form = document.getElementById("adminEditMediaForm");
  document.getElementById("editMediaId").value = item.id;
  document.getElementById("editMediaTitle").value = item.titulo || "";
  document.getElementById("editMediaCategory").value = item.categoria || "Shows";
  document.getElementById("editMediaDesc").value = item.descricao || "";
  document.getElementById("editMediaPublished").checked = Boolean(item.publicado);

  form.style.display = "flex";
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function extractStoragePathFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const markers = [
    `/storage/v1/object/public/${STORAGE_BUCKET}/`,
    `/storage/v1/object/sign/${STORAGE_BUCKET}/`,
    `/storage/v1/object/authenticated/${STORAGE_BUCKET}/`,
    `/storage/v1/object/${STORAGE_BUCKET}/`
  ];
  for (const marker of markers) {
    const idx = fileUrl.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(fileUrl.slice(idx + marker.length).split("?")[0]);
    }
  }
  return null;
}

async function deleteMediaItem(id) {
  if (!AppState.supabase || !AppState.session) return;
  const item = AppState.adminMediaItems.find((m) => m.id === id);
  if (!item) return;

  if (!confirm(`Deseja excluir permanentemente "${item.titulo}" da galeria e do Storage?`)) {
    return;
  }

  try {
    // 1. Excluir registro do banco primeiro com .select() para confirmar permissão RLS do UID admin
    const { data: deletedRows, error: dbError } = await AppState.supabase
      .from("midias")
      .delete()
      .eq("id", id)
      .select("id, arquivo_url");

    if (dbError) throw dbError;
    if (!deletedRows || deletedRows.length === 0) {
      throw new Error("Exclusão bloqueada pela política RLS ou registro já removido (verifique o UID administrativo).");
    }

    // 2. Remover objeto correspondente do bucket portfolio-emerson
    const storagePath = extractStoragePathFromUrl(deletedRows[0].arquivo_url || item.arquivo_url);
    let storageWarning = "";
    if (storagePath) {
      const { data: removedFiles, error: storageError } = await AppState.supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);
      if (storageError) {
        storageWarning = `Registro removido, mas houve erro ao apagar o arquivo no Storage: ${storageError.message}`;
      } else if (!removedFiles || removedFiles.length === 0) {
        storageWarning = "Registro removido, mas o arquivo não foi encontrado ou a política RLS do Storage impediu a remoção.";
      }
    }

    // Fechar formulário de edição se estava editando este item
    const editForm = document.getElementById("adminEditMediaForm");
    const editIdInput = document.getElementById("editMediaId");
    if (editForm && editIdInput && editIdInput.value === id) {
      editForm.style.display = "none";
    }

    if (storageWarning) {
      showToast(storageWarning, "warning");
    } else {
      showToast("Mídia e arquivo removidos de forma sincronizada!", "success");
    }
    await Promise.all([loadAdminMediaList(), loadPublicGallery()]);
  } catch (err) {
    console.error("Erro ao excluir mídia:", err);
    showToast(err.message || "Erro ao excluir mídia do Supabase.", "error");
  }
}

// ==========================================================================
// DIAGNÓSTICO E VALIDAÇÃO REAL DA INTEGRAÇÃO SUPABASE
// ==========================================================================

async function runPublicConnectionCheck() {
  const resultEl = document.getElementById("adminPublicCheckResult");
  const btn = document.getElementById("adminTestPublicBtn");
  if (!resultEl || !AppState.supabase) return;

  resultEl.style.display = "block";
  resultEl.className = "validation-inline-status";
  resultEl.textContent = "Verificando tabela public.midias e bucket portfolio-emerson...";
  if (btn) btn.disabled = true;

  try {
    const anonClient = createClient(AppState.supabaseUrl, AppState.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error: dbErr } = await anonClient
      .from("midias")
      .select("id, publicado")
      .eq("publicado", true)
      .limit(5);

    if (dbErr) throw new Error(`Tabela public.midias: ${dbErr.message}`);

    const storageListRes = await fetch(
      `${AppState.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/__probe_nonexistent__`,
      { method: "HEAD" }
    );
    const bucketReachable = storageListRes.status === 404 || storageListRes.status === 400 || storageListRes.ok;

    resultEl.className = "validation-inline-status ok";
    resultEl.innerHTML =
      `<strong>Conexão pública OK.</strong> Tabela <code>public.midias</code> acessível (${(data || []).length} item(ns) retornado(s)) e bucket <code>${STORAGE_BUCKET}</code> ${bucketReachable ? "respondendo" : `status ${storageListRes.status}`}. Faça login para testar RLS do administrador, upload e exclusão.`;
  } catch (err) {
    resultEl.className = "validation-inline-status fail";
    resultEl.textContent = `Falha na verificação: ${err.message || err}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runFullSupabaseValidation() {
  const listEl = document.getElementById("supabaseValidationList");
  const btn = document.getElementById("runSupabaseValidationBtn");
  if (!listEl || !AppState.supabase || !AppState.session) {
    showToast("Faça login como administrador antes de executar a validação.", "warning");
    return;
  }

  const steps = [
    { id: "v-table", title: "1. Conexão com a tabela public.midias", status: "running", detail: "Consultando registros..." },
    { id: "v-bucket", title: "2. Conexão com o bucket portfolio-emerson", status: "running", detail: "Aguardando..." },
    { id: "v-auth", title: "3. Login administrativo (Supabase Auth & UID)", status: "running", detail: "Aguardando..." },
    { id: "v-public", title: "4. Leitura pública (anon) de mídias publicadas", status: "running", detail: "Aguardando..." },
    { id: "v-upload", title: "5. Upload real de fotografia e vídeo + INSERT RLS", status: "running", detail: "Aguardando..." },
    { id: "v-rls-update", title: "6. Permissão RLS de edição (UPDATE) do UID admin", status: "running", detail: "Aguardando..." },
    { id: "v-sync-delete", title: "7. Exclusão sincronizada (Storage + DB)", status: "running", detail: "Aguardando..." }
  ];

  const renderSteps = () => {
    listEl.style.display = "flex";
    listEl.innerHTML = steps
      .map((s) => {
        const label = s.status === "pass" ? "OK" : s.status === "fail" ? "ERRO" : "...";
        return `
          <li class="validation-item ${s.status}">
            <span class="validation-badge ${s.status}">${label}</span>
            <div>
              <div style="font-weight: 700; color: #fff;">${escapeHtml(s.title)}</div>
              <div style="color: var(--text-secondary); font-size: 0.78rem; margin-top: 2px;">${escapeHtml(s.detail)}</div>
            </div>
          </li>
        `;
      })
      .join("");
  };

  const setStep = (idx, status, detail) => {
    steps[idx].status = status;
    steps[idx].detail = detail;
    renderSteps();
  };

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Validando...";
  }
  renderSteps();

  const createdIds = [];
  const createdPaths = [];

  try {
    // 1. Conexão com public.midias
    const { data: tableCheck, error: tableErr } = await AppState.supabase
      .from("midias")
      .select("id")
      .limit(1);
    if (tableErr) {
      setStep(0, "fail", tableErr.message);
    } else {
      setStep(0, "pass", `Tabela public.midias acessível (${(tableCheck || []).length} amostra lida).`);
    }

    // 3. Auth & UID
    const { data: sessionRes, error: authErr } = await AppState.supabase.auth.getSession();
    const activeSession = sessionRes ? sessionRes.session : null;
    if (authErr || !activeSession || !activeSession.access_token) {
      setStep(2, "fail", authErr ? authErr.message : "Sessão inválida.");
      throw new Error("Sessão administrativa inválida.");
    }
    const adminUid = activeSession.user.id;
    setStep(2, "pass", `Autenticado como ${activeSession.user.email} | UID: ${adminUid}`);

    // 4. Leitura pública anônima (publicado = true)
    const anonClient = createClient(AppState.supabaseUrl, AppState.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: anonRows, error: anonErr } = await anonClient
      .from("midias")
      .select("id, publicado");
    if (anonErr) {
      setStep(3, "fail", `Erro na leitura pública (anon): ${anonErr.message}`);
    } else {
      const leakedHidden = (anonRows || []).some((r) => r.publicado === false);
      if (leakedHidden) {
        setStep(3, "fail", "Atenção: cliente anônimo recebeu registro com publicado = false! Verifique a política SELECT.");
      } else {
        setStep(3, "pass", `Leitura anônima OK: ${(anonRows || []).length} registro(s) público(s), nenhum item oculto exposto.`);
      }
    }

    // 5. Upload real de fotografia (PNG 1x1) e vídeo (WebM mínimo) + INSERT na tabela midias
    const pngBytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0,
      10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45,
      180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]);
    // Cabeçalho mínimo válido WebM (EBML)
    const webmBytes = new Uint8Array([
      0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01,
      0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65,
      0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02
    ]);

    const stamp = Date.now();
    const photoFile = new File([pngBytes], `validacao-foto-${stamp}.png`, { type: "image/png" });
    const videoFile = new File([webmBytes], `validacao-video-${stamp}.webm`, { type: "video/webm" });
    const photoPath = `diagnostico/${stamp}-foto.png`;
    const videoPath = `diagnostico/${stamp}-video.webm`;

    try {
      await uploadFileToSupabaseWithProgress(photoFile, photoPath, activeSession.access_token);
      createdPaths.push(photoPath);

      await uploadFileToSupabaseWithProgress(videoFile, videoPath, activeSession.access_token);
      createdPaths.push(videoPath);

      const photoUrl = AppState.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(photoPath).data.publicUrl;
      const videoUrl = AppState.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(videoPath).data.publicUrl;

      // Validar acesso público do bucket (2)
      const headRes = await fetch(photoUrl, { method: "GET" });
      if (!headRes.ok) {
        setStep(1, "fail", `Upload concluído, mas leitura pública do bucket retornou HTTP ${headRes.status}.`);
      } else {
        setStep(1, "pass", `Bucket ${STORAGE_BUCKET} conectado com upload autenticado e leitura pública HTTP 200.`);
      }

      const { data: insPhoto, error: insPhotoErr } = await AppState.supabase
        .from("midias")
        .insert({
          titulo: "[Validação] Foto Teste",
          descricao: "Teste automático temporário",
          categoria: "Ensaios",
          arquivo_url: photoUrl,
          tipo: "foto",
          publicado: false
        })
        .select("id");

      if (insPhotoErr || !insPhoto || insPhoto.length === 0) {
        throw new Error(`INSERT foto bloqueado: ${insPhotoErr ? insPhotoErr.message : "RLS negou inserção para este UID"}`);
      }
      createdIds.push(insPhoto[0].id);

      const { data: insVideo, error: insVideoErr } = await AppState.supabase
        .from("midias")
        .insert({
          titulo: "[Validação] Vídeo Teste",
          descricao: "Teste automático temporário",
          categoria: "Ensaios",
          arquivo_url: videoUrl,
          tipo: "video",
          publicado: false
        })
        .select("id");

      if (insVideoErr || !insVideo || insVideo.length === 0) {
        throw new Error(`INSERT vídeo bloqueado: ${insVideoErr ? insVideoErr.message : "RLS negou inserção para este UID"}`);
      }
      createdIds.push(insVideo[0].id);

      setStep(4, "pass", "Upload de foto (PNG) e vídeo (WEBM) + inserção na tabela public.midias aprovados.");
    } catch (upErr) {
      if (steps[1].status === "running") {
        setStep(1, "fail", `Falha ao acessar/enviar ao bucket ${STORAGE_BUCKET}: ${upErr.message}`);
      }
      setStep(4, "fail", upErr.message);
    }

    // 6. Permissão RLS UPDATE do administrador
    if (createdIds.length > 0) {
      const { data: updRows, error: updErr } = await AppState.supabase
        .from("midias")
        .update({ titulo: "[Validação] Foto Editada" })
        .eq("id", createdIds[0])
        .select("id, titulo");

      if (updErr || !updRows || updRows.length === 0) {
        setStep(5, "fail", updErr ? updErr.message : `RLS negou UPDATE para UID ${adminUid}.`);
      } else {
        setStep(5, "pass", `UPDATE RLS autorizado para o UID administrativo (${adminUid}).`);
      }
    } else {
      setStep(5, "fail", "Ignorado porque não houve registro inserido na etapa anterior.");
    }

    // 7. Exclusão sincronizada (DB + Storage)
    let deleteErrors = [];
    if (createdIds.length > 0) {
      const { data: delRows, error: delErr } = await AppState.supabase
        .from("midias")
        .delete()
        .in("id", createdIds)
        .select("id");
      if (delErr) {
        deleteErrors.push(`DB delete: ${delErr.message}`);
      } else if (!delRows || delRows.length !== createdIds.length) {
        deleteErrors.push(`DB delete: ${delRows ? delRows.length : 0}/${createdIds.length} registro(s) removido(s) (verifique RLS DELETE).`);
      }
    }
    if (createdPaths.length > 0) {
      const { data: remFiles, error: remErr } = await AppState.supabase.storage
        .from(STORAGE_BUCKET)
        .remove(createdPaths);
      if (remErr) {
        deleteErrors.push(`Storage remove: ${remErr.message}`);
      } else if (!remFiles || remFiles.length !== createdPaths.length) {
        deleteErrors.push(`Storage remove: ${remFiles ? remFiles.length : 0}/${createdPaths.length} arquivo(s) removido(s) (verifique RLS DELETE no Storage).`);
      }
    }

    if (deleteErrors.length > 0) {
      setStep(6, "fail", deleteErrors.join(" | "));
    } else if (createdIds.length === 0 || createdPaths.length === 0) {
      setStep(
        6,
        "fail",
        createdPaths.length > 0
          ? "Arquivos temporários limpos no Storage, mas a inserção na tabela public.midias falhou antes do teste completo de exclusão."
          : "Nada para excluir porque o upload/insert falhou."
      );
    } else {
      setStep(6, "pass", "Registros de teste e arquivos no Storage removidos de forma sincronizada.");
    }

    await Promise.all([loadAdminMediaList(), loadPublicGallery()]);
    const allOk = steps.every((s) => s.status === "pass");
    showToast(
      allOk ? "Todas as 7 operações Supabase foram validadas com sucesso!" : "Validação concluída com alertas — verifique os detalhes.",
      allOk ? "success" : "warning"
    );
  } catch (err) {
    console.error("Erro na validação Supabase:", err);
    showToast(err.message || "Falha ao executar validação.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Executar Validação Real";
    }
  }
}

// ==========================================================================
// IDENTIDADE VISUAL & CAPAS DAS MODALIDADES (SUPABASE STORAGE)
// ==========================================================================

function ensureDefaultIdentitySrcs() {
  SITE_IDENTITY_SLOTS.forEach((slot) => {
    const imgEl = document.getElementById(slot.imgId);
    if (imgEl && !imgEl.dataset.defaultSrc) {
      imgEl.dataset.defaultSrc = imgEl.getAttribute("src") || "";
    }
  });
}

function parseFramingFromFileName(name, fallbackPosKey) {
  const match = String(name || "").match(/__pos_(top|upper|center|lower)\./i);
  if (match && FRAMING_PRESETS[match[1].toLowerCase()]) {
    return match[1].toLowerCase();
  }
  return fallbackPosKey || "center";
}

function applyIdentitySlotToDom(slot, url, posKey) {
  const imgEl = document.getElementById(slot.imgId);
  if (!imgEl) return;

  const preset = FRAMING_PRESETS[posKey] || FRAMING_PRESETS[slot.defaultPosKey] || FRAMING_PRESETS.center;
  if (url) {
    imgEl.src = url;
  } else if (imgEl.dataset.defaultSrc) {
    imgEl.src = imgEl.dataset.defaultSrc;
  }
  imgEl.style.objectPosition = preset.css;

  if (slot.key === "hero" && url) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute("content", url);
  }
}

async function loadSiteIdentityFromSupabase() {
  ensureDefaultIdentitySrcs();

  if (!AppState.supabase) {
    SITE_IDENTITY_SLOTS.forEach((slot) => {
      const imgEl = document.getElementById(slot.imgId);
      const defaultSrc = imgEl ? imgEl.dataset.defaultSrc : "";
      AppState.identityState[slot.key] = {
        isCustom: false,
        url: defaultSrc,
        storagePath: null,
        posKey: slot.defaultPosKey
      };
      applyIdentitySlotToDom(slot, defaultSrc, slot.defaultPosKey);
    });
    return;
  }

  await Promise.all(
    SITE_IDENTITY_SLOTS.map(async (slot) => {
      const imgEl = document.getElementById(slot.imgId);
      const defaultSrc = imgEl ? imgEl.dataset.defaultSrc : "";
      try {
        const { data: files, error } = await AppState.supabase.storage
          .from(STORAGE_BUCKET)
          .list(`identidade/${slot.key}`, {
            limit: 10,
            sortBy: { column: "created_at", order: "desc" }
          });

        if (error) throw error;

        const validFiles = (files || []).filter(
          (f) => f && f.name && !f.name.startsWith(".") && f.id !== null
        );

        if (validFiles.length > 0) {
          const activeFile = validFiles[0];
          const storagePath = `identidade/${slot.key}/${activeFile.name}`;
          const posKey = parseFramingFromFileName(activeFile.name, slot.defaultPosKey);
          const { data: urlData } = AppState.supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);

          const publicUrl = urlData ? urlData.publicUrl : defaultSrc;
          AppState.identityState[slot.key] = {
            isCustom: true,
            url: publicUrl,
            storagePath,
            posKey
          };
          applyIdentitySlotToDom(slot, publicUrl, posKey);
          return;
        }
      } catch (err) {
        console.warn(`Aviso ao carregar capa "${slot.key}" do Supabase:`, err);
      }

      AppState.identityState[slot.key] = {
        isCustom: false,
        url: defaultSrc,
        storagePath: null,
        posKey: slot.defaultPosKey
      };
      applyIdentitySlotToDom(slot, defaultSrc, slot.defaultPosKey);
    })
  );
}

function setupAdminIdentityControls() {
  const refreshBtn = document.getElementById("refreshIdentitySlotsBtn");
  const fileInput = document.getElementById("identitySlotFileInput");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadSiteIdentityFromSupabase();
      renderIdentitySlotsManager();
      showToast("Capas atualizadas a partir do Supabase.", "success");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      const slotKey = AppState.pendingIdentitySlotKey;
      fileInput.value = "";
      AppState.pendingIdentitySlotKey = null;
      if (file && slotKey) {
        await handleIdentityFileUpload(slotKey, file);
      }
    });
  }
}

function renderIdentitySlotsManager() {
  const grid = document.getElementById("identitySlotsGrid");
  if (!grid) return;

  ensureDefaultIdentitySrcs();

  grid.innerHTML = SITE_IDENTITY_SLOTS.map((slot) => {
    const state = AppState.identityState[slot.key] || {
      isCustom: false,
      url: document.getElementById(slot.imgId)?.dataset.defaultSrc || "",
      storagePath: null,
      posKey: slot.defaultPosKey
    };
    const framingCss = (FRAMING_PRESETS[state.posKey] || FRAMING_PRESETS.center).css;

    const framingOptions = Object.entries(FRAMING_PRESETS)
      .map(
        ([k, v]) =>
          `<option value="${escapeHtml(k)}"${state.posKey === k ? " selected" : ""}>${escapeHtml(v.label)}</option>`
      )
      .join("");

    return `
      <div class="identity-slot-card" data-identity-slot="${escapeHtml(slot.key)}">
        <div class="identity-slot-preview">
          <img src="${escapeHtml(state.url)}" alt="${escapeHtml(slot.label)}" style="object-position: ${escapeHtml(framingCss)};" />
          <span class="identity-slot-badge ${state.isCustom ? "custom" : ""}">
            ${state.isCustom ? "Salva no Supabase" : "Imagem Padrão"}
          </span>
        </div>
        <div class="identity-slot-body">
          <div>
            <div class="identity-slot-title">${escapeHtml(slot.label)}</div>
            <p class="identity-slot-hint">${escapeHtml(slot.hint)}</p>
          </div>
          <div class="hire-select-group" style="gap: 4px;">
            <label for="framing-${escapeHtml(slot.key)}" class="hire-label" style="font-size: 0.72rem;">Enquadramento</label>
            <select id="framing-${escapeHtml(slot.key)}" class="hire-select" data-identity-framing="${escapeHtml(slot.key)}" style="padding: 8px 10px; font-size: 0.8rem;">
              ${framingOptions}
            </select>
          </div>
          <div class="identity-slot-actions">
            <button type="button" class="btn btn-primary btn-sm" data-identity-upload="${escapeHtml(slot.key)}">
              Alterar Foto
            </button>
            ${
              state.isCustom
                ? `<button type="button" class="btn btn-outline btn-sm" data-identity-reset="${escapeHtml(slot.key)}" style="color: #f87171; border-color: rgba(248, 113, 113, 0.35);">Restaurar Padrão</button>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-identity-upload]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slotKey = btn.getAttribute("data-identity-upload");
      const fileInput = document.getElementById("identitySlotFileInput");
      if (!fileInput || !slotKey) return;
      AppState.pendingIdentitySlotKey = slotKey;
      fileInput.click();
    });
  });

  grid.querySelectorAll("[data-identity-framing]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const slotKey = sel.getAttribute("data-identity-framing");
      handleIdentityFramingChange(slotKey, sel.value);
    });
  });

  grid.querySelectorAll("[data-identity-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slotKey = btn.getAttribute("data-identity-reset");
      handleIdentityReset(slotKey);
    });
  });
}

async function handleIdentityFileUpload(slotKey, file) {
  if (!AppState.supabase || !AppState.session) {
    showToast("Faça login como administrador para alterar a identidade visual.", "error");
    return;
  }

  const slot = SITE_IDENTITY_SLOTS.find((s) => s.key === slotKey);
  if (!slot) return;

  const mime = resolveMimeType(file);
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedImageTypes.includes(mime)) {
    showToast("Use apenas imagens JPG, PNG, WEBP ou GIF para capas e perfil.", "warning");
    return;
  }

  if (file.size > 25 * 1024 * 1024) {
    showToast("A imagem deve ter no máximo 25MB.", "warning");
    return;
  }

  const { data: sessionData } = await AppState.supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    showToast("Sessão expirada. Faça login novamente.", "error");
    return;
  }

  const currentState = AppState.identityState[slotKey] || { posKey: slot.defaultPosKey };
  const posKey = FRAMING_PRESETS[currentState.posKey] ? currentState.posKey : slot.defaultPosKey;

  const extMatch = file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/);
  const ext = extMatch ? `.${extMatch[1]}` : ".jpg";
  const newPath = `identidade/${slotKey}/${Date.now()}__pos_${posKey}${ext}`;

  const uploadBtn = document.querySelector(`[data-identity-upload="${slotKey}"]`);
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Enviando...";
  }

  try {
    // Listar arquivos antigos antes para limpar após sucesso
    const { data: existingFiles } = await AppState.supabase.storage
      .from(STORAGE_BUCKET)
      .list(`identidade/${slotKey}`, { limit: 20 });

    await uploadFileToSupabaseWithProgress(file, newPath, accessToken);

    const oldPaths = (existingFiles || [])
      .filter((f) => f && f.name && !f.name.startsWith(".") && f.id !== null)
      .map((f) => `identidade/${slotKey}/${f.name}`);

    if (oldPaths.length > 0) {
      await AppState.supabase.storage.from(STORAGE_BUCKET).remove(oldPaths).catch(() => {});
    }

    await loadSiteIdentityFromSupabase();
    renderIdentitySlotsManager();
    showToast(`${slot.label} atualizada no Supabase!`, "success");
  } catch (err) {
    console.error(`Erro ao atualizar "${slotKey}":`, err);
    showToast(err.message || "Erro ao enviar imagem para o Supabase Storage.", "error");
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Alterar Foto";
    }
  }
}

async function handleIdentityFramingChange(slotKey, newPosKey) {
  const slot = SITE_IDENTITY_SLOTS.find((s) => s.key === slotKey);
  if (!slot || !FRAMING_PRESETS[newPosKey]) return;

  const currentState = AppState.identityState[slotKey];
  if (!currentState) return;

  currentState.posKey = newPosKey;
  applyIdentitySlotToDom(slot, currentState.url, newPosKey);

  const previewImg = document.querySelector(`[data-identity-slot="${slotKey}"] .identity-slot-preview img`);
  if (previewImg) {
    previewImg.style.objectPosition = FRAMING_PRESETS[newPosKey].css;
  }

  if (currentState.isCustom && currentState.storagePath && AppState.supabase && AppState.session) {
    const extMatch = currentState.storagePath.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
    const newPath = `identidade/${slotKey}/${Date.now()}__pos_${newPosKey}${ext}`;
    try {
      const { error: moveError } = await AppState.supabase.storage
        .from(STORAGE_BUCKET)
        .move(currentState.storagePath, newPath);
      if (moveError) throw moveError;

      await loadSiteIdentityFromSupabase();
      renderIdentitySlotsManager();
      showToast(`Enquadramento de "${slot.label}" salvo no Supabase!`, "success");
    } catch (err) {
      console.error("Erro ao salvar enquadramento no Storage:", err);
      showToast(err.message || "Não foi possível salvar o enquadramento no Storage.", "error");
    }
  } else {
    showToast("Enquadramento pré-selecionado. Envie uma foto personalizada para salvá-lo no Supabase.", "warning");
  }
}

async function handleIdentityReset(slotKey) {
  if (!AppState.supabase || !AppState.session) return;
  const slot = SITE_IDENTITY_SLOTS.find((s) => s.key === slotKey);
  if (!slot) return;

  if (!confirm(`Deseja restaurar a imagem padrão de "${slot.label}" e remover a foto personalizada do Supabase?`)) {
    return;
  }

  try {
    const { data: existingFiles, error: listErr } = await AppState.supabase.storage
      .from(STORAGE_BUCKET)
      .list(`identidade/${slotKey}`, { limit: 20 });

    if (listErr) throw listErr;

    const pathsToRemove = (existingFiles || [])
      .filter((f) => f && f.name && !f.name.startsWith(".") && f.id !== null)
      .map((f) => `identidade/${slotKey}/${f.name}`);

    if (pathsToRemove.length > 0) {
      const { error: removeErr } = await AppState.supabase.storage
        .from(STORAGE_BUCKET)
        .remove(pathsToRemove);
      if (removeErr) throw removeErr;
    }

    await loadSiteIdentityFromSupabase();
    renderIdentitySlotsManager();
    showToast(`"${slot.label}" restaurada para a imagem padrão.`, "success");
  } catch (err) {
    console.error(`Erro ao restaurar "${slotKey}":`, err);
    showToast(err.message || "Erro ao remover imagem do Supabase Storage.", "error");
  }
}

// ==========================================================================
// GERADOR DINÂMICO DE MENSAGENS PARA O WHATSAPP
// ==========================================================================

function setupHireWhatsAppAction() {
  const hireBtn = document.getElementById("directHireWhatsappBtn");
  const serviceSelect = document.getElementById("hireServiceSelect");
  const eventDateInput = document.getElementById("hireDateInput");
  const notesInput = document.getElementById("hireNotesInput");

  if (!hireBtn) return;

  hireBtn.addEventListener("click", () => {
    const service = serviceSelect ? serviceSelect.value : "Show / Apresentação";
    const date = eventDateInput && eventDateInput.value.trim() ? eventDateInput.value.trim() : "A combinar";
    const notes = notesInput && notesInput.value.trim() ? notesInput.value.trim() : "";

    let message = `Olá Emerson! Estive navegando pelo seu portfólio profissional e gostaria de solicitar um orçamento.\n\n`;
    message += `*Serviço de interesse:* ${service}\n`;
    message += `*Previsão de Data:* ${date}\n`;
    if (notes) {
      message += `*Detalhes do projeto:* ${notes}\n`;
    }
    message += `\nAguardo seu retorno para conversarmos. Obrigado!`;

    const encoded = encodeURIComponent(message);
    const link = document.createElement("a");
    link.href = `https://wa.me/5573999538365?text=${encoded}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}

// ==========================================================================
// NAVEGAÇÃO, MENU MOBILE & FILTROS
// ==========================================================================

function setupNavigation() {
  const header = document.querySelector(".site-header");
  const mobileToggle = document.getElementById("mobileMenuToggle");
  const mobileDrawer = document.getElementById("mobileDrawer");
  const mobileDrawerClose = document.getElementById("mobileDrawerClose");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const navLinks = document.querySelectorAll(".main-nav .nav-link");

  const updateScrollUI = () => {
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 40);
    }
    if (scrollTopBtn) {
      const isVisible = window.scrollY > 360;
      scrollTopBtn.classList.toggle("visible", isVisible);
      scrollTopBtn.setAttribute("aria-hidden", String(!isVisible));
      scrollTopBtn.setAttribute("tabindex", isVisible ? "0" : "-1");
    }
  };

  window.addEventListener("scroll", updateScrollUI, { passive: true });
  updateScrollUI();

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: isReducedMotionPreferred() ? "auto" : "smooth" });
    });
  }

  // Destaque automático da seção ativa no menu de navegação
  if (typeof IntersectionObserver !== "undefined" && navLinks.length > 0) {
    const sections = ["hero", "sobre", "estilos", "portfolio", "experiencia", "contratacao"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeHref = `#${entry.target.id}`;
            navLinks.forEach((link) => {
              const isActive = link.getAttribute("href") === activeHref;
              link.classList.toggle("active", isActive);
              if (isActive) {
                link.setAttribute("aria-current", "page");
              } else {
                link.removeAttribute("aria-current");
              }
            });
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  const setDrawerOpen = (isOpen) => {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.classList.toggle("open", isOpen);
    mobileDrawer.setAttribute("aria-hidden", String(!isOpen));
    mobileToggle.setAttribute("aria-expanded", String(isOpen));
    mobileToggle.setAttribute("aria-label", isOpen ? "Fechar Menu de Navegação" : "Abrir Menu de Navegação");
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (isOpen && mobileDrawerClose) {
      mobileDrawerClose.focus();
    } else if (!isOpen) {
      mobileToggle.focus();
    }
  };

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener("click", () => {
      setDrawerOpen(!mobileDrawer.classList.contains("open"));
    });

    if (mobileDrawerClose) {
      mobileDrawerClose.addEventListener("click", () => setDrawerOpen(false));
    }

    document.querySelectorAll(".mobile-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
        mobileToggle.setAttribute("aria-expanded", "false");
        mobileToggle.setAttribute("aria-label", "Abrir Menu de Navegação");
        document.body.style.overflow = "";
      });
    });
  }

  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      AppState.currentFilter = btn.dataset.filter || "all";
      renderPublicGallery();
    });
  });

  document.querySelectorAll("[data-filter-to]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const targetFilter = el.dataset.filterTo;
      AppState.currentFilter = targetFilter;

      filterBtns.forEach((b) => {
        const isMatch = b.dataset.filter === targetFilter;
        b.classList.toggle("active", isMatch);
        b.setAttribute("aria-pressed", String(isMatch));
      });

      const portfolioSection = document.getElementById("portfolio");
      if (portfolioSection) {
        portfolioSection.scrollIntoView({ behavior: isReducedMotionPreferred() ? "auto" : "smooth" });
      }
      renderPublicGallery();
    });
  });
}

function setupGlobalModalClosers() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeVideoModal();
      const adminModal = document.getElementById("adminModal");
      if (adminModal && adminModal.classList.contains("open")) {
        adminModal.classList.remove("open");
        document.body.style.overflow = "";
        restoreModalFocus();
      }
      const mobileDrawer = document.getElementById("mobileDrawer");
      const mobileToggle = document.getElementById("mobileMenuToggle");
      if (mobileDrawer && mobileDrawer.classList.contains("open")) {
        mobileDrawer.classList.remove("open");
        mobileDrawer.setAttribute("aria-hidden", "true");
        if (mobileToggle) {
          mobileToggle.setAttribute("aria-expanded", "false");
          mobileToggle.setAttribute("aria-label", "Abrir Menu de Navegação");
          mobileToggle.focus();
        }
        document.body.style.overflow = "";
      }
    }
  });

  const lightbox = document.getElementById("lightboxModal");
  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.classList.contains("lightbox-close")) {
        closeLightbox();
      }
    });
  }

  const videoModal = document.getElementById("videoModal");
  if (videoModal) {
    videoModal.addEventListener("click", (e) => {
      if (e.target === videoModal || e.target.classList.contains("video-close")) {
        closeVideoModal();
      }
    });
  }

  const adminModal = document.getElementById("adminModal");
  if (adminModal) {
    adminModal.addEventListener("click", (e) => {
      if (e.target === adminModal) {
        adminModal.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  }
}

// ==========================================================================
// UTILITÁRIOS: DATA, ESCAPE HTML & TOASTS
// ==========================================================================

function formatDisplayDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = `
    <svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  `;

  if (type === "warning") {
    icon = `
      <svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  } else if (type === "error") {
    icon = `
      <svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  }

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

// ==========================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  initStageParticleCanvas();
  setupNavigation();
  setupHireWhatsAppAction();
  setupGlobalModalClosers();
  setupAdminPanel();

  const hasConfig = initSupabaseClient();
  if (hasConfig) {
    setupAuthListener();
    const { data } = await AppState.supabase.auth.getSession();
    AppState.session = data ? data.session : null;
  }

  await Promise.all([loadPublicGallery(), loadSiteIdentityFromSupabase()]);
});
