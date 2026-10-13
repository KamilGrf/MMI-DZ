'use strict';
// Точка входа: node server.js  (переменные окружения: PORT, DB_PATH)
const path = require('node:path');
const { Database } = require('./src/db');
const { App } = require('./src/app');

const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.DB_PATH || path.join(__dirname, 'data', 'tools.db');

const database = new Database(dbFile);
database.seedIfEmpty();

const app = new App(database, path.join(__dirname, 'public'));
app.listen(port).then((p) => {
    console.log(`АС «Учёт инструментов» запущена: http://localhost:${p}`);
    console.log(`База данных: ${dbFile}`);
});
