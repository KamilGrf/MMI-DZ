'use strict';
// Слой доступа к данным: по одному классу-репозиторию на таблицу.

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const STATUSES = ['in_stock', 'issued', 'repair', 'written_off'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value, field, { required = false, max = 200 } = {}) {
    const s = value === undefined || value === null ? '' : String(value).trim();
    if (required && !s) throw new HttpError(400, `Поле «${field}» обязательно для заполнения`);
    if (s.length > max) throw new HttpError(400, `Поле «${field}» длиннее ${max} символов`);
    return s || null;
}

function date(value, field, { required = false } = {}) {
    const s = text(value, field, { required, max: 10 });
    if (s && (!DATE_RE.test(s) || Number.isNaN(Date.parse(s)))) {
        throw new HttpError(400, `Поле «${field}» должно быть датой в формате ГГГГ-ММ-ДД`);
    }
    return s;
}

function id(value, field) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Некорректное значение поля «${field}»`);
    return n;
}

function uniqueViolation(err, message) {
    if (err && /UNIQUE constraint failed/.test(err.message)) throw new HttpError(409, message);
    throw err;
}

class CategoryRepository {
    constructor(database) { this.d = database; }

    list() {
        return this.d.all(`
            SELECT c.id, c.name, COUNT(t.id) AS tools_count
            FROM categories c LEFT JOIN tools t ON t.category_id = c.id
            GROUP BY c.id ORDER BY c.name`);
    }

    get(categoryId) {
        const row = this.d.get('SELECT id, name FROM categories WHERE id = ?', categoryId);
        if (!row) throw new HttpError(404, 'Категория не найдена');
        return row;
    }

    create(body) {
        const name = text(body.name, 'Название', { required: true, max: 80 });
        try {
            const r = this.d.run('INSERT INTO categories(name) VALUES (?)', name);
            return this.get(Number(r.lastInsertRowid));
        } catch (err) { return uniqueViolation(err, 'Категория с таким названием уже существует'); }
    }

    update(categoryId, body) {
        this.get(categoryId);
        const name = text(body.name, 'Название', { required: true, max: 80 });
        try {
            this.d.run('UPDATE categories SET name = ? WHERE id = ?', name, categoryId);
            return this.get(categoryId);
        } catch (err) { return uniqueViolation(err, 'Категория с таким названием уже существует'); }
    }

    remove(categoryId) {
        this.get(categoryId);
        const used = this.d.get('SELECT COUNT(*) AS n FROM tools WHERE category_id = ?', categoryId).n;
        if (used > 0) throw new HttpError(409, 'Нельзя удалить категорию, в которой есть инструменты');
        this.d.run('DELETE FROM categories WHERE id = ?', categoryId);
    }
}

class ToolRepository {
    constructor(database) { this.d = database; }

    static SELECT = `
        SELECT t.id, t.inv_number, t.name, t.category_id, c.name AS category,
               t.manufacturer, t.purchase_date, t.price, t.status, t.location, t.note
        FROM tools t JOIN categories c ON c.id = t.category_id`;

    list({ q, category, status } = {}) {
        const where = []; const params = [];
        if (q) {
            where.push('(t.name LIKE ? OR t.inv_number LIKE ? OR t.manufacturer LIKE ?)');
            const like = `%${q}%`; params.push(like, like, like);
        }
        if (category) { where.push('t.category_id = ?'); params.push(id(category, 'Категория')); }
        if (status) {
            if (!STATUSES.includes(status)) throw new HttpError(400, 'Неизвестный статус');
            where.push('t.status = ?'); params.push(status);
        }
        const sql = `${ToolRepository.SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY t.inv_number`;
        return this.d.all(sql, ...params);
    }

    get(toolId) {
        const row = this.d.get(`${ToolRepository.SELECT} WHERE t.id = ?`, toolId);
        if (!row) throw new HttpError(404, 'Инструмент не найден');
        return row;
    }

    static parse(body) {
        const price = Number(body.price === undefined || body.price === '' ? 0 : body.price);
        if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Цена должна быть неотрицательным числом');
        return {
            inv_number: text(body.inv_number, 'Инвентарный номер', { required: true, max: 30 }),
            name: text(body.name, 'Наименование', { required: true, max: 120 }),
            category_id: id(body.category_id, 'Категория'),
            manufacturer: text(body.manufacturer, 'Производитель', { max: 80 }),
            purchase_date: date(body.purchase_date, 'Дата покупки'),
            price,
            location: text(body.location, 'Место хранения', { max: 120 }),
            note: text(body.note, 'Примечание', { max: 300 }),
        };
    }

    create(body) {
        const t = ToolRepository.parse(body);
        new CategoryRepository(this.d).get(t.category_id);
        try {
            const r = this.d.run(
                `INSERT INTO tools(inv_number,name,category_id,manufacturer,purchase_date,price,location,note)
                 VALUES (?,?,?,?,?,?,?,?)`,
                t.inv_number, t.name, t.category_id, t.manufacturer, t.purchase_date, t.price, t.location, t.note);
            return this.get(Number(r.lastInsertRowid));
        } catch (err) { return uniqueViolation(err, 'Инструмент с таким инвентарным номером уже есть'); }
    }

    update(toolId, body) {
        const current = this.get(toolId);
        const t = ToolRepository.parse(body);
        new CategoryRepository(this.d).get(t.category_id);
        let status = current.status;
        if (body.status !== undefined && body.status !== current.status) {
            status = body.status;
            if (!STATUSES.includes(status)) throw new HttpError(400, 'Неизвестный статус');
            if (current.status === 'issued' || status === 'issued') {
                throw new HttpError(409, 'Статус «Выдан» меняется только через выдачу и возврат инструмента');
            }
        }
        try {
            this.d.run(
                `UPDATE tools SET inv_number=?, name=?, category_id=?, manufacturer=?, purchase_date=?,
                        price=?, location=?, note=?, status=? WHERE id=?`,
                t.inv_number, t.name, t.category_id, t.manufacturer, t.purchase_date, t.price, t.location, t.note, status, toolId);
            return this.get(toolId);
        } catch (err) { return uniqueViolation(err, 'Инструмент с таким инвентарным номером уже есть'); }
    }

    remove(toolId) {
        this.get(toolId);
        const n = this.d.get('SELECT COUNT(*) AS n FROM issues WHERE tool_id = ?', toolId).n;
        if (n > 0) throw new HttpError(409, 'Нельзя удалить инструмент с историей выдач; спишите его (статус «Списан»)');
        this.d.run('DELETE FROM tools WHERE id = ?', toolId);
    }
}

class EmployeeRepository {
    constructor(database) { this.d = database; }

    list({ q } = {}) {
        const like = `%${q || ''}%`;
        return this.d.all(`
            SELECT e.id, e.full_name, e.position, e.department, e.phone,
                   (SELECT COUNT(*) FROM issues i WHERE i.employee_id = e.id AND i.returned_at IS NULL) AS active_issues
            FROM employees e
            WHERE e.full_name LIKE ? OR e.department LIKE ?
            ORDER BY e.full_name`, like, like);
    }

    get(employeeId) {
        const row = this.d.get('SELECT id, full_name, position, department, phone FROM employees WHERE id = ?', employeeId);
        if (!row) throw new HttpError(404, 'Сотрудник не найден');
        return row;
    }

    static parse(body) {
        return {
            full_name: text(body.full_name, 'ФИО', { required: true, max: 120 }),
            position: text(body.position, 'Должность', { max: 80 }),
            department: text(body.department, 'Подразделение', { max: 80 }),
            phone: text(body.phone, 'Телефон', { max: 30 }),
        };
    }

    create(body) {
        const e = EmployeeRepository.parse(body);
        const r = this.d.run('INSERT INTO employees(full_name,position,department,phone) VALUES (?,?,?,?)',
            e.full_name, e.position, e.department, e.phone);
        return this.get(Number(r.lastInsertRowid));
    }

    update(employeeId, body) {
        this.get(employeeId);
        const e = EmployeeRepository.parse(body);
        this.d.run('UPDATE employees SET full_name=?, position=?, department=?, phone=? WHERE id=?',
            e.full_name, e.position, e.department, e.phone, employeeId);
        return this.get(employeeId);
    }

    remove(employeeId) {
        this.get(employeeId);
        const n = this.d.get('SELECT COUNT(*) AS n FROM issues WHERE employee_id = ?', employeeId).n;
        if (n > 0) throw new HttpError(409, 'Нельзя удалить сотрудника, за которым числятся выдачи (в том числе закрытые)');
        this.d.run('DELETE FROM employees WHERE id = ?', employeeId);
    }
}

class IssueRepository {
    constructor(database) { this.d = database; }

    static SELECT = `
        SELECT i.id, i.tool_id, t.inv_number, t.name AS tool_name,
               i.employee_id, e.full_name AS employee_name, e.department,
               i.issued_at, i.due_at, i.returned_at, i.condition_note,
               CASE WHEN i.returned_at IS NULL AND i.due_at < date('now','localtime') THEN 1 ELSE 0 END AS overdue
        FROM issues i
        JOIN tools t ON t.id = i.tool_id
        JOIN employees e ON e.id = i.employee_id`;

    list({ active, overdue, employee, tool } = {}) {
        const where = []; const params = [];
        if (active === '1') where.push('i.returned_at IS NULL');
        if (overdue === '1') where.push("i.returned_at IS NULL AND i.due_at < date('now','localtime')");
        if (employee) { where.push('i.employee_id = ?'); params.push(id(employee, 'Сотрудник')); }
        if (tool) { where.push('i.tool_id = ?'); params.push(id(tool, 'Инструмент')); }
        const sql = `${IssueRepository.SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY i.issued_at DESC, i.id DESC`;
        return this.d.all(sql, ...params);
    }

    get(issueId) {
        const row = this.d.get(`${IssueRepository.SELECT} WHERE i.id = ?`, issueId);
        if (!row) throw new HttpError(404, 'Запись о выдаче не найдена');
        return row;
    }
}

module.exports = {
    HttpError, STATUSES, text, date, id,
    CategoryRepository, ToolRepository, EmployeeRepository, IssueRepository,
};
