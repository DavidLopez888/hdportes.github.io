// Configurar las credenciales de AWS
AWS.config.update({
  region: 'us-east-1',
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

          // --- INICIO DE LA LÓGICA DE AGRUPACIÓN MEJORADA ---
          const opcionesAgrupadas = {};
          const opcionesSueltas = [];

          // Función para obtener el nombre base del canal (sin el número final)
          function obtenerNombreBaseCanal(nombreCompleto) {
            if (!nombreCompleto) return null;
            
            // Buscar patrones como "ESPN+ USA 1", "ESPN 2 1", etc.
            // Eliminar números al final y espacios
            const match = nombreCompleto.match(/^(.*?)(?:\s+\d+)?$/);
            return match ? match[1].trim() : nombreCompleto;
          }

          // 1. Separar y agrupar las opciones
          data.f20_Detalles_Evento.forEach(detalle => {
            if (!detalle.f22_opcion_Watch?.includes("sin_data")) {
              // Obtener el nombre del canal
              const nombreCompleto = detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
              
              // Si tiene _orden_proveedor = 1, intentamos agruparlo por nombre base
              if (detalle._orden_proveedor === 1 && nombreCompleto) {
                const nombreBase = obtenerNombreBaseCanal(nombreCompleto);
                
                if (!opcionesAgrupadas[nombreBase]) {
                  opcionesAgrupadas[nombreBase] = [];
                }
                opcionesAgrupadas[nombreBase].push(detalle);
              } else {
                opcionesSueltas.push(detalle);
              }
            }
          });

          // 2. Función auxiliar para crear enlaces
          function crearEnlaceDesdeDetalle(detalle, textoEnlace = null) {
            const enlace = document.createElement('a');
            enlace.href = detalle.f24_url_Final;
            enlace.textContent = textoEnlace || detalle.f23_text_Idiom || detalle.f22_opcion_Watch;
            
            const url = enlace.href;
            
            if (url.includes("atptour")) {
              enlace.target = "_blank";
              if (url.includes("atptour")) {
                enlace.textContent = "ATP Tour";
              }
            } else if (url.includes("acestream")) {
              enlace.target = "_blank";
            } else if (url.includes("youtube.com")) {
              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
              const videoId = extraerVideoIdDeYouTube(url);
              if (videoId) {
                if (isMobile) {
                  enlace.href = `vnd.youtube://${videoId}`;
                  enlace.target = "_blank";
                } else {
                  enlace.addEventListener('click', function(event) {
                    event.preventDefault();
                    mostrarIframe(`https://www.youtube.com/embed/${videoId}?autoplay=1`);
                  });
                }
              } else {
                console.error('No se pudo extraer el ID del video de YouTube de la URL:', url);
              }
            } else {
              enlace.addEventListener('click', function(event) {
                event.preventDefault();
                mostrarIframe(enlace.href);
              });
            }
            return enlace;
          }


          // 3. Procesar las opciones agrupadas
          for (const [nombreBase, detalles] of Object.entries(opcionesAgrupadas)) {
            const detalleLi = document.createElement('li');
            detalleLi.classList.add('registro-detalle');

            // Ordenar las opciones por su nombre completo para mantener el orden numérico
            const detallesOrdenados = [...detalles].sort((a, b) => {
              const nombreA = a.f23_text_Idiom || a.f22_opcion_Watch || '';
              const nombreB = b.f23_text_Idiom || b.f22_opcion_Watch || '';
              return nombreA.localeCompare(nombreB, undefined, { numeric: true });
            });

            // Añadir imagen del idioma (tomamos la del primer detalle del grupo)
            const primerDetalle = detallesOrdenados[0];
            const imagenIdiom = document.createElement('img');
            
            if (primerDetalle.f25_proveedor?.includes("DLHD")) {
              imagenIdiom.src = 'images/HD.png';
              imagenIdiom.alt = 'HD';
              imagenIdiom.classList.add('img-idom');
              detalleLi.appendChild(document.createTextNode(' | '));
              detalleLi.appendChild(imagenIdiom);
            } else if (primerDetalle.f21_imagen_Idiom) {
              imagenIdiom.src = primerDetalle.f21_imagen_Idiom;
              imagenIdiom.alt = 'Idiom';
              imagenIdiom.classList.add('img-idom');
              detalleLi.appendChild(document.createTextNode(' | '));
              detalleLi.appendChild(imagenIdiom);
            }

            // Añadir el nombre base del canal
            detalleLi.appendChild(document.createTextNode(` ${nombreBase}: `));

            // Añadir cada opción del grupo como un enlace separado por "|"
            detallesOrdenados.forEach((detalle, index) => {
              if (index > 0) {
                detalleLi.appendChild(document.createTextNode(' | '));
              }
              
              // Extraer el número de la opción del nombre completo
              const nombreCompleto = detalle.f23_text_Idiom || detalle.f22_opcion_Watch || '';
              const numeroMatch = nombreCompleto.match(/(\d+)$/);
              let textoOpcion = '';
              
              if (detalle.f23_text_Idiom && detalle.f23_text_Idiom !== nombreBase) {
                textoOpcion = detalle.f23_text_Idiom;
              } else if (detalle.f22_opcion_Watch && detalle.f22_opcion_Watch !== nombreBase) {
                textoOpcion = detalle.f22_opcion_Watch;
              }
              
              // Si encontramos un número al final, mostrar solo el número
              if (numeroMatch) {
                textoOpcion = numeroMatch[1];
              } else if (textoOpcion) {
                // Limpiar el texto de opción
                textoOpcion = textoOpcion.replace(nombreBase, '').trim();
              }
              
              // Si después de todo sigue vacío, usar "Opción X"
              if (!textoOpcion) {
                textoOpcion = `${index + 1}`;
              }
              
              const prefijo = 'Opc. '; // Cambia a 'Opc ' si prefieres más corto
              textoOpcion = prefijo + textoOpcion;              
              
              const enlace = crearEnlaceDesdeDetalle(detalle, textoOpcion);
              detalleLi.appendChild(enlace);
            });

            eventoDetalle.appendChild(detalleLi);
          }


          // 4. Procesar las opciones sueltas (las que no se agruparon)
          opcionesSueltas.forEach(detalle => {
            const detalleLi = document.createElement('li');
            detalleLi.classList.add('registro-detalle');

            // Imagen de idioma
            const imagenIdiom = document.createElement('img');
            if (detalle.f25_proveedor?.includes("DLHD")) {
              imagenIdiom.src = 'images/HD.png';
              imagenIdiom.alt = 'HD';
              imagenIdiom.classList.add('img-idom');
              detalleLi.appendChild(document.createTextNode(' | '));
              detalleLi.appendChild(imagenIdiom);
            } else if (detalle.f21_imagen_Idiom) {
              imagenIdiom.src = detalle.f21_imagen_Idiom;
              imagenIdiom.alt = 'Idiom';
              imagenIdiom.classList.add('img-idom');
              detalleLi.appendChild(document.createTextNode(' | '));
              detalleLi.appendChild(imagenIdiom);
            }

            // Texto del idioma y enlace
            if (detalle.f23_text_Idiom && detalle.f24_url_Final) {
              detalleLi.appendChild(document.createTextNode(' | '));
              const enlace = crearEnlaceDesdeDetalle(detalle);
              detalleLi.appendChild(enlace);
            }

            // Opción Watch
            if (detalle.f22_opcion_Watch && detalle.f24_url_Final) {
              detalleLi.appendChild(document.createTextNode(' | '));
              const enlaceWatch = crearEnlaceDesdeDetalle(detalle);
              detalleLi.appendChild(enlaceWatch);
            }

            eventoDetalle.appendChild(detalleLi);
          });
          // --- FIN DE LA LÓGICA DE AGRUPACIÓN MEJORADA ---

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