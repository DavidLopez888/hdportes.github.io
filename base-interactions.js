// Configura las credenciales de AWS
AWS.config.update({
  accessKeyId: 'AKIATCKAQMEJNSIO64FE',
  secretAccessKey: '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',
  region: 'us-east-1'
});

// Crea una instancia de DynamoDB
var dynamodb = new AWS.DynamoDB();

// Función para obtener la diferencia horaria entre el UTC-6 y la ubicación del usuario
async function obtenerDiferenciaHorariaUsuario() {
  try {
    const ubicacionUsuario = await obtenerUbicacionUsuario();
    if (ubicacionUsuario) {
      const zonaHorariaUsuario = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const diferenciaHoraria = obtenerDiferenciaHoraria("Etc/GMT+6", zonaHorariaUsuario);      
      return diferenciaHoraria;
    } else {
      console.warn("La geolocalización no está disponible o no se ha proporcionado permiso.");
      return 0;
    }
  } catch (error) {
    console.error("Error al obtener la diferencia horaria del usuario:", error);
    return 0;
  }
}

// Función para obtener la ubicación actual del usuario usando la API de geolocalización
function obtenerUbicacionUsuario() {
  return new Promise(async (resolve, reject) => {
    try {
      const permiso = await navigator.permissions.query({ name: 'geolocation' });

      if (permiso.state === 'granted') {
        // El permiso ya está otorgado, obtener la ubicación
        navigator.geolocation.getCurrentPosition(resolve, reject);
      } else if (permiso.state === 'prompt') {
        // El permiso aún no se ha otorgado, solicitarlo y luego obtener la ubicación
        navigator.geolocation.getCurrentPosition(resolve, reject);
      } else {
        // El permiso fue denegado o está bloqueado, mostrar un mensaje
        console.warn("La geolocalización no está disponible o no se ha proporcionado permiso.");
        reject("Permiso de geolocalización denegado");
      }
    } catch (error) {
      console.error("Error al verificar el permiso de geolocalización:", error);
      reject(error);
    }
  });
}

// Función para calcular la diferencia horaria entre dos zonas horarias
function obtenerDiferenciaHoraria(zonaHoraria1, zonaHoraria2) {
  const fechaActual = new Date();
  const offset1 = fechaActual.getTimezoneOffsetForZone(zonaHoraria1);
  const offset2 = fechaActual.getTimezoneOffsetForZone(zonaHoraria2);
  return (offset2 - offset1) / 60; // Devuelve la diferencia en horas
}

// Agrega este método al prototipo de Date para obtener el offset en minutos
Date.prototype.getTimezoneOffsetForZone = function (timeZone) {
  const utcDate = new Date(this.toLocaleString("en-US", { timeZone: "UTC" }));
  const localDate = new Date(this.toLocaleString("en-US", { timeZone }));
  return (localDate - utcDate) / (60 * 1000); // Devuelve el offset en minutos
};

// Función para ajustar la hora del evento según la diferencia horaria
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

const horaEjecucionUsuario = new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5);

const fetchData = async () => {
  try {
    const params = {TableName: 'eventos',};
    const result = await dynamodb.scan(params).promise();

    const eventosContainer = document.getElementById('eventos-container');
    const diferenciaHorariaUsuario = await obtenerDiferenciaHorariaUsuario();
    
    // Limpiar el contenido actual del contenedor
    eventosContainer.innerHTML = '';

    const eventosOrdenados = result.Items ? result.Items.filter(item => {
      return typeof item.f04_hora_event.S === 'string';}).sort((a, b) => {
        return a.f04_hora_event.S.localeCompare(b.f04_hora_event.S);}) : [];    
    
    eventosOrdenados.forEach((doc) => {      
      const data = doc;
      const horaAjustada = ajustarHoraEvento(data.f04_hora_event, diferenciaHorariaUsuario);
      
      // Calcular la diferencia de horas entre la hora de ejecución del usuario y la hora ajustada del evento
      const diferenciaHoras = calcularDiferenciaHoras(horaEjecucionUsuario, horaAjustada);

      if ((diferenciaHoras >= -180 && diferenciaHoras <= 180) || (typeof data.f02_proveedor === 'string' && data.f02_proveedor.includes("LiveTv"))) {
        // Crear un elemento div para cada evento
        const eventoDiv = document.createElement('div');
        eventoDiv.classList.add('evento');
    
        // Verificar si f07_URL_Flag no es null
        const eventoHeader = document.createElement('div');
        eventoHeader.classList.add('evento-header');
        eventoDiv.appendChild(eventoHeader);
    
        if (data.f07_URL_Flag !== null && typeof data.f07_URL_Flag === 'object' && data.f07_URL_Flag.hasOwnProperty('S')) {
            const banderaImg = document.createElement('img');
            banderaImg.src = data.f07_URL_Flag.S;
            banderaImg.alt = 'Bandera';
            banderaImg.classList.add('bandera');
            eventoHeader.appendChild(banderaImg);
        }
    
        const textoEvento = document.createElement('p');
        textoEvento.textContent = `${horaAjustada} - ${data.f05_event_categoria && typeof data.f05_event_categoria === 'object' && data.f05_event_categoria.hasOwnProperty('S') ? data.f05_event_categoria.S : ''} - ${data.f06_name_event && typeof data.f06_name_event === 'object' && data.f06_name_event.hasOwnProperty('S') ? data.f06_name_event.S : ''}`;
        textoEvento.classList.add('texto-evento');
        eventoHeader.appendChild(textoEvento);
    
        // Verifica si data.f20_Detalles_Evento es un objeto
        if (typeof data.f20_Detalles_Evento === 'object' && data.f20_Detalles_Evento !== null) {
            const detalleEventoContainer = document.createElement('div'); // Crear un contenedor para los detalles del evento
            detalleEventoContainer.classList.add('detalle-evento-container');
    
            const eventoDetalle = document.createElement('ul');
            eventoDetalle.classList.add('detalle-evento');
            data.f20_Detalles_Evento.L.forEach(detalle => {
                const detalleLi = document.createElement('li');
                if (detalle.M.f21_imagen_Idiom?.S) {
                    const imagenIdiom = document.createElement('img');
                    imagenIdiom.src = detalle.M.f21_imagen_Idiom.S;
                    imagenIdiom.alt = 'Idiom';
                    detalleLi.appendChild(imagenIdiom);
                }
                if (detalle.M.f23_text_Idiom?.S && detalle.M.f24_url_Final?.S) {
                    const enlace = document.createElement('a');
                    enlace.href = detalle.M.f24_url_Final.S;
                    enlace.target = '_blank';
                    enlace.textContent = detalle.M.f23_text_Idiom.S;
                    detalleLi.appendChild(enlace);
                }
                if (detalle.M.f22_opcion_Watch?.S && detalle.M.f24_url_Final?.S) {
                    const enlaceWatch = document.createElement('a');
                    enlaceWatch.href = detalle.M.f24_url_Final.S;
                    enlaceWatch.target = '_blank';
                    enlaceWatch.textContent = detalle.M.f22_opcion_Watch.S;
                    detalleLi.appendChild(enlaceWatch);
                }
                eventoDetalle.appendChild(detalleLi);
            });
            detalleEventoContainer.appendChild(eventoDetalle);
            eventoDiv.appendChild(detalleEventoContainer);
        } else {
            console.error("data.f20_Detalles_Evento no es un objeto o es nulo.");
        }
    
        // Agregar el elemento del evento al contenedor principal
        eventosContainer.appendChild(eventoDiv);
      }
    
    
    
    
    
    
    });

    console.log("Conexión exitosa. Datos recuperados correctamente 3.");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

// Llamada a la función fetchData para verificar la conexión y recuperar datos
document.addEventListener('DOMContentLoaded', fetchData);

// Event listener para la búsqueda y filtrado de eventos
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
