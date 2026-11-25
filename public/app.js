// Cosechas vs Cobro: ingreso con usuario y perfil, una pestaña por archivo (bucket privado "cvc" de Supabase),
// filtros dinámicos, gráficos (Chart.js), tablas por dimensión, descarga y preguntas a la IA.
const CFG = window.CVC_CONFIG;
const QS = new URLSearchParams(location.search);
const LOCAL = QS.has('local');
const sb = LOCAL ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DOMINIO = '@tiemposdac.local';
const CLAVE_INICIAL = '12345678';
const ROLES = { admin: 'Administrador', gerencia: 'Gerencia', cobro: 'Cobro', comercial: 'Comercial' };
// Dos herramientas con el mismo código y los mismos usuarios (config.js → HERRAMIENTA):
//   cuentas = COBRO_CUENTAS (cosecha, cartera, primeros pagos)  ·  pds = PDS_COSECHA_CONO_COBRO (1PD a 6PD)
const HERR = ((LOCAL && QS.get('h')) || CFG.HERRAMIENTA) === 'pds' ? 'pds' : 'cuentas';   // vista local: ?local&h=pds
const MARCA = {
  cuentas: { nombre: 'Cosechas vs Cobro', tit: 'Cosechas <span>vs Cobro</span>',
    sub: 'Originación y cobranza · Nicaragua<br>Cosecha, cartera activa, primeros pagos y cono de cobranza' },
  pds: { nombre: "PD's, Cosecha y Cono de Cobro", tit: "PD's <span>· Cosecha y Cobro</span>",
    sub: 'Primeros pagos · Nicaragua<br>Seguimiento 1PD a 6PD, mora por cuota, cosechas y cono de cobranza' },
}[HERR];
const TODOS = ['admin', 'gerencia', 'cobro', 'comercial'];
const PESTANAS = [
  { id: 'cosecha', t: 'Cosecha', roles: ['admin', 'gerencia'], h: ['cuentas'] },
  { id: 'cartera_activa', t: 'Cartera Activa', roles: ['admin', 'gerencia', 'cobro'], h: ['cuentas'] },
  { id: 'primeros_pagos', t: 'Primeros Pagos', roles: TODOS, h: ['cuentas'] },
  { id: 'pp_seguimiento', t: 'Primeros Pagos – Seguimiento', roles: TODOS, h: ['pds'] },
  { id: 'pp_mora_cuota', t: 'Mora por cuota', roles: TODOS, h: ['pds'] },
  { id: 'pp_cosecha', t: 'Primeros Pagos – Cosecha', roles: TODOS, h: ['pds'] },
  { id: 'cono', t: 'Cono de cobranza', roles: ['admin', 'gerencia'], h: ['cuentas', 'pds'] },
];
const misPestanas = () => PESTANAS.filter(p => p.h.includes(HERR) && p.roles.includes(rol()));
const PP_TABS = ['pp_seguimiento', 'pp_mora_cuota', 'pp_cosecha'];
document.title = MARCA.nombre;
const slug = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

// ---------- Colores (orden validado contra daltonismo; mora: degradado navy validado) ----------
const SERIE = ['#4B9D45', '#2E5FB8', '#F5821F', '#00A4E0', '#93BF02'];
const GRIS = '#C9CDD5';
const MORA_GRUPOS = ['Al día', '1-30 días', '31-90 días', '91-180 días', 'Más de 180', 'Cancelado'];
const MORA_COLOR = ['#8FAEDF', '#5F82BE', '#3A5E9C', '#1F3B6E', '#06255B', GRIS];
const MORA_A_GRUPO = { B0: 0, B1: 1, B2: 2, B3: 2, B4: 3, B5: 3, B6: 3, B7: 4, CANCELADO: 5 };
const M30 = new Set(['B2', 'B3', 'B4', 'B5', 'B6', 'B7']);
const M90 = new Set(['B4', 'B5', 'B6', 'B7']);

// ---------- Dimensiones ----------
const DIM = {
  sucursal: 'Sucursal', canal: 'Canal', sucursal_promotor: 'Sucursal promotor', promotor: 'Promotor',
  producto_comercial: 'Producto comercial', producto_motor: 'Producto motor', clasificacion: 'Clasificación',
  categorizacion: 'Categorización', tipo_credito: 'Tipo de crédito', medio_captacion: 'Medio de captación',
  rango_score: 'Rango de score', rango_desembolso: 'Rango de desembolso', rango_salario: 'Rango de salario',
  rango_edad: 'Rango de edad', rango_multiplicador: 'Multiplicador', rango_antig_cliente: 'Antigüedad del cliente',
  rango_antig_credito: 'Antigüedad del crédito', rango_antig_laboral: 'Antigüedad laboral',
  rango_capacidad: 'Capacidad de pago', rango_ingreso: 'Ingreso bruto (motor)', rango_estabilidad: 'Estabilidad INSS',
  rango_edad_motor: 'Edad (motor)', perfil_motor: 'Perfil motor', politica_hit: 'Política HIT', genero: 'Género',
  plazo: 'Plazo', empleo_inss: 'En base INSS', mes_desembolso: 'Mes desembolso', mora: 'Mora Actual',
  rodamiento: 'Rodamiento', tipo_cartera: 'Tipo cartera del cono', tipo_pago: 'Tipo de pago', pago_mes: 'Pago en el mes',
  estado_promesa: 'Estado de promesa', ult_resultado: 'Último resultado de gestión', gestor: 'Gestor',
  estado_primer_pago: 'Estado del primer pago', tipo_credito_legal: 'Tipo Cartera',
  int_estado: 'Intensidad de gestión', int_prioridad: 'Prioridad de gestión', int_gestor: 'Gestor de cobro',
  producto_madre: 'Producto Madre', resultado_motor: 'Resultado motor', status_promesa_pago: 'Status promesa',
  dealer_genesis: 'Dealer', suc_dealer: 'Sucursal dealer', con_excepcion: 'Con Excepcion', con_prima: 'Con Prima',
  dia_pago: 'Día de pago', tipo_salario: 'Tipo salario', primera_cuota: 'Primera cuota',
  mes_cobro: 'Mes de la primera cuota', dia_vence: 'Vence', d_rod: 'Rodamiento Cendoc (misma fecha)', c_rod: 'Rodamiento Cendoc (cierre)',
  d_pd: 'En 1PD (misma fecha)', c_pd: 'En 1PD (cierre)', credito: 'Crédito',
  fpd_estado: 'Estado FPD', rg_predictivo: 'Regla: predictivo (día 0 a 2)', rg_fila: 'Regla: llamada de gestor (día 1 a 2)',
  rg_gestor: 'Regla: alguna gestión de gestor', rg_referencias: 'Regla: referencias (desde día 5)', rg_visita: 'Regla: visita de campo',
};
// Filtros definidos por Riesgo (17-nov-2026): los 7 primeros siempre visibles; desde Política HIT, en "Más filtros"
const FILTROS_PRINCIPALES = ['producto_madre', 'clasificacion', 'producto_comercial', 'mes_desembolso', 'canal',
  'sucursal_promotor', 'mora'];
const FILTROS_MAS = ['politica_hit', 'tipo_credito_legal', 'tipo_salario', 'rango_antig_cliente', 'rango_antig_credito',
  'rango_antig_laboral', 'rango_capacidad', 'rango_desembolso', 'rango_edad', 'rango_edad_motor', 'rango_estabilidad',
  'rango_ingreso', 'rango_multiplicador', 'rango_salario', 'rango_score', 'resultado_motor', 'rodamiento',
  'status_promesa_pago', 'dealer_genesis', 'suc_dealer', 'con_excepcion', 'con_prima', 'dia_pago', 'empleo_inss',
  'medio_captacion'];
const DIMS_VER_POR = ['sucursal', 'canal', 'producto_madre', 'producto_comercial', 'promotor', 'sucursal_promotor',
  'clasificacion', 'categorizacion', 'rango_score', 'rango_desembolso', 'rango_salario', 'rango_edad', 'rango_capacidad',
  'rango_ingreso', 'rango_antig_cliente', 'rango_antig_laboral', 'rango_multiplicador', 'perfil_motor', 'resultado_motor',
  'politica_hit', 'medio_captacion', 'plazo', 'tipo_credito', 'tipo_credito_legal', 'tipo_salario', 'dealer_genesis',
  'suc_dealer', 'con_excepcion', 'con_prima', 'dia_pago', 'mes_desembolso', 'empleo_inss'];
const CONO_DIMS = { tipo_cartera: 'Tipo de cartera', usuario: 'Gestor', descripcion_accion: 'Acción', descripcion_resultado: 'Resultado', de_la_cosecha: 'Crédito de la cosecha' };

const S = { perfil: null, tab: null, datos: {}, arch: {}, meta: null, f: {}, cono: {}, verPor: {}, tablaPor: {}, charts: {}, mas: false,
  cerrados: {}, pivMed: 'spag', abierto: null, busca: '', seg: { k: 'd', by: 'w', mes: null, pd: 1, ps: 'p' }, mc: 2 };

// ---------- Formatos ----------
const nf = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 });
const fN = v => nf.format(v || 0);
const fP = v => (v == null || !isFinite(v) ? '—' : `${v.toLocaleString('es-NI', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);
const fM = v => {
  const a = Math.abs(v || 0);
  if (a >= 1e6) return `C$ ${(v / 1e6).toLocaleString('es-NI', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `C$ ${(v / 1e3).toLocaleString('es-NI', { maximumFractionDigits: 0 })} mil`;
  return `C$ ${fN(v)}`;
};
const pct = (a, b) => (b ? (100 * a) / b : null);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fMes = p => { const [a, m] = String(p).split('-'); return m ? `${MESES[+m - 1]} ${a.slice(2)}` : p; };
const fDia = d => { const [, m, dd] = String(d).split('-'); return dd ? `${+dd} ${MESES[+m - 1]}` : d; };

// ---------- Sesión ----------
async function perfilActual() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  return ok(await sb.from('cvc_perfiles').select('*').eq('id', data.session.user.id).maybeSingle());
}

function mostrarLogin(msg = '') {
  $('app').hidden = true; $('login').hidden = false; $('flog').hidden = false; $('fclave').hidden = true;
  $('lmsg').textContent = msg;
}

$('flog').addEventListener('submit', async e => {
  e.preventDefault();
  const clave = $('lp').value;
  try {
    ok(await sb.auth.signInWithPassword({ email: slug($('lu').value) + DOMINIO, password: clave }));
    const p = await perfilActual();
    if (!p || !p.activo) { await sb.auth.signOut(); return mostrarLogin(`Usuario sin acceso a ${MARCA.nombre}`); }
    S.perfil = p; $('lp').value = '';
  } catch { return mostrarLogin('Usuario o contraseña incorrectos'); }
  if (clave === CLAVE_INICIAL) {
    $('flog').hidden = true; $('fclave').hidden = false; $('cmsg').textContent = '';
    return $('cn1').focus();
  }
  await iniciar();
});

$('fclave').addEventListener('submit', async e => {
  e.preventDefault();
  const n1 = $('cn1').value, n2 = $('cn2').value;
  if (n1.length < 8) return ($('cmsg').textContent = 'La contraseña debe tener al menos 8 caracteres.');
  if (n1 === CLAVE_INICIAL) return ($('cmsg').textContent = 'Use una contraseña distinta de la genérica.');
  if (n1 !== n2) return ($('cmsg').textContent = 'Las dos contraseñas no coinciden.');
  try { ok(await sb.auth.updateUser({ password: n1 })); $('cn1').value = $('cn2').value = ''; await iniciar(); }
  catch (err) { $('cmsg').textContent = err.message; }
});

const rol = () => S.perfil?.rol;
const puedeDescargar = () => ['admin', 'gerencia', 'cobro'].includes(rol());
const veTablas = () => rol() !== 'gerencia';   // gerencia: solo gráficos

$('titApp').innerHTML = MARCA.tit; $('titLogin').innerHTML = MARCA.tit; $('subLogin').innerHTML = MARCA.sub;

async function iniciar() {
  $('login').hidden = true; $('app').hidden = false;
  $('yoNombre').textContent = S.perfil.nombre;
  $('yoRol').textContent = ROLES[rol()] || '';
  $('btnClave').hidden = $('btnSalir').hidden = LOCAL;
  $('btnDescargar').hidden = !puedeDescargar();
  const mias = misPestanas();
  $('tabs').innerHTML = mias.map(p => `<button data-tab="${p.id}">${p.t}</button>`).join('')
    + (rol() === 'admin' ? '<button data-tab="admin">Administración</button>' : '');
  sugerencias();
  await leerMeta();
  const pedida = QS.get('tab');
  await abrir(mias.some(p => p.id === pedida) ? pedida : mias[0]?.id || 'admin');
}

// ---------- Datos ----------
async function leerMeta() {
  try {
    S.meta = LOCAL ? await (await fetch('local/meta.json', { cache: 'no-store' })).json()
      : ok(await sb.from('cvc_config').select('valor').eq('clave', 'ultima_carga'))[0]?.valor;
  } catch { S.meta = null; }
  const u = S.meta?.ultima_actualizacion;
  $('ultima').textContent = u ? `Actualizado ${new Date(u).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Sin datos aún';
}

// Un archivo por pestaña; las de primeros pagos tienen uno por PD (pp_seg_1 … pp_seg_6) y por cuota (pp_mc_2 … pp_mc_6)
async function bajarArchivo(nombre) {
  if (S.arch[nombre]) return S.arch[nombre];
  let d;
  if (LOCAL) {
    const r = await fetch(`local/${nombre}.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error('todavía no se ha generado; se incluye en la próxima actualización');
    d = await r.json();
  } else {
    const blob = ok(await sb.storage.from(CFG.BUCKET).download(`pestanas/${nombre}.json.gz`));
    d = JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());
  }
  return (S.arch[nombre] = d);
}
const archivoDe = tab => (tab === 'pp_seguimiento' || tab === 'pp_cosecha' ? `pp_seg_${S.seg.pd}` : tab === 'pp_mora_cuota' ? `pp_mc_${S.mc}` : tab);
async function bajar(tab) {
  const d = await bajarArchivo(archivoDe(tab));
  if (tab === 'pp_cosecha') d.pds = await bajarArchivo('pp_pds');
  return (S.datos[tab] = d);
}

// Valor de una fila: dimensión → texto del diccionario; medida → número
const dv = (D, c, i) => { const k = D.datos[c]?.[i]; return k == null ? null : D.dic[c] ? D.dic[c][k] : k; };
const mv = (D, c, i) => D.datos[c]?.[i] || 0;

// Filas que pasan los filtros actuales (un valor, o una lista de valores: p. ej. un grupo de tramos de mora)
function filas(D, filtros, desde, hasta) {
  const conds = [];
  for (const [c, v] of Object.entries(filtros)) {
    if (!v || !D.dic[c]) continue;
    const ks = new Set((Array.isArray(v) ? v : [v]).map(x => D.dic[c].indexOf(x)));
    conds.push([D.datos[c], ks]);
  }
  let mesOk = null;
  if ((desde || hasta) && D.dic.mes_desembolso) {
    mesOk = new Set(D.dic.mes_desembolso.map((m, k) => ((!desde || m >= desde) && (!hasta || m <= hasta) ? k : -1)).filter(k => k >= 0));
  }
  const out = [];
  for (let i = 0; i < D.n; i++) {
    let pasa = true;
    for (const [col, ks] of conds) if (!ks.has(col[i])) { pasa = false; break; }
    if (pasa && mesOk && !mesOk.has(D.datos.mes_desembolso[i])) pasa = false;
    if (pasa) out.push(i);
  }
  return out;
}

// Agrupa índices por una dimensión con un acumulador
function agrupar(D, idx, dim, nuevo, sumar) {
  const m = new Map();
  for (const i of idx) {
    const k = dim ? (dv(D, dim, i) ?? 'SIN DATO') : 'Total';
    let a = m.get(k);
    if (!a) m.set(k, (a = nuevo()));
    sumar(a, i);
  }
  return m;
}

// ---------- Indicadores de crédito ----------
const accCred = D => [() => ({ n: 0, monto: 0, spag: 0, act: 0, saldo: 0, b0: 0, m30: 0, m90: 0, s30: 0, desm: 0, pagoMes: 0, grupos: [0, 0, 0, 0, 0, 0], sgrupos: [0, 0, 0, 0, 0, 0], pgrupos: [0, 0, 0, 0, 0, 0] }),
  (a, i) => {
    const mora = dv(D, 'mora', i), s = mv(D, 'saldo_doc', i), g = MORA_A_GRUPO[mora] ?? 5, p = mv(D, 'saldopagare', i);
    a.n++; a.monto += mv(D, 'monto_des', i); a.spag += p; a.grupos[g]++; a.sgrupos[g] += s; a.pgrupos[g] += p;
    if (mora !== 'CANCELADO') { a.act++; a.saldo += s; }
    if (mora === 'B0') a.b0++;
    if (M30.has(mora)) { a.m30++; a.s30 += s; }
    if (M90.has(mora)) a.m90++;
    if (dv(D, 'rodamiento', i) === 'DESMEJORA') a.desm++;
    const pm = dv(D, 'pago_mes', i);
    if (pm && pm !== 'Sin pago este mes') a.pagoMes++;
  }];
const PP_CLAVE = { 'Pagó': 'pago', 'En mora': 'mora', 'Vencida sin pago registrado': 'sinpago', 'Por vencer': 'porvencer', 'Cancelado': 'canc' };
const accPP = D => [() => ({ n: 0, spag: 0, venc: 0, pago: 0, mora: 0, sinpago: 0, porvencer: 0, canc: 0, s: {} }),
  (a, i) => {
    const e = dv(D, 'estado_primer_pago', i), k = PP_CLAVE[e], p = mv(D, 'saldopagare', i);
    a.n++; a.spag += p;
    if (k) { a[k]++; a.s[k] = (a.s[k] || 0) + p; }
    if (e !== 'Por vencer') a.venc++;
  }];

// ---------- Filtros ----------
function opciones(D, c) { return D.dic[c] ? [...D.dic[c]].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })) : []; }

function pintarFiltros(D) {
  const cono = S.tab === 'cono';
  const sel = (c, t, vals, actual) => `<label class="${actual ? 'activo' : ''}">${t}<select data-f="${c}"><option value="">Todos</option>${vals.map(v => `<option${v === actual ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
  // Selección múltiple: botón con lo elegido y panel con casillas (y buscador si la lista es larga)
  const selD = (c, T = D) => {
    const F = cono ? S.cono : S.f;
    const vals = c === 'mes_desembolso' ? (T.dic[c] || []).slice().sort().reverse() : opciones(T, c);
    const fmt = c === 'mes_desembolso' ? fMes : v => v;
    const elegidos = F[c] || [];
    const txt = !elegidos.length ? 'Todos' : elegidos.length === 1 ? fmt(elegidos[0]) : `${elegidos.length} seleccionados`;
    const abierto = S.abierto === c;
    const q = (S.busca || '').toLowerCase();
    const panel = !abierto ? '' : `<div class="mpanel">${vals.length > 8 ? `<input class="mbusca" placeholder="Buscar…" value="${esc(S.busca || '')}">` : ''}`
      + `<div class="macc"><button type="button" data-mvis="${c}">Marcar los visibles</button><button type="button" data-mtodos="${c}">Todos (quitar filtro)</button></div>`
      + `<div class="mlista">${vals.map(v => `<label class="mop"${q && !String(fmt(v)).toLowerCase().includes(q) ? ' hidden' : ''}><input type="checkbox" data-mval="${esc(v)}"${elegidos.includes(v) ? ' checked' : ''}> ${esc(fmt(v))}</label>`).join('')}</div></div>`;
    return `<div class="multi${elegidos.length ? ' activo' : ''}" data-multi="${c}"><span class="lbl">${DIM[c] || CONO_DIMS[c]}</span><button type="button" class="mbtn" title="${esc(elegidos.map(fmt).join(', '))}">${esc(txt)}</button>${panel}</div>`;
  };
  if (cono) {
    const G = D.gestiones;
    const dias = G.dic.dia.slice().sort();
    $('filtros').innerHTML = `<label>Desde<select data-c="desde"><option value="">Inicio del mes</option>${dias.map(d => `<option value="${d}"${d === S.cono.desde ? ' selected' : ''}>${fDia(d)}</option>`).join('')}</select></label>`
      + `<label>Hasta<select data-c="hasta"><option value="">Hoy</option>${dias.map(d => `<option value="${d}"${d === S.cono.hasta ? ' selected' : ''}>${fDia(d)}</option>`).join('')}</select></label>`
      + Object.keys(CONO_DIMS).map(c => selD(c, G)).join('')
      + '<div class="acciones-f"><button type="button" class="btn lin mini" id="limpiar">Limpiar filtros</button></div>';
    $('filtrosMas').hidden = true;
    pintarChips();
    return;
  }
  $('filtros').innerHTML = FILTROS_PRINCIPALES.filter(c => D.dic[c]).map(c => selD(c)).join('')
    + `<div class="acciones-f"><button type="button" class="btn lin mini" id="verMas">${S.mas ? 'Menos filtros' : 'Más filtros'}</button><button type="button" class="btn lin mini" id="limpiar">Limpiar filtros</button></div>`;
  $('filtrosMas').hidden = !S.mas;
  $('filtrosMas').innerHTML = FILTROS_MAS.filter(c => D.dic[c]).map(c => selD(c)).join('');
  pintarChips();
}

// Filtros aplicados: los de las listas y los que vienen de hacer clic en un gráfico (grupo de mora, día, estado…)
function filtrosActivos() {
  const f = {};
  for (const [k, v] of Object.entries(S.f)) if (v && !k.startsWith('_') && !(Array.isArray(v) && !v.length)) f[k] = v;
  if (S.f._grupo != null && !f.mora) f.mora = Object.keys(MORA_A_GRUPO).filter(m => MORA_A_GRUPO[m] === S.f._grupo);
  return f;
}

const nomFiltro = k => (k === '_grupo' ? 'Mora Actual' : k === 'desde' ? 'Desde' : k === 'hasta' ? 'Hasta' : DIM[k] || CONO_DIMS[k] || k);
const valFiltro = (k, v) => (Array.isArray(v) ? v.map(x => valFiltro(k, x)).join(', ') : k === '_grupo' ? MORA_GRUPOS[v] : ['mes_desembolso', 'mes_cobro'].includes(k) ? fMes(v) : ['primera_cuota', 'desde', 'hasta', 'dia', 'dia_vence'].includes(k) ? fDia(v) : v);

function pintarChips() {
  const F = S.tab === 'cono' ? S.cono : S.f;
  const act = Object.entries(F).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length));
  $('chips').hidden = !act.length;
  $('chips').innerHTML = act.length ? '<span class="small muted">Filtrando por:</span>'
    + act.map(([k, v]) => `<button type="button" class="chipf" data-quitar="${esc(k)}" title="Quitar este filtro">${esc(nomFiltro(k))}: <b>${esc(valFiltro(k, v))}</b> ✕</button>`).join('')
    + '<span class="small muted">· Clic en una barra o punto de un gráfico para filtrar; otro clic en el mismo lo quita.</span>' : '';
}

// Clic en un gráfico: aplica sus valores como filtro a toda la pestaña; si ya estaban aplicados, los quita
function filtrarDesdeGrafico(valores) {
  const cono = S.tab === 'cono';
  const F = cono ? S.cono : S.f;
  const lista = k => !k.startsWith('_') && k !== 'desde' && k !== 'hasta';   // filtros de listas (selección múltiple)
  const igual = (k, v) => (lista(k) ? Array.isArray(F[k]) && F[k].length === 1 && F[k][0] === v : F[k] === v);
  const ya = Object.entries(valores).every(([k, v]) => igual(k, v));
  for (const [k, v] of Object.entries(valores)) {
    if (ya) delete F[k]; else F[k] = lista(k) ? [v] : v;
    if (k === 'mora') delete F._grupo;
    if (k === '_grupo') delete F.mora;
  }
  pintar();
}

const filtrosTab = () => (S.tab === 'cono' ? S.cono : S.f);
function multiCambio(c, vals) {
  const F = filtrosTab();
  if (vals.length) F[c] = vals; else delete F[c];
  if (c === 'mora') delete F._grupo;
  pintar();
}

document.addEventListener('input', e => {
  if (!e.target.classList.contains('mbusca')) return;
  S.busca = e.target.value;
  const q = S.busca.toLowerCase();
  e.target.closest('.mpanel').querySelectorAll('.mop').forEach(l => { l.hidden = q && !l.textContent.toLowerCase().includes(q); });
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.mval !== undefined) {
    const c = t.closest('[data-multi]').dataset.multi, act = new Set(filtrosTab()[c] || []);
    if (t.checked) act.add(t.dataset.mval); else act.delete(t.dataset.mval);
    return multiCambio(c, [...act]);
  }
  if (t.dataset.f !== undefined) { S.f[t.dataset.f] = t.value; if (t.dataset.f === 'mora') delete S.f._grupo; pintar(); }
  else if (t.dataset.c !== undefined) { S.cono[t.dataset.c] = t.value; pintar(); }
  else if (t.dataset.verpor !== undefined) { S.verPor[t.dataset.verpor] = t.value; pintar(); }
  else if (t.id === 'pivMed') { S.pivMed = t.value; pintar(); }
});
document.addEventListener('click', e => {
  const btn = e.target.closest('.mbtn');
  if (btn) { const c = btn.closest('[data-multi]').dataset.multi; S.abierto = S.abierto === c ? null : c; S.busca = ''; pintarFiltros(S.datos[S.tab]); }
  else if (S.abierto && !e.target.closest('.multi')) { S.abierto = null; S.busca = ''; pintarFiltros(S.datos[S.tab]); }
  const mt = e.target.closest('[data-mtodos]');
  if (mt) multiCambio(mt.dataset.mtodos, []);
  const mvis = e.target.closest('[data-mvis]');
  if (mvis) {
    const c = mvis.dataset.mvis, act = new Set(filtrosTab()[c] || []);
    mvis.closest('.mpanel').querySelectorAll('.mop:not([hidden]) input').forEach(i => act.add(i.dataset.mval));
    multiCambio(c, [...act]);
  }
  if (e.target.id === 'limpiar') { if (S.tab === 'cono') S.cono = {}; else S.f = {}; pintar(); }
  if (e.target.id === 'verMas') { S.mas = !S.mas; pintar(); }
  const q = e.target.closest('[data-quitar]');
  if (q) { delete (S.tab === 'cono' ? S.cono : S.f)[q.dataset.quitar]; pintar(); }
  const anio = e.target.closest('[data-anio]');
  if (anio) { const k = `${S.tab}_${anio.dataset.anio}`; S.cerrados[k] = !S.cerrados[k]; pintar(); }
  const celda = e.target.closest('[data-pmes]');
  if (celda) filtrarDesdeGrafico(celda.dataset.pmora ? { mes_desembolso: celda.dataset.pmes, mora: celda.dataset.pmora } : { mes_desembolso: celda.dataset.pmes });
});

// ---------- Gráficos ----------
Chart.defaults.font.family = 'Arial, Helvetica, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#5B6170';
Chart.defaults.animation.duration = 0;   // al filtrar, los gráficos cambian al instante

// Etiqueta de valor en la punta de cada barra (para barras simples)
const pluginEtiquetas = {
  id: 'etiquetas',
  afterDatasetsDraw(chart) {
    const o = chart.options.plugins.etiquetas;
    if (!o?.mostrar) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '12px Arial'; ctx.fillStyle = '#333740';
    chart.data.datasets.forEach((ds, di) => {
      chart.getDatasetMeta(di).data.forEach((el, i) => {
        const v = ds.data[i];
        if (v == null) return;
        const t = ds.fmtEtiqueta ? ds.fmtEtiqueta(v) : fN(v);
        if (chart.options.indexAxis === 'y') { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, el.x + 6, el.y); }
        else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(t, el.x, el.y - 4); }
      });
    });
    ctx.restore();
  },
};
Chart.register(pluginEtiquetas);

function tarjeta(id, titulo, nota, { ancho = false, alto = false, verPor = null, leyenda = null } = {}) {
  // data-verpor = la clave que lee la pestaña (antes se guardaba con el id del gráfico y el cambio no se veía)
  const sel = verPor ? `<label class="small">Ver por <select data-verpor="${verPor.id}">${DIMS_VER_POR.filter(d => verPor.D.dic[d]).map(d => `<option value="${d}"${d === verPor.valor ? ' selected' : ''}>${DIM[d]}</option>`).join('')}</select></label>` : '';
  const ley = leyenda ? `<div class="leyenda">${leyenda.map(([t, c]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div>` : '';
  return `<article class="graf${ancho ? ' ancho' : ''}${alto ? ' alto' : ''}"><div class="cab"><h3>${titulo}</h3>${sel}</div>${nota ? `<p class="nota">${nota}</p>` : ''}${ley}<div class="lienzo"><canvas id="${id}"></canvas></div></article>`;
}

// clic(índice, serie) → {dimensión: valor} que se aplica como filtro a toda la pestaña (gráficos dinámicos)
function grafico(id, cfg, clic = null) {
  S.charts[id]?.destroy();
  const el = $(id);
  if (!el) return;
  if (clic) {
    cfg.options.onClick = (ev, els, chart) => {
      if (!els.length) return;
      // la serie exacta bajo el puntero (en barras apiladas el tooltip abarca toda la columna); si no hay, solo la categoría
      const exacto = chart.getElementsAtEventForMode(ev.native || ev, 'nearest', { intersect: true }, true)[0];
      const f = clic(els[0].index, exacto ? exacto.datasetIndex : null);
      if (f) setTimeout(() => filtrarDesdeGrafico(f));   // después de que Chart.js termine su evento (el gráfico se vuelve a crear)
    };
    cfg.options.onHover = (ev, els) => { ev.native.target.style.cursor = els.length ? 'pointer' : 'default'; };
  }
  S.charts[id] = new Chart(el, cfg);
}

function ejes({ horizontal = false, apilado = false, fmtValor = fN, max = undefined } = {}) {
  const valor = { stacked: apilado, beginAtZero: true, max, grid: { color: '#E6E8EC' }, border: { display: false }, ticks: { callback: v => fmtValor(v), maxTicksLimit: 6, precision: fmtValor === fN ? 0 : undefined }, suggestedMax: fmtValor === fN ? 1 : undefined };
  const cat = { stacked: apilado, grid: { display: false }, border: { color: '#C3C7CF' }, ticks: { autoSkip: !horizontal, maxRotation: 0 } };
  return horizontal ? { x: valor, y: cat } : { x: cat, y: valor };
}

// etiqueta(c): texto propio por serie (cantidad, monto y % del total); extra(items): líneas al pie
function tooltipCfg(fmt, extra, etiqueta = null) {
  return {
    backgroundColor: '#fff', titleColor: '#06255B', bodyColor: '#333740', footerColor: '#333740', borderColor: '#D9DDE4', borderWidth: 1, padding: 10,
    titleFont: { weight: 'bold' }, bodyFont: { size: 12 }, footerFont: { size: 12, weight: 'normal' }, usePointStyle: true, boxWidth: 8, boxHeight: 2,
    callbacks: { label: etiqueta || (c => `${fmt(c.raw, c)}  ${c.dataset.label || ''}`), footer: extra ? items => (items.length ? extra(items) : '') : undefined },
  };
}
// Texto de tooltip: cantidad · monto · % del total
const tipCMP = (n, monto, totN, u = 'créditos') => [`${fN(n)} ${u} · ${fM(monto)}`, `${fP(pct(n, totN))} del total`];

// Barras simples (una serie): horizontal para rankings por dimensión, vertical para categorías ordenadas
function barrasSimples(id, etiquetas, valores, { color = SERIE[1], horizontal = true, fmt = fN, extra = null, max, clic = null } = {}) {
  grafico(id, {
    type: 'bar',
    data: { labels: etiquetas, datasets: [{ data: valores, fmtEtiqueta: fmt, backgroundColor: color, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24, categoryPercentage: 0.8 }] },
    options: {
      indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: horizontal ? 60 : 0, top: horizontal ? 0 : 18 } },
      scales: ejes({ horizontal, fmtValor: fmt, max }),
      plugins: { legend: { display: false }, tooltip: tooltipCfg(fmt, extra), etiquetas: { mostrar: true } },
    },
  }, clic);
}

// Barras apiladas (varias series de la misma unidad)
function barrasApiladas(id, etiquetas, series, { horizontal = false, fmt = fN, cien = false, extra = null, etiqueta = null, clic = null, todas = false } = {}) {
  const scales = ejes({ horizontal, apilado: true, fmtValor: cien ? v => `${v}%` : fmt, max: cien ? 100 : undefined });
  if (todas) (horizontal ? scales.y : scales.x).ticks.autoSkip = false;   // todas las etiquetas (p. ej. cada día del mes)
  grafico(id, {
    type: 'bar',
    data: { labels: etiquetas, datasets: series.map(s => ({ label: s.t, data: s.v, backgroundColor: s.c, borderColor: '#fff', borderWidth: horizontal ? { right: 2 } : { top: 2 }, borderSkipped: false, maxBarThickness: 28, categoryPercentage: 0.8 })) },
    options: {
      indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales,
      plugins: { legend: { display: false }, tooltip: { ...tooltipCfg(cien ? v => fP(v) : fmt, extra, etiqueta), filter: c => c.raw != null && c.raw !== 0 } },
    },
  }, clic);
}

// Líneas (misma unidad, un solo eje)
function lineas(id, etiquetas, series, { fmt = fN, extra = null, etiqueta = null, clic = null } = {}) {
  grafico(id, {
    type: 'line',
    data: { labels: etiquetas, datasets: series.map(s => ({ label: s.t, data: s.v, borderColor: s.c, backgroundColor: s.c, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBorderColor: '#fff', pointBorderWidth: 2, tension: 0.25, spanGaps: true })) },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: ejes({ fmtValor: fmt }),
      plugins: { legend: { display: false }, tooltip: tooltipCfg(fmt, extra, etiqueta) },
    },
  }, clic);
}

// Barras agrupadas (dos series de la misma unidad)
function barrasAgrupadas(id, etiquetas, series, { fmt = fN, extra = null, clic = null } = {}) {
  grafico(id, {
    type: 'bar',
    data: { labels: etiquetas, datasets: series.map(s => ({ label: s.t, data: s.v, backgroundColor: s.c, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 20, categoryPercentage: 0.75, barPercentage: 0.9 })) },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: ejes({ fmtValor: fmt }), plugins: { legend: { display: false }, tooltip: tooltipCfg(fmt, extra) },
    },
  }, clic);
}

function kpis(lista) {
  $('kpis').innerHTML = lista.map(([l, v, s, c]) => `<div class="kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`).join('');
}

// Ranking por dimensión: los grupos con más créditos (los pequeños distorsionan los porcentajes)
function ranking(m, { top = 15, minimo = 1, valor, orden }) {
  return [...m.entries()].filter(([, a]) => a.n >= minimo).sort((x, y) => orden(y[1]) - orden(x[1])).slice(0, top)
    .map(([k, a]) => [k, valor(a), a]);
}

// ---------- Tabla por dimensión ----------
function tabla(titulo, opcionesPor, por, columnas, m, total) {
  const caja = $('tablaCaja');
  caja.hidden = !veTablas();
  if (caja.hidden) return;
  $('tablaTit').textContent = titulo;
  $('tablaPor').innerHTML = opcionesPor.map(([d, t]) => `<option value="${d}"${d === por ? ' selected' : ''}>${t}</option>`).join('');
  $('tablaPor').dataset.verpor = `tabla_${S.tab}`;
  $('thead').innerHTML = `<tr><th>${esc((opcionesPor.find(o => o[0] === por) || [, ''])[1])}</th>${columnas.map(c => `<th class="num">${c.t}</th>`).join('')}</tr>`;
  const filasT = [...m.entries()].sort((a, b) => (por === 'mes_desembolso' || por === 'dia' ? String(b[0]).localeCompare(String(a[0])) : b[1].n - a[1].n));
  const celda = (c, a) => { const v = c.v(a); return `<td class="num${c.alerta && c.alerta(a) ? ' alerta' : ''}">${c.f(v)}</td>`; };
  $('tbody').innerHTML = filasT.map(([k, a]) => `<tr><td>${esc(por === 'mes_desembolso' ? fMes(k) : k)}</td>${columnas.map(c => celda(c, a)).join('')}</tr>`).join('')
    + (total ? `<tr class="total"><td>Total</td>${columnas.map(c => celda(c, total)).join('')}</tr>` : '');
}

// ---------- Cuadro mes de desembolso × tramo de mora (como la tabla dinámica de Excel) ----------
const TRAMOS = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'CANCELADO'];
const PIV_MED = { spag: 'Saldo pagaré inicial', n: 'Cantidad de créditos', saldo: 'Saldo actual', pct: '% del saldo pagaré del mes' };

function pivote(D, idx, titulo) {
  // Gerencia (solo gráficos) también ve el cuadro, pero solo como % del saldo pagaré de cada mes (fila), sin montos
  const soloPct = !veTablas();
  $('pivCaja').hidden = false;
  $('pivMed').closest('label').hidden = soloPct;
  const m = new Map(), tot = {};
  const nuevo = () => Object.fromEntries(TRAMOS.map(t => [t, { n: 0, spag: 0, saldo: 0 }]));
  for (const i of idx) {
    const mes = dv(D, 'mes_desembolso', i), t = dv(D, 'mora', i);
    if (!mes || !TRAMOS.includes(t)) continue;
    if (!m.has(mes)) m.set(mes, nuevo());
    const c = m.get(mes)[t];
    c.n++; c.spag += mv(D, 'saldopagare', i); c.saldo += mv(D, 'saldo_doc', i);
  }
  const cols = TRAMOS.filter(t => [...m.values()].some(r => r[t].n));
  const sumar = filasR => { const s = nuevo(); for (const r of filasR) for (const t of TRAMOS) for (const k of ['n', 'spag', 'saldo']) s[t][k] += r[t][k]; return s; };
  const totalFila = r => cols.reduce((a, t) => ({ n: a.n + r[t].n, spag: a.spag + r[t].spag, saldo: a.saldo + r[t].saldo }), { n: 0, spag: 0, saldo: 0 });
  const general = sumar([...m.values()]), tg = totalFila(general);
  const med = soloPct ? 'pct' : S.pivMed;
  const valor = (c, fila) => (med === 'pct' ? pct(c.spag, fila.spag) : c[med]);
  const fmt = v => (med === 'pct' ? fP(v) : v ? (med === 'n' ? fN(v) : v.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '');
  const tip = c => `${fN(c.n)} créditos · ${fM(c.spag)} saldo pagaré · ${fP(pct(c.spag, tg.spag))} del total`;
  const celdas = (r, mes) => { const tf = totalFila(r); return cols.map(t => `<td class="num${mes ? ' clic' : ''}"${mes ? ` data-pmes="${mes}" data-pmora="${t}"` : ''} title="${esc(tip(r[t]))}">${r[t].n ? fmt(valor(r[t], tf)) : ''}</td>`).join('')
    + `<td class="num tot" title="${esc(tip(tf))}">${fmt(med === 'pct' ? 100 : tf[med])}</td>`; };
  const anios = [...new Set([...m.keys()].map(k => k.slice(0, 4)))].sort();
  let cuerpo = '';
  for (const a of anios) {
    const meses = [...m.keys()].filter(k => k.startsWith(a)).sort();
    const cerrado = S.cerrados[`${S.tab}_${a}`];
    cuerpo += `<tr class="anio"><td data-anio="${a}" class="clic">${cerrado ? '⊞' : '⊟'} ${a}</td>${celdas(sumar(meses.map(k => m.get(k))))}</tr>`;
    if (!cerrado) cuerpo += meses.map(k => `<tr><td class="mes clic" data-pmes="${k}" title="Filtrar por este mes">${MESES[+k.slice(5) - 1]}</td>${celdas(m.get(k), k)}</tr>`).join('');
  }
  $('pivTit').textContent = titulo;
  $('pivMed').innerHTML = Object.entries(PIV_MED).map(([k, t]) => `<option value="${k}"${k === med ? ' selected' : ''}>${t}</option>`).join('');
  $('pivHead').innerHTML = `<tr><th>Mes de desembolso</th>${cols.map(t => `<th class="num">${t}</th>`).join('')}<th class="num">Total general</th></tr>`;
  $('pivBody').innerHTML = cuerpo + `<tr class="total"><td>Total general</td>${celdas(general)}</tr>`;
}

// ---------- Pestaña Cosecha ----------
function pintarCosecha(D) {
  const idx = filas(D, filtrosActivos());
  const [n0, sm] = accCred(D);
  const tot = agrupar(D, idx, null, n0, sm).get('Total') || n0();
  kpis([
    ['Créditos desembolsados', fN(tot.n), fM(tot.monto), 'navy'],
    ['Al día hoy', fP(pct(tot.b0, tot.n)), `${fN(tot.b0)} créditos`, ''],
    ['Mora 30+', fP(pct(tot.m30, tot.n)), `${fN(tot.m30)} créditos · ${fM(tot.s30)}`, 'naranja'],
    ['Mora 90+', fP(pct(tot.m90, tot.n)), `${fN(tot.m90)} créditos`, 'rojo'],
    ['Cancelados', fP(pct(tot.n - tot.act, tot.n)), `${fN(tot.n - tot.act)} créditos`, 'cielo'],
    ['Saldo activo', fM(tot.saldo), `${fN(tot.act)} créditos activos`, 'lima'],
  ]);
  const vp = S.verPor.cosecha_dim || 'sucursal';
  $('graficos').innerHTML =
    tarjeta('gCosechaMora', 'Cómo está hoy cada cosecha', 'Distribución de los créditos de cada mes de desembolso según su tramo de mora actual.', { ancho: true, leyenda: MORA_GRUPOS.map((t, i) => [t, MORA_COLOR[i]]) })
    + tarjeta('gCosechaPct', 'Mora 30+ y 90+ por cosecha', 'Porcentaje de los créditos desembolsados en cada mes que hoy tienen más de 30 o más de 90 días de mora.', { leyenda: [['Mora 30+', SERIE[2]], ['Mora 90+', SERIE[1]]] })
    + tarjeta('gCosechaVol', 'Créditos desembolsados por mes', 'Nuevos y renovaciones.', { leyenda: [['Nuevo', SERIE[0]], ['Renovación', SERIE[1]]] })
    + tarjeta('gCosechaDim', 'Mora 30+ por grupo', 'Los 15 grupos con más créditos (mínimo 30), ordenados por porcentaje de mora 30+.', { ancho: true, alto: true, verPor: { id: 'cosecha_dim', D, valor: vp } });
  const porMes = agrupar(D, idx, 'mes_desembolso', n0, sm);
  const meses = [...porMes.keys()].sort();
  const am = k => porMes.get(meses[k]);
  barrasApiladas('gCosechaMora', meses.map(fMes), MORA_GRUPOS.map((t, g) => ({ t, c: MORA_COLOR[g], v: meses.map(m => pct(porMes.get(m).grupos[g], porMes.get(m).n)) })), {
    cien: true,
    etiqueta: c => { const a = am(c.dataIndex), g = c.datasetIndex; return `${c.dataset.label}: ${fP(c.raw)} · ${fN(a.grupos[g])} créditos · ${fM(a.pgrupos[g])} · ${fP(pct(a.grupos[g], tot.n))} del total`; },
    extra: it => { const a = am(it[0].dataIndex); return ['Cosecha: ' + tipCMP(a.n, a.spag, tot.n).join(' · ')]; },
    clic: (k, g) => (g == null ? { mes_desembolso: meses[k] } : { mes_desembolso: meses[k], _grupo: g }),
  });
  lineas('gCosechaPct', meses.map(fMes), [
    { t: 'Mora 30+', c: SERIE[2], v: meses.map(m => pct(porMes.get(m).m30, porMes.get(m).n)) },
    { t: 'Mora 90+', c: SERIE[1], v: meses.map(m => pct(porMes.get(m).m90, porMes.get(m).n)) },
  ], {
    fmt: fP,
    etiqueta: c => { const a = am(c.dataIndex), n = c.datasetIndex ? a.m90 : a.m30; return `${c.dataset.label}: ${fP(c.raw)} (${fN(n)} créditos)`; },
    extra: it => tipCMP(am(it[0].dataIndex).n, am(it[0].dataIndex).spag, tot.n),
    clic: k => ({ mes_desembolso: meses[k] }),
  });
  const clas = agrupar(D, idx, 'mes_desembolso', () => ({ NUEVO: { n: 0, p: 0 }, RENOVACION: { n: 0, p: 0 } }), (a, i) => { const c = a[dv(D, 'clasificacion', i)]; if (c) { c.n++; c.p += mv(D, 'saldopagare', i); } });
  const CLAS = [['Nuevo', 'NUEVO', SERIE[0]], ['Renovación', 'RENOVACION', SERIE[1]]];
  barrasApiladas('gCosechaVol', meses.map(fMes), CLAS.map(([t, k, c]) => ({ t, c, v: meses.map(m => clas.get(m)[k].n) })), {
    etiqueta: c => { const x = clas.get(meses[c.dataIndex])[CLAS[c.datasetIndex][1]]; return `${c.dataset.label}: ${fN(x.n)} créditos · ${fM(x.p)} · ${fP(pct(x.n, tot.n))} del total`; },
    extra: it => ['Mes: ' + tipCMP(am(it[0].dataIndex).n, am(it[0].dataIndex).spag, tot.n).join(' · ')],
    clic: (k, g) => (g == null ? { mes_desembolso: meses[k] } : { mes_desembolso: meses[k], clasificacion: CLAS[g][1] }),
  });
  const r = ranking(agrupar(D, idx, vp, n0, sm), { minimo: 30, valor: a => pct(a.m30, a.n), orden: a => a.n }).sort((a, b) => b[1] - a[1]);
  barrasSimples('gCosechaDim', r.map(x => vp === 'mes_desembolso' ? fMes(x[0]) : x[0]), r.map(x => x[1]), {
    color: SERIE[2], fmt: fP,
    extra: it => { const a = r[it[0].dataIndex][2]; return [...tipCMP(a.n, a.spag, tot.n), `${fN(a.m30)} en mora 30+ · ${fM(a.s30)} de saldo`]; },
    clic: k => ({ [vp]: r[k][0] }),
  });
  pivote(D, idx, 'Saldo pagaré inicial por mes de desembolso y tramo de mora');
  const tp = S.verPor.tabla_cosecha || 'sucursal';
  const mt = agrupar(D, idx, tp, n0, sm);
  tabla('Detalle de la cosecha', DIMS_VER_POR.filter(d => D.dic[d]).map(d => [d, DIM[d]]), tp, [
    { t: 'Créditos', v: a => a.n, f: fN }, { t: 'Monto desembolsado', v: a => a.monto, f: fM },
    { t: 'Activos', v: a => a.act, f: fN }, { t: 'Saldo', v: a => a.saldo, f: fM },
    { t: '% al día', v: a => pct(a.b0, a.n), f: fP }, { t: '% mora 30+', v: a => pct(a.m30, a.n), f: fP, alerta: a => pct(a.m30, a.n) > pct(tot.m30, tot.n) * 1.25 },
    { t: '% mora 90+', v: a => pct(a.m90, a.n), f: fP }, { t: '% cancelado', v: a => pct(a.n - a.act, a.n), f: fP },
  ], mt, tot);
}

// ---------- Pestaña Cartera Activa ----------
function pintarCartera(D) {
  const idx = filas(D, filtrosActivos());
  const [n0, sm] = accCred(D);
  const tot = agrupar(D, idx, null, n0, sm).get('Total') || n0();
  kpis([
    ['Créditos activos', fN(tot.act), 'en la cartera de cobro hoy', 'navy'],
    ['Saldo', fM(tot.saldo), 'saldo de los créditos activos', ''],
    ['Al día', fP(pct(tot.b0, tot.act)), `${fN(tot.b0)} créditos`, 'lima'],
    ['Saldo en mora 30+', fM(tot.s30), `${fP(pct(tot.s30, tot.saldo))} del saldo`, 'naranja'],
    ['Rodamiento: desmejora', fP(pct(tot.desm, tot.act)), `${fN(tot.desm)} créditos`, 'rojo'],
    ['Pagaron este mes', fP(pct(tot.pagoMes, tot.act)), `${fN(tot.pagoMes)} créditos`, 'cielo'],
  ]);
  const vp = S.verPor.cartera_dim || 'sucursal';
  $('graficos').innerHTML =
    tarjeta('gCarMora', 'Saldo por tramo de mora', 'Saldo de la cartera activa según días de mora hoy.', {})
    + tarjeta('gCarRod', 'Rodamiento (Cendoc)', 'Cómo se movió cada crédito respecto al corte anterior.', {})
    + tarjeta('gCarPago', 'Pago en el mes', 'Último pago del mes comparado con el día de pago del crédito.', {})
    + tarjeta('gCarTipo', 'Tipo del último pago', 'Último pago registrado comparado con el valor de la cuota.', {})
    + tarjeta('gCarDim', '% del saldo en mora 30+ por grupo', 'Los 15 grupos con más créditos activos (mínimo 20).', { ancho: true, alto: true, verPor: { id: 'cartera_dim', D, valor: vp } });
  barrasSimples('gCarMora', MORA_GRUPOS.slice(0, 5), tot.sgrupos.slice(0, 5), {
    horizontal: false, fmt: fM, color: MORA_COLOR.slice(0, 5),
    extra: it => { const g = it[0].dataIndex; return [`${fN(tot.grupos[g])} créditos · ${fP(pct(tot.grupos[g], tot.act))} de los activos`, `${fP(pct(tot.sgrupos[g], tot.saldo))} del saldo total`]; },
    clic: g => ({ _grupo: g }),
  });
  const cuenta = dim => { const m = agrupar(D, idx, dim, () => ({ n: 0, s: 0 }), (a, i) => { a.n++; a.s += mv(D, 'saldo_doc', i); }); return [...m.entries()].sort((a, b) => b[1].n - a[1].n); };
  const tipCar = lista => it => { const a = lista[it[0].dataIndex][1]; return [`Saldo ${fM(a.s)} · ${fP(pct(a.s, tot.saldo))} del saldo`, `${fP(pct(a.n, tot.act))} de los créditos activos`]; };
  const rod = cuenta('rodamiento');
  barrasSimples('gCarRod', rod.map(x => x[0]), rod.map(x => x[1].n), { color: SERIE[1], extra: tipCar(rod), clic: k => ({ rodamiento: rod[k][0] }) });
  const pm = cuenta('pago_mes');
  barrasSimples('gCarPago', pm.map(x => x[0]), pm.map(x => x[1].n), { color: SERIE[0], extra: tipCar(pm), clic: k => ({ pago_mes: pm[k][0] }) });
  const tpg = cuenta('tipo_pago');
  barrasSimples('gCarTipo', tpg.map(x => x[0]), tpg.map(x => x[1].n), { color: SERIE[3], extra: tipCar(tpg), clic: k => ({ tipo_pago: tpg[k][0] }) });
  const r = ranking(agrupar(D, idx, vp, n0, sm), { minimo: 20, valor: a => pct(a.s30, a.saldo), orden: a => a.n }).sort((a, b) => b[1] - a[1]);
  barrasSimples('gCarDim', r.map(x => vp === 'mes_desembolso' ? fMes(x[0]) : x[0]), r.map(x => x[1]), {
    color: SERIE[2], fmt: fP,
    extra: it => { const a = r[it[0].dataIndex][2]; return [`${fN(a.act)} activos · saldo ${fM(a.saldo)} · ${fP(pct(a.saldo, tot.saldo))} del saldo total`, `Saldo 30+ ${fM(a.s30)}`]; },
    clic: k => ({ [vp]: r[k][0] }),
  });
  pivote(D, idx, 'Saldo pagaré inicial de la cartera activa por mes de desembolso y tramo de mora');
  const tp = S.verPor.tabla_cartera_activa || 'sucursal';
  tabla('Detalle de la cartera activa', [...DIMS_VER_POR, 'mora', 'rodamiento', 'tipo_cartera', 'gestor', 'tipo_pago', 'pago_mes'].filter(d => D.dic[d]).map(d => [d, DIM[d]]), tp, [
    { t: 'Créditos', v: a => a.act, f: fN }, { t: 'Saldo', v: a => a.saldo, f: fM },
    { t: '% al día', v: a => pct(a.b0, a.act), f: fP }, { t: 'Saldo mora 30+', v: a => a.s30, f: fM },
    { t: '% saldo 30+', v: a => pct(a.s30, a.saldo), f: fP, alerta: a => pct(a.s30, a.saldo) > pct(tot.s30, tot.saldo) * 1.25 },
    { t: '% desmejora', v: a => pct(a.desm, a.act), f: fP }, { t: '% pagaron este mes', v: a => pct(a.pagoMes, a.act), f: fP },
  ], agrupar(D, idx, tp, n0, sm), tot);
}

// ---------- Pestaña Primeros Pagos ----------
const PP_ESTADOS = [['Pagó', 'pago', SERIE[0]], ['Por vencer', 'porvencer', SERIE[1]], ['En mora', 'mora', SERIE[2]],
  ['Vencida sin pago registrado', 'sinpago', SERIE[3]], ['Cancelado', 'canc', GRIS]];

function pintarPrimeros(D) {
  const idx = filas(D, filtrosActivos());
  const [n0, sm] = accPP(D);
  const tot = agrupar(D, idx, null, n0, sm).get('Total') || n0();
  const hoy = new Date();
  kpis([
    ['Primera cuota este mes', fN(tot.n), `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`, 'navy'],
    ['Ya vencieron', fN(tot.venc), fP(pct(tot.venc, tot.n)) + ' del total', 'cielo'],
    ['Pagaron', fN(tot.pago), fP(pct(tot.pago, tot.venc)) + ' de los vencidos', ''],
    ['En mora', fN(tot.mora), fP(pct(tot.mora, tot.venc)) + ' de los vencidos', 'naranja'],
    ['Vencida sin pago registrado', fN(tot.sinpago), fP(pct(tot.sinpago, tot.venc)) + ' de los vencidos', 'amarillo'],
    ['Por vencer', fN(tot.porvencer), 'aún no llega la fecha', 'lima'],
  ]);
  const vp = S.verPor.pp_dim || 'sucursal';
  $('graficos').innerHTML =
    tarjeta('gPPDia', 'Primeros pagos por fecha de vencimiento', 'Créditos según el día en que vence su primera cuota y cómo están hoy.', { ancho: true, leyenda: PP_ESTADOS.map(e => [e[0], e[2]]) })
    + tarjeta('gPPDim', '% en mora sobre los vencidos (saldo pagaré)', 'Saldo pagaré en mora ÷ saldo pagaré de las primeras cuotas ya vencidas. Los 15 grupos con más saldo vencido (mínimo 5 cuentas).', { ancho: true, alto: true, verPor: { id: 'pp_dim', D, valor: vp } })
    + (veTablas() && D.dic.nombre_deudor ? `<article class="graf ancho"><div class="cab"><h3>Detalle de las cuentas en mora</h3><span class="small muted" id="ppMoraNota"></span></div><div class="tabla-caja" id="ppMora"></div></article>` : '')
    + (D.dic.int_estado ? `<article class="graf ancho"><div class="cab"><h3>Cuentas sin gestión efectiva de cobro</h3><label class="small">Ver por <select data-verpor="pp_int">${['promotor', 'int_gestor', ...DIMS_VER_POR.filter(d => d !== 'promotor')].filter(d => D.dic[d]).map(d => `<option value="${d}"${d === (S.verPor.pp_int || 'promotor') ? ' selected' : ''}>${DIM[d]}</option>`).join('')}</select></label></div><p class="nota" id="ppIntNota"></p><div class="tabla-caja" id="ppInt"></div>${veTablas() ? '<h3 class="subtit">Detalle de las cuentas con gestión insuficiente</h3><div class="tabla-caja" id="ppIntLista"></div>' : ''}</article>` : '')
    + (D.dic.rg_gestor ? tarjeta('gPPReglas', 'Cumplimiento de las reglas de cobro FPD', 'Créditos FPD que no pagaron a tiempo, según las gestiones registradas en el cono (MCCollect). Clic en «No cumple» para filtrar y descargar la lista.', { ancho: true, leyenda: [['Cumple', SERIE[0]], ['No cumple', SERIE[2]]] }) : '');
  const porDia = agrupar(D, idx, 'primera_cuota', n0, sm);
  // Todos los días del mes en el eje: un día sin barra es un día sin primeras cuotas (no un dato perdido)
  const cuotas = (D.dic.primera_cuota || []).slice().sort();
  const mesPP = cuotas.length ? cuotas[0].slice(0, 7) : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const ultimo = new Date(+mesPP.slice(0, 4), +mesPP.slice(5, 7), 0).getDate();
  const dias = Array.from({ length: ultimo }, (_, k) => `${mesPP}-${String(k + 1).padStart(2, '0')}`);
  const ad = k => porDia.get(dias[k]) || n0();
  barrasApiladas('gPPDia', dias.map(fDia), PP_ESTADOS.map(([t, k, c]) => ({ t, c, v: dias.map(d => porDia.get(d)?.[k] || null) })), {
    todas: true,
    etiqueta: c => { const a = ad(c.dataIndex), k = PP_ESTADOS[c.datasetIndex][1]; return `${c.dataset.label}: ${fN(a[k])} créditos · ${fM(a.s[k] || 0)} · ${fP(pct(a[k], a.n))} del día`; },
    extra: it => { const a = ad(it[0].dataIndex); return a.n ? [`Total del día: ${fN(a.n)} créditos · ${fM(a.spag)} saldo pagaré`, `${fP(pct(a.n, tot.n))} de las primeras cuotas del mes`] : ['Sin primeras cuotas este día']; },
    clic: (k, g) => (porDia.has(dias[k]) ? (g == null ? { primera_cuota: dias[k] } : { primera_cuota: dias[k], estado_primer_pago: PP_ESTADOS[g][0] }) : null),
  });
  // en saldo pagaré: saldo en mora ÷ saldo de las primeras cuotas ya vencidas (grupos con 5 o más cuentas vencidas)
  const sVenc = a => a.spag - (a.s.porvencer || 0);
  const r = [...agrupar(D, idx, vp, n0, sm).entries()].filter(([, a]) => a.venc >= 5).sort((a, b) => sVenc(b[1]) - sVenc(a[1])).slice(0, 15)
    .map(([k, a]) => [k, pct(a.s.mora || 0, sVenc(a)), a]).sort((a, b) => b[1] - a[1]);
  barrasSimples('gPPDim', r.map(x => vp === 'mes_desembolso' ? fMes(x[0]) : x[0]), r.map(x => x[1]), {
    color: SERIE[2], fmt: fP,
    extra: it => { const a = r[it[0].dataIndex][2]; return [`Saldo pagaré en mora ${fM(a.s.mora || 0)} de ${fM(sVenc(a))} vencido`, `${fN(a.mora)} de ${fN(a.venc)} cuentas vencidas en mora`, `${fP(pct(sVenc(a), tot.spag - (tot.s.porvencer || 0)))} del saldo vencido total`]; },
    clic: k => ({ [vp]: r[k][0] }),
  });
  if (D.dic.rg_gestor) reglasFPD(D, idx);
  if (veTablas() && D.dic.nombre_deudor) detalleMoraPP(D, idx);
  if (D.dic.int_estado) intensidadPP(D, idx);
  const tp = S.verPor.tabla_primeros_pagos || 'promotor';
  tabla('Detalle de primeros pagos', DIMS_VER_POR.filter(d => D.dic[d]).map(d => [d, DIM[d]]), tp, [
    { t: 'Créditos', v: a => a.n, f: fN }, { t: 'Vencidos', v: a => a.venc, f: fN }, { t: 'Pagaron', v: a => a.pago, f: fN },
    { t: 'En mora', v: a => a.mora, f: fN }, { t: 'Sin pago registrado', v: a => a.sinpago, f: fN }, { t: 'Por vencer', v: a => a.porvencer, f: fN },
    { t: '% mora s/ vencidos', v: a => pct(a.mora, a.venc), f: fP, alerta: a => a.venc >= 5 && pct(a.mora, a.venc) > pct(tot.mora, tot.venc) * 1.5 },
  ], agrupar(D, idx, tp, n0, sm), tot);
}


// Cuentas en 1PD cuya gestión no alcanza el mínimo que tuvieron las cuentas que pagaron por gestión de cobro
function intensidadPP(D, idx) {
  const P = D.intensidad_param || {}, vp = S.verPor.pp_int || 'promotor';
  const evaluadas = idx.filter(i => ['Gestión efectiva', 'Gestión insuficiente'].includes(dv(D, 'int_estado', i)));
  const tiene = (i, t) => (dv(D, 'int_motivo', i) || '').includes(t);
  const nuevo = () => ({ n: 0, ef: 0, ins: 0, s: 0, sIns: 0, sinG: 0, sinT: 0, ritmo: 0, dias: 0 });
  const suma = (a, i) => {
    const w = mv(D, 'saldopagare', i), ins = dv(D, 'int_estado', i) === 'Gestión insuficiente';
    a.n++; a.s += w; if (ins) { a.ins++; a.sIns += w; } else a.ef++;
    if (tiene(i, 'Sin gestión')) a.sinG++; if (tiene(i, 'Sin contacto')) a.sinT++; if (tiene(i, 'Ritmo bajo')) a.ritmo++; if (tiene(i, 'días hábiles sin gestión')) a.dias++;
  };
  const tot = nuevo(); evaluadas.forEach(i => suma(tot, i));
  const g = agrupar(D, evaluadas, vp, nuevo, suma);
  const n1 = v => (v == null ? '—' : fDec(v, 1));
  $('ppIntNota').innerHTML = `Cuentas en 1PD al corte (sin Convenio). <b>Parámetro</b>: de las cuentas que cayeron en 1PD en los 12 meses anteriores y pagaron con gestión de cobro (${fN(P.n)}), la mitad pagó a más tardar el día hábil ${n1(P.med_dia_pago)} de mora con ${n1(P.med_gest)} gestiones, ${n1(P.med_contactos)} contactos y ${n1(P.med_rpc)} RPC (3 de cada 4: hasta ${n1(P.p75_gest)} gestiones, ${n1(P.p75_contactos)} contactos y ${n1(P.p75_rpc)} RPC). `
    + `<b>Mínimo exigido</b>: ${n1(P.ritmo_min)} gestiones de gestor por día hábil en mora; desde el día ${P.dias_min ?? 3}, ${P.contactos_min ?? 2} contactos y ${P.rpc_min ?? 1} RPC con el titular; y no pasar 2 días hábiles sin gestión salvo que haya una promesa vigente. SMS y predictivo no cuentan como gestión.`;
  const filasT = [...g.entries()].sort((a, b) => b[1].ins - a[1].ins || b[1].n - a[1].n);
  const fila = (k, a, cls = '') => `<tr class="${cls}"><td>${esc(vp === 'mes_desembolso' && k !== 'Total' ? fMes(k) : k)}</td><td class="num">${fN(a.n)}</td><td class="num">${fN(a.ef)}</td><td class="num">${fN(a.ins)}</td>`
    + `<td class="num${a.n >= 3 && pct(a.ins, a.n) > pct(tot.ins, tot.n) * 1.25 ? ' alerta' : ''}">${fP(pct(a.ins, a.n))}</td><td class="num">${fM(a.sIns)}</td><td class="num">${fN(a.sinG)}</td><td class="num">${fN(a.sinT)}</td><td class="num">${fN(a.ritmo)}</td><td class="num">${fN(a.dias)}</td></tr>`;
  $('ppInt').innerHTML = `<table><thead><tr><th>${esc(DIM[vp] || vp)}</th><th class="num">Cuentas en 1PD</th><th class="num">Gestión efectiva</th><th class="num">Gestión insuficiente</th><th class="num">% insuficiente</th><th class="num">Saldo pagaré insuficiente</th><th class="num">Sin gestión</th><th class="num">Sin contacto con el titular</th><th class="num">Ritmo bajo</th><th class="num">2+ días sin gestión</th></tr></thead><tbody>`
    + filasT.map(([k, a]) => fila(k, a)).join('') + (evaluadas.length ? fila('Total', tot, 'total') : '<tr><td colspan="10">Sin cuentas en 1PD con los filtros aplicados.</td></tr>') + '</tbody></table>';
  if (!$('ppIntLista')) return;
  const L = evaluadas.filter(i => dv(D, 'int_estado', i) === 'Gestión insuficiente')
    .sort((a, b) => String(dv(D, 'int_prioridad', a)).localeCompare(String(dv(D, 'int_prioridad', b))) || mv(D, 'saldopagare', b) - mv(D, 'saldopagare', a));
  const v = (c, i) => esc(dv(D, c, i) ?? '');
  $('ppIntLista').innerHTML = `<table><thead><tr><th>Prioridad</th><th>Crédito</th><th>Sucursal</th><th>Promotor</th><th>Gestor de cobro</th><th>Producto</th><th>Vence</th><th class="num">Saldo pagaré</th><th class="num">Días hábiles en mora</th><th class="num">Gestiones en mora</th><th class="num">Gestiones día vencimiento</th><th class="num">Contactos</th><th class="num">RPC</th><th>Promesa vigente</th><th>Motivo</th></tr></thead><tbody>`
    + L.map(i => `<tr><td>${v('int_prioridad', i)}</td><td>${v('credito', i)}</td><td>${v('sucursal', i)}</td><td>${v('promotor', i)}</td><td>${v('int_gestor', i)}</td><td>${v('producto_comercial', i)}</td><td>${fDia(dv(D, 'primera_cuota', i) || '')}</td>`
      + `<td class="num">${fN(mv(D, 'saldopagare', i))}</td><td class="num">${fN(mv(D, 'int_dias', i))}</td><td class="num">${fN(mv(D, 'int_gest', i))}</td><td class="num">${fN(mv(D, 'int_gdv', i))}</td><td class="num">${fN(mv(D, 'int_con', i))}</td><td class="num">${fN(mv(D, 'int_rpc', i))}</td>`
      + `<td>${dv(D, 'int_prom_vig', i) === 'Sí' ? `Sí (${fDia(dv(D, 'int_fprom', i))})` : 'No'}</td><td class="motivo">${v('int_motivo', i)}</td></tr>`).join('')
    + (L.length ? '' : '<tr><td colspan="15">Ninguna cuenta con gestión insuficiente con los filtros aplicados.</td></tr>') + '</tbody></table>';
}

function detalleMoraPP(D, idx) {
  const L = idx.filter(i => ['En mora', 'Vencida sin pago registrado'].includes(dv(D, 'estado_primer_pago', i)))
    .sort((a, b) => mv(D, 'saldopagare', b) - mv(D, 'saldopagare', a));
  const tot = L.reduce((s, i) => s + mv(D, 'saldopagare', i), 0);
  $('ppMoraNota').textContent = `${fN(L.length)} cuentas · saldo pagaré ${fM(tot)} · ordenadas por saldo pagaré. Con los filtros aplicados; «Descargar data» baja la lista completa.`;
  const v = (c, i) => esc(dv(D, c, i) ?? '');
  $('ppMora').innerHTML = `<table><thead><tr><th>Sucursal</th><th>Crédito</th><th>Desembolso</th><th>Promotor</th><th>Cliente</th><th class="num">Días mora</th><th>Producto</th><th class="num">Saldo pagaré</th><th class="num">Valor cuota</th><th class="num">Recaudo total</th><th>Teléfono</th><th>Fecha promesa</th><th>Cargo</th></tr></thead><tbody>`
    + L.slice(0, 500).map(i => `<tr><td>${v('sucursal', i)}</td><td>${v('credito', i)}</td><td>${fDia(dv(D, 'f_desembolso', i) || '')}</td><td>${v('promotor', i)}</td><td>${v('nombre_deudor', i)}</td>`
      + `<td class="num">${fN(mv(D, 'dias_mora', i))}</td><td>${v('producto_comercial', i)}</td><td class="num">${fN(mv(D, 'saldopagare', i))}</td><td class="num">${fN(mv(D, 'valor_cuota', i))}</td>`
      + `<td class="num">${D.datos.recaudo_total?.[i] == null ? '' : fN(D.datos.recaudo_total[i])}</td><td>${v('telefono', i)}</td><td>${dv(D, 'f_promesa', i) ? fDia(dv(D, 'f_promesa', i)) : ''}</td><td>${v('cargo', i)}</td></tr>`).join('')
    + (L.length > 500 ? `<tr><td colspan="13">Se muestran las 500 de mayor saldo; la descarga trae todas.</td></tr>` : '') + (L.length ? '' : '<tr><td colspan="13">Sin cuentas en mora con los filtros aplicados.</td></tr>') + '</tbody></table>';
}
// Reglas de cobro FPD (documento REGLAS DE COBRO FPD): las mide el proceso por crédito; aquí se cuentan con los filtros
const REGLAS_FPD = [['rg_predictivo', 'Predictivo Wolkvox (día 0 a 2)'], ['rg_fila', 'Fila MCC: llamada al cliente (día 1 a 2)'],
  ['rg_gestor', 'Alguna gestión de gestor desde el día 1'], ['rg_referencias', 'Referencias desde el día 5 de mora'],
  ['rg_visita', 'Visita de campo (saldo ≥ C$12,000)']];
function reglasFPD(D, idx) {
  const c = REGLAS_FPD.map(() => ({ si: 0, no: 0, sSi: 0, sNo: 0 }));
  let mora = 0;
  for (const i of idx) {
    if (dv(D, 'fpd_estado', i) === 'Entró en mora') mora++;
    REGLAS_FPD.forEach(([k], j) => { const v = dv(D, k, i); const s = mv(D, 'saldo_doc', i); if (v === 'Cumple') { c[j].si++; c[j].sSi += s; } else if (v === 'No cumple') { c[j].no++; c[j].sNo += s; } });
  }
  const etq = REGLAS_FPD.map(([, t], j) => `${t} · ${fN(c[j].si + c[j].no)} créditos`);
  barrasApiladas('gPPReglas', etq, [
    { t: 'Cumple', c: SERIE[0], v: c.map(x => pct(x.si, x.si + x.no)) },
    { t: 'No cumple', c: SERIE[2], v: c.map(x => pct(x.no, x.si + x.no)) },
  ], {
    horizontal: true, cien: true,
    etiqueta: x => { const a = c[x.dataIndex], si = x.datasetIndex === 0; return `${x.dataset.label}: ${fP(x.raw)} · ${fN(si ? a.si : a.no)} créditos · saldo ${fM(si ? a.sSi : a.sNo)}`; },
    extra: () => [`${fN(mora)} créditos FPD entraron en mora (con los filtros aplicados)`, 'SMS y Blaster no se miden: MCCollect no los registra a diario.'],
    clic: (k, g) => (g == null ? null : { [REGLAS_FPD[k][0]]: g === 0 ? 'Cumple' : 'No cumple' }),
  });
}

// ---------- Pestaña Primeros Pagos – Seguimiento (enfoque del Informe 1PD, con reglas de cobro) ----------
// Una fila por cuota 1PD (primera cuota) de los últimos 13 meses; cada indicador viene medido "a la misma fecha"
// (prefijo d_: el día del mes de hoy) y "al cierre" (prefijo c_: fin de mes, indicador oficial). Filtros y clic aplican.
const SEG_IND = [
  { g: 'Resultado', id: 'inc', d: 'Saldo pagaré de las cuotas que al corte tienen 1 o más cuotas vencidas en MCCollect ÷ saldo pagaré de las cuotas del mes ya vencidas. Al cierre es el indicador oficial (foto del día 1 del mes siguiente).', t: 'Incumplimiento 1PD (indicador oficial)', r: ['pd'], mejor: 'bajo', f: fP },
  { g: 'Resultado', id: 'm5', d: 'Se toman las cuotas que ya cumplieron 6 días hábiles (lunes a sábado, sin feriados) desde su vencimiento. Es el % que seguía con cuota vencida el 6.º día hábil, es decir, después de 5 días hábiles completos en mora. Se compara igual en todos los meses.', t: 'Mora a 5 días hábiles del vencimiento', r: ['m5'], mejor: 'bajo', f: fP },
  { g: 'Oportunidad', id: 'prev', d: '% de las cuotas vencidas que recibieron al menos una gestión de un gestor (llamada, WhatsApp o visita; no cuentan SMS ni predictivo) en los 3 días hábiles anteriores a su vencimiento.', t: 'Gestión preventiva (3 días hábiles previos)', r: ['prev'], mejor: 'alto', f: fP },
  { g: 'Oportunidad', id: 'm1', d: '% de las cuotas vencidas que el primer día hábil después del vencimiento todavía tenían la cuota vencida (no pagaron a tiempo).', t: 'En mora el primer día hábil después del vencimiento', r: ['m1'], mejor: 'bajo', f: fP },
  { g: 'Oportunidad', id: 'gd1', d: 'De las cuentas en mora el primer día hábil, % que recibió una gestión de gestor ese mismo día.', t: 'Gestionadas el primer día hábil de mora', r: ['gd1'], mejor: 'alto', f: fP },
  { g: 'Oportunidad', id: 'tel12', d: 'De las cuentas en mora el primer día hábil, % que recibió una gestión telefónica de gestor (llamada o WhatsApp) en el día hábil 1 o 2 de mora.', t: 'Llamada en los 2 primeros días hábiles de mora', r: ['tel12'], mejor: 'alto', f: fP },
  { g: 'Oportunidad', id: 'pago2', d: 'De las cuentas en mora el primer día hábil, % que ya no tenía cuota vencida el 3.er día hábil (pagaron a más tardar el 2.º día hábil de mora).', t: 'Salen de mora a más tardar el 2.º día hábil', r: ['pago2'], mejor: 'alto', f: fP },
  { g: 'Cobertura en mora', id: 'kpi2', d: 'Se cuentan los días hábiles que cada cuenta pasó en mora (hasta 15) SIN una promesa de pago vigente. De esos días, % en que la cuenta recibió 2 o más gestiones de gestor. Es la meta de intensidad: 2 gestiones por día en mora.', t: 'KPI 2 gestiones/día en mora sin promesa', c: ['dsp2', 'dsp'], mejor: 'alto', f: fP, pct: true },
  { g: 'Cobertura en mora', id: 'singc', d: 'Saldo pagaré de las cuentas que estuvieron en mora y no recibieron ninguna gestión de gestor mientras estaban en mora (días hábiles 1 a 15).', t: 'Cuentas en mora sin ninguna gestión', n: 'sing', mejor: 'bajo' },
  { g: 'Cobertura en mora', id: 'gxc', d: 'Gestiones de gestor hechas mientras la cuenta estaba en mora (días hábiles 1 a 15) ÷ cuentas en mora (ponderado por saldo pagaré).', t: 'Gestiones de cobro por cuenta en mora', c: ['gm', 'm1c'], mejor: 'alto', f: v => fDec(v, 1) },
  { g: 'Promesas', id: 'pxc', d: 'Promesas de pago registradas mientras la cuenta estaba en mora ÷ cuentas en mora (ponderado por saldo pagaré).', t: 'Promesas por cuenta en mora', c: ['prn', 'm1c'], mejor: 'alto', f: v => fDec(v, 1) },
  { g: 'Promesas', id: 'plazo', d: 'Días hábiles promedio entre el día en que se registra la promesa y la fecha prometida.', t: 'Plazo promedio de la promesa (días hábiles)', c: ['prplazo', 'prn'], sinPeso: true, mejor: 'bajo', f: v => fDec(v, 1) },
  { g: 'Promesas', id: 'cumple', d: 'De las promesas cuya fecha ya pasó, % en que hubo un pago entre el día de la gestión y la fecha prometida + 1 día hábil (pagos según MCCollect).', t: 'Promesas cumplidas', c: ['prok', 'prev_n'], mejor: 'alto', f: fP, pct: true },
  { g: 'Promesas', id: 'gact', d: 'Gestiones de gestor por día en los días en que la cuenta tenía una promesa vigente (en esos días no se espera insistir).', t: 'Gestiones por día con promesa activa', c: ['gca', 'dca'], sinPeso: true, mejor: 'alto', f: v => fDec(v, 1) },
  { g: 'Visitas y riesgo', id: 'vis', d: 'Cantidad de cuentas con al menos una visita de campo (Visita Cliente Domicilio) mientras estaban en mora.', t: 'Visitas físicas en mora (cuentas)', vis: true, mejor: 'alto' },
  { g: 'Visitas y riesgo', id: 'visrpc', d: 'De las visitas de campo en mora, % en que se habló con el titular (RPC).', t: 'Visitas con contacto del titular', c: ['visrpc', 'visg'], sinPeso: true, mejor: 'alto', f: fP, pct: true },
  { g: 'Visitas y riesgo', id: 'sintel', d: 'De las cuentas en 1PD al corte, % que nunca tuvo contacto telefónico con el titular (RPC) desde 12 días antes del vencimiento.', t: 'Incumplidas sin contacto telefónico con el titular', r: ['sintel'], mejor: 'bajo', f: fP },
  { g: 'Reglas de cobro FPD', id: 'r_pred', d: 'Regla: predictivo Wolkvox el día del vencimiento o en los 2 días siguientes. % de las cuentas en mora al día siguiente del vencimiento que la cumplen.', t: 'Predictivo Wolkvox (día 0 a 2)', r: ['r_pred'], mejor: 'alto', f: fP },
  { g: 'Reglas de cobro FPD', id: 'r_fila', d: 'Regla: fila de MC Collect con llamada al número principal del cliente en el día 1 o 2 de mora (días calendario).', t: 'Fila MCC: llamada al cliente (día 1 a 2)', r: ['r_fila'], mejor: 'alto', f: fP },
  { g: 'Reglas de cobro FPD', id: 'r_gestor', d: 'Regla: alguna llamada o WhatsApp de un gestor desde el día 1 de mora hasta el corte.', t: 'Alguna gestión de gestor desde el día 1', r: ['r_gestor'], mejor: 'alto', f: fP },
  { g: 'Reglas de cobro FPD', id: 'r_ref', d: 'Regla: con 5 días de mora, gestión completa a referencias. % de las cuentas que llegaron a 5 días de mora con llamada a referencias desde ese día.', t: 'Referencias desde el día 5 de mora', r: ['r_ref'], mejor: 'alto', f: fP },
  { g: 'Reglas de cobro FPD', id: 'r_vis', d: 'Regla: visita de campo para saldo de C$12,000 o más al llegar a los días de mora del producto (Personales 10 días si vence en la 1.ª quincena, 5 en la 2.ª; PYME 3 y 2; Motos 5). % de las que aplican con visita o envío a visita.', t: 'Visita de campo (saldo ≥ C$12,000)', r: ['r_vis'], mejor: 'alto', f: fP },
];
// Términos Paga Solo (definidos por Riesgo el 25-nov-2026). Todos sobre el saldo pagaré de las cuotas ya vencidas que al
// corte no están en mora; «previa» = desde 12 días antes hasta el día del vencimiento.
const PS_TERMINOS = [
  ['p', '%PSP', 'Paga Solo Puro', 'Sin ninguna gestión (ni SMS, ni predictivo, ni gestor), ni previa ni posterior al vencimiento, y sin mora al corte. Pudo pagar antes, el propio día o después del vencimiento.', 'navy'],
  ['v', '%PSV', 'Paga Solo Vencimiento', 'Sin ninguna gestión previa ni el día del vencimiento y pagó antes o el propio día del vencimiento.', 'cielo'],
  ['s', '%PSPS', 'Paga Solo Posterior', 'Sin ninguna gestión antes de pagar (ni previa ni el día del vencimiento) y pagó después del día del vencimiento.', ''],
  ['gp', '%PSGP', 'Paga Solo Gestión Preventiva', 'Con gestión preventiva automática (SMS o predictivo) previa o el día del vencimiento, sin gestión de gestor, y pagó antes o el propio día del vencimiento.', 'naranja'],
  ['gg', '%PSGPG', 'Paga Solo Gestión Preventiva Gestor', 'Con gestión preventiva de un gestor (llamada, WhatsApp o visita) previa o el día del vencimiento y pagó antes o el propio día del vencimiento.', 'lima'],
];
SEG_IND.splice(1, 0, ...PS_TERMINOS.map(([c, t, nom, d]) => ({ g: 'Paga Solo', id: `ps_${c}`, d: `${d} % del saldo pagaré de las cuotas ya vencidas.`, t: `${t} ${nom}`, r: [`ps_${c}`], mejor: 'alto', f: fP })));
const fDec = (v, d) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('es-NI', { minimumFractionDigits: d, maximumFractionDigits: d }));
const PS_COL = ['#06255B', SERIE[1], SERIE[3], SERIE[2], SERIE[0]];
const ROD_ORDEN = ['MEJORA', 'MANTIENE', 'DESMEJORA', 'CANCELADO', 'SIN DATO'];
const ROD_COLOR = [SERIE[0], SERIE[1], SERIE[2], GRIS, '#E6E8EC'];

// Textos de la medición abierta: nPD (debe n cuotas) o mora de la cuota n (no pagó esa cuota)
function medicion(D) {
  const n = D.meta.n || 1, mc = D.meta.tipo === 'mc', U = mc ? 1 : n;
  const PD = mc ? `Mora cuota ${n}` : `${n}PD`;
  const tx = s => String(s).replace(/1PD/g, PD).replace(/1 o más cuotas vencidas/g, `${U} o más cuotas vencidas`)
    .replace(/de la primera cuota/g, n === 1 ? 'de la primera cuota' : `de la cuota ${n}`);
  return { n, mc, U, PD, tx };
}
function selectorPD(D) {
  const { n, mc } = medicion(D);
  return `<div class="segbtns"><span>${mc ? 'Cuota' : 'Ver'}</span>${(mc ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]).map(x => `<button type="button" data-segpd="${x}" class="${x === n ? 'on' : ''}">${mc ? `Cuota ${x}` : `${x}PD`}</button>`).join('')}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-segpd]');
  if (!b) return;
  if (S.tab === 'pp_mora_cuota') S.mc = +b.dataset.segpd; else S.seg.pd = +b.dataset.segpd;
  await abrir(S.tab);
});

function segAgregar(D, idx) {
  const k = S.seg.k, by = S.seg.by, col = c => D.datos[`${k}_${c}`];
  const W = D.datos.w, meses = D.meta.meses;
  const m = Object.fromEntries(meses.map(x => [x, { n: 0, w: 0, incl: 0, inclw: 0, pdn: 0, pdw: 0, r: {}, c: {}, sing: 0, singw: 0, visg: 0, visc: 0, visw: 0, m1c: 0 }]));
  const cols = new Set(['pd', ...PS_TERMINOS.map(([c]) => `ps_${c}`), 'm5', 'prev', 'm1', 'gd1', 'tel12', 'pago2', 'sintel', 'r_pred', 'r_fila', 'r_gestor', 'r_ref', 'r_vis'].filter(c => col(c)));
  const sumas = ['dsp2', 'dsp', 'dsp0', 'gm', 'prn', 'prplazo', 'prok', 'prev_n', 'gca', 'dca', 'visrpc', 'visg'];
  const C = Object.fromEntries([...cols, ...sumas, 'incl', 'sing', 'm1'].map(c => [c, col(c)]));
  for (const i of idx) {
    const a = m[dv(D, 'mes_cobro', i)]; if (!a) continue;
    const w = by === 'n' ? 1 : (W[i] || 0);
    a.n++; a.w += W[i] || 0;
    if (C.incl[i]) { a.incl++; a.inclw += W[i] || 0; }
    if (C.pd[i] === 1) { a.pdn++; a.pdw += W[i] || 0; }
    for (const c of cols) { const v = C[c][i]; if (v == null) continue; const r = a.r[c] || (a.r[c] = [0, 0]); r[0] += v * w; r[1] += w; }
    for (const c of sumas) { const v = C[c][i]; if (v == null) continue; const r = a.c[c] || (a.c[c] = [0, 0]); r[0] += v * w; r[1] += v; }
    if (C.m1[i] === 1) a.m1c += w;
    if (C.sing[i] === 1) { a.sing++; a.singw += W[i] || 0; }
    const vg = C.visg[i]; if (vg) { a.visg += vg; a.visc++; a.visw += W[i] || 0; }
  }
  return m;
}

function segValor(I, a) {
  if (!a) return null;
  if (I.r) { const r = a.r[I.r[0]]; return r && r[1] ? (100 * r[0]) / r[1] : null; }
  if (I.c) {
    const [nu, de] = I.c, pick = c => (c === 'm1c' ? a.m1c : (a.c[c] || [0, 0])[I.sinPeso ? 1 : 0]);
    const den = pick(de); return den ? (I.pct ? 100 : 1) * pick(nu) / den : null;
  }
  if (I.n) return S.seg.by === 'n' ? a.sing : a.singw;
  if (I.vis) return a.visc;
  return null;
}
const segFmt = I => (I.f || (I.n ? fM : fN));

function pintarSeguimiento(D) {
  S.seg.by = 'w';   // la gerencia de riesgo lo mira en saldo pagaré
  const { n: nPD, mc, U, PD, tx } = medicion(D);
  const conReglas = !!D.datos[`${S.seg.k}_r_pred`];
  const INDS = SEG_IND.filter(I => !(I.r || []).some(c => !D.datos[`${S.seg.k}_${c}`]));
  const meses = D.meta.meses, actual = meses[meses.length - 1], cerrados = meses.slice(0, -1);
  const idx = filas(D, filtrosActivos());
  const A = segAgregar(D, idx);
  const k = S.seg.k, corte = m => D.meta.cortes[m][k === 'd' ? 'dia' : 'cierre'];
  const mesSel = S.seg.mes && meses.includes(S.seg.mes) ? S.seg.mes : actual;
  const dHoy = +D.meta.hoy.slice(8);
  $('segCtl').hidden = false;
  $('segCtl').innerHTML = selectorPD(D) + `<div class="segbtns"><span>Medir cada mes</span>`
    + `<button type="button" data-segk="d" class="${k === 'd' ? 'on' : ''}">A la misma fecha (día ${dHoy})</button>`
    + `<button type="button" data-segk="c" class="${k === 'c' ? 'on' : ''}">Al cierre del mes</button></div>`
    + `<label class="small segmes">Mes del detalle <select id="segMes">${meses.slice().reverse().map(m => `<option value="${m}"${m === (S.seg.mes || actual) ? ' selected' : ''}>${fMes(m)}${m === actual ? '*' : ''}</option>`).join('')}</select></label>`
    + `<span class="small muted">${mc ? `Mora de la cuota ${nPD}: cuentas que no pagaron su cuota ${nPD} (1 o más cuotas vencidas), aunque hayan pagado las anteriores. ` : nPD > 1 ? `${nPD}PD: cuentas que no han pagado ninguna de sus primeras ${nPD} cuotas (${nPD} o más cuotas vencidas). ` : ''}Todo en saldo pagaré. Fotos: MCCollect ${fDia(D.meta.foto_mccollect)} · Cendoc ${fDia(D.meta.foto_cendoc)} · ${fMes(actual)} medido a hoy en las dos opciones. Tarjetas: <b class="ok-txt">verde</b> = igual o mejor que el promedio de los 12 meses anteriores al mismo corte; <b class="alerta-txt">rojo</b> = peor.</span>`;

  const prom = I => { const v = cerrados.map(m => segValor(I, A[m])).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const peor = (I, v, ref) => v != null && ref != null && (I.mejor === 'bajo' ? v > ref : v < ref);
  const ind = id => SEG_IND.find(x => x.id === id);
  const kp = (id, l) => {
    const I = ind(id), v = segValor(I, A[actual]), ref = prom(I);
    return [l, segFmt(I)(v), `promedio ${cerrados.length} meses al mismo corte: ${segFmt(I)(ref)} · ${peor(I, v, ref) ? 'peor' : 'igual o mejor'}`, peor(I, v, ref) ? 'rojo' : 'verde'];
  };
  kpis([
    kp('inc', `${PD} ${fMes(actual)} (al ${fDia(D.meta.hoy)})`), kp('m5', 'Mora a 5 días hábiles'),
    kp('gd1', 'Gestionadas el 1.er día de mora'), D.datos[`${k}_ps_p`] ? kp('ps_p', '%PSP Paga Solo Puro') : kp('m1', 'En mora el 1.er día hábil'),
    kp('cumple', 'Promesas cumplidas'), conReglas ? kp('r_gestor', 'Regla: gestión de gestor') : kp('pago2', 'Salen de mora al 2.º día hábil'),
  ]);

  const etiq = meses.map(m => fMes(m) + (m === actual ? '*' : ''));
  const colores = I => meses.map(m => { const v = segValor(I, A[m]), ref = prom(I); return m === actual ? (peor(I, v, ref) ? '#EE232E' : SERIE[1]) : peor(I, v, ref) ? SERIE[2] : SERIE[1]; });
  const nota = k === 'd' ? `Cada mes medido a su día ${dHoy}` : 'Cada mes medido a su cierre';
  const psTiles = !D.datos[`${k}_ps_p`] ? '' : `<article class="graf ancho"><div class="cab"><h3>Paga Solo · ${fMes(actual)}${'*'}</h3><span class="small muted">${nota}. % del saldo pagaré de las cuotas ya vencidas que al corte no están en mora. «Previa» = desde 12 días antes hasta el día del vencimiento. Debajo, el promedio de los ${cerrados.length} meses anteriores al mismo corte.</span></div><div class="kpis">`
    + PS_TERMINOS.map(([c, t, nom, d, color]) => { const I = ind(`ps_${c}`), v = segValor(I, A[actual]), ref = prom(I);
      return `<div class="kpi ${color}" title="${esc(d)}"><div class="l">${t} · ${nom}</div><div class="v">${fP(v)}</div><div class="s">promedio ${fP(ref)}</div></div>`; }).join('') + '</div></article>';
  $('graficos').innerHTML = psTiles + tx(
    tarjeta('gSegInc', 'Incumplimiento 1PD por mes', `${nota}: cuotas con 1 o más cuotas vencidas en la foto de MCCollect del corte, sobre las cuotas ya vencidas. Ámbar: peor que el promedio de los meses cerrados; rojo: el mes en curso peor que ese promedio.`, { ancho: true })
    + `<article class="graf ancho"><div class="cab"><h3>Embudo de cobranza de las cuentas en mora</h3><span class="small muted">Saldo pagaré de las cuentas que amanecieron en mora al día siguiente del vencimiento, según lo que lograron las gestiones desde el día 1 de mora hasta el corte. En gris, el % sobre el paso anterior.</span></div><div class="tabla-caja seg-tabla" id="segEmbudo"></div></article>`
    + tarjeta('gSegConv', '¿Un RPC más alto trae más promesas y más pago?', 'Por mes: % del saldo en mora con RPC, % del saldo con RPC que llegó a promesa, % de lo prometido que se cumplió y % del saldo en mora que salió de mora al corte.', { ancho: true, leyenda: [['Con RPC', SERIE[1]], ['Promesa sobre RPC', SERIE[2]], ['Cumplida sobre promesa', SERIE[0]], ['Salió de mora', '#06255B']] })
    + `<article class="graf ancho"><div class="cab"><h3>¿Qué canal rinde más? · ${fMes(mesSel)}${mesSel === actual ? '*' : ''}</h3><span class="small muted">Cuentas en mora (en saldo pagaré) según el canal con que se gestionaron desde el día 1 de mora. Una cuenta puede tener varios canales. «Salió de mora» compara las cuentas gestionadas por ese canal contra las que no.</span></div><div class="tabla-caja seg-tabla" id="segCanales"></div></article>`
    + `<article class="graf ancho"><div class="cab"><h3>Indicadores de gestión de la primera cuota</h3><span class="small muted">${nota}. Verde: mejor mes; rojo: peor mes cerrado; fondo ámbar: peor que el promedio; fondo rojo: mes en curso peor que el promedio.</span></div><div class="tabla-caja seg-tabla" id="segTabla"></div></article>`
    + tarjeta('gSegM5', 'Mora a 5 días hábiles', 'Comparable entre meses: cuotas con 6 días hábiles observados.', {})
    + tarjeta('gSegGd1', 'Gestionadas el primer día de mora', '% de las cuentas en mora al día siguiente del vencimiento.', {})
    + (D.datos[`${k}_ps_p`] ? tarjeta('gSegPS', 'Paga Solo por mes', 'Los cinco términos de Paga Solo sobre el saldo de las cuotas ya vencidas. Clic en un punto para filtrar el mes.', { ancho: true, leyenda: PS_TERMINOS.map(([, t, nom], j) => [`${t} ${nom}`, PS_COL[j]]) }) : '')
    + (conReglas ? tarjeta('gSegReg', 'Cumplimiento de las reglas de cobro FPD', 'Cuentas en mora que cumplen cada regla (cono de MCCollect).', { leyenda: [['Predictivo', SERIE[3]], ['Fila MCC', SERIE[1]], ['Gestión de gestor', SERIE[0]], ['Referencias', SERIE[2]], ['Visita', '#06255B']] }) : '')
    + tarjeta('gSegRod', 'Rodamiento de Cendoc a la fecha de corte', 'Cuotas 1PD ya vencidas según el rodamiento de Cendoc en la foto del corte.', { leyenda: ROD_ORDEN.map((t, j) => [t, ROD_COLOR[j]]) })
    + tarjeta('gSegCos', 'Mora a 5 días hábiles por mes de colocación', 'Mes de desembolso con 100 cuotas o más observadas a 5 días hábiles.', {})
    + tarjeta('gSegVen', `${fMes(mesSel)}${mesSel === actual ? '*' : ''} por fecha de vencimiento`, `Cuotas según el día en que vencen y cómo están al corte (${fDia(corte(mesSel))}).`, { ancho: true, leyenda: [['Al día', SERIE[0]], ['En 1PD', '#EE232E'], ['Por vencer', GRIS]] })
    + (veTablas() ? `<article class="graf ancho"><div class="cab"><h3>Cuentas en 1PD · ${fMes(mesSel)}${mesSel === actual ? '*' : ''}</h3></div><p class="nota">Gestiones desde 3 días hábiles antes del vencimiento hasta el corte. Ordenadas por vencimiento y saldo.</p><div class="tabla-caja" id="segLista"></div></article>` : ''));

  const I1 = ind('inc');
  barrasSimples('gSegInc', etiq, meses.map(m => segValor(I1, A[m])), {
    horizontal: false, fmt: fP, color: colores(I1),
    extra: it => { const a = A[meses[it[0].dataIndex]]; return [`${fN(a.pdn)} de ${fN(a.incl)} cuotas vencidas en ${PD}`, `Saldo pagaré en 1PD ${fM(a.pdw)} de ${fM(a.inclw)}`, `Corte: ${fDia(corte(meses[it[0].dataIndex]))}`]; },
    clic: j => ({ mes_cobro: meses[j] }),
  });
  for (const [id, I] of [['gSegM5', ind('m5')], ['gSegGd1', ind('gd1')], ]) {
    barrasSimples(id, etiq, meses.map(m => segValor(I, A[m])), { horizontal: false, fmt: fP, color: colores(I), extra: it => [`Promedio meses cerrados: ${fP(prom(I))}`], clic: j => ({ mes_cobro: meses[j] }) });
  }
  if (D.datos[`${k}_ps_p`]) lineas('gSegPS', etiq, PS_TERMINOS.map(([c, t, nom], j) => ({ t: `${t} ${nom}`, c: PS_COL[j], v: meses.map(m => segValor(ind(`ps_${c}`), A[m])) })), { fmt: fP, clic: j => ({ mes_cobro: meses[j] }) });
  const RG = [['r_pred', 'Predictivo', SERIE[3]], ['r_fila', 'Fila MCC', SERIE[1]], ['r_gestor', 'Gestión de gestor', SERIE[0]], ['r_ref', 'Referencias', SERIE[2]], ['r_vis', 'Visita', '#06255B']];
  if (conReglas) lineas('gSegReg', etiq, RG.map(([id, t, c]) => ({ t, c, v: meses.map(m => segValor(ind(id), A[m])) })), { fmt: fP, clic: j => ({ mes_cobro: meses[j] }) });

  // Cendoc: rodamiento al corte
  const rod = meses.map(() => Object.fromEntries(ROD_ORDEN.map(r => [r, 0])));
  const rodCol = D.datos[`${k}_rod`], incl = D.datos[`${k}_incl`];
  for (const i of idx) {
    if (!incl[i]) continue;
    const j = meses.indexOf(dv(D, 'mes_cobro', i)); if (j < 0) continue;
    let r = rodCol[i] == null ? 'SIN DATO' : D.dic[`${k}_rod`][rodCol[i]]; if (!ROD_ORDEN.includes(r)) r = 'SIN DATO';
    rod[j][r] += S.seg.by === 'n' ? 1 : D.datos.w[i] || 0;
  }
  barrasApiladas('gSegRod', etiq, ROD_ORDEN.map((r, j) => ({ t: r, c: ROD_COLOR[j], v: rod.map(x => { const t = Object.values(x).reduce((s, y) => s + y, 0); return pct(x[r], t); }) })), {
    cien: true, etiqueta: c => `${c.dataset.label}: ${fP(c.raw)} · ${S.seg.by === 'n' ? fN(rod[c.dataIndex][c.dataset.label]) + ' cuentas' : fM(rod[c.dataIndex][c.dataset.label])}`,
    clic: (j, g) => (g == null ? { mes_cobro: meses[j] } : { mes_cobro: meses[j], [`${k}_rod`]: ROD_ORDEN[g] }),
  });

  // Mora a 5 días por mes de colocación (todas las cuotas con 5 días hábiles observados)
  const m5 = D.datos[`${k}_m5`], cos = new Map();
  for (const i of idx) { const v = m5[i]; if (v == null) continue; const c = dv(D, 'mes_desembolso', i); const a = cos.get(c) || { n: 0, x: 0, w: 0, xw: 0 }; a.n++; a.x += v; a.w += D.datos.w[i] || 0; a.xw += v * (D.datos.w[i] || 0); cos.set(c, a); }
  const minCos = minimoRelativo([...cos.values()].map(a => a.n));
  const cl = [...cos.entries()].filter(([, a]) => a.n >= minCos).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const vcos = cl.map(([, a]) => (S.seg.by === 'n' ? pct(a.x, a.n) : pct(a.xw, a.w)));
  const pcos = vcos.length ? vcos.reduce((s, x) => s + x, 0) / vcos.length : null;
  barrasSimples('gSegCos', cl.map(([c]) => fMes(c)), vcos, {
    horizontal: false, fmt: fP, color: vcos.map(v => (v > pcos * 1.1 ? SERIE[2] : SERIE[1])),
    extra: it => { const a = cl[it[0].dataIndex][1]; return [`${fN(a.x)} de ${fN(a.n)} cuotas en mora a 5 días`, `Promedio ${fP(pcos)}; ámbar: más de 10% por encima`]; },
    clic: j => ({ mes_desembolso: cl[j][0] }),
  });

  // Mes seleccionado por fecha de vencimiento
  const pdC = D.datos[`${k}_pd`], ven = new Map();
  for (const i of idx) {
    if (dv(D, 'mes_cobro', i) !== mesSel) continue;
    const f = dv(D, 'dia_vence', i), a = ven.get(f) || { ok: 0, pd: 0, pv: 0, w: [0, 0, 0] }, w = D.datos.w[i] || 0;
    if (!incl[i]) { a.pv++; a.w[2] += w; } else if (pdC[i] === 1) { a.pd++; a.w[1] += w; } else { a.ok++; a.w[0] += w; }
    ven.set(f, a);
  }
  const fechasV = [...ven.keys()].sort();
  const vv = key => fechasV.map(f => (S.seg.by === 'n' ? ven.get(f)[key] : ven.get(f).w[{ ok: 0, pd: 1, pv: 2 }[key]]));
  barrasApiladas('gSegVen', fechasV.map(fDia), [{ t: 'Al día', c: SERIE[0], v: vv('ok') }, { t: `En ${PD}`, c: '#EE232E', v: vv('pd') }, { t: 'Por vencer', c: GRIS, v: vv('pv') }], {
    todas: true, fmt: S.seg.by === 'n' ? fN : fM,
    extra: it => { const a = ven.get(fechasV[it[0].dataIndex]), t = a.ok + a.pd; return [`${fN(a.pd)} en ${PD} de ${fN(t)} vencidas (${fP(pct(a.pd, t))})`]; },
    clic: j => ({ dia_vence: fechasV[j] }),
  });


  // Embudo por mes (saldo pagaré de las cuentas en mora)
  const ETAPAS = [['e_gest', 'Con alguna gestión', 'Cualquier registro en el cono: SMS, predictivo, llamada, WhatsApp o visita.'],
    ['e_int', 'Con intento', 'Gestión marcada como intento (gestionada) en el catálogo del cono.'],
    ['e_con', 'Con contacto', 'Se logró contacto con alguien (titular o tercero).'],
    ['e_rpc', 'Con RPC', 'Se habló con el titular (contacto con la persona correcta).'],
    ['e_prom', 'Con promesa de pago', 'Se registró una promesa con fecha.'],
    ['e_cump', 'Promesa cumplida', 'Hubo un pago entre la promesa y la fecha prometida + 1 día hábil.'],
    ['e_pago', 'Salió de mora al corte', 'Al corte ya no tiene cuotas vencidas (pagó).']];
  const W = D.datos.w, EM = meses.map(() => ({ base: 0 }));
  for (const i of idx) {
    const j = meses.indexOf(dv(D, 'mes_cobro', i)); if (j < 0) continue;
    if (D.datos[`${k}_e_gest`][i] == null) continue;
    const w = W[i] || 0, a = EM[j]; a.base += w;
    for (const [c] of ETAPAS) if (D.datos[`${k}_${c}`][i] === 1) a[c] = (a[c] || 0) + w;
  }
  let he = `<table><thead><tr><th>Paso</th>${etiq.map(e => `<th class="num">${e}</th>`).join('')}</tr></thead><tbody>`
    + `<tr><td>Saldo pagaré en mora (día 1)</td>${EM.map(a => `<td class="num">${fM(a.base)}</td>`).join('')}</tr>`;
  ETAPAS.forEach(([c, t, d], n) => {
    he += `<tr><td title="${esc(d)}">${t} <span class="info">ⓘ</span><div class="desc">${esc(d)}</div></td>${EM.map(a => {
      const v = a[c] || 0, prev = n === 0 || c === 'e_pago' ? a.base : a[ETAPAS[n - 1][0]] || 0;
      return `<td class="num" title="${esc(fM(v))}">${fP(pct(v, a.base))}${n && c !== 'e_pago' ? `<div class="sub">${fP(pct(v, prev))}</div>` : ''}</td>`;
    }).join('')}</tr>`;
  });
  $('segEmbudo').innerHTML = he + '</tbody></table>';
  lineas('gSegConv', etiq, [
    { t: 'Con RPC', c: SERIE[1], v: EM.map(a => pct(a.e_rpc || 0, a.base)) },
    { t: 'Promesa sobre RPC', c: SERIE[2], v: EM.map(a => pct(a.e_prom || 0, a.e_rpc || 0)) },
    { t: 'Cumplida sobre promesa', c: SERIE[0], v: EM.map(a => pct(a.e_cump || 0, a.e_prom || 0)) },
    { t: 'Salió de mora', c: '#06255B', v: EM.map(a => pct(a.e_pago || 0, a.base)) },
  ], { fmt: fP, extra: it => { const a = EM[it[0].dataIndex]; return [`Saldo en mora ${fM(a.base)} · con RPC ${fM(a.e_rpc || 0)}`, `Prometido ${fM(a.e_prom || 0)} · cumplido ${fM(a.e_cump || 0)} · salió de mora ${fM(a.e_pago || 0)}`]; }, clic: j => ({ mes_cobro: meses[j] }) });

  // Efectividad por canal en el mes elegido
  const CAN = [['sms', 'SMS'], ['wap', 'WhatsApp'], ['llam', 'Llamada de gestor'], ['pred', 'Predictivo'], ['vis', 'Visita de campo']];
  const ec = CAN.map(() => ({ u: 0, r: 0, p: 0, c: 0, pu: 0, pub: 0 }));
  const sg = { u: 0, pu: 0, pub: 0 };   // consolidado: cuentas en mora sin ninguna gestión por ningún canal
  let baseMes = 0;
  for (const i of idx) {
    if (dv(D, 'mes_cobro', i) !== mesSel || D.datos[`${k}_e_gest`][i] == null) continue;
    const w = W[i] || 0, pago = D.datos[`${k}_e_pago`][i]; baseMes += w;
    if (D.datos[`${k}_e_gest`][i] !== 1) { sg.u += w; if (pago != null) { sg.pub += w; if (pago === 1) sg.pu += w; } }
    CAN.forEach(([c], j) => {
      const u = D.datos[`${k}_k_${c}_u`][i] === 1, a = ec[j];
      if (!u) return;
      a.u += w; if (D.datos[`${k}_k_${c}_r`][i] === 1) a.r += w; if (D.datos[`${k}_k_${c}_p`][i] === 1) a.p += w; if (D.datos[`${k}_k_${c}_c`][i] === 1) a.c += w;
      if (pago != null) { a.pub += w; if (pago === 1) a.pu += w; }
    });
  }
  const refSG = pct(sg.pu, sg.pub);
  $('segCanales').innerHTML = `<table><thead><tr><th>Canal</th><th class="num">Saldo en mora gestionado</th><th class="num">% del saldo en mora</th><th class="num">RPC por este canal</th><th class="num">Promesa por este canal</th><th class="num">Promesa cumplida</th><th class="num">Salió de mora</th></tr></thead><tbody>`
    + CAN.map(([, t], j) => { const a = ec[j], v = pct(a.pu, a.pub), dif = v - refSG;
      return `<tr><td>${t}</td><td class="num">${fM(a.u)}</td><td class="num">${fP(pct(a.u, baseMes))}</td><td class="num">${fP(pct(a.r, a.u))}</td><td class="num">${fP(pct(a.p, a.u))}</td><td class="num">${fP(pct(a.c, a.p))}</td>`
        + `<td class="num ${isFinite(dif) && dif > 0 ? 'mejor' : isFinite(dif) && dif < 0 ? 'peor' : ''}">${fP(v)}</td></tr>`; }).join('')
    + `<tr class="total"><td>Sin ninguna gestión (ningún canal)</td><td class="num">${fM(sg.u)}</td><td class="num">${fP(pct(sg.u, baseMes))}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${fP(refSG)}</td></tr>`
    + `</tbody></table><p class="small muted">Cada canal se mide solo sobre las cuentas que gestionó; una cuenta con varios canales aparece en cada uno. La última fila es un solo dato consolidado: cuentas en mora que no recibieron ninguna gestión por ningún canal, y sirve de comparación (verde: el canal sale de mora más que las no gestionadas; rojo: menos). SMS y predictivo no registran conversación (sin RPC ni promesa). Las cuentas más difíciles reciben más canales (visita, predictivo), por eso su % puede ser menor sin que el canal empeore el pago.</p>`;

  // Tabla de indicadores
  let html = `<table><thead><tr><th>Indicador</th>${etiq.map(e => `<th class="num">${e}</th>`).join('')}<th class="num">Promedio cerrados</th></tr></thead><tbody>`;
  let grupo = '';
  for (const I of INDS) {
    if (I.g !== grupo) { grupo = I.g; html += `<tr class="grupo"><td colspan="${meses.length + 2}">${grupo}</td></tr>`; }
    const vals = meses.map(m => segValor(I, A[m])), ref = prom(I), cer = vals.slice(0, -1).filter(v => v != null);
    const mejorV = cer.length ? (I.mejor === 'bajo' ? Math.min(...cer) : Math.max(...cer)) : null;
    const peorV = cer.length ? (I.mejor === 'bajo' ? Math.max(...cer) : Math.min(...cer)) : null;
    const f = segFmt(I);
    html += `<tr><td title="${esc(I.d || '')}">${I.t} <span class="info">ⓘ</span><div class="desc">${esc(I.d || '')}</div></td>${vals.map((v, j) => {
      const cur = j === meses.length - 1, cls = [];
      if (v != null && !cur && v === mejorV) cls.push('mejor'); else if (v != null && !cur && v === peorV) cls.push('peor');
      if (peor(I, v, ref)) cls.push(cur ? 'fondo-rojo' : 'fondo-ambar');
      return `<td class="num ${cls.join(' ')}">${v == null ? '—' : f(v)}</td>`;
    }).join('')}<td class="num tot">${ref == null ? '—' : f(ref)}</td></tr>`;
  }
  html += `<tr class="grupo"><td colspan="${meses.length + 2}">Base</td></tr>`
    + `<tr><td>Saldo pagaré de las cuotas ya vencidas al corte</td>${meses.map(m => `<td class="num">${S.seg.by === 'n' ? fN(A[m].incl) : fM(A[m].inclw)}</td>`).join('')}<td></td></tr>`
    + `<tr><td>Saldo pagaré en 1PD al corte</td>${meses.map(m => `<td class="num">${S.seg.by === 'n' ? fN(A[m].pdn) : fM(A[m].pdw)}</td>`).join('')}<td></td></tr>`
    + `<tr><td>Fecha de corte</td>${meses.map(m => `<td class="num">${fDia(corte(m))}</td>`).join('')}<td></td></tr>`;
  $('segTabla').innerHTML = tx(html + '</tbody></table>');

  // Lista de cuentas en 1PD del mes elegido
  if (veTablas()) {
    const L = [];
    for (const i of idx) if (dv(D, 'mes_cobro', i) === mesSel && pdC[i] === 1) L.push(i);
    L.sort((a, b) => String(dv(D, 'dia_vence', a)).localeCompare(String(dv(D, 'dia_vence', b))) || (D.datos.w[b] || 0) - (D.datos.w[a] || 0));
    const g = c => D.datos[`${k}_${c}`];
    $('segLista').innerHTML = `<table><thead><tr><th>Cuenta</th><th>Vence</th><th>Colocación</th><th>Producto</th><th>Sucursal</th><th class="num">Saldo pagaré</th><th class="num">Cuotas vencidas</th><th class="num">Gestiones</th><th class="num">Promesas</th><th class="num">Visitas</th><th>Contacto titular</th><th>Rodamiento</th></tr></thead><tbody>`
      + L.map(i => `<tr><td>${esc(dv(D, 'credito', i))}</td><td>${fDia(dv(D, 'dia_vence', i))}</td><td>${fMes(dv(D, 'mes_desembolso', i))}</td><td>${esc(dv(D, 'producto_comercial', i))}</td><td>${esc(dv(D, 'sucursal', i))}</td>`
        + `<td class="num">${fN(D.datos.w[i])}</td><td class="num">${fN(g('cv')[i])}</td><td class="num">${fN(g('ng')[i])}</td><td class="num">${fN(g('nprom')[i])}</td><td class="num">${fN(g('nvis')[i])}</td><td>${g('rpc')[i] ? 'Sí' : '<b class="alerta-txt">No</b>'}</td><td>${esc(dv(D, `${k}_rod`, i) || '')}</td></tr>`).join('')
      + (L.length ? '' : '<tr><td colspan="12">Sin cuentas en 1PD con los filtros aplicados.</td></tr>') + '</tbody></table>';
  }
}


// ---------- Pestaña Primeros Pagos – Cosecha: el 1PD de cada mes de desembolso, según el mes en que cicla su primera cuota ----------
// Cosechas con muy pocas cuotas (colas de meses viejos) se ocultan; el mínimo es relativo a la cosecha más grande
// para que con filtros chicos (p. ej. PYME) no desaparezca todo.
function minimoRelativo(ns) {
  return Math.max(1, Math.ceil(0.05 * Math.max(0, ...ns)));
}

const sumaMes = (m, k) => { const [a, b] = m.split('-').map(Number), t = a * 12 + (b - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const difMes = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y1 - y2) * 12 + (m1 - m2); };
// Semáforo por columna (verde = mejor de la columna, rojo = peor), como la tabla de PD's del Power BI
function calor(v, min, max) {
  if (v == null || !isFinite(v) || max <= min) return '';
  const t = Math.min(1, Math.max(0, (v - min) / (max - min)));
  const mezcla = (c1, c2, x) => c1.map((c, i) => Math.round(c + (c2[i] - c) * x));
  const c = t < 0.5 ? mezcla([183, 221, 160], [250, 226, 140], t * 2) : mezcla([250, 226, 140], [240, 128, 128], (t - 0.5) * 2);
  return `background:rgb(${c.join(',')}) !important`;
}

function pintarCosecha1PD(D) {
  const meses = D.meta.meses, actual = meses[meses.length - 1], k = S.seg.k, dHoy = +D.meta.hoy.slice(8);
  const { n: nPD, PD } = medicion(D);
  const idx = filas(D, filtrosActivos());
  $('segCtl').hidden = false;
  $('segCtl').innerHTML = selectorPD(D) + `<div class="segbtns"><span>Medir cada mes de cobro</span>`
    + `<button type="button" data-segk="d" class="${k === 'd' ? 'on' : ''}">A la misma fecha (día ${dHoy})</button>`
    + `<button type="button" data-segk="c" class="${k === 'c' ? 'on' : ''}">Al cierre del mes</button></div>`
    + `<span class="small muted">Todo en saldo pagaré. nPD = no ha pagado ninguna de sus primeras n cuotas. El selector cambia el embudo, los cortes y la intensidad; la tabla de PD's muestra los seis.</span>`;
  const W = D.datos.w, incl = D.datos[`${k}_incl`], pdc = D.datos[`${k}_pd`];

  // ---- Tabla de PD's por cosecha (1PD a 6PD): una fila por crédito con su marca en cada cuota
  const P = D.pds, ip = P ? filas(P, filtrosActivos()) : [], M0 = (P?.meta?.meses || meses)[0];
  const T = new Map();
  for (const i of ip) {
    const c = dv(P, 'mes_desembolso', i); if (!c || c === 'SIN DATO') continue;
    const a = T.get(c) || { n: 0, w: 0, i: Array(7).fill(0), p: Array(7).fill(0), s: Array(7).fill(0) }; T.set(c, a);
    const w = P.datos.w[i] || 0; a.n++; a.w += w;
    for (let x = 1; x <= 6; x++) if (P.datos[`${k}${x}_i`]?.[i] === 1) { a.i[x] += w; if (P.datos[`${k}${x}_p`][i] === 1) a.p[x] += w; if (P.datos[`${k}${x}_${S.seg.ps || 'p'}`]?.[i] === 1) a.s[x] += w; }
  }
  // una cosecha solo muestra el xPD si todas sus cuotas x caen dentro de los 13 meses con fotos diarias
  const completa = (c, x) => difMes(sumaMes(c, x - 1), M0) >= 0;
  const cosPD = [...T.keys()].filter(c => completa(c, 6)).filter(c => T.get(c).n >= minimoRelativo([...T.values()].map(a => a.n))).sort();
  const valPD = (c, x) => { const a = T.get(c); return completa(c, x) && a.i[x] ? pct(a.p[x], a.i[x]) : null; };
  const rango = [0, 1, 2, 3, 4, 5, 6].map(x => { const v = cosPD.map(c => valPD(c, x)).filter(y => y != null); return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; });
  const conSolo = !!P?.datos?.[`${k}1_p`], PSel = PS_TERMINOS.find(x => x[0] === (S.seg.ps || 'p'));
  const valSolo = (c, x) => { const a = T.get(c); return completa(c, x) && a.i[x] ? pct(a.s[x], a.i[x]) : null; };
  const rangoS = [0, 1, 2, 3, 4, 5, 6].map(x => { const v = cosPD.map(c => valSolo(c, x)).filter(y => y != null); return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]; });
  const totSolo = x => { let p = 0, i = 0; for (const c of cosPD) if (completa(c, x)) { p += T.get(c).s[x]; i += T.get(c).i[x]; } return pct(p, i); };
  const totPD = x => { let p = 0, i = 0; for (const c of cosPD) if (completa(c, x)) { p += T.get(c).p[x]; i += T.get(c).i[x]; } return pct(p, i); };

  // ---- Matriz cosecha × mes de cobro del PD elegido
  const [ay, am] = meses[0].split('-').map(Number), mesPrevio = am === 1 ? `${ay - 1}-12` : `${ay}-${String(am - 1).padStart(2, '0')}`;
  const M = new Map();
  for (const i of idx) {
    const c = dv(D, 'mes_desembolso', i), m = dv(D, 'mes_cobro', i), w = W[i] || 0;
    if (!c || c === 'SIN DATO') continue;
    const fila = M.get(c) || new Map(); M.set(c, fila);
    const a = fila.get(m) || { tot: 0, venc: 0, pd: 0, n: 0, npd: 0 }; fila.set(m, a);
    a.tot += w; a.n++;
    if (incl[i]) a.venc += w;
    if (pdc[i] === 1) { a.pd += w; a.npd++; }
  }
  const sum = (fila, key) => [...fila.values()].reduce((s, a) => s + a[key], 0);
  const minCos = minimoRelativo([...M.values()].map(f => sum(f, 'n')));
  const cosechas = [...M.keys()].filter(c => sum(M.get(c), 'n') >= minCos && c >= sumaMes(mesPrevio, -(nPD - 1))).sort();
  const recientes = cosechas.slice(-12);
  kpis(recientes.slice(-4).reverse().map((c, j) => {
    const f = M.get(c), v = sum(f, 'venc'), pd = sum(f, 'pd'), t = sum(f, 'tot');
    return [`${PD} cosecha ${fMes(c)}`, fP(pct(pd, v)), `sobre lo ya vencido · ${fP(pct(t - v, t))} del saldo aún por vencer`, ['navy', 'cielo', '', 'lima'][j]];
  }));

  // ---- Corte de cobranza (definición de Riesgo): cosecha de junio → 1.er corte junio, 2.º julio, 3.º agosto;
  // para el nPD se corre n-1 meses (la cuota n vence n-1 meses después de la primera)
  const corteDe = i => { const c = dv(D, 'mes_desembolso', i), m = dv(D, 'mes_cobro', i); return c && m ? difMes(m, c) - (nPD - 1) + 1 : null; };
  const ETAPAS = [['e_gest', 'Con alguna gestión'], ['e_int', 'Con intento'], ['e_con', 'Con contacto'], ['e_rpc', 'Con RPC'],
    ['e_prom', 'Con promesa de pago'], ['e_cump', 'Promesa cumplida'], ['e_pago', 'Salió de mora al corte']];
  const EC = [1, 2, 3].map(() => new Map());
  const IN = new Map();   // cosecha|corte → intensidad
  const col = c => D.datos[`${k}_${c}`];
  for (const i of idx) {
    if (col('e_gest')[i] == null) continue;   // solo cuentas en mora el día hábil siguiente al vencimiento
    const c = dv(D, 'mes_desembolso', i), ct = corteDe(i); if (!recientes.includes(c) || !ct || ct > 3) continue;
    const w = W[i] || 0, a = EC[ct - 1].get(c) || { base: 0, mes: dv(D, 'mes_cobro', i) }; EC[ct - 1].set(c, a);
    a.base += w; for (const [e] of ETAPAS) if (col(e)[i] === 1) a[e] = (a[e] || 0) + w;
    const key = `${c}|${ct}`, b = IN.get(key) || { c, ct, mes: dv(D, 'mes_cobro', i), w: 0, n: 0, gm: 0, gmc: 0, rpc: 0, dm: 0, gmDia: 0, sing: 0, singB: 0, pago: 0, pagoB: 0 };
    IN.set(key, b);
    b.n++; b.w += w; b.gm += (col('gm')[i] || 0) * w; b.gmc += (col('gmc')?.[i] || 0) * w; if ((col('gmr')?.[i] || 0) > 0) b.rpc += w;
    b.dm += (col('dmora')[i] || 0) * w; b.gmDia += (col('gm')[i] || 0) * w;
    if (col('sing')[i] != null) { b.singB += w; if (col('sing')[i] === 1) b.sing += w; }
    if (col('e_pago')[i] != null) { b.pagoB += w; if (col('e_pago')[i] === 1) b.pago += w; }
  }

  $('graficos').innerHTML =
    `<article class="graf ancho"><div class="cab"><h3>Tabla de PD's por cosecha</h3><span class="small muted">% del saldo pagaré en 1PD a 6PD sobre el saldo de las cuotas ya vencidas (${k === 'd' ? `cada mes medido a su día ${dHoy}` : 'al cierre de cada mes'}). Verde: mejor de la columna; rojo: peor. En blanco: la cuota aún no vence o cae antes de las fotos diarias (desde ${fMes(M0)}).</span></div><div class="tabla-caja seg-tabla" id="pdsTabla"></div></article>`
    + (conSolo ? `<article class="graf ancho"><div class="cab"><h3>Paga Solo por cosecha · ${PSel[1]} ${PSel[2]}</h3><div class="segbtns"><span>Término</span>${PS_TERMINOS.map(([c, t, nom]) => `<button type="button" data-ps="${c}" title="${esc(nom)}" class="${c === PSel[0] ? 'on' : ''}">${t}</button>`).join('')}</div><span class="small muted">${esc(PSel[3])} % del saldo pagaré de las cuotas 1 a 6 ya vencidas (${k === 'd' ? `cada mes medido a su día ${dHoy}` : 'al cierre de cada mes'}). Verde: más alto de la columna; rojo: más bajo.</span></div><div class="tabla-caja seg-tabla" id="soloTabla"></div></article>` : '')
    + `<article class="graf ancho"><div class="cab"><h3>${PD} de cada cosecha según el mes en que cicla la cuota ${nPD}</h3><span class="small muted">Celda: % del saldo pagaré en ${PD} sobre el saldo de las cuotas ${nPD} ya vencidas de esa cosecha en ese mes de cobro. Debajo, el saldo que cicla ese mes. Total: el ${PD} de toda la cosecha.</span></div><div class="tabla-caja seg-tabla" id="cosTabla"></div></article>`
    + [1, 2, 3].map(ct => `<article class="graf ancho"><div class="cab"><h3>Embudo de cobranza ${PD} · corte ${ct}</h3><span class="small muted">Corte ${ct}: cuotas ${nPD} que vencen ${ct === 1 ? (nPD === 1 ? 'en el mismo mes de la cosecha' : `${nPD - 1} ${nPD === 2 ? 'mes' : 'meses'} después del mes de la cosecha`) : `${nPD - 1 + ct - 1} meses después del mes de la cosecha`} (debajo de cada cosecha, el mes de cobro). Saldo pagaré de las cuentas en mora al día hábil siguiente del vencimiento y lo que lograron las gestiones hasta el corte. En gris, el % sobre el paso anterior.</span></div><div class="tabla-caja seg-tabla" id="cosEmb${ct}"></div></article>`).join('')
    + `<article class="graf ancho"><div class="cab"><h3>Intensidad de cobro por cosecha y corte · ${PD}</h3><span class="small muted">Cuentas en mora al día hábil siguiente del vencimiento, ponderadas por saldo pagaré. Gestiones de gestor (sin SMS ni predictivo) mientras la cuenta estuvo en mora, hasta 15 días hábiles.</span></div><div class="tabla-caja seg-tabla" id="cosInt"></div></article>`
    + tarjeta('gCosInt', 'Gestiones por día hábil en mora, por cosecha y corte', 'Ritmo de gestión de gestor sobre las cuentas en mora (ponderado por saldo pagaré). Clic en una barra para filtrar la cosecha.', { ancho: true, leyenda: [['Corte 1', SERIE[1]], ['Corte 2', SERIE[2]], ['Corte 3', SERIE[0]]] });

  // Tabla de PD's
  let hp = `<table><thead><tr><th>Cosecha</th><th class="num">Cuentas</th><th class="num">Monto pagaré</th>${[1, 2, 3, 4, 5, 6].map(x => `<th class="num">${x} PD%</th>`).join('')}</tr></thead><tbody>`;
  for (const c of cosPD) {
    const a = T.get(c);
    hp += `<tr><td><b>${fMes(c)}</b></td><td class="num">${fN(a.n)}</td><td class="num">${fM(a.w)}</td>${[1, 2, 3, 4, 5, 6].map(x => { const v = valPD(c, x);
      return `<td class="num heat${v == null ? '' : ' clic'}" style="${calor(v, ...rango[x])}"${v == null ? '' : ` data-cos="${c}" title="${esc(`${fM(a.p[x])} en ${x}PD de ${fM(a.i[x])} vencido`)}"`}>${v == null ? '' : fP(v)}</td>`; }).join('')}</tr>`;
  }
  const tN = cosPD.reduce((s, c) => s + T.get(c).n, 0), tW = cosPD.reduce((s, c) => s + T.get(c).w, 0);
  $('pdsTabla').innerHTML = hp + `<tr class="total"><td>Total</td><td class="num">${fN(tN)}</td><td class="num">${fM(tW)}</td>${[1, 2, 3, 4, 5, 6].map(x => `<td class="num">${fP(totPD(x))}</td>`).join('')}</tr></tbody></table>`
    + (cosPD.length ? '' : '<p class="small muted">Sin datos con los filtros aplicados.</p>');

  if (conSolo) {
    let hs = `<table><thead><tr><th>Cosecha</th><th class="num">Cuentas</th><th class="num">Monto pagaré</th>${[1, 2, 3, 4, 5, 6].map(x => `<th class="num">Cuota ${x}</th>`).join('')}</tr></thead><tbody>`;
    for (const c of cosPD) {
      const a = T.get(c);
      hs += `<tr><td><b>${fMes(c)}</b></td><td class="num">${fN(a.n)}</td><td class="num">${fM(a.w)}</td>${[1, 2, 3, 4, 5, 6].map(x => { const v = valSolo(c, x);
        return `<td class="num heat${v == null ? '' : ' clic'}" style="${v == null ? '' : calor(rangoS[x][1] + rangoS[x][0] - v, ...rangoS[x])}"${v == null ? '' : ` data-cos="${c}" title="${esc(`${fM(a.s[x])} pagó solo de ${fM(a.i[x])} vencido`)}"`}>${v == null ? '' : fP(v)}</td>`; }).join('')}</tr>`;
    }
    $('soloTabla').innerHTML = hs + `<tr class="total"><td>Total</td><td class="num">${fN(tN)}</td><td class="num">${fM(tW)}</td>${[1, 2, 3, 4, 5, 6].map(x => `<td class="num">${fP(totSolo(x))}</td>`).join('')}</tr></tbody></table>`;
  }

  // Matriz del PD elegido
  let h = `<table><thead><tr><th>Cosecha</th>${meses.map(m => `<th class="num">${fMes(m)}${m === actual ? '*' : ''}</th>`).join('')}<th class="num">Total cosecha</th></tr></thead><tbody>`;
  for (const c of cosechas.slice().reverse()) {
    const f = M.get(c), v = sum(f, 'venc'), pd = sum(f, 'pd');
    h += `<tr><td><b>${fMes(c)}</b></td>${meses.map(m => { const a = f.get(m); if (!a) return '<td></td>';
      const p = pct(a.pd, a.venc), alto = p != null && p > 5;
      return `<td class="num clic${alto ? ' fondo-ambar' : ''}" data-cos="${c}" data-cobro="${m}" title="${esc(`${fN(a.npd)} cuentas en ${PD} de ${fN(a.n)} · ${PD} ${fM(a.pd)} de ${fM(a.venc)} vencido`)}">${a.venc ? fP(p) : '<span class="muted">por vencer</span>'}<div class="sub">${fM(a.tot)}</div></td>`; }).join('')}`
      + `<td class="num tot">${fP(pct(pd, v))}<div class="sub">${fM(sum(f, 'tot'))}</div></td></tr>`;
  }
  $('cosTabla').innerHTML = h + '</tbody></table>';

  // Embudo por corte (una tabla por corte; columnas = cosechas)
  for (const ct of [1, 2, 3]) {
    const E = EC[ct - 1], cols = recientes.filter(c => E.has(c)).reverse();
    if (!cols.length) { $(`cosEmb${ct}`).innerHTML = `<p class="small muted" style="padding:10px">Ninguna cosecha tiene cuotas ${nPD} en un ${['primer', 'segundo', 'tercer'][ct - 1]} mes de cobro con los filtros aplicados.</p>`; continue; }
    let he = `<table><thead><tr><th>Paso</th>${cols.map(c => `<th class="num">${fMes(c)}<div class="sub">cobro ${fMes(E.get(c).mes)}${E.get(c).mes === actual ? '*' : ''}</div></th>`).join('')}</tr></thead><tbody>`
      + `<tr><td>Saldo pagaré en mora (día 1)</td>${cols.map(c => `<td class="num">${fM(E.get(c).base)}</td>`).join('')}</tr>`;
    ETAPAS.forEach(([e, t], j) => {
      he += `<tr><td>${t}</td>${cols.map(c => { const a = E.get(c), v = a[e] || 0, prev = j === 0 || e === 'e_pago' ? a.base : a[ETAPAS[j - 1][0]] || 0;
        return `<td class="num clic" data-cos="${c}" data-cobro="${a.mes}">${fP(pct(v, a.base))}${j && e !== 'e_pago' ? `<div class="sub">${fP(pct(v, prev))}</div>` : ''}</td>`; }).join('')}</tr>`;
    });
    $(`cosEmb${ct}`).innerHTML = he + '</tbody></table>';
  }

  // Intensidad por cosecha y corte
  const filasI = [...IN.values()].sort((a, b) => b.c.localeCompare(a.c) || a.ct - b.ct);
  const r1 = v => (v == null || !isFinite(v) ? '—' : fDec(v, 1));
  $('cosInt').innerHTML = `<table><thead><tr><th>Cosecha</th><th>Corte</th><th>Mes de cobro</th><th class="num">Saldo en mora (día 1)</th><th class="num">Cuentas</th><th class="num">Gestiones por cuenta</th><th class="num">Contactos por cuenta</th><th class="num">% con RPC</th><th class="num">Gestiones por día en mora</th><th class="num">% sin gestión de gestor</th><th class="num">% salió de mora al corte</th></tr></thead><tbody>`
    + filasI.map(b => `<tr><td><b>${fMes(b.c)}</b></td><td>${b.ct}</td><td>${fMes(b.mes)}${b.mes === actual ? '*' : ''}</td><td class="num">${fM(b.w)}</td><td class="num">${fN(b.n)}</td><td class="num">${r1(b.gm / b.w)}</td><td class="num">${r1(b.gmc / b.w)}</td>`
      + `<td class="num">${fP(pct(b.rpc, b.w))}</td><td class="num">${r1(b.dm ? b.gmDia / b.dm : null)}</td><td class="num">${fP(pct(b.sing, b.singB))}</td><td class="num">${fP(pct(b.pago, b.pagoB))}</td></tr>`).join('')
    + (filasI.length ? '' : '<tr><td colspan="11">Sin cuentas en mora con los filtros aplicados.</td></tr>') + '</tbody></table>';
  const etq = recientes.filter(c => [1, 2, 3].some(ct => IN.has(`${c}|${ct}`)));
  barrasAgrupadas('gCosInt', etq.map(fMes), [1, 2, 3].map(ct => ({ t: `Corte ${ct}`, c: [SERIE[1], SERIE[2], SERIE[0]][ct - 1],
    v: etq.map(c => { const b = IN.get(`${c}|${ct}`); return b && b.dm ? +(b.gmDia / b.dm).toFixed(2) : null; }) })), {
    fmt: v => fDec(v, 1),
    extra: it => { const c = etq[it[0].dataIndex]; return [1, 2, 3].map(ct => IN.get(`${c}|${ct}`)).filter(Boolean).map(b => `Corte ${b.ct} (${fMes(b.mes)}): ${fN(b.n)} cuentas en mora · ${fM(b.w)} · salió ${fP(pct(b.pago, b.pagoB))}`); },
    clic: j => ({ mes_desembolso: etq[j] }),
  });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ps]'); if (b) { S.seg.ps = b.dataset.ps; pintar(); } });
document.addEventListener('click', e => { const c = e.target.closest('[data-cos]'); if (c) filtrarDesdeGrafico(c.dataset.cobro ? { mes_desembolso: c.dataset.cos, mes_cobro: c.dataset.cobro } : { mes_desembolso: c.dataset.cos }); });

document.addEventListener('click', e => {
  const b = e.target.closest('[data-segk],[data-segby]');
  if (!b) return;
  if (b.dataset.segk) S.seg.k = b.dataset.segk; else S.seg.by = b.dataset.segby;
  pintar();
});
document.addEventListener('change', e => { if (e.target.id === 'segMes') { S.seg.mes = e.target.value; pintar(); } });

// ---------- Pestaña Cono de cobranza ----------
function filasCono(T) {
  const f = {};
  for (const c of Object.keys(CONO_DIMS)) if (S.cono[c] && S.cono[c].length) f[c] = S.cono[c];
  const idx = filas(T, f);
  const fecha = T.dic.dia ? 'dia' : 'fecha_promesa';
  if (fecha === 'dia' && (S.cono.desde || S.cono.hasta)) {
    return idx.filter(i => { const d = dv(T, 'dia', i); return (!S.cono.desde || d >= S.cono.desde) && (!S.cono.hasta || d <= S.cono.hasta); });
  }
  return idx;
}

function pintarCono(D) {
  const G = D.gestiones, P = D.promesas;
  const ig = filasCono(G);
  const fP_ = {}; for (const c of ['tipo_cartera', 'usuario']) if (S.cono[c] && S.cono[c].length) fP_[c] = S.cono[c];
  const ip = filas(P, fP_);
  const nuevo = () => ({ n: 0, gestionada: 0, contacto: 0, rpc: 0, promesa: 0 });
  const suma = (a, i) => { a.n += mv(G, 'n', i); for (const k of ['gestionada', 'contacto', 'rpc', 'promesa']) a[k] += mv(G, k, i); };
  const tot = agrupar(G, ig, null, nuevo, suma).get('Total') || nuevo();
  const pr = agrupar(P, ip, 'estado_promesa', () => ({ n: 0, prom: 0, pag: 0 }), (a, i) => { a.n += mv(P, 'n', i); a.prom += mv(P, 'monto_promesa', i); a.pag += mv(P, 'monto_pagado', i); });
  const cumpl = pr.get('Cumplida') || { n: 0, prom: 0, pag: 0 };
  const totP = [...pr.values()].reduce((s, a) => ({ n: s.n + a.n, prom: s.prom + a.prom, pag: s.pag + a.pag }), { n: 0, prom: 0, pag: 0 });
  kpis([
    ['Gestiones del mes', fN(tot.n), 'una por gestión (sin duplicados)', 'navy'],
    ['Contactos', fN(tot.contacto), fP(pct(tot.contacto, tot.n)) + ' de las gestiones', 'cielo'],
    ['RPC', fN(tot.rpc), fP(pct(tot.rpc, tot.n)) + ' de las gestiones', ''],
    ['Promesas', fN(tot.promesa), fP(pct(tot.promesa, tot.rpc)) + ' de los RPC', 'naranja'],
    ['Promesas cumplidas', fN(cumpl.n), fP(pct(cumpl.n, totP.n)) + ' de las promesas', 'lima'],
    ['Monto pagado en promesas', fM(totP.pag), `de ${fM(totP.prom)} prometido`, 'amarillo'],
  ]);
  $('graficos').innerHTML =
    `<article class="graf"><div class="cab"><h3>Embudo de cobranza</h3></div><p class="nota">Cada paso como porcentaje del anterior.</p><div class="embudo" id="embudo"></div></article>`
    + tarjeta('gConoDia', 'Gestiones por día', 'Gestiones, contactos y promesas de cada día del mes.', { leyenda: [['Gestiones', SERIE[1]], ['Contactos', SERIE[0]], ['Promesas', SERIE[2]]] })
    + tarjeta('gConoProm', 'Promesas por fecha comprometida', 'Monto prometido contra monto pagado.', { leyenda: [['Prometido', SERIE[1]], ['Pagado', SERIE[0]]] })
    + tarjeta('gConoRes', 'Resultados más frecuentes', 'Los 12 resultados de gestión con más registros.', { alto: true });
  const pasos = [['Gestiones', tot.n], ['Intentos', tot.gestionada], ['Contacto', tot.contacto], ['RPC', tot.rpc], ['Promesa', tot.promesa], ['Promesa cumplida', cumpl.n]];
  $('embudo').innerHTML = pasos.map(([t, v], k) => `<div class="paso"><span class="nom">${t}</span><div><div class="barra" style="width:${Math.max(0.5, pct(v, tot.n) || 0)}%"></div></div><span class="val"><b>${fN(v)}</b> ${k ? fP(pct(v, pasos[k - 1][1])) : ''}</span></div>`).join('');
  const pd = agrupar(G, ig, 'dia', nuevo, suma);
  const dias = [...pd.keys()].sort();
  lineas('gConoDia', dias.map(fDia), [
    { t: 'Gestiones', c: SERIE[1], v: dias.map(d => pd.get(d).n) },
    { t: 'Contactos', c: SERIE[0], v: dias.map(d => pd.get(d).contacto) },
    { t: 'Promesas', c: SERIE[2], v: dias.map(d => pd.get(d).promesa) },
  ], {
    etiqueta: c => { const a = pd.get(dias[c.dataIndex]), tt = [tot.n, tot.contacto, tot.promesa][c.datasetIndex]; return `${c.dataset.label}: ${fN(c.raw)}${c.datasetIndex ? ` · ${fP(pct(c.raw, a.n))} de las gestiones del día` : ''} · ${fP(pct(c.raw, tt))} del total`; },
    clic: k => ({ desde: dias[k], hasta: dias[k] }),
  });
  const pf = agrupar(P, ip, 'fecha_promesa', () => ({ prom: 0, pag: 0 }), (a, i) => { a.prom += mv(P, 'monto_promesa', i); a.pag += mv(P, 'monto_pagado', i); });
  const fechas = [...pf.keys()].filter(f => f !== 'SIN FECHA').sort();
  barrasAgrupadas('gConoProm', fechas.map(fDia), [
    { t: 'Prometido', c: SERIE[1], v: fechas.map(f => pf.get(f).prom) },
    { t: 'Pagado', c: SERIE[0], v: fechas.map(f => pf.get(f).pag) },
  ], { fmt: fM, extra: it => { const a = pf.get(fechas[it[0].dataIndex]); return [`Pagado ${fP(pct(a.pag, a.prom))} de lo prometido`, `${fP(pct(a.prom, totP.prom))} del monto prometido total`]; } });
  const res = [...agrupar(G, ig, 'descripcion_resultado', nuevo, suma).entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  barrasSimples('gConoRes', res.map(x => x[0]), res.map(x => x[1].n), {
    color: SERIE[1], extra: it => { const a = res[it[0].dataIndex][1]; return [`${fP(pct(a.n, tot.n))} de las gestiones`, `${fN(a.contacto)} contactos · ${fN(a.promesa)} promesas`]; },
    clic: k => ({ descripcion_resultado: res[k][0] }),
  });
  const tp = S.verPor.tabla_cono || 'usuario';
  tabla('Detalle del cono', [['usuario', 'Gestor'], ['descripcion_accion', 'Acción'], ['descripcion_resultado', 'Resultado'], ['tipo_cartera', 'Tipo de cartera'], ['dia', 'Día']], tp, [
    { t: 'Gestiones', v: a => a.n, f: fN }, { t: 'Intentos', v: a => a.gestionada, f: fN }, { t: 'Contactos', v: a => a.contacto, f: fN },
    { t: 'RPC', v: a => a.rpc, f: fN }, { t: 'Promesas', v: a => a.promesa, f: fN },
    { t: '% contacto', v: a => pct(a.contacto, a.n), f: fP }, { t: '% RPC', v: a => pct(a.rpc, a.n), f: fP }, { t: '% promesa s/ RPC', v: a => pct(a.promesa, a.rpc), f: fP },
  ], agrupar(G, ig, tp, nuevo, suma), tot);
}

// ---------- Arme su gráfico o tabla (cada persona; se guarda en su navegador y respeta los filtros) ----------
const MED_NOM = {
  monto_des: 'Monto desembolsado', saldopagare: 'Saldo pagaré inicial', saldo_doc: 'Saldo actual', dias_mora: 'Días mora actual',
  cuotas_vencidas: 'Cuotas vencidas', valor_vencido: 'Valor vencido', cuotas_pagas: 'Cuotas pagadas', intentos: 'Intentos (gestiones)',
  gestionada: 'Intentos', contacto: 'Contactos', rpc: 'RPC', promesa: 'Promesas', monto_promesa: 'Monto promesa', monto_pagado: 'Monto pagado',
  valor_cuota: 'Valor cuota', salario: 'Salario Loan', score: 'Score', tasainteres: 'Tasa', monto_ult_pago: 'Monto último pago',
  capacidad_pago: 'Capacidad de pago', ingreso_bruto: 'Ingreso bruto', edad: 'Edad', multiplicador: 'Multiplicador',
  salario_inss: 'Salario INSS', porcentaje_financiar: '% a financiar', razon_cuota_ingreso: 'Razón cuota ingreso (bitácora)',
  monto_aprobado_motor: 'Monto aprobado motor',
};
const MONEDA = new Set(['monto_des', 'saldopagare', 'saldo_doc', 'valor_vencido', 'monto_promesa', 'monto_pagado', 'valor_cuota', 'salario',
  'monto_ult_pago', 'ingreso_bruto', 'salario_inss', 'monto_aprobado_motor']);
const CRONO = new Set(['mes_desembolso', 'primera_cuota', 'dia', 'fecha_promesa', 'dia_pago', 'plazo']);
const PALETA = [...SERIE, '#06255B', '#F2C20C', '#EE232E', '#7A5195', '#8FAEDF'];
const TIPOS_ARM = { barras: 'Barras', apiladas: 'Barras apiladas', lineas: 'Líneas', tabla: 'Tabla' };
const claveArm = () => `cvc_graficos_${S.perfil?.usuario || S.perfil?.nombre || 'yo'}_${S.tab}`;
const leerArm = () => { try { return JSON.parse(localStorage.getItem(claveArm()) || '[]'); } catch { return []; } };
const guardarArm = l => { try { localStorage.setItem(claveArm(), JSON.stringify(l)); } catch { /* sin almacenamiento: queda solo en esta vista */ } };
const nomCampo = d => DIM[d] || CONO_DIMS[d] || (d === 'dia' ? 'Día' : d === 'fecha_promesa' ? 'Fecha promesa' : d);

function armDatos(D) {
  if (S.tab === 'cono') return { T: D.gestiones, idx: filasCono(D.gestiones), cuenta: i => mv(D.gestiones, 'n', i), u: 'gestiones' };
  return { T: D, idx: filas(D, filtrosActivos()), cuenta: () => 1, u: 'créditos' };
}

function pintarArmar(D) {
  const caja = $('armarCaja');
  if (!D) { caja.hidden = true; return; }
  caja.hidden = false;
  const { T } = armDatos(D);
  const dims = Object.keys(T.dic).filter(d => d !== 'n').sort((a, b) => nomCampo(a).localeCompare(nomCampo(b), 'es'));
  const meds = Object.keys(T.datos).filter(c => !T.dic[c] && c !== 'n' && c !== 'fila' && MED_NOM[c]);
  const op = (v, t, sel) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
  const f = S.armForm?.[S.tab] || {};
  const tipos = Object.entries(TIPOS_ARM).filter(([k]) => k !== 'tabla' || veTablas());
  $('farmar').innerHTML =
    `<label>Tipo<select id="aTipo">${tipos.map(([k, t]) => op(k, t, f.tipo)).join('')}</select></label>`
    + `<label>Agrupar por<select id="aDim">${dims.map(d => op(d, nomCampo(d), f.dim)).join('')}</select></label>`
    + `<label>Separar por (opcional)<select id="aDim2"><option value="">— Ninguno —</option>${dims.map(d => op(d, nomCampo(d), f.dim2)).join('')}</select></label>`
    + `<label>Medida<select id="aMed">${op('n', `Cantidad de ${armDatos(D).u}`, f.med)}${meds.map(c => op(`sum:${c}`, `Suma de ${MED_NOM[c]}`, f.med)).join('')}${meds.map(c => op(`avg:${c}`, `Promedio de ${MED_NOM[c]}`, f.med)).join('')}</select></label>`
    + `<label>Mostrar<select id="aComo">${op('valor', 'Valor', f.como)}${op('pct', '% del total', f.como)}</select></label>`
    + `<label>Grupos<select id="aTop">${[10, 15, 25, 50].map(n => op(String(n), `Los ${n} mayores`, f.top)).join('')}${op('0', 'Todos', f.top)}</select></label>`
    + `<button class="btn">Agregar</button>`;
  const lista = leerArm();
  $('misGraficos').innerHTML = lista.map((g, k) => `<article class="graf${g.tipo === 'tabla' ? ' ancho' : ''}"><div class="cab"><h3>${esc(tituloArm(g, D))}</h3><button type="button" class="btn lin mini" data-quitarg="${k}" title="Quitar este gráfico">✕ Quitar</button></div>`
    + (g.tipo === 'tabla' ? `<div class="tabla-caja" id="arm${k}"></div>` : `<div class="lienzo"><canvas id="arm${k}"></canvas></div>`) + '</article>').join('');
  $('armVacio').hidden = lista.length > 0;
  lista.forEach((g, k) => { try { dibujarArm(`arm${k}`, g, D); } catch (err) { console.error(err); } });
}

function tituloArm(g, D) {
  const [tipo, col] = g.med.split(':');
  const med = tipo === 'n' ? `Cantidad de ${armDatos(D).u}` : `${tipo === 'sum' ? 'Suma' : 'Promedio'} de ${MED_NOM[col] || col}`;
  return `${med}${g.como === 'pct' ? ' (% del total)' : ''} por ${nomCampo(g.dim)}${g.dim2 ? ` y ${nomCampo(g.dim2)}` : ''}`;
}

function dibujarArm(id, g, D) {
  const { T, idx, cuenta } = armDatos(D);
  if (!T.dic[g.dim] || (g.dim2 && !T.dic[g.dim2])) { $(id).closest('article').querySelector('.cab h3').textContent += ' — campo no disponible en esta pestaña'; return; }
  const [tipoM, col] = g.med.split(':');
  const nuevo = () => ({ n: 0, s: 0, c: 0 });
  const sumar = (a, i) => { a.n += cuenta(i); if (col) { const v = T.datos[col]?.[i]; if (v != null) { a.s += v; a.c++; } } };
  const val = a => (tipoM === 'n' ? a.n : tipoM === 'sum' ? a.s : a.c ? a.s / a.c : null);
  const fmtV = g.como === 'pct' ? fP : tipoM === 'n' ? fN : MONEDA.has(col) ? fM : v => (v == null ? '—' : v.toLocaleString('es-NI', { maximumFractionDigits: 2 }));
  const totA = agrupar(T, idx, null, nuevo, sumar).get('Total') || nuevo();
  const totV = val(totA);
  const como = v => (g.como === 'pct' && tipoM !== 'avg' ? pct(v, totV) : v);
  const fmtK = (d, k) => (d === 'mes_desembolso' ? fMes(k) : ['primera_cuota', 'dia', 'fecha_promesa'].includes(d) ? fDia(k) : k);
  const orden = (m, d) => {
    const e = [...m.entries()];
    if (d === 'mora') return e.sort((a, b) => TRAMOS.indexOf(a[0]) - TRAMOS.indexOf(b[0]));
    if (CRONO.has(d) || d.startsWith('rango_')) return e.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true }));
    return e.sort((a, b) => (val(b[1]) ?? -Infinity) - (val(a[1]) ?? -Infinity));
  };
  let grupos = orden(agrupar(T, idx, g.dim, nuevo, sumar), g.dim);
  const top = +g.top;
  if (top && grupos.length > top && !CRONO.has(g.dim)) grupos = grupos.slice(0, top);   // campos de tiempo: siempre todos
  const claves = grupos.map(x => x[0]);
  const etiquetas = claves.map(k => fmtK(g.dim, k));
  const tip = a => [`${fN(a.n)} ${armDatos(D).u}${col ? ` · ${tipoM === 'avg' ? 'promedio' : 'suma'} ${fmtV(val(a))}` : ''}`, `${fP(pct(a.n, totA.n))} del total de ${armDatos(D).u}`];
  const clic = k => (S.tab === 'cono' ? null : { [g.dim]: claves[k] });

  if (!g.dim2) {
    if (g.tipo === 'tabla') {
      $(id).innerHTML = `<table><thead><tr><th>${esc(nomCampo(g.dim))}</th><th class="num">${tipoM === 'n' ? 'Cantidad' : esc(tituloArm(g, D).split(' por ')[0])}</th><th class="num">% del total</th><th class="num">${armDatos(D).u[0].toUpperCase() + armDatos(D).u.slice(1)}</th></tr></thead><tbody>`
        + grupos.map(([k, a]) => `<tr><td>${esc(fmtK(g.dim, k))}</td><td class="num">${fmtV(como(val(a)))}</td><td class="num">${fP(pct(val(a), totV))}</td><td class="num">${fN(a.n)}</td></tr>`).join('')
        + `<tr class="total"><td>Total</td><td class="num">${fmtV(como(totV))}</td><td class="num">${tipoM === 'avg' ? '—' : '100.0%'}</td><td class="num">${fN(totA.n)}</td></tr></tbody></table>`;
      return;
    }
    const valores = grupos.map(([, a]) => como(val(a)));
    if (g.tipo === 'lineas') return lineas(id, etiquetas, [{ t: tituloArm(g, D), c: SERIE[1], v: valores }], { fmt: fmtV, extra: it => tip(grupos[it[0].dataIndex][1]), clic });
    const horizontal = !CRONO.has(g.dim);
    return barrasSimples(id, etiquetas, valores, { color: SERIE[1], horizontal, fmt: fmtV, extra: it => tip(grupos[it[0].dataIndex][1]), clic });
  }

  // Con segundo campo: series (los 8 mayores; el resto en "Otros")
  const m2 = orden(agrupar(T, idx, g.dim2, nuevo, sumar), g.dim2);
  const natural = CRONO.has(g.dim2) || g.dim2 === 'mora' || g.dim2.startsWith('rango_');
  const series = (natural && m2.length > 10 ? m2.slice(-10) : natural ? m2 : m2.slice(0, 8)).map(x => x[0]);
  const hayOtros = m2.length > series.length && tipoM !== 'avg';
  const celda = new Map();
  for (const i of idx) {
    const k1 = dv(T, g.dim, i) ?? 'SIN DATO'; if (!claves.includes(k1)) continue;
    let k2 = dv(T, g.dim2, i) ?? 'SIN DATO'; if (!series.includes(k2)) { if (!hayOtros) continue; k2 = 'Otros'; }
    const key = `${k1}\u0001${k2}`;
    if (!celda.has(key)) celda.set(key, nuevo());
    sumar(celda.get(key), i);
  }
  const todasS = hayOtros ? [...series, 'Otros'] : series;
  const v = (k1, k2) => { const a = celda.get(`${k1}\u0001${k2}`); return a ? como(val(a)) : null; };
  if (g.tipo === 'tabla') {
    $(id).innerHTML = `<table><thead><tr><th>${esc(nomCampo(g.dim))} \\ ${esc(nomCampo(g.dim2))}</th>${todasS.map(s2 => `<th class="num">${esc(fmtK(g.dim2, s2))}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>`
      + grupos.map(([k, a]) => `<tr><td>${esc(fmtK(g.dim, k))}</td>${todasS.map(s2 => `<td class="num">${v(k, s2) == null ? '' : fmtV(v(k, s2))}</td>`).join('')}<td class="num tot">${fmtV(como(val(a)))}</td></tr>`).join('')
      + '</tbody></table>';
    return;
  }
  const sets = todasS.map((s2, j) => ({ t: String(fmtK(g.dim2, s2)), c: s2 === 'Otros' ? GRIS : PALETA[j % PALETA.length], v: claves.map(k => v(k, s2)) }));
  const ley = `<div class="leyenda">${sets.map(x => `<span><i style="background:${x.c}"></i>${esc(x.t)}</span>`).join('')}</div>`;
  $(id).closest('.lienzo').insertAdjacentHTML('beforebegin', ley);
  const etiqueta = c => { const a = celda.get(`${claves[c.dataIndex]}\u0001${todasS[c.datasetIndex]}`); return `${c.dataset.label}: ${fmtV(c.raw)}${a ? ` · ${fN(a.n)} ${armDatos(D).u} · ${fP(pct(a.n, totA.n))} del total` : ''}`; };
  const clic2 = (k, j) => (S.tab === 'cono' ? null : j == null || todasS[j] === 'Otros' ? { [g.dim]: claves[k] } : { [g.dim]: claves[k], [g.dim2]: todasS[j] });
  if (g.tipo === 'lineas') return lineas(id, etiquetas, sets, { fmt: fmtV, etiqueta, clic: clic2 });
  if (g.tipo === 'apiladas' && tipoM !== 'avg') return barrasApiladas(id, etiquetas, sets, { horizontal: !CRONO.has(g.dim), fmt: fmtV, etiqueta, clic: clic2 });
  return barrasAgrupadas(id, etiquetas, sets, { fmt: fmtV, clic: clic2 });
}

$('farmar').addEventListener('submit', e => {
  e.preventDefault();
  const g = { tipo: $('aTipo').value, dim: $('aDim').value, dim2: $('aDim2').value, med: $('aMed').value, como: $('aComo').value, top: $('aTop').value };
  if (g.dim2 === g.dim) g.dim2 = '';
  S.armForm = { ...(S.armForm || {}), [S.tab]: g };
  guardarArm([...leerArm(), g]);
  pintarArmar(S.datos[S.tab]);
  $('misGraficos').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('misGraficos').addEventListener('click', e => {
  const b = e.target.closest('[data-quitarg]');
  if (!b) return;
  const l = leerArm(); l.splice(+b.dataset.quitarg, 1); guardarArm(l);
  pintarArmar(S.datos[S.tab]);
});

// ---------- Navegación ----------
async function abrir(tab) {
  S.tab = tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const admin = tab === 'admin';
  $('vistaDatos').hidden = admin; $('vistaAdmin').hidden = !admin;
  if (admin) { $('preguntas').hidden = true; return pintarUsuarios(); }
  $('cargando').hidden = false; $('vistaDatos').hidden = true;
  try { await bajar(tab); aviso(''); }
  catch (err) { aviso(`No se pudieron cargar los datos de esta pestaña: ${err.message}`, true); }
  finally { $('cargando').hidden = true; $('vistaDatos').hidden = false; }
  pintar();
}

function pintar() {
  const D = S.datos[S.tab];
  $('pivCaja').hidden = true;   // el cuadro mes × tramo de mora solo lo pintan Cosecha y Cartera Activa
  if (!D) { $('kpis').innerHTML = $('graficos').innerHTML = ''; $('tablaCaja').hidden = true; $('armarCaja').hidden = true; $('preguntas').hidden = !CFG.IA_CLAUDE; return; }
  pintarFiltros(D);
  $('segCtl').hidden = true;
  ({ cosecha: pintarCosecha, cartera_activa: pintarCartera, primeros_pagos: pintarPrimeros, cono: pintarCono, pp_seguimiento: pintarSeguimiento, pp_mora_cuota: pintarSeguimiento, pp_cosecha: pintarCosecha1PD })[S.tab](D);
  if (PP_TABS.includes(S.tab)) $('tablaCaja').hidden = true;
  pintarArmar(D);
  $('btnDescargar').title = S.tab === 'cono' ? 'Descarga la base completa de créditos'
    : 'Descarga en Excel los créditos de esta pestaña con los filtros aplicados';
  pintarGuiada();
}

$('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) abrir(b.dataset.tab); });

// ---------- Tablas al ancho de la pantalla: se achica la letra (hasta 10 px) en vez de obligar a desplazarse ----------
function ajustarTablas() {
  document.querySelectorAll('main .tabla-caja').forEach(c => {
    const t = c.querySelector(':scope > table');
    if (!t || !c.clientWidth) return;
    t.style.fontSize = ''; t.style.removeProperty('--k');
    const base = parseFloat(getComputedStyle(t).fontSize);
    let fs = base;
    while (t.scrollWidth > c.clientWidth + 1 && fs > 10) {
      fs -= 0.5; t.style.fontSize = `${fs}px`; t.style.setProperty('--k', (fs / base).toFixed(3));
    }
  });
}
let ajusteProg = 0;
const programarAjuste = () => { cancelAnimationFrame(ajusteProg); ajusteProg = requestAnimationFrame(ajustarTablas); };
new MutationObserver(programarAjuste).observe(document.querySelector('main'), { childList: true, subtree: true });
window.addEventListener('resize', programarAjuste);

// ---------- Descarga ----------
// Con filtros: solo las filas filtradas de la pestaña, con las mismas columnas del Excel completo (se arma en el navegador)
let BASE = null;
async function cargarBase() {
  if (BASE) return BASE;
  if (LOCAL) BASE = await (await fetch('local/base.json', { cache: 'no-store' })).json();
  else {
    const blob = ok(await sb.storage.from(CFG.BUCKET).download('descargas/base.json.gz'));
    BASE = JSON.parse(await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text());
  }
  return BASE;
}
const cargarScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('no se pudo cargar el generador de Excel')); document.head.append(s); });

async function descargarFiltrado(D) {
  const idx = filas(D, filtrosActivos());
  const [B] = await Promise.all([cargarBase(), window.XLSX ? null : cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')]);
  const filasB = idx.map(i => D.fila[i]);
  const aoa = [B.cols.map(c => c.n)];
  for (const r of filasB) {
    aoa.push(B.cols.map((c, j) => {
      const v = B.datos[j][r];
      if (v == null) return null;
      if (c.t === 's') return c.dic[v];
      if (c.t === 'd') {   // número de serie de Excel (sin zona horaria: la fecha queda exacta)
        const [a, m, d] = v.slice(0, 10).split('-').map(Number), [h, mi, se] = v.length > 10 ? v.slice(11).split(':').map(Number) : [0, 0, 0];
        return (Date.UTC(a, m - 1, d, h, mi, se) - Date.UTC(1899, 11, 30)) / 864e5;
      }
      return v;
    }));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  B.cols.forEach((c, j) => {
    if (c.t !== 'd') return;
    const conHora = B.datos[j].some(v => v && v.length > 10);
    for (let r = 1; r < aoa.length; r++) { const cel = ws[XLSX.utils.encode_cell({ r, c: j })]; if (cel) cel.z = conHora ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd'; }
  });
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cosecha');
  const tabN = PESTANAS.find(p => p.id === S.tab)?.t || S.tab;
  XLSX.writeFile(wb, `Base Cosechas vs Cobro - ${tabN} (filtrada).xlsx`, { compression: true });
  return filasB.length;
}

$('btnDescargar').addEventListener('click', async () => {
  const btn = $('btnDescargar'), D = S.datos[S.tab];
  const filtrada = D && S.tab !== 'cono' && D.fila && (Object.keys(filtrosActivos()).length || S.tab !== 'cosecha');
  try {
    if (filtrada) {
      btn.disabled = true; btn.textContent = 'Preparando Excel…';
      const n = await descargarFiltrado(D);
      aviso(`Se descargaron ${fN(n)} créditos de ${PESTANAS.find(p => p.id === S.tab)?.t} con los filtros aplicados.`);
      return;
    }
    if (LOCAL) { location.href = 'local/Base Cosechas vs Cobro.xlsx'; return; }
    const { signedUrl } = ok(await sb.storage.from(CFG.BUCKET).createSignedUrl('descargas/base.xlsx', 120, { download: 'Base Cosechas vs Cobro.xlsx' }));
    location.href = signedUrl;
  } catch (err) { aviso(`No se pudo descargar: ${err.message}`, true); }
  finally { btn.disabled = false; btn.textContent = 'Descargar data'; }
});

// ---------- Actualizar ----------
function aviso(texto, error = false) {
  $('aviso').hidden = !texto; $('aviso').textContent = texto || ''; $('aviso').classList.toggle('error', error);
}

$('btnActualizar').addEventListener('click', async () => {
  if (LOCAL) { S.datos = {}; S.arch = {}; await leerMeta(); return abrir(S.tab); }
  const btn = $('btnActualizar');
  btn.disabled = true; btn.textContent = 'Actualizando…';
  // Una actualización "procesando" de hace más de 3 h se da por interrumpida (la PC se apagó a media carga)
  const enCurso = async () => ok(await sb.from('cvc_actualizaciones').select('id,iniciado_en,solicitado_nombre')
    .eq('estado', 'procesando').gte('iniciado_en', new Date(Date.now() - 3 * 3600e3).toISOString())
    .order('id', { ascending: false }).limit(1))[0];
  const hora = t => new Date(t).toLocaleTimeString('es-NI', { hour: 'numeric', minute: '2-digit' });
  const avisoEnCurso = c => {
    aviso(`Ya hay una actualización en curso (${c.solicitado_nombre || 'solicitada'}, iniciada a las ${hora(c.iniciado_en)}). `
      + 'Espera unos minutos: los datos se recargan solos al terminar. No hace falta volver a darle a Actualizar.');
    btn.textContent = 'Actualización en curso…';
  };
  try {
    const actual = await enCurso();
    let id;
    if (actual) { id = actual.id; avisoEnCurso(actual); }
    else id = ok(await sb.from('cvc_actualizaciones').insert({ solicitado_nombre: S.perfil.nombre }).select().single()).id;
    const t0 = Date.now();
    for (;;) {
      await new Promise(r => setTimeout(r, 5000));
      const e = ok(await sb.from('cvc_actualizaciones').select('estado,mensaje').eq('id', id).single());
      if (e.estado === 'ok') { aviso(''); S.datos = {}; S.arch = {}; await leerMeta(); await abrir(S.tab); break; }
      if (e.estado === 'error') { aviso(`La actualización falló: ${e.mensaje || ''}`, true); break; }
      if (e.estado === 'procesando') { if (!actual) { btn.textContent = 'Procesando…'; aviso(''); } continue; }
      if (Date.now() - t0 > 60000) {  // sigue pendiente: ¿el proceso está ocupado con otra carga o no está corriendo?
        const otra = await enCurso();
        if (otra) { avisoEnCurso(otra); continue; }
        aviso('El proceso de actualización no respondió: la PC que lo ejecuta puede estar apagada. Se muestran los últimos datos cargados; la solicitud queda en cola.', true);
        break;
      }
    }
  } catch (err) { aviso(`No se pudo pedir la actualización: ${err.message}`, true); }
  finally { btn.disabled = false; btn.textContent = 'Actualizar'; }
});

// ---------- Preguntas guiadas (sin costo: se calculan en el navegador con los datos de la pestaña) ----------
// La pregunta se arma con listas: ¿Qué <grupo> tiene <mayor|menor> <indicador>? Usa los filtros que estén aplicados.
const accCono = G => [() => ({ n: 0, gestionada: 0, contacto: 0, rpc: 0, promesa: 0 }),
  (a, i) => { a.n += mv(G, 'n', i); for (const k of ['gestionada', 'contacto', 'rpc', 'promesa']) a[k] += mv(G, k, i); }];
const de = (a, b, u) => `${fN(a)} de ${fN(b)} ${u}`;
const PREG = {
  cosecha: {
    datos: D => D, filas: D => filas(D, filtrosActivos()), acc: accCred, min: 30, tam: a => a.n, u: 'créditos',
    dims: DIMS_VER_POR,
    ind: [
      { id: 'm30', t: '% de mora 30+', v: a => pct(a.m30, a.n), f: fP, pct: true, det: a => de(a.m30, a.n, 'créditos') },
      { id: 'm90', t: '% de mora 90+', v: a => pct(a.m90, a.n), f: fP, pct: true, det: a => de(a.m90, a.n, 'créditos') },
      { id: 'b0', t: '% de créditos al día', v: a => pct(a.b0, a.n), f: fP, pct: true, det: a => de(a.b0, a.n, 'créditos') },
      { id: 'canc', t: '% de créditos cancelados', v: a => pct(a.n - a.act, a.n), f: fP, pct: true, det: a => de(a.n - a.act, a.n, 'créditos') },
      { id: 'n', t: 'cantidad de créditos desembolsados', v: a => a.n, f: fN, det: a => fM(a.monto) },
      { id: 'monto', t: 'monto desembolsado', v: a => a.monto, f: fM, det: a => `${fN(a.n)} créditos` },
      { id: 'saldo', t: 'saldo activo', v: a => a.saldo, f: fM, det: a => `${fN(a.act)} créditos activos` },
    ],
    sug: [['¿Qué cosechas tienen la peor mora 30+?', 'mes_desembolso', 'm30', 'mayor', 5],
      ['¿Qué sucursales tienen más mora 30+?', 'sucursal', 'm30', 'mayor', 10],
      ['¿Cómo evoluciona la mora 30+ por mes?', 'mes_desembolso', 'm30', 'orden', 0]],
  },
  cartera_activa: {
    datos: D => D, filas: D => filas(D, filtrosActivos()), acc: accCred, min: 20, tam: a => a.act, u: 'créditos activos',
    dims: [...DIMS_VER_POR, 'mora', 'rodamiento', 'tipo_cartera', 'gestor', 'tipo_pago', 'pago_mes'],
    ind: [
      { id: 's30p', t: '% del saldo en mora 30+', v: a => pct(a.s30, a.saldo), f: fP, pct: true, det: a => `${fM(a.s30)} de ${fM(a.saldo)}` },
      { id: 's30', t: 'saldo en mora 30+', v: a => a.s30, f: fM, det: a => `${fN(a.act)} créditos activos` },
      { id: 'saldo', t: 'saldo', v: a => a.saldo, f: fM, det: a => `${fN(a.act)} créditos activos` },
      { id: 'act', t: 'cantidad de créditos activos', v: a => a.act, f: fN, det: a => fM(a.saldo) },
      { id: 'b0', t: '% de créditos al día', v: a => pct(a.b0, a.act), f: fP, pct: true, det: a => de(a.b0, a.act, 'créditos') },
      { id: 'desm', t: '% de desmejora (rodamiento)', v: a => pct(a.desm, a.act), f: fP, pct: true, det: a => de(a.desm, a.act, 'créditos') },
      { id: 'pago', t: '% que pagó este mes', v: a => pct(a.pagoMes, a.act), f: fP, pct: true, det: a => de(a.pagoMes, a.act, 'créditos') },
    ],
    sug: [['¿Qué sucursales concentran el saldo en mora 30+?', 'sucursal', 's30', 'mayor', 10],
      ['¿Qué gestores tienen menos créditos que pagaron este mes?', 'gestor', 'pago', 'menor', 10],
      ['¿Qué productos desmejoran más?', 'producto_comercial', 'desm', 'mayor', 5]],
  },
  primeros_pagos: {
    datos: D => D, filas: D => filas(D, filtrosActivos()), acc: accPP, min: 5, tam: a => a.venc, u: 'créditos vencidos',
    dims: DIMS_VER_POR,
    ind: [
      { id: 'pmora', t: '% en mora (sobre los vencidos)', v: a => pct(a.mora, a.venc), f: fP, pct: true, det: a => de(a.mora, a.venc, 'vencidos') },
      { id: 'ppago', t: '% que pagó (sobre los vencidos)', v: a => pct(a.pago, a.venc), f: fP, pct: true, det: a => de(a.pago, a.venc, 'vencidos') },
      { id: 'mora', t: 'cantidad en mora', v: a => a.mora, f: fN, det: a => `de ${fN(a.venc)} vencidos` },
      { id: 'sinpago', t: 'cantidad vencida sin pago registrado', v: a => a.sinpago, f: fN, det: a => `de ${fN(a.venc)} vencidos` },
      { id: 'n', t: 'cantidad de primeras cuotas del mes', v: a => a.n, f: fN, det: a => `${fN(a.venc)} ya vencieron`, tam: a => a.n },
    ],
    sug: [['¿Qué promotores tienen más primeros pagos en mora?', 'promotor', 'mora', 'mayor', 10],
      ['¿Qué sucursales tienen el peor % de mora en primeros pagos?', 'sucursal', 'pmora', 'mayor', 10],
      ['¿Qué canal paga mejor la primera cuota?', 'canal', 'ppago', 'mayor', 5]],
  },
  cono: {
    datos: D => D.gestiones, filas: D => filasCono(D.gestiones), acc: accCono, min: 30, tam: a => a.n, u: 'gestiones',
    dims: ['usuario', 'descripcion_accion', 'descripcion_resultado', 'tipo_cartera', 'dia'],
    ind: [
      { id: 'rpc', t: '% de RPC', v: a => pct(a.rpc, a.n), f: fP, pct: true, det: a => de(a.rpc, a.n, 'gestiones') },
      { id: 'contacto', t: '% de contacto', v: a => pct(a.contacto, a.n), f: fP, pct: true, det: a => de(a.contacto, a.n, 'gestiones') },
      { id: 'prom', t: '% de promesa sobre RPC', v: a => pct(a.promesa, a.rpc), f: fP, pct: true, det: a => de(a.promesa, a.rpc, 'RPC'), tam: a => a.rpc },
      { id: 'n', t: 'cantidad de gestiones', v: a => a.n, f: fN, det: a => `${fN(a.contacto)} contactos` },
      { id: 'promesa', t: 'cantidad de promesas', v: a => a.promesa, f: fN, det: a => `${fN(a.rpc)} RPC` },
    ],
    sug: [['¿Qué gestores tienen mejor % de RPC?', 'usuario', 'rpc', 'mayor', 10],
      ['¿Qué gestores logran más promesas?', 'usuario', 'promesa', 'mayor', 10],
      ['¿Cómo van las gestiones por día?', 'dia', 'n', 'orden', 0]],
  },
};
const nomDim = d => DIM[d] || CONO_DIMS[d] || (d === 'dia' ? 'Día' : d);
const fClave = (d, k) => (d === 'mes_desembolso' ? fMes(k) : d === 'dia' ? fDia(k) : k);
let nPreg = 0;

function pintarGuiada() {
  const P = PREG[S.tab], D = S.datos[S.tab];
  $('preguntas').hidden = !P || !D;
  if (!P || !D) return;
  if ($('fguiada').dataset.tab === S.tab) return;   // conserva la selección al filtrar
  $('fguiada').dataset.tab = S.tab;
  const T = P.datos(D);
  const op = (v, t) => `<option value="${v}">${esc(t)}</option>`;
  $('fguiada').innerHTML = `<span>¿Qué</span><select id="qDim">${P.dims.filter(d => T.dic[d]).map(d => op(d, nomDim(d).toLowerCase())).join('')}</select>`
    + `<span>tiene</span><select id="qOrden">${op('mayor', 'mayor')}${op('menor', 'menor')}${op('orden', 'en orden (todos)')}</select>`
    + `<select id="qInd">${P.ind.map(i => op(i.id, i.t)).join('')}</select><span>?</span>`
    + `<label class="small">Ver <select id="qTop">${[5, 10, 15].map(n => op(n, n)).join('')}</select></label>`
    + '<button class="btn">Responder</button>';
  $('qDim').value = P.dims.find(d => T.dic[d] && d === 'sucursal') || $('qDim').value;
  $('sugerencias').innerHTML = P.sug.map((s, k) => `<button type="button" data-sug="${k}">${esc(s[0])}</button>`).join('');
}

function textoFiltros() {
  const F = S.tab === 'cono' ? S.cono : S.f;
  const f = Object.entries(F).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${nomFiltro(k)}: ${valFiltro(k, v)}`);
  return f.length ? `Con los filtros aplicados (${f.join(' · ')}). ` : '';
}

function responder(dim, indId, orden, top) {
  const P = PREG[S.tab], D = S.datos[S.tab], T = P.datos(D);
  const I = P.ind.find(x => x.id === indId), tam = I.tam || P.tam;
  const idx = P.filas(D), [n0, sm] = P.acc(T);
  const tot = agrupar(T, idx, null, n0, sm).get('Total') || n0();
  const minimo = I.pct ? P.min : 1;
  const todos = [...agrupar(T, idx, dim, n0, sm).entries()];
  let g = todos.filter(([, a]) => tam(a) >= minimo && I.v(a) != null);
  const omitidos = todos.length - g.length;
  const crono = orden === 'orden';
  if (crono) g.sort((x, y) => String(x[0]).localeCompare(String(y[0]), 'es', { numeric: true }));
  else g.sort((x, y) => (orden === 'mayor' ? I.v(y[1]) - I.v(x[1]) : I.v(x[1]) - I.v(y[1])) || tam(y[1]) - tam(x[1]));
  const sel = g.slice(0, crono ? 40 : top);
  const nd = nomDim(dim).toLowerCase();
  const pregunta = crono ? `¿Cómo se ve ${I.t} por ${nd}?` : `¿Qué ${nd} tiene ${orden} ${I.t}?`;
  burbuja(pregunta, 'yo');
  if (!sel.length) return burbuja(`${textoFiltros()}No hay grupos con datos suficientes para responder${I.pct ? ` (mínimo ${minimo} ${P.u} por grupo)` : ''}.`, 'ia');
  const vt = I.v(tot);
  let txt = textoFiltros();
  if (crono) {
    const may = [...sel].sort((x, y) => I.v(y[1]) - I.v(x[1]))[0], men = [...sel].sort((x, y) => I.v(x[1]) - I.v(y[1]))[0];
    txt += `${I.t[0].toUpperCase() + I.t.slice(1)} por ${nd}: el más alto es ${fClave(dim, may[0])} con ${I.f(I.v(may[1]))} y el más bajo ${fClave(dim, men[0])} con ${I.f(I.v(men[1]))}. Total: ${I.f(vt)}.`;
  } else if (orden === 'menor' && I.v(sel[0][1]) === 0) {
    const ceros = g.filter(([, a]) => I.v(a) === 0);
    txt += `${fN(ceros.length)} ${ceros.length === 1 ? 'grupo tiene' : 'grupos tienen'} ${I.f(0)} en ${I.t} (${nd}): ${ceros.slice(0, 8).map(([k2]) => fClave(dim, k2)).join(', ')}${ceros.length > 8 ? ', …' : '.'}`;
  } else {
    const [k, a] = sel[0];
    txt += `${nomDim(dim)} con ${orden} ${I.t}: ${fClave(dim, k)}, con ${I.f(I.v(a))} (${I.det(a)}).`;
    if (I.pct) {
      const dif = I.v(a) - vt;
      txt += ` El total es ${fP(vt)}: ${Math.abs(dif).toLocaleString('es-NI', { maximumFractionDigits: 1 })} puntos ${dif >= 0 ? 'por encima' : 'por debajo'}.`;
    } else txt += ` Representa el ${fP(pct(I.v(a), vt))} del total (${I.f(vt)}).`;
    if (sel.length > 1) txt += `\nLe siguen: ${sel.slice(1, 4).map(([k2, a2]) => `${fClave(dim, k2)} (${I.f(I.v(a2))})`).join(', ')}.`;
  }
  if (I.pct && omitidos) txt += `\nNo se consideran ${fN(omitidos)} grupos con menos de ${minimo} ${P.u}, porque sus porcentajes no son representativos.`;
  const b = burbuja(txt, 'ia');
  if (sel.every(([, a2]) => !I.v(a2))) return;   // todo en cero: el gráfico no aporta
  const id = `gq${++nPreg}`, vertical = crono && (dim === 'mes_desembolso' || dim === 'dia');
  const caja = document.createElement('div');
  caja.className = 'lienzo-q';
  caja.style.height = `${vertical ? 260 : Math.max(120, 30 * sel.length + 30)}px`;
  caja.innerHTML = `<canvas id="${id}"></canvas>`;
  b.lastChild.append(caja);
  const color = I.pct && ['b0', 'canc', 'ppago', 'pago', 'rpc', 'contacto', 'prom'].includes(I.id) ? SERIE[0] : I.pct ? SERIE[2] : SERIE[1];
  barrasSimples(id, sel.map(([k2]) => fClave(dim, k2)), sel.map(([, a2]) => I.v(a2)),
    { color, fmt: I.f, horizontal: !vertical, extra: it => I.det(sel[it[0].dataIndex][1]) });
  $('chat').scrollTop = $('chat').scrollHeight;
}

$('fguiada').addEventListener('submit', e => {
  e.preventDefault();
  responder($('qDim').value, $('qInd').value, $('qOrden').value, +$('qTop').value);
});
$('sugerencias').addEventListener('click', e => {
  const b = e.target.closest('button[data-sug]');
  if (!b) return;
  const [, dim, ind, orden, top] = PREG[S.tab].sug[+b.dataset.sug];
  if (!S.datos[S.tab] || !PREG[S.tab].datos(S.datos[S.tab]).dic[dim]) return;
  $('qDim').value = dim; $('qInd').value = ind; $('qOrden').value = orden; if (top) $('qTop').value = top;
  responder(dim, ind, orden, top || 10);
});

// ---------- Preguntas libres con IA (Claude) — apagadas; se activan con IA_CLAUDE: true en config.js ----------
const SUGERENCIAS = {
  cosecha: '¿Qué cosechas de los últimos 6 meses tienen la peor mora 30+?',
  cartera_activa: '¿Qué sucursales concentran el saldo en mora 30+?',
  primeros_pagos: '¿Qué promotores tienen más primeros pagos en mora este mes?',
  cono: '¿Qué gestores tienen mejor porcentaje de RPC y de promesas?',
};
function sugerencias() {
  $('fpregunta').hidden = $('sugIA').hidden = !CFG.IA_CLAUDE;
  if (!CFG.IA_CLAUDE) return;
  const mias = misPestanas().filter(p => SUGERENCIAS[p.id]);
  $('sugIA').innerHTML = mias.map(p => `<button type="button">${esc(SUGERENCIAS[p.id])}</button>`).join('');
}
$('sugIA').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { $('pregunta').value = b.textContent; $('pregunta').focus(); } });

function burbuja(texto, tipo) {
  const d = document.createElement('div');
  d.className = `msg ${tipo}`;
  if (tipo.startsWith('ia')) {
    const img = document.createElement('img'); img.src = 'img/prestamito_explicando.png'; img.alt = '';
    const t = document.createElement('div'); t.textContent = texto;
    d.append(img, t);
  } else d.textContent = texto;
  $('chat').append(d);
  $('chat').scrollTop = $('chat').scrollHeight;
  return d;
}

$('fpregunta').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('pregunta').value.trim();
  if (!q) return;
  burbuja(q, 'yo');
  $('pregunta').value = '';
  const btn = $('btnPreguntar'); btn.disabled = true; btn.textContent = 'Pensando…';
  try {
    if (LOCAL) throw new Error('La herramienta de preguntas funciona en la app publicada (necesita la función de Supabase).');
    const { data: r, error } = await sb.functions.invoke('cvc-preguntar', { body: { pregunta: q, pestana: S.tab } });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch { /* sin cuerpo JSON */ }
      throw new Error(msg);
    }
    burbuja(r.respuesta, 'ia');
  } catch (err) { burbuja(err.message, 'ia error'); }
  finally { btn.disabled = false; btn.textContent = 'Preguntar'; }
});

// ---------- Administración ----------
async function pintarUsuarios() {
  $('nRol').innerHTML = Object.entries(ROLES).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
  if (LOCAL) { $('tusuarios').innerHTML = '<tr><td colspan="4">Vista previa local: sin usuarios</td></tr>'; return; }
  try {
    const us = ok(await sb.from('cvc_perfiles').select('*').order('nombre'));
    $('tusuarios').innerHTML = us.map(u => `<tr data-id="${u.id}"><td>${esc(u.nombre)}</td>
      <td><select data-campo="rol">${Object.entries(ROLES).map(([k, t]) => `<option value="${k}"${k === u.rol ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-campo="activo"${u.activo ? ' checked' : ''}></td>
      <td><button class="btn mini lin" data-acc="clave">Restablecer contraseña</button></td></tr>`).join('');
  } catch (err) { aviso(err.message, true); }
}

$('fnuevo').addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = $('nNombre').value.trim().replace(/\s+/g, ' ');
  try {
    ok(await sb.rpc('cvc_crear_usuario', { p_usuario: slug(nombre), p_nombre: nombre, p_rol: $('nRol').value, p_password: CLAVE_INICIAL }));
    $('nNombre').value = '';
    alert(`Usuario creado. Ingresa con su nombre completo "${nombre}" y la contraseña ${CLAVE_INICIAL}; la primera vez se le pide cambiarla (si ya usaba Tiempos DAC o Auditores, entra con su contraseña de siempre).`);
    pintarUsuarios();
  } catch (err) { alert(err.message); }
});

$('tusuarios').addEventListener('change', async e => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  e.stopPropagation();
  try {
    ok(await sb.rpc('cvc_editar_usuario', { p_id: tr.dataset.id, p_rol: tr.querySelector('[data-campo=rol]').value, p_activo: tr.querySelector('[data-campo=activo]').checked }));
  } catch (err) { alert(err.message); pintarUsuarios(); }
});

$('tusuarios').addEventListener('click', async e => {
  const b = e.target.closest('button[data-acc=clave]');
  if (!b || !confirm(`¿Restablecer la contraseña a ${CLAVE_INICIAL}?`)) return;
  try { ok(await sb.rpc('cvc_restablecer_clave', { p_id: b.closest('tr').dataset.id, p_password: CLAVE_INICIAL })); alert(`Contraseña restablecida a ${CLAVE_INICIAL}.`); }
  catch (err) { alert(err.message); }
});

$('btnClave').addEventListener('click', async () => {
  const actual = prompt('Contraseña actual:');
  if (!actual) return;
  const nueva = prompt('Nueva contraseña (mínimo 8 caracteres). Si usa Tiempos DAC o Auditores, también cambia allá:');
  if (!nueva) return;
  if (nueva.length < 8) return alert('La contraseña debe tener al menos 8 caracteres.');
  if (nueva === CLAVE_INICIAL) return alert('Use una contraseña distinta de la genérica.');
  try {
    ok(await sb.auth.signInWithPassword({ email: S.perfil.usuario + DOMINIO, password: actual }));
    ok(await sb.auth.updateUser({ password: nueva }));
    alert('Contraseña cambiada.');
  } catch { alert('La contraseña actual no es correcta.'); }
});

$('btnSalir').addEventListener('click', async () => { await sb.auth.signOut(); S.perfil = null; S.datos = {}; S.arch = {}; mostrarLogin(); });

(async () => {
  try {
    if (LOCAL) {
      const r = QS.get('rol') in ROLES ? QS.get('rol') : 'admin';
      S.perfil = { nombre: 'Vista previa local', rol: r, usuario: 'local' };
      return await iniciar();
    }
    S.perfil = await perfilActual();
    if (S.perfil?.activo) await iniciar(); else mostrarLogin();
  } catch (err) { console.error(err.stack || err); mostrarLogin(`No se pudo iniciar: ${err.message}`); }
})();
