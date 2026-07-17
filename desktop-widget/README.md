# Traqcker User Stats Widget

Widget de escritorio (Electron) que muestra usuarios registrados totales y usuarios
activos en las últimas 24h, refrescando cada 30s contra `/api/admin/user-stats`.

## Instalar (recomendado)

```
cd desktop-widget
npm install
npm run dist
```

Genera `desktop-widget/dist/Traqcker User Stats Setup 1.0.0.exe`. Ejecútalo y
sigue el asistente (puedes elegir carpeta de instalación, crea accesos directos
en el Escritorio y el Menú Inicio). La app trae ya configurados el `apiUrl` de
producción y el secreto, no requiere tocar ningún archivo.

Al no estar firmado con un certificado de código (cuesta dinero y es innecesario
para uso personal), Windows SmartScreen puede avisar "Windows protegió tu PC" —
pulsa "Más información" → "Ejecutar de todas formas".

El arranque automático con Windows se registra solo, en el primer arranque de
la app instalada (usa `app.setLoginItemSettings`, visible/desactivable desde
Configuración → Aplicaciones → Inicio, o Administrador de tareas → Inicio).

Para desinstalar: Configuración → Aplicaciones → "Traqcker User Stats" → Desinstalar.

## Ejecutar en desarrollo (sin instalar)

```
cd desktop-widget
npm install
npm start
```

En modo desarrollo puedes sobreescribir la config creando un `config.json`
junto a `config.example.json` (apuntando a `localhost:3000`, por ejemplo). En
la versión instalada, la config vive en
`%APPDATA%\traqcker-user-stats-widget\config.json` y se puede editar a mano si
alguna vez rota el secreto.

## Notas

- La ventana es sin bordes, siempre-encima y arrastrable (clic y arrastra
  sobre el título).
- El punto de estado (verde/rojo) indica si la última petición fue exitosa.
- El botón "×" cierra la app (no desinstala nada).
