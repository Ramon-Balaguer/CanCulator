// Prototipo de sincronización P2P con PeerJS. Solo para probar la conexión entre dos móviles.
// Seguridad de la prototipo: el código de sala es el único control de acceso. En la versión
// real, el móvil que se une debe demostrar que conoce el token antes de recibir datos.

const PREFIJO_SALA = 'canculator-';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const $ = (id) => document.getElementById(id);
let peer = null;
let conexion = null;

function codigoAleatorio() {
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return codigo;
}

function estado(texto) {
  $('estado').textContent = texto;
}

function mostrarMensaje(texto) {
  const li = document.createElement('li');
  li.textContent = texto;
  $('mensajes').append(li);
}

function registrarConexion(nuevaConexion) {
  conexion = nuevaConexion;
  conexion.on('open', () => {
    estado(`Conectado con ${conexion.peer}.`);
    conexion.send({ tipo: 'hola', texto: 'Hola desde el otro móvil' });
  });
  conexion.on('data', (datos) => {
    if (datos?.tipo === 'hola') mostrarMensaje(`Recibido: ${datos.texto}`);
    else if (datos?.tipo === 'mensaje') mostrarMensaje(`Recibido: ${datos.texto}`);
  });
  conexion.on('close', () => estado('La conexión se ha cerrado.'));
  conexion.on('error', (e) => estado(`Error en la conexión: ${e.message ?? e.type}`));
}

$('crear').addEventListener('click', () => {
  const codigo = codigoAleatorio();
  peer?.destroy();
  peer = new window.Peer(PREFIJO_SALA + codigo);
  $('codigo').textContent = codigo;
  estado('Sala creada. Esperando al otro móvil…');
  peer.on('connection', registrarConexion);
  peer.on('error', (e) => estado(`Error del servicio de señalización: ${e.type}`));
});

$('unirse').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const codigo = $('codigo-sala').value.trim().toUpperCase();
  if (codigo.length !== 6) return estado('El código tiene 6 caracteres.');
  peer?.destroy();
  peer = new window.Peer();
  peer.on('open', () => {
    estado('Uniéndose a la sala…');
    registrarConexion(peer.connect(PREFIJO_SALA + codigo));
  });
  peer.on('error', (e) => estado(`No se pudo unir: ${e.type}`));
});

$('enviar').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const texto = $('mensaje').value.trim();
  if (!texto || !conexion?.open) return;
  conexion.send({ tipo: 'mensaje', texto });
  mostrarMensaje(`Enviado: ${texto}`);
  $('mensaje').value = '';
});
