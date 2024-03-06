// firebase-interactions.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

// Inicializa Firebase con la configuración proporcionada
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  const horaOriginal = new Date(`2000-01-01T${horaEvento}:00Z`);
  
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
    const querySnapshot = await getDocs(collection(db, 'eventos'));
    const eventosContainer = document.getElementById('eventos-container');
    const diferenciaHorariaUsuario = await obtenerDiferenciaHorariaUsuario();

    // Limpiar el contenido actual del contenedor
    eventosContainer.innerHTML = '';

    const eventosOrdenados = querySnapshot.docs.sort((a, b) => a.data().f04_hora_event.localeCompare(b.data().f04_hora_event));

    eventosOrdenados.forEach((doc) => {
      const data = doc.data();
      const horaAjustada = ajustarHoraEvento(data.f04_hora_event, diferenciaHorariaUsuario);
      // Calcular la diferencia de horas entre la hora de ejecución del usuario y la hora ajustada del evento
      const diferenciaHoras = calcularDiferenciaHoras(horaEjecucionUsuario, horaAjustada);

      if ((diferenciaHoras >= -180 && diferenciaHoras <= 180) || (data.f02_proveedor.includes("LiveTv"))) {
          // Crear un elemento div para cada evento
        const eventoDiv = document.createElement('div');
        // Verificar si f07_URL_Flag no es null
        if (data.f07_URL_Flag !== null) {
          eventoDiv.innerHTML += `
            <div style="display: flex; align-items: center;">
              <img src="${data.f07_URL_Flag}" alt="Bandera" style="width: 30px; height: 20px; margin-right: 10px;">
              <p>${horaAjustada} - ${data.f05_event_categoria} - ${data.f06_name_event}</p>
            </div>
          `;
        } else {
          eventoDiv.innerHTML += `
            <p>${horaAjustada} - ${data.f05_event_categoria} - ${data.f06_name_event}</p>
          `;
        }
        eventoDiv.innerHTML += `
          <ul>
          ${data.f20_Detalles_Evento.map(detalle => `
            <li>
              ${detalle.f21_imagen_Idiom ? `<img src="${detalle.f21_imagen_Idiom}" alt="Idiom" crossorigin="anonymous">` : ''}
              ${detalle.f23_text_Idiom 
                ? `<a href="${detalle.f24_url_Final}" target="_blank">${detalle.f23_text_Idiom}</a>`
                : ''} 
              - 
              ${detalle.f22_opcion_Watch 
                ? `<a href="${detalle.f24_url_Final}" target="_blank">${detalle.f22_opcion_Watch}</a>`
                : ''}
          </li>        
          `).join('')}
        </ul>      
        <hr>        
      `;       
        // Agregar el elemento del evento al contenedor principal
        eventosContainer.appendChild(eventoDiv);
      }
    });

    console.log("Conexión exitosa. Datos recuperados correctamente 2.");
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
  }
};

// Llamada a la función fetchData para verificar la conexión y recuperar datos
document.addEventListener('DOMContentLoaded', fetchData);

        //   <ul>
        //   ${data.f20_Detalles_Evento.map(detalle => `
        //     <li>
        //       ${detalle.f21_imagen_Idiom ? `<img src="${detalle.f21_imagen_Idiom}" alt="Idiom" crossorigin="anonymous">` : ''}
        //       ${detalle.f23_text_Idiom ?? ''} - ${detalle.f22_opcion_Watch ?? ''} - ${detalle.f24_url_Final ?? ''}
        //     </li>
        //   `).join('')}
        // </ul>      
        // <hr>
        
        //<li>
        //${detalle.f21_imagen_Idiom ? `<img src="${detalle.f21_imagen_Idiom}" alt="Idiom" crossorigin="anonymous">` : ''}
        //${detalle.f23_text_Idiom ?? ''} - ${detalle.f22_opcion_Watch ?? ''} 
        //<br> <!-- Agregar un salto de línea -->
        //${detalle.f24_url_Final
        //    ? `<iframe src="${detalle.f24_url_Final}" width="300" height="200"></iframe>`
        //    : ''
        //}
      //</li>