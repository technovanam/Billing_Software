// Access rules for the /warehouse routes (moved from the website backend).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createFakeAuth } = require('../helpers/fakeFirebase');
const { createWarehouseRouter } = require('../../warehouse/router');

describe('/warehouse access', () => {
  test('owners and wh. accounts pass auth; cashiers and anonymous callers do not', async () => {
    const auth = createFakeAuth();
    const app = express();
    app.use(express.json());
    app.use(createWarehouseRouter({ auth }));
    const server = app.listen(0);
    const url = `http://127.0.0.1:${server.address().port}/warehouse/stock/in`;
    const post = (token) =>
      fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({}),
      });
    try {
      assert.equal((await post()).status, 401);
      const cashier = auth.issue({ uid: 'cashier_b1_CSH-001', role: 'cashier', businessUid: 'b1', cashierId: 'CSH-001' });
      assert.equal((await post(cashier)).status, 403);
      // Past auth, an empty body is rejected by the route's own validation.
      const owner = auth.issue({ uid: 'o1', email: 'owner@x.in' });
      assert.equal((await post(owner)).status, 400);
      const warehouse = auth.issue({ uid: 'w1', email: 'wh.demo@x.in' });
      assert.equal((await post(warehouse)).status, 400);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
