import { test } from 'node:test';
import assert from 'node:assert/strict';

// peer-link registra un listener global al cargarse: en Node no existe, así que se simula antes.
globalThis.addEventListener ??= () => {};
const { joinRoom } = await import('../../js/datos/peer-link.js');

// Sin red: el servicio de señalización se simula. El invitado debe avisar y reintentar si la sala no existe.
class FakeConnection {
  on() {}
}

class FakePeer {
  static last = null;
  constructor() {
    this.handlers = {};
    this.destroyed = false;
    FakePeer.last = this;
  }
  on(event, handler) {
    this.handlers[event] = handler;
  }
  connect() {
    return new FakeConnection();
  }
  destroy() {
    this.destroyed = true;
  }
}

test('si la sala no existe, el invitado avisa, se cierra y pide reintentar', () => {
  const previous = globalThis.window;
  globalThis.window = { Peer: FakePeer };
  try {
    const statuses = [];
    let closed = 0;
    joinRoom({
      db: null,
      code: 'ZZZZZZ',
      token: 'token-de-prueba',
      onOps() {},
      onFotos() {},
      onStatus: (status) => statuses.push(status),
      onClosed: () => { closed += 1; },
    });
    const peer = FakePeer.last;
    peer.handlers.open();
    peer.handlers.error({ type: 'peer-unavailable' });

    assert.ok(statuses.some((s) => s.includes('reintentando')), `estados: ${statuses.join(' | ')}`);
    assert.equal(peer.destroyed, true);
    assert.equal(closed, 1);
  } finally {
    globalThis.window = previous;
  }
});
