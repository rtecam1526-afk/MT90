# Experiencia de uso del CRM — Pedido para Claude Code

## 0. Cómo trabajar este pedido

Este pedido no agrega funciones: cambia **cómo se ve y cómo se usa** lo que ya existe, para que cualquier agente lo maneje sin ayuda.

1. Recorré todas las pantallas actuales del CRM y armame una lista: pantalla, para qué sirve, cuántos toques lleva la tarea principal y qué problemas ves según las reglas de abajo.
2. Proponeme los cambios priorizados (sección 9) **antes de tocar código**, y esperá mi OK.
3. Trabajá en una rama nueva. Nada de esto requiere cambios en la base de datos, salvo el modo operador (sección 6): si lo necesita, avisame antes.
4. Todo el texto visible va en **español rioplatense** (voseo).

---

## 1. Para quién es

Agentes inmobiliarios que trabajan en la calle, desde el celular, entre una visita y otra. No son técnicos y tienen poco tiempo. Hoy hay dos perfiles muy distintos:

- **El agente que usa el CRM todos los días** (como Juli): necesita rapidez y saber qué hacer hoy.
- **El agente que casi no entra** (como Gustavo, Team Leader): no va a cargar datos. Necesita ver resultados sin esfuerzo, o que otra persona opere por él.

La regla para decidir cualquier cosa: **si un agente necesita que le expliquen una pantalla, la pantalla está mal.**

---

## 2. Reglas de diseño

1. **Primero el celular.** Todo se diseña a 390 px de ancho y después se adapta a la computadora. Se usa con una mano: los botones principales van en la mitad de abajo de la pantalla.
2. **Una acción principal por pantalla.** Un solo botón destacado, grande y de color. Lo demás, secundario o escondido en "Más".
3. **Tareas en 3 toques o menos.** Las frecuentes (registrar una visita, inscribir un contacto, abrir WhatsApp) se completan en 3 toques y sin escribir, siempre que se pueda. Escribir siempre es opcional.
4. **Botones grandes:** mínimo 48 px de alto. Texto de al menos 16 px. Buen contraste, también al sol.
5. **Palabras de agente, no de sistema.** "Inscribir", "Abrir WhatsApp", "Marcar enviado", "+ Cargar recomendación", "Terminé la visita". Nunca "registro", "entidad", "submit", "ID" ni códigos internos. Los nombres de los botones tienen que coincidir exactamente con los de las guías.
6. **Deshacer en lugar de confirmar.** Después de una acción, un aviso corto abajo ("Contacto inscripto · Deshacer") en lugar de ventanas de "¿Estás seguro?". Solo se pide confirmación para borrar datos.
7. **Pantallas vacías que enseñan.** Si no hay nada cargado, la pantalla explica en una línea para qué sirve y muestra el botón para empezar. Ejemplo: "Todavía no cargaste beneficios. Son los regalos que tus contactos canjean con sus puntos. **+ Cargar el primero**".
8. **Valores por defecto inteligentes.** Fecha de hoy, el barrio habitual del agente, el último tipo de propiedad usado. Que el agente cambie, no que complete.
9. **Nada se pierde.** Si se corta la señal o se cierra la app a mitad de una carga, el borrador se guarda solo.
10. **Consistencia.** Mismos colores, mismas posiciones y mismos nombres en todas las pantallas. Un mismo tipo de botón hace siempre lo mismo.

---

## 3. Navegación

Barra fija abajo con **cinco** secciones como máximo:

| Sección | Qué tiene |
|---|---|
| **Hoy** | La pantalla de inicio (sección 4) |
| **Contactos** | Buscar, ver y cargar contactos, con su temperatura (caliente, tibio, frío) |
| **Propiedades** | Cartera, visitas y ofertas |
| **Club** | Las seis partes del Club, en este orden: Mi perfil, Beneficios, Inscriptos, Envío del mes, Recomendaciones, Canjes |
| **Más** | Todo lo que se usa poco: configuración, ayuda, métricas |

Un **buscador** siempre visible arriba, que encuentra contactos y propiedades por nombre, teléfono o dirección.

---

## 4. La pantalla "Hoy"

Es lo primero que ve el agente al abrir el CRM y la que más importa. Responde una sola pregunta: **¿qué tengo que hacer hoy?**

- Una lista de tareas ordenadas por importancia, cada una con **un botón que la resuelve ahí mismo**:
  1. Llamar a contactos que dijeron que piensan mudarse → "Llamar".
  2. Seguimientos de visitas de ayer → "Abrir WhatsApp".
  3. Recomendaciones por validar → "Validar".
  4. Canjes por entregar → "Coordinar entrega".
  5. Envíos del mes pendientes → "Ir al envío".
- Si no hay nada: "Estás al día" y una sugerencia concreta (por ejemplo, "Inscribí 5 contactos nuevos al Club").
- Arriba, una línea con el avance de la semana (por ejemplo, "Esta semana: 6 visitas · 2 ofertas").

---

## 5. Ayuda dentro del CRM

- Un botón **"?"** en cada sección que abre la explicación de esa sección en lenguaje simple, con lo mismo que dicen las guías: para qué sirve, cuándo se usa y qué botón tocar.
- La **primera vez** que un agente entra, una lista de arranque con 4 pasos tildables: completar Mi perfil, cargar un beneficio, inscribir el primer contacto y hacer el primer envío.

---

## 6. Modo operador

Para agentes que no van a usar el CRM ellos mismos. Una persona del equipo de MT90 opera en su nombre.

- Un usuario con rol **operador** puede elegir **"Operar como: [Agente]"**. Mientras tanto, se ve siempre una franja de color arriba: "Estás operando por Gustavo Lugo".
- Todo lo que hace queda registrado como hecho por el operador en nombre de ese agente.
- Los botones de WhatsApp usan el número de envío configurado para ese agente: el suyo o el número del Club, con los mensajes en tercera persona ("Te escribo de parte de…").
- El operador ve la misma pantalla "Hoy" del agente, y puede **pasarle una tarea** que solo el agente puede hacer (por ejemplo, una llamada): al agente le llega un aviso por WhatsApp con los datos y un link.

---

## 7. Vista del Team Leader

Para un líder que no carga datos pero quiere ver a su equipo:

- **Panel del equipo, solo lectura:** cada agente con su actividad de la semana, sus oportunidades abiertas y un semáforo (al día, atrasado, sin actividad).
- **Resumen del lunes por WhatsApp:** el CRM arma el mensaje y el operador o el sistema lo manda. El líder no necesita entrar al CRM para enterarse de cómo viene su equipo.

---

## 8. Cómo comprobar que funciona

Antes de dar por terminado cada cambio, estas tareas tienen que poder hacerse **desde el celular, sin ayuda y en el tiempo indicado**:

| Tarea | Tiempo máximo |
|---|---|
| Encontrar un contacto por nombre | 10 segundos |
| Registrar cómo fue una visita | 15 segundos |
| Inscribir un contacto al Club y abrir WhatsApp con su link | 20 segundos |
| Cargar una recomendación | 30 segundos |
| Saber qué hay que hacer hoy | 5 segundos, sin tocar nada |

Además:
- Agregá un registro simple de uso (qué pantallas se abren y qué botones se tocan, por agente), para detectar dónde se traban.
- Hacé capturas de cada pantalla cambiada, en celular, antes y después.

---

## 9. Orden sugerido

1. **Pantalla "Hoy"** y barra de navegación.
2. **Reglas de diseño** aplicadas a las pantallas que más se usan: contactos, visitas y Club.
3. **Ayuda "?"** y lista de arranque.
4. **Modo operador.**
5. **Vista del Team Leader** y resumen del lunes.

---

## 10. Criterios de aceptación

1. Todas las pantallas funcionan bien a 390 px de ancho, con botones de al menos 48 px.
2. Cada pantalla tiene una sola acción principal destacada.
3. Las tareas de la sección 8 se cumplen en los tiempos indicados.
4. Ninguna pantalla muestra términos técnicos, IDs ni mensajes de error sin explicación.
5. Todas las pantallas vacías explican para qué sirven y muestran el botón para empezar.
6. En modo operador, la franja "Estás operando por…" está siempre visible y todo queda registrado.
7. El CRM nunca envía mensajes por su cuenta: prepara el texto y abre WhatsApp, salvo el resumen del lunes si se configura así.
