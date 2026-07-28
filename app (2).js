// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwgkXtRDBi09HGR3xIx7FynH6YueZF016LT8fl-bi3bnSO2t1Bum3WtNKEeBlkga6z4/exec';

let SESION = JSON.parse(localStorage.getItem('sesionCajar') || 'null');
let AGENTES = [];
let ESCRITOS_CACHE = [];
let TURNOS_CACHE = [];
let CAMBIOS_CACHE = [];
let mesActual = new Date();
let tabActiva = 'cuadrante';
let subtabActiva = 'turnos';

// ------------------------------------------------------------
// INDICADOR DE "PROCESANDO" EN BOTONES
// ------------------------------------------------------------
function conProcesando(boton, textoProcesando, fn) {
  return async (...args) => {
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner"></span>${textoProcesando}`;
    try {
      await fn(...args);
    } finally {
      boton.disabled = false;
      boton.innerHTML = textoOriginal;
    }
  };
}

// ------------------------------------------------------------
// LLAMADAS A LA API
// ------------------------------------------------------------
async function llamar(action, datos = {}) {
  const payload = Object.assign({ action, token: SESION ? SESION.token : '' }, datos);
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return await resp.json();
  } catch (err) {
    console.error('Error llamando a la API:', err);
    return { ok: false, error: 'No se pudo conectar con el servidor. (' + err.message + ')' };
  }
}

// ------------------------------------------------------------
// LOGIN / SESIÓN
// ------------------------------------------------------------
async function hacerLogin() {
  const boton = document.getElementById('loginBtn');
  await conProcesando(boton, 'Entrando…', async () => {
    const usuario = document.getElementById('loginUsuario').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';
    if (!usuario || !password) { errorEl.textContent = 'Rellena usuario y contraseña'; return; }

    const r = await llamar('login', { usuario, password });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    SESION = r;
    localStorage.setItem('sesionCajar', JSON.stringify(SESION));
    mostrarApp();
  })();
}

function logout() {
  localStorage.removeItem('sesionCajar');
  SESION = null;
  document.getElementById('appView').classList.add('oculto');
  document.getElementById('loginView').classList.remove('oculto');
}

function mostrarApp() {
  document.getElementById('loginView').classList.add('oculto');
  document.getElementById('appView').classList.remove('oculto');
  document.getElementById('usuarioActual').textContent = `${SESION.nombre} (${SESION.rol})`;
  document.getElementById('tabAgentesBtn').classList.toggle('oculto', SESION.rol !== 'admin');
  cargarAgentes();
  cambiarTab('cuadrante');
}

// ------------------------------------------------------------
// NAVEGACIÓN
// ------------------------------------------------------------
function cambiarTab(tab) {
  tabActiva = tab;
  document.getElementById('tabCuadranteBtn').classList.toggle('activo', tab === 'cuadrante');
  document.getElementById('tabRegistrosBtn').classList.toggle('activo', tab === 'registros');
  document.getElementById('tabAgentesBtn').classList.toggle('activo', tab === 'agentes');

  document.getElementById('vistaCuadrante').classList.toggle('oculto', tab !== 'cuadrante');
  document.getElementById('vistaRegistros').classList.toggle('oculto', tab !== 'registros');
  document.getElementById('vistaAgentes').classList.toggle('oculto', tab !== 'agentes');
  document.getElementById('subtabsCuadrante').classList.toggle('oculto', tab !== 'cuadrante');

  actualizarFab();

  if (tab === 'cuadrante') cargarDatosSubtab();
  else if (tab === 'registros') cargarEscritos();
  else if (tab === 'agentes') cargarListaAgentesAdmin();
}

function cambiarSubtab(sub) {
  subtabActiva = sub;
  document.querySelectorAll('#subtabsCuadrante button').forEach(b => b.classList.remove('activo'));
  event.target.classList.add('activo');

  document.getElementById('subvistaTurnos').classList.toggle('oculto', sub !== 'turnos');
  document.getElementById('subvistaDisponibilidad').classList.toggle('oculto', sub !== 'disponibilidad');
  document.getElementById('subvistaDeudas').classList.toggle('oculto', sub !== 'deudas');
  document.getElementById('subvistaEquidad').classList.toggle('oculto', sub !== 'equidad');

  actualizarFab();
  cargarDatosSubtab();
}

function actualizarFab() {
  const fab = document.getElementById('fabBtn');
  const texto = document.getElementById('fabTexto');
  if (tabActiva === 'cuadrante' && subtabActiva === 'turnos' && SESION.rol === 'admin') {
    fab.classList.remove('oculto'); texto.textContent = 'Nuevo turno';
  } else if (tabActiva === 'registros') {
    fab.classList.remove('oculto'); texto.textContent = 'Nuevo registro';
  } else if (tabActiva === 'agentes') {
    fab.classList.remove('oculto'); texto.textContent = 'Nuevo agente';
  } else {
    fab.classList.add('oculto');
  }
}

function abrirModalSegunTab() {
  if (tabActiva === 'cuadrante' && subtabActiva === 'turnos') abrirModalTurno();
  else if (tabActiva === 'registros') abrirModalEscrito();
  else if (tabActiva === 'agentes') abrirModalAgente();
}

function cargarDatosSubtab() {
  if (subtabActiva === 'turnos') cargarTurnos();
  else if (subtabActiva === 'disponibilidad') cargarDisponibilidad();
  else if (subtabActiva === 'deudas') cargarDeudas();
  else if (subtabActiva === 'equidad') cargarEquidad();
}

// ------------------------------------------------------------
// AGENTES (generales)
// ------------------------------------------------------------
async function cargarAgentes() {
  const r = await llamar('getAgentes');
  if (r.ok) AGENTES = r.agentes;
}

function opcionesAgentes(excluir) {
  return AGENTES.filter(a => a.usuario !== excluir).map(a => `<option value="${a.usuario}">${a.nombre}</option>`).join('');
}

function nombreAgente(usuario) {
  const a = AGENTES.find(a => a.usuario === usuario);
  return a ? a.nombre : usuario;
}

function mesISO(fecha) { return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`; }
function cambiarMes(delta) { mesActual.setMonth(mesActual.getMonth() + delta); cargarDatosSubtab(); }
function formatearFechaCorta(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}`; }

// ------------------------------------------------------------
// TURNOS
// ------------------------------------------------------------
async function cargarTurnos() {
  document.getElementById('mesLabel').textContent = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const [rTurnos, rCambios] = await Promise.all([
    llamar('getTurnos', { mes: mesISO(mesActual) }),
    llamar('getCambiosPendientes')
  ]);
  if (rTurnos.ok) TURNOS_CACHE = rTurnos.turnos;
  if (rCambios.ok) CAMBIOS_CACHE = rCambios.cambios;
  renderTurnos();
  renderCambiosPendientes();
}

const PALETA_AGENTES = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];
function colorAgente(usuario) {
  if (!usuario) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < usuario.length; i++) hash = usuario.charCodeAt(i) + ((hash << 5) - hash);
  return PALETA_AGENTES[Math.abs(hash) % PALETA_AGENTES.length];
}

function renderTurnos() {
  const cont = document.getElementById('listaTurnos');
  const year = mesActual.getFullYear(), month = mesActual.getMonth();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7; // 0=lunes

  const porDia = {};
  TURNOS_CACHE.forEach(t => { (porDia[t.fecha] = porDia[t.fecha] || []).push(t); });

  let html = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-cabecera">${d}</div>`).join('');
  for (let i = 0; i < primerDiaSemana; i++) html += '<div class="cal-celda vacia"></div>';

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const turnosDia = porDia[fecha] || [];
    const chips = turnosDia.map(t => {
      const sinAsignar = !t.agente;
      const color = sinAsignar ? '' : `background:${colorAgente(t.agente)};`;
      const claseAdicional = sinAsignar ? 'sin-asignar' : '';
      const etiqueta = sinAsignar ? 'Sin asignar' : nombreAgente(t.agente);
      const clic = SESION.rol === 'admin'
        ? `abrirModalAsignarTurno(${JSON.stringify(t.id)}, ${JSON.stringify(t.fecha)}, ${JSON.stringify(t.horaInicio)}, ${JSON.stringify(t.horaFin)}, ${JSON.stringify(t.agente)})`
        : (t.agente === SESION.usuario ? `abrirModalCambio('${t.fecha}')` : '');
      return `<span class="turno-chip ${claseAdicional}" style="${color}" ${clic ? `onclick="${clic}"` : ''}>${etiqueta}<span class="chip-hora">${t.horaInicio}-${t.horaFin}</span></span>`;
    }).join('');
    html += `<div class="cal-celda"><div class="cal-num">${d}</div>${chips}</div>`;
  }
  cont.innerHTML = `<div class="calendario">${html}</div>`;

  const agentesEnMes = [...new Set(TURNOS_CACHE.filter(t => t.agente).map(t => t.agente))];
  document.getElementById('leyendaAgentes').innerHTML = agentesEnMes.map(a =>
    `<span class="leyenda-item"><span class="leyenda-punto" style="background:${colorAgente(a)}"></span>${nombreAgente(a)}</span>`
  ).join('');
}

function renderCambiosPendientes() {
  const pendientesParaMi = CAMBIOS_CACHE.filter(c => c.estado === 'pendiente' && c.agenteNuevo === SESION.usuario);
  const card = document.getElementById('cambiosPendientesCard');
  if (!pendientesParaMi.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('listaCambiosPendientes').innerHTML = pendientesParaMi.map(c => `
    <div class="fila" style="margin-bottom:8px;">
      <span style="font-size:13px;">${nombreAgente(c.agenteOriginal)} te propone el día ${formatearFechaCorta(c.fechaTurno)}</span>
      <span>
        <button class="pequena accion" onclick="responderCambio('${c.id}','aceptado')">Aceptar</button>
        <button class="pequena secundaria" onclick="responderCambio('${c.id}','rechazado')">Rechazar</button>
      </span>
    </div>`).join('');
}

async function responderCambio(id, respuesta) {
  const r = await llamar('responderCambio', { id, respuesta });
  if (!r.ok) { alert(r.error); return; }
  cargarTurnos();
}

// -- Modal: nuevo turno (admin) --
function abrirModalTurno() {
  document.getElementById('turnoFecha').value = '';
  document.getElementById('turnoHoraInicio').value = '';
  document.getElementById('turnoHoraFin').value = '';
  document.getElementById('turnoAgente').innerHTML = '<option value="">Sin asignar</option>' + opcionesAgentes();
  document.getElementById('modalTurno').classList.remove('oculto');
}
async function guardarTurno() {
  const boton = document.getElementById('guardarTurnoBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const fecha = document.getElementById('turnoFecha').value;
    const horaInicio = document.getElementById('turnoHoraInicio').value;
    const horaFin = document.getElementById('turnoHoraFin').value;
    const agente = document.getElementById('turnoAgente').value;
    if (!fecha || !horaInicio || !horaFin) { alert('Fecha y horario son obligatorios'); return; }
    const r = await llamar('crearTurno', { fecha, horaInicio, horaFin, agente });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalTurno');
    cargarTurnos();
  })();
}

// -- Modal: asignar/cambiar agente de un turno existente (admin) --
function abrirModalAsignarTurno(id, fecha, horaInicio, horaFin, agenteActual) {
  document.getElementById('asigTurnoId').value = id;
  document.getElementById('asigTurnoInfo').textContent = `${formatearFechaCorta(fecha)} · ${horaInicio}–${horaFin}`;
  document.getElementById('asigTurnoAgente').innerHTML = '<option value="">Sin asignar</option>' + opcionesAgentes();
  document.getElementById('asigTurnoAgente').value = agenteActual || '';
  document.getElementById('modalAsignarTurno').classList.remove('oculto');
}
async function guardarAsignacionTurno() {
  const boton = document.getElementById('guardarAsigBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const id = document.getElementById('asigTurnoId').value;
    const agente = document.getElementById('asigTurnoAgente').value;
    const r = await llamar('asignarTurno', { id, agente });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalAsignarTurno');
    cargarTurnos();
  })();
}

// -- Modal: proponer cambio --
function abrirModalCambio(fecha) {
  document.getElementById('cambioFecha').value = fecha;
  document.getElementById('cambioFechaTexto').textContent = formatearFechaCorta(fecha);
  document.getElementById('cambioAgenteNuevo').innerHTML = opcionesAgentes(SESION.usuario);
  document.getElementById('modalCambio').classList.remove('oculto');
}
async function enviarPropuestaCambio() {
  const boton = document.getElementById('proponerCambioBtn');
  await conProcesando(boton, 'Enviando…', async () => {
    const fecha_turno = document.getElementById('cambioFecha').value;
    const agente_nuevo = document.getElementById('cambioAgenteNuevo').value;
    const r = await llamar('proponerCambio', { fecha_turno, agente_original: SESION.usuario, agente_nuevo });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalCambio');
    alert('Propuesta enviada. Se aplicará en cuanto el otro agente la acepte.');
    cargarTurnos();
  })();
}

// ------------------------------------------------------------
// MI DISPONIBILIDAD
// ------------------------------------------------------------
async function cargarDisponibilidad() {
  document.getElementById('mesLabel').textContent = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const r = await llamar('getIndisponibilidades', { mes: mesISO(mesActual) });
  if (!r.ok) return;
  renderRejillaDisponibilidad(r.propias);

  const cardAdmin = document.getElementById('cardIndispAdmin');
  if (SESION.rol === 'admin') {
    cardAdmin.classList.remove('oculto');
    const porAgente = {};
    r.todas.forEach(t => { (porAgente[t.agente] = porAgente[t.agente] || []).push(formatearFechaCorta(t.fecha)); });
    const html = Object.keys(porAgente).length
      ? Object.entries(porAgente).map(([ag, dias]) => `<p style="font-size:13px;"><b>${nombreAgente(ag)}</b>: ${dias.join(', ')}</p>`).join('')
      : '<p style="font-size:13px;color:#9ca3af;">Nadie ha marcado indisponibilidad este mes.</p>';
    document.getElementById('listaIndispAdmin').innerHTML = html;
  } else {
    cardAdmin.classList.add('oculto');
  }
}

function renderRejillaDisponibilidad(propias) {
  const year = mesActual.getFullYear(), month = mesActual.getMonth();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const cont = document.getElementById('rejillaDisponibilidad');
  let html = '';
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const marcado = propias.includes(fecha);
    html += `<div class="dia-disp ${marcado ? 'no-puedo' : ''}" onclick="toggleDia('${fecha}', this)">${d}</div>`;
  }
  cont.innerHTML = html;
}

async function toggleDia(fecha, el) {
  el.style.opacity = '0.5';
  const r = await llamar('toggleIndisponibilidad', { fecha });
  el.style.opacity = '1';
  if (!r.ok) { alert(r.error); return; }
  el.classList.toggle('no-puedo', r.marcado);
}

// ------------------------------------------------------------
// DEUDAS
// ------------------------------------------------------------
async function cargarDeudas() {
  document.getElementById('mesLabel').textContent = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const r = await llamar('getDeudas');
  if (!r.ok) return;

  document.getElementById('listaMeDeben').innerHTML = r.meDeben.length
    ? r.meDeben.map(d => filaDeuda(d, nombreAgente(d.deudor) + ' te debe el día ' + formatearFechaCorta(d.fechaTurno))).join('')
    : '<p style="font-size:13px;color:#9ca3af;">Nada pendiente.</p>';

  document.getElementById('listaDebo').innerHTML = r.debo.length
    ? r.debo.map(d => filaDeuda(d, 'Le debes a ' + nombreAgente(d.acreedor) + ' el día ' + formatearFechaCorta(d.fechaTurno))).join('')
    : '<p style="font-size:13px;color:#9ca3af;">Nada pendiente.</p>';
}

function filaDeuda(d, texto) {
  return `
    <div class="fila" style="margin-bottom:8px;">
      <span style="font-size:13px;">${texto}</span>
      <button class="pequena secundaria" onclick="saldarDeuda('${d.id}')">Marcar saldada</button>
    </div>`;
}

async function saldarDeuda(id) {
  if (!confirm('¿Confirmas que esta deuda ya está saldada?')) return;
  const r = await llamar('saldarDeuda', { id });
  if (!r.ok) { alert(r.error); return; }
  cargarDeudas();
}

// ------------------------------------------------------------
// EQUIDAD
// ------------------------------------------------------------
async function cargarEquidad() {
  document.getElementById('mesLabel').textContent = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const r = await llamar('getEquidad', { mes: mesISO(mesActual) });
  if (!r.ok) return;
  const entradas = Object.entries(r.resumen);
  const cont = document.getElementById('listaEquidad');
  if (!entradas.length) { cont.innerHTML = '<p style="font-size:13px;color:#9ca3af;">Sin turnos asignados este mes.</p>'; return; }

  const maxTotal = Math.max(...entradas.map(([, v]) => v.entreSemana + v.finDeSemana), 1);
  cont.innerHTML = entradas
    .sort((a, b) => (b[1].entreSemana + b[1].finDeSemana) - (a[1].entreSemana + a[1].finDeSemana))
    .map(([agente, v]) => {
      const total = v.entreSemana + v.finDeSemana;
      const pctLS = (v.entreSemana / maxTotal) * 100;
      const pctFS = (v.finDeSemana / maxTotal) * 100;
      return `
        <div class="barra-equidad">
          <div class="nombre">${nombreAgente(agente)} — ${total.toFixed(1)}h</div>
          <div class="barra-fondo">
            <div class="barra-ls" style="width:${pctLS}%"></div>
            <div class="barra-fs" style="width:${pctFS}%"></div>
          </div>
        </div>`;
    }).join('');
}

// ------------------------------------------------------------
// REGISTROS GESTIONA
// ------------------------------------------------------------
async function cargarEscritos() {
  const r = await llamar('getEscritos');
  if (r.ok) { ESCRITOS_CACHE = r.escritos; window.UMBRAL_URGENTE = r.umbralUrgente; }
  renderEscritos();
}

function renderEscritos() {
  const filtro = document.getElementById('filtroEstado').value;
  const cont = document.getElementById('listaEscritos');
  let lista = ESCRITOS_CACHE;
  if (filtro) lista = lista.filter(e => e.estado === filtro);
  lista = [...lista].sort((a, b) => (b.diasAbierto - a.diasAbierto));
  if (!lista.length) { cont.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No hay registros.</p>'; return; }

  cont.innerHTML = lista.map(e => {
    const urgente = e.estado !== 'Hecho' && e.diasAbierto >= window.UMBRAL_URGENTE;
    const estancado = e.estado === 'En curso' && e.diasSinActividad >= window.UMBRAL_URGENTE;
    const etqClase = e.estado === 'Hecho' ? 'etq-hecho' : estancado ? 'etq-urgente' : e.estado === 'En curso' ? 'etq-curso' : (urgente ? 'etq-urgente' : 'etq-pendiente');
    const etqTexto = urgente && e.estado === 'Pendiente' ? `Urgente · ${e.diasAbierto}d` : estancado ? `Sin actividad ${e.diasSinActividad}d` : e.estado;
    return `
      <div class="card">
        <div class="fila">
          <h3>Nº ${e.numRegistro} — ${e.tipo}</h3>
          <span class="etiqueta ${etqClase}">${etqTexto}</span>
        </div>
        <p style="font-size:13px;color:#4b5563;margin:4px 0;">${e.descripcion || '(sin descripción)'}</p>
        <p style="font-size:12px;color:#9ca3af;margin:2px 0;">
          Solicitante: ${e.solicitante || '—'} · Entrada: ${e.fechaEntrada}
          ${e.documentoUrl ? ` · <a href="${e.documentoUrl}" target="_blank">documento</a>` : ''}
        </p>
        ${e.agenteAsignado ? `<p style="font-size:12px;color:#9ca3af;">Asignado a: ${nombreAgente(e.agenteAsignado)}</p>` : ''}
        ${e.informeUrl ? `<p style="font-size:12px;"><a href="${e.informeUrl}" target="_blank">Ver informe</a></p>` : ''}
        ${renderBitacora(e.notas)}
        <div class="fila" style="margin-top:8px;">
          <button class="pequena secundaria" onclick="abrirModalNota('${e.id}')">Añadir nota</button>
          <span>
            ${e.estado === 'Pendiente' ? `<button class="pequena accion" onclick="reclamar('${e.id}')">Reclamar</button>` : ''}
            ${puedeLiberar(e) ? `<button class="pequena secundaria" onclick="liberar('${e.id}')">Liberar</button>` : ''}
            ${e.estado === 'En curso' && e.agenteAsignado === SESION.usuario ? `<button class="pequena accion" onclick="abrirModalCerrar('${e.id}')">Marcar hecho</button>` : ''}
          </span>
        </div>
      </div>`;
  }).join('');
}

function renderBitacora(notas) {
  if (!notas || !notas.length) return '';
  return `<div class="bitacora">${notas.map(n => `<div class="nota"><b>${nombreAgente(n.agente)}</b> <span class="fecha-nota">(${n.fecha})</span>: ${n.nota}</div>`).join('')}</div>`;
}

function puedeLiberar(e) {
  if (e.estado !== 'En curso') return false;
  if (e.agenteAsignado === SESION.usuario) return true;
  return e.diasSinActividad >= window.UMBRAL_URGENTE;
}

async function liberar(id) {
  if (!confirm('¿Liberar este registro? Volverá a quedar pendiente para que cualquiera lo retome, conservando la bitácora.')) return;
  const r = await llamar('liberarEscrito', { id });
  if (!r.ok) { alert(r.error); return; }
  cargarEscritos();
}

async function reclamar(id) {
  const r = await llamar('reclamarEscrito', { id });
  if (!r.ok) { alert(r.error); return; }
  cargarEscritos();
}

function abrirModalCerrar(id) {
  document.getElementById('cerrarId').value = id;
  document.getElementById('cerrarInformeUrl').value = '';
  document.getElementById('modalCerrar').classList.remove('oculto');
}
async function confirmarCierre() {
  const boton = document.getElementById('confirmarCierreBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const id = document.getElementById('cerrarId').value;
    const informeUrl = document.getElementById('cerrarInformeUrl').value;
    const r = await llamar('marcarHecho', { id, informeUrl });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalCerrar');
    cargarEscritos();
  })();
}

function abrirModalEscrito() {
  document.getElementById('escritoError').textContent = '';
  ['escNumRegistro', 'escSolicitante', 'escDescripcion', 'escDocumentoUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('escFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modalEscrito').classList.remove('oculto');
}
async function guardarEscrito() {
  const boton = document.getElementById('guardarEscritoBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const numRegistro = document.getElementById('escNumRegistro').value.trim();
    const errorEl = document.getElementById('escritoError');
    errorEl.textContent = '';
    if (!numRegistro) { errorEl.textContent = 'El nº de registro es obligatorio'; return; }
    const r = await llamar('altaEscrito', {
      numRegistro,
      fechaEntrada: document.getElementById('escFecha').value,
      solicitante: document.getElementById('escSolicitante').value,
      tipo: document.getElementById('escTipo').value,
      descripcion: document.getElementById('escDescripcion').value,
      documentoUrl: document.getElementById('escDocumentoUrl').value
    });
    if (!r.ok) {
      errorEl.textContent = r.existente ? `Ya dado de alta por ${nombreAgente(r.existente.altaPor)} — estado: ${r.existente.estado}` : r.error;
      return;
    }
    cerrarModal('modalEscrito');
    cargarEscritos();
  })();
}

function abrirModalNota(escritoId) {
  document.getElementById('notaEscritoId').value = escritoId;
  document.getElementById('notaTexto').value = '';
  document.getElementById('modalNota').classList.remove('oculto');
}
async function guardarNota() {
  const boton = document.getElementById('guardarNotaBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const escritoId = document.getElementById('notaEscritoId').value;
    const nota = document.getElementById('notaTexto').value.trim();
    if (!nota) { alert('Escribe algo antes de guardar'); return; }
    const r = await llamar('agregarNota', { escritoId, nota });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalNota');
    cargarEscritos();
  })();
}

// ------------------------------------------------------------
// AGENTES (admin)
// ------------------------------------------------------------
async function cargarListaAgentesAdmin() {
  await cargarAgentes();
  const cont = document.getElementById('listaAgentesAdmin');
  cont.innerHTML = AGENTES.map(a => `
    <div class="fila-turno">
      <span style="font-weight:600;">${a.nombre}</span>
      <span style="color:#6b7280;font-size:13px;">${a.usuario}</span>
      <span class="etiqueta ${a.rol === 'admin' ? 'etq-curso' : 'etq-sin-asignar'}">${a.rol}</span>
    </div>`).join('');
}

function abrirModalAgente() {
  document.getElementById('agenteError').textContent = '';
  ['agUsuario', 'agNombre', 'agPassword'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('agRol').value = 'agente';
  document.getElementById('modalAgente').classList.remove('oculto');
}
async function guardarAgente() {
  const boton = document.getElementById('guardarAgenteBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const errorEl = document.getElementById('agenteError');
    errorEl.textContent = '';
    const usuario = document.getElementById('agUsuario').value.trim();
    const nombre = document.getElementById('agNombre').value.trim();
    const password = document.getElementById('agPassword').value;
    const rol = document.getElementById('agRol').value;
    if (!usuario || !nombre || !password) { errorEl.textContent = 'Rellena todos los campos'; return; }
    const r = await llamar('crearAgente', { usuario, nombre, password, rol });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    cerrarModal('modalAgente');
    cargarListaAgentesAdmin();
  })();
}

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------
function cerrarModal(id) { document.getElementById(id).classList.add('oculto'); }

// ------------------------------------------------------------
// ARRANQUE
// ------------------------------------------------------------
(async function iniciar() {
  if (SESION) {
    const r = await llamar('verificarSesion', { token: SESION.token });
    if (r.ok) { mostrarApp(); return; }
    localStorage.removeItem('sesionCajar');
  }
  document.getElementById('loginView').classList.remove('oculto');
})();
