import type { FieldErrors, FieldValues } from "react-hook-form";

/**
 * Desplaza la vista al primer campo con error de validación y enfoca el input
 * visible dentro. El campo se identifica con `data-field-anchor="<name>"` en
 * el `<div>` contenedor.
 *
 * Recibe `fieldOrder` porque el iteration-order de `errors` que devuelve RHF
 * no está garantizado — con un orden explícito el "primero" coincide con el
 * primero visualmente, que es lo que el usuario espera al hacer submit.
 */
export function scrollToFirstError<T extends FieldValues>(
  errors: FieldErrors<T>,
  fieldOrder: readonly (keyof T & string)[],
) {
  const first = fieldOrder.find((f) => errors[f]);
  if (!first) return;
  // `~=` matchea attribute-contains-word, así un solo <div> puede cubrir dos
  // campos que comparten la misma posición visual (ej.
  // `data-field-anchor="agrupacion id_agrupacion"` en Kárdex, donde el error
  // puede venir en cualquiera de los dos paths).
  const el = document.querySelector<HTMLElement>(
    `[data-field-anchor~="${first}"]`,
  );
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Los autocompletes registran inputs hidden para RHF; excluirlos para que
  // el foco caiga en el input visible.
  const focusable = el.querySelector<HTMLElement>(
    'input:not([type="hidden"]), select, textarea, [role="combobox"]',
  );
  if (focusable) {
    // preventScroll: ya hicimos el scroll arriba con smooth behavior.
    // setTimeout: el scroll smooth tarda; enfocar antes lo cancela en algunos navegadores.
    setTimeout(() => focusable.focus({ preventScroll: true }), 300);
  }
}
