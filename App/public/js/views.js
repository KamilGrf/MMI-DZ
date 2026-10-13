// Представления (экраны) системы. Каждый класс отвечает за один раздел.
import { ApiClient } from './api.js';
import {
    STATUS_LABELS, esc, formatDate, formatMoney, todayIso, badge, options, toast, openForm, field, selectField,
} from './ui.js';

const api = new ApiClient();

class View {
    constructor(root) { this.root = root; }

    /** Подписка на клики по кнопкам с data-action внутри раздела. */
    bindActions(handlers) {
        this.root.onclick = async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const fn = handlers[btn.dataset.action];
            if (!fn) return;
            try { await fn(btn.dataset.id ? Number(btn.dataset.id) : null, btn); } catch (ex) { toast(ex.message, true); }
        };
    }
}

export class ToolsView extends View {
    constructor(root) {
        super(root);
        this.filter = { q: '', category: '', status: '' };
    }

    async render() {
        this.categories = await api.get('/api/categories');
        this.root.innerHTML = `
            <div class="toolbar">
                <h2>Инструменты</h2>
                <div class="grow"><input type="search" id="fq" placeholder="Поиск по названию, номеру, производителю" value="${esc(this.filter.q)}"></div>
                <select id="fcat">${options(this.categories, 'id', 'name', this.filter.category, 'Все категории')}</select>
                <select id="fst"><option value="">Все статусы</option>${Object.entries(STATUS_LABELS)
                    .map(([k, v]) => `<option value="${k}"${this.filter.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
                <button class="btn primary" data-action="add">Добавить инструмент</button>
            </div>
            <div id="list"></div>`;
        const reload = () => this.loadList();
        let timer;
        this.root.querySelector('#fq').oninput = (e) => {
            this.filter.q = e.target.value.trim();
            clearTimeout(timer); timer = setTimeout(reload, 250);
        };
        this.root.querySelector('#fcat').onchange = (e) => { this.filter.category = e.target.value; reload(); };
        this.root.querySelector('#fst').onchange = (e) => { this.filter.status = e.target.value; reload(); };
        this.bindActions({
            add: () => this.edit(),
            edit: (id) => this.edit(id),
            remove: (id) => this.remove(id),
        });
        await this.loadList();
    }

    async loadList() {
        this.tools = await api.get('/api/tools' + ApiClient.query(this.filter));
        const list = this.root.querySelector('#list');
        if (!this.tools.length) { list.innerHTML = '<div class="empty">Инструменты не найдены</div>'; return; }
        list.innerHTML = `<table>
            <thead><tr><th>Инв. №</th><th>Наименование</th><th>Категория</th><th>Производитель</th>
            <th class="num">Цена</th><th>Место хранения</th><th>Статус</th><th></th></tr></thead>
            <tbody>${this.tools.map((t) => `<tr>
                <td>${esc(t.inv_number)}</td><td>${esc(t.name)}</td><td>${esc(t.category)}</td>
                <td>${esc(t.manufacturer || '—')}</td><td class="num">${formatMoney(t.price)}</td>
                <td>${esc(t.location || '—')}</td><td>${badge(t.status)}</td>
                <td class="actions">
                    <button class="btn small" data-action="edit" data-id="${t.id}">Изменить</button>
                    <button class="btn small danger" data-action="remove" data-id="${t.id}">Удалить</button>
                </td></tr>`).join('')}</tbody></table>`;
    }

    edit(toolId) {
        const t = toolId ? this.tools.find((x) => x.id === toolId) : {};
        const statuses = ['in_stock', 'repair', 'written_off']
            .map((k) => `<option value="${k}"${t.status === k ? ' selected' : ''}>${STATUS_LABELS[k]}</option>`).join('');
        const statusField = t.status === 'issued'
            ? '<div class="full"><label>Статус</label><input value="Выдан (меняется через возврат)" disabled></div>'
            : selectField('Статус', 'status', statuses);
        const html = [
            field('Инвентарный номер', 'inv_number', t.inv_number, { required: true }),
            field('Наименование', 'name', t.name, { required: true }),
            selectField('Категория', 'category_id', options(this.categories, 'id', 'name', t.category_id), { required: true }),
            field('Производитель', 'manufacturer', t.manufacturer),
            field('Дата покупки', 'purchase_date', t.purchase_date, { type: 'date' }),
            field('Цена, руб.', 'price', t.price ?? 0, { type: 'number', attrs: 'min="0" step="0.01"' }),
            field('Место хранения', 'location', t.location),
            toolId ? statusField : '',
            field('Примечание', 'note', t.note, { full: true }),
        ].join('');
        openForm(toolId ? 'Изменение инструмента' : 'Новый инструмент', html, async (data) => {
            if (t.status === 'issued') delete data.status;
            if (toolId) await api.put(`/api/tools/${toolId}`, data); else await api.post('/api/tools', data);
            toast('Сохранено');
            await this.loadList();
        });
    }

    async remove(toolId) {
        const t = this.tools.find((x) => x.id === toolId);
        if (!confirm(`Удалить инструмент «${t.name}»?`)) return;
        await api.delete(`/api/tools/${toolId}`);
        toast('Инструмент удалён');
        await this.loadList();
    }
}

export class IssuesView extends View {
    constructor(root) { super(root); this.onlyActive = true; }

    async render() {
        this.root.innerHTML = `
            <div class="toolbar">
                <h2>Выдача и возврат</h2>
                <label><input type="checkbox" id="onlyActive" style="width:auto" ${this.onlyActive ? 'checked' : ''}> только невозвращённые</label>
                <span class="grow"></span>
                <button class="btn primary" data-action="issue">Выдать инструмент</button>
            </div>
            <div id="list"></div>`;
        this.root.querySelector('#onlyActive').onchange = (e) => { this.onlyActive = e.target.checked; this.loadList(); };
        this.bindActions({ issue: () => this.issue(), return: (id) => this.giveBack(id) });
        await this.loadList();
    }

    async loadList() {
        this.issues = await api.get('/api/issues' + (this.onlyActive ? '?active=1' : ''));
        const list = this.root.querySelector('#list');
        if (!this.issues.length) { list.innerHTML = '<div class="empty">Записей о выдаче нет</div>'; return; }
        list.innerHTML = `<table>
            <thead><tr><th>Инструмент</th><th>Сотрудник</th><th>Выдан</th><th>Вернуть до</th><th>Возвращён</th><th>Состояние</th><th></th></tr></thead>
            <tbody>${this.issues.map((i) => `<tr class="${i.overdue ? 'overdue' : ''}">
                <td>${esc(i.inv_number)} — ${esc(i.tool_name)}</td>
                <td>${esc(i.employee_name)}</td>
                <td>${formatDate(i.issued_at)}</td>
                <td>${formatDate(i.due_at)} ${i.overdue ? '<span class="badge overdue">просрочено</span>' : ''}</td>
                <td>${formatDate(i.returned_at)}</td>
                <td>${esc(i.condition_note || '')}</td>
                <td class="actions">${i.returned_at ? '' : `<button class="btn small" data-action="return" data-id="${i.id}">Принять возврат</button>`}</td>
            </tr>`).join('')}</tbody></table>`;
    }

    async issue() {
        const [tools, employees] = await Promise.all([api.get('/api/tools?status=in_stock'), api.get('/api/employees')]);
        if (!tools.length) { toast('Нет инструментов, доступных для выдачи', true); return; }
        const toolOpts = tools.map((t) => `<option value="${t.id}">${esc(t.inv_number)} — ${esc(t.name)}</option>`).join('');
        const html = [
            selectField('Инструмент', 'tool_id', toolOpts, { full: true, required: true }),
            selectField('Сотрудник', 'employee_id', options(employees, 'id', 'full_name'), { full: true, required: true }),
            field('Дата выдачи', 'issued_at', todayIso(), { type: 'date', required: true }),
            field('Вернуть до', 'due_at', todayIso(7), { type: 'date', required: true }),
        ].join('');
        openForm('Выдача инструмента', html, async (data) => {
            await api.post('/api/issues', data);
            toast('Инструмент выдан');
            await this.loadList();
        }, 'Выдать');
    }

    giveBack(issueId) {
        const i = this.issues.find((x) => x.id === issueId);
        const html = `<div class="full"><b>${esc(i.inv_number)} — ${esc(i.tool_name)}</b><br>Сотрудник: ${esc(i.employee_name)}</div>`
            + field('Дата возврата', 'returned_at', todayIso(), { type: 'date', required: true })
            + field('Состояние при возврате', 'condition_note', 'Исправен')
            + `<div class="full"><label><input type="checkbox" name="to_repair" value="true" style="width:auto"> Направить в ремонт</label></div>`;
        openForm('Приём возврата', html, async (data) => {
            await api.post(`/api/issues/${issueId}/return`, { ...data, to_repair: data.to_repair === 'true' });
            toast('Возврат оформлен');
            await this.loadList();
        }, 'Принять');
    }
}

export class EmployeesView extends View {
    constructor(root) { super(root); this.q = ''; }

    async render() {
        this.root.innerHTML = `
            <div class="toolbar">
                <h2>Сотрудники</h2>
                <div class="grow"><input type="search" id="fq" placeholder="Поиск по ФИО или подразделению" value="${esc(this.q)}"></div>
                <button class="btn primary" data-action="add">Добавить сотрудника</button>
            </div>
            <div id="list"></div>`;
        let timer;
        this.root.querySelector('#fq').oninput = (e) => {
            this.q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(() => this.loadList(), 250);
        };
        this.bindActions({ add: () => this.edit(), edit: (id) => this.edit(id), remove: (id) => this.remove(id) });
        await this.loadList();
    }

    async loadList() {
        this.items = await api.get('/api/employees' + ApiClient.query({ q: this.q }));
        const list = this.root.querySelector('#list');
        if (!this.items.length) { list.innerHTML = '<div class="empty">Сотрудники не найдены</div>'; return; }
        list.innerHTML = `<table>
            <thead><tr><th>ФИО</th><th>Должность</th><th>Подразделение</th><th>Телефон</th><th class="num">На руках</th><th></th></tr></thead>
            <tbody>${this.items.map((e) => `<tr>
                <td>${esc(e.full_name)}</td><td>${esc(e.position || '—')}</td><td>${esc(e.department || '—')}</td>
                <td>${esc(e.phone || '—')}</td><td class="num">${e.active_issues}</td>
                <td class="actions">
                    <button class="btn small" data-action="edit" data-id="${e.id}">Изменить</button>
                    <button class="btn small danger" data-action="remove" data-id="${e.id}">Удалить</button>
                </td></tr>`).join('')}</tbody></table>`;
    }

    edit(employeeId) {
        const e = employeeId ? this.items.find((x) => x.id === employeeId) : {};
        const html = field('ФИО', 'full_name', e.full_name, { full: true, required: true })
            + field('Должность', 'position', e.position)
            + field('Подразделение', 'department', e.department)
            + field('Телефон', 'phone', e.phone, { full: true });
        openForm(employeeId ? 'Изменение сотрудника' : 'Новый сотрудник', html, async (data) => {
            if (employeeId) await api.put(`/api/employees/${employeeId}`, data); else await api.post('/api/employees', data);
            toast('Сохранено');
            await this.loadList();
        });
    }

    async remove(employeeId) {
        const e = this.items.find((x) => x.id === employeeId);
        if (!confirm(`Удалить сотрудника «${e.full_name}»?`)) return;
        await api.delete(`/api/employees/${employeeId}`);
        toast('Сотрудник удалён');
        await this.loadList();
    }
}

export class CategoriesView extends View {
    async render() {
        this.root.innerHTML = `
            <div class="toolbar"><h2>Категории инструментов</h2><span class="grow"></span>
                <button class="btn primary" data-action="add">Добавить категорию</button></div>
            <div id="list"></div>`;
        this.bindActions({ add: () => this.edit(), edit: (id) => this.edit(id), remove: (id) => this.remove(id) });
        await this.loadList();
    }

    async loadList() {
        this.items = await api.get('/api/categories');
        this.root.querySelector('#list').innerHTML = `<table>
            <thead><tr><th>Название</th><th class="num">Инструментов</th><th></th></tr></thead>
            <tbody>${this.items.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.tools_count}</td>
                <td class="actions">
                    <button class="btn small" data-action="edit" data-id="${c.id}">Изменить</button>
                    <button class="btn small danger" data-action="remove" data-id="${c.id}">Удалить</button>
                </td></tr>`).join('')}</tbody></table>`;
    }

    edit(categoryId) {
        const c = categoryId ? this.items.find((x) => x.id === categoryId) : {};
        openForm(categoryId ? 'Изменение категории' : 'Новая категория',
            field('Название', 'name', c.name, { full: true, required: true }), async (data) => {
                if (categoryId) await api.put(`/api/categories/${categoryId}`, data); else await api.post('/api/categories', data);
                toast('Сохранено');
                await this.loadList();
            });
    }

    async remove(categoryId) {
        const c = this.items.find((x) => x.id === categoryId);
        if (!confirm(`Удалить категорию «${c.name}»?`)) return;
        await api.delete(`/api/categories/${categoryId}`);
        toast('Категория удалена');
        await this.loadList();
    }
}

export class StatsView extends View {
    async render() {
        const s = await api.get('/api/stats');
        const overdue = await api.get('/api/issues?overdue=1');
        this.root.innerHTML = `
            <div class="toolbar"><h2>Отчёт по инструментам</h2></div>
            <div class="cards">
                <div class="card"><div class="value">${s.total_tools}</div><div class="label">Инструментов в учёте</div></div>
                <div class="card"><div class="value">${formatMoney(s.total_cost)}</div><div class="label">Стоимость парка</div></div>
                <div class="card"><div class="value">${s.counts.in_stock}</div><div class="label">На складе</div></div>
                <div class="card"><div class="value">${s.counts.issued}</div><div class="label">Выдано</div></div>
                <div class="card"><div class="value">${s.counts.repair}</div><div class="label">В ремонте</div></div>
                <div class="card ${s.overdue ? 'bad' : ''}"><div class="value">${s.overdue}</div><div class="label">Просрочено возвратов</div></div>
            </div>
            <div class="two-col">
                <div><h3>По категориям</h3><table><thead><tr><th>Категория</th><th class="num">Шт.</th><th class="num">Стоимость</th></tr></thead>
                    <tbody>${s.byCategory.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.n}</td><td class="num">${formatMoney(c.cost)}</td></tr>`).join('')}</tbody></table></div>
                <div><h3>Больше всего инструментов на руках</h3>${s.topEmployees.length
        ? `<table><thead><tr><th>Сотрудник</th><th class="num">Шт.</th></tr></thead><tbody>${s.topEmployees.map((e) => `<tr><td>${esc(e.full_name)}</td><td class="num">${e.n}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Нет невозвращённых инструментов</div>'}</div>
            </div>
            <h3>Просроченные возвраты</h3>
            ${overdue.length ? `<table><thead><tr><th>Инструмент</th><th>Сотрудник</th><th>Подразделение</th><th>Вернуть до</th></tr></thead>
                <tbody>${overdue.map((i) => `<tr class="overdue"><td>${esc(i.inv_number)} — ${esc(i.tool_name)}</td><td>${esc(i.employee_name)}</td>
                <td>${esc(i.department || '—')}</td><td>${formatDate(i.due_at)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty">Просроченных возвратов нет</div>'}`;
    }
}
