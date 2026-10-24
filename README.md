# Income Guardian Web

Frontend web de Income Guardian, una aplicación financiera enfocada en claridad, privacidad y control. Está construido con Angular 21, TypeScript, Tailwind CSS 4 y Roboto local.

## Estado actual

- Login conectado a `POST /api/v1/User/login`.
- Validación de email y password en el formulario.
- Sesión temporal guardada en `sessionStorage`.
- Redirección a `/home` después de un login exitoso. Esta ruta muestra actualmente una página vacía.
- Tres temas visuales disponibles: Forest, Paper y Noir.

## Requisitos

- Node.js compatible con Angular 21.
- pnpm `11.17.0`.
- Backend de Income Guardian ejecutándose localmente.

## Instalación

```bash
pnpm install
```

## Configuración local

La URL de desarrollo del backend es:

```text
https://localhost:7151
```

El endpoint utilizado por el login es:

```text
https://localhost:7151/api/v1/User/login
```

La variable `API_URL` se documenta en `.env.example`. Los archivos `.env` locales están ignorados para evitar subir configuraciones específicas del equipo. La configuración efectiva de Angular se encuentra en `src/environments/environment.ts`.

Si el certificado HTTPS local del backend no es confiable, instala el certificado de desarrollo o utiliza temporalmente `http://localhost:5250` y actualiza la configuración correspondiente.

## Desarrollo

Inicia el servidor de desarrollo con:

```bash
pnpm start
```

Abre `http://localhost:4200/`. Angular recarga automáticamente la aplicación al detectar cambios.

## Comandos disponibles

```bash
pnpm start
pnpm build
pnpm test
pnpm exec ng generate component features/example
```

`pnpm build` genera los artefactos en `dist/`. `pnpm test` ejecuta las pruebas unitarias con Vitest y jsdom.

## Despliegue

El proyecto no depende de un proveedor de hosting. Cualquier plataforma debe cumplir dos requisitos:

- Comando de build: `pnpm build` (no `ng build`). El script `scripts/set-env.mjs` genera `src/environments/environment.prod.ts`, que no se versiona; si se ejecuta `ng build` directamente, Angular falla porque ese archivo no existe.
- Variable `API_URL` con la URL pública HTTPS del API, sin barra final. Cuando la variable `CI` está definida (la definen los hosts y pipelines habituales), el build falla si `API_URL` apunta a `localhost`, ya que el navegador del usuario no puede alcanzarla.

El directorio de salida es `dist/frontend-incomeguardian-web/browser`.

## Estructura principal

```text
src/
  app/
    core/auth/             Servicio y modelos de autenticación
    features/auth/         Vista y pruebas del login
    features/home/         Página temporal posterior al login
    app.config.ts          Providers globales
    app.routes.ts          Configuración de rutas
  environments/            Configuración de API
  styles.css               Tokens de temas y estilos globales
public/fonts/              Fuentes Roboto locales
```

## Autenticación

El backend recibe un cuerpo con esta forma:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

La respuesta contiene `UserId`, `Email`, `Name`, `AccessToken`, `RefreshToken` y `ExpiresAt`. Durante esta primera integración se guarda la respuesta completa en `sessionStorage`, por lo que la sesión se elimina al cerrar la pestaña o el navegador según el comportamiento del navegador.

Para una versión de producción se recomienda mover el refresh token a una cookie `HttpOnly`, `Secure` y `SameSite`, y mantener el access token en memoria.

## Convenciones de UI

- Usar Tailwind CSS como primera opción para layout, espaciado y responsive.
- Consumir tokens semánticos de los temas en lugar de colores aislados.
- Usar exclusivamente la fuente Roboto local mediante `font-roboto`.
- Mantener layouts desktop-first que colapsen a una columna en mobile.
- Conservar foco visible y contraste WCAG AA.

## Archivos ignorados

No se deben subir al repositorio credenciales, archivos `.env` locales, certificados, claves privadas, logs, cobertura, cachés, builds ni configuraciones específicas del IDE. `.env.example` sí se versiona porque solo contiene valores de referencia.

## Licencia

Proyecto privado de Income Guardian.
