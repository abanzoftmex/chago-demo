# Accesos compartidos: una cuenta, varios negocios

Para un directivo que lleva varios negocios y debe entrar a todos con el **mismo
correo y la misma contraseña**, saltando de uno a otro después de iniciar sesión.
Es el mismo criterio que ya tiene el punto de venta.

## Cómo se da el acceso

Solo desde la consola de superadmin, y una vez por negocio:

1. `/admin/superadmin/tenants` → abre el negocio al que se le da acceso.
2. Tarjeta **Acceso compartido** → correo de la persona, rol en ese negocio →
   **Dar acceso**.
3. Si el correo no tiene cuenta, el formulario pide una contraseña y la crea.

El rol es **por negocio**: la misma persona puede ser administrador en uno y visor
en otro.

No uses «Crear tenant» para un directivo: eso crea un negocio vacío que
aparecería en su lista.

La persona entra con su correo y, si tiene más de un negocio, cambia desde el menú
de usuario (arriba a la derecha) → **Mis negocios**. Cambiar recarga en el tablero
del otro negocio.

## Cómo se quita

En el negocio, tarjeta **Acceso compartido**, fila de la persona → **Quitar acceso**.

- Quita solo el vínculo con ese negocio. Su cuenta y sus demás negocios no se tocan.
- Si era su **último** negocio, la consola pide darla de baja y se borra también la
  cuenta. No se puede dejar una cuenta sin ningún negocio: al entrar, el sistema la
  tomaría por un usuario del sistema anterior (rol visor).

## Qué ve y qué no puede hacer el negocio

- En **Usuarios** la persona aparece como «Acceso compartido · Lo administra
  Abanzoft». El administrador del negocio no puede editarla, deshabilitarla ni
  borrarla, y el servidor tampoco lo permite.
- Alta y baja quedan en la **Bitácora** del negocio, firmadas por Abanzoft.
- Si una persona de un negocio tiene además un acceso compartido en otro, el
  administrador de su negocio puede cambiarle el **rol en ese negocio** o quitarla
  de él (solo se quita ese negocio), pero no deshabilitar la cuenta ni cambiar su
  correo, nombre o contraseña: son de la cuenta, que es la misma en todos.
- Un negocio **ya no puede sumar** a su lista una cuenta que pertenece a otro
  negocio: eso solo lo hace la consola de superadmin.
- Restablecer la contraseña de la persona la cambia en **todos** sus negocios.

## Cómo funciona por dentro

- No cambia el modelo: la membresía ya vivía en `tenants/{id}/members/{uid}`, una
  por negocio, cada una con su rol. Las reglas de Firestore y `requireTenantMember`
  ya validaban por negocio. La verdad está en `members`, **no** en
  `users.tenantIds` (que no se mantenía al quitar gente).
- `users.tenantId` es el negocio «de casa» (a donde entra si nadie ha elegido otro).
  Lo escribe solo el servidor; las reglas impiden que la persona lo cambie.
- `users.accesoCompartido` es el interruptor: solo las cuentas que lo tienen
  preguntan a `/api/me/tenants` a qué negocios entran. **Las demás no hacen ninguna
  llamada extra y no cambian en nada.**
- El negocio activo es una preferencia de ese navegador (`localStorage`, por
  cuenta). No concede nada: si apunta a un negocio que no es de la persona, se
  ignora y entra al de casa. Si se cambia en una pestaña, las demás de la misma
  cuenta recargan solas.
- Código: `lib/server/accesoCompartido.js` (la lógica), `pages/api/admin/shared-access.js`
  (consola), `pages/api/me/tenants.js` (la lista), `lib/negocioActivo.js` y
  `lib/services/negociosService.js` (elección en el navegador).

## Dos huecos que se cerraron de paso

`manage-user`, `update-user-tenant` y `create-user-tenant` tenían un atajo: si el
negocio tenía **un solo miembro** se saltaban el permiso por completo, sin mirar
siquiera quién preguntaba (22 de 24 negocios están en ese caso). Y `manage-user` no
comprobaba que la persona a borrar fuera del negocio. Ahora hay que ser
administrador activo del negocio, y la persona tiene que pertenecer a él.

## Pruebas

```
npm run test:unit        # elección de negocio (sin navegador)
npm run test:acceso      # rutas de API contra emuladores (alta, baja, guardias)
npm run test:servicios   # servicios reales + reglas, incluida una persona de varios negocios
npm run test:rules       # reglas de Firestore
```

## Probarlo a mano, sin tocar producción

`npm run dev` a secas se conecta a **producción**: el `.env.local` trae las
credenciales reales. Para recorrer las pantallas con datos de ensayo se usan los
emuladores. Son tres terminales, todas dentro de `D:\Projects\ABANZOFT\chago-demo`
(no en `C:\Users\<tú>`: ahí no hay `package.json`):

```powershell
# Terminal 1 — los emuladores (déjala abierta)
npm run emu

# Terminal 2 — datos de ensayo (una vez; se puede repetir)
npm run seed:emulador

# Terminal 3 — la aplicación, apuntando a los emuladores
$env:NEXT_PUBLIC_USE_EMULATOR = "true"
$env:FIRESTORE_EMULATOR_HOST  = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
npm run dev
```

Las **tres** variables son necesarias. `NEXT_PUBLIC_USE_EMULATOR` solo redirige el
navegador; las rutas de servidor (dar acceso, borrar usuarios…) usan el Admin SDK, y
sin las otras dos hablarían con producción. Si falta alguna, el Admin SDK se niega a
inicializarse y las rutas responden error (ver `lib/firebase/firebaseAdmin.js`).

Cuentas de ensayo (contraseña `ensayo123`): `admin@ensayo.mx`, `contador@ensayo.mx`,
`viewer@ensayo.mx` (negocio 1), `admin2@ensayo.mx` (negocio 2) y
**`directivo@ensayo.mx`**, que entra a los dos: administrador en el 1 y visor en el 2.

Qué recorrer:

1. Entra como `directivo@ensayo.mx` → menú de usuario (arriba a la derecha) →
   **Mis negocios** → cambia al otro. Entra al tablero del negocio elegido; en el
   segundo solo puede consultar. Cierra sesión y vuelve a entrar: recuerda el último.
2. Entra como `admin@ensayo.mx` → **Usuarios**: la persona aparece como «Acceso
   compartido · Lo administra Abanzoft», sin botones.
3. Consola de superadmin (`/admin/superadmin`, con la contraseña de
   `TENANT_SETUP_PASSWORD`) → un negocio → tarjeta **Acceso compartido**: dar y quitar
   un acceso.

## Antes de desplegar

Es un cambio en rutas de administración de usuarios y en el contexto de
autenticación, que atraviesa el inicio de sesión de **todos**. Además de las pruebas,
haz una vez, con una cuenta de un solo negocio y con una de dos negocios: iniciar
sesión, abrir Usuarios, y cambiar de negocio. Los administradores de negocio que
estaban sumando a su lista una cuenta que ya existe en otro negocio recibirán ahora
un aviso: ese alta pasó a la consola de superadmin.
