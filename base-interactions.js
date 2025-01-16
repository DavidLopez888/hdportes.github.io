// Configura las credenciales de AWS
AWS.config.update({
  accessKeyId: 'AKIATCKAQMEJNSIO64FE',
  secretAccessKey: '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',
  region: 'us-east-1'
});

// Crea una instancia de DynamoDB
var dynamodb = new AWS.DynamoDB();

function extraerVideoIdDeYouTube(url) {
  const regex = /(?:embed\/|watch\?v=)([^?&]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log('Zona horaria:', zonaHoraria);

// Obtener la hora actual en UTC
const horaActualUTC = new Date().toISOString().substring(0, 16); // Formato "YYYY-MM-DDTHH:mm"

// Calcular hora menos 120 minutos
const horamenosDate = new Date(new Date().getTime() - 120 * 60000).toISOString().substring(0, 16);
const horamenos = horamenosDate;

// Calcular hora mas 15 minutos
const horamasDate = new Date(new Date().getTime() + 25 * 60000).toISOString().substring(0, 16);
const horamas = horamasDate;

const fetchData = async () => {
  try {
      const params = {
        TableName: 'eventos',
        FilterExpression: 'attribute_exists(f03_dia_event) AND (#f03_dia_event >= :horamenos AND #f03_dia_event <= :horamas) OR contains(#proveedor, :proveedor) AND attribute_exists(f20_Detalles_Evento)',
        ExpressionAttributeNames: {
          '#f03_dia_event': 'f03_dia_event',
          '#proveedor': 'f02_proveedor'
        },
        ExpressionAttributeValues: {
          ':horamenos': { 'S': horamenos },
          ':horamas': { 'S': horamas },
          ':proveedor': { 'S': 'LiveTV' }
        }
      };

      const result = await dynamodb.scan(params).promise();
      const eventosContainer = document.getElementById('eventos-container');
      const eventosContainerTOP = document.getElementById('eventos-container-top');
      eventosContainer.innerHTML = '';
      eventosContainerTOP.innerHTML = '';

      const eventosOrdenados = result.Items ? result.Items.filter(item => {
        return typeof item.f03_dia_event.S === 'string';
      }).sort((a, b) => {
        return new Date(b.f03_dia_event.S).getTime() - new Date(a.f03_dia_event.S).getTime();
      }) : [];

      eventosOrdenados.forEach((doc) => {
        const data = doc;
        const horaUTC = new Date(data.f03_dia_event.S);
        const horaAjustada = horaUTC.toLocaleTimeString('en-US', { hour12: false, timeZone: zonaHoraria }).substring(0, 5);

        const eventoDiv = document.createElement('div');
        eventoDiv.classList.add('evento');

        const eventoHeader = document.createElement('div');
        eventoHeader.classList.add('evento-header');
        eventoDiv.appendChild(eventoHeader);

        const infoEventoContainer = document.createElement('div');
        infoEventoContainer.classList.add('info-evento-container');

        if (data.f07_URL_Flag !== null && typeof data.f07_URL_Flag === 'object' && data.f07_URL_Flag.hasOwnProperty('S')) {
            const banderaImg = document.createElement('img');
            banderaImg.src = data.f07_URL_Flag.S;
            banderaImg.alt = 'Bandera';
            banderaImg.classList.add('bandera');
            infoEventoContainer.appendChild(banderaImg);
        }

        const categoryEvento = document.createElement('p');
        categoryEvento.textContent = `${data.f05_event_categoria && typeof data.f05_event_categoria === 'object' && data.f05_event_categoria.hasOwnProperty('S') ? data.f05_event_categoria.S : ''} `;
        categoryEvento.classList.add('category-evento');
        categoryEvento.style.marginLeft = '20px';
        infoEventoContainer.appendChild(categoryEvento);

        eventoHeader.appendChild(infoEventoContainer);

        const textoImagenesContainer = document.createElement('div');
        textoImagenesContainer.classList.add('texto-imagenes-container');

        const textoEvento = document.createElement('p');
        textoEvento.textContent = `${data.f06_name_event && typeof data.f06_name_event === 'object' && data.f06_name_event.hasOwnProperty('S') ? data.f06_name_event.S : ''}`;
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
          horaEvento.style.width = 'fit-content';
          horaEvento.style.margin = 'auto';
          horaEvento.classList.add('hora-evento');
          textoImagenesContainer.appendChild(horaEvento);

          const textoEventoDerechaElement = document.createElement('p');
          textoEventoDerechaElement.textContent = textoEventoDerecha_vs;
          textoEventoDerechaElement.classList.add('texto-evento-derecha');
          textoImagenesContainer.appendChild(textoEventoDerechaElement);

          if (data.f09_logo_Local !== null && typeof data.f09_logo_Local === 'object' && data.f09_logo_Local.hasOwnProperty('S')) {
            const logoLocalImg = document.createElement('img');
            logoLocalImg.src = data.f09_logo_Local.S;
            logoLocalImg.alt = 'Logo Local';
            logoLocalImg.classList.add('logo-local');
            logoLocalImg.style.width = '80px';
            logoLocalImg.style.height = 'auto';
            logoLocalImg.style.marginRight = '10px';
            logoLocalImg.classList.add('logo-evento-local');
            textoImagenesContainer.appendChild(logoLocalImg);
            textoImagenesContainer.insertBefore(logoLocalImg, textoEventoIzquierdaElement.nextSibling);
          }

          if (data.f11_logo_Visita !== null && typeof data.f11_logo_Visita === 'object' && data.f11_logo_Visita.hasOwnProperty('S')) {
            const logoVisitaImg = document.createElement('img');
            logoVisitaImg.src = data.f11_logo_Visita.S;
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
            data.f20_Detalles_Evento.L.forEach(detalle => {
              if (!detalle.M.f22_opcion_Watch?.S || !detalle.M.f22_opcion_Watch.S.includes("sin_data")) {
                const detalleLi = document.createElement('li');
                if (detalle.M.f21_imagen_Idiom?.S) {
                      const imagenIdiom = document.createElement('img');
                      imagenIdiom.src = detalle.M.f21_imagen_Idiom.S;
                      imagenIdiom.alt = 'Idiom';
                      imagenIdiom.classList.add('img-idom');
                      detalleLi.appendChild(document.createTextNode(' | '));
                      detalleLi.appendChild(imagenIdiom);
                }
                if (detalle.M.f23_text_Idiom?.S && detalle.M.f24_url_Final?.S) {
                  const enlace = document.createElement('a');
                  enlace.href = detalle.M.f24_url_Final.S;
                  enlace.textContent = detalle.M.f23_text_Idiom.S;
                  detalleLi.appendChild(document.createTextNode(' | '));
                  if (enlace.href.includes("atptour")) {
                      enlace.target = "_blank";
                  }
                    else if (enlace.href.includes("youtube.com")) {
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                      const videoId = extraerVideoIdDeYouTube(enlace.href);
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
                          console.error('No se pudo extraer el ID del video de YouTube de la URL:', enlace.href);
                      }
                    }
                  else {
                      enlace.addEventListener('click', function(event) {
                          event.preventDefault();
                          mostrarIframe(enlace.href);
                      });
                  }
                  detalleLi.appendChild(enlace);
                }

                if (detalle.M.f22_opcion_Watch?.S && detalle.M.f24_url_Final?.S) {
                    const enlaceWatch = document.createElement('a');
                    enlaceWatch.href = detalle.M.f24_url_Final.S;
                    enlaceWatch.textContent = detalle.M.f22_opcion_Watch.S;
                    detalleLi.appendChild(document.createTextNode(' | '));
                    if (enlaceWatch.href.includes("atptour") || enlaceWatch.href.includes("acestream")) {
                        enlaceWatch.target = "_blank";
                        if (enlaceWatch.href.includes("atptour")) {
                          enlaceWatch.textContent = "ATP Tour"
                        }
                    }
                      else if (enlaceWatch.href.includes("youtube.com")) {
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        const videoId = extraerVideoIdDeYouTube(enlaceWatch.href);
                        if (videoId) {
                          if (isMobile) {
                              enlaceWatch.href = `vnd.youtube://${videoId}`;
                              enlaceWatch.target = "_blank";
                          } else {
                              enlaceWatch.addEventListener('click', function(event) {
                                  event.preventDefault();
                                  mostrarIframe(`https://www.youtube.com/embed/${videoId}?autoplay=1`);
                              });
                          }
                        } else {
                            console.error('No se pudo extraer el ID del video de YouTube de la URL:', enlaceWatch.href);
                        }
                      }
                    else {
                        enlaceWatch.addEventListener('click', function(event) {
                            event.preventDefault();
                            mostrarIframe(enlaceWatch.href);
                        });
                    }
                    detalleLi.appendChild(enlaceWatch);
                }
                  detalleLi.classList.add('registro-detalle');
                  eventoDetalle.appendChild(detalleLi);
              }
            });
            detalleEventoContainer.appendChild(eventoDetalle);
            eventoDiv.appendChild(detalleEventoContainer);

            const numDetalles = data.f20_Detalles_Evento.L.length;
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

document.addEventListener('DOMContentLoaded', fetchData);

const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const eventos = document.querySelectorAll('.evento');

    eventos.forEach(evento => {
        const textoEvento = evento.textContent.toLowerCase();
        if (textoEvento.includes(searchTerm)) {
            evento.style.display = 'block';
            evento.querySelectorAll('.detalle_evento').forEach(detalle => {
                detalle.style.display = 'block';
            });
        } else {
            evento.style.display = 'none';
        }
    });
});

document.addEventListener("DOMContentLoaded", function () {
  const timezoneSelect = document.getElementById("timezone-select");
  const timezones = Intl.supportedValuesOf("timeZone");

  timezones.forEach(zone => {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone;
      timezoneSelect.appendChild(option);
  });

  timezoneSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
});

document.getElementById('timezone-select').addEventListener('change', (event) => {
  const timezone = event.target.value;
  ajustarHorasEventos(timezone);
});

function ajustarHorasEventos(timezone) {
  const eventos = document.querySelectorAll('.hora-evento');
  eventos.forEach((horaEvento) => {
      const horaOriginal = horaEvento.textContent.trim();
      if (!horaOriginal) return;
      const horaUTC = new Date(`2000-01-01T${horaOriginal}:00Z`);
      const horaAjustada = new Date(horaUTC.toLocaleString("en-US", { timeZone: timezone }));
      const horaFinal = horaAjustada.toISOString().substr(11, 5);
      horaEvento.textContent = horaFinal;
  });
}

const timezoneSelect = document.getElementById('timezone-select');
fetchData().then(() => {
  const selectedTimezone = timezoneSelect.value;
  ajustarHorasEventos(selectedTimezone);
});