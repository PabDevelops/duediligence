'use client';
import NewLegalPage from '../../components/new/NewLegalPage';

const SECTIONS = [
  {
    title: '1. Quiénes somos',
    content: 'Bulltrace es un proyecto independiente operado por Pablo Rodriguez, con sede en el Reino Unido. Operamos el sitio web bulltrace.app y los servicios relacionados. Para cuestiones de protección de datos, contáctanos en hello@bulltrace.app.',
  },
  {
    title: '2. Qué datos recopilamos',
    content: `Recopilamos las siguientes categorías de datos personales:

- Datos de cuenta: correo electrónico, nombre y credenciales de autenticación cuando te registras a través de Supabase Auth.
- Datos de pago: estado de la suscripción e historial de facturación. Los datos de tu tarjeta los procesa directamente Stripe y nunca se almacenan en nuestros servidores.
- Datos de uso: páginas visitadas, funciones utilizadas y tickers de acciones buscados, usados para mejorar el servicio.
- Datos técnicos: dirección IP, tipo de navegador, tipo de dispositivo y cookies necesarias para que el servicio funcione.
- Comunicaciones: cualquier mensaje que nos envíes por correo electrónico.`,
  },
  {
    title: '3. Base legal para el tratamiento (Art. 6 del RGPD del Reino Unido)',
    content: `Tratamos tus datos con las siguientes bases legales:

- Contrato (Art. 6(1)(b)): para prestar el servicio Bulltrace al que te has suscrito, incluida la gestión de la cuenta y la facturación de la suscripción.
- Interés legítimo (Art. 6(1)(f)): para mejorar nuestro servicio, prevenir el fraude y garantizar la seguridad.
- Consentimiento (Art. 6(1)(a)): para cookies no esenciales y analítica, cuando has dado tu consentimiento explícito a través de nuestro banner de cookies.
- Obligación legal (Art. 6(1)(c)): cuando lo exija la legislación británica aplicable.`,
  },
  {
    title: '4. Cómo usamos tus datos',
    content: `Usamos tus datos personales para:

- Crear y gestionar tu cuenta
- Procesar los pagos de la suscripción a través de Stripe
- Dar acceso a las funciones Pro según el estado de tu suscripción
- Mejorar y personalizar el servicio
- Enviar comunicaciones esenciales del servicio (confirmaciones de cuenta, recibos de facturación)
- Detectar y prevenir fraude o abuso
- Cumplir con obligaciones legales

No vendemos, alquilamos ni compartimos tus datos personales con terceros con fines de marketing.`,
  },
  {
    title: '5. Servicios de terceros y transferencias internacionales',
    content: `Usamos los siguientes servicios de terceros para operar Bulltrace:

- Stripe (stripe.com) — procesamiento de pagos. Datos tratados en EE. UU. y la UE. Stripe cumple con PCI DSS.
- Supabase (supabase.com) — base de datos, almacenamiento de datos y autenticación/gestión de usuarios. Datos almacenados en regiones de la UE cuando está disponible.
- Vercel (vercel.com) — alojamiento y despliegue del sitio web. Los datos pueden tratarse en EE. UU. y la UE.
- Finnhub (finnhub.io) — API de datos de mercados financieros.
- SEC EDGAR — datos públicos de presentaciones financieras de la Securities and Exchange Commission de EE. UU.

Cuando los datos se transfieren fuera del Reino Unido, nos aseguramos de que existan las garantías adecuadas conforme al Capítulo V del RGPD del Reino Unido.`,
  },
  {
    title: '6. Cookies',
    content: `Usamos los siguientes tipos de cookies:

- Cookies esenciales: necesarias para la autenticación, la gestión de sesión y el funcionamiento básico. No se pueden rechazar porque el servicio no puede funcionar sin ellas.
- Cookies de analítica: usadas para entender cómo interactúan los visitantes con nuestro sitio web. Solo se activan con tu consentimiento explícito.
- Cookies de preferencias: usadas para recordar tu configuración y preferencias.

Puedes gestionar tus preferencias de cookies en cualquier momento a través de nuestro banner de cookies o la configuración de tu navegador. Retirar el consentimiento para cookies no esenciales no afecta a la legalidad del tratamiento realizado antes de la retirada.`,
  },
  {
    title: '7. Conservación de datos',
    content: `Conservamos tus datos personales durante los siguientes periodos:

- Datos de cuenta: mientras dure tu cuenta, más 12 meses tras su eliminación para cumplir con obligaciones legales.
- Registros de pago y facturación: 7 años, según exige la legislación fiscal del Reino Unido.
- Datos de uso y analítica: hasta 24 meses en forma agregada o anonimizada.
- Comunicaciones: hasta 3 años.

Pasados estos periodos, los datos se eliminan de forma segura o se anonimizan.`,
  },
  {
    title: '8. Tus derechos conforme al RGPD del Reino Unido',
    content: `Como persona interesada en el Reino Unido, tienes los siguientes derechos:

- Derecho de acceso: solicitar una copia de los datos personales que tenemos sobre ti.
- Derecho de rectificación: solicitar la corrección de datos inexactos o incompletos.
- Derecho de supresión: solicitar la eliminación de tus datos personales ("derecho al olvido").
- Derecho a la limitación: solicitar que limitemos cómo usamos tus datos.
- Derecho a la portabilidad: recibir tus datos en un formato estructurado y legible por máquina.
- Derecho de oposición: oponerte al tratamiento basado en interés legítimo.
- Derechos relacionados con decisiones automatizadas: no tomamos decisiones exclusivamente automatizadas con efectos legales o significativos.

Para ejercer cualquiera de estos derechos, contáctanos en hello@bulltrace.app. Responderemos en un plazo de 30 días. No se te cobrará por hacer la solicitud.`,
  },
  {
    title: '9. Derecho a reclamar',
    content: 'Si no estás conforme con cómo tratamos tus datos personales, tienes derecho a presentar una reclamación ante la Information Commissioner\'s Office (ICO) del Reino Unido en ico.org.uk o llamando al 0303 123 1113. Agradeceríamos la oportunidad de resolver tu inquietud antes de que contactes con la ICO.',
  },
  {
    title: '10. Seguridad de los datos',
    content: 'Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos personales frente a accesos no autorizados, pérdida accidental, destrucción o daño. Entre ellas, transmisión de datos cifrada (HTTPS), controles de acceso y revisiones de seguridad periódicas. En caso de una brecha de seguridad que suponga un riesgo para tus derechos y libertades, notificaremos a la ICO en un plazo de 72 horas y a los usuarios afectados sin demora injustificada.',
  },
  {
    title: '11. Privacidad de menores',
    content: 'Bulltrace no está dirigido a menores de 13 años. No recopilamos conscientemente datos personales de menores. Si crees que un menor nos ha facilitado datos personales, contáctanos en hello@bulltrace.app.',
  },
  {
    title: '12. Cambios en esta política',
    content: 'Podemos actualizar esta Política de Privacidad de vez en cuando. Te notificaremos los cambios significativos por correo electrónico o mediante un aviso destacado en nuestro sitio web al menos 14 días antes de que entren en vigor. Seguir usando el servicio después de esa fecha supone la aceptación de la política actualizada.',
  },
  {
    title: '13. Contacto',
    content: 'Para cualquier pregunta o solicitud relacionada con la privacidad, contáctanos en hello@bulltrace.app. Procuramos responder en un plazo de 5 días laborables.',
  },
];

export default function PrivacyView() {
  return (
    <NewLegalPage
      title="Política de privacidad"
      lastUpdated="Última actualización: junio de 2026 · Regido por el RGPD del Reino Unido y la Data Protection Act 2018"
      sections={SECTIONS}
    />
  );
}
