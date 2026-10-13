'use strict';
// Модуль доступа к БД: создание схемы SQLite и начальное заполнение.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tools (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    inv_number    TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    manufacturer  TEXT,
    purchase_date TEXT,
    price         REAL    NOT NULL DEFAULT 0 CHECK (price >= 0),
    status        TEXT    NOT NULL DEFAULT 'in_stock'
                  CHECK (status IN ('in_stock','issued','repair','written_off')),
    location      TEXT,
    note          TEXT
);

CREATE TABLE IF NOT EXISTS employees (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name  TEXT NOT NULL,
    position   TEXT,
    department TEXT,
    phone      TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id        INTEGER NOT NULL REFERENCES tools(id),
    employee_id    INTEGER NOT NULL REFERENCES employees(id),
    issued_at      TEXT    NOT NULL,
    due_at         TEXT    NOT NULL,
    returned_at    TEXT,
    condition_note TEXT,
    CHECK (due_at >= issued_at)
);

-- Один инструмент не может быть одновременно выдан двум сотрудникам.
CREATE UNIQUE INDEX IF NOT EXISTS ux_issues_open_tool
    ON issues(tool_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS ix_issues_employee ON issues(employee_id);
`;

class Database {
    /** @param {string} file путь к файлу БД или ':memory:' */
    constructor(file) {
        if (file !== ':memory:') {
            fs.mkdirSync(path.dirname(file), { recursive: true });
        }
        this.db = new DatabaseSync(file);
        this.db.exec('PRAGMA foreign_keys = ON');
        this.db.exec(SCHEMA);
    }

    /** Выполнить функцию в транзакции; при исключении — откат. */
    transaction(fn) {
        this.db.exec('BEGIN');
        try {
            const result = fn();
            this.db.exec('COMMIT');
            return result;
        } catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }

    all(sql, ...params) { return this.db.prepare(sql).all(...params); }
    get(sql, ...params) { return this.db.prepare(sql).get(...params); }
    run(sql, ...params) { return this.db.prepare(sql).run(...params); }

    /** Заполнить пустую БД демонстрационными данными. */
    seedIfEmpty() {
        if (this.get('SELECT COUNT(*) AS n FROM categories').n > 0) return;
        this.transaction(() => {
            const cats = ['Электроинструмент', 'Ручной инструмент', 'Измерительный инструмент', 'Режущий инструмент', 'Садовый инвентарь'];
            cats.forEach((c) => this.run('INSERT INTO categories(name) VALUES (?)', c));

            const tools = [
                ['ИНВ-0001', 'Дрель ударная Bosch GSB 13 RE', 1, 'Bosch', '2023-03-14', 5200, 'Склад А, стеллаж 1'],
                ['ИНВ-0002', 'Шуруповёрт Makita DF330D', 1, 'Makita', '2023-05-02', 6900, 'Склад А, стеллаж 1'],
                ['ИНВ-0003', 'Перфоратор Metabo KHE 2660', 1, 'Metabo', '2022-11-21', 12400, 'Склад А, стеллаж 2'],
                ['ИНВ-0004', 'Угловая шлифмашина Hitachi G13', 1, 'Hitachi', '2021-09-10', 4800, 'Склад А, стеллаж 2'],
                ['ИНВ-0005', 'Набор отвёрток 12 предметов', 2, 'Stanley', '2024-01-18', 1450, 'Склад Б, ящик 3'],
                ['ИНВ-0006', 'Набор гаечных ключей 8–32 мм', 2, 'Force', '2022-06-30', 3100, 'Склад Б, ящик 3'],
                ['ИНВ-0007', 'Молоток слесарный 500 г', 2, 'Matrix', '2020-02-12', 380, 'Склад Б, ящик 1'],
                ['ИНВ-0008', 'Штангенциркуль цифровой 150 мм', 3, 'Mitutoyo', '2023-08-25', 7800, 'Склад В, шкаф 1'],
                ['ИНВ-0009', 'Лазерный дальномер Bosch GLM 40', 3, 'Bosch', '2024-04-05', 6500, 'Склад В, шкаф 1'],
                ['ИНВ-0010', 'Уровень строительный 80 см', 3, 'Kapro', '2021-12-01', 900, 'Склад В, шкаф 2'],
                ['ИНВ-0011', 'Пила циркулярная Makita 5008MG', 4, 'Makita', '2022-03-17', 11300, 'Склад А, стеллаж 3'],
                ['ИНВ-0012', 'Лобзик электрический Bosch PST 700', 4, 'Bosch', '2023-10-09', 4100, 'Склад А, стеллаж 3'],
                ['ИНВ-0013', 'Секатор садовый Fiskars', 5, 'Fiskars', '2024-03-22', 1250, 'Склад Г'],
                ['ИНВ-0014', 'Газонокосилка электрическая Gardena', 5, 'Gardena', '2022-05-15', 15800, 'Склад Г'],
            ];
            tools.forEach((t) => this.run(
                'INSERT INTO tools(inv_number,name,category_id,manufacturer,purchase_date,price,location) VALUES (?,?,?,?,?,?,?)', ...t));

            const staff = [
                ['Иванов Пётр Сергеевич', 'Слесарь', 'Ремонтный цех', '+7 900 111-22-33'],
                ['Петрова Анна Викторовна', 'Монтажник', 'Монтажный участок', '+7 900 222-33-44'],
                ['Сидоров Олег Николаевич', 'Электрик', 'Энергослужба', '+7 900 333-44-55'],
                ['Кузнецова Мария Андреевна', 'Мастер участка', 'Монтажный участок', '+7 900 444-55-66'],
                ['Фаттахов Рустам Ильдарович', 'Садовник', 'Хозяйственная служба', '+7 900 555-66-77'],
            ];
            staff.forEach((e) => this.run('INSERT INTO employees(full_name,position,department,phone) VALUES (?,?,?,?)', ...e));

            const today = new Date();
            const shift = (d) => {
                const x = new Date(today); x.setDate(x.getDate() + d);
                return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
            };
            // Две действующие выдачи (одна из них просрочена) и одна закрытая.
            const issue = (tool, emp, from, due, ret) => {
                this.run('INSERT INTO issues(tool_id,employee_id,issued_at,due_at,returned_at) VALUES (?,?,?,?,?)', tool, emp, from, due, ret);
                if (!ret) this.run("UPDATE tools SET status='issued' WHERE id=?", tool);
            };
            issue(1, 1, shift(-10), shift(-3), null);
            issue(3, 3, shift(-2), shift(5), null);
            issue(5, 2, shift(-20), shift(-15), shift(-14));
            this.run("UPDATE tools SET status='repair', note='Заменить патрон' WHERE id=4");
        });
    }
}

module.exports = { Database };
