// Genera src/environments/environment.prod.ts a partir de las variables de entorno
// del proceso de build (cualquier host o CI). Angular no lee .env en tiempo de ejecucion.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.API_URL?.trim().replace(/\/+$/, '');

if (!apiUrl) {
  console.error('[set-env] Falta la variable de entorno API_URL para el build de produccion.');
  process.exit(1);
}

// En un build desplegado (CI) el navegador del usuario no puede alcanzar
// el loopback del servidor: se corta el build en vez de publicar una URL inalcanzable.
const isDeployBuild = Boolean(process.env.CI);
const { hostname } = new URL(apiUrl);
const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

if (isDeployBuild && isLoopback) {
  console.error(
    `[set-env] API_URL=${apiUrl} apunta a loopback; configura la URL publica del API en las variables del despliegue.`,
  );
  process.exit(1);
}

const target =fileURLToPath(new URL('../src/environments/environment.prod.ts', import.meta.url));

writeFileSync(
  target,
  `export const environment = {\n  apiUrl: ${JSON.stringify(apiUrl)},\n};\n`,
);

console.log(`[set-env] environment.prod.ts generado con apiUrl=${apiUrl}`);
