'use client';
import NewLegalPage from '../../components/new/NewLegalPage';

const SECTIONS = [
  {
    title: '1. Aceptación de los términos',
    content: 'Al acceder o usar Bulltrace ("el Servicio"), aceptas quedar vinculado por estos Términos de Servicio ("Términos"). Si no estás de acuerdo con estos Términos, no debes usar el Servicio. Estos Términos constituyen un acuerdo legalmente vinculante entre tú y Bulltrace, operado por Pablo Rodriguez, Reino Unido.',
  },
  {
    title: '2. Descripción del servicio',
    content: `Bulltrace ofrece una plataforma web para el análisis fundamental de acciones, que incluye:

- Datos de acciones obtenidos de SEC EDGAR (presentaciones públicas de EE. UU.), Finnhub y Yahoo Finance
- Modelos de puntuación propios basados en datos financieros públicos
- Herramientas de análisis de estados financieros
- Modelos de valoración DCF y de Graham
- Explorador y comparador de acciones (Pro)
- Función de lista de seguimiento

El Servicio se ofrece tanto en modalidad gratuita como de suscripción de pago, como se describe en la Sección 5.`,
  },
  {
    title: '3. Aviso importante — Esto no es asesoramiento de inversión',
    content: `LEE ESTA SECCIÓN CON ATENCIÓN.

Nada en Bulltrace constituye asesoramiento de inversión, asesoramiento financiero, asesoramiento de trading ni ningún otro tipo de asesoramiento. Bulltrace es únicamente una herramienta informativa.

- Todos los datos, notas, valoraciones y análisis tienen fines exclusivamente informativos.
- La rentabilidad pasada de cualquier acción o modelo no es indicativa de resultados futuros.
- La Nota Bulltrace y cualquier otra métrica propia son cálculos automatizados y no deben tomarse como recomendaciones.
- Debes hacer siempre tu propia investigación independiente y consultar a un asesor financiero cualificado y autorizado antes de tomar cualquier decisión de inversión.
- Bulltrace no está autorizada ni regulada por la Financial Conduct Authority (FCA).`,
  },
  {
    title: '4. Cuentas de usuario',
    content: `Para acceder a ciertas funciones del Servicio, debes crear una cuenta. Te comprometes a:

- Proporcionar información precisa y completa durante el registro
- Mantener la seguridad de las credenciales de tu cuenta
- Notificarnos de inmediato cualquier acceso no autorizado a tu cuenta
- Ser responsable de toda la actividad que ocurra bajo tu cuenta

Debes tener al menos 18 años para crear una cuenta. Nos reservamos el derecho de suspender o cerrar cuentas que incumplan estos Términos.`,
  },
  {
    title: '5. Planes de suscripción y pagos',
    content: `Bulltrace ofrece los siguientes planes:

Plan Gratis: acceso a resúmenes de acciones, notas de calidad, datos de mercado y minigráficos. No requiere pago.

Plan Pro: acceso completo a todas las funciones, incluidos estados financieros, valoración DCF, explorador de acciones, comparador y lista de seguimiento. Disponible con facturación mensual (14,99 €/mes) o anual (119,99 €/año, equivalente a 9,99 €/mes).

Los pagos se procesan de forma segura a través de Stripe. Al suscribirte a un plan Pro, autorizas a Stripe a cobrar en tu método de pago de forma recurrente.

Puedes cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta. La cancelación surte efecto al final del periodo de facturación en curso. No ofrecemos reembolsos por periodos de facturación parciales, salvo que la legislación aplicable lo exija.

Nos reservamos el derecho de cambiar los precios con al menos 30 días de aviso por escrito. Seguir usando el Servicio después de un cambio de precio supone la aceptación del nuevo precio.`,
  },
  {
    title: '6. Política de reembolsos',
    content: `Ofrecemos reembolsos en las siguientes circunstancias:

- Si se te cobra por error debido a un fallo técnico por nuestra parte
- Dentro de los 14 días posteriores a tu primera compra de suscripción si no has usado las funciones Pro (periodo de desistimiento legal según el UK Consumer Contracts Regulations 2013)
- A nuestra discreción en circunstancias excepcionales

Para solicitar un reembolso, contáctanos en hello@bulltrace.app con el correo de tu cuenta y el motivo de la solicitud. Procesaremos los reembolsos que correspondan en un plazo de 5-10 días laborables.`,
  },
  {
    title: '7. Propiedad intelectual',
    content: `Todo el contenido de Bulltrace, incluyendo entre otros la metodología de puntuación, el diseño, el código, los textos y los gráficos, es propiedad de Bulltrace y está protegido por las leyes de propiedad intelectual aplicables.

Se te concede una licencia limitada, no exclusiva e intransferible para acceder y usar el Servicio con fines personales y no comerciales.

No puedes:
- Copiar, reproducir o distribuir ninguna parte del Servicio sin permiso
- Hacer ingeniería inversa o intentar extraer el código fuente
- Usar el Servicio para construir un producto competidor
- Extraer o recolectar datos del Servicio de forma sistemática

Los datos financieros procedentes de SEC EDGAR son de dominio público. Los datos de Finnhub y Yahoo Finance están sujetos a sus respectivos términos de servicio.`,
  },
  {
    title: '8. Conducta prohibida',
    content: `Te comprometes a no:

- Usar el Servicio con fines ilícitos o incumpliendo cualquier ley aplicable
- Intentar acceder sin autorización a cualquier parte del Servicio o su infraestructura
- Transmitir código malicioso, virus o contenido dañino
- Interferir con o alterar la integridad o el rendimiento del Servicio
- Usar herramientas automatizadas para acceder al Servicio a un ritmo superior al uso humano normal
- Suplantar a cualquier persona o entidad
- Incurrir en cualquier conducta que restrinja o impida el disfrute del Servicio por parte de otros usuarios`,
  },
  {
    title: '9. Exactitud y disponibilidad de los datos',
    content: 'Aunque nos esforzamos por ofrecer datos financieros precisos y actualizados, no podemos garantizar la integridad, exactitud o puntualidad de ningún dato del Servicio. Los datos financieros proceden de terceros y pueden contener errores, retrasos u omisiones. No somos responsables de las inexactitudes en los datos de terceros. El Servicio se ofrece "tal cual" y no garantizamos que vaya a estar libre de interrupciones, errores, fallos o virus.',
  },
  {
    title: '10. Limitación de responsabilidad',
    content: `En la medida máxima permitida por la ley aplicable:

- Bulltrace no será responsable de daños indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo entre otros la pérdida de beneficios, pérdidas de inversión o pérdida de datos.
- Nuestra responsabilidad total hacia ti por cualquier reclamación derivada del uso del Servicio no excederá el importe que nos hayas pagado en los 12 meses anteriores a la reclamación.
- Nada en estos Términos excluye o limita nuestra responsabilidad por fallecimiento o lesiones personales causados por negligencia, fraude, o cualquier otra responsabilidad que no pueda excluirse por ley.`,
  },
  {
    title: '11. Indemnización',
    content: 'Aceptas indemnizar y eximir de responsabilidad a Bulltrace y a sus operadores frente a cualquier reclamación, daño, pérdida o gasto (incluyendo honorarios legales) derivado de tu uso del Servicio, tu incumplimiento de estos Términos o tu vulneración de derechos de terceros.',
  },
  {
    title: '12. Terminación',
    content: 'Nos reservamos el derecho de suspender o cerrar tu cuenta y tu acceso al Servicio en cualquier momento, con o sin aviso, por conductas que consideremos que incumplen estos Términos o que sean perjudiciales para otros usuarios, para nosotros o para terceros. Tras la terminación, tu derecho a usar el Servicio cesará de inmediato. Si tu cuenta se cierra por causa justificada, no tendrás derecho a reembolso.',
  },
  {
    title: '13. Cambios en los términos',
    content: 'Nos reservamos el derecho de modificar estos Términos en cualquier momento. Para cambios sustanciales, avisaremos con al menos 14 días de antelación por correo electrónico o mediante un aviso destacado en el sitio web. Seguir usando el Servicio después de la fecha de entrada en vigor de los cambios supone la aceptación de los Términos actualizados. Si no estás de acuerdo con los Términos actualizados, debes dejar de usar el Servicio.',
  },
  {
    title: '14. Ley aplicable y resolución de disputas',
    content: 'Estos Términos se rigen e interpretan de acuerdo con las leyes de Inglaterra y Gales. Cualquier disputa derivada de estos Términos o del Servicio quedará sometida a la jurisdicción exclusiva de los tribunales de Inglaterra y Gales. Si eres consumidor, también puedes tener derechos conforme a la legislación de tu país de residencia.',
  },
  {
    title: '15. Contacto',
    content: 'Para cualquier pregunta sobre estos Términos, contáctanos en hello@bulltrace.app. Procuramos responder en un plazo de 5 días laborables.',
  },
];

export default function TermsView() {
  return (
    <NewLegalPage
      title="Términos de uso"
      lastUpdated="Última actualización: junio de 2026 · Regido por las leyes de Inglaterra y Gales"
      sections={SECTIONS}
    />
  );
}
