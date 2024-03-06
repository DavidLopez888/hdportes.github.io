const express = require('express');
const app = express();

app.use(express.static(__dirname));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
