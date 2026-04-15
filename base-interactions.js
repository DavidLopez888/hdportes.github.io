// Configurar las credenciales de AWS
AWS.config.update({
  region: 'eu-west-1',
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: window._config.aws.identityPoolId
  })
});

// Crear una instancia de DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Configura la URL base de tu Worker de Cloudflare
const WORKER_URL = 'https://shrill-unit-d8c2.naitsirczepol.workers.dev';

/**
 * Convierte una URL original de livetv.sx en una URL que pasa por el proxy de Cloudflare
 * @param {string} originalUrl - URL de la imagen (ej. https://livetv.sx/img/logo.png)
 * @returns {string} URL del proxy, o la original si no es de livetv.sx
 */
function proxyImageUrl(originalUrl) {
  if (!originalUrl) return null;
  
  // Si ya es una URL de nuestro propio dominio o del Worker, no la procesamos
  if (originalUrl.includes(WORKER_URL) || originalUrl.includes('hdport.es')) {
    return originalUrl;
  }
  
  // Aplicar proxy a TODAS las URLs externas (no solo livetv)
  // Esto asegura que cualquier imagen bloqueada por geolocalización se solucione
  const proxied = `${WORKER_URL}/proxy/${encodeURIComponent(originalUrl)}`;
  return proxied;
}

function extraerVideoIdDeYouTube(url) {
  const regex = /(?:embed\/|watch\?v=)([^?&]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Obtener la zona horaria del usuario
let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Función para formatear hora local
function formatLocalTime(utcDateString, timezone) {
  // Asegurarnos que la fecha se interprete como UTC
  const date = new Date(utcDateString + 'Z'); // Agrega 'Z' para forzar UTC

  // Opciones para el formato
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  };

  // Formatear con la zona horaria especificada
  return date.toLocaleTimeString('en-US', options);
}

// Función para obtener el rango de fechas en UTC
function getTimeRange() {
  const now = new Date();
  // const horamenosDate = new Date(now.getTime() - 120 * 60000);
  // const horamasDate = new Date(now.getTime() + 25 * 60000);
  const horamenosDate = new Date(now.getTime() - 120 * 60000);
  const horamasDate = new Date(now.getTime() + 25 * 60000);  
  return {
    horamenos: horamenosDate.toISOString().substring(0, 16),
    horamas: horamasDate.toISOString().substring(0, 16)
  };
}
// === FUNCIONES AUXILIARES GLOBALES ===
// Función para ajustar horas
function ajustarHorasEventos(timezone) {
  // Actualizar eventos antiguos
  const eventos = document.querySelectorAll('.evento');
  eventos.forEach((evento) => {
    const horaElement = evento.querySelector('.hora-evento');
    if (horaElement && horaElement.dataset.utc) {
      const horaAjustada = formatLocalTime(horaElement.dataset.utc, timezone);
      horaElement.textContent = horaAjustada;
    }
  });
  // Actualizar nuevos eventos de sportsdb
  const sportsdbTimes = document.querySelectorAll('.sportsdb-time');
  sportsdbTimes.forEach((timeElement) => {
    // Necesitamos obtener el dato UTC original. Para ello, podemos guardarlo en data-utc al crearlo.
    // Pero actualmente no lo guardamos. Para simplificar, recargamos los datos al cambiar zona horaria.
    // Como ya llamamos a fetchData en el evento change, no es necesario actualizar aquí.
    // Sin embargo, si prefieres no recargar todo, tendrías que almacenar el UTC en cada .sportsdb-time.
    // Por simplicidad, confiemos en que fetchData se llama de nuevo.
  });
}

function limpiarUrlImagen(url) {
  if (!url) return null;
  // Si termina en "/tiny", reemplazar por "/medium" o eliminar
  if (url.endsWith('/tiny')) {
    return url.replace('/tiny', '');
  }
  // También podría contener "/tiny/" en medio
  return url.replace(/\/tiny\//, '');
}

function mostrarIframe(url) {
  const iframeContainer = document.getElementById('iframe-container');
  const backgroundOverlay = document.getElementById('background-overlay');
  const iframe = document.getElementById('detalle-iframe');
  iframe.src = url;
  iframeContainer.style.display = 'block';
  backgroundOverlay.style.display = 'block';
}

function cerrarIframe() {
  const iframeContainer = document.getElementById('iframe-container');
  const backgroundOverlay = document.getElementById('background-overlay');
  const iframe = document.getElementById('detalle-iframe');
  iframeContainer.style.display = 'none';
  backgroundOverlay.style.display = 'none';
  iframe.src = '';
}

// --- Función que crea BOTÓN en lugar de enlace (misma lógica de eventos) ---
function crearBotonDesdeDetalle(detalle, textoPersonalizado = null) {
  const boton = document.createElement('button');
  boton.textContent = textoPersonalizado || detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
  boton.classList.add('option-button');

  const url = detalle.f24_url_Final;
  if (!url) return boton;

  if (url.includes("atptour")) {
    boton.textContent = "ATP Tour";
    boton.addEventListener('click', () => window.open(url, '_blank'));
  } else if (url.includes("acestream")) {
    boton.addEventListener('click', () => window.open(url, '_blank'));
  } else if (url.includes("youtube.com")) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const videoId = extraerVideoIdDeYouTube(url);
    if (videoId) {
      if (isMobile) {
        boton.addEventListener('click', () => window.open(`vnd.youtube://${videoId}`, '_blank'));
      } else {
        boton.addEventListener('click', (e) => {
          e.preventDefault();
          mostrarIframe(`https://www.youtube.com/embed/${videoId}?autoplay=1`);
        });
      }
    } else {
      console.error('No se pudo extraer ID de YouTube:', url);
    }
  // Dentro de la función crearBotonDesdeDetalle
  } else if (url.includes('mono.css') || url.includes('/proxy/')) {
      // Botón que usa video.js con proxy CORS
      boton.addEventListener('click', (e) => {
          e.preventDefault();
          mostrarReproductorVideoJs(url, detalle.f22_opcion_Watch);
      });
  }
  else {
  boton.addEventListener('click', (e) => {
    e.preventDefault();
    mostrarIframe(url);
  });
}
  return boton;
}

// Función para limpiar el nombre del canal (eliminar calidades, números, asteriscos)
function limpiarNombreCanal(nombreCompleto) {
  if (!nombreCompleto) return null;
  let limpio = nombreCompleto
    .replace(/\s*\d{3,4}p\s*/gi, ' ')      // elimina 1080p, 720p
    .replace(/\s*FHD\s*/gi, ' ')
    .replace(/\s*HD\s*/gi, ' ')
    .replace(/\s*SD\s*/gi, ' ')
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\s+\d+$/, '')                // elimina números al final
    .replace(/\s+/g, ' ')                  // espacios múltiples a uno
    .trim();
  return limpio;
}

// --- Función para procesar una lista de detalles (web o ace) ---
// --- Función para procesar una lista de detalles ---
function procesarLista(detalles, tipo) {
  const fragment = document.createDocumentFragment();

  // Añadir cabecera con logos si hay elementos
  if (detalles.length > 0) {
    const header = document.createElement('div');
    header.classList.add('options-group-header');
    if (tipo === 'web') {
      header.innerHTML = `
        <span>⚡Canales Web – Mejor si usas :</span>
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 8px;">
            <a href="https://brave.com/download/" target="_blank" style="display: inline-block; line-height: 0;">
              <img src="https://brave.com/static-assets/images/brave-logo-sans-text.svg" alt="Brave" class="rec-logo" style="height: 30px;">
            </a>
            <a href="https://laptop-updates.brave.com/download/BRV040?bitness=64" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.brave.browser" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://apps.apple.com/cl/app/brave-navegador-web-privado/id1052879175" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/K8z0gFmc/applestore.png" alt="iOS" class="rec-logo" style="height: 28px;">
            </a>
          </div>
          <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 8px;">
            <a href="https://www.torproject.org/download/" target="_blank" style="display: inline-block; line-height: 0;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Tor_Browser_icon.svg" alt="Tor Browser" class="rec-logo" style="height: 30px;">
            </a>
            <a href="https://www.torproject.org/dist/torbrowser/15.0.9/tor-browser-windows-x86_64-portable-15.0.9.exe" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://www.torproject.org/download/#android" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://apps.apple.com/us/app/tor-browser-the-onion-vpn/id1144161643" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/K8z0gFmc/applestore.png" alt="iOS" class="rec-logo" style="height: 28px;">
            </a>
          </div>
        </div>
      `;
  } else if (tipo === 'ace') {
  header.innerHTML = `
    <span>🎬Canales Acestream – Calidad superior en video – Necesitas :</span>
    <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: inline-flex; align-items: center; gap: 8px; margin-left: 10px;">
      <a href="https://acestream.org/" target="_blank" style="display: inline-block; line-height: 0;">
        <img src="./images/ace_logo.png" alt="Ace Stream" class="rec-logo rec-logo-ace" style="height: 35px;">
      </a>
      <a href="https://download.acestream.media/products/acestream-full/win/latest" target="_blank" style="display: inline-block;">
        <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo rec-logo-ace" style="height: 28px;">
      </a>
      <a href="https://play.google.com/store/apps/details?id=org.acestream.node" target="_blank" style="display: inline-block;">
        <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo rec-logo-ace" style="height: 28px;">
      </a>
    </div>
  `;
  }
  fragment.appendChild(header);
  }


  // --- LÓGICA DE AGRUPACIÓN: agrupa por nombre base ---
  const grupos = new Map(); // clave: nombreBase, valor: { ordenMinimo, detalles }

  detalles.forEach(detalle => {
    if (!detalle.f22_opcion_Watch?.includes("sin_data")) {
      const nombreCompleto = detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
      const ordenProveedor = detalle._orden_proveedor;
      
      // Limpiar el nombre para agrupar
      const nombreLimpio = limpiarNombreCanal(nombreCompleto);
      
      // Si el nombre limpio es válido, agrupar
      if (nombreLimpio && nombreLimpio.length >= 2) {
        if (!grupos.has(nombreLimpio)) {
          grupos.set(nombreLimpio, {
            ordenMinimo: ordenProveedor,
            detalles: []
          });
        }
        const grupo = grupos.get(nombreLimpio);
        grupo.detalles.push(detalle);
        // Actualizar el orden mínimo del grupo
        if (ordenProveedor < grupo.ordenMinimo) {
          grupo.ordenMinimo = ordenProveedor;
        }
      }
    }
  });

  // Convertir grupos a array y ordenar por ordenMinimo
  const gruposArray = Array.from(grupos.entries()).map(([nombreBase, data]) => ({
    nombreBase,
    orden: data.ordenMinimo,
    detalles: data.detalles
  }));

  // Ordenar grupos por orden (menor a mayor)
  gruposArray.sort((a, b) => a.orden - b.orden);

  // Procesar grupos
  for (const { nombreBase, detalles: detallesGrupo } of gruposArray) {
    const li = document.createElement('li');
    li.classList.add('registro-detalle');

    // Ordenar las opciones dentro del grupo por el número de opción
    const detallesOrdenados = [...detallesGrupo].sort((a, b) => {
      const nombreA = a.f23_text_Idiom || a.f22_opcion_Watch || '';
      const nombreB = b.f23_text_Idiom || b.f22_opcion_Watch || '';
      // Extraer número del final o de "OpX"
      const numA = parseInt(nombreA.match(/(\d+)$/)?.[1] || nombreA.match(/Op(\d+)/)?.[1] || '0');
      const numB = parseInt(nombreB.match(/(\d+)$/)?.[1] || nombreB.match(/Op(\d+)/)?.[1] || '0');
      return numA - numB;
    });

    // Imagen del primer detalle - Siempre mostrar HD.png para Acestream y DLHD
    const primerDetalle = detallesOrdenados[0];
    const imagenIdiom = document.createElement('img');

    // Para Acestream (tipo 'ace') o DLHD, mostrar HD.png
    // if (tipo === 'ace' || primerDetalle.f25_proveedor?.includes("DLHD")) {
    //   imagenIdiom.src = 'images/HD.png';
    //   imagenIdiom.alt = 'HD';
    //   imagenIdiom.classList.add('img-idom');
    //   li.appendChild(document.createTextNode(' | '));
    //   li.appendChild(imagenIdiom);
    // } else 
      if (primerDetalle.f21_imagen_Idiom) {
      // imagenIdiom.src = primerDetalle.f21_imagen_Idiom;
      imagenIdiom.src = proxyImageUrl(primerDetalle.f21_imagen_Idiom);
      imagenIdiom.alt = 'Idiom';
      imagenIdiom.classList.add('img-idom');
      // li.appendChild(document.createTextNode(' | '));
      li.appendChild(imagenIdiom);
    }

    // Nombre del canal
    li.appendChild(document.createTextNode(` ${nombreBase}: `));

    // Añadir botones con "Opc. 1", "Opc. 2", etc.
    detallesOrdenados.forEach((detalle, index) => {
      if (index > 0) li.appendChild(document.createTextNode(' | '));
      const textoBoton = `Op. ${index + 1}`;
      const boton = crearBotonDesdeDetalle(detalle, textoBoton);
      li.appendChild(boton);
    });

    fragment.appendChild(li);
  }

  return fragment;
}

function abrirModalConDetalles(eventData, timezone) {
  const modal = document.getElementById('sportsdb-modal');
  const gridContainer = document.getElementById('modal-grid-container');
  const playerContainer = document.getElementById('modal-player-container');
  const iframe = document.getElementById('modal-iframe');
  const optionsContainer = document.getElementById('player-options');
  const backButton = document.getElementById('back-to-grid');

  const aceContainer = document.getElementById('ace-options-container');
  if (aceContainer) aceContainer.style.display = 'none';  

  if (!modal || !gridContainer || !playerContainer) return;

  // Mostrar grid, ocultar player
  gridContainer.style.display = 'grid';
  playerContainer.style.display = 'none';
  if (iframe) iframe.src = '';

  // Generar el grid de canales (cards)
  generarGridCanales(eventData, gridContainer, playerContainer, backButton, iframe, optionsContainer);

  // Configurar el botón "Volver" (evitar duplicados)
  if (backButton) {
    const newBack = backButton.cloneNode(true);
    backButton.parentNode.replaceChild(newBack, backButton);
    newBack.addEventListener('click', () => {
      gridContainer.style.display = 'grid';
      playerContainer.style.display = 'none';
      if (iframe) iframe.src = '';
    });
  }

  modal.style.display = 'block';
}

function renderOtherEvents(eventos, timezone) {
  const eventosContainer = document.getElementById('eventos-container');
  const eventosContainerTOP = document.getElementById('eventos-container-top');
  eventosContainer.innerHTML = '';
  eventosContainerTOP.innerHTML = '';

  eventos.forEach((data) => {
    const horaUTC = data.f03_dia_event;
    const horaAjustada = formatLocalTime(horaUTC, timezone);

    const eventoDiv = document.createElement('div');
    eventoDiv.classList.add('evento');

    const eventoHeader = document.createElement('div');
    eventoHeader.classList.add('evento-header');
    eventoDiv.appendChild(eventoHeader);

    const infoEventoContainer = document.createElement('div');
    infoEventoContainer.classList.add('info-evento-container');

    if (data.f07_URL_Flag) {
      const banderaImg = document.createElement('img');
      banderaImg.src = proxyImageUrl(data.f07_URL_Flag);
      banderaImg.alt = 'Bandera';
      banderaImg.classList.add('bandera');
      infoEventoContainer.appendChild(banderaImg);
    }

    const categoryEvento = document.createElement('p');
    categoryEvento.textContent = data.f05_event_categoria || '';
    categoryEvento.classList.add('category-evento');
    categoryEvento.style.marginLeft = '20px';
    infoEventoContainer.appendChild(categoryEvento);
    eventoHeader.appendChild(infoEventoContainer);

    const textoImagenesContainer = document.createElement('div');
    textoImagenesContainer.classList.add('texto-imagenes-container');

    const textoEvento = document.createElement('p');
    textoEvento.textContent = data.f06_name_event || '';
    textoEvento.classList.add('texto-evento');
    const textoEventoString = textoEvento.textContent;
    const vsIndex = textoEventoString.toLowerCase().indexOf(' vs ');
    
    if (vsIndex !== -1) {
      const textoEventoIzquierda_vs = textoEventoString.slice(0, vsIndex).trim();
      const textoEventoDerecha_vs = textoEventoString.slice(vsIndex + 3).trim();

      const textoEventoIzquierdaElement = document.createElement('p');
      textoEventoIzquierdaElement.textContent = textoEventoIzquierda_vs;
      textoEventoIzquierdaElement.classList.add('texto-evento-izquierda');
      textoImagenesContainer.appendChild(textoEventoIzquierdaElement);

      const horaEvento = document.createElement('p');
      horaEvento.textContent = `${horaAjustada} `;
      horaEvento.dataset.utc = horaUTC;
      horaEvento.style.width = 'fit-content';
      horaEvento.style.margin = 'auto';
      horaEvento.classList.add('hora-evento');
      textoImagenesContainer.appendChild(horaEvento);

      const textoEventoDerechaElement = document.createElement('p');
      textoEventoDerechaElement.textContent = textoEventoDerecha_vs;
      textoEventoDerechaElement.classList.add('texto-evento-derecha');
      textoImagenesContainer.appendChild(textoEventoDerechaElement);

      if (data.f09_logo_Local) {
        const logoLocalImg = document.createElement('img');
        logoLocalImg.src = proxyImageUrl(data.f09_logo_Local);
        logoLocalImg.alt = 'Logo Local';
        logoLocalImg.classList.add('logo-local');
        logoLocalImg.style.width = '80px';
        logoLocalImg.style.height = 'auto';
        logoLocalImg.style.marginRight = '10px';
        logoLocalImg.classList.add('logo-evento-local');
        textoImagenesContainer.appendChild(logoLocalImg);
        textoImagenesContainer.insertBefore(logoLocalImg, textoEventoIzquierdaElement.nextSibling);
      }

      if (data.f11_logo_Visita) {
        const logoVisitaImg = document.createElement('img');
        logoVisitaImg.src = proxyImageUrl(data.f11_logo_Visita);
        logoVisitaImg.alt = 'Logo Visita';
        logoVisitaImg.classList.add('logo-visita');
        logoVisitaImg.style.width = '80px';
        logoVisitaImg.style.height = 'auto';
        logoVisitaImg.style.marginLeft = '10px';
        logoVisitaImg.classList.add('logo-evento-visita');
        textoImagenesContainer.appendChild(logoVisitaImg);
        textoImagenesContainer.insertBefore(logoVisitaImg, textoEventoDerechaElement);
      }
    } else {
      const horaEvento = document.createElement('p');
      horaEvento.textContent = `${horaAjustada} `;
      horaEvento.dataset.utc = horaUTC;
      horaEvento.style.width = 'fit-content';
      horaEvento.style.margin = 'auto';
      horaEvento.classList.add('hora-evento');
      textoImagenesContainer.appendChild(horaEvento);
      if (textoEvento.textContent.length > 26) {
        categoryEvento.textContent += " | " + textoEvento.textContent;
      } else {
        textoEvento.classList.add('texto-evento-izquierda');
        textoImagenesContainer.appendChild(textoEvento);
      }
    }
    eventoHeader.appendChild(textoImagenesContainer);

    // Evento click para mostrar/ocultar detalle
    eventoHeader.addEventListener('click', () => {
      const detalle = eventoDiv.querySelector('.detalle-evento-container');
      if (detalle) {
        detalle.style.display = detalle.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Crear contenedor de detalles (opciones de stream)
    if (typeof data.f20_Detalles_Evento === 'object' && data.f20_Detalles_Evento !== null) {
      const detallesOrdenados = [...data.f20_Detalles_Evento].sort((a, b) => (a._orden_proveedor || 99) - (b._orden_proveedor || 99));
      
      const detalleEventoContainer = document.createElement('div');
      detalleEventoContainer.classList.add('detalle-evento-container');
      detalleEventoContainer.style.display = 'none';

      const webDetails = detallesOrdenados.filter(d => [1,3,4,5].includes(d._orden_proveedor));
      const aceDetails = detallesOrdenados.filter(d => [6,7,8,9].includes(d._orden_proveedor));

      const eventoDetalle = document.createElement('ul');
      eventoDetalle.classList.add('detalle-evento');

      if (webDetails.length > 0) {
        eventoDetalle.appendChild(procesarLista(webDetails, 'web'));
      }
      if (aceDetails.length > 0) {
        eventoDetalle.appendChild(procesarLista(aceDetails, 'ace'));
      }

      detalleEventoContainer.appendChild(eventoDetalle);
      eventoDiv.appendChild(detalleEventoContainer);

      const numDetalles = data.f20_Detalles_Evento.length;
      if (numDetalles > 20) {
        eventosContainerTOP.appendChild(eventoDiv);
      } else {
        eventosContainer.appendChild(eventoDiv);
      }
    } else {
      console.error("data.f20_Detalles_Evento no es un objeto o es nulo.");
      // Aún así agregamos el eventoDiv sin detalles
      eventosContainer.appendChild(eventoDiv);
    }
  });
}

function renderSportsdbEvents(events, timezone) {
  const container = document.getElementById('eventos-sportsdb-container');
  if (!container) {
    console.warn('No se encontró el contenedor #eventos-sportsdb-container');
    return;
  }
  container.innerHTML = '';

  events.forEach(event => {
    const card = document.createElement('div');
    card.classList.add('sportsdb-card');

    const img = document.createElement('img');
    img.src = proxyImageUrl(event.f07_URL_Flag);
    img.alt = event.f05_event_categoria || 'Evento';
    img.classList.add('sportsdb-img');
    img.loading = 'lazy';

    const infoDiv = document.createElement('div');
    infoDiv.classList.add('sportsdb-info');

    const categoryP = document.createElement('p');
    categoryP.textContent = event.f05_event_categoria || '';
    categoryP.classList.add('sportsdb-category');
    infoDiv.appendChild(categoryP);

    const rowDiv = document.createElement('div');
    rowDiv.classList.add('sportsdb-row');

    const timeLocal = formatLocalTime(event.f03_dia_event, timezone);
    const timeP = document.createElement('span');
    timeP.textContent = timeLocal;
    timeP.classList.add('sportsdb-time');

    const nameP = document.createElement('span');
    nameP.textContent = event.f06_name_event || '';
    nameP.classList.add('sportsdb-name');

    rowDiv.appendChild(timeP);
    // rowDiv.appendChild(document.createTextNode(' - '));
    rowDiv.appendChild(nameP);
    infoDiv.appendChild(rowDiv);

    card.appendChild(img);
    card.appendChild(infoDiv);

    // Click para abrir modal
    card.addEventListener('click', (e) => {
      if (e.target.closest('.option-button')) return;
      abrirModalConDetalles(event, timezone);
    });

    container.appendChild(card);
  });
}

function generarGridCanales(eventData, modalGridContainer, modalPlayerContainer, backButton, iframe, optionsContainer) {
  const detalles = eventData.f20_Detalles_Evento;
  if (!detalles || !Array.isArray(detalles)) return;

  // Separar Acestream (orden 6,7,8,9) y Web (1,3,4,5)
  const aceDetails = detalles.filter(d => [6,7,8,9].includes(d._orden_proveedor));
  const webDetails = detalles.filter(d => [1,3,4,5].includes(d._orden_proveedor));

  // Limpiar contenedor principal
  modalGridContainer.innerHTML = '';

  // Función auxiliar para crear una sección (encabezado + grid de cards)
  function crearSeccion(detallesGrupo, tipo) {
    if (!detallesGrupo.length) return null;

    // Agrupar por nombre base (misma lógica que antes)
    const grupos = new Map();
    detallesGrupo.forEach(detalle => {
      if (detalle.f22_opcion_Watch?.includes("sin_data")) return;
      const nombreCompleto = detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
      const nombreLimpio = limpiarNombreCanal(nombreCompleto);
      if (!nombreLimpio || nombreLimpio.length < 2) return;
      if (!grupos.has(nombreLimpio)) {
        grupos.set(nombreLimpio, []);
      }
      grupos.get(nombreLimpio).push(detalle);
    });

    if (grupos.size === 0) return null;

    // Ordenar grupos por orden mínimo de _orden_proveedor
    const gruposArray = Array.from(grupos.entries()).map(([nombre, detallesArr]) => {
      const ordenMin = Math.min(...detallesArr.map(d => d._orden_proveedor || 99));
      return { nombre, detalles: detallesArr, orden: ordenMin };
    }).sort((a,b) => a.orden - b.orden);

    // Crear contenedor de la sección
    const section = document.createElement('div');
    section.classList.add('channels-section');

    // Crear encabezado (reutilizando el HTML de procesarLista)
    const header = document.createElement('div');
    header.classList.add('options-group-header');
    if (tipo === 'ace') {
      header.innerHTML = `
        <span>🎬 Canales Ace Stream – Calidad FHD – Necesitas :</span>
        <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: inline-flex; align-items: center; gap: 8px; margin-left: 10px;">
          <a href="https://acestream.org/" target="_blank" style="display: inline-block; line-height: 0;">
            <img src="./images/ace_logo.png" alt="Ace Stream" class="rec-logo rec-logo-ace" style="height: 35px;">
          </a>
          <a href="https://download.acestream.media/products/acestream-full/win/latest" target="_blank" style="display: inline-block;">
            <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo" style="height: 28px;">
          </a>
          <a href="https://play.google.com/store/apps/details?id=org.acestream.node" target="_blank" style="display: inline-block;">
            <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo" style="height: 28px;">
          </a>
        </div>
      `;
    } else if (tipo === 'web') {
      header.innerHTML = `
        <span>⚡ Canales Web – Mejor experiencia si usas :</span>
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 8px;">
            <a href="https://brave.com/download/" target="_blank" style="display: inline-block; line-height: 0;">
              <img src="https://brave.com/static-assets/images/brave-logo-sans-text.svg" alt="Brave" class="rec-logo" style="height: 30px;">
            </a>
            <a href="https://laptop-updates.brave.com/download/BRV040?bitness=64" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.brave.browser" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://apps.apple.com/cl/app/brave-navegador-web-privado/id1052879175" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/K8z0gFmc/applestore.png" alt="iOS" class="rec-logo" style="height: 28px;">
            </a>
          </div>
          <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 8px;">
            <a href="https://www.torproject.org/download/" target="_blank" style="display: inline-block; line-height: 0;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Tor_Browser_icon.svg" alt="Tor Browser" class="rec-logo" style="height: 30px;">
            </a>
            <a href="https://www.torproject.org/dist/torbrowser/15.0.9/tor-browser-windows-x86_64-portable-15.0.9.exe" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/D0Px1wWJ/Microsoftstore.png" alt="Windows" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://www.torproject.org/download/#android" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/x836L1kH/androidstore.png" alt="Android" class="rec-logo" style="height: 28px;">
            </a>
            <a href="https://apps.apple.com/us/app/tor-browser-the-onion-vpn/id1144161643" target="_blank" style="display: inline-block;">
              <img src="https://i.postimg.cc/K8z0gFmc/applestore.png" alt="iOS" class="rec-logo" style="height: 28px;">
            </a>
          </div>
        </div>
      `;
    }
    section.appendChild(header);

    // Crear grid para las cards
    const grid = document.createElement('div');
    grid.classList.add('channels-grid'); // usa la clase CSS que ya tiene 8 columnas

    gruposArray.forEach(grupo => {
      const { nombre, detalles: detallesGrupo } = grupo;
      const detallesOrdenados = [...detallesGrupo].sort((a,b) => {
        const numA = parseInt((a.f22_opcion_Watch || '').match(/(\d+)$/)?.[1] || '0');
        const numB = parseInt((b.f22_opcion_Watch || '').match(/(\d+)$/)?.[1] || '0');
        return numA - numB;
      });

      const card = document.createElement('div');
      card.classList.add('channel-card');

      const imgUrl = detallesOrdenados[0].f21_imagen_Idiom;
      if (imgUrl) {
        // Con imagen: mostrar solo la imagen y tooltip
        const cleanUrl = limpiarUrlImagen(imgUrl);
        const img = document.createElement('img');
        img.src = proxyImageUrl(cleanUrl);
        img.alt = nombre;
        img.classList.add('channel-logo');
        card.appendChild(img);
        card.title = nombre;   // tooltip nativo
      } else {
        // Sin imagen: mostrar el nombre centrado
        const nameSpan = document.createElement('div');
        nameSpan.textContent = nombre;
        nameSpan.classList.add('channel-name');
        card.appendChild(nameSpan);
      }

      card.addEventListener('click', () => {
        if (tipo === 'ace') {
          // Para Acestream
          if (detallesOrdenados.length === 1) {
            // Solo una opción: abrir directamente y cerrar modal
            const url = detallesOrdenados[0].f24_url_Final;
            window.open(url, '_blank');
            // document.getElementById('sportsdb-modal').style.display = 'none';
          } else {
            // Múltiples opciones: mostrar el grid de opciones
            mostrarOpcionesAcestream(nombre, detallesOrdenados, modalGridContainer, modalPlayerContainer, iframe, optionsContainer);
          }
        } else {
          // Para Web (y otros) mantener el comportamiento actual
          mostrarReproductorConOpciones(nombre, detallesOrdenados, modalGridContainer, modalPlayerContainer, iframe, optionsContainer);
        }
      });

      grid.appendChild(card);
    });

    section.appendChild(grid);
    return section;
  }

  // Agregar primero la sección Acestream, luego Web
  const aceSection = crearSeccion(aceDetails, 'ace');
  if (aceSection) modalGridContainer.appendChild(aceSection);
  const webSection = crearSeccion(webDetails, 'web');
  if (webSection) modalGridContainer.appendChild(webSection);

  if (!aceSection && !webSection) {
    const noStreams = document.createElement('p');
    noStreams.textContent = 'No hay streams disponibles';
    noStreams.style.color = '#ccc';
    modalGridContainer.appendChild(noStreams);
  }
}

function mostrarOpcionesAcestream(nombreCanal, detallesOrdenados, gridContainer, playerContainer, iframe, optionsContainer) {
  // Ocultar grid principal y reproductor (por si acaso)
  gridContainer.style.display = 'none';
  playerContainer.style.display = 'none';
  
  const aceContainer = document.getElementById('ace-options-container');
  if (!aceContainer) return;
  aceContainer.innerHTML = '';
  aceContainer.style.display = 'block';
  
  
  
  const optionsGrid = document.createElement('div');
  optionsGrid.classList.add('channels-grid');
  
  let imgUrl = detallesOrdenados[0].f21_imagen_Idiom;
  if (imgUrl) imgUrl = limpiarUrlImagen(imgUrl);
  
  detallesOrdenados.forEach((detalle) => {
    const card = document.createElement('div');
    card.classList.add('channel-card');
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = proxyImageUrl(imgUrl);
      img.alt = nombreCanal;
      img.classList.add('channel-logo');
      card.appendChild(img);
    }
    const url = detalle.f24_url_Final;
    const codigo = url.slice(-5);
    const codeSpan = document.createElement('div');
    codeSpan.textContent = codigo;
    codeSpan.classList.add('channel-name');
    card.appendChild(codeSpan);
    card.addEventListener('click', () => {
      window.open(url, '_blank');
      // document.getElementById('sportsdb-modal').style.display = 'none';
    });
    optionsGrid.appendChild(card);
  });
  
  aceContainer.appendChild(optionsGrid);
}

function mostrarReproductorConOpciones(nombreCanal, detallesOrdenados, gridContainer, playerContainer, iframeElement, optionsContainer) {
  gridContainer.style.display = 'none';
  playerContainer.style.display = 'block';

  // Añadir clase player-active al modal-content (esto se encarga de todo)
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) modalContent.classList.add('player-active');

  // Limpiar opciones y cargar primera URL
  optionsContainer.innerHTML = '';
  const primeraUrl = detallesOrdenados[0].f24_url_Final;
  if (primeraUrl) cargarStreamEnIframe(primeraUrl, iframeElement);
  
  detallesOrdenados.forEach((detalle, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `Op. ${idx+1}`;
    btn.classList.add('option-btn');
    btn.addEventListener('click', () => cargarStreamEnIframe(detalle.f24_url_Final, iframeElement));
    optionsContainer.appendChild(btn);
  });
}

function cargarStreamEnIframe(url, iframeElement) {
  if (!url) return;
  // Aquí aplicamos la misma lógica que en crearBotonDesdeDetalle para tipos especiales
  if (url.includes("acestream")) {
    // Para acestream, abrir en nueva ventana (o usar el protocolo)
    window.open(url, '_blank');
    return;
  }
  if (url.includes("youtube.com")) {
    const videoId = extraerVideoIdDeYouTube(url);
    if (videoId) {
      iframeElement.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    } else {
      iframeElement.src = url;
    }
    return;
  }
  if (url.includes('mono.css') || url.includes('/proxy/')) {
    // Usar video.js? Por simplicidad, cargar en iframe (pero puede no funcionar)
    // Podrías llamar a mostrarReproductorVideoJs, pero eso es para overlay.
    // Para el modal, podemos abrir el reproductor video.js aparte.
    // Por ahora, cargamos en iframe.
    iframeElement.src = url;
    return;
  }
  // Normal
  iframeElement.src = url;
}


const fetchData = async (timezone = userTimezone) => {
  try {
      // Consulta sin filtro de hora (trae todos los eventos con detalles)
      const params = {
        TableName: 'eventos',
        FilterExpression: 'attribute_exists(f20_Detalles_Evento)'
      };

      const result = await dynamodb.scan(params).promise();

      // Limpiar contenedores
      const eventosContainer = document.getElementById('eventos-container');
      const eventosContainerTOP = document.getElementById('eventos-container-top');
      eventosContainer.innerHTML = '';
      eventosContainerTOP.innerHTML = '';

      // Ordenar todos los eventos por fecha (más reciente primero)
      const eventosOrdenados = result.Items?.filter(item =>
        typeof item.f03_dia_event === 'string'
      ).sort((a, b) =>
        new Date(b.f03_dia_event) - new Date(a.f03_dia_event)
      ) || [];

      // Calcular rango de hora actual (para filtrar eventos normales)
      const { horamenos, horamas } = getTimeRange();

      const sportsdbEvents = [];
      const otherEvents = [];

      eventosOrdenados.forEach(item => {
        const isSportsdb = item.f07_URL_Flag && item.f07_URL_Flag.includes('thesportsdb.com');
        
        if (isSportsdb) {
          // Excluir solo si el proveedor es exactamente "Bases"
          if (item.f02_proveedor === 'Bases') return;
          sportsdbEvents.push(item);
        } else {
          // Para eventos normales: filtro de hora o LiveTV
          const inTimeRange = item.f03_dia_event >= horamenos && item.f03_dia_event <= horamas;
          const isLiveTV = item.f02_proveedor && item.f02_proveedor.includes('LiveTV');
          if (inTimeRange || isLiveTV) {
            otherEvents.push(item);
          }
        }
      });

      // Ordenar sportsdbEvents por número de detalles (de mayor a menor)
      sportsdbEvents.sort((a, b) => {
        const lenA = a.f20_Detalles_Evento ? a.f20_Detalles_Evento.length : 0;
        const lenB = b.f20_Detalles_Evento ? b.f20_Detalles_Evento.length : 0;
        return lenB - lenA;
      });      

      // Renderizar
      if (sportsdbEvents.length > 0) {
        renderSportsdbEvents(sportsdbEvents, timezone);
      }
      renderOtherEvents(otherEvents, timezone);

    } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};


// Función para mostrar el reproductor video.js con un stream HLS
function mostrarReproductorVideoJs(streamUrl, titulo) {
    const container = document.getElementById('videojs-container');
    const videoElement = document.getElementById('my-video');
    const closeBtn = document.getElementById('close-videojs');
    
    // Si ya existe un reproductor, lo destruimos
    if (window.videojsPlayer) {
        window.videojsPlayer.dispose();
        window.videojsPlayer = null;
    }
    
    // Limpiar el elemento video (por si acaso)
    videoElement.innerHTML = '';
    
    // Mostrar el contenedor y el overlay (si usas uno)
    container.style.display = 'block';
    const overlay = document.getElementById('background-overlay');
    if (overlay) overlay.style.display = 'block';
    
    // Configurar el botón de cierre
    closeBtn.onclick = () => {
        if (window.videojsPlayer) {
            window.videojsPlayer.dispose();
            window.videojsPlayer = null;
        }
        container.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    };
    
    // Inicializar video.js
    window.videojsPlayer = videojs(videoElement, {
        controls: true,
        autoplay: true,
        preload: 'auto',
        html5: {
            hls: {
                overrideNative: true,
                debug: false
            }
        }
    });
    
    // Usar un proxy CORS (por ejemplo corsfix) para evitar problemas de CORS
    // Si ya tienes la URL con el proxy, la usas directamente; si no, lo añades.
    let proxyUrl = streamUrl;
    if (!streamUrl.includes('corsfix.com') && !streamUrl.includes('cors-anywhere')) {
        proxyUrl = 'https://corsfix.com/' + streamUrl;
    }
    
    // Cargar el stream (tipo HLS)
    window.videojsPlayer.src({ src: proxyUrl, type: 'application/vnd.apple.mpegurl' });
    
    window.videojsPlayer.ready(() => {
        console.log('Reproductor video.js listo para:', titulo);
    });
    
    window.videojsPlayer.on('error', () => {
        const error = window.videojsPlayer.error();
        console.error('Error en video.js:', error);
        // Opcional: mostrar mensaje al usuario
    });
}


// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Configurar selector de zonas horarias
  const timezoneSelect = document.getElementById("timezone-select");
  const timezones = Intl.supportedValuesOf("timeZone");

  timezones.forEach(zone => {
    const option = document.createElement("option");
    option.value = zone;
    option.textContent = zone;
    timezoneSelect.appendChild(option);
  });

  timezoneSelect.value = userTimezone;

  // Cargar datos iniciales
  fetchData().then(() => {
    ajustarHorasEventos(userTimezone);
  });

  // Manejar cambio de zona horaria
  timezoneSelect.addEventListener('change', (event) => {
    userTimezone = event.target.value;
    // Primero ajusta las horas de los eventos existentes
    ajustarHorasEventos(userTimezone);

    // Luego recarga los datos para el nuevo rango horario
    fetchData(userTimezone);
  });

  const closeButton = document.getElementById('close-button');
  if (closeButton) {
    closeButton.addEventListener('click', cerrarIframe);
  }  

  // Cambio de tema Light/Dark
  const themeToggle = document.getElementById('theme-toggle');
  const logoImg = document.querySelector('.logo-image-small');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      const isLight = document.body.classList.contains('light-mode');
      themeToggle.textContent = isLight ? '🌙' : '☀️';
      
      // Cambiar el logo según el tema
      if (logoImg) {
        logoImg.src = isLight ? './images/HDeportesBanner_dark.png' : './images/HDeportesBanner.png';
      }
    });
  }

  // Cerrar modal al hacer clic en la X o fuera del contenido
  // Configurar modal de sportsdb con comportamiento inteligente
  const modal = document.getElementById('sportsdb-modal');
  const closeSpan = document.querySelector('.modal-close');
  const gridContainerModal = document.getElementById('modal-grid-container');
  const playerContainerModal = document.getElementById('modal-player-container');
  const modalIframe = document.getElementById('modal-iframe');

  function handleCloseOrBack() {
    const modalContent = document.querySelector('.modal-content');
    const gridContainer = document.getElementById('modal-grid-container');
    const playerContainer = document.getElementById('modal-player-container');
    const aceContainer = document.getElementById('ace-options-container');
    const iframe = document.getElementById('modal-iframe');

    // Si el contenedor de opciones de Acestream está visible
    if (aceContainer && aceContainer.style.display === 'block') {
      aceContainer.style.display = 'none';
      gridContainer.style.display = 'grid';
      // Si estaba en modo reproductor, quitar la clase (por si acaso)
      if (modalContent) modalContent.classList.remove('player-active');
      return;
    }

    // Si el reproductor web está visible
    if (playerContainer && playerContainer.style.display === 'block') {
      gridContainer.style.display = 'grid';
      playerContainer.style.display = 'none';
      if (iframe) iframe.src = '';
      if (modalContent) modalContent.classList.remove('player-active');
      return;
    }

    // En cualquier otro caso (grid principal visible), cerrar el modal
    document.getElementById('sportsdb-modal').style.display = 'none';
  }

  if (modal && closeSpan) {
    closeSpan.onclick = handleCloseOrBack;
    window.onclick = (event) => {
      if (event.target == modal) handleCloseOrBack();
    };
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.style.display === 'block') handleCloseOrBack();
    });
  }

});

// Búsqueda
// Búsqueda (filtra tanto eventos antiguos como tarjetas sportsdb)
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    
    // Filtrar eventos antiguos (clase .evento)
    const eventos = document.querySelectorAll('.evento');
    eventos.forEach(evento => {
      const textoEvento = evento.textContent.toLowerCase();
      evento.style.display = textoEvento.includes(searchTerm) ? 'block' : 'none';
    });
    
    // Filtrar tarjetas sportsdb (clase .sportsdb-card)
    const cards = document.querySelectorAll('.sportsdb-card');
    cards.forEach(card => {
      const textoCard = card.textContent.toLowerCase();
      card.style.display = textoCard.includes(searchTerm) ? 'block' : 'none';
    });
  });
}
