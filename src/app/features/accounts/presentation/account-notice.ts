/** Acción completada que el listado confirma al usuario. */
export interface AccountNotice {
  kind: 'created' | 'updated' | 'deactivated';
  name: string;
}

/** Estado de navegación con el que el formulario avisa al listado de lo que acaba de pasar. */
export interface AccountNoticeState {
  notice?: AccountNotice;
}
