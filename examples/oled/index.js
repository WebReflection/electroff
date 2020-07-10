#!/usr/bin/env node

const {PORT = 3000} = process.env;

const express = require('express');
const electroff = require('electroff');

const app = express();
app.use(electroff);
app.use(express.static(`${__dirname}/public`));
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
