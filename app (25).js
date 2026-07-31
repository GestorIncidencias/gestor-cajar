// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwgkXtRDBi09HGR3xIx7FynH6YueZF016LT8fl-bi3bnSO2t1Bum3WtNKEeBlkga6z4/exec';

let SESION = JSON.parse(localStorage.getItem('sesionCajar') || 'null');
let AGENTES = [];
let ESCRITOS_CACHE = [];
let TURNOS_CACHE = [];
let CAMBIOS_CACHE = [];
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
  document.getElementById('tabFirmasBtn').classList.toggle('activo', tab === 'firmas');

  document.getElementById('vistaCuadrante').classList.toggle('oculto', tab !== 'cuadrante');
  document.getElementById('vistaRegistros').classList.toggle('oculto', tab !== 'registros');
  document.getElementById('vistaAvisos').classList.toggle('oculto', tab !== 'avisos');
  document.getElementById('vistaAgentes').classList.toggle('oculto', tab !== 'agentes');
  document.getElementById('vistaFirmas').classList.toggle('oculto', tab !== 'firmas');
  document.getElementById('subtabsCuadrante').classList.toggle('oculto', tab !== 'cuadrante');

  actualizarFab();

  if (tab === 'cuadrante') cargarDatosSubtab();
  else if (tab === 'registros') cargarEscritos();
  else if (tab === 'avisos') cargarAvisos();
  else if (tab === 'agentes') cargarListaAgentesAdmin();
  else if (tab === 'firmas') cargarFirmas();
}

function cambiarSubtab(sub) {
  subtabActiva = sub;
  document.querySelectorAll('#subtabsCuadrante button').forEach(b => b.classList.remove('activo'));
  event.target.classList.add('activo');

  document.getElementById('subvistaTurnos').classList.toggle('oculto', sub !== 'turnos');
  document.getElementById('subvistaDisponibilidad').classList.toggle('oculto', sub !== 'disponibilidad');
  document.getElementById('subvistaPermutas').classList.toggle('oculto', sub !== 'permutas');
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
  else if (subtabActiva === 'permutas') cargarPermutas();
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
function formatearFechaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// ------------------------------------------------------------
// TURNOS
// ------------------------------------------------------------
const CACHE_MESES = {};
function invalidarCacheMes() { delete CACHE_MESES[mesISO(mesActual)]; }

async function cargarTurnos() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  const mes = mesISO(mesActual);

  const aplicarDatos = (r) => {
    TURNOS_CACHE = r.turnos;
    CAMBIOS_CACHE = r.cambios;
    PROPIAS_INDISP_CACHE = r.indispPropias || [];
    INDISP_CACHE = {};
    (r.indispTodas || []).forEach(t => { (INDISP_CACHE[t.fecha] = INDISP_CACHE[t.fecha] || []).push(t.agente); });
    renderTurnos();
    renderResumenIndispAdmin();
  };

  if (CACHE_MESES[mes]) {
    aplicarDatos(CACHE_MESES[mes]); // instantáneo con lo último que se vio
  } else {
    document.getElementById('listaTurnos').innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:10px;">Cargando…</p>';
  }

  const r = await llamar('getDatosCuadrante', { mes });
  if (r.ok) {
    CACHE_MESES[mes] = r;
    aplicarDatos(r);
  }
}

const PALETA_AGENTES = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];
function colorAgente(usuario) {
  if (!usuario) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < usuario.length; i++) hash = usuario.charCodeAt(i) + ((hash << 5) - hash);
  return PALETA_AGENTES[Math.abs(hash) % PALETA_AGENTES.length];
}

function renderResumenIndispAdmin() {
  const card = document.getElementById('cardResumenIndisp');
  if (SESION.rol !== 'admin') { card.classList.add('oculto'); return; }
  const porAgente = {};
  Object.entries(INDISP_CACHE).forEach(([fecha, agentes]) => {
    agentes.forEach(ag => { (porAgente[ag] = porAgente[ag] || []).push(formatearFechaCorta(fecha)); });
  });
  if (!Object.keys(porAgente).length) { card.classList.add('oculto'); return; }
  card.classList.remove('oculto');
  document.getElementById('resumenIndispAdmin').innerHTML = `<div class="resumen-indisp">${Object.entries(porAgente)
    .map(([ag, dias]) => `<p style="font-size:13px;"><b>${ag} · ${nombreAgente(ag)}</b>: ${dias.sort().join(', ')}</p>`).join('')}</div>`;
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
    const bloques = agruparPorHorario(turnosDia).map(grupo => bloqueTurno(grupo)).join('');
    if (SESION.rol === 'admin') {
      html += `<div class="cal-celda clicable" onclick="abrirModalDia('${fecha}')" title="Gestionar turnos de este día"><div class="cal-num">${d}</div>${bloques}</div>`;
    } else {
      html += `<div class="cal-celda"><div class="cal-num">${d}</div>${bloques}</div>`;
    }
  }
  cont.innerHTML = `<div class="calendario">${html}</div>`;
}

function agentesDeTurno(agenteCampo) {
  return String(agenteCampo || '').split(',').filter(Boolean);
}

function agruparPorHorario(turnosDia) {
  const grupos = {};
  turnosDia.forEach(t => {
    const clave = t.horaInicio + '-' + t.horaFin;
    (grupos[clave] = grupos[clave] || []).push(t);
  });
  return Object.values(grupos);
}

function bloqueTurno(grupoTurnos) {
  const primero = grupoTurnos[0];
  const listaCompleta = [...new Set(grupoTurnos.flatMap(t => agentesDeTurno(t.agente)))];
  const clicAdmin = SESION.rol === 'admin' && grupoTurnos.length === 1
    ? `abrirModalAsignarTurno(${JSON.stringify(primero.id)}, ${JSON.stringify(primero.fecha)}, ${JSON.stringify(primero.horaInicio)}, ${JSON.stringify(primero.horaFin)}, ${JSON.stringify(primero.agente)})`
    : SESION.rol === 'admin'
      ? `abrirModalDia('${primero.fecha}')`
      : '';
  const clic = clicAdmin;
  const color = listaCompleta.length ? colorAgente(listaCompleta[0]) : '';
  const claseAdicional = listaCompleta.length ? '' : 'sin-asignar';
  const etiquetaAgentes = listaCompleta.length ? `Agentes asignados: ${listaCompleta.join(', ')}` : 'Sin asignar';

  return `<span class="turno-chip ${claseAdicional}" ${color ? `style="background:${color}"` : ''} ${clic ? `onclick="event.stopPropagation(); ${clic}"` : ''}>
      <span class="chip-hora">${primero.horaInicio}-${primero.horaFin}</span>
      <span class="chip-agentes">${etiquetaAgentes}</span>
    </span>`;
}

// ------------------------------------------------------------
// PERMUTAS
// ------------------------------------------------------------
let PERMUTAS_CACHE = [];
let tipoPermutaActual = 'unidireccional';

async function cargarPermutas() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  const r = await llamar('getCambiosPendientes');
  if (!r.ok) return;
  PERMUTAS_CACHE = r.cambios;
  renderPermutasPendientes();
  renderMisPermutas();
}

function renderPermutasPendientes() {
  const pendientesParaMi = PERMUTAS_CACHE.filter(c => c.estado === 'pendiente' && String(c.agenteNuevo) === String(SESION.usuario));
  const card = document.getElementById('permutasPendientesCard');
  if (!pendientesParaMi.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('listaPermutasPendientes').innerHTML = pendientesParaMi.map(c => `
    <div class="fila" style="margin-bottom:8px;">
      <span style="font-size:13px;">${nombreAgente(c.agenteOriginal)} te propone el día ${formatearFechaCorta(c.fechaTurno)}${c.tipo === 'bidireccional' ? ' a cambio de tu día ' + formatearFechaCorta(c.fechaDestino) : ' — quedaría a deber un turno'}</span>
      <span>
        <button class="pequena accion" onclick="responderCambio('${c.id}','aceptado')">Aceptar</button>
        <button class="pequena secundaria" onclick="responderCambio('${c.id}','rechazado')">Rechazar</button>
      </span>
    </div>`).join('');
}

function renderMisPermutas() {
  const propias = PERMUTAS_CACHE.filter(c => String(c.solicitadoPor) === String(SESION.usuario));
  const cont = document.getElementById('listaMisPermutas');
  if (!propias.length) { cont.innerHTML = '<p style="font-size:13px;color:#9ca3af;">No has propuesto ninguna permuta.</p>'; return; }
  const etiquetaEstado = { pendiente: 'Pendiente de respuesta', aceptado: 'Aceptada', rechazado: 'Rechazada' };
  cont.innerHTML = propias.map(c => `
    <div class="fila" style="margin-bottom:8px;">
      <span style="font-size:13px;">Le propusiste a ${nombreAgente(c.agenteNuevo)} tu día ${formatearFechaCorta(c.fechaTurno)}${c.tipo === 'bidireccional' ? ' por su día ' + formatearFechaCorta(c.fechaDestino) : ''} — <b>${etiquetaEstado[c.estado] || c.estado}</b></span>
    </div>`).join('');
}

async function responderCambio(id, respuesta) {
  const r = await llamar('responderCambio', { id, respuesta });
  if (!r.ok) { alert(r.error); return; }
  invalidarCacheMes();
  cargarPermutas();
}

function cambiarTipoPermuta(tipo) {
  tipoPermutaActual = tipo;
  document.getElementById('btnPermutaUni').classList.toggle('activo', tipo === 'unidireccional');
  document.getElementById('btnPermutaBi').classList.toggle('activo', tipo === 'bidireccional');
  document.getElementById('bloquePermutaDestino').classList.toggle('oculto', tipo !== 'bidireccional');
  if (tipo === 'bidireccional') cargarOpcionesFechaDestino();
}

async function abrirModalPermuta() {
  document.getElementById('permutaError').textContent = '';
  tipoPermutaActual = 'unidireccional';
  document.getElementById('btnPermutaUni').classList.add('activo');
  document.getElementById('btnPermutaBi').classList.remove('activo');
  document.getElementById('bloquePermutaDestino').classList.add('oculto');
  document.getElementById('permutaAgenteNuevo').innerHTML = opcionesAgentes(SESION.usuario);
  document.getElementById('permutaMes').value = mesISO(mesActual);
  await cargarOpcionesFechaPropia();
  document.getElementById('modalPermuta').classList.remove('oculto');
}

async function cargarOpcionesFechaPropia() {
  const mes = document.getElementById('permutaMes').value;
  const sel = document.getElementById('permutaFechaPropia');
  sel.innerHTML = '<option value="">Cargando…</option>';
  const r = await llamar('getTurnosAgentePorMes', { agente: SESION.usuario, mes });
  if (!r.ok || !r.turnos.length) { sel.innerHTML = '<option value="">No tienes turnos ese mes</option>'; return; }
  sel.innerHTML = r.turnos.map(t => `<option value="${t.fecha}">${formatearFechaLarga(t.fecha)} (${t.horaInicio}-${t.horaFin})</option>`).join('');
}

async function cargarOpcionesFechaDestino() {
  const mes = document.getElementById('permutaMes').value;
  const agente = document.getElementById('permutaAgenteNuevo').value;
  const sel = document.getElementById('permutaFechaDestino');
  if (!agente) { sel.innerHTML = '<option value="">Elige antes al agente…</option>'; return; }
  sel.innerHTML = '<option value="">Cargando…</option>';
  const r = await llamar('getTurnosAgentePorMes', { agente, mes });
  if (!r.ok || !r.turnos.length) { sel.innerHTML = '<option value="">Ese agente no tiene turnos ese mes</option>'; return; }
  sel.innerHTML = r.turnos.map(t => `<option value="${t.fecha}">${formatearFechaLarga(t.fecha)} (${t.horaInicio}-${t.horaFin})</option>`).join('');
}

async function enviarPropuestaPermuta() {
  const boton = document.getElementById('proponerPermutaBtn');
  await conProcesando(boton, 'Enviando…', async () => {
    const errorEl = document.getElementById('permutaError');
    errorEl.textContent = '';
    const fecha_turno = document.getElementById('permutaFechaPropia').value;
    const agente_nuevo = document.getElementById('permutaAgenteNuevo').value;
    const fecha_destino = document.getElementById('permutaFechaDestino').value;
    if (!fecha_turno) { errorEl.textContent = 'Elige tu turno a ceder'; return; }
    if (tipoPermutaActual === 'bidireccional' && !fecha_destino) { errorEl.textContent = 'Elige el día que recibes a cambio'; return; }
    const r = await llamar('proponerCambio', {
      fecha_turno, agente_nuevo, tipo: tipoPermutaActual,
      fecha_destino: tipoPermutaActual === 'bidireccional' ? fecha_destino : ''
    });
    if (!r.ok) { errorEl.textContent = r.error; return; }
    cerrarModal('modalPermuta');
    alert('Propuesta enviada. Se aplicará en cuanto el otro agente la acepte.');
    invalidarCacheMes();
    cargarPermutas();
  })();
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
  invalidarCacheMes();
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
    invalidarCacheMes();
    cargarTurnos();
  })();
}

// -- Modal: asignar/cambiar agentes de un turno existente (admin) --
function abrirModalAsignarTurno(id, fecha, horaInicio, horaFin, agenteCampo) {
  const seleccionados = agentesDeTurno(agenteCampo);
  document.getElementById('asigTurnoId').value = id;
  document.getElementById('asigTurnoInfo').textContent = `${formatearFechaCorta(fecha)} · ${horaInicio}–${horaFin}`;
  document.getElementById('asigAgentesChecks').innerHTML = checkboxesAgentes('asigAg', seleccionados);

  const noPueden = INDISP_CACHE[fecha] || [];
  document.getElementById('asigInteresados').innerHTML = noPueden.length
    ? '🚫 No pueden ese día: ' + noPueden.map(u => u + ' · ' + nombreAgente(u)).join(', ')
    : 'Nadie ha marcado indisponibilidad ese día.';

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
    invalidarCacheMes();
    cargarTurnos();
  })();
}

// -- Modal: proponer cambio --
// ------------------------------------------------------------
// MI DISPONIBILIDAD
// ------------------------------------------------------------
async function cargarDisponibilidad() {
  document.getElementById('mesLabel').textContent = nombreMes(mesActual);
  const mes = mesISO(mesActual);
  PENDIENTES_DISP = null; // resincroniza con el servidor al entrar o cambiar de mes

  const aplicarDatos = (r) => {
    TURNOS_CACHE = r.turnos;
    PROPIAS_INDISP_CACHE = r.indispPropias || [];
    INDISP_CACHE = {};
    (r.indispTodas || []).forEach(t => { (INDISP_CACHE[t.fecha] = INDISP_CACHE[t.fecha] || []).push(t.agente); });
    PENDIENTES_DISP = null;
    renderCalendarioDisponibilidad(TURNOS_CACHE, PROPIAS_INDISP_CACHE);
    renderIndispAdminCompleto(r.indispTodas || []);
  };

  if (CACHE_MESES[mes]) {
    aplicarDatos(CACHE_MESES[mes]);
  } else {
    document.getElementById('rejillaDisponibilidad').innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:10px;">Cargando…</p>';
  }

  const r = await llamar('getDatosCuadrante', { mes });
  if (r.ok) {
    CACHE_MESES[mes] = r;
    aplicarDatos(r);
  }
}

function renderIndispAdminCompleto(indispTodas) {
  const cardAdmin = document.getElementById('cardIndispAdmin');
  if (SESION.rol !== 'admin') { cardAdmin.classList.add('oculto'); return; }
  cardAdmin.classList.remove('oculto');
  const porAgente = {};
  indispTodas.forEach(t => { (porAgente[t.agente] = porAgente[t.agente] || []).push(formatearFechaCorta(t.fecha)); });
  const html = Object.keys(porAgente).length
    ? `<div class="resumen-indisp">${Object.entries(porAgente).map(([ag, dias]) => `<p style="font-size:13px;"><b>${ag} · ${nombreAgente(ag)}</b>: ${dias.join(', ')}</p>`).join('')}</div>`
    : '<p style="font-size:13px;color:#9ca3af;">Nadie ha marcado indisponibilidad este mes.</p>';
  document.getElementById('listaIndispAdmin').innerHTML = html;
}

let PENDIENTES_DISP = null; // selección local aún sin confirmar
let GUARDADAS_DISP = [];    // lo último confirmado, para saber si hay cambios

function renderCalendarioDisponibilidad(turnos, propias) {
  if (PENDIENTES_DISP === null) { PENDIENTES_DISP = [...propias]; GUARDADAS_DISP = [...propias]; }
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
    const marcado = PENDIENTES_DISP.includes(fecha);
    const chips = turnosDia.map(t =>
      `<span class="turno-chip" style="background:${marcado ? 'var(--rojo)' : '#94a3b8'}" onclick="toggleDia('${fecha}')">${t.horaInicio}-${t.horaFin}</span>`
    ).join('');
    html += `<div class="cal-celda"><div class="cal-num">${d}</div>${chips}</div>`;
  }
  document.getElementById('rejillaDisponibilidad').innerHTML = `<div class="calendario">${html}</div>`;
  actualizarBotonConfirmarDisp();
}

function actualizarBotonConfirmarDisp() {
  const hayCambios = JSON.stringify([...PENDIENTES_DISP].sort()) !== JSON.stringify([...GUARDADAS_DISP].sort());
  document.getElementById('confirmarDispBtn').disabled = !hayCambios;
  document.getElementById('avisoCambiosDisp').textContent = hayCambios ? 'Tienes cambios sin confirmar' : '';
}

function toggleDia(fecha) {
  if (PENDIENTES_DISP.includes(fecha)) PENDIENTES_DISP = PENDIENTES_DISP.filter(f => f !== fecha);
  else PENDIENTES_DISP.push(fecha);
  renderCalendarioDisponibilidad(TURNOS_CACHE, GUARDADAS_DISP);
}

async function confirmarDisponibilidad() {
  const boton = document.getElementById('confirmarDispBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const r = await llamar('guardarIndisponibilidades', { mes: mesISO(mesActual), fechas: PENDIENTES_DISP });
    if (!r.ok) { alert(r.error); return; }
    GUARDADAS_DISP = [...PENDIENTES_DISP];
    PROPIAS_INDISP_CACHE = [...PENDIENTES_DISP];
    invalidarCacheMes();
    actualizarBotonConfirmarDisp();
  })();
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
function toggleAjustesEquidad() {
  const cuerpo = document.getElementById('cuerpoAjustesEquidad');
  const flecha = document.getElementById('flechaAjustesEquidad');
  const abrir = cuerpo.classList.contains('oculto');
  cuerpo.classList.toggle('oculto', !abrir);
  flecha.textContent = abrir ? '▾' : '▸';
}

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
  const cabecera = `<div class="cabecera-ajuste-equidad"><span>Agente</span><span>L-J (h)</span><span>V-S-D (h)</span><span></span></div>`;
  cont.innerHTML = cabecera + AGENTES.map(a => {
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
          <h3>Registro Gestiona ${e.numRegistro} — ${e.tipo}</h3>
          <span class="etiqueta ${etqClase}">${etqTexto}</span>
        </div>
        <p style="font-size:12px;color:#374151;margin:2px 0;">
          Entrada: ${formatearFechaLarga(e.fechaEntrada)}
          ${e.documentoUrl ? ` · <a href="${e.documentoUrl}" target="_blank">documento</a>` : ''}
        </p>
        <p style="font-size:13px;color:#1f2937;margin:4px 0;">${e.descripcion || '(sin descripción)'}</p>
        <p style="font-size:12px;color:#374151;margin:2px 0;">
          Solicitante: ${e.solicitante || '—'}${e.dniSolicitante ? ` · DNI: ${e.dniSolicitante}` : ''}${e.contactoSolicitante ? ` · Teléfono: ${e.contactoSolicitante}` : ''}
        </p>
        ${e.estado === 'Hecho' && e.agentesFirmantes && e.agentesFirmantes.length
          ? `<p style="font-size:12px;color:#374151;">Firmado por: ${e.agentesFirmantes.map(nombreAgente).join(' y ')}${SESION.rol === 'admin' ? ` · <a href="#" onclick="abrirModalEditarFirmantes('${e.id}'); return false;">editar</a>` : ''}</p>`
          : e.estado === 'Hecho' && SESION.rol === 'admin'
            ? `<p style="font-size:12px;color:#374151;"><a href="#" onclick="abrirModalEditarFirmantes('${e.id}'); return false;">Añadir firmantes</a></p>`
            : e.agenteAsignado ? `<p style="font-size:12px;color:#374151;">Asignado a: ${nombreAgente(e.agenteAsignado)}</p>` : ''}
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
  return `<div class="bitacora">${notas.map(n => {
    const puedeEditar = SESION.rol === 'admin' || n.agente === SESION.usuario;
    return `<div class="nota" id="nota_${n.id}">
      <b>${nombreAgente(n.agente)}</b> <span class="fecha-nota">(${n.fecha})</span>: <span id="notaTexto_${n.id}">${n.nota}</span>
      ${puedeEditar ? `<a href="#" onclick="editarNotaInline('${n.id}'); return false;" style="font-size:11px;margin-left:4px;">editar</a>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function editarNotaInline(notaId) {
  const span = document.getElementById(`notaTexto_${notaId}`);
  const actual = span.textContent;
  span.outerHTML = `<span id="notaTexto_${notaId}">
    <textarea id="notaEdit_${notaId}" rows="2" style="margin:4px 0;">${actual}</textarea>
    <button class="pequena accion" onclick="guardarNotaInline('${notaId}')">Guardar</button>
  </span>`;
}

async function guardarNotaInline(notaId) {
  const nota = document.getElementById(`notaEdit_${notaId}`).value.trim();
  if (!nota) { alert('La nota no puede quedar vacía'); return; }
  const r = await llamar('editarNota', { id: notaId, nota });
  if (!r.ok) { alert(r.error); return; }
  cargarEscritos();
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

// ------------------------------------------------------------
// TRABAJOS FIRMADOS (equilibrio de carga entre agentes)
// ------------------------------------------------------------
let periodoFirmas = 'mes';
function cambiarPeriodoFirmas(periodo) {
  periodoFirmas = periodo;
  document.getElementById('btnFirmasMes').classList.toggle('activo', periodo === 'mes');
  document.getElementById('btnFirmasTotal').classList.toggle('activo', periodo === 'total');
  cargarFirmas();
}

async function cargarFirmas() {
  const params = periodoFirmas === 'mes' ? { periodo: 'mes', mes: mesISO(mesActual) } : { periodo: 'total' };
  const r = await llamar('getEstadisticaFirmas', params);
  const cont = document.getElementById('listaFirmas');
  if (!r.ok) { cont.innerHTML = `<p style="font-size:12px;color:var(--rojo);">No se pudo cargar: ${r.error}</p>`; return; }
  if (!r.resultado.length) { cont.innerHTML = '<p style="font-size:13px;color:#9ca3af;">Sin agentes dados de alta.</p>'; return; }

  const maxTotal = Math.max(...r.resultado.map(x => x.total), 1);
  const pctMedia = (r.media / maxTotal) * 100;
  cont.innerHTML = r.resultado.map(x => {
    const pct = (x.total / maxTotal) * 100;
    return `
      <div class="barra-equidad">
        <div class="nombre">${x.usuario} · ${x.nombre} — ${x.total} trabajo${x.total === 1 ? '' : 's'}</div>
        <div class="barra-fondo con-media">
          <div class="barra-trabajos" style="width:${pct}%"></div>
          <div class="linea-media" style="left:${pctMedia}%"></div>
        </div>
      </div>`;
  }).join('') + `<p class="leyenda-media">Media del grupo: ${r.media} trabajo${r.media === 1 ? '' : 's'}</p>`;
}

function abrirModalEditarFirmantes(id) {
  const e = ESCRITOS_CACHE.find(x => x.id === id);
  if (!e) return;
  document.getElementById('editarFirmantesId').value = id;
  const actuales = e.agentesFirmantes || [];
  document.getElementById('listaEditarFirmantesOpciones').innerHTML = AGENTES.filter(a => a.activo).map(a =>
    `<label style="display:block;font-size:13px;margin:4px 0;">
      <input type="checkbox" value="${a.usuario}" ${actuales.includes(a.usuario) ? 'checked' : ''}> ${a.nombre}
    </label>`
  ).join('');
  document.getElementById('modalEditarFirmantes').classList.remove('oculto');
}

async function guardarFirmantesEditados() {
  const boton = document.getElementById('guardarFirmantesBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const id = document.getElementById('editarFirmantesId').value;
    const agentesFirmantes = Array.from(document.querySelectorAll('#listaEditarFirmantesOpciones input:checked')).map(i => i.value);
    const r = await llamar('editarFirmantes', { id, agentesFirmantes });
    if (!r.ok) { alert(r.error); return; }
    cerrarModal('modalEditarFirmantes');
    cargarEscritos();
  })();
}

function abrirModalCerrar(id) {
  document.getElementById('cerrarId').value = id;
  document.getElementById('cerrarInformeUrl').value = '';
  document.getElementById('cerrarInformeArchivo').value = '';
  document.getElementById('bloqueFirmantes').classList.add('oculto');
  document.getElementById('listaFirmantesOpciones').innerHTML = '';
  document.getElementById('modalCerrar').classList.remove('oculto');
}

async function confirmarCierre() {
  const boton = document.getElementById('confirmarCierreBtn');
  await conProcesando(boton, 'Guardando…', async () => {
    const id = document.getElementById('cerrarId').value;

    let informeUrl = document.getElementById('cerrarInformeUrl').value;
    const archivo = document.getElementById('cerrarInformeArchivo').files[0];
    if (archivo) {
      boton.innerHTML = '<span class="spinner"></span>Subiendo PDF…';
      const contenidoBase64 = await leerArchivoBase64(archivo);
      const rSubida = await llamar('subirDocumento', { nombreArchivo: archivo.name, tipoMime: archivo.type || 'application/pdf', contenidoBase64 });
      if (!rSubida.ok) { alert(rSubida.error); return; }
      informeUrl = rSubida.url;
      boton.innerHTML = '<span class="spinner"></span>Guardando…';
    }

    // Si ya se muestra el selector de compañeros, se envían los marcados.
    const bloqueVisible = !document.getElementById('bloqueFirmantes').classList.contains('oculto');
    const agentesFirmantes = bloqueVisible
      ? Array.from(document.querySelectorAll('#listaFirmantesOpciones input:checked')).map(i => i.value)
      : undefined;

    const params = { id, informeUrl };
    if (agentesFirmantes) params.agentesFirmantes = agentesFirmantes;

    const r = await llamar('marcarHecho', params);

    if (!r.ok && r.necesitaSeleccion) {
      // Varios agentes en el turno de hoy: pedir con cuál firmó, sin cerrar el modal.
      document.getElementById('listaFirmantesOpciones').innerHTML = r.companeros.map(c =>
        `<label style="display:block;font-size:13px;margin:4px 0;">
          <input type="checkbox" value="${c.usuario}"> ${c.nombre}
        </label>`
      ).join('');
      document.getElementById('bloqueFirmantes').classList.remove('oculto');
      return;
    }
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
      ${a.documentoUrl ? `<p style="font-size:12px;"><a href="${a.documentoUrl}" target="_blank">📎 Ver documento</a></p>` : ''}
      <p style="font-size:11px;color:#9ca3af;">Publicado por ${nombreAgente(a.creadoPor)} · ${a.fechaCreacion}</p>
      ${(SESION.rol === 'admin' || a.creadoPor === SESION.usuario) ? `<div class="fila" style="margin-top:6px;"><span></span><button class="pequena secundaria" onclick="eliminarAviso('${a.id}')">Eliminar</button></div>` : ''}
    </div>`).join('');
}

function abrirModalAviso() {
  document.getElementById('avisoError').textContent = '';
  document.getElementById('avTitulo').value = '';
  document.getElementById('avTexto').value = '';
  document.getElementById('avArchivo').value = '';
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

    let documentoUrl = '';
    const archivo = document.getElementById('avArchivo').files[0];
    if (archivo) {
      boton.innerHTML = '<span class="spinner"></span>Subiendo archivo…';
      const contenidoBase64 = await leerArchivoBase64(archivo);
      const rSubida = await llamar('subirDocumento', { nombreArchivo: archivo.name, tipoMime: archivo.type || 'application/octet-stream', contenidoBase64 });
      if (!rSubida.ok) { errorEl.textContent = rSubida.error; return; }
      documentoUrl = rSubida.url;
      boton.innerHTML = '<span class="spinner"></span>Publicando…';
    }

    const r = await llamar('crearAviso', { titulo, texto, fechaCaducidad, documentoUrl });
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
