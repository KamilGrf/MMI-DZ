// Endpoints of the existing backend (App from DZ1/DZ2). One function per use case.
import { request, query } from './client.js';

export const toolsApi = {
    list: (params) => request('GET', `/api/tools${query(params)}`),
    create: (body) => request('POST', '/api/tools', body),
    update: (id, body) => request('PUT', `/api/tools/${id}`, body),
};

export const issuesApi = {
    list: (params) => request('GET', `/api/issues${query(params)}`),
    issue: (body) => request('POST', '/api/issues', body),
    returnTool: (id, body) => request('POST', `/api/issues/${id}/return`, body),
};

export const employeesApi = { list: (params) => request('GET', `/api/employees${query(params)}`) };
export const categoriesApi = { list: () => request('GET', '/api/categories') };
export const statsApi = { get: () => request('GET', '/api/stats') };

export const OVERDUE_CSV_URL = '/api/report/overdue.csv';
