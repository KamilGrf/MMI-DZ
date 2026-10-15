import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { HomeRedirect, RequireAuth, RequirePermission } from './auth/guards.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import ReportPage from './pages/ReportPage.jsx';

export default function App() {
    return (
        <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                    <Route index element={<HomeRedirect />} />
                    <Route path="tools" element={<RequirePermission permission="tools:read"><ToolsPage /></RequirePermission>} />
                    <Route path="issues" element={<RequirePermission permission="issues:read"><IssuesPage /></RequirePermission>} />
                    <Route path="report" element={<RequirePermission permission="report:read"><ReportPage /></RequirePermission>} />
                    <Route path="*" element={<p className="p-4">Страница не найдена</p>} />
                </Route>
            </Route>
        </Routes>
    );
}
