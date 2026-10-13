import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import ReportPage from './pages/ReportPage.jsx';

export default function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Navigate to="/tools" replace />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="issues" element={<IssuesPage />} />
                <Route path="report" element={<ReportPage />} />
                <Route path="*" element={<p className="p-4">Страница не найдена</p>} />
            </Route>
        </Routes>
    );
}
