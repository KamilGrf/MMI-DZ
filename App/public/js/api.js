// Клиент REST API. Все ошибки сервера превращаются в исключения с текстом для пользователя.
export class ApiClient {
    async request(method, url, body) {
        const res = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined,
        });
        if (res.status === 204) return null;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
        return data;
    }

    get(url) { return this.request('GET', url); }
    post(url, body = {}) { return this.request('POST', url, body); }
    put(url, body) { return this.request('PUT', url, body); }
    delete(url) { return this.request('DELETE', url); }

    static query(params) {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) q.set(k, v); });
        const s = q.toString();
        return s ? `?${s}` : '';
    }
}
