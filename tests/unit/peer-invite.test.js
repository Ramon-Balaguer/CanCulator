import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeInvite, encodeInvite } from '../../js/logica/peer-sync.js';

test('la invitación lleva la sala y el token, y se lee de vuelta', () => {
  const texto = encodeInvite({ code: 'ABC234', token: 'mi:token' });
  assert.deepEqual(decodeInvite(texto), { code: 'ABC234', token: 'mi:token' });
});

test('una invitación mal formada no se acepta', () => {
  assert.equal(decodeInvite('hola'), null);
  assert.equal(decodeInvite('inventario-casa:ABC:token'), null);
  assert.equal(decodeInvite('inventario-casa:ABC234:'), null);
  assert.equal(decodeInvite('inventario-casa:ABC234'), null);
  assert.equal(decodeInvite(''), null);
});
