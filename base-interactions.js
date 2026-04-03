// Configurar las credenciales de AWS
AWS.config.update({
  region: 'eu-west-1',
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: window._config.aws.identityPoolId
  })
});

// Crear una instancia de DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();

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
  const horamenosDate = new Date(now.getTime() - 120 * 60000);
  const horamasDate = new Date(now.getTime() + 25 * 60000);
  return {
    horamenos: horamenosDate.toISOString().substring(0, 16),
    horamas: horamasDate.toISOString().substring(0, 16)
  };
}


const fetchData = async (timezone = userTimezone) => {
  try {
    const { horamenos, horamas } = getTimeRange();

    const params = {
      TableName: 'eventos',
      FilterExpression: 'attribute_exists(f20_Detalles_Evento) AND ((#f03_dia_event BETWEEN :horamenos AND :horamas) OR (contains(#proveedor, :proveedor)))',
      ExpressionAttributeNames: {
        '#f03_dia_event': 'f03_dia_event',
        '#proveedor': 'f02_proveedor'
      },
      ExpressionAttributeValues: {
        ':horamenos': horamenos,
        ':horamas': horamas,
        ':proveedor': 'LiveTV'
      }
    };

      const result = await dynamodb.scan(params).promise();
      const eventosContainer = document.getElementById('eventos-container');
      const eventosContainerTOP = document.getElementById('eventos-container-top');
      eventosContainer.innerHTML = '';
      eventosContainerTOP.innerHTML = '';

      const eventosOrdenados = result.Items?.filter(item =>
        typeof item.f03_dia_event === 'string'
      ).sort((a, b) =>
        new Date(b.f03_dia_event) - new Date(a.f03_dia_event)
      ) || [];

      eventosOrdenados.forEach((doc) => {
        const data = doc;
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
          banderaImg.src = data.f07_URL_Flag;
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
            logoLocalImg.src = data.f09_logo_Local;
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
            logoVisitaImg.src = data.f11_logo_Visita;
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

        eventoHeader.addEventListener('click', () => {
          const detalle = eventoDiv.querySelector('.detalle-evento-container');
          if (detalle) {
            detalle.style.display = detalle.style.display === 'none' ? 'block' : 'none';
          }
        });


                        
        if (typeof data.f20_Detalles_Evento === 'object' && data.f20_Detalles_Evento !== null) {
          data.f20_Detalles_Evento.sort((a, b) => {
            return (a._orden_proveedor || 99) - (b._orden_proveedor || 99);
          });

          const detalleEventoContainer = document.createElement('div');
          detalleEventoContainer.classList.add('detalle-evento-container');
          detalleEventoContainer.style.display = 'none';

          const closeButton = document.getElementById('close-button');
          const backgroundOverlay = document.getElementById('background-overlay');
          const iframeContainer = document.getElementById('iframe-container');
          const iframe = document.getElementById('detalle-iframe');

          function cerrarIframe() {
            iframeContainer.style.display = 'none';
            backgroundOverlay.style.display = 'none';
            iframe.src = '';
          }
          closeButton.addEventListener('click', cerrarIframe);

          function mostrarIframe(url) {
            iframe.src = url;
            iframeContainer.style.display = 'block';
            backgroundOverlay.style.display = 'block';
          }

          const eventoDetalle = document.createElement('ul');
          eventoDetalle.classList.add('detalle-evento');

          // --- Separar web (1,3,4,5) y acestream (6-10) para las cabeceras ---
          const webDetails = data.f20_Detalles_Evento.filter(d => [1, 3, 4, 5].includes(d._orden_proveedor));
          const aceDetails = data.f20_Detalles_Evento.filter(d => [6, 7, 8, 9, 10].includes(d._orden_proveedor));

          // --- Funciones auxiliares para obtener nombre base ---
          function obtenerNombreBaseCanal(nombreCompleto) {
            if (!nombreCompleto) return null;
            const match = nombreCompleto.match(/^(.*?)(?:\s+\d+)?$/);
            return match ? match[1].trim() : nombreCompleto;
          }

          function obtenerNombreBaseCanalAce(nombreCompleto) {
            if (!nombreCompleto) return null;
            // Elimina " Op1", " Op2", etc. al final (espacio + Op + número)
            const match = nombreCompleto.match(/^(.*?)(?:\s+Op\d+)?$/);
            return match ? match[1].trim() : nombreCompleto;
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
            } else {
              boton.addEventListener('click', (e) => {
                e.preventDefault();
                mostrarIframe(url);
              });
            }
            return boton;
          }

          // --- Función para procesar una lista de detalles (web o ace) ---
          function procesarLista(detalles, tipo) {
            const fragment = document.createDocumentFragment();

            // Añadir cabecera con logos si hay elementos
            if (detalles.length > 0) {
              const header = document.createElement('div');
              header.classList.add('options-group-header');
              if (tipo === 'web') {
                header.innerHTML = `
                  <span>⚡Canales Web – Mejor experiencia con :</span>
                  <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <!-- Brave Section -->
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
                    <!-- Tor Section -->
                    <div style="border: 1px solid rgba(75, 85, 99, 0.5); border-radius: 12px; padding: 5px 5px; background: rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 8px;">
                      <a href="https://www.torproject.org/download/" target="_blank" style="display: inline-block; line-height: 0;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c9/Tor_Browser_icon.svg" alt="Tor Browser" class="rec-logo" style="height: 30px;">
                      </a>
                      <a href="https://www.torproject.org/dist/torbrowser/15.0.8/tor-browser-windows-x86_64-portable-15.0.8.exe" target="_blank" style="display: inline-block;">
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


            // --- LÓGICA DE AGRUPACIÓN MEJORADA: agrupa orden 1 y orden 10 ---
            const opcionesAgrupadas = {};   // clave: nombreBase, valor: array de detalles
            const opcionesSueltas = [];

            detalles.forEach(detalle => {
              if (!detalle.f22_opcion_Watch?.includes("sin_data")) {
                const nombreCompleto = detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
                let agrupar = false;
                let nombreBase = null;

                if (detalle._orden_proveedor === 1 && nombreCompleto) {
                  nombreBase = obtenerNombreBaseCanal(nombreCompleto);
                  if (nombreBase) agrupar = true;
                } else if (detalle._orden_proveedor === 10 && nombreCompleto) {
                  nombreBase = obtenerNombreBaseCanalAce(nombreCompleto);
                  if (nombreBase) agrupar = true;
                }

                if (agrupar) {
                  if (!opcionesAgrupadas[nombreBase]) opcionesAgrupadas[nombreBase] = [];
                  opcionesAgrupadas[nombreBase].push(detalle);
                } else {
                  opcionesSueltas.push(detalle);
                }
              }
            });

            // Procesar grupos (tanto orden 1 como orden 10)
            for (const [nombreBase, detallesGrupo] of Object.entries(opcionesAgrupadas)) {
              const li = document.createElement('li');
              li.classList.add('registro-detalle');

              // Ordenar las opciones numéricamente según el número de opción (Op1, Op2, etc.)
              const detallesOrdenados = [...detallesGrupo].sort((a, b) => {
                const nombreA = a.f23_text_Idiom || a.f22_opcion_Watch || '';
                const nombreB = b.f23_text_Idiom || b.f22_opcion_Watch || '';
                // Extraer número (puede ser solo un dígito al final o "OpX")
                const numA = parseInt(nombreA.match(/(\d+)$/)?.[1] || nombreA.match(/Op(\d+)/)?.[1] || '0');
                const numB = parseInt(nombreB.match(/(\d+)$/)?.[1] || nombreB.match(/Op(\d+)/)?.[1] || '0');
                return numA - numB;
              });

              // Imagen del primer detalle
              const primerDetalle = detallesOrdenados[0];
              const imagenIdiom = document.createElement('img');
              if (primerDetalle.f25_proveedor?.includes("DLHD")) {
                imagenIdiom.src = 'images/HD.png';
                imagenIdiom.alt = 'HD';
                imagenIdiom.classList.add('img-idom');
                li.appendChild(document.createTextNode(' | '));
                li.appendChild(imagenIdiom);
              } else if (primerDetalle.f21_imagen_Idiom) {
                imagenIdiom.src = primerDetalle.f21_imagen_Idiom;
                imagenIdiom.alt = 'Idiom';
                imagenIdiom.classList.add('img-idom');
                li.appendChild(document.createTextNode(' | '));
                li.appendChild(imagenIdiom);
              }

              // Nombre del canal
              li.appendChild(document.createTextNode(` ${nombreBase}: `));

              // Añadir botones separados por " | "
              detallesOrdenados.forEach((detalle, index) => {
                if (index > 0) li.appendChild(document.createTextNode(' | '));
                const textoBoton = `Opc. ${index + 1}`;
                const boton = crearBotonDesdeDetalle(detalle, textoBoton);
                li.appendChild(boton);
              });

              fragment.appendChild(li);
            }

            // Procesar opciones sueltas (no agrupadas, incluye órdenes 3,4,5,6,7,8,9)
            opcionesSueltas.forEach(detalle => {
              const li = document.createElement('li');
              li.classList.add('registro-detalle');

              // Imagen de idioma
              const imagenIdiom = document.createElement('img');
              if (detalle.f25_proveedor?.includes("DLHD")) {
                imagenIdiom.src = 'images/HD.png';
                imagenIdiom.alt = 'HD';
                imagenIdiom.classList.add('img-idom');
                li.appendChild(document.createTextNode(' | '));
                li.appendChild(imagenIdiom);
              } else if (detalle.f21_imagen_Idiom) {
                imagenIdiom.src = detalle.f21_imagen_Idiom;
                imagenIdiom.alt = 'Idiom';
                imagenIdiom.classList.add('img-idom');
                li.appendChild(document.createTextNode(' | '));
                li.appendChild(imagenIdiom);
              }

              // Texto y botón
              if (detalle.f23_text_Idiom && detalle.f24_url_Final) {
                li.appendChild(document.createTextNode(' | '));
                const boton = crearBotonDesdeDetalle(detalle);
                li.appendChild(boton);
              }
              if (detalle.f22_opcion_Watch && detalle.f24_url_Final) {
                li.appendChild(document.createTextNode(' | '));
                const botonWatch = crearBotonDesdeDetalle(detalle);
                li.appendChild(botonWatch);
              }

              fragment.appendChild(li);
            });

            return fragment;
          }

          // Procesar primero las opciones web (con su cabecera)
          if (webDetails.length > 0) {
            eventoDetalle.appendChild(procesarLista(webDetails, 'web'));
          }
          // Procesar las opciones acestream (con su cabecera)
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
        }


      });

  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

// Función para ajustar horas
function ajustarHorasEventos(timezone) {
  const eventos = document.querySelectorAll('.evento');

  eventos.forEach((evento) => {
    const horaElement = evento.querySelector('.hora-evento');
    if (!horaElement || !horaElement.dataset.utc) {
      console.warn('Elemento de hora no encontrado o sin data-utc');
      return;
    }

    const horaAjustada = formatLocalTime(horaElement.dataset.utc, timezone);
    horaElement.textContent = horaAjustada;
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
});

// Búsqueda
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', function() {
  const searchTerm = this.value.toLowerCase();
  const eventos = document.querySelectorAll('.evento');

  eventos.forEach(evento => {
    const textoEvento = evento.textContent.toLowerCase();
    evento.style.display = textoEvento.includes(searchTerm) ? 'block' : 'none';
  });
});

// const searchInput = document.getElementById('search-input');
// searchInput.addEventListener('input', function() {
//     const searchTerm = this.value.toLowerCase();
//     const eventos = document.querySelectorAll('.evento');

//     eventos.forEach(evento => {
//         const textoEvento = evento.textContent.toLowerCase();
//         if (textoEvento.includes(searchTerm)) {
//             evento.style.display = 'block';
//             evento.querySelectorAll('.detalle_evento').forEach(detalle => {
//                 detalle.style.display = 'block';
//             });
//         } else {
//             evento.style.display = 'none';
//         }
//     });
// });

// document.addEventListener("DOMContentLoaded", function () {
//   const timezoneSelect = document.getElementById("timezone-select");
//   const timezones = Intl.supportedValuesOf("timeZone");

//   timezones.forEach(zone => {
//       const option = document.createElement("option");
//       option.value = zone;
//       option.textContent = zone;
//       timezoneSelect.appendChild(option);
//   });

//   timezoneSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
// });

// document.getElementById('timezone-select').addEventListener('change', (event) => {
//   const timezone = event.target.value;
//   ajustarHorasEventos(timezone);
// });



// const timezoneSelect = document.getElementById('timezone-select');
// fetchData().then(() => {
//   const selectedTimezone = timezoneSelect.value;
//   ajustarHorasEventos(selectedTimezone);
// });