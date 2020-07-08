const {PORT = 3000} = process.env;

const express = require('express');
const electroff = require('../');

const app = express();
app.use(electroff);
app.use(express.static(__dirname));
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
