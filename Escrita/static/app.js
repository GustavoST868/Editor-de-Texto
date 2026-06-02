// Global State
let selectedModel = '';
let modelsList = [];
let revisionsHistory = [];
let activeRevisionId = null;

const presets = {
    default: `Revise o seguinte texto para melhorar a clareza, fluidez, coesão e gramática. Você DEVE manter o estilo de escrita, a pessoa verbal e o tom original do autor. Retorne APENAS o texto revisado, sem comentários, sem explicações, sem introduções e sem aspas extras.\n\nTexto:\n{text}`,
    formal: `Reescreva o texto a seguir em um tom formal, profissional e elegante. Mantenha a mensagem original intacta, mas melhore o vocabulário e a estrutura gramatical para um contexto corporativo ou acadêmico. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`,
    informal: `Reescreva o texto a seguir em um tom casual, amigável, leve e informal. Faça com que pareça uma conversa natural e calorosa, mantendo a mensagem original. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`,
    correct: `Corrija apenas os erros de ortografia, pontuação e gramática do texto a seguir. NÃO altere o estilo de escrita, vocabulário ou ordem das palavras a menos que seja estritamente necessário para corrigir um erro gramatical. Retorne APENAS o texto corrigido, sem comentários ou explicações.\n\nTexto:\n{text}`,
    creative: `Reescreva o texto a seguir de forma criativa, inspiradora e poética. Melhore o ritmo, utilize vocabulário expressivo e dê mais emoção às palavras, mantendo a ideia central intacta. Retorne APENAS o texto revisado, sem comentários ou explicações.\n\nTexto:\n{text}`
};

// DOM Elements
const textarea = document.getElementById('editor');
const lineNumbers = document.getElementById('line-numbers');
const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models');
const presetSelect = document.getElementById('preset-select');
const promptTemplate = document.getElementById('prompt-template');
const tempInput = document.getElementById('temperature');
const tempVal = document.getElementById('temp-val');
const connectionDot = document.getElementById('connection-dot');
const connectionStatus = document.getElementById('connection-status');
const actionIndicatorLight = document.getElementById('action-indicator-light');
const actionStatus = document.getElementById('action-status');
const wordCountSpan = document.getElementById('word-count');
const charCountSpan = document.getElementById('char-count');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

// Modal Elements
const historyModal = document.getElementById('history-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalOriginalText = document.getElementById('modal-original-text');
const modalRevisedText = document.getElementById('modal-revised-text');
const modalBtnRestore = document.getElementById('modal-btn-restore');
const modalBtnCopy = document.getElementById('modal-btn-copy');

// Settings Drawer
const settingsBtn = document.getElementById('btn-settings');
const settingsDrawer = document.getElementById('settings-drawer');

settingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
});

promptTemplate.value = presets.default;

// Sync scrolling
textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
});

function updateEditorMetrics() {
    const text = textarea.value;
    const lines = text.split('\n');
    let lineHtml = '';
    for (let i = 1; i <= Math.max(lines.length, 1); i++) {
        lineHtml += `<div>${i}</div>`;
    }
    lineNumbers.innerHTML = lineHtml;
    lineNumbers.scrollTop = textarea.scrollTop;

    charCountSpan.textContent = `${text.length} ${text.length === 1 ? 'caractere' : 'caracteres'}`;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountSpan.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
}

textarea.addEventListener('input', updateEditorMetrics);
updateEditorMetrics();

// Fetch models from Ollama
async function fetchModels() {
    connectionDot.className = 'dot disconnected';
    connectionStatus.textContent = 'Buscando...';
    modelSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        const response = await fetch('/api/models');
        const data = await response.json();

        if (data.success && data.models.length > 0) {
            modelsList = data.models;
            modelSelect.innerHTML = '';
            modelsList.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            const defaultModel = modelsList.find(m => m.includes('qwen') || m.includes('llama') || m.includes('mistral')) || modelsList[0];
            modelSelect.value = defaultModel;
            selectedModel = defaultModel;
            connectionDot.className = 'dot connected';
            connectionStatus.textContent = 'Conectado';
            updateActionStatus('idle', 'Pronto');
        } else {
            throw new Error(data.error || 'Nenhum modelo instalado.');
        }
    } catch (error) {
        modelSelect.innerHTML = '<option value="">Sem modelos</option>';
        connectionDot.className = 'dot disconnected';
        connectionStatus.textContent = 'Offline';
        updateActionStatus('error', error.message || 'Falha ao conectar.');
    }
}

modelSelect.addEventListener('change', (e) => { selectedModel = e.target.value; });
refreshModelsBtn.addEventListener('click', () => {
    const icon = refreshModelsBtn.querySelector('i');
    icon.classList.add('spinning');
    fetchModels().finally(() => setTimeout(() => icon.classList.remove('spinning'), 600));
});

presetSelect.addEventListener('change', (e) => {
    if (presets[e.target.value]) promptTemplate.value = presets[e.target.value];
});
tempInput.addEventListener('input', (e) => { tempVal.textContent = e.target.value; });

function updateActionStatus(state, message) {
    actionIndicatorLight.className = `status-light ${state}`;
    actionStatus.textContent = message;
}

// History
function addHistoryItem(original, revised) {
    const id = Date.now();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    revisionsHistory.unshift({ id, time, original, revised });
    renderHistory();
}

function renderHistory() {
    if (revisionsHistory.length === 0) {
        historyList.innerHTML = '<div class="history-empty">Nenhuma revisão feita ainda.</div>';
        return;
    }
    historyList.innerHTML = '';
    revisionsHistory.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.addEventListener('click', () => openHistoryModal(item.id));
        const origSnippet = item.original.length > 30 ? item.original.substring(0, 30) + '...' : item.original;
        const revSnippet = item.revised.length > 30 ? item.revised.substring(0, 30) + '...' : item.revised;
        div.innerHTML = `
            <div class="history-item-time">${item.time}</div>
            <div class="history-item-preview original-prev">${escapeHtml(origSnippet)}</div>
            <div class="history-item-preview revised-prev">${escapeHtml(revSnippet)}</div>
        `;
        historyList.appendChild(div);
    });
}

function escapeHtml(str) { /* ... */ 
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
clearHistoryBtn.addEventListener('click', () => { revisionsHistory = []; renderHistory(); });

function openHistoryModal(id) {
    const item = revisionsHistory.find(i => i.id === id);
    if (!item) return;
    activeRevisionId = id;
    modalOriginalText.innerHTML = `<del>${escapeHtml(item.original)}</del>`;
    modalRevisedText.innerHTML = `<ins>${escapeHtml(item.revised)}</ins>`;
    historyModal.classList.add('active');
}
function closeHistoryModal() { historyModal.classList.remove('active'); activeRevisionId = null; }
closeModalBtn.addEventListener('click', closeHistoryModal);
historyModal.addEventListener('click', (e) => { if (e.target === historyModal) closeHistoryModal(); });

modalBtnRestore.addEventListener('click', () => {
    if (!activeRevisionId) return;
    const item = revisionsHistory.find(i => i.id === activeRevisionId);
    if (!item) return;
    const currentText = textarea.value;
    const index = currentText.indexOf(item.revised);
    if (index !== -1) {
        const before = currentText.substring(0, index);
        const after = currentText.substring(index + item.revised.length);
        textarea.value = before + item.original + after;
        updateEditorMetrics();
        textarea.setSelectionRange(index + item.original.length, index + item.original.length);
        textarea.focus();
        updateActionStatus('idle', 'Original restaurado');
        closeHistoryModal();
    } else alert("Não foi possível restaurar. O texto revisado foi modificado.");
});
modalBtnCopy.addEventListener('click', () => {
    if (!activeRevisionId) return;
    const item = revisionsHistory.find(i => i.id === activeRevisionId);
    if (item) navigator.clipboard.writeText(item.revised).then(() => {
        modalBtnCopy.innerHTML = '<i class="fa-regular fa-check"></i> Copiado!';
        setTimeout(() => modalBtnCopy.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar revisado', 1500);
    });
});

document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = document.getElementById('btn-copy');
        btn.innerHTML = '<i class="fa-regular fa-check"></i> Copiado!';
        setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar', 1500);
    });
});
document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Limpar todo o editor?')) { textarea.value = ''; updateEditorMetrics(); textarea.focus(); }
});

// Core revision trigger using [texto]
let isProcessing = false;
const revisionRegex = /\[([^\[\]§\n][^\[\]§\n]*)\]/;
const PLACEHOLDER_PREFIX = '§revisando§:';

async function checkAndTriggerRevision() {
    if (isProcessing) return;
    const text = textarea.value;
    const match = text.match(revisionRegex);
    if (match) {
        isProcessing = true;
        const fullMatch = match[0];
        const textToRevise = match[1];
        const matchIndex = text.indexOf(fullMatch);
        if (matchIndex === -1) { isProcessing = false; return; }
        const truncatedText = textToRevise.trim().substring(0, 15);
        const uniquePlaceholder = `[${PLACEHOLDER_PREFIX} "${truncatedText}..."]`;
        const before = text.substring(0, matchIndex);
        const after = text.substring(matchIndex + fullMatch.length);
        textarea.value = before + uniquePlaceholder + after;
        updateEditorMetrics();
        updateActionStatus('revising', 'Revisando com IA...');
        try {
            if (!selectedModel) throw new Error("Selecione um modelo.");
            const response = await fetch('/api/revise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToRevise,
                    model: selectedModel,
                    prompt: promptTemplate.value,
                    temperature: parseFloat(tempInput.value)
                })
            });
            const data = await response.json();
            if (data.success) {
                const revisedText = data.revised;
                const curText = textarea.value;
                const placeholderIndex = curText.indexOf(uniquePlaceholder);
                if (placeholderIndex !== -1) {
                    const before2 = curText.substring(0, placeholderIndex);
                    const after2 = curText.substring(placeholderIndex + uniquePlaceholder.length);
                    textarea.value = before2 + revisedText + after2;
                }
                updateActionStatus('idle', 'Revisão concluída ✓');
                addHistoryItem(textToRevise, revisedText);
            } else throw new Error(data.error || "Erro desconhecido.");
        } catch (error) {
            updateActionStatus('error', `Erro: ${error.message}`);
            const curText = textarea.value;
            const placeholderIndex = curText.indexOf(uniquePlaceholder);
            if (placeholderIndex !== -1) {
                const before2 = curText.substring(0, placeholderIndex);
                const after2 = curText.substring(placeholderIndex + uniquePlaceholder.length);
                textarea.value = before2 + textToRevise + after2;
            }
        } finally {
            updateEditorMetrics();
            isProcessing = false;
            setTimeout(checkAndTriggerRevision, 100);
        }
    }
}
textarea.addEventListener('input', checkAndTriggerRevision);
fetchModels();
