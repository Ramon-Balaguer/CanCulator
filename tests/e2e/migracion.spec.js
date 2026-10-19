import { test, expect } from '@playwright/test';

// Una base de datos creada con la versión 1 (fase 2) debe abrir con la versión actual
// y conservar todos sus datos.
test('la base de datos de la versión 1 pasa a la actual sin perder datos', async ({ page }) => {
  await page.goto('./prueba-camara.html');
  await page.evaluate(async () => {
    const abrir = indexedDB.open('inventario-casa', 1);
    await new Promise((resolver, rechazar) => {
      abrir.onupgradeneeded = () => {
        const db = abrir.result;
        db.createObjectStore('Productos', { keyPath: 'id' });
        const lotes = db.createObjectStore('Lotes', { keyPath: 'id' });
        lotes.createIndex('producto_id', 'producto_id');
        db.createObjectStore('Configuracion', { keyPath: 'clave' });
        db.createObjectStore('Operaciones', { keyPath: 'id' });
        db.createObjectStore('Fotos', { keyPath: 'id' });
        db.createObjectStore('Meta', { keyPath: 'clave' });
      };
      abrir.onsuccess = () => {
        const db = abrir.result;
        const tx = db.transaction(['Productos', 'Lotes'], 'readwrite');
        tx.objectStore('Productos').put({ id: 'p-legado', nombre: 'Legado de la v1', categoria: 'otros', codigo_barras: '', stock_minimo: 0, actualizado: '2026-10-01T00:00:00Z', borrado: false });
        tx.objectStore('Lotes').put({ id: 'l-legado', producto_id: 'p-legado', cantidad: 2, caducidad: '2027-01-01', ubicacion: 'Despensa', observaciones: '', foto_id: '', revisar: 'no', actualizado: '2026-10-01T00:00:00Z', borrado: false });
        tx.oncomplete = () => { db.close(); resolver(); };
        tx.onerror = () => rechazar(tx.error);
      };
      abrir.onerror = () => rechazar(abrir.error);
    });
  });

  await page.goto('./');
  await expect(page.locator('li.tarjeta', { hasText: 'Legado de la v1' })).toContainText('2 ud.');
  const version = await page.evaluate(() => new Promise((resolver) => {
    const r = indexedDB.open('inventario-casa');
    r.onsuccess = () => { const v = r.result.version; const tiendas = [...r.result.objectStoreNames]; r.result.close(); resolver({ v, tiendas }); };
  }));
  expect(version.v).toBe(2);
  expect(version.tiendas).toContain('cache_off');
});
