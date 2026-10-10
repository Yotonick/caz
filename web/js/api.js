import { API_URL } from '../config.js';
import { createDemo } from './demo.js';

const params = new URLSearchParams(location.search);
const apiParam = params.get('api');
// Демо-режим: ?demo=1, либо адрес Worker ещё не заполнен в config.js (там остался шаблон).
export const isDemo = params.get('demo') === '1' || (!apiParam && (!API_URL || /YOUR-SUBDOMAIN/i.test(API_URL)));
const BASE = (apiParam || API_URL).replace(/\/$/, '');
const tg = window.Telegram?.WebApp;

export class ApiError extends Error {
  constructor(status, code, data = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Вне Telegram (локальная разработка) используем фиктивный ID — сервер примет его только при DEV_MODE=1.
function devId() {
  try {
    let id = localStorage.getItem('devId');
    if (!id) {
      id = String(1e9 + Math.floor(Math.random() * 1e9));
      localStorage.setItem('devId', id);
    }
    return id;
  } catch {
    return '1000000001';
  }
}

async function request(method, path, body) {
  const headers = {};
  if (tg?.initData) headers.Authorization = 'tma ' + tg.initData;
  else headers['X-Dev-User'] = devId();
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'server_error', data);
  return data;
}

const real = {
  config: () => request('GET', '/api/config'),
  me: () => request('GET', '/api/me'),
  register: (nick) => request('POST', '/api/register', { nick }),
  spin: (slot, bet) => request('POST', '/api/spin', { slot, bet }),
  bonus: () => request('POST', '/api/bonus'),
  leaderboard: () => request('GET', '/api/leaderboard'),
};

export const api = isDemo ? createDemo(ApiError) : real;
