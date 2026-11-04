// Sustituye a `@playwright/test` en los e2e. Si COBERTURA=1, recoge la cobertura V8 de
// cada página (el código que de verdad ejecuta el navegador) en coverage/v8-e2e/.
// Sin COBERTURA no cambia nada.
import { test as base, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../coverage/v8-e2e/', import.meta.url));

export const test = base.extend({
  context: async ({ context }, use) => {
    if (!process.env.COBERTURA) return use(context);

    const activas = new Map(); // page -> true si la cobertura está en marcha
    const recogidas = [];

    const empezar = async (page) => {
      // Solo Chromium tiene cobertura JS (CDP); en WebKit la página se usa sin medir.
      if (activas.has(page) || page.context().browser().browserType().name() !== 'chromium') return;
      activas.set(page, true);
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
    };
    // Para cada página, guarda sus scripts y para la cobertura. Se llama antes de cerrar.
    const parar = async (page) => {
      if (!activas.get(page)) return;
      activas.set(page, false);
      recogidas.push(...(await page.coverage.stopJSCoverage()));
    };
    const volcar = async () => {
      for (const page of activas.keys()) {
        if (!page.isClosed()) await parar(page);
      }
      if (recogidas.length) {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(`${DIR}${randomUUID()}.json`, JSON.stringify(recogidas));
        recogidas.length = 0;
      }
    };

    context.on('page', (page) => empezar(page));
    for (const page of context.pages()) await empezar(page);

    // Antes de cerrar una página o un contexto, se guarda su cobertura.
    const cerrarContexto = context.close.bind(context);
    context.close = async (opciones) => {
      await volcar();
      return cerrarContexto(opciones);
    };
    for (const page of context.pages()) {
      const cerrarPagina = page.close.bind(page);
      page.close = async (opciones) => {
        await parar(page);
        return cerrarPagina(opciones);
      };
    }
    context.on('page', (page) => {
      const cerrarPagina = page.close.bind(page);
      page.close = async (opciones) => {
        await parar(page);
        return cerrarPagina(opciones);
      };
    });

    await use(context);
    await volcar();
  },
});

export { expect };
