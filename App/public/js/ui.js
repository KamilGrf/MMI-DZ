// Общие элементы интерфейса: безопасная вставка текста, диалог с формой, уведомления.
export const STATUS_LABELS = {
    in_stock: 'На складе',
    issued: 'Выдан',
    repair: 'В ремонте',
    written_off: 'Списан',
};

export function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}

export function formatMoney(n) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n || 0);
}

export function todayIso(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function badge(status) {
    return `<span class="badge ${status}">${STATUS_LABELS[status] || status}</span>`;
}

export function options(items, valueKey, labelKey, selected, emptyLabel) {
    const head = emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : '';
    return head + items.map((it) =>
        `<option value="${it[valueKey]}"${String(it[valueKey]) === String(selected) ? ' selected' : ''}>${esc(it[labelKey])}</option>`).join('');
}

let toastTimer;
export function toast(message, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast${isError ? ' bad' : ''}`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/**
 * Показать модальную форму.
 * @param {string} title заголовок
 * @param {string} html разметка полей (внутри .form-grid)
 * @param {(data: Object) => Promise<void>} onSubmit обработчик; исключение отображается в форме
 */
export function openForm(title, html, onSubmit, okLabel = 'Сохранить') {
    const dlg = document.getElementById('dialog');
    const form = document.getElementById('dialogForm');
    const err = document.getElementById('dialogError');
    document.getElementById('dialogTitle').textContent = title;
    document.getElementById('dialogBody').innerHTML = html;
    document.getElementById('dialogOk').textContent = okLabel;
    err.hidden = true;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
            await onSubmit(data);
            dlg.close();
        } catch (ex) {
            err.textContent = ex.message;
            err.hidden = false;
        }
    };
    document.getElementById('dialogCancel').onclick = () => dlg.close();
    dlg.showModal();
    const first = form.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
}

export function field(label, name, value = '', { type = 'text', full = false, required = false, attrs = '' } = {}) {
    return `<div class="${full ? 'full' : ''}"><label for="f_${name}">${esc(label)}${required ? ' *' : ''}</label>
        <input id="f_${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${attrs}></div>`;
}

export function selectField(label, name, optionsHtml, { full = false, required = false } = {}) {
    return `<div class="${full ? 'full' : ''}"><label for="f_${name}">${esc(label)}${required ? ' *' : ''}</label>
        <select id="f_${name}" name="${name}" ${required ? 'required' : ''}>${optionsHtml}</select></div>`;
}
