// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwgkXtRDBi09HGR3xIx7FynH6YueZF016LT8fl-bi3bnSO2t1Bum3WtNKEeBlkga6z4/exec';

let SESION = JSON.parse(localStorage.getItem('sesionCajar') || 'null');
let AGENTES = [];
let ESCRITOS_CACHE = [];
let TURNOS_CACHE = [];
let CAMBIOS_CACHE = [];
let INTERESES_CACHE = {};
let INDISP_CACHE = {};
let PROPIAS_INDISP_CACHE = [];
let periodoEquidad = 'mes';
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
    const texto = await resp.text();
    try {
      return JSON.parse(texto);
    } catch (errParse) {
      console.error('Respuesta no válida del servidor para', action, ':', texto.slice(0, 300));
      return { ok: false, error: 'El servidor devolvió una respuesta rara al hacer "' + action + '". Vuelve a intentarlo en unos segundos.' };
    }
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

function mostrarRecuperar(mostrar) {
  document.getElementById('bloqueLoginNormal').classList.toggle('oculto', mostrar);
  document.getElementById('bloqueRecuperar').classList.toggle('oculto', !mostrar);
  document.getElementById('recuperarError').textContent = '';
}

async function hacerLoginConCodigo() {
  const boton = document.getElementById('recuperarBtn');
  await conProcesando(boton, 'Entrando…', async () => {
    const usuario = document.getElementById('recUsuario').value.trim();
    const codigo = document.getElementById('recCodigo').value.trim();
    const errorEl = document.getElementById('recuperarError');
    errorEl.textContent = '';
    if (!usuario || !codigo) { errorEl.textContent = 'Rellena usuario y código'; return; }

    const r = await llamar('loginConCodigo', { usuario, codigo });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    SESION = r;
    localStorage.setItem('sesionCajar', JSON.stringify(SESION));
    mostrarApp();
    if (r.debeCambiarPassword) document.getElementById('modalCambiarPassword').classList.remove('oculto');
  })();
}

async function guardarPasswordPropia() {
  const boton = document.getElementById('guardarPasswordPropiaBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const errorEl = document.getElementById('cambiarPasswordError');
    errorEl.textContent = '';
    const nuevaPassword = document.getElementById('nuevaPasswordPropia').value;
    if (!nuevaPassword || nuevaPassword.length < 4) { errorEl.textContent = 'Mínimo 4 caracteres'; return; }
    const r = await llamar('cambiarMiPassword', { nuevaPassword });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    cerrarModal('modalCambiarPassword');
  })();
}

async function generarCodigoParaAgente() {
  const usuario = document.getElementById('agUsuarioOriginal').value;
  const r = await llamar('generarCodigoRecuperacion', { usuario });
  const texto = document.getElementById('codigoGeneradoTexto');
  if (!r.ok) { texto.style.color = 'var(--rojo)'; texto.textContent = r.error; return; }
  texto.style.color = 'var(--verde)';
  texto.textContent = `Código: ${r.codigo} — dáselo al agente, es de un solo uso.`;
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
  document.getElementById('tabAvisosBtn').classList.toggle('activo', tab === 'avisos');
  document.getElementById('tabAgentesBtn').classList.toggle('activo', tab === 'agentes');

  document.getElementById('vistaCuadrante').classList.toggle('oculto', tab !== 'cuadrante');
  document.getElementById('vistaRegistros').classList.toggle('oculto', tab !== 'registros');
  document.getElementById('vistaAvisos').classList.toggle('oculto', tab !== 'avisos');
  document.getElementById('vistaAgentes').classList.toggle('oculto', tab !== 'agentes');
  document.getElementById('subtabsCuadrante').classList.toggle('oculto', tab !== 'cuadrante');

  actualizarFab();

  if (tab === 'cuadrante') cargarDatosSubtab();
  else if (tab === 'registros') cargarEscritos();
  else if (tab === 'avisos') cargarAvisos();
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
  } else if (tabActiva === 'avisos') {
    fab.classList.remove('oculto'); texto.textContent = 'Nuevo aviso';
  } else if (tabActiva === 'agentes') {
    fab.classList.remove('oculto'); texto.textContent = 'Nuevo agente';
  } else {
    fab.classList.add('oculto');
  }
}

function abrirModalSegunTab() {
  if (tabActiva === 'cuadrante' && subtabActiva === 'turnos') abrirModalTurno();
  else if (tabActiva === 'registros') abrirModalEscrito();
  else if (tabActiva === 'avisos') abrirModalAviso();
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
function nombreMes(fecha) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}
function cambiarMes(delta) { mesActual.setMonth(mesActual.getMonth() + delta); cargarDatosSubtab(); }
function formatearFechaCorta(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}`; }

// ------------------------------------------------------------
// TURNOS
// ------------------------------------------------------------
async function cargarTurnos() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  document.getElementById('listaTurnos').innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:10px;">Cargando…</p>';
  const r = await llamar('getDatosCuadrante', { mes: mesISO(mesActual) });
  if (r.ok) {
    TURNOS_CACHE = r.turnos;
    CAMBIOS_CACHE = r.cambios;
    INTERESES_CACHE = r.porTurno;
    PROPIAS_INDISP_CACHE = r.indispPropias || [];
    INDISP_CACHE = {};
    (r.indispTodas || []).forEach(t => { (INDISP_CACHE[t.fecha] = INDISP_CACHE[t.fecha] || []).push(t.agente); });
  }
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
    const bloques = turnosDia.map(t => bloqueTurno(t)).join('');
    const numDia = SESION.rol === 'admin'
      ? `<div class="cal-num clicable" onclick="abrirModalDia('${fecha}')" title="Gestionar turnos de este día">${d}</div>`
      : `<div class="cal-num">${d}</div>`;
    html += `<div class="cal-celda">${numDia}${bloques}</div>`;
  }
  cont.innerHTML = `<div class="calendario">${html}</div>`;

  const agentesEnMes = [...new Set(TURNOS_CACHE.flatMap(t => agentesDeTurno(t.agente)))];
  document.getElementById('leyendaAgentes').innerHTML = agentesEnMes.map(a =>
    `<span class="leyenda-item"><span class="leyenda-punto" style="background:${colorAgente(a)}"></span>${a} · ${nombreAgente(a)}</span>`
  ).join('');
}

function agentesDeTurno(agenteCampo) {
  return String(agenteCampo || '').split(',').filter(Boolean);
}

function bloqueTurno(t) {
  const lista = agentesDeTurno(t.agente);
  const clicAdmin = SESION.rol === 'admin'
    ? `abrirModalAsignarTurno(${JSON.stringify(t.id)}, ${JSON.stringify(t.fecha)}, ${JSON.stringify(t.horaInicio)}, ${JSON.stringify(t.horaFin)}, ${JSON.stringify(t.agente)})`
    : '';
  const esMio = lista.includes(SESION.usuario);
  const clic = clicAdmin || (esMio ? `abrirModalCambio('${t.fecha}')` : '');
  const color = lista.length ? colorAgente(lista[0]) : '';
  const claseAdicional = lista.length ? '' : 'sin-asignar';
  const etiquetaAgentes = lista.length ? `Agentes asignados: ${lista.join(', ')}` : 'Sin asignar';

  const chip = `<span class="turno-chip ${claseAdicional}" ${color ? `style="background:${color}"` : ''} ${clic ? `onclick="${clic}"` : ''}>
      <span class="chip-hora">${t.horaInicio}-${t.horaFin}</span>
      <span class="chip-agentes">${etiquetaAgentes}</span>
    </span>`;

  let botonInteres = '';
  if (SESION.rol !== 'admin') {
    const interesados = INTERESES_CACHE[t.id] || [];
    const yaMarcado = interesados.includes(SESION.usuario);
    botonInteres = `<span class="chip-interes ${yaMarcado ? 'marcado' : ''}" onclick="toggleInteres('${t.id}')">${yaMarcado ? '✓ Apuntado' : 'Me apunto'}</span>`;
  }

  return chip + botonInteres;
}

async function toggleInteres(turnoId) {
  const r = await llamar('toggleInteres', { turnoId });
  if (!r.ok) { alert(r.error); return; }
  const lista = INTERESES_CACHE[turnoId] || [];
  if (r.marcado) { if (!lista.includes(SESION.usuario)) lista.push(SESION.usuario); }
  else { INTERESES_CACHE[turnoId] = lista.filter(u => u !== SESION.usuario); }
  INTERESES_CACHE[turnoId] = INTERESES_CACHE[turnoId] || lista;
  renderTurnos();
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

function checkboxesAgentes(idsPrefix, seleccionados, excluir) {
  return AGENTES.filter(a => a.usuario !== excluir).map(a => `
    <label class="check-agente">
      <input type="checkbox" id="${idsPrefix}_${a.usuario}" value="${a.usuario}" ${seleccionados.includes(a.usuario) ? 'checked' : ''}>
      ${a.usuario} · ${a.nombre}
    </label>`).join('');
}
function agentesSeleccionados(idsPrefix) {
  return AGENTES.filter(a => {
    const el = document.getElementById(`${idsPrefix}_${a.usuario}`);
    return el && el.checked;
  }).map(a => a.usuario);
}

let fechaDiaActual = '';
function abrirModalDia(fecha) {
  try {
    fechaDiaActual = fecha;
    document.getElementById('modalDiaTitulo').textContent = `${formatearFechaCorta(fecha)} — turnos de ese día`;
    const turnosDia = TURNOS_CACHE.filter(t => t.fecha === fecha);
    const cont = document.getElementById('modalDiaLista');
    cont.innerHTML = turnosDia.length
      ? turnosDia.map(t => {
          const lista = agentesDeTurno(t.agente);
          const texto = lista.length ? lista.join(', ') : 'Sin asignar';
          return `
            <div class="fila-turno">
              <span class="turno-horario">${t.horaInicio}-${t.horaFin}</span>
              <span class="turno-agente">${texto}</span>
              <button class="pequena secundaria" onclick='cerrarModal("modalDia"); abrirModalAsignarTurno(${JSON.stringify(t.id)}, ${JSON.stringify(t.fecha)}, ${JSON.stringify(t.horaInicio)}, ${JSON.stringify(t.horaFin)}, ${JSON.stringify(t.agente)})'>Editar</button>
              <button class="pequena secundaria" onclick="eliminarTurnoDesdeDia('${t.id}')">Eliminar</button>
            </div>`;
        }).join('')
      : '<p style="font-size:13px;color:#9ca3af;">Sin turnos este día todavía.</p>';
    document.getElementById('modalDia').classList.remove('oculto');
  } catch (err) {
    console.error('Error en abrirModalDia:', err);
    alert('No se pudo abrir la gestión de ese día: ' + err.message);
  }
}

function nuevoTurnoDesdeDia() {
  cerrarModal('modalDia');
  abrirModalTurno(fechaDiaActual);
}

async function eliminarTurnoDesdeDia(id) {
  if (!confirm('¿Eliminar este turno? Se perderá también su bitácora de cambios/interés.')) return;
  const r = await llamar('eliminarTurno', { id });
  if (!r.ok) { alert(r.error); return; }
  cerrarModal('modalDia');
  cargarTurnos();
}

function abrirModalTurno(fechaPrefijada) {
  document.getElementById('turnoFecha').value = fechaPrefijada || '';
  document.getElementById('turnoHoraInicio').value = '';
  document.getElementById('turnoHoraFin').value = '';
  document.getElementById('turnoAgentesChecks').innerHTML = checkboxesAgentes('turnoAg', []);
  document.getElementById('modalTurno').classList.remove('oculto');
}
async function guardarTurno() {
  const boton = document.getElementById('guardarTurnoBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const fecha = document.getElementById('turnoFecha').value;
    const horaInicio = document.getElementById('turnoHoraInicio').value;
    const horaFin = document.getElementById('turnoHoraFin').value;
    const agentes = agentesSeleccionados('turnoAg');
    if (!fecha || !horaInicio || !horaFin) { alert('Fecha y horario son obligatorios'); return; }
    const r = await llamar('crearTurno', { fecha, horaInicio, horaFin, agentes });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalTurno');
    const [y, m] = fecha.split('-').map(Number);
    mesActual = new Date(y, m - 1, 1);
    cargarTurnos();
  })();
}

// -- Modal: asignar/cambiar agentes de un turno existente (admin) --
function abrirModalAsignarTurno(id, fecha, horaInicio, horaFin, agenteCampo) {
  const seleccionados = agentesDeTurno(agenteCampo);
  document.getElementById('asigTurnoId').value = id;
  document.getElementById('asigTurnoInfo').textContent = `${formatearFechaCorta(fecha)} · ${horaInicio}–${horaFin}`;
  document.getElementById('asigAgentesChecks').innerHTML = checkboxesAgentes('asigAg', seleccionados);

  const interesados = INTERESES_CACHE[id] || [];
  const noPueden = INDISP_CACHE[fecha] || [];
  document.getElementById('asigInteresados').innerHTML = [
    interesados.length ? '✅ Se han apuntado: ' + interesados.map(u => u + ' · ' + nombreAgente(u)).join(', ') : '',
    noPueden.length ? '<br>🚫 No pueden ese día: ' + noPueden.map(u => u + ' · ' + nombreAgente(u)).join(', ') : ''
  ].filter(Boolean).join('') || 'Nadie se ha apuntado ni ha marcado indisponibilidad ese día.';

  document.getElementById('modalAsignarTurno').classList.remove('oculto');
}
async function guardarAsignacionTurno() {
  const boton = document.getElementById('guardarAsigBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const id = document.getElementById('asigTurnoId').value;
    const agentes = agentesSeleccionados('asigAg');
    const r = await llamar('asignarTurno', { id, agentes });
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
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  document.getElementById('rejillaDisponibilidad').innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:10px;">Cargando…</p>';
  const r = await llamar('getDatosCuadrante', { mes: mesISO(mesActual) });
  if (!r.ok) return;
  TURNOS_CACHE = r.turnos;
  PROPIAS_INDISP_CACHE = r.indispPropias || [];
  renderCalendarioDisponibilidad(TURNOS_CACHE, PROPIAS_INDISP_CACHE);

  const cardAdmin = document.getElementById('cardIndispAdmin');
  if (SESION.rol === 'admin') {
    cardAdmin.classList.remove('oculto');
    const porAgente = {};
    (r.indispTodas || []).forEach(t => { (porAgente[t.agente] = porAgente[t.agente] || []).push(formatearFechaCorta(t.fecha)); });
    const html = Object.keys(porAgente).length
      ? Object.entries(porAgente).map(([ag, dias]) => `<p style="font-size:13px;"><b>${ag} · ${nombreAgente(ag)}</b>: ${dias.join(', ')}</p>`).join('')
      : '<p style="font-size:13px;color:#9ca3af;">Nadie ha marcado indisponibilidad este mes.</p>';
    document.getElementById('listaIndispAdmin').innerHTML = html;
  } else {
    cardAdmin.classList.add('oculto');
  }
}

function renderCalendarioDisponibilidad(turnos, propias) {
  const year = mesActual.getFullYear(), month = mesActual.getMonth();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const primerDiaSemana = (new Date(year, month, 1).getDay() + 6) % 7;

  const porDia = {};
  turnos.forEach(t => { (porDia[t.fecha] = porDia[t.fecha] || []).push(t); });

  let html = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-cabecera">${d}</div>`).join('');
  for (let i = 0; i < primerDiaSemana; i++) html += '<div class="cal-celda vacia"></div>';

  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const turnosDia = porDia[fecha] || [];
    const marcado = propias.includes(fecha);
    const chips = turnosDia.map(t =>
      `<span class="turno-chip" style="background:${marcado ? 'var(--rojo)' : '#94a3b8'}" onclick="toggleDia('${fecha}')">${t.horaInicio}-${t.horaFin}</span>`
    ).join('');
    html += `<div class="cal-celda"><div class="cal-num">${d}</div>${chips}</div>`;
  }
  document.getElementById('rejillaDisponibilidad').innerHTML = `<div class="calendario">${html}</div>`;
}

async function toggleDia(fecha) {
  const r = await llamar('toggleIndisponibilidad', { fecha });
  if (!r.ok) { alert(r.error); return; }
  if (r.marcado) { if (!PROPIAS_INDISP_CACHE.includes(fecha)) PROPIAS_INDISP_CACHE.push(fecha); }
  else { PROPIAS_INDISP_CACHE = PROPIAS_INDISP_CACHE.filter(f => f !== fecha); }
  renderCalendarioDisponibilidad(TURNOS_CACHE, PROPIAS_INDISP_CACHE);
}

// ------------------------------------------------------------
// DEUDAS
// ------------------------------------------------------------
async function cargarDeudas() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
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
async function cargarAjustesEquidad() {
  await cargarAgentes();
  const cont = document.getElementById('listaAjustesEquidad');
  const r = await llamar('getAjustesEquidad');
  if (!r.ok) {
    cont.innerHTML = `<p style="font-size:12px;color:var(--rojo);">No se pudo cargar: ${r.error}. Es posible que falte ejecutar "inicializar" de nuevo en Apps Script para crear la hoja AjustesEquidad.</p>`;
    return;
  }
  if (!AGENTES.length) {
    cont.innerHTML = '<p style="font-size:12px;color:#9ca3af;">No hay agentes dados de alta todavía.</p>';
    return;
  }
  cont.innerHTML = AGENTES.map(a => {
    const actual = r.ajustes[a.usuario] || { entreSemana: 0, finDeSemana: 0 };
    return `
      <div class="fila-ajuste-equidad">
        <span>${a.usuario} · ${a.nombre}</span>
        <input type="number" step="0.5" min="0" id="ajLS_${a.usuario}" value="${actual.entreSemana}" placeholder="L-J h">
        <input type="number" step="0.5" min="0" id="ajFS_${a.usuario}" value="${actual.finDeSemana}" placeholder="V-S-D h">
        <button class="pequena secundaria" onclick="guardarAjusteAgente('${a.usuario}')">Guardar</button>
      </div>`;
  }).join('');
}

async function guardarAjusteAgente(usuario) {
  const entreSemana = document.getElementById(`ajLS_${usuario}`).value;
  const finDeSemana = document.getElementById(`ajFS_${usuario}`).value;
  const r = await llamar('guardarAjusteEquidad', { agente: usuario, entreSemana, finDeSemana });
  if (!r.ok) { alert(r.error); return; }
  cargarEquidad();
}

function cambiarPeriodoEquidad(periodo) {
  periodoEquidad = periodo;
  document.getElementById('btnEquidadMes').classList.toggle('activo', periodo === 'mes');
  document.getElementById('btnEquidadAnio').classList.toggle('activo', periodo === 'anio');
  cargarEquidad();
}

async function cargarEquidad() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  const params = periodoEquidad === 'anio' ? { anio: String(mesActual.getFullYear()) } : { mes: mesISO(mesActual) };
  const r = await llamar('getEquidad', params);
  if (!r.ok) return;
  const entradas = Object.entries(r.resumen);
  const cont = document.getElementById('listaEquidad');

  const cardAjustes = document.getElementById('cardAjustesEquidad');
  if (SESION.rol === 'admin' && periodoEquidad === 'anio') {
    cardAjustes.classList.remove('oculto');
    cargarAjustesEquidad();
  } else {
    cardAjustes.classList.add('oculto');
  }

  if (!entradas.length) { cont.innerHTML = '<p style="font-size:13px;color:#9ca3af;">Sin turnos asignados en este periodo.</p>'; return; }

  const maxTotal = Math.max(...entradas.map(([, v]) => v.entreSemana + v.finDeSemana), 1);
  cont.innerHTML = entradas
    .sort((a, b) => (b[1].entreSemana + b[1].finDeSemana) - (a[1].entreSemana + a[1].finDeSemana))
    .map(([agente, v]) => {
      const total = v.entreSemana + v.finDeSemana;
      const pctLS = (v.entreSemana / maxTotal) * 100;
      const pctFS = (v.finDeSemana / maxTotal) * 100;
      return `
        <div class="barra-equidad">
          <div class="nombre">${agente} · ${nombreAgente(agente)} — ${total.toFixed(1)}h</div>
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

let filtroEscritoActivo = '';
function filtrarEscritos(estado, boton) {
  filtroEscritoActivo = estado;
  boton.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('activo'));
  boton.classList.add('activo');
  renderEscritos();
}

function renderEscritos() {
  const filtro = filtroEscritoActivo;
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
    const claseTarjeta = e.estado === 'Hecho' ? 'registro-hecho' : estancado || urgente ? 'registro-urgente' : e.estado === 'En curso' ? 'registro-curso' : 'registro-pendiente';
    return `
      <div class="card ${claseTarjeta}">
        <div class="fila">
          <h3>Nº ${e.numRegistro} — ${e.tipo}</h3>
          <span class="etiqueta ${etqClase}">${etqTexto}</span>
        </div>
        <p style="font-size:13px;color:#4b5563;margin:4px 0;">${e.descripcion || '(sin descripción)'}</p>
        <p style="font-size:12px;color:#9ca3af;margin:2px 0;">
          Solicitante: ${e.solicitante || '—'}${e.dniSolicitante ? ` · DNI: ${e.dniSolicitante}` : ''}${e.contactoSolicitante ? ` · ${e.contactoSolicitante}` : ''}
        </p>
        <p style="font-size:12px;color:#9ca3af;margin:2px 0;">
          Entrada: ${e.fechaEntrada}
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
  ['escNumRegistro', 'escSolicitante', 'escDni', 'escContacto', 'escDescripcion', 'escDocumentoUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('escArchivo').value = '';
  document.getElementById('escFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modalEscrito').classList.remove('oculto');
}

function leerArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function guardarEscrito() {
  const boton = document.getElementById('guardarEscritoBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const numRegistro = document.getElementById('escNumRegistro').value.trim();
    const errorEl = document.getElementById('escritoError');
    errorEl.textContent = '';
    if (!numRegistro) { errorEl.textContent = 'El nº de registro es obligatorio'; return; }

    let documentoUrl = document.getElementById('escDocumentoUrl').value;
    const archivo = document.getElementById('escArchivo').files[0];
    if (archivo) {
      boton.innerHTML = '<span class="spinner"></span>Subiendo PDF…';
      const contenidoBase64 = await leerArchivoBase64(archivo);
      const rSubida = await llamar('subirDocumento', { nombreArchivo: archivo.name, tipoMime: archivo.type || 'application/pdf', contenidoBase64 });
      if (!rSubida.ok) { errorEl.textContent = rSubida.error; return; }
      documentoUrl = rSubida.url;
      boton.innerHTML = '<span class="spinner"></span>Guardando…';
    }

    const r = await llamar('altaEscrito', {
      numRegistro,
      fechaEntrada: document.getElementById('escFecha').value,
      solicitante: document.getElementById('escSolicitante').value,
      dniSolicitante: document.getElementById('escDni').value,
      contactoSolicitante: document.getElementById('escContacto').value,
      tipo: document.getElementById('escTipo').value,
      descripcion: document.getElementById('escDescripcion').value,
      documentoUrl
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
// ------------------------------------------------------------
// AVISOS
// ------------------------------------------------------------
async function cargarAvisos() {
  const r = await llamar('getAvisos');
  const cont = document.getElementById('listaAvisos');
  if (!r.ok) { cont.innerHTML = `<p style="font-size:13px;color:var(--rojo);">${r.error}</p>`; return; }
  if (!r.avisos.length) { cont.innerHTML = '<p style="font-size:13px;color:#9ca3af;">No hay avisos.</p>'; return; }

  cont.innerHTML = r.avisos.map(a => `
    <div class="card ${a.caducado ? 'aviso-caducado' : ''}">
      <div class="fila">
        <h3>${a.titulo}</h3>
        ${a.caducado ? '<span class="etiqueta etq-sin-asignar">Caducado</span>' : (a.fechaCaducidad ? `<span class="etiqueta etq-pendiente">Caduca ${formatearFechaCorta(a.fechaCaducidad)}</span>` : '')}
      </div>
      <p style="font-size:13px;color:#374151;white-space:pre-wrap;margin:6px 0;">${a.texto}</p>
      <p style="font-size:11px;color:#9ca3af;">Publicado por ${nombreAgente(a.creadoPor)} · ${a.fechaCreacion}</p>
      ${(SESION.rol === 'admin' || a.creadoPor === SESION.usuario) ? `<div class="fila" style="margin-top:6px;"><span></span><button class="pequena secundaria" onclick="eliminarAviso('${a.id}')">Eliminar</button></div>` : ''}
    </div>`).join('');
}

function abrirModalAviso() {
  document.getElementById('avisoError').textContent = '';
  document.getElementById('avTitulo').value = '';
  document.getElementById('avTexto').value = '';
  document.getElementById('avCaducidad').value = '';
  document.getElementById('modalAviso').classList.remove('oculto');
}

async function guardarAviso() {
  const boton = document.getElementById('guardarAvisoBtn');
  await conProcesando(boton, 'Publicando…', async () => {
    const errorEl = document.getElementById('avisoError');
    errorEl.textContent = '';
    const titulo = document.getElementById('avTitulo').value.trim();
    const texto = document.getElementById('avTexto').value.trim();
    const fechaCaducidad = document.getElementById('avCaducidad').value;
    if (!titulo || !texto) { errorEl.textContent = 'Rellena el título y el texto'; return; }
    const r = await llamar('crearAviso', { titulo, texto, fechaCaducidad });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    cerrarModal('modalAviso');
    cargarAvisos();
  })();
}

async function eliminarAviso(id) {
  if (!confirm('¿Eliminar este aviso?')) return;
  const r = await llamar('eliminarAviso', { id });
  if (!r.ok) { alert(r.error); return; }
  cargarAvisos();
}

async function cargarListaAgentesAdmin() {
  const r = await llamar('getAgentes');
  if (r.ok) AGENTES = r.agentes;
  const cont = document.getElementById('listaAgentesAdmin');
  cont.innerHTML = AGENTES.map(a => `
    <div class="fila-agente-admin ${a.activo ? '' : 'inactivo'}">
      <span class="col-nombre">${a.nombre}</span>
      <span class="col-usuario">${a.usuario}</span>
      <span class="etiqueta ${a.rol === 'admin' ? 'etq-curso' : a.rol === 'oficial' ? 'etq-pendiente' : 'etq-sin-asignar'}">${a.rol}${a.activo ? '' : ' · baja'}</span>
      <span class="col-acciones">
        <button class="pequena secundaria" onclick='abrirModalAgente(${JSON.stringify(a)})'>Editar</button>
        <button class="pequena secundaria" onclick="toggleBajaAgente('${a.usuario}', ${!a.activo})">${a.activo ? 'Dar de baja' : 'Reactivar'}</button>
      </span>
    </div>`).join('');
}

async function toggleBajaAgente(usuario, nuevoActivo) {
  if (!confirm(nuevoActivo ? '¿Reactivar a este agente?' : '¿Dar de baja a este agente? No podrá iniciar sesión.')) return;
  const r = await llamar('actualizarAgente', { usuario, activo: nuevoActivo });
  if (!r.ok) { alert(r.error); return; }
  cargarListaAgentesAdmin();
}

function abrirModalAgente(agente) {
  document.getElementById('agenteError').textContent = '';
  const editando = !!agente;
  document.getElementById('tituloModalAgente').textContent = editando ? 'Editar agente' : 'Nuevo agente';
  document.getElementById('agUsuarioOriginal').value = editando ? agente.usuario : '';
  document.getElementById('agUsuario').value = editando ? agente.usuario : '';
  document.getElementById('agUsuario').disabled = editando;
  document.getElementById('agNombre').value = editando ? agente.nombre : '';
  document.getElementById('agPassword').value = '';
  document.getElementById('labelAgPassword').textContent = editando ? 'Nueva contraseña (opcional)' : 'Contraseña inicial';
  document.getElementById('agRol').value = editando ? agente.rol : 'agente';
  document.getElementById('guardarAgenteBtn').textContent = editando ? 'Guardar cambios' : 'Dar de alta';
  document.getElementById('bloqueCodigoRecuperacion').classList.toggle('oculto', !editando);
  document.getElementById('codigoGeneradoTexto').textContent = '';
  document.getElementById('modalAgente').classList.remove('oculto');
}
async function guardarAgente() {
  const boton = document.getElementById('guardarAgenteBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const errorEl = document.getElementById('agenteError');
    errorEl.textContent = '';
    const usuarioOriginal = document.getElementById('agUsuarioOriginal').value;
    const editando = !!usuarioOriginal;
    const usuario = document.getElementById('agUsuario').value.trim();
    const nombre = document.getElementById('agNombre').value.trim();
    const password = document.getElementById('agPassword').value;
    const rol = document.getElementById('agRol').value;

    if (editando) {
      if (!nombre) { errorEl.textContent = 'El nombre no puede quedar vacío'; return; }
      const r = await llamar('actualizarAgente', { usuario: usuarioOriginal, nombre, rol, password });
      if (!r.ok) { errorEl.textContent = r.error; return; }
    } else {
      if (!usuario || !nombre || !password) { errorEl.textContent = 'Rellena todos los campos'; return; }
      const r = await llamar('crearAgente', { usuario, nombre, password, rol });
      if (!r.ok) { errorEl.textContent = r.error; return; }
    }
    cerrarModal('modalAgente');
    document.getElementById('agUsuario').disabled = false;
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
