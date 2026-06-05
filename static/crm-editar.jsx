// Modal para editar un contacto existente
const { useState: useStateE } = React;

function EditarContacto({ contacto, onClose, onSave }) {
  const [nombre,    setNombre]    = useStateE(contacto.nombre || '');
  const [tel,       setTel]       = useStateE(contacto.telefono || '');
  const [necesidad, setNecesidad] = useStateE(contacto.necesidad || '');
  const [cumple,    setCumple]    = useStateE(contacto.cumple || '');
  const [saving,    setSaving]    = useStateE(false);
  const [error,     setError]     = useStateE('');

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true);
    setError('');
    try {
      const digits = tel.replace(/\D/g, '');
      await window.CRM_API.put('/contactos/' + contacto.id, {
        nombre:           nombre.trim(),
        telefono:         digits,
        whatsapp_link:    digits ? 'https://wa.me/54' + digits : '',
        necesidad:        necesidad.trim(),
        fecha_cumpleanos: cumple || null,
      });
      onSave();
    } catch(e) {
      setError('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="m-kicker">Editar contacto</div>
        <h2>{contacto.nombre}</h2>

        <div className="field">
          <label>Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Teléfono <span className="opt">· sin +54</span></label>
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="11 5926 7961" />
          </div>
          <div className="field">
            <label>Cumpleaños <span className="opt">· opcional</span></label>
            <input type="date" value={cumple} onChange={e => setCumple(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>¿Qué necesita? <span className="opt">· opcional</span></label>
          <input value={necesidad} onChange={e => setNecesidad(e.target.value)} placeholder="Vender, comprar, alquilar…" />
        </div>

        {error && <p style={{ color:'var(--caliente)', fontSize:'calc(13px * var(--fs-scale))', margin:'0 0 12px' }}>{error}</p>}

        <div className="modal-actions">
          <button className="save" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button className="cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EditarContacto });
