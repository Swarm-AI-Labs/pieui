# Ajax submit: variables from localStorage and other client sources

**Date:** 2026-06-17
**Status:** Approved

## Problem

`getAjaxSubmit` (in `src/util/ajaxCommonUtils.ts`) gathers the variables sent
with an ajax request from three layers: static `kwargs`, runtime `extraKwargs`,
and `depsNames` — names of DOM inputs resolved via `document.getElementsByName`,
with `'sid'` as a magic name resolving to `window.sid`.

There is no way to pull a variable directly from `localStorage`,
`sessionStorage`, cookies, or URL query params. Today the only workaround is to
render a hidden input (e.g. via `DeviceStorageCard` / `SessionStorageCard`) so
the value shows up as a named DOM input. We want submit to read these sources
directly.

## Approach

Extend the existing magic-name mechanism in `readAjaxKey` with **source
prefixes**. `depsNames` stays an array of strings, so every existing config
keeps working unchanged.

Recognized prefixes:

| Dep name              | Source         | Resolution                                          |
| --------------------- | -------------- | --------------------------------------------------- |
| `localStorage:token`  | localStorage   | `localStorage.getItem('token')`                     |
| `sessionStorage:foo`  | sessionStorage | `sessionStorage.getItem('foo')`                     |
| `cookie:sid`          | cookie         | parse `document.cookie`, decode value of `sid`      |
| `url:ref`             | URL query      | `new URLSearchParams(location.search).getAll('ref')`|
| `sid`                 | socket.io      | `window.sid` (unchanged)                            |
| `email` (no prefix)   | DOM            | `document.getElementsByName('email')` (unchanged)   |

The **key sent to the backend is the bare name after the prefix**:
`localStorage:token` is appended to the FormData as `token`.

## Design

### 1. `parseDepName(depName): { source, key }` — new exported helper

Splits a dep name on the first recognized prefix:

- `'localStorage:token'` → `{ source: 'localStorage', key: 'token' }`
- `'sid'` → `{ source: 'sid', key: 'sid' }`
- `'email'` → `{ source: 'dom', key: 'email' }`

Only the four prefixes above (plus `sid`) are recognized. A name that contains a
colon but no recognized prefix (e.g. `'odd:name'`) is treated as a DOM name,
preserving backward compatibility.

### 2. `readAjaxKey(depName, renderingLogEnabled)` — dispatch on source

Continues to return `Array<string | File>` (file inputs can yield multiple
values; `url`/cookie yield 0-or-more). Dispatch:

- `sid` → unchanged
- `dom` → unchanged
- `localStorage` / `sessionStorage` → `getItem(key)`; `[]` if `null`. Wrapped in
  try/catch — storage access can throw (private mode / disabled). On throw,
  return `[]` and warn when `renderingLogEnabled`.
- `cookie` → parse `document.cookie` into name/value pairs, `decodeURIComponent`
  the value; `[]` if absent.
- `url` → `new URLSearchParams(location.search).getAll(key)` (supports repeated
  params); `[]` if absent.

A missing value returns `[]` exactly like a missing DOM input does today:
nothing is appended, and a warning is logged when `renderingLogEnabled`.

### 3. Field-name fix in `getAjaxSubmit`

The current loop appends under the raw `depName`. Change it to append under the
parsed bare key so the backend receives `token`, not `localStorage:token`:

```ts
for (const depName of depsNames) {
    const { key: fieldName } = parseDepName(depName)
    for (const value of readAjaxKey(depName, renderingLogEnabled)) {
        data.append(fieldName, value)
    }
}
```

`sid` and plain DOM names are unaffected (their `key` equals the original name).

### 4. SSR / environment safety

All resolution runs inside the returned submit function, which already guards
`typeof window === 'undefined'`. Storage and cookie reads are additionally
try/caught.

## Out of scope

- Renaming a source key to a different field name (use structured deps if ever
  needed — not now, YAGNI).
- Backend (`pie`) changes. `depsNames` are data strings the backend already
  emits; this only changes frontend interpretation. No CLI surface change, so
  cross-repo CLI symmetry is unaffected.

## Testing

Add to `src/tests/ajaxCommonUtils.test.ts`:

- `parseDepName` returns correct `{ source, key }` for each prefix, `sid`, plain
  names, and a colon-containing non-prefix name.
- `readAjaxKey` reads from shimmed `localStorage`, `sessionStorage`,
  `document.cookie`, and `location.search`; returns `[]` for missing values; and
  does not throw when storage access throws.
- An integration-style assertion that `getAjaxSubmit`'s FormData uses the bare
  key as the field name.
