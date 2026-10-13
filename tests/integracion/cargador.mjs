/**
 * Deja que Node cargue los .js de `src/` tal como los resuelve Next.
 *
 * Son ESM sin extensión en los imports (`from "../firebase/firebaseAdmin"`) y el
 * paquete no declara `"type": "module"`. Estos dos hooks hacen lo que hace Next
 * por su cuenta: probar con `.js` / `/index.js` y tratar como módulo todo `.js`
 * que viva bajo `src/`. Las pruebas de integración corren así el código REAL, no
 * copias.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function registrarCargador(raiz, importMetaUrl) {
    const SRC = pathToFileURL(path.join(raiz, 'src')).href;
    register(
        'data:text/javascript,' + encodeURIComponent(`
            const SRC = ${JSON.stringify(SRC)};
            export async function resolve(specifier, context, next) {
                const relativo = specifier.startsWith('.') || specifier.startsWith('/');
                if (relativo && context.parentURL?.startsWith(SRC)) {
                    try { return await next(specifier, context); } catch (e) {
                        if (e.code !== 'ERR_MODULE_NOT_FOUND' && e.code !== 'ERR_UNSUPPORTED_DIR_IMPORT') throw e;
                    }
                    for (const sufijo of ['.js', '/index.js']) {
                        try { return await next(specifier + sufijo, context); } catch {}
                    }
                }
                return next(specifier, context);
            }
            export async function load(url, context, next) {
                if (url.startsWith(SRC) && url.endsWith('.js')) return next(url, { ...context, format: 'module' });
                return next(url, context);
            }
        `),
        importMetaUrl,
    );
    return (ruta) => import(pathToFileURL(path.join(raiz, 'src', ruta)).href);
}
