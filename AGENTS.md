# Income Guardian UI Rules

Estas reglas aplican a cualquier nueva vista del frontend y a cualquier mockup creado en OpenPencil.

## Direccion visual

- Producto: Income Guardian, una herramienta financiera calmada, privada y clara.
- Priorizar composiciones web desktop-first que colapsen a una sola columna en mobile.
- Usar una estetica editorial y utilitaria: mucho espacio, bordes finos, jerarquia tipografica clara y acentos verdes.
- Evitar gradientes morados, tarjetas genericas, sombras pesadas y colores de alerta sin contexto.

## Temas

La aplicacion maneja tres temas. Cada vista debe elegir un tema explicito y no mezclar superficies de temas distintos salvo que sea una decision documentada.

### Forest

- Canvas: `#0B1D14`
- Surface: `#122B1E`
- Text: `#F5FBF6`
- Muted: `#A9BDB0`
- Border: `#2A5B43`
- Accent: `#25E27B`

Usar para la experiencia principal y estados de confianza, privacidad y calma.

### Paper

- Canvas: `#F4F1E9`
- Surface: `#FFFFFF`
- Text: `#101514`
- Muted: `#6C756F`
- Border: `#D9DED8`
- Accent: `#25C76A`

Usar para reportes, onboarding y vistas de lectura prolongada.

### Noir

- Canvas: `#050505`
- Surface: `#101010`
- Text: `#FAFAFA`
- Muted: `#8A938D`
- Border: `#2A332F`
- Accent: `#25E27B`

Usar para dashboards de alto contraste, alertas de foco y experiencias avanzadas.

## Reglas de implementacion

- Definir los colores como tokens semanticos, no como valores aislados dentro de componentes.
- Usar Tailwind CSS como primera opcion para layout, espaciado, tipografia, colores y responsive; reservar CSS de componente para tokens dinamicos, pseudoelementos o comportamientos que no se expresen claramente con utilidades.
- Exponer los tokens de tema mediante `@theme inline` y consumirlos con utilidades Tailwind semanticas, evitando clases con colores directos.
- Todas las vistas deben usar la fuente Roboto local definida en `public/fonts/` mediante la utilidad `font-roboto`; no usar `font-serif`, fuentes externas, Google Fonts ni familias adicionales salvo autorizacion explicita.
- Mantener el verde como accion primaria, enlace activo y estado positivo.
- Los campos deben usar la superficie del tema, borde de 1px y radio de 8px.
- Los botones primarios deben tener altura minima de 44px, radio de 8px y texto de peso 700.
- Mantener una escala de espaciado basada en 8px: 8, 16, 24, 32 y 40.
- Mantener contraste WCAG AA para texto normal y estados de foco visibles.
- Las vistas de autenticacion deben conservar: marca, titulo, descripcion breve, campos, accion primaria, separador social y registro.
- En mobile, convertir layouts divididos en flujo vertical y conservar el orden: marca, contenido, accion.

## OpenPencil

- Usar la coleccion de variables `Income Guardian Themes`.
- Nombrar artboards con el patron `Theme NN — Nombre`.
- Antes de crear una nueva vista, revisar los mockups en `income-guardian-web-mockups.fig`.
- Crear componentes reutilizables para botones, campos, separadores y acciones sociales.
- Exportar una vista de verificacion antes de cerrar cambios y comprobar que no hay texto cortado, bordes sin contraste ni controles sin foco visible.

## Arquitectura de carpetas

El codigo se organiza por dominio de negocio. Cada dominio vive en `src/app/features/<dominio>/` con cuatro capas:

```
features/<dominio>/
  domain/           # modelos, puertos (clases abstractas) y reglas puras. TypeScript puro.
  application/      # casos de uso inyectables que orquestan los puertos.
  infrastructure/   # adaptadores: HTTP, DTOs del API, storage, mapas de errores del backend.
  presentation/     # pages/<nombre>/, components/, validators/ de formularios.
  <dominio>.routes.ts
  <dominio>.providers.ts   # enlaza puertos con adaptadores (provideX()), registrado en app.config.ts
```

- Dependencias permitidas: `presentation → application → domain` e `infrastructure → domain`. Presentation nunca importa infrastructure ni `HttpClient`.
- `domain` no importa `@angular/*`; solo `rxjs` para firmas `Observable` de los puertos.
- Un dominio no importa de otro dominio. Lo tecnico y transversal va en `core/` (http, theme); la UI reutilizable sin negocio va en `shared/ui/`.
- Los DTOs del backend (PascalCase) se mapean a modelos de dominio (camelCase) en infrastructure y no salen de esa capa.
- Los errores de negocio se traducen a copy de UI en infrastructure (`resolveApiError(error, MAPA_DEL_DOMINIO)`) y llegan a presentation como error de dominio.
- Usar los alias `@core/*`, `@shared/*`, `@features/*` y `@env/*` para imports fuera del propio dominio; imports relativos dentro del dominio.
- Dominios actuales: `auth`, `dashboard`. Previstos: `incomes`, `expenses`, `budgets` (crear la carpeta solo al implementarlos).
