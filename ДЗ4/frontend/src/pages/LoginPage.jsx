// Demo sign-in: choose a role. There are no passwords because the backend has no authentication yet.
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, ROLE_IDS } from '../auth/roles.js';
import { Button } from '../components/ui.jsx';

export default function LoginPage() {
    const { role, login } = useAuth();
    const location = useLocation();
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');

    // Once the role is set (also when already signed in) go back to where the visitor was heading.
    if (role) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

    const submit = (e) => {
        e.preventDefault();
        if (!login(selected)) setError('Выберите роль для входа');
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow" aria-labelledby="login-title">
                <h1 id="login-title" className="mb-1 text-lg font-semibold">АС «Учёт инструментов»</h1>
                <p className="mb-4 text-sm text-slate-500">Выберите роль для входа в систему</p>
                <fieldset className="mb-3">
                    <legend className="sr-only">Роль</legend>
                    {ROLE_IDS.map((id) => (
                        <label key={id} className="mb-2 flex cursor-pointer items-start gap-2 rounded border border-slate-300 p-3 text-sm has-[:checked]:border-blue-700 has-[:checked]:bg-blue-50">
                            <input
                                type="radio" name="role" value={id} checked={selected === id}
                                onChange={() => { setSelected(id); setError(''); }}
                                className="mt-1"
                            />
                            <span>
                                <span className="block font-semibold">{ROLES[id].label}</span>
                                <span className="text-slate-500">{ROLES[id].description}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
                <Button type="submit" className="w-full">Войти</Button>
            </form>
        </div>
    );
}
