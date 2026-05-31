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

// Settings Drawer Toggle
const settingsBtn = document.getElementById('btn-settings');
const settingsDrawer = document.getElementById('settings-drawer');

settingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
});

// Initialize Preset Prompts
promptTemplate.value = presets.default;

// Sync scrolling between textarea and line numbers
textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
});

// Update Line Numbers & Stats
function updateEditorMetrics() {
    const text = textarea.value;

    // Line Numbers
    const lines = text.split('\n');
    let lineHtml = '';
    for (let i = 1; i <= Math.max(lines.length, 1); i++) {
        lineHtml += `<div>${i}</div>`;
    }
    lineNumbers.innerHTML = lineHtml;
    lineNumbers.scrollTop = textarea.scrollTop;

    // Character & Word Counts
    charCountSpan.textContent = `${text.length} ${text.length === 1 ? 'caractere' : 'caracteres'}`;

    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountSpan.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
}

textarea.addEventListener('input', updateEditorMetrics);
updateEditorMetrics();

// Load Ollama Models
async function fetchModels() {
    connectionDot.className = 'status-dot disconnected';
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

            connectionDot.className = 'status-dot connected';
            connectionStatus.textContent = 'Conectado';
            updateActionStatus('idle', 'Pronto');
        } else {
            throw new Error(data.error || 'Nenhum modelo instalado.');
        }
    } catch (error) {
        console.error(error);
        modelSelect.innerHTML = '<option value="">Sem modelos</option>';
        connectionDot.className = 'status-dot disconnected';
        connectionStatus.textContent = 'Offline';
        updateActionStatus('error', error.message || 'Falha ao conectar.');
    }
}

modelSelect.addEventListener('change', (e) => {
    selectedModel = e.target.value;
});

refreshModelsBtn.addEventListener('click', () => {
    const icon = refreshModelsBtn.querySelector('i');
    icon.classList.add('spinning');
    fetchModels().finally(() => {
        setTimeout(() => icon.classList.remove('spinning'), 600);
    });
});

// Prompt presets change handler
presetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (presets[val]) {
        promptTemplate.value = presets[val];
    }
});

// Temperature slider
tempInput.addEventListener('input', (e) => {
    tempVal.textContent = e.target.value;
});

// Action Status Helper
function updateActionStatus(state, message) {
    actionIndicatorLight.className = `status-indicator-light ${state}`;
    actionStatus.textContent = message;
}

// History Manager
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

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

clearHistoryBtn.addEventListener('click', () => {
    revisionsHistory = [];
    renderHistory();
});

// Modal Logic
function openHistoryModal(id) {
    const item = revisionsHistory.find(i => i.id === id);
    if (!item) return;
    activeRevisionId = id;
    modalOriginalText.innerHTML = generateDiffHTML(item.original, item.revised).originalHTML;
    modalRevisedText.innerHTML = generateDiffHTML(item.original, item.revised).revisedHTML;
    historyModal.classList.add('active');
}

function closeHistoryModal() {
    historyModal.classList.remove('active');
    activeRevisionId = null;
}

closeModalBtn.addEventListener('click', closeHistoryModal);
historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistoryModal();
});

// Simple Diff Generator
function generateDiffHTML(original, revised) {
    return {
        originalHTML: `<del>${escapeHtml(original)}</del>`,
        revisedHTML: `<ins>${escapeHtml(revised)}</ins>`
    };
}

// Restore Original Text from modal
modalBtnRestore.addEventListener('click', () => {
    if (activeRevisionId === null) return;
    const item = revisionsHistory.find(i => i.id === activeRevisionId);
    if (!item) return;

    const currentText = textarea.value;
    const index = currentText.indexOf(item.revised);
    if (index !== -1) {
        const valBefore = currentText.substring(0, index);
        const valAfter = currentText.substring(index + item.revised.length);
        textarea.value = valBefore + item.original + valAfter;
        updateEditorMetrics();

        const cursorPosition = index + item.original.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        textarea.focus();

        updateActionStatus('idle', 'Original restaurado');
        closeHistoryModal();
    } else {
        alert("Não foi possível restaurar. O texto revisado foi modificado no editor.");
    }
});

// Copy Revised Text from modal
modalBtnCopy.addEventListener('click', () => {
    if (activeRevisionId === null) return;
    const item = revisionsHistory.find(i => i.id === activeRevisionId);
    if (!item) return;

    navigator.clipboard.writeText(item.revised).then(() => {
        const originalText = modalBtnCopy.innerHTML;
        modalBtnCopy.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => { modalBtnCopy.innerHTML = originalText; }, 1500);
    });
});

// Editor Action Buttons
document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = document.getElementById('btn-copy');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
    });
});

document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Tem certeza de que deseja limpar todo o editor?')) {
        textarea.value = '';
        updateEditorMetrics();
        textarea.focus();
    }
});

// Core Trigger Revision Algorithm
let isProcessing = false;

// Regex: ***text*** or ***text**
const revisionRegex = /\*\*\*((?:(?!\*\*\*).)+?)\*{2,3}/s;

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
        const uniquePlaceholder = `[Revisando: "${truncatedText}..." ]`;

        const valBefore = text.substring(0, matchIndex);
        const valAfter = text.substring(matchIndex + fullMatch.length);

        const selStart = textarea.selectionStart;
        const selEnd = textarea.selectionEnd;

        textarea.value = valBefore + uniquePlaceholder + valAfter;
        updateEditorMetrics();

        let newSelStart = selStart;
        let newSelEnd = selEnd;
        const placeholderDiff = uniquePlaceholder.length - fullMatch.length;

        if (selStart > matchIndex + fullMatch.length) { newSelStart += placeholderDiff; }
        else if (selStart > matchIndex) { newSelStart = matchIndex + uniquePlaceholder.length; }

        if (selEnd > matchIndex + fullMatch.length) { newSelEnd += placeholderDiff; }
        else if (selEnd > matchIndex) { newSelEnd = matchIndex + uniquePlaceholder.length; }
        textarea.setSelectionRange(newSelStart, newSelEnd);

        updateActionStatus('revising', 'Revisando com IA...');

        try {
            if (!selectedModel) {
                throw new Error("Selecione um modelo na barra superior.");
            }

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
                const currentText = textarea.value;
                const placeholderIndex = currentText.indexOf(uniquePlaceholder);

                if (placeholderIndex !== -1) {
                    const before = currentText.substring(0, placeholderIndex);
                    const after = currentText.substring(placeholderIndex + uniquePlaceholder.length);
                    textarea.value = before + revisedText + after;

                    const curSel = textarea.selectionStart;
                    const finalDiff = revisedText.length - uniquePlaceholder.length;
                    let fStart = curSel, fEnd = textarea.selectionEnd;

                    if (curSel > placeholderIndex + uniquePlaceholder.length) { fStart += finalDiff; }
                    else if (curSel > placeholderIndex) { fStart = placeholderIndex + revisedText.length; }
                    if (fEnd > placeholderIndex + uniquePlaceholder.length) { fEnd += finalDiff; }
                    else if (fEnd > placeholderIndex) { fEnd = placeholderIndex + revisedText.length; }

                    textarea.setSelectionRange(fStart, fEnd);
                }

                updateActionStatus('idle', 'Revisão concluída ✓');
                addHistoryItem(textToRevise, revisedText);
            } else {
                throw new Error(data.error || "Erro desconhecido.");
            }
        } catch (error) {
            console.error(error);
            updateActionStatus('error', `Erro: ${error.message}`);

            const currentText = textarea.value;
            const placeholderIndex = currentText.indexOf(uniquePlaceholder);
            if (placeholderIndex !== -1) {
                const before = currentText.substring(0, placeholderIndex);
                const after = currentText.substring(placeholderIndex + uniquePlaceholder.length);
                textarea.value = before + textToRevise + after;
            }
        } finally {
            updateEditorMetrics();
            isProcessing = false;
            setTimeout(checkAndTriggerRevision, 100);
        }
    }
}

// Listen for input to trigger revision
textarea.addEventListener('input', checkAndTriggerRevision);

// Initial Load
fetchModels();
