// Configura las credenciales de AWS
AWS.config.update({
  accessKeyId: 'AKIATCKAQMEJNSIO64FE',
  secretAccessKey: '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',
  region: 'us-east-1'
});

// Crea una instancia de DynamoDB
var dynamodb = new AWS.DynamoDB();

// Funcion para obtener la diferencia horaria entre el UTC-6 y la ubicacion del usuario
async function obtenerDiferenciaHorariaUsuario() {
  try {
    const ubicacionUsuario = await obtenerUbicacionUsuario();
    if (ubicacionUsuario) {
      const zonaHorariaUsuario = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const diferenciaHoraria = obtenerDiferenciaHoraria("Etc/GMT+5", zonaHorariaUsuario);
      return diferenciaHoraria;
    } else {
      console.warn("La geolocalizacion no esta disponible o no se ha proporcionado permiso.");
      return 0;
    }
  } catch (error) {
    console.error("Error al obtener la diferencia horaria del usuario:", error);
    return 0;
  }
}

// Funcion para obtener la ubicacion actual del usuario usando la API de geolocalizacion
function obtenerUbicacionUsuario() {
  return new Promise(async (resolve, reject) => {
    try {
      const permiso = await navigator.permissions.query({ name: 'geolocation' });

      if (permiso.state === 'granted') {
        // El permiso ya esta otorgado, obtener la ubicacion
        navigator.geolocation.getCurrentPosition(resolve, reject);
      } else if (permiso.state === 'prompt') {
        // El permiso aun no se ha otorgado, solicitarlo y luego obtener la ubicacion
        navigator.geolocation.getCurrentPosition(resolve, reject);
      } else {
        // El permiso fue denegado o esta bloqueado, mostrar un mensaje
        console.warn("La geolocalizacion no esta disponible o no se ha proporcionado permiso.");
        reject("Permiso de geolocalizacion denegado");
      }
    } catch (error) {
      console.error("Error al verificar el permiso de geolocalizacion:", error);
      reject(error);
    }
  });
}

// Nueva función para obtener la ciudad y país de las coordenadas usando Nominatim
async function obtenerCiudad(latitud, longitud) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json&addressdetails=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.address) {
      const ciudad = data.address.city || data.address.town || data.address.village || "Desconocida"; // Obtiene la ciudad, pueblo o aldea
      const pais = data.address.country || "Desconocido"; // Obtiene el país
      return `${ciudad}, ${pais}`;
    } else {
      console.error("No se pudo obtener la dirección:", data);
      return null;
    }
  } catch (error) {
    console.error("Error al obtener la ciudad:", error);
    return null;
  }
}

// Nueva función para guardar la visita en DynamoDB
async function guardarVisitaEnDynamoDB(latitud, longitud, ciudad, userAgent) {
  const fechaVisita = new Date().toISOString(); // Formato de fecha ISO

  // Determina el tipo de dispositivo a partir del User-Agent
  const dispositivo = /Mobi|Android/i.test(userAgent) ? "Móvil" : "PC/Escritorio";

  const params = {
    TableName: 'registro_visitas',
    Item: {
      'fecha_visita': { S: fechaVisita },
      'lugar_visita': { S: `Lat: ${latitud}, Long: ${longitud}` }, // Guarda la ubicación como un string
      'ciudad': { S: ciudad || "Desconocida" }, // Guarda la ciudad
      'user_agent': { S: dispositivo } // Guarda solo el tipo de dispositivo
    }
  };

  try {
    await dynamodb.putItem(params).promise();
    console.log("Visita guardada en DynamoDB exitosamente.");
  } catch (error) {
    console.error("Error al guardar la visita en DynamoDB:", error);
  }
}

// Llama a la función para obtener la ubicación del usuario y guardar la visita
async function registrarVisita() {
  try {
    const posicion = await obtenerUbicacionUsuario();
    const latitud = posicion.coords.latitude;
    const longitud = posicion.coords.longitude;
    const userAgent = navigator.userAgent; // Obtener el user agent

    // Obtener ciudad y país
    const ciudad = await obtenerCiudad(latitud, longitud);

    // Llamar a la función para guardar la visita
    await guardarVisitaEnDynamoDB(latitud, longitud, ciudad, userAgent);
  } catch (error) {
    console.error("Error al registrar la visita:", error);
  }
}

document.addEventListener('DOMContentLoaded', registrarVisita);

// Funcion para calcular la diferencia horaria entre dos zonas horarias
function obtenerDiferenciaHoraria(zonaHoraria1, zonaHoraria2) {
  const fechaActual = new Date();
  const offset1 = fechaActual.getTimezoneOffsetForZone(zonaHoraria1);
  const offset2 = fechaActual.getTimezoneOffsetForZone(zonaHoraria2);
  return (offset2 - offset1) / 60; // Devuelve la diferencia en horas
}

// Agrega este metodo al prototipo de Date para obtener el offset en minutos
Date.prototype.getTimezoneOffsetForZone = function (timeZone) {
  const utcDate = new Date(this.toLocaleString("en-US", { timeZone: "UTC" }));
  const localDate = new Date(this.toLocaleString("en-US", { timeZone }));
  return (localDate - utcDate) / (60 * 1000); // Devuelve el offset en minutos
};

// Funcion para ajustar la hora del evento segun la diferencia horaria
function ajustarHoraEvento(horaEvento, diferenciaHoraria) {
  // Parsear la hora del evento a un objeto Date
  // Acceder al valor de la propiedad 'S' dentro del objeto horaEvento
  const horaOriginal = new Date(`2000-01-01T${horaEvento.S}:00Z`);
  // Sumar la diferencia horaria en minutos
  horaOriginal.setHours(horaOriginal.getHours() + diferenciaHoraria);

  // Formatear la hora ajustada a un string en formato HH:mm
  const horaAjustada = horaOriginal.toISOString().substr(11, 5);

  return horaAjustada;
}

// Calcular la diferencia de horas entre dos horas en formato HH:mm
function calcularDiferenciaHoras(hora1, hora2) {
  const [hora1Horas, hora1Minutos] = hora1.split(':').map(Number);
  const [hora2Horas, hora2Minutos] = hora2.split(':').map(Number);

  const diferenciaHoras = hora2Horas - hora1Horas;
  const diferenciaMinutos = hora2Minutos - hora1Minutos;

  return diferenciaHoras * 60 + diferenciaMinutos;
}

function extraerVideoIdDeYouTube(url) {
  const regex = /(?:embed\/|watch\?v=)([^?&]+)/; // Esta expresión regular busca 'embed/' o 'watch?v=' seguido de cualquier cosa hasta un '?' o '&'
  const match = url.match(regex);
  return match ? match[1] : null; // Devuelve el grupo capturado que contiene el ID del video o null si no se encuentra
}

// Obtener la hora actual en la zona horaria del sistema local
const horaActual = new Date();
// Obtener el desplazamiento horario de la zona horaria del sistema local
const offsetLocal = horaActual.getTimezoneOffset();
// Calcular el desplazamiento horario para la zona horaria de Colombia (UTC-5)
const offsetColombia = -5 * 60; // Colombia esta 5 horas detras de UTC
// Calcular la hora en Colombia sumando el desplazamiento horario
const horaColombia = new Date(horaActual.getTime() + (offsetColombia + offsetLocal) * 60 * 1000);
// Formatear la hora en formato HH:mm
const horaEjecucionUsuarioCo = horaColombia.toTimeString().substring(0, 5);
const horaEjecucionUsuario = new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5);
//const horaEjecucionUsuarioCo  = new Date().toLocaleTimeString('es-CO', { hour12: false }).substring(0, 5);

// Convertir horaEjecucionUsuarioCo a objeto Date
const horaEjecucionUsuarioCoDate = new Date();
horaEjecucionUsuarioCoDate.setHours(parseInt(horaEjecucionUsuarioCo.substring(0, 2), 10));
horaEjecucionUsuarioCoDate.setMinutes(parseInt(horaEjecucionUsuarioCo.substring(3, 5), 10));

// Calcular hora menos 120 minutos
const horamenosDate = new Date(horaEjecucionUsuarioCoDate.getTime() - 120 * 60000);
const horamenos = horamenosDate.toTimeString().substring(0, 5);

// Calcular hora mas 15 minutos
const horamasDate = new Date(horaEjecucionUsuarioCoDate.getTime() + 25 * 60000);
const horamas = horamasDate.toTimeString().substring(0, 5);

const fetchData = async () => {
  try {
      const params = {
        TableName: 'eventos',
        FilterExpression: 'attribute_exists(f04_hora_event) AND ((#f04_hora_event >= :horamenos AND #f04_hora_event <= :horamas) OR contains(#proveedor, :proveedor)) AND attribute_exists(f20_Detalles_Evento)',
        ExpressionAttributeNames: {
          '#f04_hora_event': 'f04_hora_event',
          '#proveedor': 'f02_proveedor'
        },
        ExpressionAttributeValues: {
          ':horamenos': { 'S': horamenos },
          ':horamas': { 'S': horamas },
          ':proveedor': { 'S': 'LiveTV' }
        }
      };

      const result = await dynamodb .scan(params).promise();
      // const params = {TableName: 'eventos',};
      // const result = await dynamodb.scan(params).promise();
      const eventosContainer = document.getElementById('eventos-container');
      const diferenciaHorariaUsuario = await obtenerDiferenciaHorariaUsuario();
      // Limpiar el contenido actual del contenedor
      eventosContainer.innerHTML = '';
      const eventosOrdenados = result.Items ? result.Items.filter(item => {
        return typeof item.f04_hora_event.S === 'string';}).sort((a, b) => {
          return b.f04_hora_event.S.localeCompare(a.f04_hora_event.S);}) : [];

      eventosOrdenados.forEach((doc) => {
        const data = doc;
        // Calcular la diferencia de horas entre la hora de ejecucion del usuario y la hora ajustada del evento

        //const proveedor = typeof data.f02_proveedor === 'object' ? data.f02_proveedor.S : data.f02_proveedor;
        const horaAjustada = ajustarHoraEvento(data.f04_hora_event, diferenciaHorariaUsuario);
        //const diferenciaHoras = calcularDiferenciaHoras(horaEjecucionUsuario, horaAjustada);
        //if ((diferenciaHoras >= -120 && diferenciaHoras <= 15) || (typeof proveedor === 'string' && proveedor.includes("LiveTV"))) {
        // Crear un elemento div para cada evento
        const eventoDiv = document.createElement('div');
        eventoDiv.classList.add('evento');

        // Verificar si f07_URL_Flag no es null
        const eventoHeader = document.createElement('div');
        eventoHeader.classList.add('evento-header');
        eventoDiv.appendChild(eventoHeader);

        // Crear un contenedor para banderaImg, horaEvento y categoryEvento
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
        categoryEvento.style.marginLeft = '5px';
        infoEventoContainer.appendChild(categoryEvento);

        // Agregar el contenedor de infoEventoContainer al eventoHeader
        eventoHeader.appendChild(infoEventoContainer);

        // Crear un contenedor para textoEvento y las imagenes
        const textoImagenesContainer = document.createElement('div');
        textoImagenesContainer.classList.add('texto-imagenes-container');

        const textoEvento = document.createElement('p');
        textoEvento.textContent = `${data.f06_name_event && typeof data.f06_name_event === 'object' && data.f06_name_event.hasOwnProperty('S') ? data.f06_name_event.S : ''}`;
        textoEvento.classList.add('texto-evento');
        // textoImagenesContainer.appendChild(textoEvento);

        // Verificar si textoEvento contiene "vs" (mayusculas o minusculas)
        const textoEventoString = textoEvento.textContent;
        const vsIndex = textoEventoString.toLowerCase().indexOf(' vs ');
        // console.log("textoEventoString.toLowerCase(): ", textoEventoString.toLowerCase());
        // console.log("vsIndex: ", vsIndex);
        if (vsIndex !== -1) {
          // Dividir el texto en dos partes antes y despues de "vs"
          const textoEventoIzquierda_vs = textoEventoString.slice(0, vsIndex).trim();
          const textoEventoDerecha_vs = textoEventoString.slice(vsIndex + 3).trim();

          // Crear elementos para cada parte del texto
          const textoEventoIzquierdaElement = document.createElement('p');
          textoEventoIzquierdaElement.textContent = textoEventoIzquierda_vs;
          textoEventoIzquierdaElement.classList.add('texto-evento-izquierda');
          textoImagenesContainer.appendChild(textoEventoIzquierdaElement);

          const horaEvento = document.createElement('p');
          horaEvento.textContent = `${horaAjustada} `;
          horaEvento.style.width = 'fit-content'; // Ajusta el ancho del contenedor al contenido
          horaEvento.style.margin = 'auto'; // Centra el contenedor horizontalmente
          horaEvento.classList.add('hora-evento');
          textoImagenesContainer.appendChild(horaEvento);

          const textoEventoDerechaElement = document.createElement('p');
          textoEventoDerechaElement.textContent = textoEventoDerecha_vs;
          textoEventoDerechaElement.classList.add('texto-evento-derecha');
          textoImagenesContainer.appendChild(textoEventoDerechaElement);

          // Agregar logotipos a ambos lados de "vs"
          // Cargar la imagen de f09_logo_Local antes de f06_name_event
          if (data.f09_logo_Local !== null && typeof data.f09_logo_Local === 'object' && data.f09_logo_Local.hasOwnProperty('S')) {
            const logoLocalImg = document.createElement('img');
            logoLocalImg.src = data.f09_logo_Local.S;
            logoLocalImg.alt = 'Logo Local';
            logoLocalImg.classList.add('logo-local');
            logoLocalImg.style.width = '40px'; // Ajusta el ancho según sea necesario
            logoLocalImg.style.height = 'auto'; // Mantén la proporción original
            logoLocalImg.style.marginRight = '10px'; // Ajusta el margen derecho según sea necesario
            logoLocalImg.classList.add('logo-evento-local');
            textoImagenesContainer.appendChild(logoLocalImg);
            textoImagenesContainer.insertBefore(logoLocalImg, textoEventoIzquierdaElement.nextSibling);
          }

          // Cargar la imagen de f11_logo_Visita después de f06_name_event
          if (data.f11_logo_Visita !== null && typeof data.f11_logo_Visita === 'object' && data.f11_logo_Visita.hasOwnProperty('S')) {
            const logoVisitaImg = document.createElement('img');
            logoVisitaImg.src = data.f11_logo_Visita.S;
            logoVisitaImg.alt = 'Logo Visita';
            logoVisitaImg.classList.add('logo-visita');
            logoVisitaImg.style.width = '40px'; // Ajusta el ancho según sea necesario
            logoVisitaImg.style.height = 'auto'; // Mantén la proporción original
            logoVisitaImg.style.marginLeft = '10px'; // Ajusta el margen izquierdo según sea necesario
            logoVisitaImg.classList.add('logo-evento-visita');
            textoImagenesContainer.appendChild(logoVisitaImg);
            textoImagenesContainer.insertBefore(logoVisitaImg, textoEventoDerechaElement);
          }
        } else {
          const horaEvento = document.createElement('p');
          horaEvento.textContent = `${horaAjustada} `;
          horaEvento.style.width = 'fit-content'; // Ajusta el ancho del contenedor al contenido
          horaEvento.style.margin = 'auto'; // Centra el contenedor horizontalmente
          horaEvento.classList.add('hora-evento');

          textoImagenesContainer.appendChild(horaEvento);
          // Si no contiene "vs", simplemente agregamos el texto original
          if (textoEvento.textContent.length > 26) {
            categoryEvento.textContent += " | " + textoEvento.textContent;
          }else{
            textoEvento.classList.add('texto-evento-izquierda');
            textoImagenesContainer.appendChild(textoEvento);
          }

        }
        // Agregar el contenedor de textoEventoContainer al eventoHeader
        eventoHeader.appendChild(textoImagenesContainer);

        // Esta parte hace clickeable el header para mostrar/ocultar detalles
        eventoHeader.addEventListener('click', () => {
          // Esto busca el contenedor de detalles dentro del eventoDiv y alterna su visibilidad
          const detalle = eventoDiv.querySelector('.detalle-evento-container');
          if (detalle) {
              detalle.style.display = detalle.style.display === 'none' ? 'block' : 'none';
          }
        });

        // Verifica si data.f20_Detalles_Evento es un objeto
        if (typeof data.f20_Detalles_Evento === 'object' && data.f20_Detalles_Evento !== null) {
            const detalleEventoContainer = document.createElement('div'); // Crear un contenedor para los detalles del evento
            detalleEventoContainer.classList.add('detalle-evento-container');
            detalleEventoContainer.style.display = 'none'; // Ocultar por defecto

            const closeButton = document.getElementById('close-button');
            const backgroundOverlay = document.getElementById('background-overlay');
            const iframeContainer = document.getElementById('iframe-container');
            const iframe = document.getElementById('detalle-iframe');

            // Funcion para cerrar el iframe y ocultar el fondo semi-transparente
            function cerrarIframe() {
              iframeContainer.style.display = 'none';
              backgroundOverlay.style.display = 'none';
              // Limpiar la URL del iframe para evitar que el video siga reproduciendose
              iframe.src = '';
            }
            // Agregar un controlador de eventos para cerrar el iframe cuando se hace clic en el boton de cerrar
            closeButton.addEventListener('click', cerrarIframe);

            function mostrarIframe(url) {
              iframe.src = url;
              iframeContainer.style.display = 'block';
              backgroundOverlay.style.display = 'block';
            }

            const eventoDetalle = document.createElement('ul');
            eventoDetalle.classList.add('detalle-evento');
            data.f20_Detalles_Evento.L.forEach(detalle => {
              //console.log("detalle.M.f22_opcion_Watch?.S.", detalle.M.f22_opcion_Watch?.S);
              if (!detalle.M.f22_opcion_Watch?.S || !detalle.M.f22_opcion_Watch.S.includes("sin_data")) {
                const detalleLi = document.createElement('li');
                if (detalle.M.f21_imagen_Idiom?.S) {
                      const imagenIdiom = document.createElement('img');
                      imagenIdiom.src = detalle.M.f21_imagen_Idiom.S;
                      imagenIdiom.alt = 'Idiom';
                      detalleLi.appendChild(document.createTextNode(' | '));
                      detalleLi.appendChild(imagenIdiom);
                }
                if (detalle.M.f23_text_Idiom?.S && detalle.M.f24_url_Final?.S) {
                  const enlace = document.createElement('a');
                  enlace.href = detalle.M.f24_url_Final.S;
                  enlace.textContent = detalle.M.f23_text_Idiom.S;
                  detalleLi.appendChild(document.createTextNode(' | '));
                  // Verificar si la URL contiene cierto texto
                  if (enlace.href.includes("atptour")) {
                      enlace.target = "_blank";
                  }
                    else if (enlace.href.includes("youtube.com")) {
                      // Verificar si el dispositivo es movil
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                      const videoId = extraerVideoIdDeYouTube(enlace.href);
                      if (videoId) {
                        if (isMobile) {
                            // Modificar el enlace para intentar abrir la aplicacion de YouTube
                            enlace.href = `vnd.youtube://${videoId}`;
                            enlace.target = "_blank";
                        } else {
                            // En PCs, abrir en el iframe como se estaba haciendo
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
                        // Verificar si el dispositivo es movil
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        const videoId = extraerVideoIdDeYouTube(enlaceWatch.href);
                        if (videoId) {
                          if (isMobile) {
                              // Modificar el enlace para intentar abrir la aplicación de YouTube
                              enlaceWatch.href = `vnd.youtube://${videoId}`;
                              enlaceWatch.target = "_blank";
                          } else {
                              // En PCs, abrir en el iframe como se estaba haciendo
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
                  eventoDetalle.appendChild(detalleLi);
              }
            });
            detalleEventoContainer.appendChild(eventoDetalle);
            eventoDiv.appendChild(detalleEventoContainer);
        } else {
            console.error("data.f20_Detalles_Evento no es un objeto o es nulo.");
        }
        // Agregar el elemento del evento al contenedor principal
        eventosContainer.appendChild(eventoDiv);
        //}
      });

      console.log("Conexion exitosa. Datos recuperados correctamente.");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

// Llamada a la funcion fetchData para verificar la conexion y recuperar datos
document.addEventListener('DOMContentLoaded', fetchData);

// Event listener para la busqueda y filtrado de eventos
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

