# Resultados y SBC históricos TTM

7 de noviembre de 2026. Ampliación del formulario existente, sin nuevas fórmulas ni migraciones.

«Añadir ejercicio de resultados» admite FY, Q y TTM. TTM utiliza las fechas reales de los doce meses, en DD/MM/AAAA. El cierre es obligatorio para identificar el registro: `history:niHistory:TTM:2026-06-30`. Se pueden guardar varios cierres TTM en un mismo año sin pisar FY o Q. El balance conserva únicamente saldos a una fecha.

La misma identidad sirve para el editor individual, incluido SBC. Los antiguos registros guardados bajo `history:sbcHistory:2026` con metadatos `basis:TTM` se recuperan al leerlos. No se modifica ni migra su fila de base de datos. La tabla presenta el periodo TTM y permite editar/restaurar su propia revisión.

Los puntos se conservan en `ttmHistories`, fuera de las series anuales de Growth. La adaptación a los escalares existentes usa el mismo mecanismo de corrección manual: únicamente se seleccionan cifras finitas con una ventana TTM válida, moneda/unidades/perímetro compatibles y cierre no futuro ni anterior al dato actual. Los resultados deben coincidir con la ventana actual de ingresos; SBC/FCF con la ventana de caja. Una corrección principal guardada después conserva prioridad. Los registros no comparables se guardan con advertencia y no entran en cálculos. Los registros FY, Q, las revisiones H1 anteriores y los importes introducidos permanecen intactos.

## Caso observado: TE

El registro de SBC id 53 estaba guardado como `history:sbcHistory:2026`, con importe 14.707.000 USD y periodo TTM 01/07/2025–30/06/2026, consolidado. El importe coincidía con el escalar automático, pero sus metadatos no llegaban a `financialPeriods.sbcVal`. Por eso VALUE no podía comprobar su compatibilidad con FCF.

La lectura corregida incorpora ese periodo conservando el registro físico y su importe. El FCF ajustado resulta −199.517.000 USD. VALUE recupera P/FCF (40%) y, junto con EBIT negativo (30%), pasa de N/D con 30% a F con 70% de cobertura. El beneficio neto manual actual continúa siendo H1; no se convierte en TTM. Un beneficio neto TTM introducido posteriormente, con la misma ventana de ingresos, puede completar P/E, sin sobrescribir los históricos FY/Q ni borrar la corrección H1 anterior.

## Verificación

686 pruebas: creación completa de resultados TTM, fechas europeas, unidades, varias ventanas anuales, acceso administrativo, guardado/versionado/restauración, compatibilidad estricta, EPS del mismo periodo, edición principal posterior, conservación de FY/Q/H1 y reproducción del SBC real de TE. Los casos sintéticos que completan P/E no se escriben en la base de datos.

No se cambian pesos, bandas, fórmulas de Growth/Value/Quality, DCF, escenarios, fuentes o cachés. Las puntuaciones pueden variar legítimamente al recuperar entradas manuales compatibles que antes se descartaban.
