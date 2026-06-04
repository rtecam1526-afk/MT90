// App principal — adaptado para Flask/Supabase backend
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "inicioDir": "Lista del día",
  "paleta": ["#E0633A", "#2A2530", "#FBF6F0"],
  "fuente": "Cálida",
  "textoSize": 1,
  "esconderCartera": false,
  "mostrarCierre": true
}/*EDITMODE-END*/;

const PALETTE_NAMES = {
  "#E0633A": "Coral cálido",
  "#D8922E": "Ámbar miel",
  "#C2553D": "Terracota",
  "#C9706A": "Rosa arena",
};
const FONTS = {
  "Cálida":  { display: '"Bricolage Grotesque"', body: '"Hanken Grotesque"' },
  "Redonda": { display: '"Plus Jakarta Sans"', body: '"Plus Jakarta Sans"' },
  "Neutra":  { display: '"DM Sans"', body: '"DM Sans"' },
};

function softTint(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r+(255-r)*.86)},${Math.round(g+(255-g)*.86)},${Math.round(b+(255-b)*.86)})`;
}
function deepenBg(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.max(0,Math.round(r*.965))},${Math.max(0,Math.round(g*.965))},${Math.max(0,Math.round(b*.965))})`;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Real data state
  const [rawContacts, setRawContacts] = useStateA([]);
  const [loading, setLoading] = useStateA(true);
  const [loadError, setLoadError] = useStateA(null);

  const [done, setDone] = useStateA(() => {
    try { return JSON.parse(localStorage.getItem("mt90_done") || "{}"); } catch { return {}; }
  });

  const data = useMemoA(() => {
    if (!rawContacts.length) return null;
    return window.buildCrmData(rawContacts, done);
  }, [rawContacts, done]);

  const [tab, setTab] = useStateA("hoy");
  const [forceEnfoque, setForceEnfoque] = useStateA(false);
  const [modal, setModal] = useStateA(false);
  const [detalle, setDetalle] = useStateA(null);
  const [toast, setToast] = useStateA(null);
  const [buscar, setBuscar] = useStateA(false);
  const [menuMas, setMenuMas] = useStateA(false);
  const [ajustes, setAjustes] = useStateA(false);
  const [syncing, setSyncing] = useStateA(false);
  const [lastSync, setLastSync] = useStateA("Cargando…");
  const [revision, setRevision] = useStateA(false);

  const esViernes = new Date().getDay() === 5;
  const [cierreCerrado, setCierreCerrado] = useStateA(false);
  const verCierre = (esViernes || t.mostrarCierre) && !cierreCerrado && data;

  useEffectA(() => { localStorage.setItem("mt90_done", JSON.stringify(done)); }, [done]);

  // Apply tweaks to :root
  useEffectA(() => {
    const root = document.documentElement;
    const [primary, ink, bg] = t.paleta;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ink", ink);
    root.style.setProperty("--bg", bg);
    root.style.setProperty("--primary-soft", softTint(primary));
    root.style.setProperty("--surface-2", deepenBg(bg));
    const f = FONTS[t.fuente] || FONTS["Cálida"];
    root.style.setProperty("--font-display", f.display + ", system-ui, sans-serif");
    root.style.setProperty("--font-body", f.body + ", system-ui, sans-serif");
    root.style.setProperty("--fs-scale", t.textoSize);
  }, [t.paleta, t.fuente, t.textoSize]);

  async function loadContacts() {
    try {
      setSyncing(true);
      const contacts = await window.CRM_API.get('/contactos');
      setRawContacts(contacts);
      setLastSync("Actualizado hace instantes");
      setLoadError(null);
    } catch(e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffectA(() => { loadContacts(); }, []);

  function toggleDone(id) {
    setDone(d => ({ ...d, [id]: !d[id] }));
    const hoy = new Date();
    const fec = String(hoy.getDate()).padStart(2,'0') + '/' + String(hoy.getMonth()+1).padStart(2,'0') + '/' + hoy.getFullYear();
    if (window.CRM_API) window.CRM_API.put('/contactos/' + id, {fecha_ultimo_contacto: fec}).catch(console.error);
  }

  function showToast(txt) {
    setToast(txt);
    setTimeout(() => setToast(null), 1900);
  }

  function openDetalle(c) { setDetalle(c); }

  function onWhatsapp(p) {
    const digits = (p.telefono || "").replace(/\D/g, "");
    const phone = digits ? "549" + digits : "";
    const text = p.mensaje ? "?text=" + encodeURIComponent(p.mensaje) : "";
    const url = "https://wa.me/" + phone + text;
    window.open(url, "_blank", "noopener");
    showToast("Abriendo WhatsApp con " + (p.nombre||'').split(" ")[0] + "…");
  }

  async function saveContact(nombre) {
    setModal(false);
    showToast(nombre ? nombre.split(" ")[0] + " guardado" : "Contacto guardado");
    await loadContacts();
  }

  function doSync() {
    loadContacts();
    showToast("Sincronizando…");
  }

  if (loading) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',fontFamily:'var(--font-body)',flexDirection:'column',gap:'14px',color:'var(--muted)'}}>
        <div style={{width:44,height:44,border:'3px solid var(--line)',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin .8s linear infinite'}}></div>
        <div style={{fontSize:'calc(16px * var(--fs-scale))'}}>Cargando tus contactos…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',fontFamily:'var(--font-body)',flexDirection:'column',gap:'14px'}}>
        <div style={{fontSize:'1.5rem'}}>⚠️</div>
        <div style={{color:'var(--ink)',fontWeight:700}}>Error al cargar contactos</div>
        <div style={{color:'var(--muted)',fontSize:'.9rem'}}>{loadError}</div>
        <button onClick={loadContacts} style={{background:'var(--primary)',color:'#fff',border:'none',padding:'12px 24px',borderRadius:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Reintentar</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',fontFamily:'var(--font-body)',flexDirection:'column',gap:'14px'}}>
        <div style={{fontSize:'1.5rem'}}>📭</div>
        <div style={{color:'var(--ink)',fontWeight:700}}>Sin contactos cargados</div>
        <div style={{color:'var(--muted)',fontSize:'.9rem',textAlign:'center',maxWidth:320}}>
          La base de datos no devolvió contactos para este agente. Revisá las variables de entorno en Render (SUPABASE_URL, SUPABASE_KEY).
        </div>
        <button onClick={loadContacts} style={{background:'var(--primary)',color:'#fff',border:'none',padding:'12px 24px',borderRadius:'12px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Reintentar</button>
      </div>
    );
  }

  const dir = t.inicioDir;
  let hoyView;
  if (tab === "hoy") {
    if (forceEnfoque || dir === "Modo enfoque") {
      hoyView = <HoyEnfoque data={data} done={done} onToggleDone={toggleDone} onWhatsapp={onWhatsapp} />;
    } else if (dir === "Inicio asistente") {
      hoyView = <InicioAsistente data={data} done={done} onWhatsapp={onWhatsapp} onToggleDone={toggleDone}
                  onEmpezar={() => setForceEnfoque(true)} onOpen={openDetalle} />;
    } else {
      hoyView = <HoyLista data={data} done={done} onToggleDone={toggleDone} onWhatsapp={onWhatsapp} onOpen={openDetalle} />;
    }
  }

  const wideMain = tab === "cartera" || tab === "agente" || tab === "campanas";

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <span className="m">MT90</span>
          <span className="t">Tracción</span>
        </div>

        <nav className="nav">
          <button className={tab === "hoy" ? "active" : ""} onClick={() => { setTab("hoy"); setForceEnfoque(false); }}>
            <span className="dot" style={{ background: "var(--primary)" }}></span> Hoy
          </button>
          <button className={tab === "semana" ? "active" : ""} onClick={() => setTab("semana")}>
            Mi semana
          </button>
          <button className={tab === "agente" ? "active" : ""} onClick={() => setTab("agente")}>
            Agente IA
          </button>
          <button className={tab === "campanas" ? "active" : ""} onClick={() => setTab("campanas")}>
            Campañas
          </button>
          {!t.esconderCartera && (
            <button className={tab === "cartera" ? "active" : ""} onClick={() => setTab("cartera")}>
              Cartera
            </button>
          )}
        </nav>

        <div className="topbar-spacer"></div>
        <span className="topbar-meta">{data.totalContactos} contactos</span>
        <button className="icon-btn" onClick={() => setBuscar(true)} aria-label="Buscar"><Icon.search /></button>
        <div className="mas-wrap">
          <button className={"icon-btn" + (menuMas ? " active" : "") + (syncing ? " spin" : "")} onClick={() => setMenuMas(v => !v)}>
            {syncing ? <Icon.sync /> : <Icon.more />}
          </button>
          {menuMas && <MenuMas lastSync={lastSync} onSync={doSync} onIA={() => { setTab("agente"); setMenuMas(false); }} onAjustes={() => { setAjustes(true); setMenuMas(false); }} onClose={() => setMenuMas(false)} />}
        </div>
        <button className="btn-add" onClick={() => setModal(true)}><Icon.plus /> Contacto</button>
      </header>

      <main className={"main" + (wideMain ? " wide" : "")}>
        {tab === "hoy" && verCierre && (
          <CierreSemana data={data} onVerSemana={() => { setTab("semana"); setCierreCerrado(true); }} onClose={() => setCierreCerrado(true)} />
        )}
        {tab === "hoy" && hoyView}
        {tab === "semana" && (
          <MiSemana data={data} done={done} onWhatsapp={onWhatsapp} onToggleDone={toggleDone}
            onOpen={openDetalle} onIrHoy={() => { setTab("hoy"); setForceEnfoque(false); }}
            onRevision={() => setRevision(true)} />
        )}
        {tab === "cartera" && <Cartera data={data} onOpen={openDetalle} onWhatsapp={onWhatsapp} onToggleDone={toggleDone} done={done} />}
        {tab === "agente" && <AgenteIA data={data} onWhatsapp={onWhatsapp} />}
        {tab === "campanas" && <Campanas data={data} onWhatsapp={onWhatsapp} />}
      </main>

      {detalle && (
        <ContactoDetalle
          c={detalle}
          done={done}
          onToggleDone={toggleDone}
          onWhatsapp={onWhatsapp}
          onClose={() => setDetalle(null)}
          onUpdate={loadContacts}
        />
      )}

      {modal && <NuevoContacto onClose={() => setModal(false)} onSave={saveContact} />}
      {buscar && <BuscarOverlay data={data} onOpen={openDetalle} onClose={() => setBuscar(false)} />}
      {ajustes && <AjustesModal data={data} onClose={() => setAjustes(false)} />}
      {revision && <RevisionGuiada data={data} onCerrar={() => { setRevision(false); loadContacts(); }} />}

      <div className={"focus-toast" + (toast ? " show" : "")}>
        <Icon.wa /> {toast || ""}
      </div>

      <TweaksPanel>
        <TweakSection label="Direcciones a comparar" />
        <TweakRadio label="Pantalla principal (Hoy)" value={t.inicioDir} options={["Lista del día", "Modo enfoque", "Inicio asistente"]} onChange={(v) => { setTweak("inicioDir", v); setForceEnfoque(false); }} />
        <TweakSection label="Calidez visual" />
        <TweakColor label="Paleta (cálidas)" value={t.paleta} options={[["#E0633A","#2A2530","#FBF6F0"],["#D8922E","#2E2820","#FBF4E8"],["#C2553D","#2E2622","#F8F1E9"],["#C9706A","#2E2528","#FBF1EE"]]} onChange={(v) => setTweak("paleta", v)} />
        <TweakColor label="Paleta (grises)" value={t.paleta} options={[["#4F4A43","#1F1C18","#F2EFEA"],["#5A5C60","#1E1F21","#F1F1F0"]]} onChange={(v) => setTweak("paleta", v)} />
        <TweakRadio label="Tipografía" value={t.fuente} options={["Cálida", "Redonda", "Neutra"]} onChange={(v) => setTweak("fuente", v)} />
        <TweakSection label="Baja afinidad tecnológica" />
        <TweakSlider label="Tamaño de texto" value={t.textoSize} min={0.9} max={1.3} step={0.05} onChange={(v) => setTweak("textoSize", v)} />
        <TweakToggle label="Esconder la cartera completa" value={t.esconderCartera} onChange={(v) => { setTweak("esconderCartera", v); if(v) setTab("hoy"); }} />
        <TweakToggle label="Mostrar cierre de semana" value={t.mostrarCierre} onChange={(v) => { setTweak("mostrarCierre", v); setCierreCerrado(false); setTab("hoy"); }} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
