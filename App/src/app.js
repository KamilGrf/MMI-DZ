'use strict';
// HTTP-слой: маршрутизация REST API и раздача статических файлов клиента.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
    HttpError, CategoryRepository, ToolRepository, EmployeeRepository, IssueRepository,
} = require('./repositories');
const { IssueService } = require('./services');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

class App {
    constructor(database, publicDir) {
        this.publicDir = publicDir;
        this.categories = new CategoryRepository(database);
        this.tools = new ToolRepository(database);
        this.employees = new EmployeeRepository(database);
        this.issues = new IssueRepository(database);
        this.service = new IssueService(database);
        this.routes = this.buildRoutes();
        this.server = http.createServer((req, res) => this.handle(req, res));
    }

    /** Таблица маршрутов: [метод, шаблон пути, обработчик]. */
    buildRoutes() {
        const r = [];
        const add = (method, pattern, fn) => {
            const keys = [];
            const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; }) + '$');
            r.push({ method, re, keys, fn });
        };
        add('GET', '/api/categories', () => this.categories.list());
        add('POST', '/api/categories', (c) => this.categories.create(c.body));
        add('PUT', '/api/categories/:id', (c) => this.categories.update(c.p.id, c.body));
        add('DELETE', '/api/categories/:id', (c) => this.categories.remove(c.p.id));

        add('GET', '/api/tools', (c) => this.tools.list(c.query));
        add('GET', '/api/tools/:id', (c) => this.tools.get(c.p.id));
        add('POST', '/api/tools', (c) => this.tools.create(c.body));
        add('PUT', '/api/tools/:id', (c) => this.tools.update(c.p.id, c.body));
        add('DELETE', '/api/tools/:id', (c) => this.tools.remove(c.p.id));

        add('GET', '/api/employees', (c) => this.employees.list(c.query));
        add('POST', '/api/employees', (c) => this.employees.create(c.body));
        add('PUT', '/api/employees/:id', (c) => this.employees.update(c.p.id, c.body));
        add('DELETE', '/api/employees/:id', (c) => this.employees.remove(c.p.id));

        add('GET', '/api/issues', (c) => this.issues.list(c.query));
        add('POST', '/api/issues', (c) => this.service.issueTool(c.body));
        add('POST', '/api/issues/:id/return', (c) => this.service.returnTool(c.p.id, c.body));

        add('GET', '/api/stats', () => this.service.stats());
        add('GET', '/api/report/overdue.csv', () => ({ csv: this.service.overdueCsv() }));
        return r;
    }

    async handle(req, res) {
        try {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname.startsWith('/api/')) {
                await this.handleApi(req, res, url);
            } else {
                this.serveStatic(res, url.pathname);
            }
        } catch (err) {
            this.sendError(res, err);
        }
    }

    async handleApi(req, res, url) {
        let known = false;
        for (const route of this.routes) {
            const m = route.re.exec(url.pathname);
            if (!m) continue;
            known = true;
            if (route.method !== req.method) continue;
            const p = {};
            route.keys.forEach((k, i) => { p[k] = Number(m[i + 1]); });
            const body = ['POST', 'PUT'].includes(req.method) ? await this.readJson(req) : {};
            const result = route.fn({ p, body, query: Object.fromEntries(url.searchParams) });
            if (result === undefined) {
                res.writeHead(204); res.end();
            } else if (typeof result.csv === 'string') {
                res.writeHead(200, {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="overdue.csv"',
                });
                res.end(result.csv);
            } else {
                this.sendJson(res, req.method === 'POST' && !/\/return$/.test(url.pathname) ? 201 : 200, result);
            }
            return;
        }
        throw new HttpError(known ? 405 : 404, known ? 'Метод не поддерживается' : 'Ресурс не найден');
    }

    readJson(req) {
        return new Promise((resolve, reject) => {
            const chunks = []; let size = 0;
            req.on('data', (c) => {
                size += c.length;
                if (size > 1_000_000) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); return; }
                chunks.push(c);
            });
            req.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                if (!raw.trim()) return resolve({});
                try { resolve(JSON.parse(raw)); } catch { reject(new HttpError(400, 'Некорректный JSON в теле запроса')); }
            });
            req.on('error', reject);
        });
    }

    serveStatic(res, pathname) {
        let rel;
        try { rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); } catch { throw new HttpError(400, 'Некорректный адрес'); }
        if (rel.includes('\0')) throw new HttpError(400, 'Некорректный адрес');
        const file = path.normalize(path.join(this.publicDir, rel));
        if (!file.startsWith(this.publicDir + path.sep)) throw new HttpError(403, 'Доступ запрещён');
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new HttpError(404, 'Файл не найден');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    }

    sendJson(res, status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    }

    sendError(res, err) {
        const status = err instanceof HttpError ? err.status : 500;
        if (status === 500) console.error(err);
        this.sendJson(res, status, { error: status === 500 ? 'Внутренняя ошибка сервера' : err.message });
    }

    listen(port, host = '127.0.0.1') {
        return new Promise((resolve) => this.server.listen(port, host, () => resolve(this.server.address().port)));
    }

    close() {
        return new Promise((resolve) => this.server.close(resolve));
    }
}

module.exports = { App };
