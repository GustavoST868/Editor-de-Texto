// ═══════════════════════════════════════════════════════════════
//  escrita — app.js  (multi-theme + font picker edition)
// ═══════════════════════════════════════════════════════════════

// ── Global State ────────────────────────────────────────────────
let selectedModel = '';
let modelsList    = [];
let revisionsHistory = [];
let activeRevisionId = null;

// ── Font Configurations ─────────────────────────────────────────
const fontConfigs = {
  serif: {
    editor: "'EB Garamond', Georgia, serif",
    size: 20,
    lineHeight: 1.85
  },
  modern: {
    editor: "'Playfair Display', Georgia, serif",
    size: 19,
    lineHeight: 1.8
  },
  editorial: {
    editor: "'Lora', Georgia, serif",
    size: 18,
    lineHeight: 1.9
  },
  mono: {
    editor: "'DM Mono', monospace",
    size: 15,
    lineHeight: 1.8
  }
};

let currentFontKey = 'serif';
let currentFontSize = 20; // tracks manual overrides

// ── Theme-aware font defaults ────────────────────────────────────
const themeDefaultFonts = {
  dusk:  'serif',
  noir:  'modern',
  stone: 'editorial',
  moss:  'mono',
  chalk: 'editorial',
  sepia: 'mono'
};

// ── Presets ──────────────────────────────────────────────────────
const presets = {
  default:  `Revise o seguinte texto para melhorar a clareza, fluidez, coesão e gramática. Você DEVE manter o estilo de escrita, a pessoa verbal e o tom original do autor. Retorne APENAS o texto revisado, sem comentários, sem explicações, sem introduções e sem aspas extras.\n\nTexto:\n{text}`,
  formal:   `Reescreva o texto a seguir em um tom formal, profissional e elegante. Mantenha a mensagem original intacta, mas melhore o vocabulário e a estrutura gramatical para um contexto corporativo ou acadêmico. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`,
  informal: `Reescreva o texto a seguir em um tom casual, amigável, leve e informal. Faça com que pareça uma conversa natural e calorosa, mantendo a mensagem original. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`,
  correct:  `Corrija apenas os erros de ortografia, pontuação e gramática do texto a seguir. NÃO altere o estilo de escrita, vocabulário ou ordem das palavras a menos que seja estritamente necessário para corrigir um erro gramatical. Retorne APENAS o texto corrigido, sem comentários ou explicações.\n\nTexto:\n{text}`,
  creative: `Reescreva o texto a seguir de forma criativa, inspiradora e poética. Melhore o ritmo, utilize vocabulário expressivo e dê mais emoção às palavras, mantendo a ideia central intacta. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`
};

// ── DOM refs ─────────────────────────────────────────────────────
const textarea           = document.getElementById('editor');
const lineNumbers        = document.getElementById('line-numbers');
const modelSelect        = document.getElementById('model-select');
const refreshModelsBtn   = document.getElementById('refresh-models');
const presetSelect       = document.getElementById('preset-select');
const promptTemplate     = document.getElementById('prompt-template');
const tempInput          = document.getElementById('temperature');
const tempVal            = document.getElementById('temp-val');
const connectionDot      = document.getElementById('connection-dot');
const connectionStatus   = document.getElementById('connection-status');
const actionIndicator    = document.getElementById('action-indicator-light');
const actionStatus       = document.getElementById('action-status');
const wordCountSpan      = document.getElementById('word-count');
const charCountSpan      = document.getElementById('char-count');
const historyList        = document.getElementById('history-list');
const clearHistoryBtn    = document.getElementById('clear-history');
const historyModal       = document.getElementById('history-modal');
const closeModalBtn      = document.getElementById('close-modal');
const modalOriginalText  = document.getElementById('modal-original-text');
const modalRevisedText   = document.getElementById('modal-revised-text');
const modalBtnRestore    = document.getElementById('modal-btn-restore');
const modalBtnCopy       = document.getElementById('modal-btn-copy');
const settingsBtn        = document.getElementById('btn-settings');
const settingsDrawer     = document.getElementById('settings-drawer');
const fontSizeLabel      = document.getElementById('font-size-label');
const fontIncrease       = document.getElementById('font-increase');
const fontDecrease       = document.getElementById('font-decrease');

// ── Theme System ─────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update active button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  // Apply the theme-default font (unless user already picked one manually)
  const defaultFont = themeDefaultFonts[theme] || 'serif';
  applyFont(defaultFont, false);

  // Persist
  localStorage.setItem('escrita-theme', theme);
}

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// ── Font System ──────────────────────────────────────────────────
function applyFont(fontKey, persist = true) {
  const cfg = fontConfigs[fontKey];
  if (!cfg) return;

  currentFontKey  = fontKey;
  currentFontSize = cfg.size;

  const root = document.documentElement;
  root.style.setProperty('--editor-font', cfg.editor);
  root.style.setProperty('--editor-size', cfg.size + 'px');
  root.style.setProperty('--line-height', cfg.lineHeight);

  fontSizeLabel.textContent = cfg.size;
  updateLineNumberHeight();

  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === fontKey);
  });

  if (persist) localStorage.setItem('escrita-font', fontKey);
}

document.querySelectorAll('.font-btn').forEach(btn => {
  btn.addEventListener('click', () => applyFont(btn.dataset.font, true));
});

// ── Font Size Controls ───────────────────────────────────────────
fontIncrease.addEventListener('click', () => {
  currentFontSize = Math.min(currentFontSize + 1, 32);
  document.documentElement.style.setProperty('--editor-size', currentFontSize + 'px');
  fontSizeLabel.textContent = currentFontSize;
  updateLineNumberHeight();
});

fontDecrease.addEventListener('click', () => {
  currentFontSize = Math.max(currentFontSize - 1, 12);
  document.documentElement.style.setProperty('--editor-size', currentFontSize + 'px');
  fontSizeLabel.textContent = currentFontSize;
  updateLineNumberHeight();
});

function updateLineNumberHeight() {
  updateEditorMetrics();
}

// ── Settings Drawer ──────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
  settingsDrawer.classList.toggle('open');
});

promptTemplate.value = presets.default;

// ── Line numbers & metrics ───────────────────────────────────────
textarea.addEventListener('scroll', () => {
  lineNumbers.scrollTop = textarea.scrollTop;
});

function updateEditorMetrics() {
  const text  = textarea.value;
  const lines = text.split('\n');

  let html = '';
  for (let i = 1; i <= Math.max(lines.length, 1); i++) {
    html += `<div>${i}</div>`;
  }
  lineNumbers.innerHTML = html;
  lineNumbers.scrollTop = textarea.scrollTop;

  const chars = text.length;
  charCountSpan.textContent = `${chars} ${chars === 1 ? 'caractere' : 'caracteres'}`;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCountSpan.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
}

textarea.addEventListener('input', updateEditorMetrics);
updateEditorMetrics();

// ── Model fetching ───────────────────────────────────────────────
async function fetchModels() {
  connectionDot.className = 'dot disconnected';
  connectionStatus.textContent = 'Buscando...';
  modelSelect.innerHTML = '<option value="">Carregando…</option>';

  try {
    const res  = await fetch('/api/models');
    const data = await res.json();

    if (data.success && data.models.length > 0) {
      modelsList = data.models;
      modelSelect.innerHTML = '';
      modelsList.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
      const defaultModel = modelsList.find(m =>
        m.includes('qwen') || m.includes('llama') || m.includes('mistral')
      ) || modelsList[0];
      modelSelect.value = defaultModel;
      selectedModel = defaultModel;
      connectionDot.className = 'dot connected';
      connectionStatus.textContent = 'Conectado';
      updateActionStatus('idle', 'Pronto');
    } else {
      throw new Error(data.error || 'Nenhum modelo instalado.');
    }
  } catch (err) {
    modelSelect.innerHTML = '<option value="">Sem modelos</option>';
    connectionDot.className = 'dot disconnected';
    connectionStatus.textContent = 'Offline';
    updateActionStatus('error', err.message || 'Falha ao conectar.');
  }
}

modelSelect.addEventListener('change', e => { selectedModel = e.target.value; });

refreshModelsBtn.addEventListener('click', () => {
  const icon = refreshModelsBtn.querySelector('i');
  icon.classList.add('spinning');
  fetchModels().finally(() => setTimeout(() => icon.classList.remove('spinning'), 700));
});

presetSelect.addEventListener('change', e => {
  if (presets[e.target.value]) promptTemplate.value = presets[e.target.value];
});

tempInput.addEventListener('input', e => { tempVal.textContent = e.target.value; });

// ── Action status ────────────────────────────────────────────────
function updateActionStatus(state, message) {
  actionIndicator.className = `status-light ${state}`;
  actionStatus.textContent  = message;
}

// ── History ──────────────────────────────────────────────────────
function addHistoryItem(original, revised) {
  const id   = Date.now();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  revisionsHistory.unshift({ id, time, original, revised });
  renderHistory();
}

function renderHistory() {
  if (!revisionsHistory.length) {
    historyList.innerHTML = '<div class="history-empty">Nenhuma revisão ainda.</div>';
    return;
  }
  historyList.innerHTML = '';
  revisionsHistory.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.addEventListener('click', () => openHistoryModal(item.id));
    const orig = item.original.length > 35 ? item.original.substring(0, 35) + '…' : item.original;
    const rev  = item.revised.length  > 35 ? item.revised.substring(0, 35)  + '…' : item.revised;
    div.innerHTML = `
      <div class="history-item-time">${item.time}</div>
      <div class="history-item-preview original-prev">${escapeHtml(orig)}</div>
      <div class="history-item-preview revised-prev">${escapeHtml(rev)}</div>
    `;
    historyList.appendChild(div);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

clearHistoryBtn.addEventListener('click', () => { revisionsHistory = []; renderHistory(); });

// ── History Modal ────────────────────────────────────────────────
function openHistoryModal(id) {
  const item = revisionsHistory.find(i => i.id === id);
  if (!item) return;
  activeRevisionId         = id;
  modalOriginalText.innerHTML = `<del>${escapeHtml(item.original)}</del>`;
  modalRevisedText.innerHTML  = `<ins>${escapeHtml(item.revised)}</ins>`;
  historyModal.classList.add('active');
}

function closeHistoryModal() {
  historyModal.classList.remove('active');
  activeRevisionId = null;
}

closeModalBtn.addEventListener('click', closeHistoryModal);
historyModal.addEventListener('click', e => { if (e.target === historyModal) closeHistoryModal(); });

modalBtnRestore.addEventListener('click', () => {
  if (!activeRevisionId) return;
  const item  = revisionsHistory.find(i => i.id === activeRevisionId);
  if (!item) return;
  const cur   = textarea.value;
  const idx   = cur.indexOf(item.revised);
  if (idx !== -1) {
    textarea.value = cur.substring(0, idx) + item.original + cur.substring(idx + item.revised.length);
    updateEditorMetrics();
    textarea.setSelectionRange(idx + item.original.length, idx + item.original.length);
    textarea.focus();
    updateActionStatus('idle', 'Original restaurado');
    closeHistoryModal();
  } else {
    alert('Não foi possível restaurar. O texto revisado foi modificado.');
  }
});

modalBtnCopy.addEventListener('click', () => {
  if (!activeRevisionId) return;
  const item = revisionsHistory.find(i => i.id === activeRevisionId);
  if (!item) return;
  navigator.clipboard.writeText(item.revised).then(() => {
    modalBtnCopy.innerHTML = '<i class="fa-regular fa-check"></i> Copiado!';
    setTimeout(() => {
      modalBtnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar revisado';
    }, 1500);
  });
});

// ── Toolbar buttons ──────────────────────────────────────────────
document.getElementById('btn-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(textarea.value).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.innerHTML = '<i class="fa-regular fa-check"></i> Copiado!';
    setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar'; }, 1500);
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('Limpar todo o editor?')) {
    textarea.value = '';
    updateEditorMetrics();
    textarea.focus();
  }
});

// ── Core AI revision ─────────────────────────────────────────────
let isProcessing    = false;
const revisionRegex = /\[([^\[\]§\n][^\[\]§\n]*)\]/;
const PLACEHOLDER   = '§revisando§:';

async function checkAndTriggerRevision() {
  if (isProcessing) return;
  const text  = textarea.value;
  const match = text.match(revisionRegex);
  if (!match) return;

  isProcessing = true;
  const fullMatch    = match[0];
  const textToRevise = match[1];
  const matchIndex   = text.indexOf(fullMatch);
  if (matchIndex === -1) { isProcessing = false; return; }

  const truncated   = textToRevise.trim().substring(0, 15);
  const placeholder = `[${PLACEHOLDER} "${truncated}…"]`;
  textarea.value    = text.substring(0, matchIndex) + placeholder + text.substring(matchIndex + fullMatch.length);
  updateEditorMetrics();
  updateActionStatus('revising', 'Revisando com IA…');

  try {
    if (!selectedModel) throw new Error('Selecione um modelo.');

    const res  = await fetch('/api/revise', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:        textToRevise,
        model:       selectedModel,
        prompt:      promptTemplate.value,
        temperature: parseFloat(tempInput.value)
      })
    });
    const data = await res.json();

    if (data.success) {
      const revised  = data.revised;
      const cur      = textarea.value;
      const pIdx     = cur.indexOf(placeholder);
      if (pIdx !== -1) {
        textarea.value = cur.substring(0, pIdx) + revised + cur.substring(pIdx + placeholder.length);
      }
      updateActionStatus('idle', 'Revisão concluída ✓');
      addHistoryItem(textToRevise, revised);
    } else {
      throw new Error(data.error || 'Erro desconhecido.');
    }
  } catch (err) {
    updateActionStatus('error', `Erro: ${err.message}`);
    // Restore original text
    const cur  = textarea.value;
    const pIdx = cur.indexOf(placeholder);
    if (pIdx !== -1) {
      textarea.value = cur.substring(0, pIdx) + textToRevise + cur.substring(pIdx + placeholder.length);
    }
  } finally {
    updateEditorMetrics();
    isProcessing = false;
    setTimeout(checkAndTriggerRevision, 100);
  }
}

textarea.addEventListener('input', checkAndTriggerRevision);

// ── Restore persisted preferences ───────────────────────────────
function restorePreferences() {
  const savedTheme = localStorage.getItem('escrita-theme') || 'dusk';
  const savedFont  = localStorage.getItem('escrita-font');
  applyTheme(savedTheme);
  if (savedFont) applyFont(savedFont, false);
}

// ── Init ─────────────────────────────────────────────────────────
restorePreferences();
fetchModels();
