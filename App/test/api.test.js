'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Database } = require('../src/db');
const { App } = require('../src/app');

let app; let base;

test.before(async () => {
    const db = new Database(':memory:');
    db.seedIfEmpty();
    app = new App(db, path.join(__dirname, '..', 'public'));
    base = `http://127.0.0.1:${await app.listen(0)}`;
});
test.after(() => app.close());

async function call(method, url, body) {
    const res = await fetch(base + url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, data };
}

test('список инструментов и фильтры', async () => {
    const all = await call('GET', '/api/tools');
    assert.equal(all.status, 200);
    assert.equal(all.data.length, 14);
    const found = await call('GET', '/api/tools?q=bosch');
    assert.ok(found.data.length >= 3 && found.data.every((t) => /bosch/i.test(t.name + t.manufacturer)));
    const issued = await call('GET', '/api/tools?status=issued');
    assert.equal(issued.data.length, 2);
});

test('CRUD инструмента, проверка уникальности и валидации', async () => {
    const bad = await call('POST', '/api/tools', { inv_number: '', name: 'X', category_id: 1 });
    assert.equal(bad.status, 400);
    const created = await call('POST', '/api/tools', { inv_number: 'ИНВ-0100', name: 'Рубанок', category_id: 2, price: 990 });
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'in_stock');
    const dup = await call('POST', '/api/tools', { inv_number: 'ИНВ-0100', name: 'Другой', category_id: 2 });
    assert.equal(dup.status, 409);
    const upd = await call('PUT', `/api/tools/${created.data.id}`, { ...created.data, name: 'Рубанок 2', price: 1100 });
    assert.equal(upd.data.name, 'Рубанок 2');
    const del = await call('DELETE', `/api/tools/${created.data.id}`);
    assert.equal(del.status, 204);
    assert.equal((await call('GET', `/api/tools/${created.data.id}`)).status, 404);
});

test('выдача и возврат инструмента', async () => {
    const issue = await call('POST', '/api/issues', { tool_id: 2, employee_id: 4, due_at: '2099-01-01' });
    assert.equal(issue.status, 201);
    assert.equal((await call('GET', '/api/tools/2')).data.status, 'issued');

    const again = await call('POST', '/api/issues', { tool_id: 2, employee_id: 5, due_at: '2099-01-01' });
    assert.equal(again.status, 409);

    const ret = await call('POST', `/api/issues/${issue.data.id}/return`, { condition_note: 'Исправен' });
    assert.equal(ret.status, 200);
    assert.ok(ret.data.returned_at);
    assert.equal((await call('GET', '/api/tools/2')).data.status, 'in_stock');

    const twice = await call('POST', `/api/issues/${issue.data.id}/return`, {});
    assert.equal(twice.status, 409);
});

test('нельзя выдать инструмент в ремонте и с неверным сроком', async () => {
    assert.equal((await call('POST', '/api/issues', { tool_id: 4, employee_id: 1, due_at: '2099-01-01' })).status, 409);
    assert.equal((await call('POST', '/api/issues', { tool_id: 6, employee_id: 1, issued_at: '2030-05-05', due_at: '2030-05-01' })).status, 400);
    assert.equal((await call('POST', '/api/issues', { tool_id: 6, employee_id: 999, due_at: '2099-01-01' })).status, 404);
});

test('возврат в ремонт', async () => {
    const issue = await call('POST', '/api/issues', { tool_id: 7, employee_id: 1, due_at: '2099-01-01' });
    await call('POST', `/api/issues/${issue.data.id}/return`, { condition_note: 'Треснула рукоятка', to_repair: true });
    assert.equal((await call('GET', '/api/tools/7')).data.status, 'repair');
});

test('просроченные выдачи и статистика', async () => {
    const overdue = await call('GET', '/api/issues?overdue=1');
    assert.equal(overdue.data.length, 1);
    assert.equal(overdue.data[0].tool_id, 1);
    const s = await call('GET', '/api/stats');
    assert.equal(s.data.overdue, 1);
    assert.equal(s.data.total_tools, 14);
});

test('ограничения удаления справочников', async () => {
    assert.equal((await call('DELETE', '/api/categories/1')).status, 409);
    assert.equal((await call('DELETE', '/api/employees/1')).status, 409);
    const cat = await call('POST', '/api/categories', { name: 'Тестовая' });
    assert.equal((await call('DELETE', `/api/categories/${cat.data.id}`)).status, 204);
    assert.equal((await call('POST', '/api/categories', { name: 'Ручной инструмент' })).status, 409);
});

test('статус «Выдан» нельзя поставить вручную; списание', async () => {
    const t = (await call('GET', '/api/tools/9')).data;
    assert.equal((await call('PUT', '/api/tools/9', { ...t, status: 'issued' })).status, 409);
    const w = await call('PUT', '/api/tools/9', { ...t, status: 'written_off' });
    assert.equal(w.data.status, 'written_off');
});

test('статические файлы и 404', async () => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Учёт инструментов/);
    assert.equal((await call('GET', '/api/unknown')).status, 404);
    assert.equal((await fetch(base + '/..%2f..%2fserver.js')).status, 403);
});

test('CSV-выгрузка просрочек: заголовки, BOM, строка с просрочкой', async () => {
    const res = await fetch(base + '/api/report/overdue.csv');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /overdue\.csv/);
    const raw = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...raw.subarray(0, 3)], [0xEF, 0xBB, 0xBF]); // BOM для Excel
    const body = raw.toString('utf8').replace(/^﻿/, '');
    const lines = body.trim().split('\r\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /Инв\. номер;Инструмент;Сотрудник/);
    const days = Number(lines[1].split(';').pop());
    assert.ok(days > 0);
});
