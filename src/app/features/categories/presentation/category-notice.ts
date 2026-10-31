/** Acción completada que el listado confirma al usuario. */
export interface CategoryNotice {
  kind: 'created' | 'updated' | 'deleted';
  name: string;
}

/** Estado de navegación con el que el formulario avisa al listado de lo que acaba de pasar. */
export interface CategoryNoticeState {
  notice?: CategoryNotice;
}
