// ============================================================
// CONFIGURACIÓN — pega aquí la URL /exec de tu implementación de Apps Script
// ============================================================
const API_URL = 'PEGA_AQUI_LA_URL_DEL_WEB_APP';

let SESION = JSON.parse(localStorage.getItem('sesionCajar') || 'null');
let AGENTES = [];
let ESCRITOS_CACHE = [];
let CUADRANTE_CACHE = [];
let CAMBIOS_CACHE = [];
let mesActual = new Date();
let tabActiva = 'cuadrante';

// ------------------------------------------------------------
// LLAMADAS A LA API
// ------------------------------------------------------------
async function llamar(action, datos = {}) {
  const payload = Object.assign({ action, token: SESION ? SESION.token : '' }, datos);
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS en Apps Script
    body: JSON.stringify(payload)
  });
  return resp.json();
}

// ------------------------------------------------------------
// LOGIN / SESIÓN
// ------------------------------------------------------------
async function hacerLogin() {
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
  cargarAgentes();
  cambiarTab('cuadrante');
}

// ------------------------------------------------------------
// NAVEGACIÓN DE PESTAÑAS
// ------------------------------------------------------------
function cambiarTab(tab) {
  tabActiva = tab;
  document.getElementById('tabCuadranteBtn').classList.toggle('activo', tab === 'cuadrante');
  document.getElementById('tabEscritosBtn').classList.toggle('activo', tab === 'escritos');
  document.getElementById('vistaCuadrante').classList.toggle('oculto', tab !== 'cuadrante');
  document.getElementById('vistaEscritos').classList.toggle('oculto', tab !== 'escritos');

  if (tab === 'cuadrante') cargarCuadrante();
  else cargarEscritos();
}

function abrirModalSegunTab() {
  if (tabActiva === 'cuadrante') {
    if (SESION.rol !== 'admin') { alert('Solo el administrador puede asignar días en el cuadrante.'); return; }
    abrirModalAsignar();
  } else {
    abrirModalEscrito();
  }
}

// ------------------------------------------------------------
// AGENTES
// ------------------------------------------------------------
async function cargarAgentes() {
  const r = await llamar('getAgentes');
  if (r.ok) AGENTES = r.agentes;
}

function opcionesAgentes(excluir) {
  return AGENTES.filter(a => a.usuario !== excluir)
    .map(a => `<option value="${a.usuario}">${a.nombre}</option>`).join('');
}

// ------------------------------------------------------------
// CUADRANTE
// ------------------------------------------------------------
function mesISO(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function cambiarMes(delta) {
  mesActual.setMonth(mesActual.getMonth() + delta);
  cargarCuadrante();
}

async function cargarCuadrante() {
  document.getElementById('mesLabel').textContent =
    mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const [rCuadrante, rCambios] = await Promise.all([
    llamar('getCuadrante', { mes: mesISO(mesActual) }),
    llamar('getCambiosPendientes')
  ]);
  if (rCuadrante.ok) CUADRANTE_CACHE = rCuadrante.dias;
  if (rCambios.ok) CAMBIOS_CACHE = rCambios.cambios;
  renderCuadrante();
  renderCambiosPendientes();
}

function renderCuadrante() {
  const cont = document.getElementById('listaCuadrante');
  if (!CUADRANTE_CACHE.length) {
    cont.innerHTML = '<p style="color:#9ca3af;font-size:13px;">Sin asignaciones este mes.</p>';
    return;
  }
  const ordenado = [...CUADRANTE_CACHE].sort((a, b) => a.fecha.localeCompare(b.fecha));
  cont.innerHTML = ordenado.map(d => {
    const nombre = nombreAgente(d.agente);
    const esMio = d.agente === SESION.usuario;
    return `
      <div class="dia-cuadrante">
        <span class="dia-fecha">${formatearFechaCorta(d.fecha)}</span>
        <span class="dia-agente">${nombre}</span>
        ${esMio ? `<button class="pequena secundaria" onclick="abrirModalCambio('${d.fecha}','${d.agente}')">Cambiar</button>` : '<span></span>'}
      </div>`;
  }).join('');
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
  cargarCuadrante();
}

function nombreAgente(usuario) {
  const a = AGENTES.find(a => a.usuario === usuario);
  return a ? a.nombre : usuario;
}

function formatearFechaCorta(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// -- Modal: asignar (admin) --
function abrirModalAsignar() {
  document.getElementById('asigAgente').innerHTML = opcionesAgentes();
  document.getElementById('asigFecha').value = '';
  document.getElementById('modalAsignar').classList.remove('oculto');
}
async function guardarAsignacion() {
  const fecha = document.getElementById('asigFecha').value;
  const agente = document.getElementById('asigAgente').value;
  if (!fecha) { alert('Selecciona una fecha'); return; }
  const r = await llamar('setAsignacion', { fecha, agente });
  if (!r.ok) { alert(r.error); return; }
  cerrarModal('modalAsignar');
  cargarCuadrante();
}

// -- Modal: proponer cambio --
function abrirModalCambio(fecha, agenteActual) {
  document.getElementById('cambioFecha').value = fecha;
  document.getElementById('cambioFechaTexto').textContent = formatearFechaCorta(fecha);
  document.getElementById('cambioAgenteActual').textContent = nombreAgente(agenteActual);
  document.getElementById('cambioAgenteNuevo').innerHTML = opcionesAgentes(SESION.usuario);
  document.getElementById('modalCambio').classList.remove('oculto');
}
async function enviarPropuestaCambio() {
  const fecha_turno = document.getElementById('cambioFecha').value;
  const agente_nuevo = document.getElementById('cambioAgenteNuevo').value;
  const r = await llamar('proponerCambio', {
    fecha_turno, agente_original: SESION.usuario, agente_nuevo
  });
  if (!r.ok) { alert(r.error); return; }
  cerrarModal('modalCambio');
  alert('Propuesta enviada. Quedará aplicada en cuanto el otro agente la acepte.');
  cargarCuadrante();
}

// ------------------------------------------------------------
// ESCRITOS
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

  if (!lista.length) { cont.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No hay escritos.</p>'; return; }

  cont.innerHTML = lista.map(e => {
    const urgente = e.estado !== 'Hecho' && e.diasAbierto >= window.UMBRAL_URGENTE;
    const estancado = e.estado === 'En curso' && e.diasSinActividad >= window.UMBRAL_URGENTE;
    const etqClase = e.estado === 'Hecho' ? 'etq-hecho' : estancado ? 'etq-urgente' : e.estado === 'En curso' ? 'etq-curso' : (urgente ? 'etq-urgente' : 'etq-pendiente');
    const etqTexto = urgente && e.estado === 'Pendiente' ? `Urgente · ${e.diasAbierto}d`
      : estancado ? `Sin actividad ${e.diasSinActividad}d`
      : e.estado;
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
  return `
    <div class="bitacora">
      ${notas.map(n => `
        <div class="nota">
          <b>${nombreAgente(n.agente)}</b> <span class="fecha-nota">(${n.fecha})</span>: ${n.nota}
        </div>`).join('')}
    </div>`;
}

function abrirModalNota(escritoId) {
  document.getElementById('notaEscritoId').value = escritoId;
  document.getElementById('notaTexto').value = '';
  document.getElementById('modalNota').classList.remove('oculto');
}

async function guardarNota() {
  const escritoId = document.getElementById('notaEscritoId').value;
  const nota = document.getElementById('notaTexto').value.trim();
  if (!nota) { alert('Escribe algo antes de guardar'); return; }
  const r = await llamar('agregarNota', { escritoId, nota });
  if (!r.ok) { alert(r.error); return; }
  cerrarModal('modalNota');
  cargarEscritos();
}

function puedeLiberar(e) {
  if (e.estado !== 'En curso') return false;
  if (e.agenteAsignado === SESION.usuario) return true;
  return e.diasSinActividad >= window.UMBRAL_URGENTE;
}

async function liberar(id) {
  if (!confirm('¿Liberar este escrito? Volverá a quedar pendiente para que cualquiera lo retome, conservando la bitácora.')) return;
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
  const id = document.getElementById('cerrarId').value;
  const informeUrl = document.getElementById('cerrarInformeUrl').value;
  const r = await llamar('marcarHecho', { id, informeUrl });
  if (!r.ok) { alert(r.error); return; }
  cerrarModal('modalCerrar');
  cargarEscritos();
}

// -- Modal: alta escrito --
function abrirModalEscrito() {
  document.getElementById('escritoError').textContent = '';
  ['escNumRegistro', 'escSolicitante', 'escDescripcion', 'escDocumentoUrl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('escFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modalEscrito').classList.remove('oculto');
}
async function guardarEscrito() {
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
    if (r.existente) {
      errorEl.textContent = `Ya dado de alta por ${nombreAgente(r.existente.altaPor)} — estado: ${r.existente.estado}`;
    } else {
      errorEl.textContent = r.error;
    }
    return;
  }
  cerrarModal('modalEscrito');
  cargarEscritos();
}

// ------------------------------------------------------------
// UTILIDADES DE UI
// ------------------------------------------------------------
function cerrarModal(id) {
  document.getElementById(id).classList.add('oculto');
}

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
