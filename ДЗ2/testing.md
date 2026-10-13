# Шаг 5. Тест файла правил: без правил и с правилами

## Условия эксперимента

**Задача (одинаковая дословно в обоих прогонах):**

> Добавь в приложение возможность продлить срок возврата выданного инструмента. Нужен API-метод и тест.

Задача небольшая и намеренно сформулирована коротко, как её дал бы пользователь в чате: без шаблона и без перечня требований.

| | Прогон A — без правил | Прогон B — с правилами |
|---|---|---|
| Агент | субагент Claude Code, чистый контекст | субагент Claude Code, чистый контекст |
| Рабочая копия | копия `App` без `CLAUDE.md` | копия `App` + `CLAUDE.md` ([rules.md](rules.md)) |
| Указание агенту | не читать файлы правил | прочитать `CLAUDE.md` и следовать ему |
| Исходное состояние | 10 тестов проходят | 10 тестов проходят |

**Ограничения эксперимента (важно для честной оценки):**
- по одному прогону на вариант, статистики нет — это иллюстрация, а не доказательство;
- прогон A запускался как субагент в той же сессии; его явно просили игнорировать проектные правила, но полностью исключить влияние окружения (например, глобальных пользовательских настроек Claude Code, из-за которых оба ответа написаны по-русски) нельзя;
- оба агента — одна и та же модель, поэтому функциональное качество кода почти одинаково; ценность правил проявляется в формате, дисциплине и согласованности с проектом.

---

## Результат ДО применения правил (сырой ответ агента A)

> Продление срока возврата добавлено: новый метод API `POST /api/issues/:id/extend` с телом `{ "due_at": "ГГГГ-ММ-ДД" }`. Все 11 тестов проходят (`npm test`), включая новый.
>
> **Изменённые файлы** (все в каталоге `without`):
> - `src/services.js` — новый метод `extendIssue(issueId, body)`.
> - `src/app.js` — новый маршрут, и в проверку кода ответа добавлено `extend`, чтобы метод отвечал 200, а не 201.
> - `test/api.test.js` — новый тест «продление срока возврата».
>
> **Как работает метод**
> - Меняет срок возврата только у невозвращённой выдачи и возвращает обновлённую запись.
> - Если дата не указана или новый срок не позже текущего, отвечает 400.
> - Если выдача не найдена, отвечает 404.
> - Если инструмент уже возвращён, отвечает 409.
>
> Тест проверяет успешное продление и все четыре ошибки.
>
> Интерфейс (`public/js`) я не менял: кнопки продления в нём нет.

**Сырой код** (патч [artifacts/ab_without_rules.patch](artifacts/ab_without_rules.patch); построен с игнорированием смены переводов строк, см. наблюдение 1 ниже):

```diff
--- a/src/app.js
+++ b/src/app.js
@@ -55,6 +55,7 @@
         add('GET', '/api/issues', (c) => this.issues.list(c.query));
         add('POST', '/api/issues', (c) => this.service.issueTool(c.body));
         add('POST', '/api/issues/:id/return', (c) => this.service.returnTool(c.p.id, c.body));
+        add('POST', '/api/issues/:id/extend', (c) => this.service.extendIssue(c.p.id, c.body));
 
         add('GET', '/api/stats', () => this.service.stats());
         add('GET', '/api/report/overdue.csv', () => ({ csv: this.service.overdueCsv() }));
@@ -94,7 +95,7 @@
                 });
                 res.end(result.csv);
             } else {
-                this.sendJson(res, req.method === 'POST' && !/\/return$/.test(url.pathname) ? 201 : 200, result);
+                this.sendJson(res, req.method === 'POST' && !/\/(return|extend)$/.test(url.pathname) ? 201 : 200, result);
             }
             return;
         }
--- a/src/services.js
+++ b/src/services.js
@@ -56,6 +56,18 @@
         return this.issues.get(issueId);
     }
 
+    /** Продлить срок возврата выданного инструмента. */
+    extendIssue(issueId, body = {}) {
+        const dueAt = date(body.due_at, 'Новый срок возврата', { required: true });
+        this.d.transaction(() => {
+            const issue = this.issues.get(issueId);
+            if (issue.returned_at) throw new HttpError(409, 'Инструмент уже возвращён');
+            if (dueAt <= issue.due_at) throw new HttpError(400, 'Новый срок должен быть позже текущего срока возврата');
+            this.d.run('UPDATE issues SET due_at = ? WHERE id = ?', dueAt, issueId);
+        });
+        return this.issues.get(issueId);
+    }
+
     /** Сводная статистика для отчёта (use case «Просмотреть отчёт»). */
     stats() {
         const byStatus = this.d.all('SELECT status, COUNT(*) AS n FROM tools GROUP BY status');
--- a/test/api.test.js
+++ b/test/api.test.js
@@ -73,6 +73,18 @@
     assert.equal((await call('POST', '/api/issues', { tool_id: 6, employee_id: 999, due_at: '2099-01-01' })).status, 404);
 });
 
+test('продление срока возврата', async () => {
+    const issue = await call('POST', '/api/issues', { tool_id: 8, employee_id: 1, due_at: '2099-01-01' });
+    const ext = await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-02-01' });
+    assert.equal(ext.status, 200);
+    assert.equal(ext.data.due_at, '2099-02-01');
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-01-15' })).status, 400);
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, {})).status, 400);
+    assert.equal((await call('POST', '/api/issues/9999/extend', { due_at: '2099-03-01' })).status, 404);
+    await call('POST', `/api/issues/${issue.data.id}/return`, {});
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-03-01' })).status, 409);
+});
+
 test('возврат в ремонт', async () => {
     const issue = await call('POST', '/api/issues', { tool_id: 7, employee_id: 1, due_at: '2099-01-01' });
     await call('POST', `/api/issues/${issue.data.id}/return`, { condition_note: 'Треснула рукоятка', to_repair: true });
```

## Результат ПОСЛЕ применения правил (сырой ответ агента B)

> Добавлен метод `POST /api/issues/:id/extend` с телом `{ "due_at": "ГГГГ-ММ-ДД" }`. Он продлевает срок возврата открытой выдачи. `npm test` проходит: 11 тестов из 11, ни один не упал. Клиентский интерфейс (кнопка продления) не трогал, только API.
>
> **Изменённые файлы** (все в `.../scratchpad/with`):
> - `src/app.js` — новый маршрут в `buildRoutes()`. Ответ на этот запрос теперь 200, как у `/return`, а не 201: для этого я правил условие выбора кода ответа в `handleApi`.
> - `src/services.js` — новый метод `IssueService.extendDueDate(issueId, body)`.
> - `test/api.test.js` — новый тест «продление срока возврата». Существующие тесты не менялись.
>
> **Правила метода:**
> - Если `due_at` не передан, или передан не в формате `ГГГГ-ММ-ДД`, или он не позже текущего срока, метод вернёт 400.
> - Если выдачи с таким id нет, вернёт 404.
> - Если инструмент уже возвращён, вернёт 409.
> - При успехе вернёт обновлённую запись о выдаче.
>
> Схему БД и `package.json` я не менял.
>
> **Вопрос:** я решил, что новый срок должен быть строго позже текущего, то есть сократить срок или оставить прежнюю дату нельзя. Если нужно разрешить и сокращение, это правится одной проверкой в `extendDueDate`.
>
> **Результат `npm test`:** tests 11, pass 11, fail 0.

**Сырой код** (патч [artifacts/ab_with_rules.patch](artifacts/ab_with_rules.patch)):

```diff
--- a/src/app.js
+++ b/src/app.js
@@ -55,6 +55,7 @@
         add('GET', '/api/issues', (c) => this.issues.list(c.query));
         add('POST', '/api/issues', (c) => this.service.issueTool(c.body));
         add('POST', '/api/issues/:id/return', (c) => this.service.returnTool(c.p.id, c.body));
+        add('POST', '/api/issues/:id/extend', (c) => this.service.extendDueDate(c.p.id, c.body));
 
         add('GET', '/api/stats', () => this.service.stats());
         add('GET', '/api/report/overdue.csv', () => ({ csv: this.service.overdueCsv() }));
@@ -94,7 +95,7 @@
                 });
                 res.end(result.csv);
             } else {
-                this.sendJson(res, req.method === 'POST' && !/\/return$/.test(url.pathname) ? 201 : 200, result);
+                this.sendJson(res, req.method === 'POST' && !/\/(return|extend)$/.test(url.pathname) ? 201 : 200, result);
             }
             return;
         }
--- a/src/services.js
+++ b/src/services.js
@@ -56,6 +56,19 @@
         return this.issues.get(issueId);
     }
 
+    /** Продлить срок возврата выданного инструмента (use case «Продлить срок возврата»). */
+    extendDueDate(issueId, body = {}) {
+        const dueAt = date(body.due_at, 'Новый срок возврата', { required: true });
+
+        this.d.transaction(() => {
+            const issue = this.issues.get(issueId);
+            if (issue.returned_at) throw new HttpError(409, 'Инструмент уже возвращён, срок продлить нельзя');
+            if (dueAt <= issue.due_at) throw new HttpError(400, 'Новый срок возврата должен быть позже текущего');
+            this.d.run('UPDATE issues SET due_at = ? WHERE id = ?', dueAt, issueId);
+        });
+        return this.issues.get(issueId);
+    }
+
     /** Сводная статистика для отчёта (use case «Просмотреть отчёт»). */
     stats() {
         const byStatus = this.d.all('SELECT status, COUNT(*) AS n FROM tools GROUP BY status');
--- a/test/api.test.js
+++ b/test/api.test.js
@@ -125,3 +125,15 @@
     const days = Number(lines[1].split(';').pop());
     assert.ok(days > 0);
 });
+
+test('продление срока возврата', async () => {
+    const issue = await call('POST', '/api/issues', { tool_id: 8, employee_id: 2, due_at: '2099-01-01' });
+    const ok = await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-02-01' });
+    assert.equal(ok.status, 200);
+    assert.equal(ok.data.due_at, '2099-02-01');
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-02-01' })).status, 400);
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, {})).status, 400);
+    assert.equal((await call('POST', '/api/issues/9999/extend', { due_at: '2099-03-01' })).status, 404);
+    await call('POST', `/api/issues/${issue.data.id}/return`, {});
+    assert.equal((await call('POST', `/api/issues/${issue.data.id}/extend`, { due_at: '2099-03-01' })).status, 409);
+});
```

---

## Сравнение

Результаты `npm test` перепроверены мной после обоих прогонов: в обеих копиях 11 тестов, 11 прошли.

| Критерий | A — без правил | B — с правилами | Правило |
|---|---|---|---|
| Метод работает, ошибки 400 / 404 / 409 | да | да | 9, 15 |
| Тест с успехом и ошибками | да | да | 15 |
| Параметризованный SQL, транзакция | да | да | 11 |
| Валидация через `date()`, сообщения на русском | да | да | 8, 9 |
| Объём изменений в файлах (смена переводов строк) | **все три файла перезаписаны с CRLF**, в исходных — LF; «сырой» дифф `app.js` — около 300 строк ради одной новой строки | точечно: 1 строка маршрута и 1 правка условия в `app.js`, дифф ~60 строк на все файлы | 16 |
| Комментарий с привязкой к use case | общий: «Продлить срок возврата выданного инструмента.» | «… (use case «Продлить срок возврата»)», как в соседних методах | 6 |
| Неоднозначность требования (можно ли сократить срок) | решено молча | вынесено отдельным вопросом | 17 |
| Явное подтверждение границ (схема, `package.json`, старые тесты) | нет | да | 10, 13, 14 |
| Формат ответа: пути файлов + результат `npm test` | пути есть, результат в первой фразе | пути, результат в отдельном блоке, как требует правило | 16 |

### Наблюдения

1. **Шум в диффе.** Агент без правил переписал файлы целиком с другими переводами строк. Код при этом тот же, но в системе контроля версий это выглядит как правка каждой строки и мешает ревью. Почему так произошло именно в этом прогоне, я не выяснял; важно, что правило 16 («точечные изменения, существующий код без причины не переформатировать») такого результата не допускает, и агент B его не допустил.
2. **Функциональное качество одинаково.** Оба решения содержат одну и ту же логику (проверка `due_at <= issue.due_at`, транзакция, те же коды ответов), поэтому честный вывод — правила не сделали код «умнее».
3. **Прозрачность решений.** Агент B заметил, что требование допускает две трактовки (можно ли сократить срок), и сообщил об этом, как требует правило 17; агент A принял то же решение молча.

### Краткий вывод

Файл правил почти не повлиял на корректность кода — простая задача решена верно в обоих случаях, потому что архитектура проекта легко считывается из кода. Улучшилась управляемость результата: правки стали точечными (вместо перезаписи трёх файлов), комментарии и формат ответа совпали с принятыми в проекте, агент явно подтвердил соблюдение запретов (схема, зависимости, существующие тесты) и вынес неоднозначность требования на решение человека.

Эффект правил, вероятно, сильнее на задачах, где есть соблазн нарушить запрет (например, добавить таблицу в схему БД или npm-пакет для CSV). Это в данном эксперименте не проверялось.
