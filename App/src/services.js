'use strict';
// Бизнес-логика: выдача и возврат инструмента, статистика.
const { HttpError, text, date, id, ToolRepository, EmployeeRepository, IssueRepository } = require('./repositories');

function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

class IssueService {
    constructor(database) {
        this.d = database;
        this.tools = new ToolRepository(database);
        this.employees = new EmployeeRepository(database);
        this.issues = new IssueRepository(database);
    }

    /** Выдать инструмент сотруднику (use case «Выдать инструмент»). */
    issueTool(body) {
        const toolId = id(body.tool_id, 'Инструмент');
        const employeeId = id(body.employee_id, 'Сотрудник');
        const issuedAt = date(body.issued_at, 'Дата выдачи') || todayLocal();
        const dueAt = date(body.due_at, 'Срок возврата', { required: true });
        if (dueAt < issuedAt) throw new HttpError(400, 'Срок возврата не может быть раньше даты выдачи');

        const newId = this.d.transaction(() => {
            const tool = this.tools.get(toolId);
            this.employees.get(employeeId);
            if (tool.status !== 'in_stock') {
                const reasons = { issued: 'уже выдан', repair: 'находится в ремонте', written_off: 'списан' };
                throw new HttpError(409, `Инструмент нельзя выдать: он ${reasons[tool.status]}`);
            }
            const r = this.d.run(
                'INSERT INTO issues(tool_id, employee_id, issued_at, due_at) VALUES (?,?,?,?)',
                toolId, employeeId, issuedAt, dueAt);
            this.d.run("UPDATE tools SET status = 'issued' WHERE id = ?", toolId);
            return Number(r.lastInsertRowid);
        });
        return this.issues.get(newId);
    }

    /** Принять инструмент обратно (use case «Принять возврат»). */
    returnTool(issueId, body = {}) {
        const note = text(body.condition_note, 'Состояние при возврате', { max: 300 });
        const returnedAt = date(body.returned_at, 'Дата возврата') || todayLocal();
        const toRepair = body.to_repair === true || body.to_repair === 'true';

        this.d.transaction(() => {
            const issue = this.issues.get(issueId);
            if (issue.returned_at) throw new HttpError(409, 'Инструмент уже возвращён');
            if (returnedAt < issue.issued_at) throw new HttpError(400, 'Дата возврата не может быть раньше даты выдачи');
            this.d.run('UPDATE issues SET returned_at = ?, condition_note = ? WHERE id = ?', returnedAt, note, issueId);
            this.d.run('UPDATE tools SET status = ?, note = COALESCE(?, note) WHERE id = ?',
                toRepair ? 'repair' : 'in_stock', toRepair ? note : null, issue.tool_id);
        });
        return this.issues.get(issueId);
    }

    /** Сводная статистика для отчёта (use case «Просмотреть отчёт»). */
    stats() {
        const byStatus = this.d.all('SELECT status, COUNT(*) AS n FROM tools GROUP BY status');
        const counts = { in_stock: 0, issued: 0, repair: 0, written_off: 0 };
        byStatus.forEach((r) => { counts[r.status] = r.n; });
        const overdue = this.d.get(
            "SELECT COUNT(*) AS n FROM issues WHERE returned_at IS NULL AND due_at < date('now','localtime')").n;
        const total = this.d.get(
            "SELECT COUNT(*) AS n, COALESCE(SUM(price),0) AS cost FROM tools WHERE status <> 'written_off'");
        const byCategory = this.d.all(`
            SELECT c.name, COUNT(t.id) AS n, COALESCE(SUM(t.price),0) AS cost
            FROM categories c LEFT JOIN tools t ON t.category_id = c.id AND t.status <> 'written_off'
            GROUP BY c.id ORDER BY c.name`);
        const topEmployees = this.d.all(`
            SELECT e.full_name, COUNT(*) AS n
            FROM issues i JOIN employees e ON e.id = i.employee_id
            WHERE i.returned_at IS NULL GROUP BY e.id ORDER BY n DESC, e.full_name LIMIT 5`);
        return { counts, overdue, total_tools: total.n, total_cost: total.cost, byCategory, topEmployees };
    }

    /** CSV-выгрузка просроченных возвратов (для Excel: BOM, разделитель «;»). */
    overdueCsv() {
        const today = Date.parse(todayLocal());
        const rows = this.issues.list({ overdue: '1' }).map((i) => [
            i.inv_number, i.tool_name, i.employee_name, i.department, i.issued_at, i.due_at,
            Math.round((today - Date.parse(i.due_at)) / 86400000),
        ]);
        const header = ['Инв. номер', 'Инструмент', 'Сотрудник', 'Подразделение', 'Выдан', 'Срок возврата', 'Дней просрочки'];
        return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
    }
}

/** Экранирование ячейки CSV; значения, похожие на формулы, префиксуются апострофом (CSV-injection). */
function csvCell(value) {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = { IssueService, todayLocal };
