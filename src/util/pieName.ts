import { PIEBREAK } from './pieConfig.ts'

/**
 * Composes a nested PieUI component name of the form `parent{PIEBREAK}child`.
 *
 * PieUI uses this convention to identify inputs/cards that belong to a
 * structured parent (for example, a single field inside a composite form).
 * The separator is defined by {@link PIEBREAK} so that runtime and UI config
 * generators cannot drift apart.
 *
 * @param name  Name of the enclosing component.
 * @param child Name of the nested child/field.
 * @returns The joined name string.
 */
export const pieName = (name: string, child: string) =>
    `${name}${PIEBREAK}${child}`
