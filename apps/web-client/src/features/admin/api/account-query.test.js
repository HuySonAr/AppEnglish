import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { adminAccountListParams } from './account-query.js';

test('initial Admin filters omit empty role/status from the actual Axios URL', () => {
  const filters = { email: '', role: '', status: '', page: 1, pageSize: 20 };
  const uri = axios.getUri({
    url: '/auth/admin/accounts',
    params: adminAccountListParams(filters),
  });
  assert.equal(uri, '/auth/admin/accounts?page=1&pageSize=20');
  assert.equal(filters.status, '');
});

test('selected filters survive serialization and clearing them restores omission', () => {
  const filters = { role: 'ADMIN', status: 'SUSPENDED', page: 2, pageSize: 20 };
  const uri = axios.getUri({ url: '/auth/admin/accounts', params: adminAccountListParams(filters) });
  const query = new URL(uri, 'http://localhost').searchParams;
  assert.equal(query.get('role'), 'ADMIN');
  assert.equal(query.get('status'), 'SUSPENDED');
  assert.equal(query.get('page'), '2');
  const cleared = adminAccountListParams({ ...filters, role: '', status: '', page: 1 });
  assert.deepEqual(cleared, { page: 1, pageSize: 20 });
});

test('nonempty invalid filters are preserved for backend validation', () => {
  assert.equal(adminAccountListParams({ status: 'INVALID' }).status, 'INVALID');
});
