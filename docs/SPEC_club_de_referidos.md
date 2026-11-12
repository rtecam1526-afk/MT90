# Módulo "Club de referidos" — Pedido para Claude Code

## 0. Cómo trabajar este pedido

1. Revisá el CRM actual: contactos (con su clasificación caliente, tibio o frío), agentes, propiedades y actividades.
2. Usá como referencia visual las páginas de ejemplo `docs/club_referidos_ejemplo_gustavo.html` y `docs/club_referidos_ejemplo_juli.html`. La página pública de cada contacto tiene que verse y comportarse igual, pero con datos reales del CRM.
3. Proponeme un plan por fases con los cambios de esquema y **esperá mi confirmación antes de migrar la base de datos**. Trabajá en una rama nueva.
4. Todo el texto visible va en **español rioplatense** (voseo) y tiene que funcionar bien en el celular.

---

## 1. Objetivo

Que los **contactos de cada agente** (clientes, ex clientes, vecinos, conocidos) recomienden al agente y respondan una encuesta mensual, a cambio de puntos que canjean por beneficios.

Cada mes, cada contacto inscripto recibe por WhatsApp un link a **su estado de cuenta**: sus puntos, las personas que recomendó y en qué estado están, los beneficios que puede canjear y la encuesta del mes.

Para el agente, el club genera tres cosas: **referidos nuevos**, **posibles captaciones** (contactos que piensan mudarse) y **contacto mensual** con su base sin parecer publicidad.

---

## 2. Modelo de datos

Adaptá los nombres a las convenciones del repo.

### 2.1 En el contacto
- `club_activo` (bool) y `club_fecha_alta`.
- `club_token`: identificador aleatorio, largo e imposible de adivinar, para la URL pública. Se puede regenerar.

### 2.2 `MovimientoPuntos`
`contacto_id`, `agente_id`, `fecha`, `puntos` (positivo o negativo), `motivo` (`recomendacion_recibida`, `recomendacion_avanza`, `recomendacion_operacion`, `encuesta`, `encuesta_bonus_referido`, `canje`, `ajuste_manual`), `referencia_id` (la recomendación, encuesta o canje que lo originó) y `nota`.
**El saldo se calcula siempre como la suma de los movimientos.** No se guarda un saldo editable aparte.

### 2.3 `Recomendacion`
`contacto_que_recomienda_id`, `contacto_recomendado_id` (se crea como contacto nuevo del agente, o se vincula a uno existente), `agente_id`, `fecha`, `estado` (`recibida`, `contactada`, `reunion`, `visita`, `tasacion`, `operacion`, `descartada`) y `origen` (`encuesta`, `whatsapp`, `carga_manual`).

### 2.4 `Beneficio` (catálogo por agente)
`agente_id`, `nombre`, `descripcion`, `costo_puntos`, `activo` y `stock` opcional.

### 2.5 `Canje`
`contacto_id`, `beneficio_id`, `fecha_pedido`, `estado` (`pedido`, `entregado`, `cancelado`). Al pasar a `entregado` se genera el movimiento negativo de puntos.

### 2.6 `RespuestaEncuesta`
`contacto_id`, `agente_id`, `periodo` (año y mes), `fecha`, `respuestas` (JSON), `recomienda_a` (texto opcional) y `puntos_otorgados`.

---

## 3. Reglas de puntos (configurables por agente)

| Evento | Puntos por defecto |
|---|---|
| Recomendación recibida | +100 |
| La recomendación llega a reunión, visita o tasación (una sola vez) | +200 |
| La recomendación termina en operación | +1.000 |
| Encuesta del mes respondida | +150 |
| La encuesta trae un nombre de recomendado | +200 (se otorga **cuando el agente valida** que es una persona real y nueva) |

- Los puntos de una recomendación se otorgan automáticamente cuando el agente cambia su estado en el CRM.
- **Una encuesta por contacto por mes.** Si responde dos veces, la segunda se guarda pero no suma puntos.
- Ningún contacto puede recomendarse a sí mismo, y un contacto que ya estaba en la base del agente no cuenta como recomendación nueva.

---

## 4. Página pública del contacto

- URL: `/club/<club_token>`. Sin login. Si el token no existe o el club está inactivo, mostrar un mensaje amable sin datos.
- Contenido, igual que el ejemplo:
  - Encabezado con el nombre y los colores del agente, "Hola, [nombre del contacto]" y el período.
  - Saldo de puntos, puntos sumados en el mes y cantidad de personas recomendadas.
  - **Tus recomendaciones:** fecha, persona recomendada, estado y puntos. **Por privacidad, mostrar solo el nombre de pila y la inicial del apellido** de la persona recomendada, nunca su teléfono ni el detalle de su operación.
  - **Lo que podés canjear:** beneficios activos del agente, con costo, barra de avance y botón **"Quiero canjearlo"** cuando alcanza el saldo. Ese botón crea un `Canje` en estado `pedido` y le avisa al agente.
  - **Encuesta del mes** (sección 5).
  - Pie con nombre, cargo y contacto del agente.
- Colores del agente configurables en su perfil. Modo claro y oscuro.

---

## 5. Encuesta mensual

### 5.1 Preguntas (editables por agente, estas son las iniciales)
1. ¿Cómo calificarías la atención que recibiste? (1 a 5)
2. ¿Pensás mudarte en el próximo año? (Sí / Tal vez / No por ahora)
3. ¿Conocés a alguien que quiera vender, comprar o alquilar? (Sí / No por ahora)
4. Si respondió que sí: ¿a quién? (nombre y teléfono, opcional)

### 5.2 Envío y guardado
- Al tocar "Enviar", la página manda las respuestas **directo al CRM** (endpoint público protegido por el `club_token`, con límite de envíos para evitar abusos).
- El CRM guarda la `RespuestaEncuesta`, otorga los +150 puntos y muestra al contacto: "¡Gracias! Sumaste +150 puntos".
- Si dejó un nombre en la pregunta 4, el CRM crea una `Recomendacion` en estado `recibida` con origen `encuesta`, y una tarea para el agente: "Validá y contactá a [nombre], recomendado por [contacto]". Los +200 se otorgan al validar.
- **Alertas para el agente:**
  - Respondió "Sí" o "Tal vez" a la pregunta 2 → marcar al contacto como **posible captación** y crear una tarea de seguimiento.
  - Calificación de 1 o 2 → alerta para que el agente lo llame.

### 5.3 Respaldo por WhatsApp
Después de enviar, mostrar un botón opcional "Avisale a [agente] por WhatsApp" que abre `wa.me/<número del agente>` con un mensaje corto. Las respuestas ya están guardadas; esto solo abre la conversación.

---

## 6. Envío mensual por WhatsApp

El CRM **nunca envía mensajes automáticamente.** Prepara y facilita el envío:

- Vista **"Club · envío del mes"** para cada agente: lista de contactos activos del club, con un botón por contacto que abre WhatsApp con el mensaje listo:
  > "¡Hola, [nombre]! Te dejo tu estado de cuenta del Club de referidos: tus puntos, tus recomendaciones y lo que podés canjear 👉 [link]. Si respondés la encuesta, sumás 150 puntos más."
- Marcar cada envío como hecho, con fecha.
- Filtro para ver quién respondió la encuesta del mes y quién no.

---

## 7. Gestión del agente

- **Inscribir contactos** al club, de a uno o en grupo desde la lista de contactos.
- **Catálogo de beneficios:** alta, edición, activo o inactivo.
- **Canjes:** lista de pedidos, marcar como entregado o cancelado.
- **Recomendaciones:** vista en el CRM con estado, quién recomendó y puntos otorgados. Cambiar el estado otorga los puntos según la sección 3.
- **Ajuste manual de puntos**, con motivo obligatorio.

---

## 8. Métricas del club

Por agente y por mes:
- Contactos activos en el club y estados de cuenta enviados.
- Encuestas respondidas (porcentaje sobre enviadas).
- Recomendaciones recibidas, validadas, que llegaron a reunión o tasación y que terminaron en operación.
- Posibles captaciones detectadas por la encuesta.
- Canjes pedidos y entregados, y puntos otorgados contra canjeados.

---

## 9. Privacidad y datos personales

- Los contactos se inscriben al club con su consentimiento; la página incluye un aviso breve de privacidad y la opción de darse de baja.
- La página pública muestra solo los datos del propio contacto. De las personas que recomendó, solo nombre de pila e inicial.
- El token se puede regenerar si un link se comparte por error.
- Cumplir la Ley 25.326 de Protección de Datos Personales.
- Los beneficios son regalos o servicios, nunca dinero ni parte de los honorarios.

---

## 10. Fases

**Fase 1:** modelo de datos, inscripción al club, página pública con saldo, recomendaciones y beneficios, encuesta que guarda en el CRM y otorga puntos, y envío mensual asistido por WhatsApp.

**Fase 2:** alertas de posible captación y calificación baja, recomendaciones creadas desde la encuesta con validación, y canjes.

**Fase 3:** métricas del club y configuración de reglas de puntos y preguntas por agente.

---

## 11. Criterios de aceptación

1. Las respuestas de la encuesta quedan guardadas en el CRM sin depender de que el contacto mande un WhatsApp.
2. El saldo de puntos siempre coincide con la suma de movimientos.
3. Una segunda encuesta en el mismo mes se guarda pero no suma puntos.
4. Los +200 por recomendado desde la encuesta solo se otorgan después de la validación del agente.
5. La página pública no muestra teléfonos ni apellidos completos de otras personas.
6. Un token inválido no muestra ningún dato.
7. Responder "Sí" o "Tal vez" a la pregunta 2 marca al contacto como posible captación y crea una tarea.
8. El CRM nunca envía mensajes por su cuenta; solo prepara el texto y abre WhatsApp.
9. Todo funciona en el celular y en modo claro y oscuro.
10. Todo el texto visible está en español rioplatense.
