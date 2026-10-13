// Точка входа клиента: переключение разделов.
import { ToolsView, IssuesView, EmployeesView, CategoriesView, StatsView } from './views.js';
import { toast } from './ui.js';

const root = document.getElementById('view');
const views = {
    tools: new ToolsView(root),
    issues: new IssuesView(root),
    employees: new EmployeesView(root),
    categories: new CategoriesView(root),
    stats: new StatsView(root),
};

async function show(name) {
    document.querySelectorAll('#nav .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    root.onclick = null;
    try {
        await views[name].render();
    } catch (err) {
        root.innerHTML = '';
        toast(err.message, true);
    }
    history.replaceState(null, '', `#${name}`);
}

document.getElementById('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) show(btn.dataset.view);
});

show(views[location.hash.slice(1)] ? location.hash.slice(1) : 'tools');
